// outfit-fantome.js — FRONT ZÉRO: FANTÔME, the sniper set. Original design: a deep soft hood with a peaked brim over a fitted face mask and slim
// shooting glasses, a ghillie mantle and a short back drape covered in burlap strips that sway, a slim chest rig with a rangefinder pouch,
// soft elbow and knee pads with a real dome. The strips lie within a few centimetres of the body: the outline stays a soldier's, never a bush.
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { BONE as B, SLOT as S, T, lerp, clamp, sstep, blend2, torsoSkin, buildSuit, buildGlove, buildBoot, buildPouch, buildGloveDetail, buildBootDetail, mapAt, stitchLine, buckleAt, webbingRow, panel, makeClothDef, clothSkin, defineOutfitSet, beltRing } from './outfit-kit.js';

const TAU = Math.PI * 2;
const FIBRE = [.96, 0, 0, .6];        // burlap: rough, woven, no sheen

// ---------------------------------------------------------------- colourways (plate, plate2 and accent are the three strip fibres)
const pbr = { plate: FIBRE, plate2: FIBRE, accent: [.95, 0, 0, .5], metal: [.5, .5, 0, 0] }, fpKit = 'plain';
export const OUTFIT_SETS = [
  { id: 'fantome-sous-bois', setId: 'fantome', name: 'FANTÔME', colorway: 'Sous-bois', rarity: 'Légende', palette: { cloth: 0x3a412b, cloth2: 0x2a2e21, plate: 0x5e5c3a, plate2: 0x3f4b2a, rubber: 0x24251f, metal: 0x3d3f3a, accent: 0x5e4a32, glow: 0x9fbf6a, visor: 0x0e1210, rim: 0x6a7458, lift: .03, floor: .03, pbr, fpKit, pattern: { type: 2, scale: 9, strength: .78, a: 0x2b3220, b: 0x6c6c45, plates: 1 } } },
  { id: 'fantome-steppe', setId: 'fantome', name: 'FANTÔME', colorway: 'Steppe', rarity: 'Élite', palette: { cloth: 0x5a4e38, cloth2: 0x352d22, plate: 0x7e6d4a, plate2: 0x473f2a, rubber: 0x2c261d, metal: 0x4f4a42, accent: 0x6b5c38, glow: 0xd9c58a, visor: 0x18140c, rim: 0x6a5e48, lift: .016, pbr, fpKit, pattern: { type: 2, scale: 10, strength: .55, a: 0x9a875d, b: 0x4a4130, plates: 1 } } },
  { id: 'fantome-neige', setId: 'fantome', name: 'FANTÔME', colorway: 'Neige', rarity: 'Élite', palette: { cloth: 0x3f484e, cloth2: 0x22282c, plate: 0x848c91, plate2: 0x323a3f, rubber: 0x1f2428, metal: 0x505a60, accent: 0x3e4843, glow: 0xdff4ff, visor: 0x0e161c, rim: 0x4c565c, lift: .008, pbr, fpKit, pattern: { type: 1, scale: 14, strength: .6, a: 0xc4cbcf, b: 0x46525a, plates: 1 } } },
  { id: 'fantome-cendre', setId: 'fantome', name: 'FANTÔME', colorway: 'Cendre', rarity: 'Élite', palette: { cloth: 0x262728, cloth2: 0x18191a, plate: 0x4e4b46, plate2: 0x2e2c29, rubber: 0x1a1b1d, metal: 0x46494d, accent: 0x4e4941, glow: 0xc8d0d8, visor: 0x0c0e10, rim: 0x7a8088, lift: .045, floor: .03, pbr, fpKit, pattern: { type: 2, scale: 9, strength: .72, a: 0x1b1c1e, b: 0x6f7275, plates: 1 } } },
];

// ---------------------------------------------------------------- random, strips
let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const FIBRES = [S.PLATE, S.PLATE, S.PLATE2, S.PLATE2, S.PLATE2, S.ACCENT];
const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** One burlap strip from p (surface point, outward normal n): it runs downhill along the surface, then hangs, lying a few millimetres off it,
 *  wide at its root and frayed thin at its tip. r: five random numbers in [0,1) (the caller draws them, so every LOD gets the same strips). */
