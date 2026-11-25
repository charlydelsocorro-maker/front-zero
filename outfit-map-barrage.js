// outfit-map-barrage.js — FRONT ZÉRO: DESCENDEUR, the outfit of the Barrage d'Aiguenoire map. Original design: the rope-access technician who
// inspects the dam's downstream face and the gorge walls on a rope. A compact rope-access helmet with two raised ridges, its four-point chin strap and
// a torch clipped on its left side (a lit lens only: it casts no light), wraparound safety glasses; a two-tone waterproof work jacket (dark oilskin
// below, high-visibility above, retro-reflective tape over the colour joins) with a storm collar zipped up to the nose and its hood rolled behind the
// neck; a sit-and-chest harness (padded waist belt, leg loops, a semicircular steel quick link at the front, a chest ascender on the sternum, a
// dorsal ring), a descender on a carabiner, two rope lanyards with big steel carabiners, a rope bag on the right hip, a tool roll at the back, a
// radio on the chest strap; work trousers with tape and knee darts, rubber-soled boots. Not a climber of the high mountains, not a caver. No insignia,
// name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, torsoSkin, legSkin, blend2, buildGlove, buildBoot, buildGloveDetail, buildBootDetail, stitchLine, buckleAt, carabiner, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, rowAt, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, beltRing, beltMap, blouseRows, blouseDisp, beltPin, legsFromHips, radio, lensFrame } from './outfit-maps-lib.js';

export const MAP_ID = 'barrage', MAP_NAME = 'Barrage d’Aiguenoire';
// ---------------------------------------------------------------- colourways (the map's own palette first: dark wet rock and black water, weathered
// concrete, rust of the penstocks; the high-visibility top keeps the figure readable against the grey dam, dark rims and a low lift elsewhere)
const pbr = { cloth: [.5, 0, 0, .3], cloth2: [.9, 0, 0, .9], plate: [.48, .02, 0, .25], plate2: [.8, 0, 0, .55], rubber: [.64, 0, 0, .12], metal: [.4, .52, 0, 0], accent: [.74, 0, .06, .5], visor: [.06, .55, .02, 0] };
const P = o => ({ pbr, fpKit: 'plain', fpGlove: o.rubber, ...o });       // first-person gloves in the colour of the third-person gloves
const OUT = [
  ['aiguenoire', 'Aiguenoire', 'Légende', 15000, { cloth: 0x1f2d35, cloth2: 0x2a2e31, plate: 0xd2cec4, plate2: 0xb03e2a, rubber: 0x18191a, metal: 0xa9adb0, accent: 0xc6c92e, glow: 0xfff2c8, visor: 0x3a4a52, rim: 0x2a343a, lift: .012, floor: .01 }],
  ['conduite', 'Conduite', 'Épique', 9000, { cloth: 0x4a2e24, cloth2: 0x2c2a28, plate: 0xcac5b8, plate2: 0x26282b, rubber: 0x171717, metal: 0xa4a6a8, accent: 0xd07a2a, glow: 0xffe6b8, visor: 0x3a3a34, rim: 0x3a2e2a, lift: .012, floor: .01 }],
  ['turbine', 'Turbine', 'Épique', 9000, { cloth: 0x2a2c2f, cloth2: 0x202224, plate: 0x36393d, plate2: 0xc89a22, rubber: 0x141414, metal: 0xa0a4a8, accent: 0x8db23a, glow: 0xe8ffd8, visor: 0x2c3a3a, rim: 0x34373a, lift: .014, floor: .01 }],
  ['embrun', 'Embrun', 'Épique', 9000, { cloth: 0x2e4254, cloth2: 0x2a3036, plate: 0xd6a62e, plate2: 0x2a2c30, rubber: 0x16181a, metal: 0xa8b0b6, accent: 0x5e92a4, glow: 0xe8f4ff, visor: 0x30404a, rim: 0x2e3a46, lift: .012, floor: .01 }],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal]) => ({ id: 'descendeur-' + k, setId: 'descendeur', name: 'DESCENDEUR', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal) }));

