import type { ThemeDefinition } from '../types'
import '@fontsource/old-standard-tt/400.css'
import '@fontsource/old-standard-tt/700.css'
import '@fontsource/newsreader/400.css'
import '@fontsource/libre-franklin/400.css'
import '@fontsource/libre-franklin/600.css'
import './06-morning-briefing.css'
import { installThemePresentation } from './06-10-presentation'
installThemePresentation()

export default {
  id: '06', name: 'Morgonbrief', analyst: 'memo', kpiStyle: 'spark',
  copy: { assistantTitle: 'Analysredaktionen' },
  chart: {
    fontFamily: 'Libre Franklin, sans-serif', axisColor: '#575752', labelColor: '#121212',
    gridColor: '#dadad3', showGrid: false, actual: '#121212', previous: '#85857e',
    good: '#2E5E4E', bad: '#aa2632', total: '#121212', lineWidth: 1.5,
    smooth: false, areaOpacity: 0, barRadius: 0, barMaxWidth: 46,
    sparkStyle: 'line', markerSize: 5, labelFontSize: 11, waterfallStyle: 'ibcs',
    zeroBased: true, findingMarkers: true, titleMode: 'message',
  },
} satisfies ThemeDefinition
