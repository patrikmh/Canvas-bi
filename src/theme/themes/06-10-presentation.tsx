// Theme-owned source-system details. Reuse existing controls and query-backed text;
// never recalculate metrics or change the shared React components.
function textNode(parent: Element, className: string, text: string, before?: Element | null) {
  let element = parent.querySelector<HTMLElement>(`:scope > .${className}`)
  if (!element) {
    element = document.createElement('p')
    element.className = className
    parent.insertBefore(element, before ?? null)
  }
  if (element.textContent !== text) element.textContent = text
}

export function handleThemeKey(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
  const active = document.activeElement as HTMLElement | null
  if (active?.closest('input, textarea, select, [contenteditable="true"], dialog')) return
  const id = document.documentElement.dataset.theme
  let button: HTMLButtonElement | undefined
  if (id === '07') {
    const index = ['a', 'e', 'r'].indexOf(event.key.toLowerCase())
    if (index >= 0) button = active?.closest('.memo-findings li')?.querySelectorAll<HTMLButtonElement>('.memo-review-actions button')[index]
  } else if (id === '09' && /^F[1-6]$/.test(event.key)) {
    button = document.querySelectorAll<HTMLButtonElement>('.assistant-chip')[Number(event.key.slice(1)) - 1]
  }
  if (button && !button.disabled && !button.closest('[hidden]')) {
    event.preventDefault()
    button.click()
  }
}

let chartNumber = 0
const shownPeriods = new WeakMap<Element, string>()
function hatchExcelBars() {
  const ns = 'http://www.w3.org/2000/svg'
  for (const svg of document.querySelectorAll<SVGSVGElement>('.kind-bars .chart svg, .product-detail .chart svg')) {
    let defs = svg.querySelector<SVGDefsElement>('defs.excel-patterns')
    if (!defs) {
      defs = document.createElementNS(ns, 'defs')
      defs.classList.add('excel-patterns')
      const id = ++chartNumber
      for (const [name, colour, line] of [['actual', '#333333', '#ffffff'], ['previous', '#999999', '#333333']]) {
        const pattern = document.createElementNS(ns, 'pattern')
        pattern.id = `excel-${id}-${name}`
        pattern.setAttribute('patternUnits', 'userSpaceOnUse')
        pattern.setAttribute('width', '6'); pattern.setAttribute('height', '6')
        const background = document.createElementNS(ns, 'rect')
        background.setAttribute('width', '6'); background.setAttribute('height', '6'); background.setAttribute('fill', colour)
        const stroke = document.createElementNS(ns, 'path')
        stroke.setAttribute('d', name === 'actual' ? 'M-1 1L1 -1M0 6L6 0M5 7L7 5' : 'M0 3H6')
        stroke.setAttribute('stroke', line); stroke.setAttribute('stroke-width', '1')
        pattern.append(background, stroke); defs.append(pattern)
      }
      svg.prepend(defs)
    }
    // Only neutral actual/previous rectangles. Bad-variance bars stay solid red.
    for (const [name, colour] of [['actual', '#333333'], ['previous', '#999999']]) {
      const pattern = defs.querySelector<SVGPatternElement>(`pattern[id$="-${name}"]`)!
      for (const path of svg.querySelectorAll<SVGPathElement>(`path[fill="${colour}"]:not([stroke])`)) {
        path.setAttribute('fill', `url(#${pattern.id})`)
      }
    }
  }
}

export function syncThemePresentation(id: string) {
  if (id === '07') {
    for (const row of document.querySelectorAll('.memo-review-actions')) {
      row.querySelectorAll('button').forEach((button, index) => {
        if (button.querySelector('.review-shortcut')) return
        const hint = document.createElement('kbd')
        hint.className = 'review-shortcut'
        hint.setAttribute('aria-hidden', 'true')
        hint.textContent = ['A', 'E', 'R'][index]
        button.append(hint)
      })
    }
  }
  if (id === '06') {
    const header = document.querySelector('.workspace-header')
    if (header) textNode(header, 'briefing-dateline', 'Söndag 4 oktober 2026 – Morgonbrief för ledningen')
    const insight = document.querySelector('.insight-content')
    const reviewer = document.querySelector('.memo-signoff p:last-child')?.textContent?.replace(/^Granskad av:\s*/, '') || '—'
    if (insight) textNode(insight, 'briefing-byline', `Av Analysagenten, granskad av ${reviewer}`, insight.querySelector('.insight-actions'))
    // The existing finding markers already locate the real SQL-derived change.
    // Add newsroom words at those same coordinates, anchored into the plot.
    for (const label of document.querySelectorAll<SVGTextElement>('.kind-trend .chart text, .detail-chart:not(.product-detail) .chart text')) {
      if (label.textContent === '②' || label.textContent === '①') {
        const breakpoint = label.textContent === '②'
        label.textContent = label.textContent === '②' ? '② Brytpunkt' : '① Nu'
        label.setAttribute('text-anchor', 'end')
        label.setAttribute('y', breakpoint ? '-18' : '14')
        label.style.fontSize = '11px'
      }
    }
  }
  const app = document.querySelector('.app')
  if (id === '09' && app) {
    const run = document.querySelector('.memo-signoff p:first-child')?.textContent?.match(/körning #[\s\S]+/)?.[0] || 'Analys inväntas'
    textNode(app, 'terminal-status', `Lokalt / DuckDB | ${run}`)
  }
  if (id === '10') {
    if (app) {
      // The subtitle count is formatted from dashboard.history.data.length (SQL).
      if (app.getAttribute('data-ready') === 'false') shownPeriods.delete(app)
      const currentPeriod = document.querySelector('.kind-trend .card-subtitle')?.textContent?.match(/Senaste (.+) månaderna/)?.[1]
      if (currentPeriod) shownPeriods.set(app, currentPeriod)
      const period = currentPeriod ?? shownPeriods.get(app)
      textNode(app, 'win98-status', `${app.getAttribute('data-ready') === 'false' ? 'Läser data…' : 'Klar'} | ${period ? `${period} månader` : 'Period enligt underlag'} | DuckDB`)
    }
    hatchExcelBars()
  }
}

let installed = false
export function installThemePresentation() {
  if (installed || typeof document === 'undefined') return
  // Definitions are eagerly registered. Install behavior only for the themes
  // that need it, so the original/default app has no observer or key listener.
  const requested = new URLSearchParams(location.search).get('theme')
  if (!['06', '07', '09', '10'].includes(requested ?? '')) return
  installed = true
  document.addEventListener('keydown', handleThemeKey)
  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      syncThemePresentation(document.documentElement.dataset.theme ?? '00')
    })
  })
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme', 'data-ready', 'fill'] })
}
