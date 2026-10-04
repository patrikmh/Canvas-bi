import { useEffect, useRef, useSyncExternalStore } from 'react'
import { init, use } from 'echarts/core'
import type { EChartsOption } from 'echarts'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkPointComponent, TitleComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { getTheme } from '../../theme'
import { annotateFindings, findingStore } from './findings'

use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkPointComponent, TitleComponent, SVGRenderer])

export function Chart({ option, label, onProduct, className = '' }: { option: EChartsOption; label: string; onProduct?: (product: string) => void; className?: string }) {
  const element = useRef<HTMLDivElement>(null)
  const instance = useRef<ReturnType<typeof init> | null>(null)
  const findings = useSyncExternalStore(findingStore.subscribe, findingStore.getSnapshot)
  const productCallback = useRef(onProduct)
  productCallback.current = onProduct
  useEffect(() => {
    if (!element.current) return
    const chart = init(element.current, undefined, { renderer: 'svg' })
    instance.current = chart
    chart.on('click', params => {
      if (params.componentType === 'yAxis') productCallback.current?.(String(params.value))
      else if (params.name) productCallback.current?.(params.name)
    })
    const observer = new ResizeObserver(() => {
      chart.resize()
      if (getTheme().chart.titleMode === 'message') chart.setOption({ title: { textStyle: { width: Math.max(100, element.current!.clientWidth - 12), overflow: 'break' } } })
    })
    observer.observe(element.current)
    return () => { observer.disconnect(); chart.dispose(); instance.current = null }
  }, [])
  useEffect(() => {
    const annotated = getTheme().chart.findingMarkers ? annotateFindings(option, findings) : option
    const title = getTheme().chart.titleMode === 'message' && annotated.title && !Array.isArray(annotated.title)
      ? { title: { ...annotated.title, textStyle: { ...annotated.title.textStyle, width: Math.max(100, (element.current?.clientWidth ?? 400) - 12), overflow: 'break' as const } } } : {}
    instance.current?.setOption({ animation: false, textStyle: { fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#71817b' }, ...annotated, ...title }, true)
  }, [option, findings])
  return <div className={`chart ${className}`} ref={element} role="img" aria-label={label} />
}
