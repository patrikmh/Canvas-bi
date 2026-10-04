import { expect, test } from 'vitest'
import { createRegistry, readUiId, resolveUi } from './registry'
import type { UiDefinition } from './types'

const definition: UiDefinition = { id: '99', name: 'Reference', paradigm: 'Contract', hidden: true,
  Component: () => null, shots: { interaction: [] }, smoke: { openApproval: [] } }

test('UI parsing accepts exactly two digits in 01–99', () => {
  for (const id of ['01', '10', '42', '99']) expect(readUiId(`?ui=${id}`)).toBe(id)
  for (const query of ['', '?ui=00', '?ui=1', '?ui=100', '?ui=xx', '?ui=01x']) expect(readUiId(query)).toBeNull()
})

test('registry includes hidden definitions and falls back for unregistered IDs', () => {
  const registry = createRegistry({ './uis/99-reference/index.tsx': { default: definition } })
  expect(resolveUi('?ui=99&theme=02', registry)).toBe(definition)
  expect(resolveUi('?ui=01', registry)).toBeNull()
  expect(resolveUi('', registry)).toBeNull()
  expect(Object.isFrozen(registry)).toBe(true)
})

test('registry rejects duplicate IDs and folder/definition mismatches', () => {
  expect(() => createRegistry({ './uis/98-wrong/index.tsx': { default: definition } })).toThrow('folder')
  expect(() => createRegistry({ './uis/99-a/index.tsx': { default: definition }, './uis/99-b/index.tsx': { default: definition } })).toThrow('Duplicate')
})
