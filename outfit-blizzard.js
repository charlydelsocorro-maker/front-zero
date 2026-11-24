// outfit-blizzard.js — FRONT ZÉRO: BLIZZARD, the arctic set. Original design: a quilted parka to the hips with a storm flap, chest and side pockets and a
// drawcord waist, a hood up with a fur ruff round the face, wide ski goggles over a knitted face gaiter, insulated trousers with knee patches and snow gaiters
// over the boots, padded over-gloves, a rucksack with a rolled sleeping mat and a pair of snowshoes strapped on. Inside the soldier's hitbox. No insignia.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, lerp, clamp, sstep, blend2, torsoSkin, legSkin, buildSuit, buildGlove, buildBoot, buildPouch, buildGloveDetail, buildBootDetail, mapAt, screw, stitchLine, buckleAt, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';

const TAU = Math.PI * 2;
const pbr = { cloth: [.88, 0, 0, .8], cloth2: [.93, 0, 0, 1], plate: [.9, 0, 0, .7], accent: [.97, 0, 0, .7], plate2: [.6, .05, 0, 0], visor: [.06, .6, .03, 0] };
const P = o => ({ pbr, fpKit: 'plain', ...o });
// cloth = parka, cloth2 = knit and webbing, plate = trousers, plate2 = hard gear (goggle frame, snowshoe frames), accent = the fur ruff

// ---------------------------------------------------------------- colourways
export const OUTFIT_SETS = [
  { id: 'blizzard-banquise', setId: 'blizzard', name: 'BLIZZARD', colorway: 'Banquise', rarity: 'Légende', palette: P({ cloth: 0x5c6870, cloth2: 0x2e353b, plate: 0x3e464c, plate2: 0x262b2f, rubber: 0x1c2024, metal: 0x7e888e, accent: 0xb8ab94, glow: 0xbfe8ff, visor: 0x2a4e66, rim: 0x5a666e, lift: .012 }) },
  { id: 'blizzard-toundra', setId: 'blizzard', name: 'BLIZZARD', colorway: 'Toundra', rarity: 'Élite', palette: P({ cloth: 0x5f6656, cloth2: 0x33382e, plate: 0x3e4438, plate2: 0x22261e, rubber: 0x1a1c17, metal: 0x7a7f72, accent: 0x8c7d64, glow: 0xd8e8a0, visor: 0x3a3214, rim: 0x5a6250, lift: .02 }) },
  { id: 'blizzard-aurore', setId: 'blizzard', name: 'BLIZZARD', colorway: 'Aurore', rarity: 'Élite', palette: P({ cloth: 0x2c3d5c, cloth2: 0x1f2633, plate: 0x262e3a, plate2: 0x191d24, rubber: 0x14171c, metal: 0x7e8894, accent: 0x9c958a, glow: 0x5ff0d0, visor: 0x0e4a52, rim: 0x5e6c82, lift: .035 }) },
  { id: 'blizzard-balise', setId: 'blizzard', name: 'BLIZZARD', colorway: 'Balise', rarity: 'Élite', palette: P({ cloth: 0xb4532a, cloth2: 0x2e2a28, plate: 0x34312e, plate2: 0x1e1c1b, rubber: 0x161514, metal: 0x8a8480, accent: 0xa89a86, glow: 0xffc070, visor: 0x3a2410, rim: 0x6a5a50, lift: .015 }) },
];

