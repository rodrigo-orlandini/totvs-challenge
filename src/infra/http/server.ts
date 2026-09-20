import * as FastifyModule from 'fastify'
import type { FastifyInstance } from 'fastify/types/instance'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { container } from 'tsyringe'
import { ProductController } from '@modules/catalog/infra/http/product-controller'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter as BullBoardFastifyAdapter } from '@bull-board/fastify'
import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'

export async function buildApp(redis: Redis): Promise<FastifyInstance> {
  const app = FastifyModule.fastify({
    genReqId: () => randomUUID(),
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  })

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ?? request.id
    request.correlationId = correlationId
    void reply.header('x-correlation-id', correlationId)
    request.log.info(
      { correlationId, method: request.method, url: request.url },
      'incoming request',
    )
  })

  const productController = container.resolve(ProductController)
  await productController.registerRoutes(app)

  const erpSyncQueue = new Queue('erp-sync', { connection: redis })
  const serverAdapter = new BullBoardFastifyAdapter()
  serverAdapter.setBasePath('/admin/queues')
  createBullBoard({ queues: [new BullMQAdapter(erpSyncQueue)], serverAdapter })
  await app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' })

  return app
}
