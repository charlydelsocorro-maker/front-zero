// outfit-map-col-blanc.js — FRONT ZÉRO: CORDÉE, the outfit of the Col Blanc map. Original design: a mountain guide holding the pass, not a polar
// commando: a vented climbing helmet over a fleece neck warmer, glacier glasses with leather side shields; a fitted softshell (chest zips, helmet hood
// hanging at the back), a climbing harness (padded waist belt, leg loops, belay loop, gear loops with carabiners and an ice screw) and a kernmantle rope
// coiled across the body; softshell trousers with articulated knees, gaiters over stiff mountaineering boots; a slim alpine pack with an ice axe and a
// pair of crampons strapped to it. No insignia, name, number or text anywhere. Colourways stay darker than snow, so the player reads on the pass.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, torsoSkin, legSkin, blend2, buildGlove, buildBoot, buildGloveDetail, buildBootDetail, stitchLine, buckleAt, carabiner, panel, strapAlong, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, sleeveSkin, elbowLiner, jacketSkirt, skirtMap, beltRing, beltMap, blouseRows, blouseDisp, beltPin } from './outfit-maps-lib.js';

export const MAP_ID = 'col-blanc', MAP_NAME = 'Col Blanc';
// ---------------------------------------------------------------- colourways (the map's own palette first)
const pbr = { cloth: [.7, 0, 0, .6], cloth2: [.8, 0, 0, .7], plate: [.42, .05, 0, 0], plate2: [.78, 0, 0, .5], rubber: [.65, 0, 0, .2], accent: [.6, 0, .04, .4], visor: [.06, .5, .02, 0] };
const P = o => ({ pbr, fpKit: 'plain', fpGlove: o.rubber, ...o });       // first-person gloves in the colour of the third-person gloves
const OUT = [
  ['col-blanc', 'Col Blanc', 'Légende', 15000, { cloth: 0x2c4a3a, cloth2: 0x383d42, plate: 0xb8452a, plate2: 0x5a4030, rubber: 0x1b1c1d, metal: 0xa4a8ac, accent: 0xd4b020, glow: 0xfff0c0, visor: 0x101a22, rim: 0x5a6a62, lift: .022 }],
  ['balise', 'Balise', 'Épique', 9000, { cloth: 0xa83222, cloth2: 0x2a2c30, plate: 0x2a2c30, plate2: 0x3a3028, rubber: 0x181818, metal: 0xa8acb0, accent: 0x2a8ac8, glow: 0xfff0c0, visor: 0x101a22, rim: 0x6a5450, lift: .02 }],
  ['ardoise', 'Ardoise', 'Épique', 9000, { cloth: 0x34383e, cloth2: 0x24262a, plate: 0xd0a018, plate2: 0x46362a, rubber: 0x141516, metal: 0xa0a4a8, accent: 0xc8402a, glow: 0xfff0c0, visor: 0x101a22, rim: 0x707880, lift: .035 }],
  ['myrtille', 'Myrtille', 'Épique', 9000, { cloth: 0x3a3060, cloth2: 0x2e3238, plate: 0x7a9a3a, plate2: 0x4a3a2c, rubber: 0x18181a, metal: 0xa4a8ac, accent: 0xe07a20, glow: 0xfff0c0, visor: 0x101a22, rim: 0x6a6480, lift: .025 }],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal]) => ({ id: 'cordee-' + k, setId: 'cordee', name: 'CORDÉE', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal) }));

