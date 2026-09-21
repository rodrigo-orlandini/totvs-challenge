import type { PrismaClient } from '@prisma/client'
import type { IStockReservationRepository } from '../../repositories/stock-reservation-repository'

export class PrismaStockReservationRepository implements IStockReservationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getActiveQuantity(productId: string): Promise<number> {
    const result = await this.prisma.stockReservation.aggregate({
      _sum: { quantity: true },
      where: {
        productId,
        expiresAt: { gt: new Date() },
        releasedAt: null,
      },
    })
    return result._sum.quantity ?? 0
  }

  async releaseByOrderId(orderId: string): Promise<void> {
    await this.prisma.stockReservation.updateMany({
      where: { orderId, releasedAt: null },
      data: { releasedAt: new Date() },
    })
  }
}
