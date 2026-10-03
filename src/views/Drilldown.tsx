import type { SqlEngine } from '../data/engine'
import type { Dashboard } from '../analysis/dashboard'
import { metricProducts, shiftMonth } from '../analysis/dashboard'
import type { CanvasCard, Metric } from '../canvas/layout'
import { fmtDeltaPct, fmtInt, fmtMonth, fmtPp } from '../data/format'
import { Chart } from '../components/charts/Chart'
import { metricInfo, productOption, productValue, trendOption } from '../components/charts/options'
import { calculationFor, deltaLabel } from '../components/CardContent'
import { HowButton } from '../components/HowButton'
import { OrderLines } from '../components/OrderLines'
import type { Calculation } from '../components/CalculationDrawer'

export interface DetailView { metric: Metric; stage: 'trend' | 'products' | 'orders'; product?: string }

export function Drilldown({ view, dashboard, engine, onView, onHow }: {
  view: DetailView; dashboard: Dashboard; engine: SqlEngine; onView: (view: DetailView) => void; onHow: (calculation: Calculation) => void
}) {
  const info = metricInfo[view.metric]
  const kpi = dashboard.snapshot.data[view.metric]
  const card: CanvasCard = { id: 'detail', kind: view.stage === 'trend' ? 'trend' : 'bars', metric: view.metric }
  const best = dashboard.leaders.data.best, worst = dashboard.leaders.data.worst
  const outliers = dashboard.marginProducts.data.filter(row => row.outlier).sort((a, b) => (a.marginDeltaPp ?? 0) - (b.marginDeltaPp ?? 0))
  const comparison = `mot ${fmtMonth(shiftMonth(dashboard.month, -12))}`
  const description = view.stage === 'trend'
    ? `${info.label} för ${fmtMonth(dashboard.month)} blev ${info.format(kpi.current)}. Förändringen är ${view.metric === 'margin' ? fmtPp(kpi.deltaMoM) : fmtDeltaPct(kpi.deltaMoM)} mot föregående månad och ${view.metric === 'margin' ? fmtPp(kpi.deltaYoY) : fmtDeltaPct(kpi.deltaYoY)} mot ${fmtMonth(shiftMonth(dashboard.month, -12))}.`
    : view.metric === 'margin'
      ? `${outliers.length ? `${outliers.map(row => `${row.product} (${fmtPp(row.marginDeltaPp)})`).join(' och ')} sticker ut ${comparison}.` : `Produktmarginalerna ligger nära fjolårets nivå ${comparison}.`} Klicka på en produkt för att se dess orderrader.`
      : view.metric === 'revenue' ? `Störst ökning mot ${fmtMonth(shiftMonth(dashboard.month, -12))} har ${best.product} (${fmtDeltaPct(best.revenueDeltaPct)}). Svagast utveckling har ${worst.product} (${fmtDeltaPct(worst.revenueDeltaPct)}).`
        : `${info.label} räknas unikt per produkt och månad. Klicka på en produkt för att se dess orderrader.`
  return <div className="detail-view" data-testid="detail-view">
    <div className="detail-summary"><strong data-testid="detail-value">{info.format(kpi.current)}</strong><span className={(kpi.deltaYoY ?? 0) < 0 ? 'negative' : 'positive'}>{deltaLabel(dashboard, view.metric)}</span><span className="muted">{info.label}, {fmtMonth(dashboard.month)}</span></div>
    <p className="detail-description">{description}</p>
    {view.stage === 'orders' ? <section className="detail-chart orders-detail"><h3>Orderrader · {view.product}</h3><p className="card-subtitle">{fmtMonth(dashboard.month)}</p>
      <OrderLines engine={engine} product={view.product!} month={dashboard.month} id="orders" onHow={onHow} />
      <button onClick={() => onView({ ...view, stage: 'products', product: undefined })}>Tillbaka till produkter</button>
    </section> : <section className={`detail-chart ${view.stage === 'products' ? 'product-detail' : ''}`}>
      <h3>{info.label} per {view.stage === 'trend' ? 'månad' : 'produkt'}</h3><p className="card-subtitle">{view.stage === 'trend' ? `Senaste ${fmtInt(dashboard.history.data.length)} månaderna` : `${fmtMonth(dashboard.month)} ${comparison}. Klicka på en produkt för att gå vidare.`}</p>
      {view.stage === 'trend' ? <Chart option={trendOption(dashboard.history.data, view.metric, false, (kpi.deltaYoY ?? 0) < 0)} label={`${info.label} per månad`} />
        : <Chart option={productOption(metricProducts(dashboard, view.metric).data, view.metric, dashboard.month, shiftMonth(dashboard.month, -12))} label={`${info.label} per produkt`} onProduct={product => onView({ ...view, stage: 'orders', product })} />}
      {view.stage === 'products' && <div className="product-links" aria-label="Välj produkt">{metricProducts(dashboard, view.metric).data.map(row => <button key={row.product} data-testid={`product-${row.product}`} data-outlier={'outlier' in row && row.outlier ? 'true' : 'false'} onClick={() => onView({ ...view, stage: 'orders', product: row.product })}>{row.product}<span>{info.format(productValue(row, view.metric))}</span></button>)}</div>}
      <HowButton id="detail" onClick={() => onHow(calculationFor(card, dashboard))} />
    </section>}
    {view.stage === 'trend' && <button className="primary" onClick={() => onView({ ...view, stage: 'products' })}>Dela upp per produkt</button>}
  </div>
}
