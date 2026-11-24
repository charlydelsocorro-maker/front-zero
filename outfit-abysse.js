// outfit-abysse.js — FRONT ZÉRO: ABYSSE, the combat-diver set. Original design: a drysuit with taped seams on torso, sleeves and legs, a taped shoulder
// yoke and elbow patches, latex wrist seals and a neck seal, a tight neoprene hood, a full-face dive mask (framed domed lens, regulator), a closed-circuit
// rebreather on the chest (hard housing, scrubber canister, two counter-lungs, corrugated loops to the mouthpiece), twin bottles on a back plate with hoses
// over the shoulders, a pair of fins clipped on the flanks of the bottles, a harness carrying a knife and a pressure gauge, a weight belt, a dive console
// on the left forearm, a knife on the right calf, taped knee pads. Inside the soldier's hitbox. No insignia.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, lerp, clamp, sstep, blend2, torsoSkin, legSkin, buildSuit, buildGlove, buildBoot, buildHose, buildGloveDetail, buildBootDetail, mapAt, screw, stitchLine, buckleAt, panel, strapAlong, planeMap, defineOutfitSet, buildPouch } from './outfit-kit.js';

const TAU = Math.PI * 2;
const pbr = { cloth: [.5, 0, 0, .18], cloth2: [.6, 0, 0, .3], plate: [.42, .1, 0, 0], plate2: [.5, .08, 0, 0], rubber: [.55, 0, 0, .1], visor: [.05, .55, .02, 0] };
const P = o => ({ pbr, fpKit: 'plain', ...o });

// ---------------------------------------------------------------- colourways
export const OUTFIT_SETS = [
  { id: 'abysse-fosse', setId: 'abysse', name: 'ABYSSE', colorway: 'Fosse', rarity: 'Légende', palette: P({ cloth: 0x1e2429, cloth2: 0x2c353c, plate: 0x3a454d, plate2: 0x262e34, rubber: 0x15191c, metal: 0x66737a, accent: 0x1fc8c8, glow: 0x5ff2e8, visor: 0x071419, rim: 0x6a7a82, lift: .045 }) },
  { id: 'abysse-lagon', setId: 'abysse', name: 'ABYSSE', colorway: 'Lagon', rarity: 'Élite', palette: P({ cloth: 0x1a3846, cloth2: 0x112630, plate: 0x3d6270, plate2: 0x1b2c33, rubber: 0x12191c, metal: 0x6a787f, accent: 0xf0c020, glow: 0xffe070, visor: 0x061218, rim: 0x5a7a86, lift: .03 }) },
  { id: 'abysse-ecume', setId: 'abysse', name: 'ABYSSE', colorway: 'Écume', rarity: 'Élite', palette: P({ cloth: 0x363c41, cloth2: 0x272c30, plate: 0x626b70, plate2: 0x2c3236, rubber: 0x181b1e, metal: 0x737d83, accent: 0xf06a1e, glow: 0xff9a50, visor: 0x0a1014, rim: 0x6a747a, lift: .02 }) },
  { id: 'abysse-algue', setId: 'abysse', name: 'ABYSSE', colorway: 'Algue', rarity: 'Élite', palette: P({ cloth: 0x2c3a2a, cloth2: 0x1f2a1e, plate: 0x43553c, plate2: 0x222c20, rubber: 0x141814, metal: 0x646d5e, accent: 0xa8d838, glow: 0xd0f070, visor: 0x0a120a, rim: 0x5a6a52, lift: .035 }) },
];

// ---------------------------------------------------------------- shapes
const TR = [[.95, .17, .128], [1.03, .164, .122], [1.09, .156, .116], [1.16, .162, .118], [1.24, .175, .124], [1.32, .186, .129], [1.39, .187, .128], [1.435, .17, .116], [1.47, .13, .096]];
const trAt = y => { if (y <= TR[0][0]) return TR[0]; for (let i = 0; i < TR.length - 1; i++) { const a = TR[i], b = TR[i + 1]; if (y <= b[0]) { const t = (y - a[0]) / (b[0] - a[0]); return a.map((v, k) => lerp(v, b[k], t)); } } return TR[TR.length - 1]; };
const torsoP = (a, y, off = 0) => { const r = trAt(y), s = Math.sin(a), c = Math.cos(a); return [(r[1] + off) * Math.sign(s) * Math.abs(s) ** .8, y, -(r[2] + off) * Math.sign(c) * Math.abs(c) ** .8]; };
const radialOut = (x, y, z) => [x, y > 1.46 ? .9 : 0, z];
const legW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .1 + s * r * Math.sin(u), v, -r * Math.cos(u)]; };
const armW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .2 + s * r * Math.cos(u), v, r * Math.sin(u)]; };

