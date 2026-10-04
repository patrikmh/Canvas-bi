import { useEffect, useRef, useState } from 'react'
import GridLayout from 'react-grid-layout/legacy'
import type { Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { Dashboard } from '../analysis/dashboard'
import type { CanvasCard, CanvasDocument, CardKind, Metric } from './layout'
import { toolbarLayout } from './layout'
import './canvas.css'
import { CardContent, cardTitle } from '../components/CardContent'
import type { Calculation } from '../components/CalculationDrawer'
import type { SqlEngine } from '../data/engine'
import { getTheme } from '../theme'

interface Props {
  staggerRebuild?: boolean
  document: CanvasDocument
  dashboard: Dashboard
  engine: SqlEngine
  selected: string | null
  onSelect: (id: string) => void
  onLayout: (layout: Layout) => void
  onRemove: (id: string) => void
  onAdd: (kind: CardKind, position?: { x: number; y: number }) => void
  onDrill: (metric: Metric, products?: boolean, product?: string) => void
  onHow: (calculation: Calculation) => void
  onExplain: () => void
  onWatch: () => void
  onNote: (id: string, text: string) => void
}
export function Canvas(props: Props) {
  // Capture rebuild delays once. Cards added later always enter immediately.
  const entranceDelays = useRef(new Map(props.document.cards.map((card, index) => [card.id, props.staggerRebuild ? index * 70 : 0])))
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [mobile, setMobile] = useState(window.innerWidth < 900)
  useEffect(() => {
    const observer = new ResizeObserver(entries => { setWidth(entries[0].contentRect.width); setMobile(window.innerWidth < 900) })
    observer.observe(container.current!)
    return () => observer.disconnect()
  }, [])
  const shift = (card: CanvasCard, amount: number) => props.onLayout(toolbarLayout(props.document.layout, card.id, amount < 0 ? 'left' : 'right'))
  const cards = props.document.cards.map(card => <div key={card.id} className={`canvas-card kind-${card.kind} ${card.kind === 'insight' ? 'insight-card' : ''} ${props.selected === card.id ? 'selected' : ''}${getTheme().kpiStyle === 'table' ? ` metric-${card.metric}` : ''}`}
    style={{ animationDelay: `${entranceDelays.current.get(card.id) ?? 0}ms` }} data-testid={`card-${card.id}`}  data-card-id={card.id} tabIndex={0} onFocus={event => { if (event.target === event.currentTarget) props.onSelect(card.id) }} onClick={event => { if (!(event.target as HTMLElement).closest('button,input,textarea')) props.onSelect(card.id) }}
    onDoubleClick={event => { if (!(event.target as HTMLElement).closest('button,input,textarea')) props.onDrill(card.metric ?? (card.kind === 'waterfall' ? 'margin' : 'revenue'), card.kind === 'bars' || card.kind === 'table') }}>
    <div className="card-toolbar" aria-label={`Verktyg för ${cardTitle(card)}`}>
      <button className="toolbar-button" aria-label={`Flytta ${cardTitle(card)} åt vänster`} onClick={() => shift(card, -1)}>‹</button>
      <button className="toolbar-button" aria-label={`Flytta ${cardTitle(card)} åt höger`} onClick={() => shift(card, 1)}>›</button>
      <button className="toolbar-button" aria-label={`Ändra storlek på ${cardTitle(card)}`} onClick={() => props.onLayout(toolbarLayout(props.document.layout, card.id, 'width'))}>↔</button>
      <button className="toolbar-button" aria-label={`Ta bort ${cardTitle(card)}`} data-testid={`remove-${card.id}`} onClick={() => props.onRemove(card.id)}>✕</button>
    </div>
    <div className="card-heading"><span className="drag-handle" aria-label={`Dra ${cardTitle(card)}`} title="Dra för att flytta" onPointerDown={() => props.onSelect(card.id)}>⠿</span><h3 className="card-title">{cardTitle(card)}</h3></div>
    <CardContent card={card} dashboard={props.dashboard} engine={props.engine} onDrill={props.onDrill} onHow={props.onHow} onExplain={props.onExplain} onWatch={props.onWatch} onNote={props.onNote} />
  </div>)
  return <div ref={container} className={`canvas-grid${getTheme().kpiStyle === 'table' ? ' kpi-table-layout' : ''}`} data-testid="canvas" onDragOverCapture={event => event.preventDefault()}
    onDropCapture={event => {
      const kind = event.dataTransfer.getData('application/canvas-card') as CardKind
      if (!['kpi', 'trend', 'bars', 'waterfall', 'table', 'insight', 'text'].includes(kind)) return
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      props.onAdd(kind, mobile ? undefined : { x: Math.max(0, Math.floor((event.clientX - rect.left) / (width / 12))), y: Math.max(0, Math.floor((event.clientY - rect.top) / 26)) })
    }}>
    {!cards.length && <div className="empty-canvas"><span aria-hidden="true">＋</span><h2>En tom yta, nya möjligheter.</h2><p>Lägg till en komponent från menyn eller återställ demon.</p></div>}
    {mobile ? <div className="mobile-cards">{cards}</div> : <GridLayout width={width} cols={12} rowHeight={14} margin={[16, 12]} containerPadding={[0, 0]}
      layout={props.document.layout} compactType="vertical" draggableHandle=".drag-handle" draggableCancel="button,input,textarea,.how-button" isDroppable
      droppingItem={{ i: '__drop', x: 0, y: 0, w: 6, h: 13 }}
      onDragStop={layout => props.onLayout(layout)} onResizeStop={layout => props.onLayout(layout)}
      >{cards}</GridLayout>}
  </div>
}
