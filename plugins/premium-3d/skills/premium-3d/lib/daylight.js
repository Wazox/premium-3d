/*
 * premium-3d / daylight.js
 * L'heure qui passe : la scène glisse d'une ambiance à une autre au scroll (jour → nuit pour un VTC
 * de soirée ou un bar, nuit → aube pour un boulanger, midi → coucher de soleil pour une terrasse).
 * Fond, brouillard, lumières, reflets et couleurs des matériaux passent ensemble, en douceur : une
 * seule valeur k (0 → 1), jamais de bascule d'un coup.
 *
 *   import { daylight } from "./lib/daylight.js";
 *   const time = daylight(stage, {
 *     from: { background: "#dfe7e5", sun: ["#fff4e0", 2.4], ambient: ["#ffffff", 0.6], env: 1 },
 *     to:   { background: "#07090a", sun: ["#9fb8ff", 0.5], ambient: ["#4a5a7a", 0.25], env: 0.3 },
 *   });
 *   time.material(immeubles.material, "#b9c4c2", "#10181a");    // couleurs qui suivent l'heure
 *   time.glow(lampadaires.material, 0, 1.4);                    // ce qui s'allume à la nuit tombée
 *   time.set(ss(0.2, 0.8, P));
 *
 * Le soleil (DirectionalLight) et l'ambiance (HemisphereLight) sont créés et ajoutés à la scène :
 * time.sun, time.ambient. Le brouillard (s'il existe : scene.fog) prend la couleur du fond.
 */
import * as THREE from "three";

const col = (c) => new THREE.Color(c);

/**
 * @param from, to  { background, sun: [couleur, intensité], ambient: [couleur, intensité], env, exposure }
 * @param sunFrom, sunTo  position du soleil au début et à la fin (il descend, ou se lève)
 */
export function daylight(stage, { from, to, sunFrom = [-6, 10, 4], sunTo = [-8, 2.5, 6] } = {}) {
  const { scene, renderer } = stage;
  const sun = new THREE.DirectionalLight(); const ambient = new THREE.HemisphereLight();
  scene.add(sun, ambient);
  const A = { bg: col(from.background), sun: col(from.sun[0]), amb: col(from.ambient[0]) }, B = { bg: col(to.background), sun: col(to.sun[0]), amb: col(to.ambient[0]) };
  const SA = new THREE.Vector3(...sunFrom), SB = new THREE.Vector3(...sunTo);
  const mats = [], glows = [];
  if (!(scene.background && scene.background.isColor)) scene.background = A.bg.clone();
  const api = {
    sun, ambient, k: 0,
    /** couleur d'un matériau qui suit l'heure (couleur au début, couleur à la fin) */
    material(m, a, b) { mats.push([m, col(a), col(b)]); return api; },
    /** intensité lumineuse d'un matériau émissif (fenêtres, lampadaires, enseigne) : de a à b */
    glow(m, a = 0, b = 1) { glows.push([m, a, b, m.color ? m.color.clone() : null]); return api; },
    /** k de 0 (ambiance from) à 1 (ambiance to) */
    set(k) {
      k = Math.min(1, Math.max(0, k)); api.k = k;
      scene.background.lerpColors(A.bg, B.bg, k);
      if (scene.fog) scene.fog.color.copy(scene.background);
      sun.color.lerpColors(A.sun, B.sun, k); sun.intensity = from.sun[1] + (to.sun[1] - from.sun[1]) * k;
      sun.position.lerpVectors(SA, SB, k);
      ambient.color.lerpColors(A.amb, B.amb, k); ambient.groundColor.copy(ambient.color).multiplyScalar(0.4);
      ambient.intensity = from.ambient[1] + (to.ambient[1] - from.ambient[1]) * k;
      if (from.env != null && to.env != null) scene.environmentIntensity = from.env + (to.env - from.env) * k;
      if (from.exposure != null && to.exposure != null) renderer.toneMappingExposure = from.exposure + (to.exposure - from.exposure) * k;
      for (const [m, a, b] of mats) m.color.lerpColors(a, b, k);
      for (const [m, a, b, c] of glows) {
        const g = a + (b - a) * k;
        if (m.emissive) m.emissiveIntensity = g; else if (c) m.color.copy(c).multiplyScalar(g);
        if ("opacity" in m && m.transparent) m.opacity = Math.min(1, g);
      }
      stage.invalidate && stage.invalidate();
      return api;
    },
  };
  api.set(0);
  return api;
}
