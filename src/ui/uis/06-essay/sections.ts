export type FigureId = 'trend' | 'break' | 'waterfall' | 'economics'
export function activeSection(sections: { id: FigureId; top: number }[], readingLine: number): FigureId {
  return sections.filter(section => section.top <= readingLine).at(-1)?.id ?? sections[0]?.id ?? 'trend'
}
export function samePeriods(before: string[], after: string[], actualBefore: string[], actualAfter: string[]) {
  return before.length > 0 && after.length > 0 && before.join() === actualBefore.join() && after.join() === actualAfter.join()
}
