# Prompts de IA

Os prompts utilizados no desenvolvimento do CaseCellShop estão documentados em [`prompts/`](./prompts/).

Cada arquivo registra:
- **Objetivo** — o que o prompt resolve ou produz
- **Contexto** — onde e por que foi usado
- **Prompt** — texto exato enviado à IA
- **Critérios de direcionamento** — decisões de engenharia do prompt
- **Resultado** — o que foi produzido e avaliação crítica

## Índice

| # | Arquivo | Tema |
|---|---|---|
| 00 | [estrutura-arquitetural-e-fluxo-de-desenvolvimento](./prompts/00-estrutura-arquitetural-e-fluxo-de-desenvolvimento.md) | Arquitetura inicial e fluxo de desenvolvimento assistido |
| 01 | [vitrine-inicial](./prompts/01-vitrine-inicial.md) | Endpoint GET /products, schema Prisma, controller Fastify |
| 02 | [erp-sync](./prompts/02-erp-sync.md) | Sincronização com ERP fake via polling HTTP |
| 03 | [git-workflow-e-ci](./prompts/03-git-workflow-e-ci.md) | Workflow git com feature branches e pipeline GitHub Actions |
| 04 | [cache-vitrine](./prompts/04-cache-vitrine.md) | Cache L1 in-process + L2 Redis com evição LFU |
| 05 | [checkout-assincrono](./prompts/05-checkout-assincrono.md) | Checkout com Outbox Pattern, soft reservation, BullMQ worker |
| 06 | [observabilidade](./prompts/06-observabilidade.md) | OpenTelemetry, prom-client, stack local Prometheus/Grafana/Loki/Tempo |
