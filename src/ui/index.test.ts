import { expect, test } from 'vitest'
import { requestedUi, uis, uiManifest } from './index'

test('eager drop-in registry exports the hidden reference UI and serializable harness contract', () => {
  expect(requestedUi('?ui=99')).toBe(uis['99'])
  expect(uis['99']).toMatchObject({ hidden: true, id: '99' })
  expect(requestedUi('?ui=98')).toBeNull()
  expect(JSON.parse(JSON.stringify(uiManifest)).find((def: { id: string }) => def.id === '99')).toMatchObject({ shots: { interaction: expect.any(Array) }, smoke: { openApproval: [] } })
  expect(uiManifest.every(def => !('Component' in def))).toBe(true)
})
