// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { AgentResult } from '../../analysis/agent'
import type { AssistantPanel } from '../assistant/AssistantPanel'
import type { UploadDraft } from './MappingDialog'
const mocks = vi.hoisted(() => ({ run: vi.fn(), load: vi.fn(), close: vi.fn(), log: vi.fn(), upload: vi.fn(), analysisCompleted: vi.fn() }))
vi.mock('../../data/engine.browser', () => ({ createBrowserEngine: async () => ({ loadOrderLines: async () => {}, close: mocks.close }) }))
vi.mock('../../data/metrics', async importOriginal => ({ ...await importOriginal<typeof import('../../data/metrics')>(), latestCompleteMonth: async () => ({ data: '2026-07' }) }))
vi.mock('../../data/engine.upload', async importOriginal => ({ ...await importOriginal<typeof import('../../data/engine.upload')>(), loadMappedUpload: mocks.upload, partialUploadMonths: async () => [] }))
vi.mock('../../analysis/dashboard', async importOriginal => ({ ...await importOriginal<typeof import('../../analysis/dashboard')>(), loadDashboard: mocks.load }))
vi.mock('../../analysis/agent', () => ({ runAgent: mocks.run }))
vi.mock('../../analysis/activity', () => ({ useActivity: () => ({ activities: [], log: mocks.log }) }))
vi.mock('../../canvas/Canvas', () => ({ Canvas: ({ dashboard }: { dashboard: { analysis?: AgentResult } }) => <div data-testid="dashboard">{dashboard.analysis?.text ?? 'Dashboard kvar'}</div> }))
vi.mock('../assistant/AssistantPanel', () => ({ AssistantPanel: ({ onAnalyze, steps }: ComponentProps<typeof AssistantPanel>) => <>
  <button onClick={() => void onAnalyze().then(mocks.analysisCompleted)}>Starta analys</button>
  {steps.map((step, index) => <span key={index} data-testid={`status-${index}`}>{step.status}</span>)}
</> }))
vi.mock('./UploadDialog', () => ({ UploadDialog: ({ onParsed }: { onParsed: (draft: UploadDraft) => void }) => <button onClick={() => onParsed({ name: 'fresh.csv', parsed: { headers: [], rows: [] }, mapping: {} })}>Välj fil</button> }))
vi.mock('./MappingDialog', () => ({ MappingDialog: ({ draft, onConfirm, onClose }: { draft: UploadDraft; onConfirm: (draft: UploadDraft) => Promise<void>; onClose: () => void }) => <button onClick={() => void onConfirm(draft).then(onClose).catch(() => {})}>Bekräfta fil</button> }))
import App from '../../App'

const result = (text: string): AgentResult => ({ metric: 'margin', steps: [], confidence: '', title: '', text })
beforeEach(() => {
  localStorage.clear()
  Element.prototype.scrollTo = vi.fn()
  mocks.load.mockImplementation(async (_engine, month) => ({ month, snapshot: { data: {} } }))
  mocks.upload.mockResolvedValue({ source: 'upload', name: 'fresh.csv', rowCount: 10, months: ['2026-07'], hasCost: true, mapping: { product: 'P', order_id: 'O', customer_id: 'C' }, warnings: [] })
})
afterEach(() => { cleanup(); vi.resetAllMocks() })

test('user-started analysis failure logs Analys misslyckades and preserves the loaded dashboard', async () => {
  mocks.run.mockResolvedValueOnce(result('Tidigare analys')).mockImplementationOnce(async (_engine, _month, options) => {
    options.onSteps([{ label: 'Kontroll', tool: 'scanKpis', input: {}, sql: '', summary: 'SQL failed', status: 'failed', duration: 0 }])
    throw new Error('SQL failed')
  })
  render(<App />)
  await waitFor(() => expect(screen.getByTestId('app-root').getAttribute('data-ready')).toBe('true'), { timeout: 10_000 })
  fireEvent.click(screen.getByRole('button', { name: 'Starta analys' }))
  await waitFor(() => expect(mocks.log).toHaveBeenCalledWith('Analys misslyckades', 'Error: SQL failed'))
  // No catch is attached in the caller: a rejection would be unhandled and fail Vitest.
  await waitFor(() => expect(mocks.analysisCompleted).toHaveBeenCalledWith(undefined))
  expect(screen.getByTestId('dashboard').textContent).toBe('Tidigare analys')
  expect(screen.getByTestId('status-0').textContent).toBe('failed')
  expect(screen.queryByText('Data kunde inte läsas')).toBeNull()
})

