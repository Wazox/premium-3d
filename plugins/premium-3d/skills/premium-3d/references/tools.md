# Outils (tools/)

À copier dans un dossier `tools/` du projet avec `browser.mjs` (le lanceur commun : ils l'importent).
Node cherche `playwright` à côté du script ou dans un dossier parent (`npm i playwright`, navigateur :
`npx playwright install chromium` si absent ; `PLAYWRIGHT_BROWSERS_PATH` ou `CHROMIUM_PATH` pour un
navigateur déjà installé ailleurs). Serveur : `python3 tools/serve.py 5180 &` depuis la racine.

## Carte graphique ou rendu logiciel (tous les outils)
- `--gpu` : vraie fenêtre Chrome, la carte graphique calcule les images. Bien plus rapide.
- `--cpu` : rendu logiciel SwiftShader, sans fenêtre. Marche partout (serveur, cloud, CI), lent.
- Par défaut : carte graphique s'il y a un écran (Windows, macOS, Linux avec DISPLAY), sinon logiciel.
- Proxy d'entreprise : `HTTPS_PROXY` est utilisé, localhost reste en direct.
- Une bannière de cookies est fermée automatiquement (elle cacherait la 3D).

## check.mjs : captures, erreurs, performances, rapport
```bash
node tools/check.mjs <url> ./captures --section "#ma-scene"            # itérer
node tools/check.mjs <url> ./captures --section "#ma-scene" --points 0,0.5,1 --views mobile
node tools/check.mjs <url> ./captures-full --section "#ma-scene" --full --poster img/poster.jpg
node tools/check.mjs <url> ./captures-full --report-only                 # après jury.json
```
- Un seul passage vers le bas : captures aux points du scroll, gros plans des 3 premiers titres
  (accents de la police), « fin de page » avec `--section`.
- Sans `--full` : sans post-traitement (rapide). Avec : bloom, grain… Les halos de bloom n'apparaissent
  qu'avec `--full` : à passer au moins une fois avant de conclure.
- Niveau forcé : ordinateur « high », mobile « mid » (`--tier auto` pour ne rien forcer).
- La page doit exposer `window.__demo = { get ready() { return stage.ready; } }`.
- Mobile : vrai téléphone simulé (390×844, écran 3×, tactile).
- « À VÉRIFIER » : 3D qui touche un bord (objet coupé), 3D sous un texte visible, budget dépassé
  (appels de dessin, triangles, poids, CLS) avec la piste de correction.
- Fluidité réelle (images/s au défilement, image la plus lente sur 20) : mesurée seulement avec une
  carte graphique. En rendu logiciel elle n'est pas mesurée.
- Carte graphique : ordinateur et mobile sont capturés en même temps.

## record.mjs : vidéo filmée en direct
```bash
node tools/record.mjs <url> video.mp4 --section "#ma-scene" --duration 12 --pause 0.35,0.7
```
Vraie fenêtre Chrome, défilement doux, .mp4 1920×1080. Il faut un écran et une carte graphique.

## render.mjs : vidéo calculée image par image (aucune saccade)
```bash
node tools/render.mjs <url> video.mp4 --section "#ma-scene" --pause 0.33,0.66
node tools/render.mjs <url> reel.mp4 --section "#ma-scene" --mobile        # 1080×1920
node tools/render.mjs <url> loop.mp4 --still 6                             # 6 s sans défiler
```
- Scène premium-3d : chaque image avance par `stage.step(1/30)` (pré-calcul sans dessin).
- **Toute autre page WebGL** (React Three Fiber, Spline, three.js maison, animations CSS) :
  le temps virtuel de Chrome avance de 1/30 s par image. Rien à exposer dans la page.
- `--workers N` : navigateurs en parallèle (défaut : 2 avec carte graphique, 1 en logiciel, où
  plusieurs ne vont pas plus vite sous 16 cœurs). Le temps par image est affiché.
- Sans carte graphique : compter 0,5 à 3 s par image.

## brand.mjs : la marque d'un site existant
```bash
node tools/brand.mjs https://site-du-client.fr ./marque
```
Couleurs (fond, texte, accents), polices, logo, textes → `brand.html` + `brand.json` + `site.png`.
