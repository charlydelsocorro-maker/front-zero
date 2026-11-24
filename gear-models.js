// FRONT ZÉRO: procedural 3D models of the equipment items (all invented designs).
// Every item is one merged, non-indexed BufferGeometry (position, normal, color) plus named moving parts.
// Nothing is built at import time: gearModel() builds an id on first call and caches it.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const GEAR_MODEL_IDS = ['syringe', 'bandage', 'medkit', 'adren', 'plate', 'frag', 'sticky', 'molotov', 'mine', 'c4', 'c4remote', 'tknife', 'claymore', 'flash', 'smoke', 'stun', 'decoy', 'sensor', 'shield', 'ammobox', 'wire'];

const PI = Math.PI, TAU = PI * 2;
const P = {
  steel: 0x8d9399, steelD: 0x565b60, steelL: 0xc3c8cc, gun: 0x2f3235, black: 0x18191b, rubber: 0x26272a,
  olive: 0x5a633e, oliveD: 0x3b422b, oliveL: 0x7b8359, khaki: 0x8b8260, tan: 0xa8946c, sand: 0xc9b88f,
  ivory: 0xe2decd, white: 0xeceae2, ink: 0x1d1e20, red: 0xb0352a, redD: 0x70201b, green: 0x2f9460, greenD: 0x1d5a3c,
  amber: 0xe0921e, amberD: 0x9c5a10, glass: 0xbcd6d6, glassL: 0xe6f1ee, glassD: 0x7f9c9e, bottle: 0x7f9a78, bottleD: 0x566e52,
  brass: 0xc69f4c, brassD: 0x7e6028, copper: 0xb86d3c, yellow: 0xe6b81e, orange: 0xe0691c, teal: 0x25a59b, tealD: 0x176860,
  putty: 0xd2c4a0, puttyD: 0xa4977a, cloth: 0xbcae8e, clothD: 0x6e5f45, gauze: 0xe9e5d9, gauzeD: 0xcdc8b9, led: 0xf6f6ee, goo: 0xb9c23a, gooD: 0x7c8522,
};

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hash = (x, y, z, s) => { let h = Math.imul(Math.round(x * 2600) ^ Math.imul(Math.round(y * 2600), 73856093) ^ Math.imul(Math.round(z * 2600), 19349663) ^ s, 0x9E3779B1); h ^= h >>> 15; return ((h >>> 0) % 1024) / 1024; };
const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};

// Rounded polygon outline (CCW). Corners are [x, y, radius].
function roundPoly(pts, steps = 3) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const A = pts[(i + n - 1) % n], B = pts[i], C = pts[(i + 1) % n], r = B[2] || 0;
    if (r <= 0) { out.push([B[0], B[1]]); continue; }
    const la = Math.hypot(A[0] - B[0], A[1] - B[1]), lc = Math.hypot(C[0] - B[0], C[1] - B[1]);
    const ta = Math.min(r, la * 0.49), tc = Math.min(r, lc * 0.49);
    const s = [B[0] + (A[0] - B[0]) / la * ta, B[1] + (A[1] - B[1]) / la * ta], e = [B[0] + (C[0] - B[0]) / lc * tc, B[1] + (C[1] - B[1]) / lc * tc];
    for (let k = 0; k <= steps; k++) { const t = k / steps, u = 1 - t; out.push([u * u * s[0] + 2 * u * t * B[0] + t * t * e[0], u * u * s[1] + 2 * u * t * B[1] + t * t * e[1]]); }
  }
  let area = 0; for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; area += a[0] * b[1] - b[0] * a[1]; }
  return area < 0 ? out.reverse() : out;
}
const circle = (r, n, cx = 0, cy = 0, cw = false) => { const a = []; for (let i = 0; i < n; i++) { const t = (cw ? -1 : 1) * i / n * TAU; a.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } return a; };
function insetPoly(pts, b) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const A = pts[(i + n - 1) % n], B = pts[i], C = pts[(i + 1) % n];
    let ax = B[0] - A[0], ay = B[1] - A[1], cx = C[0] - B[0], cy = C[1] - B[1];
    const la = Math.hypot(ax, ay) || 1, lc = Math.hypot(cx, cy) || 1; ax /= la; ay /= la; cx /= lc; cy /= lc;
    let nx = -ay - cy, ny = ax + cx; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const d = b / Math.max(0.45, nx * -ay + ny * ax);
    out.push([B[0] + nx * d, B[1] + ny * d]);
  }
  return out;
}

class Mesh {
  constructor(crease = 42, wear = 1) { this.p = []; this.c = []; this.crease = crease; this.wear = wear; }
  tri(a, b, c, col) { this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); this.c.push(col, col, col); }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  map(f) { const p = this.p, v = [0, 0, 0]; for (let i = 0; i < p.length; i += 3) { v[0] = p[i]; v[1] = p[i + 1]; v[2] = p[i + 2]; f(v); p[i] = v[0]; p[i + 1] = v[1]; p[i + 2] = v[2]; } return this; }
  move(x, y, z) { return this.map(v => { v[0] += x; v[1] += y; v[2] += z; }); }
  rx(a) { const c = Math.cos(a), s = Math.sin(a); return this.map(v => { const y = v[1], z = v[2]; v[1] = y * c - z * s; v[2] = y * s + z * c; }); }
  ry(a) { const c = Math.cos(a), s = Math.sin(a); return this.map(v => { const x = v[0], z = v[2]; v[0] = x * c + z * s; v[2] = -x * s + z * c; }); }
  rz(a) { const c = Math.cos(a), s = Math.sin(a); return this.map(v => { const x = v[0], y = v[1]; v[0] = x * c - y * s; v[1] = x * s + y * c; }); }
  sc(x, y = x, z = x) { this.map(v => { v[0] *= x; v[1] *= y; v[2] *= z; }); return x * y * z < 0 ? this.flip() : this; }
  // Wrap around a vertical cylinder of radius R: the +Z face becomes convex.
  bendY(R) { return this.map(v => { const t = v[0] / R, r = R + v[2]; v[0] = r * Math.sin(t); v[2] = r * Math.cos(t) - R; }); }
  bendX(R) { return this.map(v => { const t = v[1] / R, r = R + v[2]; v[1] = r * Math.sin(t); v[2] = r * Math.cos(t) - R; }); }
  flip() {
    const p = this.p, c = this.c;
    for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
    for (let i = 0; i < c.length; i += 3) { const t = c[i + 1]; c[i + 1] = c[i + 2]; c[i + 2] = t; }
    return this;
  }
  paint(f) { const p = this.p, c = this.c; for (let i = 0; i < c.length; i++) { const r = f(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], c[i]); if (r !== undefined) c[i] = r; } return this; }
}
class Group {
  constructor(m) { this.m = m; }
  all(k, a) { for (const x of this.m) x[k](...a); return this; }
  map(...a) { return this.all('map', a); } move(...a) { return this.all('move', a); } rx(...a) { return this.all('rx', a); } ry(...a) { return this.all('ry', a); }
  rz(...a) { return this.all('rz', a); } sc(...a) { return this.all('sc', a); } bendY(...a) { return this.all('bendY', a); } bendX(...a) { return this.all('bendX', a); } paint(...a) { return this.all('paint', a); }
}

class Kit {
  constructor(T) { this.T = T; this.out = []; this.parts = {}; }
  add(m) { this.out.push(m); return m; }
  group(fn) { const save = this.out; this.out = []; fn(); const g = new Group(this.out); this.out = save; save.push(...g.m); return g; }
  part(name, pivot, fn) { const save = this.out; this.out = []; fn(); this.parts[name] = { list: this.out, pivot }; this.out = save; }

