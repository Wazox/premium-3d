/*
 * premium-3d / particles.js
 * Nuages de particules qui prennent la forme d'une image, d'un logo, d'un texte ou d'un objet 3D,
 * et passent d'une forme à l'autre (morphing). Tout est calculé dans le shader : des dizaines de
 * milliers de points restent fluides.
 *
 *   import { sampleImage, sampleSVG, sampleText, sampleMesh, scatter, shape, particleMorph } from "./lib/particles.js";
 *   const A = await sampleImage("photo.jpg", { count: 20000, width: 6 });
 *   const B = await sampleSVG(logoSvg, { count: 20000, width: 4 });
 *   const C = await sampleText("BONJOUR", { count: 20000, font: "800 160px 'Ma Police'" });
 *   const pm = particleMorph([scatter(20000, 8), A, B], { size: 3.5 });
 *   scene.add(pm.points);
 *   pm.set(P * 2);   // 0 = nuage, 1 = photo, 2 = logo (valeurs intermédiaires = transition)
 *   pm.update(t);
 */
import * as THREE from "three";
import { NOISE } from "./shaders.js";

/** Un échantillon = { positions: Float32Array(count*3), colors: Float32Array(count*3) } */
function fromPixels(data, w, h, count, width, { threshold = 128, mode = "alpha", depth = 0.15, color = null } = {}) {
  const pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = data[i + 3];
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    if (mode === "alpha" ? a > threshold : a > 10 && lum > threshold) pts.push(i, x, y);
  }
  const n = pts.length / 3; if (!n) throw new Error("particles : aucune zone visible dans l'image");
  const s = width / w, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const c = color ? new THREE.Color(color) : null;
  for (let k = 0; k < count; k++) {
    const j = Math.floor(Math.random() * n) * 3, i = pts[j], x = pts[j + 1], y = pts[j + 2];
    positions[k * 3] = (x + Math.random() - w / 2) * s;
    positions[k * 3 + 1] = (h / 2 - y - Math.random()) * s;
    positions[k * 3 + 2] = (Math.random() - 0.5) * depth;
    if (c) { colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b; }
    else { const col = new THREE.Color().setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, THREE.SRGBColorSpace); colors[k * 3] = col.r; colors[k * 3 + 1] = col.g; colors[k * 3 + 2] = col.b; }
  }
  return { positions, colors };
}
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function canvasOf(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d", { willReadFrequently: true })]; }

/** Photo ou image → particules aux couleurs de l'image (mode luminance pour les photos sans transparence). */
export async function sampleImage(src, { count = 20000, width = 6, res = 220, mode = "luma", threshold = 18, color = null, depth = 0.2 } = {}) {
  const img = await loadImg(src);
  const w = res, h = Math.round((res * img.height) / img.width);
  const [, g] = canvasOf(w, h); g.drawImage(img, 0, 0, w, h);
  return fromPixels(g.getImageData(0, 0, w, h).data, w, h, count, width, { mode, threshold, color, depth });
}
/** Logo SVG → particules (couleurs du SVG, ou une couleur imposée). */
export async function sampleSVG(svg, { count = 20000, width = 4, res = 260, color = null, depth = 0.25 } = {}) {
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const img = await loadImg(url);
  const ratio = (img.height || 1) / (img.width || 1), w = res, h = Math.max(1, Math.round(res * ratio));
  const [, g] = canvasOf(w, h); g.drawImage(img, 0, 0, w, h);
  return fromPixels(g.getImageData(0, 0, w, h).data, w, h, count, width, { mode: "alpha", color, depth });
}
/**
 * Texte → particules, dans la police donnée (chargée automatiquement avant de dessiner : sans ça,
 * le texte serait dessiné dans la police de secours du navigateur). Asynchrone : `await sampleText(…)`.
 */
export async function sampleText(text, { count = 20000, width = 6, font = "800 160px system-ui", color = "#ffffff", depth = 0.2 } = {}) {
  if (document.fonts) {
    try { await document.fonts.load(font, text); } catch (e) {}
    if (!document.fonts.check(font, text)) console.warn(`premium-3d : la police « ${font} » n'est pas disponible, sampleText utilise la police de secours.`);
  }
  const [c0, g0] = canvasOf(10, 10); g0.font = font; const m = g0.measureText(text);
  const size = parseFloat(font.match(/(\d+)px/)[1]);
  const w = Math.ceil(m.width + size * 0.2), h = Math.ceil(size * 1.3);
  const [, g] = canvasOf(w, h); g.font = font; g.fillStyle = "#fff"; g.textBaseline = "middle"; g.fillText(text, size * 0.1, h / 2);
  return fromPixels(g.getImageData(0, 0, w, h).data, w, h, count, width, { mode: "alpha", color, depth });
}
/** Surface d'un objet 3D (Mesh) → particules. */
export async function sampleMesh(mesh, { count = 20000, color = "#ffffff" } = {}) {
  const { MeshSurfaceSampler } = await import("three/addons/math/MeshSurfaceSampler.js");
  const s = new MeshSurfaceSampler(mesh).build(), p = new THREE.Vector3(), c = new THREE.Color(color);
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  mesh.updateMatrixWorld();
  for (let k = 0; k < count; k++) { s.sample(p); p.applyMatrix4(mesh.matrixWorld); p.toArray(positions, k * 3); c.toArray(colors, k * 3); }
  return { positions, colors };
}
/**
 * Forme sur mesure : ta propre fonction place chaque particule (une mèche, une vague, un plan, une
 * spirale…). fn(i, u, out) reçoit l'index, un nombre u entre 0 et 1 (i / count) et un objet out
 * à remplir : out.x, out.y, out.z, et out.color (hex ou THREE.Color, optionnel, sinon `color`).
 *   const vague = shape(N, (i, u, o) => { o.x = u * 6 - 3; o.y = Math.sin(u * 12) * 0.4; o.z = 0; });
 * Le résultat s'utilise comme les autres formes dans particleMorph. Garder le même ordre
 * d'indices entre deux formes proches (ex. une forme et sa version « coupée ») donne une
 * transition lisible : chaque particule va à l'endroit correspondant.
 */
export function shape(count, fn, { color = "#ffffff" } = {}) {
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const base = new THREE.Color(color), c = new THREE.Color(), o = { x: 0, y: 0, z: 0, color: null };
  for (let i = 0; i < count; i++) {
    o.x = o.y = o.z = 0; o.color = null;
    fn(i, i / count, o);
    positions[i * 3] = o.x; positions[i * 3 + 1] = o.y; positions[i * 3 + 2] = o.z;
    (o.color == null ? base : o.color.isColor ? o.color : c.set(o.color)).toArray(colors, i * 3);
  }
  return { positions, colors };
}

/** Nuage aléatoire (sphère ou boîte) : état « dispersé ». */
export function scatter(count, radius = 8, { color = "#ffffff", shape = "sphere" } = {}) {
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), c = new THREE.Color(color), v = new THREE.Vector3();
  for (let k = 0; k < count; k++) {
    if (shape === "sphere") v.randomDirection().multiplyScalar(radius * Math.cbrt(Math.random())); else v.set((Math.random() - 0.5) * radius * 2, (Math.random() - 0.5) * radius, (Math.random() - 0.5) * radius);
    v.toArray(positions, k * 3); c.toArray(colors, k * 3);
  }
  return { positions, colors };
}

