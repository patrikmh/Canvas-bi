import { describe, expect, it } from 'vitest'
import { drawThrough, pointerSample, lineSegments, gapBands } from './drawing'

describe('weekly prediction drawing', () => {
  it('maps pointer coordinates to month columns and clamps percent without reading actual data', () => {
    expect(pointerSample(0, 100, 600, 200, 6)).toEqual({ index: 0, value: 50 })
    expect(pointerSample(700, -50, 600, 200, 6)).toEqual({ index: 5, value: 100 })
    expect(pointerSample(-10, 300, 600, 200, 6)).toEqual({ index: 0, value: 0 })
  })
  it('interpolates skipped columns in both drag directions and preserves untouched guesses', () => {
    expect(drawThrough([null, null, null, null], { index: 0, value: 40 }, { index: 3, value: 70 })).toEqual([40, 50, 60, 70])
    expect(drawThrough([10, null, null, null], { index: 3, value: 70 }, { index: 1, value: 50 })).toEqual([10, 50, 60, 70])
  })
  it('does not connect missing values or draw a gap band through unknown SQL margins', () => {
    expect(lineSegments([40, null, 50, 60])).toEqual([[{ index: 0, value: 40 }], [{ index: 2, value: 50 }, { index: 3, value: 60 }]])
    expect(gapBands([50, 50, 50], [40, null, 45])).toEqual([])
    expect(gapBands([50, 50], [40, 45])).toHaveLength(1)
  })
})
