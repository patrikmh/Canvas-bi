import type { SqlEngine } from '../../../data/engine'
import type { MonthlyMetrics, MetricResult } from '../../../data/metrics'
import { literal } from '../../../data/sql'

export interface RegionRow extends MonthlyMetrics { region: string; delta: number | null }
export interface MixRow { region: string; product: string; revenue: number; share: number }
const pooled = `CASE WHEN COUNT(cost)=COUNT(*) THEN 100.0*(SUM(revenue)-SUM(cost))/NULLIF(SUM(revenue),0) END`
export async function loadRegions(engine: SqlEngine, month: string) {
  const monthly = `SELECT region, strftime(date,'%Y-%m') AS month, SUM(revenue) AS revenue,
    CASE WHEN COUNT(cost)=COUNT(*) THEN SUM(cost) END AS cost, ${pooled} AS gross_margin_pct,
    COUNT(DISTINCT order_id) AS orders, COUNT(DISTINCT customer_id) AS customers
    FROM sales GROUP BY region, month`
  const historySql = `WITH monthly AS (${monthly}) SELECT *, gross_margin_pct-LAG(gross_margin_pct,12) OVER(PARTITION BY region ORDER BY month) AS delta FROM monthly WHERE month<=${literal(month)} ORDER BY month,region`
  const currentSql = `SELECT * FROM (${historySql}) WHERE month=${literal(month)} ORDER BY region`
  const mixSql = `WITH products AS (SELECT region,product,SUM(revenue) AS revenue FROM sales WHERE strftime(date,'%Y-%m')=${literal(month)} GROUP BY region,product)
    SELECT *,100.0*revenue/NULLIF(SUM(revenue) OVER(PARTITION BY region),0) AS share FROM products ORDER BY region,revenue DESC,product`
  const formula = 'Poolad marginal; unika ordrar per region och månad. Förändring mot samma månad i fjol. Saknad kostnad ger okänd marginal.'
  const [history, current, mix] = await Promise.all([engine.query<RegionRow>(historySql), engine.query<RegionRow>(currentSql), engine.query<MixRow>(mixSql)])
  return { history: { data: history, sql: historySql, formula } satisfies MetricResult<RegionRow[]>, current: { data: current, sql: currentSql, formula }, mix: { data: mix, sql: mixSql, formula: 'Produktmix som andel av regionens omsättning.' } }
}
export function dotRadius(value: number | null, max: number) {
  return value == null || value <= 0 || max <= 0 ? 0 : 24 * Math.sqrt(value / max)
}
