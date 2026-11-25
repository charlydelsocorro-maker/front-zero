// outfit-map-cite.js — FRONT ZÉRO: ÉCARTEUR, the outfit of the Cité Verrière map. Original design: the breaching and demolition operator who opens a
// way through the collapsed towers of the glass district. A jet-style rescue helmet over the ears with a raised crest and a short tinted visor that
// stops under the nose (glass-proof), a moulded dust respirator with its valve below it, a knitted hood; a dust-caked one-piece suit with darker
// reinforcements, bloused over a rigger belt with a quick-release buckle; a low chest rig with three pouches and a radio; hard-shell elbow and knee pads;
// cut-resistant gauntlets; a hydraulic spreader-cutter carried diagonally on the back on its sling; a pry bar and a tool pouch on the belt.
// No police or brand marking, no insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import * as THREE from 'three';
import { BONE as B, SLOT as S, T, torsoSkin, legSkin, blend2, buildGlove, buildBoot, buildBootDetail, stitchLine, panel, strapAlong, planeMap, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, rowAt, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, beltRing, beltMap, blouseRows, blouseDisp, beltPin, legsFromHips, softPouch, radio } from './outfit-maps-lib.js';

export const MAP_ID = 'cite', MAP_NAME = 'Cité Verrière';
// ---------------------------------------------------------------- colourways (the map's own palette first: concrete dust, smoked glass, steel; the
// dust is the shader's run-off pattern in a pale tone, heavier low down; dark rims and a low lift so the pale dust does not wash the figure out)
const pbr = { cloth: [.92, 0, 0, .9], cloth2: [.88, 0, 0, .8], plate: [.46, .05, 0, 0], plate2: [.82, 0, 0, .6], rubber: [.66, 0, 0, .12], metal: [.36, .62, 0, 0], accent: [.5, .05, .06, .1], visor: [.05, .6, .02, 0] };
const P = (o, dust, dust2) => ({ pbr, fpKit: 'plain', fpGlove: o.rubber, pattern: { type: 5, scale: 7, strength: .72, a: dust, b: dust2 }, ...o });
const OUT = [
  // from the map's own palette: concrete greys under warm haze dust, soot reinforcements, spandrel-glass helmet and blue-grey visor, site yellow on the tool
  ['verriere', 'Verrière', 'Légende', 15000, { cloth: 0x45474a, cloth2: 0x1f1e1c, plate: 0x3a4650, plate2: 0x26292c, rubber: 0x18191a, metal: 0x9ea4a8, accent: 0xd4a32a, glow: 0xd8f4ff, visor: 0x5e7078, rim: 0x33383c, lift: .012, floor: .01 }, 0x9a8f78, 0x4a4640],
  ['gravats', 'Gravats', 'Épique', 9000, { cloth: 0x473f37, cloth2: 0x38312a, plate: 0xd2aa2e, plate2: 0x2c2a26, rubber: 0x181716, metal: 0x9c9a94, accent: 0x3a6ea0, glow: 0xfff0c8, visor: 0x3c3a30, rim: 0x3a342e, lift: .012, floor: .01 }, 0x857a68, 0x4e473d],
  ['suie', 'Suie', 'Épique', 9000, { cloth: 0x2e2f31, cloth2: 0x1d1e20, plate: 0x3c3f43, plate2: 0x222325, rubber: 0x141414, metal: 0x96989c, accent: 0xd4bc3a, glow: 0xfff6d0, visor: 0x2a2e30, rim: 0x36383a, lift: .014, floor: .01 }, 0x5c5a54, 0x3e3d3a],
  ['signal', 'Signal', 'Épique', 9000, { cloth: 0x76321a, cloth2: 0x2a2a2a, plate: 0xd4cec0, plate2: 0x262626, rubber: 0x161616, metal: 0xa0a2a4, accent: 0xdcc030, glow: 0xffe8c0, visor: 0x3a3a3e, rim: 0x4a3028, lift: .012, floor: .01 }, 0x8e765f, 0x433d38],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal, d1, d2]) => ({ id: 'ecarteur-' + k, setId: 'ecarteur', name: 'ÉCARTEUR', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal, d1, d2) }));

