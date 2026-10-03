import { expect, test } from 'vitest'
import { parseUploadCsv } from './parseFile'

test('UI parsing drops empty trailing header cells without dropping short valid rows', () => {
  expect(parseUploadCsv('date,amount,,\n2026-08-01,100\n2026-08-02,200,,\n')).toEqual({ headers: ['date', 'amount'], rows: [['2026-08-01', '100'], ['2026-08-02', '200']] })
})
test('UI parsing preserves quotes and rejects blank interior or duplicate headers', () => {
  expect(parseUploadCsv('date;product;amount;\n2026-08-01;"Tröja; blå";"123,50";\n').rows[0]).toEqual(['2026-08-01', 'Tröja; blå', '123,50'])
  expect(() => parseUploadCsv('date,,amount,\n2026-08-01,x,100,\n')).toThrow('kolumnnamn')
  expect(() => parseUploadCsv('date,date,\n2026-08-01,100,\n')).toThrow('unika')
})
