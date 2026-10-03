export interface OrderLine {
  /** ISO calendar date, YYYY-MM-DD. */
  date: string
  order_id: string
  customer_id: string
  product: string
  qty: number
  unit_price: number
  unit_cost: number | null
  channel: string
  region: string
  /** Optional direct totals on uploads; take precedence over quantity × unit values. */
  revenue?: number
  cost?: number | null
}

export type CanonicalField = keyof OrderLine | 'revenue' | 'cost'
/** Uploads may map direct revenue/cost instead of quantity × unit price/cost. */
export type ColumnMapping = Partial<Record<CanonicalField, string>>

export interface DatasetInfo {
  source: 'demo' | 'upload'
  name: string
  rowCount: number
  months: string[]
  hasCost: boolean
  mapping: ColumnMapping
  /** Explicit user assumption, in percentage points (35 means 35%). */
  assumption?: { kind: 'margin'; pct: number }
}
