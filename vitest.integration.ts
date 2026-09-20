import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['reflect-metadata'],
    include: ['src/**/*.integration-spec.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/casecellshop_test',
      REDIS_URL: 'redis://localhost:6380',
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
