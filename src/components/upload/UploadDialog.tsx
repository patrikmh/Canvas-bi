import { useEffect, useRef, useState } from 'react'
import { parseUploadCsv, parseUploadXlsx } from './parseFile'
import { initialDraft } from './MappingDialog'
import type { UploadDraft } from './MappingDialog'
import './upload.css'

export function UploadDialog({ onParsed, onClose }: { onParsed: (draft: UploadDraft) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [over, setOver] = useState(false)
  useEffect(() => { dialog.current?.showModal() }, [])
  async function read(file?: File) {
    if (!file || busy) return
    setError(''); setBusy(true)
    try {
      const extension = file.name.split('.').at(-1)?.toLowerCase()
      if (extension !== 'csv' && extension !== 'xlsx') throw new Error('Välj en CSV- eller XLSX-fil.')
      const parsed = extension === 'xlsx' ? await parseUploadXlsx(await file.arrayBuffer()) : parseUploadCsv(await file.text())
      onParsed(initialDraft(file.name, parsed))
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setBusy(false) }
  }
  return <dialog ref={dialog} className="upload-dialog" data-testid="upload-dialog" aria-labelledby="upload-heading" onCancel={onClose}>
    <header><div><p className="eyebrow">DIN EGEN DATA</p><h2 id="upload-heading">Ladda upp data</h2></div><button aria-label="Stäng uppladdning" onClick={onClose}>✕</button></header>
    <p>Data stannar i din webbläsare. Vi läser filen lokalt och låter dig kontrollera kolumnerna innan analysen börjar.</p>
    <label className={`upload-dropzone ${over ? 'is-over' : ''}`} data-testid="upload-dropzone" onDragOver={event => { event.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={event => { event.preventDefault(); setOver(false); void read(event.dataTransfer.files[0]) }}>
      <span aria-hidden="true">↑</span><strong>{busy ? 'Läser filen…' : 'Släpp din fil här eller välj en fil'}</strong><small>CSV eller Excel (.xlsx) · första kalkylbladet</small>
      <input type="file" aria-label="Välj datafil" data-testid="upload-file" accept=".csv,.xlsx" disabled={busy} onChange={event => void read(event.target.files?.[0])} />
    </label>
    {error && <p role="alert" className="negative">{error}</p>}
    <footer><button onClick={onClose}>Avbryt</button></footer>
  </dialog>
}
