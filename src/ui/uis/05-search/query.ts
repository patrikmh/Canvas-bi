import { matchIntent, normalize } from '../../../analysis/intents'
import { shiftMonth } from '../../../analysis/dashboard'
import { literal } from '../../../data/sql'

export interface SearchQuery { metric: 'margin' | 'revenue'; group: 'total' | 'products'; period: 1 | 3 | 6; compare: 'year' | 'none'; monthNumber?: number }
const words = new Set(`visa utforska jamfor forklara varfor vad hur ar har for med mot samma period i fjol per produkt produkter hela butiken senaste manaden manad manader manaderna utan jamforelse forra aret andrades andrats utvecklats utveckling trend bruttomarginal bruttomarginalen marginal marginalen omsattning omsattningen forsaljning forsaljningen januari februari mars april maj juni juli augusti september oktober november december margin revenue sales show explore by product compare with same last months month year why explain`.split(' '))
export function parseQuestion(text: string): SearchQuery | null {
  const intent = matchIntent(text), q = normalize(text)
  const metric = intent.metric ?? (intent.kind === 'margin' ? 'margin' : intent.kind === 'revenue' ? 'revenue' : undefined)
  if (!/marginal|margin|omsatt|forsalj|revenue|sales/.test(q)) return null
  if (!['margin', 'revenue', 'marginProducts', 'revenueProducts', 'monthMargin', 'explain'].includes(intent.kind) || !['margin', 'revenue'].includes(metric ?? '')) return null
  if (/region|kanal|b2b|exklu|utom|budget|prognos|nasta|framtid|veck|dag|\b20\d{2}\b|order|ordrar|kund|retur/.test(q)) return null
  const periodMatch = q.match(/(?:senaste|last)\s+(\d+)\s+(?:manad|month)/)
  if (q.replace(/[?.,;:!·]/g, ' ').split(/\s+/).filter(Boolean).some(word => !words.has(word) && !(periodMatch && word === periodMatch[1]))) return null
  const period = periodMatch ? Number(periodMatch[1]) : intent.kind === 'monthMargin' ? 1 : 3
  if (![1, 3, 6].includes(period)) return null
  return { metric: metric as SearchQuery['metric'], group: /per produkt|by product/.test(q) ? 'products' : 'total', period: period as SearchQuery['period'], compare: /utan jamforelse/.test(q) ? 'none' : 'year', ...(intent.month ? { monthNumber: intent.month } : {}) }
}
export const visibleMonths = (months: string[], month: string, period: number) => months.filter(value => value <= month).slice(-period)
export function sourceSql(sql: string, months: string[], compare: SearchQuery['compare']) {
  const selected = compare === 'year' ? [...months, ...months.map(month => shiftMonth(month, -12))] : months
  return `SELECT * FROM (${sql}) AS monthly WHERE month IN (${selected.map(literal).join(', ')}) ORDER BY month`
}
