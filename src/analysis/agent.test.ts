import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from '../data/engine.node'
import type { SqlEngine } from '../data/engine'
import { generateDemoData } from '../data/generate'
import { runAgent } from './agent'
let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine(); await engine.loadOrderLines(generateDemoData()) })
afterAll(async () => { await engine?.close() })
test('agent executes five observable tools and writes exact SQL-backed demo insight', async () => {
  const updates: string[] = []
  const result = await runAgent(engine, '2026-08', { fast: true, onSteps: steps => updates.push(steps.map(s => s.status).join(',')) })
  expect(result.metric).toBe('margin')
  expect(result.steps.map(step => step.label)).toEqual(['Bekräftar att marginalen har ändrats', 'Letar efter när förändringen började', 'Delar upp förändringen per produkt', 'Testar om kostnad eller pris förklarar den', 'Verifierar siffrorna'])
  expect(result.steps.every(s => s.status === 'done' && s.sql.includes('sales') && s.duration >= 0)).toBe(true)
  expect(updates.some(s => s.includes('running'))).toBe(true)
  for (const number of ['51,1 %', '44,7 %', '6,4 procentenheter', '95 %', 'Ullfilt 28 %', 'Linnepläd 28 %']) expect(result.text.replaceAll('\u00a0', ' ')).toContain(number)
  expect(result.confidence).toBe('Hög säkerhet')
})
test('tiny dataset labels low confidence and avoids strong claims', async () => {
  const tiny = await createNodeEngine()
  try {
    await tiny.loadOrderLines(generateDemoData().slice(0, 5))
    const result = await runAgent(tiny, '2023-09', { fast: true })
    expect(result.confidence).toBe('Låg säkerhet')
    expect(result.text).toContain('färre än sex månader')
    expect(result.text).toContain('färre än trettio ordrar')
    expect(result.text).not.toContain('kommer från')
  } finally { await tiny.close() }
})
test('a revenue anomaly is detected without a demo-specific margin assumption', async () => {
  const other = await createNodeEngine()
  try {
    await other.loadOrderLines(generateDemoData().map(row => ({ ...row, unit_cost: row.unit_price * .5 * (row.date.startsWith('2026-08') ? .2 : 1), unit_price: row.unit_price * (row.date.startsWith('2026-08') ? .2 : 1) })))
    const result = await runAgent(other, '2026-08', { fast: true })
    expect(result.metric).toBe('revenue')
    expect(result.text).toContain('Omsättning')
    expect(result.confidence).toBe('Hög säkerhet')
    const reconciliation = await other.query<{ residual: number }>(result.steps[4].sql)
    expect(reconciliation[0].residual).toBeCloseTo(0, 7)
    expect(result.steps.every(s => s.status === 'done')).toBe(true)
  } finally { await other.close() }
})
test('an old break cannot override the latest selected-period margin change', async () => {
  const other = await createNodeEngine()
  try {
    await other.loadOrderLines(generateDemoData().map(row => ({ ...row, unit_cost: row.unit_price * (row.date.startsWith('2025-01') ? .7 : row.date >= '2026-07' ? .6 : .5) })))
    const result = await runAgent(other, '2026-08', { fast: true })
    expect(result.metric).toBe('margin')
    expect(result.text).toContain('juli 2026')
    expect(result.text).not.toContain('januari 2025')
  } finally { await other.close() }
})
test('tool failure is observable, with failed status and duration', async () => {
  let steps: import('./agent').TraceStep[] = []
  const broken = { query: async () => { throw new Error('SQL unavailable') } } as unknown as SqlEngine
  await expect(runAgent(broken, '2026-08', { fast: true, onSteps: value => { steps = value } })).rejects.toThrow('SQL unavailable')
  expect(steps[0]).toMatchObject({ status: 'failed', summary: 'Error: SQL unavailable' })
  expect(steps[0].duration).toBeGreaterThanOrEqual(0)
  expect(steps.slice(1).every(step => step.status === 'pending')).toBe(true)
})

test('trace names match the SQL actually used without discarded metric calls', async () => {
  const result = await runAgent(engine, '2026-08', { fast: true })
  expect(result.steps.map(step => step.tool)).toEqual(['scanKpis', 'findLatestChange', 'marginWaterfall', 'unitEconomics', 'reconcileWaterfall'])
  expect(result.steps[0].sql).toContain("UNION ALL")
  for (const index of [1, 2, 4]) expect(result.steps[index].sql).not.toContain(';\n')
})
test('agent states SQL-backed price changes when a contributor price changes by at least two percent', async () => {
  const other = await createNodeEngine()
  try {
    await other.loadOrderLines(generateDemoData().map(row => ({ ...row, unit_price: row.unit_price * (row.date >= '2026-07' && ['Ullfilt', 'Linnepläd'].includes(row.product) ? 1.03 : 1) })))
    const result = await runAgent(other, '2026-08', { fast: true, metric: 'margin' })
    expect(result.text).not.toContain('priset är i stort sett oförändrat')
    expect(result.text).toContain('Prisförändring:')
    expect(result.text).toContain('+3,0')
  } finally { await other.close() }
})
