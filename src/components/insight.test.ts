import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from '../data/engine.node'
import type { SqlEngine } from '../data/engine'
import { generateDemoData } from '../data/generate'
import { loadDashboard } from '../analysis/dashboard'
import { insightText } from './CardContent'
let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine() })
afterAll(async () => { await engine.close() })
test('dashboard insight renders price clause from SQL unit economics before the agent completes', async () => {
  await engine.loadOrderLines(generateDemoData())
  expect(insightText(await loadDashboard(engine, '2026-08'))).toContain('priset är i stort sett oförändrat')
  await engine.loadOrderLines(generateDemoData().map(row => ({ ...row, unit_price: row.unit_price * (row.date >= '2026-07' && ['Ullfilt', 'Linnepläd'].includes(row.product) ? 1.03 : 1) })))
  const text = insightText(await loadDashboard(engine, '2026-08'))
  expect(text).not.toContain('priset är i stort sett oförändrat')
  expect(text).toContain('Prisförändring:')
  expect(text).toContain('+3,0')
})
