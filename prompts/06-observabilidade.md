# 06 — Observabilidade

## Objetivo

Especificar e implementar observabilidade de produção no CaseCellShop: logs estruturados com propagação de contexto, métricas de negócio e infraestrutura, rastreamento distribuído ligando request → cache → repositório → worker, e documentação operacional (dashboard, alertas, runbook).

## Contexto

Feature implementada após o checkout assíncrono. Motivação: o sistema agora tem fluxos que atravessam múltiplas camadas (HTTP → BullMQ → Prisma → mock ERP) e a falta de rastreabilidade dificulta diagnóstico em produção.

## Prompt

Implementar observabilidade local com os seguintes requisitos:

- Logs estruturados incluem `correlationId`/`requestId` e `orderId` quando existir
- Métricas relevantes, incluindo cache hit/miss e processamento de checkout/fila
- Trace/span real ou stub justificado ligando request, cache, repositório e worker
- README inclui exemplo de dashboard, alerta ou runbook para Datadog ou equivalente

## Critérios de Direcionamento

- **Sem vendor lock-in no core**: OpenTelemetry como camada de instrumentação; exportador configurável (Datadog, Jaeger, console)
- **Local-first**: tudo funciona sem infra externa — exportador de console/noop para dev, configurável via env
- **Métricas de negócio vs. infra**: separar métricas de cache (hit rate, latência) de métricas de fila (jobs enfileirados, confirmados, falhas permanentes)
- **Propagação de contexto**: `correlationId` do header HTTP deve fluir até o worker via AsyncLocalStorage ou contexto OTel, sem passar o valor manualmente por toda a cadeia
- **Stub justificado**: se rastreamento real for complexo demais para o escopo, documentar o contrato do span e deixar no-op instrumentado

## Resultado

Implementação completa aproveitada integralmente:

- `AsyncLocalStorage` em `src/shared/observability/context.ts` propaga `correlationId`/`orderId` sem passar parâmetros na cadeia de chamadas
- `getLogger()` em `src/shared/observability/logger.ts` retorna `pino.child({...store, traceId, spanId})` chamado dentro dos callbacks de span para capturar o contexto ativo
- 4 spans manuais OTel: `http.request` (onRequest hook com `otelContext.with()` para ativar o span), `cache.get`, `checkout.create`, `checkout.process.job`
- 10 métricas prom-client em `src/shared/observability/metrics.ts`: cache hit/miss/eviction/latência, checkout created/confirmed/failed/duração, relay cycles/enqueued
- Stack Docker provisionada: Prometheus, Grafana (porta 3001), Loki, Promtail (docker_sd_configs), Tempo (OTLP HTTP 4318)
- Dashboard Grafana com 5 painéis: Cache Hit Rate, Checkout Funnel, Job Duration, Recent Errors, Instructions

Decisão relevante: traces HTTP→worker são raízes separadas (relay corre em `setInterval` sem contexto HTTP ativo — W3C traceparent impossível). Correlação feita via `correlationId`/`orderId` nos atributos dos spans e nos logs Loki.

## Revisões

- Fix wave após revisão final: `getLogger()` movido para dentro dos callbacks de span (captura `traceId`/`spanId` correto); `onRequest` convertido para done-callback com `otelContext.with()` (spans filhos conectados à raiz HTTP); histograma de cache corrigido para `Date.now()` delta (buckets em ms); PromQL do dashboard corrigido com `sum()` em ambos os lados; Promtail migrado de path estático para `docker_sd_configs`.
