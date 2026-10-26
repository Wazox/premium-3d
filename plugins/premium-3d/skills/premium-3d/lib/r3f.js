/*
 * premium-3d / r3f.js
 * Composants React Three Fiber : les matières, le studio de reflets, les logos, le texte en volume
 * et les particules de premium-3d dans un <Canvas> existant (Next.js, Vite, Remix…).
 * Écrit sans JSX : s'importe tel quel, avec ou sans outil de build.
 *
 *   "use client";
 *   import { Canvas } from "@react-three/fiber";
 *   import { Studio, Material, Logo3D, Text3D, Particles } from "@/lib/premium-3d/r3f";
 *
 *   <Canvas camera={{ fov: 32, position: [0, 0, 8] }} gl={{ toneMapping: THREE.ACESFilmicToneMapping }}>
 *     <Studio accent="#22c55e" front={1} />                      // reflets du verre et du métal
 *     <mesh><torusKnotGeometry /><Material kind="glass" tint="#bfffd9" /></mesh>
 *     <Logo3D svg={svgString} size={3} material={(i, color) => materials.enamel({ color })} explode={k} />
 *     <Text3D font="/fonts/Marque.ttf" text="Bonjour" size={0.8} material={materials.metal({})} />
 *     <Particles shapes={[() => sampleText("A", { count: 12000 }), () => sampleSVG(logo, { count: 12000 })]} value={k} />
 *   </Canvas>
 *
 * Next.js : core.js lit la fenêtre (taille de l'écran, niveau de l'appareil) dès son chargement.
 * Charger la scène côté client seulement : const Scene = dynamic(() => import("./Scene"), { ssr: false }).
 * Bloom : @react-three/postprocessing (<EffectComposer><Bloom luminanceThreshold={0.9} /></EffectComposer>),
 * avec neon() pour les couleurs qui doivent briller.
 */
import { createElement as h, useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { materials, studioEnvironment, roomEnvironment } from "./core.js";
import { logoPieces, explode as explodePieces } from "./logo3d.js";
import { loadFont, text3d } from "./text3d.js";
import { particleMorph } from "./particles.js";

/** Libère un objet three.js (géométries, matériaux) quand le composant disparaît. */
function disposeDeep(obj) {
  obj.traverse?.((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => m.dispose?.()); });
}

/**
 * Studio de reflets de premium-3d (ou "room" : clair) comme environnement de la scène.
 * Sans lui (ou sans <Environment> de drei), le verre et le métal paraissent noirs.
 */
export function Studio({ env = "studio", accent = "#ffffff", accent2 = "#88aaff", intensity = 1, front = 0, background = false }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const tex = env === "room" ? roomEnvironment(gl) : studioEnvironment(gl, { accent, accent2, intensity, front });
    const prev = [scene.environment, scene.background];
    scene.environment = tex; if (background) scene.background = tex;
    return () => { scene.environment = prev[0]; scene.background = prev[1]; tex.dispose(); };
  }, [gl, scene, env, accent, accent2, intensity, front, background]);
  return null;
}

/** Une matière de premium-3d (glass, frosted, metal, enamel, soft) pour le mesh parent. */
export function Material({ kind = "glass", ...opts }) {
  const key = JSON.stringify([kind, opts]);
  const mat = useMemo(() => materials[kind](opts), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => mat.dispose(), [mat]);
  return h("primitive", { object: mat, attach: "material" });
}

/**
 * Logo SVG en pièces extrudées. explode : 0 = assemblé, 1 = éclaté (animable à chaque image).
 * onPieces(pieces) : accès aux pièces pour les animer soi-même (useFrame).
 */
export function Logo3D({ svg, size = 3, depth, bevel, pieces, material, explode = 0, gap = 0.5, axis = "z", stagger = 0, onPieces, ...props }) {
  const logo = useMemo(() => logoPieces(svg, { size, depth, bevel, pieces, material }), [svg, size, depth, bevel, pieces, material]);
  useEffect(() => { onPieces?.(logo.pieces); return () => disposeDeep(logo.group); }, [logo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { explodePieces(logo.pieces, explode, { gap, axis, stagger }); }, [logo, explode, gap, axis, stagger]);
  return h("primitive", { object: logo.group, ...props });
}

/** Texte en volume dans la vraie police (.ttf / .otf / .woff), chargée une seule fois. */
export function Text3D({ font, text, size = 1, depth = 0.3, bevel = 0.03, material, align = "center", splitLetters = false, letterSpacing = 0, ...props }) {
  const [f, setF] = useState(null);
  useEffect(() => { let on = true; loadFont(font).then((x) => on && setF(x)); return () => { on = false; }; }, [font]);
  const mesh = useMemo(() => (f ? text3d(f, text, { size, depth, bevel, material, align, splitLetters, letterSpacing }) : null), [f, text, size, depth, bevel, material, align, splitLetters, letterSpacing]);
  useEffect(() => () => { if (mesh) mesh.traverse((o) => o.geometry?.dispose()); }, [mesh]); // la matière appartient à l'appelant
  return mesh ? h("primitive", { object: mesh, ...props }) : null;
}

/**
 * Particules qui passent d'une forme à l'autre. shapes : fonctions qui renvoient une forme
 * (sampleImage, sampleSVG, sampleText, sampleMesh, shape…), toutes avec le même count.
 * value : 0 = 1re forme, 1 = 2e, 1.5 = entre la 2e et la 3e (animable à chaque image).
 */
export function Particles({ shapes, value = 0, size = 3, additive = true, turbulence = 0.6, opacity = 1, solid, ...props }) {
  const [morph, setMorph] = useState(null);
  useEffect(() => {
    let on = true, made = null;
    Promise.all(shapes.map((s) => (typeof s === "function" ? s() : s))).then((states) => {
      if (!on) return;
      made = particleMorph(states, { size, additive, turbulence, opacity, solid }); setMorph(made);
    });
    return () => { on = false; if (made) { made.points.geometry.dispose(); made.material.dispose(); } };
  }, [shapes, size, additive, turbulence, opacity, solid]);
  useEffect(() => { morph?.set(value); }, [morph, value]);
  useFrame((state) => morph?.update(state.clock.elapsedTime));
  return morph ? h("primitive", { object: morph.points, ...props }) : null;
}
