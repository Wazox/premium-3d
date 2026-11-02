# Pistes de concepts 3D

Ce ne sont **pas des scènes à reproduire** : ce sont des points de départ pour inventer la scène
propre à chaque projet. Le concept final doit naître de la demande (le métier, le message, la
marque) et peut ne ressembler à aucune de ces pistes. Critère unique : « est-ce que la 3D raconte
quelque chose de vrai sur cette entreprise ? »

Pour chaque projet, imagine d'abord **deux ou trois idées différentes**, choisis la plus juste pour
ce métier, et note pourquoi dans la direction.

---

## Pistes

**Le logo-objet.** Le logo de la marque devient un objet en matière (verre, métal, émail, bois…)
mis en scène dans le hero : il tourne lentement, s'incline au scroll, attrape la lumière.
Briques : `logoPieces`, `materials`, `cameraPath`.

**La vue éclatée.** Un objet (logo, produit, schéma) dont les couches se séparent au scroll pour
montrer ce qu'il y a dedans ou comment il est fait. Briques : `logoPieces` + `explode`, ou un
modèle GLB du client.

**La vitrine d'icônes.** Les services ou spécialités en icônes 3D (`icon3d`, 78 icônes dans
`icons/`), posées sur des socles, mises en avant une par une. Briques : `icon3d`, `pedestal`,
`glowRing`.

**La galerie en matière.** Les vraies photos du client (réalisations, plats, lieux, produits)
dans des cadres en verre ou en métal, que la caméra traverse. Briques : `photoFrame`, `cameraPath`.

**L'objet produit.** Le produit lui-même, sous tous les angles, si le client a un modèle 3D
(`GLTFLoader`) ou une silhouette simple à extruder.

**L'ambiance.** Une atmosphère qui porte la marque : particules (`dust`), fond lumineux animé
(`aurora`), lumière qui se déplace. En complément d'une autre piste ou seule, très discrète.

**La matière seule.** Pas d'objet figuratif : une forme abstraite (sphère, ruban, vague extrudée)
dans la matière et les couleurs de la marque, qui réagit au scroll. Utile quand le logo ne se
prête pas à la 3D.

**La matière vivante.** Une forme (goutte, logo épais, objet du métier) dont la surface ondule :
métal fondu, gelée, eau, lave. Fascinant en hero, surtout si on peut l'attraper. Briques :
`liquify` sur une géométrie subdivisée (`blobGeometry`), `dragRotate`, `materials.metal` ou `glass`.

**Les particules qui changent de forme.** Des milliers de points qui dessinent successivement la
photo d'une réalisation, le logo, le nom, un objet, au fil du scroll. Idéal pour raconter une
transformation (avant/après, matière brute → produit fini). Briques : `sampleImage`, `sampleSVG`,
`sampleText`, `sampleMesh`, `particleMorph`. Penser à des paliers : chaque forme doit rester lisible.

**Le nom en volume.** Le nom de la marque en 3D, dans sa vraie police et dans une matière qui lui
ressemble, lettre par lettre (arrivée, rebond, combustion). Briques : `loadFont`, `text3d`
(`splitLetters`), `dissolve`.

**L'apparition par combustion.** Un objet ou un texte qui se révèle en se consumant, avec un bord
lumineux à la couleur de la marque. Transition forte entre deux sections ou deux états. Briques :
`dissolve`.

**La vraie matière.** Le logo, le nom ou un objet taillé dans la matière du métier : bois d'un
menuisier, marbre d'un architecte d'intérieur, béton d'un maçon, papier d'un imprimeur. Ombre douce
au sol, lumière chaude. Briques : `logoPieces` ou `text3d` + `woodMaterial`, `marbleMaterial`,
`concreteMaterial`, `paperMaterial`, `studioLights`, `softGround`, `explode` (assemblage).

**Le produit en studio.** Le vrai modèle 3D du client (.glb) posé dans une lumière de studio photo,
ombre douce au sol, que l'on fait tourner à la main. Briques : `loadModel`, `studioLights`,
`softGround`, `dragRotate`.

**Le regard de la caméra.** Une scène vue « à travers un objectif » : profondeur de champ qui fait
la mise au point d'un objet à l'autre au scroll, léger grain. Briques : `addDepthOfField`,
`addLensFx` (à doser, et pas de profondeur de champ sur mobile).

