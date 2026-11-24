// outfit-ronin.js — FRONT ZÉRO: RONIN, the lamellar set. Original design (genre-inspired, no specific character): a modern helmet bowl with a small peak,
// short swept side plates and a three-lame flared neck guard, narrow goggles over a half-mask with slotted vents; laced lamellar shoulder guards; a lamellar
// cuirass laced in pairs of cords; a wide cloth sash knotted at the side; four lamellar tassets; splinted forearm guards and greaves; a scarf tail down
// the back on a small cloth rig. Inside the soldier's hitbox. No crest, emblem or text.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, lerp, clamp, sstep, blend2, torsoSkin, buildSuit, buildGlove, buildBoot, buildGloveDetail, buildBootDetail, mapAt, screw, stitchLine, panel, strapAlong, makeClothDef, clothSkin, defineOutfitSet } from './outfit-kit.js';

const TAU = Math.PI * 2;
const pbr = { plate: [.34, .12, 0, 0], plate2: [.4, .1, 0, 0], accent: [.85, 0, .04, .6], cloth2: [.9, 0, 0, .85] };
const P = o => ({ pbr, ...o });
// plate = lacquered lames, plate2 = helmet bowl and splints, accent = lacing cords, cloth = under-suit, cloth2 = sash and scarf

// ---------------------------------------------------------------- colourways
export const OUTFIT_SETS = [
  { id: 'ronin-encre', setId: 'ronin', name: 'RONIN', colorway: 'Encre', rarity: 'Légende', palette: P({ cloth: 0x23242a, cloth2: 0x6e1d1d, plate: 0x2a2b30, plate2: 0x34363c, rubber: 0x141416, metal: 0x9a8a62, accent: 0xb82a24, glow: 0xff5a3a, visor: 0x120808, rim: 0x7a7478, lift: .045 }) },
  { id: 'ronin-laque', setId: 'ronin', name: 'RONIN', colorway: 'Laque', rarity: 'Élite', palette: P({ cloth: 0x2a2220, cloth2: 0x26221e, plate: 0x7a2420, plate2: 0x3a2a24, rubber: 0x171312, metal: 0xc09a4a, accent: 0xd8b04a, glow: 0xffd070, visor: 0x140a06, rim: 0x6a5a54, lift: .02 }) },
  { id: 'ronin-bronze', setId: 'ronin', name: 'RONIN', colorway: 'Bronze', rarity: 'Élite', palette: P({ cloth: 0x2c3036, cloth2: 0x3a4a5e, plate: 0x5e4a32, plate2: 0x3d3328, rubber: 0x18171a, metal: 0xa88a58, accent: 0x3a6a9a, glow: 0x7ab8ff, visor: 0x0c1016, rim: 0x6a6258, lift: .02, pbr: { ...pbr, plate: [.36, .45, 0, 0] } }) },
  { id: 'ronin-brume', setId: 'ronin', name: 'RONIN', colorway: 'Brume', rarity: 'Élite', palette: P({ cloth: 0x2b3137, cloth2: 0x48525a, plate: 0x3e464e, plate2: 0x333a41, rubber: 0x1a1d20, metal: 0x9aa4ac, accent: 0xc6cbce, glow: 0xd8f0ff, visor: 0x0a1014, rim: 0x606a72, lift: .02 }) },
];

