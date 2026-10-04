// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { getTheme, initializeTheme, readThemeId } from './index'

afterEach(() => {
  window.history.replaceState({}, '', '/')
  initializeTheme()
})

test('readThemeId parses supported IDs and defaults missing or invalid values', () => {
  expect(readThemeId('?theme=03')).toBe('03')
  for (const id of ['00', '01', '10']) expect(readThemeId(`?theme=${id}`)).toBe(id)
  for (const query of ['', '?fast=1', '?theme=', '?theme=3', '?theme=11', '?theme=foo', '?theme=003']) {
    expect(readThemeId(query)).toBe('00')
  }
  window.history.replaceState({}, '', '/?theme=03&fast=1')
  expect(readThemeId()).toBe('03')
})

test('initialization resolves unknown themes and sets the root before render', () => {
  window.history.replaceState({}, '', '/?theme=03')
  initializeTheme()
  expect(getTheme().id).toBe('00')
  expect(document.documentElement.dataset.theme).toBe('00')
})

test('the theme label appears only for an explicit theme parameter', () => {
  initializeTheme()
  expect(document.querySelector('.theme-indicator')).toBeNull()
  window.history.replaceState({}, '', '/?theme=00')
  initializeTheme()
  expect(document.querySelector('.theme-indicator')?.textContent).toBe('Tema 00 – Standard')
  initializeTheme()
  expect(document.querySelectorAll('.theme-indicator')).toHaveLength(1)
})
