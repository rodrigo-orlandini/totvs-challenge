export interface ICatalogStockFlowWriteRepository {
  createIfNotExists(data: { id: string; productId: string; quantity: number; movedAt: Date }): Promise<void>
}
