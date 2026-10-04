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
import { AgentRunController } from './analysis/runController'
import type { AgentResult, TraceStep } from './analysis/agent'
import { useActivity } from './analysis/activity'
import { cardTitle, calculationFor } from './components/CardContent'
import { metricInfo } from './components/charts/options'
import type { DatasetInfo } from './data/types'
import { loadMappedUpload, partialUploadMonths, assumptionFormula } from './data/engine.upload'
import { UploadDialog } from './components/upload/UploadDialog'
import { MappingDialog } from './components/upload/MappingDialog'
import type { UploadDraft } from './components/upload/MappingDialog'
import { DatasetPresentation, missingMetric, uploadDashboard } from './components/upload/DatasetPresentation'
const chips = [
  'Utforska marginalen', 'Varför ändrades marginalen?', 'Jämför omsättningen med förra året',
  'Visa marginal per produkt', 'Bevaka marginalen', 'Bygg en ledningsvy',
].map((label, index) => ({ id: `suggestion-${index}`, label }))
export default function App() {
  const [dataset, setDataset] = useState<DatasetInfo>({ source: 'demo', name: 'DemoCo AB', rowCount: 0, months: [], hasCost: true, mapping: {} })
  const [datasetRevision, setDatasetRevision] = useState(0)
  const [partialMonths, setPartialMonths] = useState<string[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadDraft, setUploadDraft] = useState<UploadDraft | null>(null)
  const [lastUpload, setLastUpload] = useState<UploadDraft | null>(null)
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([])
  const [datasetNotice, setDatasetNotice] = useState('')
  const dataGeneration = useRef(0)
  const [engine, setEngine] = useState<SqlEngine | null>(null)
  const [months, setMonths] = useState<string[]>([])
  const [month, setMonth] = useState('2026-08')
  const bootMonth = useRef<string | null>(null)
  const currentMonth = useRef(month)
  currentMonth.current = month
  const runs = useRef(new AgentRunController())
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [storageNotice, setStorageNotice] = useState(false)
  const [state, dispatch] = useReducer(layoutReducer, undefined, () => {
    try { return initialState(readDocument(localStorage.getItem(STORAGE_KEY))) } catch { return initialState() }
  })
  const [staggerRebuild, setStaggerRebuild] = useState(true)
  const [canvasRevision, setCanvasRevision] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<DetailView | null>(null)
  const [exitingDetail, setExitingDetail] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(exitTimer.current), [])
  function exitDetail() {
    if (!view || exitingDetail) return
    setExitingDetail(true)
    exitTimer.current = setTimeout(() => { setView(null); setExitingDetail(false); scroll.current?.scrollTo({ top: 0 }) }, 200)
  }
  const [calculation, setCalculation] = useState<Calculation | null>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const [steps, setSteps] = useState<TraceStep[]>([])
  const [analysis, setAnalysis] = useState<AgentResult | null>(null)
  const { activities, log } = useActivity()
  const fast = new URLSearchParams(location.search).get('fast') === '1'
  const loggedSteps = useRef(new Set<string>())

  function trace(next: TraceStep[]) {
    setSteps(next)
    next.forEach((step, index) => {
      const key = `${index}:${step.tool}:${step.status}`
      if ((step.status === 'done' || step.status === 'failed') && !loggedSteps.current.has(key)) {
        loggedSteps.current.add(key); log(`Verktyg: ${step.tool}`, `${step.summary} · ${step.status} · ${step.duration} ms`)
      }
    })
  }
  async function analyze(metric?: Metric) {
    if (!engine) return
    const runMonth = month
    const generation = dataGeneration.current
    const current = () => currentMonth.current === runMonth && dataGeneration.current === generation
    loggedSteps.current.clear(); log('Analys startad', fmtMonth(runMonth))
    try {
      const result = await runs.current.run(engine, runMonth, { metric, fast, dataset, onSteps: next => { if (current()) trace(next) } })
      if (result && current()) {
        setAnalysis(result); setDashboard(value => value?.month === runMonth ? { ...value, analysis: result } : value)
        log('Analys klar', result.confidence)
        return result
      }
    } catch (cause) {
      if (current()) log('Analys misslyckades', String(cause))
      return undefined
    }
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
        setDataset(demoDatasetInfo(rows))
        setMonths(demoDatasetInfo(rows).months)
        bootMonth.current = latest.data
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
    const generation = dataGeneration.current
    const current = () => !cancelled && currentMonth.current === month && dataGeneration.current === generation
    runs.current.cancel()
    setBusy(true); setError(null); setAnalysis(null); setSteps([])
    loggedSteps.current.clear(); log('Analys startad', fmtMonth(month))
    void loadDashboard(engine, month).then(async loaded => {
      if (!current()) return
      setDashboard(uploadDashboard(loaded, dataset))
      try {
        const result = await runs.current.run(engine, month, { fast, dataset, onSteps: next => { if (current()) trace(next) } })
        if (result && current()) {
          setAnalysis(result); setDashboard(value => value?.month === month ? { ...value, analysis: result } : value); log('Analys klar', result.confidence)
        }
      } catch (cause) { if (current()) log('Analys misslyckades', String(cause)) }
      finally { if (current()) setBusy(false) }
    }).catch(cause => { if (current()) { setError(String(cause)); setBusy(false) } })
    return () => { cancelled = true; runs.current.cancel() }
  }, [engine, month, datasetRevision])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.present)); setStorageNotice(false) } catch { setStorageNotice(true) }
  }, [state.present])

  function add(kind: CardKind, position?: { x: number; y: number }, metric: Metric = 'revenue', product?: string) {
    clearTimeout(exitTimer.current); setExitingDetail(false); setStaggerRebuild(false)
    const id = `${kind}-${crypto.randomUUID()}`
    log('Kort tillagt', kind === 'table' ? 'Tabell' : kind)
    dispatch({ type: 'add', card: { id, kind, metric, product, ...(kind === 'text' ? { text: '' } : {}) }, position })
    setSelected(id)
    setView(null)
    setTimeout(() => document.querySelector(`[data-card-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50)
  }
  function drill(metric: Metric, products = false, product?: string) {
    const missing = missingMetric(dataset, metric) || ((products || product) && dataset.source === 'upload' && !dataset.mapping.product ? 'Produktkolumn saknas. Ändra kolumnmappningen för att visa produkter.' : '')
    if (missing) { setDatasetNotice(missing); return }
    clearTimeout(exitTimer.current); setExitingDetail(false); setStaggerRebuild(false)
    setDatasetNotice(''); setView({ metric, stage: product ? 'orders' : products ? 'products' : 'trend', product }); scroll.current?.scrollTo({ top: 0 }); }
  function explain() { setView(null);
    const existing = state.present.cards.find(card => card.kind === 'waterfall')
    if (!existing) { add('waterfall', undefined, 'margin'); return }
    setSelected(existing.id); log('Förklaring fokuserad'); setTimeout(() => document.querySelector(`[data-card-id="${existing.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 20) }
  function restore() { setStaggerRebuild(true); clearTimeout(exitTimer.current); setExitingDetail(false); setCanvasRevision(value => value + 1); log('Ledningsvy återbyggd'); dispatch({ type: 'reset' }); setView(null); setSelected(null); setMonth(bootMonth.current ?? month); scroll.current?.scrollTo({ top: 0 }) }
  function watch() { if (missingMetric(dataset, 'margin')) { setDatasetNotice(missingMetric(dataset, 'margin')); return } window.dispatchEvent(new CustomEvent('canvas-bi:watch', { detail: { metric: 'margin', month } })) }
  function remove(id: string) { dispatch({ type: 'remove', id }); log('Kort borttaget', state.present.cards.find(card => card.id === id)?.kind); if (selected === id) setSelected(null) }
  async function applyUpload(draft: UploadDraft, assumedMarginPct?: number) {
    if (!engine) throw new Error('Vänta tills data har lästs in.')
    runs.current.cancel(); dataGeneration.current++; setBusy(true); setSteps([])
    try {
      const info = await loadMappedUpload(engine, draft.parsed, draft.mapping, draft.name, assumedMarginPct)
      const latest = await latestCompleteMonth(engine)
      setPartialMonths(await partialUploadMonths(engine))
      setDashboard(null); setAnalysis(null); setSteps([]); setView(null); setSelected(null); setCalculation(null)
      bootMonth.current = latest.data ?? info.months.at(-1)!
      clearTimeout(exitTimer.current); setExitingDetail(false); setStaggerRebuild(false)
      setLastUpload(draft); setDataset(info); setMonths(info.months); setMonth(latest.data ?? info.months.at(-1)!)
      setUploadWarnings(info.warnings.filter(warning => !warning.startsWith('Ingen kostnad'))); setDatasetNotice('')
      dispatch({ type: 'reset' }); setCanvasRevision(value => value + 1); setDatasetRevision(value => value + 1)
      scroll.current?.scrollTo({ top: 0 }); log('Data inläst', info.name)
    } catch (cause) { setBusy(false); throw cause }
  }
  async function resetDemo() {
    if (dataset.source === 'demo') { restore(); return }
    if (!engine || busy) return
    runs.current.cancel(); dataGeneration.current++; setBusy(true)
    try {
      const rows = generateDemoData()
      await engine.loadOrderLines(rows)
      setDashboard(null); setDataset(demoDatasetInfo(rows)); setMonths(demoDatasetInfo(rows).months); setMonth(bootMonth.current = (await latestCompleteMonth(engine)).data!)
      setLastUpload(null); setPartialMonths([]); setUploadWarnings([]); setDatasetNotice(''); setCalculation(null)
      restore(); setDatasetRevision(value => value + 1)
    } catch (cause) { setError(String(cause)); setBusy(false) }
  }
  function showCalculation(value: Calculation) {
    setCalculation(dataset.assumption ? { ...value, title: `ANTAGANDE · ${value.title}`, formula: `${assumptionFormula(dataset.assumption.pct)} ${value.formula}` } : value)
  }
  const selectedCard = state.present.cards.find(card => card.id === selected)
  const selectedMetric = selectedCard?.metric ?? (selectedCard?.kind === 'waterfall' || selectedCard?.kind === 'insight' ? analysis?.metric ?? 'margin' : 'revenue')
  const title = view ? metricInfo[view.metric].label : 'Ledningsöversikt'

  return <div data-testid="app-root" data-ready={dashboard && !busy ? 'true' : 'false'} className={`app ${dataset.source === 'upload' ? 'uploaded-data' : ''}`}>
    {dataset.source === 'demo' && <div data-testid="demo-banner" className="demo-banner">KONCEPTDEMO – syntetisk demonstrationsdata</div>}
    <div className="app-shell">
      <div className="upload-sidebar sidebar"><Palette onAdd={kind => add(kind)} /><button className="upload-entry" data-testid="upload-entry" disabled={!engine || busy} onClick={() => setUploadOpen(true)}>Ladda upp data</button></div>
      <main className="workspace canvas-area">
        <header className="workspace-header">
          {view ? <nav className="breadcrumbs" aria-label="Navigering"><button onClick={() => setView({ metric: view.metric, stage: 'trend' })}>{title}</button>{view.stage !== 'trend' && <><span>›</span><button onClick={() => setView({ metric: view.metric, stage: 'products' })}>Per produkt</button></>}{view.product && <><span>›</span><strong>{view.product}</strong></>}</nav> : <div><h1>{title}</h1>{dataset.source === 'upload' && <span className="dataset-name" data-testid="dataset-name">{dataset.name}</span>}</div>}
          <div className="workspace-actions">
            {view ? <><button className="toolbar-button" onClick={() => add(view.stage === 'trend' ? 'trend' : view.stage === 'orders' ? 'table' : 'bars', undefined, view.metric, view.product)}>Lägg på ytan</button><button className="toolbar-button" onClick={exitDetail}>Tillbaka till ytan</button></> : <>
              <select aria-label="Period" value={month} onChange={event => { setMonth(event.target.value); setCalculation(null) }}>{(months.length ? months : [month]).map(value => <option key={value} value={value}>{fmtMonth(value).charAt(0).toUpperCase() + fmtMonth(value).slice(1)}{partialMonths.includes(value) ? ' · pågående' : ''}</option>)}</select>
              <button className="toolbar-button" onClick={() => dispatch({ type: 'undo' })} disabled={!state.past.length}>Ångra</button>
              <button className="toolbar-button" onClick={() => { dispatch({ type: 'clear' }); setSelected(null) }}>Töm ytan</button>
              <button className="reset-button toolbar-button" disabled={busy} onClick={() => void resetDemo()}>Återställ demon</button>
            </>}
          </div>
        </header>
        <div ref={scroll} className={`workspace-scroll ${view ? 'show-detail' : ''}`}>
          {dataset.source === 'upload' && <section className="upload-status" data-testid="upload-status" aria-live="polite">
            {!dataset.hasCost ? <><strong>Marginalanalysen stoppades: kostnad saknas.</strong><p>Bruttomarginal kan inte beräknas utan kostnad. Mappa en kostnadskolumn eller välj ett uttryckligt antagande. Omsättning och tillgängliga order- och kundtal fungerar fortfarande.</p></>
              : dataset.assumption ? <><strong>ANTAGANDE · marginalen är antagen, inte uppmätt.</strong><p>Alla marginalvärden bygger på ditt uttryckliga antagande. Kostnadsorsaker kan inte fastställas.</p></> : <p>Data stannar i din webbläsare · {dataset.name}</p>}
            {lastUpload && <button disabled={busy} onClick={() => setUploadDraft(lastUpload)}>Ändra kolumnmappning</button>}
            {!dataset.hasCost && lastUpload && <button className="primary" disabled={busy} onClick={() => void applyUpload(lastUpload, 50).catch(cause => setDatasetNotice(String(cause)))}>Anta 50 % bruttomarginal</button>}
            {uploadWarnings.map(warning => <p key={warning}>{warning}</p>)}
            {datasetNotice && <p role="status">{datasetNotice}</p>}
          </section>}
          {storageNotice && <p role="status" className="status-notice">Layouten sparas bara under den här sessionen eftersom webbläsarens lagring är otillgänglig.</p>}
          {error ? <div className="loading-state" role="alert"><h2>Data kunde inte läsas</h2><p>{error}</p><button onClick={() => window.location.reload()}>Försök igen</button></div> : !dashboard || !engine ? <div className="loading-state" role="status"><span className="loading-dot" /><h2>Din ledningsöversikt tar form.</h2><p>Läser demonstrationsdata och beräknar nyckeltal…</p></div> : <div aria-busy={busy} className={busy ? 'recomputing' : ''}>
            {view ? <Drilldown exiting={exitingDetail} view={view} dashboard={dashboard} engine={engine} onView={setView} onHow={showCalculation} /> : <Canvas key={canvasRevision} staggerRebuild={staggerRebuild} document={state.present} dashboard={dashboard} engine={engine} selected={selected} onSelect={setSelected} onLayout={layout => dispatch({ type: 'layout', layout })}
              onRemove={remove} onAdd={add} onDrill={drill} onHow={showCalculation} onExplain={explain} onWatch={watch} onNote={(id, text) => dispatch({ type: 'note', id, text })} />}
            {!view && !state.present.cards.length && <div className="empty-upload-entry"><button disabled={busy} onClick={() => setUploadOpen(true)}>Ladda upp data</button><p className="upload-remap-notice">Data stannar i din webbläsare</p></div>}
          </div>}
        </div>
      </main>
      <AssistantPanel key={datasetRevision} analyzing={busy || steps.some(step => step.status === 'running')} chips={chips} engine={engine} dashboard={dashboard} steps={steps} result={analysis} activities={activities} log={log}
        selected={selectedCard ? { title: cardTitle(selectedCard), metric: selectedMetric } : undefined} onClearSelection={() => setSelected(null)}
        onAnalyze={analyze} onExplain={explain} onDrill={drill} onAdd={(kind, metric) => add(kind, undefined, metric)} onRebuild={restore}
        onRemove={kind => { const card = kind ? state.present.cards.find(card => card.kind === kind) : selectedCard; if (!card) return false; remove(card.id); return true }}
        onHow={metric => { if (dashboard) showCalculation(calculationFor(selectedCard && selectedMetric === metric ? selectedCard : { id: `assistant-${metric}`, kind: 'kpi', metric }, dashboard)) }} />
    </div>
    <DatasetPresentation dataset={dataset} cards={state.present.cards} />
    {uploadOpen && <UploadDialog onParsed={draft => { setUploadOpen(false); setUploadDraft(draft) }} onClose={() => setUploadOpen(false)} />}
    {uploadDraft && <MappingDialog key={uploadDraft.name} draft={uploadDraft} onConfirm={applyUpload} onClose={() => setUploadDraft(null)} />}
    {calculation && <CalculationDrawer key={calculation.id} calculation={calculation} onClose={() => setCalculation(null)} />}
  </div>
}
