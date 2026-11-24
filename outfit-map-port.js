// outfit-map-port.js — FRONT ZÉRO: LAMANEUR, the outfit of the Port du Couchant map. Original design: a harbour linesman kitted for a fight on the docks.
// Knitted watch cap with a rolled cuff, radio headset with boom mic, neck gaiter pulled up to the nose, amber wraparound safety glasses; a hip-length waxed
// smock (stand collar, storm flap with press studs, slash pockets, elbow patches, drawcord hem, retro-reflective tape); a yoke lifejacket in its cover
// (collar behind the neck, two padded front lobes, waist strap, light, pull toggle, radio); heavy canvas trousers with double knees; a duty belt with
// magazine pouches, a coiled heaving line and a cargo hook. No insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import * as THREE from 'three';
import { BONE as B, SLOT as S, T, torsoSkin, armSkin, legSkin, blend2, buildGlove, buildBoot, buildPouch, buildGloveDetail, buildBootDetail, stitchLine, buckleAt, carabiner, coilCable, panel, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, rowAt, garment, garmentMap, bandOn, padSweep, ropeStrands, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, jacketSkirt, skirtMap, beltRing, beltMap, blouseRows, blouseDisp, softPouch, radio, beltPin } from './outfit-maps-lib.js';

export const MAP_ID = 'port', MAP_NAME = 'Port du Couchant';
// ---------------------------------------------------------------- colourways (the map's own palette first)
const pbr = { cloth: [.64, 0, 0, .55], cloth2: [.9, 0, 0, .9], plate: [.66, 0, 0, .3], plate2: [.86, 0, 0, .5], rubber: [.72, 0, 0, .3], accent: [.42, .25, .14, 0], visor: [.08, .4, .03, 0] };
const P = o => ({ pbr, fpKit: 'plain', fpGlove: o.cloth2, ...o });       // first-person gloves in the colour of the third-person gloves
const OUT = [
  ['couchant', 'Couchant', 'Légende', 15000, { cloth: 0x74301f, cloth2: 0x2a3140, plate: 0xc58c2c, plate2: 0xa8905e, rubber: 0x231e1b, metal: 0x8d9196, accent: 0xb9bdbd, glow: 0xffd27a, visor: 0x6a4310, rim: 0x6a5a58, lift: .02 }],
  ['conteneur', 'Conteneur', 'Épique', 9000, { cloth: 0x4f5634, cloth2: 0x4e4434, plate: 0xd0621e, plate2: 0xb39a66, rubber: 0x221f1a, metal: 0x8a8e90, accent: 0xb6baba, glow: 0xffc070, visor: 0x5a3c12, rim: 0x5e6450, lift: .018 }],
  ['maree', 'Marée', 'Épique', 9000, { cloth: 0x1f2c3d, cloth2: 0x45494e, plate: 0xd9a31c, plate2: 0xcfc6b0, rubber: 0x18191b, metal: 0x9aa0a6, accent: 0xc4c8c8, glow: 0xfff0b0, visor: 0x2a3a48, rim: 0x6c7886, lift: .03 }],
  ['brume', 'Brume', 'Épique', 9000, { cloth: 0x767d83, cloth2: 0x2b2e31, plate: 0xc4402a, plate2: 0xb09a6c, rubber: 0x1c1d1f, metal: 0x9a9fa4, accent: 0xd0d4d4, glow: 0xffe2a0, visor: 0x3a2c18, rim: 0x5a6068, lift: .014 }],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal]) => ({ id: 'lamaneur-' + k, setId: 'lamaneur', name: 'LAMANEUR', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal) }));

