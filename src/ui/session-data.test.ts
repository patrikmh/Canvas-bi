import { beforeAll, afterAll, expect, test } from 'vitest'
import { createNodeEngine } from '../data/engine.node'
import type { SqlEngine } from '../data/engine'
import { generateDemoData } from '../data/generate'
import { runAgent } from '../analysis/agent'
import { fmtPct, fmtTkr } from '../data/format'
import { loadSessionData, citationRows, analysisWaterfall, reviewFinding } from './session-data'
import { deriveFindings, memoStatus } from '../components/assistant/memo'

let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine(); await engine.loadOrderLines(generateDemoData()) })
afterAll(async () => { await engine?.close() })

test('session exposes canonical KPI comparisons, all months and SQL product series', async () => {
  const data = await loadSessionData(engine, '2026-08')
  expect(fmtTkr(data.dashboard.snapshot.data.revenue.current)).toBe('503\u00a0tkr')
  expect(fmtPct(data.dashboard.snapshot.data.margin.current)).toBe('44,7\u00a0%')
  expect(data.series.data).toHaveLength(36)
  expect(Object.keys(data.productSeries)).toHaveLength(12)
  const product = data.productSeries.Ullfilt
  expect(product.data).toHaveLength(36)
  expect(product.data.at(-1)?.revenue).toBe(data.dashboard.products.data.find(row => row.product === 'Ullfilt')?.revenue)
  expect(await engine.query(product.sql)).toEqual(product.data)
  const earlier = await loadSessionData(engine, '2024-01')
  expect(earlier.series.data).toHaveLength(36)
  expect(earlier.dashboard.history.data.every(row => row.month <= '2024-01')).toBe(true)
  expect(earlier.dashboard.snapshot.data.revenue.lastYear).toBeNull()
})

test('findings cite executable SQL rows and waterfall follows the agent comparison periods', async () => {
  const result = await runAgent(engine, '2026-08', { fast: true })
  const findings = deriveFindings(result)
  expect(findings.map(finding => finding.number)).toEqual([1, 2, 3, 4, 5])
  const step = findings[2].citations[0]
  const rows = await citationRows(engine, step)
  expect(rows.flat().some(row => row.label === 'Ullfilt')).toBe(true)
  const waterfall = await analysisWaterfall(engine, result)
  expect(waterfall?.data.map(row => row.label)).toEqual(['Före', 'Ullfilt', 'Linnepläd', 'Övriga', 'Nu'])
  expect(waterfall?.sql).toBe(step.sql)
  const early = await runAgent(engine, '2026-06', { fast: true, metric: 'margin' })
  expect((await analysisWaterfall(engine, early))?.sql).not.toContain("'2026-07'")
})

test('review requires a reason, preserves original findings, and uses the existing status vocabulary', () => {
  const draft = reviewFinding({}, 1, 'accepted')
  expect(memoStatus(['pending'], false, false)).toBe('Utkast')
  expect(memoStatus([draft[1].status, 'pending'], false, true)).toBe('Granskas')
  expect(() => reviewFinding(draft, 1, 'rejected', ' ')).toThrow('reason')
  const edited = reviewFinding(draft, 1, 'edited', 'Kontrollera perioden')
  expect(edited[1].reason).toBe('Kontrollera perioden')
  expect(reviewFinding(edited, 1, 'accepted')[1].reason).toBe('Kontrollera perioden')
  const rejected = reviewFinding(edited, 1, 'rejected', 'Fel period')
  expect(memoStatus([rejected[1].status], false, true)).toBe('Returnerad')
  expect(memoStatus([draft[1].status], false, true)).toBe('Godkänd')
  expect(draft[1].status).toBe('accepted')
})
