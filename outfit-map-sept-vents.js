// outfit-map-sept-vents.js — FRONT ZÉRO: BALISEUR, the outfit of the Piste Sept-Vents map. Original design: an airfield marshaller of the flight line
// (ground crew, not a pilot). A padded cranial cap with hard side shells and big ear defenders, wind goggles, a perforated neoprene face mask; a
// one-piece flight-line coverall (zip, chest and thigh pockets, knee reinforcements) under a role tabard open at the sides with retro-reflective bands;
// two marshalling wands in a holster on the right thigh, a radio in a shoulder pouch, a tool lanyard, soft knee pads with a real dome.
// No insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, torsoSkin, legSkin, blend2, buildGlove, buildBoot, buildPouch, buildGloveDetail, buildBootDetail, stitchLine, buckleAt, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, lensFrame, softPouch, radio, rowAt, legsFromHips } from './outfit-maps-lib.js';

export const MAP_ID = 'sept-vents', MAP_NAME = 'Piste Sept-Vents';
// ---------------------------------------------------------------- colourways (the map's own palette first)
const pbr = { cloth: [.8, 0, 0, .8], cloth2: [.84, 0, 0, .85], plate: [.5, .04, 0, .05], plate2: [.62, 0, 0, .3], rubber: [.6, 0, 0, .15], accent: [.4, .25, .14, 0], visor: [.06, .5, .02, 0] };
const P = o => ({ pbr, fpKit: 'plain', fpGlove: o.rubber, ...o });       // first-person gloves in the colour of the third-person gloves
const OUT = [
  ['sept-vents', 'Sept-Vents', 'Légende', 15000, { cloth: 0x4a5a66, cloth2: 0x2c3a2e, plate: 0x3a3d40, plate2: 0x2a2c2e, rubber: 0x18191a, metal: 0x9aa0a6, accent: 0xc0c4c4, glow: 0xff8a20, visor: 0x2a3a20, rim: 0x6a7480, lift: .025, team: 0xd9a020 }],
  ['piste', 'Piste', 'Épique', 9000, { cloth: 0xc8a420, cloth2: 0x3a3c3a, plate: 0x2e3032, plate2: 0x262829, rubber: 0x161718, metal: 0x9a9ea2, accent: 0xc4c8c8, glow: 0xff8a20, visor: 0x2a3a20, rim: 0x6a6040, lift: .015 }],
  ['carburant', 'Carburant', 'Épique', 9000, { cloth: 0x8a2a24, cloth2: 0x3e3a30, plate: 0x2e2c2a, plate2: 0x2a2826, rubber: 0x171615, metal: 0x9a9690, accent: 0xc4c8c8, glow: 0xff8a20, visor: 0x2a3a20, rim: 0x6a5450, lift: .02 }],
  ['hangar', 'Hangar', 'Épique', 9000, { cloth: 0x4a5a3a, cloth2: 0x24262a, plate: 0x34383a, plate2: 0x2a2c2e, rubber: 0x161718, metal: 0x9a9ea2, accent: 0xc4c8c8, glow: 0xff8a20, visor: 0x2a3a20, rim: 0x606a54, lift: .028 }],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal]) => ({ id: 'baliseur-' + k, setId: 'baliseur', name: 'BALISEUR', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal) }));

