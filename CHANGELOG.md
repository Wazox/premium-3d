# Changelog

## 1.13.1

**Corrections**
- `new.mjs --modules r3f` : les modules importés par `r3f.js` (logo3d, text3d, particles, shaders)
  sont copiés ; les dépendances sont lues dans les vrais imports de chaque module.
- Contexte WebGL restauré : les reflets (PMREM) sont recalculés, métal et verre ne repartent plus ternes.
- `usePremium3D` (React) : `update(dt, t, real)` comme ailleurs, et `false` endort la scène.
- `stage.dispose()` libère tout : écouteurs, image de secours, `p3d-ready`, entrée de `__p3d`
  (en React StrictMode, les images de secours ne s'empilent plus).
- `tier()` rend son contexte WebGL jetable ; la boucle s'arrête quand plus aucune scène ne tourne.
- `sampleText` accepte une police en `rem`, `em` ou `9.5px` (plantait sans « NNpx »).

**Plus propre**
- `.dispose()` sur `scrollTrack`, `dragRotate`, `hoverPick`, `pointerLight` et `tilt` (démontage
  d'un composant React/Vue sans écouteur oublié).
- `tools/serve.py` : plusieurs requêtes à la fois (contrôles plus rapides), port réutilisable tout
  de suite, pas de cache, types `.glb`, `.wasm`, `.ktx2`, `.woff2`.

**Plus léger**
- `docs/` passe de 12 Mo à 1,6 Mo : la galerie en WebP (le GIF de 4,3 Mo devient un WebP animé de
  644 Ko), aperçu de partage en JPG.

**Tests**
- CI GitHub Actions : syntaxe, squelettes `new.mjs` pour chaque module, et dans Chromium : cycle de
  vie (contexte perdu, double montage, `dispose()`), chaque démo et exemple sans erreur.

## 1.13.0

- `lib/daylight.js` : **l'heure qui passe** au scroll (jour → nuit, nuit → aube) : fond,
  brouillard, soleil, ambiance, reflets, couleurs des matériaux et lumières qui s'allument, ensemble
  et en douceur. Nouvelle piste « L'heure qui passe » dans `concepts.md`.
- `route().turns` : les virages du trajet (position, côté, direction de sortie).
- `demos/gps.html` : **flèche du prochain virage** posée sur la chaussée, consigne « à droite dans
  450 m » ; **de la fin d'après-midi à la nuit** pendant le trajet, phares et feux qui s'allument ;
  compteurs sur fond sombre, lisibles de jour comme de nuit.
- `check.mjs` : un compte à rebours voulu (`data-p3d-countdown`) n'est plus signalé comme un
  compteur qui recule.

## 1.12.0

**Encore d'autres langages visuels**
- `lib/terrain.js` : **relief** qui sort du plat (fonction ou image en niveaux de gris), lignes de
  niveau façon carte IGN, `heightAt()` pour poser un sentier dessus.
- `lib/cloth.js` : **tissu** qui ondule au vent et s'enroule pour dévoiler un objet (`fabric()` :
  velours, lin).
- `melt()` (shaders.js) : la matière **fond**, coule et s'étale en flaque (glace, chocolat, cire).
- `demos/styles-2.html`.

**Le trajet GPS**
- `route(points, rayon)` (ribbon.js) : rues droites et virages arrondis ; `ribbon(…, { up })` pose
  le ruban à plat sur le sol.
- `demos/gps.html` : scène de navigation complète au scroll : ville, trajet prévu et trajet
  parcouru, voiture à l'échelle des rues avec phares et feux, caméra vue d'ensemble → poursuite →
  vue d'ensemble, compteurs km et minutes qui ne reculent jamais, repères de départ et d'arrivée.

## 1.11.0

**Plus léger et plus sobre dans le navigateur**
- three.js **minifié** (`three.module.min.js`) partout : 194 Ko compressés au lieu de 341 Ko, et
  2,5 fois moins de code à analyser. Le squelette précharge three.js et `lib/core.js`
  (`modulepreload`) : plus de chargement en cascade.
- **Rendu à la demande** : une scène au repos ne redessine plus la même image (pause, animations
  réduites, ou `update()` qui renvoie `false`) ; mesuré : 0 image dessinée au repos au lieu de
  60 par seconde. `stage.invalidate()`, `stage.sleeping`.
- **Contexte WebGL perdu** (mobile en arrière-plan) : l'image de secours revient au lieu d'un
  canvas noir, la scène repart toute seule.

**Plus juste en couleur**
- `createStage({ tone })` : `"neutral"` (Khronos PBR Neutral) garde la couleur exacte de la marque,
  `"agx"` pour les néons très lumineux ; `"aces"` reste le défaut.

**Moins de tokens**
- `check.mjs` produit `planche-desktop.png` et `planche-mobile.png` : toutes les captures d'une vue
  sur une image. L'agent regarde 2 images au lieu d'une quinzaine à chaque contrôle.

**Nouveaux langages visuels** (pour que deux sites ne se ressemblent pas)
- `lib/swarm.js` : nuée de vrais petits objets 3D (grains, pétales, pièces) qui écrivent un nom ou
  un logo, un seul appel de dessin.
- `lib/ribbon.js` : ruban ou fil qui se dessine au scroll, avec un objet qui le suit (trajet GPS,
  signature, mèche, couture, vapeur).
- `lib/ink.js` : style illustré, aplats de couleur et contour encré.
- `demos/styles.html` ; trois nouvelles pistes dans `concepts.md` (la nuée, le trajet, l'illustration).

## 1.10.0

Tiré du banc d'essai 1.9.0 (0 erreur, mais 6,1/10 au jury externe) : les défauts restants étaient
visuels, pas techniques.

**Des objets qui ressemblent à ce qu'ils sont**
- `lib/forms.js` : `lathe` (profil lissé, paroi épaisse et lèvre arrondie pour verre, bol, tasse),
  `liquid` (liquide qui épouse la paroi et se remplit avec `set(0 → 1)`, sans rien recréer),
  `deform`, `organic` (irrégularités de pain, pierre, fruit, céramique), `tint` (couleurs peintes sur
  la forme), `roundedBox`, `radiusAt`.
- `references/modeling.md` : d'où vient l'objet, test de la silhouette, les trois détails qui le
  rendent vrai, proportions, profils de départ, matière crédible (verre teinté, pain, bois), particules
  qui ne ressemblent pas à un bug.
- `demos/forms.html` : flacon ambré qui se remplit, pain avec grigne, bol fait main, planche.
- `createStage` active les plans de coupe (`localClippingEnabled`) pour `liquid`.

**Rien qui saute d'une capture à l'autre**
- `check.mjs` compare deux captures voisines : 3D qui apparaît d'un coup, lumière qui saute, couleur
  dominante qui change ; et signale un compteur visible qui recule quand on descend (minuit accepté).
- Doc « Continuité » (`art-direction.md`, SKILL.md) et piste « La métamorphose continue ».

**Rien de provisoire qui casse la page**
- `check.mjs` : `[À ÉCRIRE]` / `[À CHOISIR]` / lorem ipsum visibles = erreur ; `[À REMPLACER]` listés.
- Règle : on ne livre pas avec une alerte sans réponse (corrigée, ou expliquée dans `jury.json`).

**Un jury plus exigeant**
- Étape 7 : chercher d'abord les défauts capture par capture (liste des défauts que relève le juge
  externe), les écrire dans `jury.json` (`defauts`, `alertes`), puis noter avec la même échelle que le
  juge. Le rapport les affiche.

**Un banc d'essai plus fiable**
- Deux juges externes (moyenne), auto-jury de l'agent constructeur et son écart avec les juges,
  colonnes « Sauts » et « Provisoires », comparaison limitée aux demandes communes.
- 6e demande : `ebeniste-symfony` (section à intégrer dans un site Symfony existant).

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
