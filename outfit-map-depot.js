// outfit-map-depot.js — FRONT ZÉRO: CARAVANIER, the outfit of the Dépôt 7 map. Original design: the convoy logistician of a desert base.
// A long cotton scarf wound round the head in loose turns, its tail drawn over the nose and draped round the neck, dust goggles on a wide strap;
// a field shirt (collar, button placket, buttoned cuffs, pen pocket) under a light chest rig (H harness, three magazine pouches, a clipboard with a load
// sheet, a radio), a hydration bladder on the back with its drinking tube over the shoulder; loose cargo trousers bloused into suede desert boots,
// a rigger belt with a canteen in its cover and a rolled cargo strap with its ratchet. No insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, torsoSkin, armSkin, legSkin, blend2, buildGlove, buildBoot, buildPouch, buildGloveDetail, buildBootDetail, stitchLine, buckleAt, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, lensFrame, beltRing, beltMap, blouseRows, blouseDisp, softPouch, canteen, radio, clipboard, beltPin, legsFromHips } from './outfit-maps-lib.js';

export const MAP_ID = 'depot', MAP_NAME = 'Dépôt 7';
// ---------------------------------------------------------------- colourways (the map's own palette first; dark enough to stand out on sand)
const pbr = { cloth: [.86, 0, 0, 1], cloth2: [.88, 0, 0, .9], plate: [.95, 0, 0, 1], plate2: [.78, 0, 0, .35], rubber: [.6, 0, 0, .12], accent: [.76, 0, 0, .45], visor: [.08, .5, .02, 0] };
const P = o => ({ pbr, fpKit: 'plain', fpGlove: o.accent, ...o });       // first-person gloves in the colour of the third-person gloves
const OUT = [
  ['depot', 'Dépôt', 'Légende', 15000, { cloth: 0x4e4130, cloth2: 0x3a3026, plate: 0x7a3020, plate2: 0x8a6a46, rubber: 0x1f1c19, metal: 0x8b8b84, accent: 0x4d4630, glow: 0x9fe07a, visor: 0x3a2410, rim: 0x6a5a44, lift: .018 }],
  ['tole', 'Tôle', 'Épique', 9000, { cloth: 0x4c5560, cloth2: 0x2e3238, plate: 0x6f8396, plate2: 0x5a4a3a, rubber: 0x18191b, metal: 0x9aa0a6, accent: 0x262a2e, glow: 0x9fdcff, visor: 0x1a2430, rim: 0x6a7480, lift: .025 }],
  ['tranchee', 'Tranchée', 'Épique', 9000, { cloth: 0x4c5034, cloth2: 0x54483a, plate: 0x8a7a58, plate2: 0x6e5236, rubber: 0x1e1d18, metal: 0x8a8a80, accent: 0x3a3d28, glow: 0xd9e07a, visor: 0x2a2410, rim: 0x606448, lift: .016 }],
  ['sirocco', 'Sirocco', 'Épique', 9000, { cloth: 0x3c3630, cloth2: 0x4e4030, plate: 0x9a7438, plate2: 0x3a2c22, rubber: 0x141312, metal: 0xa09070, accent: 0x6a3a26, glow: 0xffc070, visor: 0x2a1a08, rim: 0x6a5a48, lift: .03 }],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal]) => ({ id: 'caravanier-' + k, setId: 'caravanier', name: 'CARAVANIER', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal) }));

