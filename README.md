# CaseCellShop

> As respostas para o teste conceitual estão em [`respostas-teste-conceitual.pdf`](./respostas-teste-conceitual.pdf).

**Documentação:**
- [Como rodar o projeto](./docs/running.md) — setup completo em 5 passos
- [Testes manuais — Vitrine](./docs/testing-vitrine.md)
- [Testes manuais — Checkout](./docs/testing-checkout.md)
- [Testes manuais — Observabilidade](./docs/testing-observability.md)
- [Observabilidade](./docs/observability.md) — spans, métricas, runbook

---

Sistema de e-commerce modular para venda de capinhas de celular, construído como monólito modular com arquitetura limpa.

## Stack

- **Runtime:** Node.js 20 + TypeScript
- **Framework:** Fastify 4
- **ORM:** Prisma 5 + PostgreSQL
- **Cache:** Redis (L1 in-memory + L2 Redis)
- **Filas:** BullMQ
- **Observabilidade:** OpenTelemetry (traces), Prometheus (métricas), Pino (logs)

## Como rodar

Consulte [`docs/running.md`](./docs/running.md) para o guia completo de 5 passos.

```bash
cp .env.example .env
docker compose up -d
docker compose exec app npm run db:migrate
docker compose exec app npm run db:migrate:erp
docker compose exec app npm run db:seed:erp
```

Aguardar sync ERP → abrir `http://localhost:3000/products`.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/products` | Lista produtos com cache L1+L2 |
| POST | `/checkout` | Cria pedido (async, 202) |
| GET | `/orders/:id/status` | Consulta status do pedido |
| GET | `/metrics` | Métricas Prometheus |
| GET | `/docs` | Swagger UI |
| GET | `/admin/queues` | BullBoard (filas BullMQ) |

## Módulos

- **catalog** — vitrine de produtos, cache Redis bidirecional, fonte de verdade: ERP
- **checkout** — recebe pedido, reserva estoque, processa via worker async
- **erp-adapter** — adapter para o ERP externo com retry, timeout e fallback

## Testes

```bash
npm run test:unit          # sem Docker
npm run test:integration   # requer Docker (portas isoladas)
npm run test:all           # todos + coverage
```

## Observabilidade (opcional)

```bash
docker compose -f docker-compose.observability.yml up -d
```

| Serviço | URL |
|---------|-----|
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| Tempo | http://localhost:3200 |

Consulte [`docs/observability.md`](./docs/observability.md) para detalhes de spans, métricas e runbook.
