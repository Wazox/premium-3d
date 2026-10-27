/*
 * premium-3d / forms.js
 * Aides pour modéliser les objets du métier (flacon, coupe, bol, pain, galet, fruit…) sans qu'ils
 * aient l'air faits de cylindres : profils lissés, parois épaisses, liquide qui se remplit,
 * irrégularités organiques, couleurs peintes sur la forme. Ce ne sont pas des objets tout faits :
 * la forme reste à dessiner pour chaque projet (voir references/modeling.md).
 *
 *   import { lathe, liquid, organic, deform, tint, roundedBox } from "./lib/forms.js";
 *   const flacon = [[0, 0], [0.34, 0], [0.36, 0.04], [0.36, 0.9], [0.3, 1.02], [0.12, 1.08], [0.11, 1.2]];
 *   const verre = new THREE.Mesh(lathe(flacon, { thickness: 0.03 }), materials.glass({ tint: "#b8670f", dist: 0.6 }));
 *   const huile = liquid(flacon, { thickness: 0.03, to: 0.8, material: new THREE.MeshPhysicalMaterial({ color: "#d99a2b", roughness: 0.08 }) });
 *   verre.add(huile.mesh); huile.set(0.6);       // 0 = vide, 1 = plein (dans la boucle : sans rien recréer)
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";

/* ---------- profils ---------- */

/** Profil lissé (Catmull-Rom) : [[r, y], …] → points serrés, du bas vers le haut. */
function smoothProfile(profile, steps) {
  if (profile.length < 3 || steps <= 1) return profile.map(([r, y]) => new THREE.Vector2(r, y));
  const curve = new THREE.CatmullRomCurve3(profile.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, "centripetal");
  return curve.getPoints((profile.length - 1) * steps).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
}

/* paroi intérieure : chaque point du profil décalé vers l'intérieur de `t` (le long de la normale 2D) */
function offsetInward(pts, t) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    const nx = ty / l, ny = -tx / l; // normale vers l'extérieur pour un profil qui monte
    return new THREE.Vector2(Math.max(0, p.x - nx * t), p.y - ny * t);
  });
}

/**
 * Objet de révolution (flacon, verre, bol, tasse, vase, bouchon, pied de lampe) à partir d'un profil
 * [[rayon, hauteur], …] dessiné du bas (rayon 0 sur l'axe) vers le haut.
 *   smooth     points intercalés entre deux points du profil (courbe lissée), 0 = lignes droites
 *   thickness  > 0 : objet creux à paroi épaisse (verre, céramique), lèvre arrondie en haut ;
 *              0 : objet plein (le profil doit alors se refermer sur l'axe en haut)
 *   segments   finesse autour de l'axe (96 = net de près ; 48 suffit pour un petit objet)
 */
export function lathe(profile, { smooth = 8, thickness = 0, segments = 96 } = {}) {
  let pts = smoothProfile(profile, smooth);
  if (thickness > 0) {
    const inner = offsetInward(pts, thickness);
    const top = pts[pts.length - 1], itop = inner[inner.length - 1];
    /* lèvre : demi-cercle entre le bord extérieur et le bord intérieur */
    const cx = (top.x + itop.x) / 2, cy = (top.y + itop.y) / 2, r = Math.hypot(top.x - itop.x, top.y - itop.y) / 2;
    const a0 = Math.atan2(top.y - cy, top.x - cx), lip = [];
    for (let k = 1; k < 8; k++) { const a = a0 + (Math.PI * k) / 8; lip.push(new THREE.Vector2(Math.max(0, cx + Math.cos(a) * r), cy + Math.sin(a) * r)); }
    pts = [...pts, ...lip, ...inner.reverse()];
    if (pts[pts.length - 1].x > 0) pts.push(new THREE.Vector2(0, pts[pts.length - 1].y));
  }
  const g = new THREE.LatheGeometry(pts, segments);
  return toCreasedNormals(g, Math.PI / 3); // normales continues sur la couture, arête vive gardée au-delà de 60°
}

/** Rayon du profil (lissé, et paroi intérieure si `thickness`) à la hauteur y. */
export function radiusAt(profile, y, { smooth = 8, thickness = 0 } = {}) {
  let pts = smoothProfile(profile, smooth);
  if (thickness > 0) pts = offsetInward(pts, thickness);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if ((y - a.y) * (y - b.y) <= 0 && a.y !== b.y) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
  }
  return 0;
}

/**
 * Liquide dans un récipient fait avec lathe() (même profil, même thickness) : il épouse la paroi
 * intérieure et se remplit avec set(niveau 0 → 1) sans rien recréer (plan de coupe + surface plane).
 * Matière OPAQUE (couleur, rugosité basse) : le verre ne voit pas les objets transparents.
 *   from   hauteur du fond du liquide (par défaut : le fond intérieur) ; to : niveau « plein »
 *   gap    petit retrait par rapport à la paroi (évite le scintillement verre / liquide)
 * Renvoie { mesh, set(niveau) } ; mesh est à ajouter dans le récipient (mêmes coordonnées).
 */
