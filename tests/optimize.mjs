// Contrôle de tools/optimize.mjs : fabrique un .glb lourd (sphère de 80 000 triangles + texture
// 4096 px), l'allège, et vérifie que les sorties existent, sont plus légères et se relisent.
//   node tests/optimize.mjs        (CI ; télécharge gltf-transform par npx à la première fois)
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p3d opt ")); // espace exprès : chemins Windows
const input = path.join(dir, "produit.glb");

/* PNG 4096×4096 en dégradé (assez lourd pour que le redimensionnement compte) */
function png(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { const o = y * (w * 3 + 1); for (let x = 0; x < w; x++) { raw[o + 1 + x * 3] = x & 255; raw[o + 2 + x * 3] = y & 255; raw[o + 3 + x * 3] = (x ^ y) & 255; } }
  const crc = (b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const doc = new Document(), buf = doc.createBuffer(), N = 200, pos = [], uv = [], idx = [];
for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
  const u = (i / N) * Math.PI, v = (j / N) * 2 * Math.PI;
  pos.push(Math.sin(u) * Math.cos(v), Math.cos(u), Math.sin(u) * Math.sin(v)); uv.push(j / N, i / N);
}
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j; idx.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1); }
const tex = doc.createTexture("couleur").setImage(png(4096, 4096)).setMimeType("image/png");
const prim = doc.createPrimitive()
  .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buf))
  .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(uv)).setBuffer(buf))
  .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(idx)).setBuffer(buf))
  .setMaterial(doc.createMaterial("m").setBaseColorTexture(tex));
doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(prim)));
await new NodeIO().write(input, doc);

const out = execFileSync(process.execPath, [path.join(ROOT, "plugins/premium-3d/skills/premium-3d/tools/optimize.mjs"), input, "--webp"], { encoding: "utf8" });
console.log(out.trim());

const errors = [];
const opt = path.join(dir, "produit.opt.glb"), mob = path.join(dir, "produit.mobile.glb");
const kb = (f) => fs.statSync(f).size / 1024;
for (const f of [opt, mob]) if (!fs.existsSync(f)) errors.push(`${path.basename(f)} absent`);
if (!errors.length) {
  if (kb(opt) >= kb(input)) errors.push(`pas plus léger : ${kb(input) | 0} Ko → ${kb(opt) | 0} Ko`);
  if (kb(mob) > kb(opt)) errors.push("la version mobile est plus lourde que l'autre");
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  for (const f of [opt, mob]) {
    const d = await io.read(f);
    const used = d.getRoot().listExtensionsUsed().map((e) => e.extensionName);
    if (!used.includes("EXT_meshopt_compression")) errors.push(`${path.basename(f)} : géométrie non compressée Meshopt (${used.join(", ")})`);
    if (!used.includes("EXT_texture_webp")) errors.push(`${path.basename(f)} : textures pas en WebP`);
    const tris = d.getRoot().listMeshes()[0].listPrimitives()[0].getIndices().getCount() / 3;
    if (tris < 70000) errors.push(`${path.basename(f)} : ${tris} triangles, la silhouette a été simplifiée sans --simplify`);
  }
}
fs.rmSync(dir, { recursive: true, force: true });
if (errors.length) { console.error(`ÉCHEC :\n- ${errors.join("\n- ")}`); process.exit(1); }
console.log("OK");
