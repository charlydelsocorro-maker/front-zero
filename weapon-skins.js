// FRONT ZÉRO — weapon finishes: a runtime material layer, no geometry is ever changed.
// First person and preview: each mesh of the weapon gets a shared finished clone of its material, chosen by the ROLE of that material
// (body, furniture, metal, accent, blade), never by mesh. A material this file has never seen is classified from its own properties, so new and remodelled weapons work.
// Third person and ground drops: one shader patch keyed on the gun bone. Textures are generated once, shared, 256 px, one per task.
import * as THREE from 'three';
import { finishById, isFinish } from './cosmetics.js';

/* ---------- tileable noise ---------- */
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function noiseKit(seed) {
  const R = mulberry(seed), P = new Uint8Array(512), H = new Float32Array(256);
  const o = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)), t = o[i]; o[i] = o[j]; o[j] = t; }
  for (let i = 0; i < 512; i++) P[i] = o[i & 255]; for (let i = 0; i < 256; i++) H[i] = R();
  const vn = (x, y, per) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a0 = ((xi % per) + per) % per, b0 = ((yi % per) + per) % per, a1 = (a0 + 1) % per, b1 = (b0 + 1) % per;
    const h = (a, b) => H[P[P[a & 255] + (b & 255)]];
    const p = h(a0, b0), q = h(a1, b0), r = h(a0, b1), s = h(a1, b1);
    return p + (q - p) * u + (r - p) * v + (p - q - r + s) * u * v;
  };
  const fbm = (u, v, per, oct) => { let s = 0, w = .5, n = 0, p = per; for (let i = 0; i < oct; i++) { s += vn(u * p, v * p, p) * w; n += w; w *= .5; p *= 2; } return s / n; };
  return { R, vn, fbm };
}
const rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const sat = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mixInto = (o, a, b, t) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };

/* ---------- pattern generators: fn(finish, n, data) writes n*n RGBA, tiles in both directions ---------- */
const put = (d, i, c, k = 1) => { d[i] = Math.max(0, Math.min(255, c[0] * k)); d[i + 1] = Math.max(0, Math.min(255, c[1] * k)); d[i + 2] = Math.max(0, Math.min(255, c[2] * k)); d[i + 3] = 255; };

