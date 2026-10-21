/*
 * premium-3d / core.js
 * Le socle commun à toutes les scènes : rendu, studio de reflets, matériaux, post-traitement,
 * boucle unique, scroll mesuré en cache, préchauffage des shaders, pixel ratio adaptatif.
 *
 *   import { createStage, scrollTrack, onFrame, smoothScroll, ss, easeBack, cameraPath } from "./lib/core.js";
 *   const stage = createStage(canvas, { accent: "#e11d48", background: "#0e0e10" });
 *   if (stage) { ...construire la scène... ; stage.warm().then(() => stage.start(update)); }
 *
 * Fonctionne avec l'importmap CDN ("three", "three/addons/") ou avec three installé via npm.
 */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export { THREE };
export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const LITE = /[?&]lite\b/.test(location.search);
export const LOW = innerWidth < 860 || (navigator.hardwareConcurrency || 8) <= 4;

/* ---------- maths utiles ---------- */
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeBack = (x, c1 = 1.4) => { const c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** Couleur HDR (> 1) pour les éléments qui doivent briller au bloom. */
export const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
/** Couleur en rgba() pour le dessin canvas 2D. */
export const rgba = (hex, a) => { const c = new THREE.Color(hex); const o = {}; c.getRGB(o, THREE.SRGBColorSpace); return `rgba(${Math.round(o.r * 255)},${Math.round(o.g * 255)},${Math.round(o.b * 255)},${a})`; };

/* ---------- une seule boucle requestAnimationFrame pour toute la page ---------- */
const frameFns = new Set();
let lenis = null, looping = false;
export function onFrame(fn) {
  frameFns.add(fn);
  if (!looping) { looping = true; const tick = (t) => { if (lenis) lenis.raf(t); frameFns.forEach((f) => f(t)); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
  return () => frameFns.delete(fn);
}
/** Scroll fluide (Lenis, si chargé sur la page). Désactivé si l'utilisateur réduit les animations. */
export function smoothScroll(opts = {}) {
  if (reduceMotion || !window.Lenis || lenis) return lenis;
  lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, autoRaf: false, ...opts });
  onFrame(() => {});
  return lenis;
}
export const scrollTo = (y, duration = 1.4) => (lenis ? lenis.scrollTo(y, { duration }) : window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" }));

/**
 * Progression 0→1 du scroll dans une section haute (ex. 500vh avec un enfant sticky).
 * Les mesures sont faites au chargement/redimensionnement, jamais pendant le scroll.
 */
export function scrollTrack(el) {
  const m = { top: 0, h: 1 };
  const measure = () => { m.top = el.getBoundingClientRect().top + scrollY; m.h = Math.max(1, el.offsetHeight - innerHeight); };
  measure(); addEventListener("resize", measure); new ResizeObserver(measure).observe(document.body); document.fonts && document.fonts.ready.then(measure);
  return {
    progress: () => clamp01((scrollY - m.top) / m.h),
    inside: (margin = 0) => scrollY + margin > m.top && scrollY + margin < m.top + m.h + innerHeight,
    goto: (p, d) => scrollTo(m.top + clamp01(p) * m.h, d),
    measure,
  };
}

/**
 * Trajet de caméra par plans clés : [[p, [x,y,z] position, [x,y,z] cible], ...].
 * Renvoie (p, outPos, outTarget) avec interpolation douce entre deux plans.
 */
export function cameraPath(keys) {
  const K = keys.map(([p, a, b]) => [p, new THREE.Vector3(...a), new THREE.Vector3(...b)]);
  return (p, outP, outT) => {
    let i = 0; while (i < K.length - 2 && p > K[i + 1][0]) i++;
    const [a, pa, ta] = K[i], [b, pb, tb] = K[i + 1], k = ss(a, b, p);
    outP.copy(pa).lerp(pb, k); outT.copy(ta).lerp(tb, k);
  };
}

/**
 * Lance fn() seulement quand l'élément approche de l'écran (marge d'un écran) : la 3D ne ralentit
 * pas le premier affichage de la page quand elle est plus bas. Renvoie une promesse.
 */
export function whenNear(el, fn, margin = "100% 0px") {
  return new Promise((res) => {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); res(fn()); } }, { rootMargin: margin });
    io.observe(el);
  });
}

/** Distance de caméra pour qu'un objet de taille (w, h) tienne dans l'image, avec une marge. */
export function fitDistance(camera, w, h, margin = 1.25) {
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const dh = (h / 2) / Math.tan(vf), dw = (w / 2) / (Math.tan(vf) * camera.aspect);
  return Math.max(dh, dw) * margin;
}

