---
name: session-start
description: Onboarding de sessão CaseCellShop. Carrega contexto do projeto, mostra estado atual e direciona para skill/agente correto. Invoque no início de toda sessão nova.
---

# Session Start — CaseCellShop

## O que fazer

1. Leia `CONTEXT.md` — glossário de domínio
2. Leia `src/shared/core/architecture-rules.md` — regras de arquitetura
3. Leia `docs/superpowers/specs/2026-09-19-modular-monolith-clean-architecture-design.md` — design aprovado
4. Liste módulos existentes em `src/modules/` e arquivos presentes
5. Mostre estado resumido ao usuário

## Saída esperada

```
## Sessão CaseCellShop iniciada

**Módulos:**
- catalog: [arquivos existentes ou "vazio"]
- checkout: [arquivos existentes ou "vazio"]
- erp-adapter: [arquivos existentes ou "vazio"]

**Shared core:** either.ts ✅ | use-case.ts ✅ | domain-error.ts ✅

**Qual tarefa vamos executar hoje?**
```

## Direcionamento por tipo de tarefa

| Tarefa declarada | Skill/agente |
|---|---|
| Nova feature complexa / decisão arquitetural | `/brainstorming` |
| Modelar entity, VO ou definir invariantes | `/domain-modeler` |
| Implementar use-case, entity, repository | Agente `tdd-agent` |
| Revisar diff antes do commit | Agente `arch-reviewer` |
| Verificar observabilidade | `/observability-enforcer` |
| Antes de fechar qualquer tarefa | `superpowers:verification-before-completion` |