// ---------------------------------------------------------------- head: base, watch cap, gaiter, glasses, headset
const browLat = lon => lerp(.24, -.42, ((1 - Math.cos(lon)) / 2) ** 1.25);
const cosSpace = v => (1 - Math.cos(v * Math.PI)) / 2;
function head(m) {
  const H = B.HEA, nu = m.seg(40, 14), rib = m.lod === 0 ? 1 : 0;
  headBase(m, S.CLOTH2);      // the head itself, dark (nothing of it shows but at the nape)
  // watch cap: crown, then a thick rolled cuff with knit ribs
  m.grid(nu, m.seg(10, 4), (u, v) => { const lon = u * TAU - Math.PI, lat = lerp(browLat(lon) + .22, Math.PI / 2, v ** .85); return headP(lon, lat, .0075 + .006 * Math.sin(lat) ** 8 + rib * .0007 * Math.cos(lon * 36) * (1 - v)); },
    { wrapU: true, capB: true, slot: S.CLOTH2, skin: H, crease: 180, out: outH, ao: (x, y) => .78 + .22 * sstep(1.68, 1.76, y) });
  m.grid(nu, m.seg(7, 3), (u, v) => { const lon = u * TAU - Math.PI, w = cosSpace(v), lat = browLat(lon) - .025 + .275 * w, roll = Math.min(1, Math.sin(Math.PI * w) * 2.4) ** .55; return headP(lon, lat, .0072 + .0145 * roll + rib * .0016 * Math.cos(lon * 40) * roll); },
    { wrapU: true, slot: S.CLOTH2, skin: H, crease: 180, out: outH, ao: (x, y) => .7 + .3 * sstep(1.6, 1.7, y) });
  // neck gaiter, up over the nose: a straight tube round the neck, then laid on the face
  const topLat = a => lerp(-.12, -.62, ((1 - Math.cos(a)) / 2) ** .9), nG = m.seg(28, 10), rowsN = m.seg(6, 3), rowsF = m.seg(7, 3);
  const neckAt = (a, y, fold) => { const r = 1 + fold * .055 * Math.sin(y * 170 + Math.sin(a * 3) * 1.6) * sstep(1.58, 1.52, y); return [.069 * r * Math.sin(a), y, .002 - .067 * r * Math.cos(a)]; };
  const gp = (a, v) => {
    const fold = m.lod === 2 ? 0 : 1;
    if (v <= .45) return neckAt(a, lerp(1.462, 1.57, v / .45), fold);
    const lat = lerp(-1.02, topLat(a), (v - .45) / .55), h = headP(a, lat, .0078), n = neckAt(a, h[1], fold);
    const dh = Math.hypot(h[0], h[2] + .004), dn = Math.hypot(n[0], n[2] + .004), k = sstep(-.006, .006, dh - dn);
    return [lerp(n[0], h[0], k), h[1], lerp(n[2], h[2], k)];
  };
  m.grid(nG, rowsN + rowsF, (u, v) => gp(u * TAU, v), { wrapU: true, slot: S.RUBBER, skin: (x, y) => y > 1.585 ? [H, 1] : blend2(B.NEC, H, y, 1.57, .02), crease: 180, out: (x, y, z) => [x, 0, z - .004], ao: (x, y) => .62 + .38 * sstep(1.47, 1.56, y) });
  if (m.keep(1)) m.tube(Array.from({ length: 33 }, (_, i) => headP(i / 32 * TAU, topLat(i / 32 * TAU), .0085)), .0026, { slot: S.RUBBER, skin: H, sides: 4, n: m.seg(40, 16), cap: false, up: [0, 1, 0] });
  // amber wraparound safety glasses
  const lensLat = (lon, v) => lerp(-.17 + .07 * (lon / 1.12) ** 2, .2 - .07 * (lon / 1.12) ** 2, v), lensOff = lon => .0125 + .0145 * Math.cos(lon) ** 2;
  m.grid(m.seg(20, 8), m.seg(3, 1), (u, v) => { const lon = lerp(-1.12, 1.12, u); return headP(lon, lensLat(lon, v), lensOff(lon)); }, { slot: S.VISOR, skin: H, crease: 180, out: outH });
  m.tube(Array.from({ length: 13 }, (_, i) => { const lon = lerp(-1.14, 1.14, i / 12); return headP(lon, lensLat(lon, 1) + .012, lensOff(lon) + .001); }), .0032, { slot: S.RUBBER, skin: H, sides: m.keep(1) ? 5 : 3, n: m.seg(18, 6), up: [0, 1, 0] });
  if (m.keep(1)) for (const s of [-1, 1]) m.tube([headP(s * 1.13, .1, lensOff(1.13) - .001), headP(s * 1.38, .1, .0125), headP(s * 1.75, .06, .0105)], .0022, { slot: S.RUBBER, skin: H, sides: 4, n: 6 });
  // radio headset: padded band over the crown, ear cups, boom mic to the mouth
  const band = [[-.111, 1.69, .002], [-.098, 1.742, .0], [-.06, 1.776, -.002], [0, 1.788, -.003], [.06, 1.776, -.002], [.098, 1.742, .0], [.111, 1.69, .002]];
  m.tube(band, .0098, { slot: S.RUBBER, skin: H, sides: m.keep(1) ? 8 : 4, flat: .38, n: m.seg(18, 7), up: [0, 0, 1] });
  for (const s of [-1, 1]) {
    const cup = T(s * .108, 1.655, .004, 0, 0, -s * Math.PI / 2);
    m.revolve([[.002, .02], [.026, .02], [.034, .016], [.0375, .008], [.0375, -.004], [.034, -.009], [.031, -.011]], { sides: m.keep(1) ? 16 : 8, slot: S.RUBBER, skin: H, m: cup, crease: 40 });
    m.revolve([[.033, -.006], [.037, -.012], [.035, -.019], [.028, -.021]], { sides: m.keep(1) ? 16 : 8, slot: S.CLOTH2, skin: H, m: cup, crease: 60 });      // leatherette cushion
    if (m.keep(1)) m.box([s * .108, 1.705, .004], [.012, .036, .016], .004, { slot: S.METAL, skin: H });      // slider
  }
  if (m.keep(1)) {
    m.tube([[-.13, 1.646, -.012], [-.124, 1.626, -.05], [-.098, 1.6, -.088], [-.058, 1.587, -.112], [-.034, 1.586, -.118]], .0026, { slot: S.METAL, skin: H, sides: 4, n: m.seg(12, 5) });
    m.ell([0, 0, 0], [.0075, .0075, .0145], { slot: S.RUBBER, skin: H, nu: 8, nv: 5, m: T(-.026, 1.586, -.121, 0, -1.0, 0) });
  }
}

