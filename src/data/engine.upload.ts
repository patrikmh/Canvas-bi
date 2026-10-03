import type { SqlEngine } from './engine'
import type { CanonicalField } from './types'
import { mappingColumns, parseDate, parseNumber, validateMapping } from './mapping'
import type { MappingInput } from './mapping'
import type { ParsedData, UploadResult } from './upload'
import { identifier, literal } from './sql'

/** UI import adapter: parse cells, then derive all totals and replace sales atomically in SQL. */
export async function loadMappedUpload(engine: SqlEngine, parsed: ParsedData, mapping: MappingInput, name: string, assumedMarginPct?: number): Promise<UploadResult> {
  const validation = validateMapping(mapping)
  if (!validation.ok) throw new Error(validation.problems.join(' '))
  if (assumedMarginPct !== undefined && (!Number.isFinite(assumedMarginPct) || assumedMarginPct < 0 || assumedMarginPct > 100)) throw new Error('Marginalantagandet måste vara mellan 0 och 100 procent.')
  const columns = mappingColumns(mapping)
  const fields = Object.keys(columns) as CanonicalField[]
  const numeric = new Set<CanonicalField>(['qty', 'unit_price', 'unit_cost', 'revenue', 'cost'])
  const indexes = fields.map(field => parsed.headers.indexOf(columns[field]!))
  if (indexes.some(index => index < 0)) throw new Error('En mappad kolumn saknas i filen.')
  const required = new Set<CanonicalField>(['date'])
  if (columns.revenue) required.add('revenue')
  else { required.add('unit_price'); if (columns.qty) required.add('qty') }
  let skippedRows = 0
  const normalized = parsed.rows.flatMap(row => {
    const values = fields.map((field, i) => {
      const value = row[indexes[i]]?.trim() ?? ''
      return field === 'date' ? parseDate(value) : numeric.has(field) ? parseNumber(value) : value || null
    })
    if (fields.some((field, index) => required.has(field) && values[index] === null)) { skippedRows++; return [] }
    return [values]
  })
  if (!normalized.length) throw new Error('Filen innehåller inga giltiga försäljningsrader. Tidigare data behålls.')
  const assumption = !validation.hasCost && assumedMarginPct !== undefined ? { kind: 'margin' as const, pct: assumedMarginPct } : undefined
  const cell = (field: CanonicalField, fallback = 'NULL') => columns[field] ? `${identifier(field)}` : fallback
  const qty = `CAST(${cell('qty', '1')} AS DOUBLE)`
  const revenue = columns.revenue ? `CAST(${cell('revenue')} AS DOUBLE)` : `${qty} * CAST(${cell('unit_price')} AS DOUBLE)`
  const cost = columns.cost ? `CAST(${cell('cost')} AS DOUBLE)` : columns.unit_cost ? `${qty} * CAST(${cell('unit_cost')} AS DOUBLE)` : assumption ? `(${revenue}) * (1 - ${assumption.pct} / 100.0)` : 'NULL::DOUBLE'
  const text = (field: CanonicalField) => `NULLIF(CAST(${cell(field, "''")} AS VARCHAR), '')`
  const raw = `upload_${crypto.randomUUID().replaceAll('-', '')}`
  const csvCell = (value: string | number | null) => value === null ? '' : `"${String(value).replaceAll('"', '""')}"`
  const csv = [fields, ...normalized].map(row => row.map(csvCell).join(',')).join('\n') + '\n'
  await engine.query('BEGIN TRANSACTION')
  try {
    await engine.loadCsvText(raw, csv)
    await engine.query(`CREATE OR REPLACE TABLE sales AS SELECT
      CAST(${cell('date')} AS DATE) AS date, ${text('order_id')} AS order_id, ${text('customer_id')} AS customer_id,
      COALESCE(${text('product')}, 'Produkt saknas') AS product, ${qty} AS qty,
      CASE WHEN ${qty} = 0 THEN CAST(${cell('unit_price', '0')} AS DOUBLE) ELSE (${revenue}) / ${qty} END AS unit_price,
      CASE WHEN ${qty} = 0 THEN CAST(${cell('unit_cost', '0')} AS DOUBLE) ELSE (${cost}) / ${qty} END AS unit_cost,
      ${text('channel')} AS channel, ${text('region')} AS region, ${revenue} AS revenue, ${cost} AS cost
      FROM ${identifier(raw)}`)
    await engine.query(`DROP TABLE ${identifier(raw)}`)
    const months = await engine.query<{ month: string }>("SELECT DISTINCT strftime(date, '%Y-%m') AS month FROM sales ORDER BY month")
    await engine.query('COMMIT')
    return { source: 'upload', name, rowCount: normalized.length, months: months.map(row => row.month), hasCost: validation.hasCost || Boolean(assumption), mapping: columns,
      ...(assumption ? { assumption } : {}), skippedRows, warnings: [...validation.problems, ...(skippedRows ? [`${skippedRows} ogiltiga rader hoppades över.`] : []), ...(assumption ? ['Kostnaden bygger på ett uttryckligt marginalantagande.'] : [])] }
  } catch (error) {
    try { await engine.query('ROLLBACK') } catch { /* Preserve the original import failure. */ }
    throw error
  }
}

/** Completeness for every selectable period, including a newest partial month. */
export async function partialUploadMonths(engine: SqlEngine): Promise<string[]> {
  const sql = `WITH months AS (SELECT date_trunc('month', date) AS month, MAX(date) AS last_date FROM sales GROUP BY month)
    SELECT strftime(month, '%Y-%m') AS month FROM months
    WHERE month = (SELECT MAX(month) FROM months) AND last_date < last_day(month) - INTERVAL '3 days'`
  return (await engine.query<{ month: string }>(sql)).map(row => row.month)
}

export function assumptionFormula(pct: number) { return `ANTAGANDE: kostnad = omsättning × (1 − ${literal(String(pct))}::DOUBLE / 100). Marginalen är antagen, inte uppmätt.` }
