import type { OrderLine } from './types'

export interface SqlEngine {
  query<T = Record<string, unknown>>(sql: string): Promise<T[]>
  loadOrderLines(rows: OrderLine[]): Promise<void>
  /** Registers a raw table named `name`; column mapping is a later step. */
  loadCsvText(name: string, text: string): Promise<void>
  close(): Promise<void>
}

/** Materialize Arrow structs and normalize BigInt recursively at the boundary. */
export function plainValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    const number = Number(value)
    if (!Number.isSafeInteger(number)) throw new Error('SQL-heltal överstiger säker precision')
    return number
  }
  if (value == null || typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (Array.isArray(value)) return value.map(plainValue)
  if ('toJSON' in value && typeof value.toJSON === 'function') return plainValue(value.toJSON())
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plainValue(item)]))
}
