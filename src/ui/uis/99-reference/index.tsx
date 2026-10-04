import { useState } from 'react'
import { useAnalystSession } from '../../session'
import { ApprovalControl, MemoStatus, Citation, SignOff } from '../../blocks'
import type { UiDefinition } from '../../types'
import { metricInfo } from '../../../components/charts/options'
import { confidenceNote } from '../../../components/assistant/memo'
import { fmtDeltaPct, fmtMonth, fmtPp } from '../../../data/format'
import type { Metric } from '../../../canvas/layout'

function Reference() {
  const session = useAnalystSession()
  const [editing, setEditing] = useState<{ number: number; kind: 'edited' | 'rejected' } | null>(null)
  const [reason, setReason] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  return <main className="ui-reference">
    <div className="ui-reference-heading"><h1>Analysunderlag</h1><label>Period <select data-testid="ui-period" value={session.month} onChange={event => { setEditing(null); setAnswer(''); session.selectMonth(event.target.value) }}>{session.months.map(month => <option key={month} value={month}>{fmtMonth(month)}</option>)}</select></label></div>
    <p>Ser inte budget eller CRM. Underlaget är syntetiskt; kontrollera beräkningarna före beslut.</p>
    {session.snapshot && <table data-testid="ui-kpis"><caption>Nyckeltal, {fmtMonth(session.month)}. FG: samma månad i fjol.</caption><thead><tr><th>Nyckeltal</th><th>Nu</th><th>FG</th><th>ΔFG</th></tr></thead><tbody>{(Object.keys(metricInfo) as Metric[]).map(metric => {
      const info = metricInfo[metric], kpi = session.snapshot!.data[metric]
      return <tr key={metric}><th scope="row">{info.label}</th><td>{info.format(kpi.current)}</td><td>{info.format(kpi.lastYear)}</td><td>{metric === 'margin' ? fmtPp(kpi.deltaYoY) : fmtDeltaPct(kpi.deltaYoY)}</td></tr>
    })}</tbody></table>}
    <MemoStatus />
    <h2>{session.result?.title ?? 'Analysanteckningen upprättas.'}</h2>
    {session.result && <p>{confidenceNote(session.result.confidence, session.month)}</p>}
    <ol className="ui-findings">{session.findings.map(finding => <li key={finding.number} data-testid={`ui-finding-${finding.number}`}>
      <p>{finding.text} {finding.citations.map((ref, index) => <Citation key={ref.tool} ref={ref} number={finding.number} label={`Hur räknas fynd ${finding.number}${index ? 'b' : ''}? ${ref.tool}`} />)}</p>
      {session.reviews[finding.number]?.reason && <p data-testid={`ui-review-note-${finding.number}`}>Original bevarat. Granskarens {session.reviews[finding.number].noteKind === 'reject' ? 'avvisningsskäl' : 'ändringsförslag'}{session.reviews[finding.number].status === 'accepted' ? ' (tidigare)' : ''}: <ins>{session.reviews[finding.number].reason}</ins></p>}
      <div className="ui-review-actions"><button data-testid={`ui-accept-${finding.number}`} disabled={session.busy} aria-pressed={session.reviews[finding.number]?.status === 'accepted'} onClick={() => session.reviewFinding(finding.number, 'accepted')}>Acceptera</button><button data-testid={`ui-edit-${finding.number}`} onClick={() => { setEditing({ number: finding.number, kind: 'edited' }); setReason('') }}>Ändra</button><button data-testid={`ui-reject-${finding.number}`} onClick={() => { setEditing({ number: finding.number, kind: 'rejected' }); setReason('') }}>Avvisa</button></div>
      {editing?.number === finding.number && <form onSubmit={event => { event.preventDefault(); session.reviewFinding(finding.number, editing.kind, reason); setEditing(null) }}><label>{editing.kind === 'rejected' ? 'Skäl till avvisning' : 'Ändringsförslag; beräknade värden bevaras'}<textarea data-testid="ui-review-reason" required value={reason} onChange={event => setReason(event.target.value)} /></label><button data-testid="ui-save-review" disabled={!reason.trim()}>Spara</button><button type="button" onClick={() => setEditing(null)}>Avbryt</button></form>}
    </li>)}</ol>
    <SignOff />
    <section aria-label="Bevakning"><ApprovalControl /></section>
    <form className="ui-question" onSubmit={event => { event.preventDefault(); void session.ask(question).then(answer => setAnswer(answer.text)) }}><label>Fråga om underlaget <input data-testid="ui-question" value={question} onChange={event => setQuestion(event.target.value)} required /></label><button data-testid="ui-ask" disabled={!session.ready || !question.trim()}>Fråga</button></form>
    {answer && <p data-testid="ui-answer" role="status">{answer}</p>}
    <details><summary>Så beräknades detta</summary><p>{session.snapshot?.formula} Verktygsresultat beskriver utförda SQL-frågor och är ingen tankekedja.</p><table><thead><tr><th>Verktyg</th><th>Status</th><th>Resultat</th></tr></thead><tbody>{session.trace.map((step, index) => <tr key={index}><th>{step.tool}</th><td>{step.status}</td><td>{step.summary}</td></tr>)}</tbody></table></details>
    <details open><summary>Aktivitetslogg</summary><table data-testid="ui-activity"><thead><tr><th>Tid</th><th>Aktör</th><th>Åtgärd</th><th>Objekt</th><th>Resultat / ändring</th></tr></thead><tbody>{session.activities.map(item => <tr data-testid="ui-activity-entry" key={item.id}><td>{item.timestamp}</td><td>{['Fynd accepterat', 'Ändring föreslagen', 'Fynd avvisat', 'Analysanteckning godkänd', 'Analysanteckning signerad', 'Bevakning godkänd', 'Bevakning avvisad', 'Bevakning ändrad', 'Assistentfråga'].includes(item.action) ? 'Granskare' : 'Analysagent'}</td><td>{item.action}</td><td>{item.action.startsWith('Verktyg:') ? item.action.slice('Verktyg:'.length).trim() : item.action.includes('Bevakning') || item.action === 'Simulerat larm' ? 'Bevakning' : 'Analysanteckning'}</td><td>{item.detail ?? '—'}</td></tr>)}</tbody></table></details>
  </main>
}
export default { id: '99', name: 'Referensgränssnitt', paradigm: 'Gemensamt analys- och granskningskontrakt', hidden: true,
  Component: Reference, shots: { interaction: [{ click: 'ui-propose-watch' }, { wait: 'ui-approve-watch' }] }, smoke: { openApproval: [] } } satisfies UiDefinition
