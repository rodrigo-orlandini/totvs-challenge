import 'reflect-metadata'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProcessSyncJobUseCase } from './process-sync-job'
import { InMemoryCatalogProductWriteRepository } from './in-memory-catalog-product-write-repository'
import { InMemoryCatalogStockFlowWriteRepository } from './in-memory-catalog-stock-flow-write-repository'
import { InMemoryOutboxRepository } from '../in-memory-outbox-repository'

describe('ProcessSyncJobUseCase', () => {
  let productRepo: InMemoryCatalogProductWriteRepository
  let stockFlowRepo: InMemoryCatalogStockFlowWriteRepository
  let outboxRepo: InMemoryOutboxRepository
  let cacheUpdater: { updateProduct: ReturnType<typeof vi.fn>; updateAvailableQuantity: ReturnType<typeof vi.fn> }
  let useCase: ProcessSyncJobUseCase

  beforeEach(() => {
    productRepo = new InMemoryCatalogProductWriteRepository()
    stockFlowRepo = new InMemoryCatalogStockFlowWriteRepository()
    outboxRepo = new InMemoryOutboxRepository()
    cacheUpdater = {
      updateProduct: vi.fn().mockResolvedValue(undefined),
      updateAvailableQuantity: vi.fn().mockResolvedValue(undefined),
    }
    useCase = new ProcessSyncJobUseCase(productRepo, stockFlowRepo, outboxRepo, cacheUpdater)
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

  it('calls cacheUpdater.updateProduct with exact args after successful product upsert', async () => {
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-8' })
    expect(cacheUpdater.updateProduct).toHaveBeenCalledOnce()
    expect(cacheUpdater.updateProduct).toHaveBeenCalledWith('erp-1', {
      sku: 'SKU-001',
      name: 'Capa',
      price: 49.9,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    })
  })

  it('calls cacheUpdater.updateAvailableQuantity with exact args after successful stock_flow create', async () => {
    const payload = { id: 'sf-1', product_id: 'prod-1', quantity: 10, moved_at: '2026-01-01T00:00:00Z' }
    await useCase.execute({ entity: 'stock_flow', erpId: 'sf-1', payload, correlationId: 'corr-9' })
    expect(cacheUpdater.updateAvailableQuantity).toHaveBeenCalledOnce()
    expect(cacheUpdater.updateAvailableQuantity).toHaveBeenCalledWith('prod-1', 10)
  })

  it('does not call cache updater when product upsert fails', async () => {
    productRepo.upsert = async () => { throw new Error('DB error') }
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-10' })
    expect(cacheUpdater.updateProduct).not.toHaveBeenCalled()
  })

  it('does not fail when cacheUpdater.updateProduct throws', async () => {
    cacheUpdater.updateProduct.mockRejectedValue(new Error('Redis down'))
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    const result = await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-11' })
    expect(result.isSuccess()).toBe(true)
  })

  it('does not fail when cacheUpdater.updateAvailableQuantity throws', async () => {
    cacheUpdater.updateAvailableQuantity.mockRejectedValue(new Error('Redis down'))
    const payload = { id: 'sf-1', product_id: 'prod-1', quantity: 10, moved_at: '2026-01-01T00:00:00Z' }
    const result = await useCase.execute({ entity: 'stock_flow', erpId: 'sf-1', payload, correlationId: 'corr-12' })
    expect(result.isSuccess()).toBe(true)
  })

  it('does not call cacheUpdater.updateAvailableQuantity when stockFlowRepo throws', async () => {
    stockFlowRepo.createIfNotExists = async () => { throw new Error('FK constraint violation') }
    const payload = { id: 'sf-1', product_id: 'prod-1', quantity: 10, moved_at: '2026-01-01T00:00:00Z' }
    await useCase.execute({ entity: 'stock_flow', erpId: 'sf-1', payload, correlationId: 'corr-13' })
    expect(cacheUpdater.updateAvailableQuantity).not.toHaveBeenCalled()
  })

  it('outbox is marked PROCESSED even when cacheUpdater.updateProduct throws', async () => {
    await outboxRepo.writeProducts([{ id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updatedAt: new Date() }])
    cacheUpdater.updateProduct.mockRejectedValue(new Error('Redis down'))
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-14' })
    const entry = outboxRepo.entries.find(e => e.entity === 'product' && e.erpId === 'erp-1')
    expect(entry?.status).toBe('PROCESSED')
  })

  it('calls cacheUpdater.updateProduct AFTER outbox markProcessed', async () => {
    const callOrder: string[] = []
    const originalMarkProcessed = outboxRepo.markProcessed.bind(outboxRepo)
    outboxRepo.markProcessed = async (...args: Parameters<typeof outboxRepo.markProcessed>) => {
      callOrder.push('markProcessed')
      return originalMarkProcessed(...args)
    }
    cacheUpdater.updateProduct.mockImplementation(async () => {
      callOrder.push('updateProduct')
    })
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-15' })
    expect(callOrder).toEqual(['markProcessed', 'updateProduct'])
  })
})
