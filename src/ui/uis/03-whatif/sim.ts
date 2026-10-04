import { literal } from '../../../data/sql'
export interface BaseProduct { product: string; revenue: number; cost: number | null }
export interface Levers { prices: Record<string, number>; cost: number; volumeLoss: number }
export interface Simulation { revenue: number; cost: number | null; margin: number | null; low: number | null; high: number | null }
export const clampLever = (value: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : 0
const valid = (value: number | null): value is number => value !== null && Number.isFinite(value)
function scenario(base: BaseProduct[], levers: Levers, realization: number) {
  const volume = 1 - clampLever(levers.volumeLoss, 0, 30) / 100
  const revenue = base.reduce((sum, row) => sum + row.revenue * (1 + clampLever(levers.prices[row.product] ?? 0, -20, 30) / 100 * realization) * volume, 0)
  const cost = base.every(row => valid(row.cost)) ? base.reduce((sum, row) => sum + row.cost! * (row.product in levers.prices ? 1 + clampLever(levers.cost, -30, 20) / 100 * realization : 1) * volume, 0) : null
  return { revenue, cost, margin: cost === null || revenue === 0 ? null : (revenue - cost) / revenue * 100 }
}
/** Sensitivity band: half to all of the entered price/cost change is realised. Not a confidence interval. */
export function simulate(base: BaseProduct[], levers: Levers): Simulation | null {
  if (!base.length) return null
  const full = scenario(base, levers, 1), half = scenario(base, levers, 0.5)
  return { ...full, low: full.margin === null || half.margin === null ? null : Math.min(full.margin, half.margin), high: full.margin === null || half.margin === null ? null : Math.max(full.margin, half.margin) }
}
/** All displayed outcomes execute this query against DuckDB. Pure model above is the test oracle. */
export function simulationSql(base: BaseProduct[], levers: Levers) {
  if (!base.length) throw new Error('Simuleringen behöver produktunderlag')
  const values = base.map(row => `(${literal(row.product)}, ${valid(row.revenue) ? row.revenue : 'NULL'}, ${valid(row.cost) ? row.cost : 'NULL'}, ${clampLever(levers.prices[row.product] ?? 0, -20, 30)}, ${row.product in levers.prices ? clampLever(levers.cost, -30, 20) : 0})`).join(',\n')
  return `WITH base(product, revenue, cost, price_change, cost_change) AS (VALUES ${values}),
  scenarios(realisation) AS (VALUES (0.5), (1.0)), totals AS (
    SELECT realisation, SUM(revenue * (1 + price_change / 100.0 * realisation) * (1 - ${clampLever(levers.volumeLoss, 0, 30)} / 100.0)) AS revenue,
    CASE WHEN COUNT(cost) = COUNT(*) THEN SUM(cost * (1 + cost_change / 100.0 * realisation) * (1 - ${clampLever(levers.volumeLoss, 0, 30)} / 100.0)) END AS cost
    FROM base CROSS JOIN scenarios GROUP BY realisation
  ), margins AS (SELECT *, 100.0 * (revenue - cost) / NULLIF(revenue, 0) AS margin FROM totals)
  SELECT MAX(revenue) FILTER (WHERE realisation = 1) AS revenue,
  MAX(cost) FILTER (WHERE realisation = 1) AS cost, MAX(margin) FILTER (WHERE realisation = 1) AS margin,
  MIN(margin) AS low, MAX(margin) AS high FROM margins`
}
