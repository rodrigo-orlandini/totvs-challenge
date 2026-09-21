# Checkout Assíncrono — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement async checkout flow with soft stock reservation, Transactional Outbox, BullMQ worker with mock ERP delays, and order status polling endpoint.

**Architecture:** New `checkout` module following the existing `catalog`/`erp-adapter` pattern. `POST /checkout` creates Order + StockReservations + CheckoutOutbox in one DB transaction and returns 202. BullMQ relay polls the outbox and publishes jobs to queue `checkout-processing`. Worker simulates ERP with 1s delays between steps before setting CONFIRMED. `GET /orders/:orderId/status` is public (no auth).

**Tech Stack:** TypeScript, Fastify, Prisma (PostgreSQL), BullMQ (Redis), tsyringe DI, Vitest, Either monad

**Spec:** `docs/superpowers/specs/2026-09-20-checkout-assincrono-design.md`

## Global Constraints

- TypeScript strict mode
- tsyringe DI: `useValue` for instances, `@inject('ITokenName')` decorators in constructors
- Either monad: use cases return `Either<DomainError, Output>` via `left(err)` / `right(val)`
- In-memory repositories for unit tests — no framework mocks, no `vi.mock()`
- TDD: write failing test → run → implement → pass → commit
- `checkout` module must not import from `catalog` or `erp-adapter` modules
- Interface files use no `i-` prefix in filename (e.g., `order-repository.ts`); interface type has `I` prefix (e.g., `IOrderRepository`)
- BullMQ queue name for checkout: `checkout-processing` (separate from `erp-sync`)
- `checkout_outbox` table is separate from `outbox` table
- Commit after each task's tests pass

---

## File Map

**Create:**
- `prisma/migrations/<timestamp>_add_checkout_tables/migration.sql` (auto-generated)
- `src/modules/checkout/domain/value-objects/order-status.ts`
- `src/modules/checkout/errors/insufficient-stock-error.ts`
- `src/modules/checkout/errors/order-not-found-error.ts`
- `src/modules/checkout/errors/product-not-found-error.ts`
- `src/modules/checkout/repositories/order-repository.ts`
- `src/modules/checkout/repositories/stock-reservation-repository.ts`
- `src/modules/checkout/repositories/checkout-outbox-repository.ts`
- `src/modules/checkout/repositories/product-stock-checker.ts`
- `src/modules/checkout/repositories/checkout-stock-flow-writer.ts`
- `src/modules/checkout/dtos/checkout-dto.ts`
- `src/modules/checkout/dtos/order-status-dto.ts`
- `src/modules/checkout/use-cases/create-checkout/in-memory-order-repository.ts`
- `src/modules/checkout/use-cases/create-checkout/in-memory-stock-reservation-repository.ts`
- `src/modules/checkout/use-cases/create-checkout/in-memory-checkout-outbox-repository.ts`
- `src/modules/checkout/use-cases/create-checkout/in-memory-product-stock-checker.ts`
- `src/modules/checkout/use-cases/create-checkout/create-checkout.ts`
- `src/modules/checkout/use-cases/create-checkout/create-checkout.spec.ts`
- `src/modules/checkout/use-cases/get-order-status/get-order-status.ts`
- `src/modules/checkout/use-cases/get-order-status/get-order-status.spec.ts`
- `src/modules/checkout/use-cases/process-checkout-job/in-memory-checkout-stock-flow-writer.ts`
- `src/modules/checkout/use-cases/process-checkout-job/process-checkout-job.ts`
- `src/modules/checkout/use-cases/process-checkout-job/process-checkout-job.spec.ts`
- `src/modules/checkout/infra/persistence/prisma-order-repository.ts`
- `src/modules/checkout/infra/persistence/prisma-stock-reservation-repository.ts`
- `src/modules/checkout/infra/persistence/prisma-checkout-outbox-repository.ts`
- `src/modules/checkout/infra/persistence/prisma-product-stock-checker.ts`
- `src/modules/checkout/infra/persistence/prisma-checkout-stock-flow-writer.ts`
- `src/modules/checkout/infra/http/checkout-controller.ts`
- `src/modules/checkout/infra/http/order-status-controller.ts`
- `src/modules/checkout/infra/queue/bullmq-checkout-relay.ts`
- `src/modules/checkout/infra/queue/bullmq-checkout-worker.ts`
- `src/modules/checkout/container.ts`

**Modify:**
- `prisma/schema.prisma` — add Order, OrderItem, StockReservation, CheckoutOutbox models + enums
- `src/shared/errors/http-error-mapper.ts` — add INSUFFICIENT_STOCK + PRODUCT_NOT_FOUND codes
- `src/infra/http/server.ts` — register checkout + order-status routes; add checkout-processing to BullBoard
- `src/main.ts` — register checkout module, start checkout relay + worker

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Auto-create: migration via `npx prisma migrate dev`

**Interfaces:**
- Produces: `Order`, `OrderItem`, `StockReservation`, `CheckoutOutbox` Prisma models for Task 6

- [ ] **Step 1: Add enums and models to schema**

Open `prisma/schema.prisma` and append after the existing `Outbox` model:

```prisma
enum OrderStatus {
  PENDING
  PROCESSING
  CONFIRMED
  FAILED
  FAILED_PERMANENT
}

enum CheckoutOutboxStatus {
  PENDING
  ENQUEUED
  PROCESSED
  DEAD
}

model Order {
  id             String      @id @default(uuid())
  customerId     String      @map("customer_id")
  correlationId  String      @map("correlation_id")
  idempotencyKey String      @unique @map("idempotency_key")
  status         OrderStatus @default(PENDING)
  attempts       Int         @default(0)
  lastError      String?     @map("last_error")
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")
  items          OrderItem[]
  reservations   StockReservation[]
  outbox         CheckoutOutbox?

  @@map("orders")
}

model OrderItem {
  id        String @id @default(uuid())
  orderId   String @map("order_id")
  productId String @map("product_id")
  quantity  Int
  order     Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("order_items")
}

model StockReservation {
  id         String    @id @default(uuid())
  orderId    String    @map("order_id")
  productId  String    @map("product_id")
  quantity   Int
  expiresAt  DateTime  @map("expires_at")
  releasedAt DateTime? @map("released_at")
  order      Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([productId, expiresAt, releasedAt])
  @@map("stock_reservations")
}

model CheckoutOutbox {
  id          String              @id @default(uuid())
  orderId     String              @unique @map("order_id")
  status      CheckoutOutboxStatus @default(PENDING)
  attempts    Int                 @default(0)
  nextRetryAt DateTime?           @map("next_retry_at")
  error       String?
  createdAt   DateTime            @default(now()) @map("created_at")
  order       Order               @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("checkout_outbox")
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_checkout_tables
```

Expected: migration file created, `prisma generate` runs automatically, no errors.

- [ ] **Step 3: Verify generated client**

```bash
npx prisma validate
```

Expected: "The schema at prisma/schema.prisma is valid"

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add checkout tables to prisma schema"
```

---

### Task 2: Domain errors + interfaces + DTOs

**Files:**
- Create: `src/modules/checkout/domain/value-objects/order-status.ts`
- Create: `src/modules/checkout/errors/insufficient-stock-error.ts`
- Create: `src/modules/checkout/errors/order-not-found-error.ts`
- Create: `src/modules/checkout/errors/product-not-found-error.ts`
- Create: `src/modules/checkout/repositories/order-repository.ts`
- Create: `src/modules/checkout/repositories/stock-reservation-repository.ts`
- Create: `src/modules/checkout/repositories/checkout-outbox-repository.ts`
- Create: `src/modules/checkout/repositories/product-stock-checker.ts`
- Create: `src/modules/checkout/repositories/checkout-stock-flow-writer.ts`
- Create: `src/modules/checkout/dtos/checkout-dto.ts`
- Create: `src/modules/checkout/dtos/order-status-dto.ts`
- Modify: `src/shared/errors/http-error-mapper.ts`

**Interfaces:**
- Produces: `OrderStatus`, `IOrderRepository`, `IStockReservationRepository`, `ICheckoutOutboxRepository`, `IProductStockChecker`, `ICheckoutStockFlowWriter`, `CreateCheckoutInput`, `CreateCheckoutOutput`, `GetOrderStatusOutput` — consumed by Tasks 3, 4, 5, 6

- [ ] **Step 1: Create order-status.ts**

```typescript
// src/modules/checkout/domain/value-objects/order-status.ts
export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  FAILED_PERMANENT = 'FAILED_PERMANENT',
}
```

- [ ] **Step 2: Create error files**

```typescript
// src/modules/checkout/errors/insufficient-stock-error.ts
import { DomainError } from '@shared/errors/domain-error'

