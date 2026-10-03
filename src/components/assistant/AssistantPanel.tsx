import { useState } from 'react'
import type { ReactNode } from 'react'

export interface AssistantMessage { id: string; role: 'assistant' | 'user'; content: ReactNode }
export interface AssistantChip { id: string; label: string }
export interface AssistantPanelProps {
  messages: AssistantMessage[]
  chips: AssistantChip[]
  onSend?: (message: string) => void
  onChip?: (id: string) => void
}

export function AssistantPanel({ messages, chips, onSend, onChip }: AssistantPanelProps) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  return <>
    <button className="assistant-toggle primary" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="assistant-panel">{open ? 'Stäng assistenten' : 'Assistent'}</button>
    <aside id="assistant-panel" className={`assistant-panel ${open ? 'is-open' : ''}`} aria-label="Assistent">
      <header className="assistant-heading"><h2>Assistent</h2><p>Bygger och förklarar utifrån dina nyckeltal</p></header>
      <div className="assistant-messages" role="log" aria-live="polite">
        {messages.map(message => <div key={message.id} className={`assistant-message ${message.role}`}>{message.content}</div>)}
      </div>
      <div className="assistant-chips">{chips.map(chip => <button className="chip" key={chip.id} onClick={() => onChip?.(chip.id)}>{chip.label}</button>)}</div>
      <form className="assistant-input" onSubmit={event => { event.preventDefault(); if (input.trim()) { onSend?.(input.trim()); setInput('') } }}>
        <input aria-label="Fråga eller be mig ändra något" placeholder="Fråga eller be mig ändra något" value={input} onChange={event => setInput(event.target.value)} />
        <button className="primary" type="submit">Skicka</button>
      </form>
    </aside>
  </>
}
