import type { ThemeDefinition } from '../types'
import '@fontsource/vt323/400.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import './10-windows-98.css'
import { installThemePresentation } from './06-10-presentation'
installThemePresentation()

export default {
  id: '10', name: 'Windows 98 / Excel', analyst: 'memo', kpiStyle: 'table',
  copy: { assistantTitle: 'Analysrapport.doc' },
  chart: {
    fontFamily: 'Arial, sans-serif', axisColor: '#333333', labelColor: '#000000',
    gridColor: '#d0d0d0', showGrid: true, actual: '#333333', previous: '#999999',
    good: '#006b38', bad: '#b00000', total: '#333333', lineWidth: 1,
    smooth: false, areaOpacity: 0, barRadius: 0, barMaxWidth: 40,
    sparkStyle: 'line', markerSize: 5, labelFontSize: 11, waterfallStyle: 'ibcs',
    zeroBased: true, findingMarkers: true, titleMode: 'message',
  },
} satisfies ThemeDefinition
