# Design: ERP Sync — Transactional Outbox + BullMQ

**Data:** 2026-09-20
**Escopo:** Sincronização unidirecional ERP → CaseCellShop via polling, outbox pattern, BullMQ, idempotência, retry/backoff/DLQ e observabilidade

---

## 1. Contexto e Objetivo

O ERP é simulado por um segundo PostgreSQL com schema idêntico ao CaseCellShop. O sistema tem acesso **somente leitura** ao banco ERP. O objetivo é manter `products` e `stock_flows` do CaseCellShop sincronizados com o ERP com latência de poucos segundos, sem mensagens fantasma, sem duplicatas e com resiliência total a falhas transitórias.

---

## 2. Stack Adicionada

| Componente | Tecnologia |
|---|---|
| Fila | BullMQ (`bullmq`) |
| Monitoramento de fila | Bull Board (`@bull-board/api`, `@bull-board/fastify`) |
| Threads de polling | Node.js `worker_threads` |
| ERP DB | PostgreSQL 16 (segundo container) |

---

## 3. Arquitetura do Fluxo

```
ERP DB (read-only, postgres-erp:5432)
    │
    │  polling cursor-based
    │  ProductPoller: 15s  — Worker Thread
    │  StockFlowPoller: 5s — Worker Thread
    │
    ▼
outbox table (nosso DB) ◄── escrita atômica com avanço de cursor
    │
    │  relay setInterval 1.5s (main thread)
    │
    ▼
BullMQ queue "erp-sync" (Redis)
    │
    │  BullMQ Worker (main thread)
    │  attempts: 5, backoff: exponential 1s
    │
    ▼
products / stock_flows (nosso DB)
    │
    ▼
outbox.status = PROCESSED
```

Falha em qualquer etapa não avança o cursor nem perde o evento:
- Crash do poller antes do COMMIT → cursor não avança → próximo ciclo redetecta
- Crash do relay após enqueue mas antes do UPDATE → outbox fica PENDING → próximo relay reencfileira → BullMQ dedup por `jobId` previne duplicata no worker
- Falha no worker → BullMQ retry com backoff → após 5 tentativas → `failed` queue (DLQ) + outbox `DEAD`

---

## 4. Camada de Dados

### 4.1 Tabelas novas no CaseCellShop DB

```prisma
enum OutboxStatus {
  PENDING
  ENQUEUED
  PROCESSED
  DEAD
}

model SyncCursor {
  entity       String   @id
  lastSyncedAt DateTime @map("last_synced_at")

  @@map("sync_cursors")
}

model Outbox {
  id          String       @id @default(uuid())
  entity      String                          -- 'product' | 'stock_flow'
  erpId       String       @map("erp_id")     -- id do registro no ERP
  payload     Json                            -- snapshot do row ERP
  status      OutboxStatus @default(PENDING)
  attempts    Int          @default(0)
  nextRetryAt DateTime?    @map("next_retry_at")
  error       String?
  createdAt   DateTime     @default(now()) @map("created_at")

  @@unique([entity, erpId])
  @@map("outbox")
}
```

### 4.2 Idempotência por entidade

| Entidade | ON CONFLICT | Motivo |
|---|---|---|
| `product` | `DO UPDATE SET payload = EXCLUDED.payload, status = 'PENDING' WHERE status != 'PROCESSED' OR payload != EXCLUDED.payload` | Produto pode ser atualizado várias vezes no ERP |
| `stock_flow` | `DO NOTHING` | Append-only: mesmo `erp_id` não deve ser reprocessado |

No worker, idempotência adicional na escrita final:
- `product`: `prisma.product.upsert({ where: { sku } })` — Prisma gera `ON CONFLICT DO UPDATE`
- `stock_flow`: `prisma.stockFlow.createMany({ skipDuplicates: true })` — `ON CONFLICT DO NOTHING` via constraint `@@unique([id])` (PK)

### 4.3 ERP DB

Schema idêntico ao CaseCellShop. Segundo `PrismaClient` apontando para `ERP_DATABASE_URL`. Seed aplicado no ERP; sync inicial traz todos os registros para o CaseCellShop (cursor inicial = epoch).

---

## 5. Polling Layer

### 5.1 Worker Threads

Cada poller roda em `worker_threads.Worker` independente — event loop isolado, `PrismaClient` próprio, falha em um não afeta o outro.

```
src/modules/erp-adapter/infra/scheduler/
├── erp-poller-product.worker.ts     ← Worker Thread
├── erp-poller-stock-flow.worker.ts  ← Worker Thread
└── erp-scheduler.ts                 ← main thread: spawn + monitor
```

`erp-scheduler.ts` spawna os workers no bootstrap e escuta evento `'exit'` — se um worker morrer inesperadamente, loga o erro e faz respawn com backoff.

### 5.2 Lógica de cada ciclo

