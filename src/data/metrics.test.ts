import { createHash } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from './engine.node'
import type { SqlEngine } from './engine'
import { generateDemoData } from './generate'
import { fmtTkr, fmtPct, fmtDeltaPct, fmtPp, fmtInt } from './format'
import { monthlySeries, kpiSnapshot, productBreakdown, marginWaterfall, findChangeStart, unitEconomics, ordersFor, latestCompleteMonth } from './metrics'

const before = ['2026-04', '2026-05', '2026-06']
const after = ['2026-07', '2026-08']
let engine: SqlEngine
beforeAll(async () => {
  engine = await createNodeEngine()
  await engine.loadOrderLines(generateDemoData())
})
afterAll(async () => { await engine?.close() })

test('seeded data has 36 months, all dimensions and a reproducible hash', () => {
  const rows = generateDemoData()
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  expect(hash(rows)).toBe(hash(generateDemoData()))
  expect(hash(rows)).not.toBe(hash(generateDemoData(42)))
  expect(rows.length).toBeGreaterThanOrEqual(10_000)
  expect(rows.length).toBeLessThan(60_000)
  expect(new Set(rows.map(row => row.date.slice(0, 7))).size).toBe(36)
  expect(new Set(rows.map(row => row.product)).size).toBe(12)
  expect(new Set(rows.map(row => row.channel)).size).toBe(3)
  expect(new Set(rows.map(row => row.region)).size).toBe(5)
})

test('August KPIs reproduce every formatted story number from real SQL', async () => {
  const result = await kpiSnapshot(engine, '2026-08')
  const kpi = result.data
  expect(fmtTkr(kpi.revenue.current)).toBe('503\u00a0tkr')
  expect(fmtDeltaPct(kpi.revenue.deltaYoY)).toBe('+9,7\u00a0%')
  expect(fmtDeltaPct(kpi.revenue.deltaMoM)).toBe('−4,0\u00a0%')
  expect(fmtPct(kpi.margin.current)).toBe('44,7\u00a0%')
  expect(fmtPct(kpi.margin.lastYear)).toBe('51,2\u00a0%')
  expect(fmtPp(kpi.margin.deltaYoY)).toBe('−6,5\u00a0p.e.')
  expect(fmtInt(kpi.orders.current)).toBe('793')
  expect(fmtDeltaPct(kpi.orders.deltaYoY)).toBe('+10,0\u00a0%')
  expect(fmtInt(kpi.customers.current)).toBe('627')
  expect(fmtDeltaPct(kpi.customers.deltaYoY)).toBe('+9,8\u00a0%')
  expect(await engine.query(result.sql)).toHaveLength(1)
  expect(result.formula).toContain('föregående')
})

test('pooled margin waterfall reconciles within 1e-9 and attributes 95% to the two products', async () => {
  const { data } = await marginWaterfall(engine, before, after)
  expect(data.map(step => step.label)).toEqual(['Före', 'Ullfilt', 'Linnepläd', 'Övriga', 'Nu'])
  expect(fmtPct(data[0].value)).toBe('51,1\u00a0%')
  expect(fmtPct(data[4].value)).toBe('44,7\u00a0%')
  expect(data.slice(1, 4).map(step => fmtPp(step.value))).toEqual(['−3,4\u00a0p.e.', '−2,7\u00a0p.e.', '−0,3\u00a0p.e.'])
  const drop = data[4].value - data[0].value
  expect(Math.abs(data.slice(1, 4).reduce((sum, step) => sum + step.value, 0) - drop)).toBeLessThan(1e-9)
  const share = (data[1].value + data[2].value) / drop
  expect(share).toBeGreaterThan(0.93)
  expect(share).toBeLessThan(0.97)
  expect(Math.round(share * 100 / 5) * 5).toBe(95)
})

test('unit economics and structural change start explain the margin break', async () => {
  for (const product of ['Ullfilt', 'Linnepläd']) {
    const { data } = await unitEconomics(engine, product, before, after)
    expect(Math.round(data.costChangePct!)).toBe(28)
    expect(Math.abs(data.priceChangePct!)).toBeLessThan(1)
  }
  expect((await findChangeStart(engine)).data).toBe('2026-07')
  expect((await latestCompleteMonth(engine)).data).toBe('2026-08')
})

test('product breakdown reproduces growth leaders and product margin deltas', async () => {
  const { data } = await productBreakdown(engine, '2026-08', '2025-08')
  expect(data.slice(0, 2).map(row => row.product)).toEqual(['Ullfilt', 'Linnepläd'])
  const growth = [...data].sort((a, b) => b.revenueDeltaPct! - a.revenueDeltaPct!)
  expect(growth[0].product).toBe('Bordsduk')
  expect(fmtDeltaPct(growth[0].revenueDeltaPct)).toBe('+57,0\u00a0%')
  expect(growth.at(-1)!.product).toBe('Tvålpump')
  expect(fmtDeltaPct(growth.at(-1)!.revenueDeltaPct)).toBe('−11,9\u00a0%')
  expect(fmtPp(data.find(row => row.product === 'Linnepläd')!.marginDeltaPp)).toBe('−14,3\u00a0p.e.')
  expect(fmtPp(data.find(row => row.product === 'Ullfilt')!.marginDeltaPp)).toBe('−14,2\u00a0p.e.')
  expect(data.filter(row => !['Ullfilt', 'Linnepläd'].includes(row.product)).every(row => Math.abs(row.marginDeltaPp!) <= 2)).toBe(true)
})