const H = B.HEA, C = B.CHE;
// ---------------------------------------------------------------- head: neck warmer, glacier glasses, climbing helmet
const rimLat = lon => lerp(.32, -.3, ((1 - Math.cos(lon)) / 2) ** 1.1);
const shell = (lon, lat, off = 0) => headP(lon, lat, .02 + .005 * Math.sin(Math.max(0, lat)) ** 2 + off);
function head(m) {
  headBase(m, S.RUBBER);
  // fleece neck warmer up to just under the nose
  const top = a => lerp(-.2, -.6, ((1 - Math.cos(a)) / 2) ** .9);
  m.grid(m.seg(26, 10), m.seg(10, 5), (u, v) => { const a = u * TAU; if (v <= .4) { const y = lerp(1.462, 1.565, v / .4), r = 1 + .05 * Math.sin(y * 150 + a) * (m.lod === 2 ? 0 : 1); return [.07 * r * Math.sin(a), y, .002 - .068 * r * Math.cos(a)]; } const lat = lerp(-1.02, top(a), (v - .4) / .6), h = headP(a, lat, .0085), n = [.07 * Math.sin(a), h[1], .002 - .068 * Math.cos(a)], k = sstep(-.006, .006, Math.hypot(h[0], h[2] + .004) - Math.hypot(n[0], n[2] + .004)); return [lerp(n[0], h[0], k), h[1], lerp(n[2], h[2], k)]; },
    { wrapU: true, slot: S.CLOTH2, skin: (x, y) => y > 1.585 ? [H, 1] : blend2(B.NEC, H, y, 1.57, .02), crease: 180, out: (x, y, z) => [x, 0, z - .004], ao: (x, y) => .62 + .38 * sstep(1.47, 1.56, y) });
  // glacier glasses: two round lenses, leather side shields, a cord behind
  for (const s of [-1, 1]) {
    const M = bodyFrame(headP(s * .37, .05, .03), s * .33, -.04);
    m.revolve([[.0005, .004], [.022, .003], [.0245, .0], [.0245, -.004], [.021, -.006]], { sides: m.keep(1) ? 16 : 8, slot: S.RUBBER, skin: H, m: M.clone().multiply(T(0, 0, .0, Math.PI / 2, 0, 0)), crease: 50 });
    m.revolve([[.0005, .006], [.019, .0052], [.0205, .0045]], { sides: m.keep(1) ? 16 : 8, slot: S.VISOR, skin: H, m: M.clone().multiply(T(0, 0, .0, Math.PI / 2, 0, 0)), crease: 60 });
    panel(m, (u, v, h) => headP(s * u, v, .014 + h), .8, 1.22, -.08, .2, { t: .003, nu: 4, nv: 3, slot: S.PLATE2, skin: H, edge: .15, round: .5, out: outH });
    m.tube([headP(s * 1.2, .1, .016), headP(s * 1.6, .06, .012), headP(s * 2.3, -.15, .012)], .0018, { slot: S.RUBBER, skin: H, sides: 3, n: 6 });
  }
  m.tube([headP(-.13, .07, .028), headP(0, .085, .031), headP(.13, .07, .028)], .0028, { slot: S.RUBBER, skin: H, sides: 4, n: 5 });
  // helmet: a low shell, vents, an elastic lamp band without the lamp, the webbing cradle and chin strap
  const nu = m.seg(36, 14);
  m.grid(nu, m.seg(9, 4), (u, v) => { const lon = u * TAU - Math.PI; return shell(lon, lerp(rimLat(lon), Math.PI / 2, v ** .85)); }, { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 180, out: outH, ao: (x, y) => .82 + .18 * sstep(1.7, 1.79, y) });
  m.grid(nu, 1, (u, v) => { const lon = u * TAU - Math.PI, l = rimLat(lon); return headP(lon, l + .002 - .006 * v, lerp(.02, .004, v)); }, { wrapU: true, slot: S.RUBBER, skin: H, crease: 180, out: (x, y, z) => [0, -1, 0], ao: .4 });
  if (m.keep(1)) m.tube(Array.from({ length: 33 }, (_, i) => { const lon = i / 32 * TAU - Math.PI; return shell(lon, rimLat(lon) + .006, .0012); }), .0028, { slot: S.RUBBER, skin: H, sides: 4, n: m.seg(40, 14), cap: false });
  if (m.keep(1)) for (const s of [-1, 1]) for (const lon of [.35, .95, 1.6, 2.3]) panel(m, (u, v, h) => shell(s * u, v, h + .0005), lon - .12, lon + .12, .75, .95, { t: .002, nu: 2, nv: 2, slot: S.RUBBER, skin: H, edge: .2, round: .9, out: outH });
  { const pts = []; for (let i = 0; i <= 28; i++) { const lon = i / 28 * TAU - Math.PI, lat = lerp(.48, .08, ((1 - Math.cos(lon)) / 2)); pts.push(shell(lon, lat, .002)); } padSweep(m, pts, .02, .0025, outH, { slot: S.ACCENT, skin: H, k: 6, e: 4, puff: 0, step: .02, ends: false }); }
  for (const s of [-1, 1]) m.tube([shell(s * 1.5, rimLat(s * 1.5) + .03, -.004), headP(s * 1.25, -.5, .007), headP(s * .5, -.98, .012)], .004, { slot: S.RUBBER, skin: H, sides: 4, flat: .3, n: m.seg(8, 4), up: [0, 0, 1] });
}

