// outfit-map-roqueseche.js — FRONT ZÉRO: SOURCIER, the outfit of the Roquesèche map. Original design: the man who goes down into the village's
// cisterns and old drains. A rounded caving helmet with a lamp (a lit lens only: it casts no light), its cable to a battery pack at the back and a
// chin strap; a cotton neckerchief knotted over nose and mouth; a work shirt with rolled cuff tabs under rubber chest waders (bib with a chest
// pocket, elastic braces crossing at the back, wading belt), long rubber gauntlets, a probing pole with a hook slung across the back, a canvas
// bag with a water bottle on the hip. No insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, torsoSkin, legSkin, blend2, buildGlove, buildBoot, buildPouch, buildGloveDetail, stitchLine, buckleAt, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, beltRing, beltMap, softPouch, blouseRows, blouseDisp, beltPin, rowAt, legsFromHips, canteen } from './outfit-maps-lib.js';

export const MAP_ID = 'roqueseche', MAP_NAME = 'Roquesèche';
// ---------------------------------------------------------------- colourways (the map's own palette first; the dark waders keep it readable on pale stone)
const pbr = { cloth: [.9, 0, 0, 1], cloth2: [.92, 0, 0, 1], plate: [.4, .05, 0, 0], plate2: [.4, 0, 0, .03], rubber: [.5, 0, 0, .08], accent: [.88, 0, 0, .7] };
const P = o => ({ pbr, fpKit: 'plain', fpGlove: o.plate2, ...o });       // first-person gloves in the colour of the third-person gloves
const OUT = [
  ['roqueseche', 'Roquesèche', 'Légende', 15000, { cloth: 0x9a8058, cloth2: 0x6a2e22, plate: 0xa8532e, plate2: 0x3c4030, rubber: 0x1d1d1a, metal: 0x8e8c84, accent: 0x4a5236, glow: 0xfff0c8, visor: 0x101214, rim: 0x6a6450, lift: .02 }],
  ['citerne', 'Citerne', 'Épique', 9000, { cloth: 0x5c6a72, cloth2: 0x2a3a48, plate: 0xd0d2cc, plate2: 0x262b2e, rubber: 0x151617, metal: 0x9aa0a4, accent: 0x3a4248, glow: 0xe8f4ff, visor: 0x101214, rim: 0x6a7680, lift: .03 }],
  ['garrigue', 'Garrigue', 'Épique', 9000, { cloth: 0x6e7456, cloth2: 0x8a6a3a, plate: 0x5a6a44, plate2: 0x3a3428, rubber: 0x1c1a16, metal: 0x8a8a7e, accent: 0x4a4430, glow: 0xfff0c0, visor: 0x101214, rim: 0x646a52, lift: .02 }],
  ['terre-cuite', 'Terre cuite', 'Épique', 9000, { cloth: 0x8a4a32, cloth2: 0x3a5a5e, plate: 0x2e2c2a, plate2: 0x4a3226, rubber: 0x1a1614, metal: 0xa08a6a, accent: 0x5a3a28, glow: 0xffe0b0, visor: 0x101214, rim: 0x6a5244, lift: .022 }],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal]) => ({ id: 'sourcier-' + k, setId: 'sourcier', name: 'SOURCIER', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal) }));

