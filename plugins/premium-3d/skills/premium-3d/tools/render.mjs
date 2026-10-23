// Vidéo parfaitement fluide d'une page 3D, rendue image par image, puis assemblée par ffmpeg.
//
// Deux façons de piloter la page, choisies toutes seules :
//   - scène premium-3d (lib/core.js) : chaque image est calculée par stage.step, exactement ;
//   - toute autre page (React Three Fiber, three.js maison, GSAP, Lenis…) : « temps virtuel » de Chrome
//     (Emulation.setVirtualTimePolicy) : le temps de la page, requestAnimationFrame, les timers et les
//     animations CSS avancent d'exactement une image entre deux captures, même sans écran.
// Avec stage.step, les transitions CSS (légendes) sont ralenties au rythme du calcul, pour rester fluides.
//
// Rapide : la vidéo est découpée en morceaux rendus en parallèle par plusieurs navigateurs
// (--workers), et la carte graphique est utilisée dès qu'il y a un écran (voir tools/browser.mjs).
//
// Prérequis : npm i playwright ; ffmpeg.
// Usage :
//   node tools/render.mjs <url> [sortie.mp4] [--size 1920x1080] [--section "#scene"] [--duration 12]
//                         [--fps 30] [--hold 1.5] [--end 2] [--pause 0.3,0.6] [--pause-length 1]
//                         [--mobile] [--tier high] [--quality 92] [--workers N] [--gpu | --cpu]
//                         [--still 8]
//   --size       taille de la vidéo (défaut 1920x1080). La page est affichée en 1280 px de large et
//                agrandie (rendu net, mise en page d'ordinateur).
//   --mobile     vidéo verticale 1080x1920 avec la mise en page téléphone (reels, TikTok, LinkedIn)
//   --section    ne défile que dans cette section (sinon toute la page)
//   --duration   durée du défilement, hors pauses et attentes (défaut 12 s)
//   --hold       secondes immobiles au début (défaut 1.5) ; --end : à la fin (défaut 2)
//   --pause      points de la section (0 à 1) où le défilement s'arrête --pause-length secondes
//   --still      pas de défilement : filmer la page sur place pendant N secondes (animation au temps)
//   --tier       niveau d'appareil simulé (défaut high : le plus beau rendu)
//   --workers    navigateurs en parallèle (défaut : 2 avec carte graphique, 1 en rendu logiciel)
//   --gpu/--cpu  forcer la carte graphique (fenêtres visibles) ou le rendu logiciel (sans écran)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { defaultWorkers, dismissCookies, glRenderer, gpuMode, isSoftware, launch } from "./browser.mjs";

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const mode = gpuMode(args);
const mobile = flag("--mobile");
const fps = +opt("--fps", 30), duration = +opt("--duration", 12), hold = +opt("--hold", 1.5), endHold = +opt("--end", 2);
const section = opt("--section", null), tier = opt("--tier", "high"), quality = +opt("--quality", 92);
const pauses = (opt("--pause", "") || "").split(",").filter(Boolean).map(Number).sort((a, b) => a - b);
const pauseLen = +opt("--pause-length", 1);
const still = +opt("--still", 0);
const workersOpt = +opt("--workers", 0);
const [W, H] = opt("--size", mobile ? "1080x1920" : "1920x1080").split("x").map(Number);
const url = args[0];
if (!url) { console.log('Usage : node tools/render.mjs <url> [sortie.mp4] [--section "#scene"] [--mobile] [--workers 4]'); process.exit(1); }
const out = path.resolve(args[1] || (mobile ? "video-mobile.mp4" : "video.mp4"));

/* mise en page : ordinateur en 1280 px de large, téléphone en 360 px ; agrandie à la taille de la vidéo */
const cssW = mobile ? 360 : 1280, scale = W / cssW, viewport = { width: cssW, height: Math.round(H / scale) };

