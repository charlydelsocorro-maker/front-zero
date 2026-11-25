// outfit-map-marais.js — FRONT ZÉRO: ROSELIER, the outfit of the Marais de Saulnes map. Original design: the marsh scout of the stilt village, who
// sets the eel traps and knows every channel through the reeds. A wide-brimmed waxed hat with a dented crown and a mosquito veil hanging from the brim,
// gathered at the neck by a drawcord; a waxed cotton smock; a short cape of reed bundles over the shoulders and down the back, tied at the neck, its
// front lappets on the chest; rubber bib overalls with braces and a leather belt; hip boots folded down below the knee; a line of cork net floats worn
// across the body; a storm lantern on the left hip (a lit globe only: it casts no light), a knife in its sheath on the right; long rubber gauntlets.
// Not a wader-wearing cistern man, not a ghillie sniper. No insignia, name, number or text anywhere.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import * as THREE from 'three';
import { BONE as B, SLOT as S, T, torsoSkin, legSkin, blend2, buildGlove, buildBoot, stitchLine, panel, strapAlong, planeMap, defineOutfitSet } from './outfit-kit.js';
import { TAU, bump, lerp, clamp, sstep, rowAt, garment, garmentMap, bandOn, padSweep, xf, bodyFrame, stud, headP, outH, headBase, HC, HR, sleeveSkin, elbowLiner, beltRing, beltMap, beltPin, legsFromHips } from './outfit-maps-lib.js';

export const MAP_ID = 'marais', MAP_NAME = 'Marais de Saulnes';
// ---------------------------------------------------------------- colourways (the map's own palette first: dry reed, peat water, mud, the brown of
// tarred timber; dark rims and a low lift, the straw cape and the floats keep the figure apart from the reed beds)
const pbr = { cloth: [.62, 0, 0, .55], cloth2: [.86, 0, 0, .8], plate: [.58, 0, 0, .4], plate2: [.4, 0, 0, .06], rubber: [.6, 0, 0, .12], metal: [.42, .55, 0, 0], accent: [.7, 0, .03, .3], visor: [.88, 0, 0, .5] };       // visor slot = the veil's net fabric
const P = (o, straw) => ({ pbr, fpKit: 'plain', fpGlove: o.plate2, pattern: { type: 5, scale: 8, strength: .8, a: o.cloth, b: straw }, ...o });       // pattern: vertical streaks along the reeds (the smock keeps its own colour)
const OUT = [
  ['saulnes', 'Saulnes', 'Légende', 15000, { cloth: 0x3d4a5a, cloth2: 0x9a8352, plate: 0x4e3c2a, plate2: 0x343a28, rubber: 0x1a1c18, metal: 0x9c8c62, accent: 0xc0522c, glow: 0xffc870, visor: 0x56604e, rim: 0x3a3428, lift: .012, floor: .01 }, 0x6e5c34],
  ['vasiere', 'Vasière', 'Épique', 9000, { cloth: 0x4c4c48, cloth2: 0x8a7a5c, plate: 0x6a6458, plate2: 0x40423e, rubber: 0x181816, metal: 0x8e8a80, accent: 0xd4ac3e, glow: 0xffd890, visor: 0x5e5e56, rim: 0x36332e, lift: .012, floor: .01 }, 0x5e523c],
  ['heron', 'Héron', 'Épique', 9000, { cloth: 0x585440, cloth2: 0x9c9270, plate: 0x2c3842, plate2: 0x283036, rubber: 0x16181a, metal: 0x9aa0a4, accent: 0xc6402a, glow: 0xffe0b0, visor: 0x4e5a60, rim: 0x2e3842, lift: .012, floor: .01 }, 0x6c6448],
  ['tourbe', 'Tourbe', 'Épique', 9000, { cloth: 0x37392f, cloth2: 0x705a36, plate: 0x2a221c, plate2: 0x3a2418, rubber: 0x141312, metal: 0x8e7c58, accent: 0xd0862a, glow: 0xffc060, visor: 0x4c4638, rim: 0x342c24, lift: .014, floor: .01 }, 0x4a3a22],
];
export const OUTFIT_SETS = OUT.map(([k, c, r, cr, pal, straw]) => ({ id: 'roselier-' + k, setId: 'roselier', name: 'ROSELIER', colorway: c, rarity: r, price: { credits: cr }, map: MAP_ID, mapName: MAP_NAME, palette: P(pal, straw) }));

