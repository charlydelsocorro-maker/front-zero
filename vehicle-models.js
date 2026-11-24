// FRONT ZÉRO - procedural vehicle library. Original designs only: no real make, badge or commercial model.
// Standalone: imports three.js and nothing else. See the dev notes for the API.
// Exported frame: forward = -Z, up = +Y, right = +X, ground at y = 0, metres.
// Modelling frame (inside this file): forward = +Z, x > 0 = vehicle left. The export turns it 180 degrees around Y.
import * as THREE from 'three';

const PAINT = 0, TRIM = 1, RUBBER = 2, CHROME = 3, GLASS = 4, CANVAS = 5, LAMP = 6, NMAT = 7;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sat = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const k = sat((x - a) / (b - a)); return k * k * (3 - 2 * k); };

function makeRng(seed) { let s = ((seed | 0) * 2654435761 + 1013) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const NOISE = (() => { const t = new Float32Array(4096); for (let i = 0; i < 4096; i++) t[i] = hash3(i & 15, (i >> 4) & 15, i >> 8); return t; })();
function vnoise(x, y, z) {
  const xf0 = Math.floor(x), yf0 = Math.floor(y), zf0 = Math.floor(z); let fx = x - xf0, fy = y - yf0, fz = z - zf0;
  const xi = xf0 & 15, yi = (yf0 & 15) << 4, zi = (zf0 & 15) << 8, xj = (xi + 1) & 15, yj = (yi + 16) & 240, zj = (zi + 256) & 3840, N = NOISE;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = N[xi | yi | zi], b = N[xj | yi | zi], c = N[xi | yj | zi], d = N[xj | yj | zi], e = N[xi | yi | zj], f = N[xj | yi | zj], g = N[xi | yj | zj], h = N[xj | yj | zj];
  const p = a + (b - a) * fx, q = c + (d - c) * fx, r = e + (f - e) * fx, s = g + (h - g) * fx, u = p + (q - p) * fy, v = r + (s - r) * fy;
  return u + (v - u) * fz;
}
const fbm = (x, y, z) => vnoise(x, y, z) * .62 + vnoise(x * 2.3 + 7, y * 2.3 + 3, z * 2.3 + 11) * .38;

// Monotone cubic through [[x, y], ...]: body profiles never overshoot.
function C(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 2 * d[i - 1] * d[i] / (d[i - 1] + d[i]);
  return x => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let a = 0, b = n - 1; while (b - a > 1) { const c = (a + b) >> 1; if (xs[c] <= x) a = c; else b = c; }
    const h = xs[b] - xs[a], t = (x - xs[a]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[a] + (t3 - 2 * t2 + t) * h * m[a] + (-2 * t3 + 3 * t2) * ys[b] + (t3 - t2) * h * m[b];
  };
}

// ---------------------------------------------------------------------------------------------
// Vertex sink: one growable buffer per material, shared scratch, no per-part geometry objects.
class Buf {
  constructor() { this.cap = 2048; this.icap = 8192; this.p = new Float32Array(this.cap * 3); this.n = new Float32Array(this.cap * 3); this.c = new Float32Array(this.cap * 3); this.u = new Float32Array(this.cap * 2); this.i = new Uint32Array(this.icap); this.nv = 0; this.ni = 0; }
  growV() { this.cap *= 2; for (const [k, s] of [['p', 3], ['n', 3], ['c', 3], ['u', 2]]) { const a = new Float32Array(this.cap * s); a.set(this[k]); this[k] = a; } }
  growI() { this.icap *= 2; const a = new Uint32Array(this.icap); a.set(this.i); this.i = a; }
  reset() { this.nv = 0; this.ni = 0; }
}
const scratchA = Array.from({ length: NMAT }, () => new Buf()), scratchW = Array.from({ length: NMAT }, () => new Buf());
let MAXSEG = 99, NOBEVEL = false, TUBESEG = 99;
let bufs = scratchA, B = bufs[0], cR = 1, cG = 1, cB = 1, cA = 1;
let M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]; const stack = [];
const linCache = new Map();
function lin(hex) { let v = linCache.get(hex); if (!v) { const f = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; v = [f(hex >> 16 & 255), f(hex >> 8 & 255), f(hex & 255)]; linCache.set(hex, v); } return v; }
function use(mat, hex, ao = 1) { B = bufs[mat]; if (hex !== undefined) { const c = lin(hex); cR = c[0]; cG = c[1]; cB = c[2]; } cA = ao; }
function V(x, y, z, nx, ny, nz, uu, vv) {
  const b = B; if (b.nv >= b.cap) b.growV(); const i = b.nv++, m = M, i3 = i * 3;
  b.p[i3] = m[0] * x + m[1] * y + m[2] * z + m[3]; b.p[i3 + 1] = m[4] * x + m[5] * y + m[6] * z + m[7]; b.p[i3 + 2] = m[8] * x + m[9] * y + m[10] * z + m[11];
  b.n[i3] = m[0] * nx + m[1] * ny + m[2] * nz; b.n[i3 + 1] = m[4] * nx + m[5] * ny + m[6] * nz; b.n[i3 + 2] = m[8] * nx + m[9] * ny + m[10] * nz;
  b.c[i3] = cR * cA; b.c[i3 + 1] = cG * cA; b.c[i3 + 2] = cB * cA;
  b.u[i * 2] = uu === undefined ? -1e9 : uu; b.u[i * 2 + 1] = vv === undefined ? 0 : vv;
  return i;
}
// Every triangle is oriented from its vertex normals: winding can never disagree with shading.
function T(a, b, c) {
  const o = B, p = o.p, n = o.n, a3 = a * 3, b3 = b * 3, c3 = c * 3;
  const ux = p[b3] - p[a3], uy = p[b3 + 1] - p[a3 + 1], uz = p[b3 + 2] - p[a3 + 2], vx = p[c3] - p[a3], vy = p[c3 + 1] - p[a3 + 1], vz = p[c3 + 2] - p[a3 + 2];
  const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
  if (fx * fx + fy * fy + fz * fz < 1e-14) return;
  const d = fx * (n[a3] + n[b3] + n[c3]) + fy * (n[a3 + 1] + n[b3 + 1] + n[c3 + 1]) + fz * (n[a3 + 2] + n[b3 + 2] + n[c3 + 2]);
  if (o.ni + 3 > o.icap) o.growI();
  if (d >= 0) { o.i[o.ni++] = a; o.i[o.ni++] = b; o.i[o.ni++] = c; } else { o.i[o.ni++] = a; o.i[o.ni++] = c; o.i[o.ni++] = b; }
}
const Q = (a, b, c, d) => { T(a, b, c); T(a, c, d); };
function OQ(a, b, c, d, n) { Q(V(a[0], a[1], a[2], n[0], n[1], n[2]), V(b[0], b[1], b[2], n[0], n[1], n[2]), V(c[0], c[1], c[2], n[0], n[1], n[2]), V(d[0], d[1], d[2], n[0], n[1], n[2])); }
function OT(a, b, c, n) { T(V(a[0], a[1], a[2], n[0], n[1], n[2]), V(b[0], b[1], b[2], n[0], n[1], n[2]), V(c[0], c[1], c[2], n[0], n[1], n[2])); }

const pushM = () => stack.push(M.slice());
const popM = () => { M = stack.pop(); };
function mulM(r) { // M = M * r (r: 3x4)
  const a = M, o = new Array(12);
  for (let i = 0; i < 3; i++) { const k = i * 4; for (let j = 0; j < 3; j++) o[k + j] = a[k] * r[j] + a[k + 1] * r[4 + j] + a[k + 2] * r[8 + j]; o[k + 3] = a[k] * r[3] + a[k + 1] * r[7] + a[k + 2] * r[11] + a[k + 3]; }
  M = o;
}
function xf(tx, ty, tz, rx = 0, ry = 0, rz = 0, fn) {
  pushM(); mulM([1, 0, 0, tx, 0, 1, 0, ty, 0, 0, 1, tz]);
  if (ry) { const c = Math.cos(ry), s = Math.sin(ry); mulM([c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]); }
  if (rx) { const c = Math.cos(rx), s = Math.sin(rx); mulM([1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]); }
  if (rz) { const c = Math.cos(rz), s = Math.sin(rz); mulM([c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]); }
  fn(); popM();
}
function sym(fn) { fn(1); pushM(); mulM([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]); fn(-1); popM(); }

// ---------------------------------------------------------------------------------------------
// Primitives
function box(cx, cy, cz, sx, sy, sz, b = 0) {
  const h = [sx / 2, sy / 2, sz / 2]; b = NOBEVEL || Math.max(sx, sy, sz) < .16 ? 0 : Math.min(b, h[0] * .9, h[1] * .9, h[2] * .9);
  const P = (a, sa, su, sv) => { const u = (a + 1) % 3, v = (a + 2) % 3, o = [0, 0, 0]; o[a] = sa * h[a]; o[u] = su * (h[u] - b); o[v] = sv * (h[v] - b); o[0] += cx; o[1] += cy; o[2] += cz; return o; };
  for (let a = 0; a < 3; a++) for (let s = -1; s <= 1; s += 2) { const n = [0, 0, 0]; n[a] = s; OQ(P(a, s, -1, -1), P(a, s, 1, -1), P(a, s, 1, 1), P(a, s, -1, 1), n); }
  if (b <= 0) return;
  for (let a = 0; a < 3; a++) { const u = (a + 1) % 3;
    for (let sa = -1; sa <= 1; sa += 2) for (let su = -1; su <= 1; su += 2) { const n = [0, 0, 0]; n[a] = sa * .7071; n[u] = su * .7071; OQ(P(a, sa, su, -1), P(a, sa, su, 1), P(u, su, 1, sa), P(u, su, -1, sa), n); } }
  const k = .57735;
  for (let x = -1; x <= 1; x += 2) for (let y = -1; y <= 1; y += 2) for (let z = -1; z <= 1; z += 2) OT(P(0, x, y, z), P(1, y, z, x), P(2, z, x, y), [x * k, y * k, z * k]);
}
function basis(dx, dy, dz) {
  const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  let ux = Math.abs(dy) < .9 ? 0 : 1, uy = Math.abs(dy) < .9 ? 1 : 0, uz = 0;
  let ax = uy * dz - uz * dy, ay = uz * dx - ux * dz, az = ux * dy - uy * dx; const la = Math.hypot(ax, ay, az) || 1; ax /= la; ay /= la; az /= la;
  return [dx, dy, dz, ax, ay, az, dy * az - dz * ay, dz * ax - dx * az, dx * ay - dy * ax];
}
// Surface of revolution. prof = [[radius, height along axis, hard?], ...]; hard = crease at that point.
function lathe(ox, oy, oz, dx, dy, dz, prof, seg, a0 = 0, a1 = TAU) {
  seg = Math.min(seg, MAXSEG);
  const f = basis(dx, dy, dz), n = prof.length, full = Math.abs(a1 - a0 - TAU) < 1e-6;
  const norm = [];
  for (let i = 0; i < n - 1; i++) { const dr = prof[i + 1][0] - prof[i][0], dh = prof[i + 1][1] - prof[i][1], l = Math.hypot(dr, dh) || 1; norm.push([dh / l, -dr / l]); }
  for (let i = 0; i < n - 1; i++) {
    const na = (i > 0 && !prof[i][2]) ? [norm[i][0] + norm[i - 1][0], norm[i][1] + norm[i - 1][1]] : norm[i];
    const nb = (i < n - 2 && !prof[i + 1][2]) ? [norm[i][0] + norm[i + 1][0], norm[i][1] + norm[i + 1][1]] : norm[i];
    const la = Math.hypot(na[0], na[1]) || 1, lb = Math.hypot(nb[0], nb[1]) || 1;
    let prevA = -1, prevB = -1, firstA = -1, firstB = -1;
    for (let j = 0; j <= seg; j++) {
      if (full && j === seg) { Q(prevA, prevB, firstB, firstA); break; }
      const t = lerp(a0, a1, j / seg), c = Math.cos(t), s = Math.sin(t);
      const rx = f[3] * c + f[6] * s, ry = f[4] * c + f[7] * s, rz = f[5] * c + f[8] * s;
      const ra = prof[i][0] < 2e-4 ? 0 : prof[i][0], ha = prof[i][1], rb = prof[i + 1][0] < 2e-4 ? 0 : prof[i + 1][0], hb = prof[i + 1][1];
      const nr = na[0] / la, nh = na[1] / la, mr = nb[0] / lb, mh = nb[1] / lb;
      const A = V(ox + rx * ra + f[0] * ha, oy + ry * ra + f[1] * ha, oz + rz * ra + f[2] * ha, rx * nr + f[0] * nh, ry * nr + f[1] * nh, rz * nr + f[2] * nh);
      const Bb = V(ox + rx * rb + f[0] * hb, oy + ry * rb + f[1] * hb, oz + rz * rb + f[2] * hb, rx * mr + f[0] * mh, ry * mr + f[1] * mh, rz * mr + f[2] * mh);
      if (j) Q(prevA, prevB, Bb, A); else { firstA = A; firstB = Bb; }
      prevA = A; prevB = Bb;
    }
  }
}
function roundBig(fn) { const m = MAXSEG; MAXSEG = 99; fn(); MAXSEG = m; }
function cyl(ax, ay, az, bx, by, bz, r0, r1 = r0, seg = 8, caps = true) {
  const l = Math.hypot(bx - ax, by - ay, bz - az);
  const p = caps ? [[0, 0, 1], [r0, 0, 1], [r1, l, 1], [0, l, 1]] : [[r0, 0], [r1, l]];
  lathe(ax, ay, az, bx - ax, by - ay, bz - az, p, seg);
}
function dome(cx, cy, cz, rx, ry, rz, rings = 4, seg = 8) {
  const id = [];
  for (let j = 0; j <= rings; j++) { const a = -Math.PI / 2 + Math.PI * j / rings, ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i < seg; i++) { const t = TAU * i / seg, x = ca * Math.cos(t), z = ca * Math.sin(t), nx = x / rx, ny = sa / ry, nz = z / rz, l = Math.hypot(nx, ny, nz) || 1; id.push(V(cx + x * rx, cy + sa * ry, cz + z * rz, nx / l, ny / l, nz / l)); } }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const q = (i + 1) % seg; Q(id[j * seg + i], id[j * seg + q], id[(j + 1) * seg + q], id[(j + 1) * seg + i]); }
}
// Round tube along a polyline, parallel transported.
function tube(pts, r, seg = 6, closed = false) {
  const n = pts.length; if (n < 2) return; seg = Math.min(seg, TUBESEG);
  let ring = null, first = null; let [ux, uy, uz] = (() => { const f = basis(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]); return [f[3], f[4], f[5]]; })();
  const count = closed ? n + 1 : n;
  for (let i = 0; i < count; i++) {
    const p = pts[i % n], a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const k = ux * dx + uy * dy + uz * dz; ux -= k * dx; uy -= k * dy; uz -= k * dz; const lu = Math.hypot(ux, uy, uz) || 1; ux /= lu; uy /= lu; uz /= lu;
    const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux, cur = [];
    if (closed && i === n) { for (let j = 0; j < seg; j++) { const q = (j + 1) % seg; Q(ring[j], ring[q], first[q], first[j]); } break; }
    for (let j = 0; j < seg; j++) { const t = TAU * j / seg, c = Math.cos(t), s = Math.sin(t), nx = ux * c + vx * s, ny = uy * c + vy * s, nz = uz * c + vz * s; cur.push(V(p[0] + nx * r, p[1] + ny * r, p[2] + nz * r, nx, ny, nz)); }
    if (ring) for (let j = 0; j < seg; j++) { const q = (j + 1) % seg; Q(ring[j], ring[q], cur[q], cur[j]); } else first = cur;
    ring = cur;
  }
  if (!closed) for (const [e, s] of [[0, -1], [n - 1, 1]]) {
    const a = pts[e], b = pts[e === 0 ? 1 : n - 2], d = [(a[0] - b[0]), (a[1] - b[1]), (a[2] - b[2])], l = Math.hypot(d[0], d[1], d[2]) || 1, f = basis(d[0] / l, d[1] / l, d[2] / l), c = V(a[0], a[1], a[2], d[0] / l, d[1] / l, d[2] / l), o = [];
    for (let j = 0; j < seg; j++) { const t = TAU * j / seg, x = Math.cos(t) * r, y = Math.sin(t) * r; o.push(V(a[0] + f[3] * x + f[6] * y, a[1] + f[4] * x + f[7] * y, a[2] + f[5] * x + f[8] * y, d[0] / l, d[1] / l, d[2] / l)); }
    for (let j = 0; j < seg; j++) T(c, o[j], o[(j + 1) % seg]);
  }
}
const arc = (cx, cy, r, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; };
// Rounds the corners of a closed 2D polygon. r: number or per-point array.
function roundPoly(pts, r, n = 3) {
  const out = [], m = pts.length;
  for (let i = 0; i < m; i++) {
    const p = pts[i], a = pts[(i - 1 + m) % m], b = pts[(i + 1) % m], rad = Array.isArray(r) ? r[i] : r;
    if (!rad) { out.push([p[0], p[1]]); continue; }
    let ax = a[0] - p[0], ay = a[1] - p[1], bx = b[0] - p[0], by = b[1] - p[1]; const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by); ax /= la; ay /= la; bx /= lb; by /= lb;
    const d = Math.min(rad, la * .48, lb * .48);
    for (let j = 0; j <= n; j++) { const t = j / n, q0x = p[0] + ax * d, q0y = p[1] + ay * d, q2x = p[0] + bx * d, q2y = p[1] + by * d, s = 1 - t; out.push([s * s * q0x + 2 * s * t * p[0] + t * t * q2x, s * s * q0y + 2 * s * t * p[1] + t * t * q2y]); }
  }
  return out;
}
// Extrudes a (z, y) profile along X between x0 and x1, chamfered, smooth along soft corners.
function extrudeX(prof, x0, x1, bevel = .012, hardAngle = .6) {
  let pts = prof.slice(); let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  if (area < 0) pts = pts.reverse();
  const n = pts.length, en = []; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1; en.push([dy / l, -dz / l]); }
  const vn = (i, e) => { const p = en[(i - 1 + n) % n], q = en[i], dot = p[0] * q[0] + p[1] * q[1]; if (dot < Math.cos(hardAngle)) return e; const x = p[0] + q[0], y = p[1] + q[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const X0 = Math.min(x0, x1) + bevel, X1 = Math.max(x0, x1) - bevel;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, a = pts[i], b = pts[j], na = vn(i, en[i]), nb = vn(j, en[i]);
    Q(V(X0, a[1], a[0], 0, na[1], na[0]), V(X1, a[1], a[0], 0, na[1], na[0]), V(X1, b[1], b[0], 0, nb[1], nb[0]), V(X0, b[1], b[0], 0, nb[1], nb[0])); }
  const inner = pts.map((p, i) => { const q = vn(i, en[i]); return [p[0] - q[0] * bevel, p[1] - q[1] * bevel]; });
  const tris = THREE.ShapeUtils.triangulateShape(inner.map(p => new THREE.Vector2(p[0], p[1])), []);
  for (const [s, x, xo] of [[1, X1 + bevel, X1], [-1, X0 - bevel, X0]]) {
    const idx = inner.map(p => V(x, p[1], p[0], s, 0, 0)); for (const t of tris) T(idx[t[0]], idx[t[1]], idx[t[2]]);
    if (bevel > 0) for (let i = 0; i < n; i++) { const j = (i + 1) % n, a = pts[i], b = pts[j], c = inner[i], d = inner[j], e = en[i], k = .7071;
      Q(V(xo, a[1], a[0], s * k, e[1] * k, e[0] * k), V(xo, b[1], b[0], s * k, e[1] * k, e[0] * k), V(x, d[1], d[0], s * k, e[1] * k, e[0] * k), V(x, c[1], c[0], s * k, e[1] * k, e[0] * k)); }
  }
}
// Parametric grid: fn(u, v, out) -> xyz; normals by central differences.
function gridSurf(nu, nv, fn, wrapU = false, ref = null, towards = false) {
  const nc = wrapU ? nu : nu + 1, idx = new Int32Array(nc * (nv + 1)), a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], d = [0, 0, 0], p = [0, 0, 0], e = 1e-3;
  for (let j = 0; j <= nv; j++) for (let i = 0; i < nc; i++) {
    const u = i / nu, v = j / nv; fn(u, v, p);
    fn(wrapU ? u + e : Math.min(1, u + e), v, a); fn(wrapU ? u - e : Math.max(0, u - e), v, b); fn(u, Math.min(1, v + e), c); fn(u, Math.max(0, v - e), d);
    const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (ref) { const k = nx * (p[0] - ref[0]) + ny * (p[1] - ref[1]) + nz * (p[2] - ref[2]); if ((k < 0) !== towards) { nx = -nx; ny = -ny; nz = -nz; } }
    idx[j * nc + i] = V(p[0], p[1], p[2], nx, ny, nz);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const q = wrapU ? (i + 1) % nc : i + 1; Q(idx[j * nc + i], idx[j * nc + q], idx[(j + 1) * nc + q], idx[(j + 1) * nc + i]); }
}

