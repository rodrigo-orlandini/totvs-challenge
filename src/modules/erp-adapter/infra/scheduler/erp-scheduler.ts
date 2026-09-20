import { Worker as WorkerThread } from 'node:worker_threads'
import path from 'node:path'
import { logger } from '@shared/observability/logger'

const ext = __filename.endsWith('.ts') ? '.worker.ts' : '.worker.js'
const WORKER_FILES = {
  product: path.resolve(__dirname, `erp-poller-product${ext}`),
  stock_flow: path.resolve(__dirname, `erp-poller-stock-flow${ext}`),
} as const

type WorkerEntity = keyof typeof WORKER_FILES

export class ErpScheduler {
  private workers: Map<WorkerEntity, WorkerThread> = new Map()
  private stopping = false

  start(): void {
    this.stopping = false
    this.spawnWorker('product')
    this.spawnWorker('stock_flow')
  }

  stop(): void {
    this.stopping = true
    for (const [, worker] of this.workers) {
      worker.terminate()
    }
    this.workers.clear()
  }

  private spawnWorker(entity: WorkerEntity, backoffMs = 0): void {
    setTimeout(() => {
      if (this.stopping) return
      const worker = new WorkerThread(WORKER_FILES[entity])
      this.workers.set(entity, worker)

      worker.on('error', (err) => {
        logger.error({ entity, err }, 'erp.scheduler.worker.error')
      })

      worker.on('exit', (code) => {
        if (this.stopping) return
        if (code !== 0) {
          const nextBackoff = Math.min(backoffMs === 0 ? 1000 : backoffMs * 2, 30000)
          logger.warn({ entity, exitCode: code, backoffMs: nextBackoff }, 'erp.scheduler.worker.respawn')
          this.spawnWorker(entity, nextBackoff)
        }
      })
    }, backoffMs)
  }
}
