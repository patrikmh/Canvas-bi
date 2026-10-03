import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from '../../data/engine.node'
import type { SqlEngine } from '../../data/engine'
import { detectMapping } from '../../data/mapping'
import { loadMappedData, parseCsvText } from '../../data/upload'
import { runAgent } from '../../analysis/agent'
import { generateDemoData } from '../../data/generate'
import { loadMappedUpload } from '../../data/engine.upload'
import { loadDashboard } from '../../analysis/dashboard'

let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine() })
afterAll(async () => { await engine.close() })
async function load(name: string, assumedMarginPct?: number) {
  const parsed = parseCsvText(readFileSync(`e2e/fixtures/${name}.csv`, 'utf8'))
  return loadMappedData(engine, parsed, detectMapping(parsed.headers, parsed.rows), { assumedMarginPct })
}

test('missing cost stops margin tools with an observable failed cost check and preserves revenue', async () => {
  const dataset = await load('utan-kostnad')
  const queries: string[] = []
  const checked = { ...engine, query: async <T,>(sql: string) => { queries.push(sql); return engine.query<T>(sql) } }
  const result = await runAgent(checked, dataset.months.at(-1)!, { fast: true })
  expect(result.steps.find(step => step.label === 'Kontrollerar att kostnad finns')).toMatchObject({ status: 'failed' })
  expect(result.text).toContain('utan kostnad')
  expect(result.text).toContain('Omsättning')
  expect(result.text).not.toMatch(/\d[,.]\d\s*%/)
  expect(result.steps.some(step => /marginWaterfall|unitEconomics/.test(step.tool))).toBe(false)
  expect(queries.some(sql => sql.includes('before_margin'))).toBe(false)
})

test('explicit assumption produces SQL-backed margin but never a cost cause claim', async () => {
  const dataset = await load('utan-kostnad', 50)
  const result = await runAgent(engine, dataset.months.at(-1)!, { fast: true, dataset })
  expect(result.text).toContain('ANTAGANDE')
  expect(result.text).toMatch(/50,0\s*%/)
  expect(result.text).not.toContain('inköpskostnaden per styck ökat')
  expect(result.steps.some(step => /marginWaterfall|unitEconomics/.test(step.tool))).toBe(false)
})

test('few rows retain low confidence after upload', async () => {
  const dataset = await load('fa-rader')
  expect((await runAgent(engine, dataset.months.at(-1)!, { fast: true, dataset })).confidence).toBe('Låg säkerhet')
})

test('agent revenue trace uses season-aware baseline rather than a January seasonal dip', async () => {
  await engine.loadOrderLines(generateDemoData())
  const result = await runAgent(engine, '2026-08', { metric: 'revenue', fast: true })
  expect(result.steps[1].summary).toBe('Ingen tydlig brytpunkt hittades.')
})

test('uploads without product or identifiers still build a revenue dashboard without invented segmentation', async () => {
  const parsed = { headers: ['date', 'amount', 'cost'], rows: Array.from({ length: 14 }, (_, index) => [new Date(Date.UTC(2025, index, 28)).toISOString().slice(0, 10), '100', '50']) }
  const dataset = await loadMappedUpload(engine, parsed, { date: 'date', revenue: 'amount', cost: 'cost' }, 'totals.csv')
  await expect(loadDashboard(engine, dataset.months.at(-1)!)).resolves.toMatchObject({ snapshot: { data: { revenue: { current: 100 } } } })
  const result = await runAgent(engine, dataset.months.at(-1)!, { fast: true, dataset })
  expect(result.text).toContain('Produktkolumn saknas')
  expect(result.steps.some(step => step.tool === 'unitEconomics')).toBe(false)
})
