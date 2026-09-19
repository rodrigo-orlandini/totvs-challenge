# 01 — Vitrine Inicial (GET /products)

## Objetivo

Implementar o endpoint `GET /products` com paginação, sem cache e sem integração ao ERP, como primeira iteração da vitrine de produtos. Criar seed com ~100 produtos. Aplicar TDD com SDD (Subagent-Driven Development).

## Contexto

Primeira feature de desenvolvimento do projeto CaseCellShop. Ponto de entrada para o módulo `catalog`. A lógica de cache (Redis + TTL + stampede prevention) e a integração real com o ERP adapter são diferidas para iterações seguintes.

## Prompt

> Vamos começar o desenvolvimento das features do projeto. Veja as documentações conforme necessário. Anote este prompt na pasta com o nome "01-vitrine-inicial.md". Começe a anotar apenas daqui pra frente. Vamos começar a implementação da vitrine de produtos, inicialmente de uma forma simples, sem tratar cache ou qualquer outra fonte de complexidade. Pense apenas como um endpoint simples de leitura de uma base. O endpoint deve ser GET /products e deve retornar a lista de produtos da base de dados com a possibilidade de paginação. Crie um script .mjs ou .sql para realizar um seed inicial na base de produtos, considerando cerca de 100 produtos diferentes. Aplique o processo de TDD @.claude\agents\tdd-agent.md no desenvolvimento, e antes de iniciar a implementação, tire todas as dúvidas que tiver, criando uma estrutura sólida de desenvolvimento com SDD (use superpowers)

## Critérios de Direcionamento

- "Simples" significa sem cache, sem ERP adapter — leitura direta do PostgreSQL via Prisma
- TDD obrigatório: red → green → refactor por comportamento
- SDD: plan escrito, tarefas independentes, revisão por subagente após cada uma
- Arquitetura Clean Architecture completa: entity, VO, use-case, repository interface, Prisma impl, controller, presenter, DI container
- Observabilidade: correlationId + pino logger + span incluídos mesmo nessa iteração simples (requisito do projeto)
- Paginação offset-based (page + limit) com meta envelope

## Resultado

_A preencher após implementação_

## Revisões

_A preencher se houver iterações_
