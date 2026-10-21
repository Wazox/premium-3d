// Contrôle visuel d'une page 3D : captures à plusieurs hauteurs de scroll, desktop et mobile,
// erreurs console, débordement horizontal.
// Prérequis : npm i playwright
// Usage :
//   node tools/check.mjs <url> [dossier] [--section "#ma-section"] [--points 0,0.25,0.5,0.75,1] [--full]
//                        [--poster img/poster.jpg]
// --full : avec le post-traitement (bloom, effets) ; plus lent sans carte graphique.
// Sans --section, les points sont pris sur toute la hauteur de la page.
// Si la page expose window.__demo.ready (ou window.__scene.ready), on attend que la 3D soit prête.
// Produit aussi <dossier>/report.html : planche de toutes les captures + erreurs + notes du jury.
// Détecte aussi, à chaque capture, une 3D qui touche le bord de l'écran (objet probablement coupé) :
// signalé « à vérifier », car une scène peut déborder exprès (fond plein, décor qui sort du cadre).
// Notes du jury : écrire <dossier>/jury.json (voir SKILL.md) puis relancer avec --report-only.
import { chromium } from "playwright";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const full = args.includes("--full"); if (full) args.splice(args.indexOf("--full"), 1);
const reportOnly = args.includes("--report-only"); if (reportOnly) args.splice(args.indexOf("--report-only"), 1);
const posterPath = opt("--poster", null); // ex. --poster img/poster.jpg : image de la zone 3D (1er canvas), 1re capture ordinateur
const section = opt("--section", null);
const points = opt("--points", "0,0.15,0.3,0.45,0.6,0.75,0.9").split(",").map(Number);
const url = args[0] || "http://127.0.0.1:5180";
const out = args[1] || "./captures";
fs.mkdirSync(out, { recursive: true });

const shots = [];
if (!reportOnly) {
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [], warnings = [];
// mobile : écran haute densité (3×, comme un iPhone) et tactile, pour voir ce que voit un vrai téléphone
for (const v of [{ name: "desktop", width: 1280, height: 720 }, { name: "mobile", width: 390, height: 844, mobile: true }]) {
  const page = await browser.newPage({ viewport: { width: v.width, height: v.height }, reducedMotion: "reduce", ...(v.mobile ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}) });
  page.on("pageerror", (e) => errors.push(`[${v.name}] ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${v.name}] ${m.text().slice(0, 200)}`); });
  await page.goto(full ? url : url + (url.includes("?") ? "&" : "?") + "lite", { waitUntil: "load", timeout: 90000 });
  await page.waitForFunction(() => { const d = window.__demo || window.__scene; return !d || d.ready; }, null, { timeout: 120000 }).catch(() => errors.push(`[${v.name}] la 3D n'est jamais prête`));
  await page.waitForTimeout(1500);
  for (const p of points) {
    await page.evaluate(([p, sel]) => {
      const el = sel && document.querySelector(sel);
      if (el) { const top = el.getBoundingClientRect().top + scrollY; scrollTo(0, top + p * Math.max(0, el.offsetHeight - innerHeight)); }
      else scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight));
    }, [p, section]);
    await page.waitForTimeout(2200);
    const file = `${v.name}-${String(Math.round(p * 100)).padStart(3, "0")}.png`;
    await page.screenshot({ path: `${out}/${file}`, timeout: 180000, scale: "css" });
    const cut = await edgeCheck(page, section);
    if (cut.length) warnings.push(`[${v.name} ${Math.round(p * 100)} %] la 3D touche le bord ${cut.join(", ")} : objet coupé ? (${file})`);
    shots.push({ view: v.name, p, file, cut });
    if (posterPath && v.name === "desktop" && p === points[0]) { // seulement la zone 3D, sans les textes posés dessus
      await page.evaluate(() => { document.body.style.visibility = "hidden"; document.querySelector("canvas").style.visibility = "visible"; });
      await page.locator("canvas").first().screenshot({ path: posterPath, type: "jpeg", quality: 82, timeout: 180000 });
      await page.evaluate(() => { document.body.style.visibility = ""; document.querySelector("canvas").style.visibility = ""; });
    }
  }
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) errors.push(`[${v.name}] débordement horizontal`);
  await page.close();
}
await browser.close();
fs.writeFileSync(`${out}/check.json`, JSON.stringify({ url, date: new Date().toISOString(), full, errors, warnings, shots }, null, 2));
console.log(errors.length ? "PROBLÈMES :\n" + errors.join("\n") : "Aucune erreur console.");
if (warnings.length) console.log("À VÉRIFIER :\n" + warnings.join("\n"));
}
writeReport();
console.log(`Captures et rapport dans ${out} (report.html) : regarde chaque capture.`);

