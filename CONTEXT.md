# Domínio CaseCellShop

Glossário vivo. Atualizado conforme a modelagem de domínio avança.
Referenciado pelas skills `domain-modeler`, `tdd`, e `improve-codebase-architecture`.

## Entidades e Conceitos

- **Product** — item do catálogo com SKU, nome, preço e disponibilidade de estoque
- **Order** — pedido iniciado no checkout, processado de forma assíncrona pelo worker
- **OrderStatus** — estado do pedido: `PENDING` | `PROCESSING` | `CONFIRMED` | `FAILED`
- **Stock** — quantidade disponível de um Product no ERP; lida via cache com fallback ao ERP
- **ERP** — sistema externo fictício de faturamento e controle de estoque; acesso via `erp-adapter`

## Módulos

- **catalog** — expõe vitrine de produtos com cache Redis; fonte de verdade: ERP (via adapter)
- **checkout** — recebe pedido, reserva estoque, processa de forma assíncrona, notifica ERP
- **erp-adapter** — adaptador do ERP fictício; encapsula retry, timeout e fallback

## Fluxos Principais

- `GET /products` — retorna catálogo com cache (TTL configurável); hit/miss instrumentado
- `POST /checkout` — retorna 202 Accepted + orderId; worker processa em background
- `GET /orders/:orderId/status` — consulta status do pedido pelo orderId

## Invariantes de Domínio

- Product não pode ter preço negativo
- Order não pode ser criada com quantidade > estoque disponível (overselling proibido)
- Order é idempotente por `idempotency-key` no header — duplo clique gera um único pedido
