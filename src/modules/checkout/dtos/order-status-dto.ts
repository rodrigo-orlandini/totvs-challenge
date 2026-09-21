import type { OrderStatus } from '../domain/value-objects/order-status'

export interface GetOrderStatusOutput {
  orderId: string
  status: OrderStatus
  attempts: number
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}
