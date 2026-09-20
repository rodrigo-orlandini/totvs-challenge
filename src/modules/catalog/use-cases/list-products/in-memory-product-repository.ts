import type { IProductRepository, FindAllParams, FindAllResult } from '../../repositories/product-repository'
import type { ProductResponseItem } from '../../dtos/list-products-dto'

export class InMemoryProductRepository implements IProductRepository {
  products: ProductResponseItem[] = []

  async findAll({ page, limit }: FindAllParams): Promise<FindAllResult> {
    const skip = (page - 1) * limit
    return {
      products: this.products.slice(skip, skip + limit),
      total: this.products.length,
    }
  }
}
