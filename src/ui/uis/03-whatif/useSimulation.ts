import { useEffect, useMemo, useState } from 'react'
import type { SqlEngine } from '../../../data/engine'
import type { BaseProduct, Levers, Simulation } from './sim'
import { simulationSql } from './sim'

export function useSimulation(base: BaseProduct[], levers: Levers) {
  const [engine, setEngine] = useState<SqlEngine | null>(null)
  const [value, setValue] = useState<{ sql: string; result: Simulation } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sql = useMemo(() => base.length ? simulationSql(base, levers) : '', [base, levers])
  useEffect(() => {
    let cancelled = false, live: SqlEngine | undefined
    void import('../../../data/engine.browser').then(module => module.createBrowserEngine()).then(async instance => {
      if (cancelled) { await instance.close(); return }
      live = instance; setEngine(instance)
    }).catch(cause => { if (!cancelled) setError(String(cause)) })
    return () => { cancelled = true; void live?.close() }
  }, [])
  useEffect(() => {
    if (!engine || !sql) return
    let cancelled = false
    void engine.query<Simulation>(sql).then(([result]) => { if (!cancelled) { setValue({ sql, result }); setError(null) } }).catch(cause => { if (!cancelled) setError(String(cause)) })
    return () => { cancelled = true }
  }, [engine, sql])
  return { sql, result: value?.sql === sql ? value.result : null, error }
}
