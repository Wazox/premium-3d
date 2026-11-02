/*
 * premium-3d / swarm.js
 * Nuée de vrais petits objets 3D (grains de café, pétales, pilules, pièces, briques, feuilles…) qui
 * prennent la forme d'un texte, d'un logo, d'une image ou d'une forme sur mesure, et passent de
 * l'une à l'autre. Comme particles.js, mais chaque point est un objet éclairé, avec son volume,
 * ses reflets et sa rotation : une matière, pas un nuage. Tout est calculé dans le shader
 * (InstancedMesh, un seul appel de dessin) : 3 000 à 8 000 objets restent fluides.
 *
 *   import { swarm } from "./lib/swarm.js";
 *   import { sampleText, scatter } from "./lib/particles.js";
 *   const N = { low: 1500, mid: 3000, high: 5000 }[stage.tier];
 *   const grain = new THREE.SphereGeometry(0.05, 12, 8).scale(1, 0.72, 0.62);   // un grain de café
 *   const s = swarm(grain, new THREE.MeshStandardMaterial({ color: "#3b2414", roughness: 0.45 }),
 *     [scatter(N, 6), await sampleText("CAFÉ", { count: N, width: 5 })], { spin: 1.2 });
 *   scene.add(s.mesh);
 *   s.set(P);           // 0 = forme 1, 1 = forme 2… (valeurs intermédiaires = vol de l'une à l'autre)
 *   s.update(t);        // rotation lente des objets (optionnel)
 *
 * Les formes sont celles de particles.js (sampleText, sampleSVG, sampleImage, sampleMesh, shape,
 * scatter) : même `count` pour toutes. Les couleurs des formes teintent chaque objet (`tint: true`).
 * Pas d'ombre portée (les objets bougent dans le shader) : poser un softGround sans ombre, ou rien.
 */
import * as THREE from "three";

/**
 * @param geometry  l'objet répété (petit : 1 à 3 % de la largeur de la forme)
 * @param material  MeshStandardMaterial ou MeshPhysicalMaterial (garde lumière et reflets)
 * @param states    formes (au moins une), toutes du même count
 * @param spin      rotation pendant le vol (tours) ; drift : rotation lente au repos (radians/s)
 * @param jitter    taille aléatoire (0 = tous pareils, 0.4 = de 60 % à 140 %)
 * @param arc       hauteur de la trajectoire en cloche pendant le vol (unités 3D)
 * @param tint      teinter chaque objet avec la couleur de la forme (sinon la couleur du matériau)
 */
export function swarm(geometry, material, states, { spin = 1, drift = 0.25, jitter = 0.35, arc = 0.6, tint = false } = {}) {
  if (!states.length || states.some((s) => !s || !s.positions)) throw new Error("swarm : une forme n'est pas prête (await devant sampleText, sampleSVG…).");
  const count = states[0].positions.length / 3;
  if (states.some((s) => s.positions.length !== count * 3)) throw new Error("swarm : toutes les formes doivent avoir le même count.");
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false; // les objets bougent dans le shader : la boîte englobante ne suit pas
  const g = mesh.geometry = geometry.clone();
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection();
    seed.set([v.x, v.y, v.z, 1 + (Math.random() * 2 - 1) * jitter], i * 4);
  }
  g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 4));
  const A = new THREE.InstancedBufferAttribute(states[0].positions, 3), B = new THREE.InstancedBufferAttribute(states[Math.min(1, states.length - 1)].positions, 3);
  g.setAttribute("aA", A); g.setAttribute("aB", B);
  const m4 = new THREE.Matrix4(); for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m4); // identité : tout se joue dans le shader
  if (tint) { const c = new THREE.Color(); for (let i = 0; i < count; i++) { c.fromArray(states[0].colors, i * 3); mesh.setColorAt(i, c); } }
  const u = { uMix: { value: 0 }, uTime: { value: 0 }, uSpin: { value: spin }, uDrift: { value: drift }, uArc: { value: arc } };
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
attribute vec3 aA, aB; attribute vec4 aSeed; uniform float uMix, uTime, uSpin, uDrift, uArc;
mat3 p3dRot(vec3 ax, float a){ ax = normalize(ax); float s = sin(a), c = cos(a), o = 1. - c;
  return mat3(o*ax.x*ax.x + c, o*ax.x*ax.y + ax.z*s, o*ax.z*ax.x - ax.y*s,
              o*ax.x*ax.y - ax.z*s, o*ax.y*ax.y + c, o*ax.y*ax.z + ax.x*s,
              o*ax.z*ax.x + ax.y*s, o*ax.y*ax.z - ax.x*s, o*ax.z*ax.z + c); }`)
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
float p3dD = (aSeed.x * .5 + .5) * .35, p3dK = smoothstep(p3dD, p3dD + .65, uMix), p3dMid = sin(p3dK * 3.14159);
mat3 p3dR = p3dRot(aSeed.xyz, aSeed.w * 6.2831 + p3dK * uSpin * 6.2831 + uTime * uDrift * (aSeed.y + .5));
objectNormal = p3dR * objectNormal;`)
      .replace("#include <begin_vertex>", `vec3 transformed = p3dR * position * aSeed.w + mix(aA, aB, p3dK)
  + vec3(aSeed.z, 1., aSeed.x) * p3dMid * uArc;`);
  };
  material.customProgramCacheKey = () => "p3d-swarm";
  let cur = -1, curTint = 0;
  return {
    mesh, uniforms: u,
    /** v entre 0 et states.length - 1 : 1.5 = à mi-vol entre la forme 1 et la forme 2 */
    set(v) {
      v = Math.max(0, Math.min(states.length - 1, v));
      const i = Math.min(states.length - 2, Math.floor(v));
      if (states.length > 1 && i !== cur) {
        cur = i; A.array = states[i].positions; B.array = states[i + 1].positions; A.needsUpdate = B.needsUpdate = true;
      }
      /* couleurs : celles de la forme la plus proche (changées une fois par passage, pas à chaque image) */
      const k = Math.round(v);
      if (tint && mesh.instanceColor && k !== curTint) { curTint = k; const c = new THREE.Color(); for (let j = 0; j < count; j++) { c.fromArray(states[k].colors, j * 3); mesh.setColorAt(j, c); } mesh.instanceColor.needsUpdate = true; }
      u.uMix.value = states.length > 1 ? v - i : 0;
    },
    update(t) { u.uTime.value = t; },
  };
}
