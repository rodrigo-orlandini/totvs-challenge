# Observabilidade — Design Spec

## Objetivo

Instrumentar o CaseCellShop com observabilidade de produção: logs estruturados com propagação de contexto, métricas de negócio e infraestrutura via Prometheus, rastreamento distribuído real ligando request HTTP → use case → cache → worker BullMQ, e stack local completa (Prometheus + Grafana + Loki + Tempo) sem dependência de serviço externo.

## Arquitetura

### Camadas de observabilidade

```
HTTP Request
  │  onRequest: ALS.run({correlationId}) + tracer.startSpan('http.request')
  ▼
Use Case (CreateCheckout)
  │  tracer.startSpan('checkout.create', {attributes: {order.id, items.count}})
  │  metrics.checkoutCreated.inc()
  ▼
ProductCacheService.getProduct()
  │  tracer.startSpan('cache.get', {attributes: {cache.key, cache.result}})
  │  metrics.cacheHits.inc({layer}) ou metrics.cacheMisses.inc()
  ▼
BullMQ Job (call stack separado, contexto propagado via job.data)
  │  propagation.extract(ROOT_CONTEXT, job.data) → context.with(ctx, ...)
  │  tracer.startSpan('checkout.process.job', {attributes: {order.id, job.id}})
  │  metrics.checkoutConfirmed.inc() ou checkoutFailed.inc()
```

### Propagação de contexto

Dois mecanismos paralelos, responsabilidades distintas:

**AsyncLocalStorage** (`src/shared/observability/context.ts`):
- Armazena `{correlationId: string, orderId?: string}` — contexto de negócio
- HTTP: `ALS.run()` no `onRequest` hook
- Worker: `ALS.run()` no início do processamento do job
- Relay: `ALS.run()` no loop de poll (sem span ativo)
- `getLogger()` lê ALS e retorna `logger.child(store)` — todos os logs incluem `correlationId`/`orderId` automaticamente

**OTel context** (`@opentelemetry/api`):
- Armazena `traceId`/`spanId` — contexto de trace
- Propagado entre HTTP e Worker via W3C TraceContext em `job.data`
- Relay injeta: `propagation.inject(context.active(), jobData)`
- Worker extrai: `const ctx = propagation.extract(ROOT_CONTEXT, job.data)`
- `getLogger()` também lê `trace.getActiveSpan()` e inclui `traceId`/`spanId` nos logs

## Tech Stack

| Dependência | Versão | Papel |
|---|---|---|
| `@opentelemetry/sdk-node` | ^0.52 | SDK de trace + inicialização |
| `@opentelemetry/api` | ^1.9 | API de span/context (usada nos módulos) |
| `@opentelemetry/exporter-trace-otlp-http` | ^0.52 | Exporta traces para Tempo via OTLP HTTP |
| `@opentelemetry/resources` | ^1.25 | `service.name`, `service.version` |
| `@opentelemetry/semantic-conventions` | ^1.25 | Atributos semânticos padronizados |
| `prom-client` | ^15 | Métricas Prometheus |
| `pino` | ^9 (já existe) | Logger estruturado |

**Stack local (Docker):**
- `grafana/prometheus` — scrape de `/metrics`
- `grafana/grafana` — dashboards, alertas
- `grafana/loki` — log aggregation
- `grafana/promtail` — coleta stdout JSON → Loki
- `grafana/tempo` — backend de trace, OTLP HTTP em `:4318`

## Arquivos

### Criados

| Arquivo | Responsabilidade |
|---|---|
| `src/shared/observability/context.ts` | `AsyncLocalStorage<ObsContext>`; `runWithContext()`; `getContext()` |
| `src/shared/observability/metrics.ts` | Registry `prom-client`; todas as métricas exportadas |
| `docker-compose.observability.yml` | Stack Prometheus + Grafana + Loki + Promtail + Tempo |
| `prometheus.yml` | Scrape config: `http://host.docker.internal:3000/metrics` a cada 15s |
| `grafana/provisioning/datasources/prometheus.yml` | Datasource Prometheus |
| `grafana/provisioning/datasources/loki.yml` | Datasource Loki com `derivedField` traceId → Tempo |
| `grafana/provisioning/datasources/tempo.yml` | Datasource Tempo |
| `grafana/provisioning/dashboards/casecellshop.json` | Dashboard provisionado |
| `docs/observability.md` | Runbook completo |

### Modificados

