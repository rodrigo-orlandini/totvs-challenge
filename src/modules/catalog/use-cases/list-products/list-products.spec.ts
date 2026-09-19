import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { ListProductsUseCase } from './list-products'
import { InMemoryProductRepository } from './in-memory-product-repository'
import type { ProductResponseItem } from '../../dtos/list-products-dto'

function makeItem(overrides: Partial<ProductResponseItem> = {}): ProductResponseItem {
  return {
    id: 'id-1',
    sku: 'SKU-001',
    name: 'Capa Silicone Samsung S24',
    price: 29.9,
    availableQuantity: 50,
    ...overrides,
  }
}

describe('ListProductsUseCase', () => {
  let repo: InMemoryProductRepository
  let useCase: ListProductsUseCase

  beforeEach(() => {
    repo = new InMemoryProductRepository()
    useCase = new ListProductsUseCase(repo)
  })

  it('returns empty list when no products exist', async () => {
    const result = await useCase.execute({})
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) {
      expect(result.value.data).toHaveLength(0)
      expect(result.value.meta.total).toBe(0)
    }
  })

  it('returns products with default pagination (page=1, limit=20)', async () => {
    repo.products = [makeItem({ id: 'id-1' }), makeItem({ id: 'id-2' })]
    const result = await useCase.execute({})
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) {
      expect(result.value.data).toHaveLength(2)
      expect(result.value.meta.page).toBe(1)
      expect(result.value.meta.limit).toBe(20)
    }
  })

  it('calculates totalPages correctly', async () => {
    repo.products = Array.from({ length: 55 }, (_, i) => makeItem({ id: `id-${i}` }))
    const result = await useCase.execute({ limit: 20 })
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) {
      expect(result.value.meta.total).toBe(55)
      expect(result.value.meta.totalPages).toBe(3)
    }
  })

  it('returns correct subset for page 2', async () => {
    repo.products = Array.from({ length: 25 }, (_, i) => makeItem({ id: `id-${i}` }))
    const result = await useCase.execute({ page: 2, limit: 10 })
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) {
      expect(result.value.data).toHaveLength(10)
      expect(result.value.data[0].id).toBe('id-10')
    }
  })

  it('returns single page when total equals limit', async () => {
    repo.products = Array.from({ length: 20 }, (_, i) => makeItem({ id: `id-${i}` }))
    const result = await useCase.execute({ limit: 20 })
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) {
      expect(result.value.meta.totalPages).toBe(1)
    }
  })
})
