# Cache da Vitrine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add L1 (in-process LFU Map) + L2 (Redis Sorted Set + per-key JSON) cache to `GET /products` endpoint, with granular per-product invalidation via ERP sync and proactive refresh-ahead scheduler.

**Architecture:** `CachedProductRepository` decorates `IProductRepository` and reads IDs from `products:sorted` (Redis Sorted Set, ZREVRANGE for newest-first) and products from `product:{id}` keys; cold cache falls back to Prisma and populates both layers. `ProductCacheService` owns all cache ops and implements `IProductCacheUpdater` so `ProcessSyncJobUseCase` can update individual cache entries on sync without full invalidation. `CacheRefreshScheduler` runs in the main process via `setInterval` and proactively refreshes entries nearing expiry.

**Tech Stack:** TypeScript, ioredis (already installed), tsyringe DI, Vitest 2.1.9, Prisma

**Spec:** `docs/superpowers/specs/2026-09-20-cache-vitrine-design.md`

## Global Constraints

- No new dependencies — `ioredis` already installed
- TTL formula: `(600 + Math.floor(Math.random() * 20) - 10) * 1000` ms — range [590 000, 609 000] ms
- Refresh-ahead threshold: 120 000ms remaining triggers async refresh
- Scheduler interval: 60 000ms
- L1 max entries: 1000; eviction: LFU (entry with lowest `frequency` removed)
- Redis keys: `products:sorted` (Sorted Set, score = createdAt ms), `product:{id}` (JSON string)
- ZREVRANGE gives IDs in descending score order (newest first) matching `orderBy: [{ createdAt: 'desc' }]`
- `IProductCacheUpdater` defined in erp-adapter; `ProductCacheService` imports it from `@modules/erp-adapter/repositories/product-cache-updater`
- `CachedProductRepository` is infra — `ListProductsUseCase` unchanged
- Redis failure: L1 serves if warm; both miss → Prisma fallback, no user-visible error
- Unit tests inject a plain mock object as `Redis` — no `vi.mock('ioredis')`
- New files have no `@injectable()` decorator (registered manually via `useValue` / `useFactory`)

---

### Task 1: IProductCacheUpdater + ProductCacheService

**Files:**
- Create: `src/modules/erp-adapter/repositories/product-cache-updater.ts`
- Create: `src/modules/catalog/cache/product-cache-service.ts`
- Create: `src/modules/catalog/cache/product-cache-service.spec.ts`

**Interfaces:**
- Produces: `IProductCacheUpdater` interface (consumed by Task 3 and Task 5); `ProductCacheService` class with its full public API (consumed by Tasks 2, 4, 5)

- [ ] **Step 1: Write failing tests**

`src/modules/catalog/cache/product-cache-service.spec.ts`:

```typescript
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
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/catalog/cache/product-cache-service.spec.ts
```

Expected: all tests fail with "Cannot find module"

- [ ] **Step 3: Create the interface file**

`src/modules/erp-adapter/repositories/product-cache-updater.ts`:

```typescript
export interface IProductCacheUpdater {
  updateProduct(id: string, data: {
    sku: string
    name: string
    price: number
    updatedAt: Date
  }): Promise<void>

  updateAvailableQuantity(productId: string, delta: number): Promise<void>
}
```

- [ ] **Step 4: Implement ProductCacheService**

`src/modules/catalog/cache/product-cache-service.ts`:

