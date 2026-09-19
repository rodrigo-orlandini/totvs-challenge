import type { ProductResponseItem } from '../dtos/list-products-dto'

export interface FindAllParams {
  page: number
  limit: number
}

export interface FindAllResult {
  products: ProductResponseItem[]
  total: number
}

export interface IProductRepository {
  findAll(params: FindAllParams): Promise<FindAllResult>
}