// ---------------------------------------------------------------- shapes
const TR = [[.95, .17, .128], [1.03, .164, .122], [1.09, .156, .116], [1.16, .162, .118], [1.24, .175, .124], [1.32, .186, .129], [1.39, .187, .128], [1.435, .17, .116], [1.47, .13, .096]];
const trAt = y => { if (y <= TR[0][0]) return TR[0]; for (let i = 0; i < TR.length - 1; i++) { const a = TR[i], b = TR[i + 1]; if (y <= b[0]) { const t = (y - a[0]) / (b[0] - a[0]); return a.map((v, k) => lerp(v, b[k], t)); } } return TR[TR.length - 1]; };
const torsoP = (a, y, off = 0) => { const r = trAt(y), s = Math.sin(a), c = Math.cos(a); return [(r[1] + off) * Math.sign(s) * Math.abs(s) ** .78, y, -(r[2] + off) * Math.sign(c) * Math.abs(c) ** .78]; };
const flat = (x, y, z) => [x, 0, z];
const legW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .1 + s * r * Math.sin(u), v, -r * Math.cos(u)]; };
const armW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .2 + s * r * Math.cos(u), v, r * Math.sin(u)]; };
/** A stack of lames on map(u, v, h): from vTop down, each lame steps a little outward so every edge shows; cords cross them in pairs. */
function lames(m, map, u0, u1, vTop, n, h, o = {}) {
  const ov = o.overlap ?? .2, step = o.step ?? .0045, t = o.t ?? .006;
  for (let i = 0; i < n; i++) { const top = vTop - i * h * (1 - ov), off = i * step; panel(m, (u, v, hh) => map(u, v, hh + off), u0, u1, top - h, top, { t, nu: o.nu ?? 8, nv: 1, slot: i % 2 && o.slot2 !== undefined ? o.slot2 : (o.slot ?? S.PLATE), skin: o.skin, out: o.out, edge: .12, round: .25 }); }
  if (m.keep(o.cordRank ?? 1)) for (const uc of o.cords || []) for (const d of [-1, 1]) { const u = uc + d * (o.cordGap ?? .02), pts = []; for (let i = 0; i <= n * 2; i++) { const v = vTop - i * h * (1 - ov) / 2 - .004, k = Math.min(n - 1, Math.floor(i / 2)); pts.push(map(u, v, k * step + t + .002)); } m.tube(pts, o.cordR ?? .0022, { slot: S.ACCENT, skin: o.skin, sides: 3, n: n * 3, cap: false, crease: 80, out: o.out }); }
}

// ---------------------------------------------------------------- helmet, mask
const HC = [0, 1.69, -.01], HR = [.128, .122, .142];
const hp = (lon, lat, off = 0) => { const c = Math.cos(lat); return [HC[0] + (HR[0] + off) * Math.sin(lon) * c, HC[1] + (HR[1] + off) * Math.sin(lat), HC[2] - (HR[2] + off) * Math.cos(lon) * c]; };
const outH = (x, y, z) => [x - HC[0], y - HC[1] + .03, z - HC[2]];
function helmet(m) {
  const H = B.HEA;
  m.ell([0, 1.66, -.012], [.1, .104, .112], { slot: S.CLOTH, skin: H, nu: 12, nv: 7, ao: .55 });       // padded cap under the bowl
  m.grid(m.seg(30, 12), m.seg(9, 4), (u, v) => { const lon = u * TAU - Math.PI, lat = lerp(-.12 + .1 * Math.max(0, Math.cos(lon)), 1.5707, v); return hp(lon, lat); }, { wrapU: true, capB: true, slot: S.PLATE2, skin: H, crease: 40, out: outH, ao: (x, y) => .75 + .25 * sstep(1.66, 1.78, y) });
  // ridges over the bowl, front to back
  if (false) for (const lon of [-.5, 0, .5]) m.tube(Array.from({ length: 9 }, (_, i) => hp(lon + (lon ? (i / 8 - .5) * .2 * Math.sign(lon) : 0), lerp(.25, 1.45, i / 8), .003)), .0032, { slot: S.PLATE2, skin: H, sides: 4, n: 10, cap: false });
  // small peak
  panel(m, (u, v, h) => { const p = hp(u, .02, .004); return [p[0], p[1] - h * .3 + v * .02, p[2] - (v + .004) * 1.0 - h * .2]; }, -1.0, 1.0, 0, u => .032 - .02 * (u / 1.0) ** 2, { t: .005, nu: 10, nv: 2, slot: S.PLATE2, skin: H, out: () => [0, 1, -.3], edge: .1, round: .4 });
  // three flared neck-guard lames round the back and sides
  const ng = (u, v, h) => { const lon = Math.PI + u, t = clamp((1.64 - v) / .13, 0, 1), r = 1 + .32 * t; return [HC[0] + (HR[0] * r + h) * Math.sin(lon), v, HC[2] - (HR[2] * r + h) * Math.cos(lon)]; };
  lames(m, ng, -1.95, 1.95, 1.665, 3, .05, { slot: S.PLATE, skin: (x, y) => y > 1.6 ? [H, 1] : blend2(B.NEC, H, y, 1.585, .02), out: (x, y, z) => [x, 0, z - HC[2]], nu: 16, step: .006, cords: m.keep(0) ? [-1.2, -.4, .4, 1.2] : [], cordRank: 0 });
  // short swept side plates at the front of the neck guard
  for (const s of [-1, 1]) panel(m, (u, v, h) => { const p = hp(s * 1.95, -.15, .02 + h); return [p[0] + s * u * .3, p[1] + v, p[2] - u]; }, 0, .065, -.03, u => .035 + u * .4, { t: .006, nu: 3, nv: 2, slot: S.PLATE, skin: H, out: () => [s, .2, -.4], edge: .12, round: .4 });
  // goggles strip and half-mask with slotted vents
  m.grid(m.seg(14, 6), 1, (u, v) => hp(lerp(-.8, .8, u), lerp(-.05, .12, v), .006), { slot: S.VISOR, skin: H, crease: 180, out: outH });
  const mk = (u, v, h) => { const p = hp(u, v, .01 + h + .02 * Math.exp(-((u / .3) ** 2)) * sstep(-.75, -.2, v)); return p; };
  panel(m, mk, -1.05, 1.05, -.95, u => -.08 - .1 * Math.abs(u), { t: .008, nu: 12, nv: 5, slot: S.PLATE, skin: H, out: outH, edge: .1, round: .35, dome: .004 });
  if (m.keep(1)) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) panel(m, (u, v, h) => mk(s * u, v, h + .008), .12, .5, -.62 + k * .1, -.6 + k * .1, { t: .003, nu: 3, nv: 1, slot: S.RUBBER, skin: H, out: outH, edge: .05, round: 0 });
}

