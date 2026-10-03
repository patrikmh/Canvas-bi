import Papa from 'papaparse'
import { readSheet } from 'read-excel-file/universal'
import type { SqlEngine } from './engine'
import type { DatasetInfo, OrderLine, CanonicalField } from './types'
import { mappingColumns, parseDate, parseNumber, validateMapping } from './mapping'
import type { MappingInput } from './mapping'

export interface ParsedData { headers: string[]; rows: string[][] }
export interface UploadResult extends DatasetInfo { skippedRows: number; warnings: string[] }

function parsedTable(table: string[][]): ParsedData {
  const headers = (table[0] ?? []).map(cell => cell.trim())
  if (!headers.length || headers.some(header => !header)) throw new Error('Filen saknar kolumnnamn.')
  if (new Set(headers).size !== headers.length) throw new Error('Kolumnnamnen måste vara unika.')
  return { headers, rows: table.slice(1).filter(row => row.some(cell => cell.trim() !== '')) }
}

export function parseCsvText(text: string): ParsedData {
  const parsed = Papa.parse<string[]>(text.replace(/^\ufeff/, ''), { skipEmptyLines: 'greedy' })
  // Papa reports an undetectable delimiter for valid single-column files.
  const errors = parsed.errors.filter(error => error.code !== 'UndetectableDelimiter')
  if (errors.length) throw new Error(`CSV-filen kunde inte läsas: ${errors.map(error => error.message).join(' ')}`)
  return parsedTable(parsed.data)
}

/** First worksheet. The universal entry reads ArrayBuffers offline in both runtimes. */
export async function parseXlsx(arrayBuffer: ArrayBuffer): Promise<ParsedData> {
  const sheet = await readSheet(arrayBuffer)
  return parsedTable(sheet.map(row => row.map(cell => cell instanceof Date ? cell.toISOString().slice(0, 10) : cell == null ? '' : String(cell))))
}

export async function loadMappedData(
  engine: SqlEngine, parsed: ParsedData, mapping: MappingInput,
  opts: { assumedMarginPct?: number } = {},
): Promise<UploadResult> {
  const validation = validateMapping(mapping)
  if (!validation.ok) throw new Error(validation.problems.join(' '))
  const columns = mappingColumns(mapping)
  const indexes = new Map<CanonicalField, number>()
  for (const [field, header] of Object.entries(columns)) {
    const index = parsed.headers.indexOf(header!)
    if (index < 0) throw new Error(`Kolumnen ”${header}” finns inte i filen.`)
    indexes.set(field as CanonicalField, index)
  }
  const pct = opts.assumedMarginPct
  if (pct !== undefined && (!Number.isFinite(pct) || pct < 0 || pct > 100)) throw new Error('Marginalantagandet måste vara mellan 0 och 100 procent.')
  const assumption = !validation.hasCost && pct !== undefined ? { kind: 'margin' as const, pct } : undefined
  const rows: OrderLine[] = []
  let skippedRows = 0
  for (const row of parsed.rows) {
    const cell = (field: CanonicalField) => indexes.has(field) ? (row[indexes.get(field)!] ?? '').trim() : ''
    const numeric = (field: CanonicalField) => parseNumber(cell(field))
    const date = parseDate(cell('date'))
    const qty = columns.qty ? numeric('qty') : 1
    const price = columns.unit_price ? numeric('unit_price') : null
    const unitCost = columns.unit_cost ? numeric('unit_cost') : null
    const revenue = columns.revenue ? numeric('revenue') : qty !== null && price !== null ? qty * price : null
    const cost = columns.cost ? numeric('cost') : columns.unit_cost && qty !== null && unitCost !== null ? qty * unitCost : assumption && revenue !== null ? revenue * (1 - assumption.pct / 100) : null
    const invalidMappedNumber = (columns.unit_price && price === null) || (columns.unit_cost && unitCost === null)
    if (row.length !== parsed.headers.length || !date || qty === null || revenue === null || !Number.isFinite(revenue) ||
      (validation.hasCost && cost === null) || (cost !== null && !Number.isFinite(cost)) || invalidMappedNumber) {
      skippedRows++
      continue
    }
    rows.push({
      date, qty, revenue, cost,
      // Direct totals remain exact even for zero-quantity adjustment/return lines.
      unit_price: qty === 0 ? (price ?? 0) : revenue / qty,
      unit_cost: cost === null ? null : qty === 0 ? (unitCost ?? 0) : cost / qty,
      product: cell('product'), customer_id: cell('customer_id'), order_id: cell('order_id'),
      channel: cell('channel'), region: cell('region'),
    })
  }
  if (!rows.length) throw new Error('Filen innehåller inga giltiga försäljningsrader. Tidigare data behålls.')
  // engine.loadOrderLines owns the transaction shared by browser and Node adapters.
  await engine.loadOrderLines(rows)
  const warnings = [...validation.problems]
  if (skippedRows) warnings.push(`${skippedRows} ogiltiga rader hoppades över.`)
  if (assumption) warnings.push('Kostnaden bygger på ett uttryckligt marginalantagande.')
  return {
    source: 'upload', name: 'Uppladdad data', rowCount: rows.length,
    months: [...new Set(rows.map(row => row.date.slice(0, 7)))].sort(),
    hasCost: validation.hasCost || Boolean(assumption), mapping: columns,
    ...(assumption ? { assumption } : {}), skippedRows, warnings,
  }
}
