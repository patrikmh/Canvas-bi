import { expect, test } from 'vitest'
import { memoResult } from './__fixtures__/agent'
import { deriveFindings, memoStatus, confidenceNote, runIdentity, sqlStatements } from './memo'

test('memo findings preserve computed summaries, exact SQL and tool inputs', () => {
  const findings = deriveFindings(memoResult)
  expect(findings).toHaveLength(5)
  expect(findings[0]).toMatchObject({ number: 1, text: memoResult.steps[0].summary, step: memoResult.steps[0] })
  expect(findings[2].text).toContain('Ungefär 90 %')
  expect(findings[2].citations).toEqual([memoResult.steps[2], memoResult.steps[4]])
  expect(findings[3].text).toContain('+31,0 %')
  expect(deriveFindings({ ...memoResult, steps: [{ ...memoResult.steps[0], status: 'pending' }] })).toEqual([])
  expect(deriveFindings({ ...memoResult, steps: [{ ...memoResult.steps[0], status: 'failed' }] })[0].text).toContain('år −17,4 %')
})

test('memo status moves from draft through review to approval or return', () => {
  expect(memoStatus([], false, false)).toBe('Utkast')
  expect(memoStatus(['pending', 'pending'], false, true)).toBe('Utkast')
  expect(memoStatus(['accepted', 'pending'], false, true)).toBe('Granskas')
  expect(memoStatus(['edited', 'accepted'], false, true)).toBe('Granskas')
  expect(memoStatus(['accepted', 'accepted'], false, true)).toBe('Godkänd')
  expect(memoStatus(['pending'], true, true)).toBe('Godkänd')
  expect(memoStatus(['rejected', 'accepted'], true, true)).toBe('Returnerad')
  expect(memoStatus([], true, false)).toBe('Utkast')
})

test('confidence gives actions and run identity comes from activity, not render time', () => {
  expect(confidenceNote('Hög säkerhet', '2026-08')).toContain('augusti 2026')
  expect(confidenceNote('Medel säkerhet', '2026-07')).toContain('kör om när månaden är stängd')
  expect(confidenceNote('Låg säkerhet', '2026-08')).toContain('samla mer data')
  expect(confidenceNote('ANTAGANDE', '2026-08')).toContain('ANTAGANDE')
  expect(runIdentity([{ id: 'a', timestamp: '08:01', action: 'Analys startad' }, { id: 'b', timestamp: '08:02', action: 'Analys startad' }])).toEqual({ number: 2, time: '08:02', id: 'b' })
})

test('citation queries include every SELECT without splitting quoted names or comments', () => {
  expect(sqlStatements("SELECT 'Linne;pläd''s' AS product; SELECT 2 AS cost")).toEqual(["SELECT 'Linne;pläd''s' AS product", 'SELECT 2 AS cost'])
  expect(sqlStatements('SELECT "a;b" /* ; */ FROM sales; -- ;\nSELECT 1')).toEqual(['SELECT "a;b" /* ; */ FROM sales', '-- ;\nSELECT 1'])
})
