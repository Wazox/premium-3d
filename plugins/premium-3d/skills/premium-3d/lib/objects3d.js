/*
 * premium-3d / objects3d.js
 * Objets prêts à poser dans une scène : cadre photo en verre, socle, anneau lumineux,
 * particules, fond lumineux animé.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/** Cadre en verre avec une photo recadrée (cover), chargée de façon asynchrone. */
export function photoFrame(src, { w = 2.4, h = 1.6, frame = null, px = 1000, onLoad } = {}) {
  const group = new THREE.Group();
  if (frame) group.add(new THREE.Mesh(new RoundedBoxGeometry(w + 0.2, h + 0.2, 0.14, 6, 0.08), frame));
  const texture = new THREE.CanvasTexture(document.createElement("canvas")); texture.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, color: 0x222222 }));
  plane.position.z = frame ? -0.012 : 0; group.add(plane);
  const img = new Image(); img.decoding = "async"; img.crossOrigin = "anonymous";
  img.onload = () => {
    const k = px / Math.max(w, h), cw = Math.round(w * k), ch = Math.round(h * k);
    const c = document.createElement("canvas"); c.width = cw; c.height = ch; const g = c.getContext("2d");
    const s = Math.max(cw / img.width, ch / img.height); g.drawImage(img, (cw - img.width * s) / 2, (ch - img.height * s) / 2, img.width * s, img.height * s);
    texture.image = c; texture.needsUpdate = true; plane.material.color.set(0xffffff); onLoad && onLoad(texture);
  };
  img.src = src;
  return { group, texture };
}

/** Socle cylindrique (verre, métal…) avec un anneau lumineux optionnel. */
export function pedestal({ radius = 1, height = 0.14, material, ring = null } = {}) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius, height, 96), material));
  let ringMat = null;
  if (ring) {
    ringMat = new THREE.MeshBasicMaterial({ color: ring, toneMapped: false });
    const r = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.93, 0.012, 8, 160), ringMat); r.rotation.x = Math.PI / 2; r.position.y = height / 2 + 0.005; group.add(r);
  }
  return { group, ringMat };
}

/** Anneau lumineux (halo, orbite, repère au sol). */
export function glowRing(radius, color, thickness = 0.012) {
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, depthWrite: false });
  return new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 240), mat);
}

/** Points lumineux qui flottent (poussière, lucioles, neige…). */
export function dust({ count = 400, area = [22, 9, 16], color, size = 0.07 } = {}) {
  const pos = new Float32Array(count * 3), sp = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - 0.5) * area[0]; pos[i * 3 + 1] = Math.random() * area[1] - area[1] / 3; pos[i * 3 + 2] = (Math.random() - 0.5) * area[2]; sp[i] = 0.2 + Math.random() * 0.8; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const points = new THREE.Points(g, new THREE.PointsMaterial({ size, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color, toneMapped: false }));
  const top = area[1] - area[1] / 3, bottom = -area[1] / 3;
  return {
    points,
    update(dt) { const a = g.attributes.position; for (let i = 0; i < count; i++) { let y = a.array[i * 3 + 1] + dt * 0.12 * sp[i]; if (y > top) y = bottom; a.array[i * 3 + 1] = y; } a.needsUpdate = true; },
  };
}

/**
 * Fond « aurore » animé (shader) : bandes de lumière douces aux couleurs de la marque.
 *   const a = aurora({ colorA: "#22c55e", colorB: "#1c6e7a", base: "#07090a" }); a.mesh.position.z = -9; scene.add(a.mesh);
 *   a.update(t, p)  // t = temps, p = progression (décale les bandes)
 */
export function aurora({ colorA = "#ffffff", colorB = "#8899ff", base = "#07090a", width = 40, height = 25, strength = 0.32 } = {}) {
  const v3 = (hex) => { const o = {}; new THREE.Color(hex).getRGB(o, THREE.SRGBColorSpace); return new THREE.Vector3(o.r, o.g, o.b); };
  const mat = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { t: { value: 0 }, s: { value: 0 }, cA: { value: v3(colorA) }, cB: { value: v3(colorB) }, cBase: { value: v3(base) }, k: { value: strength } },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 vUv;uniform float t,s,k;uniform vec3 cA,cB,cBase;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.02;a*=.5;}return v;}
      void main(){vec2 uv=vUv;vec2 p=uv*vec2(3.2,2.);float tt=t*.04+s*.6;
        float f=fbm(p+vec2(tt,-tt*.6)+fbm(p*1.6-tt));
        float band=smoothstep(.15,.9,f)*smoothstep(1.,.25,abs(uv.y-.55-.18*sin(uv.x*3.+tt*2.))*2.2);
        vec3 col=cBase+mix(cB,cA,smoothstep(.3,.8,uv.x+.2*sin(tt+uv.y*3.)))*band*k;
        col+=cA*pow(max(0.,1.-length((uv-vec2(.62,.48))*vec2(1.3,1.8))),3.)*.22;
        float v=smoothstep(.85,.25,length((uv-.5)*vec2(1.,1.3)));col*=mix(.25,1.,v);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  return { mesh, update(t, p = 0) { mat.uniforms.t.value = t; mat.uniforms.s.value = p; } };
}
