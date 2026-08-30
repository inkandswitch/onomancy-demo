import { chromium } from "playwright";
const ARK = "/node_modules/.pnpm/@automerge+automerge-repo-keyhive@0.5.0-alpha.6_ws@8.21.0/node_modules/@automerge/automerge-repo-keyhive/dist/index.js?v=3bb4b288";
const NS = "automerge:2hGvXFhsjhtZPUdqMqreQ2hH8EbpJudhAbURun4H9cUQ84Fps9";
const EXE = "/etc/profiles/per-user/expede/bin/chromium";
const boot = async (dir) => {
  const c = await chromium.launchPersistentContext(dir, { executablePath: EXE, headless: true });
  const p = c.pages()[0] ?? (await c.newPage());
  await p.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
  await p.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
  await p.waitForTimeout(9000);
  return { c, p };
};

// 1. Stranger: identity + contact card JSON
const sdir = "/tmp/devlog/pw-share-" + Date.now();
const S = await boot(sdir);
const card = await S.p.evaluate(() => {
  const cc = window.hive.active.contactCard;
  for (const k of ["toJson", "toJSON", "toString"]) {
    try { const v = cc[k]?.(); if (typeof v === "string" && v.length > 20) return { how: k, json: v }; } catch {}
  }
  return { how: "none", keys: Object.getOwnPropertyNames(Object.getPrototypeOf(cc)) };
});
console.log(`contact card via : ${card.how}${card.keys ? " keys=" + card.keys.join(",") : ""}`);
if (!card.json) { await S.c.close(); process.exit(0); }
const sid = await S.p.evaluate(() => [...window.hive.active.individual.id.toBytes()].map(b=>b.toString(16).padStart(2,"0")).join(""));
console.log(`stranger id      : ${sid.slice(0,16)}...`);

// 2. Owner: add the stranger explicitly as Read on the namestore
const O = await boot("/home/expede/.pi/keyhive-demo/pw-profile");
const added = await O.p.evaluate(async ({ ARK, NS, json }) => {
  try {
    const ark = await import(ARK);
    const cc = ark.ContactCard.fromJson(json);
    if (!cc) return "ContactCard.fromJson returned undefined";
    await window.hive.addMemberToDoc(NS, cc, ark.Access.read());
    return "added as Read";
  } catch (e) { return "THREW: " + String(e?.message ?? e).slice(0, 200); }
}, { ARK, NS, json: card.json });
console.log(`owner add member : ${added}`);
await O.p.waitForTimeout(15_000);
await O.c.close();

// 3. Stranger: can it read now?
const got = await S.p.evaluate(async (NS) => {
  const t = Date.now();
  return await Promise.race([
    window.repo.find(NS).then(
      h => ({ k: "RESOLVED", ms: Date.now()-t, doc: JSON.stringify(h.doc()).slice(0,150) }),
      e => ({ k: "REJECTED", ms: Date.now()-t, msg: String(e?.message ?? e).slice(0,120) })),
    new Promise(r => setTimeout(() => r({ k: "STILL PENDING", ms: 45000 }), 45000)),
  ]);
}, NS);
console.log(`stranger read    : ${JSON.stringify(got)}`);
await S.c.close();
