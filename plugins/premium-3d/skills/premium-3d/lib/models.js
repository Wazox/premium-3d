/*
 * premium-3d / models.js
 * Modèles 3D du client (.glb / .gltf, compressés Draco, Meshopt ou non, textures KTX2),
 * éclairage studio réaliste et ombres douces au sol.
 *
 * Le plus léger : géométrie Meshopt + textures KTX2, en une commande (voir references/performance.md) :
 *   npx gltf-transform optimize entree.glb sortie.glb --compress meshopt --texture-compress ktx2
 * Passer `stage` à loadModel pour lire les textures KTX2 (il faut le renderer).
 *
 *   import { loadModel, studioLights, softGround } from "./lib/models.js";
 *   const model = await loadModel("produit.glb", { size: 3 });   // centré, mis à l'échelle
 *   scene.add(model);
 *   studioLights(stage, { shadows: true });
 *   scene.add(softGround({ y: model.userData.bottom, color: "#f4f1ea" }));
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const LIBS = "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/";
let loader = null, ktx2Ready = false;
function getLoader(renderer) {
  if (!loader) {
    loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(LIBS + "draco/gltf/");
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  if (renderer && !ktx2Ready) { // le transcodeur (~500 Ko) n'est téléchargé que si un modèle a des textures KTX2
    loader.setKTX2Loader(new KTX2Loader().setTranscoderPath(LIBS + "basis/").detectSupport(renderer));
    ktx2Ready = true;
  }
  return loader;
}

/**
 * Charge, centre et met à l'échelle un modèle. `size` = plus grande dimension en unités 3D.
 * userData.bottom = hauteur du dessous du modèle (pour poser un sol), userData.animations = clips.
 */
export async function loadModel(url, { size = 3, castShadow = true, receiveShadow = true, envIntensity = 1, stage = null } = {}) {
  const gltf = await getLoader(stage && stage.renderer).loadAsync(url);
  const root = gltf.scene;
  const box = new THREE.Box3().setFromObject(root), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = size / Math.max(sz.x, sz.y, sz.z);
  root.position.sub(c).multiplyScalar(k); root.scale.setScalar(k);
  const wrap = new THREE.Group(); wrap.add(root);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = castShadow; o.receiveShadow = receiveShadow;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if ("envMapIntensity" in m) m.envMapIntensity = envIntensity; });
    }
  });
  wrap.userData.bottom = -sz.y * k / 2;
  wrap.userData.animations = gltf.animations;
  return wrap;
}

/** Éclairage trois points (clé, contre-jour, remplissage) avec ombres douces optionnelles. */
export function studioLights(stage, { shadows = true, key = 2.2, rim = 1.4, fill = 0.5, keyColor = "#fff4e6", rimColor = "#e6f0ff", radius = 6 } = {}) {
  const { scene, renderer } = stage;
  const k = new THREE.DirectionalLight(keyColor, key); k.position.set(4, 6, 5);
  const r = new THREE.DirectionalLight(rimColor, rim); r.position.set(-5, 3, -4);
  const f = new THREE.HemisphereLight(0xffffff, 0x444444, fill);
  if (shadows) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const map = { low: 512, mid: 1024, high: 2048 }[stage.tier] || 1024; // ombre : 4 fois moins de pixels par niveau
    k.castShadow = true; k.shadow.mapSize.set(map, map); k.shadow.radius = radius; k.shadow.bias = -0.0004;
    const s = k.shadow.camera; s.left = -5; s.right = 5; s.top = 5; s.bottom = -5; s.near = 0.5; s.far = 30;
  }
  scene.add(k, r, f);
  return { key: k, rim: r, fill: f };
}

/**
 * Sol qui ne montre que l'ombre (invisible ailleurs), plus un dégradé radial doux sous l'objet.
 * Sur fond clair : opacity 0.25 à 0.35. Sur fond sombre : préférer une lueur (glow: true).
 */
export function softGround({ y = -1.5, size = 20, opacity = 0.28, glow = false, color = "#000000" } = {}) {
  const g = new THREE.Group(); g.position.y = y;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity }));
  shadow.rotation.x = -Math.PI / 2; shadow.receiveShadow = true; g.add(shadow);
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d");
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); const col = new THREE.Color(color);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  gr.addColorStop(0, `rgba(${rgb},${glow ? 0.5 : 0.35})`); gr.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.002; g.add(blob);
  return g;
}
