import { useState } from 'react'
import { useAnalystSession } from '../../session'
import type { UiDefinition } from '../../types'
import { ApprovalControl, Citation, MemoStatus } from '../../blocks'
import { fmtInt, fmtMonth, fmtPct, fmtTkr } from '../../../data/format'
import { canMerge, previousPeriod } from './diff'
import './diff.css'

function Diff() {
  const session = useAnalystSession()
  return <Document key={session.signoff.run.id} />
}
function Document() {
  const session = useAnalystSession()
  const [version, setVersion] = useState<'current' | 'previous'>('current')
  const [editing, setEditing] = useState<{ number: number; kind: 'edited' | 'rejected' } | null>(null)
  const [reason, setReason] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [published, setPublished] = useState(false)
  const before = previousPeriod(session.period.before, session.months, session.month)
  const previous = session.series?.data.find(row => row.month === before)
  const readyToMerge = session.ready && canMerge(session.findings.map(finding => session.reviews[finding.number]?.status ?? 'pending'), session.watch?.status, reviewer)
  function openEdit(number: number, kind: 'edited' | 'rejected') { setEditing({ number, kind }); setReason(''); setPublished(false) }
  return <main className="diff-ui">
    <header className="diff-header"><div><p>DemoCo · beslutsunderlag för {fmtMonth(session.month)}</p><h1>Marginalen behöver ett beslut.</h1></div><MemoStatus /></header>
    <p className="diff-intro">Läs det som har ändrats. Granska varje påstående och signera den brief som ska gälla.</p>
    <div className="diff-layout">
      <nav className="diff-versions" aria-label="Briefens versioner"><h2>Versioner</h2>
        <button data-testid="diff-current" aria-current={version === 'current' ? 'page' : undefined} onClick={() => setVersion('current')}><strong>Körning #{fmtInt(session.signoff.run.number)}</strong><span>{fmtMonth(session.month)}</span><span>{published ? 'Publicerad brief' : 'Öppen för granskning'}</span></button>
        <button data-testid="diff-previous" aria-current={version === 'previous' ? 'page' : undefined} disabled={!previous} onClick={() => setVersion('previous')}><strong>Körning #{fmtInt(Math.max(0, session.signoff.run.number - 1))}</strong><span>{before ? fmtMonth(before) : 'Historik saknas'}</span><span>Rekonstruerat jämförelseunderlag</span></button>
        <p>Den äldre versionen är beräknad ur en tidigare stängd period. Ingen historisk agentkörning är sparad.</p>
        <div className="diff-key"><p><del>Tidigare underlag</del></p><p><ins>Nytt beräknat underlag</ins></p><p className="diff-review-ink">Granskarens tillägg</p></div>
      </nav>
      <article className="diff-document" data-testid="diff-document">
        <div className="diff-doc-heading"><h2>{version === 'previous' ? 'Briefens jämförelseversion' : published ? 'Godkänd morgonbrief' : 'Morgonbrief · ändringar att granska'}</h2><p>Utkast · Granskas · Godkänd / Returnerad</p></div>
        <p className="diff-byline">Upprättad av Analysagent, körning #{fmtInt(session.signoff.run.number)}, {session.signoff.run.time}<br />Granskad av {published && session.signoff.reviewedAt ? `${session.signoff.reviewer}, ${session.signoff.reviewedAt}` : '—'}</p>
        {version === 'previous' ? <section data-testid="diff-baseline"><h3>{before && fmtMonth(before)}</h3><p>Bruttomarginal: {fmtPct(previous?.gross_margin_pct)}. Omsättning: {fmtTkr(previous?.revenue)}. Ordrar: {fmtInt(previous?.orders)}.</p><p>Påståenden om orsaker är inte arkiverade. Den här jämförelseversionen återger endast den tidigare periodens SQL-resultat.</p>{session.series && <button onClick={() => void session.openCitation({ id: 'diff-previous', title: 'Tidigare stängd period', sql: session.series!.sql, formula: session.series!.formula, value: before ?? '—' })}>Visa SQL och rader för jämförelsen</button>}</section> : <>
          <div className="diff-claims">{session.findings.map(finding => {
            const review = session.reviews[finding.number]
            return <section className="diff-claim" key={finding.number} data-testid={`diff-claim-${finding.number}`}>
              <div className="diff-claim-top"><span className="diff-number">{fmtInt(finding.number)}.</span><h3>{finding.step.label}</h3><span>{review?.status === 'accepted' ? 'Accepterat' : review?.status === 'rejected' ? 'Returnerat' : review?.status === 'edited' ? 'Ändrat · inväntar acceptans' : 'Ej granskat'}</span></div>
              {finding.number === session.findings[0]?.number && <p className="diff-business-change">Bruttomarginal: <del>{fmtPct(previous?.gross_margin_pct)}</del> <ins>{fmtPct(session.snapshot?.data.margin.current)}</ins>. Omsättning: <del>{fmtTkr(previous?.revenue)}</del> <ins>{fmtTkr(session.snapshot?.data.revenue.current)}</ins>. {session.series && <Citation ref={{ id: 'period-comparison', title: 'Månadsresultat', sql: session.series.sql, formula: session.series.formula, value: `${before ?? '—'} / ${session.month}` }} number={finding.number} label="Periodjämförelse: SQL och månadsrader" />}</p>}
              {finding.step.tool === 'unitEconomics' && session.dashboard?.economics.map(row => <p className="diff-business-change" key={row.product}>{row.product}, inköpspris per styck: <del>{fmtInt(row.data.costBefore)} kr</del> <ins>{fmtInt(row.data.costAfter)} kr</ins>. <Citation ref={{ id: row.product, title: `Styckekonomi ${row.product}`, sql: row.sql, formula: row.formula, value: row.product }} label={`Styckekonomi för ${row.product}: SQL och rader`} /></p>)}
              <p>{finding.text} {finding.citations.map((ref, index) => <Citation key={index} ref={ref} number={finding.number} label={`Fynd ${finding.number}: ${ref.tool}, SQL och rader`} />)}</p>
              {review?.reason && <p className="diff-review-ink" data-testid={`diff-note-${finding.number}`}>Granskarens {review.noteKind === 'reject' ? 'returkommentar' : 'tillägg'}: <ins>{review.reason}</ins></p>}
              {!published && <div className="diff-actions"><button data-testid={`diff-accept-${finding.number}`} disabled={!session.ready} aria-pressed={review?.status === 'accepted'} onClick={() => session.reviewFinding(finding.number, 'accepted')}>Acceptera</button><button data-testid={`diff-edit-${finding.number}`} disabled={!session.ready} onClick={() => openEdit(finding.number, 'edited')}>Ändra</button><button data-testid={`diff-return-${finding.number}`} disabled={!session.ready} onClick={() => openEdit(finding.number, 'rejected')}>Avvisa / Returnera</button></div>}
              {editing?.number === finding.number && <form className="diff-edit-form" onSubmit={event => { event.preventDefault(); session.reviewFinding(finding.number, editing.kind, reason); setEditing(null) }}><label>{editing.kind === 'edited' ? 'Granskarens tillägg. Beräknade tal och original bevaras.' : 'Kommentar till returen'}<textarea autoFocus data-testid="diff-reason" value={reason} onChange={event => setReason(event.target.value)} required /></label><button data-testid="diff-save" disabled={!reason.trim()}>Spara tillägg</button><button type="button" onClick={() => setEditing(null)}>Avbryt</button></form>}
            </section>
          })}</div>
          <section className="diff-watch" data-testid="diff-watch"><h3>Ny bevakning föreslås</h3><p>Detta är också ett beslut i briefen. Granska villkoren innan bevakningen godkänns.</p><ApprovalControl /></section>
          <section className="diff-merge"><h3>{published ? 'Briefen är publicerad i denna demokörning.' : 'Slå ihop och signera'}</h3>{!published && <form onSubmit={event => { event.preventDefault(); if (readyToMerge) { session.signOff(reviewer); setPublished(true) } }}><p>Alla påståenden ska vara accepterade och bevakningen godkänd. Ändringsförslag kräver en ny acceptans.</p><label>Granskare <input data-testid="diff-reviewer" value={reviewer} onChange={event => setReviewer(event.target.value)} required /></label><button data-testid="diff-merge" disabled={!readyToMerge}>Slå ihop</button></form>}{published && <p data-testid="diff-published" role="status">Upprättad av Analysagent, körning #{fmtInt(session.signoff.run.number)} / Granskad av {session.signoff.reviewer}</p>}</section>
        </>}
        <footer className="diff-limits"><p>Underlaget är syntetiskt och ser inte leverantörsavtal, budget eller lager. Säker: SQL-resultat kan stämmas av; granska raderna innan beslut.</p><p>Styckekonomins jämförelse avser de perioder som anges i dess SQL, medan briefens totalsiffror jämför två enskilda stängda månader.</p></footer>
      </article>
    </div>
    <section className="diff-log"><h2>Granskningslogg</h2><ul>{session.activities.map(item => <li key={item.id} data-testid="ui-activity-entry"><time>{item.timestamp}</time><strong>{item.action}</strong><span>{item.detail ?? '—'}</span></li>)}</ul></section>
  </main>
}
export default { id: '02', name: 'Versionerad brief med diff', paradigm: 'Dokumentgranskning med affärsdiff och signerad sammanslagning', defaultTheme: '01', Component: Diff,
  smoke: { openApproval: [] }, shots: { interaction: [{ click: 'diff-edit-1' }, { fill: ['diff-reason', 'Ta inköpspriset med leverantören före nästa beställning.'] }, { click: 'diff-save' }, { click: 'diff-accept-2' }, { wait: 'diff-note-1' }] },
} satisfies UiDefinition