// ---------------------------------------------------------------- cuirass, sash, tassets
function cuirass(m) {
  const on = (u, v, h) => torsoP(u, v, h + .012);
  lames(m, on, -1.75, 1.75, 1.45, 6, .062, { slot: S.PLATE, slot2: S.PLATE, skin: torsoSkin, out: flat, nu: 14, step: .003, cords: m.keep(0) ? [-1.2, -.6, 0, .6, 1.2] : [-.6, .6], cordGap: .03 });
}
function cuirassBack(m) {
  const on = (u, v, h) => torsoP(u, v, h + .012);
  lames(m, on, Math.PI - 1.35, Math.PI + 1.35, 1.45, 6, .062, { slot: S.PLATE, skin: torsoSkin, out: flat, nu: 12, step: .003, cords: m.keep(0) ? [Math.PI - .6, Math.PI, Math.PI + .6] : [] });
  // collar piece and shoulder straps (laced)
  panel(m, (u, v, h) => torsoP(u, v, h + .01), -.9, .9, 1.45, u => 1.49 - .02 * Math.abs(u), { t: .008, nu: 8, nv: 1, slot: S.PLATE2, skin: (x, y) => blend2(B.CHE, B.NEC, y, 1.5, .03), out: flat, edge: .15 });
  for (const s of [-1, 1]) strapAlong(m, [torsoP(s * .62, 1.42, .02), [s * .12, 1.492, -.04], [s * .124, 1.497, .03], torsoP(s * (Math.PI - .62), 1.42, .02)], .03, .006, (x, y, z) => [x, y > 1.46 ? .9 : 0, z], { slot: S.PLATE2, skin: (x, y) => y > 1.47 ? [B.CHE, .8, B.NEC, .2] : torsoSkin(x, y), n: m.seg(10, 4) });
  // sash wound round the waist, knotted on the left, two ends hanging
  const n = m.seg(28, 10);
  m.grid(n, 2, (u, v) => { const a = u * TAU, y = lerp(.99, 1.075, v), b = 1 + .012 * Math.sin(a * 5 + v * 3); return [.19 * b * Math.sin(a), y + .006 * Math.sin(a * 3), .004 - .148 * b * Math.cos(a)]; }, { wrapU: true, slot: S.CLOTH2, skin: (x, y) => blend2(B.PEL, B.SPI, y, 1.06, .03), crease: 180, out: flat, ao: .9 });
  m.box([-.197, 1.035, -.05], [.03, .05, .05], .012, { slot: S.CLOTH2, skin: B.PEL });       // the knot: a flat wrapped bow, not a ball
  if (m.keep(1)) for (const d of [-1, 1]) m.box([0, 0, 0], [.02, .028, .045], .008, { slot: S.CLOTH2, skin: B.PEL, m: T(-.2, 1.035 + d * .02, -.05 + d * .03, d * .5, 0, 0) });
  for (const [dz, len] of [[-.012, .2], [.016, .16]]) panel(m, (u, v, h) => [-.205 - h - .01 * Math.sin(v * 8), v, -.05 + dz + u], -.022, .022, 1.02 - len, 1.02, { t: .004, nu: 2, nv: 5, slot: S.CLOTH2, skin: (x, y) => blend2(B.THL, B.PEL, y, .95, .05), out: () => [-1, 0, 0], edge: .05, round: .3 });
}
function tassets(m) {
  const tw = (u, v, h) => { const r = .2 + .075 * (1.0 - v) + h; return [r * Math.sin(u), v, .004 - r * .78 * Math.cos(u)]; };
  for (const [u0, u1, bone] of [[-1.0, -.12, B.THL], [.12, 1.0, B.THR], [-1.95, -1.1, B.THL], [1.1, 1.95, B.THR], [Math.PI - .7, Math.PI + .7, null]]) {
    const sk = bone === null ? () => [B.PEL, 1] : (x, y) => { const k = sstep(.98, .78, y) * .7; return k < .01 ? [B.PEL, 1] : [B.PEL, 1 - k, bone, k]; };
    const mid = (u0 + u1) / 2;
    lames(m, tw, u0, u1, .985, 4, .062, { slot: S.PLATE, skin: sk, out: flat, nu: 7, step: .004, cords: [mid - (u1 - u0) * .25, mid + (u1 - u0) * .25], cordGap: .03 });
  }
}

