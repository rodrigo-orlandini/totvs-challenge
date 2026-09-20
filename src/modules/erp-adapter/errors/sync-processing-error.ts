import { DomainError } from '@shared/errors/domain-error'

export class SyncProcessingError extends DomainError {
  readonly code = 'SYNC_PROCESSING_ERROR'

  constructor(entity: string, erpId: string, cause: string) {
    super(`Failed to process sync job for ${entity}:${erpId} — ${cause}`)
  }
}