```typescript
import type { Redis } from 'ioredis'
import type { ProductResponseItem } from '../dtos/list-products-dto'
import type { IProductCacheUpdater } from '@modules/erp-adapter/repositories/product-cache-updater'
import { logger } from '@shared/observability/logger'

interface L1Entry {
  data: ProductResponseItem
  expiresAt: number
  frequency: number
}

const L1_MAX = 1000

function jitteredTtlMs(): number {
  return (600 + Math.floor(Math.random() * 20) - 10) * 1000
}

function jitteredTtlSec(): number {
  return 600 + Math.floor(Math.random() * 20) - 10
}

export class ProductCacheService implements IProductCacheUpdater {
  readonly l1 = new Map<string, L1Entry>()
  private l1IdsEntry: { ids: string[]; expiresAt: number } | null = null

  constructor(readonly redis: Redis) {}

  private evictLFU(): void {
    let minFreq = Infinity
    let minKey = ''
    for (const [key, entry] of this.l1) {
      if (entry.frequency < minFreq) {
        minFreq = entry.frequency
        minKey = key
      }
    }
    if (minKey) this.l1.delete(minKey)
  }

  private writeL1(id: string, data: ProductResponseItem): void {
    if (this.l1.size >= L1_MAX && !this.l1.has(id)) this.evictLFU()
    this.l1.set(id, { data, expiresAt: Date.now() + jitteredTtlMs(), frequency: 1 })
  }

  async getProduct(id: string): Promise<ProductResponseItem | null> {
    const entry = this.l1.get(id)
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        entry.frequency++
        return entry.data
      }
      this.l1.delete(id)
    }
    try {
      const raw = await this.redis.get(`product:${id}`)
      if (!raw) return null
      const data = JSON.parse(raw) as ProductResponseItem
      this.writeL1(id, data)
      return data
    } catch (err) {
      logger.warn({ id, err }, 'cache.l2.get.error')
      return null
    }
  }

  async setProduct(id: string, data: ProductResponseItem): Promise<void> {
    this.writeL1(id, data)
    try {
      await this.redis.set(`product:${id}`, JSON.stringify(data), 'EX', jitteredTtlSec())
    } catch (err) {
      logger.warn({ id, err }, 'cache.l2.set.error')
    }
  }

  getL1Ids(): string[] | null {
    if (this.l1IdsEntry && this.l1IdsEntry.expiresAt > Date.now()) {
      return this.l1IdsEntry.ids
    }
    this.l1IdsEntry = null
    return null
  }

  setL1Ids(ids: string[]): void {
    this.l1IdsEntry = { ids, expiresAt: Date.now() + jitteredTtlMs() }
  }

  async getRedisIds(): Promise<string[] | null> {
    try {
      const ids = await this.redis.zrevrange('products:sorted', 0, -1)
      return ids.length ? ids : null
    } catch (err) {
      logger.warn({ err }, 'cache.l2.getids.error')
      return null
    }
  }

  async setRedisIds(products: Array<{ id: string; score: number }>): Promise<void> {
    if (!products.length) return
    try {
      const pipeline = this.redis.pipeline()
      for (const p of products) {
        pipeline.zadd('products:sorted', p.score, p.id)
      }
      await pipeline.exec()
    } catch (err) {
      logger.warn({ err }, 'cache.l2.setids.error')
    }
  }

  async addToSortedSet(id: string, score: number): Promise<void> {
    try {
      await this.redis.zadd('products:sorted', score, id)
    } catch (err) {
      logger.warn({ id, err }, 'cache.l2.zadd.error')
    }
  }

  async getTotal(): Promise<number | null> {
    try {
      const count = await this.redis.zcard('products:sorted')
      return count > 0 ? count : null
    } catch (err) {
      logger.warn({ err }, 'cache.l2.total.error')
      return null
    }
  }

  async updateProduct(id: string, data: { sku: string; name: string; price: number; updatedAt: Date }): Promise<void> {
    const existing = await this.getProduct(id)
    if (!existing) {
      await this.addToSortedSet(id, data.updatedAt.getTime())
      return
    }
    await this.setProduct(id, { ...existing, sku: data.sku, name: data.name, price: data.price })
  }

  async updateAvailableQuantity(productId: string, delta: number): Promise<void> {
    const existing = await this.getProduct(productId)
    if (!existing) return
    await this.setProduct(productId, { ...existing, availableQuantity: existing.availableQuantity + delta })
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run src/modules/catalog/cache/product-cache-service.spec.ts
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/modules/erp-adapter/repositories/product-cache-updater.ts src/modules/catalog/cache/product-cache-service.ts src/modules/catalog/cache/product-cache-service.spec.ts
git commit -m "feat: add IProductCacheUpdater port and ProductCacheService (L1 LFU + L2 Redis)"
```

---

### Task 2: CachedProductRepository

**Files:**
- Create: `src/modules/catalog/infra/persistence/cached-product-repository.ts`
- Create: `src/modules/catalog/infra/persistence/cached-product-repository.spec.ts`