test('monthly series and drill-down expose canonical numeric rows', async () => {
  const { data } = await monthlySeries(engine)
  expect(data).toHaveLength(36)
  expect(data[0].month).toBe('2023-09')
  expect(data.at(-1)!.orders).toBe(793)
  expect(data.find(row => row.month === '2025-12')!.revenue).toBeGreaterThan(data.find(row => row.month === '2025-07')!.revenue)
  const orders = await ordersFor(engine, 'Ullfilt', '2026-08')
  expect(orders.data.length).toBeGreaterThan(0)
  expect(orders.data.every(row => row.product === 'Ullfilt' && row.date.startsWith('2026-08'))).toBe(true)
  expect(typeof orders.data[0].qty).toBe('number')
})

test('product margins have a realistic spread and the reference ranking before the cost increase', async () => {
  const { data } = await productBreakdown(engine, '2025-08', '2024-08')
  const ranked = [...data].sort((a, b) => b.margin! - a.margin!)
  expect(ranked[0].margin! - ranked.at(-1)!.margin!).toBeGreaterThanOrEqual(15)
  expect(ranked.slice(0, 3).map(row => row.product)).toEqual(['Tvålpump', 'Doftljus', 'Vas i glas'])
  expect(ranked.slice(0, 3).every(row => row.margin! >= 58 && row.margin! <= 63)).toBe(true)
  expect(ranked.at(-1)!.product).toBe('Serveringsbricka')
  for (const product of ['Ullfilt', 'Linnepläd']) {
    expect(data.find(row => row.product === product)!.margin!).toBeGreaterThan(48)
    expect(data.find(row => row.product === product)!.margin!).toBeLessThan(51)
  }
})

test('product growth is varied and revenue mix drifts throughout the window', async () => {
  const { data } = await productBreakdown(engine, '2026-08', '2025-08')
  const rest = data.filter(row => !['Bordsduk', 'Tvålpump'].includes(row.product)).map(row => row.revenueDeltaPct!)
  expect(new Set(rest.map(value => value.toFixed(1))).size).toBeGreaterThanOrEqual(8)
  expect(Math.max(...rest) - Math.min(...rest)).toBeGreaterThan(15)
  expect(rest.every(value => value >= -5.1 && value <= 20.1)).toBe(true)
  const mixes = await engine.query<{ product: string; variations: number; max_step: number }>(`
    WITH products AS (
      SELECT strftime(date, '%Y-%m') AS month, product, SUM(revenue) AS revenue FROM sales GROUP BY month, product
    ), shares AS (
      SELECT month, product, revenue / SUM(revenue) OVER (PARTITION BY month) AS share FROM products
    ), changes AS (
      SELECT *, ABS(share - LAG(share) OVER (PARTITION BY product ORDER BY month)) AS step FROM shares
    ) SELECT product, COUNT(DISTINCT ROUND(share, 4)) AS variations, MAX(step) AS max_step
      FROM changes GROUP BY product`)
  expect(mixes).toHaveLength(12)
  expect(mixes.every(row => row.variations >= 18 && row.max_step < .04)).toBe(true)
})

test('monthly revenue contains seeded noise beyond seasonality and margin visibly wiggles', async () => {
  const [stats] = await engine.query<{ revenue_change_std: number; margin_std: number; distinct_margins: number }>(`
    WITH monthly AS (${(await monthlySeries(engine)).sql}), changes AS (
      SELECT *, 100 * (revenue / LAG(revenue) OVER (ORDER BY month) - 1) AS change FROM monthly
    ) SELECT STDDEV_POP(change) FILTER (WHERE month NOT IN ('2025-08', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08')) AS revenue_change_std,
      STDDEV_POP(gross_margin_pct) FILTER (WHERE month < '2026-07') AS margin_std,
      COUNT(DISTINCT ROUND(gross_margin_pct, 3)) FILTER (WHERE month < '2026-07') AS distinct_margins FROM changes`)
  expect(stats.revenue_change_std).toBeGreaterThan(2)
  expect(stats.margin_std).toBeGreaterThan(.2)
  expect(stats.margin_std).toBeLessThan(1.5)
  expect(stats.distinct_margins).toBeGreaterThanOrEqual(24)
  const residuals = await engine.query<{ residual_pct: number }>(`
    WITH monthly AS (${(await monthlySeries(engine)).sql}), seasons(month_no, factor) AS (
      VALUES (1,.99),(2,.97),(3,1.04),(4,1.02),(5,1.04),(6,.95),(7,.91),(8,.88),(9,1.0),(10,1.08),(11,1.36),(12,1.52)
    ) SELECT ABS(100 * (revenue / (503000 / .88 * factor * POW(1.097,
      date_diff('month', DATE '2026-08-01', (month || '-01')::DATE) / 12.0)) - 1)) AS residual_pct
    FROM monthly JOIN seasons ON month_no = MONTH((month || '-01')::DATE)
    WHERE month NOT IN ('2025-08', '2026-07', '2026-08')`)
  expect(residuals).toHaveLength(33)
  expect(residuals.every(row => row.residual_pct >= 2.9 && row.residual_pct <= 6.1)).toBe(true)
})
