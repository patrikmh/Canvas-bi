export function previousPeriod(before: string[], months: string[], current: string) {
  return before.filter(month => month < current).sort().at(-1) ?? months.filter(month => month < current).sort().at(-1) ?? null
}
export function canMerge(reviews: string[], watchStatus: string | undefined, reviewer: string) {
  return reviews.length > 0 && reviews.every(review => review === 'accepted') && watchStatus === 'Aktiv' && !!reviewer.trim()
}
