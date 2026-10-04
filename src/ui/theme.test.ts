// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { initializeUiTheme } from './theme'
import { getTheme } from '../theme'
import type { UiDefinition } from './types'

const def: UiDefinition = { id: '99', name: 'Test', paradigm: 'Contract', defaultTheme: '02', Component: () => null, shots: { interaction: [] }, smoke: { openApproval: [] } }
afterEach(() => { history.replaceState(null, '', '/'); initializeUiTheme({ ...def, defaultTheme: undefined }) })
test('defaultTheme applies only when theme is absent and leaves the exact URL untouched', () => {
  history.replaceState({ keep: true }, '', '/?ui=99&fast=1#note')
  const before = location.href
  initializeUiTheme(def)
  expect(getTheme().id).toBe('02')
  expect(document.documentElement.dataset.theme).toBe('02')
  expect(location.href).toBe(before)
  expect(history.state).toEqual({ keep: true })
  expect(document.querySelector('.theme-indicator')).toBeNull()
})
test('explicit theme overrides defaultTheme, including invalid values falling back as usual', () => {
  history.replaceState(null, '', '/?ui=99&theme=03')
  initializeUiTheme(def)
  expect(getTheme().id).toBe('03')
  history.replaceState(null, '', '/?ui=99&theme=unknown')
  initializeUiTheme(def)
  expect(getTheme().id).toBe('00')
})
