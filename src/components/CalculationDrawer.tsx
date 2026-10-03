import { useEffect, useRef, useState } from 'react'

export interface Calculation { id: string; title: string; formula: string; sql: string; value: string }
export function CalculationDrawer({ calculation, onClose }: { calculation: Calculation; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close() }, [])
  return <dialog ref={dialog} className="calculation-drawer" onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose() }} aria-labelledby="calculation-title" data-testid="calculation-drawer">
    <header><div><p className="eyebrow">Hur räknas detta?</p><h2 id="calculation-title">{calculation.title}</h2></div><button onClick={onClose} aria-label="Stäng beräkningen">✕</button></header>
    <p>{calculation.formula}</p><div className="calculation-result"><span>Resultat</span><strong>{calculation.value}</strong></div>
    <div className="sql-heading"><h3>Exakt SQL</h3><button onClick={async () => { try { await navigator.clipboard.writeText(calculation.sql); setCopied(true) } catch { setCopied(false) } }}>{copied ? 'Kopierat' : 'Kopiera SQL'}</button></div>
    <pre tabIndex={0}>{calculation.sql}</pre><p className="muted">Beräknat lokalt från demonstrationsdata. Alla värden kommer från DuckDB.</p>
  </dialog>
}
