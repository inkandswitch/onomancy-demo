import { chromium } from "playwright";
const dir = "/tmp/devlog/pw-dbg-" + Date.now();
const ctx = await chromium.launchPersistentContext(dir, {
  executablePath: "/etc/profiles/per-user/expede/bin/chromium", headless: true,
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("crash", () => console.log("!! PAGE CRASHED"));
page.on("close", () => console.log("!! PAGE CLOSED"));
page.on("pageerror", (e) => console.log("!! pageerror: " + e.message.slice(0,200)));
ctx.on("close", () => console.log("!! CONTEXT CLOSED"));
try {
  await page.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
  console.log("goto ok");
  await page.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
  console.log("mounted ok");
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(5000);
    console.log(`t+${(i+1)*5}s  closed=${page.isClosed()}`);
    if (page.isClosed()) break;
  }
} catch (e) { console.log("ERR: " + e.message.split("\n")[0]); }
if (!page.isClosed()) await ctx.close();