// ---------------------------------------------------------------------------------------------
// Hull: a body lofted through cross-sections along Z. A half-section is a spline through K knots,
// from the sill (t = 0) up the side and over to the centreline (t = K-1). Openings (windows, wheel
// arches, door gaps, load beds) are holes in the (z, t) domain, so they follow the curved surface.
class Hull {
  constructor(o) {
    this.o = o; this.K = o.K || 7; this.sec = o.sec; this.z0 = o.z0; this.z1 = o.z1; this.lod = o.lod || 0;
    this.cr = new Uint8Array(this.K); (o.creases || [3]).forEach(k => { this.cr[k] = 1; });
    this.holes = []; this.flares = []; this.keys = []; this.zHard = []; this.dent = o.dent || null; this.disp = o.disp || null;
    this.tmp = new Float64Array(this.K * 2); this.x = 0; this.y = 0;
    const per = this.lod === 0 ? (o.tPer || 2) : 1, tl = [];
    for (let k = 0; k < this.K - 1; k++) { if (k > 0 && ((this.lod === 2 && (o.skipKnots || [1, 2]).includes(k)) || (this.lod === 1 && (o.skipKnots1 || [1]).includes(k)))) continue; for (let j = 0; j < per; j++) tl.push(k + j / per); }
    tl.push(this.K - 1); this.tLines = tl;
  }
  ev(c, t, z) {
    const K = this.K, cr = this.cr; let k = t | 0; if (k >= K - 1) k = K - 2; if (k < 0) k = 0; const f = t - k, i = k * 2;
    const x0 = c[i], y0 = c[i + 1], x1 = c[i + 2], y1 = c[i + 3]; let a, b, d, e;
    if (k === 0 || cr[k]) { a = x1 - x0; b = y1 - y0; } else { a = (x1 - c[i - 2]) * .5; b = (y1 - c[i - 1]) * .5; }
    if (k + 1 === K - 1) { d = x1 - x0; e = 0; } else if (cr[k + 1]) { d = x1 - x0; e = y1 - y0; } else { d = (c[i + 4] - x0) * .5; e = (c[i + 5] - y0) * .5; }
    const f2 = f * f, f3 = f2 * f, h0 = 2 * f3 - 3 * f2 + 1, h1 = f3 - 2 * f2 + f, h2 = -2 * f3 + 3 * f2, h3 = f3 - f2;
    let x = h0 * x0 + h1 * a + h2 * x1 + h3 * d, y = h0 * y0 + h1 * b + h2 * y1 + h3 * e;
    for (let n = 0; n < this.flares.length; n++) { const q = this.flares[n], dz = z - q.z; if (dz > q.R + .3 || dz < -q.R - .3) continue; const r = Math.hypot(dz, y - q.y); if (r > q.R - .05 && r < q.R + q.w * 2.6) { const g = (r - q.R - q.w * .35) / q.w; x += q.a * Math.exp(-g * g) * sat(x / .3); } }
    if (this.disp) x += this.disp(x, y, z, t);
    if (this.dent) { const dn = this.dent(x, y, z); x -= dn * sat(x / .4); y -= dn * .45 * smooth(.3, 1.4, y); }
    this.x = x < 0 ? 0 : x; this.y = y;
  }
  addKey(z) { if (z > this.z0 && z < this.z1) this.keys.push(z); }
  // LOD2 glass: one dark polygon laid on the surface per window.
  decal(pts, col, light = col) {
    use(this.lod === 2 ? TRIM : CHROME, col, 1); const m = pts.length, q = m > 4 ? [pts[0], pts[m >> 2], pts[m >> 1], pts[(m * 3) >> 2]] : pts, c0 = lin(col), c1 = lin(light);
    let t0 = 1e9, t1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of q) { t0 = Math.min(t0, p[1]); t1 = Math.max(t1, p[1]); z0 = Math.min(z0, p[0]); z1 = Math.max(z1, p[0]); }
    const off = t1 > this.K - 1.7 ? .03 : .02, rowT = [t0, ...this.tLines.filter(x => x > t0 + .05 && x < t1 - .05), t1], nv = rowT.length - 1, cols = [0]; if (!this.o.flatGlass) for (const s of this.zs) if (s > z0 + .05 && s < z1 - .05) cols.push((s - z0) / (z1 - z0)); cols.push(1); const nu = cols.length - 1, id = [];
    for (let j = 0; j <= nv; j++) { const k = (rowT[j] - t0) / Math.max(1e-5, t1 - t0), g = k * k; cR = lerp(c0[0], c1[0], g); cG = lerp(c0[1], c1[1], g); cB = lerp(c0[2], c1[2], g);
      for (let i = 0; i <= nu; i++) { const e = cols[i], az = lerp(q[0][0], q[1][0], e), at = lerp(q[0][1], q[1][1], e), cz = lerp(q[3][0], q[2][0], e), ct = lerp(q[3][1], q[2][1], e), zz = lerp(az, cz, k), tt = lerp(at, ct, k), f = this.frame(zz, tt), o = this.pl(zz, tt); id.push(V(o[0] + f.n[0] * off, o[1] + f.n[1] * off, o[2] + f.n[2] * off, f.n[0], f.n[1], f.n[2])); } }
    const w = nu + 1; for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = id[j * w + i], e = id[j * w + i + 1], c = id[(j + 1) * w + i + 1], d = id[(j + 1) * w + i]; T(a, e, d); T(e, c, d); }
  }
  // Point on the coarse hull as actually tessellated (bilinear between stations and rows).
  pl(z, t) {
    const zs = this.zs, T = this.tLines; let i = 0; while (i < this.N - 2 && zs[i + 1] < z) i++;
    const kz = sat((z - zs[i]) / Math.max(1e-6, zs[i + 1] - zs[i])); let a = T[0], b = T[T.length - 1]; for (const x of T) { if (x <= t) a = x; if (x >= t) { b = x; break; } }
    const kt = b > a ? (t - a) / (b - a) : 0, P = s => { this.ev(this.ctrl[s], a, zs[s]); const x0 = this.x, y0 = this.y; this.ev(this.ctrl[s], b, zs[s]); return [lerp(x0, this.x, kt), lerp(y0, this.y, kt)]; }, A = P(i), B = P(i + 1);
    return [lerp(A[0], B[0], kz), lerp(A[1], B[1], kz), z];
  }
  // First z (from the nose backwards) where point (x, y) is inside the body.
  noseZ(x, y) {
    const c = this.tmp, K = this.K;
    for (let z = this.z1; z > this.z1 - 1.2; z -= .02) { this.sec(z, c); let wAt = -1, py = -1e9, px = 0; for (let i = 0; i <= (K - 1) * 3; i++) { this.ev(c, i / 3, z); if (i && (py - y) * (this.y - y) <= 0) { const k = (y - py) / ((this.y - py) || 1); wAt = Math.max(wAt, lerp(px, this.x, sat(k))); } px = this.x; py = this.y; } if (wAt >= x) return z; }
    return this.z1;
  }
  lampOn(x, y, w, h, col) {
    if (Math.abs(w - h) < .03) { const z = this.noseZ(Math.max(0, Math.abs(x) - w * .45), y) + .012, R0 = w * .62, n = 12; use(TRIM, 0x121315); const a = [], c = [];
      for (let i = 0; i < n; i++) { const t = TAU * i / n, cx = Math.cos(t), sy = Math.sin(t); a.push(V(x + cx * R0, y + sy * R0, z - .14, cx, sy, 0)); c.push(V(x + cx * R0, y + sy * R0, z, cx, sy, 0)); }
      for (let i = 0; i < n; i++) Q(a[i], a[(i + 1) % n], c[(i + 1) % n], c[i]);
      const rim = V(x, y, z, 0, 0, 1), rr = []; for (let i = 0; i < n; i++) { const t = TAU * i / n; rr.push(V(x + Math.cos(t) * R0, y + Math.sin(t) * R0, z, 0, 0, 1)); } for (let i = 0; i < n; i++) T(rim, rr[i], rr[(i + 1) % n]);
      use(LAMP, col); const m = V(x, y, z + .006, 0, 0, 1), l = []; for (let i = 0; i < n; i++) { const t = TAU * i / n; l.push(V(x + Math.cos(t) * w * .47, y + Math.sin(t) * w * .47, z + .006, 0, 0, 1)); } for (let i = 0; i < n; i++) T(m, l[i], l[(i + 1) % n]); return; }
    const x0 = x - w / 2, x1 = x + w / 2, zi = this.noseZ(Math.max(0, x0), y), zo = this.noseZ(x1, y), dz = zo - zi, l = Math.hypot(w, dz), n = [-dz / l, 0, w / l], P = (q, yy, o) => [lerp(x0, x1, q) + n[0] * o, yy, lerp(zi, zo, q) + n[2] * o];
    use(TRIM, 0x0d0e10); OQ(P(-.07, y - h * .68, .045), P(1.07, y - h * .68, .045), P(1.07, y + h * .68, .045), P(-.07, y + h * .68, .045), n); use(LAMP, 0xdfeaf2); OQ(P(.02, y - h * .46, .053), P(.72, y - h * .46, .053), P(.72, y + h * .46, .053), P(.02, y + h * .46, .053), n); use(LAMP, 0xffa02a); OQ(P(.78, y - h * .4, .053), P(.98, y - h * .4, .053), P(.98, y + h * .4, .053), P(.78, y + h * .4, .053), n); void col; }
  // Raised strip that follows the surface at constant t: rub rails and body mouldings.
  rail(z0, z1, t, h, d, col, mat = TRIM) {
    use(mat, col, .92); const n = Math.max(1, Math.ceil((z1 - z0) / (this.lod === 0 ? .7 : 2))); let prev = null;
    for (let i = 0; i <= n; i++) { const f = this.frame(lerp(z0, z1, i / n), t), P = (a, b) => [f.p[0] + f.n[0] * a + f.y[0] * b, f.p[1] + f.n[1] * a + f.y[1] * b, f.p[2] + f.n[2] * a + f.y[2] * b], cur = [P(-.004, -h / 2), P(d, -h * .34), P(d, h * .34), P(-.004, h / 2)], un = [f.n[0] * .4 - f.y[0], f.n[1] * .4 - f.y[1], f.n[2] * .4 - f.y[2]], up = [f.n[0] * .4 + f.y[0], f.n[1] * .4 + f.y[1], f.n[2] * .4 + f.y[2]];
      if (prev) { OQ(prev[0], cur[0], cur[1], prev[1], un); OQ(prev[1], cur[1], cur[2], prev[2], f.n); OQ(prev[2], cur[2], cur[3], prev[3], up); } prev = cur; }
  }
  // Convex polygon opening given as [z, t] points.
  hole(pts, opt = {}) {
    if ((this.lod >= 1 && (opt.kind || 'window') === 'window') || (this.lod === 2 && opt.kind === 'deep')) { if (Math.max(...pts.map(p => p[1])) > this.K - 1.7) { const zz = pts.map(p => p[0]); this.addKey(Math.min(...zz)); this.addKey(Math.max(...zz)); }
      (this.decals = this.decals || []).push({ pts, side: opt.side || 0, deep: opt.kind === 'deep' }); return { pts, s0: -1, s1: -1, loA: [], hiA: [] }; }
    let zmin = 1e9, zmax = -1e9; for (const p of pts) { zmin = Math.min(zmin, p[0]); zmax = Math.max(zmax, p[0]); this.addKey(p[0]); }
    const h = { pts, z0: zmin, z1: zmax, kind: opt.kind || 'window', depth: opt.depth ?? .03, glass: opt.glass ?? true, fillCol: opt.fillCol, lo: null, hi: null, ...opt };
    this.holes.push(h); return h;
  }
  // Rectangle in (z, t), with rake (shift of the top corners) and optional rounded corners.
  win(z0, z1, t0, t1, opt = {}) {
    const rf = opt.rakeF || 0, rr = opt.rakeR || 0, r = this.lod === 0 ? (opt.r ?? .05) : 0;
    let pts = [[z0, t0], [z1, t0], [z1 - rr, t1], [z0 + rf, t1]];
    if (r > 0) { const ts = .32, q = roundPoly(pts.map(p => [p[0], p[1] * ts]), r, 2); pts = q.map(p => [p[0], p[1] / ts]); }
    return this.hole(pts, opt);
  }
  arch(cz, cy, R, opt = {}) {
    const n = this.lod === 0 ? 14 : this.lod === 1 ? 6 : 5;
    for (let i = 0; i <= n; i++) this.addKey(cz - R * Math.cos(Math.PI * i / n));
    const h = { kind: 'arch', z0: cz - R, z1: cz + R, cz, cy, R, depth: opt.depth ?? .46, glass: false, lo: null, hi: null };
    this.holes.push(h);
    if (opt.flare !== 0 && this.lod < 2) this.flares.push({ z: cz, y: cy, R, a: opt.flare ?? .035, w: opt.lipW ?? .075 });
    return h;
  }
  build() {
    const o = this.o, n = this.lod === 0 ? (o.nz || 22) : this.lod === 1 ? (o.nz1 || 8) : (o.nz2 || 3), zs = [];
    for (let i = 0; i <= n; i++) { const k = i / n, b = k + (o.endBunch ?? .1) * Math.sin(k * TAU) * -1 / TAU * 2.2; zs.push(lerp(this.z0, this.z1, sat(b))); }
    for (const k of (o.keys || [])) this.addKey(k);
    if (this.lod > 0) this.profileKeys(this.lod === 1 ? 6 : 3);
    zs.push(...this.keys); zs.sort((a, b) => a - b);
    const u = [zs[0]]; for (const z of zs) { if (z - u[u.length - 1] > (this.lod === 0 ? .006 : .03)) u.push(z); } if (this.z1 - u[u.length - 1] > 1e-4) u.push(this.z1); else u[u.length - 1] = this.z1;
    // Snap back any key the dedupe moved: hole ends must sit exactly on a station.
    for (const k of this.keys) { let best = 0, d = 1e9; for (let i = 0; i < u.length; i++) { const e = Math.abs(u[i] - k); if (e < d) { d = e; best = i; } } if (d < .03 && best > 0 && best < u.length - 1) u[best] = k; }
    this.zs = u; const N = u.length; this.N = N; this.ctrl = [];
    for (let i = 0; i < N; i++) { const c = new Float64Array(this.K * 2); this.sec(u[i], c); this.ctrl.push(c); }
    this.hard = new Uint8Array(N); for (const z of (o.zCrease || [])) { let b = 0, d = 1e9; for (let i = 0; i < N; i++) { const e = Math.abs(u[i] - z); if (e < d) { d = e; b = i; } } this.hard[b] = 1; }
    for (const h of this.holes) {
      h.loA = new Float64Array(N); h.hiA = new Float64Array(N); h.s0 = -1; h.s1 = -1;
      for (let i = 0; i < N; i++) { const z = u[i]; if (z < h.z0 - 1e-4 || z > h.z1 + 1e-4) continue; if (h.s0 < 0) h.s0 = i; h.s1 = i;
        if (h.kind === 'arch') { const dz = z - h.cz, ya = h.cy + Math.sqrt(Math.max(0, h.R * h.R - dz * dz)); h.loA[i] = 0; h.hiA[i] = this.tAtY(i, ya); }
        else { let lo = 1e9, hi = -1e9; const P = h.pts, m = P.length; for (let e = 0; e < m; e++) { const a = P[e], b = P[(e + 1) % m], A = Math.min(a[0], b[0]) - 1e-5, Bz = Math.max(a[0], b[0]) + 1e-5; if (z < A || z > Bz) continue; if (Math.abs(b[0] - a[0]) < 1e-5) { lo = Math.min(lo, a[1], b[1]); hi = Math.max(hi, a[1], b[1]); } else { const t = lerp(a[1], b[1], sat((z - a[0]) / (b[0] - a[0]))); lo = Math.min(lo, t); hi = Math.max(hi, t); } } h.loA[i] = lo < 1e8 ? lo : 0; h.hiA[i] = hi > -1e8 ? hi : 0; }
      }
    }
    return this;
  }
  profileKeys(count) {
    const S = 64, ys = new Float64Array(S + 1), c = this.tmp, K = this.K, dz = (this.z1 - this.z0) / S;
    for (let i = 0; i <= S; i++) { this.sec(this.z0 + i * dz, c); ys[i] = c[K * 2 - 1] + c[6] * .5; }
    const bend = []; for (let i = 1; i < S; i++) bend.push([Math.abs(ys[i + 1] - 2 * ys[i] + ys[i - 1]), i]); bend.sort((a, b) => b[0] - a[0]);
    const used = []; for (const [v, i] of bend) { if (used.length >= count || v < 1e-4) break; if (used.every(u => Math.abs(u - i) > 1)) { used.push(i); this.addKey(this.z0 + i * dz); } }
  }
  tAtY(i, y) { let a = 0, b = Math.min(3, this.K - 1); const c = this.ctrl[i], z = this.zs[i]; for (let n = 0; n < 16; n++) { const m = (a + b) * .5; this.ev(c, m, z); if (this.y < y) a = m; else b = m; } return (a + b) * .5; }
  // Vertex at station i, parameter t; [ta, tb] bounds the smoothing band so creases stay hard.
  vtx(i, ci, t, ta, tb, inset, flip) {
    const c = this.ctrl[i], z = this.zs[i], zs = this.zs; this.ev(c, t, z); const px = this.x, py = this.y;
    this.ev(c, Math.max(ta, t - .025), z); const x0 = this.x, y0 = this.y; this.ev(c, Math.min(tb, t + .025), z); const tx = this.x - x0, ty = this.y - y0;
    let a = i - 1, b = i + 1; if (this.hard[i]) { if (i === ci) a = i; else b = i; } if (a < 0) a = 0; if (b >= this.N) b = this.N - 1;
    this.ev(this.ctrl[a], t, zs[a]); const xa = this.x, ya = this.y, za = zs[a]; this.ev(this.ctrl[b], t, zs[b]);
    const zx = this.x - xa, zy = this.y - ya, zz = zs[b] - za;
    let nx = ty * zz, ny = -tx * zz, nz = tx * zy - ty * zx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (t >= this.K - 1 - 1e-5) { nx = 0; const m = Math.hypot(ny, nz) || 1; ny /= m; nz /= m; }
    const X = px - nx * inset, Y = py - ny * inset, Z = z - nz * inset, s = flip ? -1 : 1;
    return V(X, Y, Z, nx * s, ny * s, nz * s, Z * .32, t * .42);
  }
  rows(a, b) { const out = [a]; for (const t of this.tLines) if (t > a + .012 && t < b - .012) out.push(t); if (b > a + 1e-5) out.push(b); return out; }
  band(ci, l0, l1, r0, r1, inset, flip) {
    const Ls = this.rows(l0, l1), Rs = this.rows(r0, r1), ia = Ls.map(t => this.vtx(ci, ci, t, l0, l1, inset, flip)), ib = Rs.map(t => this.vtx(ci + 1, ci, t, r0, r1, inset, flip));
    let a = 0, b = 0; const na = Ls.length - 1, nb = Rs.length - 1, dl = Math.max(1e-6, l1 - l0), dr = Math.max(1e-6, r1 - r0);
    while (a < na || b < nb) { const fa = a < na ? (Ls[a + 1] - l0) / dl : 2, fb = b < nb ? (Rs[b + 1] - r0) / dr : 2; if (fa <= fb) { T(ia[a], ib[b], ia[a + 1]); a++; } else { T(ia[a], ib[b], ib[b + 1]); b++; } }
  }
  shell(o = {}) {
    const { inset = 0, flip = false, z0 = -1e9, z1 = 1e9, solid = false } = o, top = this.K - 1;
    for (let c = 0; c < this.N - 1; c++) {
      const za = this.zs[c], zb = this.zs[c + 1]; if (zb <= z0 || za >= z1) continue;
      const act = solid ? [] : this.holes.filter(h => h.s0 >= 0 && h.s0 <= c && h.s1 >= c + 1 && (!h.side || h.side === this.side)).map(h => [h.loA[c], h.hiA[c], h.loA[c + 1], h.hiA[c + 1]]).sort((p, q) => (p[0] + p[2]) - (q[0] + q[2]));
      let l = 0, r = 0;
      const solidBand = (l1, r1) => {
        if (l1 - l < 1e-4 && r1 - r < 1e-4) return;
        let sl = l, sr = r;
        for (let k = 1; k < top; k++) if (this.cr[k] && (this.lod === 0 || this.tLines.includes(k)) && k > Math.max(sl, sr) + .01 && k < Math.min(l1, r1) - .01) { this.band(c, sl, k, sr, k, inset, flip); sl = k; sr = k; }
        this.band(c, sl, l1, sr, r1, inset, flip);
      };
      for (const h of act) { solidBand(Math.max(l, h[0]), Math.max(r, h[2])); l = Math.max(l, h[1]); r = Math.max(r, h[3]); }
      solidBand(top, top);
    }
  }
  pt(i, t) { this.ev(this.ctrl[i], t, this.zs[i]); return [this.x, this.y, this.zs[i]]; }
  // Normal at a table station (t kept inside [ta, tb]).
  nAt(i, t) { const c = this.ctrl[i]; this.ev(c, Math.max(0, t - .03), this.zs[i]); const x0 = this.x, y0 = this.y; this.ev(c, Math.min(this.K - 1, t + .03), this.zs[i]); const tx = this.x - x0, ty = this.y - y0, a = Math.max(0, i - 1), b = Math.min(this.N - 1, i + 1); this.ev(this.ctrl[a], t, this.zs[a]); const xa = this.x, ya = this.y; this.ev(this.ctrl[b], t, this.zs[b]); const zx = this.x - xa, zy = this.y - ya, zz = this.zs[b] - this.zs[a]; const nx = ty * zz, ny = -tx * zz, nz = tx * zy - ty * zx, l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l]; }
  // Inner walls of an opening: gives windows a real rebate and wheel wells real depth.
  reveal(h, col, ao = .6) {
    if (h.s0 < 0) return; use(TRIM, col, ao); const chain = [], top = this.K - 1 - 1e-4;
    if (h.kind !== 'arch') for (let i = h.s0; i <= h.s1; i++) chain.push([i, h.loA[i]]);
    for (let i = h.s1; i >= h.s0; i--) chain.push([i, h.hiA[i]]);
    const closed = h.kind !== 'arch', count = closed ? chain.length : chain.length - 1;
    let cx = 0, cy = 0, cz = 0; const ring = chain.map(([i, t]) => { const p = this.pt(i, t), n = h.kind === 'arch' ? [1, 0, 0] : this.nAt(i, t); cx += p[0]; cy += p[1]; cz += p[2]; return { p, q: [p[0] - n[0] * h.depth, p[1] - n[1] * h.depth, p[2] - n[2] * h.depth], t }; });
    cx /= ring.length; cy /= ring.length; cz /= ring.length;
    for (let i = 0; i < count; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length]; if (a.t >= top && b.t >= top) continue;
      const ex = b.p[0] - a.p[0], ey = b.p[1] - a.p[1], ez = b.p[2] - a.p[2], fx = a.q[0] - a.p[0], fy = a.q[1] - a.p[1], fz = a.q[2] - a.p[2];
      let nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx; const l = Math.hypot(nx, ny, nz); if (l < 1e-9) continue; nx /= l; ny /= l; nz /= l;
      if (nx * (cx - a.p[0]) + ny * (cy - a.p[1]) + nz * (cz - a.p[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      Q(V(a.p[0], a.p[1], a.p[2], nx, ny, nz), V(b.p[0], b.p[1], b.p[2], nx, ny, nz), V(b.q[0], b.q[1], b.q[2], nx, ny, nz), V(a.q[0], a.q[1], a.q[2], nx, ny, nz));
    }
    if (h.kind === 'arch') { // back plate of the wheel well
      let xm = 1e9; for (const r of ring) xm = Math.min(xm, r.q[0]); const c = V(xm, h.cy - h.R * .15, h.cz, 1, 0, 0), id = ring.map(r => V(xm, r.q[1], r.q[2], 1, 0, 0));
      for (let i = 0; i < id.length - 1; i++) T(c, id[i], id[i + 1]);
    }
  }
  fill(h, inset, flip = false) { for (let c = h.s0; c < h.s1; c++) this.band(c, h.loA[c], h.hiA[c], h.loA[c + 1], h.hiA[c + 1], inset, flip); }
  floor(col) {
    use(TRIM, col, .4);
    if (this.lod === 2) { const near = f => { const z = lerp(this.z0, this.z1, f); let b = 0, d = 1e9; for (let i = 0; i < this.N; i++) { const e = Math.abs(this.zs[i] - z); if (e < d) { d = e; b = i; } } return b; }, ids = [0, near(.1), near(.9), this.N - 1]; for (let k = 0; k < 3; k++) { const i = ids[k], j = ids[k + 1]; if (i === j) continue; const a = this.ctrl[i], e = this.ctrl[j]; Q(V(0, a[1], this.zs[i], 0, -1, 0), V(a[0], a[1], this.zs[i], 0, -1, 0), V(e[0], e[1], this.zs[j], 0, -1, 0), V(0, e[1], this.zs[j], 0, -1, 0)); } return; }
    for (let c = 0; c < this.N - 1; c++) {
      const out = (i) => { let x = this.ctrl[i][0]; for (const h of this.holes) if (h.kind === 'arch' && this.zs[i] >= h.z0 - .001 && this.zs[i] <= h.z1 + .001) x = Math.min(x, this.ctrl[i][0] - h.depth); return x; };
      const a = out(c), b = out(c + 1), ya = this.ctrl[c][1], yb = this.ctrl[c + 1][1];
      Q(V(0, ya, this.zs[c], 0, -1, 0), V(a, ya, this.zs[c], 0, -1, 0), V(b, yb, this.zs[c + 1], 0, -1, 0), V(0, yb, this.zs[c + 1], 0, -1, 0));
    }
  }
  cap(end, col, mat = PAINT, ao = 1) {
    const i = end > 0 ? this.N - 1 : 0, ts = this.rows(0, this.K - 1); let ym = 0; const pts = ts.map(t => { const p = this.pt(i, t); ym += p[1]; return p; }); ym /= pts.length;
    use(mat, col, ao); const z = this.zs[i], c = V(0, ym, z, 0, 0, end), id = pts.map(p => V(p[0], p[1], p[2], 0, 0, end)), s = V(0, pts[0][1], z, 0, 0, end);
    T(c, s, id[0]); for (let k = 0; k < id.length - 1; k++) T(c, id[k], id[k + 1]);
  }
  // Frame on the surface at (z, t): local X = outward normal, Y = up the section, Z = along the body.
  frame(z, t) {
    const c = this.tmp, d = .015; const P = (zz, tt) => { this.sec(zz, c); this.ev(c, tt, zz); return [this.x, this.y, zz]; };
    const p = P(z, t), a = P(z - d, t), b = P(z + d, t), e = P(z, Math.max(0, t - .03)), f = P(z, Math.min(this.K - 1, t + .03));
    const zv = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], yv = [f[0] - e[0], f[1] - e[1], 0];
    let n = [yv[1] * zv[2] - yv[2] * zv[1], yv[2] * zv[0] - yv[0] * zv[2], yv[0] * zv[1] - yv[1] * zv[0]]; let l = Math.hypot(...n) || 1; n = n.map(v => v / l);
    l = Math.hypot(...yv) || 1; const y = yv.map(v => v / l), zz = [n[1] * y[2] - n[2] * y[1], n[2] * y[0] - n[0] * y[2], n[0] * y[1] - n[1] * y[0]];
    return { p, n, y, z: zz };
  }
  on(z, t, off, fn) { const f = this.frame(z, t); pushM(); mulM([f.n[0], f.y[0], f.z[0], f.p[0] + f.n[0] * off, f.n[1], f.y[1], f.z[1], f.p[1] + f.n[1] * off, f.n[2], f.y[2], f.z[2], f.p[2] + f.n[2] * off]); fn(f); popM(); }
  // Thin dark ribbon that follows the surface: door seams and panel lines.
  seam(pts, w = .009, col = 0x0b0c0d) {
    if (this.lod > 0) return; use(TRIM, col, .75); const o = this.o.seamOff ?? .0035, sub = this.o.seamSub ?? 4; let pa = -1, pb = -1;
    for (let s = 0; s < pts.length - 1; s++) for (let j = (s ? 1 : 0); j <= sub; j++) {
      const k = j / sub, z = lerp(pts[s][0], pts[s + 1][0], k), t = lerp(pts[s][1], pts[s + 1][1], k), f = this.frame(z, t);
      const dz = pts[s + 1][0] - pts[s][0], dt = pts[s + 1][1] - pts[s][1], tang = [f.z[0] * dz + f.y[0] * dt * .4, f.z[1] * dz + f.y[1] * dt * .4, f.z[2] * dz + f.y[2] * dt * .4];
      let bx = f.n[1] * tang[2] - f.n[2] * tang[1], by = f.n[2] * tang[0] - f.n[0] * tang[2], bz = f.n[0] * tang[1] - f.n[1] * tang[0]; const l = Math.hypot(bx, by, bz) || 1; bx *= w / l * .5; by *= w / l * .5; bz *= w / l * .5;
      const cx = f.p[0] + f.n[0] * o, cy = f.p[1] + f.n[1] * o, cz = f.p[2] + f.n[2] * o;
      const a = V(cx + bx, cy + by, cz + bz, f.n[0], f.n[1], f.n[2]), b = V(cx - bx, cy - by, cz - bz, f.n[0], f.n[1], f.n[2]);
      if (pa >= 0) Q(pa, pb, b, a); pa = a; pb = b;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Shared materials and tiny shared textures. Colour lives in vertex colours, so every vehicle shares them.
const PALETTE = {
  olive: 0x4c5433, woodland: 0x4e5636, desert: 0xa8926a, winter: 0xc6cac8, sand: 0xb49d74, graphite: 0x33363a, white: 0xd8d8d2, red: 0x8e2a22,
  blue: 0x2a4a72, green: 0x2f5a44, yellow: 0xd09a1e, orange: 0xc7601e, cream: 0xcfc4a4, silver: 0x8d9296, black: 0x17181a, teal: 0x2b6a6c,
};
const CAMO = { woodland: [0x56603a, 0x2f3a24, 0x5e4a30, 0x17190f], desert: [0xb39c72, 0x8f7650, 0xcbb791, 0x6e5a3e], winter: [0xd2d6d4, 0xa9aeae, 0xe4e6e4, 0x74797a] };
let MATS = null; const camoMats = new Map();
function grainTexture() {
  const n = 64, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 234 + (hash3(x, y, 5) * 21 | 0), k = (y * n + x) * 4; d[k] = v; d[k + 1] = v; d[k + 2] = v; d[k + 3] = 255; }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
}
function periodicNoise(x, y, per, salt) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), w = (a, b) => hash3(((a % per) + per) % per, ((b % per) + per) % per, salt);
  return lerp(lerp(w(xi, yi), w(xi + 1, yi), sx), lerp(w(xi, yi + 1), w(xi + 1, yi + 1), sx), sy);
}
function camoTexture(name) {
  const n = 128, d = new Uint8Array(n * n * 4), pal = CAMO[name].map(h => [h >> 16 & 255, h >> 8 & 255, h & 255]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n, v = y / n, a = periodicNoise(u * 4, v * 4, 4, 1) * .68 + periodicNoise(u * 11, v * 11, 11, 2) * .32, b = periodicNoise(u * 5, v * 5, 5, 3) * .68 + periodicNoise(u * 13, v * 13, 13, 4) * .32;
    const c = pal[b > .62 ? 3 : a > .56 ? 1 : a < .4 ? 2 : 0], k = (y * n + x) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
  }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
}
function getMaterials() {
  if (MATS) return MATS;
  const grain = grainTexture(), std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
  MATS = [
    std({ name: 'veh-paint', metalness: .32, roughness: .5, roughnessMap: grain }),
    std({ name: 'veh-trim', metalness: .12, roughness: .78, roughnessMap: grain, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    std({ name: 'veh-rubber', metalness: 0, roughness: .94 }),
    std({ name: 'veh-chrome', metalness: .95, roughness: .24, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    new THREE.MeshStandardMaterial({ name: 'veh-glass', color: 0x2a3a40, metalness: .5, roughness: .06, transparent: true, opacity: .34, depthWrite: false }),
    std({ name: 'veh-canvas', metalness: 0, roughness: .96, roughnessMap: grain, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    std({ name: 'veh-lamp', metalness: .15, roughness: .16, emissive: 0x201c14, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  ];
  return MATS;
}
function materialsFor(paintKey) {
  const base = getMaterials(); if (!CAMO[paintKey]) return base;
  if (!camoMats.has(paintKey)) { const m = base[PAINT].clone(); m.name = 'veh-camo-' + paintKey; m.map = camoTexture(paintKey); m.metalness = .12; m.roughness = .72; camoMats.set(paintKey, m); }
  const out = base.slice(); out[PAINT] = camoMats.get(paintKey); return out;
}

// ---------------------------------------------------------------------------------------------
// Wheels: separate meshes, axis = local X, outboard face = +X, origin at the hub.
const WHEEL_STYLES = {
  road: { rim: .62, lugs: 0, lugH: .006, rimCol: 0xb4b8bc, rimMat: CHROME, spokes: 5, bolts: 5 },
  van: { rim: .6, lugs: 16, lugH: .007, rimCol: 0x8c9094, rimMat: TRIM, spokes: 0, bolts: 5 },
  off: { rim: .56, lugs: 15, lugH: .017, rimCol: 0x55585c, rimMat: TRIM, spokes: 6, bolts: 6 },
  truck: { rim: .56, lugs: 12, lugH: .016, rimCol: 0x6e7276, rimMat: TRIM, spokes: 0, bolts: 8, holes: 6 },
  mil: { rim: .5, lugs: 10, lugH: .028, rimCol: 0x3e4530, rimMat: TRIM, spokes: 0, bolts: 8, bead: 1 },
  bus: { rim: .58, lugs: 16, lugH: .008, rimCol: 0xa0a4a8, rimMat: TRIM, spokes: 0, bolts: 8, holes: 6 },
  tractor: { rim: .55, lugs: 13, lugH: .055, rimCol: 0xc99a1c, rimMat: TRIM, spokes: 0, bolts: 8, chevron: 1 },
  quad: { rim: .5, lugs: 11, lugH: .022, rimCol: 0x23252a, rimMat: TRIM, spokes: 4, bolts: 4 },
  rail: { rim: .8, lugs: 0, lugH: 0, rimCol: 0x303234, rimMat: TRIM, spokes: 0, bolts: 6, steel: 1 },
  fork: { rim: .54, lugs: 0, lugH: 0, rimCol: 0xc7601e, rimMat: TRIM, spokes: 0, bolts: 6 },
};
function lugBlock(a0, a1, x0, x1, r, h, skew) {
  const P = (a, x, R) => [x, Math.cos(a) * R, Math.sin(a) * R], R1 = r + h;
  const c = [P(a0, x0, r), P(a1, x0, r), P(a1 + skew, x1, r * .9), P(a0 + skew, x1, r * .9), P(a0 + h * .4 / r, x0, R1), P(a1 - h * .4 / r, x0, R1), P(a1 + skew - h * .4 / r, x1, R1), P(a0 + skew + h * .4 / r, x1, R1)];
  const face = (a, b, d, e) => { const u = [c[b][0] - c[a][0], c[b][1] - c[a][1], c[b][2] - c[a][2]], v = [c[e][0] - c[a][0], c[e][1] - c[a][1], c[e][2] - c[a][2]]; let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = n.map(q => q / l); const mx = (c[a][1] + c[d][1]) * .5, my = (c[a][2] + c[d][2]) * .5, ma = (a0 + a1 + skew) * .5, rx = Math.cos(ma), ry = Math.sin(ma), cx = [(c[a][0] + c[b][0] + c[d][0] + c[e][0]) / 4 - (x0 + x1) / 2, (c[a][1] + c[b][1] + c[d][1] + c[e][1]) / 4 - rx * (r + h * .5), (c[a][2] + c[b][2] + c[d][2] + c[e][2]) / 4 - ry * (r + h * .5)]; if (n[0] * cx[0] + n[1] * cx[1] + n[2] * cx[2] < 0 && !(mx !== mx || my !== my)) n = n.map(q => -q); OQ(c[a], c[b], c[d], c[e], n); };
  face(4, 5, 6, 7); face(3, 2, 6, 7); face(0, 3, 7, 4); face(1, 2, 6, 5);
}
function emitWheel(style, r, w, lod, flat, dual = false) {
  const S = WHEEL_STYLES[style] || WHEEL_STYLES.road, rr = r * S.rim, hw = w / 2;
  const seg = lod === 0 ? (r > .7 ? 24 : 18) : 16;
  use(S.steel ? TRIM : RUBBER, S.steel ? 0x3a3c3f : flat ? 0x151412 : 0x1b1b1c);
  if (lod === 2) { lathe(0, 0, 0, 1, 0, 0, [[1e-4, -hw, 1], [r, -hw, 1], [r, hw, 1], [1e-4, hw, 1]], seg); use(S.rimMat, style === 'road' ? 0x54575b : S.rimCol); lathe(0, 0, 0, 1, 0, 0, [[rr, hw + .004, 1], [1e-4, hw + .004, 1]], style === 'tractor' || style === 'fork' ? 16 : 12); return; }
  const sh = lerp(rr, r, .86), tp = lod === 0
    ? [[rr * 1.01, -hw * .78, 1], [lerp(rr, r, .5), -hw], [sh, -hw * .94], [r, -hw * .66], ...(dual ? [[r, -hw * .1], [r * .93, -hw * .05, 1], [r * .93, hw * .05, 1], [r, hw * .1]] : []), [r, hw * .66], [sh, hw * .94], [lerp(rr, r, .5), hw], [rr * 1.01, hw * .78, 1]]
    : [[1e-4, -hw, 1], [r, -hw * .8], [r, hw * .8], [rr * 1.02, hw * .82, 1]];
  lathe(0, 0, 0, 1, 0, 0, tp, seg);
  if (lod === 0 && S.lugs) {
    const n = S.lugs, da = TAU / n, h = r * S.lugH / .4 * .42 + .004;
    use(RUBBER, 0x202021);
    for (let i = 0; i < n; i++) { const a = i * da;
      if (S.chevron) { lugBlock(a, a + da * .34, 0, hw * .98, r - .004, h, da * .85); lugBlock(a + da * .5, a + da * .84, 0, -hw * .98, r - .004, h, da * .85); }
      else { lugBlock(a, a + da * .62, hw * .08, hw * .86, r - .003, h, da * .14); lugBlock(a + da * .5, a + da * 1.12, -hw * .08, -hw * .86, r - .003, h, da * .14); } }
  }
  // rim
  const dx = hw * .72;
  use(S.rimMat, S.rimCol);
  const rimP = lod === 0
    ? [[rr * 1.02, dx, 1], [rr * .93, dx * .98], [rr * .82, -dx * .15, 1], [rr * .32, -dx * .02, 1], [rr * .13, dx * .42, 1], [0, dx * .44]]
    : [[rr * 1.02, hw * .82, 1], [rr * .82, hw * .3, 1], [1e-4, hw * .45, 1]];
  lathe(0, 0, 0, 1, 0, 0, rimP, style === 'tractor' ? 20 : lod === 0 ? 14 : style === 'fork' ? 16 : 12);
  if (lod) return;
  use(TRIM, 0x101112, .5); lathe(0, 0, 0, 1, 0, 0, [[1e-4, -hw * .6, 1], [rr * 1.01, -hw * .6, 1]], 16); use(S.rimMat, S.rimCol);
  if (S.spokes) { // cast spokes over a dark barrel
    use(TRIM, 0x101113, .6); lathe(0, 0, 0, 1, 0, 0, [[rr * .84, dx * .12, 1], [rr * .3, dx * .12, 1]], 14);
    use(S.rimMat, S.rimCol);
    for (let i = 0; i < S.spokes; i++) { const a = TAU * i / S.spokes; xf(0, 0, 0, a, 0, 0, () => { const pr = [[rr * .24, -rr * .1], [rr * .87, -rr * .055], [rr * .87, rr * .055], [rr * .24, rr * .1]].map(p => [p[1], p[0]]); pushM(); mulM([0, 0, 1, dx * .34, 0, 1, 0, 0, -1, 0, 0, 0]); extrudeXPlain(pr, -.012, .012); popM(); }); }
  }
  if (S.holes) { use(TRIM, 0x08090a, .5); for (let i = 0; i < S.holes; i++) { const a = TAU * (i + .5) / S.holes, cy = Math.cos(a) * rr * .6, cz = Math.sin(a) * rr * .6; lathe(dx * .2, cy, cz, 1, 0, 0, [[rr * .11, 0, 1], [1e-4, .001, 1]], 6); } }
  if (S.bead) { use(TRIM, 0x34392a); lathe(0, 0, 0, 1, 0, 0, [[rr * 1.09, dx * 1.12, 1], [rr * 1.06, dx * 1.28, 1], [rr * .9, dx * 1.24, 1], [rr * .88, dx * .96, 1]], 12); use(CHROME, 0x777a70); for (let i = 0; i < 6; i++) { const a = TAU * i / 6; lathe(dx * 1.26, Math.cos(a) * rr * .98, Math.sin(a) * rr * .98, 1, 0, 0, [[.012, 0, 1], [.001, .05]], 4); } }
  use(CHROME, 0x9a9da0); const br = S.bolts > 8 ? rr * .4 : rr * .24, nb = Math.min(S.bolts, 6); for (let i = 0; i < nb; i++) { const a = TAU * i / nb, cy = Math.cos(a) * br, cz = Math.sin(a) * br; lathe(dx * .3, cy, cz, 1, 0, 0, [[Math.max(.009, r * .024), 0, 1], [Math.max(.007, r * .019), dx * .22, 1], [0, dx * .24]], 4); }
  use(TRIM, S.rimCol); lathe(0, 0, 0, 1, 0, 0, [[rr * .12, dx * .4, 1], [rr * .11, dx * .72, 1], [rr * .07, dx * .82], [0, dx * .84]], 8);
}
function extrudeXPlain(prof, x0, x1) { // cheap prism: flat side faces and fan caps
  const n = prof.length; let area = 0; for (let i = 0; i < n; i++) { const a = prof[i], b = prof[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; } const p = area < 0 ? prof.slice().reverse() : prof;
  for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n], dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1, e = [0, -dz / l, dy / l]; OQ([x0, a[1], a[0]], [x1, a[1], a[0]], [x1, b[1], b[0]], [x0, b[1], b[0]], e); }
  for (const [x, s] of [[x1, 1], [x0, -1]]) { const id = p.map(q => V(x, q[1], q[0], s, 0, 0)); for (let i = 1; i < n - 1; i++) T(id[0], id[i], id[i + 1]); }
}
function bakeWheel(flat, burnt, r, rand) {
  for (let m = 0; m < NMAT; m++) { const b = bufs[m];
    for (let i = 0; i < b.nv; i++) { const k = i * 3; const x = b.p[k], y = b.p[k + 1], z = b.p[k + 2], R = Math.hypot(y, z), ao = lerp(.6, 1, smooth(.1, .75, R / r)), dust = (m === RUBBER ? .1 : .05) * (.5 + fbm(y * 5 + 3, z * 5, x * 5));
      b.c[k] = lerp(b.c[k] * ao, .17, dust); b.c[k + 1] = lerp(b.c[k + 1] * ao, .135, dust); b.c[k + 2] = lerp(b.c[k + 2] * ao, .09, dust);
      if (burnt) { const q = fbm(y * 6 + rand, z * 6, x * 6), a = m === RUBBER ? .85 : .9; b.c[k] = lerp(b.c[k], m === RUBBER ? .012 : .022 + .03 * q, a); b.c[k + 1] = lerp(b.c[k + 1], m === RUBBER ? .012 : .019 + .017 * q, a); b.c[k + 2] = lerp(b.c[k + 2], m === RUBBER ? .012 : .018 + .007 * q, a); }
      if (flat && m === RUBBER) { const lim = -r * .7; if (y < lim) b.p[k + 1] = lim + (y - lim) * .18; }
      if (b.u[i * 2] < -1e8) { b.u[i * 2] = z * .4; b.u[i * 2 + 1] = y * .4; }
    } }
}
const wheelCache = new Map();
function wheelGeometry(style, r, w, lod, flat, burnt, seedV, dual = false) {
  const key = [style, r, w, lod, flat ? 1 : 0, burnt ? 1 : 0, dual ? 1 : 0].join('|'); let g = wheelCache.get(key); if (g) return g;
  const saved = bufs, ms = MAXSEG, nb = NOBEVEL, ts = TUBESEG; MAXSEG = 99; NOBEVEL = false; TUBESEG = 99; bufs = scratchW; for (const b of bufs) b.reset();
  emitWheel(style, r, w, lod, flat, dual); bakeWheel(flat, burnt, r, seedV);
  g = packGeometry(bufs, lod, false, lod === 2 ? LOD2_WHEEL : undefined); MAXSEG = ms; NOBEVEL = nb; TUBESEG = ts; bufs = saved; B = bufs[0]; wheelCache.set(key, g); return g;
}
const LOD_MAP = [[0, 1, 2, 3, 4, 5, 6], [0, 1, 1, 3, 4, 5, 6], [0, 1, 1, 1, 1, 1, 1]], LOD2_WHEEL = [1, 1, 1, 1, 1, 1, 1];
function packGeometry(src, lod, turn, map = LOD_MAP[lod]) {
  let nv = 0, ni = 0; for (const b of src) { nv += b.nv; ni += b.ni; }
  const p = new Float32Array(nv * 3), n = new Float32Array(nv * 3), c = new Float32Array(nv * 3), u = new Float32Array(nv * 2), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), g = new THREE.BufferGeometry();
  let vo = 0, io = 0;
  for (let mat = 0; mat < NMAT; mat++) {
    const start = io;
    for (let s = 0; s < NMAT; s++) { if (map[s] !== mat) continue; const b = src[s]; if (!b.ni) continue;
      p.set(b.p.subarray(0, b.nv * 3), vo * 3); n.set(b.n.subarray(0, b.nv * 3), vo * 3); c.set(b.c.subarray(0, b.nv * 3), vo * 3); u.set(b.u.subarray(0, b.nv * 2), vo * 2);
      for (let i = 0; i < b.ni; i++) idx[io++] = b.i[i] + vo; vo += b.nv; }
    if (io > start) g.addGroup(start, io - start, mat);
  }
  for (let i = 0; i < nv; i++) { const k = i * 3, l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1; n[k] /= l; n[k + 1] /= l; n[k + 2] /= l; if (turn) { p[k] = -p[k]; p[k + 2] = -p[k + 2]; n[k] = -n[k]; n[k + 2] = -n[k + 2]; } }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('uv', new THREE.BufferAttribute(u, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------------------------
// Build context
class Build {
  constructor(type, o) {
    this.type = type; this.doorsShut = !!o.doorsShut; this.variant = o.variant || ''; this.lod = o.lod; this.wreck = o.wreck; this.seed = o.seed; this.rand = makeRng(o.seed * 7919 + type.length * 131 + (o.wreck ? 17 : 0));
    this.paintKey = o.paint; this.camo = !!CAMO[o.paint]; this.paint = this.camo ? 0xe6e6e6 : typeof o.paint === 'number' ? o.paint : (PALETTE[o.paint] ?? PALETTE.olive);
    this.wheels = []; this.seats = []; this.doors = []; this.head = []; this.tail = []; this.boxes = []; this.cams = {}; this.pivot = [0, .8, 0]; this.mass = 'medium'; this.massKg = 1800; this.extra = {};
  }
  // Pair of wheels on one axle. x: track half width at the wheel centre.
  axle(z, x, r, w, style, o = {}) { for (const s of [1, -1]) this.wheels.push({ x: x * s, y: r, z, r, w, style, side: s, steer: o.steer ? (o.steerMax ?? .6) : 0, drive: o.drive !== false, axle: o.axle ?? this.wheels.length >> 1, dual: !!o.dual, flat: false, missing: false }); }
}
const hasDetail = b => b.lod === 0, hasMid = b => b.lod <= 1;

function drawHull(b, H, o = {}) {
  const col = o.col ?? b.paint, mat = o.mat ?? PAINT;
  sym(s => {
    H.side = s; use(mat, col); H.shell();
    for (const h of H.holes) {
      if (h.side && h.side !== s) continue; if (h.s0 < 0) continue;
      if (h.kind === 'arch') H.reveal(h, 0x101112, .34);
      else if (h.kind === 'deep') { H.reveal(h, h.wallCol ?? 0x202124, .62); use(TRIM, h.floorCol ?? 0x1b1c1e, .55); H.fill(h, h.depth); }
      else if (h.kind === 'door') H.reveal(h, 0x1a1b1d, .5);
      else if (b.lod === 0) {
        H.reveal(h, 0x09090b, .8);
        if (h.glass && !b.wreck) { use(GLASS, 0xffffff); H.fill(h, h.depth * .72); }
        else if (h.glass) shards(b, H, h);
      } else { use(CHROME, b.wreck ? 0x08080a : 0x17222b); H.fill(h, .004); }
    }
    if (H.decals) for (const d of H.decals) if (!d.side || d.side === s) { if (d.deep) H.decal(d.pts, 0x1d1e21); else if (b.wreck) H.decal(d.pts, 0x08080a, 0x141414); else H.decal(d.pts, 0x18252e, 0x4d6778); }
    if (o.liner && b.lod === 0) { const tl = H.tLines; H.tLines = Array.from({ length: H.K }, (_, i) => i); use(TRIM, o.linerCol ?? 0x3a3b3d, .62); H.shell({ inset: .045, flip: true, z0: o.liner[0], z1: o.liner[1] }); H.tLines = tl; }
    if (o.floor !== false) H.floor(0x16171a);
  });
  H.side = 0;
  if (o.capF !== false) { H.cap(1, o.capFCol ?? col, mat); xfMirrorCap(H, 1, o.capFCol ?? col, mat); }
  if (o.capR !== false) { H.cap(-1, o.capRCol ?? col, mat); xfMirrorCap(H, -1, o.capRCol ?? col, mat); }
}
function xfMirrorCap(H, end, col, mat) { pushM(); mulM([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]); H.cap(end, col, mat); popM(); }
function shards(b, H, h) { // jagged glass left in the frame of a broken window
  use(GLASS, 0xffffff); const r = b.rand;
  for (let i = h.s0; i < h.s1; i++) for (const edge of [0, 1]) { if (r() < .35) continue;
    const t0 = edge ? h.hiA[i] : h.loA[i], t1 = edge ? h.hiA[i + 1] : h.loA[i + 1], mid = (h.loA[i] + h.hiA[i]) * .5, pa = H.pt(i, t0), pb = H.pt(i + 1, t1), j = lerp(i, i + 1, r()) | 0, pc = H.pt(j, lerp(t0, mid, .18 + r() * .4)), n = H.nAt(i, t0), d = h.depth * .7;
    const off = q => [q[0] - n[0] * d, q[1] - n[1] * d, q[2] - n[2] * d]; OT(off(pa), off(pb), off(pc), n); }
}

function seat(x, y, z, w = .48, col = 0x24262a, head = true) {
  if (!head) { use(TRIM, col, .92); box(x, y + .05, z, w, .1, .46); xf(x, y + .34, z - .22, -.16, 0, 0, () => box(0, 0, 0, w * .94, .56, .08)); return; }
  use(TRIM, col, .92); box(x, y + .05, z, w, .13, .5, .045);
  xf(x, y + .34, z - .25, -.2, 0, 0, () => { box(0, 0, 0, w * .94, .62, .13, .05); if (head) box(0, .4, -.01, w * .5, .17, .1, .035); });
}
function wheelRing(x, y, z, r, rake = -1.05) {
  xf(x, y, z, rake, 0, 0, () => { const p = []; for (let i = 0; i < 14; i++) { const a = TAU * i / 14; p.push([Math.cos(a) * r, Math.sin(a) * r, 0]); } use(TRIM, 0x121315); tube(p, .017, 5, true); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + TAU * i / 3; tube([[0, 0, 0], [Math.cos(a) * r, Math.sin(a) * r, 0]], .013, 4); } box(0, 0, -.015, r * .5, r * .42, .04, .012); });
}
function cabin(b, o) { // simple real interior, LOD0 only
  if (!hasDetail(b)) return; const { y, dashZ, dashY, dashW, seats, wheelX = 0, wheelY, wheelZ, floorZ0, floorZ1, floorW } = o;
  use(TRIM, 0x18191b, .6); if (floorZ0 !== undefined) box(0, y - .02, (floorZ0 + floorZ1) / 2, floorW * 2, .04, floorZ1 - floorZ0);
  use(TRIM, 0x232528, .85); xf(0, dashY, dashZ, .18, 0, 0, () => { box(0, 0, 0, dashW * 2, .15, .34, .045); use(TRIM, 0x121315, .7); box(wheelX, .085, -.05, .42, .03, .18, .01); });
  for (const s of seats) seat(s[0], y + (s[2] ?? .22), s[1], s[3] ?? .48);
  if (wheelY !== undefined) { wheelRing(wheelX, wheelY, wheelZ, .185); use(TRIM, 0x18191b); cyl(wheelX, wheelY - .04, wheelZ + .05, wheelX, dashY, dashZ, .025, .03, 6); }
}
function headlamp(x, y, z, r = .09, yaw = .18, housing = 0x1a1b1d) {
  xf(x, y, z, 0, yaw, 0, () => { use(TRIM, housing, .8); lathe(0, 0, -.04, 0, 0, 1, [[r * 1.16, 0, 1], [r * 1.16, .05, 1], [r * .98, .058, 1], [r * .92, .03, 1]], 12); use(CHROME, 0xd4d6d8); lathe(0, 0, -.015, 0, 0, 1, [[r * .92, .04, 1], [r * .3, -.005]], 12); use(LAMP, 0xfff3d2); dome(0, 0, .022, r * .42, r * .42, r * .3, 3, 8); });
}
function roundLens(x, y, z, r, col) { xf(x, y, z, 0, 0, 0, () => { use(TRIM, 0x121315); lathe(0, 0, 0, 0, 0, 1, [[r * 1.14, 0, 1], [r * 1.14, .015, 1], [r * .94, .018, 1]], 8); use(LAMP, col); dome(0, 0, .012, r * .92, r * .92, r * .32, 2, 8); }); }
function rectLamp(x, y, z, w, h, col, d = .025, faceDir = 1) { use(TRIM, 0x101113); box(x, y, z, w + .02, h + .02, d, .004); use(LAMP, col); box(x, y, z + faceDir * d * .55, w, h, d * .6, .006); }
function mirrorArm(x, y, z, s = 1, big = false) { const sx = big ? .1 : .09, sy = big ? .3 : .12, sz = big ? .18 : .15; use(TRIM, 0x1c1d1f); tube([[x - .1, y - .03, z], [x + .02, y + .01, z + .02], [x + .08, y + .02, z + .01]], .012, 5); xf(x + .1, y + .03, z, 0, -.2, 0, () => { use(TRIM, 0x1a1b1d); box(0, 0, 0, sx + .06, sy, sz, .025); use(CHROME, 0x9fb0ba); box(.0, 0, -sz * .54, sx + .03, sy * .8, .004); }); }
function wiper(x, y, z, len, ang = .3) { xf(x, y, z, 0, 0, 0, () => { use(TRIM, 0x0c0d0e, .8); const a = [0, 0, 0], d = [Math.cos(ang) * len, Math.sin(ang) * len * .24, Math.sin(ang) * len * .9]; tube([a, [d[0] * .55, d[1] * .55 + .012, d[2] * .55], d], .006, 4); box(d[0] * .5, d[1] * .5 + .012, d[2] * .5, len * .62, .008, .012); }); }
function grilleBars(cx, cy, cz, w, h, n, col = 0x0f1012, barCol = 0x3a3c3f) {
  use(TRIM, col, .55); box(cx, cy, cz - .012, w, h, .025, .006); use(TRIM, barCol);
  for (let i = 0; i < n; i++) box(cx, cy - h / 2 + h * (i + .5) / n, cz + .006, w * .97, h / n * .42, .02, .004);
}
function exhaustPipe(pts, r = .035) { use(CHROME, 0x4a4b4e); tube(pts, r, 8); const a = pts[pts.length - 1]; use(TRIM, 0x050506, .4); box(a[0], a[1], a[2], r * .9, r * .9, .002); }
function towHook(x, y, z, dir = 1) { use(TRIM, 0x202226); const p = []; for (let i = 0; i <= 6; i++) { const a = Math.PI * i / 6; p.push([x, y + Math.sin(a) * .035, z + dir * (.04 + Math.cos(-a + Math.PI) * -.035 + .035)]); } tube(p, .011, 5); box(x, y, z, .05, .05, .06, .008); }
function jerrycan(x, y, z, col, ry = 0) { xf(x, y, z, 0, ry, 0, () => { use(TRIM, col); box(0, 0, 0, .17, .36, .3, .024); use(TRIM, 0x1a1b1d); box(.087, 0, 0, .005, .28, .2, .002); box(0, .19, .05, .05, .03, .05, .01); tube([[0, .18, -.09], [0, .215, -.09], [0, .215, -.02], [0, .19, -.02]], .009, 4); }); }
function strap(pts, w = .035, col = 0x2a2a22) { use(CANVAS, col, .82); for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]); xf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, -Math.atan2(d[1], Math.hypot(d[0], d[2])), Math.atan2(d[0], d[2]), 0, () => box(0, 0, 0, w, .006, l)); } }
function rivets(p0, p1, n, r = .013, col) { if (col !== undefined) use(TRIM, col); for (let i = 0; i < n; i++) { const k = n > 1 ? i / (n - 1) : .5, x = lerp(p0[0], p1[0], k), y = lerp(p0[1], p1[1], k), z = lerp(p0[2], p1[2], k); stud(x, y, z, r); } }
function stud(x, y, z, r) { const h = r * .6, t = V(x, y + h, z, 0, 1, 0), o = [[r, 0], [0, r], [-r, 0], [0, -r]].map(q => V(x + q[0], y, z + q[1], q[0] / r * .7, .7, q[1] / r * .7)); for (let i = 0; i < 4; i++) T(t, o[i], o[(i + 1) % 4]); }
function spareWheel(b, x, y, z, r, w, style, ax = 'z') { // a static tyre carried on the body
  const ms = MAXSEG, ts = TUBESEG, g = () => { emitWheel(style, r, w, b.lod === 0 ? 1 : b.lod, false); }; MAXSEG = 99; TUBESEG = 99;
  if (ax === 'z') xf(x, y, z, 0, Math.PI / 2, 0, g); else if (ax === 'y') xf(x, y, z, 0, 0, Math.PI / 2, g); else xf(x, y, z, 0, 0, 0, g);
  MAXSEG = ms; TUBESEG = ts;
}
function solidAxle(b, z, xHalf, r, yOff = 0, leaf = true) {
  if (!hasMid(b)) return; const y = r + yOff; use(TRIM, 0x17181a, .6); cyl(-xHalf, y, z, xHalf, y, z, .04, .04, 6);
  if (!hasDetail(b)) return; use(TRIM, 0x1b1c1e, .65); dome(0, y, z, .13, .11, .12, 2, 8);
  if (leaf) sym(() => { const xl = xHalf * .72; for (let i = 0; i < 2; i++) { const yl = y + .075 + i * .024, ln = .55 - i * .18; box(xl, yl, z, .06, .02, ln); } box(xl, y + .04, z, .07, .08, .08); cyl(xl + .06, y + .05, z - .12, xl + .06, y + .29, z - .18, .022, .022, 5); });
}
function chassisRails(b, x, y, z0, z1, h = .12) { if (!hasMid(b)) { use(TRIM, 0x18191b, .55); box(0, y, (z0 + z1) / 2, x * 2 + .07, h, z1 - z0); return; } use(TRIM, 0x18191b, .55); sym(() => box(x, y, (z0 + z1) / 2, .07, h, z1 - z0, .01)); if (!hasDetail(b)) return; for (let z = z0 + .3; z < z1; z += 1.1) box(0, y, z, x * 2, h * .7, .05); }
function roofRack(b, y, z0, z1, x, bars = 5) {
  if (!hasMid(b)) return; use(TRIM, 0x1a1b1d); sym(() => { const a = hasDetail(b) ? 5 : 3; tube([[x, y - .04, z0], [x, y + .03, z0 + .08], [x, y + .03, z1 - .08], [x, y - .04, z1]], .016, a); });
  if (hasDetail(b)) for (let i = 0; i < bars; i++) { const z = lerp(z0 + .08, z1 - .08, i / (bars - 1)); cyl(-x, y + .03, z, x, y + .03, z, .011, .011, 5); }
}

// ---------------------------------------------------------------------------------------------
// Shared body language
function carSection({ w, sill, belt, top, tumble = .17, hMax = .75, tuck = .955, shoulder = .82 }) {
  return (z, c) => {
    const W = w(z), yS = sill(z), yT = Math.max(top(z), yS + .1), yB = Math.min(belt(z), yT - .012), h = yT - yB, f = sat(h / hMax);
    const xR = W * (.975 - tumble * f), yR = yB + h * .8, xT = xR * (.86 - .1 * f), yC = yB + h * .972;
    c[0] = W * tuck; c[1] = yS; c[2] = W * .995; c[3] = lerp(yS, yB, .3); c[4] = W; c[5] = lerp(yS, yB, shoulder); c[6] = W * .982; c[7] = yB; c[8] = xR; c[9] = yR; c[10] = xT; c[11] = yC; c[12] = 0; c[13] = yT;
  };
}
// Sculpted bumper: a rounded bar, curved in plan, closed at both tips.
function bumper(b, z, y, hw, h, d, o = {}) {
  const { curve = .16, col = 0x1c1d20, mat = TRIM, end = 1, chin = 0 } = o, nu = b.lod === 0 ? 10 : b.lod === 1 ? 6 : 4, nv = b.lod === 0 ? 12 : b.lod === 1 ? 3 : 2; use(mat, col);
  const P = (u, v, p) => {
    const a = u * TAU, ca = Math.cos(a), sa = Math.sin(a), sq = q => Math.sign(q) * Math.pow(Math.abs(q), .62), xk = v * 2 - 1, tip = b.lod === 0 ? Math.sqrt(Math.max(.02, 1 - Math.pow(Math.abs(xk), 5))) : (Math.abs(xk) > .99 ? .62 : 1);
    p[0] = xk * hw; p[1] = y + sq(sa) * h * .5 * tip - chin * sat(-sa) * tip; p[2] = z + end * (sq(ca) * d * .5 * tip - curve * xk * xk);
  };
  gridSurf(nu, nv, P, true);
  if (b.lod > 0) for (const v of [0, 1]) { const s = v ? 1 : -1, q = [0, 0, 0], id = []; for (let i = 0; i < nu; i++) { P(i / nu, v, q); id.push(V(q[0], q[1], q[2], s, 0, 0)); } for (let i = 1; i < nu - 1; i++) T(id[0], id[i], id[i + 1]); }
}
// Door gaps, handles and (on wrecks) doors hanging open. Call planDoors before H.build().
function planDoors(b, H, list) {
  for (const d of list) { d.h = {}; for (const s of [1, -1]) { d.open = d.open || {}; d.open[s] = b.wreck && !b.doorsShut && hash3(b.seed + 3, d.name.length * 7 + d.name.charCodeAt(0), s + 2) < (d.pOpen ?? .55);
    if (d.open[s]) d.h[s] = H.hole([[d.z0, d.t0], [d.z1, d.t0], [d.z1, d.t1], [d.z0, d.t1]], { kind: 'door', side: s, depth: .05 }); }
    for (const s of [1, -1]) b.doors.push({ name: d.name + (s > 0 ? 'L' : 'R'), p: [s * (H.o.doorX ?? .95), .9, (d.z0 + d.z1) / 2], side: s, open: d.open[s] }); }
}
function drawDoors(b, H, list, col) {
  for (const d of list) sym(s => {
    if (d.open[s] && d.h[s] && d.h[s].s0 >= 0) {
      const h = d.h[s], hz = d.hinge === 'rear' ? d.z0 : d.z1, p = H.pt(h.s1, 1.6), ang = (d.hinge === 'rear' ? 1 : -1) * (.4 + hash3(b.seed + 11, d.name.charCodeAt(0), s + 5) * .5);
      pushM(); mulM([1, 0, 0, p[0], 0, 1, 0, 0, 0, 0, 1, hz]); const c = Math.cos(ang), n = Math.sin(ang); mulM([c, 0, n, 0, 0, 1, 0, 0, -n, 0, c, 0]); mulM([1, 0, 0, -p[0], 0, 1, 0, 0, 0, 0, 1, -hz]);
      H.side = s; use(PAINT, col); H.fill(h, 0); use(TRIM, 0x2a2b2d, .7); H.fill(h, .05, true); popM(); return;
    }
    if (!hasDetail(b)) return;
    H.seam([[d.z0, d.t0], [d.z1, d.t0], [d.z1, d.tTop ?? d.t1], [d.z0, d.tTop ?? d.t1], [d.z0, d.t0]]);
    const hz = d.hinge === 'rear' ? d.z0 + .09 : d.z1 - .09 + (d.z0 - d.z1) * .86;
    H.on(hz, d.th ?? 2.55, .006, () => { use(CHROME, 0x8f9397); box(.008, 0, 0, .022, .028, .135, .009); use(TRIM, 0x0d0d0e, .6); box(-.002, 0, 0, .006, .05, .165, .002); });
  });
}
function windowPillarDetail(b, H, z, t0, t1) { if (hasDetail(b)) H.seam([[z, t0], [z, t1]], .007, 0x08080a); }

// ---------------------------------------------------------------------------------------------
// PICKUP: double cab, long hood, open load bed.
function buildPickup(b) {
  const L = b.lod, R = .43, fz = 1.68, rz = -1.62, paint = b.paint;
  const w = C([[-2.74, .84], [-2.62, .915], [-2.3, .94], [-1, .95], [1.2, .955], [1.85, .94], [2.3, .885], [2.52, .77], [2.6, .62]]);
  const sill = C([[-2.74, .68], [-2.5, .56], [-2.15, .45], [-1, .4], [1, .4], [2.15, .46], [2.42, .55], [2.6, .66]]);
  const belt = C([[-2.74, 1.1], [-2.55, 1.17], [-1, 1.195], [.4, 1.2], [1.2, 1.17], [2.1, 1.07], [2.46, .98], [2.6, .84]]);
  const top = C([[-2.74, 1.13], [-2.66, 1.19], [-.94, 1.215], [-.885, 1.27], [-.84, 1.62], [-.74, 1.815], [-.45, 1.875], [.25, 1.885], [.58, 1.84], [.86, 1.6], [1.16, 1.31], [1.3, 1.235], [1.9, 1.17], [2.35, 1.085], [2.52, .98], [2.6, .86]]);
  const H = new Hull({ lod: L, z0: -2.74, z1: 2.6, sec: carSection({ w, sill, belt, top, tumble: .2, hMax: .7 }), creases: [3], nz: 34, nz1: 9, nz2: 2, keys: [-.94, -.84, -.74, .25, .58, 1.16], doorX: .96 });
  H.arch(fz, R, R + .075, { flare: .042, depth: .44 }); H.arch(rz, R, R + .075, { flare: .045, depth: .44 });
  H.hole([[.02, 3.07], [1.07, 3.07], [.66, 3.92], [.02, 3.92]], {}); // front side glass
  H.hole([[-.78, 3.07], [-.06, 3.07], [-.06, 3.92], [-.7, 3.92]], {}); // rear side glass
  H.hole([[.64, 4.2], [1.13, 4.22], [1.13, 6], [.64, 6]], { depth: .025 }); // windscreen
  H.hole([[-.872, 4.3], [-.77, 4.3], [-.77, 6], [-.872, 6]], { depth: .025 }); // back light
  const bed = H.hole([[-2.6, 4.06], [-.97, 4.06], [-.97, 6], [-2.6, 6]], { kind: 'deep', depth: .52, wallCol: 0x24252a, floorCol: 0x1d1e21 });
  const doors = [{ name: 'front', z0: .0, z1: 1.1, t0: .22, t1: 3.02, tTop: 3.02, th: 2.62 }, { name: 'rear', z0: -.8, z1: -.04, t0: .22, t1: 3.02, tTop: 3.02, th: 2.62 }];
  planDoors(b, H, doors); H.build();
  drawHull(b, H, { liner: [-.92, 1.2] }); drawDoors(b, H, doors, paint);
  if (hasMid(b)) {
    // hood, grille, lamps
    use(TRIM, 0x121315); box(0, .86, 2.555, 1.0, .25, .04, .012);
    if (hasDetail(b)) {
      grilleBars(0, .865, 2.57, .92, .2, 5); use(CHROME, 0xa9adb0); box(0, .985, 2.555, 1.02, .02, .03, .006); box(0, .745, 2.56, 1.02, .018, .03, .006);
      H.seam([[1.17, 4.0], [2.46, 3.7]], .008); H.seam([[1.17, 4.0], [1.17, 6]], .008); H.seam([[2.44, 3.7], [2.44, 6]], .008);
      sym(() => { H.on(1.8, 4.75, .004, () => { use(TRIM, 0x0d0e10); for (let i = 0; i < 4; i++) box(0, -.02 + i * .03, 0, .006, .012, .22, .002); }); });
      sym(() => { wiper(.1, 1.3, 1.19, .46, .2); });
      // fuel cap, bed rail caps, tie-downs
      xf(-.97, 1.0, -1.9, 0, 0, 0, () => { });
      H.on(-2.05, 2.5, .005, () => { use(TRIM, 0x121315); lathe(0, 0, 0, 1, 0, 0, [[.06, 0, 1], [.06, .008, 1], [0, .012]], 10); });
      use(TRIM, 0x2a2b2e); sym(() => { for (const z of [-2.45, -1.15]) box(.8, .82, z, .05, .05, .06, .012); });
      for (let i = 0; i < 6; i++) { use(TRIM, 0x2c2d31, .7); box(-.6 + i * .24, .735, -1.78, .11, .018, 1.56, .004); }
      use(TRIM, 0x17181a); box(0, 1.215, -.965, 1.72, .05, .05, .012);
    }
    sym(() => { headlamp(.66, .94, 2.5, .1, .24); if (hasDetail(b)) { rectLamp(.78, .82, 2.5, .13, .035, 0xffa02a, .02); mirrorArm(.92, 1.42, .92); }
      use(TRIM, 0x141517); rectLamp(.86, 1.05, -2.725, .13, .26, 0xb01a14, .025, -1); });
    bumper(b, 2.56, .63, .96, .2, .24, { curve: .22, col: 0x2a2b2e, chin: .05 });
    bumper(b, -2.74, .66, .95, .17, .2, { curve: .08, col: 0x2a2b2e, end: -1 });
    if (hasDetail(b)) { cabin(b, { y: .46, dashZ: 1.0, dashY: 1.1, dashW: .76, seats: [[.42, .32], [-.42, .32], [.42, -.46, .16, .46], [0, -.46, .16, .4], [-.42, -.46, .16, .46]], wheelX: .42, wheelY: 1.12, wheelZ: .74, floorZ0: -.86, floorZ1: 1.1, floorW: .86 }); towHook(.3, .6, 2.68); towHook(-.3, .6, 2.68); use(TRIM, 0x1a1b1d); box(0, .69, -2.87, .1, .08, .12, .012); }
    // tailgate seam
    if (hasDetail(b)) { H.seam([[-2.66, 2.3], [-2.66, 3.9]], .01); }
    use(TRIM, 0x1a1b1d); sym(() => { if (hasDetail(b)) box(.97, .52, .55, .05, .05, 1.85, .016); });
    solidAxle(b, rz, .82, R, .04); chassisRails(b, .5, .36, -2.5, 2.2, .13); solidAxle(b, fz, .82, R, .04, false);
    if (hasDetail(b)) exhaustPipe([[.28, .38, -.4], [.3, .38, -2.2], [.42, .34, -2.84]], .032);
  } else {
    use(CHROME, 0x17222b); use(TRIM, 0x1c1d1f); bumper(b, 2.55, .62, .95, .2, .2, { curve: .2 }); bumper(b, -2.73, .65, .93, .15, .18, { curve: .06, end: -1 });
    const fq = (x, y, z, w, h) => OQ([x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z], [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z], [0, 0, 1]); use(TRIM, 0x0d0e10); box(0, .86, 2.565, 1.02, .24, .05); use(LAMP, 0x8f9296); fq(0, .985, 2.597, 1.04, .03); fq(0, .9, 2.597, .94, .02); fq(0, .82, 2.597, .94, .02); sym(() => H.lampOn(.66, .95, .2, .2, 0xfff0c8)); use(LAMP, 0xb01a14); sym(() => box(.86, 1.05, -2.74, .12, .22, .03));
  }
  b.axle(fz, .815, R, .27, 'off', { steer: true, axle: 0 }); b.axle(rz, .815, R, .27, 'off', { axle: 1 });
  b.pivot = [0, .72, .05];
  b.seats.push({ role: 'driver', p: [.42, 1.02, .28] }, { role: 'passenger', p: [-.42, 1.02, .28] }, { role: 'rearL', p: [.42, 1.0, -.48] }, { role: 'rearR', p: [-.42, 1.0, -.48] });
  b.cams = { driver: [.42, 1.56, .3], chase: [0, 2.6, -6.6], hood: [0, 1.5, 1.6] };
  b.head = [[.66, .94, 2.56], [-.66, .94, 2.56]]; b.tail = [[.86, 1.05, -2.74], [-.86, 1.05, -2.74]];
}


// ---------------------------------------------------------------------------------------------
// LIGHT 4x4: upright glass, flat hood, external spare, roof rack, snorkel, bull bar.
function buildUtility(b) {
  const L = b.lod, R = .42, fz = 1.36, rz = -1.26;
  const w = C([[-2.16, .84], [-2.06, .9], [-1.3, .93], [.5, .935], [1.4, .93], [1.95, .9], [2.12, .82], [2.2, .7]]);
  const sill = C([[-2.16, .68], [-1.95, .52], [-1.5, .46], [.7, .46], [1.8, .52], [2.2, .68]]);
  const belt = C([[-2.16, 1.2], [-1.8, 1.26], [.2, 1.28], [1, 1.25], [2, 1.17], [2.2, 1.05]]);
  const top = C([[-2.16, 1.24], [-2.12, 1.62], [-2.06, 1.84], [-1.88, 1.95], [-1, 1.985], [.3, 1.995], [.5, 1.965], [.92, 1.42], [1.02, 1.345], [1.6, 1.3], [2.02, 1.24], [2.2, 1.08]]);
  const H = new Hull({ lod: L, z0: -2.16, z1: 2.2, sec: carSection({ w, sill, belt, top, tumble: .13, hMax: .72, shoulder: .86 }), creases: [3], nz: 26, skipKnots1: [1, 2], keys: [.5, .92, 1.02], doorX: .94 });
  H.arch(fz, R, R + .085, { flare: .06, lipW: .09 }); H.arch(rz, R, R + .085, { flare: .06, lipW: .09 });
  H.hole([[.02, 3.07], [.86, 3.07], [.5, 3.93], [.02, 3.93]], {}); H.hole([[-.84, 3.07], [-.06, 3.07], [-.06, 3.93], [-.84, 3.93]], {}); H.hole([[-1.9, 3.07], [-.92, 3.07], [-.92, 3.93], [-1.74, 3.93]], {});
  H.hole([[.54, 4.18], [.9, 4.2], [.9, 6], [.54, 6]], { depth: .025 });
  H.hole([[-2.11, 4.45], [-2.0, 4.3], [-2.0, 6], [-2.11, 6]], { depth: .025 });
  const doors = [{ name: 'front', z0: .0, z1: .92, t0: .24, t1: 3.03, th: 2.62 }, { name: 'rear', z0: -.86, z1: -.04, t0: .24, t1: 3.03, th: 2.62 }];
  planDoors(b, H, doors); H.build(); drawHull(b, H, { liner: [-2.08, .98] }); drawDoors(b, H, doors, b.paint);
  if (hasMid(b)) {
    use(TRIM, 0x121315); box(0, .96, 2.175, 1.12, .3, .04, .012);
    sym(() => headlamp(.62, .98, 2.14, .115, .08)); sym(() => { use(TRIM, 0x141517); rectLamp(.87, 1.02, -2.16, .1, .22, 0xb01a14, .025, -1); });
    bumper(b, 2.22, .68, .95, .17, .2, { curve: .1, col: 0x232427 }); bumper(b, -2.18, .7, .9, .15, .18, { curve: .05, col: 0x232427, end: -1 });
    use(TRIM, 0x1a1b1d); sym(() => { const y = .76, z = 2.28; tube([[.62, y - .08, z - .1], [.62, y + .08, z + .04], [.62, y + .52, z + .05], [.55, y + .62, z]], .024, hasDetail(b) ? 6 : 4); });
    if (hasDetail(b)) tube([[-.62, 1.3, 2.28], [0, 1.33, 2.31], [.62, 1.3, 2.28]], .022, 6); else cyl(-.62, 1.32, 2.28, .62, 1.32, 2.28, .022, .022, 4);
    roofRack(b, 2.06, -1.86, .3, .68, 7); solidAxle(b, rz, .79, R, .05); solidAxle(b, fz, .79, R, .05); chassisRails(b, .46, .38, -2, 2, .13);
    spareWheel(b, 0, 1.2, -2.32, R * .96, .25, 'off');
  } else { use(TRIM, 0x101113); box(0, .97, 2.17, .86, .24, .05); sym(() => H.lampOn(.62, .98, .2, .2, 0xfff0c8)); use(TRIM, 0x1c1d1f); bumper(b, 2.2, .68, .93, .16, .16, { curve: .08 }); spareWheel(b, 0, 1.2, -2.32, R * .96, .25, 'off'); }
  if (hasDetail(b)) {
    grilleBars(0, .98, 2.19, .86, .22, 6, 0x0e0f11, 0x35373a); H.seam([[1.03, 3.98], [2.06, 3.85]], .008); H.seam([[1.03, 3.98], [1.03, 6]], .008); H.seam([[2.05, 3.85], [2.05, 6]], .008);
    sym(() => { wiper(.08, 1.4, 1.0, .42, .18); mirrorArm(.92, 1.47, .82); rectLamp(.84, .84, 2.2, .11, .035, 0xffa02a, .02); use(TRIM, 0x1c1d1f); box(.98, .5, -.45, .09, .035, 1.58, .012); });
    // snorkel, fuel cap, rear door seam, hooks, rack load
    use(TRIM, 0x17181a); tube([[.97, 1.05, 1.05], [1.02, 1.28, .98], [1.0, 1.72, .72], [.97, 2.02, .6]], .04, 7); box(.96, 2.06, .62, .12, .08, .12, .03);
    H.on(-1.55, 2.5, .005, () => { use(TRIM, 0x121315); lathe(0, 0, 0, 1, 0, 0, [[.058, 0, 1], [.058, .009, 1], [0, .013]], 10); });
    H.seam([[-2.1, .3], [-2.1, 5.8]], .012); towHook(.34, .66, 2.32); towHook(-.34, .66, 2.32); use(TRIM, 0x1a1b1d); box(0, .68, -2.32, .1, .08, .1, .012);
    jerrycan(.22, 2.28, -1.05, 0x3f4730, .4); jerrycan(-.14, 2.28, -1.1, 0x3f4730, -.15); use(CANVAS, 0x5a5340, .9); box(.08, 2.2, -.1, .95, .2, .75, .08); strap([[-.42, 2.31, -.12], [.58, 2.31, -.12]], .04); strap([[-.42, 2.31, -.32], [.58, 2.31, -.32]], .04);
    exhaustPipe([[.26, .4, -.2], [.28, .4, -1.8], [.4, .36, -2.26]], .03);
    cabin(b, { y: .5, dashZ: .86, dashY: 1.15, dashW: .78, seats: [[.42, .22], [-.42, .22], [.42, -.62, .14, .46], [-.42, -.62, .14, .46]], wheelX: .42, wheelY: 1.2, wheelZ: .6, floorZ0: -2, floorZ1: .9, floorW: .86 });
  }
  b.axle(fz, .79, R, .29, 'off', { steer: true, axle: 0 }); b.axle(rz, .79, R, .29, 'off', { axle: 1 }); b.pivot = [0, .78, .02];
  b.seats.push({ role: 'driver', p: [.42, 1.08, .2] }, { role: 'passenger', p: [-.42, 1.08, .2] }, { role: 'rearL', p: [.42, 1.06, -.64] }, { role: 'rearR', p: [-.42, 1.06, -.64] });
  b.cams = { driver: [.42, 1.68, .24], chase: [0, 2.8, -6.2], hood: [0, 1.6, 1.3] };
  b.head = [[.62, .98, 2.2], [-.62, .98, 2.2]]; b.tail = [[.87, 1.02, -2.17], [-.87, 1.02, -2.17]];
}

// ---------------------------------------------------------------------------------------------
// VAN: one-box panel van with a short sloping nose, sliding door and barn doors.
function buildVan(b) {
  const L = b.lod, R = .37, fz = 1.68, rz = -1.72;
  const w = C([[-2.66, .9], [-2.56, .97], [-1.8, 1], [.8, 1.0], [1.6, .985], [2.2, .93], [2.5, .82], [2.64, .68]]);
  const sill = C([[-2.66, .58], [-2.35, .42], [-1.8, .36], [1.2, .36], [2.2, .42], [2.64, .58]]);
  const belt = C([[-2.66, 1.3], [-2, 1.34], [.6, 1.34], [1.4, 1.28], [2.1, 1.14], [2.5, 1.0], [2.64, .86]]);
  const top = C([[-2.66, 1.4], [-2.63, 2.08], [-2.54, 2.3], [-2.2, 2.39], [.5, 2.42], [.95, 2.37], [1.28, 2.18], [1.72, 1.56], [1.92, 1.36], [2.35, 1.17], [2.54, 1.03], [2.64, .9]]);
  const H = new Hull({ lod: L, z0: -2.66, z1: 2.64, sec: carSection({ w, sill, belt, top, tumble: .1, hMax: 1.1, shoulder: .8 }), creases: [3], nz: 26, keys: [.95, 1.28, 1.72, 1.92], doorX: 1.0 });
  H.arch(fz, R, R + .075, { flare: .03 }); H.arch(rz, R, R + .075, { flare: .03 });
  H.hole([[.72, 3.06], [1.64, 3.06], [1.2, 3.92], [.76, 3.92]], {}); H.hole([[-.36, 3.1], [.56, 3.1], [.56, 3.92], [-.36, 3.92]], {});
  H.hole([[1.22, 4.14], [1.8, 4.2], [1.8, 6], [1.22, 6]], { depth: .025 });
  H.hole([[-2.635, 4.15], [-2.57, 4.0], [-2.57, 5.72], [-2.635, 5.72]], { depth: .022 });
  const doors = [{ name: 'cab', z0: .68, z1: 1.68, t0: .24, t1: 3.03, th: 2.7 }, { name: 'slide', z0: -.5, z1: .62, t0: .24, t1: 3.03, hinge: 'rear', th: 2.7 }];
  planDoors(b, H, doors); H.build(); drawHull(b, H, { liner: [-2.56, 1.84] }); drawDoors(b, H, doors, b.paint);
  if (hasMid(b)) {
    use(TRIM, 0x111214); box(0, .86, 2.61, 1.05, .22, .04, .012); bumper(b, 2.6, .58, 1, .2, .24, { curve: .22, col: 0x202124, chin: .04 }); bumper(b, -2.67, .6, .99, .16, .16, { curve: .05, col: 0x202124, end: -1 });
    sym(() => { H.lampOn(.67, .91, .25, .1, 0xfff3d2); use(TRIM, 0x141517); rectLamp(.93, 1.08, -2.66, .08, .4, 0xb01a14, .025, -1); });
    solidAxle(b, rz, .82, R, .03); solidAxle(b, fz, .82, R, .03, false); chassisRails(b, .5, .32, -2.5, 2.2, .1);
  } else { use(TRIM, 0x101113); box(0, .87, 2.6, .92, .17, .05); sym(() => H.lampOn(.67, .91, .25, .1, 0xfff0c8)); use(TRIM, 0x1c1d1f); bumper(b, 2.59, .58, .98, .18, .18, { curve: .2 }); }
  if (hasDetail(b)) {
    grilleBars(0, .865, 2.63, .96, .17, 4, 0x0e0f11, 0x303235); H.seam([[1.84, 4.1], [2.5, 3.9]], .008); H.seam([[1.84, 4.1], [1.84, 6]], .008); H.seam([[2.48, 3.9], [2.48, 6]], .008);
    H.seam([[-.62, .24], [.62, .24]], .012); use(TRIM, 0x18191b); sym(s => { if (s > 0) return; box(1.005, 1.43, -.08, .03, .03, 1.5, .01); });
    sym(() => { wiper(.1, 1.7, 1.86, .5, .15); mirrorArm(1.02, 1.62, 1.42, 1, true); use(TRIM, 0x1a1b1d); box(1.01, .52, -.4, .03, .1, 2.2, .012); rectLamp(.92, .78, 2.6, .12, .03, 0xffa02a, .02); });
    H.seam([[-2.62, .3], [-2.62, 5.9]], .012); use(TRIM, 0x0e0f10); box(0, 1.55, -2.665, .014, 1.5, .012); sym(() => { use(CHROME, 0x8f9397); box(.09, 1.3, -2.68, .03, .18, .025, .008); });
    H.on(-1.15, 2.5, .005, () => { use(TRIM, 0x121315); lathe(0, 0, 0, 1, 0, 0, [[.05, 0, 1], [.05, .008, 1], [0, .012]], 10); });
    exhaustPipe([[.26, .3, -.5], [.28, .3, -2.3], [.4, .28, -2.78]], .028); towHook(.3, .5, 2.74); use(TRIM, 0x1a1b1d); box(0, .54, -2.8, .1, .08, .1, .012);
    roofRack(b, 2.47, -2.1, .4, .78, 6);
    use(TRIM, 0x1d1e20, .7); box(0, 1.25, .36, 1.82, 1.5, .05);
    cabin(b, { y: .42, dashZ: 1.54, dashY: 1.18, dashW: .84, seats: [[.45, .75], [-.45, .75]], wheelX: .45, wheelY: 1.22, wheelZ: 1.24, floorZ0: .4, floorZ1: 1.7, floorW: .9 });
  }
  b.axle(fz, .845, R, .24, 'van', { steer: true, axle: 0 }); b.axle(rz, .845, R, .24, 'van', { axle: 1 }); b.pivot = [0, .9, .05];
  b.seats.push({ role: 'driver', p: [.45, 1.08, .75] }, { role: 'passenger', p: [-.45, 1.08, .75] });
  b.cams = { driver: [.45, 1.72, .78], chase: [0, 3.2, -7], hood: [0, 1.75, 1.6] };
  b.head = [[.66, 1, 2.56], [-.66, 1, 2.56]]; b.tail = [[.93, 1.08, -2.67], [-.93, 1.08, -2.67]];
}

// ---------------------------------------------------------------------------------------------
// CITY BUS: low-floor body, big glazed front, destination panel, double doors, dual rear wheels.
function buildBus(b) {
  const L = b.lod, R = .55, fz = 3.3, rz = -2.78, Z0 = -5.82, Z1 = 5.82;
  const w = C([[Z0, 1.12], [Z0 + .1, 1.22], [Z0 + .45, 1.27], [3, 1.275], [Z1 - .5, 1.27], [Z1 - .16, 1.21], [Z1 - .04, 1.12], [Z1, 1.02]]);
  const sill = C([[Z0, .58], [Z0 + .3, .42], [-4, .37], [4, .37], [Z1 - .25, .42], [Z1, .58]]);
  const belt = C([[Z0, 1.34], [Z0 + .3, 1.44], [4, 1.46], [Z1 - .42, 1.44], [Z1 - .16, 1.3], [Z1, 1.12]]);
  const top = C([[Z0, 1.62], [Z0 + .035, 2.52], [Z0 + .16, 2.92], [Z0 + .48, 3.04], [-3, 3.08], [4.6, 3.08], [Z1 - .66, 3.05], [Z1 - .42, 2.92], [Z1 - .34, 2.62], [Z1 - .12, 1.5], [Z1 - .05, 1.3], [Z1, 1.14]]);
  const sec = (z, c) => { const W = w(z), yS = sill(z), yT = Math.max(top(z), yS + .1), yB = Math.min(belt(z), yT - .012), h = yT - yB, f = sat(h / 1.6), xR = W * (.975 - .075 * f), yR = yB + h * .8, xT = xR * (.86 - .1 * f), yC = yB + h * .972, ys = Math.min(yS + .14, yB - .02);
    c[0] = W * .955; c[1] = yS; c[2] = W; c[3] = ys; c[4] = W * .982; c[5] = lerp(ys, yB, .55); c[6] = W * .995; c[7] = yB; c[8] = xR; c[9] = yR; c[10] = xT; c[11] = yC; c[12] = 0; c[13] = yT; };
  const H = new Hull({ lod: L, z0: Z0, z1: Z1, sec, creases: [1, 3], nz: 14, nz1: 5, nz2: 2, tPer: 2, keys: [Z0 + .035, Z0 + .16, Z0 + .48, Z1 - .66, Z1 - .42, Z1 - .34, Z1 - .12, Z1 - .05], doorX: 1.28 });
  H.arch(fz, R, R + .1, { flare: .03, lipW: .1, depth: .5 }); H.arch(rz, R, R + .1, { flare: .03, lipW: .1, depth: .72 });
  const win = (a, c, side) => H.hole([[a, 3.1], [c, 3.1], [c, 3.9], [a, 3.9]], { depth: .03, side });
  for (let i = 0; i < 7; i++) { const a = -5.1 + i * 1.38, c = a + 1.3; win(a, c, 1); if (i === 4) win(1.46, c, -1); else if (i === 6) win(a, 3.98, -1); else win(a, c, -1); }
  win(4.56, 5.02, 1);
  H.hole([[Z1 - .33, 4.08], [Z1 - .1, 4.22], [Z1 - .1, 6], [Z1 - .33, 6]], { depth: .028 });
  H.hole([[Z0 + .03, 4.3], [Z0 + .13, 4.15], [Z0 + .13, 5.6], [Z0 + .03, 5.6]], { depth: .024 });
  const doorBays = [[4.05, 5.1], [.15, 1.38]];
  for (const [a, c] of doorBays) { const m = (a + c) / 2; H.hole([[a + .04, .62], [m - .02, .62], [m - .02, 3.92], [a + .04, 3.92]], { side: -1, depth: .035 }); H.hole([[m + .02, .62], [c - .04, .62], [c - .04, 3.92], [m + .02, 3.92]], { side: -1, depth: .035 }); }
  H.build(); drawHull(b, H, {});
  if (hasDetail(b)) { use(TRIM, 0x8f9186, .7); const ix = 1.19, y0 = .62, y1 = 2.96, z0 = Z0 + .22, z1 = Z1 - .3; for (const s of [1, -1]) OQ([s * ix, y0, z0], [s * ix, y1, z0], [s * ix, y1, z1], [s * ix, y0, z1], [-s, 0, 0]); OQ([-ix, y1, z0], [ix, y1, z0], [ix, y1, z1], [-ix, y1, z1], [0, -1, 0]); OQ([-ix, y0, z0], [ix, y0, z0], [ix, y1, z0], [-ix, y1, z0], [0, 0, 1]); OQ([-ix, y0, z1], [ix, y0, z1], [ix, y1, z1], [-ix, y1, z1], [0, 0, -1]); }
  b.doors.push({ name: 'front', p: [-1.28, .9, 4.58], side: -1, open: false }, { name: 'middle', p: [-1.28, .9, .76], side: -1, open: false });
  // Bumpers wrap the corners; black mask carries the lamps
  bumper(b, Z1 + .03, .63, 1.27, .42, .3, { curve: .2, col: 0x24262a, chin: .05 }); bumper(b, Z0 - .03, .64, 1.26, .4, .26, { curve: .13, col: 0x24262a, end: -1, chin: .03 });
  use(TRIM, 0x101113); box(0, 1.04, Z1 - .012, 1.86, .24, .05, L ? 0 : .014);
  sym(() => { xf(.7, 1.04, Z1 + .004, 0, .16, 0, () => { use(TRIM, 0x17181b); box(0, 0, 0, .44, .19, .05); use(LAMP, 0xfff3d2); box(-.1, 0, .03, .18, .12, .016); box(.11, 0, .03, .14, .1, .016); }); use(TRIM, 0x141517); rectLamp(1.07, 1.12, Z0 + .01, .15, .56, 0xb01a14, .03, -1); });
  // Destination panel above the windscreen
  xf(0, 2.72, Z1 - .365, -.26, 0, 0, () => { use(TRIM, 0x08080a, 1); box(0, 0, 0, 1.7, .34, .07); use(LAMP, 0xffa51e);
    if (hasDetail(b)) { const F = { 2: ['111', '001', '111', '100', '111'], 4: ['101', '101', '111', '001', '001'] }, px = .036, q = (x, y, s = px * .78) => OQ([x, y, .037], [x + s, y, .037], [x + s, y + s, .037], [x, y + s, .037], [0, 0, 1]); let cx = -.72; for (const d of [2, 4]) { F[d].forEach((row, r) => { for (let c = 0; c < 3; c++) if (row[c] === '1') q(cx + c * px, .09 - r * px); }); cx += px * 4; } for (let i = 0; i < 26; i++) { const n = (i * 7 + 3) % 5; for (let j = 0; j < 3 + (n > 2 ? 1 : 0); j++) if ((i + j) % 4 !== 3) q(-.36 + i * .039, .045 - j * .039); } }
    else box(-.05, 0, .036, 1.3, .13, .012); });
  // Wipers parked at the base of the screen
  if (hasMid(b)) sym(() => { const zb = Z1 - .098, zt = Z1 - .25, yb = top(zb) + .012, yt = top(zt) + .012, off = .03; use(TRIM, 0x08090a, .8); tube([[.16, yb, zb + off], [.58, lerp(yb, yt, .55), lerp(zb, zt, .55) + off], [.84, yt, zt + off]], .009, hasDetail(b) ? 4 : 3); if (hasDetail(b)) tube([[.16, yb, zb + off], [.5, lerp(yb, yt, .3), lerp(zb, zt, .3) + off + .012]], .012, 4); });
  if (hasMid(b)) {
    // Rub rails between the wheels, roof pods, axles and frame
    const rails = [[Z0 + .35, rz - R - .14], [rz + R + .14, fz - R - .14], [fz + R + .14, Z1 - .22]];
    sym(s => { H.side = s; for (const [a, c] of rails) { if (s < 0 && a < 2 && c > 1) { H.rail(a, .12, 1, .1, .024, 0x1b1c1f); H.rail(1.42, c, 1, .1, .024, 0x1b1c1f); } else if (s < 0 && a > 3) H.rail(a, 4.02, 1, .1, .024, 0x1b1c1f); else H.rail(a, c, 1, .1, .024, 0x1b1c1f); } });
    use(PAINT, b.paint); box(0, 3.14, -1.6, 1.5, .14, 3.1, L ? 0 : .06);
    solidAxle(b, rz, .98, R, .02); solidAxle(b, fz, 1, R, .02, false); chassisRails(b, .6, .3, Z0 + .3, Z1 - .4, .1);
  } else { use(PAINT, b.paint); box(0, 3.13, -1.6, 1.5, .12, 3.1); }
  if (hasDetail(b)) {
    use(TRIM, 0x262729); for (let i = 0; i < 6; i++) box(0, .96 + i * .075, Z0 - .02, 1.42, .03, .025); use(TRIM, 0x121315); box(0, 1.15, Z0 - .004, 1.5, .55, .03, .01);
    for (let z = -5; z < 5.2; z += 1.38) H.seam([[z - .04, 1.1], [z - .04, 3]], .007);
    H.seam([[Z0 + .2, 2.85], [Z1 - .3, 2.85]], .012, 0x050506);
    sym(s => { for (const [a, c] of [[-5.25, -4.15], [-1.95, -.75], [1.65, 2.6]]) { if (s < 0 && a > 1) continue; H.seam([[a, .2], [c, .2], [c, 1.75], [a, 1.75], [a, .2]], .008); H.on(c - .12, 1.35, .006, () => { use(CHROME, 0x8f9397); box(0, 0, 0, .012, .03, .1); }); } });
    sym(() => { H.on(-4.7, 1.55, .004, () => { use(TRIM, 0x0b0c0d); for (let i = 0; i < 6; i++) box(0, -.09 + i * .036, 0, .006, .018, .62); }); });
    use(TRIM, 0x202124); for (let i = 0; i < 9; i++) box(0, 3.215, -2.9 + i * .32, 1.24, .012, .18); use(TRIM, 0x1a1b1d); box(0, 3.12, 2.6, .85, .08, .85, .03); box(0, 3.12, -4.5, .85, .08, .75, .03);
    sym(() => { use(TRIM, 0x18191b); tube([[1.2, 2.72, Z1 - .46], [1.48, 2.76, Z1 - .28], [1.5, 2.45, Z1 - .24]], .018, 5); box(1.5, 2.2, Z1 - .24, .09, .46, .22, .03); use(CHROME, 0xa8b4bc); box(1.5, 2.2, Z1 - .355, .07, .4, .006); rectLamp(.46, .66, Z1 + .142, .17, .05, 0xffe2a8, .03); H.on(Z1 - .34, 2.2, .006, () => { use(LAMP, 0xffa02a); box(0, 0, 0, .012, .04, .1); }); });
    use(TRIM, 0x121314); for (const [a, c] of doorBays) { const m = (a + c) / 2; sym(s => { if (s > 0) return; for (const q of [a + .03, m, c - .03]) H.seam([[q, .6], [q, 3.94]], .012); H.seam([[a, .6], [c, .6]], .012); H.seam([[a, 3.94], [c, 3.94]], .012); }); }
    for (let z = -4.9; z < 3.3; z += .98) { if ((z > .05 && z < 1.5) || Math.abs(z - rz) < .82 || Math.abs(z - fz) < .82) continue; for (const x of [.84, .4, -.4, -.84]) seat(x, .66, z, .4, 0x2c3d52, false); }
    use(CHROME, 0xc6a838); for (let z = -4.3; z < 4.4; z += 1.72) { cyl(.6, .68, z, .6, 2.85, z, .02, .02, 5); cyl(-.6, .68, z, -.6, 2.85, z, .02, .02, 5); }
    use(TRIM, 0x4a4b46, .7); box(0, .64, -.15, 1.24, .03, 10.8);
    cabin(b, { y: .55, dashZ: 5.24, dashY: 1.38, dashW: .62, seats: [[.62, 4.5, .24, .5]], wheelX: .62, wheelY: 1.34, wheelZ: 4.96 });
    towHook(0, .46, Z1 + .22); exhaustPipe([[-.8, .3, -3.8], [-.86, .3, -5.98]], .045);
  }
  b.axle(fz, 1.11, R, .31, 'bus', { steer: true, steerMax: .55, axle: 0, drive: false }); b.axle(rz, .965, R, .6, 'bus', { axle: 1, dual: true }); b.pivot = [0, 1.05, .2];
  b.seats.push({ role: 'driver', p: [.62, 1.44, 4.5] }, { role: 'passenger', p: [.4, 1.36, 2.1] }, { role: 'passenger', p: [-.4, 1.36, 2.1] });
  b.cams = { driver: [.62, 2.18, 4.62], chase: [0, 4.6, -12.5], hood: [0, 2.3, 5.4] };
  b.head = [[.7, 1.04, Z1 + .03], [-.7, 1.04, Z1 + .03]]; b.tail = [[1.07, 1.12, Z0], [-1.07, 1.12, Z0]];
}

// ---------------------------------------------------------------------------------------------
// Curved sheet around the X axis (fenders). Angles are measured from +Z toward +Y.
function fender(b, cz, cy, R, x0, x1, a0, a1, o = {}) {
  if (b.lod === 2) { const lo = Math.min(a0, a1), hi = Math.max(a0, a1), cl = q => clamp(q, Math.max(lo, .55), Math.min(hi, 2.6)); a0 = cl(a0); a1 = cl(a1); }
  const nu = b.lod === 0 ? (o.nu ?? 12) : b.lod === 1 ? (o.nu1 ?? 8) : 6, nv = b.lod === 0 ? 3 : 1, roll = o.roll ?? .05, t = o.t ?? .012, col = o.col ?? b.paint;
  const surf = (off, towards) => gridSurf(nu, nv, (u, v, p) => { const a = lerp(a0, a1, u), k = (v * 2 - 1), r = R + off - roll * k * k * k * k; p[0] = lerp(x0, x1, v); p[1] = cy + Math.sin(a) * r; p[2] = cz + Math.cos(a) * r; }, false, [(x0 + x1) / 2, cy, cz], towards);
  use(o.mat ?? PAINT, col); surf(t, false); if (b.lod === 0) { use(TRIM, 0x18191b, .6); surf(0, true); }
}
function mudflap(x, z, y0, y1, w, armY, inX) { use(RUBBER, 0x161617); box(x, (y0 + y1) / 2, z, w, y1 - y0, .012); use(TRIM, 0x1a1b1d); box(x, y1 + .012, z, w + .02, .03, .03); tube([[x, y1 + .012, z], [x, armY, z], [inX, armY, z]], .016, 4); }
function stakePanel(x, y0, y1, z0, z1, n, col) { use(PAINT, col); box(x, y1, (z0 + z1) / 2, .05, .05, z1 - z0, .012); box(x, y0, (z0 + z1) / 2, .05, .06, z1 - z0, .012); for (let i = 0; i <= n; i++) box(x, (y0 + y1) / 2, lerp(z0, z1, i / n), .05, y1 - y0, .05); }

// ---------------------------------------------------------------------------------------------
// MILITARY CARGO TRUCK: 6x6, short bonnet, flat screen, hooped canvas tilt.
function buildTruck(b) {
  const L = b.lod, R = .6, fz = 2.62, r1 = -1.18, r2 = -2.62, paint = b.paint, olive = b.camo ? 0xc4c4c4 : 0x3e4530, jerry = 0x3f4730;
  const Z0 = .92, Z1 = 3.92;
  const w = C([[Z0, 1.08], [Z0 + .1, 1.16], [1.8, 1.17], [2.5, 1.14], [3.2, .92], [3.7, .84], [Z1, .76]]);
  const sill = C([[Z0, 1.0], [Z0 + .3, .95], [2, .95], [3.1, .98], [Z1 - .1, 1.04], [Z1, 1.12]]);
  const belt = C([[Z0, 1.86], [1.9, 1.88], [2.4, 1.82], [3.2, 1.72], [3.7, 1.64], [Z1, 1.46]]);
  const top = C([[Z0, 2.04], [Z0 + .05, 2.46], [Z0 + .14, 2.68], [Z0 + .4, 2.76], [1.9, 2.78], [2.12, 2.72], [2.42, 1.96], [2.55, 1.87], [3.2, 1.8], [3.74, 1.72], [Z1, 1.5]]);
  const H = new Hull({ lod: L, z0: Z0, z1: Z1, sec: carSection({ w, sill, belt, top, tumble: .1, hMax: .9, tuck: .985 }), creases: [3], nz: 11, nz1: 4, nz2: 1, tPer: 2, keys: [2.12, 2.42, 2.55], doorX: 1.17 });
  H.arch(fz, R + .04, R + .15, { flare: .05, lipW: .1, depth: .52 });
  H.hole([[1.34, 3.08], [2.22, 3.08], [1.98, 3.92], [1.34, 3.92]], {});
  H.hole([[2.13, 4.2], [2.4, 4.22], [2.4, 5.92], [2.13, 5.92]], { depth: .024 });
  H.hole([[.95, 4.5], [1.03, 4.3], [1.03, 5.6], [.95, 5.6]], { depth: .022 });
  const doors = [{ name: 'cab', z0: 1.26, z1: 2.3, t0: .26, t1: 3.03, th: 2.6 }];
  planDoors(b, H, doors); H.build(); drawHull(b, H, { liner: [.95, 2.46] }); drawDoors(b, H, doors, paint);
  // ladder chassis and load bed
  chassisRails(b, .48, .92, -3.9, 3.6, .2);
  const bedY = 1.32, bedW = 1.2, bz0 = -3.98, bz1 = .78;
  use(PAINT, paint); box(0, bedY - .06, (bz0 + bz1) / 2, bedW * 2, .12, bz1 - bz0, .02);
  if (hasMid(b)) { use(TRIM, 0x1a1b1d); for (let z = bz0 + .2; z < bz1; z += .8) box(0, bedY - .18, z, bedW * 1.95, .1, .07); }
  if (hasDetail(b)) { sym(() => stakePanel(bedW - .02, bedY + .08, bedY + .58, bz0 + .02, bz1 - .02, 7, paint)); use(PAINT, paint); box(0, bedY + .32, bz0 + .02, bedW * 2, .54, .05, .012); box(0, bedY + .32, bz1 - .02, bedW * 2, .54, .05, .012); }
  else { use(PAINT, paint); sym(() => box(bedW - .02, bedY + .3, (bz0 + bz1) / 2, .05, .55, bz1 - bz0)); box(0, bedY + .3, bz0 + .02, bedW * 2, .55, .05); }
  // canvas tilt: sags between the hoops, with a flap at the back
  const cy = bedY + .55, ch = 1.36, nh = 5, tH = (x, z) => { const k = Math.pow(Math.abs(x / (bedW * .98)), 2.6), hoop = Math.abs(Math.sin((z - bz0) / (bz1 - bz0) * Math.PI * nh)), sag = b.wreck ? .1 : .026; return cy + ch * (1 - k * .42) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x / (bedW * .985)), 7))) - sag * hoop * (1 - k * .5); };
  const flat = b.variant === 'flat', canv = b.wreck ? 0x26241f : b.variant === 'red' ? 0x6e3a2b : (b.camo ? 0x57593d : 0x5c5d42);
  if (flat && !b.wreck) { const cr = [0x6d5b39, 0x7a6642, 0x5f4f33]; for (let i = 0; i < 5; i++) { const z = lerp(bz0 + .62, bz1 - .62, i / 4), h = .58 + (i % 2) * .22; use(CANVAS, cr[i % 3]); box(-.46, bedY + h / 2, z, .86, h, .82, L ? 0 : .02); box(.46, bedY + .35, z + .04, .84, .7, .8, L ? 0 : .02); if (L === 0) { use(TRIM, 0x4a3c26); box(-.46, bedY + h / 2, z + .415, .9, .05, .012); box(.46, bedY + .35, z + .455, .88, .05, .012); } } if (L < 2) strap([[-1.02, bedY + .8, -1.6], [1.02, bedY + .8, -1.6]], .05, 0x24241a); }
  if (!b.wreck && !flat) {
    use(CANVAS, canv);
    const nu = L === 0 ? 16 : L === 1 ? 6 : 3, nv = L === 0 ? 11 : L === 1 ? 5 : 3;
    gridSurf(nu, nv, (u, v, p) => { const z = lerp(bz0 + .02, bz1 - .05, u), x = lerp(bedW * .985, -bedW * .985, v), wr = b.wreck ? .08 * Math.sin(u * 9 + v * 5) * Math.sin(v * 11) : .006 * Math.sin(u * 37) * Math.sin(v * 13); p[0] = x; p[1] = tH(x, z) + wr; p[2] = z; }, false, [0, cy, (bz0 + bz1) / 2]);
    const end = (z, s) => { use(CANVAS, canv); gridSurf(L === 0 ? 14 : 5, L === 0 ? 6 : 2, (u, v, p) => { const x = lerp(-bedW * .985, bedW * .985, u), top = tH(x, z), y = lerp(cy, top, v); p[0] = x; p[1] = y; p[2] = z + s * .012 * Math.sin(u * 21) * (1 - v); }, false, [0, cy + .6, z - s * .5]); };
    end(bz1 - .05, 1); if (!b.wreck) end(bz0 + .02, -1);
  }
  if (b.wreck && !flat) { use(TRIM, 0x1c1a17, .8); const nb = L === 2 ? 2 : nh, ns = L === 0 ? 10 : 5; for (let i = 0; i <= nb; i++) { const z = lerp(bz0 + .1, bz1 - .1, i / nb), p = []; for (let j = 0; j <= ns; j++) { const x = lerp(-bedW * .96, bedW * .96, j / ns); p.push([x, tH(x, z) - .03, z]); } tube(p, .018, 4); } }
  if (hasDetail(b) && !b.wreck && !flat) {
    use(CANVAS, 0x38382a, .85); for (let i = 1; i < nh; i++) { const z = lerp(bz0, bz1, i / nh), p = []; for (let j = 0; j <= 9; j++) { const x = lerp(-bedW * .99, bedW * .99, j / 9); p.push([x, tH(x, z) + .012, z]); } tube(p, .012, 3); }
    sym(() => { for (let i = 0; i < 9; i++) { const z = lerp(bz0 + .15, bz1 - .15, i / 8); use(TRIM, 0x1a1b1d); box(bedW - .005, cy + .06, z, .02, .05, .035, .006); strap([[bedW + .012, cy + .06, z], [bedW + .012, cy - .16, z]], .025, 0x24241a); } });
    use(CANVAS, 0x4a4b36, .9); box(0, cy + .96, bz0 + .05, 1.5, .09, .14, .04); strap([[-.5, cy + .95, bz0 + .01], [-.5, cy + .5, bz0 + .005]], .03); strap([[.5, cy + .95, bz0 + .01], [.5, cy + .5, bz0 + .005]], .03);
  }
  if (hasMid(b)) {
    use(TRIM, 0x0f1012); box(0, 1.34, Z1 - .01, 1.28, .46, .04, .012);
    bumper(b, Z1 + .06, .98, 1.08, .18, .2, { curve: .05, col: olive, mat: PAINT }); bumper(b, bz0 - .04, .92, 1.18, .14, .14, { curve: .02, col: 0x1c1d1f, end: -1 });
    fender(b, fz, R + .04, R + .17, .84, 1.22, .55, 2.6); sym(() => { fender(b, r1, R + .04, R + .14, .84, 1.22, 2.65, .35, { nu: 8 }); fender(b, r2, R + .04, R + .14, .84, 1.22, 2.8, .45, { nu: 8 }); });
    sym(() => { xf(.62, 1.48, Z1 + .01, 0, .05, 0, () => { use(TRIM, 0x18191b); cyl(0, 0, -.1, 0, 0, .04, .135, .135, 10); use(CHROME, 0xc8cacc); lathe(0, 0, .042, 0, 0, 1, [[.118, 0, 1], [.03, -.03]], 10); use(LAMP, 0xfff3d2); dome(0, 0, .03, .045, .045, .04, 2, 6); }); use(TRIM, 0x121315); rectLamp(.92, 1.07, bz0 - .02, .12, .16, 0xb01a14, .025, -1); });
    for (const z of [r1, r2]) solidAxle(b, z, .98, R, .1); solidAxle(b, fz, .98, R, .1);
  } else { use(TRIM, 0x0f1012); box(0, 1.34, Z1 - .01, 1.2, .42, .05); sym(() => H.lampOn(.6, 1.46, .2, .2, 0xfff0c8)); use(TRIM, 0x1c1d1f); bumper(b, Z1 + .05, .98, 1.05, .16, .14, { curve: .04 }); }
  if (hasDetail(b)) {
    use(TRIM, 0x0a0b0c, .6); for (let i = 0; i < 9; i++) box(-.56 + i * .14, 1.34, Z1 + .012, .07, .38, .02, .004); use(PAINT, olive); box(0, 1.585, Z1 + .005, 1.3, .04, .03, .008);
    H.seam([[2.56, 3.98], [Z1 - .05, 3.75]], .01); H.seam([[2.56, 3.98], [2.56, 6]], .01); H.seam([[Z1 - .06, 3.75], [Z1 - .06, 6]], .01);
    sym(() => { wiper(.14, 1.98, 2.46, .5, .15); mirrorArm(1.18, 2.42, 2.16, 1, true); use(TRIM, 0x1a1b1d); for (let i = 0; i < 4; i++) box(.72 + i * .06 - .1, 1.7 + .02, 3.05, .02, .012, .62, .004); for (let k = 0; k < 2; k++) box(1.0 + k * .09, .82 - k * .15, 1.76, .19, .025, .34, .006); });
    // winch, tow pintle, fuel tank, air tank, tool box, spare wheel, exhaust stack, jerrycans
    use(TRIM, 0x1b1c1e); cyl(-.3, 1.0, Z1 + .15, .3, 1.0, Z1 + .15, .09, .09, 10); use(CANVAS, 0x24241f); cyl(-.25, 1.0, Z1 + .15, .25, 1.0, Z1 + .15, .105, .105, 10); towHook(.56, .9, Z1 + .15); towHook(-.56, .9, Z1 + .15); use(TRIM, 0x1b1c1e); box(0, .92, bz0 - .1, .14, .1, .16, .02);
    use(PAINT, olive); xf(1.06, 1.06, .3, 0, 0, 0, () => { cyl(0, 0, -.55, 0, 0, .55, .22, .22, 12); use(TRIM, 0x1b1c1e); strap([[-.2, .22, -.3], [.22, .1, -.3]], .03); strap([[-.2, .22, .3], [.22, .1, .3]], .03); cyl(.08, .21, .2, .08, .26, .2, .05, .05, 8); });
    use(PAINT, olive); box(-1.05, .98, .34, .4, .4, .9, .03); use(TRIM, 0x17181a); box(-1.255, .98, .34, .01, .3, .78, .004); use(CHROME, 0x8f9397); box(-1.262, 1.1, .34, .012, .025, .18, .006);
    spareWheel(b, 0, 2.07, .68, R * .92, .32, 'mil', 'z');
    exhaustPipe([[-.98, 1.2, 1.1], [-1.22, 1.8, 1.02], [-1.22, 2.9, 1.02], [-1.16, 3.08, .98]], .05); use(TRIM, 0x202124); cyl(-1.22, 1.9, 1.02, -1.22, 2.5, 1.02, .075, .075, 8);
    jerrycan(1.18, 1.62, .55, jerry); jerrycan(1.18, 1.62, .22, jerry);
    use(TRIM, 0x1a1b1d); tube([[-1.24, 1.0, 1.38], [-1.24, 1.5, 1.38]], .012, 4); box(-1.27, .86, 1.82, .24, .03, .34, .008); box(-1.27, .62, 1.82, .24, .03, .34, .008); box(1.27, .86, 1.82, .24, .03, .34, .008); box(1.27, .62, 1.82, .24, .03, .34, .008);
    sym(() => { mudflap(.98, -3.42, .2, .72, .42, .95, .5); mudflap(.98, 1.98, .24, .66, .42, 1.0, .62); });
    cabin(b, { y: 1.12, dashZ: 2.26, dashY: 1.82, dashW: .96, seats: [[.52, 1.5], [-.52, 1.5]], wheelX: .52, wheelY: 1.82, wheelZ: 1.96 });
    use(CHROME, 0x8f9397); rivets([.5, 2.75, 1.0], [.5, 2.75, 1.9], 6, .012); rivets([-.5, 2.75, 1.0], [-.5, 2.75, 1.9], 6, .012);
  }
  b.axle(fz, 1.0, R, .38, 'mil', { steer: true, steerMax: .5, axle: 0 }); b.axle(r1, 1.0, R, .38, 'mil', { axle: 1 }); b.axle(r2, 1.0, R, .38, 'mil', { axle: 2 }); b.pivot = [0, 1.25, -.1];
  b.seats.push({ role: 'driver', p: [.52, 1.72, 1.5] }, { role: 'passenger', p: [-.52, 1.72, 1.5] }, { role: 'cargoL', p: [.8, 1.8, -1.5] }, { role: 'cargoR', p: [-.8, 1.8, -1.5] });
  b.cams = { driver: [.52, 2.4, 1.56], chase: [0, 4.4, -9.5], hood: [0, 2.5, 2.5] };
  b.head = [[.62, 1.48, Z1 + .06], [-.62, 1.48, Z1 + .06]]; b.tail = [[.92, 1.07, bz0 - .03], [-.92, 1.07, bz0 - .03]];
}

