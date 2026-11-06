/*
 * premium-3d / props.js
 * Objets du métier RÉGLABLES, qui passent le test de la silhouette (references/modeling.md) :
 * les objets ratés le plus souvent au banc d'essai (pain « galet », flacon « en plastique », jante,
 * fleur) avec leurs vrais détails : paroi épaisse, pipette, étiquette, grigne qui s'ouvre, écrous,
 * pétales qui éclosent.
 *
 * Ce ne sont PAS des scènes, ni un style : des pièces détachées. Couleurs, matières, proportions,
 * nombre de branches, de pétales ou de grignes se règlent pour CETTE marque, et la scène qui les met
 * en mouvement reste à inventer. Un objet absent d'ici se construit avec lib/forms.js.
 *
 *   import { serumBottle, wineBottle, cup, bread, wheel, flower } from "./lib/props.js";
 *   const f = serumBottle({ tint: "#c9862b", liquid: "#e0a43a" });
 *   scene.add(f.group);
 *   f.fill(0.7);                       // niveau du liquide (0 → 1), sans rien recréer
 *   f.parts.dropper.position.y = 0.4;  // la pipette se soulève (pièces nommées dans parts)
 *
 * Chaque fonction renvoie { group, parts, … } : group est posé au sol (y = 0) et centré en x / z ;
 * group.userData.size = { w, h, d } (pour fitZone ou fitDistance). Ombres déjà activées.
 */
import * as THREE from "three";
import { materials } from "./core.js";
import { lathe, liquid, organic, deform, tint } from "./forms.js";

const shadow = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const done = (group, parts, extra = {}) => {
  shadow(group);
  const b = new THREE.Box3().setFromObject(group), s = b.getSize(new THREE.Vector3());
  group.userData.size = { w: s.x, h: s.y, d: s.z };
  return { group, parts, ...extra };
};
const scaleProfile = (p, h) => p.map(([r, y]) => [r * h, y * h]);

/* ---------------------------------------------------------------------------------------------- */
/**
 * Flacon de sérum à pipette (30 ml) : verre teinté épais, liquide, bague, poire en caoutchouc,
 * tube de verre qui plonge dans le liquide.
 *   height  hauteur du verre (la pipette dépasse d'environ 35 %) · tint : teinte du verre (claire !)
 *   dist    distance d'atténuation : plus court = verre plus foncé (0,8 à 1,5)
 *   liquid  couleur du liquide (null : flacon vide) · level : niveau de départ
 *   collar, bulb  couleurs de la bague et de la poire · collarMetal : bague métallique (or, argent)
 * parts : glass, liquid, dropper (groupe : collar + bulb + tube, à soulever), label (null).
 */
