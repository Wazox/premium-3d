// Enregistre une vidéo fluide d'une page 3D, comme un enregistrement d'écran d'ordinateur :
// fenêtre 1920×1080, défilement doux du haut en bas (ou d'une section). Pour LinkedIn, Instagram,
// TikTok (la vidéo paysage se place ensuite dans un montage vertical si besoin).
//
// Prérequis : npm i playwright ; ffmpeg pour la conversion en .mp4 (sinon fichier .webm).
// Usage :
//   node tools/record.mjs <url> [sortie.mp4] [--size 1920x1080] [--duration 12] [--section "#scene"]
//                         [--hold 1.5] [--headless] [--pause 0.3,0.6] [--mobile]
//   --size       taille de la fenêtre enregistrée (défaut 1920x1080, écran d'ordinateur)
//   --mobile     vue téléphone 430×932 (vertical), si on veut aussi montrer le rendu mobile
//   --duration   durée du défilement en secondes (défaut 12)
//   --section    ne défile que dans cette section (sinon toute la page)
//   --hold       secondes immobiles au début et à la fin (défaut 1.5)
//   --pause      points (0 à 1) où le défilement marque une pause d'une seconde
//   --headless   sans fenêtre. Par défaut une vraie fenêtre Chrome s'ouvre : la carte graphique
//                est utilisée et la vidéo est fluide. En headless, le rendu est logiciel (saccadé).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const mobile = flag("--mobile"), headless = flag("--headless");
const duration = +opt("--duration", 12), hold = +opt("--hold", 1.5), section = opt("--section", null);
const pauses = (opt("--pause", "") || "").split(",").filter(Boolean).map(Number);
const url = args[0]; if (!url) { console.log("Usage : node tools/record.mjs <url> [sortie.mp4] [--size 1920x1080] [--section \"#scene\"]"); process.exit(1); }
const sizeArg = opt("--size", "1920x1080").split("x").map(Number);
const out = path.resolve(args[1] || (mobile ? "video-mobile.mp4" : "video.mp4"));
/* Playwright enregistre en pixels CSS : la fenêtre a donc directement la taille de la vidéo. */
const size = mobile ? { width: 430, height: 932 } : { width: sizeArg[0], height: sizeArg[1] };
const tmp = fs.mkdtempSync(path.join(path.dirname(out), ".rec-"));

const browser = await chromium.launch({ headless, args: headless ? [] : ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"] });
const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, recordVideo: { dir: tmp, size } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "load", timeout: 90000 });
await page.waitForFunction(() => { const d = window.__demo || window.__scene; return !d || d.ready; }, null, { timeout: 120000 }).catch(() => {});
await page.addStyleTag({ content: "::-webkit-scrollbar{display:none}html{scrollbar-width:none}" });
await page.waitForTimeout(hold * 1000);

/* défilement piloté dans la page (60 i/s, courbe douce, pauses éventuelles) */
await page.evaluate(async ([duration, section, pauses]) => {
  const el = section && document.querySelector(section);
  const y0 = el ? el.getBoundingClientRect().top + scrollY : 0;
  const y1 = el ? y0 + el.offsetHeight - innerHeight : document.documentElement.scrollHeight - innerHeight;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const total = duration + pauses.length;
  /* temps « utile » : on retire les pauses pour calculer la progression */
  const prog = (t) => { let used = t; for (const p of pauses) { const at = p * duration + pauses.indexOf(p); if (t > at) used -= Math.min(1, t - at); } return Math.min(1, used / duration); };
  const lenis = window.NX && window.NX.lenis;
  await new Promise((done) => {
    const t0 = performance.now();
    const step = (now) => {
      const t = (now - t0) / 1000, k = ease(prog(t)), y = y0 + (y1 - y0) * k;
      if (lenis && lenis.scrollTo) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
      if (t < total) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
}, [duration, section, pauses]);
await page.waitForTimeout(hold * 1000);
const video = page.video();
await ctx.close(); await browser.close();
const webm = await video.path();

try {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-r", "30", "-movflags", "+faststart", out]);
  console.log("Vidéo : " + out);
} catch (e) {
  const w = out.replace(/\.mp4$/, ".webm"); fs.copyFileSync(webm, w);
  console.log("ffmpeg introuvable : vidéo en .webm : " + w);
}
fs.rmSync(tmp, { recursive: true, force: true });