// ---------------------------------------------------------------- shoulder guards, arms, legs
function sode(m) {
  for (const s of [-1, 1]) {
    const U = s < 0 ? B.UAL : B.UAR, sk = (x, y) => { const k = clamp(.45 + (1.48 - y) * 2.5, 0, 1); return k >= 1 ? [U, 1] : [B.CHE, 1 - k, U, k]; };
    // a flat, slightly curved board of lames hanging at the outside of the shoulder
    const sm = (u, v, h) => { const t = clamp((1.5 - v) / .26, 0, 1), r = .1 + .03 * t + h; return [s * .2 + s * r * Math.cos(u * .9), v, r * Math.sin(u * .9) * 1.15]; };
    lames(m, sm, -1.15, 1.15, 1.52, 5, .062, { slot: S.PLATE, skin: sk, out: (x, y, z) => [x - s * .2, .2, z], nu: 9, step: .004, cords: m.keep(0) ? [-.6, 0, .6] : [0], cordGap: .07 });
    if (m.keep(1)) m.tube([sm(-1.0, 1.52, .002), sm(0, 1.535, .004), sm(1.0, 1.52, .002)], .007, { slot: S.PLATE2, skin: sk, sides: 5, n: 8 });
    // team band under the guard
    m.revolve([[.0705, .009], [.0735, .006], [.0735, -.006], [.0705, -.009]], { sides: m.keep(1) ? 14 : 8, slot: S.TEAM, skin: U, m: T(s * .2, 1.22, 0), crease: 50 });
  }
}
function limbs(m) {
  for (const s of [-1, 1]) {
    const F = s < 0 ? B.FAL : B.FAR, SH = s < 0 ? B.SHL : B.SHR, TH = s < 0 ? B.THL : B.THR, oa = (x, y, z) => [x - s * .2, 0, z], ol = (x, y, z) => [x - s * .1, 0, z];
    // splinted forearm guard: three plates on a cloth base, a band at each end
    panel(m, armW(s, .062), -1.9, 1.9, .94, 1.1, { t: .004, nu: 10, nv: 3, slot: S.CLOTH2, skin: F, out: oa, edge: .1 });
    for (const u of [-.55, 0, .55]) panel(m, armW(s, .066), u - .2, u + .2, .945, 1.095, { t: .006, nu: 2, nv: 4, slot: S.PLATE, skin: F, out: oa, edge: .15, round: .5, dome: .002 });
    for (const y of [.95, 1.09]) m.revolve([[.066, .006], [.069, .003], [.069, -.003], [.066, -.006]], { sides: m.keep(1) ? 12 : 7, slot: S.ACCENT, skin: F, m: T(s * .2, y, 0), crease: 50 });
    // greave: four splints over the shin, a knee plate, laced bands
    panel(m, legW(s, .08), -1.7, 1.7, .27, .45, { t: .004, nu: 10, nv: 3, slot: S.CLOTH2, skin: SH, out: ol, edge: .1 });
    for (const u of [-.9, -.3, .3, .9]) panel(m, legW(s, (u2, v) => .084 + .006 * sstep(.28, .4, v)), u - .24, u + .24, .28, .44, { t: .006, nu: 2, nv: 4, slot: S.PLATE, skin: SH, out: ol, edge: .15, round: .5, dome: .002 });
    panel(m, legW(s, (u, v) => .086 + .016 * Math.max(0, 1 - (u / 1.05) ** 2) * Math.max(0, 1 - ((v - .51) / .07) ** 2)), -1.05, 1.05, .46, .58, { t: .008, nu: 8, nv: 4, slot: S.PLATE2, skin: (px, py) => blend2(SH, TH, py, .55, .03), out: ol, edge: .12, round: .6, dome: .003 });
    for (const y of [.29, .43]) m.revolve([[.083, .006], [.087, .003], [.087, -.003], [.083, -.006]], { sides: m.keep(1) ? 12 : 7, slot: S.ACCENT, skin: SH, m: T(s * .1, y, .003), crease: 50 });
  }
}

