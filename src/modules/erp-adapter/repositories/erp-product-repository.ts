import type { ErpProduct } from '../dtos/erp-product-dto'

export interface IErpProductRepository {
  findSince(since: Date): Promise<ErpProduct[]>
}
