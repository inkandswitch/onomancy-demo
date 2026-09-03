// Are the linked dependencies' build artifacts newer than their sources?
//
// `readlink -f node_modules/<pkg>` answers *what runs here* rather than *what
// exists somewhere*, which is the check that catches reading a sibling tree
// nothing resolves. But it is not sufficient for a linked package that ships a
// build artifact.
//
// Every package here resolves through `main`/`module` to `dist/`, not `src/`.
// So a live link stays live-looking while the bytes being executed drift
// behind the source someone is reading and editing. `readlink` reports the
// link the whole time and cannot see the gap.
//
// This happened during a cross-session integration: a `cargo fmt` import
// reorder landed after the last Wasm build, so upstream's source and the bytes
// running in this browser had genuinely diverged. It was a semantic no-op that
// time. The divergence was real, invisible from here, and would have been
// indistinguishable from a substantive change.
//
// Both artifacts that answer "what runs" are the ones that do not look
// authoritative: the stalest-looking version string can belong to the live
// tree, and `dist/` carries a plausible recent mtime whether or not it matches
// `src/`.
//
//   node scripts/check-linked-freshness.mjs
//
// Exits non-zero when anything is stale, so it can gate an integration run.

import { lstatSync, readdirSync, readlinkSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const MODULES = join(ROOT, "node_modules");
const SOURCE_EXTENSIONS = [".rs", ".ts", ".tsx", ".js", ".jsx"];
const ARTIFACT_EXTENSIONS = [".js", ".mjs", ".cjs", ".wasm", ".d.ts"];

/** Symlinked packages whose target lies outside this project. */
function linkedPackages() {
  const found = [];

  const consider = (name, path) => {
    let target;
    try {
      // `lstatSync`, not `statSync`: stat follows the link, so a symlink
      // whose target has vanished reads as "nothing here" and gets silently
      // skipped — the strongest possible form of "what you read is not what
      // executes", reported as clean. The link itself is the fact to check.
      if (!lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) return;
      target = resolve(join(path, ".."), readlinkSync(path));
    } catch {
      return; // Unreadable. Not a link we can reason about.
    }
    // Links into `.pnpm/` are the store's own indirection, not a live tree.
    if (target.includes("/.pnpm/") || target.startsWith(ROOT + "/node_modules"))
      return;
    const broken = !statSync(target, { throwIfNoEntry: false });
    found.push({ name, target, broken });
  };

  for (const entry of readdirSync(MODULES)) {
    if (entry.startsWith("@")) {
      for (const scoped of readdirSync(join(MODULES, entry))) {
        consider(`${entry}/${scoped}`, join(MODULES, entry, scoped));
      }
    } else {
      consider(entry, join(MODULES, entry));
    }
  }
  return found;
}

/**
 * Newest mtime among files under `dir` with one of `extensions`.
 *
 * Walked in Node rather than shelled out to `find -printf`, which is a GNU
 * extension: on a BSD/macOS `find` the spawn threw, the catch swallowed it,
 * and a missing *tool* read as "consumed from source" — a false green.
 */
function newestFile(dir, extensions) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory())
    return undefined; // No such directory. Reported as unknown, not as stale.

  let out;
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (
        entry.isFile() &&
        extensions.some((extension) => path.endsWith(extension))
      ) {
        const time = statSync(path).mtimeMs / 1000;
        if (!out || time > out.time) out = { time, path };
      }
    }
  };
  walk(dir);
  return out;
}

let stale = 0;
let checked = 0;

for (const { name, target, broken } of linkedPackages()) {
  // A dangling link is the drift in its terminal form: nothing at all backs
  // the bytes the resolver would serve. STALE, never "nothing to check".
  if (broken) {
    stale += 1;
    checked += 1;
    console.log(
      `  STALE  ${name}\n` +
        `      broken link: ${target.replace(process.env.HOME ?? "", "~")} does not exist`
    );
    continue;
  }

  const artifact = newestFile(join(target, "dist"), ARTIFACT_EXTENSIONS);
  const source = newestFile(join(target, "src"), SOURCE_EXTENSIONS);

  // No dist means the package is consumed from source, so there is nothing to
  // drift. No src means we cannot tell, and saying so beats implying freshness.
  if (!artifact || !source) {
    console.log(`  ${name}\n      consumed from source or unbuildable here`);
    continue;
  }

  checked += 1;
  const behindBy = source.time - artifact.time;
  if (behindBy > 0) {
    stale += 1;
    console.log(
      `  STALE  ${name}\n` +
        `      running bytes are ${Math.round(behindBy)}s older than its source\n` +
        `      newest source:   ${source.path.replace(target + "/", "")}\n` +
        `      newest artifact: ${artifact.path.replace(target + "/", "")}`
    );
  } else {
    console.log(
      `  ok     ${name}  ->  ${target.replace(process.env.HOME ?? "", "~")}`
    );
  }
}

if (stale > 0) {
  console.error(
    `\n${stale} of ${checked} linked packages are running bytes older than ` +
      `their source. Rebuild upstream before trusting an integration result: ` +
      `what you read is not what executes.`
  );
  process.exit(1);
}

console.log(`\n${checked} linked packages current.`);
