import { expect, test, vi } from 'vitest'
import { chooseIntent, type LlmSettings } from './llm'
const settings: LlmSettings = { provider: 'OpenAI', model: 'test-model', key: 'test-only', enabled: true }
test('fetch errors fall back to deterministic offline intent', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
  expect(await chooseIntent('lägg till en tabell', settings, undefined, fetcher)).toMatchObject({ intent: { kind: 'add', card: 'table' }, fallback: true })
})
test('default off makes no network call', async () => {
  const fetcher = vi.fn()
  await chooseIntent('Bevaka marginalen', { ...settings, enabled: false }, undefined, fetcher)
  expect(fetcher).not.toHaveBeenCalled()
})
test('valid tool arguments are accepted; provider prose and numbers never become replies', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '999 %', tool_calls: [{ function: { arguments: '{"request":"lägg till en tabell"}' } }] } }] }) })
  expect(await chooseIntent('lägg till en tabell', settings, undefined, fetcher)).toMatchObject({ intent: { kind: 'add', card: 'table' }, fallback: false })
})
test('LLM wording is bounded; numbers and arbitrary prose are discarded', async () => {
  const reply = (wording: string) => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { tool_calls: [{ function: { name: 'assistant_action', arguments: JSON.stringify({ request: 'compare revenue', wording }) } }] } }] }) })
  expect((await chooseIntent('compare revenue', settings, undefined, reply('Här är jämförelsen.'))).wording).toBe('Här är jämförelsen.')
  expect((await chooseIntent('compare revenue', settings, undefined, reply('Revenue is ninety percent'))).wording).toBeUndefined()
  expect((await chooseIntent('compare revenue', settings, undefined, reply('999 %'))).wording).toBeUndefined()
})
test('eight-second timeout falls back and aborts the request', async () => {
  vi.useFakeTimers()
  let signal: AbortSignal | undefined
  try {
    const fetcher = vi.fn((_url, init) => { signal = init.signal; return new Promise<Response>(() => {}) })
    const pending = chooseIntent('watch margin', settings, undefined, fetcher)
    await vi.advanceTimersByTimeAsync(8000)
    expect(await pending).toMatchObject({ intent: { kind: 'watch' }, fallback: true, fallbackReason: 'timeout' })
    expect(signal?.aborted).toBe(true)
  } finally { vi.useRealTimers() }
})
test.each(['OpenAI', 'Anthropic', 'OpenRouter'] as const)('%s uses an explicit tool schema and never renders provider prose', async provider => {
  const tool = { name: 'assistant_action', arguments: '{"request":"visa marginal per produkt"}' }
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => provider === 'Anthropic' ? { content: [{ type: 'text', text: '999 %' }, { type: 'tool_use', name: tool.name, input: JSON.parse(tool.arguments) }] } : { choices: [{ message: { content: '999 %', tool_calls: [{ function: tool }] } }] } })
  const result = await chooseIntent('visa marginal per produkt', { ...settings, provider }, undefined, fetcher)
  expect(result).toMatchObject({ intent: { kind: 'marginProducts' }, fallback: false })
  const [url, init] = fetcher.mock.calls[0]
  expect(url).toContain(provider === 'Anthropic' ? 'api.anthropic.com' : provider === 'OpenAI' ? 'api.openai.com' : 'openrouter.ai')
  expect(JSON.parse(init.body).tools).toHaveLength(1)
  expect(JSON.stringify(result)).not.toContain('999')
})

test('provider HTTP errors and unsupported requests have different fallback reasons', async () => {
  const httpError = vi.fn().mockResolvedValue({ ok: false })
  expect(await chooseIntent('compare revenue', settings, undefined, httpError)).toMatchObject({ fallback: true, fallbackReason: 'error' })
  const unsupported = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { tool_calls: [{ function: { name: 'assistant_action', arguments: '{"request":"weather"}' } }] } }] }) })
  expect(await chooseIntent('compare revenue', settings, undefined, unsupported)).toMatchObject({ fallback: true, fallbackReason: 'not-understood' })
})
