/*
 * premium-3d / textures.js
 * Textures procédurales (générées au chargement, aucune image à fournir) : bois, marbre, béton,
 * papier/lin. Elles donnent une vraie matière aux artisans, architectes, marques naturelles.
 *
 *   import { woodMaterial, marbleMaterial, concreteMaterial, paperMaterial } from "./lib/textures.js";
 *   const oak = woodMaterial({ light: "#c99a66", dark: "#8a5a32", scale: 0.6 });
 *
 * Les UV des objets de logo3d.js sont en unités 3D : `scale` = nombre de motifs par unité.
 */
import * as THREE from "three";

/* bruit de valeur 2D, périodique (la texture se répète sans couture) */
function makeNoise(period, seed = 1) {
  const g = new Float32Array(period * period);
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (x, y) => g[((y % period + period) % period) * period + ((x % period + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
}
function fbm(n, x, y, oct = 4) { let f = 0, a = 0.5, s = 1; for (let i = 0; i < oct; i++) { f += a * n(x * s, y * s); a *= 0.5; s *= 2; } return f; }

function paint(size, fn) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, gg, b] = fn(x / size, y / size); const i = (y * size + x) * 4;
    d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
const rgb = (hex) => { const c = new THREE.Color(hex), o = {}; c.getRGB(o, THREE.SRGBColorSpace); return [o.r * 255, o.g * 255, o.b * 255]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function toTexture(canvas, scale, color = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(scale, scale); t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Bois : veines et cernes, fil orienté horizontalement. */
export function woodTexture({ light = "#c99a66", dark = "#8a5a32", rings = 5, size = 512, seed = 3 } = {}) {
  const n = makeNoise(16, seed), A = rgb(light), B = rgb(dark);
  return paint(size, (u, v) => {
    /* fil horizontal : cernes larges légèrement ondulés + fibres fines et serrées */
    const warp = fbm(n, u * 2, v * 3, 3) * 1.1;
    const ring = Math.pow(Math.abs(Math.sin((v * rings + warp) * Math.PI)), 2.5);
    const fibers = fbm(n, u * 1.5, v * 90, 3);
    const knot = fbm(n, u * 6, v * 6, 2);
    return mix(A, B, Math.min(1, ring * 0.45 + fibers * 0.38 + knot * 0.12));
  });
}
/** Marbre : fond clair, veines fines et sinueuses. */
export function marbleTexture({ base = "#f1eee8", vein = "#8d8a84", size = 512, seed = 7 } = {}) {
  const n = makeNoise(8, seed), A = rgb(base), B = rgb(vein);
  return paint(size, (u, v) => {
    const t = Math.abs(Math.sin((u * 2 + v * 1.5 + fbm(n, u * 4, v * 4, 5) * 1.6) * Math.PI));
    const t2 = Math.abs(Math.sin((u * 5 - v * 3 + fbm(n, u * 6 + 3, v * 6, 4) * 2.2) * Math.PI));
    return mix(A, B, Math.min(1, Math.pow(1 - t, 9) * 0.7 + Math.pow(1 - t, 3) * 0.12 + Math.pow(1 - t2, 14) * 0.35 + fbm(n, u * 8, v * 8, 3) * 0.06));
  });
}
/** Béton / pierre : grain fin et taches douces. */
export function concreteTexture({ base = "#b9b5ae", size = 512, seed = 11 } = {}) {
  const n = makeNoise(32, seed), A = rgb(base);
  return paint(size, (u, v) => {
    const k = 0.82 + fbm(n, u * 32, v * 32, 5) * 0.32 + (Math.random() - 0.5) * 0.05;
    return [A[0] * k, A[1] * k, A[2] * k];
  });
}
/** Papier / lin : trame légère. */
export function paperTexture({ base = "#f4efe6", size = 512, seed = 5 } = {}) {
  const n = makeNoise(64, seed), A = rgb(base);
  return paint(size, (u, v) => {
    const k = 0.94 + Math.sin(u * size * 0.9) * 0.012 + Math.sin(v * size * 0.9) * 0.012 + fbm(n, u * 64, v * 64, 3) * 0.06;
    return [A[0] * k, A[1] * k, A[2] * k];
  });
}

const matFrom = (canvas, scale, { roughness, clearcoat = 0, bump = 0.6 }) => {
  const map = toTexture(canvas, scale), bmp = toTexture(canvas, scale, false);
  return new THREE.MeshPhysicalMaterial({ map, bumpMap: bmp, bumpScale: bump, roughness, metalness: 0, clearcoat, clearcoatRoughness: 0.3 });
};
export const woodMaterial = (o = {}) => matFrom(woodTexture(o), o.scale ?? 0.5, { roughness: o.roughness ?? 0.55, clearcoat: o.varnish ? 0.6 : 0, bump: 0.8 });
export const marbleMaterial = (o = {}) => matFrom(marbleTexture(o), o.scale ?? 0.35, { roughness: o.roughness ?? 0.18, clearcoat: 0.8, bump: 0.1 });
export const concreteMaterial = (o = {}) => matFrom(concreteTexture(o), o.scale ?? 0.5, { roughness: o.roughness ?? 0.85, bump: 1.2 });
export const paperMaterial = (o = {}) => matFrom(paperTexture(o), o.scale ?? 0.8, { roughness: o.roughness ?? 0.9, bump: 0.4 });
