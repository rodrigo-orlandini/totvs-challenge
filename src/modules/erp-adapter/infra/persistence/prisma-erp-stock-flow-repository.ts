import { injectable, inject } from 'tsyringe'
import type { PrismaClient } from '@prisma/client'
import type { IErpStockFlowRepository } from '../../repositories/erp-stock-flow-repository'
import type { ErpStockFlow } from '../../dtos/erp-stock-flow-dto'

@injectable()
export class PrismaErpStockFlowRepository implements IErpStockFlowRepository {
  constructor(@inject('ErpPrismaClient') private readonly erpPrisma: PrismaClient) {}

  async findSince(since: Date): Promise<ErpStockFlow[]> {
    const rows = await this.erpPrisma.stockFlow.findMany({
      where: { movedAt: { gt: since } },
      orderBy: { movedAt: 'asc' },
    })
    return rows.map(r => ({
      id: r.id,
      productId: r.productId,
      quantity: r.quantity,
      movedAt: r.movedAt,
    }))
  }
}
