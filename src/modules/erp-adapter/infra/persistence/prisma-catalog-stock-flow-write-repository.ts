import { injectable, inject } from 'tsyringe'
import type { PrismaClient } from '@prisma/client'
import type { ICatalogStockFlowWriteRepository } from '../../repositories/catalog-stock-flow-write-repository'

@injectable()
export class PrismaCatalogStockFlowWriteRepository implements ICatalogStockFlowWriteRepository {
  constructor(@inject('PrismaClient') private readonly prisma: PrismaClient) {}

  async createIfNotExists(data: { id: string; productId: string; quantity: number; movedAt: Date }): Promise<void> {
    await this.prisma.stockFlow.createMany({
      data: [{ id: data.id, productId: data.productId, quantity: data.quantity, movedAt: data.movedAt }],
      skipDuplicates: true,
    })
  }
}
