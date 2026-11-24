// outfit-colosse.js — FRONT ZÉRO: COLOSSE, the heavy exosuit set (not to be confused with the Colosse H-50 pistol of data.js: different ids, shop tab and label).
// Original design: a rounded-square helmet with a recessed visor band, a chevron brow and a central rib, a stacked gorget, three-shell pauldrons, a barrel
// cuirass over segmented abdominal lames, a back power core in a cage between two finned cells, exposed actuators and their lines on arms and legs.
// It looks massive but stays inside the soldier's real hitbox (0.34 m around the body axis, under 1.82 m): never bigger to hit, never smaller.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, lerp, clamp, sstep, blend2, torsoSkin, buildSuit, buildGlove, buildBoot, buildHose, buildGloveDetail, buildBootDetail, mapAt, screw, stitchLine, buckleAt, faceTo, panel, planeMap, strapAlong, defineOutfitSet, beltRing } from './outfit-kit.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- colourways
export const OUTFIT_SETS = [
  { id: 'colosse-acier', setId: 'colosse', name: 'COLOSSE', colorway: 'Acier', rarity: 'Élite', palette: { cloth: 0x2a2e33, cloth2: 0x1c1f23, plate: 0x525a62, plate2: 0x343a41, rubber: 0x16181b, metal: 0x8e969d, accent: 0xe9781f, glow: 0xffa43a, visor: 0x170d05, rim: 0x66707a, lift: .03, fpSleeve: 'armour', fpKit: 'heavy', pattern: { type: 5, scale: 20, strength: .32, a: 0x34312b, b: 0x1f1e1b, plates: 1 }, pbr: { plate: [.5, .2, 0, 0], plate2: [.54, .16, 0, 0], metal: [.24, .9, 0, 0] } } },
  { id: 'colosse-sable', setId: 'colosse', name: 'COLOSSE', colorway: 'Sable', rarity: 'Élite', palette: { cloth: 0x3a3529, cloth2: 0x2a261e, plate: 0x766548, plate2: 0x3d3528, rubber: 0x1f1c17, metal: 0x8c8679, accent: 0x2f8079, glow: 0x52e3cf, visor: 0x0a1a18, rim: 0x5c5040, lift: .012, fpSleeve: 'armour', fpKit: 'heavy', pattern: { type: 5, scale: 20, strength: .32, a: 0x5e4f39, b: 0x2a241c, plates: 1 }, pbr: { plate: [.62, .05, 0, 0], plate2: [.64, .05, 0, 0], metal: [.3, .8, 0, 0] } } },
  { id: 'colosse-nuit', setId: 'colosse', name: 'COLOSSE', colorway: 'Nuit', rarity: 'Légende', palette: { cloth: 0x17181b, cloth2: 0x101114, plate: 0x2e3237, plate2: 0x393d44, rubber: 0x121315, metal: 0x6c7178, accent: 0xc8191e, glow: 0xff2c2a, visor: 0x150405, rim: 0x7a7c7e, lift: .045, fpSleeve: 'armour', fpKit: 'heavy', pattern: { type: 5, scale: 20, strength: .3, a: 0x4a4740, b: 0x2e2c28, plates: 1 }, pbr: { plate: [.42, .25, 0, 0], plate2: [.46, .2, 0, 0], metal: [.3, .8, 0, 0] } } },
  { id: 'colosse-glacier', setId: 'colosse', name: 'COLOSSE', colorway: 'Glacier', rarity: 'Élite', palette: { cloth: 0x23292e, cloth2: 0x1a1f23, plate: 0x5a6670, plate2: 0x2c343b, rubber: 0x15181b, metal: 0x5f6a73, accent: 0x1fb2d8, glow: 0x66e8ff, visor: 0x06202b, rim: 0x47525a, lift: .01, fpGlove: 0x3a4249, fpSleeve: 'armour', fpKit: 'heavy', pattern: { type: 5, scale: 20, strength: .3, a: 0x878780, b: 0x2a3035, plates: 1 }, pbr: { plate: [.55, .06, 0, 0], plate2: [.58, .06, 0, 0], metal: [.28, .85, 0, 0] } } },
];

// ---------------------------------------------------------------- shared shapes
/** Superellipse ring at height y: front half radius zf, back half zb (front = -Z). */
const sring = (n, y, rx, zf, zb, e = 2.6, cz = 0) => { const p = 2 / e, o = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, s = Math.sin(a), c = Math.cos(a); o.push([rx * Math.sign(s) * Math.abs(s) ** p, y, cz - (c > 0 ? zf : zb) * Math.sign(c) * Math.abs(c) ** p]); } return o; };
const flat = (x, y, z) => [x, 0, z];

// helmet: rounded-square plan, dome on top, near-vertical jaw below the equator
const HC = [0, 1.686, -.014], HR = [.146, .128, .16];
const sq = a => { const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return 1 / Math.pow(c ** 2.7 + s ** 2.7, 1 / 2.7); };
const hp = (lon, lat, off = 0) => {
  const up = lat >= 0, k = up ? Math.cos(lat) : 1 - .12 * (lat / 1.05) ** 2, y = up ? Math.sin(lat) : lat * .93;
  const plan = lerp(1, sq(lon), .45 * (up ? sstep(1.25, .25, lat) : 1)), jaw = up ? 1 : 1 + .05 * Math.cos(lon) ** 2 * sstep(-.15, -.85, lat);
  return [HC[0] + (HR[0] * plan * k * jaw + off) * Math.sin(lon), HC[1] + HR[1] * y + (up ? off * Math.sin(lat) : 0), HC[2] - (HR[2] * plan * k * jaw + off) * Math.cos(lon)];
};
const outH = (x, y, z) => [x - HC[0], y - HC[1] + .03, z - HC[2]];

