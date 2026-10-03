import type { Metric } from '../canvas/layout'
import type { SqlEngine } from '../data/engine'
import type { KpiSnapshot } from '../data/metrics'
import { kpiSnapshot, monthlySeries } from '../data/metrics'
import { fmtDeltaPct, fmtMonth, fmtPp } from '../data/format'
import { metricInfo } from '../components/charts/options'

export function priceClause(rows: { product: string; priceChangePct: number | null }[]) {
  return rows.length && rows.every(row => row.priceChangePct != null && Math.abs(row.priceChangePct) < 2)
    ? ' medan priset är i stort sett oförändrat.'
    : `. Prisförändring: ${rows.map(row => `${row.product} ${fmtDeltaPct(row.priceChangePct)}`).join(', ') || 'underlag saknas'}.`
}
export function comparisonAnswer(metric: Metric, month: string, snapshot: KpiSnapshot) {
  const info = metricInfo[metric], kpi = snapshot[metric]
  return `${info.label} för ${fmtMonth(month)} är ${info.format(kpi.current)}, ${metric === 'margin' ? fmtPp(kpi.deltaYoY) : fmtDeltaPct(kpi.deltaYoY)} mot samma månad i fjol (${info.format(kpi.lastYear)}).`
}
export async function monthAnswer(engine: SqlEngine, requestedMonth: number, metric: Metric) {
  const series = await monthlySeries(engine)
  const month = series.data.map(row => row.month).filter(value => Number(value.slice(5)) === requestedMonth).sort().at(-1)
  if (!month) return { month: null, text: 'Den månaden saknar underlag.' }
  const result = await kpiSnapshot(engine, month)
  const info = metricInfo[metric]
  return { month, text: `${info.label} för ${fmtMonth(month)} är ${info.format(result.data[metric].current)}.` }
}
