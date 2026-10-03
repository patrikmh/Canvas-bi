import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from '../data/engine.node'
import type { SqlEngine } from '../data/engine'
import { generateDemoData } from '../data/generate'
import { loadDashboard } from './dashboard'
import { fmtDeltaPct, fmtPct, fmtTkr } from '../data/format'

let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine(); await engine.loadOrderLines(generateDemoData()) })
afterAll(async () => { await engine?.close() })

test('dashboard story and product ranking come from executable SQL', async () => {
  const dashboard = await loadDashboard(engine, '2026-08')
  expect(fmtTkr(dashboard.snapshot.data.revenue.current)).toBe('503\u00a0tkr')
  expect(dashboard.story.data.share).toBe(95)
  expect(fmtPct(dashboard.story.data.drop)).toBe('6,4\u00a0%')
  expect(dashboard.leaders.data.best.product).toBe('Bordsduk')
  expect(fmtDeltaPct(dashboard.leaders.data.best.revenueDeltaPct)).toBe('+57,0\u00a0%')
  expect(dashboard.marginProducts.data.filter(row => row.outlier).map(row => row.product).sort()).toEqual(['Linnepläd', 'Ullfilt'])
  expect(await engine.query(dashboard.story.sql)).toHaveLength(1)
  expect(dashboard.history.data).toHaveLength(24)
})

test('period changes reload every metric and bound the chart and waterfall to that month', async () => {
  const august = await loadDashboard(engine, '2026-08')
  const june = await loadDashboard(engine, '2026-06')
  expect(june.snapshot.data.month).toBe('2026-06')
  expect(june.snapshot.data.revenue.current).not.toBe(august.snapshot.data.revenue.current)
  expect(june.history.data.at(-1)?.month).toBe('2026-06')
  expect(june.before).toEqual(['2026-02', '2026-03', '2026-04'])
  expect(june.after).toEqual(['2026-05', '2026-06'])
  expect(june.changeStart).toBeNull()
  expect(june.products.sql).toContain("'2026-06'")
  expect(june.economics.every(result => result.sql.includes("'2026-06'"))).toBe(true)
})

test('order and customer product drill-down use distinct counts rather than revenue', async () => {
  const dashboard = await loadDashboard(engine, '2026-08')
  const [expected] = await engine.query<{ orders: number; customers: number }>("SELECT COUNT(DISTINCT order_id) AS orders, COUNT(DISTINCT customer_id) AS customers FROM sales WHERE product = 'Ullfilt' AND strftime(date, '%Y-%m') = '2026-08'")
  expect(dashboard.countProducts.data.find(row => row.product === 'Ullfilt')).toMatchObject(expected)
  expect(dashboard.countProducts.sql).toContain('COUNT(DISTINCT order_id)')
  expect(await engine.query(dashboard.countProducts.sql)).toHaveLength(12)
})
