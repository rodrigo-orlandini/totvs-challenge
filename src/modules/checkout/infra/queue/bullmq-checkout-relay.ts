import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import type { ICheckoutOutboxRepository } from '../../repositories/checkout-outbox-repository'
import { logger } from '@shared/observability/logger'

interface CheckoutJobPayload {
  orderId: string
}

export class BullMQCheckoutRelay {
  private timer: NodeJS.Timeout | null = null
  readonly queue: Queue<CheckoutJobPayload>

  constructor(
    private readonly outboxRepository: ICheckoutOutboxRepository,
    redisConnection: Redis,
    private readonly intervalMs: number = Number(process.env.CHECKOUT_RELAY_INTERVAL_MS ?? 5000),
  ) {
    this.queue = new Queue<CheckoutJobPayload>('checkout-processing', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
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
    try {
      const pending = await this.outboxRepository.findPending()
      if (pending.length === 0) return

      await Promise.all(
        pending.map(entry =>
          this.queue.add('checkout', { orderId: entry.orderId }, { jobId: entry.id }),
        ),
      )

      await Promise.all(pending.map(entry => this.outboxRepository.markEnqueued(entry.id)))
      logger.info({ count: pending.length }, 'checkout.relay.batch')
    } catch (err) {
      logger.error({ err }, 'checkout.relay.batch.error')
    }
  }
}
