---
name: premium-3d
description: Ajoute de la 3D temps réel haut de gamme (verre, métal liquide, néon, particules qui changent de forme, texte en volume, modèles 3D, logo en matière, scènes pilotées par le scroll) à n'importe quel site ou page, pour n'importe quel métier et n'importe quelle stack. Le concept, le design et les textes sont inventés à partir de ce que la personne demande, sans aucun site préfait. Utiliser pour une landing 3D, une section 3D, un logo 3D, un hero animé, ou /premium-3d.
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
lib/models.js      modèles .glb/.gltf du client (Draco), lumière studio, ombres douces au sol
lib/interact.js    attraper pour tourner (inertie), survol d'objets, lumière qui suit le pointeur, gyroscope
lib/fx.js          grain, aberration chromatique, vignette, profondeur de champ
lib/textures.js    matières procédurales sans image : bois, marbre, béton, papier
icons/             78 icônes Lucide (licence ISC) couvrant la plupart des métiers
demos/             démos TECHNIQUES (comment appeler le code, pas des modèles de design)
references/        concepts.md, art-direction.md, performance.md, integration.md
tools/check.mjs    captures desktop + mobile, erreurs, rapport visuel report.html (avec le jury)
tools/record.mjs   vidéo fluide de la page (écran d'ordinateur 1920×1080) pour présenter le travail
tools/serve.py     serveur local
licenses/          licences tierces à livrer avec le projet
```

## Règle d'or

Tout ce qui se voit vient de la demande : le concept 3D, la mise en page, les couleurs, les
polices, les textes, le rythme. Les démos montrent comment utiliser le code, pas à quoi doit
ressembler le résultat : **ne reprends jamais leur mise en page, leurs couleurs ou leurs textes.**

## Étape 1 : comprendre la demande

Lis tout ce que la personne a fourni (texte, logo, photos, site existant, captures). Puis pose
**seulement** les questions qui manquent, en un seul `AskUserQuestion` (4 questions maximum),
parmi :
- le livrable : une page complète, une section à ajouter à un site existant, un hero, un logo 3D ?
- le métier et le message principal (ce que le visiteur doit retenir ou faire) ;
- les éléments de marque : logo (SVG idéal, sinon n'importe quel format), couleurs, photos ;
- la stack si c'est pour un site existant (HTML, Symfony, WordPress, React/Next, Vue…).

Si la personne a déjà tout dit, ne demande rien et passe à l'étape 2.

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
dont le chemin est donné au chargement. Copie dans le projet **uniquement** les modules de `lib/`
et les icônes utilisés (ils s'importent entre eux : garde-les dans le même dossier).

Pour un **logo** : chaque `<path>` du SVG devient une pièce (avec son propre matériau si besoin).
Trop de paths (texte inclus) : garde le symbole ou regroupe avec `pieces`. Logo en PNG/JPG :
redessine le symbole en SVG propre (polygones aux coins arrondis), ne vectorise pas au pixel.

Comment brancher le socle (la scène elle-même est à écrire pour le projet) :
```js
import { createStage, scrollTrack, materials, cameraPath, fitDistance, ss, hdr, THREE } from "./lib/core.js";
const stage = createStage(canvas, { background: "#…", accent: "#…", accent2: "#…" }); // null si pas de WebGL
if (stage) {
  // … construire les objets de la scène avec lib/ et THREE …
  const track = scrollTrack(section);              // si la scène suit le scroll
  let P = 0;
  await stage.warm();                              // compile tout avant d'arriver sur la scène
  stage.start((dt, t) => {
    P += (track.progress() - P) * (stage.reduce ? 1 : 1 - Math.pow(0.0005, dt));
    // … animer selon P (scroll) et/ou t (temps) …
  });
}
```
- La page utilise une **importmap** vers `three@0.169.0` (jsdelivr), ou `npm i three@0.169.0`.
- Lenis (scroll fluide) est optionnel : charge-le et appelle `smoothScroll()`.
- Pour une scène en plusieurs temps : `cameraPath()` + `ss(a, b, P)` pour chaque temps.
- `fitDistance(camera, largeur, hauteur)` pour que l'objet tienne à l'écran sur mobile comme sur ordinateur.
- Textes : en HTML (accessibles, indexables), jamais uniquement dans la 3D.
- Animation qui tourne en continu plus de 5 secondes : bouton pause (`motionToggle`), c'est une
  règle d'accessibilité. Scène plus bas dans la page : `whenNear()`. Fondu d'apparition : classe
  `p3d-ready` (voir `references/performance.md`).

## Étape 5 : performances (obligatoire)

Lis `references/performance.md`. Le socle gère déjà le préchauffage, la pause hors écran, le pixel
ratio adaptatif et la boucle unique : **ne contourne pas ces mécanismes**. Les erreurs à éviter :
créer un matériau ou un objet pendant le scroll, mettre `visible = false` sur un objet jamais
rendu avant, lire la mise en page (`getBoundingClientRect`) dans la boucle, `backdrop-filter`
au-dessus du canvas.

## Étape 6 : vérifier

Copie `tools/check.mjs`, `tools/record.mjs` et `tools/serve.py` du dossier du skill dans un dossier `tools/` du projet
(Node cherche `playwright` à côté du script), puis, depuis la racine du projet :
```bash
python3 tools/serve.py 5180 &           # sert le dossier courant
npm i playwright                        # une fois (navigateur : npx playwright install chromium si absent)
node tools/check.mjs http://127.0.0.1:5180/index.html ./captures --section "#ma-scene"
node tools/check.mjs http://127.0.0.1:5180/index.html ./captures-full --section "#ma-scene" --full
```
Sans `--full`, les captures sont faites sans post-traitement (rapide) ; avec, on voit le rendu final
(bloom, grain…), à utiliser pour le jury. Sans carte graphique, chaque capture peut prendre du temps.
Expose `window.__demo = { get ready() { return stage.ready; } }` pour que le script attende la 3D.
Regarde **chaque** capture (desktop et 390×844) :
- le **premier écran, avant tout scroll**, est déjà beau et plein : la scène ne commence pas
  par un objet minuscule ou un vide (c'est ce que tout visiteur voit, même s'il ne scrolle pas) ;
- les arêtes et reflets fins sont nets, sans scintillement ni crénelage (sinon : vérifier
  `stage.pixelRatio`, qui doit valoir 1 ou plus sur un ordinateur correct) ;
- la 3D est entière et cadrée à chaque point du scroll, rien n'est coupé ;
- aucun texte n'est recouvert ; contraste suffisant ;
- pas de face noire (normales inversées) ni de pièce qui traverse une autre ;
- la console est propre ; pas de débordement horizontal.
Corrige et recommence jusqu'à ce que tout soit propre.

## Étape 7 : le jury

Avant de livrer, note le résultat sur 10 pour chaque critère, en regardant les captures (pas le
code) :
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
  "notes": "Ce qui marche, ce qui reste à améliorer, en deux phrases." }
```
puis `node tools/check.mjs <url> ./captures-full --report-only` : le rapport `report.html` réunit
captures, erreurs et notes. Montre-le à la personne à la livraison.
**Moins de 8 sur un critère : améliore et repasse le jury.** Note honnêtement : un 10 partout au
premier essai veut dire que tu n'as pas assez regardé.

Si l'outil Agent est disponible et que la personne veut le meilleur résultat, fais aussi noter
les captures par un agent qui n'a pas vu le travail (donne-lui seulement les captures, la demande
et ce tableau), et corrige ce qu'il relève.

