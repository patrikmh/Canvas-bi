import { useState } from 'react'
import type { CardKind } from '../canvas/layout'

export const paletteItems: { kind: CardKind; title: string; subtitle: string; icon: string }[] = [
  { kind: 'kpi', title: 'Nyckeltal', subtitle: 'Ett tal jämfört med i fjol', icon: '▰' },
  { kind: 'trend', title: 'Trend', subtitle: 'Utveckling månad för månad', icon: '⌁' },
  { kind: 'bars', title: 'Staplar', subtitle: 'Jämför produkter', icon: '☰' },
  { kind: 'waterfall', title: 'Förklaring', subtitle: 'Vad som driver en förändring', icon: '▥' },
  { kind: 'table', title: 'Tabell', subtitle: 'Exakta värden per produkt', icon: '▤' },
  { kind: 'insight', title: 'Insikt', subtitle: 'Det viktigaste i klartext', icon: '≡' },
  { kind: 'text', title: 'Text', subtitle: 'Rubrik eller anteckning', icon: 'T' },
]

export function Palette({ onAdd }: { onAdd: (kind: CardKind) => void }) {
  const [open, setOpen] = useState(false)
  return <aside className={`palette ${open ? 'is-open' : ''}`} aria-label="Komponenter">
    <div className="brand"><h2>Canvas BI</h2><p>DemoCo AB</p></div>
    <button className="palette-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>Komponenter <span>{open ? '−' : '+'}</span></button>
    <div className="palette-content"><h3>Komponenter</h3>
      {paletteItems.map(item => <button key={item.kind} data-testid={`palette-${item.kind}`} className="palette-item" draggable onClick={() => onAdd(item.kind)}
        onDragStart={event => { event.dataTransfer.setData('application/canvas-card', item.kind); event.dataTransfer.setData('text/plain', item.kind); event.dataTransfer.effectAllowed = 'copy' }}>
        <span className={`palette-icon icon-${item.kind}`} aria-hidden="true"><PaletteIcon kind={item.kind} /></span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
      </button>)}
      <p className="palette-hint">Dra en komponent till ytan<br /><span>eller klicka för att lägga till.</span></p>
    </div>
    <div className="palette-footer"><span className="local-dot" /> Data stannar i din webbläsare</div>
  </aside>
}

function PaletteIcon({ kind }: { kind: CardKind }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
    {kind === 'kpi' ? <><rect x="4" y="5" width="16" height="6" rx="1" className="palette-icon-actual" fill="#1d4f5a" /><rect x="4" y="15" width="10" height="3" rx="1" className="palette-icon-good" fill="#2f7d4f" /></>
      : kind === 'trend' ? <path d="M3 18 8 12 12 14 17 6 21 8" className="palette-icon-actual" stroke="#1d4f5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        : kind === 'bars' ? <><path d="M4 5h16M4 10h12M4 15h8" className="palette-icon-actual" stroke="#1d4f5a" strokeWidth="3" /><path d="M4 20h6" className="palette-icon-bad" stroke="#b3263a" strokeWidth="3" /></>
          : kind === 'waterfall' ? <><rect x="3" y="5" width="4" height="15" className="palette-icon-actual" fill="#1d4f5a" /><rect x="9" y="5" width="4" height="6" className="palette-icon-bad" fill="#b3263a" /><rect x="15" y="11" width="4" height="5" className="palette-icon-bad" fill="#b3263a" /><path d="M7 6h2m4 6h2" className="palette-icon-rule" stroke="#9aa9a0" /></>
            : kind === 'table' ? <><path d="M3 5h18M3 10h18M3 15h18M3 20h18M10 3v19" className="palette-icon-rule" stroke="#9aa9a0" strokeWidth="1.5" /></>
              : kind === 'insight' ? <path d="M3 6h18M3 11h15M3 16h18M3 21h10" className="palette-icon-ink" stroke="#35433d" strokeWidth="2" />
                : <text x="6" y="19" className="palette-icon-ink" fill="#35433d" fontSize="19" fontFamily="Arial">T</text>}
  </svg>
}
