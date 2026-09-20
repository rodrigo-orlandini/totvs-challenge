import { injectable, inject } from 'tsyringe'
import type { PrismaClient } from '@prisma/client'
import type { ICatalogProductWriteRepository } from '../../repositories/catalog-product-write-repository'

@injectable()
export class PrismaCatalogProductWriteRepository implements ICatalogProductWriteRepository {
  constructor(@inject('PrismaClient') private readonly prisma: PrismaClient) {}

  async upsert(data: { id: string; sku: string; name: string; price: number; updatedAt: Date }): Promise<void> {
    await this.prisma.product.upsert({
      where: { sku: data.sku },
      update: { name: data.name, price: data.price, updatedAt: data.updatedAt },
      create: { id: data.id, sku: data.sku, name: data.name, price: data.price },
    })
  }
}
