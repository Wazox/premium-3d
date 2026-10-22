# Fiche API de lib/

Toutes les fonctions, en une ligne chacune. Lis cette fiche au lieu des sources : elle suffit pour
écrire une scène. Ouvre un fichier de `lib/` seulement pour un détail qui n'est pas ici.
Les options entre `{ }` sont toutes facultatives (valeur par défaut indiquée).

## core.js : le socle
| Appel | Rôle |
|---|---|
| `createStage(canvas, { background, accent, accent2, env, front, bloom, fov, exposure, maxPixelRatio, poster })` | Crée la scène. `background: null` = transparent. `env: "studio"` (sombre, reflets contrastés) ou `"room"` (clair). `front: 1` = lumière douce côté caméra pour les faces plates de métal vues de face (0 par défaut). `bloom: false` ou `{ strength: .55, radius: .5, threshold: .9 }`. Renvoie `null` sans WebGL 2. |
| `stage.scene`, `stage.camera`, `stage.renderer` | Objets three.js. Caméra : `fov` 32 par défaut. |
| `stage.tier` | `"low"` / `"mid"` / `"high"` : dose particules, subdivisions, ombres. |
| `stage.LOW`, `stage.reduce` | Petit écran ou machine modeste ; `prefers-reduced-motion`. |
| `stage.onResize((w, h, pr) => …)` | Appelé tout de suite puis à chaque redimensionnement : recadrer ici. |
| `await stage.warm(prepare?, restore?)` | Compile tout avant d'afficher. `prepare()` rend visible ce qui apparaîtra plus tard. |
| `stage.start((dt, t, real) => …)` | Boucle d'animation (seulement quand la scène est proche de l'écran). `dt`, `t` : temps de l'animation, figés en pause ; `real` : temps réel, pour lisser le scroll (`1 - Math.pow(0.0005, real)`). |
| `stage.still` | Temps figé (`t` et `dt` ne bougent plus) mais la scène suit toujours le scroll : c'est ce que fait le bouton pause. |
| `stage.step(dt)` | Avance la scène d'exactement une image et la dessine (avec `stage.paused = true`) : vidéo image par image (`tools/render.mjs`), tests. |
| `stage.paused`, `stage.ready`, `stage.dispose()` | Arrêt complet du rendu (rare), état, nettoyage (React/Vue). |
| `?tier=high` dans l'URL | Force le niveau d'appareil (tests, captures). `?lite` : sans bloom. |
| `createStage(…, { poster: "img/p.jpg" })` ou `{ poster: { desktop, mobile } }` | Image de secours sur un calque derrière le canvas (le fond du conteneur reste intact), retirée en fondu quand la 3D est prête. |
| `scrollTrack(section)` | `.progress()` 0→1 dans une section haute (enfant `position: sticky`), `.goto(p)`. |
| `fitZone(camera, w, h, { left, right, top, bottom, margin })` | **Cadrage à côté du texte** : renvoie la distance de caméra et place l'objet (resté à l'origine) dans cette zone de l'écran (fractions 0 → 1). La perspective reste de face, le sol reste sous la caméra. `fitZone(camera, w, h)` sans zone = plein écran. |
| `fitDistance(camera, w, h, margin \| { x, y, margin })` | Distance pour qu'un objet w × h tienne à l'écran ; `x`/`y` si on préfère déplacer l'objet soi-même. |
| `cameraPath([[p, [x,y,z], [cible]], …])` | Trajet de caméra par plans clés : `path(P, outPos, outTarget)`. |
| `whenNear(el, fn)` | Lance `fn` quand l'élément approche (scène plus bas dans la page). |
| `smoothScroll()`, `scrollTo(y)`, `onFrame(fn)` | Lenis (si chargé), scroll animé, boucle commune. |
| `materials.glass({ tint, rough, thick, irid })` | Verre optique (fond sombre). |
| `materials.frosted({ tint, rough })` | Verre dépoli. |
| `materials.metal({ color, rough, envMap, env })` | Métal. Voir `art-direction.md` pour le chrome. |
| `materials.enamel({ color })`, `materials.soft({ color, rough })` | Émail laqué, matière mate. |
| `ss(a, b, x)`, `clamp01`, `easeBack(x, c1)`, `easeInOutCubic` | Courbes : `ss` = transition douce entre a et b. |
| `hdr(hex, k)` | Couleur > 1 qui brille au bloom (néons, anneaux). |
| `rgba(hex, a)`, `THREE` | Couleur pour canvas 2D ; three.js réexporté. |
| `studioEnvironment`, `roomEnvironment`, `tier()`, `LITE`, `LOW`, `reduceMotion` | Utilisés par `createStage`, rarement directement. |