// ---------------------------------------------------------------- the suit's own surface (same formulas as the kit's buildSuit), so tapes and panels sit on it
const FOLDS = .7;
const ARM_R = [[1.505, .026], [1.49, .056], [1.46, .074], [1.41, .075], [1.34, .068], [1.26, .061], [1.2, .057], [1.16, .056], [1.12, .056], [1.05, .054], [.98, .049], [.92, .045], [.875, .043]];
const LEG_R = [[.985, .082], [.93, .096], [.85, .1], [.75, .094], [.65, .083], [.57, .074], [.52, .071], [.47, .07], [.4, .07], [.32, .066], [.24, .06], [.18, .056], [.13, .052]];
const rAt = (R, y) => { if (y >= R[0][0]) return R[0][1]; for (let i = 0; i < R.length - 1; i++) { const a = R[i], b = R[i + 1]; if (y >= b[0]) return lerp(a[1], b[1], (a[0] - y) / (a[0] - b[0])); } return R[R.length - 1][1]; };
const sp = (v, p) => Math.sign(v) * Math.abs(v) ** p;
/** Sleeve surface of arm s at angle a (0 front, +pi/2 toward +x), height y, offset h. */
const armS = s => (a, y, h = 0) => { const r = rAt(ARM_R, y), d = 1 + FOLDS * (.04 * Math.sin(a * 2 + y * 14 + s * 2) * Math.exp(-(((y - 1.16) / .12) ** 2)) + .018 * Math.sin(a * 2 - y * 10) * sstep(1.45, 1.3, y)), p = 2 / 2.05; return [s * .2 + (r * d + h) * sp(Math.sin(a), p), y, -(r * 1.03 * d + h) * sp(Math.cos(a), p)]; };
/** Trouser surface of leg s. */
const legS = s => (a, y, h = 0) => { const r = rAt(LEG_R, y), d = 1 + FOLDS * (.034 * Math.sin(a * 2 + y * 11 + s) * sstep(.14, .32, y) * (1 - sstep(.72, .95, y)) + .022 * Math.sin(a * 3 - y * 13) * Math.exp(-(((y - .52) / .13) ** 2)) + .026 * Math.sin(a * 3 + y * 14) * (1 - sstep(.17, .3, y))), p = 2 / 2.1, cz = y > .6 ? .004 : 0; return [s * .1 + (r * d + h) * sp(Math.sin(a), p), y, cz - (r * 1.04 * d + h) * sp(Math.cos(a), p)]; };
const armSk = s => (x, y) => (y > 1.17 ? [s < 0 ? B.UAL : B.UAR, 1] : [s < 0 ? B.FAL : B.FAR, 1]);

