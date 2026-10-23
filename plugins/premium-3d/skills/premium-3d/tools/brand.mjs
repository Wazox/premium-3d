// Extrait la marque d'un site existant (celui du client, à refaire ou à enrichir) :
// couleurs (fond, texte, accents), polices, logo, textes clés, capture de référence.
// Prérequis : npm i playwright
// Usage :
//   node tools/brand.mjs <url> [dossier]        (dossier par défaut : ./brand)
// Produit : <dossier>/brand.json, <dossier>/brand.html (planche à montrer), <dossier>/site.png,
//           et <dossier>/logo.svg ou logo.png quand un logo est trouvé.
// À relire avant d'utiliser : un site peut avoir des couleurs de bandeau cookies, de widget de chat,
// ou un logo de partenaire. Les textes récupérés sont ceux du client : les garder, ne rien inventer.
import fs from "node:fs";
import { dismissCookies, launch } from "./browser.mjs";

const url = process.argv[2];
const out = process.argv[3] || "./brand";
if (!url) { console.log("Usage : node tools/brand.mjs <url> [dossier]"); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

const browser = await launch("cpu");
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => page.waitForLoadState("load"));
await page.waitForTimeout(1200);
if (await dismissCookies(page)) await page.waitForTimeout(400); // bannière de cookies : elle cacherait la 3D
await page.screenshot({ path: `${out}/site.png` });

const data = await page.evaluate(() => {
  const toRgb = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return a < 0.5 ? null : [r, g, b]; };
  const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const key = ([r, g, b]) => [r, g, b].map((v) => Math.round(v / 12) * 12).join(",");
  const chroma = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const bgs = new Map(), texts = new Map(), all = new Map();
  const add = (map, c, w) => { const k = key(c); const e = map.get(k) || { c, w: 0 }; e.w += w; map.set(k, e); };
  const vis = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 2 && r.height > 2 && st.visibility !== "hidden" && st.display !== "none" && +st.opacity > 0.1; };
  const els = [...document.querySelectorAll("body, body *")].filter((el) => !/^(SCRIPT|STYLE|NOSCRIPT|META|LINK)$/.test(el.tagName)).slice(0, 4000);
  const H = document.documentElement.scrollHeight;
  for (const el of els) {
    if (!vis(el)) continue;
    const st = getComputedStyle(el), r = el.getBoundingClientRect();
    const area = Math.min(r.width, innerWidth) * Math.min(r.height, H);
    const bg = toRgb(st.backgroundColor); if (bg) { add(bgs, bg, area); add(all, bg, area * 0.15); }
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
    if (own) { const c = toRgb(st.color); if (c) { const w = own.length * parseFloat(st.fontSize); add(texts, c, w); add(all, c, w * 3); } }
    const bc = st.borderTopWidth !== "0px" && toRgb(st.borderTopColor); if (bc) add(all, bc, r.width * 4);
    if (el.tagName === "svg" || el.closest("svg")) { const f = toRgb(st.fill); if (f) add(all, f, area * 0.5); }
  }
  const sorted = (m) => [...m.values()].sort((a, b) => b.w - a.w);
  const background = sorted(bgs)[0]?.c || [255, 255, 255];
  /* texte principal : la couleur la plus utilisée parmi celles qui se lisent sur le fond (contraste ≥ 3) */
  const rel = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const contrast = (a, b) => { const x = rel(a), y = rel(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const text = (sorted(texts).find((e) => contrast(e.c, background) >= 3) || sorted(texts)[0])?.c || [17, 17, 17];
  const accents = sorted(all).filter((e) => chroma(e.c) > 0.18 && lum(e.c) > 0.08 && lum(e.c) < 0.95).slice(0, 5).map((e) => hex(e.c));
  const neutrals = sorted(all).filter((e) => chroma(e.c) <= 0.18 && key(e.c) !== key(background) && key(e.c) !== key(text)).slice(0, 3).map((e) => hex(e.c));

  const fam = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim() : null; };
  const fonts = { titres: fam("h1") || fam("h2"), texte: fam("p") || fam("body"), boutons: fam("button, .btn, a[class*=btn], a[class*=button]") };
  const loaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, ""));

  /* logo : dans l'en-tête, un élément qui s'annonce comme logo, sinon la première image de l'en-tête */
  const head = document.querySelector("header, [role=banner], nav, .header, #header") || document.body;
  const isLogo = (el) => /logo|brand|marque/i.test([el.id, el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className, el.getAttribute("alt"), el.getAttribute("src"), el.getAttribute("aria-label"), el.parentElement && el.parentElement.className].join(" "));
  const cand = [...head.querySelectorAll("img, svg")].filter((el) => vis(el) && !el.closest("svg svg"));
  const logoEl = cand.find(isLogo) || cand[0] || null;
  let logo = null;
  if (logoEl && logoEl.tagName.toLowerCase() === "svg") {
    const c = logoEl.cloneNode(true); const col = getComputedStyle(logoEl).color;
    c.querySelectorAll("*").forEach((n) => { if (n.getAttribute("fill") === "currentColor") n.setAttribute("fill", col); });
    if (c.getAttribute("fill") === "currentColor") c.setAttribute("fill", col);
    if (!c.getAttribute("xmlns")) c.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    logo = { type: "svg", svg: c.outerHTML };
  } else if (logoEl) logo = { type: "img", src: logoEl.currentSrc || logoEl.src, alt: logoEl.getAttribute("alt") || "" };
  const meta = (n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.content || null;
  const icon = document.querySelector('link[rel="apple-touch-icon"], link[rel~="icon"]')?.href || null;

  const txt = (el) => el.textContent.replace(/\s+/g, " ").trim();
  return {
    url: location.href, titre: document.title, description: meta("description"), ogImage: meta("og:image"), icone: icon,
    couleurs: { fond: hex(background), texte: hex(text), accents, neutres: neutrals },
    polices: fonts, policesChargees: [...new Set(loaded)],
    logo,
    textes: {
      h1: [...document.querySelectorAll("h1")].map(txt).filter(Boolean).slice(0, 2),
      h2: [...document.querySelectorAll("h2")].map(txt).filter(Boolean).slice(0, 6),
      menu: [...head.querySelectorAll("a")].map(txt).filter((t) => t && t.length < 40).slice(0, 10),
      telephone: [...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute("href").slice(4))[0] || null,
      email: [...document.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute("href").slice(7).split("?")[0])[0] || null,
    },
  };
});

