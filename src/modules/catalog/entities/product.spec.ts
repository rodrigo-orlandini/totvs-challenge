import { describe, it, expect } from 'vitest'
import { Product } from './product'
import { ProductPrice } from './value-objects/product-price'
import { SKU } from './value-objects/sku'

function makeSKU(raw = 'CASE-SAM-S24-BLK') {
  const result = SKU.create(raw)
  if (!result.isSuccess()) throw new Error('invalid sku in test')
  return result.value
}

function makePrice(value = 49.9) {
  const result = ProductPrice.create(value)
  if (!result.isSuccess()) throw new Error('invalid price in test')
  return result.value
}

describe('Product', () => {
  it('creates with valid props and generates id', () => {
    const product = Product.create({ sku: makeSKU(), name: 'Capa Samsung S24', price: makePrice() })
    expect(product.id).toBeDefined()
    expect(product.sku).toBe('CASE-SAM-S24-BLK')
    expect(product.name).toBe('Capa Samsung S24')
    expect(product.price).toBe(49.9)
  })

  it('accepts explicit id for rehydration', () => {
    const id = 'fixed-uuid-001'
    const product = Product.create({ sku: makeSKU(), name: 'Capa', price: makePrice() }, id)
    expect(product.id).toBe('fixed-uuid-001')
  })
})
