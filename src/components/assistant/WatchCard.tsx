import { useState } from 'react'
import type { Watch } from '../../analysis/watch'
import { fmtPct, fmtPp } from '../../data/format'
export function WatchCard({ watch, onChange, onAsk }: { watch: Watch; onChange: (watch: Watch) => void; onAsk: () => void }) {
  const [editing, setEditing] = useState(false)
  const [threshold, setThreshold] = useState(String(watch.threshold))
  const [owner, setOwner] = useState(watch.owner)
  const [channel, setChannel] = useState(watch.channel)
  return <section className="watch-card" data-testid="approval-card">
    <span className="approval-badge">APPROVAL REQUIRED</span><h3>Bevaka marginalen</h3>
    <p>Larma om bruttomarginalen understiger {fmtPct(watch.threshold, 0)} eller faller &gt; {fmtPp(watch.drop).replace('+', '')} mot föregående månad.</p>
    <p className="muted">{watch.channel} (simulerad) · {watch.owner} · {watch.frequency}</p>
    <details><summary>Policy för agentens befogenheter</summary><p><strong>AUTONOMOUS</strong> — läsa data och beräkna nyckeltal.</p><p><strong>POLICY-BOUNDED</strong> — ändra kort på din yta.</p><p><strong>APPROVAL REQUIRED</strong> — aktivera bevakningar. Kräver ditt uttryckliga godkännande.</p></details>
    {watch.status === 'Föreslagen' ? <>
      {editing && <form onSubmit={event => { event.preventDefault(); onChange({ ...watch, threshold: Number(threshold.replace(',', '.')), owner, channel }); setEditing(false) }}>
        <label>Tröskel (%)<input aria-label="Tröskel (%)" type="number" min="0" max="100" step="0.1" required value={threshold} onChange={event => setThreshold(event.target.value)} /></label>
        <label>Ägare<input required value={owner} onChange={event => setOwner(event.target.value)} /></label>
        <label>Kanal<select value={channel} onChange={event => setChannel(event.target.value as Watch['channel'])}><option>E-post</option><option>Slack</option></select></label>
        <button type="submit">Spara ändring</button>
      </form>}
      <div className="watch-actions"><button className="primary" onClick={() => onChange({ ...watch, status: 'Aktiv' })}>Godkänn</button><button onClick={() => onChange({ ...watch, status: 'Avvisad' })}>Avvisa</button><button onClick={() => setEditing(!editing)}>Ändra</button><button onClick={onAsk}>Fråga agenten</button></div>
    </> : <p>Status: <strong>{watch.status}</strong></p>}
  </section>
}