const H = B.HEA, C = B.CHE, P2 = B.PEL;
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// ---------------------------------------------------------------- head: wide-brimmed waxed hat, mosquito veil to the neck
const bandY = lon => 1.698 - .005 * Math.cos(lon);                            // the hat sits level, a touch lower at the front
const latOfY = y => Math.asin(clamp((y - HC[1]) / .101, -1, 1));
const crown = (lon, v, off = 0) => {      // a soft cylinder of a crown: walls rising from the band, a rounded top with a centre dent, pinched at the front
  const yb = bandY(lon), b = headP(lon, latOfY(yb), .013), rb = Math.hypot(b[0] - HC[0], b[2] - HC[2]) + off, sn = Math.sin(lon), cs = Math.cos(lon);
  const pinch = 1 - .07 * Math.exp(-(((Math.abs(lon) - .55) / .25) ** 2)) * sstep(.35, .8, v), W = .07;
  let r, y; if (v <= .55) { const t = v / .55; r = rb * (1 - .045 * t) + .003 * Math.sin(Math.PI * t); y = yb + W * t; }
  else { const w = (v - .55) / .45; r = rb * .955 * Math.cos(w * Math.PI / 2); y = yb + W + .021 * Math.sin(w * Math.PI / 2) - .012 * sstep(.45, 1, w) + off * .6; }
  r *= pinch; return [HC[0] + r * sn, y, HC[2] - r * cs];
};
const BR = [.17, .184];       // outer half-sizes of the brim
const brim = (lon, t, h = 0) => {       // t 0 at the crown, 1 at the edge; the brim droops toward its edge, more at the front and back
  const c = crown(lon, 0), r0 = Math.hypot(c[0] - HC[0], c[2] - HC[2]), sn = Math.sin(lon), cs = Math.cos(lon), ro = Math.hypot(BR[0] * sn, BR[1] * cs), r = lerp(r0, ro, t);
  return [HC[0] + r * sn, bandY(lon) - .002 - (.016 + .014 * cs * cs) * t ** 1.7 + h, HC[2] - r * cs];
};
// the veil: net fabric hung from under the brim, falling onto the face (it shows the nose and chin under it), bridging from the chin to a drawstring at
// the neck, then a short soft skirt laid over the cape's collar. Its radius round the head is a drape: from the brim it may only fall inward so fast,
// and it rests on the head wherever the head stands out further (one table per longitude, built once).
const VN = 1.522, NECK = [.098, .093], VTOP = .86;
const neckR = lon => { const s = Math.sin(lon) / NECK[0], c = Math.cos(lon) / NECK[1]; return 1 / Math.hypot(s, c); };
const headR = (lon, y, off) => { const k = (y - HC[1]) / (HR[1] + off); if (k >= .985 || k <= -.985) return 0; const p = headP(lon, Math.asin(k), off); return Math.hypot(p[0] - HC[0], p[2] - HC[2]); };
const DRAPE = new Map();
function drapeOf(lon) {
  const key = Math.round(lon * 1e4); let t = DRAPE.get(key); if (t) return t;
  const top = brim(lon, VTOP, -.004), r0 = Math.hypot(top[0] - HC[0], top[2] - HC[2]), K = 48, ys = [], rs = [], body = [];
  let r = r0;
  for (let i = 0; i <= K; i++) {
    const y = lerp(top[1], VN, i / K), dy = i ? (top[1] - VN) / K : 0, rb = Math.max(headR(lon, y, .018), y < 1.64 ? neckR(lon) + .006 : 0);
    r = Math.max(rb, r - 1.1 * dy); r = lerp(r, neckR(lon) + .004, sstep(VN + .03, VN, y)); ys.push(y); rs.push(r); body.push(rb);
  }
  t = { ys, rs, body, top }; DRAPE.set(key, t); return t;
}
/** Point of the veil at longitude lon, v 0 (brim) .. 1 (drawstring), raised by off. Where it hangs free of the head it takes a few soft folds. */
const veilAt = (lon, v, off = 0) => {
  const t = drapeOf(lon), f = clamp(v, 0, 1) * (t.ys.length - 1), i = Math.min(t.ys.length - 2, Math.floor(f)), k = f - i;
  const y = lerp(t.ys[i], t.ys[i + 1], k), r0 = lerp(t.rs[i], t.rs[i + 1], k), free = sstep(0, .012, r0 - lerp(t.body[i], t.body[i + 1], k));
  const r = r0 + off + .0045 * Math.sin(lon * 9 + v * 2) * free * Math.sin(Math.PI * v);
  return [HC[0] + r * Math.sin(lon), y, HC[2] - r * Math.cos(lon)];
};
/** The skirt below the drawstring: from the gathered neck out to a soft hem tucked under the reed cape's collar. */
const veilSkirt = (lon, v, off = 0) => {
  const a = veilAt(lon, 1, .002), b = cape(lon, 1.482 + .004 * Math.sin(lon * 7 + 1), .006), k = sstep(0, 1, v), bulge = .004 * Math.sin(Math.PI * v);       // the hem goes in under the cape's collar
  const x = lerp(a[0], b[0], k), z = lerp(a[2], b[2], k), rr = Math.hypot(x - HC[0], z - HC[2]) || 1;
  return [x + (x - HC[0]) / rr * (bulge + off), lerp(a[1], b[1], v) + .004 * Math.sin(Math.PI * v), z + (z - HC[2]) / rr * (bulge + off)];
};
const NET = 1.35, NV0 = .07, NV1 = .86;       // up close the front of the veil is real net (open), over the shadowed face and a neckerchief
const veilSkin = (x, y) => (y > 1.58 ? [H, 1] : blend2(B.NEC, H, y, 1.56, .03));
function head(m) {
  // drawn from the outside in (brim, crown, veil, then what they hide), so the depth test spares the hidden layers
  const nb = m.seg(40, 14), nr = m.seg(6, 2);
  m.grid(nb, nr, (u, v) => brim(u * TAU - Math.PI, v, .0022), { wrapU: true, slot: S.PLATE, skin: H, crease: 180, out: () => [0, 1, 0], ao: .95 });
  m.grid(nb, m.seg(6, 3), (u, v) => { const lon = u * TAU - Math.PI, c = brim(lon, 1), g = (v - .5) * Math.PI, r = .0036, sn = Math.sin(lon), cs = Math.cos(lon); return [c[0] + sn * r * Math.cos(g) * .9, c[1] + r * Math.sin(g) * 1.05, c[2] - cs * r * Math.cos(g) * .9]; }, { wrapU: true, slot: S.PLATE, skin: H, crease: 180, out: (x, y, z) => [x - HC[0], 0, z - HC[2]], ao: .9 });
  m.grid(m.seg(30, 12), m.seg(9, 4), (u, v) => crown(u * TAU - Math.PI, v), { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 180, out: outH, ao: (x, y) => .82 + .18 * sstep(1.72, 1.79, y) });
  bandOn(m, (lon, y, h) => { const c = crown(lon, (y - 1.698) / .07 * .55, h); return [c[0], c[1], c[2]]; }, 1.712, .022, { n: 30, h0: .001, t: .003, slot: S.CLOTH2, skin: H, out: outH });
  // the skirt over the cape's collar, the drawstring with its toggle and tails
  m.grid(m.seg(36, 12), m.seg(3, 2), (u, v) => veilSkirt(u * TAU - Math.PI, v), { wrapU: true, slot: S.VISOR, skin: (x, y) => blend2(C, B.NEC, y, 1.5, .03), crease: 180, out: (x, y, z) => [x - HC[0], .6, z - HC[2]], ao: .8 });
  m.tube(Array.from({ length: 29 }, (_, i) => veilAt(i / 28 * TAU, 1, .003)), .0034, { slot: S.RUBBER, skin: B.NEC, sides: m.keep(1) ? 6 : 4, n: m.seg(36, 12), cap: false, up: [0, 1, 0] });
  if (m.keep(1)) { const k0 = veilAt(0, 1, .007); m.revolve([[0, .009], [.0055, .007], [.006, -.006], [0, -.008]], { sides: 8, slot: S.PLATE, skin: B.NEC, m: T(k0[0], k0[1] - .002, k0[2]), crease: 50 });
    for (const s of [-1, 1]) m.tube([k0, [k0[0] + s * .005, k0[1] - .016, k0[2] - .006], [k0[0] + s * .007, k0[1] - .03, k0[2] - .012]], .002, { slot: S.RUBBER, skin: C, sides: 4, n: 6, cap: true }); }
  // the veil itself: far away one fabric surface with a shadow where the face is; up close the front is open net over the face
  const face = (x, y, z) => { const lon = Math.atan2(x - HC[0], -(z - HC[2])); return 1 - .5 * Math.exp(-((lon / .8) ** 2)) * bump(y, 1.63, .07); };
  if (!m.keep(0)) m.grid(m.seg(36, 12), m.seg(12, 4), (u, v) => veilAt(u * TAU - Math.PI, v), { wrapU: true, slot: S.VISOR, skin: veilSkin, crease: 180, out: outH, ao: face });
  else {
    m.grid(26, 12, (u, v) => veilAt(lerp(NET, TAU - NET, u), v), { slot: S.VISOR, skin: veilSkin, crease: 180, out: outH, ao: .85 });
    for (const [v0, v1, nv] of [[0, NV0 + .02, 1], [NV1 - .02, 1, 2]]) m.grid(18, nv, (u, v) => veilAt(lerp(-NET, NET, u), lerp(v0, v1, v)), { slot: S.VISOR, skin: veilSkin, crease: 180, out: outH, ao: .8 });
    for (let k = 0; k <= 7; k++) m.tube(Array.from({ length: 17 }, (_, i) => veilAt(lerp(-NET - .02, NET + .02, i / 16), lerp(NV0, NV1, k / 7), .0005)), .0009, { slot: S.VISOR, skin: veilSkin, sides: 3, n: 22, cap: false });
    for (let k = 0; k <= 15; k++) m.tube(Array.from({ length: 8 }, (_, i) => veilAt(lerp(-NET, NET, k / 15), lerp(NV0 - .01, NV1 + .01, i / 7), .0005)), .0009, { slot: S.VISOR, skin: veilSkin, sides: 3, n: 9, cap: false });
    // behind the net: the head in the brim's shadow, a neckerchief over nose and mouth
    m.grid(16, 6, (u, v) => headP(lerp(-NET - .1, NET + .1, u), lerp(-.95, .45, v), .002), { slot: S.RUBBER, skin: H, crease: 180, out: outH, ao: .45 });
    m.grid(14, 5, (u, v) => { const lon = lerp(-1.4, 1.4, u), lat = lerp(-1.0, -.3 - .1 * Math.abs(lon) ** 1.5, v); return headP(lon, lat, .008 + .004 * Math.sin(Math.PI * v) + .003 * Math.sin(lon * 6 + v * 3)); }, { slot: S.PLATE, skin: H, crease: 180, out: outH, ao: .55 });
  }
  m.grid(nb, nr, (u, v) => brim(u * TAU - Math.PI, v, -.0022), { wrapU: true, slot: S.PLATE, skin: H, crease: 180, out: () => [0, -1, 0], ao: .5 });
}

