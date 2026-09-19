import * as FastifyModule from 'fastify'
import type { FastifyInstance } from 'fastify/types/instance'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { container } from 'tsyringe'
import { ProductController } from '@modules/catalog/infra/http/product-controller'

export async function buildApp(): Promise<FastifyInstance> {
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

  return app
}
