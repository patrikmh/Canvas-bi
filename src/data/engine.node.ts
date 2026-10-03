import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import * as duckdb from '@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs'
import { plainValue } from './engine'
import type { SqlEngine } from './engine'
import { engineLoaders } from './engine.shared'

export async function createNodeEngine(): Promise<SqlEngine> {
  const require = createRequire(import.meta.url)
  const dist = dirname(require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs'))
  const db = await duckdb.createDuckDB({
    mvp: { mainModule: join(dist, 'duckdb-mvp.wasm'), mainWorker: join(dist, 'duckdb-node-mvp.worker.cjs') },
    eh: { mainModule: join(dist, 'duckdb-eh.wasm'), mainWorker: join(dist, 'duckdb-node-eh.worker.cjs') },
  }, new duckdb.VoidLogger(), duckdb.NODE_RUNTIME)
  await db.instantiate()
  const connection = db.connect()
  const query: SqlEngine['query'] = async <T,>(sql: string) => {
    const table = connection.query(sql)
    return table.toArray().map(row => plainValue(row, { children: table.schema.fields }) as T)
  }
  return {
    query,
    ...engineLoaders(query, async (name, text) => { db.registerFileText(name, text) }, async name => { db.dropFile(name) }),
    async close() { connection.close(); db.reset() },
  }
}
