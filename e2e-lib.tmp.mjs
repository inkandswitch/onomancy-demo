import { chromium } from "playwright";
export const PROFILE = "/home/expede/.pi/keyhive-demo/pw-profile";
export async function open({ quiet = false } = {}) {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: "/etc/profiles/per-user/expede/bin/chromium",
    headless: true,
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const doh = [];
  page.on("request", (r) => { if (r.url().includes("dns-query")) doh.push(r.url()); });
  if (!quiet) page.on("console", (m) => {
    const t = m.text();
    if (/onomancy|namestore|Could not/i.test(t)) console.log(`  [${m.type()}] ${t.slice(0, 180)}`);
  });
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message.slice(0, 180)}`));
  await page.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.setDemoLogLevel?.("debug"));
  await page.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
  return { ctx, page, doh };
}
export async function settle(page, ms = 6000) { await page.waitForTimeout(ms); }
