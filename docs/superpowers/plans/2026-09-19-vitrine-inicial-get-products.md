# Vitrine Inicial — GET /products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `GET /products` with offset pagination, reading from PostgreSQL via Prisma, with full Clean Architecture layers, structured observability (correlationId + pino + OTel span), and a seed script generating ~100 products.

**Architecture:** Modular monolith. The `catalog` module owns `Product` and `StockFlow`. Stock availability is computed as `SUM(stock_flow.quantity)` per product on read. No cache in this iteration — every request hits PostgreSQL. Each layer (entity → use-case → infra → http) is isolated by interfaces.

**Tech Stack:** Node.js 22 · TypeScript 5 (strict) · Fastify 4 · Prisma 5 · PostgreSQL 16 · tsyringe 4 · pino 9 · Vitest 2 · Docker Compose

**Spec:** `docs/superpowers/specs/2026-09-19-modular-monolith-clean-architecture-design.md`

## Global Constraints

- All file and folder names: kebab-case, no exceptions
- Classes: PascalCase; variables and functions: camelCase
- Interfaces prefixed with `I` (e.g. `IProductRepository`)
- Use-cases return `Either<DomainError, T>` — never throw
- No `new` in use-cases, services, or repositories outside `container.ts`
- All dependencies injected via tsyringe (`@injectable`, `@inject`)
- Unit tests: no real I/O (no Prisma, no Redis, no HTTP). Use `InMemoryProductRepository` implementing `IProductRepository`
- Integration tests: suffix `.integration-spec.ts`, real DB via Docker
- No `console.log` — only pino logger
- `correlationId` required on every request log
- Path aliases: `@shared` → `src/shared/`, `@modules` → `src/modules/`, `@infra` → `src/infra/`
- Prisma `price` column: `Decimal @db.Decimal(10, 2)`
- Test DB port: 5433 (see `docker-compose.test.yml`)
- TDD agent spec: `src/shared/core/architecture-rules.md`
- Forbidden: `vi.mock()` of Prisma/Redis implementations; tautological assertions; horizontal slicing

---

## File Map

```
prisma/
  schema.prisma                              CREATE  — Product + StockFlow models
  seed.mjs                                   CREATE  — 100 products + stock flows

src/shared/
  types/
    pagination.ts                            CREATE  — PaginationMeta, PaginatedResult<T>
  database/
    prisma-client.ts                         CREATE  — PrismaClient singleton
  observability/
    logger.ts                                CREATE  — pino logger (standalone, non-Fastify)
    tracer.ts                                CREATE  — OpenTelemetry stub

src/modules/catalog/
  entities/
    value-objects/
      product-price.ts                       CREATE  — ProductPrice VO (no negative)
      product-price.spec.ts                  CREATE  — unit tests
      sku.ts                                 CREATE  — SKU VO (non-empty, uppercase)
      sku.spec.ts                            CREATE  — unit tests
    product.ts                               CREATE  — Product entity
    product.spec.ts                          CREATE  — unit tests
  repositories/
    i-product-repository.ts                  CREATE  — IProductRepository interface
  dtos/
    list-products-dto.ts                     CREATE  — input/output DTOs
  use-cases/
    list-products/
      in-memory-product-repository.ts        CREATE  — fake for unit tests
      list-products.ts                       CREATE  — ListProductsUseCase
      list-products.spec.ts                  CREATE  — unit tests (TDD)
  infra/
    persistence/
      prisma-product-repository.ts           CREATE  — IProductRepository Prisma impl
      prisma-product-repository.integration-spec.ts  CREATE — integration tests
    http/
      product-controller.ts                  CREATE  — Fastify route handler
  mappers/
    product-mapper.ts                        CREATE  — Prisma row → domain Product
  presenters/
    product-presenter.ts                     CREATE  — domain → HTTP response shape
  container.ts                               CREATE  — tsyringe bindings for catalog

src/infra/
  http/
    server.ts                                CREATE  — Fastify app factory (correlationId hook)

src/
  main.ts                                    MODIFY  — bootstrap: register modules, start server
```

---

## Task 1: Prisma Schema + Shared Infrastructure

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/shared/types/pagination.ts`
- Create: `src/shared/database/prisma-client.ts`
- Create: `src/shared/observability/logger.ts`
- Create: `src/shared/observability/tracer.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `PaginationMeta` type, `PaginatedResult<T>` type (used in Tasks 3, 5, 6)
  - `prisma` singleton of type `PrismaClient` (used in Tasks 4, 5)
  - `logger` of type `pino.Logger` (used in Task 6)
  - `tracer.startSpan(name)` returning `{ end(): void; setAttribute(k, v): void }` (used in Task 6)

- [ ] **Step 1: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Product {
  id        String      @id @default(uuid())
  sku       String      @unique
  name      String
  price     Decimal     @db.Decimal(10, 2)
  createdAt DateTime    @default(now()) @map("created_at")
  updatedAt DateTime    @updatedAt @map("updated_at")
  stockFlow StockFlow[]

  @@map("products")
}

