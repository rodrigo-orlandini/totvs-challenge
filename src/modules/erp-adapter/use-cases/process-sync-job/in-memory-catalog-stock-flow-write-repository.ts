import type { ICatalogStockFlowWriteRepository } from '../../repositories/catalog-stock-flow-write-repository'

export class InMemoryCatalogStockFlowWriteRepository implements ICatalogStockFlowWriteRepository {
  created: Array<{ id: string; productId: string; quantity: number; movedAt: Date }> = []

  async createIfNotExists(data: { id: string; productId: string; quantity: number; movedAt: Date }): Promise<void> {
    const exists = this.created.some(sf => sf.id === data.id)
    if (!exists) this.created.push(data)
  }
}
