// Contrôles sans navigateur : syntaxe de tout le JavaScript, et squelettes de new.mjs complets.
//   node tests/static.mjs
// 1. node --check sur chaque .js / .mjs du dépôt ;
// 2. new.mjs lancé une fois par module de lib/ : chaque import relatif des fichiers copiés
//    doit exister dans le squelette (c'est ce qui cassait --modules r3f avant la 1.13.1).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.join(ROOT, "plugins/premium-3d/skills/premium-3d");
const errors = [];

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.name === "node_modules" || e.name.startsWith(".") ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const scripts = walk(ROOT).filter((f) => /\.(m?js)$/.test(f));
for (const f of scripts) {
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
  catch (e) { errors.push(`syntaxe : ${path.relative(ROOT, f)}\n${String(e.stderr).trim()}`); }
}
console.log(`syntaxe : ${scripts.length} fichiers`);

/* imports relatifs réels (pas ceux des commentaires d'en-tête) */
const relImports = (src) => [...src.matchAll(/^\s*import\b[^;]*?from\s+["'](\.{1,2}\/[^"']+)["']/gm)].map((m) => m[1]);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "p3d-"));
const mods = fs.readdirSync(path.join(SKILL, "lib")).map((f) => f.replace(/\.js$/, ""));
for (const m of mods) {
  for (const hero of [false, true]) {
    const dir = path.join(tmp, `${m}${hero ? "-hero" : ""}`);
    try { execFileSync(process.execPath, [path.join(SKILL, "tools/new.mjs"), dir, "--modules", m, ...(hero ? ["--hero"] : [])], { stdio: "pipe" }); }
    catch (e) { errors.push(`new.mjs --modules ${m} : ${String(e.stdout || e.stderr).trim()}`); continue; }
    const files = [path.join(dir, "index.html"), ...fs.readdirSync(path.join(dir, "lib")).map((f) => path.join(dir, "lib", f))];
    for (const f of files) {
      let src = fs.readFileSync(f, "utf8");
      if (f.endsWith(".html")) src = [...src.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((x) => x[1]).join("\n");
      for (const imp of relImports(src)) {
        if (!fs.existsSync(path.resolve(path.dirname(f), imp))) errors.push(`new.mjs --modules ${m}${hero ? " --hero" : ""} : ${path.relative(dir, f)} importe ${imp}, absent du squelette`);
      }
    }
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`squelettes : ${mods.length} modules × 2 mises en page`);

if (errors.length) { console.error(`\n${errors.length} erreur(s) :\n- ${errors.join("\n- ")}`); process.exit(1); }
console.log("OK");