const H = B.HEA, C = B.CHE;
// ---------------------------------------------------------------- head: caving helmet with its lamp, neckerchief
const rimLat = lon => lerp(.2, -.34, ((1 - Math.cos(lon)) / 2) ** 1.2);
const shell = (lon, lat, off = 0) => headP(lon, lat, .022 + .006 * Math.sin(Math.max(0, lat)) ** 2 + off);
function helmet(m) {
  headBase(m, S.RUBBER);
  const nu = m.seg(36, 14);
  m.grid(nu, m.seg(9, 4), (u, v) => { const lon = u * TAU - Math.PI; return shell(lon, lerp(rimLat(lon), Math.PI / 2, v ** .85)); }, { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 180, out: outH, ao: (x, y) => .8 + .2 * sstep(1.7, 1.79, y) });
  // rolled lip all round the rim, a little wider at the front
  m.grid(nu, m.seg(3, 2), (u, v) => { const lon = u * TAU - Math.PI, l = rimLat(lon), lip = .006 + .006 * Math.max(0, Math.cos(lon)); return shell(lon, l - .02 * Math.sin(v * Math.PI) - .004, lip * Math.sin(v * Math.PI) + .0005); }, { wrapU: true, slot: S.PLATE, skin: H, crease: 70, out: outH });
  m.grid(nu, 1, (u, v) => { const lon = u * TAU - Math.PI, l = rimLat(lon); return headP(lon, l + .002 - .004 * v, lerp(.022, .004, v)); }, { wrapU: true, slot: S.RUBBER, skin: H, crease: 180, out: (x, y, z) => [0, -1, 0], ao: .4 });
  // a raised rib front to back over the crown
  if (m.keep(1)) m.tube(Array.from({ length: 13 }, (_, i) => { const t = lerp(.35, 2.85, i / 12), lat = Math.PI / 2 - Math.abs(t - Math.PI / 2), lon = t < Math.PI / 2 ? 0 : Math.PI; return shell(lon, Math.min(lat, 1.5), .0005); }), .0055, { slot: S.PLATE, skin: H, sides: 6, flat: .45, n: m.seg(18, 7), up: [1, 0, 0] });
  // lamp: housing on a bracket over the brow, a lit lens; battery pack at the back, the cable between them over the side
  const LF = bodyFrame(shell(0, .38, .004), 0, -.38);
  m.box([0, 0, .004], [.03, .02, .012], .004, { slot: S.RUBBER, skin: H, m: LF });
  m.revolve([[.0005, .012], [.017, .012], [.019, .006], [.019, -.012], [.016, -.016]], { sides: m.keep(1) ? 16 : 8, slot: S.RUBBER, skin: H, m: LF.clone().multiply(T(0, .002, .026, Math.PI / 2, 0, 0)), crease: 40 });
  m.revolve([[.0003, .004], [.012, .0034], [.0145, .0005]], { sides: m.keep(1) ? 16 : 8, slot: S.GLOW, skin: H, m: LF.clone().multiply(T(0, .002, .039, Math.PI / 2, 0, 0)), crease: 60 });
  const BF = bodyFrame(shell(Math.PI, .05, .002), Math.PI, .1);
  m.box([0, 0, .014], [.062, .04, .026], .008, { slot: S.RUBBER, skin: H, m: BF });
  m.tube([xf(BF, [.026, .012, .014]), shell(2.4, .4, .006), shell(1.6, .62, .006), shell(.7, .6, .006), xf(LF, [.014, .006, .012])], .0028, { slot: S.RUBBER, skin: H, sides: 4, n: m.seg(20, 6) });
  // chin strap with its buckle
  for (const s of [-1, 1]) m.tube([shell(s * 1.45, rimLat(s * 1.45) + .02, -.002), headP(s * 1.2, -.5, .006), headP(s * .5, -.98, .012)], .0042, { slot: S.RUBBER, skin: H, sides: 4, flat: .3, n: m.seg(8, 4), up: [0, 0, 1] });
  // neckerchief: a triangle over nose and mouth, its point down over the throat, knotted at the nape
  m.grid(m.seg(24, 9), m.seg(10, 5), (u, v) => {
    const lon = lerp(-1.85, 1.85, u), al = Math.abs(lon), top = -.1 + .14 * sstep(.6, 1.6, al), fold = m.lod === 2 ? 0 : 1;
    if (v <= .5) { const lat = lerp(top, -.86, v / .5); return headP(lon, lat, .0095 + .003 * fold * Math.sin(lon * 6 + lat * 4) * sstep(-.3, -.7, lat)); }
    const k = (v - .5) / .5, q0 = headP(lon, -.86, .0095), side = sstep(.5, 1.5, al), pt = Math.max(0, 1 - al / .9);       // below the chin: a drape down to the collar, pointed at the front
    const q1 = [Math.sin(lon) * lerp(.06, .105, side) / Math.max(Math.abs(Math.sin(lon)), .3) * Math.min(1, Math.abs(Math.sin(lon)) * 3.5), lerp(1.48, 1.5, side) - .045 * pt * pt, -Math.cos(lon) * lerp(.125, .03, side) - .006 * pt];
    const sk = sstep(0, 1, k); return [lerp(q0[0], q1[0], sk), lerp(q0[1], q1[1], k) - .01 * Math.sin(k * Math.PI), lerp(q0[2], q1[2], sk ** .8) - .012 * Math.sin(k * Math.PI) * Math.cos(lon) - fold * .004 * Math.sin(lon * 7) * Math.sin(k * Math.PI)];
  }, { slot: S.CLOTH2, skin: (x, y) => y > 1.58 ? [H, 1] : blend2(B.NEC, H, y, 1.55, .03), crease: 180, out: (x, y, z) => [x, y > 1.6 ? 0 : .3, z + .004], ao: (x, y) => .72 + .28 * sstep(1.5, 1.6, y) });
  if (m.keep(1)) m.tube(Array.from({ length: 15 }, (_, i) => { const lon = lerp(-1.8, 1.8, i / 14); return headP(lon, -.1 + .14 * sstep(.6, 1.6, Math.abs(lon)) + .01, .0105); }), .0026, { slot: S.CLOTH2, skin: H, sides: 4, n: m.seg(20, 7) });
  m.ell([0, 0, 0], [.022, .016, .016], { slot: S.CLOTH2, skin: H, nu: 10, nv: 6, m: T(...headP(Math.PI, -.36, .014)) });
  for (const s of [-1, 1]) padSweep(m, [headP(Math.PI + s * .12, -.42, .016), [s * .02, 1.56, .095], [s * .03, 1.52, .105]], .022, .004, (x, y, z) => [x * .3, 0, z], { slot: S.CLOTH2, skin: (x, y) => y > 1.57 ? [H, 1] : blend2(B.NEC, H, y, 1.55, .02), k: 8, e: 3, puff: .3, step: .02 });
}

