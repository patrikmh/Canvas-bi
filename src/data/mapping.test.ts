import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { detectMapping, parseDate, parseNumber, validateMapping } from './mapping'
import { parseCsvText } from './upload'

const fixture = (name: string) => parseCsvText(readFileSync(`e2e/fixtures/${name}.csv`, 'utf8'))

test.each([
  ['annan-butik', { date: 'Orderdatum', product: 'Artikel', qty: 'Antal', unit_price: 'Styckpris', unit_cost: 'Inköpspris', customer_id: 'Kundnr', order_id: 'Ordernr' }],
  ['utan-kostnad', { date: 'date', product: 'product', revenue: 'amount', customer_id: 'customer', order_id: 'order' }],
  ['fa-rader', { date: 'datum', product: 'produkt', revenue: 'belopp', cost: 'kostnad', customer_id: 'kund', order_id: 'ordernummer' }],
])('detectMapping identifies %s fixture columns with confidence', (name, expected) => {
  const parsed = fixture(name as string)
  const mapping = detectMapping(parsed.headers, parsed.rows.slice(0, 20))
  for (const [field, column] of Object.entries(expected)) {
    expect(mapping[field as keyof typeof mapping].column).toBe(column)
    expect(mapping[field as keyof typeof mapping].confidence).toBeGreaterThanOrEqual(.9)
    expect(mapping[field as keyof typeof mapping].reason).toBeTruthy()
  }
  expect(validateMapping(mapping).ok).toBe(true)
})

test('header matching ignores accents and case; type sniffing is cautious', () => {
  const mapping = detectMapping(['DÁTUM', 'OMSÄTTNING', 'COGS', 'SKU', 'CHANNEL', 'STAD'], [['2026-08-01', '1 234,50', '600', 'a', 'Webb', 'Malmö']])
  expect(mapping.date.column).toBe('DÁTUM')
  expect(mapping.revenue.column).toBe('OMSÄTTNING')
  expect(mapping.cost.column).toBe('COGS')
  expect(mapping.product.column).toBe('SKU')
  expect(mapping.channel.column).toBe('CHANNEL')
  expect(mapping.region.column).toBe('STAD')
  const guessed = detectMapping(['x', 'y'], [['01/08/2026', '23,5'], ['02/08/2026', '47']])
  expect(guessed.date.column).toBe('x')
  expect(guessed.revenue.column).toBe('y')
  expect(guessed.revenue.confidence).toBeLessThan(.9)
  const ambiguous = detectMapping(['x', 'y'], [['5', '6'], ['7', '8']])
  expect(ambiguous.revenue.column).toBeNull()
  expect(ambiguous.cost.column).toBeNull()
})

test.each([
  ['1 234,50', 1234.5], ['1\u00a0234,50 kr', 1234.5], ['1\u202f234,50', 1234.5], ['1,234.50', 1234.5],
  ['1.234,50', 1234.5], ['-12,5', -12.5], ['−12,5 KR', -12.5], ['0', 0], ['12.34', 12.34],
  ['', null], ['abc', null], ['12oops', null], ['1,2,3', null], ['Infinity', null], ['1 23,50', null],
])('parseNumber %j -> %j', (input, expected) => { expect(parseNumber(input)).toBe(expected) })

test.each([
  ['2026-08-01', '2026-08-01'], ['2026-08-01T10:00', '2026-08-01'], ['01/08/2026', '2026-08-01'],
  ['2026-08-01 10:00:00', '2026-08-01'],
  ['1.8.2026', '2026-08-01'], ['20260801', '2026-08-01'], ['29/02/2024', '2024-02-29'],
  ['2026-02-29', null], ['31/04/2026', null], ['20261301', null], ['', null], ['01/13/2026', null],
  ['2026-08-01garbage', null], ['2026-08-01T99:99', null],
])('parseDate %j -> %j', (input, expected) => { expect(parseDate(input)).toBe(expected) })

test('validateMapping detects missing requirements, optional cost and duplicate mappings', () => {
  const parsed = fixture('utan-kostnad')
  const result = validateMapping(detectMapping(parsed.headers, parsed.rows))
  expect(result).toMatchObject({ ok: true, hasCost: false, canComputeRevenue: true, missing: [] })
  expect(result.problems.join(' ')).toContain('kostnad')
  expect(validateMapping({ date: 'date', unit_price: 'price' })).toMatchObject({ ok: true, canComputeRevenue: true })
  expect(validateMapping({ date: 'date', qty: 'qty' })).toMatchObject({ ok: false, missing: ['revenue'] })
  expect(validateMapping({})).toMatchObject({ ok: false, missing: ['date', 'revenue'] })
  expect(validateMapping({ date: 'same', revenue: 'same' }).ok).toBe(false)
})

test('contains-synonym headers give lower confidence without reusing unit price as revenue', () => {
  const result = detectMapping(['Orderdatum export', 'Artikel namn', 'Antal sålda', 'Styckpris SEK', 'Inköpspris SEK'], [['2026-08-01', 'A', '2', '100', '50']])
  expect(result.date.column).toBe('Orderdatum export')
  expect(result.product.column).toBe('Artikel namn')
  expect(result.qty.column).toBe('Antal sålda')
  expect(result.unit_price.column).toBe('Styckpris SEK')
  expect(result.unit_cost.column).toBe('Inköpspris SEK')
  expect(result.revenue.column).toBeNull()
  expect(result.date.confidence).toBeLessThan(.9)
})
