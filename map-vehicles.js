/* FRONT ZÉRO : véhicules du contour des cartes, rendus avec vehicle-models.js.
   Purement visuel : aucune collision, aucun spawn, aucune navigation. Si ce module échoue, maps.js garde les anciens véhicules.
   - Un modèle (type, variante, épave, peinture) = une géométrie partagée, dessinée en instances, un lot par matériau.
   - Trois niveaux de détail choisis à l'exécution selon la distance à la caméra, sans allocation.
   - Ombres portées par un seul lot très simple (LOD2) par modèle ; il ne dessine rien dans la passe couleur.
   - Peinture et usure varient par instance. */
import * as THREE from 'three';
import { buildVehicle, vehicleStaticGeometry } from './vehicle-models.js';

const NEAR = 15, MID = 40, HYST = 3;
const PAINT = 0, CANVAS = 5, GLASS = 4;
/* Le nez des anciens véhicules est du côté -l, sauf le chariot élévateur (fourches vers +l). */
const NOSE_PLUS = { forklift: 1 };
/* Activé seulement là où la mesure exclusive est bonne : Dépôt, Vieille Ville, Noirval. Ailleurs, maps.js garde les anciens véhicules
   (Sept-Vents : +17 % sur une paire ; Port, Col Blanc, Bunker : image non mesurée). Ajouter l'ambiance ici une fois mesurée. */
const PROVEN = new Set(['desert', 'urban', 'refinery']);
const hex = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const CIVIL = [0x7c8a94, 0x8e3a2e, 0xb9ad8e, 0x3e5872, 0x4a5f4c, 0xa8843a, 0x6c6a66, 0xc9c6bc];
const PAL = {
  car: CIVIL, van: [0xc9c6bc, 0xb9ad8e, 0x7c8a94, 0x8f8f86], bus: [0x2f6d6e, 0xb98a35, 0x8e3a2e, 0x3e5872],
  tractor: [0x2f5a3c, 0x8e3026, 0x2f4f78], forklift: [0xc99a24, 0xc26a22, 0xb9a22c], logtruck: [0x8e3026, 0x2f5a44, 0x3a5578, 0x8a6a2c],
  tracked: [0xc7601e, 0xb5352a, 0xc99a24], fuselage: [0xd9d6cc, 0xc4c6c6, 0xd4cdbc], wagon: [0x7e2e22, 0x5e3e2c, 0x4e555a, 0x6e4a2a, 0x3f4f5c],
  cart: [0xc99a24, 0x5b6240, 0xb9642a],
};
const CAMO = { desert: 'desert', airbase: 'desert', urban: 'woodland', valley: 'woodland', snow: 'winter', refinery: 'woodland', port: 'woodland', bunker: 'woodland' };

/* Géométries déjà envoyées au GPU, gardées d'une carte à l'autre si elles resservent. */
const cache = new Map();
const wrap = (g, start, count) => { const o = new THREE.BufferGeometry(); o.setIndex(g.index); for (const k in g.attributes) o.setAttribute(k, g.attributes[k]); o.setDrawRange(start, count); o.boundingSphere = g.boundingSphere; o.boundingBox = g.boundingBox; return o; };
function lodSet(spec, lod) {
  const key = spec.key + '|' + lod; let e = cache.get(key); if (e) return e;
  const v = buildVehicle(spec.type, { lod, wreck: spec.wreck, seed: spec.seed, paint: spec.paint, variant: spec.variant, doors: false }), g = vehicleStaticGeometry(v);
  e = { v, g, parts: g.groups.map(q => ({ geo: wrap(g, q.start, q.count), mat: q.materialIndex })), shadow: null, key }; cache.set(key, e); return e;
}
function release(keep) { for (const [key, e] of cache) { if (keep.has(key)) continue; for (const p of e.parts) p.geo.dispose(); if (e.shadow) e.shadow.dispose(); e.g.dispose(); e.parts = []; e.shadow = null; cache.delete(key); } }