// ---------------------------------------------------------------------------------------------
// FUEL TANKER: forward-control cab, elliptical barrel tank, catwalk, hose lockers.
function buildTanker(b) {
  const L = b.lod, R = .54, fz = 3.1, r1 = -2.42, r2 = -3.72, Z0 = 2.42, Z1 = 4.92, paint = b.paint, cabCol = b.wreck ? paint : 0xc7601e;
  const w = C([[Z0, 1.1], [Z0 + .1, 1.2], [3.5, 1.235], [4.3, 1.235], [4.7, 1.19], [4.86, 1.1], [Z1, .98]]);
  const sill = C([[Z0, .92], [Z0 + .25, .8], [4.2, .78], [4.75, .84], [Z1, 1.0]]);
  const belt = C([[Z0, 1.78], [3.2, 1.8], [4.4, 1.74], [4.82, 1.6], [Z1, 1.34]]);
  const top = C([[Z0, 1.95], [Z0 + .04, 2.8], [Z0 + .14, 3.06], [Z0 + .45, 3.14], [3.9, 3.16], [4.28, 3.08], [4.62, 2.5], [4.84, 1.86], [4.89, 1.5], [Z1, 1.34]]);
  const H = new Hull({ lod: L, z0: Z0, z1: Z1, sec: carSection({ w, sill, belt, top, tumble: .09, hMax: 1.35, tuck: .975 }), creases: [3], nz: 11, nz1: 4, nz2: 1, tPer: 2, keys: [4.28, 4.62, 4.84], doorX: 1.23 });
  H.arch(fz, R + .02, R + .12, { flare: .025, depth: .48 });
  H.hole([[3.56, 3.08], [4.56, 3.08], [4.3, 3.9], [3.62, 3.9]], {}); H.hole([[2.66, 3.3], [3.4, 3.3], [3.4, 3.9], [2.66, 3.9]], {});
  H.hole([[4.3, 4.12], [4.8, 4.25], [4.8, 6], [4.3, 6]], { depth: .026 });
  const doors = [{ name: 'cab', z0: 3.52, z1: 4.62, t0: .3, t1: 3.03, th: 2.58 }];
  planDoors(b, H, doors); H.build(); drawHull(b, H, { col: cabCol, liner: [Z0 + .1, 4.72] }); drawDoors(b, H, doors, cabCol);
  chassisRails(b, .5, .9, -4.75, 3.4, .22);
  // barrel: super-elliptic section with dished ends
  const tz0 = -4.72, tz1 = 2.2, tcy = 2.0, trx = 1.2, try_ = .98, nS = L === 0 ? 26 : L === 1 ? 10 : 7, nZ = L === 0 ? 12 : 6, endR = .34;
  const dentT = b.wreck ? (x, y, z) => .1 * smooth(.52, .7, fbm(x * .8 + 4, y * .9, z * .35)) : null;
  const tankP = (u, v, p, grow = 0) => {
    const q = Math.abs(2 * v - 1), vv = L === 0 ? .5 + .5 * Math.sign(v - .5) * Math.pow(q, .62) : (() => { const st = [0, .012, .05, .5, .95, .988, 1], f = v * 6, i = Math.min(5, f | 0); return lerp(st[i], st[i + 1], f - i); })(), zv = lerp(-1, 1, vv), z = lerp(tz0, tz1, vv), e = Math.min(z - tz0, tz1 - z), k = e < endR ? Math.sqrt(Math.max(.0004, 1 - Math.pow(1 - e / endR, 2.4))) : 1, a = u * TAU, c = Math.cos(a), s = Math.sin(a), sp = q => Math.sign(q) * Math.pow(Math.abs(q), .78);
    p[0] = sp(c) * (trx + grow) * k; p[1] = tcy + sp(s) * (try_ + grow) * k; p[2] = z; if (dentT) { const d = dentT(p[0], p[1], z) * (zv * zv < 1 ? 1 : 0); p[0] *= 1 - d * .6; p[1] -= d * .5 * Math.sign(p[1] - tcy + .3); }
  };
  use(PAINT, b.wreck ? paint : (typeof b.paintKey === 'string' && b.paintKey === 'silver' ? 0xb4b9bd : paint)); gridSurf(nS, nZ, (u, v, p) => tankP(u, v, p), true, [0, tcy, (tz0 + tz1) / 2]);
  const capEnd = (z) => { const c = V(0, tcy, z, 0, 0, Math.sign(z - (tz0 + tz1) / 2)); const s = Math.sign(z - (tz0 + tz1) / 2), q = [0, 0, 0], id = []; for (let i = 0; i < nS; i++) { tankP(i / nS, s > 0 ? 1 : 0, q); id.push(V(q[0], q[1], q[2], 0, 0, s)); } for (let i = 0; i < nS; i++) T(c, id[i], id[(i + 1) % nS]); }; capEnd(tz1); capEnd(tz0);
  if (hasMid(b)) { use(TRIM, 0x2c2e31); for (let i = 0; i <= 4; i++) { const v = lerp(.09, .91, i / 4), ring = [], q = [0, 0, 0]; for (let j = 0; j < (L === 0 ? 18 : 8); j++) { tankP(j / (L === 0 ? 18 : 8), v, q, .012); ring.push(q.slice()); } tube(ring, .018, 3, true); } use(PAINT, 0x34373b); box(0, .98, (tz0 + tz1) / 2 - .05, 1.05, .16, tz1 - tz0 - .1, .03); }
  if (hasDetail(b)) {
    for (let i = 0; i < 5; i++) { const z = lerp(tz0 + .5, tz1 - .5, i / 4); use(TRIM, 0x202124); box(0, .94, z, 2.1, .1, .12); for (const s of [1, -1]) { xf(s * .92, 1.2, z, 0, 0, s * -.7, () => box(0, 0, 0, .06, .34, .12, .012)); } }
    // manholes, catwalk, handrail, ladder, valve box, placards, hose trays
    use(TRIM, 0x4a4d50); for (const z of [-3.5, -1.3, .9]) { lathe(0, tcy + try_ - .02, z, 0, 1, 0, [[.3, 0, 1], [.3, .08, 1], [.27, .11, 1], [0, .13]], 12); use(CHROME, 0x8f9397); for (let a = 0; a < 6; a++) { const t = a * TAU / 6; stud(Math.cos(t) * .27, tcy + try_ + .1, z + Math.sin(t) * .27, .014); } use(TRIM, 0x4a4d50); cyl(.12, tcy + try_ + .1, z, .12, tcy + try_ + .28, z, .03, .03, 6); }
    use(TRIM, 0x303236); for (let z = tz0 + .3; z < tz1 - .3; z += .28) box(0, tcy + try_ + .045, z, .36, .012, .16); sym(() => { use(TRIM, 0x2a2c30); box(.2, tcy + try_ + .035, (tz0 + tz1) / 2, .02, .04, tz1 - tz0 - .5, .006); use(CHROME, 0xc2c6c8); const p = []; for (let i = 0; i <= 6; i++) p.push([.46, tcy + try_ + .26, lerp(tz0 + .4, tz1 - .4, i / 6)]); tube(p, .016, 5); for (let i = 0; i <= 4; i++) { const z = lerp(tz0 + .4, tz1 - .4, i / 4); tube([[.3, tcy + try_ - .04, z], [.46, tcy + try_ + .26, z]], .012, 3); } });
    use(CHROME, 0xb0b4b6); sym(() => tube([[.32, .9, tz0 - .2], [.32, 2.9, tz0 - .14]], .018, 5)); for (let y = 1.05; y < 2.9; y += .24) cyl(-.32, y, tz0 - .18, .32, y, tz0 - .18, .012, .012, 5);
    use(PAINT, 0x34373b); box(0, .98, -5.05, 2.3, .6, .6, .03); use(TRIM, 0x121315); box(0, .98, -5.368, 1.9, .42, .012, .004); use(TRIM, 0x202124); for (let i = 0; i < 3; i++) cyl(-.4 + i * .4, .9, -5.35, -.4 + i * .4, .9, -5.45, .05, .05, 8); use(CHROME, 0xb7b9ba); box(.86, 1.05, -5.365, .025, .13, .03, .006);
    sym(() => { use(PAINT, 0x34373b); box(1.05, .83, .6, .3, .42, 3.4, .012); use(TRIM, 0x121315); for (let i = 0; i < 4; i++) box(1.205, .83, -.6 + i * .8, .008, .32, .68, .003); use(CHROME, 0x9a9da0); for (let i = 0; i < 4; i++) box(1.214, .9, -.6 + i * .8, .01, .02, .12, .004); use(LAMP, 0xffa02a); for (let i = 0; i < 4; i++) box(1.24, 1.08, lerp(-4.3, 1.8, i / 3), .018, .03, .07, .004); });
    use(LAMP, 0xd8c23a); box(-.42, tcy - .05, tz0 - .09, .26, .26, .006); use(TRIM, 0x121315); box(-.42, tcy - .05, tz0 - .095, .28, .28, .004);
    use(PAINT, cabCol); sym(() => { use(TRIM, 0x202124); box(.98, 1.2, -1.2, .02, .025, 3.1, .006); });
  }
  if (hasMid(b)) {
    use(TRIM, 0x0f1012); box(0, 1.2, Z1 - .012, 1.46, .52, .04, .014); bumper(b, Z1 + .03, .92, 1.25, .22, .22, { curve: .12, col: 0x2a2b2e, chin: .05 });
    sym(() => { xf(.86, 1.08, Z1 - .02, 0, .22, 0, () => { use(TRIM, 0x121315); box(0, 0, 0, .46, .18, .05, .016); use(LAMP, 0xfff3d2); box(-.08, 0, .03, .24, .12, .018, .006); box(.14, 0, .03, .12, .1, .018, .006); }); use(TRIM, 0x121315); rectLamp(.95, 1.12, -5.37, .14, .16, 0xb01a14, .02, -1); });
    if (L === 1) { use(PAINT, 0x34373b); box(0, .98, -5.05, 2.3, .6, .6); } solidAxle(b, fz, 1.0, R, .08, false); solidAxle(b, r1, 1.0, R, .08); solidAxle(b, r2, 1.0, R, .08);
  } else { use(TRIM, 0x0f1012); box(0, 1.2, Z1 - .012, 1.4, .5, .05); sym(() => H.lampOn(.8, 1.08, .36, .15, 0xfff0c8)); use(TRIM, 0x1c1d1f); bumper(b, Z1 + .03, .9, 1.2, .2, .18, { curve: .1 }); use(PAINT, 0x34373b); box(0, .98, -5.05, 2.2, .6, .6); }
  if (hasDetail(b)) {
    use(CHROME, 0xb7b9ba); for (let i = 0; i < 6; i++) box(0, .98 + i * .085, Z1 + .012, 1.38, .022, .018, .005);
    sym(() => { wiper(.22, 1.84, 4.78, .7, .2); mirrorArm(1.25, 2.52, 4.42, 1, true); use(TRIM, 0x202124); box(1.26, .68, 3.86, .2, .03, .36, .008); box(1.26, .44, 3.86, .2, .03, .36, .008); tube([[1.26, 2.6, 3.56], [1.26, 1.6, 3.5]], .014, 4); use(CHROME, 0xc2c6c8); cyl(1.1, .88, 2.1, 1.1, 2.88, 2.1, .06, .05, 8); mudflap(1.0, -4.42, .18, .72, .46, .9, .52); mudflap(1.0, 2.5, .2, .68, .46, .92, .6); });
    use(LAMP, 0xffa02a); for (let i = 0; i < 5; i++) box(-.5 + i * .25, 3.19, 4.08, .1, .035, .1, .008);
    use(PAINT, cabCol); box(0, 3.2, 3.5, 1.6, .1, 1.1, .05); use(TRIM, 0x202124); box(0, 3.27, 3.5, 1.3, .03, .9, .01);
    towHook(.5, .84, Z1 + .18); towHook(-.5, .84, Z1 + .18);
    cabin(b, { y: 1.02, dashZ: 4.6, dashY: 1.74, dashW: 1.0, seats: [[.56, 3.9], [-.56, 3.9]], wheelX: .56, wheelY: 1.76, wheelZ: 4.34 });
    H.seam([[Z0 + .02, .3], [Z0 + .02, 5.6]], .01);
  }
  b.axle(fz, 1.04, R, .32, 'truck', { steer: true, steerMax: .55, axle: 0, drive: false }); b.axle(r1, 1.0, R, .46, 'truck', { axle: 1, dual: true }); b.axle(r2, 1.0, R, .46, 'truck', { axle: 2, dual: true }); b.pivot = [0, 1.4, -.5];
  b.seats.push({ role: 'driver', p: [.56, 1.66, 3.9] }, { role: 'passenger', p: [-.56, 1.66, 3.9] }); b.cams = { driver: [.56, 2.36, 3.98], chase: [0, 5, -11.5], hood: [0, 2.6, 4.7] };
  b.head = [[.86, 1.08, Z1 + .02], [-.86, 1.08, Z1 + .02]]; b.tail = [[.95, 1.12, -5.38], [-.95, 1.12, -5.38]];
}

