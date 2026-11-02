/*
 * premium-3d / cloth.js
 * Tissu : une étoffe tendue depuis son bord haut, qui ondule au vent et s'enroule vers le haut pour
 * dévoiler ce qu'il y a derrière (un produit, une photo, le nom de la marque) : un drap d'atelier,
 * un rideau de boutique, une bannière, un store, un tissu de couture, une serviette de barbier.
 *
 *   import { cloth, fabric } from "./lib/cloth.js";
 *   const c = cloth({ width: 3, height: 3.6, material: fabric({ color: "#7a1f2b" }) });
 *   scene.add(c.mesh);
 *   c.update(t, { wind: 1, lift: ss(0.2, 0.7, P) });   // lift 0 = tombe, 1 = enroulé en haut
 *
 * Calculé sur le processeur (une grille de 40 × 48 par défaut) : léger, et l'éclairage suit les plis.
 */
import * as THREE from "three";

/** Matière de tissu : mate, avec un léger lustre rasant (velours, lin, coton). */
export function fabric({ color = "#8a2432", sheen = "#ffffff", rough = 0.85, map = null } = {}) {
  return new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), roughness: rough, metalness: 0, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(sheen), side: THREE.DoubleSide, map });
}

/**
 * @param width, height  taille du tissu (accroché par son bord haut, centré sur l'origine)
 * @param segX, segY     finesse de la grille
 */
export function cloth({ width = 3, height = 3.5, segX = 40, segY = 48, material } = {}) {
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position, rest = pos.array.slice();
  const mesh = new THREE.Mesh(geo, material || fabric());
  const top = height / 2, bottom = -height / 2;
  return {
    mesh,
    /**
     * @param t     temps (secondes)
     * @param wind  force du vent (0 = immobile, 1 = ondulation douce, 2 = fort)
     * @param lift  0 → 1 : le tissu s'enroule depuis le bas jusqu'en haut (dévoilement)
     */
    update(t, { wind = 1, lift = 0 } = {}) {
      const L = bottom + Math.min(1, Math.max(0, lift)) * height * 1.02, R = 0.06 + 0.05 * lift; // ligne d'enroulement et rayon du rouleau
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], v = (top - y) / height; // v : 0 en haut (accroché), 1 en bas
        const sway = wind * (0.09 * Math.sin(x * 2.1 + t * 1.7 + y * 0.9) + 0.05 * Math.sin(x * 4.3 - t * 2.3 + y * 1.7)) * Math.pow(v, 0.9);
        let px = x + wind * 0.04 * Math.sin(t * 1.1 + y * 1.3) * v, py = y, pz = sway;
        if (y < L) { // sous la ligne : enroulé autour d'un rouleau qui monte
          const s = L - y, a = s / R;
          py = L - R * Math.sin(Math.min(a, Math.PI * 6)); pz = R - R * Math.cos(Math.min(a, Math.PI * 6)) + sway * 0.2;
        }
        pos.array[i * 3] = px; pos.array[i * 3 + 1] = py; pos.array[i * 3 + 2] = pz;
      }
      pos.needsUpdate = true; geo.computeVertexNormals();
      mesh.visible = lift < 0.995;
    },
  };
}