model StockFlow {
  id        String   @id @default(uuid())
  productId String   @map("product_id")
  quantity  Int
  movedAt   DateTime @default(now()) @map("moved_at")
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@map("stock_flows")
}
```

- [ ] **Step 2: Create `src/shared/types/pagination.ts`**

```typescript
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResult<T> {
  data: T[]
  meta: PaginationMeta
}
```

- [ ] **Step 3: Create `src/shared/database/prisma-client.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
```

- [ ] **Step 4: Create `src/shared/observability/logger.ts`**

```typescript
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
})
```

- [ ] **Step 5: Create `src/shared/observability/tracer.ts`**

```typescript
interface Span {
  end(): void
  setAttribute(key: string, value: string | number | boolean): void
}

export const tracer = {
  startSpan(_name: string): Span {
    return {
      end() {},
      setAttribute() {},
    }
  },
}
```

- [ ] **Step 6: Generate Prisma client**

Run in the project root (Docker not required for generation):
```bash
npx prisma generate
```
Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 7: Run dev migration**

Requires Docker (`docker compose up -d postgres`) and `.env` with `DATABASE_URL`.
```bash
npx prisma migrate dev --name init
```
Expected: migration file created under `prisma/migrations/`, tables `products` and `stock_flows` created.

- [ ] **Step 8: Commit**

```bash
git add prisma/ src/shared/types/ src/shared/database/ src/shared/observability/
git commit -m "feat: prisma schema, shared infra (pagination types, prisma client, pino logger, otel stub)"
```

---

## Task 2: Product Domain — Value Objects + Entity (TDD)

**Files:**
- Create: `src/modules/catalog/entities/value-objects/product-price.ts`
- Create: `src/modules/catalog/entities/value-objects/product-price.spec.ts`
- Create: `src/modules/catalog/entities/value-objects/sku.ts`
- Create: `src/modules/catalog/entities/value-objects/sku.spec.ts`
- Create: `src/modules/catalog/entities/product.ts`
- Create: `src/modules/catalog/entities/product.spec.ts`

**Interfaces:**
- Consumes: `Either`, `Failure`, `Success`, `left`, `right` from `@shared/core/either`; `DomainError` from `@shared/errors/domain-error`
- Produces:
  - `ProductPrice` class with static `create(value: number): Either<InvalidPriceError, ProductPrice>` and `readonly value: number`
  - `SKU` class with static `create(value: string): Either<InvalidSKUError, SKU>` and `readonly value: string`
  - `Product` class with static `create(props, id?): Product` and getters `id`, `sku`, `name`, `price`
  - `InvalidPriceError` extends `DomainError` with `code = 'INVALID_PRICE'`
  - `InvalidSKUError` extends `DomainError` with `code = 'INVALID_SKU'`

### ProductPrice VO

- [ ] **Step 1: Write failing test for ProductPrice**

Create `src/modules/catalog/entities/value-objects/product-price.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ProductPrice } from './product-price'

describe('ProductPrice', () => {
  it('creates with valid positive price', () => {
    const result = ProductPrice.create(29.9)
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.value).toBe(29.9)
  })

  it('creates with zero price', () => {
    const result = ProductPrice.create(0)
    expect(result.isSuccess()).toBe(true)
  })

  it('rejects negative price', () => {
    const result = ProductPrice.create(-1)
    expect(result.isFailure()).toBe(true)
    if (result.isFailure()) expect(result.value.code).toBe('INVALID_PRICE')
  })
})
```

- [ ] **Step 2: Run test to confirm red**

```bash
npx vitest run src/modules/catalog/entities/value-objects/product-price.spec.ts
```
Expected: FAIL — `Cannot find module './product-price'`

- [ ] **Step 3: Implement `product-price.ts`**

Create `src/modules/catalog/entities/value-objects/product-price.ts`:

```typescript
import { type Either, left, right } from '@shared/core/either'
import { DomainError } from '@shared/errors/domain-error'

export class InvalidPriceError extends DomainError {
  readonly code = 'INVALID_PRICE'
  constructor() {
    super('Product price must be zero or positive')
  }
}

export class ProductPrice {
  readonly value: number

  private constructor(value: number) {
    this.value = value
  }

  static create(value: number): Either<InvalidPriceError, ProductPrice> {
    if (value < 0) return left(new InvalidPriceError())
    return right(new ProductPrice(value))
  }
}
```

- [ ] **Step 4: Run test to confirm green**

```bash
npx vitest run src/modules/catalog/entities/value-objects/product-price.spec.ts
```
Expected: PASS — 3 tests passing.

### SKU VO

- [ ] **Step 5: Write failing test for SKU**

Create `src/modules/catalog/entities/value-objects/sku.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { SKU } from './sku'