// cuirass: rows [y, rx, front, back]
const CU = [[1.2, .184, .146, .13], [1.24, .198, .166, .14], [1.29, .207, .184, .148], [1.35, .21, .192, .153], [1.405, .204, .188, .15], [1.448, .186, .169, .139], [1.478, .158, .145, .124], [1.5, .13, .12, .108]];
const cuAt = y => { if (y <= CU[0][0]) return CU[0]; for (let i = 0; i < CU.length - 1; i++) { const a = CU[i], b = CU[i + 1]; if (y <= b[0]) { const t = (y - a[0]) / (b[0] - a[0]); return a.map((v, k) => lerp(v, b[k], t)); } } return CU[CU.length - 1]; };
const cuP = (a, y, off = 0) => { const r = cuAt(y), s = Math.sin(a), c = Math.cos(a), p = 2 / 2.7; return [(r[1] + off) * Math.sign(s) * Math.abs(s) ** p, y, -((c > 0 ? r[2] : r[3]) + off) * Math.sign(c) * Math.abs(c) ** p]; };

// limb wraps: u = 0 faces outward (arms) or forward (legs); u > 0 turns toward the back (arms) or outward (legs)
const armW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .2 + s * r * Math.cos(u), v, r * Math.sin(u)]; };
const legW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .1 + s * r * Math.sin(u), v, -r * Math.cos(u)]; };
const PCEN = 1.432;
const spw = (x, p) => Math.sign(x) * Math.abs(x) ** p;      // superellipse: flat top and side, rounded edges (the shell is a block, not a dome)
const capMap = (s, R0) => (u, v, h) => { const R = R0 + h, c = spw(Math.cos(v), .62); return [s * .205 + s * R * spw(Math.cos(u), .75) * c, PCEN + R * .8 * spw(Math.sin(v), .62), R * 1.12 * spw(Math.sin(u), .75) * c]; };

