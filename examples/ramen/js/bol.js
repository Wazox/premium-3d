/*
 * Ramen Kōji : le bol et sa vapeur.
 * La vapeur qui monte du bouillon écrit les chiffres de la maison, au scroll :
 *   0 vapeur  ·  1 cadran de 24 h dont 18 traits allumés  ·  2 nouilles soulevées  ·  3 le comptoir et ses 24 tabourets
 */
import { createStage, scrollTrack, materials, fitZone, hdr, THREE } from "../../../plugins/premium-3d/skills/premium-3d/lib/core.js";
import { liquify } from "../../../plugins/premium-3d/skills/premium-3d/lib/shaders.js";
import { shape, particleMorph } from "../../../plugins/premium-3d/skills/premium-3d/lib/particles.js";
import { steps, captionSync } from "../../../plugins/premium-3d/skills/premium-3d/lib/story.js";
import { motionToggle } from "../../../plugins/premium-3d/skills/premium-3d/lib/interact.js";

const section = document.getElementById("bol");
const canvas = document.getElementById("gl");
const AMBER = "#f0a245", CREAM = "#f6e7d2", CHILI = "#d4472c";

const stage = createStage(canvas, { poster: innerWidth >= 860 ? "img/poster.jpg" : null, background: "#130d0a", accent: AMBER, accent2: "#ffd9a8", bloom: { strength: 0.6, radius: 0.55, threshold: 1.05 } });

