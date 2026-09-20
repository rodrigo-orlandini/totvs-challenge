export type SyncEntity = 'product' | 'stock_flow'

export interface SyncJobPayload {
  entity: SyncEntity
  erpId: string
  payload: Record<string, unknown>
  correlationId: string
}
