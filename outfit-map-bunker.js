// outfit-map-bunker.js — FRONT ZÉRO: ÉCLUSE, the outfit of the Bunker Sigma map. Original design: the decontamination team of the underground complex.
// A coated protective suit (hooded smock with a zip flap, trousers), every interface sealed with tape wound round it (wrists over the butyl gloves,
// ankles over the rubber overboots), a full-face mask with one wide visor, a side filter and a voice emitter under the suit's elasticated hood,
// detector bands on the upper arm and the shin, a dosimeter on the chest, a mask carrier and a decontamination pouch on the belt, laced rubber overboots.
// No insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, torsoSkin, legSkin, blend2, buildGlove, buildBoot, buildPouch, buildGloveDetail, stitchLine, buckleAt, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, lensFrame, jacketSkirt, skirtMap, beltRing, beltMap, softPouch, blouseRows, blouseDisp, beltPin } from './outfit-maps-lib.js';

export const MAP_ID = 'bunker', MAP_NAME = 'Bunker Sigma';
// ---------------------------------------------------------------- colourways (the map's own palette first)
// dark rims and a low lift: a bright rim made the suit read like the grey concrete (palette tests on the bunker and the snow map, 24 Nov)
const pbr = { cloth: [.55, 0, 0, .35], cloth2: [.6, 0, 0, .3], plate: [.5, 0, 0, .1], plate2: [.5, 0, 0, .1], rubber: [.48, 0, 0, .06], accent: [.6, 0, .06, .2], visor: [.05, .55, .03, 0] };
const P = o => ({ pbr, fpKit: 'plain', fpGlove: o.plate, ...o });       // first-person gloves in the colour of the third-person gloves
const OUT = [
  ['sigma', 'Sigma', 'Légende', 15000, { cloth: 0x26282a, cloth2: 0x1e2022, plate: 0x141516, plate2: 0x2a2c2e, rubber: 0x121313, metal: 0x9a9ea2, accent: 0xe8b818, glow: 0xffb020, visor: 0x1c2228, rim: 0x3a3c3e, lift: .012, floor: .01 }],
  ['olive', 'Olive', 'Épique', 9000, { cloth: 0x4a5236, cloth2: 0x3a402c, plate: 0x1c1d1a, plate2: 0x2e3226, rubber: 0x161714, metal: 0x92968a, accent: 0xd8c040, glow: 0xc8ff80, visor: 0x1a2018, rim: 0x3a4030, lift: .012, floor: .01 }],
  ['alerte', 'Alerte', 'Épique', 9000, { cloth: 0x9a7a18, cloth2: 0x6a5414, plate: 0x1c1c1c, plate2: 0x2a2a2a, rubber: 0x161616, metal: 0x9a9a9a, accent: 0x1e1e1e, glow: 0xff6020, visor: 0x1c2228, rim: 0x4a4020, lift: .01, floor: .01 }],
  ['rouille', 'Rouille', 'Épique', 9000, { cloth: 0x7a3a24, cloth2: 0x5a2c1c, plate: 0x1c1a19, plate2: 0x2c2826, rubber: 0x161414, metal: 0x9a948e, accent: 0x7ad0c8, glow: 0x80ffe0, visor: 0x1c2228, rim: 0x4a3028, lift: .012, floor: .01 }],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal]) => ({ id: 'ecluse-' + k, setId: 'ecluse', name: 'ÉCLUSE', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal) }));

