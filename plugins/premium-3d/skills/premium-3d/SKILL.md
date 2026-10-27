---
name: premium-3d
description: Crée des sites et sections web haut de gamme avec de la 3D temps réel (verre, métal liquide, néon, particules qui changent de forme, texte en volume, modèles 3D, logo en matière, scènes pilotées par le scroll), inventés à partir de la marque, sans modèle préfait, pour n'importe quel métier et n'importe quelle stack (HTML, Symfony, WordPress, React, Next.js, React Three Fiber). Utiliser dès qu'on demande un site premium, une landing page, un hero ou une page d'accueil qui marque, un effet « waouh », une animation au scroll, un site vitrine « style Awwwards », un logo animé, du WebGL ou three.js, ou une vidéo de présentation d'un site, même sans le mot 3D. Aussi en anglais : premium website, landing page, hero section, scroll animation, WebGL, three.js. Ou /premium-3d.
---

# Premium 3D

Une boîte à outils pour créer des expériences 3D **sur mesure** : un moteur testé (`lib/`), une
bibliothèque d'icônes, un catalogue de concepts et des règles de qualité. **Il n'y a pas de page
modèle.** Chaque projet part de la demande de la personne : son métier, sa marque, son objectif.
Deux projets faits avec ce skill ne doivent pas se ressembler.

```
lib/core.js        scène, studio de reflets, matériaux (verre, métal, émail, dépoli, doux),
                   bloom, boucle unique, scroll mesuré, trajet caméra, préchauffage, perf adaptative
lib/logo3d.js      logo SVG → objet 3D extrudé (une pièce par path) ; explode()
lib/icon3d.js      icône SVG (traits) → néon sous verre
lib/objects3d.js   photoFrame, pedestal, glowRing, dust, aurora
lib/shaders.js     liquify (surface liquide : métal fondu, gelée, eau), dissolve (apparition en
                   se consumant avec un bord lumineux), blobGeometry
lib/particles.js   particules qui prennent la forme d'une photo, d'un logo, d'un texte ou d'un
                   objet 3D, et passent de l'une à l'autre (morphing)
lib/text3d.js      texte en volume avec la vraie police de la marque (.ttf/.otf/.woff), lettre par lettre
lib/models.js      modèles .glb/.gltf du client (Draco, Meshopt, KTX2), lumière studio, ombres douces au sol
lib/splat.js       scans 3D réels (Gaussian splatting .spz/.ply) : le vrai lieu ou produit, filmé au téléphone
lib/interact.js    attraper pour tourner (inertie), survol d'objets, lumière qui suit le pointeur, gyroscope
lib/fx.js          grain, aberration chromatique, vignette, profondeur de champ
lib/textures.js    matières procédurales sans image : bois, marbre, béton, papier
lib/forms.js       modéliser les objets du métier : profil lissé (flacon, verre, bol), paroi épaisse,
                   liquide qui se remplit, formes organiques (pain, pierre, fruit), couleurs peintes
lib/story.js       scène en plusieurs actes : acts(), steps() à paliers, captionSync() (légendes sans superposition)
lib/react.js       hook usePremium3D pour React / Next.js (montage, préchauffage, nettoyage)
lib/r3f.js         composants React Three Fiber : Studio, Material, Logo3D, Text3D, Particles
icons/             78 icônes Lucide (licence ISC, dessinées en traits) couvrant la plupart des métiers
demos/             démos TECHNIQUES (comment appeler le code, pas des modèles de design)
references/        api.md (toutes les fonctions en une ligne), concepts.md, art-direction.md,
                   modeling.md, performance.md, integration.md, tools.md
tools/new.mjs      squelette d'une nouvelle page : toute la plomberie, aucun design
tools/brand.mjs    extrait la marque d'un site existant : couleurs, polices, logo, textes (brand.html)
tools/check.mjs    captures desktop + mobile, erreurs, 3D coupée, performances, rapport report.html (avec le jury)
tools/record.mjs   vidéo de la page filmée en direct (ordinateur avec écran et carte graphique)
tools/render.mjs   vidéo calculée image par image, parfaitement fluide, de n'importe quelle page WebGL
tools/browser.mjs  lanceur commun (carte graphique ou rendu logiciel, cookies) ; options : references/tools.md
tools/serve.py     serveur local
licenses/          licences tierces à livrer avec le projet
```

