// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ setOption: vi.fn(), on: vi.fn(), dispose: vi.fn(), resize: vi.fn(), init: vi.fn() }))
vi.mock('echarts/core', () => ({ use: vi.fn(), init: mocks.init }))
import { Chart } from './Chart'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })
test('chart initializes once, updates options separately and uses the latest product callback', () => {
  mocks.init.mockReturnValue(mocks)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const first = vi.fn(), latest = vi.fn()
  const option = { series: [] }
  const { rerender, unmount } = render(<Chart option={option} label="Produkter" onProduct={first} />)
  rerender(<Chart option={option} label="Valt kort" onProduct={latest} />)
  expect(mocks.init).toHaveBeenCalledTimes(1)
  expect(mocks.setOption).toHaveBeenCalledTimes(1)
  mocks.on.mock.calls[0][1]({ name: 'Ullfilt' })
  expect(latest).toHaveBeenCalledWith('Ullfilt')
  expect(first).not.toHaveBeenCalled()
  rerender(<Chart option={{ series: [] }} label="Produkter" />)
  expect(mocks.setOption).toHaveBeenLastCalledWith(expect.anything(), true)
  expect(mocks.init).toHaveBeenCalledTimes(1)
  unmount()
  expect(mocks.dispose).toHaveBeenCalledTimes(1)
})
