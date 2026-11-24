// outfit-demineur.js — FRONT ZÉRO: DÉMINEUR, the bomb-disposal set. Original design: a quilted blast suit (channelled padding on torso, sleeves and legs),
// a big rounded helmet with a wide framed visor and a ventilation fan on top, a high padded blast collar with three hard shells and a rolled lip,
// segmented blast plates on dark rims (chest, two abdominal plates, groin flap, two thigh plates and a shin plate per leg) with a pull handle,
// padded knee guards, a wide cooling unit on the back (fan, coolant canisters on its flanks, ribbed hoses over the shoulders), a control box,
// a radio and cable runs, a tool roll, thigh cargo pockets.
// Bulk stays inside the soldier's hitbox (0.34 m around the body axis below the neck, 0.2 m around the head, under 1.82 m).
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, lerp, clamp, sstep, blend2, torsoSkin, armSkin, legSkin, buildSuit, buildGlove, buildBoot, buildPouch, buildHose, buildGloveDetail, buildBootDetail, mapAt, screw, stitchLine, buckleAt, panel, coilCable, defineOutfitSet, strapAlong } from './outfit-kit.js';

const TAU = Math.PI * 2;
const pbr = { cloth: [.9, 0, 0, .9], cloth2: [.86, 0, 0, .8], plate: [.5, .08, 0, 0], plate2: [.55, .06, 0, 0], visor: [.08, .5, .02, 0] };

// ---------------------------------------------------------------- colourways
export const OUTFIT_SETS = [
  { id: 'demineur-kaki', setId: 'demineur', name: 'DÉMINEUR', colorway: 'Kaki', rarity: 'Élite', palette: { cloth: 0x6b6046, cloth2: 0x4a4332, plate: 0x4a4838, plate2: 0x2a2822, rubber: 0x23211e, metal: 0x6a6962, accent: 0xd89a1e, glow: 0xffd27a, visor: 0x0f1518, rim: 0x5c5444, lift: .014, pbr } },
  { id: 'demineur-olive', setId: 'demineur', name: 'DÉMINEUR', colorway: 'Olive', rarity: 'Élite', palette: { cloth: 0x4d5533, cloth2: 0x32372a, plate: 0x323728, plate2: 0x1d2018, rubber: 0x1f211b, metal: 0x5f6158, accent: 0xc9b23a, glow: 0xe8f08a, visor: 0x0e1410, rim: 0x5a6448, lift: .016, pbr } },
  { id: 'demineur-ardoise', setId: 'demineur', name: 'DÉMINEUR', colorway: 'Ardoise', rarity: 'Élite', palette: { cloth: 0x4b5765, cloth2: 0x313a45, plate: 0x2e3640, plate2: 0x1a1f25, rubber: 0x1b1f24, metal: 0x6b737a, accent: 0x2fa6d6, glow: 0x7fe0ff, visor: 0x0b141c, rim: 0x55626e, lift: .02, pbr } },
  { id: 'demineur-signal', setId: 'demineur', name: 'DÉMINEUR', colorway: 'Signal', rarity: 'Légende', palette: { cloth: 0x2e3032, cloth2: 0x1e2022, plate: 0x4b4e53, plate2: 0x18191b, rubber: 0x141516, metal: 0x5c6166, accent: 0xf27a18, glow: 0xffa040, visor: 0x14100c, rim: 0x75787c, lift: .04, pbr } },
];

// ---------------------------------------------------------------- shapes
const sring = (n, y, rx, zf, zb, e, disp) => { const p = 2 / e, o = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, s = Math.sin(a), c = Math.cos(a), d = disp ? disp(a, y) : 0; o.push([(rx + d) * Math.sign(s) * Math.abs(s) ** p, y, -((c > 0 ? zf : zb) + d) * Math.sign(c) * Math.abs(c) ** p]); } return o; };
/** Quilted padding: rounded channels every `pitch` along v, softened by vertical seams at angles `seams`. */
const quilt = (v, v0, pitch, depth, a, seams = []) => { const k = Math.sqrt(Math.abs(Math.sin(Math.PI * (v - v0 + .012 * Math.sin(a * 2 + v * 9)) / pitch))); let s = 1; for (const q of seams) { const d = ((a - q + Math.PI) % TAU + TAU) % TAU - Math.PI; s *= 1 - .45 * Math.exp(-((d / .09) ** 2)); } return depth * k * s; };
const flat = (x, y, z) => [x, 0, z];
const legW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .1 + s * r * Math.sin(u), v, -r * Math.cos(u)]; };
const armW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .2 + s * r * Math.cos(u), v, r * Math.sin(u)]; };

