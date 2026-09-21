import { injectable, inject } from 'tsyringe'
import type { FastifyInstance } from 'fastify/types/instance'
import { CreateCheckoutUseCase } from '../../use-cases/create-checkout/create-checkout'
import { toHttpError } from '@shared/errors/http-error-mapper'

interface CheckoutBody {
  customerId: string
  correlationId?: string
  items: Array<{ productId: string; quantity: number }>
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

@injectable()
export class CheckoutController {
  constructor(
    @inject(CreateCheckoutUseCase) private readonly createCheckout: CreateCheckoutUseCase,
  ) {}

  async registerRoutes(app: FastifyInstance): Promise<void> {
    app.post<{ Body: CheckoutBody }>(
      '/checkout',
      {
        schema: {
          tags: ['Checkout'],
          summary: 'Iniciar checkout assíncrono',
          description: 'Reserva estoque e registra pedido. Retorna 202 imediatamente sem aguardar faturamento.',
          headers: {
            type: 'object',
            properties: {
              'idempotency-key': { type: 'string', description: 'UUID obrigatório para idempotência' },
            },
            required: ['idempotency-key'],
          },
          body: {
            type: 'object',
            properties: {
              customerId: { type: 'string' },
              correlationId: { type: 'string' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string' },
                    quantity: { type: 'integer', minimum: 1 },
                  },
                  required: ['productId', 'quantity'],
                },
                minItems: 1,
              },
            },
            required: ['customerId', 'items'],
          },
          response: {
            202: {
              type: 'object',
              properties: {
                orderId: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      async (request, reply) => {
        const idempotencyKey = request.headers['idempotency-key'] as string | undefined
        if (!idempotencyKey || !UUID_REGEX.test(idempotencyKey)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'Header Idempotency-Key must be a valid UUID',
          })
        }

        const result = await this.createCheckout.execute({
          idempotencyKey,
          customerId: request.body.customerId,
          correlationId: request.body.correlationId,
          items: request.body.items,
        })

        if (result.isFailure()) {
          const err = toHttpError(result.value)
          return reply.status(err.statusCode).send(err)
        }

        return reply.status(202).send(result.value)
      },
    )
  }
}
