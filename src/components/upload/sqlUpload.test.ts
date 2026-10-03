import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from '../../data/engine.node'
import type { SqlEngine } from '../../data/engine'
import { loadMappedUpload, partialUploadMonths } from '../../data/engine.upload'
import { detectMapping } from '../../data/mapping'
import { parseCsvText } from '../../data/upload'
import { kpiSnapshot } from '../../data/metrics'
import { runAgent } from '../../analysis/agent'

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

test('blank optional mapped cells preserve every valid revenue row and leave partial cost unknown', async () => {
  const parsed = parseCsvText('date,amount,cost,unit_cost,qty,channel,region,customer,order\n2026-08-01,100,60,30,2,Webb,SE,C1,O1\n2026-08-02,200,,,,,,,\n2026-08-03,300\ninvalid,400,100\n2026-08-04,invalid,100\n')
  const info = await loadMappedUpload(engine, parsed, detectMapping(parsed.headers, parsed.rows), 'partial-cost.csv')
  expect(info).toMatchObject({ rowCount: 3, skippedRows: 2 })
  expect(await engine.query('SELECT revenue, cost, unit_cost, qty, channel, region, customer_id, order_id FROM sales ORDER BY revenue')).toEqual([
    { revenue: 100, cost: 60, unit_cost: 30, qty: 2, channel: 'Webb', region: 'SE', customer_id: 'C1', order_id: 'O1' },
    { revenue: 200, cost: null, unit_cost: null, qty: null, channel: null, region: null, customer_id: null, order_id: null },
    { revenue: 300, cost: null, unit_cost: null, qty: null, channel: null, region: null, customer_id: null, order_id: null },
  ])
  const { data } = await kpiSnapshot(engine, '2026-08')
  expect(data.revenue.current).toBe(600)
  expect(data.margin.current).toBeNull()
  const analysis = await runAgent(engine, '2026-08', { fast: true, dataset: info })
  expect(analysis.steps[0]).toMatchObject({ label: 'Kontrollerar att kostnad finns', status: 'failed' })
  expect(analysis.text).not.toMatch(/\d[,.]?\d*\s*%/)
})

test('derived revenue requires valid mapped quantity and price but blank unit cost remains optional', async () => {
  const parsed = parseCsvText('date,qty,unit_price,unit_cost\n2026-08-01,2,100,\n2026-08-02,1,50,20\n2026-08-03,,100,30\n2026-08-04,1,invalid,30\n')
  const info = await loadMappedUpload(engine, parsed, detectMapping(parsed.headers, parsed.rows), 'derived.csv')
  expect(info).toMatchObject({ rowCount: 2, skippedRows: 2 })
  expect(await engine.query('SELECT revenue, cost FROM sales ORDER BY revenue')).toEqual([{ revenue: 50, cost: 20 }, { revenue: 200, cost: null }])
  expect((await kpiSnapshot(engine, '2026-08')).data.revenue.current).toBe(250)
})

test.each([false, true])('zero quantity uses consistent unit price and unit cost fallbacks (mapped prices: %s)', async mapped => {
  const parsed = { headers: ['date', 'amount', 'cost', 'qty', 'unit_price', 'unit_cost'], rows: [['2026-08-01', '100', '60', '0', '7', '3']] }
  await loadMappedUpload(engine, parsed, { date: 'date', revenue: 'amount', cost: 'cost', qty: 'qty', ...(mapped ? { unit_price: 'unit_price', unit_cost: 'unit_cost' } : {}) }, 'zero.csv')
  expect(await engine.query('SELECT qty, unit_price, unit_cost, revenue, cost FROM sales')).toEqual([
    { qty: 0, unit_price: mapped ? 7 : 0, unit_cost: mapped ? 3 : 0, revenue: 100, cost: 60 },
  ])
})
