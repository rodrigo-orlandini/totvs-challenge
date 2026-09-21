import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { ICheckoutStockFlowWriter } from '../../repositories/checkout-stock-flow-writer'

export class PrismaCheckoutStockFlowWriter implements ICheckoutStockFlowWriter {
  constructor(private readonly prisma: PrismaClient) {}

  async createSaleFlow(productId: string, quantity: number): Promise<void> {
    await this.prisma.stockFlow.create({
      data: { id: randomUUID(), productId, quantity: -quantity },
    })
  }
}
