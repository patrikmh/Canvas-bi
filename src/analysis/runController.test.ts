import { expect, test, vi } from 'vitest'
import type { SqlEngine } from '../data/engine'
import type { AgentResult, TraceStep } from './agent'
import { AgentRunController } from './runController'
const result = { metric: 'margin', title: '', text: '', confidence: '', steps: [] } as AgentResult
const engine = {} as SqlEngine
test('new run aborts old run and ignores stale trace and results; cancellation covers month changes', async () => {
  const pending: { resolve: (result: AgentResult) => void; options: { signal?: AbortSignal; onSteps?: (steps: TraceStep[]) => void } }[] = []
  const runner = vi.fn((_engine, _month, options) => new Promise<AgentResult>(resolve => pending.push({ resolve, options })))
  const controller = new AgentRunController(runner)
  const trace = vi.fn()
  const first = controller.run(engine, '2026-08', { onSteps: trace })
  const second = controller.run(engine, '2026-07', { onSteps: trace })
  expect(pending[0].options.signal?.aborted).toBe(true)
  pending[0].options.onSteps?.([])
  expect(trace).not.toHaveBeenCalled()
  pending[0].resolve(result)
  expect(await first).toBeUndefined()
  pending[1].options.onSteps?.([])
  expect(trace).toHaveBeenCalledOnce()
  pending[1].resolve(result)
  expect(await second).toBe(result)
  const third = controller.run(engine, '2026-06', { onSteps: trace })
  controller.cancel()
  pending[2].resolve(result)
  expect(await third).toBeUndefined()
})
test('current failure remains observable and stale failures are ignored', async () => {
  const runner = vi.fn().mockRejectedValue(new Error('SQL failed'))
  const controller = new AgentRunController(runner)
  await expect(controller.run(engine, '2026-08')).rejects.toThrow('SQL failed')
  const stale = controller.run(engine, '2026-07')
  controller.cancel()
  expect(await stale).toBeUndefined()
})
