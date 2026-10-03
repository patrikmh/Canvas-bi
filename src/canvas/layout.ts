import type { Layout } from 'react-grid-layout'
import { verticalCompactor } from 'react-grid-layout/core'

export type Metric = 'revenue' | 'margin' | 'orders' | 'customers'
export type CardKind = 'kpi' | 'trend' | 'bars' | 'waterfall' | 'table' | 'insight' | 'text'
export interface CanvasCard { id: string; kind: CardKind; metric?: Metric; text?: string; product?: string }
export interface CanvasDocument { version: 1; cards: CanvasCard[]; layout: Layout }
export interface CanvasState { present: CanvasDocument; past: CanvasDocument[] }
export const STORAGE_KEY = 'canvas-bi:v1:layout'
const kinds: CardKind[] = ['kpi', 'trend', 'bars', 'waterfall', 'table', 'insight', 'text']
const metrics: Metric[] = ['revenue', 'margin', 'orders', 'customers']

export function defaultDocument(): CanvasDocument {
  return {
    version: 1,
    cards: [
      { id: 'insight', kind: 'insight' },
      ...metrics.map(metric => ({ id: `kpi-${metric}`, kind: 'kpi' as const, metric })),
      { id: 'trend-revenue', kind: 'trend', metric: 'revenue' },
      { id: 'trend-margin', kind: 'trend', metric: 'margin' },
      { id: 'waterfall', kind: 'waterfall' },
    ],
    layout: [
      { i: 'insight', x: 0, y: 0, w: 12, h: 10, minW: 6, minH: 10 },
      ...metrics.map((metric, index) => ({ i: `kpi-${metric}`, x: index * 3, y: 10, w: 3, h: 9, minW: 2, minH: 9 })),
      { i: 'trend-revenue', x: 0, y: 19, w: 6, h: 13, minW: 4, minH: 9 },
      { i: 'trend-margin', x: 6, y: 19, w: 6, h: 13, minW: 4, minH: 9 },
      { i: 'waterfall', x: 0, y: 32, w: 12, h: 13, minW: 6, minH: 10 },
    ],
  }
}

export function readDocument(raw: string | null): CanvasDocument {
  try {
    const doc = JSON.parse(raw ?? '') as CanvasDocument
    if (doc.version !== 1 || !Array.isArray(doc.cards) || !Array.isArray(doc.layout)) throw new Error('version')
    if (doc.cards.some(card => !card || typeof card.id !== 'string' || !kinds.includes(card.kind)
      || (card.metric != null && !metrics.includes(card.metric)) || (card.text != null && typeof card.text !== 'string')
      || (card.product != null && typeof card.product !== 'string'))) throw new Error('card')
    if (new Set(doc.cards.map(card => card.id)).size !== doc.cards.length || doc.cards.length !== doc.layout.length) throw new Error('ids')
    if (doc.layout.some(item => !item || !doc.cards.some(card => card.id === item.i)
      || ![item.x, item.y, item.w, item.h].every(Number.isFinite)
      || item.x < 0 || item.y < 0 || item.w < 1 || item.h < 1 || item.x + item.w > 12)) throw new Error('layout')
    if (new Set(doc.layout.map(item => item.i)).size !== doc.layout.length) throw new Error('layout ids')
    return doc
  } catch { return defaultDocument() }
}

export function initialState(document = defaultDocument()): CanvasState { return { present: document, past: [] } }
type Action =
  | { type: 'add'; card: CanvasCard; position?: { x: number; y: number } }
  | { type: 'remove'; id: string }
  | { type: 'layout'; layout: Layout }
  | { type: 'note'; id: string; text: string }
  | { type: 'clear' | 'reset' | 'undo' }

const geometry = (layout: Layout) => JSON.stringify(layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })).sort((a, b) => a.i.localeCompare(b.i)))

export function layoutReducer(state: CanvasState, action: Action): CanvasState {
  if (action.type === 'undo') return state.past.length ? { present: state.past.at(-1)!, past: state.past.slice(0, -1) } : state
  let present = state.present
  switch (action.type) {
    case 'add': {
      if (present.cards.some(card => card.id === action.card.id)) return state
      const small = action.card.kind === 'kpi'
      const h = action.card.kind === 'text' ? 7 : small ? 9 : 13
      const w = small ? 3 : action.card.kind === 'insight' ? 12 : 6
      const bottom = Math.max(0, ...present.layout.map(item => item.y + item.h))
      present = { ...present, cards: [...present.cards, action.card], layout: [...present.layout, {
        i: action.card.id, x: Math.min(action.position?.x ?? 0, 12 - w), y: action.position?.y ?? bottom, w, h, minW: small ? 2 : 4, minH: small ? 9 : action.card.kind === 'text' ? 6 : 10,
      }] }
      present = { ...present, layout: verticalCompactor.compact(present.layout, 12) }
      break
    }
    case 'remove': present = { ...present, cards: present.cards.filter(card => card.id !== action.id), layout: verticalCompactor.compact(present.layout.filter(item => item.i !== action.id), 12) }; break
    case 'layout':
      if (geometry(action.layout) === geometry(present.layout)) return state
      present = { ...present, layout: action.layout.map(item => ({ ...item })) }; break
    case 'note': present = { ...present, cards: present.cards.map(card => card.id === action.id ? { ...card, text: action.text } : card) }; break
    case 'clear': present = { version: 1, cards: [], layout: [] }; break
    case 'reset': present = defaultDocument(); break
  }
  if (JSON.stringify(present) === JSON.stringify(state.present)) return state
  return { present, past: [...state.past.slice(-49), state.present] }
}

export function toolbarLayout(layout: Layout, id: string, action: 'left' | 'right' | 'width'): Layout {
  const changed = layout.map(item => {
    if (item.i !== id) return { ...item }
    const w = action === 'width' ? item.w < 6 ? 6 : item.w < 12 ? 12 : 3 : item.w
    return { ...item, w, minW: action === 'width' ? Math.min(item.minW ?? 3, 3) : item.minW,
      x: Math.max(0, Math.min(12 - w, item.x + (action === 'left' ? -1 : action === 'right' ? 1 : 0))) }
  })
  return verticalCompactor.compact(changed, 12)
}
