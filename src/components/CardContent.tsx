import { useEffect, useState } from 'react'
import type { Dashboard } from '../analysis/dashboard'
import type { CanvasCard, Metric } from '../canvas/layout'
import { fmtDeltaPct, fmtInt, fmtMonth, fmtPct, fmtPp, fmtTkr } from '../data/format'
import type { Calculation } from './CalculationDrawer'
import { Chart } from './charts/Chart'
import { metricInfo, productOption, trendOption, waterfallOption, waterfallSubtitle } from './charts/options'
import { metricProducts, shiftMonth } from '../analysis/dashboard'
import type { SqlEngine } from '../data/engine'
import { OrderLines } from './OrderLines'
import { fmtKr } from './valueFormat'
import { HowButton } from './HowButton'

export const monthName = (month: string) => fmtMonth(month).replace(/ \d{4}$/, '')
export const deltaLabel = (dashboard: Dashboard, metric: Metric) => `${metric === 'margin' ? fmtPp(dashboard.snapshot.data[metric].deltaYoY) : fmtDeltaPct(dashboard.snapshot.data[metric].deltaYoY)} mot ${monthName(dashboard.month)} i fjol`
export function insightText(dashboard: Dashboard) {
  const { story, economics, changeStart } = dashboard
  if (!changeStart || (story.data.drop ?? 0) <= 0) return `Omsättningen för ${fmtMonth(dashboard.month)} blev ${fmtTkr(dashboard.snapshot.data.revenue.current)}. Bruttomarginalen är ${fmtPct(dashboard.snapshot.data.margin.current)}. Följ utvecklingen och jämför produkter i korten nedan.`
  return `Bruttomarginalen sjönk från ${fmtPct(story.data.before)} till ${fmtPct(story.data.after)}, alltså ${fmtPct(story.data.drop).replace(/\s*%/, '')} procentenheter. Förändringen började i ${fmtMonth(changeStart)}. Ungefär ${fmtPct(story.data.share, 0)} av nedgången kommer från ${economics.map(result => result.product).join(' och ')}. Där har inköpskostnaden per styck ökat (${economics.map(result => `${result.product} ${fmtPct(result.data.costChangePct, 0)}`).join(', ')}) medan priset är i stort sett oförändrat.`
}

export function cardTitle(card: CanvasCard) {
  const info = metricInfo[card.metric ?? 'revenue']
  switch (card.kind) {
    case 'kpi': return info.label
    case 'trend': return `${info.label} per månad`
    case 'bars': return `${info.label} per produkt`
    case 'waterfall': return 'Vad förklarar marginalfallet'
    case 'table': return card.product ? `Orderrader · ${card.product}` : 'Försäljning per produkt'
    case 'insight': return 'Insikt'
    case 'text': return 'Text'
  }
}

export function calculationFor(card: CanvasCard, dashboard: Dashboard): Calculation {
  const metric = card.metric ?? 'revenue'
  const result = card.kind === 'kpi' ? dashboard.snapshot : card.kind === 'waterfall' ? dashboard.waterfall
    : card.kind === 'trend' ? dashboard.history : card.kind === 'insight' ? dashboard.story
      : metricProducts(dashboard, metric)
  return { id: card.id, title: cardTitle(card), formula: result.formula, sql: result.sql,
    value: card.kind === 'waterfall' || card.kind === 'insight' ? `${fmtPct(dashboard.story.data.before)} → ${fmtPct(dashboard.story.data.after)}`
      : metricInfo[metric].format(dashboard.snapshot.data[metric].current) }
}

interface Props {
  card: CanvasCard
  dashboard: Dashboard
  engine: SqlEngine
  onDrill: (metric: Metric, products?: boolean, product?: string) => void
  onHow: (calculation: Calculation) => void
  onExplain: () => void
  onWatch: () => void
  onNote: (id: string, text: string) => void
}

