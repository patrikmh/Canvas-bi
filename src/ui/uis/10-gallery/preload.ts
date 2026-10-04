import { generateDemoData } from '../../../data/generate'
import { latestCompleteMonth } from '../../../data/metrics'
import { loadEconomics } from './data'

/** Only selected UI boots this query; data remain independent of the analyst's periods. */
export const preloadEconomics = typeof location !== 'undefined' && new URLSearchParams(location.search).get('ui') === '10'
  ? (async () => {
    const { createBrowserEngine } = await import('../../../data/engine.browser')
    const engine = await createBrowserEngine()
    try {
      await engine.loadOrderLines(generateDemoData())
      const { data: month } = await latestCompleteMonth(engine)
      return month ? { month, economics: await loadEconomics(engine, month) } : null
    } finally { await engine.close() }
  })().catch(() => null) : null
