import { randomUUID } from 'node:crypto'
import type { ICheckoutOutboxRepository, CheckoutOutboxEntry } from '../../repositories/checkout-outbox-repository'

interface StoredEntry extends CheckoutOutboxEntry {
  status: string
}

export class InMemoryCheckoutOutboxRepository implements ICheckoutOutboxRepository {
  private entries = new Map<string, StoredEntry>()

  findByOrderId(orderId: string): StoredEntry | undefined {
    for (const e of this.entries.values()) {
      if (e.orderId === orderId) return e
    }
    return undefined
  }

  async markEnqueued(id: string): Promise<void> {
    const e = this.entries.get(id)
    if (e) this.entries.set(id, { ...e, status: 'ENQUEUED' })
  }

  async markProcessed(id: string): Promise<void> {
    const e = this.entries.get(id)
    if (e) this.entries.set(id, { ...e, status: 'PROCESSED' })
  }

  async markDead(id: string, _error: string): Promise<void> {
    const e = this.entries.get(id)
    if (e) this.entries.set(id, { ...e, status: 'DEAD' })
  }

  async findPending(): Promise<CheckoutOutboxEntry[]> {
    return [...this.entries.values()].filter(e => e.status === 'PENDING')
  }

  // Used internally by InMemoryOrderRepository via createWithReservationsAndOutbox
  async _create(orderId: string): Promise<void> {
    const id = randomUUID()
    this.entries.set(id, { id, orderId, status: 'PENDING' })
  }
}