// ---------------------------------------------------------------- head: wound scarf, face veil, goggles
const H = B.HEA;
/** One turn of the scarf round the head: a soft rolled band whose front sits at latF and back at latB, its tucked end overlapping its start. */
function turn(m, latF, latB, off, ph, w, th, span = 1) {
  const N = 40, pts = []; for (let i = 0; i <= N; i++) { const t = i / N, lon = Math.PI - .5 + t * (TAU * span + .3), lat = lerp(latF, latB, ((1 - Math.cos(lon)) / 2) ** 1.4) + .02 * Math.sin(lon * 3 + ph), tuck = Math.min(sstep(0, .12, t), sstep(1, .86, t)); pts.push(headP(lon, lat, lerp(.006, off + .004 * t, tuck))); }
  padSweep(m, pts, u => w * (1 + .16 * Math.sin(u * 19 + ph) + .08 * Math.sin(u * 37 - ph)), u => th * (1 + .35 * Math.sin(u * 27 + ph * 2)), outH, { slot: S.PLATE, skin: H, k: 8, e: 2.4, puff: .5, step: .024, ao: (x, y) => .7 + .3 * sstep(1.64, 1.74, y) });
}
const veilTop = lon => -.075 + .13 * sstep(.5, 1.45, Math.abs(lon));
function scarf(m) {
  headBase(m, S.CLOTH2);
  // crown: the scarf laid over the head, soft gathers running back to the knot
  m.grid(m.seg(30, 12), m.seg(7, 3), (u, v) => { const lon = u * TAU - Math.PI, lat = lerp(lerp(-.1, -.48, ((1 - Math.cos(lon)) / 2) ** 1.3), Math.PI / 2, v ** .9), g = (m.lod === 2 ? 0 : 1) * .0032 * Math.sin(lon * 5 + 1) * Math.sin(v * Math.PI) * (.4 + .6 * Math.max(0, -Math.cos(lon))); return headP(lon, lat, .0095 + g + .002 * Math.sin(lat) ** 6); }, { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 180, out: outH, ao: .88 });
  // the knot at the nape, the two short ends tucked under it, and the broad tail hanging down the back
  m.ell([0, 0, 0], [.03, .022, .02], { slot: S.PLATE, skin: H, nu: 10, nv: 6, m: T(...headP(Math.PI, -.3, .022), .3, 0, 0) });
  padSweep(m, [headP(Math.PI, -.42, .02), [0, 1.555, .105], [.004, 1.48, .13], [.006, 1.41, .148]], u => lerp(.07, .11, u), u => lerp(.009, .006, u), (x, y, z) => [x * .3, .1, z], { slot: S.PLATE, skin: (x, y) => y > 1.57 ? [H, 1] : blend2(B.CHE, B.NEC, y, 1.52, .03), k: 10, e: 3.2, puff: .35, step: .02, ao: .85 });
}
function scarfTurns(m) {
  // the rolled edge over the brow, then two looser turns crossing higher at the front
  turn(m, .27, -.4, .016, .3, .042, .0145); turn(m, .6, -.16, .023, 1.9, .05, .011);
}
function scarfVeil(m) {
  // the tail drawn over the nose and mouth, then draped round the neck down to the collar
  const nu = m.seg(30, 10), nv = m.seg(12, 5), fold = m.lod === 2 ? 0 : 1;
  m.grid(nu, nv, (u, v) => {
    const lon = lerp(-1.78, 1.78, u), al = Math.abs(lon), top = veilTop(lon);
    if (v <= .5) { const lat = lerp(top, -.86, v / .5); return headP(lon, lat, .0105 + .0035 * fold * Math.sin(lon * 7 + lat * 4) * sstep(-.2, -.7, lat)); }
    const k = (v - .5) / .5, q0 = headP(lon, -.86, .0105), side = sstep(.6, 1.6, al), y1 = lerp(1.44, 1.48, side), r1x = lerp(.06, .112, side), r1z = lerp(.13, .03, side);
    const q1 = [Math.sin(lon) * (r1x / Math.max(Math.abs(Math.sin(lon)), .25)) * Math.min(1, Math.abs(Math.sin(lon)) * 4), y1 - .018 * Math.cos(lon * 5) * fold * (1 - side), -r1z * Math.cos(lon)];
    const s = sstep(0, 1, k), dr = fold * .007 * Math.sin(lon * 6 + 1.2) * Math.sin(k * Math.PI);
    return [lerp(q0[0], q1[0], s) + dr * Math.sin(lon), lerp(q0[1], q1[1], k) - .012 * Math.sin(k * Math.PI), lerp(q0[2], q1[2], s ** .8) - dr * Math.cos(lon) - .012 * Math.sin(k * Math.PI) * Math.cos(lon)];
  }, { slot: S.CLOTH2, skin: (x, y) => y > 1.58 ? [H, 1] : blend2(B.NEC, H, y, 1.55, .04), crease: 180, out: (x, y, z) => [x, y > 1.6 ? 0 : .3, z + .004], ao: (x, y) => .7 + .3 * sstep(1.46, 1.6, y) });
  if (m.keep(1)) m.tube(Array.from({ length: 17 }, (_, i) => { const lon = lerp(-1.7, 1.7, i / 16); return headP(lon, veilTop(lon) + .01, .0125); }), .0034, { slot: S.CLOTH2, skin: H, sides: 4, n: m.seg(24, 8) });
}
function goggles(m) {
  // dust goggles: two lens housings on a bridge, a wide strap round the head over the scarf
  for (const s of [-1, 1]) {
    const c = headP(s * .4, .07, .038), M = bodyFrame(c, s * .36, -.05);
    lensFrame(m, M, .033, .024, .0065, .017, { slot: S.RUBBER, skin: H, e: 3.6, n: 24, lensZ: .75, bulge: .003, back: .008 });
    if (m.keep(1)) lensFrame(m, M.clone().multiply(T(0, 0, .0095)), .0335, .0245, .0024, .002, { slot: S.METAL, skin: H, e: 3.6, n: 24, lens: false });
  }
  m.tube([headP(-.14, .07, .03), headP(0, .085, .034), headP(.14, .07, .03)], .0045, { slot: S.RUBBER, skin: H, sides: 4, n: 5, flat: .6, up: [0, 1, 0] });
  { const pts = []; for (let i = 0; i <= 24; i++) { const lon = lerp(.7, TAU - .7, i / 24), lat = lerp(.07, -.28, (1 - Math.cos(lon)) / 2); pts.push(headP(lon, lat, .03 + .016 * Math.abs(Math.sin(lon)))); }
    padSweep(m, pts, .03, .0032, outH, { slot: S.RUBBER, skin: H, k: 6, e: 4, puff: 0, step: .02, ends: false }); }
}

