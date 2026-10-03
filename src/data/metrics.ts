import type { SqlEngine } from './engine'
import type { OrderLine } from './types'
import { literal } from './sql'

export interface MetricResult<T> { data: T; sql: string; formula: string }
export interface MonthlyMetrics {
  month: string
  revenue: number
  cost: number | null
  gross_margin_pct: number | null
  orders: number
  customers: number
}
export interface KpiComparison {
  current: number | null
  lastYear: number | null
  previousMonth: number | null
  deltaYoY: number | null
  deltaMoM: number | null
}
export interface KpiSnapshot {
  month: string
  revenue: KpiComparison
  margin: KpiComparison
  orders: KpiComparison
  customers: KpiComparison
}
export interface ProductMetrics {
  product: string
  revenue: number
  compareRevenue: number
  margin: number | null
  compareMargin: number | null
  revenueDeltaPct: number | null
  marginDeltaPp: number | null
}
export interface WaterfallStep { label: string; value: number; kind: 'total' | 'change' }
export interface UnitEconomics {
  priceBefore: number | null
  priceAfter: number | null
  costBefore: number | null
  costAfter: number | null
  priceChangePct: number | null
  costChangePct: number | null
}

const margin = `CASE WHEN COUNT(cost) = COUNT(*) THEN
  100.0 * (SUM(revenue) - SUM(cost)) / NULLIF(SUM(revenue), 0) END`
const cost = `CASE WHEN COUNT(cost) = COUNT(*) THEN SUM(cost) END`
const monthlySql = `SELECT strftime(date, '%Y-%m') AS month,
  SUM(revenue) AS revenue, ${cost} AS cost, ${margin} AS gross_margin_pct,
  COUNT(DISTINCT order_id) AS orders, COUNT(DISTINCT customer_id) AS customers
FROM sales GROUP BY month`

function monthLiteral(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Ogiltig månad')
  return literal(month)
}
function monthsList(months: string[]) {
  if (!months.length) throw new Error('Välj minst en månad')
  return months.map(monthLiteral).join(', ')
}
async function execute<T>(engine: SqlEngine, sql: string, formula: string): Promise<MetricResult<T[]>> {
  return { data: await engine.query<T>(sql), sql, formula }
}

export function monthlySeries(engine: SqlEngine) {
  return execute<MonthlyMetrics>(engine, `${monthlySql} ORDER BY month`,
    'Omsättning = Σ antal × styckpris. Kostnad = Σ antal × styckkostnad. Bruttomarginal = (omsättning − kostnad) / omsättning × 100. Ordrar och kunder räknas unikt per månad. Saknad kostnad ger okänd marginal.')
}

export async function kpiSnapshot(engine: SqlEngine, month: string): Promise<MetricResult<KpiSnapshot>> {
  const selected = monthLiteral(month)
  const fields = ['revenue', 'gross_margin_pct', 'orders', 'customers']
  const comparisons = fields.flatMap(field => [
    `MAX(CASE WHEN month = ${selected} THEN ${field} END) AS ${field}_current`,
    `MAX(CASE WHEN month = strftime(${literal(`${month}-01`)}::DATE - INTERVAL '1 year', '%Y-%m') THEN ${field} END) AS ${field}_year`,
    `MAX(CASE WHEN month = strftime(${literal(`${month}-01`)}::DATE - INTERVAL '1 month', '%Y-%m') THEN ${field} END) AS ${field}_previous`,
  ])
  const deltas = fields.flatMap(field => ['year', 'previous'].map(period => field === 'gross_margin_pct'
    ? `${field}_current - ${field}_${period} AS ${field}_${period}_delta`
    : `100.0 * (${field}_current - ${field}_${period}) / NULLIF(${field}_${period}, 0) AS ${field}_${period}_delta`))
  const sql = `WITH monthly AS (${monthlySql}), comparison AS (
  SELECT ${comparisons.join(',\n    ')} FROM monthly
) SELECT *, ${deltas.join(',\n  ')} FROM comparison`
  const [row] = await engine.query<Record<string, number | null>>(sql)
  const comparison = (field: string): KpiComparison => ({
    current: row[`${field}_current`], lastYear: row[`${field}_year`], previousMonth: row[`${field}_previous`],
    deltaYoY: row[`${field}_year_delta`], deltaMoM: row[`${field}_previous_delta`],
  })
  return {
    data: { month, revenue: comparison('revenue'), margin: comparison('gross_margin_pct'), orders: comparison('orders'), customers: comparison('customers') }, sql,
    formula: 'Nyckeltal per månad; jämförelse med samma månad föregående år och föregående månad. Förändring = (nu − då) / då × 100. Marginalens förändring anges i procentenheter. Bruttomarginal = (Σ omsättning − Σ kostnad) / Σ omsättning × 100. Ordrar och kunder räknas unikt.',
  }
}

