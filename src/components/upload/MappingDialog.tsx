import { useEffect, useRef, useState } from 'react'
import type { CanonicalField, ColumnMapping } from '../../data/types'
import { detectMapping, mappingColumns, validateMapping } from '../../data/mapping'
import { fmtPct } from '../../data/format'
import type { ParsedData } from '../../data/upload'

export const fieldLabels: Record<CanonicalField, string> = {
  date: 'Datum', revenue: 'Omsättning', cost: 'Kostnad', qty: 'Antal', unit_price: 'Styckpris', unit_cost: 'Inköpspris',
  product: 'Produkt', customer_id: 'Kund', order_id: 'Order', channel: 'Kanal', region: 'Region',
}
export interface UploadDraft { name: string; parsed: ParsedData; mapping: ColumnMapping }

export function MappingDialog({ draft, onConfirm, onClose }: { draft: UploadDraft; onConfirm: (draft: UploadDraft) => Promise<void>; onClose: () => void }) {
  const suggested = useRef(detectMapping(draft.parsed.headers, draft.parsed.rows.slice(0, 50))).current
  const [mapping, setMapping] = useState<ColumnMapping>(() => draft.mapping)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const validation = validateMapping(mapping)
  useEffect(() => { dialog.current?.showModal() }, [])
  async function confirm() {
    setBusy(true); setError('')
    try { await onConfirm({ ...draft, mapping }); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setBusy(false) }
  }
  return <dialog ref={dialog} className="upload-dialog mapping-dialog" data-testid="upload-mapping" aria-labelledby="mapping-heading" onCancel={event => { if (busy) event.preventDefault(); else onClose() }}>
    <header><div><p className="eyebrow">DIN EGEN DATA</p><h2 id="mapping-heading">Koppla dina kolumner</h2><p>{draft.name} · Data stannar i din webbläsare</p></div><button aria-label="Stäng kolumnmappning" disabled={busy} onClick={onClose}>✕</button></header>
    <p>Kontrollera förslagen. Omsättning beräknas från belopp eller antal × styckpris. Kostnad beräknas från kostnad eller antal × inköpspris. Saknas antal används ett per rad.</p>
    <div className="mapping-fields">{(Object.keys(fieldLabels) as CanonicalField[]).map(field => <label key={field} title={suggested[field].reason}>
      <strong>{fieldLabels[field]}{field === 'date' ? ' *' : ''}</strong>
      <select aria-label={fieldLabels[field]} data-testid={`mapping-${field}`} value={mapping[field] ?? ''} disabled={busy} onChange={event => setMapping(current => ({ ...current, [field]: event.target.value || undefined }))}>
        <option value="">— saknas —</option>{draft.parsed.headers.map(header => <option value={header} key={header}>{header}</option>)}
      </select><small>{mapping[field] && mapping[field] === suggested[field].column ? `${fmtPct(suggested[field].confidence * 100, 0)} säkerhet · ${suggested[field].reason}` : mapping[field] ? 'Manuellt vald kolumn' : 'Ingen kolumn vald'}</small>
    </label>)}</div>
    <h3>Förhandsvisning · första åtta raderna</h3><div className="upload-preview"><table data-testid="upload-preview"><thead><tr>{draft.parsed.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{draft.parsed.rows.slice(0, 8).map((row, index) => <tr key={index}>{draft.parsed.headers.map((header, column) => <td key={header}>{row[column] ?? ''}</td>)}</tr>)}</tbody></table></div>
    {validation.problems.length > 0 && <p className="upload-warning" role="status">{validation.problems.join(' ')}</p>}
    {error && <p role="alert" className="negative">{error}</p>}
    <footer><button disabled={busy} onClick={onClose}>Avbryt</button><button className="primary" data-testid="confirm-upload" disabled={busy || !validation.ok} onClick={() => void confirm()}>{busy ? 'Läser in och beräknar…' : 'Bekräfta och analysera'}</button></footer>
  </dialog>
}

export function initialDraft(name: string, parsed: ParsedData): UploadDraft { return { name, parsed, mapping: mappingColumns(detectMapping(parsed.headers, parsed.rows.slice(0, 50))) } }