// ---------------------------------------------------------------- parka
const PK = [[.88, .186, .158, .15], [.95, .19, .16, .152], [1.02, .186, .154, .146], [1.09, .184, .15, .142], [1.18, .196, .158, .146], [1.27, .212, .168, .152], [1.35, .218, .172, .154], [1.42, .208, .164, .146], [1.465, .17, .136, .124], [1.495, .124, .108, .1]];
const pkAt = y => { if (y <= PK[0][0]) return PK[0]; for (let i = 0; i < PK.length - 1; i++) { const a = PK[i], b = PK[i + 1]; if (y <= b[0]) { const t = (y - a[0]) / (b[0] - a[0]); return a.map((v, k) => lerp(v, b[k], t)); } } return PK[PK.length - 1]; };
const pkP = (a, y, off = 0) => { const r = pkAt(y), s = Math.sin(a), c = Math.cos(a), p = 2 / 2.4; return [(r[1] + off) * Math.sign(s) * Math.abs(s) ** p, y, -((c > 0 ? r[2] : r[3]) + off) * Math.sign(c) * Math.abs(c) ** p]; };
const flat = (x, y, z) => [x, 0, z];
const legW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .1 + s * r * Math.sin(u), v, -r * Math.cos(u)]; };
function parka(m) {
  const n = m.seg(32, 12), rows = [], dq = m.lod === 2 ? 0 : 1, hem = a => .9 - .035 * Math.cos(a) ** 2 * (Math.cos(a) < 0 ? 1 : 0) + .01 * Math.sin(a * 5);
  for (let j = 0; j <= m.seg(20, 6); j++) rows.push(j / m.seg(20, 6));
  // quilted baffles (soft, staggered) and fabric folds; the hem dips a little at the back
  const pt = (a, t, off = 0) => { const y = lerp(hem(a), 1.495, t), q = dq * (.011 * Math.sqrt(Math.abs(Math.sin(Math.PI * (y - .9) / .085))) * sstep(1.46, 1.42, y) + .006 * Math.sin(a * 3 + y * 17) * sstep(1.4, 1.2, y)); return pkP(a, y, off + q); };
  m.grid(n, rows.length - 1, (u, v) => pt(u * TAU, v), { wrapU: true, capB: true, slot: S.CLOTH, skin: torsoSkin, crease: 180, out: flat, ao: (x, y) => .72 + .28 * sstep(.9, 1.05, y) });
  // hem band, drawcord at the waist, storm flap down the front
  strapAlong(m, Array.from({ length: 24 }, (_, i) => { const a = i / 24 * TAU; return pkP(a, hem(a) + .011, .0085); }), .024, .009, flat, { slot: S.CLOTH2, skin: torsoSkin, closed: true, n: m.seg(36, 12) });
  if (m.keep(1)) strapAlong(m, Array.from({ length: 24 }, (_, i) => pkP(i / 24 * TAU, 1.066, .0085)), .013, .0055, flat, { slot: S.CLOTH2, skin: torsoSkin, closed: true, n: m.seg(32, 12) });
  panel(m, (u, v, h) => pkP(u, v, h + .012), -.1, .1, .9, 1.47, { t: .008, nu: 2, nv: 10, slot: S.CLOTH, skin: torsoSkin, out: flat, edge: .15, round: .3 });
  // two chest pockets, two hand-warmer pockets
  for (const s of [-1, 1]) {
    panel(m, (u, v, h) => pkP(u, v, h + .014), s * .25, s * .62, 1.25, 1.36, { t: .01, nu: 4, nv: 3, slot: S.CLOTH, skin: torsoSkin, out: flat, edge: .15, round: .5 });
    panel(m, (u, v, h) => pkP(u, v, h + .014), s * .5, s * 1.05, .95, 1.06, { t: .01, nu: 5, nv: 3, slot: S.CLOTH, skin: torsoSkin, out: flat, edge: .15, round: .5 });
  }
  // sleeves: puffy over the kit sleeve, with an elbow patch and a cuff
  for (const s of [-1, 1]) {
    const nA = m.seg(14, 7), ry = [1.47, 1.44, 1.39, 1.33, 1.26, 1.2, 1.15, 1.1, 1.04, .98, .93], R = [.06, .086, .092, .088, .084, .08, .078, .076, .07, .066, .064];
    const sk = (x, y) => y > 1.0 ? blend2(s < 0 ? B.FAL : B.FAR, s < 0 ? B.UAL : B.UAR, y, 1.155, .045) : [s < 0 ? B.FAL : B.FAR, 1];
    m.loft(ry.map((y, i) => Array.from({ length: nA }, (_, k) => { const a = k / nA * TAU, r = R[i] + (m.lod === 2 ? 0 : .005 * Math.sin(a * 2 + y * 23)); return [s * .2 + s * r * Math.cos(a), y, r * Math.sin(a)]; })), { slot: S.CLOTH, skin: sk, crease: 180, capA: true, capB: true, out: (x, y, z) => [x - s * .2, 0, z], ao: (x, y) => .76 + .24 * sstep(1.0, 1.3, y) });
    m.revolve([[.0675, .02], [.072, .012], [.072, -.012], [.068, -.02]], { sides: m.keep(1) ? 12 : 7, slot: S.CLOTH2, skin: s < 0 ? B.FAL : B.FAR, m: T(s * .2, .925, 0), crease: 50 });
    m.revolve([[.0915, .011], [.0945, .007], [.0945, -.007], [.0915, -.011]], { sides: m.keep(1) ? 16 : 8, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, m: T(s * .2, 1.29, 0), crease: 50 });
  }
}

