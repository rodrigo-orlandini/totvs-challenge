# Graph Report - totvs  (2026-09-20)

## Corpus Check
- 107 files · ~40,848 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 34 file(s) not represented in the graph (top: (none) 32, .example 1, .prisma 1)

## Summary
- 514 nodes · 1082 edges · 27 communities (19 shown, 8 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e59fb671`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- erp-adapter/container.ts
- scripts
- inject
- injectable
- IOutboxRepository
- package.json
- vitest
- ERP Sync Design Spec
- compilerOptions
- prisma-product-repository.integration-spec.ts
- catalog/container.ts
- seed.mjs
- @prisma/client
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
- 04 — Cache da Vitrine
- poll-erp-products.ts
- ProductCacheService
- main.ts

## God Nodes (most connected - your core abstractions)
1. `ProductCacheService` - 23 edges
2. `IOutboxRepository` - 21 edges
3. `vitest` - 19 edges
4. `tsyringe` - 18 edges
5. `scripts` - 18 edges
6. `@prisma/client` - 17 edges
7. `ErpProduct` - 16 edges
8. `DomainError` - 16 edges
9. `reflect-metadata` - 16 edges
10. `ErpStockFlow` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Invalidação / atualização por sync — `ProcessSyncJobUseCase`` --references--> `ProcessSyncJobUseCase`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.ts
- `Camadas de cache` --references--> `ProductResponseItem`  [INFERRED]
  docs/superpowers/specs/2026-09-20-cache-vitrine-design.md → src/modules/catalog/dtos/list-products-dto.ts
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

## Communities (27 total, 8 thin omitted)

### Community 0 - "erp-adapter/container.ts"
Cohesion: 0.08
Nodes (20): reflect-metadata, tsyringe, registerErpAdapterModule(), SyncEntity, SyncJobPayload, PrismaCatalogProductWriteRepository, inject, injectable (+12 more)

### Community 1 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:generate, db:migrate, db:migrate:erp, db:migrate:test, db:seed, db:seed:erp (+10 more)

### Community 4 - "IOutboxRepository"
Cohesion: 0.08
Nodes (18): ErpStockFlow, OutboxEntry, OutboxStatus, PrismaErpStockFlowRepository, inject, injectable, PrismaOutboxRepository, inject (+10 more)

### Community 5 - "package.json"
Cohesion: 0.04
Nodes (46): dependencies, @bull-board/api, @bull-board/fastify, bullmq, fastify, @fastify/swagger, @fastify/swagger-ui, ioredis (+38 more)

### Community 6 - "vitest"
Cohesion: 0.07
Nodes (20): ref_path, vitest, Product, ProductProps, makePrice(), makeSKU(), InvalidPriceError, ProductPrice (+12 more)

### Community 7 - "ERP Sync Design Spec"
Cohesion: 0.12
Nodes (24): Clean Architecture Dependency Rule, Dependency Injection via tsyringe, Either<DomainError, T> Pattern, Kebab-case Naming Convention, Test Strategy (Unit + Integration), Arch Reviewer Agent, TDD Agent, Catalog Module (+16 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, lib, module, outDir (+11 more)

### Community 9 - "prisma-product-repository.integration-spec.ts"
Cohesion: 0.20
Nodes (5): inject, injectable, prisma, repo, PrismaProductRepository

### Community 10 - "catalog/container.ts"
Cohesion: 0.07
Nodes (25): fastify, fastify, FastifyRequest, IL1Entry, jitteredTtlSec(), ListProductsInput, ListProductsOutput, ProductResponseItem (+17 more)

### Community 11 - "seed.mjs"
Cohesion: 0.27
Nodes (9): BRANDS, buildSKU(), COLORS, main(), MATERIALS, prisma, randomPrice(), slugify() (+1 more)

### Community 12 - "@prisma/client"
Cohesion: 0.10
Nodes (16): ref_node_path, ref_node_worker_threads, pino, @prisma/client, PrismaSyncCursorRepository, inject, injectable, ErpScheduler (+8 more)

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

### Community 23 - "04 — Cache da Vitrine"
Cohesion: 0.09
Nodes (18): Arquitetura, Cache da Vitrine — Design Spec, Camadas de cache, Constraints, Contexto, Estrutura de arquivos, Fluxo de leitura — `CachedProductRepository.findAll({ page, limit })`, Invalidação / atualização por sync — `ProcessSyncJobUseCase` (+10 more)

### Community 24 - "poll-erp-products.ts"
Cohesion: 0.10
Nodes (16): ErpProduct, PrismaErpProductRepository, inject, injectable, prisma, product, repo, IErpProductRepository (+8 more)

### Community 25 - "ProductCacheService"
Cohesion: 0.15
Nodes (4): CacheRefreshScheduler, jitteredTtlMs(), ProductCacheService, CachedProductRepository

### Community 28 - "main.ts"
Cohesion: 0.12
Nodes (15): @bull-board/api, @bull-board/fastify, bullmq, ioredis, buildApp(), bootstrap(), registerCatalogModule(), ProductController (+7 more)

## Knowledge Gaps
- **138 isolated node(s):** `IL1Entry`, `ProcessSyncJobInput`, `PaginationMeta`, `WorkerEntity`, `ListProductsQuery` (+133 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 221 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `erp-adapter/container.ts`, `IOutboxRepository`, `package.json`, `prisma-product-repository.integration-spec.ts`, `catalog/container.ts`, `@prisma/client`, `poll-erp-products.ts`, `main.ts`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `reflect-metadata` connect `erp-adapter/container.ts` to `IOutboxRepository`, `package.json`, `catalog/container.ts`, `@prisma/client`, `poll-erp-products.ts`, `main.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `tsyringe` connect `erp-adapter/container.ts` to `IOutboxRepository`, `package.json`, `catalog/container.ts`, `@prisma/client`, `poll-erp-products.ts`, `main.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `IL1Entry`, `ProcessSyncJobInput`, `PaginationMeta` to the rest of the system?**
  _138 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `erp-adapter/container.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `IOutboxRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.07686274509803921 - nodes in this community are weakly interconnected._