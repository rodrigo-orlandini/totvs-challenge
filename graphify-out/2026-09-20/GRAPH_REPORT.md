# Graph Report - totvs  (2026-09-20)

## Corpus Check
- 138 files · ~51,947 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 35 file(s) not represented in the graph (top: (none) 32, .example 1, .toml 1)

## Summary
- 727 nodes · 1507 edges · 52 communities (39 shown, 13 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 100 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7be89cf1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- process-sync-job.spec.ts
- scripts
- product-price.ts
- Checkout Assíncrono — Design Spec
- ErpProduct
- package.json
- IOrderRepository
- ERP Sync Design Spec
- compilerOptions
- File Map
- vitest
- seed.mjs
- poll-erp-products.ts
- tsconfig.build.json
- Order
- Observability Rules (correlationId, spans)
- Docker Compose Dev Environment
- Vitrine Inicial Implementation Plan
- Prompt 01: Vitrine Inicial
- 03 — Git Workflow e CI Pipeline
- CLAUDE.md
- devDependencies
- reflect-metadata
- Arquitetura
- Processo
- dependencies
- Checklist
- main.ts
- ProductCacheService
- Process
- Session Start — CaseCellShop
- Prompts
- Test-Driven Development
- server.ts
- process-checkout-job.ts
- process-sync-job.ts
- prisma
- ErpStockFlow
- 04 — Cache da Vitrine
- IOutboxRepository
- ICheckoutOutboxRepository
- PrismaOutboxRepository
- prisma-product-stock-checker.ts
- IStockReservationRepository
- PrismaOrderRepository
- erp-adapter/container.ts
- Failure
- Success
- InvalidPriceError
- InvalidSKUError

## God Nodes (most connected - your core abstractions)
1. `ProductCacheService` - 29 edges
2. `IOutboxRepository` - 23 edges
3. `DomainError` - 23 edges
4. `vitest` - 22 edges
5. `@prisma/client` - 22 edges
6. `reflect-metadata` - 22 edges
7. `tsyringe` - 21 edges
8. `OrderStatus` - 20 edges
9. `right()` - 20 edges
10. `scripts` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Camadas de cache` --references--> `ProductResponseItem`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/catalog/dtos/list-products-dto.ts
- `Invalidação / atualização por sync — `ProcessSyncJobUseCase`` --references--> `ProcessSyncJobUseCase`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.ts
- `Constraints` --references--> `ListProductsUseCase`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/catalog/use-cases/list-products/list-products.ts
- `Contexto` --references--> `ListProductsUseCase`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/catalog/use-cases/list-products/list-products.ts
- `Contexto` --references--> `ListProductsUseCase`  [INFERRED]
  prompts/04-cache-vitrine.md → src/modules/catalog/use-cases/list-products/list-products.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Clean Architecture Enforcement** — claude_agents_arch_reviewer, arch_rules_dependency_rule, arch_rules_either_pattern, arch_rules_di_pattern [EXTRACTED 1.00]
- **ERP Sync Data Flow** — erp_sync_worker_threads, erp_sync_transactional_outbox, erp_sync_bullmq, erp_sync_dlq [EXTRACTED 1.00]
- **Development Workflow Toolset** — claude_agents_arch_reviewer, claude_agents_tdd_agent, prompts_00_arch [INFERRED 0.95]

## Communities (52 total, 13 thin omitted)

### Community 0 - "process-sync-job.spec.ts"
Cohesion: 0.10
Nodes (11): PrismaCatalogProductWriteRepository, inject, injectable, PrismaCatalogStockFlowWriteRepository, inject, injectable, ICatalogProductWriteRepository, ICatalogStockFlowWriteRepository (+3 more)

### Community 1 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:generate, db:migrate, db:migrate:erp, db:migrate:test, db:seed, db:seed:erp (+10 more)

### Community 2 - "product-price.ts"
Cohesion: 0.14
Nodes (9): Product, ProductProps, makePrice(), makeSKU(), ProductPrice, SKU, ProductMapper, ProductRow (+1 more)

### Community 3 - "Checkout Assíncrono — Design Spec"
Cohesion: 0.08
Nodes (25): Checkout Assíncrono — Design Spec, `checkout_outbox`, Constraints Globais, `create-checkout.spec.ts`, Endpoints, Estratégia de Testes, Estrutura de Arquivos, Fora do escopo de unit tests (+17 more)

### Community 4 - "ErpProduct"
Cohesion: 0.26
Nodes (6): ErpProduct, PrismaErpProductRepository, inject, injectable, IErpProductRepository, InMemoryErpProductRepository

### Community 5 - "package.json"
Cohesion: 0.11
Nodes (17): description, main, name, version, eslint, pino, prisma, tsc-alias (+9 more)

### Community 6 - "IOrderRepository"
Cohesion: 0.17
Nodes (6): inject, injectable, IOrderRepository, CreateCheckoutUseCase, GetOrderStatusUseCase, ProcessCheckoutJobUseCase

### Community 7 - "ERP Sync Design Spec"
Cohesion: 0.12
Nodes (24): Clean Architecture Dependency Rule, Dependency Injection via tsyringe, Either<DomainError, T> Pattern, Kebab-case Naming Convention, Test Strategy (Unit + Integration), Arch Reviewer Agent, TDD Agent, Catalog Module (+16 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, lib, module, outDir (+11 more)

### Community 9 - "File Map"
Cohesion: 0.17
Nodes (11): Checkout Assíncrono — Implementation Plan, File Map, Global Constraints, Task 1: Prisma schema + migration, Task 2: Domain errors + interfaces + DTOs, Task 3: CreateCheckout use case, Task 4: GetOrderStatus use case, Task 5: ProcessCheckoutJob use case (+3 more)

### Community 10 - "vitest"
Cohesion: 0.06
Nodes (33): Task 2: CachedProductRepository, ref_path, vitest, IL1Entry, registerCatalogModule(), ListProductsInput, ListProductsOutput, ProductResponseItem (+25 more)

### Community 11 - "seed.mjs"
Cohesion: 0.31
Nodes (8): BRANDS, buildSKU(), COLORS, main(), MATERIALS, prisma, randomPrice(), slugify()

### Community 12 - "poll-erp-products.ts"
Cohesion: 0.10
Nodes (16): PrismaSyncCursorRepository, inject, injectable, ISyncCursorRepository, InMemorySyncCursorRepository, PollErpProductsInput, PollErpProductsOutput, PollErpProductsUseCase (+8 more)

### Community 13 - "tsconfig.build.json"
Cohesion: 0.50
Nodes (3): ./tsconfig.json, exclude, extends

### Community 14 - "Order"
Cohesion: 0.67
Nodes (3): Checkout Module, Order, OrderStatus

### Community 19 - "03 — Git Workflow e CI Pipeline"
Cohesion: 0.25
Nodes (7): 03 — Git Workflow e CI Pipeline, Contexto, Critérios de Direcionamento, Objetivo, Prompt, Resultado, Revisões

### Community 20 - "CLAUDE.md"
Cohesion: 0.50
Nodes (3): Command output, Docker, Prompts

### Community 21 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, prisma, tsc-alias, tsx, @types/node, @types/uuid, typescript (+4 more)

### Community 22 - "reflect-metadata"
Cohesion: 0.07
Nodes (25): ref_node_crypto, reflect-metadata, OrderStatus, CONFIRMED, FAILED, FAILED_PERMANENT, PENDING, PROCESSING (+17 more)

### Community 23 - "Arquitetura"
Cohesion: 0.17
Nodes (11): Arquitetura, Cache da Vitrine — Design Spec, Camadas de cache, Constraints, Contexto, Estrutura de arquivos, Fluxo de leitura — `CachedProductRepository.findAll({ page, limit })`, Invalidação / atualização por sync — `ProcessSyncJobUseCase` (+3 more)

### Community 24 - "Processo"
Cohesion: 0.25
Nodes (7): 1. Contexto, 2. Identificar candidatos a Value Object, 3. Definir invariantes da entity, 4. Validar nomenclatura, 5. Saída, Domain Modeler — CaseCellShop, Processo

### Community 25 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @bull-board/api, @bull-board/fastify, bullmq, fastify, @fastify/swagger, @fastify/swagger-ui, ioredis (+6 more)

### Community 26 - "Checklist"
Cohesion: 0.25
Nodes (7): Campos obrigatórios em logs de erro, Checklist, Formato de saída, Logger estruturado, Métricas, Observability Enforcer — CaseCellShop, Tracing

### Community 27 - "main.ts"
Cohesion: 0.07
Nodes (23): Task 9: Container wiring + startup, bullmq, ioredis, ref_node_path, ref_node_worker_threads, buildApp(), bootstrap(), registerErpAdapterModule() (+15 more)

### Community 28 - "ProductCacheService"
Cohesion: 0.11
Nodes (15): Cache da Vitrine — Implementation Plan, Global Constraints, Self-Review Checklist, Task 1: IProductCacheUpdater + ProductCacheService, Task 3: ProcessSyncJobUseCase cache integration, Task 4: CacheRefreshScheduler, Task 5: Container wiring + startup, CacheRefreshScheduler (+7 more)

### Community 29 - "Process"
Cohesion: 0.33
Nodes (5): 1. Explore, 2. Present candidates as an HTML report, 3. Grilling loop, Improve Codebase Architecture, Process

### Community 30 - "Session Start — CaseCellShop"
Cohesion: 0.40
Nodes (4): Direcionamento por tipo de tarefa, O que fazer, Saída esperada, Session Start — CaseCellShop

### Community 31 - "Prompts"
Cohesion: 0.40
Nodes (4): Convenção de nomes, Estrutura de cada arquivo, Prompts, Quando registrar

### Community 32 - "Test-Driven Development"
Cohesion: 0.50
Nodes (3): Key Principles, Overview, Test-Driven Development

### Community 34 - "server.ts"
Cohesion: 0.22
Nodes (7): @bull-board/api, @bull-board/fastify, fastify, @fastify/swagger, @fastify/swagger-ui, fastify, FastifyRequest

### Community 35 - "process-checkout-job.ts"
Cohesion: 0.27
Nodes (6): OrderNotFoundError, GetOrderStatusInput, ProcessCheckoutJobInput, Either, left(), right()

### Community 36 - "process-sync-job.ts"
Cohesion: 0.23
Nodes (6): InsufficientStockError, ProductNotFoundError, SyncEntity, SyncProcessingError, ProcessSyncJobInput, DomainError

### Community 38 - "ErpStockFlow"
Cohesion: 0.26
Nodes (6): ErpStockFlow, PrismaErpStockFlowRepository, inject, injectable, IErpStockFlowRepository, InMemoryErpStockFlowRepository

### Community 39 - "04 — Cache da Vitrine"
Cohesion: 0.25
Nodes (7): 04 — Cache da Vitrine, Contexto, Critérios de Direcionamento, Objetivo, Prompt, Resultado, Revisões

### Community 40 - "IOutboxRepository"
Cohesion: 0.24
Nodes (4): OutboxEntry, OutboxStatus, IOutboxRepository, InMemoryOutboxRepository

### Community 41 - "ICheckoutOutboxRepository"
Cohesion: 0.16
Nodes (3): PrismaCheckoutOutboxRepository, CheckoutOutboxEntry, ICheckoutOutboxRepository

### Community 42 - "PrismaOutboxRepository"
Cohesion: 0.14
Nodes (6): prisma, product, repo, PrismaOutboxRepository, inject, injectable

### Community 43 - "prisma-product-stock-checker.ts"
Cohesion: 0.23
Nodes (4): PrismaProductStockChecker, IProductStockChecker, ProductStockInfo, InMemoryProductStockChecker

### Community 46 - "erp-adapter/container.ts"
Cohesion: 0.44
Nodes (4): @prisma/client, tsyringe, erpPrisma, prisma

## Knowledge Gaps
- **195 isolated node(s):** `IL1Entry`, `PaginationMeta`, `ProductRow`, `CheckoutItem`, `OrderItem` (+190 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 324 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `reflect-metadata` connect `reflect-metadata` to `process-sync-job.spec.ts`, `process-checkout-job.ts`, `process-sync-job.ts`, `package.json`, `ErpProduct`, `ErpStockFlow`, `vitest`, `poll-erp-products.ts`, `erp-adapter/container.ts`, `main.ts`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `erp-adapter/container.ts` to `ErpProduct`, `package.json`, `ErpStockFlow`, `IOutboxRepository`, `ICheckoutOutboxRepository`, `vitest`, `seed.mjs`, `prisma-product-stock-checker.ts`, `IStockReservationRepository`, `PrismaOutboxRepository`, `poll-erp-products.ts`, `reflect-metadata`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `vitest` connect `vitest` to `process-sync-job.spec.ts`, `product-price.ts`, `ErpProduct`, `package.json`, `ErpStockFlow`, `PrismaOutboxRepository`, `reflect-metadata`, `main.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ProductCacheService` (e.g. with `Cache da Vitrine — Implementation Plan` and `Global Constraints`) actually correct?**
  _`ProductCacheService` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `IL1Entry`, `PaginationMeta`, `ProductRow` to the rest of the system?**
  _195 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `process-sync-job.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10333333333333333 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._