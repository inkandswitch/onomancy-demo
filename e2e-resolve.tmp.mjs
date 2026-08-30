import { open, settle } from "./e2e-lib.tmp.mjs";
const names = process.argv.slice(2);
const { ctx, page, doh } = await open({ quiet: true });
await settle(page, 8000);

// The conditional render target in App.tsx, NOT the sidebar.
const PANE = "div.flex-1.overflow-hidden";

for (const name of names) {
  const before = doh.length;
  // Drive through the hash directly so each case starts clean.
  await page.evaluate((n) => {
    window.history.replaceState(null, "", "#" + n);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, name);

  let out = "(timeout)";
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const pane = (await page.locator(PANE).innerText()).replace(/\s+/g, " ").trim();
    if (/^Resolving /.test(pane)) continue;
    if (/Select or create a document/.test(pane)) { out = "IDLE (name not recognised as a name)"; break; }
    if (/No part of that name|Only \d+ of \d+/.test(pane)) { out = "PARTIAL: " + pane.slice(0, 150); break; }
    if (/publishes no usable|must start with|dotless|Not a DNS|IP literals|reserved for heads|Invalid|Empty segment|traversal/i.test(pane)) {
      out = "ERROR: " + pane.slice(0, 150); break;
    }
    if (pane.length > 0) { out = "RESOLVED -> pane shows: " + pane.slice(0, 90); break; }
  }
  console.log(`${name}\n   ${out}\n   doh: ${doh.length - before}\n`);
}
await ctx.close();