// ---------------------------------------------------------------- helmet and gorget
function helmet(m) {
  const H = B.HEA, nu = m.seg(26, 12), nv = m.seg(10, 5);
  m.grid(nu, nv, (u, v) => hp(u * TAU - Math.PI, lerp(-1.05, 1.5707, v ** .95)), { wrapU: true, capB: true, slot: S.PLATE, skin: H, crease: 40, out: outH, ao: (x, y) => .62 + .38 * sstep(1.6, 1.72, y) });
  if (m.keep(1)) m.grid(nu, 1, (u, v) => hp(u * TAU - Math.PI, -1.05 + .02 * v, .004 * (1 - v)), { wrapU: true, slot: S.PLATE2, skin: H, crease: 180, out: outH });      // rolled lower edge
  const on = (u, v, h) => hp(u, v, h + .0015), P = (map, u0, u1, lo, hi, o) => panel(m, map, u0, u1, lo, hi, { skin: H, out: outH, ...o });
  // recessed visor band, a fine lit line at its foot
  m.grid(m.seg(22, 8), 2, (u, v) => hp(lerp(-1.08, 1.08, u), lerp(-.02, .28, v), .0028), { slot: S.VISOR, skin: H, crease: 180, out: outH });
  if (m.keep(1)) m.grid(m.seg(18, 6), 1, (u, v) => hp(lerp(-.96, .96, u), lerp(.012, .03, v), .0034), { slot: S.GLOW, skin: H, crease: 180, out: outH });
  // chevron brow, jaw shells, central rib, nape guard
  P(on, -1.3, 1.3, u => .2 + .05 * Math.min(1, Math.abs(u) / 1.05), u => .62 - .16 * (u / 1.3) ** 2, { t: .012, nu: 13, nv: 3, slot: S.PLATE2, dome: .003, edge: .08 });
  for (const s of [-1, 1]) {
    const sd = (u, v, h) => hp(s * u, v, h + .0015);
    P(sd, .07, 1.76, u => -1.03 + .38 * sstep(1.35, 1.76, u), u => .03 + .07 * sstep(1.05, 1.6, u), { t: .011, nu: 10, nv: 5, slot: S.PLATE, dome: .002 });
    if (m.keep(1)) {          // jaw grille: dark slot and four bars
      P((u, v, h) => sd(u, v, h + .011), .17, .55, -.6, -.26, { t: .0015, nu: 3, nv: 2, slot: S.RUBBER, edge: .05, round: 0 });
      if (m.keep(0)) for (let k = 0; k < 4; k++) { const la = -.55 + k * .085; P((u, v, h) => sd(u, v, h + .011), .15, .57, la - .016, la + .016, { t: .006, nu: 4, nv: 1, slot: S.PLATE2, edge: .12, round: .5 }); }
    }
    // side module: hexagonal ear block with a vented cap
    const ear = T(s * .152, 1.664, .01, 0, 0, -s * Math.PI / 2);
    m.revolve([[.002, .02], [.03, .02], [.043, .013], [.047, 0], [.047, -.016], [.036, -.02]], { sides: 6, slot: S.PLATE2, skin: H, m: ear, crease: 30 });
    if (m.keep(1)) m.revolve([[.002, .023], [.02, .023], [.025, .02]], { sides: 6, slot: S.METAL, skin: H, m: ear, crease: 30 });
    if (m.keep(1)) m.revolve([[.0475, .006], [.0475, -.006]], { sides: 6, slot: S.ACCENT, skin: H, m: ear.clone().multiply(T(0, -.004, 0)), crease: 30 });
  }
  P(on, -.085, .085, -1.04, u => .25 - .3 * Math.abs(u), { t: .017, nu: 3, nv: 10, slot: S.PLATE2, edge: .14, round: .3 });
  P((u, v, h) => hp(Math.PI + u, v, h + .0015 + .006 * sstep(-.5, -1.05, v)), -.98, .98, -1.05, u => -.22 - .3 * (u / .98) ** 2, { t: .009, nu: 10, nv: 3, slot: S.PLATE2 });
  // low crest from brow to nape, an accent inlay along it
  const crest = (u, w, h) => { const a = lerp(.72, 3.75, (u + 1) / 2), lat = Math.PI / 2 - Math.abs(a - Math.PI / 2), p = hp(a < Math.PI / 2 ? 0 : Math.PI, lat, h + .001); p[0] += w; return p; };
  P(crest, -1, 1, u => -.03 + .012 * Math.abs(u), u => .03 - .012 * Math.abs(u), { t: .008, nu: 12, nv: 2, slot: S.PLATE2, edge: .15 });
  if (m.keep(1)) P((u, w, h) => crest(u, w, h + .008), -.85, .75, -.005, .005, { t: .0014, nu: 10, nv: 1, slot: S.ACCENT, edge: .05, round: 0 });
}
function collar(m) {
  // high back collar round the back and sides of the neck: the head sits low between the shoulders (inside the head hitbox, never above it)
  const cm = (u, v, h) => { const t = clamp((v - 1.46) / .19, 0, 1), r = lerp(.204, .186, t) + h; return [r * Math.sin(u), v, .01 + r * .95 * Math.cos(u)]; }, o = (x, y, z) => [x, 0, z - .01];
  panel(m, cm, -1.38, 1.38, u => 1.455 + .02 * Math.abs(u), u => 1.648 - .09 * (u / 1.38) ** 2, { t: .013, nu: 12, nv: 3, slot: S.PLATE, skin: B.CHE, out: o, edge: .08, dome: .003 });
  panel(m, (u, v, h) => cm(u, v, h + .013), -.16, .16, 1.47, u => 1.652 - .2 * u * u, { t: .009, nu: 2, nv: 4, slot: S.PLATE2, skin: B.CHE, out: o, edge: .15 });
  if (m.keep(0)) for (const s of [-1, 1]) panel(m, (u, v, h) => cm(u, v, h + .013), s * .55, s * 1.05, u => 1.6 - .05 * ((Math.abs(u) - .55) / .5), u => 1.615 - .05 * ((Math.abs(u) - .55) / .5), { t: .0016, nu: 4, nv: 1, slot: S.ACCENT, skin: B.CHE, out: o, edge: .05, round: 0 });
}
// ---------------------------------------------------------------- exoskeleton frame: spine rails, hip arc and hubs, leg struts, hip pistons, lines
const piston = (m, y0, y1, px, pz, A, Bn, rad) => {      // cylinder on bone A, chrome rod and clevis on bone B: it telescopes as the joint moves
  const ym = lerp(y0, y1, .55), M = T(px, (y0 + ym) / 2, pz), d = ym - y0;
  m.revolve([[.002, -d / 2], [rad * .8, -d / 2], [rad, -d / 2 + .004], [rad, d / 2], [rad * .8, d / 2 + .003], [.002, d / 2 + .003]], { sides: m.keep(0) ? 8 : 5, slot: S.PLATE2, skin: A, m: M, crease: 40 });
  m.tube([[px, ym - .01, pz], [px, y1, pz]], rad * .45, { slot: S.METAL, skin: Bn, sides: m.keep(0) ? 6 : 4, n: 2 });
  if (m.keep(0)) m.ell([px, y1, pz], [rad * .75, rad * .6, rad * .75], { slot: S.METAL, skin: Bn, nu: 6, nv: 4 });
};
function frame(m) {
  const P = B.PEL;
  for (const s of [-1, 1]) m.tube([[s * .026, .99, .163], [s * .027, 1.07, .172], [s * .028, 1.15, .19]], .0065, { slot: S.METAL, skin: torsoSkin, sides: m.keep(1) ? 6 : 4, n: m.seg(6, 3) });
  if (m.keep(0)) for (let k = 0; k < 5; k++) { const y = 1.0 + k * .033; m.box([0, y, .166 + k * .005], [.07, .016, .022], .004, { slot: S.PLATE2, skin: torsoSkin }); }
  const arc = []; for (let i = 0; i <= 8; i++) { const a = lerp(-1.45, 1.45, i / 8); arc.push([.206 * Math.sin(a), .958, .015 + .172 * Math.cos(a)]); }
  strapAlong(m, arc, .028, .012, (x, y, z) => [x, 0, z - .015], { slot: S.PLATE2, skin: P, n: m.seg(16, 6) });
  for (const s of [-1, 1]) {
    const TH = s < 0 ? B.THL : B.THR, SH = s < 0 ? B.SHL : B.SHR, hub = T(s * .214, .958, .028, 0, 0, -s * Math.PI / 2), ol = (x, y, z) => [x - s * .1, 0, z];
    m.revolve([[.002, .016], [.03, .016], [.04, .009], [.043, -.01], [.036, -.016]], { sides: m.keep(1) ? 12 : 7, slot: S.PLATE2, skin: P, m: hub, crease: 35 });
    if (m.keep(0)) m.revolve([[.002, .0185], [.018, .0185], [.022, .016]], { sides: 8, slot: S.METAL, skin: P, m: hub, crease: 35 });
    // thigh strut from the hip hub to the knee hinge, shin strut from the knee to the ankle cuff
    const lw = legW(s, .142);
    strapAlong(m, [[s * .222, .935, .04], lw(2.02, .85, 0), lw(2.0, .72, 0), lw(1.95, .6, -.008), [s * .203, .54, .03]], .026, .009, ol, { slot: S.PLATE2, skin: TH, n: m.seg(10, 4) });
    strapAlong(m, [[s * .201, .49, .03], legW(s, .1)(1.9, .42, 0), legW(s, .1)(1.85, .33, 0), [s * .182, .27, .03]], .022, .008, ol, { slot: S.PLATE2, skin: SH, n: m.seg(8, 3) });
    // hip piston: cylinder on the pelvis frame, rod on the thigh strut
    if (m.keep(0)) piston(m, 1.05, .885, s * .236, .078, P, TH, .0125);
    // lines: spine to hip hub, hip hub to the thigh actuator
    buildHose(m, [[s * .035, 1.14, .2], [s * .12, 1.07, .18], [s * .19, 1.0, .11], [s * .218, .978, .05]], .0078, B.CHE, P, { sides: m.keep(1) ? 5 : 3, t0: .45, t1: .8 });
    if (m.keep(0)) buildHose(m, [[s * .236, .94, .03], [s * .24, .89, .02], [s * .228, .842, .012]], .0062, P, TH, { sides: 5, t0: .2, t1: .6 });
  }
}
function gorget(m) {
  const n = m.seg(26, 10), sk = (x, y) => y > 1.52 ? blend2(B.NEC, B.HEA, y, 1.56, .02) : blend2(B.CHE, B.NEC, y, 1.5, .02);
  // three stacked rings, each a little proud at its lower edge, so the collar reads as overlapping lames
  for (const [y0, y1, r0, r1, z0] of [[1.43, 1.478, .206, .17, .03], [1.47, 1.522, .162, .136, .018], [1.514, 1.568, .132, .118, .01]]) {
    const rows = m.seg(3, 2), rings = [];
    for (let j = 0; j <= rows; j++) { const v = j / rows, y = lerp(y0, y1, v), r = lerp(r0, r1, v) + .006 * Math.sin(v * Math.PI) - .004 * v; rings.push(sring(n, y, r, r * .9, r * .86, 2.3, lerp(z0, z0 * .6, v))); }
    m.loft(rings, { slot: S.PLATE2, skin: sk, crease: 60, out: (x, y, z) => [x, -.2, z - .01], ao: (x, y) => .7 + .3 * sstep(y0, y1, y) });
  }
}

