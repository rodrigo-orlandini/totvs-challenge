# 05 — Checkout Assíncrono

## Objetivo

Implementar o fluxo de checkout assíncrono com reserva de estoque, Transactional Outbox Pattern, idempotência e consulta de status de pedido.

## Contexto

A plataforma não possui endpoint de compra. Clientes precisam finalizar pedidos sem que o sistema fique bloqueado aguardando o faturamento no ERP — que pode demorar ou falhar. Além disso, compras concorrentes sobre o mesmo produto precisam ser controladas para evitar overselling.

## Prompt

> Vamos implementar o fluxo de checkout assíncrono. Quando o cliente finaliza uma compra, o sistema deve reservar o estoque imediatamente para evitar overselling, registrar o pedido e publicar o evento de processamento usando Transactional Outbox Pattern, retornando 202 Accepted sem aguardar o faturamento no ERP.
>
> O endpoint principal é `POST /checkout`, que recebe `customerId`, `correlationId` (opcional, gerado pelo servidor se ausente), e `items[]` com `productId` e `quantity`. O header `Idempotency-Key` (UUID) é obrigatório para tolerar retry e duplo clique. A resposta deve retornar `orderId` e `status: PENDING`.
>
> Para acompanhamento do pedido, precisamos de `GET /orders/{orderId}/status` com autenticação JWT. Clientes só visualizam os próprios pedidos; equipe interna vê todos. A resposta inclui `status` (PENDING, PROCESSING, CONFIRMED, FAILED, FAILED_PERMANENT), `attempts`, `lastError`, `createdAt` e `updatedAt`.
>
> Para a reserva de estoque, reservamos a quantidade no início do checkout — se a compra não for finalizada dentro de um tempo limite, devolvemos ao estoque. Para idempotência, criamos uma chave única no banco com status de processamento (pendente → processando → completo), confiando na constraint de unicidade do banco.
>
> O Transactional Outbox garante que pedido e evento sejam registrados na mesma transação antes de publicar na fila. Workers consomem a fila e atualizam o status no banco. Retry com exponential backoff, DLQ para falhas permanentes. Vamos usar o superpowers para refinar esse design antes de implementar.

## Critérios de Direcionamento

_A preencher após brainstorming_

## Resultado

_A preencher após implementação_

## Revisões

_A preencher se houver iterações_