export class InsufficientStockError extends DomainError {
  readonly code = 'INSUFFICIENT_STOCK'

  constructor(productId: string, requested: number, available: number) {
    super(`Insufficient stock for product ${productId}: requested ${requested}, available ${available}`)
  }
}
```

```typescript
// src/modules/checkout/errors/order-not-found-error.ts
import { DomainError } from '@shared/errors/domain-error'

export class OrderNotFoundError extends DomainError {
  readonly code = 'ORDER_NOT_FOUND'

  constructor(orderId: string) {
    super(`Order ${orderId} not found`)
  }
}
```

```typescript
// src/modules/checkout/errors/product-not-found-error.ts
import { DomainError } from '@shared/errors/domain-error'

export class ProductNotFoundError extends DomainError {
  readonly code = 'PRODUCT_NOT_FOUND'

  constructor(productId: string) {
    super(`Product ${productId} not found`)
  }
}
```

- [ ] **Step 3: Create repository interfaces**

```typescript
// src/modules/checkout/repositories/order-repository.ts
import type { OrderStatus } from '../domain/value-objects/order-status'

export interface OrderItem {
  productId: string
  quantity: number
}

export interface Order {
  id: string
  customerId: string
  correlationId: string
  idempotencyKey: string
  status: OrderStatus
  attempts: number
  lastError: string | null
  createdAt: Date
  updatedAt: Date
  items: OrderItem[]
}

export interface CreateOrderData {
  id: string
  customerId: string
  correlationId: string
  idempotencyKey: string
  items: Array<{ productId: string; quantity: number }>
  reservations: Array<{ id: string; productId: string; quantity: number; expiresAt: Date }>
}

export interface IOrderRepository {
  findByIdempotencyKey(key: string): Promise<Order | null>
  findById(id: string): Promise<Order | null>
  createWithReservationsAndOutbox(data: CreateOrderData): Promise<Order>
  updateStatus(id: string, status: OrderStatus, opts?: { attempts?: number; lastError?: string | null }): Promise<void>
}
```

```typescript
// src/modules/checkout/repositories/stock-reservation-repository.ts
export interface IStockReservationRepository {
  getActiveQuantity(productId: string): Promise<number>
  releaseByOrderId(orderId: string): Promise<void>
}
```

```typescript
// src/modules/checkout/repositories/checkout-outbox-repository.ts
export interface CheckoutOutboxEntry {
  id: string
  orderId: string
}

export interface ICheckoutOutboxRepository {
  markEnqueued(id: string): Promise<void>
  markProcessed(id: string): Promise<void>
  markDead(id: string, error: string): Promise<void>
  findPending(): Promise<CheckoutOutboxEntry[]>
}
```

```typescript
// src/modules/checkout/repositories/product-stock-checker.ts
export interface ProductStockInfo {
  exists: boolean
  availableQuantity: number
}

export interface IProductStockChecker {
  getProductStock(productId: string): Promise<ProductStockInfo>
}
```

```typescript
// src/modules/checkout/repositories/checkout-stock-flow-writer.ts
export interface ICheckoutStockFlowWriter {
  createSaleFlow(productId: string, quantity: number): Promise<void>
}
```

- [ ] **Step 4: Create DTOs**

```typescript
// src/modules/checkout/dtos/checkout-dto.ts
import type { OrderStatus } from '../domain/value-objects/order-status'

export interface CheckoutItem {
  productId: string
  quantity: number
}

export interface CreateCheckoutInput {
  idempotencyKey: string
  customerId: string
  correlationId?: string
  items: CheckoutItem[]
}

export interface CreateCheckoutOutput {
  orderId: string
  status: OrderStatus
  createdAt: Date
}
```

```typescript
// src/modules/checkout/dtos/order-status-dto.ts
import type { OrderStatus } from '../domain/value-objects/order-status'