// ---------------------------------------------------------------- suit details: taped seams, taped panels, wrist and neck seals
function drysuit(m) {
  const TP = .0026, tape = (pts, skin, out, w = .022) => strapAlong(m, pts, w, TP, out, { slot: S.PLATE, skin, n: m.seg(Math.max(6, pts.length * 3), 3) });
  const line = (f, a0, a1, y0, y1, k, h = TP * .5 + .001) => Array.from({ length: k + 1 }, (_, i) => f(lerp(a0, a1, i / k), lerp(y0, y1, i / k), h));
  for (const s of [-1, 1]) {
    const A = armS(s), L = legS(s), oa = (x, y, z) => [x - s * .2, 0, z], ol = (x, y, z) => [x - s * .1, 0, z], lk = legSkin(s);
    // torso: side seams up to the shoulder, front panel seams beside the rebreather
    tape([torsoP(s * 1.55, 1.0, .012), torsoP(s * 1.57, 1.2, .012), torsoP(s * 1.5, 1.4, .012), [s * .14, 1.478, .0]], torsoSkin, radialOut);
    tape(line((a, y, h) => torsoP(a, y, .011 + h), s * 1.02, s * 1.08, 1.02, 1.3, 6), torsoSkin, radialOut, .018);
    // sleeves: outer seam on the upper arm and the forearm, a taped elbow patch
    tape(line(A, s * Math.PI / 2, s * Math.PI / 2, 1.44, 1.27, 6), armSk(s), oa);
    tape(line(A, s * Math.PI / 2, s * Math.PI / 2, 1.07, .975, 4), armSk(s), oa);
    panel(m, (u, v, h) => A(u, v, h + .002), Math.PI - .95, Math.PI + .95, 1.1, 1.235, { t: .004, nu: 6, nv: 4, slot: S.CLOTH2, skin: (x, y) => blend2(s < 0 ? B.FAL : B.FAR, s < 0 ? B.UAL : B.UAR, y, 1.17, .03), out: oa, edge: .2, round: .6 });
    // legs: outer and front seams, a taped seat-to-knee panel line
    tape(line(L, s * Math.PI / 2, s * Math.PI / 2, .93, .3, 12), lk, ol);
    tape(line(L, 0, 0, .9, .62, 7), lk, ol, .018);
    tape(line(L, 0, 0, .41, .2, 5), lk, ol, .018);
    // wrist seals: a taped sleeve end, a latex cone over the glove cuff with two ribs
    const W = T(s * .2, .945, 0);
    m.revolve([[.054, .036], [.058, .031], [.058, .024], [.054, .02]], { sides: m.keep(1) ? 14 : 8, slot: S.PLATE, skin: s < 0 ? B.FAL : B.FAR, m: W, crease: 50 });
    m.revolve([[.05, .022], [.053, .012], [.0505, .006], [.0525, -.002], [.049, -.01], [.0505, -.016], [.046, -.026]], { sides: m.keep(1) ? 14 : 8, slot: S.RUBBER, skin: s < 0 ? B.FAL : B.FAR, m: W, crease: 60 });
  }
  // shoulder yoke across the upper back, taped along its lower edge; the entry zip across the shoulders
  panel(m, (u, v, h) => torsoP(u, v, h + .006), Math.PI - 1.2, Math.PI + 1.2, u => 1.31 + .03 * Math.abs(u - Math.PI), 1.45, { t: .004, nu: 10, nv: 4, slot: S.CLOTH2, skin: torsoSkin, out: radialOut, edge: .1, round: .3 });
  tape(Array.from({ length: 9 }, (_, i) => { const u = lerp(Math.PI - 1.2, Math.PI + 1.2, i / 8); return torsoP(u, 1.31 + .03 * Math.abs(u - Math.PI), .012); }), torsoSkin, radialOut);
  if (m.keep(1)) strapAlong(m, Array.from({ length: 9 }, (_, i) => torsoP(lerp(-.55, .55, i / 8), 1.36 - .05 * Math.cos(lerp(-.55, .55, i / 8) * 2.4), .012)), .012, .0035, radialOut, { slot: S.PLATE2, skin: torsoSkin, n: m.seg(16, 6) });
}

