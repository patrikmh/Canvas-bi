import type { ThemeDefinition } from '../types'
import defaultTheme from './00-default'
import './99-memo-preview.css'

// Hidden scratch theme, available only with the explicit designPreview query flag.
export default {
  ...defaultTheme, id: '99', name: 'Analysanteckning (förhandsvisning)', hidden: true,
  analyst: 'memo', kpiStyle: 'bullet',
  chart: { ...defaultTheme.chart, zeroBased: true, findingMarkers: true, titleMode: 'message',
    fontFamily: 'Arial, sans-serif', actual: '#222222', previous: '#bfbfbf', total: '#222222',
    smooth: false, areaOpacity: 0, barRadius: 0, showGrid: false, waterfallStyle: 'ibcs' },
} satisfies ThemeDefinition
