// outfit-map-val-cendre.js — FRONT ZÉRO: BRÛLIS, the outfit of the Val de Cendre map. Original design: a forest fire crew member of the ash valley.
// A full-brim helmet with goggles strapped round it and a pleated neck shroud hanging from its rim, a bandana over nose and mouth; a buttoned fire
// shirt (two flapped chest pockets, rolled-collar), canvas trousers with a cargo pocket; a line pack on a padded harness (yoke straps, chest strap,
// hip belt) carrying a fire shelter case, two water bottles and a combination axe-hoe tool; leather gloves, tall logger boots.
// No insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, torsoSkin, legSkin, blend2, buildGlove, buildBoot, buildPouch, buildGloveDetail, buildBootDetail, stitchLine, buckleAt, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, beltRing, beltMap, softPouch, blouseRows, blouseDisp, beltPin, legsFromHips } from './outfit-maps-lib.js';

export const MAP_ID = 'val-cendre', MAP_NAME = 'Val de Cendre';
// ---------------------------------------------------------------- colourways (the map's own palette first)
const pbr = { cloth: [.86, 0, 0, .95], cloth2: [.88, 0, 0, .9], plate: [.4, .04, 0, 0], plate2: [.66, 0, 0, .3], rubber: [.62, 0, 0, .15], accent: [.82, 0, 0, .6], visor: [.06, .5, .02, 0] };
const P = o => ({ pbr, fpKit: 'plain', fpGlove: o.plate2, ...o });       // first-person gloves in the colour of the third-person gloves
const OUT = [
  ['val-cendre', 'Val de Cendre', 'Légende', 15000, { cloth: 0xb0682a, cloth2: 0x3e4232, plate: 0x8a2c22, plate2: 0x5a4030, rubber: 0x1b1b1a, metal: 0x9a9a96, accent: 0x4a4c3a, glow: 0xffc070, visor: 0x2a2010, rim: 0x4a3a2a, lift: .012, floor: .01 }],
  ['meleze', 'Mélèze', 'Épique', 9000, { cloth: 0xc89a28, cloth2: 0x2e3a2c, plate: 0xd0d0c8, plate2: 0x4e3828, rubber: 0x181816, metal: 0x9a9a96, accent: 0x3c4434, glow: 0xffc070, visor: 0x2a2010, rim: 0x6a6040, lift: .016 }],
  ['tison', 'Tison', 'Épique', 9000, { cloth: 0x2c2c2e, cloth2: 0x3c3a36, plate: 0xb83a1e, plate2: 0x4a3628, rubber: 0x141414, metal: 0x9a9a9a, accent: 0x5a3a2a, glow: 0xff7a30, visor: 0x2a2010, rim: 0x3a3836, lift: .016, floor: .01 }],
  ['lichen', 'Lichen', 'Épique', 9000, { cloth: 0x6a7a5a, cloth2: 0x4a4034, plate: 0xd8c040, plate2: 0x4a3a2c, rubber: 0x181816, metal: 0x9a9a96, accent: 0x3a4234, glow: 0xffd070, visor: 0x2a2010, rim: 0x3a4432, lift: .012, floor: .01 }],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal]) => ({ id: 'brulis-' + k, setId: 'brulis', name: 'BRÛLIS', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal) }));

