// Contrôle visuel d'une page 3D : captures à plusieurs hauteurs de scroll, desktop et mobile,
// erreurs console, débordement horizontal.
// Prérequis : npm i playwright
// Usage :
//   node tools/check.mjs <url> [dossier] [--section "#ma-section"] [--points 0,0.25,0.5,0.75,1] [--full]
//                        [--views desktop,mobile] [--tier auto|low|mid|high] [--poster img/poster.jpg]
// --full : avec le post-traitement (bloom, effets) ; plus lent sans carte graphique.
// --views : une seule vue pour itérer vite (ex. --views mobile).
// --tier : sans carte graphique, la page se croirait sur une machine faible ; par défaut on force
//          le niveau d'un appareil réel (ordinateur « high », mobile « mid ») ; « auto » pour ne rien forcer.
// Pour itérer vite : --points 0,0.5,1 ; pour conclure : la liste complète (par défaut) et --full.
// Sans --section, les points sont pris sur toute la hauteur de la page. Avec --section, une capture
// « fin de page » est ajoutée (infos pratiques, pied de page).
// Gros plan des titres (h1, h2 visibles) dans le rapport : vérifier les accents du nom de la marque.
// Si la page expose window.__demo.ready (ou window.__scene.ready), on attend que la 3D soit prête.
// Produit aussi <dossier>/report.html : planche de toutes les captures + erreurs + notes du jury.
// Mesure aussi les performances (appels de dessin, triangles, poids téléchargé, temps avant la 3D
// prête, LCP, CLS) et les compare à un budget : voir « Performances » dans report.html.
// Détecte aussi, à chaque capture, une 3D qui touche le bord de l'écran (objet probablement coupé) :
// signalé « à vérifier », car une scène peut déborder exprès (fond plein, décor qui sort du cadre).
// Et une 3D qui passe sous un texte visible (titre, paragraphe, bouton) : la règle est de ne jamais chevaucher.
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
const views = opt("--views", "desktop,mobile").split(",");
const tierOpt = opt("--tier", null);
const t0 = Date.now(), log = (m) => console.log(`${m} (${Math.round((Date.now() - t0) / 1000)} s)`);
const url = args[0] || "http://127.0.0.1:5180";
const out = args[1] || "./captures";
fs.mkdirSync(out, { recursive: true });

