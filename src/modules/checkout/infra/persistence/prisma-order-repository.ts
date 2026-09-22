import { randomUUID } from 'node:crypto'
import { PrismaClient, Prisma } from '@prisma/client'
import type { IOrderRepository, Order, CreateOrderData } from '../../repositories/order-repository'
import type { OrderStatus } from '../../domain/value-objects/order-status'
import { InsufficientStockError } from '../../errors/insufficient-stock-error'

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
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const uniqueProductIds = [...new Set(data.reservations.map(r => r.productId))]

        for (const productId of uniqueProductIds) {
          // Serialize concurrent stock checks per product at the DB level.
          // pg_advisory_xact_lock releases automatically when the transaction ends.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${productId})::bigint)`

          const stockTotal = await tx.stockFlow.aggregate({
            _sum: { quantity: true },
            where: { productId },
          })
          const activeReserved = await tx.stockReservation.aggregate({
            _sum: { quantity: true },
            where: { productId, releasedAt: null, expiresAt: { gt: new Date() } },
          })

          const available = Math.max(0, stockTotal._sum.quantity ?? 0) - (activeReserved._sum.quantity ?? 0)
          const needed = data.reservations
            .filter(r => r.productId === productId)
            .reduce((sum, r) => sum + r.quantity, 0)

          if (available < needed) {
            throw new InsufficientStockError(productId, needed, available)
          }
        }

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
          await tx.stockReservation.createMany({
            data: data.reservations.map(r => ({ ...r, orderId: data.id })),
          })
        }

        await tx.checkoutOutbox.create({
          data: { id: randomUUID(), orderId: data.id },
        })

        return order
      })

      return this.mapOrder(row)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta as { target?: string[] } | undefined)?.target ?? []
        if (target.includes('idempotency_key')) {
          const existing = await this.findByIdempotencyKey(data.idempotencyKey)
          if (existing) return existing
        }
      }
      throw err
    }
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
