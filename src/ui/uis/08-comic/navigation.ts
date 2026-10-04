export function panelIndex(current: number, key: string, editing: boolean) {
  if (editing) return current
  return Math.max(0, Math.min(5, current + (key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0)))
}