export function liquid(profile, { thickness = 0.03, smooth = 8, from = null, to = null, gap = 0.006, material, segments = 72 } = {}) {
  const inner = offsetInward(smoothProfile(profile, smooth), thickness + gap);
  const y0 = from ?? inner[0].y, y1 = to ?? inner[inner.length - 1].y - 0.02;
  const pts = inner.filter((p) => p.y >= y0 && p.y <= y1);
  const rAt = (y) => radiusAt(profile, y, { smooth, thickness: thickness + gap });
  pts.unshift(new THREE.Vector2(0, y0), new THREE.Vector2(rAt(y0), y0));
  pts.push(new THREE.Vector2(rAt(y1), y1), new THREE.Vector2(0, y1));
  material = material || new THREE.MeshPhysicalMaterial({ color: "#c8811e", roughness: 0.08, clearcoat: 1 });
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  material.clippingPlanes = [plane]; material.side = THREE.DoubleSide;
  const body = new THREE.Mesh(toCreasedNormals(new THREE.LatheGeometry(pts, segments), Math.PI / 3), material);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(1, segments).rotateX(-Math.PI / 2), material.clone());
  cap.material.clippingPlanes = null; cap.material.side = THREE.FrontSide;
  const mesh = new THREE.Group(); mesh.add(body, cap);
  let level = y1;
  const local = new THREE.Plane();
  /* le plan suit l'objet (il peut tourner, bouger) : recalculé juste avant de dessiner */
  body.onBeforeRender = () => { local.set(new THREE.Vector3(0, -1, 0), level); plane.copy(local).applyMatrix4(mesh.matrixWorld); };
  const set = (k) => {
    k = Math.min(1, Math.max(0, k)); level = y0 + (y1 - y0) * k;
    const r = rAt(level); cap.position.y = level; cap.scale.setScalar(Math.max(1e-4, r)); cap.visible = k > 0.002; body.visible = k > 0.002;
  };
  set(1);
  return { mesh, set, get level() { return (level - y0) / (y1 - y0); } };
}

/* ---------- formes organiques ---------- */

/* bruit de valeur 3D déterministe (même graine = même forme à chaque chargement) */
function noise3(seed) {
  const h = (x, y, z) => { let n = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144269) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const s = (t) => t * t * (3 - 2 * t), L = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = s(x - xi), v = s(y - yi), w = s(z - zi);
    const c = (dx, dy, dz) => h(xi + dx, yi + dy, zi + dz);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w) * 2 - 1;
  };
}

/**
 * Déforme une géométrie point par point : fn(p) modifie p (THREE.Vector3) en place.
 * Ex. pain : sphère étirée, base aplatie, entaille sur le dessus. Normales recalculées sans couture.
 * À faire une fois à la construction, jamais dans la boucle.
 */
export function deform(geometry, fn) {
  const pos = geometry.attributes.position, p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); fn(p, i); pos.setXYZ(i, p.x, p.y, p.z); }
  geometry.deleteAttribute("normal");
  const out = toCreasedNormals(geometry, Math.PI / 3);
  out.computeBoundingSphere();
  return out;
}

/**
 * Irrégularités naturelles (pain, pierre, fruit, galet, céramique faite main) : bosses douces le long
 * de la surface. Une forme parfaite a l'air d'un objet de synthèse ; 2 à 5 % de la taille suffisent.
 *   amp   hauteur des bosses (unités 3D) · freq : nombre de bosses par unité · octaves : détail
 * Forme lisse et assez subdivisée (SphereGeometry(1, 96, 64), lathe…) ; arêtes vives : roundedBox.
 */
export function organic(geometry, { amp = 0.04, freq = 2.2, octaves = 3, seed = 1 } = {}) {
  const n = noise3(seed), c = new THREE.Vector3();
  geometry.computeBoundingBox(); geometry.boundingBox.getCenter(c);
  const d = new THREE.Vector3();
  return deform(geometry, (p) => {
    let f = 0, a = 1, s = freq, norm = 0;
    for (let o = 0; o < octaves; o++) { f += a * n(p.x * s, p.y * s, p.z * s); norm += a; a *= 0.5; s *= 2.1; }
    d.copy(p).sub(c).normalize(); // direction depuis le centre : continue sur les coutures (pas de fissure)
    p.addScaledVector(d, (f / norm) * amp);
  });
}

/**
 * Couleurs peintes sur la forme (croûte plus dorée sur le dessus, fruit qui mûrit, émail coulé) :
 * fn(p, n) → couleur (hex, THREE.Color ou [r, g, b] 0 → 1). Matériau avec `vertexColors: true`
 * (sa `color` multiplie : la laisser blanche).
 */
export function tint(geometry, fn) {
  const pos = geometry.attributes.position, nor = geometry.attributes.normal, cols = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); if (nor) n.fromBufferAttribute(nor, i);
    const v = fn(p, n);
    if (Array.isArray(v)) col.setRGB(v[0], v[1], v[2]); else col.set(v);
    col.toArray(cols, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  return geometry;
}

/** Boîte aux arêtes arrondies (comptoir, socle, téléphone, carte, brique) : une arête vive n'existe pas dans la réalité. */
export function roundedBox(w, h, d, { radius = 0.04, segments = 4 } = {}) {
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, w / 2, h / 2, d / 2));
}
