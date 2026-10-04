import type { EChartsOption, SeriesOption } from 'echarts'
import type { AgentResult } from '../../analysis/agent'
import { deriveFindings, findingNumber, stepInput } from '../assistant/memo'

export interface FindingContext { result: AgentResult; changeStart: string | null }
let context: FindingContext | null = null
const listeners = new Set<() => void>()
export const findingStore = {
  getSnapshot: () => context,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
  publish: (next: FindingContext | null) => { context = next; listeners.forEach(listener => listener()) },
}

/** Link the original tool-step numbers to actual coordinates without changing data. */
export function annotateFindings(option: EChartsOption, source: FindingContext | null): EChartsOption {
  if (!source || source.result.metric !== 'margin') return option
  const findings = deriveFindings(source.result)
  const numberFor = (tool: string) => findings.find(finding => finding.step.tool === tool)?.number
  const markerFor = (...tools: string[]) => tools.flatMap(tool => numberFor(tool) ? [findingNumber(numberFor(tool)!)] : []).join('')
  const x = option.xAxis as { type?: string; data?: string[] }
  const y = option.yAxis as { type?: string; data?: string[] }
  const original = (Array.isArray(option.series) ? option.series : []) as SeriesOption[]
  const series = original.map(item => ({ ...item }))
  const label = { show: true, formatter: '{b}', color: '#000', fontSize: 14 }
  const mark = (data: { name: string; coord: [string, number] }[]) => ({ symbol: 'circle', symbolSize: 23, label,
    itemStyle: { color: '#fff', borderColor: '#666', borderWidth: 1 }, data: data.filter(item => item.name) })
  if (x?.type === 'category' && series[0]?.type === 'line' && y?.type === 'value' && option.tooltip) {
    // Only margin series have percent-formatting. Revenue/count charts are not linked.
    const format = (y as { axisLabel?: { formatter?: (value: number) => string } }).axisLabel?.formatter
    if (!format?.(1).includes('%')) return option
    const values = series[0].data as (number | null)[]
    const months = x.data ?? []
    const points: { name: string; coord: [string, number] }[] = []
    const latest = months.length - 1
    if (latest >= 0 && values[latest] != null) points.push({ name: markerFor('scanKpis'), coord: [months[latest], values[latest]!] })
    const breakpoint = months.indexOf(source.changeStart ?? '')
    if (breakpoint >= 0 && values[breakpoint] != null) points.push({ name: markerFor('findLatestChange'), coord: [months[breakpoint], values[breakpoint]!] })
    series[0] = { ...series[0], markPoint: { ...mark(points), symbolSize: 5,
      data: points.map((point, index) => ({ ...point, label: { ...label, position: index ? 'top' : 'bottom', distance: 6 } })) } } as SeriesOption
  } else if (x?.type === 'category' && series.length === 3 && series[1]?.type === 'bar') {
    const bases = series[0].data as number[]
    const totals = series[1].data as (number | '-')[]
    const changes = series[2].data as ({ value: number } | '-')[]
    const economics = source.result.steps.find(step => step.tool === 'unitEconomics')
    const products = economics ? stepInput(economics).products : []
    const points = (x.data ?? []).flatMap((name, index) => {
      if (totals[index] !== '-') return [{ name: markerFor('reconcileWaterfall', ...(name === 'Nu' ? ['scanKpis'] : [])), coord: [name, totals[index] as number] as [string, number] }]
      if (name === 'Övriga') return []
      const change = changes[index]
      return [{ name: markerFor('marginWaterfall', ...(Array.isArray(products) && products.includes(name) ? ['unitEconomics'] : [])),
        coord: [name, bases[index] + (change === '-' ? 0 : change.value)] as [string, number] }]
    })
    series[1] = { ...series[1], markPoint: { ...mark(points), symbolOffset: [0, 20], symbolSize: 27 } } as SeriesOption
  } else if (x?.type === 'value' && y?.type === 'category' && series[0]?.type === 'bar') {
    const format = (x as { axisLabel?: { formatter?: (value: number) => string } }).axisLabel?.formatter
    if (!format?.(1).includes('%')) return option
    const products = source.result.steps.find(step => step.tool === 'unitEconomics')
    const names = products ? stepInput(products).products : []
    const data = series[0].data as { value: number | null }[]
    const points = (y.data ?? []).flatMap((name, index) => Array.isArray(names) && names.includes(name) && data[index]?.value != null
      ? [{ name: markerFor('marginWaterfall', 'unitEconomics'), coord: [data[index].value, name] as [number, string] }] : [])
    // Horizontal bar coordinates: value, category.
    series[0] = { ...series[0], markPoint: { ...mark([]), symbolSize: 27, symbolOffset: [20, 0], data: points.filter(point => point.name) } } as SeriesOption
  } else return option
  return { ...option, series }
}
