import { expect, test } from 'vitest'
import { createNodeEngine } from '../../../data/engine.node'
import { monthlySeries } from '../../../data/metrics'
import { sourceSql } from './query'

test('search citations execute canonical DuckDB SQL and preserve pooled and unknown margins', async () => {
  const engine = await createNodeEngine()
  try {
    await engine.loadOrderLines([
      { date: '2025-07-31', product: 'Ullfilt', order_id: 'a', customer_id: 'a', qty: 1, unit_price: 100, unit_cost: 50, channel: 'Webb', region: 'Stockholm' },
      { date: '2026-07-31', product: 'Ullfilt', order_id: 'b', customer_id: 'b', qty: 1, unit_price: 100, unit_cost: 20, channel: 'Webb', region: 'Stockholm' },
      { date: '2026-07-31', product: 'Ullfilt', order_id: 'c', customer_id: 'c', qty: 9, unit_price: 100, unit_cost: 80, channel: 'Webb', region: 'Stockholm' },
      { date: '2026-08-31', product: 'Ullfilt', order_id: 'd', customer_id: 'd', qty: 1, unit_price: 100, unit_cost: null, channel: 'Webb', region: 'Stockholm' },
      { date: '2026-09-30', product: 'Ullfilt', order_id: 'e', customer_id: 'e', qty: 1, unit_price: 100, unit_cost: 30, channel: 'Webb', region: 'Stockholm' },
    ])
    const series = await monthlySeries(engine)
    const rows = await engine.query<{ month: string; gross_margin_pct: number | null }>(sourceSql(series.sql, ['2026-07', '2026-08'], 'year'))
    expect(rows.map(row => row.month)).toEqual(['2025-07', '2026-07', '2026-08'])
    expect(rows[1].gross_margin_pct).toBe(26)
    expect(rows[2].gross_margin_pct).toBeNull()
    const currentOnly = await engine.query<{ month: string }>(sourceSql(series.sql, ['2026-07'], 'none'))
    expect(currentOnly.map(row => row.month)).toEqual(['2026-07'])
  } finally { await engine.close() }
})
