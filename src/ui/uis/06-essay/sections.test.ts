import { describe, expect, it } from 'vitest'
import { activeSection, samePeriods } from './sections'

describe('essay figure selection', () => {
  it('changes at the reading line and keeps the last reached section', () => {
    expect(activeSection([{ id: 'trend', top: -400 }, { id: 'break', top: -20 }, { id: 'waterfall', top: 200 }], 160)).toBe('break')
    expect(activeSection([{ id: 'trend', top: -500 }, { id: 'waterfall', top: 120 }], 160)).toBe('waterfall')
    expect(activeSection([{ id: 'trend', top: 300 }], 160)).toBe('trend')
  })
  it('does not label static economics as analyst-period data when periods differ', () => {
    expect(samePeriods(['2026-04', '2026-05'], ['2026-06'], ['2026-04', '2026-05'], ['2026-06'])).toBe(true)
    expect(samePeriods(['2026-04'], ['2026-06'], ['2026-05'], ['2026-06'])).toBe(false)
    expect(samePeriods([], [], [], [])).toBe(false)
  })
})
