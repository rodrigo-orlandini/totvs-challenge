import { injectable, inject } from 'tsyringe'
import type { FastifyInstance } from 'fastify/types/instance'
import { ListProductsUseCase } from '../../use-cases/list-products/list-products'
import { ProductPresenter } from '../../presenters/product-presenter'
import { toHttpError } from '@shared/errors/http-error-mapper'
import { tracer } from '@shared/observability/tracer'

interface ListProductsQuery {
  page?: number
  limit?: number
}

const listProductsSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
}

@injectable()
export class ProductController {
  constructor(
    @inject(ListProductsUseCase) private readonly listProductsUseCase: ListProductsUseCase,
  ) {}

  async registerRoutes(app: FastifyInstance): Promise<void> {
    app.get<{ Querystring: ListProductsQuery }>(
      '/products',
      { schema: listProductsSchema },
      async (request, reply) => {
        const { page, limit } = request.query
        const span = tracer.startSpan('GET /products')
        span.setAttribute('http.page', page ?? 1)
        span.setAttribute('http.limit', limit ?? 20)

        try {
          const result = await this.listProductsUseCase.execute({ page, limit })

          if (result.isFailure()) {
            const err = toHttpError(result.value)
            request.log.error(
              { correlationId: request.correlationId, error: err },
              'list-products failed',
            )
            return reply.status(err.statusCode).send(err)
          }

          request.log.info(
            { correlationId: request.correlationId, total: result.value.meta.total },
            'list-products ok',
          )
          return reply.send(ProductPresenter.toHTTP(result.value))
        } finally {
          span.end()
        }
      },
    )
  }
}
