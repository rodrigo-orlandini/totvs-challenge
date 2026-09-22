import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { randomUUID } from 'node:crypto'
import { CachedProductRepository } from './cached-product-repository'
import { ProductCacheService } from '../../cache/product-cache-service'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

let redis: Redis
let cache: ProductCacheService
let repo: CachedProductRepository

function makeRepo(): CachedProductRepository {
  cache = new ProductCacheService(redis)
  return new CachedProductRepository(cache, prisma)
}

async function seedProducts(count: number): Promise<string[]> {
  const ids = Array.from({ length: count }, () => randomUUID())

  await prisma.product.createMany({
    data: ids.map((id, i) => ({
      id,
      sku: `SKU-${i.toString().padStart(4, '0')}-${id.slice(0, 6)}`,
      name: `Product ${i}`,
      price: 49.9 + i,
      createdAt: new Date(Date.now() - i * 1000),
    })),
  })

  await prisma.stockFlow.createMany({
    data: ids.map(productId => ({
      id: randomUUID(),
      productId,
      quantity: 10,
      movedAt: new Date(),
    })),
  })

  return ids
}

beforeAll(async () => {
  redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380')
  await prisma.$connect()
})

afterAll(async () => {
  await redis.quit()
  await prisma.$disconnect()
})

beforeEach(async () => {
  await redis.flushdb()
  await prisma.stockFlow.deleteMany()
  await prisma.product.deleteMany()
  repo = makeRepo()
})

describe('CachedProductRepository — integração', () => {
  describe('cold start e população do cache', () => {
    it('popula sorted set e chaves de produto no Redis na primeira chamada', async () => {
      await seedProducts(100)

      const result = await repo.findAll({ page: 1, limit: 20 })

      expect(result.total).toBe(100)
      expect(result.products.length).toBe(20)

      const zcard = await redis.zcard('products:sorted')
      expect(zcard).toBe(100)

      const sampleId = result.products[0].id
      const cached = await redis.get(`product:${sampleId}`)
      expect(cached).not.toBeNull()
    })

    it('segunda chamada retorna dados consistentes com a primeira (L1 hit)', async () => {
      await seedProducts(20)

      const first = await repo.findAll({ page: 1, limit: 20 })
      const second = await repo.findAll({ page: 1, limit: 20 })

      expect(second.total).toBe(first.total)
      expect(second.products.map(p => p.id)).toEqual(first.products.map(p => p.id))
    })
  })

  describe('paginação com 100 produtos', () => {
    it('5 páginas de 20 não têm produtos duplicados', async () => {
      await seedProducts(100)

      const pages = await Promise.all(
        [1, 2, 3, 4, 5].map(page => repo.findAll({ page, limit: 20 })),
      )

      const allIds = pages.flatMap(p => p.products.map(prod => prod.id))
      const uniqueIds = new Set(allIds)

      expect(allIds.length).toBe(100)
      expect(uniqueIds.size).toBe(100)

      for (const page of pages) {
        expect(page.total).toBe(100)
        expect(page.products.length).toBe(20)
      }
    })

    it('última página (limit parcial) retorna contagem correta', async () => {
      await seedProducts(25)

      const page1 = await repo.findAll({ page: 1, limit: 20 })
      const page2 = await repo.findAll({ page: 2, limit: 20 })

      expect(page1.products.length).toBe(20)
      expect(page2.products.length).toBe(5)
      expect(page1.total).toBe(25)
      expect(page2.total).toBe(25)
    })
  })

  describe('concorrência', () => {
    it('20 requisições simultâneas retornam dados consistentes', async () => {
      await seedProducts(100)

      const results = await Promise.all(
        Array.from({ length: 20 }, () => repo.findAll({ page: 1, limit: 20 })),
      )

      // Todos retornam o mesmo total
      const totals = new Set(results.map(r => r.total))
      expect(totals.size).toBe(1)
      expect([...totals][0]).toBe(100)

      // Todos retornam 20 produtos
      for (const result of results) {
        expect(result.products.length).toBe(20)
      }

      // Todos retornam os mesmos IDs (ordem consistente)
      const firstIds = results[0].products.map(p => p.id)
      for (const result of results) {
        expect(result.products.map(p => p.id)).toEqual(firstIds)
      }
    })

    it('concurrent findAll não produz sorted set duplicado ou corrompido', async () => {
      await seedProducts(50)

      await Promise.all(Array.from({ length: 10 }, () => repo.findAll({ page: 1, limit: 20 })))

      const zcard = await redis.zcard('products:sorted')
      expect(zcard).toBe(50)
    })
  })

  describe('alta volumetria', () => {
    it('200 produtos: paginação, cache e contagem corretos', async () => {
      await seedProducts(200)
      repo = makeRepo()

      const first = await repo.findAll({ page: 1, limit: 20 })
      expect(first.total).toBe(200)
      expect(first.products.length).toBe(20)

      const allPages = await Promise.all(
        Array.from({ length: 10 }, (_, i) => repo.findAll({ page: i + 1, limit: 20 })),
      )

      const allIds = allPages.flatMap(p => p.products.map(prod => prod.id))
      expect(new Set(allIds).size).toBe(200)

      const zcard = await redis.zcard('products:sorted')
      expect(zcard).toBe(200)
    })
  })
})
