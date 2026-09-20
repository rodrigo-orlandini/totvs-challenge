import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import type { IOutboxRepository } from '../../repositories/outbox-repository'
import { logger } from '@shared/observability/logger'
import { tracer } from '@shared/observability/tracer'

export class BullMQRelay {
  private timer: NodeJS.Timeout | null = null
  readonly queue: Queue

  constructor(
    private readonly outboxRepository: IOutboxRepository,
    redisConnection: Redis,
    private readonly intervalMs: number = Number(process.env.RELAY_INTERVAL_MS ?? 1500),
  ) {
    this.queue = new Queue('erp-sync', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: Number(process.env.SYNC_JOB_ATTEMPTS ?? 5),
        backoff: { type: 'exponential', delay: Number(process.env.SYNC_JOB_BACKOFF_DELAY_MS ?? 1000) },
        removeOnComplete: { count: 1000 },
        removeOnFail: false,
      },
    })
  }

  start(): void {
    this.timer = setInterval(() => void this.relayBatch(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private async relayBatch(): Promise<void> {
    const span = tracer.startSpan('erp.relay.enqueue')
    const start = Date.now()
    try {
      const pending = await this.outboxRepository.findPending(50)
      if (pending.length === 0) return

      await Promise.all(
        pending.map(entry =>
          this.queue.add(
            `${entry.entity}:${entry.erpId}`,
            { entity: entry.entity, erpId: entry.erpId, payload: entry.payload, correlationId: entry.id },
            { jobId: entry.id },
          )
        )
      )

      await this.outboxRepository.markEnqueued(pending.map(e => e.id))
      logger.info({ count: pending.length, durationMs: Date.now() - start }, 'erp.relay.batch')
    } finally {
      span.end()
    }
  }
}
