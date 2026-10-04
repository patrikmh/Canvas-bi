import { createRegistry, resolveUi } from './registry'
import type { UiDefinition, UiManifest } from './types'
export type { UiDefinition, UiManifest, UiId, Step } from './types'
export { readUiId } from './registry'
export { UiRoot } from './UiRoot'

export const uis = createRegistry(import.meta.glob<{ default: UiDefinition }>('./uis/*/index.tsx', { eager: true }))
export const uiManifest: UiManifest[] = Object.values(uis).map(({ Component: _Component, ...metadata }) => metadata).sort((a, b) => a.id.localeCompare(b.id))
export function requestedUi(search = location.search) { return resolveUi(search, uis) }
