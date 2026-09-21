# Observabilidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instrument CaseCellShop with structured logs (correlationId + orderId via AsyncLocalStorage), Prometheus metrics (prom-client), real OTel traces (4 spans), and a local Grafana+Loki+Tempo+Prometheus stack.

**Architecture:** AsyncLocalStorage propagates correlationId/orderId across the request/worker chain without manual parameter passing. OTel SDK (`@opentelemetry/sdk-node`) provides real spans exported to Tempo (OTLP HTTP) or console (no-exporter fallback). prom-client exposes `/metrics` for Prometheus scraping. HTTP span and worker span are separate root traces linked by `correlationId` attribute in logs — outbox pattern breaks the synchronous chain so W3C propagation through the relay is not feasible.

**Tech Stack:** `@opentelemetry/sdk-node`, `@opentelemetry/api`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/resources`, `@opentelemetry/semantic-conventions`, `prom-client`, Grafana, Prometheus, Loki, Promtail, Tempo (all local via Docker).

**Spec:** `docs/superpowers/specs/2026-09-21-observabilidade-design.md`

## Global Constraints

- Branch: `feat/observabilidade` (already created from `origin/main`)
- `npm run test` must pass after every task (all 80% thresholds maintained)
- `npx tsc --noEmit` must pass after every task
- New infra files (`tracer.ts`, `context.ts`, `metrics.ts`) must be excluded from coverage thresholds
- `logger` default export kept for backward compatibility — existing imports unchanged
- Spans are created manually; no OTel auto-instrumentation packages
- OTel exporter: `OTEL_EXPORTER_OTLP_ENDPOINT` env → OTLP HTTP; unset → `ConsoleSpanExporter` (app never crashes without Tempo)
- Never mention PDFs, TOTVS test, or external challenge sources in any file
- All commits end with `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

### Task 1: Install packages + refactor tracer.ts + wire initTracer in main.ts

**Files:**
- Modify: `src/shared/observability/tracer.ts` (full rewrite)
- Modify: `src/main.ts` (call `initTracer()` before `buildApp`)

**Interfaces:**
- Produces: `initTracer(): void`, `shutdownTracer(): Promise<void>`, `tracer` (OTel Tracer), re-exports `{ trace, context as otelContext, propagation, SpanStatusCode }` from `@opentelemetry/api`

- [ ] **Step 1: Install packages**

```bash
npm install @opentelemetry/sdk-node @opentelemetry/api @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions prom-client
```

