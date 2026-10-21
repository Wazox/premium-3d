# Direction artistique

Le but : que le résultat ressemble à la marque de la personne, pas à un « site 3D » générique.

## Palette
- Pars du logo : relève 1 couleur principale et 1 secondaire (pipette sur le SVG ou l'image).
- Sans logo ni couleurs : choisis selon le secteur et le ton, et dis-le dans la direction.
- `accent` = la couleur qui brille (anneaux, flux, néons, bloom). `accent2` = reflets secondaires.
- Teintes du verre (`tint`) : variations de la palette, plus claires que l'accent.
- Vérifie le contraste des textes (4.5:1 minimum pour le corps de texte).

## Fond clair ou sombre
- **Sombre** : néon, verre lumineux, bloom, ambiance nuit (bars, tech, événementiel, luxe).
- **Clair** : émail, métal, matières douces, ombres (artisans, santé, enfance, food, mode claire).
  Sur fond clair : `bloom: false`, `env: "room"`, lumières `HemisphereLight` + `DirectionalLight`,
  matériaux `enamel`, `metal`, `soft` ; le verre transparent rend mal sur fond clair.
- Une page peut alterner : sections claires et une zone 3D sombre, ou l'inverse, ou tout clair.

## Polices (Google Fonts, licence OFL) : quelques paires par ton
| Ton | Titres | Texte |
|---|---|---|
| Tech, précis | Space Grotesk, Sora, Manrope | Inter, IBM Plex Sans |
| Artisan, solide | Archivo, Barlow Condensed, Oswald | Inter, Source Sans 3 |
| Food, chaleureux | Fraunces, DM Serif Display, Playfair Display | Inter, DM Sans |
| Luxe, mode | Cormorant Garamond, Bodoni Moda, Italiana | Jost, Montserrat |
| Santé, doux | Nunito, Lexend, Outfit | Nunito Sans, Lexend |
| Sport, énergie | Anton, Bebas Neue, Archivo Black | Barlow, Inter |
| Enfance, ludique | Fredoka, Baloo 2, Quicksand | Nunito |
Si la marque a déjà ses polices, utilise-les.

## Matériaux par ton
- Verre optique (`glass`) : tech, beauté, premium moderne.
- Verre dépoli (`frosted`) : santé, bien-être, calme.
- Métal (`metal`) : luxe, sport, trophées. Chrome et argent : garder le studio sombre de la scène
  (reflets contrastés). Or clair : `envMap: roomEnvironment(renderer)`. Surveiller le bloom sur le
  métal très clair (monter le seuil `threshold` si l'objet devient une tache blanche).
- Émail (`enamel`) : marques franches, objets « céramique ».
- Doux (`soft`) : enfance, objets du quotidien, marques accessibles.

## Où vit la 3D dans la page (varier !)
- hero plein écran avec l'objet au centre ;
- écran partagé : texte à gauche, objet à droite qui réagit au scroll ;
- section épinglée de 300 à 600vh qui raconte en plusieurs actes ;
- petit objet 3D dans le header ou à côté d’un titre ;
- bandeau de transition entre deux sections ;
- carte ou encart 3D au milieu d'une grille.
Choisis selon la demande. Ne mets pas systématiquement une grande section sombre épinglée.

## Partager l'écran entre la 3D et le texte
- Décide pour chaque taille d'écran **où va le texte et où va la 3D** (ex. ordinateur : texte en bas
  à gauche, objet en haut à droite ; mobile : objet en haut, texte en bas). Les deux ne doivent
  jamais se chevaucher, à aucun moment du scroll.
- Recadre la caméra par taille d'écran dans `stage.onResize((w, h) => …)` : `fitDistance` avec une
  largeur différente sur mobile, et un décalage de l'objet sur ordinateur.
- Donne une largeur fixe aux blocs de texte positionnés en absolu (sinon ils se resserrent).
- Cadre pour l'état **le plus étalé** de la scène (pièces écartées, particules dispersées), pas
  seulement pour l'état final : sinon des éléments sortent de l'écran au début ou à la fin.
- Liens et boutons : couleur héritée (`a{color:inherit}`), jamais le bleu par défaut du navigateur.
- Légendes qui changent au scroll : l'ancienne sort vite (0,25 s), la nouvelle entre **après**
  (délai de 0,25 s). Deux textes ne doivent jamais être visibles l'un sur l'autre. `captionSync()` (lib/story.js)
  le fait tout seul.

## Mouvement
- Calme par défaut : mouvements lents, pauses, rebonds légers (`easeBack` avec c1 ≤ 1.4).
- Une rotation : posé, mouvement net, posé. Pas de rotation molle en continu.
- Parallaxe souris : très légère, ou aucune.
- `prefers-reduced-motion` : pas de lissage ni d'animation d'attente, la scène suit le scroll.

## Textes
- Concrets, dans la langue de la personne, avec ses mots à elle.
- Ce qui manque reste en placeholder `[À REMPLACER]` et est listé à la livraison.
- Pas de remplissage (« leader innovant », « solutions sur mesure de qualité »).