// jacket rows [y, rx, front, back]
const JK = [[.95, .19, .152, .14], [1.0, .198, .158, .142], [1.08, .19, .15, .136], [1.16, .196, .155, .14], [1.25, .21, .166, .148], [1.33, .218, .172, .152], [1.4, .214, .168, .148], [1.45, .19, .15, .134], [1.485, .15, .124, .112]];
const jkAt = y => { if (y <= JK[0][0]) return JK[0]; for (let i = 0; i < JK.length - 1; i++) { const a = JK[i], b = JK[i + 1]; if (y <= b[0]) { const t = (y - a[0]) / (b[0] - a[0]); return a.map((v, k) => lerp(v, b[k], t)); } } return JK[JK.length - 1]; };
const jkP = (a, y, off = 0) => { const r = jkAt(y), s = Math.sin(a), c = Math.cos(a), p = 2 / 2.6; return [(r[1] + off) * Math.sign(s) * Math.abs(s) ** p, y, -((c > 0 ? r[2] : r[3]) + off) * Math.sign(c) * Math.abs(c) ** p]; };

// ---------------------------------------------------------------- padded jacket, sleeves, trousers
function jacket(m) {
  const n = m.seg(30, 12), dq = m.lod === 2 ? 0 : 1, rows = [];
  for (let y = .95; y <= 1.486; y += m.lod === 0 ? .018 : m.lod === 1 ? .045 : .09) rows.push(y);
  m.loft(rows.map(y => { const r = jkAt(y); return sring(n, y, r[1], r[2], r[3], 2.6, (a, yy) => dq * quilt(yy, .95, .066, .011, a, [0, Math.PI, 1.57, -1.57]) * sstep(1.48, 1.44, yy)); }), { slot: S.CLOTH, skin: torsoSkin, crease: 180, out: flat, capB: true, ao: (x, y) => .7 + .3 * sstep(.95, 1.1, y) });
  // hem band and a stitched zip flap down the front
  strapAlong(m, Array.from({ length: 24 }, (_, i) => jkP(i / 24 * TAU, .961, .0075)), .024, .008, flat, { slot: S.CLOTH2, skin: torsoSkin, closed: true, n: m.seg(36, 12) });
}
function sleeves(m) {
  const n = m.seg(14, 7);
  for (const s of [-1, 1]) {
    const rows = []; for (let y = 1.46; y >= .93; y -= m.lod === 0 ? .016 : m.lod === 1 ? .04 : .08) rows.push(y);
    const R = y => y > 1.38 ? lerp(.055, .094, sstep(1.47, 1.38, y)) : y > 1.18 ? lerp(.094, .086, sstep(1.38, 1.18, y)) : y > 1.12 ? .08 : lerp(.08, .066, sstep(1.12, .93, y));
    m.loft(rows.map(y => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, r = R(y) + (m.lod === 2 ? 0 : quilt(y, .93, .055, .008, a, [Math.PI / 2])); return [s * .2 + s * r * Math.cos(a), y, r * Math.sin(a)]; })), { slot: S.CLOTH, skin: armSkin(s), crease: 180, capA: true, capB: true, out: (x, y, z) => [x - s * .2, 0, z], ao: (x, y) => .75 + .25 * sstep(1.0, 1.3, y) });
    // team band on the upper sleeve, a cuff strap at the wrist
    m.revolve([[.098, .011], [.101, .007], [.101, -.007], [.098, -.011]], { sides: m.keep(1) ? 16 : 8, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, m: T(s * .2, 1.29, 0), crease: 50 });
    m.revolve([[.068, .012], [.072, .007], [.072, -.007], [.068, -.012]], { sides: m.keep(1) ? 12 : 7, slot: S.CLOTH2, skin: s < 0 ? B.FAL : B.FAR, m: T(s * .2, .94, 0), crease: 50 });
    const oa = (x, y, z) => [x - s * .2, 0, z];
    panel(m, armW(s, (u, v) => .086 - .008 * sstep(1.08, .96, v)), -1.6, 1.6, .965, 1.1, { t: .012, nu: 8, nv: 3, slot: S.PLATE2, skin: s < 0 ? B.FAL : B.FAR, out: oa, dome: .004, edge: .1, round: .45 });
    panel(m, armW(s, .1), -1.25, 1.25, 1.33, 1.46, { t: .014, nu: 8, nv: 3, slot: S.PLATE2, skin: (x, y) => [B.CHE, .35, s < 0 ? B.UAL : B.UAR, .65], out: (x, y, z) => [x - s * .2, .4, z], dome: .006, edge: .1, round: .45 });
  }
}
function trousers(m) {
  const n = m.seg(16, 8);
  for (const s of [-1, 1]) {
    const rows = []; for (let y = .96; y >= .24; y -= m.lod === 0 ? .02 : m.lod === 1 ? .05 : .1) rows.push(y);
    const R = y => y > .8 ? lerp(.122, .126, sstep(.96, .8, y)) : y > .56 ? lerp(.126, .1, sstep(.8, .56, y)) : y > .44 ? .098 : lerp(.098, .086, sstep(.44, .24, y));
    m.loft(rows.map(y => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, r = R(y) + (m.lod === 2 ? 0 : quilt(y, .24, .07, .009, a, [0, Math.PI])); return [s * .1 + r * Math.sin(a), y, -r * Math.cos(a) + .004]; })), { slot: S.CLOTH, skin: legSkin(s), crease: 180, capA: true, capB: true, out: (x, y, z) => [x - s * .1, 0, z], ao: (x, y) => .72 + .28 * sstep(.3, .6, y) });
    // padded knee guard with a hard cap, strap below
    const SH = s < 0 ? B.SHL : B.SHR, TH = s < 0 ? B.THL : B.THR, kSk = (px, py) => blend2(SH, TH, py, .55, .03), ol = (x, y, z) => [x - s * .1, 0, z];
    const kr = (u, v) => .104 + .02 * Math.max(0, 1 - (u / 1.15) ** 2) * Math.max(0, 1 - ((v - .51) / .09) ** 2);
    panel(m, legW(s, kr), -1.15, 1.15, u => .43 + .04 * (u / 1.15) ** 2, u => .6 - .03 * (u / 1.15) ** 2, { t: .012, nu: 10, nv: 6, slot: S.PLATE, skin: kSk, out: ol, dome: .004, edge: .12, round: .5 });
    if (m.keep(1)) panel(m, legW(s, (u, v) => kr(u, v) + .012), -.35, .35, .565, .582, { t: .0018, nu: 4, nv: 1, slot: S.ACCENT, skin: kSk, out: ol, edge: .05, round: 0 });
    m.revolve([[.096, .009], [.1, .005], [.1, -.005], [.096, -.009]], { sides: m.keep(1) ? 14 : 8, slot: S.RUBBER, skin: SH, m: T(s * .1, .415, .004), crease: 50 });
    // two thigh plates and a shin plate, each on its rim; straps behind the thigh
    const tr = (u, v) => lerp(.12, .138, sstep(.62, .9, v));
    rimmed(m, legW(s, tr), -.95, 1.2, .776, u => .9 - .05 * sstep(-.2, -.95, u), { skin: TH, out: ol, nu: 9, nv: 3, du: .075, dv: .012, round: .45 });
    rimmed(m, legW(s, tr), -.95, 1.2, .628, .752, { skin: TH, out: ol, nu: 9, nv: 3, du: .075, dv: .012, round: .45 });
    rimmed(m, legW(s, (u, v) => .1 - .008 * sstep(.4, .26, v)), -1.0, 1.0, .275, .398, { skin: SH, out: ol, nu: 8, nv: 3, du: .08, dv: .012, round: .45 });
    for (const y of [.69, .845]) { const r = R(y) + .011; m.revolve([[r, .008], [r + .004, .005], [r + .004, -.005], [r, -.008]], { sides: m.keep(1) ? 14 : 8, slot: S.RUBBER, skin: TH, m: T(s * .1, y, .004), crease: 50 }); }
    // cargo pocket on the outer thigh, behind the plates
    { const a = 1.78, r = tr(a, .7) + .009 + .017; buildPouch(m, .072, .1, .034, T(s * (.1 + r * Math.sin(a)), .7, -r * Math.cos(a) + .004, 0, Math.atan2(s * Math.sin(a), -Math.cos(a)), 0), { slot: S.CLOTH2, slotFlap: S.CLOTH, skin: TH, slotTab: S.ACCENT }); }
  }
}