const H = B.HEA, C = B.CHE, P2 = B.PEL;
// ---------------------------------------------------------------- head: knitted hood, dust respirator, jet helmet with crest, short visor, side light
const faceF = (lon, lat) => (lon / .78) ** 2 + ((lat + .3) / .66) ** 2;
const rimLat = lon => { const A = Math.abs(lon); return A < .95 ? .27 : A < 1.42 ? lerp(.27, -.48, sstep(.95, 1.42, A)) : lerp(-.48, -.62, sstep(1.42, Math.PI, A)); };
const crest = (lon, lat) => .0062 * Math.exp(-((Math.sin(lon) * Math.cos(lat) / .075) ** 2)) * sstep(.05, .7, lat);
const shell = (lon, lat, off = 0) => headP(lon, lat, .024 + .006 * Math.sin(Math.max(0, lat)) ** 2 + crest(lon, lat) + off);
const vOff = (lon, lat) => (.014 + .026 * sstep(.3, -.2, lat)) * (1 - .5 * sstep(.75, 1.3, Math.abs(lon)));
const vBot = lon => lerp(-.22, -.08, sstep(.2, 1.3, Math.abs(lon)));
const visor = (u, v, h = 0) => { const lon = lerp(-1.3, 1.3, u), lat = lerp(.3, vBot(lon), v); return headP(lon, lat, vOff(lon, lat) + .006 * Math.cos(lon) ** 2 + h); };
const cupOff = (lon, lat) => .005 + .032 * Math.max(0, 1 - (lon / .8) ** 2 - ((lat + .5) / .38) ** 2) ** .55;
/** Helmet, visor and side light (drawn first: outside in, so the depth test rejects most of the hood under them). */
function headOuter(m) {
  // jet helmet: shell over the ears and the nape, a raised crest, rubber edge round the face opening, the ratchet at the back
  const nu = m.seg(40, 14);
  m.grid(nu, m.seg(11, 4), (u, v) => { const lon = u * TAU - Math.PI; return shell(lon, lerp(rimLat(lon), Math.PI / 2, v ** .85)); }, { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 180, out: outH, ao: (x, y) => .8 + .2 * sstep(1.68, 1.78, y) });
  m.grid(nu, 1, (u, v) => { const lon = u * TAU - Math.PI, l = rimLat(lon); return headP(lon, l + .002 - .006 * v, lerp(.024, .008, v)); }, { wrapU: true, slot: S.RUBBER, skin: H, crease: 180, out: () => [0, -1, 0], ao: .35 });
  m.tube(Array.from({ length: 45 }, (_, i) => { const lon = i / 44 * TAU - Math.PI; return shell(lon, rimLat(lon) + .012, .0012); }), .0042, { slot: S.RUBBER, skin: H, sides: m.keep(1) ? 6 : 4, n: m.seg(56, 18), cap: false });
  if (m.keep(1)) for (const s of [-1, 1]) for (const lat of [.42, .62]) m.tube(Array.from({ length: 7 }, (_, i) => shell(s * lerp(1.7, 2.5, i / 6), lat - .05 * i / 6, .0012)), .0022, { slot: S.RUBBER, skin: H, sides: 4, n: 8, cap: true });
  { const p = shell(Math.PI, -.35, .004); m.revolve([[0, .012], [.016, .011], [.018, .004], [.018, -.004], [.014, -.008]], { sides: m.keep(1) ? 12 : 6, slot: S.RUBBER, skin: H, m: T(p[0], p[1], p[2], Math.PI / 2, 0, 0), crease: 50 }); }
  // the visor: comes out from under the brow of the shell and stops under the nose, a rubber trim along its lower edge
  m.grid(m.seg(20, 8), m.seg(5, 2), (u, v) => visor(u, v), { slot: S.VISOR, skin: H, crease: 180, out: outH });
  m.tube(Array.from({ length: 17 }, (_, i) => visor(i / 16, 1, .0005)), .0032, { slot: S.RUBBER, skin: H, sides: m.keep(1) ? 5 : 3, n: m.seg(22, 8), cap: true });
  for (const s of [-1, 1]) { const p = shell(s * 1.33, -.02, .002); m.revolve([[.0005, .006], [.011, .005], [.012, -.002]], { sides: m.keep(1) ? 10 : 6, slot: S.METAL, skin: H, m: T(p[0], p[1], p[2], 0, 0, -s * Math.PI / 2), crease: 50 }); }
  // small light clipped on the right side of the shell
  { const p = shell(1.75, .18, .012), F = bodyFrame(p, 1.75); m.box([0, 0, .002], [.034, .022, .02], .006, { slot: S.RUBBER, skin: H, m: F.clone().multiply(T(0, 0, 0, 0, -.25, 0)) }); m.box([-.017, 0, .002], [.004, .016, .014], .002, { slot: S.GLOW, skin: H, m: F.clone().multiply(T(0, 0, 0, 0, -.25, 0)) }); }
}
/** The respirator, then the knitted hood that covers the whole head (no bare head is drawn under it). */
function headInner(m) {
  // moulded dust respirator: a cup over nose and mouth, its soft rim, the exhalation valve, two elastic straps
  m.grid(m.seg(16, 7), m.seg(10, 4), (u, v) => { const lon = lerp(-.82, .82, u), lat = lerp(-.9, -.1, v); return headP(lon, lat, cupOff(lon, lat)); }, { slot: S.CLOTH2, skin: H, crease: 180, out: outH, ao: .9 });
  m.tube(Array.from({ length: 29 }, (_, i) => { const t = i / 28 * TAU; return headP(Math.cos(t) * .79, -.5 + Math.sin(t) * .37, .0075); }), .0038, { slot: S.CLOTH2, skin: H, sides: m.keep(1) ? 6 : 4, n: m.seg(36, 12), cap: false });
  { const p = headP(0, -.52, cupOff(0, -.52)), M = T(p[0], p[1], p[2], -Math.PI / 2 + .25, 0, 0);
    m.revolve([[.0, .016], [.012, .015], [.016, .01], [.017, .0], [.015, -.004]], { sides: m.keep(1) ? 14 : 7, slot: S.ACCENT, skin: H, m: M, crease: 50 });
    if (m.keep(1)) for (let k = 0; k < 5; k++) m.box([0, .0165, -.009 + k * .0045], [.02, .002, .0018], .0006, { slot: S.RUBBER, skin: H, m: M }); }
  for (const s of [-1, 1]) for (const lat of [-.28, -.74]) m.tube([headP(s * .8, lat, .008), headP(s * 1.2, lat * .85, .012), headP(s * 1.65, lat * .6 + .05, .013)], .0024, { slot: S.RUBBER, skin: H, sides: 4, flat: .5, n: 6 });
  m.grid(m.seg(32, 12), m.seg(13, 6), (u, v) => { const lon = u * TAU - Math.PI, lat = lerp(-1.25, 1.2, v); if (v < .12) { const q = headP(lon, -1.05, .012); return [q[0] * lerp(1.3, 1, v / .12), lerp(1.47, q[1], v / .12), (q[2] + .006) * lerp(1.25, 1, v / .12) - .006]; } const inner = sstep(1.1, .92, faceF(lon, lat)); return headP(lon, lat, lerp(.011, .002, inner)); }, { wrapU: true, slot: S.CLOTH2, skin: (x, y) => y > 1.585 ? [H, 1] : blend2(B.NEC, H, y, 1.56, .025), crease: 180, out: outH, ao: (x, y) => .7 + .3 * sstep(1.52, 1.64, y) });
}

