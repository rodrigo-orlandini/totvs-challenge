import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { PollErpProductsUseCase } from './poll-erp-products'
import { InMemoryErpProductRepository } from './in-memory-erp-product-repository'
import { InMemoryOutboxRepository } from '../in-memory-outbox-repository'
import { InMemorySyncCursorRepository } from '../in-memory-sync-cursor-repository'
import type { ErpProduct } from '../../dtos/erp-product-dto'

function makeErpProduct(overrides: Partial<ErpProduct> = {}): ErpProduct {
  return {
    id: 'erp-id-1',
    sku: 'SKU-001',
    name: 'Capa iPhone 15',
    price: 49.9,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

describe('PollErpProductsUseCase', () => {
  let erpRepo: InMemoryErpProductRepository
  let outboxRepo: InMemoryOutboxRepository
  let cursorRepo: InMemorySyncCursorRepository
  let useCase: PollErpProductsUseCase

  beforeEach(() => {
    erpRepo = new InMemoryErpProductRepository()
    outboxRepo = new InMemoryOutboxRepository()
    cursorRepo = new InMemorySyncCursorRepository()
    useCase = new PollErpProductsUseCase(erpRepo, outboxRepo, cursorRepo)
  })

  it('returns detected=0 when no products found since cursor', async () => {
    cursorRepo.cursors.set('product', new Date('2026-01-02T00:00:00Z'))
    erpRepo.products = [makeErpProduct({ updatedAt: new Date('2026-01-01T00:00:00Z') })]
    const result = await useCase.execute({})
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.detected).toBe(0)
  })

  it('writes detected products to outbox and advances cursor', async () => {
    const t1 = new Date('2026-01-01T00:00:00Z')
    const t2 = new Date('2026-01-02T00:00:00Z')
    erpRepo.products = [
      makeErpProduct({ id: 'erp-1', updatedAt: t1 }),
      makeErpProduct({ id: 'erp-2', updatedAt: t2 }),
    ]
    const result = await useCase.execute({})
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.detected).toBe(2)
    expect(outboxRepo.entries).toHaveLength(2)
    expect(outboxRepo.entries[0].entity).toBe('product')
    expect(outboxRepo.entries[0].erpId).toBe('erp-1')
    expect(cursorRepo.cursors.get('product')).toEqual(t2)
  })

  it('uses epoch as initial cursor when sync_cursors is empty', async () => {
    erpRepo.products = [makeErpProduct({ updatedAt: new Date('2000-01-01T00:00:00Z') })]
    await useCase.execute({})
    expect(outboxRepo.entries).toHaveLength(1)
  })

  it('re-opens PENDING outbox entry for updated product (idempotency)', async () => {
    const product = makeErpProduct({ id: 'erp-1', updatedAt: new Date('2026-01-01T00:00:00Z') })
    erpRepo.products = [product]
    await useCase.execute({})
    expect(outboxRepo.entries).toHaveLength(1)

    // product updated in ERP
    erpRepo.products = [{ ...product, name: 'New Name', updatedAt: new Date('2026-01-02T00:00:00Z') }]
    cursorRepo.cursors.set('product', new Date('2026-01-01T00:00:00Z'))
    await useCase.execute({})
    expect(outboxRepo.entries).toHaveLength(1) // same entry, not duplicate
    expect((outboxRepo.entries[0].payload as { name: string }).name).toBe('New Name')
  })
})
