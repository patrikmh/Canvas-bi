import { initializeTheme } from '../theme'
import type { UiDefinition } from './types'

/** Resolve defaults through the existing theme initializer without changing the URL. */
export function initializeUiTheme(def: UiDefinition) {
  const original = location.href, url = new URL(original)
  if (url.searchParams.has('theme') || !def.defaultTheme) { initializeTheme(); return }
  url.searchParams.set('theme', def.defaultTheme)
  history.replaceState(history.state, '', url)
  try { initializeTheme() } finally { history.replaceState(history.state, '', original) }
  document.querySelector('.theme-indicator')?.remove()
}
