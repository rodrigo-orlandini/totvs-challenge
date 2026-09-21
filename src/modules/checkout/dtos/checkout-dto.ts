import type { OrderStatus } from '../domain/value-objects/order-status'

export interface CheckoutItem {
  productId: string
  quantity: number
}

export interface CreateCheckoutInput {
  idempotencyKey: string
  customerId: string
  correlationId?: string
  items: CheckoutItem[]
}

export interface CreateCheckoutOutput {
  orderId: string
  status: OrderStatus
  createdAt: Date
}