const H = B.HEA, C = B.CHE;
// ---------------------------------------------------------------- head: bandana, full-brim helmet, goggles, neck shroud
const rimLat = lon => lerp(.34, -.1, ((1 - Math.cos(lon)) / 2) ** 1.2);
const dome = (lon, lat, off = 0) => headP(lon, lat, .028 + .01 * Math.sin(Math.max(0, lat)) ** 2 + off);
function head(m) {
  headBase(m, S.RUBBER);
  // bandana over nose and mouth, knotted at the nape, its ends hanging
  m.grid(m.seg(28, 10), m.seg(10, 4), (u, v) => { const lon = u * TAU - Math.PI, top = lerp(-.1, -.5, ((1 - Math.cos(lon)) / 2) ** .9), lat = lerp(-1.1, top, v); const q = headP(lon, lat, .009 + .004 * Math.sin(lon * 5 + v * 4) * (1 - v) * (m.lod === 2 ? 0 : 1)); if (lat < -.95) { q[1] -= (-.95 - lat) * .2; } return q; }, { wrapU: true, slot: S.ACCENT, skin: (x, y) => y > 1.585 ? [H, 1] : blend2(B.NEC, H, y, 1.56, .025), crease: 180, out: outH, ao: (x, y) => .72 + .28 * sstep(1.52, 1.62, y) });
  m.ell([0, 0, 0], [.02, .014, .014], { slot: S.ACCENT, skin: H, nu: 10, nv: 6, m: T(...headP(Math.PI, -.42, .016)) });
  // goggles over the eyes, strap round the helmet crown
  const g = (lon, lat, off) => headP(lon, lat, off + .012 * Math.cos(lon) ** 2);
  for (const s of [-1, 1]) { const M = bodyFrame(g(s * .38, .05, .022), s * .34, -.04); m.revolve([[.0005, .004], [.026, .003], [.028, .0], [.028, -.006], [.024, -.009]], { sides: m.keep(1) ? 16 : 8, slot: S.RUBBER, skin: H, m: M.clone().multiply(T(0, 0, 0, Math.PI / 2, 0, 0, 1, 1, .78)), crease: 50 }); m.revolve([[.0005, .006], [.022, .005], [.024, .004]], { sides: m.keep(1) ? 16 : 8, slot: S.VISOR, skin: H, m: M.clone().multiply(T(0, 0, 0, Math.PI / 2, 0, 0, 1, 1, .78)), crease: 60 }); }
  m.tube([g(-.13, .06, .026), g(0, .075, .028), g(.13, .06, .026)], .004, { slot: S.RUBBER, skin: H, sides: 4, n: 5 });
  for (const s of [-1, 1]) m.tube([g(s * .62, .06, .024), headP(s * 1.0, .1, .031), headP(s * 1.4, .22, .036)], .0045, { slot: S.RUBBER, skin: H, sides: 4, flat: .4, n: 6, up: [0, 1, 0] });
  // helmet: dome, a wide brim all round (deeper at the back), a raised ridge, the band where the strap runs
  const nu = m.seg(40, 14);
  m.grid(nu, m.seg(9, 4), (u, v) => { const lon = u * TAU - Math.PI; return dome(lon, lerp(rimLat(lon), Math.PI / 2, v ** .85)); }, { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 180, out: outH, ao: (x, y) => .82 + .18 * sstep(1.74, 1.82, y) });
  const brimW = lon => .036 + .018 * ((1 - Math.cos(lon)) / 2);
  m.grid(nu, m.seg(4, 2), (u, v) => { const lon = u * TAU - Math.PI, b = dome(lon, rimLat(lon), .001), w = brimW(lon) * v, d = [Math.sin(lon), 0, -Math.cos(lon)]; return [b[0] + d[0] * w, b[1] - .014 * v * v - .004 * v, b[2] + d[2] * w * 1.05]; }, { wrapU: true, slot: S.PLATE, skin: H, crease: 60, out: (x, y, z) => [0, 1, 0] });
  m.grid(nu, m.seg(4, 2), (u, v) => { const lon = u * TAU - Math.PI, b = dome(lon, rimLat(lon), .001), w = brimW(lon) * v, d = [Math.sin(lon), 0, -Math.cos(lon)]; return [b[0] + d[0] * w, b[1] - .014 * v * v - .004 * v - .004, b[2] + d[2] * w * 1.05]; }, { wrapU: true, slot: S.PLATE, skin: H, crease: 60, out: (x, y, z) => [0, -1, 0], ao: .5 });
  if (m.keep(1)) m.tube(Array.from({ length: 13 }, (_, i) => { const t = lerp(.4, 2.75, i / 12), lat = Math.PI / 2 - Math.abs(t - Math.PI / 2); return dome(t < Math.PI / 2 ? 0 : Math.PI, Math.min(lat, 1.45), .001); }), .006, { slot: S.PLATE, skin: H, sides: 6, flat: .45, n: m.seg(18, 7), up: [1, 0, 0] });
  { const pts = []; for (let i = 0; i <= 32; i++) { const lon = i / 32 * TAU - Math.PI; pts.push(dome(lon, rimLat(lon) + .2, .002)); } padSweep(m, pts, .02, .0028, outH, { slot: S.RUBBER, skin: H, k: 6, e: 4, puff: 0, step: .02, ends: false }); }
  // neck shroud: a pleated curtain from the back half of the brim, over the nape and the shoulders
  m.grid(m.seg(22, 8), m.seg(5, 2), (u, v) => { const lon = Math.PI + lerp(-1.3, 1.3, u), b = dome(lon, rimLat(lon), -.004), pl = .006 * Math.sin(u * 26) * v * (m.lod === 2 ? 0 : 1), d = [Math.sin(lon), 0, -Math.cos(lon)], out = .015 + .045 * v ** 1.2 + pl; return [b[0] + d[0] * out, b[1] - .11 * v, b[2] + d[2] * out * 1.05]; }, { slot: S.CLOTH, skin: (x, y) => y > 1.6 ? [H, 1] : blend2(B.NEC, H, y, 1.58, .03), crease: 180, out: (x, y, z) => [x, -.1, z - .006], ao: (x, y) => .6 + .4 * sstep(1.52, 1.64, y) });
  m.grid(m.seg(22, 8), m.seg(5, 2), (u, v) => { const lon = Math.PI + lerp(-1.3, 1.3, u), b = dome(lon, rimLat(lon), -.004), pl = .006 * Math.sin(u * 26) * v * (m.lod === 2 ? 0 : 1), d = [Math.sin(lon), 0, -Math.cos(lon)], out = .011 + .045 * v ** 1.2 + pl; return [b[0] + d[0] * out, b[1] - .11 * v, b[2] + d[2] * out * 1.05]; }, { slot: S.CLOTH2, skin: (x, y) => y > 1.6 ? [H, 1] : blend2(B.NEC, H, y, 1.58, .03), crease: 180, out: (x, y, z) => [-x, .1, -(z - .006)], ao: .4 });
}