function* genDigital(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(f.id.length * 97 + C[1][0]), cells = 64, step = n / cells, id = new Uint8Array(cells * cells);
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    const u = x / cells, v = y / cells, a = K.fbm(u, v * 1.0, 5, 3) + (K.vn(u * 32, v * 32, 32) - .5) * .13, b = K.fbm(u + .37, v + .11, 7, 2);
    id[y * cells + x] = a < .405 ? 0 : a < .5 ? 1 : a < .6 ? 2 : b > .56 ? 3 : 2;
  }
  // tidy lone pixels: real digital patterns are built from clusters of at least two
  for (let pass = 0; pass < 2; pass++) for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    const c = id[y * cells + x], l = id[y * cells + (x + cells - 1) % cells], r = id[y * cells + (x + 1) % cells], t = id[((y + cells - 1) % cells) * cells + x], b = id[((y + 1) % cells) * cells + x];
    if (c !== l && c !== r && c !== t && c !== b) id[y * cells + x] = r;
  }
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const cx = Math.floor(x / step), cy = Math.floor(y / step), k = .975 + K.vn(cx * .9, cy * .9, 64) * .05;
    put(d, (y * n + x) * 4, C[id[cy * cells + cx]], k);
  }
}
function* genWoodland(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(f.id.length * 131 + C[2][1]), T = [0, 0, 0];
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, wx = K.fbm(u, v, 4, 2) - .5, wy = K.fbm(u + .5, v + .25, 4, 2) - .5;
    const a = K.fbm(u + wx * .16, v + wy * .16, 3, 4), b = K.fbm(u + .31 - wy * .12, v + .67 + wx * .12, 4, 3), e = 1.6 / n;
    let c = C[2]; mixInto(T, C[2], C[1], smooth(.47 - e, .47 + e, a)); c = T;
    const c2 = [0, 0, 0]; mixInto(c2, c, C[3], smooth(.565 - e, .565 + e, b)); mixInto(T, c2, C[0], smooth(.585 - e, .585 + e, a));
    const grain = .965 + K.vn(u * 90, v * 90, 90) * .07; put(d, (y * n + x) * 4, T, grain);
  }
}
function* genTiger(f, n, d) {
  // separate tapered brush strokes, laid mostly along the weapon: broken bands, never continuous stripes
  const C = f.c.map(rgb), K = noiseKit(911 + C[2][0]), T = [0, 0, 0], ink = new Uint8Array(n * n);
  const stroke = (level, count, lenA, lenB, wide) => {
    for (let s = 0; s < count; s++) {
      const cx = K.R() * n, cy = K.R() * n, a = (K.R() - .5) * .62, bend = (K.R() - .5) * .9, half = (lenA + K.R() * (lenB - lenA)) * n / 2, w = wide * n * (.55 + K.R() * .75), ca = Math.cos(a), sa = Math.sin(a), steps = Math.ceil(half * 2);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps * 2 - 1, rad = w * Math.pow(1 - t * t, .8) * (.72 + .5 * K.vn(i * .09 + s * 3.1, s * 1.7, 64)), l = t * half, o = bend * t * t * half * .34, px = cx + l * ca - o * sa, py = cy + l * sa + o * ca, r = Math.ceil(rad);
        for (let dy = -r; dy <= r; dy++) { if (Math.abs(dy) > rad) continue; const q = ((Math.round(py) + dy) % n + n) % n, e = ((Math.round(px)) % n + n) % n, at = q * n + e; if (ink[at] < level) ink[at] = level; const e2 = (e + 1) % n; if (ink[q * n + e2] < level) ink[q * n + e2] = level; }
      }
    }
  };
  stroke(1, 34, .22, .5, .036); stroke(2, 26, .14, .38, .021);
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, m = K.fbm(u, v, 4, 3), lv = ink[y * n + x];
    mixInto(T, C[3], C[2], smooth(.34, .62, m)); if (lv === 1) mixInto(T, T, C[1], .92); else if (lv === 2) mixInto(T, T, C[0], .96);
    put(d, (y * n + x) * 4, T, .95 + K.vn(u * 120, v * 40, 40) * .09);
  }
}
function* genSplinter(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(1409), G = 7, px = new Float32Array(G * G), py = new Float32Array(G * G), id = new Uint8Array(G * G);
  for (let i = 0; i < G * G; i++) { px[i] = K.R(); py[i] = K.R(); const r = K.R(); id[i] = r < .28 ? 0 : r < .58 ? 1 : r < .86 ? 2 : 3; }
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n * G, v = y / n * G, cu = Math.floor(u), cv = Math.floor(v); let best = 9, sec = 9, bi = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const cx = (cu + a + G) % G, cy = (cv + b + G) % G, i = cy * G + cx, dx = cu + a + px[i] - u, dy = cv + b + py[i] - v;
      const q = Math.max(Math.abs(dx * .92 + dy * .39), Math.abs(dx * -.39 + dy * .92) * 1.5) + Math.abs(dx - dy) * .18;      // a slanted polygon metric: straight shard edges
      if (q < best) { sec = best; best = q; bi = i; } else if (q < sec) sec = q;
    }
    const edge = 1 - smooth(.0, .018, sec - best);
    put(d, (y * n + x) * 4, C[id[bi]], (.97 + K.vn(x * .4, y * .4, Math.max(2, Math.floor(n * .4))) * .05) * (1 - edge * .22));
  }
}
function* genCarbon(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(77), cell = n / 32, T = [0, 0, 0];
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), fx = x / cell - cx, fy = y / cell - cy, over = ((cx + cy) % 4 + 4) % 4 < 2;       // twill weave
    const across = over ? Math.sin(fy * Math.PI) : Math.sin(fx * Math.PI), along = over ? fx : fy, fibre = Math.sin((over ? fy : fx) * Math.PI * 7) * .5 + .5;
    const sheen = Math.pow(sat(across), 1.4) * (.62 + .38 * Math.sin(along * Math.PI));
    mixInto(T, C[0], C[1], sat(sheen * 1.15)); mixInto(T, T, C[2], smooth(.62, 1, sheen) * .75);
    put(d, (y * n + x) * 4, T, (over ? 1.08 : .86) * (.94 + fibre * .1) * (.98 + K.vn(x * .1, y * .1, Math.max(2, Math.floor(n * .1))) * .04));
  }
}
function brushedLine(K, n) { const row = new Float32Array(n); for (let y = 0; y < n; y++) { const v = y / n; row[y] = K.vn(v * 90, .5, 90) * .5 + K.vn(v * 37, 3.5, 37) * .3 + K.R() * .2; } return row; }
function* genBrushed(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(303), row = brushedLine(K, n), T = [0, 0, 0];
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, t = row[y] * .7 + K.vn(u * 5, v * 120, 5) * .18 + K.fbm(u, v, 2, 2) * .12;
    if (t < .5) mixInto(T, C[0], C[1], t * 2); else mixInto(T, C[1], C[2], (t - .5) * 2);
    put(d, (y * n + x) * 4, T);
  }
}
function* genGilded(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(5150), row = brushedLine(K, n), T = [0, 0, 0];
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, soft = K.fbm(u, v, 3, 3), hammer = K.fbm(u + .2, v + .6, 14, 2), t = sat(.3 + row[y] * .24 + (soft - .5) * .5 + (hammer - .5) * .32);
    if (t < .5) mixInto(T, C[1], C[2], t * 2); else mixInto(T, C[2], C[3], (t - .5) * 2);
    put(d, (y * n + x) * 4, T);
  }
}
function* genHeat(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(2718), row = brushedLine(K, n), T = [0, 0, 0];
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, wx = K.fbm(u, v, 2, 2) - .5, wy = K.fbm(u + .3, v + .8, 2, 2) - .5, h = K.fbm(u + wx * .35, v + wy * .35, 2, 4), t = sat((h - .3) * 2.5);
    if (t < .36) mixInto(T, C[0], C[1], t / .36); else if (t < .84) mixInto(T, C[1], C[2], (t - .36) / .48); else mixInto(T, C[2], C[3], (t - .84) / .16 * .7);       // the blue-violet heat tint stays a thin edge
    put(d, (y * n + x) * 4, T, .9 + row[y] * .2);
  }
}
function* genVeined(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(6661), T = [0, 0, 0];
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, wx = K.fbm(u, v, 3, 3) - .5, wy = K.fbm(u + .5, v + .5, 3, 3) - .5, a = K.fbm(u + wx * .3, v + wy * .3, 3, 4);
    const ridge = 1 - Math.abs(a * 2 - 1), vein = Math.pow(smooth(.9, 1, ridge), 2.4), cloud = K.fbm(u + .2, v + .9, 2, 3);
    mixInto(T, C[0], C[1], smooth(.35, .7, cloud)); mixInto(T, T, C[2], vein * .7); mixInto(T, T, C[3], Math.pow(vein, 4) * .34);
    put(d, (y * n + x) * 4, T);
  }
}
/* ÉCLIPSE: matte black, a few machined panel lines picked out in the accent colour, light wear along them */
const ECL_LINES = [[.06, .22, .34, .22], [.34, .22, .4, .3], [.4, .3, .72, .3], [.72, .3, .8, .22], [.8, .22, .98, .22], [.12, .7, .46, .7], [.46, .7, .52, .62], [.52, .62, .9, .62], [.2, .9, .3, .8], [.62, .92, .7, .84], [.7, .84, .94, .84]];
const ECL_ACCENT = [[.4, .3, .72, .3], [.72, .3, .8, .22], [.12, .7, .46, .7], [.46, .7, .52, .62], [.7, .84, .94, .84], [.62, .92, .7, .84]];
function segDist(px, py, s) {
  // shortest distance on the torus
  let best = 9; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const ax = s[0] + ox, ay = s[1] + oy, bx = s[2] + ox, by = s[3] + oy, vx = bx - ax, vy = by - ay, t = sat(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)), dx = px - ax - vx * t, dy = py - ay - vy * t, q = dx * dx + dy * dy;
    if (q < best) best = q;
  }
  return Math.sqrt(best);
}
function* genEclipse(f, n, d) {
  const C = f.c.map(rgb), A = rgb(f.accent), K = noiseKit(4242), T = [0, 0, 0], px = 1 / n;
  // distance fields are computed once for all colourways that share a resolution
  const key = 'ecl' + n; let F = FIELD.get(key);
  if (!F) { F = { l: new Float32Array(n * n), a: new Float32Array(n * n) }; for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) { const u = (x + .5) / n, v = (y + .5) / n; let l = 9, a = 9; for (const s of ECL_LINES) { const q = segDist(u, v, s); if (q < l) l = q; } for (const s of ECL_ACCENT) { const q = segDist(u, v, s); if (q < a) a = q; } F.l[y * n + x] = l; F.a[y * n + x] = a; } FIELD.set(key, F); }
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, i = y * n + x, m = K.fbm(u, v, 5, 3), fine = K.vn(u * 70, v * 70, 70), scuff = K.fbm(u + .3, v + .1, 11, 3);
    mixInto(T, C[0], C[1], smooth(.3, .72, m) * .8 + fine * .12);
    const line = 1 - smooth(px * .9, px * 2, F.l[i]), rim = 1 - smooth(px * 2, px * 8.5, F.l[i]);       // machined groove, its edge slightly worn
    mixInto(T, T, C[2], rim * smooth(.42, .74, scuff) * .72);
    mixInto(T, T, C[2], smooth(.735, .8, scuff) * .32);                                                    // rare light scuffs on the flats
    T[0] *= 1 - line * .62; T[1] *= 1 - line * .62; T[2] *= 1 - line * .62;
    const acc = 1 - smooth(px * 2.1, px * 3.2, F.a[i]); mixInto(T, T, A, acc);
    put(d, i * 4, T);
  }
}
const FIELD = new Map();

