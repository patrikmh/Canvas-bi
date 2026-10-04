export interface Sample { index: number; value: number }
export function pointerSample(x: number, y: number, width: number, height: number, count: number): Sample {
  return { index: Math.max(0, Math.min(count - 1, Math.round(x / width * (count - 1)))), value: Math.round(Math.max(0, Math.min(100, (1 - y / height) * 100))) }
}
export function drawThrough(values: (number | null)[], from: Sample, to: Sample) {
  const next = [...values], distance = to.index - from.index
  for (let index = Math.min(from.index, to.index); index <= Math.max(from.index, to.index); index++) {
    next[index] = distance === 0 ? to.value : Math.round(from.value + (to.value - from.value) * (index - from.index) / distance)
  }
  return next
}
export function lineSegments(values: (number | null)[]) {
  const segments: Sample[][] = []; let segment: Sample[] = []
  values.forEach((value, index) => {
    if (value == null || !Number.isFinite(value)) { if (segment.length) segments.push(segment); segment = [] }
    else segment.push({ index, value })
  })
  if (segment.length) segments.push(segment)
  return segments
}
export function gapBands(guess: (number | null)[], actual: (number | null)[]) {
  return lineSegments(guess.map((value, index) => actual[index] == null ? null : value)).filter(segment => segment.length > 1).map(segment => [
    ...segment, ...segment.slice().reverse().map(point => ({ index: point.index, value: actual[point.index]! })),
  ])
}
