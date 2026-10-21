/*
 * Icône 3D « néon sous verre » : chaque trait d'une icône SVG (style Lucide, 24×24, stroke)
 * devient un tube de verre avec un cœur lumineux à l'intérieur.
 *   import { icon3d } from "./icon3d.js";
 *   const g = icon3d(svgString, { size: 1.6, glass: monMaterielVerre, glow: new THREE.Color(...) });
 */
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

class Lift extends THREE.Curve {
  constructor(pts, closed) { super(); this.c = new THREE.CatmullRomCurve3(pts, closed, "centripetal", 0.2); }
  getPoint(t, target = new THREE.Vector3()) { return this.c.getPoint(t, target); }
}

export function icon3d(svg, { size = 1.6, glass, glow, thickness = 1.15 } = {}) {
  const data = new SVGLoader().parse(svg);
  const vb = (svg.match(/viewBox="([^"]+)"/) || [, "0 0 24 24"])[1].split(/[ ,]+/).map(Number);
  const S = size / Math.max(vb[2], vb[3]);
  const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
  const r = thickness * S;
  const group = new THREE.Group();
  const glowM = new THREE.MeshBasicMaterial({ color: glow, toneMapped: false });
  const cap = new THREE.SphereGeometry(r, 16, 12), capCore = new THREE.SphereGeometry(r * 0.45, 10, 8);
  data.paths.forEach((sp) => {
    sp.subPaths.forEach((sub) => {
      const raw = sub.getPoints(10);
      if (raw.length < 2) return;
      const pts = [];
      raw.forEach((p) => { const v = new THREE.Vector3((p.x - cx) * S, (cy - p.y) * S, 0); if (!pts.length || pts[pts.length - 1].distanceTo(v) > 1e-4) pts.push(v); });
      if (pts.length < 2) return;
      const closed = pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < r * 0.5;
      if (closed) pts.pop();
      if (pts.length === 2) pts.splice(1, 0, pts[0].clone().lerp(pts[1], 0.5));
      const curve = new Lift(pts, closed);
      const segs = Math.min(200, Math.max(16, pts.length * 6));
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 14, closed), glass));
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r * 0.42, 8, closed), glowM));
      if (!closed) [pts[0], pts[pts.length - 1]].forEach((p) => {
        const a = new THREE.Mesh(cap, glass); a.position.copy(p); group.add(a);
        const b = new THREE.Mesh(capCore, glowM); b.position.copy(p); group.add(b);
      });
    });
  });
  group.userData.glow = glowM;
  return group;
}