const shots = [];
if (!reportOnly) {
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [], warnings = [], perf = {};
/* budget indicatif d'une page 3D vitrine (mobile plus strict) */
const BUDGET = { desktop: { calls: 200, triangles: 1500000, kb: 4000 }, mobile: { calls: 100, triangles: 500000, kb: 3000 } };
// mobile : écran haute densité (3×, comme un iPhone) et tactile, pour voir ce que voit un vrai téléphone
for (const v of [{ name: "desktop", width: 1280, height: 720, tier: "high" }, { name: "mobile", width: 390, height: 844, mobile: true, tier: "mid" }].filter((v) => views.includes(v.name))) {
  const page = await browser.newPage({ viewport: { width: v.width, height: v.height }, reducedMotion: "reduce", ...(v.mobile ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}) });
  page.on("pageerror", (e) => errors.push(`[${v.name}] ${e.message}`));
  await page.addInitScript(() => {
    window.__vitals = { lcp: 0, cls: 0 };
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vitals.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch (e) {}
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__vitals.cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
  });
  const pf = (perf[v.name] = { calls: 0, triangles: 0, points: 0 });
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${v.name}] ${m.text().slice(0, 200)}`); });
  const tierParam = tierOpt === "auto" ? null : tierOpt || v.tier;
  const params = [full ? null : "lite", tierParam ? "tier=" + tierParam : null].filter(Boolean).join("&");
  log(`[${v.name}] chargement${tierParam ? " (niveau " + tierParam + ")" : ""}…`);
  await page.goto(params ? url + (url.includes("?") ? "&" : "?") + params : url, { waitUntil: "load", timeout: 90000 });
  await page.waitForFunction(() => { const d = window.__demo || window.__scene; return !d || d.ready; }, null, { timeout: 120000 }).catch(() => errors.push(`[${v.name}] la 3D n'est jamais prête`));
  await page.waitForTimeout(1500);
  if (section && !(await page.evaluate((sel) => !!document.querySelector(sel), section))) {
    console.log(`ERREUR : la section « ${section} » n'existe pas dans la page (vérifier l'id). Arrêt.`); process.exit(1);
  }
  const plan = section ? [...points, "fin"] : points;
  for (const p of plan) {
    if (p === "fin") { // bas de page : infos pratiques, pied de page
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(1500);
      const f = `${v.name}-fin.png`; await page.screenshot({ path: `${out}/${f}`, timeout: 180000, scale: "css" });
      shots.push({ view: v.name, p: "fin", file: f }); log(`[${v.name}] fin de page ok`); continue;
    }
    await page.evaluate(([p, sel]) => {
      const el = sel && document.querySelector(sel);
      if (el) { const top = el.getBoundingClientRect().top + scrollY; scrollTo(0, top + p * Math.max(0, el.offsetHeight - innerHeight)); }
      else scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight));
    }, [p, section]);
    await page.waitForTimeout(2200);
    const file = `${v.name}-${String(Math.round(p * 100)).padStart(3, "0")}.png`;
    await page.screenshot({ path: `${out}/${file}`, timeout: 180000, scale: "css" });
    const info = await page.evaluate(() => { const st = window.__p3d && window.__p3d.stages; if (!st || !st.length) return null; let calls = 0, triangles = 0, points = 0; st.forEach((s) => { const r = s.renderer.info.render; calls += r.calls; triangles += r.triangles; points += r.points; }); return { calls, triangles, points }; });
    if (info) { pf.calls = Math.max(pf.calls, info.calls); pf.triangles = Math.max(pf.triangles, info.triangles); pf.points = Math.max(pf.points, info.points); }
    const { edges: cut, overlaps } = await edgeCheck(page, section);
    if (cut.length) warnings.push(`[${v.name} ${Math.round(p * 100)} %] la 3D touche le bord ${cut.join(", ")} : objet coupé ? (${file})`);
    if (overlaps.length) warnings.push(`[${v.name} ${Math.round(p * 100)} %] la 3D passe sous le texte ${overlaps.join(", ")} : recadrer (fitZone) (${file})`);
    shots.push({ view: v.name, p, file, cut });
    log(`[${v.name} ${Math.round(p * 100)} %] ok`);
    if (posterPath && p === points[0]) { // seulement la zone 3D, sans les textes posés dessus ; mobile : img/poster-mobile.jpg
      await page.evaluate(() => { document.body.style.visibility = "hidden"; document.querySelector("canvas").style.visibility = "visible"; });
      await page.locator("canvas").first().screenshot({ path: v.mobile ? posterPath.replace(/(\.\w+)$/, "-mobile$1") : posterPath, type: "jpeg", quality: 82, timeout: 180000, scale: "css" });
      await page.evaluate(() => { document.body.style.visibility = ""; document.querySelector("canvas").style.visibility = ""; });
    }
  }
  /* gros plan des titres visibles : un accent ou un caractère mal dessiné par la police se voit ici */
  const titles = await page.evaluate(() => [...document.querySelectorAll("h1, h2")].filter((el) => { const st = getComputedStyle(el); return el.textContent.trim() && st.visibility !== "hidden" && st.display !== "none"; }).slice(0, 3).map((el, i) => { el.setAttribute("data-p3d-title", i); return { i, text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 60), font: getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "") }; }));
  for (const t of titles) {
    const f = `${v.name}-titre-${t.i}.png`;
    try {
      await page.evaluate((i) => { const el = document.querySelector(`[data-p3d-title="${i}"]`); el.scrollIntoView({ block: "center" }); document.querySelectorAll("[data-p3d-cap]").forEach((c) => c.classList.toggle("p3d-on", c.contains(el))); }, t.i);
      await page.waitForTimeout(900);
      await page.locator(`[data-p3d-title="${t.i}"]`).screenshot({ path: `${out}/${f}`, timeout: 60000 });
      shots.push({ view: v.name, p: "titre", file: f, title: `${t.text} · ${t.font}` });
    } catch (e) {}
  }
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) errors.push(`[${v.name}] débordement horizontal`);
  Object.assign(pf, await page.evaluate(() => {
    const st = (window.__p3d && window.__p3d.stages) || [], res = performance.getEntriesByType("resource"), nav = performance.getEntriesByType("navigation")[0];
    const bytes = res.reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), nav ? nav.transferSize || 0 : 0);
    return {
      stages: st.length, kb: Math.round(bytes / 1024), requests: res.length + 1,
      readyMs: st.length ? Math.round(Math.max(...st.map((s) => s.readyAt || 0))) : null,
      programs: st.reduce((a, s) => a + (s.renderer.info.programs ? s.renderer.info.programs.length : 0), 0),
      textures: st.reduce((a, s) => a + s.renderer.info.memory.textures, 0),
      geometries: st.reduce((a, s) => a + s.renderer.info.memory.geometries, 0),
      pixelRatio: st.length ? st[0].pixelRatio : null, tier: st.length ? st[0].tier : null,
      lcpMs: Math.round(window.__vitals.lcp), cls: Math.round(window.__vitals.cls * 1000) / 1000,
    };
  }));
  const b = BUDGET[v.name];
  if (pf.stages) {
    if (pf.calls > b.calls) warnings.push(`[${v.name}] ${pf.calls} appels de dessin par image (budget ${b.calls}) : fusionner les géométries, InstancedMesh, partager les matériaux`);
    if (pf.triangles > b.triangles) warnings.push(`[${v.name}] ${pf.triangles.toLocaleString("fr-FR")} triangles (budget ${b.triangles.toLocaleString("fr-FR")}) : alléger les subdivisions, doser selon stage.tier`);
  }
  if (pf.kb > b.kb) warnings.push(`[${v.name}] ${pf.kb} Ko téléchargés (budget ${b.kb}) : compresser les images (WebP, 1600 px max) et les modèles (Draco, Meshopt)`);
  if (pf.cls > 0.1) warnings.push(`[${v.name}] décalage de mise en page CLS ${pf.cls} (bon : 0,1 ou moins) : réserver la place du canvas et des polices`);
  await page.close();
}
await browser.close();
fs.writeFileSync(`${out}/check.json`, JSON.stringify({ url, date: new Date().toISOString(), full, errors, warnings, perf, shots }, null, 2));
for (const [k, p] of Object.entries(perf)) if (p.stages) console.log(`Perf ${k} : ${p.calls} appels/image, ${p.triangles.toLocaleString("fr-FR")} triangles, ${p.kb} Ko, 3D prête en ${p.readyMs} ms (indicatif sans carte graphique)`);
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
    /* textes visibles posés sur la scène : la 3D ne doit jamais passer dessous */
    const op = (el) => { let o = 1; for (let e = el; e && e !== document.body; e = e.parentElement) { const st = getComputedStyle(e); if (st.visibility === "hidden" || st.display === "none") return 0; o *= +st.opacity; } return o; };
    const texts = [...document.querySelectorAll("h1,h2,h3,p,li,a,button,label")].filter((el) => {
      if (el.closest("[aria-hidden=true]") || !el.textContent.trim() || op(el) < 0.5) return false;
      const t = el.getBoundingClientRect(); return t.width > 4 && t.height > 4 && t.bottom > Math.max(0, r.top) && t.top < Math.min(innerHeight, r.bottom) && t.right > r.left && t.left < r.right;
    }).filter((el, i, a) => !a.some((o) => o !== el && o.contains(el))) // le bloc le plus large seulement
      /* les lignes de texte elles-mêmes (pas la boîte du bloc, souvent bien plus large que les lettres) */
      .flatMap((el) => { const rg = document.createRange(); rg.selectNodeContents(el); const label = el.textContent.replace(/\s+/g, " ").trim().slice(0, 40);
        return [...rg.getClientRects()].filter((t) => t.width > 2 && t.height > 2).map((t) => ({ x: t.left - r.left, y: t.top - r.top, w: t.width, h: t.height, label })); });
    document.body.style.visibility = "hidden"; c.style.visibility = "visible"; c.setAttribute("data-p3d-check", "");
    return { texts };
  }, sel);
  if (!ok) return { edges: [], overlaps: [] };
  let png;
  try { png = await page.locator("canvas[data-p3d-check]").screenshot({ timeout: 180000, scale: "css" }); }
  finally { await page.evaluate(() => { document.body.style.visibility = ""; const c = document.querySelector("canvas[data-p3d-check]"); if (c) { c.style.visibility = ""; c.removeAttribute("data-p3d-check"); } }); }
  return page.evaluate(async ([b64, texts]) => {
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
    if (all.filter(diff).length / all.length > 0.6) return { edges: [], overlaps: [] }; // scène plein cadre : rien à signaler
    /* chevauchement : part des pixels de la 3D (différents du fond) sous chaque bloc de texte */
    const overlaps = [], agg = {};
    for (const t of texts) {
      const x0 = Math.max(0, Math.floor(t.x)), y0 = Math.max(0, Math.floor(t.y)), x1 = Math.min(w, Math.ceil(t.x + t.w)), y1 = Math.min(h, Math.ceil(t.y + t.h));
      /* fond local : couleur dominante d'une bande de 24 px autour du texte (un fond en dégradé ou animé
         ne compte pas ; un objet 3D sous le texte, si) */
      const B = 24, hist2 = new Map();
      for (let y = Math.max(0, y0 - B); y < Math.min(h, y1 + B); y += 3) for (let x = Math.max(0, x0 - B); x < Math.min(w, x1 + B); x += 3) {
        if (x >= x0 && x < x1 && y >= y0 && y < y1) continue;
        const c = px(x, y), k = (c[0] >> 4) + "," + (c[1] >> 4) + "," + (c[2] >> 4); hist2.set(k, (hist2.get(k) || 0) + 1);
      }
      if (!hist2.size) continue;
      const lb = [...hist2.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map((v) => v * 16 + 8);
      let n = 0, tot = 0;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { tot++; const c = px(x, y); if (diff(c) && dist(c, lb) > 120) n++; }
      if (tot) { const o = (agg[t.label] = agg[t.label] || { n: 0, tot: 0 }); o.n += n; o.tot += tot; }
    }
    for (const [label, o] of Object.entries(agg)) if (o.n / o.tot > 0.04 && o.n > 40) overlaps.push(`« ${label} » (${Math.round((o.n / o.tot) * 100)} %)`);
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
    return { edges: out, overlaps };
  }, [png.toString("base64"), ok.texts]);
}

