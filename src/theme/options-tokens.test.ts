import { afterEach, expect, test, vi } from 'vitest'
import * as theme from './index'
import defaultTheme from './themes/00-default'
import type { ChartTokens } from './types'
import { productOption, trendOption, waterfallOption } from '../components/charts/options'

afterEach(() => vi.restoreAllMocks())

test('area opacity supports CSS color names and short hex tokens', () => {
  const chart: ChartTokens = { ...defaultTheme.chart, actual: 'black', areaOpacity: .2 }
  vi.spyOn(theme, 'getTheme').mockReturnValue({ id: '03', name: 'Test', chart })
  expect(trendOption([], 'revenue')).toMatchObject({ series: [{ areaStyle: { color: 'rgba(0,0,0,.2)' } }] })
  chart.actual = '#abc'
  expect(trendOption([], 'revenue')).toMatchObject({ series: [{ areaStyle: { color: 'rgba(170,187,204,.2)' } }] })
})

test('chart builders read the active tokens on every call', () => {
  const chart: ChartTokens = { ...defaultTheme.chart, fontFamily: 'monospace', axisColor: '#111111', labelColor: '#222222',
    gridColor: '#333333', showGrid: false, actual: '#444444', previous: '#555555', good: '#666666',
    bad: '#777777', total: '#888888', lineWidth: 4, smooth: false, areaOpacity: .2,
    barRadius: 0, barMaxWidth: 40, markerSize: 14, labelFontSize: 14, waterfallStyle: 'ibcs' as const }
  vi.spyOn(theme, 'getTheme').mockReturnValue({ id: '03', name: 'Test', chart })
  const rows = [{ month: '2026-08', revenue: 500, cost: 275, gross_margin_pct: 45, orders: 10, customers: 8 }]
  expect(trendOption(rows, 'revenue')).toMatchObject({
    textStyle: { fontFamily: 'monospace', fontSize: 15, color: '#111111' },
    xAxis: { axisLabel: { color: '#111111', fontSize: 14 } },
    yAxis: { splitLine: { show: false, lineStyle: { color: '#333333' } } },
    series: [{ smooth: false, lineStyle: { color: '#444444', width: 4 },
      areaStyle: { color: 'rgba(68,68,68,.2)' }, markPoint: { symbolSize: 14 } }],
  })
  chart.sparkStyle = 'line'
  expect(trendOption(rows, 'revenue', true)).toMatchObject({ series: [{ type: 'line', lineStyle: { width: 3 } }] })
  expect((trendOption(rows, 'revenue', true).series as Record<string, unknown>[])[0]).not.toHaveProperty('areaStyle')
  chart.sparkStyle = 'bar'
  expect(trendOption(rows, 'revenue', true, true)).toMatchObject({ series: [{ type: 'bar', barMaxWidth: 40,
    itemStyle: { color: '#444444', borderRadius: 0 }, markPoint: { symbolSize: 10, itemStyle: { color: '#777777' } } }] })
  expect(productOption([{ product: 'Test', revenue: 5, margin: 40, compareRevenue: 4, compareMargin: 50,
    revenueDeltaPct: 25, marginDeltaPp: -10, outlier: true }], 'margin', '2026-08', '2025-08')).toMatchObject({
    yAxis: { axisLabel: { color: '#222222', fontSize: 15 } },
    series: [{ barMaxWidth: 40, data: [{ itemStyle: { color: '#777777', borderRadius: [0, 0, 0, 0] } }] },
      { itemStyle: { color: '#555555' } }],
  })
  expect(waterfallOption([{ label: 'Före', kind: 'total', value: 50 },
    { label: 'Fall', kind: 'change', value: -5 }, { label: 'Upp', kind: 'change', value: 3 }])).toMatchObject({
    series: [{}, { barMaxWidth: 40, itemStyle: { color: '#888888', borderRadius: 0 } },
      { data: ['-', { itemStyle: { color: '#777777' } }, { itemStyle: { color: '#666666' } }] }],
  })
})