export function serumBottle({ height = 1, tint: glassTint = "#d68a2e", dist = 0.7, liquid: liquidColor = "#b8701c", level = 0.7,
  collar = "#d8b46a", collarMetal = true, bulb = "#1c1a19", label = null } = {}) {
  const h = height, T = 0.03 * h;
  /* 30 ml : diamètre ≈ 0,55 × la hauteur du verre ; avec la pipette, rapport hauteur / diamètre ≈ 2,5 */
  const prof = scaleProfile([[0, 0], [0.245, 0], [0.27, 0.035], [0.27, 0.74], [0.24, 0.86], [0.13, 0.93], [0.11, 0.96], [0.11, 1]], h);
  const group = new THREE.Group(), parts = {};
  parts.glass = new THREE.Mesh(lathe(prof, { thickness: T }), materials.glass({ tint: glassTint, dist: dist * h, irid: 0.08, thick: 0.4 * h }));
  group.add(parts.glass);
  let fill = () => {};
  if (liquidColor) {
    const l = liquid(prof, { thickness: T, to: 0.84 * h, material: new THREE.MeshPhysicalMaterial({ color: liquidColor, roughness: 0.06, clearcoat: 1 }) });
    parts.glass.add(l.mesh); parts.liquid = l.mesh; l.set(level); fill = l.set;
  }
  if (label) {
    /* étiquette : bande de papier qui épouse le verre (un peu plus large que lui), pas un aplat posé devant */
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.279 * h, 0.279 * h, 0.3 * h, 96, 1, true, -Math.PI * 0.42, Math.PI * 0.84), // hors du verre (sinon teintée par lui)
      new THREE.MeshPhysicalMaterial({ color: label, roughness: 0.75, side: THREE.DoubleSide }));
    lab.position.y = 0.4 * h; group.add(lab); parts.label = lab;
  } else parts.label = null;
  /* pipette : bague vissée, poire souple (resserrée en bas, nervures), tube qui plonge */
  const dropper = new THREE.Group(); dropper.position.y = 0.94 * h;
  const ring = new THREE.Mesh(lathe(scaleProfile([[0, 0], [0.14, 0], [0.145, 0.01], [0.145, 0.11], [0.13, 0.125], [0.07, 0.13], [0, 0.13]], h), { smooth: 3 }),
    collarMetal ? materials.metal({ color: collar, rough: 0.28 }) : materials.soft({ color: collar, rough: 0.4 }));
  const bulbGeo = lathe(scaleProfile([[0, 0], [0.085, 0], [0.09, 0.03], [0.07, 0.07], [0.085, 0.14], [0.1, 0.24], [0.085, 0.31], [0.04, 0.345], [0, 0.35]], h), { smooth: 8, segments: 64 });
  const bulbMesh = new THREE.Mesh(deform(bulbGeo, (p) => { const a = Math.atan2(p.z, p.x); const k = 1 + 0.025 * Math.cos(a * 12) * Math.max(0, Math.sin(((p.y / h - 0.07) / 0.24) * Math.PI)); p.x *= k; p.z *= k; }),
    new THREE.MeshPhysicalMaterial({ color: bulb, roughness: 0.55, sheen: 0.4, sheenRoughness: 0.5, clearcoat: 0.15 }));
  bulbMesh.position.y = 0.125 * h;
  const tube = new THREE.Mesh(lathe(scaleProfile([[0, -0.86], [0.012, -0.86], [0.022, -0.83], [0.026, -0.7], [0.026, 0.02], [0, 0.02]], h), { smooth: 2, segments: 24 }),
    new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.1, transparent: true, opacity: 0.35, clearcoat: 1 })); // transparent (pas transmission) : visible à travers le flacon
  dropper.add(ring, bulbMesh, tube); group.add(dropper); parts.dropper = dropper;
  return done(group, parts, { fill });
}

/* ---------------------------------------------------------------------------------------------- */
/**
 * Bouteille de vin (75 cl) : épaule marquée, col, bague, piqûre au fond, étiquette, capsule.
 *   tint  verre (vert bouteille, ambré, extra-blanc « #f2f4ef ») · dist : plus court = plus sombre
 *   shoulder  "bordeaux" (épaule franche) ou "bourgogne" (épaule douce et basse)
 *   label, capsule  couleurs (null : sans) · wine : couleur du vin (null : vide)
 */
export function wineBottle({ height = 1.5, shoulder = "bordeaux", tint: glassTint = "#3f6b3a", dist = 0.35, label = "#f3ece0", capsule = "#5a1620", wine = "#3a0a12" } = {}) {
  const h = height;
  /* vraies mesures (75 cl, 30 cm) : bordelaise Ø 7,5 cm, épaule à 60 %, col Ø 2,9 cm sur le tiers haut ;
     bourguignonne Ø 8,2 cm, épaule longue qui commence à 45 % ; piqûre au fond, bague en haut */
  const P = shoulder === "bourgogne"
    ? [[0, 0.03], [0.04, 0.02], [0.12, 0.004], [0.134, 0], [0.137, 0.015], [0.137, 0.45], [0.12, 0.58], [0.08, 0.68], [0.052, 0.74], [0.048, 0.94], [0.054, 0.95], [0.054, 0.975], [0.048, 0.985]]
    : [[0, 0.03], [0.04, 0.02], [0.11, 0.004], [0.122, 0], [0.125, 0.015], [0.125, 0.6], [0.115, 0.645], [0.075, 0.69], [0.05, 0.72], [0.046, 0.94], [0.052, 0.95], [0.052, 0.975], [0.046, 0.985]];
  const R = (shoulder === "bourgogne" ? 0.137 : 0.125) * h;
  const prof = scaleProfile(P, h), T = 0.012 * h, group = new THREE.Group(), parts = {};
  parts.glass = new THREE.Mesh(lathe(prof, { thickness: T, smooth: 6 }), materials.glass({ tint: glassTint, dist: dist * h, irid: 0, thick: 0.2 * h, disp: 2 }));
  group.add(parts.glass);
  let fill = () => {};
  if (wine) { const l = liquid(prof, { thickness: T, smooth: 6, from: 0.04 * h, to: 0.8 * h, material: new THREE.MeshPhysicalMaterial({ color: wine, roughness: 0.05, clearcoat: 1 }) }); parts.glass.add(l.mesh); l.set(0.92); fill = l.set; parts.wine = l.mesh; }
  if (label) {
    const r = R + 0.011 * h; // le profil lissé déborde un peu : l'étiquette doit rester HORS du verre (sinon teintée par lui)
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.22 * h, 128, 1, true, -Math.PI * 0.45, Math.PI * 0.9), new THREE.MeshPhysicalMaterial({ color: label, roughness: 0.8, side: THREE.DoubleSide }));
    lab.position.y = 0.3 * h; group.add(lab); parts.label = lab;
  }
  if (capsule) {
    const cap = new THREE.Mesh(lathe(scaleProfile([[0.05, 0.84], [0.056, 0.85], [0.057, 0.985], [0.052, 0.995], [0, 0.998]], h), { smooth: 2, segments: 64 }), materials.metal({ color: capsule, rough: 0.35, env: 1 }));
    group.add(cap); parts.capsule = cap;
  }
  return done(group, parts, { fill });
}

