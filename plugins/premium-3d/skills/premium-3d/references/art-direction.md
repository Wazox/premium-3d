# Direction artistique

Le but : que le résultat ressemble à la marque de la personne, pas à un « site 3D » générique.

## Palette
- Site existant : `tools/brand.mjs` donne le fond, le texte et les accents réellement utilisés ; pars de là.
- Pars du logo : relève 1 couleur principale et 1 secondaire (pipette sur le SVG ou l'image).
- Sans logo ni couleurs : choisis selon le secteur et le ton, et dis-le dans la direction.
- `accent` = la couleur qui brille (anneaux, flux, néons, bloom). `accent2` = reflets secondaires.
- Teintes du verre (`tint`) : variations de la palette, plus claires que l'accent.
- Vérifie le contraste des textes (4.5:1 minimum pour le corps de texte).

## Fond clair ou sombre
- **Sombre** : néon, verre lumineux, bloom, ambiance nuit (bars, tech, événementiel, luxe).
- **Clair** : émail, métal, matières douces, ombres (artisans, santé, enfance, food de jour, mode claire).
- **Food** : décider selon l'heure du service. Clair pour boulangerie, épicerie, brunch, salon de thé ;
  sombre pour comptoir du soir, bar, ramen, cuisine au feu de bois.
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
**Teste le nom exact de la marque** (accents, macrons, ç, œ, ligatures) dans la police et la graisse
choisies avant de construire : certaines polices dessinent mal les diacritiques en grande taille
(ex. le « ō » de « Kōji » perdu en Fraunces 800). Le rapport de `check.mjs` montre les titres en gros
plan pour le vérifier.

## Matériaux par ton
- Verre optique (`glass`) : tech, beauté, premium moderne.
- Verre dépoli (`frosted`) : santé, bien-être, calme.
- Métal (`metal`) : luxe, sport, auto, trophées. Chrome et argent : garder le studio sombre de la scène
  (reflets contrastés). Or clair : `envMap: roomEnvironment(renderer)`.
  **Réglages testés pour le chrome et le métal clair sur fond sombre** :
  - `rough` entre 0,25 et 0,35. À 0,1, c'est un miroir parfait : les facettes plates d'un écrou,
    d'une bague ou d'un logo reflètent soit le vide (noir), soit un panneau du studio (blanc qui bave) ;
  - bloom : `threshold: 1.5` environ, et les éléments qui doivent briller en `hdr(couleur, 3)` ou
    plus : ils gardent leur halo, le métal n'en a plus ;
  - une face **plate** tournée vers le visiteur (roue, écrou, médaille, logo vu de face) devient
    noire dans le studio : `createStage(canvas, { front: 1 })` ajoute une lumière douce côté caméra.
    Ne pas l'activer sur un métal poli courbe (goutte, sphère) : elle s'y reflète en rectangle gris.
- Émail (`enamel`) : marques franches, objets « céramique ». Émail **sombre** sur fond sombre : les
  panneaux du studio se reflètent en anneaux lumineux sous les objets ronds (bol, tasse) ; monter le
  seuil du bloom au-dessus de 1 et baisser `envMapIntensity` vers 0,6.
- Doux (`soft`) : enfance, objets du quotidien, marques accessibles.

## Particules sur fond clair
- `particleMorph(…, { additive: false })` : les points deviennent pleins et nets automatiquement.
- Couleurs **foncées et saturées** (encre, brun, couleur de marque profonde) : les tons clairs
  disparaissent dans le fond.
- Plus de points et plus gros qu'en sombre : `size` 2 à 2,5, et 30 % de particules en plus.
- Une forme fine (mèche, trait, vague) : ajoute de l'épaisseur (plusieurs fils, léger relief en z),
  sinon elle se lit comme un voile.

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
- Recadre par taille d'écran dans `stage.onResize((w, h) => …)` avec `fitZone` : tu donnes la zone de
  l'écran où va la 3D, elle calcule la distance et décale le cadre de la caméra. L'objet reste à
  l'origine (un sol posé dessous reste vu d'en haut, la perspective reste de face).
  ```js
  stage.onResize((w) => {
    const zone = w < 860 ? { top: 0.1, bottom: 0.52 } : { left: 0.45, top: 0.08 };   // mobile : en haut ; ordi : à droite
    stage.camera.position.set(0, 0.5, fitZone(stage.camera, 4, 3.5, zone));            // 0.5 : légèrement au-dessus
    stage.camera.lookAt(0, 0, 0);
  });
  ```
- Ne monte pas un sol (`softGround`) au niveau de la caméra : vu par la tranche, il dessine un trait
  sur toute la largeur. Caméra légèrement au-dessus de l'objet, sol sous l'objet.
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
