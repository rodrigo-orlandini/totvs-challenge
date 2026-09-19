import type { ListProductsOutput } from '../dtos/list-products-dto'

export class ProductPresenter {
  static toHTTP(output: ListProductsOutput): ListProductsOutput {
    return output
  }
}
