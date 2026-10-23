# Guide premium-3d

premium-3d est un skill Claude Code qui ajoute de la 3D haut de gamme à n'importe quel site.
Vous décrivez votre projet, Claude invente une scène propre à votre marque, la construit, la
vérifie, puis vous la livre prête à intégrer.

## 1. Installer

Dans un terminal :

```bash
claude plugin marketplace add Wazox/premium-3d
claude plugin install premium-3d@premium-3d
```

Sans plugin : copiez le dossier `plugins/premium-3d/skills/premium-3d` dans `~/.claude/skills/`
(Windows : `C:\Users\<vous>\.claude\skills\`).

## 2. Utiliser

Dans Claude Code, dans le dossier de votre projet :

```
/premium-3d:premium-3d une landing pour mon salon de coiffure, avec mon logo en 3D
```

(`/premium-3d` si vous avez copié le dossier à la main.)

Exemples de demandes :
- « Un hero 3D pour la page d'accueil de mon garage, ambiance atelier, voitures anciennes. »
- « Mon logo en métal liquide sur ma page d'accueil Symfony, qu'on peut attraper à la souris. »
- « Une section qui montre mes 3 offres en 3D, sur mon site WordPress. »
- « Une page produit avec mon modèle 3D (produit.glb) en lumière de studio. »

Plus vous donnez d'éléments (logo SVG, couleurs, photos, site existant), plus le résultat vous
ressemble. Claude ne pose que les questions qui manquent.

## 3. Ce que Claude fait

1. **Comprend** le métier, la marque et le but de la page. Si vous avez déjà un site, il en extrait
   tout seul les couleurs, les polices, le logo et les textes.
2. **Trouve une signature** : un détail que seule votre marque pourrait avoir.
3. **Fait la direction artistique** à partir de votre logo : couleurs, polices, matières.
4. **Construit** avec le moteur du skill : métal liquide, particules, texte 3D, bois et marbre,
   modèles, icônes néon…
5. **Vérifie** : captures ordinateur et mobile (en simulant un vrai téléphone), erreurs, 3D coupée
   ou passant sous un texte, budget de performance, puis un **jury** sur 6 critères.
   En dessous de 8/10, il recommence.
6. **Livre** les fichiers, un rapport visuel des tests et la marche à suivre pour les intégrer.

## 4. Les outils fournis

| Outil | Commande | À quoi il sert |
|---|---|---|
| Nouvelle page | `node tools/new.mjs mon-projet --modules story` | Squelette avec toute la plomberie (chargement, fondu, scroll, pause, cadrage), sans design |
| Marque du client | `node tools/brand.mjs https://site-du-client.fr ./brand` | Couleurs, polices, logo et textes du site actuel, dans `brand.html` |
| Serveur local | `python3 tools/serve.py 5180` | Voir la page (les modules ne marchent pas en double-clic) |
| Contrôle | `node tools/check.mjs <url> ./captures --section "#scene"` | Captures ordinateur + mobile, erreurs, 3D coupée ou sous le texte, performances, titres en gros plan, `report.html` |
| Rendu final | ajouter `--full` | Captures avec bloom et effets, pour le jury |
| Image de secours | ajouter `--poster img/poster.jpg` | Image affichée pendant le chargement et sans 3D |
| Vidéo | `node tools/record.mjs <url> video.mp4 --duration 12` | Vidéo 1920×1080 filmée en direct (ordinateur avec carte graphique) |
| Vidéo parfaite | `node tools/render.mjs <url> video.mp4 --section "#scene"` | Calculée image par image, sans saccade, même sans carte graphique ; `--mobile` pour un format vertical 1080×1920, `--still 8` pour filmer sans défiler. Marche aussi pour une page React Three Fiber ou three.js qui n'utilise pas le skill |

Prérequis : `npm i playwright` dans le projet, `ffmpeg` pour la vidéo en .mp4.

Les outils utilisent la **carte graphique** dès qu'il y a un écran (Windows, macOS, Linux de bureau) :
contrôles et vidéos bien plus rapides. Sur un serveur ou dans le cloud, ils passent en rendu
logiciel, plus lent mais identique. `--gpu` ou `--cpu` pour forcer. Une bannière de cookies est
fermée toute seule. Toutes les options : `references/tools.md`.

## 5. Intégrer dans un site existant

- **HTML** : une importmap vers three.js 0.186.1 et les fichiers de `lib/` utilisés.
- **Symfony** : un partial Twig, le JS dans `assets/`, three.js avec AssetMapper ou Encore.
- **WordPress** : un bloc HTML personnalisé et le script chargé seulement sur la page concernée.
- **React / Next.js** : le hook `usePremium3D` de `lib/react.js` (composant client, import dynamique
  sans SSR), ou les composants React Three Fiber de `lib/r3f.js` si le site en utilise déjà.
- **Scans 3D** : le vrai lieu ou produit du client, scanné au téléphone (Scaniverse, Polycam) et
  exporté en `.spz`, affiché avec `lib/splat.js`.

Le détail est dans `references/integration.md`.

## 6. Performances

Le moteur gère tout seul :
- le préchauffage des shaders, pour qu'il n'y ait pas d'à-coup en arrivant sur la scène ;
- la pause quand la scène est hors de l'écran ;
- une qualité qui s'adapte à l'écran et à l'appareil ;
- le chargement différé, le fondu d'apparition et l'image de secours.

Pour vérifier sur votre site : `check.mjs` lancé sur un PC avec carte graphique mesure la fluidité
réelle au défilement (images par seconde, « Performances » dans `report.html` ; bon : 55 ou plus).
Dans la console, `stage.pixelRatio` doit valoir 1 ou plus sur un ordinateur correct.

Modèles 3D du client : les compresser avant de les mettre en ligne (souvent 5 à 10 fois plus légers) :
`npx gltf-transform optimize entree.glb sortie.glb --compress meshopt --texture-compress ktx2`.

## 7. Licence et crédits

MIT. three.js et Lenis (MIT), icônes Lucide (ISC), polices Google Fonts (OFL) : licences dans
`licenses/`. Créé par [NexaHouse](https://www.nexahouse.fr), studio web à Montpellier. Pour un site
3D clé en main : contact@nexahouse.fr.
