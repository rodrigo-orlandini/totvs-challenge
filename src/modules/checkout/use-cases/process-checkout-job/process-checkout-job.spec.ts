import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { ProcessCheckoutJobUseCase } from './process-checkout-job'
import { InMemoryOrderRepository } from '../create-checkout/in-memory-order-repository'
import { InMemoryStockReservationRepository } from '../create-checkout/in-memory-stock-reservation-repository'
import { InMemoryCheckoutOutboxRepository } from '../create-checkout/in-memory-checkout-outbox-repository'
import { InMemoryCheckoutStockFlowWriter } from './in-memory-checkout-stock-flow-writer'
import { OrderStatus } from '../../domain/value-objects/order-status'

function makeRepos() {
  const reservationRepo = new InMemoryStockReservationRepository()
  const outboxRepo = new InMemoryCheckoutOutboxRepository()
  const orderRepo = new InMemoryOrderRepository(reservationRepo, outboxRepo)
  return { orderRepo, reservationRepo, outboxRepo }
}

describe('ProcessCheckoutJobUseCase', () => {
  let orderRepo: InMemoryOrderRepository
  let reservationRepo: InMemoryStockReservationRepository
  let outboxRepo: InMemoryCheckoutOutboxRepository
  let stockFlowWriter: InMemoryCheckoutStockFlowWriter
  let useCase: ProcessCheckoutJobUseCase

  beforeEach(async () => {
    const repos = makeRepos()
    orderRepo = repos.orderRepo
    reservationRepo = repos.reservationRepo
    outboxRepo = repos.outboxRepo
    stockFlowWriter = new InMemoryCheckoutStockFlowWriter()
    useCase = new ProcessCheckoutJobUseCase(orderRepo, reservationRepo, outboxRepo, stockFlowWriter)

    // Seed an order with one item and one reservation
    await orderRepo.createWithReservationsAndOutbox({
      id: 'order-1',
      customerId: 'cust-1',
      correlationId: 'corr-1',
      idempotencyKey: 'key-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
      reservations: [
        { id: 'res-1', orderId: 'order-1', productId: 'prod-1', quantity: 2, expiresAt: new Date(Date.now() + 600_000) },
      ],
    })
  })

  it('execute: sets CONFIRMED, releases reservations, creates sale StockFlow', async () => {
    const result = await useCase.execute({ orderId: 'order-1' })

    expect(result.isSuccess()).toBe(true)

    const order = await orderRepo.findById('order-1')
    expect(order?.status).toBe(OrderStatus.CONFIRMED)

    const reserved = await reservationRepo.getActiveQuantity('prod-1')
    expect(reserved).toBe(0)

    expect(stockFlowWriter.flows).toEqual([{ productId: 'prod-1', quantity: -2 }])
  })

  it('execute: returns OrderNotFoundError for unknown orderId', async () => {
    const result = await useCase.execute({ orderId: 'ghost' })
    expect(result.isFailure()).toBe(true)
    if (!result.isFailure()) return
    expect(result.value.code).toBe('ORDER_NOT_FOUND')
  })

  it('execute: increments attempts on each call', async () => {
    await useCase.execute({ orderId: 'order-1' })
    const order = await orderRepo.findById('order-1')
    expect(order?.attempts).toBe(1)
  })

  it('handleFinalFailure: sets FAILED_PERMANENT, releases reservations, no StockFlow', async () => {
    await useCase.handleFinalFailure('order-1', 'ERP timeout')

    const order = await orderRepo.findById('order-1')
    expect(order?.status).toBe(OrderStatus.FAILED_PERMANENT)
    expect(order?.lastError).toBe('ERP timeout')

    const reserved = await reservationRepo.getActiveQuantity('prod-1')
    expect(reserved).toBe(0)

    expect(stockFlowWriter.flows).toHaveLength(0)
  })
})