// ---------------------------------------------------------------- waxed smock
const BELT = [.976, .1665, .1265, { w: .04, t: .0055, sag: .009, cz: .002 }], belt = beltMap(...BELT);
const SM0 = [[.955, .166, .126, .002], [.975, .165, .125, .002], [.995, .166, .126, .001], [1.05, .172, .13, 0], [1.09, .168, .126, 0], [1.16, .172, .127, 0], [1.24, .182, .131, 0], [1.32, .19, .135, 0], [1.39, .191, .134, .002], [1.435, .184, .126, .005], [1.465, .158, .112, .006], [1.49, .12, .096, .005], [1.512, .092, .084, .004]];
const SM = blouseRows(SM0, BELT[0], BELT[1], BELT[2], BELT[3].w, .0085, BELT[3]), blouse = blouseDisp(BELT[0], BELT[3].w, .055);
const STRAP = [1.132, .1715, .1285, { w: .028, t: .0035, sag: .004, cz: 0, e: 2.5, n: 40 }];
const PIN_SM = [beltPin(BELT, .0035, { above: .0015, below: .04 }), beltPin(STRAP, .0015, { above: .008, below: .008 })], PIN_SK = beltPin(BELT, .0015, { below: .04 }), PIN_TR = beltPin(BELT, .012, { below: .06 });       // trousers well inside the skirt: the thighs swing under it
const smDisp = (a, y) => blouse(a, y) + .018 * Math.sin(a * 9) * bump(y, 1.135, .04)
  + .02 * Math.sin(a * 4 + y * 10) * bump(y, 1.27, .15) * Math.max(0, -Math.cos(a)) + .008 * Math.sin(a * 5 + y * 20);