- [ ] **Step 2: Rewrite `src/shared/observability/tracer.ts`**

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
import { Resource } from '@opentelemetry/resources'
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
    resource: new Resource({
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
```

- [ ] **Step 3: Modify `src/main.ts` — call `initTracer()` before anything else**

Add at the top of bootstrap(), before any other call:

```typescript
import { initTracer, shutdownTracer } from '@shared/observability/tracer'
```

Inside `bootstrap()`, first line:
```typescript
initTracer()
```

At end of bootstrap(), register graceful shutdown:
```typescript
process.on('SIGTERM', async () => {
  await shutdownTracer()
  process.exit(0)
})
```

- [ ] **Step 4: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
npx vitest run --config vitest.coverage.ts
```

Expected: all pass, coverage thresholds met.

- [ ] **Step 6: Commit**

```bash
git add src/shared/observability/tracer.ts src/main.ts package.json package-lock.json
git commit -m "feat(observability): install otel packages and wire sdk init"
```

---

### Task 2: Create context.ts (AsyncLocalStorage) + refactor logger.ts

**Files:**
- Create: `src/shared/observability/context.ts`
- Modify: `src/shared/observability/logger.ts`

**Interfaces:**
- Produces: `ObsContext { correlationId: string; orderId?: string }`, `runWithContext(ctx, fn)`, `getContext()`, `getLogger(): pino.Logger`
- Consumes: `tracer` re-export `trace` from Task 1

- [ ] **Step 1: Create `src/shared/observability/context.ts`**

```typescript
import { AsyncLocalStorage } from 'node:async_hooks'

export interface ObsContext {
  correlationId: string
  orderId?: string
}

const als = new AsyncLocalStorage<ObsContext>()

export function runWithContext<T>(ctx: ObsContext, fn: () => T): T {
  return als.run(ctx, fn)
}

export function getContext(): ObsContext | undefined {
  return als.getStore()
}

export function enterContext(ctx: ObsContext): void {
  als.enterWith(ctx)
}
```

- [ ] **Step 2: Rewrite `src/shared/observability/logger.ts`**

```typescript
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
```

- [ ] **Step 3: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.coverage.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/observability/context.ts src/shared/observability/logger.ts
git commit -m "feat(observability): add AsyncLocalStorage context and getLogger with trace binding"
```

---

### Task 3: Create metrics.ts (prom-client registry)

**Files:**
- Create: `src/shared/observability/metrics.ts`

**Interfaces:**
- Produces: `register` (prom-client Registry), `metrics` object with all counters/histograms

- [ ] **Step 1: Create `src/shared/observability/metrics.ts`**

```typescript
import { Counter, Histogram, Registry } from 'prom-client'

export const register = new Registry()
register.setDefaultLabels({ service: 'casecellshop' })

export const metrics = {
  cacheHits: new Counter({
    name: 'cache_hits_total',
    help: 'Total cache hits by layer',
    labelNames: ['layer'] as const,
    registers: [register],
  }),
  cacheMisses: new Counter({
    name: 'cache_misses_total',
    help: 'Total cache misses',
    registers: [register],
  }),
  cacheEvictions: new Counter({
    name: 'cache_evictions_total',
    help: 'Total L1 LFU evictions',
    registers: [register],
  }),
  cacheOperationDuration: new Histogram({
    name: 'cache_operation_duration_ms',
    help: 'Cache operation duration in milliseconds',
    labelNames: ['operation'] as const,
    buckets: [1, 5, 10, 25, 50, 100, 250],
    registers: [register],
  }),
  checkoutCreated: new Counter({
    name: 'checkout_orders_created_total',
    help: 'Orders created via POST /checkout',
    registers: [register],
  }),
  checkoutConfirmed: new Counter({
    name: 'checkout_orders_confirmed_total',
    help: 'Orders confirmed by worker',
    registers: [register],
  }),
  checkoutFailed: new Counter({
    name: 'checkout_orders_failed_total',
    help: 'Orders that failed processing',
    labelNames: ['permanent'] as const,
    registers: [register],
  }),
  checkoutJobDuration: new Histogram({
    name: 'checkout_job_duration_ms',
    help: 'Checkout job processing duration in milliseconds',
    buckets: [100, 250, 500, 1000, 2500, 5000],
    registers: [register],
  }),
  relayCycles: new Counter({
    name: 'checkout_relay_cycles_total',
    help: 'Relay poll cycles executed',
    registers: [register],
  }),
  relayEnqueued: new Counter({
    name: 'checkout_relay_enqueued_total',
    help: 'Outbox entries enqueued by relay',
    registers: [register],
  }),
}
```

- [ ] **Step 2: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.coverage.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/shared/observability/metrics.ts
git commit -m "feat(observability): add prom-client metrics registry"
```

---

### Task 4: Instrument server.ts (span + ALS + /metrics route)

**Files:**
- Modify: `src/infra/http/server.ts`
- Modify: `src/infra/http/fastify-types.d.ts`

**Interfaces:**
- Consumes: `tracer`, `SpanStatusCode`, `otelContext` from Task 1; `enterContext` from Task 2; `register` from Task 3

- [ ] **Step 1: Extend `src/infra/http/fastify-types.d.ts`**

Add `span` to FastifyRequest:

```typescript
import 'fastify'
import type { Span } from '@opentelemetry/api'

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string
    span?: Span
  }
}
```

- [ ] **Step 2: Modify `src/infra/http/server.ts`**

Add imports at top (after existing imports):

```typescript
import { tracer, SpanStatusCode } from '@shared/observability/tracer'
import { enterContext } from '@shared/observability/context'
import { register } from '@shared/observability/metrics'
```

Replace the existing `onRequest` hook:

```typescript
app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
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
})
```

Add `onResponse` hook immediately after (before route registration):

```typescript
app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
  request.span?.setAttribute('http.status_code', reply.statusCode)
  if (reply.statusCode >= 500) {
    request.span?.setStatus({ code: SpanStatusCode.ERROR })
  }
  request.span?.end()
})
```

Add `/metrics` route before the BullBoard registration:

```typescript
app.get('/metrics', async (_request, reply) => {
  reply.header('content-type', register.contentType)
  return register.metrics()
})
```

- [ ] **Step 3: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.coverage.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/infra/http/server.ts src/infra/http/fastify-types.d.ts
git commit -m "feat(observability): instrument http.request span, ALS context, and /metrics endpoint"
```

---

### Task 5: Instrument ProductCacheService (cache.get span + metrics)

**Files:**
- Modify: `src/modules/catalog/cache/product-cache-service.ts`

**Interfaces:**
- Consumes: `tracer`, `SpanStatusCode` from Task 1; `metrics` from Task 3; `getLogger` from Task 2

- [ ] **Step 1: Modify `src/modules/catalog/cache/product-cache-service.ts`**

Replace `import { logger }` with:
```typescript
import { getLogger } from '@shared/observability/logger'
import { tracer, SpanStatusCode } from '@shared/observability/tracer'
import { metrics } from '@shared/observability/metrics'
```

Replace `evictLFU()` body to count evictions:
```typescript
private evictLFU(): void {
  let minFreq = Infinity
  let minKey = ''
  for (const [key, entry] of this.l1) {
    if (entry.frequency < minFreq) {
      minFreq = entry.frequency
      minKey = key
    }
  }
  if (minKey) {
    this.l1.delete(minKey)
    metrics.cacheEvictions.inc()
  }
}
```

Replace `getProduct()` body:
```typescript
async getProduct(id: string): Promise<ProductResponseItem | null> {
  const log = getLogger()
  const end = metrics.cacheOperationDuration.startTimer({ operation: 'get' })

  return tracer.startActiveSpan('cache.get', { attributes: { 'cache.key': `product:${id}` } }, async (span) => {
    try {
      const entry = this.l1.get(id)
      if (entry) {
        if (entry.expiresAt > Date.now()) {
          entry.frequency++
          metrics.cacheHits.inc({ layer: 'l1' })
          span.setAttribute('cache.result', 'l1_hit')
          log.debug({ id }, 'cache.l1.hit')
          end()
          return entry.data
        }
        this.l1.delete(id)
      }
      try {
        const raw = await this.redis.get(`product:${id}`)
        if (!raw) {
          metrics.cacheMisses.inc()
          span.setAttribute('cache.result', 'miss')
          log.debug({ id }, 'cache.miss')
          end()
          return null
        }
        let data: ProductResponseItem
        try {
          data = JSON.parse(raw) as ProductResponseItem
        } catch {
          log.warn({ id }, 'cache.l2.parse.error')
          end()
          return null
        }
        metrics.cacheHits.inc({ layer: 'l2' })
        span.setAttribute('cache.result', 'l2_hit')
        log.debug({ id }, 'cache.l2.hit')
        this.writeL1(id, data)
        end()
        return data
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR })
        log.warn({ id, err }, 'cache.l2.get.error')
        end()
        return null
      }
    } finally {
      span.end()
    }
  })
}
```

For remaining methods that still use `logger`, replace `logger.warn(...)` and `logger.debug(...)` calls with `getLogger().warn(...)` and `getLogger().debug(...)`. Specifically in `setProduct`, `getRedisIds`, `setRedisIds`, `addToSortedSet`, `getTotal`.

Pattern: add `const log = getLogger()` at top of each method and replace `logger.` calls with `log.`.

- [ ] **Step 2: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.coverage.ts
```