/**
 * Morphing entre plusieurs formes (même nombre de particules partout).
 * @param states  tableau d'échantillons
 * @param size    taille des points en pixels CSS, vus à 10 unités de la caméra (identique sur tous les
 *                écrans : suit le pixel ratio réel du rendu, pas celui de l'appareil)
 * @param additive  mélange additif (lumineux sur fond sombre) ; false sur fond clair
 * @param turbulence  amplitude du flottement pendant la transition
 * @param solid     points pleins et nets, sans scintillement (par défaut : oui sur fond clair,
 *                  c'est-à-dire quand additive est false). Sur fond clair, des points flous et
 *                  semi-transparents paraissent pâles et clairsemés.
 */
export function particleMorph(states, { size = 3, additive = true, turbulence = 0.6, opacity = 1, solid = !additive } = {}) {
  if (states.some((s) => !s || typeof s.then === "function" || !s.positions))
    throw new Error("particleMorph : une forme n'est pas prête. sampleImage, sampleSVG, sampleText et sampleMesh sont asynchrones : écrire await devant.");
  const count = states[0].positions.length / 3;
  if (states.some((s) => s.positions.length !== count * 3))
    throw new Error("particleMorph : toutes les formes doivent avoir le même nombre de particules (même count).");
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(count); for (let i = 0; i < count; i++) seeds[i] = Math.random();
  geo.setAttribute("position", new THREE.BufferAttribute(states[0].positions.slice(), 3));
  geo.setAttribute("aA", new THREE.BufferAttribute(states[0].positions, 3));
  geo.setAttribute("aB", new THREE.BufferAttribute(states[Math.min(1, states.length - 1)].positions, 3));
  geo.setAttribute("cA", new THREE.BufferAttribute(states[0].colors, 3));
  geo.setAttribute("cB", new THREE.BufferAttribute(states[Math.min(1, states.length - 1)].colors, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uMix: { value: 0 }, uTime: { value: 0 }, uSize: { value: size }, uPR: { value: 1 }, uTurb: { value: turbulence }, uOpacity: { value: opacity } },
    vertexShader: `${NOISE}
      attribute vec3 aA,aB,cA,cB;attribute float aSeed;uniform float uMix,uTime,uSize,uPR,uTurb;varying vec3 vC;varying float vA;
      void main(){
        float d=aSeed*.35;float k=smoothstep(d,d+.65,uMix);
        vec3 p=mix(aA,aB,k);float mid=sin(k*3.14159);
        vec3 q=p*.35+vec3(uTime*.15,aSeed*10.,0.);
        p+=vec3(snoise(q),snoise(q+11.3),snoise(q+23.7))*uTurb*(mid*1.4+.06);
        vC=mix(cA,cB,k);vA=.75+.25*sin(uTime*2.+aSeed*40.);
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=uSize*uPR*(.6+aSeed*.8)*10./max(.1,-mv.z);
      }`,
    fragmentShader: `uniform float uOpacity;varying vec3 vC;varying float vA;
      void main(){vec2 c=gl_PointCoord-.5;float r=length(c);if(r>.5)discard;
        ${solid ? "float a=smoothstep(.5,.38,r);gl_FragColor=vec4(vC,a*uOpacity);" : "float a=smoothstep(.5,.0,r);gl_FragColor=vec4(vC,a*vA*uOpacity);"}
      #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geo, mat);
  /* le rendu tourne souvent sous la densité de l'écran (1 sur mobile, 1,25 sur ordinateur, adaptatif) :
     on suit son pixel ratio réel, sinon les points doublent ou triplent de taille sur un téléphone */
  points.onBeforeRender = (renderer) => { mat.uniforms.uPR.value = renderer.getPixelRatio(); };
  let cur = -1;
  return {
    points, material: mat,
    /** v entre 0 et states.length-1 : 1.5 = à mi-chemin entre la forme 1 et la forme 2 */
    set(v) {
      v = Math.max(0, Math.min(states.length - 1, v));
      const i = Math.min(states.length - 2, Math.floor(v));
      if (i !== cur && states.length > 1) {
        cur = i;
        geo.attributes.aA.array = states[i].positions; geo.attributes.aB.array = states[i + 1].positions;
        geo.attributes.cA.array = states[i].colors; geo.attributes.cB.array = states[i + 1].colors;
        ["aA", "aB", "cA", "cB"].forEach((k) => (geo.attributes[k].needsUpdate = true));
      }
      mat.uniforms.uMix.value = states.length > 1 ? v - i : 0;
    },
    update(t) { mat.uniforms.uTime.value = t; },
  };
}
