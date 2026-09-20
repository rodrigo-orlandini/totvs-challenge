import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['reflect-metadata'],
    include: ['src/**/*.spec.ts', 'src/**/*.integration-spec.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.integration-spec.ts',
        'src/**/container.ts',
        'src/main.ts',
        'src/infra/http/server.ts',
        'src/infra/http/fastify-types.d.ts',
        'src/modules/catalog/infra/http/product-controller.ts',
        'src/modules/catalog/infra/persistence/prisma-product-repository.ts',
        'src/shared/database/prisma-client.ts',
        'src/shared/observability/logger.ts',
        'src/shared/types/pagination.ts',
        'src/shared/core/use-case.ts',
        'src/modules/catalog/dtos/list-products-dto.ts',
        'src/modules/catalog/repositories/product-repository.ts',
        'src/modules/erp-adapter/infra/persistence/prisma-outbox-repository.ts',
        'src/modules/erp-adapter/infra/persistence/prisma-sync-cursor-repository.ts',
        'src/modules/erp-adapter/infra/persistence/prisma-erp-product-repository.ts',
        'src/modules/erp-adapter/infra/persistence/prisma-erp-stock-flow-repository.ts',
        'src/modules/erp-adapter/infra/persistence/prisma-catalog-product-write-repository.ts',
        'src/modules/erp-adapter/infra/persistence/prisma-catalog-stock-flow-write-repository.ts',
        'src/modules/erp-adapter/infra/queue/bullmq-relay.ts',
        'src/modules/erp-adapter/infra/queue/bullmq-sync-worker.ts',
        'src/modules/erp-adapter/infra/scheduler/erp-poller-product.worker.ts',
        'src/modules/erp-adapter/infra/scheduler/erp-poller-stock-flow.worker.ts',
        'src/modules/erp-adapter/container.ts',
        'src/shared/database/erp-prisma-client.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@infra': resolve(__dirname, 'src/infra'),
    },
  },
})
