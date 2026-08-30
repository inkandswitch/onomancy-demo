import { chromium } from "playwright";
const NS = "automerge:2hGvXFhsjhtZPUdqMqreQ2hH8EbpJudhAbURun4H9cUQ84Fps9";
const dir = "/tmp/devlog/pw-hang-" + Date.now();
const ctx = await chromium.launchPersistentContext(dir, {
  executablePath: "/etc/profiles/per-user/expede/bin/chromium", headless: true,
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
await page.waitForTimeout(10_000);

// Race repo.find against a timer, entirely inside the page.
const out = await page.evaluate(async (NS) => {
  const started = Date.now();
  const race = await Promise.race([
    window.repo.find(NS).then(
      (h) => ({ kind: "resolved", ms: Date.now() - started, doc: JSON.stringify(h.doc()).slice(0, 120) }),
      (e) => ({ kind: "rejected", ms: Date.now() - started, msg: String(e?.message ?? e).slice(0, 120) })
    ),
    new Promise((r) => setTimeout(() => r({ kind: "STILL PENDING", ms: 60000 }), 60000)),
  ]);
  return race;
}, NS);
console.log(JSON.stringify(out, null, 2));
await ctx.close();