/* ---------- studio de reflets : sans lui, le verre et le métal paraissent ternes ---------- */
export function studioEnvironment(renderer, { accent = "#ffffff", accent2 = "#88aaff", intensity = 1 } = {}) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x020303);
  const panel = (w, h, c, x, y, z, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m);
  };
  const k = intensity;
  panel(10, 3, new THREE.Color(6 * k, 6 * k, 6 * k), 0, 7, 0, 0, Math.PI / 2);
  panel(1.2, 10, new THREE.Color(7 * k, 7 * k, 7 * k), -7, 0, 2, Math.PI / 2);
  panel(0.8, 10, new THREE.Color(5 * k, 5 * k, 5 * k), 7, 0, -1, -Math.PI / 2);
  panel(14, 1, hdr(accent, 4 * k), 0, -2, -8);
  panel(1, 6, hdr(accent2, 3 * k), 5, 3, 6, -2.4);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture; pm.dispose();
  return tex;
}
export function roomEnvironment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(new RoomEnvironment(), 0.03).texture; pm.dispose();
  return tex;
}

/* ---------- matériaux ---------- */
export const materials = {
  /** Verre optique : réfraction, dispersion, irisation. */
  glass: ({ tint = "#ffffff", dist = 4, thick = 1.2, disp = 7, irid = 0.25, rough = 0, env = 1.7 } = {}) => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: rough, transmission: 1, thickness: thick, ior: 1.47, dispersion: LOW ? 0 : disp,
    attenuationColor: new THREE.Color(tint), attenuationDistance: dist, specularIntensity: 1, specularColor: 0xffffff,
    clearcoat: 0.6, clearcoatRoughness: 0.02, iridescence: LOW ? 0 : irid, iridescenceIOR: 1.25, iridescenceThicknessRange: [200, 500], envMapIntensity: env,
  }),
  /** Verre dépoli (plus doux, moins de reflets). */
  frosted: ({ tint = "#ffffff", rough = 0.35, thick = 0.8 } = {}) => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: rough, transmission: 1, thickness: thick, ior: 1.45, attenuationColor: new THREE.Color(tint), attenuationDistance: 3, envMapIntensity: 1.2,
  }),
  /** Métal poli (or, argent, cuivre…). Passer envMap: roomEnvironment(...) pour un or clair. */
  metal: ({ color = "#f2d998", rough = 0.2, envMap = null, env = 1.5 } = {}) => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color), metalness: 1, roughness: rough, clearcoat: 0.5, clearcoatRoughness: 0.12, envMap, envMapIntensity: env,
  }),
  /** Émail / céramique laquée. */
  enamel: ({ color = "#fffcf3", sheen = "#ffffff" } = {}) => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color), roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.6, sheenColor: new THREE.Color(sheen), sheenRoughness: 0.4, iridescence: LOW ? 0 : 0.18, iridescenceIOR: 1.3,
  }),
  /** Plastique / matière douce mate. */
  soft: ({ color = "#e5e7eb", rough = 0.55 } = {}) => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), roughness: rough, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
};

/**
 * Crée la scène : renderer, caméra, environnement, bloom, taille, pixel ratio adaptatif,
 * pause hors écran. Renvoie null (et ajoute .no-gl sur <html>) si WebGL 2 manque.
 */
