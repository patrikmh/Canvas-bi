import { describe, expect, it } from 'vitest'
import { parseQuestion, visibleMonths, sourceSql } from './query'

describe('editable search sentence', () => {
  it('uses offline intents and preserves explicit metric, grouping and period', () => {
    expect(parseQuestion('Bruttomarginal per produkt senaste 3 månaderna mot samma period i fjol')).toMatchObject({ metric: 'margin', group: 'products', period: 3, compare: 'year' })
    expect(parseQuestion('Visa omsättning senaste 6 månaderna')).toMatchObject({ metric: 'revenue', group: 'total', period: 6 })
    expect(parseQuestion('Vad är marginalen i juli?')).toMatchObject({ metric: 'margin', monthNumber: 7, period: 1 })
  })
  it('honestly rejects unsupported questions and periods rather than silently ignoring them', () => {
    for (const text of ['Hur blir vädret?', 'Varför är himlen blå?', 'Omsättning per region', 'Marginal nästa år', 'Visa marginal senaste 8 månaderna', 'Marginal senaste 3 veckorna', 'Marginal exklusive B2B', 'Marginal 2024', 'Ordrar per produkt']) expect(parseQuestion(text)).toBeNull()
  })
  it('bounds the window at the selected month, never using future data', () => {
    const months = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04']
    expect(visibleMonths(months, '2026-03', 3)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(visibleMonths(months, '2025-12', 3)).toEqual(['2025-12'])
  })
  it('rejects an unknown question even when it contains a recognized metric word', () => {
    expect(parseQuestion('Hur mycket moms på omsättningen?')).toBeNull()
    expect(parseQuestion('Visa marginal färskpotatis')).toBeNull()
  })
  it('citation SQL selects exactly displayed months and corresponding prior-year rows', () => {
    expect(sourceSql('SELECT * FROM sales', ['2026-07', '2026-08'], 'year')).toContain("month IN ('2026-07', '2026-08', '2025-07', '2025-08')")
    expect(sourceSql('SELECT * FROM sales', ['2026-08'], 'none')).not.toContain('2025-08')
  })
})