/*
 * La 3D touche-t-elle un bord ? Capture du canvas seul (textes cachés), couleur de fond = couleur la
 * plus fréquente sur le pourtour, puis recherche sur chaque bord d'une longue suite de pixels
 * différents du fond (un objet coupé). Les petits points isolés (poussière, grain) sont ignorés, et
 * une scène qui remplit tout le cadre (fond animé) n'est pas signalée.
 */
async function edgeCheck(page, sel) {
  const ok = await page.evaluate((sel) => {
    const c = (sel && document.querySelector(sel)?.querySelector("canvas")) || document.querySelector("canvas");
    if (!c) return false;
    const r = c.getBoundingClientRect();
    if (r.bottom < innerHeight * 0.5 || r.top > innerHeight * 0.5 || r.width < 50) return false; // pas à l'écran
    document.body.style.visibility = "hidden"; c.style.visibility = "visible"; c.setAttribute("data-p3d-check", "");
    return true;
  }, sel);
  if (!ok) return [];
  let png;
  try { png = await page.locator("canvas[data-p3d-check]").screenshot({ timeout: 180000, scale: "css" }); }
  finally { await page.evaluate(() => { document.body.style.visibility = ""; const c = document.querySelector("canvas[data-p3d-check]"); if (c) { c.style.visibility = ""; c.removeAttribute("data-p3d-check"); } }); }
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const w = img.width, h = img.height, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data, px = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const D = 6; // profondeur : un objet coupé est aussi présent un peu vers l'intérieur, pas un point au bord
    const edges = {
      haut: Array.from({ length: w }, (_, x) => [px(x, 0), px(x, D)]),
      bas: Array.from({ length: w }, (_, x) => [px(x, h - 1), px(x, h - 1 - D)]),
      gauche: Array.from({ length: h }, (_, y) => [px(0, y), px(D, y)]),
      droit: Array.from({ length: h }, (_, y) => [px(w - 1, y), px(w - 1 - D, y)]),
    };
    const all = Object.values(edges).flat().map((p) => p[0]), hist = new Map();
    all.forEach(([r, gg, b]) => { const key = (r >> 4) + "," + (gg >> 4) + "," + (b >> 4); hist.set(key, (hist.get(key) || 0) + 1); });
    const [bk] = [...hist.entries()].sort((a, b) => b[1] - a[1])[0];
    const bg = bk.split(",").map((v) => v * 16 + 8);
    const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const diff = (c) => dist(c, bg) > 160; // seuil haut : halos de bloom, grain et ombres légères ne comptent pas
    if (all.filter(diff).length / all.length > 0.6) return []; // scène plein cadre : rien à signaler
    const out = [], W = 24;
    for (const [name, list] of Object.entries(edges)) {
      const len = list.length;
      const hit = list.map(([a, b]) => (diff(a) && diff(b) ? 1 : 0));
      /* contour net le long du bord : un objet a des bords francs, un dégradé ou un halo non */
      const sharp = list.map(([a], i) => (i && dist(a, list[i - 1][0]) > 90 ? 1 : 0));
      const need = Math.max(10, len * 0.012);
      let sum = 0, start = -1, flagged = false;
      const close = (end) => {
        const s0 = Math.max(0, start - W + 1);
        let n = 0, sh = 0; for (let k = s0; k <= end; k++) { n += hit[k]; sh += sharp[k]; }
        if (n >= need && sh >= 2) flagged = true;
      };
      for (let i = 0; i < len && !flagged; i++) {
        sum += hit[i]; if (i >= W) sum -= hit[i - W];
        const dense = i >= W - 1 && sum >= W * 0.3; // densité sur une fenêtre : des particules font des points espacés
        if (dense && start < 0) start = i;
        if (!dense && start >= 0) { close(i - 1); start = -1; }
      }
      if (!flagged && start >= 0) close(len - 1);
      if (flagged) out.push(name);
    }
    return out;
  }, png.toString("base64"));
}