/* ---------- map finishes: each pattern taken from a map's own look ---------- */
/** Periodic Voronoi cells: nearest and second-nearest site, the nearest's index and the vector to it. */
function cellsOf(K, G) { const px = new Float32Array(G * G), py = new Float32Array(G * G), r = new Float32Array(G * G), s = new Float32Array(G * G); for (let i = 0; i < G * G; i++) { px[i] = K.R(); py[i] = K.R(); r[i] = K.R(); s[i] = K.R(); } return { G, px, py, r, s }; }
function vor(V, u, v, o) {
  const G = V.G, x = u * G, y = v * G, cu = Math.floor(x), cv = Math.floor(y); let d1 = 9, d2 = 9, i1 = 0, bx = 0, by = 0;
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const cx = ((cu + a) % G + G) % G, cy = ((cv + b) % G + G) % G, i = cy * G + cx, dx = cu + a + V.px[i] - x, dy = cv + b + V.py[i] - y, d = dx * dx + dy * dy;
    if (d < d1) { d2 = d1; d1 = d; i1 = i; bx = dx; by = dy; } else if (d < d2) d2 = d;
  }
  o[0] = Math.sqrt(d1); o[1] = Math.sqrt(d2); o[2] = i1; o[3] = bx; o[4] = by; return o;
}
/* Dépôt 7: desert ground, soft dark smudges, pebbles */
function* genMottle(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(707), T = [0, 0, 0];
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, w = K.fbm(u, v, 3, 2) - .5, a = K.fbm(u + w * .2, v - w * .2, 3, 4), b = K.fbm(u + .41, v + .13, 5, 3), peb = K.vn(u * 110, v * 110, 110);
    mixInto(T, C[2], C[3], smooth(.3, .2, a) * .7); mixInto(T, T, C[1], smooth(.5, .64, a)); mixInto(T, T, C[0], smooth(.62, .74, b) * .75);
    if (peb > .83) mixInto(T, T, C[0], smooth(.83, .9, peb) * .6);
    put(d, (y * n + x) * 4, T, .95 + K.vn(u * 200, v * 200, 200) * .1);
  }
}
/* Vieille Ville: grey cobbles with mortar, a few terracotta tiles */
function* genCobble(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(808), V = cellsOf(K, 9), o = new Float32Array(5), T = [0, 0, 0];
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, wu = (K.vn(u * 14, v * 14, 14) - .5) * .02; vor(V, u + wu, v - wu, o);
    const i = o[2], e = o[1] - o[0], r = V.r[i];
    if (r < .13) mixInto(T, C[3], C[2], V.s[i] * .25); else mixInto(T, C[1], C[2], V.s[i]);
    const bevel = .8 + .2 * smooth(0, .22, e), grain = .94 + K.vn(u * 160, v * 160, 160) * .12;
    mixInto(T, T, C[0], 1 - smooth(.045, .085, e));
    put(d, (y * n + x) * 4, T, bevel * grain);
  }
}
/* Port du Couchant: stacked container panels in their paints, rust at the edges */
function* genPatchwork(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(909), T = [0, 0, 0], RUST = [104, 58, 36], rows = [], gap = 1.6 / n;
  let acc = 0; while (acc < 1) { const h = Math.min(1 - acc, .22 + K.R() * .2); const cols = []; let c = 0; while (c < 1) { const w = Math.min(1 - c, .3 + K.R() * .45); cols.push([c, c + w, 1 + Math.floor(K.R() * (C.length - 1))]); c += w; } rows.push([acc, acc + h, cols, K.R() * .3]); acc += h; }
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, row = rows.find(r => v >= r[0] && v < r[1]) || rows[rows.length - 1], uu = (u + row[3]) % 1, col = row[2].find(c => uu >= c[0] && uu < c[1]) || row[2][0];
    const edge = Math.min(v - row[0], row[1] - v, uu - col[0], col[1] - uu), cor = .965 + .035 * Math.sin(uu * Math.PI * 2 * 46);
    mixInto(T, C[col[2]], C[col[2]], 0); const rust = smooth(.05, 0, edge) * smooth(.45, .62, K.fbm(u, v, 9, 3)) + smooth(.7, .78, K.fbm(u + .3, v + .6, 6, 3)) * .5;
    mixInto(T, T, RUST, Math.min(.8, rust)); mixInto(T, T, C[0], 1 - smooth(gap * .6, gap * 1.4, edge));
    put(d, (y * n + x) * 4, T, cor * (.95 + K.vn(u * 150, v * 150, 150) * .08));
  }
}
/* Bunker Sigma: shuttered concrete, panel seams and tie holes, water streaks, hairline cracks */
function* genConcrete(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(1111), T = [0, 0, 0], px = 1 / n;
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, m = K.fbm(u, v, 4, 4), streak = K.fbm(u * 1, v * .25, 14, 3), su = (u * 3) % 1, sv = (v * 2) % 1;
    mixInto(T, C[2], C[3], smooth(.45, .7, m) * .6); mixInto(T, T, C[1], smooth(.5, .7, streak) * .55);
    const seam = Math.min(Math.min(su, 1 - su) / 3, Math.min(sv, 1 - sv) / 2);
    const hu = Math.abs(((u * 3 + .5) % 1) - .5) / 3, hv = Math.abs(((v * 4 + .5) % 1) - .5) / 4, hole = Math.hypot(hu, hv);
    const crack = (1 - smooth(px * .5, px * 1.6, Math.abs(K.fbm(u + .2, v + .8, 3, 4) - .5) * .12)) * smooth(.52, .6, K.fbm(u + .7, v, 2, 2));
    mixInto(T, T, C[0], Math.max(1 - smooth(px * .8, px * 2, seam), (1 - smooth(px * 2.2, px * 3.4, hole)) * .9, crack * .8));
    put(d, (y * n + x) * 4, T, .95 + K.vn(u * 190, v * 190, 190) * .1);
  }
}
/* Col Blanc: low faceted rock and snow, like its mountains, with a few pine-green facets */
function* genFacet(f, n, d) {
  const C = f.c.map(rgb), PINE = rgb(f.accent), K = noiseKit(1212), V = cellsOf(K, 6), o = new Float32Array(5), T = [0, 0, 0];
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n; vor(V, u, v, o);
    const i = o[2], r = V.r[i], ang = V.s[i] * 6.283, sh = .8 + .22 * Math.cos(ang) + (o[3] * Math.cos(ang * 1.7) + o[4] * Math.sin(ang * 1.7)) * .35;
    const base = r < .05 ? PINE : r < .3 ? C[1] : r < .62 ? C[2] : C[3];       // a few pine-green facets (accent); C[0] stays the dark rock of metal parts
    T[0] = base[0]; T[1] = base[1]; T[2] = base[2];
    put(d, (y * n + x) * 4, T, Math.max(.55, Math.min(1.12, sh)) * (1 - (1 - smooth(.008, .02, o[1] - o[0])) * .07));
  }
}
/* Piste Sept-Vents: tarmac aggregate, black crack sealant, one worn taxiway mark */
function* genAsphalt(f, n, d) {
  const C = f.c.map(rgb), A = rgb(f.accent), K = noiseKit(1313), V = cellsOf(K, 3), o = new Float32Array(5), T = [0, 0, 0], px = 1 / n;
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, s1 = K.vn(u * 170, v * 170, 170), s2 = K.vn(u * 90 + 7, v * 90, 90), wu = (K.fbm(u, v, 6, 2) - .5) * .06; vor(V, u + wu, v + wu, o);
    mixInto(T, C[2], C[1], smooth(.4, .7, K.fbm(u, v, 3, 3)) * .6); if (s1 > .78) mixInto(T, T, C[3], smooth(.78, .9, s1)); if (s2 < .2) mixInto(T, T, C[1], smooth(.2, .1, s2));
    const mark = (1 - smooth(px * 6, px * 8, Math.abs(v - .72))) * smooth(.06, .1, u) * smooth(.62, .56, u) * smooth(.36, .46, K.fbm(u + .9, v, 12, 3));
    mixInto(T, T, A, mark * .8); mixInto(T, T, C[0], 1 - smooth(px * 1.2, px * 3, o[1] - o[0]));
    put(d, (y * n + x) * 4, T, .96 + K.vn(u * 230, v * 230, 230) * .08);
  }
}
/* Raffinerie Noirval: oil-stained, cracked ground under a dusk glow */
function* genCrackle(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(1414), V = cellsOf(K, 5), o = new Float32Array(5), T = [0, 0, 0], px = 1 / n;
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const u = x / n, v = y / n, wu = (K.fbm(u, v, 5, 3) - .5) * .1, wv = (K.fbm(u + .5, v + .5, 5, 3) - .5) * .1; vor(V, u + wu, v + wv, o);
    const e = o[1] - o[0], m = K.fbm(u, v, 3, 4);
    mixInto(T, C[1], C[2], smooth(.35, .7, m)); mixInto(T, T, C[0], smooth(.56, .7, K.fbm(u + .2, v + .4, 2, 4)) * .85);
    mixInto(T, T, C[3], (1 - smooth(px * 2, px * 9, e)) * .22); mixInto(T, T, C[0], 1 - smooth(px * .8, px * 2.2, e));
    put(d, (y * n + x) * 4, T, .95 + K.vn(u * 200, v * 200, 200) * .1);
  }
}
/* Roquesèche: a survey of its ridges, sandstone shades by height with contour lines */
function* genTopo(f, n, d) {
  const C = f.c.map(rgb), K = noiseKit(1515), T = [0, 0, 0], H = new Float32Array(n * n), STEP = 20;
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) { const u = x / n, v = y / n, w = K.fbm(u, v, 2, 2) - .5; H[y * n + x] = K.fbm(u + w * .25, v - w * .25, 2, 4); }
  for (let y = 0; y < n; y++) for (let x = 0, _p = (y & 31) || (yield 0); x < n; x++) {
    const i = y * n + x, h = H[i], gx = (H[y * n + (x + 1) % n] - H[y * n + (x + n - 1) % n]) * .5, gy = (H[((y + 1) % n) * n + x] - H[((y + n - 1) % n) * n + x]) * .5, g = Math.max(1e-5, Math.hypot(gx, gy) * STEP);
    const t = sat((h - .28) / .46); if (t < .5) mixInto(T, C[1], C[2], t * 2); else mixInto(T, C[2], C[3], (t - .5) * 2);
    const f2 = h * STEP, dd = Math.abs(f2 - Math.round(f2)) / g, major = Math.round(f2) % 5 === 0;
    mixInto(T, T, C[0], (1 - smooth(major ? .9 : .45, major ? 1.7 : 1.1, dd)) * (major ? .72 : .5));
    put(d, i * 4, T, .96 + K.vn(x * .5, y * .5, n >> 1) * .07);
  }
}
const GEN = { digital: genDigital, woodland: genWoodland, tiger: genTiger, splinter: genSplinter, carbon: genCarbon, brushed: genBrushed, gilded: genGilded, heat: genHeat, veined: genVeined, eclipse: genEclipse,
  mottle: genMottle, cobble: genCobble, patchwork: genPatchwork, concrete: genConcrete, facet: genFacet, asphalt: genAsphalt, crackle: genCrackle, topo: genTopo };