function strip(m, p, n, len, W, r, o = {}) {
  n = norm(n); const gn = -n[1], hz = norm([n[0], 0, n[2]]);
  let t = [gn * -n[0], -1 + gn * -n[1], gn * -n[2]]; t = Math.hypot(t[0], t[1], t[2]) < .45 ? norm([t[0] + hz[0] * .7, t[1], t[2] + hz[2] * .7]) : norm(t);
  const side0 = norm(cross(t, n)), a = (r[0] - .5) * (o.spread ?? .9), tt = norm(add(t.map(x => x * Math.cos(a)), side0, Math.sin(a))), side = norm(cross(tt, n));
  const L = len * (.7 + r[1] * .6), w = (o.w ?? .0105) * (.75 + r[2] * .5), lift = o.lift ?? .005, slot = o.slot ?? FIBRES[(r[3] * FIBRES.length) | 0], curl = (r[4] - .3) * .012;
  const q0 = add(p, n, .0025), q1 = add(add(q0, tt, L * .34), n, lift * .6), d2 = norm(add(tt.map(x => x * .5), [0, -1, 0], .5)), q2 = add(add(q1, d2, L * .33), n, lift), d3 = norm(add(tt.map(x => x * .2), [0, -1, 0], .8)), q3 = add(add(q2, d3, L * .33), n, lift * 1.4 + curl);
  m.tube([q0, q1, q2, q3], k => w * (1 - .62 * k ** 1.4), { slot, skin: () => W, sides: 3, n: m.keep(0) ? 3 : 2, flat: .2, up: side, cap: false, crease: 75, ao: (x, y, z) => .5 + .45 * Math.min(1, Math.hypot(x - q0[0], y - q0[1], z - q0[2]) / L) });
  if (m.keep(0) && !o.noFray && r[4] < .55) { const sd = r[2] > .5 ? 1 : -1, f2 = add(add(q2, side, sd * w * .9), n, .001), f3 = add(add(add(q3, side, sd * (w * 2.2 + .004)), d3, L * .18), n, curl * .5); m.tube([add(q1, side, sd * w * .5), f2, f3], .0016, { slot, skin: () => W, sides: 3, n: 2, cap: false, crease: 80, ao: .85 }); }      // frayed jute: a loose fibre splits off near the tip
}
/** Strips on a surface map(u, v, h): count roots over [u0,u1] x [v0,v1], some roots grow a tuft of two. LOD1 keeps one root in three (single, wider), LOD2 none. */
function stripField(m, map, u0, u1, v0, v1, count, len, skin, o = {}) {
  seed = o.seed ?? 7;
  for (let i = 0; i < count; i++) {
    const u = lerp(u0, u1, (i + rnd()) / count), v = lerp(v0, v1, rnd()), tuft = rnd() < (o.tuft ?? .4), R = [0, 1].map(() => [rnd(), rnd(), rnd(), rnd(), rnd()]);
    if ((o.skip && o.skip(u, v)) || m.lod === 2 || (m.lod === 1 && i % 3)) continue;
    const [p, d] = mapAt(map, u, v, o.h ?? 0), W = o.skinUV ? o.skinUV(u, v) : typeof skin === 'function' ? skin(p[0], p[1], p[2]) : [skin, 1];
    strip(m, p, d, len, W, R[0], { ...o, w: m.lod === 1 ? (o.w ?? .0105) * 1.35 : o.w });
    if (tuft && m.lod === 0) strip(m, p, d, len * .8, W, R[1], o);
  }
}