// ---------------------------------------------------------------------------------------------
// 8x8 APC: faceted welded hull, wedge nose, sponsons over the wheels, one-man turret.
function plateSection(fn) { return (z, c) => { const p = fn(z); for (let i = 0; i < 7; i++) { c[i * 2] = p[i][0]; c[i * 2 + 1] = p[i][1]; } }; }
function buildApc(b) {
  const L = b.lod, R = .6, zs = [2.42, .9, -1.1, -2.62], Z0 = -3.82, Z1 = 3.92, paint = b.paint, steel = b.camo ? 0xbdbdbd : 0x3f4436;
  const bot = C([[Z0, .86], [Z0 + .5, .62], [-2, .56], [2.2, .56], [3.1, .68], [Z1 - .12, 1.04], [Z1, 1.14]]);
  const shoulderY = C([[Z0, 1.42], [-2, 1.46], [2, 1.46], [3.0, 1.42], [Z1 - .3, 1.3], [Z1, 1.24]]);
  const deckY = C([[Z0, 1.62], [Z0 + .24, 2.0], [-2.4, 2.12], [1.4, 2.15], [2.2, 2.1], [3.05, 1.68], [Z1 - .2, 1.42], [Z1, 1.28]]);
  const halfW = C([[Z0, 1.12], [Z0 + .24, 1.3], [-2, 1.36], [2.1, 1.36], [3.0, 1.32], [Z1 - .35, 1.05], [Z1, .82]]);
  const sec = plateSection(z => { const W = halfW(z), yb = bot(z), ys = shoulderY(z), yd = Math.max(deckY(z), ys + .04), keel = W * .5;
    return [[keel, yb], [W * .83, lerp(yb, ys, .55)], [W, ys - .03], [W, ys], [W * .86, lerp(ys, yd, .86)], [W * .72, yd], [0, yd + .018]]; });
  const H = new Hull({ lod: L, K: 7, z0: Z0, z1: Z1, sec, creases: [1, 2, 3, 4, 5], nz: 14, nz1: 5, nz2: 1, tPer: 1, keys: [Z0 + .24, 2.2, 3.05, Z1 - .2], zCrease: [2.2, 3.05, Z0 + .24], skipKnots: [1, 2, 4], skipKnots1: [1, 4], doorX: 1.36 });
  if (L === 0) for (const z of zs) H.arch(z, R, R + .13, { flare: 0, depth: .5 });
  H.hole([[2.42, 4.28], [2.84, 4.4], [2.84, 5.6], [2.42, 5.6]], { depth: .03 }); // driver vision block
  H.build(); drawHull(b, H, { capRCol: paint });
  const hullTop = deckY(0);
  const vane = () => xf(0, 1.515, 3.56, -1.19, 0, 0, () => { use(PAINT, steel); box(0, 0, 0, 1.34, .46, .04, L ? 0 : .012); if (L === 0) { use(TRIM, 0x202124); for (let i = 0; i < 7; i++) box(-.54 + i * .18, 0, .026, .024, .38, .016); } });
  if (hasMid(b)) {
    // sponson lips over each wheel and glacis steps
    use(PAINT, steel); sym(() => { for (const z of zs) fender(b, z, R, R + .15, 1.1, 1.42, 2.92, .22, { nu: 8, nu1: 6, col: paint, t: .016 }); box(1.3, 1.385, -.1, .12, .025, 6.6, .008); });
    bumper(b, Z1 + .05, 1.2, .78, .14, .12, { curve: .02, col: steel, mat: PAINT });
  }
  // TURRET: faceted bustle with a tapered gun
  const tY = hullTop + .03, tz = .2, tS = plateSection(z => { const k = sat((z - (tz - 1.08)) / 2.05), wT = lerp(.62, .92, Math.sin(Math.min(1, k * 1.5) * Math.PI / 2)) * (k > .72 ? lerp(1, .68, (k - .72) / .28) : 1), base = tY, topY = tY + .64 * lerp(.82, 1, Math.sin(k * Math.PI)); return [[wT * .98, base], [wT * 1.02, base + .1], [wT * 1.04, base + .22], [wT * .98, base + .3], [wT * .78, topY - .04], [wT * .62, topY], [0, topY + .012]]; });
  const Tt = new Hull({ lod: L, K: 7, z0: tz - 1.08, z1: tz + .97, sec: tS, creases: [1, 3, 4, 5], nz: 10, nz1: 3, nz2: 1, tPer: 1, skipKnots: [1, 2, 4], skipKnots1: [1, 4] });
  Tt.build(); drawHull(b, Tt, { floor: false });
  // gun, mantlet, coaxial, sights
  const gy = tY + .25, gz = tz + .97;
  use(PAINT, steel); if (hasMid(b)) { box(0, gy, gz + .06, .62, .34, .2, .05); xf(0, gy, gz + .1, .03, 0, 0, () => { dome(0, 0, 0, .18, .16, .22, 3, 8); }); }
  use(TRIM, 0x202226); xf(0, gy + .02, gz + .1, -.035, 0, 0, () => { lathe(0, 0, 0, 0, 0, 1, hasDetail(b) ? [[.075, 0, 1], [.062, .5], [.052, 1.5], [.05, 2.3, 1], [.074, 2.32, 1], [.074, 2.52, 1], [.054, 2.54, 1], [.054, 2.72, 1], [.078, 2.74, 1], [.076, 2.9, 1], [.03, 2.92, 1], [.01, 2.9]] : [[.075, 0, 1], [.05, 2.4, 1], [.07, 2.42, 1], [.07, 2.9, 1], [.001, 2.9, 1]], hasDetail(b) ? 10 : 6); });
  if (hasDetail(b)) {
    for (let i = 0; i < 4; i++) { use(TRIM, 0x0b0b0c); const a = Math.PI / 4 + i * Math.PI / 2; box(Math.cos(a) * .058, gy + .02 + Math.sin(a) * .058 + 2.62 * Math.sin(.035), gz + .1 + 2.62, .03, .03, .1); }
    use(TRIM, 0x1a1b1d); cyl(.24, gy + .03, gz + .05, .24, gy + .03, gz + .68, .03, .025, 6);
    use(PAINT, steel); box(-.32, gy + .25, gz - .3, .26, .22, .34, .03); use(GLASS, 0xffffff); box(-.32, gy + .25, gz - .124, .18, .13, .006); use(TRIM, 0x121315); box(-.32, gy + .25, gz - .128, .21, .16, .008);
    // smoke launchers
    sym(() => { use(TRIM, 0x202124); for (let i = 0; i < 4; i++) cyl(.84, tY + .3, tz + .55 - i * .13, 1.08, tY + .43, tz + .68 - i * .13, .045, .045, 7); });
    // commander hatch, periscopes, antennae, rack and stowage
    use(PAINT, paint); const hy = tY + .63; lathe(.28, hy, tz - .25, 0, 1, 0, [[.34, 0, 1], [.34, .06, 1], [.3, .09, 1]], 14); xf(.28, hy + .09, tz - .25, -.16, 0, 0, () => { lathe(0, 0, 0, 0, 1, 0, [[.29, 0, 1], [.29, .03, 1], [.2, .06], [0, .07]], 14); use(TRIM, 0x1a1b1d); box(0, .08, .1, .16, .025, .03, .01); });
    use(GLASS, 0xffffff); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; box(.28 + Math.cos(a) * .37, hy + .05, tz - .25 + Math.sin(a) * .37, .08, .05, .08, .01); }
    use(TRIM, 0x17181a); for (const [x, z] of [[-.55, -.6], [.6, -.72]]) { cyl(x, tY + .5, tz + z, x, tY + .63, tz + z, .03, .03, 5); cyl(x, tY + .62, tz + z, x + .02, tY + 1.5, tz + z - .03, .007, .003, 4); }
    use(TRIM, 0x1b1c1e); const zr = tz - .8; for (const x of [-.56, 0, .56]) tube([[x, tY + .3, zr - .26], [x, tY + .5, zr - .26], [x, tY + .5, zr + .1]], .012, 4); tube([[-.56, tY + .5, zr - .26], [.56, tY + .5, zr - .26]], .012, 4); use(CANVAS, 0x4e4f38, .92); box(0, tY + .4, zr - .1, 1.0, .18, .3, .07); strap([[-.46, tY + .5, zr - .08], [-.46, tY + .3, zr - .26]], .03); strap([[.46, tY + .5, zr - .08], [.46, tY + .3, zr - .26]], .03);
    // hull: rivets along the plate joints, driver hatch, engine grilles, stowage
    use(steel === 0 ? TRIM : PAINT, steel);
    sym(() => { use(TRIM, 0x2e3324); rivets([1.36, 1.5, -3.3], [1.36, 1.5, 3.0], 26, .016); rivets([1.17, 1.92, -3.3], [1.17, 1.92, 2], 20, .014); });
    H.seam([[2.2, 4.2], [2.2, 6]], .012, 0x101112); H.seam([[3.05, 4], [3.05, 6]], .012, 0x101112); for (const z of [-2.4, -.8, .9]) sym(() => H.seam([[z, 2.8], [z, 5.2]], .009, 0x101112));
    use(PAINT, paint); lathe(.46, hullTop + .02, 1.82, 0, 1, 0, [[.3, 0, 1], [.3, .05, 1], [.26, .07, 1], [0, .08]], 14); use(TRIM, 0x1a1b1d); box(.46, hullTop + .095, 1.82, .14, .025, .03, .01);
    use(GLASS, 0xffffff); for (const dx of [-.16, 0, .16]) { box(.46 + dx, hullTop + .02, 2.26 - Math.abs(dx) * .2, .11, .045, .05, .01); }
    use(TRIM, 0x101112); box(0, hullTop + .015, -2.0, 1.5, .012, 1.1, .004); use(TRIM, 0x2a2d26); for (let i = 0; i < 13; i++) box(0, hullTop + .03, -2.5 + i * .085, 1.42, .018, .05, .004);
    sym(() => { use(PAINT, paint); box(1.12, 2.02, -1.3, .32, .28, 1.6, .03); use(TRIM, 0x1a1b1d); for (let i = 0; i < 3; i++) strap([[1.28, 2.02 + .13, -1.9 + i * .6], [1.285, 1.9, -1.9 + i * .6]], .03); use(CHROME, 0x7d8080); box(1.285, 2.02, -1.3, .012, .03, .16, .005); });
    jerrycan(1.15, 1.92, 1.4, 0x3f4730, .0); jerrycan(1.15, 1.92, 1.07, 0x3f4730); jerrycan(-1.15, 1.92, 1.4, 0x3f4730); use(CANVAS, 0x24241c, .9); strap([[1.26, 2.1, .92], [1.26, 2.1, 1.56]], .03); strap([[-1.26, 2.1, 1.25], [-1.26, 2.1, 1.56]], .03);
    // rear ramp, door, tow, lamps, exhaust grille, front lamps with guards, trim vane
    use(PAINT, paint); xf(.0, 1.26, Z0 + .012, 0, 0, 0, () => { box(.44, 0, 0, 1.02, .86, .035, .012); use(TRIM, 0x17181a); box(.44, -.05, -.022, .54, .52, .012, .004); use(CHROME, 0x777a70); box(.68, -.05, -.04, .05, .14, .03, .01); });
    use(TRIM, 0x101112); box(.78, 1.86, Z0 + .2, .32, .22, .012, .004); towHook(.42, .82, Z0 - .06, -1); towHook(-.42, .82, Z0 - .06, -1); towHook(.5, 1.16, Z1 + .05); towHook(-.5, 1.16, Z1 + .05);
    vane();
    sym(() => { use(TRIM, 0x1a1b1d); box(.72, 1.49, 3.66, .12, .07, .12); headlamp(.72, 1.57, 3.68, .075, .1); use(TRIM, 0x1a1b1d); for (let i = 0; i < 3; i++) tube([[.64 + i * .08, 1.48, 3.7], [.64 + i * .08, 1.57, 3.79], [.64 + i * .08, 1.67, 3.7]], .007, 4); use(LAMP, 0xb01a14); box(.96, 1.88, Z0 + .22, .1, .05, .012, .004); box(.8, .96, -3.76, .06, .05, .012, .004); });
    use(TRIM, 0x1a1b1d); for (let i = 0; i < 2; i++) tube([[-.9 + i * .28, 2.02, 1.66], [-.92 + i * .28, 2.04, 2.5]], .012, 4); use(CANVAS, 0x3b3c2a); for (let i = 0; i < 3; i++) box(-.76, 2.03, 1.8 + i * .28, .3, .05, .24, .02);
  } else if (hasMid(b)) { vane(); sym(() => { use(TRIM, 0x17181a); box(.72, 1.49, 3.66, .12, .07, .12); cyl(.72, 1.57, 3.63, .72, 1.57, 3.72, .09, .09, 8); use(LAMP, 0xfff0c8); cyl(.72, 1.57, 3.72, .72, 1.57, 3.728, .07, .07, 8); }); }
  // Spare wheel on a bolted carrier: plate on the hull, central post, four braces and a clamp
  { const sx = -.6, sy = 1.3, sr = R * .9, sz = Z0 - .24;
    if (hasMid(b)) { use(TRIM, 0x262a1e, .85); box(sx, sy, Z0 - .014, .78, .74, .035); cyl(sx, sy, Z0 - .03, sx, sy, sz + .1, .075, .06, hasDetail(b) ? 10 : 6);
      if (hasDetail(b)) { for (const [dx, dy] of [[-.3, -.28], [.3, -.28], [-.3, .28], [.3, .28]]) { tube([[sx + dx, sy + dy, Z0 - .03], [sx + dx * .28, sy + dy * .28, sz + .13]], .017, 5); use(CHROME, 0x77796e); stud(sx + dx * 1.12, sy + dy * 1.12, Z0 - .034, .02); use(TRIM, 0x262a1e); } } }
    if (!hasMid(b)) { use(TRIM, 0x262a1e, .85); box(sx, sy, Z0 - .05, .3, .3, .12); }
    spareWheel(b, sx, sy, sz, sr, .36, 'mil');
    if (hasDetail(b)) { use(TRIM, 0x1c1f16); box(sx, sy, sz - .205, .46, .06, .035); box(sx, sy, sz - .205, .06, .46, .035); use(CHROME, 0x8a8c80); cyl(sx, sy, sz - .225, sx, sy, sz - .27, .035, .028, 6); } }
  for (let i = 0; i < 4; i++) b.axle(zs[i], 1.2, R, .4, 'mil', { steer: i < 2, steerMax: i === 0 ? .5 : .3, axle: i });
  b.pivot = [0, 1.25, -.1]; if (L === 0) for (const z of zs) solidAxle(b, z, 1.1, R, .1, false);
  b.seats.push({ role: 'driver', p: [.46, 1.72, 2.0] }, { role: 'commander', p: [.28, 2.5, -.1] }, { role: 'gunner', p: [-.28, 2.4, .2] });
  b.cams = { driver: [.46, 2.3, 2.42], chase: [0, 5.2, -11], turret: [.28, 3.15, -.06] };
  b.head = [[.72, 1.57, 3.74], [-.72, 1.57, 3.74]]; b.tail = [[.96, 1.88, Z0 + .2], [-.96, 1.88, Z0 + .2]];
  b.doors.push({ name: 'ramp', p: [.44, 1.26, Z0], side: 0, open: false }, { name: 'driverHatch', p: [.46, 2.2, 1.82], side: 0, open: false });
  b.extra.turret = { pivot: [0, tY, tz], gunAxis: [0, gy, gz] };
}