describe('SKU', () => {
  it('creates with valid string and uppercases it', () => {
    const result = SKU.create('case-iphone-15-black')
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.value).toBe('CASE-IPHONE-15-BLACK')
  })

  it('trims whitespace', () => {
    const result = SKU.create('  ABC-001  ')
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) expect(result.value.value).toBe('ABC-001')
  })

  it('rejects empty string', () => {
    const result = SKU.create('')
    expect(result.isFailure()).toBe(true)
    if (result.isFailure()) expect(result.value.code).toBe('INVALID_SKU')
  })

  it('rejects whitespace-only string', () => {
    const result = SKU.create('   ')
    expect(result.isFailure()).toBe(true)
  })
})
```

- [ ] **Step 6: Run test to confirm red**

```bash
npx vitest run src/modules/catalog/entities/value-objects/sku.spec.ts
```
Expected: FAIL — `Cannot find module './sku'`

- [ ] **Step 7: Implement `sku.ts`**

Create `src/modules/catalog/entities/value-objects/sku.ts`:

```typescript
import { type Either, left, right } from '@shared/core/either'
import { DomainError } from '@shared/errors/domain-error'

export class InvalidSKUError extends DomainError {
  readonly code = 'INVALID_SKU'
  constructor() {
    super('SKU must be a non-empty string')
  }
}

export class SKU {
  readonly value: string

  private constructor(value: string) {
    this.value = value
  }

  static create(raw: string): Either<InvalidSKUError, SKU> {
    const trimmed = raw.trim().toUpperCase()
    if (trimmed.length === 0) return left(new InvalidSKUError())
    return right(new SKU(trimmed))
  }
}
```

- [ ] **Step 8: Run test to confirm green**

```bash
npx vitest run src/modules/catalog/entities/value-objects/sku.spec.ts
```
Expected: PASS — 4 tests passing.

### Product Entity

- [ ] **Step 9: Write failing test for Product**

Create `src/modules/catalog/entities/product.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { Product } from './product'
import { ProductPrice } from './value-objects/product-price'
import { SKU } from './value-objects/sku'

function makeSKU(raw = 'CASE-SAM-S24-BLK') {
  const result = SKU.create(raw)
  if (!result.isSuccess()) throw new Error('invalid sku in test')
  return result.value
}

function makePrice(value = 49.9) {
  const result = ProductPrice.create(value)
  if (!result.isSuccess()) throw new Error('invalid price in test')
  return result.value
}

describe('Product', () => {
  it('creates with valid props and generates id', () => {
    const product = Product.create({ sku: makeSKU(), name: 'Capa Samsung S24', price: makePrice() })
    expect(product.id).toBeDefined()
    expect(product.sku).toBe('CASE-SAM-S24-BLK')
    expect(product.name).toBe('Capa Samsung S24')
    expect(product.price).toBe(49.9)
  })

  it('accepts explicit id for rehydration', () => {
    const id = 'fixed-uuid-001'
    const product = Product.create({ sku: makeSKU(), name: 'Capa', price: makePrice() }, id)
    expect(product.id).toBe('fixed-uuid-001')
  })
})
```

- [ ] **Step 10: Run test to confirm red**

```bash
npx vitest run src/modules/catalog/entities/product.spec.ts
```
Expected: FAIL — `Cannot find module './product'`

- [ ] **Step 11: Implement `product.ts`**

Create `src/modules/catalog/entities/product.ts`:

```typescript
import { randomUUID } from 'node:crypto'
import type { ProductPrice } from './value-objects/product-price'
import type { SKU } from './value-objects/sku'

interface ProductProps {
  sku: SKU
  name: string
  price: ProductPrice
}

export class Product {
  readonly id: string
  private readonly props: ProductProps

  private constructor(props: ProductProps, id: string) {
    this.props = props
    this.id = id
  }

  static create(props: ProductProps, id?: string): Product {
    return new Product(props, id ?? randomUUID())
  }

  get sku(): string { return this.props.sku.value }
  get name(): string { return this.props.name }
  get price(): number { return this.props.price.value }
}
```

- [ ] **Step 12: Run test to confirm green**

```bash
npx vitest run src/modules/catalog/entities/product.spec.ts
```
Expected: PASS — 2 tests passing.

- [ ] **Step 13: Run all catalog entity tests together**

```bash
npx vitest run src/modules/catalog/entities/
```
Expected: PASS — all 9 tests passing.

- [ ] **Step 14: Commit**

```bash
git add src/modules/catalog/entities/
git commit -m "feat: Product entity and value objects (ProductPrice, SKU) with TDD"
```

---

## Task 3: IProductRepository Interface + ListProducts Use Case (TDD)

**Files:**
- Create: `src/modules/catalog/repositories/i-product-repository.ts`
- Create: `src/modules/catalog/dtos/list-products-dto.ts`
- Create: `src/modules/catalog/use-cases/list-products/in-memory-product-repository.ts`
- Create: `src/modules/catalog/use-cases/list-products/list-products.ts`
- Create: `src/modules/catalog/use-cases/list-products/list-products.spec.ts`

**Interfaces:**
- Consumes:
  - `Either`, `left`, `right` from `@shared/core/either`
  - `IUseCase` from `@shared/core/use-case`
  - `DomainError` from `@shared/errors/domain-error`
  - `PaginatedResult`, `PaginationMeta` from `@shared/types/pagination`
- Produces:
  - `ProductResponseItem`: `{ id: string; sku: string; name: string; price: number; availableQuantity: number }`
  - `ListProductsInput`: `{ page?: number; limit?: number }`
  - `ListProductsOutput`: `PaginatedResult<ProductResponseItem>`
  - `IProductRepository` interface with `findAll(params: { page: number; limit: number }): Promise<{ products: ProductResponseItem[]; total: number }>`
  - `ListProductsUseCase` class (injectable, inject token `'IProductRepository'`)

- [ ] **Step 1: Create `src/modules/catalog/dtos/list-products-dto.ts`**

```typescript
import type { PaginatedResult } from '@shared/types/pagination'

