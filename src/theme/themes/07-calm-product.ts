import type { ThemeDefinition } from '../types'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/manrope/600.css'
import './07-calm-product.css'
import { installThemePresentation } from './06-10-presentation'
installThemePresentation()

export default {
  id: '07', name: 'Lugn arbetsyta', analyst: 'memo', kpiStyle: 'table',
  copy: { assistantTitle: 'Granskning' },
  chart: {
    fontFamily: 'IBM Plex Sans, sans-serif', axisColor: '#6B6964', labelColor: '#1F1E1C',
    gridColor: '#E6E4DF', showGrid: false, actual: '#494741', previous: '#8f8b83',
    good: '#287346', bad: '#b32632', total: '#494741', lineWidth: 1.5,
    smooth: false, areaOpacity: 0, barRadius: 0, barMaxWidth: 42,
    sparkStyle: 'line', markerSize: 5, labelFontSize: 11, waterfallStyle: 'ibcs',
    zeroBased: true, findingMarkers: true, titleMode: 'message',
  },
} satisfies ThemeDefinition
