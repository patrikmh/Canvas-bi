// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { initializeTheme } from './index'
import { ThemeFooter, ThemePicker } from './ThemePicker'
import { themeOptions } from './picker'

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
  initializeTheme()
})

test('Utseende labels a native select containing all public theme names', () => {
  initializeTheme()
  render(<ThemePicker />)
  const select = screen.getByRole('combobox', { name: 'Utseende' }) as HTMLSelectElement
  expect(select.tagName).toBe('SELECT')
  expect(select.dataset.testid).toBe('theme-picker')
  expect(select.value).toBe('00')
  expect(Array.from(select.options, option => ({ id: option.value, name: option.text }))).toEqual(themeOptions)
})

test('the footer exposes appearance without settings and opens a native select', () => {
  initializeTheme()
  render(<ThemeFooter />)
  fireEvent.click(screen.getByRole('button', { name: 'Utseende: Standard ▾' }))
  const select = screen.getByLabelText('Utseende:') as HTMLSelectElement
  expect(select.value).toBe('00')
  expect(document.activeElement).toBe(select)
})

test('picker and footer reflect the theme initialized from a deep link', () => {
  window.history.replaceState({}, '', '/?theme=07&fast=1')
  initializeTheme()
  render(<><ThemeFooter /><ThemePicker /></>)
  expect(screen.getByRole('button', { name: 'Utseende: Lugn arbetsyta ▾' })).toBeDefined()
  expect((screen.getByTestId('theme-picker') as HTMLSelectElement).value).toBe('07')
})
