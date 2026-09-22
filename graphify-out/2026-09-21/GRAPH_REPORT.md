# Graph Report - totvs  (2026-09-21)

## Corpus Check
- 152 files · ~62,289 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 35 file(s) not represented in the graph (top: (none) 32, .example 1, .toml 1)

## Summary
- 885 nodes · 1977 edges · 58 communities (55 shown, 3 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 207 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5c4a86a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- erp-adapter/container.ts
- process-sync-job.ts
- ErpStockFlow
- Checkout Assíncrono — Design Spec
- reflect-metadata
- package.json
- poll-erp-products.ts
- ERP Sync Design Spec
- compilerOptions
- IProductCacheUpdater
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
- InMemoryCheckoutOutboxRepository
- ProductResponseItem
- Processo
- dependencies
- Checklist
- ERP System
- process-checkout-job.ts
- Process
- Session Start — CaseCellShop
- Prompts
- Test-Driven Development
- Arch Reviewer Agent
- ProductCacheService
- 04 — Cache da Vitrine
- server.ts
- tracer.ts
- DomainError
- Observabilidade — CaseCellShop
- Observabilidade — Design Spec
- IOutboxRepository
- product-cache-service.ts
- CacheRefreshScheduler
- vitest
- seed.mjs
- Global Constraints
- IStockReservationRepository
- checkout/container.ts
- list-products.ts
- context.ts
- @opentelemetry/api
- devDependencies
- in-memory-checkout-outbox-repository.ts
- IOrderRepository
- 05 — Checkout Assíncrono
- ICheckoutOutboxRepository
- 06 — Observabilidade

## God Nodes (most connected - your core abstractions)
1. `ProductCacheService` - 33 edges
2. `DomainError` - 29 edges
3. `OrderStatus` - 26 edges
4. `IOrderRepository` - 25 edges
5. `tsyringe` - 24 edges
6. `IOutboxRepository` - 23 edges
7. `ICheckoutOutboxRepository` - 23 edges
8. `reflect-metadata` - 23 edges
9. `vitest` - 22 edges
10. `@prisma/client` - 22 edges

## Surprising Connections (you probably didn't know these)
- `GET /orders/:orderId/status` --references--> `Order`  [INFERRED]
  docs/superpowers/specs/2026-09-20-checkout-assincrono-design.md → src/modules/checkout/repositories/order-repository.ts
- `POST /checkout` --references--> `Order`  [INFERRED]
  docs/superpowers/specs/2026-09-20-checkout-assincrono-design.md → src/modules/checkout/repositories/order-repository.ts
- `Worker BullMQ (queue: `checkout-processing`)` --references--> `Order`  [INFERRED]
  docs/superpowers/specs/2026-09-20-checkout-assincrono-design.md → src/modules/checkout/repositories/order-repository.ts
- `Constraints Globais` --references--> `IOrderRepository`  [INFERRED]
  docs/superpowers/specs/2026-09-20-checkout-assincrono-design.md → src/modules/checkout/repositories/order-repository.ts
- `Contexto` --references--> `ListProductsUseCase`  [INFERRED]
  prompts/04-cache-vitrine.md → src/modules/catalog/use-cases/list-products/list-products.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Clean Architecture Enforcement** — claude_agents_arch_reviewer, arch_rules_dependency_rule, arch_rules_either_pattern, arch_rules_di_pattern [EXTRACTED 1.00]
- **ERP Sync Data Flow** — erp_sync_worker_threads, erp_sync_transactional_outbox, erp_sync_bullmq, erp_sync_dlq [EXTRACTED 1.00]
- **Development Workflow Toolset** — claude_agents_arch_reviewer, claude_agents_tdd_agent, prompts_00_arch [INFERRED 0.95]

## Communities (58 total, 3 thin omitted)

### Community 0 - "erp-adapter/container.ts"
Cohesion: 0.19
Nodes (10): tsyringe, registerErpAdapterModule(), PrismaCatalogStockFlowWriteRepository, inject, injectable, ICatalogStockFlowWriteRepository, InMemoryCatalogStockFlowWriteRepository, registerSharedInfra() (+2 more)

### Community 1 - "process-sync-job.ts"
Cohesion: 0.15
Nodes (11): SyncEntity, SyncJobPayload, PrismaCatalogProductWriteRepository, inject, injectable, ICatalogProductWriteRepository, InMemoryCatalogProductWriteRepository, ProcessSyncJobInput (+3 more)

### Community 2 - "ErpStockFlow"
Cohesion: 0.15
Nodes (9): ErpStockFlow, OutboxEntry, OutboxStatus, PrismaErpStockFlowRepository, inject, injectable, IErpStockFlowRepository, InMemoryOutboxRepository (+1 more)

### Community 3 - "Checkout Assíncrono — Design Spec"
Cohesion: 0.10
Nodes (20): Checkout Assíncrono — Design Spec, `checkout_outbox`, Constraints Globais, Endpoints, Estrutura de Arquivos, GET /orders/:orderId/status, ICheckoutOutboxRepository, Interfaces dos Repositórios (+12 more)

### Community 4 - "reflect-metadata"
Cohesion: 0.16
Nodes (12): ref_node_path, ref_node_worker_threads, @prisma/client, reflect-metadata, PrismaSyncCursorRepository, inject, injectable, WORKER_FILES (+4 more)

### Community 5 - "package.json"
Cohesion: 0.10
Nodes (19): description, main, name, prisma, seed, version, eslint, pino (+11 more)

### Community 6 - "poll-erp-products.ts"
Cohesion: 0.11
Nodes (13): ISyncCursorRepository, InMemorySyncCursorRepository, PollErpProductsInput, PollErpProductsOutput, PollErpProductsUseCase, inject, injectable, PollErpStockFlowsInput (+5 more)

### Community 7 - "ERP Sync Design Spec"
Cohesion: 0.36
Nodes (9): ERP Sync Implementation Plan, ERP Sync Design Spec, BullMQ Queue, Cursor-based Polling, Dead Letter Queue (DLQ), Idempotency via ON CONFLICT, Transactional Outbox Pattern, Worker Threads Polling (+1 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, lib, module, outDir (+11 more)

### Community 9 - "IProductCacheUpdater"
Cohesion: 0.12
Nodes (22): Cache da Vitrine — Implementation Plan, Global Constraints, Self-Review Checklist, Task 1: IProductCacheUpdater + ProductCacheService, Task 3: ProcessSyncJobUseCase cache integration, Task 5: Container wiring + startup, Arquitetura, Cache da Vitrine — Design Spec (+14 more)

### Community 10 - "CaseCellShop"
Cohesion: 0.06
Nodes (34): Como rodar o projeto, Integração (requer Docker), Observabilidade (opcional), Parar tudo, Passo 1 — Clonar e configurar, Passo 2 — Subir os containers, Passo 3 — Aplicar migrations, Passo 4 — Popular dados iniciais (+26 more)

### Community 11 - "create-checkout.ts"
Cohesion: 0.15
Nodes (16): Task 2: Domain errors + interfaces + DTOs, Task 3: CreateCheckout use case, Task 4: GetOrderStatus use case, OrderStatus, CONFIRMED, FAILED, FAILED_PERMANENT, PENDING (+8 more)

### Community 12 - "ErpProduct"
Cohesion: 0.19
Nodes (9): ErpProduct, PrismaErpProductRepository, inject, injectable, prisma, product, repo, IErpProductRepository (+1 more)

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

### Community 22 - "InMemoryCheckoutOutboxRepository"
Cohesion: 0.14
Nodes (5): InMemoryCheckoutOutboxRepository, InMemoryOrderRepository, InMemoryStockReservationRepository, makeOrderRepo(), makeRepos()

### Community 23 - "ProductResponseItem"
Cohesion: 0.23
Nodes (10): Task 2: CachedProductRepository, ProductResponseItem, PrismaProductRepository, inject, injectable, FindAllParams, FindAllResult, IProductRepository (+2 more)

### Community 24 - "Processo"
Cohesion: 0.25
Nodes (7): 1. Contexto, 2. Identificar candidatos a Value Object, 3. Definir invariantes da entity, 4. Validar nomenclatura, 5. Saída, Domain Modeler — CaseCellShop, Processo

### Community 25 - "dependencies"
Cohesion: 0.05
Nodes (38): dependencies, @bull-board/api, @bull-board/fastify, bullmq, fastify, @fastify/swagger, @fastify/swagger-ui, ioredis (+30 more)

### Community 26 - "Checklist"
Cohesion: 0.25
Nodes (7): Campos obrigatórios em logs de erro, Checklist, Formato de saída, Logger estruturado, Métricas, Observability Enforcer — CaseCellShop, Tracing

### Community 27 - "ERP System"
Cohesion: 0.29
Nodes (8): Test Strategy (Unit + Integration), TDD Agent, Catalog Module, ERP System, ERP Adapter Module, Product, Stock, Docker Compose Test Environment

### Community 28 - "process-checkout-job.ts"
Cohesion: 0.27
Nodes (4): PrismaCheckoutStockFlowWriter, ICheckoutStockFlowWriter, InMemoryCheckoutStockFlowWriter, ProcessCheckoutJobInput

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

### Community 36 - "server.ts"
Cohesion: 0.13
Nodes (14): @bull-board/api, @bull-board/fastify, bullmq, @fastify/swagger, @fastify/swagger-ui, prom-client, CheckoutJobPayload, redis (+6 more)

### Community 37 - "tracer.ts"
Cohesion: 0.23
Nodes (11): Task 9: Container wiring + startup, Task 1: Install packages + refactor tracer.ts + wire initTracer in main.ts, @opentelemetry/exporter-trace-otlp-http, @opentelemetry/resources, @opentelemetry/sdk-node, ref_opentelemetry_sdk_trace_node, @opentelemetry/semantic-conventions, buildApp() (+3 more)

### Community 38 - "DomainError"
Cohesion: 0.05
Nodes (27): `create-checkout.spec.ts`, Estratégia de Testes, Fora do escopo de unit tests, `get-order-status.spec.ts`, `process-checkout-job.spec.ts`, Product, ProductProps, makePrice() (+19 more)

### Community 39 - "Observabilidade — CaseCellShop"
Cohesion: 0.25
Nodes (7): Alertas exemplo (Grafana), Métricas disponíveis em /metrics, Observabilidade — CaseCellShop, Produção com Datadog, Runbook — Checkout travado, Spans instrumentados, Stack local

### Community 40 - "Observabilidade — Design Spec"
Cohesion: 0.10
Nodes (19): Alerta exemplo, Arquitetura, Cache, `cache.get`, Camadas de observabilidade, Checkout, `checkout.create`, `checkout.process.job` (+11 more)

### Community 41 - "IOutboxRepository"
Cohesion: 0.21
Nodes (3): BullMQRelay, BullMQSyncWorker, IOutboxRepository

### Community 42 - "product-cache-service.ts"
Cohesion: 0.15
Nodes (3): ioredis, IL1Entry, jitteredTtlMs()

### Community 43 - "CacheRefreshScheduler"
Cohesion: 0.22
Nodes (5): CacheRefreshScheduler, registerCatalogModule(), ProductController, inject, injectable

### Community 44 - "vitest"
Cohesion: 0.14
Nodes (8): ref_path, vitest, prisma, repo, ErpScheduler, MockedWorker, mockOn, mockTerminate

### Community 45 - "seed.mjs"
Cohesion: 0.31
Nodes (8): BRANDS, buildSKU(), COLORS, main(), MATERIALS, prisma, randomPrice(), slugify()

### Community 46 - "Global Constraints"
Cohesion: 0.20
Nodes (10): Cache hit rate abaixo de 70% por 5 minutos, Checkout failures acima de 10% por 10 minutos, Global Constraints, Observabilidade — Implementation Plan, Task 3: Create metrics.ts (prom-client registry), Task 4: Instrument server.ts (span + ALS + /metrics route), Task 6: Instrument CreateCheckoutUseCase (checkout.create span + metric), Task 7: Instrument relay (metrics) + worker (checkout.process.job span + ALS + metrics) (+2 more)

### Community 47 - "IStockReservationRepository"
Cohesion: 0.24
Nodes (4): PrismaStockReservationRepository, IStockReservationRepository, inject, Reservation

### Community 48 - "checkout/container.ts"
Cohesion: 0.10
Nodes (20): Task 7: HTTP controllers, fastify, registerCheckoutModule(), CheckoutController, inject, injectable, OrderStatusController, OrderStatusParams (+12 more)

### Community 49 - "list-products.ts"
Cohesion: 0.18
Nodes (8): ListProductsInput, ListProductsOutput, ListProductsQuery, listProductsSchema, productSchema, ProductPresenter, PaginatedResult, PaginationMeta

### Community 50 - "context.ts"
Cohesion: 0.24
Nodes (9): Task 2: Create context.ts (AsyncLocalStorage) + refactor logger.ts, Arquivos, Criados, Modificados, ref_node_async_hooks, als, getContext(), ObsContext (+1 more)

### Community 51 - "@opentelemetry/api"
Cohesion: 0.50
Nodes (3): @opentelemetry/api, fastify, FastifyRequest

### Community 52 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, prisma, tsc-alias, tsx, @types/node, @types/uuid, typescript (+4 more)

### Community 53 - "in-memory-checkout-outbox-repository.ts"
Cohesion: 0.23
Nodes (4): ref_node_crypto, PrismaCheckoutOutboxRepository, CheckoutOutboxEntry, StoredEntry

### Community 54 - "IOrderRepository"
Cohesion: 0.19
Nodes (11): Checkout Assíncrono — Implementation Plan, File Map, Global Constraints, Task 1: Prisma schema + migration, Task 6: Prisma repository implementations, PrismaOrderRepository, CheckoutJobPayload, CreateOrderData (+3 more)

### Community 55 - "05 — Checkout Assíncrono"
Cohesion: 0.29
Nodes (7): 05 — Checkout Assíncrono, Contexto, Critérios de Direcionamento, Objetivo, Prompt, Resultado, Revisões

### Community 56 - "ICheckoutOutboxRepository"
Cohesion: 0.12
Nodes (9): Task 5: ProcessCheckoutJob use case, Task 8: Queue infrastructure, BullMQCheckoutRelay, BullMQCheckoutWorker, delay(), ICheckoutOutboxRepository, ProcessCheckoutJobUseCase, inject (+1 more)

### Community 58 - "06 — Observabilidade"
Cohesion: 0.29
Nodes (7): 06 — Observabilidade, Contexto, Critérios de Direcionamento, Objetivo, Prompt, Resultado, Revisões

## Knowledge Gaps
- **252 isolated node(s):** `Pré-requisitos`, `Passo 1 — Clonar e configurar`, `Passo 2 — Subir os containers`, `Passo 3 — Aplicar migrations`, `Passo 4 — Popular dados iniciais` (+247 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 378 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getLogger()` connect `ProductCacheService` to `server.ts`, `reflect-metadata`, `Observabilidade — Design Spec`, `product-cache-service.ts`, `Global Constraints`, `context.ts`, `IOrderRepository`, `ICheckoutOutboxRepository`, `06 — Observabilidade`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `reflect-metadata` connect `reflect-metadata` to `erp-adapter/container.ts`, `process-sync-job.ts`, `ErpStockFlow`, `package.json`, `DomainError`, `poll-erp-products.ts`, `product-cache-service.ts`, `create-checkout.ts`, `vitest`, `ErpProduct`, `checkout/container.ts`, `InMemoryCheckoutOutboxRepository`, `ProductResponseItem`, `process-checkout-job.ts`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `vitest` connect `vitest` to `process-sync-job.ts`, `ErpStockFlow`, `server.ts`, `package.json`, `DomainError`, `product-cache-service.ts`, `create-checkout.ts`, `ErpProduct`, `InMemoryCheckoutOutboxRepository`, `ProductResponseItem`, `process-checkout-job.ts`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `ProductCacheService` (e.g. with `Cache da Vitrine — Implementation Plan` and `Global Constraints`) actually correct?**
  _`ProductCacheService` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `OrderStatus` (e.g. with `Task 2: Domain errors + interfaces + DTOs` and `Task 3: CreateCheckout use case`) actually correct?**
  _`OrderStatus` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `IOrderRepository` (e.g. with `Global Constraints` and `Task 2: Domain errors + interfaces + DTOs`) actually correct?**
  _`IOrderRepository` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Pré-requisitos`, `Passo 1 — Clonar e configurar`, `Passo 2 — Subir os containers` to the rest of the system?**
  _252 weakly-connected nodes found - possible documentation gaps or missing edges._