| Arquivo | Mudança |
|---|---|
| `src/shared/observability/tracer.ts` | OTel SDK real; `NodeSDK` init; `OTLPTraceExporter`; fallback `ConsoleSpanExporter`; exporta `tracer = trace.getTracer('casecellshop')` |
| `src/shared/observability/logger.ts` | `getLogger()` retorna `pino.child({...als.getStore(), traceId, spanId})`; mantém `logger` como default export para compatibilidade |
| `src/infra/http/server.ts` | `onRequest`: `runWithContext()` + `startSpan('http.request')`; `onResponse`: `span.end()`; rota `GET /metrics` |
| `src/modules/catalog/cache/product-cache-service.ts` | `metrics.cacheHit.inc({layer})` / `metrics.cacheMiss.inc()` nos pontos de hit/miss; `tracer.startSpan('cache.get')` |
| `src/modules/checkout/use-cases/create-checkout/create-checkout.ts` | `tracer.startSpan('checkout.create')`; `metrics.checkoutCreated.inc()` |
| `src/modules/checkout/infra/queue/bullmq-checkout-relay.ts` | `propagation.inject(context.active(), jobData)` antes de enfileirar |
| `src/modules/checkout/infra/queue/bullmq-checkout-worker.ts` | `propagation.extract()` + `context.with()`; `runWithContext({correlationId, orderId})`; `startSpan('checkout.process.job')`; metrics confirmed/failed |
| `src/main.ts` | `initTracer()` antes de qualquer outro import (SDK deve iniciar primeiro) |
| `vitest.coverage.ts` | Excluir `metrics.ts`, `context.ts` dos thresholds |

## Spans

### `http.request`
```typescript
attributes: {
  'http.method': request.method,
  'http.url': request.url,
  'http.status_code': reply.statusCode,  // setado no onResponse
  'correlation.id': correlationId,
}
```

### `checkout.create`
```typescript
attributes: {
  'order.id': order.id,
  'customer.id': input.customerId,
  'checkout.items_count': input.items.length,
}
```

### `cache.get`
```typescript
attributes: {
  'cache.key': `product:${id}`,
  'cache.result': 'l1_hit' | 'l2_hit' | 'miss',
  'cache.layer': 'l1' | 'l2',
}
```

### `checkout.process.job`
```typescript
attributes: {
  'order.id': input.orderId,
  'messaging.bullmq.job_id': job.id,
  'messaging.bullmq.attempts': order.attempts,
}
```

## Métricas

### Cache
| Nome | Tipo | Labels |
|---|---|---|
| `cache_hits_total` | Counter | `layer` (l1/l2) |
| `cache_misses_total` | Counter | — |
| `cache_evictions_total` | Counter | — |
| `cache_operation_duration_ms` | Histogram | `operation` (get/set) |

### Checkout
| Nome | Tipo | Labels |
|---|---|---|
| `checkout_orders_created_total` | Counter | — |
| `checkout_orders_confirmed_total` | Counter | — |
| `checkout_orders_failed_total` | Counter | `permanent` (true/false) |
| `checkout_job_duration_ms` | Histogram | — |

### Relay
| Nome | Tipo | Labels |
|---|---|---|
| `checkout_relay_cycles_total` | Counter | — |
| `checkout_relay_enqueued_total` | Counter | — |

## Configuração por ambiente

| Variável | Dev (sem Docker) | Dev (com Docker obs) | Produção |
|---|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | não definida → ConsoleSpanExporter | `http://localhost:4318` | `http://datadog-agent:4318` |
| `OTEL_SERVICE_NAME` | `casecellshop` | `casecellshop` | `casecellshop` |
| `LOG_LEVEL` | `debug` | `debug` | `info` |

`main.ts` inicializa SDK: se `OTEL_EXPORTER_OTLP_ENDPOINT` não definido, usa `ConsoleSpanExporter` — app não crasha sem Tempo rodando.

## Dashboard Grafana (provisionado)

Painéis incluídos em `casecellshop.json`:
1. **Cache Hit Rate** — `rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))` por layer
2. **Checkout Funnel** — created → confirmed → failed (série temporal)
3. **Job Duration p50/p95/p99** — histogram percentiles
4. **Últimos erros** — Loki query `{app="casecellshop"} | json | level="error" | line_format "{{.msg}} orderId={{.orderId}}"`
5. **Trace Explorer link** — campo `traceId` nos logs clicável → abre Tempo

## Alerta exemplo

```yaml
# Grafana alert rule
expr: |
  rate(cache_hits_total{layer="l1"}[5m]) /
  (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) < 0.70
for: 5m
labels:
  severity: warning
annotations:
  summary: "L1 cache hit rate abaixo de 70%"
  description: "Hit rate atual: {{ $value | humanizePercentage }}. Verificar TTL e tamanho do L1."
```

## Runbook (resumo)

1. **Checkout travado (status PROCESSING por >5min):**
   - Grafana Loki: `{app="casecellshop"} | json | orderId="<id>"`
   - Copiar `traceId` do primeiro log → Tempo → ver onde o span parou
   - Verificar BullBoard `/admin/queues` para estado do job

2. **Cache hit rate baixo:**
   - Verificar painel "Cache Hit Rate" — qual layer está falhando
   - Loki: `{app="casecellshop"} | json | msg="cache.miss"` — volume por período
   - Checar se Redis está respondendo: `redis-cli ping`

3. **Produção com Datadog:**
   - Instalar Datadog Agent com `otlp_config.receiver.protocols.http.endpoint: 0.0.0.0:4318`
   - Definir `OTEL_EXPORTER_OTLP_ENDPOINT=http://datadog-agent:4318`
   - Logs pino (JSON em stdout) coletados via Datadog Agent log collection
   - Métricas: configurar `openmetrics_check` apontando para `/metrics` da app
