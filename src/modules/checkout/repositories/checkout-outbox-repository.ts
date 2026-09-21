export interface CheckoutOutboxEntry {
  id: string
  orderId: string
}

export interface ICheckoutOutboxRepository {
  markEnqueued(id: string): Promise<void>
  markProcessed(id: string): Promise<void>
  markDead(id: string, error: string): Promise<void>
  findPending(): Promise<CheckoutOutboxEntry[]>
}
