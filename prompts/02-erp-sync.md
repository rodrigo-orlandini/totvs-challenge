# 02 — ERP Sync (Sincronização com ERP via Fila)

## Objetivo

Simular banco do ERP com PostgreSQL espelhado e implementar sincronização assíncrona com transactional outbox pattern, idempotência, retry com backoff, DLQ, observabilidade completa.

## Contexto

Continuação da robustez do sistema CaseCellShop após vitrine inicial. ERP simulado via segundo PostgreSQL. Decisão de ferramenta de fila (BullMQ vs NATS) a ser tomada com base em análise de prós/contras.

## Prompt

> Agora vamos iniciar uma estratégia para aumentar a robustes do nosso sistema. Anote no prompts essa próxima solicitação. Precisamos simular o banco de dados do ERP, o qual iremos agora implementar a sincronização com o nosso. Para o banco do ERP, utilize um postgres com a mesma estrutura que o normal, apenas para fim de simulação. Para a sincronização, tenho em mente utilizar uma fila com BullMQ ou NATS, me ajude levantando os prós e contras dessas ferramentas para decidir com qual seguir. Precisamos garantir sempre a sincronização sem mensagens fantasma, então vamos aplicar o transactional outbox pattern. Garanta também a idempotência, criando constraints únicas no banco de dados nos jobs de sincronização e aplicando "on conflict" nas queries. Garanta retry com backoff, timeout, e uma dead-letter queue. Vamos aplicar logs e tracing neste processo, e posteriormente monitorar a fila. Utilize superpowers brainstorming para buscar o contexto necessário e específicar como iremos seguir

## Critérios de Direcionamento

_A preencher após brainstorming_

## Resultado

_A preencher após implementação_

## Revisões

_A preencher se houver iterações_
