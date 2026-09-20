import type { ICatalogProductWriteRepository } from '../../repositories/catalog-product-write-repository'

export class InMemoryCatalogProductWriteRepository implements ICatalogProductWriteRepository {
  upserted: Array<{ id: string; sku: string; name: string; price: number; updatedAt: Date }> = []

  async upsert(data: { id: string; sku: string; name: string; price: number; updatedAt: Date }): Promise<void> {
    const idx = this.upserted.findIndex(p => p.sku === data.sku)
    if (idx >= 0) this.upserted[idx] = data
    else this.upserted.push(data)
  }
}
