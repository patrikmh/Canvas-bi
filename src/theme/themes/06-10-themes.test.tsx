// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { themes, initializeTheme } from '../index'
import { handleThemeKey, syncThemePresentation } from './06-10-presentation'

afterEach(() => {
  document.body.replaceChildren()
  window.history.replaceState({}, '', '/')
  initializeTheme()
})

test.each(['06', '07', '08', '09', '10'])('theme %s keeps the honest chart and memo contract', id => {
  const theme = themes[id]
  expect(theme).toBeDefined()
  expect(theme.analyst).toBe('memo')
  expect(theme.chart).toMatchObject({ zeroBased: true, findingMarkers: true, titleMode: 'message', smooth: false, areaOpacity: 0, barRadius: 0 })
  expect(theme.chart.actual).not.toBe(theme.chart.bad)
  expect(theme.chart.previous).not.toBe(theme.chart.actual)
  window.history.replaceState({}, '', `/?theme=${id}`)
  initializeTheme()
  expect(document.documentElement.dataset.theme).toBe(id)
})

test('review shortcuts act on the focused finding and leave typed text alone', () => {
  document.documentElement.dataset.theme = '07'
  document.body.innerHTML = '<ol class="memo-findings"><li><div class="memo-review-actions"><button>Acceptera</button><button>Ändra</button><button>Avvisa</button></div><textarea></textarea></li></ol>'
  const buttons = document.querySelectorAll('button')
  syncThemePresentation('07')
  expect(buttons[0].querySelector('kbd')?.getAttribute('aria-hidden')).toBe('true')
  let accepted = 0
  buttons[0].onclick = () => accepted++
  buttons[1].focus()
  handleThemeKey(new KeyboardEvent('keydown', { key: 'a', cancelable: true }))
  expect(accepted).toBe(1)
  document.querySelector('textarea')!.focus()
  handleThemeKey(new KeyboardEvent('keydown', { key: 'a', cancelable: true }))
  expect(accepted).toBe(1)
  buttons[1].focus()
  handleThemeKey(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }))
  expect(accepted).toBe(1)
})

test('terminal function keys invoke the existing command buttons only in theme 09', () => {
  document.body.innerHTML = '<div class="assistant-chips"><button class="assistant-chip">Utforska</button><button class="assistant-chip">Varför?</button></div>'
  let invoked = 0
  document.querySelectorAll<HTMLButtonElement>('button')[1].onclick = () => invoked++
  document.documentElement.dataset.theme = '09'
  handleThemeKey(new KeyboardEvent('keydown', { key: 'F2', cancelable: true }))
  expect(invoked).toBe(1)
  document.documentElement.dataset.theme = '00'
  handleThemeKey(new KeyboardEvent('keydown', { key: 'F2' }))
  expect(invoked).toBe(1)
})

test('presentation uses the real reviewer, run identity and query-backed period count', () => {
  document.body.innerHTML = '<div class="app"><div class="insight-content"><h2>Slutsats</h2><p>Beräknad ingress.</p><div class="insight-actions"></div></div><div class="memo-signoff"><p>Upprättad av: Analysagent, körning #7, 08:03</p><p>Granskad av: Granskare 08:04</p></div><div class="kind-trend"><p class="card-subtitle">Senaste 24 månaderna</p></div></div>'
  syncThemePresentation('06')
  expect(document.querySelector('.briefing-byline')?.textContent).toBe('Av Analysagenten, granskad av Granskare 08:04')
  syncThemePresentation('09')
  expect(document.querySelector('.terminal-status')?.textContent).toContain('körning #7, 08:03')
  syncThemePresentation('10')
  expect(document.querySelector('.win98-status')?.textContent).toBe('Klar | 24 månader | DuckDB')
  syncThemePresentation('10')
  expect(document.querySelectorAll('.win98-status')).toHaveLength(1)
  document.querySelector('.kind-trend')!.remove()
  syncThemePresentation('10')
  expect(document.querySelector('.win98-status')?.textContent).toBe('Klar | 24 månader | DuckDB')
})

test('Excel hatching preserves semantic colour, geometry and existing chart paths', () => {
  document.body.innerHTML = '<div class="kind-bars"><div class="chart"><svg><path fill="#333333" d="M0 0h20v8H0z"/><path fill="#FF433D" d="M0 10h10v8H0z"/></svg></div></div>'
  syncThemePresentation('10')
  const svg = document.querySelector('svg')!
  expect(svg.querySelector('pattern')).not.toBeNull()
  expect(svg.querySelector('path[d="M0 0h20v8H0z"]')?.getAttribute('fill')).toMatch(/^url\(#excel-/)
  expect(svg.querySelector('path[d="M0 10h10v8H0z"]')?.getAttribute('fill')).toBe('#FF433D')
  syncThemePresentation('10')
  expect(svg.querySelectorAll('pattern')).toHaveLength(2)
})

test('newsroom annotations keep the existing finding coordinates', () => {
  document.body.innerHTML = '<div class="kind-trend"><div class="chart"><svg><text transform="translate(280 80)">②</text><text transform="translate(290 98)">①</text></svg></div></div>'
  syncThemePresentation('06')
  const labels = document.querySelectorAll('text')
  expect(labels[0].textContent).toBe('② Brytpunkt')
  expect(labels[0].getAttribute('transform')).toBe('translate(280 80)')
  expect(labels[1].textContent).toBe('① Nu')
  expect(labels[0].getAttribute('text-anchor')).toBe('end')
})