**Interfaces:**
- Consumes: `ProductCacheService` from Task 1 (full public API); `IProductRepository`, `FindAllParams`, `FindAllResult`, `ProductResponseItem` from catalog module; `PrismaClient` from `@prisma/client`
- Produces: `CachedProductRepository` class implementing `IProductRepository` (consumed by Task 5)

- [ ] **Step 1: Write failing tests**

`src/modules/catalog/infra/persistence/cached-product-repository.spec.ts`:

```typescript
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
  const mockPipeline = { zadd: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([]) }
  return {
    get: vi.fn<[], Promise<string | null>>().mockResolvedValue(null),
    set: vi.fn<[], Promise<'OK'>>().mockResolvedValue('OK'),
    zadd: vi.fn<[], Promise<number>>().mockResolvedValue(0),
    zrevrange: vi.fn<[], Promise<string[]>>().mockResolvedValue([]),
    zcard: vi.fn<[], Promise<number>>().mockResolvedValue(0),
    pipeline: vi.fn().mockReturnValue(mockPipeline),
  }
}

function makePrisma(rows: Array<{ id: string; createdAt: Date }> = [], products: Map<string, ProductResponseItem> = new Map()) {
  return {
    product: {
      findMany: vi.fn().mockResolvedValue(rows.map(r => ({ ...r }))),
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
      expect(result.products.map(p => p.id)).toEqual(['p2', 'p1'])
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
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/catalog/infra/persistence/cached-product-repository.spec.ts
```

Expected: fail with "Cannot find module"

- [ ] **Step 3: Implement CachedProductRepository**

`src/modules/catalog/infra/persistence/cached-product-repository.ts`:

```typescript
import type { PrismaClient } from '@prisma/client'
import type { IProductRepository, FindAllParams, FindAllResult } from '../../repositories/product-repository'
import type { ProductResponseItem } from '../../dtos/list-products-dto'
import type { ProductCacheService } from '../../cache/product-cache-service'

export class CachedProductRepository implements IProductRepository {
  constructor(
    private readonly cache: ProductCacheService,
    private readonly prisma: PrismaClient,
  ) {}

  async findAll({ page, limit }: FindAllParams): Promise<FindAllResult> {
    const { ids, total } = await this.resolveIds()
    const offset = (page - 1) * limit
    const pageIds = ids.slice(offset, offset + limit)
    const products = await this.resolveProducts(pageIds)
    return { products, total }
  }

  private async resolveIds(): Promise<{ ids: string[]; total: number }> {
    const l1Ids = this.cache.getL1Ids()
    if (l1Ids) {
      const total = await this.cache.getTotal() ?? l1Ids.length
      return { ids: l1Ids, total }
    }

    const [l2Ids, l2Total] = await Promise.all([
      this.cache.getRedisIds(),
      this.cache.getTotal(),
    ])
    if (l2Ids && l2Total !== null) {
      this.cache.setL1Ids(l2Ids)
      return { ids: l2Ids, total: l2Total }
    }

    const rows = await this.prisma.product.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: { id: true, createdAt: true },
    })
    const ids = rows.map(r => r.id)
    const total = ids.length
    this.cache.setL1Ids(ids)
    await this.cache.setRedisIds(rows.map(r => ({ id: r.id, score: r.createdAt.getTime() })))
    return { ids, total }
  }

  private async resolveProducts(ids: string[]): Promise<ProductResponseItem[]> {
    const results = await Promise.all(ids.map(id => this.resolveProduct(id)))
    return results.filter((p): p is ProductResponseItem => p !== null)
  }

  private async resolveProduct(id: string): Promise<ProductResponseItem | null> {
    const cached = await this.cache.getProduct(id)
    if (cached) return cached

    const row = await this.prisma.product.findUnique({
      where: { id },
      include: { stockFlow: { select: { quantity: true } } },
    })
    if (!row) return null

    const data: ProductResponseItem = {
      id: row.id,
      sku: row.sku,
      name: row.name,
      price: row.price.toNumber(),
      availableQuantity: row.stockFlow.reduce((sum, sf) => sum + sf.quantity, 0),
    }
    await this.cache.setProduct(id, data)
    return data
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/catalog/infra/persistence/cached-product-repository.spec.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/catalog/infra/persistence/cached-product-repository.ts src/modules/catalog/infra/persistence/cached-product-repository.spec.ts
git commit -m "feat: add CachedProductRepository decorator (L1+L2 read-through with DB fallback)"
```

