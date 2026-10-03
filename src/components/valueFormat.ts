const currency = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
const quantity = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 3 })
export const fmtKr = (value: number | null) => value == null ? '—' : currency.format(value).replace(/-/g, '−')
export const fmtQty = (value: number) => quantity.format(value).replace(/-/g, '−')
