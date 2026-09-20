import type { IOutboxRepository } from '../repositories/outbox-repository'
import type { ErpProduct } from '../dtos/erp-product-dto'
import type { ErpStockFlow } from '../dtos/erp-stock-flow-dto'
import type { OutboxEntry } from '../entities/outbox-entry'
import { randomUUID } from 'node:crypto'

export class InMemoryOutboxRepository implements IOutboxRepository {
  entries: OutboxEntry[] = []

  async writeProducts(products: ErpProduct[]): Promise<void> {
    for (const p of products) {
      const existing = this.entries.find(e => e.entity === 'product' && e.erpId === p.id)
      if (existing) {
        existing.payload = p as unknown as Record<string, unknown>
        existing.status = 'PENDING'
      } else {
        this.entries.push({
          id: randomUUID(),
          entity: 'product',
          erpId: p.id,
          payload: p as unknown as Record<string, unknown>,
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
        })
      }
    }
  }

  async writeStockFlows(stockFlows: ErpStockFlow[]): Promise<void> {
    for (const sf of stockFlows) {
      const exists = this.entries.some(e => e.entity === 'stock_flow' && e.erpId === sf.id)
      if (!exists) {
        this.entries.push({
          id: randomUUID(),
          entity: 'stock_flow',
          erpId: sf.id,
          payload: sf as unknown as Record<string, unknown>,
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date(),
        })
      }
    }
  }

  async findPending(limit: number): Promise<OutboxEntry[]> {
    return this.entries.filter(e => e.status === 'PENDING').slice(0, limit)
  }

  async markEnqueued(ids: string[]): Promise<void> {
    for (const entry of this.entries) {
      if (ids.includes(entry.id)) entry.status = 'ENQUEUED'
    }
  }

  async markProcessed(entity: string, erpId: string): Promise<void> {
    const entry = this.entries.find(e => e.entity === entity && e.erpId === erpId)
    if (entry) entry.status = 'PROCESSED'
  }

  async markDead(entity: string, erpId: string, _error: string, attempts: number): Promise<void> {
    const entry = this.entries.find(e => e.entity === entity && e.erpId === erpId)
    if (entry) { entry.status = 'DEAD'; entry.attempts = attempts }
  }
}