/* ---------------------------------------------------------------------------------------------- */
/**
 * Tasse (et soucoupe) en céramique émaillée, anse pleine, café dedans.
 *   size  diamètre de la tasse · color : émail · coffee : couleur du café (null : vide)
 *   saucer  avec soucoupe · handmade : irrégularité de céramique tournée (0 = industrielle)
 * parts : cup, handle, coffee, saucer.
 */
export function cup({ size = 0.8, color = "#f4efe6", coffee = "#2b170c", crema = "#a8703c", saucer = true, handmade = 0.006, seed = 2 } = {}) {
  const s = size / 0.88, group = new THREE.Group(), parts = {};
  const prof = scaleProfile([[0, 0], [0.26, 0], [0.3, 0.025], [0.36, 0.3], [0.41, 0.62], [0.44, 0.78]], s);
  const enamel = materials.enamel({ color });
  let g = lathe(prof, { thickness: 0.035 * s });
  if (handmade > 0) g = organic(g, { amp: handmade * s, freq: 3 / s, octaves: 2, seed });
  parts.cup = new THREE.Mesh(g, enamel);
  const body = new THREE.Group(); body.add(parts.cup); group.add(body);
  /* anse : boucle en « D », section ovale, collée à la paroi en deux points */
  const curve = new THREE.CatmullRomCurve3([[0.39, 0.62], [0.55, 0.66], [0.64, 0.52], [0.6, 0.3], [0.47, 0.2], [0.33, 0.22]].map(([x, y]) => new THREE.Vector3(x * s, y * s, 0)));
  const hg = new THREE.TubeGeometry(curve, 48, 0.034 * s, 16, false); hg.scale(1, 1, 1.35);
  parts.handle = new THREE.Mesh(hg, enamel); body.add(parts.handle);
  if (coffee) {
    const l = liquid(prof, { thickness: 0.035 * s, to: 0.66 * s, material: new THREE.MeshPhysicalMaterial({ color: coffee, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }) });
    /* crème : couronne plus claire au bord de la surface */
    const capMat = l.mesh.children[1].material, uCrema = { value: new THREE.Color(crema) };
    capMat.onBeforeCompile = (sh) => {
      sh.uniforms.uCrema = uCrema; // uniforme : deux tasses = deux crèmes (le programme compilé est partagé)
      sh.vertexShader = sh.vertexShader.replace("void main() {", "varying float vCremaR;\nvoid main() {\n vCremaR = length(position.xz);");
      sh.fragmentShader = sh.fragmentShader.replace("void main() {", "uniform vec3 uCrema;\nvarying float vCremaR;\nvoid main() {")
        .replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, uCrema, smoothstep(.55, .98, vCremaR) * .85);");
    };
    parts.cup.add(l.mesh); l.set(1); parts.coffee = l.mesh;
  }
  if (saucer) {
    const sp = scaleProfile([[0, 0], [0.26, 0], [0.28, 0.012], [0.3, 0.035], [0.34, 0.04], [0.62, 0.075], [0.75, 0.12], [0.76, 0.135], [0.74, 0.14], [0.6, 0.1], [0.34, 0.065], [0.3, 0.06], [0, 0.06]], s);
    parts.saucer = new THREE.Mesh(lathe(sp, { smooth: 4 }), enamel); group.add(parts.saucer);
    body.position.y = 0.06 * s;
  }
  return done(group, parts);
}

