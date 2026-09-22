import 'reflect-metadata'
import { injectable, inject } from 'tsyringe'
import { type Either, right, left } from '@shared/core/either'
import type { IUseCase } from '@shared/core/use-case'
import type { DomainError } from '@shared/errors/domain-error'
import type { ICatalogProductWriteRepository } from '../../repositories/catalog-product-write-repository'
import type { ICatalogStockFlowWriteRepository } from '../../repositories/catalog-stock-flow-write-repository'
import type { IOutboxRepository } from '../../repositories/outbox-repository'
import type { IProductCacheUpdater } from '../../repositories/product-cache-updater'
import { logger } from '@shared/observability/logger'
import { tracer } from '@shared/observability/tracer'
import type { SyncEntity } from '../../dtos/sync-job-dto'
import { SyncProcessingError } from '../../errors/sync-processing-error'

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
    @inject('IProductCacheUpdater') private readonly cacheUpdater: IProductCacheUpdater,
  ) {}

  async execute(input: ProcessSyncJobInput): Promise<Either<DomainError, void>> {
    const { entity, erpId, payload, correlationId } = input
    const span = tracer.startSpan(`erp.sync.process`)
    span.setAttribute('entity', entity)
    span.setAttribute('erp_id', erpId)

    let syncResult!: Either<DomainError, void>

    try {
      if (entity === 'product') {
        await this.productRepo.upsert({
          id: payload.id as string,
          sku: payload.sku as string,
          name: payload.name as string,
          price: payload.price as number,
          updatedAt: new Date((payload.updatedAt ?? payload.updated_at) as string),
        })
      }

      if (entity === 'stock_flow') {
        await this.stockFlowRepo.createIfNotExists({
          id: payload.id as string,
          productId: (payload.productId ?? payload.product_id) as string,
          quantity: payload.quantity as number,
          movedAt: new Date((payload.movedAt ?? payload.moved_at) as string),
        })
      }

      await this.outboxRepository.markProcessed(entity, erpId)
      logger.info({ correlationId, entity, erpId }, 'erp.sync.processed')
      span.setAttribute('status', 'processed')
      syncResult = right(undefined)
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err)
      logger.error({ correlationId, entity, erpId, cause }, 'erp.sync.process.error')
      span.setAttribute('status', 'error')
      syncResult = left(new SyncProcessingError(entity, erpId, cause))
    } finally {
      span.end()
    }

    if (syncResult.isSuccess()) {
      if (entity === 'product') {
        try {
          await this.cacheUpdater.updateProduct(payload.id as string, {
            sku: payload.sku as string,
            name: payload.name as string,
            price: payload.price as number,
            createdAt: new Date((payload.createdAt ?? payload.created_at ?? payload.updatedAt ?? payload.updated_at) as string),
            updatedAt: new Date((payload.updatedAt ?? payload.updated_at) as string),
          })
        } catch (cacheErr) {
          logger.warn({ correlationId, entity, erpId, err: cacheErr }, 'erp.sync.cache.update.warn')
        }
      }

      if (entity === 'stock_flow') {
        try {
          await this.cacheUpdater.updateAvailableQuantity(
            (payload.productId ?? payload.product_id) as string,
            payload.quantity as number,
          )
        } catch (cacheErr) {
          logger.warn({ correlationId, entity, erpId, err: cacheErr }, 'erp.sync.cache.update.warn')
        }
      }
    }

    return syncResult
  }
}