---

### Task 3: ProcessSyncJobUseCase cache integration

**Files:**
- Modify: `src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.ts`
- Modify: `src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.spec.ts`

**Interfaces:**
- Consumes: `IProductCacheUpdater` from Task 1 (`@modules/erp-adapter/repositories/product-cache-updater`)
- Produces: `ProcessSyncJobUseCase` with 4-arg constructor (consumed by Task 5)

- [ ] **Step 1: Add failing tests to the existing spec file**

Add these tests to the existing `describe('ProcessSyncJobUseCase')` block in `process-sync-job.spec.ts`. Also update the `beforeEach` block to include `cacheUpdater`:

Replace the existing `beforeEach` and variable declarations with:

```typescript
import 'reflect-metadata'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProcessSyncJobUseCase } from './process-sync-job'
import { InMemoryCatalogProductWriteRepository } from './in-memory-catalog-product-write-repository'
import { InMemoryCatalogStockFlowWriteRepository } from './in-memory-catalog-stock-flow-write-repository'
import { InMemoryOutboxRepository } from '../in-memory-outbox-repository'

describe('ProcessSyncJobUseCase', () => {
  let productRepo: InMemoryCatalogProductWriteRepository
  let stockFlowRepo: InMemoryCatalogStockFlowWriteRepository
  let outboxRepo: InMemoryOutboxRepository
  let cacheUpdater: { updateProduct: ReturnType<typeof vi.fn>; updateAvailableQuantity: ReturnType<typeof vi.fn> }
  let useCase: ProcessSyncJobUseCase

  beforeEach(() => {
    productRepo = new InMemoryCatalogProductWriteRepository()
    stockFlowRepo = new InMemoryCatalogStockFlowWriteRepository()
    outboxRepo = new InMemoryOutboxRepository()
    cacheUpdater = {
      updateProduct: vi.fn().mockResolvedValue(undefined),
      updateAvailableQuantity: vi.fn().mockResolvedValue(undefined),
    }
    useCase = new ProcessSyncJobUseCase(productRepo, stockFlowRepo, outboxRepo, cacheUpdater)
  })
```

Then add these tests at the end of the describe block:

```typescript
  it('calls cacheUpdater.updateProduct after successful product upsert', async () => {
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-8' })
    expect(cacheUpdater.updateProduct).toHaveBeenCalledOnce()
    expect(cacheUpdater.updateProduct).toHaveBeenCalledWith('erp-1', {
      sku: 'SKU-001',
      name: 'Capa',
      price: 49.9,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    })
  })

  it('calls cacheUpdater.updateAvailableQuantity after successful stock_flow create', async () => {
    const payload = { id: 'sf-1', product_id: 'prod-1', quantity: 10, moved_at: '2026-01-01T00:00:00Z' }
    await useCase.execute({ entity: 'stock_flow', erpId: 'sf-1', payload, correlationId: 'corr-9' })
    expect(cacheUpdater.updateAvailableQuantity).toHaveBeenCalledOnce()
    expect(cacheUpdater.updateAvailableQuantity).toHaveBeenCalledWith('prod-1', 10)
  })

  it('does not call cache updater when product upsert fails', async () => {
    productRepo.upsert = async () => { throw new Error('DB error') }
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-10' })
    expect(cacheUpdater.updateProduct).not.toHaveBeenCalled()
  })

  it('does not fail when cacheUpdater.updateProduct throws', async () => {
    cacheUpdater.updateProduct.mockRejectedValue(new Error('Redis down'))
    const payload = { id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updated_at: '2026-01-01T00:00:00Z' }
    const result = await useCase.execute({ entity: 'product', erpId: 'erp-1', payload, correlationId: 'corr-11' })
    expect(result.isSuccess()).toBe(true)
  })
```

- [ ] **Step 2: Run spec to confirm new tests fail**

```bash
npx vitest run src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.spec.ts
```

Expected: existing tests fail (constructor arg count mismatch) + new tests fail

- [ ] **Step 3: Update ProcessSyncJobUseCase**

