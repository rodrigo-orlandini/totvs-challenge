import { injectable, inject } from 'tsyringe'
import type { PrismaClient } from '@prisma/client'
import type { ISyncCursorRepository } from '../../repositories/sync-cursor-repository'

@injectable()
export class PrismaSyncCursorRepository implements ISyncCursorRepository {
  constructor(@inject('PrismaClient') private readonly prisma: PrismaClient) {}

  async findByEntity(entity: string): Promise<Date | null> {
    const cursor = await this.prisma.syncCursor.findUnique({ where: { entity } })
    return cursor?.lastSyncedAt ?? null
  }

  async upsert(entity: string, lastSyncedAt: Date): Promise<void> {
    await this.prisma.syncCursor.upsert({
      where: { entity },
      update: { lastSyncedAt },
      create: { entity, lastSyncedAt },
    })
  }
}
