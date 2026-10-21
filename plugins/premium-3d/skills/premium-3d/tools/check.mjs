// Contrôle visuel d'une page 3D : captures à plusieurs hauteurs de scroll, desktop et mobile,
// erreurs console, débordement horizontal.
// Prérequis : npm i playwright
// Usage :
//   node tools/check.mjs <url> [dossier] [--section "#ma-section"] [--points 0,0.25,0.5,0.75,1] [--full]
// --full : avec le post-traitement (bloom, effets) ; plus lent sans carte graphique.
// Sans --section, les points sont pris sur toute la hauteur de la page.
// Si la page expose window.__demo.ready (ou window.__scene.ready), on attend que la 3D soit prête.
import { chromium } from "playwright";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const full = args.includes("--full"); if (full) args.splice(args.indexOf("--full"), 1);
const section = opt("--section", null);
const points = opt("--points", "0,0.15,0.3,0.45,0.6,0.75,0.9").split(",").map(Number);
const url = args[0] || "http://127.0.0.1:5180";
const out = args[1] || "./captures";
fs.mkdirSync(out, { recursive: true });

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
    await page.screenshot({ path: `${out}/${v.name}-${String(Math.round(p * 100)).padStart(3, "0")}.png`, timeout: 180000 });
  }
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) errors.push(`[${v.name}] débordement horizontal`);
  await page.close();
}
await browser.close();
console.log(errors.length ? "PROBLÈMES :\n" + errors.join("\n") : "Aucune erreur console.");
console.log(`Captures dans ${out} : regarde-les une par une.`);
