import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('../e2e/fixtures/', import.meta.url))
mkdirSync(directory, { recursive: true })
let seed = 4042026
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
const products = ['Sneakers', 'Hoodie', 'Jeans', 'T-shirt', 'Träningsjacka']
function records(count, months, start) {
  return Array.from({ length: count }, (_, index) => {
    const monthIndex = Math.floor(index * months / count)
    const month = new Date(Date.UTC(2025, start + monthIndex, 1)).toISOString().slice(0, 7)
    const within = index - Math.ceil(monthIndex * count / months)
    const day = within === 0 ? 28 : 1 + Math.floor(random() * 26)
    const qty = 1 + Math.floor(random() * 4)
    const price = 199 + Math.floor(random() * 800) + .5
    const unitCost = Math.round(price * (.45 + .2 * random()) * 100) / 100
    return { date: `${month}-${String(day).padStart(2, '0')}`, product: products[index % products.length], qty, price, unitCost,
      revenue: Math.round(qty * price * 100) / 100, cost: Math.round(qty * unitCost * 100) / 100,
      customer: `K${index % 67 + 1}`, order: `O${index + 1}` }
  })
}
const decimal = value => value.toFixed(2).replace('.', ',')
const shop = records(300, 14, 6)
const noCost = records(200, 12, 8)
const small = records(20, 2, 10)
const shopHeaders = ['Orderdatum', 'Artikel', 'Antal', 'Styckpris', 'Inköpspris', 'Kundnr', 'Ordernr']
const shopRows = shop.map(row => [row.date, row.product, String(row.qty), decimal(row.price), decimal(row.unitCost), row.customer, row.order])
writeFileSync(`${directory}annan-butik.csv`, '\ufeff' + [shopHeaders, ...shopRows].map(row => row.join(';')).join('\n') + '\n')
writeFileSync(`${directory}utan-kostnad.csv`, ['date,product,amount,customer,order', ...noCost.map(row => [row.date, row.product, row.revenue.toFixed(2), row.customer, row.order].join(','))].join('\n') + '\n')
writeFileSync(`${directory}fa-rader.csv`, ['datum,produkt,belopp,kostnad,kund,ordernummer', ...small.map(row => [row.date, row.product, row.revenue.toFixed(2), row.cost.toFixed(2), row.customer, row.order].join(','))].join('\n') + '\n')

// Independent integer-öre aggregation; never import the app's parsers or SQL.
function expected(rows, hasCost) {
  const months = [...new Set(rows.map(row => row.date.slice(0, 7)))].sort()
  const latestMonth = months.at(-1)
  const latest = rows.filter(row => row.date.startsWith(latestMonth))
  const revenue = latest.reduce((sum, row) => sum + Math.round(row.revenue * 100), 0) / 100
  const cost = hasCost ? latest.reduce((sum, row) => sum + Math.round(row.cost * 100), 0) / 100 : null
  return { rowCount: rows.length, monthCount: months.length, latestMonth, revenue, cost, margin: cost === null ? null : 100 * (revenue - cost) / revenue }
}
const expectations = {
  'annan-butik.csv': expected(shop, true),
  'utan-kostnad.csv': expected(noCost, false),
  'fa-rader.csv': expected(small, true),
  'annan-butik.xlsx': expected(shop, true),
}
writeFileSync(`${directory}expected.json`, JSON.stringify(expectations, null, 2) + '\n')

// Minimal deterministic OOXML workbook and uncompressed ZIP: no extra dependencies.
const xml = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
function sheetRowsFor(nativeMoney = false) {
  return [shopHeaders, ...shopRows].map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
    const reference = `${String.fromCharCode(65 + c)}${r + 1}`
    if (r > 0 && c === 0) return `<c r="${reference}" s="1"><v>${(Date.parse(cell) - Date.UTC(1899, 11, 30)) / 86_400_000}</v></c>`
    if (r > 0 && (c === 2 || (nativeMoney && (c === 3 || c === 4)))) return `<c r="${reference}"><v>${Number(cell.replace(',', '.'))}</v></c>`
    return `<c r="${reference}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`
  }).join('')}</row>`).join('')
}
const sheetRows = sheetRowsFor()
const files = {
  '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Försäljning" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml': '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>',
  'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
}
function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function workbookZip(files) {
const locals = [], central = []
let offset = 0
for (const [path, content] of Object.entries(files)) {
  const name = Buffer.from(path), data = Buffer.from(content), crc = crc32(data)
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x21, 12)
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26)
  locals.push(header, name, data)
  const entry = Buffer.alloc(46)
  entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x21, 14)
  entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42)
  central.push(entry, name)
  offset += header.length + name.length + data.length
}
const directoryBytes = Buffer.concat(central), end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10)
end.writeUInt32LE(directoryBytes.length, 12); end.writeUInt32LE(offset, 16)
return Buffer.concat([...locals, directoryBytes, end])
}
writeFileSync(`${directory}annan-butik.xlsx`, workbookZip(files))
writeFileSync(`${directory}native-numbers.xlsx`, workbookZip({ ...files, 'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRowsFor(true)}</sheetData></worksheet>` }))
console.log('Generated five deterministic upload fixtures (including native Excel cells) and expected.json')
