import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { trace, context as otelContext, propagation, SpanStatusCode, ROOT_CONTEXT } from '@opentelemetry/api'

let _sdk: NodeSDK | null = null

export function initTracer(): void {
  const exporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter({
        url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
      })
    : new ConsoleSpanExporter()

  _sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'casecellshop',
      [ATTR_SERVICE_VERSION]: '1.0.0',
    }),
    traceExporter: exporter,
  })

  _sdk.start()
}

export async function shutdownTracer(): Promise<void> {
  await _sdk?.shutdown()
}

export { trace, otelContext, propagation, SpanStatusCode, ROOT_CONTEXT }
export const tracer = trace.getTracer('casecellshop', '1.0.0')