## Étape 8 : livrer

Si la personne veut présenter son site (réseaux sociaux, client, portfolio), propose la vidéo :
```bash
node tools/record.mjs http://127.0.0.1:5180/index.html video.mp4 --section "#ma-scene" --duration 12
```
Une vraie fenêtre Chrome s'ouvre (carte graphique utilisée, vidéo fluide), défile doucement et
produit un .mp4 1920×1080. `--pause 0.35,0.7` marque une pause sur les moments forts.

Donne les fichiers, explique en deux lignes ce que fait la 3D, liste les éléments à remplacer
(photos, chiffres, textes provisoires marqués `[À REMPLACER]`) et la façon d'intégrer
(`references/integration.md`). Copie `lib/` utilisés, les icônes utilisées et `licenses/` avec le
projet.

## Jamais

- Reprendre la mise en page, les couleurs ou les textes d'une démo ou d'un projet précédent.
- Inventer des chiffres, des clients ou des avis présentés comme réels.
- Mettre de la 3D partout : une ou deux zones fortes, le reste reste léger et lisible.
- Faire suivre la souris de façon appuyée sans que la personne l'ait demandé.
- Livrer sans avoir regardé les captures ni passé le jury.
- Utiliser une brique juste parce qu'elle existe : chaque effet doit servir la signature ou le message.
