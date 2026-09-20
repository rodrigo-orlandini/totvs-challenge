import { container } from 'tsyringe'
import type { IProductRepository } from './repositories/product-repository'
import { PrismaProductRepository } from './infra/persistence/prisma-product-repository'
import { ListProductsUseCase } from './use-cases/list-products/list-products'
import { ProductController } from './infra/http/product-controller'
import { prisma } from '@shared/database/prisma-client'

export function registerCatalogModule(): void {
  container.register('PrismaClient', { useValue: prisma })
  container.register<IProductRepository>('IProductRepository', {
    useValue: new PrismaProductRepository(prisma),
  })
  container.register(ListProductsUseCase, {
    useFactory: () =>
      new ListProductsUseCase(container.resolve<IProductRepository>('IProductRepository')),
  })
  container.register(ProductController, {
    useFactory: () => new ProductController(container.resolve(ListProductsUseCase)),
  })
}
