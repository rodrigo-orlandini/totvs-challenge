export interface ISyncCursorRepository {
  findByEntity(entity: string): Promise<Date | null>
  upsert(entity: string, lastSyncedAt: Date): Promise<void>
}
