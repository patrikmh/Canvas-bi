import { expect, test } from 'vitest'
import { createNodeEngine } from './engine.node'
import { kpiSnapshot, latestCompleteMonth, productBreakdown, marginWaterfall } from './metrics'

test('raw CSV registration quotes names safely and converts Arrow/BigInt to plain values', async () => {
  const engine = await createNodeEngine()
  try {
    await engine.loadCsvText('raw "sales', 'datum,belopp\n2026-08-31,123.5\n')
    expect(await engine.query('SELECT belopp FROM "raw ""sales"')).toEqual([{ belopp: 123.5 }])
    expect(await engine.query('SELECT 42::BIGINT AS n')).toEqual([{ n: 42 }])
    await engine.loadCsvText('raw "sales', 'datum,belopp\n2026-08-31,9\n')
    expect(await engine.query('SELECT belopp FROM "raw ""sales"')).toEqual([{ belopp: 9 }])
  } finally { await engine.close() }
})

test('missing costs and comparison periods stay null; partial last month is excluded', async () => {
  const engine = await createNodeEngine()
  try {
    await engine.loadOrderLines([
      { date: '2026-07-31', order_id: '1', customer_id: '1', product: "O'Brien", qty: 2, unit_price: 50, unit_cost: null, channel: 'Webb', region: 'Malmö' },
      { date: '2026-08-15', order_id: '2', customer_id: '2', product: "O'Brien", qty: 1, unit_price: 50, unit_cost: 25, channel: 'Webb', region: 'Malmö' },
    ])
    const { data } = await kpiSnapshot(engine, '2026-07')
    expect(data.revenue.current).toBe(100)
    expect(data.margin.current).toBeNull()
    expect(data.revenue.deltaYoY).toBeNull()
    expect((await latestCompleteMonth(engine)).data).toBe('2026-07')
    expect((await productBreakdown(engine, '2026-07', '2025-07')).data[0].margin).toBeNull()
    expect((await marginWaterfall(engine, ['2026-07'], ['2026-08'])).data).toEqual([])
    await engine.loadOrderLines([])
    expect((await latestCompleteMonth(engine)).data).toBeNull()
  } finally { await engine.close() }
})
