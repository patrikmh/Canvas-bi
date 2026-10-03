// The installed package ships the declaration beside its .cjs without a matching
// .d.cts extension. Re-export the supplied types rather than masking them as any.
declare module '@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs' {
  export { createDuckDB, NODE_RUNTIME, VoidLogger } from '@duckdb/duckdb-wasm/blocking'
}
