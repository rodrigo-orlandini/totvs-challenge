import 'reflect-metadata'
import { injectable, inject } from 'tsyringe'
import { type Either, right } from '@shared/core/either'
import type { IUseCase } from '@shared/core/use-case'
import type { DomainError } from '@shared/errors/domain-error'
import type { ICatalogProductWriteRepository } from '../../repositories/catalog-product-write-repository'
import type { ICatalogStockFlowWriteRepository } from '../../repositories/catalog-stock-flow-write-repository'
import type { IOutboxRepository } from '../../repositories/outbox-repository'
import { logger } from '@shared/observability/logger'
import { tracer } from '@shared/observability/tracer'
import type { SyncEntity } from '../../dtos/sync-job-dto'

export interface ProcessSyncJobInput {
  entity: SyncEntity
  erpId: string
  payload: Record<string, unknown>
  correlationId: string
}

@injectable()
export class ProcessSyncJobUseCase
  implements IUseCase<ProcessSyncJobInput, Either<DomainError, void>>
{
  constructor(
    @inject('ICatalogProductWriteRepository') private readonly productRepo: ICatalogProductWriteRepository,
    @inject('ICatalogStockFlowWriteRepository') private readonly stockFlowRepo: ICatalogStockFlowWriteRepository,
    @inject('IOutboxRepository') private readonly outboxRepository: IOutboxRepository,
  ) {}

  async execute(input: ProcessSyncJobInput): Promise<Either<DomainError, void>> {
    const { entity, erpId, payload, correlationId } = input
    const span = tracer.startSpan(`erp.sync.process`)
    span.setAttribute('entity', entity)
    span.setAttribute('erp_id', erpId)

    try {
      if (entity === 'product') {
        await this.productRepo.upsert({
          id: payload.id as string,
          sku: payload.sku as string,
          name: payload.name as string,
          price: payload.price as number,
          updatedAt: new Date(payload.updated_at as string),
        })
      }

      if (entity === 'stock_flow') {
        await this.stockFlowRepo.createIfNotExists({
          id: payload.id as string,
          productId: payload.product_id as string,
          quantity: payload.quantity as number,
          movedAt: new Date(payload.moved_at as string),
        })
      }

      await this.outboxRepository.markProcessed(entity, erpId)
      logger.info({ correlationId, entity, erpId }, 'erp.sync.processed')
      span.setAttribute('status', 'processed')
      return right(undefined)
    } finally {
      span.end()
    }
  }
}