// ---------------------------------------------------------------------------------------------
// QUAD BIKE: open tubular frame, sculpted plastics, balloon tyres.
function buildQuad(b) {
  const L = b.lod, R = .29, fz = .66, rz = -.62, Z0 = -1.02, Z1 = 1.02, body = b.paint, frame = 0x17181b;
  const w = C([[Z0, .14], [-.84, .2], [-.5, .19], [-.12, .13], [.2, .12], [.52, .17], [.84, .18], [Z1, .1]]);
  const sill = C([[Z0, .6], [-.7, .42], [-.3, .3], [.2, .28], [.7, .36], [Z1, .54]]);
  const top = C([[Z0, .7], [-.92, .8], [-.5, .84], [-.26, .86], [-.16, .92], [.08, .96], [.3, .88], [.5, .74], [.86, .72], [Z1, .62]]);
  const belt = C([[Z0, .62], [-.5, .68], [.1, .7], [.6, .62], [Z1, .56]]);
  const H = new Hull({ lod: L, z0: Z0, z1: Z1, sec: carSection({ w, sill, belt, top, tumble: .05, hMax: .4, tuck: .7, shoulder: .72 }), creases: [3], nz: 18, nz1: 7, nz2: 3, skipKnots: [1, 4] });
  H.build(); drawHull(b, H, { floor: true });
  // fenders wrap each tyre
  sym(() => { const t = .014; fender(b, fz, R + .02, R + .1, .17, .54, 2.82, .3, { nu: 10, t, roll: .035 }); fender(b, rz, R + .02, R + .1, .17, .56, 2.9, .22, { nu: 10, t, roll: .035 }); });
  if (hasMid(b)) {
    // seat, tank, handlebars
    use(TRIM, 0x1b1c1f, .95); gridSurf(L === 0 ? 10 : 5, L === 0 ? 6 : 3, (u, v, p) => { const z = lerp(-.74, -.14, u), hw = Math.min(.8 * w(z), .17) * Math.sqrt(Math.max(.1, 1 - Math.pow(Math.abs(u * 2 - 1), 4))), x = lerp(-hw, hw, v), k = 1 - Math.pow(Math.abs(v * 2 - 1), 3); p[0] = x; p[1] = top(z) + .004 + .075 * k; p[2] = z; }, false, [0, .4, -.3]);
    use(TRIM, frame); const barY = 1.16, barZ = .36; tube([[0, .82, .2], [0, barY - .04, barZ - .02]], .022, 6); tube([[-.4, barY + .03, barZ - .06], [-.2, barY + .02, barZ - .02], [0, barY, barZ], [.2, barY + .02, barZ - .02], [.4, barY + .03, barZ - .06]], .014, 6);
    use(RUBBER, 0x101012); sym(() => cyl(.3, barY + .025, barZ - .04, .43, barY + .035, barZ - .07, .022, .022, 6));
    sym(() => { use(TRIM, frame); tube([[.14, .32, .62], [.22, .52, .74], [.21, .62, .86]], .018, 5); tube([[.14, .3, -.46], [.2, .48, -.62], [.18, .66, -.72]], .018, 5); });
    use(TRIM, frame); tube([[.12, .25, -.75], [.12, .25, .85]], .022, 5); tube([[-.12, .25, -.75], [-.12, .25, .85]], .022, 5);
    sym(() => headlamp(.13, .73, .99, .058, .05, 0x141517)); sym(() => rectLamp(.11, .72, -1.015, .08, .04, 0xb01a14, .02, -1));
  }
  if (!hasMid(b)) { use(TRIM, frame); tube([[0, .8, .2], [0, 1.14, .35]], .026, 3); tube([[-.42, 1.19, .3], [0, 1.16, .36], [.42, 1.19, .3]], .02, 3); use(TRIM, 0x1b1c1f); box(0, .89, -.44, .26, .09, .6); }
  if (hasDetail(b)) {
    // racks, footwells, suspension, exhaust, mirror-free controls
    const rack = (z0, z1, y) => { use(TRIM, 0x202226); tube([[.3, y, z0], [.3, y, z1], [-.3, y, z1], [-.3, y, z0]], .011, 5, true); for (let i = 1; i < 5; i++) { const z = lerp(z0, z1, i / 5); cyl(-.3, y, z, .3, y, z, .007, .007, 4); } sym(() => { tube([[.26, y - .1, z0 + .03], [.3, y, z0 + .05]], .009, 4); tube([[.26, y - .1, z1 - .03], [.3, y, z1 - .05]], .009, 4); }); };
    rack(-.98, -.56, .83); rack(.62, .98, .79);
    sym(() => { use(TRIM, 0x1e1f22); box(.32, .3, .03, .2, .022, .36, .008); for (let i = 0; i < 4; i++) box(.32, .315, -.1 + i * .09, .18, .01, .02, .003);
      use(TRIM, frame); tube([[.13, .28, .64], [.42, R - .03, fz]], .014, 5); tube([[.13, .36, .64], [.42, R + .08, fz]], .014, 5); tube([[.14, .28, -.58], [.42, R - .03, rz]], .014, 5); use(CHROME, 0x9a9da0); tube([[.26, R + .05, fz + .06], [.17, .55, fz + .02]], .018, 6); });
    use(TRIM, 0x202124); box(0, .36, .06, .22, .26, .4, .05); use(TRIM, 0x111214); for (let i = 0; i < 3; i++) box(.112, .36, -.06 + i * .11, .004, .2, .06);
    exhaustPipe([[.09, .4, -.1], [.22, .46, -.6], [.26, .5, -1.0]], .025); use(CHROME, 0x5a5b5e); cyl(.26, .5, -.74, .26, .5, -1.02, .05, .05, 8);
    use(TRIM, frame); lathe(0, .965, -.0, 0, 1, 0, [[.05, 0, 1], [.05, .018, 1], [0, .024]], 8); use(TRIM, 0x111214); box(0, 1.19, .32, .1, .03, .07, .01); box(.34, 1.13, .29, .06, .02, .03, .005); towHook(0, .33, -1.04, -1);
    H.on(.62, 5, .004, () => { use(TRIM, 0x121315); for (let i = 0; i < 3; i++) box(0, -.02 + i * .03, 0, .005, .012, .14, .002); });
  }
  b.axle(fz, .4, R, .22, 'quad', { steer: true, steerMax: .62, axle: 0 }); b.axle(rz, .42, R, .25, 'quad', { axle: 1 }); b.pivot = [0, .5, 0];
  b.seats.push({ role: 'driver', p: [0, .95, -.32], yaw: 0 }); b.cams = { driver: [0, 1.6, -.28], chase: [0, 1.9, -3.8] };
  b.head = [[.13, .73, 1.0], [-.13, .73, 1.0]]; b.tail = [[.11, .72, -1.02], [-.11, .72, -1.02]];
}

