import type { ThemeDefinition } from '../types'

// CSS defaults live on :root in index.css, so the absent-query UI stays identical.
export default {
  id: '00',
  name: 'Standard',
  analyst: 'chat',
  kpiStyle: 'spark',
  chart: {
    fontFamily: 'Arial, sans-serif', axisColor: '#71817b', labelColor: '#35423d',
    gridColor: '#d8e2de', showGrid: true, actual: '#1d4f5a', previous: '#b3bcb8',
    good: '#2f7d4f', bad: '#b3263a', total: '#1d4f5a', lineWidth: 2,
    smooth: .25, areaOpacity: .09, barRadius: 2, barMaxWidth: 70,
    sparkStyle: 'area', markerSize: 7, labelFontSize: 10, waterfallStyle: 'solid',
    zeroBased: false, findingMarkers: false, titleMode: 'label',
  },
} satisfies ThemeDefinition
