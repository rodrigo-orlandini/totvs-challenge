export type OutboxStatus = 'PENDING' | 'ENQUEUED' | 'PROCESSED' | 'DEAD'

export interface OutboxEntry {
  id: string
  entity: string
  erpId: string
  payload: Record<string, unknown>
  status: OutboxStatus
  attempts: number
  createdAt: Date
}