// ---------------------------------------------------------------- head: hood, full-face mask
const HC = [0, 1.668, -.008], HR = [.118, .126, .132];
const hood = (lon, lat, off = 0) => { const c = Math.cos(lat), k = lat < -.5 ? lerp(Math.cos(-.5), .7, sstep(-.5, -1.2, lat)) : c, y = lat < -.5 ? lerp(Math.sin(-.5), -.88, sstep(-.5, -1.2, lat)) : Math.sin(lat); return [HC[0] + (HR[0] * k + off) * Math.sin(lon), HC[1] + (HR[1] + off) * y, HC[2] - (HR[2] * k + off) * Math.cos(lon)]; };
const outH = (x, y, z) => [x - HC[0], y - HC[1] + .02, z - HC[2]];
function head(m) {
  const H = B.HEA, nu = m.seg(28, 12), nv = m.seg(10, 5);
  m.grid(nu, nv, (u, v) => hood(u * TAU - Math.PI, lerp(-1.2, 1.5707, v)), { wrapU: true, capB: true, slot: S.CLOTH, skin: (x, y) => y > 1.585 ? [H, 1] : blend2(B.NEC, H, y, 1.57, .02), crease: 180, out: outH, ao: (x, y) => .72 + .28 * sstep(1.58, 1.7, y) });
  // mask: a rounded frame on the face, the domed lens, a rubber skirt, the regulator below
  const mf = (u, v, h) => hood(u, v, h + .006);
  panel(m, mf, -.98, .98, u => -.58 + .06 * (u / .98) ** 2, u => .52 - .1 * (u / .98) ** 2, { t: .016, nu: 12, nv: 8, slot: S.RUBBER, skin: H, out: outH, edge: .12, round: .7 });
  panel(m, (u, v, h) => mf(u, v, h + .016), -.8, .8, u => -.18 + .03 * (u / .8) ** 2, u => .4 - .08 * (u / .8) ** 2, { t: .014, nu: 10, nv: 6, slot: S.VISOR, skin: H, out: outH, edge: .06, round: .75, dome: .012 });
  m.tube(Array.from({ length: 25 }, (_, i) => { const t = i / 24 * TAU, u = .82 * Math.sin(t) * 1.0, v = .11 + .3 * Math.cos(t); return mf(u, v, .031); }), .0048, { slot: S.PLATE2, skin: H, sides: m.keep(1) ? 5 : 3, n: m.seg(30, 10), cap: false, up: [0, 0, -1] });
  const rg = T(0, 1.598, -.152, .25, 0, 0);
  m.revolve([[.002, .02], [.022, .02], [.03, .01], [.032, -.012], [.026, -.022]], { sides: m.keep(1) ? 10 : 6, slot: S.PLATE, skin: H, m: rg.clone().multiply(T(0, 0, 0, -Math.PI / 2, 0, 0)), crease: 35 });
  if (m.keep(1)) for (let k = 0; k < 3; k++) m.box([0, 1.6 - k * .011, -.184], [.034, .004, .006], .001, { slot: S.METAL, skin: H, m: null });
  // mask straps over the hood
  for (const y of [1.66, 1.71]) m.revolve([[.124, .006], [.127, .003], [.127, -.003], [.124, -.006]], { sides: m.keep(1) ? 16 : 8, slot: S.RUBBER, skin: H, m: T(0, y, .004, y > 1.7 ? .5 : .2, 0, 0, 1, 1, 1.12), crease: 50 });
  // neck seal
  m.revolve([[.072, .02], [.08, .012], [.082, -.006], [.09, -.02]], { sides: m.keep(1) ? 16 : 8, slot: S.RUBBER, skin: (x, y) => blend2(B.CHE, B.NEC, y, 1.5, .03), m: T(0, 1.5, .004, 0, 0, 0, 1, 1, .9), crease: 50 });
}

