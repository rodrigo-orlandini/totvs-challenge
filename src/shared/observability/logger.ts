import pino from 'pino'
import { trace } from '@opentelemetry/api'
import { getContext } from './context'

const _base = pino({ level: process.env.LOG_LEVEL ?? 'info' })

export const logger = _base

export function getLogger(): pino.Logger {
  const ctx = getContext()
  const span = trace.getActiveSpan()
  const spanCtx = span?.spanContext()
  return _base.child({
    ...(ctx ?? {}),
    ...(spanCtx?.traceId ? { traceId: spanCtx.traceId, spanId: spanCtx.spanId } : {}),
  })
}
