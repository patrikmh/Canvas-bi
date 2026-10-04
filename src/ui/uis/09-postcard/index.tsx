import { useEffect, useState } from 'react'
import { useAnalystSession } from '../../session'
import { Citation } from '../../blocks'
import type { UiDefinition } from '../../types'
import { fmtInt, fmtMonth, fmtPct, fmtPp } from '../../../data/format'
import { marginPath, postcardWeek } from './chart'
import { Review } from './Review'
import './style.css'

const issues = new Map<string, Promise<Awaited<ReturnType<typeof postcardWeek>>>>()
function issueFor(date: string) {
  if (!issues.has(date)) issues.set(date, (async () => {
    const { createBrowserEngine } = await import('../../../data/engine.browser')
    const engine = await createBrowserEngine()
    try { return await postcardWeek(engine, date) } finally { await engine.close() }
  })())
  return issues.get(date)!
}

function Postcard() {
  const session = useAnalystSession()
  const [back, setBack] = useState(false)
  const [mono, setMono] = useState(false)
  const [flippedOnce, setFlippedOnce] = useState(false)
  const [issue, setIssue] = useState<Awaited<ReturnType<typeof postcardWeek>> | null>(null)
  const rows = session.dashboard?.history.data ?? []
  const kpi = session.snapshot?.data.margin
  const breakpoint = session.dashboard?.changeStart
  const issueDate = new Date(`${session.month}-01T12:00:00Z`)
  issueDate.setUTCMonth(issueDate.getUTCMonth() + 1, 0)
  const date = issueDate.toISOString().slice(0, 10)
  useEffect(() => {
    let cancelled = false
    void issueFor(date).then(result => { if (!cancelled) setIssue(result) }).catch(() => { issues.delete(date) })
    return () => { cancelled = true }
  }, [date])
  const breakIndex = rows.findIndex(row => row.month === breakpoint)
  const path = marginPath(rows.map(row => row.gross_margin_pct), 740, 270)
  return <main className={`ui-postcard${mono ? ' postcard-mono' : ''}`}>
    <div className="toolbar postcard-toolbar"><span>DemoCo AB · Veckobrev med månadsunderlag</span><div><button data-testid="postcard-mono" aria-pressed={mono} onClick={() => setMono(!mono)}>Monokrom vy</button> <button onClick={() => window.print()}>Skriv ut vykort</button></div></div>
    <h1>En sak att ta med till veckan.</h1>
    <div className={`postcard-stage${flippedOnce ? ' has-flipped' : ''}`} data-side={back ? 'back' : 'front'}>
      <article id="postcard-front-label" className="postcard-face postcard-front" hidden={back} aria-label="Vykortets framsida" data-testid="postcard-front">
        <div className="postcard-address"><span>Till ledningen på DemoCo AB</span><span>Underlag: {fmtMonth(session.month)}</span></div>
        <h2>Marginalen har fått en ny nivå.</h2>
        <p className="postcard-value">{fmtPct(kpi?.current)} <span>{fmtPp(kpi?.deltaYoY)} mot samma månad i fjol</span></p>
        <figure>
          <svg className="postcard-chart" viewBox="0 0 900 350" role="img" aria-label={`Bruttomarginal för de senaste ${rows.length} månaderna. Brytpunkt ${breakpoint ? fmtMonth(breakpoint) : 'saknas'}. Nu ${fmtPct(kpi?.current)}.`}>
            <g transform="translate(65 25)">
              {[0, 50, 100].map(tick => <g key={tick}><line x1="0" x2="740" y1={270 - tick * 2.7} y2={270 - tick * 2.7} stroke="var(--rule)" strokeWidth=".7" /><text x="-12" y={275 - tick * 2.7} textAnchor="end">{fmtPct(tick, 0)}</text></g>)}
              {breakIndex >= 0 && <><line x1={breakIndex * 740 / Math.max(1, rows.length - 1)} x2={breakIndex * 740 / Math.max(1, rows.length - 1)} y1="0" y2="270" className="break-line" strokeDasharray="3 5" /><text x={Math.min(620, breakIndex * 740 / Math.max(1, rows.length - 1))} y="-8">{fmtMonth(breakpoint!)}: brytpunkt</text></>}
              <path d={path} fill="none" stroke="var(--ink)" strokeWidth="4" opacity=".12" strokeLinecap="round" strokeLinejoin="round" />
              <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              {rows.at(-1)?.gross_margin_pct != null && <><circle cx="740" cy={270 - rows.at(-1)!.gross_margin_pct! * 2.7} r="4" fill="var(--postcard-signal)" /><text x="750" y={274 - rows.at(-1)!.gross_margin_pct! * 2.7}>{fmtPct(rows.at(-1)!.gross_margin_pct)}</text></>}
              {rows.length > 0 && <><text x="0" y="306">{fmtMonth(rows[0].month)}</text><text x="740" y="306" textAnchor="end">{fmtMonth(rows.at(-1)!.month)}</text></>}
            </g>
          </svg>
          <figcaption>Bruttomarginal, månadsvis. Skala från noll; linjen följer SQL-resultaten utan utjämning. {session.dashboard && <Citation ref={{ id: 'postcard-history', title: 'Månadsserien på vykortet', ...session.dashboard.history, value: 'Senaste tillgängliga månaderna till och med vald månad.' }} number={6} />}</figcaption>
        </figure>
        <p className="postcard-byline">Upprättad av Analysagent, körning #{session.signoff.run.number}. Vänd för fynd, källor och granskning.</p>
      </article>
      <article id="postcard-back-label" className="postcard-face postcard-back" hidden={!back} aria-label="Vykortets baksida" data-testid="postcard-back">
        <div className="postcard-back-heading"><h2>Kontrollera inköpsvillkoren.</h2><div className="week-stamp" data-testid={issue ? 'postcard-week' : undefined}>Vecka <strong>{fmtInt(issue?.data.week)}</strong><span>{issue?.data.year ?? '—'}</span></div></div>
        <div className="postcard-sentences"><p>Bruttomarginalen är {fmtPct(kpi?.current)}. {session.findings[0]?.citations.map(ref => <Citation key={ref.tool} ref={ref} number={1} />)}</p><p>{breakpoint ? `Förändringen börjar i ${fmtMonth(breakpoint)}.` : 'Ingen tydlig brytpunkt har hittats.'} {session.findings[1]?.citations.map(ref => <Citation key={ref.tool} ref={ref} number={2} />)}</p><p>Granska produktbidragen och besluta om en bevakning för nästa förändring.</p></div>
        <Review compact />
      </article>
    </div>
    <div className="postcard-flip"><button data-testid="postcard-flip" aria-controls={back ? 'postcard-front-label' : 'postcard-back-label'} aria-label={back ? 'Visa framsidan' : 'Vänd till baksidan'} onClick={() => { setFlippedOnce(true); setBack(!back) }}>{back ? 'Visa framsidan' : 'Vänd till baksidan'}</button>{back && <button data-testid="postcard-read-start" onClick={() => { const face = document.getElementById('postcard-back-label'); if (face) { face.scrollTop = 0; face.scrollIntoView({ block: 'center', behavior: 'instant' }) } }}>Brevets början</button>}<span role="status">{back ? 'Baksida · fynd och beslut' : 'Framsida · marginalens utveckling'}</span></div>
    <p className="method-note">Veckan anger brevets datum vid månadsslut. Analysen bygger på månadsdata, inte veckodata. Konceptdemo; utskriften har en framsida och en baksida i A6 liggande.</p>
  </main>
}
export default { id: '09', name: 'Vykort', paradigm: 'Vändbart veckobrev med utskrift och monokrom läsning', defaultTheme: '05', Component: Postcard,
  smoke: { openApproval: [{ click: 'postcard-flip' }, { wait: 'ui-propose-watch' }] }, shots: { interaction: [{ click: 'postcard-flip' }, { wait: 'postcard-week' }, { click: 'ui-accept-1' }, { click: 'postcard-read-start' }, { wait: 'postcard-back' }] } } satisfies UiDefinition
