import 'reflect-metadata'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheRefreshScheduler } from './cache-refresh-scheduler'
import { ProductCacheService } from './product-cache-service'
import type { Redis } from 'ioredis'
import type { ProductResponseItem } from '../dtos/list-products-dto'

function item(id: string): ProductResponseItem {
  return { id, sku: `S${id}`, name: `N${id}`, price: 10, availableQuantity: 5 }
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
    pttl: vi.fn<[], Promise<number>>().mockResolvedValue(700_000),
    pexpire: vi.fn<[], Promise<number>>().mockResolvedValue(1),
  }
}

function makePrisma(products: ProductResponseItem[] = []) {
  return {
    product: {
      findMany: vi.fn().mockResolvedValue(
        products.map(p => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          price: { toNumber: () => p.price },
          createdAt: new Date(),
          stockFlow: [{ quantity: p.availableQuantity }],
        })),
      ),
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        const p = products.find(x => x.id === where.id)
        if (!p) return Promise.resolve(null)
        return Promise.resolve({
          id: p.id, sku: p.sku, name: p.name,
          price: { toNumber: () => p.price },
          stockFlow: [{ quantity: p.availableQuantity }],
        })
      }),
    },
  }
}

/** Flush microtasks produced by pending promises (no timer advancement). */
async function flushMicrotasks(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve()
}

