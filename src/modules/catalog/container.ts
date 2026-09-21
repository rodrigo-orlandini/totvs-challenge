import { container } from 'tsyringe'
import type { IProductRepository } from './repositories/product-repository'
import type { IProductCacheUpdater } from '@modules/erp-adapter/repositories/product-cache-updater'
import { CachedProductRepository } from './infra/persistence/cached-product-repository'
import { ProductCacheService } from './cache/product-cache-service'
import { CacheRefreshScheduler } from './cache/cache-refresh-scheduler'
import { ListProductsUseCase } from './use-cases/list-products/list-products'
import { ProductController } from './infra/http/product-controller'
import { prisma } from '@shared/database/prisma-client'
import type { Redis } from 'ioredis'

export function registerCatalogModule(redis: Redis): void {
  const cacheService = new ProductCacheService(redis)

  container.register<IProductCacheUpdater>('IProductCacheUpdater', {
    useValue: cacheService,
  })

  container.register<IProductRepository>('IProductRepository', {
    useValue: new CachedProductRepository(cacheService, prisma),
  })

  container.register(ListProductsUseCase, {
    useFactory: () =>
      new ListProductsUseCase(container.resolve<IProductRepository>('IProductRepository')),
  })

  container.register(ProductController, {
    useFactory: () => new ProductController(container.resolve(ListProductsUseCase)),
  })

  container.register(CacheRefreshScheduler, {
    useValue: new CacheRefreshScheduler(cacheService, prisma),
  })
}
