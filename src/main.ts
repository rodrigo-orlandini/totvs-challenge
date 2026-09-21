import 'reflect-metadata'
import { registerSharedInfra } from '@shared/container'
import { registerCatalogModule } from '@modules/catalog/container'
import { registerErpAdapterModule } from '@modules/erp-adapter/container'
import { registerCheckoutModule } from '@modules/checkout/container'
import { buildApp } from '@infra/http/server'
import { BullMQRelay } from '@modules/erp-adapter/infra/queue/bullmq-relay'
import { BullMQSyncWorker } from '@modules/erp-adapter/infra/queue/bullmq-sync-worker'
import { ErpScheduler } from '@modules/erp-adapter/infra/scheduler/erp-scheduler'
import { CacheRefreshScheduler } from '@modules/catalog/cache/cache-refresh-scheduler'
import { BullMQCheckoutRelay } from '@modules/checkout/infra/queue/bullmq-checkout-relay'
import { BullMQCheckoutWorker } from '@modules/checkout/infra/queue/bullmq-checkout-worker'
import { container } from 'tsyringe'
import Redis from 'ioredis'

async function bootstrap(): Promise<void> {
  const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
  const redis = new Redis({ host: redisUrl.hostname, port: Number(redisUrl.port) || 6379, maxRetriesPerRequest: null })

  registerSharedInfra()
  registerCatalogModule(redis)
  registerErpAdapterModule(redis)
  registerCheckoutModule(redis)

  const app = await buildApp(redis)
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })

  const relay = container.resolve(BullMQRelay)
  const worker = container.resolve(BullMQSyncWorker)
  const erpScheduler = container.resolve(ErpScheduler)
  const cacheScheduler = container.resolve(CacheRefreshScheduler)

  relay.start()
  worker.start()
  erpScheduler.start()
  cacheScheduler.start()

  const checkoutRelay = container.resolve(BullMQCheckoutRelay)
  const checkoutWorker = container.resolve(BullMQCheckoutWorker)
  checkoutRelay.start()
  checkoutWorker.start()
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