const H = B.HEA, C = B.CHE;
// ---------------------------------------------------------------- head: suit hood with its elastic face opening, full-face mask
const faceF = (lon, lat) => (lon / .95) ** 2 + ((lat + .2) / .78) ** 2;       // < 1 inside the hood's face opening
const hoodP = (lon, lat, off = 0) => { const inner = sstep(1.08, .9, faceF(lon, lat)); return headP(lon, lat, lerp(.026, .006, inner) + off + .006 * Math.sin(lat * 3 + lon * 2) * (1 - inner)); };
const maskP = (lon, lat, off = 0) => { const k = Math.max(0, 1 - (lon / 1.05) ** 2 - ((lat + .22) / .86) ** 2); return headP(lon, lat, .012 + .016 * k ** .5 + off); };
function head(m) {
  headBase(m, S.RUBBER);
  // hood: over the head, down the neck into the smock collar
  m.grid(m.seg(36, 14), m.seg(14, 6), (u, v) => { const lon = u * TAU - Math.PI, lat = lerp(-1.25, Math.PI / 2, v ** .95); if (v < .15) { const q = hoodP(lon, -1.0); return [q[0] * lerp(1.25, 1, v / .15), lerp(1.47, q[1], v / .15), (q[2] + .006) * lerp(1.2, 1, v / .15) - .006]; } return hoodP(lon, lat); }, { wrapU: true, capB: true, slot: S.CLOTH, skin: (x, y) => y > 1.585 ? [H, 1] : blend2(B.NEC, H, y, 1.56, .025), crease: 180, out: outH, ao: (x, y, z) => .72 + .28 * sstep(1.52, 1.66, y) });
  if (m.keep(1)) m.tube(Array.from({ length: 33 }, (_, i) => { const t = i / 32 * TAU; return headP(Math.sin(t) * .95, -.2 + Math.cos(t) * .78, .02); }), .006, { slot: S.CLOTH, skin: H, sides: 5, n: m.seg(40, 14), cap: false });
  // hood seams: one over the crown, one round the back of the head
  if (m.keep(1)) { m.tube(Array.from({ length: 11 }, (_, i) => { const t = lerp(.55, 2.9, i / 10), lat = Math.PI / 2 - Math.abs(t - Math.PI / 2); return hoodP(t < Math.PI / 2 ? 0 : Math.PI, Math.min(lat, 1.5), .0015); }), .003, { slot: S.CLOTH, skin: H, sides: 4, flat: .5, n: m.seg(16, 6), up: [1, 0, 0] }); m.tube(Array.from({ length: 13 }, (_, i) => hoodP(Math.PI + lerp(-1.6, 1.6, i / 12), .35, .0015)), .003, { slot: S.CLOTH, skin: H, sides: 4, flat: .5, n: m.seg(16, 6) }); }
  // mask: moulded face piece, a wide visor in its frame, a side filter on the left, a voice emitter and exhale valve, the head harness straps
  m.grid(m.seg(22, 9), m.seg(12, 6), (u, v) => { const lon = lerp(-1.05, 1.05, u), lat = lerp(-1.0, .55, v), e = Math.max(Math.abs(lon) / 1.05, Math.abs(lat + .22) / .78); return maskP(lon * (1 - .1 * sstep(.6, 1, v) * Math.abs(lon)), lat, -.006 * sstep(.88, 1, e)); }, { slot: S.PLATE, skin: H, crease: 180, out: outH, ao: .9 });
  const VA = .78, VB0 = -.16, VB1 = .38;
  m.grid(m.seg(18, 8), m.seg(5, 2), (u, v) => { const lon = lerp(-VA, VA, u), w = 1 - (lon / VA) ** 2, lat = lerp(VB0 + .1 * (1 - w), VB1 - .06 * (1 - w), v); return maskP(lon, lat, .007); }, { slot: S.VISOR, skin: H, crease: 180, out: outH });
  m.tube(Array.from({ length: 29 }, (_, i) => { const t = i / 28; let lon, lat; if (t < .5) { const k = t * 2; lon = lerp(-VA, VA, k); const w = 1 - (lon / VA) ** 2; lat = VB1 - .06 * (1 - w) + .02; } else { const k = (t - .5) * 2; lon = lerp(VA, -VA, k); const w = 1 - (lon / VA) ** 2; lat = VB0 + .1 * (1 - w) - .02; } return maskP(lon, lat, .009); }), .0068, { slot: S.PLATE2, skin: H, sides: m.keep(1) ? 5 : 3, n: m.seg(40, 14), cap: false, tension: .4 });
  const FM = bodyFrame(maskP(-.62, -.62, .004), -.85, .25).multiply(T(0, 0, 0, Math.PI / 2, 0, 0));
  m.revolve([[.026, -.004], [.031, -.004], [.034, .002], [.035, .03], [.033, .046], [.026, .05], [.002, .05]], { sides: m.keep(1) ? 20 : 8, slot: S.PLATE2, skin: H, m: FM, crease: 40 });
  if (m.keep(1)) { m.revolve([[.0355, .012], [.0355, .02]], { sides: 20, slot: S.ACCENT, skin: H, m: FM, crease: 60 }); for (let k = 0; k < 10; k++) m.box([.03 * Math.cos(k / 10 * TAU), .036, .03 * Math.sin(k / 10 * TAU)], [.004, .018, .004], .001, { slot: S.PLATE2, skin: H, m: FM }); }
  const EM = bodyFrame(maskP(0, -.62, .004), 0, .3).multiply(T(0, 0, 0, Math.PI / 2, 0, 0));
  m.revolve([[.0005, .026], [.016, .025], [.022, .018], [.024, .004], [.022, -.004]], { sides: m.keep(1) ? 16 : 8, slot: S.PLATE2, skin: H, m: EM, crease: 40 });
  if (m.keep(1)) for (let k = -2; k <= 2; k++) m.box([k * .007, .026, 0], [.0032, .002, .026 - Math.abs(k) * .005], .0008, { slot: S.METAL, skin: H, m: EM });
  for (const [lon, lat] of [[1.05, .3], [1.15, -.2], [1.0, -.7]]) for (const s of [-1, 1]) m.tube([maskP(s * lon * .98, lat, -.002), hoodP(s * (lon + .6), lat * .7 + .05, .002), hoodP(s * 2.4, .1 + lat * .3, .003), hoodP(Math.PI, .2 + lat * .15, .003)], .0042, { slot: S.RUBBER, skin: H, sides: 4, flat: .3, n: m.seg(10, 4), up: [0, 1, 0] });
}

