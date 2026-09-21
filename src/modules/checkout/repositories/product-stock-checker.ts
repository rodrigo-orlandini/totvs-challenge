export interface ProductStockInfo {
  exists: boolean
  availableQuantity: number
}

export interface IProductStockChecker {
  getProductStock(productId: string): Promise<ProductStockInfo>
}
