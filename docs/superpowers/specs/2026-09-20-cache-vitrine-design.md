# Cache da Vitrine — Design Spec

## Objetivo

Adicionar duas camadas de cache (L1 in-process + L2 Redis) à listagem de produtos da vitrine, com invalidação granular por produto via serviço de sincronização ERP, refresh-ahead para evitar cache stampede, e eviction LFU no L1.

## Contexto

`ListProductsUseCase` chama `IProductRepository.findAll({ page, limit })` que vai direto ao Postgres a cada requisição. Com crescimento de acessos, leitura precisa ser protegida. A base de produtos é grande — cache por página seria invalidado por completo a cada sync, sobrecarregando o DB. Cache granular por produto com Redis Sorted Set resolve ordenação e paginação sem esse problema.

## Arquitetura

### Camadas de cache

**L1 — In-process (ProductCacheService)**
- Estrutura: `Map<string, { data: ProductResponseItem, expiresAt: number, frequency: number }>`
- Eviction: LFU — ao atingir max entries (1000), remove a entrada com menor `frequency`
- Cada acesso (`getProduct`) incrementa `frequency`
- TTL: 600s base ± 10s jitter = `600 + Math.floor(Math.random() * 20) - 10` segundos

**L2 — Redis (ProductCacheService)**
- `products:sorted` — Redis Sorted Set; score = `createdAt` timestamp (ms); membros = product UUIDs
- `product:{id}` — string JSON de `ProductResponseItem`; TTL idêntico ao L1 (com jitter independente)
- `products:total` — string com contagem total de produtos; TTL idêntico

### Fluxo de leitura — `CachedProductRepository.findAll({ page, limit })`

```
1. IDs e total:
   a. L1 check: existe lista de IDs em memória?
      → sim: usa
      → não: ZRANGE products:sorted 0 -1 WITHSCORES no Redis
         → hit: popula L1, usa
         → miss: query DB (findAll sem limite), ZADD todos + SET products:total, popula L1

2. Paginação: slice IDs por offset/limit

3. Para cada ID na página:
   a. L1 check → hit: retorna, incrementa frequency
   b. GET product:{id} no Redis → hit: popula L1, retorna
   c. Miss: query DB para aquele produto, SET product:{id} Redis + popula L1

4. Retorna { products: [...], total }
```

### Invalidação / atualização por sync — `ProcessSyncJobUseCase`

Injeta `IProductCacheUpdater` (porta no erp-adapter).

**Entidade `product` (após `productRepo.upsert`):**
- Lê `product:{id}` de L1 ou L2 para preservar `availableQuantity` atual
- Se cache miss (produto novo): `ZADD products:sorted <createdAt_ms> <id>` para incluir no Sorted Set; não popula `product:{id}` ainda — próxima leitura via `CachedProductRepository` popula com `availableQuantity` correto do DB
- Se cache hit (produto existente): atualiza campos `{ sku, name, price }` mantendo `availableQuantity`; escreve de volta em L1 + L2 com novo TTL

**Entidade `stock_flow` (após `stockFlowRepo.createIfNotExists`):**
- Lê `product:{productId}` de L1 ou L2
- Cache hit: `availableQuantity += payload.quantity`; escreve de volta em L1 + L2
- Cache miss: ignora — próxima leitura recalcula `SUM(quantity)` via DB (cache-aside normal)

### Refresh-ahead — `CacheRefreshScheduler`

Roda no processo principal via `setInterval` a cada 60s.

**Lógica por iteração:**
1. Itera todas as entradas do L1 Map
2. Para entradas com `expiresAt - Date.now() < 120_000ms` (2 min restantes): dispara refresh async
   - Busca produto do DB (`prisma.product.findUnique` + sum de stockFlow)
   - Re-escreve `product:{id}` em L1 + L2 com TTL renovado
3. Garante que o Sorted Set `products:sorted` tem TTL renovado quando abaixo do threshold

**Warm-up no startup:** na inicialização, `CacheRefreshScheduler.warmAll()` faz `ZRANGE products:sorted 0 -1`, busca todos os `product:{id}` do Redis para L1. Se Redis também estiver frio, carrega todos do DB.

### Porta no erp-adapter

```typescript
// src/modules/erp-adapter/repositories/product-cache-updater.ts
export interface IProductCacheUpdater {
  updateProduct(id: string, data: {
    sku: string
    name: string
    price: number
    updatedAt: Date
  }): Promise<void>

  updateAvailableQuantity(productId: string, delta: number): Promise<void>
}
```

Registrado no catalog container: `ProductCacheService` como `IProductCacheUpdater`.

## Estrutura de arquivos

```
src/modules/catalog/
  cache/
    product-cache-service.ts      # L1 Map (LFU) + L2 Redis ops, TTL/jitter
    cache-refresh-scheduler.ts    # setInterval worker, warm-up
  infra/
    persistence/
      cached-product-repository.ts  # decorator IProductRepository
src/modules/erp-adapter/
  repositories/
    product-cache-updater.ts      # porta IProductCacheUpdater
```

Modificados:
- `src/modules/erp-adapter/use-cases/process-sync-job/process-sync-job.ts` — injeta `IProductCacheUpdater`
- `src/modules/catalog/container.ts` — registra `ProductCacheService` + `CachedProductRepository` + `CacheRefreshScheduler`
- `src/modules/erp-adapter/container.ts` — registra `ProductCacheService` como `IProductCacheUpdater`

## Constraints

- `ioredis` já presente — nenhuma dependência nova obrigatória
- TTL base: 600s; jitter: ±10s; refresh-ahead threshold: 120s; scheduler interval: 60s
- L1 max entries: 1000; eviction: LFU (menor frequency)
- Redis key prefix: `products:sorted`, `product:{id}`, `products:total`
- `IProductCacheUpdater` definida no erp-adapter, implementada no catalog — respeita regra de dependência (erp-adapter não importa catalog)
- `CachedProductRepository` é infra — `ListProductsUseCase` não muda
- Falha no Redis (L2 down): L1 continua servindo; se L1 também miss, fallback ao DB sem erro para o usuário
- Testes: mocks de Redis (`ioredis-mock` ou vi.mock) para unit tests; integração com Redis real existente para integration tests
