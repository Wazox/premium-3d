# Changelog

## 1.9.0

**Plus juste**
- three.js 0.169 → **0.186.1** (THREE.Clock obsolète remplacé, SVGLoader et ombres mis à jour) ;
  démos et exemples vérifiés sans erreur.
- `fitZone(camera, objet, zone)` mesure l'objet lui-même : il ne peut plus être coupé.
- `check.mjs` **propose la correction** : quand la 3D est coupée ou passe sous un texte, il situe
  l'objet et le texte sur la capture et donne la zone `fitZone` qui les sépare.

**Plus rapide à démarrer**
- `tools/new.mjs` : squelette d'une nouvelle page avec toute la plomberie (importmap, fondu,
  préchauffage, scroll lissé, pause, `__demo`, cadrage), sans aucun design.

**Nouveau**
- `lib/splat.js` : **scans 3D réels** (Gaussian splatting, .spz/.ply) avec Spark, en WebGL 2 ; piste
  de concept « Le vrai lieu, scanné ».
- `lib/r3f.js` : composants **React Three Fiber** (Studio, Material, Logo3D, Text3D, Particles),
  testés dans une vraie app Vite + React 19.
- Description du skill élargie : il se déclenche sur « site premium », « landing », « hero »,
  « effet waouh », « animation au scroll », même sans le mot 3D.

**Mesurer**
- `bench/` : banc d'essai. 5 demandes fixes, des agents à l'aveugle construisent les sites,
  `bench/score.mjs` contrôle et compare les versions, un agent juge note les captures.
  Premier passage (`bench/runs/1.9.0/RESULTS.md`) : 0 erreur, 0,4 alerte et 6,1/10 au jury en
  moyenne, 22 min et 208 k tokens par site. C'est la référence des versions suivantes.

**Corrigé grâce au banc d'essai**
- `check.mjs` : les légendes affichées pour un gros plan de titre sont remises comme la page les
  avait laissées (deux légendes se superposaient) ; nouvelle alerte « textes superposés » ;
  « débordement horizontal » nomme les éléments fautifs.
- `neon()` garde la teinte exacte à l'écran (un vert virait au cyan).
- Doc : un matériau par face = un appel de dessin par face ; `onResize` appelé tout de suite ;
  `fitZone` et particules ; verre et liquide opaque ; verre teinté ; néon qui blanchit au bloom ;
  accent du « è » de Cormorant Garamond.

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
