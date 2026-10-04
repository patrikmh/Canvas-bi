import type { ThemeDefinition } from '../types'
import '@fontsource/roboto-condensed/300.css'
import '@fontsource/roboto-condensed/400.css'
import '@fontsource/roboto-condensed/700.css'
import './04-economist.css'

// Presentation only. Values, findings and comparisons come from the shared SQL layer.
export default {
  id: '04', name: 'The Economist chart desk', analyst: 'memo', kpiStyle: 'bullet',
  copy: { assistantTitle: 'Briefing' },
  chart: {
    fontFamily: '"Roboto Condensed", sans-serif', axisColor: '#4F6570', labelColor: '#00588D',
    gridColor: '#CBD6DB', showGrid: true, actual: '#006BA2', previous: '#3EBCD2',
    good: '#005F52', bad: '#E3120B', total: '#00588D', lineWidth: 2,
    smooth: false, areaOpacity: 0, barRadius: 0, barMaxWidth: 36,
    sparkStyle: 'line', markerSize: 4, labelFontSize: 12, waterfallStyle: 'ibcs',
    zeroBased: true, findingMarkers: true, titleMode: 'message',
  },
} satisfies ThemeDefinition
