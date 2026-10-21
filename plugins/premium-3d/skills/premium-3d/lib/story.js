/*
 * premium-3d / story.js
 * Raconter une scène en plusieurs temps au scroll, proprement :
 *   acts()        découpe la progression P (0→1) en actes nommés, avec la progression locale de chacun
 *   steps()       progression « à paliers » : chaque état reste lisible avant de passer au suivant
 *   captionSync() légendes HTML synchronisées : l'ancienne sort, PUIS la nouvelle entre
 *                 (jamais deux textes l'un sur l'autre), accessible (aria-hidden sur les inactives)
 *
 *   import { acts, steps, captionSync } from "./lib/story.js";
 *   const story = acts([["graine", 0, 0.3], ["fusion", 0.3, 0.65], ["logo", 0.65, 1]]);
 *   const caps = captionSync(document.querySelectorAll(".caption"));
 *   // boucle : const a = story.at(P); caps.show(a.index); objet.scale.setScalar(story.k("fusion", P));
 */
import { ss } from "./core.js";

/** defs : [[nom, début, fin], ...] dans l'ordre. */
export function acts(defs) {
  const list = defs.map(([name, from, to], index) => ({ name, from, to, index }));
  const byName = Object.fromEntries(list.map((a) => [a.name, a]));
  return {
    list,
    /** l'acte en cours et sa progression locale k (0→1) */
    at(P) {
      let a = list[0];
      for (const x of list) if (P >= x.from) a = x;
      return { name: a.name, index: a.index, k: Math.min(1, Math.max(0, (P - a.from) / (a.to - a.from))) };
    },
    /** progression locale d'un acte, adoucie (0 avant, 1 après) */
    k(name, P, smooth = true) {
      const a = byName[name]; if (!a) return 0;
      return smooth ? ss(a.from, a.to, P) : Math.min(1, Math.max(0, (P - a.from) / (a.to - a.from)));
    },
  };
}

/**
 * Progression à paliers entre n états : renvoie une valeur entre 0 et n-1 qui reste fixe sur
 * chaque état pendant une part `hold` de son intervalle, puis transite en douceur.
 * Idéal pour particleMorph.set() ou une caméra qui va d'un objet à l'autre.
 */
export function steps(P, n, hold = 0.45) {
  if (n < 2) return 0;
  const s = Math.min(n - 1 - 1e-6, Math.max(0, P) * (n - 1));
  const i = Math.floor(s), f = s - i, t = Math.min(1, Math.max(0, (f - hold) / (1 - hold)));
  return i + t * t * (3 - 2 * t);
}

let cssDone = false;
function injectCss(outMs, inMs) {
  if (cssDone) return; cssDone = true;
  const st = document.createElement("style");
  st.textContent = `[data-p3d-cap]{opacity:0;transform:translateY(12px);transition:opacity ${outMs}ms ease,transform ${outMs}ms ease;pointer-events:none}
[data-p3d-cap].p3d-on{opacity:1;transform:none;transition:opacity ${inMs}ms ease ${outMs}ms,transform ${inMs}ms ease ${outMs}ms;pointer-events:auto}
@media (prefers-reduced-motion:reduce){[data-p3d-cap],[data-p3d-cap].p3d-on{transition:none;transform:none}}`;
  document.head.appendChild(st);
}

/**
 * Légendes synchronisées. elements : NodeList/Array de blocs de texte superposés (même position).
 * show(i) n'agit que si l'index change (aucune écriture DOM inutile dans la boucle).
 */
export function captionSync(elements, { outMs = 250, inMs = 600 } = {}) {
  const els = [...elements];
  injectCss(outMs, inMs);
  els.forEach((el, i) => { el.setAttribute("data-p3d-cap", ""); el.setAttribute("aria-hidden", "true"); });
  let cur = -1;
  const api = {
    show(i) {
      if (i === cur) return;
      if (els[cur]) { els[cur].classList.remove("p3d-on"); els[cur].setAttribute("aria-hidden", "true"); }
      cur = i;
      if (els[cur]) { els[cur].classList.add("p3d-on"); els[cur].removeAttribute("aria-hidden"); }
    },
    get current() { return cur; },
  };
  api.show(0);
  return api;
}
