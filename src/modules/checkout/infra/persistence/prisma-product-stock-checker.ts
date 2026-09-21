import type { PrismaClient } from '@prisma/client'
import type { IProductStockChecker, ProductStockInfo } from '../../repositories/product-stock-checker'

export class PrismaProductStockChecker implements IProductStockChecker {
  constructor(private readonly prisma: PrismaClient) {}

  async getProductStock(productId: string): Promise<ProductStockInfo> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) return { exists: false, availableQuantity: 0 }

    const stockTotal = await this.prisma.stockFlow.aggregate({
      _sum: { quantity: true },
      where: { productId },
    })

    const grossStock = stockTotal._sum.quantity ?? 0
    return { exists: true, availableQuantity: Math.max(0, grossStock) }
  }
}