export interface GetOrderStatusOutput {
  orderId: string
  status: OrderStatus
  attempts: number
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Step 5: Update http-error-mapper**

Open `src/shared/errors/http-error-mapper.ts` and add two entries to `HTTP_STATUS_MAP`:

```typescript
const HTTP_STATUS_MAP: Record<string, number> = {
  NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  ORDER_NOT_FOUND: 404,
  DUPLICATE_ORDER: 409,
  VALIDATION_ERROR: 422,
  ERP_UNAVAILABLE: 503,
  INSUFFICIENT_STOCK: 409,
  PRODUCT_NOT_FOUND: 404,
}
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/checkout/ src/shared/errors/http-error-mapper.ts
git commit -m "feat: add checkout domain errors, interfaces, and DTOs"
```

---

### Task 3: CreateCheckout use case

**Files:**
- Create: `src/modules/checkout/use-cases/create-checkout/in-memory-order-repository.ts`
- Create: `src/modules/checkout/use-cases/create-checkout/in-memory-stock-reservation-repository.ts`
- Create: `src/modules/checkout/use-cases/create-checkout/in-memory-checkout-outbox-repository.ts`
- Create: `src/modules/checkout/use-cases/create-checkout/in-memory-product-stock-checker.ts`
- Create: `src/modules/checkout/use-cases/create-checkout/create-checkout.ts`
- Create: `src/modules/checkout/use-cases/create-checkout/create-checkout.spec.ts`

**Interfaces:**
- Consumes: `IOrderRepository`, `IStockReservationRepository`, `ICheckoutOutboxRepository`, `IProductStockChecker`, `CreateCheckoutInput`, `CreateCheckoutOutput`, `InsufficientStockError`, `ProductNotFoundError`, `OrderStatus` from Task 2
- Produces: `CreateCheckoutUseCase` — consumed by Task 9

- [ ] **Step 1: Write failing tests**

```typescript
// src/modules/checkout/use-cases/create-checkout/create-checkout.spec.ts
import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { CreateCheckoutUseCase } from './create-checkout'
import { InMemoryOrderRepository } from './in-memory-order-repository'
import { InMemoryStockReservationRepository } from './in-memory-stock-reservation-repository'
import { InMemoryCheckoutOutboxRepository } from './in-memory-checkout-outbox-repository'
import { InMemoryProductStockChecker } from './in-memory-product-stock-checker'
import { OrderStatus } from '../../domain/value-objects/order-status'

describe('CreateCheckoutUseCase', () => {
  let orderRepo: InMemoryOrderRepository
  let reservationRepo: InMemoryStockReservationRepository
  let outboxRepo: InMemoryCheckoutOutboxRepository
  let stockChecker: InMemoryProductStockChecker
  let useCase: CreateCheckoutUseCase

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository()
    reservationRepo = new InMemoryStockReservationRepository()
    outboxRepo = new InMemoryCheckoutOutboxRepository()
    stockChecker = new InMemoryProductStockChecker()
    useCase = new CreateCheckoutUseCase(orderRepo, reservationRepo, outboxRepo, stockChecker)
  })

  it('creates order with status PENDING, reservations, and outbox entry', async () => {
    stockChecker.setStock('prod-1', 10)

    const result = await useCase.execute({
      idempotencyKey: 'key-1',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 3 }],
    })

    expect(result.isSuccess()).toBe(true)
    if (!result.isSuccess()) return
    expect(result.value.status).toBe(OrderStatus.PENDING)
    expect(result.value.orderId).toBeDefined()

    const order = await orderRepo.findById(result.value.orderId)
    expect(order?.items).toHaveLength(1)
    expect(order?.items[0]).toEqual({ productId: 'prod-1', quantity: 3 })

    const reserved = await reservationRepo.getActiveQuantity('prod-1')
    expect(reserved).toBe(3)

    const outbox = outboxRepo.findByOrderId(result.value.orderId)
    expect(outbox).toBeDefined()
  })

  it('returns existing order on duplicate idempotency key without side effects', async () => {
    stockChecker.setStock('prod-1', 10)

    const first = await useCase.execute({
      idempotencyKey: 'key-dup',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
    })
    expect(first.isSuccess()).toBe(true)

    const second = await useCase.execute({
      idempotencyKey: 'key-dup',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
    })
    expect(second.isSuccess()).toBe(true)
    if (!second.isSuccess() || !first.isSuccess()) return
    expect(second.value.orderId).toBe(first.value.orderId)

    // Only one reservation created
    expect(await reservationRepo.getActiveQuantity('prod-1')).toBe(2)
  })

  it('returns ProductNotFoundError when product does not exist', async () => {
    const result = await useCase.execute({
      idempotencyKey: 'key-2',
      customerId: 'cust-1',
      items: [{ productId: 'missing-prod', quantity: 1 }],
    })

    expect(result.isFailure()).toBe(true)
    if (!result.isFailure()) return
    expect(result.value.code).toBe('PRODUCT_NOT_FOUND')
  })

  it('returns InsufficientStockError when available quantity is too low', async () => {
    stockChecker.setStock('prod-2', 2)

    const result = await useCase.execute({
      idempotencyKey: 'key-3',
      customerId: 'cust-1',
      items: [{ productId: 'prod-2', quantity: 5 }],
    })

    expect(result.isFailure()).toBe(true)
    if (!result.isFailure()) return
    expect(result.value.code).toBe('INSUFFICIENT_STOCK')
  })

  it('expired reservations do not reduce available quantity', async () => {
    stockChecker.setStock('prod-3', 5)
    // Manually inject an expired reservation
    reservationRepo.addExpiredReservation({ productId: 'prod-3', quantity: 4 })

    const result = await useCase.execute({
      idempotencyKey: 'key-4',
      customerId: 'cust-1',
      items: [{ productId: 'prod-3', quantity: 5 }],
    })

    expect(result.isSuccess()).toBe(true)
  })

  it('generates correlationId when not provided', async () => {
    stockChecker.setStock('prod-1', 10)

    const result = await useCase.execute({
      idempotencyKey: 'key-5',
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
    })

    expect(result.isSuccess()).toBe(true)
    if (!result.isSuccess()) return
    const order = await orderRepo.findById(result.value.orderId)
    expect(order?.correlationId).toBeDefined()
    expect(order?.correlationId.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/modules/checkout/use-cases/create-checkout/create-checkout.spec.ts
```

Expected: FAIL — files not yet created.

- [ ] **Step 3: Create in-memory repositories**

```typescript
// src/modules/checkout/use-cases/create-checkout/in-memory-order-repository.ts
import { randomUUID } from 'node:crypto'
import type { IOrderRepository, Order, CreateOrderData } from '../../repositories/order-repository'
import type { OrderStatus } from '../../domain/value-objects/order-status'

export class InMemoryOrderRepository implements IOrderRepository {
  private orders = new Map<string, Order>()

  async findByIdempotencyKey(key: string): Promise<Order | null> {
    for (const order of this.orders.values()) {
      if (order.idempotencyKey === key) return order
    }
    return null
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null
  }

  async createWithReservationsAndOutbox(data: CreateOrderData): Promise<Order> {
    const now = new Date()
    const order: Order = {
      id: data.id,
      customerId: data.customerId,
      correlationId: data.correlationId,
      idempotencyKey: data.idempotencyKey,
      status: 'PENDING' as never,
      attempts: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      items: data.items,
    }
    this.orders.set(order.id, order)
    return order
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    opts?: { attempts?: number; lastError?: string | null },
  ): Promise<void> {
    const order = this.orders.get(id)
    if (!order) return
    this.orders.set(id, {
      ...order,
      status,
      attempts: opts?.attempts ?? order.attempts,
      lastError: opts?.lastError !== undefined ? opts.lastError : order.lastError,
      updatedAt: new Date(),
    })
  }
}
```

```typescript
// src/modules/checkout/use-cases/create-checkout/in-memory-stock-reservation-repository.ts
import type { IStockReservationRepository } from '../../repositories/stock-reservation-repository'

interface Reservation {
  productId: string
  quantity: number
  expiresAt: Date
  releasedAt: Date | null
  orderId: string
}

export class InMemoryStockReservationRepository implements IStockReservationRepository {
  private reservations: Reservation[] = []

  async getActiveQuantity(productId: string): Promise<number> {
    const now = new Date()
    return this.reservations
      .filter(r => r.productId === productId && r.expiresAt > now && r.releasedAt === null)
      .reduce((sum, r) => sum + r.quantity, 0)
  }

  async releaseByOrderId(orderId: string): Promise<void> {
    const now = new Date()
    this.reservations = this.reservations.map(r =>
      r.orderId === orderId ? { ...r, releasedAt: now } : r,
    )
  }

  // Test helper: inject an already-expired reservation
  addExpiredReservation(data: { productId: string; quantity: number }): void {
    this.reservations.push({
      ...data,
      orderId: 'expired-order',
      expiresAt: new Date(Date.now() - 1000),
      releasedAt: null,
    })
  }

  // Called by CreateOrderData flow in tests needing reservations
  addReservation(data: { productId: string; quantity: number; orderId: string; expiresAt: Date }): void {
    this.reservations.push({ ...data, releasedAt: null })
  }
}
```

```typescript
// src/modules/checkout/use-cases/create-checkout/in-memory-checkout-outbox-repository.ts
import type { ICheckoutOutboxRepository, CheckoutOutboxEntry } from '../../repositories/checkout-outbox-repository'
import { randomUUID } from 'node:crypto'

interface StoredEntry extends CheckoutOutboxEntry {
  status: string
}

export class InMemoryCheckoutOutboxRepository implements ICheckoutOutboxRepository {
  private entries = new Map<string, StoredEntry>()

  findByOrderId(orderId: string): StoredEntry | undefined {
    for (const e of this.entries.values()) {
      if (e.orderId === orderId) return e
    }
    return undefined
  }

  async markEnqueued(id: string): Promise<void> {
    const e = this.entries.get(id)
    if (e) this.entries.set(id, { ...e, status: 'ENQUEUED' })
  }

  async markProcessed(id: string): Promise<void> {
    const e = this.entries.get(id)
    if (e) this.entries.set(id, { ...e, status: 'PROCESSED' })
  }

  async markDead(id: string, error: string): Promise<void> {
    const e = this.entries.get(id)
    if (e) this.entries.set(id, { ...e, status: 'DEAD' })
  }

  async findPending(): Promise<CheckoutOutboxEntry[]> {
    return [...this.entries.values()].filter(e => e.status === 'PENDING')
  }

  // Used internally by InMemoryOrderRepository via the use case's create flow
  async _create(orderId: string): Promise<void> {
    const id = randomUUID()
    this.entries.set(id, { id, orderId, status: 'PENDING' })
  }
}
```

```typescript
// src/modules/checkout/use-cases/create-checkout/in-memory-product-stock-checker.ts
import type { IProductStockChecker, ProductStockInfo } from '../../repositories/product-stock-checker'

export class InMemoryProductStockChecker implements IProductStockChecker {
  private stocks = new Map<string, number>()

  setStock(productId: string, availableQuantity: number): void {
    this.stocks.set(productId, availableQuantity)
  }

  async getProductStock(productId: string): Promise<ProductStockInfo> {
    const qty = this.stocks.get(productId)
    if (qty === undefined) return { exists: false, availableQuantity: 0 }
    return { exists: true, availableQuantity: qty }
  }
}
```

- [ ] **Step 4: Implement CreateCheckoutUseCase**

```typescript
// src/modules/checkout/use-cases/create-checkout/create-checkout.ts
import 'reflect-metadata'
import { randomUUID } from 'node:crypto'
import { injectable, inject } from 'tsyringe'
import { type Either, right, left } from '@shared/core/either'
import type { DomainError } from '@shared/errors/domain-error'
import type { IOrderRepository } from '../../repositories/order-repository'
import type { IStockReservationRepository } from '../../repositories/stock-reservation-repository'
import type { ICheckoutOutboxRepository } from '../../repositories/checkout-outbox-repository'
import type { IProductStockChecker } from '../../repositories/product-stock-checker'
import { InsufficientStockError } from '../../errors/insufficient-stock-error'
import { ProductNotFoundError } from '../../errors/product-not-found-error'
import type { CreateCheckoutInput, CreateCheckoutOutput } from '../../dtos/checkout-dto'
import { OrderStatus } from '../../domain/value-objects/order-status'

const RESERVATION_TTL_MS = 10 * 60 * 1000

@injectable()
export class CreateCheckoutUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IStockReservationRepository') private readonly stockReservationRepository: IStockReservationRepository,
    @inject('ICheckoutOutboxRepository') private readonly checkoutOutboxRepository: ICheckoutOutboxRepository,
    @inject('IProductStockChecker') private readonly productStockChecker: IProductStockChecker,
  ) {}

  async execute(input: CreateCheckoutInput): Promise<Either<DomainError, CreateCheckoutOutput>> {
    const existing = await this.orderRepository.findByIdempotencyKey(input.idempotencyKey)
    if (existing) {
      return right({ orderId: existing.id, status: existing.status, createdAt: existing.createdAt })
    }

    for (const item of input.items) {
      const stock = await this.productStockChecker.getProductStock(item.productId)
      if (!stock.exists) return left(new ProductNotFoundError(item.productId))
      const activeReserved = await this.stockReservationRepository.getActiveQuantity(item.productId)
      const available = stock.availableQuantity - activeReserved
      if (available < item.quantity) {
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
        orderId,
        productId: i.productId,
        quantity: i.quantity,
        expiresAt,
      })),
    })

    return right({ orderId: order.id, status: OrderStatus.PENDING, createdAt: order.createdAt })
  }
}
```

**Note:** The in-memory `InMemoryOrderRepository.createWithReservationsAndOutbox` only stores the order. The `InMemoryStockReservationRepository` and `InMemoryCheckoutOutboxRepository` are injected separately and the use case calls their internal helpers. To make this work: update `InMemoryOrderRepository` to accept injected repos for side-effect simulation, OR have the test call `reservationRepo.addReservation` + `outboxRepo._create` directly after the use case creates the order.

**Better approach:** The use case calls `orderRepository.createWithReservationsAndOutbox` which for in-memory just stores the order, and the use case ALSO directly calls `stockReservationRepository.addReservation` equivalent. But the use case must not know about in-memory internals.

**Correct design:** Update `InMemoryOrderRepository` constructor to accept `InMemoryStockReservationRepository` and `InMemoryCheckoutOutboxRepository` so `createWithReservationsAndOutbox` calls their internals. See implementation below:

```typescript
// Updated InMemoryOrderRepository:
export class InMemoryOrderRepository implements IOrderRepository {
  private orders = new Map<string, Order>()

  constructor(
    private readonly reservationRepo?: InMemoryStockReservationRepository,
    private readonly outboxRepo?: InMemoryCheckoutOutboxRepository,
  ) {}

  async createWithReservationsAndOutbox(data: CreateOrderData): Promise<Order> {
    const now = new Date()
    const order: Order = {
      id: data.id,
      customerId: data.customerId,
      correlationId: data.correlationId,
      idempotencyKey: data.idempotencyKey,
      status: OrderStatus.PENDING,
      attempts: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      items: data.items,
    }
    this.orders.set(order.id, order)

    for (const res of data.reservations) {
      this.reservationRepo?.addReservation(res)
    }
    await this.outboxRepo?._create(data.id)

    return order
  }
  // ... rest unchanged
}
```

Update test setup accordingly:
```typescript
beforeEach(() => {
  reservationRepo = new InMemoryStockReservationRepository()
  outboxRepo = new InMemoryCheckoutOutboxRepository()
  orderRepo = new InMemoryOrderRepository(reservationRepo, outboxRepo)
  stockChecker = new InMemoryProductStockChecker()
  useCase = new CreateCheckoutUseCase(orderRepo, reservationRepo, outboxRepo, stockChecker)
})
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/modules/checkout/use-cases/create-checkout/create-checkout.spec.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/checkout/use-cases/create-checkout/
git commit -m "feat: implement CreateCheckout use case with TDD"
```

---

### Task 4: GetOrderStatus use case

**Files:**
- Create: `src/modules/checkout/use-cases/get-order-status/get-order-status.ts`
- Create: `src/modules/checkout/use-cases/get-order-status/get-order-status.spec.ts`

**Interfaces:**
- Consumes: `IOrderRepository` (reuse `InMemoryOrderRepository` from Task 3), `OrderNotFoundError`, `GetOrderStatusOutput` from Task 2
- Produces: `GetOrderStatusUseCase` — consumed by Task 9

- [ ] **Step 1: Write failing test**

```typescript
// src/modules/checkout/use-cases/get-order-status/get-order-status.spec.ts
import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { GetOrderStatusUseCase } from './get-order-status'
import { InMemoryOrderRepository } from '../create-checkout/in-memory-order-repository'
import { InMemoryStockReservationRepository } from '../create-checkout/in-memory-stock-reservation-repository'
import { InMemoryCheckoutOutboxRepository } from '../create-checkout/in-memory-checkout-outbox-repository'
import { OrderStatus } from '../../domain/value-objects/order-status'

function makeOrderRepo() {
  const reservationRepo = new InMemoryStockReservationRepository()
  const outboxRepo = new InMemoryCheckoutOutboxRepository()
  return new InMemoryOrderRepository(reservationRepo, outboxRepo)
}

describe('GetOrderStatusUseCase', () => {
  let orderRepo: InMemoryOrderRepository
  let useCase: GetOrderStatusUseCase

  beforeEach(() => {
    orderRepo = makeOrderRepo()
    useCase = new GetOrderStatusUseCase(orderRepo)
  })

  it('returns order status fields for existing order', async () => {
    await orderRepo.createWithReservationsAndOutbox({
      id: 'order-1',
      customerId: 'cust-1',
      correlationId: 'corr-1',
      idempotencyKey: 'key-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
      reservations: [],
    })

    const result = await useCase.execute({ orderId: 'order-1' })

    expect(result.isSuccess()).toBe(true)
    if (!result.isSuccess()) return
    expect(result.value.orderId).toBe('order-1')
    expect(result.value.status).toBe(OrderStatus.PENDING)
    expect(result.value.attempts).toBe(0)
    expect(result.value.lastError).toBeNull()
    expect(result.value.createdAt).toBeInstanceOf(Date)
    expect(result.value.updatedAt).toBeInstanceOf(Date)
  })

  it('returns OrderNotFoundError for unknown orderId', async () => {
    const result = await useCase.execute({ orderId: 'does-not-exist' })

    expect(result.isFailure()).toBe(true)
    if (!result.isFailure()) return
    expect(result.value.code).toBe('ORDER_NOT_FOUND')
  })
})
```

- [ ] **Step 2: Run test to confirm fail**

```bash
npx vitest run src/modules/checkout/use-cases/get-order-status/get-order-status.spec.ts
```

Expected: FAIL — file not yet created.

- [ ] **Step 3: Implement GetOrderStatusUseCase**

```typescript
// src/modules/checkout/use-cases/get-order-status/get-order-status.ts
import 'reflect-metadata'
import { injectable, inject } from 'tsyringe'
import { type Either, right, left } from '@shared/core/either'
import type { DomainError } from '@shared/errors/domain-error'
import type { IOrderRepository } from '../../repositories/order-repository'
import { OrderNotFoundError } from '../../errors/order-not-found-error'
import type { GetOrderStatusOutput } from '../../dtos/order-status-dto'

export interface GetOrderStatusInput {
  orderId: string
}

@injectable()
export class GetOrderStatusUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
  ) {}

  async execute(input: GetOrderStatusInput): Promise<Either<DomainError, GetOrderStatusOutput>> {
    const order = await this.orderRepository.findById(input.orderId)
    if (!order) return left(new OrderNotFoundError(input.orderId))

    return right({
      orderId: order.id,
      status: order.status,
      attempts: order.attempts,
      lastError: order.lastError,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    })
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/modules/checkout/use-cases/get-order-status/get-order-status.spec.ts
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/checkout/use-cases/get-order-status/
git commit -m "feat: implement GetOrderStatus use case with TDD"
```

---

### Task 5: ProcessCheckoutJob use case

**Files:**
- Create: `src/modules/checkout/use-cases/process-checkout-job/in-memory-checkout-stock-flow-writer.ts`
- Create: `src/modules/checkout/use-cases/process-checkout-job/process-checkout-job.ts`
- Create: `src/modules/checkout/use-cases/process-checkout-job/process-checkout-job.spec.ts`

**Interfaces:**
- Consumes: `IOrderRepository` (reuse from Task 3), `IStockReservationRepository` (reuse from Task 3), `ICheckoutOutboxRepository` (reuse from Task 3), `ICheckoutStockFlowWriter`, `OrderNotFoundError`, `OrderStatus` from Task 2
- Produces: `ProcessCheckoutJobUseCase` (methods: `execute`, `handleFinalFailure`) — consumed by Task 8

- [ ] **Step 1: Write failing tests**

```typescript
// src/modules/checkout/use-cases/process-checkout-job/process-checkout-job.spec.ts
import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { ProcessCheckoutJobUseCase } from './process-checkout-job'
import { InMemoryOrderRepository } from '../create-checkout/in-memory-order-repository'
import { InMemoryStockReservationRepository } from '../create-checkout/in-memory-stock-reservation-repository'
import { InMemoryCheckoutOutboxRepository } from '../create-checkout/in-memory-checkout-outbox-repository'
import { InMemoryCheckoutStockFlowWriter } from './in-memory-checkout-stock-flow-writer'
import { OrderStatus } from '../../domain/value-objects/order-status'

function makeRepos() {
  const reservationRepo = new InMemoryStockReservationRepository()
  const outboxRepo = new InMemoryCheckoutOutboxRepository()
  const orderRepo = new InMemoryOrderRepository(reservationRepo, outboxRepo)
  return { orderRepo, reservationRepo, outboxRepo }
}

describe('ProcessCheckoutJobUseCase', () => {
  let orderRepo: InMemoryOrderRepository
  let reservationRepo: InMemoryStockReservationRepository
  let outboxRepo: InMemoryCheckoutOutboxRepository
  let stockFlowWriter: InMemoryCheckoutStockFlowWriter
  let useCase: ProcessCheckoutJobUseCase

  beforeEach(async () => {
    const repos = makeRepos()
    orderRepo = repos.orderRepo
    reservationRepo = repos.reservationRepo
    outboxRepo = repos.outboxRepo
    stockFlowWriter = new InMemoryCheckoutStockFlowWriter()
    useCase = new ProcessCheckoutJobUseCase(orderRepo, reservationRepo, outboxRepo, stockFlowWriter)

    // Seed an order with one item and one reservation
    await orderRepo.createWithReservationsAndOutbox({
      id: 'order-1',
      customerId: 'cust-1',
      correlationId: 'corr-1',
      idempotencyKey: 'key-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
      reservations: [
        { id: 'res-1', orderId: 'order-1', productId: 'prod-1', quantity: 2, expiresAt: new Date(Date.now() + 600_000) },
      ],
    })
  })

  it('execute: sets CONFIRMED, releases reservations, creates sale StockFlow', async () => {
    const result = await useCase.execute({ orderId: 'order-1' })

    expect(result.isSuccess()).toBe(true)

    const order = await orderRepo.findById('order-1')
    expect(order?.status).toBe(OrderStatus.CONFIRMED)

    const reserved = await reservationRepo.getActiveQuantity('prod-1')
    expect(reserved).toBe(0)

    expect(stockFlowWriter.flows).toEqual([{ productId: 'prod-1', quantity: -2 }])
  })

  it('execute: returns OrderNotFoundError for unknown orderId', async () => {
    const result = await useCase.execute({ orderId: 'ghost' })
    expect(result.isFailure()).toBe(true)
    if (!result.isFailure()) return
    expect(result.value.code).toBe('ORDER_NOT_FOUND')
  })

  it('execute: increments attempts on each call', async () => {
    await useCase.execute({ orderId: 'order-1' })
    const order = await orderRepo.findById('order-1')
    expect(order?.attempts).toBe(1)
  })

  it('handleFinalFailure: sets FAILED_PERMANENT, releases reservations, no StockFlow', async () => {
    await useCase.handleFinalFailure('order-1', 'ERP timeout')

    const order = await orderRepo.findById('order-1')
    expect(order?.status).toBe(OrderStatus.FAILED_PERMANENT)
    expect(order?.lastError).toBe('ERP timeout')

    const reserved = await reservationRepo.getActiveQuantity('prod-1')
    expect(reserved).toBe(0)

    expect(stockFlowWriter.flows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm fail**

```bash
npx vitest run src/modules/checkout/use-cases/process-checkout-job/process-checkout-job.spec.ts
```

Expected: FAIL — files not yet created.

- [ ] **Step 3: Create InMemoryCheckoutStockFlowWriter**

```typescript
// src/modules/checkout/use-cases/process-checkout-job/in-memory-checkout-stock-flow-writer.ts
import type { ICheckoutStockFlowWriter } from '../../repositories/checkout-stock-flow-writer'

export class InMemoryCheckoutStockFlowWriter implements ICheckoutStockFlowWriter {
  readonly flows: Array<{ productId: string; quantity: number }> = []

