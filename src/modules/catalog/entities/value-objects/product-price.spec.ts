import { describe, it, expect } from 'vitest'
import { ProductPrice } from './product-price'

describe('ProductPrice', () => {
  it('creates with valid positive price', () => {
    const result = ProductPrice.create(29.9)
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.value).toBe(29.9)
  })

  it('creates with zero price', () => {
    const result = ProductPrice.create(0)
    expect(result.isSuccess()).toBe(true)
  })

  it('rejects negative price', () => {
    const result = ProductPrice.create(-1)
    expect(result.isFailure()).toBe(true)
    if (result.isFailure()) expect(result.value.code).toBe('INVALID_PRICE')
  })
})
