import type { ReactNode } from 'react'
import type { Dashboard } from '../../analysis/dashboard'
import type { Metric } from '../../canvas/layout'
import { fmtDeltaPct, fmtPp } from '../../data/format'
import { bulletScale, indexedSparkline } from './kpi'
import { metricInfo } from './options'
import './kpi.css'

interface Props { metric: Metric; dashboard: Dashboard; onDrill: () => void; how: ReactNode; id: string }
const variance = (dashboard: Dashboard, metric: Metric) => metric === 'margin'
  ? fmtPp(dashboard.snapshot.data[metric].deltaYoY) : fmtDeltaPct(dashboard.snapshot.data[metric].deltaYoY)
export function KpiBullet({ metric, dashboard, onDrill, how, id }: Props) {
  const info = metricInfo[metric], data = dashboard.snapshot.data[metric]
  const scale = bulletScale(data.current, data.lastYear)
  return <div className="kpi-content kpi-bullet" data-testid={id}>
    <button className="kpi-value" onClick={onDrill} aria-label={`Utforska ${info.label}`}>{info.format(data.current)}</button>
    <svg viewBox="0 0 240 48" role="img" aria-label={`${info.label}: ${info.format(data.current)}, samma månad i fjol ${info.format(data.lastYear)}. Linjär skala från noll.`} className="bullet-graph">
      <rect x="0" y="4" width="80" height="24" fill="#999" /><rect x="80" y="4" width="80" height="24" fill="#bfbfbf" /><rect x="160" y="4" width="80" height="24" fill="#e6e6e6" />
      {scale.current != null && <rect data-testid="bullet-current" x="0" y="12" width={scale.current * 2.4} height="8" fill="#000" />}
      {scale.previous != null && <line data-testid="bullet-previous" x1={scale.previous * 2.4} x2={scale.previous * 2.4} y1="5" y2="27" stroke="#000" strokeWidth="2" />}
      <text x="0" y="44">0</text><text x="240" y="44" textAnchor="end">{info.format(scale.max)}</text>
    </svg>
    <p className="bullet-key" title="FG: samma månad i fjol. Grå fält: skalintervall, inga beslutade mål.">Streck: FG</p>
    <p className={`bullet-variance ${data.deltaYoY == null ? '' : data.deltaYoY < 0 ? 'negative' : 'positive'}`}>ΔFG {variance(dashboard, metric)}</p>
    {how}
  </div>
}
export function KpiTableRow({ metric, dashboard, onDrill, how, id }: Props) {
  const info = metricInfo[metric], data = dashboard.snapshot.data[metric]
  const indexed = indexedSparkline(dashboard.history.data.slice(-13).map(row => row[info.field]))
  // Every KPI uses the same index scale, rather than stretching each spark to its own range.
  const commonMax = Math.max(100, ...(['revenue', 'margin', 'orders', 'customers'] as Metric[]).flatMap(key =>
    indexedSparkline(dashboard.history.data.slice(-13).map(row => row[metricInfo[key].field])).filter((value): value is number => value != null)))
  const ordinate = (value: number) => 30 - value / commonMax * 28
  const paths = indexed.reduce<string[]>((segments, value, index) => {
    if (value == null) { segments.push(''); return segments }
    if (!segments.length) segments.push('')
    const segment = segments.length - 1
    segments[segment] += `${segments[segment] ? ' L' : 'M'}${index * 100 / Math.max(1, indexed.length - 1)},${ordinate(value)}`
    return segments
  }, [])
  return <div className="kpi-table-row" data-testid={id}><table aria-label={info.label}><thead><tr><th>Nyckeltal</th><th>Nu</th><th>FG</th><th>ΔFG</th><th>Index (första = 100)</th><th>Underlag</th></tr></thead><tbody><tr>
    <th scope="row"><button onClick={onDrill} aria-label={`Utforska ${info.label}`}>{info.label}</button></th><td>{info.format(data.current)}</td><td>{info.format(data.lastYear)}</td>
    <td className={data.deltaYoY == null ? '' : data.deltaYoY < 0 ? 'negative' : 'positive'}>{variance(dashboard, metric)}</td>
    <td><svg className="indexed-sparkline" viewBox="0 0 100 32" role="img" aria-label={`${info.label}, index med första tillgängliga värdet som 100, gemensam indexskala från noll`}><line x1="0" x2="100" y1={ordinate(100)} y2={ordinate(100)} stroke="#ccc" />{paths.filter(Boolean).map((path, index) => <path key={index} d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />)}</svg></td>
    <td>{how}</td></tr></tbody></table></div>
}
