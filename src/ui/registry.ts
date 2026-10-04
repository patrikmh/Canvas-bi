import type { UiDefinition } from './types'

export function readUiId(search = typeof location === 'undefined' ? '' : location.search): string | null {
  const id = new URLSearchParams(search).get('ui')
  return id && /^(0[1-9]|[1-9][0-9])$/.test(id) ? id : null
}
export function createRegistry(modules: Record<string, { default: UiDefinition }>): Readonly<Record<string, UiDefinition>> {
  const registry: Record<string, UiDefinition> = {}
  for (const [path, { default: def }] of Object.entries(modules)) {
    if (readUiId(`?ui=${def.id}`) !== def.id || path.match(/\/([0-9]{2})-[^/]+\/index\.tsx$/)?.[1] !== def.id) throw new Error(`UI folder does not match definition: ${path}`)
    if (registry[def.id]) throw new Error(`Duplicate UI id: ${def.id}`)
    registry[def.id] = def
  }
  return Object.freeze(registry)
}
export function resolveUi(search: string, registry: Readonly<Record<string, UiDefinition>>): UiDefinition | null {
  const id = readUiId(search)
  return id ? registry[id] ?? null : null
}