// ---------------------------------------------------------------- segmented blast plates (chest, two abdominal plates, groin flap), each on a darker rim
const plMap = (u, v, h) => { const p = jkP(u, v, h + .014 + .01 * sstep(1.0, .9, v)); return [p[0], p[1], p[2] - .012 * sstep(1.0, .86, v)]; };
const plSk = (x, y) => (y > 1.02 ? torsoSkin(x, y) : [B.PEL, 1]);
const fnOf = f => (typeof f === 'function' ? f : () => f);
/** A hard plate on a darker rim plate a little larger than it: the edge reads at sheet distance. */
function rimmed(m, map, u0, u1, lo, hi, o) {
  const L = fnOf(lo), H = fnOf(hi), du = o.du ?? .06, dv = o.dv ?? .012;
  panel(m, map, u0 - du, u1 + du, u => L(u) - dv, u => H(u) + dv, { t: o.tr ?? .01, nu: o.nu, nv: o.nv, slot: S.PLATE2, skin: o.skin, out: o.out, edge: .08, round: (o.round ?? .4) + .05, noEdge: true });
  panel(m, (u, v, h) => map(u, v, h + (o.lift ?? .006)), u0, u1, L, H, { t: o.t ?? .012, nu: o.nu, nv: o.nv, slot: o.slot ?? S.PLATE, skin: o.skin, out: o.out, dome: o.dome ?? .008, edge: .1, round: o.round ?? .4 });
}
const GAPS = [1.24, 1.1255, 1.0255];
function blastPlate(m) {
  const o = { skin: plSk, out: flat };
  rimmed(m, plMap, -.84, .84, u => 1.255 + .015 * (u / .84) ** 2, u => 1.43 - .05 * (u / .84) ** 2, { ...o, nu: 10, nv: 6, dome: .01 });     // chest
  rimmed(m, plMap, -.76, .76, 1.14, 1.226, { ...o, nu: 9, nv: 3 });                                                                       // upper abdomen
  rimmed(m, plMap, -.7, .7, 1.04, 1.111, { ...o, nu: 9, nv: 3 });                                                                         // lower abdomen
  rimmed(m, plMap, -.5, .5, u => .845 + .07 * (u / .5) ** 2, 1.011, { ...o, nu: 7, nv: 5, round: .5 });                                   // groin flap
  // accent bars on the chest and abdominal plates
  if (m.keep(1)) for (const s of [-1, 1]) for (const [lo, hi] of [[1.285, 1.39], [1.155, 1.212], [1.054, 1.097]]) panel(m, (u, v, h) => plMap(u, v, h + .024), s * .56, s * .66, lo, hi, { t: .003, nu: 1, nv: 2, slot: S.ACCENT, skin: plSk, out: flat, edge: .1, round: .3 });
  // webbing links across the gaps, the pull handle on top
  for (const y of GAPS) for (const u of [-.32, .32]) { const p = plMap(u, y, .016); m.box([0, 0, 0], [.03, .04, .007], .002, { slot: S.RUBBER, skin: plSk, m: T(p[0], p[1], p[2], 0, Math.PI - u, 0) }); }
  { const z0 = plMap(0, 1.395, .024)[2]; m.tube([[-.05, 1.392, z0 + .002], [-.05, 1.412, z0 - .014], [.05, 1.412, z0 - .014], [.05, 1.392, z0 + .002]], .0058, { slot: S.RUBBER, skin: torsoSkin, sides: m.keep(1) ? 6 : 4, n: m.seg(10, 4) }); }
  // back panel
  panel(m, (u, v, h) => jkP(u, v, h + .006), Math.PI - .95, Math.PI + .95, 1.0, 1.42, { t: .01, nu: 8, nv: 5, slot: S.PLATE2, skin: torsoSkin, out: flat });
}

