import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SqlEngine } from '../data/engine'
import { generateDemoData, demoDatasetInfo } from '../data/generate'
import type { DatasetInfo } from '../data/types'
import { latestCompleteMonth } from '../data/metrics'
import type { MetricResult, WaterfallStep } from '../data/metrics'
import { fmtMonth, fmtPct } from '../data/format'
import { AgentRunController } from '../analysis/runController'
import type { AgentResult, TraceStep } from '../analysis/agent'
import { comparisonAnswer, monthAnswer } from '../analysis/answers'
import { matchIntent } from '../analysis/intents'
import type { Intent } from '../analysis/intents'
import { useActivity, timestamp } from '../analysis/activity'
import { watchTriggers } from '../analysis/watch'
import type { Watch } from '../analysis/watch'
import { deriveFindings, memoStatus, runIdentity, stepInput } from '../components/assistant/memo'
import type { FindingReview } from '../components/assistant/memo'
import { CalculationDrawer } from '../components/CalculationDrawer'
import type { Calculation } from '../components/CalculationDrawer'
import { findingStore } from '../components/charts/findings'
import { analysisWaterfall, citationRows, loadSessionData, reviewFinding } from './session-data'
import type { Review, SessionData } from './session-data'

async function createDemoEngine() {
  const { createBrowserEngine } = await import('../data/engine.browser')
  return createBrowserEngine()
}
function useSessionState(createEngine: () => Promise<SqlEngine>) {
  const [engine, setEngine] = useState<SqlEngine | null>(null)
  const [dataset, setDataset] = useState<DatasetInfo | null>(null)
  const [month, setMonth] = useState('')
  const [data, setData] = useState<SessionData | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AgentResult | null>(null)
  const [trace, setTrace] = useState<TraceStep[]>([])
  const [waterfall, setWaterfall] = useState<MetricResult<WaterfallStep[]> | null>(null)
  const [reviews, setReviews] = useState<Record<number, Review>>({})
  const [watch, setWatch] = useState<Watch | null>(null)
  const [watchApproved, setWatchApproved] = useState(false)
  const [reviewer, setReviewer] = useState('Granskare')
  const [reviewedAt, setReviewedAt] = useState<string | null>(null)
  const [calculation, setCalculation] = useState<Calculation | null>(null)
  const { activities, log } = useActivity()
  const runs = useRef(new AgentRunController())
  const request = useRef(0)
  const citationRequest = useRef(0)
  const selectedMonth = useRef(month)
  selectedMonth.current = month
  const fast = new URLSearchParams(location.search).get('fast') === '1'

  useEffect(() => {
    let cancelled = false
    let live: SqlEngine | undefined
    async function boot() {
      let instance: SqlEngine | undefined
      try {
        instance = await createEngine()
        if (cancelled) { await instance.close(); return }
        const rows = generateDemoData()
        await instance.loadOrderLines(rows)
        const latest = await latestCompleteMonth(instance)
        if (cancelled) { await instance.close(); return }
        if (!latest.data) throw new Error('Ingen fullständig månad hittades.')
        live = instance
        setDataset(demoDatasetInfo(rows)); setMonth(latest.data); setEngine(live)
        log('Data inläst', 'Demonstrationsdata')
      } catch (cause) {
        await instance?.close()
        if (!cancelled) { setError(String(cause)); setBusy(false) }
      }
    }
    void boot()
    return () => { cancelled = true; request.current++; citationRequest.current++; runs.current.cancel(); void live?.close() }
  }, [log, createEngine])

  async function runAnalysis(question?: string) {
    if (!engine || !dataset || !month) return undefined
    const token = ++request.current
    citationRequest.current++; setCalculation(null)
    setBusy(true); setError(null); setResult(null); setTrace([]); setWaterfall(null)
    setReviews({}); setWatchApproved(false); setReviewedAt(null)
    log('Analys startad', fmtMonth(month))
    const logged = new Set<string>()
    try {
      const analysis = await runs.current.run(engine, month, { fast, dataset, metric: question ? matchIntent(question).metric : undefined,
        onSteps: steps => {
          if (token !== request.current) return
          setTrace(steps)
          steps.forEach((step, index) => {
            const key = `${index}:${step.status}`
            if (['done', 'failed'].includes(step.status) && !logged.has(key)) {
              logged.add(key); log(`Verktyg: ${step.tool}`, step.summary)
            }
          })
        } })
      if (!analysis || token !== request.current) return undefined
      const breakdown = await analysisWaterfall(engine, analysis)
      if (token !== request.current) return undefined
      setResult(analysis); setWaterfall(breakdown); log('Analys klar', analysis.confidence)
      return analysis
    } catch (cause) {
      if (token === request.current) { setError(String(cause)); log('Analys misslyckades', String(cause)) }
      return undefined
    } finally { if (token === request.current) setBusy(false) }
  }

  useEffect(() => {
    if (!engine || !month) return
    let cancelled = false
    const token = ++request.current
    runs.current.cancel(); citationRequest.current++; setCalculation(null)
    setBusy(true); setError(null); setData(null); setResult(null); setTrace([]); setWaterfall(null)
    setReviews({}); setWatchApproved(false); setReviewedAt(null)
    void loadSessionData(engine, month).then(async loaded => {
      if (cancelled || token !== request.current) return
      setData(loaded)
      await runAnalysis()
    }).catch(cause => { if (!cancelled && token === request.current) { setError(String(cause)); setBusy(false) } })
    return () => { cancelled = true; request.current++; runs.current.cancel() }
  }, [engine, month])

  useEffect(() => {
    const breakpoint = result?.steps.find(step => step.tool === 'findLatestChange')
    const changeStart = data?.series.data.find(row => breakpoint?.summary.includes(fmtMonth(row.month)))?.month ?? null
    findingStore.publish(result && !busy ? { result, changeStart } : null)
    return () => findingStore.publish(null)
  }, [result, data, busy])

  const findings = deriveFindings(result)
  const status = memoStatus(findings.map(finding => reviews[finding.number]?.status ?? 'pending'), watchApproved, !!result && !busy)
  function review(number: number, value: Exclude<FindingReview, 'pending'>, reason = '') {
    if (busy || !findings.some(finding => finding.number === number)) return
    const next = reviewFinding(reviews, number, value, reason)
    setReviews(next)
    const labels = { pending: 'Utkast', accepted: 'Accepterat', edited: 'Ändringsförslag', rejected: 'Avvisat' }
    log(value === 'accepted' ? 'Fynd accepterat' : value === 'edited' ? 'Ändring föreslagen' : 'Fynd avvisat', `Fynd ${number}: ${labels[reviews[number]?.status ?? 'pending']} → ${labels[value]}${reason.trim() ? `; ${reason.trim()}` : ''}`)
    const approved = memoStatus(findings.map(finding => next[finding.number]?.status ?? 'pending'), watchApproved, true) === 'Godkänd'
    setReviewedAt(approved ? timestamp() : null)
    if (approved) log('Analysanteckning godkänd', reviewer)
  }
  function signOff(name: string) {
    if (status !== 'Godkänd' || !name.trim()) return
    setReviewer(name.trim()); setReviewedAt(timestamp()); log('Analysanteckning signerad', name.trim())
  }
  function proposeWatch() {
    if (!data || busy || watch?.status === 'Föreslagen') return
    setWatch({ id: crypto.randomUUID(), threshold: 46, drop: 2, channel: 'E-post', owner: dataset?.name ?? 'DemoCo AB', frequency: 'Dagligen', status: 'Föreslagen' })
    log('Bevakning föreslagen', 'Inväntar uttryckligt godkännande; simulerad bevakning.')
  }
  function updateWatch(next: Watch) {
    if (busy || !watch || watch.status !== 'Föreslagen' || watch.id !== next.id) return
    const active = next.status === 'Aktiv'
    const snapshot = data?.dashboard.snapshot.data.margin
    const triggered = active && snapshot && watchTriggers(next, snapshot.current, snapshot.previousMonth)
    const alert = triggered ? `Simulerat larm: bruttomarginal ${fmtPct(snapshot.current)} i ${fmtMonth(month)}.` : undefined
    setWatch({ ...next, alert })
    log(active ? 'Bevakning godkänd' : next.status === 'Avvisad' ? 'Bevakning avvisad' : 'Bevakning ändrad', `${watch.status} → ${next.status}; tröskel ${fmtPct(watch.threshold, 0)} → ${fmtPct(next.threshold, 0)}; ${next.channel}; ${next.owner}`)
    if (active) { setWatchApproved(true); setReviewedAt(timestamp()); log('Analysanteckning godkänd', reviewer) }
    if (alert) log('Simulerat larm', alert)
  }
  async function openCitation(ref: TraceStep | Calculation, number?: number) {
    if (!engine) return
    const token = ++citationRequest.current
    const step = 'tool' in ref ? ref : null
    const base: Calculation = step ? { id: `citation-${runIdentity(activities).id}-${number ?? ''}-${step.tool}`, title: `${number ? `Fynd ${number} · ` : ''}${step.tool}`, sql: step.sql, formula: `Verktyg: ${step.tool}. Indata: ${JSON.stringify(step.input)}. Resultatrader hämtas från samma SQL.`, value: step.summary } : ref as Calculation
    setCalculation(base)
    try {
      const batches = await citationRows(engine, { sql: ref.sql } as TraceStep)
      const format = (value: unknown) => typeof value === 'number' ? new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 4 }).format(value).replace(/-/g, '−') : value == null ? '—' : String(value)
      const preview = batches.map(rows => rows.slice(0, 12).map(row => Object.entries(row).map(([key, value]) => `${key}: ${format(value)}`).join('; ')).join(' | ') || 'Inga rader.').join(' / Nästa verktygsfråga: ')
      if (token === citationRequest.current) setCalculation({ ...base, formula: `${base.formula} Resultatrader (urval): ${preview}` })
    } catch {
      if (token === citationRequest.current) setCalculation({ ...base, formula: `${base.formula} Resultatrader kunde inte hämtas. Kör om analysen och kontrollera SQL.` })
    }
  }
  async function ask(text: string): Promise<{ intent: Intent; text: string }> {
    const intent = matchIntent(text)
    if (!engine || !data || busy) return { intent, text: 'Vänta tills data och analys är klara.' }
    const token = request.current
    log('Assistentfråga', text)
    let answer: string
    if (intent.kind === 'explain') {
      const analysis = await runAnalysis(text)
      answer = analysis ? `Analys för ${fmtMonth(month)}. ${analysis.text}` : 'Analysen kunde inte slutföras.'
    }
    else if (intent.kind === 'monthMargin') answer = (await monthAnswer(engine, intent.month!, intent.metric ?? 'margin')).text
    else if (intent.kind === 'watch') { proposeWatch(); answer = 'Bevakningen är simulerad och aktiveras efter ditt godkännande.' }
    else if (intent.kind === 'formula') {
      const info = data.dashboard.snapshot
      await openCitation({ id: 'snapshot', title: 'Nyckeltal per månad', ...info, value: comparisonAnswer(intent.metric ?? 'revenue', month, info.data) })
      answer = 'Beräkningen visas med SQL och resultatrader.'
    } else if (['margin', 'revenue', 'marginProducts', 'revenueProducts'].includes(intent.kind)) answer = comparisonAnswer(intent.metric ?? 'revenue', month, data.dashboard.snapshot.data)
    else answer = 'Fråga om nyckeltal, produktjämförelser, en månad, beräkningar eller bevakning. Förklaring av förändringen kan köras offline.'
    if (selectedMonth.current !== month) return { intent, text: '' }
    if (token === request.current || intent.kind === 'explain') log('Uppföljning', answer)
    return { intent, text: answer }
  }
  const periodStep = result?.steps.find(step => ['marginWaterfall', 'allocateProductChanges'].includes(step.tool))
  const input = periodStep ? stepInput(periodStep) : {}
  const months = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  return { dataset, month, months: dataset?.months ?? [], selectMonth: (value: string) => {
    if (!dataset?.months.includes(value) || value === month) return
    selectedMonth.current = value; request.current++; citationRequest.current++; runs.current.cancel(); setBusy(true); setCalculation(null); setMonth(value)
  }, ready: !!data && !!result && !busy, busy, error, dashboard: data?.dashboard ?? null,
    snapshot: data?.dashboard.snapshot ?? null, series: data?.series ?? null, productSeries: data?.productSeries ?? {},
    products: data?.dashboard.products ?? null, waterfall, period: { before: months(input.before), after: months(input.after) },
    runAnalysis, result, trace, findings, reviews, reviewFinding: review, memoStatus: status,
    signOff, signoff: { preparedBy: 'Analysagent (offline-läge, regelbaserad)', run: runIdentity(activities), reviewer: status === 'Godkänd' ? reviewer : null, reviewedAt: status === 'Godkänd' ? reviewedAt : null },
    watch, proposeWatch, updateWatch, approveWatch: () => { if (watch) updateWatch({ ...watch, status: 'Aktiv' }) },
    rejectWatch: () => { if (watch) updateWatch({ ...watch, status: 'Avvisad' }) }, activities, ask, openCitation,
    calculation, closeCitation: () => { citationRequest.current++; setCalculation(null) } }
}

export type AnalystSession = ReturnType<typeof useSessionState>
const SessionContext = createContext<AnalystSession | null>(null)
export function AnalystSessionProvider({ children, createEngine = createDemoEngine }: { children: ReactNode; createEngine?: () => Promise<SqlEngine> }) {
  const session = useSessionState(createEngine)
  return <SessionContext.Provider value={session}>{children}
    {session.calculation && <CalculationDrawer key={session.calculation.id} calculation={session.calculation} onClose={session.closeCitation} />}
  </SessionContext.Provider>
}
export function useAnalystSession(): AnalystSession {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useAnalystSession requires AnalystSessionProvider')
  return session
}
