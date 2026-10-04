import { expect, test } from 'vitest'
import { decisionTitle, moveSelection, countStates, itemState } from './inbox'

test('decision titles are actions derived from the executed finding tool', () => {
  expect(decisionTitle('unitEconomics', ['Ullfilt', 'Linnepläd'])).toBe('Omförhandla inköpspriset på Ullfilt och Linnepläd')
  expect(decisionTitle('marginWaterfall', ['Ullfilt'])).toBe('Granska produktbidragen för Ullfilt')
  expect(decisionTitle('unknown', [])).toBe('Granska analysunderlaget')
})
test('triage counts every state and review takes precedence over snoozing', () => {
  expect(itemState('accepted', true)).toBe('Klar')
  expect(itemState('rejected', true)).toBe('Avfärdad')
  expect(itemState('edited', true)).toBe('Snoozad')
  expect(countStates(['Öppen', 'Snoozad', 'Klar', 'Avfärdad', 'Klar'])).toEqual({ Öppen: 1, Snoozad: 1, Klar: 2, Avfärdad: 1 })
})
test('keyboard selection stays inside the visible inbox, including empty inboxes', () => {
  expect(moveSelection(0, -1, 3)).toBe(0)
  expect(moveSelection(2, 1, 3)).toBe(2)
  expect(moveSelection(0, 1, 3)).toBe(1)
  expect(moveSelection(0, 1, 0)).toBe(0)
})