// ---------------------------------------------------------------- field shirt
const BELT = [.98, .1745, .1335, { w: .042, t: .0055, sag: .009, cz: .002, e: 2.2 }], belt = beltMap(...BELT);
const SH0 = [[.95, .172, .132, .004], [1.0, .172, .13, .002], [1.05, .166, .125, 0], [1.1, .161, .12, 0], [1.16, .165, .122, 0], [1.24, .178, .128, 0], [1.32, .188, .132, 0], [1.39, .19, .131, .002], [1.435, .182, .124, .005], [1.465, .156, .11, .006], [1.49, .118, .094, .005], [1.512, .09, .082, .004]];
const SH = blouseRows(SH0, BELT[0], BELT[1], BELT[2], BELT[3].w, .009, BELT[3]), blouse = blouseDisp(BELT[0], BELT[3].w, .06);
const PIN_SH = beltPin(BELT, .0045, { above: .0015 }), PIN_TR = beltPin(BELT, .0015);
const shDisp = (a, y) => blouse(a, y) + .02 * Math.sin(a * 4 + y * 12) * bump(y, 1.25, .15) * Math.max(0, -Math.cos(a)) + .008 * Math.sin(a * 5 + y * 18);
const shirt = garmentMap(SH, { e: 2.5, disp: shDisp, pin: PIN_SH });
const SLR = [[.893, .05], [.9, .056], [.95, .057], [1.0, .059], [1.06, .061], [1.12, .063], [1.16, .064], [1.2, .065], [1.26, .068], [1.34, .073], [1.4, .076], [1.43, .074], [1.455, .065], [1.474, .047], [1.486, .022]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .022 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12) + .04 * Math.sin(y * 120) * bump(y, .96, .05);
const sleeve = s => garmentMap(SLR, { e: 2.05, cx: s * .2, disp: slDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
function fieldShirt(m) {
  garment(m, SH, { n: 28, e: 2.5, disp: shDisp, pin: PIN_SH, slot: S.CLOTH, skin: torsoSkin, sub: 2, out: (x, y, z) => [x, y > 1.46 ? .6 : 0, z], ao: foldAo(shDisp) });
  for (const s of [-1, 1]) {
    elbowLiner(m, s, SLR);
    garment(m, SLR, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .9 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    // buttoned cuff, team band, pen pocket on the left sleeve
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), .915, .036, { n: 18, h0: .001, t: .0035, slot: S.CLOTH, skin: s < 0 ? B.FAL : B.FAR, out: (x, y, z) => [x - s * .2, 0, z] });
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), 1.27, .032, { n: 18, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: (x, y, z) => [x - s * .2, 0, z] });
  }
  panel(m, (u, v, h) => sleeve(-1)(u, v, h + .002), -Math.PI / 2 - .55, -Math.PI / 2 + .35, 1.3, 1.4, { t: .005, nu: 5, nv: 4, slot: S.CLOTH, skin: B.UAL, edge: .15, round: .3, out: (x, y, z) => [x + .2, 0, z] });
  // collar band and its points, button placket
  garment(m, [[1.465, .095, .088, .006], [1.5, .088, .082, .006], [1.522, .085, .079, .006]], { n: 24, e: 2.2, slot: S.CLOTH, skin: (x, y) => blend2(B.CHE, B.NEC, y, 1.51, .03), out: (x, y, z) => [x, 0, z], ao: .85 });
  for (const s of [-1, 1]) panel(m, (u, v, h) => shirt(s * u, v, h + .004), .02, .5, u => 1.43 - .07 * (u / .5) ** 1.3 * 0, u => 1.47 + .008 * Math.sin(u * 6), { t: .003, nu: 5, nv: 3, slot: S.CLOTH, skin: (x, y) => blend2(B.CHE, B.NEC, y, 1.5, .03), edge: .15, round: .2, out: (x, y, z) => [x, .3, z] });
  panel(m, (u, v, h) => shirt(u, v, h + .0015), -.07, .07, 1.3, 1.44, { t: .003, nu: 2, nv: 6, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: .1, out: (x, y, z) => [x, 0, z] });
}

