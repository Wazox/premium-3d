/*
 * premium-3d / logo3d.js
 * Un logo SVG devient un objet 3D extrudé (une pièce par <path>, ou regroupées), avec un
 * matériau par pièce. L'animation est à concevoir pour chaque projet.
 *
 *   import { logoPieces } from "./lib/logo3d.js";
 *   const logo = logoPieces(svgString, { size: 3, material: (i, color) => materials.enamel({ color }) });
 *   scene.add(logo.group);
 *   // color = la couleur de remplissage de la pièce dans le SVG (classes CSS d'Illustrator comprises)
 *   pivot(logo.pieces[2], "bottom");   // la pièce tournera autour de sa base (pétale, porte, couvercle)
 */
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

/**
 * @param svg      texte SVG (remplissages, pas de traits)
 * @param size     taille du plus grand côté, en unités 3D
 * @param depth    épaisseur
 * @param pieces   regroupement optionnel des paths : [[0,1],[2],[3,4]]
 * @param material (i, color) => Material, ou un Material commun ; color = couleur de la pièce dans le SVG
 * @param center   centrer chaque pièce sur sa propre origine (pour les animer) ; sinon garde la position
 */
export function logoPieces(svg, { size = 3, depth = 0.42, bevel = 0.07, pieces = null, material, curveSegments = 16 } = {}) {
  const data = new SVGLoader().parse(svg);
  if (/<text[\s>]/i.test(svg)) console.warn("premium-3d : le texte <text> du SVG est ignoré (seuls les tracés sont extrudés). Pour le nom en volume : text3d(), ou vectoriser le texte dans le logiciel de dessin.");
  const hex = (p) => (p && p.color ? "#" + p.color.getHexString() : null);
  let groups, colors;
  if (pieces) { groups = pieces.map((idx) => idx.flatMap((i) => SVGLoader.createShapes(data.paths[i]))); colors = pieces.map((idx) => hex(data.paths[idx[0]])); }
  else {
    const kept = data.paths.map((p) => [SVGLoader.createShapes(p), hex(p)]).filter(([s]) => s.length);
    groups = kept.map(([s]) => s); colors = kept.map(([, c]) => c);
    if (groups.length === 1 && groups[0].length > 1) { const c = colors[0]; groups = groups[0].map((s) => [s]); colors = groups.map(() => c); }
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
    const color = colors[i] || "#cccccc";
    const mat = typeof material === "function" ? material(i, color) : material || new THREE.MeshStandardMaterial({ color });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(c);
    m.userData = { home: c.clone(), index: i, color };
    group.add(m);
    return m;
  });
  return { group, pieces: out, colors, scale: S, width: sz.x * S, height: sz.y * S };
}

/**
 * Change le point autour duquel une pièce tourne et grandit, sans la déplacer à l'écran.
 * where : "center", "bottom", "top", "left", "right", "bottom-left"… ou [x, y, z] dans le repère
 * de la pièce. Ex. un pétale qui s'ouvre depuis sa base, une porte sur ses gonds, un couvercle.
 * Met à jour userData.home (utilisé par explode) : appeler avant d'animer.
 */
export function pivot(mesh, where = "center") {
  const g = mesh.geometry; g.computeBoundingBox();
  const b = g.boundingBox, p = new THREE.Vector3();
  if (Array.isArray(where)) p.set(...where);
  else {
    b.getCenter(p);
    if (/bottom/.test(where)) p.y = b.min.y; if (/top/.test(where)) p.y = b.max.y;
    if (/left/.test(where)) p.x = b.min.x; if (/right/.test(where)) p.x = b.max.x;
  }
  g.translate(-p.x, -p.y, -p.z);
  const shift = p.clone().multiply(mesh.scale).applyQuaternion(mesh.quaternion);
  mesh.position.add(shift);
  if (mesh.userData.home) mesh.userData.home.add(shift);
  return mesh;
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