/* ---------- shared textures ---------- */
const TEX = new Map(), TEX_SIZE = 256, TILE = 4.2;       // one tile covers about 24 cm of weapon
/* Each generator pauses every 32 rows (a few milliseconds): prepareFinishes() spreads one texture over several tasks; finishTexture() runs it at once. */
// Patterns read up to four colours: a 3-colour palette (allowed for season finishes) gets a fourth, its lightest one raised a quarter towards white.
const lift = h => { const c = rgb(h); return (Math.round(c[0] + (255 - c[0]) * .25) << 16) | (Math.round(c[1] + (255 - c[1]) * .25) << 8) | Math.round(c[2] + (255 - c[2]) * .25); };
const genOf = (f, n, data) => (GEN[f.pattern] || genDigital)(f.c.length >= 4 ? f : { ...f, c: [...f.c, lift(f.c[f.c.length - 1])] }, n, data);
const runAll = it => { while (!it.next().done) { /* no pause */ } };
function makeTex(id, data) {
  const n = TEX_SIZE, t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
  t.repeat.set(TILE / 9, TILE / 9); t.name = 'finish:' + id; t.needsUpdate = true;      // the models' UVs are metres × 9
  TEX.set(id, t); return t;
}
/** The finish's texture, shared by every weapon, player and drop. Built at once if nobody prepared it (prefer prepareFinishes). */
export function finishTexture(id) {
  const t = TEX.get(id); if (t) return t;
  const f = finishById(id); if (!f) return null;
  const data = new Uint8Array(TEX_SIZE * TEX_SIZE * 4); runAll(genOf(f, TEX_SIZE, data)); return makeTex(id, data);
}
export const finishReady = id => TEX.has(id);
const macro = () => new Promise(r => setTimeout(r, 0));
/** Builds these textures in slices of 32 rows, one slice per task, so no task gets long. */
export async function prepareFinishes(ids, onEach) {
  for (const id of new Set(ids)) {
    if (!isFinish(id) || TEX.has(id)) continue;
    const f = finishById(id), data = new Uint8Array(TEX_SIZE * TEX_SIZE * 4), it = genOf(f, TEX_SIZE, data);
    do await macro(); while (!it.next().done);
    if (!TEX.has(id)) makeTex(id, data); if (onEach) onEach(id);
  }
}
/** Paints a small sample of the finish on a 2D canvas (shop cards). */
export function drawSwatch(canvas, id) {
  const f = finishById(id); if (!f) return false;
  const n = 128, ctx = canvas.getContext('2d'), tex = TEX.get(id);
  const img = ctx.createImageData(n, n);
  if (tex) { const s = tex.image.data, N = tex.image.width, k = N / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const a = (Math.floor(y * k) * N + Math.floor(x * k)) * 4, b = (y * n + x) * 4; img.data[b] = s[a]; img.data[b + 1] = s[a + 1]; img.data[b + 2] = s[a + 2]; img.data[b + 3] = 255; } }
  else runAll(genOf(f, n, img.data));
  canvas.width = n; canvas.height = n; ctx.putImageData(img, 0, 0); return true;
}

