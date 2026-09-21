import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { ProcessCheckoutJobUseCase } from '../../use-cases/process-checkout-job/process-checkout-job'
import type { ICheckoutOutboxRepository } from '../../repositories/checkout-outbox-repository'
import type { IOrderRepository } from '../../repositories/order-repository'
import { OrderStatus } from '../../domain/value-objects/order-status'
import { getLogger } from '@shared/observability/logger'
import { tracer, SpanStatusCode } from '@shared/observability/tracer'
import { enterContext } from '@shared/observability/context'
import { metrics } from '@shared/observability/metrics'

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
        enterContext({ correlationId: job.id ?? orderId, orderId })

        return tracer.startActiveSpan('checkout.process.job', {
          attributes: {
            'order.id': orderId,
            'messaging.bullmq.job_id': job.id ?? '',
            'messaging.bullmq.attempts': job.attemptsMade,
          },
        }, async (span) => {
          const log = getLogger()
          const jobStart = Date.now()
          try {
            log.debug({ jobId: job.id, orderId, attempt: job.attemptsMade }, 'checkout.job.start')

            const order = await this.orderRepository.findById(orderId)
            if (order) {
              await this.orderRepository.updateStatus(orderId, OrderStatus.PROCESSING)
            }

            await delay(1000)
            await delay(1000)
            await delay(1000)

            const result = await this.processUseCase.execute({ orderId })
            if (result.isFailure()) throw new Error(result.value.message)

            if (job.id) await this.outboxRepository.markProcessed(job.id)

            metrics.checkoutConfirmed.inc()
            metrics.checkoutJobDuration.observe(Date.now() - jobStart)
            span.setStatus({ code: SpanStatusCode.OK })
            log.info({ jobId: job.id, orderId }, 'checkout.job.confirmed')
          } catch (err) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message })
            throw err
          } finally {
            span.end()
          }
        })
      },
      { connection: this.redisConnection },
    )

    this.worker.on('failed', async (job, err) => {
      if (!job) return
      const log = getLogger()
      const maxAttempts = Number(job.opts.attempts ?? 3)
      if (job.attemptsMade >= maxAttempts) {
        const { orderId } = job.data
        await this.processUseCase.handleFinalFailure(orderId, err.message)
        if (job.id) await this.outboxRepository.markDead(job.id, err.message)
        metrics.checkoutFailed.inc({ permanent: 'true' })
        log.error(
          { jobId: job.id, orderId, totalAttempts: job.attemptsMade, finalError: err.message },
          'checkout.job.dead',
        )
      } else {
        await this.orderRepository.updateStatus(job.data.orderId, OrderStatus.FAILED, {
          lastError: err.message,
        })
        metrics.checkoutFailed.inc({ permanent: 'false' })
        log.warn(
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
