import { useEffect, useRef, useState } from 'react'
import type { AgentResult, TraceStep } from '../../analysis/agent'
import type { Activity } from '../../analysis/activity'
import { timestamp } from '../../analysis/activity'
import type { SqlEngine } from '../../data/engine'
import type { Dashboard } from '../../analysis/dashboard'
import type { Calculation } from '../CalculationDrawer'
import { CalculationDrawer } from '../CalculationDrawer'
import { confidenceNote, deriveFindings, findingNumber, memoStatus, runIdentity, sqlStatements, stepInput } from './memo'
import type { FindingReview } from './memo'
import { periodRange } from '../charts/options'
import './memo.css'

interface Props {
  result: AgentResult | null; steps: TraceStep[]; dashboard: Dashboard | null; engine: SqlEngine | null
  activities: Activity[]; watchApproved: boolean; analyzing: boolean
  log: (action: string, detail?: string) => void; onExplain: () => void
}
export function AnalystMemo({ result, steps, dashboard, engine, activities, watchApproved, analyzing, log, onExplain }: Props) {
  const findings = deriveFindings(result)
  const [reviews, setReviews] = useState<Record<number, FindingReview>>({})
  const [notes, setNotes] = useState<Record<number, { kind: 'edit' | 'reject'; text: string }>>({})
  const [editing, setEditing] = useState<{ number: number; kind: 'edit' | 'reject' } | null>(null)
  const [comment, setComment] = useState('')
  const [reviewedAt, setReviewedAt] = useState<string | null>(null)
  const [calculation, setCalculation] = useState<Calculation | null>(null)
  const citationRequest = useRef(0)
  useEffect(() => () => { citationRequest.current++ }, [])
  const run = runIdentity(activities)
  const runActivities = activities.slice(activities.findLastIndex(item => item.id === run.id) + 1)
  const complete = !!result && !analyzing
  const status = memoStatus(findings.map(finding => reviews[finding.number] ?? 'pending'), watchApproved, complete)
  const watchApproval = runActivities.filter(item => item.action === 'Bevakning godkänd').at(-1)
  const followUp = runActivities.findLast(item => item.action === 'Uppföljning')
  function review(number: number, value: FindingReview, reason = '') {
    const next = { ...reviews, [number]: value }
    setReviews(next)
    if (reason) setNotes(previous => ({ ...previous, [number]: { kind: value === 'rejected' ? 'reject' : 'edit', text: reason } }))
    log(value === 'accepted' ? 'Fynd accepterat' : value === 'edited' ? 'Ändring föreslagen' : 'Fynd avvisat', `Fynd ${number}${reason ? `: ${reason}` : ''}`)
    const approved = memoStatus(findings.map(finding => next[finding.number] ?? 'pending'), watchApproved, complete) === 'Godkänd'
    if (approved) { setReviewedAt(timestamp()); log('Analysanteckning godkänd', 'Granskare') }
    else setReviewedAt(null)
    setEditing(null); setComment('')
  }
  async function cite(step: TraceStep, number: number) {
    const request = ++citationRequest.current
    const base = { id: `memo-${run.id}-${number}-${step.tool}`, title: `Fynd ${number} · ${step.tool}`,
      formula: `Verktyg: ${step.tool}. Indata: ${JSON.stringify(step.input)}. Resultatrader hämtas från samma SQL.`, sql: step.sql, value: step.summary }
    setCalculation(base)
    if (!engine || !step.sql) return
    try {
      const batches: Record<string, unknown>[][] = []
      for (const sql of sqlStatements(step.sql)) batches.push(await engine.query<Record<string, unknown>>(sql))
      const format = (value: unknown) => typeof value === 'number'
        ? new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 4 }).format(value).replace(/-/g, '−')
        : value == null ? '—' : String(value)
      const preview = batches.map(rows => rows.slice(0, 12).map(row => Object.entries(row).map(([key, value]) => `${key}: ${format(value)}`).join('; ')).join(' | ') || 'Inga rader.').join(' / Nästa verktygsfråga: ')
      if (citationRequest.current === request) setCalculation({ ...base, formula: `Verktyg: ${step.tool}. Indata: ${JSON.stringify(step.input)}. Resultatrader (urval): ${preview || 'Inga rader.'}` })
    } catch {
      if (citationRequest.current === request) setCalculation({ ...base, formula: `Verktyg: ${step.tool}. Resultatraderna kunde inte hämtas. Kör analysen igen och kontrollera SQL.` })
    }
  }
  const periodStep = result?.steps.find(step => ['marginWaterfall', 'allocateProductChanges'].includes(step.tool))
  const input = periodStep ? stepInput(periodStep) : {}
  const months = (value: unknown) => Array.isArray(value) ? value.filter((month): month is string => typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) : []
  const before = months(input.before), after = months(input.after)
  return <article className="analyst-memo" data-testid="analyst-memo" aria-label="Analysanteckning">
    <p className="memo-status" data-testid="memo-status" role="status">Status: <strong>{status}</strong></p>
    <h2>{complete ? result.title : 'Analysanteckningen upprättas.'}</h2>
    <p className="memo-limits">Ser inte budget eller CRM; syntetiska demonstrationsdata.</p>
    {complete && <>
      <ol className="memo-findings" aria-label="Fynd">{findings.map(finding => <li key={finding.number} data-testid={`memo-finding-${finding.number}`}>
        <p><span className="finding-number">{findingNumber(finding.number)}</span> {finding.text} {finding.citations.map((step, index) => <sup key={step.tool}><button className="memo-footnote" aria-label={`Hur räknas fynd ${finding.number}? ${step.tool}`} onClick={() => void cite(step, finding.number)}>{finding.number}{index ? 'b' : ''}</button></sup>)}</p>
        {notes[finding.number] && <p className="memo-review-note">Granskarens {notes[finding.number].kind === 'reject' ? 'avvisningsskäl' : 'ändringsförslag'}{notes[finding.number].kind === 'reject' && reviews[finding.number] !== 'rejected' ? ' (tidigare)' : ''}: {notes[finding.number].text}</p>}
        <div className="memo-review-actions"><button aria-pressed={reviews[finding.number] === 'accepted'} onClick={() => review(finding.number, 'accepted')}>Acceptera</button><button aria-pressed={reviews[finding.number] === 'edited'} onClick={() => { setEditing({ number: finding.number, kind: 'edit' }); setComment(notes[finding.number]?.text ?? '') }}>Ändra</button><button aria-pressed={reviews[finding.number] === 'rejected'} onClick={() => { setEditing({ number: finding.number, kind: 'reject' }); setComment('') }}>Avvisa</button></div>
        {editing?.number === finding.number && <form className="memo-review-form" onSubmit={event => { event.preventDefault(); if (comment.trim()) review(finding.number, editing.kind === 'reject' ? 'rejected' : 'edited', comment.trim()) }}>
          <label>{editing.kind === 'reject' ? 'Skäl till avvisning' : 'Ändringsförslag (originalets beräknade värden bevaras)'}<textarea required value={comment} onChange={event => setComment(event.target.value)} /></label>
          <button type="submit">Spara</button><button type="button" onClick={() => setEditing(null)}>Avbryt</button>
        </form>}
      </li>)}</ol>
      <div className="memo-signoff" data-testid="memo-signoff"><p>Upprättad av: Analysagent (offline-läge, regelbaserad), körning #{run.number}, <time>{run.time}</time></p>
        <p>Granskad av: {status === 'Godkänd' ? <>Granskare <time>{reviewedAt ?? watchApproval?.timestamp ?? '—'}</time></> : '—'}</p></div>
      {dashboard && <p className="memo-confidence">{confidenceNote(result.confidence, dashboard.month)}</p>}
      <button onClick={onExplain}>Visa förklaringen</button>
      {followUp?.detail && <section className="memo-followup" aria-live="polite"><h3>Uppföljning</h3><p>{followUp.detail}</p></section>}
    </>}
    <details className="memo-method"><summary>Så beräknades detta</summary>
      <p>Försäljningsrader i sales används för nyckeltal, produktbidrag och antalsviktad styckekonomi.{before.length > 0 && after.length > 0 ? ` Period: ${periodRange(after)} mot ${periodRange(before)}.` : ''} Endast angivna månader ingår i periodjämförelsen. Saknad kostnad ger okänd marginal; budget och CRM ingår inte.</p>
      {dashboard && <p>{dashboard.snapshot.formula}</p>}
    </details>
    <details className="memo-log"><summary>Körningslogg</summary><div className="memo-log-scroll"><table data-testid="agent-trace"><caption>Verktygsresultat och granskningsåtgärder</caption><thead><tr><th>Tid</th><th>Aktör</th><th>Åtgärd</th><th>Objekt</th><th>Resultat</th></tr></thead>
      <tbody>{steps.map((step, index) => <tr key={index}><td>{runActivities.find(item => item.action === `Verktyg: ${step.tool}`)?.timestamp ?? run.time}</td><td>Analysagent</td><td>{step.label}</td><td>{step.tool || '—'}</td><td>
        <details className="trace-step" data-testid={`trace-step-${index}`} data-status={step.status}><summary>{step.summary || 'Resultat inväntas'}</summary><p>{step.status} · {step.duration} ms</p><pre>{JSON.stringify(step.input, null, 2)}</pre><pre>{step.sql || 'SQL inväntas'}</pre></details></td></tr>)}
        {runActivities.filter(item => !steps.some(step => item.action === `Verktyg: ${step.tool}`)).map(item => <tr key={item.id}><td>{item.timestamp}</td><td>{['Analys startad', 'Analys klar', 'Analys misslyckades', 'Bevakning föreslagen', 'Simulerat larm', 'Uppföljning'].includes(item.action) || item.action.startsWith('Verktyg:') ? 'Analysagent' : 'Granskare'}</td><td>{item.action}</td><td>Analysanteckning</td><td>{item.detail ?? '—'}</td></tr>)}</tbody></table></div></details>
    {calculation && <CalculationDrawer key={calculation.id} calculation={calculation} onClose={() => { citationRequest.current++; setCalculation(null) }} />}
  </article>
}