  async createSaleFlow(productId: string, quantity: number): Promise<void> {
    this.flows.push({ productId, quantity: -quantity })
  }
}
```

- [ ] **Step 4: Implement ProcessCheckoutJobUseCase**

```typescript
// src/modules/checkout/use-cases/process-checkout-job/process-checkout-job.ts
import 'reflect-metadata'
import { injectable, inject } from 'tsyringe'
import { type Either, right, left } from '@shared/core/either'
import type { DomainError } from '@shared/errors/domain-error'
import type { IOrderRepository } from '../../repositories/order-repository'
import type { IStockReservationRepository } from '../../repositories/stock-reservation-repository'
import type { ICheckoutOutboxRepository } from '../../repositories/checkout-outbox-repository'
import type { ICheckoutStockFlowWriter } from '../../repositories/checkout-stock-flow-writer'
import { OrderNotFoundError } from '../../errors/order-not-found-error'
import { OrderStatus } from '../../domain/value-objects/order-status'

export interface ProcessCheckoutJobInput {
  orderId: string
}

@injectable()
export class ProcessCheckoutJobUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IStockReservationRepository') private readonly stockReservationRepository: IStockReservationRepository,
    @inject('ICheckoutOutboxRepository') private readonly checkoutOutboxRepository: ICheckoutOutboxRepository,
    @inject('ICheckoutStockFlowWriter') private readonly stockFlowWriter: ICheckoutStockFlowWriter,
  ) {}

  async execute(input: ProcessCheckoutJobInput): Promise<Either<DomainError, void>> {
    const order = await this.orderRepository.findById(input.orderId)
    if (!order) return left(new OrderNotFoundError(input.orderId))

    await this.orderRepository.updateStatus(input.orderId, OrderStatus.CONFIRMED, {
      attempts: order.attempts + 1,
    })

    await this.stockReservationRepository.releaseByOrderId(input.orderId)

    for (const item of order.items) {
      await this.stockFlowWriter.createSaleFlow(item.productId, item.quantity)
    }

    return right(undefined)
  }

  async handleFinalFailure(orderId: string, error: string): Promise<void> {
    await this.orderRepository.updateStatus(orderId, OrderStatus.FAILED_PERMANENT, {
      lastError: error,
    })
    await this.stockReservationRepository.releaseByOrderId(orderId)
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/modules/checkout/use-cases/process-checkout-job/process-checkout-job.spec.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/modules/checkout/use-cases/process-checkout-job/
git commit -m "feat: implement ProcessCheckoutJob use case with TDD"
```

---

### Task 6: Prisma repository implementations

**Files:**
- Create: `src/modules/checkout/infra/persistence/prisma-order-repository.ts`
- Create: `src/modules/checkout/infra/persistence/prisma-stock-reservation-repository.ts`
- Create: `src/modules/checkout/infra/persistence/prisma-checkout-outbox-repository.ts`
- Create: `src/modules/checkout/infra/persistence/prisma-product-stock-checker.ts`
- Create: `src/modules/checkout/infra/persistence/prisma-checkout-stock-flow-writer.ts`

**Interfaces:**
- Consumes: `IOrderRepository`, `IStockReservationRepository`, `ICheckoutOutboxRepository`, `IProductStockChecker`, `ICheckoutStockFlowWriter` from Task 2; Prisma models from Task 1
- Produces: Prisma implementations — consumed by Task 9

- [ ] **Step 1: PrismaOrderRepository**

```typescript
// src/modules/checkout/infra/persistence/prisma-order-repository.ts
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { IOrderRepository, Order, CreateOrderData } from '../../repositories/order-repository'
import type { OrderStatus } from '../../domain/value-objects/order-status'

export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapOrder(row: {
    id: string; customerId: string; correlationId: string; idempotencyKey: string;
    status: string; attempts: number; lastError: string | null; createdAt: Date; updatedAt: Date;
    items: Array<{ productId: string; quantity: number }>
  }): Order {
    return {
      id: row.id,
      customerId: row.customerId,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey,
      status: row.status as OrderStatus,
      attempts: row.attempts,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      items: row.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
    }
  }

  async findByIdempotencyKey(key: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: { items: true },
    })
    return row ? this.mapOrder(row) : null
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    })
    return row ? this.mapOrder(row) : null
  }

  async createWithReservationsAndOutbox(data: CreateOrderData): Promise<Order> {
    const row = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          id: data.id,
          customerId: data.customerId,
          correlationId: data.correlationId,
          idempotencyKey: data.idempotencyKey,
          items: { createMany: { data: data.items } },
        },
        include: { items: true },
      })

      if (data.reservations.length > 0) {
        await tx.stockReservation.createMany({ data: data.reservations })
      }

      await tx.checkoutOutbox.create({
        data: { id: randomUUID(), orderId: data.id },
      })

      return order
    })

    return this.mapOrder(row)
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    opts?: { attempts?: number; lastError?: string | null },
  ): Promise<void> {
    await this.prisma.order.update({
      where: { id },
      data: {
        status,
        ...(opts?.attempts !== undefined && { attempts: opts.attempts }),
        ...(opts?.lastError !== undefined && { lastError: opts.lastError }),
      },
    })
  }
}
```

- [ ] **Step 2: PrismaStockReservationRepository**

```typescript
// src/modules/checkout/infra/persistence/prisma-stock-reservation-repository.ts
import type { PrismaClient } from '@prisma/client'
import type { IStockReservationRepository } from '../../repositories/stock-reservation-repository'

