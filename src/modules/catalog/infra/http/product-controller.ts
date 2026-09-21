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

const productSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', description: 'ID do produto' },
    sku: { type: 'string', description: 'Código SKU do produto' },
    name: { type: 'string', description: 'Nome do produto' },
    price: { type: 'number', description: 'Preço em reais' },
    availableQuantity: { type: 'integer', description: 'Quantidade disponível em estoque' },
  },
  required: ['id', 'sku', 'name', 'price', 'availableQuantity'],
}

const listProductsSchema = {
  tags: ['Products'],
  summary: 'Listar produtos da vitrine',
  description: 'Retorna lista paginada de produtos ordenada por data de criação (mais recentes primeiro). Respostas servidas por cache L1 (in-process) + L2 (Redis) com fallback ao banco de dados.',
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1, description: 'Número da página (começa em 1)' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: 'Itens por página (máx. 100)' },
    },
  },
  response: {
    200: {
      description: 'Lista paginada de produtos',
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: productSchema,
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'integer', description: 'Página atual' },
            limit: { type: 'integer', description: 'Itens por página' },
            total: { type: 'integer', description: 'Total de produtos' },
            totalPages: { type: 'integer', description: 'Total de páginas' },
          },
          required: ['page', 'limit', 'total', 'totalPages'],
        },
      },
      required: ['data', 'meta'],
    },
    400: {
      description: 'Parâmetros inválidos',
      type: 'object',
      properties: {
        statusCode: { type: 'integer' },
        error: { type: 'string' },
        message: { type: 'string' },
      },
    },
    500: {
      description: 'Erro interno do servidor',
      type: 'object',
      properties: {
        statusCode: { type: 'integer' },
        error: { type: 'string' },
        message: { type: 'string' },
      },
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
