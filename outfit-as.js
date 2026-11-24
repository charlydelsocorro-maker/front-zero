// outfit-as.js — FRONT ZÉRO: AS, the fighter-pilot set. Original design: a rounded flight helmet with a visor housing and a tinted visor down,
// an oxygen mask with its ribbed hose to a chest regulator, a one-piece flight suit (collar, zip, chest and pen pockets), anti-g trousers over it
// (abdominal bladder, thigh and calf sleeves, side lacing, inflation hose), a torso harness of yellow webbing with leg loops and metal fittings,
// a kneeboard strapped to the right thigh. No insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, lerp, clamp, sstep, blend2, torsoSkin, buildSuit, buildGlove, buildBoot, buildHose, buildGloveDetail, buildBootDetail, mapAt, faceTo, screw, stitchLine, buckleAt, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';

const TAU = Math.PI * 2;
const pbr = { accent: [.8, 0, .06, .45], plate: [.3, .05, 0, 0], plate2: [.46, .1, 0, 0], rubber: [.6, 0, 0, .12], visor: [.06, .6, .02, 0], glow: [.78, 0, 0, .15] };       // glow: not lit here, it is the black of the boot soles
const P = o => ({ pbr, fpKit: 'plain', fpStrap: 'accent', ...o, glow: 0x121212 });

// ---------------------------------------------------------------- colourways (accent = the yellow harness, in every colourway)
export const OUTFIT_SETS = [
  { id: 'as-sauge', setId: 'as', name: 'AS', colorway: 'Sauge', rarity: 'Élite', palette: P({ cloth: 0x3b412f, cloth2: 0x2e3326, plate: 0xc3c6bf, plate2: 0x30322e, rubber: 0x2c2520, metal: 0x9aa0a4, accent: 0xe8c21a, glow: 0x9fe07a, visor: 0x15171b, rim: 0x5c6450, lift: .016, fpGlove: 0x3a3028 }) },
  { id: 'as-nuit', setId: 'as', name: 'AS', colorway: 'Nuit', rarity: 'Légende', palette: P({ cloth: 0x191b1f, cloth2: 0x121416, plate: 0x30353b, plate2: 0x17191c, rubber: 0x151515, metal: 0x80878d, accent: 0xf0c419, glow: 0xffd34a, visor: 0x0a0c11, rim: 0x7c8086, lift: .045 }) },
  { id: 'as-sable', setId: 'as', name: 'AS', colorway: 'Sable', rarity: 'Élite', palette: P({ cloth: 0x5f5238, cloth2: 0x4a402e, plate: 0xb8b19d, plate2: 0x38352f, rubber: 0x3b2d21, metal: 0x8e8b80, accent: 0xe6b81c, glow: 0xffd27a, visor: 0x1b1409, rim: 0x5c5040, lift: .012, fpGlove: 0x4a3a2a }) },
  { id: 'as-ciel', setId: 'as', name: 'AS', colorway: 'Ciel', rarity: 'Élite', palette: P({ cloth: 0x3c4a5e, cloth2: 0x2e3947, plate: 0xc6cacf, plate2: 0x2e3945, rubber: 0x1f2327, metal: 0xa9b1b9, accent: 0xf2c51c, glow: 0x9fdcff, visor: 0x0b1828, rim: 0x4c5a68, lift: .02 }) },
];

// ---------------------------------------------------------------- body surfaces the straps lie on
const TR = [[.95, .17, .128], [.99, .172, .13], [1.03, .164, .122], [1.09, .156, .116], [1.16, .162, .118], [1.24, .175, .124], [1.32, .186, .129], [1.39, .187, .128], [1.435, .17, .116], [1.47, .13, .096]];
const trAt = y => { if (y <= TR[0][0]) return TR[0]; for (let i = 0; i < TR.length - 1; i++) { const a = TR[i], b = TR[i + 1]; if (y <= b[0]) { const t = (y - a[0]) / (b[0] - a[0]); return a.map((v, k) => lerp(v, b[k], t)); } } return TR[TR.length - 1]; };
const torsoP = (a, y, off = 0) => { const r = trAt(y), s = Math.sin(a), c = Math.cos(a); return [(r[1] + off) * Math.sign(s) * Math.abs(s) ** .8, y, -(r[2] + off) * Math.sign(c) * Math.abs(c) ** .8]; };
const radialOut = (x, y, z) => [x, y > 1.46 ? .9 : 0, z];
const legW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .1 + s * r * Math.sin(u), v, -r * Math.cos(u)]; };
const armW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .2 + s * r * Math.cos(u), v, r * Math.sin(u)]; };

