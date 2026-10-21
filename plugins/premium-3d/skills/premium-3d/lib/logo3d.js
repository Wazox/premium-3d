/*
 * premium-3d / logo3d.js
 * Un logo SVG devient un objet 3D extrudé (une pièce par <path>, ou regroupées), avec un
 * matériau par pièce. L'animation est à concevoir pour chaque projet.
 *
 *   import { logoPieces } from "./lib/logo3d.js";
 *   const logo = logoPieces(svgString, { size: 3, material: (i) => materials.enamel({ color: palette[i] }) });
 *   scene.add(logo.group);
 */
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

/**
 * @param svg      texte SVG (remplissages, pas de traits)
 * @param size     taille du plus grand côté, en unités 3D
 * @param depth    épaisseur
 * @param pieces   regroupement optionnel des paths : [[0,1],[2],[3,4]]
 * @param material (i) => Material, ou un Material commun
 * @param center   centrer chaque pièce sur sa propre origine (pour les animer) ; sinon garde la position
 */
export function logoPieces(svg, { size = 3, depth = 0.42, bevel = 0.07, pieces = null, material, curveSegments = 16 } = {}) {
  const data = new SVGLoader().parse(svg);
  let groups;
  if (pieces) groups = pieces.map((idx) => idx.flatMap((i) => SVGLoader.createShapes(data.paths[i])));
  else {
    groups = data.paths.map((p) => SVGLoader.createShapes(p)).filter((s) => s.length);
    if (groups.length === 1 && groups[0].length > 1) groups = groups[0].map((s) => [s]);
  }
  const box = new THREE.Box2();
  groups.flat().forEach((s) => s.getPoints(12).forEach((p) => box.expandByPoint(p)));
  const sz = box.getSize(new THREE.Vector2()), mid = box.getCenter(new THREE.Vector2());
  const S = size / Math.max(sz.x, sz.y);
  const group = new THREE.Group();
  const out = groups.map((shapes, i) => {
    const pb = new THREE.Box2(); shapes.forEach((s) => s.getPoints(8).forEach((p) => pb.expandByPoint(p)));
    const ps = pb.getSize(new THREE.Vector2()), minDim = Math.min(ps.x, ps.y) * S;
    const bs = Math.min(bevel, minDim * 0.12), bt = Math.min(bevel * 1.6, minDim * 0.18);
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: depth / S, bevelEnabled: true, bevelThickness: bt / S, bevelSize: bs / S, bevelSegments: 8, curveSegments });
    geo.translate(-mid.x, -mid.y, 0);
    geo.rotateX(Math.PI); // l'axe y du SVG pointe vers le bas : on retourne SANS scale négatif (normales intactes)
    geo.scale(S, S, S);
    { const uv = geo.attributes.uv; for (let k = 0; k < uv.array.length; k++) uv.array[k] *= S; uv.needsUpdate = true; } // UV en unités 3D (textures.js)
    geo.computeBoundingBox();
    const c = new THREE.Vector3(); geo.boundingBox.getCenter(c); geo.translate(-c.x, -c.y, -c.z); c.z = 0;
    const mat = typeof material === "function" ? material(i) : material || new THREE.MeshStandardMaterial();
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(c);
    m.userData = { home: c.clone(), index: i };
    group.add(m);
    return m;
  });
  return { group, pieces: out, scale: S, width: sz.x * S, height: sz.y * S };
}

/**
 * Vue éclatée / assemblage : écarte les pièces de leur place, proportionnellement à k (0 = en place).
 * axis : "z" (couches vers l'avant), "x", "y", "radial" (depuis le centre) ou un vecteur [x,y,z].
 * stagger : décale l'arrivée de chaque pièce (0 = toutes ensemble).
 */
export function explode(pieces, k, { gap = 0.5, axis = "z", stagger = 0 } = {}) {
  const n = pieces.length, v = new THREE.Vector3();
  pieces.forEach((m, i) => {
    const u = m.userData, ki = stagger ? Math.min(1, Math.max(0, (k - (i / n) * stagger) / (1 - stagger))) : k;
    const c = i - (n - 1) / 2;
    if (axis === "radial") { v.set(u.home.x, u.home.y, 0); if (v.lengthSq() < 1e-4) v.set(0, 0, 1); v.normalize().multiplyScalar(gap * 2); }
    else if (Array.isArray(axis)) v.set(...axis).multiplyScalar(gap * c);
    else v.set(axis === "x" ? gap * c : 0, axis === "y" ? gap * c : 0, axis === "z" ? gap * c : 0);
    m.position.copy(u.home).addScaledVector(v, ki);
  });
}
