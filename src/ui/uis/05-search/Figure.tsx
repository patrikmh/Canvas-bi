import { Citation, Line } from '../../blocks'
import { useAnalystSession } from '../../session'
import { metricInfo } from '../../../components/charts/options'
import { fmtMonth, fmtMonthShort } from '../../../data/format'
import { shiftMonth } from '../../../analysis/dashboard'
import type { MetricResult, MonthlyMetrics } from '../../../data/metrics'
import { sourceSql } from './query'
import type { SearchQuery } from './query'

export function Figure({ query, months }: { query: SearchQuery; months: string[] }) {
  const session = useAnalystSession(), info = metricInfo[query.metric]
  const groups: [string, MetricResult<MonthlyMetrics[]>][] = query.group === 'products'
    ? (session.products?.data ?? []).flatMap(({ product }) => session.productSeries[product] ? [[product, session.productSeries[product]] as [string, MetricResult<MonthlyMetrics[]>]] : []) : session.series ? [['Hela butiken', session.series]] : []
  const getRows = (source: MetricResult<MonthlyMetrics[]>, previous = false) => months.map(month => source.data.find(row => row.month === (previous ? shiftMonth(month, -12) : month)))
  // Geometry only: each value is already pooled by the canonical DuckDB query.
  const max = Math.max(1, ...groups.flatMap(([, source]) => [...getRows(source), ...(query.compare === 'year' ? getRows(source, true) : [])].map(row => row?.[info.field] ?? 0)))
  const x = (index: number) => 20 + index / Math.max(1, months.length - 1) * 320
  const y = (value: number) => 72 - value / max * 60
  const paths = (values: (number | null)[]) => {
    let path = '', present = false
    values.forEach((value, index) => { if (value == null) present = false; else { path += `${present ? ' L' : ' M'}${x(index)},${y(value)}`; present = true } })
    return path
  }
  const total = query.group === 'total' && query.compare === 'none'
  return <figure className="search-figure" data-testid="search-figure">
    <figcaption><h3>{info.label}, månad för månad{query.group === 'products' ? ' per produkt' : ''}</h3><p data-testid="search-window">{fmtMonth(months[0])} till {fmtMonth(months.at(-1)!)}</p>
      <p>Källa: order_lines (inläst som sales), {session.dataset?.months.length} mån. Varje punkt är ett månadsvärde; ingen periodsumma.</p>
      <p className="search-key"><span>Utfall</span>{query.compare === 'year' && <span>Samma månader i fjol</span>}<span>Gemensam skala från noll till {info.format(max)}.</span></p>
    </figcaption>
    {total ? <Line rows={session.series!.data.filter(row => months.includes(row.month))} metric={query.metric} label={`${info.label}, valda månader`} height={300} /> : <div className="search-rows">
      <div className="search-row-head"><span>Produkt / urval</span><span>{months.map(fmtMonthShort).join(' · ')}</span><span>Senaste månaden</span></div>
      {groups.map(([name, source], sourceIndex) => {
        const current = getRows(source).map(row => row?.[info.field] ?? null), previous = getRows(source, true).map(row => row?.[info.field] ?? null)
        const sql = sourceSql(source.sql, months, query.compare)
        return <div className="search-row" key={name}>
          <p className="product-name">{name}<Citation number={sourceIndex + 1} ref={{ id: `search-${name}`, title: `${info.label}, ${name}, valda månader`, sql, formula: source.formula, value: `${months.map(fmtMonth).join(', ')}. ${info.format(current.at(-1))}` }} label={`Visa SQL och rader för ${name}`} /></p>
          <svg viewBox="0 0 360 96" role="img" aria-label={`${name}. ${months.map((month, index) => `${fmtMonth(month)}: ${info.format(current[index])}${query.compare === 'year' ? `, i fjol ${info.format(previous[index])}` : ''}`).join('. ')}. Skala från noll.`}>
            <line x1="20" x2="340" y1="72" y2="72" stroke="var(--rule)" /><text x="4" y="77">0</text>
            {query.compare === 'year' && <path d={paths(previous)} className="previous-line" />}
            {query.compare === 'year' && months.length === 1 && previous[0] != null && <circle cx={x(0)} cy={y(previous[0])} r="3" fill="#a6a6a6" />}
            <path d={paths(current)} className="current-line" />
            {current.map((value, index) => value == null ? null : <circle key={index} cx={x(index)} cy={y(value)} r="2.5" fill="var(--ink)" />)}
            {months.map((month, index) => <text key={month} x={x(index)} y="94" textAnchor="middle">{fmtMonthShort(month)}</text>)}
          </svg>
          <p className="search-value"><strong>{info.format(current.at(-1))}</strong>{query.compare === 'year' && <span>i fjol {info.format(previous.at(-1))}</span>}</p>
        </div>
      })}
    </div>}
    {total && session.series && <p><Citation number={1} ref={{ id: 'search-total', title: `${info.label}, valda månader`, sql: sourceSql(session.series.sql, months, query.compare), formula: session.series.formula, value: months.map(fmtMonth).join(', ') }} label="Visa SQL och månadsvärden för hela butiken" /></p>}
  </figure>
}
