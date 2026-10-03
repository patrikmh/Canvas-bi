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
import { runAgent } from './analysis/agent'
import type { AgentResult, TraceStep } from './analysis/agent'
import { useActivity } from './analysis/activity'
import { cardTitle, calculationFor } from './components/CardContent'
import { metricInfo } from './components/charts/options'

const chips = [
  'Utforska marginalen', 'Varför ändrades marginalen?', 'Jämför omsättningen med förra året',
  'Visa marginal per produkt', 'Bevaka marginalen', 'Bygg en ledningsvy',
].map((label, index) => ({ id: `suggestion-${index}`, label }))
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
  const [canvasRevision, setCanvasRevision] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<DetailView | null>(null)
  const [calculation, setCalculation] = useState<Calculation | null>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const [steps, setSteps] = useState<TraceStep[]>([])
  const [analysis, setAnalysis] = useState<AgentResult | null>(null)
  const { activities, log } = useActivity()
  const fast = new URLSearchParams(location.search).get('fast') === '1'
  const loggedSteps = useRef(new Set<number>())

  function trace(next: TraceStep[]) {
    setSteps(next)
    next.forEach((step, index) => {
      if ((step.status === 'done' || step.status === 'failed') && !loggedSteps.current.has(index)) {
        loggedSteps.current.add(index); log(`Verktyg: ${step.tool}`, `${step.summary} · ${step.status} · ${step.duration} ms`)
      }
    })
  }
  async function analyze(metric?: Metric) {
    if (!engine) return
    loggedSteps.current.clear(); log('Analys startad', fmtMonth(month))
    const result = await runAgent(engine, month, { metric, fast, onSteps: trace })
    setAnalysis(result); setDashboard(current => current ? { ...current, analysis: result } : current)
    log('Analys klar', result.confidence)
    return result
  }

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
        log('Data inläst', 'Demonstrationsdata')
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
    const controller = new AbortController()
    setBusy(true); setError(null); setAnalysis(null); setSteps([])
    loggedSteps.current.clear(); log('Analys startad', fmtMonth(month))
    void loadDashboard(engine, month).then(async dashboard => {
      if (cancelled) return
      setDashboard(dashboard)
      const result = await runAgent(engine, month, { fast, signal: controller.signal, onSteps: next => { if (!cancelled) trace(next) } })
      if (!cancelled) { setAnalysis(result); setDashboard({ ...dashboard, analysis: result }); setBusy(false); log('Analys klar', result.confidence) }
    }).catch(cause => { if (!cancelled) { setError(String(cause)); setBusy(false) } })
    return () => { cancelled = true; controller.abort() }
  }, [engine, month])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.present)); setStorageNotice(false) } catch { setStorageNotice(true) }
  }, [state.present])

  function add(kind: CardKind, position?: { x: number; y: number }, metric: Metric = 'revenue', product?: string) {
    const id = `${kind}-${crypto.randomUUID()}`
    log('Kort tillagt', kind === 'table' ? 'Tabell' : kind)
    dispatch({ type: 'add', card: { id, kind, metric, product, ...(kind === 'text' ? { text: '' } : {}) }, position })
    setSelected(id)
    setView(null)
    setTimeout(() => document.querySelector(`[data-card-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50)
  }
  function drill(metric: Metric, products = false, product?: string) { setView({ metric, stage: product ? 'orders' : products ? 'products' : 'trend', product }); scroll.current?.scrollTo({ top: 0 }); }
  function explain() { setView(null);
    const existing = state.present.cards.find(card => card.kind === 'waterfall')
    if (!existing) { add('waterfall', undefined, 'margin'); return }
    setSelected(existing.id); log('Förklaring fokuserad'); setTimeout(() => document.querySelector(`[data-card-id="${existing.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 20) }
  function restore() { setCanvasRevision(value => value + 1); log('Ledningsvy återbyggd'); dispatch({ type: 'reset' }); setView(null); setSelected(null); setMonth(months.at(-1) ?? '2026-08'); scroll.current?.scrollTo({ top: 0 }) }
  function watch() { window.dispatchEvent(new CustomEvent('canvas-bi:watch', { detail: { metric: 'margin', month } })) }
  function remove(id: string) { dispatch({ type: 'remove', id }); log('Kort borttaget', state.present.cards.find(card => card.id === id)?.kind); if (selected === id) setSelected(null) }
  useEffect(() => {
    const uploaded = () => log('Uppladdning mottagen')
    window.addEventListener('canvas-bi:upload', uploaded)
    return () => window.removeEventListener('canvas-bi:upload', uploaded)
  }, [log])
  const selectedCard = state.present.cards.find(card => card.id === selected)
  const selectedMetric = selectedCard?.metric ?? (selectedCard?.kind === 'waterfall' || selectedCard?.kind === 'insight' ? analysis?.metric ?? 'margin' : 'revenue')
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
            {view ? <Drilldown view={view} dashboard={dashboard} engine={engine} onView={setView} onHow={setCalculation} /> : <Canvas key={canvasRevision} document={state.present} dashboard={dashboard} engine={engine} selected={selected} onSelect={setSelected} onLayout={layout => dispatch({ type: 'layout', layout })}
              onRemove={remove} onAdd={add} onDrill={drill} onHow={setCalculation} onExplain={explain} onWatch={watch} onNote={(id, text) => dispatch({ type: 'note', id, text })} />}
          </div>}
        </div>
      </main>
      <AssistantPanel chips={chips} engine={engine} dashboard={dashboard} steps={steps} result={analysis} activities={activities} log={log}
        selected={selectedCard ? { title: cardTitle(selectedCard), metric: selectedMetric } : undefined} onClearSelection={() => setSelected(null)}
        onAnalyze={analyze} onExplain={explain} onDrill={drill} onAdd={(kind, metric) => add(kind, undefined, metric)} onRebuild={restore}
        onRemove={kind => { const card = kind ? state.present.cards.find(card => card.kind === kind) : selectedCard; if (!card) return false; remove(card.id); return true }}
        onHow={metric => { if (dashboard) setCalculation(calculationFor(selectedCard && selectedMetric === metric ? selectedCard : { id: `assistant-${metric}`, kind: 'kpi', metric }, dashboard)) }} />
    </div>
    {calculation && <CalculationDrawer key={calculation.id} calculation={calculation} onClose={() => setCalculation(null)} />}
  </div>
}