const H = B.HEA, C = B.CHE;
// ---------------------------------------------------------------- head: cranial cap, ear defenders, goggles, face mask
function head(m) {
  headBase(m, S.RUBBER);
  // padded cranial: a quilted cloth cap (channels across the crown), hard shells over the sides and the brow
  const capLat = lon => lerp(.2, -.28, ((1 - Math.cos(lon)) / 2) ** 1.1);
  m.grid(m.seg(36, 14), m.seg(10, 4), (u, v) => { const lon = u * TAU - Math.PI, lat = lerp(capLat(lon), Math.PI / 2, v ** .85), q = (m.lod === 0 ? .0022 : 0) * Math.abs(Math.sin(lat * 9)); return headP(lon, lat, .011 + q); }, { wrapU: true, capB: true, slot: S.CLOTH2, skin: H, crease: 180, out: outH, ao: (x, y) => .8 + .2 * sstep(1.7, 1.78, y) });
  for (const s of [-1, 1]) panel(m, (u, v, h) => headP(s * u, v, .016 + h), .55, 2.4, u => .1 + .12 * Math.sin((u - .55) / 1.85 * Math.PI), u => .78 - .1 * Math.sin((u - .55) / 1.85 * Math.PI), { t: .006, nu: 10, nv: 5, slot: S.PLATE, skin: H, edge: .1, round: .45, dome: .003, out: outH });
  panel(m, (u, v, h) => headP(u, v, .016 + h), -.5, .5, .3, .62, { t: .006, nu: 6, nv: 3, slot: S.PLATE, skin: H, edge: .12, round: .4, out: outH });
  // ear defenders: big oval cups on yokes
  for (const s of [-1, 1]) {
    const M = T(s * .114, 1.648, .006, 0, 0, -s * Math.PI / 2, 1, 1, 1.25);
    m.revolve([[.002, .026], [.03, .026], [.04, .02], [.043, .008], [.043, -.008], [.039, -.014], [.034, -.016]], { sides: m.keep(1) ? 18 : 8, slot: S.CLOTH, skin: H, m: M, crease: 40 });
    m.revolve([[.036, -.012], [.04, -.018], [.038, -.026], [.03, -.028]], { sides: m.keep(1) ? 18 : 8, slot: S.RUBBER, skin: H, m: M, crease: 60 });
    m.tube([[s * .118, 1.69, -.02], [s * .126, 1.72, .0], [s * .118, 1.69, .03]], .0045, { slot: S.METAL, skin: H, sides: 5, n: 6 });
  }
  // goggles over the eyes: one curved lens in a soft frame, a wide strap round the cap
  const g = (lon, lat, off) => headP(lon, lat, off + .012 * Math.cos(lon) ** 2);
  m.grid(m.seg(16, 6), m.seg(3, 1), (u, v) => { const lon = lerp(-1.0, 1.0, u); return g(lon, lerp(-.14, .2, v) - .05 * (lon / 1.0) ** 2 * (v - .5), .024); }, { slot: S.VISOR, skin: H, crease: 180, out: outH });
  for (const lat of [-.16, .22]) m.tube(Array.from({ length: 11 }, (_, i) => { const lon = lerp(-1.03, 1.03, i / 10); return g(lon, lat - .05 * (lon / 1.0) ** 2 * (lat > 0 ? .5 : -.5), .026); }), .0055, { slot: S.RUBBER, skin: H, sides: 5, n: m.seg(16, 6) });
  for (const s of [-1, 1]) m.tube([g(s * 1.03, -.18, .026), g(s * 1.08, .03, .028), g(s * 1.03, .24, .026)], .0055, { slot: S.RUBBER, skin: H, sides: 5, n: 6 });
  { const pts = []; for (let i = 0; i <= 22; i++) { const lon = lerp(1.0, TAU - 1.0, i / 22); pts.push(headP(lon, lerp(.03, .1, (1 - Math.cos(lon)) / 2), .03)); } padSweep(m, pts, .026, .003, outH, { slot: S.RUBBER, skin: H, k: 6, e: 4, puff: 0, step: .02, ends: false }); }
  // perforated neoprene face mask over nose, mouth and cheeks
  m.grid(m.seg(20, 8), m.seg(8, 4), (u, v) => { const lon = lerp(-1.5, 1.5, u), lat = lerp(-1.0, -.17 + .1 * (lon / 1.5) ** 2, v); return headP(lon, lat, .009 + .005 * Math.max(0, 1 - (lon / .8) ** 2) * Math.sin(v * Math.PI)); }, { slot: S.PLATE2, skin: (x, y) => y > 1.58 ? [H, 1] : blend2(B.NEC, H, y, 1.56, .02), crease: 180, out: outH, ao: .85 });
  // neck: a fleece collar between the mask and the coverall
  garment(m, [[1.465, .07, .068, .002], [1.52, .068, .066, .002], [1.57, .064, .062, .0]], { n: 20, e: 2.1, slot: S.PLATE2, skin: (x, y) => blend2(C, B.NEC, y, 1.5, .04), out: (x, y, z) => [x, 0, z] });
}

