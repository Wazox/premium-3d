// Allège un modèle .glb / .gltf du client avant de le mettre en ligne (souvent 5 à 20 fois plus léger).
//
//   node tools/optimize.mjs produit.glb                 → produit.opt.glb (+ produit.mobile.glb)
//   node tools/optimize.mjs produit.glb img/produit.glb --texture 2048 --no-mobile
//
// Ce qu'il fait (gltf-transform, téléchargé par npx à la première utilisation, rien à installer) :
//   - géométrie compressée Meshopt (lue par lib/models.js sans fichier en plus), sommets fusionnés,
//     nœuds et matériaux inutiles retirés ;
//   - textures redimensionnées (2048 px par défaut, 1024 px pour la version mobile) et compressées :
//     KTX2 si l'outil toktx (KTX-Software) est installé (moins de mémoire graphique ; passer `stage`
//     à loadModel), sinon WebP, qui marche partout sans rien installer ;
//   - une version mobile plus légère : loadModel(innerWidth < 860 ? "x.mobile.glb" : "x.opt.glb").
// Options :
//   --texture N   taille max des textures (défaut 2048)
//   --ktx2        exiger KTX2 (erreur si toktx manque) ; --webp : forcer WebP
//   --no-mobile   ne pas produire la version mobile
//   --simplify R  garder environ R (0 à 1) des triangles (ex. 0.5) : pour un scan ou une CAO trop lourds
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CLI = "@gltf-transform/cli@4.5.1";
const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const size = Number(opt("--texture", 2048)), simplify = opt("--simplify", null);
const wantKtx = flag("--ktx2"), wantWebp = flag("--webp"), noMobile = flag("--no-mobile");
const [input, output0] = args;
if (!input || !fs.existsSync(input)) { console.log("Usage : node tools/optimize.mjs modele.glb [sortie.glb] [--texture 2048] [--ktx2|--webp] [--no-mobile] [--simplify 0.5]"); process.exit(1); }

const base = input.replace(/\.(glb|gltf)$/i, "");
const output = output0 || `${base}.opt.glb`;
const mobile = output.replace(/(\.opt)?\.glb$/i, ".mobile.glb");

const hasToktx = spawnSync(process.platform === "win32" ? "where" : "which", ["toktx"], { stdio: "ignore" }).status === 0;
if (wantKtx && !hasToktx) { console.log("ERREUR : --ktx2 demande l'outil toktx (KTX-Software : https://github.com/KhronosGroup/KTX-Software/releases)."); process.exit(1); }
const tex = wantWebp ? "webp" : wantKtx || hasToktx ? "ktx2" : "webp";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
function run(out, texSize) {
  const a = ["-y", CLI, "optimize", input, out, "--compress", "meshopt", "--texture-compress", tex, "--texture-size", String(texSize)];
  if (simplify) a.push("--simplify", "true", "--simplify-ratio", String(simplify));
  else a.push("--simplify", "false"); // ne jamais abîmer la silhouette d'un produit sans qu'on le demande
  /* Windows : npx est un .cmd, que Node ne lance qu'à travers le shell ; on met donc chaque
     argument entre guillemets (chemins avec espaces : « C:\Users\Mon Nom\… ») */
  const win = process.platform === "win32";
  execFileSync(npx, win ? a.map((x) => `"${x}"`) : a, { stdio: ["ignore", "ignore", "inherit"], shell: win });
}
const ko = (f) => Math.round(fs.statSync(f).size / 1024);

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
run(output, size);
console.log(`${input} : ${ko(input)} Ko → ${output} : ${ko(output)} Ko (textures ${tex}, ${size} px)`);
if (!noMobile) {
  run(mobile, Math.min(1024, size));
  console.log(`version mobile → ${mobile} : ${ko(mobile)} Ko (${Math.min(1024, size)} px)`);
}
if (tex === "ktx2") console.log("Textures KTX2 : passer stage à loadModel(url, { stage }) pour les lire.");
const budget = 2048; // Ko : au-delà, le premier affichage en 4G se fait attendre (references/performance.md)
if (ko(output) > budget) console.log(`À VÉRIFIER : ${ko(output)} Ko, plus de ${budget / 1024} Mo. Essayer --texture 1024, ou --simplify 0.5 si la géométrie est lourde (scan, CAO).`);