// ---------------------------------------------------------------- head: hood, mask, glasses
const HC = [0, 1.668, -.01], HR = [.128, .132, .142];
const faceF = (lon, lat) => (lon / .8) ** 2 + ((lat + .13) / .6) ** 2;      // < 1 inside the face opening
const hoodP = (lon, lat, off = 0) => {
  const k = lat >= -.5 ? Math.cos(lat) : lerp(Math.cos(-.5), .72, sstep(-.5, -1.15, lat)), y = lat >= -.5 ? Math.sin(lat) : lerp(Math.sin(-.5), -.86, sstep(-.5, -1.15, lat));
  const lump = 1 + .045 * Math.sin(lon * 5 + lat * 3) * Math.sin(lat * 4 + 1) + .025 * Math.sin(lon * 9 - lat * 6) + .012 * Math.sin(lon * 17 + lat * 11), front = Math.max(0, Math.cos(lon));
  const brim = .02 * Math.exp(-((lon / .62) ** 2)) * sstep(.25, .48, lat) * sstep(.95, .6, lat) * front, inner = sstep(1.04, .74, faceF(lon, lat)) * (front > .2 ? 1 : 0);
  const R = lerp(1, .58, inner);
  return [HC[0] + (HR[0] * k * R * lump + off + brim * .3) * Math.sin(lon), HC[1] + HR[1] * y * lerp(1, .9, inner) + (lat > 0 ? off * Math.sin(lat) : 0), HC[2] - (HR[2] * k * R * lump + off + brim) * Math.cos(lon)];
};
const outH = (x, y, z) => [x - HC[0], y - HC[1] + .02, z - HC[2]];
const maskP = (lon, lat, off = 0) => {
  const nose = .016 * Math.exp(-((lon / .2) ** 2) - (((lat + .02) / .2) ** 2)), chin = .008 * Math.exp(-((lon / .4) ** 2) - (((lat + .5) / .2) ** 2)), R = .097 * (1 - .1 * (lon / .9) ** 2) + nose + chin + off, c = Math.cos(lat);
  return [HC[0] + R * Math.sin(lon) * c * .98, HC[1] + .1 * Math.sin(lat), HC[2] - R * 1.06 * Math.cos(lon) * c];
};
const hoodSkin = (x, y) => y > 1.585 ? [B.HEA, 1] : blend2(B.NEC, B.HEA, y, 1.57, .02);
function hood(m) {
  const nu = m.seg(36, 14), nv = m.seg(14, 6);
  m.grid(nu, nv, (u, v) => hoodP(u * TAU - Math.PI, lerp(-1.15, 1.5707, v ** .9)), { wrapU: true, capB: true, slot: S.CLOTH, skin: hoodSkin, crease: 180, out: outH, ao: (x, y, z) => { const f = z < HC[2] - .05 && Math.abs(x) < .1 ? .5 + .5 * sstep(1.66, 1.75, y) : 1; return f * (.7 + .3 * sstep(1.56, 1.7, y)); } });
  // face: fitted mask up to the nose bridge, slim glasses under the brim
  m.grid(m.seg(16, 8), m.seg(10, 5), (u, v) => maskP(lerp(-.92, .92, u), lerp(-.86, .52, v)), { slot: S.CLOTH2, skin: B.HEA, crease: 180, out: outH, ao: (x, y) => .55 + .45 * sstep(1.7, 1.6, y) });
  m.grid(m.seg(14, 6), 1, (u, v) => maskP(lerp(-.72, .72, u), lerp(.07, .25, v), .007 + .004 * Math.cos(lerp(-.72, .72, u) * 2)), { slot: S.VISOR, skin: B.HEA, crease: 180, out: outH });
  if (m.keep(1)) m.tube(Array.from({ length: 9 }, (_, i) => { const l = lerp(-.74, .74, i / 8); return maskP(l, .255, .009 + .004 * Math.cos(l * 2)); }), .0024, { slot: S.RUBBER, skin: B.HEA, sides: 4, n: 12 });
  // cowl: the hood's skirt laid over the collar and the mantle
  const n = m.seg(26, 10), rows = m.seg(4, 2), rings = [];
  for (let j = 0; j <= rows; j++) { const v = j / rows, y = lerp(1.565, 1.468, v), rx = lerp(.096, .19, v ** 1.2), rz = lerp(.1, .165, v ** 1.2), ring = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, l = 1 + .05 * Math.sin(a * 6 + v * 3) * v; ring.push([rx * l * Math.sin(a), y + .012 * Math.sin(a * 4 + 1) * v, .005 - rz * l * Math.cos(a)]); } rings.push(ring); }
  m.loft(rings, { slot: S.CLOTH, skin: (x, y) => y > 1.52 ? blend2(B.NEC, B.HEA, y, 1.56, .02) : blend2(B.CHE, B.NEC, y, 1.5, .03), crease: 180, out: (x, y, z) => [x, .3, z], ao: .8 });
  // strips on the hood: over the crown and down the back and sides, never across the face
  stripField(m, (u, v, h) => hoodP(u, v, h + .002), -Math.PI, Math.PI, -.45, 1.45, 84, .1, hoodSkin, { seed: 11, skip: (u, v) => faceF(u, v) < 1.45 || (Math.abs(u) < 1.0 && v < .58), lift: .005 });
  stripField(m, (u, v, h) => hoodP(u, v, h + .002), -.85, .85, .62, 1.1, 18, .042, hoodSkin, { seed: 12, lift: .004, w: .008, spread: .5 });      // a short shaggy fringe on the brim
}

