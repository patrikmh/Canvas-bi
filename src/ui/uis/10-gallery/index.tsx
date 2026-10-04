import { useEffect, useRef, useState } from 'react'
import { useAnalystSession } from '../../session'
import { Citation, Line } from '../../blocks'
import type { UiDefinition } from '../../types'
import { generateDemoData } from '../../../data/generate'
import type { SqlEngine } from '../../../data/engine'
import { fmtMonth, fmtPct, fmtPp, fmtTkr } from '../../../data/format'
import { literal } from '../../../data/sql'
import { loadCatalogue, sortProducts, category } from './data'
import type { EconomicsRow, Sort } from './data'
import { Review } from './Review'
import { preloadEconomics } from './preload'
import './style.css'

const money = (value: number | null | undefined) => value == null ? '—' : `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(value).replace(/-/g, '−')} kr`
function path(values: (number | null)[], max: number, height: number) {
  let connected = false
  return values.flatMap((value, index) => {
    if (value == null) { connected = false; return [] }
    const command = `${connected ? 'L' : 'M'}${10 + index * 190 / Math.max(1, values.length - 1)},${height - value / max * (height - 10)}`
    connected = true
    return [command]
  }).join(' ')
}
function Economics({ rows, max, height = 60 }: { rows: EconomicsRow[]; max: number; height?: number }) {
  return <svg viewBox={`0 0 220 ${height + 18}`} className="economics-chart" role="img" aria-label={`Styckpris, heldragen linje; styckkostnad, streckad linje. Skala noll till ${money(max)}. Senast ${money(rows.at(-1)?.price)} och ${money(rows.at(-1)?.cost)}.`}>
    <line x1="10" x2="200" y1={height} y2={height} stroke="var(--rule)" />
    <path d={path(rows.map(row => row.price), max, height)} className="price-line" fill="none" strokeWidth="1.5" />
    <path d={path(rows.map(row => row.cost), max, height)} className="cost-line" fill="none" strokeWidth="1.5" strokeDasharray="4 3" />
    <text x="10" y={height + 14}>0</text><text x="200" y={height + 14} textAnchor="end">{money(rows.at(-1)?.price)} / {money(rows.at(-1)?.cost)}</text>
  </svg>
}
function Gallery() {
  const session = useAnalystSession()
  const [sort, setSort] = useState<Sort>('avvikelse')
  const [filter, setFilter] = useState('Alla kategorier')
  const [selected, setSelected] = useState<string | null>(null)
  const [catalogue, setCatalogue] = useState<{ economics: Awaited<ReturnType<typeof loadCatalogue>>['economics']; contributions: Awaited<ReturnType<typeof loadCatalogue>>['contributions'] | null } | null>(null)
  const [error, setError] = useState('')
  const sheet = useRef<HTMLDialogElement>(null)
  const readyPeriods = session.period.before.join(',') + '|' + session.period.after.join(',')
  useEffect(() => {
    let cancelled = false
    void preloadEconomics?.then(preloaded => {
      if (!cancelled && preloaded?.month === session.month) setCatalogue(current => current ?? { economics: preloaded.economics, contributions: null })
    })
    return () => { cancelled = true }
  }, [session.month])
  useEffect(() => {
    if (!session.period.before.length || !session.period.after.length) return
    let cancelled = false, live: SqlEngine | undefined
    void (async () => {
      const { createBrowserEngine } = await import('../../../data/engine.browser')
      const engine = await createBrowserEngine(); live = engine
      if (cancelled) { await engine.close(); return }
      await engine.loadOrderLines(generateDemoData())
      const data = await loadCatalogue(engine, session.month, session.period.before, session.period.after)
      if (!cancelled) setCatalogue(data)
    })().catch(cause => { if (!cancelled) setError(String(cause)) })
    return () => { cancelled = true; void live?.close() }
  }, [session.month, readyPeriods])
  useEffect(() => { if (selected && sheet.current && !sheet.current.open) sheet.current.showModal() }, [selected])
  const months = session.dashboard?.history.data.map(row => row.month) ?? []
  const rows = sortProducts(session.products?.data ?? [], sort, catalogue?.contributions?.data ?? []).filter(row => filter === 'Alla kategorier' || category(row.product) === filter)
  const costMax = Math.max(1, ...catalogue?.economics.data.flatMap(row => [row.price ?? 0, row.cost ?? 0]) ?? [])
  const finding = session.findings.find(item => item.step.tool === 'marginWaterfall')
  const affected = session.waterfall?.data.filter(step => step.kind === 'change' && step.label !== 'Övriga').map(step => step.label) ?? []
  const chosen = session.products?.data.find(row => row.product === selected)
  const productRows = selected ? session.productSeries[selected]?.data.filter(row => months.includes(row.month)) ?? [] : []
  const economics = (product: string) => catalogue?.economics.data.filter(row => row.product === product && months.includes(row.month)) ?? []
  return <main className="ui-gallery">
    <div className="toolbar"><span>DemoCo AB · Produktvägg</span><span>{fmtMonth(session.month)}</span></div>
    <h1>Se vilka produkter som bryter mönstret.</h1><p>Jämför hela sortimentet på samma skalor. Börja där marginalen avviker mest och öppna produktbladet för att granska orsaken.</p>
    <div className="gallery-tools"><label>Sortera <select data-testid="gallery-sort" value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="avvikelse">Störst marginalfall först</option><option value="bidrag">Bidrag till marginalfallet</option><option value="marginal">Lägst marginal först</option><option value="omsättning">Högst omsättning först</option><option value="kategori">Kategori</option></select></label><label>Visa <select data-testid="gallery-filter" value={filter} onChange={event => setFilter(event.target.value)}><option>Alla kategorier</option><option>Textil</option><option>Hemdetaljer</option></select></label></div>
    <p className="gallery-key">Övre linjen: marginal, gemensam skala 0–100 %. Undre paret: styckpris (heldragen) och inköpskostnad (streckad), 0–{money(costMax)}. Rött markerar stora marginalfall. Siffran hänvisar till analysens fynd.</p>
    {error && <p role="alert">Styckkostnaderna kunde inte läsas: {error}</p>}
    {!catalogue && !error && <p className="catalogue-loading" role="status">Styckkostnadsserier räknas i lokal SQL.</p>}
    <section className="product-wall" aria-label="Produktserier med gemensamma skalor">
      {rows.map((row, index) => {
        const series = session.productSeries[row.product]?.data.filter(item => months.includes(item.month)) ?? []
        const outlier = session.dashboard?.marginProducts.data.find(item => item.product === row.product)?.outlier
        return <button className={`product-print${outlier ? ' product-outlier' : ''}`} key={row.product} data-testid={index === 0 ? 'gallery-worst' : `gallery-product-${row.product}`} onClick={() => setSelected(row.product)} aria-label={`Öppna ${row.product}, marginal ${fmtPct(row.margin)}, förändring ${fmtPp(row.marginDeltaPp)}`}>
          <svg className="margin-mini" viewBox="0 0 220 78" aria-hidden="true"><line x1="10" x2="200" y1="60" y2="60" stroke="var(--rule)" /><path d={path(series.map(item => item.gross_margin_pct), 100, 60)} fill="none" stroke="currentColor" strokeWidth="1.7" /><text x="10" y="74">0</text><text x="200" y="74" textAnchor="end">{fmtPct(row.margin)}</text></svg>
          <Economics rows={economics(row.product)} max={costMax} />
          <span className="product-label">{row.product}{affected.includes(row.product) && finding && <sup aria-label={`Fynd ${finding.number}`}>{finding.number}</sup>}</span>
          <span className="product-meta">{fmtPp(row.marginDeltaPp)} · {fmtTkr(row.revenue)}</span>
        </button>
      })}
    </section>
    <p className="method-note">{months.length ? `${fmtMonth(months[0])} till ${fmtMonth(months.at(-1)!)}.` : ''} Kategorierna är en lokal katalogindelning. Underlaget är syntetiskt; varje produktblad visar beräkningen.</p>
    {selected && <dialog ref={sheet} className="product-sheet" data-testid="gallery-sheet" aria-labelledby="product-sheet-heading" onCancel={() => setSelected(null)} onClose={() => setSelected(null)}>
      <div className="toolbar"><h2 id="product-sheet-heading">{selected}</h2><button autoFocus onClick={() => { sheet.current?.close(); setSelected(null) }}>Stäng produktblad</button></div>
      <p>{fmtPct(chosen?.margin)} marginal · {fmtPp(chosen?.marginDeltaPp)} mot i fjol · {fmtTkr(chosen?.revenue)} omsättning.</p>
      <h3>Marginalen i {selected}</h3><Line rows={productRows} metric="margin" max={100} height={210} label={`Marginal för ${selected}`} />
      {session.productSeries[selected] && <Citation ref={{ id: 'gallery-margin', title: `Månadsserie för ${selected}`, ...session.productSeries[selected], value: fmtPct(chosen?.margin) }} number={6} />}
      <h3>Inköpskostnaden jämfört med styckpriset</h3><Economics rows={economics(selected)} max={costMax} height={130} />
      <p className="method-note">Heldraget: styckpris. Streckat: inköpskostnad. Båda är antalsviktade, i kronor. {catalogue && <Citation ref={{ id: 'gallery-economics', title: `Styckkostnad och pris för ${selected}`, sql: `SELECT * FROM (${catalogue.economics.sql}) WHERE product=${literal(selected)}`, formula: catalogue.economics.formula, value: `${money(economics(selected).at(-1)?.price)} / ${money(economics(selected).at(-1)?.cost)}` }} number={7} />}</p>
      <Review compact />
    </dialog>}
  </main>
}
export default { id: '10', name: 'Galleri / produktvägg', paradigm: 'Produktkatalog med små jämförbara diagram och detaljblad', defaultTheme: '01', Component: Gallery,
  smoke: { openApproval: [{ click: 'gallery-worst' }, { wait: 'gallery-sheet' }] }, shots: { interaction: [{ click: 'gallery-worst' }, { wait: 'gallery-sheet' }] } } satisfies UiDefinition