// ---------------------------------------------------------------- suit: smock and trousers, taped interfaces
const BELT = [.976, .1665, .1265, { w: .04, t: .0055, sag: .008, cz: .002 }], belt = beltMap(...BELT);
const SM0 = [[.955, .166, .126, .002], [.975, .165, .125, .002], [.995, .167, .127, .001], [1.02, .172, .131, 0], [1.05, .172, .13, 0], [1.1, .168, .126, 0], [1.16, .172, .127, 0], [1.24, .183, .132, 0], [1.32, .192, .136, 0], [1.39, .193, .135, .002], [1.435, .185, .127, .005], [1.465, .159, .113, .006], [1.49, .121, .097, .005], [1.512, .093, .085, .004]];
const SM = blouseRows(SM0, BELT[0], BELT[1], BELT[2], BELT[3].w, .0085, BELT[3]), blouse = blouseDisp(BELT[0], BELT[3].w, .05);
const PIN_SM = beltPin(BELT, .0035, { above: .0015, below: .04 }), PIN_SK = beltPin(BELT, .0015, { below: .04 }), PIN_TR = beltPin(BELT, .012, { below: .06 });       // trousers well inside the skirt: the thighs swing under it
const smDisp = (a, y) => blouse(a, y) + .022 * Math.sin(a * 4 + y * 11) * bump(y, 1.26, .15) * Math.max(0, -Math.cos(a)) + .01 * Math.sin(a * 5 + y * 18);
const smock = garmentMap(SM, { e: 2.5, disp: smDisp, pin: PIN_SM });
const SKIRT = { y0: .985, y1: .86, r0: [.172, .132], r1: [.222, .164], cz: .004, fold: .04, sag: .006, backDrop: .018, sideRise: .006, vent: .05, kMax: .3, flare: .45, pin: PIN_SK }, skirt = skirtMap(SKIRT);
const SLR = [[.893, .053], [.9, .059], [.95, .061], [1.0, .063], [1.06, .065], [1.12, .067], [1.16, .068], [1.2, .069], [1.26, .071], [1.34, .076], [1.4, .079], [1.43, .077], [1.455, .068], [1.474, .049], [1.486, .023]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .03 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12) + .05 * Math.sin(y * 120) * bump(y, .992, .028);       // gathered above the taped cuff, smooth under the tape
const sleeve = s => garmentMap(SLR, { e: 2.05, cx: s * .2, disp: slDisp });
const LG = [[.21, .074], [.23, .082], [.28, .086], [.33, .085], [.4, .084], [.47, .085], [.52, .086], [.57, .088], [.65, .095], [.75, .104], [.85, .107], [.89, .1], [.92, .088], [.945, .072], [.965, .06], [.985, .05]].map(r => [r[0], r[1], r[1] * 1.05, .004]);
const lgDisp = (a, y) => .07 * Math.sin(y * 80 + a * 2) * bump(y, .28, .06) + .06 * Math.sin(y * 115) * bump(y, .5, .07) * Math.max(0, -Math.cos(a)) ** 1.3 + .03 * Math.sin(a * 2 + y * 13) * bump(y, .78, .15) + .015 * Math.sin(a * 3 + y * 9);
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
/** Tape wound round a limb: a shallow helix of overlapping turns. */
function tapeWrap(m, map, y0, y1, turns, skin, cx) {
  if (m.lod > 0) { bandOn(m, map, (y0 + y1) / 2, y1 - y0 + .016, { n: 12, h0: .0025, t: .0018, slot: S.ACCENT, skin, out: (x, y, z) => [x - cx, 0, z] }); return; }
  // tape wound on in overlapping turns, each lying on the one before, hugging the cuff
  const N = turns * 12, pts = []; for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * TAU; pts.push(map(a, lerp(y0, y1, t), .0022 + .0012 * t)); }
  padSweep(m, pts, .02, .0016, (x, y, z) => [x - cx, 0, z], { slot: S.ACCENT, skin, k: 5, e: 3, puff: .05, step: .032, ends: true });
}
function suit(m) {
  garment(m, SM, { n: 30, e: 2.5, disp: smDisp, pin: PIN_SM, slot: S.CLOTH, skin: torsoSkin, sub: 2, capA: true, out: (x, y, z) => [x, y > 1.46 ? .6 : y < .96 ? -.5 : 0, z], ao: foldAo(smDisp) });
  jacketSkirt(m, { ...SKIRT, slot: S.CLOTH, lining: S.CLOTH2 });
  // zip flap with press studs, a chest pocket for the dosimeter, drawcord hem
  panel(m, (u, v, h) => smock(u, v, h + .002), -.1, .1, .99, 1.47, { t: .005, nu: 3, nv: 9, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: .15, out: (x, y, z) => [x, 0, z] });
  if (m.keep(1)) panel(m, (u, v, h) => skirt(u, v, h + .002), -.1, .1, .872, .985, { t: .005, nu: 3, nv: 12, slot: S.CLOTH, skin: B.PEL, edge: .2, round: .15, out: (x, y, z) => [x, 0, z] });
  panel(m, (u, v, h) => smock(u, v, h + .003), -.78, -.32, 1.2, 1.34, { t: .008, nu: 4, nv: 4, slot: S.CLOTH, skin: torsoSkin, edge: .14, round: .4, out: (x, y, z) => [x, 0, z] });
  for (const s of [-1, 1]) {
    elbowLiner(m, s, SLR);
    garment(m, SLR, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .9 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    if (s < 0) garment(m, [[.83, .158, .122, .004], [.87, .172, .132, .004], [.92, .176, .135, .003], [.965, .168, .128, .002]], { n: 26, e: 2.3, pin: PIN_TR, slot: S.CLOTH2, skin: torsoSkin, capA: true, out: (x, y, z) => [x, y < .85 ? -.6 : 0, z], ao: .7 });
    garment(m, LG, { n: 18, e: 2.1, cx: s * .1, disp: lgDisp, pin: PIN_TR, slot: S.CLOTH2, skin: legSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .1, y > .97 ? .3 : 0, z], ao: (x, y, z) => foldAo(lgDisp, s * .1)(x, y, z) * (.76 + .24 * sstep(.2, .4, y)) });
    // detector bands, team band
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), 1.35, .036, { n: 16, slot: S.ACCENT, skin: s < 0 ? B.UAL : B.UAR, out: (x, y, z) => [x - s * .2, 0, z] });
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), 1.25, .03, { n: 16, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: (x, y, z) => [x - s * .2, 0, z] });
    bandOn(m, (a, y, h) => leg(s)(a, y, h), .4, .034, { n: 16, slot: S.ACCENT, skin: s < 0 ? B.SHL : B.SHR, out: (x, y, z) => [x - s * .1, 0, z] });
    // knee reinforcement
    panel(m, (u, v, h) => leg(s)(u, v, h + .0015), -1.0, 1.0, .44, .6, { t: .0035, nu: 8, nv: 5, slot: S.CLOTH2, skin: (px, py) => blend2(s < 0 ? B.SHL : B.SHR, s < 0 ? B.THL : B.THR, py, .53, .04), edge: .12, round: .5, dome: .002, out: (x, y, z) => [x - s * .1, 0, z] });
  }
}
function seals(m) {
  for (const s of [-1, 1]) {
    // butyl glove gauntlet over the cuff, tape wound over the join
    m.revolve([[.052, .03], [.058, -.005], [.062, -.04], [.064, -.058], [.06, -.062], [.056, -.045]], { sides: m.keep(1) ? 14 : 7, slot: S.PLATE, skin: (x, y) => blend2(s < 0 ? B.HAL : B.HAR, s < 0 ? B.FAL : B.FAR, y, .905, .015), m: T(s * .2, .885, 0, Math.PI, 0, 0, 1, 1, 1.04), crease: 60 });
    tapeWrap(m, (a, y, h) => sleeve(s)(a, y, h + lerp(.0075, .0025, sstep(.938, .956, y))), .925, .962, 3, s < 0 ? B.FAL : B.FAR, s * .2);
    // tape at the ankle over the overboot
    tapeWrap(m, (a, y, h) => leg(s)(a, y, h + lerp(.011, .003, sstep(.214, .232, y))), .2, .245, 3, s < 0 ? B.SHL : B.SHR, s * .1);
  }
}