In `src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.ts`:

Add import:
```typescript
import type { IProductCacheUpdater } from '../../repositories/product-cache-updater'
```

Add 4th constructor parameter after `IOutboxRepository`:
```typescript
  constructor(
    @inject('ICatalogProductWriteRepository') private readonly productRepo: ICatalogProductWriteRepository,
    @inject('ICatalogStockFlowWriteRepository') private readonly stockFlowRepo: ICatalogStockFlowWriteRepository,
    @inject('IOutboxRepository') private readonly outboxRepository: IOutboxRepository,
    @inject('IProductCacheUpdater') private readonly cacheUpdater: IProductCacheUpdater,
  ) {}
```

In the `execute` method, add cache update calls inside the `try` block after each entity's operation but before `markProcessed`. The full updated `execute` body:

```typescript
  async execute(input: ProcessSyncJobInput): Promise<Either<DomainError, void>> {
    const { entity, erpId, payload, correlationId } = input
    const span = tracer.startSpan(`erp.sync.process`)
    span.setAttribute('entity', entity)
    span.setAttribute('erp_id', erpId)

    try {
      if (entity === 'product') {
        await this.productRepo.upsert({
          id: payload.id as string,
          sku: payload.sku as string,
          name: payload.name as string,
          price: payload.price as number,
          updatedAt: new Date(payload.updated_at as string),
        })
        await this.cacheUpdater.updateProduct(payload.id as string, {
          sku: payload.sku as string,
          name: payload.name as string,
          price: payload.price as number,
          updatedAt: new Date(payload.updated_at as string),
        })
      }

      if (entity === 'stock_flow') {
        await this.stockFlowRepo.createIfNotExists({
          id: payload.id as string,
          productId: payload.product_id as string,
          quantity: payload.quantity as number,
          movedAt: new Date(payload.moved_at as string),
        })
        await this.cacheUpdater.updateAvailableQuantity(
          payload.product_id as string,
          payload.quantity as number,
        )
      }

      await this.outboxRepository.markProcessed(entity, erpId)
      logger.info({ correlationId, entity, erpId }, 'erp.sync.processed')
      span.setAttribute('status', 'processed')
      return right(undefined)
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err)
      logger.error({ correlationId, entity, erpId, cause }, 'erp.sync.process.error')
      span.setAttribute('status', 'error')
      return left(new SyncProcessingError(entity, erpId, cause))
    } finally {
      span.end()
    }
  }
```

Note: the cache updater calls are inside the try block — if Redis is down they throw and the use case returns `left(SyncProcessingError)`. Per the "does not fail" test, wrap cache update in a separate try-catch that only logs:

```typescript
        try {
          await this.cacheUpdater.updateProduct(payload.id as string, {
            sku: payload.sku as string,
            name: payload.name as string,
            price: payload.price as number,
            updatedAt: new Date(payload.updated_at as string),
          })
        } catch (cacheErr) {
          logger.warn({ correlationId, entity, erpId, err: cacheErr }, 'erp.sync.cache.update.warn')
        }
```