// ---------------------------------------------------------------- cuirass, abdomen, waist
function cuirass(m) {
  const n = m.seg(30, 12), rows = m.lod === 2 ? CU.filter((_, i) => i % 2 === 0 || i === CU.length - 1) : CU, on = (u, v, h) => cuP(u, v, h + .001);
  m.loft(rows.map(r => sring(n, r[0], r[1], r[2], r[3], 2.7)), { slot: S.PLATE2, skin: torsoSkin, crease: 55, out: flat, ao: (x, y) => .72 + .28 * sstep(1.2, 1.32, y) });
  // pectoral shells either side of a keel, an accent edge on each
  for (const s of [-1, 1]) {
    panel(m, on, s * .075, s * 1.08, u => 1.262 + .045 * sstep(.45, 1.08, Math.abs(u)), u => 1.455 - .05 * sstep(.55, 1.08, Math.abs(u)), { t: .015, nu: 10, nv: 6, slot: S.PLATE, skin: torsoSkin, out: flat, dome: .006 });
    if (m.keep(1)) panel(m, (u, v, h) => on(u, v, h + .0212), s * .6, s * 1.0, u => 1.276 + .04 * sstep(.6, 1.0, Math.abs(u)), u => 1.29 + .04 * sstep(.6, 1.0, Math.abs(u)), { t: .0016, nu: 5, nv: 1, slot: S.ACCENT, skin: torsoSkin, out: flat, edge: .05, round: 0 });
  }
  panel(m, on, -.065, .065, 1.21, 1.475, { t: .021, nu: 3, nv: 8, slot: S.PLATE2, skin: torsoSkin, out: flat, edge: .14 });
  // lower rim of the cuirass, a rolled band
  m.grid(n, 1, (u, v) => cuP(u * TAU, 1.2 + .016 * v, .004 + .003 * Math.sin(v * Math.PI)), { wrapU: true, slot: S.PLATE, skin: torsoSkin, crease: 60, out: flat });
  // back plate under the power unit
  panel(m, on, Math.PI - 1.0, Math.PI + 1.0, 1.215, u => 1.465 - .05 * ((u - Math.PI) / 1.0) ** 2, { t: .012, nu: 10, nv: 4, slot: S.PLATE, skin: torsoSkin, out: flat });
}
function abdomen(m) {
  // four shingled lames between the cuirass and the belt: each one's top tucks under the flared lower edge of the one above
  const lame = (top, k) => (u, v, h) => { const t = clamp((top - v) / .058, 0, 1.2), rx = (.15 + .026 * t) * k + h, rz = (.124 + .026 * t) * k + h, s = Math.sin(u), c = Math.cos(u); return [rx * spw(s, .78), v, -rz * spw(c, .78)]; };
  for (const [top, k, slot] of [[1.205, 1, S.PLATE], [1.163, .985, S.PLATE2], [1.121, .97, S.PLATE], [1.079, .955, S.PLATE2]]) {
    panel(m, lame(top, k), -1.95, 1.95, top - .058, top, { t: .008, nu: 10, nv: 1, slot, skin: torsoSkin, out: flat, edge: .06, round: .15, ao: (x, y) => .62 + .38 * sstep(top - .06, top - .01, y) });
  }
  panel(m, lame(1.21, 1), Math.PI - 1.25, Math.PI + 1.25, 1.06, 1.21, { t: .009, nu: 10, nv: 3, slot: S.PLATE2, skin: torsoSkin, out: flat });
}
function waist(m) {
  const P = B.PEL, n = m.seg(28, 10);
  beltRing(m, 1.02, .182, .146, { w: .076, t: .008, sag: .004, cz: .004, slot: S.RUBBER, slotKeeper: S.RUBBER, slotBuckle: S.PLATE2, skin: P, bw: .062, bt: .0065, keepers: [-1.15, 1.15, Math.PI], n: n + 4 });
  // tassets: two lames in front, one on each hip, a rear plate; they follow the thigh a little
  const tw = (R, z0 = .004) => (u, v, h) => { const r = R + .07 * (.99 - v) + h; return [r * .97 * Math.sin(u), v, z0 - r * .8 * Math.cos(u)]; };
  for (const s of [-1, 1]) {
    const TH = s < 0 ? B.THL : B.THR, sk = (x, y) => { const k = sstep(.98, .8, y) * .7; return k < .01 ? [P, 1] : [P, 1 - k, TH, k]; };
    if (m.keep(1)) panel(m, tw(.186), s * .18, s * .88, .8, .915, { t: .011, nu: 7, nv: 2, slot: S.PLATE2, skin: sk, out: flat });
    panel(m, tw(.19), s * .16, s * .9, .895, .99, { t: .012, nu: 7, nv: 2, slot: S.PLATE, skin: sk, out: flat, dome: .003 });
    panel(m, tw(.196, .002), s * 1.08, s * 1.86, u => .84 + .04 * sstep(1.5, 1.86, Math.abs(u)), .992, { t: .012, nu: 7, nv: 3, slot: S.PLATE, skin: sk, out: flat });
  }
  panel(m, tw(.19, 0), Math.PI - .8, Math.PI + .8, .88, .995, { t: .011, nu: 9, nv: 3, slot: S.PLATE, skin: P, out: flat });
  panel(m, tw(.188), -.13, .13, u => .875 + .3 * u * u, .99, { t: .013, nu: 4, nv: 3, slot: S.PLATE2, skin: P, out: flat });
}