const smock = garmentMap(SM, { e: 2.5, disp: smDisp, pin: PIN_SM });
// below the belt: a skirt with a rounded flare, drape, side vents, rolled hem and the hem tape; the duty belt round the cinched waist
const SKIRT = { y0: .985, y1: .85, r0: [.172, .132], r1: [.222, .164], cz: .004, fold: .04, sag: .006, backDrop: .02, sideRise: .008, vent: .06, kMax: .3, flare: .45, tape: { y: .905, w: .022 }, pin: PIN_SK };
const skirt = skirtMap(SKIRT);
const SL = [[.893, .051], [.9, .057], [.93, .058], [.98, .06], [1.05, .062], [1.12, .064], [1.16, .065], [1.2, .066], [1.26, .069], [1.34, .074], [1.4, .077], [1.43, .075], [1.455, .066], [1.474, .048], [1.486, .022]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .025 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12) + .05 * Math.sin(y * 130) * bump(y, .95, .05);
const sleeve = s => garmentMap(SL, { e: 2.05, cx: s * .2, disp: slDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
function smockBody(m) {
  garment(m, SM, { n: 30, e: 2.5, disp: smDisp, pin: PIN_SM, slot: S.CLOTH, skin: torsoSkin, sub: 2, capA: true, out: (x, y, z) => [x, y > 1.46 ? .6 : y < .96 ? -.5 : 0, z], ao: foldAo(smDisp) });
  jacketSkirt(m, { ...SKIRT, slot: S.CLOTH, lining: S.CLOTH2, tape: { ...SKIRT.tape, slot: S.ACCENT } });
  for (const s of [-1, 1]) elbowLiner(m, s, SL);
  for (const s of [-1, 1]) garment(m, SL, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .9 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
  // stand collar with its zip
  const col = [[1.462, .097, .092, .006], [1.5, .089, .085, .006], [1.535, .085, .081, .006], [1.549, .082, .078, .006]];
  garment(m, col, { n: 26, e: 2.2, slot: S.CLOTH, skin: (x, y) => blend2(B.CHE, B.NEC, y, 1.51, .03), out: (x, y, z) => [x, 0, z], ao: .9 });
  garment(m, [[1.53, .077, .073, .006], [1.549, .082, .078, .006]], { n: 26, e: 2.2, slot: S.CLOTH, skin: B.NEC, out: (x, y, z) => [0, 1, 0], ao: .5 });
  // storm flap down the front, slash pockets, elbow patches, sleeve pocket
  panel(m, (u, v, h) => smock(u, v, h + .002), -.085, .085, .99, 1.465, { t: .004, nu: 3, nv: 9, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: .15, out: (x, y, z) => [x, 0, z] });
  if (m.keep(1)) panel(m, (u, v, h) => skirt(u, v, h + .002), -.085, .085, .862, .985, { t: .004, nu: 3, nv: 12, slot: S.CLOTH, skin: B.PEL, edge: .2, round: .15, out: (x, y, z) => [x, 0, z] });
  for (const s of [-1, 1]) panel(m, (u, v, h) => smock(s * u, v, h + .003), .3, .62, u => 1.012 + (u - .3) * .25, u => 1.03 + (u - .3) * .25, { t: .004, nu: 5, nv: 2, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: .5, out: (x, y, z) => [x, 0, z] });
  for (const s of [-1, 1]) panel(m, (u, v, h) => sleeve(s)(u, v, h + .002), Math.PI - .95, Math.PI + .95, 1.085, 1.235, { t: .0032, nu: 7, nv: 5, slot: S.CLOTH2, skin: sleeveSkin(s), edge: .15, round: .55, out: (x, y, z) => [x - s * .2, 0, z] });
  panel(m, (u, v, h) => sleeve(-1)(u, v, h + .002), -Math.PI / 2 - .5, -Math.PI / 2 + .5, 1.29, 1.39, { t: .006, nu: 5, nv: 4, slot: S.CLOTH, skin: B.UAL, edge: .15, round: .4, out: (x, y, z) => [x + .2, 0, z] });
  if (m.keep(1)) panel(m, (u, v, h) => sleeve(-1)(u, v, h + .008), -Math.PI / 2 - .54, -Math.PI / 2 + .54, 1.37, 1.405, { t: .004, nu: 5, nv: 2, slot: S.CLOTH, skin: B.UAL, edge: .2, round: .3, out: (x, y, z) => [x + .2, 0, z] });
  // cuff tabs
  if (m.keep(1)) for (const s of [-1, 1]) panel(m, (u, v, h) => sleeve(s)(u, v, h + .002), -.32, .32, .9, .925, { t: .003, nu: 3, nv: 2, slot: S.CLOTH, skin: s < 0 ? B.FAL : B.FAR, edge: .2, round: .5, out: (x, y, z) => [x - s * .2, 0, z] });
  // retro-reflective tape: two rings on each forearm, one round the hem; team band on both upper arms
  for (const s of [-1, 1]) { for (const y of [.985, 1.03]) bandOn(m, (a, yy, h) => sleeve(s)(a, yy, h), y, .019, { n: 18, slot: S.ACCENT, skin: s < 0 ? B.FAL : B.FAR, out: (x, y, z) => [x - s * .2, 0, z] });
    bandOn(m, (a, yy, h) => sleeve(s)(a, yy, h), 1.255, .032, { n: 18, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: (x, y, z) => [x - s * .2, 0, z] }); }
  // storm yoke: a second layer over the shoulders and the upper back, with a reflective band below it
  panel(m, (u, v, h) => smock(Math.PI + u, v, h + .003), -1.45, 1.45, u => 1.33 + .05 * (u / 1.45) ** 2, 1.49, { t: .0045, nu: 16, nv: 4, slot: S.CLOTH2, skin: torsoSkin, edge: .08, round: .2, out: (x, y, z) => [x, .3, z] });
  bandOn(m, smock, 1.27, .026, { a0: Math.PI - 1.05, a1: Math.PI + 1.05, n: 18, slot: S.ACCENT, skin: torsoSkin, out: (x, y, z) => [x, 0, z] });
}

// ---------------------------------------------------------------- trousers with double knees
const LG = [[.168, .078], [.172, .085], [.2, .086], [.26, .085], [.32, .08], [.4, .077], [.47, .079], [.52, .08], [.57, .082], [.65, .09], [.75, .1], [.85, .104], [.89, .098], [.92, .086], [.945, .07], [.965, .058], [.985, .05]].map(r => [r[0], r[1], r[1] * (r[0] < .34 ? 1.1 : 1.04), r[0] > .6 ? .004 : r[0] < .34 ? .006 : 0]);
const lgDisp = (a, y) => .05 * Math.sin(y * 95 + a * 1.5) * sstep(.33, .2, y) * sstep(.168, .19, y) + .06 * Math.sin(y * 120) * bump(y, .5, .07) * Math.max(0, -Math.cos(a)) ** 1.5 + .03 * Math.sin(a * 2 + y * 14) * bump(y, .78, .15) + .012 * Math.sin(a * 3 + y * 9);
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp });
function trousers(m) {
  garment(m, [[.83, .15, .118, .004], [.87, .16, .124, .004], [.92, .162, .125, .003], [.965, .158, .12, .002]], { n: 26, e: 2.15, pin: PIN_TR, slot: S.CLOTH2, skin: torsoSkin, capA: true, out: (x, y, z) => [x, y < .85 ? -.6 : 0, z], ao: .7 });      // seat, under the skirt
  for (const s of [-1, 1]) {
    garment(m, LG, { n: 18, e: 2.1, cx: s * .1, disp: lgDisp, pin: PIN_TR, slot: S.CLOTH2, skin: legSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .1, y > .97 ? .3 : 0, z], ao: (x, y, z) => foldAo(lgDisp, s * .1)(x, y, z) * (.72 + .28 * sstep(.15, .4, y)) });
    // double knee: a second layer of canvas over the knee and the top of the shin, stitched all round
    const SH = s < 0 ? B.SHL : B.SHR, kSk = (px, py) => blend2(SH, s < 0 ? B.THL : B.THR, py, .53, .04);
    panel(m, (u, v, h) => leg(s)(u, v, h + .0015), -1.2, 1.2, .405, .64, { t: .0042, nu: 10, nv: 8, slot: S.CLOTH2, skin: kSk, edge: .1, round: .3, dome: .0025, out: (x, y, z) => [x - s * .1, 0, z] });
    // hammer loop on the right leg, side pocket on the left
    if (s > 0 && m.keep(1)) panel(m, (u, v, h) => leg(s)(u, v, h + .002), 1.35, 1.62, .66, .8, { t: .004, nu: 2, nv: 4, slot: S.CLOTH2, skin: B.THR, edge: .15, round: .3, out: (x, y, z) => [x - .1, 0, z] });
    if (s < 0) { panel(m, (u, v, h) => leg(s)(u, v, h + .002), 1.05, 1.95, .64, .79, { t: .012, nu: 6, nv: 4, slot: S.CLOTH2, skin: B.THL, edge: .14, round: .4, out: (x, y, z) => [x + .1, 0, z] }); if (m.keep(1)) panel(m, (u, v, h) => leg(s)(u, v, h + .013), 1.0, 2.0, .755, .8, { t: .005, nu: 6, nv: 2, slot: S.CLOTH2, skin: B.THL, edge: .15, round: .3, out: (x, y, z) => [x + .1, 0, z] }); }
  }
}

