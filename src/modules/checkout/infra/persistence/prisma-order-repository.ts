import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { IOrderRepository, Order, CreateOrderData } from '../../repositories/order-repository'
import type { OrderStatus } from '../../domain/value-objects/order-status'

export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapOrder(row: {
    id: string; customerId: string; correlationId: string; idempotencyKey: string;
    status: string; attempts: number; lastError: string | null; createdAt: Date; updatedAt: Date;
    items: Array<{ productId: string; quantity: number }>
  }): Order {
    return {
      id: row.id,
      customerId: row.customerId,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey,
      status: row.status as OrderStatus,
      attempts: row.attempts,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      items: row.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
    }
  }

  async findByIdempotencyKey(key: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: { items: true },
    })
    return row ? this.mapOrder(row) : null
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    })
    return row ? this.mapOrder(row) : null
  }

  async createWithReservationsAndOutbox(data: CreateOrderData): Promise<Order> {
    const row = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          id: data.id,
          customerId: data.customerId,
          correlationId: data.correlationId,
          idempotencyKey: data.idempotencyKey,
          items: { createMany: { data: data.items } },
        },
        include: { items: true },
      })

      if (data.reservations.length > 0) {
        await tx.stockReservation.createMany({ data: data.reservations })
      }

      await tx.checkoutOutbox.create({
        data: { id: randomUUID(), orderId: data.id },
      })

      return order
    })

    return this.mapOrder(row)
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    opts?: { attempts?: number; lastError?: string | null },
  ): Promise<void> {
    await this.prisma.order.update({
      where: { id },
      data: {
        status,
        ...(opts?.attempts !== undefined && { attempts: opts.attempts }),
        ...(opts?.lastError !== undefined && { lastError: opts.lastError }),
      },
    })
  }
}
