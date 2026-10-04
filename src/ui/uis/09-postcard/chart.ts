export function marginPath(values: (number | null)[], width: number, height: number) {
  let connected = false
  return values.flatMap((value, index) => {
    if (value == null || !Number.isFinite(value)) { connected = false; return [] }
    const point = `${connected ? 'L' : 'M'}${index * width / Math.max(1, values.length - 1)},${height - value * height / 100}`
    connected = true
    return [point]
  }).join(' ')
}
export async function postcardWeek(engine: SqlEngine, date: string) {
  const sql = `SELECT week(${literal(date)}::DATE) AS week, year(date_trunc('week',${literal(date)}::DATE)+INTERVAL '3 days') AS year`
  const [data] = await engine.query<{ week: number; year: number }>(sql)
  return { data, sql, formula: 'ISO-vecka och ISO-år för brevets datum. Veckoåret följer veckans torsdag.' }
}
import type { SqlEngine } from '../../../data/engine'
import { literal } from '../../../data/sql'
