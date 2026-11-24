// outfit-eclipse.js — FRONT ZÉRO: ÉCLIPSE, the first premium outfit set. Original design: crescent-visor helmet, canted octagonal filters, wrapped mantle, eclipse-disc insignia.
// One geometry per LOD shared by the eight colourways; a colourway is a palette (one material, same shader program).
// Public: OUTFIT_SETS, outfitById, prepareOutfits(yieldFn), attachOutfit(soldier, id, {team, lod}), fpArms(id).
import { knuckleGuard, faceTo, mapAt, screw, stitchLine, webbingRow, buckleAt, carabiner, coilCable, railMount, buildGloveDetail, buildBootDetail, detailTexture, Mesher, BONE as B, SLOT as S, T, lerp, clamp, sstep, chaikin, wrapMap, domeMap, planeMap, ngon, crescent, torsoSkin, blend2, buildSuit, buildGlove, buildBoot, buildPouch, buildHose, makeClothDef, clothSkin, outfitMaterial, attachInstance, fpArmsFor, beltRing } from './outfit-kit.js';

export { setOutfitView, setOutfitQuality, hookOutfitShadows } from './outfit-kit.js';
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- colourways
const P = (o) => o;
export const OUTFIT_SETS = [
  { id: 'eclipse-noir-jaune', setId: 'eclipse', name: 'ÉCLIPSE', colorway: 'Noir / Jaune', rarity: 'Légende', palette: P({ cloth: 0x17181b, cloth2: 0x101114, plate: 0x212327, plate2: 0x2b2d32, rubber: 0x121316, metal: 0x4c4f55, accent: 0xf2c014, glow: 0xffc21a, visor: 0x1d1608, rim: 0x707172, lift: .05 }) },
  { id: 'eclipse-noir-rouge', setId: 'eclipse', name: 'ÉCLIPSE', colorway: 'Noir / Rouge', rarity: 'Élite', palette: P({ cloth: 0x17181a, cloth2: 0x101113, plate: 0x222427, plate2: 0x2c2e32, rubber: 0x131416, metal: 0x4e5055, accent: 0xd8141f, glow: 0xff2a26, visor: 0x150b0c, rim: 0x707172, lift: .05 }) },
  { id: 'eclipse-noir-blanc', setId: 'eclipse', name: 'ÉCLIPSE', colorway: 'Noir / Blanc', rarity: 'Élite', palette: P({ cloth: 0x18191b, cloth2: 0x101113, plate: 0x25272a, plate2: 0xd9dbdc, rubber: 0x141517, metal: 0x8d9094, accent: 0xf4f5f4, glow: 0xe9f3ff, visor: 0x0d1013, rim: 0x707172, lift: .05, pbr: { plate2: [.48, .03, 0, 0] } }) },
  { id: 'eclipse-arctique', setId: 'eclipse', name: 'ÉCLIPSE', colorway: 'Arctique', rarity: 'Élite', palette: P({ cloth: 0x3e4850, cloth2: 0x313a41, plate: 0x9aa4a9, plate2: 0x4a565e, rubber: 0x1e2428, metal: 0x66727a, accent: 0x38c6e8, glow: 0x6fe6ff, visor: 0x123241, rim: 0x47525a, lift: .008, fpGlove: 0x4a5359, pattern: { type: 1, scale: 15, strength: .55, a: 0x95a2a9, b: 0x56646c } }) },
  { id: 'eclipse-desert', setId: 'eclipse', name: 'ÉCLIPSE', colorway: 'Désert', rarity: 'Élite', palette: P({ cloth: 0x6a5a3e, cloth2: 0x433826, plate: 0x7d6c4e, plate2: 0x5c4d36, rubber: 0x2e271e, metal: 0x7f6f55, accent: 0xd9601c, glow: 0xff8a2e, visor: 0x2c1a0a, rim: 0x5c5040, lift: .01, fpGlove: 0x4b3f2e, pattern: { type: 3, scale: 11, strength: .42, a: 0x8c7650, b: 0x584a33 } }) },
  { id: 'eclipse-foret', setId: 'eclipse', name: 'ÉCLIPSE', colorway: 'Forêt', rarity: 'Élite', palette: P({ cloth: 0x3d4a2d, cloth2: 0x262f1d, plate: 0x4d5b39, plate2: 0x333f27, rubber: 0x1b2015, metal: 0x5a6148, accent: 0xb5d334, glow: 0xcfee4a, visor: 0x1b2208, rim: 0x566048, lift: .016, pattern: { type: 2, scale: 8.5, strength: .78, a: 0x232c1a, b: 0x56603a } }) },
  { id: 'eclipse-acier-cyan', setId: 'eclipse', name: 'ÉCLIPSE', colorway: 'Acier / Cyan', rarity: 'Élite', palette: P({ cloth: 0x2c3238, cloth2: 0x1c2126, plate: 0x6d7782, plate2: 0x454d56, rubber: 0x181c20, metal: 0xa6b1bb, accent: 0x12d8ee, glow: 0x35ecff, visor: 0x06222c, rim: 0x5c6c78, lift: .04, pbr: { plate: [.36, .55, 0, 0], plate2: [.4, .5, 0, 0] }, pattern: { type: 4, scale: 26, strength: .34, a: 0x3a4148, b: 0x262b31 } }) },
  { id: 'eclipse-or-noir', setId: 'eclipse', name: 'ÉCLIPSE', colorway: 'Or Noir', rarity: 'Légende', palette: P({ cloth: 0x131210, cloth2: 0x0d0c0a, plate: 0x1c1a16, plate2: 0xb98b2e, rubber: 0x100f0d, metal: 0xd8a941, accent: 0xe6b84a, glow: 0xffd77a, visor: 0x2a1c05, rim: 0x707172, lift: .05, pbr: { plate: [.3, .25, 0, 0], plate2: [.32, .72, .02, 0], metal: [.3, .75, .03, 0], accent: [.3, .68, .08, 0] } }) },
];
const BY_ID = new Map(OUTFIT_SETS.map(o => [o.id, o]));
export const outfitById = id => BY_ID.get(id) || null;

// ---------------------------------------------------------------- helmet
const HC = [0, 1.7, -.008], HR = [.128, .126, .15];
const rimLat = lon => { const f = Math.cos(lon) * .5 + .5; return lerp(-.6, -.66, sstep(.4, .9, f)); };
const hexa = lon => { const N = 8, st = TAU / N, q = ((lon + st / 2) % st + st) % st - st / 2; return Math.cos(st / 2) / Math.cos(q); };     // rounded octagonal plan: sculpted planes on the skull
const helmetPoint = (lon, lat, off = 0) => {
  const ridge = 1 + .03 * Math.exp(-((Math.sin(lon) / .13) ** 2)) * sstep(-.1, .5, lat), side = 1 - .05 * Math.exp(-(((Math.abs(lon) - 1.57) / .5) ** 2)) * Math.exp(-(((lat - .62) / .28) ** 2));
  const plan = lerp(1, hexa(lon + Math.PI / 8), .28 * sstep(1.45, .55, lat)), k = ridge * side * plan, cl = Math.cos(lat);
  return [HC[0] + (HR[0] * k + off) * Math.sin(lon) * cl, HC[1] + (HR[1] * k + off) * Math.sin(lat), HC[2] - (HR[2] * k + off) * Math.cos(lon) * cl];
};
const outH = (x, y, z) => [x - HC[0], y - HC[1], z - HC[2]];

