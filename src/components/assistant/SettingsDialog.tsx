import { useEffect, useRef, useState } from 'react'
import { defaultSettings, LLM_STORAGE_KEY } from '../../analysis/llm'
import type { LlmSettings } from '../../analysis/llm'
export function SettingsDialog({ settings, onSave, onClose }: { settings: LlmSettings; onSave: (value: LlmSettings) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(settings)
  const [error, setError] = useState('')
  useEffect(() => { ref.current?.showModal() }, [])
  function save(value: LlmSettings) {
    try { localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(value)); onSave(value); onClose() } catch { setError('Webbläsaren tillåter inte lagring. Nyckeln kunde inte sparas.') }
  }
  return <dialog ref={ref} className="settings-dialog" data-testid="settings-llm" onCancel={onClose}>
    <header><h2>Inställningar</h2><button aria-label="Stäng inställningar" onClick={onClose}>×</button></header>
    <p>Assistenten fungerar utan nyckel. Aktivera valfritt LLM-läge för fritext.</p>
    <form onSubmit={event => { event.preventDefault(); save(draft) }}>
      <label><input type="checkbox" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} /> Använd LLM för fritext</label>
      <label>Leverantör<select value={draft.provider} onChange={event => setDraft({ ...draft, provider: event.target.value as LlmSettings['provider'] })}>{['OpenAI', 'Anthropic', 'OpenRouter'].map(provider => <option key={provider}>{provider}</option>)}</select></label>
      <label>Modell<input value={draft.model} required={draft.enabled} onChange={event => setDraft({ ...draft, model: event.target.value })} placeholder="Ange modellens namn" /></label>
      <label>API-nyckel<input type="password" autoComplete="off" value={draft.key} required={draft.enabled} onChange={event => setDraft({ ...draft, key: event.target.value })} /></label>
      <p className="muted">Nyckeln lagras bara i din webbläsare</p>
      <p className="muted">När du skickar fritext i LLM-läge skickas frågan och valt nyckeltal till leverantören. Siffrorna räknas i DuckDB.</p>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" onClick={() => { try { localStorage.removeItem(LLM_STORAGE_KEY); onSave(defaultSettings); setDraft(defaultSettings) } catch { setError('Nyckeln kunde inte rensas.') } }}>Rensa nyckeln</button><button className="primary" type="submit">Spara</button></footer>
    </form>
  </dialog>
}
