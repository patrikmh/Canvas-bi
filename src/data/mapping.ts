import type { CanonicalField, ColumnMapping } from './types'

export interface MappingDetection { column: string | null; confidence: number; reason: string }
export type DetectedMapping = Record<CanonicalField, MappingDetection>
export type MappingInput = ColumnMapping | DetectedMapping

const synonyms: Record<CanonicalField, string[]> = {
  date: ['datum', 'date', 'orderdatum'],
  revenue: ['belopp', 'omsättning', 'revenue', 'sales', 'amount', 'försäljning'],
  cost: ['kostnad', 'cost', 'cogs', 'varukostnad'],
  unit_cost: ['inköpspris', 'unit_cost', 'styckkostnad'],
  unit_price: ['pris', 'styckpris', 'unit_price', 'price'],
  qty: ['antal', 'qty', 'quantity'],
  product: ['produkt', 'artikel', 'product', 'sku', 'vara'],
  customer_id: ['kund', 'kundnr', 'customer', 'customer_id'],
  order_id: ['order', 'ordernr', 'order_id', 'ordernummer'],
  channel: ['kanal', 'channel'],
  region: ['region', 'ort', 'stad'],
}
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[\s_-]/g, '')

/** Strict finite money/quantity parser; comma-only is a decimal comma. */
export function parseNumber(input: string): number | null {
  let text = input.trim().replace(/\s*kr$/i, '').trim().replace(/^−/, '-')
  if (!text) return null
  // Spaces may separate complete thousands groups, never arbitrary digits.
  if (/\s/u.test(text)) {
    if (!/^[+-]?\d{1,3}(?:[\s\u00a0\u202f]\d{3})+(?:[.,]\d+)?$/u.test(text)) return null
    text = text.replace(/[\s\u00a0\u202f]/gu, '')
  }
  if (text.includes(',') && text.includes('.')) {
    const decimal = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    const [integer, fraction, ...extra] = text.split(decimal)
    const groupPattern = thousands === ',' ? /^[+-]?\d{1,3}(?:,\d{3})+$/ : /^[+-]?\d{1,3}(?:\.\d{3})+$/
    if (extra.length || !groupPattern.test(integer) || !/^\d+$/.test(fraction)) return null
    text = integer.split(thousands).join('') + '.' + fraction
  } else {
    text = text.replace(',', '.')
  }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null
  const result = Number(text)
  return Number.isFinite(result) ? result : null
}

/** Calendar dates, deliberately day-first for slash/dot input. No Date.parse guessing. */
export function parseDate(input: string): string | null {
  const text = input.trim()
  let year: number, month: number, day: number
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/.exec(text)
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text)
  const dayFirst = /^(\d{1,2})([/.])(\d{1,2})\2(\d{4})$/.exec(text)
  if (iso || compact) [, year, month, day] = (iso ?? compact)!.slice(0, 4).map(Number)
  else if (dayFirst) { year = Number(dayFirst[4]); month = Number(dayFirst[3]); day = Number(dayFirst[1]) }
  else return null
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

/** Unambiguous synonyms win. Unnamed date/numeric columns get lower-confidence suggestions. */
export function detectMapping(headers: string[], sampleRows: string[][] = []): DetectedMapping {
  const result = {} as DetectedMapping
  const used = new Set<string>()
  for (const field of Object.keys(synonyms) as CanonicalField[]) {
    const matches = headers.filter(header => synonyms[field].some(word => normalize(word) === normalize(header)))
    const column = matches.length === 1 ? matches[0] : null
    result[field] = { column, confidence: column ? .98 : 0, reason: column ? 'Kolumnnamnet matchar ett känt fält.' : matches.length > 1 ? 'Flera kolumner matchar; välj kolumn manuellt.' : 'Ingen säker matchning hittades.' }
    if (column) used.add(column)
  }
  function sniff(field: 'date' | 'revenue', parser: (value: string) => unknown) {
    if (result[field].column) return
    const candidates = headers.filter((header, index) => {
      if (used.has(header)) return false
      // Do not reassign an ambiguous known synonym to an unrelated field.
      if (Object.values(synonyms).flat().some(word => normalize(word) === normalize(header))) return false
      const values = sampleRows.map(row => row[index]?.trim() ?? '').filter(Boolean)
      return values.length > 0 && values.filter(value => parser(value) !== null).length / values.length >= .9
    })
    if (candidates.length === 1) {
      result[field] = { column: candidates[0], confidence: .65, reason: field === 'date' ? 'Värdena ser ut som datum; kontrollera förslaget.' : 'En omappad kolumn innehåller tal; kontrollera att den är omsättning.' }
      used.add(candidates[0])
    }
  }
  sniff('date', parseDate)
  if (!result.unit_price.column) sniff('revenue', parseNumber)
  return result
}

/** Accepts detection output directly, or a manually edited field → header map. */
export function mappingColumns(mapping: MappingInput): ColumnMapping {
  const result: ColumnMapping = {}
  for (const field of Object.keys(synonyms) as CanonicalField[]) {
    const value = mapping[field]
    const column = typeof value === 'string' ? value : value?.column
    if (column) result[field] = column
  }
  return result
}

export function validateMapping(mapping: MappingInput) {
  const columns = mappingColumns(mapping)
  const canComputeRevenue = Boolean(columns.revenue || columns.unit_price)
  const hasCost = Boolean(columns.cost || columns.unit_cost)
  const missing: CanonicalField[] = []
  const problems: string[] = []
  if (!columns.date) { missing.push('date'); problems.push('Välj en kolumn för datum.') }
  if (!canComputeRevenue) { missing.push('revenue'); problems.push('Välj omsättning eller styckpris för att beräkna omsättning.') }
  const duplicates = Object.values(columns).length !== new Set(Object.values(columns)).size
  if (duplicates) problems.push('Samma kolumn får inte användas för flera fält.')
  if (!hasCost) problems.push('Ingen kostnad är mappad. Bruttomarginal kräver kostnad eller ett uttryckligt marginalantagande.')
  return { ok: missing.length === 0 && !duplicates, missing, canComputeRevenue, hasCost, problems }
}
