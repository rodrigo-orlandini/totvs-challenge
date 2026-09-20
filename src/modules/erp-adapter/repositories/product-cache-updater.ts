export interface IProductCacheUpdater {
  updateProduct(id: string, data: {
    sku: string
    name: string
    price: number
    updatedAt: Date
  }): Promise<void>

  updateAvailableQuantity(productId: string, delta: number): Promise<void>
}
