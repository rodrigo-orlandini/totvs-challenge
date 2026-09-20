export interface ICatalogProductWriteRepository {
  upsert(data: { id: string; sku: string; name: string; price: number; updatedAt: Date }): Promise<void>
}
