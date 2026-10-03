import type { OrderLine } from './types'

export interface SqlEngine {
  query<T = Record<string, unknown>>(sql: string): Promise<T[]>
  loadOrderLines(rows: OrderLine[]): Promise<void>
  /** Registers a raw table named `name`; column mapping is a later step. */
  loadCsvText(name: string, text: string): Promise<void>
  close(): Promise<void>
}

interface ArrowType {
  scale?: number
  children?: { name: string; type: ArrowType }[]
}

/** Arrow decimals store a signed, little-endian integer; the scale lives in the schema. */
export function plainValue(value: unknown, type?: ArrowType): unknown {
  if (value instanceof Uint32Array && type?.scale !== undefined) {
    let integer = 0n
    for (let index = value.length - 1; index >= 0; index--) integer = (integer << 32n) | BigInt(value[index])
    if (value[value.length - 1] & 0x80000000) integer -= 1n << BigInt(32 * value.length)
    return Number(integer) / 10 ** type.scale
  }
  if (typeof value === 'bigint') {
    const number = Number(value)
    if (!Number.isSafeInteger(number)) throw new Error('SQL-heltal överstiger säker precision')
    return number
  }
  if (value == null || typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(item => plainValue(item, type?.children?.[0]?.type))
  if ('toJSON' in value && typeof value.toJSON === 'function') return plainValue(value.toJSON(), type)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plainValue(item, type?.children?.find(field => field.name === key)?.type)]))
}
