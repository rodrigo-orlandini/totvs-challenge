import { injectable, inject } from 'tsyringe'
import type { PrismaClient } from '@prisma/client'
import type { IProductRepository, FindAllParams, FindAllResult } from '../../repositories/product-repository'

@injectable()
export class PrismaProductRepository implements IProductRepository {
  constructor(
    @inject('PrismaClient') private readonly prisma: PrismaClient,
  ) {}

  async findAll({ page, limit }: FindAllParams): Promise<FindAllResult> {
    const skip = (page - 1) * limit

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: {
          stockFlow: { select: { quantity: true } },
        },
      }),
      this.prisma.product.count(),
    ])

    return {
      total,
      products: rows.map((row) => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        price: row.price.toNumber(),
        availableQuantity: row.stockFlow.reduce((sum, sf) => sum + sf.quantity, 0),
      })),
    }
  }
}
