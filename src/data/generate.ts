import type { DatasetInfo, OrderLine } from './types'

export const DEMO_SEED = 20260831
export const PRODUCTS = ['Ullfilt', 'Linnepläd', 'Bordsduk', 'Kuddfodral', 'Vas i glas', 'Förvaringskorg', 'Badlakan', 'Kökshandduk 2-pack', 'Doftljus', 'Serveringsbricka', 'Keramikmugg', 'Tvålpump'] as const
const channels = ['Webb', 'Butik', 'Återförsäljare']
const regions = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Övriga Sverige']
const shares = [.24, .19, .09, .075, .075, .07, .06, .047, .043, .043, .039, .028]
const prices = [499, 449, 299, 149, 199, 249, 179, 99, 129, 229, 89, 119]
const margins = [100 - 14.2 / .28, 100 - 14.3 / .28, 48, 51, 59, 53, 49, 55, 60, 42, 56, 62]
const growthRates = [.10, .098, .57, .12, -.03, .08, .17, .04, .14, -.05, .08, -.119]
const seasonality = [.99, .97, 1.04, 1.02, 1.04, .95, .91, .88, 1, 1.08, 1.36, 1.52]
const otherProducts = prices.map((_, i) => i).filter(i => i !== 0 && i !== 1 && i !== 2 && i !== 11)
const roundOre = (value: number) => Math.round(value * 100) / 100
const totalRevenue = (units: number[]) => units.reduce((sum, qty, i) => sum + qty * prices[i], 0)

interface MonthPlan { month: string; lastDay: number; units: number[]; margin: number }
interface Customer { id: string; region: string }

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = seed + 0x6d2b79f5 | 0
    let n = Math.imul(seed ^ seed >>> 15, 1 | seed)
    n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

/** Find nearby integer unit pairs whose YoY growth rounds to the story target. */
function growthPair(targetUnits: number, growth: number): [number, number] {
  let best: [number, number] = [0, 0]
  let error = Infinity
  for (let previous = 1; previous <= 1000; previous++) {
    const current = Math.round(previous * (1 + growth))
    if (current < 1 || Math.round(1000 * (current / previous - 1)) !== Math.round(growth * 1000)) continue
    const distance = Math.abs(current - targetUnits)
    if (distance < error) { best = [current, previous]; error = distance }
  }
  if (!best[0]) throw new Error('Ingen heltalskalibrering hittades')
  return best
}

/** Greedy single-unit changes minimize revenue error without fractional goods. */
function calibrateUnits(units: number[], budget: number, editable = prices.map((_, i) => i), bounds?: number[][]) {
  let gap = budget - totalRevenue(units)
  for (let iteration = 0; iteration < 10_000; iteration++) {
    const direction = gap > 0 ? 1 : -1
    let best = -1
    let error = Math.abs(gap)
    for (const i of editable) {
      const next = units[i] + direction
      if (next < (bounds?.[i][0] ?? 1) || next > (bounds?.[i][1] ?? Infinity)) continue
      const candidate = Math.abs(gap - direction * prices[i])
      if (candidate < error) { best = i; error = candidate }
    }
    if (best < 0) return units
    units[best] += direction
    gap -= direction * prices[best]
  }
  throw new Error('Heltalskalibreringen konvergerade inte')
}

function monthPlans(random: () => number): MonthPlan[] {
  const current = shares.map((share, i) => Math.round(503_000 * share / prices[i]))
  const bordsduk = growthPair(current[2], growthRates[2])
  const tvalpump = growthPair(current[11], growthRates[11])
  current[2] = bordsduk[0]
  current[11] = tvalpump[0]
  calibrateUnits(current, 503_000, otherProducts)
  const previous = current.map((qty, i) => Math.round(qty / (1 + growthRates[i])))
  previous[2] = bordsduk[1]
  previous[11] = tvalpump[1]
  // Keep the other products' YoY changes in the plausible −5% to +20% band.
  const bounds = current.map(qty => [Math.ceil(qty / 1.20), Math.floor(qty / .95)])
  calibrateUnits(previous, totalRevenue(current) / 1.097, otherProducts, bounds)
  const currentShares = current.map((qty, i) => qty * prices[i] / totalRevenue(current))
  const previousShares = previous.map((qty, i) => qty * prices[i] / totalRevenue(previous))
  const plans: MonthPlan[] = []

  for (let index = 0; index < 36; index++) {
    const date = new Date(Date.UTC(2023, 8 + index, 1))
    const year = date.getUTCFullYear()
    const monthIndex = date.getUTCMonth()
    const month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
    const noise = (random() < .5 ? -1 : 1) * (.03 + .03 * random())
    let revenue = 503_000 / .88 * seasonality[monthIndex] * 1.097 ** ((index - 35) / 12) * (1 + noise)
    if (month === '2026-07') revenue = totalRevenue(current) / .96
    const weights = currentShares.map((share, i) => share * (currentShares[i] / previousShares[i]) ** ((index - 35) / 12)
      * (1 + .03 * Math.sin((index - 23) * Math.PI / 12) * Math.sin(i + .6)))
    const weightTotal = weights.reduce((sum, value) => sum + value, 0)
    const units = month === '2026-08' ? [...current] : month === '2025-08' ? [...previous]
      : calibrateUnits(weights.map((weight, i) => Math.max(1, Math.round(revenue * weight / weightTotal / prices[i]))), revenue)
    const marginNoise = (random() < .5 ? -1 : 1) * (.3 + .5 * random())
    plans.push({ month, lastDay, units, margin: month >= '2026-07' ? 44.7 : month === '2025-08' ? 51.2 : 51.1 + marginNoise })
  }

  // Pool anchors: align featured-product revenue shares across the comparison
  // pools, then center the three noisy margins on the revenue-weighted 51.1%.
  const after = plans.slice(34)
  const afterRevenue = after.reduce((sum, plan) => sum + totalRevenue(plan.units), 0)
  const before = plans.slice(31, 34)
  for (const plan of before) {
    const revenue = totalRevenue(plan.units)
    for (const i of [0, 1]) {
      const afterProductRevenue = after.reduce((sum, period) => sum + period.units[i] * prices[i], 0)
      plan.units[i] = Math.round(revenue * afterProductRevenue / afterRevenue / prices[i])
    }
    calibrateUnits(plan.units, revenue, otherProducts)
  }
  const beforeRevenue = before.reduce((sum, plan) => sum + totalRevenue(plan.units), 0)
  const deviation = before.reduce((sum, plan) => sum + totalRevenue(plan.units) * (plan.margin - 51.1), 0) / beforeRevenue
  before.forEach(plan => { plan.margin -= deviation })
  return plans
}

