import { useEffect, useState } from 'react'
import { createBrowserEngine } from './data/engine.browser'
import type { SqlEngine } from './data/engine'
import { demoDatasetInfo, generateDemoData } from './data/generate'
import { kpiSnapshot, latestCompleteMonth } from './data/metrics'
import type { KpiSnapshot, MetricResult } from './data/metrics'
import { fmtDeltaPct, fmtInt, fmtMonth, fmtPct, fmtPp, fmtTkr } from './data/format'
import type { DatasetInfo } from './data/types'

interface Dashboard { snapshot: MetricResult<KpiSnapshot>; dataset: DatasetInfo }
const cards = [
  { key: 'revenue', label: 'Omsättning', format: fmtTkr },
  { key: 'margin', label: 'Bruttomarginal', format: fmtPct },
  { key: 'orders', label: 'Ordrar', format: fmtInt },
  { key: 'customers', label: 'Kunder', format: fmtInt },
] as const

export default function App() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let engine: SqlEngine | undefined
    async function boot() {
      try {
        engine = await createBrowserEngine()
        if (cancelled) return
        const rows = generateDemoData()
        await engine.loadOrderLines(rows)
        const { data: month } = await latestCompleteMonth(engine)
        if (!month) throw new Error('Ingen fullständig månad hittades.')
        const snapshot = await kpiSnapshot(engine, month)
        if (!cancelled) setDashboard({ snapshot, dataset: demoDatasetInfo(rows) })
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Data kunde inte läsas.')
      } finally {
        // The dashboard retains plain query results; it need not keep a worker alive.
        await engine?.close()
      }
    }
    void boot()
    return () => { cancelled = true }
  }, [])

  const monthLabel = dashboard ? fmtMonth(dashboard.snapshot.data.month) : null
  return (
    <div data-testid="app-root" data-ready={dashboard ? 'true' : 'false'} className="dashboard">
      <div data-testid="demo-banner" className="demo-banner">KONCEPTDEMO – syntetisk demonstrationsdata</div>
      <header className="brand"><span>Canvas BI</span><span>DemoCo AB</span></header>
      <main>
        <div className="dashboard-heading">
          <div><p className="eyebrow">DemoCo AB · Ledning</p><h1>Ledningsöversikt</h1></div>
          {monthLabel && <p className="period">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</p>}
        </div>
        <p className="intro">En samlad bild av försäljningen. Nyckeltalen beräknas lokalt från dina orderrader.</p>
        {error ? <p role="alert">Det gick inte att läsa demonstrationsdata: {error}</p> : !dashboard ? (
          <p role="status">Läser demonstrationsdata och beräknar nyckeltal…</p>
        ) : <>
          <section className="kpi-grid" aria-label="Månadens nyckeltal">
            {cards.map(({ key, label, format }) => {
              const kpi = dashboard.snapshot.data[key]
              return <article key={key} data-testid={`kpi-${key}`} className="kpi-card">
                <h2>{label}</h2>
                <p className="kpi-value">{format(kpi.current)}</p>
                <p className={`kpi-delta ${kpi.deltaYoY != null && kpi.deltaYoY < 0 ? 'negative' : 'positive'}`}>
                  {key === 'margin' ? fmtPp(kpi.deltaYoY) : fmtDeltaPct(kpi.deltaYoY)}
                  <span> mot {new Intl.DateTimeFormat('sv-SE', { month: 'long', timeZone: 'UTC' }).format(new Date(`${dashboard.snapshot.data.month}-01T12:00:00Z`))} i fjol</span>
                </p>
              </article>
            })}
          </section>
          <details className="calculation">
            <summary>Hur räknas detta?</summary>
            <p>{dashboard.snapshot.formula}</p>
            <pre>{dashboard.snapshot.sql}</pre>
          </details>
          <footer className="data-note">
            <span>{dashboard.dataset.name} · Syntetiska orderrader</span>
            <span>{fmtMonth(dashboard.dataset.months[0])} – {fmtMonth(dashboard.dataset.months.at(-1)!)}</span>
          </footer>
        </>}
      </main>
    </div>
  )
}