// ---------------------------------------------------------------------------------------------
// FARM TRACTOR: huge rear wheels, slim hood, glazed cab, front weights, hitch.
function buildTractor(b) {
  const L = b.lod, Rf = .55, Rr = .92, fz = 1.5, rz = -.75, Z0 = -.72, Z1 = 2.32, cabCol = b.paint;
  const w = C([[.36, .48], [.6, .44], [1.4, .42], [2.05, .41], [2.26, .36], [Z1, .28]]), sill = C([[.36, .6], [1.1, .6], [2.0, .64], [Z1, .78]]);
  const top = C([[.36, 1.52], [.7, 1.58], [1.5, 1.56], [2.05, 1.5], [2.25, 1.32], [Z1, 1.12]]), belt = C([[.36, 1.28], [1.5, 1.3], [2.2, 1.18], [Z1, 1.04]]);
  const hood = new Hull({ lod: L, z0: .36, z1: Z1, sec: carSection({ w, sill, belt, top, tumble: .06, hMax: .3, tuck: .95 }), creases: [3], nz: 16, nz1: 6, nz2: 2 }); hood.build(); drawHull(b, hood, { capF: true });
  const cw = C([[Z0, .62], [-.62, .71], [0, .75], [.46, .71], [.58, .62]]), cs = C([[Z0, 1.4], [.58, 1.4]]), cb = C([[Z0, 1.62], [-.6, 1.66], [.45, 1.66], [.58, 1.62]]), ct = C([[Z0, 1.86], [-.62, 2.5], [-.42, 2.72], [.2, 2.76], [.42, 2.7], [.52, 2.42], [.58, 1.86]]);
  const cab = new Hull({ lod: L, z0: Z0, z1: .58, sec: carSection({ w: cw, sill: cs, belt: cb, top: ct, tumble: .1, hMax: 1.1, tuck: .98, shoulder: .75 }), creases: [3, 4], nz: 16, nz1: 6, nz2: 2, keys: [-.42, .42] });
  cab.hole([[-.55, 3.06], [-.08, 3.06], [-.08, 3.92], [-.5, 3.92]], {}); cab.hole([[-.02, 3.06], [.42, 3.06], [.38, 3.92], [-.02, 3.92]], {}); cab.hole([[.44, 4.1], [.53, 4.2], [.53, 5.97], [.44, 5.97]], { depth: .022 }); cab.hole([[-.71, 4.2], [-.62, 4.08], [-.62, 5.9], [-.71, 5.9]], { depth: .022 });
  const doors = [{ name: 'cab', z0: -.56, z1: .46, t0: .2, t1: 3.03, th: 2.4 }]; planDoors(b, cab, doors); cab.build(); drawHull(b, cab, { liner: [-.7, .56], capFCol: cabCol }); drawDoors(b, cab, doors, cabCol);
  use(PAINT, cabCol); box(0, 2.79, -.08, 1.42, .05, 1.36, .025); xf(0, 2.8, .56, .14, 0, 0, () => box(0, 0, 0, 1.3, .03, .16, .01));
  use(TRIM, 0x1d1e20); box(0, .94, -.3, .98, .98, 1.6, .12); box(0, .82, .78, .54, .42, 1.2, .06); cyl(-.9, Rr, rz, .9, Rr, rz, .1, .1, 8); cyl(-.72, Rf, fz, .72, Rf, fz, .06, .06, 6);
  sym(() => fender(b, rz, Rr, Rr + .14, .46, 1.1, 2.75, .5, { nu: 12, t: .016, roll: .05 }));
  sym(() => fender(b, fz, Rf + .02, Rf + .08, .42, .78, 2.6, .6, { nu: 8, t: .012, roll: .03 }));
  if (hasMid(b)) {
    use(TRIM, 0x121315); box(0, 1.1, Z1 + .004, .5, .44, .025, .012); sym(() => headlamp(.27, 1.3, Z1 - .07, .068, .1)); sym(() => { use(PAINT, cabCol); box(.8, 1.82, -.74, .12, .08, .22, .02); use(LAMP, 0xb01a14); box(.8, 1.82, -.86, .08, .05, .012, .004); });
    use(PAINT, 0x202224); for (let i = 0; i < 7; i++) box(0, .82, 2.28 + i * .075, .92, .3, .055, .012); use(TRIM, 0x121315); box(0, .82, 2.82, .3, .05, .03, .012);
    use(CHROME, 0x4a4b4e); tube([[.22, 1.54, 1.72], [.22, 1.72, 1.72], [.22, 2.7, 1.72]], .045, hasDetail(b) ? 8 : 5); xf(.22, 2.72, 1.72, .38, 0, 0, () => { use(TRIM, 0x1a1b1d); cyl(0, 0, 0, 0, .1, 0, .05, .05, 7); });
  } else { use(TRIM, 0x121315); box(0, 1.1, Z1 - .01, .46, .4, .05); sym(() => hood.lampOn(.22, 1.3, .1, .08, 0xfff0c8)); use(PAINT, 0x202224); box(0, .82, 2.5, .9, .3, .46); use(CHROME, 0x3a3b3e); cyl(.22, 1.5, 1.72, .22, 2.7, 1.72, .045, .045, 4); }
  if (hasDetail(b)) {
    use(TRIM, 0x0c0d0e, .7); for (let i = 0; i < 7; i++) box(0, .92 + i * .05, Z1 + .017, .46, .018, .012, .004);
    sym(() => { use(TRIM, 0x0d0e10); for (let i = 0; i < 5; i++) { hood.on(.8 + i * .24, 2.6, .004, () => box(0, 0, 0, .006, .14, .14, .002)); } hood.seam([[.5, 3.5], [2.1, 3.5]], .008); });
    sym(() => { wiper(.1, 1.68, .55, .46, .18); mirrorArm(.72, 2.42, .42, 1, true); use(TRIM, 0x1a1b1d); for (let k = 0; k < 3; k++) box(.78, .36 + k * .26, .12, .22, .03, .24, .008); tube([[.88, .35, .24], [.9, 1.3, .22]], .012, 4); use(LAMP, 0xfff3d2); box(.44, 2.72, .56, .14, .07, .03, .012); box(.42, 2.72, -.72, .14, .07, .03, .012); });
    use(LAMP, 0xff9a1e); lathe(0, 2.82, -.36, 0, 1, 0, [[.05, 0, 1], [.042, .08], [0, .1]], 8);
    use(TRIM, 0x202124); sym(() => { tube([[.28, .62, -1.02], [.42, .42, -1.45], [.44, .4, -1.62]], .026, 6); tube([[.18, 1.28, -1.02], [.26, .92, -1.5]], .02, 5); box(.44, .4, -1.62, .05, .08, .1, .012); }); tube([[0, 1.16, -1.05], [0, 1.0, -1.5]], .026, 5); box(0, .8, -1.08, .32, .22, .2, .03); cyl(0, .68, -1.2, 0, .68, -1.4, .028, .028, 6);
    use(PAINT, cabCol); box(.64, 1.38, -.66, .16, .3, .3, .03); use(TRIM, 0x111214); lathe(.64, 1.54, -.66, 0, 1, 0, [[.05, 0, 1], [.05, .02, 1], [0, .03]], 8);
    cabin(b, { y: 1.43, dashZ: .38, dashY: 1.98, dashW: .5, seats: [[0, -.3, .1, .52]], wheelX: 0, wheelY: 2.08, wheelZ: .12 });
    towHook(0, .72, 2.92);
  }
  b.axle(fz, .7, Rf, .3, 'tractor', { steer: true, steerMax: .62, axle: 0, drive: false }); b.axle(rz, .86, Rr, .46, 'tractor', { axle: 1 }); b.pivot = [0, 1.05, .2];
  b.seats.push({ role: 'driver', p: [0, 2.0, -.3] }); b.cams = { driver: [0, 2.58, -.25], chase: [0, 4.6, -7.4], hood: [0, 2.0, 1.5] };
  b.head = [[.27, 1.3, Z1], [-.27, 1.3, Z1]]; b.tail = [[.8, 1.82, -.87], [-.8, 1.82, -.87]];
}

// ---------------------------------------------------------------------------------------------
// FORKLIFT: counterweight body, overhead guard, lifting mast and forks.
function buildForklift(b) {
  const L = b.lod, Rf = .35, Rr = .27, fz = .62, rz = -.98, Z0 = -1.44, Z1 = .82, col = b.paint, dark = 0x1d1e21;
  const w = C([[Z0, .32], [-1.32, .5], [-1.05, .56], [-.3, .56], [.6, .54], [Z1, .48]]), sill = C([[Z0, .46], [-1.2, .28], [-.5, .24], [.6, .25], [Z1, .36]]);
  const belt = C([[Z0, .86], [-1.2, 1.0], [-.3, 1.0], [.5, .98], [Z1, .9]]), top = C([[Z0, .98], [-1.34, 1.2], [-1.1, 1.34], [-.82, 1.36], [-.6, 1.14], [-.2, 1.08], [.3, 1.12], [.6, 1.1], [Z1, 1.0]]);
  const H = new Hull({ lod: L, z0: Z0, z1: Z1, sec: carSection({ w, sill, belt, top, tumble: .08, hMax: .34, tuck: .93 }), creases: [3], nz: 18, nz1: 7, nz2: 2 });
  H.arch(fz, Rf, Rf + .07, { flare: .018, depth: .28 }); H.arch(rz, Rr, Rr + .07, { flare: .018, depth: .28 }); H.build(); drawHull(b, H, {});
  use(TRIM, dark); box(0, 1.07, -.05, .9, .03, 1.2, .012);
  // Overhead guard: four posts and a slatted roof
  const gy = 2.12; use(PAINT, dark);
  sym(() => { tube([[.47, 1.0, -1.05], [.47, gy - .06, -.82], [.44, gy, -.72]], .03, hasMid(b) ? 6 : 4); tube([[.47, 1.02, .55], [.47, 1.6, .5], [.45, gy - .05, .24], [.44, gy, .1]], .03, hasMid(b) ? 6 : 4); });
  if (hasMid(b)) { tube([[.44, gy, .1], [.44, gy, -.72]], .025, 5); tube([[-.44, gy, .1], [-.44, gy, -.72]], .025, 5); for (let i = 0; i < (L ? 3 : 7); i++) { const z = lerp(.08, -.7, i / (L ? 2 : 6)); cyl(-.44, gy + .01, z, .44, gy + .01, z, .012, .012, 4); } }
  else { box(0, gy, -.3, .88, .03, .85); }
  // Mast, carriage, forks
  const mz = .96, mh = 2.58, mast = () => { use(PAINT, 0x24262a); sym(() => { box(.36, mh / 2 + .06, mz, .06, mh, .18, .012); box(.27, mh / 2 + .12, mz + .02, .05, mh - .1, .1, .01); }); box(0, mh + .05, mz, .78, .07, .16, .012); box(0, 1.3, mz, .66, .05, .1, .01); box(0, .28, mz, .78, .1, .18, .012); };
  mast(); use(TRIM, 0x17181a); box(0, .62, mz + .1, .78, .3, .05, .012); box(0, .78, mz + .1, .74, .05, .06, .01);
  if (hasDetail(b)) { for (let i = 0; i < 5; i++) { const x = lerp(-.28, .28, i / 4); box(x, .63, mz + .13, .028, .3, .012, .003); } use(TRIM, 0x101113); for (const x of [-.14, .14]) { cyl(x, .3, mz - .02, x, 2.5, mz - .02, .02, .02, 5); } sym(() => { const p = []; for (let i = 0; i < 16; i++) p.push([.13, lerp(.42, 2.46, i / 15), mz + .05]); tube(p, .014, 4); use(CHROME, 0x8f9397); cyl(.22, .62, mz - .02, .22, 1.4, mz - .02, .028, .028, 6); use(TRIM, 0x101113); }); }
  use(TRIM, 0x262729); sym(() => extrudeX([[mz + .04, .07], [mz + 1.22, .05], [mz + 1.24, .075], [mz + .14, .13], [mz + .12, .78], [mz + .04, .78]], .17, .29, .008));
  if (hasMid(b)) {
    use(PAINT, dark); sym(() => { headlamp(.3, 1.08, .68, .055, .05); rectLamp(.46, .92, Z0 + .01, .09, .06, 0xb01a14, .018, -1); }); use(TRIM, 0x121315); box(0, .78, Z0 + .01, .5, .22, .025, .01);
    use(TRIM, 0x1b1c1e, .95); seat(0, 1.1, -.3, .5, 0x1e1f22); wheelRing(.0, 1.46, .28, .17, -.95); use(TRIM, 0x1b1c1e); cyl(0, 1.42, .32, 0, 1.08, .45, .03, .04, 6);
    use(PAINT, 0x1f2023); box(.26, 1.14, .46, .06, .12, .18, .012); for (let i = 0; i < 4; i++) { use(TRIM, 0x121315); box(-.3 + i * .05, 1.26, .34, .012, .12, .012, .003); dome(-.3 + i * .05, 1.33, .34, .018, .018, .018, 2, 6); }
    use(TRIM, 0x18191b); box(0, .3, -.12, .56, .03, .5, .01);
  }
  if (hasDetail(b)) {
    use(PAINT, 0xd8d0b8); xf(0, .78, Z0 - .0, 0, 0, 0, () => { }); sym(() => { use(PAINT, 0x1a1b1d); for (let i = 0; i < 6; i++) { H.on(-.9 + i * .06, 2.65, .003, () => box(0, 0, 0, .003, .24, .022)); } });
    use(TRIM, 0x202124); box(0, .54, Z0 - .004, .36, .1, .02, .006); use(CHROME, 0xb0b4b6); box(0, .6, Z0 - .01, .16, .025, .008, .002); use(LAMP, 0xff9a1e); lathe(.4, gy + .04, -.72, 0, 1, 0, [[.04, 0, 1], [.03, .06], [0, .08]], 8);
    use(TRIM, 0x202124); sym(() => box(.42, .3, .12, .18, .03, .34, .006)); exhaustPipe([[-.46, 1.1, -1.14], [-.48, 1.4, -1.14], [-.48, 1.62, -1.16]], .025); H.seam([[-.72, 3.6], [-.72, 5.8]], .008); H.seam([[-.72, 3.6], [.72, 3.6]], .008);
  }
  b.axle(fz, .48, Rf, .24, 'fork', { axle: 0 }); b.axle(rz, .47, Rr, .19, 'fork', { steer: true, steerMax: .95, axle: 1, drive: false }); b.pivot = [0, .62, -.3];
  b.seats.push({ role: 'driver', p: [0, 1.36, -.3] }); b.cams = { driver: [0, 1.92, -.24], chase: [0, 3.2, -5.2], forks: [0, 1.6, .8] };
  b.head = [[.3, 1.08, .73], [-.3, 1.08, .73]]; b.tail = [[.46, .92, Z0], [-.46, .92, Z0]]; b.extra.mast = { z: mz, height: mh };
}

// ---------------------------------------------------------------------------------------------
// CIVILIAN CAR: compact three-box saloon with a sloping hood and a short boot.
function buildCar(b) {
  const L = b.lod, R = .315, fz = 1.3, rz = -1.3, Z0 = -2.12, Z1 = 2.12;
  const w = C([[Z0, .74], [Z0 + .12, .84], [-1.2, .89], [.4, .9], [1.4, .885], [1.85, .84], [2.05, .74], [Z1, .6]]);
  const sill = C([[Z0, .47], [Z0 + .24, .35], [-1.1, .23], [1.1, .23], [1.85, .31], [Z1, .45]]);
  const belt = C([[Z0, .9], [Z0 + .22, .95], [-.6, .93], [.5, .9], [1.3, .84], [1.9, .75], [Z1, .6]]);
  const top = C([[Z0, .86], [Z0 + .1, .98], [-1.74, 1.02], [-1.58, 1.06], [-1.12, 1.38], [-.78, 1.44], [.1, 1.46], [.38, 1.42], [.86, 1.03], [1.02, .96], [1.7, .87], [2.02, .76], [Z1, .62]]);
  const H = new Hull({ lod: L, z0: Z0, z1: Z1, sec: carSection({ w, sill, belt, top, tumble: .2, hMax: .55 }), creases: [3], nz: 26, nz1: 9, nz2: 2, keys: [-1.58, -1.12, .38, .86, 1.02], doorX: .9 });
  H.arch(fz, R, R + .062, { flare: .022, depth: .34 }); H.arch(rz, R, R + .062, { flare: .022, depth: .34 });
  H.hole([[.03, 3.08], [.84, 3.08], [.42, 3.92], [.03, 3.92]], {}); H.hole([[-1.08, 3.08], [-.05, 3.08], [-.05, 3.92], [-.82, 3.92]], {});
  H.hole([[.44, 4.2], [.84, 4.22], [.84, 6], [.44, 6]], { depth: .024 }); H.hole([[-1.52, 4.22], [-1.16, 4.2], [-1.16, 6], [-1.52, 6]], { depth: .024 });
  const doors = [{ name: 'front', z0: 0, z1: .9, t0: .2, t1: 3.03, th: 2.62 }, { name: 'rear', z0: -.98, z1: -.04, t0: .2, t1: 3.03, th: 2.62 }];
  planDoors(b, H, doors); H.build(); drawHull(b, H, { liner: [-1.55, .95] }); drawDoors(b, H, doors, b.paint);
  bumper(b, Z1 + .01, .46, .86, .17, .16, { curve: .24, col: 0x1e1f22, chin: .03 }); bumper(b, Z0 - .01, .5, .84, .16, .14, { curve: .1, col: 0x1e1f22, end: -1 });
  sym(() => H.lampOn(.56, .71, .3, .11, 0xfff3d2));
  use(TRIM, 0x0d0e10); box(0, .64, Z1 - .02, .72, .1, .05);
  sym(() => { use(TRIM, 0x141517); rectLamp(.62, .82, Z0 + .02, .24, .1, 0xb01a14, .022, -1); });
  if (hasDetail(b)) {
    grilleBars(0, .64, Z1 + .004, .68, .08, 3, 0x0b0c0d, 0x2f3134);
    H.seam([[1.04, 3.98], [1.95, 3.82]], .007); H.seam([[1.04, 3.98], [1.04, 6]], .007); H.seam([[1.94, 3.82], [1.94, 6]], .007); H.seam([[-1.7, 3.9], [-2, 3.8]], .007); H.seam([[-1.7, 3.9], [-1.7, 6]], .007);
    sym(() => { wiper(.08, 1.02, .9, .38, .18); mirrorArm(.86, 1.02, .78); use(TRIM, 0x17181a); box(.895, .32, 0, .03, .05, 1.7, .012); H.on(1.62, 2.3, .004, () => { use(LAMP, 0xffa02a); box(0, 0, 0, .012, .025, .06); }); });
    H.on(-1.55, 2.5, .005, () => { use(TRIM, 0x121315); lathe(0, 0, 0, 1, 0, 0, [[.045, 0, 1], [.045, .007, 1], [0, .01]], 8); });
    use(TRIM, 0x101113); box(0, .68, Z0 - .004, .3, .1, .012); exhaustPipe([[.2, .2, -.6], [.3, .2, -1.9], [.42, .22, -2.17]], .024);
    cabin(b, { y: .32, dashZ: .74, dashY: .92, dashW: .72, seats: [[.4, .08, .08, .44], [-.4, .08, .08, .44], [.4, -.82, .08, .44], [-.4, -.82, .08, .44]], wheelX: .4, wheelY: 1.0, wheelZ: .48, floorZ0: -1.3, floorZ1: .8, floorW: .8 });
    solidAxle(b, rz, .68, R, .02); solidAxle(b, fz, .68, R, .02, false);
  }
  b.axle(fz, .755, R, .2, 'road', { steer: true, axle: 0 }); b.axle(rz, .755, R, .2, 'road', { axle: 1 }); b.pivot = [0, .58, .05];
  b.seats.push({ role: 'driver', p: [.4, .86, .08] }, { role: 'passenger', p: [-.4, .86, .08] }, { role: 'rearL', p: [.4, .86, -.82] }, { role: 'rearR', p: [-.4, .86, -.82] });
  b.cams = { driver: [.4, 1.28, .12], chase: [0, 2.3, -5.6], hood: [0, 1.2, 1.1] }; b.head = [[.56, .71, Z1], [-.56, .71, Z1]]; b.tail = [[.62, .82, Z0], [-.62, .82, Z0]];
}

