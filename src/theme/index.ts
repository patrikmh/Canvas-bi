import defaultTheme from './themes/00-default'
import type { ThemeDefinition } from './types'
export type { ChartTokens, ThemeDefinition } from './types'

// Drop in NN-slug.ts exporting a definition and importing its scoped NN-slug.css.
const modules = import.meta.glob<{ default: ThemeDefinition }>('./themes/*.ts', { eager: true })
export const themes: Readonly<Record<string, ThemeDefinition>> = Object.freeze(Object.fromEntries(
  Object.values(modules).map(module => [module.default.id, module.default]),
))
let activeTheme: ThemeDefinition = defaultTheme

/** Parse the supported ID range; initializeTheme resolves IDs not yet registered. */
export function readThemeId(search = typeof location === 'undefined' ? '' : location.search): string {
  const id = new URLSearchParams(search).get('theme')
  if (id === '99' && new URLSearchParams(search).get('designPreview') === '1') return id
  return id && /^(0[0-9]|10)$/.test(id) ? id : '00'
}

export function initializeTheme(): void {
  activeTheme = themes[readThemeId()] ?? defaultTheme
  if (activeTheme.id === '99' && new URLSearchParams(location.search).get('kpi') === 'table') activeTheme = { ...activeTheme, kpiStyle: 'table' }
  document.documentElement.dataset.theme = activeTheme.id
  document.querySelector('.theme-indicator')?.remove()
  if (new URLSearchParams(location.search).has('theme')) {
    const label = document.createElement('span')
    label.className = 'theme-indicator'
    label.textContent = `Tema ${activeTheme.id} – ${activeTheme.name}`
    document.body.append(label)
  }
}

export function getTheme(): ThemeDefinition { return activeTheme }
