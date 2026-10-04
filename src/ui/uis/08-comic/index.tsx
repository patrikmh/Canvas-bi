import { useRef, useState } from 'react'
import { useAnalystSession } from '../../session'
import { Bars, BulletGraph, Citation, Line, Waterfall } from '../../blocks'
import type { UiDefinition } from '../../types'
import { fmtMonth, fmtPct } from '../../../data/format'
import { literal } from '../../../data/sql'
import { panelIndex } from './navigation'
import { Review } from './Review'
import './style.css'

const headings = ['Före', 'Förändringen', 'Orsaken', 'Vilka produkter', 'Vad vi kan göra', 'Beslut']
function Comic() {
  const session = useAnalystSession()
  const [active, setActive] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const panels = useRef<(HTMLElement | null)[]>([])
  function go(index: number) {
    setActive(index)
    const panel = panels.current[index]
    if (track.current && panel) track.current.scrollTo({ left: panel.offsetLeft - track.current.offsetLeft, behavior: 'instant' })
    panel?.focus({ preventScroll: true })
  }
  const history = session.dashboard?.history.data ?? []
  const source = (index: number) => session.findings[index]?.citations.map(ref => <Citation key={ref.tool} ref={ref} number={session.findings[index].number} />)
  const economics = session.dashboard?.economics[0]
  const kpi = session.snapshot?.data.margin
  return <main className="ui-comic" onKeyDown={event => {
    const editing = (event.target as HTMLElement).closest('input,textarea,select,form') != null
    const next = panelIndex(active, event.key, editing)
    if (next !== active) { event.preventDefault(); go(next) }
  }}>
    <div className="toolbar"><span>DemoCo AB · En dataserie i sex delar</span><span>{fmtMonth(session.month)}</span></div>
    <h1>Inköpskostnaden tar av marginalen.</h1>
    <p className="comic-deck">Läs underlaget från före förändringen till beslutet om bevakning. Varje del har en källa att kontrollera.</p>
    <nav className="comic-navigation" aria-label="Välj del av dataserien">{headings.map((heading, index) => <button key={heading} data-testid={`comic-panel-${index + 1}`} aria-current={active === index ? 'step' : undefined} onClick={() => go(index)}>{index + 1}. {heading}</button>)}</nav>
    <div className="comic-track" ref={track} aria-label="Dataseriens paneler" onScroll={() => {
      const element = track.current
      if (element && window.innerWidth <= 700) setActive(Math.min(5, Math.round(element.scrollLeft / element.clientWidth)))
    }}>
      {headings.map((heading, index) => <article key={heading} ref={element => { panels.current[index] = element }} tabIndex={0} data-testid={`comic-page-${index + 1}`} className="comic-panel" aria-label={`Del ${index + 1}: ${heading}`}>
        <h2><span>{index + 1}</span> {heading}</h2>
        {index === 0 && <><Line rows={history.filter(row => session.period.before.includes(row.month))} metric="margin" max={100} height={290} label="Marginal före förändringen" /><p className="panel-caption">Före förändringen: {fmtPct(session.waterfall?.data.find(step => step.label === 'Före')?.value)} marginal. Poolad försäljning under analysens jämförelseperiod. {source(2)} {session.series && session.period.before.length > 0 && <Citation ref={{ id: 'comic-before', title: 'Månader före brytpunkten', sql: `SELECT * FROM (${session.series.sql}) WHERE month IN (${session.period.before.map(literal).join(',')})`, formula: session.series.formula, value: 'Månadsrader i analysens föreperiod.' }} number={8} />}</p></>}
        {index === 1 && <><Line rows={history} metric="margin" max={100} height={290} label="Marginalen ändrar nivå" /><p className="panel-caption">{session.findings[1]?.text ?? 'Brytpunkten kontrolleras i månadsserien.'} {source(1)} {session.dashboard && <Citation ref={{ id: 'comic-history', title: 'Marginalens månadsserie', ...session.dashboard.history, value: 'Historik till och med vald månad.' }} number={9} />}</p></>}
        {index === 2 && <><Waterfall steps={session.waterfall?.data ?? []} height={290} max={100} label="Produktbidrag förklarar marginalfallet" /><p className="panel-caption">{session.findings[2]?.text ?? 'Produktbidragen beräknas.'} {source(2)}</p></>}
        {index === 3 && <><Bars rows={session.products?.data ?? []} metric="margin" month={session.month} compareMonth={`${Number(session.month.slice(0, 4)) - 1}${session.month.slice(4)}`} height={290} max={100} label="Produktmarginal nu och samma månad i fjol" /><p className="panel-caption">{session.findings[3]?.text ?? 'Priset jämförs med inköpskostnaden.'} {source(3)} {session.products && <Citation ref={{ id: 'comic-products', title: 'Produktmarginal nu och i fjol', ...session.products, value: 'Poolade marginaler per produkt och jämförelsemånad.' }} number={10} />} {economics && <Citation ref={{ id: 'comic-cost', title: `Styckkostnad ${economics.product}`, ...economics, value: 'Antalsviktade pris- och kostnadsresultat.' }} number={6} />}</p></>}
        {index === 4 && <><div className="action-chart"><h3>Nu jämfört med i fjol</h3><BulletGraph current={kpi?.current ?? null} previous={kpi?.lastYear ?? null} metric="margin" /><p>Bruttomarginal {fmtPct(kpi?.current)}. Strecket visar samma månad i fjol.</p></div><p className="panel-caption">Ta upp inköpsvillkoren med leverantören. En bevakning kan fånga nästa förändring; godkänn den uttryckligen i sista panelen. {session.snapshot && <Citation ref={{ id: 'comic-action', title: 'Marginal inför beslut', ...session.snapshot, value: fmtPct(kpi?.current) }} number={7} />}</p></>}
        {index === 5 && <><div className="decision-chart"><BulletGraph current={kpi?.current ?? null} previous={kpi?.lastYear ?? null} metric="margin" /></div><p className="panel-caption">Avstämningen ger ett underlag att granska, inte ett automatiskt beslut. {source(4)} {session.snapshot && <Citation ref={{ id: 'comic-decision', title: 'Marginal och föregående år inför beslut', ...session.snapshot, value: fmtPct(kpi?.current) }} number={11} />}</p><Review compact /></>}
      </article>)}
    </div>
    <div className="toolbar comic-controls"><button onClick={() => go(Math.max(0, active - 1))} disabled={active === 0}>Föregående del</button><p role="status">Del {active + 1} av {headings.length}. {headings[active]}</p><button data-testid="comic-next" onClick={() => go(Math.min(5, active + 1))} disabled={active === 5}>Nästa del</button></div>
    <p className="method-note">Läs med piltangenterna. På mobilen: svep mellan panelerna. Varje numrerad källa öppnar SQL och resultatrader. Underlaget är syntetiskt.</p>
  </main>
}
export default { id: '08', name: 'Dataserie', paradigm: 'Sekventiella redaktionella datapaneler', defaultTheme: '05', Component: Comic,
  smoke: { openApproval: [{ click: 'comic-panel-6' }] }, shots: { interaction: [{ click: 'comic-panel-4' }, { wait: 'comic-page-4' }] } } satisfies UiDefinition
