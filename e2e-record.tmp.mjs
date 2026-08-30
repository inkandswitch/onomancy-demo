import { open, settle } from "./e2e-lib.tmp.mjs";
const { ctx, page } = await open();
console.log("app mounted; waiting for namestore creation");
await settle(page, 10_000);

await page.getByRole("button", { name: "User profile" }).click();
await page.waitForTimeout(2500);

const body = (await page.locator("body").innerText());
const rec = body.match(/v=ONO0;[^\s]+/);
const nsid = body.match(/automerge:[A-Za-z0-9]+/g);
console.log("\n=== Namestore panel ===");
console.log(`namestore id : ${nsid ? [...new Set(nsid)].join("  ") : "(none found)"}`);
console.log(`dns record   : ${rec ? rec[0] : "(none found)"}`);
if (!rec) console.log(body.replace(/\s+/g, " ").slice(0, 600));
await ctx.close();