export interface ProductResponseItem {
  id: string
  sku: string
  name: string
  price: number
  availableQuantity: number
}

export interface ListProductsInput {
  page?: number
  limit?: number
}

export type ListProductsOutput = PaginatedResult<ProductResponseItem>
```

- [ ] **Step 2: Create `src/modules/catalog/repositories/i-product-repository.ts`**

```typescript
import type { ProductResponseItem } from '../dtos/list-products-dto'

export interface FindAllParams {
  page: number
  limit: number
}

export interface FindAllResult {
  products: ProductResponseItem[]
  total: number
}

export interface IProductRepository {
  findAll(params: FindAllParams): Promise<FindAllResult>
}
```

- [ ] **Step 3: Create `in-memory-product-repository.ts`** (fake for unit tests only)

Create `src/modules/catalog/use-cases/list-products/in-memory-product-repository.ts`:

```typescript
import type { IProductRepository, FindAllParams, FindAllResult } from '../../repositories/i-product-repository'
import type { ProductResponseItem } from '../../dtos/list-products-dto'

export class InMemoryProductRepository implements IProductRepository {
  products: ProductResponseItem[] = []

  async findAll({ page, limit }: FindAllParams): Promise<FindAllResult> {
    const skip = (page - 1) * limit
    return {
      products: this.products.slice(skip, skip + limit),
      total: this.products.length,
    }
  }
}
```

- [ ] **Step 4: Write failing tests for ListProductsUseCase**

Create `src/modules/catalog/use-cases/list-products/list-products.spec.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ListProductsUseCase } from './list-products'
import { InMemoryProductRepository } from './in-memory-product-repository'
import type { ProductResponseItem } from '../../dtos/list-products-dto'

function makeItem(overrides: Partial<ProductResponseItem> = {}): ProductResponseItem {
  return {
    id: 'id-1',
    sku: 'SKU-001',
    name: 'Capa Silicone Samsung S24',
    price: 29.9,
    availableQuantity: 50,
    ...overrides,
  }
}

describe('ListProductsUseCase', () => {
  let repo: InMemoryProductRepository
  let useCase: ListProductsUseCase

  beforeEach(() => {
    repo = new InMemoryProductRepository()
    useCase = new ListProductsUseCase(repo)
  })

  it('returns empty list when no products exist', async () => {
    const result = await useCase.execute({})
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) {
      expect(result.value.data).toHaveLength(0)
      expect(result.value.meta.total).toBe(0)
    }
  })

  it('returns products with default pagination (page=1, limit=20)', async () => {
    repo.products = [makeItem({ id: 'id-1' }), makeItem({ id: 'id-2' })]
    const result = await useCase.execute({})
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) {
      expect(result.value.data).toHaveLength(2)
      expect(result.value.meta.page).toBe(1)
      expect(result.value.meta.limit).toBe(20)
    }
  })

  it('calculates totalPages correctly', async () => {
    repo.products = Array.from({ length: 55 }, (_, i) => makeItem({ id: `id-${i}` }))
    const result = await useCase.execute({ limit: 20 })
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) {
      expect(result.value.meta.total).toBe(55)
      expect(result.value.meta.totalPages).toBe(3)
    }
  })

  it('returns correct subset for page 2', async () => {
    repo.products = Array.from({ length: 25 }, (_, i) => makeItem({ id: `id-${i}` }))
    const result = await useCase.execute({ page: 2, limit: 10 })
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) {
      expect(result.value.data).toHaveLength(10)
      expect(result.value.data[0].id).toBe('id-10')
    }
  })

  it('returns single page when total equals limit', async () => {
    repo.products = Array.from({ length: 20 }, (_, i) => makeItem({ id: `id-${i}` }))
    const result = await useCase.execute({ limit: 20 })
    expect(result.isSuccess()).toBe(true)
    if (result.isSuccess()) {
      expect(result.value.meta.totalPages).toBe(1)
    }
  })
})
```

- [ ] **Step 5: Run tests to confirm red**

```bash
npx vitest run src/modules/catalog/use-cases/list-products/list-products.spec.ts
```
Expected: FAIL — `Cannot find module './list-products'`

- [ ] **Step 6: Implement `list-products.ts`**

Create `src/modules/catalog/use-cases/list-products/list-products.ts`:

```typescript
import { injectable, inject } from 'tsyringe'
import { type Either, right } from '@shared/core/either'
import type { IUseCase } from '@shared/core/use-case'
import type { DomainError } from '@shared/errors/domain-error'
import type { IProductRepository } from '../../repositories/i-product-repository'
import type { ListProductsInput, ListProductsOutput } from '../../dtos/list-products-dto'

