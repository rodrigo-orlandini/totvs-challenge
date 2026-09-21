import type { OrderStatus } from '../domain/value-objects/order-status'

export interface OrderItem {
  productId: string
  quantity: number
}

export interface Order {
  id: string
  customerId: string
  correlationId: string
  idempotencyKey: string
  status: OrderStatus
  attempts: number
  lastError: string | null
  createdAt: Date
  updatedAt: Date
  items: OrderItem[]
}

export interface CreateOrderData {
  id: string
  customerId: string
  correlationId: string
  idempotencyKey: string
  items: Array<{ productId: string; quantity: number }>
  reservations: Array<{ id: string; productId: string; quantity: number; expiresAt: Date }>
}

export interface IOrderRepository {
  findByIdempotencyKey(key: string): Promise<Order | null>
  findById(id: string): Promise<Order | null>
  createWithReservationsAndOutbox(data: CreateOrderData): Promise<Order>
  updateStatus(id: string, status: OrderStatus, opts?: { attempts?: number; lastError?: string | null }): Promise<void>
}
