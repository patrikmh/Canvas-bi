import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeTheme } from './theme'
import { requestedUi, UiRoot } from './ui'
import { initializeUiTheme } from './ui/theme'

const ui = requestedUi()
if (ui) initializeUiTheme(ui)
else initializeTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {ui ? <UiRoot def={ui} /> : <App />}
  </StrictMode>,
)
