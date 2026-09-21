# Checkout Assíncrono — Design Spec

**Data:** 2026-09-20

---

## Objetivo

Implementar fluxo de checkout assíncrono: reserva de estoque imediata, persistência do pedido via Transactional Outbox, processamento simulado em background com atualização de status. Sistema retorna 202 Accepted sem aguardar o faturamento.

---

## Módulo

Novo módulo `src/modules/checkout/`. Segue padrão dos módulos existentes (`catalog`, `erp-adapter`): ports em `repositories/`, use cases em `use-cases/`, infra em `infra/persistence/`, `infra/http/` e `infra/queue/`, wiring em `container.ts`.

---

## Modelo de Dados (Prisma)

### `orders`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | gerado pelo servidor |
| `customerId` | String | para rastreabilidade |
| `correlationId` | String | body ou gerado pelo servidor |
| `idempotencyKey` | String UNIQUE | header `Idempotency-Key` |
| `status` | Enum | PENDING, PROCESSING, CONFIRMED, FAILED, FAILED_PERMANENT |
| `attempts` | Int | default 0 |
| `lastError` | String? | mensagem do último erro |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

### `order_items`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `orderId` | FK orders | |
| `productId` | FK products | |
| `quantity` | Int | |

### `stock_reservations`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `orderId` | FK orders | |
| `productId` | FK products | |
| `quantity` | Int | |
| `expiresAt` | DateTime | now + 10 minutos |
| `releasedAt` | DateTime? | null = reserva ativa |

**Estoque disponível:**
```
availableForSale =
  SUM(stockFlow.quantity)
  - SUM(stock_reservations.quantity WHERE expiresAt > NOW() AND releasedAt IS NULL)
```

Expiração é lazy — sem scheduler de limpeza. Query sempre filtra `expiresAt > NOW()`.

### `checkout_outbox`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `orderId` | FK orders UNIQUE | |
| `status` | Enum | PENDING, ENQUEUED, PROCESSED, DEAD |
| `attempts` | Int | default 0 |
| `nextRetryAt` | DateTime? | |
| `error` | String? | |
| `createdAt` | DateTime | |

Separado do `outbox` existente (erp-adapter, semântica diferente).

---

## Endpoints

### POST /checkout

**Request:**
```
Header: Idempotency-Key: <UUID> (obrigatório)
Body: {
  customerId: string,
  correlationId?: string,
  items: [{ productId: string, quantity: number }]
}
```

**Fluxo:**
1. Valida `Idempotency-Key` — formato UUID; 400 se inválido ou ausente
2. Busca `Order` com esse `idempotencyKey` — se existir, retorna 202 imediato (sem reprocessar)
3. Para cada item: verifica produto existe e `availableForSale >= quantity` — 409 se não
4. Transação única: cria `Order` (PENDING) + `OrderItem[]` + `StockReservation[]` (expiresAt = now + 10min) + `checkout_outbox` (PENDING)
5. Retorna 202: `{ orderId, status: "PENDING", createdAt }`

**Erros:**
- 400: `Idempotency-Key` ausente ou formato inválido
- 404: produto não existe
- 409: estoque insuficiente

### GET /orders/:orderId/status

**Request:** sem autenticação

**Fluxo:**
1. Busca `Order` pelo `orderId`
2. 404 se não existe
3. Retorna: `{ orderId, status, attempts, lastError, createdAt, updatedAt }`

---

## Processamento Assíncrono

### Relay (outbox → BullMQ)

- Intervalo: 5 segundos
- Poll: busca `checkout_outbox` com status PENDING
- Para cada registro: publica job na queue `checkout-processing`, marca status ENQUEUED

### Worker BullMQ (queue: `checkout-processing`)

Simula faturamento no ERP com delays entre steps:

1. Busca `Order`, seta status PROCESSING
2. Delay 1s — simula validação ERP
3. Delay 1s — simula reserva no ERP
4. Delay 1s — simula faturamento ERP
5. Seta status CONFIRMED
6. Libera reservas: `releasedAt = NOW()` em todas `StockReservation` do order
7. Cria `StockFlow` negativo (movimento real de saída de estoque)
8. Marca `checkout_outbox` PROCESSED

**Em erro (após max retries):**
- Seta status FAILED_PERMANENT
- `releasedAt = NOW()` nas reservas (devolve estoque)
- Sem `StockFlow`
- Marca `checkout_outbox` DEAD

**Retry:** exponential backoff via BullMQ. Max retries: 3.

---

## Estrutura de Arquivos

