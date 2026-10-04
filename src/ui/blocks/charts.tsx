import type { EChartsOption } from 'echarts'
import type { Metric } from '../../canvas/layout'
import type { MonthlyMetrics, WaterfallStep } from '../../data/metrics'
import { Chart } from '../../components/charts/Chart'
import { trendOption, productOption, waterfallOption, metricInfo } from '../../components/charts/options'
import type { ProductChartRow } from '../../components/charts/options'
import { bulletScale } from '../../components/charts/kpi'
import { getTheme } from '../../theme'

interface SeriesProps { rows: MonthlyMetrics[]; metric: Metric; label?: string; height?: number; max?: number }
function zeroBased(option: EChartsOption, axis: 'xAxis' | 'yAxis', max?: number): EChartsOption {
  return { ...option, [axis]: { ...option[axis] as object, min: 0, scale: false, ...(max == null ? {} : { max }) } }
}
export function Sparkline({ rows, metric, label = metricInfo[metric].label, height = 36, max }: SeriesProps) {
  return <div style={{ height }}><Chart option={zeroBased(trendOption(rows, metric, true), 'yAxis', max)} label={label} /></div>
}
export function Line({ rows, metric, label = metricInfo[metric].label, height = 240, max }: SeriesProps) {
  return <div style={{ height }}><Chart option={zeroBased(trendOption(rows, metric), 'yAxis', max)} label={label} /></div>
}
export function Bars({ rows, metric, month, compareMonth, label = metricInfo[metric].label, height = 320, max, onProduct }: {
  rows: ProductChartRow[]; metric: Metric; month: string; compareMonth: string; label?: string; height?: number; max?: number; onProduct?: (product: string) => void
}) {
  return <div style={{ height }}><Chart option={zeroBased(productOption(rows, metric, month, compareMonth), 'xAxis', max)} label={label} onProduct={onProduct} /></div>
}
export function Waterfall({ steps, label = 'Produktbidrag till förändringen', height = 260, max }: { steps: WaterfallStep[]; label?: string; height?: number; max?: number }) {
  const option = zeroBased(waterfallOption(steps), 'yAxis', max)
  return <div style={{ height }}><Chart option={{ ...option, yAxis: { ...option.yAxis as object, interval: undefined, splitNumber: 5 } }} label={label} /></div>
}
export function BulletGraph({ current, previous, metric, label = metricInfo[metric].label }: { current: number | null; previous: number | null; metric: Metric; label?: string }) {
  const scale = bulletScale(current, previous), tokens = getTheme().chart, info = metricInfo[metric]
  return <svg className="ui-bullet" viewBox="0 0 240 48" role="img" aria-label={`${label}: ${info.format(current)}, FG ${info.format(previous)}. Skala från noll; grå skalintervall är inga beslutade mål.`}>
    <rect x="0" y="4" width="80" height="24" fill="#999" /><rect x="80" y="4" width="80" height="24" fill="#bfbfbf" /><rect x="160" y="4" width="80" height="24" fill="#e6e6e6" />
    {scale.current != null && <rect x="0" y="12" width={scale.current * 2.4} height="8" fill={tokens.actual} />}
    {scale.previous != null && <line x1={scale.previous * 2.4} x2={scale.previous * 2.4} y1="5" y2="27" stroke={tokens.total} strokeWidth="2" />}
    <text x="0" y="44" fill={tokens.labelColor}>0</text><text x="240" y="44" textAnchor="end" fill={tokens.labelColor}>{info.format(scale.max)}</text>
  </svg>
}
