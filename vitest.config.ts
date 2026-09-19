import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.integration-spec.ts'],
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
        'src/modules/catalog/repositories/i-product-repository.ts',
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
