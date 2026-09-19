import { type Either, left, right } from '@shared/core/either'
import { DomainError } from '@shared/errors/domain-error'

export class InvalidPriceError extends DomainError {
  readonly code = 'INVALID_PRICE'
  constructor() {
    super('Product price must be zero or positive')
  }
}

export class ProductPrice {
  readonly value: number

  private constructor(value: number) {
    this.value = value
  }

  static create(value: number): Either<InvalidPriceError, ProductPrice> {
    if (value < 0) return left(new InvalidPriceError())
    return right(new ProductPrice(value))
  }
}