// ---------------------------------------------------------------- overboots, belt, carrier, pouches, dosimeter
function overboots(m) {
  for (const s of [-1, 1]) {
    const SH = s < 0 ? B.SHL : B.SHR, FO = s < 0 ? B.FOL : B.FOR;
    // the shaft of the overboot round the ankle, over the trouser bottom
    garment(m, [[.11, .07, .078, .006], [.15, .074, .082, .006], [.2, .078, .086, .006], [.215, .08, .088, .006], [.218, .076, .084, .006]], { n: 16, e: 2.2, cx: s * .1, slot: S.PLATE, skin: (x, y) => blend2(FO, SH, y, .16, .035), out: (x, y, z) => [x - s * .1, 0, z - .006], ao: .85 });
    // laces wound up the front and round the ankle
    if (m.keep(1)) for (let k = 0; k < 3; k++) m.tube([[s * .1 - .05, .1 + k * .035, -.04], [s * .1, .085 + k * .035, -.09 + k * .012], [s * .1 + .05, .1 + k * .035, -.04]], .0028, { slot: S.ACCENT, skin: FO, sides: 4, n: 6 });
  }
}
function kit(m) {
  const P2 = B.PEL;
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.PLATE2, skin: P2, buckle: 'cobra', latchSlot: S.ACCENT, keepers: [-.5, .5] });
  // mask carrier: a soft cylinder on the left hip, its lid strap
  { const a = -1.65, F = bodyFrame(skirt(a, .93, .055), a); m.revolve([[0, .085], [.05, .085], [.058, .075], [.06, -.05], [.055, -.062], [0, -.064]], { sides: m.keep(1) ? 16 : 8, slot: S.PLATE2, skin: P2, m: F.clone().multiply(T(0, 0, 0, 0, 0, 0, 1, 1, .72)), crease: 50 }); m.box([0, .06, .036], [.026, .05, .006], .003, { slot: S.PLATE2, skin: P2, m: F }); if (m.keep(1)) m.box([0, .04, .04], [.02, .014, .004], .002, { slot: S.METAL, skin: P2, m: F }); }
  // decontamination kit pouch on the right hip, a small one at the back
  for (const [a, w, h] of [[1.3, .068, .088], [2.6, .09, .07]]) softPouch(m, w, h, .034, bodyFrame(skirt(a, .945, .004), a, .1), { slot: S.PLATE2, flapSlot: S.PLATE2, skin: P2, tab: true, tabSlot: S.ACCENT });
  // dosimeter in the chest pocket, a clip and its window
  { const F = bodyFrame(smock(-.55, 1.32, .012), -.55); m.box([0, .02, .006], [.032, .05, .014], .005, { slot: S.RUBBER, skin: C, m: F }); m.box([0, .03, .0135], [.02, .014, .0015], .001, { slot: S.GLOW, skin: C, m: F }); }
  // hazard-striped tag on the left shoulder strap of the suit
  { const F = bodyFrame(smock(-.85, 1.43, .004), -.85, -.5); for (let k = 0; k < 4; k++) m.box([(k - 1.5) * .011, 0, .001], [.011, .03, .002], .0005, { slot: k % 2 ? S.RUBBER : S.ACCENT, skin: C, m: F }); }
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  for (let i = 0; i < 7; i++) { const y = .9 + i * .085; stud(m, y < .99 ? skirt(0, y, .0072) : smock(0, y, .0072), [0, 0, -1], { skin: y < .99 ? B.PEL : torsoSkin, r: .0048, slot: S.PLATE2 }); }
  for (const s of [-1, 1]) stitchLine(m, Array.from({ length: 10 }, (_, i) => smock(s * .09, lerp(1.0, 1.46, i / 9), .007)), { skin: torsoSkin, n: 30, slot: S.CLOTH2 });
  // taped seams: raised strips along the shoulder and side seams
  for (const s of [-1, 1]) { m.tube(Array.from({ length: 8 }, (_, i) => smock(s * lerp(1.5, 1.6, i / 7), lerp(1.0, 1.42, i / 7), .0015)), .0035, { slot: S.CLOTH2, skin: torsoSkin, sides: 3, flat: .3, n: 14, cap: false });
    m.tube(Array.from({ length: 8 }, (_, i) => leg(s)(s * 1.57, lerp(.25, .95, i / 7), .0015)), .0032, { slot: S.CLOTH, skin: legSkin(s), sides: 3, flat: .3, n: 16, cap: false }); }
  for (const s of [-1, 1]) buckleAt(m, hoodP(s * 2.4, .14, .006), [Math.sin(s * 2.4), 0, -Math.cos(s * 2.4)], { skin: H, w: .014, d: .012, t: .0024 });
}
const DETAIL_PARTS = [detail, m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.PLATE }); }];

// ---------------------------------------------------------------- assembly
const PARTS = [
  head, suit, seals, overboots, kit,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.PLATE, slotToe: S.PLATE, slotRand: S.PLATE, slotSole: S.RUBBER, slotMid: S.PLATE, slotWelt: S.PLATE, slotTongue: S.PLATE, slotPanel: S.PLATE }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.PLATE, slotCuff: S.PLATE, guard: false, cuff: false }); },
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['head', 'suit', 'seals', 'overboots', 'kit', 'boots', 'gloves']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
