# Testes manuais — Checkout

## Pré-requisitos

Containers rodando, migrations executadas e dados populados via ERP sync:

```powershell
# Migrations em ambos os bancos
docker compose exec app npm run db:migrate
docker compose exec app npm run db:migrate:erp

# Seed apenas no banco ERP — produtos chegam ao banco da loja via sync
docker compose exec app npm run db:seed:erp
```

Aguardar sync completar antes de testar (acompanhar em `http://localhost:3000/admin/queues → erp-sync`). Só após `waiting: 0` e `active: 0` o `GET /products` retorna dados.

Garantir cache limpo antes de iniciar — keys `product:<id>` podem ter expirado do Redis enquanto o sorted set permanece, causando `data: []`. Flush completo evita falsos negativos:

```powershell
docker compose exec redis redis-cli FLUSHDB
docker compose restart app
Start-Sleep -Seconds 8
```

Pegar um `productId` real para usar nos testes:

```powershell
$PRODUCT_ID = (Invoke-RestMethod http://localhost:3000/products).data[0].id
Write-Output $PRODUCT_ID
```

---

## 1. Checkout com sucesso (caminho feliz)

```powershell
$IDEM_KEY = node -e "console.log(require('crypto').randomUUID())"

$body = @{
    customerId = "customer-001"
    items = @(@{ productId = $PRODUCT_ID; quantity = 1 })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post http://localhost:3000/checkout `
    -Headers @{ "Content-Type" = "application/json"; "idempotency-key" = $IDEM_KEY } `
    -Body $body
```

Esperado: HTTP 202 com body `{ orderId, status: "PENDING", createdAt }`.

Salvar o `orderId` para os próximos testes:

```powershell
$ORDER_ID = "<valor do orderId acima>"
```

---

## 2. Consultar status do pedido

```powershell
Invoke-RestMethod "http://localhost:3000/orders/$ORDER_ID/status"
```

Esperado logo após criação: `status: PENDING`.

Após processamento pela fila (5-15 segundos): `status: CONFIRMED`.

Verificar no BullBoard: `http://localhost:3000/admin/queues` — fila `checkout` deve mostrar o job como `completed`.

---

## 3. Idempotência — mesma key, segunda chamada

```powershell
$body = @{
    customerId = "customer-001"
    items = @(@{ productId = $PRODUCT_ID; quantity = 1 })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post http://localhost:3000/checkout `
    -Headers @{ "Content-Type" = "application/json"; "idempotency-key" = $IDEM_KEY } `
    -Body $body
```

Esperado: HTTP 202, **mesmo `orderId`**, sem criar novo pedido.

Verificar no DB:

```powershell
docker compose exec app node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.order.findMany({where:{idempotencyKey:'$IDEM_KEY'}}).then(r=>{console.log('count:',r.length);process.exit(0)})"
```

Esperado: `count: 1`.

---

## 4. Múltiplos itens

```powershell
$PRODUCT_ID_2 = (Invoke-RestMethod http://localhost:3000/products).data[1].id
$IDEM_KEY2 = node -e "console.log(require('crypto').randomUUID())"

$body = @{
    customerId = "customer-002"
    items = @(
        @{ productId = $PRODUCT_ID; quantity = 2 },
        @{ productId = $PRODUCT_ID_2; quantity = 3 }
    )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post http://localhost:3000/checkout `
    -Headers @{ "Content-Type" = "application/json"; "idempotency-key" = $IDEM_KEY2 } `
    -Body $body
```

Esperado: 202 com novo `orderId`. Verificar `status: CONFIRMED` após processamento.

---

## 5. Falha — `idempotency-key` ausente

```powershell
$body = @{
    customerId = "c"
    items = @(@{ productId = $PRODUCT_ID; quantity = 1 })
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Method Post http://localhost:3000/checkout `
        -Headers @{ "Content-Type" = "application/json" } `
        -Body $body
} catch {
    $_.ErrorDetails.Message | ConvertFrom-Json
}
```

