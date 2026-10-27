# Modéliser les objets du métier

Au banc d'essai 1.9.0, le défaut le plus fréquent n'était pas technique : les objets ne
ressemblaient pas à ce qu'ils devaient être. Un pain « galet d'argile avec un bâton posé dessus »,
un flacon « opaque comme du plastique orange », un socle en bois « en sable bruité ». La scène la
mieux pensée échoue si l'objet central a l'air fait de cylindres.

**Test de la silhouette** : sur une capture, cache le texte. Quelqu'un qui ne connaît pas le projet
doit pouvoir nommer l'objet en une seconde (« un flacon de sérum », « une miche »). Sinon, retravaille
la forme avant les effets.

## 1. D'où vient l'objet (dans cet ordre)
1. **Le modèle du client** (.glb, .gltf) : `loadModel` (`references/api.md`), allégé avec gltf-transform.
2. **Un modèle libre de droits** si l'objet est générique (bouteille, chaise, plante) : Poly Haven
   (CC0, sans attribution). Noter la source dans `licenses/`. Jamais un modèle sans licence claire.
3. **Construit pour le projet** avec `lib/forms.js` et `THREE` : c'est le cas le plus courant.
   - objet **de révolution** (flacon, verre, bol, tasse, vase, bouteille, pot, bouchon, lampe) :
     `lathe(profil, { thickness })` ;
   - objet **organique** (pain, fruit, galet, pierre, nuage, goutte, pâte) : sphère bien subdivisée →
     `deform()` pour la forme générale → `organic()` pour les irrégularités → `tint()` pour la couleur ;
   - objet **fabriqué** (comptoir, téléphone, carte, brique, socle, boîte) : `roundedBox()` ;
   - objet **plat découpé** (feuille, clé, ciseaux, plaque, logo) : `THREE.Shape` + `ExtrudeGeometry`
     avec `bevelEnabled` (biseau de 1 à 3 % de la taille) ;
   - objet **composé** : assembler plusieurs pièces (flacon + bouchon + pipette ; coupe = bol creux +
     pied plein). Une pièce par matière.

## 2. Les trois détails qui rendent un objet vrai
Un objet de synthèse se trahit par sa perfection. Donne-lui au moins trois de ces détails :
- **bords arrondis** : aucune arête vive (biseau, `roundedBox`, lèvre arrondie de `lathe` creux) ;
- **épaisseur réelle** : un verre, un bol, une tasse ont une paroi (`thickness`), pas une surface ;
- **irrégularité** : `organic({ amp })` à 1 % (céramique tournée), 3 à 5 % (pain, pierre, fruit) ;
- **variation de couleur** : croûte plus dorée en haut, fruit qui mûrit, émail plus clair sur les
  bords (`tint`, matériau `vertexColors: true`) ;
- **pièce secondaire** : bouchon, anse, pied, tige, étiquette, grigne, couture, vis ;
- **contact** : une ombre douce sous l'objet (`softGround`, `studioLights` avec ombres). Sans ombre,
  l'objet flotte et paraît petit.

## 3. Proportions
Travaille en vraies mesures (1 unité = 10 cm, par exemple) et vérifie les rapports :
| Objet | Rapport hauteur / diamètre | Repères |
|---|---|---|
| Flacon de sérum 30 ml | 2,5 à 3 | épaule arrondie, goulot de 1/3 du diamètre, pipette en caoutchouc noir ou blanc |
| Coupe à cocktail | bol 0,6 ; pied 1,2 × le bol | pied fin (2 à 4 mm), base plate large comme le bol |
| Tasse à café | 0,9 à 1,1 | anse à mi-hauteur, soucoupe 1,7 × le diamètre |
| Bol | 0,45 à 0,55 | pied annulaire, lèvre légèrement évasée |
| Miche, boule de pain | 0,45 à 0,6 | base plate, grigne en relief clair, croûte foncée en haut |
| Bouteille de vin | 3,8 à 4,2 | épaule marquée, col de 1/3 du diamètre |

## 4. Profils de départ pour `lathe`
`[rayon, hauteur]`, du bas (rayon 0) vers le haut. À ajuster : ce sont des proportions, pas des modèles.
```js
const flacon = [[0, 0], [0.33, 0], [0.36, 0.04], [0.36, 0.86], [0.3, 1.0], [0.13, 1.08], [0.12, 1.2]];
const bolCoupe = [[0, 0], [0.12, 0.01], [0.5, 0.22], [0.78, 0.48]];        // bol creux (thickness)
const piedCoupe = [[0, 0], [0.45, 0], [0.46, 0.02], [0.06, 0.06], [0.03, 0.2], [0.03, 1], [0.1, 1.06], [0, 1.08]]; // plein
const tasse = [[0, 0], [0.3, 0], [0.34, 0.03], [0.4, 0.5], [0.44, 0.82]];
const bol = [[0, 0], [0.22, 0], [0.26, 0.04], [0.5, 0.22], [0.62, 0.48]];
```
Une coupe à pied : le bol avec `thickness`, le pied **plein** (sans `thickness`) et posé dessous ;
un seul profil creux pour les deux fait un tube dans le pied.

## 5. Matière crédible
| Matière | Réglage | Erreur vue au banc |
|---|---|---|
| Verre clair | `materials.glass()`, paroi `thickness` 2 à 4 % du diamètre, fond **sombre** ou très contrasté | — |
| Verre teinté (ambré, fumé, vert) | `glass({ tint, dist })` : `tint` clair et `dist` 0,8 à 1,5 ; plus court = plus foncé | flacon peint en orange opaque : c'est du plastique |
| Liquide dans le verre | `liquid(profil, …)` **opaque** (couleur, `roughness` 0,05 à 0,1) : le verre ne voit pas les objets transparents | — |
| Pain, viennoiserie | `tint` (mie claire en bas, croûte brun doré en haut, grigne claire), `roughness` 0,8, `sheen` 0,1 à 0,2 | forme lisse et uniforme = galet |
| Bois | `woodMaterial({ scale })` : `scale` 0,2 à 0,6 (motifs par unité), vérifié en gros plan ; sur une boîte, `roundedBox` (UV par face) | `scale` trop fort ou bruit à fort relief = sable |
| Pierre, béton | `organic` 2 à 4 % + `concreteMaterial` | — |
| Céramique, émail | `materials.enamel`, `organic` 0,5 à 1 % (fait main) | — |
| Métal, chrome | `references/art-direction.md` (rugosité, `front`, bloom) | — |
| Tissu, cuir | `MeshPhysicalMaterial({ sheen: 1, sheenRoughness: 0.6, roughness: 0.9 })` | — |

## 6. Particules qui ne ressemblent pas à un bug
« Un nuage de points rouges et verts en ovale autour du flacon » (cosmétique, banc 1.9.0).
- Les particules **dessinent quelque chose** (un fruit, une goutte, un trajet) : pas de nuage informe
  autour d'un objet, sauf poussière très discrète (`dust`).
- **Deux couleurs au plus**, tirées de la palette, et proches l'une de l'autre.
- La forme doit se lire sur une capture fixe : densité suffisante, contour net, `turbulence` ≤ 0,5.

## 7. Vérifier
Sur les captures de `check.mjs` : test de la silhouette, matière (est-ce que ça a l'air de verre, de
pain, de bois ?), contact au sol, et gros plan sur l'objet central (zoomer sur la capture desktop).
Démo technique : `demos/forms.html` (flacon qui se remplit, pain, bol, planche).
