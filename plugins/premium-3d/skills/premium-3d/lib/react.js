/*
 * premium-3d / react.js
 * Brancher une scène premium-3d dans React, Next.js (app router) ou tout framework à composants.
 * Pas de dépendance à React Three Fiber : la scène s'écrit avec lib/ comme ailleurs.
 *
 *   "use client";
 *   import { usePremium3D } from "@/lib/premium-3d/react";
 *   import { materials, THREE } from "@/lib/premium-3d/core";
 *
 *   export default function Hero3D() {
 *     const ref = usePremium3D(async (stage) => {
 *       const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 64), materials.metal({}));
 *       stage.scene.add(mesh);
 *       return (dt, t) => { mesh.rotation.y += dt * 0.3; };   // fonction appelée à chaque image
 *     }, { background: null, accent: "#22c55e" });
 *     return <div style={{ position: "relative", height: "100svh" }}><canvas ref={ref} /></div>;
 *   }
 *
 * Next.js : le composant doit être client ("use client"). Pour ne pas charger three.js côté
 * serveur ni dans le premier bundle : const Hero3D = dynamic(() => import("./Hero3D"), { ssr: false }).
 */
import { useEffect, useRef } from "react";
import { createStage } from "./core.js";

/**
 * @param setup  async (stage) => update(dt, t) | void : construit la scène, renvoie la fonction d'animation
 * @param opts   options de createStage ; opts.warm(stage) optionnel pour préparer le préchauffage
 * @returns ref à poser sur un <canvas> (son parent doit avoir une taille)
 */
export function usePremium3D(setup, opts = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    canvas.style.cssText += ";position:absolute;inset:0;width:100%;height:100%;display:block";
    let stage = createStage(canvas, opts), alive = true;
    if (!stage) return;
    (async () => {
      const update = await setup(stage);
      if (!alive) return;
      await stage.warm(opts.prepare, opts.restore);
      if (!alive) return;
      stage.start((dt, t) => update && update(dt, t));
    })();
    return () => { alive = false; stage.dispose(); stage = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
