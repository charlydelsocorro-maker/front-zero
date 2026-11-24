// outfit-map-vieille-ville.js — FRONT ZÉRO: FAUBOURG, the outfit of the Vieille Ville map. Original design: a street fighter of the old quarter.
// Eight-panel flat cap with a short brim over a knitted balaclava, a rubber half-mask with two pancake filters against the smoke, a chunky knitted
// scarf wound twice round the neck; a knee-length wool-canvas coat (high collar, shoulder straps, buttoned front, belted waist, flapped hip pockets,
// cuff straps, back vent; its skirt follows the thighs), a cloth armband in the team colour, a canvas satchel on a strap across the chest,
// leather magazine pouches on the belt, straight trousers and high lace-up boots. No insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, torsoSkin, legSkin, blend2, buildGlove, buildBoot, buildPouch, buildGloveDetail, buildBootDetail, stitchLine, buckleAt, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, beltRing, beltMap, blouseRows, blouseDisp, softPouch, beltPin } from './outfit-maps-lib.js';

export const MAP_ID = 'vieille-ville', MAP_NAME = 'Vieille Ville';
// ---------------------------------------------------------------- colourways (the map's own palette first; a dark rim and a low lift: on the old town's
// sunlit stone a bright rim made the coat read lighter than the standard soldier, -12 to -29 % contrast; with these, -1 to -6 %)
const pbr = { cloth: [.9, 0, 0, 1], cloth2: [.88, 0, 0, .9], plate: [.95, 0, 0, 1], plate2: [.62, 0, 0, .25], rubber: [.6, 0, 0, .12], accent: [.92, 0, 0, .85] };
const P = o => ({ pbr, fpKit: 'plain', fpGlove: o.plate2, ...o });       // first-person gloves in the colour of the third-person gloves
const OUT = [
  ['vieille-ville', 'Vieille Ville', 'Légende', 15000, { cloth: 0x3a342e, cloth2: 0x1e2023, plate: 0x9a4228, plate2: 0x4a3324, rubber: 0x1b1b1c, metal: 0x8c8a84, accent: 0x4e4a44, glow: 0xffc070, visor: 0x101214, rim: 0x3c3834, lift: .012, floor: .01 }],
  ['brique', 'Brique', 'Épique', 9000, { cloth: 0x582a20, cloth2: 0x2c2723, plate: 0xb0a48a, plate2: 0x2e2018, rubber: 0x1a1817, metal: 0x8e8a80, accent: 0x3e3a34, glow: 0xffc070, visor: 0x101214, rim: 0x4a342e, lift: .012, floor: .01 }],
  ['pave', 'Pavé', 'Épique', 9000, { cloth: 0x26282c, cloth2: 0x3a3a38, plate: 0x8a3a2a, plate2: 0x3a2a20, rubber: 0x161718, metal: 0x9a9ea2, accent: 0x4a4844, glow: 0xffd28a, visor: 0x0c0e10, rim: 0x4a5058, lift: .012, floor: .01 }],
  ['chaux', 'Chaux', 'Épique', 9000, { cloth: 0x6c675a, cloth2: 0x2e2a26, plate: 0x3e2a22, plate2: 0x4a3426, rubber: 0x1c1b1a, metal: 0x8a8880, accent: 0x6e665a, glow: 0xffe0a0, visor: 0x101214, rim: 0x4a4640, lift: .008, floor: .01 }],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal]) => ({ id: 'faubourg-' + k, setId: 'faubourg', name: 'FAUBOURG', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal) }));

