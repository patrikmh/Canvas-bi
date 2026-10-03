import Papa from 'papaparse'
import { readSheet } from 'read-excel-file/universal'
import { parseCsvText } from '../../data/upload'

/** Spreadsheets often export unused trailing columns; they are not missing canonical fields. */
export function parseUploadCsv(text: string) {
  const parsed = Papa.parse<string[]>(text.replace(/^\ufeff/, ''), { skipEmptyLines: 'greedy' })
  if (parsed.errors.some(error => error.code !== 'UndetectableDelimiter')) return parseCsvText(text)
  const headers = [...(parsed.data[0] ?? [])]
  while (headers.length && !headers.at(-1)!.trim()) headers.pop()
  if (headers.length === (parsed.data[0]?.length ?? 0)) return parseCsvText(text)
  return parseCsvText(Papa.unparse([headers, ...parsed.data.slice(1).map(row => row.slice(0, headers.length))]))
}

export async function parseUploadXlsx(bytes: ArrayBuffer) {
  const sheet = await readSheet(bytes)
  return parseUploadCsv(Papa.unparse(sheet.map(row => row.map(cell => cell instanceof Date ? cell.toISOString().slice(0, 10) : cell == null ? '' : String(cell)))))
}