export class PrismaStockReservationRepository implements IStockReservationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getActiveQuantity(productId: string): Promise<number> {
    const result = await this.prisma.stockReservation.aggregate({
      _sum: { quantity: true },
      where: {
        productId,
        expiresAt: { gt: new Date() },
        releasedAt: null,
      },
    })
    return result._sum.quantity ?? 0
  }

  async releaseByOrderId(orderId: string): Promise<void> {
    await this.prisma.stockReservation.updateMany({
      where: { orderId, releasedAt: null },
      data: { releasedAt: new Date() },
    })
  }
}
```

- [ ] **Step 3: PrismaCheckoutOutboxRepository**

```typescript
// src/modules/checkout/infra/persistence/prisma-checkout-outbox-repository.ts
import type { PrismaClient } from '@prisma/client'
import type { ICheckoutOutboxRepository, CheckoutOutboxEntry } from '../../repositories/checkout-outbox-repository'

export class PrismaCheckoutOutboxRepository implements ICheckoutOutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async markEnqueued(id: string): Promise<void> {
    await this.prisma.checkoutOutbox.update({ where: { id }, data: { status: 'ENQUEUED' } })
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.checkoutOutbox.update({ where: { id }, data: { status: 'PROCESSED' } })
  }

  async markDead(id: string, error: string): Promise<void> {
    await this.prisma.checkoutOutbox.update({ where: { id }, data: { status: 'DEAD', error } })
  }

  async findPending(): Promise<CheckoutOutboxEntry[]> {
    const rows = await this.prisma.checkoutOutbox.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })
    return rows.map(r => ({ id: r.id, orderId: r.orderId }))
  }
}
```

- [ ] **Step 4: PrismaProductStockChecker**

```typescript
// src/modules/checkout/infra/persistence/prisma-product-stock-checker.ts
import type { PrismaClient } from '@prisma/client'
import type { IProductStockChecker, ProductStockInfo } from '../../repositories/product-stock-checker'