const hash = (x, z, s) => { const q = Math.sin(x * 12.9898 + z * 78.233 + s * 37.719) * 43758.5453; return q - Math.floor(q); };
function specFor(q, env) {
  const o = q.o || {}, t = q.type, wreck = !!q.wreck, r = hash(q.x, q.z, 1);
  let variant = '', paint, base = null;
  if (t === 'truck') variant = o.flat ? 'flat' : o.tarp === 'tarpR' ? 'red' : '';
  else if (t === 'wagon') variant = o.tank ? 'tank' : ''; else if (t === 'tracked') variant = o.snow ? 'snow' : '';
  if (t === 'truck' || t === 'apc') paint = CAMO[env] || 'woodland';
  else if (t === 'tanker') paint = 'silver';
  else { paint = 0xe6e6e6; let list = PAL[t] || CIVIL; if (t === 'cart' && o.m === 'paint') list = [0x5b6240]; else if (t === 'cart' && o.m === 'pipeY') list = [0xc99a24, 0xb9a22c]; else if (t === 'car' && o.body === 'plasterO') list = [0xb98a35, 0xa8843a]; base = hex(list[Math.floor(hash(q.x, q.z, 2) * list.length) % list.length]); }
  const seed = wreck ? 1 + (r < .5 ? 1 : 0) : 1, key = [t, variant, wreck ? 1 : 0, paint, seed].join('/');
  /* usure : ton, léger jaunissement, et décoloration vers un gris poussiéreux */
  const tone = .84 + hash(q.x, q.z, 3) * .24, warm = (hash(q.x, q.z, 4) - .5) * .07, fade = hash(q.x, q.z, 5) * .22, tint = [1, 1, 1];
  if (base) { const k = 1 / .79; for (let i = 0; i < 3; i++) tint[i] = base[i] * k; const g = (tint[0] + tint[1] + tint[2]) / 3; for (let i = 0; i < 3; i++) tint[i] += (g * 1.02 - tint[i]) * fade; }
  /* épave : la suie cuite dans les sommets est presque noire, on la remonte pour lire la tôle brûlée et la rouille */
  if (wreck) { tint[0] = 2.15; tint[1] = 1.95; tint[2] = 1.8; }
  tint[0] *= tone * (1 + warm); tint[1] *= tone; tint[2] *= tone * (1 - warm);
  const cloth = .84 + hash(q.x, q.z, 6) * .26;
  return { key, type: t, variant, wreck, paint, seed, tint, cloth };
}

const shadowMat = new THREE.ShaderMaterial({ vertexShader: 'void main(){gl_Position=vec4(2.,2.,2.,1.);}', fragmentShader: 'void main(){gl_FragColor=vec4(0.);}', colorWrite: false, depthWrite: false, depthTest: false });
const showShadow = function () { this.geometry.setDrawRange(0, this.userData.n); }, hideShadow = function () { this.geometry.setDrawRange(0, 0); };
/* qualité basse (ombres coupées) : pas de niveau 0, pas de verre au niveau 2 */
let LOWV = false;
const m4 = new THREE.Matrix4(), mR = new THREE.Matrix4(), mS = new THREE.Matrix4(), mC = new THREE.Matrix4();