// ---------------------------------------------------------------- smock, rubber bib overalls with braces, leather belt
const BELT = [1.0, .181, .138, { w: .038, t: .006, sag: .008, cz: .002, e: 2.3 }], belt = beltMap(...BELT);
const SM = [[1.085, .166, .123, 0], [1.12, .166, .123, 0], [1.2, .172, .126, 0], [1.26, .178, .129, 0], [1.32, .189, .133, 0], [1.39, .193, .133, .002], [1.435, .185, .126, .005], [1.465, .159, .112, .006], [1.49, .121, .096, .005], [1.512, .093, .084, .004]];
const smDisp = (a, y) => .02 * Math.sin(a * 4 + y * 12) * bump(y, 1.36, .1) * Math.max(0, -Math.cos(a)) + .009 * Math.sin(a * 5 + y * 18);
const smock = garmentMap(SM, { e: 2.5, disp: smDisp });
const BIB = [[.84, .171, .133, .004], [.9, .181, .139, .004], [.97, .182, .14, .003], [1.0, .179, .137, .002], [1.05, .176, .133, 0], [1.12, .175, .131, 0], [1.2, .181, .134, 0], [1.26, .187, .137, 0], [1.33, .197, .141, 0]];
const PIN_BIB = beltPin(BELT, .0015, { above: .0015 });
const bibDisp = (a, y) => .006 * Math.sin(a * 3 + y * 9) + .012 * Math.sin(a * 6 + y * 20) * bump(y, 1.05, .06);
const bib = garmentMap(BIB, { e: 2.3, disp: bibDisp, pin: PIN_BIB });
const Y_JOIN = .985, bibTop = a => { const A = Math.abs(((a + Math.PI) % TAU + TAU) % TAU - Math.PI); return 1.305 - .19 * sstep(.42, 1.12, A) + .07 * sstep(1.7, 2.7, A); };
const SLR = [[.95, .052], [.96, .06], [1.0, .061], [1.06, .062], [1.12, .064], [1.16, .065], [1.2, .066], [1.26, .069], [1.34, .074], [1.4, .077], [1.43, .075], [1.455, .066], [1.474, .048], [1.486, .022]].map(r => [r[0], r[1], r[1] * 1.03, 0]);
const slDisp = (a, y) => .03 * Math.sin(y * 80 + 1) * bump(y, 1.16, .05) * Math.max(0, Math.cos(a)) ** 1.5 + .025 * Math.sin(a * 2 + y * 16) * bump(y, 1.32, .12);
const sleeve = s => garmentMap(SLR, { e: 2.05, cx: s * .2, disp: slDisp });
const LG = [[.43, .078], [.47, .081], [.52, .085], [.57, .089], [.65, .097], [.75, .105], [.85, .111], [.93, .107], [.985, .09]].map(r => [r[0], r[1], r[1] * 1.05, .004]);
const lgDisp = (a, y) => .035 * Math.sin(a * 2 + y * 14) * bump(y, .74, .14) + .014 * Math.sin(a * 3 + y * 9) + .04 * Math.sin(y * 110) * bump(y, .57, .06) * Math.max(0, -Math.cos(a)) ** 1.5;
const leg = s => garmentMap(LG, { e: 2.1, cx: s * .1, disp: lgDisp });
const foldAo = (disp, cx = 0) => (x, y, z) => clamp(.84 + 4.5 * disp(Math.atan2(x - cx, -z), y), .55, 1);
function bodyOuter(m) {       // the outer layers first (bib, legs, braces, belt): the smock under them is then mostly rejected by the depth test
  // bib: higher at the front, cut low under the arms, a little higher at the back; joined to the legs under the belt
  const nu = m.seg(30, 10), nv = m.seg(9, 4);
  m.grid(nu, nv, (u, v) => { const a = u * TAU - Math.PI, y = lerp(Y_JOIN, bibTop(a), v); return bib(a, y); }, { wrapU: true, slot: S.PLATE2, skin: torsoSkin, crease: 180, out: (x, y, z) => [x, 0, z], ao: (x, y) => .8 + .2 * sstep(1.0, 1.2, y) });
  m.grid(nu, 1, (u, v) => { const a = u * TAU - Math.PI, y = bibTop(a) - .004 * v; return bib(a, y, -.0045 * v); }, { wrapU: true, slot: S.PLATE2, skin: torsoSkin, crease: 60, out: () => [0, 1, 0], ao: .6 });
  m.tube(Array.from({ length: 41 }, (_, i) => { const a = i / 40 * TAU - Math.PI; return bib(a, bibTop(a) - .002, .0015); }), .0042, { slot: S.PLATE2, skin: torsoSkin, sides: m.keep(1) ? 7 : 4, n: m.seg(48, 16), cap: false });
  legsFromHips(m, { hip: (a, y) => bib(a, y), yTop: Y_JOIN, yCrotch: .9, yThigh: .77, LG, e: 2.1, lgDisp, n: 26, folds: .03, slot: S.PLATE2, ao: (x, y, z) => .8 + .2 * sstep(.5, .7, y) });
  // kangaroo pocket on the bib with a flap
  panel(m, (u, v, h) => bib(u, v, h + .0025), -.42, .42, 1.09, 1.2, { t: .006, nu: 6, nv: 4, slot: S.PLATE2, skin: torsoSkin, edge: .14, round: .45, dome: .002, out: (x, y, z) => [x, 0, z] });
  panel(m, (u, v, h) => bib(u, v, h + .0095), -.44, .44, 1.185, 1.215, { t: .005, nu: 6, nv: 2, slot: S.PLATE2, skin: torsoSkin, edge: .2, round: .5, out: (x, y, z) => [x, .3, z] });
  // braces: from the bib's top corners over the shoulders, crossed at the back (under the cape), slides and hooks at the front
  for (const s of [-1, 1]) {
    strapAlong(m, [bib(s * .38, 1.29, .006), smock(s * .4, 1.38, .007), smock(s * .55, 1.455, .006), smock(s * 1.5, 1.505, .008), smock(s * 2.45, 1.45, .006), smock(-s * (Math.PI - .25), 1.3, .008), bib(-s * (Math.PI - .55), bibTop(Math.PI - .55) - .01, .006)], .036, .0045, (x, y, z) => [x, y > 1.47 ? 1 : 0, z], { slot: S.RUBBER, skin: torsoSkin, n: m.seg(24, 8) });
    const F = bodyFrame(smock(s * .42, 1.36, .013), s * .42);
    m.box([0, 0, .001], [.044, .026, .005], .002, { slot: S.METAL, skin: torsoSkin, m: F });
    if (m.keep(1)) { const G = bodyFrame(bib(s * .38, 1.288, .01), s * .38); m.tube([xf(G, [-.012, .012, 0]), xf(G, [-.012, -.004, .004]), xf(G, [.012, -.004, .004]), xf(G, [.012, .012, 0])], .0026, { slot: S.METAL, skin: torsoSkin, sides: 5, n: 8, tension: .2 }); }
  }
  // leather belt over the bib
  beltRing(m, ...BELT.slice(0, 3), { ...BELT[3], slot: S.PLATE, skin: P2, buckle: 'frame', keepers: [-.55, .55] });
}
function bodyInner(m) {
  garment(m, SM, { n: 28, e: 2.5, disp: smDisp, slot: S.CLOTH, skin: torsoSkin, out: (x, y, z) => [x, y > 1.46 ? .6 : 0, z], ao: foldAo(smDisp) });       // starts under the bib's lowest edge: nothing drawn twice below it
  garment(m, [[1.465, .096, .089, .006], [1.5, .089, .083, .006], [1.525, .087, .081, .006]], { n: 24, e: 2.2, slot: S.CLOTH, skin: (x, y) => blend2(C, B.NEC, y, 1.51, .03), out: (x, y, z) => [x, 0, z], ao: .8 });
  for (const s of [-1, 1]) {
    // long rubber gauntlet: a flared cuff from the wrist to mid-forearm, a rolled lip
    m.revolve([[.0525, .02], [.057, -.012], [.061, -.04], [.065, -.058], [.0668, -.066], [.0666, -.0705], [.064, -.0728], [.0612, -.0708], [.0594, -.064], [.0578, -.05]], { sides: m.keep(1) ? 26 : 9, slot: S.PLATE2, skin: (x, y) => blend2(s < 0 ? B.HAL : B.HAR, s < 0 ? B.FAL : B.FAR, y, .89, .03), m: T(s * .2, .885, 0, Math.PI, 0, 0, 1, 1, 1.04), crease: 80 });
    elbowLiner(m, s, SLR, S.CLOTH);
    garment(m, SLR, { n: 16, e: 2.05, cx: s * .2, ox: y => s * (.2 - .032 * sstep(1.38, 1.486, y)), disp: slDisp, slot: S.CLOTH, skin: sleeveSkin(s), capB: true, sub: 2, out: (x, y, z) => [x - s * .2, y > 1.48 ? .5 : y < .96 ? -.5 : 0, z], ao: foldAo(slDisp, s * .2) });
    bandOn(m, sleeve(s), 1.3, .032, { n: 16, slot: S.TEAM, skin: s < 0 ? B.UAL : B.UAR, out: (x, y, z) => [x - s * .2, 0, z] });
  }
}

