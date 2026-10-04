import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { TraceStep } from '../../analysis/agent'
import type { Calculation } from '../../components/CalculationDrawer'
import { WatchCard } from '../../components/assistant/WatchCard'
import { useAnalystSession } from '../session'
export { Sparkline, Line, Bars, Waterfall, BulletGraph } from './charts'

export function ApprovalControl() {
  const session = useAnalystSession()
  const element = useRef<HTMLDivElement>(null)
  // WatchCard predates the UI contract. Adapt its existing controls locally.
  useLayoutEffect(() => {
    for (const button of element.current?.querySelectorAll('button') ?? []) {
      if (button.textContent === 'Godkänn') button.dataset.testid = 'ui-approve-watch'
      if (button.textContent === 'Avvisa') button.dataset.testid = 'ui-reject-watch'
    }
  }, [session.watch])
  return <div className="ui-approval" ref={element}>
    <p>Bevakningar kräver ditt uttryckliga godkännande. Utskick och larm är simulerade.</p>
    {!session.watch || session.watch.status !== 'Föreslagen' ? <button data-testid="ui-propose-watch" disabled={!session.ready} onClick={session.proposeWatch}>Föreslå bevakning</button> : null}
    {session.watch && <WatchCard key={session.watch.id} watch={session.watch} onChange={session.updateWatch} onAsk={() => void session.ask('Bevaka marginalen')} />}
    <p data-testid="ui-watch-status" role="status">{session.watch?.status ?? 'Ingen bevakning'}{session.watch?.alert ? ` · ${session.watch.alert}` : ''}</p>
  </div>
}
export function MemoStatus() {
  const session = useAnalystSession()
  return <p data-testid="ui-memo-status" role="status">Status: <strong>{session.memoStatus}</strong></p>
}
// React 19 permits a normal ref prop; this is a citation reference, not a DOM ref.
export function Citation({ ref, number, label }: { ref: TraceStep | Calculation; number?: number; label?: string }) {
  const session = useAnalystSession()
  const source = 'tool' in ref ? ref.tool : ref.title
  return <sup><button className="ui-citation" data-testid={`ui-citation-${number ?? source}`} aria-label={label ?? `Hur räknas ${number ? `fynd ${number}` : 'detta'}? ${source}`} onClick={() => void session.openCitation(ref, number)}>{number ?? source}</button></sup>
}
export function SignOff() {
  const session = useAnalystSession()
  const [name, setName] = useState('Granskare')
  const { signoff } = session
  return <section data-testid="ui-signoff">
    <p>Upprättad av: {signoff.preparedBy}, körning #{signoff.run.number}, {signoff.run.time}</p>
    <p>Granskad av: {signoff.reviewer ?? '—'} {signoff.reviewedAt ?? ''}</p>
    <form onSubmit={event => { event.preventDefault(); session.signOff(name) }}><label>Granskare <input data-testid="ui-reviewer" value={name} onChange={event => setName(event.target.value)} required /></label> <button data-testid="ui-signoff-submit" disabled={session.memoStatus !== 'Godkänd' || !name.trim()}>Signera</button></form>
  </section>
}
export function UiChrome({ name, children }: { name: string; children: ReactNode }) {
  const url = new URL(location.href)
  url.searchParams.delete('ui')
  return <><header className="ui-chrome"><p>Konceptdemo – syntetiska data</p><span>{name}</span><a href={`${url.pathname}${url.search}${url.hash}`}>Till översikten</a></header>{children}</>
}
