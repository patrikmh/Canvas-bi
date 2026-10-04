import { afterEach, expect, test, vi } from 'vitest'
import * as theme from '../../theme'
import defaultTheme from '../../theme/themes/00-default'
import { bulletScale, indexedSparkline } from './kpi'
import { productOption, trendOption, waterfallOption, messageTitle } from './options'
import { annotateFindings } from './findings'
import { memoResult } from '../assistant/__fixtures__/agent'

afterEach(() => vi.restoreAllMocks())
const rows = [{ month: '2026-07', revenue: 470123, cost: 250000, gross_margin_pct: 43.2, orders: 800, customers: 610 }]
test('bullet scale starts at zero and positions the previous-year marker linearly', () => {
  expect(bulletScale(80, 100)).toEqual({ min: 0, max: 125, current: 64, previous: 80 })
  expect(bulletScale(null, null)).toEqual({ min: 0, max: 1, current: null, previous: null })
  expect(bulletScale(0, 0).current).toBe(0)
  expect(bulletScale(100, null).previous).toBeNull()
  expect(indexedSparkline([50, 100, null, 75])).toEqual([100, 200, null, 150])
  expect(indexedSparkline([0, null])).toEqual([null, null])
})
test('message titles format the supplied query results and never use demo literals', () => {
  expect(messageTitle('margin', rows)).toBe('Bruttomarginalen är 43,2 % i juli 2026.')
  expect(messageTitle('revenue', rows)).toContain('470 tkr')
  expect(messageTitle('margin', [])).toBe('Bruttomarginal saknar underlag för perioden.')
  vi.spyOn(theme, 'getTheme').mockReturnValue({ ...defaultTheme, chart: { ...defaultTheme.chart, titleMode: 'message' } })
  expect(productOption([{ product: 'Testprodukt', revenue: 150, compareRevenue: 100, margin: 43.2, compareMargin: 52.3, marginDeltaPp: -9.1, revenueDeltaPct: 50 }], 'revenue', '2026-07', '2025-07'))
    .toMatchObject({ title: { text: 'Omsättningen för Testprodukt ändrades +50,0 % mot i fjol.' } })
})
test('human chart flags enable zero axes, computed message titles and numbered findings', () => {
  vi.spyOn(theme, 'getTheme').mockReturnValue({ ...defaultTheme, analyst: 'memo', chart: { ...defaultTheme.chart, zeroBased: true, findingMarkers: true, titleMode: 'message' } })
  expect(trendOption(rows, 'margin')).toMatchObject({ yAxis: { min: 0, scale: false }, title: { text: messageTitle('margin', rows) } })
  expect(productOption([], 'margin', '2026-08', '2025-08')).toMatchObject({ xAxis: { min: 0 } })
  const waterfall = waterfallOption([{ label: 'Före', value: 52.3, kind: 'total' }, { label: 'Ullfilt', value: -4, kind: 'change' }, { label: 'Nu', value: 48.3, kind: 'total' }])
  expect(waterfall).toMatchObject({ yAxis: { min: 0 }, title: { text: 'Bruttomarginalen ändrades från 52,3 % till 48,3 %.' } })
  expect(annotateFindings(waterfall, { result: memoResult, changeStart: '2026-07' })).toMatchObject({ series: [{}, { markPoint: { data: expect.arrayContaining([expect.objectContaining({ name: '③④', coord: ['Ullfilt', 52.3] })]) } }, {}] })
  expect(annotateFindings(trendOption(rows, 'margin'), { result: memoResult, changeStart: '2026-07' })).toMatchObject({ series: [{ markPoint: { label: { show: true }, data: expect.arrayContaining([expect.objectContaining({ name: '②', coord: ['2026-07', 43.2] })]) } }] })
})
