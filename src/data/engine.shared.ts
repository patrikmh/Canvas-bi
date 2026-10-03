import type { SqlEngine } from './engine'
import type { OrderLine } from './types'
import { createSalesSql, importSalesSql, rawCsvSql } from './sql'

const fields: (keyof OrderLine)[] = ['date', 'order_id', 'customer_id', 'product', 'qty', 'unit_price', 'unit_cost', 'channel', 'region', 'revenue', 'cost']
const csvCell = (value: string | number | null | undefined) => value == null ? '' : `"${String(value).replace(/"/g, '""')}"`

/** File imports share one implementation so browser and unit SQL see identical data. */
export function engineLoaders(
  query: SqlEngine['query'],
  register: (name: string, text: string) => Promise<void>,
  drop: (name: string) => Promise<void>,
): Pick<SqlEngine, 'loadOrderLines' | 'loadCsvText'> {
  let sequence = 0
  async function withFile(text: string, sql: (file: string) => string) {
    const file = `canvas-import-${sequence++}.csv`
    await register(file, text)
    try { await query(sql(file)) } finally { await drop(file) }
  }
  return {
    async loadOrderLines(rows) {
      await query('BEGIN TRANSACTION')
      try {
        await query(createSalesSql)
        if (rows.length) {
          const csv = `${fields.join(',')}\n${rows.map(row => fields.map(field => csvCell(row[field])).join(',')).join('\n')}\n`
          await withFile(csv, importSalesSql)
        }
        await query('COMMIT')
      } catch (error) {
        await query('ROLLBACK')
        throw error
      }
    },
    async loadCsvText(name, text) {
      if (name.toLowerCase() === 'sales') throw new Error('sales är reserverad för normaliserade data')
      await withFile(text, file => rawCsvSql(name, file))
    },
  }
}
