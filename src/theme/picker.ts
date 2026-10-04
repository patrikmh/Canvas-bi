import { themes } from './index'

export const themeOptions = Object.values(themes)
  .filter(theme => !theme.hidden)
  .sort((left, right) => left.id.localeCompare(right.id))
  .map(({ id, name }) => ({ id, name }))

export function buildThemeUrl(currentUrl: string, themeId: string): string {
  if (!themeOptions.some(theme => theme.id === themeId)) throw new RangeError('Unknown public theme')
  const url = new URL(currentUrl)
  if (themeId === '00') url.searchParams.delete('theme')
  else url.searchParams.set('theme', themeId)
  return url.href
}
