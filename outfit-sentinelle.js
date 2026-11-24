// outfit-sentinelle.js — FRONT ZÉRO: SENTINELLE, the sentry set. Original design: a high-cut helmet with a curved sensor visor carrying three small lenses,
// a headset and a smooth respirator plate; a double-breasted greatcoat with a standing collar, shoulder straps and a belt, split front and back so the legs
// move freely (its tails follow the thighs); a plate carrier showing at the chest; knee-high boots; a folded ballistic shield with a viewport strapped
// on the back. Inside the soldier's hitbox. No insignia, rank or text.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, lerp, clamp, sstep, blend2, torsoSkin, buildSuit, buildGlove, buildBoot, buildPouch, buildGloveDetail, buildBootDetail, mapAt, screw, stitchLine, buckleAt, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';

const TAU = Math.PI * 2;
const pbr = { cloth: [.86, 0, 0, .85], cloth2: [.8, 0, 0, .5], plate: [.42, .12, 0, 0], plate2: [.5, .1, 0, 0], rubber: [.42, 0, 0, .1], visor: [.06, .55, .03, 0] };
const P = o => ({ pbr, ...o });
// cloth = greatcoat, cloth2 = trousers and webbing, plate = helmet and carrier plates, plate2 = shield and hard trims, rubber = boots (polished)

// ---------------------------------------------------------------- colourways
export const OUTFIT_SETS = [
  { id: 'sentinelle-garde', setId: 'sentinelle', name: 'SENTINELLE', colorway: 'Garde', rarity: 'Élite', palette: P({ cloth: 0x2c3850, cloth2: 0x2a2e36, plate: 0x464c56, plate2: 0x30353d, rubber: 0x15161a, metal: 0xc49a48, accent: 0xb08a3e, glow: 0x6fe0ff, visor: 0x0b1622, rim: 0x5c6880, lift: .035 }) },
  { id: 'sentinelle-rempart', setId: 'sentinelle', name: 'SENTINELLE', colorway: 'Rempart', rarity: 'Élite', palette: P({ cloth: 0x5a5c5e, cloth2: 0x34363a, plate: 0x4a4d52, plate2: 0x2e3034, rubber: 0x18191b, metal: 0x9aa0a6, accent: 0xb32a26, glow: 0xff5a4a, visor: 0x140a0a, rim: 0x6c7076, lift: .02 }) },
  { id: 'sentinelle-vigie', setId: 'sentinelle', name: 'SENTINELLE', colorway: 'Vigie', rarity: 'Élite', palette: P({ cloth: 0x4a5034, cloth2: 0x30342a, plate: 0x50553e, plate2: 0x2c3024, rubber: 0x1a1a16, metal: 0x9a9070, accent: 0xd99a2a, glow: 0xffc860, visor: 0x161008, rim: 0x5e6650, lift: .02 }) },
  { id: 'sentinelle-minuit', setId: 'sentinelle', name: 'SENTINELLE', colorway: 'Minuit', rarity: 'Légende', palette: P({ cloth: 0x1f2124, cloth2: 0x232528, plate: 0x34373c, plate2: 0x26282c, rubber: 0x101113, metal: 0xb8c0c8, accent: 0x9aa6b2, glow: 0xa8e8ff, visor: 0x0a0e14, rim: 0x7c8088, lift: .05 }) },
];

// ---------------------------------------------------------------- shapes
const CT = [[.95, .19, .15, .145], [1.02, .18, .14, .136], [1.09, .17, .132, .128], [1.16, .178, .136, .132], [1.24, .192, .144, .138], [1.32, .203, .15, .142], [1.39, .204, .148, .14], [1.44, .186, .134, .128], [1.475, .148, .112, .104]];
const ctAt = y => { if (y <= CT[0][0]) return CT[0]; for (let i = 0; i < CT.length - 1; i++) { const a = CT[i], b = CT[i + 1]; if (y <= b[0]) { const t = (y - a[0]) / (b[0] - a[0]); return a.map((v, k) => lerp(v, b[k], t)); } } return CT[CT.length - 1]; };
const ctP = (a, y, off = 0) => { const r = ctAt(y), s = Math.sin(a), c = Math.cos(a), p = 2 / 2.4; return [(r[1] + off) * Math.sign(s) * Math.abs(s) ** p, y, -((c > 0 ? r[2] : r[3]) + off) * Math.sign(c) * Math.abs(c) ** p]; };
const flat = (x, y, z) => [x, 0, z];
const legW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .1 + s * r * Math.sin(u), v, -r * Math.cos(u)]; };

