# Testes manuais — Observabilidade

Cobre três pilares: **métricas** (Prometheus), **traces** (OpenTelemetry → Tempo), **logs** (Pino → Loki).

---

## Pré-requisito: subir stack de observabilidade

```powershell
docker compose -f docker-compose.observability.yml up -d
```

Habilitar envio de traces ao Tempo — adicionar ao `.env` e reiniciar o app:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318
```

```powershell
docker compose restart app
```

Sem `OTEL_EXPORTER_OTLP_ENDPOINT`, traces são impressos no stdout do container (ConsoleSpanExporter).

---

## 1. Métricas — endpoint `/metrics`

```powershell
(Invoke-WebRequest http://localhost:3000/metrics).Content -split "`n" | Select-String "^(cache|checkout)"
```

Antes de qualquer chamada, contadores devem existir com valor `0`. Após chamadas, verificar incrementos.

### Métricas disponíveis

| Métrica | Tipo | Trigger |
|---|---|---|
| `cache_hits_total{layer="l1"}` | Counter | GET /products, hit no Map em memória |
| `cache_hits_total{layer="l2"}` | Counter | GET /products, hit no Redis após restart do app (L1 limpa); raro por expiração natural pois L1 e Redis têm o mesmo TTL (~600s) |
| `cache_misses_total` | Counter | GET /products, miss em L1 e Redis (cold start ou após flush) |
| `cache_evictions_total` | Counter | L1 chega em 1000 entradas, LFU evictor roda |
| `cache_operation_duration_ms` | Histogram | Toda operação de get/set no cache |
| `checkout_orders_created_total` | Counter | POST /checkout com sucesso |
| `checkout_orders_confirmed_total` | Counter | Job de checkout processado com sucesso |
| `checkout_orders_failed_total{permanent="..."}` | Counter | Job de checkout falhou |
| `checkout_job_duration_ms` | Histogram | Duração do processamento do job |
| `checkout_relay_cycles_total` | Counter | Ciclos do relay de outbox |
| `checkout_relay_enqueued_total` | Counter | Entradas enfileiradas pelo relay |

### Validar incremento de métricas

```powershell
# Anotar valor inicial
$metrics = (Invoke-WebRequest http://localhost:3000/metrics).Content -split "`n"
Métricas resetam a 0 no restart (novo processo). Forçar estado parcial antes do restart e verificar valor absoluto no novo processo.

```powershell
# 1. Garantir sorted set e produto keys no Redis
Invoke-RestMethod http://localhost:3000/products | Out-Null

# 2. Deletar product:<id> ANTES do restart — manter products:sorted intacto.
#    A ordem importa: se deletar depois, warmAll já popula L1 via L2 hit.
$keys = docker compose exec redis redis-cli KEYS "product:*"
foreach ($key in $keys) { docker compose exec redis redis-cli DEL $key }

# 3. Restart — warmAll() encontra products:sorted (IDs ok) mas sem product:<id>
#    → getProduct(id) para cada → Redis miss → cacheMisses.inc() × N
docker compose restart app
Start-Sleep -Seconds 8

# Verificar que misses > 0 (gerados pelo warmAll no startup)
(Invoke-WebRequest http://localhost:3000/metrics).Content -split "`n" | Select-String "^cache_misses_total"
```

Esperado: `cache_misses_total{...} N` com N > 0.

### Validar cache hit L2

Métricas resetam a 0 no restart (novo processo). Verificar valor absoluto no novo processo após warmAll() rodar, não comparar com processo anterior.

```powershell
# Garantir que Redis tem os produtos
Invoke-RestMethod http://localhost:3000/products | Out-Null

# Restart — limpa L1; warmAll() lê cada product:<id> do Redis (L2 hit × N)
docker compose restart app
Start-Sleep -Seconds 8

# Verificar que L2 hits > 0 (gerados pelo warmAll no startup)
(Invoke-WebRequest http://localhost:3000/metrics).Content -split "`n" | Select-String 'cache_hits_total\{layer="l2"'
```

Esperado: `cache_hits_total{layer="l2",...} N` com N > 0.

### Validar checkout criado e confirmado

```powershell
$PRODUCT_ID = (Invoke-RestMethod http://localhost:3000/products).data[0].id
$IDEM = node -e "console.log(require('crypto').randomUUID())"

# Garantir estoque disponível — testes de checkout anteriores podem ter zerado o produto
docker compose exec app node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.stockFlow.updateMany({where:{productId:'$PRODUCT_ID'},data:{quantity:10}}).then(()=>p.stockReservation.deleteMany({where:{productId:'$PRODUCT_ID'}})).then(()=>{console.log('ok');process.exit(0)})"
docker compose exec redis redis-cli DEL "product:$PRODUCT_ID"
docker compose restart app
Start-Sleep -Seconds 8

$metrics = (Invoke-WebRequest http://localhost:3000/metrics).Content -split "`n"
$BEFORE_CREATED   = [int]($metrics | Select-String "^checkout_orders_created_total\{").ToString().Split(" ")[1]
$BEFORE_CONFIRMED = [int]($metrics | Select-String "^checkout_orders_confirmed_total\{").ToString().Split(" ")[1]

$body = @{
    customerId = "c"
    items = @(@{ productId = $PRODUCT_ID; quantity = 1 })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post http://localhost:3000/checkout `
    -Headers @{ "Content-Type" = "application/json"; "idempotency-key" = $IDEM } `
    -Body $body | Out-Null

Start-Sleep -Seconds 10

$metrics = (Invoke-WebRequest http://localhost:3000/metrics).Content -split "`n"
$AFTER_CREATED   = [int]($metrics | Select-String "^checkout_orders_created_total\{").ToString().Split(" ")[1]
$AFTER_CONFIRMED = [int]($metrics | Select-String "^checkout_orders_confirmed_total\{").ToString().Split(" ")[1]

Write-Output "created:   $BEFORE_CREATED -> $AFTER_CREATED  (diff: $($AFTER_CREATED - $BEFORE_CREATED))"
Write-Output "confirmed: $BEFORE_CONFIRMED -> $AFTER_CONFIRMED  (diff: $($AFTER_CONFIRMED - $BEFORE_CONFIRMED))"
```

Esperado: `diff: 1` em ambos. Não reiniciar o app neste teste — BEFORE e AFTER devem ser do mesmo processo.

---

## 2. Prometheus — consultas

Abrir `http://localhost:9090`.

Queries úteis:

```promql
# Taxa de criação de pedidos (por minuto)
rate(checkout_orders_created_total[1m])

# Razão de cache hits vs misses
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))

# Percentil 95 de duração do job de checkout
histogram_quantile(0.95, rate(checkout_job_duration_ms_bucket[5m]))

# Total de evições L1
cache_evictions_total
```

Verificar que o target `casecellshop` aparece em **Status → Targets** como `UP`.

---

## 3. Traces — Grafana Tempo

Abrir `http://localhost:3001` (acesso direto, sem login — anonymous Admin habilitado).

### Spans instrumentados

| Span | Gerado por |
|---|---|
| `GET /products` | ProductController |
| `cache.get` | ProductCacheService.getProduct |
| `checkout.create` | CreateCheckoutUseCase |
| `erp.sync.process` | ProcessSyncJobUseCase |

### Como buscar um trace

1. Ir em **Explore → Tempo**
2. Mudar para **Search** (não TraceQL)
3. Filtrar por `service.name = casecellshop`
4. Fazer uma chamada e atualizar:
   ```powershell
   Invoke-RestMethod http://localhost:3000/products | Out-Null
   ```
5. Selecionar trace mais recente

Ou por TraceQL:

```
{span.http.route="/products"}
```

### Validar propagação de contexto

Fazer POST /checkout e buscar trace com span `checkout.create`. Deve conter atributos:
- `customer.id`
- `checkout.items_count`
- `order.id` (após criação)

Se pedido foi idempotente: `checkout.idempotent_hit = true`.

### Sem stack de observabilidade (ConsoleSpanExporter)

```powershell
docker compose logs app | Select-String '"name"' | Select-Object -Last 20
```

Spans aparecem como JSON no stdout.

---

## 4. Logs — Grafana Loki

Abrir `http://localhost:3001` (sem login), **Explore → Loki**.

Query:

```logql
{container="casecellshop-app"}
```

Filtros úteis:

```logql
# Só erros
{container="casecellshop-app"} | json | level="error"

# Logs de sync ERP
{container="casecellshop-app"} |= "erp.sync"

# Logs de cache
{container="casecellshop-app"} |= "cache."

# Erros de processamento de checkout
{container="casecellshop-app"} |= "checkout" | json | level="error"
```

> Nota: Promtail leva alguns segundos após iniciar para indexar os logs existentes. Se a query retornar vazio logo após recriar o container, aguardar 10-15 segundos e reexecutar.

### Campos estruturados (Pino JSON)

Cada log emitido tem pelo menos:

| Campo | Exemplo |
|---|---|
| `level` | `"info"`, `"error"`, `"warn"` |
| `correlationId` | UUID da requisição ou do job |
| `msg` | `"erp.sync.processed"`, `"list-products ok"` |
| `entity` | `"product"` ou `"stock_flow"` (logs ERP) |
| `erpId` | ID do registro no ERP |

---

## 5. Grafana Dashboard provisionado

Abrir `http://localhost:3001 → Dashboards → CaseCellShop`.

Painéis esperados:
- Cache hits/misses por camada (L1 vs L2)
- Pedidos criados e confirmados (rate)
- Duração do job de checkout (histograma)
- Relay cycles e relay enqueued

Gerar tráfego para popular os gráficos:

```powershell
$PRODUCT_ID = (Invoke-RestMethod http://localhost:3000/products).data[0].id

foreach ($i in 1..10) {
    Invoke-RestMethod http://localhost:3000/products | Out-Null

    $idem = node -e "console.log(require('crypto').randomUUID())"
    $body = @{
        customerId = "load"
        items = @(@{ productId = $PRODUCT_ID; quantity = 1 })
    } | ConvertTo-Json -Depth 5

    try {
        Invoke-RestMethod -Method Post http://localhost:3000/checkout `
            -Headers @{ "Content-Type" = "application/json"; "idempotency-key" = $idem } `
            -Body $body | Out-Null
    } catch {}

    Start-Sleep -Seconds 1
}
```

---

## Checklist rápido

| Verificação | Esperado |
|---|---|
| `GET /metrics` retorna texto Prometheus | sim |
| `cache_misses_total` incrementa após flush + chamada | sim |
| `cache_hits_total{layer="l2"}` incrementa após restart + chamada | sim |
| `checkout_orders_created_total` incrementa após POST | sim |
| `checkout_orders_confirmed_total` incrementa ~10s depois | sim |
| Prometheus target `casecellshop` status `UP` | sim |
| Trace `GET /products` aparece no Tempo | sim (com OTEL_EXPORTER_OTLP_ENDPOINT) |
| Span `cache.get` aninhado dentro de `GET /products` | sim |
| Span `checkout.create` com atributo `order.id` | sim |
| Logs JSON aparecem no Loki | sim |
| Dashboard CaseCellShop mostra dados | sim (após gerar tráfego) |