**L'objet qui répond.** La matière réagit au visiteur : elle se tourne quand on l'attrape, une
lumière suit le pointeur, un élément s'allume au survol, le téléphone incliné fait bouger la scène.
Briques : `dragRotate`, `pointerLight`, `hoverPick`, `tilt`.

**Le vrai lieu, scanné.** Le client filme son atelier, sa boutique, sa salle, un plat ou un produit
avec une application de scan (Scaniverse, Polycam, Luma) : le site montre le vrai endroit en 3D, pas
une imitation ; la caméra y entre au scroll. Pour tout métier dont le lieu ou l'objet est la preuve
(restaurant, artisan, salon, immobilier, hôtel). Demander le fichier .spz au client, ne jamais en
inventer un. Brique : `loadSplat`.

**La métamorphose continue.** Un seul objet qui se transforme d'un bout à l'autre du scroll (la pâte
qui lève puis dore, le flacon qui se remplit, le trajet qui se trace) plutôt que plusieurs objets qui
apparaissent tour à tour. Chaque capture montre le même objet un peu plus loin dans son histoire :
aucune rupture possible. Briques : `deform` / `liquid` / `particleMorph` pilotés par `ss(…, P)`.

**La nuée.** Des milliers de vrais petits objets du métier (grains de café, pétales, vis, pilules,
pièces, feuilles, perles) qui s'envolent et écrivent le nom, dessinent le logo ou le produit, puis
retombent. Plus concret que des particules : chaque objet a son volume et sa lumière. Brique :
`swarm` (+ une forme de particles.js).

**Le trajet.** Un ruban qui se dessine au scroll : l'itinéraire d'un VTC ou d'un livreur sur un
plan, le fil d'une couturière, la signature d'un artisan, la vapeur d'un café, une mèche qui se
boucle. Un objet le suit (voiture, aiguille, plume). Briques : `ribbon`, `route`. Pour un trajet en
ville (VTC, livraison, taxi, déménageur, auto-école), `demos/gps.html` montre la mécanique : trajet
prévu pâle et trajet parcouru en néon, voiture à l'échelle des rues, caméra de navigation au-dessus
d'elle, compteurs qui ne reculent jamais. Les vraies rues du client : dessiner `route` à partir d'un
plan simplifié (grandes artères seulement), jamais un fond de carte copié d'un service en ligne.

**L'illustration.** La scène en aplats de couleur et contours encrés, comme une affiche ou un
dessin animé : enfance, food, artisans, marques au style dessiné. Change complètement de la 3D
« verre et chrome ». Briques : `toon`, `outline`, `lathe`, `roundedBox`.

**Le relief.** Le pays du client sort du plat : la montagne d'un guide, le vignoble d'un domaine, la
côte d'une école de voile, le quartier d'un agent immobilier, avec ses lignes de niveau. Un sentier
ou un trajet se dessine dessus. Briques : `relief`, `ribbon` (`up`), `heightAt`.

**Le dévoilement.** Un tissu (velours, lin, drap d'atelier, serviette de barbier) ondule devant le
produit puis s'enroule pour le révéler au scroll, comme une inauguration. Briques : `cloth`, `fabric`.

**La fonte.** La matière du métier fond sous les yeux : glace, chocolat, cire de bougie, beurre,
métal coulé. Puis se reforme, ou laisse la place au produit. Briques : `melt`, `liquify`.

**À inventer.** Toute autre idée qui colle au métier : un objet emblématique du secteur extrudé
depuis une icône, un plan du lieu en relief, une typographie en volume, etc.

---

## Questions pour trouver le bon concept
- Qu'est-ce que le visiteur doit ressentir en 5 secondes (confiance, envie, calme, énergie, luxe) ?
- Quel objet ou quelle image résume ce métier ?
- Qu'est-ce que l'entreprise a de concret à montrer (photos, produit, logo fort, savoir-faire) ?
- Où la 3D aide-t-elle vraiment la page (hero, présentation des offres, transition) ?

## À éviter
- Plaquer la même scène sur tous les métiers.
- Raconter une histoire qui n'est pas celle du client (un logiciel pour un fleuriste…).
- Empiler les effets : une idée forte, bien exécutée.