// ---------------------------------------------------------------- high blast collar: padded ring up to the helmet's ears, three hard shells, a rolled lip
const colTop = a => 1.672 - .1 * Math.max(0, Math.cos(a)) ** 2;                 // 1.572 at the throat (visor clear), 1.672 at the sides and back
const colR = v => lerp(.192, .178, v) + .007 * Math.sin(v * Math.PI);           // stays inside the head box (0.2 m) above the neck
const colMap = (a, y, h = 0) => { const v = clamp((y - 1.43) / (colTop(a) - 1.43), 0, 1), r = colR(v) + h, zf = .965 + .035 * Math.cos(a + Math.PI); return [r * Math.sin(a), y, -.004 - r * zf * Math.cos(a)]; };
const colSk = (x, y) => (y > 1.53 ? blend2(B.NEC, B.HEA, y, 1.585, .03) : blend2(B.CHE, B.NEC, y, 1.49, .03));
function collar(m) {
  const n = m.seg(32, 12), rows = m.seg(8, 3), q = m.lod === 2 ? 0 : 1, rings = [];
  for (let j = 0; j <= rows; j++) { const v = j / rows; rings.push(Array.from({ length: n }, (_, i) => { const a = i / n * TAU, y = lerp(1.43, colTop(a), v); return colMap(a, y, q * .005 * Math.sqrt(Math.abs(Math.sin(a * 7)))); })); }
  m.loft(rings, { slot: S.CLOTH2, skin: colSk, crease: 180, out: (x, y, z) => [x, 0, z], ao: (x, y) => .66 + .34 * sstep(1.44, 1.58, y) });
  // rolled lip round the top edge, and the inner face so the opening has a thickness
  const lr = .013, nl = m.seg(6, 3);
  m.grid(n, nl, (u, v) => { const a = u * TAU, t = v * TAU, y = colTop(a), c = colMap(a, y, -lr * .4); const d = Math.hypot(c[0], c[2] + .004) || 1; return [c[0] + c[0] / d * lr * Math.cos(t), y - .004 + lr * Math.sin(t), c[2] + (c[2] + .004) / d * lr * Math.cos(t)]; }, { wrapU: true, slot: S.CLOTH2, skin: colSk, crease: 180, ao: .9, out: (x, y, z) => { const a = Math.atan2(x, -(z + .004)), yy = colTop(a), c = colMap(a, yy, -lr * .4); return [x - c[0], y - (yy - .004), z - c[2]]; } });
  m.grid(n, 1, (u, v) => { const a = u * TAU, y = colTop(a) - .012 - .03 * v, c = colMap(a, y, -.02 - .004 * v); return c; }, { wrapU: true, slot: S.CLOTH2, skin: B.HEA, crease: 180, out: (x, y, z) => [-x, 0, -z], ao: .5 });
  // hard shells on the left, back and right, with a gap between them
  for (const [u0, u1] of [[-2.3, -1.12], [2.46, 3.82], [1.12, 2.3]]) panel(m, (u, v, h) => colMap(u, v, h + .006), u0, u1, 1.47, u => colTop(u) - .035, { t: .012, nu: m.seg(8, 4), nv: 4, slot: S.PLATE, skin: colSk, out: (x, y, z) => [x, 0, z], dome: .006, edge: .12, round: .45 });
}