// ---------------------------------------------------------------- softshell jacket, hood at the back
const BELT = [.968, .1665, .1265, { w: .046, t: .008, sag: .006, cz: .002 }], belt = beltMap(...BELT);
const JK0 = [[.955, .166, .126, .002], [.975, .165, .125, .002], [.995, .167, .127, .001], [1.02, .17, .129, 0], [1.05, .168, .126, 0], [1.1, .163, .121, 0], [1.16, .167, .123, 0], [1.24, .179, .129, 0], [1.32, .188, .133, 0], [1.39, .19, .132, .002], [1.435, .183, .125, .005], [1.465, .157, .111, .006], [1.49, .119, .095, .005], [1.512, .091, .083, .004]];
const JK = blouseRows(JK0, BELT[0], BELT[1], BELT[2], BELT[3].w, .007, BELT[3]), blouse = blouseDisp(BELT[0], BELT[3].w, .04);
const PIN_JK = beltPin(BELT, .0035, { above: .0015, below: .04 }), PIN_SK = beltPin(BELT, .0015, { below: .04 }), PIN_TR = beltPin(BELT, .012, { below: .06 });       // trousers well inside the skirt: the thighs swing under it
const jkDisp = (a, y) => blouse(a, y) + .02 * Math.sin(a * 4 + y * 12) * bump(y, 1.25, .15) * Math.max(0, -Math.cos(a)) + .008 * Math.sin(a * 5 + y * 18);
const jacketUp = garmentMap(JK, { e: 2.5, disp: jkDisp, pin: PIN_JK });
const SKIRT = { y0: .985, y1: .9, r0: [.171, .131], r1: [.212, .15], cz: .004, fold: .02, flare: .6, sag: .005, vent: 0, kMax: .25, pin: PIN_SK }, skirt = skirtMap(SKIRT);
const jacket = (a, y, h = 0) => (y < .985 ? skirt(a, y, h) : jacketUp(a, y, h));       // the jacket's outer surface, skirt below the waist
const SLR = [[.893, .052], [.9, .058], [.95, .06], [1.0, .061], [1.06, .062], [1.12, .064], [1.16, .065], [1.2, .066], [1.26, .069], [1.34, .074], [1.4, .077], [1.43, .075], [1.455, .066], [1.474, .048], [1.486, .022]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .02 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12) + .05 * Math.sin(y * 120) * bump(y, .95, .05);
const sleeve = s => garmentMap(SLR, { e: 2.05, cx: s * .2, disp: slDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
function jacketBody(m) {
  garment(m, JK, { n: 28, e: 2.5, disp: jkDisp, pin: PIN_JK, slot: S.CLOTH, skin: torsoSkin, sub: 2, capA: true, out: (x, y, z) => [x, y > 1.46 ? .6 : y < .96 ? -.5 : 0, z], ao: foldAo(jkDisp) });
  jacketSkirt(m, { ...SKIRT, slot: S.CLOTH, lining: S.CLOTH2 });
  garment(m, [[1.465, .095, .089, .006], [1.52, .088, .083, .006], [1.565, .084, .079, .006]], { n: 24, e: 2.2, slot: S.CLOTH, skin: (x, y) => blend2(C, B.NEC, y, 1.52, .03), out: (x, y, z) => [x, 0, z], ao: .85 });
  garment(m, [[1.54, .076, .072, .006], [1.565, .084, .079, .006]], { n: 24, e: 2.2, slot: S.CLOTH2, skin: B.NEC, out: () => [0, 1, 0], ao: .5 });
  for (const s of [-1, 1]) {
    elbowLiner(m, s, SLR);
    garment(m, SLR, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .9 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), .912, .03, { n: 16, h0: .001, t: .003, slot: S.CLOTH2, skin: s < 0 ? B.FAL : B.FAR, out: (x, y, z) => [x - s * .2, 0, z] });
    bandOn(m, (a, y, h) => sleeve(s)(a, y, h), 1.28, .032, { n: 16, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: (x, y, z) => [x - s * .2, 0, z] });
    // shoulder reinforcement in the trouser colour, diagonal chest zip pocket
    panel(m, (u, v, h) => jacket(s * u, v, h + .0015), .7, 1.9, 1.38, 1.5, { t: .0025, nu: 8, nv: 3, slot: S.CLOTH2, skin: torsoSkin, edge: .1, round: .3, out: (x, y, z) => [x, .6, z] });
    if (m.keep(1)) m.tube(Array.from({ length: 6 }, (_, i) => jacket(s * lerp(.12, .55, i / 5), lerp(1.42, 1.3, i / 5), .004)), .0022, { slot: S.ACCENT, skin: torsoSkin, sides: 3, n: 8, cap: false });
  }
  // front zip and the hood hanging behind the neck
  if (m.keep(1)) m.tube(Array.from({ length: 9 }, (_, i) => jacket(0, lerp(.91, 1.56, i / 8), .003)), .0024, { slot: S.ACCENT, skin: torsoSkin, sides: 3, n: m.seg(20, 8), cap: false });
  m.grid(m.seg(16, 6), m.seg(6, 3), (u, v) => { const a = Math.PI + lerp(-1.2, 1.2, u), w = Math.cos(lerp(-1.2, 1.2, u) * 1.1), r = lerp(.1, .135 + .02 * w, Math.sin(v * Math.PI / 2)), y = lerp(1.53, 1.36 + .02 * (1 - w), v) + .02 * Math.sin(v * Math.PI) * w; return [r * Math.sin(a), y, .01 - r * .95 * Math.cos(a) + .022 * Math.sin(v * Math.PI) * w]; }, { slot: S.CLOTH, skin: (x, y) => y > 1.5 ? blend2(C, B.NEC, y, 1.52, .02) : [C, 1], crease: 180, out: (x, y, z) => [x * .5, .4, z], ao: .8 });
}

// ---------------------------------------------------------------- harness, rope coil
const P2 = B.PEL;
function harness(m) {
  // padded waist belt (wider at the back), its buckle, the belay loop, leg loops and their risers
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.PLATE2, skin: P2, buckle: 'frame', buckleA: .14, keepers: [-.4, 1.0, -1.0] });
  strapAlong(m, [jacket(-.115, .95, .016), [-.06, .918, -.166], [0, .904, -.172], [.06, .918, -.166], jacket(.115, .95, .016)], .022, .006, () => [0, -.2, -1], { slot: S.ACCENT, skin: P2, n: m.seg(16, 6) });       // belay loop: flat sewn webbing
  for (const s of [-1, 1]) {
    const TH = s < 0 ? B.THL : B.THR, loop = Array.from({ length: 14 }, (_, i) => { const th = i / 14 * TAU, R = .114; return [s * .1 + s * R * Math.sin(th), .845 + .03 * (1 - Math.cos(th)) + .012 * Math.max(0, -Math.sin(th)), .004 - R * Math.cos(th)]; });
    strapAlong(m, loop, .036, .008, (x, y, z) => [x - s * .1, 0, z - .004], { slot: S.PLATE2, skin: TH, closed: true, n: m.seg(28, 10) });
    strapAlong(m, [jacket(s * .08, .95, .018), [s * .06, .9, -.15], [s * .075, .875, -.12]], .02, .004, (x, y, z) => [x, 0, z - .02], { slot: S.ACCENT, skin: (x, y) => { const k = sstep(.95, .87, y); return k <= 0 ? [P2, 1] : k >= 1 ? [TH, 1] : [P2, 1 - k, TH, k]; }, n: m.seg(6, 3) });
    // gear loop with two carabiners and a sling, an ice screw on the right
    const ga = s * 1.55, gp = jacket(ga, .95, .02);
    m.tube([jacket(s * 1.25, .948, .016), [gp[0] + s * .012, gp[1] - .016, gp[2]], jacket(s * 1.85, .948, .016)], .0035, { slot: S.RUBBER, skin: P2, sides: 4, n: 6 });
    if (m.keep(1)) for (const k of [-1, 1]) { const c = jacket(ga + k * .14, .92, .03); carabiner(m, c, [Math.sin(ga), 0, -Math.cos(ga)], { up: [0, 1, 0], skin: P2, a: .009, b: .02, r: .0022 }); }
    if (s > 0) { const c = jacket(ga + .32, .93, .03); m.revolve([[.008, .03], [.011, .026], [.011, -.02], [.004, -.05]], { sides: m.keep(1) ? 8 : 5, slot: S.METAL, skin: P2, m: T(c[0], c[1], c[2]), crease: 50 }); }
    else if (m.keep(1)) m.tube([jacket(ga - .1, .93, .026), [gp[0] - .03, gp[1] - .09, gp[2] + .01], [gp[0] - .05, gp[1] - .1, gp[2] + .02], jacket(ga + .16, .93, .026)], .0055, { slot: S.ACCENT, skin: P2, sides: 4, flat: .4, n: 10 });
  }
}
/** The rope coiled across the body: tilted loops over the right shoulder and under the left arm, each a little proud of the last. */
function rope(m) {
  const loop = (k, n) => { const pts = []; for (let i = 0; i <= n; i++) { const a = i / n * TAU, t = Math.sin(a - .2 + k * .025), y = 1.2 + .25 * t + .0105 * k - .015, side = Math.sin(a), h = .016 + k * .0045 + .022 * sstep(1.38, 1.48, y); const p = jacket(a, Math.min(y, 1.49), h); if (y > 1.49) p[1] += (y - 1.49) * .55; p[0] += side > 0 ? .018 * sstep(1.38, 1.46, y) : 0; pts.push(p); } return pts; };
  for (let k = 0; k < (m.keep(1) ? 4 : 2); k++) m.tube(loop(k, 40), .0074, { slot: S.ACCENT, skin: torsoSkin, sides: m.keep(0) ? 9 : 4, n: m.seg(64, 20), cap: false });
}