const H = B.HEA, C = B.CHE, P2 = B.PEL;
// ---------------------------------------------------------------- head: storm collar to the nose, safety glasses, rope-access helmet, side torch
const rimLat = lon => lerp(.3, -.27, ((1 - Math.cos(lon)) / 2) ** 1.15);
const ridge = (lon, lat) => Math.exp(-(((Math.abs(Math.sin(lon)) - .36) / .075) ** 2)) * sstep(.22, .9, lat) * (1 - sstep(1.25, 1.5, lat));
const shell = (lon, lat, off = 0) => headP(lon, lat, .021 + .006 * Math.sin(Math.max(0, lat)) ** 2 + .0045 * ridge(lon, lat) + off);
// the storm collar: a stiff tube round the neck that then follows the face up to the bridge of the nose (lower at the back)
const CL_TOP = a => lerp(-.3, -.52, ((1 - Math.cos(a)) / 2) ** .8);
const neckAt = (a, y, off = 0) => { const r = lerp(.104, .088, sstep(1.47, 1.565, y)) + off; return [r * Math.sin(a), y, .004 - r * .94 * Math.cos(a)]; };
const collarAt = (a, lat, off = 0) => { const h = headP(a, lat, .015 + off + .008 * sstep(-.5, -.3, lat) * Math.max(0, Math.cos(a))), n = neckAt(a, h[1], off), dh = Math.hypot(h[0], h[2] + .004), dn = Math.hypot(n[0], n[2] + .004), k = sstep(-.006, .006, dh - dn); return [lerp(n[0], h[0], k), h[1], lerp(n[2], h[2], k)]; };
const collar = (a, v, off = 0) => (v <= .42 ? neckAt(a, lerp(1.462, 1.578, v / .42), off) : collarAt(a, lerp(-1.0, CL_TOP(a), (v - .42) / .58), off));
const collarSkin = (x, y) => (y > 1.6 ? [H, 1] : torsoSkin(x, y));
function head(m) {
  m.grid(m.seg(20, 8), m.seg(5, 3), (u, v) => headP(u * TAU - Math.PI, lerp(-.55, .5, v)), { wrapU: true, slot: S.RUBBER, skin: H, crease: 180, out: outH, ao: .55 });
  m.grid(m.seg(30, 10), m.seg(14, 6), (u, v) => collar(u * TAU, v), { wrapU: true, slot: S.CLOTH, skin: collarSkin, crease: 180, out: (x, y, z) => [x, 0, z - .004], ao: (x, y) => .66 + .34 * sstep(1.48, 1.56, y) });
  // fleece-lined top edge, the zip up the front
  m.tube(Array.from({ length: 33 }, (_, i) => collar(i / 32 * TAU, 1, .001)), .0062, { slot: S.ACCENT, skin: collarSkin, sides: m.keep(1) ? 7 : 4, n: m.seg(40, 14), cap: false, up: [0, 1, 0] });
  if (m.keep(1)) m.tube(Array.from({ length: 12 }, (_, i) => collar(0, lerp(.03, .96, i / 11), .003)), .0021, { slot: S.METAL, skin: collarSkin, sides: 4, n: m.seg(16, 6), cap: false });
  // wraparound safety glasses: one curved lens, a thin top bar, arms back under the helmet rim
  const gl = (lon, lat, off) => headP(lon, lat, off + .011 * Math.cos(lon) ** 2);
  m.grid(m.seg(18, 7), m.seg(3, 1), (u, v) => gl(lerp(-1.05, 1.05, u), lerp(-.07, .17, v) - .05 * (lerp(-1.05, 1.05, u) / 1.05) ** 2, .021), { slot: S.VISOR, skin: H, crease: 180, out: outH });
  m.tube(Array.from({ length: 13 }, (_, i) => { const lon = lerp(-1.08, 1.08, i / 12); return gl(lon, .175 - .05 * (lon / 1.05) ** 2, .023); }), .0034, { slot: S.RUBBER, skin: H, sides: 5, flat: .6, n: m.seg(16, 6), up: [0, 1, 0] });
  for (const s of [-1, 1]) m.tube([gl(s * 1.06, .1, .023), headP(s * 1.35, .07, .02), headP(s * 1.75, .03, .016)], .0025, { slot: S.RUBBER, skin: H, sides: 4, flat: .5, n: 6 });
  // helmet shell, its rubber rim, vents between the ridges
  const nu = m.seg(36, 14);
  m.grid(nu, m.seg(10, 4), (u, v) => { const lon = u * TAU - Math.PI; return shell(lon, lerp(rimLat(lon), Math.PI / 2, v ** .85)); }, { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 180, out: outH, ao: (x, y) => .8 + .2 * sstep(1.7, 1.79, y) });
  m.grid(nu, 1, (u, v) => { const lon = u * TAU - Math.PI, l = rimLat(lon); return headP(lon, l + .002 - .006 * v, lerp(.021, .004, v)); }, { wrapU: true, slot: S.RUBBER, skin: H, crease: 180, out: () => [0, -1, 0], ao: .4 });
  if (m.keep(1)) m.tube(Array.from({ length: 33 }, (_, i) => { const lon = i / 32 * TAU - Math.PI; return shell(lon, rimLat(lon) + .006, .0014); }), .0034, { slot: S.RUBBER, skin: H, sides: 5, n: m.seg(40, 14), cap: false });
  if (m.keep(0)) for (const s of [-1, 1]) for (const lon of [.05, Math.PI - .05]) panel(m, (u, v, h) => shell(s * u, v, h + .0004), lon - .1, lon + .1, .85, 1.05, { t: .0018, nu: 2, nv: 2, slot: S.RUBBER, skin: H, edge: .2, round: .9, out: outH });
  if (m.keep(0)) for (const s of [-1, 1]) panel(m, (u, v, h) => shell(s * u, v, h + .0004), 1.2, 1.9, .5, .62, { t: .0018, nu: 3, nv: 2, slot: S.RUBBER, skin: H, edge: .2, round: .9, out: outH });
  // four-point chin strap: front and back anchors on the rim, a slider below the ear, down into the collar
  for (const s of [-1, 1]) {
    const j = collarAt(s * 1.5, -.3, .004), a0 = shell(s * 1.08, rimLat(s * 1.08) + .02, -.004), a1 = shell(s * 2.05, rimLat(s * 2.05) + .02, -.004), y0 = headP(s * 1.52, -.12, .019);
    m.tube([a0, headP(s * 1.3, -.04, .02), y0], .0034, { slot: S.RUBBER, skin: H, sides: 4, flat: .3, n: 6, up: [s, 0, 0] });
    m.tube([a1, headP(s * 1.75, -.04, .019), y0], .0034, { slot: S.RUBBER, skin: H, sides: 4, flat: .3, n: 6, up: [s, 0, 0] });
    m.tube([y0, j], .0036, { slot: S.RUBBER, skin: H, sides: 4, flat: .3, n: 4, up: [s, 0, 0] });
    if (m.keep(1)) m.box([0, 0, 0], [.012, .016, .006], .002, { slot: S.PLATE2, skin: H, m: bodyFrame(y0, s * 1.52) });
  }
  // torch clipped on the left side of the shell, pointing forward: body, knurled ring, lit lens in a bezel
  const L0 = shell(-1.5, .22, .02);
  m.box([.008, 0, 0], [.012, .02, .03], .003, { slot: S.RUBBER, skin: H, m: T(L0[0] + .006, L0[1], L0[2]) });
  const LM = T(L0[0] - .006, L0[1], L0[2] - .004, -Math.PI / 2, 0, 0);
  m.revolve([[0, -.04], [.012, -.04], [.0135, -.036], [.0135, .022], [.0158, .026], [.0158, .04], [.0135, .043]], { sides: m.keep(1) ? 14 : 7, slot: S.PLATE2, skin: H, m: LM, crease: 50 });
  m.revolve([[.0125, .041], [.0115, .043], [0, .044]], { sides: m.keep(1) ? 14 : 7, slot: S.GLOW, skin: H, m: LM, crease: 50 });
  if (m.keep(0)) m.revolve([[.0142, -.012], [.0146, -.008], [.0146, .002], [.0142, .006]], { sides: 14, slot: S.RUBBER, skin: H, m: LM, crease: 50 });
}