// ---------------------------------------------------------------- hip boots, the thigh section rolled down into a short cuff under the knee
// the shaft follows the calf (wider at the calf, narrow at the ankle, soft wrinkles there and under the cuff); the turned-down section is a short cuff
// close to the leg, tapering down, with a rounded fold at the top, a crease across it and a rolled lip at its edge
const SHAFT = [[.15, .0612], [.19, .066], [.24, .075], [.3, .0835], [.35, .0865], [.4, .0848], [.44, .0865], [.48, .0905], [.505, .093]].map(r => [r[0], r[1], r[1] * 1.08, .006]);
const shDisp = (a, y) => .04 * Math.sin(a * 3 + y * 70) * bump(y, .2, .045) + .022 * Math.sin(a * 5 + y * 30) * bump(y, .43, .05);
const shaft = s => garmentMap(SHAFT, { e: 2.1, cx: s * .1, disp: shDisp });
const CUFF = { y0: .522, y1: .445 };
const cuff = (s, a, v, h = 0) => { const y = lerp(CUFF.y0, CUFF.y1, v), r = lerp(.1, .0975, v) * (1 + .022 * Math.sin(a * 5 + s * 1.3) * v) - .0028 * bump(v, .52, .14) + h; return [s * .1 + r * Math.sin(a), y - .006 * v * v * Math.max(0, -Math.cos(a)), .006 - r * 1.08 * Math.cos(a)]; };
function boots(m) {
  for (const s of [-1, 1]) {
    const SH = s < 0 ? B.SHL : B.SHR, FO = s < 0 ? B.FOL : B.FOR, sk = (x, y) => (y > .3 ? legSkin(s)(x, y) : blend2(FO, SH, y, .16, .035)), o = (x, y, z) => [x - s * .1, 0, z - .006], nf = m.seg(22, 8);
    // outside in: the rounded fold, the cuff, its lip, the strap ear, then the shaft and the cuff's underside they hide
    const fold = (a, t) => { const g = t * Math.PI, r = .093 + .0035 * (1 - Math.cos(g)) + .0045 * Math.sin(g), y = .505 + .017 * Math.sin(g * .5) + .002 * Math.sin(g); return [s * .1 + r * Math.sin(a), y, .006 - r * 1.08 * Math.cos(a)]; };
    m.grid(nf, m.seg(5, 3), (u, v) => fold(u * TAU, v), { wrapU: true, slot: S.RUBBER, skin: sk, crease: 180, out: o, ao: .92 });
    m.grid(nf, m.seg(5, 3), (u, v) => cuff(s, u * TAU, v), { wrapU: true, slot: S.RUBBER, skin: sk, crease: 180, out: o, ao: (x, y) => .8 + .2 * sstep(.45, .52, y) });
    m.tube(Array.from({ length: 25 }, (_, i) => cuff(s, i / 24 * TAU, 1, -.0004)), .0036, { slot: S.RUBBER, skin: sk, sides: m.keep(1) ? 6 : 4, flat: .55, n: m.seg(28, 10), cap: false, up: [0, 1, 0], ao: .7 });
    if (m.keep(1)) { const p0 = cuff(s, s * 1.55, .12, .002), p1 = cuff(s, s * 1.55, .8, .003); strapAlong(m, [p0, [lerp(p0[0], p1[0], .5) + s * .002, lerp(p0[1], p1[1], .5), lerp(p0[2], p1[2], .5)], p1], .018, .0035, (x, y, z) => [x - s * .1, 0, z - .006], { slot: S.PLATE, skin: sk, n: 5 }); m.box([0, 0, .002], [.022, .013, .0035], .0012, { slot: S.METAL, skin: sk, m: bodyFrame(cuff(s, s * 1.55, .5, .005), s * 1.55) }); }
    panel(m, (u, v, h) => shaft(s)(u, v, h + .001), -.55, .55, .19, .34, { t: .0026, nu: 5, nv: 4, slot: S.RUBBER, skin: sk, edge: .2, round: .55, dome: .002, out: o });
    garment(m, SHAFT, { n: 18, e: 2.1, cx: s * .1, disp: shDisp, slot: S.RUBBER, skin: sk, out: o, ao: (x, y) => .74 + .26 * sstep(.15, .3, y) });
    if (m.keep(0)) m.grid(nf, 2, (u, v) => cuff(s, u * TAU, 1 - v * .7, -.004), { wrapU: true, slot: S.RUBBER, skin: sk, crease: 180, out: (x, y, z) => { const q = o(x, y, z); return [-q[0], 0, -q[2]]; }, ao: .4 });
  }
}

