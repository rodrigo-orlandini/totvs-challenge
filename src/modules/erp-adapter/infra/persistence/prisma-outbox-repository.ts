import { injectable, inject } from 'tsyringe'
import type { PrismaClient } from '@prisma/client'
import type { IOutboxRepository } from '../../repositories/outbox-repository'
import type { ErpProduct } from '../../dtos/erp-product-dto'
import type { ErpStockFlow } from '../../dtos/erp-stock-flow-dto'
import type { OutboxEntry } from '../../entities/outbox-entry'

@injectable()
export class PrismaOutboxRepository implements IOutboxRepository {
  constructor(@inject('PrismaClient') private readonly prisma: PrismaClient) {}

  async writeProducts(products: ErpProduct[]): Promise<void> {
    for (const p of products) {
      await this.prisma.$executeRaw`
        INSERT INTO outbox (id, entity, erp_id, payload, status, created_at)
        VALUES (gen_random_uuid(), 'product', ${p.id}, ${JSON.stringify(p)}::jsonb, 'PENDING', now())
        ON CONFLICT (entity, erp_id)
        DO UPDATE SET payload = EXCLUDED.payload, status = 'PENDING', attempts = 0, error = NULL
        WHERE outbox.status != 'PROCESSED' OR outbox.payload::text != EXCLUDED.payload::text
      `
    }
  }

  async writeStockFlows(stockFlows: ErpStockFlow[]): Promise<void> {
    for (const sf of stockFlows) {
      await this.prisma.$executeRaw`
        INSERT INTO outbox (id, entity, erp_id, payload, status, created_at)
        VALUES (gen_random_uuid(), 'stock_flow', ${sf.id}, ${JSON.stringify(sf)}::jsonb, 'PENDING', now())
        ON CONFLICT (entity, erp_id) DO NOTHING
      `
    }
  }

  async findPending(limit: number): Promise<OutboxEntry[]> {
    const rows = await this.prisma.outbox.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    return rows.map(r => ({
      id: r.id,
      entity: r.entity,
      erpId: r.erpId,
      payload: r.payload as Record<string, unknown>,
      status: r.status as OutboxEntry['status'],
      attempts: r.attempts,
      createdAt: r.createdAt,
    }))
  }

  async markEnqueued(ids: string[]): Promise<void> {
    await this.prisma.outbox.updateMany({ where: { id: { in: ids } }, data: { status: 'ENQUEUED' } })
  }

  async markProcessed(entity: string, erpId: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { entity_erpId: { entity, erpId } },
      data: { status: 'PROCESSED', error: null },
    })
  }

  async markDead(entity: string, erpId: string, error: string, attempts: number): Promise<void> {
    await this.prisma.outbox.update({
      where: { entity_erpId: { entity, erpId } },
      data: { status: 'DEAD', error, attempts },
    })
  }
}