```typescript
// dentro do worker thread
async function pollCycle(entity: 'product' | 'stock_flow') {
  await prisma.$transaction(async (tx) => {
    const cursor = await tx.syncCursor.findUnique({ where: { entity } })
    const since = cursor?.lastSyncedAt ?? new Date(0)

    const rows = await erpPrisma[table].findMany({
      where: { [timestampField]: { gt: since } },
      orderBy: { [timestampField]: 'asc' },
    })

    if (rows.length === 0) return

    await tx.outbox.createMany({
      data: rows.map(row => ({ entity, erpId: row.id, payload: row, status: 'PENDING' })),
      skipDuplicates: false, // handled by upsert below for products
    })
    // products: upsert resets to PENDING if payload changed
    // stock_flows: createMany with skipDuplicates: true

    const newCursor = rows[rows.length - 1][timestampField]
    await tx.syncCursor.upsert({
      where: { entity },
      update: { lastSyncedAt: newCursor },
      create: { entity, lastSyncedAt: newCursor },
    })
  })
}
```

### 5.3 Intervalos

| Poller | Intervalo | Env var |
|---|---|---|
| `ProductPoller` | 15s | `POLL_INTERVAL_PRODUCTS_MS=15000` |
| `StockFlowPoller` | 5s | `POLL_INTERVAL_STOCK_FLOWS_MS=5000` |

---

## 6. Relay Layer

Roda na main thread. `setInterval` de 1.5s (`RELAY_INTERVAL_MS=1500`).

```typescript
async function relayBatch() {
  const pending = await prisma.outbox.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })
  if (pending.length === 0) return

  await Promise.all(
    pending.map(entry =>
      erpSyncQueue.add(
        `${entry.entity}:${entry.erpId}`,
        { entity: entry.entity, erpId: entry.erpId, payload: entry.payload, correlationId: entry.id },
        { jobId: `${entry.entity}:${entry.erpId}` }, // BullMQ dedup
      )
    )
  )

  await prisma.outbox.updateMany({
    where: { id: { in: pending.map(e => e.id) } },
    data: { status: 'ENQUEUED' },
  })
}
```

---

## 7. BullMQ Worker

```typescript
const worker = new Worker('erp-sync', async (job) => {
  const { entity, erpId, payload, correlationId } = job.data
  const span = tracer.startSpan('erp.sync.process')
  span.setAttribute('entity', entity)
  span.setAttribute('erp_id', erpId)
  span.setAttribute('attempt', job.attemptsMade)

  try {
    if (entity === 'product') {
      await prisma.product.upsert({
        where: { sku: payload.sku },
        update: { name: payload.name, price: payload.price, updatedAt: new Date(payload.updated_at) },
        create: { id: payload.id, sku: payload.sku, name: payload.name, price: payload.price },
      })
    }

    if (entity === 'stock_flow') {
      await prisma.stockFlow.createMany({
        data: [{ id: payload.id, productId: payload.product_id, quantity: payload.quantity, movedAt: new Date(payload.moved_at) }],
        skipDuplicates: true,
      })
    }

    await prisma.outbox.update({
      where: { entity_erpId: { entity, erpId } },
      data: { status: 'PROCESSED', error: null },
    })

    logger.info({ correlationId, entity, erpId, attempt: job.attemptsMade }, 'erp.sync.processed')
    span.setAttribute('status', 'processed')
  } finally {
    span.end()
  }
}, {
  connection: redisConnection,
})

// DLQ: marcar outbox como DEAD após todas as tentativas esgotadas
worker.on('failed', async (job, err) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 5)) return
  await prisma.outbox.update({
    where: { entity_erpId: { entity: job.data.entity, erpId: job.data.erpId } },
    data: { status: 'DEAD', error: err.message, attempts: job.attemptsMade },
  })
  logger.error({ jobId: job.id, entity: job.data.entity, erpId: job.data.erpId, error: err.message }, 'erp.sync.dead')
})
```

**Configuração da fila:**

```typescript
const erpSyncQueue = new Queue('erp-sync', { connection: redisConnection })

defaultJobOptions: {
  attempts: Number(process.env.SYNC_JOB_ATTEMPTS ?? 5),
  backoff: {
    type: 'exponential',
    delay: Number(process.env.SYNC_JOB_BACKOFF_DELAY_MS ?? 1000),
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: false, // mantém em 'failed' para inspeção via Bull Board
}
```

---

## 8. Observabilidade

### 8.1 Logs por evento

| Evento | Level | Campos |
|---|---|---|
| Poll cycle | `debug` | `entity`, `cursor`, `rowsDetected`, `durationMs` |
| Outbox write | `debug` | `entity`, `erpId`, `action` ('inserted'\|'updated'\|'skipped') |
| Relay batch | `info` | `count`, `durationMs` |
| Job start | `debug` | `jobId`, `entity`, `erpId`, `attempt` |
| Job success | `info` | `jobId`, `entity`, `erpId`, `durationMs` |
| Job failure (retry) | `warn` | `jobId`, `entity`, `erpId`, `attempt`, `error`, `nextRetryMs` |
| Job dead | `error` | `jobId`, `entity`, `erpId`, `totalAttempts`, `finalError` |
| Worker respawn | `warn` | `entity`, `exitCode`, `backoffMs` |

