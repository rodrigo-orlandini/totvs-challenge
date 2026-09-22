# Como rodar o projeto

## Pré-requisitos

| Ferramenta | Versão mínima | Observação |
|---|---|---|
| Docker | qualquer recente | Motor obrigatório |
| Docker Compose | v2 (`compose` plugin) | `docker compose` sem hífen |
| Node.js | 20 | Só para testes fora do container |

> **Windows sem Docker Desktop:** engine roda dentro do WSL. Substitua `docker compose` por `wsl docker compose` em todos os comandos.

---

## Passo 1 — Clonar e configurar

```bash
git clone https://github.com/rodrigo-orlandini/totvs-challenge.git
cd totvs-challenge
cp .env.example .env
```

O `.env.example` já tem todos os valores corretos para ambiente local. Nenhuma alteração necessária.

---

## Passo 2 — Subir os containers

```bash
docker compose up -d
```

Sobe 4 containers em background:

| Container | Porta local |
|---|---|
| `casecellshop-app` (Node.js) | `3000` |
| `casecellshop-postgres` | `5432` |
| `casecellshop-redis` | `6379` |
| `casecellshop-postgres-erp` | `5434` |

O primeiro `up` baixa as imagens e compila o TypeScript — pode levar alguns minutos. Acompanhe com:

```bash
docker compose logs -f app
```

Aguarde aparecer: `Server listening at http://0.0.0.0:3000`

---

## Passo 3 — Aplicar migrations

```bash
# Banco principal
docker compose exec app npm run db:migrate

# Banco ERP
docker compose exec app npm run db:migrate:erp
```

---

## Passo 4 — Popular dados iniciais

```bash
# Seed apenas no banco ERP
docker compose exec app npm run db:seed:erp
```

O seed cria 100 produtos e stock_flows no banco ERP. O poller detecta as entradas e inicia a sincronização automaticamente via BullMQ (`erp-sync`). Aguarde o sync completar antes de acessar `GET /products`:

```bash
# Acompanhar fila — esperar waiting: 0 e active: 0
docker compose logs -f app | Select-String "erp.sync"
```

Ou abrir `http://localhost:3000/admin/queues → erp-sync` e aguardar todos os jobs completarem.

---

## Passo 5 — Verificar

| URL | O que é |
|---|---|
| `http://localhost:3000/products` | Lista de produtos (deve retornar dados do seed) |
| `http://localhost:3000/docs` | Swagger UI — documentação interativa da API |
| `http://localhost:3000/admin/queues` | BullBoard — estado das filas BullMQ |
| `http://localhost:3000/metrics` | Métricas Prometheus |

---

## Observabilidade (opcional)

Para subir Prometheus, Grafana, Loki e Tempo:

```bash
docker compose -f docker-compose.observability.yml up -d
```

Para enviar traces para o Tempo, adicione ao `.env` e reinicie o app:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318
```

```bash
docker compose restart app
```

| Serviço | URL | Credenciais |
|---|---|---|
| Grafana | `http://localhost:3001` | sem login (anonymous Admin) |
| Prometheus | `http://localhost:9090` | — |
| Tempo | `http://localhost:3200` | — |

O Grafana já vem com datasources e dashboard provisionados. Acesse **Dashboards → CaseCellShop**.

---

## Testes

### Unitários (sem Docker)

```bash
npm install
npm run test:unit
```

### Integração (requer Docker)

```bash
npm run test:integration
```

Sobe containers isolados nas portas `5433`, `6380` e `5435`.

### Todos + coverage

```bash
npm run test:all
```

---

## Parar tudo

```bash
# App + infra
docker compose down

# Observabilidade
docker compose -f docker-compose.observability.yml down

# Remover volumes (apaga dados do banco)
docker compose down -v
```