// ---------------------------------------------------------------- helmet, visor, oxygen mask
const HC = [0, 1.676, -.006], HR = [.13, .133, .146];
const latLo = lon => lerp(-1.0, .3, sstep(1.42, .95, Math.abs(lon)));
const hp = (lon, lat, off = 0) => {
  const al = Math.abs(lon), ear = 1 + .075 * Math.exp(-(((al - 1.57) / .38) ** 2) - (((lat + .38) / .32) ** 2)), rear = 1 + .025 * Math.exp(-(((al - Math.PI) / .8) ** 2) - (((lat - .1) / .5) ** 2)), k = ear * rear, c = Math.cos(lat);
  return [HC[0] + (HR[0] * k + off) * Math.sin(lon) * c, HC[1] + (HR[1] + off) * Math.sin(lat), HC[2] - (HR[2] * k + off) * Math.cos(lon) * c];
};
const outH = (x, y, z) => [x - HC[0], y - HC[1] + .02, z - HC[2]];
function helmet(m) {
  const H = B.HEA, nu = m.seg(36, 14), nv = m.seg(10, 5);
  m.ell([0, 1.655, -.008], [.104, .108, .116], { slot: S.RUBBER, skin: H, nu: 12, nv: 7, ao: .5 });       // liner: nothing shows through the face opening
  m.grid(nu, nv, (u, v) => { const lon = u * TAU - Math.PI; return hp(lon, lerp(latLo(lon), 1.5707, v ** .9)); }, { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 50, out: outH, ao: (x, y) => .72 + .28 * sstep(1.6, 1.72, y) });
  // rubber edge trim all round the opening
  m.tube(Array.from({ length: 41 }, (_, i) => { const lon = i / 40 * TAU - Math.PI; return hp(lon, latLo(lon) + .015, .001); }), .0046, { slot: S.RUBBER, skin: H, sides: m.keep(1) ? 5 : 3, n: m.seg(48, 16), cap: false, up: [0, 1, 0] });
  // visor housing over the brow, its adjusting knob, the visor down under it
  panel(m, (u, v, h) => hp(u, v, h + .001), -1.32, 1.32, u => .25 + .1 * (u / 1.32) ** 2, u => .64 - .14 * (u / 1.32) ** 2, { t: .014, nu: 18, nv: 4, slot: S.PLATE2, skin: H, out: outH, dome: .003, edge: .08 });
  m.revolve([[.002, .012], [.0105, .012], [.0125, .008], [.0125, -.004]], { sides: m.keep(1) ? 10 : 6, slot: S.METAL, skin: H, m: (() => { const [p, d] = mapAt(hp, 0, .6, .015); return faceTo(p, d); })(), crease: 40 });
  m.grid(m.seg(22, 8), m.seg(5, 2), (u, v) => { const lon = lerp(-1.22, 1.22, u), lo = -.32 + .1 * (lon / 1.22) ** 2; return hp(lon, lerp(lo, .3, v), .017); }, { slot: S.VISOR, skin: H, crease: 180, out: outH });
  if (m.keep(1)) m.tube(Array.from({ length: 13 }, (_, i) => { const lon = lerp(-1.2, 1.2, i / 12); return hp(lon, -.32 + .1 * (lon / 1.22) ** 2, .018); }), .0026, { slot: S.PLATE2, skin: H, sides: 4, n: m.seg(20, 8) });
  // team stripes along the sides of the shell
  if (m.keep(1)) for (const s of [-1, 1]) panel(m, (u, v, h) => hp(s * u, v, h + .001), 1.45, 2.75, u => .13 + .03 * sstep(1.45, 2.75, u), u => .16 + .03 * sstep(1.45, 2.75, u), { t: .0016, nu: 10, nv: 1, slot: S.TEAM, skin: H, out: outH, edge: .05, round: 0 });
  // bayonet receivers low on each side
  for (const s of [-1, 1]) { const [p, d] = mapAt(hp, s * 1.3, -.3, .004); m.box([0, 0, 0], [.022, .03, .012], .004, { slot: S.PLATE2, skin: H, m: T(p[0] + d[0] * .5, p[1], p[2] + d[2] * .5, 0, s * (Math.PI / 2 - 1.3), 0) }); }
}
function oxygenMask(m) {
  const H = B.HEA, n = m.seg(16, 8);
  const rows = [[-.09, .062, .058, 1.6], [-.122, .058, .053, 1.598], [-.148, .047, .044, 1.593], [-.166, .032, .032, 1.589], [-.175, .02, .02, 1.587]];
  const ring = (z, rx, ry, cy) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, c = Math.cos(a), s = Math.sin(a), top = s > 0 ? 1 - .32 * s : 1; return [rx * top * Math.sign(c) * Math.abs(c) ** .82, cy + ry * Math.sign(s) * Math.abs(s) ** .9, z]; });
  m.loft(rows.map(r => ring(r[0], r[1], r[2], r[3])), { slot: S.PLATE2, skin: H, crease: 40, capB: true, out: [0, 1.6, -.08] });
  m.loft([ring(-.078, .068, .063, 1.6), ring(-.094, .066, .061, 1.6)], { slot: S.RUBBER, skin: H, crease: 60, out: [0, 1.6, -.04] });       // face seal
  m.revolve([[.002, .006], [.011, .006], [.0125, .002], [.0125, -.008]], { sides: m.keep(1) ? 10 : 6, slot: S.METAL, skin: H, m: T(0, 1.588, -.176, -Math.PI / 2, 0, 0), crease: 40 });     // valve
  m.revolve([[.013, .006], [.0145, 0], [.013, -.012]], { sides: m.keep(1) ? 10 : 6, slot: S.RUBBER, skin: H, m: T(0, 1.556, -.146, .35, 0, 0), crease: 40 });           // hose fitting under the mask
  // straps from the mask to the bayonet receivers
  for (const s of [-1, 1]) { const [p] = mapAt(hp, s * 1.3, -.3, .01); strapAlong(m, [[s * .058, 1.604, -.11], [s * .082, 1.606, -.094], [s * .108, 1.618, -.068], [p[0], p[1], p[2]]], .014, .0035, (x, y, z) => [x, 0, z + .02], { slot: S.RUBBER, skin: H, n: m.seg(6, 3) }); }
  // ribbed hose down to the regulator on the left of the chest
  buildHose(m, [[0, 1.55, -.146], [-.008, 1.5, -.172], [-.035, 1.43, -.19], [-.068, 1.365, -.186], [-.088, 1.318, -.174]], .0118, H, B.CHE, { ribs: m.keep(0) ? 10 : 0, ribDepth: .25, sides: m.keep(1) ? 7 : 4, t0: .12, t1: .42 });
  m.box([-.094, 1.3, -.168], [.04, .032, .02], .006, { slot: S.PLATE2, skin: B.CHE });
  if (m.keep(1)) m.revolve([[.0125, .006], [.014, 0], [.0125, -.006]], { sides: 8, slot: S.METAL, skin: B.CHE, m: T(-.09, 1.322, -.172, .5, 0, 0), crease: 40 });
}

