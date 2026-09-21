import type { PrismaClient } from '@prisma/client'
import type { ICheckoutOutboxRepository, CheckoutOutboxEntry } from '../../repositories/checkout-outbox-repository'

export class PrismaCheckoutOutboxRepository implements ICheckoutOutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async markEnqueued(id: string): Promise<void> {
    await this.prisma.checkoutOutbox.update({ where: { id }, data: { status: 'ENQUEUED' } })
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.checkoutOutbox.update({ where: { id }, data: { status: 'PROCESSED' } })
  }

  async markDead(id: string, error: string): Promise<void> {
    await this.prisma.checkoutOutbox.update({ where: { id }, data: { status: 'DEAD', error } })
  }

  async findPending(): Promise<CheckoutOutboxEntry[]> {
    const rows = await this.prisma.checkoutOutbox.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })
    return rows.map(r => ({ id: r.id, orderId: r.orderId }))
  }
}