// ---------------------------------------------------------------- shirt (arms and collar show above the waders)
const SH = [[1.2, .17, .122, 0], [1.26, .174, .124, 0], [1.32, .186, .13, 0], [1.39, .191, .132, .002], [1.435, .183, .125, .005], [1.465, .157, .111, .006], [1.49, .119, .095, .005], [1.512, .091, .083, .004]];
const shDisp = (a, y) => .02 * Math.sin(a * 4 + y * 12) * bump(y, 1.36, .1) * Math.max(0, -Math.cos(a)) + .009 * Math.sin(a * 5 + y * 18);
const shirt = garmentMap(SH, { e: 2.5, disp: shDisp });
const SLR = [[.95, .052], [.96, .06], [1.0, .061], [1.06, .062], [1.12, .064], [1.16, .065], [1.2, .066], [1.26, .069], [1.34, .074], [1.4, .077], [1.43, .075], [1.455, .066], [1.474, .048], [1.486, .022]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .025 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12) + .06 * Math.sin(y * 120 + a) * bump(y, 1.0, .045);
const sleeve = s => garmentMap(SLR, { e: 2.05, cx: s * .2, disp: slDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
function shirtBody(m) {
  garment(m, SH, { n: 28, e: 2.5, disp: shDisp, slot: S.CLOTH, skin: torsoSkin, sub: 2, capA: true, out: (x, y, z) => [x, y > 1.46 ? .6 : y < 1.25 ? -.4 : 0, z], ao: foldAo(shDisp) });
  garment(m, [[1.465, .095, .088, .006], [1.5, .088, .082, .006], [1.52, .086, .08, .006]], { n: 24, e: 2.2, slot: S.CLOTH, skin: (x, y) => blend2(C, B.NEC, y, 1.51, .03), out: (x, y, z) => [x, 0, z], ao: .85 });
  for (const s of [-1, 1]) {
    elbowLiner(m, s, SLR, S.CLOTH);
    garment(m, SLR, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .96 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    // the sleeve rolled to mid-forearm over the gauntlet: a thick turned band
    padSweep(m, Array.from({ length: 25 }, (_, i) => sleeve(s)(i / 24 * TAU, .984, .001)), .044, .017, (x, y, z) => [x - s * .2, 0, z], { slot: S.CLOTH, skin: s < 0 ? B.FAL : B.FAR, e: 2.3, puff: .35, ends: false, k: 14, step: .012 });
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), 1.3, .034, { n: 16, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: (x, y, z) => [x - s * .2, 0, z] });
    // long rubber gauntlet: flared cuff from the wrist to mid-forearm
    m.revolve([[.0525, .02], [.057, -.012], [.061, -.04], [.0645, -.056], [.0663, -.0625], [.0662, -.0668], [.0638, -.0692], [.0608, -.0672], [.0592, -.0605], [.0575, -.048]], { sides: m.keep(1) ? 28 : 9, slot: S.PLATE2, skin: (x, y) => blend2(s < 0 ? B.HAL : B.HAR, s < 0 ? B.FAL : B.FAR, y, .89, .03), m: T(s * .2, .885, 0, Math.PI, 0, 0, 1, 1, 1.04), crease: 80 });
  }
}

// ---------------------------------------------------------------- chest waders: bib, braces, wading belt, legs with their boots
const BELT = [1.06, .176, .132, { w: .042, t: .0075, sag: .009, cz: .0, e: 2.25 }], belt = beltMap(...BELT);
const WD0 = [[.84, .17, .132, .004], [.9, .18, .138, .004], [.97, .181, .139, .003], [1.03, .178, .134, 0], [1.09, .172, .129, 0], [1.16, .175, .13, 0], [1.24, .19, .138, 0], [1.3, .197, .142, 0], [1.315, .195, .14, 0]];
const WD = blouseRows(WD0, BELT[0], BELT[1], BELT[2], BELT[3].w, .005, BELT[3]), blouse = blouseDisp(BELT[0], BELT[3].w, .045), PIN_WD = beltPin(BELT, .0015, { above: .0015 });
{ const w0 = WD.warp; WD.warp = (a, y) => (w0 ? w0(a, y) : 0) - .075 * Math.sin(a) ** 2 * sstep(1.18, 1.315, y); }       // the bib's top edge is cut low under the arms
const wdDisp = (a, y) => blouse(a, y) + .03 * Math.sin(a * 9 + .4) * bump(y, BELT[0] - BELT[3].w / 2 - .018, .016) +       // gathered above and below the wading belt, never through it
  .02 * Math.sin(a * 3 + y * 9) * sstep(1.12, 1.25, y) + .012 * Math.sin(a * 6 - y * 14);
const wader = garmentMap(WD, { e: 2.25, disp: wdDisp, pin: PIN_WD });
// the bib down to the belt; below it the waders are one surface with the legs (legsFromHips), joined under the belt
const Y_JOIN = 1.05, WD_TOP = [rowAt(WD, Y_JOIN), ...WD.filter(r => r[0] > Y_JOIN + .002)]; WD_TOP.warp = WD.warp;
const LG = [[.17, .072], [.2, .079], [.26, .083], [.33, .084], [.4, .082], [.47, .084], [.52, .086], [.57, .088], [.65, .095], [.75, .104], [.85, .11], [.93, .106], [.985, .09]].map(r => [r[0], r[1], r[1] * 1.05, r[0] > .6 ? .004 : .004]);
const lgDisp = (a, y) => .06 * Math.sin(y * 70 + a * 2) * bump(y, .27, .08) + .06 * Math.sin(y * 110) * bump(y, .5, .07) * Math.max(0, -Math.cos(a)) ** 1.2 + .03 * Math.sin(a * 2 + y * 12) * bump(y, .8, .15) + .015 * Math.sin(a * 3 + y * 9);
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp });
function waders(m) {
  garment(m, WD_TOP, { n: 30, e: 2.25, disp: wdDisp, pin: PIN_WD, slot: S.PLATE2, skin: torsoSkin, sub: 2, out: (x, y, z) => [x, 0, z], ao: foldAo(wdDisp) });
  legsFromHips(m, { hip: (a, y) => wader(a, y), yTop: Y_JOIN, yCrotch: .9, yThigh: .76, LG, e: 2.1, lgDisp, n: 30, folds: .03, slot: S.PLATE2, ao: (x, y, z) => .78 + .22 * sstep(.2, .4, y) });
  // chest-high top edge: a thick rolled lip, a stitched band under it
  m.tube(Array.from({ length: 41 }, (_, i) => wader(i / 40 * TAU, 1.313, .0052)), .0068, { slot: S.PLATE2, skin: torsoSkin, sides: m.keep(1) ? 8 : 5, n: m.seg(48, 16), cap: false });
  if (m.keep(0)) stitchLine(m, Array.from({ length: 41 }, (_, i) => wader(i / 40 * TAU, 1.292, .0012)), { skin: torsoSkin, n: 90, slot: S.PLATE2 });
  // chest pocket with its zip, knee reinforcements
  panel(m, (u, v, h) => wader(u, v, h + .002), -.4, .4, 1.17, 1.29, { t: .005, nu: 6, nv: 4, slot: S.PLATE2, skin: torsoSkin, edge: .12, round: .3, out: (x, y, z) => [x, 0, z] });
  if (m.keep(1)) m.tube(Array.from({ length: 7 }, (_, i) => wader(lerp(-.34, .34, i / 6), 1.275, .0078)), .0018, { slot: S.METAL, skin: torsoSkin, sides: 3, n: 10, cap: false });
  if (m.keep(0)) stitchLine(m, [[-.36, 1.25], [-.37, 1.21], [-.355, 1.18], [0, 1.176], [.355, 1.18], [.37, 1.21], [.36, 1.25]].map(([a, y]) => wader(a, y, .0072)), { skin: torsoSkin, n: 60, slot: S.PLATE2 });
  // welded side seams down the outer legs (hips -> thighs as legsFromHips does)
  if (m.keep(1)) for (const s of [-1, 1]) m.tube(Array.from({ length: 22 }, (_, i) => { const y = lerp(1.03, .3, i / 21), w = sstep(.95, .76, y), H = wader(s * Math.PI / 2, y, .0016), L = leg(s)(s * Math.PI / 2, y, .0016); return [lerp(H[0], L[0], w), y, lerp(H[2], L[2], w)]; }), .0021, { slot: S.PLATE2, skin: (x, y) => y > .9 ? torsoSkin(x, y) : legSkin(s)(x, y), sides: 5, n: m.seg(30, 10), cap: false });
  for (const s of [-1, 1]) { const sk = (px, py) => blend2(s < 0 ? B.SHL : B.SHR, s < 0 ? B.THL : B.THR, py, .53, .04), o = (x, y, z) => [x - s * .1, 0, z];
    panel(m, (u, v, h) => leg(s)(u, v, h + .0015), -1.15, 1.15, .45, .6, { t: .0045, nu: 9, nv: 6, slot: S.RUBBER, skin: sk, edge: .12, round: .5, dome: .003, out: o });
    panel(m, (u, v, h) => leg(s)(u, v, h + .0015), -.9, .9, .25, .43, { t: .0038, nu: 7, nv: 6, slot: S.RUBBER, skin: sk, edge: .12, round: .45, dome: .0015, out: o }); }
  // braces: from the bib top, over the shoulders, crossing at the back, down to the back of the waders
  for (const s of [-1, 1]) strapAlong(m, [wader(s * .5, 1.3, .009), shirt(s * .52, 1.38, .009), shirt(s * .66, 1.455, .006), shirt(s * 1.55, 1.505, .008), shirt(s * 2.45, 1.45, .006), shirt(-s * (Math.PI - .25), 1.36, .008), wader(-s * (Math.PI - .5), 1.26, .006)], .04, .0045, (x, y, z) => [x, y > 1.47 ? 1 : 0, z], { slot: S.RUBBER, skin: torsoSkin, n: m.seg(26, 8) });
  if (m.keep(1)) for (const s of [-1, 1]) { const F = bodyFrame(shirt(s * .55, 1.405, .013), s * .55); m.box([0, 0, .002], [.048, .03, .005], .0022, { slot: S.METAL, skin: torsoSkin, m: F }); m.box([0, 0, .0052], [.03, .006, .0025], .001, { slot: S.RUBBER, skin: torsoSkin, m: F }); }
  // wading belt
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.ACCENT, metal: S.RUBBER, latchSlot: S.PLATE2, skin: (x, y) => blend2(B.PEL, B.SPI, y, 1.06, .04), buckle: 'sr', keepers: [-.6, .6], se: 3 });
}

