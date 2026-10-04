import { Citation, Line } from '../../blocks'
import { useAnalystSession } from '../../session'
import { fmtInt, fmtMonth, fmtPct } from '../../../data/format'
import { periodRange } from '../../../components/charts/options'
import { samePeriods } from './sections'
import type { FigureId } from './sections'
import { CompactWaterfall } from './CompactWaterfall'

export function Figure({ active }: { active: FigureId }) {
  const session = useAnalystSession()
  const rows = session.series?.data.filter(row => row.month <= session.month).slice(-12) ?? []
  const breakpoint = session.findings.find(finding => finding.step.tool === 'findLatestChange')
  const boundary = rows.find(row => breakpoint?.text.includes(fmtMonth(row.month)))?.month
  const economics = session.dashboard && samePeriods(session.dashboard.before, session.dashboard.after, session.period.before, session.period.after) ? session.dashboard.economics : []
  const max = Math.max(1, ...economics.flatMap(row => [row.data.priceBefore, row.data.priceAfter, row.data.costBefore, row.data.costAfter].map(value => value ?? 0)))
  const titles = { trend: 'Marginalen tappade mot slutet av perioden.', break: boundary ? `Förändringen blev tydlig i ${fmtMonth(boundary)}.` : 'Ingen tydlig brytpunkt i underlaget.', waterfall: `Från ${fmtPct(session.waterfall?.data.find(row => row.label === 'Före')?.value)} till ${fmtPct(session.waterfall?.data.find(row => row.label === 'Nu')?.value)}.`, economics: 'Inköpskostnad och pris, sida vid sida.' }
  const citation = session.findings.find(finding => finding.step.tool === (active === 'trend' ? 'scanKpis' : active === 'break' ? 'findLatestChange' : active === 'waterfall' ? 'marginWaterfall' : 'unitEconomics'))
  return <figure className="essay-figure" id="essay-figure" data-testid="essay-figure" data-section={active} tabIndex={-1}>
    <figcaption><p>Figur {['trend', 'break', 'waterfall', 'economics'].indexOf(active) + 1} av 4</p><h3>{titles[active]}</h3></figcaption>
    {active === 'trend' && <Line rows={rows} metric="margin" height={310} label="Bruttomarginal under de senaste tolv månaderna" />}
    {active === 'break' && <><Line rows={rows.slice(-6)} metric="margin" height={310} label={titles.break} /><p>{breakpoint?.text ?? 'Underlaget inväntas.'}</p></>}
    {active === 'waterfall' && <div data-testid="essay-waterfall"><CompactWaterfall steps={session.waterfall?.data ?? []} /><p>Bidrag i procentenheter. {periodRange(session.period.after)} mot {periodRange(session.period.before)}.</p></div>}
    {active === 'economics' && <div className="essay-economics">
      <p>{periodRange(session.period.before)} jämförs med {periodRange(session.period.after)}. Antalsviktade kronor per styck, gemensam skala från noll.</p>
      {economics.length ? economics.map(row => <div key={row.product}><h4>{row.product}</h4><svg viewBox="0 0 510 152" role="img" aria-label={`${row.product}. Pris före ${fmtInt(row.data.priceBefore)} kr, efter ${fmtInt(row.data.priceAfter)} kr. Kostnad före ${fmtInt(row.data.costBefore)} kr, efter ${fmtInt(row.data.costAfter)} kr.`}>
        {[['Pris före', row.data.priceBefore], ['Pris efter', row.data.priceAfter], ['Kostnad före', row.data.costBefore], ['Kostnad efter', row.data.costAfter]].map(([label, raw], index) => {
          const value = raw as number | null, y = 10 + index * 32
          return <g key={label as string}><text x="0" y={y + 12}>{label}</text><line x1="120" x2="120" y1={y} y2={y + 16} stroke="var(--ink)" />{value != null && <rect x="120" y={y} width={value / max * 260} height="16" fill={index % 2 ? 'var(--ink)' : '#a6a6a6'} />}<text x="402" y={y + 12}>{fmtInt(value)} kr</text></g>
        })}<text x="120" y="150">0</text><text x="380" y="150" textAnchor="end">{fmtInt(max)} kr</text>
      </svg></div>) : <p>Styckvärden saknas för analysens perioder. Kontrollera den exakta kostnadsfrågan i fotnoten.</p>}
    </div>}
    <p className="essay-source">Källa: order_lines, lokalt inläst som sales. {citation && <Citation ref={citation.step} number={citation.number} label={`Visa SQL och rader för figur ${active}`} />}</p>
    <div className="essay-figure-tabs" aria-label="Välj figur"><a href="#essay-trend">Trend</a><a href="#essay-break">Brytpunkt</a><a href="#essay-waterfall-section">Produktbidrag</a><a href="#essay-economics-section">Kostnad och pris</a></div>
  </figure>
}
