import type { ErpProduct } from '../dtos/erp-product-dto'
import type { ErpStockFlow } from '../dtos/erp-stock-flow-dto'
import type { OutboxEntry } from '../entities/outbox-entry'

export interface IOutboxRepository {
  writeProducts(products: ErpProduct[]): Promise<void>
  writeStockFlows(stockFlows: ErpStockFlow[]): Promise<void>
  findPending(limit: number): Promise<OutboxEntry[]>
  markEnqueued(ids: string[]): Promise<void>
  markProcessed(entity: string, erpId: string): Promise<void>
  markDead(entity: string, erpId: string, error: string, attempts: number): Promise<void>
}