// ---------------------------------------------------------------- mantle (rigid, over the shoulders) and back drape (cloth)
const mantleP = (u, v, off = 0) => {
  const a = u * TAU, sw = Math.sin(v * Math.PI / 2), edge = 1.395 - .055 * Math.cos(a) ** 2 + .01 * Math.sin(a * 7), rx = lerp(.12, .286, sw), rz = lerp(.105, .176, sw);
  const lump = 1 + .03 * Math.sin(a * 9 + v * 2) * v + .02 * Math.sin(a * 5 - v * 4), y = lerp(1.505, edge, v ** 1.35) + .012 * Math.sin(v * Math.PI);
  return [(rx * lump + off) * Math.sin(a), y + off * .4, .008 - (rz * lump + off) * Math.cos(a)];
};
const mantleSkin = (x, y) => { const k = sstep(.2, .28, Math.abs(x)) * sstep(1.47, 1.41, y) * .55, U = x < 0 ? B.UAL : B.UAR; return k > .01 ? [B.CHE, 1 - k, U, k] : [B.CHE, 1]; };
function mantle(m) {
  m.grid(m.seg(36, 14), m.seg(5, 2), (u, v) => mantleP(u, v), { wrapU: true, slot: S.PLATE2, skin: mantleSkin, crease: 180, out: (x, y, z) => [x, .5, z - .008], ao: (x, y) => .7 + .3 * sstep(1.4, 1.5, y) });
  if (m.keep(1)) m.grid(m.seg(36, 14), 1, (u, v) => { const p = mantleP(u, 1, -.003 * v); p[1] -= .004 * v; return p; }, { wrapU: true, slot: S.CLOTH2, skin: mantleSkin, crease: 180, out: (x, y, z) => [x, 0, z] });
}
function mantleStrips(m) {
  stripField(m, (u, v, h) => mantleP(u, v, h + .002), 0, 1, .15, .98, 130, .11, mantleSkin, { seed: 21, lift: .006 });
  // a sparse fringe on the torso front, hanging from the chest band: short and flat so the outline stays a soldier's
  stripField(m, (u, v, h) => { const a = u, R = .19 + h + .004, Z = .132 + h + .004; return [R * Math.sin(a), v, -Z * Math.cos(a)]; }, -1.0, 1.0, 1.19, 1.21, 22, .075, torsoSkin, { seed: 23, lift: .003, tuft: .2, spread: .4 });
}
const DR_C = 5, DR_R = 2;
const drapePoint = (col, row) => { const t = col / (DR_C - 1), phi = lerp(-1.0, 1.0, t), w = row / DR_R, rx = lerp(.19, .205, w), rz = lerp(.158, .17, w), y = lerp(1.415 - .02 * Math.abs(Math.sin(phi)), 1.07 + .025 * Math.abs(phi), w); return [rx * Math.sin(phi), y, rz * Math.cos(phi) + .012]; };
const DRAPE = makeClothDef(Array.from({ length: DR_R + 1 }, (_, r) => Array.from({ length: DR_C }, (_, c) => drapePoint(c, r))));
const drapeAt = (u, v, off = 0) => { const col = u * (DR_C - 1), row = v * DR_R, p = drapePoint(col, row), phi = lerp(-1.0, 1.0, u), lump = (.006 * Math.sin(u * 23 + v * 5) + .004 * Math.sin(u * 41 - v * 9)) * v; return [p[0] + Math.sin(phi) * (lump + off), p[1] - .018 * Math.sin(u * 17 + 1) * v ** 3, p[2] + Math.cos(phi) * (lump + off)]; };
function drape(m) {
  const nu = m.seg(20, 8), nv = m.seg(6, 3), key = (x, y, z) => Math.round(x * 2e3) + '_' + Math.round(y * 2e3) + '_' + Math.round(z * 2e3);
  const build = (off, sign, slot) => {
    const V = [], F = [], nd = new Map(), cols = nu + 1;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, v = j / nv, p = drapeAt(u, v, off); V.push(p); nd.set(key(p[0], p[1], p[2]), [u * (DR_C - 1), v * DR_R]); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = i + j * cols, b = a + 1, c = a + cols, d = c + 1; F.push(a, b, c, b, d, c); }
    m.surf(V, F, { slot, crease: 180, ao: sign > 0 ? .9 : .45, skin: (x, y, z) => { const c = nd.get(key(x, y, z)); return c ? clothSkin(DRAPE, c[0], c[1]) : [B.CHE, 1]; }, out: (x, y, z) => [sign * x, 0, sign * (z - .012)] });
  };
  build(.003, 1, S.PLATE2); if (m.keep(1)) build(-.003, -1, S.CLOTH2);
}
function drapeStrips(m) {
  stripField(m, (u, v, h) => drapeAt(u, v, h + .004), 0, 1, .02, 1, 110, .12, null, { seed: 31, lift: .006, skinUV: (u, v) => clothSkin(DRAPE, u * (DR_C - 1), v * DR_R) });
}