/* ---------- roles and their look for each kind of finish ---------- */
const ROLE_KEYS = { paint: 'body', olive: 'body', poly: 'furniture', tan: 'furniture', wood: 'furniture', walnut: 'furniture', steel: 'metal', dark: 'metal', nickel: 'metal', brass: 'accent', red: 'accent', blade: 'blade' };
const NO_ROLE = new Set(['rubber', 'glass', 'dot', 'glove', 'sleeve']);
const CAMO = { body: { tex: 1, m: .05, r: .8 }, furniture: { tex: 1, m: .03, r: .86 }, metal: { dark: 1, m: .62, r: .62 }, accent: { acc: 1, m: .2, r: .66 }, blade: { tex: 1, m: .5, r: .46 } };
const METALLIC = { body: { tex: 1, m: 1, r: .3, k: .86 }, furniture: { col: 0x141518, m: .06, r: .74 }, metal: { tex: 1, m: 1, r: .26, k: .92 }, accent: { acc: 1, m: .95, r: .3 }, blade: { tex: 1, m: 1, r: .2 } };
const STYLES = {
  digital: CAMO, woodland: CAMO, tiger: CAMO, splinter: CAMO,
  mottle: CAMO, cobble: CAMO, concrete: CAMO, asphalt: CAMO, crackle: CAMO, topo: CAMO,
  patchwork: { ...CAMO, body: { tex: 1, m: .18, r: .6 }, furniture: { tex: 1, m: .12, r: .66 } }, facet: { ...CAMO, body: { tex: 1, m: .05, r: .52 } },
  carbon: { body: { tex: 1, m: .28, r: .4 }, furniture: { tex: 1, m: .16, r: .46 }, metal: { col: 0x24262b, m: .8, r: .46 }, accent: { acc: 1, m: .6, r: .42 }, blade: { tex: 1, m: .55, r: .36 } },
  veined: { body: { tex: 1, m: .34, r: .22 }, furniture: { tex: 1, m: .2, r: .3 }, metal: { col: 0x16171d, m: .85, r: .32 }, accent: { acc: 1, m: .5, r: .34 }, blade: { tex: 1, m: .7, r: .2 } },
  brushed: { body: { tex: 1, m: .96, r: .34, k: 1.5 }, furniture: { col: 0x1d1f22, m: .05, r: .82 }, metal: { tex: 1, m: 1, r: .3, k: 1.15 }, accent: { acc: 1, m: .9, r: .36 }, blade: { tex: 1, m: 1, r: .24 } },
  gilded: METALLIC, heat: { ...METALLIC, body: { tex: 1, m: .92, r: .36 }, metal: { tex: 1, m: .95, r: .32, k: .8 } },
  eclipse: { body: { tex: 1, m: .06, r: .62 }, furniture: { tex: 1, m: .03, r: .74 }, metal: { col: 0x101216, m: .5, r: .52 }, accent: { acc: 1, m: .25, r: .42 }, blade: { tex: 1, m: .55, r: .4 } },
};
function classify(key, m) {
  if (NO_ROLE.has(key)) return null;
  if (ROLE_KEYS[key]) return ROLE_KEYS[key];
  if (!m || !m.isMeshStandardMaterial || m.transparent) return null;
  return m.metalness > .6 ? 'metal' : 'furniture';
}
const BASE = new WeakMap();      // finished mesh -> its original material. Not in userData: Object3D.clone would serialise it.

