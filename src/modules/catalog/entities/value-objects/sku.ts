import { type Either, left, right } from '@shared/core/either'
import { DomainError } from '@shared/errors/domain-error'

export class InvalidSKUError extends DomainError {
  readonly code = 'INVALID_SKU'
  constructor() {
    super('SKU must be a non-empty string')
  }
}

export class SKU {
  readonly value: string

  private constructor(value: string) {
    this.value = value
  }

  static create(raw: string): Either<InvalidSKUError, SKU> {
    const trimmed = raw.trim().toUpperCase()
    if (trimmed.length === 0) return left(new InvalidSKUError())
    return right(new SKU(trimmed))
  }
}
