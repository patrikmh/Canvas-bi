import type { SqlEngine } from '../data/engine'
import { findChangeStart, kpiSnapshot, marginWaterfall, monthlySeries, productBreakdown, unitEconomics } from '../data/metrics'
import type { MetricResult, ProductMetrics } from '../data/metrics'
import { literal } from '../data/sql'
import type { Metric } from '../canvas/layout'

export interface CountProductMetrics extends ProductMetrics { orders: number; compareOrders: number; customers: number; compareCustomers: number }

export function shiftMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  return date.toISOString().slice(0, 7)
}

export async function loadDashboard(engine: SqlEngine, month: string) {
  const before = [-4, -3, -2].map(offset => shiftMonth(month, offset))
  const after = [-1, 0].map(offset => shiftMonth(month, offset))
  const [snapshot, series, products, waterfall, start] = await Promise.all([
    kpiSnapshot(engine, month), monthlySeries(engine), productBreakdown(engine, month, shiftMonth(month, -12)),
    marginWaterfall(engine, before, after), findChangeStart(engine),
  ])
  const historySql = `SELECT * FROM (${series.sql}) WHERE month <= ${literal(month)} ORDER BY month DESC LIMIT 24`
  const history: typeof series = { ...series, sql: historySql, data: (await engine.query<typeof series.data[number]>(historySql)).reverse() }
  const storySql = `WITH steps AS (${waterfall.sql}), endpoints AS (
    SELECT MAX(value) FILTER (WHERE label = 'Före') AS before,
    MAX(value) FILTER (WHERE label = 'Nu') AS after,
    SUM(value) FILTER (WHERE kind = 'change' AND label <> 'Övriga') AS contributors FROM steps
  ) SELECT before, after, before - after AS drop,
    ROUND(100.0 * contributors / NULLIF(after - before, 0) / 5) * 5 AS share FROM endpoints`
  const [storyData] = await engine.query<{ before: number | null; after: number | null; drop: number | null; share: number | null }>(storySql)
  const story = { data: storyData, sql: storySql, formula: `${waterfall.formula} De största produktbidragens andel av förändringen avrundas till närmaste fem procent.` }
  const leadersSql = `WITH products AS (${products.sql}) SELECT *,
    ROW_NUMBER() OVER (ORDER BY "revenueDeltaPct" DESC NULLS LAST, product) AS rank FROM products ORDER BY rank`
  const leadersRows = await engine.query<ProductMetrics>(leadersSql)
  const leaders: MetricResult<{ best: ProductMetrics; worst: ProductMetrics }> = {
    data: { best: leadersRows[0], worst: leadersRows.at(-1)! }, sql: leadersSql, formula: products.formula,
  }
  const marginSql = `WITH products AS (${products.sql}) SELECT *,
    COALESCE("marginDeltaPp" <= -5, false) AS outlier FROM products ORDER BY margin DESC NULLS LAST, product`
  const marginProducts: MetricResult<(ProductMetrics & { outlier: boolean })[]> = {
    data: await engine.query(marginSql), sql: marginSql,
    formula: `${products.formula} Röd markering när marginalen minskat minst fem procentenheter.`,
  }
  const current = literal(month), previous = literal(shiftMonth(month, -12))
  const countsSql = `WITH counts AS (
    SELECT product,
      COUNT(DISTINCT order_id) FILTER (WHERE strftime(date, '%Y-%m') = ${current}) AS orders,
      COUNT(DISTINCT order_id) FILTER (WHERE strftime(date, '%Y-%m') = ${previous}) AS "compareOrders",
      COUNT(DISTINCT customer_id) FILTER (WHERE strftime(date, '%Y-%m') = ${current}) AS customers,
      COUNT(DISTINCT customer_id) FILTER (WHERE strftime(date, '%Y-%m') = ${previous}) AS "compareCustomers"
    FROM sales WHERE strftime(date, '%Y-%m') IN (${current}, ${previous}) GROUP BY product
  ), products AS (${products.sql}) SELECT p.*, c.orders, c."compareOrders", c.customers, c."compareCustomers"
    FROM products p JOIN counts c USING (product) ORDER BY orders DESC, product`
  const countProducts: MetricResult<CountProductMetrics[]> = {
    data: await engine.query(countsSql), sql: countsSql,
    formula: 'Ordrar = COUNT(DISTINCT order_id), kunder = COUNT(DISTINCT customer_id), per produkt och månad. En order eller kund med flera produkter kan ingå i flera produktgrupper.',
  }
  const economics = await Promise.all(waterfall.data.filter(step => step.kind === 'change' && step.label !== 'Övriga')
    .map(step => unitEconomics(engine, step.label, before, after).then(result => ({ ...result, product: step.label }))))
  return { month, before, after, snapshot, history, products, waterfall, story, leaders, marginProducts, countProducts, economics,
    changeStart: start.data && start.data <= month ? start.data : null }
}
export type Dashboard = Awaited<ReturnType<typeof loadDashboard>>
export function metricProducts(dashboard: Dashboard, metric: Metric) {
  return metric === 'margin' ? dashboard.marginProducts : metric === 'orders' || metric === 'customers' ? dashboard.countProducts : dashboard.products
}