// ---------------------------------------------------------------- hood, ruff, goggles, gaiter
const HC = [0, 1.672, -.006], HR = [.13, .135, .142];
const faceF = (lon, lat) => (lon / .78) ** 2 + ((lat + .12) / .62) ** 2;
const hoodP = (lon, lat, off = 0) => {
  const k = lat >= -.5 ? Math.cos(lat) : lerp(Math.cos(-.5), .76, sstep(-.5, -1.15, lat)), y = lat >= -.5 ? Math.sin(lat) : lerp(Math.sin(-.5), -.86, sstep(-.5, -1.15, lat));
  const inner = sstep(1.04, .76, faceF(lon, lat)) * (Math.cos(lon) > .2 ? 1 : 0), R = lerp(1, .6, inner), lump = 1 + .02 * Math.sin(lon * 6 + lat * 4);
  return [HC[0] + (HR[0] * k * R * lump + off) * Math.sin(lon), HC[1] + HR[1] * y * lerp(1, .92, inner) + (lat > 0 ? off * Math.sin(lat) : 0), HC[2] - (HR[2] * k * R * lump + off) * Math.cos(lon)];
};
const faceP = (lon, lat, off = 0) => { const nose = .014 * Math.exp(-((lon / .2) ** 2) - (((lat + .05) / .2) ** 2)), R = .098 * (1 - .1 * (lon / .9) ** 2) + nose + off, c = Math.cos(lat); return [HC[0] + R * Math.sin(lon) * c, HC[1] + .1 * Math.sin(lat), HC[2] - R * 1.06 * Math.cos(lon) * c]; };
const outH = (x, y, z) => [x - HC[0], y - HC[1] + .02, z - HC[2]];
const hoodSkin = (x, y) => y > 1.585 ? [B.HEA, 1] : blend2(B.NEC, B.HEA, y, 1.57, .02);
let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function hood(m) {
  m.grid(m.seg(34, 14), m.seg(13, 6), (u, v) => hoodP(u * TAU - Math.PI, lerp(-1.15, 1.5707, v ** .9)), { wrapU: true, capB: true, slot: S.CLOTH, skin: hoodSkin, crease: 180, out: outH, ao: (x, y, z) => (z < HC[2] - .05 && Math.abs(x) < .1 ? .55 : 1) * (.72 + .28 * sstep(1.56, 1.7, y)) });
  // knitted gaiter over nose and mouth, goggles above
  m.grid(m.seg(16, 8), m.seg(8, 4), (u, v) => faceP(lerp(-.92, .92, u), lerp(-.86, .08, v)), { slot: S.CLOTH2, skin: B.HEA, crease: 180, out: outH, ao: .8 });
  m.grid(m.seg(16, 8), m.seg(3, 2), (u, v) => faceP(lerp(-.86, .86, u), lerp(.0, .4, v), .012 + .006 * Math.cos(lerp(-.86, .86, u) * 1.6)), { slot: S.VISOR, skin: B.HEA, crease: 180, out: outH });
  m.tube(Array.from({ length: 25 }, (_, i) => { const t = i / 24 * TAU; return faceP(.88 * Math.sin(t), .2 + .21 * Math.cos(t), .016); }), .007, { slot: S.PLATE2, skin: B.HEA, sides: m.keep(1) ? 5 : 3, n: m.seg(28, 10), cap: false, up: [0, 0, -1] });
  m.revolve([[.136, .009], [.139, .005], [.139, -.005], [.136, -.009]], { sides: m.keep(1) ? 18 : 9, slot: S.CLOTH2, skin: B.HEA, m: T(0, 1.69, .0, .08, 0, 0, 1, 1, 1.08), crease: 50 });
}
function ruff(m) {
  // fur ruff: short tufts all round the face opening, lying outward (its own build step)
  if (m.lod < 2) { seed = 3; const N = m.lod === 0 ? 160 : 44;
    for (let i = 0; i < N; i++) { const t = (i + rnd()) / N * TAU, lon = .8 * Math.sin(t) * 1.04, lat = -.12 + .64 * Math.cos(t) * 1.04, [p, d] = mapAt(hoodP, lon, lat, .004), L = .02 + .012 * rnd(), w = m.lod === 0 ? .008 : .013;
      const dl = Math.hypot(d[0], d[1], d[2]) || 1, nx = d[0] / dl, ny = d[1] / dl, nz = d[2] / dl, j = (rnd() - .5) * .01, o = [p[0] + nx * .012 + j, p[1] + ny * .012 - .004, p[2] + nz * .012], e = [p[0] + nx * (.01 + L * .45) + j * 2, p[1] + ny * (.01 + L * .45) - L * .6, p[2] + nz * (.01 + L * .45)];
      m.tube([p, o, e], k => w * (1 - .7 * k), { slot: S.ACCENT, skin: hoodSkin, sides: 3, n: m.lod === 0 ? 3 : 2, flat: .5, cap: false, crease: 80, ao: (x, y, z) => .6 + .4 * Math.min(1, Math.hypot(x - p[0], y - p[1], z - p[2]) / .04) }); } }
}

