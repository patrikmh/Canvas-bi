import { afterAll, beforeAll, expect, test } from 'vitest'
import { plainValue } from './engine'
import type { SqlEngine } from './engine'
import { createNodeEngine } from './engine.node'
import { generateDemoData } from './generate'
import { findChangeStart, latestCompleteMonth } from './metrics'
import { fmtDeltaPct, fmtInt, fmtPct, fmtPp, fmtTkr } from './format'
let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine() })
afterAll(async () => { await engine?.close() })
const line = (date: string, price = 100) => ({ date, qty: 1, unit_price: price, unit_cost: 50, product: 'P', order_id: date, customer_id: date, channel: '', region: '' })

test('month completeness tolerates three days without sales, later months, and partial-only datasets', async () => {
  await engine.loadOrderLines([line('2026-08-28')])
  expect(await latestCompleteMonth(engine)).toMatchObject({ data: '2026-08', partial: false })
  await engine.loadOrderLines([line('2026-08-27')])
  expect(await latestCompleteMonth(engine)).toMatchObject({ data: '2026-08', partial: true })
  await engine.loadOrderLines([line('2026-07-10'), line('2026-08-15')])
  expect(await latestCompleteMonth(engine)).toMatchObject({ data: '2026-07', partial: false })
  await engine.loadOrderLines([])
  expect(await latestCompleteMonth(engine)).toMatchObject({ data: null, partial: false })
})

test('demo revenue does not treat the seasonal January dip as a structural break', async () => {
  await engine.loadOrderLines(generateDemoData())
  expect((await findChangeStart(engine, 'revenue')).data).toBeNull()
})

test.each([60, 140])('change start detects revenue breaks in both directions (%s)', async price => {
  const rows = Array.from({ length: 14 }, (_, i) => line(new Date(Date.UTC(2025, i, 28)).toISOString().slice(0, 10), i === 13 ? price : 100))
  await engine.loadOrderLines(rows)
  expect((await findChangeStart(engine, 'revenue')).data).toBe('2026-02')
})

test('rolling baseline detects a change in shorter histories', async () => {
  await engine.loadOrderLines([line('2026-01-28'), line('2026-02-28'), line('2026-03-28'), line('2026-04-28', 140)])
  expect((await findChangeStart(engine, 'revenue')).data).toBe('2026-04')
})

test('Arrow decimals become scaled numbers and timestamps retain time and fractional precision', async () => {
  expect(await engine.query('SELECT 1234.56::DECIMAL(18,2) AS positive, -1234.56::DECIMAL(18,2) AS negative, NULL::DECIMAL(18,2) AS missing')).toEqual([{ positive: 1234.56, negative: -1234.56, missing: null }])
  expect(await engine.query("SELECT TIMESTAMP '2026-08-01 10:23:45.123456' AS time")).toEqual([{ time: Date.UTC(2026, 7, 1, 10, 23, 45) + 123.456 }])
  expect(plainValue(new Date('2026-08-01T10:23:45.123Z'))).toBe('2026-08-01T10:23:45.123Z')
})

test('formatters round before selecting signs and units', () => {
  for (const value of [.001, -.001, 0, -0]) {
    expect(fmtDeltaPct(value)).toBe('0,0\u00a0%')
    expect(fmtPct(value)).toBe('0,0\u00a0%')
    expect(fmtPp(value)).toBe('0,0\u00a0p.e.')
    expect(fmtInt(value)).toBe('0')
  }
  expect(fmtTkr(9_999_600)).toBe('10,0\u00a0mkr')
  expect(fmtTkr(-9_999_600)).toBe('−10,0\u00a0mkr')
  expect(fmtTkr(-.1)).toBe('0\u00a0tkr')
  expect(fmtDeltaPct(-.04)).toBe('0,0\u00a0%')
  expect(fmtDeltaPct(.06)).toBe('+0,1\u00a0%')
})
