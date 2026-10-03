import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parseCsvText, parseXlsx } from '../../data/upload'
import { parseNumber } from '../../data/mapping'

test.each(['annan-butik.xlsx', 'native-numbers.xlsx'])('real Excel date serials and numeric cells in %s parse as ISO dates and numbers', async name => {
  const bytes = readFileSync(`e2e/fixtures/${name}`)
  // The deterministic fixtures are uncompressed OOXML ZIPs, so inspect the actual cells too.
  expect(bytes.toString()).toMatch(/<c r="A2" s="1"><v>\d+<\/v><\/c>/)
  expect(bytes.toString()).toMatch(/<c r="C2"><v>\d+<\/v><\/c>/)
  if (name === 'native-numbers.xlsx') expect(bytes.toString()).toMatch(/<c r="D2"><v>\d+\.\d+<\/v><\/c>/)
  const parsed = await parseXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  const csv = parseCsvText(readFileSync('e2e/fixtures/annan-butik.csv', 'utf8'))
  expect(parsed.headers).toEqual(csv.headers)
  expect(parsed.rows).toHaveLength(csv.rows.length)
  for (let index = 0; index < parsed.rows.length; index++) {
    expect(parsed.rows[index][0]).toBe(csv.rows[index][0])
    for (const column of [2, 3, 4]) expect(parseNumber(parsed.rows[index][column])).toBe(parseNumber(csv.rows[index][column]))
  }
})
