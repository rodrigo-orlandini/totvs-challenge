import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { ProcessCheckoutJobUseCase } from '../../use-cases/process-checkout-job/process-checkout-job'
import type { ICheckoutOutboxRepository } from '../../repositories/checkout-outbox-repository'
import type { IOrderRepository } from '../../repositories/order-repository'
import { OrderStatus } from '../../domain/value-objects/order-status'
import { logger } from '@shared/observability/logger'

interface CheckoutJobPayload {
  orderId: string
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export class BullMQCheckoutWorker {
  private worker: Worker | null = null

  constructor(
    private readonly processUseCase: ProcessCheckoutJobUseCase,
    private readonly outboxRepository: ICheckoutOutboxRepository,
    private readonly orderRepository: IOrderRepository,
    private readonly redisConnection: Redis,
  ) {}

  start(): void {
    this.worker = new Worker<CheckoutJobPayload>(
      'checkout-processing',
      async (job) => {
        const { orderId } = job.data
        logger.debug({ jobId: job.id, orderId, attempt: job.attemptsMade }, 'checkout.job.start')

        // Increment attempts + set PROCESSING before ERP simulation
        const order = await this.orderRepository.findById(orderId)
        if (order) {
          await this.orderRepository.updateStatus(orderId, OrderStatus.PROCESSING, {
            attempts: (order.attempts ?? 0) + 1,
          })
        }

        // Mock ERP simulation with delays
        await delay(1000) // step 1: ERP validation
        await delay(1000) // step 2: ERP reservation
        await delay(1000) // step 3: ERP billing

        const result = await this.processUseCase.execute({ orderId })
        if (result.isFailure()) throw new Error(result.value.message)

        // Mark outbox PROCESSED
        const outbox = await this.outboxRepository.findPending()
        const entry = outbox.find(e => e.orderId === orderId)
        if (entry) await this.outboxRepository.markProcessed(entry.id)

        logger.info({ jobId: job.id, orderId }, 'checkout.job.confirmed')
      },
      { connection: this.redisConnection },
    )

    this.worker.on('failed', async (job, err) => {
      if (!job) return
      const maxAttempts = Number(job.opts.attempts ?? 3)
      if (job.attemptsMade >= maxAttempts) {
        const { orderId } = job.data
        await this.processUseCase.handleFinalFailure(orderId, err.message)

        // Mark outbox DEAD — fetch outbox entry by orderId
        // Use findPending filtered by orderId; ENQUEUED entries won't show in pending
        // Fetch from DB directly via outbox repo is safer:
        // For simplicity, markDead is called with the job ID as the outbox ID
        // (jobId == outbox entry id, set in relay via { jobId: entry.id })
        if (job.id) await this.outboxRepository.markDead(job.id, err.message)

        logger.error(
          { jobId: job.id, orderId, totalAttempts: job.attemptsMade, finalError: err.message },
          'checkout.job.dead',
        )
      } else {
        logger.warn(
          { jobId: job.id, orderId: job.data.orderId, attempt: job.attemptsMade, error: err.message },
          'checkout.job.retry',
        )
      }
    })
  }

  async stop(): Promise<void> {
    await this.worker?.close()
  }
}