// ---------------------------------------------------------------- lifejacket (yoke type, in its cover)
const ljOut = (x, y, z) => y > 1.44 ? (z > .03 ? [x * .6, .12, z * 2] : [x * .9, (y - 1.4) * 10, z]) : [x * .55, 0, z - .01];
const lobeA = (s, y) => s * lerp(.34, .52, sstep(1.3, 1.45, y));
const ljPath = () => {
  const p = []; for (const s of [-1, 1]) { const q = [[1.15, 0], [1.24, 0], [1.33, 0], [1.41, 0], [1.452, .002], [1.478, .002]].map(([y, h]) => smock(lobeA(s, y), y, h + .004)); q.push(smock(s * 1.15, 1.492, .004), smock(s * 1.65, 1.503, .002), smock(s * 2.25, 1.505, .002)); if (s < 0) p.push(...q); else p.push(...q.reverse()); if (s < 0) p.push(smock(Math.PI, 1.506, .002)); }
  return p;
};
function lifejacket(m) {
  const path = ljPath(), n = path.length;
  padSweep(m, path, u => { const k = Math.abs(u - .5) * 2; return lerp(.082, .088, sstep(.55, .85, k)); }, u => { const k = Math.abs(u - .5) * 2; return lerp(.038, .03, sstep(.4, .8, k)); }, ljOut,
    { slot: S.PLATE, skin: (x, y) => y > 1.5 ? blend2(B.CHE, B.NEC, y, 1.53, .02) : torsoSkin(x, y), k: 16, e: 3.4, puff: .35, bead: .0028, step: .018, ao: (x, y) => .82 + .18 * sstep(1.1, 1.3, y) });
  void n;
  // waist strap with its cam buckle, webbing loops at the foot of each lobe
  beltRing(m, ...STRAP.slice(0, 3), { ...STRAP[3], slot: S.RUBBER, metal: S.RUBBER, latchSlot: S.PLATE, skin: torsoSkin, buckle: 'cobra' });
  // radio clipped to the left lobe, aerial; light on the right shoulder; pull toggle under the right lobe
  radio(m, bodyFrame(smock(-.36, 1.29, .034), -.36), { w: .046, h: .08, d: .026, skin: B.CHE, aerial: .05, grilleSlot: S.PLATE2 });
  const lp = smock(.92, 1.47, .03), LF = bodyFrame(lp, .92, -.9);
  m.revolve([[.002, .016], [.011, .016], [.0125, .006], [.0125, -.002]], { sides: m.keep(1) ? 10 : 6, slot: S.RUBBER, skin: B.CHE, m: LF.clone().multiply(T(0, 0, .006, Math.PI / 2, 0, 0)), crease: 40 });
  m.revolve([[.0003, .0085], [.006, .0072], [.0092, .002]], { sides: m.keep(1) ? 10 : 6, slot: S.GLOW, skin: B.CHE, m: LF.clone().multiply(T(0, 0, .022, Math.PI / 2, 0, 0)), crease: 60 });
  if (m.keep(1)) { const a = smock(.36, 1.148, .03); m.tube([a, [a[0] + .004, a[1] - .03, a[2] - .006], [a[0] + .006, a[1] - .05, a[2] - .004]], .0022, { slot: S.RUBBER, skin: torsoSkin, sides: 4, n: 6 }); m.box([0, 0, 0], [.03, .012, .01], .004, { slot: S.PLATE2, skin: torsoSkin, m: T(a[0] + .006, a[1] - .058, a[2] - .004, 0, -.36, 0) }); }
}

