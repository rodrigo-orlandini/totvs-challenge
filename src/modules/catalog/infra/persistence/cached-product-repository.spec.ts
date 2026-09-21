import 'reflect-metadata'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CachedProductRepository } from './cached-product-repository'
import { ProductCacheService } from '../../cache/product-cache-service'
import type { Redis } from 'ioredis'
import type { ProductResponseItem } from '../../dtos/list-products-dto'

function item(id: string, overrides: Partial<ProductResponseItem> = {}): ProductResponseItem {
  return { id, sku: `SKU-${id}`, name: `Product ${id}`, price: 10, availableQuantity: 5, ...overrides }
}

function makeRedis() {
  const mockPipeline = { zadd: vi.fn().mockReturnThis(), pexpire: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([]) }
  return {
    get: vi.fn<[], Promise<string | null>>().mockResolvedValue(null),
    set: vi.fn<[], Promise<'OK'>>().mockResolvedValue('OK'),
    zadd: vi.fn<[], Promise<number>>().mockResolvedValue(0),
    zrevrange: vi.fn<[], Promise<string[]>>().mockResolvedValue([]),
    zcard: vi.fn<[], Promise<number>>().mockResolvedValue(0),
    pipeline: vi.fn().mockReturnValue(mockPipeline),
  }
}

function makePrisma(
  rows: Array<{ id: string; createdAt: Date }> = [],
  products: Map<string, ProductResponseItem> = new Map(),
) {
  return {
    product: {
      findMany: vi.fn().mockResolvedValue(rows.map((r) => ({ ...r }))),
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        const p = products.get(where.id)
        if (!p) return Promise.resolve(null)
        return Promise.resolve({
          id: p.id,
          sku: p.sku,
          name: p.name,
          price: { toNumber: () => p.price },
          stockFlow: [{ quantity: p.availableQuantity }],
        })
      }),
    },
  }
}