function helmet(m) {
  const H = B.HEA, nu = m.seg(30, 14), nv = m.seg(8, 5);
  m.ell([0, 1.655, -.012], [.082, .088, .09], { slot: S.RUBBER, skin: H, nu: 10, nv: 6, ao: .6 });      // nothing shows through under the rim
  m.grid(nu, nv, (u, v) => { const lon = u * TAU - Math.PI, lat = lerp(rimLat(lon), 1.5, v ** .92); return helmetPoint(lon, lat); }, { wrapU: true, slot: S.PLATE, skin: H, crease: 40, capB: true, out: outH, ao: (x, y) => .7 + .3 * sstep(1.64, 1.74, y) });
  // rolled lower edge
  if (m.keep(1)) m.grid(nu, 1, (u, v) => { const lon = u * TAU - Math.PI, l0 = rimLat(lon); return helmetPoint(lon, l0 + .012 - .04 * v, .0035 * (1 - v)); }, { wrapU: true, slot: S.PLATE2, skin: H, crease: 180, out: outH });

  // keel: from the brow over the crown to the nape
  const crest = (u, w, h) => { const a = lerp(.84, 3.5, (u + 1) / 2), lat = Math.PI / 2 - Math.abs(a - Math.PI / 2), lon = a < Math.PI / 2 ? 0 : Math.PI, p = helmetPoint(lon, lat, h + .001); p[0] += w; return p; };
  m.plate([[-1, -.012], [-.74, -.024], [-.15, -.03], [.42, -.026], [1, -.01], [1, .01], [.42, .026], [-.15, .03], [-.74, .024], [-1, .012]], crest, { t: .006, slot: S.PLATE2, skin: H, round: 0, crease: 28, out: outH });
  if (m.keep(1)) m.plate([[-.9, -.0028], [.3, -.0042], [.9, -.0018], [.9, .0018], [.3, .0042], [-.9, .0028]], (u, w, h) => crest(u, w, h + .006), { t: .0012, bevel: .0008, slot: S.ACCENT, skin: H, inner: 1, round: 0, out: outH });

  for (const s of [-1, 1]) {
    const mp = (u, v, h) => helmetPoint(s * u, v, h + .001);
    // swept temple plate and lower cheek plate: their edges echo the crescent
    m.plate([[1.06, .34], [1.14, .62], [1.5, .78], [2.2, .6], [2.46, .2], [2.1, -.06], [1.56, .06], [1.18, .14]], mp, { t: .005, slot: S.PLATE2, skin: H, crease: 46, out: outH });
    m.plate([[1.52, -.17], [2.02, -.17], [2.46, -.03], [2.66, -.36], [2.36, -.56], [1.72, -.45]], mp, { t: .0045, slot: S.PLATE, skin: H, crease: 46, out: outH });
    if (m.keep(1)) m.plate([[1.16, .5], [1.24, .62], [1.5, .71], [1.52, .685], [1.26, .585], [1.2, .49]], mp, { t: .0065, bevel: .001, slot: S.ACCENT, skin: H, inner: 1, round: 0, out: outH });
    // ear pod: canted octagon with a metal cap
    const ear = T(s * .128, 1.664, .014, 0, 0, -s * Math.PI / 2);
    m.revolve([[.002, .016], [.027, .016], [.034, .011], [.038, .002], [.038, -.012], [.028, -.016]], { sides: 8, phase: Math.PI / 8, slot: S.PLATE2, skin: H, m: ear, crease: 30 });
    if (m.keep(1)) m.revolve([[.002, .0195], [.016, .0195], [.0195, .0165]], { sides: 8, phase: Math.PI / 8, slot: S.METAL, skin: H, m: ear, crease: 30 });
  }
  // rear neck guard
  { const g = (u, v, h) => { const lon = Math.PI + u, cl = Math.cos(v); return [(.133 + h) * Math.sin(lon) * cl, 1.63 + v * .1, -.008 - (.156 + h) * Math.cos(lon) * cl]; };
    m.plate([[-.92, -.4], [.92, -.4], [1.02, .1], [.5, .36], [-.5, .36], [-1.02, .1]], g, { t: .006, slot: S.PLATE2, skin: H, crease: 28, out: (x, y, z) => [x, 0, z + .008] }); }

  // the signature: a black eclipse disc for a face, with a bright crescent of corona on its upper right
  const VA = .94, VB = .56, VC = .03;
  const vp = (rho, th, off) => { const lon = rho * VA * Math.cos(th), lat = VC + rho * VB * Math.sin(th), b = .017 * (1 - rho * rho) ** .8; return helmetPoint(lon, lat, off + b + .002); };
  m.grid(m.seg(26, 12), m.seg(5, 2), (u, v) => vp(1 - v, u * TAU, 0), { wrapU: true, slot: S.VISOR, skin: H, crease: 180, out: outH });
  m.tube(Array.from({ length: 25 }, (_, i) => vp(1, i / 24 * TAU, .0005)), .0052, { slot: S.PLATE2, skin: H, sides: m.keep(0) ? 4 : 3, n: m.seg(26, 12), up: [0, 0, -1], tension: .5 });
  { const n = m.seg(22, 8), V = [], F = [], th0 = -1.25, th1 = 1.02;       // crescent: fine at its tips, widest at its middle
    for (let i = 0; i <= n; i++) { const k = i / n, th = lerp(th0, th1, k), w = .016 + .15 * Math.sin(k * Math.PI) ** 1.5; for (const q of [0, 1]) V.push(vp(.982 - w * q, th, .0016)); }
    for (let i = 0; i < n; i++) { const a = i * 2; F.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    m.surf(V, F, { slot: S.GLOW, skin: H, crease: 180, out: outH }); }

  // heavy brow that cuts the top of the disc in a shallow V, and jaw guards that close its lower corners
  const browLow = w => .235 + .115 * sstep(0, .46, Math.abs(w)) + .01 * w * w, browTop = w => .82 - .2 * w * w;
  m.grid(m.seg(26, 10), m.seg(4, 2), (u, v) => { const w = u * 2 - 1, lat = lerp(browLow(w), browTop(w), v), edge = Math.min(1, Math.min(v, 1 - v) * 7) ** .6, tip = Math.min(1, (1 - Math.abs(w)) * 6) ** .6; return helmetPoint(w * 1.16, lat, .0015 + .0072 * edge * tip + .0015 * Math.sin(v * Math.PI)); }, { slot: S.PLATE2, skin: H, crease: 50, out: outH });
  if (m.keep(1)) m.tube(Array.from({ length: 11 }, (_, i) => { const w = (i / 5 - 1) * .6; return helmetPoint(w * 1.16, browLow(w) + .012, .0078); }), .0016, { slot: S.ACCENT, skin: H, sides: 3, n: m.seg(14, 6), up: [0, 0, -1] });
  for (const s of [-1, 1]) m.plate([[.62, -.66], [1.5, -.72], [1.76, -.42], [1.62, -.1], [1.2, -.13], [.98, -.36]], (u, v, h) => helmetPoint(s * u, v, h + .0062), { t: .007, bevel: .003, slot: S.PLATE2, skin: H, crease: 44, out: outH });

  // the same disc-and-crescent, small, on the crest
  if (m.keep(1)) {
    const brow = (u, v, h) => helmetPoint(u / .13, 1.06 + v / .126, h + .0072);
    m.crescentDecal(brow, .017, .014, .0072, 2.2, { t: .0014, slot: S.ACCENT, skin: H, n: 12, out: outH });
  }
  // side rail and a small sensor, right side only
  if (m.keep(0)) {
    m.box([0, 0, 0], [.01, .01, .088], .003, { slot: S.METAL, skin: H, m: T(.104, 1.748, -.02, -.22, 0, -.66) });
    m.box([0, 0, 0], [.026, .018, .04], .005, { slot: S.PLATE2, skin: H, m: T(.112, 1.75, -.07, -.3, .35, -.7) });
    m.ell([0, 0, 0], [.0062, .0062, .003], { slot: S.GLOW, skin: H, nu: 6, nv: 3, m: T(.106, 1.747, -.092, -.3, .35, -.7) });
  }
}

// ---------------------------------------------------------------- respirator
function mask(m) {
  const H = B.HEA;
  // snout stepping out from the face toward the valve
  const nS = m.seg(16, 8), rows = [[-.05, .07, .066, 1.622], [-.092, .066, .058, 1.612], [-.122, .05, .046, 1.602], [-.142, .034, .034, 1.594], [-.156, .021, .023, 1.589]];
  const ring = (z, rx, ry, cy) => Array.from({ length: nS }, (_, i) => { const a = i / nS * TAU, c = Math.cos(a), sn = Math.sin(a), e = Math.abs(sn) ** .78 * Math.sign(sn); return [rx * Math.abs(c) ** .78 * Math.sign(c), cy + ry * e - (sn < 0 ? ry * .12 : 0), z]; });
  m.loft(rows.map(r => ring(r[0], r[1], r[2], r[3])), { slot: S.RUBBER, skin: H, crease: 36, capB: true, out: [0, 1.61, -.06] });
  m.ell([0, 1.578, -.056], [.066, .03, .056], { slot: S.RUBBER, skin: H, nu: 12, nv: 6 });        // chin cup
  for (const s of [-1, 1]) {
    if (m.keep(1)) { m.tube([[s * .034, 1.652, -.138], [s * .072, 1.644, -.112], [s * .1, 1.635, -.058], [s * .116, 1.63, -.006]], .0052, { slot: S.CLOTH2, skin: H, sides: 4, n: m.seg(7, 3) });
      m.tube([[s * .036, 1.552, -.078], [s * .08, 1.562, -.052], [s * .11, 1.6, -.01]], .004, { slot: S.CLOTH2, skin: H, sides: 4, n: m.seg(5, 3) }); }
    // canted octagonal filter: its axis looks forward, outward and a little down
    const f = T(s * .074, 1.585, -.128, -.28, -s * .86, 0), fm = f.clone().multiply(T(0, 0, 0, -Math.PI / 2, 0, 0));
    m.revolve([[.02, -.024], [.03, -.024], [.0375, -.016], [.0395, -.004], [.0395, .006], [.035, .0135], [.028, .0165]], { sides: 8, phase: Math.PI / 8, slot: S.ACCENT, skin: H, m: fm, crease: 30 });
    m.revolve([[.002, .021], [.0245, .021], [.028, .0165]], { sides: 8, phase: Math.PI / 8, slot: S.PLATE2, skin: H, m: fm, crease: 42 });
    if (m.keep(0)) { for (let i = -2; i <= 2; i++) m.box([i * .0088, .0225, 0], [.0044, .003, .036 - Math.abs(i) * .007], .001, { slot: S.METAL, skin: H, m: fm }); }
    if (m.keep(1)) m.revolve([[.0405, .0012], [.0405, -.0052]], { sides: 8, phase: Math.PI / 8, slot: S.RUBBER, skin: H, m: fm, crease: 40 });
    m.revolve([[.022, -.022], [.024, -.03], [.021, -.046]], { sides: 8, slot: S.METAL, skin: H, m: fm, crease: 40 });
  }
  // central exhale valve: stacked hexagon with slats
  const vm = T(0, 1.59, -.156, -Math.PI / 2 + .1, 0, 0);
  m.revolve([[.002, .011], [.015, .011], [.021, .006], [.021, -.01], [.018, -.016]], { sides: 6, slot: S.PLATE2, skin: H, m: vm, crease: 30 });
  if (m.keep(1)) for (let i = -1; i <= 1; i++) m.box([0, .0125, i * .0095], [.022 - Math.abs(i) * .005, .0024, .0042], .001, { slot: i === 0 ? S.ACCENT : S.METAL, skin: H, m: vm });
}

// ---------------------------------------------------------------- neck wrap, hoses
function neckWrap(m) {
  const n = m.seg(20, 9), lay = (y0, y1, r0, r1, phase, slot, ampl) => {
    const rows = m.seg(4, 2), rings = [];
    for (let j = 0; j <= rows; j++) { const v = j / rows, y = lerp(y0, y1, v), r = lerp(r0, r1, sstep(0, 1, v)) + ampl * .4 * Math.sin(v * Math.PI), ring = [];
      for (let i = 0; i < n; i++) { const a = i / n * TAU, w = 1 + ampl * (Math.sin(a * 3 + phase + v * 2) * .45 + Math.sin(a * 5 - phase * 2 + v * 3) * .3) * (m.lod === 2 ? .3 : 1), dy = ampl * .22 * Math.sin(a * 2 + phase) * Math.sin(v * Math.PI); ring.push([r * w * Math.sin(a), y + dy, .012 - r * .92 * w * Math.cos(a) + .012 * (1 - v)]); } rings.push(ring); }
    m.loft(rings, { slot, skin: (x, y) => y > 1.56 ? blend2(B.NEC, B.HEA, y, 1.585, .018) : blend2(B.CHE, B.NEC, y, 1.515, .035), crease: 180, out: (x, y, z) => [x, 0, z - .012], ao: (x, y) => .62 + .38 * sstep(1.44, 1.53, y) });
  };
  lay(1.425, 1.53, .165, .097, .4, S.CLOTH2, .05);
  lay(1.495, 1.585, .115, .083, 2.1, S.CLOTH, .045);
}
function hoses(m) {
  for (const s of [-1, 1]) {
    const f = [s * .112, 1.56, -.078], p = [[s * .1, 1.57, -.09], [s * .135, 1.525, -.075], [s * .165, 1.5, -.012], [s * .15, 1.51, .08], [s * .095, 1.47, .165], [s * .07, 1.435, .212]];
    void f; buildHose(m, p, .0152, B.HEA, B.CHE, { ribs: 7, ribDepth: .24, sides: 6, t0: .12, t1: .46 });
    if (m.keep(1)) m.revolve([[.0205, .009], [.0215, 0], [.0205, -.009]], { sides: 8, slot: S.METAL, skin: B.HEA, m: T(s * .104, 1.566, -.09, .7, 0, s * .6), crease: 50 });
    if (m.keep(0)) { // thin data cable alongside, in the accent colour
      m.tube([[s * .118, 1.545, -.07], [s * .155, 1.5, -.05], [s * .185, 1.47, .02], [s * .165, 1.455, .1], [s * .1, 1.43, .19]], .0035, { slot: S.ACCENT, skin: (x, y) => y > 1.5 ? [B.HEA, .4, B.CHE, .6] : [B.CHE, 1], sides: 4, n: 9 });
    }
  }
}

// ---------------------------------------------------------------- carrier, belt, pads
const CH = B.CHE, chest = wrapMap(.186, .128, .0, -1, -.1, 1.3), back = wrapMap(.186, .128, .0, 1, .04, 1.3);
function carrier(m) {
  // front plate, then a smaller upper plate with the insignia
  m.plate([[-.15, 1.148], [.15, 1.148], [.172, 1.21], [.158, 1.345], [.098, 1.425], [.052, 1.438], [-.052, 1.438], [-.098, 1.425], [-.158, 1.345], [-.172, 1.21]], chest, { t: .017, bevel: .007, slot: S.PLATE, skin: CH, inner: 3, dome: .006 });
  const c2 = (u, v, h) => chest(u, v, h + .0175);
  m.plate([[-.118, 1.27], [.118, 1.27], [.136, 1.325], [.088, 1.402], [.046, 1.416], [-.046, 1.416], [-.088, 1.402], [-.136, 1.325]], c2, { t: .007, bevel: .003, slot: S.PLATE2, skin: CH, inner: 2 });
  if (m.keep(1)) {
    // chevron cuts and an insignia in the middle of the plate
    for (const k of [-1, 1]) {
      m.plate([[k * .128, 1.272], [k * .138, 1.272], [k * .15, 1.33], [k * .103, 1.402], [k * .095, 1.396], [k * .138, 1.33]], (u, v, h) => chest(u, v, h + .0175), { t: .0032, bevel: .0012, slot: S.ACCENT, skin: CH, inner: 1, round: 0 });
    }
    const em = (u, v, h) => chest(u, 1.345 + v, h + .0245);
    m.crescentDecal(em, .034, .0282, .0142, 2.2, { t: .0022, slot: S.ACCENT, skin: CH, n: 14 });
      }
  // back plate
  m.plate([[-.145, 1.15], [.145, 1.15], [.165, 1.25], [.15, 1.36], [.08, 1.43], [-.08, 1.43], [-.15, 1.36], [-.165, 1.25]], back, { t: .015, bevel: .006, slot: S.PLATE, skin: CH, inner: 3, dome: .004 });
  // shoulder straps: over the collarbone, front to back
  for (const s of [-1, 1]) {
    m.tube([[s * .092, 1.41, -.128], [s * .112, 1.462, -.086], [s * .123, 1.486, -.01], [s * .118, 1.466, .074], [s * .1, 1.415, .128]], .0125, { slot: S.CLOTH2, skin: CH, sides: 6, flat: .4, n: m.seg(12, 4), up: [0, 1, 0] });
    if (m.keep(1)) m.box([s * .103, 1.438, -.113], [.03, .022, .012], .004, { slot: S.ACCENT, skin: CH, m: null });
  }
  // cummerbund
  const nC = m.seg(26, 10);
  m.grid(nC, 2, (u, v) => { const a = u * TAU, y = lerp(1.135, 1.235, v), bow = 1 + .018 * Math.sin(v * Math.PI); return [.178 * bow * Math.sin(a), y, -.126 * bow * Math.cos(a)]; }, { wrapU: true, slot: S.CLOTH2, skin: (x, y) => blend2(B.SPI, B.CHE, y, 1.2, .05), crease: 180, out: (x, y, z) => [x, 0, z], ao: .86 });
  // triple magazine shingle, right-side radio pouch, left-side utility pouch
  for (let i = -1; i <= 1; i++) {
    const a = i * .082 / .157, cx = Math.sin(a) * .187, cz = -Math.cos(a) * .135 - .014;
    buildPouch(m, .07, .105, .04, T(cx, 1.174, cz, 0, Math.PI - a, 0), { slot: S.CLOTH2, slotFlap: S.PLATE, skin: CH, slotTab: i === 0 ? S.ACCENT : S.METAL });
  }
  buildPouch(m, .05, .094, .036, T(.178, 1.188, -.058, 0, Math.PI - 1.15, 0), { slot: S.CLOTH2, slotFlap: S.PLATE2, skin: CH });
  buildPouch(m, .06, .07, .034, T(-.183, 1.2, -.042, 0, Math.PI + 1.2, 0), { slot: S.CLOTH2, slotFlap: S.PLATE2, skin: CH, tab: false });
  if (m.keep(0)) {
    m.tube([[.195, 1.235, -.06], [.205, 1.3, -.055], [.2, 1.38, -.05]], .0042, { slot: S.RUBBER, skin: CH, sides: 4, n: 4 });    // radio whip tucked along the side
    m.box([.181, 1.225, -.056], [.024, .014, .012], .003, { slot: S.GLOW, skin: CH, m: T(0, 0, 0) });
  }
}
function belt(m) {
  const n = m.seg(26, 10), P2 = B.PEL;
  // thick belt with rounded edges, a little sag at the front, loops, a frame buckle and the tail tucked under a loop
  beltRing(m, 1.006, .178, .136, { w: .046, t: .006, sag: .006, cz: .004, slot: S.RUBBER, slotKeeper: S.RUBBER, slotBuckle: S.METAL, skin: P2, keepers: [-1.32, -.36, .36, 1.32, Math.PI], n: n + 6 });
  for (const a of [-.74, .74]) buildPouch(m, .054, .066, .03, T(Math.sin(a) * .197, .958, .004 - Math.cos(a) * .154, 0, Math.PI - a, 0), { slot: S.CLOTH2, slotFlap: S.PLATE2, skin: P2, slotTab: a < 0 ? S.ACCENT : S.METAL });
  // hip pouch, leg holster with its thigh strap
  buildPouch(m, .058, .082, .038, T(-.178, .968, .044, 0, Math.PI + 1.75, 0), { slot: S.CLOTH2, slotFlap: S.PLATE2, skin: P2 });
  buildPouch(m, .05, .07, .034, T(.145, .97, .098, 0, .95, 0), { slot: S.CLOTH2, slotFlap: S.PLATE2, skin: P2, tab: false });
  { const TH = B.THR;
    m.plate([[-.036, .71], [.036, .71], [.044, .8], [.036, .9], [-.036, .9], [-.044, .8]], (u, v, h) => [.1 + .098 + h, v, u + .01], { t: .018, bevel: .006, slot: S.PLATE2, skin: TH, out: () => [1, 0, 0] });
    if (m.keep(1)) m.box([.2, .842, .01], [.02, .014, .052], .003, { slot: S.ACCENT, skin: TH });
    for (const y of [.74, .86]) m.revolve([[.098, .009], [.102, .005], [.102, -.005], [.098, -.009]], { sides: m.keep(1) ? 16 : 8, slot: S.CLOTH2, skin: TH, m: T(.1, y, .004) });
  }
}
function pads(m) {
  for (const s of [-1, 1]) {
    const U = s < 0 ? B.UAL : B.UAR, F = s < 0 ? B.FAL : B.FAR, SH = s < 0 ? B.SHL : B.SHR, TH = s < 0 ? B.THL : B.THR, x = s * .2;
    // shoulder: three overlapping lames over the deltoid
    const cap = (u, v, h) => { const R = .083 + h, c = Math.cos(v), flat = 1 - .1 * sstep(.4, 1, v); return [x + s * (R * flat * Math.cos(u) * c + .002), 1.428 + R * Math.sin(v) * .98, R * 1.06 * Math.sin(u) * c]; };
    m.plate([[-1.02, .28], [1.02, .28], [.95, .86], [.36, 1.08], [-.36, 1.08], [-.95, .86]], cap, { t: .0075, bevel: .003, slot: S.PLATE, skin: U, crease: 58, out: () => [s, .5, 0] });
    m.plate([[-1.12, -.14], [1.12, -.14], [1.08, .33], [-1.08, .33]], (u, v, h) => cap(u, v, h - .001), { t: .0065, bevel: .0028, slot: S.PLATE2, skin: U, crease: 58, out: () => [s, 0, 0] });
    m.plate([[-1.14, -.58], [1.14, -.58], [1.14, -.1], [-1.14, -.1]], (u, v, h) => cap(u, v, h - .003), { t: .006, bevel: .0026, slot: S.PLATE, skin: U, crease: 58, out: () => [s, -.2, 0] });
    if (m.keep(1)) m.plate([[-.5, .02], [.5, .02], [.5, .075], [-.5, .075]], (u, v, h) => cap(u, v, h + .0055), { t: .0012, bevel: .0008, slot: S.ACCENT, skin: U, inner: 1, round: 0, out: () => [s, 0, 0] });
    // team band on the sleeve: reads friend or foe with any colourway
    m.revolve([[.0675, .0105], [.0705, .0075], [.0705, -.0075], [.0675, -.0105]], { sides: m.keep(1) ? 16 : 8, slot: S.TEAM, skin: U, m: T(x, 1.235, 0), crease: 50 });
    // elbow cup
    if (m.keep(1)) { const el = (u, v, h) => { const R = .067 + h; return [x + s * R * Math.sin(u) * .95, v, R * Math.cos(u)]; }; m.plate([[-.9, 1.1], [.9, 1.1], [1.05, 1.17], [.7, 1.215], [-.7, 1.215], [-1.05, 1.17]], el, { t: .007, bevel: .003, slot: S.PLATE, skin: F, out: () => [0, 0, 1] }); }
    // forearm: a slim vambrace on the outside, with a lit stripe on the right wrist computer
    const fr = (u, v, h) => { const R = .06 + h; return [x + s * R * Math.cos(u), v, R * Math.sin(u)]; };
    m.plate([[-.8, .925], [.8, .925], [.9, 1.0], [.62, 1.082], [-.62, 1.082], [-.9, 1.0]], fr, { t: .006, bevel: .003, slot: S.PLATE2, skin: F, out: () => [s, 0, 0] });
    if (m.keep(1) && s > 0) m.box([x + .059, .985, 0], [.006, .048, .022], .002, { slot: S.GLOW, skin: F });
    // knee pad and a shin guard
    const kn = (u, v, h) => { const R = .079 + h; return [s * .1 + R * Math.sin(u), v, -R * Math.cos(u)]; };
    m.plate([[-.58, .462], [.58, .462], [.8, .505], [.66, .56], [.26, .586], [-.26, .586], [-.66, .56], [-.8, .505]], (u, v, h) => kn(u, v, h + .006 * Math.sin(Math.min(1, Math.max(0, (v - .455) / .135)) * Math.PI)), { t: .011, bevel: .005, slot: S.PLATE, skin: (px, py) => blend2(SH, TH, py, .52, .03), inner: 3, dome: .007, crease: 60, out: () => [0, 0, -1] });
    if (m.keep(1)) m.plate([[-.16, .528], [.16, .528], [.2, .545], [0, .566], [-.2, .545]], (u, v, h) => kn(u, v, h + .0145), { t: .0022, bevel: .0012, slot: S.ACCENT, skin: SH, inner: 1, round: 0, out: () => [0, 0, -1] });
    if (m.keep(1)) { const sh = (u, v, h) => { const R = .08 + h; return [s * .1 + R * Math.sin(u), v, -R * Math.cos(u)]; }; m.plate([[-.5, .24], [.5, .24], [.68, .34], [.56, .435], [-.56, .435], [-.68, .34]], sh, { t: .006, bevel: .003, slot: S.PLATE, skin: SH, out: () => [0, 0, -1] }); }
  }
}

// ---------------------------------------------------------------- back unit, antenna
function backUnit(m) {
  const mp = planeMap([0, 1.3, .276], [-1, 0, 0], [0, 1, 0], -1);       // +h = toward the back (+Z)
  // body: a compact hexagonal pack with a chamfered edge
  const hex = [[-.095, -.14], [.095, -.14], [.128, -.06], [.122, .09], [.07, .15], [-.07, .15], [-.122, .09], [-.128, -.06]];
  m.plate(hex, (u, v, h) => { const p = mp(u, v, h - .068); return [p[0], p[1], p[2] - .012 * (v / .15) * (h > .03 ? 1 : .4)]; }, { t: .068, bevel: .012, slot: S.PLATE, skin: CH, inner: 2, dome: .004, crease: 30 });
  const top = (u, v, h) => { const p = mp(u, v, h + .004); return [p[0], p[1], p[2] - .012 * (v / .15)]; };
  m.plate([[-.076, -.102], [.076, -.102], [.098, -.05], [.094, .07], [.056, .116], [-.056, .116], [-.094, .07], [-.098, -.05]], top, { t: .006, bevel: .0025, slot: S.PLATE2, skin: CH, inner: 2 });
  if (m.keep(1)) {
    // eclipse disc on the pack, then a lit status slit
    const em = (u, v, h) => top(u, v + .022, h + .0065);
    m.crescentDecal(em, .044, .0366, .0184, 2.2, { t: .0022, slot: S.ACCENT, skin: CH, n: 14 });
    m.plate([[-.05, -.078], [.05, -.078], [.05, -.068], [-.05, -.068]], (u, v, h) => top(u, v, h + .0065), { t: .0015, bevel: .0006, slot: S.GLOW, skin: CH, inner: 1, round: 0 });
  }
  // two side canisters, fed by the hoses
  for (const s of [-1, 1]) {
    const c = T(s * .128, 1.285, .238);
    m.revolve([[.002, .082], [.022, .082], [.03, .074], [.03, -.07], [.022, -.082], [.002, -.082]], { sides: m.keep(1) ? 10 : 6, slot: S.PLATE2, skin: CH, m: c, crease: 40 });
    if (m.keep(1)) for (const y of [.052, -.048]) m.revolve([[.0315, .007], [.0315, -.007]], { sides: 10, slot: S.ACCENT, skin: CH, m: c.clone().multiply(T(0, y, 0)), crease: 60 });
  }
  // hose collars at the top of the pack
  if (m.keep(1)) for (const s of [-1, 1]) m.revolve([[.022, .012], [.024, 0], [.022, -.014]], { sides: 8, slot: S.METAL, skin: CH, m: T(s * .07, 1.435, .214, -.5, 0, 0), crease: 45 });
  // antenna: base, thin whip with a slight lean, kept below the top of a raised hitbox
  m.revolve([[.002, .03], [.009, .03], [.011, .012], [.014, 0], [.014, -.02]], { sides: 6, slot: S.METAL, skin: CH, m: T(.09, 1.468, .25) });
  m.tube([[.09, 1.49, .25], [.093, 1.66, .257], [.101, 1.8, .268], [.112, 1.915, .282]], t => lerp(.0042, .0016, t), { slot: S.RUBBER, skin: CH, sides: m.keep(1) ? 5 : 3, n: m.seg(8, 3) });
  if (m.keep(1)) { m.revolve([[.0055, .012], [.0055, -.012]], { sides: 6, slot: S.ACCENT, skin: CH, m: T(.0935, 1.7, .26, .05, 0, -.03) }); m.ell([.1125, 1.918, .283], [.0042, .0042, .0042], { slot: S.GLOW, skin: CH, nu: 6, nv: 3 }); }
}

// ---------------------------------------------------------------- mantle (cloak)
// 7 columns around the back, 3 free rows: 21 small bones. Hangs behind the arms, ends above the knee, never in front of the legs.
const CLOAK_COLS = 7, CLOAK_ROWS = 3;
const cloakPoint = (col, row) => {      // col in [0,6], row in [0,3]
  const t = col / (CLOAK_COLS - 1), phi = lerp(-1.82, 1.82, t), w = row / CLOAK_ROWS, ease = Math.sin(w * Math.PI / 2);
  const rx = lerp(.262, .3, ease), rz = lerp(.15, .228, ease ** 1.7), y0 = 1.482 - .082 * Math.abs(Math.sin(phi)) ** 2.2, hem = lerp(.83, .6, t) - .05 * Math.cos(phi);
  const y = lerp(y0, hem, w);
  return [rx * Math.sin(phi), y, rz * Math.cos(phi) + .03 + .02 * w];
};
const CLOAK_NODES = Array.from({ length: CLOAK_ROWS + 1 }, (_, r) => Array.from({ length: CLOAK_COLS }, (_, c) => cloakPoint(c, r)));
const CLOAK_DEF = makeClothDef(CLOAK_NODES);

function cloak(m) {
  const nu = m.seg(30, 12), nv = m.seg(10, 5), fold = m.lod === 2 ? .35 : 1;
  const pleatAt = (u, v) => v ** .85 * (1 - .75 * Math.exp(-(((u - .5) / .14) ** 2)) * (1 - sstep(.28, .5, v))) * fold * (.036 * Math.sin(u * 27 + 1.1 * Math.sin(v * 2.4)) + (m.lod === 0 ? .01 * Math.sin(u * 46 + 2.1 + v * 1.7) : 0)) + .004 * sstep(.95, 1, v);
  const point = (u, v, off) => {
    const col = u * (CLOAK_COLS - 1), row = v * CLOAK_ROWS, p = cloakPoint(col, row), pl = pleatAt(u, v);
    const nx = Math.sin(lerp(-1.82, 1.82, u)), nz = Math.cos(lerp(-1.82, 1.82, u)) * .85, l = Math.hypot(nx, nz) || 1, ragged = 0;
    return { p: [p[0] + nx / l * (pl + off), p[1] + ragged, p[2] + nz / l * (pl + off)], col, row, f: pl / (.046 * Math.max(v ** .85, .05)) };
  };
  const key = (x, y, z) => Math.round(x * 2e3) + '_' + Math.round(y * 2e3) + '_' + Math.round(z * 2e3);
  const build = (off, sign) => {
    const V = [], F = [], nd = new Map(), cols = nu + 1;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const q = point(i / nu, j / nv, off); V.push(q.p); nd.set(key(q.p[0], q.p[1], q.p[2]), [q.col, q.row, q.f]); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = i + j * cols, b = a + 1, c = a + cols, d = c + 1; F.push(a, b, c, b, d, c); }
    m.surf(V, F, { slot: S.CLOTH, crease: 180, ao: (x, y, z) => { const c = nd.get(key(x, y, z)); return sign > 0 ? (.78 + .22 * sstep(.7, 1.2, y)) * (c ? .6 + .4 * clamp(c[2] * .5 + .5, 0, 1) : 1) : .42; },
      skin: (x, y, z) => { const c = nd.get(key(x, y, z)); return c ? clothSkin(CLOAK_DEF, c[0], c[1]) : [B.CHE, 1]; },
      out: (x, y, z) => [sign * x, 0, sign * (z - .03)] });
  };
  build(.0035, 1); if (m.keep(1)) build(-.0035, -1);
  // mantle yoke: the rigid part laid on the shoulders, tucked under the neck wrap
  const nY = m.seg(26, 12), rows = m.seg(4, 2), yoke = (u, v) => { const phi = lerp(-1.82, 1.82, u), w = v, sw = Math.sin(w * Math.PI / 2), rx = lerp(.12, .268, sw), rz = lerp(.1, .16, sw), y = lerp(1.545, 1.478 - .082 * Math.abs(Math.sin(phi)) ** 2.2, w ** 1.5) + .012 * Math.sin(w * Math.PI), fz = .004 * Math.sin(phi * 9 + w * 2) * (m.lod === 2 ? 0 : 1); return [(rx + fz) * Math.sin(phi), y, (rz + fz) * Math.cos(phi) + lerp(.012, .032, w)]; };
  m.grid(nY, rows, yoke, { slot: S.CLOTH, skin: CH, crease: 180, out: (x, y, z) => [x * .6, .8, (z - .03) * .6], ao: (x, y) => .72 + .28 * sstep(1.46, 1.52, y) });
  if (m.keep(1)) m.grid(nY, 1, (u, v) => { const a = yoke(u, 1), phi = lerp(-1.82, 1.82, u); return [a[0] + Math.sin(phi) * .001 * v, a[1] - .005 * v, a[2] + Math.cos(phi) * .001 * v]; }, { slot: S.CLOTH2, skin: CH, crease: 180, out: (x, y, z) => [x, 0, z] });
  // a stitched accent hem low on the mantle, off-centre
  if (m.keep(0)) m.tube(Array.from({ length: 13 }, (_, i) => { const u = .12 + i / 12 * .72, q = point(u, .965, .006); return q.p; }), .0028, { slot: S.ACCENT, stitch: 1, sides: 3, n: 34, skin: (x, y, z) => clothSkin(CLOAK_DEF, clamp(Math.atan2(x, z - .03) / 1.82 * 3 + 3, 0, 6), 3 * .965), crease: 60 });
}

