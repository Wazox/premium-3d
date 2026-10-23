// Squelette technique d'un projet premium-3d : toute la plomberie, aucun design.
//
// Ce que chaque projet réécrivait à la main (et où tombaient la plupart des petites erreurs) :
// importmap, canvas épinglé, fondu d'apparition, image de secours, préchauffage, suivi du scroll
// lissé, bouton pause, window.__demo pour les outils, modules de lib/ et outils de contrôle copiés.
// Le concept, la mise en page, les couleurs, les polices et les textes restent à écrire : les
// emplacements sont marqués [À ÉCRIRE] ou [À CHOISIR] et rien n'y est inventé.
//
// Usage :
//   node tools/new.mjs <dossier> [--modules story,particles,…] [--hero] [--force]
//   --modules  modules de lib/ en plus de core.js (dépendances ajoutées toutes seules)
//   --hero     scène fixe en haut de page (sinon : scène épinglée qui suit le scroll)
//   --force    écrire dans un dossier qui n'est pas vide
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THREE_VERSION = "0.186.1";
const DEPS = { particles: ["shaders"], story: [], react: [] }; // core.js est toujours copié

const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const hero = flag("--hero"), force = flag("--force");
const wanted = opt("--modules", "story").split(",").map((m) => m.trim().replace(/\.js$/, "")).filter(Boolean);
const dir = args[0];
if (!dir) { console.log("Usage : node tools/new.mjs <dossier> [--modules story,particles] [--hero] [--force]"); process.exit(1); }
if (fs.existsSync(dir) && fs.readdirSync(dir).length && !force) { console.log(`ERREUR : ${dir} n'est pas vide (--force pour écrire quand même).`); process.exit(1); }

const mods = new Set(["core"]);
const add = (m) => {
  if (!fs.existsSync(`${SKILL}/lib/${m}.js`)) { console.log(`ERREUR : lib/${m}.js n'existe pas. Modules : ${fs.readdirSync(`${SKILL}/lib`).map((f) => f.replace(".js", "")).join(", ")}`); process.exit(1); }
  mods.add(m); (DEPS[m] || []).forEach(add);
};
wanted.forEach(add);

fs.mkdirSync(`${dir}/lib`, { recursive: true });
fs.mkdirSync(`${dir}/tools`, { recursive: true });
fs.mkdirSync(`${dir}/img`, { recursive: true });
fs.mkdirSync(`${dir}/licenses`, { recursive: true });
for (const m of mods) fs.copyFileSync(`${SKILL}/lib/${m}.js`, `${dir}/lib/${m}.js`);
for (const t of ["browser.mjs", "check.mjs", "serve.py"]) fs.copyFileSync(`${SKILL}/tools/${t}`, `${dir}/tools/${t}`);
fs.copyFileSync(`${SKILL}/licenses/Three-MIT.txt`, `${dir}/licenses/Three-MIT.txt`);

const story = mods.has("story");
const imports = [`import { createStage, scrollTrack, fitZone, ss, THREE } from "./lib/core.js";`];
if (story) imports.push(`import { acts, captionSync } from "./lib/story.js";`);
imports.push(`import { motionToggle } from "./lib/interact.js";`);
fs.copyFileSync(`${SKILL}/lib/interact.js`, `${dir}/lib/interact.js`); mods.add("interact");

const scene = hero
  ? `<section id="scene" class="scene" aria-label="[À ÉCRIRE : ce que montre la scène]">
  <canvas id="gl" aria-hidden="true"></canvas>
  <div class="caption">
    <h1>[À ÉCRIRE : titre]</h1>
    <p>[À ÉCRIRE : phrase d'accroche]</p>
    <a class="cta" href="#contact">[À ÉCRIRE : appel à l'action]</a>
  </div>
  <button class="p3d-pause" type="button"></button>
</section>`
  : `<section id="scene" class="scene" aria-label="[À ÉCRIRE : ce que montre la scène]">
  <div class="pin">
    <canvas id="gl" aria-hidden="true"></canvas>
    <div class="caps">
      <div class="cap"><h1>[À ÉCRIRE : titre]</h1><p>[À ÉCRIRE : accroche]</p></div>
      <div class="cap"><h2>[À ÉCRIRE : 2e temps]</h2><p>[À ÉCRIRE]</p></div>
      <div class="cap"><h2>[À ÉCRIRE : 3e temps]</h2><p>[À ÉCRIRE]</p><a class="cta" href="#contact">[À ÉCRIRE : appel à l'action]</a></div>
    </div>
    <button class="p3d-pause" type="button"></button>
  </div>
</section>`;