Expected: all pass (existing cache specs use in-memory implementations, not real cache service).

- [ ] **Step 4: Commit**

```bash
git add src/modules/catalog/cache/product-cache-service.ts
git commit -m "feat(observability): instrument ProductCacheService with cache.get span and metrics"
```

---

### Task 6: Instrument CreateCheckoutUseCase (checkout.create span + metric)

**Files:**
- Modify: `src/modules/checkout/use-cases/create-checkout/create-checkout.ts`

**Interfaces:**
- Consumes: `tracer`, `SpanStatusCode` from Task 1; `metrics` from Task 3

- [ ] **Step 1: Modify `src/modules/checkout/use-cases/create-checkout/create-checkout.ts`**

Add imports after existing imports:
```typescript
import { tracer, SpanStatusCode } from '@shared/observability/tracer'
import { metrics } from '@shared/observability/metrics'
```

Wrap `execute()` body in `tracer.startActiveSpan`:

```typescript
async execute(input: CreateCheckoutInput): Promise<Either<DomainError, CreateCheckoutOutput>> {
  return tracer.startActiveSpan('checkout.create', async (span) => {
    try {
      span.setAttribute('customer.id', input.customerId)
      span.setAttribute('checkout.items_count', input.items.length)

      const existing = await this.orderRepository.findByIdempotencyKey(input.idempotencyKey)
      if (existing) {
        span.setAttribute('checkout.idempotent_hit', true)
        return right({ orderId: existing.id, status: existing.status, createdAt: existing.createdAt })
      }

      for (const item of input.items) {
        const stock = await this.productStockChecker.getProductStock(item.productId)
        if (!stock.exists) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'product_not_found' })
          return left(new ProductNotFoundError(item.productId))
        }
        const activeReserved = await this.stockReservationRepository.getActiveQuantity(item.productId)
        const available = stock.availableQuantity - activeReserved
        if (available < item.quantity) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'insufficient_stock' })
          return left(new InsufficientStockError(item.productId, item.quantity, available))
        }
      }

      const orderId = randomUUID()
      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS)

      const order = await this.orderRepository.createWithReservationsAndOutbox({
        id: orderId,
        customerId: input.customerId,
        correlationId: input.correlationId ?? randomUUID(),
        idempotencyKey: input.idempotencyKey,
        items: input.items,
        reservations: input.items.map(i => ({
          id: randomUUID(),
          productId: i.productId,
          quantity: i.quantity,
          expiresAt,
        })),
      })

      span.setAttribute('order.id', order.id)
      metrics.checkoutCreated.inc()

      return right({ orderId: order.id, status: OrderStatus.PENDING, createdAt: order.createdAt })
    } finally {
      span.end()
    }
  })
}
```

