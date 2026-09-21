import { AsyncLocalStorage } from 'node:async_hooks'

export interface ObsContext {
  correlationId: string
  orderId?: string
}

const als = new AsyncLocalStorage<ObsContext>()

export function runWithContext<T>(ctx: ObsContext, fn: () => T): T {
  return als.run(ctx, fn)
}

export function getContext(): ObsContext | undefined {
  return als.getStore()
}

export function enterContext(ctx: ObsContext): void {
  als.enterWith(ctx)
}