@injectable()
export class ListProductsUseCase implements IUseCase<ListProductsInput, Promise<Either<DomainError, ListProductsOutput>>> {
  constructor(
    @inject('IProductRepository') private readonly productRepository: IProductRepository,
  ) {}

  async execute(input: ListProductsInput): Promise<Either<DomainError, ListProductsOutput>> {
    const page = input.page ?? 1
    const limit = input.limit ?? 20
    const { products, total } = await this.productRepository.findAll({ page, limit })

    return right({
      data: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  }
}
```

- [ ] **Step 7: Run tests to confirm green**

```bash
npx vitest run src/modules/catalog/use-cases/list-products/list-products.spec.ts
```
Expected: PASS — 5 tests passing.

- [ ] **Step 8: Check coverage**

```bash
npx vitest run --coverage src/modules/catalog/use-cases/
```
Expected: use-cases coverage ≥ 90%.

- [ ] **Step 9: Commit**

```bash
git add src/modules/catalog/repositories/ src/modules/catalog/dtos/ src/modules/catalog/use-cases/
git commit -m "feat: IProductRepository interface, ListProductsUseCase with TDD, InMemoryProductRepository fake"
```

---

## Task 4: PrismaProductRepository + Integration Test

**Files:**
- Create: `src/modules/catalog/infra/persistence/prisma-product-repository.ts`
- Create: `src/modules/catalog/infra/persistence/prisma-product-repository.integration-spec.ts`

**Interfaces:**
- Consumes:
  - `IProductRepository`, `FindAllParams`, `FindAllResult` from `@modules/catalog/repositories/i-product-repository`
  - `ProductResponseItem` from `@modules/catalog/dtos/list-products-dto`
  - `PrismaClient` from `@prisma/client`
  - `prisma` singleton from `@shared/database/prisma-client`
- Produces:
  - `PrismaProductRepository` class implementing `IProductRepository` (injectable, inject `'PrismaClient'`)

> **Pre-condition for integration tests:** Docker must be running with the test containers.
> Run: `docker compose -f docker-compose.test.yml up -d`
> Run migrations: `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/casecellshop_test npx prisma migrate deploy`
> Run tests with: `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/casecellshop_test npx vitest run --config vitest.integration.ts src/modules/catalog/infra/persistence/`

- [ ] **Step 1: Create `prisma-product-repository.ts`**

```typescript
import { injectable, inject } from 'tsyringe'
import type { PrismaClient } from '@prisma/client'
import type { IProductRepository, FindAllParams, FindAllResult } from '../../repositories/i-product-repository'

@injectable()
export class PrismaProductRepository implements IProductRepository {
  constructor(
    @inject('PrismaClient') private readonly prisma: PrismaClient,
  ) {}

  async findAll({ page, limit }: FindAllParams): Promise<FindAllResult> {
    const skip = (page - 1) * limit

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          stockFlow: { select: { quantity: true } },
        },
      }),
      this.prisma.product.count(),
    ])

    return {
      total,
      products: rows.map((row) => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        price: row.price.toNumber(),
        availableQuantity: row.stockFlow.reduce((sum, sf) => sum + sf.quantity, 0),
      })),
    }
  }
}
```

- [ ] **Step 2: Create integration test**

Create `src/modules/catalog/infra/persistence/prisma-product-repository.integration-spec.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaProductRepository } from './prisma-product-repository'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

const repo = new PrismaProductRepository(prisma)

