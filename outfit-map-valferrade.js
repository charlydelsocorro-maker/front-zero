// outfit-map-valferrade.js — FRONT ZÉRO: SERRE-FREIN, the outfit of the Valferrade map. Original design: the brakeman who rides the ore trains down
// from the mine to the valley, in the cold. A quilted railway cap with a short stiff peak and ear flaps edged in sheepskin, round goggles in leather
// cups, a ribbed wool snood pulled up to the nose; a hip-length waxed canvas jacket with a deep sheepskin collar and sheepskin cuffs, wooden toggles on
// cord loops, leather elbow patches, two flapped patch pockets, a leather belt with a frame buckle; a brakeman's hand lantern on the belt (a lit lens only:
// it casts no light), a wooden brake club in a belt loop, a waybill pouch; heavy wool trousers, wool puttees wound from the boot to the knee, leather
// work gloves, hobnailed boots. Not a caver, not a bomb-disposal suit. No insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import * as THREE from 'three';
import { BONE as B, SLOT as S, T, torsoSkin, legSkin, blend2, buildGlove, buildBoot, buildGloveDetail, buildBootDetail, stitchLine, panel, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, rowAt, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, jacketSkirt, skirtMap, beltRing, beltMap, blouseRows, blouseDisp, softPouch, beltPin, legsFromHips, lensFrame } from './outfit-maps-lib.js';

export const MAP_ID = 'valferrade', MAP_NAME = 'Valferrade';
// ---------------------------------------------------------------- colourways (the map's own palette first: weathered timber, slate, rust, snow; dark rims
// and a low lift so the jacket stays darker than the stone and the snow, the cream sheepskin collar reads at range)
const pbr = { cloth: [.8, 0, 0, .65], cloth2: [.98, 0, 0, 1], plate: [.93, 0, 0, .95], plate2: [.58, 0, 0, .22], rubber: [.62, 0, 0, .1], accent: [.95, 0, 0, 1], visor: [.08, .5, .02, 0] };
const P = o => ({ pbr, fpKit: 'plain', fpGlove: o.plate2, ...o });       // first-person gloves in the colour of the third-person gloves
const OUT = [
  ['valferrade', 'Valferrade', 'Légende', 15000, { cloth: 0x4a3a2c, cloth2: 0xc9b896, plate: 0x3a3f46, plate2: 0x5a3a24, rubber: 0x1b1a19, metal: 0x8a8478, accent: 0x4e4a40, glow: 0xffc870, visor: 0x2a2a20, rim: 0x3a3430, lift: .012, floor: .01 }],
  ['wagonnet', 'Wagonnet', 'Épique', 9000, { cloth: 0x2f3d2e, cloth2: 0xb8a988, plate: 0x2c2e30, plate2: 0x4a3020, rubber: 0x181918, metal: 0x86887e, accent: 0x4a4a3e, glow: 0xffd890, visor: 0x22261e, rim: 0x2e362c, lift: .012, floor: .01 }],
  ['minerai', 'Minerai', 'Épique', 9000, { cloth: 0x3e4248, cloth2: 0xa89a80, plate: 0x262626, plate2: 0x3a2a20, rubber: 0x161616, metal: 0x8a8a86, accent: 0x5e3a28, glow: 0xffb060, visor: 0x2a2420, rim: 0x383c40, lift: .012, floor: .01 }],
  ['houille', 'Houille', 'Épique', 9000, { cloth: 0x242322, cloth2: 0xd6ccb6, plate: 0x33302c, plate2: 0x5a3a24, rubber: 0x141414, metal: 0x8e8a80, accent: 0x5a5246, glow: 0xffc070, visor: 0x201e1c, rim: 0x34322f, lift: .014, floor: .01 }],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal]) => ({ id: 'serre-frein-' + k, setId: 'serre-frein', name: 'SERRE-FREIN', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal) }));

