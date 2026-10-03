import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SqlEngine } from '../../data/engine'
import type { Dashboard } from '../../analysis/dashboard'
import type { AgentResult, TraceStep } from '../../analysis/agent'
import type { Activity } from '../../analysis/activity'
import { timestamp } from '../../analysis/activity'
import { chooseIntent, readSettings } from '../../analysis/llm'
import { comparisonAnswer, monthAnswer } from '../../analysis/answers'
import { fmtDeltaPct, fmtMonth, fmtPct, fmtPp } from '../../data/format'
import type { CardKind, Metric } from '../../canvas/layout'
import { metricInfo } from '../charts/options'
import { watchTriggers } from '../../analysis/watch'
import type { Watch } from '../../analysis/watch'
import { WatchCard } from './WatchCard'
import { SettingsDialog } from './SettingsDialog'
import './assistant.css'

export interface AssistantMessage { id: string; role: 'assistant' | 'user'; content: ReactNode }
export interface AssistantChip { id: string; label: string }
interface Props {
  analyzing: boolean; chips: AssistantChip[]; engine: SqlEngine | null; dashboard: Dashboard | null; steps: TraceStep[]; result: AgentResult | null
  activities: Activity[]; log: (action: string, detail?: string) => void
  selected?: { title: string; metric: Metric }; onClearSelection: () => void
  onAnalyze: (metric?: Metric) => Promise<AgentResult | undefined>; onExplain: () => void
  onDrill: (metric: Metric, products?: boolean) => void; onAdd: (kind: CardKind, metric?: Metric) => void
  onRemove: (kind?: CardKind) => boolean; onRebuild: () => void; onHow: (metric: Metric) => void
}
export function AssistantPanel(props: Props) {
  const { chips, engine, dashboard, steps, result, activities, log, selected } = props
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('Assistent')
  const [sending, setSending] = useState(false)
  const [settings, setSettings] = useState(readSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [watches, setWatches] = useState<Watch[]>([])
  const bottom = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const say = (content: ReactNode, role: AssistantMessage['role'] = 'assistant') => setMessages(items => [...items, { id: crypto.randomUUID(), role, content }])
  useEffect(() => {
    if (tab === 'Assistent') bottom.current?.scrollIntoView({ block: 'nearest' })
    else bottom.current?.parentElement?.scrollTo({ top: 0 })
  }, [messages, tab, watches.length])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    function propose() {
      if (!dashboard) return
      setTab('Assistent'); setOpen(true)
      setWatches(items => [...items, { id: crypto.randomUUID(), threshold: 46, drop: 2, channel: 'E-post', owner: 'DemoCo AB', frequency: 'Dagligen', status: 'Föreslagen' }])
      log('Bevakning föreslagen', 'APPROVAL REQUIRED — inväntar godkännande')
    }
    window.addEventListener('canvas-bi:watch', propose)
    return () => window.removeEventListener('canvas-bi:watch', propose)
  }, [dashboard, log])
  function updateWatch(next: Watch) {
    const prior = watches.find(item => item.id === next.id)
    if (prior?.status !== 'Föreslagen') return
    setWatches(items => items.map(item => item.id === next.id ? next : item))
    log(next.status === 'Aktiv' ? 'Bevakning godkänd' : next.status === 'Avvisad' ? 'Bevakning avvisad' : 'Bevakning ändrad', `Tröskel ${fmtPct(next.threshold, 0)} · ${next.channel} · ${next.owner}`)
    if (next.status === 'Aktiv') {
      setTab('Bevakningar')
      const snapshot = dashboard?.snapshot.data
      if (snapshot && watchTriggers(next, snapshot.margin.current, snapshot.margin.previousMonth)) {
        timers.current.push(setTimeout(() => {
          const rule = (snapshot.margin.current ?? Infinity) < next.threshold ? `${fmtPct(snapshot.margin.current)} < ${fmtPct(next.threshold, 0)}` : `fall ${fmtPp((snapshot.margin.previousMonth ?? 0) - (snapshot.margin.current ?? 0)).replace('+', '')} > ${fmtPp(next.drop).replace('+', '')}`
          const alert = `Larm: bruttomarginalen ${rule} · ${timestamp()}`
          setWatches(items => items.map(item => item.id === next.id ? { ...item, alert } : item)); log('Simulerat larm', alert)
        }, new URLSearchParams(location.search).has('fast') ? 0 : 700))
      }
    }
  }
  async function send(text: string, freeText = false) {
    if (!engine || !dashboard || sending || props.analyzing) return
    setSending(true); setTab('Assistent'); say(text, 'user'); log('Assistentfråga', text)
    try {
      const chosen = await chooseIntent(text, freeText ? settings : { ...settings, enabled: false }, selected?.metric)
      const intent = chosen.intent
      log('Verktyg: assistant_action', JSON.stringify(intent))
      if (chosen.wording) say(<p>{chosen.wording}</p>)
      if (chosen.fallback) say(<small className="muted">{chosen.fallbackReason === 'not-understood' ? 'LLM förstod inte frågan. Svaret kommer från offline-assistenten.' : chosen.fallbackReason === 'timeout' ? 'LLM svarade inte i tid. Svaret kommer från offline-assistenten.' : 'LLM kunde inte nås. Svaret kommer från offline-assistenten.'}</small>)
      switch (intent.kind) {
        case 'explain': {
          if (intent.metric && intent.metric !== 'margin') {
            const metric = intent.metric
            props.onDrill(metric, true)
            say(`${metricInfo[metric].label} för ${fmtMonth(dashboard.month)} är ${metricInfo[metric].format(dashboard.snapshot.data[metric].current)}, ${fmtDeltaPct(dashboard.snapshot.data[metric].deltaYoY)} mot i fjol. Produktjämförelsen visar var förändringen finns; välj en produkt för att kontrollera orderraderna.`)
            break
          }
          const analysis = await props.onAnalyze(intent.metric)
          if (analysis) say(<><p>{analysis.text}</p><span className={`confidence ${analysis.confidence.startsWith('Låg') ? 'low' : ''}`}>{analysis.confidence}</span><br /><button className="primary" onClick={props.onExplain}>Visa förklaringen</button></>)
          break
        }
        case 'margin':
        case 'revenue': {
          const metric = intent.metric ?? (intent.kind === 'margin' ? 'margin' : 'revenue')
          props.onDrill(metric); say(comparisonAnswer(metric, dashboard.month, dashboard.snapshot.data)); break
        }
        case 'marginProducts': {
          props.onDrill('margin', true)
          const rows = dashboard.marginProducts.data.filter(row => row.outlier).sort((a, b) => (a.marginDeltaPp ?? 0) - (b.marginDeltaPp ?? 0))
          const remaining = dashboard.marginProducts.data.filter(row => !row.outlier)
          say(rows.length ? <p>Produkter som sticker ut mot samma månad i fjol: {rows.map(row => `${row.product} (${fmtPp(row.marginDeltaPp)})`).join(' och ')}. {remaining.length && remaining.every(row => row.marginDeltaPp != null && Math.abs(row.marginDeltaPp) <= 2) ? 'Övriga ligger inom 2 procentenheter från fjolårets nivå.' : 'Jämför övriga produkter i diagrammet.'}</p> : 'Inga stora marginalfall per produkt hittades. Se produktjämförelsen.'); break
        }
        case 'revenueProducts': props.onDrill(intent.metric ?? 'revenue', true); say('Produktjämförelsen är öppen. Klicka på en produkt för att visa orderrader.'); break
        case 'watch': window.dispatchEvent(new CustomEvent('canvas-bi:watch')); break
        case 'rebuild': props.onRebuild(); say('Ledningsvyn är återbyggd med Insikt, nyckeltal, trender och förklaring.'); break
        case 'add': if (intent.card) { props.onAdd(intent.card, intent.metric); say('Kortet har lagts på ytan.') } break
        case 'remove': say(props.onRemove(intent.card) ? 'Kortet har tagits bort från ytan.' : 'Markera kortet du vill ta bort, eller ange korttypen.'); break
        case 'monthMargin': {
          const metric = intent.metric ?? 'margin'
          const answer = await monthAnswer(engine, intent.month!, metric)
          log('Verktyg: monthlySeries / kpiSnapshot', `${answer.month ?? 'saknas'} · ${metric}`)
          say(answer.text); break
        }
        case 'formula': props.onHow(intent.metric ?? selected?.metric ?? 'revenue'); say(`Beräkningen för ${metricInfo[intent.metric ?? 'revenue'].label.toLowerCase()} visas med formel och SQL.`); break
        default: say('Jag kan utforska marginalen, förklara förändringar, jämföra omsättning med förra året, visa produkter, lägga till eller ta bort kort, visa beräkningar, bygga en ledningsvy och föreslå bevakningar. Prova ”vad är marginalen i juli”.')
      }
    } catch { say('Analysen kunde inte slutföras. Försök igen när data har lästs in.'); log('Assistentåtgärd misslyckades') } finally { setSending(false) }
  }
  return <>
    <button className="assistant-toggle primary" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="assistant-panel">{open ? 'Stäng assistenten' : 'Assistent'}</button>
    <aside id="assistant-panel" className={`assistant-panel ${open ? 'is-open' : ''}`} aria-label="Assistent">
      <header className="assistant-heading"><h2>Assistent</h2><p>Bygger och förklarar utifrån dina nyckeltal</p><button className="settings-button" aria-label="Inställningar" onClick={() => setSettingsOpen(true)}>⚙</button></header>
      <div className="assistant-tabs" role="tablist" aria-label="Assistentvyer">{['Assistent', 'Bevakningar', 'Aktivitet'].map(name => <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div>
      <div className="assistant-messages" role="tabpanel" aria-label={tab}>
        {tab === 'Assistent' && <>
          <div data-testid="agent-trace" className="agent-trace" aria-live="polite">{steps.map((step, index) => <details key={index} data-testid={`trace-step-${index}`} data-status={step.status} className={`trace-step ${step.status}`}><summary><span className={`trace-icon ${step.status}`}>{step.status === 'done' ? '✓' : step.status === 'failed' ? '!' : step.status === 'pending' ? '○' : ''}</span>{step.label}</summary><p>{step.summary || 'Inväntar verktygets resultat.'}</p><p>Verktyg: {step.tool || '—'} · {step.duration} ms</p><pre>{JSON.stringify(step.input, null, 2)}</pre><pre>{step.sql || 'SQL visas när verktyget har körts.'}</pre></details>)}{result && <span className={`confidence ${result.confidence.startsWith('Låg') ? 'low' : ''}`}>{result.confidence}</span>}</div>
          <div role="log" aria-live="polite">{!messages.length && <p>Jag analyserar dina nyckeltal. Klicka på ett tal eller dubbelklicka på ett kort för att utforska produkter och ordrar.</p>}{messages.map(message => <div key={message.id} data-testid="assistant-message" className={`assistant-message ${message.role}`}>{message.content}</div>)}</div>
          {watches.map(watch => <WatchCard key={watch.id} watch={watch} onChange={updateWatch} onAsk={() => { say('Bevakningen är simulerad och börjar först när du godkänner. Regeln testar vald månads marginal och förändringen mot föregående månad. Ändra tröskeln, ägare eller kanal innan godkännandet.'); log('Bevakningspolicy förklarad') }} />)}
        </>}
        {tab === 'Bevakningar' && <section data-testid="watch-list"><h3>Bevakningar</h3>{!watches.some(watch => watch.status === 'Aktiv') && <p>Inga aktiva bevakningar. Föreslå en via ”Bevaka marginalen”.</p>}{watches.filter(watch => watch.status === 'Aktiv').map(watch => <div className="watch-card" key={watch.id}><h3>Bruttomarginal · Aktiv</h3><p>{watch.channel} (simulerad) · {watch.owner} · {watch.frequency}</p><p>Tröskel {fmtPct(watch.threshold, 0)} · fall &gt; {fmtPp(watch.drop).replace('+', '')}</p>{watch.alert && <p data-testid="watch-alert" className="negative" role="status">{watch.alert}</p>}</div>)}</section>}
        {tab === 'Aktivitet' && <section data-testid="activity-log"><h3>Aktivitet</h3><ul className="activity-list">{activities.slice().reverse().map(item => <li key={item.id}><time>{item.timestamp}</time><strong>{item.action}</strong>{item.detail && <p>{item.detail}</p>}</li>)}</ul></section>}
        <div ref={bottom} />
      </div>
      {tab === 'Assistent' && <>
        <div className="assistant-chips">{chips.map(chip => <button className="chip" disabled={sending || props.analyzing || !dashboard} key={chip.id} onClick={() => void send(chip.label)}>{chip.label}</button>)}</div>
        {selected && <p className="selected-context" data-testid="selected-context">Markerat: <strong>{selected.title}</strong><button aria-label="Avmarkera kort" onClick={props.onClearSelection}>×</button></p>}
        <form className="assistant-input" onSubmit={event => { event.preventDefault(); if (input.trim()) { void send(input.trim(), true); setInput('') } }}>
          <input aria-label="Fråga eller be mig ändra något" placeholder={selected ? 'Fråga om det markerade kortet' : 'Fråga eller be mig ändra något'} value={input} onChange={event => setInput(event.target.value)} />
          <button className="primary" disabled={sending || props.analyzing || !dashboard} type="submit">{sending ? 'Arbetar…' : 'Skicka'}</button>
        </form>
      </>}
    </aside>
    {settingsOpen && <SettingsDialog settings={settings} onSave={value => { setSettings(value); log('LLM-inställningar ändrade', value.enabled && value.key ? `${value.provider} · aktivt` : 'Offline-läge') }} onClose={() => setSettingsOpen(false)} />}
  </>
}
