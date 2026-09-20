# 03 — Git Workflow e CI Pipeline

## Objetivo

Estabelecer disciplina de branching por tarefa com PR obrigatório e pipeline de CI no GitHub Actions com build check, testes unitários, testes de integração e cobertura mínima de 80%.

## Contexto

Codebase crescendo em volume de arquivos e linhas. Necessidade de rastreabilidade por tarefa e garantia automatizada de qualidade antes de merge.

## Prompt

> As alterações que estamos realizando no código estão aumentando em quantidade de linhas e arquivos, o que acaba se tornando mais difícil revisar sem um controle mais preciso com o Git. A partir de agora, ao começarmos uma tarefa (eu irei sinalizar), deve ser criada uma nova branch a partir de origin/main para trabalhá-la. Com a conclusão, deve ser criada um PR para análise. Além disso, para garantia de que os testes estejam passando e com uma cobertura relevante, vamos adicionar uma pipeline no Github actions para executá-los. Tenha um job inicial para conferir se o código está compilando (com tsc, ou uma build de teste), outro para testes unitários, e outro para testes de integração. Para medir o coverage, se for necessário, pode adicionar um novo job, mas como estimativa inicial vamos usar 80%. A sequencia de jobs deve ser: coverage só executa quando testes passarem, e testes só executam quando build inicial passar. Se houver dúvidas tire, e para refinamento vamos usar o superpowers

## Critérios de Direcionamento

**4 jobs em sequência:**
- `build` roda primeiro: valida compilação TypeScript (`tsc --noEmit`) + `prisma generate`. Falha rápida sem custo de infraestrutura.
- `unit-tests` e `integration-tests` dependem de `build`, rodam em paralelo entre si — não precisam esperar um ao outro.
- `coverage` depende de ambos os jobs de teste — só executa com suite verde.

**GHA `services:` para integration e coverage:**
- Postgres main (porta 5433), Postgres ERP (porta 5435), Redis (porta 6380) — espelha `docker-compose.test.yml`.
- Integration job não usa `docker compose up`; chama `npx vitest run --config vitest.integration.ts` direto, com as variáveis de env injetadas pelo runner.
- Dois `prisma migrate deploy` — um para DATABASE_URL (casecellshop_test) e um para ERP_DATABASE_URL (casecellshop_erp_test). Mesmo schema, dois bancos.

**Coverage com merge nativo do Vitest 2.x:**
- Job `coverage` roda os dois suites: unit primeiro (`--coverage --coverage.reporter=json`), depois integration com `--coverage.mergeWith=./coverage/coverage-final.json`.
- Thresholds de 80% configurados em `vitest.config.ts` (unit) e `vitest.integration.ts` (integration + merged). O merged run checa o threshold sobre a cobertura combinada.
- Evitamos configuração externa de merge (istanbul-merge, lcov) — Vitest 2.x suporta nativamente.

**Node 20 LTS** em todos os jobs.

**Npm cache** habilitado em todos os jobs via `cache: npm` no `actions/setup-node`.

## Resultado

`.github/workflows/ci.yml` criado com 4 jobs:
- `build`: checkout → setup-node → npm ci → prisma generate → typecheck
- `unit-tests` (needs: build): unit suite sem coverage
- `integration-tests` (needs: build): serviços Postgres+Redis → migrate → vitest integration
- `coverage` (needs: unit-tests + integration-tests): mesmos serviços → migrate → unit com `--coverage.reporter=json` → integration com `--coverage.mergeWith`

`vitest.integration.ts` atualizado com bloco `coverage` (provider v8, mesma lista de excludes de `vitest.config.ts`, thresholds 80%).

## Revisões

_Sem iterações — implementação direta após aprovação do design._
