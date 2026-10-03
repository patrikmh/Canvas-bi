import { expect, test } from 'vitest'
import { waterfallOption, red, teal } from './options'

test('waterfall uses red losses, green gains and teal totals', () => {
  const option = waterfallOption([
    { label: 'Före', kind: 'total', value: 50 },
    { label: 'Förlust', kind: 'change', value: -5 },
    { label: 'Vinst', kind: 'change', value: 3 },
    { label: 'Nu', kind: 'total', value: 48 },
  ])
  const series = option.series as { data: unknown[]; itemStyle: { color: string } }[]
  expect(series[2].data[1]).toMatchObject({ value: 5, itemStyle: { color: red } })
  expect(series[2].data[2]).toMatchObject({ value: 3, itemStyle: { color: '#2f7d4f' } })
  expect(series[1].itemStyle.color).toBe(teal)
})