/** Product-specific cost curves, with common monthly supply-cost variation. */
function monthlyCosts(plan: MonthPlan) {
  const costs = margins.map((margin, i) => roundOre(prices[i] * (1 - margin / 100)))
  for (const i of [0, 1]) if (plan.month >= '2026-07') costs[i] = roundOre(costs[i] * 1.28)
  const revenue = totalRevenue(plan.units)
  const featuredProfit = [0, 1].reduce((sum, i) => sum + plan.units[i] * (prices[i] - costs[i]), 0)
  const otherRevenue = revenue - plan.units[0] * prices[0] - plan.units[1] * prices[1]
  const otherProfit = margins.reduce((sum, margin, i) => i < 2 ? sum : sum + plan.units[i] * prices[i] * margin / 100, 0)
  const shift = (revenue * plan.margin / 100 - featuredProfit - otherProfit) / otherRevenue * 100
  for (let i = 2; i < prices.length; i++) costs[i] = roundOre(prices[i] * (1 - (margins[i] + shift) / 100))
  return costs
}

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Integer inventory, fixed ex-VAT SEK prices, öre costs and stable customer IDs. */
export function generateDemoData(seed = DEMO_SEED): OrderLine[] {
  const random = mulberry32(seed)
  const plans = monthPlans(random)
  const rows: OrderLine[] = []
  let customerSequence = 0
  let cohort: Customer[] = []
  for (const plan of plans) {
    const { month, lastDay } = plan
    const revenue = totalRevenue(plan.units)
    const orderCount = month === '2026-08' ? 793 : month === '2025-08' ? 721 : Math.round(revenue / 650)
    const customerCount = month === '2026-08' ? 627 : month === '2025-08' ? 571 : Math.round(orderCount * .79)
    const returning = Math.min(cohort.length, Math.round(customerCount * .65))
    cohort = shuffle(cohort, random).slice(0, returning)
    while (cohort.length < customerCount) cohort.push({
      id: `C${String(++customerSequence).padStart(6, '0')}`,
      region: regions[Math.floor(random() * regions.length)],
    })
    cohort = shuffle(cohort, random)
    const costs = monthlyCosts(plan)
    const orders = Array.from({ length: orderCount }, (_, order) => {
      const customer = cohort[order < customerCount ? order : Math.floor(random() * customerCount)]
      const day = order === orderCount - 1 ? lastDay : 1 + Math.floor(random() * lastDay)
      return {
        date: `${month}-${String(day).padStart(2, '0')}`, order_id: `${month}-${order + 1}`,
        customer_id: customer.id, region: customer.region,
        channel: channels[Math.floor(random() * channels.length)],
      }
    })
    const lines: { product: number; qty: number }[] = []
    plan.units.forEach((units, product) => {
      while (units > 0) {
        const qty = Math.min(units, random() < .65 ? 1 : random() < .7 ? 2 : 3)
        lines.push({ product, qty })
        units -= qty
      }
    })
    // Every order gets a line. Split batches only if an unusual seed needs more.
    while (lines.length < orderCount) {
      const batch = lines.find(line => line.qty > 1)
      if (!batch) throw new Error('För få enheter för orderantalet')
      batch.qty--
      lines.push({ product: batch.product, qty: 1 })
    }
    const orderLines = new Map<string, OrderLine>()
    shuffle(lines, random).forEach((line, index) => {
      const orderIndex = index < orderCount ? index : Math.floor(random() * orderCount)
      const key = `${orderIndex}:${line.product}`
      const existing = orderLines.get(key)
      if (existing) existing.qty += line.qty
      else orderLines.set(key, {
        ...orders[orderIndex], product: PRODUCTS[line.product], qty: line.qty,
        unit_price: prices[line.product], unit_cost: costs[line.product],
      })
    })
    rows.push(...orderLines.values())
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.order_id.localeCompare(b.order_id) || a.product.localeCompare(b.product, 'sv'))
}

export function demoDatasetInfo(rows: OrderLine[]): DatasetInfo {
  return {
    source: 'demo', name: 'DemoCo AB', rowCount: rows.length,
    months: [...new Set(rows.map(row => row.date.slice(0, 7)))].sort(),
    hasCost: true,
    mapping: Object.fromEntries(['date', 'order_id', 'customer_id', 'product', 'qty', 'unit_price', 'unit_cost', 'channel', 'region'].map(field => [field, field])),
  }
}