export function createStage(canvas, {
  background = null, accent = "#ffffff", accent2 = "#88aaff", fov = 32, env = "studio",
  bloom = { strength: 0.55, radius: 0.5, threshold: 0.9 }, exposure = 1, maxPixelRatio = 1.25,
} = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: background === null, powerPreference: "high-performance" });
    if (!renderer.capabilities.isWebGL2) throw 0;
  } catch (e) { document.documentElement.classList.add("no-gl"); return null; }
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = exposure;
  if (background === null) renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  if (background !== null) scene.background = new THREE.Color(background);
  scene.environment = env === "room" ? roomEnvironment(renderer) : studioEnvironment(renderer, { accent, accent2 });
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
  let composer = null, bloomPass = null, outputPass = null;
  if (bloom && !LITE) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), bloom.strength, bloom.radius, bloom.threshold); composer.addPass(bloomPass);
    outputPass = new OutputPass(); composer.addPass(outputPass);
  }
  const box = canvas.parentElement;
  const PR_MAX = Math.min(devicePixelRatio, innerWidth < 860 ? 1 : maxPixelRatio);
  let pr = PR_MAX;
  const resizeFns = [];
  function layout() {
    const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
    camera.aspect = w / h; camera.updateProjectionMatrix();
    resizeFns.forEach((f) => f(w, h, pr));
  }
  const ro = new ResizeObserver(layout); ro.observe(box); layout();
  let visible = false;
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { rootMargin: "100% 0px" }); io.observe(box);
  let stopFrame = null;
  const render = () => (composer ? composer.render() : renderer.render(scene, camera));
  /*
   * Pixel ratio adaptatif, calé sur la fréquence réelle de l'écran (60, 75, 120, 144 Hz…) :
   * - on mesure l'intervalle le plus court observé (≈ une image de l'écran) ;
   * - on baisse seulement après 2 fenêtres de 30 images nettement plus lentes que l'écran ;
   * - on remonte dès que l'on retombe au rythme de l'écran (sinon une baisse passagère, au
   *   chargement par exemple, laisserait la scène floue et crénelée pour toujours) ;
   * - plancher à 1 (sauf machine vraiment lente) : en dessous, les arêtes fines scintillent.
   */
  let acc = 0, n = 0, last = 0, vsync = 1000, slow = 0, fast = 0, warmup = 0;
  const FLOOR = Math.min(1, PR_MAX);
  function adapt(now) {
    const d = now - last; last = now; if (d > 200 || reduceMotion) return;
    if (warmup < 90) { warmup++; vsync = Math.min(vsync, d); return; } // ignorer les premières images
    if (d >= 4) vsync = d < vsync ? d : Math.min(d, vsync + 0.02); // suit l'écran, même s'il change de fréquence
    acc += d; n++; if (n < 30) return;
    const avg = acc / n; acc = 0; n = 0; let next = pr;
    if (avg > Math.max(22, vsync * 1.6)) { fast = 0; if (++slow >= 2) { slow = 0; next = Math.max(avg > 40 ? 0.75 : FLOOR, pr - 0.25); } }
    else if (avg < vsync * 1.25) { slow = 0; if (++fast >= 2) { fast = 0; next = Math.min(PR_MAX, pr + 0.25); } }
    else { slow = 0; fast = 0; }
    if (next !== pr) { pr = next; layout(); }
  }
  const stage = {
    THREE, renderer, scene, camera, composer, bloom: bloomPass, outputPass, render, LOW, LITE, reduce: reduceMotion, ready: false, paused: false,
    onResize(fn) { resizeFns.push(fn); fn(box.clientWidth, box.clientHeight, pr); },
    /** pixel ratio de rendu actuel (diagnostic : il doit revenir au maximum sur une machine correcte) */
    get pixelRatio() { return pr; },
    /**
     * Préchauffage : compile tous les shaders et alloue les buffers AVANT que la section soit visible.
     * prepare() doit rendre visibles tous les objets qui apparaîtront plus tard ; restore() remet l'état initial.
     */
    async warm(prepare, restore) {
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
      await new Promise((r) => idle(r));
      if (prepare) prepare();
      scene.traverse((o) => { const m = o.material; if (!m) return; (Array.isArray(m) ? m : [m]).forEach((x) => ["map", "envMap"].forEach((k) => x[k] && x[k].isTexture && renderer.initTexture(x[k]))); });
      try { await renderer.compileAsync(scene, camera); } catch (e) {}
      render();
      if (restore) restore();
      stage.ready = true;
      box.classList.add("p3d-ready"); // CSS : .p3d-ready canvas { opacity: 1 } pour un fondu d'apparition
    },
    /** Lance la boucle : update(dt, t) n'est appelé que si la section est proche de l'écran. */
    start(update) {
      const clock = new THREE.Clock();
      if (stopFrame) stopFrame();
      stopFrame = onFrame((now) => {
        const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
        if (!visible || !stage.ready || stage.paused || document.hidden) return;
        update(dt, t); render(); adapt(now);
      });
    },
    /** Libère tout (applications React/Vue/Next au démontage du composant). */
    dispose() {
      if (stopFrame) stopFrame(); ro.disconnect(); io.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { Object.values(x).forEach((v) => v && v.isTexture && v.dispose()); x.dispose(); });
      });
      if (scene.environment) scene.environment.dispose();
      if (composer) composer.dispose && composer.dispose();
      renderer.dispose();
    },
  };
  return stage;
}