// ---------------------------------------------------------------- coat skirt
// Two panels hung from the belt, open at the front; they follow the thighs so a stride never pushes a leg through them.
function coatSkirt(m) {
  for (const s of [-1, 1]) {
    const TH = s < 0 ? B.THL : B.THR, nu = m.seg(14, 6), nv = m.seg(6, 3);
    const pt = (u, v, off) => { const a = lerp(.3, 2.2, u), w = 1 + .05 * Math.sin(u * 17 + v * 1.4) * v * (m.lod === 2 ? .3 : 1), rx = lerp(.172, .228, v) * w + off, rz = lerp(.136, .176, v) * w + off, hem = lerp(.735, .7, u) - .012 * Math.sin(u * 13), y = lerp(1.0, hem, v); return [s * rx * Math.sin(a), y, .004 - rz * Math.cos(a)]; };
    const skin = (x, y) => { const k = sstep(.97, .78, y) * .68; return k < .01 ? [B.PEL, 1] : [B.PEL, 1 - k, TH, k]; };
    m.grid(nu, nv, (u, v) => pt(u, v, .002), { slot: S.CLOTH, skin, crease: 180, out: (x, y, z) => [x, 0, z], ao: (x, y) => .74 + .26 * sstep(.74, .92, y) });
    if (m.keep(1)) m.grid(nu, nv, (u, v) => pt(u, v, -.002), { slot: S.CLOTH2, skin, crease: 180, out: (x, y, z) => [-x, 0, -z], ao: .5 });
  }
  // cargo pocket on the left thigh
  buildPouch(m, .085, .1, .036, T(-.196, .68, .01, 0, -Math.PI / 2, 0), { slot: S.CLOTH2, slotFlap: S.CLOTH, skin: B.THL, tab: false });
}

