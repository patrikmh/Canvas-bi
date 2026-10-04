import { useEffect, useRef, useState } from 'react'
import { useAnalystSession } from '../../session'
import { Citation } from '../../blocks'
import type { UiDefinition } from '../../types'
import { fmtMonth, fmtPct } from '../../../data/format'
import { periodRange } from '../../../components/charts/options'
import { activeSection } from './sections'
import type { FigureId } from './sections'
import { Figure } from './Figure'
import { Review } from './Review'
import './review.css'
import './style.css'

const anchors: Record<FigureId, string> = { trend: 'essay-trend', break: 'essay-break', waterfall: 'essay-waterfall-section', economics: 'essay-economics-section' }
function Essay() {
  const session = useAnalystSession()
  const [active, setActive] = useState<FigureId>('trend')
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let scheduled = false, frame = 0
    const update = () => {
      scheduled = false
      const sections = (Object.keys(anchors) as FigureId[]).map(id => ({ id, top: document.getElementById(anchors[id])?.getBoundingClientRect().top ?? Infinity }))
      setActive(activeSection(sections, window.innerWidth <= 760 ? 380 : 180))
    }
    const schedule = () => { if (!scheduled) { scheduled = true; frame = requestAnimationFrame(update) } }
    window.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule); update()
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule) }
  }, [])
  function go(id: FigureId) {
    setActive(id); document.getElementById(anchors[id])?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }
  function showFigure(id: FigureId) {
    setActive(id)
    document.getElementById('essay-figure')?.focus({ preventScroll: true })
  }
  const before = session.waterfall?.data.find(row => row.label === 'Före')?.value
  const after = session.waterfall?.data.find(row => row.label === 'Nu')?.value
  const find = (tool: string) => session.findings.find(finding => finding.step.tool === tool)
  const breakpoint = find('findLatestChange'), contribution = find('marginWaterfall'), costs = find('unitEconomics')
  const linkedNumbers = (text: string, figure: FigureId) => text.split(/([−+]?\d+(?:,\d+)?\s*(?:%|p\.e\.|procentenheter))/g).map((part, index) => index % 2
    ? <button key={index} className="essay-number" onClick={() => go(figure)}>{part}</button> : part)
  const leadParts = session.result?.text.split(/(?=Där har)/) ?? []
  return <main className="ui-essay">
    <header className="essay-lead"><h1>Varför marginalen föll</h1><p className="essay-deck">{leadParts.length ? leadParts.map((part, index) => <span key={index}>{linkedNumbers(part, index ? 'economics' : 'waterfall')}</span>) : 'Marginalunderlaget inväntas.'}</p><p className="byline">Analysagent, körning #{session.signoff.run.number} · {fmtMonth(session.month)} · granskare: {session.signoff.reviewer ?? 'ännu inte signerad'}</p><p className="essay-limit">Försäljning och inköpskostnader i syntetiska orderrader. Budget, lager och marknadsföring ingår inte.</p>
      <nav aria-label="Läsordning"><button onClick={() => go('trend')}>Läs från början</button><button data-testid="essay-jump-waterfall" onClick={() => go('waterfall')}>Gå till produktbidragen</button><button data-testid="essay-jump-decision" onClick={() => document.getElementById('essay-decision')?.scrollIntoView({ block: 'start', behavior: 'instant' })}>Gå till beslut</button></nav>
    </header>
    <div className="essay-body" ref={body}>
      <article className="essay-prose" aria-label="Marginalförklaringen">
        <section id={anchors.trend}><h2>Det är marginalen som behöver uppmärksamhet.</h2><p>Senaste månadens bruttomarginal är <button className="essay-number" onClick={() => showFigure('trend')}>{fmtPct(session.snapshot?.data.margin.current)}</button>. Börja med hela utvecklingen: figurens månader slutar i {fmtMonth(session.month)}.</p><p>Omsättning och bruttomarginal svarar på olika frågor. Försäljningens säsong säger hur mycket som säljs; marginalen visar hur mycket som återstår efter inköpskostnaden.</p><p>Figuren följer texten. Du kan också välja en figur direkt eller öppna dess SQL och resultatrader.</p>{find('scanKpis') && <p>Nyckeltalen har jämförts både mot i fjol och mot de senaste månaderna. <Citation ref={find('scanKpis')!.step} number={find('scanKpis')!.number} label="Fotnot till nyckeltalsjämförelsen" /></p>}</section>
        <section id={anchors.break}><h2>Börja där kurvan ändrar riktning.</h2><p>{breakpoint?.text ?? 'Brytpunkten inväntas.'} {breakpoint && <Citation ref={breakpoint.step} number={breakpoint.number} label="Fotnot till brytpunkten" />}</p><p>Analysen utgår från den senaste tydliga förändringen fram till vald månad. Perioden före är {periodRange(session.period.before)}. Perioden efter är {periodRange(session.period.after)}.</p><p>En brytpunkt är en regelbaserad markering i månadsdata. Den talar om var det är värt att undersöka, men bevisar inte en orsak.</p><button className="essay-number" onClick={() => showFigure('break')}>Se månaderna kring brytpunkten</button></section>
        <section id={anchors.waterfall} data-testid="essay-contribution-section"><h2>Produktbidragen förklarar förändringen.</h2><p>Den poolade marginalen gick från <button className="essay-number" onClick={() => showFigure('waterfall')}>{fmtPct(before)}</button> till <button className="essay-number" onClick={() => showFigure('waterfall')}>{fmtPct(after)}</button> mellan analysens perioder.</p><p>{linkedNumbers(contribution?.text ?? 'Produktbidragen inväntas.', 'waterfall')} {contribution && <Citation ref={contribution.step} number={contribution.number} label="Fotnot till produktbidragen" />}</p><p>Varje produktbidrag väger ihop produktens marginal med dess andel av omsättningen. Därför fångar figuren både kostnadsförändringar och förändrad produktmix. Övriga samlar resten av sortimentet.</p><p>Bidragen stäms av mot totalens förändring. De ska läsas som en fördelning av utfallet, inte som ett test av vad som hade hänt utan varje produkt.</p></section>
        <section id={anchors.economics}><h2>Kontrollera kostnaden innan priset ändras.</h2><p>{linkedNumbers(costs?.text ?? 'Kostnadsjämförelsen inväntas.', 'economics')} {costs && <Citation ref={costs.step} number={costs.number} label="Fotnot till styckkostnad och pris" />}</p><p>Figuren jämför antalsviktat styckpris och styckkostnad för produkterna som driver förändringen. Samma skala används för båda produkterna.</p><p>Det här underlaget beskriver sålda varor. Det visar inte leverantörsavtal, frakt eller kampanjernas lönsamhet. Kontrollera inköpsvillkoren med ansvarig innan ett prisbeslut.</p><button className="essay-number" onClick={() => showFigure('economics')}>Se kostnad och pris per produkt</button></section>
      </article>
      <Figure active={active} />
    </div>
    <section className="essay-decision" id="essay-decision" data-testid="essay-decision"><h2>Beslut</h2><p>Granska fynden, ange eventuella ändringar och ta ställning till en bevakning. Bevakningen är ett separat förslag som kräver godkännande. Signera sedan underlaget med ditt namn.</p><Review /></section>
  </main>
}
export default { id: '06', name: 'Dataessä', paradigm: 'Sammanhängande analys med figur som följer läsningen', defaultTheme: '02', Component: Essay,
  shots: { interaction: [{ click: 'essay-jump-waterfall' }, { wait: 'essay-waterfall' }] }, smoke: { openApproval: [{ click: 'essay-jump-decision' }, { wait: 'essay-decision' }] },
} satisfies UiDefinition
