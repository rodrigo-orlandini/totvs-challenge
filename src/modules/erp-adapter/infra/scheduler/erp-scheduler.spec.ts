import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockTerminate = vi.fn()
const mockOn = vi.fn()

vi.mock('node:worker_threads', () => ({
  Worker: vi.fn(() => ({ terminate: mockTerminate, on: mockOn })),
}))

import { ErpScheduler } from './erp-scheduler'
import { Worker } from 'node:worker_threads'

const MockedWorker = vi.mocked(Worker)

describe('ErpScheduler', () => {
  let scheduler: ErpScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    mockTerminate.mockClear()
    mockOn.mockClear()
    MockedWorker.mockClear()
    scheduler = new ErpScheduler()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('spawns product and stock_flow workers on start()', () => {
    scheduler.start()
    vi.runAllTimers()
    expect(MockedWorker).toHaveBeenCalledTimes(2)
    const workerArgs = MockedWorker.mock.calls.map(c => String(c[0]))
    expect(workerArgs.some(p => p.includes('erp-poller-product'))).toBe(true)
    expect(workerArgs.some(p => p.includes('erp-poller-stock-flow'))).toBe(true)
  })

  it('stop() terminates all workers and prevents respawn', () => {
    scheduler.start()
    vi.runAllTimers()
    scheduler.stop()
    expect(mockTerminate).toHaveBeenCalledTimes(2)
  })

  it('respawns worker with backoff on non-zero exit code', () => {
    scheduler.start()
    vi.runAllTimers()

    // simulate worker exit with code 1 for 'product' worker
    const exitCallbacks = mockOn.mock.calls.filter(c => c[0] === 'exit').map(c => c[1])
    expect(exitCallbacks.length).toBeGreaterThan(0)
    MockedWorker.mockClear()

    exitCallbacks[0](1) // non-zero exit
    vi.advanceTimersByTime(1000)

    expect(MockedWorker).toHaveBeenCalledTimes(1)
  })

  it('does not respawn worker on exit code 0 (clean shutdown)', () => {
    scheduler.start()
    vi.runAllTimers()
    MockedWorker.mockClear()

    const exitCallbacks = mockOn.mock.calls.filter(c => c[0] === 'exit').map(c => c[1])
    exitCallbacks[0](0)
    vi.runAllTimers()

    expect(MockedWorker).not.toHaveBeenCalled()
  })

  it('does not respawn after stop() even if worker exits with non-zero code', () => {
    scheduler.start()
    vi.runAllTimers()
    scheduler.stop()
    MockedWorker.mockClear()

    const exitCallbacks = mockOn.mock.calls.filter(c => c[0] === 'exit').map(c => c[1])
    exitCallbacks[0](1) // non-zero after stop
    vi.runAllTimers()

    expect(MockedWorker).not.toHaveBeenCalled()
  })

  it('logs error when worker emits error event (does not crash)', () => {
    scheduler.start()
    vi.runAllTimers()
    const errorCallbacks = mockOn.mock.calls.filter(c => c[0] === 'error').map(c => c[1])
    expect(errorCallbacks.length).toBeGreaterThan(0)
    // firing error event must not throw
    expect(() => errorCallbacks[0](new Error('worker crashed'))).not.toThrow()
  })

  it('doubles backoff on repeated crashes up to 30s cap', () => {
    scheduler.start()
    vi.runAllTimers()
    MockedWorker.mockClear()

    // First crash — backoff 1000ms
    const getExitCb = () => mockOn.mock.calls.filter(c => c[0] === 'exit').map(c => c[1]).at(-1)
    getExitCb()!(1)
    vi.advanceTimersByTime(999)
    expect(MockedWorker).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(MockedWorker).toHaveBeenCalledTimes(1)
    MockedWorker.mockClear()

    // Second crash — backoff 2000ms
    getExitCb()!(1)
    vi.advanceTimersByTime(1999)
    expect(MockedWorker).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(MockedWorker).toHaveBeenCalledTimes(1)
  })
})
