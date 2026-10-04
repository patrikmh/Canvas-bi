import type { AgentResult, TraceStep } from '../../analysis/agent'
import type { Activity } from '../../analysis/activity'
import { fmtMonth } from '../../data/format'

export type FindingReview = 'pending' | 'accepted' | 'edited' | 'rejected'
export interface MemoFinding { number: number; text: string; step: TraceStep; citations: TraceStep[] }
export function deriveFindings(result: AgentResult | null): MemoFinding[] {
  if (!result) return []
  return result.steps.flatMap((step, index) => {
    if ((step.status !== 'done' && step.status !== 'failed') || !step.summary) return []
    const share = step.tool === 'marginWaterfall' ? result.text.match(/Ungefär[^.]*\./)?.[0] : undefined
    const verification = share && result.steps.find(item => item.tool === 'reconcileWaterfall' && item.status === 'done')
    return [{ number: index + 1, text: [step.summary, share].filter(Boolean).join(' '), step,
      citations: verification ? [step, verification] : [step] }]
  })
}
export function memoStatus(reviews: FindingReview[], watchApproved: boolean, complete: boolean) {
  if (!complete) return 'Utkast'
  if (reviews.includes('rejected')) return 'Returnerad'
  if (watchApproved || (reviews.length > 0 && reviews.every(value => value === 'accepted'))) return 'Godkänd'
  return reviews.some(value => value !== 'pending') ? 'Granskas' : 'Utkast'
}
export function confidenceNote(confidence: string, month: string) {
  if (confidence.startsWith('Låg')) return 'Låg: för få datapunkter – samla mer data.'
  if (confidence.startsWith('Hög')) return `Säker: avstämt underlag t.o.m. ${fmtMonth(month)}. Nästa steg: granska produktbidragen och besluta om uppföljning.`
  return `Preliminär: ${confidence || 'underlag inväntas'}; kör om när månaden är stängd och kontrollera underlaget.`
}
export function runIdentity(activities: Activity[]) {
  const runs = activities.filter(item => item.action === 'Analys startad')
  return { number: runs.length, time: runs.at(-1)?.timestamp ?? '—', id: runs.at(-1)?.id ?? 'pending' }
}
export function stepInput(step: TraceStep): Record<string, unknown> {
  return step.input && typeof step.input === 'object' ? step.input as Record<string, unknown> : {}
}
export const findingNumber = (number: number) => number <= 20 ? String.fromCodePoint(0x2460 + number - 1) : String(number)

/** Trace tools can contain several SELECT statements. Preserve quoted semicolons. */
export function sqlStatements(sql: string): string[] {
  let start = 0, quote = '', comment = ''
  const statements: string[] = []
  for (let index = 0; index < sql.length; index++) {
    const character = sql[index], next = sql[index + 1]
    if (comment === 'line') { if (character === '\n') comment = ''; continue }
    if (comment === 'block') { if (character === '*' && next === '/') { comment = ''; index++ } continue }
    if (quote) {
      if (character === quote) { if (next === quote) index++; else quote = '' }
      continue
    }
    if (character === '-' && next === '-') { comment = 'line'; index++; continue }
    if (character === '/' && next === '*') { comment = 'block'; index++; continue }
    if (character === "'" || character === '"') { quote = character; continue }
    if (character === ';') { const statement = sql.slice(start, index).trim(); if (statement) statements.push(statement); start = index + 1 }
  }
  const last = sql.slice(start).trim()
  if (last) statements.push(last)
  return statements
}
