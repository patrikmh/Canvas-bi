import { useId, useState } from 'react'
import { getTheme } from './index'
import { buildThemeUrl, themeOptions } from './picker'
import './picker.css'

function selectedTheme() {
  return themeOptions.find(theme => theme.id === getTheme().id) ?? themeOptions[0]
}

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const id = useId()
  return <div className={`theme-picker${compact ? ' theme-picker-compact' : ''}`}>
    <label htmlFor={id}>Utseende{compact ? ':' : ''}</label>
    <select id={id} data-testid="theme-picker" value={selectedTheme().id} autoFocus={compact}
      onChange={event => window.location.assign(buildThemeUrl(window.location.href, event.target.value))}>
      {themeOptions.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
    </select>
  </div>
}

export function ThemeFooter() {
  const [open, setOpen] = useState(false)
  return <div className="theme-footer">
    {open ? <ThemePicker compact /> : <button className="theme-footer-toggle" onClick={() => setOpen(true)}>
      Utseende: {selectedTheme().name} ▾
    </button>}
  </div>
}
