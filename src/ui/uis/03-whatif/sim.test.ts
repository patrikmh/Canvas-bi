import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from '../../../data/engine.node'
import type { SqlEngine } from '../../../data/engine'
import { simulate, simulationSql, clampLever, type BaseProduct, type Levers, type Simulation } from './sim'

const base: BaseProduct[] = [{ product: 'Ullfilt', revenue: 1000, cost: 600 }, { product: 'Linnepläd', revenue: 500, cost: 200 }, { product: 'Övrigt', revenue: 500, cost: 200 }]
const zero: Levers = { prices: { Ullfilt: 0, Linnepläd: 0 }, cost: 0, volumeLoss: 0 }
let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine() })
afterAll(async () => { await engine?.close() })

test('zero levers preserve pooled margin, revenue and cost, without averaging percentages', () => {
  expect(simulate(base, zero)).toMatchObject({ revenue: 2000, cost: 1000, margin: 50 })
})
test('price, supplier cost and constant volume response affect the correct products', () => {
  const result = simulate(base, { prices: { Ullfilt: 10, Linnepläd: 0 }, cost: -10, volumeLoss: 10 })!
  expect(result.revenue).toBeCloseTo(1890)
  expect(result.cost).toBeCloseTo(828)
  expect(result.margin).toBeCloseTo(100 * (1890 - 828) / 1890)
  expect(result.low).toBeLessThan(result.high!)
})
test('missing cost remains unknown, zero revenue is unknown, invalid controls are bounded', () => {
  expect(simulate([{ product: 'Ullfilt', revenue: 100, cost: null }], zero)?.margin).toBeNull()
  expect(simulate([{ product: 'Ullfilt', revenue: 0, cost: 0 }], zero)?.margin).toBeNull()
  expect(clampLever(200, -20, 30)).toBe(30)
  expect(clampLever(-200, -20, 30)).toBe(-20)
  expect(clampLever(NaN, -20, 30)).toBe(0)
})
test('executable DuckDB scenario SQL matches pure model including escaped product names and unknown costs', async () => {
  for (const rows of [base, [{ product: "Chef's filt", revenue: 100, cost: null }]]) {
    const levers = { prices: { Ullfilt: 6, Linnepläd: 5 }, cost: -4, volumeLoss: 3 }
    const [actual] = await engine.query<Simulation>(simulationSql(rows, levers))
    const expected = simulate(rows, levers)!
    for (const key of ['margin', 'cost', 'revenue', 'low', 'high'] as const) {
      if (expected[key] === null) expect(actual[key]).toBeNull()
      else expect(actual[key]).toBeCloseTo(expected[key]!)
    }
  }
})
