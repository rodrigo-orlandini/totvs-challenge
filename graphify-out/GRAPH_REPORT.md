# Graph Report - totvs  (2026-09-20)

## Corpus Check
- 107 files · ~41,144 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 34 file(s) not represented in the graph (top: (none) 32, .example 1, .prisma 1)

## Summary
- 524 nodes · 1132 edges · 32 communities (21 shown, 11 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 86 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `96567e1e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- erp-adapter/container.ts
- scripts
- inject
- injectable
- IOutboxRepository
- package.json
- process-sync-job.ts
- ERP Sync Design Spec
- compilerOptions
- dependencies
- vitest
- seed.mjs
- product-cache-service.ts
- tsconfig.build.json
- Order
- Observability Rules (correlationId, spans)
- Docker Compose Dev Environment
- Vitrine Inicial Implementation Plan
- Prompt 01: Vitrine Inicial
- 03 — Git Workflow e CI Pipeline
- CLAUDE.md
- inject
- injectable
- ListProductsUseCase
- devDependencies
- ProductCacheService
- prisma
- ErpStockFlow
- product-controller.ts
- server.ts
- inject
- injectable

## God Nodes (most connected - your core abstractions)
1. `ProductCacheService` - 30 edges
2. `IOutboxRepository` - 22 edges
3. `vitest` - 19 edges
4. `scripts` - 18 edges
5. `tsyringe` - 18 edges
6. `@prisma/client` - 17 edges
7. `ErpProduct` - 16 edges
8. `DomainError` - 16 edges
9. `reflect-metadata` - 16 edges
10. `CacheRefreshScheduler` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Camadas de cache` --references--> `ProductResponseItem`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/catalog/dtos/list-products-dto.ts
- `Invalidação / atualização por sync — `ProcessSyncJobUseCase`` --references--> `ProcessSyncJobUseCase`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.ts
- `Cache da Vitrine — Implementation Plan` --references--> `IProductRepository`  [INFERRED]
  docs/superpowers/plans/2026-09-20-cache-vitrine.md → src/modules/catalog/repositories/product-repository.ts
- `Global Constraints` --references--> `ListProductsUseCase`  [INFERRED]
  docs/superpowers/plans/2026-09-20-cache-vitrine.md → src/modules/catalog/use-cases/list-products/list-products.ts
- `Constraints` --references--> `ListProductsUseCase`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/catalog/use-cases/list-products/list-products.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Clean Architecture Enforcement** — claude_agents_arch_reviewer, arch_rules_dependency_rule, arch_rules_either_pattern, arch_rules_di_pattern [EXTRACTED 1.00]
- **ERP Sync Data Flow** — erp_sync_worker_threads, erp_sync_transactional_outbox, erp_sync_bullmq, erp_sync_dlq [EXTRACTED 1.00]
- **Development Workflow Toolset** — claude_agents_arch_reviewer, claude_agents_tdd_agent, prompts_00_arch [INFERRED 0.95]

## Communities (32 total, 11 thin omitted)

### Community 0 - "erp-adapter/container.ts"
Cohesion: 0.07
Nodes (28): @prisma/client, tsyringe, buildApp(), bootstrap(), registerCatalogModule(), ProductController, registerErpAdapterModule(), PrismaCatalogProductWriteRepository (+20 more)

### Community 1 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:generate, db:migrate, db:migrate:erp, db:migrate:test, db:seed, db:seed:erp (+10 more)

### Community 4 - "IOutboxRepository"
Cohesion: 0.07
Nodes (17): ErpProduct, OutboxEntry, OutboxStatus, PrismaErpProductRepository, inject, injectable, prisma, product (+9 more)

### Community 5 - "package.json"
Cohesion: 0.11
Nodes (17): description, main, name, version, eslint, pino, prisma, tsc-alias (+9 more)

### Community 6 - "process-sync-job.ts"
Cohesion: 0.07
Nodes (27): ListProductsInput, Product, ProductProps, makePrice(), makeSKU(), InvalidPriceError, ProductPrice, InvalidSKUError (+19 more)

### Community 7 - "ERP Sync Design Spec"
Cohesion: 0.12
Nodes (24): Clean Architecture Dependency Rule, Dependency Injection via tsyringe, Either<DomainError, T> Pattern, Kebab-case Naming Convention, Test Strategy (Unit + Integration), Arch Reviewer Agent, TDD Agent, Catalog Module (+16 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, lib, module, outDir (+11 more)

### Community 9 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @bull-board/api, @bull-board/fastify, bullmq, fastify, @fastify/swagger, @fastify/swagger-ui, ioredis (+6 more)

### Community 10 - "vitest"
Cohesion: 0.10
Nodes (15): Task 2: CachedProductRepository, inject, injectable, ref_path, vitest, ProductResponseItem, prisma, repo (+7 more)

### Community 11 - "seed.mjs"
Cohesion: 0.27
Nodes (9): BRANDS, buildSKU(), COLORS, main(), MATERIALS, prisma, randomPrice(), slugify() (+1 more)

### Community 12 - "product-cache-service.ts"
Cohesion: 0.08
Nodes (19): bullmq, ioredis, ref_node_path, ref_node_worker_threads, reflect-metadata, IL1Entry, SyncEntity, SyncJobPayload (+11 more)

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

### Community 23 - "ListProductsUseCase"
Cohesion: 0.09
Nodes (21): Arquitetura, Cache da Vitrine — Design Spec, Camadas de cache, Constraints, Contexto, Estrutura de arquivos, Fluxo de leitura — `CachedProductRepository.findAll({ page, limit })`, Invalidação / atualização por sync — `ProcessSyncJobUseCase` (+13 more)

### Community 24 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, prisma, tsc-alias, tsx, @types/node, @types/uuid, typescript (+4 more)

### Community 25 - "ProductCacheService"
Cohesion: 0.10
Nodes (14): Cache da Vitrine — Implementation Plan, Global Constraints, Self-Review Checklist, Task 1: IProductCacheUpdater + ProductCacheService, Task 3: ProcessSyncJobUseCase cache integration, Task 4: CacheRefreshScheduler, Task 5: Container wiring + startup, CacheRefreshScheduler (+6 more)

### Community 27 - "ErpStockFlow"
Cohesion: 0.16
Nodes (9): ErpStockFlow, PrismaErpStockFlowRepository, inject, injectable, IErpStockFlowRepository, ISyncCursorRepository, InMemorySyncCursorRepository, InMemoryErpStockFlowRepository (+1 more)

### Community 28 - "product-controller.ts"
Cohesion: 0.21
Nodes (8): ListProductsOutput, ListProductsQuery, listProductsSchema, productSchema, ProductPresenter, HTTP_STATUS_MAP, HttpError, toHttpError()

### Community 29 - "server.ts"
Cohesion: 0.22
Nodes (7): @bull-board/api, @bull-board/fastify, fastify, @fastify/swagger, @fastify/swagger-ui, fastify, FastifyRequest

## Knowledge Gaps
- **137 isolated node(s):** `ListProductsQuery`, `productSchema`, `listProductsSchema`, `PaginationMeta`, `IL1Entry` (+132 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 221 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `erp-adapter/container.ts`, `IOutboxRepository`, `package.json`, `process-sync-job.ts`, `product-cache-service.ts`, `ErpStockFlow`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `reflect-metadata` connect `product-cache-service.ts` to `erp-adapter/container.ts`, `IOutboxRepository`, `package.json`, `process-sync-job.ts`, `vitest`, `ErpStockFlow`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `tsyringe` connect `erp-adapter/container.ts` to `IOutboxRepository`, `package.json`, `process-sync-job.ts`, `vitest`, `ErpStockFlow`, `product-controller.ts`, `server.ts`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ProductCacheService` (e.g. with `Cache da Vitrine — Implementation Plan` and `Global Constraints`) actually correct?**
  _`ProductCacheService` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ListProductsQuery`, `productSchema`, `listProductsSchema` to the rest of the system?**
  _137 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `erp-adapter/container.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07017543859649122 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._