// ---------------------------------------------------------------- helmet
const HC = [0, 1.672, -.012], HR = [.152, .146, .168];
const hp = (lon, lat, off = 0) => { const c = Math.cos(lat), k = lat < 0 ? 1 - .1 * (lat / 1.1) ** 2 : 1, y = lat < 0 ? lat * .88 : Math.sin(lat); return [HC[0] + (HR[0] * (lat < 0 ? k : c) + off) * Math.sin(lon), HC[1] + HR[1] * y + (lat > 0 ? off * Math.sin(lat) : 0), HC[2] - (HR[2] * (lat < 0 ? k : c) + off) * Math.cos(lon)]; };
const outH = (x, y, z) => [x - HC[0], y - HC[1] + .03, z - HC[2]];
function helmet(m) {
  const H = B.HEA, nu = m.seg(30, 12), nv = m.seg(11, 5);
  m.grid(nu, nv, (u, v) => hp(u * TAU - Math.PI, lerp(-1.0, 1.5707, v)), { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 50, out: outH, ao: (x, y) => .7 + .3 * sstep(1.6, 1.72, y) });
  // wide visor in a thick frame
  m.grid(m.seg(20, 8), m.seg(5, 2), (u, v) => hp(lerp(-1.0, 1.0, u), lerp(-.55, .42, v), .004), { slot: S.VISOR, skin: H, crease: 180, out: outH });
  const fr = (u0, u1, lo, hi, t) => panel(m, (u, v, h) => hp(u, v, h + .003), u0, u1, lo, hi, { t, nu: 8, nv: 2, slot: S.PLATE2, skin: H, out: outH, edge: .15, round: .3 });
  fr(-1.08, 1.08, .4, .56, .012); fr(-1.08, 1.08, -.66, -.5, .012);
  for (const s of [-1, 1]) fr(s < 0 ? -1.14 : .96, s < 0 ? -.96 : 1.14, -.62, .5, .013);
  if (m.keep(1)) for (const s of [-1, 1]) for (const la of [-.35, .25]) { const [q, d] = mapAt(hp, s * 1.05, la, .016); m.revolve([[.002, .004], [.006, .004], [.0075, 0]], { sides: 6, slot: S.METAL, skin: H, m: T(q[0], q[1], q[2], 0, 0, 0), crease: 40 }); void d; }
  // ventilation fan on the crown: housing, grille ribs, a cable to the back
  const fan = T(0, 1.8, -.012);
  m.revolve([[.002, .012], [.034, .012], [.044, .006], [.048, -.012]], { sides: m.seg(16, 8), slot: S.PLATE2, skin: H, m: fan, crease: 40 });
  if (m.keep(1)) for (let k = 0; k < 6; k++) m.box([0, .0135, 0], [.064, .003, .005], .001, { slot: S.METAL, skin: H, m: fan.clone().multiply(T(0, 0, 0, 0, k * Math.PI / 6, 0)) });
  // side mounts and a lamp over the visor
  for (const s of [-1, 1]) m.revolve([[.002, .012], [.022, .012], [.027, .006], [.027, -.008]], { sides: m.keep(1) ? 8 : 6, slot: S.PLATE2, skin: H, m: T(s * .156, 1.665, .01, 0, 0, -s * Math.PI / 2), crease: 35 });
  m.box([0, 0, 0], [.04, .022, .026], .006, { slot: S.PLATE2, skin: H, m: T(0, 1.775, -.15, -.5, 0, 0) });
  if (m.keep(1)) m.box([0, 0, 0], [.03, .014, .004], .002, { slot: S.GLOW, skin: H, m: T(0, 1.768, -.163, -.5, 0, 0) });
}

