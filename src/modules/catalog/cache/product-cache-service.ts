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
      let data: ProductResponseItem
      try {
        data = JSON.parse(raw) as ProductResponseItem
      } catch {
        logger.warn({ id }, 'cache.l2.parse.error')
        return null
      }
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