/* ---------------------------------------------------------------------------------------------- */
/**
 * Pain au levain : boule ou bâtard, croûte peinte (dorée en haut, plus claire en bas), grignes en
 * relief dont la mie claire ressort, farine sur le dessus. Le défaut n° 1 du banc (« galet d'argile »).
 *   kind  "boule" | "batard" · scores : nombre de grignes (1 à 4) · ear : hauteur des lèvres de grigne
 *   crust, crumb : croûte et mie · flour : farine (0 → 1) · size : diamètre (boule) ou longueur (bâtard)
 * bake(k) : 0 = pâte crue (pâle, grignes fermées) → 1 = cuit, dans la boucle sans rien recréer.
 */
export function bread({ kind = "boule", size = 1.4, scores = kind === "batard" ? 3 : 1, ear = 0.07, crust = "#6f3a16", crumb = "#ecd3a2", flour = 0.3, seed = 4 } = {}) {
  const long = kind === "batard", R = size / 2, group = new THREE.Group(), parts = {};
  /* lignes de grigne sur le dessus, en coordonnées (x, z) de la sphère unité étirée */
  const lines = [];
  if (long) for (let i = 0; i < scores; i++) { const c = (i - (scores - 1) / 2) * (1.5 / Math.max(1, scores)); lines.push([[c - 0.3, -0.16], [c + 0.3, 0.16]]); }
  else if (scores === 1) lines.push([[-0.55, -0.12], [0.55, 0.12]]);
  else for (let i = 0; i < scores; i++) { const a = (i / scores) * Math.PI; lines.push([[Math.cos(a) * -0.6, Math.sin(a) * -0.6], [Math.cos(a) * 0.6, Math.sin(a) * 0.6]]); }
  const segDist = (x, z, [[ax, az], [bx, bz]]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); const px = ax + t * dx - x, pz = az + t * dz - z; return [Math.hypot(px, pz), t, Math.sign(-(dz * (x - ax)) + dx * (z - az))]; };
  const W = 0.13; // demi-largeur d'une grigne (sphère unité)
  /* grigne légèrement courbe (un coup de lame n'est jamais droit) */
  const scoreAt = (x, z) => { x /= long ? 1.6 : 1; z -= 0.09 * Math.cos(x * 1.6); let best = [9, 0, 0]; for (const l of lines) { const d = segDist(x, z, l); if (d[0] < best[0]) best = d; } return best; };
  /* bruit de valeur 2D (farine en nappes, pas en grille) */
  const hash = (x, z) => { let n = (x * 374761393 + z * 668265263 + seed * 144269) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const vn = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), u = x - xi, v = z - zi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = hash(xi, zi), b = hash(xi + 1, zi), c0 = hash(xi, zi + 1), d0 = hash(xi + 1, zi + 1); return a + (b - a) * su + (c0 - a) * sv + (a - b - c0 + d0) * su * sv; };
  const fbm = (x, z) => 0.55 * vn(x, z) + 0.3 * vn(x * 2.3 + 7, z * 2.3 - 3) + 0.15 * vn(x * 5.1 - 11, z * 5.1 + 5);
  const geo0 = new THREE.SphereGeometry(1, long ? 192 : 160, 112);
  const base = deform(geo0, (p) => {
    const top = Math.max(0, p.y);
    const [d, t, side] = scoreAt(p.x * (long ? 1.6 : 1), p.z);
    /* entaille : creux net au centre, une lèvre (l'« oreille ») soulevée d'un seul côté, fondue vers les bouts */
    const along = Math.pow(Math.sin(Math.PI * t), 0.6), k = top > 0.3 ? Math.max(0, 1 - d / W) * along : 0;
    p.y -= k * k * 0.3 * top;
    if (side > 0 && top > 0.3) p.y += Math.max(0, 1 - Math.abs(d - W) / (W * 0.7)) * along * ear * 2.2 * top;
    if (long) p.x *= 1.6;
    p.y = p.y > 0 ? p.y * 0.6 : Math.max(p.y * 0.35, -0.16); // dôme bas, base plate et un peu évasée
  });
  const g = organic(base, { amp: 0.025, freq: 2.4, octaves: 3, seed });
  g.scale(R, R, R); g.translate(0, 0.16 * R, 0);
  const cr = new THREE.Color(crust), cm = new THREE.Color(crumb), pale = new THREE.Color("#c99556"), dark = new THREE.Color(crust).multiplyScalar(0.55), white = new THREE.Color("#f4efe4");
  /* deux jeux de couleurs (cru / cuit) : bake(k) mélange dans le shader, sans recalcul */
  const rawCols = [];
  const c = new THREE.Color(), c2 = new THREE.Color();
  tint(g, (p) => {
    const u = p.x / R / (long ? 1.6 : 1), w = p.z / R, hgt = (p.y / R - 0.16) / 0.6;
    const [d] = scoreAt(u * (long ? 1.6 : 1), w), up = hgt > 0.4;
    const inScore = up ? Math.max(0, 1 - d / (W * 0.65)) : 0;                       // mie claire au fond de la grigne
    const lip = up ? Math.max(0, 1 - Math.abs(d - W * 0.85) / (W * 0.35)) : 0;       // bord caramélisé
    c.copy(pale).lerp(cr, Math.min(1, Math.max(0, hgt * 1.4 + (fbm(u * 9 + 3, w * 9) - 0.5) * 0.5))); // plus cuit en haut, cuisson inégale
    if (hgt < 0.08) c.lerp(pale, 0.45);                                               // dessous moins cuit
    c.lerp(dark, lip * 0.6).lerp(cm, Math.pow(inScore, 0.7));
    const f = flour * Math.max(0, Math.min(1, (fbm(u * 4, w * 4) - 0.52) * 4)) * Math.min(1, Math.max(0, (hgt - 0.35) * 3)) * (1 - inScore) * (1 - lip);
    c.lerp(white, f * 0.9);
    c2.set("#e8d6b2").lerp(white, f * 0.7); rawCols.push(c2.r, c2.g, c2.b);
    return c;
  });
  g.setAttribute("colorRaw", new THREE.Float32BufferAttribute(rawCols, 3));
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.85, specularIntensity: 0.35, sheen: 0.18, sheenColor: new THREE.Color("#fff1d8"), sheenRoughness: 0.7 });
  const uBake = { value: 1 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBake = uBake;
    sh.vertexShader = sh.vertexShader.replace("#include <color_vertex>", "#include <color_vertex>\n vColor.rgb = mix(colorRaw, vColor.rgb, uBake);") // vColor : vec3 ou vec4 selon la version
      .replace("void main() {", "attribute vec3 colorRaw;\nuniform float uBake;\nvoid main() {");
  };
  parts.loaf = new THREE.Mesh(g, mat); group.add(parts.loaf);
  return done(group, parts, { bake(k) { uBake.value = Math.min(1, Math.max(0, k)); parts.loaf.scale.set(1, 0.82 + 0.18 * uBake.value, 1); } });
}

