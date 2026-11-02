/*
 * premium-3d / ink.js
 * Style illustré : couleurs en aplats (2 à 4 tons, comme une sérigraphie ou un dessin animé) et
 * contour encré autour des objets. Un tout autre langage que le verre et le chrome : affiches,
 * enfance, food, artisans, marques qui ont un style dessiné.
 *
 *   import { toon, outline } from "./lib/ink.js";
 *   const mesh = new THREE.Mesh(geo, toon({ color: "#f2b134", steps: 3 }));
 *   mesh.add(outline(mesh, { thickness: 0.025, color: "#1b1b1b" }));
 *
 * Lumière : une DirectionalLight franche (+ une AmbientLight faible) ; l'environnement de reflets
 * n'est pas utilisé par ces matériaux. Fond uni ou papier (paperMaterial) ; bloom: false.
 */
import * as THREE from "three";

const ramps = new Map();
/* dégradé en paliers (sans interpolation) : steps = nombre de tons de l'ombre à la lumière */
function ramp(steps, soft) {
  const key = steps + ":" + soft;
  if (ramps.has(key)) return ramps.get(key);
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) { const v = Math.round((soft + (1 - soft) * (i / (steps - 1))) * 255); data.set([v, v, v, 255], i * 4); }
  const t = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  ramps.set(key, t); return t;
}

/**
 * Matériau en aplats.
 * @param steps  nombre de tons (2 = affiche franche, 3 = dessin animé, 4 = plus doux)
 * @param shadow luminosité du ton le plus sombre (0 → 1) : 0,35 sombre, 0,6 pastel
 */
export function toon({ color = "#ffffff", steps = 3, shadow = 0.45, emissive = "#000000" } = {}) {
  return new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: ramp(Math.max(2, steps), shadow), emissive: new THREE.Color(emissive) });
}

/**
 * Contour encré (coque inversée) : une copie de l'objet, légèrement gonflée le long des normales,
 * dont on ne voit que l'intérieur. À ajouter comme enfant de l'objet : elle suit ses mouvements.
 * Normales lisses requises (une boîte à arêtes vives se fend aux coins : utiliser roundedBox de
 * forms.js, ou des géométries arrondies).
 * @param thickness  épaisseur en unités 3D (≈ 1 à 2 % de la taille de l'objet)
 */
export function outline(mesh, { thickness = 0.02, color = "#111111" } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.BackSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uInk = { value: thickness };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uInk;")
      .replace("#include <begin_vertex>", "vec3 transformed = position + normalize(normal) * uInk;");
  };
  mat.customProgramCacheKey = () => "p3d-ink";
  const o = new THREE.Mesh(mesh.geometry, mat);
  o.raycast = () => {}; // invisible au survol (hoverPick ne voit que l'objet)
  return o;
}
