import 'reflect-metadata'
import { injectable, inject } from 'tsyringe'
import { type Either, right, left } from '@shared/core/either'
import type { DomainError } from '@shared/errors/domain-error'
import type { IOrderRepository } from '../../repositories/order-repository'
import { OrderNotFoundError } from '../../errors/order-not-found-error'
import type { GetOrderStatusOutput } from '../../dtos/order-status-dto'

export interface GetOrderStatusInput {
  orderId: string
}

@injectable()
export class GetOrderStatusUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
  ) {}

  async execute(input: GetOrderStatusInput): Promise<Either<DomainError, GetOrderStatusOutput>> {
    const order = await this.orderRepository.findById(input.orderId)
    if (!order) return left(new OrderNotFoundError(input.orderId))

    return right({
      orderId: order.id,
      status: order.status,
      attempts: order.attempts,
      lastError: order.lastError,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    })
  }
}
