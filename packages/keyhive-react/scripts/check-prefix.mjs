// Fails the build if the library uses a Tailwind class without the kh- prefix.
//
// The shipped stylesheet only contains prefixed classes, so an unprefixed one
// styles nothing in an application without Tailwind and silently picks up the
// host's styling in one with it. Neither looks like an error.
//
// The method is to run Tailwind over the source with no prefix. Any utility it
// still generates is a class this package needed and did not prefix.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PACKAGE_DIR = new URL("..", import.meta.url).pathname;

// Words that are Tailwind utilities and also ordinary English or JavaScript.
// Tailwind's extractor cannot tell `.filter(...)` from a class name.
const KNOWN_FALSE_POSITIVES = new Set([
  "contents",
  "ease-out",
  "filter",
  "hidden",
  "table",
]);

const work = mkdtempSync(join(tmpdir(), "kh-prefix-"));
const configPath = join(work, "tailwind.config.js");
const inputPath = join(work, "in.css");
const outputPath = join(work, "out.css");

writeFileSync(
  configPath,
  `export default {
     prefix: "",
     content: ["${PACKAGE_DIR}src/**/*.{ts,tsx}"],
     corePlugins: { preflight: false },
     theme: {},
     plugins: [],
   };`
);
writeFileSync(inputPath, "@tailwind utilities;\n");

execFileSync(
  "npx",
  ["tailwindcss", "-c", configPath, "-i", inputPath, "-o", outputPath],
  { cwd: PACKAGE_DIR, stdio: "pipe" }
);

const generated = [
  ...readFileSync(outputPath, "utf8").matchAll(/^\.([a-zA-Z0-9_\\:./-]+)/gm),
].map(([, name]) => name.replace(/\\/g, ""));

const unprefixed = [...new Set(generated)]
  .filter((name) => !KNOWN_FALSE_POSITIVES.has(name))
  .sort();

if (unprefixed.length > 0) {
  console.error(
    "These Tailwind classes are used without the kh- prefix, so they are\n" +
      "missing from dist/keyhive-react.css:\n"
  );
  for (const name of unprefixed) console.error(`  ${name}`);
  console.error(
    "\nPrefix them, or add them to KNOWN_FALSE_POSITIVES if they are not classes."
  );
  process.exit(1);
}

console.log("prefix ok: every Tailwind class in the library is kh- prefixed");