- [ ] **Step 2: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.coverage.ts
```

Expected: all pass. Existing create-checkout.spec.ts uses in-memory repos — spans are no-ops without SDK, tests unaffected.

- [ ] **Step 4: Commit**

```bash
git add src/modules/checkout/use-cases/create-checkout/create-checkout.ts
git commit -m "feat(observability): add checkout.create span and order created counter"
```

---

### Task 7: Instrument relay (metrics) + worker (checkout.process.job span + ALS + metrics)

**Files:**
- Modify: `src/modules/checkout/infra/queue/bullmq-checkout-relay.ts`
- Modify: `src/modules/checkout/infra/queue/bullmq-checkout-worker.ts`

**Interfaces:**
- Consumes: `tracer`, `SpanStatusCode` from Task 1; `enterContext` from Task 2; `metrics` from Task 3; `getLogger` from Task 2

**Architecture note:** relay runs in a `setInterval` callback — no HTTP request context is active. Worker job spans start as root spans (separate trace from HTTP). Correlation is via `correlationId` and `orderId` attributes visible in both Loki logs and Tempo spans.

- [ ] **Step 1: Modify `src/modules/checkout/infra/queue/bullmq-checkout-relay.ts`**

Replace `import { logger }` with:
```typescript
import { getLogger } from '@shared/observability/logger'
import { metrics } from '@shared/observability/metrics'
```

Replace `relayBatch()` body:
```typescript
private async relayBatch(): Promise<void> {
  const log = getLogger()
  metrics.relayCycles.inc()
  try {
    const pending = await this.outboxRepository.findPending()
    if (pending.length === 0) return

    await Promise.all(
      pending.map(entry =>
        this.queue.add('checkout', { orderId: entry.orderId }, { jobId: entry.id }),
      ),
    )

    await Promise.all(pending.map(entry => this.outboxRepository.markEnqueued(entry.id)))
    metrics.relayEnqueued.inc(pending.length)
    log.info({ count: pending.length }, 'checkout.relay.batch')
  } catch (err) {
    log.error({ err }, 'checkout.relay.batch.error')
  }
}
```

- [ ] **Step 2: Modify `src/modules/checkout/infra/queue/bullmq-checkout-worker.ts`**

Replace `import { logger }` with:
```typescript
import { getLogger } from '@shared/observability/logger'
import { tracer, SpanStatusCode } from '@shared/observability/tracer'
import { enterContext } from '@shared/observability/context'
import { metrics } from '@shared/observability/metrics'
```

Replace the `Worker` constructor callback (the `async (job) => { ... }` function):

```typescript
async (job) => {
  const { orderId } = job.data
  enterContext({ correlationId: job.id ?? orderId, orderId })
  const log = getLogger()

  return tracer.startActiveSpan('checkout.process.job', {
    attributes: {
      'order.id': orderId,
      'messaging.bullmq.job_id': job.id ?? '',
      'messaging.bullmq.attempts': job.attemptsMade,
    },
  }, async (span) => {
    const jobStart = Date.now()
    try {
      log.debug({ jobId: job.id, orderId, attempt: job.attemptsMade }, 'checkout.job.start')

      const order = await this.orderRepository.findById(orderId)
      if (order) {
        await this.orderRepository.updateStatus(orderId, OrderStatus.PROCESSING)
      }

      await delay(1000)
      await delay(1000)
      await delay(1000)

      const result = await this.processUseCase.execute({ orderId })
      if (result.isFailure()) throw new Error(result.value.message)

      if (job.id) await this.outboxRepository.markProcessed(job.id)

      metrics.checkoutConfirmed.inc()
      metrics.checkoutJobDuration.observe(Date.now() - jobStart)
      span.setStatus({ code: SpanStatusCode.OK })
      log.info({ jobId: job.id, orderId }, 'checkout.job.confirmed')
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message })
      throw err
    } finally {
      span.end()
    }
  })
},
```

Replace the `'failed'` event handler:

```typescript
this.worker.on('failed', async (job, err) => {
  if (!job) return
  const log = getLogger()
  const maxAttempts = Number(job.opts.attempts ?? 3)
  if (job.attemptsMade >= maxAttempts) {
    const { orderId } = job.data
    await this.processUseCase.handleFinalFailure(orderId, err.message)
    if (job.id) await this.outboxRepository.markDead(job.id, err.message)
    metrics.checkoutFailed.inc({ permanent: 'true' })
    log.error(
      { jobId: job.id, orderId, totalAttempts: job.attemptsMade, finalError: err.message },
      'checkout.job.dead',
    )
  } else {
    await this.orderRepository.updateStatus(job.data.orderId, OrderStatus.FAILED, {
      lastError: err.message,
    })
    metrics.checkoutFailed.inc({ permanent: 'false' })
    log.warn(
      { jobId: job.id, orderId: job.data.orderId, attempt: job.attemptsMade, error: err.message },
      'checkout.job.retry',
    )
  }
})
```

- [ ] **Step 3: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
npx vitest run --config vitest.coverage.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/checkout/infra/queue/bullmq-checkout-relay.ts src/modules/checkout/infra/queue/bullmq-checkout-worker.ts
git commit -m "feat(observability): add checkout.process.job span, ALS context in worker, and queue metrics"
```

