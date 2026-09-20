import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { BullMQRelay } from './bullmq-relay'
import { InMemoryOutboxRepository } from '../../use-cases/in-memory-outbox-repository'

const redis = new Redis({ host: 'localhost', port: 6379, maxRetriesPerRequest: null })
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

    const relay = new BullMQRelay(outboxRepo, redis, 100)
    // override queue name for test isolation
    Object.defineProperty(relay.queue, 'name', { value: 'erp-sync-test', writable: false })

    relay.start()
    await new Promise(resolve => setTimeout(resolve, 300))
    relay.stop()

    const jobs = await testQueue.getJobs(['waiting', 'active', 'completed'])
    expect(jobs.length).toBeGreaterThanOrEqual(1)
    const enqueued = outboxRepo.entries.filter(e => e.status === 'ENQUEUED')
    expect(enqueued).toHaveLength(1)
  })
})