// ---------------------------------------------------------------- close-range detail (one extra mesh, only within a few metres, never in the shadow pass)
function helmetDetail(m) {
  const H = B.HEA, vp = (rho, th, off) => helmetPoint(rho * .94 * Math.cos(th), .03 + rho * .56 * Math.sin(th), off + .002);
  m.tube(Array.from({ length: 33 }, (_, i) => vp(1.03, i / 32 * TAU, .0014)), .0021, { slot: S.RUBBER, skin: H, sides: 3, n: 30, up: [0, 0, -1], cap: false });      // visor seal
  for (let i = 0; i < 10; i++) { const th = (i + .5) / 10 * TAU; if (Math.sin(th) > .62) continue; const p = vp(1.075, th, .0022), q = vp(1.075, th, .012); screw(m, p, [q[0] - p[0], q[1] - p[1], q[2] - p[2]], { r: .0027, skin: H }); }
  for (const s of [-1, 1]) {
    const [p, n] = mapAt(helmetPoint, s * 1.62, .34, .0052); railMount(m, faceTo(p, n, [0, 0, 1]), .082, { skin: H, teeth: 6 });     // accessory rail
    for (const a of [-.034, .034]) { const q = [p[0], p[1], p[2] + a]; screw(m, [q[0] + n[0] * .86, q[1] + n[1] * .86, q[2] + n[2] * .86].map((v, i) => v + n[i] * -.8), n, { r: .0022, skin: H }); }
    for (let k = 0; k < 3; k++) { const lat = .47 - k * .085; m.plate([[-.13, -.014], [.13, -.014], [.13, .014], [-.13, .014]], (u, v, h) => helmetPoint(s * (2.34 + u), lat + v, h + .0062), { t: .0011, bevel: .0005, slot: S.RUBBER, skin: H, inner: 1, round: 0, out: outH }); }      // vents
    for (const [l, a] of [[1.2, .36], [1.72, .7], [2.32, .57], [2.22, .03], [1.66, .13], [2.5, -.41], [1.66, -.42]]) { const [q, d] = mapAt(helmetPoint, s * l, a, .0062); screw(m, q, d, { r: .0026, skin: H }); }
    m.tube(Array.from({ length: 8 }, (_, i) => helmetPoint(s * (1.26 + i * .2), .205 - .035 * Math.sin(i * .5), .0014)), .0011, { slot: S.RUBBER, skin: H, sides: 3, n: 10, cap: false });       // panel line
    m.tube(Array.from({ length: 6 }, (_, i) => helmetPoint(s * .78, .84 + i * .11, .0012)), .001, { slot: S.RUBBER, skin: H, sides: 3, n: 7, cap: false });
    buckleAt(m, [s * .094, 1.566, -.05], [s, -.35, -.5], { w: .016, d: .012, t: .0024, skin: H });       // chin strap
  }
  for (const a of [-.46, 0, .46]) { const [q, d] = mapAt(helmetPoint, a, a === 0 ? .67 : .62, .0125); screw(m, q, d, { r: .0026, skin: H }); }
  // ear cup on the left with a microphone boom passing under the filter
  m.revolve([[.008, .006], [.0105, .002], [.0105, -.006]], { sides: 8, slot: S.METAL, skin: H, m: T(-.166, 1.664, .014, 0, 0, Math.PI / 2) });
  m.tube([[-.158, 1.652, .004], [-.16, 1.6, -.05], [-.134, 1.538, -.112], [-.078, 1.522, -.152], [-.034, 1.534, -.168]], .0024, { slot: S.RUBBER, skin: H, sides: 4, n: 14 });
  m.ell([-.028, 1.536, -.17], [.0105, .0085, .012], { slot: S.CLOTH2, skin: H, nu: 8, nv: 5 });
}
function torsoDetail(m) {
  const front = (u, v, h) => chest(u, v, h), edge = [[-.142, 1.158], [0, 1.156], [.142, 1.158], [.163, 1.212], [.149, 1.342], [.093, 1.416], [.05, 1.428], [-.05, 1.428], [-.093, 1.416], [-.149, 1.342], [-.163, 1.212], [-.142, 1.158]];
  stitchLine(m, edge.map(p => front(p[0], p[1], .0182)), { skin: CH, n: 30, slot: S.CLOTH2 });
  for (const v of [1.256, 1.237]) webbingRow(m, front, -.142, .142, v, { skin: CH, h: .0186, pitch: .024 });
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, p = [[-.13, 1.31], [-.086, 1.39], [-.04, 1.405], [.04, 1.405], [.086, 1.39], [.13, 1.31], [.12, 1.282], [-.12, 1.282]][k]; const [q, d] = mapAt(front, p[0], p[1], .0255); screw(m, q, d, { r: .0026, skin: CH }); void a; }
  // zipped admin pocket on the upper plate
  stitchLine(m, Array.from({ length: 6 }, (_, i) => front(-.078, 1.296 + i * .018, .0258)), { skin: CH, r: .0016, n: 12, slot: S.METAL });
  { const [q, d] = mapAt(front, -.078, 1.392, .0266); m.box([0, .001, .006], [.005, .003, .014], .001, { slot: S.ACCENT, skin: CH, m: faceTo(q, d, [0, 1, 0]) }); }
  // side cummerbund webbing
  const side = (u, v, h) => [(.181 + h) * Math.sin(u), v, -(.129 + h) * Math.cos(u)];
  for (const sg of [-1, 1]) for (const v of [1.166, 1.2]) webbingRow(m, side, sg * 1.5, sg * 2.3, v, { skin: CH, h: .002, pitch: .08, tack: .03 });
  // magazines standing in their pouches
  for (let i = -1; i <= 1; i++) {
    const a = i * .082 / .157, cx = Math.sin(a) * .187, cz = -Math.cos(a) * .135 - .018, M = T(cx, 1.238, cz, .05, -a, 0);
    m.box([0, 0, 0], [.05, .036, .022], .003, { slot: S.METAL, skin: CH, m: M }); m.box([0, .0205, 0], [.054, .006, .026], .002, { slot: S.RUBBER, skin: CH, m: M });
    for (const q of [-.014, .014]) m.box([q, .004, -.0115], [.004, .022, .002], .0008, { slot: S.RUBBER, skin: CH, m: M });
  }
  // radio: body, knob, stub antenna, and a coiled lead up to the collar
  { const M = T(.183, 1.256, -.062, 0, -1.1, 0); m.box([0, 0, 0], [.036, .05, .024], .004, { slot: S.PLATE2, skin: CH, m: M }); m.box([0, .004, -.0128], [.024, .022, .002], .0008, { slot: S.VISOR, skin: CH, m: M }); m.box([-.006, -.015, -.0128], [.005, .004, .002], .0008, { slot: S.GLOW, skin: CH, m: M });
    m.revolve([[.002, .007], [.0058, .007], [.0058, -.002]], { sides: 8, slot: S.METAL, skin: CH, m: M.clone().multiply(T(.011, .025, 0)) }); m.tube([[.178, 1.28, -.054], [.181, 1.33, -.05]], .0024, { slot: S.RUBBER, skin: CH, sides: 4, n: 2 });
    coilCable(m, [.166, 1.268, -.086], [.112, 1.415, -.135], { skin: CH, turns: 7, R: .0062 }); }
  // buckles, a carabiner on the left strap
  for (const s of [-1, 1]) buckleAt(m, [s * .104, 1.44, -.122], [s * .2, .3, -.93], { skin: CH, w: .028, d: .016 });
  carabiner(m, [-.142, 1.285, -.125], [-.55, 0, -.83], { skin: CH });
  buckleAt(m, [0, 1.185, -.168], [0, 0, -1], { skin: CH, w: .03, d: .018 });
}
function armDetail(m) {
  for (const s of [-1, 1]) {
    const U = s < 0 ? B.UAL : B.UAR, F = s < 0 ? B.FAL : B.FAR, x = s * .2;
    for (const [y, b] of [[1.215, U], [1.108, F]]) m.revolve([[.0635, .006], [.0662, .003], [.0662, -.003], [.0635, -.006]], { sides: 12, slot: S.CLOTH2, skin: b, m: T(x, y, 0), crease: 50 });
    buckleAt(m, [x, 1.108, .0675], [0, 0, 1], { skin: F, w: .016, d: .012, t: .0026 });
    buckleAt(m, [x + s * .086, 1.36, 0], [s, 0, 0], { up: [0, 0, 1], skin: U, w: .016, d: .012, t: .0026 });
    for (const a of [-.62, .62]) screw(m, [x + s * .0915 * Math.cos(a), 1.46, .096 * Math.sin(a)], [s * Math.cos(a), .45, Math.sin(a)], { r: .0026, skin: U });
    for (const y of [.94, 1.06]) for (const a of [-.62, .62]) screw(m, [x + s * .0665 * Math.cos(a), y, .0665 * Math.sin(a)], [s * Math.cos(a), 0, Math.sin(a)], { r: .002, skin: F });
  }
  // wrist device on the left forearm: body, lit screen, three keys
  const x = -.2, F = B.FAL;
  m.box([x - .0655, 1.0, .0], [.01, .066, .04], .003, { slot: S.PLATE2, skin: F }); m.box([x - .0712, 1.006, 0], [.0016, .04, .03], .0006, { slot: S.VISOR, skin: F }); m.box([x - .0722, 1.012, -.006], [.0008, .012, .012], .0003, { slot: S.GLOW, skin: F });
  for (let i = -1; i <= 1; i++) m.box([x - .0712, .976, i * .01], [.0024, .005, .006], .0006, { slot: i ? S.METAL : S.ACCENT, skin: F });
}
function legDetail(m) {
  const P2 = B.PEL, TH = B.THR, TL = B.THL;
  // holster: grip, retention strap, buckles on the leg straps
  m.box([0, 0, 0], [.024, .052, .03], .005, { slot: S.RUBBER, skin: TH, m: T(.205, .915, .018, .22, 0, -.05) });
  m.tube([[.19, .885, -.012], [.222, .9, .0], [.218, .9, .036]], .0048, { slot: S.CLOTH2, skin: TH, sides: 4, n: 5, flat: .4 });
  screw(m, [.2245, .9, .006], [1, .1, 0], { r: .0034, skin: TH });
  for (const y of [.74, .86]) buckleAt(m, [.1, y, -.108], [0, 0, -1], { skin: TH, w: .018, d: .012, t: .0026 });
  stitchLine(m, [[.2165, .72, -.024], [.2165, .8, -.03], [.2165, .885, -.024]], { skin: TH, n: 8 });
  // drop-leg panel on the left thigh, over the cargo pocket
  m.revolve([[.1, .007], [.1035, .004], [.1035, -.004], [.1, -.007]], { sides: 14, slot: S.CLOTH2, skin: TL, m: T(-.1, .615, .004), crease: 50 });
  buckleAt(m, [-.1, .615, -.106], [0, 0, -1], { skin: TL, w: .018, d: .012, t: .0026 });
  for (const z of [-.018, .038]) screw(m, [-.2165, .706, z], [-1, 0, 0], { r: .0036, h: .0014, skin: TL });
  stitchLine(m, [[-.2155, .636, -.032], [-.2155, .69, -.034], [-.2155, .712, -.034]], { skin: TL, n: 5 }); stitchLine(m, [[-.2155, .636, .052], [-.2155, .69, .054], [-.2155, .712, .054]], { skin: TL, n: 5 });
  // belt: stitched edges, a carabiner, keepers
  for (const y of [.9905, 1.0215]) stitchLine(m, Array.from({ length: 21 }, (_, i) => { const a = i / 20 * TAU * .9 + .32; return [.1842 * Math.sin(a), y - .006 * Math.max(0, Math.cos(a)) ** 2, .004 - .1422 * Math.cos(a)]; }), { skin: P2, n: 26 });
  for (const k of [-1, 1]) { m.tube([[k * .078, 1.152, -.142], [k * .092, 1.09, -.128], [k * .104, 1.034, -.146]], .0105, { slot: S.CLOTH2, skin: (x, y) => blend2(B.PEL, B.CHE, y, 1.09, .05), sides: 5, flat: .32, n: 6, up: [0, 0, -1] }); buckleAt(m, [k * .092, 1.09, -.135], [k * .1, 0, -1], { skin: B.SPI, w: .024, d: .014 }); }
  carabiner(m, [-.116, .972, -.117], [-.5, 0, -.86], { skin: P2 });
  // knee pads: straps above and below
  for (const s of [-1, 1]) {
    const SH = s < 0 ? B.SHL : B.SHR, TG = s < 0 ? B.THL : B.THR;
    m.revolve([[.0745, .006], [.0778, .003], [.0778, -.003], [.0745, -.006]], { sides: 12, slot: S.CLOTH2, skin: TG, m: T(s * .1, .612, .002), crease: 50 });
    m.revolve([[.0725, .006], [.0758, .003], [.0758, -.003], [.0725, -.006]], { sides: 12, slot: S.CLOTH2, skin: SH, m: T(s * .1, .448, .002), crease: 50 });
    buckleAt(m, [s * .176, .448, 0], [s, 0, 0], { up: [0, 0, 1], skin: SH, w: .014, d: .012, t: .0024 });
    for (const a of [-.55, .55]) screw(m, [s * .1 + .094 * Math.sin(a), .515, -.094 * Math.cos(a)], [Math.sin(a), 0, -Math.cos(a)], { r: .0026, skin: SH });
  }
}
function backDetail(m) {
  const top = (u, v, h) => { const p = planeMap([0, 1.3, .276], [-1, 0, 0], [0, 1, 0], -1)(u, v, h + .0105); return [p[0], p[1], p[2] - .012 * (v / .15)]; };
  for (const v of [-.052, -.03]) webbingRow(m, top, -.07, .07, v, { skin: CH, pitch: .022, w: .011 });
  for (const [u, v] of [[-.082, -.082], [.082, -.082], [-.078, .09], [.078, .09]]) { const [q, d] = mapAt(top, u, v, .0005); screw(m, q, d, { r: .003, skin: CH }); }
  for (const s of [-1, 1]) { buckleAt(m, [s * .128, 1.285, .27], [0, 0, 1], { skin: CH, w: .022, d: .014 }); m.revolve([[.0322, .006], [.0322, -.006]], { sides: 10, slot: S.CLOTH2, skin: CH, m: T(s * .128, 1.285, .238), crease: 60 }); }
}
function cloakDetail(m) {
  // shoulder clasp holding the mantle, with the set's crescent
  const M = faceTo([-.128, 1.474, -.112], [-.32, .42, -.85], [0, 1, 0]);
  m.revolve([[.002, .006], [.0175, .006], [.021, .003], [.021, -.003]], { sides: 12, slot: S.PLATE2, skin: CH, m: M, crease: 40 });
  m.crescentDecal((u, v, h) => { const e = M.elements, y = h + .0062; return [e[0] * u + e[4] * y + e[8] * v + e[12], e[1] * u + e[5] * y + e[9] * v + e[13], e[2] * u + e[6] * y + e[10] * v + e[14]]; }, .0125, .0102, .0052, 2.2, { t: .0012, slot: S.ACCENT, skin: CH, n: 12 });
  m.tube([[-.12, 1.468, -.122], [-.07, 1.452, -.142], [-.03, 1.435, -.15]], .0022, { slot: S.METAL, skin: CH, sides: 4, n: 5 });
}
const DETAIL_PARTS = [helmetDetail, torsoDetail, armDetail, legDetail, backDetail, cloakDetail,
  m => { for (const s of [-1, 1]) buildGloveDetail(m, s, { slotKnuckle: S.PLATE }); },
  m => { for (const s of [-1, 1]) buildBootDetail(m, s, {}); },
];

