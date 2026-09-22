import 'reflect-metadata'
import { randomUUID } from 'node:crypto'
import { injectable, inject } from 'tsyringe'
import { type Either, right, left } from '@shared/core/either'
import type { DomainError } from '@shared/errors/domain-error'
import type { IOrderRepository } from '../../repositories/order-repository'
import type { IStockReservationRepository } from '../../repositories/stock-reservation-repository'
import type { ICheckoutOutboxRepository } from '../../repositories/checkout-outbox-repository'
import type { IProductStockChecker } from '../../repositories/product-stock-checker'
import { InsufficientStockError } from '../../errors/insufficient-stock-error'
import { ProductNotFoundError } from '../../errors/product-not-found-error'
import type { CreateCheckoutInput, CreateCheckoutOutput } from '../../dtos/checkout-dto'
import { OrderStatus } from '../../domain/value-objects/order-status'
import { tracer, SpanStatusCode } from '@shared/observability/tracer'
import { metrics } from '@shared/observability/metrics'

const RESERVATION_TTL_MS = 10 * 60 * 1000

@injectable()
export class CreateCheckoutUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IStockReservationRepository') private readonly stockReservationRepository: IStockReservationRepository,
    @inject('ICheckoutOutboxRepository') private readonly checkoutOutboxRepository: ICheckoutOutboxRepository,
    @inject('IProductStockChecker') private readonly productStockChecker: IProductStockChecker,
  ) {}

  async execute(input: CreateCheckoutInput): Promise<Either<DomainError, CreateCheckoutOutput>> {
    return tracer.startActiveSpan('checkout.create', async (span) => {
      try {
        span.setAttribute('customer.id', input.customerId)
        span.setAttribute('checkout.items_count', input.items.length)

        const existing = await this.orderRepository.findByIdempotencyKey(input.idempotencyKey)
        if (existing) {
          span.setAttribute('checkout.idempotent_hit', true)
          return right({ orderId: existing.id, status: existing.status, createdAt: existing.createdAt })
        }

        for (const item of input.items) {
          const stock = await this.productStockChecker.getProductStock(item.productId)
          if (!stock.exists) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'product_not_found' })
            return left(new ProductNotFoundError(item.productId))
          }
          const activeReserved = await this.stockReservationRepository.getActiveQuantity(item.productId)
          const available = stock.availableQuantity - activeReserved
          if (available < item.quantity) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'insufficient_stock' })
            return left(new InsufficientStockError(item.productId, item.quantity, available))
          }
        }

        const orderId = randomUUID()
        const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS)

        let order
        try {
          order = await this.orderRepository.createWithReservationsAndOutbox({
            id: orderId,
            customerId: input.customerId,
            correlationId: input.correlationId ?? randomUUID(),
            idempotencyKey: input.idempotencyKey,
            items: input.items,
            reservations: input.items.map(i => ({
              id: randomUUID(),
              productId: i.productId,
              quantity: i.quantity,
              expiresAt,
            })),
          })
        } catch (err) {
          if (err instanceof InsufficientStockError) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'insufficient_stock' })
            return left(err)
          }
          throw err
        }

        span.setAttribute('order.id', order.id)
        metrics.checkoutCreated.inc()

        return right({ orderId: order.id, status: OrderStatus.PENDING, createdAt: order.createdAt })
      } finally {
        span.end()
      }
    })
  }
}
