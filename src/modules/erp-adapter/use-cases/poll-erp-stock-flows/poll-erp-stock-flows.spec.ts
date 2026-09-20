import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { PollErpStockFlowsUseCase } from './poll-erp-stock-flows'
import { InMemoryErpStockFlowRepository } from './in-memory-erp-stock-flow-repository'
import { InMemoryOutboxRepository } from '../in-memory-outbox-repository'
import { InMemorySyncCursorRepository } from '../in-memory-sync-cursor-repository'
import type { ErpStockFlow } from '../../dtos/erp-stock-flow-dto'

function makeErpStockFlow(overrides: Partial<ErpStockFlow> = {}): ErpStockFlow {
  return {
    id: 'sf-erp-1',
    productId: 'prod-erp-1',
    quantity: 50,
    movedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

describe('PollErpStockFlowsUseCase', () => {
  let erpRepo: InMemoryErpStockFlowRepository
  let outboxRepo: InMemoryOutboxRepository
  let cursorRepo: InMemorySyncCursorRepository
  let useCase: PollErpStockFlowsUseCase

  beforeEach(() => {
    erpRepo = new InMemoryErpStockFlowRepository()
    outboxRepo = new InMemoryOutboxRepository()
    cursorRepo = new InMemorySyncCursorRepository()
    useCase = new PollErpStockFlowsUseCase(erpRepo, outboxRepo, cursorRepo)
  })

  it('returns detected=0 when no stock flows found since cursor', async () => {
    cursorRepo.cursors.set('stock_flow', new Date('2026-01-02T00:00:00Z'))
    erpRepo.stockFlows = [makeErpStockFlow({ movedAt: new Date('2026-01-01T00:00:00Z') })]
    const result = await useCase.execute({})
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.detected).toBe(0)
  })

  it('writes detected stock flows to outbox and advances cursor', async () => {
    const t1 = new Date('2026-01-01T00:00:00Z')
    const t2 = new Date('2026-01-02T00:00:00Z')
    erpRepo.stockFlows = [
      makeErpStockFlow({ id: 'sf-1', movedAt: t1 }),
      makeErpStockFlow({ id: 'sf-2', movedAt: t2 }),
    ]
    const result = await useCase.execute({})
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.detected).toBe(2)
    expect(outboxRepo.entries).toHaveLength(2)
    expect(outboxRepo.entries[0].entity).toBe('stock_flow')
    expect(cursorRepo.cursors.get('stock_flow')).toEqual(t2)
  })

  it('does NOT re-add duplicate stock flow (append-only idempotency)', async () => {
    const sf = makeErpStockFlow({ id: 'sf-1', movedAt: new Date('2026-01-01T00:00:00Z') })
    erpRepo.stockFlows = [sf]
    await useCase.execute({})
    cursorRepo.cursors.set('stock_flow', new Date('2025-12-31T00:00:00Z'))
    erpRepo.stockFlows = [sf] // same entry reappears (e.g. cursor regression)
    await useCase.execute({})
    expect(outboxRepo.entries).toHaveLength(1) // still only one
  })
})
