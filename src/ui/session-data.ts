import type { AgentResult, TraceStep } from '../analysis/agent'
import { loadDashboard } from '../analysis/dashboard'
import type { SqlEngine } from '../data/engine'
import { monthlySeries } from '../data/metrics'
import type { MetricResult, MonthlyMetrics, WaterfallStep } from '../data/metrics'
import { literal } from '../data/sql'
import { sqlStatements } from '../components/assistant/memo'
import type { FindingReview } from '../components/assistant/memo'

export async function loadSessionData(engine: SqlEngine, month: string) {
  const [dashboard, series] = await Promise.all([loadDashboard(engine, month), monthlySeries(engine)])
  // Reuse the canonical metrics SQL with a product-scoped sales relation.
  const products = await engine.query<{ product: string }>('SELECT DISTINCT product FROM sales ORDER BY product')
  const productSeries: Record<string, MetricResult<MonthlyMetrics[]>> = Object.fromEntries(await Promise.all(products.map(async ({ product }) => {
    const sql = series.sql.replace('FROM sales', `FROM (SELECT * FROM sales WHERE product = ${literal(product)}) AS sales`)
    return [product, { ...series, sql, data: await engine.query<MonthlyMetrics>(sql) }]
  })))
  return { dashboard, series, productSeries }
}
export type SessionData = Awaited<ReturnType<typeof loadSessionData>>
export function citationRows(engine: SqlEngine, ref: TraceStep) {
  return Promise.all(sqlStatements(ref.sql).map(sql => engine.query<Record<string, unknown>>(sql)))
}
export async function analysisWaterfall(engine: SqlEngine, result: AgentResult): Promise<MetricResult<WaterfallStep[]> | null> {
  const step = result.steps.find(step => ['marginWaterfall', 'allocateProductChanges'].includes(step.tool) && step.status === 'done')
  return step ? { sql: step.sql, formula: 'Produktbidrag och perioder från analysens verktygsfråga.', data: await engine.query<WaterfallStep>(step.sql) } : null
}
export interface Review { status: FindingReview; reason?: string; noteKind?: 'edit' | 'reject' }
export function reviewFinding(reviews: Record<number, Review>, number: number, status: Exclude<FindingReview, 'pending'>, reason = '') {
  if (status !== 'accepted' && !reason.trim()) throw new Error('A review reason is required')
  return { ...reviews, [number]: { ...reviews[number], status, ...(reason.trim() ? { reason: reason.trim(), noteKind: status === 'rejected' ? 'reject' as const : 'edit' as const } : {}) } }
}