// ---------------------------------------------------------------------------------------------
// LOG TRUCK: forward cab, long frame, steel bolsters and a stacked load of trunks.
function buildLogtruck(b) {
  const L = b.lod, R = .54, Z0c = 2.0, Z1 = 4.5, fz = 3.05, r1 = -1.3, r2 = -2.62, r3 = -3.62;
  const w = C([[Z0c, 1.08], [Z0c + .1, 1.18], [3.2, 1.22], [3.9, 1.22], [4.3, 1.17], [4.44, 1.08], [Z1, .96]]);
  const sill = C([[Z0c, .92], [Z0c + .25, .8], [3.8, .78], [4.33, .84], [Z1, 1]]);
  const belt = C([[Z0c, 1.76], [3, 1.78], [4, 1.72], [4.4, 1.58], [Z1, 1.32]]);
  const top = C([[Z0c, 1.95], [Z0c + .04, 2.7], [Z0c + .14, 2.92], [Z0c + .45, 3.0], [3.5, 3.02], [3.86, 2.94], [4.2, 2.42], [4.42, 1.82], [4.47, 1.48], [Z1, 1.32]]);
  const H = new Hull({ lod: L, z0: Z0c, z1: Z1, sec: carSection({ w, sill, belt, top, tumble: .09, hMax: 1.25, tuck: .975 }), creases: [3], nz: 11, nz1: 4, nz2: 1, tPer: 2, keys: [3.86, 4.2, 4.42], doorX: 1.21 });
  H.arch(fz, R + .02, R + .12, { flare: .025, depth: .48 });
  H.hole([[3.12, 3.08], [4.14, 3.08], [3.88, 3.9], [3.2, 3.9]], {}); H.hole([[2.26, 3.3], [2.98, 3.3], [2.98, 3.9], [2.26, 3.9]], {}); H.hole([[3.88, 4.12], [4.38, 4.25], [4.38, 6], [3.88, 6]], { depth: .026 });
  const doors = [{ name: 'cab', z0: 3.08, z1: 4.2, t0: .3, t1: 3.03, th: 2.58 }]; planDoors(b, H, doors); H.build(); drawHull(b, H, { liner: [Z0c + .1, 4.3] }); drawDoors(b, H, doors, b.paint);
  chassisRails(b, .5, .9, -4.4, 3.2, .22);
  use(TRIM, 0x202226); box(0, 1.03, -.6, 2.1, .1, 7.3, L ? 0 : .012);
  // Bolsters with stakes, then the logs
  const bol = L === 2 ? [-3.1, -.6, 1.6] : [-3.5, -2.3, -.9, .5, 1.75];
  for (const z of bol) { use(TRIM, 0x34373b); box(0, 1.14, z, 2.4, .13, .16, L ? 0 : .02); sym(() => { use(TRIM, 0x3a3d41); box(1.14, 1.92, z, .1, 1.62, .12, L ? 0 : .012); }); }
  const nS = L === 0 ? 10 : L === 1 ? 7 : 8, logZ0 = -4.28, logZ1 = 2.0, rows = [[-.8, 0, .8], [-.4, .4], [0]], bark = [0x4a3524, 0x54402b, 0x3f2d20, 0x5c4630], cut = [0xb08c5a, 0xa47f50, 0xbb9866];
  rows.forEach((row, ri) => row.forEach((x, i) => {
    const r = .35 + hash3(ri, i, 3) * .05, y = 1.56 + ri * .62, off = hash3(i, ri, 9) * .16 - .08, c = bark[(ri * 3 + i) % 4], z0 = logZ0 + off, z1 = logZ1 + off + hash3(i, ri, 4) * .12;
    use(CANVAS, c, .92); roundBig(() => lathe(x, y, z0, 0, 0, 1, L === 0 ? [[r * .97, 0], [r, .5], [r * .95, (z1 - z0) * .5], [r * .96, z1 - z0]] : [[r, 0], [r, z1 - z0]], L === 2 ? 8 : nS));
    for (const [zz, s] of [[z0, -1], [z1, 1]]) { use(CANVAS, cut[(i + ri) % 3]); const q = L ? [[r * .96, 0, 1], [.001, s * .01]] : [[r * .96, 0, 1], [r * .5, s * .004], [0, s * .012]]; roundBig(() => lathe(x, y, zz, 0, 0, 1, q, L === 2 ? 8 : nS));
      if (hasDetail(b)) { use(CANVAS, 0x7e5e38, .9); for (const k of [.55]) { const P = []; for (let a = 0; a < 8; a++) { const t = TAU * a / 8; P.push([x + Math.cos(t) * r * k, y + Math.sin(t) * r * k, zz + s * .012]); } tube(P, .006, 3, true); } } }
  }));
  if (hasDetail(b)) for (const z of [-3.1, -.7, 1.3]) { const P = [[-1.2, 1.3, z], [-1.2, 3.02, z], [-.5, 3.34, z], [.5, 3.34, z], [1.2, 3.02, z], [1.2, 1.3, z]]; strap(P, .05, 0x1f2022); use(CHROME, 0x777a7e); box(1.2, 1.5, z, .05, .12, .08, .01); }
  bumper(b, Z1 + .03, .9, 1.23, .22, .22, { curve: .12, col: 0x2a2b2e, chin: .05 }); bumper(b, -4.5, .72, 1.12, .12, .1, { curve: .03, col: 0x202124, end: -1 });
  use(TRIM, 0x0f1012); box(0, 1.18, Z1 - .012, 1.4, .5, .05); sym(() => H.lampOn(.82, 1.06, .34, .15, 0xfff0c8));
  sym(() => { use(TRIM, 0x121315); rectLamp(.92, .82, -4.54, .14, .1, 0xb01a14, .02, -1); });
  if (hasMid(b)) { solidAxle(b, fz, 1.0, R, .08, false); for (const z of [r1, r2, r3]) solidAxle(b, z, 1.0, R, .08); }
  if (hasDetail(b)) {
    use(CHROME, 0xb7b9ba); for (let i = 0; i < 6; i++) box(0, .98 + i * .085, Z1 + .012, 1.34, .022, .018);
    sym(() => { wiper(.2, 1.84, 4.34, .66, .2); mirrorArm(1.23, 2.42, 3.98, 1, true); use(TRIM, 0x202124); box(1.25, .66, 3.42, .2, .03, .34); box(1.25, .44, 3.42, .2, .03, .34); mudflap(1.0, -4.3, .2, .72, .46, .9, .52); mudflap(1.0, 2.42, .2, .66, .46, .92, .6); });
    use(CHROME, 0x4a4b4e); tube([[-1.02, 1.0, 1.98], [-1.14, 1.5, 1.92], [-1.14, 3.22, 1.92]], .055, 7); use(TRIM, 0x1a1b1d); cyl(-1.14, 1.9, 1.92, -1.14, 2.45, 1.92, .08, .08, 8);
    use(PAINT, b.paint); box(1.05, 1.08, .3, .34, .44, .85, .03); use(TRIM, 0x121315); box(0, 2.22, 1.95, 2.3, 1.7, .1, .02); for (let i = -2; i <= 2; i++) box(i * .42, 2.22, 1.89, .04, 1.62, .03);
    cabin(b, { y: 1.02, dashZ: 4.18, dashY: 1.74, dashW: .98, seats: [[.54, 3.46], [-.54, 3.46]], wheelX: .54, wheelY: 1.76, wheelZ: 3.92 });
    towHook(.5, .84, Z1 + .18); towHook(-.5, .84, Z1 + .18);
  }
  b.axle(fz, 1.03, R, .32, 'truck', { steer: true, steerMax: .55, axle: 0, drive: false }); b.axle(r1, .98, R, .44, 'truck', { axle: 1, dual: true }); b.axle(r2, .98, R, .44, 'truck', { axle: 2, dual: true }); b.axle(r3, .98, R, .44, 'truck', { axle: 3, dual: true, drive: false });
  b.pivot = [0, 1.4, -.3]; b.seats.push({ role: 'driver', p: [.54, 1.66, 3.46] }, { role: 'passenger', p: [-.54, 1.66, 3.46] }); b.cams = { driver: [.54, 2.34, 3.52], chase: [0, 5, -11.5], hood: [0, 2.6, 4.3] };
  b.head = [[.82, 1.06, Z1], [-.82, 1.06, Z1]]; b.tail = [[.92, .82, -4.55], [-.92, .82, -4.55]];
}

// ---------------------------------------------------------------------------------------------
// TRACKED SNOW CARRIER: two wide rubber tracks, sloped nose, glazed cab, rear load box.
function trackLoop(b, xc, hw, zb, ze, rB, rE, yC, grousers) {
  const lf = ze - zb, per = 2 * lf + TAU * ((rB + rE) / 2), P = (u, o, q) => {
    let s = u * per; const r0 = rB + o, r1 = rE + o;
    if (s < lf) { q[1] = yC - r0; q[2] = zb + s; return; } s -= lf;
    const a1 = Math.PI * rE; if (s < a1) { const a = -Math.PI / 2 + s / rE; q[1] = yC + Math.sin(a) * r1; q[2] = ze + Math.cos(a) * r1; return; } s -= a1;
    if (s < lf) { q[1] = yC + lerp(r1, r0, s / lf); q[2] = ze - s; return; } s -= lf;
    const a = Math.PI / 2 + s / rB; q[1] = yC + Math.sin(a) * r0; q[2] = zb + Math.cos(a) * r0;
  };
  const q = [0, 0, 0], nU = b.lod === 0 ? 44 : b.lod === 1 ? 18 : 14;
  use(RUBBER, 0x1a1a1b);
  gridSurf(nU, 1, (u, v, p) => { P(((u % 1) + 1) % 1, 0, q); p[0] = xc + (v * 2 - 1) * hw; p[1] = q[1]; p[2] = q[2]; }, true, [xc, yC, (zb + ze) / 2]);
  use(RUBBER, 0x141415, .55);
  for (const s of [-1, 1]) { const x = xc + s * hw, outer = [], inner = []; for (let i = 0; i < nU; i++) { P(i / nU, 0, q); outer.push(V(x, q[1], q[2], s, 0, 0)); P(i / nU, -.09, q); inner.push(V(x, q[1], q[2], s, 0, 0)); } for (let i = 0; i < nU; i++) Q(outer[i], outer[(i + 1) % nU], inner[(i + 1) % nU], inner[i]); }
  use(RUBBER, 0x101011, .6); { const x = xc + hw * .5, c = V(x, yC, (zb + ze) / 2, 1, 0, 0), ring = []; for (let i = 0; i < nU; i++) { P(i / nU, -.06, q); ring.push(V(x, q[1], q[2], 1, 0, 0)); } for (let i = 0; i < nU; i++) T(c, ring[i], ring[(i + 1) % nU]); }
  if (b.lod < 2) { const n = b.lod === 0 ? grousers : grousers >> 2; use(RUBBER, 0x252526); for (let i = 0; i < n; i++) { const u = i / n; P(u, .02, q); const y = q[1], z = q[2]; P(u + .002, .02, q); xf(xc, y, z, -Math.atan2(q[1] - y, q[2] - z), 0, 0, () => box(0, 0, 0, hw * 1.96, .045, .085)); } }
}
function buildTracked(b) {
  const L = b.lod, Z0 = -3.05, Z1 = 3.05, xT = 1.34, hwT = .36, snow = b.variant === 'snow';
  const w = C([[Z0, .9], [Z0 + .14, .98], [0, 1.02], [2.2, 1.0], [2.8, .9], [Z1, .76]]), sill = C([[Z0, .9], [Z0 + .4, .72], [1.9, .72], [2.7, .86], [Z1, 1.08]]);
  const belt = C([[Z0, 1.72], [-1, 1.88], [.9, 1.94], [1.7, 1.82], [2.6, 1.62], [Z1, 1.32]]);
  const top = C([[Z0, 1.78], [Z0 + .1, 1.98], [-1.05, 2.04], [-.98, 2.2], [-.86, 2.72], [-.6, 2.86], [.75, 2.88], [1.05, 2.74], [1.62, 2.02], [1.84, 1.88], [2.6, 1.66], [Z1, 1.34]]);
  const H = new Hull({ lod: L, z0: Z0, z1: Z1, sec: carSection({ w, sill, belt, top, tumble: .12, hMax: .95, tuck: .96 }), creases: [3], nz: 20, nz1: 7, nz2: 2, keys: [-1.05, -.86, .75, 1.05, 1.62, 1.84], doorX: 1.02 });
  H.hole([[.28, 3.07], [1.5, 3.07], [1.04, 3.92], [.28, 3.92]], {}); H.hole([[-.72, 3.07], [.18, 3.07], [.18, 3.92], [-.72, 3.92]], {}); H.hole([[1.08, 4.16], [1.6, 4.2], [1.6, 6], [1.08, 6]], { depth: .026 }); H.hole([[-.95, 4.3], [-.88, 4.18], [-.88, 5.7], [-.95, 5.7]], { depth: .022 });
  const doors = [{ name: 'cab', z0: .24, z1: 1.3, t0: .34, t1: 3.03, th: 2.5 }]; planDoors(b, H, doors); H.build(); drawHull(b, H, { liner: [-.98, 1.66] }); drawDoors(b, H, doors, b.paint);
  const rW = .36, zs = L === 2 ? [-2.0, 0, 2.0] : [-2.2, -1.1, 0, 1.1, 2.2];
  sym(() => {
    trackLoop(b, xT, hwT, -2.42, 2.42, .56, .58, .58, 34);
    use(TRIM, 0x23252a); box(xT, .94, 0, hwT * 1.62, .07, 5.0, L ? 0 : .012);
    for (const z of zs) { use(TRIM, 0x3c3f44); const x0 = xT + hwT * .52, x1 = xT + hwT * .94, s = L === 2 ? 12 : 16; roundBig(() => lathe(x0, rW + .1, z, 1, 0, 0, L >= 1 ? [[rW, 0, 1], [rW, x1 - x0, 1], [.001, x1 - x0, 1]] : [[rW, 0, 1], [rW, x1 - x0, 1], [rW * .86, x1 - x0 + .012, 1], [rW * .8, x1 - x0 - .03, 1], [rW * .34, x1 - x0 - .02, 1], [rW * .3, x1 - x0 + .03, 1], [.001, x1 - x0 + .035, 1]], s)); if (hasDetail(b)) { use(CHROME, 0x777a7e); for (let i = 0; i < 5; i++) { const t = TAU * i / 5; stud(x1 - .012, rW + .1 + Math.cos(t) * .17, z + Math.sin(t) * .17, .018); } } }
    for (const [z, r] of [[-2.42, .4], [2.42, .46]]) { use(TRIM, 0x2c2e33); roundBig(() => lathe(xT + hwT * .5, .58, z, 1, 0, 0, [[r, 0, 1], [r, hwT * .42, 1], [.001, hwT * .42, 1]], L === 2 ? 12 : 16)); }
    if (hasMid(b)) { use(TRIM, 0x1c1d20); box(xT - .28, .96, 0, .38, .14, 4.7); }
  });
  use(TRIM, 0x1a1b1e); box(0, .62, 0, 1.7, .5, 5.3, L ? 0 : .03);
  // Rear load box under a tarp, blade mount, lamps, ladder
  use(PAINT, b.paint); extrudeX(roundPoly([[-3.0, 1.62], [-1.06, 1.62], [-1.06, 2.1], [-3.0, 2.1]], .05, 2), -.9, .9, L ? 0 : .02);
  if (b.wreck) { use(TRIM, 0x1c1a17, .8); for (const z of [-2.75, -2.05, -1.35]) { const P = []; for (let j = 0; j <= 6; j++) { const x = lerp(-.86, .86, j / 6); P.push([x, 2.1 + .32 * (1 - Math.pow(x / .86, 2)), z]); } tube(P, .025, 4); } }
  else { use(CANVAS, 0x565840); gridSurf(L === 0 ? 10 : 4, L === 0 ? 8 : 4, (u, v, p) => { const x = lerp(.88, -.88, v), z = lerp(-2.96, -1.08, u), k = 1 - Math.pow(Math.abs(x / .88), 2.6); p[0] = x; p[1] = 2.09 + .36 * k - .018 * Math.abs(Math.sin(u * 9.4)); p[2] = z; }, false, [0, 1.6, -2]); }
  use(TRIM, 0x121315); box(0, 1.32, Z1 - .04, 1.06, .34, .05); sym(() => H.lampOn(.62, 1.42, .18, .18, 0xfff0c8)); sym(() => { use(TRIM, 0x141517); rectLamp(.78, 1.5, Z0 + .02, .14, .2, 0xb01a14, .02, -1); });
  if (hasDetail(b)) {
    grilleBars(0, 1.32, Z1 - .012, .98, .28, 5, 0x0b0c0d, 0x303235);
    H.seam([[1.86, 3.92], [2.92, 3.7]], .009); H.seam([[1.86, 3.92], [1.86, 6]], .009); H.seam([[2.92, 3.7], [2.92, 6]], .009);
    sym(() => { wiper(.14, 1.98, 1.66, .46, .18); mirrorArm(1.0, 2.34, 1.42, 1, true); for (let k = 0; k < 2; k++) { use(TRIM, 0x1f2023); box(1.08, .9 + k * .3, 1.0, .2, .03, .34); } use(TRIM, 0x1a1b1d); tube([[.9, 2.92, -.5], [.9, 2.98, -.42], [.9, 2.98, .62], [.9, 2.92, .7]], .014, 5); use(LAMP, 0xfff3d2); box(.46, 2.9, .92, .16, .08, .05, .012); });
    use(LAMP, 0xff9a1e); lathe(0, 2.89, -.2, 0, 1, 0, [[.06, 0, 1], [.05, .09], [0, .12]], 8);
    if (!b.wreck) { use(CANVAS, 0x38382a, .85); for (const z of [-2.6, -2.05, -1.5]) { const P = []; for (let j = 0; j <= 8; j++) { const x = lerp(-.88, .88, j / 8); P.push([x, 2.09 + .36 * (1 - Math.pow(Math.abs(x / .88), 2.6)) + .006, z]); } tube(P, .009, 3); } }
    use(TRIM, 0x202124); box(0, .66, Z1 + .02, 1.2, .1, .1); towHook(.4, .72, Z1 + .08); towHook(-.4, .72, Z1 + .08); box(0, .78, Z0 - .04, .16, .1, .12, .012); jerrycan(.98, 2.2, -.86, 0x8e2a22); exhaustPipe([[-.8, 2.0, -.98], [-.8, 2.9, -.98], [-.8, 3.06, -.9]], .04);
    cabin(b, { y: 1.14, dashZ: 1.42, dashY: 2.02, dashW: .82, seats: [[.44, .42], [-.44, .42]], wheelX: .44, wheelY: 2.06, wheelZ: 1.14, floorZ0: -.8, floorZ1: 1.5, floorW: .84 });
  }
  if (snow && !b.wreck) { // snow lying on the roof, the load and the track guards
    use(PAINT, 0xe8edf2); gridSurf(L === 0 ? 8 : 3, L === 0 ? 6 : 3, (u, v, p) => { const z = lerp(-.74, .86, u), x = lerp(-.74, .74, v), k = Math.max(0, 1 - Math.pow(Math.abs(u * 2 - 1), 4)) * Math.max(0, 1 - Math.pow(Math.abs(v * 2 - 1), 4)); p[0] = x; p[1] = 2.87 + k * .1; p[2] = z; }, false, [0, 2, 0]);
    gridSurf(L === 0 ? 8 : 3, L === 0 ? 6 : 3, (u, v, p) => { const z = lerp(-2.9, -1.14, u), x = lerp(-.8, .8, v), k = Math.max(0, 1 - Math.pow(Math.abs(u * 2 - 1), 4)) * Math.max(0, 1 - Math.pow(Math.abs(v * 2 - 1), 4)); p[0] = x; p[1] = 2.095 + .36 * (1 - Math.pow(Math.abs(x / .88), 2.6)) + k * .1; p[2] = z; }, false, [0, 1.6, -2]);
    sym(() => { use(PAINT, 0xe8edf2); gridSurf(L === 0 ? 10 : 3, 2, (u, v, p) => { const z = lerp(-2.4, 2.4, u), x = lerp(xT - .26, xT + .26, v), k = Math.sqrt(Math.max(0, 1 - Math.pow(u * 2 - 1, 8))) * (1 - Math.pow(v * 2 - 1, 2)); p[0] = x; p[1] = 1.0 + k * .09; p[2] = z; }, false, [xT, .6, 0]); });
  }
  b.pivot = [0, 1.1, 0]; b.seats.push({ role: 'driver', p: [.44, 1.74, .42] }, { role: 'passenger', p: [-.44, 1.74, .42] }); b.cams = { driver: [.44, 2.4, .5], chase: [0, 4.6, -8.5], hood: [0, 2.6, 1.9] };
  b.head = [[.62, 1.42, Z1], [-.62, 1.42, Z1]]; b.tail = [[.78, 1.5, Z0], [-.78, 1.5, Z0]];
}

// ---------------------------------------------------------------------------------------------
// LARGE TRANSPORT FUSELAGE: parked without wings, gear sponsons, upswept tail, high fin.
function buildFuselage(b) {
  const L = b.lod, Z0 = -15, Z1 = 15, Rm = 2.5, cyM = 3.1;
  const rad = C([[Z0, .34], [Z0 + 1, .62], [-11, 1.3], [-7.5, 2.15], [-4.6, Rm], [9.4, Rm], [11.5, 2.34], [13, 1.86], [14.1, 1.3], [14.6, .92], [14.85, .6], [Z1, .12]]);
  const cyC = C([[Z0, 5.0], [-12, 4.62], [-8, 3.74], [-5, 3.2], [9, cyM], [12, 3.0], [14, 2.82], [Z1, 2.74]]);
  const sec = (z, c) => { const r = rad(z), cy = cyC(z), flat = 1 + .03 * sat((z + 8) / 6); for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + Math.PI * i / 6; c[i * 2] = Math.cos(a) * r * flat; c[i * 2 + 1] = cy + Math.sin(a) * r; } c[0] = .001; c[12] = .001; };
  const H = new Hull({ lod: L, K: 7, z0: Z0, z1: Z1, sec, creases: [], nz: 26, nz1: 11, nz2: 7, tPer: 2, seamOff: .03, seamSub: 14, endBunch: .06, skipKnots: [], skipKnots1: [], keys: [-11, -7.5, -4.6, 9.4, 11.5, 12.4, 13, 13.6, 14.1, 14.4, 14.6, 14.75, 14.85, 14.93] });
  const cock = [[13.35, 4.12], [14.16, 4.32], [14.16, 5.0], [13.35, 5.0]]; H.hole(cock, { depth: .03 }); H.hole([[12.52, 4.32], [13.28, 4.2], [13.28, 4.92], [12.62, 4.92]], { depth: .03 });
  H.build(); drawHull(b, H, { floor: false, capF: false, capRCol: b.paint });
  const faceDir = (z, t) => H.frame(z, t);
  if (hasMid(b)) {
    // Passenger-style windows, cargo door, belly strake
    const wn = L === 0 ? 22 : 7, hz = L === 0 ? .15 : .78; for (let i = 0; i < wn; i++) { const z = lerp(L ? -3.5 : -4.2, L ? 8.9 : 9.6, i / (wn - 1)); sym(() => H.on(z, 3.62, .03, () => { use(TRIM, b.wreck ? 0x08090a : 0x1b2a33, .9); OQ([0, -.19, -hz], [0, -.19, hz], [0, .19, hz], [0, .19, -hz], [1, 0, 0]); })); }
    sym(() => { H.rail(-6.4, 11, 2.34, .08, .02, 0x7b1f1c, PAINT); H.rail(-6.4, 11, 2.48, .05, .016, 0x2a2b30, PAINT); });
    use(TRIM, 0x202226); xf(0, 1.0, 1, 0, 0, 0, () => box(0, 0, 0, 2.5, .24, 14.5, L ? 0 : .04));
  } else { for (const s of [1, -1]) { const f = faceDir(2.6, 3.62); use(TRIM, 0x2a3a44); const x = s * (f.p[0] + .02), y = f.p[1]; for (let i = 0; i < 9; i++) { const a = lerp(-4.2, 9.6, i / 9), c = a + 1.05; OQ([x, y - .15, a], [x, y - .15, c], [x, y + .15, c], [x, y + .15, a], [s, 0, 0]); } } }
  // Gear sponsons along the belly
  sym(() => { use(PAINT, b.paint); gridSurf(L === 0 ? 16 : 7, L === 0 ? 6 : 3, (u, v, p) => { const z = lerp(-4.9, 4.9, u), k = Math.pow(Math.max(.002, 1 - Math.pow(Math.abs(u * 2 - 1), 3.2)), .6), a = lerp(-1.25, 1.5, v); p[0] = 1.62 + Math.cos(a) * .98 * k; p[1] = 1.62 + Math.sin(a) * .86 * k; p[2] = z; }, false, [1.4, 1.8, 0]); });
  if (hasMid(b)) { use(TRIM, 0x202124); sym(() => { for (const z of [-3, 3]) { box(1.96, .98, z, .15, .66, .17); box(2.0, .7, z, .24, .12, .2); } }); box(0, 1.0, 11.2, .16, .62, .16); }
  // Fin and tailplanes with a dark leading edge
  use(PAINT, b.paint); extrudeX(roundPoly([[-11.2, 5.5], [-8, 5.55], [-12.1, 8.78], [-13.9, 8.78]], .18, 2), -.13, .13, L ? 0 : .025);
  if (hasMid(b)) { use(TRIM, 0x7b1f1c); extrudeX([[-10.92, 6.9], [-9.7, 6.9], [-11.05, 8.0], [-12.3, 8.0]], -.145, .145, 0); }
  sym(() => { use(PAINT, b.paint); gridSurf(L === 0 ? 5 : 2, L === 0 ? 3 : 1, (u, v, p) => { const span = lerp(.22, 2.72, u), ch = lerp(2.55, 1.0, u), le = lerp(-10.5, -12.25, u), z = le - v * ch, th = (1 - Math.pow(2 * v - 1, 2)) * .1 * (1 - u * .5); p[0] = span; p[1] = 5.36 + span * .05 + th; p[2] = z; }); gridSurf(L === 0 ? 5 : 2, 1, (u, v, p) => { const span = lerp(.22, 2.72, u), ch = lerp(2.55, 1.0, u), le = lerp(-10.5, -12.25, u), z = le - v * ch; p[0] = span; p[1] = 5.32 + span * .05; p[2] = z; }, false, [1.4, 6.2, -11.4], true); });
  // Round nose cap and the closed tail
  use(PAINT, b.paint); { const r = rad(Z1), c = cyC(Z1); dome(0, c, Z1, r * 1.04, r * 1.04, .07, 3, L === 0 ? 12 : 8); }
  if (hasDetail(b)) {
    for (const z of [-5.9, 11.2]) sym(() => H.seam([[z - .6, 2.9], [z + .6, 2.9], [z + .6, 3.55], [z - .6, 3.55], [z - .6, 2.9]], .018, 0x15161a));
    sym(() => { H.on(10.5, 3.05, .004, () => { use(TRIM, 0x202124); box(0, 0, 0, .01, .28, .5); }); H.on(-5.7, 2.52, .006, () => { use(CHROME, 0x8f9397); box(0, 0, 0, .02, .05, .16, .008); }); });
        use(CHROME, 0x777a7e); sym(() => { for (const [z, y] of [[13.1, 5.05], [12.2, 5.1]]) stud(.2, y, z, .02); });
    use(TRIM, 0x262729); box(0, 5.3, -13.6, .4, .3, .6, .05); use(LAMP, 0xb01a14); box(0, 8.82, -12.9, .06, .06, .3); sym(() => { use(LAMP, 0x2ad05a); box(2.72, 5.47, -12.0, .05, .05, .16); });
  }
  if (b.wreck && hasMid(b)) { use(TRIM, 0x0d0d0e, .7); for (const [z, t, s] of [[4.1, 2.6, 1], [-1.4, 3.2, -1], [7.4, 4.6, 1]]) { const f = H.frame(z, t); const x = s * f.p[0]; xf(x, f.p[1], z, 0, 0, s * Math.atan2(f.n[1], f.n[0]), () => { use(TRIM, 0x0a0a0b, .7); box(s * .012, 0, 0, .02, .9 + z * .02, 1.5); }); } }
  for (const z of [-3, 3]) b.axle(z, 2.3, .7, .46, 'truck', { axle: z < 0 ? 1 : 0 });
  b.axle(11.2, .3, .5, .3, 'truck', { steer: true, axle: 2, drive: false });
  b.pivot = [0, 3, 0]; b.seats.push({ role: 'pilot', p: [.5, 4.2, 13.2] }); b.cams = { chase: [0, 9, -30] }; b.head = [[.4, 2.5, Z1], [-.4, 2.5, Z1]]; b.tail = [[0, 8.8, -13], [0, 5, -15]];
}