// ---------------------------------------------------------------- rig, belt, pads, limbs
const legW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .1 + s * r * Math.sin(u), v, -r * Math.cos(u)]; };
const armW = (s, R) => (u, v, h) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .2 + s * r * Math.cos(u), v, r * Math.sin(u)]; };
function rig(m) {
  const C = B.CHE, chest = (u, v, h) => { const a = u / .17, R = .186 + h, Z = .128 + h; return [R * Math.sin(a), v, -Z * Math.cos(a)]; };
  // chest band with three magazine pouches and a rangefinder pouch on the left
  m.grid(m.seg(24, 10), 1, (u, v) => { const a = lerp(-2.3, 2.3, u); return [.19 * Math.sin(a), lerp(1.2, 1.255, v), -.132 * Math.cos(a)]; }, { slot: S.CLOTH2, skin: torsoSkin, crease: 180, out: (x, y, z) => [x, 0, z] });
  for (let i = 0; i < 3; i++) { const a = (i - .2) * .4, cx = Math.sin(a) * .19, cz = -Math.cos(a) * .132 - .016; buildPouch(m, .052, .085, .032, T(cx, 1.235, cz, 0, Math.PI - a, 0), { slot: S.CLOTH, slotFlap: S.CLOTH2, skin: C, tab: false }); }
  buildPouch(m, .062, .09, .05, T(-.105, 1.315, -.15, -.1, Math.PI + .35, 0), { slot: S.CLOTH2, slotFlap: S.CLOTH, skin: C, slotTab: S.RUBBER });
  // shoulder straps down the front, under the mantle
  for (const s of [-1, 1]) m.tube([[s * .1, 1.43, -.122], [s * .11, 1.34, -.142], [s * .11, 1.26, -.141]], .011, { slot: S.CLOTH2, skin: torsoSkin, sides: 5, flat: .35, n: m.seg(5, 3), up: [1, 0, 0] });
  void chest;
  // belt, two pouches, a pocket on the right thigh for the range card
  beltRing(m, 1.012, .178, .138, { w: .044, t: .0055, sag: .006, cz: .004, slot: S.RUBBER, slotKeeper: S.RUBBER, skin: B.PEL, keepers: [-.72, .72, Math.PI - .6, Math.PI + .6] });
  for (const a of [-1.2, 1.25]) buildPouch(m, .056, .07, .034, T(Math.sin(a) * .19, .97, .004 - Math.cos(a) * .148, 0, Math.PI - a, 0), { slot: S.CLOTH2, slotFlap: S.CLOTH, skin: B.PEL, tab: false });
  buildPouch(m, .085, .11, .026, T(.198, .74, .0, 0, Math.PI / 2, 0), { slot: S.CLOTH, slotFlap: S.CLOTH2, skin: B.THR, slotTab: S.RUBBER, flap: .3 });
}
function pads(m) {
  for (const s of [-1, 1]) {
    const U = s < 0 ? B.UAL : B.UAR, F = s < 0 ? B.FAL : B.FAR, SH = s < 0 ? B.SHL : B.SHR, TH = s < 0 ? B.THL : B.THR, x = s * .2;
    // soft knee pad: a real dome over the kneecap, a rubber rim, straps above and below
    const kr = (u, v) => .079 + .022 * Math.max(0, 1 - (u / 1.2) ** 2) * Math.max(0, 1 - ((v - .51) / .085) ** 2), kSk = (px, py) => blend2(SH, TH, py, .55, .03), ol = (px, py, pz) => [px - s * .1, 0, pz];
    panel(m, legW(s, kr), -1.2, 1.2, u => .44 + .035 * (u / 1.2) ** 2, u => .595 - .03 * (u / 1.2) ** 2, { t: .01, nu: 11, nv: 7, slot: S.CLOTH2, skin: kSk, out: ol, dome: .004, edge: .16, round: .6 });
    for (const y of [.43, .615]) m.revolve([[.072, .008], [.0765, .004], [.0765, -.004], [.072, -.008]], { sides: m.keep(1) ? 14 : 8, slot: S.RUBBER, skin: y > .5 ? TH : SH, m: T(s * .1, y, .003), crease: 50 });
    // elbow pad on the back of the elbow
    panel(m, armW(s, (u, v) => .064 + .016 * Math.max(0, 1 - ((u - Math.PI / 2) / 1.1) ** 2) * Math.max(0, 1 - ((v - 1.16) / .07) ** 2)), Math.PI / 2 - 1.05, Math.PI / 2 + 1.05, 1.1, 1.222, { t: .008, nu: 8, nv: 6, slot: S.CLOTH2, skin: () => [U, .5, F, .5], out: (px, py, pz) => [px - x, 0, pz], edge: .16, round: .6 });
    m.revolve([[.0662, .007], [.0695, .0035], [.0695, -.0035], [.0662, -.007]], { sides: m.keep(1) ? 12 : 7, slot: S.RUBBER, skin: F, m: T(x, 1.098, 0), crease: 50 });
    // team band on the sleeve, below the mantle
    m.revolve([[.0738, .0105], [.077, .007], [.077, -.007], [.0738, -.0105]], { sides: m.keep(1) ? 16 : 8, slot: S.TEAM, skin: U, m: T(x, 1.27, 0), crease: 50 });
    // a few strips on the outside of the upper arm, the back of the thigh and the calf
    stripField(m, armW(s, (u, v) => .074 - .012 * sstep(1.42, 1.3, v)), -1.0, 1.6, 1.32, 1.43, 12, .075, U, { seed: 41 + s, lift: .004 });
    stripField(m, legW(s, .1), 1.0, 3.7, .68, .9, 14, .1, TH, { seed: 51 + s, lift: .005 });
    stripField(m, legW(s, .068), 1.5, 3.5, .3, .42, 7, .08, SH, { seed: 61 + s, lift: .004 });
  }
}