// ---------------------------------------------------------------- trousers, gaiters
function trousers(m) {
  const n = m.seg(14, 7);
  for (const s of [-1, 1]) {
    const SH = s < 0 ? B.SHL : B.SHR, TH = s < 0 ? B.THL : B.THR, ol = (x, y, z) => [x - s * .1, 0, z];
    const ry = [.95, .9, .82, .72, .62, .54, .48, .42, .34, .28], R = [.112, .114, .11, .102, .092, .086, .084, .082, .076, .072];
    m.loft(ry.map((y, i) => Array.from({ length: n }, (_, k) => { const a = k / n * TAU, r = R[i] + (m.lod === 2 ? 0 : .007 * Math.sin(a * 2 + y * 19 + s) * sstep(.3, .45, y)); return [s * .1 + r * Math.sin(a), y, -r * Math.cos(a) + .003]; })), { slot: S.PLATE, skin: legSkin(s), crease: 180, capA: true, capB: true, out: (x, y, z) => [x - s * .1, 0, z], ao: (x, y) => .74 + .26 * sstep(.3, .6, y) });
    panel(m, legW(s, (u, v) => .086 + .012 * Math.max(0, 1 - (u / 1.1) ** 2) * Math.max(0, 1 - ((v - .51) / .08) ** 2)), -1.1, 1.1, .45, .58, { t: .007, nu: 8, nv: 5, slot: S.CLOTH2, skin: (px, py) => blend2(SH, TH, py, .55, .03), out: ol, dome: .003, edge: .15, round: .7 });
    // snow gaiter over the boot top, its strap under the instep, a hook at the front
    const gy = [.31, .27, .22, .17, .13], gR = [.078, .081, .084, .083, .08];
    m.loft(gy.map((y, i) => Array.from({ length: n }, (_, k) => { const a = k / n * TAU; return [s * .1 + gR[i] * Math.sin(a), y, -gR[i] * 1.12 * Math.cos(a) + .004]; })), { slot: S.CLOTH2, skin: (x, y) => blend2(s < 0 ? B.FOL : B.FOR, SH, y, .17, .03), crease: 180, out: (x, y, z) => [x - s * .1, 0, z], ao: .85 });
    if (m.keep(1)) m.box([s * .1, .2, -.098], [.012, .02, .006], .002, { slot: S.METAL, skin: SH });
  }
  // cargo pockets
  for (const s of [-1, 1]) buildPouch(m, .075, .1, .03, T(s * .205, .72, .005, 0, s * Math.PI / 2, 0), { slot: S.PLATE, slotFlap: S.PLATE, skin: s < 0 ? B.THL : B.THR, tab: false });
}