```
src/modules/checkout/
  domain/
    value-objects/
      order-status.ts               # enum OrderStatus
  dtos/
    checkout-dto.ts                 # CreateCheckoutInput, CreateCheckoutOutput
    order-status-dto.ts             # GetOrderStatusOutput
  errors/
    insufficient-stock-error.ts
    order-not-found-error.ts
    duplicate-idempotency-key-error.ts  # não exposto ao HTTP; usado internamente
  repositories/
    order-repository.ts             # IOrderRepository (interface)
    stock-reservation-repository.ts # IStockReservationRepository (interface)
    checkout-outbox-repository.ts   # ICheckoutOutboxRepository (interface)
  use-cases/
    create-checkout/
      create-checkout.ts
      in-memory-order-repository.ts
      in-memory-stock-reservation-repository.ts
      in-memory-checkout-outbox-repository.ts
      create-checkout.spec.ts
    get-order-status/
      get-order-status.ts
      in-memory-order-repository.ts   # reutiliza do create-checkout se idêntico
      get-order-status.spec.ts
    process-checkout-job/
      process-checkout-job.ts
      in-memory-order-repository.ts
      in-memory-stock-reservation-repository.ts
      in-memory-checkout-outbox-repository.ts
      process-checkout-job.spec.ts
  infra/
    persistence/
      prisma-order-repository.ts
      prisma-stock-reservation-repository.ts
      prisma-checkout-outbox-repository.ts
    http/
      checkout-controller.ts         # POST /checkout
      order-status-controller.ts     # GET /orders/:orderId/status
    queue/
      bullmq-checkout-relay.ts       # outbox poller
      bullmq-checkout-worker.ts      # job consumer
  container.ts
```

---

## Interfaces dos Repositórios

### IOrderRepository

```typescript
interface IOrderRepository {
  findByIdempotencyKey(key: string): Promise<Order | null>
  findById(id: string): Promise<Order | null>
  create(data: CreateOrderData): Promise<Order>
  updateStatus(id: string, status: OrderStatus, opts?: { attempts?: number; lastError?: string }): Promise<void>
}
```

### IStockReservationRepository

```typescript
interface IStockReservationRepository {
  getActiveQuantity(productId: string): Promise<number>  // SUM(quantity WHERE ativa)
  createMany(reservations: CreateReservationData[]): Promise<void>
  releaseByOrderId(orderId: string): Promise<void>  // releasedAt = NOW()
}
```

### ICheckoutOutboxRepository

```typescript
interface ICheckoutOutboxRepository {
  create(orderId: string): Promise<void>
  markEnqueued(id: string): Promise<void>
  markProcessed(id: string): Promise<void>
  markDead(id: string, error: string): Promise<void>
  findPending(): Promise<CheckoutOutboxEntry[]>
}
```

---

## Estratégia de Testes

### `create-checkout.spec.ts`

- Checkout válido → 202, Order PENDING, reservas criadas, outbox criado
- `Idempotency-Key` duplicado → retorna Order existente sem criar nada
- Produto não existe → `ProductNotFoundError`
- Estoque insuficiente → `InsufficientStockError`
- Reservas expiradas (`expiresAt` no passado) não bloqueiam estoque
- `correlationId` ausente → gerado pelo use case

### `get-order-status.spec.ts`

- Order existente → retorna campos corretos
- `orderId` inexistente → `OrderNotFoundError`

### `process-checkout-job.spec.ts`

- Job bem-sucedido → status CONFIRMED, reservas liberadas, StockFlow criado
- Job com erro após max retries → FAILED_PERMANENT, reservas liberadas, sem StockFlow
- `attempts` incrementado a cada execução

### Fora do escopo de unit tests

- Relay outbox → BullMQ (infra pura, sem lógica de domínio)
- Delays do mock ERP (comportamento intencional)
- Registro de rotas Swagger

---

## Constraints Globais

- TypeScript estrito
- tsyringe DI: `useValue` para instâncias, `@inject()` nos construtores
- Either monad: use cases retornam `Either<DomainError, Output>`
- In-memory repositories para testes (sem mocks de framework)
- Commit por entregável testado (TDD: red → green → commit)
- `erp-adapter` não importa `catalog`; `checkout` não importa `catalog` diretamente
- Nomes de arquivos de interface: sem prefixo `i-` no nome do arquivo (ex: `order-repository.ts`), interface com prefixo `I` (ex: `IOrderRepository`)
- BullMQ queue `checkout-processing` (nova, separada de `erp-sync`)
- `checkout_outbox` separado do `outbox` existente
