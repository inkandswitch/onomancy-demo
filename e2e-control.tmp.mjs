import { chromium } from "playwright";
const ARK = "/node_modules/.pnpm/@automerge+automerge-repo-keyhive@0.5.0-alpha.6_ws@8.21.0/node_modules/@automerge/automerge-repo-keyhive/dist/index.js?v=3bb4b288";
const EXE = "/etc/profiles/per-user/expede/bin/chromium";
const boot = async (dir) => {
  const c = await chromium.launchPersistentContext(dir, { executablePath: EXE, headless: true });
  const p = c.pages()[0] ?? (await c.newPage());
  await p.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
  await p.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
  await p.waitForTimeout(9000);
  return { c, p };
};
const tryRead = (p, url, ms = 40000) => p.evaluate(async ([u, ms]) => {
  const t = Date.now();
  return await Promise.race([
    window.repo.find(u).then(
      h => ({ k: "RESOLVED", ms: Date.now()-t }),
      e => ({ k: "REJECTED", ms: Date.now()-t, msg: String(e?.message ?? e).slice(0,90) })),
    new Promise(r => setTimeout(() => r({ k: "PENDING", ms }), ms)),
  ]);
}, [url, ms]);

const S = await boot("/tmp/devlog/pw-ctl-" + Date.now());
const card = await S.p.evaluate(() => window.hive.active.contactCard.toJson());

const O = await boot("/home/expede/.pi/keyhive-demo/pw-profile");
// CONTROL: a brand-new task list, created and shared exactly as the demo does.
const listUrl = await O.p.evaluate(async ({ ARK, json }) => {
  const ark = await import(ARK);
  const h = await window.repo.create2({ title: "control list", tasks: [] });
  await window.hive.addSyncServerRelayToDoc(h.url);
  const cc = ark.ContactCard.fromJson(json);
  await window.hive.addMemberToDoc(h.url, cc, ark.Access.read());
  return h.url;
}, { ARK, json: card });
console.log(`control list     : ${listUrl}`);
await O.p.waitForTimeout(15_000);

console.log(`stranger (no reload): ${JSON.stringify(await tryRead(S.p, listUrl))}`);
// Delegations may only be picked up on a fresh session.
await S.p.reload({ waitUntil: "domcontentloaded" });
await S.p.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
await S.p.waitForTimeout(12_000);
console.log(`stranger (reloaded) : ${JSON.stringify(await tryRead(S.p, listUrl))}`);

await O.c.close(); await S.c.close();
