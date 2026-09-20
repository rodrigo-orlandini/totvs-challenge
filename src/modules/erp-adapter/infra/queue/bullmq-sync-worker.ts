import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { ProcessSyncJobUseCase } from '../../use-cases/process-sync-job/process-sync-job'
import type { IOutboxRepository } from '../../repositories/outbox-repository'
import { logger } from '@shared/observability/logger'

export class BullMQSyncWorker {
  private worker: Worker | null = null

  constructor(
    private readonly processUseCase: ProcessSyncJobUseCase,
    private readonly outboxRepository: IOutboxRepository,
    private readonly redisConnection: Redis,
  ) {}

  start(): void {
    this.worker = new Worker(
      'erp-sync',
      async (job) => {
        const { entity, erpId, payload, correlationId } = job.data
        logger.debug({ jobId: job.id, entity, erpId, attempt: job.attemptsMade }, 'erp.sync.job.start')
        const result = await this.processUseCase.execute({ entity, erpId, payload, correlationId })
        if (result.isFailure()) throw new Error(result.value.message)
      },
      { connection: this.redisConnection },
    )

    this.worker.on('failed', async (job, err) => {
      if (!job) return
      const maxAttempts = Number(job.opts.attempts ?? 5)
      if (job.attemptsMade >= maxAttempts) {
        await this.outboxRepository.markDead(job.data.entity, job.data.erpId, err.message, job.attemptsMade)
        logger.error(
          { jobId: job.id, entity: job.data.entity, erpId: job.data.erpId, totalAttempts: job.attemptsMade, finalError: err.message },
          'erp.sync.dead',
        )
      } else {
        logger.warn(
          { jobId: job.id, entity: job.data.entity, erpId: job.data.erpId, attempt: job.attemptsMade, error: err.message },
          'erp.sync.job.retry',
        )
      }
    })
  }

  async stop(): Promise<void> {
    await this.worker?.close()
  }
}
