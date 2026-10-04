// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { getTheme, initializeTheme, readThemeId } from './index'

afterEach(() => { window.history.replaceState({}, '', '/'); initializeTheme() })
test('memo preview is hidden behind an explicit preview flag and default flags remain legacy', () => {
  expect(readThemeId('?theme=99')).toBe('00')
  expect(readThemeId('?theme=99&designPreview=1')).toBe('99')
  expect(getTheme()).toMatchObject({ id: '00', analyst: 'chat', kpiStyle: 'spark', chart: { zeroBased: false, findingMarkers: false, titleMode: 'label' } })
  window.history.replaceState({}, '', '/?theme=99&designPreview=1')
  initializeTheme()
  expect(getTheme()).toMatchObject({ hidden: true, analyst: 'memo', kpiStyle: 'bullet', chart: { zeroBased: true, findingMarkers: true, titleMode: 'message' } })
  window.history.replaceState({}, '', '/?theme=99&designPreview=1&kpi=table')
  initializeTheme()
  expect(getTheme().kpiStyle).toBe('table')
})
