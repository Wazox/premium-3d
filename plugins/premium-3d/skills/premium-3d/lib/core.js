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
/* ?tier=high|mid|low dans l'URL force le niveau (captures sans carte graphique, tests) */
const FORCED = (location.search.match(/[?&]tier=(low|mid|high)\b/) || [])[1] || null;
export const LOW = FORCED ? FORCED === "low" || innerWidth < 860 : innerWidth < 860 || (navigator.hardwareConcurrency || 8) <= 4;

/**
 * Niveau de l'appareil : "low" | "mid" | "high". Sert à doser ce qui coûte cher
 * (nombre de particules, subdivisions, ombres, profondeur de champ) :
 *   const N = { low: 6000, mid: 12000, high: 20000 }[tier()];
 * Basé sur la taille d'écran, les cœurs, la mémoire et le nom de la carte graphique.
 */
let _tier = null;
export function tier() {
  if (_tier) return _tier;
  if (FORCED) return (_tier = FORCED);
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4, small = innerWidth < 860;
  let gpu = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
  } catch (e) {}
  const weakGpu = /swiftshader|llvmpipe|software|mali-4|adreno \(tm\) [3-5]\d\d|intel.*hd graphics [2-5]\d\d\d/i.test(gpu);
  const strongGpu = /rtx|radeon rx|apple m\d|geforce gtx 1[0-9]|arc a\d/i.test(gpu);
  if (weakGpu || cores <= 2 || mem <= 2) _tier = "low";
  else if (small || cores <= 4 || mem <= 4) _tier = strongGpu && !small ? "high" : "mid";
  else _tier = "high";
  return _tier;
}

/* ---------- maths utiles ---------- */
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeBack = (x, c1 = 1.4) => { const c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** Couleur HDR (> 1) pour les éléments qui doivent briller au bloom. */
export const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
/**
 * Néon : couleur HDR qui brille AUTANT quelle que soit sa teinte. Le bloom trie par luminance
 * (0,30 rouge + 0,59 vert + 0,11 bleu) : avec hdr(), un rouge ou un bleu au même k qu'un vert brille
 * à peine. neon() règle la luminance sur `glow` (1 = au seuil du bloom par défaut, 1,6 = net, 3 = fort).
 */
export const neon = (hex, glow = 1.6) => {
  const c = new THREE.Color(hex), lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return c.multiplyScalar(Math.min(40, glow / Math.max(lum, 0.01)));
};
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

/**
 * Distance de caméra pour qu'un objet de taille (w, h) tienne dans l'image, avec une marge.
 * L'objet est décalé du centre (texte à côté) ? Passer son décalage : il reste entier à l'écran.
 *   fitDistance(camera, 4, 3)                          // objet centré, marge 1.25
 *   fitDistance(camera, 4, 3, 1.1)                     // marge 1.1
 *   fitDistance(camera, 4, 3, { x: 1.6, margin: 1.1 }) // objet posé à x = 1.6 (caméra visant x = 0)
 */
export function fitDistance(camera, w, h, opts = 1.25) {
  const { margin = 1.25, x = 0, y = 0 } = typeof opts === "number" ? { margin: opts } : opts;
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const dh = (h / 2 + Math.abs(y)) / Math.tan(vf), dw = (w / 2 + Math.abs(x)) / (Math.tan(vf) * camera.aspect);
  return Math.max(dh, dw) * margin;
}

/**
 * Cadre un objet (largeur w, hauteur h, centré à l'origine) dans une ZONE de l'écran, pour laisser
 * la place au texte. Zone en fractions de 0 à 1 depuis le haut à gauche. Renvoie la distance de
 * caméra ; décale le cadre de la caméra (setViewOffset) au lieu de déplacer l'objet : la
 * perspective reste de face, et un sol (softGround) reste sous les yeux de la caméra.
 *   stage.onResize((w) => {
 *     const zone = w < 860 ? { top: 0.1, bottom: 0.52 } : { left: 0.45 };   // mobile : en haut ; ordi : à droite
 *     stage.camera.position.set(0, 0, fitZone(stage.camera, 3, 3.5, zone));
 *     stage.camera.lookAt(0, 0, 0);
 *   });
 * Sans zone (ou zone null), retire le décalage : plein écran.
 */
export function fitZone(camera, w, h, zone = null) {
  const { left = 0, right = 1, top = 0, bottom = 1, margin = 1.1 } = zone || {};
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), zw = Math.max(0.05, right - left), zh = Math.max(0.05, bottom - top);
  /* setViewOffset redéfinit camera.aspect avec les deux premiers nombres : on lui donne le vrai ratio */
  const a = camera.aspect;
  if (zone) camera.setViewOffset(a, 1, (0.5 - (left + right) / 2) * a, 0.5 - (top + bottom) / 2, a, 1);
  else if (camera.view) camera.clearViewOffset();
  return Math.max((h * margin) / (2 * zh * t), (w * margin) / (2 * zw * t * camera.aspect));
}

/* ---------- studio de reflets : sans lui, le verre et le métal paraissent ternes ---------- */
/*
 * front : lumière douce placée côté caméra (0 = studio pur, par défaut). À activer (front: 1) quand
 * une face PLATE de métal ou de chrome est tournée vers le visiteur (roue, écrou, médaille, logo de
 * face) : sans elle, cette face reflète le vide et devient noire. À laisser à 0 pour un métal poli
 * courbe (goutte, sphère) : la lumière s'y refléterait en un rectangle gris.
 */
