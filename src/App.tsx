import { useEffect, useReducer, useRef, useState } from 'react'
import type { SqlEngine } from './data/engine'
import { demoDatasetInfo, generateDemoData } from './data/generate'
import { latestCompleteMonth } from './data/metrics'
import { fmtMonth } from './data/format'
import { loadDashboard } from './analysis/dashboard'
import type { Dashboard } from './analysis/dashboard'
import { Canvas } from './canvas/Canvas'
import { initialState, layoutReducer, readDocument, STORAGE_KEY } from './canvas/layout'
import type { CardKind, Metric } from './canvas/layout'
import { Palette } from './components/Palette'
import { AssistantPanel } from './components/assistant/AssistantPanel'
import { CalculationDrawer } from './components/CalculationDrawer'
import type { Calculation } from './components/CalculationDrawer'
import { Drilldown } from './views/Drilldown'
import type { DetailView } from './views/Drilldown'
import { metricInfo } from './components/charts/options'

const chips = [
  'Utforska marginalen', 'Varför ändrades marginalen?', 'Jämför omsättningen med förra året',
  'Visa marginal per produkt', 'Bevaka marginalen', 'Bygg en ledningsvy',
].map((label, index) => ({ id: `suggestion-${index}`, label }))
const intro = [{ id: 'intro', role: 'assistant' as const, content: <><p>Jag har läst demonstrationsdata och byggt en ledningsvy. Omsättningen följer säsongen, men marginalen föll i juli.</p><p>Klicka på ett tal eller dubbelklicka på ett kort för att zooma in per produkt och order.</p><p>Frågor och förslag kan du skriva här.</p></> }]