test('same-month upload aborts the requested run, starts a fresh controller run with dataset options, and rejects late callbacks', async () => {
  type Options = NonNullable<Parameters<typeof import('../../analysis/agent').runAgent>[2]>
  let oldOptions!: Options
  let resolveOld!: (value: AgentResult) => void
  mocks.run.mockResolvedValueOnce(result('Demo'))
    .mockImplementationOnce((_engine, _month, options) => { oldOptions = options; return new Promise<AgentResult>(resolve => { resolveOld = resolve }) })
    .mockResolvedValueOnce(result('Ny fil'))
  render(<App />)
  await waitFor(() => expect(screen.getByTestId('app-root').getAttribute('data-ready')).toBe('true'), { timeout: 10_000 })
  fireEvent.click(screen.getByRole('button', { name: 'Starta analys' }))
  await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByTestId('upload-entry'))
  fireEvent.click(screen.getByRole('button', { name: 'Välj fil' }))
  fireEvent.click(screen.getByRole('button', { name: 'Bekräfta fil' }))
  await waitFor(() => expect(screen.getByTestId('dashboard').textContent).toBe('Ny fil'))
  expect(oldOptions.signal?.aborted).toBe(true)
  expect(mocks.run).toHaveBeenLastCalledWith(expect.anything(), '2026-07', expect.objectContaining({ dataset: expect.objectContaining({ source: 'upload', name: 'fresh.csv' }), signal: expect.anything() }))
  await act(async () => {
    oldOptions.onSteps?.([{ label: 'Gammal', tool: 'scanKpis', input: {}, sql: '', summary: '', status: 'failed', duration: 0 }])
    resolveOld(result('Gammal analys'))
  })
  expect(screen.getByTestId('dashboard').textContent).toBe('Ny fil')
  expect(screen.queryByTestId('status-0')).toBeNull()
  expect(mocks.log.mock.calls.filter(([action]) => action === 'Analys klar')).toHaveLength(2)
})

test('failed upload cancels an in-flight requested analysis without leaving assistant controls blocked', async () => {
  let resolveOld!: (value: AgentResult) => void
  mocks.run.mockResolvedValueOnce(result('Demo')).mockImplementationOnce((_engine, _month, options) => {
    options.onSteps([{ label: 'Kontroll', tool: 'scanKpis', input: {}, sql: '', summary: '', status: 'running', duration: 0 }])
    return new Promise<AgentResult>(resolve => { resolveOld = resolve })
  })
  mocks.upload.mockRejectedValueOnce(new Error('Invalid file'))
  render(<App />)
  await waitFor(() => expect(screen.getByTestId('app-root').getAttribute('data-ready')).toBe('true'), { timeout: 10_000 })
  fireEvent.click(screen.getByRole('button', { name: 'Starta analys' }))
  await waitFor(() => expect(screen.getByTestId('status-0').textContent).toBe('running'))
  fireEvent.click(screen.getByTestId('upload-entry'))
  fireEvent.click(screen.getByRole('button', { name: 'Välj fil' }))
  fireEvent.click(screen.getByRole('button', { name: 'Bekräfta fil' }))
  await waitFor(() => expect(screen.getByTestId('app-root').getAttribute('data-ready')).toBe('true'), { timeout: 10_000 })
  expect(screen.queryByTestId('status-0')).toBeNull()
  expect(screen.getByTestId('dashboard').textContent).toBe('Demo')
  await act(async () => { resolveOld(result('Gammal analys')) })
  expect(screen.getByTestId('dashboard').textContent).toBe('Demo')
})