// ---------------------------------------------------------------- head: snood, quilted cap with peak and ear flaps, round goggles
const H = B.HEA;
const browLat = lon => lerp(.24, -.42, ((1 - Math.cos(lon)) / 2) ** 1.25);
function head(m) {
  const nu = m.seg(40, 14);
  headBase(m, S.RUBBER);
  // ribbed wool snood: a tube round the neck, then laid over the face up to the bridge of the nose
  const topLat = a => lerp(-.1, -.6, ((1 - Math.cos(a)) / 2) ** .9), nG = m.seg(30, 10), rib = m.lod === 0 ? 1 : 0;
  const neckAt = (a, y) => { const r = 1 + .05 * Math.sin(y * 150 + Math.sin(a * 3) * 1.4) * sstep(1.58, 1.52, y) + rib * .012 * Math.cos(a * 34); return [.071 * r * Math.sin(a), y, .002 - .069 * r * Math.cos(a)]; };
  const gp = (a, v) => {
    if (v <= .45) return neckAt(a, lerp(1.46, 1.57, v / .45));
    const lat = lerp(-1.02, topLat(a), (v - .45) / .55), h = headP(a, lat, .0082 + rib * .0009 * Math.cos(a * 34)), n = neckAt(a, h[1]);
    const dh = Math.hypot(h[0], h[2] + .004), dn = Math.hypot(n[0], n[2] + .004), k = sstep(-.006, .006, dh - dn);
    return [lerp(n[0], h[0], k), h[1], lerp(n[2], h[2], k)];
  };
  m.grid(nG, m.seg(13, 6), (u, v) => gp(u * TAU, v), { wrapU: true, slot: S.ACCENT, skin: (x, y) => y > 1.585 ? [H, 1] : blend2(B.NEC, H, y, 1.57, .02), crease: 180, out: (x, y, z) => [x, 0, z - .004], ao: (x, y) => .62 + .38 * sstep(1.47, 1.56, y) });
  if (m.keep(1)) m.tube(Array.from({ length: 33 }, (_, i) => headP(i / 32 * TAU, topLat(i / 32 * TAU), .0095)), .003, { slot: S.ACCENT, skin: H, sides: 5, n: m.seg(40, 16), cap: false, up: [0, 1, 0] });
  // quilted cap: crown in quilted rows, a padded band, a short stiff peak
  const capLat = lon => browLat(lon) + .2;
  m.grid(nu, m.seg(10, 4), (u, v) => { const lon = u * TAU - Math.PI, lat = lerp(capLat(lon), Math.PI / 2, v ** .9), q = m.lod === 0 ? .0016 * Math.abs(Math.sin(lat * 9)) : 0; return headP(lon, lat, .009 + .005 * Math.sin(lat) ** 6 + q); },
    { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 180, out: outH, ao: (x, y) => .8 + .2 * sstep(1.68, 1.76, y) });
  m.grid(nu, m.seg(4, 2), (u, v) => { const lon = u * TAU - Math.PI, lat = capLat(lon) - .03 + .09 * v; return headP(lon, lat, .0105 + .0042 * Math.sin(v * Math.PI)); }, { wrapU: true, slot: S.PLATE, skin: H, crease: 180, out: outH, ao: .75 });
  m.grid(m.seg(14, 6), m.seg(3, 2), (u, v) => { const lon = lerp(-.85, .85, u), b = headP(lon, capLat(lon) + .005, .014), f = headP(lon, capLat(lon) - .02, .014), len = .052 * Math.cos(lon * .9) ** .6, dx = b[0] - f[0], dz = b[2] - f[2], dy = b[1] - f[1], l = Math.hypot(dx, dy, dz);
    return [b[0] + (dx / l) * len * v, b[1] + (dy / l) * len * v - .008 * v * v, b[2] + (dz / l) * len * v - .006 * v]; }, { slot: S.RUBBER, skin: H, crease: 70, out: (x, y, z) => [0, 1, -.2], ao: .7 });
  // ear flaps down over the ears, edged with sheepskin, a strap under the chin
  for (const s of [-1, 1]) {
    const fl = (u, v, hh) => { const lon = s * lerp(1.05, 2.25, u), lat = lerp(capLat(lon) + .02, -.62 + .12 * Math.sin(u * Math.PI), v); return headP(lon, lat, .016 + hh + .006 * Math.sin(u * Math.PI)); };
    panel(m, fl, 0, 1, 0, 1, { t: .009, nu: m.seg(7, 3), nv: m.seg(6, 3), slot: S.PLATE, skin: H, edge: .25, round: .7, dome: .002, out: (x, y, z) => [x - HC0[0], 0, z - HC0[2]] });
    padSweep(m, [[0, .15], [0, .55], [.02, .92], [.25, 1], [.5, 1], [.75, 1], [.98, .92], [1, .55], [1, .15]].map(([u, v]) => fl(u, v, .002)), .016, .009, (x, y, z) => [x - HC0[0], -.2, z - HC0[2]], { slot: S.CLOTH2, skin: H, k: 8, e: 2.2, puff: .5, step: .012 });
  }
  if (m.keep(1)) m.tube([headP(-1.7, -.62, .03), [-.05, 1.575, -.07], [0, 1.568, -.082], [.05, 1.575, -.07], headP(1.7, -.62, .03)], .0035, { slot: S.PLATE2, skin: (x, y) => y > 1.6 ? [H, 1] : blend2(B.NEC, H, y, 1.59, .02), sides: 5, flat: .5, n: 10, up: [0, 1, 0] });
  // round goggles in leather cups, a bridge, the strap round the cap
  for (const s of [-1, 1]) {
    const c = headP(s * .36, .03, .02), F = bodyFrame(c, s * .36, .05);
    m.revolve([[.0215, -.004], [.0245, .002], [.0235, .01], [.0205, .013]], { sides: m.keep(1) ? 18 : 8, slot: S.PLATE2, skin: H, m: F.clone().multiply(T(0, 0, 0, Math.PI / 2, 0, 0)), crease: 60 });
    lensFrame(m, F.clone().multiply(T(0, 0, .011)), .0185, .0185, .0042, .004, { slot: S.METAL, skin: H, e: 2, n: m.seg(20, 10), lensSlot: S.VISOR, bulge: .002 });
  }
  m.tube([headP(-.2, .06, .03), headP(0, .02, .03), headP(.2, .06, .03)], .0028, { slot: S.METAL, skin: H, sides: 5, n: 6 });
  m.tube(Array.from({ length: 25 }, (_, i) => { const lon = lerp(.5, TAU - .5, i / 24); return headP(lon, lerp(.07, .26, Math.sin((i / 24) * Math.PI)), .021); }), .0055, { slot: S.RUBBER, skin: H, sides: m.keep(1) ? 6 : 3, flat: .4, n: m.seg(30, 10), cap: false, up: [0, 1, 0] });
}
const HC0 = [0, 1.664, -.006];

