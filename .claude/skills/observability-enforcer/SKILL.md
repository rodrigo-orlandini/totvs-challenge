---
name: observability-enforcer
description: Checklist de observabilidade CaseCellShop. Execute antes de fechar qualquer use-case ou controller. Verifica correlationId, métricas, spans e ausência de console.log.
---

# Observability Enforcer — CaseCellShop

Checklist executado sobre o arquivo ou módulo indicado. Reporte apenas itens faltando.

## Checklist

### Logger estruturado
- [ ] `console.log` ausente em todo arquivo analisado
- [ ] Logger (pino) importado de `shared/observability/logger.ts`
- [ ] `correlationId` presente em todo log de request (header `x-correlation-id` ou gerado)
- [ ] `orderId` presente nos logs de qualquer fluxo de pedido

### Métricas
- [ ] Cache hit instrumentado: `metrics.increment('catalog.cache.hit')`
- [ ] Cache miss instrumentado: `metrics.increment('catalog.cache.miss')`
- [ ] Checkout iniciado instrumentado: `metrics.increment('checkout.initiated')`
- [ ] Falha de checkout instrumentada: `metrics.increment('checkout.failed', { reason })`
- [ ] Latência de resposta registrada via histogram onde relevante

### Tracing
- [ ] Span criado para `GET /products` (inclui hit/miss como atributo)
- [ ] Span criado para `POST /checkout` (inclui orderId como atributo)
- [ ] Span propagado para chamada ao ERP adapter

### Campos obrigatórios em logs de erro
- [ ] `error.code` presente (código do DomainError)
- [ ] `error.message` presente
- [ ] `correlationId` presente
- [ ] Stack trace NÃO exposto ao cliente (apenas no log interno)

## Formato de saída

```
✅ correlationId propagado
✅ logger pino em uso
❌ cache hit/miss não instrumentado em redis-product-cache.ts
❌ span ausente em list-products-controller.ts
```

Items ausentes bloqueiam a tarefa — adicione antes de seguir para arch-reviewer.
