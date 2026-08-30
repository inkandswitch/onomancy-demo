import { chromium } from "playwright";
const dir = "/tmp/devlog/pw-s2-" + Date.now();
const ctx = await chromium.launchPersistentContext(dir, {
  executablePath: "/etc/profiles/per-user/expede/bin/chromium", headless: true,
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => window.setDemoLogLevel?.("debug"));
await page.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
await page.waitForTimeout(10_000);

const started = Date.now();
await page.evaluate(() => {
  window.history.replaceState(null, "", "#@brooklynzelenka.com/todos/groceries");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
});
let out = "(never settled)";
for (let i = 0; i < 45; i++) {
  await page.waitForTimeout(1000);
  const pane = (await page.locator("div.flex-1.overflow-hidden").innerText()).replace(/\s+/g," ").trim();
  if (!/^Resolving/.test(pane) && pane.length) { out = pane.slice(0, 200); break; }
}
console.log(`settled after ${((Date.now()-started)/1000).toFixed(1)}s`);
console.log(out);
await ctx.close();
