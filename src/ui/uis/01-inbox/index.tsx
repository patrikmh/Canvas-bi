import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { UiDefinition } from '../../types'
import { useAnalystSession } from '../../session'
import { ApprovalControl, Citation, Line, MemoStatus, SignOff, Sparkline, Waterfall } from '../../blocks'
import { fmtInt, fmtMonth, fmtPct } from '../../../data/format'
import { countStates, decisionTitle, itemState, moveSelection, states } from './inbox'
import type { InboxState } from './inbox'
import './inbox.css'

function Inbox() {
  const session = useAnalystSession()
  return <InboxWork key={session.signoff.run.id} />
}
function InboxWork() {
  const session = useAnalystSession()
  const [selected, setSelected] = useState<number | 'watch'>(1)
  const [filter, setFilter] = useState<InboxState | 'Alla'>('Alla')
  const [snoozed, setSnoozed] = useState<number[]>([])
  const [watchSnoozed, setWatchSnoozed] = useState(false)
  const [editing, setEditing] = useState<'edited' | 'rejected' | null>(null)
  const [reason, setReason] = useState('')
  const [localLog, setLocalLog] = useState<string[]>([])
  const reading = useRef<HTMLElement>(null)
  const products = session.waterfall?.data.filter(row => row.kind === 'change' && row.label !== 'Övriga').map(row => row.label) ?? []
  const items = session.findings.map(finding => ({ id: finding.number as number | 'watch', finding, title: decisionTitle(finding.step.tool, products), state: itemState(session.reviews[finding.number]?.status, snoozed.includes(finding.number)) }))
  const watchState = session.watch?.status === 'Aktiv' ? 'Klar' : session.watch?.status === 'Avvisad' ? 'Avfärdad' : watchSnoozed ? 'Snoozad' : 'Öppen'
  const all = [...items, { id: 'watch' as const, finding: undefined, title: 'Godkänn bevakning av bruttomarginalen', state: watchState as InboxState }]
  const counts = countStates(all.map(item => item.state))
  const visible = all.filter(item => filter === 'Alla' || filter === item.state)
  const current = all.find(item => item.id === selected)
  const finding = current?.finding
  const review = finding ? session.reviews[finding.number] : undefined
  const rows = session.series?.data.filter(row => row.month <= session.month).slice(-12) ?? []
  const confidence = session.result?.confidence.startsWith('Hög') ? 'säker' : session.result?.confidence.startsWith('Låg') ? 'osäker' : 'preliminär'
  function select(id: number | 'watch') { setSelected(id); setEditing(null); setReason('') }
  function accept() {
    if (!session.ready) return
    if (selected === 'watch') {
      if (session.watch?.status === 'Föreslagen') document.querySelector<HTMLButtonElement>('[data-testid="ui-approve-watch"]')?.click()
      else if (current?.state === 'Öppen' || current?.state === 'Snoozad') session.proposeWatch()
      return
    }
    if (!finding) return
    session.reviewFinding(finding.number, 'accepted'); setEditing(null)
    if (filter !== 'Alla' && filter !== 'Klar') {
      const remaining = visible.filter(item => item.id !== selected)
      const next = remaining[Math.min(Math.max(0, visible.findIndex(item => item.id === selected)), remaining.length - 1)]
      if (next) select(next.id)
    }
  }
  function snooze() {
    if (!session.ready || !current || current.state === 'Klar' || current.state === 'Avfärdad') return
    if (selected === 'watch') setWatchSnoozed(value => !value)
    else setSnoozed(value => value.includes(selected) ? value.filter(id => id !== selected) : [...value, selected])
    setLocalLog(value => [...value, `${current.state === 'Snoozad' ? 'Återöppnad' : 'Snoozad'}: ${current.title}`])
  }
  function keys(event: KeyboardEvent) {
    if ((event.target as HTMLElement).closest('input, textarea, select') || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'j' || event.key === 'k') {
      event.preventDefault()
      const next = visible[moveSelection(Math.max(0, visible.findIndex(item => item.id === selected)), event.key === 'j' ? 1 : -1, visible.length)]
      if (next) { select(next.id); document.querySelector<HTMLButtonElement>(`[data-testid="inbox-item-${next.id}"]`)?.focus() }
    } else if (event.key === 'e' || (event.key === 'Enter' && (event.target as HTMLElement).dataset.testid?.startsWith('inbox-item-'))) { event.preventDefault(); accept() }
    else if (event.key === 'r' && current && current.state !== 'Klar') { event.preventDefault(); if (selected === 'watch' && !session.watch) session.proposeWatch(); setEditing('rejected'); setReason(''); reading.current?.scrollIntoView({ block: 'nearest' }) }
    else if (event.key === 's') { event.preventDefault(); snooze() }
  }
  return <main className="inbox-ui" onKeyDown={keys}>
    <header className="inbox-head"><div><p>DemoCo · {fmtMonth(session.month)}</p><h1>God morgon. Börja med marginalen.</h1></div><MemoStatus /></header>
    <section className="inbox-brief" aria-label="Morgonbrief">
      <p className="inbox-lead">{session.result?.title ?? 'Underlaget sammanställs.'}</p>
      <p>Bruttomarginalen är {fmtPct(session.snapshot?.data.margin.current)}, jämfört med {fmtPct(session.snapshot?.data.margin.lastYear)} samma månad i fjol.</p>{' '}
      <p>Granska inköpspriserna och ta ställning till bevakningen innan dagens övriga beslut.</p>
      <p className="inbox-byline">Upprättad av Analysagent, körning #{fmtInt(session.signoff.run.number)}, 07:30 (demons morgonutgåva) / Granskad av {session.signoff.reviewedAt ? session.signoff.reviewer : '—'}</p>
    </section>
    <div className="inbox-toolbar" id="inbox-decisions"><h2>Beslutsinkorg</h2><p><kbd>j</kbd>/<kbd>k</kbd> välj · <kbd>e</kbd> acceptera · <kbd>r</kbd> avvisa · <kbd>s</kbd> snooza</p></div>
    <nav className="inbox-filters" aria-label="Beslutsstatus">{(['Alla', ...states] as const).map(state => <button key={state} aria-pressed={filter === state} onClick={() => { setFilter(state); const first = all.find(item => state === 'Alla' || item.state === state); if (first) select(first.id) }}>{state} <span>{fmtInt(state === 'Alla' ? all.length : counts[state])}</span></button>)}</nav>
    {session.ready && counts.Öppen === 0 && <p className="inbox-zero" role="status">Inkorg noll. {counts.Snoozad ? 'Snoozade beslut väntar på nästa genomgång.' : 'Dagens beslut är omhändertagna.'}</p>}
    <div className="inbox-workspace">
      <section className="inbox-list" aria-label="Beslut att granska">
        {!visible.length && <p>Inga beslut med denna status.</p>}
        {visible.map(item => <article key={item.id} className={selected === item.id ? 'inbox-row selected' : 'inbox-row'}>
          <div className="inbox-row-top"><span>{item.id === 'watch' ? 'B' : fmtInt(item.id)}</span><button data-testid={`inbox-item-${item.id}`} aria-expanded={selected === item.id} onClick={() => { select(item.id); if (window.innerWidth < 700) requestAnimationFrame(() => reading.current?.scrollIntoView({ block: 'start' })) }}>{item.title}</button></div>
          <div className="inbox-evidence"><Sparkline rows={rows} metric="margin" max={100} label="Bruttomarginal fram till vald månad" /><span>{fmtPct(session.snapshot?.data.margin.current)}</span></div>
          <div className="inbox-meta"><span>{item.state}</span><span>{item.id === 'watch' ? 'preliminär' : confidence} · ansvarig: VD</span>{item.finding ? <button className="inbox-source" onClick={() => void session.openCitation(item.finding!.citations[0], item.finding!.number)}>SQL + rader [{fmtInt(item.finding.number)}]</button> : session.snapshot && <button className="inbox-source" onClick={() => void session.openCitation({ id: 'watch-base', title: 'Bevakningens underlag', sql: session.snapshot!.sql, formula: session.snapshot!.formula, value: fmtPct(session.snapshot!.data.margin.current) })}>SQL + rader [B]</button>}</div>
        </article>)}
      </section>
      <section className="inbox-reading" ref={reading} data-testid="inbox-reading" aria-label="Beslutsunderlag">
        <button className="inbox-back" data-testid="inbox-list-top" onClick={() => { document.getElementById('inbox-decisions')?.scrollIntoView({ block: 'start' }); document.querySelector<HTMLButtonElement>(`[data-testid="inbox-item-${selected}"]`)?.focus({ preventScroll: true }) }}>Till beslutslistan</button>
        <p className="inbox-reading-label">{current?.state} · beslutsunderlag</p><h2>{current?.title}</h2>
        {finding ? <>
          <p data-testid={`inbox-expanded-${finding.number}`}>{finding.text} {finding.citations.map((ref, index) => <Citation key={index} ref={ref} number={finding.number} label={`Fynd ${finding.number}, ${ref.tool}: SQL och resultatrader`} />)}</p>
          <p className="inbox-method">{confidence}: {confidence === 'säker' ? 'avstämt syntetiskt underlag; kontrollera raderna före beslut.' : 'kontrollera underlaget och kör om analysen före beslut.'}</p>
          {finding.step.tool === 'marginWaterfall' && session.waterfall ? <Waterfall steps={session.waterfall.data} label="Produktbidragen förklarar förändringen i bruttomarginal" max={100} height={200} /> : <Line rows={rows} metric="margin" max={100} label="Bruttomarginalens utveckling fram till vald månad" height={190} />}
          {review?.reason && <p className="inbox-note">Granskarens {review.noteKind === 'reject' ? 'skäl' : 'ändringsförslag'}: <ins>{review.reason}</ins></p>}
          <div className="inbox-actions"><button data-testid={`inbox-accept-${finding.number}`} disabled={!session.ready} onClick={accept}>{review?.status === 'accepted' ? 'Accepterat · Klar' : 'Acceptera'}</button><button disabled={!session.ready} onClick={() => { setEditing('edited'); setReason('') }}>Ändra</button><button disabled={!session.ready} onClick={() => { setEditing('rejected'); setReason('') }}>Avvisa</button><button disabled={!session.ready} onClick={snooze}>{current?.state === 'Snoozad' ? 'Återöppna' : 'Snooza'}</button></div>
          {editing && <form onSubmit={event => { event.preventDefault(); session.reviewFinding(finding.number, editing, reason); setEditing(null) }}><label>{editing === 'rejected' ? 'Skäl till avvisning' : 'Ändringsförslag, original och tal bevaras'}<textarea autoFocus required data-testid="inbox-reason" value={reason} onChange={event => setReason(event.target.value)} /></label><button data-testid="inbox-save" disabled={!reason.trim()}>Spara</button><button type="button" onClick={() => setEditing(null)}>Avbryt</button></form>}
        </> : <><p>En daglig uppföljning fångar nya marginalfall. Förslaget är preliminärt; granska tröskel, ansvarig och kanal.</p><ApprovalControl /><button onClick={snooze}>{watchSnoozed ? 'Återöppna' : 'Snooza'}</button>{editing === 'rejected' && <form onSubmit={event => { event.preventDefault(); session.rejectWatch(); setLocalLog(value => [...value, `Bevakning avfärdad · ${reason}`]); setEditing(null) }}><label>Skäl till avvisning<textarea autoFocus required data-testid="inbox-reason" value={reason} onChange={event => setReason(event.target.value)} /></label><button data-testid="inbox-save" disabled={!reason.trim()}>Avvisa förslaget</button><button type="button" onClick={() => setEditing(null)}>Avbryt</button></form>}</>}
      </section>
    </div>
    <section className="inbox-footer"><SignOff /><div><h2>Aktivitetslogg</h2><p>Besluten gäller denna demokörning. Underlaget ser inte lager, budget eller leverantörsavtal.</p><ul>{session.activities.map(item => <li data-testid="ui-activity-entry" key={item.id}><time>{item.timestamp}</time> · {item.action}{item.detail && ` · ${item.detail}`}</li>)}{localLog.map((item, index) => <li key={index}>Granskare · {item}</li>)}</ul></div></section>
  </main>
}
export default { id: '01', name: 'Morgonbrief och beslutsinkorg', paradigm: 'Morgonbrief med tangentbordsstyrd beslutsinkorg', defaultTheme: '02', Component: Inbox,
  smoke: { openApproval: [{ click: 'inbox-item-watch' }, { wait: 'ui-propose-watch' }] },
  shots: { interaction: [{ click: 'inbox-accept-1' }, { click: 'inbox-item-2' }, { click: 'inbox-list-top' }, { wait: 'inbox-expanded-2' }] },
} satisfies UiDefinition