// ---------------------------------------------------------------- coverall
const CV = [[.84, .17, .132, .004], [.9, .178, .137, .004], [.97, .176, .134, .002], [1.03, .171, .129, 0], [1.09, .166, .124, 0], [1.16, .17, .125, 0], [1.24, .181, .13, 0], [1.32, .19, .134, 0], [1.39, .191, .133, .002], [1.435, .183, .125, .005], [1.465, .157, .111, .006], [1.49, .119, .095, .005], [1.512, .091, .083, .004]];
const cvDisp = (a, y) => .03 * Math.sin(a * 10 + .6) * bump(y, 1.0, .05) + .02 * Math.sin(a * 4 + y * 12) * bump(y, 1.25, .15) * Math.max(0, -Math.cos(a)) + .009 * Math.sin(a * 5 + y * 18);
const coverall = garmentMap(CV, { e: 2.3, disp: cvDisp });
const Y_JOIN = 1.0, CV_TOP = [rowAt(CV, Y_JOIN), ...CV.filter(r => r[0] > Y_JOIN + .002)];       // waist seam: body above, legs (legsFromHips) below
const SLR = [[.893, .052], [.9, .058], [.95, .06], [1.0, .062], [1.06, .063], [1.12, .065], [1.16, .066], [1.2, .067], [1.26, .07], [1.34, .075], [1.4, .078], [1.43, .076], [1.455, .067], [1.474, .048], [1.486, .022]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .03 * Math.sin(a * 2 + y * 16 + .5) * bump(y, 1.32, .12) + .05 * Math.sin(y * 120) * bump(y, .95, .05);
const sleeve = s => garmentMap(SLR, { e: 2.05, cx: s * .2, disp: slDisp });
const LG = [[.25, .062], [.265, .07], [.29, .08], [.33, .082], [.4, .08], [.47, .081], [.52, .082], [.57, .084], [.65, .092], [.75, .102], [.85, .107], [.93, .103], [.985, .088]].map(r => [r[0], r[1], r[1] * 1.04, .004]);
const lgDisp = (a, y) => .07 * Math.sin(a * 6 + y * 45) * bump(y, .3, .05) + .05 * Math.sin(y * 120) * bump(y, .5, .07) * Math.max(0, -Math.cos(a)) ** 1.5 + .03 * Math.sin(a * 2 + y * 14) * bump(y, .78, .15) + .012 * Math.sin(a * 3 + y * 9);
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
function coverallBody(m) {
  garment(m, CV_TOP, { n: 28, e: 2.3, disp: cvDisp, slot: S.CLOTH2, skin: torsoSkin, sub: 2, out: (x, y, z) => [x, y > 1.46 ? .6 : 0, z], ao: foldAo(cvDisp) });
  legsFromHips(m, { hip: (a, y) => coverall(a, y), yTop: Y_JOIN, yCrotch: .88, yThigh: .76, LG, e: 2.1, lgDisp, n: 28, folds: .025, slot: S.CLOTH2, ao: (x, y, z) => .78 + .22 * sstep(.25, .45, y) });
  garment(m, [[1.465, .095, .088, .006], [1.5, .088, .082, .006], [1.52, .086, .08, .006]], { n: 24, e: 2.2, slot: S.CLOTH2, skin: (x, y) => blend2(C, B.NEC, y, 1.51, .03), out: (x, y, z) => [x, 0, z], ao: .85 });
  for (const s of [-1, 1]) {
    elbowLiner(m, s, SLR);
    garment(m, SLR, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH2, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .9 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), .912, .03, { n: 16, h0: .001, t: .003, slot: S.CLOTH2, skin: s < 0 ? B.FAL : B.FAR, out: (x, y, z) => [x - s * .2, 0, z] });
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), 1.3, .034, { n: 16, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: (x, y, z) => [x - s * .2, 0, z] });
    // thigh pocket, knee pad with a real dome held by two straps
    const TH = s < 0 ? B.THL : B.THR, SH = s < 0 ? B.SHL : B.SHR, o = (x, y, z) => [x - s * .1, 0, z];
    panel(m, (u, v, h) => leg(s)(u, v, h + .002), 1.05, 1.95, .62, .78, { t: .013, nu: 6, nv: 4, slot: S.CLOTH2, skin: TH, edge: .14, round: .4, out: o });
    const kr = (u, v) => .083 + .012 * Math.max(0, 1 - (u / .85) ** 2) * Math.max(0, 1 - ((v - .55) / .065) ** 2);
    panel(m, (u, v, h) => { const r = kr(u, v) + h; return [s * .1 + s * r * Math.sin(u), v, .004 - r * Math.cos(u)]; }, -.85, .85, u => .5 + .012 * (u / .85) ** 2, u => .615 - .018 * (u / .85) ** 2, { t: .008, nu: 9, nv: 7, slot: S.PLATE, skin: (px, py) => blend2(SH, TH, py, .53, .03), edge: .14, round: .35, dome: .003, out: o });
    panel(m, (u, v, h) => { const r = .08 + h; return [s * .1 + s * r * Math.sin(u), v, .004 - r * Math.cos(u)]; }, -.75, .75, .43, u => .49 - .01 * (u / .75) ** 2, { t: .006, nu: 7, nv: 3, slot: S.PLATE, skin: SH, edge: .16, round: .3, out: o });
    for (const y of [.43, .61]) bandOn(m, (a, yy, h) => leg(s)(a, yy, h), y, .02, { n: 16, h0: .002, t: .003, slot: S.RUBBER, skin: y > .5 ? TH : SH, out: o });
  }
}

