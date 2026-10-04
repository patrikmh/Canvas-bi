import { useState } from 'react'
import { useAnalystSession } from '../../session'
import { ApprovalControl, Citation, MemoStatus, SignOff } from '../../blocks'
import { confidenceNote } from '../../../components/assistant/memo'

export function Review({ compact = false }: { compact?: boolean }) {
  const session = useAnalystSession()
  const [editing, setEditing] = useState<{ number: number; kind: 'edited' | 'rejected' } | null>(null)
  const [reason, setReason] = useState('')
  return <section className="local-review" aria-label="Granska analysen">
    <MemoStatus />
    {!compact && <h2>Granska underlaget före beslut</h2>}
    {session.result && <p className="method-note">{confidenceNote(session.result.confidence, session.month)}</p>}
    <ol>{session.findings.map(finding => <li key={finding.number} data-testid={`ui-finding-${finding.number}`}>
      {compact ? <details className="finding-original"><summary>{finding.text.length > 125 ? finding.text.slice(0, finding.text.lastIndexOf(' ', 125)) + '…' : finding.text} {finding.citations.map(ref => <Citation key={ref.tool} ref={ref} number={finding.number} />)}</summary><p>Original: {finding.text}</p></details> : <p>{finding.text} {finding.citations.map(ref => <Citation key={ref.tool} ref={ref} number={finding.number} />)}</p>}
      {session.reviews[finding.number]?.reason && <p data-testid={`ui-review-note-${finding.number}`}>Original bevarat. Granskarens {session.reviews[finding.number].noteKind === 'reject' ? 'avvisningsskäl' : 'ändringsförslag'}: <ins>{session.reviews[finding.number].reason}</ins></p>}
      <div className="review-buttons">
        <button data-testid={`ui-accept-${finding.number}`} disabled={!session.ready} onClick={() => session.reviewFinding(finding.number, 'accepted')}>{session.reviews[finding.number]?.status === 'accepted' ? 'Accepterat' : 'Acceptera'}</button>
        <button data-testid={`ui-edit-${finding.number}`} disabled={!session.ready} onClick={() => { setEditing({ number: finding.number, kind: 'edited' }); setReason('') }}>Ändra</button>
        <button data-testid={`ui-reject-${finding.number}`} disabled={!session.ready} onClick={() => { setEditing({ number: finding.number, kind: 'rejected' }); setReason('') }}>Avvisa</button>
      </div>
      {editing?.number === finding.number && <form onSubmit={event => { event.preventDefault(); if (!reason.trim()) return; session.reviewFinding(editing.number, editing.kind, reason); setEditing(null) }}>
        <label>{editing.kind === 'edited' ? 'Förslag till ändring' : 'Skäl att avvisa'}<textarea autoFocus data-testid="ui-review-reason" value={reason} onChange={event => setReason(event.target.value)} required /></label>
        <button data-testid="ui-save-review" disabled={!reason.trim()}>Spara granskning</button> <button type="button" onClick={() => setEditing(null)}>Avbryt</button>
      </form>}
    </li>)}</ol>
    <ApprovalControl /><SignOff />
    <p className="method-note">Underlaget är syntetiskt. Analysen ser försäljning och inköpskostnad, men inte budget, frakt eller CRM. Kontrollera SQL och resultatrader via de numrerade källorna.</p>
    <details className="audit" open={session.watch?.status === 'Aktiv'}><summary>Händelser och beslut</summary><ol>{session.activities.map(activity => <li key={activity.id} data-testid="ui-activity-entry"><time>{activity.timestamp}</time> — {activity.action}: {activity.detail}</li>)}</ol></details>
  </section>
}