// ---------------------------------------------------------------- close-range detail
function detail(m) {
  const H = B.HEA;
  // hood drawcords with toggles, a seam round the face opening
  for (const s of [-1, 1]) { const a = maskP(s * .55, -.62, .004), b = [a[0] + s * .006, a[1] - .05, a[2] - .006]; m.tube([a, [a[0], a[1] - .025, a[2] - .004], b], .0018, { slot: S.RUBBER, skin: H, sides: 4, n: 6 }); m.revolve([[.0042, .007], [.0048, 0], [.0042, -.007]], { sides: 6, slot: S.METAL, skin: H, m: T(b[0], b[1] - .006, b[2]) }); }
  stitchLine(m, Array.from({ length: 21 }, (_, i) => { const t = i / 20 * TAU, l = Math.sin(t) * .86, la = -.13 + Math.cos(t) * .64; return hoodP(l, la, .004); }), { skin: hoodSkin, n: 40, slot: S.CLOTH2 });
  stitchLine(m, Array.from({ length: 9 }, (_, i) => maskP(0, lerp(-.8, -.2, i / 8), .002)), { skin: H, n: 12, slot: S.CLOTH });
  // glasses hinges
  for (const s of [-1, 1]) m.box([0, 0, 0], [.004, .006, .014], .001, { slot: S.METAL, skin: H, m: T(...maskP(s * .76, .17, .008), 0, s * .9, 0) });
  // rig: buckles, webbing on the band, stitched pads
  for (const s of [-1, 1]) buckleAt(m, [s * .11, 1.275, -.146], [0, -.05, -1], { skin: torsoSkin, w: .022, d: .014 });
  webbingRow(m, (u, v, h) => { const a = u / .19; return [(.19 + h) * Math.sin(a), v, -(.132 + h) * Math.cos(a)]; }, -.16, .16, 1.214, { skin: torsoSkin, h: .002, pitch: .03 });
  for (const s of [-1, 1]) { const SH = s < 0 ? B.SHL : B.SHR, kr = (u, v) => .079 + .022 * Math.max(0, 1 - (u / 1.2) ** 2) * Math.max(0, 1 - ((v - .51) / .085) ** 2); stitchLine(m, Array.from({ length: 13 }, (_, i) => { const t = i / 12 * TAU; return legW(s, kr)(Math.sin(t) * 1.0, .515 + Math.cos(t) * .06, .0105); }), { skin: SH, n: 26 }); buckleAt(m, [s * .176, .43, .003], [s, 0, 0], { up: [0, 0, 1], skin: SH, w: .014, d: .012, t: .0024 }); }
  buckleAt(m, [0, 1.012, -.142], [0, 0, -1], { skin: B.PEL, w: .028, d: .016 });
}
const DETAIL_PARTS = [detail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { guard: false, slotPalm: S.RUBBER }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, { slotLace: S.CLOTH2 }); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  m => buildSuit(m, { slot: S.CLOTH, slotLegs: S.CLOTH, folds: 1.15 }),
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.RUBBER, slotRand: S.CLOTH2, slotSole: S.RUBBER, slotMid: S.CLOTH2, slotTongue: S.CLOTH2 }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.CLOTH2, slotCuff: S.CLOTH, guard: false, cuff: false }); },
  rig, pads, mantle, mantleStrips, drape, drapeStrips, hood,
];
const SET = defineOutfitSet(OUTFIT_SETS, PARTS, DETAIL_PARTS, DRAPE, ['suit', 'boots', 'gloves', 'rig', 'pads', 'mantle', 'mantleStrips', 'drape', 'drapeStrips', 'hood']);
export const { outfitById, prepareOutfits, attachOutfit, fpArms, outfitTriangles, outfitDetailTriangles, outfitPartStats } = SET;
void clamp;
