import type { ThemeDefinition } from '../types'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/600.css'
import '@fontsource/source-sans-3/700.css'
import './01-ibcs.css'

// Presentation only. Values, findings and comparisons come from the shared SQL layer.
export default {
  id: '01', name: 'IBCS management report', analyst: 'memo', kpiStyle: 'table',
  copy: { assistantTitle: 'Controllerkommentar' },
  chart: {
    fontFamily: '"Source Sans 3", sans-serif', axisColor: '#666666', labelColor: '#1A1A1A',
    gridColor: '#CCCCCC', showGrid: false, actual: '#1A1A1A', previous: '#A6A6A6',
    good: '#3A8E3A', bad: '#C0392B', total: '#1A1A1A', lineWidth: 1.5,
    smooth: false, areaOpacity: 0, barRadius: 0, barMaxWidth: 38,
    sparkStyle: 'line', markerSize: 4, labelFontSize: 10, waterfallStyle: 'ibcs',
    zeroBased: true, findingMarkers: true, titleMode: 'message',
  },
} satisfies ThemeDefinition
