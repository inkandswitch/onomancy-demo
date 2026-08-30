import { chromium } from "playwright";
const OLD = "automerge:2hGvXFhsjhtZPUdqMqreQ2hH8EbpJudhAbURun4H9cUQ84Fps9";
const EXE = "/etc/profiles/per-user/expede/bin/chromium";
const boot = async (dir) => {
  const c = await chromium.launchPersistentContext(dir, { executablePath: EXE, headless: true });
  const p = c.pages()[0] ?? (await c.newPage());
  await p.goto("http://127.0.0.1:5557/", { waitUntil: "domcontentloaded" });
  await p.waitForSelector('input[aria-label="Name to resolve"]', { timeout: 90_000 });
  await p.waitForTimeout(9000);
  return { c, p };
};
const tryRead = (p, url, ms = 30000) => p.evaluate(async ([u, ms]) => {
  const t = Date.now();
  return await Promise.race([
    window.repo.find(u).then(h => ({ k: "RESOLVED", ms: Date.now()-t, doc: JSON.stringify(h.doc()).slice(0,120) }),
      e => ({ k: "REJECTED", ms: Date.now()-t })),
    new Promise(r => setTimeout(() => r({ k: "PENDING", ms }), ms)),
  ]);
}, [url, ms]);

const O = await boot("/home/expede/.pi/keyhive-demo/pw-profile");
// Touch the stranded document with a live connection: does it upload now?
const touched = await O.p.evaluate(async (OLD) => {
  const h = await window.repo.find(OLD);
  h.change((d) => { d.onomancy ??= {}; d.onomancy["todos/touched"] = "automerge:2qJK2vhy3gTfJxM3P4UGsZGhKyuU2MCbynQsfHLxJrKSycoXkQ"; });
  return JSON.stringify(h.doc()).slice(0, 200);
}, OLD);
console.log(`owner touched    : ${touched}`);
await O.p.waitForTimeout(20_000);

const S = await boot("/tmp/devlog/pw-rescue-" + Date.now());
console.log(`stranger OLD now : ${JSON.stringify(await tryRead(S.p, OLD))}`);
await O.c.close(); await S.c.close();
