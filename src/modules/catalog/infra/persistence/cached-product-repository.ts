import type { PrismaClient } from '@prisma/client'
import type { IProductRepository, FindAllParams, FindAllResult } from '../../repositories/product-repository'
import type { ProductResponseItem } from '../../dtos/list-products-dto'
import type { ProductCacheService } from '../../cache/product-cache-service'

export class CachedProductRepository implements IProductRepository {
  constructor(
    private readonly cache: ProductCacheService,
    private readonly prisma: PrismaClient,
  ) {}

  async findAll({ page, limit }: FindAllParams): Promise<FindAllResult> {
    const { ids, total } = await this.resolveIds()
    const offset = (page - 1) * limit
    const pageIds = ids.slice(offset, offset + limit)
    const products = await this.resolveProducts(pageIds)
    return { products, total }
  }

  private async resolveIds(): Promise<{ ids: string[]; total: number }> {
    const l1Ids = this.cache.getL1Ids()
    if (l1Ids) {
      const total = (await this.cache.getTotal()) ?? l1Ids.length
      return { ids: l1Ids, total }
    }

    const [l2Ids, l2Total] = await Promise.all([
      this.cache.getRedisIds(),
      this.cache.getTotal(),
    ])
    if (l2Ids && l2Total !== null) {
      this.cache.setL1Ids(l2Ids)
      return { ids: l2Ids, total: l2Total }
    }

    const rows = await this.prisma.product.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: { id: true, createdAt: true },
    })
    const ids = rows.map((r) => r.id)
    const total = ids.length
    this.cache.setL1Ids(ids)
    await this.cache.setRedisIds(rows.map((r) => ({ id: r.id, score: r.createdAt.getTime() })))
    return { ids, total }
  }

  private async resolveProducts(ids: string[]): Promise<ProductResponseItem[]> {
    const results = await Promise.all(ids.map((id) => this.resolveProduct(id)))
    return results.filter((p): p is ProductResponseItem => p !== null)
  }

  private async resolveProduct(id: string): Promise<ProductResponseItem | null> {
    const cached = await this.cache.getProduct(id)
    if (cached) return cached

    const row = await this.prisma.product.findUnique({
      where: { id },
      include: { stockFlow: { select: { quantity: true } } },
    })
    if (!row) return null

    const data: ProductResponseItem = {
      id: row.id,
      sku: row.sku,
      name: row.name,
      price: row.price.toNumber(),
      availableQuantity: row.stockFlow.reduce((sum, sf) => sum + sf.quantity, 0),
    }
    await this.cache.setProduct(id, data)
    return data
  }
}