// ---------------------------------------------------------------- one-piece suit bloused over the rigger belt, reinforcements
const BELT = [.985, .1755, .133, { w: .044, t: .0072, sag: .008, cz: .002, e: 2.3 }], belt = beltMap(...BELT);
const CV0 = [[.84, .173, .134, .004], [.9, .181, .139, .004], [.97, .179, .136, .002], [1.03, .174, .131, 0], [1.09, .169, .126, 0], [1.16, .173, .127, 0], [1.24, .184, .132, 0], [1.32, .193, .136, 0], [1.39, .194, .135, .002], [1.435, .186, .127, .005], [1.465, .159, .113, .006], [1.49, .121, .096, .005], [1.512, .092, .084, .004]];
const CV = blouseRows(CV0, BELT[0], BELT[1], BELT[2], BELT[3].w, .007, BELT[3]), blouse = blouseDisp(BELT[0], BELT[3].w, .05);
const PIN_CV = beltPin(BELT, .0015, { above: .0015 });
const cvDisp = (a, y) => blouse(a, y) + .022 * Math.sin(a * 4 + y * 12) * bump(y, 1.24, .15) * Math.max(0, -Math.cos(a)) + .01 * Math.sin(a * 5 + y * 18);
const suit = garmentMap(CV, { e: 2.3, disp: cvDisp, pin: PIN_CV });
const Y_JOIN = BELT[0], CV_TOP = [rowAt(CV, Y_JOIN), ...CV.filter(r => r[0] > Y_JOIN + .002)]; CV_TOP.warp = CV.warp;
const SLR = [[.93, .057], [.95, .06], [1.0, .062], [1.06, .063], [1.12, .066], [1.16, .067], [1.2, .068], [1.26, .071], [1.34, .076], [1.4, .079], [1.43, .077], [1.455, .068], [1.474, .049], [1.486, .023]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .025 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12) + .018 * Math.sin(y * 120) * bump(y, .97, .04);       // only a light gather where the sleeve goes into the gauntlet
const sleeve = s => garmentMap(SLR, { e: 2.05, cx: s * .2, disp: slDisp });
const LG = [[.19, .074], [.21, .08], [.26, .082], [.33, .082], [.4, .081], [.47, .082], [.52, .083], [.57, .085], [.65, .093], [.75, .103], [.85, .108], [.9, .103], [.94, .092], [.985, .073]].map(r => [r[0], r[1], r[1] * 1.04, .004]);
const lgDisp = (a, y) => .05 * Math.sin(y * 90 + a * 1.5) * bump(y, .24, .06) + .05 * Math.sin(y * 120) * bump(y, .5, .07) * Math.max(0, -Math.cos(a)) ** 1.5 + .03 * Math.sin(a * 2 + y * 14) * bump(y, .76, .14) + .012 * Math.sin(a * 3 + y * 9);
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
function suitBody(m) {
  garment(m, CV_TOP, { n: 28, e: 2.3, disp: cvDisp, pin: PIN_CV, slot: S.CLOTH, skin: torsoSkin, sub: 2, out: (x, y, z) => [x, y > 1.46 ? .6 : 0, z], ao: foldAo(cvDisp) });
  legsFromHips(m, { hip: (a, y) => suit(a, y), yTop: Y_JOIN, yCrotch: .88, yThigh: .76, LG, e: 2.1, lgDisp, n: 28, folds: .028, slot: S.CLOTH, ao: (x, y, z) => .76 + .24 * sstep(.25, .45, y) });
  garment(m, [[1.465, .097, .09, .006], [1.5, .091, .085, .006], [1.535, .089, .083, .006]], { n: 24, e: 2.2, slot: S.CLOTH2, skin: (x, y) => blend2(C, B.NEC, y, 1.51, .03), out: (x, y, z) => [x, 0, z], ao: .85 });
  // zip under a flap, shoulder reinforcements in the darker cloth
  panel(m, (u, v, h) => suit(u, v, h + .002), -.09, .09, 1.02, 1.47, { t: .004, nu: 3, nv: 8, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: .15, out: (x, y, z) => [x, 0, z] });
  for (const s of [-1, 1]) {
    panel(m, (u, v, h) => suit(s * u, v, h + .0015), .55, 2.4, u => 1.36 + .05 * sstep(1.0, 1.9, u), 1.485, { t: .003, nu: 9, nv: 3, slot: S.CLOTH2, skin: torsoSkin, edge: .1, round: .3, out: (x, y, z) => [x, .6, z] });
    const sl = sleeve(s), so = (x, y, z) => [x - s * .2, 0, z];
    elbowLiner(m, s, SLR);
    garment(m, SLR, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), capB: true, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .9 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    // darker forearm reinforcement, team band, a pocket on the left upper arm
    panel(m, (u, v, h) => sl(u, v, h + .0015), -1.4, 1.4, 1.0, 1.08, { t: .0026, nu: 8, nv: 3, slot: S.CLOTH2, skin: s < 0 ? B.FAL : B.FAR, edge: .12, round: .4, out: so });
    bandOn(m, sl, 1.31, .03, { n: 16, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: so });
    if (s < 0) panel(m, (u, v, h) => sl(u, v, h + .002), -.6, .5, 1.24, 1.29, { t: .006, nu: 4, nv: 3, slot: S.CLOTH2, skin: B.UAL, edge: .15, round: .35, out: so });
    // hard-shell elbow pad on its two straps
    panel(m, (u, v, h) => sl(u, v, h + .003), Math.PI - .95, Math.PI + .95, u => 1.095 + .01 * ((u - Math.PI) / .95) ** 2, u => 1.225 - .01 * ((u - Math.PI) / .95) ** 2, { t: .008, nu: 8, nv: 6, slot: S.PLATE, skin: sleeveSkin(s, .09), edge: .16, round: .55, dome: .007, out: so });
    for (const y of [1.085, 1.235]) bandOn(m, sl, y, .016, { n: 14, h0: .0025, t: .003, slot: S.PLATE2, skin: sleeveSkin(s, .09), out: so });
    // knee: a darker patch, a hard cup on a padded base, straps above and below
    const lg = leg(s), TH = s < 0 ? B.THL : B.THR, SH = s < 0 ? B.SHL : B.SHR, kn = (px, py) => blend2(SH, TH, py, .53, .03), lo = (x, y, z) => [x - s * .1, 0, z];
    const kr = (u, v) => .085 + .014 * Math.max(0, 1 - (u / .9) ** 2) * Math.max(0, 1 - ((v - .54) / .075) ** 2);
    panel(m, (u, v, h) => { const r = kr(u, v) + h; return [s * .1 + s * r * Math.sin(u), v, .004 - r * Math.cos(u)]; }, -.95, .95, u => .47 + .012 * (u / .95) ** 2, u => .62 - .018 * (u / .95) ** 2, { t: .009, nu: 9, nv: 7, slot: S.PLATE2, skin: kn, edge: .14, round: .4, dome: .002, out: lo });
    panel(m, (u, v, h) => { const r = kr(u, v) + .009 + h; return [s * .1 + s * r * Math.sin(u), v, .004 - r * Math.cos(u)]; }, -.72, .72, u => .49 + .01 * (u / .72) ** 2, u => .6 - .014 * (u / .72) ** 2, { t: .006, nu: 8, nv: 6, slot: S.PLATE, skin: kn, edge: .16, round: .5, dome: .005, out: lo });
    for (const y of [.455, .64]) bandOn(m, lg, y, .02, { n: 16, h0: .002, t: .0032, slot: S.PLATE2, skin: y > .55 ? TH : SH, out: lo });
    m.tube(Array.from({ length: 21 }, (_, i) => lg(i / 20 * TAU, .196, -.0015)), .0045, { slot: S.CLOTH, skin: s < 0 ? B.SHL : B.SHR, sides: m.keep(1) ? 6 : 4, n: m.seg(24, 8), cap: false });
  }
}

