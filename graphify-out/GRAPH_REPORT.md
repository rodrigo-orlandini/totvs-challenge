# Graph Report - totvs  (2026-09-20)

## Corpus Check
- 96 files · ~28,133 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 34 file(s) not represented in the graph (top: (none) 32, .example 1, .prisma 1)

## Summary
- 438 nodes · 917 edges · 21 communities (17 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5d7ddb91`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- process-sync-job.spec.ts
- process-sync-job.ts
- IOutboxRepository
- list-products.ts
- ErpProduct
- package.json
- erp-adapter/container.ts
- ERP Sync Design Spec
- compilerOptions
- scripts
- dependencies
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

## God Nodes (most connected - your core abstractions)
1. `IOutboxRepository` - 22 edges
2. `tsyringe` - 18 edges
3. `scripts` - 18 edges
4. `DomainError` - 17 edges
5. `ErpProduct` - 16 edges
6. `ErpStockFlow` - 15 edges
7. `PrismaOutboxRepository` - 15 edges
8. `registerErpAdapterModule()` - 15 edges
9. `vitest` - 15 edges
10. `@prisma/client` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Arch Reviewer Agent` --references--> `Dependency Injection via tsyringe`  [EXTRACTED]
  .claude/agents/arch-reviewer.md → src/shared/core/architecture-rules.md
- `Arch Reviewer Agent` --references--> `Kebab-case Naming Convention`  [EXTRACTED]
  .claude/agents/arch-reviewer.md → src/shared/core/architecture-rules.md
- `Docker Compose Test Environment` --conceptually_related_to--> `Test Strategy (Unit + Integration)`  [INFERRED]
  docker-compose.test.yml → src/shared/core/architecture-rules.md
- `Modular Monolith Clean Architecture Design` --references--> `Clean Architecture Dependency Rule`  [INFERRED]
  docs/superpowers/specs/2026-09-19-modular-monolith-clean-architecture-design.md → src/shared/core/architecture-rules.md
- `Modular Monolith Clean Architecture Design` --references--> `Either<DomainError, T> Pattern`  [INFERRED]
  docs/superpowers/specs/2026-09-19-modular-monolith-clean-architecture-design.md → src/shared/core/architecture-rules.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Clean Architecture Enforcement** — claude_agents_arch_reviewer, arch_rules_dependency_rule, arch_rules_either_pattern, arch_rules_di_pattern [EXTRACTED 1.00]
- **ERP Sync Data Flow** — erp_sync_worker_threads, erp_sync_transactional_outbox, erp_sync_bullmq, erp_sync_dlq [EXTRACTED 1.00]
- **Development Workflow Toolset** — claude_agents_arch_reviewer, claude_agents_tdd_agent, prompts_00_arch [INFERRED 0.95]

## Communities (21 total, 4 thin omitted)

### Community 0 - "process-sync-job.spec.ts"
Cohesion: 0.11
Nodes (11): PrismaCatalogProductWriteRepository, inject, injectable, PrismaCatalogStockFlowWriteRepository, inject, injectable, ICatalogProductWriteRepository, ICatalogStockFlowWriteRepository (+3 more)

### Community 1 - "process-sync-job.ts"
Cohesion: 0.06
Nodes (31): ref_path, vitest, Product, ProductProps, makePrice(), makeSKU(), InvalidPriceError, ProductPrice (+23 more)

### Community 2 - "IOutboxRepository"
Cohesion: 0.05
Nodes (21): ErpStockFlow, OutboxEntry, OutboxStatus, PrismaErpStockFlowRepository, inject, injectable, PrismaOutboxRepository, inject (+13 more)

### Community 3 - "list-products.ts"
Cohesion: 0.09
Nodes (20): ListProductsInput, ListProductsOutput, ProductResponseItem, inject, prisma, repo, PrismaProductRepository, inject (+12 more)

### Community 4 - "ErpProduct"
Cohesion: 0.18
Nodes (9): ErpProduct, PrismaErpProductRepository, inject, injectable, prisma, product, repo, IErpProductRepository (+1 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (35): description, devDependencies, eslint, prisma, tsc-alias, tsx, @types/node, @types/uuid (+27 more)

### Community 6 - "erp-adapter/container.ts"
Cohesion: 0.10
Nodes (24): bullmq, fastify, ioredis, tsyringe, fastify, FastifyRequest, buildApp(), bootstrap() (+16 more)

### Community 7 - "ERP Sync Design Spec"
Cohesion: 0.12
Nodes (24): Clean Architecture Dependency Rule, Dependency Injection via tsyringe, Either<DomainError, T> Pattern, Kebab-case Naming Convention, Test Strategy (Unit + Integration), Arch Reviewer Agent, TDD Agent, Catalog Module (+16 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, lib, module, outDir (+11 more)

### Community 9 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:generate, db:migrate, db:migrate:erp, db:migrate:test, db:seed, db:seed:erp (+10 more)

### Community 10 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @bull-board/api, @bull-board/fastify, bullmq, fastify, @fastify/swagger, @fastify/swagger-ui, ioredis (+6 more)

### Community 11 - "seed.mjs"
Cohesion: 0.27
Nodes (9): BRANDS, buildSKU(), COLORS, main(), MATERIALS, prisma, randomPrice(), slugify() (+1 more)

### Community 12 - "@prisma/client"
Cohesion: 0.14
Nodes (12): ref_node_path, ref_node_worker_threads, @prisma/client, reflect-metadata, PrismaSyncCursorRepository, inject, injectable, WORKER_FILES (+4 more)

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

## Knowledge Gaps
- **123 isolated node(s):** `Command output`, `Prompts`, `Docker`, `Objetivo`, `Contexto` (+118 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 191 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `process-sync-job.ts` to `process-sync-job.spec.ts`, `IOutboxRepository`, `list-products.ts`, `ErpProduct`, `package.json`, `erp-adapter/container.ts`, `@prisma/client`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `tsyringe` connect `erp-adapter/container.ts` to `process-sync-job.spec.ts`, `process-sync-job.ts`, `IOutboxRepository`, `list-products.ts`, `ErpProduct`, `package.json`, `@prisma/client`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **What connects `Command output`, `Prompts`, `Docker` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `process-sync-job.spec.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10541310541310542 - nodes in this community are weakly interconnected._
- **Should `process-sync-job.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.059154929577464786 - nodes in this community are weakly interconnected._
- **Should `IOutboxRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.05487269534679543 - nodes in this community are weakly interconnected._