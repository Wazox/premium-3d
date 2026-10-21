/*
 * premium-3d / text3d.js
 * Texte en volume avec la vraie police de la marque (fichier .ttf, .otf ou .woff ; pas .woff2).
 *
 *   import { loadFont, text3d } from "./lib/text3d.js";
 *   const font = await loadFont("fonts/ma-police.woff");
 *   const mesh = text3d(font, "BONJOUR", { size: 1, depth: 0.3, material: materials.metal({...}) });
 *   scene.add(mesh);
 *
 * Avec splitLetters: true, renvoie un Group avec une lettre par enfant (pour les animer une à une).
 */
import * as THREE from "three";
import { TTFLoader } from "three/addons/loaders/TTFLoader.js";
import { Font } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

const cache = new Map();
export function loadFont(url) {
  if (!cache.has(url)) cache.set(url, new Promise((res, rej) => new TTFLoader().load(url, (json) => res(new Font(json)), undefined, rej)));
  return cache.get(url);
}

function geom(font, text, { size, depth, bevel, curveSegments }) {
  const g = new TextGeometry(text, {
    font, size, depth, curveSegments,
    bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 6,
  });
  g.computeBoundingBox();
  return g;
}

export function text3d(font, text, { size = 1, depth = 0.3, bevel = 0.03, curveSegments = 10, material, align = "center", splitLetters = false, letterSpacing = 0 } = {}) {
  const mat = material || new THREE.MeshStandardMaterial();
  if (!splitLetters) {
    const g = geom(font, text, { size, depth, bevel, curveSegments });
    const b = g.boundingBox, w = b.max.x - b.min.x, h = b.max.y - b.min.y;
    g.translate(align === "center" ? -b.min.x - w / 2 : -b.min.x, -b.min.y - h / 2, -depth / 2);
    const m = new THREE.Mesh(g, mat); m.userData.width = w; m.userData.height = h; return m;
  }
  /* une lettre par mesh, avec l'approche de la police */
  const group = new THREE.Group();
  const full = geom(font, text, { size, depth, bevel, curveSegments }), fb = full.boundingBox;
  const totalW = fb.max.x - fb.min.x, h = fb.max.y - fb.min.y; full.dispose();
  let x = 0; const scale = size / font.data.resolution;
  [...text].forEach((ch, i) => {
    const glyph = font.data.glyphs[ch] || font.data.glyphs["?"];
    const adv = (glyph ? glyph.ha : font.data.resolution * 0.5) * scale;
    if (ch.trim()) {
      const g = geom(font, ch, { size, depth, bevel, curveSegments });
      const b = g.boundingBox, cx = (b.min.x + b.max.x) / 2;
      g.translate(-cx, -fb.min.y - h / 2, -depth / 2);
      const m = new THREE.Mesh(g, mat);
      m.position.x = x + cx - (align === "center" ? totalW / 2 + fb.min.x : fb.min.x);
      m.userData = { index: i, home: m.position.clone(), char: ch };
      group.add(m);
    }
    x += adv + letterSpacing;
  });
  group.userData.width = totalW; group.userData.height = h;
  return group;
}