// ---------------------------------------------------------------- flight suit: collar, zip, pockets, sleeves
function flightSuit(m) {
  const n = m.seg(24, 10);
  // band collar, open in a V at the front
  m.grid(n, 2, (u, v) => { const a = lerp(.42, TAU - .42, u), y = lerp(1.462, 1.545, v), r = lerp(.112, .088, v) + .004 * Math.sin(v * Math.PI); return [r * Math.sin(a), y + .012 * Math.cos(a) * (1 - v), .004 - r * .9 * Math.cos(a)]; }, { slot: S.CLOTH, skin: (x, y) => blend2(B.CHE, B.NEC, y, 1.5, .03), crease: 180, out: (x, y, z) => [x, 0, z] });
  // front zip and its pull
  if (m.keep(1)) m.tube(Array.from({ length: 9 }, (_, i) => torsoP(0, lerp(1.0, 1.455, i / 8), .012)), .0024, { slot: S.METAL, skin: torsoSkin, sides: 3, n: m.seg(16, 6), cap: false });
  if (m.keep(1)) m.box([0, 1.436, -.142], [.008, .018, .004], .0015, { slot: S.METAL, skin: torsoSkin });
  // angled zip pockets high on the chest
  for (const s of [-1, 1]) panel(m, (u, v, h) => torsoP(u, v, h + .011), s * .1, s * .46, u => 1.3 + .05 * (Math.abs(u) - .1), u => 1.39 + .03 * (Math.abs(u) - .1), { t: .004, nu: 5, nv: 3, slot: S.CLOTH2, skin: torsoSkin, out: (x, y, z) => [x, 0, z], edge: .12, round: .4 });
  // left sleeve: pen pocket with three pens; right sleeve: a blank leather patch
  panel(m, armW(-1, .07), -1.05, -.05, 1.26, 1.37, { t: .004, nu: 6, nv: 3, slot: S.CLOTH2, skin: B.UAL, out: (x, y, z) => [x + .2, 0, z], edge: .12 });
  if (m.keep(1)) for (let k = 0; k < 3; k++) { const [p] = mapAt(armW(-1, .074), -.85 + k * .17, 1.37, 0); m.revolve([[.0032, .012], [.0036, .008], [.0036, -.012]], { sides: 6, slot: k === 1 ? S.ACCENT : S.METAL, skin: B.UAL, m: T(p[0], p[1], p[2]), crease: 40 }); }
  panel(m, armW(1, .07), -.55, .55, 1.29, 1.37, { t: .003, nu: 5, nv: 3, slot: S.RUBBER, skin: B.UAR, out: (x, y, z) => [x - .2, 0, z], edge: .15, round: .8 });
  // team bands on both sleeves
  for (const s of [-1, 1]) m.revolve([[.0662, .0105], [.0694, .007], [.0694, -.007], [.0662, -.0105]], { sides: m.keep(1) ? 16 : 8, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, m: T(s * .2, 1.215, 0), crease: 50 });
  // cuffs gathered at the wrist
  for (const s of [-1, 1]) m.revolve([[.047, .012], [.0505, .008], [.0505, -.008], [.047, -.012]], { sides: m.keep(1) ? 12 : 7, slot: S.CLOTH, skin: s < 0 ? B.FAL : B.FAR, m: T(s * .2, .93, 0), crease: 50 });
}

