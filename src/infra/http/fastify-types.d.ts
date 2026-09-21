import 'fastify'
import type { Span } from '@opentelemetry/api'

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string
    span?: Span
  }
}
