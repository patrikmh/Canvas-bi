import { useEffect, useState } from 'react'
import { useAnalystSession } from '../../session'
import { Citation, Line } from '../../blocks'
import type { UiDefinition } from '../../types'
import { generateDemoData } from '../../../data/generate'
import type { SqlEngine } from '../../../data/engine'
import { fmtInt, fmtMonth, fmtPct, fmtPp, fmtTkr } from '../../../data/format'
import { literal } from '../../../data/sql'
import { loadRegions, dotRadius } from './data'
import type { RegionRow } from './data'
import { Review } from './Review'
import { preloadRegions } from './preload'
import './style.css'

const places = [
  { name: 'Stockholm', x: 225, y: 299, tx: 273, ty: 312 },
  { name: 'Göteborg', x: 104, y: 343, tx: 10, ty: 340 },
  { name: 'Malmö', x: 133, y: 423, tx: 180, ty: 430 },
  { name: 'Uppsala', x: 211, y: 267, tx: 260, ty: 255 },
  { name: 'Övriga Sverige', x: 209, y: 143, tx: 263, ty: 137 },
]
function Sweden({ rows, max, selected, choose, small = false }: { rows: RegionRow[]; max: number; selected?: string; choose?: (name: string) => void; small?: boolean }) {
  return <svg viewBox="0 0 410 460" className={small ? 'sweden-small' : 'sweden'} role={choose ? 'group' : 'img'} aria-label="Schematisk karta över Sverige; cirklarnas yta visar antal ordrar">
    <path d="M211 20 L240 32 273 17 309 47 296 76 274 86 267 119 251 142 258 162 239 184 238 213 222 232 238 251 226 275 240 298 218 317 211 343 190 354 177 378 168 407 147 438 128 432 118 409 124 385 103 365 99 342 112 322 121 295 140 276 145 250 163 233 165 204 181 185 179 155 190 132 187 101 198 80 193 56 Z" fill="var(--map-land)" stroke="var(--rule)" strokeWidth="1.2" />
    {places.map(place => {
      const row = rows.find(row => row.region === place.name)
      const radius = dotRadius(row?.orders ?? null, max)
      return <g key={place.name} role={choose ? 'button' : undefined} tabIndex={choose ? 0 : undefined} aria-label={`${place.name}: ${fmtInt(row?.orders)} ordrar, marginalförändring ${fmtPp(row?.delta)}`} aria-pressed={choose ? selected === place.name : undefined} data-testid={choose ? `map-region-${place.name}` : undefined} onClick={() => choose?.(place.name)} onKeyDown={event => { if (choose && ['Enter', ' '].includes(event.key)) { event.preventDefault(); choose(place.name) } }}>
        {choose && <circle cx={place.x} cy={place.y} r={Math.max(22, radius + 5)} fill="transparent" />}
        <circle cx={place.x} cy={place.y} r={radius} className={row?.delta != null && row.delta < 0 ? 'dot-decline' : 'dot-neutral'} stroke={selected === place.name ? 'var(--ink)' : 'var(--surface)'} strokeWidth={selected === place.name ? 3 : 1.5} />
        {!small && <><line x1={place.x + (place.tx > place.x ? radius : -radius)} y1={place.y} x2={place.tx + (place.tx < place.x ? 58 : -4)} y2={place.ty - 4} stroke="var(--ink-muted)" /><text x={place.tx} y={place.ty}>{place.name}</text></>}
      </g>
    })}
  </svg>
}
function MapInterface() {
  const session = useAnalystSession()
  const [data, setData] = useState<Awaited<ReturnType<typeof loadRegions>> | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false, live: SqlEngine | undefined
    setData(null)
    void (async () => {
      const preloaded = await preloadRegions
      if (preloaded?.month === session.month) { if (!cancelled) setData(preloaded.regions); return }
      const { createBrowserEngine } = await import('../../../data/engine.browser')
      const engine = await createBrowserEngine(); live = engine
      if (cancelled) { await engine.close(); return }
      await engine.loadOrderLines(generateDemoData())
      const regions = await loadRegions(engine, session.month)
      if (!cancelled) setData(regions)
    })().catch(cause => { if (!cancelled) setError(String(cause)) })
    return () => { cancelled = true; void live?.close() }
  }, [session.month])
  useEffect(() => {
    if (selected) document.querySelector('[data-testid="map-region-panel"]')?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [selected])
  const recentMonths = session.months.filter(month => month <= session.month).slice(-4)
  const max = Math.max(1, ...data?.history.data.filter(row => recentMonths.includes(row.month)).map(row => row.orders) ?? [])
  const allDecline = data?.current.data.length === places.length && data.current.data.every(row => row.delta != null && row.delta < 0)
  const source = data && { id: 'regions', title: 'Regional marginal och ordrar', ...data.current, value: 'Jämförelse med samma månad i fjol.' }
  const chosen = data?.current.data.find(row => row.region === selected)
  return <main className="ui-map">
    <div className="toolbar"><span>DemoCo AB · Försäljningens geografi</span><span>{fmtMonth(session.month)}</span></div>
    <h1>{allDecline ? 'Marginalfallet följer inte en region.' : 'Var finns kunderna – och förändringen?'}</h1>
    <p className="map-conclusion">{allDecline ? 'Nedgången syns i alla regioner – orsaken är inköpspriset, inte geografin.' : 'Jämför regionernas marginal mot samma månad i fjol och granska produktorsaken nedan.'} {source && <Citation ref={source} number={6} />} {session.findings.find(finding => finding.step.tool === 'unitEconomics')?.citations.map(ref => <Citation key={ref.tool} ref={ref} number={4} />)}</p>
    <div className="map-spread">
      <figure className="map-main"><Sweden rows={data?.current.data ?? []} max={max} selected={selected ?? undefined} choose={setSelected} /><figcaption>Schematisk karta. Övriga Sverige samlas i en symbol; placeringen är ungefärlig.</figcaption></figure>
      <section className="map-reading" aria-label="Regioner">
        <h2>Storleken visar efterfrågan.</h2><p className="map-legend"><svg viewBox="0 0 86 42" aria-hidden="true"><circle cx="20" cy="22" r="8" /><circle cx="57" cy="22" r="16" /></svg>Cirklarnas yta är proportionell mot ordrar. Samma skala på alla kartor.</p>
        <p className="method-note">Rött: lägre marginal än i fjol. Grått: oförändrad, högre eller okänd. Inga regionytor är färgade.</p>
        {error && <p role="alert">Regionerna kunde inte läsas: {error}</p>}
        {!data && !error && <p role="status">Regionala SQL-resultat hämtas.</p>}
        <table><thead><tr><th>Region</th><th>Ordrar</th><th>Marginal Δ</th></tr></thead><tbody>{data?.current.data.map(row => <tr key={row.region}><th scope="row"><button onClick={() => setSelected(row.region)} aria-pressed={selected === row.region}>{row.region}</button></th><td>{fmtInt(row.orders)}</td><td className={row.delta != null && row.delta < 0 ? 'decline' : ''}>{fmtPp(row.delta)}</td></tr>)}</tbody></table>
        {!selected && <p>Välj en cirkel eller region för att se utveckling och produktmix.</p>}
      </section>
    </div>
    {selected && <section className="region-panel" data-testid="map-region-panel" aria-label={`Detaljer för ${selected}`}>
      <div className="toolbar"><h2>{selected} · {fmtTkr(chosen?.revenue)}, {fmtPct(chosen?.gross_margin_pct)} marginal</h2><button onClick={() => setSelected(null)}>Stäng region</button></div>
      {data && <div className="region-evidence"><div><h3>Marginalens utveckling i {selected}</h3><Line rows={data.history.data.filter(row => row.region === selected).slice(-24)} metric="margin" max={100} height={220} /><Citation ref={{ id: 'region-history', title: `Marginal i ${selected}`, sql: `SELECT * FROM (${data.history.sql}) WHERE region=${literal(selected)}`, formula: data.history.formula, value: fmtPct(chosen?.gross_margin_pct) }} number={7} /></div><div><h3>Produktmix i {selected}</h3><ul className="mix-list">{data.mix.data.filter(row => row.region === selected).map(row => <li key={row.product}><span>{row.product}</span><span className="mix-track"><span style={{ width: `${row.share}%` }} /></span><span>{fmtPct(row.share)}</span></li>)}</ul><Citation ref={{ id: 'region-mix', title: `Produktmix i ${selected}`, sql: `SELECT * FROM (${data.mix.sql}) WHERE region=${literal(selected)}`, formula: data.mix.formula, value: 'Andel av regionens omsättning.' }} number={8} /></div></div>}
    </section>}
    <section className="map-months" aria-label="Månadskartor">{recentMonths.map(month => <figure key={month}><Sweden rows={data?.history.data.filter(row => row.month === month) ?? []} max={max} small /><figcaption>{fmtMonth(month)}</figcaption></figure>)}</section>
    <Review />
  </main>
}
export default { id: '07', name: 'Karta', paradigm: 'Geografi med proportionella symboler och regional fördjupning', defaultTheme: '02', Component: MapInterface,
  smoke: { openApproval: [] }, shots: { interaction: [{ click: 'map-region-Stockholm' }, { wait: 'map-region-panel' }] } } satisfies UiDefinition
