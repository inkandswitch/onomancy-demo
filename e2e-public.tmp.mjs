import { chromium } from "playwright";
const ARK = "/node_modules/.pnpm/@automerge+automerge-repo-keyhive@0.5.0-alpha.6_ws@8.21.0/node_modules/@automerge/automerge-repo-keyhive/dist/index.js?v=3bb4b288";
const NS = "automerge:2hGvXFhsjhtZPUdqMqreQ2hH8EbpJudhAbURun4H9cUQ84Fps9";

// --- 1. OWNER: grant public read on the namestore -------------------------
const owner = await chromium.launchPersistentContext("/home/expede/.pi/keyhive-demo/pw-profile", {
  executablePath: "/etc/profiles/per-user/expede/bin/chromium", headless: true,
});
const op = owner.pages()[0] ?? (await owner.newPage());
await op.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
await op.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
await op.waitForTimeout(8000);

const grant = await op.evaluate(async ({ ARK, NS }) => {
  try {
    const ark = await import(ARK);
    const before = await window.hive.bestAccessForDoc(NS).catch(() => null);
    await window.hive.setPublicAccess(NS, ark.Access.read());
    return `granted; access before = ${before?.toString?.() ?? before}`;
  } catch (e) { return "THREW: " + (e?.message ?? String(e)).slice(0, 200); }
}, { ARK, NS });
console.log(`owner grant       : ${grant}`);
await op.waitForTimeout(12_000);   // let it sync
await owner.close();

// --- 2. STRANGER: fresh identity, try to resolve --------------------------
const dir = "/tmp/devlog/pw-stranger2-" + Date.now();
const s = await chromium.launchPersistentContext(dir, {
  executablePath: "/etc/profiles/per-user/expede/bin/chromium", headless: true,
});
const sp = s.pages()[0] ?? (await s.newPage());
await sp.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
await sp.evaluate(() => window.setDemoLogLevel?.("debug"));
await sp.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
await sp.waitForTimeout(10_000);

const direct = await sp.evaluate(async (NS) => {
  try { const h = await window.repo.find(NS); return "OK: " + JSON.stringify(h.doc()).slice(0, 200); }
  catch (e) { return "THREW: " + (e?.message ?? String(e)).slice(0, 160); }
}, NS);
console.log(`stranger find(ns) : ${direct}`);

await sp.evaluate(() => {
  window.history.replaceState(null, "", "#@brooklynzelenka.com/todos/groceries");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
});
for (let i = 0; i < 30; i++) {
  await sp.waitForTimeout(1000);
  const pane = (await sp.locator("div.flex-1.overflow-hidden").innerText()).replace(/\s+/g," ").trim();
  if (!/^Resolving/.test(pane) && pane.length) { console.log(`stranger resolve  : ${pane.slice(0,200)}`); break; }
}
await s.close();
