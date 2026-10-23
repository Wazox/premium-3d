// Lancement du navigateur commun aux outils (check, render, record, brand).
//
// Carte graphique ou rendu logiciel :
//   --gpu   fenêtre visible, la carte graphique calcule les images (rapide, il faut un écran)
//   --cpu   rendu logiciel SwiftShader, sans fenêtre (marche partout : serveur, cloud, CI)
//   défaut  carte graphique s'il y a un écran (Windows, macOS, Linux avec DISPLAY), sinon logiciel
//
// Variables d'environnement facultatives :
//   CHROMIUM_PATH  un Chrome / Chromium précis (sinon celui de Playwright)
//   HTTPS_PROXY    proxy d'entreprise ; localhost et 127.0.0.1 restent en direct
import { chromium } from "playwright";
import os from "node:os";

/** Lit --gpu / --cpu dans args (et les retire). */
export function gpuMode(args) {
  const take = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
  if (take("--gpu")) return "gpu";
  if (take("--cpu")) return "cpu";
  return process.platform !== "linux" || process.env.DISPLAY || process.env.WAYLAND_DISPLAY ? "gpu" : "cpu";
}

const SOFTWARE = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const HARDWARE = ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--enable-zero-copy"];

/**
 * @param mode   "gpu" | "cpu"
 * @param extra  arguments Chromium en plus
 * @param headless  forcer (sinon : sans fenêtre en cpu, avec fenêtre en gpu)
 */
export function launch(mode, { extra = [], headless } = {}) {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  // Playwright envoie sinon aussi localhost dans le proxy : la page locale ne se chargerait pas.
  if (proxy) process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK = "1";
  return chromium.launch({
    headless: headless ?? mode === "cpu",
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [...(mode === "cpu" ? SOFTWARE : HARDWARE), ...extra],
    proxy: proxy ? { server: proxy, bypass: "localhost,127.0.0.1" } : undefined,
  });
}

/** Nom du moteur WebGL réellement utilisé par la page (carte graphique ou SwiftShader). */
export async function glRenderer(page) {
  return page.evaluate(() => {
    try {
      const gl = document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl");
      if (!gl) return "aucun WebGL";
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    } catch (e) { return "inconnu"; }
  });
}

export const isSoftware = (renderer) => /swiftshader|llvmpipe|software|basic render/i.test(renderer);

/**
 * Nombre de navigateurs en parallèle conseillé pour un rendu image par image.
 * Carte graphique : 2 (pendant qu'un navigateur capture, l'autre dessine).
 * Logiciel : SwiftShader occupe déjà tous les cœurs ; mesuré sur 4 cœurs, 2 ou 4 navigateurs ne vont
 * pas plus vite qu'un seul. Il n'en vaut la peine qu'à partir d'environ 16 cœurs.
 */
export function defaultWorkers(mode) {
  const cores = os.cpus().length || 2;
  return mode === "gpu" ? 2 : cores >= 16 ? Math.min(4, Math.floor(cores / 8)) : 1;
}
