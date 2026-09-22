# Graph Report - totvs  (2026-09-21)

## Corpus Check
- 152 files · ~62,303 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 35 file(s) not represented in the graph (top: (none) 32, .example 1, .toml 1)

## Summary
- 887 nodes · 1969 edges · 60 communities (54 shown, 6 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 207 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e38ec529`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- process-sync-job.ts
- erp-adapter/container.ts
- ErpStockFlow
- Checkout Assíncrono — Design Spec
- @prisma/client
- package.json
- poll-erp-stock-flows.ts
- ERP Sync Design Spec
- compilerOptions
- CachedProductRepository
- CaseCellShop
- create-checkout.ts
- ErpProduct
- tsconfig.build.json
- Order
- Observability Rules (correlationId, spans)
- Docker Compose Dev Environment
- Vitrine Inicial Implementation Plan
- PROMPTS.md
- 03 — Git Workflow e CI Pipeline
- CLAUDE.md
- PrismaOutboxRepository
- OrderStatus
- ProductResponseItem
- Processo
- dependencies
- Checklist
- ERP System
- ICheckoutStockFlowWriter
- Process
- Session Start — CaseCellShop
- Prompts
- Test-Driven Development
- Arch Reviewer Agent
- ProductCacheService
- 04 — Cache da Vitrine
- bullmq-checkout-worker.ts
- main.ts
- DomainError
- Observabilidade — CaseCellShop
- Observabilidade — Design Spec
- IOutboxRepository
- product-cache-service.ts
- CacheRefreshScheduler
- erp-scheduler.ts
- scripts
- Global Constraints
- checkout/container.ts
- tsyringe
- catalog/container.ts
- context.ts
- server.ts
- devDependencies
- ICheckoutOutboxRepository
- registerCheckoutModule
- 05 — Checkout Assíncrono
- IOrderRepository
- inject
- 06 — Observabilidade
- injectable

## God Nodes (most connected - your core abstractions)
1. `ProductCacheService` - 33 edges
2. `DomainError` - 28 edges
3. `OrderStatus` - 26 edges
4. `IOrderRepository` - 25 edges
5. `tsyringe` - 24 edges
6. `ICheckoutOutboxRepository` - 23 edges
7. `reflect-metadata` - 23 edges
8. `IOutboxRepository` - 22 edges
9. `@prisma/client` - 22 edges
10. `vitest` - 22 edges

## Surprising Connections (you probably didn't know these)
- ``get-order-status.spec.ts`` --references--> `OrderNotFoundError`  [INFERRED]
  docs/superpowers/specs/2026-09-20-checkout-assincrono-design.md → src/modules/checkout/errors/order-not-found-error.ts
- `Constraints Globais` --references--> `IOrderRepository`  [INFERRED]
  docs/superpowers/specs/2026-09-20-checkout-assincrono-design.md → src/modules/checkout/repositories/order-repository.ts
- `Worker BullMQ (queue: `checkout-processing`)` --references--> `Order`  [INFERRED]
  docs/superpowers/specs/2026-09-20-checkout-assincrono-design.md → src/modules/checkout/repositories/order-repository.ts
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

## Communities (60 total, 6 thin omitted)

### Community 0 - "process-sync-job.ts"
Cohesion: 0.13
Nodes (11): inject, injectable, SyncEntity, SyncJobPayload, PrismaCatalogStockFlowWriteRepository, inject, injectable, ICatalogStockFlowWriteRepository (+3 more)

### Community 1 - "erp-adapter/container.ts"
Cohesion: 0.21
Nodes (7): PrismaCatalogProductWriteRepository, inject, injectable, ICatalogProductWriteRepository, InMemoryCatalogProductWriteRepository, erpPrisma, prisma

### Community 2 - "ErpStockFlow"
Cohesion: 0.26
Nodes (6): ErpStockFlow, PrismaErpStockFlowRepository, inject, injectable, IErpStockFlowRepository, InMemoryErpStockFlowRepository

### Community 3 - "Checkout Assíncrono — Design Spec"
Cohesion: 0.09
Nodes (21): Checkout Assíncrono — Design Spec, `checkout_outbox`, Constraints Globais, Estratégia de Testes, Estrutura de Arquivos, Fora do escopo de unit tests, `get-order-status.spec.ts`, ICheckoutOutboxRepository (+13 more)

### Community 4 - "@prisma/client"
Cohesion: 0.22
Nodes (8): ref_node_worker_threads, @prisma/client, PrismaSyncCursorRepository, inject, injectable, _base, logger, tracer

### Community 5 - "package.json"
Cohesion: 0.09
Nodes (24): description, main, name, prisma, seed, version, eslint, @opentelemetry/exporter-trace-otlp-http (+16 more)

### Community 6 - "poll-erp-stock-flows.ts"
Cohesion: 0.17
Nodes (8): ISyncCursorRepository, InMemorySyncCursorRepository, PollErpStockFlowsInput, PollErpStockFlowsOutput, PollErpStockFlowsUseCase, inject, injectable, IUseCase

### Community 7 - "ERP Sync Design Spec"
Cohesion: 0.36
Nodes (9): ERP Sync Implementation Plan, ERP Sync Design Spec, BullMQ Queue, Cursor-based Polling, Dead Letter Queue (DLQ), Idempotency via ON CONFLICT, Transactional Outbox Pattern, Worker Threads Polling (+1 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, lib, module, outDir (+11 more)

### Community 9 - "CachedProductRepository"
Cohesion: 0.13
Nodes (18): Cache da Vitrine — Implementation Plan, Global Constraints, Task 1: IProductCacheUpdater + ProductCacheService, Task 3: ProcessSyncJobUseCase cache integration, Task 5: Container wiring + startup, Arquitetura, Cache da Vitrine — Design Spec, Camadas de cache (+10 more)

### Community 10 - "CaseCellShop"
Cohesion: 0.06
Nodes (34): Como rodar o projeto, Integração (requer Docker), Observabilidade (opcional), Parar tudo, Passo 1 — Clonar e configurar, Passo 2 — Subir os containers, Passo 3 — Aplicar migrations, Passo 4 — Popular dados iniciais (+26 more)

### Community 11 - "create-checkout.ts"
Cohesion: 0.17
Nodes (9): Task 3: CreateCheckout use case, `create-checkout.spec.ts`, CheckoutItem, CreateCheckoutInput, CreateCheckoutOutput, InsufficientStockError, ProductNotFoundError, CreateCheckoutUseCase (+1 more)

### Community 12 - "ErpProduct"
Cohesion: 0.12
Nodes (12): ErpProduct, OutboxEntry, OutboxStatus, PrismaErpProductRepository, inject, injectable, prisma, product (+4 more)

### Community 13 - "tsconfig.build.json"
Cohesion: 0.50
Nodes (3): ./tsconfig.json, exclude, extends

### Community 14 - "Order"
Cohesion: 0.67
Nodes (3): Checkout Module, Order, OrderStatus

### Community 18 - "PROMPTS.md"
Cohesion: 0.29
Nodes (3): Prompt 01: Vitrine Inicial, Prompts de IA, Índice

### Community 19 - "03 — Git Workflow e CI Pipeline"
Cohesion: 0.29
Nodes (7): 03 — Git Workflow e CI Pipeline, Contexto, Critérios de Direcionamento, Objetivo, Prompt, Resultado, Revisões

### Community 20 - "CLAUDE.md"
Cohesion: 0.50
Nodes (3): Command output, Docker, Prompts

### Community 21 - "PrismaOutboxRepository"
Cohesion: 0.20
Nodes (3): PrismaOutboxRepository, inject, injectable

### Community 22 - "OrderStatus"
Cohesion: 0.09
Nodes (22): Task 1: Prisma schema + migration, Endpoints, GET /orders/:orderId/status, POST /checkout, reflect-metadata, OrderStatus, CONFIRMED, FAILED (+14 more)

### Community 23 - "ProductResponseItem"
Cohesion: 0.19
Nodes (12): Task 2: CachedProductRepository, ProductResponseItem, prisma, repo, PrismaProductRepository, inject, injectable, FindAllParams (+4 more)

### Community 24 - "Processo"
Cohesion: 0.25
Nodes (7): 1. Contexto, 2. Identificar candidatos a Value Object, 3. Definir invariantes da entity, 4. Validar nomenclatura, 5. Saída, Domain Modeler — CaseCellShop, Processo

### Community 25 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, @bull-board/api, @bull-board/fastify, bullmq, fastify, @fastify/swagger, @fastify/swagger-ui, ioredis (+12 more)

### Community 26 - "Checklist"
Cohesion: 0.25
Nodes (7): Campos obrigatórios em logs de erro, Checklist, Formato de saída, Logger estruturado, Métricas, Observability Enforcer — CaseCellShop, Tracing

### Community 27 - "ERP System"
Cohesion: 0.29
Nodes (8): Test Strategy (Unit + Integration), TDD Agent, Catalog Module, ERP System, ERP Adapter Module, Product, Stock, Docker Compose Test Environment

### Community 28 - "ICheckoutStockFlowWriter"
Cohesion: 0.14
Nodes (12): BRANDS, buildSKU(), COLORS, main(), MATERIALS, prisma, randomPrice(), slugify() (+4 more)

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

### Community 33 - "Arch Reviewer Agent"
Cohesion: 0.43
Nodes (7): Clean Architecture Dependency Rule, Dependency Injection via tsyringe, Either<DomainError, T> Pattern, Kebab-case Naming Convention, Arch Reviewer Agent, Modular Monolith Clean Architecture Design, Prompt 00: Estrutura Arquitetural

### Community 34 - "ProductCacheService"
Cohesion: 0.26
Nodes (4): Task 4: CacheRefreshScheduler, Task 5: Instrument ProductCacheService (cache.get span + metrics), ProductCacheService, getLogger()

### Community 35 - "04 — Cache da Vitrine"
Cohesion: 0.25
Nodes (7): 04 — Cache da Vitrine, Contexto, Critérios de Direcionamento, Objetivo, Prompt, Resultado, Revisões

### Community 36 - "bullmq-checkout-worker.ts"
Cohesion: 0.18
Nodes (10): bullmq, prom-client, CheckoutJobPayload, CheckoutJobPayload, redis, redisUrl, testQueue, metrics (+2 more)

### Community 37 - "main.ts"
Cohesion: 0.50
Nodes (7): Task 9: Container wiring + startup, Task 1: Install packages + refactor tracer.ts + wire initTracer in main.ts, buildApp(), bootstrap(), registerSharedInfra(), initTracer(), shutdownTracer()

### Community 38 - "DomainError"
Cohesion: 0.06
Nodes (25): ref_path, vitest, Product, ProductProps, makePrice(), makeSKU(), InvalidPriceError, ProductPrice (+17 more)

### Community 39 - "Observabilidade — CaseCellShop"
Cohesion: 0.25
Nodes (7): Alertas exemplo (Grafana), Métricas disponíveis em /metrics, Observabilidade — CaseCellShop, Produção com Datadog, Runbook — Checkout travado, Spans instrumentados, Stack local

### Community 40 - "Observabilidade — Design Spec"
Cohesion: 0.10
Nodes (19): Alerta exemplo, Arquitetura, Cache, `cache.get`, Camadas de observabilidade, Checkout, `checkout.create`, `checkout.process.job` (+11 more)

### Community 41 - "IOutboxRepository"
Cohesion: 0.14
Nodes (7): registerErpAdapterModule(), BullMQRelay, BullMQSyncWorker, IOutboxRepository, PollErpProductsUseCase, inject, injectable

### Community 42 - "product-cache-service.ts"
Cohesion: 0.14
Nodes (5): Self-Review Checklist, ioredis, IL1Entry, jitteredTtlMs(), jitteredTtlSec()

### Community 44 - "erp-scheduler.ts"
Cohesion: 0.20
Nodes (7): ref_node_path, ErpScheduler, MockedWorker, mockOn, mockTerminate, WORKER_FILES, WorkerEntity

### Community 45 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:generate, db:migrate, db:migrate:erp, db:migrate:test, db:seed, db:seed:erp (+10 more)

### Community 46 - "Global Constraints"
Cohesion: 0.20
Nodes (10): Cache hit rate abaixo de 70% por 5 minutos, Checkout failures acima de 10% por 10 minutos, Global Constraints, Observabilidade — Implementation Plan, Task 3: Create metrics.ts (prom-client registry), Task 4: Instrument server.ts (span + ALS + /metrics route), Task 6: Instrument CreateCheckoutUseCase (checkout.create span + metric), Task 7: Instrument relay (metrics) + worker (checkout.process.job span + ALS + metrics) (+2 more)

### Community 47 - "checkout/container.ts"
Cohesion: 0.31
Nodes (3): PrismaStockReservationRepository, IStockReservationRepository, inject

### Community 48 - "tsyringe"
Cohesion: 0.11
Nodes (17): Task 7: HTTP controllers, fastify, tsyringe, CheckoutBody, CheckoutController, inject, injectable, OrderStatusController (+9 more)

### Community 49 - "catalog/container.ts"
Cohesion: 0.13
Nodes (14): registerCatalogModule(), ListProductsInput, ListProductsOutput, ListProductsQuery, listProductsSchema, ProductController, productSchema, inject (+6 more)

### Community 50 - "context.ts"
Cohesion: 0.24
Nodes (9): Task 2: Create context.ts (AsyncLocalStorage) + refactor logger.ts, Arquivos, Criados, Modificados, ref_node_async_hooks, als, getContext(), ObsContext (+1 more)

### Community 51 - "server.ts"
Cohesion: 0.20
Nodes (8): @bull-board/api, @bull-board/fastify, @fastify/swagger, @fastify/swagger-ui, @opentelemetry/api, fastify, FastifyRequest, src_shared_observability_tracer_otelcontext

### Community 52 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, prisma, tsc-alias, tsx, @types/node, @types/uuid, typescript (+4 more)

### Community 53 - "ICheckoutOutboxRepository"
Cohesion: 0.15
Nodes (5): PrismaCheckoutOutboxRepository, BullMQCheckoutRelay, CheckoutOutboxEntry, ICheckoutOutboxRepository, StoredEntry

### Community 54 - "registerCheckoutModule"
Cohesion: 0.29
Nodes (5): registerCheckoutModule(), PrismaProductStockChecker, IProductStockChecker, ProductStockInfo, InMemoryProductStockChecker

### Community 55 - "05 — Checkout Assíncrono"
Cohesion: 0.29
Nodes (7): 05 — Checkout Assíncrono, Contexto, Critérios de Direcionamento, Objetivo, Prompt, Resultado, Revisões

### Community 56 - "IOrderRepository"
Cohesion: 0.13
Nodes (14): Checkout Assíncrono — Implementation Plan, File Map, Global Constraints, Task 2: Domain errors + interfaces + DTOs, Task 4: GetOrderStatus use case, Task 5: ProcessCheckoutJob use case, Task 6: Prisma repository implementations, Task 8: Queue infrastructure (+6 more)

### Community 58 - "06 — Observabilidade"
Cohesion: 0.29
Nodes (7): 06 — Observabilidade, Contexto, Critérios de Direcionamento, Objetivo, Prompt, Resultado, Revisões

## Knowledge Gaps
- **253 isolated node(s):** `ProcessSyncJobInput`, `CheckoutItem`, `CheckoutBody`, `OutboxStatus`, `ProcessCheckoutJobInput` (+248 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 381 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getLogger()` connect `ProductCacheService` to `bullmq-checkout-worker.ts`, `@prisma/client`, `Observabilidade — Design Spec`, `product-cache-service.ts`, `Global Constraints`, `context.ts`, `ICheckoutOutboxRepository`, `IOrderRepository`, `06 — Observabilidade`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `reflect-metadata` connect `OrderStatus` to `process-sync-job.ts`, `erp-adapter/container.ts`, `ErpStockFlow`, `@prisma/client`, `main.ts`, `package.json`, `DomainError`, `poll-erp-stock-flows.ts`, `product-cache-service.ts`, `create-checkout.ts`, `erp-scheduler.ts`, `ErpProduct`, `checkout/container.ts`, `catalog/container.ts`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `vitest` connect `DomainError` to `process-sync-job.ts`, `ErpStockFlow`, `bullmq-checkout-worker.ts`, `package.json`, `product-cache-service.ts`, `ErpProduct`, `erp-scheduler.ts`, `catalog/container.ts`, `OrderStatus`, `ProductResponseItem`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `ProductCacheService` (e.g. with `Cache da Vitrine — Implementation Plan` and `Global Constraints`) actually correct?**
  _`ProductCacheService` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `OrderStatus` (e.g. with `Task 2: Domain errors + interfaces + DTOs` and `Task 3: CreateCheckout use case`) actually correct?**
  _`OrderStatus` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `IOrderRepository` (e.g. with `Global Constraints` and `Task 2: Domain errors + interfaces + DTOs`) actually correct?**
  _`IOrderRepository` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ProcessSyncJobInput`, `CheckoutItem`, `CheckoutBody` to the rest of the system?**
  _253 weakly-connected nodes found - possible documentation gaps or missing edges._