/** A skinner works on one set of materials (the viewmodel's, or one preview's). */
export function createSkinner(mats) {
  const roleOf = new Map(), made = new Map();
  for (const key of Object.keys(mats)) roleOf.set(mats[key], classify(key, mats[key]));
  const matFor = (base, fid) => {
    if (!roleOf.has(base)) roleOf.set(base, classify('', base));
    const role = roleOf.get(base); if (!role) return base;
    const f = finishById(fid); if (!f) return base;
    const key = fid + '|' + role; let m = made.get(key); if (m) return m;
    const S = (STYLES[f.pattern] || CAMO)[role]; m = base.clone();
    m.metalness = S.m; m.roughness = S.r;
    if (S.tex) {
      // pale camouflages are toned down: the models' edge-wear vertex colours go up to ×2 and would burn them to white
      const mid = rgb(f.c[Math.min(2, f.c.length - 1)]), pale = (mid[0] + mid[1] + mid[2]) / 765 > .6;
      m.map = finishTexture(fid); m.color.setScalar(S.k ?? (pale ? .74 : 1));
    }
    else { m.map = null; m.color.setHex(S.acc ? f.accent : S.dark ? f.c[0] : S.col); }
    m.name = 'finish:' + key; made.set(key, m); return m;
  };
  return {
    /** Puts this finish on the weapon's own meshes (null = factory look). Mounted accessories keep their own materials. */
    apply(w, fid) {
      const id = isFinish(fid) ? fid : null; if ((w.finId || null) === id) return; w.finId = id;
      const att = new Set(); for (const a of w.attObjs || []) a.traverse(o => att.add(o));
      w.root.traverse(o => {
        if (!o.isMesh || att.has(o) || Array.isArray(o.material)) return;
        let base = BASE.get(o); if (!base) { base = o.material; BASE.set(o, base); }
        o.material = id && o.geometry.attributes.uv ? matFor(base, id) : base;
      });
    },
    dispose() { for (const m of made.values()) m.dispose(); made.clear(); },
    get count() { return made.size; },
  };
}

