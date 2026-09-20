import { Worker as WorkerThread } from 'node:worker_threads'
import path from 'node:path'
import { logger } from '@shared/observability/logger'

const WORKER_FILES = {
  product: path.resolve(__dirname, 'erp-poller-product.worker.js'),
  stock_flow: path.resolve(__dirname, 'erp-poller-stock-flow.worker.js'),
} as const

type WorkerEntity = keyof typeof WORKER_FILES

export class ErpScheduler {
  private workers: Map<WorkerEntity, WorkerThread> = new Map()

  start(): void {
    this.spawnWorker('product')
    this.spawnWorker('stock_flow')
  }

  stop(): void {
    for (const [, worker] of this.workers) {
      worker.terminate()
    }
    this.workers.clear()
  }

  private spawnWorker(entity: WorkerEntity, backoffMs = 0): void {
    setTimeout(() => {
      const worker = new WorkerThread(WORKER_FILES[entity])
      this.workers.set(entity, worker)

      worker.on('exit', (code) => {
        if (code !== 0) {
          const nextBackoff = Math.min(backoffMs === 0 ? 1000 : backoffMs * 2, 30000)
          logger.warn({ entity, exitCode: code, backoffMs: nextBackoff }, 'erp.scheduler.worker.respawn')
          this.spawnWorker(entity, nextBackoff)
        }
      })
    }, backoffMs)
  }
}