// ---------------------------------------------------------------- anti-g trousers and their hose
function gSuit(m) {
  const n = m.seg(26, 10), ring = (y, rx, rz, cx = 0, cz = .004) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU; return [cx + rx * Math.sin(a), y, cz - rz * Math.cos(a)]; });
  // abdominal bladder
  const ab = [[.972, .17, .132], [1.0, .182, .143], [1.06, .177, .139], [1.12, .168, .131], [1.14, .158, .122]];
  m.loft(ab.map(r => ring(r[0], r[1], r[2])), { slot: S.CLOTH2, skin: torsoSkin, crease: 180, out: (x, y, z) => [x, 0, z], ao: .9 });
  for (const s of [-1, 1]) {
    const TH = s < 0 ? B.THL : B.THR, SH = s < 0 ? B.SHL : B.SHR, ls = (x, y) => y > .75 ? blend2(TH, B.PEL, y, .95, .025) : blend2(SH, TH, y, .53, .04), nL = m.seg(16, 8);
    const lr = (y, r) => Array.from({ length: nL }, (_, i) => { const a = i / nL * TAU, b = 1 + .025 * Math.sin(a * 3 + y * 20); return [s * .1 + r * b * Math.sin(a), y, -r * b * Math.cos(a) + .003]; });
    const th = [[.91, .108], [.86, .113], [.78, .109], [.7, .1], [.63, .091], [.6, .086]], cf = [[.46, .074], [.43, .079], [.38, .081], [.33, .076], [.285, .069]];
    m.loft(th.map(r => lr(r[0], r[1])), { slot: S.CLOTH2, skin: ls, crease: 180, out: (x, y, z) => [x - s * .1, 0, z], ao: .9 });
    m.loft(cf.map(r => lr(r[0], r[1])), { slot: S.CLOTH2, skin: SH, crease: 180, out: (x, y, z) => [x - s * .1, 0, z], ao: .9 });
    // cargo pocket on the outer thigh, with its flap
    panel(m, legW(s, .109), 1.0, 2.0, .66, .83, { t: .012, nu: 6, nv: 4, slot: S.CLOTH2, skin: TH, out: (x, y, z) => [x - s * .1, 0, z], edge: .12, round: .4 });
    if (m.keep(1)) panel(m, legW(s, .121), .95, 2.05, .79, .84, { t: .005, nu: 6, nv: 2, slot: S.CLOTH, skin: TH, out: (x, y, z) => [x - s * .1, 0, z], edge: .15, round: .3 });
    // lacing strips on the outside of thigh and calf
    if (m.keep(1)) { panel(m, legW(s, (u, v) => lerp(.09, .112, sstep(.6, .88, v))), 1.47, 1.67, .62, .89, { t: .003, nu: 1, nv: 4, slot: S.RUBBER, skin: TH, out: (x, y, z) => [x - s * .1, 0, z], edge: .1, round: 0 }); panel(m, legW(s, .079), 1.47, 1.67, .3, .44, { t: .003, nu: 1, nv: 3, slot: S.RUBBER, skin: SH, out: (x, y, z) => [x - s * .1, 0, z], edge: .1, round: 0 }); }
  }
  // inflation hose from the left hip, ending in its quick connector
  buildHose(m, [[-.168, 1.01, -.07], [-.205, .96, -.075], [-.218, .9, -.07], [-.214, .855, -.07]], .0118, B.PEL, B.THL, { ribs: m.keep(0) ? 8 : 0, ribDepth: .22, sides: m.keep(1) ? 7 : 4, t0: .3, t1: .75 });
  m.revolve([[.0125, .012], [.015, .006], [.015, -.012], [.011, -.016]], { sides: m.keep(1) ? 10 : 6, slot: S.METAL, skin: B.THL, m: T(-.213, .84, -.07), crease: 40 });
  // kneeboard on the right thigh: board, sheet, clip, elastic strap
  const kb = legW(1, .125);
  panel(m, kb, .15, 1.05, .655, .825, { t: .006, nu: 5, nv: 3, slot: S.PLATE2, skin: B.THR, out: (x, y, z) => [x - .1, 0, z], edge: .1, round: .5 });
  if (m.keep(1)) panel(m, legW(1, .1312), .22, .98, .665, .8, { t: .0012, nu: 4, nv: 2, slot: S.PLATE, skin: B.THR, out: (x, y, z) => [x - .1, 0, z], edge: .05, round: .1 });
  if (m.keep(1)) panel(m, legW(1, .1326), .45, .75, .79, .83, { t: .004, nu: 2, nv: 1, slot: S.METAL, skin: B.THR, out: (x, y, z) => [x - .1, 0, z], edge: .2, round: .5 });
  m.revolve([[.1115, .009], [.1145, .005], [.1145, -.005], [.1115, -.009]], { sides: m.keep(1) ? 18 : 9, slot: S.RUBBER, skin: B.THR, m: T(.1, .735, .003), crease: 50 });
}

