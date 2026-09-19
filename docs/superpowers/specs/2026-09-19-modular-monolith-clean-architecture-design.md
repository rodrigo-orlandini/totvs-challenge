# Design: Monolito Modular com Clean Architecture — CaseCellShop

**Data:** 2026-09-19
**Escopo:** Estrutura arquitetural, convenções, ambientes e fluxo de desenvolvimento

---

## 1. Contexto e Objetivo

Backend de e-commerce para vitrine virtual e checkout assíncrono integrado a ERP externo. Construído como monolito modular — repositório único — estruturado para que cada módulo possa ser extraído como microsserviço sem retrabalho.

Requisitos centrais: cache com TTL e invalidação, observabilidade completa, controle de concorrência e overselling, idempotência no checkout, resiliência assíncrona com retry e DLQ.

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 22 |
| Linguagem | TypeScript (strict) |
| HTTP | Fastify |
| DI / IoC | tsyringe + reflect-metadata |
| ORM | Prisma |
| Banco | PostgreSQL 16 |
| Cache | Redis 7 |
| Testes | Vitest |
| Containers | Docker + Docker Compose |

Nomenclatura de arquivos e pastas: kebab-case em todo o projeto, sem exceção.

---

## 3. Módulos de Domínio

Três bounded contexts do sistema:

| Módulo | Responsabilidade |
|---|---|
| `catalog` | Vitrine de produtos, cache Redis, consulta ao ERP |
| `checkout` | Pedidos, idempotência, processamento assíncrono, worker ERP |
| `erp-adapter` | Adaptador fictício do ERP externo (retry, timeout, fallback) |

---

## 4. Estrutura de Camadas por Módulo

```
src/modules/<módulo>/
├── entities/
│   ├── <entity>.ts
│   └── value-objects/
│       └── <value-object>.ts
├── use-cases/
│   └── <use-case>/
│       ├── <use-case>.ts
│       └── <use-case>.spec.ts          # unit test co-locado
├── repositories/
│   └── <repository>.ts                 # interface (port)
├── infra/
│   ├── http/
│   │   └── <controller>.ts
│   ├── persistence/
│   │   └── prisma-<repository>.ts      # implementação Prisma
│   └── cache/                          # apenas catalog
│       └── redis-<cache>.ts
├── mappers/
│   └── <entity>-mapper.ts
├── presenters/
│   └── <entity>-presenter.ts
├── dtos/
│   └── <use-case>-dto.ts
└── container.ts                        # bindings tsyringe do módulo
```

**Regra de dependência (inviolável):**
- `entities/` não importa nada de fora do próprio arquivo de domínio
- `use-cases/` importa apenas `entities/` e interfaces de `repositories/`
- `infra/` implementa interfaces — nunca é importada por use-cases ou entities
- Módulos não importam entities ou use-cases uns dos outros diretamente

---

## 5. Infraestrutura Compartilhada

```
src/shared/
├── core/
│   ├── either.ts          # Either<L,R>, left(), right(), Success<T>, Failure<E>
│   └── use-case.ts        # interface IUseCase<Input, Output>
├── errors/
│   ├── domain-error.ts    # classe base abstrata
│   └── http-error-mapper.ts  # DomainError → HTTP status + body
├── observability/
│   ├── logger.ts          # logger estruturado (pino)
│   ├── metrics.ts         # counters, gauges, histograms
│   └── tracer.ts          # trace/span (OpenTelemetry stub)
├── database/
│   └── prisma-client.ts   # singleton PrismaClient
└── types/
    └── pagination.ts      # tipos cross-módulo
```

---

## 6. Padrão Either para Tratamento de Erros

Use-cases retornam `Either<DomainError, OutputDTO>`.

```
entities / use-cases  →  Either<DomainError, T>
      ↓
controllers           →  match(either):
                           right → presenter → 2xx
                           left  → http-error-mapper → 4xx/5xx
```

Nenhuma exceção não tratada chega ao cliente. `DomainError` carrega código semântico (`OUT_OF_STOCK`, `ORDER_NOT_FOUND`, etc.) que o mapper converte em status HTTP correto.

---

## 7. Value Objects

Extraídos de campos com validação ou comportamento próprio. Definidos em `entities/value-objects/` do módulo correspondente. Exemplos a confirmar na modelagem de domínio:

- `product-price.ts` — valor monetário, sem negativo
- `sku.ts` — identificador de produto, formato validado
- `order-status.ts` — enum com transições válidas
- `quantity.ts` — inteiro positivo, sem zero

Novos VOs são adicionados conforme o domínio é modelado com a skill `domain-modeler`.

---

## 8. Ambientes Docker

### Desenvolvimento

```yaml
# docker-compose.yml
services:
  app:
    container_name: casecellshop-app
    build: { context: ., target: dev }
    volumes: ["./src:/app/src"]         # hot reload via tsx watch
    depends_on: [postgres, redis]

  postgres:
    container_name: casecellshop-postgres
    image: postgres:16-alpine
    environment: { POSTGRES_DB: casecellshop_dev }

  redis:
    container_name: casecellshop-redis
    image: redis:7-alpine
```

### Testes de Integração