export class PrismaProductStockChecker implements IProductStockChecker {
  constructor(private readonly prisma: PrismaClient) {}

  async getProductStock(productId: string): Promise<ProductStockInfo> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) return { exists: false, availableQuantity: 0 }

    const stockTotal = await this.prisma.stockFlow.aggregate({
      _sum: { quantity: true },
      where: { productId },
    })

    const activeReserved = await this.prisma.stockReservation.aggregate({
      _sum: { quantity: true },
      where: { productId, expiresAt: { gt: new Date() }, releasedAt: null },
    })

    const available = (stockTotal._sum.quantity ?? 0) - (activeReserved._sum.quantity ?? 0)
    return { exists: true, availableQuantity: Math.max(0, available) }
  }
}
```

- [ ] **Step 5: PrismaCheckoutStockFlowWriter**

```typescript
// src/modules/checkout/infra/persistence/prisma-checkout-stock-flow-writer.ts
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { ICheckoutStockFlowWriter } from '../../repositories/checkout-stock-flow-writer'

export class PrismaCheckoutStockFlowWriter implements ICheckoutStockFlowWriter {
  constructor(private readonly prisma: PrismaClient) {}

  async createSaleFlow(productId: string, quantity: number): Promise<void> {
    await this.prisma.stockFlow.create({
      data: { id: randomUUID(), productId, quantity: -quantity },
    })
  }
}
```

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (Prisma repos have no unit tests — verified via container wiring in Task 9 and manual testing).

- [ ] **Step 7: Commit**

```bash
git add src/modules/checkout/infra/persistence/
git commit -m "feat: add Prisma repository implementations for checkout module"
```

---

### Task 7: HTTP controllers

**Files:**
- Create: `src/modules/checkout/infra/http/checkout-controller.ts`
- Create: `src/modules/checkout/infra/http/order-status-controller.ts`

**Interfaces:**
- Consumes: `CreateCheckoutUseCase` from Task 3; `GetOrderStatusUseCase` from Task 4; `toHttpError` from `@shared/errors/http-error-mapper`
- Produces: `CheckoutController`, `OrderStatusController` — consumed by Task 9

- [ ] **Step 1: CheckoutController**

```typescript
// src/modules/checkout/infra/http/checkout-controller.ts
import { injectable, inject } from 'tsyringe'
import type { FastifyInstance } from 'fastify/types/instance'
import { CreateCheckoutUseCase } from '../../use-cases/create-checkout/create-checkout'
import { toHttpError } from '@shared/errors/http-error-mapper'

