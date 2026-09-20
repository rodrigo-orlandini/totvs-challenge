import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaOutboxRepository } from './prisma-outbox-repository'
import type { ErpProduct } from '../../dtos/erp-product-dto'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})
const repo = new PrismaOutboxRepository(prisma)

beforeEach(async () => {
  await prisma.outbox.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

const product: ErpProduct = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updatedAt: new Date() }

describe('PrismaOutboxRepository', () => {
  it('writes product to outbox with status PENDING', async () => {
    await repo.writeProducts([product])
    const entry = await prisma.outbox.findFirst({ where: { entity: 'product', erpId: 'erp-1' } })
    expect(entry?.status).toBe('PENDING')
  })

  it('upserts product outbox on conflict (re-opens PENDING)', async () => {
    await repo.writeProducts([product])
    await repo.writeProducts([{ ...product, name: 'Updated Name' }])
    const entries = await prisma.outbox.findMany({ where: { entity: 'product', erpId: 'erp-1' } })
    expect(entries).toHaveLength(1)
    expect((entries[0].payload as { name: string }).name).toBe('Updated Name')
  })

  it('ignores duplicate stock_flow (DO NOTHING)', async () => {
    const sf = { id: 'sf-1', productId: 'p-1', quantity: 10, movedAt: new Date() }
    await repo.writeStockFlows([sf])
    await repo.writeStockFlows([sf])
    const entries = await prisma.outbox.findMany({ where: { entity: 'stock_flow', erpId: 'sf-1' } })
    expect(entries).toHaveLength(1)
  })

  it('transitions status: PENDING → ENQUEUED → PROCESSED', async () => {
    await repo.writeProducts([product])
    const entry = await prisma.outbox.findFirst({ where: { erpId: 'erp-1' } })
    await repo.markEnqueued([entry!.id])
    const enqueued = await prisma.outbox.findFirst({ where: { erpId: 'erp-1' } })
    expect(enqueued?.status).toBe('ENQUEUED')
    await repo.markProcessed('product', 'erp-1')
    const processed = await prisma.outbox.findFirst({ where: { erpId: 'erp-1' } })
    expect(processed?.status).toBe('PROCESSED')
  })

  it('marks entry DEAD with error message', async () => {
    await repo.writeProducts([product])
    await repo.markDead('product', 'erp-1', 'connection timeout', 5)
    const entry = await prisma.outbox.findFirst({ where: { erpId: 'erp-1' } })
    expect(entry?.status).toBe('DEAD')
    expect(entry?.error).toBe('connection timeout')
    expect(entry?.attempts).toBe(5)
  })
})
