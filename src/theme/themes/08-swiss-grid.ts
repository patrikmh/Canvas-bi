import type { ThemeDefinition } from '../types'
import '@fontsource/hanken-grotesk/400.css'
import '@fontsource/hanken-grotesk/600.css'
import '@fontsource/hanken-grotesk/700.css'
import './08-swiss-grid.css'

export default {
  id: '08', name: 'Schweizisk grid', analyst: 'memo', kpiStyle: 'bullet',
  copy: { assistantTitle: 'Analys / Granskning' },
  chart: {
    fontFamily: 'Hanken Grotesk, sans-serif', axisColor: '#555555', labelColor: '#000000',
    gridColor: '#cccccc', showGrid: false, actual: '#000000', previous: '#888888',
    good: '#000000', bad: '#E30613', total: '#000000', lineWidth: 1,
    smooth: false, areaOpacity: 0, barRadius: 0, barMaxWidth: 34,
    sparkStyle: 'line', markerSize: 4, labelFontSize: 11, waterfallStyle: 'ibcs',
    zeroBased: true, findingMarkers: true, titleMode: 'message',
  },
} satisfies ThemeDefinition
