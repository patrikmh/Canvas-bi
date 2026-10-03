/** Shared SQL for the two engine adapters. Never interpolate unquoted inputs. */
export const literal = (value: string) => `'${value.replace(/'/g, "''")}'`
export const identifier = (value: string) => `"${value.replace(/"/g, '""')}"`

export const createSalesSql = `CREATE OR REPLACE TABLE sales (
  date DATE, order_id VARCHAR, customer_id VARCHAR, product VARCHAR,
  qty DOUBLE, unit_price DOUBLE, unit_cost DOUBLE, channel VARCHAR, region VARCHAR,
  revenue DOUBLE, cost DOUBLE
)`
export const importSalesSql = (file: string) => `INSERT INTO sales
SELECT date::DATE, order_id, customer_id, product, qty, unit_price, unit_cost,
       channel, region, qty * unit_price AS revenue, qty * unit_cost AS cost
FROM read_csv(${literal(file)}, header=true, columns={
  'date':'VARCHAR', 'order_id':'VARCHAR', 'customer_id':'VARCHAR', 'product':'VARCHAR',
  'qty':'DOUBLE', 'unit_price':'DOUBLE', 'unit_cost':'DOUBLE', 'channel':'VARCHAR', 'region':'VARCHAR'
})`
export const rawCsvSql = (name: string, file: string) => `CREATE OR REPLACE TABLE ${identifier(name)} AS SELECT * FROM read_csv_auto(${literal(file)}, header=true)`
