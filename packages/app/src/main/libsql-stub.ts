// Stub for @mastra/libsql - the worker process doesn't use the store
export class LibSQLStore {
  constructor() {
    throw new Error("LibSQLStore is not available in the worker process");
  }
}
