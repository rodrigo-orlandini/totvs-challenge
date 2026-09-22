# Testes manuais — Vitrine (GET /products)

## Pré-requisitos

Containers rodando (`docker compose up -d`), migrations e seed executados:

```powershell
# Migrations em ambos os bancos
docker compose exec app npm run db:migrate
docker compose exec app npm run db:migrate:erp

# Seed apenas no banco ERP — dados chegam ao banco da loja via sync
docker compose exec app npm run db:seed:erp
```

O seed popula o banco ERP com 100 produtos e stock_flows. O poller detecta as entradas, grava no outbox e enfileira jobs no BullMQ (`erp-sync`). Aguardar processamento antes de testar:

```powershell
# Monitorar jobs até zerar "waiting" e "active"
# Abrir http://localhost:3000/admin/queues → fila erp-sync

# Ou verificar contagem diretamente
docker compose exec app node -e "const {Queue}=require('bullmq');const q=new Queue('erp-sync',{connection:{host:'casecellshop-redis',port:6379}});q.getJobCounts().then(c=>{console.log(c);process.exit(0)})"
```

Esperado após sync completo: `waiting: 0`, `active: 0`, `completed: N`.

---

## 1. Listagem básica

```powershell
(Invoke-RestMethod http://localhost:3000/products).meta
```

Esperado: `page: 1`, `limit: 20`, `total: 100`, `totalPages: 5`.

Verificar que `data` retorna 20 itens com campos `id`, `sku`, `name`, `price`, `availableQuantity`:

```powershell
(Invoke-RestMethod http://localhost:3000/products).data | Select-Object -First 3
```

---

## 2. Paginação

```powershell
# Página 2
(Invoke-RestMethod "http://localhost:3000/products?page=2&limit=20").meta

# Última página — verificar count e meta
$r = Invoke-RestMethod "http://localhost:3000/products?page=5&limit=20"
$r.meta
$r.data.Count

# Limite customizado
$r = Invoke-RestMethod "http://localhost:3000/products?limit=5"
$r.meta
$r.data.Count
```

Esperado em página 5: `Count: 20`, `meta.page: 5`, `meta.totalPages: 5`.

---

## 3. Validação de parâmetros inválidos

`Invoke-RestMethod` lança exceção em 4xx. Usar `-SkipHttpErrorCheck` (PowerShell 7+) ou capturar:

```powershell
# page < 1
try { Invoke-RestMethod "http://localhost:3000/products?page=0" } catch { ($_.ErrorDetails.Message | ConvertFrom-Json) }

# limit > 100
try { Invoke-RestMethod "http://localhost:3000/products?limit=200" } catch { ($_.ErrorDetails.Message | ConvertFrom-Json) }

# tipo errado
try { Invoke-RestMethod "http://localhost:3000/products?page=abc" } catch { ($_.ErrorDetails.Message | ConvertFrom-Json) }
```

Esperado: `statusCode: 400` em todos.

---

## 4. Cache L2 (Redis) — estado inicial

Após primeira chamada, o Redis deve ter o sorted set e as chaves dos produtos:

```powershell
# Total de IDs no sorted set (deve ser 100)
docker compose exec redis redis-cli ZCARD products:sorted

# Ver primeiros 5 IDs (mais recentes primeiro)
docker compose exec redis redis-cli ZREVRANGE products:sorted 0 4

# Pegar um ID e verificar a chave do produto
$ID = (docker compose exec redis redis-cli ZREVRANGE products:sorted 0 0).Trim()
docker compose exec redis redis-cli GET "product:$ID" | ConvertFrom-Json

# TTL da chave (deve ser próximo a 600 segundos)
docker compose exec redis redis-cli TTL "product:$ID"
```

---

## 5. Cache hit — confirmação via métricas

### 5a. L1 hit (sem restart)