  // prof: [[r, y, color?], ...] bottom to top; a color applies from that point on.
  lathe(prof, o = {}) {
    const seg = o.seg || 16, arc = o.arc ?? TAU, phi = o.phi || 0, m = this.add(new Mesh(o.crease ?? 42, o.wear ?? 1));
    let col = o.color ?? P.steel;
    for (let i = 0; i + 1 < prof.length; i++) {
      const [r0, y0, c] = prof[i], [r1, y1] = prof[i + 1];
      if (c !== undefined) col = c;
      for (let j = 0; j < seg; j++) {
        const a0 = phi + arc * j / seg, a1 = phi + arc * (j + 1) / seg, s0 = Math.sin(a0), c0 = Math.cos(a0), s1 = Math.sin(a1), c1 = Math.cos(a1);
        const A = [r0 * s0, y0, r0 * c0], B = [r0 * s1, y0, r0 * c1], C = [r1 * s1, y1, r1 * c1], D = [r1 * s0, y1, r1 * c0];
        const cc = o.cell ? (o.cell(i, j) ?? col) : col;
        if (r0 > 1e-7) m.tri(A, B, C, cc);
        if (r1 > 1e-7) m.tri(A, C, D, cc);
      }
    }
    return m;
  }
  torus(R, r, o = {}) {
    const rad = o.rad || 6, prof = [];
    for (let i = 0; i <= rad; i++) { const a = i / rad * TAU; prof.push([R + Math.cos(a) * r, Math.sin(a) * r]); }
    return this.lathe(prof, { crease: 80, ...o, seg: o.seg || 14 });
  }
  dome(r, h, o = {}) {
    const n = o.rows || 3, prof = [[r, 0]];
    for (let i = 1; i <= n; i++) { const a = i / n * PI / 2; prof.push([r * Math.cos(a), h * Math.sin(a)]); }
    return this.lathe(prof, { seg: 6, crease: 70, ...o });
  }
  spline(pts, n, closed = false) {
    const T = this.T, c = new T.CatmullRomCurve3(pts.map(a => new T.Vector3(a[0], a[1], a[2])), closed, 'centripetal');
    return c.getPoints(n).map(v => [v.x, v.y, v.z]);
  }
  rings(rings, m, col, closed, capped) {
    const n = rings.length, k = rings[0].length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = rings[i], b = rings[(i + 1) % n];
      for (let j = 0; j < k; j++) { const j1 = (j + 1) % k; m.quad(a[j], a[j1], b[j1], b[j], col); }
    }
    if (capped && !closed) {
      const a = rings[0], b = rings[n - 1];
      for (let j = 1; j + 1 < k; j++) { m.tri(a[0], a[j + 1], a[j], col); m.tri(b[0], b[j], b[j + 1], col); }
    }
    return m;
  }
  tube(pts, r, o = {}) {
    const rad = o.rad || 5, closed = !!o.closed, n = closed && dist(pts[0], pts[pts.length - 1]) < 1e-6 ? pts.length - 1 : pts.length;
    const m = this.add(new Mesh(o.crease ?? 75, o.wear ?? 0.4)), rings = [];
    let N = null;
    for (let i = 0; i < n; i++) {
      const a = closed ? pts[(i + n - 1) % n] : pts[Math.max(0, i - 1)], b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
      const t = v3.norm(v3.sub(b, a));
      if (!N) { const up = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; N = v3.norm(v3.cross(up, t)); }
      const d = v3.dot(N, t); N = v3.norm([N[0] - t[0] * d, N[1] - t[1] * d, N[2] - t[2] * d]);
      const B = v3.cross(t, N), R = typeof r === 'function' ? r(i / (n - 1)) : r, ring = [];
      for (let j = 0; j < rad; j++) {
        const q = j / rad * TAU, cq = Math.cos(q) * R, sq = Math.sin(q) * R;
        ring.push([pts[i][0] + N[0] * cq + B[0] * sq, pts[i][1] + N[1] * cq + B[1] * sq, pts[i][2] + N[2] * cq + B[2] * sq]);
      }
      rings.push(ring);
    }
    return this.rings(rings, m, o.color ?? P.steel, closed, o.cap !== false);
  }
  // Flat band following a path; its width w lies along `up`, its thickness t across it.
  strip(pts, w, t, o = {}) {
    const n = pts.length, up = o.up || [0, 1, 0], rings = [], m = this.add(new Mesh(o.crease ?? 50, o.wear ?? 0.6));
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], T = v3.norm(v3.sub(b, a));
      const ud = v3.dot(up, T), N = v3.norm([up[0] - T[0] * ud, up[1] - T[1] * ud, up[2] - T[2] * ud]), B = v3.cross(T, N), W = (o.wf ? o.wf(i / (n - 1)) : 1) * w / 2, H = t / 2;
      const q = (s, u) => [pts[i][0] + N[0] * s * W + B[0] * u * H, pts[i][1] + N[1] * s * W + B[1] * u * H, pts[i][2] + N[2] * s * W + B[2] * u * H];
      rings.push([q(1, 1), q(-1, 1), q(-1, -1), q(1, -1)]);
    }
    return this.rings(rings, m, o.color ?? P.olive, false, true);
  }
  loft(rings, o = {}) { return this.rings(rings, this.add(new Mesh(o.crease ?? 36, o.wear ?? 1)), o.color ?? P.steel, false, true); }
  // Chamfered block, 44 triangles, weighted normals keep the faces flat and the edges soft.
  rbox(w, h, d, b, o = {}) {
    const m = this.add(new Mesh(o.crease ?? 62, o.wear ?? 1)), col = o.color ?? P.steel, E = [w / 2, h / 2, d / 2];
    const V = (s, ax) => [0, 1, 2].map(i => s[i] * (i === ax ? E[i] : E[i] - b));
    const out = (A, B, C, D) => {
      const n = v3.cross(v3.sub(B, A), v3.sub(C, A));
      const cx = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
      if (v3.dot(n, cx) < 0) { if (D) m.quad(D, C, B, A, col); else m.tri(C, B, A, col); } else if (D) m.quad(A, B, C, D, col); else m.tri(A, B, C, col);
    };
    for (let i = 0; i < 3; i++) for (const sg of [-1, 1]) {
      const j = (i + 1) % 3, k = (i + 2) % 3, S = (a, c) => { const s = [0, 0, 0]; s[i] = sg; s[j] = a; s[k] = c; return s; };
      out(V(S(1, 1), i), V(S(-1, 1), i), V(S(-1, -1), i), V(S(1, -1), i));
      for (const c of [-1, 1]) out(V(S(c, 1), i), V(S(c, 1), j), V(S(c, -1), j), V(S(c, -1), i));
    }
    for (const a of [-1, 1]) for (const c of [-1, 1]) for (const e of [-1, 1]) out(V([a, c, e], 0), V([a, c, e], 1), V([a, c, e], 2));
    return m;
  }
  // Rounded block: s rows on each rounded edge, mid cells across each face.
  soft(w, h, d, r, o = {}) {
    const s = o.s ?? 1, mid = o.mid ?? 1, m = this.add(new Mesh(o.crease ?? 70, o.wear ?? 0.5)), col = o.color ?? P.olive, E = [w / 2, h / 2, d / 2], I = E.map(e => Math.max(1e-6, e - r));
    const ticks = a => { const e = E[a], n = I[a], t = []; for (let q = s; q >= 1; q--) t.push(-n - (e - n) * Math.tan(q / s * PI / 4)); for (let q = 0; q <= mid; q++) t.push(-n + 2 * n * q / mid); for (let q = 1; q <= s; q++) t.push(n + (e - n) * Math.tan(q / s * PI / 4)); return t; };
    const T = [ticks(0), ticks(1), ticks(2)];
    const proj = c => { const q = [clamp(c[0], -I[0], I[0]), clamp(c[1], -I[1], I[1]), clamp(c[2], -I[2], I[2])], dn = v3.norm(v3.sub(c, q)); return [q[0] + dn[0] * r, q[1] + dn[1] * r, q[2] + dn[2] * r]; };
    for (let i = 0; i < 3; i++) for (const sg of [-1, 1]) {
      const j = (i + 1) % 3, k = (i + 2) % 3;
      const pt = (a, b) => { const c = [0, 0, 0]; c[i] = sg * E[i]; c[j] = a; c[k] = b; return proj(c); };
      for (let a = 0; a + 1 < T[j].length; a++) for (let b = 0; b + 1 < T[k].length; b++) {
        const A = pt(T[j][a], T[k][b]), B = pt(T[j][a + 1], T[k][b]), C = pt(T[j][a + 1], T[k][b + 1]), D = pt(T[j][a], T[k][b + 1]);
        if (sg > 0) m.quad(A, B, C, D, col); else m.quad(D, C, B, A, col);
      }
    }
    return m;
  }
  // Extruded outline along Z with a bevel; holes are CW outlines.
  slab(contour, t, o = {}) {
    const T = this.T, b = o.b ?? Math.min(t * 0.3, 0.003), holes = o.holes || [], col = o.color ?? P.steel, capc = o.cap ?? col, m = this.add(new Mesh(o.crease ?? 48, o.wear ?? 1));
    const z = t / 2, inC = b > 0 ? insetPoly(contour, b) : contour, inH = holes.map(h => (b > 0 ? insetPoly(h, b) : h));
    const V2 = a => a.map(q => new T.Vector2(q[0], q[1]));
    const tris = T.ShapeUtils.triangulateShape(V2(inC), inH.map(V2)), all = inC.concat(...inH);
    for (const f of tris) {
      const A = all[f[0]], B = all[f[1]], C = all[f[2]];
      m.tri([A[0], A[1], z], [B[0], B[1], z], [C[0], C[1], z], capc);
      m.tri([C[0], C[1], -z], [B[0], B[1], -z], [A[0], A[1], -z], capc);
    }
    const wall = (full, inner) => {
      const R = b > 0 ? [[inner, z], [full, z - b], [full, -z + b], [inner, -z]] : [[full, z], [full, -z]];
      for (let r = 0; r + 1 < R.length; r++) for (let i = 0; i < full.length; i++) {
        const i1 = (i + 1) % full.length, a = R[r][0], c = R[r + 1][0], za = R[r][1], zc = R[r + 1][1];
        m.quad([a[i][0], a[i][1], za], [c[i][0], c[i][1], zc], [c[i1][0], c[i1][1], zc], [a[i1][0], a[i1][1], za], col);
      }
    };
    wall(contour, inC); holes.forEach((h, i) => wall(h, inH[i]));
    return m;
  }
  // Tessellated flat plate (bendable), +Z front, with corner cuts and an optional real rectangular hole.
  panel(w, h, t, o = {}) {
    const m = this.add(new Mesh(o.crease ?? 40, o.wear ?? 1)), col = o.color ?? P.olive, back = o.back ?? col, edge = o.edge ?? col;
    const ct = o.cTop ?? o.chamfer ?? 0, cb = o.cBot ?? o.chamfer ?? 0, H = o.hole, hw = w / 2, hh = h / 2;
    const breaks = (a, b, n, extra) => { const s = new Set(); for (let i = 0; i <= n; i++) s.add(+(a + (b - a) * i / n).toFixed(5)); extra.forEach(e => s.add(+e.toFixed(5))); return [...s].sort((x, y) => x - y); };
    const xs = breaks(-hw, hw, o.cols || 8, [...(ct ? [-hw + ct, hw - ct] : []), ...(cb ? [-hw + cb, hw - cb] : []), ...(H ? [H[0], H[1]] : [])]);
    const vs = breaks(-1, 1, o.rows || 6, H ? [H[2] / hh, H[3] / hh] : []);
    const top = x => hh - Math.max(0, Math.abs(x) - (hw - ct)), bot = x => -hh + Math.max(0, Math.abs(x) - (hw - cb));
    const Y = (x, v) => (v < 0 ? -v * bot(x) : v * top(x));
    const inHole = (x0, x1, v0, v1) => H && x0 >= H[0] - 1e-5 && x1 <= H[1] + 1e-5 && v0 * hh >= H[2] - 1e-4 && v1 * hh <= H[3] + 1e-4;
    const z = t / 2;
    for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < vs.length; j++) {
      const x0 = xs[i], x1 = xs[i + 1], v0 = vs[j], v1 = vs[j + 1];
      if (inHole(x0, x1, v0, v1)) continue;
      m.quad([x0, Y(x0, v0), z], [x1, Y(x1, v0), z], [x1, Y(x1, v1), z], [x0, Y(x0, v1), z], col);
      m.quad([x0, Y(x0, v1), -z], [x1, Y(x1, v1), -z], [x1, Y(x1, v0), -z], [x0, Y(x0, v0), -z], back);
    }
    const loop = [];
    for (const x of xs) loop.push([x, Y(x, -1)]);
    for (let j = 1; j < vs.length; j++) loop.push([hw, Y(hw, vs[j])]);
    for (let i = xs.length - 2; i >= 0; i--) loop.push([xs[i], Y(xs[i], 1)]);
    for (let j = vs.length - 2; j > 0; j--) loop.push([-hw, Y(-hw, vs[j])]);
    const wall = (L, c) => { for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) continue; m.quad([a[0], a[1], z], [a[0], a[1], -z], [b[0], b[1], -z], [b[0], b[1], z], c); } };
    wall(loop, edge);
    if (H) {
      const hx = xs.filter(x => x >= H[0] - 1e-5 && x <= H[1] + 1e-5), hy = vs.map(v => v * hh).filter(y => y >= H[2] - 1e-4 && y <= H[3] + 1e-4), L = [];
      for (let j = 0; j < hy.length - 1; j++) L.push([H[0], hy[j]]);
      for (const x of hx) L.push([x, H[3]]);
      for (let j = hy.length - 2; j >= 1; j--) L.push([H[1], hy[j]]);
      for (let i = hx.length - 1; i >= 0; i--) L.push([hx[i], H[2]]);
      wall(L, o.holeColor ?? P.black);
    }
    m.outline = loop;
    return m;
  }
  // Flat decals facing +Z (stencil bars, labels). rects: [x0, y0, x1, y1, color?]
  decal(rects, z, col = P.ink) {
    const m = this.add(new Mesh(10, 0));
    for (const r of rects) m.quad([r[0], r[1], z], [r[2], r[1], z], [r[2], r[3], z], [r[0], r[3], z], r[4] ?? col);
    return m;
  }
  // Abstract stencil block: uneven bars, never letters.
  stencil(x, y, w, h, n, z, col = P.ink, seed = 3) {
    const r = [], bw = w / (n * 1.5 - 0.5);
    for (let i = 0; i < n; i++) { const k = ((seed * (i + 3) * 7) % 5) / 5, x0 = x + i * bw * 1.5; r.push([x0, y, x0 + bw, y + h * (0.55 + k * 0.45)]); }
    return this.decal(r, z, col);
  }
  // Rivet heads facing +Z.
  rivet(x, y, z, r, col = P.steelD) { return this.dome(r, r * 0.6, { seg: 5, rows: 2, color: col, wear: 1.4 }).rx(PI / 2).move(x, y, z); }
  // Ring of round flush dots on a vertical cylinder.
  dots(R, y, n, r, col, off = 0) {
    const m = this.add(new Mesh(10, 0));
    for (let i = 0; i < n; i++) {
      const a = (i + off) / n * TAU, s = Math.sin(a), c = Math.cos(a), C = [R * s, y, R * c], U = [c, 0, -s], pts = [];
      for (let q = 0; q < 6; q++) { const t = q / 6 * TAU, u = Math.cos(t) * r, v = Math.sin(t) * r; pts.push([C[0] + U[0] * u, y + v, C[2] + U[2] * u]); }
      for (let q = 1; q < 5; q++) m.tri(pts[0], pts[q], pts[q + 1], col);
    }
    return m;
  }
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---- baking --------------------------------------------------------------------------------
function bakeMesh(T, m, ox, oy, oz, seed) {
  const n = m.p.length / 3, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), p = m.p;
  const nt = n / 3 | 0, fa = new Float32Array(nt * 3), fu = new Float32Array(nt * 3), buckets = new Map();
  for (let f = 0; f < nt; f++) {
    const i = f * 9, ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2], vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z) || 1;
    fa[f * 3] = x; fa[f * 3 + 1] = y; fa[f * 3 + 2] = z; fu[f * 3] = x / l; fu[f * 3 + 1] = y / l; fu[f * 3 + 2] = z / l;
  }
  for (let v = 0; v < n; v++) {
    const k = Math.round(p[v * 3] * 40000) + ',' + Math.round(p[v * 3 + 1] * 40000) + ',' + Math.round(p[v * 3 + 2] * 40000);
    let b = buckets.get(k); if (!b) buckets.set(k, b = []); b.push(v);
  }
  const cc = Math.cos(m.crease * PI / 180), linear = new Map();
  const lin = h => { let c = linear.get(h); if (!c) linear.set(h, c = [s2l((h >> 16 & 255) / 255), s2l((h >> 8 & 255) / 255), s2l((h & 255) / 255)]); return c; };
  for (const b of buckets.values()) for (const v of b) {
    const f = v / 3 | 0; let x = 0, y = 0, z = 0;
    for (const w of b) { const g = w / 3 | 0; if (fu[f * 3] * fu[g * 3] + fu[f * 3 + 1] * fu[g * 3 + 1] + fu[f * 3 + 2] * fu[g * 3 + 2] >= cc) { x += fa[g * 3]; y += fa[g * 3 + 1]; z += fa[g * 3 + 2]; } }
    const l = Math.hypot(x, y, z);
    if (l > 0) { x /= l; y /= l; z /= l; } else { x = fu[f * 3]; y = fu[f * 3 + 1]; z = fu[f * 3 + 2]; }
    nor[v * 3] = x; nor[v * 3 + 1] = y; nor[v * 3 + 2] = z;
    // worn edges where the smoothed normal leaves the flat face, tiny seeded grain everywhere
    const dv = 1 - (x * fu[f * 3] + y * fu[f * 3 + 1] + z * fu[f * 3 + 2]), w = 1 + 0.34 * m.wear * sstep(0.025, 0.2, dv);
    const px = p[v * 3], py = p[v * 3 + 1], pz = p[v * 3 + 2], g = 0.955 + 0.09 * hash(px, py, pz, seed), blot = 1 + 0.05 * Math.sin(px * 37 + seed) * Math.sin(py * 29 - seed) * Math.sin(pz * 31 + seed * 0.5);
    const c = lin(m.c[v]), s = w * g * blot;
    col[v * 3] = Math.min(1, c[0] * s + (w - 1) * 0.012); col[v * 3 + 1] = Math.min(1, c[1] * s + (w - 1) * 0.012); col[v * 3 + 2] = Math.min(1, c[2] * s + (w - 1) * 0.012);
    pos[v * 3] = px - ox; pos[v * 3 + 1] = py - oy; pos[v * 3 + 2] = pz - oz;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.BufferAttribute(nor, 3));
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  return g;
}
function bakeList(T, list, pivot, seed) {
  const geos = list.filter(m => m.p.length).map(m => bakeMesh(T, m, pivot[0], pivot[1], pivot[2], seed));
  const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
  if (geos.length > 1) for (const q of geos) q.dispose();
  g.computeBoundingSphere();
  return g;
}

