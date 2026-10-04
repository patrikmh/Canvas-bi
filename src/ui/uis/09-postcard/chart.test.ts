import { afterAll, beforeAll, expect, test } from 'vitest'
import { createNodeEngine } from '../../../data/engine.node'
import type { SqlEngine } from '../../../data/engine'
import { marginPath, postcardWeek } from './chart'
test('postcard line preserves exact coordinates and breaks across unknown margin', () => {
  expect(marginPath([50, null, 25], 200, 100)).toBe('M0,50 M200,75')
  expect(marginPath([0, 100], 200, 100)).toBe('M0,100 L200,0')
  expect(marginPath([], 200, 100)).toBe('')
})
let engine: SqlEngine
beforeAll(async () => { engine = await createNodeEngine() })
afterAll(async () => { await engine?.close() })
test('week stamp follows ISO week-year around new year with executable SQL', async () => {
  expect((await postcardWeek(engine, '2021-01-01')).data).toEqual({ week: 53, year: 2020 })
  const result = await postcardWeek(engine, '2026-08-31')
  expect(result.data).toEqual({ week: 36, year: 2026 })
  expect(await engine.query(result.sql)).toEqual([result.data])
})