// ---------------------------------------------------------------- tabard, wands, radio
const TB = (u, v, h = 0) => coverall(u, v, .014 + h);
function tabard(m) {
  // front and back panels, joined over the shoulders, open at the sides; a reflective band across each and a big front pocket
  for (const side of [0, Math.PI]) panel(m, (u, v, h) => TB(side + u, v, h), -.98, .98, 1.0, u => side ? 1.47 - .04 * Math.abs(u) : 1.44 - .08 * Math.abs(u) ** 2, { t: .004, nu: 14, nv: 8, slot: S.CLOTH, skin: torsoSkin, edge: .06, round: .2, out: (x, y, z) => [x, 0, z] });
  for (const s of [-1, 1]) m.grid(m.seg(6, 3), m.seg(6, 3), (u, v) => { const a = s * lerp(.35, .85, u), y = 1.44 - .02 * Math.abs(a); const f = TB(a, y), b = TB(s * Math.PI - s * lerp(.5, .9, u) * .9, 1.46); const t = v, top = [lerp(f[0], b[0], t), lerp(f[1], b[1], t) + .07 * Math.sin(t * Math.PI), lerp(f[2], b[2], t)]; return top; }, { slot: S.CLOTH, skin: torsoSkin, crease: 180, out: (x, y, z) => [x * .5, 1, z * .3] });
  for (const side of [0, Math.PI]) for (const y of [1.08, 1.17]) bandOn(m, TB, y, .028, { a0: side - .95, a1: side + .95, n: 14, h0: .0045, t: .0015, slot: S.ACCENT, skin: torsoSkin, out: (x, y, z) => [x, 0, z] });
  panel(m, (u, v, h) => TB(u, v, h + .005), -.55, .55, 1.03, 1.06, { t: .002, nu: 6, nv: 1, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: 0, out: (x, y, z) => [x, 0, z] });
  for (const s of [-1, 1]) { strapAlong(m, [TB(s * .97, 1.05, .002), TB(s * 1.57, 1.05, -.006), TB(s * (Math.PI - .97), 1.05, .002)], .022, .003, (x, y, z) => [x, 0, z], { slot: S.RUBBER, skin: torsoSkin, n: 6 }); }
  // wands: two lit batons in a twin holster on the right thigh
  const F = bodyFrame(leg(1)(1.4, .76, .016), Math.PI / 2 + .1);
  m.box([0, 0, .006], [.07, .12, .03], .01, { slot: S.RUBBER, skin: B.THR, m: F });
  for (const x of [-.018, .018]) { m.revolve([[.0, .2], [.014, .2], [.015, .19], [.017, .08], [.017, .03], [.0, .03]], { sides: m.keep(1) ? 10 : 6, slot: S.GLOW, skin: B.THR, m: F.clone().multiply(T(x, -.08, .012)), crease: 50 }); m.revolve([[.0, .03], [.012, .03], [.013, -.02], [.011, -.03], [0, -.03]], { sides: m.keep(1) ? 10 : 6, slot: S.PLATE, skin: B.THR, m: F.clone().multiply(T(x, .1, .012)), crease: 50 }); }
  // radio in a shoulder pouch on the left, its cable to the cup
  { const M = bodyFrame(TB(-.6, 1.36, .004), -.6); softPouch(m, .05, .06, .03, M, { slot: S.RUBBER, flapSlot: S.RUBBER, skin: C, flap: .12 }); radio(m, bodyFrame(TB(-.6, 1.4, .008), -.6), { w: .044, h: .07, d: .024, skin: C, aerial: .05 }); const R = bodyFrame(TB(-.6, 1.4, .02), -.6); if (m.keep(1)) m.tube([xf(R, [-.01, .03, -.004]), TB(-.85, 1.47, .02), [-.1, 1.55, -.02], [-.118, 1.6, -.01]], .0022, { slot: S.RUBBER, skin: (x, y) => y > 1.52 ? blend2(C, H, y, 1.55, .03) : [C, 1], sides: 3, n: 10 }); }
  // tool lanyard: a coiled cord from the belt line to a wrench in the right hip pocket
  if (m.keep(1)) { const a = TB(.9, 1.0, .004), b = coverall(1.25, .88, .02); m.tube([a, [a[0] + .02, a[1] - .05, a[2] + .01], [b[0], b[1] + .02, b[2]], b], .0025, { slot: S.ACCENT, skin: B.PEL, sides: 4, n: 10 }); m.box([0, 0, 0], [.018, .07, .008], .003, { slot: S.METAL, skin: B.PEL, m: T(b[0], b[1] - .03, b[2], 0, -1.25, 0) }); }
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  if (m.keep(0)) m.tube(Array.from({ length: 9 }, (_, i) => coverall(0, lerp(.98, 1.5, i / 8), .003)), .0024, { slot: S.METAL, skin: torsoSkin, sides: 3, n: 20, cap: false });
  for (const side of [0, Math.PI]) stitchLine(m, Array.from({ length: 15 }, (_, i) => TB(side + lerp(-.95, .95, i / 14), 1.005, .0045)), { skin: torsoSkin, n: 40 });
  for (const s of [-1, 1]) buckleAt(m, leg(s)(s * 1.4, .43, .006), [s, 0, 0], { up: [0, 1, 0], skin: s < 0 ? B.SHL : B.SHR, w: .014, d: .012, t: .0024 });
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) m.box([0, 0, 0], [.004, .004, .002], .001, { slot: S.METAL, skin: H, m: T(...headP(s * (.75 + k * .45), .45, .0235), 0, 0, 0) });
  for (let i = 0; i < 18; i++) { const lon = lerp(-.45, .45, (i % 6) / 5), lat = lerp(-.62, -.4, Math.floor(i / 6) / 2); m.box([0, 0, 0], [.0035, .0035, .002], .001, { slot: S.RUBBER, skin: H, m: T(...headP(lon, lat, .0145 + .005 * Math.max(0, 1 - (lon / .8) ** 2) * .8), 0, -lon, 0) }); }
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.RUBBER }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  head, coverallBody, tabard,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.RUBBER, slotRand: S.RUBBER, slotSole: S.RUBBER, slotMid: S.PLATE, slotWelt: S.RUBBER, slotTongue: S.RUBBER, slotPanel: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.RUBBER, slotCuff: S.CLOTH2, guard: false, cuff: false }); },
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['head', 'coverall', 'tabard', 'boots', 'gloves']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
