import { chromium } from "playwright";
const ARK = "/node_modules/.pnpm/@automerge+automerge-repo-keyhive@0.5.0-alpha.6_ws@8.21.0/node_modules/@automerge/automerge-repo-keyhive/dist/index.js?v=3bb4b288";
const NS = "automerge:2hGvXFhsjhtZPUdqMqreQ2hH8EbpJudhAbURun4H9cUQ84Fps9";
const ctx = await chromium.launchPersistentContext("/home/expede/.pi/keyhive-demo/pw-profile", {
  executablePath: "/etc/profiles/per-user/expede/bin/chromium", headless: true,
});
const p = ctx.pages()[0] ?? (await ctx.newPage());
await p.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
await p.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
await p.waitForTimeout(8000);
const out = await p.evaluate(async ({ ARK, NS }) => {
  try {
    const ark = await import(ARK);
    await window.hive.setPublicAccess(NS, ark.Access.read());
    const after = await window.hive.bestAccessForDoc(NS).catch(() => null);
    return `OK  public read granted; owner best access now = ${after?.toString?.() ?? after}`;
  } catch (e) { return "THREW: " + (e?.message ?? String(e)).slice(0, 250); }
}, { ARK, NS });
console.log(out);
await p.waitForTimeout(15_000);   // let the grant sync out
await ctx.close();
console.log("owner context closed");
