import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import ibcs from './01-ibcs'
import nordic from './02-nordic'
import ft from './03-ft'
import economist from './04-economist'
import tufte from './05-tufte'

const candidates = [ibcs, nordic, ft, economist, tufte]
test('traditional themes preserve the memo, message titles and honest chart scales', () => {
  for (const theme of candidates) {
    expect(theme.analyst).toBe('memo')
    expect(theme.chart).toMatchObject({ zeroBased: true, findingMarkers: true, titleMode: 'message', smooth: false, areaOpacity: 0, barRadius: 0 })
    expect(theme.chart.actual).not.toBe(theme.chart.bad)
    expect(theme.chart.previous).not.toBe(theme.chart.actual)
  }
  expect(ibcs.kpiStyle).toBe('table')
  expect(nordic.kpiStyle).toBe('bullet')
  expect(tufte.kpiStyle).toBe('table')
})

test('traditional identities bundle their fonts and scope presentation to their own root', () => {
  const slugs = ['ibcs', 'nordic', 'ft', 'economist', 'tufte']
  candidates.forEach((theme, index) => {
    const stem = `${theme.id}-${slugs[index]}`
    const definition = readFileSync(new URL(`./${stem}.ts`, import.meta.url), 'utf8')
    const css = readFileSync(new URL(`./${stem}.css`, import.meta.url), 'utf8')
    expect(definition).toContain("import '@fontsource/")
    expect(css).toContain(`:root[data-theme='${theme.id}']`)
    expect(css).not.toMatch(/gradient|backdrop-filter:\s*blur|#F4F1EA|#D97757/i)
    expect(css).toMatch(/\.approval-badge\s*\{\s*display:\s*none/)
    expect(definition).not.toMatch(/Inter|Space Grotesk|Instrument Serif|Geist/)
  })
})
