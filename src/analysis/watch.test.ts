import { expect, test } from 'vitest'
import { watchTriggers, type Watch } from './watch'
const watch: Watch = { id: 'watch', threshold: 46, drop: 2, channel: 'E-post', owner: 'DemoCo AB', frequency: 'Dagligen', status: 'Föreslagen' }
test('approval is necessary and thresholds are strict, missing margin never alerts', () => {
  expect(watchTriggers(watch, 44.7, 51.1)).toBe(false)
  expect(watchTriggers({ ...watch, status: 'Avvisad' }, 44.7, 51.1)).toBe(false)
  const active = { ...watch, status: 'Aktiv' as const }
  expect(watchTriggers(active, 44.7, 51.1)).toBe(true)
  expect(watchTriggers(active, 46, 48)).toBe(false)
  expect(watchTriggers(active, 47, 50)).toBe(true)
  expect(watchTriggers(active, null, 50)).toBe(false)
})
