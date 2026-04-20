import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `@mastra/libsql` pulls in a native binary (`@libsql/darwin-arm64`) via a
// dynamic `require` that vite cannot bundle. The main / preload / worker
// processes never actually instantiate `LibSQLStore` (the desktop app uses
// the JSON-backed `AppStore`), so we transparently swap the import for a
// throw-on-construct stub — same trick the worker bundle (build-worker.mjs)
// already uses. Without this, dev mode crashes with "Could not dynamically
// require @libsql/darwin-arm64" the first time vite re-optimizes deps.
const libsqlStub = path.resolve(__dirname, "src/main/libsql-stub.ts");

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@mastra/libsql": libsqlStub } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { "@mastra/libsql": libsqlStub } },
  },
  renderer: {
    plugins: [react()],
  },
});