// ---------------------------------------------------------------- fire shirt
const BELT = [.98, .1745, .1335, { w: .04, t: .0058, sag: .009, cz: .002, e: 2.2 }], belt = beltMap(...BELT);
const SH0 = [[.95, .173, .133, .004], [1.0, .173, .131, .002], [1.05, .167, .126, 0], [1.1, .162, .121, 0], [1.16, .166, .123, 0], [1.24, .179, .129, 0], [1.32, .189, .133, 0], [1.39, .19, .132, .002], [1.435, .183, .125, .005], [1.465, .157, .111, .006], [1.49, .119, .095, .005], [1.512, .091, .083, .004]];
const SH = blouseRows(SH0, BELT[0], BELT[1], BELT[2], BELT[3].w, .009, BELT[3]), blouse = blouseDisp(BELT[0], BELT[3].w, .06);
const PIN_SH = beltPin(BELT, .0045, { above: .0015 }), PIN_TR = beltPin(BELT, .0015);
const shDisp = (a, y) => blouse(a, y) + .03 * Math.sin(a * 10 + .6) * bump(y, 1.03, .05) + .02 * Math.sin(a * 4 + y * 12) * bump(y, 1.25, .15) * Math.max(0, -Math.cos(a)) + .009 * Math.sin(a * 5 + y * 18);
const shirt = garmentMap(SH, { e: 2.5, disp: shDisp, pin: PIN_SH });
const SLR = [[.893, .051], [.9, .057], [.95, .059], [1.0, .06], [1.06, .062], [1.12, .064], [1.16, .065], [1.2, .066], [1.26, .069], [1.34, .074], [1.4, .077], [1.43, .075], [1.455, .066], [1.474, .048], [1.486, .022]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .025 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12) + .045 * Math.sin(y * 120) * bump(y, .95, .05);
const sleeve = s => garmentMap(SLR, { e: 2.05, cx: s * .2, disp: slDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
function shirtBody(m) {
  garment(m, SH, { n: 28, e: 2.5, disp: shDisp, pin: PIN_SH, slot: S.CLOTH, skin: torsoSkin, sub: 2, out: (x, y, z) => [x, y > 1.46 ? .6 : 0, z], ao: foldAo(shDisp) });
  garment(m, [[1.465, .095, .088, .006], [1.5, .089, .083, .006], [1.525, .088, .082, .006]], { n: 24, e: 2.2, slot: S.CLOTH, skin: (x, y) => blend2(C, B.NEC, y, 1.51, .03), out: (x, y, z) => [x, 0, z], ao: .85 });
  panel(m, (u, v, h) => shirt(u, v, h + .0015), -.07, .07, .98, 1.47, { t: .003, nu: 2, nv: 9, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: .1, out: (x, y, z) => [x, 0, z] });
  for (const s of [-1, 1]) {
    panel(m, (u, v, h) => shirt(s * u, v, h + .002), .22, .7, 1.24, 1.37, { t: .006, nu: 5, nv: 4, slot: S.CLOTH, skin: torsoSkin, edge: .14, round: .3, out: (x, y, z) => [x, 0, z] });
    if (m.keep(1)) panel(m, (u, v, h) => shirt(s * u, v, h + .008), .2, .72, 1.34, 1.385, { t: .005, nu: 5, nv: 2, slot: S.CLOTH, skin: torsoSkin, edge: .15, round: .35, out: (x, y, z) => [x, 0, z] });
    elbowLiner(m, s, SLR);
    garment(m, SLR, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .9 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), .915, .034, { n: 16, h0: .001, t: .0035, slot: S.CLOTH, skin: s < 0 ? B.FAL : B.FAR, out: (x, y, z) => [x - s * .2, 0, z] });
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), 1.27, .032, { n: 16, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: (x, y, z) => [x - s * .2, 0, z] });
  }
}

