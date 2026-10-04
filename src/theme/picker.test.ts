import { expect, test } from 'vitest'
import { buildThemeUrl, themeOptions } from './picker'

test('picker lists all registered public themes in ID order with their names', () => {
  expect(themeOptions).toEqual([
    { id: '00', name: 'Standard' },
    { id: '01', name: 'IBCS management report' },
    { id: '02', name: 'Nordisk offentlig sektor' },
    { id: '03', name: 'FT pink-paper financial graphics' },
    { id: '04', name: 'The Economist chart desk' },
    { id: '05', name: 'Tufte handout' },
    { id: '06', name: 'Morgonbrief' },
    { id: '07', name: 'Lugn arbetsyta' },
    { id: '08', name: 'Schweizisk grid' },
    { id: '09', name: 'Analysterminal' },
    { id: '10', name: 'Windows 98 / Excel' },
  ])
  expect(themeOptions.some(theme => theme.id === '99')).toBe(false)
})

test('theme URL keeps the origin, path, other parameters and fragment', () => {
  const url = buildThemeUrl('https://demo.example/canvas/?fast=1&filter=a&filter=b#report', '07')
  expect(url).toBe('https://demo.example/canvas/?fast=1&filter=a&filter=b&theme=07#report')
})

test('theme URL replaces an existing theme rather than appending another', () => {
  const url = new URL(buildThemeUrl('https://demo.example/?theme=03&fast=1&theme=04', '07'))
  expect(url.searchParams.getAll('theme')).toEqual(['07'])
  expect(url.searchParams.get('fast')).toBe('1')
})

test('Standard removes the theme parameter and preserves other parameters', () => {
  expect(buildThemeUrl('https://demo.example/?theme=07&fast=1#report', '00'))
    .toBe('https://demo.example/?fast=1#report')
  expect(buildThemeUrl('https://demo.example/?theme=07', '00')).toBe('https://demo.example/')
  expect(buildThemeUrl('https://demo.example/', '00')).toBe('https://demo.example/')
})

test('hidden and unregistered themes cannot be selected through the URL builder', () => {
  for (const id of ['99', '11', '7', '']) {
    expect(() => buildThemeUrl('https://demo.example/', id)).toThrow(RangeError)
  }
})
