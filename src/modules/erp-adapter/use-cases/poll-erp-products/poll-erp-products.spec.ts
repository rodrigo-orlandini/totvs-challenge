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

  it('re-opens ENQUEUED entry to PENDING when product is updated (prevents stale enqueue)', async () => {
    const product = makeErpProduct({ id: 'erp-1', updatedAt: new Date('2026-01-01T00:00:00Z') })
    erpRepo.products = [product]
    await useCase.execute({})
    outboxRepo.entries[0].status = 'ENQUEUED'

    erpRepo.products = [{ ...product, price: 59.9, updatedAt: new Date('2026-01-02T00:00:00Z') }]
    cursorRepo.cursors.set('product', new Date('2026-01-01T00:00:00Z'))
    await useCase.execute({})

    expect(outboxRepo.entries).toHaveLength(1)
    expect(outboxRepo.entries[0].status).toBe('PENDING')
    expect(outboxRepo.entries[0].attempts).toBe(0)
    expect((outboxRepo.entries[0].payload as { price: number }).price).toBe(59.9)
  })

  it('re-opens PROCESSED entry to PENDING when product is updated again', async () => {
    const product = makeErpProduct({ id: 'erp-1', updatedAt: new Date('2026-01-01T00:00:00Z') })
    erpRepo.products = [product]
    await useCase.execute({})
    outboxRepo.entries[0].status = 'PROCESSED'

    erpRepo.products = [{ ...product, name: 'Updated Again', updatedAt: new Date('2026-01-03T00:00:00Z') }]
    cursorRepo.cursors.set('product', new Date('2026-01-01T00:00:00Z'))
    await useCase.execute({})

    expect(outboxRepo.entries).toHaveLength(1)
    expect(outboxRepo.entries[0].status).toBe('PENDING')
    expect(outboxRepo.entries[0].attempts).toBe(0)
  })

  it('re-opens DEAD entry to PENDING when product is updated (retry after failure)', async () => {
    const product = makeErpProduct({ id: 'erp-1', updatedAt: new Date('2026-01-01T00:00:00Z') })
    erpRepo.products = [product]
    await useCase.execute({})
    outboxRepo.entries[0].status = 'DEAD'
    outboxRepo.entries[0].attempts = 10

    erpRepo.products = [{ ...product, name: 'Fixed Data', updatedAt: new Date('2026-01-04T00:00:00Z') }]
    cursorRepo.cursors.set('product', new Date('2026-01-01T00:00:00Z'))
    await useCase.execute({})

    expect(outboxRepo.entries).toHaveLength(1)
    expect(outboxRepo.entries[0].status).toBe('PENDING')
    expect(outboxRepo.entries[0].attempts).toBe(0) // reset attempt counter
  })

  it('cursor does not advance when no products detected', async () => {
    cursorRepo.cursors.set('product', new Date('2026-06-01T00:00:00Z'))
    erpRepo.products = [makeErpProduct({ updatedAt: new Date('2026-01-01T00:00:00Z') })]
    await useCase.execute({})
    expect(cursorRepo.cursors.get('product')).toEqual(new Date('2026-06-01T00:00:00Z'))
  })

  it('cursor advances to updatedAt of last product in batch', async () => {
    const t1 = new Date('2026-01-01T00:00:00Z')
    const t2 = new Date('2026-01-05T00:00:00Z')
    const t3 = new Date('2026-01-10T00:00:00Z')
    erpRepo.products = [
      makeErpProduct({ id: 'p1', updatedAt: t1 }),
      makeErpProduct({ id: 'p2', updatedAt: t2 }),
      makeErpProduct({ id: 'p3', updatedAt: t3 }),
    ]
    await useCase.execute({})
    expect(cursorRepo.cursors.get('product')).toEqual(t3)
  })
})
