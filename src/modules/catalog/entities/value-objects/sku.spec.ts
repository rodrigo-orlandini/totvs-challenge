import { describe, it, expect } from 'vitest'
import { SKU } from './sku'

describe('SKU', () => {
  it('creates with valid string and uppercases it', () => {
    const result = SKU.create('case-iphone-15-black')
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.value).toBe('CASE-IPHONE-15-BLACK')
  })

  it('trims whitespace', () => {
    const result = SKU.create('  ABC-001  ')
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.value).toBe('ABC-001')
  })

  it('rejects empty string', () => {
    const result = SKU.create('')
    expect(result.isFailure()).toBe(true)
    if (result.isFailure()) expect(result.value.code).toBe('INVALID_SKU')
  })

  it('rejects whitespace-only string', () => {
    const result = SKU.create('   ')
    expect(result.isFailure()).toBe(true)
  })
})