interface CheckoutBody {
  customerId: string
  correlationId?: string
  items: Array<{ productId: string; quantity: number }>
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

@injectable()
export class CheckoutController {
  constructor(
    @inject(CreateCheckoutUseCase) private readonly createCheckout: CreateCheckoutUseCase,
  ) {}

  async registerRoutes(app: FastifyInstance): Promise<void> {
    app.post<{ Body: CheckoutBody }>(
      '/checkout',
      {
        schema: {
          tags: ['Checkout'],
          summary: 'Iniciar checkout assíncrono',
          description: 'Reserva estoque e registra pedido. Retorna 202 imediatamente sem aguardar faturamento.',
          headers: {
            type: 'object',
            properties: {
              'idempotency-key': { type: 'string', description: 'UUID obrigatório para idempotência' },
            },
            required: ['idempotency-key'],
          },
          body: {
            type: 'object',
            properties: {
              customerId: { type: 'string' },
              correlationId: { type: 'string' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string' },
                    quantity: { type: 'integer', minimum: 1 },
                  },
                  required: ['productId', 'quantity'],
                },
                minItems: 1,
              },
            },
            required: ['customerId', 'items'],
          },
          response: {
            202: {
              type: 'object',
              properties: {
                orderId: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      async (request, reply) => {
        const idempotencyKey = request.headers['idempotency-key'] as string | undefined
        if (!idempotencyKey || !UUID_REGEX.test(idempotencyKey)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'Header Idempotency-Key must be a valid UUID',
          })
        }

        const result = await this.createCheckout.execute({
          idempotencyKey,
          customerId: request.body.customerId,
          correlationId: request.body.correlationId,
          items: request.body.items,
        })

        if (result.isFailure()) {
          const err = toHttpError(result.value)
          return reply.status(err.statusCode).send(err)
        }

        return reply.status(202).send(result.value)
      },
    )
  }
}
```

- [ ] **Step 2: OrderStatusController**

```typescript
// src/modules/checkout/infra/http/order-status-controller.ts
import { injectable, inject } from 'tsyringe'
import type { FastifyInstance } from 'fastify/types/instance'
import { GetOrderStatusUseCase } from '../../use-cases/get-order-status/get-order-status'
import { toHttpError } from '@shared/errors/http-error-mapper'

interface OrderStatusParams {
  orderId: string
}

@injectable()
export class OrderStatusController {
  constructor(
    @inject(GetOrderStatusUseCase) private readonly getOrderStatus: GetOrderStatusUseCase,
  ) {}