// ---------------------------------------------------------------- two-tone jacket (bloused over the harness belt), hood rolled at the back
const BELT = [.975, .172, .131, { w: .056, t: .009, sag: .008, cz: .002, e: 2.3 }], belt = beltMap(...BELT);
const JK0 = [[.84, .172, .133, .004], [.9, .18, .138, .004], [.97, .179, .136, .002], [1.03, .175, .132, 0], [1.09, .171, .128, 0], [1.16, .175, .129, 0], [1.24, .186, .134, 0], [1.27, .19, .136, 0], [1.32, .195, .138, 0], [1.39, .196, .137, .002], [1.435, .188, .129, .005], [1.465, .161, .114, .006], [1.49, .122, .097, .005], [1.512, .094, .086, .004]];
const JK = blouseRows(JK0, BELT[0], BELT[1], BELT[2], BELT[3].w, .007, BELT[3]), blouse = blouseDisp(BELT[0], BELT[3].w, .045);
const PIN_JK = beltPin(BELT, .0015, { above: .0015 });
const jkDisp = (a, y) => blouse(a, y) + .018 * Math.sin(a * 4 + y * 12) * bump(y, 1.2, .15) * Math.max(0, -Math.cos(a)) + .008 * Math.sin(a * 5 + y * 17);
const jacket = garmentMap(JK, { e: 2.3, disp: jkDisp, pin: PIN_JK });
const Y_JOIN = BELT[0], Y_SPLIT = 1.27;
const part = (rows, y0, y1) => { const R = [rowAt(rows, y0), ...rows.filter(r => r[0] > y0 + .002 && r[0] < y1 - .002), rowAt(rows, y1)]; R.warp = rows.warp; return R; };
const JK_LO = part(JK, Y_JOIN, Y_SPLIT), JK_HI = part(JK, Y_SPLIT, JK[JK.length - 1][0]);
const SLR = [[.893, .052], [.9, .059], [.95, .061], [1.0, .062], [1.06, .063], [1.12, .065], [1.16, .066], [1.2, .067], [1.22, .068], [1.26, .07], [1.34, .076], [1.4, .079], [1.43, .077], [1.455, .068], [1.474, .049], [1.486, .023]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const SL_LO = SLR.filter(r => r[0] <= 1.2201), SL_HI = SLR.filter(r => r[0] >= 1.2199);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .022 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12) + .05 * Math.sin(y * 120) * bump(y, .95, .05);
const sleeve = s => garmentMap(SLR, { e: 2.05, cx: s * .2, disp: slDisp });
const LG = [[.19, .075], [.21, .081], [.26, .083], [.33, .082], [.4, .081], [.47, .082], [.52, .083], [.57, .085], [.65, .093], [.75, .102], [.85, .107], [.9, .102], [.94, .091], [.975, .074]].map(r => [r[0], r[1], r[1] * 1.04, .004]);
const lgDisp = (a, y) => .05 * Math.sin(y * 90 + a * 1.5) * bump(y, .24, .06) + .05 * Math.sin(y * 120) * bump(y, .5, .07) * Math.max(0, -Math.cos(a)) ** 1.5 + .03 * Math.sin(a * 2 + y * 14) * bump(y, .7, .12) + .012 * Math.sin(a * 3 + y * 9);
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
const jkOut = (x, y, z) => [x, y > 1.46 ? .6 : 0, z];
function jacketBody(m) {
  garment(m, JK_LO, { n: 28, e: 2.3, disp: jkDisp, pin: PIN_JK, slot: S.CLOTH, skin: torsoSkin, out: jkOut, ao: foldAo(jkDisp) });
  garment(m, JK_HI, { n: 28, e: 2.3, disp: jkDisp, pin: PIN_JK, slot: S.ACCENT, skin: torsoSkin, out: jkOut, ao: foldAo(jkDisp) });
  legsFromHips(m, { hip: (a, y) => jacket(a, y), yTop: Y_JOIN, yCrotch: .88, yThigh: .77, LG, e: 2.1, lgDisp, n: 28, folds: .025, slot: S.CLOTH2, ao: (x, y, z) => .76 + .24 * sstep(.25, .45, y) });
  // retro-reflective tape over the colour join and round the waist; a storm flap down the front, in both colours
  bandOn(m, jacket, Y_SPLIT, .034, { n: 30, slot: S.METAL, skin: torsoSkin, out: (x, y, z) => [x, 0, z] });
  if (m.keep(0)) bandOn(m, jacket, 1.115, .028, { n: 30, slot: S.METAL, skin: torsoSkin, out: (x, y, z) => [x, 0, z] });
  panel(m, (u, v, h) => jacket(u, v, h + .0022), -.085, .085, 1.02, Y_SPLIT - .01, { t: .0045, nu: 3, nv: 6, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: .15, out: (x, y, z) => [x, 0, z] });
  panel(m, (u, v, h) => jacket(u, v, h + .0022), -.085, .085, Y_SPLIT + .01, 1.47, { t: .0045, nu: 3, nv: 5, slot: S.ACCENT, skin: torsoSkin, edge: .2, round: .15, out: (x, y, z) => [x, 0, z] });
  for (const s of [-1, 1]) {
    const sl = sleeve(s), so = (x, y, z) => [x - s * .2, 0, z], ox = y => s * (.2 - .032 * sstep(1.38, 1.486, y));
    if (m.keep(0)) elbowLiner(m, s, SLR);
    garment(m, SL_LO, { n: 16, e: 2.05, cx: s * .2, ox, disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), out: (x, y, z) => [x - s * .2, y < .9 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    garment(m, SL_HI, { n: 16, e: 2.05, cx: s * .2, ox, disp: slDisp, slot: S.ACCENT, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : 0, z], ao: foldAo(slDisp, s * .2) });
    bandOn(m, sl, 1.22, .03, { n: 16, slot: S.METAL, skin: sleeveSkin(s), out: so });
    if (m.keep(0)) bandOn(m, sl, 1.035, .024, { n: 16, slot: S.METAL, skin: s < 0 ? B.FAL : B.FAR, out: so });
    bandOn(m, sl, 1.315, .03, { n: 16, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: so });
    // cuff: a neoprene inner cuff showing at the end, a tab with its hook-and-loop square
    if (m.keep(0)) bandOn(m, sl, .9, .016, { n: 16, h0: -.002, t: .003, slot: S.RUBBER, skin: s < 0 ? B.FAL : B.FAR, out: so });
    if (m.keep(1)) panel(m, (u, v, h) => sl(u, v, h + .0015), s * Math.PI / 2 - .5, s * Math.PI / 2 + .5, .905, .945, { t: .004, nu: 4, nv: 2, slot: S.CLOTH, skin: s < 0 ? B.FAL : B.FAR, edge: .2, round: .5, out: so });
  }
  // pen pocket on the left upper arm
  panel(m, (u, v, h) => sleeve(-1)(u, v, h + .002), -.55, .45, 1.24, 1.3, { t: .005, nu: 4, nv: 3, slot: S.ACCENT, skin: B.UAL, edge: .15, round: .35, out: (x, y, z) => [x + .2, 0, z] });
  // the hood rolled behind the neck
  padSweep(m, Array.from({ length: 9 }, (_, i) => { const a = Math.PI + lerp(-1.0, 1.0, i / 8), p = neckAt(a, 1.5, .02 + .012 * Math.cos((i / 8 - .5) * Math.PI)); return [p[0], p[1] + .004 * Math.cos((i / 8 - .5) * Math.PI), p[2]]; }), .056, .028, (x, y, z) => [x, .55, z - .004], { slot: S.CLOTH, skin: (x, y) => blend2(C, B.NEC, y, 1.51, .03), k: 12, e: 2.6, puff: .35, step: .016 });
}

// ---------------------------------------------------------------- trousers: knee darts, tape, a thigh pocket
function trousers(m) {
  for (const s of [-1, 1]) {
    const lg = leg(s), o = (x, y, z) => [x - s * .1, 0, z], TH = s < 0 ? B.THL : B.THR, SH = s < 0 ? B.SHL : B.SHR, kn = (px, py) => blend2(SH, TH, py, .53, .04);
    panel(m, (u, v, h) => lg(u, v, h + .001), -1.05, 1.05, .45, .61, { t: .0022, nu: 9, nv: 5, slot: S.CLOTH2, skin: kn, edge: .3, round: .85, dome: .004, out: o });
    for (const y of m.keep(0) ? [.3, .36] : [.33]) bandOn(m, lg, y, m.keep(0) ? .024 : .05, { n: 18, slot: S.METAL, skin: SH, out: o });
    m.tube(Array.from({ length: 21 }, (_, i) => lg(i / 20 * TAU, .196, -.0015)), .0045, { slot: S.CLOTH2, skin: SH, sides: m.keep(1) ? 6 : 4, n: m.seg(24, 8), cap: false });
    if (s > 0) {       // flapped cargo pocket on the outside of the right thigh
      panel(m, (u, v, h) => lg(u, v, h + .002), 1.15, 2.0, .6, .7, { t: .007, nu: 5, nv: 5, slot: S.CLOTH2, skin: TH, edge: .14, round: .4, dome: .003, out: o });
      panel(m, (u, v, h) => lg(u, v, h + .0095), 1.12, 2.03, .685, .715, { t: .005, nu: 5, nv: 2, slot: S.CLOTH2, skin: TH, edge: .2, round: .5, out: o });
    }
  }
}

// ---------------------------------------------------------------- sit-and-chest harness, quick link, ascender, descender, lanyards, rope bag, tool roll, radio
const ML = [0, .921, -.162];       // centre of the semicircular quick link
const mlAt = (t, r = .033) => { const a = Math.PI * (1 + t); return [ML[0] + r * Math.cos(a), ML[1] + .012 + r * .9 * Math.sin(a), ML[2] - .004 * Math.sin(a)]; };       // t 0..1 round the arc, left to right underneath
const rope = (m, pts, o = {}) => m.tube(pts, o.r ?? .0046, { slot: o.slot ?? S.PLATE, skin: o.skin ?? P2, sides: m.keep(0) ? 8 : m.keep(1) ? 5 : 3, n: m.seg(o.n ?? 24, 6), cap: true });
function harness(m) {
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.PLATE2, skin: P2, buckle: 'frame', buckleA: .52, keepers: [-.62, -1.5, 1.6] });
  // the quick link: a steel half-moon with its gate barrel, through the belt's two ventral tabs and the leg-loop bridges
  { const pts = Array.from({ length: 15 }, (_, i) => mlAt(i / 14)); pts.push([ML[0] + .033, ML[1] + .012, ML[2]], [ML[0], ML[1] + .012, ML[2] - .002], [ML[0] - .033, ML[1] + .012, ML[2]], pts[0], pts[1]);
    m.tube(pts, .0056, { slot: S.METAL, skin: P2, sides: m.keep(0) ? 8 : 5, n: m.seg(30, 12), cap: false, crease: 70 });
    m.revolve([[.0088, -.016], [.0094, -.012], [.0094, .012], [.0088, .016]], { sides: m.keep(1) ? 12 : 6, slot: S.METAL, skin: P2, m: T(ML[0] + .004, ML[1] + .012, ML[2] - .001, 0, 0, Math.PI / 2), crease: 50 }); }
  for (const x of [-.021, .021]) strapAlong(m, [[x, .965, -.138], [x, .948, -.147], [x, .936, -.16], [x, .929, -.168], [x, .924, -.158]], .016, .004, () => [0, .2, -1], { slot: S.PLATE2, skin: P2, n: 6 });
  // leg loops (padded), bridges up into the quick link, elastic risers at the back
  for (const s of [-1, 1]) {
    const TH = s < 0 ? B.THL : B.THR, lg = leg(s), yl = a => .768 + .012 * Math.cos(a) + .006 * Math.sin(s * a);
    strapAlong(m, Array.from({ length: 16 }, (_, i) => { const a = i / 16 * TAU; return lg(a, yl(a), .009); }), .042, .009, (x, y, z) => [x - s * .1, 0, z - .004], { slot: S.PLATE2, skin: TH, closed: true, n: m.seg(22, 8) });
    const f0 = lg(-s * .55, yl(-s * .55), .015), bsk = (x, y) => { const k = sstep(.9, .8, y); return k <= 0 ? [P2, 1] : k >= 1 ? [TH, 1] : [P2, 1 - k, TH, k]; };
    strapAlong(m, [f0, [f0[0] * .8, .83, -.155], [s * .016, .875, -.17], mlAt(s < 0 ? .3 : .7, .039), mlAt(s < 0 ? .36 : .64, .027)], .022, .0045, (x, y, z) => [x * .2, .1, -1], { slot: S.PLATE2, skin: bsk, n: m.seg(10, 4) });
    const b0 = lg(s * 2.7, yl(s * 2.7), .012);
    strapAlong(m, [b0, [s * .095, .87, .15], belt(s * 2.75, .004, -BELT[3].w / 2 + .006)], .02, .003, (x, y, z) => [x * .3, 0, z], { slot: S.PLATE2, skin: (x, y) => { const k = sstep(.9, .79, y); return k <= 0 ? [P2, 1] : k >= 1 ? [TH, 1] : [P2, 1 - k, TH, k]; }, n: 6 });
    // gear loop on the belt side with a carabiner
    const ga = s * 1.42, gp = belt(ga, .012, -.03);
    m.tube([belt(s * 1.2, .002, -.026), [gp[0], gp[1] - .012, gp[2]], belt(s * 1.66, .002, -.026)], .0034, { slot: S.RUBBER, skin: P2, sides: 4, n: 6 });
  }
  // chest harness: shoulder straps from the back of the belt, over the shoulders, down to a sternal buckle; one strap through the ascender to the link
  for (const s of [-1, 1]) strapAlong(m, [jacket(-s * 2.66, 1.02, .013), jacket(-s * 2.86, 1.16, .013 + (s > 0 ? .002 : 0)), jacket(Math.PI, 1.3, s > 0 ? .02 : .013), jacket(s * 2.72, 1.37, .013 + (s > 0 ? .002 : 0)), jacket(s * 2.42, 1.43, .014), jacket(s * 1.75, 1.47, .014), jacket(s * 1.22, 1.49, .014), jacket(s * .72, 1.44, .014), jacket(s * .4, 1.35, .014), jacket(s * .14, 1.29, .015)], .038, .006, (x, y, z) => [x, y > 1.47 ? 1 : 0, z], { slot: S.PLATE2, skin: torsoSkin, n: m.seg(26, 8) });
  { const p = jacket(0, 1.285, .019); buckleAt(m, p, [0, 0, -1], { up: [0, 1, 0], w: .05, d: .022, t: .0042, th: .006, skin: C }); }
  strapAlong(m, [jacket(0, 1.28, .017), jacket(0, 1.16, .017), jacket(0, 1.06, .019), [0, 1.0, -.152], [0, .965, -.152], [0, .94, -.163], mlAt(.5, .028)], .03, .005, () => [0, 0, -1], { slot: S.PLATE2, skin: torsoSkin, n: m.seg(14, 5) });
  // chest ascender on the sternum: a cast body, its cam and the rope channel
  { const F = bodyFrame(jacket(0, 1.205, .022), 0);
    const fz = () => [F.elements[8], F.elements[9], F.elements[10]];
    m.plate([[-.021, -.042], [.021, -.042], [.025, -.01], [.024, .022], [.012, .04], [-.012, .04], [-.024, .022], [-.025, -.01]], (u, v, h) => xf(F, [u, v, h]), { t: .016, bevel: .005, slot: S.METAL, skin: C, out: fz, round: 1, crease: 55 });
    if (m.keep(1)) { m.plate([[-.007, -.036], [.007, -.036], [.008, .026], [-.008, .026]], (u, v, h) => xf(F, [u - .004, v, .0155 + h]), { t: .002, bevel: .001, slot: S.RUBBER, skin: C, out: fz, round: 1 });
      m.tube([xf(F, [.014, -.026, .017]), xf(F, [.019, -.004, .021]), xf(F, [.016, .016, .019])], .0032, { slot: S.PLATE2, skin: C, sides: 5, n: 6, cap: true });
      m.revolve([[.0045, -.006], [.0052, 0], [.0045, .006]], { sides: 8, slot: S.METAL, skin: C, m: F.clone().multiply(T(.012, .02, .018, 0, 0, Math.PI / 2)), crease: 50 }); }
    m.tube([xf(F, [-.016, .036, .012]), xf(F, [0, .046, .016]), xf(F, [.016, .036, .012])], .0035, { slot: S.METAL, skin: C, sides: 5, n: 6 }); }
  // dorsal ring where the shoulder straps cross between the shoulder blades
  { const F = bodyFrame(jacket(Math.PI, 1.3, .026), Math.PI);
    panel(m, (u, v, h) => jacket(Math.PI + u, v, h + .024), -.2, .2, u => 1.265 + .025 * Math.abs(u) / .2, u => 1.335 - .025 * Math.abs(u) / .2, { t: .005, nu: 6, nv: 4, slot: S.PLATE2, skin: C, edge: .2, round: .7, dome: .002, out: (x, y, z) => [x * .3, 0, z] });
    const pts = Array.from({ length: 11 }, (_, i) => { const a = Math.PI * i / 10; return xf(F, [.022 * Math.cos(a), .03 + .026 * Math.sin(a), .006]); }); m.tube([xf(F, [-.022, .03, .006]), ...pts.reverse(), xf(F, [.022, .03, .006]), xf(F, [-.022, .03, .006])].reverse(), .0042, { slot: S.METAL, skin: C, sides: m.keep(1) ? 6 : 4, n: 16, cap: false }); }
  radio(m, bodyFrame(jacket(-.64, 1.35, .02), -.64, -.06), { w: .044, h: .074, d: .022, skin: C, aerial: .05 });
}
/** Descender on its carabiner, two rope lanyards with steel carabiners, rope bag, tool roll. */
function gear(m) {
  // descender: twin side plates round a cam, a crank handle, hung on a carabiner from the link
  carabiner(m, [.004, .888, -.168], [0, 0, -1], { up: [0, 1, 0], skin: P2, a: .009, b: .026, r: .0026 });
  const D = T(.006, .835, -.168, .08, 0, -.12);
  m.box([0, 0, 0], [.04, .088, .02], .009, { slot: S.METAL, skin: P2, m: D });
  if (m.keep(1)) { m.box([0, .006, -.0115], [.036, .07, .003], .0015, { slot: S.RUBBER, skin: P2, m: D }); m.revolve([[.0, .004], [.008, .004], [.0095, 0], [.008, -.004], [0, -.004]], { sides: 10, slot: S.METAL, skin: P2, m: D.clone().multiply(T(0, -.018, -.013, Math.PI / 2, 0, 0)) }); }
  m.tube([xf(D, [.014, -.02, -.012]), xf(D, [.034, -.045, -.016]), xf(D, [.05, -.06, -.018])], .0042, { slot: S.METAL, skin: P2, sides: m.keep(1) ? 6 : 4, n: 5 });
  m.tube([xf(D, [.05, -.06, -.018]), xf(D, [.066, -.07, -.02])], .0062, { slot: S.RUBBER, skin: P2, sides: m.keep(1) ? 8 : 4, n: 3, cap: true });
  // lanyards: knotted on the link, round the hips just under the belt, a big steel carabiner on each gear loop
  for (const s of [-1, 1]) {
    const st = mlAt(s < 0 ? .16 : .84, .033), gp = belt(s * 1.42, .012, -.03), cz = gp, end = [cz[0] + s * .004, cz[1] - .028, cz[2] - s * 0];
    const path = s < 0 ? [st, [-.055, .9, -.162], jacket(-.62, .905, .02), jacket(-1.05, .905, .022), [end[0] - .012, end[1] - .045, end[2] - .02], end] : [st, [.06, .89, -.165], jacket(.55, .862, .026), jacket(.95, .858, .03), jacket(1.25, .87, .028), [end[0] + .01, end[1] - .05, end[2] - .02], end];
    rope(m, path, { slot: S.ACCENT, n: 24 });
    m.ell(st, [.0085, .0085, .0085], { slot: S.ACCENT, skin: P2, nu: 8, nv: 5 });
    if (m.keep(1)) carabiner(m, [cz[0] + s * .002, cz[1] - .03, cz[2]], [Math.sin(s * 1.42), 0, -Math.cos(s * 1.42)], { up: [0, 1, 0], skin: P2, a: .013, b: .03, r: .0034 });
    else m.box([0, 0, 0], [.008, .05, .02], .002, { slot: S.METAL, skin: P2, m: T(cz[0], cz[1] - .03, cz[2]) });
  }
  // rope bag hung on the right hip: a soft canvas sack (slouched, flattened against the hip) with a reinforced base, its drawcord top gathered round
  // the coiled static rope whose tail hangs out, a webbing handle and the strap to the belt
  { const a = 1.86, top = jacket(a, .9, .05), sk = (x, y) => { const k = sstep(.86, .72, y) * .45; return k <= 0 ? [P2, 1] : [P2, 1 - k, B.THR, k]; }, M = T(top[0], .815, top[2], 0, -a, -.05);
    const prof = y => (y < -.075 ? Math.sqrt(Math.max(0, 1 - ((y + .075) / .02) ** 2)) * .05 + .002 : y > .055 ? lerp(.05, .036, sstep(.055, .085, y)) : .05 + .004 * Math.sin((y + .075) * 24));
    const ys = [-.095, -.092, -.086, -.075, -.05, -.02, .01, .035, .055, .066, .076, .085], nb = m.seg(18, 8);
    const ring = (y, hh = 0) => Array.from({ length: nb }, (_, k) => { const g = k / nb * TAU, sl = 1 + .06 * Math.sin(g * 3 + y * 40) * sstep(-.07, .05, y), r = (prof(y) + hh) * sl; return xf(M, [r * Math.cos(g) * 1.08, y - .004 * Math.cos(g * 2), r * Math.sin(g) * .86]); });
    m.loft(ys.map(y => ring(y)), { slot: S.CLOTH2, skin: sk, crease: 70, capA: true, capB: true, ao: .9 });
    if (m.keep(1)) m.loft([-.094, -.085, -.07, -.06].map(y => ring(y, .0028)), { slot: S.PLATE2, skin: sk, crease: 70, ao: .95 });
    m.tube(Array.from({ length: 25 }, (_, i) => { const g = i / 24 * TAU; return xf(M, [.038 * Math.cos(g) * 1.08, .081, .038 * Math.sin(g) * .86]); }), .0042, { slot: S.PLATE2, skin: sk, sides: 5, n: m.seg(26, 8), cap: false });
    for (let k = 0; k < (m.keep(0) ? 2 : 1); k++) m.tube(Array.from({ length: 21 }, (_, i) => { const g = i / 20 * TAU, rr = .025 - k * .008; return xf(M, [rr * Math.cos(g), .093 + .004 * k + .003 * Math.sin(g * 2), rr * Math.sin(g) * .9]); }), .0058, { slot: S.PLATE, skin: sk, sides: m.keep(0) ? 7 : 5, n: m.seg(24, 10), cap: false });
    rope(m, [xf(M, [-.02, .096, -.014]), xf(M, [-.044, .094, -.034]), xf(M, [-.056, .07, -.044]), xf(M, [-.055, .045, -.049])], { slot: S.PLATE, skin: sk, r: .0056, n: 10 });
    if (m.keep(1)) { m.ell(xf(M, [-.055, .041, -.049]), [.0085, .01, .0085], { slot: S.PLATE, skin: sk, nu: 8, nv: 5 }); m.ell(xf(M, [.03, .09, -.03]), [.006, .01, .006], { slot: S.METAL, skin: sk, nu: 6, nv: 4 }); }
    strapAlong(m, [xf(M, [.05, .07, 0]), xf(M, [.05, .1, -.006]), belt(a - .12, .004, -.02), belt(a - .3, .004, -.012), xf(M, [-.05, .1, -.006]), xf(M, [-.05, .07, 0])], .02, .0032, () => [Math.sin(a), 0, -Math.cos(a)], { slot: S.PLATE2, skin: P2, n: 10 }); }
  // tool roll strapped across the back under the belt: rolled canvas, its spiral ends, two ties
  { const F = bodyFrame(jacket(Math.PI, .93, .034), Math.PI), r = .029;
    m.revolve([[0, -.1], [r * .9, -.1], [r, -.094], [r, .094], [r * .9, .1], [0, .1]], { sides: m.keep(1) ? 14 : 7, slot: S.PLATE, skin: P2, m: F.clone().multiply(T(0, 0, 0, 0, 0, Math.PI / 2)), crease: 55, ao: .92 });
    if (m.keep(0)) for (const e of [-1, 1]) m.tube(Array.from({ length: 22 }, (_, i) => { const t = i / 21, rr = lerp(.006, r * .92, t), a = t * TAU * 2.4; return xf(F, [e * .1015, rr * Math.cos(a), rr * Math.sin(a)]); }), .0012, { slot: S.CLOTH2, skin: P2, sides: 3, n: 28, cap: false });
    if (m.keep(1)) for (const x of [-.06, .06]) padSweep(m, Array.from({ length: 13 }, (_, i) => { const a = i / 12 * TAU; return xf(F, [x, (r + .002) * Math.cos(a), (r + .002) * Math.sin(a)]); }), .014, .0026, (px, py, pz) => { const q = xf(F, [x, 0, 0]); return [px - q[0], py - q[1], pz - q[2]]; }, { slot: S.PLATE2, skin: P2, e: 3, k: 6, ends: false, step: .01 }); }
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  for (const s of [-1, 1]) {
    const lg = leg(s), yl = a => .768 + .012 * Math.cos(a) + .006 * Math.sin(s * a);
    for (const d of [-.015, .015]) stitchLine(m, Array.from({ length: 33 }, (_, i) => { const a = i / 32 * TAU; return lg(a, yl(a) + d, .0185); }), { skin: s < 0 ? B.THL : B.THR, n: 48, slot: S.PLATE2 });
    stitchLine(m, Array.from({ length: 9 }, (_, i) => lg(s * Math.PI / 2, lerp(.74, .42, i / 8), .0012)), { skin: legSkin(s), n: 24, slot: S.CLOTH2 });
    // hook-and-loop square on each cuff tab, screws on the helmet's chin-strap anchors
    m.box([0, 0, 0], [.018, .018, .002], .0008, { slot: S.CLOTH2, skin: s < 0 ? B.FAL : B.FAR, m: bodyFrame(sleeve(s)(s * Math.PI / 2, .925, .006), s * Math.PI / 2 + (s < 0 ? -Math.PI / 2 : Math.PI / 2) * 0) });
    for (const lon of [1.08, 2.05]) stud(m, shell(s * lon, rimLat(s * lon) + .045, .0005), [Math.sin(s * lon), .3, -Math.cos(s * lon)], { skin: H, r: .0034, slot: S.METAL });
  }
  // zip pull at the collar, stitching along the storm flap
  m.box([0, 0, 0], [.006, .016, .003], .001, { slot: S.METAL, skin: torsoSkin, m: bodyFrame(collar(0, .3, .006), 0) });
  for (const s of [-1, 1]) stitchLine(m, Array.from({ length: 14 }, (_, i) => jacket(s * .072, lerp(1.03, 1.46, i / 13), .0068)), { skin: torsoSkin, n: 50, slot: S.CLOTH2 });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.PLATE2 }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  gear, harness, head, trousers, jacketBody,       // outside in: what lies on top first, so the depth test rejects the cloth under it
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.RUBBER, slotRand: S.RUBBER, slotSole: S.RUBBER, slotMid: S.CLOTH2, slotWelt: S.RUBBER, slotTongue: S.RUBBER, slotPanel: S.CLOTH2 }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.RUBBER, slotCuff: S.CLOTH, slotKnuckle: S.CLOTH2, guard: false, cuff: false }); },
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['gear', 'harness', 'head', 'trousers', 'jacket', 'boots', 'gloves']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
void lensFrame;