// ---------------------------------------------------------------- back cooling unit: wide housing, coolant canisters on its flanks, fan, hoses over the shoulders
function backUnit(m) {
  const C = B.CHE;
  m.box([0, 1.235, .222], [.29, .3, .1], .03, { slot: S.PLATE2, skin: C });
  if (m.keep(1)) for (let k = 0; k < 5; k++) m.box([0, 1.115 + k * .026, .2735], [.19, .01, .005], .002, { slot: S.RUBBER, skin: C });
  // fan: ring, hub and blades on the back face, a status lamp
  const fan = T(0, 1.3, .272, Math.PI / 2, 0, 0);
  m.revolve([[.03, .006], [.058, .006], [.064, .0], [.064, -.008]], { sides: m.seg(18, 8), slot: S.PLATE, skin: C, m: fan, crease: 40 });
  m.revolve([[.002, .01], [.016, .009], [.02, .0]], { sides: m.seg(10, 5), slot: S.METAL, skin: C, m: fan, crease: 40 });
  if (m.keep(1)) for (let k = 0; k < 6; k++) m.box([0, 0, 0], [.088, .004, .012], .001, { slot: S.RUBBER, skin: C, m: T(0, 1.3, .276, 0, 0, k * Math.PI / 6) });
  if (m.keep(1)) m.box([.1, 1.37, .2735], [.03, .012, .004], .002, { slot: S.GLOW, skin: C });
  for (const s of [-1, 1]) {
    // coolant canister on the flank, two bands, a cap; it shows past the arm in a front three-quarter view
    const cm = T(s * .175, 1.22, .232);
    m.revolve([[.002, .158], [.026, .158], [.04, .148], [.047, .126], [.047, -.126], [.042, -.146], [.024, -.155], [.002, -.155]], { sides: m.seg(16, 7), slot: S.PLATE, skin: C, m: cm, crease: 40 });
    for (const y of [.075, -.075]) m.revolve([[.0478, .011], [.0498, .007], [.0498, -.007], [.0478, -.011]], { sides: m.seg(16, 7), slot: y > 0 ? S.ACCENT : S.PLATE2, skin: C, m: cm.clone().multiply(T(0, y, 0)), crease: 50 });
    m.revolve([[.002, .02], [.016, .02], [.02, .012], [.02, 0]], { sides: m.keep(1) ? 10 : 6, slot: S.METAL, skin: C, m: cm.clone().multiply(T(0, .155, 0)), crease: 40 });
    // clamp of the canister to the housing
    m.box([s * .148, 1.22, .232], [.03, .05, .06], .006, { slot: S.PLATE2, skin: C });
    // harness straps: up the back, under the collar, out again onto the chest plate
    m.tube([[s * .09, 1.1, .175], [s * .112, 1.3, .168], [s * .13, 1.44, .13]], .011, { slot: S.RUBBER, skin: torsoSkin, sides: 5, flat: .35, n: m.seg(8, 4), up: [1, 0, 0] });
    { const e = plMap(s * .58, 1.405, .02); m.tube([[s * .13, 1.455, -.1], [s * .135, 1.44, -.17], [e[0], e[1] + .004, e[2]]], .011, { slot: S.RUBBER, skin: torsoSkin, sides: 5, flat: .35, n: m.seg(6, 3), up: [1, 0, 0] }); }
  }
  // ribbed hoses: right canister over the right shoulder to the back of the helmet, left canister into the collar
  buildHose(m, [[.175, 1.385, .232], [.168, 1.45, .195], [.142, 1.54, .178], [.1, 1.64, .158], [.035, 1.736, .138]], .012, C, B.HEA, { ribs: m.keep(0) ? 16 : 0, ribDepth: .16, sides: m.keep(1) ? 7 : 4, t0: .3, t1: .7, tube: { noEdge: true, crease: 75 } });
  buildHose(m, [[-.175, 1.385, .232], [-.17, 1.45, .195], [-.152, 1.53, .172], [-.13, 1.585, .142]], .011, C, B.NEC, { ribs: m.keep(0) ? 10 : 0, ribDepth: .16, sides: m.keep(1) ? 7 : 4, t0: .4, t1: .9, tube: { noEdge: true, crease: 75 } });
}

