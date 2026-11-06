// Contrôles dans un vrai navigateur (Chromium, rendu logiciel : marche en CI sans carte graphique).
//   npm i && npx playwright install chromium && node tests/browser.mjs
// 1. tests/lifecycle.html : contexte WebGL perdu puis rendu, double montage, dispose() ;
// 2. chaque démo et chaque exemple se charge, prépare sa scène (__demo.ready) sans erreur JS.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "../plugins/premium-3d/skills/premium-3d/tools/browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".otf": "font/otf", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".hdr": "application/octet-stream" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const pages = [
  ...fs.readdirSync(path.join(ROOT, "plugins/premium-3d/skills/premium-3d/demos")).filter((f) => f.endsWith(".html")).map((f) => `plugins/premium-3d/skills/premium-3d/demos/${f}`),
  ...fs.readdirSync(path.join(ROOT, "examples")).map((d) => `examples/${d}/index.html`),
  "index.html",
];
const TIMEOUT = Number(process.env.P3D_TIMEOUT || 60000);
const browser = await launch("cpu");
const failures = [];
const BENIGN = /Failed to load resource|favicon|GPU stall|WebGL: INVALID_OPERATION: delete/i; // 404 de favicon, avertissements du rendu logiciel

async function open(url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !BENIGN.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE + url, { waitUntil: "load", timeout: TIMEOUT });
  return { page, errs };
}

/* 1. cycle de vie */
{
  const { page, errs } = await open("tests/lifecycle.html");
  const R = await page.waitForFunction(() => window.__result, null, { timeout: TIMEOUT }).then((h) => h.jsonValue());
  const bad = Object.entries(R).filter(([, v]) => v !== true);
  console.log(`${bad.length || errs.length ? "ÉCHEC" : "ok   "} tests/lifecycle.html ${JSON.stringify(R)}`);
  if (bad.length) failures.push(`lifecycle : ${bad.map(([k, v]) => `${k} = ${v}`).join(", ")}`);
  if (errs.length) failures.push(`lifecycle : ${errs.join(" | ")}`);
  await page.close();
}

/* 2. démos et exemples */
for (const url of pages) {
  const t0 = Date.now();
  let res;
  try {
    res = await open(url);
    /* page avec __demo : attendre que la scène soit prête ; sinon laisser 3 s au premier rendu */
    const hasDemo = await res.page.evaluate(() => "__demo" in window);
    if (hasDemo) await res.page.waitForFunction(() => window.__demo && window.__demo.ready, null, { timeout: TIMEOUT });
    else await res.page.waitForTimeout(3000);
    await res.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await res.page.waitForTimeout(500);
  } catch (e) { (res ? res.errs : (res = { errs: [] }).errs).push(`pas prête en ${TIMEOUT / 1000} s : ${String(e.message).split("\n")[0]}`); }
  const ok = !res.errs.length;
  console.log(`${ok ? "ok   " : "ÉCHEC"} ${url} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (!ok) failures.push(`${url} : ${res.errs.join(" | ")}`);
  if (res.page) await res.page.close();
}

await browser.close();
server.close();
if (failures.length) { console.error(`\n${failures.length} échec(s) :\n- ${failures.join("\n- ")}`); process.exit(1); }
console.log("\nOK");
