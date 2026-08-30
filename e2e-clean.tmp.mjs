import { chromium } from "playwright";
const ARK = "/node_modules/.pnpm/@automerge+automerge-repo-keyhive@0.5.0-alpha.6_ws@8.21.0/node_modules/@automerge/automerge-repo-keyhive/dist/index.js?v=3bb4b288";
const EXE = "/etc/profiles/per-user/expede/bin/chromium";
const boot = async (dir) => {
  const c = await chromium.launchPersistentContext(dir, { executablePath: EXE, headless: true });
  const p = c.pages()[0] ?? (await c.newPage());
  await p.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
  await p.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
  await p.waitForTimeout(12_000);   // let first-run namestore creation finish
  return { c, p };
};
const tryRead = (p, url, ms = 30000) => p.evaluate(async ([u, ms]) => {
  const t = Date.now();
  return await Promise.race([
    window.repo.find(u).then(h => ({ k: "RESOLVED", ms: Date.now()-t }), e => ({ k: "REJECTED", ms: Date.now()-t })),
    new Promise(r => setTimeout(() => r({ k: "PENDING", ms }), ms)),
  ]);
}, [url, ms]);

// A COMPLETELY CLEAN first run: the app creates its own namestore on mount.
const A = await boot("/tmp/devlog/pw-clean-A-" + Date.now());
const nsA = await A.p.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.startsWith("keyhive-demo-namestore-") && !x.includes("origin"));
  return k ? localStorage.getItem(k) : null;
});
console.log(`clean-run namestore : ${nsA}`);

const B = await boot("/tmp/devlog/pw-clean-B-" + Date.now());
const cardB = await B.p.evaluate(() => window.hive.active.contactCard.toJson());

const shared = await A.p.evaluate(async ({ ARK, ns, json }) => {
  try {
    const ark = await import(ARK);
    await window.hive.setPublicAccess(ns, ark.Access.read());
    await window.hive.addMemberToDoc(ns, ark.ContactCard.fromJson(json), ark.Access.read());
    return "shared public+explicit";
  } catch (e) { return "THREW: " + String(e?.message ?? e).slice(0,150); }
}, { ARK, ns: nsA, json: cardB });
console.log(`A shares with B     : ${shared}`);
await A.p.waitForTimeout(20_000);

console.log(`B reads A namestore : ${JSON.stringify(await tryRead(B.p, nsA))}`);
await A.c.close(); await B.c.close();