## Règle d'or

Tout ce qui se voit vient de la demande : le concept 3D, la mise en page, les couleurs, les
polices, les textes, le rythme. Les démos montrent comment utiliser le code, pas à quoi doit
ressembler le résultat : **ne reprends jamais leur mise en page, leurs couleurs ou leurs textes.**

## Étape 1 : comprendre la demande

Lis tout ce que la personne a fourni (texte, logo, photos, site existant, captures). Si elle a déjà
un site, extrais sa marque avant toute question (copie `tools/` dans le projet, puis
`npm i playwright` si besoin) :
```bash
node tools/brand.mjs https://site-du-client.fr ./brand
```
`brand/brand.html` montre les couleurs, les polices, le logo (récupéré en SVG quand c'est possible)
et les textes du site : pars de là pour la palette, les polices et les mots du client, et ne
redemande pas ce qui s'y trouve. Relis-le : une couleur peut venir d'un bandeau cookies ou d'un
widget. Puis pose
**seulement** les questions qui manquent, en un seul `AskUserQuestion` (4 questions maximum),
parmi :
- le livrable : une page complète, une section à ajouter à un site existant, un hero, un logo 3D ?
- le métier et le message principal (ce que le visiteur doit retenir ou faire) ;
- les éléments de marque : logo (SVG idéal, sinon n'importe quel format), couleurs, photos ;
- la stack si c'est pour un site existant (HTML, Symfony, WordPress, React/Next, Vue…).

Si la personne a déjà tout dit, ne demande rien et passe à l'étape 2. Si l'outil de questions
n'existe pas ou que la personne n'est pas là pour répondre : choisis la réponse la plus raisonnable,
écris tes hypothèses en tête de la direction, et continue.

## Étape 2 : choisir le concept

Lis `references/concepts.md` : ce sont des pistes, pas des scènes à reproduire. Imagine deux ou
trois idées pour CE projet, puis garde celle qui raconte le mieux quelque chose de vrai sur ce
métier et cette marque. Une idée forte bien exécutée vaut mieux que cinq effets. La scène, son
déroulé et ses animations sont à concevoir à chaque fois : la boîte à outils ne contient aucune
scène toute faite.

### La signature (obligatoire)
Trouve **un détail que personne d'autre n'aurait**, tiré de cette marque précise, et construis la
scène autour. C'est lui qui rend le site unique. Pistes pour le trouver :
- **la forme** : les particules, la matière ou la caméra dessinent le logo, l'initiale, un objet du
  métier (une goutte pour un plombier, une feuille pour un paysagiste, un grain pour un torréfacteur) ;
- **le geste** : le mouvement imite le métier (un coup de ciseaux, une vague, un pétrissage, une
  pièce qu'on visse, une page qu'on tourne) ;
- **la matière** : celle du produit ou du lieu (cuivre d'un bar, céramique d'un potier, chrome d'un
  garage, verre dépoli d'un cabinet) ;
- **la lumière** : la couleur exacte de la marque, l'heure du métier (aube d'un boulanger, néon d'un
  bar de nuit) ;
- **le contenu** : les vraies photos, le vrai nom, la vraie adresse mis en scène.
Écris la signature en une phrase. Si elle pourrait s'appliquer à n'importe quelle entreprise du
secteur, elle n'est pas assez précise : cherche encore.

### La direction
Écris ensuite une **direction en 6 lignes** (pour toi, et à montrer à la personne si la demande
est floue) :
1. l'histoire en une phrase (ce que la 3D raconte) ;
2. la signature ;
3. le concept et où vit la 3D dans la page ;
4. la palette (tirée du logo ou de la marque) et le fond (clair ou sombre) ;
5. les polices ;
6. les matériaux et le rythme (scroll, temps, interaction).

## Étape 3 : direction artistique

Lis `references/art-direction.md` et applique-le à cette marque. Points clés :
- palette dérivée du logo et du secteur, pas de couleur « par défaut » ;
- fond clair ou sombre selon la marque, pas systématiquement une section noire ;
- polices choisies pour le secteur (la liste par secteur est dans la référence) ;
- mise en page propre au projet (hero plein écran, écran partagé, scène épinglée, carte, bandeau…).

## Étape 4 : construire

Les fichiers de ce skill (`lib/`, `icons/`, `references/`, `tools/`) sont dans le dossier du skill,
dont le chemin est donné au chargement. **Pour une nouvelle page, commence par le squelette** : il
pose toute la plomberie (importmap, canvas épinglé, fondu, préchauffage, scroll lissé, pause,
`__demo`, cadrage `fitZone`) et copie les modules et les outils, sans aucun design :
```bash
node <dossier du skill>/tools/new.mjs mon-projet --modules story,particles   # --hero : scène fixe
```
Puis écris tout ce qui est marqué `[À ÉCRIRE]` / `[À CHOISIR]`. Pour une section dans un site
existant, copie seulement les modules de `lib/` et les icônes utilisés (ils s'importent entre eux :
garde-les dans le même dossier).

**Lis `references/api.md`** : toutes les fonctions et leurs options, en une ligne. C'est plus
rapide et plus sûr que de parcourir les sources de `lib/`.

La scène peut (et souvent doit) contenir des objets construits pour le projet (une jante, un flacon,
un pain, un comptoir) : `lib/` fournit le rendu, les matières, le scroll et les effets, pas les objets
du métier. **Lis `references/modeling.md` avant de modéliser** : c'est le défaut n° 1 relevé par le
juge du banc d'essai (pain en « galet », flacon « en plastique », bois « en sable »). Outils :
`lib/forms.js` (`lathe` creux, `liquid`, `deform`, `organic`, `tint`, `roundedBox`). Un objet doit se
reconnaître à sa silhouette seule, avec au moins trois détails vrais (bords arrondis, épaisseur,
irrégularité, variation de couleur, pièce secondaire, ombre au sol).
Pour des particules qui dessinent une forme qui n'est ni une image, ni un SVG, ni un texte (une
mèche, une vague, un plan), écris-la avec `shape()`.

Les icônes de `icons/` sont dessinées en **traits** : elles marchent avec `icon3d` et `sampleSVG`,
pas avec `logoPieces` (qui extrude des aplats).

Pour un **logo** : chaque `<path>` du SVG devient une pièce, avec sa couleur d'origine
(`material: (i, color) => materials.enamel({ color })`). Le texte `<text>` du SVG est ignoré : le nom
se fait avec `text3d` ou reste en HTML. Trop de paths (texte vectorisé) : garde le symbole ou regroupe
avec `pieces`. Pour qu'une pièce tourne autour de sa base ou d'un bord (pétale, porte, couvercle) :
`pivot(piece, "bottom")`. Logo en PNG/JPG : redessine le symbole en SVG propre (polygones aux coins
arrondis), ne vectorise pas au pixel.

Comment brancher le socle (la scène elle-même est à écrire pour le projet) :
```js
import { createStage, scrollTrack, materials, cameraPath, fitDistance, ss, hdr, neon, THREE } from "./lib/core.js";
const stage = createStage(canvas, { background: "#…", accent: "#…", accent2: "#…" }); // null si pas de WebGL
if (stage) {
  // … construire les objets de la scène avec lib/ et THREE …
  const track = scrollTrack(section);              // si la scène suit le scroll
  let P = 0;
  await stage.warm();                              // compile tout avant d'arriver sur la scène
  stage.start((dt, t, real) => {
    P += (track.progress() - P) * (stage.reduce ? 1 : 1 - Math.pow(0.0005, real));   // real : jamais figé
    // … animer selon P (scroll) et/ou t (temps, figé par le bouton pause) …
  });
}
```
- La page utilise une **importmap** vers `three@0.186.1` (jsdelivr), ou `npm i three@0.186.1`.
- Lenis (scroll fluide) est optionnel : charge-le et appelle `smoothScroll()`.
- Pour une scène en plusieurs temps : `acts()` pour nommer les actes, `steps()` pour des paliers
  lisibles, `captionSync()` pour les légendes HTML, `cameraPath()` pour la caméra.
- **Continuité** : chaque valeur animée (position, couleur, éclat, compteur) est une fonction lisse et
  croissante de `P` (`ss()`), jamais un `if (P > x)` qui fait apparaître, changer de couleur ou
  allumer d'un coup ; une même couleur d'accent du début à la fin (`references/art-direction.md`).
- Cadrage : `fitZone(camera, largeur, hauteur, zone)` place l'objet dans la zone de l'écran qui lui
  revient (ex. mobile `{ top: 0.1, bottom: 0.52 }`, ordinateur `{ left: 0.45 }`) sans le déplacer.
  C'est la façon la plus simple de garder texte et 3D séparés à toutes les tailles.
- Dose ce qui coûte cher selon `stage.tier` ("low" / "mid" / "high") : nombre de particules,
  subdivisions, ombres, profondeur de champ. Ex. `{ low: 6000, mid: 12000, high: 20000 }[stage.tier]`.
- Néons, anneaux, flux lumineux : `neon(couleur)` plutôt que `hdr()` : un rouge ou un bleu brille
  alors autant qu'un vert (le bloom trie par luminance).
- Textes : en HTML (accessibles, indexables), jamais uniquement dans la 3D.
- Animation qui tourne en continu plus de 5 secondes : bouton pause (`motionToggle`), c'est une
  règle d'accessibilité. Il fige le temps, jamais le scroll : le récit reste lisible.
- Scène plus bas dans la page : `whenNear()`. Fondu d'apparition : classe `p3d-ready`
  (`references/performance.md`).
- Image de secours : option `poster` de `createStage`, générée à la fin avec `check.mjs --poster`.

## Étape 5 : performances (obligatoire)

Lis `references/performance.md`. Le socle gère déjà le préchauffage, la pause hors écran, le pixel
ratio adaptatif et la boucle unique : **ne contourne pas ces mécanismes**. Les erreurs à éviter :
créer un matériau ou un objet pendant le scroll, mettre `visible = false` sur un objet jamais
rendu avant, lire la mise en page (`getBoundingClientRect`) dans la boucle, `backdrop-filter`
au-dessus du canvas.

## Étape 6 : vérifier

Copie `tools/browser.mjs`, `tools/check.mjs` et `tools/serve.py` dans un dossier `tools/` du projet ;
options et détails de tous les outils : **`references/tools.md`**. Depuis la racine du projet :
```bash
python3 tools/serve.py 5180 &           # sert le dossier courant (changer le port s'il est pris)
npm i playwright                        # une fois
node tools/check.mjs http://127.0.0.1:5180/index.html ./captures --section "#ma-scene" --points 0,0.5,1
node tools/check.mjs http://127.0.0.1:5180/index.html ./captures-full --section "#ma-scene" --full
```
Itère avec peu de points ; conclus avec les points par défaut, les deux vues et `--full` (seul à
montrer le bloom et ses halos). La page expose `window.__demo = { get ready() { return stage.ready; } }`.
Lis « À VÉRIFIER » (3D coupée ou sous un texte, textes superposés, saut entre deux captures,
compteur qui recule, textes provisoires, budget, fluidité). **Chaque alerte se corrige** ; si elle
est voulue (un décor qui sort exprès du cadre), écris pourquoi dans `jury.json` (`"alertes"`). On ne
livre pas avec une alerte sans réponse, ni avec une erreur. Puis regarde **chaque** capture (desktop
et 390×844) :
- le **premier écran, avant tout scroll**, est déjà beau et plein (pas d'objet minuscule ni de vide) ;
- arêtes et reflets nets, sans crénelage (sinon : `stage.pixelRatio` doit valoir 1 ou plus sur ordinateur) ;
- la 3D est entière et cadrée à chaque point, y compris les pièces qui arrivent ou s'écartent ;
- métal et chrome lisibles : ni faces noires, ni taches blanches qui bavent (`references/art-direction.md`) ;
- un objet fin vu par la tranche disparaît : donne-lui de l'épaisseur ou tourne-le vers la caméra ;
- sur fond clair, particules denses et lisibles, pas un voile pâle ;
- aucun texte recouvert, contraste suffisant, titres sans caractère manquant (gros plans du rapport) ;
- pas de face noire (normales inversées) ni de pièce qui en traverse une autre ;
- l'objet central passe le test de la silhouette (`references/modeling.md`) et sa matière est la bonne ;
- d'une capture à la suivante, rien ne saute (couleur, éclat, compteur, objet qui surgit) ;
- console propre, pas de débordement horizontal.
Corrige et recommence jusqu'à ce que tout soit propre.

## Étape 7 : le jury

Avant de livrer, **cherche d'abord les défauts**, capture par capture, en regardant les images (pas
le code) et en te demandant ce qu'un directeur artistique exigeant dirait. Ceux que le juge du banc
d'essai relève le plus souvent :
- un objet qu'on ne reconnaît pas ou qui a l'air faux (galet, plastique, sable, cylindres empilés) ;
- une matière qui n'est pas la bonne (verre opaque, bois sans fil, métal noir ou blanc qui bave) ;
- un saut entre deux captures (couleur, halo, compteur, apparition sans transition) ;
- un nuage de particules qui ne dessine rien et ressemble à un bug ;
- un texte superposé, illisible, ou un placeholder qui casse la page ;
- un vide : premier écran pauvre, objet minuscule, fin de scène sans rien.
Écris chaque défaut trouvé (capture, quoi, pourquoi) dans `"defauts"`, corrige, recontrôle. Ensuite
seulement, note sur 10 chaque critère :
| Critère | Question |
|---|---|
| Originalité | Est-ce qu'on a déjà vu cette scène ailleurs ? La signature se voit-elle tout de suite ? |
| Pertinence | La 3D raconte-t-elle quelque chose de vrai sur ce métier et cette marque ? |
| Finition | Matières crédibles, lumière soignée, rien de coupé, aucun bug visuel, transitions propres ? |
| Lisibilité | Les textes se lisent, l'appel à l'action est évident, la 3D ne gêne pas ? |
| Fluidité | Aucun à-coup en arrivant sur la scène ni en la traversant (`references/performance.md`) ? |
| Mobile | Aussi beau et lisible en 390×844 qu'en ordinateur ? |
Écris les notes dans `captures-full/jury.json` :
```json
{ "originalite": 8, "pertinence": 9, "finition": 8, "lisibilite": 9, "fluidite": 8, "mobile": 8,
  "defauts": ["desktop-045 : le flacon paraît opaque → verre teinté plus clair, corrigé"],
  "alertes": "desktop 90 % bord droit : le comptoir sort exprès du cadre",
  "notes": "Ce qui marche, ce qui reste à améliorer, en deux phrases." }
```
puis `node tools/check.mjs <url> ./captures-full --report-only` : le rapport `report.html` réunit
captures, erreurs et notes. Montre-le à la personne à la livraison.
**Moins de 8 sur un critère : améliore et repasse le jury.** Note avec la même exigence que le juge
externe du banc d'essai (8 = digne d'un studio, 10 = exceptionnel) : il a donné 6,1 en moyenne aux
sites de la version 1.9.0. Un 8 se justifie par une capture précise ; un 10 partout au premier essai
veut dire que tu n'as pas assez regardé. Après trois tours d'amélioration, livre en disant
franchement ce qui reste sous 8 et pourquoi.

