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

1. **Comprend** le métier, la marque et le but de la page.
2. **Trouve une signature** : un détail que seule votre marque pourrait avoir.
3. **Fait la direction artistique** à partir de votre logo : couleurs, polices, matières.
4. **Construit** avec le moteur du skill : métal liquide, particules, texte 3D, bois et marbre,
   modèles, icônes néon…
5. **Vérifie** : captures ordinateur et mobile, erreurs, puis un **jury** sur 6 critères.
   En dessous de 8/10, il recommence.
6. **Livre** les fichiers, un rapport visuel des tests et la marche à suivre pour les intégrer.

## 4. Les outils fournis

| Outil | Commande | À quoi il sert |
|---|---|---|
| Serveur local | `python3 tools/serve.py 5180` | Voir la page (les modules ne marchent pas en double-clic) |
| Contrôle | `node tools/check.mjs <url> ./captures --section "#scene"` | Captures ordinateur + mobile, erreurs, `report.html` |
| Rendu final | ajouter `--full` | Captures avec bloom et effets, pour le jury |
| Image de secours | ajouter `--poster img/poster.jpg` | Image affichée pendant le chargement et sans 3D |
| Vidéo | `node tools/record.mjs <url> video.mp4 --duration 12` | Vidéo 1920×1080 fluide pour les réseaux sociaux |

Prérequis : `npm i playwright` dans le projet, `ffmpeg` pour la vidéo en .mp4.

## 5. Intégrer dans un site existant

- **HTML** : une importmap vers three.js 0.169.0 et les fichiers de `lib/` utilisés.
- **Symfony** : un partial Twig, le JS dans `assets/`, three.js avec AssetMapper ou Encore.
- **WordPress** : un bloc HTML personnalisé et le script chargé seulement sur la page concernée.
- **React / Next.js** : le hook `usePremium3D` de `lib/react.js` (composant client, import dynamique
  sans SSR).

Le détail est dans `references/integration.md`.

## 6. Performances

Le moteur gère tout seul :
- le préchauffage des shaders, pour qu'il n'y ait pas d'à-coup en arrivant sur la scène ;
- la pause quand la scène est hors de l'écran ;
- une qualité qui s'adapte à l'écran et à l'appareil ;
- le chargement différé, le fondu d'apparition et l'image de secours.

Pour vérifier sur votre site : dans la console, `stage.pixelRatio` doit valoir 1 ou plus sur un
ordinateur correct.

## 7. Licence et crédits

MIT. three.js et Lenis (MIT), icônes Lucide (ISC), polices Google Fonts (OFL) : licences dans
`licenses/`. Créé par [NexaHouse](https://www.nexahouse.fr), studio web à Montpellier. Pour un site
3D clé en main : contact@nexahouse.fr.
