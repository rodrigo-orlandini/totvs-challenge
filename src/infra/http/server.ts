import * as FastifyModule from 'fastify'
import type { FastifyInstance } from 'fastify/types/instance'
import type { FastifyRequest, FastifyReply } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { randomUUID } from 'node:crypto'
import { container } from 'tsyringe'
import { ProductController } from '@modules/catalog/infra/http/product-controller'
import { CheckoutController } from '@modules/checkout/infra/http/checkout-controller'
import { OrderStatusController } from '@modules/checkout/infra/http/order-status-controller'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter as BullBoardFastifyAdapter } from '@bull-board/fastify'
import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import { tracer, SpanStatusCode, otelContext } from '@shared/observability/tracer'
import { trace } from '@opentelemetry/api'
import { enterContext } from '@shared/observability/context'
import { register } from '@shared/observability/metrics'

export async function buildApp(redis: Redis): Promise<FastifyInstance> {
  const app = FastifyModule.fastify({
    genReqId: () => randomUUID(),
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'CaseCellShop API',
        description: 'API da vitrine de produtos CaseCellShop',
        version: '1.0.0',
      },
      tags: [
        { name: 'Products', description: 'Vitrine de produtos' },
        { name: 'Checkout', description: 'Fluxo de compra assíncrono' },
        { name: 'Orders', description: 'Consulta de pedidos' },
      ],
    },
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
    },
  })

  app.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ?? request.id
    request.correlationId = correlationId
    void reply.header('x-correlation-id', correlationId)

    enterContext({ correlationId })

    const span = tracer.startSpan('http.request', {
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'correlation.id': correlationId,
      },
    })
    request.span = span

    request.log.info(
      { correlationId, method: request.method, url: request.url },
      'incoming request',
    )

    otelContext.with(trace.setSpan(otelContext.active(), span), done)
  })

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    request.span?.setAttribute('http.status_code', reply.statusCode)
    if (reply.statusCode >= 500) {
      request.span?.setStatus({ code: SpanStatusCode.ERROR })
    }
    request.span?.end()
  })

  app.get('/metrics', async (_request, reply) => {
    reply.header('content-type', register.contentType)
    return register.metrics()
  })

  const productController = container.resolve(ProductController)
  await productController.registerRoutes(app)

  const checkoutController = container.resolve(CheckoutController)
  const orderStatusController = container.resolve(OrderStatusController)
  await checkoutController.registerRoutes(app)
  await orderStatusController.registerRoutes(app)

  const erpSyncQueue = new Queue('erp-sync', { connection: redis })
  const serverAdapter = new BullBoardFastifyAdapter()
  serverAdapter.setBasePath('/admin/queues')
  const checkoutQueue = new Queue('checkout-processing', { connection: redis })
  createBullBoard({ queues: [new BullMQAdapter(erpSyncQueue), new BullMQAdapter(checkoutQueue)], serverAdapter })
  await app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' })

  return app
}
