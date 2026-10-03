import { expect, test } from 'vitest'
import { matchIntent } from './intents'

test.each([
  ['Utforska marginalen', 'margin'], ['explore margin', 'margin'], ['visa bruttomarginal', 'margin'],
  ['Varför ändrades marginalen?', 'explain'], ['varfor andrades marginalen', 'explain'], ['why did margin drop', 'explain'], ['förklara marginalfallet', 'explain'],
  ['Jämför omsättningen med förra året', 'revenue'], ['compare revenue', 'revenue'], ['visa försäljning', 'revenue'],
  ['Visa marginal per produkt', 'marginProducts'], ['margin by product', 'marginProducts'],
  ['visa omsättning per produkt', 'revenueProducts'], ['revenue by product', 'revenueProducts'],
  ['Bevaka marginalen', 'watch'], ['watch margin', 'watch'], ['larma om marginalen', 'watch'],
  ['Bygg en ledningsvy', 'rebuild'], ['build dashboard', 'rebuild'],
  ['lägg till en tabell', 'add'], ['add a table', 'add'], ['ta bort trend', 'remove'],
  ['vad är marginalen i juli', 'monthMargin'], ['hur räknas omsättning', 'formula'], ['how is it calculated', 'formula'],
  ['hej vad är vädret', 'unknown'],
])('%s → %s', (text, kind) => expect(matchIntent(text).kind).toBe(kind))
test('card kinds, month and selected context are retained', () => {
  expect(matchIntent('lägg till en tabell')).toMatchObject({ card: 'table' })
  expect(matchIntent('vad är marginalen i juli')).toMatchObject({ month: 7 })
  expect(matchIntent('varför?', 'margin')).toMatchObject({ kind: 'explain' })
  expect(matchIntent('visa per produkt', 'revenue')).toMatchObject({ kind: 'revenueProducts' })
})
test('explicit metrics override selection; abbreviated questions use selected card', () => {
  expect(matchIntent('Varför ändrades marginalen?', 'revenue')).toMatchObject({ kind: 'explain', metric: 'margin' })
  expect(matchIntent('varför?', 'revenue')).toMatchObject({ kind: 'explain', metric: 'revenue' })
  expect(matchIntent('jämför med förra året', 'revenue')).toMatchObject({ kind: 'revenue', metric: 'revenue' })
})