// ---------------------------------------------------------------- assembly
const PARTS = [
  m => buildSuit(m, { slot: S.CLOTH, slotLegs: S.CLOTH }),
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slotToe: S.PLATE }); },
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: S.RUBBER, slotKnuckle: S.PLATE }); },
  belt, coatSkirt, pads, carrier, helmet, mask, neckWrap, hoses, backUnit, cloak,
];
/** Triangles per part at each LOD (tooling). */
export function outfitPartStats() { const names = ['suit', 'boots', 'gloves', 'belt', 'skirt', 'pads', 'carrier', 'helmet', 'mask', 'wrap', 'hoses', 'back', 'cloak']; return [0, 1, 2].map(l => { const m = new Mesher(l), o = {}; PARTS.forEach((f, i) => { const t = m.tris; f(m); o[names[i]] = m.tris - t; }); o.total = m.tris; return o; }); }
const asset = { geos: null, detail: null, cloth: CLOAK_DEF, tris: null, detailTris: 0 };
/** Builds the three LOD geometries in small steps. await yieldFn() runs between parts. Safe to call more than once. */
export async function prepareOutfits(yieldFn) {
  if (asset.geos) return asset;
  detailTexture(); if (yieldFn) await yieldFn();
  const geos = [];
  for (let l = 0; l < 3; l++) { const m = new Mesher(l); for (const part of PARTS) { part(m); if (yieldFn) await yieldFn(); } geos.push(m); }
  const dm = new Mesher(0); for (const part of DETAIL_PARTS) { part(dm); if (yieldFn) await yieldFn(); }
  if (asset.geos) return asset;      // a concurrent call finished first
  asset.tris = geos.map(g => g.tris); asset.detailTris = dm.tris; asset.detail = dm.toGeometry(); asset.geos = geos.map(g => g.toGeometry());
  return asset;
}
function buildNow() { if (asset.geos) return; const gs = []; for (let l = 0; l < 3; l++) { const m = new Mesher(l); for (const part of PARTS) part(m); gs.push(m); } const dm = new Mesher(0); for (const part of DETAIL_PARTS) part(dm); asset.tris = gs.map(g => g.tris); asset.detailTris = dm.tris; asset.detail = dm.toGeometry(); asset.geos = gs.map(g => g.toGeometry()); }
export const outfitTriangles = () => asset.tris;
export const outfitDetailTriangles = () => asset.detailTris;

/** Puts outfit `id` on a soldier (see createSoldier opts.outfit). Returns the instance, or null for an unknown id. */
export function attachOutfit(soldier, id, opts = {}) {
  const def = BY_ID.get(id); if (!def || soldier.kind !== 'soldier') return null;
  buildNow();
  const team = opts.team === 0 || opts.team === 1 ? opts.team : -1;
  return attachInstance(soldier, asset, outfitMaterial(def.id, def.palette, team), opts.lod ?? -1, outfitMaterial(def.id, def.palette, team, true));
}
/** First-person sleeves and gloves of a colourway. */
export function fpArms(id) { const def = BY_ID.get(id); return def ? fpArmsFor(def.id, def.palette) : null; }
void chaikin; void torsoSkin; void domeMap; void crescent;