// ---- items ---------------------------------------------------------------------------------
const B = {
  syringe(k) {
    k.lathe([[0, -.0362], [.0017, -.0362, P.glassD], [.0019, -.0312], [.0064, -.0285, P.amber], [.0074, -.0262], [.0074, -.018], [.0074, -.006], [.0074, .0085], [.0074, .012, P.black], [.0074, .0152, P.glass], [.0074, .024], [.0074, .0345, P.glassL], [.0082, .0362], [.0082, .0388], [.0058, .0394, P.glassD], [0, .0394]], { seg: 16, crease: 34 })
      .paint((x, y, z, c) => { const a = Math.atan2(x, z); if (c === P.amber || c === P.glass) return Math.abs(a - .9) < .28 ? (c === P.amber ? 0xf6c25a : P.glassL) : c; });
    for (let i = 0; i < 9; i++) { const y = -.022 + i * .0062, L = i % 2 ? .55 : 1; k.lathe([[.00755, y, P.ink], [.00755, y + .0007]], { seg: 2, arc: 1.0 * L, phi: -.45, wear: 0 }); }
    k.slab(roundPoly([[-.0185, -.0058, .005], [.0185, -.0058, .005], [.0185, .0058, .005], [-.0185, .0058, .005]], 3), .0024, { b: .0006, color: P.glassL }).rx(PI / 2).move(0, .0378, 0);
    k.part('plunger', [0, .0394, 0], () => {
      k.rbox(.0098, .046, .0022, .0005, { color: P.white }).move(0, .0445, 0);
      k.rbox(.0022, .046, .0098, .0005, { color: P.white }).move(0, .0445, 0);
      k.lathe([[.0045, .0145, P.black], [.0072, .0150], [.0072, .0196], [.0044, .0205], [.0022, .0215, P.white], [.0022, .022]], { seg: 10 });
      k.lathe([[0, .0660, P.white], [.0058, .0660], [.0094, .0668], [.0094, .0688], [.0072, .0700], [0, .0704]], { seg: 14, crease: 40 });
    });
    k.part('needle', [0, -.0362, 0], () => {
      k.lathe([[0, -.0425, P.steel], [.0011, -.0425], [.0023, -.0408, P.teal], [.0023, -.0372], [.0031, -.0362], [0, -.0362]], { seg: 10 });
      k.lathe([[0, -.0760, P.steelL], [.00052, -.0738], [.00052, -.0425], [0, -.0425]], { seg: 6, crease: 60 });
    });
  },
  bandage(k) {
    const R = .031, H = .072, r = .0075, prof = [];
    for (let i = 0; i <= 4; i++) prof.push([r + (R - r) * i / 4, -H / 2 - (i % 2 ? .0012 : 0), i % 2 ? P.gauzeD : P.gauze]);
    const rows = 13;
    for (let i = 1; i < rows; i++) prof.push([R + (i % 2 ? .0011 : -.0002), -H / 2 + H * i / rows, i % 2 ? P.gauze : P.gauzeD]);
    for (let i = 4; i >= 0; i--) prof.push([r + (R - r) * i / 4, H / 2 + (i % 2 ? .0012 : 0), i % 2 ? P.gauzeD : P.gauze]);
    prof.push([r, -H / 2, P.gauzeD]);
    const roll = k.lathe(prof, { seg: 20, crease: 80, wear: 0 });
    roll.map(v => { const q = Math.hypot(v[0], v[2]); if (q > r + .001) { const a = Math.atan2(v[0], v[2]), f = 1 + .011 * Math.sin(a * 7 + v[1] * 90); v[0] *= f; v[2] *= f; } });
    const path = [];
    for (let i = 0; i <= 9; i++) { const t = i / 9, a = -.2 - t * 1.75, rr = R + .0016 + t * t * t * .021; path.push([Math.sin(a) * rr, -.004 - t * t * .012 + Math.sin(t * 8) * .0012, Math.cos(a) * rr]); }
    k.strip(path, .052, .0014, { color: P.gauze, crease: 60 });
    const e = path[9], f = path[8], d = v3.norm(v3.sub(e, f)), ud = d[1], Nn = v3.norm([-d[0] * ud, 1 - d[1] * ud, -d[2] * ud]), m = k.add(new Mesh(30, 0));
    for (let i = 0; i < 6; i++) {
      const w0 = -.026 + i * .00867, w1 = w0 + .00867, base = y => [e[0] + Nn[0] * y, e[1] + Nn[1] * y, e[2] + Nn[2] * y], mid = w0 + .0043, tip = [e[0] + Nn[0] * mid + d[0] * .0085, e[1] + Nn[1] * mid + d[1] * .0085, e[2] + Nn[2] * mid + d[2] * .0085];
      m.tri(base(w0), tip, base(w1), P.gauze); m.tri(base(w1), tip, base(w0), P.gauze);
    }
  },
  medkit(k) {
    const body = k.soft(.26, .135, .116, .034, { s: 2, mid: 1, color: P.khaki });
    const puff = (x, y) => 1 + .1 * Math.max(0, 1 - (x / .13) ** 2) * Math.max(0, 1 - ((y - .0675) / .0675) ** 2);
    body.move(0, .0675, 0).map(v => { v[2] *= puff(v[0], v[1]); });
    body.paint((x, y, z, c) => (y < .012 ? 0x5f5840 : c));
    const zo = roundPoly([[-.1315, -.0605, .032], [-.05, -.0605], [.05, -.0605], [.1315, -.0605, .032], [.1315, .0605, .032], [.05, .0605], [-.05, .0605], [-.1315, .0605, .032]], 3);
    k.tube(zo.map(q => [q[0], .0925, q[1] * puff(q[0], .0925)]), .0027, { closed: true, rad: 3, color: P.black, wear: 0 });
    k.strip([[.097, .0925, -.0652], [.097, .0845, -.0662], [.097, .0755, -.0652]], .0072, .0018, { up: [1, 0, 0], color: P.steelL });
    const patch = k.group(() => {
      k.slab(roundPoly([[-.041, -.033, .012], [.041, -.033, .012], [.041, .033, .012], [-.041, .033, .012]], 2), .0035, { b: .0012, color: P.green, cap: P.green });
      const a = .0105, b = .0265;
      k.slab([[-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]], .0024, { b: .0005, color: P.ivory }).move(0, 0, .002);
    });
    patch.ry(PI).move(0, .047, -.0635);
    for (const x of [-.09, .09]) {
      const s = []; for (let i = 0; i <= 5; i++) { const t = i / 5, y = .004 + t * .083; s.push([x, y, -.058 * puff(x, y) - .0016]); }
      k.strip(s, .019, .0024, { up: [1, 0, 0], color: P.oliveD });
      k.rbox(.025, .011, .006, .002, { color: P.black }).move(x, .05, -.0625);
    }
    k.part('flap', [0, .132, .058], () => {
      const path = k.spline([[0, .118, .0625], [0, .134, .0505], [0, .1405, .018], [0, .1392, -.022], [0, .1272, -.0535], [0, .1105, -.0672], [0, .0975, -.0705]], 10);
      k.strip(path, .263, .0088, { up: [1, 0, 0], color: P.tan, wf: t => (t > .8 ? 1 - ((t - .8) / .2) ** 2 * .14 : 1), crease: 55, wear: .8 });
      k.tube(k.spline([[-.112, .0975, -.0752], [-.05, .095, -.0758], [.05, .095, -.0758], [.112, .0975, -.0752]], 8), .0021, { rad: 3, color: P.clothD });
      k.rbox(.026, .009, .0048, .0016, { color: P.black }).move(0, .105, -.0738);
    });
    k.strip(k.spline([[-.055, .146, .012], [-.04, .1645, .012], [0, .1705, .012], [.04, .1645, .012], [.055, .146, .012]], 10), .016, .0032, { up: [0, 0, 1], color: P.oliveD });
  },
  adren(k) {
    const blk = P.gun;
    k.lathe([[.0108, -.0585, blk], [.0132, -.056], [.0138, -.05], [.0138, -.044, P.orange], [.0138, -.034, P.gun], [.0138, -.03], [.0134, -.027], [.0138, -.0245], [.0134, -.0215], [.0138, -.019], [.0138, -.016, P.steelD], [.0138, .03, P.gun], [.0138, .056], [.0132, .059, P.steelD], [.0104, .0615, P.orange], [.0104, .0705], [.0086, .0745], [.0036, .0758], [0, .0758]], { seg: 18, crease: 34 });
    k.lathe([[.01405, -.012, P.amberD], [.01405, -.009, P.amber], [.01405, .0215, P.amberD], [.01405, .0245]], { seg: 5, arc: 1.05, phi: PI - .52, wear: 0, crease: 70 })
      .paint((x, y, z, c) => (y > .004 && y < .016 && c === P.amber ? 0xf4c766 : c));
    k.lathe([[.0141, .03, P.ivory], [.0141, .0475]], { seg: 6, arc: 1.3, phi: PI - .65, wear: 0, crease: 70 });
    for (let i = 0; i < 4; i++) k.lathe([[.01425, .0325 + i * .0035, P.ink], [.01425, .0343 + i * .0035]], { seg: 3, arc: .9 - i * .14, phi: PI - .45, wear: 0 });
    k.part('cap', [0, -.0585, 0], () => {
      const pr = [[0, -.0935, P.orange], [.0065, -.0935], [.0098, -.0915], [.0118, -.087]];
      for (let i = 0; i < 6; i++) pr.push([i % 2 ? .0128 : .0138, -.083 + i * .0042, i % 2 ? 0xa84b12 : P.orange]);
      pr.push([.0134, -.059, P.orange], [.0102, -.0585], [0, -.0585]);
      k.lathe(pr, { seg: 16, crease: 40 });
      k.torus(.0045, .0012, { seg: 8, rad: 4, color: 0xa84b12 }).rx(PI / 2).move(0, -.0955, 0);
    });
  },
  plate(k) {
    const W = .252, Ht = .302, T = .021, c = .05;
    const g = k.group(() => {
      const pl = k.panel(W, Ht, T, { cols: 10, rows: 8, cTop: c, cBot: .018, color: P.oliveD, back: 0x2f3526, edge: P.black });
      const o = pl.outline.map(q => [q[0] * 1.002, q[1] * 1.002, 0]);
      k.tube(o, .0132, { closed: true, rad: 5, color: P.gun, crease: 80, wear: .9 });
      k.stencil(-.058, -.098, .116, .022, 7, T / 2 + .0006, P.sand, 3);
      k.stencil(-.036, -.066, .072, .010, 5, T / 2 + .0006, P.oliveL, 5);
      k.decal([[-.09, .068, .09, .0705, P.oliveL], [-.09, .058, .05, .0602, P.oliveL]], T / 2 + .0006);
      for (const [x, y] of [[-.104, -.128], [.104, -.128], [-.112, .03], [.112, .03], [-.062, .128], [.062, .128]]) k.rivet(x, y, T / 2, .0052, P.steelD);
    });
    g.bendX(1.1).bendY(.36).ry(PI).move(0, 0, -.018);
  },
  frag(k) {
    const R = .0335, pr = [[0, -R, P.oliveD]], N = 5;
    for (let i = 0; i < N; i++) {
      const a0 = -PI / 2 + .24 + (i / N) * 2.46, a1 = a0 + 2.46 / N * .66, a2 = a0 + 2.46 / N;
      const col = i === 2 ? P.yellow : (i % 2 ? P.olive : 0x525a38);
      pr.push([R * Math.cos(a0), R * Math.sin(a0) * 1.02, col], [R * 1.05 * Math.cos((a0 + a1) / 2), R * 1.05 * Math.sin((a0 + a1) / 2) * 1.02, col], [R * Math.cos(a1), R * Math.sin(a1) * 1.02, P.oliveD], [R * .93 * Math.cos((a1 + a2) / 2), R * .93 * Math.sin((a1 + a2) / 2) * 1.02, P.oliveD]);
    }
    pr.push([.0125, .0345, P.gun], [.0108, .037]);
    k.lathe(pr, { seg: 15, crease: 46 });
    k.lathe([[.0106, .0362, P.steelD], [.0106, .0425], [.0128, .0432], [.0128, .0462, P.steel], [.0106, .0472], [.0088, .0512, P.brassD], [.0088, .0532], [.0045, .0548, P.steelD], [0, .0552]], { seg: 12, crease: 40 });
    k.strip(k.spline([[.0015, .0525, 0], [.012, .0565, 0], [.0232, .0485, 0], [.0322, .0285, 0], [.0372, .002, 0], [.0362, -.0225, 0], [.0312, -.0335, 0]], 12), .0135, .0017, { up: [0, 0, 1], color: P.steel, wf: t => (t > .72 ? 1 - (t - .72) * 1.2 : .82 + t * .25), wear: 1.2 });
    k.tube([[-.008, .0462, 0], [-.0142, .0462, .0002], [-.0192, .0462, .0003]], .0011, { rad: 4, color: P.steelL });
    k.torus(.0122, .00135, { seg: 16, rad: 4, color: P.steelL }).rx(PI / 2).rz(.14).move(-.0306, .0432, 0);
  },
  sticky(k) {
    k.lathe([[0, -.0745, P.gun], [.0115, -.0745], [.015, -.0718], [.0215, -.0672, P.oliveD], [.0268, -.058], [.0288, -.044, P.olive], [.0288, -.034, P.oliveD], [.0295, -.031, P.olive], [.0295, -.012], [.0288, -.009, P.oliveD], [.0288, .0035, P.olive], [.0278, .0115, P.steelD], [0, .0118]], { seg: 14, crease: 36 });
    k.lathe([[.0296, -.0248, P.yellow], [.0296, -.0168]], { seg: 14, wear: 0 });
    for (let i = 0; i < 3; i++) k.torus(.0312 - i * .0012, .0044, { seg: 14, rad: 5, color: i === 1 ? 0x3f4144 : P.rubber }).move(0, .0138 + i * .0072, 0);
    const pr = [[.0335, .0296, P.gooD]];
    for (let i = 1; i <= 7; i++) { const a = i / 7 * PI / 2; pr.push([.0345 * Math.cos(a), .0296 + .0372 * Math.sin(a), i < 3 ? P.gooD : P.goo]); }
    const dome = k.lathe(pr, { seg: 14, crease: 75, wear: 0 });
    dome.map(v => { const a = Math.atan2(v[0], v[2]), f = 1 + .05 * Math.sin(a * 3 + 1) * Math.sin((v[1] - .03) * 90) + .022 * Math.sin(a * 7); v[0] *= f; v[2] *= f; v[1] += .0016 * Math.sin(a * 5) * (1 - (v[1] - .03) / .04); });
    dome.paint((x, y, z, c) => (Math.abs(Math.atan2(x, z) + .9) < .34 && y > .045 ? 0xe2e68a : c));
    for (const [a, l] of [[.3, .013], [1.6, .019], [2.9, .010], [4.4, .016], [5.5, .012]]) {
      const x = Math.sin(a), z = Math.cos(a), q = .0372;
      k.tube([[x * .033, .033, z * .033], [x * q, .029, z * q], [x * (q + .0004), .029 - l * .5, z * (q + .0004)], [x * (q - .0002), .029 - l, z * (q - .0002)]], t => .0029 * (1 - t * .3), { rad: 3, color: P.gooD, wear: 0 });
    }
    k.torus(.0125, .0016, { seg: 14, rad: 4, color: P.steelL }).rx(PI / 2).move(0, -.0905, 0);
    k.tube([[0, -.0745, 0], [0, -.0785, 0]], .0013, { rad: 4, color: P.steel });
  },
  molotov(k) {
    const L = .012, b = P.bottle, l = P.amber;
    k.lathe([[0, -.088, P.bottleD], [.021, -.0872], [.0285, -.0905], [.0345, -.087], [.0365, -.08, l], [.0372, -.065], [.0372, -.03], [.0372, L, 0xf4b64a], [.0372, L + .0025, b], [.0372, .03], [.0368, .05], [.0318, .068], [.0212, .084], [.0142, .0955], [.0118, .106], [.0115, .135], [.0138, .1365, P.bottleD], [.0138, .1415], [.0112, .1432], [.0072, .1425, P.black], [0, .14]], { seg: 18, crease: 40, wear: .5 })
      .paint((x, y, z, c) => {
        const a = Math.atan2(x, z);
        if (Math.abs(a - 2.1) < .2 && y > -.07 && y < .06) return c === P.bottle ? 0xdbe8cf : 0xffd98c;
        if (Math.abs(a + 2.4) < .1 && y > -.06 && y < .04) return c === P.bottle ? 0xb9cdaa : 0xf8c068;
      });
    k.lathe([[.0376, -.038, P.ivory], [.0376, .002]], { seg: 7, arc: 1.2, phi: PI - .6, wear: 0, crease: 70 });
    k.stencil(-.016, -.03, .032, .018, 5, 0, P.ink, 2).rx(0).ry(PI).map(v => { const t = v[0] / .0382; v[2] = -.0382 * Math.cos(t); v[0] = .0382 * Math.sin(t); });
    k.part('rag', [0, .118, 0], () => {
      const w = [];
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, r = .0138 + .0016 * Math.sin(a * 5); w.push([Math.sin(a) * r, .1195 + Math.sin(a * 3) * .0028, Math.cos(a) * r]); }
      k.tube(w, .0052, { closed: true, rad: 5, color: P.cloth, wear: 0 });
      const top = [[.004, .129, .012], [.012, .1425, .008], [.008, .155, -.002], [-.006, .1625, -.004], [-.016, .172, .002], [-.018, .181, .012]];
      k.strip(k.spline(top, 10), .019, .0016, { up: [.5, .3, .8], color: P.clothD, wf: t => 1 - t * .55, crease: 70, wear: 0 });
      const tail = [[.012, .118, -.009], [.024, .112, -.016], [.031, .094, -.023], [.03, .071, -.03], [.038, .05, -.034], [.043, .034, -.039]];
      k.strip(k.spline(tail, 14), .029, .0018, { up: [.68, .12, .72], color: P.cloth, wf: t => 1 - t * .42, crease: 70, wear: 0 }).paint((x, y, z, c) => (y < .06 ? P.clothD : c));
    });
  },
  mine(k) {
    const body = k.lathe([[0, 0, P.oliveD], [.098, 0], [.1115, .0028], [.1155, .009, P.olive], [.1155, .022], [.1085, .0295, P.oliveL], [.1015, .0325, P.oliveD], [.0965, .0382, P.olive], [.0905, .0402, P.oliveD], [0, .0402]], { seg: 32, crease: 40 });
    body.map(v => { if (v[1] > .004 && v[1] < .028) { const a = Math.atan2(v[0], v[2]), f = 1 + .042 * Math.max(0, Math.cos(a * 16)); v[0] *= f; v[2] *= f; } });
    k.lathe([[.084, .0392, P.gun], [.086, .046, P.olive], [.0795, .05], [.0625, .0512, P.oliveL], [.059, .0498, P.oliveD], [.056, .0512, P.oliveL], [.0305, .0536], [.028, .0522, P.oliveD], [.0125, .0552, P.oliveL], [.006, .0584, P.steel], [0, .0584]], { seg: 18, crease: 36 });
    const m = k.add(new Mesh(10, 0));
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, s = Math.sin(a), c = Math.cos(a), w = .0022, in0 = .036, out = .057, y = .0548; m.quad([s * out + c * w, y - .0016, c * out - s * w], [s * out - c * w, y - .0016, c * out + s * w], [s * in0 - c * w, y + .0006, c * in0 + s * w], [s * in0 + c * w, y + .0006, c * in0 - s * w], P.oliveD); }
    for (let i = 0; i < 3; i++) {
      const a = PI + .5 + i / 3 * TAU, x = Math.sin(a) * .071, z = Math.cos(a) * .071;
      k.lathe([[.0058, .049, P.gun], [.0058, .0528], [.0015, .0555, P.steelL], [.0013, .0835], [.0031, .0868, P.red], [.0031, .0895], [0, .0925]], { seg: 5, crease: 50 }).move(x, 0, z);
    }
    k.part('led', [0, .0572, -.0235], () => { k.dome(.0042, .0034, { seg: 8, rows: 2, color: P.led, wear: 0 }).move(0, .0572, -.0235); });
    k.lathe([[.0056, .0545, P.black], [.0056, .0568], [.0048, .0572]], { seg: 8 }).move(0, 0, -.0235);
  },
  c4(k) {
    const blk = (x, y, z, w, h, d, seed) => {
      const m = k.soft(w, h, d, Math.min(h, d) * .32, { s: 1, mid: 1, color: P.putty, crease: 75, wear: .35 });
      m.map(v => { const f = 1 + .05 * Math.sin(v[0] * 40 + seed) * Math.cos(v[2] * 55 + seed * 2); v[1] *= f; v[2] *= 1 + .04 * Math.sin(v[0] * 27 + seed * 3); }).move(x, y, z);
      m.paint((px, py, pz, c) => (py < y - h * .34 ? P.puttyD : c));
    };
    blk(0, .0235, -.039, .205, .047, .056, 1); blk(.003, .0235, .019, .205, .047, .056, 2.2); blk(-.004, .0235, .0755, .19, .047, .05, 3.1);
    blk(-.004, .0665, -.012, .178, .043, .056, 4.3); blk(.007, .0665, .047, .165, .043, .052, 5.7);
    for (const x of [-.066, .056]) {
      const o = roundPoly([[-.0725, .0, .02], [.1065, .0, .02], [.1065, .0885, .03], [-.0725, .0885, .03]], 3).map(q => [x + (x > 0 ? .002 : 0), q[1] + .0052, q[0]]);
      k.tube(o.concat([o[0]]), .0052, { closed: true, rad: 3, color: P.oliveD, crease: 70 }).map(v => { v[0] = x + (v[0] - x) * 2.3; });
      k.rbox(.031, .012, .008, .002, { color: P.black }).move(x, .0925, .017);
    }
    // detonator cap pushed into the top block, wires to a small receiver
    k.lathe([[0, -.03, P.steelD], [.0048, -.0292], [.0052, -.024, P.steelL], [.0052, .012], [.0058, .0135, P.copper], [.0058, .018], [.0036, .0202, P.black], [.0024, .0255], [0, .026]], { seg: 8 }).rz(-PI / 2.2).rx(.18).move(.098, .074, .016);
    k.tube(k.spline([[.122, .079, .021], [.145, .092, .03], [.156, .116, .012], [.128, .135, -.018], [.086, .128, -.032], [.054, .113, -.031]], 11), .0017, { rad: 3, color: P.red, wear: 0 });
    k.tube(k.spline([[.122, .074, .013], [.149, .082, .008], [.164, .104, -.024], [.135, .124, -.046], [.09, .118, -.05], [.054, .107, -.04]], 11), .0017, { rad: 3, color: P.black, wear: 0 });
    k.rbox(.054, .023, .04, .0055, { color: P.gun, wear: .9 }).move(.026, .1, -.034);
    k.rbox(.012, .006, .016, .0015, { color: P.steelD }).move(.058, .106, -.036);
    k.part('led', [.012, .1115, -.046], () => { k.dome(.0036, .0028, { seg: 8, rows: 2, color: P.led, wear: 0 }).move(.012, .1115, -.046); });
  },
  c4remote(k) {
    k.slab(roundPoly([[-.0215, -.073, .012], [.0185, -.073, .012], [.0235, -.03, .012], [.0205, .0285, .01], [.0265, .0485, .006], [.0185, .0655, .009], [-.0205, .0675, .012], [-.0255, .0365, .012], [-.0225, -.02, .012]], 3), .037, { b: .0052, color: P.gun, cap: 0x373a3d, wear: .9 });
    for (let i = 0; i < 4; i++) k.rbox(.039, .0042, .041, .001, { color: P.rubber, wear: 0 }).move(-.0012, -.06 + i * .0135, 0);
    k.lathe([[.0135, .0675, P.steelD], [.0135, .0715], [.0105, .0725, P.black], [.0105, .0775], [.0074, .0795], [.0044, .0835, P.red], [.0044, .087], [0, .088]], { seg: 12 });
    k.slab(roundPoly([[-.0128, -.012, .003], [.0128, -.012, .003], [.0128, .012, .003], [-.0128, .012, .003]], 2), .0018, { b: .0005, color: P.yellow, cap: P.yellow }).ry(PI).move(-.002, .044, -.0192);
    k.stencil(-.0085, .039, .017, .0095, 4, -.0204, P.ink, 3).ry(0).map(v => { v[0] = -v[0] - .004; }).flip();
    k.tube(k.spline([[-.004, -.073, 0], [-.006, -.088, .004], [.012, -.098, .0], [.022, -.087, -.006], [.006, -.082, -.006], [-.012, -.095, -.002], [-.028, -.112, .004]], 18), .0023, { rad: 3, color: P.black, wear: 0 });
    k.part('lever', [.0275, .054, 0], () => {
      k.strip(k.spline([[.0208, .0605, 0], [.0322, .0525, 0], [.0418, .0255, 0], [.0442, -.012, 0], [.0425, -.046, 0], [.0368, -.0645, 0]], 14), .0285, .0046, { up: [0, 0, 1], color: P.steelD, wf: t => (t < .12 ? .68 + t * 2.6 : 1 - Math.max(0, t - .84) * 1.3), crease: 50, wear: 1.3 });
      for (let i = 0; i < 3; i++) { const y = -.04 + i * .02; k.rbox(.0026, .0052, .022, .0008, { color: P.black, wear: 0 }).rz(.05).move(.0456 - Math.abs(y + .01) * .05, y, 0); }
    });
    k.torus(.0056, .0024, { seg: 10, rad: 5, color: P.steel }).rx(PI / 2).move(.027, .054, 0);
  },
  tknife(k) {
    const hc = P.gun, sh = .0475;
    const contour = roundPoly([[-.0108, -.0592, .009], [.0108, -.0592, .009], [.0132, -.033, .007], [.0098, -.008, .006], [.0128, .017, .006], [.0145, .0355, .004], [.0165, sh, .001], [-.0165, sh, .001], [-.0145, .0355, .004], [-.0128, .017, .006], [-.0098, -.008, .006], [-.0132, -.033, .007]], 3);
    k.slab(contour, .0058, { b: .0014, color: hc, holes: [circle(.0054, 10, 0, -.0405, true), roundPoly([[-.0034, -.024, .002], [.0034, -.024, .002], [.0034, -.001, .002], [-.0034, -.001, .002]], 2).reverse(), roundPoly([[-.0034, .006, .002], [.0034, .006, .002], [.0034, .029, .002], [-.0034, .029, .002]], 2).reverse()] });
    const prof = [[.0165, sh], [.0172, .062], [.017, .08], [.0158, .1], [.0132, .122], [.0098, .14], [.0058, .1545], [.0025, .1625], [.00025, .1665]];
    const rings = prof.map(([w, y], i) => {
      const t = i < 2 ? .0029 : Math.max(.00045, .0029 * (1 - (y - .06) / .118)), q = w * .3;
      return [[w, y, 0], [q, y, -t], [-q, y, -t], [-w, y, 0], [-q, y, t], [q, y, t]];
    });
    k.loft(rings, { color: P.steelL, crease: 22 }).paint((x, y, z, c) => (Math.abs(x) < .0052 ? 0x7a8086 : (Math.abs(z) < .0007 ? 0xeef1f3 : c)));
    k.decal([[-.0025, .054, .0025, .1035, P.steelD]], .00305);
    k.decal([[-.0025, .054, .0025, .1035, P.steelD]], .00305).ry(PI);
  },
  claymore(k) {
    const W = .262, H = .132, T = .03, top = .226;
    const g = k.group(() => {
      const pl = k.panel(W, H, T, { cols: 12, rows: 3, chamfer: .016, color: P.olive, back: P.oliveD, edge: P.oliveD });
      for (const q of [pl]) q.paint((x, y, z, c) => (z > 0 && Math.abs(y) < .046 && Math.abs(x) < .112 ? 0x4a5233 : c));
      const o = pl.outline.map(q => [q[0], q[1], 0]);
      k.tube(o, .0052 + T * .36, { closed: true, rad: 3, color: P.oliveL, crease: 80, wear: 1 }).sc(1, 1, .72);
      const dots = k.add(new Mesh(10, 0)), z = T / 2 + .0006;
      for (let r = 0; r < 4; r++) for (let i = 0; i < 10; i++) {
        const x = -.1 + i * .0222 + (r % 2 ? .0095 : 0), y = -.034 + r * .0226, rr = .0048, pts = [];
        if (x > .112) continue;
        for (let q = 0; q < 6; q++) { const t = q / 6 * TAU; pts.push([x + Math.cos(t) * rr, y + Math.sin(t) * rr, z]); }
        for (let q = 1; q < 5; q++) dots.tri(pts[0], pts[q], pts[q + 1], r === 1 && i % 4 === 2 ? P.oliveL : 0x2d3322);
      }
      k.stencil(-.05, .0475, .1, .011, 8, z, P.sand, 2);
      for (let i = 0; i < 5; i++) k.rbox(.0085, H * .84, .0125, .0025, { color: P.oliveL, wear: 1.1 }).move(-.096 + i * .048, 0, -T / 2 - .0044);
    });
    g.bendY(.17).ry(PI).move(0, top - H / 2, 0);
    // sighting notch: a raised saddle with a V cut
    const n = [[-.019, 0, .002], [-.016, .0125, .002], [-.006, .0125, .001], [0, .004, 0], [.006, .0125, .001], [.016, .0125, .002], [.019, 0, .002]];
    k.slab(roundPoly(n, 2), .012, { b: .0016, color: P.steelD, wear: 1.3 }).move(0, top - .001, -.001);
    for (const sx of [-1, 1]) {
      const hx = sx * .074, hy = .058, hz = .022;
      const a = [hx - .033, top - H + .012, hz - .008], b = [hx + .033, .004, hz + .036], c = [hx + .033, top - H + .012, hz - .008], d = [hx - .033, .004, hz + .036];
      k.tube([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], b], .0036, { rad: 4, color: P.steelD, wear: 1 });
      k.tube([c, [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2, (c[2] + d[2]) / 2], d], .0036, { rad: 4, color: P.steel, wear: 1 });
      k.dome(.0065, .0035, { seg: 6, rows: 2, color: P.black }).rx(-PI / 2).move(hx, hy - .012, hz + .014);
      for (const f of [b, d]) k.lathe([[0, -.003, P.gun], [.0078, -.0005], [.0078, .0028], [0, .0044]], { seg: 4 }).sc(1, 1, 1.5).move(f[0], .0035, f[2] - .001);
    }
    k.part('led', [.052, top - .003, .012], () => { k.dome(.0042, .0032, { seg: 8, rows: 2, color: P.led, wear: 0 }).move(.052, top - .003, .012); });
  },
  flash(k) {
    const R = .0282, H = .056;
    k.lathe([[0, -H - .001, P.steelD], [.018, -H - .001], [.0265, -H + .001], [R, -H + .005, P.ivory], [R, -H + .018], [R, -H + .0185, P.steelL], [R, H - .0205, P.steelL], [R, H - .02, P.ivory], [R, H - .006], [.0262, H - .001, P.steelD], [.0175, H], [.0115, H + .0025, P.gun], [.0108, H + .009], [.0132, H + .0098, P.steelD], [.0132, H + .0132], [.0092, H + .0148, P.gun], [0, H + .0156]], { seg: 18, crease: 36 });
    for (const y of [-H + .0115, H - .0135]) k.lathe([[R + .0003, y - .0022, P.sand], [R + .0003, y + .0022]], { seg: 18, wear: 0 });
    for (let r = 0; r < 5; r++) {
      k.dots(R + .0003, -.0268 + r * .0132, 13, .0031, P.ink, r % 2 ? .5 : 0);
    }
    k.strip(k.spline([[-.003, H + .0118, 0], [.012, H + .0148, 0], [.0248, H + .002, 0], [.0312, H - .025, 0], [.033, H - .062, 0], [.031, H - .082, 0]], 10), .0118, .0016, { up: [0, 0, 1], color: P.steelL, wear: 1.2 });
    k.torus(.0112, .0012, { seg: 14, rad: 4, color: P.steelL }).rx(PI / 2).rz(.2).move(-.0252, H + .0088, 0);
    k.tube([[-.008, H + .007, 0], [-.0142, H + .0072, 0]], .001, { rad: 4, color: P.steel });
  },
  smoke(k) {
    const R = .0322, H = .0705, V = P.gun;
    const body = k.lathe([[0, -H, P.steelD], [.024, -H], [.0302, -H + .0012], [R, -H + .005, P.steelD], [R, -H + .007, P.oliveD], [R, -H + .0255, P.oliveD], [R, -H + .027, P.olive], [R, -.014], [R, -.0125, P.teal], [R, .0165], [R, .018, P.olive], [R, H - .027], [R, H - .0255, P.oliveD], [R, H - .007, P.oliveD], [R, H - .005, P.steelD], [.0302, H - .0012], [.0242, H, P.gun], [.0185, H + .0008], [.0112, H + .0015, P.steelD], [.0102, H + .0085], [.0128, H + .0095, P.steel], [.0128, H + .0132], [.0088, H + .0152, V], [0, H + .016]], { seg: 18, crease: 36 });
    body.paint((x, y, z, c) => (c === P.teal && Math.abs(y - .001) < .0018 ? P.tealD : c));
    for (const y0 of [-H + .0085, H - .0245]) {
      const m = k.add(new Mesh(30, 0));
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * TAU, da = .19, r = R + .0004, yA = y0, yB = y0 + .0145;
        const p = (q, y, rr = r) => [Math.sin(q) * rr, y, Math.cos(q) * rr];
        m.quad(p(a - da, yA), p(a + da, yA), p(a + da, yB), p(a - da, yB), V);
        m.quad(p(a - da, yB), p(a + da, yB), p(a + da * .8, yB - .0028, r + .0002), p(a - da * .8, yB - .0028, r + .0002), P.black);
      }
    }
    for (const dx of [0, 1, 2, 3]) k.lathe([[R + .0004, -.0095 + dx * .0058, P.white], [R + .0004, -.0065 + dx * .0058]], { seg: 2, arc: .62 - dx * .08, phi: PI - .4 + dx * .03, wear: 0, crease: 60 });
    k.strip(k.spline([[-.003, H + .0125, 0], [.013, H + .0158, 0], [.0282, H + .002, 0], [.0352, H - .03, 0], [.0368, H - .082, 0], [.0345, H - .104, 0]], 10), .0125, .0017, { up: [0, 0, 1], color: P.oliveL, wear: 1.2 });
    k.torus(.0118, .0013, { seg: 14, rad: 4, color: P.steelL }).rx(PI / 2).rz(.16).move(-.0272, H + .0095, 0);
    k.tube([[-.008, H + .008, 0], [-.0155, H + .0082, 0]], .001, { rad: 4, color: P.steel });
  },
  stun(k) {
    const R = .0355, H = .046;
    k.lathe([[0, -H, P.black], [.0265, -H], [.0325, -H + .002], [.0345, -H + .0065, P.gun], [R, -H + .0095]], { seg: 16, crease: 34 });
    const fl = k.lathe([[R, -H + .0095, P.gun], [R, -.0165], [R, .0165], [R, H - .0115]], { seg: 32, crease: 62, wear: .7 });
    fl.map(v => { const a = Math.atan2(v[0], v[2]), f = 1 - .11 * (.5 + .5 * Math.cos(a * 8)) ** 2; v[0] *= f; v[2] *= f; });
    const hz = k.add(new Mesh(60, 0)), hp = (a, y) => [Math.sin(a) * (R + .0007), y, Math.cos(a) * (R + .0007)], hs = TAU / 40, sl = .34;
    for (let i = 0; i < 40; i++) { const a = i * hs, b = a + hs; hz.quad(hp(a, -.0135), hp(b, -.0135), hp(b + sl, .0135), hp(a + sl, .0135), (i >> 1) % 2 ? P.black : P.yellow); }
    for (const y of [-.0148, .0148]) k.torus(.0364, .0021, { seg: 20, rad: 3, color: P.steelD }).move(0, y, 0);
    k.lathe([[R, H - .0115, P.gun], [.0345, H - .006], [.0325, H - .002, P.black], [.0222, H], [.0145, H + .004, P.gun], [.013, H + .011], [.0148, H + .0125, P.steelD], [.0148, H + .0165], [.0098, H + .0185, P.black], [0, H + .019]], { seg: 16, crease: 36 });
    k.strip(k.spline([[-.003, H + .0138, 0], [.014, H + .0178, 0], [.0292, H + .004, 0], [.0408, H - .03, 0], [.043, H - .068, 0], [.0408, H - .086, 0]], 10), .0132, .0018, { up: [0, 0, 1], color: P.yellow, wear: 1.2 });
    k.torus(.0128, .0015, { seg: 14, rad: 4, color: P.steelL }).rx(PI / 2).rz(.1).move(-.0312, H + .0125, 0);
    k.tube([[-.0095, H + .0118, 0], [-.018, H + .012, 0]], .0011, { rad: 4, color: P.steel });
  },
  decoy(k) {
    const W = .078, H = .112, D = .04;
    k.soft(W, H, D, .0115, { s: 1, mid: 1, color: P.gun, wear: .9 });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) k.soft(.026, .026, D + .006, .0095, { s: 1, mid: 1, color: P.orange, wear: .4 }).move(sx * (W / 2 - .0088), sy * (H / 2 - .0088), 0);
    const f = k.group(() => {
      k.lathe([[0, 0, P.black], [.0222, 0], [.0252, .0008, P.steelD], [.0268, .0022], [.0244, .0028, P.black], [0, .0005]], { seg: 16, crease: 50 }).rx(PI / 2);
      const m = k.add(new Mesh(10, 0));
      for (let r = 0; r < 4; r++) {
        const R = .0065 + r * .0052, n = 6 + r * 4;
        for (let i = 0; i < n; i++) { const a = (i + (r % 2 ? .5 : 0)) / n * TAU, cx = Math.cos(a) * R, cy = Math.sin(a) * R, s = .00135, z = .0011; m.quad([cx - s, cy - s, z], [cx + s, cy - s, z], [cx + s, cy + s, z], [cx - s, cy + s, z], 0x6a6e72); }
      }
      k.lathe([[0, .0012, P.steelD], [.004, .0016], [.0028, .0028], [0, .003]], { seg: 8 }).rx(PI / 2);
    });
    f.ry(PI).move(0, -.0095, -D / 2 - .0002);
    const top = k.group(() => {
      k.rbox(.046, .0165, .002, .0005, { color: P.black }).move(0, .0345, .001);
      k.decal([[-.019, .029, -.006, .04, 0x79c26a], [-.003, .031, .019, .0335, P.steelL], [-.003, .0365, .012, .039, P.steelL]], .0024);
    });
    top.ry(PI).move(0, 0, -D / 2);
    k.lathe([[.0072, 0, P.black], [.0072, .0068], [.0046, .0085, P.steelD], [.0034, .0105, P.rubber], [.0028, .046], [.0044, .049, P.rubber], [.0044, .0535], [.0024, .056], [0, .0565]], { seg: 7 }).move(.024, H / 2 - .0005, 0);
    for (let i = 0; i < 2; i++) k.rbox(.002, .018, .03, .0005, { color: P.steelD }).move(W / 2 + .0004, -.012 + i * .012, 0);
  },
  sensor(k) {
    k.lathe([[0, -.165, P.steel], [.0028, -.14], [.0065, -.1, P.steelD], [.0082, -.04], [.0088, -.012, P.gun], [.0325, -.003], [.0355, .0015, P.oliveD], [.0325, .0052], [.0158, .0088, P.gun], [.0145, .03], [0, .031]], { seg: 12, crease: 38 });
    for (let i = 0; i < 3; i++) k.rbox(.0026, .0475, .0225, .0007, { color: P.steelD }).move(0, -.045, .0155).ry(i / 3 * TAU + .4);
    const head = k.group(() => {
      k.lathe([[.0235, .0205, P.oliveD], [.0318, .0225], [.0335, .0278], [.0335, .0362, P.olive], [.033, .0432, P.yellow], [.0325, .0482, P.oliveD], [.0312, .0512, P.black], [.0282, .0565, P.gun], [.0215, .0678, P.gun], [.0115, .0758], [.0035, .0792], [0, .0795]], { seg: 18, crease: 40 })
        .paint((x, y, z, c) => (y > .056 && Math.abs(Math.atan2(x, z) - .85) < .35 ? 0x62666c : c));
      k.dots(.03365, .0322, 12, .0017, P.black);
    });
    head.sc(1.3);
    k.lathe([[.0058, 0, P.black], [.0058, .006], [.0036, .0078, P.steelD], [.0024, .0098, P.rubber], [.0017, .035], [.0012, .085], [.001, .128], [.0021, .132, P.red], [.0021, .139], [0, .1405]], { seg: 6, crease: 55 }).rz(-.2).move(.0235, .0735, .0155);
    k.part('led', [-.0156, .0915, -.0156], () => { k.dome(.0052, .004, { seg: 8, rows: 2, color: P.led, wear: 0 }).rx(-.62).rz(.32).move(-.0156, .0912, -.0156); });
  },
  shield(k) {
    const W = 1.085, H = 1.095, T = .03, base = .055, R = 1.28;
    const g = k.group(() => {
      const pl = k.panel(W, H, T, { cols: 4, rows: 3, cTop: .12, cBot: .05, color: P.olive, back: P.oliveD, edge: P.oliveL, hole: [-.17, .17, .28, .332] });
      pl.paint((x, y, z, c) => (z > 0 && x > .17 && y < .2 ? 0x636c44 : c));
      const o = pl.outline.filter((q, i, a) => { const n = a[(i + 1) % a.length]; return Math.hypot(q[0] - n[0], q[1] - n[1]) > .001; }).map(q => [q[0], q[1], 0]);
      k.tube(o, .0225, { closed: true, rad: 4, color: P.oliveL, crease: 78, wear: 1.1 }).sc(1, 1, .86);
      const fr = [[-.178, .272, 0], [.178, .272, 0], [.178, .34, 0], [-.178, .34, 0]].flatMap((q, i, a) => { const n = a[(i + 1) % 4], out = []; for (let s = 0; s < 3; s++) out.push([q[0] + (n[0] - q[0]) * s / 3, q[1] + (n[1] - q[1]) * s / 3, 0]); return out; });
      k.tube(fr, .0125, { closed: true, rad: 3, color: P.gun, crease: 65, wear: 1 }).sc(1, 1, 1.45);
      const z = T / 2;
      for (let i = -1; i <= 1; i++) for (const y of [-.505, .49]) k.rivet(i * .3, y, z, .0135);
      for (const x of [-.49, .49]) for (const y of [-.2, .2]) k.rivet(x, y, z, .0135);
      k.stencil(-.13, -.255, .26, .058, 7, z + .0008, P.sand, 3);
      k.stencil(-.09, -.164, .18, .022, 6, z + .0008, P.oliveL, 4);
      k.decal([[.215, .17, .39, .185, P.sand], [.215, .14, .33, .153, P.oliveL], [-.415, -.46, -.4, .44, P.oliveD], [.4, -.46, .415, .44, P.oliveD]], z + .0008);
      for (const x of [-.27, .27]) k.rbox(.05, .92, .024, .007, { color: P.oliveD }).move(x, -.03, -z - .009);
      k.tube(k.spline([[-.1, .03, -z - .004], [-.09, .03, -z - .062], [0, .03, -z - .07], [.09, .03, -z - .062], [.1, .03, -z - .004]], 9), .013, { rad: 4, color: P.black, wear: .5 });
    });
    g.bendY(R).ry(PI).move(0, base + H / 2, .03);
    k.part('legs', [0, .36, .085], () => {
      for (const sx of [-1, 1]) {
        const hip = [sx * .3, .36, .082], foot = [sx * .5, .014, .36];
        k.tube([hip, [(hip[0] + foot[0]) / 2, (hip[1] + foot[1]) / 2 + .012, (hip[2] + foot[2]) / 2], foot], .0175, { rad: 5, color: P.gun, wear: .9 });
        k.lathe([[.0235, -.0135, P.black], [.033, -.009], [.033, .0015], [.018, .012], [0, .0135]], { seg: 6 }).sc(1, 1, 1.45).move(foot[0], .0135, foot[2]);
      }
      k.tube(k.spline([[-.405, .185, .226], [0, .205, .246], [.405, .185, .226]], 8), .012, { rad: 4, color: P.steelD });
    });
  },
  ammobox(k) {
    const W = .34, H = .185, D = .2;
    const body = k.soft(W, H, D, .03, { s: 1, mid: 1, color: P.olive, wear: .7 });
    body.move(0, H / 2, 0);
    body.paint((x, y, z, c) => (y < .014 ? 0x3a402a : c));
    for (const sx of [-1, 1]) k.rbox(.014, H * .78, D + .005, .004, { color: P.oliveL, wear: 1.1 }).move(sx * .152, H * .46, .003);
    k.rbox(W + .006, .018, D + .006, .005, { color: P.oliveD }).move(0, .017, 0);
    k.slab(roundPoly([[-.135, .03, .012], [.135, .03, .012], [.135, .138, .012], [-.135, .138, .012]], 2), .006, { b: .002, color: P.black, cap: 0x101012 }).move(0, 0, -D / 2 - .002);
    const fr = roundPoly([[-.141, .023, .015], [.141, .023, .015], [.141, .145, .015], [-.141, .145, .015]], 2).map(q => [q[0], q[1], -D / 2 - .0048]);
    k.tube(fr, .0058, { closed: true, rad: 3, color: P.oliveL, wear: 1.1 });
    for (let i = 0; i < 9; i++) {
      const x = -.112 + i * .028, h = i % 3 === 1 ? .003 : 0;
      k.lathe([[.0118, .037, P.brassD], [.0118, .0425, P.brass], [.0112, .094 + h], [.0066, .1065 + h, P.copper], [.0046, .1215 + h], [0, .1325 + h]], { seg: 4, arc: PI, phi: PI / 2, crease: 62 }).move(x, 0, -D / 2 - .0045);
    }
    for (const sx of [-1, 1]) {
      const x = sx * .086;
      k.rbox(.036, .016, .007, .002, { color: P.steelD }).move(x, H - .021, -D / 2 - .0022);
      k.strip([[x, H - .017, -D / 2 - .0048], [x, H + .004, -D / 2 - .0058], [x, H + .0145, -D / 2 - .0012]], .022, .0026, { up: [1, 0, 0], color: P.steelL, wear: 1.3 });
    }
    for (const sx of [-1, 1]) k.rbox(.01, .07, .09, .003, { color: P.oliveD }).move(sx * (W / 2 + .001), H * .54, 0);
    k.part('lid', [0, H, D / 2], () => {
      const lid = k.soft(W + .01, .036, D + .01, .017, { s: 1, mid: 1, color: P.oliveL, wear: .9 });
      lid.move(0, H + .012, 0).paint((x, y, z, c) => (y < H + .001 ? P.oliveD : c));
            k.tube(k.spline([[-.074, H + .034, 0], [-.066, H + .054, 0], [-.03, H + .0605, 0], [.03, H + .0605, 0], [.066, H + .054, 0], [.074, H + .034, 0]], 10), .0072, { rad: 5, color: P.black, wear: .4 });
      for (const sx of [-1, 1]) k.stencil(sx * .112 - .022, -.03, .044, .022, 4, 0, P.sand, 2).rx(-PI / 2).move(0, H + .0352, 0);
    });
  },
  wire(k) {
    const L = 2.4, turns = 10, n = turns * 17, h = .345, pts = [], barb = k.add(new Mesh(20, 0));
    for (let i = 0; i <= n; i++) {
      const q = i / n, t = q * turns * TAU, wob = 1 + .03 * Math.sin(t * .37 + 1.3), x = -L / 2 + .07 + q * (L - .14) + .058 * Math.sin(t + .4), y = h + (h - .018) * wob * Math.sin(t) * .97, z = h * .94 * wob * Math.cos(t);
      pts.push([x, Math.max(.012, y), z]);
    }
    k.tube(pts, .0048, { rad: 3, color: P.steel, crease: 80, wear: 0 }).paint((x, y, z, c) => (Math.sin(x * 9 + y * 5) > .55 ? P.steelD : c));
    for (let i = 3; i < n; i += 5) {
      const P0 = pts[i], Pt = pts[i + 1], d = v3.norm(v3.sub(Pt, P0)), u = v3.norm(v3.cross(d, [P0[0] * .3 + .3, 1, .4])), w = v3.cross(d, u), L1 = .024, W1 = .0042;
      for (const [a, b] of [[u, w], [w, u]]) {
        const p = (s, e) => [P0[0] + a[0] * s * L1 + b[0] * e * W1, P0[1] + a[1] * s * L1 + b[1] * e * W1, P0[2] + a[2] * s * L1 + b[2] * e * W1];
        barb.tri(p(-1, 0), p(0, -1), p(1, 0), P.steelL); barb.tri(p(-1, 0), p(1, 0), p(0, 1), P.steelL);
        barb.tri(p(1, 0), p(0, -1), p(-1, 0), P.steelD); barb.tri(p(1, 0), p(-1, 0), p(0, 1), P.steelD);
      }
    }
    for (const sx of [-1, 1]) {
      const x = sx * (L / 2 - .025);
      k.lathe([[0, -.14, P.steelD], [.012, -.09], [.0135, -.03, P.gun], [.0135, .52], [.0115, .68], [.0105, .735], [.0145, .742, P.steelD], [.0145, .756], [0, .762]], { seg: 6, crease: 50 }).move(x, 0, 0);
      k.tube([[x, .735, 0], [x - sx * .036, .75, .012], [x - sx * .07, .708, .018]], .0052, { rad: 4, color: P.gun });
      k.lathe([[.052, .004, 0x4a3f2c], [.022, .022], [0, .026]], { seg: 7, crease: 70, wear: 0 }).move(x, -.004, 0);
    }
    for (const q of [-.72, -.24, .24, .72]) k.torus(.024, .0032, { seg: 8, rad: 3, color: P.steelD }).rz(PI / 2).move(q * L / 2 * 1.2, .694, 0);
  },
};

