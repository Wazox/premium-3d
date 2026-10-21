# Intégrer dans un site existant

Principe commun : on n'ajoute que la zone 3D, on ne restyle rien d'autre, et Three.js n'est
chargé que sur les pages qui en ont besoin. Les textes restent en HTML (SEO, accessibilité).

## HTML statique
Copier `lib/` (seulement les fichiers utilisés), les icônes utilisées et `licenses/`. Dans la page :
```html
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>
<script type="module" src="js/ma-scene.js"></script>
```
Les modules ES ne se chargent pas en `file://` : tester avec `tools/serve.py`.

## Symfony (Twig + AssetMapper ou Encore)
- La zone devient un partial : `templates/partials/_scene3d.html.twig`, inclus seulement là où il
  faut. Le JS dans `assets/scene3d/` (avec les fichiers de `lib/`).
- AssetMapper : `php bin/console importmap:require three@0.169.0`, puis vérifier que les imports
  `three/addons/...` se résolvent (sinon `importmap:require` de chaque chemin d'addon utilisé).
  Encore : `npm i three@0.169.0`.
- Les données de la scène (textes, couleurs, chemins d'images) passent par un attribut
  `data-config="{{ config|json_encode|e('html_attr') }}"` ou un `<script type="application/json">`,
  avec `trans` pour les sites multilingues. Les chemins avec `asset()`.

## WordPress
- Un bloc « HTML personnalisé » pour le conteneur, le JS et les fichiers `lib/` dans le thème
  enfant, enfilés avec `wp_enqueue_script_module` (WP 6.5+) uniquement sur la page concernée.
- Ou un plugin de code (snippets) si la personne ne gère pas de thème enfant.

## React, Next.js, Vite, Vue
- `npm i three@0.169.0`. Les fichiers de `lib/` s'importent tels quels (ils importent `three`).
- Créer la scène dans un `useEffect` (React) / `onMounted` (Vue) avec le `ref` du canvas ;
  nettoyer au démontage avec `stage.dispose()`.
- Next.js : composant client (`"use client"`), import dynamique sans SSR pour la scène.
- Pas de React Three Fiber nécessaire ; s'il est déjà dans le projet, les matériaux et les
  géométries de `lib/` restent réutilisables.