// ---------------------------------------------------------------- chest rig, hydration pack
const C = B.CHE;
function rig(m) {
  // front panel and its side straps round the ribs
  panel(m, (u, v, h) => shirt(u, v, h + .003), -.95, .95, 1.11, 1.3, { t: .011, nu: 14, nv: 5, slot: S.ACCENT, skin: torsoSkin, edge: .12, round: .25, out: (x, y, z) => [x, 0, z] });
  for (const s of [-1, 1]) bandOn(m, shirt, 1.155, .034, { a0: s * .92, a1: s * (Math.PI - .5), n: 14, h0: .002, t: .003, slot: S.ACCENT, skin: torsoSkin, out: (x, y, z) => [x, 0, z] });
  // H harness: up from the panel, over the shoulder, down to the pack
  for (const s of [-1, 1]) strapAlong(m, [shirt(s * .55, 1.29, .012), shirt(s * .52, 1.38, .008), shirt(s * .62, 1.45, .006), shirt(s * 1.45, 1.5, .012), shirt(s * 2.35, 1.46, .01), shirt(s * 2.6, 1.38, .03)], .04, .004, (x, y, z) => [x, y > 1.46 ? 1 : 0, z], { slot: S.ACCENT, skin: (x, y) => torsoSkin(x, y), n: m.seg(20, 6) });
  // three magazine pouches, the radio on the right, the clipboard with its load sheet on the left
  for (let i = 0; i < 3; i++) { const a = (i - .6) * .3 + .1; softPouch(m, .06, .098, .032, bodyFrame(shirt(a, 1.205, .014), a), { slot: S.ACCENT, flapSlot: S.ACCENT, skin: C, tab: true, tabSlot: S.RUBBER }); }
  { const a = .98; softPouch(m, .052, .07, .034, bodyFrame(shirt(a, 1.19, .012), a), { slot: S.ACCENT, flapSlot: S.ACCENT, skin: C, flap: .14, tab: false }); radio(m, bodyFrame(shirt(a, 1.235, .016), a), { w: .046, h: .082, d: .026, skin: C, aerial: .06 }); }
  clipboard(m, bodyFrame(shirt(-.62, 1.245, .03), -.62, -.08), { w: .1, h: .135, skin: C, slot: S.RUBBER, sheetSlot: S.PLATE2, lineSlot: S.RUBBER });
  // hydration bladder on the back, its tube over the right shoulder, clipped to the strap, bite valve at the chest
  const back = (u, v, h) => shirt(Math.PI + u, v, h + .006);
  panel(m, back, -.62, .62, 1.07, 1.42, { t: .026, nu: 10, nv: 8, slot: S.ACCENT, skin: C, edge: .14, round: .65, dome: .012, out: (x, y, z) => [x * .3, 0, z] });
  if (m.keep(1)) panel(m, (u, v, h) => back(u, v, h + .03), -.4, .4, 1.11, 1.2, { t: .008, nu: 6, nv: 3, slot: S.ACCENT, skin: C, edge: .15, round: .5, out: (x, y, z) => [0, 0, 1] });
  m.tube([shirt(Math.PI + .2, 1.425, .03), shirt(2.75, 1.47, .016), shirt(2.1, 1.5, .012), shirt(1.3, 1.508, .012), shirt(.75, 1.465, .016), shirt(.56, 1.4, .018), shirt(.5, 1.34, .026)], .0058, { slot: S.RUBBER, skin: (x, y) => torsoSkin(x, y), sides: m.keep(1) ? 6 : 4, n: m.seg(20, 7) });
  m.revolve([[.002, .012], [.0072, .012], [.0082, .004], [.0075, -.01]], { sides: m.keep(1) ? 8 : 5, slot: S.RUBBER, skin: C, m: T(...shirt(.47, 1.315, .03), .15, 0, 0), crease: 40 });
}

