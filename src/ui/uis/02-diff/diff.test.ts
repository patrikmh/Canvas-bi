import { expect, test } from 'vitest'
import { previousPeriod, canMerge } from './diff'

test('previous version uses the last available closed baseline, never a future month', () => {
  expect(previousPeriod(['2026-04', '2026-06'], ['2026-04', '2026-06', '2026-08'], '2026-08')).toBe('2026-06')
  expect(previousPeriod([], ['2026-04', '2026-06', '2026-08'], '2026-08')).toBe('2026-06')
  expect(previousPeriod([], ['2026-08'], '2026-08')).toBeNull()
})
test('merge requires every original claim accepted, watch approval, and a named reviewer', () => {
  expect(canMerge(['accepted', 'accepted'], 'Aktiv', 'Patrik')).toBe(true)
  for (const status of ['pending', 'edited', 'rejected']) expect(canMerge(['accepted', status], 'Aktiv', 'Patrik')).toBe(false)
  expect(canMerge([], 'Aktiv', 'Patrik')).toBe(false)
  expect(canMerge(['accepted'], 'Föreslagen', 'Patrik')).toBe(false)
  expect(canMerge(['accepted'], 'Aktiv', ' ')).toBe(false)
})