// ---------------------------------------------------------------- reed cape: overlapping rows of tied reed bunches over the shoulders and down the back
const capeTop = a => 1.505 - .014 * Math.max(0, Math.cos(a));
const capeOff = (a, y) => .02 + .014 * sstep(1.35, 1.0, y) + .004 * sstep(1.45, 1.5, y);
const cape = (a, y, h = 0) => smock(a, Math.min(y, 1.512), capeOff(a, y) + h);
const capeSkin = (x, y) => { const k = .55 * sstep(.14, .2, Math.abs(x)) * sstep(1.38, 1.43, y); if (k < .01) return torsoSkin(x, y); return [C, 1 - k, x < 0 ? B.UAL : B.UAR, k]; };
const absA = a => Math.abs(((a + Math.PI) % TAU + TAU) % TAU - Math.PI);
// three rows (outermost first): the shoulder row all round but the throat, wrapping over the shoulders onto the chest; two rows down the back
const ROW_A = { h: .026, list: [], drop: .03 }, ROW_B = { h: .013, list: [], drop: .035 }, ROW_C = { h: 0, list: [], drop: .04 };
for (let i = 0; i < 14; i++) { const a = (i < 7 ? -1 : 1) * (.34 + (i % 7) * .43), A = absA(a); ROW_A.list.push([a, .5, A < 1.2 ? .125 : A < 1.95 ? .075 : .155]); }
for (let i = 0; i < 7; i++) ROW_B.list.push([Math.PI + (i - 3) * .34, .44, 0]);
for (let i = 0; i < 6; i++) ROW_C.list.push([Math.PI + (i - 2.5) * .33, .42, 0]);
const rowTop = (row, a) => row === ROW_A ? capeTop(a) + .004 : row === ROW_B ? 1.43 : 1.255, rowBot = (row, a, len) => row === ROW_A ? capeTop(a) - len : row === ROW_B ? 1.2 - .02 * Math.cos((a - Math.PI) * 3) : .99 + .015 * Math.cos((a - Math.PI) * 4);
/** One tied bunch of reeds laid on the cape: narrow at its tie, spreading downward; a bulging outer face and a flat inner face that meet at the sides
 *  and at the ragged ends (each reed column its own length, so the ends are uneven), a cord wound round it under the tie. */