`correlationId` propagado em todos os logs do mesmo ciclo.

### 8.2 Spans OTel

```
erp.poll.<entity>        poller thread — cursor → outbox write
  └─ erp.relay.enqueue   relay — outbox → BullMQ
       └─ erp.sync.process worker — job → upsert DB
```

### 8.3 Bull Board

```typescript
// src/infra/http/server.ts
const serverAdapter = new FastifyAdapter()
createBullBoard({ queues: [new BullMQAdapter(erpSyncQueue)], serverAdapter })
app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' })
```

Rota: `GET /admin/queues` — UI com filas waiting/active/completed/failed, retry manual de jobs mortos.

---

## 9. Infraestrutura Docker

### 9.1 docker-compose.yml (adição)

```yaml
postgres-erp:
  container_name: casecellshop-postgres-erp
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: casecellshop_erp
  ports:
    - "5434:5432"
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 5s
    timeout: 5s
    retries: 5
```

### 9.2 docker-compose.test.yml (adição)

```yaml
postgres-erp-test:
  container_name: casecellshop-postgres-erp-test
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: casecellshop_erp_test
  ports:
    - "5435:5432"
```

### 9.3 Novas env vars

```
ERP_DATABASE_URL=postgresql://postgres:postgres@casecellshop-postgres-erp:5432/casecellshop_erp
TEST_ERP_DATABASE_URL=postgresql://postgres:postgres@localhost:5435/casecellshop_erp_test
POLL_INTERVAL_PRODUCTS_MS=15000
POLL_INTERVAL_STOCK_FLOWS_MS=5000
RELAY_INTERVAL_MS=1500
SYNC_JOB_ATTEMPTS=5
SYNC_JOB_BACKOFF_DELAY_MS=1000
```

---

## 10. Estrutura do Módulo `erp-adapter`

```
src/modules/erp-adapter/
├── entities/
│   └── outbox-entry.ts
├── repositories/
│   ├── outbox-repository.ts
│   └── sync-cursor-repository.ts
├── use-cases/
│   ├── poll-erp-products/
│   │   ├── poll-erp-products.ts
│   │   └── poll-erp-products.spec.ts
│   ├── poll-erp-stock-flows/
│   │   ├── poll-erp-stock-flows.ts
│   │   └── poll-erp-stock-flows.spec.ts
│   └── process-sync-job/
│       ├── process-sync-job.ts
│       └── process-sync-job.spec.ts
├── infra/
│   ├── persistence/
│   │   ├── prisma-outbox-repository.ts
│   │   ├── prisma-outbox-repository.integration-spec.ts
│   │   └── prisma-sync-cursor-repository.ts
│   ├── queue/
│   │   ├── bullmq-relay.ts
│   │   └── bullmq-sync-worker.ts
│   └── scheduler/
│       ├── erp-poller-product.worker.ts
│       ├── erp-poller-stock-flow.worker.ts
│       └── erp-scheduler.ts
└── container.ts
```

---

## 11. Seed e Initial Sync

1. `node prisma/seed.mjs --target erp` — seed de ~100 produtos no ERP DB
2. Na primeira execução do sistema, `sync_cursors` vazio → cursor inicial = epoch → ProductPoller e StockFlowPoller detectam todos os registros ERP → outbox populado → relay enfileira → worker aplica upsert em todos → CaseCellShop sincronizado

---

## 12. Testes

| Camada | Tipo | O que testar |
|---|---|---|
| `poll-erp-products` use-case | Unit (fake repos) | Cursor avança, outbox escrito corretamente, ON CONFLICT correto |
| `poll-erp-stock-flows` use-case | Unit (fake repos) | Append-only, skip duplicate |
| `process-sync-job` use-case | Unit (fake repos) | Upsert produto, createMany stock_flow, marca PROCESSED |
| `prisma-outbox-repository` | Integration | UNIQUE constraint, status transitions |
| `bullmq-relay` + `bullmq-sync-worker` | Integration (Redis test) | Job enfileirado, processado, DLQ após max attempts |
| Worker Thread respawn | Unit | Mock `worker_threads`, verifica respawn em exit inesperado |

---

## 13. Decisões e Rationale

| Decisão | Motivo |
|---|---|
| BullMQ sobre NATS | Redis já na stack; volume de Products+StockFlow não justifica overhead de NATS |
| Worker Threads para pollers | Isolamento de event loop; falha em um não afeta o outro |
| Outbox + relay separado de poller | Desacopla detecção de mudança de enfileiramento; cobre janela de Redis down |
| `jobId = entity:erp_id` no BullMQ | Dedup nativo — relay idempotente mesmo sem transação entre enqueue e UPDATE outbox |
| `skipDuplicates: true` no StockFlow | StockFlow é append-only; mesmo `id` do ERP não deve gerar dois registros no CaseCellShop |
| `ON CONFLICT DO UPDATE` no Product | Produto pode ser atualizado N vezes; outbox deve reprocessar se payload mudou |
| Cursor por `moved_at` / `updated_at` | Campos de timestamp já existem no schema; não requer alteração no ERP |
