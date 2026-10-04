import { generateDemoData } from '../../../data/generate'
import { latestCompleteMonth } from '../../../data/metrics'
import { loadRegions } from './data'

/** Begin only this candidate's local SQL alongside session boot, before the page mounts. */
export const preloadRegions = typeof location !== 'undefined' && new URLSearchParams(location.search).get('ui') === '07'
  ? (async () => {
    const { createBrowserEngine } = await import('../../../data/engine.browser')
    const engine = await createBrowserEngine()
    try {
      await engine.loadOrderLines(generateDemoData())
      const { data: month } = await latestCompleteMonth(engine)
      return month ? { month, regions: await loadRegions(engine, month) } : null
    } finally { await engine.close() }
  })().catch(() => null) : null
