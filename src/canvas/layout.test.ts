import { describe, expect, test } from 'vitest'
import { defaultDocument, initialState, layoutReducer, readDocument } from './layout'

describe('layout reducer and undo history', () => {
  test('add, remove, clear and reset are individually undoable', () => {
    const initial = initialState()
    const card = { id: 'note-1', kind: 'text' as const, text: '' }
    const added = layoutReducer(initial, { type: 'add', card })
    expect(added.present.cards.at(-1)).toEqual(card)
    expect(layoutReducer(added, { type: 'undo' }).present).toEqual(initial.present)
    const removed = layoutReducer(added, { type: 'remove', id: card.id })
    expect(removed.present.cards).not.toContainEqual(card)
    expect(layoutReducer(removed, { type: 'undo' }).present).toEqual(added.present)
    const cleared = layoutReducer(removed, { type: 'clear' })
    expect(cleared.present.cards).toEqual([])
    expect(cleared.present.layout).toEqual([])
    const reset = layoutReducer(cleared, { type: 'reset' })
    expect(reset.present).toEqual(defaultDocument())
    expect(layoutReducer(reset, { type: 'undo' }).present).toEqual(cleared.present)
  })

  test('move and resize commit one history entry, ignore unchanged layouts, and undo exactly', () => {
    const initial = initialState()
    expect(layoutReducer(initial, { type: 'layout', layout: initial.present.layout })).toBe(initial)
    const moved = initial.present.layout.map(item => item.i === 'insight' ? { ...item, x: 1, w: 10, h: 12 } : item)
    const state = layoutReducer(initial, { type: 'layout', layout: moved })
    expect(state.past).toHaveLength(1)
    expect(state.present.layout[0]).toMatchObject({ x: 1, w: 10, h: 12 })
    expect(layoutReducer(state, { type: 'undo' }).present).toEqual(initial.present)
    expect(layoutReducer(initial, { type: 'undo' })).toBe(initial)
  })

  test('notes are persisted and editable with undo; invalid or incompatible storage restores the demo', () => {
    const initial = initialState()
    const added = layoutReducer(initial, { type: 'add', card: { id: 'note', kind: 'text', text: 'Mötet' } })
    const edited = layoutReducer(added, { type: 'note', id: 'note', text: 'Nästa möte' })
    expect(readDocument(JSON.stringify(edited.present))).toEqual(edited.present)
    expect(layoutReducer(edited, { type: 'undo' }).present).toEqual(added.present)
    for (const raw of [null, '{', '{}', '{"version":2}', '{"version":1,"cards":[],"layout":[{}]}']) {
      expect(readDocument(raw)).toEqual(defaultDocument())
    }
    expect(readDocument(JSON.stringify({ ...initial.present, cards: [{ id: 'x', kind: 'unknown' }] }))).toEqual(defaultDocument())
  })

  test('adding a chart records its metric and places it below existing cards without overlap', () => {
    const initial = initialState()
    const state = layoutReducer(initial, { type: 'add', card: { id: 'bars-margin', kind: 'bars', metric: 'margin' } })
    const placement = state.present.layout.at(-1)!
    expect(placement.y).toBeGreaterThanOrEqual(Math.max(...initial.present.layout.map(item => item.y + item.h)))
    expect(state.present.cards.at(-1)?.metric).toBe('margin')
  })
})
