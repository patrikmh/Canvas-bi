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
}