Esperado: `statusCode: 400`, `message: "Header Idempotency-Key must be a valid UUID"`.

---

## 6. Falha — `idempotency-key` inválida (não UUID)

```powershell
try {
    Invoke-RestMethod -Method Post http://localhost:3000/checkout `
        -Headers @{ "Content-Type" = "application/json"; "idempotency-key" = "nao-e-uuid" } `
        -Body $body
} catch {
    $_.ErrorDetails.Message | ConvertFrom-Json
}
```

Esperado: `statusCode: 400`, mesmo erro de UUID inválido.

---

## 7. Falha — produto não existe

```powershell
$IDEM_KEY3 = node -e "console.log(require('crypto').randomUUID())"

$body = @{
    customerId = "c"
    items = @(@{ productId = "00000000-0000-0000-0000-000000000000"; quantity = 1 })
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Method Post http://localhost:3000/checkout `
        -Headers @{ "Content-Type" = "application/json"; "idempotency-key" = $IDEM_KEY3 } `
        -Body $body
} catch {
    $_.ErrorDetails.Message | ConvertFrom-Json
}
```

Esperado: `statusCode: 404`, `error: "PRODUCT_NOT_FOUND"`.

---

## 8. Falha — estoque insuficiente

Forçar estoque zero em um produto:

```powershell
docker compose exec app node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.stockFlow.updateMany({where:{productId:'$PRODUCT_ID'},data:{quantity:0}}).then(()=>p.stockReservation.deleteMany({where:{productId:'$PRODUCT_ID'}})).then(()=>{console.log('ok');process.exit(0)})"

# Flush cache para o produto
docker compose exec redis redis-cli DEL "product:$PRODUCT_ID"

$IDEM_KEY4 = node -e "console.log(require('crypto').randomUUID())"

$body = @{
    customerId = "c"
    items = @(@{ productId = $PRODUCT_ID; quantity = 1 })
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Method Post http://localhost:3000/checkout `
        -Headers @{ "Content-Type" = "application/json"; "idempotency-key" = $IDEM_KEY4 } `
        -Body $body
} catch {
    $_.ErrorDetails.Message | ConvertFrom-Json
}
```

Esperado: `statusCode: 409`, `error: "INSUFFICIENT_STOCK"`.

---

## 9. Reserva de estoque — verificar no DB

Criar pedido novo com produto diferente (`data[1]`) e consultar reservas **imediatamente**, antes do job processar (~15s). Não usar `$ORDER_ID` do step 1 — step 8 deletou as reservas de `$PRODUCT_ID`.

```powershell
$PRODUCT_ID_9 = (Invoke-RestMethod http://localhost:3000/products).data[1].id
$IDEM_KEY9 = node -e "console.log(require('crypto').randomUUID())"

$body = @{
    customerId = "customer-step9"
    items = @(@{ productId = $PRODUCT_ID_9; quantity = 1 })
} | ConvertTo-Json -Depth 5

$r = Invoke-RestMethod -Method Post http://localhost:3000/checkout `
    -Headers @{ "Content-Type" = "application/json"; "idempotency-key" = $IDEM_KEY9 } `
    -Body $body

$ORDER_ID_9 = $r.orderId

# Imediatamente — reserva deve existir com releasedAt: null
docker compose exec app node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.stockReservation.findMany({where:{orderId:'$ORDER_ID_9'}}).then(r=>{console.log(JSON.stringify(r,null,2));process.exit(0)})"
```

Esperado: reserva com `releasedAt: null` e `expiresAt` ~10 minutos no futuro.

Após `status: CONFIRMED` (~15s), consultar novamente — `releasedAt` deve estar preenchido:

```powershell
Start-Sleep -Seconds 15
docker compose exec app node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.stockReservation.findMany({where:{orderId:'$ORDER_ID_9'},select:{releasedAt:true}}).then(r=>{console.log(r);process.exit(0)})"
```

---

## 10. Fila checkout — verificar no BullBoard

