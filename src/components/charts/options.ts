import type { EChartsOption } from 'echarts'
import type { Dashboard } from '../../analysis/dashboard'
import type { Metric } from '../../canvas/layout'
import type { MonthlyMetrics, ProductMetrics, WaterfallStep } from '../../data/metrics'
import { fmtInt, fmtMonth, fmtMonthShort, fmtPct, fmtPp, fmtTkr } from '../../data/format'

export const teal = '#1d4f5a'
export const red = '#b3263a'
export const metricInfo = {
  revenue: { label: 'Omsättning', format: fmtTkr, field: 'revenue' },
  margin: { label: 'Bruttomarginal', format: fmtPct, field: 'gross_margin_pct' },
  orders: { label: 'Ordrar', format: fmtInt, field: 'orders' },
  customers: { label: 'Kunder', format: fmtInt, field: 'customers' },
} as const

export function trendOption(rows: MonthlyMetrics[], metric: Metric, spark = false, bad = false): EChartsOption {
  const info = metricInfo[metric]
  const data = rows.map(row => row[info.field])
  return {
    grid: spark ? { left: 2, right: 5, top: 5, bottom: 3 } : { left: 60, right: 16, top: 15, bottom: 30 },
    tooltip: spark ? undefined : { trigger: 'axis', valueFormatter: value => info.format(Number(value)) },
    xAxis: { type: 'category', data: rows.map(row => row.month), boundaryGap: false, show: !spark,
      axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: '#71817b', fontSize: 10,
        formatter: (value: string) => value.endsWith('-01') ? `jan ${value.slice(0, 4)}` : fmtMonthShort(value) } },
    yAxis: { type: 'value', show: !spark, scale: spark || metric === 'margin', splitNumber: metric === 'margin' ? 4 : 5,
      axisLabel: { color: '#71817b', fontSize: 10, formatter: (value: number) => metric === 'margin' ? fmtPct(value, 0) : info.format(value) },
      splitLine: { lineStyle: { color: '#d8e2de' } } },
    series: [{ type: 'line', data, smooth: .25, symbol: 'none', lineStyle: { color: teal, width: spark ? 1.5 : 2 },
      itemStyle: { color: teal }, areaStyle: { color: 'rgba(29,79,90,.09)' },
      markPoint: { symbol: 'circle', symbolSize: spark ? 5 : 7, label: { show: false }, itemStyle: { color: bad ? red : teal },
        data: rows.length ? [{ name: 'Senaste månaden', coord: [rows.at(-1)!.month, data.at(-1)!] }] : [] } }],
  }
}

export type ProductChartRow = ProductMetrics & { outlier?: boolean; orders?: number; compareOrders?: number; customers?: number; compareCustomers?: number }
export function productValue(row: ProductChartRow, metric: Metric, previous = false): number | null {
  return metric === 'margin' ? previous ? row.compareMargin : row.margin
    : metric === 'orders' ? (previous ? row.compareOrders : row.orders) ?? null
      : metric === 'customers' ? (previous ? row.compareCustomers : row.customers) ?? null
        : previous ? row.compareRevenue : row.revenue
}
export function productOption(rows: ProductChartRow[], metric: Metric, month: string, compareMonth: string): EChartsOption {
  const margin = metric === 'margin'
  const format = metricInfo[metric].format
  const current = fmtMonth(month)
  const previous = fmtMonth(compareMonth)
  return {
    grid: { left: 138, right: 24, top: 42, bottom: 35 },
    legend: { right: 10, top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: '#71817b', fontSize: 11 } },
    tooltip: { trigger: 'axis', valueFormatter: value => format(Number(value)) },
    xAxis: { type: 'value', axisLabel: { color: '#71817b', fontSize: 10, formatter: (value: number) => format(value) }, splitLine: { lineStyle: { color: '#d8e2de' } } },
    yAxis: { type: 'category', inverse: true, data: rows.map(row => row.product), triggerEvent: true,
      axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#35423d', fontSize: 11, width: 130, overflow: 'truncate' } },
    series: [
      { name: current.charAt(0).toUpperCase() + current.slice(1), type: 'bar', barWidth: 9, barGap: '15%',
        data: rows.map(row => ({ value: productValue(row, metric), itemStyle: { color: row.outlier && margin ? red : teal, borderRadius: [0, 2, 2, 0] } })) },
      { name: previous.charAt(0).toUpperCase() + previous.slice(1), type: 'bar', barWidth: 9,
        itemStyle: { color: '#b3bcb8', borderRadius: [0, 2, 2, 0] }, data: rows.map(row => productValue(row, metric, true)) },
    ],
  }
}

export function waterfallOption(steps: WaterfallStep[]): EChartsOption {
  // Coordinates only: the financial contributions are returned by marginWaterfall SQL.
  let running = 0
  const bases: number[] = [], totals: (number | '-')[] = [], changes: ({ value: number; itemStyle: { color: string } } | '-')[] = []
  for (const step of steps) {
    if (step.kind === 'total') { bases.push(0); totals.push(step.value); changes.push('-'); running = step.value }
    else { bases.push(Math.min(running, running + step.value)); totals.push('-'); changes.push({ value: Math.abs(step.value), itemStyle: { color: step.value < 0 ? red : '#2f7d4f' } }); running += step.value }
  }
  return {
    grid: { left: 52, right: 16, top: 25, bottom: 32 },
    tooltip: { trigger: 'axis', formatter: params => {
      const index = Array.isArray(params) ? params[0].dataIndex : 0
      const step = steps[index]
      return step ? `${step.label}: ${step.kind === 'total' ? fmtPct(step.value) : fmtPp(step.value)}` : ''
    } },
    xAxis: { type: 'category', data: steps.map(step => step.label), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#35423d', fontSize: 11 } },
    yAxis: { type: 'value', min: steps.length ? Math.floor(Math.min(...steps.filter(step => step.kind === 'total').map(step => step.value)) / 5) * 5 : 0, max: value => Math.ceil(value.max / 2) * 2, interval: 2,
      axisLabel: { color: '#71817b', fontSize: 10, formatter: (value: number) => fmtPct(value, 0) }, splitLine: { lineStyle: { color: '#d8e2de' } } },
    series: [
      { type: 'bar', stack: 'margin', data: bases, silent: true, itemStyle: { color: 'transparent', borderColor: 'transparent' }, emphasis: { disabled: true } },
      { type: 'bar', stack: 'margin', barMaxWidth: 70, data: totals, itemStyle: { color: teal, borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', color: '#71817b', fontSize: 11, formatter: params => fmtPct(steps[params.dataIndex].value) } },
      { type: 'bar', stack: 'margin', barMaxWidth: 70, data: changes, itemStyle: { color: red },
        label: { show: true, position: 'top', color: '#71817b', fontSize: 11, formatter: params => fmtPp(steps[params.dataIndex].value).replace(/\s*p.e\./, '') } },
    ],
  }
}

export function periodRange(months: string[]) {
  if (!months.length) return ''
  return `${fmtMonth(months[0]).replace(/ \d{4}$/, '')}–${fmtMonth(months.at(-1)!)}`
}
export const waterfallSubtitle = (dashboard: Dashboard) => `Bidrag i procentenheter, ${periodRange(dashboard.after)} mot ${periodRange(dashboard.before)}`