## story.js : raconter au scroll
| Appel | Rôle |
|---|---|
| `acts([[nom, début, fin], …])` | `.at(P)` → `{ name, index, k }` ; `.k(nom, P)` → progression locale adoucie. |
| `steps(P, n, hold = .45, { tail: .15 })` | Valeur 0 → n-1 à paliers (chaque état reste lisible) ; le dernier état reste affiché sur la dernière part `tail` du scroll. Avec des légendes : `const v = steps(P, n); pm.set(v); caps.show(Math.round(v));` (`Math.floor(v + 0.1)` pour changer de légende plus tard). |
| `captionSync(elements)` | Légendes HTML superposées : `.show(i)` (l'ancienne sort, puis la nouvelle entre). |
| `classToggle(el, "on")` | Renvoie `fn(bool)` à appeler dans la boucle : la classe n'est écrite que quand l'état change. |

## particles.js : particules qui changent de forme
Une **forme** = `{ positions: Float32Array(count*3), colors: Float32Array(count*3) }`. Toutes les
formes d'un même morphing ont le même `count`.
| Appel | Rôle |
|---|---|
| `await sampleImage(src, { count, width, mode: "luma", threshold, color })` | Photo → forme. |
| `await sampleSVG(svg, { count, width, color })` | SVG (logo ou icône de `icons/`) → forme. |
| `await sampleText(texte, { count, width, font, color })` | Texte → forme, dans la police donnée (chargée toute seule). |
| `await sampleMesh(mesh, { count, color })` | Surface d'un objet 3D → forme. |
| `shape(count, (i, u, o) => { o.x = …; o.y = …; o.z = …; o.color = … })` | **Forme sur mesure** (mèche, vague, plan, spirale…). Même ordre d'indices entre deux formes proches = transition lisible. |
| `scatter(count, rayon, { color, shape: "sphere" })` | Nuage dispersé. |
| `particleMorph(formes, { size, additive, solid, turbulence, opacity })` | `.points` à ajouter, `.set(v)` (0 → n-1), `.update(t)`. Fond clair : `additive: false` (points pleins automatiquement). `turbulence` gonfle le nuage pendant la transition : 0,4 à 0,6 garde une forme lisible, au-delà de 0,8 c'est une boule. |

## logo3d.js, text3d.js, icon3d.js : objets en volume
| Appel | Rôle |
|---|---|
| `logoPieces(svg, { size, depth, bevel, pieces, material: (i, color) => … })` | SVG **en aplats** → `{ group, pieces, colors, width, height }`, une pièce par path (cercles et rectangles compris). `color` = la couleur de la pièce dans le SVG (classes CSS d'Illustrator comprises). Le `<text>` est ignoré (avertissement en console). Les icônes de `icons/` sont en traits : pas pour `logoPieces`. |
| `pivot(piece, "bottom" \| "top" \| "left" \| "bottom-left" \| [x,y,z])` | Change le point de rotation d'une pièce sans la déplacer : pétale qui s'ouvre depuis sa base, porte sur ses gonds, couvercle. |
| `explode(pieces, k, { gap, axis, stagger })` | Écarte les pièces (vue éclatée, assemblage). |
| `await loadFont(url)` puis `text3d(font, texte, { size, depth, material, splitLetters })` | Texte en volume (.ttf, .otf, .woff ; pas .woff2). |
| `icon3d(svg, { size, glass, glow })` | Icône en traits → tube de verre avec cœur lumineux (fond sombre). |

## objects3d.js, models.js, textures.js : décor et matières
| Appel | Rôle |
|---|---|
| `photoFrame(src, { w, h, frame })` | Photo dans un cadre (verre, métal). |
| `pedestal({ radius, material, ring })`, `glowRing(r, color)` | Socle, anneau lumineux. |
| `dust({ count, area, color })` (`.update(dt)`), `aurora({ colorA, colorB, base })` (`.update(t, p)`) | Poussière lumineuse, fond animé. |
| `await loadModel(url, { size })` | Modèle .glb/.gltf centré ; `userData.bottom` pour poser un sol. |
| `studioLights(stage, { shadows })`, `softGround({ y, opacity, glow })` | Lumière trois points, sol qui ne montre que l'ombre. |
| `woodMaterial`, `marbleMaterial`, `concreteMaterial`, `paperMaterial` (`{ scale, … }`) | Matières procédurales, sans image. |

## shaders.js, fx.js, interact.js : effets et interactions
| Appel | Rôle |
|---|---|
| `liquify(material, { amp, freq, speed })` + `blobGeometry()` ou `discGeometry(r)` | Surface qui ondule (objet rond, ou liquide plat dans un bol, une tasse, un verre). Renvoie les uniforms : `u.uTime.value = t`. |
| `dissolve(material, { edge, width })` | Apparition par combustion : `u.uProgress.value` 0 → 1. |
| `addLensFx(stage, { grain, aberration, vignette })`, `addDepthOfField(stage, { focus })` | Effets d'objectif (profondeur de champ coupée sur machine modeste). |
| `dragRotate(el, objet, { returnHome })` (`.update(dt)`) | Attraper pour tourner, avec inertie. |
| `hoverPick(stage, objets, { onEnter, onLeave, onClick })` | Survol et clic sur des objets 3D. |
| `pointerLight(stage, { color })` (`.update(dt)`), `tilt()` | Lumière qui suit le pointeur, gyroscope. |
| `motionToggle(stage, bouton)` | Bouton pause obligatoire si l'animation tourne seule plus de 5 s. Fige le temps, jamais le scroll ; démarre figé avec « réduire les animations ». |

## react.js
`usePremium3D(async (stage) => (dt, t) => { … }, optionsDeCreateStage)` renvoie une `ref` à poser
sur le `<canvas>`. Voir `integration.md`.