/* ---------- third person and ground drops: one shader patch ---------- */
const VS_HEAD = '\nvarying float vFinG; varying vec3 vFinP; varying vec3 vFinN; uniform float uFinBone;';
const VS_BODY = '\n#ifdef USE_SKINNING\n vFinG = abs(skinIndex.x - uFinBone) < .5 ? 1. : 0.;\n#else\n vFinG = 1.;\n#endif\n vFinP = position; vFinN = normal;';
const FS_HEAD = '\nvarying float vFinG; varying vec3 vFinP; varying vec3 vFinN; uniform sampler2D uFinTex; uniform float uFinScale;';
const FS_BODY = `
 if (vFinG > .5) {
   vec3 fa = abs(vFinN);
   vec2 fuv = fa.x >= fa.y && fa.x >= fa.z ? vFinP.zy : fa.y >= fa.z ? vFinP.zx : vFinP.xy;
   vec3 ft = texture2D(uFinTex, fuv * uFinScale).rgb;
   float fl = dot(diffuseColor.rgb, vec3(.3, .59, .11));
   diffuseColor.rgb = ft * (.62 + 1.25 * min(fl, 1.));
 }
`;
function patch(sh, tex, bone) {
  sh.uniforms.uFinTex = { value: tex }; sh.uniforms.uFinBone = { value: bone }; sh.uniforms.uFinScale = { value: TILE };
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + VS_HEAD).replace('#include <begin_vertex>', '#include <begin_vertex>' + VS_BODY);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + FS_HEAD).replace('#include <roughnessmap_fragment>', FS_BODY + '#include <roughnessmap_fragment>');
}
const solMats = new Map();
/** Gives a third-person soldier this finish on its gun only (null = factory look). Materials share one program whatever the finish. */
export function soldierFinish(sol, fid) {
  if (!sol || !sol.mesh) return; const mesh = sol.mesh, id = isFinish(fid) ? fid : null;
  let base = BASE.get(mesh); if (!base) { base = mesh.material; BASE.set(mesh, base); }
  if (!id) { if (mesh.material !== base) mesh.material = base; return; }
  const key = base.uuid + '|' + id; let m = solMats.get(key);
  if (!m) {
    const bone = sol.skeleton ? sol.skeleton.bones.findIndex(b => b.name === 'gun') : -1, tex = finishTexture(id);
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: base.roughness, metalness: base.metalness });
    m.userData.uniforms = base.userData.uniforms;
    const prior = base.onBeforeCompile, priorKey = base.customProgramCacheKey ? base.customProgramCacheKey() : '';
    m.onBeforeCompile = (sh, r) => { if (prior) prior.call(base, sh, r); patch(sh, tex, bone); };
    m.customProgramCacheKey = () => priorKey + '|fz-finish-1';
    m.name = 'finish-soldier:' + id; solMats.set(key, m);
  }
  if (mesh.material !== m) mesh.material = m;
}
const dropMats = new Map();
/** The ground-drop material of a finish (normal and highlighted): same program for all of them. */
export function dropFinishMaterials(baseMat, baseHi, fid) {
  if (!isFinish(fid)) return null;
  let e = dropMats.get(fid); if (e) return e;
  const tex = finishTexture(fid), mk = src => { const m = src.clone(); m.onBeforeCompile = sh => patch(sh, tex, -1); m.customProgramCacheKey = () => 'fz-finish-drop-1'; m.name = 'finish-drop:' + fid; return m; };
  e = { mat: mk(baseMat), hi: mk(baseHi) }; dropMats.set(fid, e); return e;
}