/* logo en image : on le récupère tel quel (on ne le vectorise pas : le redessiner en SVG propre si besoin) */
if (data.logo && data.logo.type === "svg") { fs.writeFileSync(`${out}/logo.svg`, data.logo.svg); data.logo.fichier = "logo.svg"; delete data.logo.svg; }
else if (data.logo && data.logo.src) {
  try {
    const r = await page.request.get(data.logo.src);
    const type = r.headers()["content-type"] || "";
    const ext = /svg/.test(type) || /\.svg(\?|$)/i.test(data.logo.src) ? "svg" : /webp/.test(type) ? "webp" : /jpe?g/.test(type) ? "jpg" : "png";
    fs.writeFileSync(`${out}/logo.${ext}`, await r.body()); data.logo.fichier = `logo.${ext}`;
  } catch (e) { data.logo.erreur = "téléchargement impossible"; }
}
await browser.close();
fs.writeFileSync(`${out}/brand.json`, JSON.stringify(data, null, 2));

const esc = (s) => String(s ?? "non trouvé").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const sw = (c, l) => `<figure><i style="background:${c}"></i><figcaption>${esc(l)}<br><b>${c}</b></figcaption></figure>`;
const C = data.couleurs;
fs.writeFileSync(`${out}/brand.html`, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Marque extraite</title>
<style>body{margin:0;padding:28px;background:#f5f4f1;color:#1b1b1b;font:15px/1.5 system-ui,sans-serif}h1{font-size:24px;margin:0 0 4px}h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#777;margin:28px 0 10px}
.row{display:flex;flex-wrap:wrap;gap:14px}figure{margin:0;width:120px}i{display:block;height:72px;border-radius:10px;border:1px solid #0002}figcaption{font-size:12px;margin-top:6px}
.logo{background:#fff;border:1px solid #0001;border-radius:10px;padding:18px;display:inline-block}.logo img{height:90px;width:auto;max-width:360px;display:block}img.site{width:100%;max-width:900px;border-radius:10px;border:1px solid #0002}
ul{margin:0;padding-left:18px}.warn{color:#9a5b00}</style></head><body>
<h1>Marque extraite</h1><div>${esc(data.url)}</div>
<h2>Couleurs</h2><div class="row">${sw(C.fond, "Fond")}${sw(C.texte, "Texte")}${C.accents.map((c, i) => sw(c, "Accent " + (i + 1))).join("")}${C.neutres.map((c) => sw(c, "Neutre")).join("")}</div>
<h2>Polices</h2><ul><li>Titres : ${esc(data.polices.titres)}</li><li>Texte : ${esc(data.polices.texte)}</li><li>Boutons : ${esc(data.polices.boutons)}</li><li>Chargées : ${esc(data.policesChargees.join(", ") || "aucune police web")}</li></ul>
<h2>Logo</h2>${data.logo && data.logo.fichier ? `<div class="logo"><img src="${esc(data.logo.fichier)}" alt=""></div><p>${data.logo.type === "img" && !/svg/.test(data.logo.fichier) ? '<span class="warn">Logo en image : à redessiner en SVG propre pour la 3D (logoPieces).</span>' : "Logo en SVG : utilisable directement avec logoPieces."}</p>` : '<p class="warn">Pas de logo trouvé dans l\'en-tête : le demander à la personne.</p>'}
<h2>Textes du site</h2><ul><li>Titre : ${esc(data.titre)}</li><li>Description : ${esc(data.description)}</li>${data.textes.h1.map((t) => `<li>H1 : ${esc(t)}</li>`).join("")}${data.textes.h2.map((t) => `<li>H2 : ${esc(t)}</li>`).join("")}<li>Menu : ${esc(data.textes.menu.join(" · "))}</li><li>Téléphone : ${esc(data.textes.telephone)}</li><li>Email : ${esc(data.textes.email)}</li></ul>
<h2>Le site aujourd'hui</h2><img class="site" src="site.png" alt="">
</body></html>`);
console.log(`Marque extraite dans ${out} (brand.html, brand.json${data.logo && data.logo.fichier ? ", " + data.logo.fichier : ""}). Couleurs : fond ${C.fond}, texte ${C.texte}, accents ${C.accents.join(" ") || "aucun"}.`);
