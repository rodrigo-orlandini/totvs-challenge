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