// ---------------------------------------------------------------- greatcoat
function coat(m) {
  const n = m.seg(32, 12), rows = [];
  for (let y = .95; y <= 1.476; y += m.lod === 0 ? .03 : m.lod === 1 ? .07 : .13) rows.push(Math.min(y, 1.475));
  if (rows[rows.length - 1] < 1.475) rows.push(1.475);
  // upper coat: a loft round the torso, open in a narrow V at the chest where the carrier shows
  m.grid(n, rows.length - 1, (u, v) => { const a = (u - .5) * TAU + Math.PI, y = rows[Math.round(v * (rows.length - 1))], open = sstep(1.3, 1.44, y) * .3, aa = Math.PI + (a - Math.PI) * (1 - open / Math.PI), fold = m.lod === 2 ? 0 : .004 * Math.sin(aa * 5 + y * 13); return ctP(aa, y, fold); }, { slot: S.CLOTH, skin: torsoSkin, crease: 180, out: flat, ao: (x, y) => .74 + .26 * sstep(.95, 1.1, y) });
  // double-breasted front: overlapping flap with two rows of buttons (buttons in the close-range layer), lapels at the top
  panel(m, (u, v, h) => ctP(u, v, h + .006), -.08, .32, .95, u => 1.3 + .06 * u, { t: .006, nu: 4, nv: 8, slot: S.CLOTH, skin: torsoSkin, out: flat, edge: .12, round: .2 });
  for (const s of [-1, 1]) panel(m, (u, v, h) => ctP(u, v, h + .008), s * .14, s * .5, u => 1.3 + .1 * (Math.abs(u) - .14), u => 1.46 - .02 * Math.abs(u), { t: .006, nu: 4, nv: 3, slot: S.CLOTH, skin: torsoSkin, out: flat, edge: .12, round: .3 });
  // standing collar
  const nc = m.seg(24, 10);
  m.grid(nc, 2, (u, v) => { const a = lerp(.32, TAU - .32, u), y = lerp(1.462, 1.565, v), r = lerp(.15, .118, v) + .006 * Math.sin(v * Math.PI); return [r * Math.sin(a), y, .008 - r * .92 * Math.cos(a)]; }, { slot: S.CLOTH, skin: (x, y) => blend2(B.CHE, B.NEC, y, 1.51, .03), crease: 180, out: (x, y, z) => [x, 0, z], ao: (x, y) => .7 + .3 * sstep(1.47, 1.55, y) });
  // belt with a buckle plate, shoulder straps
  strapAlong(m, Array.from({ length: 24 }, (_, i) => ctP(i / 24 * TAU, 1.02, .0155)), .042, .0065, flat, { slot: S.CLOTH2, skin: torsoSkin, closed: true, n: m.seg(40, 14) });
  { const p0 = ctP(0, 1.02, .019), p1 = ctP(0, 1.02, .03); buckleAt(m, p0, [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], { up: [1, 0, 0], w: .05, d: .05, t: .0048, th: .0065, slot: S.METAL, skin: B.PEL }); }
  for (const s of [-1, 1]) strapAlong(m, [[s * .12, 1.475, -.05], [s * .16, 1.47, -.012], [s * .205, 1.455, .02]], .028, .005, (x, y, z) => [x * .3, 1, z * .3], { slot: S.CLOTH, skin: s < 0 ? () => [B.CHE, .7, B.UAL, .3] : () => [B.CHE, .7, B.UAR, .3], n: m.seg(6, 3) });
  // coat tails: two front panels and a back panel hung from the belt, following the thighs, open between them
  const tail = (s, u0, u1, back) => { const TH = s < 0 ? B.THL : B.THR, sk = (x, y) => { const k = sstep(.98, .6, y) * .72; return k < .01 ? [B.PEL, 1] : [B.PEL, 1 - k, TH, k]; };
    const pt = (u, v, off) => { const a = lerp(u0, u1, u), w = 1 + .045 * Math.sin(u * 11 + v * 2) * v * (m.lod === 2 ? .3 : 1), rx = lerp(.198, .236, v) * w + off, rz = lerp(.158, .19, v) * w + off, y = lerp(.985, .56 + .02 * Math.sin(u * 9), v); return [rx * Math.sin(a), y, .004 - rz * Math.cos(a)]; };
    const nu = m.seg(10, 4), nv = m.seg(7, 3);
    m.grid(nu, nv, (u, v) => pt(u, v, .002), { slot: S.CLOTH, skin: sk, crease: 180, out: flat, ao: (x, y) => .74 + .26 * sstep(.6, .9, y) });
    if (m.keep(1)) m.grid(nu, nv, (u, v) => pt(u, v, -.005), { slot: S.CLOTH2, skin: sk, crease: 180, out: (x, y, z) => [-x, 0, -z], ao: .5 }); void back; };
  for (const s of [-1, 1]) { tail(s, s * .28, s * 1.55, false); tail(s, s * 1.75, s * 2.95, true); }
  // sleeves: coat sleeves over the kit sleeve, turned-back cuffs; team band
  for (const s of [-1, 1]) {
    const nA = m.seg(12, 6), ry = [1.47, 1.43, 1.36, 1.28, 1.2, 1.155, 1.1, 1.02, .96], R = [.05, .08, .082, .076, .07, .068, .066, .061, .06];
    const sk = (x, y) => y > 1.0 ? blend2(s < 0 ? B.FAL : B.FAR, s < 0 ? B.UAL : B.UAR, y, 1.155, .045) : [s < 0 ? B.FAL : B.FAR, 1];
    m.loft(ry.map((y, i) => Array.from({ length: nA }, (_, k) => { const a = k / nA * TAU, r = R[i] + (m.lod === 2 ? 0 : .004 * Math.sin(a * 2 + y * 21)); return [s * .2 + s * r * Math.cos(a), y, r * Math.sin(a)]; })), { slot: S.CLOTH, skin: sk, crease: 180, capA: true, capB: true, out: (x, y, z) => [x - s * .2, 0, z], ao: (x, y) => .76 + .24 * sstep(1.0, 1.3, y) });
    m.revolve([[.061, .022], [.066, .016], [.066, -.016], [.062, -.022]], { sides: m.keep(1) ? 12 : 7, slot: S.CLOTH2, skin: s < 0 ? B.FAL : B.FAR, m: T(s * .2, .955, 0), crease: 50 });
    m.revolve([[.0805, .01], [.0835, .007], [.0835, -.007], [.0805, -.01]], { sides: m.keep(1) ? 16 : 8, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, m: T(s * .2, 1.3, 0), crease: 50 });
  }
}
function carrier(m) {
  // the plate showing in the opening of the coat, a pouch row low on it
  panel(m, (u, v, h) => ctP(u, v, h + .012), -.34, .34, 1.18, u => 1.44 - .1 * Math.abs(u), { t: .016, nu: 6, nv: 6, slot: S.PLATE, skin: torsoSkin, out: flat, edge: .1, round: .3, dome: .004 });
  if (m.keep(1)) panel(m, (u, v, h) => ctP(u, v, h + .028), -.12, .12, 1.4, 1.415, { t: .002, nu: 2, nv: 1, slot: S.ACCENT, skin: torsoSkin, out: flat, edge: .05, round: 0 });
  for (let i = -1; i <= 1; i++) buildPouch(m, .05, .07, .026, T(...ctP(i * .2, 1.21, .04), 0, Math.PI - i * .2, 0), { slot: S.CLOTH2, slotFlap: S.PLATE2, skin: torsoSkin, tab: false });
}

