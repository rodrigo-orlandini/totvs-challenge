import 'reflect-metadata'
import { injectable, inject } from 'tsyringe'
import { type Either, right, left } from '@shared/core/either'
import type { DomainError } from '@shared/errors/domain-error'
import type { IOrderRepository } from '../../repositories/order-repository'
import type { IStockReservationRepository } from '../../repositories/stock-reservation-repository'
import type { ICheckoutOutboxRepository } from '../../repositories/checkout-outbox-repository'
import type { ICheckoutStockFlowWriter } from '../../repositories/checkout-stock-flow-writer'
import { OrderNotFoundError } from '../../errors/order-not-found-error'
import { OrderStatus } from '../../domain/value-objects/order-status'

export interface ProcessCheckoutJobInput {
  orderId: string
}

@injectable()
export class ProcessCheckoutJobUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IStockReservationRepository') private readonly stockReservationRepository: IStockReservationRepository,
    @inject('ICheckoutOutboxRepository') private readonly checkoutOutboxRepository: ICheckoutOutboxRepository,
    @inject('ICheckoutStockFlowWriter') private readonly stockFlowWriter: ICheckoutStockFlowWriter,
  ) {}

  async execute(input: ProcessCheckoutJobInput): Promise<Either<DomainError, void>> {
    const order = await this.orderRepository.findById(input.orderId)
    if (!order) return left(new OrderNotFoundError(input.orderId))

    if (order.status === OrderStatus.CONFIRMED) return right(undefined)

    await this.orderRepository.updateStatus(input.orderId, OrderStatus.CONFIRMED, {
      attempts: order.attempts + 1,
    })

    await this.stockReservationRepository.releaseByOrderId(input.orderId)

    for (const item of order.items) {
      await this.stockFlowWriter.createSaleFlow(item.productId, item.quantity)
    }

    return right(undefined)
  }

  async handleFinalFailure(orderId: string, error: string): Promise<void> {
    await this.orderRepository.updateStatus(orderId, OrderStatus.FAILED_PERMANENT, {
      lastError: error,
    })
    await this.stockReservationRepository.releaseByOrderId(orderId)
  }
}