  async registerRoutes(app: FastifyInstance): Promise<void> {
    app.get<{ Params: OrderStatusParams }>(
      '/orders/:orderId/status',
      {
        schema: {
          tags: ['Orders'],
          summary: 'Consultar status do pedido',
          params: {
            type: 'object',
            properties: { orderId: { type: 'string', format: 'uuid' } },
            required: ['orderId'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                orderId: { type: 'string' },
                status: { type: 'string' },
                attempts: { type: 'integer' },
                lastError: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      async (request, reply) => {
        const result = await this.getOrderStatus.execute({ orderId: request.params.orderId })

        if (result.isFailure()) {
          const err = toHttpError(result.value)
          return reply.status(err.statusCode).send(err)
        }

        return reply.send(result.value)
      },
    )
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/checkout/infra/http/
git commit -m "feat: add CheckoutController and OrderStatusController"
```

---

### Task 8: Queue infrastructure

**Files:**
- Create: `src/modules/checkout/infra/queue/bullmq-checkout-relay.ts`
- Create: `src/modules/checkout/infra/queue/bullmq-checkout-worker.ts`

**Interfaces:**
- Consumes: `ICheckoutOutboxRepository` from Task 2; `ProcessCheckoutJobUseCase` from Task 5; BullMQ (`Queue`, `Worker`); `Redis` from ioredis
- Produces: `BullMQCheckoutRelay`, `BullMQCheckoutWorker` — consumed by Task 9

- [ ] **Step 1: BullMQCheckoutRelay**

```typescript
// src/modules/checkout/infra/queue/bullmq-checkout-relay.ts
import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import type { ICheckoutOutboxRepository } from '../../repositories/checkout-outbox-repository'
import { logger } from '@shared/observability/logger'

interface CheckoutJobPayload {
  orderId: string
}

export class BullMQCheckoutRelay {
  private timer: NodeJS.Timeout | null = null
  readonly queue: Queue<CheckoutJobPayload>

  constructor(
    private readonly outboxRepository: ICheckoutOutboxRepository,
    redisConnection: Redis,
    private readonly intervalMs: number = Number(process.env.CHECKOUT_RELAY_INTERVAL_MS ?? 5000),
  ) {
    this.queue = new Queue<CheckoutJobPayload>('checkout-processing', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail: false,
      },
    })
  }

  start(): void {
    this.timer = setInterval(() => void this.relayBatch(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private async relayBatch(): Promise<void> {
    try {
      const pending = await this.outboxRepository.findPending()
      if (pending.length === 0) return

      await Promise.all(
        pending.map(entry =>
          this.queue.add('checkout', { orderId: entry.orderId }, { jobId: entry.id }),
        ),
      )

      await Promise.all(pending.map(entry => this.outboxRepository.markEnqueued(entry.id)))
      logger.info({ count: pending.length }, 'checkout.relay.batch')
    } catch (err) {
      logger.error({ err }, 'checkout.relay.batch.error')
    }
  }
}
```

- [ ] **Step 2: BullMQCheckoutWorker**

```typescript
// src/modules/checkout/infra/queue/bullmq-checkout-worker.ts
import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { ProcessCheckoutJobUseCase } from '../../use-cases/process-checkout-job/process-checkout-job'
import type { ICheckoutOutboxRepository } from '../../repositories/checkout-outbox-repository'
import type { IOrderRepository } from '../../repositories/order-repository'
import { OrderStatus } from '../../domain/value-objects/order-status'
import { logger } from '@shared/observability/logger'

interface CheckoutJobPayload {
  orderId: string
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export class BullMQCheckoutWorker {
  private worker: Worker | null = null

  constructor(
    private readonly processUseCase: ProcessCheckoutJobUseCase,
    private readonly outboxRepository: ICheckoutOutboxRepository,
    private readonly orderRepository: IOrderRepository,
    private readonly redisConnection: Redis,
  ) {}

  start(): void {
    this.worker = new Worker<CheckoutJobPayload>(
      'checkout-processing',
      async (job) => {
        const { orderId } = job.data
        logger.debug({ jobId: job.id, orderId, attempt: job.attemptsMade }, 'checkout.job.start')

        // Increment attempts + set PROCESSING before ERP simulation
        const order = await this.orderRepository.findById(orderId)
        if (order) {
          await this.orderRepository.updateStatus(orderId, OrderStatus.PROCESSING, {
            attempts: (order.attempts ?? 0) + 1,
          })
        }

        // Mock ERP simulation with delays
        await delay(1000) // step 1: ERP validation
        await delay(1000) // step 2: ERP reservation
        await delay(1000) // step 3: ERP billing

        const result = await this.processUseCase.execute({ orderId })
        if (result.isFailure()) throw new Error(result.value.message)

        // Mark outbox PROCESSED
        const outbox = await this.outboxRepository.findPending()
        const entry = outbox.find(e => e.orderId === orderId)
        if (entry) await this.outboxRepository.markProcessed(entry.id)

        logger.info({ jobId: job.id, orderId }, 'checkout.job.confirmed')
      },
      { connection: this.redisConnection },
    )

    this.worker.on('failed', async (job, err) => {
      if (!job) return
      const maxAttempts = Number(job.opts.attempts ?? 3)
      if (job.attemptsMade >= maxAttempts) {
        const { orderId } = job.data
        await this.processUseCase.handleFinalFailure(orderId, err.message)

        // Mark outbox DEAD — fetch outbox entry by orderId
        // Use findPending filtered by orderId; ENQUEUED entries won't show in pending
        // Fetch from DB directly via outbox repo is safer:
        // For simplicity, markDead is called with the job ID as the outbox ID
        // (jobId == outbox entry id, set in relay via { jobId: entry.id })
        if (job.id) await this.outboxRepository.markDead(job.id, err.message)

        logger.error(
          { jobId: job.id, orderId, totalAttempts: job.attemptsMade, finalError: err.message },
          'checkout.job.dead',
        )
      } else {
        logger.warn(
          { jobId: job.id, orderId: job.data.orderId, attempt: job.attemptsMade, error: err.message },
          'checkout.job.retry',
        )
      }
    })
  }

  async stop(): Promise<void> {
    await this.worker?.close()
  }
}
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/modules/checkout/infra/queue/
git commit -m "feat: add BullMQ checkout relay and worker"
```

---

### Task 9: Container wiring + startup

**Files:**
- Create: `src/modules/checkout/container.ts`
- Modify: `src/infra/http/server.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: all implementations from Tasks 3–8; `prisma` from `@shared/database/prisma-client`; `Redis`

- [ ] **Step 1: Create checkout container**

```typescript
// src/modules/checkout/container.ts
import 'reflect-metadata'
import { container } from 'tsyringe'
import { prisma } from '@shared/database/prisma-client'
import { PrismaOrderRepository } from './infra/persistence/prisma-order-repository'
import { PrismaStockReservationRepository } from './infra/persistence/prisma-stock-reservation-repository'
import { PrismaCheckoutOutboxRepository } from './infra/persistence/prisma-checkout-outbox-repository'
import { PrismaProductStockChecker } from './infra/persistence/prisma-product-stock-checker'
import { PrismaCheckoutStockFlowWriter } from './infra/persistence/prisma-checkout-stock-flow-writer'
import { CreateCheckoutUseCase } from './use-cases/create-checkout/create-checkout'
import { GetOrderStatusUseCase } from './use-cases/get-order-status/get-order-status'
import { ProcessCheckoutJobUseCase } from './use-cases/process-checkout-job/process-checkout-job'
import { BullMQCheckoutRelay } from './infra/queue/bullmq-checkout-relay'
import { BullMQCheckoutWorker } from './infra/queue/bullmq-checkout-worker'
import { CheckoutController } from './infra/http/checkout-controller'
import { OrderStatusController } from './infra/http/order-status-controller'
import type { IOrderRepository } from './repositories/order-repository'
import type { IStockReservationRepository } from './repositories/stock-reservation-repository'
import type { ICheckoutOutboxRepository } from './repositories/checkout-outbox-repository'
import type { IProductStockChecker } from './repositories/product-stock-checker'
import type { ICheckoutStockFlowWriter } from './repositories/checkout-stock-flow-writer'
import type { Redis } from 'ioredis'

export function registerCheckoutModule(redis: Redis): void {
  const orderRepo = new PrismaOrderRepository(prisma)
  const reservationRepo = new PrismaStockReservationRepository(prisma)
  const outboxRepo = new PrismaCheckoutOutboxRepository(prisma)
  const stockChecker = new PrismaProductStockChecker(prisma)
  const stockFlowWriter = new PrismaCheckoutStockFlowWriter(prisma)

  container.register<IOrderRepository>('IOrderRepository', { useValue: orderRepo })
  container.register<IStockReservationRepository>('IStockReservationRepository', { useValue: reservationRepo })
  container.register<ICheckoutOutboxRepository>('ICheckoutOutboxRepository', { useValue: outboxRepo })
  container.register<IProductStockChecker>('IProductStockChecker', { useValue: stockChecker })
  container.register<ICheckoutStockFlowWriter>('ICheckoutStockFlowWriter', { useValue: stockFlowWriter })

  container.register(CreateCheckoutUseCase, {
    useFactory: () => new CreateCheckoutUseCase(
      container.resolve<IOrderRepository>('IOrderRepository'),
      container.resolve<IStockReservationRepository>('IStockReservationRepository'),
      container.resolve<ICheckoutOutboxRepository>('ICheckoutOutboxRepository'),
      container.resolve<IProductStockChecker>('IProductStockChecker'),
    ),
  })
  container.register(GetOrderStatusUseCase, {
    useFactory: () => new GetOrderStatusUseCase(
      container.resolve<IOrderRepository>('IOrderRepository'),
    ),
  })
  container.register(ProcessCheckoutJobUseCase, {
    useFactory: () => new ProcessCheckoutJobUseCase(
      container.resolve<IOrderRepository>('IOrderRepository'),
      container.resolve<IStockReservationRepository>('IStockReservationRepository'),
      container.resolve<ICheckoutOutboxRepository>('ICheckoutOutboxRepository'),
      container.resolve<ICheckoutStockFlowWriter>('ICheckoutStockFlowWriter'),
    ),
  })

  container.register(CheckoutController, {
    useFactory: () => new CheckoutController(container.resolve(CreateCheckoutUseCase)),
  })
  container.register(OrderStatusController, {
    useFactory: () => new OrderStatusController(container.resolve(GetOrderStatusUseCase)),
  })

  container.register(BullMQCheckoutRelay, {
    useFactory: () => new BullMQCheckoutRelay(
      container.resolve<ICheckoutOutboxRepository>('ICheckoutOutboxRepository'),
      redis,
    ),
  })
  container.register(BullMQCheckoutWorker, {
    useFactory: () => new BullMQCheckoutWorker(
      container.resolve(ProcessCheckoutJobUseCase),
      container.resolve<ICheckoutOutboxRepository>('ICheckoutOutboxRepository'),
      container.resolve<IOrderRepository>('IOrderRepository'),
      redis,
    ),
  })
}
```

- [ ] **Step 2: Register routes in server.ts**

Open `src/infra/http/server.ts`. After the `productController.registerRoutes(app)` line, add:

```typescript
import { CheckoutController } from '@modules/checkout/infra/http/checkout-controller'
import { OrderStatusController } from '@modules/checkout/infra/http/order-status-controller'
```

In `buildApp`, after `await productController.registerRoutes(app)`:

```typescript
const checkoutController = container.resolve(CheckoutController)
const orderStatusController = container.resolve(OrderStatusController)
await checkoutController.registerRoutes(app)
await orderStatusController.registerRoutes(app)
```

Also update the tags array in the swagger config:

```typescript
tags: [
  { name: 'Products', description: 'Vitrine de produtos' },
  { name: 'Checkout', description: 'Fluxo de compra assíncrono' },
  { name: 'Orders', description: 'Consulta de pedidos' },
],
```

Also add the checkout-processing queue to BullBoard in `buildApp`:

```typescript
import { BullMQCheckoutRelay } from '@modules/checkout/infra/queue/bullmq-checkout-relay'
// ...
const checkoutQueue = new Queue('checkout-processing', { connection: redis })
createBullBoard({
  queues: [new BullMQAdapter(erpSyncQueue), new BullMQAdapter(checkoutQueue)],
  serverAdapter,
})
```

- [ ] **Step 3: Wire startup in main.ts**

Open `src/main.ts`. Add:

```typescript
import { registerCheckoutModule } from '@modules/checkout/container'
import { BullMQCheckoutRelay } from '@modules/checkout/infra/queue/bullmq-checkout-relay'
import { BullMQCheckoutWorker } from '@modules/checkout/infra/queue/bullmq-checkout-worker'
```

In `bootstrap()`, after `registerErpAdapterModule(redis)`:

```typescript
registerCheckoutModule(redis)
```

After `cacheScheduler.start()`:

```typescript
const checkoutRelay = container.resolve(BullMQCheckoutRelay)
const checkoutWorker = container.resolve(BullMQCheckoutWorker)
checkoutRelay.start()
checkoutWorker.start()
```

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5: TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/checkout/container.ts src/infra/http/server.ts src/main.ts
git commit -m "feat: wire checkout module into container and startup"
```
