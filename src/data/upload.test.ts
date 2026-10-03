import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from './engine.node'
import type { SqlEngine } from './engine'
import { detectMapping } from './mapping'
import { parseCsvText, parseXlsx, loadMappedData } from './upload'
import { kpiSnapshot, latestCompleteMonth } from './metrics'
const expected = JSON.parse(readFileSync('e2e/fixtures/expected.json', 'utf8'))
const fixture = (name: string) => parseCsvText(readFileSync(`e2e/fixtures/${name}`, 'utf8'))
let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine() })
afterAll(async () => { await engine?.close() })

test('CSV parser handles BOM, semicolons, quoted cells and CRLF', () => {
  expect(parseCsvText('\ufeffdatum;produkt;belopp\r\n2026-08-01;"Tröja; blå";"123,50"\r\n')).toEqual({
    headers: ['datum', 'produkt', 'belopp'], rows: [['2026-08-01', 'Tröja; blå', '123,50']],
  })
  expect(() => parseCsvText('date,date\n1,2')).toThrow('unika')
  expect(() => parseCsvText('')).toThrow()
  expect(() => parseCsvText('date,amount\n"unterminated,2')).toThrow()
})

test.each(['annan-butik.csv', 'utan-kostnad.csv', 'fa-rader.csv'])('loadMappedData %s agrees with independent latest-month expectations', async name => {
  const parsed = fixture(name)
  const info = await loadMappedData(engine, parsed, detectMapping(parsed.headers, parsed.rows))
  const target = expected[name]
  expect(info).toMatchObject({ source: 'upload', rowCount: target.rowCount, skippedRows: 0, hasCost: target.cost !== null })
  expect(info.months).toHaveLength(target.monthCount)
  expect((await latestCompleteMonth(engine)).data).toBe(target.latestMonth)
  const { data } = await kpiSnapshot(engine, target.latestMonth)
  expect(data.revenue.current).toBeCloseTo(target.revenue, 8)
  if (target.margin === null) expect(data.margin.current).toBeNull()
  else expect(data.margin.current).toBeCloseTo(target.margin, 8)
})

test('failed loads keep the old sales table, including a DuckDB insert failure', async () => {
  const parsed = fixture('fa-rader.csv')
  await loadMappedData(engine, parsed, detectMapping(parsed.headers, parsed.rows))
  const before = await engine.query('SELECT SUM(revenue) AS revenue, COUNT(*) AS rows FROM sales')
  await expect(loadMappedData(engine, { headers: ['date', 'amount'], rows: [['bad-date', '42']] }, { date: 'date', revenue: 'amount' })).rejects.toThrow()
  await expect(engine.loadOrderLines([{ date: 'bad-date', order_id: 'x', customer_id: 'y', product: 'z', qty: 1, unit_price: 2, unit_cost: 1, channel: '', region: '' }])).rejects.toThrow()
  expect(await engine.query('SELECT SUM(revenue) AS revenue, COUNT(*) AS rows FROM sales')).toEqual(before)
  await expect(loadMappedData(engine, parsed, { date: 'does not exist', revenue: 'belopp' })).rejects.toThrow()
  expect(await engine.query('SELECT SUM(revenue) AS revenue, COUNT(*) AS rows FROM sales')).toEqual(before)
})

test('assumedMarginPct explicitly annotates the dataset and produces SQL margin', async () => {
  const parsed = fixture('utan-kostnad.csv'), mapping = detectMapping(parsed.headers, parsed.rows)
  const info = await loadMappedData(engine, parsed, mapping, { assumedMarginPct: 35 })
  expect(info).toMatchObject({ hasCost: true, assumption: { kind: 'margin', pct: 35 } })
  expect((await kpiSnapshot(engine, expected['utan-kostnad.csv'].latestMonth)).data.margin.current).toBeCloseTo(35, 8)
  expect(info.warnings.join(' ')).toContain('antagande')
  for (const pct of [-1, 101, NaN]) await expect(loadMappedData(engine, parsed, mapping, { assumedMarginPct: pct })).rejects.toThrow()
  const withCost = fixture('annan-butik.csv')
  expect((await loadMappedData(engine, withCost, detectMapping(withCost.headers, withCost.rows), { assumedMarginPct: 90 })).assumption).toBeUndefined()
})

test('invalid rows are skipped and counted; direct totals take precedence and omitted qty defaults to one', async () => {
  const parsed = { headers: ['date', 'amount', 'cost'], rows: [['2026-08-28', '1 234,50 kr', '500'], ['bad', '100', '50'], ['2026-08-01', 'oops', '1'], ['2026-08-02', '100', 'bad']] }
  const info = await loadMappedData(engine, parsed, { date: 'date', revenue: 'amount', cost: 'cost' })
  expect(info).toMatchObject({ rowCount: 1, skippedRows: 3 })
  expect(info.warnings.join(' ')).toContain('3')
  expect(await engine.query('SELECT qty, revenue, cost FROM sales')).toEqual([{ qty: 1, revenue: 1234.5, cost: 500 }])
  await loadMappedData(engine, { headers: ['date', 'price', 'cost'], rows: [['2026-08-28', '100', '60']] }, { date: 'date', unit_price: 'price', unit_cost: 'cost' })
  expect(await engine.query('SELECT qty, revenue, cost FROM sales')).toEqual([{ qty: 1, revenue: 100, cost: 60 }])
  await loadMappedData(engine, { headers: ['date', 'amount', 'cost', 'qty', 'price'], rows: [['2026-08-28', '200', '60', '2', '99']] }, { date: 'date', revenue: 'amount', cost: 'cost', qty: 'qty', unit_price: 'price' })
  expect(await engine.query('SELECT revenue, cost FROM sales')).toEqual([{ revenue: 200, cost: 60 }])
})

test('xlsx fixture parses identically to CSV and loads the same totals', async () => {
  const bytes = readFileSync('e2e/fixtures/annan-butik.xlsx')
  const parsed = await parseXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  expect(parsed).toEqual(fixture('annan-butik.csv'))
  await loadMappedData(engine, parsed, detectMapping(parsed.headers, parsed.rows))
  expect((await kpiSnapshot(engine, expected['annan-butik.xlsx'].latestMonth)).data.revenue.current).toBeCloseTo(expected['annan-butik.xlsx'].revenue, 8)
})
