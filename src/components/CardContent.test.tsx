// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { Note } from './CardContent'

afterEach(() => { cleanup(); vi.useRealTimers() })
test('note saves after 400 ms idle and flushes the latest edit on unmount', () => {
  vi.useFakeTimers()
  const save = vi.fn()
  const { getByRole, unmount, rerender } = render(<Note card={{ id: 'note', kind: 'text' }} onNote={save} />)
  fireEvent.change(getByRole('textbox'), { target: { value: 'Första' } })
  act(() => vi.advanceTimersByTime(399))
  expect(save).not.toHaveBeenCalled()
  fireEvent.change(getByRole('textbox'), { target: { value: 'Andra' } })
  rerender(<Note card={{ id: 'note', kind: 'text' }} onNote={save} />)
  act(() => vi.advanceTimersByTime(400))
  expect(save).toHaveBeenCalledExactlyOnceWith('note', 'Andra')
  fireEvent.change(getByRole('textbox'), { target: { value: 'Sista' } })
  unmount()
  expect(save).toHaveBeenLastCalledWith('note', 'Sista')
  act(() => vi.advanceTimersByTime(400))
  expect(save).toHaveBeenCalledTimes(2)
})
