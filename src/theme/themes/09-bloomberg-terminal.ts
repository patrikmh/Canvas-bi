import type { ThemeDefinition } from '../types'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/ibm-plex-sans-condensed/400.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import './09-bloomberg-terminal.css'
import { installThemePresentation } from './06-10-presentation'
installThemePresentation()

export default {
  id: '09', name: 'Analysterminal', analyst: 'memo', kpiStyle: 'table',
  copy: { assistantTitle: 'ANLS <GO>' },
  chart: {
    fontFamily: 'IBM Plex Mono, monospace', axisColor: '#bdbdbd', labelColor: '#FFA028',
    gridColor: '#343434', showGrid: false, actual: '#FFA028', previous: '#929292',
    good: '#4AF6C3', bad: '#FF433D', total: '#FFA028', lineWidth: 1,
    smooth: false, areaOpacity: 0, barRadius: 0, barMaxWidth: 32,
    sparkStyle: 'line', markerSize: 4, labelFontSize: 10, waterfallStyle: 'ibcs',
    zeroBased: true, findingMarkers: true, titleMode: 'message',
  },
} satisfies ThemeDefinition
