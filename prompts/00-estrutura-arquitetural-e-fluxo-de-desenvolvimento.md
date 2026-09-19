# 00 Estrutura Arquitetural e Fluxo de Desenvolvimento

## Objetivo

Definir a estrutura arquitetural do projeto, padrões de código e ferramentas internas que garantam manutenção, legibilidade e desacoplamento ao longo das sessões de desenvolvimento.

## Contexto

Prompt inicial do projeto, anterior a qualquer codificação. Define a filosofia de arquitetura e o conjunto de ferramentas (skills, agentes) que serão usados em todas as sessões.

## Prompt

```
Antes de iniciar a codificação, precisamos manter uma boa guideline da estrutura do código, afim de manter padrões arquiteturais para fácil manutenção, legibilidade e desacoplamento. Para isso, vamos criar um conjunto de ferramentas internas do projeto para que a cada sessão, sejamos capazes de manter essa estrutura sem muita fricção. Descrevendo a estrutura que espero: este software deve ser construído em único repositório para fim de testes, mas em uma futura migração para microsserviços, não podemos ter retrabalho, logo, vamos trabalhar com um monolito modular e princípios de arquitetura limpa (Clean Architecture), onde cada módulo deve conter suas entities, use-cases, controllers, repositories, interfaces, mappers e presenters, além de realizar testes nas principais camadas e aplicar princípios de Injeção e Inversão de Dependências e os demais princípios do SOLID. Use o superpowers e vamos fazer um brainstorming para especificar mais afundo os detalhes dessa estrutura e tirar todas as dúvidas. Vamos pensar também em um fluxo completo, onde temos a Skill de desenvolvimento, agentes de revisão para checagem dos padrões, etc.
```

## Critérios de Direcionamento

Prompt estruturado para cobrir três dimensões simultaneamente: (1) decisão arquitetural — monolito modular com Clean Architecture preparado para migração a microsserviços; (2) convenção de módulo — entities, use-cases, controllers, repositories, interfaces, mappers, presenters; (3) fluxo de desenvolvimento — skills + agentes de revisão para enforcement automático dos padrões. Uso explícito do `superpowers:brainstorming` para aprofundar detalhes antes de qualquer codificação.

## Resultado

Brainstorming executado com `superpowers:brainstorming`. Design aprovado em seções. Spec escrita em `docs/superpowers/specs/2026-09-19-modular-monolith-clean-architecture-design.md`.

Estrutura implementada:
- Scaffold completo em `src/modules/{catalog,checkout,erp-adapter}` com todas as camadas (entities, use-cases, repositories, infra, mappers, presenters, dtos)
- `src/shared/core/either.ts`, `use-case.ts`, `domain-error.ts`, `http-error-mapper.ts`
- Docker Compose dev + test com container names explícitos
- Dockerfile multistage (dev / build / prod)
- `vitest.config.ts` (unit) + `vitest.integration.ts` (integration)
- `CONTEXT.md` — glossário de domínio
- `src/shared/core/architecture-rules.md` — checklist de revisão

Agentes criados em `.claude/agents/`:
- `arch-reviewer` — detecta violações de dependência, Either ausente, DI contornada, kebab-case
- `tdd-agent` — conduz red→green→refactor, verifica coverage por camada, bloqueia anti-patterns

Skills criadas em `.claude/skills/`:
- `session-start` — onboarding por sessão, carrega contexto e direciona tarefas
- `domain-modeler` — extrai VOs, define invariantes, valida nomenclatura contra CONTEXT.md
- `observability-enforcer` — checklist de logs, métricas, spans e ausência de console.log

Decisões aproveitadas integralmente. Nenhuma revisão necessária.

## Revisões

Nenhuma.