---

### Task 8: Coverage exclusions + Docker stack + Grafana provisioning + runbook

**Files:**
- Modify: `vitest.coverage.ts` (add new observability files to exclude list)
- Create: `docker-compose.observability.yml`
- Create: `prometheus.yml`
- Create: `grafana/provisioning/datasources/prometheus.yml`
- Create: `grafana/provisioning/datasources/loki.yml`
- Create: `grafana/provisioning/datasources/tempo.yml`
- Create: `grafana/provisioning/dashboards/provider.yml`
- Create: `grafana/provisioning/dashboards/casecellshop.json`
- Create: `docs/observability.md`

- [ ] **Step 1: Update `vitest.coverage.ts` — add new files to exclude**

In the `exclude` array, add after `'src/shared/observability/logger.ts'`:

```typescript
'src/shared/observability/tracer.ts',
'src/shared/observability/context.ts',
'src/shared/observability/metrics.ts',
```

- [ ] **Step 2: Create `prometheus.yml`**

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: casecellshop
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: /metrics
```

- [ ] **Step 3: Create `docker-compose.observability.yml`**

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - '9090:9090'
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    extra_hosts:
      - 'host.docker.internal:host-gateway'

  tempo:
    image: grafana/tempo:latest
    command: ['-config.file=/etc/tempo.yaml']
    ports:
      - '3200:3200'
      - '4318:4318'
    volumes:
      - ./grafana/tempo.yml:/etc/tempo.yaml:ro

  loki:
    image: grafana/loki:latest
    ports:
      - '3100:3100'
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log:ro
      - ./grafana/promtail.yml:/etc/promtail/config.yml:ro
    command: -config.file=/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - '3001:3000'
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    depends_on:
      - prometheus
      - loki
      - tempo
```

