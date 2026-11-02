/*
 * premium-3d / terrain.js
 * Relief : un terrain qui sort du plat (montagne, vignoble, côte, quartier, carte d'une région),
 * avec des lignes de niveau comme sur une carte IGN. Le relief vient d'une image en niveaux de gris
 * (clair = haut) ou d'une fonction. rise(k) le fait monter de 0 (plat) à 1 (relief complet) au scroll.
 *
 *   import { relief } from "./lib/terrain.js";
 *   const r = await relief({ fn: (x, z) => Math.exp(-(x * x + z * z) * 0.4), size: 6, height: 1.4,
 *     color: "#d8cdb8", lines: "#6b5a43", step: 0.12 });
 *   scene.add(r.mesh);
 *   r.rise(ss(0, 0.5, P));      // le relief monte
 *
 * Avec une image : relief({ image: "img/relief.png", size: 6, height: 1 }) (await : l'image se charge).
 * Un trajet par-dessus : ribbon(…) avec des points posés à r.heightAt(x, z) + un petit écart.
 */
import * as THREE from "three";

/**
 * @param image     image en niveaux de gris (clair = haut), ou fn(x, z) → 0..1 avec x, z en unités 3D
 * @param size      largeur (et profondeur, sauf `depth`) en unités 3D
 * @param height    hauteur maximale
 * @param segments  finesse (par défaut 160 ; 96 sur machine modeste)
 * @param lines     couleur des lignes de niveau (null = aucune) ; step : écart entre deux lignes
 * @param material  matériau à utiliser à la place (les lignes s'y ajoutent si `lines`)
 */
export async function relief({ image = null, fn = null, size = 6, depth = null, height = 1, segments = 160, color = "#d9d2c3", lines = "#3d3427", step = 0.1, lineWidth = 1, rough = 0.85, material = null } = {}) {
  depth = depth ?? size;
  let sample = fn;
  if (image) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = image; });
    const w = 256, h = Math.round((256 * img.height) / img.width), c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true }); g.filter = "blur(1px)"; g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const at = (px, py) => { const i = (Math.min(h - 1, Math.max(0, py)) * w + Math.min(w - 1, Math.max(0, px))) * 4; return (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255; };
    sample = (x, z) => { // bilinéaire : pas de marches d'escalier
      const fx = (x / size + 0.5) * (w - 1), fz = (z / depth + 0.5) * (h - 1), x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
      return (at(x0, z0) * (1 - tx) + at(x0 + 1, z0) * tx) * (1 - tz) + (at(x0, z0 + 1) * (1 - tx) + at(x0 + 1, z0 + 1) * tx) * tz;
    };
  }
  if (!sample) throw new Error("relief : donner image ou fn(x, z).");
  const geo = new THREE.PlaneGeometry(size, depth, segments, Math.round(segments * depth / size)).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, hts = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) hts[i] = sample(pos.getX(i), pos.getZ(i)) * height;
  geo.setAttribute("aHeight", new THREE.BufferAttribute(hts, 1));
  for (let i = 0; i < pos.count; i++) pos.setY(i, hts[i]);
  geo.computeVertexNormals(); // normales du relief complet (rise ne fait que l'aplatir)
  const mat = material || new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: 0 });
  const u = { uRise: { value: 1 }, uStep: { value: step }, uLine: { value: new THREE.Color(lines || "#000") }, uLineW: { value: lineWidth }, uHasLines: { value: lines ? 1 : 0 } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aHeight; uniform float uRise; varying float vH;")
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nobjectNormal = normalize(vec3(objectNormal.x * uRise, objectNormal.y, objectNormal.z * uRise));")
      .replace("#include <begin_vertex>", "vec3 transformed = position; transformed.y = aHeight * uRise; vH = aHeight;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uStep, uLineW, uHasLines, uRise; uniform vec3 uLine; varying float vH;")
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
  if (uHasLines > .5) { float f = vH / uStep, w = fwidth(f) * uLineW; float l = 1. - smoothstep(0., w, abs(fract(f - .5) - .5));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uLine, l * .85 * smoothstep(0., .25, uRise)); }`);
  };
  mat.customProgramCacheKey = () => "p3d-relief";
  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh, uniforms: u,
    /** 0 = plat, 1 = relief complet */
    rise(k) { u.uRise.value = Math.min(1, Math.max(0, k)); },
    /** hauteur du relief complet en (x, z) : poser un trajet, un repère, un objet dessus */
    heightAt(x, z) { return sample(x, z) * height * u.uRise.value; },
  };
}