// ---------------------------------------------------------------- probing pole across the back, bag and bottle on the hip
function kit(m) {
  // pole: aluminium tube with grip tape, a hook at its top end, slung on two straps
  const a = [-.17, .86, .19], b = [.17, 1.62, .2], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], pt = t => [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
  m.tube([pt(0), pt(.5), pt(1)], .011, { slot: S.METAL, skin: C, sides: m.keep(1) ? 8 : 5, n: m.seg(8, 3), cap: true });
  if (m.keep(1)) m.tube([pt(.08), pt(.2)], .0125, { slot: S.RUBBER, skin: C, sides: 8, n: 3 });
  m.tube([pt(1), [b[0] + .015, b[1] + .045, b[2] + .004], [b[0] + .05, b[1] + .055, b[2] + .006], [b[0] + .06, b[1] + .025, b[2] + .006], [b[0] + .045, b[1] + .005, b[2] + .005]], t => lerp(.007, .004, t), { slot: S.METAL, skin: C, sides: m.keep(1) ? 6 : 4, n: m.seg(10, 4), cap: true });
  for (const t of [.3, .72]) { const p = pt(t), w = [-d[1], d[0], 0], l = Math.hypot(w[0], w[1]); m.tube([[p[0] - w[0] / l * .03, p[1] - w[1] / l * .03, p[2] - .016], [p[0], p[1], p[2] + .016], [p[0] + w[0] / l * .03, p[1] + w[1] / l * .03, p[2] - .016]], .0035, { slot: S.ACCENT, skin: C, sides: 4, flat: .4, n: 5 }); }
  // soft bag on the right hip, water bottle in its cover on the left hip
  strapAlong(m, [wader(1.62, 1.02, .02), wader(1.15, 1.13, .016), wader(.45, 1.24, .016), shirt(-.25, 1.36, .018), shirt(-.6, 1.46, .016), shirt(-1.35, 1.512, .016), shirt(-2.25, 1.46, .016), shirt(-2.85, 1.33, .02), wader(2.75, 1.2, .018), wader(2.1, 1.06, .018), wader(1.85, 1.02, .02)], .03, .004, (x, y, z) => [x, y > 1.48 ? 1 : 0, z], { slot: S.ACCENT, skin: torsoSkin, n: m.seg(40, 12) });
  softPouch(m, .13, .11, .05, bodyFrame(wader(1.7, .955, .004), 1.7), { slot: S.ACCENT, flapSlot: S.ACCENT, skin: B.PEL, flap: .5, tab: true, tabSlot: S.METAL, bulge: .22 });
  { const a2 = -1.6, w = BELT[3].w; canteen(m, bodyFrame(wader(a2, .935, .004), a2), { r: .033, h: .125, slot: S.ACCENT, flaskSlot: S.RUBBER, capSlot: S.METAL, skin: B.PEL, hang: [belt(a2, .0022, -w / 2 - .004), belt(a2, .003, 0), belt(a2, .0022, w / 2 + .003), belt(a2, -.003, w / 2 + .008)] }); }
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  // helmet: rivets of the chin strap, vent slots; neckerchief hem
  for (const s of [-1, 1]) { const p = shell(s * 1.45, rimLat(s * 1.45) + .05, .001); stud(m, p, [s, .2, 0], { skin: H, r: .0045 }); for (let k = 0; k < 3; k++) m.box([0, 0, 0], [.012, .0025, .004], .001, { slot: S.RUBBER, skin: H, m: T(...shell(s * (.9 + k * .22), .95, .001), 0, -s * (.9 + k * .22), 0) }); }
  stitchLine(m, Array.from({ length: 13 }, (_, i) => { const lon = lerp(-1.7, 1.7, i / 12), w = 1 - Math.abs(lon) / 1.9; return headP(lon, -.95 - .5 * w ** 1.6 + .04, .0112); }), { skin: (x, y) => y > 1.58 ? [H, 1] : blend2(B.NEC, H, y, 1.55, .03), n: 30, slot: S.CLOTH2 });
  // waders: brace buckles at the bib, seam down the front, boot ribs
  for (const s of [-1, 1]) buckleAt(m, wader(s * .5, 1.335, .01), [Math.sin(s * .5), .2, -Math.cos(s * .5)], { skin: torsoSkin, w: .034, d: .02 });
  stitchLine(m, Array.from({ length: 12 }, (_, i) => wader(0, lerp(.9, 1.16, i / 11), .0016)), { skin: torsoSkin, n: 26, slot: S.PLATE2 });
  // shirt: collar buttons
  for (const s of [-1, 1]) stud(m, shirt(s * .3, 1.44, .003), [Math.sin(s * .3), 0, -1], { skin: torsoSkin, r: .0038, slot: S.CLOTH });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.PLATE2 }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  helmet, shirtBody, waders, kit,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.PLATE2, slotToe: S.PLATE2, slotRand: S.PLATE2, slotSole: S.RUBBER, slotMid: S.RUBBER, slotWelt: S.RUBBER, slotTongue: S.PLATE2, slotPanel: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.PLATE2, slotCuff: S.PLATE2, slotKnuckle: S.PLATE2, guard: false, cuff: false }); },
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['helmet', 'shirt', 'waders', 'kit', 'boots', 'gloves']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