const css = `:root{
  --bg:[À CHOISIR];      /* fond, tiré de la marque */
  --ink:[À CHOISIR];     /* texte */
  --accent:[À CHOISIR];  /* la couleur qui brille */
}
*{box-sizing:border-box}
html,body{background:var(--bg)}
body{margin:0;color:var(--ink)}
${hero ? `.scene{position:relative;height:100svh;overflow:hidden}` : `.scene{position:relative;height:400vh}   /* durée du récit : plus haut = plus lent */
.pin{position:sticky;top:0;height:100svh;overflow:hidden}`}
/* fondu d'apparition : le conteneur reçoit .p3d-ready quand tout est compilé */
#gl{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .8s}
.p3d-ready #gl{opacity:1}
${hero ? `.caption{position:relative;z-index:1}` : `/* [À CHOISIR] la zone du texte ; la 3D prend l'autre (zone de fitZone dans le script) */
.caps{position:absolute;left:6vw;bottom:12vh;width:min(480px,38vw);height:50vh}
.cap{position:absolute;inset:auto 0 0 0}
@media (max-width:860px){.caps{left:16px;right:16px;width:auto;bottom:8vh;height:40vh}}`}
/* bouton pause (accessibilité : animation de plus de 5 s) */
.p3d-pause{position:absolute;right:16px;bottom:16px;z-index:2;width:40px;height:40px;border-radius:50%;cursor:pointer}
.p3d-pause[data-state=playing]::before{content:"❚❚"}
.p3d-pause[data-state=paused]::before{content:"▶"}
@media (prefers-reduced-motion:reduce){#gl{transition:none}}`;

const loop = story
  ? `const caps = captionSync(section.querySelectorAll(".cap"));
const story = acts([["intro", 0, 0.33], ["milieu", 0.33, 0.66], ["fin", 0.66, 1]]); // [À ÉCRIRE : les actes du récit]
`
  : "";
const body = story
  ? `    const a = story.at(P); caps.show(a.index);
    // [À ÉCRIRE] animer selon P (scroll, 0 → 1), story.k("milieu", P) (0 → 1 dans un acte) et t (temps)`
  : `    // [À ÉCRIRE] animer selon P (scroll, 0 → 1) et t (temps, figé par le bouton pause)`;

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>[À ÉCRIRE]</title>
<meta name="description" content="[À ÉCRIRE]">
<!-- polices : [À CHOISIR] (references/art-direction.md), avec display=swap -->
<style>
${css}
</style>
</head>
<body>
<main>
${scene}
<!-- [À ÉCRIRE] le reste de la page, en HTML -->
</main>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"}}</script>
<script type="module">
${imports.join("\n")}

const section = document.getElementById("scene");
${hero ? "" : "const track = scrollTrack(section);\n"}${loop}
const stage = createStage(document.getElementById("gl"), {
  background: "[À CHOISIR]", accent: "[À CHOISIR]",
  // poster: "img/poster.jpg",  // à activer après : node tools/check.mjs <url> ./captures-full --full --poster img/poster.jpg
});
if (stage) {
  motionToggle(stage, section.querySelector(".p3d-pause"));

  // [À ÉCRIRE] les objets de la scène (lib/ + THREE), tous créés ici, jamais dans la boucle
  const root = new THREE.Group();
  stage.scene.add(root);

  // cadrage : la 3D dans sa zone, le texte dans la sienne, à toutes les tailles.
  // Garder ce bloc APRÈS la construction des objets (await compris) : fitZone mesure root.
  stage.onResize((w) => {
    const zone = w < 860 ? { top: 0.08, bottom: 0.5 } : { left: 0.45 }; // [À CHOISIR]
    stage.camera.position.set(0, 0, fitZone(stage.camera, root, zone)); // mesure root : l'objet reste entier
    stage.camera.lookAt(0, 0, 0);
  });

  let P = 0;
  await stage.warm(); // compile tout avant l'arrivée sur la scène (pas d'à-coup)
  stage.start((dt, t, real) => {
${hero ? "    // scène fixe : pas de scroll, l'animation suit t" : "    P += (track.progress() - P) * (stage.reduce ? 1 : 1 - Math.pow(0.0005, real)); // scroll lissé"}
${body}
  });
}
window.__demo = { get ready() { return !stage || stage.ready; } }; // les outils attendent la 3D
</script>
</body>
</html>
`;
fs.writeFileSync(`${dir}/index.html`, html);
console.log(`Squelette créé dans ${dir} : index.html, lib/ (${[...mods].join(", ")}), tools/ (check, serve), licenses/.
Reste à écrire : tout ce qui est marqué [À ÉCRIRE] ou [À CHOISIR] (grep -n "À ÉCRIRE\\|À CHOISIR" ${dir}/index.html).`);