function writeReport() {
  const meta = JSON.parse(fs.readFileSync(`${out}/check.json`, "utf8"));
  let jury = null; try { jury = JSON.parse(fs.readFileSync(`${out}/jury.json`, "utf8")); } catch (e) {}
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const crit = [["originalite", "Originalité"], ["pertinence", "Pertinence"], ["finition", "Finition"], ["lisibilite", "Lisibilité"], ["fluidite", "Fluidité"], ["mobile", "Mobile"]];
  const views = ["desktop", "mobile"].map((v) => {
    const list = meta.shots.filter((s) => s.view === v);
    return `<h2>${v === "desktop" ? "Ordinateur" : "Mobile"}</h2><div class="g ${v}">${list.map((s) => `<figure><img src="${s.file}" loading="lazy"${s.cut && s.cut.length ? ' class="cut"' : ""}><figcaption>${Math.round(s.p * 100)} %${s.cut && s.cut.length ? " · bord " + s.cut.join(", ") + " ?" : ""}</figcaption></figure>`).join("")}</div>`;
  }).join("");
  const juryHtml = jury ? `<section class="jury"><h2>Jury</h2>${crit.map(([k, l]) => { const n = +jury[k] || 0; return `<div class="row"><span>${l}</span><i><b style="width:${n * 10}%" class="${n >= 8 ? "ok" : "ko"}"></b></i><em>${n}/10</em></div>`; }).join("")}${jury.notes ? `<p>${esc(jury.notes)}</p>` : ""}</section>` : `<section class="jury"><h2>Jury</h2><p>Pas encore noté : écrire jury.json puis relancer avec --report-only.</p></section>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport premium-3d</title>
<style>body{margin:0;background:#0c0c0d;color:#f2f0ec;font:15px/1.5 system-ui,sans-serif;padding:28px}h1{font-size:26px;margin:0 0 4px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.14em;color:#9b9790;margin:30px 0 12px}
.meta{color:#9b9790}.err{color:#ff8f8f}.warn{color:#f5c26b}.okk{color:#7ddf9a}.g{display:grid;gap:12px}.g.desktop{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}.g.mobile{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
figure{margin:0}img.cut{border-color:#f5c26b}img{width:100%;display:block;border-radius:8px;border:1px solid #2a2a2c}figcaption{font:12px ui-monospace,monospace;color:#9b9790;margin-top:4px}
.jury .row{display:grid;grid-template-columns:110px 1fr 50px;align-items:center;gap:12px;margin:8px 0}.jury i{height:8px;background:#222;border-radius:4px;overflow:hidden}.jury b{display:block;height:100%}.ok{background:#22c55e}.ko{background:#f59e0b}.jury em{font-style:normal;font-family:ui-monospace,monospace}</style></head>
<body><h1>Rapport de contrôle</h1><div class="meta">${esc(meta.url)} · ${new Date(meta.date).toLocaleString("fr-FR")} · ${meta.full ? "rendu complet" : "rendu rapide (sans post-traitement)"}</div>
<p class="${meta.errors.length ? "err" : "okk"}">${meta.errors.length ? meta.errors.map(esc).join("<br>") : "Aucune erreur console, aucun débordement."}</p>
${(meta.warnings || []).length ? `<p class="warn">À vérifier :<br>${meta.warnings.map(esc).join("<br>")}</p>` : ""}
${juryHtml}${views}</body></html>`;
  fs.writeFileSync(`${out}/report.html`, html);
}