// ---------------------------------------------------------------------------------------------
// RAIL WAGON: riveted covered van or tank wagon on two bogies.
function bogie(b, z, y0) {
  const zs = [z - .92, z + .92]; for (const q of zs) b.axle(q, .72, .46, .13, 'rail', { axle: b.wheels.length >> 1 });
  if (!hasMid(b)) { use(TRIM, 0x2a2b2e); box(0, y0 + .42, z, 1.68, .24, 2.7); return; }
  use(TRIM, 0x2a2b2e, .85); sym(() => { box(.72, .58, z, .1, .3, 2.76, L0(b) ? .02 : 0); if (hasDetail(b)) for (const q of zs) { box(.72, .46, q, .19, .22, .26, .02); use(CHROME, 0x72757a); cyl(.72, .46, q, .83, .46, q, .08, .07, 8); use(TRIM, 0x2a2b2e); } if (hasDetail(b)) for (const dz of [-.22, 0, .22]) { const P = []; for (let i = 0; i <= 8; i++) P.push([.72 + Math.cos(i * 1.4) * .06, .42 + i * .035, z + dz + Math.sin(i * 1.4) * .06]); use(TRIM, 0x202124); tube(P, .017, 4); use(TRIM, 0x2a2b2e); } });
  box(0, .74, z, 1.54, .16, .34, L0(b) ? .02 : 0); use(TRIM, 0x202124); for (const q of zs) cyl(-.72, .46, q, .72, .46, q, .05, .05, 6);
}
const L0 = b => b.lod === 0;
function buildWagon(b) {
  const L = b.lod, tank = b.variant === 'tank', Z0 = -6.5, Z1 = 6.5, frameY = .98, hw = 1.42, steel = 0x34363a;
  for (const z of [-4, 4]) bogie(b, z, .1);
  use(TRIM, 0x23252a); box(0, frameY, 0, 2.7, .3, 12.8, L ? 0 : .025); sym(() => box(1.22, frameY - .25, 0, .12, .24, 12.2));
  for (const s of [-1, 1]) { const z = s * 6.56; use(TRIM, steel); box(0, frameY, z, 2.3, .34, .14, L ? 0 : .02); if (hasMid(b)) { sym(() => { use(CHROME, 0x75787c); cyl(.86, 1.0, z, .86, 1.0, z + s * .36, .05, .05, 7); lathe(.86, 1.0, z + s * .36, 0, 0, s, [[.17, 0, 1], [.17, .04, 1], [.05, .05, 1]], 10); }); use(TRIM, 0x202226); box(0, .92, z + s * .3, .22, .2, .46, .02); } if (hasDetail(b)) { use(CHROME, 0x75787c); tube([[.1, .92, z + s * .52], [.1, .96, z + s * .6], [-.1, .96, z + s * .6], [-.1, .92, z + s * .52]], .025, 5); } }
  if (hasDetail(b)) { use(TRIM, 0x1c1d20); for (let z = -5.6; z < 5.8; z += 1.4) box(0, .8, z, 2.42, .08, .14); cyl(.4, .68, -2.4, .4, .68, 2.4, .13, .13, 8); sym(() => { use(TRIM, 0x303236); for (const q of [-6.2, 6.2]) { box(1.4, .78, q, .05, .06, .34); for (const d of [-.14, .14]) box(1.42, .54, q + d, .025, .46, .025); for (const y of [.33, .55]) box(1.42, y, q, .04, .025, .3); } }); }
  if (tank) {
    const cy = 2.42, r = 1.36, zT = 5.95, end = .62, nS = L === 0 ? 24 : L === 1 ? 12 : 8, prof = [[.001, -zT - end], [r * .56, -zT - end * .84], [r * .88, -zT - end * .46], [r, -zT]]; for (let z = -3; z <= 3; z += 3) prof.push([r, z]); prof.push([r, zT], [r * .88, zT + end * .46], [r * .56, zT + end * .84], [.001, zT + end]);
    use(PAINT, b.paint); roundBig(() => lathe(0, cy, 0, 0, 0, 1, prof.map(p => [p[0], p[1]]), L === 2 ? 12 : nS));
    if (hasMid(b)) { use(TRIM, 0x2c2e31); for (const z of [-3.9, -1.3, 1.3, 3.9]) { const P = [], n = L === 0 ? 18 : 8; for (let i = 0; i < n; i++) { const t = TAU * i / n; P.push([Math.cos(t) * (r + .014), cy + Math.sin(t) * (r + .014), z]); } tube(P, .022, 3, true); } }
    use(TRIM, 0x3c3e42); for (const z of [-4.4, 0, 4.4]) { for (const s of [-1, 1]) { xf(s * .96, 1.36, z, 0, 0, s * -.74, () => box(0, 0, 0, .08, .46, .18)); } }
    use(PAINT, b.paint); lathe(0, cy + r - .02, 0, 0, 1, 0, [[.42, 0, 1], [.42, .22, 1], [.34, .3], [.001, .34]], L === 0 ? 16 : 8);
    if (hasDetail(b)) { use(TRIM, 0x2a2c30); box(0, cy + r + .03, 0, .5, .03, 11.6); for (let z = -5.6; z <= 5.6; z += .8) box(0, cy + r + .05, z, .52, .012, .05); sym(() => { use(CHROME, 0xb7b9bc); const P = []; for (let i = 0; i <= 8; i++) P.push([.42, cy + r + .32, lerp(-5.6, 5.6, i / 8)]); tube(P, .014, 4); for (let i = 0; i <= 8; i++) { const z = lerp(-5.6, 5.6, i / 8); tube([[.26, cy + r + .03, z], [.42, cy + r + .32, z]], .01, 3); } use(TRIM, 0x303236); for (let k = 0; k < 6; k++) cyl(.15, .98 + k * .32, 6.42, .15, .98 + k * .32, 6.48, .01, .01, 4); }); use(TRIM, 0x202124); cyl(0, cy - r, 0, 0, cy - r - .42, 0, .11, .09, 8); box(0, cy - r - .46, 0, .34, .06, .34, .012); use(LAMP, 0xd8c23a); box(1.0, cy + .92, -2.4, .02, .34, .5); }
  } else {
    const yB = 1.14, yE = 3.3, nZ = L === 0 ? 18 : L === 1 ? 8 : 3, col = b.paint;
    use(PAINT, col); const P = roundPoly([[-6.28, yB], [6.28, yB], [6.28, yE], [-6.28, yE]], [.02, .02, .1, .1], 2);
    extrudeX(P, -hw, hw, L ? 0 : .03);
    // Curved roof
    use(TRIM, 0x4a4d50); gridSurf(nZ, L === 0 ? 8 : L === 1 ? 5 : 3, (u, v, p) => { const x = lerp(hw + .04, -hw - .04, v), z = lerp(-6.36, 6.36, u); p[0] = x; p[1] = yE + .02 + .34 * (1 - Math.pow(x / (hw + .04), 2)); p[2] = z; }, false, [0, yB, 0]);
    sym(() => { use(TRIM, 0x4a4d50); OQ([hw + .04, yE - .01, -6.36], [hw + .04, yE - .01, 6.36], [hw + .04, yE + .03, 6.36], [hw + .04, yE + .03, -6.36], [1, 0, 0]); });
    for (const s of [-1, 1]) { const zE = s * 6.36; use(TRIM, 0x4a4d50); const id = [], c = V(0, yE + .02, zE, 0, 0, s); for (let i = 0; i <= 8; i++) { const x = lerp(-hw - .04, hw + .04, i / 8); id.push(V(x, yE + .02 + .34 * (1 - Math.pow(x / (hw + .04), 2)), zE, 0, 0, s)); } for (let i = 0; i < 8; i++) T(c, id[i], id[i + 1]); }
    if (L === 2) sym(() => { use(TRIM, 0x5a1a14); for (const z of [-4.6, -2.3, 2.3, 4.6]) box(hw + .02, (yB + yE) / 2, z, .05, yE - yB - .04, .1); box(hw + .03, (yB + yE) / 2, -1.15, .05, yE - yB - .2, .06); box(hw + .03, (yB + yE) / 2, 1.15, .05, yE - yB - .2, .06); });
    if (hasMid(b)) sym(() => { // ribs and the sliding door
      use(PAINT, col); const n = L === 0 ? 9 : 5; for (let i = -n; i <= n; i++) { const z = i * 6.05 / n; if (Math.abs(z) < 1.2) continue; box(hw + .022, (yB + yE) / 2, z, .04, yE - yB - .02, .09, L ? 0 : .012); }
      box(hw + .02, yE - .03, 0, .04, .08, 12.5); box(hw + .02, yB + .04, 0, .04, .08, 12.5);
      use(PAINT, col); box(hw + .05, (yB + yE) / 2 - .02, 0, .05, yE - yB - .22, 2.3, L ? 0 : .012); use(TRIM, 0x1c1d20); box(hw + .058, yE - .1, 0, .05, .06, 4.5); if (hasDetail(b)) { use(TRIM, 0x1a1b1e); for (const z of [-.8, 0, .8]) box(hw + .082, (yB + yE) / 2, z, .012, yE - yB - .34, .05); use(CHROME, 0x82858a); box(hw + .09, 2.1, 1.02, .03, .3, .05, .01); rivets([hw + .03, yE - .13, -6], [hw + .03, yE - .13, -1.3], 12, .014, 0x34363a); rivets([hw + .03, yE - .13, 1.3], [hw + .03, yE - .13, 6], 12, .014, 0x34363a); }
    });
    if (hasDetail(b)) { use(TRIM, 0x1b1c1f); for (const z of [-4.4, 4.4]) box(0, yE + .36, z, .7, .05, .5, .012); sym(() => { use(TRIM, 0x303236); for (const q of [-6.31, 6.31]) { for (let k = 0; k < 5; k++) box(.98, 1.22 + k * .34, q, .34, .025, .03); } }); }
  }
  b.pivot = [0, 1.4, 0]; b.cams = { chase: [0, 6, -18] }; b.head = []; b.tail = [];
}

// ---------------------------------------------------------------------------------------------
// MAINTENANCE CART: low electric utility cart with a tool tray; fits under 1.5 m.
function buildCart(b) {
  const L = b.lod, R = .2, fz = .76, rz = -.76, Z0 = -1.18, Z1 = 1.18;
  const w = C([[Z0, .5], [Z0 + .08, .57], [0, .59], [.7, .58], [1.0, .53], [1.13, .44], [Z1, .34]]), sill = C([[Z0, .34], [Z0 + .2, .26], [.8, .26], [Z1, .36]]);
  const belt = C([[Z0, .62], [-.3, .66], [.28, .66], [.5, .68], [.95, .66], [Z1, .5]]), top = C([[Z0, .66], [-.32, .7], [.26, .7], [.42, .82], [.58, .86], [.96, .78], [1.12, .66], [Z1, .54]]);
  const H = new Hull({ lod: L, z0: Z0, z1: Z1, sec: carSection({ w, sill, belt, top, tumble: .1, hMax: .3, tuck: .93 }), creases: [3], nz: 18, nz1: 6, nz2: 2, keys: [.42, .58, .96, 1.06, 1.12] });
  H.arch(fz, R, R + .05, { flare: .014, depth: .22 }); H.arch(rz, R, R + .05, { flare: .014, depth: .22 }); H.build(); drawHull(b, H, {});
  use(TRIM, 0x202226); bumper(b, Z1 + .02, .36, .56, .12, .1, { curve: .12, col: 0x1e1f22 }); bumper(b, Z0 - .02, .36, .54, .1, .08, { curve: .04, col: 0x1e1f22, end: -1 });
  sym(() => { if (L < 2) headlamp(.28, .6, Z1 - .035, .058, .1); else { use(TRIM, 0x121315); box(.28, .6, Z1 - .02, .15, .13, .05); use(LAMP, 0xfff0c8); box(.28, .6, Z1 + .004, .1, .09, .01); } }); sym(() => { use(TRIM, 0x141517); rectLamp(.42, .54, Z0, .1, .07, 0xb01a14, .016, -1); });
  // Tray with raised rails and a load
  use(TRIM, 0x2c2e32); box(0, .73, -.72, 1.04, .04, .86, L ? 0 : .012);
  if (hasMid(b)) { use(TRIM, 0x3a3d41); sym(() => box(.52, .82, -.72, .03, .16, .88)); box(0, .82, -1.15, 1.06, .16, .03); use(TRIM, 0x6d5b39); box(-.16, .86, -.82, .52, .22, .4, L ? 0 : .012); use(TRIM, 0x5c6066); for (let i = 0; i < 3; i++) cyl(.22, .8 + i * .03, -1.08, .22 + (i % 2) * .04, .8 + i * .03, -.42, .035, .035, 6); }
  // Seat, steering column, canopy on four posts (stays under the 1.52 m collider)
  if (hasMid(b)) { use(TRIM, 0x1d1e21, .95); box(0, .78, -.02, .86, .1, .4, L ? 0 : .03); xf(0, 1.0, -.24, -.14, 0, 0, () => box(0, 0, 0, .84, .38, .08, L ? 0 : .025)); use(TRIM, 0x17181a); cyl(.24, .84, .46, .22, 1.08, .3, .018, .018, 5); xf(.22, 1.1, .29, -.95, 0, 0, () => { const P = []; for (let i = 0; i < 12; i++) { const a = TAU * i / 12; P.push([Math.cos(a) * .13, Math.sin(a) * .13, 0]); } tube(P, .013, 4, true); }); }
  use(TRIM, 0x202124); sym(() => { tube([[.54, .72, -.42], [.54, 1.42, -.36]], .02, hasMid(b) ? 6 : 4); tube([[.54, .88, .6], [.52, 1.42, .36]], .02, hasMid(b) ? 6 : 4); });
  use(PAINT, b.paint); gridSurf(L === 0 ? 8 : 3, L === 0 ? 5 : 2, (u, v, p) => { const z = lerp(-.46, .46, u), x = lerp(.57, -.57, v), k = 1 - Math.pow(Math.abs(x / .57), 2.4); p[0] = x; p[1] = 1.42 + .05 * k; p[2] = z; }, false, [0, 1, 0]);
  use(TRIM, 0x2a2b2e, .8); OQ([-.57, 1.418, -.46], [.57, 1.418, -.46], [.57, 1.418, .46], [-.57, 1.418, .46], [0, -1, 0]);
  if (hasDetail(b)) {
    grilleBars(0, .46, Z1 - .004, .34, .1, 3, 0x0b0c0d, 0x303235); H.seam([[.56, 3.9], [1.02, 3.8]], .006); H.seam([[.56, 3.9], [.56, 6]], .006);
    use(LAMP, 0xff9a1e); lathe(.42, 1.46, -.38, 0, 1, 0, [[.035, 0, 1], [.03, .05], [0, .07]], 8); use(TRIM, 0x202226); box(.2, .84, .62, .1, .03, .12, .008); box(-.2, .34, .9, .3, .01, .3);
    use(CHROME, 0x8f9397); sym(() => { box(.56, .6, .44, .012, .03, .12); }); towHook(0, .36, Z0 - .05, -1);
  }
  b.axle(fz, .5, R, .14, 'fork', { steer: true, steerMax: .6, axle: 0 }); b.axle(rz, .5, R, .14, 'fork', { axle: 1 }); b.pivot = [0, .5, 0];
  b.seats.push({ role: 'driver', p: [.22, .95, -.02] }, { role: 'passenger', p: [-.22, .95, -.02] }); b.cams = { driver: [.22, 1.36, .05], chase: [0, 2.2, -3.8] }; b.head = [[.34, .74, Z1], [-.34, .74, Z1]]; b.tail = [[.42, .54, Z0], [-.42, .54, Z0]];
}

// ---------------------------------------------------------------------------------------------
// Finishing: wreck pose, baked ambient occlusion, dirt and wear in vertex colours.
function wreckPose(b) {
  const r = makeRng(b.seed * 4021 + b.type.length * 97 + b.type.charCodeAt(0)), W = b.wheels; if (!W.length) return;
  const pick = i => W[i % W.length];
  const nMiss = W.length > 4 ? 2 : 1, first = r() * W.length | 0;
  for (let i = 0; i < nMiss; i++) pick(first + i * 3).missing = true;
  for (const w of W) if (!w.missing && r() < .6) w.flat = true;
  let roll = 0, pitch = 0; for (const w of W) { const d = w.missing ? .11 : w.flat ? .05 : 0; roll += -Math.sign(w.x) * d; pitch += Math.sign(w.z) * d; }
  roll = clamp(roll * .34 / Math.max(.6, Math.abs(W[0].x)), -.075, .075); pitch = clamp(pitch * .3 / Math.max(1.2, b.len || 3), -.05, .05);
  const cr = Math.cos(roll), sr = Math.sin(roll), cp = Math.cos(pitch), sp = Math.sin(pitch), py = b.pivot[1];
  const rot = (x, y, z) => { const y0 = y - py, x1 = x * cr - y0 * sr, y1 = x * sr + y0 * cr, y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp; return [x1, y2 + py, z2]; };
  const rotN = (x, y, z) => { const x1 = x * cr - y * sr, y1 = x * sr + y * cr; return [x1, y1 * cp - z * sp, y1 * sp + z * cp]; };
  let minY = 1e9; for (let m = 0; m < NMAT; m++) { const o = bufs[m]; for (let i = 0; i < o.nv; i++) { const k = i * 3, q = rot(o.p[k], o.p[k + 1], o.p[k + 2]); if (q[1] < minY) minY = q[1]; } }
  const maxR = Math.max(...W.map(w => w.r)), drop = Math.min(.3 * maxR, Math.max(0, minY - .025));
  for (let m = 0; m < NMAT; m++) { const o = bufs[m]; for (let i = 0; i < o.nv; i++) { const k = i * 3, q = rot(o.p[k], o.p[k + 1], o.p[k + 2]), n = rotN(o.n[k], o.n[k + 1], o.n[k + 2]); o.p[k] = q[0]; o.p[k + 1] = q[1] - drop; o.p[k + 2] = q[2]; o.n[k] = n[0]; o.n[k + 1] = n[1]; o.n[k + 2] = n[2]; } }
  for (const w of W) { const q = rot(w.x, w.y, w.z); w.x = q[0]; w.z = q[2]; const rest = w.flat ? w.r * .72 : w.r; w.y = Math.max(rest, Math.min(q[1] - drop, rest + .02)); }
  const mv = a => { const q = rot(a[0], a[1], a[2]); a[0] = q[0]; a[1] = q[1] - drop; a[2] = q[2]; };
  for (const s of b.seats) mv(s.p); for (const d of b.doors) mv(d.p); for (const l of b.head) mv(l); for (const l of b.tail) mv(l);
  for (const k of Object.keys(b.cams)) mv(b.cams[k]);
  b.extra.tilt = { roll, pitch, drop };
}
// Collision boxes fitted to the finished body: slabs along the length, robust to thin parts (mirrors, aerials, rails).
function fitColliders(b) {
  let zMin = 1e9, zMax = -1e9, count = 0; const mats = [PAINT, TRIM, CANVAS, RUBBER];
  for (const m of mats) { const o = bufs[m]; count += o.nv; for (let i = 0; i < o.nv; i++) { const z = o.p[i * 3 + 2]; if (z < zMin) zMin = z; if (z > zMax) zMax = z; } }
  for (const w of b.wheels) if (!w.missing) { zMin = Math.min(zMin, w.z - w.r); zMax = Math.max(zMax, w.z + w.r); }
  const L = zMax - zMin, n = clamp(Math.round(L / 1.15), 3, 8), dz = L / n, BINS = 48, hx = new Uint16Array(n * BINS), hn = new Uint16Array(n * BINS), hy = new Uint16Array(n * BINS), tot = new Uint32Array(n);
  let xMax = .01, yMax = .01; for (const m of mats) { const o = bufs[m]; for (let i = 0; i < o.nv; i++) { const x = Math.abs(o.p[i * 3]), y = o.p[i * 3 + 1]; if (x > xMax) xMax = x; if (y > yMax) yMax = y; } }
  for (const m of mats) { const o = bufs[m]; for (let i = 0; i < o.nv; i++) { const k = clamp((o.p[i * 3 + 2] - zMin) / dz | 0, 0, n - 1), sx = o.p[i * 3], bx = clamp(Math.abs(sx) / xMax * BINS | 0, 0, BINS - 1), by = clamp(o.p[i * 3 + 1] / yMax * BINS | 0, 0, BINS - 1); (sx >= 0 ? hx : hn)[k * BINS + bx]++; hy[k * BINS + by]++; tot[k]++; } }
  const top = (h, k, q) => { let c = 0, all = 0; for (let i = 0; i < BINS; i++) all += h[k * BINS + i]; const lim = all * q; for (let i = 0; i < BINS; i++) { c += h[k * BINS + i]; if (c >= lim) return (i + 1) / BINS; } return 0; };
  const out = [];
  for (let k = 0; k < n; k++) {
    if (!tot[k]) continue; let xp = top(hx, k, .985) * xMax, xn = top(hn, k, .985) * xMax, h = top(hy, k, .985) * yMax; const z0 = zMin + k * dz, z1 = z0 + dz;
    for (const w of b.wheels) if (!w.missing && w.z + w.r > z0 && w.z - w.r < z1) { if (w.x >= 0) xp = Math.max(xp, w.x + w.w / 2); else xn = Math.max(xn, -w.x + w.w / 2); h = Math.max(h, w.y + w.r); }
    const y0 = .04; out.push([(xp - xn) / 2, (y0 + h) / 2, (z0 + z1) / 2, xp + xn, h - y0, dz]);
  }
  b.boxes = out;
}
function bakeBody(b) {
  const W = b.wheels.map(w => [Math.abs(w.x), w.y, w.z, w.r + .1, w.w]), s = b.seed * 3.71 + 1.3, dirtAmt = b.extra.dirt ?? 1;
  for (let m = 0; m < NMAT; m++) {
    const o = bufs[m]; if (!o.nv) continue;
    if (m === GLASS) { for (let i = 0; i < o.nv; i++) if (o.u[i * 2] < -1e8) { o.u[i * 2] = o.p[i * 3] * .3; o.u[i * 2 + 1] = o.p[i * 3 + 1] * .3; } continue; }
    const weather = m === PAINT || m === TRIM || m === CANVAS;
    for (let i = 0; i < o.nv; i++) {
      const k = i * 3, x = o.p[k], y = o.p[k + 1], z = o.p[k + 2], nx = o.n[k], ny = o.n[k + 1], nz = o.n[k + 2];
      if (o.u[i * 2] < -1e8) { const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz); if (ax >= ay && ax >= az) { o.u[i * 2] = z * .32; o.u[i * 2 + 1] = y * .32; } else if (ay >= az) { o.u[i * 2] = x * .32; o.u[i * 2 + 1] = z * .32; } else { o.u[i * 2] = x * .32; o.u[i * 2 + 1] = y * .32; } }
      let ao = lerp(.5, 1, smooth(.08, .72, y)) * lerp(.7, 1, .5 + .5 * ny), wheelD = 0;
      for (let w = 0; w < W.length; w++) { const q = W[w], d = Math.hypot(z - q[2], y - q[1]); if (d < q[3] + .26) { const g = 1 - smooth(q[3] - .04, q[3] + .26, d); wheelD = Math.max(wheelD, g); if (Math.abs(x) > q[0] - q[4]) ao *= 1 - g * .42; } }
      let r = o.c[k] * ao, g = o.c[k + 1] * ao, bl = o.c[k + 2] * ao;
      if (weather) {
        const n1 = fbm(x * 1.6 + s, y * 2.6, z * 1.6), n2 = fbm(x * 5 + s, y * 6, z * 5 + 3), tone = .92 + n2 * .16; r *= tone; g *= tone; bl *= tone;
        const dirt = sat(((1 - smooth(.3, 1.35, y)) * (.25 + n1 * .85) + wheelD * .16 * n2 + Math.max(0, ny) * .1 * n1) * dirtAmt) * (m === CANVAS ? .4 : .52);
        r = lerp(r, .135, dirt); g = lerp(g, .105, dirt); bl = lerp(bl, .07, dirt);
        if (b.wreck) {
          const burn = smooth(.34, .6, fbm(x * .8 + s, y * 1.1 + 2, z * .8) + (y - .7) * .05), rust = smooth(.42, .68, n2 * .6 + n1 * .5);
          const ash = smooth(.5, .75, n1), rp = rust * rust * .55, cr = lerp(lerp(.011, .05, ash), .07, rp), cg = lerp(lerp(.011, .047, ash), .032, rp), cb = lerp(lerp(.012, .045, ash), .018, rp), a = .86 + burn * .13;
          r = lerp(r, cr, a); g = lerp(g, cg, a); bl = lerp(bl, cb, a);
        }
      } else if (b.wreck) { const q = m === RUBBER ? .3 : .22; r *= q; g *= q; bl *= q; }
      o.c[k] = r; o.c[k + 1] = g; o.c[k + 2] = bl;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Public API
const BUILDERS = { utility: buildUtility, pickup: buildPickup, quad: buildQuad, van: buildVan, truck: buildTruck, apc: buildApc, tanker: buildTanker, bus: buildBus, tractor: buildTractor, forklift: buildForklift, car: buildCar, logtruck: buildLogtruck, tracked: buildTracked, fuselage: buildFuselage, wagon: buildWagon, cart: buildCart };
const DEFAULT_PAINT = { utility: 'sand', pickup: 'red', quad: 'orange', van: 'white', truck: 'woodland', apc: 'woodland', tanker: 'silver', bus: 'teal', tractor: 'green', forklift: 'yellow', car: 'blue', logtruck: 'red', tracked: 'orange', fuselage: 'white', wagon: 'red', cart: 'yellow' };
const MASS = { utility: ['light', 2200], pickup: ['medium', 2400], quad: ['ultralight', 380], van: ['medium', 2900], truck: ['heavy', 11000], apc: ['armoured', 22000], tanker: ['heavy', 16000], bus: ['heavy', 13000], tractor: ['medium', 6000], forklift: ['medium', 3800], car: ['light', 1300], logtruck: ['heavy', 24000], tracked: ['heavy', 9000], fuselage: ['static', 60000], wagon: ['static', 22000], cart: ['ultralight', 650] };
export const VEHICLE_TYPES = Object.keys(DEFAULT_PAINT);
const vCache = new Map();
const ex = a => new THREE.Vector3(-a[0], a[1], -a[2]);

/** Builds (or returns from cache) one vehicle. opts: { lod: 0|1|2, paint: name|0xrrggbb, wreck: bool, seed: int }. */
export function buildVehicle(type, opts = {}) {
  if (!BUILDERS[type]) throw new Error('unknown vehicle type: ' + type);
  const lod = clamp(opts.lod | 0, 0, 2), wreck = !!opts.wreck, seed = (opts.seed | 0) & 7, paint = opts.paint ?? DEFAULT_PAINT[type], variant = opts.variant || '', doorsShut = opts.doors === false, key = [type, lod, wreck ? 1 : 0, seed, paint, variant, doorsShut ? 1 : 0].join('|');
  const hit = vCache.get(key); if (hit) return hit;
  const t0 = performance.now();
  bufs = scratchA; for (const o of bufs) o.reset(); M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]; stack.length = 0; MAXSEG = lod === 2 ? 5 : lod === 1 ? 8 : 99; // wheels are built with their own limits
  NOBEVEL = lod >= 1; TUBESEG = lod === 2 ? 3 : lod === 1 ? 4 : 99;
  const b = new Build(type, { lod, wreck, seed, paint, variant, doorsShut }); b.mass = MASS[type][0]; b.massKg = MASS[type][1];
  BUILDERS[type](b);
  if (wreck) wreckPose(b);
  bakeBody(b); fitColliders(b);
  MAXSEG = 99; NOBEVEL = false; TUBESEG = 99;
  const geometry = packGeometry(bufs, lod, true);
  const wheels = b.wheels.map((w, i) => ({
    index: i, position: ex([w.x, w.y, w.z]), radius: w.flat ? w.r * .72 : w.r, nominalRadius: w.r, width: w.w, side: w.side > 0 ? 'left' : 'right', axle: w.axle,
    steerMax: w.steer, steerAxis: new THREE.Vector3(0, 1, 0), spinAxis: new THREE.Vector3(1, 0, 0), drive: w.drive, dual: w.dual, flat: w.flat, missing: w.missing,
    flipY: w.side > 0, geometry: w.missing ? null : wheelGeometry(w.style, w.r, w.w, lod, w.flat, wreck, seed, w.dual),
  }));
  geometry.computeBoundingBox(); const bb = geometry.boundingBox.clone();
  for (const w of wheels) { if (w.missing) continue; const p = w.position; bb.expandByPoint(new THREE.Vector3(p.x - w.width / 2, p.y - w.radius, p.z - w.radius)); bb.expandByPoint(new THREE.Vector3(p.x + w.width / 2, p.y + w.radius, p.z + w.radius)); }
  const size = bb.getSize(new THREE.Vector3());
  const tris = geometry.index.count / 3 + wheels.reduce((s, w) => s + (w.geometry ? w.geometry.index.count / 3 : 0), 0);
  const v = {
    type, lod, wreck, seed, paint, geometry, materials: materialsFor(paint), wheels,
    pivot: ex(b.pivot), seats: b.seats.map(s => ({ role: s.role, position: ex(s.p), yaw: s.yaw ?? 0 })), cameras: Object.fromEntries(Object.entries(b.cams).map(([k, a]) => [k, ex(a)])),
    doors: b.doors.map(d => ({ name: d.name, position: ex(d.p), side: d.side > 0 ? 'left' : d.side < 0 ? 'right' : 'rear', open: !!d.open })),
    headlights: b.head.map(ex), tailLights: b.tail.map(ex),
    colliders: b.boxes.map(a => ({ center: ex(a), size: new THREE.Vector3(a[3], a[4], a[5]) })),
    length: size.z, width: size.x, height: size.y, massClass: b.mass, massKg: b.massKg, bounds: bb, triangles: tris, buildMs: performance.now() - t0, tilt: b.extra.tilt || null,
    turret: b.extra.turret ? { pivot: ex(b.extra.turret.pivot), gunBase: ex(b.extra.turret.gunAxis) } : null, mast: b.extra.mast ? { z: -b.extra.mast.z, height: b.extra.mast.height } : null,
  };
  vCache.set(key, v); return v;
}
/** Instantiates a built vehicle. Each wheel: steer node (rotate Y) > spin mesh (rotate X). Geometry and materials stay shared. */
export function createVehicleObject(v, { shadows = true } = {}) {
  const g = new THREE.Group(); g.name = 'vehicle-' + v.type;
  const body = new THREE.Mesh(v.geometry, v.materials); body.castShadow = shadows; body.receiveShadow = shadows; g.add(body);
  g.userData.body = body; g.userData.wheels = [];
  for (const w of v.wheels) {
    if (!w.geometry) continue; const steer = new THREE.Group(); steer.position.copy(w.position); const spin = new THREE.Mesh(w.geometry, v.materials); spin.castShadow = shadows; spin.receiveShadow = shadows;
    const flip = new THREE.Group(); flip.rotation.y = w.flipY ? Math.PI : 0; flip.add(spin); steer.add(flip); g.add(steer); g.userData.wheels.push({ wheel: w, steer, spin });
  }
  return g;
}
/** Body and wheels merged into one geometry, grouped by material index. For static scenery; cached on the built vehicle. */
export function vehicleStaticGeometry(v) {
  if (v._static) return v._static;
  const parts = [{ g: v.geometry, x: 0, y: 0, z: 0, flip: false }]; for (const w of v.wheels) if (w.geometry) parts.push({ g: w.geometry, x: w.position.x, y: w.position.y, z: w.position.z, flip: w.flipY });
  let nv = 0, ni = 0; for (const q of parts) { nv += q.g.attributes.position.count; ni += q.g.index.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), out = new THREE.BufferGeometry();
  let o = 0; for (const q of parts) { q.base = o; const a = q.g.attributes, n = a.position.count, s = q.flip ? -1 : 1; C.set(a.color.array, o * 3); U.set(a.uv.array, o * 2);
    for (let i = 0; i < n; i++) { const k = i * 3, t = (o + i) * 3; P[t] = a.position.array[k] * s + q.x; P[t + 1] = a.position.array[k + 1] + q.y; P[t + 2] = a.position.array[k + 2] * s + q.z; N[t] = a.normal.array[k] * s; N[t + 1] = a.normal.array[k + 1]; N[t + 2] = a.normal.array[k + 2] * s; } o += n; }
  let w = 0; for (let m = 0; m < NMAT; m++) { const start = w; for (const q of parts) for (const g of q.g.groups) { if (g.materialIndex !== m) continue; const src = q.g.index.array; for (let i = g.start; i < g.start + g.count; i++) I[w++] = src[i] + q.base; } if (w > start) out.addGroup(start, w - start, m); }
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); out.setIndex(new THREE.BufferAttribute(I, 1)); out.computeBoundingBox(); out.computeBoundingSphere();
  v._static = out; return out;
}
/** Pre-builds a list without blocking: yields to the event loop between vehicles once budgetMs is used. */
export async function prebuildVehicles(list, { budgetMs = 8 } = {}) {
  let t = performance.now();
  for (const [type, o] of list) { buildVehicle(type, o); if (performance.now() - t > budgetMs) { await new Promise(r => setTimeout(r, 0)); t = performance.now(); } }
}
export function disposeVehicleCache() { for (const v of vCache.values()) v.geometry.dispose(); vCache.clear(); for (const g of wheelCache.values()) g.dispose(); wheelCache.clear(); }
