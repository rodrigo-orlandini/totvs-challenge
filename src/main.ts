import 'reflect-metadata'
import { registerCatalogModule } from '@modules/catalog/container'
import { registerErpAdapterModule } from '@modules/erp-adapter/container'
import { buildApp } from '@infra/http/server'
import { ErpScheduler } from '@modules/erp-adapter/infra/scheduler/erp-scheduler'
import { BullMQRelay } from '@modules/erp-adapter/infra/queue/bullmq-relay'
import { BullMQSyncWorker } from '@modules/erp-adapter/infra/queue/bullmq-sync-worker'
import { container } from 'tsyringe'
import Redis from 'ioredis'
import { ProcessSyncJobUseCase } from '@modules/erp-adapter/use-cases/process-sync-job/process-sync-job'
import type { IOutboxRepository } from '@modules/erp-adapter/repositories/outbox-repository'

async function bootstrap(): Promise<void> {
  registerCatalogModule()
  registerErpAdapterModule()

  const app = await buildApp()
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })

  const redis = new Redis({ host: process.env.REDIS_HOST ?? 'localhost', port: 6379, maxRetriesPerRequest: null })
  const outboxRepo = container.resolve<IOutboxRepository>('IOutboxRepository')
  const processUseCase = container.resolve(ProcessSyncJobUseCase)

  const relay = new BullMQRelay(outboxRepo, redis)
  const worker = new BullMQSyncWorker(processUseCase, outboxRepo, redis)
  const scheduler = new ErpScheduler()

  relay.start()
  worker.start()
  scheduler.start()
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
