import { injectable, inject } from 'tsyringe'
import type { PrismaClient } from '@prisma/client'
import type { IErpProductRepository } from '../../repositories/erp-product-repository'
import type { ErpProduct } from '../../dtos/erp-product-dto'

@injectable()
export class PrismaErpProductRepository implements IErpProductRepository {
  constructor(@inject('ErpPrismaClient') private readonly erpPrisma: PrismaClient) {}

  async findSince(since: Date): Promise<ErpProduct[]> {
    const rows = await this.erpPrisma.product.findMany({
      where: { updatedAt: { gt: since } },
      orderBy: { updatedAt: 'asc' },
    })
    return rows.map(r => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      price: r.price.toNumber(),
      updatedAt: r.updatedAt,
    }))
  }
}
