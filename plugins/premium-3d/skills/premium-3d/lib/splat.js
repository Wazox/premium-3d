/*
 * premium-3d / splat.js
 * Scans 3D réels (Gaussian splatting) : le vrai lieu, le vrai produit, filmé au téléphone.
 * Le client scanne son atelier, sa boutique, un plat, une pièce (apps Scaniverse, Polycam,
 * Luma, ou Marble de World Labs) et exporte un fichier .spz (le plus léger), .ply, .splat ou .sog.
 * Rendu par Spark (MIT, World Labs), en WebGL 2 : marche avec createStage, le bloom et la boucle.
 *
 *   importmap : "@sparkjsdev/spark": "https://cdn.jsdelivr.net/npm/@sparkjsdev/spark@2.4.0/dist/spark.module.js"
 *   import { loadSplat } from "./lib/splat.js";
 *   const atelier = await loadSplat(stage, "scans/atelier.spz", { size: 4 });  // centré, mis à l'échelle
 *   stage.scene.add(atelier);
 *
 * Poids : viser 5 à 15 Mo en .spz pour une page (un scan brut .ply pèse souvent 10 fois plus ;
 * le convertir en .spz avant de le mettre en ligne). Charger le scan avec whenNear() s'il est
 * plus bas dans la page. Pas de bloom sur un scan : threshold élevé ou bloom: false.
 */
import * as THREE from "three";

let spark = null;
const renderers = new WeakMap();

/**
 * Charge un scan, le centre et le met à l'échelle (size = plus grande dimension en unités 3D).
 * rotate : [x, y, z] en radians, pour remettre droit un scan exporté couché ou à l'envers
 * (beaucoup d'applications exportent l'axe y vers le bas : rotate: [Math.PI, 0, 0]).
 * Renvoie un Group ; group.userData.splat = le SplatMesh de Spark (effets, couleurs).
 */
export async function loadSplat(stage, url, { size = 3, rotate = [Math.PI, 0, 0] } = {}) {
  if (!spark) spark = await import("@sparkjsdev/spark");
  if (!renderers.has(stage)) { // un seul SparkRenderer par scène : il trie et dessine tous les scans ensemble
    const sr = new spark.SparkRenderer({ renderer: stage.renderer });
    stage.scene.add(sr); renderers.set(stage, sr);
  }
  const mesh = new spark.SplatMesh({ url });
  await mesh.initialized;
  mesh.rotation.set(...rotate);
  mesh.updateMatrixWorld(true);
  const box = mesh.getBoundingBox(true).applyMatrix4(mesh.matrix);
  const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = size / Math.max(sz.x, sz.y, sz.z, 1e-6);
  mesh.position.copy(c).multiplyScalar(-k); mesh.scale.setScalar(k);
  const group = new THREE.Group(); group.add(mesh);
  group.userData.splat = mesh;
  group.userData.bottom = -sz.y * k / 2;
  return group;
}
