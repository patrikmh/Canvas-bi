import type { ComponentType } from 'react'

export type UiId = `${number}${number}`
export type Step = { click: string } | { fill: [string, string] } | { press: string } | { drag: [string, number, number] } | { wait: string }
export interface UiDefinition {
  id: UiId
  name: string
  paradigm: string
  defaultTheme?: UiId
  hidden?: boolean
  Component: ComponentType
  shots: { interaction: Step[] }
  smoke: { openApproval: Step[] }
}
export type UiManifest = Omit<UiDefinition, 'Component'>
