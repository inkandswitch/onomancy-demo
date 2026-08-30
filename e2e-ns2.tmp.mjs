import { chromium } from "playwright";
const ARK = "/node_modules/.pnpm/@automerge+automerge-repo-keyhive@0.5.0-alpha.6_ws@8.21.0/node_modules/@automerge/automerge-repo-keyhive/dist/index.js?v=3bb4b288";
const OLD = "automerge:2hGvXFhsjhtZPUdqMqreQ2hH8EbpJudhAbURun4H9cUQ84Fps9";
const EXE = "/etc/profiles/per-user/expede/bin/chromium";
const boot = async (dir) => {
  const c = await chromium.launchPersistentContext(dir, { executablePath: EXE, headless: true });
  const p = c.pages()[0] ?? (await c.newPage());
  await p.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
  await p.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
  await p.waitForTimeout(9000);
  return { c, p };
};
const tryRead = (p, url, ms = 30000) => p.evaluate(async ([u, ms]) => {
  const t = Date.now();
  return await Promise.race([
    window.repo.find(u).then(h => ({ k: "RESOLVED", ms: Date.now()-t }),
      e => ({ k: "REJECTED", ms: Date.now()-t, msg: String(e?.message ?? e).slice(0,80) })),
    new Promise(r => setTimeout(() => r({ k: "PENDING", ms }), ms)),
  ]);
}, [url, ms]);

const S = await boot("/tmp/devlog/pw-ns2-" + Date.now());
const card = await S.p.evaluate(() => window.hive.active.contactCard.toJson());
const O = await boot("/home/expede/.pi/keyhive-demo/pw-profile");

// A NEW namestore-shaped document, created now with a live connection.
const fresh = await O.p.evaluate(async ({ ARK, json }) => {
  const ark = await import(ARK);
  const h = await window.repo.create2({ onomancy: { "todos/fresh": "automerge:2qJK2vhy3gTfJxM3P4UGsZGhKyuU2MCbynQsfHLxJrKSycoXkQ" } });
  await window.hive.addSyncServerRelayToDoc(h.url);
  await window.hive.setPublicAccess(h.url, ark.Access.read());
  await window.hive.addMemberToDoc(h.url, ark.ContactCard.fromJson(json), ark.Access.read());
  return h.url;
}, { ARK, json: card });
console.log(`fresh namestore  : ${fresh}`);
console.log(`owner sees OLD   : ${JSON.stringify(await tryRead(O.p, OLD, 8000))}`);
await O.p.waitForTimeout(15_000);

console.log(`stranger FRESH   : ${JSON.stringify(await tryRead(S.p, fresh))}`);
console.log(`stranger OLD     : ${JSON.stringify(await tryRead(S.p, OLD))}`);
await O.c.close(); await S.c.close();