// ---- public API ----------------------------------------------------------------------------
const _cache = new Map();
let _matWorld = null, _matView = null;

/** One shared material for every item. viewmodel=true returns a second shared one with fog:false. */
export function gearMaterial(THREE, viewmodel = false) {
  if (viewmodel) return _matView || (_matView = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .22, fog: false }));
  return _matWorld || (_matWorld = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .22 }));
}

/** Cached per id. Allocates only on first call for an id. Returns { geo, parts, tris, radius }. */
export function gearModel(THREE, id) {
  const hit = _cache.get(id);
  if (hit) return hit;
  const build = B[id];
  if (!build) throw new Error('gearModel: unknown id ' + id);
  const k = new Kit(THREE);
  build(k);
  const seed = GEAR_MODEL_IDS.indexOf(id) * 131 + 17, geo = bakeList(THREE, k.out, [0, 0, 0], seed), parts = {};
  let tris = geo.attributes.position.count / 3, r2 = 0;
  const reach = (g, px, py, pz) => { const a = g.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const x = a[i] + px, y = a[i + 1] + py, z = a[i + 2] + pz, d = x * x + y * y + z * z; if (d > r2) r2 = d; } };
  reach(geo, 0, 0, 0);
  for (const name of Object.keys(k.parts)) {
    const { list, pivot } = k.parts[name], g = bakeList(THREE, list, pivot, seed + name.length);
    parts[name] = { geo: g, pivot: pivot.slice() };
    tris += g.attributes.position.count / 3;
    reach(g, pivot[0], pivot[1], pivot[2]);
  }
  const model = { geo, parts, tris, radius: Math.sqrt(r2) };
  _cache.set(id, model);
  return model;
}
