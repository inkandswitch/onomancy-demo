import { chromium } from "playwright";
// A FRESH profile = a fresh keyhive identity = "somebody else".
const DIR = "/tmp/devlog/pw-stranger-" + Date.now();
const ctx = await chromium.launchPersistentContext(DIR, {
  executablePath: "/etc/profiles/per-user/expede/bin/chromium",
  headless: true,
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("console", (m) => {
  const t = m.text();
  if (/unavailable|onomancy|Could not/i.test(t)) console.log(`  [${m.type()}] ${t.slice(0,160)}`);
});
await page.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => window.setDemoLogLevel?.("debug"));
await page.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
await page.waitForTimeout(10_000);

const selfId = await page.evaluate(() =>
  [...window.hive.active.individual.id.toBytes()].map(b=>b.toString(16).padStart(2,"0")).join(""));
console.log(`stranger identity : ${selfId}`);
console.log(`owner identity    : 420e1d23c50dd8f56062225013621a1ccabea333264e5acfa3570f40c9cf87c0`);
console.log(`same?             : ${selfId === "420e1d23c50dd8f56062225013621a1ccabea333264e5acfa3570f40c9cf87c0"}`);

// Can the stranger read the DNS-designated namestore directly?
const direct = await page.evaluate(async () => {
  try {
    const h = await window.repo.find("automerge:2hGvXFhsjhtZPUdqMqreQ2hH8EbpJudhAbURun4H9cUQ84Fps9");
    return "OK: " + JSON.stringify(h.doc()).slice(0, 160);
  } catch (e) { return "THREW: " + (e?.message ?? String(e)).slice(0, 160); }
});
console.log(`\nrepo.find(namestore) : ${direct}`);

await page.evaluate(() => {
  window.history.replaceState(null, "", "#@brooklynzelenka.com/todos/groceries");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
});
for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(1000);
  const pane = (await page.locator("div.flex-1.overflow-hidden").innerText()).replace(/\s+/g," ").trim();
  if (!/^Resolving/.test(pane) && pane.length) { console.log(`\nresolve as stranger  : ${pane.slice(0,180)}`); break; }
}
await ctx.close();