/* ---------------------------------------------------------------------------------------------- */
/**
 * Roue de voiture vue de face : pneu (flanc arrondi, sculptures), jante à branches, écrous, cache-moyeu,
 * disque de frein et étrier derrière. Face plate en métal : créer la scène avec createStage({ front: 1 }).
 *   diameter · spokes : branches (5 à 10) · split : branches doubles · nuts : écrous (4 à 6)
 *   rim, tire, caliper : couleurs · rimRough : 0,15 chrome poli → 0,45 alu brossé
 * parts : tire, rim, nuts (tableau, pour un serrage en étoile), cap, disc, caliper.
 * La roue est dans le plan XY (face vers +z), posée sur y = 0.
 */
export function wheel({ diameter = 1.6, spokes = 5, split = false, nuts = 5, rim = "#c9ccd2", rimRough = 0.22, tire = "#161616", caliper = "#c8102e", disc = true } = {}) {
  const S = diameter / 2, group = new THREE.Group(), axle = new THREE.Group(), parts = {};
  axle.position.y = S; group.add(axle);
  const rimR = 0.68 * S, depth = 0.5 * S;
  /* pneu : profil de flanc arrondi tourné autour de l'axe Z (lathe autour de Y puis basculé) */
  const tp = []; for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (i / 24) * Math.PI; tp.push([rimR + 0.02 * S + (S - rimR - 0.02 * S) * (0.55 + 0.45 * Math.cos(a)) , (Math.sin(a) * depth) / 2 + depth / 2]); }
  const tireIn = [[rimR - 0.01 * S, depth * 0.02], ...tp, [rimR - 0.01 * S, depth * 0.98]]; // du bas vers le haut : normales vers l'extérieur
  let tg = new THREE.LatheGeometry(tireIn.map(([r, y]) => new THREE.Vector2(r, y)), 160);
  tg = deform(tg, (p) => { const r = Math.hypot(p.x, p.z); if (r > S * 0.93) { const a = Math.atan2(p.z, p.x); const groove = Math.cos(a * 48) > 0.55 ? 0.012 * S : 0; const k = (r - groove) / r; p.x *= k; p.z *= k; } });
  tg.rotateX(Math.PI / 2); tg.translate(0, 0, -depth / 2 + depth * 0.02);
  parts.tire = new THREE.Mesh(tg, new THREE.MeshPhysicalMaterial({ color: tire, roughness: 0.78, sheen: 0.3, sheenColor: new THREE.Color("#3a3a3a") }));
  /* jante : face extrudée avec ses ouvertures entre les branches, biseautée */
  const face = new THREE.Shape(); face.absarc(0, 0, rimR, 0, Math.PI * 2, false);
  const n = spokes, hub = 0.28 * S, spokeW = (split ? 0.07 : 0.11) * S;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const ri = hub + 0.04 * S, ro = rimR - 0.06 * S;
    const ang = (r) => Math.asin(Math.min(0.95, (spokeW / 2 + (split ? spokeW * 0.6 : 0)) / r));
    const h = new THREE.Path(); const steps = 20;
    const s0 = a0 + ang(ro), e0 = a1 - ang(ro), s1 = a0 + ang(ri), e1 = a1 - ang(ri);
    h.moveTo(Math.cos(s1) * ri, Math.sin(s1) * ri);
    for (let k = 0; k <= steps; k++) { const a = s0 + ((e0 - s0) * k) / steps; h.lineTo(Math.cos(a) * ro, Math.sin(a) * ro); }
    for (let k = 0; k <= steps; k++) { const a = e1 - ((e1 - s1) * k) / steps; h.lineTo(Math.cos(a) * ri, Math.sin(a) * ri); }
    face.holes.push(h);
    if (split) { // fente au milieu de la branche
      const am = a1, sl = new THREE.Path(), w = spokeW * 0.35;
      const pts = [[ri + 0.06 * S, -w], [ro - 0.02 * S, -w * 0.6], [ro - 0.02 * S, w * 0.6], [ri + 0.06 * S, w]].map(([r, t]) => [Math.cos(am) * r - Math.sin(am) * t, Math.sin(am) * r + Math.cos(am) * t]);
      sl.moveTo(...pts[0]); pts.slice(1).forEach((p) => sl.lineTo(...p)); face.holes.push(sl);
    }
  }
  for (let i = 0; i < nuts; i++) { const a = (i / nuts) * Math.PI * 2 + Math.PI / 2; const hp = new THREE.Path(); hp.absarc(Math.cos(a) * 0.17 * S, Math.sin(a) * 0.17 * S, 0.032 * S, 0, Math.PI * 2, true); face.holes.push(hp); }
  const rimMat = materials.metal({ color: rim, rough: rimRough, env: 1.4 });
  const fg = new THREE.ExtrudeGeometry(face, { depth: 0.06 * S, bevelEnabled: true, bevelThickness: 0.025 * S, bevelSize: 0.018 * S, bevelSegments: 4, curveSegments: 96 });
  /* branches légèrement concaves : le centre recule */
  const fgd = deform(fg, (p) => { const r = Math.hypot(p.x, p.y) / rimR; p.z -= (1 - r) * (1 - r) * 0.12 * S; });
  fgd.translate(0, 0, depth * 0.12);
  const barrel = new THREE.Mesh(lathe([[rimR * 0.99, -depth * 0.3], [rimR, -depth * 0.28], [rimR * 0.97, depth * 0.1], [rimR * 1.02, depth * 0.17], [rimR * 1.0, depth * 0.2]], { smooth: 3, thickness: 0.02 * S, segments: 128 }).rotateX(Math.PI / 2), rimMat);
  parts.rim = new THREE.Group(); parts.rim.add(new THREE.Mesh(fgd, rimMat), barrel);
  /* écrous : six pans, chanfrein, dans leurs logements */
  parts.nuts = [];
  for (let i = 0; i < nuts; i++) {
    const a = (i / nuts) * Math.PI * 2 + Math.PI / 2;
    const nut = new THREE.Mesh(lathe([[0, 0], [0.03 * S, 0], [0.03 * S, 0.035 * S], [0.022 * S, 0.05 * S], [0, 0.052 * S]], { smooth: 0, segments: 6 }).rotateX(Math.PI / 2), materials.metal({ color: "#d9dce1", rough: 0.2 }));
    nut.position.set(Math.cos(a) * 0.17 * S, Math.sin(a) * 0.17 * S, depth * 0.12 + 0.02 * S); parts.rim.add(nut); parts.nuts.push(nut);
  }
  parts.cap = new THREE.Mesh(lathe([[0, 0], [0.09, 0], [0.095, 0.06], [0.085, 0.085], [0, 0.1]].map(([r, y]) => [r * S, y * S]), { smooth: 4 }).rotateX(Math.PI / 2), materials.metal({ color: "#2a2c30", rough: 0.3 }));
  parts.cap.position.z = 0.02 * S; // posé dans le creux de la face (elle recule vers le centre) parts.rim.add(parts.cap);
  axle.add(parts.tire, parts.rim);
  if (disc) {
    const dg = new THREE.CylinderGeometry(0.56 * S, 0.56 * S, 0.05 * S, 96).rotateX(Math.PI / 2);
    parts.disc = new THREE.Mesh(dg, materials.metal({ color: "#8d9096", rough: 0.42 })); parts.disc.position.z = -depth * 0.05;
    const cal = new THREE.Shape(); cal.absarc(0, 0, 0.6 * S, Math.PI * 0.12, Math.PI * 0.42, false); cal.absarc(0, 0, 0.4 * S, Math.PI * 0.42, Math.PI * 0.12, true);
    const cg = new THREE.ExtrudeGeometry(cal, { depth: 0.12 * S, bevelEnabled: true, bevelThickness: 0.02 * S, bevelSize: 0.02 * S, bevelSegments: 3 });
    parts.caliper = new THREE.Mesh(cg, new THREE.MeshPhysicalMaterial({ color: caliper, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 })); parts.caliper.position.z = -depth * 0.08;
    axle.add(parts.disc, parts.caliper);
  }
  /* spin(angle) : la roue tourne, l'étrier reste fixe (comme sur la voiture) */
  return done(group, parts, { spin(a) { parts.tire.rotation.z = parts.rim.rotation.z = a; if (parts.disc) parts.disc.rotation.z = a; } });
}

