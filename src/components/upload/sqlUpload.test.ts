import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from '../../data/engine.node'
import type { SqlEngine } from '../../data/engine'
import { loadMappedUpload, partialUploadMonths } from '../../data/engine.upload'
import { detectMapping } from '../../data/mapping'
import { parseCsvText } from '../../data/upload'
import { kpiSnapshot } from '../../data/metrics'

let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine() })
afterAll(async () => { await engine.close() })
test('UI loader derives mapped revenue and cost in SQL and keeps the filename', async () => {
  const parsed = parseCsvText(readFileSync('e2e/fixtures/annan-butik.csv', 'utf8'))
  const info = await loadMappedUpload(engine, parsed, detectMapping(parsed.headers, parsed.rows), 'annan-butik.csv')
  expect(info.name).toBe('annan-butik.csv')
  expect(info.rowCount).toBe(300)
  const expected = JSON.parse(readFileSync('e2e/fixtures/expected.json', 'utf8'))['annan-butik.csv']
  expect((await kpiSnapshot(engine, expected.latestMonth)).data.revenue.current).toBeCloseTo(expected.revenue, 8)
})
test('missing unmapped trailing cells remain valid; absent IDs do not invent customers or orders', async () => {
  const parsed = { headers: ['date', 'amount', 'extra'], rows: [['2026-08-01 10:00:00', '1 234,50']] }
  const info = await loadMappedUpload(engine, parsed, { date: 'date', revenue: 'amount' }, 'short.csv')
  expect(info).toMatchObject({ hasCost: false, rowCount: 1 })
  const { data } = await kpiSnapshot(engine, '2026-08')
  expect(data.margin.current).toBeNull()
  expect(data.revenue.current).toBe(1234.5)
  expect(data.orders.current).toBe(0)
  expect(data.customers.current).toBe(0)
  expect(await partialUploadMonths(engine)).toEqual(['2026-08'])
  await loadMappedUpload(engine, parsed, { date: 'date', revenue: 'amount' }, 'short.csv', 50)
  expect((await kpiSnapshot(engine, '2026-08')).data.margin.current).toBeCloseTo(50, 8)
})
test('UI loader preserves current sales and original error when SQL fails and rollback fails', async () => {
  const before = await engine.query('SELECT * FROM sales')
  const checked = { ...engine, query: async <T,>(sql: string) => {
    if (sql.startsWith('CREATE OR REPLACE TABLE sales')) throw new Error('original failure')
    if (sql === 'ROLLBACK') { await engine.query(sql); throw new Error('rollback failure') }
    return engine.query<T>(sql)
  } }
  await expect(loadMappedUpload(checked, { headers: ['date', 'amount'], rows: [['2026-08-28', '100']] }, { date: 'date', revenue: 'amount' }, 'bad.csv')).rejects.toThrow('original failure')
  expect(await engine.query('SELECT * FROM sales')).toEqual(before)
})

test('numeric-looking product and customer identifiers retain leading zeroes', async () => {
  await loadMappedUpload(engine, { headers: ['date', 'amount', 'customer', 'order', 'sku'], rows: [['2026-08-28', '100', '001', '01', '0007'], ['2026-08-28', '200', '1', '1', '7']] },
    { date: 'date', revenue: 'amount', customer_id: 'customer', order_id: 'order', product: 'sku' }, 'ids.csv')
  expect(await engine.query('SELECT customer_id, order_id, product FROM sales ORDER BY revenue')).toEqual([
    { customer_id: '001', order_id: '01', product: '0007' }, { customer_id: '1', order_id: '1', product: '7' },
  ])
  expect((await kpiSnapshot(engine, '2026-08')).data.customers.current).toBe(2)
})
