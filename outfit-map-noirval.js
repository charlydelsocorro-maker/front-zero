// outfit-map-noirval.js — FRONT ZÉRO: TORCHÈRE, the outfit of the Raffinerie Noirval map. Original design: the refinery's emergency crew.
// A cap-style hard hat with its rain gutter and a ridge, a clear face shield raised on its pivots, ear muffs folded on the shell, indirect-vent goggles
// over a flame-resistant hood; a flame-resistant coverall (zip under a flap, chest pockets, retro-reflective bands round the chest, arms and legs,
// knee pads), a gas detector clipped high on the chest, a radio on the shoulder strap, an escape-hood pouch and a pipe wrench in a loop on the belt,
// leather gauntlets, boots with a metatarsal guard. No insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, torsoSkin, legSkin, blend2, buildGlove, buildBoot, buildPouch, buildGloveDetail, buildBootDetail, stitchLine, buckleAt, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, beltRing, beltMap, softPouch, radio, blouseRows, blouseDisp, beltPin, rowAt, legsFromHips } from './outfit-maps-lib.js';

export const MAP_ID = 'noirval', MAP_NAME = 'Raffinerie Noirval';
// ---------------------------------------------------------------- colourways (the map's own palette first)
const pbr = { cloth: [.82, 0, 0, .85], cloth2: [.88, 0, 0, .9], plate: [.36, .04, 0, 0], plate2: [.66, 0, 0, .3], rubber: [.6, 0, 0, .15], accent: [.4, .25, .14, 0], visor: [.05, .6, .02, 0] };
const P = o => ({ pbr, fpKit: 'plain', fpGlove: o.plate2, ...o });       // first-person gloves in the colour of the third-person gloves
const OUT = [
  ['noirval', 'Noirval', 'Légende', 15000, { cloth: 0x24384a, cloth2: 0x2a2c30, plate: 0xc8601e, plate2: 0x6a4a30, rubber: 0x18191a, metal: 0xa0a4a8, accent: 0xc4c8c8, glow: 0x9fe07a, visor: 0x8a9aa4, rim: 0x34404c, lift: .012, floor: .01 }],
  ['torchere', 'Torchère', 'Épique', 9000, { cloth: 0xc4561e, cloth2: 0x2e3034, plate: 0xd8d8d0, plate2: 0x5a3e28, rubber: 0x18191a, metal: 0xa0a4a8, accent: 0xc4c8c8, glow: 0x9fe07a, visor: 0x8a9aa4, rim: 0x6a5048, lift: .015 }],
  ['bitume', 'Bitume', 'Épique', 9000, { cloth: 0x2a2b2d, cloth2: 0x1e1f21, plate: 0xd0a82a, plate2: 0x4a3626, rubber: 0x141515, metal: 0x9a9ea2, accent: 0xc8ccd0, glow: 0x9fe07a, visor: 0x8a9aa4, rim: 0x3a3c40, lift: .014, floor: .01 }],
  ['kaki', 'Kaki', 'Épique', 9000, { cloth: 0x6e6448, cloth2: 0x3a3a34, plate: 0xe2e0d8, plate2: 0x5a4430, rubber: 0x181816, metal: 0x9a9a92, accent: 0xc4c8c8, glow: 0x9fe07a, visor: 0x8a9aa4, rim: 0x3e3a2a, lift: .012, floor: .01 }],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal]) => ({ id: 'torchere-' + k, setId: 'torchere', name: 'TORCHÈRE', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal) }));

