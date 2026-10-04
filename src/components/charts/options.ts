import type { EChartsOption } from 'echarts'
import { color } from 'echarts/core'
import { getTheme } from '../../theme'
import type { ChartTokens } from '../../theme'
import defaultTheme from '../../theme/themes/00-default'
import type { Dashboard } from '../../analysis/dashboard'
import type { Metric } from '../../canvas/layout'
import type { MonthlyMetrics, ProductMetrics, WaterfallStep } from '../../data/metrics'
import { fmtInt, fmtMonth, fmtMonthShort, fmtPct, fmtPp, fmtTkr } from '../../data/format'

// Kept as public default aliases for existing callers.
export const teal = defaultTheme.chart.actual
export const red = defaultTheme.chart.bad

// Chart.tsx supplies these exact defaults. Override only changed tokens to retain
// the original option objects as well as their rendered appearance.
function chartText(tokens: ChartTokens): EChartsOption {
  return tokens.fontFamily === defaultTheme.chart.fontFamily
    && tokens.labelFontSize === defaultTheme.chart.labelFontSize
    && tokens.axisColor === defaultTheme.chart.axisColor ? {} : {
      textStyle: { fontFamily: tokens.fontFamily, fontSize: tokens.labelFontSize + 1, color: tokens.axisColor },
    }
}
function areaColor(actual: string, opacity: number): string {
  // ECharts' default area opacity still applies, just as it did before themes.
  // Retain the old literal spelling while accepting all ECharts CSS colors.
  return color.modifyAlpha(actual, opacity).replace(',0.', ',.')
}
export const metricInfo = {
  revenue: { label: 'Omsättning', format: fmtTkr, field: 'revenue' },
  margin: { label: 'Bruttomarginal', format: fmtPct, field: 'gross_margin_pct' },
  orders: { label: 'Ordrar', format: fmtInt, field: 'orders' },
  customers: { label: 'Kunder', format: fmtInt, field: 'customers' },
} as const

