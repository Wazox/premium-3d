# Performances

Une scène 3D qui saccade fait plus de mal que pas de 3D du tout. Le socle (`lib/core.js`) règle
déjà l'essentiel ; ce fichier dit ce qu'il fait et ce qu'il ne faut pas casser.

## Ce que le socle fait
1. **Préchauffage** (`stage.warm(prepare, restore)`) : après le chargement, compile tous les
   shaders (`compileAsync`), envoie les textures au GPU (`initTexture`) et fait un rendu hors
   écran. Sans ça, la première apparition d'un objet bloque la page 100 à 500 ms en plein scroll.
   `prepare()` doit rendre visibles TOUS les objets qui apparaîtront plus tard.
2. **Pause hors écran** : la scène ne rend que si son conteneur est à moins d'un écran
   (`rootMargin: "100% 0px"`), et jamais dans un onglet caché.
3. **Pixel ratio adaptatif** : 1,25 maximum sur ordinateur, 1 sur mobile ; baisse si une image
   prend plus de 22 ms, remonte si elle en prend moins de 12.
4. **Machines modestes** (mobile ou ≤ 4 cœurs) : pas de dispersion ni d'irisation sur le verre.
5. **Boucle unique** (`onFrame`) pour Lenis, l'interface et toutes les scènes de la page.
6. **Scroll mesuré en cache** (`scrollTrack`) : mesures au chargement et au redimensionnement,
   jamais pendant le scroll.
7. `?lite` dans l'URL : pas de bloom (captures, vieux GPU).

## Règles à respecter dans ton code
- Ne crée **aucun** matériau, géométrie ou texture pendant l'animation : tout au chargement.
- Pour cacher un objet en cours de scroll : `scale.setScalar(0.001)` plutôt que `visible = false`
  s'il n'a jamais été rendu (ou inclus-le dans `prepare()` du préchauffage).
- Aucune allocation dans la boucle (`new Vector3`, `.clone()`) : réutilise des objets.
- Textures canvas animées : redessin 20 fois par seconde au maximum, sans mipmaps, seulement si visible.
- Ne modifie une classe CSS que si l'état change (garde l'état précédent en mémoire).
- Pas de `backdrop-filter` sur des éléments posés au-dessus du canvas.
- Photos : 1600 px de large maximum, JPEG ou WebP.
- Une scène par page de préférence ; deux maximum, sur la même boucle.

## Vérifier
Dans Chrome (onglet Performance), enregistre un scroll jusqu'à la scène et à travers elle :
aucune tâche longue (> 50 ms) et aucun « Compile shader » pendant le scroll.