export function CardContent({ card, dashboard, engine, onDrill, onHow, onExplain, onWatch, onNote }: Props) {
  const metric = card.metric ?? 'revenue'
  const info = metricInfo[metric]
  const how = <HowButton id={card.id} onClick={() => onHow(calculationFor(card, dashboard))} />
  if (card.kind === 'insight') return <div className="insight-content">
    <h2>{dashboard.changeStart && (dashboard.story.data.drop ?? 0) > 0 ? 'Marginalen är det enda som behöver din uppmärksamhet.' : 'Din ledningsöversikt, samlad på en yta.'}</h2>
    <p>{insightText(dashboard)}</p><div className="insight-actions"><button className="primary" onClick={onExplain}>Visa varför</button><button onClick={onWatch}>Bevaka marginalen</button></div>
  </div>
  if (card.kind === 'kpi') {
    const kpi = dashboard.snapshot.data[metric]
    const bad = (kpi.deltaYoY ?? 0) < 0
    return <div className="kpi-content" data-testid={card.id}>
      <button className="kpi-value" onClick={() => onDrill(metric)} aria-label={`Utforska ${info.label}`}>{info.format(kpi.current)}</button>
      <p className={`kpi-delta ${bad ? 'negative' : 'positive'}`}><span>{metric === 'margin' ? fmtPp(kpi.deltaYoY) : fmtDeltaPct(kpi.deltaYoY)} mot </span><span>{monthName(dashboard.month)} i fjol</span></p>
      <Chart option={trendOption(dashboard.history.data.slice(-13), metric, true, bad)} label={`${info.label}, senaste tretton månaderna`} className="sparkline" />{how}
    </div>
  }
  if (card.kind === 'trend') return <><p className="card-subtitle">Senaste {fmtInt(dashboard.history.data.length)} månaderna</p><Chart option={trendOption(dashboard.history.data, metric, false, (dashboard.snapshot.data[metric].deltaYoY ?? 0) < 0)} label={cardTitle(card)} />{how}</>
  if (card.kind === 'waterfall') return <><p className="card-subtitle">{waterfallSubtitle(dashboard)}</p><Chart option={waterfallOption(dashboard.waterfall.data)} label="Marginalens förändring: före, produktbidrag och nu" />{how}</>
  if (card.kind === 'bars') return <><p className="card-subtitle">{fmtMonth(dashboard.month)} mot {fmtMonth(shiftMonth(dashboard.month, -12))}</p>
    <Chart option={productOption(metricProducts(dashboard, metric).data, metric, dashboard.month, shiftMonth(dashboard.month, -12))} label={cardTitle(card)} onProduct={product => onDrill(metric, true, product)} />{how}</>
  if (card.kind === 'table') return card.product ? <OrderLines engine={engine} product={card.product} month={dashboard.month} id={card.id} onHow={onHow} /> : <><ProductTable dashboard={dashboard} />{how}</>
  return <Note key={card.id} card={card} onNote={onNote} />
}

function Note({ card, onNote }: { card: CanvasCard; onNote: Props['onNote'] }) {
  const [text, setText] = useState(card.text ?? '')
  useEffect(() => setText(card.text ?? ''), [card.text])
  return <textarea className="note-editor" aria-label="Anteckning" placeholder="Skriv en rubrik eller anteckning…" value={text} onChange={event => setText(event.target.value)} onBlur={() => onNote(card.id, text)} />
}

export function ProductTable({ dashboard }: { dashboard: Dashboard }) {
  return <div className="table-scroll"><table><thead><tr><th>Produkt</th><th>Omsättning</th><th>Marginal</th><th>Mot i fjol</th></tr></thead>
    <tbody>{dashboard.products.data.map(row => <tr key={row.product}><td>{row.product}</td><td>{fmtKr(row.revenue)}</td><td>{fmtPct(row.margin)}</td><td className={(row.revenueDeltaPct ?? 0) < 0 ? 'negative' : 'positive'}>{fmtDeltaPct(row.revenueDeltaPct)}</td></tr>)}</tbody></table></div>
}
