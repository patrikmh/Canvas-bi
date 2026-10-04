import { useState } from 'react'
import { useAnalystSession } from '../../session'
import { ApprovalControl, Citation, MemoStatus, SignOff } from '../../blocks'
import { confidenceNote } from '../../../components/assistant/memo'

/** Local because the shared contract has primitives, but no finding review block. */
export function Review() {
  const session = useAnalystSession()
  const [editing, setEditing] = useState<{ number: number; kind: 'edited' | 'rejected' } | null>(null)
  const [reason, setReason] = useState('')
  return <section className="local-review" aria-label="Granska analysen">
    <MemoStatus />
    <h2>{session.result?.title ?? 'Analysen inväntas'}</h2>
    {session.result && <p>{confidenceNote(session.result.confidence, session.month)}</p>}
    <p>Underlaget visar försäljning och inköpskostnad. Det ser inte budget, lager eller marknadsföringskostnad.</p>
    <ol>{session.findings.map(finding => <li key={finding.number} data-testid={`ui-finding-${finding.number}`}>
      <p>{finding.text} {finding.citations.map((ref, index) => <Citation key={ref.tool} ref={ref} number={finding.number} label={`Hur räknas fynd ${finding.number}${index ? 'b' : ''}? ${ref.tool}`} />)}</p>
      {session.reviews[finding.number]?.reason && <p data-testid={`ui-review-note-${finding.number}`}>Original bevarat. Granskarens {session.reviews[finding.number].noteKind === 'reject' ? 'avvisningsskäl' : 'ändringsförslag'}: <ins>{session.reviews[finding.number].reason}</ins></p>}
      <div className="review-actions">
        <button data-testid={`ui-accept-${finding.number}`} disabled={!session.ready} aria-pressed={session.reviews[finding.number]?.status === 'accepted'} onClick={() => session.reviewFinding(finding.number, 'accepted')}>Acceptera</button>
        <button data-testid={`ui-edit-${finding.number}`} disabled={!session.ready} onClick={() => { setEditing({ number: finding.number, kind: 'edited' }); setReason('') }}>Ändra</button>
        <button data-testid={`ui-reject-${finding.number}`} disabled={!session.ready} onClick={() => { setEditing({ number: finding.number, kind: 'rejected' }); setReason('') }}>Avvisa</button>
      </div>
      {editing?.number === finding.number && <form onSubmit={event => { event.preventDefault(); if (!reason.trim()) return; session.reviewFinding(finding.number, editing.kind, reason); setEditing(null) }}>
        <label>{editing.kind === 'rejected' ? 'Skäl till avvisning' : 'Ändringsförslag; beräknade värden bevaras'}<textarea data-testid="ui-review-reason" autoFocus required value={reason} onChange={event => setReason(event.target.value)} /></label>
        <div className="review-actions"><button data-testid="ui-save-review" disabled={!session.ready || !reason.trim()}>Spara</button><button type="button" onClick={() => setEditing(null)}>Avbryt</button></div>
      </form>}
    </li>)}</ol>
    <h2>Följ upp marginalen</h2>
    <ApprovalControl />
    <SignOff />
    <details open className="activity-log"><summary>Aktivitetslogg</summary>
      <ul>{session.activities.map(item => <li data-testid="ui-activity-entry" key={item.id}><time>{item.timestamp}</time><strong>{item.action}</strong><span>{item.detail ?? '—'}</span></li>)}</ul>
    </details>
  </section>
}