// ---------------------------------------------------------------- pauldrons
function pauldrons(m) {
  for (const s of [-1, 1]) {
    const U = s < 0 ? B.UAL : B.UAR, x0 = s * .205;
    const sk = k0 => (px, py) => { const k = clamp(k0 + (1.47 - py) * 2.2, 0, 1); return k >= 1 ? [U, 1] : [B.CHE, 1 - k, U, k]; };
    const out = (x, y, z) => [x - x0, y - PCEN + .02, z];
    // lower lames first (inside), the main shell over them
    panel(m, capMap(s, .108), -1.46, 1.46, -1.0, -.5, { t: .01, nu: 10, nv: 2, slot: S.PLATE2, skin: sk(.85), out });
    panel(m, capMap(s, .113), -1.42, 1.42, -.62, -.08, { t: .011, nu: 10, nv: 2, slot: S.PLATE, skin: sk(.6), out });
    panel(m, capMap(s, .118), -1.3, 1.3, -.17, u => 1.34 - .4 * (u / 1.3) ** 2, { t: .015, nu: 11, nv: 5, slot: S.PLATE, skin: sk(.4), out, dome: .004, edge: .06 });
    // second layer on top of the shell, then a raised ridge along its inner edge: the shoulder builds up, not out
    panel(m, capMap(s, .1345), -1.02, 1.02, .5, u => 1.28 - .3 * (u / 1.02) ** 2, { t: .011, nu: 9, nv: 3, slot: S.PLATE2, skin: sk(.3), out, edge: .08 });
    { const rm = planeMap([s * .213, 0, -.004], [0, 0, 1], [0, 1, 0], -s), rk = (x, y) => [B.CHE, .75, U, .25];
      panel(m, rm, -.112, .112, u => 1.505 + .012 * (u / .112) ** 2, u => 1.592 - .05 * (u / .112) ** 2 + .006 * (u / .112), { t: .012, nu: 6, nv: 2, slot: S.PLATE, skin: rk, edge: .12, round: .25 });
      if (m.keep(1)) panel(m, (u, v, h) => rm(u, v, h + .012), -.075, .075, u => 1.568 - .05 * (u / .112) ** 2, u => 1.58 - .05 * (u / .112) ** 2, { t: .0016, nu: 4, nv: 1, slot: S.ACCENT, skin: rk, edge: .05, round: 0 }); }
    // rolled edges
    const roll = (R, v, u0, u1, k0) => m.keep(1) && m.tube(Array.from({ length: 9 }, (_, i) => capMap(s, R)(lerp(u0, u1, i / 8), v, 0)), .0058, { slot: S.PLATE2, skin: sk(k0), sides: m.keep(0) ? 6 : 4, n: m.seg(14, 6), up: [0, 1, 0] });
    roll(.124, -.15, -1.28, 1.28, .4);
    if (m.keep(1)) roll(.118, -.6, -1.38, 1.38, .6);
    // a power feed from the back cell to the shell
    buildHose(m, [[s * .1, 1.455, .2], [s * .15, 1.5, .16], [s * .205, 1.53, .1], [s * .25, 1.515, .06]], .0115, B.CHE, U, { ribs: m.keep(0) ? 5 : 0, ribDepth: .22, sides: m.keep(1) ? 6 : 4, t0: .55, t1: .95 });
  }
}

