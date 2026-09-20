import 'reflect-metadata'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Worker as WorkerThread } from 'node:worker_threads'

vi.mock('node:worker_threads', () => {
  const WorkerMock = vi.fn(() => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
    return {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        listeners[event] = listeners[event] ?? []
        listeners[event].push(cb)
      }),
      terminate: vi.fn(),
      _emit: (event: string, ...args: unknown[]) => listeners[event]?.forEach(cb => cb(...args)),
    }
  })
  return { Worker: WorkerMock }
})

import { ErpScheduler } from './erp-scheduler'

describe('ErpScheduler', () => {
  afterEach(() => vi.clearAllMocks())

  it('spawns two worker threads on start', () => {
    vi.useFakeTimers()
    const scheduler = new ErpScheduler()
    scheduler.start()
    vi.runAllTimers()
    expect(WorkerThread).toHaveBeenCalledTimes(2)
    scheduler.stop()
    vi.useRealTimers()
  })

  it('respawns product worker on unexpected exit', async () => {
    vi.useFakeTimers()
    const scheduler = new ErpScheduler()
    scheduler.start()
    vi.runAllTimers()
    const firstCall = vi.mocked(WorkerThread).mock.results[0].value
    firstCall._emit('exit', 1) // simulate crash
    vi.advanceTimersByTime(1500) // advance past 1000ms backoff
    expect(WorkerThread).toHaveBeenCalledTimes(3) // 2 initial + 1 respawn
    scheduler.stop()
    vi.useRealTimers()
  })

  it('does not respawn workers after stop()', () => {
    vi.useFakeTimers()
    const scheduler = new ErpScheduler()
    scheduler.start()
    vi.runAllTimers()
    const firstCall = vi.mocked(WorkerThread).mock.results[0].value
    scheduler.stop()
    firstCall._emit('exit', 1) // exit fires after terminate()
    vi.advanceTimersByTime(2000)
    expect(WorkerThread).toHaveBeenCalledTimes(2) // no new spawns
    vi.useRealTimers()
  })
})