const H = B.HEA, C = B.CHE;
// ---------------------------------------------------------------- head: balaclava, half-mask, flat cap
const capRim = lon => lerp(.3, -.2, ((1 - Math.cos(lon)) / 2) ** 1.1);
const eyeF = (lon, lat) => (lon / .62) ** 2 + ((lat - .02) / .13) ** 2;      // < 1 inside the eye opening
function head(m) {
  headBase(m, S.RUBBER);
  // balaclava: the whole head but the eye opening, a rolled edge round it
  m.grid(m.seg(36, 14), m.seg(14, 6), (u, v) => { const lon = u * TAU - Math.PI, lat = lerp(-1.25, 1.2, v), k = sstep(1.35, .95, eyeF(lon, lat)); return headP(lon, lat, lerp(.005, -.004, k)); }, { wrapU: true, slot: S.CLOTH2, skin: (x, y) => y > 1.585 ? [H, 1] : blend2(B.NEC, H, y, 1.56, .02), crease: 180, out: outH, ao: (x, y, z) => .65 + .35 * sstep(1.5, 1.6, y) });
  if (m.keep(1)) m.tube(Array.from({ length: 29 }, (_, i) => { const t = i / 28 * TAU; return headP(Math.sin(t) * .64, .02 + Math.cos(t) * .145, .0055); }), .0034, { slot: S.CLOTH2, skin: H, sides: 4, n: m.seg(36, 12), cap: false });
  // half-mask over nose and mouth: a moulded cup, its rim seal, two pancake filters, the head strap
  const cup = (lon, lat, off) => { const k = Math.max(0, 1 - (lon / .72) ** 2 - ((lat + .5) / .48) ** 2); return headP(lon, lat, off + .022 * k ** .7); };
  m.grid(m.seg(16, 8), m.seg(10, 5), (u, v) => { const lon = lerp(-.74, .74, u), lat = lerp(-.98, -.06, v), e = Math.max(Math.abs(lon) / .74, Math.abs(lat + .52) / .46); return cup(lon * (1 - .25 * (1 - v) * (1 - v)), lat, .006 - .004 * sstep(.85, 1, e)); }, { slot: S.RUBBER, skin: H, crease: 180, out: outH, ao: .85 });
  for (const s of [-1, 1]) {
    const p = cup(s * .46, -.56, .004), M = bodyFrame(p, s * .7, .28);
    m.revolve([[.0005, .011], [.016, .0105], [.021, .007], [.023, .002], [.023, -.004]], { sides: m.keep(1) ? 18 : 8, slot: S.RUBBER, skin: H, m: M.clone().multiply(T(0, 0, .002, Math.PI / 2, 0, 0)), crease: 40 });
    if (m.keep(1)) m.revolve([[.0235, .0035], [.0235, -.0025]], { sides: 18, slot: S.METAL, skin: H, m: M.clone().multiply(T(0, 0, .002, Math.PI / 2, 0, 0)), crease: 40 });
    m.tube([cup(s * .74, -.42, .004), headP(s * 1.25, -.3, .009), headP(s * 1.9, -.22, .009), headP(Math.PI, -.28, .009)], .0045, { slot: S.RUBBER, skin: H, sides: 4, flat: .3, n: m.seg(12, 5), up: [0, 1, 0] });
  }
  m.revolve([[.0005, .012], [.011, .011], [.013, .004], [.012, -.004]], { sides: m.keep(1) ? 12 : 6, slot: S.RUBBER, skin: H, m: bodyFrame(cup(0, -.62, .008), 0, .3).multiply(T(0, 0, .0, Math.PI / 2, 0, 0)), crease: 40 });
  // flat cap: a soft crown puffed over the sides, a button on top, a short curved brim
  const crown = (lon, v) => { const lat = lerp(capRim(lon), Math.PI / 2, v ** .8), puff = .022 * Math.sin(Math.min(1, v * 1.45) * Math.PI * .5) ** .7 * (1 - v * v * .6) * (1 + .35 * Math.cos(lon)), front = .018 * Math.max(0, Math.cos(lon)) * sstep(.05, .45, v) * (1 - v) ** 1.5; const q = headP(lon, lat, .007 + puff + front + .002 * Math.cos(lon * 8) * Math.sin(v * Math.PI) * (m.lod === 0 ? 1 : 0)); q[1] -= .014 * sstep(.4, 1, v); q[2] -= .012 * Math.max(0, Math.cos(lon)) * Math.sin(v * Math.PI); return q; };
  m.grid(m.seg(40, 14), m.seg(9, 4), (u, v) => crown(u * TAU - Math.PI, v), { wrapU: true, capB: true, slot: S.ACCENT, skin: H, crease: 180, out: outH, ao: (x, y) => .8 + .2 * sstep(1.7, 1.78, y) });
  m.grid(m.seg(40, 14), 1, (u, v) => { const lon = u * TAU - Math.PI, l = capRim(lon); return headP(lon, l - .01 + .05 * v, .0075 - .001 * v); }, { wrapU: true, slot: S.PLATE2, skin: H, crease: 180, out: outH });      // leather sweatband edge
  m.ell([0, 0, 0], [.0075, .004, .0075], { slot: S.ACCENT, skin: H, nu: 8, nv: 4, m: T(HC0(), crown(0, 1)[1] + .002, HC2()) });
  m.grid(m.seg(16, 6), m.seg(4, 2), (u, v) => { const lon = lerp(-.95, .95, u), w = 1 - (lon / .95) ** 2, r = lerp(0, .04 * w ** .55 + .006, v), b = headP(lon, capRim(lon) + .025, .009); return [b[0] + Math.sin(lon) * r, b[1] - .02 * v * v - .003 * v, b[2] - Math.cos(lon) * r]; }, { slot: S.ACCENT, skin: H, crease: 60, out: (x, y, z) => [0, 1, -.15] });
  m.grid(m.seg(16, 6), m.seg(4, 2), (u, v) => { const lon = lerp(-.95, .95, u), w = 1 - (lon / .95) ** 2, r = lerp(0, .04 * w ** .55 + .006, v), b = headP(lon, capRim(lon) + .025, .009); return [b[0] + Math.sin(lon) * r, b[1] - .02 * v * v - .003 * v - .0035, b[2] - Math.cos(lon) * r]; }, { slot: S.PLATE2, skin: H, crease: 60, out: (x, y, z) => [0, -1, .15] });
}
const HC0 = () => 0, HC2 = () => -.006;
// chunky knitted scarf: two turns round the neck, one end down the front
function scarf(m) {
  const n = m.seg(26, 10), sk = (x, y) => y > 1.55 ? blend2(B.NEC, H, y, 1.58, .02) : blend2(C, B.NEC, y, 1.5, .03);
  for (const [y0, r, ph] of [[1.49, .114, .3], [1.54, .106, 1.9]]) {
    const pts = []; for (let i = 0; i <= 30; i++) { const a = i / 30 * (TAU + .5) - .25; pts.push([(r + .004 * Math.sin(a * 3 + ph)) * Math.sin(a), y0 + .012 * Math.sin(a + ph), .004 - (r * .96) * Math.cos(a)]); }
    padSweep(m, pts, u => .062 * (1 + .14 * Math.sin(u * 21 + ph)), u => .012 * (1 + .25 * Math.sin(u * 17 + ph)), (x, y, z) => [x, 0, z - .004], { slot: S.PLATE, skin: sk, k: 10, e: 3.2, puff: .35, step: .02 });
  }
  padSweep(m, [[.035, 1.53, -.11], [.052, 1.47, -.155], [.06, 1.38, -.165], [.064, 1.3, -.163]], u => lerp(.064, .074, u), .011, (x, y, z) => [x * .2, 0, z], { slot: S.PLATE, skin: (x, y) => y > 1.5 ? sk(x, y) : torsoSkin(x, y), k: 10, e: 2.4, puff: .4, step: .02 });
  void n;
}