// ---------------------------------------------------------------- arms: rerebrace, elbow cop, vambrace, actuators
const actuator = (m, y0, y1, px, pz, bone, rad) => {      // cylinder, chrome rod, clevis ends
  const d = y1 - y0, M = T(px, (y0 + y1) / 2, pz);
  m.revolve([[.002, d * .3], [rad * .8, d * .3], [rad, d * .26], [rad, -d * .5], [rad * .8, -d * .54], [.002, -d * .54]], { sides: m.keep(0) ? 8 : 5, slot: S.PLATE2, skin: bone, m: M, crease: 40 });
  m.revolve([[rad * .45, d * .5], [rad * .45, d * .28]], { sides: m.keep(0) ? 6 : 4, slot: S.METAL, skin: bone, m: M, crease: 60 });
  if (m.keep(0) && rad > .0132) for (const e of [d * .52, -d * .55]) m.ell([px, (y0 + y1) / 2 + e, pz], [rad * .7, rad * .6, rad * .7], { slot: S.METAL, skin: bone, nu: 6, nv: 4 });
};
function arms(m) {
  for (const s of [-1, 1]) {
    const U = s < 0 ? B.UAL : B.UAR, F = s < 0 ? B.FAL : B.FAR, x = s * .2, oa = (px, py, pz) => [px - s * .2, 0, pz];
    panel(m, armW(s, .08), -2.35, 2.35, 1.2, 1.356, { t: .01, nu: 12, nv: 2, slot: S.PLATE, skin: U, out: oa });
    m.revolve([[.0915, .011], [.0945, .007], [.0945, -.007], [.0915, -.011]], { sides: m.keep(1) ? 14 : 8, slot: S.TEAM, skin: U, m: T(x, 1.282, 0), crease: 50 });
    // elbow: a domed cop at the back and a hinge disc outside
    const ek = () => [U, .5, F, .5];
    panel(m, armW(s, (u, v) => .066 + .02 * Math.max(0, 1 - ((u - Math.PI / 2) / 1.1) ** 2) * Math.max(0, 1 - ((v - 1.158) / .065) ** 2)), Math.PI / 2 - 1.0, Math.PI / 2 + 1.0, 1.1, 1.218, { t: .009, nu: 6, nv: 4, slot: S.PLATE2, skin: ek, out: oa });
    m.revolve([[.002, .012], [.022, .012], [.027, .006], [.027, -.006]], { sides: m.keep(1) ? 10 : 6, slot: S.PLATE2, skin: ek, m: T(x + s * .066, 1.157, .004, 0, 0, -s * Math.PI / 2), crease: 40 });
    // vambrace with a raised spine; the forearm actuator sits on it
    const vr = (u, v) => .07 - .008 * sstep(1.1, .93, v);
    panel(m, armW(s, vr), -2.65, 2.65, .93, 1.112, { t: .013, nu: 12, nv: 3, slot: S.PLATE, skin: F, out: oa, dome: .003 });
    if (m.keep(0)) panel(m, armW(s, (u, v) => vr(u, v) + .013), -.46, .46, .945, 1.1, { t: .008, nu: 4, nv: 4, slot: S.PLATE2, skin: F, out: oa });
    if (m.keep(0)) for (let k = 0; k < 3; k++) panel(m, armW(s, (u, v) => vr(u, v) + .0163), -.64, -.5, u => .955 + k * .018 + (u + .64) * .05, u => .965 + k * .018 + (u + .64) * .05, { t: .0016, nu: 1, nv: 1, slot: S.ACCENT, skin: F, out: oa, edge: .05, round: 0 });
    actuator(m, 1.37, 1.215, x + s * .012, -.106, U, .0135);                 // biceps actuator, in front of the upper arm
    actuator(m, 1.105, .95, x + s * .1, .004, F, .0125);                     // forearm actuator, on the vambrace spine
    if (m.keep(0)) buildHose(m, [[x + s * .02, 1.2, -.1], [x + s * .06, 1.17, -.07], [x + s * .09, 1.135, -.03], [x + s * .1, 1.11, -.004]], .0068, U, F, { sides: m.keep(1) ? 5 : 3, t0: .35, t1: .7 });
    if (m.keep(0)) buildHose(m, [[x + s * .03, 1.38, .1], [x + s * .03, 1.3, .093], [x + s * .02, 1.21, .09], [x + s * .03, 1.14, .08], [x + s * .07, 1.09, .055]], .0072, U, F, { sides: 5, t0: .6, t1: .85 });       // power line down the back of the arm
    m.revolve([[.056, .016], [.062, .012], [.064, -.004], [.059, -.014]], { sides: m.keep(1) ? 12 : 7, slot: S.PLATE2, skin: F, m: T(x, .915, 0, 0, 0, 0, 1, 1, 1.05), crease: 50 });     // gauntlet cuff
  }
}

// ---------------------------------------------------------------- legs: cuisses, knee cops, greaves, actuators
function legs(m) {
  for (const s of [-1, 1]) {
    const TH = s < 0 ? B.THL : B.THR, SH = s < 0 ? B.SHL : B.SHR, ol = (px, py, pz) => [px - s * .1, 0, pz], kneeSk = (px, py) => blend2(SH, TH, py, .545, .03);
    const tr = (u, v) => lerp(.094, .115, sstep(.6, .88, v)) + .004 * Math.max(0, Math.sin(u));
    panel(m, legW(s, tr), -1.25, 2.75, .64, u => .885 - .08 * sstep(-.4, -1.25, u), { t: .012, nu: 11, nv: 3, slot: S.PLATE, skin: TH, out: ol, dome: .003 });
    if (m.keep(0)) for (let k = 0; k < 3; k++) { const a = 1.5 + k * .19; panel(m, legW(s, (u, v) => tr(u, v) + .0153), a, a + .1, u => .662 + (u - a) * .45, u => .742 + (u - a) * .45, { t: .0016, nu: 1, nv: 1, slot: S.ACCENT, skin: TH, out: ol, edge: .05, round: 0 }); }      // warning chevrons
    if (m.keep(0)) panel(m, legW(s, (u, v) => tr(u, v) + .012), -.45, .45, .66, .86, { t: .007, nu: 3, nv: 3, slot: S.PLATE2, skin: TH, out: ol });
    // knee cop: a real dome with a keel, side wings over the hinge
    const kr = (u, v) => .083 + .026 * Math.max(0, 1 - (u / 1.3) ** 2) * Math.max(0, 1 - ((v - .515) / .09) ** 2);
    panel(m, legW(s, kr), -1.28, 1.28, u => .438 + .04 * (u / 1.28) ** 2, u => .603 - .03 * (u / 1.28) ** 2, { t: .012, nu: 9, nv: 5, slot: S.PLATE, skin: kneeSk, out: ol, dome: .004 });
    if (m.keep(1)) panel(m, legW(s, (u, v) => kr(u, v) + .012), -.12, .12, .45, .566, { t: .008, nu: 2, nv: 6, slot: S.PLATE2, skin: kneeSk, out: ol, edge: .15 });
    if (m.keep(1)) panel(m, legW(s, (u, v) => kr(u, v) + .0163), -.2, .2, .576, .594, { t: .0018, nu: 5, nv: 1, slot: S.ACCENT, skin: kneeSk, out: ol, edge: .04, round: 0 });
    if (m.keep(0)) panel(m, legW(s, .086), 1.3, 2.05, .468, .562, { t: .01, nu: 5, nv: 3, slot: S.PLATE2, skin: kneeSk, out: ol });
    m.revolve([[.002, .012], [.024, .012], [.029, .005], [.029, -.007]], { sides: m.keep(1) ? 10 : 6, slot: S.PLATE2, skin: kneeSk, m: T(s * .19, .512, .01, 0, 0, -s * Math.PI / 2), crease: 40 });
    // greave: wraps the shin and the calf, keel in front
    const gr = (u, v) => .074 + .012 * sstep(.28, .4, v) - .004 * sstep(.4, .45, v) + .006 * Math.max(0, -Math.cos(u));
    panel(m, legW(s, gr), -2.45, 2.7, .285, .445, { t: .012, nu: 11, nv: 2, slot: S.PLATE, skin: SH, out: ol, dome: .003 });
    if (m.keep(0)) panel(m, legW(s, (u, v) => gr(u, v) + .012), -.14, .14, .29, u => .445 - .1 * Math.abs(u), { t: .007, nu: 2, nv: 5, slot: S.PLATE2, skin: SH, out: ol, edge: .14 });
    // actuators on the outside of the leg, joined across the knee by a line
    actuator(m, .83, .64, s * .225, .01, TH, .0145);
    actuator(m, .44, .315, s * .19, .016, SH, .0125);
    if (m.keep(1)) buildHose(m, [[s * .225, .64, .02], [s * .214, .58, .028], [s * .2, .51, .03], [s * .19, .45, .024]], .0066, TH, SH, { sides: m.keep(1) ? 5 : 3, t0: .4, t1: .65 });
    // heavy boot cuff over the ankle
    m.revolve([[.074, .045], [.081, .038], [.083, .0], [.08, -.04], [.075, -.046]], { sides: m.keep(1) ? 12 : 7, slot: S.PLATE2, skin: SH, m: T(s * .1, .232, .008, 0, 0, 0, 1, 1, 1.12), crease: 50 });
  }
}

