import { DomainError } from '@shared/errors/domain-error'

export class InsufficientStockError extends DomainError {
  readonly code = 'INSUFFICIENT_STOCK'

  constructor(productId: string, requested: number, available: number) {
    super(`Insufficient stock for product ${productId}: requested ${requested}, available ${available}`)
  }
}
