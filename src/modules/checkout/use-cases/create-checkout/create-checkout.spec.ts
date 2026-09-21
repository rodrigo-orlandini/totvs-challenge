import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { CreateCheckoutUseCase } from './create-checkout'
import { InMemoryOrderRepository } from './in-memory-order-repository'
import { InMemoryStockReservationRepository } from './in-memory-stock-reservation-repository'
import { InMemoryCheckoutOutboxRepository } from './in-memory-checkout-outbox-repository'
import { InMemoryProductStockChecker } from './in-memory-product-stock-checker'
import { OrderStatus } from '../../domain/value-objects/order-status'

describe('CreateCheckoutUseCase', () => {
  let orderRepo: InMemoryOrderRepository
  let reservationRepo: InMemoryStockReservationRepository
  let outboxRepo: InMemoryCheckoutOutboxRepository
  let stockChecker: InMemoryProductStockChecker
  let useCase: CreateCheckoutUseCase

  beforeEach(() => {
    reservationRepo = new InMemoryStockReservationRepository()
    outboxRepo = new InMemoryCheckoutOutboxRepository()
    orderRepo = new InMemoryOrderRepository(reservationRepo, outboxRepo)
    stockChecker = new InMemoryProductStockChecker()
    useCase = new CreateCheckoutUseCase(orderRepo, reservationRepo, outboxRepo, stockChecker)
  })

  it('creates order with status PENDING, reservations, and outbox entry', async () => {
    stockChecker.setStock('prod-1', 10)

    const result = await useCase.execute({
      idempotencyKey: 'key-1',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 3 }],
    })

    expect(result.isSuccess()).toBe(true)
    if (!result.isSuccess()) return
    expect(result.value.status).toBe(OrderStatus.PENDING)
    expect(result.value.orderId).toBeDefined()

    const order = await orderRepo.findById(result.value.orderId)
    expect(order?.items).toHaveLength(1)
    expect(order?.items[0]).toEqual({ productId: 'prod-1', quantity: 3 })

    const reserved = await reservationRepo.getActiveQuantity('prod-1')
    expect(reserved).toBe(3)

    const outbox = outboxRepo.findByOrderId(result.value.orderId)
    expect(outbox).toBeDefined()
  })

  it('returns existing order on duplicate idempotency key without side effects', async () => {
    stockChecker.setStock('prod-1', 10)

    const first = await useCase.execute({
      idempotencyKey: 'key-dup',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
    })
    expect(first.isSuccess()).toBe(true)

    const second = await useCase.execute({
      idempotencyKey: 'key-dup',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
    })
    expect(second.isSuccess()).toBe(true)
    if (!second.isSuccess() || !first.isSuccess()) return
    expect(second.value.orderId).toBe(first.value.orderId)

    // Only one reservation created
    expect(await reservationRepo.getActiveQuantity('prod-1')).toBe(2)
  })

  it('returns ProductNotFoundError when product does not exist', async () => {
    const result = await useCase.execute({
      idempotencyKey: 'key-2',
      customerId: 'cust-1',
      items: [{ productId: 'missing-prod', quantity: 1 }],
    })

    expect(result.isFailure()).toBe(true)
    if (!result.isFailure()) return
    expect(result.value.code).toBe('PRODUCT_NOT_FOUND')
  })

  it('returns InsufficientStockError when available quantity is too low', async () => {
    stockChecker.setStock('prod-2', 2)

    const result = await useCase.execute({
      idempotencyKey: 'key-3',
      customerId: 'cust-1',
      items: [{ productId: 'prod-2', quantity: 5 }],
    })

    expect(result.isFailure()).toBe(true)
    if (!result.isFailure()) return
    expect(result.value.code).toBe('INSUFFICIENT_STOCK')
  })

  it('expired reservations do not reduce available quantity', async () => {
    stockChecker.setStock('prod-3', 5)
    // Manually inject an expired reservation
    reservationRepo.addExpiredReservation({ productId: 'prod-3', quantity: 4 })

    const result = await useCase.execute({
      idempotencyKey: 'key-4',
      customerId: 'cust-1',
      items: [{ productId: 'prod-3', quantity: 5 }],
    })

    expect(result.isSuccess()).toBe(true)
  })

  it('generates correlationId when not provided', async () => {
    stockChecker.setStock('prod-1', 10)

    const result = await useCase.execute({
      idempotencyKey: 'key-5',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
    })

    expect(result.isSuccess()).toBe(true)
    if (!result.isSuccess()) return
    const order = await orderRepo.findById(result.value.orderId)
    expect(order?.correlationId).toBeDefined()
    expect(order?.correlationId.length).toBeGreaterThan(0)
  })
})