/* Une carte : begin() -> prepare() (générateur, avant la boucle des opérations) -> attach(root) -> update(camera) à chaque image. */
export function begin(L, E) {
  if (!PROVEN.has(L.env)) return null;
  const list = L.vehicles || [], envKey = L.env, models = new Map(), meshes = [];
  let lastCam = null; const run = { ok: false, models: [], tick: 0, stats: { vehicles: list.length, models: 0, meshes: 0 } };
  run.prepare = function* () {
    try {
      for (const q of list) { const s = specFor(q, envKey); let m = models.get(s.key); if (!m) { m = { spec: s, items: [] }; models.set(s.key, m); } m.items.push({ q, s }); }
      const keep = new Set(); for (const m of models.values()) for (let l = 0; l < 3; l++) keep.add(m.spec.key + '|' + l); release(keep); yield;
      for (const m of models.values()) { m.lods = [null, null, null]; for (let l = 2; l >= 0; l--) { const key = m.spec.key + '|' + l; if (!cache.has(key)) { buildVehicle(m.spec.type, { lod: l, wreck: m.spec.wreck, seed: m.spec.seed, paint: m.spec.paint, variant: m.spec.variant, doors: false }); yield; } m.lods[l] = lodSet(m.spec, l); yield; } }
      for (const m of models.values()) {
        const v0 = m.lods[0].v, bb = v0.bounds, sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z, cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, n = m.items.length;
        m.mats = new Float32Array(n * 16); m.cols = new Float32Array(n * 3); m.cloth = new Float32Array(n * 3); m.px = new Float32Array(n); m.pz = new Float32Array(n); m.lim = new Float32Array(n * 4); m.cur = new Uint8Array(n).fill(2); m.n = n;
        m.items.forEach(({ q, s }, i) => {
          /* tient dans l'emprise de l'ancien véhicule : L, W, et H s'il a une collision */
          let k = Math.min(1, (q.L - .02) / sz, (q.W - .02) / sx); if (q.H) k = Math.min(k, (q.H - .02) / (bb.max.y)); const a = q.ry + (NOSE_PLUS[q.type] ? -Math.PI / 2 : Math.PI / 2);
          m4.makeTranslation(q.x, 0, q.z); mR.makeRotationY(a); mS.makeScale(k, k, k); mC.makeTranslation(-cx, 0, -cz); m4.multiply(mR).multiply(mS).multiply(mC); m4.toArray(m.mats, i * 16);
          m.cols.set(s.tint, i * 3); m.cloth[i * 3] = m.cloth[i * 3 + 1] = m.cloth[i * 3 + 2] = s.cloth; m.px[i] = q.x; m.pz[i] = q.z; { /* distance au bord du véhicule, pas à son centre : un fuselage de 30 m reste détaillé quand on est contre son nez */ const r = Math.max(sz, sx) * k * .5, sq = v => v * v, j = i * 4; m.lim[j] = sq(NEAR + r); m.lim[j + 1] = sq(NEAR + HYST + r); m.lim[j + 2] = sq(MID + r); m.lim[j + 3] = sq(MID + HYST + r); }
        });
        let R = 0, X = 0, Z = 0; for (let i = 0; i < n; i++) { X += m.px[i] / n; Z += m.pz[i] / n; } for (let i = 0; i < n; i++) R = Math.max(R, Math.hypot(m.px[i] - X, m.pz[i] - Z)); m.sphere = new THREE.Sphere(new THREE.Vector3(X, 2, Z), R + Math.hypot(sx, sz, bb.max.y) * .6);
        m.slots = m.lods.map(e => { const mat = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16), col = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3), clo = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); mat.setUsage(THREE.DynamicDrawUsage); col.setUsage(THREE.DynamicDrawUsage); clo.setUsage(THREE.DynamicDrawUsage); return { mat, col, clo, meshes: [] }; });
        const mats = v0.materials;
        m.lods.forEach((e, l) => { const S = m.slots[l]; for (const p of e.parts) { const im = new THREE.InstancedMesh(p.geo, mats[p.mat], n); im.instanceMatrix = S.mat; im.instanceColor = p.mat === PAINT ? S.col : p.mat === CANVAS ? S.clo : null; im.castShadow = false; im.receiveShadow = p.mat !== GLASS; im.matrixAutoUpdate = false; im.boundingSphere = m.sphere; im.count = 0; im.visible = false; im.name = 'veh-' + m.spec.type + '-l' + l; im.userData.dropLow = p.mat === GLASS && l === 2; S.meshes.push(im); meshes.push(im); } });
        /* ombre : LOD2 complet, invisible en passe couleur (plage vide), plage rendue juste pour la passe d'ombre */
        const e2 = m.lods[2]; if (!e2.shadow) { e2.shadow = wrap(e2.g, 0, 0); } const sh = new THREE.InstancedMesh(e2.shadow, shadowMat, n); sh.instanceMatrix.array.set(m.mats); sh.instanceMatrix.needsUpdate = true; sh.castShadow = true; sh.receiveShadow = false; sh.frustumCulled = false; sh.matrixAutoUpdate = false; sh.userData.n = e2.g.index.count; sh.onBeforeShadow = showShadow; sh.onAfterShadow = hideShadow; sh.name = 'veh-shadow-' + m.spec.type; m.sh = sh; m.shN = -1; meshes.push(sh);
        fill(m); run.models.push(m); yield;
      }
      for (const mat of m0Materials(run.models)) mat.envMapIntensity = E.envI ?? 1;
      run.stats.models = models.size; run.stats.meshes = meshes.length; run.ok = true;
    } catch (e) { console.warn('[map-vehicles] repli sur les anciens véhicules', e); run.ok = false; for (const im of meshes) { try { im.dispose(); } catch { /* rien */ } } }
  };
  run.attach = root => { for (const im of meshes) root.add(im); };
  run.update = c => { if (c) lastCam = c; if (!run.ok || !c || (++run.tick & 7)) return; try { for (let j = 0; j < run.models.length; j++) { const m = run.models[j], cur = m.cur; let dirty = false; for (let i = 0; i < m.n; i++) { const dx = m.px[i] - c.x, dz = m.pz[i] - c.z, d = dx * dx + dz * dz, o = cur[i]; const q = i * 4, L = m.lim; let l = d < (o === 0 ? L[q + 1] : L[q]) ? 0 : d < (o <= 1 ? L[q + 3] : L[q + 2]) ? 1 : 2; if (l !== o) { cur[i] = l; dirty = true; } } if (dirty) fill(m); shFill(m, c); } } catch { run.ok = false; } };
  run.setLow = v => { v = !!v; LOWV = v; try { for (const m of run.models) { m.cur.fill(9); if (m.sh) m.sh.visible = !v; } run.tick = 7; run.update(lastCam); } catch { /* le prochain tick recalcule */ } };
  return run;
}
/* ombres : seuls les véhicules à moins de SH_R m de la caméra entrent dans la passe d'ombre (instances regroupées en tête) */
const SH_R2 = 70 * 70;
function shFill(m, c) {
  const sh = m.sh; if (!sh) return; const a = sh.instanceMatrix.array; let n = 0, key = 0;
  for (let i = 0; i < m.n; i++) { const dx = m.px[i] - c.x, dz = m.pz[i] - c.z; if (dx * dx + dz * dz < SH_R2) { key = (key * 31 + i + 1) % 1000003; n++; } }
  const sig = n * 1000003 + key; if (sig === m.shN) return; m.shN = sig; let k = 0;
  for (let i = 0; i < m.n; i++) { const dx = m.px[i] - c.x, dz = m.pz[i] - c.z; if (dx * dx + dz * dz < SH_R2) { const o = i * 16, t = k++ * 16; for (let e = 0; e < 16; e++) a[t + e] = m.mats[o + e]; } }
  if (!k) { for (let e = 0; e < 16; e++) a[e] = 0; } sh.count = k || 1; sh.instanceMatrix.needsUpdate = true;
}
function m0Materials(models) { const s = new Set(); for (const m of models) for (const x of m.lods[0].v.materials) s.add(x); return s; }
function fill(m) {
  for (let l = 0; l < 3; l++) { const S = m.slots[l]; let c = 0; for (let i = 0; i < m.n; i++) { if (m.cur[i] !== l) continue; const k = i * 16, t = c * 16, a = S.mat.array, b = m.mats; for (let e = 0; e < 16; e++) a[t + e] = b[k + e]; const q = i * 3, w = c * 3; S.col.array[w] = m.cols[q]; S.col.array[w + 1] = m.cols[q + 1]; S.col.array[w + 2] = m.cols[q + 2]; S.clo.array[w] = m.cloth[q]; S.clo.array[w + 1] = m.cloth[q + 1]; S.clo.array[w + 2] = m.cloth[q + 2]; c++; } S.mat.needsUpdate = true; S.col.needsUpdate = true; S.clo.needsUpdate = true; /* niveau vide : une instance dégénérée (matrice nulle), masquée en jeu ; le préchauffage du chargement la dessine quand même, donc le pilote prépare ce lot avant le match */ if (!c) { S.mat.array.fill(0, 0, 16); } for (let j = 0; j < S.meshes.length; j++) { S.meshes[j].count = c || 1; S.meshes[j].visible = c > 0 && !(LOWV && S.meshes[j].userData.dropLow); } }
}