describe('CachedProductRepository', () => {
  let redis: ReturnType<typeof makeRedis>
  let cache: ProductCacheService
  let prisma: ReturnType<typeof makePrisma>
  let repo: CachedProductRepository

  beforeEach(() => {
    redis = makeRedis()
    cache = new ProductCacheService(redis as unknown as Redis)
  })

  describe('cold cache: falls back to DB', () => {
    it('fetches IDs from DB and products individually', async () => {
      const rows = [
        { id: 'p2', createdAt: new Date('2026-01-02') },
        { id: 'p1', createdAt: new Date('2026-01-01') },
      ]
      const products = new Map([['p2', item('p2')], ['p1', item('p1')]])
      prisma = makePrisma(rows, products)
      repo = new CachedProductRepository(cache, prisma as never)

      const result = await repo.findAll({ page: 1, limit: 20 })
      expect(result.products).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: { id: true, createdAt: true },
      })
    })

    it('populates L1 and L2 after DB fetch', async () => {
      const rows = [{ id: 'p1', createdAt: new Date('2026-01-01') }]
      const products = new Map([['p1', item('p1')]])
      prisma = makePrisma(rows, products)
      repo = new CachedProductRepository(cache, prisma as never)

      await repo.findAll({ page: 1, limit: 20 })
      expect(cache.l1.has('p1')).toBe(true)
      expect(redis.set).toHaveBeenCalledWith('product:p1', expect.any(String), 'EX', expect.any(Number))
    })
  })

  describe('warm cache: serves from cache', () => {
    it('uses L1 IDs and L1 products without DB or Redis calls', async () => {
      prisma = makePrisma()
      repo = new CachedProductRepository(cache, prisma as never)
      const data = item('p1')
      cache.setL1Ids(['p1'])
      cache.l1.set('p1', { data, expiresAt: Date.now() + 999999, frequency: 1 })
      redis.zcard.mockResolvedValue(1)

      const result = await repo.findAll({ page: 1, limit: 20 })
      expect(result.products).toEqual([data])
      expect(prisma.product.findMany).not.toHaveBeenCalled()
      expect(redis.get).not.toHaveBeenCalled()
    })

    it('uses L2 IDs and L2 products when L1 is cold', async () => {
      prisma = makePrisma()
      repo = new CachedProductRepository(cache, prisma as never)
      const data = item('p1')
      redis.zrevrange.mockResolvedValue(['p1'])
      redis.zcard.mockResolvedValue(1)
      redis.get.mockImplementation((key: string) =>
        key === 'product:p1' ? Promise.resolve(JSON.stringify(data)) : Promise.resolve(null),
      )

      const result = await repo.findAll({ page: 1, limit: 20 })
      expect(result.products).toEqual([data])
      expect(prisma.product.findMany).not.toHaveBeenCalled()
    })
  })

  describe('pagination', () => {
    it('slices IDs correctly for page 2 with limit 2', async () => {
      prisma = makePrisma()
      repo = new CachedProductRepository(cache, prisma as never)
      const ids = ['p4', 'p3', 'p2', 'p1']
      cache.setL1Ids(ids)
      redis.zcard.mockResolvedValue(4)
      for (const id of ids) {
        cache.l1.set(id, { data: item(id), expiresAt: Date.now() + 999999, frequency: 1 })
      }

      const result = await repo.findAll({ page: 2, limit: 2 })
      expect(result.products.map((p) => p.id)).toEqual(['p2', 'p1'])
      expect(result.total).toBe(4)
    })
  })

  describe('product not found in DB', () => {
    it('filters out missing products', async () => {
      prisma = makePrisma(
        [{ id: 'p1', createdAt: new Date() }, { id: 'p2', createdAt: new Date() }],
        new Map([['p1', item('p1')]]), // p2 missing
      )
      repo = new CachedProductRepository(cache, prisma as never)

      const result = await repo.findAll({ page: 1, limit: 20 })
      expect(result.products).toHaveLength(1)
      expect(result.products[0].id).toBe('p1')
    })
  })

  // === Additional resilience scenarios ===

  describe('L2 IDs hit + some products missing from L2', () => {
    it('falls back to DB findUnique for missing L2 products and populates cache', async () => {
      prisma = makePrisma([], new Map([['p2', item('p2')]]))
      repo = new CachedProductRepository(cache, prisma as never)
      const p1Data = item('p1')

      redis.zrevrange.mockResolvedValue(['p1', 'p2'])
      redis.zcard.mockResolvedValue(2)
      redis.get.mockImplementation((key: string) =>
        key === 'product:p1' ? Promise.resolve(JSON.stringify(p1Data)) : Promise.resolve(null),
      )

      const result = await repo.findAll({ page: 1, limit: 20 })
      expect(result.products).toHaveLength(2)
      expect(result.products.map((p) => p.id)).toContain('p1')
      expect(result.products.map((p) => p.id)).toContain('p2')
      expect(prisma.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p2' } }),
      )
      expect(redis.set).toHaveBeenCalledWith('product:p2', expect.any(String), 'EX', expect.any(Number))
    })
  })

  describe('L2 IDs hit + product not in DB', () => {
    it('filters out missing product, returns empty array, no throw', async () => {
      prisma = makePrisma([], new Map()) // p1 not in DB
      repo = new CachedProductRepository(cache, prisma as never)

      redis.zrevrange.mockResolvedValue(['p1'])
      redis.zcard.mockResolvedValue(1)
      // redis.get returns null (default) — p1 not in L2 either

      const result = await repo.findAll({ page: 1, limit: 20 })
      expect(result.products).toHaveLength(0)
      expect(result.total).toBe(1)
    })
  })

  describe('getRedisIds throws (Redis down)', () => {
    it('falls back to DB when Redis zrevrange is unavailable', async () => {
      const rows = [{ id: 'p1', createdAt: new Date('2026-01-01') }]
      const products = new Map([['p1', item('p1')]])
      prisma = makePrisma(rows, products)
      repo = new CachedProductRepository(cache, prisma as never)

      redis.zrevrange.mockRejectedValue(new Error('Redis connection refused'))

      const result = await repo.findAll({ page: 1, limit: 20 })
      expect(result.products).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(prisma.product.findMany).toHaveBeenCalled()
    })
  })

  describe('DB findUnique throws', () => {
    it('propagates error when DB findUnique throws', async () => {
      const rows = [{ id: 'p1', createdAt: new Date('2026-01-01') }]
      prisma = makePrisma(rows, new Map())
      prisma.product.findUnique.mockRejectedValue(new Error('DB connection failed'))
      repo = new CachedProductRepository(cache, prisma as never)

      await expect(repo.findAll({ page: 1, limit: 20 })).rejects.toThrow('DB connection failed')
    })
  })

  describe('total from L2 when L1 IDs expired', () => {
    it('uses zcard total without calling DB when L2 is warm', async () => {
      const p1Data = item('p1')
      prisma = makePrisma()
      repo = new CachedProductRepository(cache, prisma as never)

      redis.zrevrange.mockResolvedValue(['p1'])
      redis.zcard.mockResolvedValue(5)
      redis.get.mockImplementation((key: string) =>
        key === 'product:p1' ? Promise.resolve(JSON.stringify(p1Data)) : Promise.resolve(null),
      )

      const result = await repo.findAll({ page: 1, limit: 20 })
      expect(result.total).toBe(5)
      expect(prisma.product.findMany).not.toHaveBeenCalled()
    })
  })

  describe('page beyond available IDs', () => {
    it('returns empty products with correct total when offset exceeds ID count', async () => {
      prisma = makePrisma()
      repo = new CachedProductRepository(cache, prisma as never)

      const ids = ['p3', 'p2', 'p1']
      cache.setL1Ids(ids)
      redis.zcard.mockResolvedValue(3)
      for (const id of ids) {
        cache.l1.set(id, { data: item(id), expiresAt: Date.now() + 999999, frequency: 1 })
      }

      const result = await repo.findAll({ page: 2, limit: 3 }) // offset = 3, beyond 3 IDs
      expect(result.products).toHaveLength(0)
      expect(result.total).toBe(3)
      expect(prisma.product.findMany).not.toHaveBeenCalled()
    })
  })

  describe('setRedisIds called with createdAt scores on DB fallback', () => {
    it('populates Redis sorted set with createdAt timestamps as scores', async () => {
      const date1 = new Date('2026-01-02')
      const date2 = new Date('2026-01-01')
      const rows = [
        { id: 'p2', createdAt: date1 },
        { id: 'p1', createdAt: date2 },
      ]
      const products = new Map([['p2', item('p2')], ['p1', item('p1')]])
      prisma = makePrisma(rows, products)
      repo = new CachedProductRepository(cache, prisma as never)

      const setRedisIdsSpy = vi.spyOn(cache, 'setRedisIds')

      await repo.findAll({ page: 1, limit: 20 })

      expect(setRedisIdsSpy).toHaveBeenCalledWith([
        { id: 'p2', score: date1.getTime() },
        { id: 'p1', score: date2.getTime() },
      ])
    })
  })
})
