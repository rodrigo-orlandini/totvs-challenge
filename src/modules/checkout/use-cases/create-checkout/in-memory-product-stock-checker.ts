import type { IProductStockChecker, ProductStockInfo } from '../../repositories/product-stock-checker'

export class InMemoryProductStockChecker implements IProductStockChecker {
  private stocks = new Map<string, number>()

  setStock(productId: string, availableQuantity: number): void {
    this.stocks.set(productId, availableQuantity)
  }

  async getProductStock(productId: string): Promise<ProductStockInfo> {
    const qty = this.stocks.get(productId)
    if (qty === undefined) return { exists: false, availableQuantity: 0 }
    return { exists: true, availableQuantity: qty }
  }
}