// ---------------------------------------------------------------- trousers, belt, canteen, cargo strap
const HP = [[.84, .168, .13, .004], [.9, .177, .136, .004], [.95, .178, .137, .003], [1.0, .177, .135, .002]];
const LG = [[.252, .062], [.268, .07], [.29, .086], [.315, .09], [.345, .086], [.4, .081], [.47, .082], [.52, .083], [.57, .085], [.65, .093], [.75, .103], [.85, .109], [.9, .104], [.94, .092], [.985, .072]].map(r => [r[0], r[1], r[1] * 1.04, r[0] > .6 ? .004 : 0]);
const lgDisp = (a, y) => .09 * Math.sin(a * 7 + y * 40) * bump(y, .31, .05) + .06 * Math.sin(y * 120) * bump(y, .5, .07) * Math.max(0, -Math.cos(a)) ** 1.5 + .035 * Math.sin(a * 2 + y * 14) * bump(y, .78, .15) + .014 * Math.sin(a * 3 + y * 9);
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp, pin: PIN_TR });
const hips = garmentMap(HP, { e: 2.2, pin: PIN_TR });
function trousers(m) {
  legsFromHips(m, { hip: (a, y) => hips(a, y), yTop: 1.0, yCrotch: .86, yThigh: .74, LG, e: 2.1, lgDisp, n: 28, folds: .025, slot: S.CLOTH2, ao: (x, y, z) => .76 + .24 * sstep(.25, .45, y) });       // hips and legs: one surface, gusset and centre seam
  for (const s of [-1, 1]) {
    // cargo pocket on each thigh (the map pocket on the left is the big one), with its flap
    const big = s < 0, TH = s < 0 ? B.THL : B.THR, o = (x, y, z) => [x - s * .1, 0, z];
    panel(m, (u, v, h) => leg(s)(u, v, h + .002), big ? .95 : 1.1, big ? 2.05 : 1.85, big ? .6 : .64, big ? .79 : .76, { t: big ? .016 : .011, nu: 6, nv: 4, slot: S.CLOTH2, skin: TH, edge: .14, round: .4, out: o });
    if (m.keep(1)) panel(m, (u, v, h) => leg(s)(u, v, h + (big ? .017 : .012)), big ? .9 : 1.05, big ? 2.1 : 1.9, big ? .75 : .725, big ? .8 : .77, { t: .005, nu: 6, nv: 2, slot: S.CLOTH2, skin: TH, edge: .15, round: .3, out: o });
  }
  // rigger belt over the waistband
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.ACCENT, skin: B.PEL, buckle: 'cobra', latchSlot: S.ACCENT, keepers: [-.42, .42], loops: [-.75, .75, -1.6, 1.6, -2.45, 2.45, Math.PI], loopSlot: S.CLOTH2 });
  // canteen in its cover on the right hip, hung from the belt
  { const a = 1.85, w = BELT[3].w; canteen(m, bodyFrame(hips(a, .885, .004), a), { r: .044, h: .135, slot: S.CLOTH2, flaskSlot: S.ACCENT, capSlot: S.RUBBER, skin: B.PEL, hang: [belt(a, .0022, -w / 2 - .004), belt(a, .003, 0), belt(a, .0022, w / 2 + .003), belt(a, -.003, w / 2 + .008)] }); }
  // rolled cargo strap with its ratchet on the left hip
  { const a = -1.95, F = bodyFrame(hips(a, .925, .046), a);
    m.revolve([[.0, .026], [.026, .026], [.031, .0245], [.0338, .021], [.0345, .016], [.0345, -.016], [.0338, -.021], [.031, -.0245], [.026, -.026], [0, -.026]], { sides: m.keep(1) ? 18 : 8, slot: S.CLOTH, skin: B.PEL, m: F.clone().multiply(T(0, 0, 0, 0, 0, Math.PI / 2)), crease: 45 });
    m.box([0, .046, -.01], [.016, .036, .006], .002, { slot: S.ACCENT, skin: B.PEL, m: F });
    m.box([.0, -.05, .006], [.05, .03, .016], .0065, { slot: S.METAL, skin: B.PEL, m: F }); m.tube([xf(F, [-.026, -.05, .006]), xf(F, [.026, -.05, .006])], .0042, { slot: S.METAL, skin: B.PEL, sides: m.keep(1) ? 8 : 4, n: 3 });
    if (m.keep(1)) { m.box([.0, -.072, .012], [.012, .03, .006], .002, { slot: S.METAL, skin: B.PEL, m: F }); m.tube([xf(F, [-.02, -.034, .02]), xf(F, [-.022, -.05, .022]), xf(F, [-.02, -.068, .02])], .0035, { slot: S.RUBBER, skin: B.PEL, sides: 4, n: 4, flat: .3 }); } }
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  // scarf: a woven stripe near the edge of the veil; goggle vents
  stitchLine(m, Array.from({ length: 17 }, (_, i) => { const lon = lerp(-1.66, 1.66, i / 16); return headP(lon, veilTop(lon) - .05, .0128); }), { skin: H, n: 40, slot: S.CLOTH2, r: .0013 });
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) m.box([0, 0, 0], [.006, .0024, .003], .0008, { slot: S.METAL, skin: H, m: T(...headP(s * (.27 + k * .07), .17, .036), 0, s * .4, 0) });
  // shirt: buttons down the placket and on the cuffs, collar stitching, pocket flap
  for (let i = 0; i < 3; i++) stud(m, shirt(0, 1.32 + i * .045, .0048), [0, 0, -1], { skin: torsoSkin, r: .0042, slot: S.PLATE2 });
  for (const s of [-1, 1]) { stud(m, sleeve(s)(0, .915, .0052), [0, 0, -1], { skin: s < 0 ? B.FAL : B.FAR, r: .0036, slot: S.PLATE2 }); stitchLine(m, Array.from({ length: 9 }, (_, i) => sleeve(s)(lerp(-1.4, 1.4, i / 8), .935, .0042)), { skin: s < 0 ? B.FAL : B.FAR, n: 18 }); }
  for (const s of [-1, 1]) stitchLine(m, Array.from({ length: 10 }, (_, i) => shirt(s * lerp(.06, .9, i / 9), 1.112, .0145)), { skin: torsoSkin, n: 24 });
  // rig: buckles on the side straps and the harness, bar tacks
  for (const s of [-1, 1]) { buckleAt(m, shirt(s * 1.25, 1.155, .007), [Math.sin(s * 1.25), 0, -Math.cos(s * 1.25)], { skin: torsoSkin, w: .026, d: .018 }); buckleAt(m, shirt(s * .53, 1.36, .016), [Math.sin(s * .53), .1, -Math.cos(s * .53)], { skin: C, w: .03, d: .016 }); }
  // trousers: knee seam, blousing cords
  for (const s of [-1, 1]) stitchLine(m, Array.from({ length: 11 }, (_, i) => leg(s)(lerp(-1.3, 1.3, i / 10), .56, .0035)), { skin: s < 0 ? B.THL : B.THR, n: 22 });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.ACCENT }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.RUBBER }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  scarf, scarfTurns, scarfVeil, goggles, fieldShirt, rig, trousers,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.PLATE2, slotToe: S.PLATE2, slotRand: S.PLATE2, slotSole: S.RUBBER, slotMid: S.RUBBER, slotWelt: S.RUBBER, slotTongue: S.PLATE2, slotPanel: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.ACCENT, slotCuff: S.CLOTH, guard: false, cuff: false }); },
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['head', 'turns', 'veil', 'goggles', 'shirt', 'rig', 'trousers', 'boots', 'gloves']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