/* ---------------------------------------------------------------------------------------------- */
/**
 * Fleur qui éclot : pétales incurvés (veine centrale, bord plus clair), une ou plusieurs couronnes,
 * cœur granuleux, tige courbe et feuille. open(k) : 0 = bouton fermé → 1 = épanouie.
 *   petals : pétales par couronne · layers : couronnes · color, edge : base et bord du pétale
 *   heart : cœur · shape : "round" (rose, pivoine) | "pointed" (lys, tulipe) · stem : longueur (0 : sans)
 *   tilt : la tête se penche vers +z (0 : regarde le ciel)
 */
export function flower({ petals = 6, layers = 2, color = "#e8467a", edge = "#ffd1df", heart = "#f2b70c", shape = "round", size = 1, stem = 1.6, tilt = 0.55, seed = 3 } = {}) {
  const s = size, group = new THREE.Group(), head = new THREE.Group(), parts = { petals: [] };
  const pc = new THREE.Color(color), pe = new THREE.Color(edge), tmp = new THREE.Color();
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(edge), sheenRoughness: 0.45, side: THREE.DoubleSide }); // pas de transmission : une passe de rendu en plus pour un effet invisible
  const petalGeo = (len, wid) => {
    const g = new THREE.PlaneGeometry(1, 1, 16, 28); g.translate(0, 0.5, 0);
    const out = deform(g, (p) => {
      const v = p.y, prof = shape === "pointed" ? Math.sin(Math.PI * Math.pow(v, 0.7)) * (1 - 0.25 * v) : Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.92 + 0.04)), 0.55);
      p.x *= wid * prof; p.y = v * len;
      p.z = -(p.x * p.x) * 1.6 / wid + v * v * 0.18 * len - Math.abs(p.x) * 0.02; // cuillère + bout qui se recourbe
      p.z += 0.012 * s * Math.sin(v * 9 + seed) * Math.sin(p.x * 14);         // ondulation du bord
    });
    return tint(out, (p) => { const v = p.y / len, e = Math.min(1, Math.abs(p.x) / (wid * 0.5)); tmp.copy(pc).multiplyScalar(0.72 + 0.28 * v).lerp(pe, Math.pow(Math.max(e, v), 3) * 0.75); if (Math.abs(p.x) < 0.006 * s) tmp.multiplyScalar(0.85); return tmp; });
  };
  for (let L = 0; L < layers; L++) {
    const len = (0.62 - L * 0.12) * s, wid = (shape === "pointed" ? 0.3 : 0.44) * s * (1 - L * 0.1), g = petalGeo(len, wid);
    for (let i = 0; i < petals; i++) {
      const pivot = new THREE.Group(); pivot.rotation.y = (i / petals) * Math.PI * 2 + L * (Math.PI / petals);
      const m = new THREE.Mesh(g, mat); pivot.add(m); head.add(pivot);
      m.userData.layer = L; m.position.z = 0.02 * s * (layers - L); parts.petals.push(m);
    }
  }
  /* cœur : étamines en grains */
  const hg = organic(new THREE.SphereGeometry(0.11 * s, 48, 32).scale(1, 0.55, 1), { amp: 0.012 * s, freq: 40 / s, octaves: 1, seed });
  parts.heart = new THREE.Mesh(hg, new THREE.MeshPhysicalMaterial({ color: heart, roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color("#fff2a8") }));
  parts.heart.position.y = 0.04 * s; head.add(parts.heart);
  if (stem > 0) {
    const L = stem * s, curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.06 * s, L * 0.35, 0.02 * s), new THREE.Vector3(-0.04 * s, L * 0.7, -0.02 * s), new THREE.Vector3(0, L, 0)]);
    const green = new THREE.MeshPhysicalMaterial({ color: "#3f7a34", roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color("#a7d67c") });
    parts.stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.022 * s, 12, false), green);
    const leafG = deform(new THREE.PlaneGeometry(1, 1, 10, 20).translate(0, 0.5, 0), (p) => { const v = p.y; p.x *= 0.22 * s * Math.sin(Math.PI * Math.pow(v, 0.8)); p.y = v * 0.5 * s; p.z = -p.x * p.x * 3 / s + v * v * 0.12 * s; });
    parts.leaf = new THREE.Mesh(leafG, new THREE.MeshPhysicalMaterial({ color: "#4c8a3c", roughness: 0.5, side: THREE.DoubleSide, sheen: 0.4 }));
    parts.leaf.position.copy(curve.getPoint(0.38)); parts.leaf.rotation.set(-0.9, 0.6, -0.5);
    group.add(parts.stem, parts.leaf); head.position.y = L;
  }
  head.rotation.x = tilt; // la fleur se penche vers +z (la caméra) : on voit le cœur, pas seulement le profil
  group.add(head); parts.head = head;
  const open = (k) => {
    k = Math.min(1, Math.max(0, k));
    for (const m of parts.petals) {
      const L = m.userData.layer, kk = Math.min(1, Math.max(0, k * 1.25 - L * 0.25)), e = kk * kk * (3 - 2 * kk); // couronne extérieure d'abord
      m.rotation.x = -0.12 + e * (1.25 - L * 0.32); // penché sur le cœur (bouton) → couché vers l'extérieur
    }
    parts.heart.scale.setScalar(0.6 + 0.4 * k);
  };
  open(1);
  return done(group, parts, { open });
}
