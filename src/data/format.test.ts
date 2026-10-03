import { expect, test } from 'vitest'
import { fmtTkr, fmtPct, fmtDeltaPct, fmtPp, fmtInt, fmtMonth, fmtMonthShort } from './format'

test('Swedish formatters use NBSP, decimal commas and mathematical minus', () => {
  expect(fmtTkr(503_123)).toBe('503\u00a0tkr')
  expect(fmtTkr(10_000_000)).toBe('10,0\u00a0mkr')
  expect(fmtTkr(-503_123)).toBe('−503\u00a0tkr')
  expect(fmtPct(44.7)).toBe('44,7\u00a0%')
  expect(fmtDeltaPct(9.7)).toBe('+9,7\u00a0%')
  expect(fmtDeltaPct(-11.9)).toBe('−11,9\u00a0%')
  expect(fmtPp(-6.5)).toBe('−6,5\u00a0p.e.')
  expect(fmtInt(1234)).toBe('1\u00a0234')
  expect(fmtMonth('2026-08')).toBe('augusti 2026')
  expect(fmtMonthShort('2026-08')).toBe('aug')
  expect(fmtPct(null)).toBe('—')
})
