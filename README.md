# CaseCellShop

Backend de vitrine virtual e checkout assíncrono para e-commerce de capinhas de celular. Desenvolvido com foco em rastreabilidade, consistência eventual e observabilidade local completa.

## Índice

- [Arquitetura](#arquitetura)
- [Decisões técnicas](#decisões-técnicas)
- [Stack](#stack)
- [Executando o projeto](#executando-o-projeto)
- [API](#api)
- [Observabilidade](#observabilidade)
- [Testes](#testes)
- [Prompts de IA](#prompts-de-ia)
- [Trade-offs e limitações](#trade-offs-e-limitações)

---

## Arquitetura

```
HTTP Request
  │  onRequest: ALS context (correlationId) + OTel span http.request
  ▼
ProductController / CheckoutController / OrderStatusController
  │
  ▼
Use Case (domínio puro, sem framework)
  │  CreateCheckout → soft reservation → INSERT order (status=PENDING)
  │  GetOrderStatus → leitura direta do banco
  ▼
Repository
  │  CachedProductRepository — L1 in-process + L2 Redis
  │  PrismaOrderRepository — PostgreSQL
  ▼
Outbox / BullMQ
  │  CheckoutRelay (setInterval) — lê orders PENDING, enfileira jobs
  │  CheckoutWorker — processa job, simula ERP, confirma order
  ▼
ERP Adapter (polling)
  │  Sincroniza produtos e estoque do ERP fake via HTTP
```

O fluxo de checkout usa o **Outbox Pattern**: o `POST /checkout` persiste o pedido em estado `PENDING` no mesmo banco (commit atômico com a reserva de estoque) e retorna `202 Accepted`. Um relay em background enfileira jobs BullMQ para o worker processar de forma assíncrona.

---

## Decisões técnicas

### Cache L1 + L2 com LFU

`GET /products` é servido por duas camadas de cache:

- **L1 (in-process, Map):** TTL configurável via `CACHE_TTL_SECONDS`. Evição LFU com heap mínima — remove o produto menos frequentemente acessado quando a capacidade máxima é atingida.
- **L2 (Redis):** fallback quando L1 falha ou expira. Hit no L2 promove o item para L1.
- **Fallback ao banco:** se ambas as camadas falham, busca no PostgreSQL e popula ambas.

Justificativa: reduz latência de leitura e carga no banco para o endpoint mais acessado. LFU foi preferido sobre LRU porque produtos populares mantêm frequência alta independente de recência.

### Outbox Pattern

O `POST /checkout` não enfileira o job diretamente. Em vez disso:

1. INSERT order com status `PENDING` (transacional com a reserva de estoque)
2. `CheckoutRelay` (setInterval a cada `RELAY_INTERVAL_MS`) lê orders `PENDING` e enfileira no BullMQ
3. Worker confirma ou falha com retry exponencial (3 tentativas)

Justificativa: garante que nenhum pedido é perdido se o Redis estiver indisponível no momento do checkout. A durabilidade vem do PostgreSQL, não do broker.

### Soft reservation

O estoque é decrementado no momento do `POST /checkout` (reserva). Se o processamento falhar permanentemente, o estoque é devolvido. Isso evita overselling sem exigir lock distribuído.

### Idempotência

`POST /checkout` aceita o header `Idempotency-Key`. Requisições duplicadas com a mesma chave retornam o mesmo `orderId` sem criar um novo pedido (constraint única em `orders.idempotencyKey`).

### ERP Adapter

Dois pollers independentes sincronizam dados do ERP fake via HTTP:
- **ProductPoller** (`POLL_INTERVAL_PRODUCTS_MS`): sincroniza catálogo de produtos
- **StockFlowPoller** (`POLL_INTERVAL_STOCK_FLOWS_MS`): aplica movimentações de estoque

### Observabilidade

Ver seção [Observabilidade](#observabilidade) abaixo.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 20, TypeScript |
| HTTP | Fastify |
| ORM | Prisma |
| Banco | PostgreSQL 16 |
| Cache | Redis 7 (L2) + Map in-process (L1) |
| Fila | BullMQ |
| DI | tsyringe |
| Logs | pino |
| Métricas | prom-client |
| Traces | OpenTelemetry SDK + Tempo |
| Testes | Vitest |
| CI | GitHub Actions |

---

## Executando o projeto

### Pré-requisitos

- Docker (ou Docker via WSL no Windows)
- Node.js 20+

### Subir infraestrutura + aplicação

```bash
cp .env.example .env

# Docker Desktop
docker compose up

# WSL (sem Docker Desktop)
wsl docker compose up
```

A aplicação sobe em `http://localhost:3000`.

### Subir stack de observabilidade (opcional)

```bash
# Docker Desktop
docker compose -f docker-compose.observability.yml up -d

# WSL
wsl docker compose -f docker-compose.observability.yml up -d
```

| Serviço | URL |
|---|---|
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| Tempo | http://localhost:3200 |

Para enviar traces para o Tempo, adicione ao `.env`:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Sem essa variável, o app usa `ConsoleSpanExporter` (traces no stdout).

### Migrations e seed

```bash
# Dentro do container ou com banco acessível localmente
npm run db:migrate
npm run db:seed
```

---

## API

Documentação interativa disponível em `http://localhost:3000/docs` (Swagger UI).

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/products` | Lista produtos paginados (cache L1+L2) |
| `POST` | `/checkout` | Cria pedido com reserva de estoque (202 Accepted) |
| `GET` | `/orders/:orderId/status` | Consulta status do pedido |
| `GET` | `/metrics` | Métricas Prometheus |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/admin/queues` | BullBoard — status das filas BullMQ |

### POST /checkout

**Headers:**
- `Idempotency-Key: <uuid>` — opcional; previne criação duplicada

**Body:**
```json
{
  "customerId": "uuid",
  "items": [
    { "productId": "uuid", "quantity": 2 }
  ]
}
```

**Respostas:**
- `202 Accepted` — pedido aceito, processamento assíncrono
- `409 Conflict` — produto sem estoque suficiente
- `404 Not Found` — produto não encontrado

---

## Observabilidade

### Logs estruturados

Todos os logs são JSON (pino). Campos em todos os logs:
- `correlationId` — propagado do header `x-correlation-id` via AsyncLocalStorage
- `orderId` — presente quando disponível no contexto do request
- `traceId` / `spanId` — injetados automaticamente quando há span ativo

### Métricas (Prometheus)

Disponíveis em `GET /metrics`. Métricas principais:

| Métrica | Tipo | Descrição |
|---|---|---|
| `cache_hits_total{layer}` | Counter | Hits por camada (l1/l2) |
| `cache_misses_total` | Counter | Misses totais |
| `cache_operation_duration_ms` | Histogram | Latência de operações de cache |
| `checkout_orders_created_total` | Counter | Pedidos criados |
| `checkout_orders_confirmed_total` | Counter | Pedidos confirmados pelo worker |
| `checkout_orders_failed_total{permanent}` | Counter | Falhas permanentes/transitórias |
| `checkout_job_duration_ms` | Histogram | Duração de processamento do job |

### Traces (OpenTelemetry)

4 spans instrumentados:

| Span | Onde |
|---|---|
| `http.request` | onRequest hook — raiz de todos os traces HTTP |
| `cache.get` | ProductCacheService.getProduct() |
| `checkout.create` | CreateCheckout use case |
| `checkout.process.job` | BullMQ worker callback |

Ver `docs/observability.md` para runbook completo, alertas e guia de migração para Datadog.

---

## Testes

```bash
# Testes unitários
npm run test:unit

# Testes de integração (requer Docker)
npm run test:integration

# Todos + coverage
npm run test:all
```

Cobertura por camada (thresholds em `vitest.coverage.ts`): use cases, entities, value objects, repositórios.

---

## Prompts de IA

O desenvolvimento foi assistido por IA ao longo de todas as etapas. Os prompts utilizados estão documentados em [`prompts/`](./prompts/), com contexto, critérios de direcionamento e avaliação crítica de cada resultado.

| Arquivo | Tema |
|---|---|
| `00-estrutura-arquitetural-e-fluxo-de-desenvolvimento.md` | Arquitetura inicial e fluxo de desenvolvimento |
| `01-vitrine-inicial.md` | Endpoint GET /products com cache |
| `02-erp-sync.md` | Sincronização com ERP via polling |
| `03-git-workflow-e-ci.md` | Workflow git e pipeline CI |
| `04-cache-vitrine.md` | Cache L1+L2 com LFU |
| `05-checkout-assincrono.md` | Checkout assíncrono com Outbox Pattern |
| `06-observabilidade.md` | Observabilidade com OTel, prom-client e stack local |

---

## Trade-offs e limitações

| Decisão | Trade-off |
|---|---|
| L1 in-process por instância | Em múltiplas instâncias, L1 pode divergir entre pods; L2 (Redis) é a fonte de verdade compartilhada |
| Outbox via polling (setInterval) | Latência mínima de `RELAY_INTERVAL_MS` entre criação e enfileiramento; solução simples sem CDC |
| Soft reservation sem lock distribuído | Race condition teórica em cenários de alta concorrência simultânea no mesmo produto; mitigado por transação Postgres |
| ERP fake via HTTP mock | Não modela falhas de rede reais; retry configurável mas sem circuit breaker |
| Traces HTTP→Worker desconectados | W3C traceparent não propagado pelo relay (sem contexto HTTP no setInterval); correlação via `correlationId` nos logs |
| Sem autenticação | Fora do escopo; todos os endpoints são públicos |
