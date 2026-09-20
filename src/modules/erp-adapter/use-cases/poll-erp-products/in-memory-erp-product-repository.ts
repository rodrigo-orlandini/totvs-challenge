import type { IErpProductRepository } from '../../repositories/erp-product-repository'
import type { ErpProduct } from '../../dtos/erp-product-dto'

export class InMemoryErpProductRepository implements IErpProductRepository {
  products: ErpProduct[] = []

  async findSince(since: Date): Promise<ErpProduct[]> {
    return this.products.filter(p => p.updatedAt > since)
  }
}
