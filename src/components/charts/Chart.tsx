import { useEffect, useRef } from 'react'
import { init, use } from 'echarts/core'
import type { EChartsOption } from 'echarts'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkPointComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'

use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkPointComponent, SVGRenderer])

export function Chart({ option, label, onProduct, className = '' }: { option: EChartsOption; label: string; onProduct?: (product: string) => void; className?: string }) {
  const element = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!element.current) return
    const chart = init(element.current, undefined, { renderer: 'svg' })
    chart.setOption({ animation: false, textStyle: { fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#71817b' }, ...option })
    chart.on('click', params => {
      if (params.componentType === 'yAxis') onProduct?.(String(params.value))
      else if (params.name) onProduct?.(params.name)
    })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(element.current)
    return () => { observer.disconnect(); chart.dispose() }
  }, [option, onProduct])
  return <div className={`chart ${className}`} ref={element} role="img" aria-label={label} />
}
