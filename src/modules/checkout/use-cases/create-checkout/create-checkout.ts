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
    const existing = await this.orderRepository.findByIdempotencyKey(input.idempotencyKey)
    if (existing) {
      return right({ orderId: existing.id, status: existing.status, createdAt: existing.createdAt })
    }

    for (const item of input.items) {
      const stock = await this.productStockChecker.getProductStock(item.productId)
      if (!stock.exists) return left(new ProductNotFoundError(item.productId))
      const activeReserved = await this.stockReservationRepository.getActiveQuantity(item.productId)
      const available = stock.availableQuantity - activeReserved
      if (available < item.quantity) {
        return left(new InsufficientStockError(item.productId, item.quantity, available))
      }
    }

    const orderId = randomUUID()
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS)

    const order = await this.orderRepository.createWithReservationsAndOutbox({
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

    return right({ orderId: order.id, status: OrderStatus.PENDING, createdAt: order.createdAt })
  }
}
