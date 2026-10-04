// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AnalystMemo } from './AnalystMemo'
import { memoResult } from './__fixtures__/agent'

afterEach(cleanup)
const activities = [{ id: 'run-1', timestamp: '2026-10-04 08:00:00', action: 'Analys startad' }]
const props = { result: memoResult, steps: memoResult.steps, dashboard: null, engine: null, activities, watchApproved: false, analyzing: false, log: vi.fn(), onExplain: vi.fn() }
test('finding reviews require a rejection reason, retain edits and sign off after acceptance', () => {
  const log = vi.fn()
  const view = render(<AnalystMemo {...props} log={log} />)
  const first = within(view.getByTestId('memo-finding-1'))
  fireEvent.click(first.getByRole('button', { name: 'Avvisa' }))
  expect(view.getByTestId('memo-status').textContent).toContain('Utkast')
  expect(view.getByLabelText('Skäl till avvisning').getAttribute('required')).toBe('')
  fireEvent.change(view.getByLabelText('Skäl till avvisning'), { target: { value: 'Kontrollera periodvalet' } })
  fireEvent.click(first.getByRole('button', { name: 'Spara' }))
  expect(view.getByTestId('memo-status').textContent).toContain('Returnerad')
  expect(log).toHaveBeenCalledWith('Fynd avvisat', 'Fynd 1: Kontrollera periodvalet')
  fireEvent.click(first.getByRole('button', { name: 'Ändra' }))
  fireEvent.change(view.getByLabelText('Ändringsförslag (originalets beräknade värden bevaras)'), { target: { value: 'Förtydliga basperioden' } })
  fireEvent.click(first.getByRole('button', { name: 'Spara' }))
  expect(view.getByTestId('memo-status').textContent).toContain('Granskas')
  expect(view.getByTestId('memo-finding-1').textContent).toContain(memoResult.steps[0].summary)
  expect(view.getByTestId('memo-finding-1').textContent).toContain('Förtydliga basperioden')
  for (let number = 1; number <= 5; number++) fireEvent.click(within(view.getByTestId(`memo-finding-${number}`)).getByRole('button', { name: 'Acceptera' }))
  expect(view.getByTestId('memo-status').textContent).toContain('Godkänd')
  expect(view.getByTestId('memo-signoff').textContent).toContain('Granskad av: Granskare')
  expect(log).toHaveBeenCalledWith('Analysanteckning godkänd', 'Granskare')
})
test('footnote opens the existing drawer with its exact SQL, input and returned rows', async () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value: vi.fn(), configurable: true })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { value: vi.fn(), configurable: true })
  const query = vi.fn().mockResolvedValue([{ value: -4, product: 'Ullfilt' }])
  const engine = { query, loadOrderLines: vi.fn(), loadCsvText: vi.fn(), close: vi.fn() }
  const view = render(<AnalystMemo {...props} engine={engine} />)
  fireEvent.click(view.getByRole('button', { name: 'Hur räknas fynd 3? marginWaterfall' }))
  await waitFor(() => expect(view.getByTestId('calculation-drawer').textContent).toContain('Resultatrader (urval): value: −4; product: Ullfilt'))
  expect(query).toHaveBeenCalledExactlyOnceWith(memoResult.steps[2].sql)
  expect(view.getByTestId('calculation-drawer').textContent).toContain('2026-04')
  expect(view.getByTestId('calculation-drawer').textContent).toContain(memoResult.steps[2].sql)
  vi.restoreAllMocks()
})
test('watch approval signs off the memo but cannot override a rejected finding', () => {
  const view = render(<AnalystMemo {...props} watchApproved activities={[...activities, { id: 'watch', timestamp: '08:03', action: 'Bevakning godkänd' }]} />)
  expect(view.getByTestId('memo-signoff').textContent).toContain('Granskare 08:03')
  const first = within(view.getByTestId('memo-finding-1'))
  fireEvent.click(first.getByRole('button', { name: 'Avvisa' }))
  fireEvent.change(view.getByLabelText('Skäl till avvisning'), { target: { value: 'Underlaget behöver granskas' } })
  fireEvent.click(first.getByRole('button', { name: 'Spara' }))
  expect(view.getByTestId('memo-status').textContent).toContain('Returnerad')
  expect(view.getByTestId('memo-signoff').textContent).toContain('Granskad av: —')
})