export function studioEnvironment(renderer, { accent = "#ffffff", accent2 = "#88aaff", intensity = 1, front = 0 } = {}) {
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
  if (front > 0) {
    const f = front * k;
    /* sous 0.9 : le reflet ne déclenche pas le bloom (sinon halos blancs sur le chrome) */
    panel(9, 1.6, new THREE.Color(0.8 * f, 0.8 * f, 0.8 * f), -1, 3.2, 8, 0, -0.45); // boîte à lumière haute, côté caméra
    panel(16, 9, new THREE.Color(0.2 * f, 0.2 * f, 0.22 * f), 0, 0, 11);           // fond doux derrière la caméra
  }
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
  background = null, accent = "#ffffff", accent2 = "#88aaff", fov = 32, env = "studio", front = 0,
  bloom = { strength: 0.55, radius: 0.5, threshold: 0.9 }, exposure = 1, maxPixelRatio = 1.25, poster = null,
} = {}) {
  /* image de secours : visible pendant le chargement, et à la place de la 3D si WebGL manque */
  /* poster : "img/poster.jpg" ou { desktop: "img/poster.jpg", mobile: "img/poster-mobile.jpg" }.
     Posée sur un calque derrière le canvas (le fond CSS du conteneur reste intact), retirée en fondu
     quand la 3D est prête (utile si le canvas est transparent). */
  let posterEl = null;
  if (poster) {
    const src = typeof poster === "string" ? poster : (innerWidth < 860 && poster.mobile) || poster.desktop || poster.mobile;
    const box0 = canvas.parentElement;
    if (getComputedStyle(box0).position === "static") box0.style.position = "relative";
    posterEl = document.createElement("div"); posterEl.className = "p3d-poster"; posterEl.setAttribute("aria-hidden", "true");
    Object.assign(posterEl.style, { position: "absolute", inset: "0", backgroundImage: `url("${src}")`, backgroundSize: "cover", backgroundPosition: "center", pointerEvents: "none", transition: "opacity .8s" });
    box0.insertBefore(posterEl, canvas);
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: background === null, powerPreference: "high-performance" });
    if (!renderer.capabilities.isWebGL2) throw 0;
  } catch (e) { document.documentElement.classList.add("no-gl"); return null; }
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = exposure;
  if (background === null) renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  if (background !== null) scene.background = new THREE.Color(background);
  scene.environment = env === "room" ? roomEnvironment(renderer) : studioEnvironment(renderer, { accent, accent2, front });
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
  let composer = null, bloomPass = null, outputPass = null;
  if (bloom && !LITE) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    /* sur petit écran, le halo couvre une plus grande part de l'image : on l'adoucit */
    const bs = (bloom.strength ?? 0.55) * (innerWidth < 860 ? 0.65 : 1);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), bs, bloom.radius ?? 0.5, bloom.threshold ?? 0.9); composer.addPass(bloomPass);
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
  /* compteurs d'une image entière (le post-traitement fait plusieurs rendus par image) : lus par tools/check.mjs */
  renderer.info.autoReset = false;
  const render = () => { renderer.info.reset(); composer ? composer.render() : renderer.render(scene, camera); };
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
    THREE, renderer, scene, camera, composer, bloom: bloomPass, outputPass, render, LOW, LITE, tier: tier(), reduce: reduceMotion, ready: false, paused: false, still: false,
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
      stage.ready = true; stage.readyAt = performance.now();
      box.classList.add("p3d-ready"); // CSS : .p3d-ready canvas { opacity: 1 } pour un fondu d'apparition
      if (posterEl) { posterEl.style.opacity = "0"; setTimeout(() => posterEl.remove(), 900); }
    },
    /**
     * Lance la boucle : update(dt, t, real) n'est appelé que si la section est proche de l'écran.
     * dt, t : temps de l'animation (figés quand stage.still) ; real : temps réel, pour lisser le scroll.
     */
    start(update) {
      let last = null; // THREE.Clock est obsolète depuis r183 : le temps vient de requestAnimationFrame
      stage._update = update;
      if (stopFrame) stopFrame();
      stopFrame = onFrame((now) => {
        const real = last === null ? 0 : Math.min((now - last) / 1000, 0.05); last = now;
        if (!visible || !stage.ready || stage.paused || document.hidden) return;
        /* still : le temps est figé (bouton pause, animations réduites) : dt = 0 et t ne bouge plus.
           real = temps réellement écoulé, toujours : c'est lui qui lisse le suivi du scroll. */
        const dt = stage.still ? 0 : real; stage._T += dt;
        update(dt, stage._T, real); render(); adapt(now);
      });
    },
    _T: 0,
    /**
     * Avance la scène d'exactement une image (dt secondes) et la dessine, hors de la boucle :
     * vidéo image par image (tools/render.mjs), tests. Mettre stage.paused = true avant.
     * draw = false : avance sans dessiner (quasi gratuit), pour rejoindre vite une image lointaine :
     * c'est ce qui permet à render.mjs de répartir une vidéo entre plusieurs navigateurs.
     */
    step(dt = 1 / 30, draw = true) {
      if (!stage._update || !stage.ready) return;
      const d = stage.still ? 0 : dt; stage._T += d;
      stage._update(d, stage._T, dt); if (draw) render();
    },
    stepNoDraw: true, // marqueur lu par tools/render.mjs (les versions avant 1.8 dessinaient toujours)
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
  (window.__p3d || (window.__p3d = { stages: [] })).stages.push(stage); // diagnostic (tools/check.mjs)
  return stage;
}