// ---------------------------------------------------------------- rigger belt, chest rig with pouches and radio, pry bar, tool pouch
function rig(m) {
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.PLATE2, metal: S.METAL, latchSlot: S.ACCENT, skin: P2, buckle: 'cobra', keepers: [-.75, .75], loops: [-1.15, 1.15, -2.3, 2.3, Math.PI], loopSlot: S.CLOTH });
  // low chest rig: a padded front panel, an H of shoulder straps, side straps round to the back
  const front = (u, v, h) => suit(u, v, h + .006);
  panel(m, front, -.82, .82, u => 1.115 + .01 * (u / .82) ** 2, u => 1.3 - .02 * (u / .82) ** 4, { t: .013, nu: 12, nv: 5, slot: S.PLATE2, skin: torsoSkin, edge: .12, round: .45, dome: .004, out: (x, y, z) => [x, 0, z] });
  for (const s of [-1, 1]) {
    strapAlong(m, [suit(s * .52, 1.29, .018), suit(s * .55, 1.38, .012), suit(s * .62, 1.45, .011), suit(s * 1.35, 1.5, .012), suit(s * 2.3, 1.45, .011), suit(s * 2.62, 1.35, .011), suit(s * 2.66, 1.17, .012)], .036, .006, (x, y, z) => [x, y > 1.47 ? 1 : 0, z], { slot: S.PLATE2, skin: torsoSkin, n: m.seg(26, 8) });
    strapAlong(m, [suit(s * .8, 1.2, .016), suit(s * 1.2, 1.2, .009), suit(s * 1.7, 1.19, .009), suit(s * 2.25, 1.18, .009), suit(s * 2.7, 1.17, .012)], .03, .005, (x, y, z) => [x, 0, z], { slot: S.PLATE2, skin: torsoSkin, n: m.seg(14, 5) });
  }
  strapAlong(m, [suit(-2.7, 1.17, .012), suit(Math.PI, 1.17, .013), suit(2.7, 1.17, .012)], .03, .005, (x, y, z) => [x, 0, z], { slot: S.PLATE2, skin: torsoSkin, n: 6 });
  for (const [a, w, h] of [[-.46, .072, .088], [0, .066, .09], [.46, .072, .088]]) softPouch(m, w, h, .036, bodyFrame(suit(a, 1.205, .019), a), { slot: S.PLATE2, flapSlot: S.PLATE2, skin: torsoSkin, flap: .4, tab: a === 0, tabSlot: S.ACCENT });
  radio(m, bodyFrame(suit(.6, 1.4, .02), .6, -.05), { w: .044, h: .074, d: .022, skin: C, aerial: .045, keySlot: S.ACCENT });
  // tool pouch on the right hip, pry bar in a loop on the left hip
  softPouch(m, .09, .1, .04, bodyFrame(suit(1.48, .9, .006), 1.48, .06), { slot: S.PLATE2, flapSlot: S.PLATE2, skin: P2, flap: .35 });
  { const a = -1.62, top = belt(a, .014, .03), low = suit(a, .66, .03);
    m.tube([[top[0], top[1] + .03, top[2]], top, [lerp(top[0], low[0], .5), lerp(top[1], low[1], .5), lerp(top[2], low[2], .5)], low], .0085, { slot: S.METAL, skin: (x, y) => blend2(B.THL, P2, y, .86, .05), sides: m.keep(1) ? 8 : 5, n: m.seg(10, 4), cap: true });
    m.tube([[top[0], top[1] + .03, top[2]], [top[0] - .004, top[1] + .05, top[2] - .025], [top[0] - .004, top[1] + .052, top[2] - .045], [top[0] + .004, top[1] + .044, top[2] - .055]], t => lerp(.008, .004, t), { slot: S.METAL, skin: P2, sides: m.keep(1) ? 6 : 4, n: 8, cap: true });
    padSweep(m, Array.from({ length: 13 }, (_, i) => { const t = i / 12 * TAU; return [top[0] + .014 * Math.cos(t), top[1] - .02, top[2] + .014 * Math.sin(t)]; }), .02, .003, (x, y, z) => [x - top[0], 0, z - top[2]], { slot: S.PLATE2, skin: P2, e: 3, k: 6, ends: false, step: .01 }); }
}