```powershell
# Primeira chamada — popula L1 e Redis (miss esperado)
Invoke-RestMethod http://localhost:3000/products | Out-Null

# Segunda chamada imediata — L1 já tem os dados (hit esperado)
Invoke-RestMethod http://localhost:3000/products | Out-Null

# Verificar contadores
(Invoke-WebRequest http://localhost:3000/metrics).Content -split "`n" | Select-String "^cache_hits_total"
```

Esperado: `cache_hits_total{layer="l1"}` incrementou. `layer="l2"` ainda não aparece.

### 5b. L2 hit (após restart do app)

L1 é in-memory — é apagado ao reiniciar o container. Redis mantém as chaves (~600s). Reiniciar dentro desse janela força L2 hit na próxima chamada.

```powershell
# Garantir que Redis tem as chaves (passo 4 confirma isso)
# Anotar valor atual de l2 hits (provavelmente ausente = 0)
(Invoke-WebRequest http://localhost:3000/metrics).Content -split "`n" | Select-String "cache_hits_total"

# Reiniciar app — limpa L1 em memória
docker compose restart app
Start-Sleep -Seconds 5

# Primeira chamada após restart — L1 vazia, Redis tem os dados → L2 hit
Invoke-RestMethod http://localhost:3000/products | Out-Null

# Confirmar que l2 agora aparece nas métricas
(Invoke-WebRequest http://localhost:3000/metrics).Content -split "`n" | Select-String "cache_hits_total"
```

Esperado: `cache_hits_total{layer="l2"}` aparece com valor > 0.

Notas:
- `cache_misses_total` — incrementa quando Redis também não tem (cold start ou após flush)
- L2 hit por expiração natural é raro: L1 e Redis têm o mesmo TTL (~600s), janela de diferença é de segundos

---

## 6. Cache miss — flush e rebuild

O sorted set só é recriado quando `resolveIds()` cai no fallback do DB. Isso só acontece se **L1 e Redis estiverem vazios ao mesmo tempo**. A ordem importa: flush Redis **antes** do restart — se qualquer GET ocorrer após restart e antes do flush, L1 é repopulada e o fallback não acontece.

Sequência correta:

```powershell
# 1. Flush Redis primeiro — nenhum GET pode ocorrer entre aqui e o restart
docker compose exec redis redis-cli DEL products:sorted

$keys = docker compose exec redis redis-cli KEYS "product:*"
foreach ($key in $keys) {
    docker compose exec redis redis-cli DEL $key
}

# Confirmar vazio
docker compose exec redis redis-cli ZCARD products:sorted

# 2. Restart app DEPOIS do flush — garante L1 limpa com Redis já vazio
docker compose restart app
Start-Sleep -Seconds 8

# 3. GET imediato — L1 e Redis vazios → fallback DB → setRedisIds chamado
(Invoke-RestMethod http://localhost:3000/products).meta.total

# 4. Confirmar que sorted set foi recriado
docker compose exec redis redis-cli ZCARD products:sorted
```

Esperado: `ZCARD: 0` após flush, `total: 100` e `ZCARD: 100` após o GET.

---

## 7. Consistência pós-ERP sync

```powershell
# Total de produtos no DB principal
docker compose exec app node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.product.count().then(n=>{console.log('DB:',n);process.exit(0)})"

# Total no Redis
docker compose exec redis redis-cli ZCARD products:sorted
```

Se `ZCARD` for maior que o `DB count`, o sorted set tem IDs de produtos que não existem mais. Flush resolve (ver passo 6).

---

## 8. Produto com `availableQuantity: 0`

L1 é in-memory e não pode ser flushed por chave — precisa de restart para garantir que o produto não está em memória. Redis pode ou não ter a chave (DEL retorna 0 se não existia — normal).

```powershell
# Pegar ID de qualquer produto
$ID = (Invoke-RestMethod http://localhost:3000/products).data[0].id

# Zerar stock_flow direto no DB
docker compose exec app node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.stockFlow.updateMany({where:{productId:'$ID'},data:{quantity:0}}).then(()=>{console.log('ok');process.exit(0)})"

# Flush chave Redis do produto (DEL retorna 0 se não existia — normal)
docker compose exec redis redis-cli DEL "product:$ID"

# Restart para limpar L1 em memória
docker compose restart app
Start-Sleep -Seconds 8

# GET após restart — L1 vazia, Redis vazia para esse produto → DB read com quantity=0
(Invoke-RestMethod http://localhost:3000/products).data | Where-Object { $_.id -eq $ID }
```

---

## Checklist rápido

| Teste | Esperado |
|---|---|
| `GET /products` | 200, `total: 100` |
| `?page=0` | 400 |
| `?limit=200` | 400 |
| `ZCARD products:sorted` após 1ª call | 100 |
| 2ª call consecutiva incrementa `cache_hits_total` | sim |
| Flush + call reconstrói sorted set | sim |
| `ZCARD` == `DB count` | sim |