// ---------------------------------------------------------------- pack with ice axe and crampons
function pack(m) {
  const back = (u, v, h) => jacket(Math.PI + u, v, h + .006);
  panel(m, back, -.58, .58, 1.04, 1.44, { t: .06, nu: 10, nv: 8, slot: S.CLOTH2, skin: C, edge: .12, round: .55, dome: .012, out: (x, y, z) => [x * .3, 0, z] });
  panel(m, (u, v, h) => back(u, v, h + .066), -.5, .5, 1.36, 1.47, { t: .02, nu: 8, nv: 3, slot: S.CLOTH2, skin: C, edge: .15, round: .6, out: (x, y, z) => [x * .3, .4, z] });       // lid
  for (const s of [-1, 1]) strapAlong(m, [back(s * .45, 1.42, .03), jacket(s * 2.2, 1.49, .012), jacket(s * 1.1, 1.505, .012), jacket(s * .6, 1.44, .01), jacket(s * .55, 1.3, .012), jacket(s * .62, 1.18, .014), jacket(s * 1.05, 1.12, .02), back(s * .52, 1.08, .03)], .036, .006, (x, y, z) => [x, y > 1.47 ? 1 : 0, z], { slot: S.CLOTH2, skin: torsoSkin, n: m.seg(30, 9) });
  if (m.keep(1)) strapAlong(m, [jacket(-.6, 1.33, .02), jacket(0, 1.35, .024), jacket(.6, 1.33, .02)], .018, .004, (x, y, z) => [x, 0, z], { slot: S.RUBBER, skin: C, n: 8 });
  // ice axe: shaft down the pack, head across the top
  const F = bodyFrame(back(-.18, 1.25, .075), Math.PI - .18);
  m.tube([xf(F, [0, -.24, 0]), xf(F, [0, .05, .004]), xf(F, [0, .26, .006])], t => lerp(.008, .011, t), { slot: S.METAL, skin: C, sides: m.keep(1) ? 8 : 5, n: m.seg(8, 3), cap: true });
  if (m.keep(1)) m.tube([xf(F, [0, -.24, 0]), xf(F, [0, -.12, .002])], .0125, { slot: S.RUBBER, skin: C, sides: 8, n: 3 });
  m.box([0, .275, .006], [.03, .03, .022], .005, { slot: S.METAL, skin: C, m: F });
  m.tube([xf(F, [.012, .28, .006]), xf(F, [.06, .272, .006]), xf(F, [.1, .25, .006]), xf(F, [.118, .228, .006])], t => lerp(.006, .002, t), { slot: S.METAL, skin: C, sides: 4, flat: .5, n: 6, up: [0, 0, 1] });
  m.box([-.04, .28, .006], [.06, .012, .016], .003, { slot: S.METAL, skin: C, m: F });
  // crampons: a hinged frame of two plates with their points, strapped flat to the pack
  const G = bodyFrame(back(.12, 1.2, .066), Math.PI + .12);
  for (const [y0, y1] of [[-.11, -.02], [.0, .1]]) { m.box([0, (y0 + y1) / 2, 0], [.07, y1 - y0, .006], .002, { slot: S.METAL, skin: C, m: G }); if (m.keep(1)) for (const x of [-.033, .033]) for (const y of [y0 + .015, y1 - .015]) m.box([x, y, .012], [.005, .005, .02], .001, { slot: S.METAL, skin: C, m: G }); }
  if (m.keep(1)) { m.box([0, -.01, .004], [.012, .03, .004], .001, { slot: S.METAL, skin: C, m: G }); m.box([0, .0, .005], [.09, .018, .004], .002, { slot: S.ACCENT, skin: C, m: G }); }
}