export function trendOption(rows: MonthlyMetrics[], metric: Metric, spark = false, bad = false): EChartsOption {
  const tokens = getTheme().chart
  const info = metricInfo[metric]
  const data = rows.map(row => row[info.field])
  return {
    ...chartText(tokens),
    grid: spark ? { left: 2, right: 5, top: 5, bottom: 3 } : { left: 60, right: 16, top: 15, bottom: 30 },
    tooltip: spark ? undefined : { trigger: 'axis', valueFormatter: value => info.format(Number(value)) },
    xAxis: { type: 'category', data: rows.map(row => row.month), boundaryGap: false, show: !spark,
      axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: tokens.axisColor, fontSize: tokens.labelFontSize,
        formatter: (value: string) => value.endsWith('-01') ? `jan ${value.slice(0, 4)}` : fmtMonthShort(value) } },
    yAxis: { type: 'value', show: !spark, scale: spark || metric === 'margin', splitNumber: metric === 'margin' ? 4 : 5,
      axisLabel: { color: tokens.axisColor, fontSize: tokens.labelFontSize, formatter: (value: number) => metric === 'margin' ? fmtPct(value, 0) : info.format(value) },
      splitLine: { ...(!tokens.showGrid ? { show: false } : {}), lineStyle: { color: tokens.gridColor } } },
    series: [{ type: spark && tokens.sparkStyle === 'bar' ? 'bar' : 'line', data,
      ...(spark && tokens.sparkStyle === 'bar'
        ? { barMaxWidth: tokens.barMaxWidth, itemStyle: { color: tokens.actual, borderRadius: tokens.barRadius } }
        : { smooth: tokens.smooth, symbol: 'none', lineStyle: { color: tokens.actual, width: spark ? tokens.lineWidth * .75 : tokens.lineWidth },
          itemStyle: { color: tokens.actual }, ...(spark && tokens.sparkStyle === 'line' ? {} : { areaStyle: { color: areaColor(tokens.actual, tokens.areaOpacity) } }) }),
      markPoint: { symbol: 'circle', symbolSize: spark ? tokens.markerSize * 5 / 7 : tokens.markerSize, label: { show: false }, itemStyle: { color: bad ? tokens.bad : tokens.actual },
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
  const tokens = getTheme().chart
  const margin = metric === 'margin'
  const format = metricInfo[metric].format
  const current = fmtMonth(month)
  const previous = fmtMonth(compareMonth)
  return {
    ...chartText(tokens),
    grid: { left: 138, right: 24, top: 42, bottom: 35 },
    legend: { right: 10, top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: tokens.axisColor, fontSize: tokens.labelFontSize + 1 } },
    tooltip: { trigger: 'axis', valueFormatter: value => format(Number(value)) },
    xAxis: { type: 'value', axisLabel: { color: tokens.axisColor, fontSize: tokens.labelFontSize, formatter: (value: number) => format(value) }, splitLine: { ...(!tokens.showGrid ? { show: false } : {}), lineStyle: { color: tokens.gridColor } } },
    yAxis: { type: 'category', inverse: true, data: rows.map(row => row.product), triggerEvent: true,
      axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: tokens.labelColor, fontSize: tokens.labelFontSize + 1, width: 130, overflow: 'truncate' } },
    series: [
      { name: current.charAt(0).toUpperCase() + current.slice(1), type: 'bar', barWidth: 9, ...(tokens.barMaxWidth !== defaultTheme.chart.barMaxWidth ? { barMaxWidth: tokens.barMaxWidth } : {}), barGap: '15%',
        data: rows.map(row => ({ value: productValue(row, metric), itemStyle: { color: row.outlier && margin ? tokens.bad : tokens.actual, borderRadius: [0, tokens.barRadius, tokens.barRadius, 0] } })) },
      { name: previous.charAt(0).toUpperCase() + previous.slice(1), type: 'bar', barWidth: 9, ...(tokens.barMaxWidth !== defaultTheme.chart.barMaxWidth ? { barMaxWidth: tokens.barMaxWidth } : {}),
        itemStyle: { color: tokens.previous, borderRadius: [0, tokens.barRadius, tokens.barRadius, 0] }, data: rows.map(row => productValue(row, metric, true)) },
    ],
  }
}

export function waterfallOption(steps: WaterfallStep[]): EChartsOption {
  const tokens = getTheme().chart
  // Coordinates only: the financial contributions are returned by marginWaterfall SQL.
  let running = 0
  const bases: number[] = [], totals: (number | '-')[] = [], changes: ({ value: number; itemStyle: { color: string } } | '-')[] = []
  for (const step of steps) {
    if (step.kind === 'total') { bases.push(0); totals.push(step.value); changes.push('-'); running = step.value }
    else { bases.push(Math.min(running, running + step.value)); totals.push('-'); changes.push({ value: Math.abs(step.value), itemStyle: { color: step.value < 0 ? tokens.bad : tokens.good } }); running += step.value }
  }
  return {
    ...chartText(tokens),
    grid: { left: 52, right: 16, top: 25, bottom: 32 },
    tooltip: { trigger: 'axis', formatter: params => {
      const index = Array.isArray(params) ? params[0].dataIndex : 0
      const step = steps[index]
      return step ? `${step.label}: ${step.kind === 'total' ? fmtPct(step.value) : fmtPp(step.value)}` : ''
    } },
    xAxis: { type: 'category', data: steps.map(step => step.label), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: tokens.labelColor, fontSize: tokens.labelFontSize + 1 } },
    yAxis: { type: 'value', min: steps.length ? Math.floor(Math.min(...steps.filter(step => step.kind === 'total').map(step => step.value)) / 5) * 5 : 0, max: value => Math.ceil(value.max / 2) * 2, interval: 2,
      axisLabel: { color: tokens.axisColor, fontSize: tokens.labelFontSize, formatter: (value: number) => fmtPct(value, 0) }, splitLine: { ...(!tokens.showGrid ? { show: false } : {}), lineStyle: { color: tokens.gridColor } } },
    series: [
      { type: 'bar', stack: 'margin', data: bases, silent: true, itemStyle: { color: 'transparent', borderColor: 'transparent' }, emphasis: { disabled: true } },
      { type: 'bar', stack: 'margin', barMaxWidth: tokens.barMaxWidth, data: totals, itemStyle: { color: tokens.total, borderRadius: tokens.waterfallStyle === 'ibcs' ? 0 : [tokens.barRadius ? tokens.barRadius + 1 : 0, tokens.barRadius ? tokens.barRadius + 1 : 0, 0, 0] },
        label: { show: true, position: 'top', color: tokens.axisColor, fontSize: tokens.labelFontSize + 1, formatter: params => fmtPct(steps[params.dataIndex].value) } },
      { type: 'bar', stack: 'margin', barMaxWidth: tokens.barMaxWidth, data: changes, itemStyle: { color: tokens.bad },
        label: { show: true, position: 'top', color: tokens.axisColor, fontSize: tokens.labelFontSize + 1, formatter: params => fmtPp(steps[params.dataIndex].value).replace(/\s*p.e\./, '') } },
    ],
  }
}

export function periodRange(months: string[]) {
  if (!months.length) return ''
  return `${fmtMonth(months[0]).replace(/ \d{4}$/, '')}–${fmtMonth(months.at(-1)!)}`
}
export const waterfallSubtitle = (dashboard: Dashboard) => `Bidrag i procentenheter, ${periodRange(dashboard.after)} mot ${periodRange(dashboard.before)}`
