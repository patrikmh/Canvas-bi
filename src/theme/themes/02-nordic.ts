import type { ThemeDefinition } from '../types'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/600.css'
import '@fontsource/source-sans-3/700.css'
import './02-nordic.css'

// Presentation only. Values, findings and comparisons come from the shared SQL layer.
export default {
  id: '02', name: 'Nordisk offentlig sektor', analyst: 'memo', kpiStyle: 'bullet',
  copy: { assistantTitle: 'Sammanfattning' },
  chart: {
    fontFamily: '"Source Sans 3", sans-serif', axisColor: '#56524C', labelColor: '#23262A',
    gridColor: '#D6D1C9', showGrid: false, actual: '#2F5D8A', previous: '#B5AFA6',
    good: '#5E7D5B', bad: '#A23B32', total: '#23262A', lineWidth: 2.5,
    smooth: false, areaOpacity: 0, barRadius: 0, barMaxWidth: 44,
    sparkStyle: 'line', markerSize: 4, labelFontSize: 14, waterfallStyle: 'ibcs',
    zeroBased: true, findingMarkers: true, titleMode: 'message',
  },
} satisfies ThemeDefinition