// ---------------------------------------------------------------- trousers and gaiters
const LG = [[.36, .074], [.4, .078], [.47, .08], [.52, .081], [.57, .083], [.65, .091], [.75, .1], [.85, .104], [.89, .098], [.92, .086], [.945, .07], [.965, .058], [.985, .05]].map(r => [r[0], r[1], r[1] * 1.04, .004]);
const lgDisp = (a, y) => .05 * Math.sin(y * 120) * bump(y, .5, .07) * Math.max(0, -Math.cos(a)) ** 1.5 + .025 * Math.sin(a * 2 + y * 14) * bump(y, .78, .15) + .012 * Math.sin(a * 3 + y * 9);
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp });
const GT = [[.17, .072], [.2, .078], [.26, .08], [.33, .084], [.4, .086], [.44, .084]].map(r => [r[0], r[1], r[1] * 1.08, .008]);
const gaiter = s => garmentMap(GT, { e: 2.2, cx: s * .1 });
function legs(m) {
  garment(m, [[.83, .15, .118, .004], [.87, .16, .124, .004], [.92, .162, .125, .003], [.965, .158, .12, .002]], { n: 26, e: 2.15, pin: PIN_TR, slot: S.CLOTH2, skin: torsoSkin, capA: true, out: (x, y, z) => [x, y < .85 ? -.6 : 0, z], ao: .7 });      // seat, under the jacket
  for (const s of [-1, 1]) {
    const SH = s < 0 ? B.SHL : B.SHR, TH = s < 0 ? B.THL : B.THR;
    garment(m, LG, { n: 16, e: 2.1, cx: s * .1, disp: lgDisp, pin: PIN_TR, slot: S.CLOTH2, skin: legSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .1, y > .97 ? .3 : 0, z], ao: foldAo(lgDisp, s * .1) });
    // articulated knee: two darts above and below the knee
    panel(m, (u, v, h) => leg(s)(u, v, h + .0015), -1.0, 1.0, .46, .6, { t: .0028, nu: 8, nv: 4, slot: S.CLOTH2, skin: (px, py) => blend2(SH, TH, py, .53, .04), edge: .12, round: .55, dome: .002, out: (x, y, z) => [x - s * .1, 0, z] });
    // gaiter over the boot top and the shin, its strap under the instep, its top drawcord
    garment(m, GT, { n: 18, e: 2.2, cx: s * .1, slot: S.PLATE2, skin: (x, y) => y > .25 ? [SH, 1] : blend2(s < 0 ? B.FOL : B.FOR, SH, y, .16, .035), capA: false, out: (x, y, z) => [x - s * .1, 0, z - .008], ao: (x, y) => .75 + .25 * sstep(.18, .3, y) });
    garment(m, [[.43, .078, .084, .008], [.44, .086, .093, .008], [.448, .084, .091, .008]], { n: 18, e: 2.2, cx: s * .1, slot: S.PLATE2, skin: SH, out: (x, y, z) => [x - s * .1, .4, z], ao: .7 });
    panel(m, (u, v, h) => gaiter(s)(u, v, h + .001), -.32, .32, .19, .42, { t: .003, nu: 3, nv: 6, slot: S.PLATE2, skin: (x, y) => y > .25 ? [SH, 1] : blend2(s < 0 ? B.FOL : B.FOR, SH, y, .16, .035), edge: .2, round: .2, out: (x, y, z) => [x - s * .1, 0, z] });
    m.tube([[s * .1 - s * .055, .07, -.03], [s * .1, .02, -.035], [s * .1 + s * .055, .07, -.03]], .004, { slot: S.RUBBER, skin: s < 0 ? B.FOL : B.FOR, sides: 4, flat: .4, n: 6, up: [0, 0, 1] });
  }
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  for (const s of [-1, 1]) { buckleAt(m, [s * .224, .875, .004], [s, 0, 0], { up: [0, 0, 1], skin: s < 0 ? B.THL : B.THR, w: .02, d: .016 }); stud(m, gaiter(s)(0, .41, .004), [0, 0, -1], { skin: s < 0 ? B.SHL : B.SHR, r: .0045 }); }
  for (const s of [-1, 1]) stitchLine(m, Array.from({ length: 12 }, (_, i) => leg(s)(lerp(-1.3, 1.3, i / 11), .62, .0032)), { skin: s < 0 ? B.THL : B.THR, n: 24 });
  for (let k = 0; k < 6; k++) m.box([0, 0, 0], [.004, .02, .003], .001, { slot: S.METAL, skin: P2, m: bodyFrame(belt(lerp(-1.3, 1.3, k / 5), .0005), lerp(-1.3, 1.3, k / 5)) });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.ACCENT }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  head, jacketBody, harness, rope, pack, legs,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.PLATE2, slotToe: S.PLATE2, slotRand: S.PLATE2, slotSole: S.RUBBER, slotMid: S.RUBBER, slotWelt: S.RUBBER, slotTongue: S.PLATE2, slotPanel: S.PLATE2 }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.RUBBER, slotCuff: S.CLOTH2, guard: false, cuff: false }); },
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['head', 'jacket', 'harness', 'rope', 'pack', 'legs', 'boots', 'gloves']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
