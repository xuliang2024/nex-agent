import { build } from "esbuild";
import { dirname, resolve } from "path";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

await build({
  entryPoints: [resolve(root, "src/main/agent-worker.ts")],
  outfile: resolve(root, "out/main/agent-worker.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  external: [
    "electron",
    "better-sqlite3",
    "cpu-features",
    "bufferutil",
    "utf-8-validate",
  ],
  alias: {
    "@mastra/libsql": path.resolve(root, "src/main/libsql-stub.ts"),
  },
  sourcemap: false,
});

console.log("agent-worker.js built successfully");