// ---------------------------------------------------------------- helmet, sensor visor, respirator
const HC = [0, 1.688, -.01], HR = [.13, .124, .146];
const hp = (lon, lat, off = 0) => { const c = Math.cos(lat), cut = 1 - .06 * Math.exp(-(((Math.abs(lon) - 1.57) / .5) ** 2)) * sstep(.1, -.3, lat); return [HC[0] + (HR[0] * cut + off) * Math.sin(lon) * c, HC[1] + (HR[1] + off) * Math.sin(lat), HC[2] - (HR[2] + off) * Math.cos(lon) * c]; };
const outH = (x, y, z) => [x - HC[0], y - HC[1] + .03, z - HC[2]];
function helmet(m) {
  const H = B.HEA;
  m.ell([0, 1.655, -.012], [.1, .104, .112], { slot: S.CLOTH2, skin: H, nu: 12, nv: 7, ao: .55 });
  // high-cut shell: the lower edge rises over the ears
  const lo = lon => lerp(-.62, -.15, Math.exp(-(((Math.abs(lon) - 1.57) / .55) ** 2))) + .48 * sstep(.95, .55, Math.abs(lon));
  m.grid(m.seg(30, 12), m.seg(9, 4), (u, v) => { const lon = u * TAU - Math.PI; return hp(lon, lerp(lo(lon), 1.5707, v)); }, { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 45, out: outH, ao: (x, y) => .72 + .28 * sstep(1.64, 1.76, y) });
  m.tube(Array.from({ length: 33 }, (_, i) => { const lon = i / 32 * TAU - Math.PI; return hp(lon, lo(lon) + .01, .002); }), .0045, { slot: S.RUBBER, skin: H, sides: m.keep(1) ? 4 : 3, n: m.seg(40, 14), cap: false, up: [0, 1, 0] });
  // curved sensor visor with three lenses
  m.grid(m.seg(16, 6), 1, (u, v) => hp(lerp(-.88, .88, u), lerp(.02, .3, v), .016), { slot: S.VISOR, skin: H, crease: 180, out: outH });
  panel(m, (u, v, h) => hp(u, v, h + .012), -.94, .94, u => -.02 + .01 * u * u, u => .34 - .04 * u * u, { t: .006, nu: 10, nv: 2, slot: S.PLATE2, skin: H, out: outH, edge: .08, round: .5 });
  for (const lon of [-.32, 0, .32]) { const [q, d] = mapAt(hp, lon, .15, .022); m.revolve([[.002, .006], [.013, .006], [.016, .0], [.016, -.008]], { sides: m.keep(1) ? 10 : 6, slot: S.PLATE2, skin: H, m: T(q[0], q[1], q[2], Math.PI / 2 - .1, lon, 0), crease: 40 }); if (m.keep(1)) m.revolve([[.002, .0065], [.009, .0065]], { sides: 10, slot: S.GLOW, skin: H, m: T(q[0], q[1], q[2], Math.PI / 2 - .1, lon, 0) }); void d; }
  // headset cups and rails
  for (const s of [-1, 1]) { m.revolve([[.002, .016], [.03, .016], [.036, .008], [.036, -.012]], { sides: m.keep(1) ? 12 : 7, slot: S.RUBBER, skin: H, m: T(s * .126, 1.65, .01, 0, 0, -s * Math.PI / 2), crease: 35 }); if (m.keep(1)) m.box([0, 0, 0], [.008, .012, .08], .002, { slot: S.METAL, skin: H, m: T(s * .132, 1.71, -.02, 0, 0, -s * .3) }); }
  // respirator plate over nose and mouth, two side filters
  panel(m, (u, v, h) => hp(u, v, h + .014 + .02 * Math.exp(-((u / .35) ** 2)) * sstep(-.7, -.25, v)), -.95, .95, -.92, -.04, { t: .01, nu: 10, nv: 6, slot: S.PLATE2, skin: H, out: outH, edge: .1, round: .5, dome: .004 });
  for (const s of [-1, 1]) m.revolve([[.002, .012], [.022, .012], [.026, .006], [.026, -.01]], { sides: m.keep(1) ? 10 : 6, slot: S.RUBBER, skin: H, m: T(s * .085, 1.59, -.12, Math.PI / 2 - .2, s * .7, 0), crease: 40 });
}