And same for `updateAvailableQuantity`. The sync success should not depend on cache availability.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.spec.ts
```

Expected: all tests pass (existing + new)

- [ ] **Step 5: Commit**

```bash
git add src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.ts src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.spec.ts
git commit -m "feat: inject IProductCacheUpdater into ProcessSyncJobUseCase for granular cache invalidation"
```

---

### Task 4: CacheRefreshScheduler

**Files:**
- Create: `src/modules/catalog/cache/cache-refresh-scheduler.ts`
- Create: `src/modules/catalog/cache/cache-refresh-scheduler.spec.ts`

**Interfaces:**
- Consumes: `ProductCacheService` from Task 1; `PrismaClient` from `@prisma/client`
- Produces: `CacheRefreshScheduler` class with `start()` / `stop()` / `warmAll()` (consumed by Task 5)

- [ ] **Step 1: Write failing tests**

`src/modules/catalog/cache/cache-refresh-scheduler.spec.ts`:

```typescript
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
  const mockPipeline = { zadd: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([]) }
  return {
    get: vi.fn<[], Promise<string | null>>().mockResolvedValue(null),
    set: vi.fn<[], Promise<'OK'>>().mockResolvedValue('OK'),
    zadd: vi.fn<[], Promise<number>>().mockResolvedValue(0),
    zrevrange: vi.fn<[], Promise<string[]>>().mockResolvedValue([]),
    zcard: vi.fn<[], Promise<number>>().mockResolvedValue(0),
    pipeline: vi.fn().mockReturnValue(mockPipeline),
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

      // Advance timer to trigger first tick
      vi.advanceTimersByTime(60_000)
      // Allow async refresh to settle
      await vi.runAllTimersAsync()

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

      vi.advanceTimersByTime(60_000)
      await vi.runAllTimersAsync()

      expect(prisma.product.findUnique).not.toHaveBeenCalled()
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
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/catalog/cache/cache-refresh-scheduler.spec.ts
```

Expected: fail with "Cannot find module"

- [ ] **Step 3: Implement CacheRefreshScheduler**

`src/modules/catalog/cache/cache-refresh-scheduler.ts`:

```typescript
import type { PrismaClient } from '@prisma/client'
import type { ProductCacheService } from './product-cache-service'
import type { ProductResponseItem } from '../dtos/list-products-dto'
import { logger } from '@shared/observability/logger'

const REFRESH_AHEAD_MS = 120_000
const INTERVAL_MS = 60_000

export class CacheRefreshScheduler {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly cache: ProductCacheService,
    private readonly prisma: PrismaClient,
  ) {}

  start(): void {
    this.warmAll().catch(err => logger.error({ err }, 'cache.scheduler.warmall.error'))
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async warmAll(): Promise<void> {
    const [l2Ids, total] = await Promise.all([
      this.cache.getRedisIds(),
      this.cache.getTotal(),
    ])
    if (l2Ids && total) {
      this.cache.setL1Ids(l2Ids)
      await Promise.all(l2Ids.map(id => this.cache.getProduct(id)))
      return
    }
    await this.loadAllFromDb()
  }

  private async tick(): Promise<void> {
    const now = Date.now()
    for (const [id, entry] of this.cache.l1) {
      if (entry.expiresAt - now < REFRESH_AHEAD_MS) {
        this.refreshProduct(id).catch(err =>
          logger.warn({ id, err }, 'cache.scheduler.refresh.error'),
        )
      }
    }
  }

  private async refreshProduct(id: string): Promise<void> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: { stockFlow: { select: { quantity: true } } },
    })
    if (!row) return
    await this.cache.setProduct(id, {
      id: row.id,
      sku: row.sku,
      name: row.name,
      price: row.price.toNumber(),
      availableQuantity: row.stockFlow.reduce((sum, sf) => sum + sf.quantity, 0),
    })
  }

  private async loadAllFromDb(): Promise<void> {
    const rows = await this.prisma.product.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { stockFlow: { select: { quantity: true } } },
    })
    this.cache.setL1Ids(rows.map(r => r.id))
    await this.cache.setRedisIds(rows.map(r => ({ id: r.id, score: r.createdAt.getTime() })))
    await Promise.all(
      rows.map(row => {
        const data: ProductResponseItem = {
          id: row.id,
          sku: row.sku,
          name: row.name,
          price: row.price.toNumber(),
          availableQuantity: row.stockFlow.reduce((sum, sf) => sum + sf.quantity, 0),
        }
        return this.cache.setProduct(row.id, data)
      }),
    )
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/modules/catalog/cache/cache-refresh-scheduler.spec.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/catalog/cache/cache-refresh-scheduler.ts src/modules/catalog/cache/cache-refresh-scheduler.spec.ts
git commit -m "feat: add CacheRefreshScheduler with warm-up and refresh-ahead"
```

---

### Task 5: Container wiring + startup

**Files:**
- Modify: `src/modules/catalog/container.ts`
- Modify: `src/modules/erp-adapter/container.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `ProductCacheService` (Task 1), `CachedProductRepository` (Task 2), `CacheRefreshScheduler` (Task 4), `IProductCacheUpdater` (Task 1), existing container patterns
- Produces: fully wired app; `CacheRefreshScheduler` started in `bootstrap()`

- [ ] **Step 1: Update catalog container**

Replace `src/modules/catalog/container.ts` with:

```typescript
import { container } from 'tsyringe'
import type { IProductRepository } from './repositories/product-repository'
import type { IProductCacheUpdater } from '@modules/erp-adapter/repositories/product-cache-updater'
import { CachedProductRepository } from './infra/persistence/cached-product-repository'
import { ProductCacheService } from './cache/product-cache-service'
import { CacheRefreshScheduler } from './cache/cache-refresh-scheduler'
import { ListProductsUseCase } from './use-cases/list-products/list-products'
import { ProductController } from './infra/http/product-controller'
import { prisma } from '@shared/database/prisma-client'
import type { Redis } from 'ioredis'

export function registerCatalogModule(redis: Redis): void {
  const cacheService = new ProductCacheService(redis)

  container.register<IProductCacheUpdater>('IProductCacheUpdater', {
    useValue: cacheService,
  })

  container.register<IProductRepository>('IProductRepository', {
    useValue: new CachedProductRepository(cacheService, prisma),
  })

  container.register(ListProductsUseCase, {
    useFactory: () =>
      new ListProductsUseCase(container.resolve<IProductRepository>('IProductRepository')),
  })

  container.register(ProductController, {
    useFactory: () => new ProductController(container.resolve(ListProductsUseCase)),
  })

  container.register(CacheRefreshScheduler, {
    useValue: new CacheRefreshScheduler(cacheService, prisma),
  })
}
```

- [ ] **Step 2: Update erp-adapter container**

In `src/modules/erp-adapter/container.ts`, update the `ProcessSyncJobUseCase` registration to resolve `IProductCacheUpdater`:

Add import:
```typescript
import type { IProductCacheUpdater } from './repositories/product-cache-updater'
```

Replace the `ProcessSyncJobUseCase` factory:
```typescript
  container.register(ProcessSyncJobUseCase, {
    useFactory: () => new ProcessSyncJobUseCase(
      container.resolve<ICatalogProductWriteRepository>('ICatalogProductWriteRepository'),
      container.resolve<ICatalogStockFlowWriteRepository>('ICatalogStockFlowWriteRepository'),
      container.resolve<IOutboxRepository>('IOutboxRepository'),
      container.resolve<IProductCacheUpdater>('IProductCacheUpdater'),
    ),
  })
```

- [ ] **Step 3: Update main.ts**

Pass `redis` to `registerCatalogModule` and start `CacheRefreshScheduler`. Replace existing `main.ts`:

```typescript
import 'reflect-metadata'
import { registerSharedInfra } from '@shared/container'
import { registerCatalogModule } from '@modules/catalog/container'
import { registerErpAdapterModule } from '@modules/erp-adapter/container'
import { buildApp } from '@infra/http/server'
import { BullMQRelay } from '@modules/erp-adapter/infra/queue/bullmq-relay'
import { BullMQSyncWorker } from '@modules/erp-adapter/infra/queue/bullmq-sync-worker'
import { ErpScheduler } from '@modules/erp-adapter/infra/scheduler/erp-scheduler'
import { CacheRefreshScheduler } from '@modules/catalog/cache/cache-refresh-scheduler'
import { container } from 'tsyringe'
import Redis from 'ioredis'

async function bootstrap(): Promise<void> {
  const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
  const redis = new Redis({ host: redisUrl.hostname, port: Number(redisUrl.port) || 6379, maxRetriesPerRequest: null })

  registerSharedInfra()
  registerCatalogModule(redis)
  registerErpAdapterModule(redis)

  const app = await buildApp(redis)
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })

  const relay = container.resolve(BullMQRelay)
  const worker = container.resolve(BullMQSyncWorker)
  const erpScheduler = container.resolve(ErpScheduler)
  const cacheScheduler = container.resolve(CacheRefreshScheduler)

  relay.start()
  worker.start()
  erpScheduler.start()
  cacheScheduler.start()
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 4: Run typecheck to verify all wiring is correct**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 5: Run all unit tests**

```bash
npm run test:unit
```

Expected: all tests pass (no regressions)

- [ ] **Step 6: Run integration tests**

```bash
wsl docker compose -f docker-compose.test.yml up -d
npx vitest run --config vitest.integration.ts
```

Expected: all integration tests pass

- [ ] **Step 7: Commit**

```bash
git add src/modules/catalog/container.ts src/modules/erp-adapter/container.ts src/main.ts
git commit -m "feat: wire cache layers into DI container and start CacheRefreshScheduler on bootstrap"
```

- [ ] **Step 8: Update vitest.coverage.ts exclusions**

Add new cache/scheduler files to the coverage **include** (they are already included by `src/**/*.ts`) but verify the exclude list does NOT include `cached-product-repository.ts` or `product-cache-service.ts` — those should be covered. If the file is present, also exclude `src/modules/catalog/cache/cache-refresh-scheduler.ts` since it has side effects (setInterval), similar to the infra scheduler exclusions already in the list.

Check current excludes (read `vitest.coverage.ts`). `CacheRefreshScheduler` should be excluded (it is infra-like with side effects). `ProductCacheService` and `CachedProductRepository` should stay included since they have unit tests.

Add to the `exclude` array in `vitest.coverage.ts`:
```
'src/modules/catalog/cache/cache-refresh-scheduler.ts',
```

- [ ] **Step 9: Commit coverage update**

```bash
git add vitest.coverage.ts
git commit -m "chore: exclude CacheRefreshScheduler from coverage (side-effect infra)"
```

- [ ] **Step 10: Open PR**

```bash
gh pr create \
  --title "feat: cache da vitrine (L1 LFU + L2 Redis Sorted Set, refresh-ahead)" \
  --base main \
  --body "$(cat <<'EOF'