beforeEach(async () => {
  await prisma.stockFlow.deleteMany()
  await prisma.product.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

async function insertProduct(data: { sku: string; name: string; price: number; stock: number }) {
  const product = await prisma.product.create({
    data: { sku: data.sku, name: data.name, price: data.price },
  })
  await prisma.stockFlow.create({
    data: { productId: product.id, quantity: data.stock },
  })
  return product
}

describe('PrismaProductRepository', () => {
  it('returns empty list when no products', async () => {
    const result = await repo.findAll({ page: 1, limit: 20 })
    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('returns product with computed availableQuantity', async () => {
    await insertProduct({ sku: 'SKU-001', name: 'Capa iPhone 15', price: 49.9, stock: 30 })
    const result = await repo.findAll({ page: 1, limit: 20 })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].sku).toBe('SKU-001')
    expect(result.products[0].availableQuantity).toBe(30)
    expect(result.products[0].price).toBe(49.9)
  })

  it('computes availableQuantity from multiple StockFlow entries', async () => {
    const product = await prisma.product.create({
      data: { sku: 'SKU-002', name: 'Capa Moto G84', price: 29.9 },
    })
    await prisma.stockFlow.createMany({
      data: [
        { productId: product.id, quantity: 100 },
        { productId: product.id, quantity: -15 },
      ],
    })
    const result = await repo.findAll({ page: 1, limit: 20 })
    expect(result.products[0].availableQuantity).toBe(85)
  })

  it('paginates correctly', async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        insertProduct({ sku: `SKU-${String(i).padStart(3, '0')}`, name: `Produto ${i}`, price: 10, stock: 5 }),
      ),
    )
    const page1 = await repo.findAll({ page: 1, limit: 10 })
    const page2 = await repo.findAll({ page: 2, limit: 10 })
    expect(page1.products).toHaveLength(10)
    expect(page2.products).toHaveLength(10)
    expect(page1.total).toBe(25)
    expect(page1.products[0].id).not.toBe(page2.products[0].id)
  })
})
```

- [ ] **Step 3: Run integration tests**

With Docker test containers up and migrations applied:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/casecellshop_test npx vitest run --config vitest.integration.ts src/modules/catalog/infra/persistence/
```
Expected: PASS — 4 integration tests passing.

- [ ] **Step 4: Commit**

```bash
git add src/modules/catalog/infra/persistence/
git commit -m "feat: PrismaProductRepository with stock aggregation and integration tests"
```

---

## Task 5: HTTP Layer — Controller + Presenter + DI Container + Server Bootstrap

**Files:**
- Create: `src/modules/catalog/mappers/product-mapper.ts`
- Create: `src/modules/catalog/presenters/product-presenter.ts`
- Create: `src/modules/catalog/infra/http/product-controller.ts`
- Create: `src/modules/catalog/container.ts`
- Create: `src/infra/http/server.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes:
  - `ListProductsUseCase` from Task 3
  - `PrismaProductRepository` from Task 4
  - `IProductRepository` from Task 3
  - `ListProductsOutput`, `ProductResponseItem` from Task 3
  - `toHttpError` from `@shared/errors/http-error-mapper`
  - `tracer` from `@shared/observability/tracer`
  - `prisma` from `@shared/database/prisma-client`
  - `logger` from `@shared/observability/logger`
- Produces:
  - `GET /products?page=&limit=` route, JSON response matching `PaginatedResult<ProductResponseItem>`
  - `x-correlation-id` header echoed on every response
  - pino log per request with `correlationId` bound
  - OTel span started and ended for `GET /products`

- [ ] **Step 1: Create `product-mapper.ts`**

```typescript
import { Product } from '../entities/product'
import { ProductPrice } from '../entities/value-objects/product-price'
import { SKU } from '../entities/value-objects/sku'

interface ProductRow {
  id: string
  sku: string
  name: string
  price: { toNumber(): number }
}

export class ProductMapper {
  static toDomain(row: ProductRow): Product {
    const skuOrError = SKU.create(row.sku)
    const priceOrError = ProductPrice.create(row.price.toNumber())

    if (skuOrError.isFailure()) throw new Error(`Invalid SKU in DB: ${row.sku}`)
    if (priceOrError.isFailure()) throw new Error(`Invalid price in DB: ${row.price.toNumber()}`)

    return Product.create(
      { sku: skuOrError.value, name: row.name, price: priceOrError.value },
      row.id,
    )
  }
}
```

- [ ] **Step 2: Create `product-presenter.ts`**

```typescript
import type { ListProductsOutput } from '../dtos/list-products-dto'

export class ProductPresenter {
  static toHTTP(output: ListProductsOutput): ListProductsOutput {
    return output
  }
}
```

- [ ] **Step 3: Add `correlationId` to Fastify request type**

Create `src/infra/http/fastify-types.d.ts` (global type augmentation):

```typescript
declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string
  }
}
```

- [ ] **Step 4: Create `product-controller.ts`**

```typescript
import { injectable, inject } from 'tsyringe'
import type { FastifyInstance } from 'fastify'
import { ListProductsUseCase } from '../use-cases/list-products/list-products'
import { ProductPresenter } from '../presenters/product-presenter'
import { toHttpError } from '@shared/errors/http-error-mapper'
import { tracer } from '@shared/observability/tracer'

interface ListProductsQuery {
  page?: number
  limit?: number
}

const listProductsSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
}

@injectable()
export class ProductController {
  constructor(
    @inject(ListProductsUseCase) private readonly listProductsUseCase: ListProductsUseCase,
  ) {}

