import { DomainError } from '@shared/errors/domain-error'

export class ProductNotFoundError extends DomainError {
  readonly code = 'PRODUCT_NOT_FOUND'

  constructor(productId: string) {
    super(`Product ${productId} not found`)
  }
}
