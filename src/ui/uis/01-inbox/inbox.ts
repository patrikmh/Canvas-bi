export type InboxState = 'Öppen' | 'Snoozad' | 'Klar' | 'Avfärdad'
export const states: InboxState[] = ['Öppen', 'Snoozad', 'Klar', 'Avfärdad']
export function decisionTitle(tool: string, products: string[]) {
  const names = products.join(' och ')
  if (tool === 'unitEconomics') return names ? `Omförhandla inköpspriset på ${names}` : 'Granska inköpspriserna'
  if (tool === 'marginWaterfall') return names ? `Granska produktbidragen för ${names}` : 'Granska produktbidragen'
  if (tool === 'scanKpis') return 'Prioritera bruttomarginalen i dagens beslut'
  if (tool === 'findLatestChange') return 'Kontrollera när marginalfallet började'
  if (tool === 'reconcileWaterfall') return 'Stäm av underlaget före beslut'
  return 'Granska analysunderlaget'
}
export function itemState(review: string | undefined, snoozed: boolean): InboxState {
  return review === 'accepted' ? 'Klar' : review === 'rejected' ? 'Avfärdad' : snoozed ? 'Snoozad' : 'Öppen'
}
export function countStates(items: InboxState[]) {
  return Object.fromEntries(states.map(state => [state, items.filter(item => item === state).length])) as Record<InboxState, number>
}
export const moveSelection = (index: number, direction: number, count: number) => Math.max(0, Math.min(Math.max(0, count - 1), index + direction))
