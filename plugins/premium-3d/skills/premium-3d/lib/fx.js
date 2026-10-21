/*
 * premium-3d / fx.js
 * Effets de caméra en post-traitement, à ajouter au composer de createStage :
 *   grain de film, aberration chromatique, vignette (une seule passe légère) et profondeur de champ.
 *
 *   import { addLensFx, addDepthOfField } from "./lib/fx.js";
 *   const lens = addLensFx(stage, { grain: 0.06, aberration: 0.0025, vignette: 0.35 });
 *   const dof = addDepthOfField(stage, { focus: 8, aperture: 0.002 });   // gourmand : éviter sur mobile
 *   // boucle : lens.update(t) ; dof.focus(distance)
 */
import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";

function insertBeforeOutput(stage, pass) {
  const c = stage.composer; if (!c) return false;
  const i = c.passes.indexOf(stage.outputPass); // référence directe : sûr même si le code est minifié
  c.insertPass(pass, i < 0 ? c.passes.length : i);
  return true;
}

export function addLensFx(stage, { grain = 0.05, aberration = 0.002, vignette = 0.3 } = {}) {
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: grain }, uAb: { value: aberration }, uVig: { value: vignette } },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uGrain,uAb,uVig;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){vec2 d=vUv-.5;float r=dot(d,d);vec2 o=d*uAb*(1.+r*4.);
        vec3 c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
        c*=1.-uVig*smoothstep(.1,.6,r*1.6);
        c+=(h(vUv*vec2(1920.,1080.)+fract(uTime*7.))-.5)*uGrain;
        gl_FragColor=vec4(c,1.);}`,
  });
  const ok = insertBeforeOutput(stage, pass);
  return { pass, active: ok, update(t) { pass.uniforms.uTime.value = t; } };
}

export function addDepthOfField(stage, { focus = 8, aperture = 0.0015, maxblur = 0.008 } = {}) {
  if (stage.LOW) return { pass: null, focus() {} };
  const pass = new BokehPass(stage.scene, stage.camera, { focus, aperture, maxblur });
  const ok = insertBeforeOutput(stage, pass);
  return { pass, active: ok, focus(d) { pass.uniforms.focus.value = d; } };
}
