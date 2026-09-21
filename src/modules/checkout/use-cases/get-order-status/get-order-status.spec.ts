import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { GetOrderStatusUseCase } from './get-order-status'
import { InMemoryOrderRepository } from '../create-checkout/in-memory-order-repository'
import { InMemoryStockReservationRepository } from '../create-checkout/in-memory-stock-reservation-repository'
import { InMemoryCheckoutOutboxRepository } from '../create-checkout/in-memory-checkout-outbox-repository'
import { OrderStatus } from '../../domain/value-objects/order-status'

function makeOrderRepo() {
  const reservationRepo = new InMemoryStockReservationRepository()
  const outboxRepo = new InMemoryCheckoutOutboxRepository()
  return new InMemoryOrderRepository(reservationRepo, outboxRepo)
}

describe('GetOrderStatusUseCase', () => {
  let orderRepo: InMemoryOrderRepository
  let useCase: GetOrderStatusUseCase

  beforeEach(() => {
    orderRepo = makeOrderRepo()
    useCase = new GetOrderStatusUseCase(orderRepo)
  })

  it('returns order status fields for existing order', async () => {
    await orderRepo.createWithReservationsAndOutbox({
      id: 'order-1',
      customerId: 'cust-1',
      correlationId: 'corr-1',
      idempotencyKey: 'key-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
      reservations: [],
    })

    const result = await useCase.execute({ orderId: 'order-1' })

    expect(result.isSuccess()).toBe(true)
    if (!result.isSuccess()) return
    expect(result.value.orderId).toBe('order-1')
    expect(result.value.status).toBe(OrderStatus.PENDING)
    expect(result.value.attempts).toBe(0)
    expect(result.value.lastError).toBeNull()
    expect(result.value.createdAt).toBeInstanceOf(Date)
    expect(result.value.updatedAt).toBeInstanceOf(Date)
  })

  it('returns OrderNotFoundError for unknown orderId', async () => {
    const result = await useCase.execute({ orderId: 'does-not-exist' })

    expect(result.isFailure()).toBe(true)
    if (!result.isFailure()) return
    expect(result.value.code).toBe('ORDER_NOT_FOUND')
  })
})
