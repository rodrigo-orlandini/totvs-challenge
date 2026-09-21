import { injectable, inject } from 'tsyringe'
import type { FastifyInstance } from 'fastify/types/instance'
import { GetOrderStatusUseCase } from '../../use-cases/get-order-status/get-order-status'
import { toHttpError } from '@shared/errors/http-error-mapper'

interface OrderStatusParams {
  orderId: string
}

@injectable()
export class OrderStatusController {
  constructor(
    @inject(GetOrderStatusUseCase) private readonly getOrderStatus: GetOrderStatusUseCase,
  ) {}

  async registerRoutes(app: FastifyInstance): Promise<void> {
    app.get<{ Params: OrderStatusParams }>(
      '/orders/:orderId/status',
      {
        schema: {
          tags: ['Orders'],
          summary: 'Consultar status do pedido',
          params: {
            type: 'object',
            properties: { orderId: { type: 'string', format: 'uuid' } },
            required: ['orderId'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                orderId: { type: 'string' },
                status: { type: 'string' },
                attempts: { type: 'integer' },
                lastError: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
            404: {
              type: 'object',
              properties: {
                statusCode: { type: 'integer' },
                error: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      async (request, reply) => {
        const result = await this.getOrderStatus.execute({ orderId: request.params.orderId })

        if (result.isFailure()) {
          const err = toHttpError(result.value)
          return reply.status(err.statusCode).send(err)
        }

        return reply.send(result.value)
      },
    )
  }
}