// ---------------------------------------------------------------- scarf tail (cloth rig: 2 columns, 3 free rows)
const SC_C = 2, SC_R = 3;
const scarfPoint = (col, row) => { const t = col / (SC_C - 1), w = row / SC_R; return [lerp(-.05, .05, t) + .025 * w, lerp(1.5, 1.04, w), lerp(.13, .17, Math.sin(w * Math.PI / 2)) + .004 * t]; };
const SCARF = makeClothDef(Array.from({ length: SC_R + 1 }, (_, r) => Array.from({ length: SC_C }, (_, c) => scarfPoint(c, r))));
function scarf(m) {
  // the wrap round the neck, then the tail on the rig
  const n = m.seg(22, 9);
  m.loft([0, 1, 2].map(j => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, y = 1.47 + j * .03, r = (.125 - j * .018) * (1 + .05 * Math.sin(a * 4 + j)); return [r * Math.sin(a), y + .008 * Math.sin(a * 2), .006 - r * .9 * Math.cos(a)]; })), { slot: S.CLOTH2, skin: (x, y) => blend2(B.CHE, B.NEC, y, 1.5, .03), crease: 180, out: (x, y, z) => [x, 0, z], ao: .85 });
  const nu = m.seg(6, 3), nv = m.seg(10, 5), key = (x, y, z) => Math.round(x * 2e3) + '_' + Math.round(y * 2e3) + '_' + Math.round(z * 2e3);
  for (const [off, sign] of m.keep(1) ? [[.003, 1], [-.003, -1]] : [[.003, 1]]) {
    const V = [], F = [], nd = new Map();
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const col = i / nu * (SC_C - 1), row = j / nv * SC_R, p = scarfPoint(col, row), fold = .006 * Math.sin(i / nu * Math.PI * 3 + j * .5) * (j / nv); const q = [p[0], p[1], p[2] + off + fold]; V.push(q); nd.set(key(...q), [col, row]); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = i + j * (nu + 1), b = a + 1, c = a + nu + 1, d = c + 1; F.push(a, b, c, b, d, c); }
    m.surf(V, F, { slot: S.CLOTH2, crease: 180, ao: sign > 0 ? .9 : .5, skin: (x, y, z) => { const c = nd.get(key(x, y, z)); return c ? clothSkin(SCARF, c[0], c[1]) : [B.CHE, 1]; }, out: () => [0, 0, sign] });
  }
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  const H = B.HEA;
  for (const s of [-1, 1]) for (const la of [.3, .7]) { const [q, d] = mapAt(hp, s * 1.3, la, .002); screw(m, q, d, { r: .003, skin: H, slot: S.METAL }); }
  for (const s of [-1, 1]) { const [q, d] = mapAt(hp, s * .3, .9, .002); screw(m, q, d, { r: .0034, skin: H }); }
  stitchLine(m, Array.from({ length: 21 }, (_, i) => { const a = i / 20 * TAU; return [.192 * Math.sin(a), 1.03, .004 - .15 * Math.cos(a)]; }), { skin: B.PEL, n: 40, slot: S.ACCENT });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { slotPalm: S.CLOTH2 }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.ACCENT }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  m => buildSuit(m, { slot: S.CLOTH, slotLegs: S.CLOTH, folds: 1.1 }),
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.PLATE2, slotRand: S.RUBBER, slotSole: S.RUBBER, slotMid: S.PLATE2, slotTongue: S.RUBBER, slotPanel: S.CLOTH2 }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.RUBBER, slotKnuckle: S.PLATE, slotBack: S.PLATE2, slotCuff: S.CLOTH2, cuff: false }); },
  cuirass, cuirassBack, tassets, sode, limbs, helmet, scarf,
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, SCARF, ['suit', 'boots', 'gloves', 'cuirass', 'cuirassBack', 'tassets', 'sode', 'limbs', 'helmet', 'scarf']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