if (stage) {
  const { scene, camera } = stage;
  const RIM = -1.25;                       // hauteur du bord du bol
  const BOWL_R = 1.55;

  /* ---------- le bol (tour de potier : LatheGeometry) ---------- */
  const prof = [];
  const outer = [[0.0, -2.35], [0.62, -2.35], [0.66, -2.22], [0.9, -2.12], [1.25, -1.86], [1.47, -1.55], [BOWL_R, RIM]];
  const inner = [[1.47, RIM], [1.38, -1.55], [1.15, -1.84], [0.8, -2.04], [0.0, -2.1]];
  outer.forEach(([x, y]) => prof.push(new THREE.Vector2(x, y)));
  inner.forEach(([x, y]) => prof.push(new THREE.Vector2(x, y)));
  const bowlGeo = new THREE.LatheGeometry(prof, 96);
  bowlGeo.computeVertexNormals();
  const glaze = materials.enamel({ color: "#1b1715" });
  glaze.side = THREE.DoubleSide;
  const bowl = new THREE.Mesh(bowlGeo, glaze);
  scene.add(bowl);
  /* liseré rouge piment sous le bord, comme un bol de comptoir */
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.028, 12, 160), materials.enamel({ color: CHILI }));
  band.rotation.x = Math.PI / 2; band.position.y = RIM - 0.12; band.scale.set(1.0, 1.0, 1);
  scene.add(band);

  /* ---------- le bouillon : surface qui frémit ---------- */
  const brothMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#b8641f"), roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.4, sheenColor: new THREE.Color("#ffcf8a") });
  const simmer = liquify(brothMat, { amp: 0.035, freq: 2.2, speed: 0.5 });
  // disque subdivisé (polarDisc, plus bas) : liquify a besoin de beaucoup de sommets pour onduler
  const broth = new THREE.Mesh(polarDisc(1.43, 40, 120), brothMat);
  broth.rotation.x = -Math.PI / 2; broth.position.y = RIM - 0.17;
  scene.add(broth);
  /* gouttes de gras qui brillent à la surface */
  const fat = new THREE.Group();
  const fatMat = new THREE.MeshBasicMaterial({ color: hdr("#ffcf7a", 1.9) });
  const fatGeo = new THREE.CircleGeometry(1, 20);
  for (let i = 0; i < 22; i++) {
    const a = i * 2.39996, r = 0.25 + Math.sqrt(i / 22) * 0.95, s = 0.03 + ((i * 37) % 7) / 140;
    const m = new THREE.Mesh(fatGeo, fatMat); m.scale.setScalar(s);
    m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.03); fat.add(m);
  }
  broth.add(fat);

  /* ---------- garniture : œuf mariné, chashu, nori, ciboule ---------- */
  const top = new THREE.Group(); top.position.y = RIM - 0.15; scene.add(top);
  const eggW = materials.soft({ color: "#f4ead8", rough: 0.35 });
  const yolk = new THREE.MeshPhysicalMaterial({ color: "#e88a1a", roughness: 0.25, clearcoat: 0.8 });
  const half = new THREE.SphereGeometry(0.26, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  [[-0.62, 0.18, 0.4], [-0.3, 0.42, -0.5]].forEach(([x, z, r]) => {
    const e = new THREE.Group(); e.position.set(x, 0, z); e.rotation.set(0.25, r, 0);
    const w = new THREE.Mesh(half, eggW); w.scale.set(1, 0.55, 1.25); w.rotation.x = -Math.PI / 2; e.add(w);
    const cut = new THREE.Mesh(new THREE.CircleGeometry(0.255, 32), eggW); cut.scale.set(1, 1.25, 1); e.add(cut);
    const y = new THREE.Mesh(new THREE.CircleGeometry(0.13, 28), yolk); y.position.z = 0.004; y.scale.set(1, 1.2, 1); e.add(y);
    e.rotation.x = -1.2; top.add(e);
  });
  const pork = materials.soft({ color: "#b0704a", rough: 0.5 });
  const porkRim = materials.soft({ color: "#6e3a22", rough: 0.6 });
  [[0.55, -0.35, 0.3], [0.8, 0.05, -0.2]].forEach(([x, z, r]) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 40), [porkRim, pork, pork]);
    c.position.set(x, 0.02, z); c.rotation.set(0.15, r, -0.12); top.add(c);
  });
  const nori = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.015), materials.soft({ color: "#18241a", rough: 0.8 }));
  nori.position.set(0.15, 0.32, -1.05); nori.rotation.set(-0.35, 0.1, 0.05); top.add(nori);
  const scallion = materials.soft({ color: "#7fb34a", rough: 0.45 });
  const ring = new THREE.TorusGeometry(0.035, 0.012, 6, 14);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996, r = 0.15 + ((i * 53) % 17) / 17 * 0.45;
    const m = new THREE.Mesh(ring, scallion); m.position.set(Math.cos(a) * r + 0.05, 0.03, Math.sin(a) * r + 0.1); m.rotation.x = Math.PI / 2 + (i % 3) * 0.2; top.add(m);
  }

  /* ---------- baguettes posées en travers ---------- */
  const wood = materials.soft({ color: "#c79a62", rough: 0.6 });
  const stickGeo = new THREE.CylinderGeometry(0.028, 0.045, 3.9, 16);
  const sticks = new THREE.Group();
  [-0.09, 0.09].forEach((dz, i) => {
    const s = new THREE.Mesh(stickGeo, wood);
    s.rotation.z = Math.PI / 2 + (i ? 0.05 : -0.02); s.rotation.y = 0.5 + i * 0.04;
    s.position.set(0.35, RIM + 0.05, 0.25 + dz); sticks.add(s);
  });
  scene.add(sticks);

  /* ---------- la vapeur qui écrit ---------- */
  const N = { low: 9000, mid: 13000, high: 18000 }[stage.tier];
  const TOP = RIM + 0.15;           // la vapeur part juste au-dessus du bouillon
  const CY = 0.75;                  // centre des figures

  // 0. vapeur : sept fils qui montent en ondulant et se dissipent
  const steam = shape(N, (i, u, o) => {
    const f = i % 7, h = Math.pow(Math.random(), 0.8);       // h : 0 au bouillon, 1 en haut
    const x0 = (f - 3) * 0.32 + Math.sin(f * 7.1) * 0.08;
    const sway = Math.sin(h * 5.2 + f * 1.7) * (0.12 + h * 0.42);
    const spread = 0.04 + h * 0.22;
    o.x = x0 * (1 - h * 0.35) + sway + (Math.random() - 0.5) * spread;
    o.y = TOP + h * 3.3;
    o.z = (Math.random() - 0.5) * (0.2 + h * 0.6);
    const k = (1 - h) * 0.85 + 0.15;
    o.color = new THREE.Color(CREAM).multiplyScalar(0.55 * k);
  });

  // 1. cadran : 24 traits, les 18 premiers allumés (18 h de cuisson sur 24)
  const R0 = 1.18, R1 = 1.62;
  const dial = shape(N, (i, u, o) => {
    const t = i % 24, lit = t < 18;
    const a = Math.PI / 2 - (t / 24) * Math.PI * 2;
    const len = lit ? 1 : 0.55;
    const r = R1 - Math.random() * (R1 - R0) * len;
    const w = (Math.random() - 0.5) * 0.07;
    o.x = Math.cos(a) * r - Math.sin(a) * w;
    o.y = CY + Math.sin(a) * r + Math.cos(a) * w;
    o.z = (Math.random() - 0.5) * 0.12;
    o.color = lit ? hdr(AMBER, 0.55 + (t / 18) * 0.6) : new THREE.Color("#5a4232").multiplyScalar(0.7);
  });

  // 2. nouilles : des brins soulevés hors du bol, qui ondulent et retombent dans le bouillon
  const NOODLES = 9;
  const noodles = shape(N, (i, u, o) => {
    const f = i % NOODLES, h = Math.random();                  // h : 0 dans le bol, 1 en haut
    const x0 = (f - (NOODLES - 1) / 2) * 0.13;
    const fan = (f - (NOODLES - 1) / 2) * 0.09 * (1 - h);
    o.x = x0 + fan + Math.sin(h * 26 + f * 1.3) * 0.075 + (Math.random() - 0.5) * 0.03;
    o.y = TOP - 0.1 + h * 3.25;
    o.z = Math.cos(h * 26 + f * 1.3) * 0.06 + (f % 3 - 1) * 0.05;
    o.color = new THREE.Color("#f3c66f").multiplyScalar(0.55 + 0.25 * Math.sin(f * 2.1) ** 2);
  });

  // 3. le comptoir en U vu d'en haut, et ses 24 tabourets (8 de chaque côté)
  const CW = 2.7, CH = 2.2, CB = -0.02;            // le U est posé au-dessus du bol : la rangée du bas ne touche pas le bord
  const seats = [];
  for (let k = 0; k < 8; k++) seats.push([-CW / 2 - 0.38, CB + 0.2 + (k + 0.5) * (CH - 0.2) / 8]);
  for (let k = 0; k < 8; k++) seats.push([-CW / 2 + 0.2 + (k + 0.5) * (CW - 0.4) / 8, CB - 0.38]);
  for (let k = 0; k < 8; k++) seats.push([CW / 2 + 0.38, CB + 0.2 + (k + 0.5) * (CH - 0.2) / 8]);
  const counter = shape(N, (i, u, o) => {
    if (i % 10 < 7) {                                          // 70 % : les tabourets (anneaux)
      const s = seats[i % 24], a = Math.random() * Math.PI * 2, r = 0.1 + (Math.random() - 0.5) * 0.035;
      o.x = s[0] + Math.cos(a) * r; o.y = s[1] + Math.sin(a) * r; o.z = (Math.random() - 0.5) * 0.06;
      o.color = hdr(AMBER, 1.25);
    } else {                                                   // 30 % : le comptoir en U
      const L = CH * 2 + CW, d = Math.random() * L, th = (Math.random() - 0.5) * 0.12;
      if (d < CH) { o.x = -CW / 2 + th; o.y = CB + CH - d; }
      else if (d < CH + CW) { o.x = -CW / 2 + (d - CH); o.y = CB + th; }
      else { o.x = CW / 2 + th; o.y = CB + (d - CH - CW); }
      o.z = (Math.random() - 0.5) * 0.08;
      o.color = new THREE.Color("#a77a4f").multiplyScalar(0.55);
    }
  });

  const pm = particleMorph([steam, dial, noodles, counter], { size: 2.4, turbulence: 0.55 });
  scene.add(pm.points);

  /* ---------- lumière chaude du comptoir ---------- */
  const key = new THREE.PointLight("#ffb766", 18, 9, 1.6); key.position.set(-1.5, 2.2, 2.5); scene.add(key);
  scene.add(new THREE.HemisphereLight("#ffe2bf", "#1a0f0a", 0.35));
  const rim = new THREE.DirectionalLight("#ffc98a", 1.4); rim.position.set(3, -0.5, -2.5); scene.add(rim);   // contre-jour : galbe du bol lisible

  /* ---------- cadrage : 3D à droite sur ordinateur, en haut sur mobile ---------- */
  const W = 4.4, H = 5.0;            // le bol + la plus haute figure, avec les tabourets
  const groupY = -0.1;               // centre vertical de l'ensemble
  [bowl, band, broth, top, sticks, pm.points].forEach((o) => (o.position.y += -groupY));
  stage.onResize((w) => {
    const zone = w < 860 ? { top: 0.08, bottom: 0.6 } : { left: 0.44, right: 0.98, top: 0.04, bottom: 0.98 };
    const d = fitZone(camera, W, H, zone);
    camera.position.set(0, d * 0.2, d);
    camera.lookAt(0, 0, 0);
  });

  /* ---------- récit ---------- */
  const caps = captionSync(document.querySelectorAll(".cap"));
  const hint = document.querySelector(".hint");
  const track = scrollTrack(section);
  let P = 0, hintOn = true;

  /* bouton pause : fige la vapeur et le bouillon, le scroll continue de raconter */
  motionToggle(stage, document.querySelector(".pause"));

  await stage.warm();
  stage.start((dt, t, real) => {
    P += (track.progress() - P) * (stage.reduce ? 1 : 1 - Math.pow(0.0005, real));
    const T = t;
    const v = steps(P, 4, 0.5);
    pm.set(v);
    pm.update(T);
    caps.show(Math.round(v));
    /* la vapeur dérive doucement, les figures restent face au visiteur */
    const idle = 1 - Math.min(1, v);
    pm.points.rotation.y = Math.sin(T * 0.35) * 0.12 * idle;
    pm.points.position.x = Math.sin(T * 0.5) * 0.04 * idle;
    simmer.uTime.value = T;
    fat.rotation.z = T * 0.05;
    const on = P < 0.04;
    if (on !== hintOn) { hintOn = on; hint.style.opacity = on ? "1" : "0"; }
  });
  window.__demo = { get ready() { return stage.ready; } };
}

/* disque subdivisé en anneaux (pour que liquify ait assez de sommets) */
function polarDisc(r, rings, seg) {
  const pos = [], idx = [], uv = [];
  pos.push(0, 0, 0); uv.push(0.5, 0.5);
  for (let i = 1; i <= rings; i++) for (let j = 0; j < seg; j++) {
    const rr = (i / rings) * r, a = (j / seg) * Math.PI * 2;
    pos.push(Math.cos(a) * rr, Math.sin(a) * rr, 0); uv.push(0.5 + Math.cos(a) * rr / (2 * r), 0.5 + Math.sin(a) * rr / (2 * r));
  }
  const at = (i, j) => 1 + (i - 1) * seg + (j % seg);
  for (let j = 0; j < seg; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let i = 1; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j), d = at(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(0).flatMap(() => [0, 0, 1]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