// ---------------------------------------------------------------- back: power core in a cage, two finned cells, exhausts, lines
function powerUnit(m) {
  const C = B.CHE, core = T(0, 1.3, .236);
  m.revolve([[.002, .16], [.046, .16], [.062, .146], [.066, .12], [.066, -.12], [.062, -.146], [.046, -.16], [.002, -.16]], { sides: m.seg(12, 6), slot: S.PLATE2, skin: C, m: core, crease: 40 });
  if (m.keep(1)) for (const y of [-.075, 0, .075]) m.revolve([[.0672, .011], [.0672, -.011]], { sides: m.seg(12, 8), slot: S.GLOW, skin: C, m: core.clone().multiply(T(0, y, 0)), crease: 60 });
  if (m.keep(0)) for (let k = 0; k < 5; k++) { const a = lerp(.55, Math.PI - .55, k / 4), px = Math.cos(a) * .079, pz = .236 + Math.sin(a) * .079; m.tube([[px, 1.155, pz - .004], [px, 1.3, pz], [px, 1.445, pz - .004]], .0045, { slot: S.METAL, skin: C, sides: 4, n: 4 }); }
  for (const y of [1.15, 1.45]) m.revolve([[.07, .008], [.083, .006], [.083, -.006], [.07, -.008]], { sides: m.seg(12, 8), slot: S.PLATE, skin: C, m: T(0, y, .236), crease: 50 });
  for (const s of [-1, 1]) {
    m.box([s * .118, 1.29, .208], [.094, .3, .11], .022, { slot: S.PLATE, skin: C });
    if (m.keep(0)) for (let k = 0; k < 4; k++) m.box([s * (.083 + k * .023), 1.29, .268], [.0045, .25, .016], .0015, { slot: S.PLATE2, skin: C });
    m.revolve([[.002, .02], [.019, .02], [.024, .016], [.024, -.03]], { sides: m.keep(1) ? 10 : 6, slot: S.PLATE2, skin: C, m: T(s * .118, 1.452, .2), crease: 45 });
    if (m.keep(1)) m.revolve([[.002, .0215], [.016, .0215]], { sides: 10, slot: S.RUBBER, skin: C, m: T(s * .118, 1.452, .2) });
    // lines: helmet to the cells, cells down to the belt, belt to the thigh actuators
    buildHose(m, [[s * .055, 1.6, .11], [s * .07, 1.55, .155], [s * .085, 1.495, .19], [s * .1, 1.46, .2]], .0105, B.HEA, C, { ribs: m.keep(0) ? 6 : 0, ribDepth: .22, sides: m.keep(1) ? 6 : 4, t0: .15, t1: .55 });
    if (m.keep(1)) buildHose(m, [[s * .1, 1.14, .21], [s * .12, 1.07, .185], [s * .135, 1.02, .158]], .0075, C, B.PEL, { sides: 5, t0: .3, t1: .7 });
    const TH = s < 0 ? B.THL : B.THR;
    if (m.keep(1)) buildHose(m, [[s * .16, .99, .11], [s * .2, .93, .07], [s * .225, .87, .03], [s * .225, .835, .012]], .0068, B.PEL, TH, { sides: 5, t0: .3, t1: .7 });
  }
}