Si l'outil Agent est disponible et que la personne veut le meilleur résultat, fais aussi noter
les captures par un agent qui n'a pas vu le travail (donne-lui seulement les captures, la demande
et ce tableau), et corrige ce qu'il relève. Sans outil Agent : écris une critique capture par
capture (ce qui gêne, où, pourquoi) avant de noter, puis corrige.

## Étape 8 : livrer

Si la personne veut présenter son site (réseaux sociaux, client, portfolio), propose la vidéo
(`references/tools.md`) : `tools/record.mjs` la filme en direct (écran et carte graphique),
`tools/render.mjs` la calcule image par image, sans aucune saccade, partout (`--mobile` : 1080×1920) :
```bash
node tools/render.mjs http://127.0.0.1:5180/index.html video.mp4 --section "#ma-scene" --pause 0.33,0.66
```

Donne les fichiers, explique en deux lignes ce que fait la 3D, liste les éléments à remplacer
(photos, chiffres, textes provisoires marqués `[À REMPLACER]`) et la façon d'intégrer
(`references/integration.md`). Copie les modules de `lib/` utilisés, les icônes utilisées, et dans
`licenses/` seulement les licences de ce qui est livré (three.js, Lucide si icônes, Lenis si utilisé,
polices embarquées).

## Jamais

- Reprendre la mise en page, les couleurs ou les textes d'une démo ou d'un projet précédent.
- Inventer des chiffres, des clients ou des avis présentés comme réels.
- Mettre de la 3D partout : une ou deux zones fortes, le reste reste léger et lisible.
- Faire suivre la souris de façon appuyée sans que la personne l'ait demandé.
- Livrer sans avoir regardé les captures ni passé le jury.
- Utiliser une brique juste parce qu'elle existe : chaque effet doit servir la signature ou le message.
