// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { TraceStep } from '../analysis/agent'
const mocks = vi.hoisted(() => ({ run: vi.fn(), load: vi.fn(), close: vi.fn(), loadOrderLines: vi.fn() }))
vi.mock('../data/engine.browser', () => ({ createBrowserEngine: async () => ({ loadOrderLines: mocks.loadOrderLines, close: mocks.close }) }))
vi.mock('../data/metrics', async importOriginal => ({ ...await importOriginal<typeof import('../data/metrics')>(), latestCompleteMonth: async () => ({ data: '2026-07' }) }))
vi.mock('../analysis/dashboard', async importOriginal => ({ ...await importOriginal<typeof import('../analysis/dashboard')>(), loadDashboard: mocks.load }))
vi.mock('../analysis/agent', () => ({ runAgent: mocks.run }))
vi.mock('../canvas/Canvas', () => ({ Canvas: () => <div data-testid="dashboard">Dashboard kvar</div> }))
vi.mock('./assistant/AssistantPanel', () => ({ AssistantPanel: ({ steps }: { steps: TraceStep[] }) => <div>{steps.map((step, index) => <span key={index} data-testid={`status-${index}`}>{step.status}</span>)}</div> }))
import App from '../App'
beforeEach(() => {
  localStorage.clear()
  mocks.load.mockImplementation(async (_engine, month) => ({ month }))
  Element.prototype.scrollTo = vi.fn()
})
afterEach(() => { cleanup(); vi.clearAllMocks() })
test('startup agent failure shows failed trace and keeps loaded dashboard', async () => {
  mocks.run.mockImplementation(async (_engine, _month, options) => {
    options.onSteps([{ label: 'Kontroll', tool: 'scanKpis', input: {}, sql: '', summary: 'SQL failed', status: 'failed', duration: 0 }])
    throw new Error('SQL failed')
  })
  render(<App />)
  await waitFor(() => expect(screen.getByTestId('app-root').getAttribute('data-ready')).toBe('true'), { timeout: 10_000 })
  expect(screen.getByTestId('dashboard').textContent).toBe('Dashboard kvar')
  expect(screen.getByTestId('status-0').textContent).toBe('failed')
  expect(screen.queryByText('Data kunde inte läsas')).toBeNull()
})
test('restore uses latestCompleteMonth saved at boot rather than the last available month', async () => {
  mocks.run.mockResolvedValue({ metric: 'margin', steps: [], confidence: '', title: '', text: '' })
  render(<App />)
  await waitFor(() => expect(screen.getByTestId('app-root').getAttribute('data-ready')).toBe('true'), { timeout: 10_000 })
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('2026-07')
  const { fireEvent } = await import('@testing-library/react')
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2026-06' } })
  await waitFor(() => expect(mocks.load).toHaveBeenLastCalledWith(expect.anything(), '2026-06'))
  fireEvent.click(screen.getByRole('button', { name: 'Återställ demon' }))
  await waitFor(() => expect(mocks.load).toHaveBeenLastCalledWith(expect.anything(), '2026-07'))
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('2026-07')
})
