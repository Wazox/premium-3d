/*
 * premium-3d / shaders.js
 * Effets de matière injectés dans les matériaux standard de three.js (ils gardent l'éclairage,
 * les reflets et la transmission) :
 *   liquify(material, opts)   la surface ondule comme du métal fondu, de la gélatine, de l'eau
 *   dissolve(material, opts)  l'objet apparaît / disparaît en se consumant, avec un bord lumineux
 *   blobGeometry(), discGeometry()  sphère et disque très subdivisés, prêts pour liquify
 * Chaque fonction renvoie les uniforms à animer dans la boucle.
 *
 * Bruit simplex 3D : Ian McEwan, Ashima Arts (licence MIT).
 */
import * as THREE from "three";

export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

function chain(material, fn) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); fn(sh, r); };
  material.customProgramCacheKey = () => (material.userData.p3dKey || "") ;
}

/**
 * Surface liquide : déplacement par bruit le long de la normale, normales recalculées
 * (l'éclairage suit les vagues). La géométrie doit être assez subdivisée (ex. IcosahedronGeometry(1, 64)).
 * @returns uniforms { uTime, uAmp, uFreq, uSpeed } à animer : u.uTime.value = t
 */
export function liquify(material, { amp = 0.12, freq = 0.9, speed = 0.35, octaves = 1 } = {}) {
  const u = { uTime: { value: 0 }, uAmp: { value: amp }, uFreq: { value: freq }, uSpeed: { value: speed } };
  material.userData.p3dKey = (material.userData.p3dKey || "") + "liquid" + octaves;
  chain(material, (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
uniform float uTime,uAmp,uFreq,uSpeed;
${NOISE}
float p3dField(vec3 p){float f=0.,a=1.,s=1.;for(int i=0;i<${octaves};i++){f+=a*snoise(p*uFreq*s+vec3(0.,uTime*uSpeed*s,uTime*uSpeed*.6));a*=.5;s*=2.03;}return f;}
vec3 p3dDisp(vec3 p,vec3 n){return p+n*p3dField(p)*uAmp;}`)
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
{vec3 t=normalize(abs(objectNormal.y)<.99?cross(objectNormal,vec3(0.,1.,0.)):cross(objectNormal,vec3(1.,0.,0.)));
 vec3 b=normalize(cross(objectNormal,t));float e=.01;
 vec3 p0=p3dDisp(position,objectNormal);vec3 p1=p3dDisp(position+t*e,objectNormal);vec3 p2=p3dDisp(position+b*e,objectNormal);
 objectNormal=normalize(cross(p1-p0,p2-p0));}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
transformed=p3dDisp(position,normal);`);
  });
  material.needsUpdate = true;
  return u;
}

/**
 * Apparition / disparition par combustion : les pixels où le bruit < uProgress sont gardés,
 * avec un liseré lumineux de couleur `edge` à la frontière.
 * uProgress = 0 → invisible, 1 → entier. Penser à material.transparent = false (le discard suffit).
 * @returns uniforms { uProgress, uEdge, uScale }
 */
export function dissolve(material, { edge = new THREE.Color(4, 2, 0.6), width = 0.06, scale = 2.2 } = {}) {
  const u = { uProgress: { value: 1 }, uEdgeColor: { value: edge }, uEdge: { value: width }, uScale: { value: scale } };
  material.userData.p3dKey = (material.userData.p3dKey || "") + "dissolve";
  chain(material, (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vP3dPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvP3dPos=position;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vP3dPos;uniform float uProgress,uEdge,uScale;uniform vec3 uEdgeColor;
${NOISE}`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
float p3dN=snoise(vP3dPos*uScale)*.5+.5;float p3dT=uProgress*(1.+uEdge)-uEdge;
if(p3dN>p3dT+uEdge)discard;`)
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
{float k=smoothstep(p3dT+uEdge,p3dT,p3dN);gl_FragColor.rgb=mix(uEdgeColor,gl_FragColor.rgb,k);}`);
  });
  material.needsUpdate = true;
  return u;
}

/** Forme « goutte » prête pour liquify : sphère très subdivisée. */
export function blobGeometry(radius = 1, detail = 64) {
  return new THREE.IcosahedronGeometry(radius, detail);
}

/**
 * Disque plat très subdivisé, prêt pour liquify : surface d'un liquide dans un bol, une tasse, un
 * verre, une piscine (CircleGeometry n'a pas assez de sommets au centre pour onduler).
 * Couché à plat (normale vers le haut, axe Y). rings × segments sommets.
 *   const surface = new THREE.Mesh(discGeometry(1.2), mat); liquify(mat, { amp: 0.03, freq: 2.5 });
 * Pour une surface rectangulaire : new THREE.PlaneGeometry(w, h, 128, 128).rotateX(-Math.PI / 2).
 */
export function discGeometry(radius = 1, rings = 48, segments = 96) {
  const pos = [], uv = [], idx = [];
  pos.push(0, 0, 0); uv.push(0.5, 0.5);
  for (let r = 1; r <= rings; r++) {
    const rr = (r / rings) * radius;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      pos.push(x, 0, z); uv.push(0.5 + x / (2 * radius), 0.5 - z / (2 * radius));
    }
  }
  const at = (r, s) => (r === 0 ? 0 : 1 + (r - 1) * segments + (s % segments));
  for (let s = 0; s < segments; s++) idx.push(0, at(1, s + 1), at(1, s));
  for (let r = 1; r < rings; r++) for (let s = 0; s < segments; s++) {
    const a = at(r, s), b = at(r, s + 1), c = at(r + 1, s), d = at(r + 1, s + 1);
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