// ---------------------------------------------------------------- close-range detail
function detailHead(m) {
  const H = B.HEA;
  for (const s of [-1, 1]) {
    for (const [l, a] of [[1.0, -.15], [1.5, -.45], [1.0, -.85], [1.48, .02]]) { const [q, d] = mapAt(hp, s * l, a, .0135); screw(m, q, d, { r: .0028, skin: H }); }
    for (const [l, a] of [[.9, .5], [1.2, .38]]) { const [q, d] = mapAt(hp, s * l, a, .0145); screw(m, q, d, { r: .0026, skin: H }); }
    m.tube(Array.from({ length: 7 }, (_, i) => hp(s * (1.85 + i * .16), .5 - .1 * Math.sin(i * .5), .0013)), .001, { slot: S.RUBBER, skin: H, sides: 3, n: 9, cap: false });     // panel line
    for (let k = 0; k < 3; k++) panel(m, (u, v, h) => hp(s * u, v, h + .0016), 2.13, 2.37, .6 - k * .075, .624 - k * .075, { t: .0012, nu: 3, nv: 1, slot: S.RUBBER, skin: H, out: outH, edge: .05 });   // vents
  }
  for (const a of [-.5, 0, .5]) { const [q, d] = mapAt(hp, Math.PI + a, -.7, .0115); screw(m, q, d, { r: .0026, skin: H }); }
}
function detailBody(m) {
  const C = B.CHE;
  // pectoral bolts, seams beside the keel
  for (const s of [-1, 1]) for (const [a, y] of [[.15, 1.285], [.9, 1.315], [.85, 1.42], [.2, 1.435]]) { const [q, d] = mapAt((u, v, h) => cuP(u, v, h), s * a, y, .0175); screw(m, q, d, { r: .003, skin: () => torsoSkin(0, y) }); }
  for (const s of [-1, 1]) stitchLine(m, [[s * .072, 1.22], [s * .074, 1.35], [s * .072, 1.465]].map(p => cuP(p[0], p[1], .0225)), { skin: torsoSkin, n: 10, slot: S.RUBBER });
  // core: status light, bolts on the cells
  m.box([0, 1.3, .3045], [.012, .03, .003], .001, { slot: S.GLOW, skin: C });
  for (const s of [-1, 1]) for (const y of [1.17, 1.41]) screw(m, [s * .118, y, .2635], [0, 0, 1], { r: .0034, skin: C });
  for (const s of [-1, 1]) {
    // pauldrons: rivets along the edge of the shell
    const U = s < 0 ? B.UAL : B.UAR, cap = capMap(s, .118);
    for (let i = 0; i < 7; i++) { const u = lerp(-1.1, 1.1, i / 6), [q, d] = mapAt(cap, u, -.04, .0158); screw(m, q, d, { r: .0034, h: .002, skin: () => [B.CHE, .55, U, .45] }); }
    for (const u of [-.6, .6]) { const [q, d] = mapAt(cap, u, .9, .0185); screw(m, q, d, { r: .0036, skin: () => [B.CHE, .62, U, .38] }); }
    // clamp on the arm line, a strap and buckle round the vambrace
    const F = s < 0 ? B.FAL : B.FAR, x = s * .2;
    m.revolve([[.0104, .006], [.0104, -.006]], { sides: 8, slot: S.METAL, skin: U, m: faceTo([x + s * .03, 1.3, .093], [0, 1, 0]), crease: 50 });
    for (const y of [.96, 1.08]) for (const a of [-1.9, 1.9]) { const [q, d] = mapAt(armW(s, .0835), a, y, 0); screw(m, q, d, { r: .0026, skin: F }); }
    // knee: hinge bolt, bolts on the greave
    const SH = s < 0 ? B.SHL : B.SHR;
    screw(m, [s * .2205, .512, .01], [s, 0, 0], { r: .007, h: .003, skin: SH });
    for (const a of [-1.4, 1.4]) for (const y of [.31, .42]) { const [q, d] = mapAt(legW(s, .0875), a, y, 0); screw(m, q, d, { r: .0026, skin: SH }); }
  }
  buckleAt(m, [0, 1.018, -.165], [0, 0, -1], { skin: B.PEL, w: .03, d: .018 });
  // panel seams: thin dark grooves that split the big plates
  const seam = (map, pts, skin) => m.tube(pts.map(p => map(p[0], p[1], p[2])), .0011, { slot: S.RUBBER, skin, sides: 3, n: pts.length * 4, cap: false, crease: 80 });
  for (const s of [-1, 1]) {
    const TH = s < 0 ? B.THL : B.THR, SH = s < 0 ? B.SHL : B.SHR, U = s < 0 ? B.UAL : B.UAR;
    const tr = (u, v) => lerp(.094, .115, sstep(.6, .88, v)) + .004 * Math.max(0, Math.sin(u)), gr = (u, v) => .074 + .012 * sstep(.28, .4, v) - .004 * sstep(.4, .45, v) + .006 * Math.max(0, -Math.cos(u));
    seam(legW(s, tr), [[.95, .655, .0124], [.95, .7, .0124], [.95, .76, .0124], [.95, .82, .0124], [.95, .872, .0124]], TH);
    seam(legW(s, tr), [[1.0, .752, .0124], [1.5, .752, .0124], [2.0, .752, .0124], [2.6, .752, .0124]], TH);
    seam(legW(s, gr), [[.35, .372, .0124], [1.0, .372, .0124], [1.7, .372, .0124], [2.5, .372, .0124]], SH);
    seam(capMap(s, .118), [[-.85, .78, .0152], [-.3, .82, .0152], [.3, .82, .0152], [.85, .78, .0152]], () => [B.CHE, .6, U, .4]);
    seam((u, v, h) => cuP(u, v, h), [[s * 1.25, 1.225, .0015], [s * 1.25, 1.33, .0015], [s * 1.22, 1.44, .0015]], torsoSkin);
  }
}
const DETAIL_PARTS = [detailHead, detailBody,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { slotPalm: S.CLOTH2 }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, {}); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  m => buildSuit(m, { slot: S.CLOTH, slotLegs: S.CLOTH, folds: .8 }),
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.PLATE, slotRand: S.PLATE2, slotSole: S.CLOTH2 }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.RUBBER, slotKnuckle: S.PLATE, slotBack: S.PLATE2, slotCuff: S.CLOTH2, cuff: false }); },
  waist, abdomen, cuirass, gorget, collar, helmet, pauldrons, arms, legs, frame, powerUnit,
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, null, ['suit', 'boots', 'gloves', 'waist', 'abdomen', 'cuirass', 'gorget', 'collar', 'helmet', 'pauldrons', 'arms', 'legs', 'frame', 'power']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
