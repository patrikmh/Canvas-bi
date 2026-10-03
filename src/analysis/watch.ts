export interface Watch { id: string; threshold: number; drop: number; channel: 'E-post' | 'Slack'; owner: string; frequency: 'Dagligen'; status: 'Föreslagen' | 'Aktiv' | 'Avvisad'; alert?: string }
export function watchTriggers(watch: Watch, margin: number | null, previous: number | null) {
  return watch.status === 'Aktiv' && margin != null && (margin < watch.threshold || (previous != null && previous - margin > watch.drop))
}