const H = B.HEA, C = B.CHE;
// ---------------------------------------------------------------- head: FR hood, goggles, hard hat, raised face shield, ear muffs
const faceF = (lon, lat) => (lon / .72) ** 2 + ((lat + .25) / .62) ** 2;
const rimLat = lon => lerp(.3, -.16, ((1 - Math.cos(lon)) / 2) ** 1.2);
const hat = (lon, lat, off = 0) => headP(lon, lat, .026 + .008 * Math.sin(Math.max(0, lat)) ** 2 + .004 * Math.exp(-((Math.sin(lon) / .1) ** 2)) * sstep(.3, 1, lat) + off);
function head(m) {
  headBase(m, S.RUBBER);
  // flame-resistant hood, its face opening framing the goggles and the lower face
  m.grid(m.seg(34, 13), m.seg(14, 6), (u, v) => { const lon = u * TAU - Math.PI, lat = lerp(-1.25, 1.2, v); if (v < .12) { const q = headP(lon, -1.05, .012); return [q[0] * lerp(1.3, 1, v / .12), lerp(1.47, q[1], v / .12), (q[2] + .006) * lerp(1.25, 1, v / .12) - .006]; } const inner = sstep(1.1, .92, faceF(lon, lat)); return headP(lon, lat, lerp(.012, .002, inner)); }, { wrapU: true, slot: S.CLOTH2, skin: (x, y) => y > 1.585 ? [H, 1] : blend2(B.NEC, H, y, 1.56, .025), crease: 180, out: outH, ao: (x, y) => .7 + .3 * sstep(1.52, 1.64, y) });
  if (m.keep(1)) m.tube(Array.from({ length: 29 }, (_, i) => { const t = i / 28 * TAU; return headP(Math.sin(t) * .72, -.25 + Math.cos(t) * .62, .0085); }), .0042, { slot: S.CLOTH2, skin: H, sides: 4, n: m.seg(36, 12), cap: false });
  // the lower face under the hood: a dark mesh dust mask
  m.grid(m.seg(14, 6), m.seg(6, 3), (u, v) => { const lon = lerp(-.7, .7, u), lat = lerp(-.82, -.2, v); return headP(lon, lat, .006 + .01 * Math.max(0, 1 - (lon / .7) ** 2 - ((lat + .5) / .32) ** 2) ** .6); }, { slot: S.RUBBER, skin: H, crease: 180, out: outH, ao: .8 });
  // indirect-vent goggles
  const g = (lon, lat, off) => headP(lon, lat, off + .012 * Math.cos(lon) ** 2);
  m.grid(m.seg(16, 6), m.seg(3, 1), (u, v) => { const lon = lerp(-.95, .95, u); return g(lon, lerp(-.12, .2, v), .022); }, { slot: S.VISOR, skin: H, crease: 180, out: outH });
  for (const lat of [-.14, .22]) m.tube(Array.from({ length: 11 }, (_, i) => g(lerp(-.98, .98, i / 10), lat, .024)), .006, { slot: S.PLATE2, skin: H, sides: 5, n: m.seg(16, 6) });
  for (const s of [-1, 1]) m.tube([g(s * .98, -.16, .024), g(s * 1.02, .03, .026), g(s * .98, .24, .024)], .006, { slot: S.PLATE2, skin: H, sides: 5, n: 6 });
  { const pts = []; for (let i = 0; i <= 22; i++) { const lon = lerp(.95, TAU - .95, i / 22); pts.push(headP(lon, lerp(.04, .0, (1 - Math.cos(lon)) / 2), .016)); } padSweep(m, pts, .022, .0025, outH, { slot: S.RUBBER, skin: H, k: 6, e: 4, puff: 0, step: .02, ends: false }); }
  // hard hat: shell with a front peak, rain gutter round the rim, ridges
  const nu = m.seg(36, 14);
  m.grid(nu, m.seg(9, 4), (u, v) => { const lon = u * TAU - Math.PI; return hat(lon, lerp(rimLat(lon), Math.PI / 2, v ** .85)); }, { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 180, out: outH, ao: (x, y) => .82 + .18 * sstep(1.72, 1.8, y) });
  m.grid(nu, m.seg(3, 2), (u, v) => { const lon = u * TAU - Math.PI, l = rimLat(lon), peak = .028 * Math.max(0, Math.cos(lon)) ** 2; const q = hat(lon, l, .004 + (peak + .008) * v); q[1] -= .006 * v * v + .01 * peak * v; return q; }, { wrapU: true, slot: S.PLATE, skin: H, crease: 60, out: outH });
  m.grid(nu, 1, (u, v) => { const lon = u * TAU - Math.PI, l = rimLat(lon); return headP(lon, l + .002 - .004 * v, lerp(.026, .012, v)); }, { wrapU: true, slot: S.RUBBER, skin: H, crease: 180, out: () => [0, -1, 0], ao: .35 });
  if (m.keep(1)) for (const s of [-1, 1]) m.tube(Array.from({ length: 11 }, (_, i) => { const t = lerp(.45, 2.7, i / 10), lat = Math.PI / 2 - Math.abs(t - Math.PI / 2); return hat(t < Math.PI / 2 ? s * .32 : Math.PI - s * .32, Math.min(lat, 1.4), .001); }), .0042, { slot: S.PLATE, skin: H, sides: 5, flat: .5, n: m.seg(16, 6), up: [1, 0, 0] });
  // face shield raised: two pivots on the sides, a frame across the brow, the clear visor tilted up over the peak
  for (const s of [-1, 1]) { const p = hat(s * 1.5, rimLat(s * 1.5) + .1, .004); m.revolve([[.0005, .009], [.014, .008], [.016, .002], [.016, -.004]], { sides: m.keep(1) ? 12 : 6, slot: S.RUBBER, skin: H, m: T(p[0], p[1], p[2], 0, 0, -s * Math.PI / 2), crease: 40 }); }
  const sh = (u, v) => { const lon = lerp(-1.3, 1.3, u), lat = lerp(.62, 1.0, v) - .08 * (lon / 1.3) ** 2; return hat(lon, lat, .012 + .002 * Math.sin(v * Math.PI)); };
  m.grid(m.seg(16, 6), m.seg(3, 1), (u, v) => sh(u, v), { slot: S.VISOR, skin: H, crease: 180, out: outH });
  for (const v of [0, 1]) m.tube(Array.from({ length: 13 }, (_, i) => sh(i / 12, v)), .004, { slot: S.RUBBER, skin: H, sides: 4, flat: .6, n: m.seg(18, 7) });
  for (const s of [-1, 1]) m.tube([sh(s < 0 ? 0 : 1, .5), hat(s * 1.42, .6, .01), hat(s * 1.5, rimLat(s * 1.5) + .1, .006)], .0035, { slot: S.RUBBER, skin: H, sides: 4, n: 5 });
  // ear muffs folded up against the shell
  for (const s of [-1, 1]) { const p = hat(s * 1.7, .3, .016); m.revolve([[.002, .014], [.024, .014], [.03, .008], [.032, -.004], [.028, -.01]], { sides: m.keep(1) ? 16 : 8, slot: S.RUBBER, skin: H, m: T(p[0], p[1], p[2], 0, s * .2, -s * 1.3, 1, 1, 1.2), crease: 40 }); m.tube([hat(s * 1.45, rimLat(s * 1.45) + .06, .002), [p[0] - s * .006, p[1] - .02, p[2] - .012], p], .0035, { slot: S.METAL, skin: H, sides: 4, n: 5 }); }
}

