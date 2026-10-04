import { useRef } from 'react'
import { fmtPct } from '../../../data/format'
import { clampLever } from './sim'

export function DragNumber({ value, onChange, label, testid, min, max }: { value: number; onChange: (value: number) => void; label: string; testid: string; min: number; max: number }) {
  const origin = useRef<{ x: number; value: number } | null>(null)
  return <button className="whatif-number" role="slider" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={fmtPct(value, 0)} aria-describedby="whatif-help" data-testid={testid}
    onPointerDown={event => { if (event.button !== 0) return; origin.current = { x: event.clientX, value }; event.currentTarget.setPointerCapture(event.pointerId) }}
    onPointerMove={event => { if (origin.current) onChange(clampLever(origin.current.value + (event.clientX - origin.current.x) / 4, min, max)) }}
    onPointerUp={() => { origin.current = null }} onPointerCancel={() => { origin.current = null }} onLostPointerCapture={() => { origin.current = null }}
    onKeyDown={event => {
      const step = event.shiftKey ? 5 : 1
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); onChange(clampLever(value + step, min, max)) }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); onChange(clampLever(value - step, min, max)) }
      if (event.key === 'Home') { event.preventDefault(); onChange(min) }
      if (event.key === 'End') { event.preventDefault(); onChange(max) }
    }}>{fmtPct(value, 0)}</button>
}
