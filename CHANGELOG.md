# Changelog

## 1.8.0

**Plus rapide**
- Les outils utilisent la carte graphique dès qu'il y a un écran (avant : toujours le rendu logiciel).
  `--gpu` / `--cpu` pour forcer. Lanceur commun `tools/browser.mjs` (proxy, `CHROMIUM_PATH`).
- `check.mjs` : un seul passage vers le bas, attente de la fin des animations au lieu de délais fixes,
  vues ordinateur et mobile en parallèle avec une carte graphique. Mesuré sans carte graphique sur
  l'exemple garage : 4 min 51 s → 2 min 30 s.
- `render.mjs` : rendu découpé entre plusieurs navigateurs (`--workers`), pré-calcul sans dessin
  (`stage.step(dt, false)`), capture JPEG directe, temps par image affiché.

**Plus de pages**
- `render.mjs` filme n'importe quelle page WebGL (React Three Fiber, three.js maison, animations CSS)
  grâce au temps virtuel de Chrome ; `--still N` filme sans défiler.
- Les bannières de cookies sont fermées automatiquement (check, record, render, brand).

**Sites plus légers et fluides**
- `loadModel` lit Meshopt et les textures KTX2 (`{ stage }`), et la doc donne la commande
  gltf-transform qui allège un modèle 5 à 10 fois.
- `studioLights` : taille de l'ombre selon l'appareil (512 / 1024 / 2048).
- `check.mjs` mesure la fluidité réelle au défilement (images/s, image la plus lente sur 20) avec une
  carte graphique, et la signale sous 50 images/s.

**Plus beau**
- `neon(couleur, éclat)` : un rouge ou un bleu brille autant qu'un vert au bloom (avec `hdr()`, un
  rouge au même réglage restait terne).

**Moins de tokens**
- SKILL.md allégé : le détail des outils passe dans `references/tools.md`, lu seulement au besoin.