// ---------------------------------------------------------------- the coat
const CT0 = [[.97, .182, .14, .004], [1.03, .178, .135, 0], [1.09, .172, .13, 0], [1.16, .174, .13, 0], [1.24, .184, .134, 0], [1.32, .192, .137, 0], [1.39, .193, .136, .002], [1.435, .185, .128, .005], [1.465, .159, .113, .006], [1.49, .122, .098, .005], [1.512, .094, .086, .004]];
const BELT = [1.0, .1795, .1365, { w: .045, t: .006, sag: .008, cz: .004, e: 2.35 }], belt = beltMap(...BELT);
const CT = blouseRows(CT0, BELT[0], BELT[1], BELT[2], BELT[3].w, .0065, BELT[3]), blouse = blouseDisp(BELT[0], BELT[3].w, .045);
const PIN_CT = beltPin(BELT, .0035, { above: .0015 }), PIN_SK = beltPin(BELT, .0015), PIN_TR = beltPin(BELT, .006);
const ctDisp = (a, y) => blouse(a, y) + .022 * Math.sin(a * 4 + y * 10) * bump(y, 1.26, .15) * Math.max(0, -Math.cos(a)) + .009 * Math.sin(a * 5 + y * 18);
const coat = garmentMap(CT, { e: 2.35, disp: ctDisp, pin: PIN_CT });
const SLR = [[.885, .057], [.9, .062], [.95, .063], [1.0, .064], [1.06, .065], [1.12, .067], [1.16, .068], [1.2, .069], [1.26, .071], [1.34, .075], [1.4, .078], [1.43, .076], [1.455, .067], [1.474, .049], [1.486, .023]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .025 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12) + .045 * Math.sin(y * 110) * bump(y, .97, .05);
const sleeve = s => garmentMap(SLR, { e: 2.05, cx: s * .2, disp: slDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
// the skirt: two panels from the belt to the knee, open at the front, split at the back; each follows its thigh more and more toward the hem
const SK0 = 1.0, SK1 = .57;
const skirtP = (s, u, v, off) => PIN_SK(skirtP0(s, u, v, off), 0, off < 0 ? -off : -off * .5);
const skirtP0 = (s, u, v, off) => { const a = s * lerp(.05, Math.PI - .02, u), y = lerp(SK0, SK1 + .02 * Math.sin(u * Math.PI) * 0, v), rx = lerp(.178, .24, Math.min(1, v * 1.6) ** .8) + .008 * v, rz = lerp(.136, .175, Math.min(1, v * 1.6) ** .8) + .025 * v, w = 1 + (.04 * Math.sin(u * 13 + v * 2) + .02 * Math.sin(u * 29 - 1)) * v * v; const p = 2 / 2.4; return [(rx * w + off) * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** p, y, .004 - (rz * w + off) * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** p]; };
const skirtAt = (a, y, off) => skirtP(Math.sign(a) || 1, clamp((Math.abs(a) - .05) / (Math.PI - .07), 0, 1), clamp((SK0 - y) / (SK0 - SK1), 0, 1), off);
const skirtSk = s => (x, y) => { const k = sstep(.985, .6, y) * .78, TH = s < 0 ? B.THL : B.THR; return k < .01 ? [B.PEL, 1] : [B.PEL, 1 - k, TH, k]; };
function coatBody(m) {
  garment(m, CT, { n: 30, e: 2.35, disp: ctDisp, pin: PIN_CT, slot: S.CLOTH, skin: torsoSkin, sub: 2, capA: true, out: (x, y, z) => [x, y > 1.46 ? .6 : y < .98 ? -.4 : 0, z], ao: foldAo(ctDisp) });
  for (const s of [-1, 1]) {
    const nu = m.seg(16, 6), nv = m.seg(9, 4);
    m.grid(nu, nv, (u, v) => skirtP(s, u, v, .0), { slot: S.CLOTH, skin: skirtSk(s), crease: 180, out: (x, y, z) => [x, 0, z - .004], ao: (x, y) => .78 + .22 * sstep(.6, .9, y) });
    if (m.keep(1)) m.grid(nu, nv, (u, v) => skirtP(s, u, v, -.004), { slot: S.CLOTH2, skin: skirtSk(s), crease: 180, out: (x, y, z) => [-x, 0, -(z - .004)], ao: .45 });
    m.grid(nu, 1, (u, v) => { const p = skirtP(s, u, 1, -.004 + .008 * v); p[1] -= .0025 * Math.sin(v * Math.PI); return p; }, { slot: S.CLOTH, skin: skirtSk(s), crease: 180, out: (x, y, z) => [0, -1, 0], ao: .6 });       // hem edge
    // hip pocket with its flap
    const pm = (u, v, h) => { const t = (u - .2) / .4, q = skirtP(s, clamp(t, 0, 1) * .4 + .2, (SK0 - v) / (SK0 - SK1), .002 + h); return q; };
    panel(m, pm, .22, .55, .8, .92, { t: .005, nu: 5, nv: 4, slot: S.CLOTH, skin: skirtSk(s), edge: .14, round: .3, out: (x, y, z) => [x, 0, z] });
    if (m.keep(1)) panel(m, pm, .21, .56, .9, .94, { t: .007, nu: 5, nv: 2, slot: S.CLOTH, skin: skirtSk(s), edge: .14, round: .3, out: (x, y, z) => [x, 0, z] });
    // sleeves, cuff straps, shoulder straps
    elbowLiner(m, s, SLR);
    garment(m, SLR, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .9 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), .93, .024, { a0: -1.2, a1: 1.6, n: 10, h0: .001, t: .003, slot: S.CLOTH, skin: s < 0 ? B.FAL : B.FAR, out: (x, y, z) => [x - s * .2, 0, z] });
    panel(m, (u, v, h) => coat(s * u, v, h + .003), 1.15, 1.95, u => 1.455 - .02 * Math.sin((u - 1.15) / .8 * Math.PI) * 0, u => 1.49 - .03 * sstep(1.15, 1.95, u), { t: .004, nu: 6, nv: 2, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: .35, out: (x, y, z) => [x, 1, z] });
  }
  // armband in the team colour on the left upper arm
  bandOn(m, (a, y, h) => sleeve(-1)(a, y, h), 1.28, .06, { n: 18, h0: .002, t: .002, slot: S.TEAM, skin: B.UAL, out: (x, y, z) => [x + .2, 0, z] });
  // high collar, buttoned front placket
  garment(m, [[1.47, .102, .096, .006], [1.5, .097, .091, .006], [1.53, .098, .092, .006], [1.548, .1, .094, .006]], { n: 26, e: 2.2, slot: S.CLOTH, skin: (x, y) => blend2(C, B.NEC, y, 1.52, .03), out: (x, y, z) => [x, 0, z], ao: .85 });
  garment(m, [[1.52, .09, .085, .006], [1.548, .1, .094, .006]], { n: 26, e: 2.2, slot: S.CLOTH2, skin: B.NEC, out: (x, y, z) => [0, 1, 0], ao: .5 });
  panel(m, (u, v, h) => coat(u, v, h + .002), -.11, .11, 1.0, 1.47, { t: .004, nu: 3, nv: 9, slot: S.CLOTH, skin: torsoSkin, edge: .2, round: .1, out: (x, y, z) => [x, 0, z] });
}

// ---------------------------------------------------------------- belt, pouches, satchel
function kit(m) {
  const P2 = B.PEL;
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.PLATE2, skin: P2, buckle: 'frame', keepers: [1.2, -1.2, 2.3, -2.3] });
  for (const a of [-.5, -.82, .62]) softPouch(m, .056, .072, .032, bodyFrame(skirtAt(a, .955, .004), a, .1), { slot: S.PLATE2, flapSlot: S.PLATE2, skin: (x, y) => skirtSk(Math.sign(a) || 1)(x, y), flap: .45, tabSlot: S.METAL });
  // satchel on the left hip, strap across the chest over the right shoulder
  const a = -1.75, SF = bodyFrame(coat(a, 1.06, .012), a);
  softPouch(m, .2, .15, .052, SF, { slot: S.ACCENT, flapSlot: S.ACCENT, skin: P2, flap: .62, tab: false, bulge: .1 });
  if (m.keep(1)) for (const x of [-.055, .055]) { m.box([x, -.008, .061], [.016, .06, .004], .002, { slot: S.PLATE2, skin: P2, m: SF }); buckleAt(m, xf(SF, [x, -.034, .063]), [SF.elements[8], SF.elements[9], SF.elements[10]], { up: [0, 1, 0], skin: P2, w: .018, d: .014, t: .0025 }); }
  strapAlong(m, [xf(SF, [.09, .07, .02]), coat(-1.0, 1.2, .012), coat(-.45, 1.33, .014), coat(.25, 1.44, .012), coat(.85, 1.5, .014), coat(1.6, 1.49, .014), coat(2.2, 1.42, .012), coat(2.8, 1.25, .014), coat(-2.7, 1.12, .016), xf(SF, [-.09, .07, .02])], .036, .004, (x, y, z) => [x, y > 1.46 ? 1 : 0, z], { slot: S.PLATE2, skin: (x, y) => y < 1.08 ? [P2, 1] : torsoSkin(x, y), n: m.seg(56, 14) });
}

