import * as duckdb from '@duckdb/duckdb-wasm'
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import { plainValue } from './engine'
import type { SqlEngine } from './engine'
import { engineLoaders } from './engine.shared'

export async function createBrowserEngine(): Promise<SqlEngine> {
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
    eh: { mainModule: ehWasm, mainWorker: ehWorker },
  })
  const worker = new Worker(bundle.mainWorker!)
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker)
  try {
    await db.instantiate(bundle.mainModule)
    const connection = await db.connect()
    const query: SqlEngine['query'] = async <T,>(sql: string) => (await connection.query(sql)).toArray().map(row => plainValue(row) as T)
    return {
      query,
      ...engineLoaders(query, async (name, text) => { await db.registerFileText(name, text) }, async name => { await db.dropFile(name) }),
      async close() { await connection.close(); await db.terminate() },
    }
  } catch (error) {
    await db.terminate()
    throw error
  }
}
