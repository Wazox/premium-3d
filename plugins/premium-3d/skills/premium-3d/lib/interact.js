/*
 * premium-3d / interact.js
 * Interactions : attraper un objet pour le faire tourner (avec inertie), survol d'objets,
 * lumière qui suit le pointeur, inclinaison selon le gyroscope du téléphone.
 */
import * as THREE from "three";

/**
 * Tourner un objet à la souris / au doigt, avec inertie et retour doux à une position de repos.
 *   const spin = dragRotate(stage.renderer.domElement, objet, { returnHome: true });
 *   // dans la boucle : spin.update(dt)
 */
export function dragRotate(el, object, { speed = 0.006, damping = 4, returnHome = false, homeStrength = 1.2, limitX = 0.6 } = {}) {
  const vel = { x: 0, y: 0 }, base = { x: object.rotation.x, y: object.rotation.y };
  let down = false, lx = 0, ly = 0, idle = 0;
  el.style.touchAction = "pan-y";
  el.style.cursor = "grab";
  el.addEventListener("pointerdown", (e) => { down = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); el.style.cursor = "grabbing"; });
  el.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    object.rotation.y += dx * speed; object.rotation.x = THREE.MathUtils.clamp(object.rotation.x + dy * speed, base.x - limitX, base.x + limitX);
    vel.y = dx * speed * 60; vel.x = dy * speed * 60; idle = 0;
  });
  const up = () => { down = false; el.style.cursor = "grab"; };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  return {
    get dragging() { return down; },
    update(dt) {
      if (down) return;
      object.rotation.y += vel.y * dt; object.rotation.x = THREE.MathUtils.clamp(object.rotation.x + vel.x * dt, base.x - limitX, base.x + limitX);
      const f = Math.exp(-damping * dt); vel.x *= f; vel.y *= f; idle += dt;
      if (returnHome && idle > 1.5) {
        const k = 1 - Math.exp(-homeStrength * dt);
        const ty = base.y + Math.round((object.rotation.y - base.y) / (Math.PI * 2)) * Math.PI * 2;
        object.rotation.y += (ty - object.rotation.y) * k; object.rotation.x += (base.x - object.rotation.x) * k;
      }
    },
  };
}

/**
 * Survol : appelle onEnter/onLeave sur l'objet survolé parmi `targets` (raycast limité à 30 fois/s).
 *   const hover = hoverPick(stage, [a, b, c], { onEnter: (o) => ..., onLeave: (o) => ... });
 */
export function hoverPick(stage, targets, { onEnter, onLeave, onClick } = {}) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let current = null, pending = false;
  const el = stage.renderer.domElement;
  const top = (o) => { while (o && !targets.includes(o)) o = o.parent; return o; };
  const pick = () => {
    pending = false; ray.setFromCamera(ndc, stage.camera);
    const hit = ray.intersectObjects(targets, true)[0]; const o = hit ? top(hit.object) : null;
    if (o !== current) { if (current && onLeave) onLeave(current); current = o; if (o && onEnter) onEnter(o); el.style.cursor = o && onClick ? "pointer" : ""; }
  };
  el.addEventListener("pointermove", (e) => { const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); if (!pending) { pending = true; setTimeout(pick, 33); } });
  el.addEventListener("pointerleave", () => { if (current && onLeave) onLeave(current); current = null; });
  if (onClick) el.addEventListener("click", () => current && onClick(current));
  return { get current() { return current; } };
}

/**
 * Lumière ponctuelle qui suit le pointeur (sur tout le document), lissée.
 *   const pl = pointerLight(stage, { color: hdr(accent, 1), intensity: 30, z: 3 }); // boucle : pl.update(dt)
 */
export function pointerLight(stage, { color = 0xffffff, intensity = 20, distance = 12, z = 3, range = [4, 2.5] } = {}) {
  const light = new THREE.PointLight(color, intensity, distance, 2); light.position.set(0, 0, z); stage.scene.add(light);
  const target = { x: 0, y: 0 };
  addEventListener("pointermove", (e) => { target.x = (e.clientX / innerWidth - 0.5) * 2 * range[0]; target.y = -(e.clientY / innerHeight - 0.5) * 2 * range[1]; }, { passive: true });
  return { light, update(dt) { const k = 1 - Math.exp(-6 * dt); light.position.x += (target.x - light.position.x) * k; light.position.y += (target.y - light.position.y) * k; } };
}

/** Inclinaison au gyroscope (mobile). iOS demande une autorisation : appeler request() sur un clic. */
export function tilt({ max = 0.25 } = {}) {
  const v = { x: 0, y: 0 };
  const on = (e) => { v.x = THREE.MathUtils.clamp((e.beta - 45) / 45, -1, 1) * max; v.y = THREE.MathUtils.clamp(e.gamma / 45, -1, 1) * max; };
  addEventListener("deviceorientation", on);
  return {
    value: v,
    async request() { if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) { try { await DeviceOrientationEvent.requestPermission(); } catch (e) {} } },
  };
}