// ---------------------------------------------------------------- waxed canvas jacket (sheepskin collar and cuffs), belted, its skirt over the hips
const BELT = [.976, .168, .128, { w: .042, t: .0065, sag: .009, cz: .002 }], belt = beltMap(...BELT);
const JK0 = [[.955, .168, .128, .002], [.975, .167, .127, .002], [.995, .168, .128, .001], [1.05, .176, .133, 0], [1.09, .172, .129, 0], [1.16, .177, .13, 0], [1.24, .188, .135, 0], [1.32, .196, .139, 0], [1.39, .196, .138, .002], [1.435, .189, .13, .005], [1.465, .162, .115, .006], [1.49, .122, .098, .005], [1.512, .094, .086, .004]];
const JK = blouseRows(JK0, BELT[0], BELT[1], BELT[2], BELT[3].w, .009, BELT[3]), blouse = blouseDisp(BELT[0], BELT[3].w, .06);
const PIN_JK = beltPin(BELT, .0035, { above: .0015, below: .04 }), PIN_SK = beltPin(BELT, .0015, { below: .04 }), PIN_TR = beltPin(BELT, .012, { below: .06 });
const jkDisp = (a, y) => blouse(a, y) + .024 * Math.sin(a * 4 + y * 10) * bump(y, 1.25, .16) * Math.max(0, -Math.cos(a)) + .01 * Math.sin(a * 5 + y * 18) + .012 * Math.sin(a * 7 + 1) * bump(y, 1.14, .05);
const jacket = garmentMap(JK, { e: 2.5, disp: jkDisp, pin: PIN_JK });
const SKIRT = { y0: .985, y1: .84, r0: [.174, .134], r1: [.228, .17], cz: .004, fold: .036, sag: .006, backDrop: .016, sideRise: .006, vent: .05, kMax: .3, flare: .45, pin: PIN_SK };
const skirt = skirtMap(SKIRT);
const SL = [[.9, .06], [.93, .062], [.98, .063], [1.05, .065], [1.12, .067], [1.16, .068], [1.2, .069], [1.26, .072], [1.34, .077], [1.4, .08], [1.43, .078], [1.455, .069], [1.474, .05], [1.486, .023]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .026 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12) + .045 * Math.sin(y * 120) * bump(y, .99, .04);
const sleeve = s => garmentMap(SL, { e: 2.05, cx: s * .2, disp: slDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
function jacketBody(m) {
  garment(m, JK, { n: 30, e: 2.5, disp: jkDisp, pin: PIN_JK, slot: S.CLOTH, skin: torsoSkin, sub: 2, capA: true, out: (x, y, z) => [x, y > 1.46 ? .6 : y < .96 ? -.5 : 0, z], ao: foldAo(jkDisp) });
  jacketSkirt(m, { ...SKIRT, slot: S.CLOTH, lining: S.CLOTH2 });
  for (const s of [-1, 1]) {
    elbowLiner(m, s, SL, S.CLOTH);
    garment(m, SL, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .9 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    // deep sheepskin cuff turned back over the sleeve end
    padSweep(m, Array.from({ length: 25 }, (_, i) => sleeve(s)(i / 24 * TAU, .925, .0012)), .036, .0075, (x, y, z) => [x - s * .2, 0, z], { slot: S.CLOTH2, skin: s < 0 ? B.FAL : B.FAR, e: 2.6, puff: .3, ends: false, k: 12, step: .014 });
    // leather elbow patch, team band on the upper arm
    panel(m, (u, v, h) => sleeve(s)(u, v, h + .002), Math.PI - .9, Math.PI + .9, 1.1, 1.23, { t: .0035, nu: 7, nv: 5, slot: S.PLATE2, skin: sleeveSkin(s), edge: .15, round: .6, out: (x, y, z) => [x - s * .2, 0, z] });
    bandOn(m, (a, yy, h) => sleeve(s)(a, yy, h), 1.27, .032, { n: 18, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: (x, y, z) => [x - s * .2, 0, z] });
  }
  // the deep sheepskin collar: round the back of the neck and down into two broad lapels on the chest
  // stand-up sheepskin collar round the back of the neck, and two broad flat lapels laid on the chest (fleece, rounded edges)
  const cp = [jacket(-.55, 1.47, .006), jacket(-1.1, 1.495, .006), jacket(-1.8, 1.505, .005), jacket(-2.5, 1.5, .005), jacket(Math.PI, 1.5, .005), jacket(2.5, 1.5, .005), jacket(1.8, 1.505, .005), jacket(1.1, 1.495, .006), jacket(.55, 1.47, .006)];
  padSweep(m, cp, .075, .02, (x, y, z) => [x * .7, (y - 1.38) * 6, z * 1.4], { slot: S.CLOTH2, skin: (x, y) => y > 1.5 ? blend2(B.CHE, B.NEC, y, 1.53, .02) : torsoSkin(x, y), k: 12, e: 3, puff: .25, step: .02, ao: .9 });
  for (const s of [-1, 1]) panel(m, (u, v, h) => jacket(s * u, v, h + .006), .085, .42, u => lerp(1.27, 1.36, sstep(.085, .42, u)), u => lerp(1.47, 1.43, sstep(.2, .42, u)), { t: .014, nu: m.seg(7, 3), nv: m.seg(7, 3), slot: S.CLOTH2, skin: torsoSkin, edge: .3, round: .65, dome: .004, out: (x, y, z) => [x, .2, z] });
  // front closure: a placket down the chest and the skirt, wooden toggles on cord loops
  panel(m, (u, v, h) => jacket(u, v, h + .002), -.08, .08, .99, 1.3, { t: .0045, nu: 3, nv: 8, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: .15, out: (x, y, z) => [x, 0, z] });
  if (m.keep(1)) panel(m, (u, v, h) => skirt(u, v, h + .002), -.08, .08, .852, .985, { t: .0045, nu: 3, nv: 12, slot: S.CLOTH, skin: B.PEL, edge: .2, round: .15, out: (x, y, z) => [x, 0, z] });
  for (const y of [1.06, 1.15, 1.24]) {
    const c = jacket(0, y, .0075), F = bodyFrame(c, 0);
    m.tube([xf(F, [-.016, 0, .002]), xf(F, [0, .0006, .004]), xf(F, [.016, 0, .002])], .0052, { slot: S.PLATE2, skin: torsoSkin, sides: m.keep(1) ? 8 : 4, n: 4, cap: true });
    if (m.keep(1)) for (const s of [-1, 1]) m.tube([jacket(s * .17, y + .006, .004), xf(F, [s * .03, .004, .006]), xf(F, [s * .01, .0, .0075]), xf(F, [s * .03, -.004, .006]), jacket(s * .17, y - .006, .004)], .0018, { slot: S.RUBBER, skin: torsoSkin, sides: 4, n: 10, cap: false });
  }
  // two big patch pockets with flaps on the skirt, a chest pocket on the left
  if (m.keep(1)) for (const s of [-1, 1]) {       // (not at LOD2: its few rows would stand out of the flare and cast blotches)
    const pm = (u, v, h) => skirt(s * u, v, h + .003);
    panel(m, pm, .32, .86, .862, .955, { t: .005, nu: 6, nv: 8, slot: S.CLOTH, skin: B.PEL, edge: .15, round: .45, out: (x, y, z) => [x, 0, z] });
    panel(m, (u, v, h) => skirt(s * u, v, h + .0095), .3, .88, .935, .968, { t: .0055, nu: 6, nv: 2, slot: S.CLOTH, skin: B.PEL, edge: .2, round: .55, out: (x, y, z) => [x, .3, z] });
  }
  panel(m, (u, v, h) => jacket(-u, v, h + .004), .22, .52, 1.2, 1.29, { t: .004, nu: 4, nv: 3, slot: S.CLOTH, skin: torsoSkin, edge: .15, round: .45, out: (x, y, z) => [x, 0, z] });
  // a leather yoke across the shoulders
  panel(m, (u, v, h) => jacket(Math.PI + u, v, h + .0035), -1.35, 1.35, u => 1.34 + .05 * (u / 1.35) ** 2, 1.48, { t: .0045, nu: 14, nv: 4, slot: S.PLATE2, skin: torsoSkin, edge: .08, round: .25, out: (x, y, z) => [x, .3, z] });
}

// ---------------------------------------------------------------- heavy wool trousers (one surface from the hips), wool puttees to the knee
const SEAT = [[.83, .152, .12, .004], [.87, .162, .126, .004], [.92, .164, .127, .003], [.965, .16, .122, .002]];
const seat = garmentMap(SEAT, { e: 2.15, pin: PIN_TR });
const LG = [[.17, .072], [.2, .075], [.26, .077], [.33, .078], [.4, .08], [.44, .083], [.5, .086], [.57, .088], [.65, .094], [.75, .102], [.85, .104], [.89, .098], [.92, .086], [.945, .07], [.965, .058]].map(r => [r[0], r[1], r[1] * 1.05, r[0] > .6 ? .004 : .006]);
const lgDisp = (a, y) => .012 * Math.sin(a * 3 + y * 9) + sstep(.43, .5, y) * (.05 * Math.sin(y * 120) * bump(y, .52, .06) * Math.max(0, -Math.cos(a)) ** 1.5 + .03 * Math.sin(a * 2 + y * 14) * bump(y, .78, .15));
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp });
function trousers(m) {
  legsFromHips(m, { hip: (a, y) => seat(a, y), yTop: .965, yCrotch: .86, yThigh: .74, LG, e: 2.1, lgDisp, n: 26, folds: .025, slot: S.PLATE, ao: (x, y, z) => .74 + .26 * sstep(.45, .6, y) });
  // wool puttees: a long band wound in overlapping turns from the boot to under the knee, its tape tied off at the top
  for (const s of [-1, 1]) {
    const SH = s < 0 ? B.SHL : B.SHR, o = (x, y, z) => [x - s * .1, 0, z - .006], at = (a, y, h) => { const r = rowAt(LG, y); return [s * .1 + (r[1] * 1.016 + h) * Math.sin(a), y, (r[3] ?? 0) - (r[2] * 1.016 + h) * Math.cos(a)]; };
    if (m.lod === 0) { const turns = 6, N = turns * 14, pts = []; for (let i = 0; i <= N; i++) { const t = i / N; pts.push(at(s * t * turns * TAU, lerp(.178, .425, t), .0034 + .0022 * t)); }
      padSweep(m, pts, .046, .0038, o, { slot: S.ACCENT, skin: SH, k: 6, e: 4.5, puff: .02, step: .042, ends: true }); }
    else bandOn(m, at, .3, .25, { n: 14, h0: .003, t: .004, slot: S.ACCENT, skin: SH, out: o });
    if (m.keep(1)) m.tube(Array.from({ length: 13 }, (_, i) => at(s * i / 12 * TAU, .432 + .004 * Math.sin(i), .0075)), .0022, { slot: S.PLATE2, skin: SH, sides: 4, n: 16, cap: false });
  }
}

// ---------------------------------------------------------------- belt, brakeman's lantern, brake club, waybill pouch
function kit(m) {
  const P2 = B.PEL;
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.PLATE2, skin: P2, buckle: 'frame', keepers: [-.5, .5, 1.4, -1.4] });
  // hand lantern hung by its bail from the belt on the right hip: drum, chimney cap, a lit front lens behind a wire cage
  const LA = 1.62, LF = bodyFrame(skirt(LA, .87, .046), LA), dr = .032;
  m.revolve([[0, .05], [dr * .55, .05], [dr * .7, .043], [dr, .03], [dr * 1.04, -.03], [dr, -.042], [dr * .8, -.046], [0, -.046]], { sides: m.keep(1) ? 16 : 8, slot: S.RUBBER, skin: P2, m: LF, crease: 55 });
  m.revolve([[0, .072], [.008, .072], [.011, .062], [.02, .056], [.022, .05]], { sides: m.keep(1) ? 12 : 6, slot: S.RUBBER, skin: P2, m: LF, crease: 55 });
  const LL = LF.clone().multiply(T(0, 0, 0, 0, .75, 0));       // the lens looks forward-out
  lensFrame(m, LL.clone().multiply(T(0, 0, dr + .002)), .023, .023, .0045, .006, { slot: S.METAL, skin: P2, e: 2, n: m.seg(20, 8), lensSlot: S.GLOW, bulge: .004, back: .004 });
  if (m.keep(1)) for (const k of [-1, 0, 1]) m.tube([xf(LL, [k * .019, -.03, dr + .01]), xf(LL, [k * .023, 0, dr + .015]), xf(LL, [k * .019, .03, dr + .01])], .0014, { slot: S.METAL, skin: P2, sides: 3, n: 5, cap: false });
  const bt = belt(LA, .004, .004);
  m.tube([xf(LF, [-.022, .05, 0]), xf(LF, [-.02, .085, .004]), [bt[0], bt[1] - .006, bt[2]], bt, xf(LF, [.02, .085, .004]), xf(LF, [.022, .05, 0])], .0022, { slot: S.METAL, skin: P2, sides: m.keep(1) ? 5 : 3, n: 12, cap: false });
  // brake club: a turned wooden club through a leather loop at the left hip
  const CA = -1.72, top = belt(CA, .016, .03), low = skirt(CA, .69, .06);
  m.tube([top, [lerp(top[0], low[0], .5), lerp(top[1], low[1], .5), lerp(top[2], low[2], .5) + .004], low], t => lerp(.011, .015, sstep(.4, 1, t)), { slot: S.PLATE2, skin: (x, y) => blend2(B.THL, P2, y, .86, .05), sides: m.keep(1) ? 9 : 5, n: m.seg(8, 3), cap: true });
  if (m.keep(1)) m.revolve([[.0, .012], [.012, .01], [.017, 0], [.012, -.01], [0, -.012]], { sides: 9, slot: S.PLATE2, skin: P2, m: T(top[0], top[1] + .012, top[2]) });
  padSweep(m, Array.from({ length: 13 }, (_, i) => { const t = i / 12 * TAU; return [top[0] + .019 * Math.cos(t), top[1] - .03 + .004 * Math.sin(t * 2), top[2] + .019 * Math.sin(t)]; }), .018, .003, (x, y, z) => [x - top[0], 0, z - top[2]], { slot: S.RUBBER, skin: P2, e: 3, k: 6, ends: false, step: .01 });
  // waybill pouch on the left front of the belt
  softPouch(m, .085, .07, .03, bodyFrame(skirt(-.75, .942, .004), -.75, .1), { slot: S.PLATE2, flapSlot: S.PLATE2, skin: P2, flap: .45, tabSlot: S.METAL });
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  // cap: quilting stitches over the crown; snood rib; goggle strap buckles
  for (let k = 0; k < 6; k++) stitchLine(m, Array.from({ length: 7 }, (_, i) => headP(k * Math.PI / 3 + .3, lerp(.95, 1.5, i / 6), .0158 - .0012 * (i / 6))), { skin: H, n: 12, slot: S.PLATE });
  // jacket: stitching down the placket, round the patch pockets, on the elbow patches
  for (const s of [-1, 1]) {
    stitchLine(m, Array.from({ length: 10 }, (_, i) => jacket(s * .07, lerp(1.0, 1.29, i / 9), .0072)), { skin: torsoSkin, n: 28, slot: S.PLATE2 });
    stitchLine(m, [[.34, .955], [.33, .9], [.36, .866], [.6, .862], [.84, .866], [.86, .9], [.85, .955]].map(([u, v]) => skirt(s * u, v, .0084)), { skin: B.PEL, n: 40, slot: S.PLATE2 });
    const sl = sleeve(s); stitchLine(m, Array.from({ length: 21 }, (_, i) => { const t = i / 20 * TAU; return sl(Math.PI + Math.sin(t) * .84, 1.165 + Math.cos(t) * .06, .0062); }), { skin: sleeveSkin(s), n: 44, slot: S.PLATE2 });
    stud(m, skirt(s * .59, .945, .015), [Math.sin(s * .59), 0, -Math.cos(s * .59)], { skin: B.PEL, r: .0045, slot: S.PLATE2 });
  }
  // trousers: a side seam to the puttee
  for (const s of [-1, 1]) stitchLine(m, Array.from({ length: 9 }, (_, i) => leg(s)(s * Math.PI / 2, lerp(.74, .44, i / 8), .0012)), { skin: (x, y) => legSkin(s)(x, y), n: 24, slot: S.PLATE });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.RUBBER }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  head, jacketBody, trousers,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.PLATE2, slotToe: S.PLATE2, slotRand: S.PLATE2, slotSole: S.RUBBER, slotMid: S.RUBBER, slotWelt: S.RUBBER, slotTongue: S.PLATE2, slotPanel: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.PLATE2, slotCuff: S.PLATE2, slotKnuckle: S.PLATE2, guard: false, cuff: false }); },
  kit,
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['head', 'jacket', 'trousers', 'boots', 'gloves', 'kit']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
void THREE; void lerp;