export default function App() {
  const [engine, setEngine] = useState<SqlEngine | null>(null)
  const [months, setMonths] = useState<string[]>([])
  const [month, setMonth] = useState('2026-08')
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storageNotice, setStorageNotice] = useState(false)
  const [state, dispatch] = useReducer(layoutReducer, undefined, () => {
    try { return initialState(readDocument(localStorage.getItem(STORAGE_KEY))) } catch { return initialState() }
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<DetailView | null>(null)
  const [calculation, setCalculation] = useState<Calculation | null>(null)
  const scroll = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let live: SqlEngine | undefined
    async function boot() {
      let instance: SqlEngine | undefined
      try {
        const { createBrowserEngine } = await import('./data/engine.browser')
        instance = await createBrowserEngine()
        if (cancelled) { await instance.close(); return }
        const rows = generateDemoData()
        await instance.loadOrderLines(rows)
        const latest = await latestCompleteMonth(instance)
        if (cancelled) { await instance.close(); return }
        if (!latest.data) throw new Error('Ingen fullständig månad hittades.')
        live = instance
        setMonths(demoDatasetInfo(rows).months)
        setMonth(latest.data)
        setEngine(instance)
      } catch (cause) { await instance?.close(); if (!cancelled) { setError(String(cause)); setBusy(false) } }
    }
    void boot()
    return () => { cancelled = true; void live?.close() }
  }, [])

  useEffect(() => {
    if (!engine) return
    let cancelled = false
    setBusy(true); setError(null)
    void loadDashboard(engine, month).then(result => {
      if (!cancelled) { setDashboard(result); setBusy(false) }
    }).catch(cause => { if (!cancelled) { setError(String(cause)); setBusy(false) } })
    return () => { cancelled = true }
  }, [engine, month])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.present)); setStorageNotice(false) } catch { setStorageNotice(true) }
  }, [state.present])

  function add(kind: CardKind, position?: { x: number; y: number }, metric: Metric = 'revenue', product?: string) {
    const id = `${kind}-${crypto.randomUUID()}`
    dispatch({ type: 'add', card: { id, kind, metric, product, ...(kind === 'text' ? { text: '' } : {}) }, position })
    setSelected(id)
    setView(null)
    setTimeout(() => document.querySelector(`[data-card-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50)
  }
  function drill(metric: Metric, products = false, product?: string) { setView({ metric, stage: product ? 'orders' : products ? 'products' : 'trend', product }); scroll.current?.scrollTo({ top: 0 }); }
  function explain() { setSelected('waterfall'); setTimeout(() => document.querySelector('[data-card-id="waterfall"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 20) }
  function restore() { dispatch({ type: 'reset' }); setView(null); setSelected(null); setMonth(months.at(-1) ?? '2026-08'); scroll.current?.scrollTo({ top: 0 }) }
  function watch() { window.dispatchEvent(new CustomEvent('canvas-bi:watch', { detail: { metric: 'margin', month } })) }
  const title = view ? metricInfo[view.metric].label : 'Ledningsöversikt'

  return <div data-testid="app-root" data-ready={dashboard && !busy ? 'true' : 'false'} className="app">
    <div data-testid="demo-banner" className="demo-banner">KONCEPTDEMO – syntetisk demonstrationsdata</div>
    <div className="app-shell">
      <Palette onAdd={kind => add(kind)} />
      <main className="workspace">
        <header className="workspace-header">
          {view ? <nav className="breadcrumbs" aria-label="Navigering"><button onClick={() => setView({ metric: view.metric, stage: 'trend' })}>{title}</button>{view.stage !== 'trend' && <><span>›</span><button onClick={() => setView({ metric: view.metric, stage: 'products' })}>Per produkt</button></>}{view.product && <><span>›</span><strong>{view.product}</strong></>}</nav> : <h1>{title}</h1>}
          <div className="workspace-actions">
            {view ? <><button onClick={() => add(view.stage === 'trend' ? 'trend' : view.stage === 'orders' ? 'table' : 'bars', undefined, view.metric, view.product)}>Lägg på ytan</button><button onClick={() => { setView(null); scroll.current?.scrollTo({ top: 0 }) }}>Tillbaka till ytan</button></> : <>
              <select aria-label="Period" value={month} onChange={event => { setMonth(event.target.value); setCalculation(null) }}>{(months.length ? months : [month]).map(value => <option key={value} value={value}>{fmtMonth(value).charAt(0).toUpperCase() + fmtMonth(value).slice(1)}</option>)}</select>
              <button onClick={() => dispatch({ type: 'undo' })} disabled={!state.past.length}>Ångra</button>
              <button onClick={() => { dispatch({ type: 'clear' }); setSelected(null) }}>Töm ytan</button>
              <button className="reset-button" onClick={restore}>Återställ demon</button>
            </>}
          </div>
        </header>
        <div ref={scroll} className={`workspace-scroll ${view ? 'show-detail' : ''}`}>
          {storageNotice && <p role="status" className="status-notice">Layouten sparas bara under den här sessionen eftersom webbläsarens lagring är otillgänglig.</p>}
          {error ? <div className="loading-state" role="alert"><h2>Data kunde inte läsas</h2><p>{error}</p><button onClick={() => window.location.reload()}>Försök igen</button></div> : !dashboard || !engine ? <div className="loading-state" role="status"><span className="loading-dot" /><h2>Din ledningsöversikt tar form.</h2><p>Läser demonstrationsdata och beräknar nyckeltal…</p></div> : <div aria-busy={busy} className={busy ? 'recomputing' : ''}>
            {view ? <Drilldown view={view} dashboard={dashboard} engine={engine} onView={setView} onHow={setCalculation} /> : <Canvas document={state.present} dashboard={dashboard} engine={engine} selected={selected} onSelect={setSelected} onLayout={layout => dispatch({ type: 'layout', layout })}
              onRemove={id => dispatch({ type: 'remove', id })} onAdd={add} onDrill={drill} onHow={setCalculation} onExplain={explain} onWatch={watch} onNote={(id, text) => dispatch({ type: 'note', id, text })} />}
          </div>}
        </div>
      </main>
      <AssistantPanel messages={intro} chips={chips} />
    </div>
    {calculation && <CalculationDrawer key={calculation.id} calculation={calculation} onClose={() => setCalculation(null)} />}
  </div>
}
