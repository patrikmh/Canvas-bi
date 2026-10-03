import type { Intent } from './intents'
import { matchIntent } from './intents'
import type { Metric } from '../canvas/layout'
export interface LlmSettings { provider: 'OpenAI' | 'Anthropic' | 'OpenRouter'; model: string; key: string; enabled: boolean }
// Bounded wording prevents even spelled-out model-generated numbers from reaching the UI.
export const wordingOptions = ['Här är resultatet.', 'Vi kan titta närmare på utvecklingen.', 'Här är jämförelsen.', 'Jag visar underlaget för dig.'] as const
export const LLM_STORAGE_KEY = 'canvas-bi-llm'
export const defaultSettings: LlmSettings = { provider: 'OpenAI', model: '', key: '', enabled: false }
export function readSettings(): LlmSettings {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(LLM_STORAGE_KEY) ?? '{}') } } catch { return defaultSettings }
}
export async function chooseIntent(text: string, settings: LlmSettings, context?: Metric, fetcher: typeof fetch = fetch): Promise<{ intent: Intent; fallback: boolean; wording?: string }> {
  const offline = matchIntent(text, context)
  if (!settings.enabled || !settings.key) return { intent: offline, fallback: false }
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const description = 'Choose one supported action by returning a Swedish or English request: explore margin; explain margin change; compare revenue; margin/revenue by product; watch margin; build dashboard; add/remove table, trend, bars, waterfall, insight, text, kpi; margin in month; formula. Never compute numbers. No arbitrary SQL.'
    const schema = { type: 'object', properties: { request: { type: 'string', description }, wording: { type: 'string', enum: wordingOptions, description: 'Optional introduction. All factual text and numbers will be filled from local tool results.' } }, required: ['request'], additionalProperties: false }
    const anthropic = settings.provider === 'Anthropic'
    const url = anthropic ? 'https://api.anthropic.com/v1/messages' : settings.provider === 'OpenRouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions'
    const headers: Record<string, string> = anthropic ? { 'content-type': 'application/json', 'x-api-key': settings.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } : { 'content-type': 'application/json', Authorization: `Bearer ${settings.key}` }
    const body = { model: settings.model, messages: [{ role: 'user', content: `${text}\nSelected metric: ${context ?? 'none'}` }], ...(anthropic ? { max_tokens: 256, tools: [{ name: 'assistant_action', description, input_schema: schema }], tool_choice: { type: 'tool', name: 'assistant_action' } } : { tools: [{ type: 'function', function: { name: 'assistant_action', description, parameters: schema } }], tool_choice: { type: 'function', function: { name: 'assistant_action' } } }) }
    const operation = async () => {
      const response = await fetcher(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
      if (!response.ok) throw new Error('Provider error')
      const data = await response.json()
      const tool = anthropic ? data.content?.find((item: { type: string }) => item.type === 'tool_use') : data.choices?.[0]?.message?.tool_calls?.[0]?.function
      if (tool?.name && tool.name !== 'assistant_action') throw new Error('Unsupported tool')
      const args = anthropic ? tool?.input : JSON.parse(tool?.arguments ?? '{}')
      if (typeof args.request !== 'string' || args.request.length > 500) throw new Error('Invalid tool')
      const intent = matchIntent(args.request, context)
      if (intent.kind === 'unknown') throw new Error('Unsupported tool')
      // Render the deterministic tool response; provider prose can never introduce invented figures.
      const wording = wordingOptions.find(option => option === args.wording)
      return { intent, fallback: false, wording }
    }
    return await Promise.race([operation(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Timeout')) }, 8000) })])
  } catch { return { intent: offline, fallback: true } } finally { if (timer) clearTimeout(timer) }
}
