# Graph Report - totvs  (2026-09-20)

## Corpus Check
- 107 files · ~40,634 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 34 file(s) not represented in the graph (top: (none) 32, .example 1, .prisma 1)

## Summary
- 514 nodes · 1077 edges · 28 communities (20 shown, 8 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9127b3c4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- erp-adapter/container.ts
- scripts
- inject
- injectable
- IOutboxRepository
- package.json
- DomainError
- ERP Sync Design Spec
- compilerOptions
- dependencies
- catalog/container.ts
- seed.mjs
- erp-scheduler.ts
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
- list-products.ts
- poll-erp-products.ts
- ProductCacheService
- 04 — Cache da Vitrine
- main.ts

## God Nodes (most connected - your core abstractions)
1. `ProductCacheService` - 22 edges
2. `IOutboxRepository` - 21 edges
3. `vitest` - 19 edges
4. `tsyringe` - 18 edges
5. `scripts` - 18 edges
6. `@prisma/client` - 17 edges
7. `ErpProduct` - 16 edges
8. `DomainError` - 16 edges
9. `reflect-metadata` - 16 edges
10. `registerErpAdapterModule()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Invalidação / atualização por sync — `ProcessSyncJobUseCase`` --references--> `ProcessSyncJobUseCase`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.ts
- `Camadas de cache` --references--> `ProductResponseItem`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/catalog/dtos/list-products-dto.ts
- `Contexto` --references--> `ListProductsUseCase`  [INFERRED]
  prompts/04-cache-vitrine.md → src/modules/catalog/use-cases/list-products/list-products.ts
- `Constraints` --references--> `ListProductsUseCase`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/catalog/use-cases/list-products/list-products.ts
- `Contexto` --references--> `ListProductsUseCase`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/catalog/use-cases/list-products/list-products.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Clean Architecture Enforcement** — claude_agents_arch_reviewer, arch_rules_dependency_rule, arch_rules_either_pattern, arch_rules_di_pattern [EXTRACTED 1.00]
- **ERP Sync Data Flow** — erp_sync_worker_threads, erp_sync_transactional_outbox, erp_sync_bullmq, erp_sync_dlq [EXTRACTED 1.00]
- **Development Workflow Toolset** — claude_agents_arch_reviewer, claude_agents_tdd_agent, prompts_00_arch [INFERRED 0.95]

## Communities (28 total, 8 thin omitted)

### Community 0 - "erp-adapter/container.ts"
Cohesion: 0.08
Nodes (19): inject, tsyringe, registerErpAdapterModule(), SyncEntity, SyncJobPayload, PrismaCatalogProductWriteRepository, inject, injectable (+11 more)

### Community 1 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:generate, db:migrate, db:migrate:erp, db:migrate:test, db:seed, db:seed:erp (+10 more)

### Community 4 - "IOutboxRepository"
Cohesion: 0.08
Nodes (19): reflect-metadata, ErpStockFlow, OutboxEntry, OutboxStatus, PrismaErpStockFlowRepository, inject, injectable, PrismaOutboxRepository (+11 more)

### Community 5 - "package.json"
Cohesion: 0.05
Nodes (36): description, devDependencies, eslint, prisma, tsc-alias, tsx, @types/node, @types/uuid (+28 more)

### Community 6 - "DomainError"
Cohesion: 0.08
Nodes (18): Product, ProductProps, makePrice(), makeSKU(), InvalidPriceError, ProductPrice, InvalidSKUError, SKU (+10 more)

### Community 7 - "ERP Sync Design Spec"
Cohesion: 0.12
Nodes (24): Clean Architecture Dependency Rule, Dependency Injection via tsyringe, Either<DomainError, T> Pattern, Kebab-case Naming Convention, Test Strategy (Unit + Integration), Arch Reviewer Agent, TDD Agent, Catalog Module (+16 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, lib, module, outDir (+11 more)

### Community 9 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @bull-board/api, @bull-board/fastify, bullmq, fastify, @fastify/swagger, @fastify/swagger-ui, ioredis (+6 more)

### Community 10 - "catalog/container.ts"
Cohesion: 0.08
Nodes (18): injectable, ref_path, @prisma/client, vitest, jitteredTtlSec(), L1Entry, ProductResponseItem, prisma (+10 more)

### Community 11 - "seed.mjs"
Cohesion: 0.27
Nodes (9): BRANDS, buildSKU(), COLORS, main(), MATERIALS, prisma, randomPrice(), slugify() (+1 more)

### Community 12 - "erp-scheduler.ts"
Cohesion: 0.19
Nodes (8): ref_node_path, ref_node_worker_threads, ErpScheduler, MockedWorker, mockOn, mockTerminate, WORKER_FILES, WorkerEntity

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

### Community 23 - "list-products.ts"
Cohesion: 0.07
Nodes (26): Arquitetura, Cache da Vitrine — Design Spec, Camadas de cache, Constraints, Contexto, Estrutura de arquivos, Fluxo de leitura — `CachedProductRepository.findAll({ page, limit })`, Invalidação / atualização por sync — `ProcessSyncJobUseCase` (+18 more)

### Community 24 - "poll-erp-products.ts"
Cohesion: 0.08
Nodes (19): ErpProduct, PrismaErpProductRepository, inject, injectable, prisma, product, repo, PrismaSyncCursorRepository (+11 more)

### Community 25 - "ProductCacheService"
Cohesion: 0.14
Nodes (4): CacheRefreshScheduler, jitteredTtlMs(), ProductCacheService, CachedProductRepository

### Community 26 - "04 — Cache da Vitrine"
Cohesion: 0.25
Nodes (7): 04 — Cache da Vitrine, Contexto, Critérios de Direcionamento, Objetivo, Prompt, Resultado, Revisões

### Community 28 - "main.ts"
Cohesion: 0.11
Nodes (15): @bull-board/api, @bull-board/fastify, bullmq, ioredis, buildApp(), bootstrap(), registerCatalogModule(), BullMQRelay (+7 more)

## Knowledge Gaps
- **138 isolated node(s):** `ProcessSyncJobInput`, `PaginationMeta`, `L1Entry`, `WorkerEntity`, `ListProductsQuery` (+133 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 222 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `catalog/container.ts` to `erp-adapter/container.ts`, `IOutboxRepository`, `package.json`, `DomainError`, `erp-scheduler.ts`, `poll-erp-products.ts`, `main.ts`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `reflect-metadata` connect `IOutboxRepository` to `erp-adapter/container.ts`, `package.json`, `catalog/container.ts`, `erp-scheduler.ts`, `poll-erp-products.ts`, `main.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `tsyringe` connect `erp-adapter/container.ts` to `IOutboxRepository`, `package.json`, `catalog/container.ts`, `list-products.ts`, `poll-erp-products.ts`, `main.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `ProcessSyncJobInput`, `PaginationMeta`, `L1Entry` to the rest of the system?**
  _138 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `erp-adapter/container.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07993197278911565 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `IOutboxRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.07764876632801161 - nodes in this community are weakly interconnected._