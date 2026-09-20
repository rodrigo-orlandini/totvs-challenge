import 'reflect-metadata'
import { isMainThread } from 'node:worker_threads'
import { PrismaClient } from '@prisma/client'
import { PrismaOutboxRepository } from '../persistence/prisma-outbox-repository'
import { PrismaSyncCursorRepository } from '../persistence/prisma-sync-cursor-repository'
import { PrismaErpStockFlowRepository } from '../persistence/prisma-erp-stock-flow-repository'
import { PollErpStockFlowsUseCase } from '../../use-cases/poll-erp-stock-flows/poll-erp-stock-flows'
import { logger } from '@shared/observability/logger'
import { tracer } from '@shared/observability/tracer'

if (!isMainThread) {
  const intervalMs = Number(process.env.POLL_INTERVAL_STOCK_FLOWS_MS ?? 5000)
  const prisma = new PrismaClient()
  const erpPrisma = new PrismaClient({ datasources: { db: { url: process.env.ERP_DATABASE_URL } } })

  const outboxRepo = new PrismaOutboxRepository(prisma)
  const cursorRepo = new PrismaSyncCursorRepository(prisma)
  const erpStockFlowRepo = new PrismaErpStockFlowRepository(erpPrisma)
  const useCase = new PollErpStockFlowsUseCase(erpStockFlowRepo, outboxRepo, cursorRepo)

  const poll = async () => {
    const span = tracer.startSpan('erp.poll.stock_flow')
    const start = Date.now()
    try {
      const result = await useCase.execute({})
      if (result.isSuccess()) {
        logger.debug({ entity: 'stock_flow', detected: result.value.detected, durationMs: Date.now() - start }, 'erp.poll.cycle')
      }
    } catch (err) {
      logger.error({ entity: 'stock_flow', error: (err as Error).message }, 'erp.poll.error')
    } finally {
      span.end()
    }
  }

  void poll()
  setInterval(() => void poll(), intervalMs)
}
