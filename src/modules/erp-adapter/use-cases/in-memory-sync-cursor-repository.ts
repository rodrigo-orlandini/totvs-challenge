import type { ISyncCursorRepository } from '../repositories/sync-cursor-repository'

export class InMemorySyncCursorRepository implements ISyncCursorRepository {
  cursors: Map<string, Date> = new Map()

  async findByEntity(entity: string): Promise<Date | null> {
    return this.cursors.get(entity) ?? null
  }

  async upsert(entity: string, lastSyncedAt: Date): Promise<void> {
    this.cursors.set(entity, lastSyncedAt)
  }
}
