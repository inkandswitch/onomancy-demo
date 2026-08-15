import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Force a single copy of the automerge and subduction modules, resolved from
// this project's node_modules. automerge-repo-keyhive brings its own copies,
// and a duplicate of a WASM-backed module is a separate module instance, which
// breaks wasm-bindgen instanceof checks ("expected instance of Topic/PeerId").
const automergeEntryDir = dirname(
  fileURLToPath(import.meta.resolve("@automerge/automerge"))
);
const subductionEsmDir = dirname(
  fileURLToPath(import.meta.resolve("@automerge/automerge-subduction"))
);
const repoEntryDir = dirname(
  fileURLToPath(import.meta.resolve("@automerge/automerge-repo"))
);

export default defineConfig({
  base: "./",
  server: {
    port: 5558,
    open: true,
  },
  build: {
    target: "esnext",
    assetsInlineLimit: 100000,
  },
  resolve: {
    alias: [
      {
        find: /^@automerge\/automerge\/slim$/,
        replacement: resolve(automergeEntryDir, "slim.js"),
      },
      {
        find: /^@automerge\/automerge$/,
        replacement: resolve(automergeEntryDir, "fullfat_bundler.js"),
      },
      {
        find: /^@automerge\/automerge-subduction\/slim$/,
        replacement: resolve(subductionEsmDir, "slim.js"),
      },
      {
        find: /^@automerge\/automerge-subduction$/,
        replacement: resolve(subductionEsmDir, "web.js"),
      },
      {
        find: /^@automerge\/automerge-repo\/slim$/,
        replacement: resolve(repoEntryDir, "slim.js"),
      },
      {
        find: /^@automerge\/automerge-repo$/,
        replacement: resolve(repoEntryDir, "fullfat.js"),
      },
      {
        find: "ws",
        replacement: new URL("./src/shims/ws.ts", import.meta.url).pathname,
      },
    ],
    dedupe: ["@keyhive/keyhive"],
  },
  optimizeDeps: {
    exclude: [
      "@automerge/automerge",
      "@automerge/automerge/slim",
      "@automerge/automerge-repo",
      "@automerge/automerge-repo/slim",
      "@automerge/automerge-repo-storage-indexeddb",
      "@automerge/react",
      "@automerge/automerge-subduction",
      "@automerge/automerge-subduction/slim",
      "@automerge/automerge-repo-keyhive",
      "@keyhive/keyhive",
      "@keyhive/keyhive/slim",
    ],
    include: [
      "@automerge/automerge-repo > debug",
      "@automerge/automerge-repo > bs58check",
      "@automerge/automerge-repo > fast-sha256",
      "@automerge/automerge-repo > cbor-x",
      "@automerge/automerge-repo > eventemitter3",
      "@automerge/automerge-repo > uuid",
      "@automerge/automerge-repo > isomorphic-ws",
      "@automerge/automerge-repo > xstate",
    ],
  },
  plugins: [wasm(), react()],
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
});
