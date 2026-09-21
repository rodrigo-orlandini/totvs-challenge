import { Counter, Histogram, Registry } from 'prom-client'

export const register = new Registry()
register.setDefaultLabels({ service: 'casecellshop' })

export const metrics = {
  cacheHits: new Counter({
    name: 'cache_hits_total',
    help: 'Total cache hits by layer',
    labelNames: ['layer'] as const,
    registers: [register],
  }),
  cacheMisses: new Counter({
    name: 'cache_misses_total',
    help: 'Total cache misses',
    registers: [register],
  }),
  cacheEvictions: new Counter({
    name: 'cache_evictions_total',
    help: 'Total L1 LFU evictions',
    registers: [register],
  }),
  cacheOperationDuration: new Histogram({
    name: 'cache_operation_duration_ms',
    help: 'Cache operation duration in milliseconds',
    labelNames: ['operation'] as const,
    buckets: [1, 5, 10, 25, 50, 100, 250],
    registers: [register],
  }),
  checkoutCreated: new Counter({
    name: 'checkout_orders_created_total',
    help: 'Orders created via POST /checkout',
    registers: [register],
  }),
  checkoutConfirmed: new Counter({
    name: 'checkout_orders_confirmed_total',
    help: 'Orders confirmed by worker',
    registers: [register],
  }),
  checkoutFailed: new Counter({
    name: 'checkout_orders_failed_total',
    help: 'Orders that failed processing',
    labelNames: ['permanent'] as const,
    registers: [register],
  }),
  checkoutJobDuration: new Histogram({
    name: 'checkout_job_duration_ms',
    help: 'Checkout job processing duration in milliseconds',
    buckets: [100, 250, 500, 1000, 2500, 5000],
    registers: [register],
  }),
  relayCycles: new Counter({
    name: 'checkout_relay_cycles_total',
    help: 'Relay poll cycles executed',
    registers: [register],
  }),
  relayEnqueued: new Counter({
    name: 'checkout_relay_enqueued_total',
    help: 'Outbox entries enqueued by relay',
    registers: [register],
  }),
}
