import type { SqlEngine } from '../data/engine'
import { runAgent } from './agent'
type Options = Parameters<typeof runAgent>[2]

/** One owner for startup and requested analyses. Stale callbacks never reach React. */
export class AgentRunController {
  private controller: AbortController | null = null
  private generation = 0
  private runner: typeof runAgent
  constructor(runner: typeof runAgent = runAgent) { this.runner = runner }
  cancel() { this.controller?.abort(); this.controller = null; this.generation++ }
  async run(engine: SqlEngine, month: string, options: Options = {}) {
    this.cancel()
    const generation = this.generation
    const controller = new AbortController()
    this.controller = controller
    const current = () => generation === this.generation && !controller.signal.aborted
    try {
      const result = await this.runner(engine, month, { ...options, signal: controller.signal,
        onSteps: steps => { if (current()) options.onSteps?.(steps) } })
      return current() ? result : undefined
    } catch (cause) { if (current()) throw cause }
    finally { if (generation === this.generation) this.controller = null }
  }
}