function bunch(m, row, a0, span, len, seed) {
  const nS = 5, nv = 5, th = .0095, yT = rowTop(row, a0), yB = rowBot(row, a0, len), cols = [];
  for (let i = 0; i <= nS; i++) cols.push(row.drop * (.25 + .75 * hash(seed * 31 + i * 7)) * (i === 0 || i === nS ? .4 : 1));
  const P = (u, i, v, outer, extra = 0) => {       // u -1..1 across, i its column (ragged length), v 0 (tie) .. 1 (ends)
    const w = lerp(.45, 1.05, sstep(0, .55, v)), a = a0 + u * span / 2 * w, y = lerp(yT, yB - cols[i], v ** 1.05), t = outer ? th * Math.max(0, 1 - u * u) ** .55 * (1 - v ** 3) * lerp(1.15, 1, sstep(0, .3, v)) : 0;
    return cape(a, y, row.h + t + extra + (outer ? 0 : .0004) + .002 * Math.sin(u * 9 + seed) * v);
  };
  const rings = [];
  for (let j = 0; j <= nv; j++) { const v = j / nv, r = []; for (let i = 0; i <= nS; i++) r.push(P(-1 + 2 * i / nS, i, v, true)); for (let i = nS - 1; i >= 1; i--) r.push(P(-1 + 2 * i / nS, i, v, false)); rings.push(r); }
  m.loft(rings, { slot: S.CLOTH2, skin: capeSkin, crease: 75, capA: true, out: (x, y, z) => [x, .2, z], ao: (x, y) => .72 + .28 * sstep(yB, yT, y) });
  // the tie: a cord wound round the bunch near its top
  m.tube(Array.from({ length: 9 }, (_, i) => { const u = -1 + 2 * i / 8; return P(u, Math.round((u + 1) / 2 * nS), .11, true, .0018); }), .0022, { slot: S.RUBBER, skin: capeSkin, sides: 3, n: 8, cap: true });

}
/** Far away: each row as one strip tier with pointed ends (no separate bunches). */
function reedRowFar(m, row, n) {
  const list = row.list, A0 = row === ROW_A ? -Math.PI : list[0][0] - list[0][1] / 2, A1 = row === ROW_A ? Math.PI : list[list.length - 1][0] + list[list.length - 1][1] / 2, per = m.keep(1) ? 2 : 1, nu = n * per, nv = m.keep(1) ? 3 : 2;
  const lenAt = a => { if (row !== ROW_A) return 0; const A = absA(a); return A < 1.2 ? .125 : A < 1.95 ? .075 : .155; };
  m.grid(nu, nv, (u, v) => { const j = Math.min(n - 1, Math.floor(u * n)), f = u * n - j, a = lerp(A0, A1, u), tip = per > 1 ? Math.max(0, 1 - Math.abs(2 * f - 1) ** 1.3) : .5, L = row.drop * .7 * tip;
    return cape(a, lerp(rowTop(row, a), rowBot(row, a, lenAt(a)) - L, v), row.h + (per > 1 ? .006 * Math.sin(f * Math.PI) : .004)); },
    { slot: S.CLOTH2, skin: capeSkin, crease: per > 1 ? 70 : 180, out: (x, y, z) => [x, .3, z], ao: (x, y) => .75 + .25 * sstep(1.0, 1.4, y) });
}
function reedCape(m) {
  if (m.keep(0)) { let seed = 1; for (const row of [ROW_A, ROW_B, ROW_C]) for (const [a, span, len] of row.list) bunch(m, row, a, span, len, seed++); }
  else { reedRowFar(m, ROW_A, m.keep(1) ? 20 : 10); reedRowFar(m, ROW_B, m.keep(1) ? 8 : 4); reedRowFar(m, ROW_C, m.keep(1) ? 7 : 4); }
  // the binding cord round the neck with its knot, and a tie cord over each shoulder from the chest bunches to the back row
  m.tube(Array.from({ length: 33 }, (_, i) => cape(i / 32 * TAU - Math.PI, 1.49, .04)), .0042, { slot: S.RUBBER, skin: (x, y) => blend2(C, B.NEC, y, 1.5, .03), sides: m.keep(1) ? 6 : 4, n: m.seg(40, 12), cap: false });
  const k = cape(0, 1.47, .042);
  m.ell(k, [.011, .009, .008], { slot: S.RUBBER, skin: C, nu: 8, nv: 5 });
  for (const s of [-1, 1]) {
    m.tube([k, cape(s * .04, 1.445, .044), cape(s * .05, 1.418, .043)], .003, { slot: S.RUBBER, skin: C, sides: 4, n: 6, cap: true });
    if (m.keep(1)) m.tube([cape(s * .55, 1.405, .042), cape(s * .95, 1.465, .041), cape(s * 1.5, 1.505, .042), cape(s * 2.1, 1.47, .042), cape(s * 2.55, 1.405, .042)], .0028, { slot: S.RUBBER, skin: capeSkin, sides: 4, n: m.seg(18, 8), cap: true });
  }
}

