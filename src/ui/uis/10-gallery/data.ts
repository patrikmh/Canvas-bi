import type { SqlEngine } from '../../../data/engine'
import { marginWaterfall } from '../../../data/metrics'
import type { ProductMetrics, WaterfallStep } from '../../../data/metrics'
import { literal } from '../../../data/sql'

export interface EconomicsRow { month: string; product: string; price: number | null; cost: number | null }
export type Sort = 'avvikelse' | 'bidrag' | 'marginal' | 'omsättning' | 'kategori'
export const category = (product: string) => /filt|pläd|duk|lakan|fodral/i.test(product) ? 'Textil' : 'Hemdetaljer'
export async function loadEconomics(engine: SqlEngine, month: string) {
  const sql = `SELECT product,strftime(date,'%Y-%m') AS month,SUM(revenue)/NULLIF(SUM(qty),0) AS price,
    CASE WHEN COUNT(cost)=COUNT(*) THEN SUM(cost)/NULLIF(SUM(qty),0) END AS cost
    FROM sales WHERE strftime(date,'%Y-%m')<=${literal(month)} GROUP BY product,month ORDER BY product,month`
  return { data: await engine.query<EconomicsRow>(sql), sql, formula: 'Antalsviktat styckpris och styckkostnad: summerade belopp / summerat antal. Saknad kostnad förblir okänd.' }
}
export async function loadCatalogue(engine: SqlEngine, month: string, before: string[], after: string[]) {
  const [economics, contributions] = await Promise.all([loadEconomics(engine, month), marginWaterfall(engine, before, after, 100)])
  return { economics, contributions }
}
export function sortProducts(rows: ProductMetrics[], sort: Sort, contributions: WaterfallStep[]) {
  const value = (row: ProductMetrics) => sort === 'bidrag' ? contributions.find(step => step.label === row.product)?.value ?? null
    : sort === 'marginal' ? row.margin : sort === 'omsättning' ? row.revenue : row.marginDeltaPp
  return [...rows].sort((a, b) => {
    if (sort === 'kategori') return category(a.product).localeCompare(category(b.product), 'sv') || a.product.localeCompare(b.product, 'sv')
    const av = value(a), bv = value(b)
    if (av == null || bv == null) return av == null && bv == null ? a.product.localeCompare(b.product, 'sv') : av == null ? 1 : -1
    return (sort === 'omsättning' ? bv - av : av - bv) || a.product.localeCompare(b.product, 'sv')
  })
}