## Summary

- Adds two-layer cache to `GET /products` vitrine endpoint: L1 in-process LFU Map (max 1000 entries) + L2 Redis Sorted Set + per-product JSON keys
- `CachedProductRepository` decorates `IProductRepository` with cache-aside read-through; cold cache falls back to Prisma with DB population of both layers
- `ProductCacheService` implements `IProductCacheUpdater` port — `ProcessSyncJobUseCase` calls it after each product/stock_flow sync for granular per-entry invalidation (no full cache wipe)
- `CacheRefreshScheduler` runs in main process via `setInterval`, warms cache on startup, and proactively refreshes entries within 120s of expiry to prevent stampede
- TTL 600s ± 10s jitter per entry; LFU eviction when L1 exceeds 1000 entries

## Test plan
- [ ] `product-cache-service.spec.ts` — L1/L2 ops, LFU eviction, `IProductCacheUpdater` implementation
- [ ] `cached-product-repository.spec.ts` — cold/warm cache, pagination, DB fallback
- [ ] `process-sync-job.spec.ts` — existing tests + cache updater called/skipped correctly
- [ ] `cache-refresh-scheduler.spec.ts` — warmAll, tick, start/stop
- [ ] Integration tests pass (CI)
- [ ] Coverage ≥ 80%

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| L1 in-process LFU Map, max 1000 entries | Task 1 `ProductCacheService` |
| L2 Redis `products:sorted` Sorted Set + `product:{id}` | Task 1 `ProductCacheService` |
| TTL 600s ± 10s jitter | Task 1 `jitteredTtlSec` / `jitteredTtlMs` |
| `CachedProductRepository` decorator, read-through flow | Task 2 |
| DB cold-start fallback (ZRANGE miss → DB → ZADD + SET) | Task 2 `resolveIds` |
| `IProductCacheUpdater` port in erp-adapter | Task 1 |
| `ProcessSyncJobUseCase` injects + calls cache updater | Task 3 |
| Product sync updates sku/name/price, preserves availableQuantity | Task 1 `updateProduct` |
| New product sync: ZADD only, no product key | Task 1 `updateProduct` |
| StockFlow sync: delta on cache hit, ignore on miss | Task 1 `updateAvailableQuantity` |
| Cache failure does not break sync | Task 3 (separate try-catch) |
| Refresh-ahead 120s threshold, 60s interval | Task 4 |
| `warmAll` on startup: L2→L1 or DB→L2+L1 | Task 4 |
| Container wiring, `registerCatalogModule(redis)` | Task 5 |
| `CacheRefreshScheduler.start()` in bootstrap | Task 5 |
| Unit tests with mock Redis (no `vi.mock('ioredis')`) | All tasks |
| No new dependencies | Verified — only ioredis used |
