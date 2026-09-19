import { describe, it, expect } from 'vitest'
import { ProductMapper } from './product-mapper'

describe('ProductMapper.toDomain', () => {
  const validRow = {
    id: 'abc-123',
    sku: 'IPHONE-15',
    name: 'iPhone 15',
    price: { toNumber: () => 4999.99 },
  }

  it('maps a valid DB row to a Product domain entity', () => {
    const product = ProductMapper.toDomain(validRow)

    expect(product.id).toBe('abc-123')
    expect(product.sku).toBe('IPHONE-15')
    expect(product.name).toBe('iPhone 15')
    expect(product.price).toBe(4999.99)
  })

  it('throws when the SKU stored in DB is empty', () => {
    const row = { ...validRow, sku: '   ' }

    expect(() => ProductMapper.toDomain(row)).toThrow('Invalid SKU in DB')
  })

  it('throws when the price stored in DB is negative', () => {
    const row = { ...validRow, price: { toNumber: () => -1 } }

    expect(() => ProductMapper.toDomain(row)).toThrow('Invalid price in DB')
  })
})
