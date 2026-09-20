import 'reflect-metadata'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ProductCacheService } from './product-cache-service'
import type { Redis } from 'ioredis'
import type { ProductResponseItem } from '../dtos/list-products-dto'

function item(overrides: Partial<ProductResponseItem> = {}): ProductResponseItem {
  return { id: 'p1', sku: 'SKU-1', name: 'Capa', price: 29.9, availableQuantity: 10, ...overrides }
}

function makeRedis() {
  const mockPipeline = {
    zadd: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  }
  return {
    get: vi.fn<[], Promise<string | null>>().mockResolvedValue(null),
    set: vi.fn<[], Promise<'OK'>>().mockResolvedValue('OK'),
    zadd: vi.fn<[], Promise<number>>().mockResolvedValue(0),
    zrevrange: vi.fn<[], Promise<string[]>>().mockResolvedValue([]),
    zcard: vi.fn<[], Promise<number>>().mockResolvedValue(0),
    pipeline: vi.fn().mockReturnValue(mockPipeline),
    _pipeline: mockPipeline,
  }
}

describe('ProductCacheService', () => {
  let redis: ReturnType<typeof makeRedis>
  let cache: ProductCacheService

  beforeEach(() => {
    redis = makeRedis()
    cache = new ProductCacheService(redis as unknown as Redis)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getProduct', () => {
    it('returns null on L1 and L2 miss', async () => {
      const result = await cache.getProduct('p1')
      expect(result).toBeNull()
      expect(redis.get).toHaveBeenCalledWith('product:p1')
    })

    it('returns data from L2 and populates L1', async () => {
      const data = item()
      redis.get.mockResolvedValue(JSON.stringify(data))
      const result = await cache.getProduct('p1')
      expect(result).toEqual(data)
      expect(cache.l1.has('p1')).toBe(true)
    })

    it('returns data from L1 without calling Redis', async () => {
      const data = item()
      await cache.setProduct('p1', data)
      redis.get.mockClear()
      const result = await cache.getProduct('p1')
      expect(result).toEqual(data)
      expect(redis.get).not.toHaveBeenCalled()
    })

    it('increments frequency on L1 hit', async () => {
      const data = item()
      await cache.setProduct('p1', data)
      await cache.getProduct('p1')
      await cache.getProduct('p1')
      expect(cache.l1.get('p1')!.frequency).toBe(3) // 1 from set + 2 reads
    })

    it('re-fetches from L2 when L1 entry is expired', async () => {
      const data = item()
      cache.l1.set('p1', { data, expiresAt: Date.now() - 1, frequency: 1 })
      redis.get.mockResolvedValue(JSON.stringify(data))
      const result = await cache.getProduct('p1')
      expect(result).toEqual(data)
      expect(redis.get).toHaveBeenCalled()
    })

    it('returns null and does not throw when Redis throws', async () => {
      redis.get.mockRejectedValue(new Error('connection refused'))
      const result = await cache.getProduct('p1')
      expect(result).toBeNull()
    })

    // Extended: L2 hit but JSON.parse throws (corrupt data) → returns null gracefully
    it('returns null when L2 data is corrupt JSON', async () => {
      redis.get.mockResolvedValue('{invalid json{{')
      const result = await cache.getProduct('p1')
      expect(result).toBeNull()
    })

    // Extended: called twice on same key increments frequency to >= 2
    it('increments frequency on each L1 access (not reset to 1)', async () => {
      const data = item()
      await cache.setProduct('p1', data)
      await cache.getProduct('p1') // freq 2
      await cache.getProduct('p1') // freq 3
      expect(cache.l1.get('p1')!.frequency).toBeGreaterThanOrEqual(2)
    })
  })

  describe('setProduct', () => {
    it('sets L1 and calls Redis SET with EX', async () => {
      const data = item()
      await cache.setProduct('p1', data)
      expect(cache.l1.has('p1')).toBe(true)
      expect(redis.set).toHaveBeenCalledWith('product:p1', JSON.stringify(data), 'EX', expect.any(Number))
      const ttl = (redis.set.mock.calls[0] as unknown[])[3] as number
      expect(ttl).toBeGreaterThanOrEqual(590)
      expect(ttl).toBeLessThanOrEqual(609)
    })

    it('does not throw when Redis SET fails', async () => {
      redis.set.mockRejectedValue(new Error('OOM'))
      await expect(cache.setProduct('p1', item())).resolves.not.toThrow()
    })
  })

  describe('L1 LFU eviction', () => {
    it('evicts lowest-frequency entry when L1 reaches 1000 entries', async () => {
      // Fill L1 with 1000 entries, all frequency=1 except 'low-freq' with frequency=0
      // We directly manipulate l1 for speed
      for (let i = 0; i < 999; i++) {
        cache.l1.set(`x${i}`, { data: item({ id: `x${i}` }), expiresAt: Date.now() + 999999, frequency: 2 })
      }
      // Add low-frequency entry
      cache.l1.set('low-freq', { data: item({ id: 'low-freq' }), expiresAt: Date.now() + 999999, frequency: 0 })
      expect(cache.l1.size).toBe(1000)

      // Adding a new entry triggers eviction of 'low-freq'
      await cache.setProduct('new-entry', item({ id: 'new-entry' }))
      expect(cache.l1.size).toBe(1000)
      expect(cache.l1.has('low-freq')).toBe(false)
      expect(cache.l1.has('new-entry')).toBe(true)
    })

    // Extended: when multiple entries have same minimum frequency, evicts one of them (not higher-freq ones)
    it('evicts one entry when multiple have the same minimum frequency', async () => {
      // Fill L1 with 999 entries at freq=2
      for (let i = 0; i < 999; i++) {
        cache.l1.set(`x${i}`, { data: item({ id: `x${i}` }), expiresAt: Date.now() + 999999, frequency: 2 })
      }
      // Add one more entry at the same freq=2
      cache.l1.set('tied', { data: item({ id: 'tied' }), expiresAt: Date.now() + 999999, frequency: 2 })
      expect(cache.l1.size).toBe(1000)

      await cache.setProduct('new-entry', item({ id: 'new-entry' }))
      expect(cache.l1.size).toBe(1000)
      // new-entry must be in, and no entry with freq > 2 was evicted (all were freq=2)
      expect(cache.l1.has('new-entry')).toBe(true)
      // Verify that the new entry's frequency=1, which is less than 2 (the evicted entries)
      // and that total size is exactly 1000
      let highFreqCount = 0
      for (const [, entry] of cache.l1) {
        if (entry.frequency > 2) highFreqCount++
      }
      expect(highFreqCount).toBe(0)
    })
  })

  describe('getL1Ids / setL1Ids', () => {
    it('returns null when no IDs stored', () => {
      expect(cache.getL1Ids()).toBeNull()
    })

    it('returns ids after setL1Ids', () => {
      cache.setL1Ids(['a', 'b'])
      expect(cache.getL1Ids()).toEqual(['a', 'b'])
    })

    it('returns null after L1 IDs expire', () => {
      cache.setL1Ids(['a'])
      // Manually expire
      ;(cache as unknown as { l1IdsEntry: { expiresAt: number } }).l1IdsEntry!.expiresAt = Date.now() - 1
      expect(cache.getL1Ids()).toBeNull()
    })

    // Extended: calling setL1Ids again overwrites previous entry (no stale IDs)
    it('overwrites previous IDs when setL1Ids is called again', () => {
      cache.setL1Ids(['a', 'b', 'c'])
      cache.setL1Ids(['x', 'y'])
      expect(cache.getL1Ids()).toEqual(['x', 'y'])
    })
  })

  describe('getRedisIds', () => {
    it('returns ids from ZREVRANGE', async () => {
      redis.zrevrange.mockResolvedValue(['id2', 'id1'])
      const result = await cache.getRedisIds()
      expect(result).toEqual(['id2', 'id1'])
    })

    it('returns null when ZREVRANGE is empty', async () => {
      redis.zrevrange.mockResolvedValue([])
      expect(await cache.getRedisIds()).toBeNull()
    })

    it('returns null and does not throw on Redis error', async () => {
      redis.zrevrange.mockRejectedValue(new Error('NOCONN'))
      expect(await cache.getRedisIds()).toBeNull()
    })
  })

  describe('getTotal', () => {
    it('returns count from ZCARD', async () => {
      redis.zcard.mockResolvedValue(42)
      expect(await cache.getTotal()).toBe(42)
    })

    it('returns null when ZCARD returns 0', async () => {
      redis.zcard.mockResolvedValue(0)
      expect(await cache.getTotal()).toBeNull()
    })

    it('returns null and does not throw when Redis throws', async () => {
      redis.zcard.mockRejectedValue(new Error('NOCONN'))
      expect(await cache.getTotal()).toBeNull()
    })
  })

  describe('setRedisIds', () => {
    it('calls pipeline ZADD for each product', async () => {
      const products = [{ id: 'p1', score: 1000 }, { id: 'p2', score: 2000 }]
      await cache.setRedisIds(products)
      expect(redis.pipeline).toHaveBeenCalled()
      expect(redis._pipeline.zadd).toHaveBeenCalledTimes(2)
      expect(redis._pipeline.zadd).toHaveBeenCalledWith('products:sorted', 1000, 'p1')
      expect(redis._pipeline.zadd).toHaveBeenCalledWith('products:sorted', 2000, 'p2')
    })

    it('no-ops when products array is empty', async () => {
      await cache.setRedisIds([])
      expect(redis.pipeline).not.toHaveBeenCalled()
    })

    // Extended: does not throw when pipeline.exec() rejects (Redis down)
    it('does not throw when pipeline.exec() rejects', async () => {
      redis._pipeline.exec.mockRejectedValue(new Error('Redis down'))
      await expect(cache.setRedisIds([{ id: 'p1', score: 1000 }])).resolves.not.toThrow()
    })
  })

  describe('addToSortedSet', () => {
    it('calls ZADD with score and id', async () => {
      await cache.addToSortedSet('p1', 1234567890)
      expect(redis.zadd).toHaveBeenCalledWith('products:sorted', 1234567890, 'p1')
    })

    it('does not throw when Redis fails', async () => {
      redis.zadd.mockRejectedValue(new Error('NOCONN'))
      await expect(cache.addToSortedSet('p1', 1000)).resolves.not.toThrow()
    })
  })

  describe('updateProduct (IProductCacheUpdater)', () => {
    it('updates sku/name/price and preserves availableQuantity on cache hit', async () => {
      const original = item({ availableQuantity: 50 })
      cache.l1.set('p1', { data: original, expiresAt: Date.now() + 999999, frequency: 1 })
      await cache.updateProduct('p1', { sku: 'NEW', name: 'New Name', price: 99.9, updatedAt: new Date() })
      const updated = cache.l1.get('p1')!.data
      expect(updated.sku).toBe('NEW')
      expect(updated.name).toBe('New Name')
      expect(updated.price).toBe(99.9)
      expect(updated.availableQuantity).toBe(50)
    })

    it('calls addToSortedSet and does not set product key on cache miss', async () => {
      const updatedAt = new Date(1_700_000_000_000)
      await cache.updateProduct('p1', { sku: 'SKU', name: 'N', price: 1, updatedAt })
      expect(redis.zadd).toHaveBeenCalledWith('products:sorted', updatedAt.getTime(), 'p1')
      expect(redis.set).not.toHaveBeenCalled()
    })

    // Extended: L2 hit (product in Redis but not L1) → properly updates and writes back
    it('updates product when found only in L2 (not L1)', async () => {
      const original = item({ availableQuantity: 20 })
      redis.get.mockResolvedValue(JSON.stringify(original))
      await cache.updateProduct('p1', { sku: 'NEW-SKU', name: 'New', price: 55.5, updatedAt: new Date() })
      // After update, the entry should be in L1 with updated values
      const updated = cache.l1.get('p1')!.data
      expect(updated.sku).toBe('NEW-SKU')
      expect(updated.name).toBe('New')
      expect(updated.price).toBe(55.5)
      expect(updated.availableQuantity).toBe(20)
    })
  })

  describe('updateAvailableQuantity (IProductCacheUpdater)', () => {
    it('increments availableQuantity by delta on cache hit', async () => {
      cache.l1.set('p1', { data: item({ availableQuantity: 5 }), expiresAt: Date.now() + 999999, frequency: 1 })
      await cache.updateAvailableQuantity('p1', 3)
      expect(cache.l1.get('p1')!.data.availableQuantity).toBe(8)
    })

    it('no-ops on cache miss', async () => {
      await cache.updateAvailableQuantity('p1', 10)
      expect(redis.set).not.toHaveBeenCalled()
    })

    // Extended: delta is negative (stock removal) → availableQuantity decrements correctly
    it('decrements availableQuantity when delta is negative', async () => {
      cache.l1.set('p1', { data: item({ availableQuantity: 10 }), expiresAt: Date.now() + 999999, frequency: 1 })
      await cache.updateAvailableQuantity('p1', -4)
      expect(cache.l1.get('p1')!.data.availableQuantity).toBe(6)
    })
  })
})