// ---------------------------------------------------------------- rebreather on the chest: hard housing, scrubber canister, counter-lungs, breathing loops; harness, belt
function rebreather(m) {
  const C = B.CHE;
  m.box([0, 1.19, -.16], [.24, .27, .065], .022, { slot: S.PLATE, skin: torsoSkin });
  m.box([0, 1.3, -.16], [.246, .012, .071], .004, { slot: S.PLATE2, skin: C });                        // lid seam
  const can = T(0, 1.155, -.193);
  m.revolve([[.002, .085], [.034, .085], [.044, .076], [.047, .05], [.047, -.06], [.043, -.078], [.002, -.08]], { sides: m.seg(16, 7), slot: S.PLATE2, skin: torsoSkin, m: can.clone().multiply(T(0, 0, 0, 0, 0, 0, 1, 1, .62)), crease: 40 });
  for (const y of [.045, -.04]) m.revolve([[.0478, .007], [.0478, -.007]], { sides: m.seg(16, 7), slot: S.ACCENT, skin: torsoSkin, m: can.clone().multiply(T(0, y, 0, 0, 0, 0, 1, 1, .62)), crease: 60 });
  if (m.keep(1)) { m.box([.082, 1.25, -.1935], [.04, .026, .004], .002, { slot: S.VISOR, skin: torsoSkin }); m.box([.082, 1.25, -.196], [.03, .006, .002], .001, { slot: S.GLOW, skin: torsoSkin }); }
  // counter-lung bags on the upper chest
  for (const s of [-1, 1]) {
    const rows = m.seg(5, 3), rings = [], n = m.seg(14, 7);
    for (let j = 0; j <= rows; j++) { const v = j / rows, y = lerp(1.315, 1.46, v), w = .076 * Math.sin(Math.PI * lerp(.08, .92, v)) ** .6, d = .046 * Math.sin(Math.PI * lerp(.1, .9, v)) ** .7; rings.push(Array.from({ length: n }, (_, i) => { const a = i / n * TAU; return [s * .09 + w * Math.cos(a), y, -.135 - d * Math.max(Math.sin(a), -.3)]; })); }
    m.loft(rings, { slot: S.CLOTH2, skin: torsoSkin, crease: 180, capA: true, capB: true, out: [s * .09, 1.39, -.135], ao: .9 });
  }
  // corrugated breathing loops from the housing round the bags to the mouthpiece
  for (const s of [-1, 1]) buildHose(m, [[s * .085, 1.31, -.19], [s * .132, 1.4, -.212], [s * .118, 1.5, -.2], [s * .07, 1.565, -.185], [s * .028, 1.592, -.17]], .015, C, B.HEA, { slot: S.PLATE, ribs: m.keep(0) ? 20 : 0, ribDepth: .15, sides: m.keep(1) ? 8 : 4, t0: .6, t1: .9, tube: { noEdge: true, crease: 75 } });
  // harness: from the belt up beside the housing, over the shoulders, down the back plate
  for (const s of [-1, 1]) strapAlong(m, [torsoP(s * .9, 1.01, .03), torsoP(s * .95, 1.2, .03), torsoP(s * .85, 1.38, .025), [s * .118, 1.485, -.04], [s * .12, 1.49, .03], torsoP(s * (Math.PI - .7), 1.42, .02), torsoP(s * (Math.PI - .55), 1.22, .02), torsoP(s * (Math.PI - .5), 1.04, .03)], .032, .0035, radialOut, { slot: S.RUBBER, skin: (x, y) => y > 1.47 ? [C, .8, B.NEC, .2] : torsoSkin(x, y), n: m.seg(30, 8) });
  // weight belt with blocks
  strapAlong(m, Array.from({ length: 16 }, (_, i) => torsoP(i / 16 * TAU, 1.0, .02)), .04, .004, radialOut, { slot: S.RUBBER, skin: B.PEL, closed: true, n: m.seg(36, 12) });
  for (const a of [-1.2, -.6, .6, 1.2]) { const p = torsoP(a, 1.0, .03); m.box([0, 0, 0], [.05, .036, .018], .0075, { slot: S.PLATE2, skin: B.PEL, m: T(p[0], p[1], p[2], 0, -a, 0) }); }
  m.box([0, 1.0, -.157], [.05, .03, .01], .003, { slot: S.METAL, skin: B.PEL });
}

// ---------------------------------------------------------------- twin bottles on a back plate, their hoses over the shoulders, fins clipped on the flanks
function tanks(m) {
  const C = B.CHE;
  m.box([0, 1.2, .146], [.22, .36, .016], .006, { slot: S.PLATE2, skin: C });
  for (const s of [-1, 1]) {
    const bm = T(s * .075, 1.19, .228);
    m.revolve([[.002, .2], [.028, .197], [.048, .184], [.059, .164], [.062, .14], [.062, -.14], [.058, -.164], [.045, -.18], [.002, -.19]], { sides: m.seg(18, 8), slot: S.PLATE, skin: C, m: bm, crease: 40 });
    for (const y of [-.11, .1]) m.revolve([[.0625, .012], [.066, .008], [.066, -.008], [.0625, -.012]], { sides: m.seg(18, 8), slot: S.RUBBER, skin: C, m: bm.clone().multiply(T(0, y, 0)), crease: 50 });
    m.revolve([[.002, .222], [.016, .222], [.018, .2], [.024, .2]], { sides: m.keep(1) ? 10 : 6, slot: S.METAL, skin: C, m: bm, crease: 40 });          // neck and valve
    if (m.keep(1)) m.revolve([[.004, .006], [.018, .006], [.02, 0], [.018, -.006], [.004, -.006]], { sides: 10, slot: S.RUBBER, skin: C, m: T(s * .105, 1.405, .228, 0, 0, Math.PI / 2), crease: 40 });     // hand wheel
    // hose from the valve over the shoulder to the housing
    buildHose(m, [[s * .085, 1.412, .212], [s * .13, 1.45, .17], [s * .148, 1.5, .07], [s * .15, 1.505, -.03], [s * .145, 1.45, -.13], [s * .112, 1.36, -.182]], .0105, C, C, { slot: S.PLATE2, sides: m.keep(1) ? 7 : 4, tube: { noEdge: true } });
    // fin: bright blade (both faces), dark side rails and middle stripe, foot pocket, two clamps to the bottle
    const ZC = .255, fm = (u, v, h) => [s * (.17 + h), u, v], fi = (u, v, h) => [s * (.17 - h), u, v], hw = u => lerp(.085, .044, clamp((u - .84) / .52, 0, 1) ** .8);
    const fo = { nu: 8, nv: 3, slot: S.ACCENT, skin: C, edge: .12, round: .25 };
    panel(m, fm, .84, 1.36, u => ZC - hw(u), u => ZC + hw(u), { ...fo, t: .0035, out: () => [s, 0, 0] });
    panel(m, fi, .84, 1.36, u => ZC - hw(u), u => ZC + hw(u), { ...fo, t: .0035, out: () => [-s, 0, 0] });
    for (const k of [-1, 1]) m.tube([1.3, 1.12, .96, .855].map(y => [s * .1745, y, ZC + k * (hw(y) - .004)]), .0078, { slot: S.PLATE2, skin: C, sides: m.keep(1) ? 6 : 4, n: m.seg(12, 4) });
    panel(m, (u, v, h) => fm(u, v, h + .0035), .875, 1.27, u => ZC - .2 * hw(u), u => ZC + .2 * hw(u), { t: .0025, nu: 5, nv: 1, slot: S.PLATE2, skin: C, out: () => [s, 0, 0], edge: .2, round: .5 });
    m.box([s * .184, 1.335, ZC], [.03, .17, .1], .013, { slot: S.RUBBER, skin: C });
    for (const y of [1.1, 1.24]) m.box([s * .152, y, .228], [.04, .026, .034], .005, { slot: S.RUBBER, skin: C });
  }
  m.tube([[-.075, 1.405, .228], [.075, 1.405, .228]], .008, { slot: S.METAL, skin: C, sides: m.keep(1) ? 6 : 4, n: 3 });          // manifold
}

