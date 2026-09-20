import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { BullMQRelay } from './bullmq-relay'
import { InMemoryOutboxRepository } from '../../use-cases/in-memory-outbox-repository'

const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6380')
const redis = new Redis({ host: redisUrl.hostname, port: Number(redisUrl.port) || 6380, maxRetriesPerRequest: null })
const testQueue = new Queue('erp-sync-test', { connection: redis })

afterAll(async () => {
  await testQueue.obliterate({ force: true })
  await redis.quit()
})

describe('BullMQRelay', () => {
  let outboxRepo: InMemoryOutboxRepository

  beforeEach(async () => {
    outboxRepo = new InMemoryOutboxRepository()
    await testQueue.obliterate({ force: true })
  })

  it('enqueues PENDING outbox entries and marks them ENQUEUED', async () => {
    await outboxRepo.writeProducts([{ id: 'erp-1', sku: 'SKU-001', name: 'Capa', price: 49.9, updatedAt: new Date() }])

    const relay = new BullMQRelay(outboxRepo, redis, 100, 'erp-sync-test')

    relay.start()
    await new Promise(resolve => setTimeout(resolve, 300))
    relay.stop()

    const jobs = await testQueue.getJobs(['waiting', 'active', 'completed'])
    expect(jobs.length).toBeGreaterThanOrEqual(1)
    const enqueued = outboxRepo.entries.filter(e => e.status === 'ENQUEUED')
    expect(enqueued).toHaveLength(1)
  })
})