/* chronologie : position de défilement (0 → 1) de chaque image ; null = pas de défilement (--still) */
const frames = [];
if (still > 0) for (let i = 0; i < Math.round(still * fps); i++) frames.push(null);
else {
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

/*
 * Découpe en morceaux, un par navigateur. Une coupure tombe de préférence dans une pause (deux images
 * à la même position) : le navigateur suivant y reprend une scène immobile, aucun raccord visible.
 */
const workers = Math.max(1, Math.min(workersOpt || defaultWorkers(mode), Math.floor(frames.length / (fps * 2)) || 1));
const bounds = [0];
for (let k = 1; k < workers; k++) {
  const ideal = Math.round((frames.length * k) / workers), slack = Math.round(frames.length / workers / 5);
  let best = ideal;
  for (let d = 0; d <= slack; d++) {
    if (ideal - d > bounds[k - 1] + fps && frames[ideal - d] === frames[ideal - d - 1]) { best = ideal - d; break; }
    if (ideal + d < frames.length && frames[ideal + d] === frames[ideal + d - 1]) { best = ideal + d; break; }
  }
  bounds.push(best);
}
bounds.push(frames.length);

const tmp = fs.mkdtempSync(path.join(path.dirname(out), ".render-"));
const t0 = Date.now();
let done = 0, kind = null, renderer = null;
const timing = { draw: 0, capture: 0, write: 0 }; // millisecondes cumulées, affichées à la fin
const progress = () => {
  done++;
  if (done % fps === 0 || done === frames.length) {
    const el = (Date.now() - t0) / 1000, left = (el / done) * (frames.length - done);
    console.log(`image ${done}/${frames.length} · ${Math.round(el)} s écoulées · reste environ ${Math.max(0, Math.round(left / 60))} min`);
  }
};

async function renderChunk(k, from, to) {
  const browser = await launch(mode, { extra: ["--hide-scrollbars"] });
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile });
    page.on("pageerror", (e) => console.log(`[navigateur ${k + 1}] erreur de la page :`, e.message));
    const sep = url.includes("?") ? "&" : "?";
    await page.goto(`${url}${sep}tier=${tier}`, { waitUntil: "load", timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    if (await dismissCookies(page)) await page.waitForTimeout(400); // bannière de cookies : elle cacherait la 3D
    // scène premium-3d prête → "stage" ; aucune scène premium-3d quelques secondes après le chargement → "virtual"
    const myKind = await page
      .waitForFunction(() => {
        const d = window.__demo || window.__scene, st = window.__p3d && window.__p3d.stages;
        if (st && st.length) return (!d || d.ready) && st.every((s) => s.ready) ? "stage" : null;
        return performance.now() > 4000 && (!d || d.ready) ? "virtual" : null;
      }, null, { timeout: 120000, polling: 250 })
      .then((h) => h.jsonValue());
    if (k === 0) {
      kind = myKind; renderer = await glRenderer(page);
      if (myKind === "virtual" && !(await page.evaluate(() => !!document.querySelector("canvas")))) throw new Error("aucun <canvas> dans la page : est-ce la bonne adresse ? (page d'erreur, serveur arrêté…)");
    }
    await page.addStyleTag({ content: "::-webkit-scrollbar{display:none}html{scrollbar-width:none;scroll-behavior:auto!important}" });
    const range = await page.evaluate((sel) => {
      const el = sel && document.querySelector(sel);
      if (sel && !el) return null;
      if (el) { const top = el.getBoundingClientRect().top + scrollY; return [top, Math.max(0, el.offsetHeight - innerHeight)]; }
      return [0, document.documentElement.scrollHeight - innerHeight];
    }, section);
    if (!range) throw new Error(`la section « ${section} » n'existe pas dans la page`);
    const yOf = (i) => (frames[i] === null ? null : Math.round(range[0] + frames[i] * range[1]));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Animation.enable");

    /* avancer d'une image : scène premium-3d (step) ou temps virtuel de la page (rAF, timers, CSS) */
    let advance;
    if (myKind === "stage") {
      await page.evaluate(() => window.__p3d.stages.forEach((s) => { s.paused = true; }));
      advance = (y, n = 1, draw = true) => page.evaluate(([y, n, dt, draw]) => {
        if (y !== null) scrollTo(0, y);
        for (let j = 0; j < n; j++) window.__p3d.stages.forEach((s) => (s.stepNoDraw ? s.step(dt, draw || j === n - 1) : s.step(dt)));
      }, [y, n, 1 / fps, draw]);
    } else {
      const budget = (ms) => new Promise((resolve) => {
        cdp.once("Emulation.virtualTimeBudgetExpired", resolve);
        cdp.send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: ms });
      });
      await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
      let elapsed = 0, ticks = 0;
      advance = async (y, n = 1) => {
        for (let j = 0; j < n; j++) {
          if (y !== null) await page.evaluate((y) => scrollTo(0, y), y);
          ticks++;
          const target = Math.round((ticks * 1000) / fps); // millisecondes entières, sans dérive
          await budget(target - elapsed); elapsed = target;
        }
      };
    }

    /* se caler sur la position de départ, puis rejoindre la première image de ce morceau */
    await advance(yOf(0) ?? null, Math.round(fps * 1.5));
    if (from > 0) {
      if (myKind === "stage") {
        // sans dessiner : rapide, et la scène arrive exactement dans l'état de l'image `from`
        const ys = frames.slice(0, from).map((_, i) => yOf(i));
        for (let s = 0; s < ys.length; s += 60) {
          await page.evaluate(([ys, dt]) => ys.forEach((y) => { if (y !== null) scrollTo(0, y); window.__p3d.stages.forEach((st) => (st.stepNoDraw ? st.step(dt, false) : st.step(dt))); }), [ys.slice(s, s + 60), 1 / fps]);
        }
      } else {
        // temps virtuel : chaque image intermédiaire est calculée (le défilement et les lissages suivent)
        for (let i = 0; i < from; i++) await advance(yOf(i));
      }
    }
    if (myKind === "stage") {
      await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
      await page.waitForTimeout(1200);
      await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) {} })); // fondus terminés
    }

    let last = Date.now(), rate = 0.05;
    for (let i = from; i < to; i++) {
      /* stage.step : transitions CSS ralenties = durée d'une image de la vidéo / temps réel d'un calcul
         (en temps virtuel, les animations CSS suivent déjà le temps de la page) */
      if (myKind === "stage") await cdp.send("Animation.setPlaybackRate", { playbackRate: rate });
      const ta = Date.now();
      await advance(yOf(i));
      const tb = Date.now();
      const r = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality, optimizeForSpeed: true });
      const tc = Date.now();
      fs.writeFileSync(path.join(tmp, String(i).padStart(5, "0") + ".jpg"), Buffer.from(r.data, "base64"));
      timing.draw += tb - ta; timing.capture += tc - tb; timing.write += Date.now() - tc;
      const now = Date.now(); rate = Math.min(1, Math.max(0.002, (1000 / fps) / Math.max(1, now - last))); last = now;
      progress();
    }
  } finally {
    await browser.close();
  }
}