// ---------------------------------------------------------------- coverall with reflective bands
const BELT = [.985, .1755, .133, { w: .042, t: .0058, sag: .008, cz: .002, e: 2.3 }], belt = beltMap(...BELT);
const CV0 = [[.84, .172, .133, .004], [.9, .18, .138, .004], [.97, .178, .135, .002], [1.03, .172, .13, 0], [1.09, .167, .125, 0], [1.16, .171, .126, 0], [1.24, .182, .131, 0], [1.32, .191, .135, 0], [1.39, .192, .134, .002], [1.435, .184, .126, .005], [1.465, .158, .112, .006], [1.49, .12, .096, .005], [1.512, .092, .084, .004]];
const CV = blouseRows(CV0, BELT[0], BELT[1], BELT[2], BELT[3].w, .006, BELT[3]), blouse = blouseDisp(BELT[0], BELT[3].w, .045);
const PIN_CV = beltPin(BELT, .0015, { above: .0015 }), PIN_LG = beltPin(BELT, .004);
const cvDisp = (a, y) => blouse(a, y) + .02 * Math.sin(a * 4 + y * 12) * bump(y, 1.25, .15) * Math.max(0, -Math.cos(a)) + .009 * Math.sin(a * 5 + y * 18);
const coverall = garmentMap(CV, { e: 2.3, disp: cvDisp, pin: PIN_CV });
const Y_JOIN = BELT[0], CV_TOP = [rowAt(CV, Y_JOIN), ...CV.filter(r => r[0] > Y_JOIN + .002)]; CV_TOP.warp = CV.warp;       // joined to the legs under the belt
const SLR = [[.893, .052], [.9, .058], [.95, .06], [1.0, .062], [1.06, .063], [1.12, .065], [1.16, .066], [1.2, .067], [1.26, .07], [1.34, .075], [1.4, .078], [1.43, .076], [1.455, .067], [1.474, .048], [1.486, .022]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .025 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12) + .05 * Math.sin(y * 120) * bump(y, .95, .05);
const sleeve = s => garmentMap(SLR, { e: 2.05, cx: s * .2, disp: slDisp });
const LG = [[.19, .074], [.21, .08], [.26, .082], [.33, .081], [.4, .08], [.47, .081], [.52, .082], [.57, .084], [.65, .092], [.75, .102], [.85, .107], [.9, .102], [.94, .091], [.985, .072]].map(r => [r[0], r[1], r[1] * 1.04, .004]);
const lgDisp = (a, y) => .05 * Math.sin(y * 90 + a * 1.5) * bump(y, .24, .06) + .05 * Math.sin(y * 120) * bump(y, .5, .07) * Math.max(0, -Math.cos(a)) ** 1.5 + .03 * Math.sin(a * 2 + y * 14) * bump(y, .78, .15) + .012 * Math.sin(a * 3 + y * 9);
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
function coverallBody(m) {
  garment(m, CV_TOP, { n: 28, e: 2.3, disp: cvDisp, pin: PIN_CV, slot: S.CLOTH, skin: torsoSkin, sub: 2, out: (x, y, z) => [x, y > 1.46 ? .6 : 0, z], ao: foldAo(cvDisp) });
  legsFromHips(m, { hip: (a, y) => coverall(a, y), yTop: Y_JOIN, yCrotch: .88, yThigh: .76, LG, e: 2.1, lgDisp, n: 28, folds: .025, slot: S.CLOTH, ao: (x, y, z) => .78 + .22 * sstep(.25, .45, y) });
  garment(m, [[1.465, .096, .089, .006], [1.5, .09, .084, .006], [1.53, .088, .082, .006]], { n: 24, e: 2.2, slot: S.CLOTH, skin: (x, y) => blend2(C, B.NEC, y, 1.51, .03), out: (x, y, z) => [x, 0, z], ao: .85 });
  panel(m, (u, v, h) => coverall(u, v, h + .002), -.1, .1, .92, 1.47, { t: .004, nu: 3, nv: 9, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: .15, out: (x, y, z) => [x, 0, z] });
  for (const s of [-1, 1]) {
    panel(m, (u, v, h) => coverall(s * u, v, h + .002), .3, .78, 1.24, 1.36, { t: .007, nu: 5, nv: 4, slot: S.CLOTH, skin: torsoSkin, edge: .14, round: .35, out: (x, y, z) => [x, 0, z] });
    if (m.keep(1)) panel(m, (u, v, h) => coverall(s * u, v, h + .009), .28, .8, 1.33, 1.375, { t: .005, nu: 5, nv: 2, slot: S.CLOTH, skin: torsoSkin, edge: .15, round: .3, out: (x, y, z) => [x, 0, z] });
    elbowLiner(m, s, SLR);
    garment(m, SLR, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .9 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    // reflective bands: two round each arm, one round each leg; team band above them
    for (const y of [1.0, 1.06]) bandOn(m, (a, yy, h) => sleeve(s)(a, yy, h), y, .024, { n: 16, slot: S.ACCENT, skin: s < 0 ? B.FAL : B.FAR, out: (x, y, z) => [x - s * .2, 0, z] });
    for (const y of [.3, .36]) bandOn(m, (a, yy, h) => leg(s)(a, yy, h), y, .026, { n: 18, slot: S.ACCENT, skin: s < 0 ? B.SHL : B.SHR, out: (x, y, z) => [x - s * .1, 0, z] });
    bandOn(m, (a, yy, h) => sleeve(s)(a, yy, h), 1.3, .03, { n: 16, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: (x, y, z) => [x - s * .2, 0, z] });
    // knee pad: a moulded cup on a strap, its dome over the kneecap
    const TH = s < 0 ? B.THL : B.THR, SH = s < 0 ? B.SHL : B.SHR, kr = (u, v) => .083 + .012 * Math.max(0, 1 - (u / .85) ** 2) * Math.max(0, 1 - ((v - .55) / .065) ** 2);
    panel(m, (u, v, h) => { const r = kr(u, v) + h; return [s * .1 + s * r * Math.sin(u), v, .004 - r * Math.cos(u)]; }, -.85, .85, u => .5 + .012 * (u / .85) ** 2, u => .615 - .018 * (u / .85) ** 2, { t: .008, nu: 9, nv: 7, slot: S.PLATE2, skin: (px, py) => blend2(SH, TH, py, .53, .03), edge: .14, round: .35, dome: .003, out: (x, y, z) => [x - s * .1, 0, z] });
    panel(m, (u, v, h) => { const r = .08 + h; return [s * .1 + s * r * Math.sin(u), v, .004 - r * Math.cos(u)]; }, -.75, .75, .43, u => .49 - .01 * (u / .75) ** 2, { t: .006, nu: 7, nv: 3, slot: S.PLATE2, skin: SH, edge: .16, round: .3, out: (x, y, z) => [x - s * .1, 0, z] });
    bandOn(m, (a, yy, h) => leg(s)(a, yy, h), .6, .018, { n: 16, h0: .002, t: .003, slot: S.RUBBER, skin: TH, out: (x, y, z) => [x - s * .1, 0, z] });
  }
  for (const y of [1.17, 1.235]) bandOn(m, coverall, y, .026, { n: 28, slot: S.ACCENT, skin: torsoSkin, out: (x, y, z) => [x, 0, z] });
}

// ---------------------------------------------------------------- belt, detector, radio, escape hood, wrench, metatarsal guards
function kit(m) {
  const P2 = B.PEL;
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.PLATE2, skin: P2, buckle: 'frame', keepers: [-1.1, 1.1], loops: [-.7, .7, -1.6, 1.6, -2.5, 2.5, Math.PI], loopSlot: S.CLOTH });
  // gas detector clipped high on the left chest: a rubber-armoured case, a display, a sensor grille
  { const F = bodyFrame(coverall(-.42, 1.38, .016), -.42, -.1); m.box([0, 0, .016], [.05, .075, .03], .009, { slot: S.PLATE, skin: C, m: F }); m.box([0, .012, .032], [.034, .026, .002], .002, { slot: S.GLOW, skin: C, m: F }); if (m.keep(1)) { m.box([0, -.022, .032], [.03, .016, .002], .002, { slot: S.RUBBER, skin: C, m: F }); m.box([0, .042, .004], [.014, .02, .006], .002, { slot: S.METAL, skin: C, m: F }); } }
  // radio on the right shoulder strap, a short aerial
  radio(m, bodyFrame(coverall(.55, 1.39, .008), .55), { w: .045, h: .074, d: .024, skin: C, aerial: .05 });
  // escape-hood pouch on the left hip (in the hat colour), a tool pouch on the right
  softPouch(m, .1, .085, .048, bodyFrame(coverall(-1.5, .94, .006), -1.5, .08), { slot: S.PLATE, flapSlot: S.PLATE, skin: P2, flap: .42, tab: true, tabSlot: S.RUBBER });
  softPouch(m, .06, .085, .032, bodyFrame(coverall(1.35, .94, .006), 1.35, .08), { slot: S.PLATE2, flapSlot: S.PLATE2, skin: P2 });
  // pipe wrench in a loop at the back right: handle down, jaws up by the belt
  const W = bodyFrame(coverall(2.4, .92, .026), 2.4);
  m.box([0, 0, 0], [.022, .2, .012], .005, { slot: S.METAL, skin: P2, m: W });
  m.box([0, .118, .002], [.05, .036, .018], .006, { slot: S.METAL, skin: P2, m: W });
  m.box([-.016, .148, .002], [.02, .03, .016], .004, { slot: S.METAL, skin: P2, m: W });
  if (m.keep(1)) m.revolve([[.0, .012], [.012, .012], [.012, -.012], [0, -.012]], { sides: 10, slot: S.PLATE, skin: P2, m: W.clone().multiply(T(0, .1, .012, 0, 0, Math.PI / 2)), crease: 50 });
  { const q = belt(2.4, .018); m.box([0, 0, 0], [.03, .05, .005], .002, { slot: S.PLATE2, skin: P2, m: bodyFrame(q, 2.4) }); }
  // metatarsal guards: a moulded shell over each instep
  for (const s of [-1, 1]) panel(m, (u, v, h) => { const k = (u / .046) ** 2, top = .165 + .6 * (v + .015) - .022 * k - .012 * k * k; return [s * .1 + u * (1 + .25 * k), Math.max(.06, top) + h, v + .004]; }, -.046, .046, -.11, -.005, { t: .005, nu: 7, nv: 5, slot: S.PLATE2, skin: s < 0 ? B.FOL : B.FOR, edge: .14, round: .5, dome: .005, out: () => [0, 1, -.45] });
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  for (let i = 0; i < 7; i++) stud(m, coverall(0, .95 + i * .075, .0066), [0, 0, -1], { skin: torsoSkin, r: .0045, slot: S.METAL });
  for (const s of [-1, 1]) { stitchLine(m, Array.from({ length: 12 }, (_, i) => coverall(s * .095, lerp(.93, 1.46, i / 11), .0062)), { skin: torsoSkin, n: 40 }); for (let k = 0; k < 2; k++) m.revolve([[.0045, .025], [.005, -.025]], { sides: 6, slot: k ? S.RUBBER : S.METAL, skin: C, m: T(...coverall(s * (.4 + k * .06), 1.355, .009), 0, 0, 0) }); }
  for (const s of [-1, 1]) for (const lon of [.8, 1.25]) stud(m, hat(s * lon, .02 + rimLat(s * lon) * 0 + .2, .001), [Math.sin(s * lon), .2, -Math.cos(s * lon)], { skin: H, r: .003, slot: S.METAL });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.RUBBER }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  head, coverallBody, kit,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.RUBBER, slotRand: S.RUBBER, slotSole: S.RUBBER, slotMid: S.PLATE2, slotWelt: S.RUBBER, slotTongue: S.RUBBER, slotPanel: S.RUBBER }); },
  m => { for (const s of [-1, 1]) { buildGlove(m, s, { slot: S.PLATE2, slotCuff: S.PLATE2, guard: false, cuff: false }); m.revolve([[.054, .03], [.062, -.01], [.07, -.05], [.074, -.068], [.069, -.073], [.063, -.05]], { sides: m.keep(1) ? 14 : 7, slot: S.PLATE2, skin: (x, y) => blend2(s < 0 ? B.HAL : B.HAR, s < 0 ? B.FAL : B.FAR, y, .905, .015), m: T(s * .2, .885, 0, Math.PI, 0, 0, 1, 1, 1.04), crease: 60 }); } },
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['head', 'coverall', 'kit', 'boots', 'gloves']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