// ---------------------------------------------------------------- trousers, line pack and its harness, tool
const HP = [[.84, .168, .13, .004], [.9, .177, .136, .004], [.95, .178, .137, .003], [1.0, .177, .135, .002]];
const hips = garmentMap(HP, { e: 2.2, pin: PIN_TR });
const LG = [[.3, .066], [.32, .074], [.36, .081], [.4, .082], [.47, .083], [.52, .084], [.57, .086], [.65, .094], [.75, .103], [.85, .108], [.9, .103], [.94, .092], [.985, .072]].map(r => [r[0], r[1], r[1] * 1.04, .004]);
const lgDisp = (a, y) => .06 * Math.sin(a * 6 + y * 45) * bump(y, .34, .05) + .055 * Math.sin(y * 120) * bump(y, .5, .07) * Math.max(0, -Math.cos(a)) ** 1.5 + .03 * Math.sin(a * 2 + y * 14) * bump(y, .78, .15) + .013 * Math.sin(a * 3 + y * 9);
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp });
function trousers(m) {
  legsFromHips(m, { hip: (a, y) => hips(a, y), yTop: 1.0, yCrotch: .86, yThigh: .74, LG, e: 2.1, lgDisp, n: 28, folds: .025, slot: S.CLOTH2, ao: (x, y, z) => .76 + .24 * sstep(.25, .45, y) });       // hips and legs: one surface, gusset and centre seam
  for (const s of [-1, 1]) {
    panel(m, (u, v, h) => leg(s)(u, v, h + .002), 1.1, 1.9, .63, .77, { t: .012, nu: 6, nv: 4, slot: S.CLOTH2, skin: s < 0 ? B.THL : B.THR, edge: .14, round: .4, out: (x, y, z) => [x - s * .1, 0, z] });
  }
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.PLATE2, skin: B.PEL, buckle: 'frame', keepers: [1.1, -1.1], loops: [-.75, .75, -1.6, 1.6, -2.45, 2.45, Math.PI], loopSlot: S.CLOTH2 });
  // tall logger boots: a laced shaft to mid-calf over the trousers
  for (const s of [-1, 1]) garment(m, [[.24, .072, .079, .006], [.3, .08, .087, .006], [.35, .086, .094, .006], [.375, .089, .097, .006], [.38, .084, .092, .006]], { n: 16, e: 2.2, cx: s * .1, slot: S.PLATE2, skin: s < 0 ? B.SHL : B.SHR, out: (x, y, z) => [x - s * .1, 0, z - .006], ao: .85 });
}
function pack(m) {
  // the pack: a padded body low on the back, the fire shelter case under it, a bottle on each side
  const back = (u, v, h) => shirt(Math.PI + u, v, h + .006);
  panel(m, back, -.62, .62, 1.06, 1.34, { t: .055, nu: 10, nv: 6, slot: S.ACCENT, skin: C, edge: .12, round: .55, dome: .01, out: (x, y, z) => [x * .3, 0, z] });
  softPouch(m, .25, .095, .066, bodyFrame(hips(Math.PI, .935, .004), Math.PI), { slot: S.ACCENT, flapSlot: S.ACCENT, skin: B.PEL, flap: .4, tab: true, tabSlot: S.PLATE2, bulge: .06 });
  for (const s of [-1, 1]) { const a = Math.PI - s * 1.05, F = bodyFrame(hips(a, .96, .05), a); m.revolve([[0, .085], [.012, .085], [.013, .075], [.033, .06], [.034, -.06], [.03, -.07], [0, -.07]], { sides: m.keep(1) ? 14 : 7, slot: S.METAL, skin: B.PEL, m: F, crease: 50 }); m.revolve([[.0, .095], [.015, .095], [.016, .083]], { sides: 10, slot: S.RUBBER, skin: B.PEL, m: F }); m.revolve([[.036, .03], [.037, -.065], [.033, -.074]], { sides: m.keep(1) ? 14 : 7, slot: S.ACCENT, skin: B.PEL, m: F, crease: 50 }); }
  // harness: padded yoke straps over the shoulders, chest strap, hip belt under the shirt hem
  for (const s of [-1, 1]) strapAlong(m, [back(s * .45, 1.32, .05), shirt(s * 2.35, 1.46, .012), shirt(s * 1.3, 1.508, .014), shirt(s * .62, 1.45, .012), shirt(s * .55, 1.3, .016), shirt(s * .62, 1.16, .018), hips(s * 1.0, .99, .02)], .042, .009, (x, y, z) => [x, y > 1.47 ? 1 : 0, z], { slot: S.ACCENT, skin: torsoSkin, n: m.seg(24, 8) });
  strapAlong(m, [shirt(-.62, 1.3, .026), shirt(0, 1.31, .03), shirt(.62, 1.3, .026)], .02, .004, (x, y, z) => [x, 0, z], { slot: S.RUBBER, skin: C, n: 8 });
  m.box([0, 0, 0], [.03, .022, .008], .003, { slot: S.METAL, skin: C, m: bodyFrame(shirt(0, 1.31, .036), 0) });
  // combination axe-hoe, head over the left shoulder, handle down the pack
  const F = bodyFrame(back(.22, 1.2, .07), Math.PI + .22, 0);
  m.tube([xf(F, [.0, -.28, 0]), xf(F, [.0, .05, .002]), xf(F, [.0, .34, .004])], .012, { slot: S.PLATE2, skin: C, sides: m.keep(1) ? 8 : 5, n: m.seg(8, 3), cap: true });
  m.box([0, .365, .004], [.04, .03, .026], .005, { slot: S.METAL, skin: C, m: F });
  m.tube([xf(F, [.018, .37, .004]), xf(F, [.06, .36, .004]), xf(F, [.088, .335, .004])], t => lerp(.009, .003, t), { slot: S.METAL, skin: C, sides: 4, flat: .35, n: 6, up: [0, 0, 1] });
  m.tube([xf(F, [-.018, .37, .004]), xf(F, [-.05, .385, .004]), xf(F, [-.078, .372, .004])], t => lerp(.009, .002, t), { slot: S.METAL, skin: C, sides: 4, flat: .3, n: 6, up: [1, 0, 0] });
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  for (let i = 0; i < 6; i++) stud(m, shirt(0, 1.02 + i * .08, .0045), [0, 0, -1], { skin: torsoSkin, r: .0042, slot: S.PLATE2 });
  for (const s of [-1, 1]) { stud(m, shirt(s * .46, 1.355, .0145), [Math.sin(s * .46), 0, -1], { skin: torsoSkin, r: .004, slot: S.PLATE2 }); stud(m, sleeve(s)(0, .915, .0052), [0, 0, -1], { skin: s < 0 ? B.FAL : B.FAR, r: .0036, slot: S.PLATE2 }); }
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) m.tube([[s * .1 - .055, .27 + k * .025, -.035], [s * .1, .265 + k * .025, -.088], [s * .1 + .055, .27 + k * .025, -.035]], .0024, { slot: S.RUBBER, skin: s < 0 ? B.SHL : B.SHR, sides: 4, n: 6 });
  for (const s of [-1, 1]) buckleAt(m, hips(s * 1.0, .99, .03), [Math.sin(s), 0, -Math.cos(s)], { skin: B.PEL, w: .03, d: .02 });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.RUBBER }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  head, shirtBody, trousers, pack,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.PLATE2, slotToe: S.PLATE2, slotRand: S.PLATE2, slotSole: S.RUBBER, slotMid: S.RUBBER, slotWelt: S.RUBBER, slotTongue: S.PLATE2, slotPanel: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.PLATE2, slotCuff: S.CLOTH, guard: false, cuff: false }); },
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['head', 'shirt', 'trousers', 'pack', 'boots', 'gloves']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