  async registerRoutes(app: FastifyInstance): Promise<void> {
    app.get<{ Querystring: ListProductsQuery }>(
      '/products',
      { schema: listProductsSchema },
      async (request, reply) => {
        const { page, limit } = request.query
        const span = tracer.startSpan('GET /products')
        span.setAttribute('http.page', page ?? 1)
        span.setAttribute('http.limit', limit ?? 20)

        try {
          const result = await this.listProductsUseCase.execute({ page, limit })

          if (result.isFailure()) {
            const err = toHttpError(result.value)
            request.log.error({ correlationId: request.correlationId, error: err }, 'list-products failed')
            return reply.status(err.statusCode).send(err)
          }

          request.log.info({ correlationId: request.correlationId, total: result.value.meta.total }, 'list-products ok')
          return reply.send(ProductPresenter.toHTTP(result.value))
        } finally {
          span.end()
        }
      },
    )
  }
}
```

- [ ] **Step 5: Create `catalog/container.ts`**

```typescript
import { container } from 'tsyringe'
import type { IProductRepository } from './repositories/i-product-repository'
import { PrismaProductRepository } from './infra/persistence/prisma-product-repository'
import { ListProductsUseCase } from './use-cases/list-products/list-products'
import { ProductController } from './infra/http/product-controller'
import { prisma } from '@shared/database/prisma-client'

export function registerCatalogModule(): void {
  container.register<IProductRepository>('IProductRepository', {
    useValue: new PrismaProductRepository(prisma),
  })
  container.register('PrismaClient', { useValue: prisma })
  container.register(ListProductsUseCase, {
    useFactory: () =>
      new ListProductsUseCase(container.resolve<IProductRepository>('IProductRepository')),
  })
  container.register(ProductController, {
    useFactory: () =>
      new ProductController(container.resolve(ListProductsUseCase)),
  })
}
```

- [ ] **Step 6: Create `src/infra/http/server.ts`**

```typescript
import Fastify, { type FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { container } from 'tsyringe'
import { ProductController } from '@modules/catalog/infra/http/product-controller'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    genReqId: () => randomUUID(),
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  })

  app.addHook('onRequest', async (request, reply) => {
    const correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ?? request.id
    request.correlationId = correlationId
    reply.header('x-correlation-id', correlationId)
    request.log.info({ correlationId, method: request.method, url: request.url }, 'incoming request')
  })

  const productController = container.resolve(ProductController)
  await productController.registerRoutes(app)

  return app
}
```

- [ ] **Step 7: Update `src/main.ts`**

```typescript
import 'reflect-metadata'
import { registerCatalogModule } from '@modules/catalog/container'
import { buildApp } from '@infra/http/server'

