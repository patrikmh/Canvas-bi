export interface ChartTokens {
  fontFamily: string
  axisColor: string
  labelColor: string
  gridColor: string
  showGrid: boolean
  actual: string
  previous: string
  good: string
  bad: string
  total: string
  lineWidth: number
  smooth: number | boolean
  areaOpacity: number
  barRadius: number
  barMaxWidth: number
  sparkStyle: 'line' | 'area' | 'bar'
  markerSize: number
  labelFontSize: number
  waterfallStyle: 'solid' | 'ibcs'
  zeroBased?: boolean
  findingMarkers?: boolean
  titleMode?: 'label' | 'message'
}

export interface ThemeDefinition {
  id: string
  name: string
  chart: ChartTokens
  /** Omitted flags preserve the original chat and sparkline presentation. */
  analyst?: 'chat' | 'memo'
  kpiStyle?: 'spark' | 'bullet' | 'table'
  hidden?: boolean
  copy?: { assistantTitle?: string }
}