1. Abrir `http://localhost:3000/admin/queues`
2. Selecionar fila `checkout`
3. Após POST /checkout: job deve aparecer em `waiting` ou `active`
4. Após processamento: job move para `completed`
5. Em caso de erro: job vai para `failed` com mensagem de erro

Via CLI:

```powershell
docker compose exec app node -e "const {Queue}=require('bullmq');const q=new Queue('checkout',{connection:{host:'casecellshop-redis',port:6379}});q.getJobCounts().then(c=>{console.log(c);process.exit(0)})"
```

---

## 11. Pedido inexistente

```powershell
try {
    Invoke-RestMethod "http://localhost:3000/orders/00000000-0000-0000-0000-000000000000/status"
} catch {
    $_.ErrorDetails.Message | ConvertFrom-Json
}
```

Esperado: `statusCode: 404`, `error: "ORDER_NOT_FOUND"`.

---

## 12. Concorrência — mesmo produto, duas requisições simultâneas

Simula dois clientes comprando o último item disponível:

```powershell
# Setar estoque = 1 (zerar todos os stock_flows, depois um único para 1)
# updateMany({quantity:1}) daria N total se há N linhas — por isso zerar primeiro
docker compose exec app node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.stockFlow.updateMany({where:{productId:'$PRODUCT_ID'},data:{quantity:0}}).then(()=>p.stockFlow.findFirst({where:{productId:'$PRODUCT_ID'}})).then(sf=>p.stockFlow.update({where:{id:sf.id},data:{quantity:1}})).then(()=>p.stockReservation.deleteMany({where:{productId:'$PRODUCT_ID'}})).then(()=>{console.log('ok');process.exit(0)})"
docker compose exec redis redis-cli DEL "product:$PRODUCT_ID"
docker compose restart app
Start-Sleep -Seconds 8

$KEY_A = node -e "console.log(require('crypto').randomUUID())"
$KEY_B = node -e "console.log(require('crypto').randomUUID())"

# Disparar os dois simultaneamente via Start-Job
$jobA = Start-Job -ScriptBlock {
    param($prodId, $key)
    $body = "{`"customerId`":`"A`",`"items`":[{`"productId`":`"$prodId`",`"quantity`":1}]}"
    try {
        Invoke-RestMethod -Method Post http://localhost:3000/checkout `
            -Headers @{ "Content-Type" = "application/json"; "idempotency-key" = $key } `
            -Body $body
    } catch { $_.ErrorDetails.Message | ConvertFrom-Json }
} -ArgumentList $PRODUCT_ID, $KEY_A

$jobB = Start-Job -ScriptBlock {
    param($prodId, $key)
    $body = "{`"customerId`":`"B`",`"items`":[{`"productId`":`"$prodId`",`"quantity`":1}]}"
    try {
        Invoke-RestMethod -Method Post http://localhost:3000/checkout `
            -Headers @{ "Content-Type" = "application/json"; "idempotency-key" = $key } `
            -Body $body
    } catch { $_.ErrorDetails.Message | ConvertFrom-Json }
} -ArgumentList $PRODUCT_ID, $KEY_B

$jobA, $jobB | Wait-Job | Receive-Job
```

Esperado: um retorna `status: PENDING` (202), o outro retorna `error: INSUFFICIENT_STOCK` (409). Nunca dois 202 para estoque 1.

---

## Checklist rápido

| Teste | Esperado |
|---|---|
| POST sem `idempotency-key` | 400 |
| POST com key não-UUID | 400 |
| POST produto inexistente | 404 |
| POST estoque zerado | 409 |
| POST válido | 202, `status: PENDING` |
| GET status logo após | `PENDING` |
| GET status após ~15s | `CONFIRMED` |
| Repetir POST com mesma key | 202, mesmo `orderId` |
| DB: reservas liberadas após CONFIRMED | `releasedAt` preenchido |
| BullBoard: job `completed` | sim |
| Concorrência 2x estoque 1 | um 202, um 409 |
