// Contrôle visuel d'une page 3D : captures à plusieurs hauteurs de scroll, desktop et mobile,
// erreurs console, débordement horizontal.
// Prérequis : npm i playwright
// Usage :
//   node tools/check.mjs <url> [dossier] [--section "#ma-section"] [--points 0,0.25,0.5,0.75,1] [--full]
// --full : avec le post-traitement (bloom, effets) ; plus lent sans carte graphique.
// Sans --section, les points sont pris sur toute la hauteur de la page.
// Si la page expose window.__demo.ready (ou window.__scene.ready), on attend que la 3D soit prête.
// Produit aussi <dossier>/report.html : planche de toutes les captures + erreurs + notes du jury.
// Notes du jury : écrire <dossier>/jury.json (voir SKILL.md) puis relancer avec --report-only.
import { chromium } from "playwright";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const full = args.includes("--full"); if (full) args.splice(args.indexOf("--full"), 1);
const reportOnly = args.includes("--report-only"); if (reportOnly) args.splice(args.indexOf("--report-only"), 1);
const section = opt("--section", null);
const points = opt("--points", "0,0.15,0.3,0.45,0.6,0.75,0.9").split(",").map(Number);
const url = args[0] || "http://127.0.0.1:5180";
const out = args[1] || "./captures";
fs.mkdirSync(out, { recursive: true });

const shots = [];
if (!reportOnly) {
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];
for (const v of [{ name: "desktop", width: 1280, height: 720 }, { name: "mobile", width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport: { width: v.width, height: v.height }, reducedMotion: "reduce" });
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
    await page.screenshot({ path: `${out}/${file}`, timeout: 180000 });
    shots.push({ view: v.name, p, file });
  }
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) errors.push(`[${v.name}] débordement horizontal`);
  await page.close();
}
await browser.close();
fs.writeFileSync(`${out}/check.json`, JSON.stringify({ url, date: new Date().toISOString(), full, errors, shots }, null, 2));
console.log(errors.length ? "PROBLÈMES :\n" + errors.join("\n") : "Aucune erreur console.");
}
writeReport();
console.log(`Captures et rapport dans ${out} (report.html) : regarde chaque capture.`);

function writeReport() {
  const meta = JSON.parse(fs.readFileSync(`${out}/check.json`, "utf8"));
  let jury = null; try { jury = JSON.parse(fs.readFileSync(`${out}/jury.json`, "utf8")); } catch (e) {}
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const crit = [["originalite", "Originalité"], ["pertinence", "Pertinence"], ["finition", "Finition"], ["lisibilite", "Lisibilité"], ["fluidite", "Fluidité"], ["mobile", "Mobile"]];
  const views = ["desktop", "mobile"].map((v) => {
    const list = meta.shots.filter((s) => s.view === v);
    return `<h2>${v === "desktop" ? "Ordinateur" : "Mobile"}</h2><div class="g ${v}">${list.map((s) => `<figure><img src="${s.file}" loading="lazy"><figcaption>${Math.round(s.p * 100)} %</figcaption></figure>`).join("")}</div>`;
  }).join("");
  const juryHtml = jury ? `<section class="jury"><h2>Jury</h2>${crit.map(([k, l]) => { const n = +jury[k] || 0; return `<div class="row"><span>${l}</span><i><b style="width:${n * 10}%" class="${n >= 8 ? "ok" : "ko"}"></b></i><em>${n}/10</em></div>`; }).join("")}${jury.notes ? `<p>${esc(jury.notes)}</p>` : ""}</section>` : `<section class="jury"><h2>Jury</h2><p>Pas encore noté : écrire jury.json puis relancer avec --report-only.</p></section>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport premium-3d</title>
<style>body{margin:0;background:#0c0c0d;color:#f2f0ec;font:15px/1.5 system-ui,sans-serif;padding:28px}h1{font-size:26px;margin:0 0 4px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.14em;color:#9b9790;margin:30px 0 12px}
.meta{color:#9b9790}.err{color:#ff8f8f}.okk{color:#7ddf9a}.g{display:grid;gap:12px}.g.desktop{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}.g.mobile{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
figure{margin:0}img{width:100%;display:block;border-radius:8px;border:1px solid #2a2a2c}figcaption{font:12px ui-monospace,monospace;color:#9b9790;margin-top:4px}
.jury .row{display:grid;grid-template-columns:110px 1fr 50px;align-items:center;gap:12px;margin:8px 0}.jury i{height:8px;background:#222;border-radius:4px;overflow:hidden}.jury b{display:block;height:100%}.ok{background:#22c55e}.ko{background:#f59e0b}.jury em{font-style:normal;font-family:ui-monospace,monospace}</style></head>
<body><h1>Rapport de contrôle</h1><div class="meta">${esc(meta.url)} · ${new Date(meta.date).toLocaleString("fr-FR")} · ${meta.full ? "rendu complet" : "rendu rapide (sans post-traitement)"}</div>
<p class="${meta.errors.length ? "err" : "okk"}">${meta.errors.length ? meta.errors.map(esc).join("<br>") : "Aucune erreur console, aucun débordement."}</p>
${juryHtml}${views}</body></html>`;
  fs.writeFileSync(`${out}/report.html`, html);
}
