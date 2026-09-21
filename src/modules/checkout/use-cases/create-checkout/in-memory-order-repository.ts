import type { IOrderRepository, Order, CreateOrderData } from '../../repositories/order-repository'
import { OrderStatus } from '../../domain/value-objects/order-status'
import type { InMemoryStockReservationRepository } from './in-memory-stock-reservation-repository'
import type { InMemoryCheckoutOutboxRepository } from './in-memory-checkout-outbox-repository'

export class InMemoryOrderRepository implements IOrderRepository {
  private orders = new Map<string, Order>()

  constructor(
    private readonly reservationRepo?: InMemoryStockReservationRepository,
    private readonly outboxRepo?: InMemoryCheckoutOutboxRepository,
  ) {}

  async findByIdempotencyKey(key: string): Promise<Order | null> {
    for (const order of this.orders.values()) {
      if (order.idempotencyKey === key) return order
    }
    return null
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null
  }

  async createWithReservationsAndOutbox(data: CreateOrderData): Promise<Order> {
    const now = new Date()
    const order: Order = {
      id: data.id,
      customerId: data.customerId,
      correlationId: data.correlationId,
      idempotencyKey: data.idempotencyKey,
      status: OrderStatus.PENDING,
      attempts: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      items: data.items,
    }
    this.orders.set(order.id, order)

    for (const res of data.reservations) {
      this.reservationRepo?.addReservation({ ...res, orderId: data.id })
    }
    await this.outboxRepo?._create(data.id)

    return order
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    opts?: { attempts?: number; lastError?: string | null },
  ): Promise<void> {
    const order = this.orders.get(id)
    if (!order) return
    this.orders.set(id, {
      ...order,
      status,
      attempts: opts?.attempts ?? order.attempts,
      lastError: opts?.lastError !== undefined ? opts.lastError : order.lastError,
      updatedAt: new Date(),
    })
  }
}