console.log(`${frames.length} images à ${fps} i/s, ${workers} navigateur${workers > 1 ? "s" : ""} en parallèle (${mode === "gpu" ? "carte graphique" : "rendu logiciel"})`);
try {
  // le premier navigateur démarre seul : il vérifie la page avant d'en lancer d'autres
  const first = renderChunk(0, bounds[0], bounds[1]);
  await new Promise((r) => setTimeout(r, 400));
  await Promise.all([first, ...bounds.slice(1, -1).map((b, k) => renderChunk(k + 1, b, bounds[k + 2]))]);
} catch (e) {
  console.log("ERREUR :", e.message);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}
const per = (ms) => Math.round(ms / frames.length);
console.log(`Par image : calcul ${per(timing.draw)} ms, capture ${per(timing.capture)} ms, écriture ${per(timing.write)} ms (cumulé sur les navigateurs)`);
console.log(`Moteur : ${kind === "stage" ? "scène premium-3d (stage.step)" : "temps virtuel de la page"} · ${renderer}${isSoftware(renderer || "") && mode === "gpu" ? " (logiciel : pas de carte graphique disponible)" : ""}`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(tmp, "%05d.jpg"),
  "-vf", `scale=${W}:${H}:flags=lanczos`, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Vidéo prête : ${out} (${W}×${H}, ${(frames.length / fps).toFixed(1)} s, ${fps} i/s) en ${Math.round((Date.now() - t0) / 1000)} s`);
