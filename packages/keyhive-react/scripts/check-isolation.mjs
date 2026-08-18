// Fails the build if the compiled library imports anything but React.
//
// The package takes its keyhive values from the host application so there
// should only be one instance of the WASM-backed packages.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist", import.meta.url).pathname;
const ALLOWED = /^react(\/|$)/;

function jsFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...jsFiles(path));
    else if (path.endsWith(".js")) found.push(path);
  }
  return found;
}

const violations = [];
for (const file of jsFiles(DIST)) {
  // Comments are stripped first, since runtime.ts documents the app-side
  // import in a doc comment and that is not an import.
  const code = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const [, specifier] of code.matchAll(
    /(?:from|import)\s*["']([^"']+)["']/g
  )) {
    if (specifier.startsWith(".") || ALLOWED.test(specifier)) continue;
    violations.push(`${file}: ${specifier}`);
  }
}

if (violations.length > 0) {
  console.error(
    "keyhive-react must not import anything but React at runtime.\n" +
      "Take the value from KeyhiveRuntime instead, or use import type.\n"
  );
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log("isolation ok: the built library imports only React");