// ---------------------------------------------------------------- trousers
const LG = [[.252, .062], [.268, .07], [.29, .078], [.33, .079], [.4, .078], [.47, .079], [.52, .08], [.57, .082], [.65, .09], [.75, .1], [.85, .105], [.93, .094], [.96, .084], [.985, .07]].map(r => [r[0], r[1], r[1] * 1.04, r[0] > .6 ? .004 : 0]);
const lgDisp = (a, y) => .05 * Math.sin(a * 5 + y * 50) * bump(y, .3, .05) + .05 * Math.sin(y * 120) * bump(y, .5, .07) * Math.max(0, -Math.cos(a)) ** 1.5 + .012 * Math.sin(a * 3 + y * 9);
function trousers(m) {
  for (const s of [-1, 1]) garment(m, LG, { n: 16, e: 2.1, cx: s * .1, disp: lgDisp, pin: PIN_TR, slot: S.CLOTH2, skin: legSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .1, y > .97 ? .3 : 0, z], ao: (x, y, z) => foldAo(lgDisp, s * .1)(x, y, z) * (.74 + .26 * sstep(.25, .45, y)) });
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  // cap: panel seams from the button, a stitch line round the brim
  for (let k = 0; k < 8; k++) stitchLine(m, Array.from({ length: 7 }, (_, i) => { const lon = k * Math.PI / 4 + .2, v = lerp(.98, .25, i / 6), lat = lerp(capRim(lon), Math.PI / 2, v ** .8); return headP(lon, lat, .007 + .014 * Math.sin(Math.min(1, v * 1.25) * Math.PI) + .0012); }), { skin: H, n: 12, slot: S.ACCENT });
  // coat: buttons down the placket and on the cuff straps and shoulder straps, stitched hem, back vent
  for (let i = 0; i < 6; i++) stud(m, coat(0, 1.06 + i * .075, .0068), [0, 0, -1], { skin: torsoSkin, r: .0068, slot: S.PLATE2 });
  for (const s of [-1, 1]) { stud(m, sleeve(s)(s < 0 ? -.4 : .4, .93, .0058), [s * .4, 0, -1], { skin: s < 0 ? B.FAL : B.FAR, r: .0052, slot: S.PLATE2 }); stud(m, coat(s * 1.25, 1.465, .008), [s * .3, 1, -.4], { skin: torsoSkin, r: .0052, slot: S.PLATE2 });
    stitchLine(m, Array.from({ length: 17 }, (_, i) => skirtP(s, i / 16, .965, .001)), { skin: skirtSk(s), n: 40 }); }
  // satchel stitching, scarf fringe
  for (let i = 0; i < 7; i++) m.tube([[.03 + i * .0055, 1.302, -.161], [.031 + i * .0055, 1.282, -.16]], .0016, { slot: S.PLATE, skin: C, sides: 3, n: 3 });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.RUBBER }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  head, scarf, coatBody, kit, trousers,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.RUBBER, slotRand: S.RUBBER, slotSole: S.RUBBER, slotMid: S.RUBBER, slotWelt: S.PLATE2, slotTongue: S.RUBBER, slotPanel: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.PLATE2, slotCuff: S.CLOTH2, guard: false, cuff: false }); },
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['head', 'scarf', 'coat', 'kit', 'trousers', 'boots', 'gloves']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