// ---------------------------------------------------------------- harness: yellow webbing, metal fittings, leg loops
function harness(m) {
  const W = .044, TH = .0042, n = k => m.seg(k, 4);
  for (const s of [-1, 1]) {
    const LEG = s < 0 ? B.THL : B.THR;
    // shoulder strap: waist front, up the chest, over the shoulder, down the back
    strapAlong(m, [torsoP(s * .5, 1.0, .024), torsoP(s * .52, 1.12, .02), torsoP(s * .55, 1.25, .022), torsoP(s * .6, 1.36, .023), torsoP(s * .78, 1.435, .02), [s * .112, 1.49, -.045], [s * .116, 1.497, .02], torsoP(s * (Math.PI - .76), 1.43, .02), torsoP(s * (Math.PI - .6), 1.33, .021), torsoP(s * (Math.PI - .55), 1.2, .021), torsoP(s * (Math.PI - .52), 1.05, .026)],
      W, TH, radialOut, { slot: S.ACCENT, skin: (x, y) => y > 1.47 ? [B.CHE, .8, B.NEC, .2] : torsoSkin(x, y), n: n(40) });
    // leg loop round the thigh, and the strap that joins it to the waist
    const loop = Array.from({ length: 12 }, (_, i) => { const th = i / 12 * TAU, R = .1155; return [s * Math.max(.0045, .1 + R * Math.sin(th)), .842 + .022 * (1 - Math.cos(th)) + .03 * Math.max(0, -Math.sin(th)), -R * Math.cos(th) + .003]; });        // the inner side runs along the centre seam
    strapAlong(m, loop, W * .9, TH, (x, y, z) => [x - s * .1, 0, z], { slot: S.ACCENT, skin: LEG, closed: true, n: n(24) });
    strapAlong(m, [torsoP(s * .5, 1.0, .024), [s * .096, .94, -.14], [s * .1, .872, -.121]], W * .9, TH, (x, y, z) => [x, 0, z - .02], { slot: S.ACCENT, skin: (x, y) => { const k = sstep(.97, .87, y); return k <= 0 ? [B.PEL, 1] : k >= 1 ? [LEG, 1] : [B.PEL, 1 - k, LEG, k]; }, n: n(8) });
    // fittings: a quick-release plate on each strap at the chest, a buckle on each leg loop
    const [p] = [torsoP(s * .58, 1.335, .03)];
    m.box([0, 0, 0], [.036, .03, .009], .004, { slot: S.METAL, skin: torsoSkin, m: T(p[0], p[1], p[2], 0, -s * .5, 0) });
    if (m.keep(1)) m.revolve([[.002, .004], [.0085, .004], [.0098, 0]], { sides: 10, slot: S.PLATE2, skin: torsoSkin, m: T(p[0] - s * .003, p[1], p[2] - .006, -Math.PI / 2, 0, 0), crease: 40 });
    const q = [s * .1, .862, -.12];
    m.box([0, 0, 0], [.04, .022, .008], .003, { slot: S.METAL, skin: LEG, m: T(q[0], q[1], q[2]) });
  }
  // chest strap with its central buckle, back strap, waist strap
  strapAlong(m, Array.from({ length: 7 }, (_, i) => torsoP(lerp(-.6, .6, i / 6), 1.29, .028)), W * .85, TH, radialOut, { slot: S.ACCENT, skin: torsoSkin, n: n(14) });
  m.box([0, 1.29, -.168], [.05, .036, .012], .006, { slot: S.METAL, skin: torsoSkin });
  if (m.keep(1)) m.box([0, 1.29, -.175], [.03, .02, .004], .002, { slot: S.PLATE2, skin: torsoSkin });
  strapAlong(m, Array.from({ length: 7 }, (_, i) => torsoP(Math.PI + lerp(-.62, .62, i / 6), 1.2, .03)), W * .85, TH, radialOut, { slot: S.ACCENT, skin: torsoSkin, n: n(12) });
  strapAlong(m, Array.from({ length: 16 }, (_, i) => torsoP(i / 16 * TAU, 1.035, .027)), W, TH, radialOut, { slot: S.ACCENT, skin: torsoSkin, closed: true, n: n(40) });
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  const H = B.HEA;
  // helmet: screws on the housing and receivers, a seam round the shell
  for (const s of [-1, 1]) { for (const [l, a] of [[1.15, .38], [.6, .5]]) { const [q, d] = mapAt(hp, s * l, a, .016); screw(m, q, d, { r: .0028, skin: H }); } const [q, d] = mapAt(hp, s * 1.3, -.3, .011); screw(m, q, d, { r: .003, skin: H }); }
  stitchLine(m, Array.from({ length: 25 }, (_, i) => hp(Math.PI + lerp(-1.6, 1.6, i / 24), .95, .0012)), { skin: H, n: 40, slot: S.PLATE2 });
  // mask: two screws on the shell
  for (const s of [-1, 1]) screw(m, [s * .036, 1.606, -.148], [s * .5, .3, -1], { r: .0024, skin: H });
  // suit: stitched pocket outlines, zip lines on the pockets
  for (const s of [-1, 1]) {
    stitchLine(m, Array.from({ length: 7 }, (_, i) => { const u = s * lerp(.11, .45, i / 6); return torsoP(u, 1.388 + .03 * (Math.abs(u) - .1) - .006, .0158); }), { skin: torsoSkin, n: 12, slot: S.METAL, r: .0014 });
    stitchLine(m, Array.from({ length: 6 }, (_, i) => legW(s, .1215)(lerp(1.0, 2.0, i / 5), .783, .0005)), { skin: s < 0 ? B.THL : B.THR, n: 12 });
    // lacing zigzag on the outer thigh
    const lz = []; for (let k = 0; k <= 10; k++) lz.push(legW(s, (u, v) => lerp(.09, .112, sstep(.6, .88, v)))(k % 2 ? 1.5 : 1.64, lerp(.64, .87, k / 10), .0042));
    m.tube(lz, .0013, { slot: S.CLOTH, skin: s < 0 ? B.THL : B.THR, sides: 3, n: 30, cap: false, tension: 0 });
    // bar tacks on the shoulder straps
    for (const y of [1.17, 1.4]) { const p = torsoP(s * (y > 1.3 ? .66 : .53), y, .025); m.box([0, 0, 0], [.03, .009, .002], .0008, { slot: S.ACCENT, skin: torsoSkin, m: T(p[0], p[1], p[2], 0, -s * .55, 0), stitch: 1 }); }
    // velcro tab on each cuff
    m.box([0, 0, 0], [.016, .022, .004], .0015, { slot: S.CLOTH2, skin: s < 0 ? B.FAL : B.FAR, m: T(s * .2 + s * .05, .93, -.012, 0, 0, 0) });
  }
  buckleAt(m, [0, 1.035, -.153], [0, 0, -1], { skin: B.PEL, w: .05, d: .02, t: .004 });
  // stitched webbing: two lines of stitching along every strap
  const ST = { skin: torsoSkin, slot: S.CLOTH2, r: .0009 };
  for (const s of [-1, 1]) for (const d of [-1, 1]) {
    stitchLine(m, [[.5, 1.0, .026], [.52, 1.12, .022], [.55, 1.25, .024], [.6, 1.36, .025], [.78, 1.435, .022]].map(([a, y, o]) => torsoP(s * a + d * .088, y, o + .0024)), { ...ST, n: 30 });
    stitchLine(m, [[.55, 1.2, .023], [.6, 1.33, .023], [.76, 1.43, .022]].map(([a, y, o]) => torsoP(s * (Math.PI - a) + d * .088, y, o + .0024)), { ...ST, n: 20 });
  }
  for (const d of [-1, 1]) {
    stitchLine(m, Array.from({ length: 7 }, (_, i) => torsoP(lerp(-.58, .58, i / 6), 1.29 + d * .0145, .0326)), { ...ST, n: 24 });
    stitchLine(m, Array.from({ length: 17 }, (_, i) => torsoP(i / 16 * TAU, 1.035 + d * .017, .0316)), { ...ST, n: 60 });
  }
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.RUBBER }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  m => buildSuit(m, { slot: S.CLOTH, slotLegs: S.CLOTH, folds: 1.25 }),
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.RUBBER, slotRand: S.RUBBER, slotSole: S.GLOW, slotMid: S.GLOW, slotWelt: S.GLOW, slotTongue: S.RUBBER, slotPanel: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.RUBBER, slotCuff: S.CLOTH, guard: false, cuff: false }); },
  flightSuit, gSuit, harness, helmet, oxygenMask,
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['suit', 'boots', 'gloves', 'flightSuit', 'gSuit', 'harness', 'helmet', 'mask']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
void clamp;