// ---------------------------------------------------------------- net floats across the body, storm lantern, knife
function kit(m) {
  // the float line: from under the cape on the right shoulder, across the chest to the left hip
  const path = [cape(1.0, 1.47, .03), cape(.55, 1.42, .03), bib(.32, 1.3, .016), bib(.1, 1.22, .014), bib(-.25, 1.13, .014), bib(-.62, 1.06, .016), bib(-1.0, 1.03, .018), belt(-1.25, .005, .012)];
  m.tube(path, .0026, { slot: S.RUBBER, skin: torsoSkin, sides: m.keep(1) ? 5 : 3, n: m.seg(40, 12), cap: true });
  const pts = []; { let L = 0; for (let i = 0; i < path.length - 1; i++) { const d = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1], path[i + 1][2] - path[i][2]); pts.push([path[i], path[i + 1], L, d]); L += d; } pts.L = L; }
  const at = t => { const s = t * pts.L; for (const [a, b, L, d] of pts) if (s <= L + d) { const k = (s - L) / d; return [[lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)], [b[0] - a[0], b[1] - a[1], b[2] - a[2]]]; } return [path[path.length - 1], [0, -1, 0]]; };
  const Dv = new THREE.Vector3(), Zv = new THREE.Vector3(), Xv = new THREE.Vector3();
  for (let i = 0; i < 6; i++) {
    const [p, d] = at(.28 + i * .12), L = .042, R = .0155;
    Dv.set(d[0], d[1], d[2]).normalize(); Zv.set(p[0], 0, p[2] - .002).normalize(); Zv.addScaledVector(Dv, -Zv.dot(Dv)).normalize(); Xv.crossVectors(Dv, Zv);
    const M = new THREE.Matrix4().makeBasis(Xv, Dv, Zv).setPosition(p[0] + Zv.x * (R - .002), p[1] + Zv.y * (R - .002), p[2] + Zv.z * (R - .002));
    m.revolve([[0, -L / 2], [R * .55, -L / 2], [R * .9, -L * .38], [R, -L * .15], [R, L * .15], [R * .9, L * .38], [R * .55, L / 2], [0, L / 2]], { sides: m.keep(1) ? 10 : 6, slot: S.ACCENT, skin: torsoSkin, m: M, crease: 50 });
    if (m.keep(0)) for (const e of [-1, 1]) m.revolve([[R * .62, 0], [R * .64, .0035], [R * .5, .005]], { sides: 10, slot: S.ACCENT, skin: torsoSkin, m: M.clone().multiply(T(0, e * (L * .5 - .002), 0, e < 0 ? Math.PI : 0, 0, 0)), crease: 60 });
  }
  // storm lantern hung by its bail from the belt on the left hip: fount, wire guard round a lit globe, chimney cap
  { const a = -1.78, top = bib(a, .86, .05), sk = (x, y) => { const k = sstep(.88, .74, y) * .4; return k <= 0 ? [P2, 1] : [P2, 1 - k, B.THL, k]; }, M = T(top[0], .8, top[2]);
    m.revolve([[0, -.07], [.03, -.07], [.04, -.064], [.042, -.052], [.04, -.04], [.026, -.034], [.024, -.03]], { sides: m.keep(1) ? 16 : 8, slot: S.METAL, skin: sk, m: M, crease: 55 });
    m.revolve([[.022, -.03], [.03, -.018], [.034, .0], [.033, .02], [.026, .036], [.018, .044]], { sides: m.keep(1) ? 16 : 8, slot: S.GLOW, skin: sk, m: M, crease: 70 });
    m.revolve([[.016, .044], [.026, .046], [.03, .052], [.024, .058], [.012, .066], [.012, .074], [.016, .076], [0, .078]], { sides: m.keep(1) ? 14 : 7, slot: S.METAL, skin: sk, m: M, crease: 55 });
    for (let k = 0; k < (m.keep(1) ? 4 : 2); k++) { const g = (k + .5) / (m.keep(1) ? 4 : 2) * TAU, c = Math.cos(g), sn = Math.sin(g); m.tube([xf(M, [.04 * c, -.04, .04 * sn]), xf(M, [.038 * c, .0, .038 * sn]), xf(M, [.03 * c, .04, .03 * sn])], .0016, { slot: S.METAL, skin: sk, sides: 3, n: 6, cap: false }); }
    const bt = belt(a, .004, 0);
    m.tube([xf(M, [-.03, .05, 0]), xf(M, [-.026, .085, -.004]), [bt[0], bt[1] - .01, bt[2]], bt, xf(M, [.026, .085, .004]), xf(M, [.03, .05, 0])], .0022, { slot: S.METAL, skin: P2, sides: m.keep(1) ? 5 : 3, n: 12, cap: false }); }
  // knife in a leather sheath on the right hip, handle up
  { const a = 1.62, F = bodyFrame(bib(a, .9, .012), a, .08);
    m.plate([[-.017, -.08], [.015, -.08], [.02, .02], [.018, .05], [-.018, .05], [-.02, .02]], (u, v, h) => xf(F, [u, v, h]), { t: .012, bevel: .004, slot: S.PLATE, skin: P2, out: () => [F.elements[8], F.elements[9], F.elements[10]], round: 1 });
    m.tube([xf(F, [0, .05, .006]), xf(F, [0, .09, .007]), xf(F, [0, .125, .006])], t => lerp(.0105, .0095, t), { slot: S.RUBBER, skin: P2, sides: m.keep(1) ? 8 : 5, n: 5, cap: true });
    if (m.keep(1)) m.revolve([[0, .004], [.012, .003], [.0125, -.003], [0, -.004]], { sides: 8, slot: S.METAL, skin: P2, m: F.clone().multiply(T(0, .053, .006)) }); }
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  // brim stitching, bib stitching, welded seam down the outer leg of the bib trousers
  for (const t of [.55, .8]) stitchLine(m, Array.from({ length: 41 }, (_, i) => brim(i / 40 * TAU - Math.PI, t, .0034)), { skin: H, n: 90, slot: S.PLATE });
  stitchLine(m, [[-.4, 1.19], [-.41, 1.13], [-.39, 1.095], [0, 1.09], [.39, 1.095], [.41, 1.13], [.4, 1.19]].map(([a, y]) => bib(a, y, .0095)), { skin: torsoSkin, n: 60, slot: S.PLATE2 });
  for (const s of [-1, 1]) stitchLine(m, Array.from({ length: 12 }, (_, i) => leg(s)(s * Math.PI / 2, lerp(.74, .5, i / 11), .0014)), { skin: legSkin(s), n: 24, slot: S.PLATE2 });
}
/** Glove seams up close, without the kit's wrist strap (it would poke through the gauntlet's cuff): finger seams, the palm patch. */
function gloveSeams(m, s, palmSlot) {
  const H = s < 0 ? B.HAL : B.HAR, x = s * .2, zs = [-.037, -.016, .006, .026], lens = [.044, .05, .047, .036];
  for (let i = 0; i < 4; i++) { const z = zs[i], L = lens[i], cu = -s; stitchLine(m, [[x + s * .0138, .8, z + .006], [x + s * .0128, .8 - L * .55, z + .0045], [x + cu * .003, .8 - L * 1.05, z + .003], [x + cu * .024, .8 - L * 1.33, z + .002]], { skin: H, n: 9, r: .0008 }); }
  m.plate([[-.036, -.03], [.036, -.03], [.04, .018], [.024, .034], [-.024, .034], [-.04, .018]], planeMap([x - s * .0265, .84, -.004], [0, 0, 1], [0, 1, 0], s < 0 ? -1 : 1), { t: .0028, bevel: .0012, slot: palmSlot, skin: H, inner: 1 });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) { gloveSeams(m, s, S.PLATE2); stitchLine(m, Array.from({ length: 25 }, (_, i) => { const g = i / 24 * TAU; return [s * .2 + .0645 * Math.sin(g), .835, .0672 * Math.cos(g)]; }), { skin: s < 0 ? B.FAL : B.FAR, n: 48, slot: S.PLATE2 }); } },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  reedCape, kit, head, bodyOuter, boots, bodyInner,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.RUBBER, slotRand: S.RUBBER, slotSole: S.RUBBER, slotMid: S.RUBBER, slotWelt: S.RUBBER, slotTongue: S.RUBBER, slotPanel: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.PLATE2, slotCuff: S.PLATE2, slotKnuckle: S.PLATE2, guard: false, cuff: false }); },
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['cape', 'kit', 'head', 'bodyOuter', 'boots', 'bodyInner', 'feet', 'gloves']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
void rowAt; void padSweep; void stud;
