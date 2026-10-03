import { useEffect, useState } from 'react'
import type { SqlEngine } from '../data/engine'
import { ordersFor } from '../data/metrics'
import { fmtInt } from '../data/format'
import { HowButton } from './HowButton'
import type { Calculation } from './CalculationDrawer'
import { fmtKr, fmtQty } from './valueFormat'

export function OrderLines({ engine, product, month, id, onHow }: { engine: SqlEngine; product: string; month: string; id: string; onHow: (calculation: Calculation) => void }) {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof ordersFor>> | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setOrders(null); setError(null)
    void ordersFor(engine, product, month).then(async result => {
      const [row] = await engine.query<{ count: number }>(`SELECT COUNT(*) AS count FROM (${result.sql})`)
      if (!cancelled) { setOrders(result); setCount(row.count) }
    }).catch(error => { if (!cancelled) setError(String(error)) })
    return () => { cancelled = true }
  }, [engine, product, month])
  if (error) return <p role="alert">{error}</p>
  if (!orders) return <p role="status">Läser orderrader…</p>
  return <><div className="table-scroll" data-testid="orders-table"><table><thead><tr><th>Datum / Order</th><th>Kund</th><th>Antal</th><th>Styckpris</th><th>Styckkostnad</th><th>Omsättning</th><th>Kanal / Region</th></tr></thead><tbody>{orders.data.map((row, index) => <tr key={`${row.order_id}-${index}`}><td>{row.date}<small>{row.order_id}</small></td><td>{row.customer_id}</td><td>{fmtQty(row.qty)}</td><td>{fmtKr(row.unit_price)}</td><td>{fmtKr(row.unit_cost)}</td><td>{fmtKr(row.revenue)}</td><td>{row.channel}<small>{row.region}</small></td></tr>)}</tbody></table></div>
    <HowButton id={id} onClick={() => onHow({ id, title: `Orderrader · ${product}`, formula: orders.formula, sql: orders.sql, value: `${fmtInt(count)} orderrader` })} /></>
}