// ---------------------------------------------------------------- duty belt, pouches, heaving line, cargo hook
function dutyBelt(m) {
  const P2 = B.PEL;
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.RUBBER, skin: P2, buckle: 'frame', keepers: [-.5, 1.3, -1.3, 2.2, -2.2] });
  for (const a of [-.62, -.98]) softPouch(m, .062, .09, .034, bodyFrame(skirt(a, .94, .004), a, .12), { slot: S.RUBBER, flapSlot: S.RUBBER, skin: P2, tab: true, tabSlot: S.CLOTH2 });
  // heaving line: a hank of six loops gathered under a whipping of turns, hung by a carabiner at the back of the left hip
  const A = -2.3, HF = bodyFrame(skirt(A, .945, .016), A), r = .0068, loops = [];
  for (let k = 0; k < 6; k++) { const w = .046 + .005 * Math.sin(k * 1.7), h = .19 + .012 * Math.cos(k * 2.3), xo = (k - 2.5) * .0036, zo = .007 + k * .0062; const pts = []; for (let i = 0; i <= 24; i++) { const th = i / 24 * TAU, g = (1 + Math.cos(th)) / 2; pts.push(xf(HF, [xo + w * Math.sin(th) * (1 - .62 * g ** 3), -.03 - h * (1 - Math.cos(th)) / 2, zo + .004 * Math.sin(th * 2 + k)])); } loops.push(pts); }
  for (let k = 0; k < 6; k++) if (m.keep(1) || k % 2 === 0) m.tube(loops[k], r, { slot: S.PLATE2, skin: P2, sides: m.keep(0) ? 6 : 4, n: m.seg(30, 10), cap: false, tension: .5, ribs: 0 });
  { const pts = []; for (let i = 0; i <= 40; i++) { const ph = i / 40 * TAU * 4, y = lerp(-.028, -.06, i / 40); pts.push(xf(HF, [.03 * Math.cos(ph), y, .024 + .024 * Math.sin(ph)])); } m.tube(pts, r * .95, { slot: S.PLATE2, skin: P2, sides: m.keep(0) ? 5 : 3, n: m.seg(48, 16), cap: true }); }
  const bt = belt(A, .002, .016); m.tube([xf(HF, [0, -.03, .02]), xf(HF, [-.003, -.004, .018]), [bt[0], bt[1] - .012, bt[2]], bt], r, { slot: S.PLATE2, skin: P2, sides: 4, n: 6 });
  if (m.keep(1)) carabiner(m, belt(A, .006, .004), [Math.sin(A), 0, -Math.cos(A)], { up: [0, 1, 0], skin: P2, a: .008, b: .016 });
  // cargo hook hooked over the belt behind the right hip, its T-handle hanging below
  const KA = 2.45, KF = bodyFrame(skirt(KA, .875, .024), KA), hook = [belt(KA, -.004, .012), belt(KA, .0, .024), belt(KA, .008, .028), belt(KA, .012, .016), skirt(KA, .955, .008), skirt(KA, .92, .012), skirt(KA, .895, .018), xf(KF, [0, .002, 0])];
  m.tube(hook, t => lerp(.0024, .0068, sstep(0, .5, t)), { slot: S.METAL, skin: P2, sides: m.keep(1) ? 7 : 4, n: m.seg(18, 7), cap: true });
  m.revolve([[.005, .068], [.0105, .064], [.0142, .04], [.0155, 0], [.0142, -.04], [.0105, -.064], [.005, -.068]], { sides: m.keep(1) ? 10 : 6, slot: S.PLATE2, skin: P2, m: KF.clone().multiply(T(0, -.012, .0, 0, 0, Math.PI / 2)), crease: 60 });
  if (m.keep(1)) m.revolve([[.0075, .009], [.0082, 0], [.0075, -.009]], { sides: 8, slot: S.METAL, skin: P2, m: KF.clone().multiply(T(0, -.001, .0)), crease: 50 });
  void loops;
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  const H = B.HEA;
  // cap: four crown seams; glasses: hinge blocks
  for (let k = 0; k < 4; k++) stitchLine(m, Array.from({ length: 7 }, (_, i) => headP(k * Math.PI / 2 + .4, lerp(.95, 1.5, i / 6), .0142 - .0012 * (i / 6))), { skin: H, n: 12, slot: S.CLOTH2 });
  for (const s of [-1, 1]) m.box([0, 0, 0], [.004, .008, .012], .001, { slot: S.RUBBER, skin: H, m: T(...headP(s * 1.12, .12, .016), 0, s * 1.0, 0) });
  // smock: press studs down the storm flap, stitched flap edges, pocket welts, collar zip
  for (let i = 0; i < 7; i++) { const y = lerp(.9, 1.43, i / 6), p = y < .99 ? skirt(0, y, .0068) : smock(0, y, .0068); stud(m, p, [0, 0, -1], { skin: y < .99 ? B.PEL : torsoSkin, r: .0046 }); }
  for (const s of [-1, 1]) { stitchLine(m, Array.from({ length: 10 }, (_, i) => smock(s * .072, lerp(1.0, 1.46, i / 9), .0064)), { skin: torsoSkin, n: 30 }); stitchLine(m, Array.from({ length: 5 }, (_, i) => skirt(s * .072, lerp(.866, .985, i / 4), .0064)), { skin: B.PEL, n: 12 }); }
  for (const s of [-1, 1]) stitchLine(m, Array.from({ length: 6 }, (_, i) => { const u = lerp(.31, .61, i / 5); return smock(s * u, 1.034 + (u - .3) * .25, .0072); }), { skin: torsoSkin, n: 14 });
  m.tube(Array.from({ length: 5 }, (_, i) => { const y = lerp(1.465, 1.548, i / 4); const r = rowAt([[1.462, .097, .092, .006], [1.549, .082, .078, .006]], y); return [0, y, r[3] - r[2] - .0012]; }), .0022, { slot: S.METAL, skin: (x, y) => blend2(B.CHE, B.NEC, y, 1.51, .03), sides: 3, n: 8, cap: false });
  // sleeves: stitched elbow patches, raglan seam, cuff studs
  for (const s of [-1, 1]) { const sl = sleeve(s), sk = sleeveSkin(s); stitchLine(m, Array.from({ length: 21 }, (_, i) => { const t = i / 20 * TAU; return sl(Math.PI + Math.sin(t) * .88, 1.16 + Math.cos(t) * .066, .0062); }), { skin: sk, n: 44 });
    stitchLine(m, Array.from({ length: 8 }, (_, i) => { const y = lerp(1.47, 1.18, i / 7); return smock(s * lerp(.9, .62, i / 7), y, .002); }), { skin: torsoSkin, n: 16 });
    stud(m, sl(0, .912, .0058), [0, 0, -1], { skin: s < 0 ? B.FAL : B.FAR, r: .0036 }); }
  // trousers: double-knee stitching, bar tacks at the pocket
  for (const s of [-1, 1]) { const lg = leg(s), SH = s < 0 ? B.SHL : B.SHR, kSk = (px, py) => blend2(SH, s < 0 ? B.THL : B.THR, py, .53, .04);
    stitchLine(m, Array.from({ length: 13 }, (_, i) => lg(lerp(-1.12, 1.12, i / 12), .632, .0062)), { skin: kSk, n: 26 }); stitchLine(m, Array.from({ length: 13 }, (_, i) => lg(lerp(-1.12, 1.12, i / 12), .413, .0062)), { skin: kSk, n: 26 }); }
  // lifejacket: the seam round its cover, oral tube, whistle
  const path = ljPath();
  for (const q of [.32, .68]) { const t = q < .5 ? [0, q] : [q, 1]; void t; }
  { const a = smock(-.36, 1.2, .05); m.tube([a, [a[0] - .006, a[1] + .04, a[2] - .002], [a[0] - .008, a[1] + .06, a[2]]], .0032, { slot: S.RUBBER, skin: torsoSkin, sides: 5, n: 6 }); }
  { const w = smock(.4, 1.36, .048); m.box([0, 0, 0], [.012, .03, .011], .004, { slot: S.PLATE2, skin: B.CHE, m: T(w[0], w[1], w[2], 0, -.4, .2) }); }
  coilCable(m, smock(-.36, 1.34, .05), [-.122, 1.615, -.02], { turns: 9, R: .0055, skin: B.CHE });
  void path;
  // belt keepers, pouch stitching
  for (const a of [-.32, .32, 1.3, -1.3, 2.2, -2.2]) m.box([0, 0, 0], [.012, .05, .006], .002, { slot: S.RUBBER, skin: B.PEL, m: bodyFrame(belt(a, .002), a) });
}
function ropeDetail(m) {
  const A = -2.3, HF = bodyFrame(skirt(A, .945, .016), A), r = .0068;
  for (const k of [3, 4, 5]) { const w = .046 + .005 * Math.sin(k * 1.7), h = .19 + .012 * Math.cos(k * 2.3), xo = (k - 2.5) * .0036, zo = .007 + k * .0062, pts = []; for (let i = 0; i <= 24; i++) { const th = i / 24 * TAU, g = (1 + Math.cos(th)) / 2; pts.push(xf(HF, [xo + w * Math.sin(th) * (1 - .62 * g ** 3), -.03 - h * (1 - Math.cos(th)) / 2, zo + .004 * Math.sin(th * 2 + k)])); } ropeStrands(m, pts, r * 1.04, { skin: B.PEL, L: .36, lay: r * 8, up: [Math.sin(A), 0, -Math.cos(A)] }); }
}
const DETAIL_PARTS = [detail, ropeDetail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.RUBBER }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  head, smockBody, trousers,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.RUBBER, slotRand: S.RUBBER, slotSole: S.CLOTH2, slotMid: S.RUBBER, slotWelt: S.RUBBER, slotTongue: S.RUBBER, slotPanel: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.CLOTH2, slotCuff: S.CLOTH2, guard: false, cuff: false }); },
  lifejacket, dutyBelt,
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['head', 'smock', 'trousers', 'boots', 'gloves', 'lifejacket', 'belt']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
void THREE;
