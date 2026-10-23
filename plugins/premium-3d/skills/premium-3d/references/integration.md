# Intégrer dans un site existant

Principe commun : on n'ajoute que la zone 3D, on ne restyle rien d'autre, et Three.js n'est
chargé que sur les pages qui en ont besoin. Les textes restent en HTML (SEO, accessibilité).

## Icônes dans le HTML
Les icônes de `icons/` sont en `stroke="currentColor"` : en `<img>`, elles restent noires. Pour
qu'elles prennent la couleur du texte, intègre le SVG dans la page, ou utilise un masque :
```css
.ico{width:20px;height:20px;background:currentColor;-webkit-mask:url(icons/phone.svg) center/contain no-repeat;mask:url(icons/phone.svg) center/contain no-repeat}
```

## HTML statique
Copier `lib/` (seulement les fichiers utilisés), les icônes utilisées et `licenses/`. Dans la page :
```html
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script>
<script type="module" src="js/ma-scene.js"></script>
```
Les modules ES ne se chargent pas en `file://` : tester avec `tools/serve.py`.

## Symfony (Twig + AssetMapper ou Encore)
- La zone devient un partial : `templates/partials/_scene3d.html.twig`, inclus seulement là où il
  faut. Le JS dans `assets/scene3d/` (avec les fichiers de `lib/`).
- AssetMapper : `php bin/console importmap:require three@0.186.1`, puis vérifier que les imports
  `three/addons/...` se résolvent (sinon `importmap:require` de chaque chemin d'addon utilisé).
  Encore : `npm i three@0.186.1`.
- Les données de la scène (textes, couleurs, chemins d'images) passent par un attribut
  `data-config="{{ config|json_encode|e('html_attr') }}"` ou un `<script type="application/json">`,
  avec `trans` pour les sites multilingues. Les chemins avec `asset()`.

## WordPress
- Un bloc « HTML personnalisé » pour le conteneur, le JS et les fichiers `lib/` dans le thème
  enfant, enfilés avec `wp_enqueue_script_module` (WP 6.5+) uniquement sur la page concernée.
- Ou un plugin de code (snippets) si la personne ne gère pas de thème enfant.

## React, Next.js, Vite, Vue
- React / Next.js : utiliser `lib/react.js` (`usePremium3D`), qui gère le montage, le préchauffage et
  `stage.dispose()` au démontage. Exemple complet en tête du fichier.
- `npm i three@0.186.1`. Les fichiers de `lib/` s'importent tels quels (ils importent `three`).
- Créer la scène dans un `useEffect` (React) / `onMounted` (Vue) avec le `ref` du canvas ;
  nettoyer au démontage avec `stage.dispose()`.
- Next.js : composant client (`"use client"`), import dynamique sans SSR pour la scène.
- Pas de React Three Fiber nécessaire. S'il est déjà dans le projet, garder son `<Canvas>` et
  utiliser **`lib/r3f.js`** (testé avec @react-three/fiber 9.8, React 19, three 0.186, Vite) :
  `<Studio accent front />` (reflets du verre et du métal), `<Material kind="glass" tint />` dans un
  `<mesh>`, `<Logo3D svg explode={k} />`, `<Text3D font text />`, `<Particles shapes value={k} />`.
  Exemple en tête du fichier. Copier aussi `core.js` et les modules qu'il importe
  (`logo3d.js`, `text3d.js`, `particles.js`, `shaders.js`).
  - **Donner un fond à la scène** (`<color attach="background" args={["#…"]} />`) : le verre
    (transmission) laisse voir ce qui est derrière lui ; sur un canvas transparent il paraît blanc.
  - Next.js : `core.js` lit la fenêtre dès son chargement : scène en import dynamique `ssr: false`.
  - Bloom : `@react-three/postprocessing`, avec `neon()` pour les couleurs qui doivent briller.
- Une page React Three Fiber se vérifie avec `check.mjs` (captures, erreurs, cadrage ; pas de
  compte de triangles, réservé aux scènes `lib/core.js`) et se filme avec `render.mjs` sans rien
  ajouter : il pilote le temps de la page lui-même (`references/tools.md`).
