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
    if (this.timer !== null) return
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
    if (l2Ids !== null && total !== null) {
      this.cache.setL1Ids(l2Ids)
      await Promise.all(l2Ids.map(id => this.cache.getProduct(id)))
      return
    }
    await this.loadAllFromDb()
  }

  private async tick(): Promise<void> {
    const now = Date.now()
    const entries = [...this.cache.l1]
    for (const [id, entry] of entries) {
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
    const data: ProductResponseItem = {
      id: row.id,
      sku: row.sku,
      name: row.name,
      price: (row.price as unknown as { toNumber(): number }).toNumber(),
      availableQuantity: (row.stockFlow as Array<{ quantity: number }>).reduce(
        (sum, sf) => sum + sf.quantity,
        0,
      ),
    }
    await this.cache.setProduct(id, data)
  }

  private async loadAllFromDb(): Promise<void> {
    const rows = await this.prisma.product.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { stockFlow: { select: { quantity: true } } },
    })
    this.cache.setL1Ids(rows.map(r => r.id))
    await this.cache.setRedisIds(
      rows.map(r => ({ id: r.id, score: (r.createdAt as Date).getTime() })),
    )
    await Promise.all(
      rows.map(row => {
        const data: ProductResponseItem = {
          id: row.id,
          sku: row.sku,
          name: row.name,
          price: (row.price as unknown as { toNumber(): number }).toNumber(),
          availableQuantity: (row.stockFlow as Array<{ quantity: number }>).reduce(
            (sum, sf) => sum + sf.quantity,
            0,
          ),
        }
        return this.cache.setProduct(row.id, data)
      }),
    )
  }
}
