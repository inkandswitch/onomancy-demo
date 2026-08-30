import { chromium } from "playwright";
const ARK = "/node_modules/.pnpm/@automerge+automerge-repo-keyhive@0.5.0-alpha.6_ws@8.21.0/node_modules/@automerge/automerge-repo-keyhive/dist/index.js?v=3bb4b288";
const NS = "automerge:2hGvXFhsjhtZPUdqMqreQ2hH8EbpJudhAbURun4H9cUQ84Fps9";
const ctx = await chromium.launchPersistentContext("/home/expede/.pi/keyhive-demo/pw-profile", {
  executablePath: "/etc/profiles/per-user/expede/bin/chromium", headless: true,
});
const p = ctx.pages()[0] ?? (await ctx.newPage());
await p.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
await p.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
await p.waitForTimeout(10_000);

const r = await p.evaluate(async ({ ARK, NS }) => {
  const o = {};
  try {
    const ark = await import(ARK);
    o.publicAccessOnNamestore = String(await window.hive.getPublicAccess(NS) ?? "none");
    const members = await window.hive.listMembers(NS);
    o.namestoreMembers = members.map((m) => ({
      id: m.id.slice(0, 12), access: String(m.access),
      isSelf: m.isSelf, isPublic: m.isPublic, isSyncServer: m.isSyncServer,
    }));
    // Compare against a task list, which the demo demonstrably syncs.
    const root = JSON.parse(localStorage.getItem("__none__") ?? "null");
    o.stats = await window.hive.stats().then(s => JSON.stringify(s).slice(0,300)).catch(e=>"stats threw: "+e.message);
  } catch (e) { o.error = String(e?.message ?? e).slice(0, 250); }
  return o;
}, { ARK, NS });
console.log(JSON.stringify(r, null, 2));
await ctx.close();
