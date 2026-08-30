import { resolveHostname, setup } from "@inkandswitch/onomancy";
import { stringifyAutomergeUrl } from "@automerge/automerge-repo/slim";
setup();

const HOST = process.argv[2] ?? "brooklynzelenka.com";
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const RECORD =
  /^v=ONO0;k=ed25519;n=(\d+);g=([A-Za-z0-9+/]+={0,2});p=([A-Za-z0-9+/]+={0,2})$/;

console.log(`=== ${HOST} @ ${new Date().toISOString()} ===`);
try {
  const out = await resolveHostname(HOST, null);
  console.log(`links      ${out.links}`);
  console.log(`freshness  ${out.freshness}`);
  console.log(`records    ${out.records.length}`);
  for (const [i, rec] of out.records.entries()) {
    console.log(`\n  [${i}] ${rec}`);
    const m = rec.match(RECORD);
    if (!m) { console.log("      NOT a well-formed v=ONO0 record"); continue; }
    const p = b64ToBytes(m[3]);
    const g = b64ToBytes(m[2]);
    console.log(`      n=          ${m[1]}  (${new Date(Number(m[1])).toISOString()})`);
    console.log(`      g= (ident)  ${hex(g)}`);
    console.log(`      p= (doc)    ${hex(p)}  [${p.length} bytes]`);
    if (p.length === 32) {
      try { console.log(`      p= as url   ${stringifyAutomergeUrl(p)}`); }
      catch (e) { console.log(`      p= url FAIL ${e.message}`); }
    }
  }
} catch (e) {
  console.log(`THREW: ${e.message ?? e}`);
}
