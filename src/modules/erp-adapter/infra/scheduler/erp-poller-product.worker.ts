import 'reflect-metadata'
import { isMainThread } from 'node:worker_threads'
import { PrismaClient } from '@prisma/client'
import { PrismaOutboxRepository } from '../persistence/prisma-outbox-repository'
import { PrismaSyncCursorRepository } from '../persistence/prisma-sync-cursor-repository'
import { PrismaErpProductRepository } from '../persistence/prisma-erp-product-repository'
import { PollErpProductsUseCase } from '../../use-cases/poll-erp-products/poll-erp-products'
import { logger } from '@shared/observability/logger'
import { tracer } from '@shared/observability/tracer'

if (!isMainThread) {
  const intervalMs = Number(process.env.POLL_INTERVAL_PRODUCTS_MS ?? 15000)
  const prisma = new PrismaClient()
  const erpPrisma = new PrismaClient({ datasources: { db: { url: process.env.ERP_DATABASE_URL } } })

  const outboxRepo = new PrismaOutboxRepository(prisma)
  const cursorRepo = new PrismaSyncCursorRepository(prisma)
  const erpProductRepo = new PrismaErpProductRepository(erpPrisma)
  const useCase = new PollErpProductsUseCase(erpProductRepo, outboxRepo, cursorRepo)

  const poll = async () => {
    const span = tracer.startSpan('erp.poll.product')
    const start = Date.now()
    try {
      const result = await useCase.execute({})
      if (result.isSuccess()) {
        logger.debug({ entity: 'product', detected: result.value.detected, durationMs: Date.now() - start }, 'erp.poll.cycle')
      }
    } catch (err) {
      logger.error({ entity: 'product', error: (err as Error).message }, 'erp.poll.error')
    } finally {
      span.end()
    }
  }

  void poll()
  setInterval(() => void poll(), intervalMs)
}
