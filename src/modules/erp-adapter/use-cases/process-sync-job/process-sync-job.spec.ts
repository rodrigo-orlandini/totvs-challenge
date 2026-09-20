import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { ProcessSyncJobUseCase } from './process-sync-job'
import { InMemoryCatalogProductWriteRepository } from './in-memory-catalog-product-write-repository'
import { InMemoryCatalogStockFlowWriteRepository } from './in-memory-catalog-stock-flow-write-repository'
import { InMemoryOutboxRepository } from '../in-memory-outbox-repository'

describe('ProcessSyncJobUseCase', () => {
  let productRepo: InMemoryCatalogProductWriteRepository
  let stockFlowRepo: InMemoryCatalogStockFlowWriteRepository
  let outboxRepo: InMemoryOutboxRepository
  let useCase: ProcessSyncJobUseCase

  beforeEach(() => {
    productRepo = new InMemoryCatalogProductWriteRepository()
    stockFlowRepo = new InMemoryCatalogStockFlowWriteRepository()
    outboxRepo = new InMemoryOutboxRepository()
    useCase = new ProcessSyncJobUseCase(productRepo, stockFlowRepo, outboxRepo)
  })

  it('upserts product and marks outbox PROCESSED', async () => {
    await outboxRepo.writeProducts([{ id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updatedAt: new Date() }])
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    const result = await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-1' })
    expect(result.isSuccess()).toBe(true)
    expect(productRepo.upserted).toHaveLength(1)
    expect(productRepo.upserted[0].sku).toBe('SKU-001')
    const entry = outboxRepo.entries.find(e => e.entity === 'product' && e.erpId === 'erp-1')
    expect(entry?.status).toBe('PROCESSED')
  })

  it('creates stock_flow if not exists and marks outbox PROCESSED', async () => {
    await outboxRepo.writeStockFlows([{ id: 'sf-1', productId: 'prod-1', quantity: 10, movedAt: new Date() }])
    const payload = { id: 'sf-1', product_id: 'prod-1', quantity: 10, moved_at: '2026-01-01T00:00:00Z' }
    const result = await useCase.execute({ entity: 'stock_flow', erpId: 'sf-1', payload, correlationId: 'corr-2' })
    expect(result.isSuccess()).toBe(true)
    expect(stockFlowRepo.created).toHaveLength(1)
    const entry = outboxRepo.entries.find(e => e.entity === 'stock_flow' && e.erpId === 'sf-1')
    expect(entry?.status).toBe('PROCESSED')
  })

  it('does NOT create duplicate stock_flow (idempotency)', async () => {
    const payload = { id: 'sf-1', product_id: 'prod-1', quantity: 10, moved_at: '2026-01-01T00:00:00Z' }
    await useCase.execute({ entity: 'stock_flow', erpId: 'sf-1', payload, correlationId: 'corr-3' })
    await useCase.execute({ entity: 'stock_flow', erpId: 'sf-1', payload, correlationId: 'corr-3' })
    expect(stockFlowRepo.created).toHaveLength(1)
  })

  it('returns left(SyncProcessingError) when product repo throws', async () => {
    productRepo.upsert = async () => { throw new Error('DB connection failed') }
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    const result = await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-4' })
    expect(result.isFailure()).toBe(true)
    expect(result.value).toMatchObject({ code: 'SYNC_PROCESSING_ERROR' })
  })

  it('returns left(SyncProcessingError) when stock_flow repo throws', async () => {
    stockFlowRepo.createIfNotExists = async () => { throw new Error('FK constraint violation') }
    const payload = { id: 'sf-1', product_id: 'prod-1', quantity: 10, moved_at: '2026-01-01T00:00:00Z' }
    const result = await useCase.execute({ entity: 'stock_flow', erpId: 'sf-1', payload, correlationId: 'corr-5' })
    expect(result.isFailure()).toBe(true)
    expect(result.value).toMatchObject({ code: 'SYNC_PROCESSING_ERROR' })
  })

  it('includes non-Error thrown value in SyncProcessingError cause', async () => {
    productRepo.upsert = async () => { throw 'plain string error' }
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    const result = await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-6' })
    expect(result.isFailure()).toBe(true)
    if (result.isFailure()) {
      expect((result.value as { message: string }).message).toContain('plain string error')
    }
  })

  it('does NOT mark outbox PROCESSED when product upsert fails', async () => {
    await outboxRepo.writeProducts([{ id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updatedAt: new Date() }])
    productRepo.upsert = async () => { throw new Error('transient error') }
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-7' })
    const entry = outboxRepo.entries.find(e => e.entity === 'product' && e.erpId === 'erp-1')
    expect(entry?.status).toBe('PENDING') // stays PENDING, not PROCESSED
  })
})
