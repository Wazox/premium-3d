/*
 * premium-3d / ribbon.js
 * Un ruban ou un fil qui se dessine le long d'un trajet : une signature, un trajet sur une carte,
 * une mèche, un ruban de tissu, un fil de couture, un tracé de néon, la vapeur d'une tasse.
 * reveal(k) le fait pousser de 0 à 1 (au scroll) sans rien recréer : seule la partie visible est
 * dessinée.
 *
 *   import { ribbon } from "./lib/ribbon.js";
 *   const r = ribbon([[-2, 0, 0], [-1, 0.6, 0.3], [0, -0.2, 0], [1.2, 0.5, -0.2], [2, 0, 0]], {
 *     width: 0.18, twist: 1.5, material: materials.enamel({ color: "#c0392b" }) });
 *   scene.add(r.mesh);
 *   r.reveal(ss(0.1, 0.6, P));          // 0 = rien, 1 = tout le ruban
 *   r.wave(t, 0.08);                    // ondulation lente (optionnel, tissu ou fumée)
 *
 * Le trajet : des points [x, y, z] (courbe lissée qui passe par chacun), une THREE.Curve, ou
 * route(points, rayon) : lignes droites et virages arrondis, comme des rues (trajet GPS).
 */
import * as THREE from "three";

/**
 * @param path      points [[x,y,z], …] ou THREE.Curve
 * @param width     largeur du ruban (unités 3D) ; tube: true → fil rond de rayon width / 2
 * @param taper     amincit les extrémités (0 = droit, 1 = pointes fines, comme un trait de pinceau)
 * @param twist     tours sur lui-même le long du trajet (ruban)
 * @param segments  finesse le long du trajet (par défaut : 60 par unité de longueur, plafonné à 1200)
 * @param up        ruban posé à plat sur un plan : la normale de ce plan ([0, 1, 0] sur un sol, [0, 0, 1]
 *                  sur un plan vertical) ; sans, le ruban suit les repères de Frenet de la courbe
 * @param material  matériau (DoubleSide imposé pour le ruban plat)
 */
export function ribbon(path, { width = 0.15, taper = 0.6, twist = 0, tube = false, segments = 0, radial = 10, material, closed = false, up = null } = {}) {
  const curve = path.getPoint ? path : new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p)), closed, "centripetal");
  const len = curve.getLength(), N = segments || Math.min(1200, Math.max(64, Math.round(len * 60)));
  const frames = curve.computeFrenetFrames(N, closed);
  const pts = curve.getSpacedPoints(N);
  const sides = tube ? radial : 1, ring = tube ? radial + 1 : 2;
  const pos = new Float32Array((N + 1) * ring * 3), nor = new Float32Array((N + 1) * ring * 3), uv = new Float32Array((N + 1) * ring * 2);
  const off = new Float32Array((N + 1) * ring * 3); // direction de l'ondulation de chaque sommet
  const n = new THREE.Vector3(), b = new THREE.Vector3(), v = new THREE.Vector3(), UP = up ? new THREE.Vector3(...up) : null;
  for (let i = 0; i <= N; i++) {
    const u = i / N, w = width * (1 - taper * Math.pow(Math.abs(u * 2 - 1), 3)), a = u * twist * Math.PI * 2;
    const T = frames.tangents[i], Nn = frames.normals[i], Bn = frames.binormals[i], P = pts[i];
    for (let j = 0; j < ring; j++) {
      const k = (i * ring + j) * 3;
      if (tube) {
        const t = (j / radial) * Math.PI * 2;
        v.copy(Nn).multiplyScalar(Math.cos(t)).addScaledVector(Bn, Math.sin(t));
        nor.set([v.x, v.y, v.z], k); v.multiplyScalar(w / 2);
      } else {
        if (up) { n.crossVectors(UP, T).normalize(); if (a) n.applyAxisAngle(T, a); } // à plat sur le plan
        else n.copy(Nn).multiplyScalar(Math.cos(a)).addScaledVector(Bn, Math.sin(a)); // largeur, tournée de a
        b.crossVectors(T, n).normalize();
        nor.set([b.x, b.y, b.z], k); v.copy(n).multiplyScalar((j ? 0.5 : -0.5) * w);
      }
      pos.set([P.x + v.x, P.y + v.y, P.z + v.z], k);
      off.set(tube ? [Nn.x, Nn.y, Nn.z] : [nor[k], nor[k + 1], nor[k + 2]], k); // fil : sur le côté ; ruban : hors de son plan
      uv.set([u, tube ? j / radial : j], (i * ring + j) * 2);
    }
  }
  const index = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < sides; j++) {
    const a = i * ring + j, b2 = (i + 1) * ring + j, c = (i + 1) * ring + j + 1, d = i * ring + j + 1;
    index.push(a, b2, d, b2, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(index);
  material = material || new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 });
  if (!tube) material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(g, material);
  const perStep = sides * 6, total = index.length;
  /* ondulation : chaque section se décale le long de sa normale, en vague qui court le long du ruban */
  const wavePos = g.attributes.position;
  return {
    mesh, length: len,
    /** k de 0 à 1 : part du ruban dessinée depuis le début du trajet */
    reveal(k) { k = Math.min(1, Math.max(0, k)); g.setDrawRange(0, Math.round(k * N) * perStep); mesh.visible = k > 0.001; },
    /** ondulation douce (tissu, fumée) : à appeler dans la boucle avec le temps ; amp en unités 3D */
    wave(t, amp = 0.06, freq = 2.2) {
      for (let i = 0; i <= N; i++) {
        const u = i / N, o = Math.sin(u * freq * Math.PI * 2 - t * 1.6) * amp * Math.sin(u * Math.PI);
        for (let j = 0; j < ring; j++) { const k = (i * ring + j) * 3; for (let c = 0; c < 3; c++) wavePos.array[k + c] = pos[k + c] + off[k + c] * o; }
      }
      wavePos.needsUpdate = true;
    },
    /** point du trajet à u (0 → 1) : y poser un objet qui « tire » le ruban (aiguille, voiture, plume) */
    pointAt(u, target = new THREE.Vector3()) { return curve.getPointAt(Math.min(1, Math.max(0, u)), target); },
    tangentAt(u, target = new THREE.Vector3()) { return curve.getTangentAt(Math.min(1, Math.max(0, u)), target); },
  };
}

/**
 * Trajet de rues : segments droits reliés par des virages arrondis de rayon `radius` (une courbe
 * lissée passerait à travers les pâtés de maisons). À donner à ribbon().
 *   const r = ribbon(route([[0, 0, 0], [0, 0, 4], [3, 0, 4]], 0.4), { width: 0.1, up: [0, 1, 0] });
 */
export function route(points, radius = 0.3) {
  const P = points.map((p) => new THREE.Vector3(...p)), path = new THREE.CurvePath();
  let from = P[0].clone();
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], c = P[i], b = P[i + 1];
    const din = c.clone().sub(a), dout = b.clone().sub(c);
    const r = Math.min(radius, din.length() / 2, dout.length() / 2);
    const p1 = c.clone().addScaledVector(din.normalize(), -r), p2 = c.clone().addScaledVector(dout.normalize(), r);
    path.add(new THREE.LineCurve3(from, p1)); path.add(new THREE.QuadraticBezierCurve3(p1, c.clone(), p2)); from = p2;
  }
  path.add(new THREE.LineCurve3(from, P[P.length - 1]));
  return path;
}
