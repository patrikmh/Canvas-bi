import type { ThemeDefinition } from '../types'
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/libre-franklin/400.css'
import '@fontsource/libre-franklin/600.css'
import './03-ft.css'

// Presentation only. Values, findings and comparisons come from the shared SQL layer.
export default {
  id: '03', name: 'FT pink-paper financial graphics', analyst: 'memo', kpiStyle: 'spark',
  copy: { assistantTitle: 'Analyskolumn' },
  chart: {
    fontFamily: '"Libre Franklin", sans-serif', axisColor: '#645B53', labelColor: '#262A33',
    gridColor: '#D8C8B9', showGrid: true, actual: '#0F5499', previous: '#B8AA9C',
    good: '#0D7680', bad: '#990F3D', total: '#262A33', lineWidth: 2,
    smooth: false, areaOpacity: 0, barRadius: 0, barMaxWidth: 48,
    sparkStyle: 'line', markerSize: 4, labelFontSize: 11, waterfallStyle: 'ibcs',
    zeroBased: true, findingMarkers: true, titleMode: 'message',
  },
} satisfies ThemeDefinition
