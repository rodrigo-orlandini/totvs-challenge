import { DomainError } from '@shared/errors/domain-error'

export class OrderNotFoundError extends DomainError {
  readonly code = 'ORDER_NOT_FOUND'

  constructor(orderId: string) {
    super(`Order ${orderId} not found`)
  }
}
