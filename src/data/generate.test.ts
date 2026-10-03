import { expect, test } from 'vitest'
import { generateDemoData, PRODUCTS } from './generate'

test('drill-down quantities are positive integers, prices fixed whole kronor, costs rounded to öre', () => {
  for (const seed of [20260831, 42]) {
    const rows = generateDemoData(seed)
    expect(rows.every(row => Number.isInteger(row.qty) && row.qty >= 1)).toBe(true)
    expect(rows.every(row => Number.isInteger(row.unit_price) && row.unit_price > 0)).toBe(true)
    expect(rows.every(row => row.unit_cost != null && row.unit_cost > 0 && Math.abs(row.unit_cost * 100 - Math.round(row.unit_cost * 100)) < 1e-7)).toBe(true)
    for (const product of PRODUCTS) {
      expect(new Set(rows.filter(row => row.product === product).map(row => row.unit_price)).size).toBe(1)
    }
    for (const product of ['Ullfilt', 'Linnepläd']) {
      const productRows = rows.filter(row => row.product === product)
      const beforeCosts = new Set(productRows.filter(row => row.date < '2026-07-01').map(row => row.unit_cost!))
      const afterCosts = new Set(productRows.filter(row => row.date >= '2026-07-01').map(row => row.unit_cost!))
      expect(beforeCosts.size).toBe(1)
      expect(afterCosts.size).toBe(1)
      expect([...afterCosts][0]).toBe(Math.round([...beforeCosts][0] * 1.28 * 100) / 100)
    }
  }
})

test('customer identities survive across months with both returning and newly acquired customers', () => {
  const rows = generateDemoData()
  const months = [...new Set(rows.map(row => row.date.slice(0, 7)))].sort()
  const seen = new Set<string>()
  let previous = new Set<string>()
  for (const month of months) {
    const customers = new Set(rows.filter(row => row.date.startsWith(month)).map(row => row.customer_id))
    if (seen.size) {
      const returning = [...customers].filter(id => previous.has(id)).length
      const newCustomers = [...customers].filter(id => !seen.has(id)).length
      expect(returning / customers.size).toBeGreaterThan(.5)
      expect(returning / customers.size).toBeLessThan(.85)
      expect(newCustomers / customers.size).toBeGreaterThan(.15)
      expect(newCustomers / customers.size).toBeLessThan(.5)
    }
    customers.forEach(id => seen.add(id))
    previous = customers
  }
  expect(new Set(rows.filter(row => row.date.startsWith('2026-08')).map(row => row.customer_id)).size).toBe(627)
  expect(new Set(rows.filter(row => row.date.startsWith('2025-08')).map(row => row.customer_id)).size).toBe(571)
  const regionsByCustomer = new Map<string, string>()
  for (const row of rows) {
    if (regionsByCustomer.has(row.customer_id)) expect(row.region).toBe(regionsByCustomer.get(row.customer_id))
    regionsByCustomer.set(row.customer_id, row.region)
  }
})
