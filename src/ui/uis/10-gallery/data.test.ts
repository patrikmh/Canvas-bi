import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from '../../../data/engine.node'
import type { SqlEngine } from '../../../data/engine'
import { generateDemoData } from '../../../data/generate'
import { loadCatalogue, sortProducts, category } from './data'
import { productBreakdown } from '../../../data/metrics'

let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine(); await engine.loadOrderLines(generateDemoData()) })
afterAll(async () => { await engine?.close() })
test('catalogue SQL supplies every product, weighted economics and all reconciled contributions', async () => {
  const result = await loadCatalogue(engine, '2026-08', ['2026-04', '2026-05', '2026-06'], ['2026-07', '2026-08'])
  expect(new Set(result.economics.data.map(row => row.product)).size).toBe(12)
  const [weighted] = await engine.query<{ price: number }>("SELECT SUM(revenue)/SUM(qty) AS price FROM sales WHERE product='Ullfilt' AND strftime(date,'%Y-%m')='2026-08'")
  expect(result.economics.data.find(row => row.product === 'Ullfilt' && row.month === '2026-08')?.price).toBeCloseTo(weighted.price, 8)
  expect(result.contributions.data.filter(row => row.kind === 'change' && row.label !== 'Övriga')).toHaveLength(12)
  const rows = (await productBreakdown(engine, '2026-08', '2025-08')).data
  expect(sortProducts(rows, 'bidrag', result.contributions.data)[0].product).toBe('Ullfilt')
  expect(sortProducts(rows, 'avvikelse', result.contributions.data)[0].product).toBe('Linnepläd')
  expect(sortProducts(rows, 'omsättning', result.contributions.data)[0].product).toBe('Ullfilt')
  expect(sortProducts(rows, 'marginal', result.contributions.data)[0].product).toBe('Linnepläd')
  expect(await engine.query(result.economics.sql)).toEqual(result.economics.data)
})
test('unknown deviation sorts last and categories describe the catalogue, not inferred facts', () => {
  const row = { product: 'A', revenue: 1, compareRevenue: 1, margin: null, compareMargin: null, revenueDeltaPct: null, marginDeltaPp: null }
  expect(sortProducts([row, { ...row, product: 'B', marginDeltaPp: -1 }], 'avvikelse', [])[0].product).toBe('B')
  expect(category('Ullfilt')).toBe('Textil')
  expect(category('Tvålpump')).toBe('Hemdetaljer')
})