// ---------------------------------------------------------------- tall boots, trousers, shield
function legsAndBoots(m) {
  const n = m.seg(14, 7);
  for (const s of [-1, 1]) {
    const SH = s < 0 ? B.SHL : B.SHR, ry = [.47, .44, .38, .32, .27, .22], R = [.084, .082, .08, .076, .074, .074];
    m.loft(ry.map((y, i) => Array.from({ length: n }, (_, k) => { const a = k / n * TAU; return [s * .1 + R[i] * Math.sin(a), y, -R[i] * 1.06 * Math.cos(a) + .004]; })), { slot: S.RUBBER, skin: SH, crease: 180, capA: true, out: (x, y, z) => [x - s * .1, 0, z], ao: (x, y) => .8 + .2 * sstep(.3, .45, y) });
    m.revolve([[.0855, .008], [.0885, .004], [.0885, -.004], [.0855, -.008]], { sides: m.keep(1) ? 14 : 8, slot: S.PLATE2, skin: SH, m: T(s * .1, .47, .004, 0, 0, 0, 1, 1, 1.06), crease: 50 });
    const kr = (u, v) => .08 + .014 * Math.max(0, 1 - (u / 1.1) ** 2) * Math.max(0, 1 - ((v - .52) / .07) ** 2);
    panel(m, legW(s, kr), -1.1, 1.1, .48, .59, { t: .008, nu: 8, nv: 4, slot: S.PLATE, skin: (px, py) => blend2(SH, s < 0 ? B.THL : B.THR, py, .55, .03), out: (x, y, z) => [x - s * .1, 0, z], edge: .12, round: .6, dome: .003 });
  }
}
function shield(m) {
  const C = B.CHE, sm = (u, v, h) => [u, v, .2 + .06 * (u / .16) ** 2 * -1 + .055 + h];
  panel(m, sm, -.16, .16, 1.02, 1.44, { t: .012, nu: 6, nv: 6, slot: S.PLATE2, skin: C, out: () => [0, 0, 1], edge: .08, round: .4, dome: .006 });
  panel(m, (u, v, h) => sm(u, v, h + .012), -.07, .07, 1.33, 1.39, { t: .004, nu: 2, nv: 1, slot: S.VISOR, skin: C, out: () => [0, 0, 1], edge: .2, round: .5 });
  if (m.keep(1)) for (const y of [1.1, 1.36]) panel(m, (u, v, h) => sm(u, v, h + .012), -.17, .17, y - .008, y + .008, { t: .003, nu: 4, nv: 1, slot: S.CLOTH2, skin: C, out: () => [0, 0, 1], edge: .05, round: 0 });
  if (m.keep(1)) panel(m, (u, v, h) => sm(u, v, h + .012), -.14, .14, 1.415, 1.428, { t: .002, nu: 3, nv: 1, slot: S.ACCENT, skin: C, out: () => [0, 0, 1], edge: .05, round: 0 });
  for (const s of [-1, 1]) m.tube([[s * .1, 1.08, .19], [s * .12, 1.36, .19], [s * .122, 1.47, .1], [s * .118, 1.465, -.06], [s * .1, 1.36, -.17]], .011, { slot: S.CLOTH2, skin: torsoSkin, sides: 5, flat: .35, n: m.seg(12, 5), up: [1, 0, 0] });
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  for (const s of [-1, 1]) for (const y of [1.08, 1.18, 1.28]) { const p = ctP(s * .26 + .1, y, .014), q = ctP(s * .26 + .1, y, .024); m.revolve([[.002, .003], [.007, .003], [.0085, 0]], { sides: 8, slot: S.METAL, skin: torsoSkin, m: T(p[0], p[1], p[2], -Math.PI / 2, 0, 0), crease: 40 }); void q; }
  for (const s of [-1, 1]) { const [q, d] = mapAt(hp, s * 1.0, .45, .002); screw(m, q, d, { r: .0028, skin: B.HEA }); buckleAt(m, [s * .1, .47, -.086], [0, 0, -1], { skin: s < 0 ? B.SHL : B.SHR, w: .016, d: .012, t: .0025 }); }
  stitchLine(m, Array.from({ length: 9 }, (_, i) => ctP(-.08, lerp(.97, 1.29, i / 8), .013)), { skin: torsoSkin, n: 18 });
  buckleAt(m, [0, 1.02, -.175], [0, 0, -1], { skin: B.PEL, w: .04, d: .02, t: .004 });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.RUBBER }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  m => buildSuit(m, { slot: S.CLOTH2, slotLegs: S.CLOTH2, folds: .9, blouse: false }),        // knee-high boots: no blousing at the ankle
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.RUBBER, slotRand: S.RUBBER, slotSole: S.PLATE2, slotMid: S.RUBBER, slotTongue: S.RUBBER, slotPanel: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.RUBBER, slotCuff: S.CLOTH, guard: false, cuff: false }); },
  legsAndBoots, coat, carrier, helmet, shield,
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['suit', 'boots', 'gloves', 'legs', 'coat', 'carrier', 'helmet', 'shield']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
void clamp;