```yaml
# docker-compose.test.yml
services:
  postgres-test:
    container_name: casecellshop-postgres-test
    image: postgres:16-alpine
    environment: { POSTGRES_DB: casecellshop_test }
    ports: ["5433:5432"]

  redis-test:
    container_name: casecellshop-redis-test
    image: redis:7-alpine
    ports: ["6380:6379"]
```

### Dockerfile Multistage

```dockerfile
FROM node:22-alpine AS base
FROM base AS dev      # tsx watch, source maps
FROM base AS build    # tsc compile
FROM base AS prod     # apenas dist/, sem devDependencies
```

---

## 9. Estratégia de Testes

### Unit (`vitest.config.ts`)
- Entities, value-objects, use-cases, mappers, presenters, `either.ts`
- Repositories injetados como **fakes in-memory** (implementam a interface — não mocks de implementação)
- `.spec.ts` co-locado com o arquivo testado
- Sem I/O real — rápidos, rodam em CI sem serviços externos

### Integration (`vitest.integration.ts`)
- Implementações Prisma dos repositories contra `casecellshop-postgres-test`
- Implementações Redis do cache contra `casecellshop-redis-test`
- Rotas HTTP via `app.inject()` do Fastify (sem porta real)
- Arquivo: `<módulo>/infra/<camada>/<arquivo>.integration-spec.ts`
- Isolamento: `TRUNCATE TABLE ... CASCADE` no `beforeEach`

### Thresholds de Coverage por Camada
| Camada | Mínimo |
|---|---|
| use-cases | 90% |
| entities + value-objects | 85% |
| infra (integration) | 70% |

### Loop TDD
```
1. .spec.ts com comportamento esperado (red)
2. interface de repository se necessária
3. implementação mínima até verde (green)
4. refatoração — sem nova funcionalidade
```

---

## 10. Fluxo de Desenvolvimento por Sessão

### Skills e Agentes

| Fase | Ferramenta |
|---|---|
| Início de sessão | `session-start` skill |
| Nova feature complexa / decisão arquitetural | `brainstorming` skill |
| Modelagem de entity, VO ou use-case | `domain-modeler` skill |
| Implementação | `tdd-agent` |
| Checagem de observabilidade | `observability-enforcer` skill |
| Revisão de diff | `arch-reviewer` agente |
| Antes de fechar tarefa | `verification-before-completion` skill |

### Loop Completo por Feature

```
session-start
  ↓ feature declarada
domain-modeler         → entity/VO modelados, CONTEXT.md atualizado
  ↓
tdd-agent              → red → green → refactor por use-case
  ↓
observability-enforcer → correlationId, métricas, spans presentes
  ↓
arch-reviewer          → regra de dependência, Either, kebab-case, DI ok
  ↓
verification-before-completion → tudo checado
  ↓
commit
```

---

## 11. Definição dos Agentes e Skills a Criar

### `arch-reviewer` (agente)
Analisa diff ou módulo. Reporta no formato `arquivo:linha severity: problema. fix.`:
- Import proibido entre camadas
- Cross-module import direto sem interface
- Use-case sem retorno `Either`
- `new` em service contornando DI
- Arquivo/pasta fora de kebab-case
- Lógica de negócio em controller

### `tdd-agent` (agente)
Conduz loop red→green→refactor:
- Exige `.spec.ts` antes de aceitar implementação
- Roda `vitest run` e bloqueia em red
- Verifica coverage por camada contra thresholds definidos
- Detecta teste tautológico e mock de internal (ambos proibidos)

### `domain-modeler` (skill)
Antes de escrever entity ou VO:
- Extrai candidatos a VO dos campos com validação própria
- Valida nomenclatura contra `CONTEXT.md`
- Propõe invariantes e em qual camada residem

### `observability-enforcer` (skill)
Checklist antes de fechar use-case ou controller:
- `correlationId` propagado no logger em todo request
- `orderId` presente nos logs onde existe pedido
- Cache hit/miss instrumentado no módulo `catalog`
- Span criado para `GET /products` e `POST /checkout`
- Sem `console.log` — apenas logger estruturado (pino)

### `session-start` (skill)
Início de sessão:
- Carrega `CONTEXT.md` e `architecture-rules.md`
- Mostra estado atual do projeto
- Direciona para skill/agente correto conforme tipo de tarefa

---

## 12. Arquivos de Convenção a Criar

`CONTEXT.md` (raiz) — glossário de domínio vivo, atualizado conforme modelagem avança.

`src/shared/core/architecture-rules.md` — checklist de revisão referenciado por todos os agentes:
- Entities não importam de `infra/` nem de outros módulos
- Use-cases retornam `Either<DomainError, T>`
- Controllers só fazem match no Either e delegam ao presenter
- Todo arquivo e pasta em kebab-case
- Fakes in-memory para unit tests — nunca mocks de implementação
- Toda use-case tem `.spec.ts` co-locado

---

## 13. Scripts `package.json`

```json
{
  "dev": "docker compose up",
  "test:unit": "vitest run",
  "test:integration": "docker compose -f docker-compose.test.yml up -d && vitest run --config vitest.integration.ts",
  "test:all": "npm run test:unit && npm run test:integration",
  "lint": "eslint src --ext .ts",
  "typecheck": "tsc --noEmit"
}
```
