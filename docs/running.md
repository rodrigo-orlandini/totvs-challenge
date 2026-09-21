# Como rodar o projeto

Guia completo para subir o CaseCellShop localmente, com e sem stack de observabilidade.

## Pré-requisitos

| Ferramenta | Versão mínima | Observação |
|---|---|---|
| Node.js | 20 | Somente para rodar testes locais fora do container |
| Docker | qualquer recente | Motor obrigatório para infraestrutura |
| Docker Compose | v2 (`compose` plugin) | `docker compose` sem hífen |

> **Windows sem Docker Desktop:** engine roda dentro do WSL (Ubuntu). Substitua `docker compose` por `wsl docker compose` em todos os comandos abaixo.

---

## 1. Clonar e configurar variáveis de ambiente

```bash
git clone https://github.com/rodrigo-orlandini/totvs-challenge.git
cd totvs-challenge

cp .env.example .env
```

O `.env.example` já contém todos os valores corretos para rodar com o `docker-compose.yml` padrão. Nenhuma alteração é necessária para ambiente local.

---

## 2. Subir infraestrutura e aplicação

```bash
docker compose up
```

Isso sobe 4 containers:

| Container | Imagem | Porta local |
|---|---|---|
| `casecellshop-app` | build local (Node.js 20) | `3000` |
| `casecellshop-postgres` | postgres:16-alpine | `5432` |
| `casecellshop-redis` | redis:7-alpine | `6379` |
| `casecellshop-postgres-erp` | postgres:16-alpine | `5434` |

A aplicação aguarda o PostgreSQL e o Redis estarem saudáveis antes de iniciar (healthchecks configurados). O primeiro `up` pode demorar alguns minutos para baixar as imagens e compilar o TypeScript.

> Para rodar em background: `docker compose up -d`  
> Para acompanhar logs depois: `docker compose logs -f app`

---

## 3. Executar migrations e seed

As migrations rodam automaticamente via `prisma migrate dev` no entrypoint do container. Se precisar rodar manualmente:

```bash
# Dentro do container
docker compose exec app npx prisma migrate dev

# Ou localmente (banco acessível via porta exposta)
npm run db:migrate
npm run db:seed
```

---

## 4. Verificar que tudo está no ar

| URL | O que é |
|---|---|
| `http://localhost:3000/docs` | Swagger UI — documentação interativa da API |
| `http://localhost:3000/metrics` | Endpoint Prometheus (texto plano) |
| `http://localhost:3000/admin/queues` | BullBoard — estado das filas BullMQ |
| `http://localhost:3000/products` | Lista de produtos (retorna `[]` sem seed) |

---

## 5. Rodar com stack de observabilidade (opcional)

Sobe Prometheus, Grafana, Loki, Promtail e Tempo em paralelo à aplicação:

```bash
docker compose -f docker-compose.observability.yml up -d
```

Para enviar traces da aplicação para o Tempo, adicione ao `.env`:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Depois reinicie o container da aplicação:

```bash
docker compose restart app
```

Serviços disponíveis:

| Serviço | URL | Credenciais |
|---|---|---|
| Grafana | `http://localhost:3001` | `admin` / `admin` |
| Prometheus | `http://localhost:9090` | — |
| Tempo | `http://localhost:3200` | — |
| Loki | `http://localhost:3100` | — |

O Grafana já vem com datasources (Prometheus, Loki, Tempo) e dashboard provisionados automaticamente. Acesse **Dashboards → CaseCellShop** para ver os painéis.

Sem `OTEL_EXPORTER_OTLP_ENDPOINT` configurado, o app usa `ConsoleSpanExporter`: traces aparecem no stdout do container, não no Tempo.

---

## 6. Rodar os testes

### Testes unitários (sem Docker)

```bash
npm install
npm run test:unit
```

### Testes de integração (requer Docker)

Sobe containers de teste isolados (portas diferentes da infra principal):

```bash
# Docker Desktop
npm run test:integration

# WSL
wsl docker compose -f docker-compose.test.yml up -d
npm run test:integration
```

Containers de teste:

| Container | Porta local |
|---|---|
| `casecellshop-postgres-test` | `5433` |
| `casecellshop-redis-test` | `6380` |
| `casecellshop-postgres-erp-test` | `5435` |

### Todos os testes + coverage

```bash
npm run test:all
```

---

## 7. Parar tudo

```bash
# Parar aplicação + infra
docker compose down

# Parar observabilidade
docker compose -f docker-compose.observability.yml down

# Remover volumes (dados do banco)
docker compose down -v
```

---

## Referência rápida de comandos

```bash
# Subir tudo (app + infra)
docker compose up

# Subir com observabilidade
docker compose up & docker compose -f docker-compose.observability.yml up -d

# Logs da aplicação
docker compose logs -f app

# Acessar banco via psql
docker compose exec postgres psql -U postgres -d casecellshop_dev

# Acessar Redis CLI
docker compose exec redis redis-cli

# Rodar testes unitários
npm run test:unit

# Type check
npm run typecheck
```
