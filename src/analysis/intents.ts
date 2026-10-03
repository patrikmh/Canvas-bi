import type { CardKind, Metric } from '../canvas/layout'
export type IntentKind = 'margin' | 'explain' | 'revenue' | 'marginProducts' | 'revenueProducts' | 'watch' | 'rebuild' | 'add' | 'remove' | 'monthMargin' | 'formula' | 'unknown'
export interface Intent { kind: IntentKind; card?: CardKind; metric?: Metric; month?: number }
export const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function matchIntent(text: string, context?: Metric): Intent {
  const q = normalize(text)
  const metric: Metric = /marginal|margin/.test(q) ? 'margin' : /order|ordrar/.test(q) ? 'orders' : /kund|customer/.test(q) ? 'customers' : /omsatt|forsalj|revenue|sales/.test(q) ? 'revenue' : context ?? 'revenue'
  const kinds: [RegExp, CardKind][] = [[/tabell|table/, 'table'], [/trend/, 'trend'], [/staplar|bars/, 'bars'], [/forklaring|waterfall/, 'waterfall'], [/insikt|insight/, 'insight'], [/text|note/, 'text'], [/nyckeltal|kpi/, 'kpi']]
  const card = kinds.find(([pattern]) => pattern.test(q))?.[1]
  if (/lagg till|add\b/.test(q)) return card ? { kind: 'add', card, metric } : { kind: 'unknown' }
  if (/ta bort|remove|delete/.test(q)) return { kind: 'remove', card, metric }
  if (/hur raknas|how.*calculat|formula|beraknas/.test(q)) return { kind: 'formula', metric }
  if (/bevaka|watch|larma|monitor/.test(q)) return { kind: 'watch' }
  if (/bygg|build|ledningsvy|dashboard/.test(q)) return { kind: 'rebuild' }
  if (/varfor|why|forklara|marginalfall/.test(q)) return { kind: 'explain', metric }
  if (/per produkt|by product/.test(q)) return { kind: metric === 'margin' ? 'marginProducts' : 'revenueProducts', metric }
  const months = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
  const month = months.findIndex(m => new RegExp(`\\b${m}\\b`).test(q)) + 1
  if (month) return { kind: 'monthMargin', month, metric }
  if (context && /jamfor|compare|mot.*fjol|last year/.test(q)) return { kind: metric === 'margin' ? 'margin' : 'revenue', metric }
  if (metric === 'margin' && /visa|utforska|explore|margin|marginal/.test(q)) return { kind: 'margin' }
  if (/omsatt|forsalj|revenue|sales/.test(q)) return { kind: 'revenue' }
  return { kind: 'unknown' }
}
