import type { UiDefinition } from './types'
import { AnalystSessionProvider, useAnalystSession } from './session'
import { UiChrome } from './blocks'
import { uiManifest } from './index'
import './ui.css'

function ReadyUi({ def }: { def: UiDefinition }) {
  const session = useAnalystSession()
  return <div className="ui-root" data-testid="ui-root" data-ui={def.id} data-ready={session.ready ? 'true' : 'false'} data-ui-registry={JSON.stringify(uiManifest)}>
    <UiChrome name={def.name}>
      {session.error ? <p role="alert">Data eller analys kunde inte läsas: {session.error} <button onClick={() => location.reload()}>Försök igen</button></p> : !session.dashboard ? <p role="status">Läser demonstrationsdata och beräknar nyckeltal…</p> : <def.Component />}
    </UiChrome>
  </div>
}
export function UiRoot({ def }: { def: UiDefinition }) {
  return <AnalystSessionProvider><ReadyUi def={def} /></AnalystSessionProvider>
}
