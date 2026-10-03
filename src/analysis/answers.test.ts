import { beforeAll, afterAll, expect, test } from 'vitest'
import { createNodeEngine } from '../data/engine.node'
import type { SqlEngine } from '../data/engine'
import { generateDemoData } from '../data/generate'
import { kpiSnapshot } from '../data/metrics'
import { comparisonAnswer, monthAnswer, priceClause } from './answers'
let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine(); await engine.loadOrderLines(generateDemoData()) })
afterAll(async () => { await engine.close() })
test.each(['orders', 'customers', 'margin'] as const)('selected %s comparison retains metric and units', async metric => {
  const result = await kpiSnapshot(engine, '2026-08')
  const text = comparisonAnswer(metric, '2026-08', result.data)
  expect(text).toContain(metric === 'orders' ? 'Ordrar' : metric === 'customers' ? 'Kunder' : 'Bruttomarginal')
  expect(text).not.toContain('tkr')
  expect(text).toContain(metric === 'margin' ? 'p.e.' : '%')
})
test.each(['revenue', 'margin', 'orders', 'customers'] as const)('%s month questions choose the latest available year, even beyond the selected month', async metric => {
  expect((await monthAnswer(engine, 12, metric)).month).toBe('2025-12')
  expect((await monthAnswer(engine, 7, metric)).month).toBe('2026-07')
  expect((await monthAnswer(engine, 12, metric)).text).not.toContain('saknar underlag')
})
test('price stability is based on every SQL price change with a strict two percent boundary', () => {
  expect(priceClause([{ product: 'A', priceChangePct: 1.9 }, { product: 'B', priceChangePct: -1.9 }])).toContain('priset är i stort sett oförändrat')
  expect(priceClause([{ product: 'A', priceChangePct: 2 }])).toContain('+2,0')
  expect(priceClause([{ product: 'A', priceChangePct: -4 }])).toContain('−4,0')
  expect(priceClause([{ product: 'A', priceChangePct: null }])).not.toContain('oförändrat')
  expect(priceClause([])).not.toContain('oförändrat')
})