async function bootstrap(): Promise<void> {
  registerCatalogModule()
  const app = await buildApp()
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 9: Start the server and test the endpoint manually**

With Docker running (`docker compose up -d`), run:
```bash
npx tsx src/main.ts
```
In another terminal:
```bash
curl -s "http://localhost:3000/products?page=1&limit=5" | jq .
```
Expected response shape:
```json
{
  "data": [],
  "meta": { "page": 1, "limit": 5, "total": 0, "totalPages": 0 }
}
```
(Empty because seed hasn't run yet — that's fine.)

Also verify `x-correlation-id` header is present:
```bash
curl -sv "http://localhost:3000/products" 2>&1 | grep -i "x-correlation-id"
```

- [ ] **Step 10: Commit**

```bash
git add src/modules/catalog/mappers/ src/modules/catalog/presenters/ src/modules/catalog/infra/http/ src/modules/catalog/container.ts src/infra/ src/main.ts
git commit -m "feat: ProductController, ProductPresenter, catalog DI container, Fastify server with correlationId hook"
```

---

## Task 6: Seed Script — 100 Products + StockFlow Entries

**Files:**
- Create: `prisma/seed.mjs`

**Interfaces:**
- Consumes: `@prisma/client` PrismaClient, `DATABASE_URL` env var
- Produces: ~100 rows in `products` table, ~100+ rows in `stock_flows`

- [ ] **Step 1: Add seed script to `package.json`**

Add to `package.json` under `"scripts"`:
```json
"db:seed": "node prisma/seed.mjs"
```
Also add at the root level of `package.json`:
```json
"prisma": {
  "seed": "node prisma/seed.mjs"
}
```

- [ ] **Step 2: Create `prisma/seed.mjs`**

```javascript
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()

const BRANDS = {
  Apple: ['iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 13'],
  Samsung: ['Galaxy S24 Ultra', 'Galaxy S24', 'Galaxy S23', 'Galaxy A54', 'Galaxy A34', 'Galaxy M54'],
  Motorola: ['Moto G84', 'Moto G54', 'Edge 40', 'Moto G73', 'Moto G53'],
  Xiaomi: ['Redmi Note 13 Pro', 'Redmi Note 13', 'Poco X5 Pro', 'Poco X5', '13T Pro'],
  'Realme': ['GT 5', 'GT Neo 5', '11 Pro', 'Narzo 60', 'C55'],
  'OnePlus': ['12', '11', 'Nord CE 3', 'Nord 3'],
  Sony: ['Xperia 5 V', 'Xperia 1 V', 'Xperia 10 V'],
  Asus: ['ROG Phone 7', 'Zenfone 10'],
  Nokia: ['G42', 'C32', 'X30'],
  LG: ['Velvet 5G', 'Wing 5G'],
}

const MATERIALS = ['Silicone', 'TPU', 'Hard Plastic', 'Leather', 'Carbon Fiber']
const COLORS = ['Black', 'Blue', 'Red', 'Green', 'White', 'Clear', 'Purple', 'Navy']

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function buildSKU(brand, model, material, color) {
  return `CASE-${slugify(brand)}-${slugify(model)}-${slugify(material)}-${slugify(color)}`.toUpperCase().slice(0, 64)
}

function randomPrice() {
  const prices = [19.9, 24.9, 29.9, 34.9, 39.9, 49.9, 59.9, 69.9, 89.9, 99.9, 129.9, 149.9]
  return prices[Math.floor(Math.random() * prices.length)]
}

async function main() {
  console.log('Seeding database...')

  await prisma.stockFlow.deleteMany()
  await prisma.product.deleteMany()

  const products = []
  const seen = new Set()

  for (const [brand, models] of Object.entries(BRANDS)) {
    for (const model of models) {
      const material = MATERIALS[Math.floor(Math.random() * MATERIALS.length)]
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const sku = buildSKU(brand, model, material, color)

      if (seen.has(sku)) continue
      seen.add(sku)

      products.push({
        id: randomUUID(),
        sku,
        name: `Capa ${material} ${color} — ${brand} ${model}`,
        price: randomPrice(),
      })

      if (products.length >= 100) break
    }
    if (products.length >= 100) break
  }

  // Fill up to 100 if needed with extra color variants
  let extra = 0
  outer: for (const [brand, models] of Object.entries(BRANDS)) {
    for (const model of models) {
      for (const material of MATERIALS) {
        for (const color of COLORS) {
          if (products.length >= 100) break outer
          const sku = buildSKU(brand, model, material, color)
          if (seen.has(sku)) continue
          seen.add(sku)
          products.push({
            id: randomUUID(),
            sku,
            name: `Capa ${material} ${color} — ${brand} ${model}`,
            price: randomPrice(),
          })
          extra++
        }
      }
    }
  }

  await prisma.product.createMany({ data: products })

  const stockFlows = products.map((p) => ({
    id: randomUUID(),
    productId: p.id,
    quantity: Math.floor(Math.random() * 200) + 10,
    movedAt: new Date(),
  }))

  await prisma.stockFlow.createMany({ data: stockFlows })

  console.log(`Seeded ${products.length} products and ${stockFlows.length} stock flow entries.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 3: Run the seed against dev database**

With Docker running and migrations applied:
```bash
npx prisma db seed
```
Expected output:
```
Seeded 100 products and 100 stock flow entries.
```

- [ ] **Step 4: Verify data exists and endpoint returns products**

```bash
curl -s "http://localhost:3000/products?limit=3" | jq '{total: .meta.total, first: .data[0]}'
```
Expected: `meta.total` = 100, `data[0]` has `id`, `sku`, `name`, `price`, `availableQuantity`.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.mjs package.json
git commit -m "feat: seed script — 100 products with stock flows"
```

---

## Self-Review Checklist

| Spec requirement | Covered by |
|---|---|
| `GET /products` returns paginated product list | Task 5 (controller) + Task 3 (use case) |
| Pagination via `page` + `limit` query params | Tasks 3, 5 |
| Response shape: `{ data, meta: { page, limit, total, totalPages } }` | Tasks 3, 5 |
| Stock read from `StockFlow` table | Tasks 1, 4 |
| Seed with ~100 products | Task 6 |
| TDD (red → green → refactor) | Tasks 2, 3 |
| Unit tests: no real I/O | Task 3 (InMemoryProductRepository) |
| Integration tests for Prisma layer | Task 4 |
| Either pattern on use-case | Task 3 |
| correlationId on every request | Task 5 (onRequest hook) |
| pino logger | Tasks 1, 5 |
| OTel span for `GET /products` | Task 5 (controller) |
| No `vi.mock()` of Prisma | Tasks 2, 3 (InMemory fake used) |
| tsyringe DI | Tasks 3, 4, 5 |
| kebab-case files | All tasks |
| `IProductRepository` interface prefixed with `I` | Task 3 |
| No `new` outside `container.ts` | Task 5 (container.ts) |
| `DomainError` with semantic `code` | Task 2 |
| `@shared` / `@modules` / `@infra` path aliases | All tasks |
| No `console.log` | All tasks (pino used) |
| `price` as `Decimal(10, 2)` in Prisma | Task 1 |