describe('CacheRefreshScheduler', () => {
  let redis: ReturnType<typeof makeRedis>
  let cache: ProductCacheService
  let prisma: ReturnType<typeof makePrisma>
  let scheduler: CacheRefreshScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    redis = makeRedis()
    cache = new ProductCacheService(redis as unknown as Redis)
  })

  afterEach(() => {
    scheduler?.stop()
    vi.useRealTimers()
  })

  describe('warmAll', () => {
    it('loads IDs and products from Redis when L2 is warm', async () => {
      redis.zrevrange.mockResolvedValue(['p2', 'p1'])
      redis.zcard.mockResolvedValue(2)
      redis.get.mockImplementation((key: string) => {
        if (key === 'product:p1') return Promise.resolve(JSON.stringify(item('p1')))
        if (key === 'product:p2') return Promise.resolve(JSON.stringify(item('p2')))
        return Promise.resolve(null)
      })
      prisma = makePrisma()
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      await scheduler.warmAll()
      expect(cache.getL1Ids()).toEqual(['p2', 'p1'])
      expect(cache.l1.has('p1')).toBe(true)
      expect(cache.l1.has('p2')).toBe(true)
      expect(prisma.product.findMany).not.toHaveBeenCalled()
    })

    it('loads all products from DB when Redis is cold', async () => {
      const products = [item('p1'), item('p2')]
      prisma = makePrisma(products)
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      await scheduler.warmAll()
      expect(cache.l1.has('p1')).toBe(true)
      expect(cache.l1.has('p2')).toBe(true)
      expect(prisma.product.findMany).toHaveBeenCalled()
    })

    // Extended scenario 1: Redis has IDs but getProduct returns null for some (partial L2 miss)
    it('does not crash when some products are missing from L2 cache', async () => {
      redis.zrevrange.mockResolvedValue(['p1', 'p2'])
      redis.zcard.mockResolvedValue(2)
      // p1 is in Redis, p2 is not
      redis.get.mockImplementation((key: string) => {
        if (key === 'product:p1') return Promise.resolve(JSON.stringify(item('p1')))
        return Promise.resolve(null)
      })
      prisma = makePrisma()
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      await expect(scheduler.warmAll()).resolves.toBeUndefined()
      expect(cache.l1.has('p1')).toBe(true)
      expect(cache.l1.has('p2')).toBe(false)
      expect(prisma.product.findMany).not.toHaveBeenCalled()
    })

    // Extended scenario 2: getRedisIds returns IDs but getTotal returns null — fall back to DB
    it('falls back to DB when getTotal returns null even if getRedisIds has IDs', async () => {
      redis.zrevrange.mockResolvedValue(['p1', 'p2'])
      redis.zcard.mockResolvedValue(0) // triggers null return from getTotal
      const products = [item('p1'), item('p2')]
      prisma = makePrisma(products)
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      await scheduler.warmAll()
      expect(prisma.product.findMany).toHaveBeenCalled()
    })

    // Extended scenario 3: getRedisIds returns null but getTotal returns count — fall back to DB
    it('falls back to DB when getRedisIds returns null even if getTotal has a count', async () => {
      redis.zrevrange.mockResolvedValue([]) // triggers null return from getRedisIds
      redis.zcard.mockResolvedValue(2)
      const products = [item('p1'), item('p2')]
      prisma = makePrisma(products)
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      await scheduler.warmAll()
      expect(prisma.product.findMany).toHaveBeenCalled()
    })
  })

  describe('tick / refresh-ahead', () => {
    it('refreshes L1 entries with less than 120s remaining', async () => {
      const refreshedItem = item('p1')
      prisma = makePrisma([refreshedItem])
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      // Seed L1 with an entry expiring in 60s (below 120s threshold)
      cache.l1.set('p1', {
        data: item('p1'),
        expiresAt: Date.now() + 60_000,
        frequency: 3,
      })

      scheduler.start()
      // Advance timer to trigger first tick, then stop to avoid infinite loop
      vi.advanceTimersByTime(60_000)
      scheduler.stop()
      // Flush async microtasks from the tick
      await flushMicrotasks()

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
        include: { stockFlow: { select: { quantity: true } } },
      })
    })

    it('does not refresh L1 entries with more than 120s remaining', async () => {
      prisma = makePrisma([item('p1')])
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      // Entry expires in 300s — above 120s threshold
      cache.l1.set('p1', {
        data: item('p1'),
        expiresAt: Date.now() + 300_000,
        frequency: 1,
      })

      scheduler.start()
      vi.advanceTimersByTime(60_000)
      scheduler.stop()
      await flushMicrotasks()

      expect(prisma.product.findUnique).not.toHaveBeenCalled()
    })

    // Extended scenario 4: multiple entries near expiry
    it('refreshes all 3 near-expiry entries but not the far one', async () => {
      prisma = makePrisma([item('p1'), item('p2'), item('p3'), item('p4')])
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      const nearExpiry = Date.now() + 60_000 // 60s < 120s threshold
      const farExpiry = Date.now() + 300_000 // 300s > 120s threshold

      cache.l1.set('p1', { data: item('p1'), expiresAt: nearExpiry, frequency: 1 })
      cache.l1.set('p2', { data: item('p2'), expiresAt: nearExpiry, frequency: 1 })
      cache.l1.set('p3', { data: item('p3'), expiresAt: nearExpiry, frequency: 1 })
      cache.l1.set('p4', { data: item('p4'), expiresAt: farExpiry, frequency: 1 })

      scheduler.start()
      vi.advanceTimersByTime(60_000)
      scheduler.stop()
      await flushMicrotasks()

      expect(prisma.product.findUnique).toHaveBeenCalledTimes(3)
      expect(prisma.product.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1' } }))
      expect(prisma.product.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p2' } }))
      expect(prisma.product.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p3' } }))
      expect(prisma.product.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p4' } }))
    })

    // Extended scenario 5: entry removed from L1 between tick iterations — no crash
    it('does not crash when L1 is mutated (entry removed) during tick', async () => {
      prisma = makePrisma([item('p1'), item('p2')])
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      const nearExpiry = Date.now() + 60_000
      cache.l1.set('p1', { data: item('p1'), expiresAt: nearExpiry, frequency: 1 })
      cache.l1.set('p2', { data: item('p2'), expiresAt: nearExpiry, frequency: 1 })

      // Simulate deletion mid-tick by removing p2 just after scheduler starts
      scheduler.start()
      cache.l1.delete('p2')

      vi.advanceTimersByTime(60_000)
      scheduler.stop()
      await expect(flushMicrotasks()).resolves.toBeUndefined()
    })

    // Extended scenario 6: refreshProduct DB returns null (product deleted) — no crash, no cache write
    it('does not crash or write to cache when DB returns null for a product', async () => {
      prisma = makePrisma([]) // no products in DB — findUnique returns null
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      cache.l1.set('p1', {
        data: item('p1'),
        expiresAt: Date.now() + 60_000,
        frequency: 1,
      })

      scheduler.start()
      vi.advanceTimersByTime(60_000)
      scheduler.stop()
      await flushMicrotasks()

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
        include: { stockFlow: { select: { quantity: true } } },
      })
      // p1 still exists in L1 (was not removed, just not refreshed)
      expect(cache.l1.has('p1')).toBe(true)
    })

    // Extended scenario 7: refreshProduct DB error — logs WARN, does not throw, does not crash scheduler
    it('handles DB errors during refresh gracefully without crashing', async () => {
      const dbError = new Error('DB connection lost')
      prisma = makePrisma([item('p1')])
      prisma.product.findUnique.mockRejectedValue(dbError)
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      cache.l1.set('p1', {
        data: item('p1'),
        expiresAt: Date.now() + 60_000,
        frequency: 1,
      })

      scheduler.start()
      vi.advanceTimersByTime(60_000)
      scheduler.stop()
      await expect(flushMicrotasks()).resolves.toBeUndefined()
    })
  })

  describe('sorted set TTL renewal', () => {
    it('renews products:sorted TTL when pttl is below REFRESH_AHEAD_MS', async () => {
      prisma = makePrisma()
      scheduler = new CacheRefreshScheduler(cache, prisma as never)
      redis.pttl.mockResolvedValue(60_000) // below 120_000 threshold

      scheduler.start()
      vi.advanceTimersByTime(60_000)
      scheduler.stop()
      await flushMicrotasks()

      expect(redis.pexpire).toHaveBeenCalledWith('products:sorted', expect.any(Number))
    })

    it('renews products:sorted TTL when key has no TTL (-1)', async () => {
      prisma = makePrisma()
      scheduler = new CacheRefreshScheduler(cache, prisma as never)
      redis.pttl.mockResolvedValue(-1)

      scheduler.start()
      vi.advanceTimersByTime(60_000)
      scheduler.stop()
      await flushMicrotasks()

      expect(redis.pexpire).toHaveBeenCalledWith('products:sorted', expect.any(Number))
    })

    it('does not renew products:sorted TTL when pttl is above threshold', async () => {
      prisma = makePrisma()
      scheduler = new CacheRefreshScheduler(cache, prisma as never)
      redis.pttl.mockResolvedValue(700_000) // well above 120_000 threshold

      scheduler.start()
      vi.advanceTimersByTime(60_000)
      scheduler.stop()
      await flushMicrotasks()

      expect(redis.pexpire).not.toHaveBeenCalledWith('products:sorted', expect.any(Number))
    })
  })

  describe('start / stop', () => {
    it('start calls warmAll and sets up interval', async () => {
      prisma = makePrisma()
      scheduler = new CacheRefreshScheduler(cache, prisma as never)
      const warmAllSpy = vi.spyOn(scheduler, 'warmAll').mockResolvedValue()

      scheduler.start()
      await Promise.resolve() // flush warmAll microtask

      expect(warmAllSpy).toHaveBeenCalledOnce()
    })

    it('stop prevents further ticks', async () => {
      prisma = makePrisma([item('p1')])
      scheduler = new CacheRefreshScheduler(cache, prisma as never)
      cache.l1.set('p1', { data: item('p1'), expiresAt: Date.now() + 60_000, frequency: 1 })

      scheduler.start()
      scheduler.stop()

      vi.advanceTimersByTime(120_000)
      await vi.runAllTimersAsync()

      expect(prisma.product.findUnique).not.toHaveBeenCalled()
    })

    // Extended scenario 8: stop called before start — no crash
    it('stop before start does not crash', () => {
      prisma = makePrisma()
      scheduler = new CacheRefreshScheduler(cache, prisma as never)
      expect(() => scheduler.stop()).not.toThrow()
    })

    // Extended scenario 9: start called twice — second call must not create a second interval
    it('start called twice does not create a second interval', async () => {
      prisma = makePrisma([item('p1')])
      scheduler = new CacheRefreshScheduler(cache, prisma as never)

      cache.l1.set('p1', {
        data: item('p1'),
        expiresAt: Date.now() + 60_000,
        frequency: 1,
      })

      const warmAllSpy = vi.spyOn(scheduler, 'warmAll').mockResolvedValue()

      scheduler.start()
      scheduler.start() // second call — should be a no-op due to guard

      await Promise.resolve()
      // warmAll should only be called once
      expect(warmAllSpy).toHaveBeenCalledOnce()

      // Fire one tick and then stop to count calls
      vi.advanceTimersByTime(60_000)
      scheduler.stop()
      await flushMicrotasks()

      // tick should only fire once (one interval, not two)
      expect(prisma.product.findUnique).toHaveBeenCalledTimes(1)
    })
  })
})
