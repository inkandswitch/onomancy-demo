import { open, settle } from "./e2e-lib.tmp.mjs";
const { ctx, page } = await open();
await settle(page, 8000);

// Ensure at least one task list exists.
const rows = page.locator('div[class*="cursor-pointer"]:has(span)');
let count = await page.locator('span:text-matches("^TODO: ")').count();
console.log(`existing lists: ${count}`);
if (count === 0) {
  await page.getByRole("button", { name: "+ New Document" }).click();
  await page.waitForTimeout(8000);
  count = await page.locator('span:text-matches("^TODO: ")').count();
  console.log(`after create  : ${count}`);
}

const target = page.locator('span:text-matches("^TODO: ")').first();
const title = await target.innerText();
console.log(`naming        : ${title}`);

await target.click({ button: "right" });
await page.waitForTimeout(600);
await page.getByText("Name this list...").click();
await page.waitForTimeout(800);

await page.fill('input[aria-label="Name to bind"]', "~/todos/groceries");
await page.getByRole("button", { name: "Bind" }).click();
await page.waitForTimeout(4000);

const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
const ok = body.match(/Bound [^.]*\./);
const err = body.match(/Could not bind[^.]*\.|That names the namestore[^.]*\./);
console.log(`\nresult        : ${ok ? ok[0] : err ? "ERROR: " + err[0] : "(no message)"}`);
if (!ok && !err) console.log(body.slice(0, 500));
await ctx.close();
