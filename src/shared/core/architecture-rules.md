# Regras de Arquitetura — CaseCellShop

Checklist de revisão referenciado por `arch-reviewer` e `observability-enforcer`.

## Dependências entre camadas

- `entities/` não importa nada de fora do próprio arquivo de domínio
- `use-cases/` importa apenas `entities/` e interfaces de `repositories/`
- `infra/` implementa interfaces — nunca é importada por use-cases ou entities
- Módulos não importam entities ou use-cases uns dos outros diretamente
- Cross-module: apenas via interface explícita em `repositories/` ou `shared/`

## Tratamento de erros

- Todo use-case retorna `Either<DomainError, T>`
- Controllers só fazem match no Either e delegam ao presenter (right) ou ao http-error-mapper (left)
- Nenhuma exceção não tratada chega ao cliente
- `DomainError` carrega `code` semântico (ex: `OUT_OF_STOCK`, `ORDER_NOT_FOUND`)

## Nomenclatura

- Todo arquivo e pasta em kebab-case, sem exceção
- Classes em PascalCase, variáveis e funções em camelCase
- Interfaces prefixadas com `I` (ex: `IProductRepository`)

## Injeção de dependência

- Nenhum `new` em services, use-cases ou repositories fora de `container.ts`
- Toda dependência injetada via tsyringe (`@injectable`, `@inject`)
- Fakes in-memory em testes unitários implementam a interface — nunca `vi.mock()` de implementação

## Testes

- Toda use-case tem `.spec.ts` co-locado
- Unit tests: sem I/O real (sem Prisma, sem Redis, sem HTTP)
- Integration tests: sufixo `.integration-spec.ts`, usam DB e Redis reais via Docker
- Proibido: teste tautológico (assertion recomputa o valor igual ao código)
- Proibido: mock de internal (mockar método privado ou implementação de infra em unit test)

## Observabilidade

- `correlationId` propagado no logger em todo request
- `orderId` presente nos logs onde existe pedido
- Cache hit/miss instrumentado no módulo `catalog`
- Span criado para `GET /products` e `POST /checkout`
- Proibido: `console.log` — apenas logger estruturado (pino)
