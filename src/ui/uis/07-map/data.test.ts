import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from '../../../data/engine.node'
import type { SqlEngine } from '../../../data/engine'
import { generateDemoData } from '../../../data/generate'
import { loadRegions, dotRadius } from './data'

let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine(); await engine.loadOrderLines(generateDemoData()) })
afterAll(async () => { await engine?.close() })
test('regional SQL pools margin, counts distinct orders and exposes executable product mix', async () => {
  const regions = await loadRegions(engine, '2026-08')
  expect(regions.current.data).toHaveLength(5)
  expect(regions.current.data.every(row => row.delta !== null && row.delta < 0)).toBe(true)
  const [total] = await engine.query<{ revenue: number }>("SELECT SUM(revenue) AS revenue FROM sales WHERE strftime(date, '%Y-%m') = '2026-08'")
  expect(regions.current.data.reduce((sum, row) => sum + row.revenue, 0)).toBeCloseTo(total.revenue, 6)
  expect(await engine.query(regions.mix.sql)).toEqual(regions.mix.data)
  expect(regions.history.data.every(row => row.month <= '2026-08')).toBe(true)
})
test('dot areas, not radii, are proportional; unknown quantities stay invisible', () => {
  expect(dotRadius(400, 400) ** 2 / dotRadius(100, 400) ** 2).toBeCloseTo(4)
  expect(dotRadius(null, 400)).toBe(0)
  expect(dotRadius(0, 0)).toBe(0)
})
test('missing regional cost remains unknown rather than zero', async () => {
  const fixture = await createNodeEngine()
  try {
    await fixture.loadOrderLines([{ date: '2026-08-01', order_id: 'one', customer_id: 'one', product: "Linne'pläd", qty: 1, unit_price: 100, unit_cost: null, channel: 'Webb', region: 'Stockholm' }])
    const result = await loadRegions(fixture, '2026-08')
    expect(result.current.data[0].gross_margin_pct).toBeNull()
    expect(result.current.data[0].delta).toBeNull()
  } finally { await fixture.close() }
})
