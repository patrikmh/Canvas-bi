import { expect, test } from 'vitest'
import { productOption, trendOption, waterfallOption } from '../components/charts/options'

// Capture the pre-theme builders, including formatter functions and per-chart sizes.
test('default chart options retain the original literals', () => {
  const rows = [{ month: '2026-08', revenue: 500, cost: 275, gross_margin_pct: 45, orders: 10, customers: 8 }]
  expect(trendOption(rows, 'revenue')).toMatchSnapshot('trend')
  expect(trendOption(rows, 'margin', true, true)).toMatchSnapshot('sparkline')
  expect(productOption([], 'revenue', '2026-08', '2025-08')).toMatchSnapshot('products')
  expect(waterfallOption([
    { label: 'Före', kind: 'total', value: 50 },
    { label: 'Fall', kind: 'change', value: -5 },
    { label: 'Upp', kind: 'change', value: 3 },
    { label: 'Nu', kind: 'total', value: 48 },
  ])).toMatchSnapshot('waterfall')
})
