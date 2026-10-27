// Banc d'essai du skill : contrôle chaque site d'une série et en fait un tableau comparable
// d'une version à l'autre. Protocole complet : bench/README.md.
//
//   python3 plugins/premium-3d/skills/premium-3d/tools/serve.py 5180 &      (racine du dépôt)
//   node bench/score.mjs bench/runs/1.9.0 [--base http://127.0.0.1:5180] [--compare bench/runs/1.8.0] [--skip-check]
//
// Pour chaque dossier <série>/<id>/ (index.html, meta.json écrit par l'agent constructeur,
// jury-auto.json : son propre jury ; jury.json, jury-2.json… : un par juge externe, moyennés) :
// check.mjs complet (ordinateur + mobile, --full), puis <série>/results.json et <série>/RESULTS.md.
// La comparaison avec une autre série ne porte que sur les sites présents dans les deux.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const base = opt("--base", "http://127.0.0.1:5180"), compare = opt("--compare", null), skipCheck = flag("--skip-check");
const dir = args[0];
if (!dir) { console.log("Usage : node bench/score.mjs bench/runs/<version> [--compare bench/runs/<autre>]"); process.exit(1); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CHECK = path.join(ROOT, "plugins/premium-3d/skills/premium-3d/tools/check.mjs");
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const JURY = ["originalite", "pertinence", "finition", "lisibilite", "fluidite", "mobile"];

const results = [];
for (const id of fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "index.html"))).sort()) {
  const site = path.join(dir, id), meta = read(path.join(site, "meta.json")) || {};
  const url = `${base}/${path.relative(ROOT, site).split(path.sep).join("/")}/index.html`;
  const out = path.join(site, "captures");
  if (!skipCheck) {
    const t0 = Date.now();
    console.log(`[${id}] contrôle de ${url}…`);
    try {
      execFileSync("node", [CHECK, url, out, "--full", "--cpu", ...(meta.section ? ["--section", meta.section] : [])], { stdio: ["ignore", "ignore", "inherit"], timeout: 30 * 60 * 1000 });
    } catch (e) { console.log(`[${id}] check.mjs a échoué : ${e.message.split("\n")[0]}`); }
    console.log(`[${id}] fait en ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  const c = read(path.join(out, "check.json")) || { errors: ["check.json absent"], warnings: [], perf: {} };
  /* juges externes : jury.json, jury-2.json… (moyenne) ; jury-auto.json : la note que l'agent s'est donnée */
  const juries = fs.readdirSync(site).filter((f) => /^jury(-\d+)?\.json$/.test(f)).sort().map((f) => read(path.join(site, f))).filter(Boolean);
  const mean = (j) => Math.round((JURY.reduce((a, k) => a + (+j[k] || 0), 0) / JURY.length) * 10) / 10;
  const jury = juries[0] || null, auto = read(path.join(site, "jury-auto.json"));
  const juryAvg = juries.length ? Math.round((juries.reduce((a, j) => a + mean(j), 0) / juries.length) * 10) / 10 : null;
  const warn = c.warnings.filter((w) => !/^\s*réglage conseillé/.test(w));
  const d = c.perf.desktop || {}, m = c.perf.mobile || {};
  results.push({
    id, errors: c.errors.length, warnings: warn.length,
    cut: warn.filter((w) => /touche le bord/.test(w)).length, underText: warn.filter((w) => /sous le texte/.test(w)).length,
    budget: warn.filter((w) => /budget|CLS|images\/s|à-coups/.test(w)).length,
    jumps: warn.filter((w) => /passe de .* de l'écran|lumière saute|couleur dominante|compteur recule/.test(w)).length,
    todo: c.errors.filter((e) => /squelette/.test(e)).length + warn.filter((w) => /provisoire/.test(w)).length,
    calls: d.calls ?? null, trianglesK: d.triangles != null ? Math.round(d.triangles / 1000) : null, kb: d.kb ?? null,
    readyMs: d.readyMs ?? null, lcpMs: m.lcpMs ?? d.lcpMs ?? null, cls: Math.max(d.cls || 0, m.cls || 0),
    jury: juryAvg, judges: juries.length, juryAuto: auto ? mean(auto) : null,
    juryGap: auto && juryAvg != null ? Math.round((mean(auto) - juryAvg) * 10) / 10 : null,
    juryDetail: jury, juryNotes: juries.map((j) => j.notes).filter(Boolean), minutes: meta.minutes_mesurees ?? meta.minutes ?? null, tokensK: meta.tokens ? Math.round(meta.tokens / 1000) : null,
    concept: meta.concept || "", detail: { errors: c.errors, warnings: warn },
  });
}

const avg = (k) => { const v = results.map((r) => r[k]).filter((x) => typeof x === "number"); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
const COLS = [["errors", "Erreurs", -1], ["warnings", "Alertes", -1], ["cut", "3D coupée", -1], ["underText", "Sous le texte", -1], ["jumps", "Sauts", -1], ["todo", "Provisoires", -1], ["budget", "Budget", -1], ["jury", "Jury /10", 1], ["juryAuto", "Auto-jury", 0], ["juryGap", "Écart auto", 0], ["minutes", "Minutes", -1], ["tokensK", "Ktokens", -1], ["kb", "Ko", -1], ["readyMs", "3D prête (ms)", -1]];
const summary = Object.fromEntries(COLS.map(([k]) => [k, avg(k)]));
const version = path.basename(dir);
fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ version, date: new Date().toISOString(), summary, results }, null, 2));

let md = `# Banc d'essai premium-3d ${version}\n\n${new Date().toISOString().slice(0, 10)} · ${results.length} sites · rendu logiciel\n\n`;
md += `| Site | ${COLS.map((c) => c[1]).join(" | ")} |\n|---|${COLS.map(() => "---").join("|")}|\n`;
for (const r of results) md += `| ${r.id} | ${COLS.map(([k]) => r[k] ?? "–").join(" | ")} |\n`;
md += `| **Moyenne** | ${COLS.map(([k]) => (summary[k] ?? "–")).join(" | ")} |\n`;
const prev = compare && read(path.join(compare, "results.json"));
if (prev) {
  md += `\n## Comparaison avec ${prev.version} (sites communs)\n\n| Mesure | ${prev.version} | ${version} | |\n|---|---|---|---|\n`;
  for (const [k, l, dirn] of COLS) {
    /* mêmes sites des deux côtés (une série peut avoir des demandes en plus) */
    const ids = new Set(prev.results.map((r) => r.id).filter((id) => results.some((r) => r.id === id)));
    const m = (list) => { const v = list.filter((r) => ids.has(r.id)).map((r) => r[k]).filter((x) => typeof x === "number"); return v.length ? Math.round((v.reduce((x, y) => x + y, 0) / v.length) * 10) / 10 : null; };
    const a = m(prev.results), b = m(results);
    const verdict = a == null || b == null || a === b || !dirn ? "=" : (b - a) * dirn > 0 ? "mieux" : "moins bien";
    md += `| ${l} | ${a ?? "–"} | ${b ?? "–"} | ${verdict} |\n`;
  }
}
md += `\n## Détail\n`;
for (const r of results) {
  md += `\n### ${r.id}${r.concept ? ` · ${r.concept}` : ""}\n`;
  r.juryNotes.forEach((n, i) => (md += `Jury${r.judges > 1 ? " " + (i + 1) : ""} : ${n}\n\n`));
  if (r.juryAuto != null) md += `Auto-jury : ${r.juryAuto} (écart avec le juge : ${r.juryGap > 0 ? "+" : ""}${r.juryGap ?? "–"})\n\n`;
  [...r.detail.errors.map((e) => "- erreur : " + e), ...r.detail.warnings.map((w) => "- " + w.trim())].forEach((l) => (md += l + "\n"));
}
fs.writeFileSync(path.join(dir, "RESULTS.md"), md);
console.log(md.split("\n## Détail")[0]);