// ---------------------------------------------------------------- knife and pressure gauge on the harness, dive console, calf knife, pocket, team bands, knee pads
function gear(m) {
  const C = B.CHE;
  // knife on the left strap, handle up
  { const a = -.93, p = torsoP(a, 1.13, .052), M = T(p[0], p[1], p[2], 0, Math.PI - a, .12);
    m.box([0, -.035, 0], [.032, .12, .016], .006, { slot: S.PLATE2, skin: torsoSkin, m: M });
    for (const y of [-.015, -.07]) m.box([0, y, .001], [.036, .01, .02], .002, { slot: S.RUBBER, skin: torsoSkin, m: M });
    m.box([0, .03, .002], [.042, .008, .02], .002, { slot: S.METAL, skin: torsoSkin, m: M });
    m.box([0, .068, .003], [.024, .07, .02], .008, { slot: S.RUBBER, skin: torsoSkin, m: M });
    m.box([0, .107, .003], [.027, .012, .022], .004, { slot: S.METAL, skin: torsoSkin, m: M }); }
  // pressure gauge on the right strap, its hose round the right side to the bottle valve
  { const a = .95, p = torsoP(a, 1.14, .05), M = T(p[0], p[1], p[2], 0, Math.PI - a, 0), F = M.clone().multiply(T(0, 0, 0, Math.PI / 2, 0, 0));
    m.revolve([[.002, .02], [.027, .02], [.032, .014], [.032, -.004], [.026, -.012]], { sides: m.seg(16, 7), slot: S.RUBBER, skin: torsoSkin, m: F, crease: 40 });
    m.revolve([[.002, .0215], [.024, .0215]], { sides: m.seg(16, 7), slot: S.VISOR, skin: torsoSkin, m: F, crease: 40 });
    if (m.keep(1)) { m.revolve([[.023, .023], [.028, .022], [.028, .019]], { sides: 16, slot: S.METAL, skin: torsoSkin, m: F, crease: 50 }); m.box([.006, .004, .024], [.014, .003, .002], .0005, { slot: S.GLOW, skin: torsoSkin, m: M }); }
    const e = M.clone().multiply(T(0, -.03, -.004)).elements;
    buildHose(m, [[e[12], e[13], e[14]], [.2, 1.07, -.07], [.215, 1.1, .06], [.17, 1.3, .17], [.09, 1.4, .205]], .0068, C, C, { slot: S.RUBBER, sides: m.keep(1) ? 6 : 4 }); }
  // dive console on the left forearm (two dials, a lit screen)
  const F = B.FAL, x = -.2;
  m.box([x - .066, 1.02, 0], [.012, .07, .046], .005, { slot: S.PLATE2, skin: F });
  for (const [y, sl] of [[1.04, S.VISOR], [1.0, S.GLOW]]) m.revolve([[.002, .004], [.014, .004], [.016, 0]], { sides: m.keep(1) ? 10 : 6, slot: sl, skin: F, m: T(x - .073, y, 0, 0, 0, Math.PI / 2), crease: 40 });
  // knife on the right calf
  { const SH = B.SHR, kp = legW(1, .072); panel(m, kp, -.25, .25, .26, .4, { t: .012, nu: 2, nv: 4, slot: S.PLATE2, skin: SH, out: (px, py, pz) => [px - .1, 0, pz], edge: .15, round: .5 }); m.box([0, 0, 0], [.022, .045, .024], .005, { slot: S.RUBBER, skin: SH, m: T(.1 + .03, .43, -.072) }); for (const y of [.3, .37]) m.revolve([[.072, .006], [.075, .003], [.075, -.003], [.072, -.006]], { sides: m.keep(1) ? 12 : 7, slot: S.RUBBER, skin: SH, m: T(.1, y, .003), crease: 50 }); }
  buildPouch(m, .07, .1, .022, T(.205, .73, -.01, 0, Math.PI / 2, 0), { slot: S.CLOTH2, slotFlap: S.PLATE2, skin: B.THR, tab: false });       // thigh pocket
  for (const s of [-1, 1]) m.revolve([[.0672, .01], [.0702, .007], [.0702, -.007], [.0672, -.01]], { sides: m.keep(1) ? 16 : 8, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, m: T(s * .2, 1.24, 0), crease: 50 });
  // knee pads (neoprene, domed) on a taped rim
  for (const s of [-1, 1]) {
    const SH = s < 0 ? B.SHL : B.SHR, TH = s < 0 ? B.THL : B.THR, kSk = (px, py) => blend2(SH, TH, py, .55, .03), ol = (px, py, pz) => [px - s * .1, 0, pz], kr = (u, v) => .076 + .018 * Math.max(0, 1 - (u / 1.1) ** 2) * Math.max(0, 1 - ((v - .51) / .08) ** 2);
    panel(m, legW(s, .074), -1.22, 1.22, .425, .605, { t: .008, nu: 9, nv: 4, slot: S.PLATE, skin: kSk, out: ol, edge: .1, round: .5 });
    panel(m, legW(s, kr), -1.1, 1.1, .44, .59, { t: .009, nu: 9, nv: 6, slot: S.CLOTH2, skin: kSk, out: ol, dome: .003, edge: .15, round: .6 });
  }
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  const H = B.HEA;
  for (let i = 0; i < 10; i++) { const t = (i + .5) / 10 * TAU, [q, d] = mapAt((u, v, h) => hood(u, v, h + .006), .84 * Math.sin(t), .11 + .32 * Math.cos(t), .032); screw(m, q, d, { r: .0028, skin: H }); }
  for (const s of [-1, 1]) {
    const p = torsoP(s * .9, 1.035, .036); buckleAt(m, p, [Math.sin(s * .9), 0, -Math.cos(s * .9)], { skin: B.PEL, w: .036, d: .014 });
    stitchLine(m, Array.from({ length: 6 }, (_, i) => torsoP(s * 1.05, lerp(1.03, 1.29, i / 5), .0145)), { skin: torsoSkin, n: 14 });
    for (const y of [1.07, 1.31]) screw(m, [s * .1, y, -.193], [0, 0, -1], { r: .0034, skin: torsoSkin });
  }
  m.box([0, 0, 0], [.006, .022, .004], .001, { slot: S.METAL, skin: B.CHE, m: T(.0, 1.11, -.231) });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.CLOTH2 }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.CLOTH2 }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  m => buildSuit(m, { slot: S.CLOTH, slotLegs: S.CLOTH, folds: FOLDS }),
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.CLOTH2, slotRand: S.RUBBER, slotSole: S.PLATE2, slotMid: S.RUBBER, slotTongue: S.CLOTH2, slotPanel: S.CLOTH2 }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.CLOTH2, slotCuff: S.RUBBER, guard: false, cuff: false }); },
  drysuit, head, rebreather, tanks, gear,
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['suit', 'boots', 'gloves', 'drysuit', 'head', 'rebreather', 'tanks', 'gear']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
void clamp; void planeMap;
