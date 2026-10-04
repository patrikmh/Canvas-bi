// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { createNodeEngine } from '../data/engine.node'
import { AnalystSessionProvider, useAnalystSession } from './session'
import type { AnalystSession } from './session'
import type { SqlEngine } from '../data/engine'

const engines: SqlEngine[] = []
afterEach(async () => { cleanup(); for (const engine of engines.splice(0)) await engine.close(); vi.clearAllMocks(); vi.unstubAllGlobals() })
async function mount() {
  history.replaceState(null, '', '/?ui=99&fast=1')
  // DuckDB's bundled feature detector identifies Node by absence of navigator.
  // Keep real Node SQL execution while React runs in jsdom.
  vi.stubGlobal('navigator', undefined)
  const engine = await createNodeEngine()
  engines.push(engine)
  // Provider owns lifecycle; fixtures own actual disposal to keep assertions isolated.
  const createEngine = async () => ({ ...engine, close: vi.fn().mockResolvedValue(undefined) })
  let session: AnalystSession
  function Probe() { session = useAnalystSession(); return null }
  render(<StrictMode><AnalystSessionProvider createEngine={createEngine}><Probe /></AnalystSessionProvider></StrictMode>)
  await waitFor(() => { expect(session.error).toBeNull(); expect(session.ready).toBe(true) }, { timeout: 20_000 })
  return () => session
}

test('provider composes offline data, review/signoff and watch approval without overriding rejection', async () => {
  const current = await mount()
  expect(current().snapshot?.data.orders.current).toBe(793)
  expect(current().findings).toHaveLength(5)
  act(() => current().reviewFinding(1, 'rejected', 'Kontrollera perioden'))
  act(() => current().proposeWatch())
  expect(current().watch?.status).toBe('Föreslagen')
  act(() => current().approveWatch())
  expect(current().watch?.status).toBe('Aktiv')
  expect(current().memoStatus).toBe('Returnerad')
  expect(current().signoff.reviewer).toBeNull()
  expect(current().activities.some(item => item.action === 'Bevakning godkänd')).toBe(true)
  for (let number = 1; number <= 5; number++) act(() => current().reviewFinding(number, 'accepted'))
  act(() => current().signOff('Patrik'))
  expect(current().memoStatus).toBe('Godkänd')
  expect(current().signoff.reviewer).toBe('Patrik')
  expect(current().reviews[1].reason).toBe('Kontrollera perioden')
  act(() => current().selectMonth('2026-06'))
  await waitFor(() => expect(current().ready).toBe(true), { timeout: 20_000 })
  expect(current().month).toBe('2026-06')
  expect(current().memoStatus).toBe('Utkast')
  expect(current().reviews).toEqual({})
  expect(current().watch?.status).toBe('Aktiv')
  expect(current().signoff.reviewer).toBeNull()
})

test('concurrent requested analyses publish only the latest metric and reset memo decisions', async () => {
  const current = await mount()
  act(() => current().reviewFinding(1, 'accepted'))
  await act(async () => {
    await Promise.all([current().runAnalysis('Varför ändrades marginalen?'), current().runAnalysis('Varför ändrades omsättningen?')])
  })
  expect(current().ready).toBe(true)
  expect(current().result?.metric).toBe('revenue')
  expect(current().reviews).toEqual({})
  expect(current().memoStatus).toBe('Utkast')
  expect(current().trace.every(step => step.status === 'done')).toBe(true)
  let reply = ''
  await act(async () => { reply = (await current().ask('Jämför omsättningen med förra året')).text })
  expect(reply).toContain('503')
  expect(reply).toContain('augusti 2026')
})