export function productBreakdown(engine: SqlEngine, month: string, compareMonth: string) {
  const sql = `WITH products AS (
  SELECT product, strftime(date, '%Y-%m') AS month, SUM(revenue) AS revenue, ${margin} AS margin
  FROM sales WHERE strftime(date, '%Y-%m') IN (${monthLiteral(month)}, ${monthLiteral(compareMonth)})
  GROUP BY product, month
), paired AS (
  SELECT product,
    COALESCE(MAX(revenue) FILTER (WHERE month = ${monthLiteral(month)}), 0) AS revenue,
    COALESCE(MAX(revenue) FILTER (WHERE month = ${monthLiteral(compareMonth)}), 0) AS "compareRevenue",
    MAX(margin) FILTER (WHERE month = ${monthLiteral(month)}) AS margin,
    MAX(margin) FILTER (WHERE month = ${monthLiteral(compareMonth)}) AS "compareMargin"
  FROM products GROUP BY product
) SELECT *, 100.0 * (revenue - "compareRevenue") / NULLIF("compareRevenue", 0) AS "revenueDeltaPct",
  margin - "compareMargin" AS "marginDeltaPp"
FROM paired ORDER BY revenue DESC, product`
  return execute<ProductMetrics>(engine, sql,
    'Omsättning och bruttomarginal summeras per produkt och period. Omsättningsförändring = (nu − då) / då × 100. Marginalförändring = marginal nu − marginal då, i procentenheter.')
}

function periodsSql(beforeMonths: string[], afterMonths: string[]) {
  if (beforeMonths.some(month => afterMonths.includes(month))) throw new Error('Perioderna får inte överlappa')
  return `SELECT *, CASE WHEN strftime(date, '%Y-%m') IN (${monthsList(beforeMonths)}) THEN 'before' ELSE 'after' END AS period
  FROM sales WHERE strftime(date, '%Y-%m') IN (${monthsList([...beforeMonths, ...afterMonths])})`
}

export function marginWaterfall(engine: SqlEngine, beforeMonths: string[], afterMonths: string[], topN = 2) {
  if (!Number.isInteger(topN) || topN < 1) throw new Error('topN måste vara ett positivt heltal')
  const sql = `WITH periods AS (${periodsSql(beforeMonths, afterMonths)}), totals AS (
  SELECT period, SUM(revenue) AS revenue, ${margin} AS margin FROM periods GROUP BY period
), endpoints AS (
  SELECT MAX(margin) FILTER (WHERE period = 'before') AS before_margin,
         MAX(margin) FILTER (WHERE period = 'after') AS after_margin FROM totals
), products AS (
  SELECT product, period, SUM(revenue) AS revenue, ${margin} AS margin
  FROM periods GROUP BY product, period
), contributions AS (
  SELECT product,
    COALESCE(SUM(p.revenue / NULLIF(t.revenue, 0) * p.margin) FILTER (WHERE p.period = 'after'), 0)
    - COALESCE(SUM(p.revenue / NULLIF(t.revenue, 0) * p.margin) FILTER (WHERE p.period = 'before'), 0) AS value
  FROM products p JOIN totals t USING (period) GROUP BY product
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY ABS(value) DESC, product) AS rank FROM contributions
), steps AS (
  SELECT 'Före' AS label, before_margin AS value, 'total' AS kind, 0 AS position FROM endpoints
  UNION ALL SELECT product, value, 'change', rank FROM ranked WHERE rank <= ${topN}
  UNION ALL SELECT 'Övriga', COALESCE(SUM(value), 0), 'change', ${topN + 1} FROM ranked WHERE rank > ${topN}
  UNION ALL SELECT 'Nu', after_margin, 'total', ${topN + 2} FROM endpoints
) SELECT label, value, kind FROM steps CROSS JOIN endpoints
WHERE before_margin IS NOT NULL AND after_margin IS NOT NULL ORDER BY position`
  return execute<WaterfallStep>(engine, sql,
    'Periodernas marginal räknas på poolad omsättning och kostnad. Produktbidrag = omsättningsandel efter × produktmarginal efter − omsättningsandel före × produktmarginal före. Bidragen inkluderar mix och marginal och summerar exakt till Nu − Före. Övriga samlar resterande produkter.')
}