// ---------------------------------------------------------------- rucksack, mat, snowshoes
function rucksack(m) {
  const C = B.CHE;
  m.box([0, 1.25, .22], [.27, .32, .13], .045, { slot: S.CLOTH, skin: C, ao: .9 });
  m.box([0, 1.415, .21], [.25, .04, .12], .02, { slot: S.CLOTH2, skin: C });
  for (const s of [-1, 1]) buildPouch(m, .05, .13, .04, T(s * .155, 1.22, .215, 0, s * Math.PI / 2, 0), { slot: S.CLOTH, slotFlap: S.CLOTH2, skin: C, tab: false });
  // rolled mat across the top
  m.revolve([[.002, .14], [.03, .14], [.036, .134], [.036, -.134], [.03, -.14], [.002, -.14]], { sides: m.seg(12, 6), slot: S.ACCENT, skin: C, m: T(0, 1.47, .225, 0, 0, Math.PI / 2), crease: 50 });
  if (m.keep(1)) for (const x of [-.08, .08]) m.revolve([[.0375, .008], [.0375, -.008]], { sides: 12, slot: S.CLOTH2, skin: C, m: T(x, 1.47, .225, 0, 0, Math.PI / 2), crease: 60 });
  // snowshoes on the back: oval frames, a deck, lashed with two straps
  if (m.keep(1)) for (const s of [-1, 1]) {
    const pts = Array.from({ length: 14 }, (_, i) => { const t = i / 14 * TAU; return [s * .045 + .055 * Math.sin(t), 1.24 + .14 * Math.cos(t), .292 + s * .006]; });
    strapAlong(m, pts, .012, .009, (x, y, z) => [x - s * .045, y - 1.24, 0], { slot: S.PLATE2, skin: C, closed: true, n: m.seg(20, 8) });
    panel(m, (u, v, h) => [s * .045 + u, 1.24 + v, .292 + s * .006 + h], -.045, .045, u => -.12 + .5 * u * u, u => .12 - .5 * u * u, { t: .003, nu: 4, nv: 6, slot: S.RUBBER, skin: C, out: () => [0, 0, 1], edge: .05, round: .9 });
  }
  for (const y of [1.17, 1.33]) m.box([0, y, .3], [.25, .018, .01], .003, { slot: S.CLOTH2, skin: C });
  for (const s of [-1, 1]) m.tube([[s * .08, 1.12, .17], [s * .11, 1.38, .17], [s * .12, 1.475, .1], [s * .118, 1.47, -.07], [s * .1, 1.36, -.19]], .012, { slot: S.CLOTH2, skin: torsoSkin, sides: 5, flat: .35, n: m.seg(12, 5), up: [1, 0, 0] });
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  for (const s of [-1, 1]) {
    stitchLine(m, Array.from({ length: 6 }, (_, i) => pkP(s * lerp(.26, .61, i / 5), 1.366, .025)), { skin: torsoSkin, n: 12, slot: S.CLOTH2 });
    buckleAt(m, [s * .105, 1.365, -.19], [0, 0, -1], { skin: torsoSkin, w: .024, d: .014 });
    m.box([0, 0, 0], [.006, .026, .006], .002, { slot: S.METAL, skin: torsoSkin, m: T(...pkP(s * .14, 1.06, .02), 0, 0, 0) });       // drawcord toggles
  }
  stitchLine(m, Array.from({ length: 12 }, (_, i) => pkP(.0, lerp(.92, 1.46, i / 11), .021)), { skin: torsoSkin, n: 30, slot: S.METAL, r: .0014 });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.CLOTH2 }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.CLOTH2 }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  m => buildSuit(m, { slot: S.PLATE, slotLegs: S.PLATE, folds: .6 }),
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.RUBBER, slotRand: S.PLATE2, slotSole: S.PLATE2, slotMid: S.RUBBER, slotTongue: S.RUBBER, slotPanel: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.CLOTH2, slotCuff: S.CLOTH, guard: false, cuff: false }); },
  trousers, parka, rucksack, hood, ruff,
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['suit', 'boots', 'gloves', 'trousers', 'parka', 'rucksack', 'hood', 'ruff']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
void clamp; void screw;
