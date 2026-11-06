// Contrôle de new.mjs --vendor (CI : télécharge three.js depuis jsdelivr) :
// 1. chaque import relatif des fichiers copiés dans vendor/three/ existe ;
// 2. dans Chromium, AVEC LE CDN COUPÉ, chaque module de lib/ du projet se charge, et les décodeurs
//    de models.js pointent vers vendor/three/ : le site marche sans aucun service tiers.
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { launch } from "../plugins/premium-3d/skills/premium-3d/tools/browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p3d-vendor-"));
const MODS = "story,particles,swarm,models,fx,text3d,logo3d,icon3d,textures,forms,shaders,objects3d,ribbon,terrain,cloth,ink,daylight";
console.log(execFileSync(process.execPath, [path.join(ROOT, "plugins/premium-3d/skills/premium-3d/tools/new.mjs"), dir, "--vendor", "--modules", MODS], { encoding: "utf8" }).trim());

const errors = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(path.join(dir, "vendor")).filter((f) => f.endsWith(".js"))) {
  for (const m of fs.readFileSync(f, "utf8").matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g))
    if (!fs.existsSync(path.resolve(path.dirname(f), m[1]))) errors.push(`${path.relative(dir, f)} importe ${m[1]}, absent`);
}
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
if (/cdn\.jsdelivr/.test(html)) errors.push("index.html pointe encore vers le CDN");
const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
if (!fs.existsSync(path.join(dir, map.three))) errors.push(`importmap : ${map.three} absent`);

/* page de test : même importmap, importe chaque module copié */
const mods = fs.readdirSync(path.join(dir, "lib")).filter((f) => f.endsWith(".js") && !["react.js", "r3f.js"].includes(f));
fs.writeFileSync(path.join(dir, "test.html"), `<!doctype html><meta charset="utf-8">
<script type="importmap">${JSON.stringify({ imports: map })}</script>
<script type="module">
const R = { ok: [], ko: [] };
for (const m of ${JSON.stringify(mods)}) { try { await import("./lib/" + m); R.ok.push(m); } catch (e) { R.ko.push(m + " : " + e.message); } }
R.decodeurs = import.meta.resolve("three/addons/libs/");
window.__r = R;
</script>`);

const server = http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".wasm") ? "application/wasm" : "text/html" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await launch("cpu");
const page = await browser.newPage();
const cdn = [];
await page.route(/jsdelivr|unpkg|esm\.sh/, (route) => { cdn.push(route.request().url()); route.abort(); });
await page.goto(`http://127.0.0.1:${server.address().port}/test.html`);
const R = await page.waitForFunction(() => window.__r, null, { timeout: 60000 }).then((h) => h.jsonValue());
await browser.close(); server.close();

console.log(`modules chargés sans CDN : ${R.ok.length}/${mods.length} ; décodeurs : ${R.decodeurs}`);
R.ko.forEach((k) => errors.push(`module : ${k}`));
cdn.forEach((u) => errors.push(`appel au CDN : ${u}`));
if (!/\/vendor\/three\/examples\/jsm\/libs\/$/.test(R.decodeurs)) errors.push(`décodeurs hors de vendor/ : ${R.decodeurs}`);
for (const d of ["draco/gltf/draco_decoder.wasm", "basis/basis_transcoder.wasm"]) if (!fs.existsSync(path.join(dir, "vendor/three/examples/jsm/libs", d))) errors.push(`${d} absent`);
fs.rmSync(dir, { recursive: true, force: true });
if (errors.length) { console.error(`ÉCHEC :\n- ${errors.join("\n- ")}`); process.exit(1); }
console.log("OK");
