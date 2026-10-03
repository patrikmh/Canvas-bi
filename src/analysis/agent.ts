import type { SqlEngine } from '../data/engine'
import { kpiSnapshot, marginWaterfall, monthlySeries, unitEconomics } from '../data/metrics'
import type { KpiSnapshot, MonthlyMetrics, MetricResult, WaterfallStep } from '../data/metrics'
import { fmtDeltaPct, fmtInt, fmtMonth, fmtPct, fmtPp, fmtTkr } from '../data/format'
import { literal } from '../data/sql'
import type { Metric } from '../canvas/layout'
import { priceClause } from './answers'
import { shiftMonth } from './dashboard'
export interface TraceStep { label: string; tool: string; input: unknown; sql: string; summary: string; status: 'pending' | 'running' | 'done' | 'failed'; duration: number }
export interface AgentResult { metric: Metric; title: string; text: string; confidence: string; steps: TraceStep[] }
const labels = ['Bekräftar att marginalen har ändrats', 'Letar efter när förändringen började', 'Delar upp förändringen per produkt', 'Testar om kostnad eller pris förklarar den', 'Verifierar siffrorna']
const metricColumn = { revenue: 'revenue', margin: 'gross_margin_pct', orders: 'orders', customers: 'customers' } as const
const names = { revenue: 'Omsättning', margin: 'Bruttomarginal', orders: 'Ordrar', customers: 'Kunder' }
const format = (metric: Metric, value: number | null) => metric === 'margin' ? fmtPct(value) : metric === 'revenue' ? fmtTkr(value) : fmtInt(value)
export async function runAgent(engine: SqlEngine, month: string, options: { metric?: Metric; fast?: boolean; signal?: AbortSignal; onSteps?: (steps: TraceStep[]) => void } = {}): Promise<AgentResult> {
  const steps: TraceStep[] = labels.map(label => ({ label, tool: '', input: {}, sql: '', summary: '', status: 'pending', duration: 0 }))
  const emit = () => options.onSteps?.(steps.map(step => ({ ...step })))
  async function call<T>(index: number, tool: string, input: unknown, action: () => Promise<MetricResult<T>>, summary: (data: T) => string) {
    if (options.signal?.aborted) throw new Error('Analysen avbröts')
    const step = steps[index]; step.tool = tool; step.input = input; step.status = 'running'; emit()
    const start = performance.now()
    try {
      const result = await action()
      step.sql = result.sql; step.summary = summary(result.data)
      if (!options.fast) await new Promise(resolve => setTimeout(resolve, Math.max(0, 450 - (performance.now() - start))))
      if (options.signal?.aborted) throw new Error('Analysen avbröts')
      step.duration = Math.round(performance.now() - start); step.status = 'done'; emit(); return result
    } catch (cause) { step.status = 'failed'; step.summary = String(cause); step.duration = Math.round(performance.now() - start); emit(); throw cause }
  }
  let snapshot!: MetricResult<KpiSnapshot>
  let series!: MetricResult<MonthlyMetrics[]>
  let history: MonthlyMetrics[] = []
  const scan = await call(0, 'scanKpis', { month, compare: ['lastYear', 'priorThreeMonths'], thresholds: { marginPp: 5, otherPct: 20 }, ranking: 'smaller normalized change across both comparisons' }, async function scanKpis() {
    snapshot = await kpiSnapshot(engine, month)
    series = await monthlySeries(engine)
    history = series.data.filter(row => row.month <= month)
    const prior = [-3, -2, -1].map(offset => shiftMonth(month, offset))
    const candidates = (Object.keys(metricColumn) as Metric[]).map(metric => {
      const col = metricColumn[metric]
      return `SELECT '${metric}' AS metric, ABS((c.${col} - y.${col}) / NULLIF(y.${col}, 0)) AS yoy,
      ABS((c.${col} - (SELECT AVG(${col}) FROM monthly WHERE month IN (${prior.map(literal).join(',')}))) /
      NULLIF((SELECT AVG(${col}) FROM monthly WHERE month IN (${prior.map(literal).join(',')})), 0)) AS recent
      FROM monthly c LEFT JOIN monthly y ON y.month = ${literal(shiftMonth(month, -12))} WHERE c.month = ${literal(month)}`
    }).join(' UNION ALL ')
    const scanSql = `WITH monthly AS (${series.sql}), scan AS (${candidates}) SELECT *,
      CASE WHEN metric = 'margin' THEN ABS(COALESCE((SELECT gross_margin_pct FROM monthly WHERE month = ${literal(shiftMonth(month, -12))}), (SELECT AVG(gross_margin_pct) FROM monthly WHERE month IN (${prior.map(literal).join(',')})), (SELECT gross_margin_pct FROM monthly WHERE month = ${literal(month)}))) / 5 ELSE 5 END *
      CASE WHEN yoy IS NOT NULL AND recent IS NOT NULL THEN LEAST(yoy, recent) ELSE COALESCE(yoy, recent, 0) END AS score
      FROM scan ORDER BY score DESC, metric`
    return { data: await engine.query<{ metric: Metric; yoy: number | null; recent: number | null }>(scanSql), sql: `${snapshot.sql};\n${scanSql}`, formula: '' }
  }, rows => rows.map(row => `${names[row.metric]}: år ${fmtPct(row.yoy == null ? null : row.yoy * 100)}, senaste tre månader ${fmtPct(row.recent == null ? null : row.recent * 100)}`).join(' · '))
  const metric = options.metric ?? scan.data[0]?.metric ?? 'margin'
  steps[0].label = metric === 'margin' ? labels[0] : `Bekräftar att ${names[metric].toLowerCase()} har ändrats`
  const start = await call(1, 'findLatestChange', { metric: metricColumn[metric], through: month, rule: 'latest abrupt change, either direction' }, async function findLatestChange() {
    const column = metricColumn[metric]
    // Bound the latest abrupt change to the selected month, in either direction.
    const sql = `WITH monthly AS (${series.sql}), changes AS (
      SELECT month, ${column} AS value, LAG(${column}) OVER (ORDER BY month) AS previous FROM monthly
    ) SELECT month FROM changes WHERE month <= ${literal(month)} AND
      ${metric === 'margin' ? 'ABS(value - previous) >= 5' : 'ABS(value / NULLIF(previous, 0) - 1) >= 0.2'}
      ORDER BY month DESC LIMIT 1`
    const rows = await engine.query<{ month: string }>(sql)
    return { data: rows[0]?.month ?? null, sql, formula: 'Senaste absoluta månadsförändring inom vald period: minst 5 procentenheter för marginal, annars minst 20 procent.' }
  }, value => value ? `Senaste tydliga brytpunkt: ${fmtMonth(value)}.` : 'Ingen tydlig brytpunkt hittades.')
  const changeStart = start.data && start.data <= month ? start.data : null
  // Follow the detected break, bounded to the selected period. A missing break uses the latest month.
  const boundary = changeStart ?? month
  const before = [-3, -2, -1].map(offset => shiftMonth(boundary, offset))
  const after = history.filter(row => row.month >= boundary).map(row => row.month)
  const breakdown = await call(2, metric === 'margin' ? 'marginWaterfall' : 'allocateProductChanges', { metric, before, after }, async function allocateProductChanges() {
    if (metric === 'margin') return marginWaterfall(engine, before, after.length ? after : [month])
    const aggregate = metric === 'revenue' ? 'SUM(revenue)' : `COUNT(DISTINCT ${metric === 'orders' ? 'order_id' : 'customer_id'})`
    const months = [...before, ...after].map(literal).join(',')
    const sql = `WITH grouped AS (
      SELECT product, strftime(date, '%Y-%m') AS month, ${aggregate} AS value FROM sales
      WHERE strftime(date, '%Y-%m') IN (${months}) GROUP BY product, month
    ), monthly AS (
      SELECT strftime(date, '%Y-%m') AS month, ${aggregate} AS total FROM sales
      WHERE strftime(date, '%Y-%m') IN (${months}) GROUP BY month
    ), periods AS (
      SELECT *, CASE WHEN month IN (${before.map(literal).join(',')}) THEN 'before' ELSE 'after' END AS period FROM monthly
    ), totals AS (
      SELECT period, AVG(total) AS value, COUNT(*) AS months FROM periods GROUP BY period
    ), shares AS (
      SELECT g.*, p.period, g.value / NULLIF(SUM(g.value) OVER (PARTITION BY g.month),0) * p.total / t.months AS allocated
      FROM grouped g JOIN periods p USING(month) JOIN totals t USING(period)
    ), changes AS (
      SELECT product AS label, SUM(CASE WHEN period = 'after' THEN allocated ELSE -allocated END) AS value
      FROM shares GROUP BY product
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY ABS(value) DESC, label) AS rank FROM changes
    ), steps AS (
      SELECT 'Före' AS label, value, 'total' AS kind, 0 AS position FROM totals WHERE period = 'before'
      UNION ALL SELECT label, value, 'change', rank FROM ranked WHERE rank <= 2
      UNION ALL SELECT 'Övriga', COALESCE(SUM(value),0), 'change', 3 FROM ranked WHERE rank > 2
      UNION ALL SELECT 'Nu', value, 'total', 4 FROM totals WHERE period = 'after'
    ) SELECT label, value, kind FROM steps ORDER BY position`
    return { data: await engine.query<WaterfallStep>(sql), sql, formula: 'Produktandelar fördelar månadens total. Perioder jämförs som månadsgenomsnitt. Produktbidragen summerar till totalens förändring.' }
  }, rows => rows.map(row => `${row.label}: ${metric === 'margin' && row.kind === 'change' ? fmtPp(row.value) : format(metric, row.value)}`).join(' · '))
  const contributors = breakdown.data.filter(row => row.kind === 'change' && row.label !== 'Övriga').slice(0, 2)
  const economics = await call(3, contributors.length ? 'unitEconomics' : 'checkProductContributors', { products: contributors.map(row => row.label), before, after }, async function checkProductContributors() {
    const results = await Promise.all(contributors.map(row => unitEconomics(engine, row.label, before, after.length ? after : [month]).then(result => ({ ...result, product: row.label }))))
    return { data: results, sql: results.map(result => result.sql).join(';\n'), formula: '' }
  }, rows => rows.map(row => `${row.product}: styckkostnad ${fmtDeltaPct(row.data.costChangePct)}, pris ${fmtDeltaPct(row.data.priceChangePct)}`).join(' · ') || 'Inga produktbidrag att testa.')
  const endpoints = breakdown.data.filter(row => row.kind === 'total')
  const verifySql = `WITH steps AS (${breakdown.sql}) SELECT
    MAX(value) FILTER (WHERE label = 'Före') AS before, MAX(value) FILTER (WHERE label = 'Nu') AS after,
    MAX(value) FILTER (WHERE label = 'Före') - MAX(value) FILTER (WHERE label = 'Nu') AS drop,
    ROUND(100.0 * SUM(value) FILTER (WHERE kind = 'change' AND label <> 'Övriga') / NULLIF(MAX(value) FILTER (WHERE label = 'Nu') - MAX(value) FILTER (WHERE label = 'Före'),0) / 5) * 5 AS share,
    ABS(SUM(value) FILTER (WHERE kind = 'change') - (MAX(value) FILTER (WHERE label = 'Nu') - MAX(value) FILTER (WHERE label = 'Före'))) AS residual FROM steps`
  const verified = await call(4, 'reconcileWaterfall', { month, metric }, async function reconcileWaterfall() { return {
    data: (await engine.query<{ before: number | null; after: number | null; drop: number | null; share: number | null; residual: number | null }>(verifySql))[0], sql: verifySql, formula: breakdown.formula,
  } }, row => `Kontrollerat: ${format(metric, row.before)} → ${format(metric, row.after)}; produktbidragen summerar med avvikelse ${format(metric, row.residual)}.`)
  const orders = snapshot.data.orders.current ?? 0
  const low = history.length < 6 || orders < 30
  const consistent = endpoints.length === 2 && (verified.data.residual ?? Infinity) < 1e-7
  const confidence = low ? 'Låg säkerhet' : consistent ? 'Hög säkerhet' : 'Medel säkerhet'
  let text = `${names[metric]} för ${fmtMonth(month)} är ${format(metric, snapshot.data[metric].current)}. Förändring mot i fjol: ${metric === 'margin' ? fmtPp(snapshot.data.margin.deltaYoY) : fmtDeltaPct(snapshot.data[metric].deltaYoY)}.`
  let title = options.metric ? `${names[metric]}, jämförelse och produktbidrag.` : `${names[metric]} har störst förändring i jämförelserna.`
  if (low) {
    title = 'Mer data behövs för en säker analys.'
    text = `${text} Underlaget har ${[history.length < 6 ? 'färre än sex månader' : '', orders < 30 ? 'färre än trettio ordrar i perioden' : ''].filter(Boolean).join(' och ')}. Jämförelserna är osäkra; samla mer data innan du drar slutsatser.`
  } else if (metric === 'margin' && consistent && (verified.data.drop ?? 0) > 0) {
    title = 'Marginalen är det enda som behöver din uppmärksamhet.'
    text = `Bruttomarginalen sjönk från ${fmtPct(verified.data.before)} till ${fmtPct(verified.data.after)}, alltså ${fmtPct(verified.data.drop).replace(/\s*%/, '')} procentenheter.${changeStart ? ` Förändringen började i ${fmtMonth(changeStart)}.` : ''} Ungefär ${fmtPct(verified.data.share, 0)} av nedgången kommer från ${contributors.map(row => row.label).join(' och ')}.`
    const costsUp = economics.data.every(row => (row.data.costChangePct ?? 0) > 0)
    text += ` ${costsUp ? 'Där har inköpskostnaden per styck ökat' : 'Förändring i styckkostnad'} (${economics.data.map(row => `${row.product} ${fmtPct(row.data.costChangePct, 0)}`).join(', ')})${priceClause(economics.data.map(row => ({ product: row.product, priceChangePct: row.data.priceChangePct })))}`
  }
  if (!low && consistent && metric !== 'margin') {
    text += ` Månadsgenomsnittet ändrades från ${format(metric, verified.data.before)} till ${format(metric, verified.data.after)}. Störst produktbidrag: ${contributors.map(row => `${row.label} (${format(metric, row.value)})`).join(' och ')}. Styckkostnad och pris har kontrollerats för dessa produkter; se verktygsresultaten.`
  }
  return { metric, title, text, confidence, steps }
}
