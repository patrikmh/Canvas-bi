import { expect, test } from 'vitest'
import { panelIndex } from './navigation'
test('editorial navigation clamps at both ends and ignores typing in forms', () => {
  expect(panelIndex(0, 'ArrowLeft', false)).toBe(0)
  expect(panelIndex(5, 'ArrowRight', false)).toBe(5)
  expect(panelIndex(2, 'ArrowRight', false)).toBe(3)
  expect(panelIndex(2, 'ArrowLeft', false)).toBe(1)
  expect(panelIndex(2, 'ArrowRight', true)).toBe(2)
  expect(panelIndex(2, 'Enter', false)).toBe(2)
})