// ---------------------------------------------------------------- hydraulic spreader-cutter on the back, and its sling across the chest
const TA = [.125, 1.0, .205], TB = [-.12, 1.445, .2];       // tool axis: hose coupling at the bottom right, jaws at the top left
function tool(m) {
  const Y = new THREE.Vector3(TB[0] - TA[0], TB[1] - TA[1], TB[2] - TA[2]), L = Y.length(); Y.normalize();
  const Z = new THREE.Vector3(0, 0, 1); Z.addScaledVector(Y, -Z.dot(Y)).normalize(); const X = new THREE.Vector3().crossVectors(Y, Z);
  const F = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(TA[0], TA[1], TA[2]), sk = torsoSkin, at = (x, y, z) => xf(F, [x, y * L, z]);
  // cylinder body: coupling, ribbed grip, the ram, the head
  m.revolve([[0, -.03], [.011, -.03], [.012, -.012], [.02, -.008], [.024, .0], [.034, .01], [.036, .05], [.04, .056], [.042, .07], [.042, .25], [.044, .262], [.044, .29], [.036, .3], [.034, .33], [.03, .345]], { sides: m.keep(1) ? 16 : 8, slot: S.ACCENT, skin: sk, m: F, crease: 50, ao: .92 });
  if (m.keep(1)) for (let k = 0; k < 5; k++) m.revolve([[.0365, .012 + k * .008], [.0385, .015 + k * .008], [.0365, .018 + k * .008]], { sides: 14, slot: S.RUBBER, skin: sk, m: F, crease: 70 });
  m.revolve([[.02, -.03], [.021, -.05], [.016, -.056], [0, -.058]], { sides: m.keep(1) ? 10 : 6, slot: S.METAL, skin: sk, m: F, crease: 50 });
  // the carrying handle: a loop bowed off the body, and the control ring
  m.tube([xf(F, [0, .1, .04]), xf(F, [0, .12, .075]), xf(F, [0, .2, .078]), xf(F, [0, .22, .04])], .0085, { slot: S.RUBBER, skin: sk, sides: m.keep(1) ? 8 : 5, n: m.seg(12, 5), cap: true });
  if (m.keep(1)) m.revolve([[.046, .265], [.05, .27], [.05, .282], [.046, .287]], { sides: 16, slot: S.RUBBER, skin: sk, m: F, crease: 60 });
  // two jaws closed tip to tip on a pivot bolt: tapered blades, a hooked tip, a toothed spreading face
  const fz = () => [F.elements[8], F.elements[9], F.elements[10]];
  for (const e of [-1, 1]) {
    const blade = (u, v, h) => xf(F, [u, .335 + v, e * (h + .002)]);
    m.plate([[-.024, 0], [.024, 0], [.022, .05], [.016, .1], [.008, .138], [-.002, .146], [-.01, .118], [-.018, .06]].map(([u, v]) => { const g = e * .14, uu = u * (e > 0 ? 1 : -1); return [uu * Math.cos(g) - v * Math.sin(g), uu * Math.sin(g) + v * Math.cos(g)]; }), blade, { t: .011, bevel: .003, slot: S.METAL, skin: sk, out: () => { const q = fz(); return [q[0] * e, q[1] * e, q[2] * e]; }, round: 1, crease: 45 });
  }
  m.revolve([[0, -.016], [.009, -.016], [.011, -.012], [.011, .012], [.009, .016], [0, .016]], { sides: m.keep(1) ? 12 : 6, slot: S.METAL, skin: sk, m: F.clone().multiply(T(0, .348, 0, Math.PI / 2, 0, 0)), crease: 50 });
  // a short coiled hose stub with its coupler hanging from the bottom
  if (m.keep(1)) m.tube([xf(F, [0, -.05, 0]), xf(F, [.01, -.075, .012]), xf(F, [.03, -.085, .02]), xf(F, [.045, -.07, .02])], .0075, { slot: S.RUBBER, skin: sk, sides: 7, n: 10, cap: true });
  // the sling: from the jaws end over the left shoulder, across the chest rig to the right hip, round to the coupling end
  const top = at(0, .62, .0), bot = at(0, .12, 0);
  strapAlong(m, [[top[0] + .01, top[1], top[2] - .03], suit(-2.4, 1.46, .022), suit(-1.45, 1.505, .022), suit(-.72, 1.45, .024), suit(-.42, 1.36, .03), suit(-.05, 1.28, .034), suit(.35, 1.17, .036), suit(.78, 1.07, .028), suit(1.3, 1.03, .024), suit(1.95, 1.04, .024), [bot[0] + .02, bot[1], bot[2] - .03]], .034, .005, (x, y, z) => [x, y > 1.48 ? 1 : 0, z], { slot: S.CLOTH2, skin: torsoSkin, n: m.seg(40, 12) });
  for (const p of [[top[0] + .01, top[1], top[2] - .03], [bot[0] + .02, bot[1], bot[2] - .03]]) m.box([0, 0, 0], [.03, .022, .012], .004, { slot: S.METAL, skin: sk, m: T(p[0], p[1], p[2]) });
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  for (const s of [-1, 1]) {
    stitchLine(m, Array.from({ length: 14 }, (_, i) => suit(s * .082, lerp(1.03, 1.46, i / 13), .0066)), { skin: torsoSkin, n: 48, slot: S.CLOTH2 });
    stitchLine(m, Array.from({ length: 9 }, (_, i) => leg(s)(s * Math.PI / 2, lerp(.74, .66, i / 8) - .25 * i / 8, .0012)), { skin: legSkin(s), n: 24, slot: S.CLOTH2 });
    for (const y of [1.11, 1.209]) stud(m, sleeve(s)(Math.PI, y, .012), [0, 0, 1], { skin: sleeveSkin(s, .09), r: .0035, slot: S.METAL });
    stud(m, leg(s)(0, .545, .028), [0, 0, -1], { skin: s < 0 ? B.SHL : B.SHR, r: .0042, slot: S.METAL });
  }
  for (let i = 0; i < 7; i++) stud(m, suit(0, .97 + i * .07, .0068), [0, 0, -1], { skin: torsoSkin, r: .0042, slot: S.METAL });
  // screws on the visor pivots, vents on the cup
  for (const s of [-1, 1]) m.revolve([[.0003, .0035], [.004, .002], [.0045, 0]], { sides: 6, slot: S.RUBBER, skin: H, m: T(...headP(s * .45, -.62, cupOff(s * .45, -.62) + .0005), 0, 0, 0) });
}
/** Glove seams up close, without the kit's wrist strap (it would poke through the gauntlet's cuff): finger seams, the palm patch. */
function gloveSeams(m, s, palmSlot) {
  const H = s < 0 ? B.HAL : B.HAR, x = s * .2, zs = [-.037, -.016, .006, .026], lens = [.044, .05, .047, .036];
  for (let i = 0; i < 4; i++) { const z = zs[i], L = lens[i], cu = -s; stitchLine(m, [[x + s * .0138, .8, z + .006], [x + s * .0128, .8 - L * .55, z + .0045], [x + cu * .003, .8 - L * 1.05, z + .003], [x + cu * .024, .8 - L * 1.33, z + .002]], { skin: H, n: 9, r: .0008 }); }
  m.plate([[-.036, -.03], [.036, -.03], [.04, .018], [.024, .034], [-.024, .034], [-.04, .018]], planeMap([x - s * .0265, .84, -.004], [0, 0, 1], [0, 1, 0], s < 0 ? -1 : 1), { t: .0028, bevel: .0012, slot: palmSlot, skin: H, inner: 1 });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) gloveSeams(m, s, S.PLATE2); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.PLATE2 }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  tool, rig, headOuter, headInner, suitBody,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.PLATE2, slotRand: S.PLATE2, slotSole: S.RUBBER, slotMid: S.CLOTH2, slotWelt: S.RUBBER, slotTongue: S.RUBBER, slotPanel: S.CLOTH2 }); },
  m => { for (const s of [-1, 1]) { buildGlove(m, s, { slot: S.RUBBER, slotCuff: S.RUBBER, slotKnuckle: S.PLATE, cuff: false }); m.revolve([[.054, .03], [.062, -.01], [.07, -.05], [.073, -.076], [.0745, -.088], [.07, -.094], [.064, -.072]], { sides: m.keep(0) ? 24 : m.keep(1) ? 14 : 7, slot: S.RUBBER, skin: (x, y) => blend2(s < 0 ? B.HAL : B.HAR, s < 0 ? B.FAL : B.FAR, y, .905, .015), m: T(s * .2, .885, 0, Math.PI, 0, 0, 1, 1, 1.04), crease: 85 }); } },
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['tool', 'rig', 'helmet', 'hood', 'suit', 'boots', 'gloves']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