function perfHtml(perf) {
  if (!perf || !Object.keys(perf).length) return "";
  const rows = [["Appels de dessin / image", "calls"], ["Triangles", "triangles"], ["Particules", "points"], ["Poids téléchargé (Ko)", "kb"], ["Requêtes", "requests"], ["3D prête après (ms)", "readyMs"], ["LCP (ms)", "lcpMs"], ["CLS", "cls"], ["Shaders compilés", "programs"], ["Textures en mémoire", "textures"], ["Géométries en mémoire", "geometries"], ["Pixel ratio du rendu", "pixelRatio"], ["Niveau d'appareil", "tier"]];
  const f = (x) => (typeof x === "number" ? x.toLocaleString("fr-FR") : x ?? "–");
  return `<section><h2>Performances</h2><table class="perf"><tr><th></th><th>Ordinateur</th><th>Mobile</th></tr>${rows.map(([l, k]) => `<tr><td>${l}</td><td>${f(perf.desktop && perf.desktop[k])}</td><td>${f(perf.mobile && perf.mobile[k])}</td></tr>`).join("")}</table><p class="meta">Les temps sont indicatifs (mesurés sans carte graphique) ; appels, triangles et poids sont fiables.</p></section>`;
}

function writeReport() {
  const meta = JSON.parse(fs.readFileSync(`${out}/check.json`, "utf8"));
  let jury = null; try { jury = JSON.parse(fs.readFileSync(`${out}/jury.json`, "utf8")); } catch (e) {}
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const crit = [["originalite", "Originalité"], ["pertinence", "Pertinence"], ["finition", "Finition"], ["lisibilite", "Lisibilité"], ["fluidite", "Fluidité"], ["mobile", "Mobile"]];
  const views = ["desktop", "mobile"].map((v) => {
    const list = meta.shots.filter((s) => s.view === v && s.p !== "titre");
    const tl = meta.shots.filter((s) => s.view === v && s.p === "titre");
    return `<h2>${v === "desktop" ? "Ordinateur" : "Mobile"}</h2><div class="g ${v}">${list.map((s) => `<figure><img src="${s.file}" loading="lazy"${s.cut && s.cut.length ? ' class="cut"' : ""}><figcaption>${s.p === "fin" ? "fin de page" : Math.round(s.p * 100) + " %"}${s.cut && s.cut.length ? " · bord " + s.cut.join(", ") + " ?" : ""}</figcaption></figure>`).join("")}</div>${tl.length ? `<h3>Titres en gros plan (accents du nom ?)</h3><div class="titles">${tl.map((s) => `<figure><img src="${s.file}"><figcaption>${esc(s.title)}</figcaption></figure>`).join("")}</div>` : ""}`;
  }).join("");
  const juryHtml = jury ? `<section class="jury"><h2>Jury</h2>${crit.map(([k, l]) => { const n = +jury[k] || 0; return `<div class="row"><span>${l}</span><i><b style="width:${n * 10}%" class="${n >= 8 ? "ok" : "ko"}"></b></i><em>${n}/10</em></div>`; }).join("")}${jury.notes ? `<p>${esc(jury.notes)}</p>` : ""}</section>` : `<section class="jury"><h2>Jury</h2><p>Pas encore noté : écrire jury.json puis relancer avec --report-only.</p></section>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport premium-3d</title>
<style>body{margin:0;background:#0c0c0d;color:#f2f0ec;font:15px/1.5 system-ui,sans-serif;padding:28px}h1{font-size:26px;margin:0 0 4px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.14em;color:#9b9790;margin:30px 0 12px}
.meta{color:#9b9790}.err{color:#ff8f8f}.warn{color:#f5c26b}.okk{color:#7ddf9a}.g{display:grid;gap:12px}.g.desktop{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}.g.mobile{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
figure{margin:0}h3{font-size:13px;color:#9b9790;margin:18px 0 8px;font-weight:500}.titles{display:flex;flex-wrap:wrap;gap:12px}.titles img{width:auto;max-width:100%;max-height:140px;background:#fff1}img.cut{border-color:#f5c26b}img{width:100%;display:block;border-radius:8px;border:1px solid #2a2a2c}figcaption{font:12px ui-monospace,monospace;color:#9b9790;margin-top:4px}
.perf{border-collapse:collapse;font:13px ui-monospace,monospace}.perf td,.perf th{padding:5px 14px 5px 0;text-align:left;border-bottom:1px solid #222}.perf th{color:#9b9790;font-weight:500}
.jury .row{display:grid;grid-template-columns:110px 1fr 50px;align-items:center;gap:12px;margin:8px 0}.jury i{height:8px;background:#222;border-radius:4px;overflow:hidden}.jury b{display:block;height:100%}.ok{background:#22c55e}.ko{background:#f59e0b}.jury em{font-style:normal;font-family:ui-monospace,monospace}</style></head>
<body><h1>Rapport de contrôle</h1><div class="meta">${esc(meta.url)} · ${new Date(meta.date).toLocaleString("fr-FR")} · ${meta.full ? "rendu complet" : "rendu rapide (sans post-traitement)"}</div>
<p class="${meta.errors.length ? "err" : "okk"}">${meta.errors.length ? meta.errors.map(esc).join("<br>") : "Aucune erreur console, aucun débordement."}</p>
${(meta.warnings || []).length ? `<p class="warn">À vérifier :<br>${meta.warnings.map(esc).join("<br>")}</p>` : ""}
${perfHtml(meta.perf)}${juryHtml}${views}</body></html>`;
  fs.writeFileSync(`${out}/report.html`, html);
}