- [ ] **Step 4: Create `grafana/tempo.yml`**

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: 0.0.0.0:4318

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/blocks
```

- [ ] **Step 5: Create `grafana/promtail.yml`**

```yaml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: casecellshop
    static_configs:
      - targets:
          - localhost
        labels:
          app: casecellshop
          __path__: /var/log/casecellshop/*.log
    pipeline_stages:
      - json:
          expressions:
            traceId: traceId
            level: level
      - labels:
          traceId:
          level:
```

- [ ] **Step 6: Create `grafana/provisioning/datasources/prometheus.yml`**

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    uid: prometheus
    url: http://prometheus:9090
    isDefault: true
    jsonData:
      timeInterval: 15s
```

- [ ] **Step 7: Create `grafana/provisioning/datasources/loki.yml`**

```yaml
apiVersion: 1
datasources:
  - name: Loki
    type: loki
    uid: loki
    url: http://loki:3100
    jsonData:
      derivedFields:
        - datasourceUid: tempo
          matcherRegex: '"traceId":"(\w+)"'
          name: TraceID
          url: '$${__value.raw}'
```

- [ ] **Step 8: Create `grafana/provisioning/datasources/tempo.yml`**

```yaml
apiVersion: 1
datasources:
  - name: Tempo
    type: tempo
    uid: tempo
    url: http://tempo:3200
    jsonData:
      httpMethod: GET
      lokiSearch:
        datasourceUid: loki
```

- [ ] **Step 9: Create `grafana/provisioning/dashboards/provider.yml`**

```yaml
apiVersion: 1
providers:
  - name: casecellshop
    type: file
    options:
      path: /etc/grafana/provisioning/dashboards
```

- [ ] **Step 10: Create `grafana/provisioning/dashboards/casecellshop.json`**

Minimal valid Grafana dashboard JSON with 5 panels:
1. Cache Hit Rate (counter ratio timeseries)
2. Checkout Funnel (created/confirmed/failed counters)
3. Job Duration p95 (histogram quantile)
4. Recent Errors (Loki table panel)
5. Instructions panel linking to docs/observability.md

```json
{
  "__inputs": [],
  "__requires": [],
  "annotations": { "list": [] },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 0,
  "id": null,
  "links": [],
  "panels": [
    {
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "fieldConfig": {
        "defaults": { "unit": "percentunit" },
        "overrides": []
      },
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "id": 1,
      "options": { "tooltip": { "mode": "single" } },
      "targets": [
        {
          "expr": "rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))",
          "legendFormat": "Hit Rate"
        }
      ],
      "title": "Cache Hit Rate",
      "type": "timeseries"
    },
    {
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "fieldConfig": { "defaults": {}, "overrides": [] },
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "id": 2,
      "targets": [
        { "expr": "increase(checkout_orders_created_total[1m])", "legendFormat": "Created" },
        { "expr": "increase(checkout_orders_confirmed_total[1m])", "legendFormat": "Confirmed" },
        { "expr": "increase(checkout_orders_failed_total[1m])", "legendFormat": "Failed" }
      ],
      "title": "Checkout Funnel (1m rate)",
      "type": "timeseries"
    },
    {
      "datasource": { "type": "prometheus", "uid": "prometheus" },
      "fieldConfig": { "defaults": { "unit": "ms" }, "overrides": [] },
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "id": 3,
      "targets": [
        { "expr": "histogram_quantile(0.95, rate(checkout_job_duration_ms_bucket[5m]))", "legendFormat": "p95" },
        { "expr": "histogram_quantile(0.50, rate(checkout_job_duration_ms_bucket[5m]))", "legendFormat": "p50" }
      ],
      "title": "Job Duration",
      "type": "timeseries"
    },
    {
      "datasource": { "type": "loki", "uid": "loki" },
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
      "id": 4,
      "options": { "dedupStrategy": "none", "showTime": true },
      "targets": [
        { "expr": "{app=\"casecellshop\"} | json | level=\"error\"", "legendFormat": "" }
      ],
      "title": "Recent Errors",
      "type": "logs"
    }
  ],
  "refresh": "30s",
  "schemaVersion": 38,
  "tags": ["casecellshop"],
  "time": { "from": "now-1h", "to": "now" },
  "timepicker": {},
  "title": "CaseCellShop Observability",
  "uid": "casecellshop-obs",
  "version": 1
}
```

- [ ] **Step 11: Create `docs/observability.md`**

```markdown
# Observabilidade — CaseCellShop

## Stack local

```bash
wsl docker compose -f docker-compose.observability.yml up -d
```

Serviços:
| Serviço | URL | Papel |
|---|---|---|
| Grafana | http://localhost:3001 | Dashboards, logs, traces |
| Prometheus | http://localhost:9090 | Scrape de /metrics |
| Loki | http://localhost:3100 | Log aggregation |
| Tempo | http://localhost:3200 | Backend de traces |
| App | http://localhost:3000 | API + /metrics |

Variáveis de ambiente para habilitar exportação de traces:
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=casecellshop
```

Sem essas variáveis, o app usa `ConsoleSpanExporter` — spans aparecem no stdout.

## Spans instrumentados

| Span | Onde | Atributos chave |
|---|---|---|
| `http.request` | onRequest/onResponse Fastify | `http.method`, `http.url`, `correlation.id`, `http.status_code` |
| `cache.get` | ProductCacheService.getProduct | `cache.key`, `cache.result` (l1_hit/l2_hit/miss) |
| `checkout.create` | CreateCheckoutUseCase.execute | `order.id`, `customer.id`, `checkout.items_count` |
| `checkout.process.job` | BullMQCheckoutWorker | `order.id`, `messaging.bullmq.job_id`, `messaging.bullmq.attempts` |

**Nota de arquitetura:** `http.request` e `checkout.process.job` são traces separados porque o Outbox Pattern quebra a cadeia síncrona — o relay faz polling num `setInterval` sem contexto HTTP. A correlação entre eles é feita via `correlationId` nos logs (Loki) e no atributo `order.id` dos spans (Tempo).

## Métricas disponíveis em /metrics

| Métrica | Tipo | Descrição |
|---|---|---|
| `cache_hits_total{layer}` | Counter | Hits por camada (l1/l2) |
| `cache_misses_total` | Counter | Cache misses |
| `cache_evictions_total` | Counter | Evictions LFU do L1 |
| `cache_operation_duration_ms` | Histogram | Latência de operações de cache |
| `checkout_orders_created_total` | Counter | Pedidos criados |
| `checkout_orders_confirmed_total` | Counter | Pedidos confirmados |
| `checkout_orders_failed_total{permanent}` | Counter | Pedidos com falha |
| `checkout_job_duration_ms` | Histogram | Duração do processamento do job |
| `checkout_relay_cycles_total` | Counter | Ciclos de poll do relay |
| `checkout_relay_enqueued_total` | Counter | Entradas enfileiradas pelo relay |

## Alertas exemplo (Grafana)

```yaml
# Cache hit rate abaixo de 70% por 5 minutos
expr: |
  rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) < 0.70
for: 5m
labels:
  severity: warning
annotations:
  summary: "L1+L2 cache hit rate abaixo de 70%"

# Checkout failures acima de 10% por 10 minutos
expr: |
  rate(checkout_orders_failed_total{permanent="true"}[10m]) /
  rate(checkout_orders_created_total[10m]) > 0.10
for: 10m
labels:
  severity: critical
annotations:
  summary: "Taxa de falha permanente no checkout acima de 10%"
```

## Runbook — Checkout travado

Sintoma: pedido com status `PROCESSING` por mais de 5 minutos.

1. **Loki** → Explore → query: `{app="casecellshop"} | json | orderId="<id>"`
   - Ver sequência de eventos para o orderId
   - Copiar `traceId` do log `checkout.job.start`

2. **Tempo** → Explore → buscar por `traceId`
   - Ver span `checkout.process.job` — onde parou ou qual erro

3. **BullBoard** → http://localhost:3000/admin/queues
   - Ver estado do job em `checkout-processing`
   - Jobs em `failed`: ver erro e contagem de tentativas

4. **Prometheus** → query: `checkout_orders_failed_total`
   - Checar se é falha isolada ou sistêmica

## Produção com Datadog

Substituir `OTEL_EXPORTER_OTLP_ENDPOINT` pelo endpoint do Datadog Agent com OTLP habilitado:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://datadog-agent:4318
```

Datadog Agent recebe traces via OTLP. Para métricas, configurar `openmetrics_check` apontando para `http://app:3000/metrics`. Para logs, coletar stdout JSON via Datadog Log Collection.
```

- [ ] **Step 12: Run full test suite**

```bash
npx vitest run --config vitest.coverage.ts
```

Expected: all pass, thresholds met.

- [ ] **Step 13: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add vitest.coverage.ts docker-compose.observability.yml prometheus.yml grafana/ docs/observability.md
git commit -m "feat(observability): add docker stack (prometheus/grafana/loki/tempo), provisioned dashboard, and runbook"
```
