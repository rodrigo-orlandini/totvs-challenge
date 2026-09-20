# Graph Report - totvs  (2026-09-20)

## Corpus Check
- Corpus is ~27,208 words - fits in a single context window. You may not need a graph.

## Summary
- 426 nodes · 907 edges · 19 communities (15 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Server Bootstrap & Infra
- Catalog Module (Products)
- ERP Adapter Entities & Outbox
- DI Container & Catalog DTOs
- ERP Product Repository
- Package & Dev Dependencies
- BullMQ Queue & Relay
- Architecture Rules
- TypeScript Config
- Build Scripts
- Runtime Dependencies
- DB Seed
- Sync Cursor Repository
- Build Config
- Checkout Domain
- Observability Rules
- Docker Dev Environment
- Vitrine Plan
- Vitrine Prompt

## God Nodes (most connected - your core abstractions)
1. `IOutboxRepository` - 22 edges
2. `scripts` - 18 edges
3. `tsyringe` - 18 edges
4. `DomainError` - 17 edges
5. `ErpProduct` - 16 edges
6. `@prisma/client` - 15 edges
7. `vitest` - 15 edges
8. `registerErpAdapterModule()` - 15 edges
9. `ErpStockFlow` - 15 edges
10. `PrismaOutboxRepository` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Modular Monolith Clean Architecture Design` --references--> `Either<DomainError, T> Pattern`  [INFERRED]
  docs/superpowers/specs/2026-09-19-modular-monolith-clean-architecture-design.md → src/shared/core/architecture-rules.md
- `Modular Monolith Clean Architecture Design` --references--> `Clean Architecture Dependency Rule`  [INFERRED]
  docs/superpowers/specs/2026-09-19-modular-monolith-clean-architecture-design.md → src/shared/core/architecture-rules.md
- `Arch Reviewer Agent` --references--> `Dependency Injection via tsyringe`  [EXTRACTED]
  .claude/agents/arch-reviewer.md → src/shared/core/architecture-rules.md
- `Arch Reviewer Agent` --references--> `Kebab-case Naming Convention`  [EXTRACTED]
  .claude/agents/arch-reviewer.md → src/shared/core/architecture-rules.md
- `Docker Compose Test Environment` --conceptually_related_to--> `Test Strategy (Unit + Integration)`  [INFERRED]
  docker-compose.test.yml → src/shared/core/architecture-rules.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **ERP Sync Data Flow** — erp_sync_worker_threads, erp_sync_transactional_outbox, erp_sync_bullmq, erp_sync_dlq [EXTRACTED 1.00]
- **Clean Architecture Enforcement** — claude_agents_arch_reviewer, arch_rules_dependency_rule, arch_rules_either_pattern, arch_rules_di_pattern [EXTRACTED 1.00]
- **Development Workflow Toolset** — claude_agents_arch_reviewer, claude_agents_tdd_agent, prompts_00_arch [INFERRED 0.95]

## Communities (19 total, 4 thin omitted)

### Community 0 - "Server Bootstrap & Infra"
Cohesion: 0.07
Nodes (25): ref_node_path, ref_node_worker_threads, buildApp(), bootstrap(), registerErpAdapterModule(), PrismaCatalogProductWriteRepository, inject, injectable (+17 more)

### Community 1 - "Catalog Module (Products)"
Cohesion: 0.08
Nodes (18): ref_path, vitest, Product, ProductProps, makePrice(), makeSKU(), InvalidPriceError, ProductPrice (+10 more)

### Community 2 - "ERP Adapter Entities & Outbox"
Cohesion: 0.08
Nodes (17): @prisma/client, ErpStockFlow, OutboxEntry, OutboxStatus, PrismaErpStockFlowRepository, inject, injectable, IErpStockFlowRepository (+9 more)

### Community 3 - "DI Container & Catalog DTOs"
Cohesion: 0.09
Nodes (26): tsyringe, registerCatalogModule(), ListProductsInput, ListProductsOutput, ProductResponseItem, ListProductsQuery, listProductsSchema, ProductController (+18 more)

### Community 4 - "ERP Product Repository"
Cohesion: 0.08
Nodes (19): reflect-metadata, ErpProduct, PrismaErpProductRepository, inject, injectable, prisma, product, repo (+11 more)

### Community 5 - "Package & Dev Dependencies"
Cohesion: 0.05
Nodes (37): description, devDependencies, eslint, prisma, tsc-alias, tsx, @types/node, @types/uuid (+29 more)

### Community 6 - "BullMQ Queue & Relay"
Cohesion: 0.09
Nodes (18): bullmq, ioredis, pino, SyncEntity, SyncJobPayload, SyncProcessingError, BullMQRelay, redis (+10 more)

### Community 7 - "Architecture Rules"
Cohesion: 0.12
Nodes (24): Clean Architecture Dependency Rule, Dependency Injection via tsyringe, Either<DomainError, T> Pattern, Kebab-case Naming Convention, Test Strategy (Unit + Integration), Arch Reviewer Agent, TDD Agent, Catalog Module (+16 more)

### Community 8 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, lib, module, outDir (+11 more)

### Community 9 - "Build Scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:generate, db:migrate, db:migrate:erp, db:migrate:test, db:seed, db:seed:erp (+10 more)

### Community 10 - "Runtime Dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @bull-board/api, @bull-board/fastify, bullmq, fastify, @fastify/swagger, @fastify/swagger-ui, ioredis (+6 more)

### Community 11 - "DB Seed"
Cohesion: 0.27
Nodes (9): BRANDS, buildSKU(), COLORS, main(), MATERIALS, prisma, randomPrice(), slugify() (+1 more)

### Community 12 - "Sync Cursor Repository"
Cohesion: 0.33
Nodes (3): PrismaSyncCursorRepository, inject, injectable

### Community 13 - "Build Config"
Cohesion: 0.50
Nodes (3): ./tsconfig.json, exclude, extends

### Community 14 - "Checkout Domain"
Cohesion: 0.67
Nodes (3): Checkout Module, Order, OrderStatus

## Knowledge Gaps
- **114 isolated node(s):** `name`, `version`, `description`, `main`, `dev` (+109 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 181 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Catalog Module (Products)` to `Server Bootstrap & Infra`, `ERP Adapter Entities & Outbox`, `DI Container & Catalog DTOs`, `ERP Product Repository`, `Package & Dev Dependencies`, `BullMQ Queue & Relay`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `tsyringe` connect `DI Container & Catalog DTOs` to `Server Bootstrap & Infra`, `ERP Adapter Entities & Outbox`, `ERP Product Repository`, `Package & Dev Dependencies`, `BullMQ Queue & Relay`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `scripts` connect `Build Scripts` to `Package & Dev Dependencies`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _114 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Server Bootstrap & Infra` be split into smaller, more focused modules?**
  _Cohesion score 0.07372549019607844 - nodes in this community are weakly interconnected._
- **Should `Catalog Module (Products)` be split into smaller, more focused modules?**
  _Cohesion score 0.07529411764705882 - nodes in this community are weakly interconnected._
- **Should `ERP Adapter Entities & Outbox` be split into smaller, more focused modules?**
  _Cohesion score 0.08313725490196078 - nodes in this community are weakly interconnected._