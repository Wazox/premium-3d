// Vidéo parfaitement fluide d'une page 3D, rendue image par image (stage.step de lib/core.js).
// Marche partout, même sans écran ni carte graphique (serveur, cloud) : chaque image est calculée
// exactement, puis ffmpeg assemble le .mp4. Plus lent que tools/record.mjs, mais sans aucune saccade.
// Les transitions CSS (légendes) sont ralenties au même rythme, pour rester fluides dans la vidéo.
//
// Prérequis : npm i playwright ; ffmpeg.
// Usage :
//   node tools/render.mjs <url> [sortie.mp4] [--size 1920x1080] [--section "#scene"] [--duration 12]
//                         [--fps 30] [--hold 1.5] [--end 2] [--pause 0.3,0.6] [--pause-length 1]
//                         [--mobile] [--tier high] [--quality 92]
//   --size       taille de la vidéo (défaut 1920x1080). La page est affichée en 1280 px de large et
//                agrandie (rendu net, mise en page d'ordinateur).
//   --mobile     vidéo verticale 1080x1920 avec la mise en page téléphone (reels, TikTok, LinkedIn)
//   --section    ne défile que dans cette section (sinon toute la page)
//   --duration   durée du défilement, hors pauses et attentes (défaut 12 s)
//   --hold       secondes immobiles au début (défaut 1.5) ; --end : à la fin (défaut 2)
//   --pause      points de la section (0 à 1) où le défilement s'arrête --pause-length secondes
//   --tier       niveau d'appareil simulé (défaut high : le plus beau rendu)
// Compter quelques secondes de calcul par image sans carte graphique (12 s à 30 i/s = 360 images).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const mobile = flag("--mobile");
const fps = +opt("--fps", 30), duration = +opt("--duration", 12), hold = +opt("--hold", 1.5), endHold = +opt("--end", 2);
const section = opt("--section", null), tier = opt("--tier", "high"), quality = +opt("--quality", 92);
const pauses = (opt("--pause", "") || "").split(",").filter(Boolean).map(Number).sort((a, b) => a - b);
const pauseLen = +opt("--pause-length", 1);
const [W, H] = opt("--size", mobile ? "1080x1920" : "1920x1080").split("x").map(Number);
const url = args[0];
if (!url) { console.log('Usage : node tools/render.mjs <url> [sortie.mp4] [--section "#scene"] [--mobile]'); process.exit(1); }
const out = path.resolve(args[1] || (mobile ? "video-mobile.mp4" : "video.mp4"));

/* mise en page : ordinateur en 1280 px de large, téléphone en 360 px ; agrandie à la taille de la vidéo */
const cssW = mobile ? 360 : 1280, scale = W / cssW, viewport = { width: cssW, height: Math.round(H / scale) };
const frames = [];
{ /* chronologie : attente, défilement adouci entre les pauses, attente finale (positions 0 → 1) */
  const stops = [0, ...pauses.filter((p) => p > 0 && p < 1), 1];
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const push = (p, sec) => { for (let i = 0; i < Math.round(sec * fps); i++) frames.push(p); };
  push(0, hold);
  for (let s = 0; s < stops.length - 1; s++) {
    const a = stops[s], b = stops[s + 1], n = Math.max(1, Math.round((b - a) * duration * fps));
    for (let i = 1; i <= n; i++) frames.push(a + (b - a) * ease(i / n));
    if (s < stops.length - 2) push(b, pauseLen);
  }
  push(1, endHold);
}

const tmp = fs.mkdtempSync(path.join(path.dirname(out), ".render-"));
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars"] });
const page = await browser.newPage({ viewport, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile });
page.on("pageerror", (e) => console.log("Erreur de la page :", e.message));
const sep = url.includes("?") ? "&" : "?";
await page.goto(`${url}${sep}tier=${tier}`, { waitUntil: "load", timeout: 90000 });
await page.waitForFunction(() => { const d = window.__demo || window.__scene; const st = window.__p3d && window.__p3d.stages; return (!d || d.ready) && st && st.length && st.every((s) => s.ready); }, null, { timeout: 180000 })
  .catch(() => { console.log("ERREUR : aucune scène premium-3d prête dans la page (lib/core.js récent requis)."); process.exit(1); });
await page.evaluate(() => window.__p3d.stages.forEach((s) => { s.paused = true; })); // la vidéo pilote chaque image
await page.addStyleTag({ content: "::-webkit-scrollbar{display:none}html{scrollbar-width:none;scroll-behavior:auto!important}" });
const range = await page.evaluate((sel) => {
  const el = sel && document.querySelector(sel);
  if (sel && !el) return null;
  if (el) { const top = el.getBoundingClientRect().top + scrollY; return [top, Math.max(0, el.offsetHeight - innerHeight)]; }
  return [0, document.documentElement.scrollHeight - innerHeight];
}, section);
if (!range) { console.log(`ERREUR : la section « ${section} » n'existe pas dans la page.`); await browser.close(); process.exit(1); }
const cdp = await page.context().newCDPSession(page);
await cdp.send("Animation.enable");
const step = (y, n = 1) => page.evaluate(([y, n, dt]) => { scrollTo(0, y); for (let k = 0; k < n; k++) window.__p3d.stages.forEach((s) => s.step(dt)); }, [y, n, 1 / fps]);
await step(range[0], Math.round(fps * 1.5)); // la scène se cale sur la position de départ
await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
await page.waitForTimeout(1500);
await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} })); // fondus d'apparition terminés

const t0 = Date.now();
let last = Date.now(), rate = 0.05;
for (let i = 0; i < frames.length; i++) {
  /* transitions CSS : vitesse = durée d'une image de la vidéo / temps réel d'une image de calcul */
  await cdp.send("Animation.setPlaybackRate", { playbackRate: rate });
  await step(Math.round(range[0] + frames[i] * range[1]));
  const r = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality });
  const now = Date.now(); rate = Math.min(1, Math.max(0.002, (1000 / fps) / Math.max(1, now - last))); last = now;
  fs.writeFileSync(path.join(tmp, String(i).padStart(5, "0") + ".jpg"), Buffer.from(r.data, "base64"));
  if (i % fps === 0 || i === frames.length - 1) {
    const el = (Date.now() - t0) / 1000, left = (el / (i + 1)) * (frames.length - i - 1);
    console.log(`image ${i + 1}/${frames.length} · ${Math.round(el)} s écoulées · reste environ ${Math.round(left / 60)} min`);
  }
}
await browser.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(tmp, "%05d.jpg"),
  "-vf", `scale=${W}:${H}:flags=lanczos`, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Vidéo prête : ${out} (${W}×${H}, ${(frames.length / fps).toFixed(1)} s, ${fps} i/s)`);
