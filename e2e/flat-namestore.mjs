// The flat-namestore migration's definition of done, both halves.
//
// The namestore layout moved from a nested map under the `onomancy` key to
// the document's own top-level map (path-resolution spec, Namestore Layout),
// because the nested layout was invisible to every conforming resolver.
// Passing one reader is not enough: our own resolver can pass while writing
// bytes nobody else can read, and the conforming reader can pass while our
// legacy documents silently stop resolving. So this probe requires BOTH —
//
//   1. onomancy's own `HeldDocuments.edges` (the conforming reader) sees an
//      edge written by `bindEdge`, over the exported document bytes;
//   2. our `edgesOf` still resolves a legacy nested edge during the
//      migration window, and `migrateNamestore` moves it where the
//      conforming reader finds it too;
//
// — plus the guards going red: binds under `.well-known/` and at the app's
// own data keys must refuse before any document is touched.
//
//   node e2e/flat-namestore.mjs
//
// Exits non-zero on any failure.

import { probe } from "./harness.mjs";

const results = await probe("flat-namestore", async () => {
  const { bindEdge, edgesOf, migrateNamestore, RESERVED_ONOMANCY_KEY } =
    await import("/src/namestore.ts");
  // Vite's bare-specifier resolution for page-evaluated code: the same
  // module instance the app already initialized.
  const ono = await import("/@id/@inkandswitch/onomancy");

  const repo = window.repo;
  const out = {};

  const store = await repo.create2({
    ".well-known/onomancy/certificates": [],
  });
  const target = await repo.create2({ kind: "target" });
  const legacyTarget = await repo.create2({ kind: "legacy" });

  // A flat write through the app's own write path...
  await bindEdge(repo, store.url, "todos/groceries", target.url);
  // ...and a legacy nested edge, as every pre-migration document has.
  (await repo.find(store.url)).change((doc) => {
    doc[RESERVED_ONOMANCY_KEY] = { "old/name": legacyTarget.url };
  });

  // Half one: our own reader sees both, legacy via the fallback branch.
  const own = await edgesOf(repo, store.url);
  out.ownSeesFlat = own["todos/groceries"] === target.url;
  out.ownSeesLegacy = own["old/name"] === legacyTarget.url;

  // Half two: the conforming reader, over the exported bytes. It must see
  // the flat edge and must NOT see the nested one — that blindness is the
  // whole reason the migration exists.
  const bytes = await repo.export(store.url);
  out.exportedBytes = bytes?.length ?? 0;
  const held = new ono.HeldDocuments();
  held.hold(store.url, bytes);
  const conforming = held.edges(store.url);
  out.conformingBefore = conforming.map((e) => e.path).sort();
  out.conformingSeesFlat = conforming.some(
    (e) => e.path === "todos/groceries" && e.target === target.url
  );

  // The explicit migration closes the gap: afterwards the conforming
  // reader sees everything and the legacy container is gone.
  out.moved = await migrateNamestore(repo, store.url);
  const after = new ono.HeldDocuments();
  after.hold(store.url, await repo.export(store.url));
  out.conformingAfter = after
    .edges(store.url)
    .map((e) => e.path)
    .sort();
  out.legacyGone =
    (await repo.find(store.url)).doc()?.[RESERVED_ONOMANCY_KEY] === undefined;
  const ownAfter = await edgesOf(repo, store.url);
  out.ownAfter = Object.keys(ownAfter).sort();

  // The guards, verified to go red rather than merely present.
  const refusal = (path) =>
    bindEdge(repo, store.url, path, target.url).then(
      () => "BOUND",
      (error) => error.name
    );
  out.guardWellKnown = await refusal(".well-known/onomancy/certificates");
  out.guardAppData = await refusal("petnames");

  return out;
});

const failures = [];
const expect = (name, actual, wanted) => {
  const a = JSON.stringify(actual);
  const w = JSON.stringify(wanted);
  if (a !== w) failures.push(`${name}: expected ${w}, got ${a}`);
};

expect("our reader sees the flat edge", results.ownSeesFlat, true);
expect(
  "our reader still resolves the legacy edge (migration window)",
  results.ownSeesLegacy,
  true
);
expect(
  "the conforming reader sees the flat edge over exported bytes",
  results.conformingSeesFlat,
  true
);
expect(
  "the conforming reader is blind to the nested edge (why we migrate)",
  results.conformingBefore,
  ["todos/groceries"]
);
expect("migration moves the legacy edge", results.moved, 1);
expect(
  "after migration the conforming reader sees everything",
  results.conformingAfter,
  ["old/name", "todos/groceries"]
);
expect("the emptied legacy container is removed", results.legacyGone, true);
expect(
  "a bind under .well-known/ refuses before touching the document",
  results.guardWellKnown,
  "ReservedPathError"
);
expect(
  "a bind at an app-data key refuses too",
  results.guardAppData,
  "ReservedPathError"
);

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log("\nflat-namestore: all assertions hold");
