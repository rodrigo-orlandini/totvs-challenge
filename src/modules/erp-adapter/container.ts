import 'reflect-metadata'
import { container } from 'tsyringe'
import { prisma } from '@shared/database/prisma-client'
import { erpPrisma } from '@shared/database/erp-prisma-client'
import { PrismaOutboxRepository } from './infra/persistence/prisma-outbox-repository'
import { PrismaSyncCursorRepository } from './infra/persistence/prisma-sync-cursor-repository'
import { PrismaErpProductRepository } from './infra/persistence/prisma-erp-product-repository'
import { PrismaErpStockFlowRepository } from './infra/persistence/prisma-erp-stock-flow-repository'
import { PrismaCatalogProductWriteRepository } from './infra/persistence/prisma-catalog-product-write-repository'
import { PrismaCatalogStockFlowWriteRepository } from './infra/persistence/prisma-catalog-stock-flow-write-repository'
import { PollErpProductsUseCase } from './use-cases/poll-erp-products/poll-erp-products'
import { PollErpStockFlowsUseCase } from './use-cases/poll-erp-stock-flows/poll-erp-stock-flows'
import { ProcessSyncJobUseCase } from './use-cases/process-sync-job/process-sync-job'
import { BullMQRelay } from './infra/queue/bullmq-relay'
import { BullMQSyncWorker } from './infra/queue/bullmq-sync-worker'
import { ErpScheduler } from './infra/scheduler/erp-scheduler'
import type { IOutboxRepository } from './repositories/outbox-repository'
import type { ISyncCursorRepository } from './repositories/sync-cursor-repository'
import type { IErpProductRepository } from './repositories/erp-product-repository'
import type { IErpStockFlowRepository } from './repositories/erp-stock-flow-repository'
import type { ICatalogProductWriteRepository } from './repositories/catalog-product-write-repository'
import type { ICatalogStockFlowWriteRepository } from './repositories/catalog-stock-flow-write-repository'
import type { IProductCacheUpdater } from './repositories/product-cache-updater'
import type { Redis } from 'ioredis'

export function registerErpAdapterModule(redis: Redis): void {

  container.register<IOutboxRepository>('IOutboxRepository', {
    useValue: new PrismaOutboxRepository(prisma),
  })
  container.register<ISyncCursorRepository>('ISyncCursorRepository', {
    useValue: new PrismaSyncCursorRepository(prisma),
  })
  container.register<IErpProductRepository>('IErpProductRepository', {
    useValue: new PrismaErpProductRepository(erpPrisma),
  })
  container.register<IErpStockFlowRepository>('IErpStockFlowRepository', {
    useValue: new PrismaErpStockFlowRepository(erpPrisma),
  })
  container.register<ICatalogProductWriteRepository>('ICatalogProductWriteRepository', {
    useValue: new PrismaCatalogProductWriteRepository(prisma),
  })
  container.register<ICatalogStockFlowWriteRepository>('ICatalogStockFlowWriteRepository', {
    useValue: new PrismaCatalogStockFlowWriteRepository(prisma),
  })

  container.register(PollErpProductsUseCase, {
    useFactory: () => new PollErpProductsUseCase(
      container.resolve<IErpProductRepository>('IErpProductRepository'),
      container.resolve<IOutboxRepository>('IOutboxRepository'),
      container.resolve<ISyncCursorRepository>('ISyncCursorRepository'),
    ),
  })
  container.register(PollErpStockFlowsUseCase, {
    useFactory: () => new PollErpStockFlowsUseCase(
      container.resolve<IErpStockFlowRepository>('IErpStockFlowRepository'),
      container.resolve<IOutboxRepository>('IOutboxRepository'),
      container.resolve<ISyncCursorRepository>('ISyncCursorRepository'),
    ),
  })
  container.register(ProcessSyncJobUseCase, {
    useFactory: () => new ProcessSyncJobUseCase(
      container.resolve<ICatalogProductWriteRepository>('ICatalogProductWriteRepository'),
      container.resolve<ICatalogStockFlowWriteRepository>('ICatalogStockFlowWriteRepository'),
      container.resolve<IOutboxRepository>('IOutboxRepository'),
      container.resolve<IProductCacheUpdater>('IProductCacheUpdater'),
    ),
  })

  container.register(BullMQRelay, {
    useFactory: () => new BullMQRelay(
      container.resolve<IOutboxRepository>('IOutboxRepository'),
      redis,
    ),
  })
  container.register(BullMQSyncWorker, {
    useFactory: () => new BullMQSyncWorker(
      container.resolve(ProcessSyncJobUseCase),
      container.resolve<IOutboxRepository>('IOutboxRepository'),
      redis,
    ),
  })
  container.register(ErpScheduler, {
    useFactory: () => new ErpScheduler(),
  })
}
