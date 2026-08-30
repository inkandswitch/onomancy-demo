import { chromium } from "playwright";

const NAME = process.argv[2] ?? "@brooklynzelenka.com/anything";
const browser = await chromium.launch({
  executablePath: "/etc/profiles/per-user/expede/bin/chromium",
  headless: true,
});
const ctx = await browser.newContext();
const page = await ctx.newPage();

const doh = [];
const errors = [];
page.on("console", (m) => {
  const t = m.text();
  if (/onomancy|namestore|Could not|error/i.test(t)) console.log(`  [${m.type()}] ${t.slice(0, 200)}`);
});
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => { if (r.url().includes("dns-query")) doh.push(`${r.method()} ${r.url()}`); });
page.on("response", async (r) => {
  if (r.url().includes("dns-query")) console.log(`  [doh] ${r.status()} ${r.url()}`);
});

console.log("=== load ===");
await page.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
// Step 3: raise the log level.
await page.evaluate(() => window.setDemoLogLevel?.("debug"));

// Wait for the app to mount past "Initializing..."/"Loading...".
await page.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
console.log("app mounted, name box present");

// Give the namestore a moment to be created.
await page.waitForTimeout(5_000);

console.log(`=== resolve ${NAME} ===`);
await page.fill('input[aria-label="Name to resolve"]', NAME);
await page.getByRole("button", { name: "Open" }).click();

// Watch the main pane until it settles.
let last = "";
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
  const txt = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const m = txt.match(/(Resolving [^.]*\.\.\.|No part of that name[^]*?unbound\.|Only \d+ of \d+[^]*?there\.|Could not[^]*?\.|automerge:[A-Za-z0-9]+)/);
  const cur = m ? m[0].slice(0, 300) : "(no match)";
  if (cur !== last) { console.log(`  t+${i + 1}s ${cur}`); last = cur; }
  if (m && !/Resolving/.test(m[0])) break;
}

console.log("=== summary ===");
console.log(`doh requests : ${doh.length}`);
doh.forEach((d) => console.log(`   ${d}`));
console.log(`page errors  : ${errors.length}`);
errors.slice(0, 5).forEach((e) => console.log(`   ${e.slice(0, 200)}`));
console.log(`hash         : ${await page.evaluate(() => location.hash)}`);

await browser.close();
