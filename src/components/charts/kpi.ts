/** Display coordinates only; financial values and variances come from SQL. */
export function bulletScale(current: number | null, previous: number | null) {
  const max = Math.max(0, current ?? 0, previous ?? 0) * 1.25 || 1
  const position = (value: number | null) => value == null || !Number.isFinite(value) ? null : Math.max(0, value / max * 100)
  return { min: 0, max, current: position(current), previous: position(previous) }
}
export function indexedSparkline(values: (number | null)[]) {
  const first = values.find(value => value != null && Number.isFinite(value) && value !== 0)
  return values.map(value => first == null || value == null || !Number.isFinite(value) ? null : value / first * 100)
}
