import 'reflect-metadata'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { CreateCheckoutUseCase } from './create-checkout'
import { PrismaOrderRepository } from '../../infra/persistence/prisma-order-repository'
import { PrismaStockReservationRepository } from '../../infra/persistence/prisma-stock-reservation-repository'
import { PrismaCheckoutOutboxRepository } from '../../infra/persistence/prisma-checkout-outbox-repository'
import { PrismaProductStockChecker } from '../../infra/persistence/prisma-product-stock-checker'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

function makeUseCase(): CreateCheckoutUseCase {
  return new CreateCheckoutUseCase(
    new PrismaOrderRepository(prisma),
    new PrismaStockReservationRepository(prisma),
    new PrismaCheckoutOutboxRepository(prisma),
    new PrismaProductStockChecker(prisma),
  )
}

async function seedProduct(quantity: number): Promise<string> {
  const id = randomUUID()
  await prisma.product.create({
    data: {
      id,
      sku: `SKU-${id.slice(0, 8)}`,
      name: `Product ${id.slice(0, 8)}`,
      price: 99.9,
      stockFlow: {
        create: [{ id: randomUUID(), quantity, movedAt: new Date() }],
      },
    },
  })
  return id
}

beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  await prisma.checkoutOutbox.deleteMany()
  await prisma.stockReservation.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.stockFlow.deleteMany()
  await prisma.product.deleteMany()
})

describe('CreateCheckoutUseCase — integração', () => {
  describe('race condition (stock=1, N requisições simultâneas)', () => {
    it('permite no máximo 1 reserva ativa quando estoque=1 e 20 requisições simultâneas', async () => {
      // Sem lock no nível do DB (SELECT FOR UPDATE ou advisory lock), múltiplas
      // requisições podem passar pelo stock check simultaneamente e criar reservas
      // sobrepostas. Este teste documenta o comportamento correto esperado.
      // Se falhar com activeReservations > 1, há race condition de overselling.
      const productId = await seedProduct(1)
      const useCase = makeUseCase()

      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          useCase.execute({
            customerId: 'customer-race',
            idempotencyKey: randomUUID(),
            items: [{ productId, quantity: 1 }],
          }),
        ),
      )

      const successes = results.filter(r => r.isSuccess())

      const activeReservations = await prisma.stockReservation.aggregate({
        _sum: { quantity: true },
        where: { productId, releasedAt: null, expiresAt: { gt: new Date() } },
      })
      const totalReserved = activeReservations._sum.quantity ?? 0

      // Invariante: reservas ativas nunca devem exceder o estoque disponível
      expect(totalReserved).toBeLessThanOrEqual(1)
      expect(successes.length).toBe(1)
    })
  })

  describe('idempotência sob carga', () => {
    it('cria 1 pedido quando 50 requisições paralelas usam a mesma idempotency-key', async () => {
      const productId = await seedProduct(100)
      const useCase = makeUseCase()
      const idempotencyKey = randomUUID()
      const body = { customerId: 'customer-idem', idempotencyKey, items: [{ productId, quantity: 1 }] }

      const results = await Promise.all(Array.from({ length: 50 }, () => useCase.execute(body)))

      const successes = results.filter(r => r.isSuccess())
      expect(successes.length).toBe(50)

      const orderIds = new Set(successes.map(r => (r.isSuccess() ? r.value.orderId : '')))
      expect(orderIds.size).toBe(1)

      const orderCount = await prisma.order.count({ where: { idempotencyKey } })
      expect(orderCount).toBe(1)
    })
  })

  describe('volume', () => {
    it('processa 50 checkouts únicos simultâneos sem falhas quando há estoque suficiente', async () => {
      const N = 50
      const productIds = await Promise.all(Array.from({ length: N }, () => seedProduct(10)))
      const useCase = makeUseCase()

      const results = await Promise.all(
        productIds.map(productId =>
          useCase.execute({
            customerId: 'customer-vol',
            idempotencyKey: randomUUID(),
            items: [{ productId, quantity: 1 }],
          }),
        ),
      )

      const failures = results.filter(r => r.isFailure())
      expect(failures.length).toBe(0)
      expect(results.filter(r => r.isSuccess()).length).toBe(N)

      const orderCount = await prisma.order.count()
      expect(orderCount).toBe(N)
    })

    it('mantém integridade com 10 reservas simultâneas no mesmo produto com estoque=10', async () => {
      const productId = await seedProduct(10)
      const useCase = makeUseCase()

      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          useCase.execute({
            customerId: 'customer-stock10',
            idempotencyKey: randomUUID(),
            items: [{ productId, quantity: 1 }],
          }),
        ),
      )

      const successes = results.filter(r => r.isSuccess())
      const activeReservations = await prisma.stockReservation.aggregate({
        _sum: { quantity: true },
        where: { productId, releasedAt: null, expiresAt: { gt: new Date() } },
      })

      expect(activeReservations._sum.quantity ?? 0).toBeLessThanOrEqual(10)
      expect(successes.length).toBeLessThanOrEqual(10)
    })
  })
})
