import type { ThemeDefinition } from '../types'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/400-italic.css'
import '@fontsource/eb-garamond/600.css'
import '@fontsource/hanken-grotesk/400.css'
import './05-tufte.css'

// Presentation only. Values, findings and comparisons come from the shared SQL layer.
export default {
  id: '05', name: 'Tufte handout', analyst: 'memo', kpiStyle: 'table',
  copy: { assistantTitle: 'Marginalanteckningar' },
  chart: {
    fontFamily: '"Hanken Grotesk", sans-serif', axisColor: '#666660', labelColor: '#111111',
    gridColor: '#DDDCD4', showGrid: false, actual: '#111111', previous: '#A6A6A0',
    good: '#111111', bad: '#A33C34', total: '#111111', lineWidth: 1,
    smooth: false, areaOpacity: 0, barRadius: 0, barMaxWidth: 32,
    sparkStyle: 'line', markerSize: 4, labelFontSize: 10, waterfallStyle: 'ibcs',
    zeroBased: true, findingMarkers: true, titleMode: 'message',
  },
} satisfies ThemeDefinition