/** Margin steps use month/month; other metrics use season-aware, bidirectional baselines. */
export async function findChangeStart(engine: SqlEngine, metric: keyof Omit<MonthlyMetrics, 'month' | 'cost'> = 'gross_margin_pct') {
  if (!['revenue', 'gross_margin_pct', 'orders', 'customers'].includes(metric)) throw new Error('Okänt nyckeltal')
  const sql = metric === 'gross_margin_pct' ? `WITH monthly AS (${monthlySql}), changes AS (
  SELECT month, ${metric} AS value, LAG(${metric}) OVER (ORDER BY month) AS previous FROM monthly
) SELECT month FROM changes WHERE value - previous <= -5 ORDER BY month LIMIT 1` :
    `WITH monthly AS (${monthlySql}), history AS (
  SELECT date_diff('month', MIN((month || '-01')::DATE), MAX((month || '-01')::DATE)) AS span FROM monthly
), baselines AS (
  SELECT m.month, m.${metric} AS value, y.${metric} AS last_year,
    AVG(m.${metric}) OVER (ORDER BY m.month ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS rolling,
    COUNT(*) OVER (ORDER BY m.month ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS prior_count
  FROM monthly m LEFT JOIN monthly y ON y.month = strftime((m.month || '-01')::DATE - INTERVAL '1 year', '%Y-%m')
), growth AS (
  SELECT *, value / NULLIF(last_year, 0) AS annual_ratio,
    AVG(value / NULLIF(last_year, 0)) OVER (ORDER BY month ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) AS prior_annual_ratio
  FROM baselines
), changes AS (
  SELECT *, CASE WHEN span >= 12 THEN last_year * COALESCE(prior_annual_ratio, 1) WHEN prior_count = 3 THEN rolling END AS baseline
  FROM growth CROSS JOIN history
) SELECT month FROM changes WHERE ABS(value - baseline) / NULLIF(ABS(baseline), 0) >= 0.2
ORDER BY month LIMIT 1`
  const rows = await engine.query<{ month: string }>(sql)
  return { data: rows[0]?.month ?? null, sql, formula: 'Första månaden där marginalen faller minst 5 procentenheter från föregående månad. Övriga nyckeltal: minst 20 % förändring i någon riktning mot samma månad föregående år, justerad för de tre föregående månadernas årstillväxt. För kortare historik används genomsnittet av tre föregående månader. En deterministisk brytpunktsheuristik, inte ett statistiskt signifikanstest.' }
}

export async function unitEconomics(engine: SqlEngine, product: string, beforeMonths: string[], afterMonths: string[]) {
  const sql = `WITH periods AS (${periodsSql(beforeMonths, afterMonths)}), economics AS (
  SELECT period, SUM(revenue) / NULLIF(SUM(qty), 0) AS price,
    CASE WHEN COUNT(cost) = COUNT(*) THEN SUM(cost) / NULLIF(SUM(qty), 0) END AS cost
  FROM periods WHERE product = ${literal(product)} GROUP BY period
), paired AS (
  SELECT MAX(price) FILTER (WHERE period = 'before') AS "priceBefore",
    MAX(price) FILTER (WHERE period = 'after') AS "priceAfter",
    MAX(cost) FILTER (WHERE period = 'before') AS "costBefore",
    MAX(cost) FILTER (WHERE period = 'after') AS "costAfter" FROM economics
) SELECT *, 100.0 * ("priceAfter" - "priceBefore") / NULLIF("priceBefore", 0) AS "priceChangePct",
  100.0 * ("costAfter" - "costBefore") / NULLIF("costBefore", 0) AS "costChangePct" FROM paired`
  const result = await execute<UnitEconomics>(engine, sql,
    'Genomsnittligt styckpris = Σ omsättning / Σ antal; styckkostnad = Σ kostnad / Σ antal (antalsviktat). Förändring = (efter − före) / före × 100.')
  return { ...result, data: result.data[0] }
}

export function ordersFor(engine: SqlEngine, product: string, month: string) {
  const sql = `SELECT strftime(date, '%Y-%m-%d') AS date, order_id, customer_id, product,
  qty, unit_price, unit_cost, channel, region, revenue, cost FROM sales
WHERE product = ${literal(product)} AND strftime(date, '%Y-%m') = ${monthLiteral(month)}
ORDER BY date, order_id`
  return execute<OrderLine & { revenue: number; cost: number | null }>(engine, sql,
    'Orderrader för vald produkt och månad. Radens omsättning = antal × styckpris; kostnad = antal × styckkostnad.')
}

/** Prefer the newest complete month, falling back to a flagged partial month. */
export async function latestCompleteMonth(engine: SqlEngine) {
  const sql = `WITH months AS (
  SELECT date_trunc('month', date) AS month, MAX(date) AS last_date FROM sales GROUP BY month
), completeness AS (
  SELECT month, month < MAX(month) OVER () OR last_date >= last_day(month) - INTERVAL '3 days' AS complete FROM months
) SELECT strftime(month, '%Y-%m') AS month, NOT complete AS partial
FROM completeness ORDER BY complete DESC, month DESC LIMIT 1`
  const rows = await engine.query<{ month: string; partial: boolean }>(sql)
  return { data: rows[0]?.month ?? null, partial: rows[0]?.partial ?? false, sql,
    formula: 'Senaste kompletta månad: en senare månad finns eller sista försäljningsdatum ligger högst tre dagar från månadsslut. Om ingen månad är komplett visas den senaste med markering för ofullständig månad.' }
}
