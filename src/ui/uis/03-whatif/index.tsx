import { useMemo, useState } from 'react'
import { useAnalystSession } from '../../session'
import type { UiDefinition } from '../../types'
import { ApprovalControl, Citation, MemoStatus, SignOff } from '../../blocks'
import { fmtInt, fmtMonth, fmtPct, fmtTkr } from '../../../data/format'
import { literal } from '../../../data/sql'
import type { BaseProduct, Levers, Simulation } from './sim'
import { DragNumber } from './DragNumber'
import { useSimulation } from './useSimulation'
import './whatif.css'

const assumptions = 'Konstant mix, ingen priselasticitet om inte annat anges; simulering, inte prognos.'
function WhatIf() {
  const session = useAnalystSession()
  return <Memo key={session.signoff.run.id} />
}
function Memo() {
  const session = useAnalystSession()
  const base = useMemo<BaseProduct[]>(() => Object.entries(session.productSeries).flatMap(([product, series]) => {
    const row = series.data.find(row => row.month === session.month)
    return row ? [{ product, revenue: row.revenue, cost: row.cost }] : []
  }), [session.productSeries, session.month])
  const targets = useMemo(() => session.dashboard?.economics.map(row => row.product).slice(0, 2) ?? [], [session.dashboard])
  const [levers, setLevers] = useState<Levers>(() => ({ prices: Object.fromEntries(targets.map(product => [product, 0])), cost: 0, volumeLoss: 0 }))
  const calculation = useSimulation(base, levers)
  // The initial, unchanged scenario is exactly the existing SQL snapshot. This
  // keeps the memo useful while the local simulation worker starts.
  const unchanged = levers.cost === 0 && levers.volumeLoss === 0 && Object.values(levers.prices).every(value => value === 0)
  const currentMonth = session.series?.data.find(row => row.month === session.month)
  const baseline: Simulation | null = session.snapshot?.data.revenue.current == null ? null : { revenue: session.snapshot.data.revenue.current, cost: currentMonth?.cost ?? null, margin: session.snapshot.data.margin.current, low: session.snapshot.data.margin.current, high: session.snapshot.data.margin.current }
  const result = calculation.result ?? (unchanged ? baseline : null)
  const { sql, error } = calculation
  const baseSql = Object.entries(session.productSeries).map(([product, series]) => `SELECT ${literal(product)} AS product, * FROM (${series.sql}) WHERE month = ${literal(session.month)}`).join(' UNION ALL ')
  const [proposal, setProposal] = useState<{ result: Simulation; sql: string; levers: Levers } | null>(null)
  const [decision, setDecision] = useState<'pending' | 'accepted' | 'edited' | 'rejected'>('pending')
  const [note, setNote] = useState('')
  const [decisionEdit, setDecisionEdit] = useState<'edited' | 'rejected' | null>(null)
  const [decisionReason, setDecisionReason] = useState('')
  const [editing, setEditing] = useState<{ number: number; kind: 'edited' | 'rejected' } | null>(null)
  const [reason, setReason] = useState('')
  const [localLog, setLocalLog] = useState<string[]>([])
  const range = (value: Simulation | null) => value?.low == null || value.high == null ? '—' : `${fmtPct(value.low)}–${fmtPct(value.high)}`
  const scenarioStatus = decision === 'rejected' ? 'Returnerad' : decision === 'accepted' && session.watch?.status === 'Aktiv' && session.findings.every(finding => session.reviews[finding.number]?.status === 'accepted') ? 'Godkänd' : proposal ? 'Granskas' : 'Utkast'
  function updatePrice(product: string, value: number) { setLevers(previous => ({ ...previous, prices: { ...previous.prices, [product]: value } })) }
  function log(action: string) { setLocalLog(previous => [...previous, action]) }
  return <main className="whatif-ui">
    <header className="whatif-header"><p>DemoCo · beslutsmemo för {fmtMonth(session.month)}</p><h1>Vad krävs för att få tillbaka marginalen?</h1><p className="whatif-lead">{session.result?.title ?? 'Analysunderlaget sammanställs.'} Pröva pris och inköpspris innan du tar ett beslut.</p></header>
    <div className="whatif-layout">
      <article className="whatif-memo">
        <h2>Ett förslag, med antaganden du kan ändra.</h2>
        <p className="whatif-prose">Om priset på {targets[0] ?? 'första produkten'} ändras med <DragNumber label={`Prisändring ${targets[0] ?? 'första produkten'}`} testid="whatif-price-1" value={levers.prices[targets[0]] ?? 0} onChange={value => updatePrice(targets[0], value)} min={-20} max={30} /> och på {targets[1] ?? 'andra produkten'} med <DragNumber label={`Prisändring ${targets[1] ?? 'andra produkten'}`} testid="whatif-price-2" value={levers.prices[targets[1]] ?? 0} onChange={value => updatePrice(targets[1], value)} min={-20} max={30} />, prövar vi ett alternativ till dagens inköpsvillkor.</p>
        <p className="whatif-prose">Inköpspriset för dessa produkter ändras med <DragNumber label="Ändring av inköpspris för de två produkterna" testid="whatif-cost" value={levers.cost} onChange={cost => setLevers(previous => ({ ...previous, cost }))} min={-30} max={20} />. Anta att hela sortimentet tappar <DragNumber label="Volymbortfall i hela sortimentet" testid="whatif-volume" value={levers.volumeLoss} onChange={volumeLoss => setLevers(previous => ({ ...previous, volumeLoss }))} min={0} max={30} /> i volym.</p>
        <p id="whatif-help" className="whatif-help">Dra ett understruket tal åt sidan. På tangentbord: pil vänster/höger, håll Skift för större steg. På mobil: tryck och dra.</p>
        <section className="whatif-result" aria-label="Simuleringens resultat">
          <h2>Marginalen kan landa inom {range(result)}.</h2>
          <p data-testid="whatif-result" aria-live="polite">Vid fullt genomslag blir omsättningen {fmtTkr(result?.revenue)} och bruttomarginalen {fmtPct(result?.margin)}. {result && <Citation number={session.findings.length + 1} ref={{ id: 'scenario-live', title: 'Simulerad produktkalkyl', sql, formula: 'Poolad marginal från produktvisa månadsresultat. Känslighet: halvt till fullt genomslag av angivna pris- och inköpsprisändringar.', value: range(result) }} label="Simulering: körbar SQL och resultatrader" />}</p>
          <p className="whatif-assumptions">{assumptions}</p>
          <div className="whatif-plot"><div className="whatif-plot-label"><strong>Nu {fmtPct(session.snapshot?.data.margin.current)}</strong><span>FG {fmtPct(session.snapshot?.data.margin.lastYear)}</span></div><svg viewBox="0 0 500 54" role="img" aria-label={`Bruttomarginal nu ${fmtPct(session.snapshot?.data.margin.current)}, FG ${fmtPct(session.snapshot?.data.margin.lastYear)}. Skala noll till hundra procent.`}><rect x="0" y="5" width="500" height="24" fill="var(--surface-alt)" />{session.snapshot?.data.margin.current != null && <rect x="0" y="12" width={session.snapshot.data.margin.current * 5} height="10" fill="var(--ink)" />}{session.snapshot?.data.margin.lastYear != null && <line x1={session.snapshot.data.margin.lastYear * 5} x2={session.snapshot.data.margin.lastYear * 5} y1="3" y2="31" stroke="var(--ink)" strokeWidth="2" />}<text x="0" y="49" fill="var(--ink-muted)">0 %</text><text x="500" y="49" textAnchor="end" fill="var(--ink-muted)">100 %</text></svg>
            <p className="whatif-band-label">Simulerat intervall {range(result)}</p><svg viewBox="0 0 500 54" role="img" aria-label={`Simulerad marginal ${range(result)}. Skala noll till hundra procent.`}><line x1="0" x2="500" y1="16" y2="16" stroke="var(--rule)" />{result?.low != null && result.high != null && <><rect x={result.low * 5} y="5" width={Math.max(2, (result.high - result.low) * 5)} height="22" fill="var(--accent)" opacity=".25" /><line x1={result.margin! * 5} x2={result.margin! * 5} y1="2" y2="30" stroke="var(--accent)" strokeWidth="3" /></>}<text x="0" y="49" fill="var(--ink-muted)">0 %</text><text x="500" y="49" textAnchor="end" fill="var(--ink-muted)">100 %</text></svg>
          </div>
          <p>Intervallet visar halvt till fullt genomslag av pris- och inköpsprisändringen. Det är ett känslighetstest, inte ett statistiskt konfidensintervall.</p>
          <p className="whatif-assumptions">{assumptions} Volymbortfallet gäller alla produkter lika och påverkar omsättningen; det ändrar därför inte marginalprocenten. Övriga priser och kostnader hålls stilla.</p>
          {calculation.result && <span data-testid="whatif-calculated" className="whatif-calculated">SQL-kalkylen är uppdaterad.</span>}{error && <p role="alert">Modellen kunde inte beräknas: {error}. Ladda om underlaget.</p>}
          <button className="whatif-primary" data-testid="whatif-propose" disabled={!session.ready || !result || result.margin === null} onClick={() => { if (!result) return; setProposal({ result, sql, levers }); setDecision('pending'); setNote(''); session.proposeWatch(); log('Scenario föreslaget · Utkast till Granskas; antaganden låsta för granskning') }}>Föreslå som beslut</button>
          <button className="whatif-reset" onClick={() => setLevers({ prices: Object.fromEntries(targets.map(product => [product, 0])), cost: 0, volumeLoss: 0 })}>Återställ antaganden</button>
        </section>
        {proposal && <section className="whatif-proposal" data-testid="whatif-proposal"><h2>Förslag till beslut</h2><p role="status">Status: <strong>{scenarioStatus}</strong></p><p>Granska detta låsta scenario: {Object.entries(proposal.levers.prices).map(([product, value]) => `${product} ${fmtPct(value, 0)}`).join(', ')}, inköpspris {fmtPct(proposal.levers.cost, 0)}, volymbortfall {fmtPct(proposal.levers.volumeLoss, 0)}.</p><p>Simulerad bruttomarginal {range(proposal.result)}. <Citation number={session.findings.length + 2} ref={{ id: 'scenario-proposal', title: 'Föreslaget scenario', sql: proposal.sql, formula: 'Låsta antaganden vid förslagstillfället; SQL summerar produktvis omsättning och kostnad.', value: range(proposal.result) }} label="Beslutsförslag: låst SQL och resultatrader" /></p><p className="whatif-assumptions">{assumptions}</p>{note && <p>Granskarens tillägg: <ins>{note}</ins></p>}<div className="whatif-actions"><button disabled={!session.ready} onClick={() => { setDecision('accepted'); log('Scenario accepterat · inväntar granskade fynd och godkänd bevakning') }}>Acceptera</button><button onClick={() => { setDecisionEdit('edited'); setDecisionReason('') }}>Ändra</button><button onClick={() => { setDecisionEdit('rejected'); setDecisionReason('') }}>Avvisa</button></div>{decisionEdit && <form onSubmit={event => { event.preventDefault(); setDecision(decisionEdit); setNote(decisionReason); log(`${decisionEdit === 'rejected' ? 'Scenario returnerat' : 'Scenarioändring föreslagen'} · ${decisionReason}`); setDecisionEdit(null) }}><label>{decisionEdit === 'rejected' ? 'Skäl till avvisning' : 'Tillägg; beräknat scenario bevaras'}<textarea autoFocus required value={decisionReason} onChange={event => setDecisionReason(event.target.value)} /></label><button disabled={!decisionReason.trim()}>Spara</button><button type="button" onClick={() => setDecisionEdit(null)}>Avbryt</button></form>}</section>}
        <section className="whatif-findings"><h2>Fynden som modellen bygger på</h2><MemoStatus />{session.findings.map(finding => <section className="whatif-finding" key={finding.number}><p><strong>{fmtInt(finding.number)}.</strong> {finding.text} {finding.citations.map((ref, index) => <Citation key={index} ref={ref} number={finding.number} />)}</p>{session.reviews[finding.number]?.reason && <p className="whatif-note">Granskarens tillägg: <ins>{session.reviews[finding.number].reason}</ins></p>}<div className="whatif-actions"><button disabled={!session.ready} aria-pressed={session.reviews[finding.number]?.status === 'accepted'} onClick={() => session.reviewFinding(finding.number, 'accepted')}>Acceptera</button><button disabled={!session.ready} onClick={() => { setEditing({ number: finding.number, kind: 'edited' }); setReason('') }}>Ändra</button><button disabled={!session.ready} onClick={() => { setEditing({ number: finding.number, kind: 'rejected' }); setReason('') }}>Avvisa</button></div>{editing?.number === finding.number && <form onSubmit={event => { event.preventDefault(); session.reviewFinding(finding.number, editing.kind, reason); setEditing(null) }}><label>Granskningskommentar; original bevaras<textarea required autoFocus value={reason} onChange={event => setReason(event.target.value)} /></label><button disabled={!reason.trim()}>Spara</button><button type="button" onClick={() => setEditing(null)}>Avbryt</button></form>}</section>)}</section>
      </article>
      <aside className="whatif-notes" aria-label="Modellens underlag och ansvar"><h2>Modellens gränser</h2><p>Preliminär: pröva antagandena med leverantören innan beslut. Modellen ser inte frakt, lager, kampanjer eller kundernas priskänslighet.</p><p>Basen är produktvis omsättning och kostnad från {fmtMonth(session.month)}. Ingen fraktmodell finns i underlaget.</p><p>Modellen byggd av Analysagent, körning #{fmtInt(session.signoff.run.number)}, granskad av {scenarioStatus === 'Godkänd' && session.signoff.reviewedAt ? session.signoff.reviewer : '—'}.</p>{baseSql && <button onClick={() => void session.openCitation({ id: 'scenario-base', title: 'Produktresultat, scenariots bas', sql: baseSql, formula: session.series?.formula ?? 'Produktvisa månadsresultat', value: session.month })}>Visa SQL och basrader</button>}<h3>Bevakning efter beslut</h3><ApprovalControl /></aside>
    </div>
    {scenarioStatus === 'Godkänd' && <SignOff />}
    <section className="whatif-log"><h2>Beslutslogg</h2><ul>{localLog.map((item, index) => <li data-testid="ui-activity-entry" key={`scenario-${index}`}>Granskare · {item}</li>)}{session.activities.map(item => <li data-testid="ui-activity-entry" key={item.id}><time>{item.timestamp}</time> · {item.action} · {item.detail}</li>)}</ul></section>
  </main>
}
export default { id: '03', name: 'What-if-memo', paradigm: 'Reaktivt beslutsmemo med dragbara antaganden och SQL-simulering', defaultTheme: '02', Component: WhatIf,
  smoke: { openApproval: [] }, shots: { interaction: [{ wait: 'whatif-calculated' }, { drag: ['whatif-price-1', 24, 0] }, { drag: ['whatif-price-2', 20, 0] }, { wait: 'whatif-calculated' }] },
} satisfies UiDefinition