// ---------------------------------------------------------------- chest kit: tool roll, control box, radio, cable runs, pockets
function chestKit(m) {
  const C = B.CHE;
  buildPouch(m, .1, .045, .03, T(.075, 1.36, -.232, -.12, Math.PI, 0), { slot: S.CLOTH2, slotFlap: S.CLOTH, skin: C, slotTab: S.ACCENT });
  if (m.keep(0)) for (let k = 0; k < 4; k++) m.box([.05 + k * .017, 1.393, -.235], [.006, .022, .006], .0015, { slot: S.METAL, skin: C });
  // control box on the left of the chest plate: two lit keys, a toggle
  { const [p] = mapAt(plMap, -.5, 1.345, .03), M = T(p[0], p[1], p[2], -.08, Math.PI + .5, 0);
    m.box([0, 0, 0], [.072, .05, .026], .006, { slot: S.PLATE2, skin: C, m: M });
    if (m.keep(1)) for (const x of [-.018, .006]) m.box([x, .006, .014], [.014, .01, .004], .001, { slot: S.GLOW, skin: C, m: M });
    if (m.keep(1)) m.box([.024, .006, .016], [.006, .006, .012], .001, { slot: S.METAL, skin: C, m: M }); }
  // radio on the left side
  buildPouch(m, .045, .08, .03, T(-.205, 1.25, -.06, 0, Math.PI + 1.25, 0), { slot: S.CLOTH2, slotFlap: S.PLATE2, skin: C, tab: false });
  if (m.keep(1)) m.tube([[-.212, 1.29, -.06], [-.214, 1.35, -.058]], .004, { slot: S.RUBBER, skin: C, sides: 4, n: 2 });
  // cables: radio -> control box, control box -> collar (coiled), back unit -> radio under the arm, right canister -> switch box on the right hip
  const cab = (pts, sk) => m.tube(pts, .0048, { slot: S.RUBBER, skin: sk, sides: m.keep(1) ? 5 : 3, n: m.seg(Math.max(8, pts.length * 4), 4) });
  { const a = mapAt(plMap, -.82, 1.31, .03)[0], b = mapAt(plMap, -.64, 1.34, .03)[0]; cab([[-.226, 1.24, -.075], [-.214, 1.29, -.14], a, b], torsoSkin); }
  { const [p] = mapAt(plMap, -.44, 1.38, .03); if (m.keep(1)) coilCable(m, p, [-.085, 1.5, -.172], { skin: (x, y) => (y > 1.46 ? [B.NEC, 1] : torsoSkin(x, y)), turns: 5, R: .006, r: .0022 }); else cab([p, [-.085, 1.5, -.172]], torsoSkin); }
  cab([[-.14, 1.12, .175], [-.205, 1.11, .1], [-.222, 1.16, 0], [-.218, 1.21, -.05]], torsoSkin);
  { const sp = jkP(1.0, 1.0, .03); cab([[.175, 1.068, .232], [.214, 1.03, .13], [.224, 1.0, .02], [sp[0] + .006, 1.0, sp[2] + .03]], (x, y) => torsoSkin(x, y));
    const M = T(sp[0], 1.0, sp[2], 0, Math.PI - 1.0, 0); m.box([0, 0, 0], [.05, .07, .028], .006, { slot: S.PLATE2, skin: B.PEL, m: M }); if (m.keep(1)) m.box([0, .02, .015], [.016, .008, .004], .001, { slot: S.GLOW, skin: B.PEL, m: M }); }
  // pocket on the left of the belly
  { const p = jkP(-.95, 1.06, .016); buildPouch(m, .06, .075, .03, T(p[0], p[1], p[2], 0, Math.PI + .95, 0), { slot: S.CLOTH2, slotFlap: S.CLOTH, skin: torsoSkin, slotTab: S.ACCENT }); }
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  const H = B.HEA;
  for (const s of [-1, 1]) for (const la of [-.55, -.1, .35]) { const [q, d] = mapAt(hp, s * 1.11, la, .016); screw(m, q, d, { r: .003, skin: H }); }
  // bolts at the plate corners
  for (const [u, v] of [[-.7, 1.395], [.7, 1.395], [-.74, 1.285], [.74, 1.285], [-.66, 1.183], [.66, 1.183], [-.6, 1.075], [.6, 1.075], [-.3, .95], [.3, .95]]) { const [q, d] = mapAt(plMap, u, v, .021); screw(m, q, d, { r: .0034, skin: plSk(0, v) }); }
  // stitched quilting seams on the jacket sides, beside the plates
  for (const a of [-1.28, 1.28]) stitchLine(m, Array.from({ length: 8 }, (_, i) => jkP(a, lerp(.97, 1.38, i / 7), .014)), { skin: torsoSkin, n: 20, slot: S.CLOTH2 });
  for (const s of [-1, 1]) { const e = plMap(s * .58, 1.405, .03); buckleAt(m, [e[0], e[1] + .006, e[2] - .002], [0, .3, -1], { skin: torsoSkin, w: .024, d: .014 }); buckleAt(m, [s * .2, .94, -.07], [0, 0, -1], { skin: s < 0 ? B.FAL : B.FAR, w: .016, d: .012, t: .0025 }); }
  // collar shell rivets
  for (const a of [-1.7, 1.7, 3.14]) for (const y of [1.5, 1.6]) { const p = colMap(a, y, .02), q = colMap(a, y, .03); screw(m, p, [q[0] - p[0], q[1] - p[1], q[2] - p[2]], { r: .003, skin: colSk(0, y) }); }
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.RUBBER }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  m => buildSuit(m, { slot: S.CLOTH2, slotLegs: S.CLOTH2, folds: .4 }),
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.PLATE2, slotRand: S.RUBBER, slotSole: S.PLATE2, slotMid: S.RUBBER, slotTongue: S.RUBBER, slotPanel: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.RUBBER, slotCuff: S.CLOTH2, guard: false, cuff: false }); },
  jacket, sleeves, trousers, blastPlate, collar, helmet, backUnit, chestKit,
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['suit', 'boots', 'gloves', 'jacket', 'sleeves', 'trousers', 'plate', 'collar', 'helmet', 'back', 'chest']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
void clamp;
