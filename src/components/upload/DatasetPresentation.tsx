import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DatasetInfo } from '../../data/types'
import type { CanvasCard, Metric } from '../../canvas/layout'
import type { Dashboard } from '../../analysis/dashboard'
import { fmtPct } from '../../data/format'
import { assumptionFormula } from '../../data/engine.upload'

export function missingMetric(dataset: DatasetInfo, metric: Metric) {
  if (dataset.source !== 'upload') return ''
  if (metric === 'margin' && !dataset.hasCost) return 'Kostnad saknas. Bruttomarginal kan inte beräknas utan kostnad.'
  if (metric === 'orders' && !dataset.mapping.order_id) return 'Orderkolumn saknas. Mappa ett ordernummer för att räkna unika ordrar.'
  if (metric === 'customers' && !dataset.mapping.customer_id) return 'Kundkolumn saknas. Mappa ett kundnummer för att räkna unika kunder.'
  return ''
}
function missingCard(dataset: DatasetInfo, card: CanvasCard) {
  if (dataset.source !== 'upload') return ''
  if (card.kind === 'text' || card.kind === 'insight') return ''
  if (card.kind === 'waterfall' && dataset.assumption) return 'ANTAGANDE: kostnaden är antagen. En uppmätt förklaring till marginalförändringen saknas.'
  const metric = card.kind === 'waterfall' ? 'margin' : card.metric ?? 'revenue'
  return missingMetric(dataset, metric) || ((card.kind === 'bars' || card.kind === 'table' || card.kind === 'waterfall') && !dataset.mapping.product ? 'Produktkolumn saknas. Mappa en produkt för att dela upp försäljningen.' : '')
}

/** Attach dataset caveats to existing reusable cards, without changing shared canvas components. */
export function DatasetPresentation({ dataset, cards }: { dataset: DatasetInfo; cards: CanvasCard[] }) {
  const [targets, setTargets] = useState<{ element: HTMLElement; reason: string; assumption: boolean }[]>([])
  useLayoutEffect(() => {
    let current: typeof targets = []
    function sync() {
      const next: typeof targets = []
      // These labels already come from SQL-backed formatters; unknown and rounded-zero deltas are neutral.
      for (const element of document.querySelectorAll<HTMLElement>('.kpi-delta, .detail-summary > span:not(.muted), td.positive, td.negative')) {
        element.classList.toggle('upload-neutral', /^(?:—|0,0\s+(?:%|p\.e\.))(?:\s|$)/.test(element.textContent?.trim() ?? ''))
      }
      for (const card of cards) {
        const element = document.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`)
        if (!element) continue
        const reason = missingCard(dataset, card)
        element.classList.toggle('upload-unavailable', Boolean(reason))
        const assumption = Boolean(dataset.assumption && (card.metric === 'margin' || ['waterfall', 'table', 'insight'].includes(card.kind)))
        if (reason || assumption) next.push({ element, reason, assumption })
      }
      if (dataset.assumption) {
        for (const element of document.querySelectorAll<HTMLElement>('.assistant-heading, .detail-view, .calculation-drawer')) next.push({ element, reason: '', assumption: true })
      }
      if (next.length !== current.length || next.some((item, i) => item.element !== current[i].element || item.reason !== current[i].reason || item.assumption !== current[i].assumption)) {
        current = next; setTargets(next)
      }
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.querySelector('[data-testid="app-root"]')!, { childList: true, subtree: true })
    return () => { observer.disconnect(); for (const item of current) item.element.classList.remove('upload-unavailable') }
  }, [dataset, cards])
  if (dataset.source !== 'upload') return null
  return targets.map(({ element, reason, assumption }, index) => createPortal(reason ? <p className="upload-empty" data-testid="upload-empty-state">{reason}</p> : assumption && dataset.assumption ? <span className="assumption-label" data-testid="assumption-label">ANTAGANDE · {fmtPct(dataset.assumption.pct)} bruttomarginal</span> : null, element, String(index)))
}

/** An absent identifier is unknown; it must not be presented as a measured zero. */
export function uploadDashboard(dashboard: Dashboard, dataset: DatasetInfo): Dashboard {
  if (dataset.source !== 'upload') return dashboard
  const data = { ...dashboard.snapshot.data }
  for (const metric of ['orders', 'customers'] as const) if (missingMetric(dataset, metric)) data[metric] = { current: null, lastYear: null, previousMonth: null, deltaYoY: null, deltaMoM: null }
  return { ...dashboard, snapshot: { ...dashboard.snapshot, data, formula: `${dashboard.snapshot.formula}${dataset.assumption ? ` ${assumptionFormula(dataset.assumption.pct)}` : ''}` } }
}
