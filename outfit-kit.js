// outfit-kit.js — FRONT ZÉRO: reusable toolkit for premium outfits.
// An outfit is one skinned mesh per LOD on the soldier's existing skeleton, drawn with one material per colourway (same shader program for all).
// What lives here: mesher (crease normals, lofts, tubes, plates), body suit, gloves, boots, pouches, hoses, palette material, cloth rig, instance + LOD, first-person arm textures.
// What lives in an outfit module (outfit-eclipse.js ...): the design of its helmet, mask, armour, and its colourways.
// Conventions (bind pose, model space): feet at y=0, front = -Z, the soldier's left = -X. Cosmetic only: nothing here touches hitboxes, speed or stats.
import * as THREE from 'three';

export const BONE = { PEL: 0, SPI: 1, CHE: 2, NEC: 3, HEA: 4, UAL: 5, FAL: 6, HAL: 7, UAR: 8, FAR: 9, HAR: 10, THL: 11, SHL: 12, FOL: 13, THR: 14, SHR: 15, FOR: 16, GUN: 17, N: 18 };
// must match BIND0 in soldier.js
export const BIND = [[0, .96, 0], [0, 1.09, 0], [0, 1.27, 0], [0, 1.49, 0], [0, 1.585, -.005], [-.2, 1.445, 0], [-.2, 1.155, 0], [-.2, .885, 0],
  [.2, 1.445, 0], [.2, 1.155, 0], [.2, .885, 0], [-.1, .935, 0], [-.1, .505, 0], [-.1, .09, 0], [.1, .935, 0], [.1, .505, 0], [.1, .09, 0], [.12, 1.25, -.45]];
export const SLOT = { CLOTH: 0, CLOTH2: 1, PLATE: 2, PLATE2: 3, RUBBER: 4, METAL: 5, ACCENT: 6, GLOW: 7, VISOR: 8, TEAM: 9 };
const NSLOT = 10, DEG = Math.PI / 180, TAU = Math.PI * 2;
export const LOD_QUALITY = [1, .42, .22];
export const LOD_DIST = [6, 14];
export const MAX_LOD0 = 3, MAX_DETAIL = 2;   // however many soldiers stand close, only the nearest ones in view get the full model
export const DETAIL_DIST = 4.5;             // metres: the extra close-range geometry            // metres: LOD0 up to the first, LOD1 up to the second

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
export const lerp = (a, b, t) => a + (b - a) * t;
export { clamp, sstep };

// ---------------------------------------------------------------- transforms
const _mE = new THREE.Euler(), _mQ = new THREE.Quaternion(), _mP = new THREE.Vector3(), _mS = new THREE.Vector3();
/** Placement matrix: translation, XYZ rotation, scale (a negative sx mirrors the piece). */
export function T(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(_mP.set(x, y, z), _mQ.setFromEuler(_mE.set(rx, ry, rz, 'XYZ')), _mS.set(sx, sy, sz));
}

// ---------------------------------------------------------------- skin weights
/** Smooth two-bone weight along an axis value: below c-b => a, above c+b => other. */
export function blend2(a, b, v, c, w) { const k = sstep(c - w, c + w, v); return k <= 0 ? [a, 1] : k >= 1 ? [b, 1] : [a, 1 - k, b, k]; }
export function torsoSkin(x, y) {
  if (y < 1.09) return blend2(BONE.PEL, BONE.SPI, y, 1.03, .05);
  if (y < 1.3) return blend2(BONE.SPI, BONE.CHE, y, 1.2, .07);
  if (y < 1.53) return blend2(BONE.CHE, BONE.NEC, y, 1.51, .03);
  return blend2(BONE.NEC, BONE.HEA, y, 1.585, .03);
}
export const armSkin = s => { const U = s < 0 ? BONE.UAL : BONE.UAR, F = s < 0 ? BONE.FAL : BONE.FAR, H = s < 0 ? BONE.HAL : BONE.HAR;
  return (x, y) => y > 1.0 ? blend2(F, U, y, 1.155, .045) : blend2(H, F, y, .895, .012); };
export const legSkin = s => { const TH = s < 0 ? BONE.THL : BONE.THR, SH = s < 0 ? BONE.SHL : BONE.SHR, FO = s < 0 ? BONE.FOL : BONE.FOR;
  return (x, y) => y > .75 ? blend2(TH, BONE.PEL, y, .95, .025) : y > .25 ? blend2(SH, TH, y, .505, .05) : blend2(FO, SH, y, .15, .035); };

// ---------------------------------------------------------------- mesher
export class Mesher {
  constructor(lod = 0) { this.lod = lod; this.q = LOD_QUALITY[lod]; this.P = []; this.N = []; this.SI = []; this.SW = []; this.A = []; this.I = []; this.n = 0; }
  /** Segment count scaled by LOD. */
  seg(n, min = 3) { return Math.max(min, Math.round(n * this.q)); }
  /** True when a detail of that rank is kept at this LOD (0: LOD0 only, 1: LOD0-1, 2: always). */
  keep(rank) { return this.lod <= rank; }
  get tris() { return this.I.length / 3; }

  /** Polygon soup -> welded, oriented, crease-shaded vertices.
   *  o: slot, skin (bone index or fn(x,y,z) -> [b,w,...]), crease (deg), ao (number or fn), m (Matrix4), out (reference point, fn(cx,cy,cz)->[nx,ny,nz], or false to keep the winding) */
  surf(V, F, o = {}) {
    const noEdge = !!o.noEdge, stitch = o.stitch ? 255 : 0, slot = o.slot ?? SLOT.CLOTH, cc = Math.cos((o.crease ?? 38) * DEG), skin = o.skin ?? 0, aoF = typeof o.ao === 'function' ? o.ao : null, aoV = typeof o.ao === 'number' ? o.ao : 1;
    const mt = o.m ? o.m.elements : null, X = [], Y = [], Z = [], map = new Map(), rm = new Int32Array(V.length);
    for (let i = 0; i < V.length; i++) {
      let [x, y, z] = V[i];
      if (mt) { const a = mt[0] * x + mt[4] * y + mt[8] * z + mt[12], b = mt[1] * x + mt[5] * y + mt[9] * z + mt[13], c = mt[2] * x + mt[6] * y + mt[10] * z + mt[14]; x = a; y = b; z = c; }
      const k = Math.round(x * 8e3) + '_' + Math.round(y * 8e3) + '_' + Math.round(z * 8e3);
      let j = map.get(k); if (j === undefined) { j = X.length; map.set(k, j); X.push(x); Y.push(y); Z.push(z); } rm[i] = j;
    }
    const nv = X.length, tri = [], fn = [];
    let sx = 0, sy = 0, sz = 0; for (let i = 0; i < nv; i++) { sx += X[i]; sy += Y[i]; sz += Z[i]; } sx /= nv || 1; sy /= nv || 1; sz /= nv || 1;
    let flux = 0; const ref = Array.isArray(o.out) ? o.out : null, dirF = typeof o.out === 'function' ? o.out : null;
    for (let t = 0; t < F.length; t += 3) {
      const a = rm[F[t]], b = rm[F[t + 1]], c = rm[F[t + 2]]; if (a === b || b === c || a === c) continue;
      const ux = X[b] - X[a], uy = Y[b] - Y[a], uz = Z[b] - Z[a], vx = X[c] - X[a], vy = Y[c] - Y[a], vz = Z[c] - Z[a];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.sqrt(nx * nx + ny * ny + nz * nz); if (l < 1e-11) continue;
      tri.push(a, b, c); fn.push(nx / l, ny / l, nz / l, l);
      const cx = (X[a] + X[b] + X[c]) / 3, cy = (Y[a] + Y[b] + Y[c]) / 3, cz = (Z[a] + Z[b] + Z[c]) / 3;
      if (dirF) { const d = dirF(cx, cy, cz); flux += nx * d[0] + ny * d[1] + nz * d[2]; }
      else { const r = ref || [sx, sy, sz]; flux += nx * (cx - r[0]) + ny * (cy - r[1]) + nz * (cz - r[2]); }
    }
    if (o._fix) for (let t = 0; t < tri.length; t += 3) { const f = t / 3 * 4, a = tri[t], b = tri[t + 1], c = tri[t + 2], cx = (X[a] + X[b] + X[c]) / 3 - sx, cy = (Y[a] + Y[b] + Y[c]) / 3 - sy, cz = (Z[a] + Z[b] + Z[c]) / 3 - sz; if (fn[f] * cx + fn[f + 1] * cy + fn[f + 2] * cz < 0) { tri[t + 1] = c; tri[t + 2] = b; fn[f] *= -1; fn[f + 1] *= -1; fn[f + 2] *= -1; } }
    if (o.out !== false && flux < 0) for (let t = 0; t < tri.length; t += 3) { const q = tri[t + 1]; tri[t + 1] = tri[t + 2]; tri[t + 2] = q; fn[t / 3 * 4] *= -1; fn[t / 3 * 4 + 1] *= -1; fn[t / 3 * 4 + 2] *= -1; }
    const nt = tri.length / 3, head = new Int32Array(nv).fill(-1), next = new Int32Array(nt * 3);
    for (let c = 0; c < nt * 3; c++) { const v = tri[c]; next[c] = head[v]; head[v] = c; }
    const firstCopy = new Int32Array(nv).fill(-1), copyNext = [], base = this.n;
    const emit = (v, nx, ny, nz) => {
      for (let e = firstCopy[v]; e >= 0; e = copyNext[e - base]) { const q = e * 3; if (Math.abs(this.N[q] - nx) + Math.abs(this.N[q + 1] - ny) + Math.abs(this.N[q + 2] - nz) < .0012) return e; }
      const id = this.n++; copyNext[id - base] = firstCopy[v]; firstCopy[v] = id;
      const x = X[v], y = Y[v], z = Z[v]; this.P.push(x, y, z); this.N.push(nx, ny, nz);
      const w = typeof skin === 'function' ? skin(x, y, z) : [skin, 1];
      this.SI.push(w[0] | 0, (w[2] ?? 0) | 0, (w[4] ?? 0) | 0, (w[6] ?? 0) | 0); this.SW.push(w[1], w[3] ?? 0, w[5] ?? 0, w[7] ?? 0);
      this.A.push(slot, Math.round(clamp(aoF ? aoF(x, y, z) : aoV, 0, 1) * 255), noEdge ? 0 : Math.round(sstep(.985, .72, minD[v]) * 255), stitch);
      return id;
    };
    const minD = new Float32Array(nv).fill(1), cn = new Float32Array(nt * 9);
    for (let c = 0; c < nt * 3; c++) {
      const v = tri[c], f = (c / 3 | 0) * 4, fx = fn[f], fy = fn[f + 1], fz = fn[f + 2]; let nx = 0, ny = 0, nz = 0;
      for (let e = head[v]; e >= 0; e = next[e]) { const g = (e / 3 | 0) * 4, d = fn[g] * fx + fn[g + 1] * fy + fn[g + 2] * fz; if (d < minD[v]) minD[v] = d; if (d >= cc) { const a = Math.min(fn[g + 3], .02); nx += fn[g] * a; ny += fn[g + 1] * a; nz += fn[g + 2] * a; } }
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; cn[c * 3] = nx / l; cn[c * 3 + 1] = ny / l; cn[c * 3 + 2] = nz / l;
    }
    for (let c = 0; c < nt * 3; c++) this.I.push(emit(tri[c], Math.round(cn[c * 3] * 2000) / 2000, Math.round(cn[c * 3 + 1] * 2000) / 2000, Math.round(cn[c * 3 + 2] * 2000) / 2000));
    return this;
  }

  /** Parametric sheet. fn(u,v) -> [x,y,z]. wrapU closes the loop in u; capA / capB close the ends with a fan. */
  grid(nu, nv, fn, o = {}) {
    const V = [], F = [], wu = !!o.wrapU, cols = wu ? nu : nu + 1, id = (i, j) => (wu ? i % nu : i) + j * cols;
    for (let j = 0; j <= nv; j++) for (let i = 0; i < cols; i++) V.push(fn(i / nu, j / nv));
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1); F.push(a, b, c, b, d, c); }
    const cap = (j) => { let x = 0, y = 0, z = 0; for (let i = 0; i < cols; i++) { const p = V[id(i, j)]; x += p[0]; y += p[1]; z += p[2]; } const c = V.length; V.push([x / cols, y / cols, z / cols]); for (let i = 0; i < nu; i++) F.push(c, id(i, j), id(i + 1, j)); };
    if (o.capA) cap(0); if (o.capB) cap(nv);
    return this.surf(V, F, o);
  }

  /** Closed loft through rings of equal length (array of [x,y,z]). */
  loft(rings, o = {}) {
    const n = rings[0].length, m = rings.length - 1;
    return this.grid(n, m, (u, v) => rings[Math.round(v * m)][Math.round(u * n) % n], { wrapU: true, ...o });
  }

  /** Ellipsoid. */
  ell(c, r, o = {}) {
    const nu = this.seg(o.nu ?? 14, 5), nv = this.seg(o.nv ?? 9, 3), a0 = o.v0 ?? 0, a1 = o.v1 ?? 1;
    return this.grid(nu, nv, (u, v) => { const th = u * TAU, ph = (a0 + (a1 - a0) * v) * Math.PI, s = Math.sin(ph); return [c[0] + r[0] * s * Math.cos(th), c[1] + r[1] * Math.cos(ph), c[2] + r[2] * s * Math.sin(th)]; }, { wrapU: true, crease: 180, capB: a1 < 1, ...o });
  }

  /** Rounded box (c: centre, s: full size, r: corner radius). */
  box(c, s, r = .006, o = {}) {
    if (Math.max(s[0], s[1], s[2]) < .034 || Math.min(s[0], s[1], s[2]) < .012 || this.lod >= 1) { const h = [s[0] / 2, s[1] / 2, s[2] / 2], V = []; for (let i = 0; i < 8; i++) V.push([c[0] + (i & 1 ? h[0] : -h[0]), c[1] + (i & 2 ? h[1] : -h[1]), c[2] + (i & 4 ? h[2] : -h[2])]); return this.surf(V, [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5], { crease: 20, ...o, out: false, _fix: 1 }); }
    const n = 1, hx = s[0] / 2, hy = s[1] / 2, hz = s[2] / 2, rr = Math.min(r, hx * .98, hy * .98, hz * .98), ix = hx - rr, iy = hy - rr, iz = hz - rr, V = [], F = [];
    const dirs = [[0, 1, 2, 1], [0, 1, 2, -1], [1, 2, 0, 1], [1, 2, 0, -1], [2, 0, 1, 1], [2, 0, 1, -1]], N = n + 1 + 2;   // inner flat + one row of round at each edge
    const ts = []; ts.push(-1); for (let i = 0; i <= n; i++) ts.push(-1 + (2 * i) / n); ts.push(1); ts[0] = -1.35; ts[ts.length - 1] = 1.35;
    for (const [a, b, w, sg] of dirs) {
      const b0 = V.length, cnt = ts.length;
      for (let j = 0; j < cnt; j++) for (let i = 0; i < cnt; i++) {
        const q = [0, 0, 0]; q[a] = clamp(ts[i], -1, 1); q[b] = clamp(ts[j], -1, 1); q[w] = sg;
        const h = [hx, hy, hz], inn = [ix, iy, iz], p = [q[0] * inn[0], q[1] * inn[1], q[2] * inn[2]];
        const d = [0, 0, 0]; d[a] = ts[i] < -1 ? -1 : ts[i] > 1 ? 1 : 0; d[b] = ts[j] < -1 ? -1 : ts[j] > 1 ? 1 : 0; d[w] = sg; const l = Math.hypot(d[0], d[1], d[2]);
        V.push([c[0] + p[0] + d[0] / l * rr, c[1] + p[1] + d[1] / l * rr, c[2] + p[2] + d[2] / l * rr]); void h;
      }
      for (let j = 0; j < cnt - 1; j++) for (let i = 0; i < cnt - 1; i++) { const p = b0 + i + j * cnt, q = p + 1, u = p + cnt, v = u + 1; F.push(p, q, u, q, v, u); }
      void N;
    }
    return this.surf(V, F, { crease: 42, ...o });
  }

  /** Surface of revolution around +Y (then placed with o.m). profile: [radius, y]. */
  revolve(profile, o = {}) {
    const n = this.seg(o.sides ?? 16, 5), m = profile.length - 1;
    return this.grid(n, m, (u, v) => { const p = profile[Math.round(v * m)], a = u * TAU + (o.phase ?? 0); return [p[0] * Math.cos(a), p[1], p[0] * Math.sin(a)]; }, { wrapU: true, ...o });
  }

  /** Tube along a Catmull-Rom path. r: radius or fn(t). o: sides, n (rings), ribs (count of corrugations), ribDepth, flat (section squash along the side vector), side (hint for the frame). */
  tube(path, r, o = {}) {
    const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', o.tension ?? .5);
    const len = curve.getLength(), ribs = this.lod === 0 ? (o.ribs ?? 0) : 0, sides = this.seg(o.sides ?? 8, 3), rings = ribs ? ribs * 2 : this.seg(o.n ?? Math.ceil(len / .035) + 2, 2);
    const P = curve.getSpacedPoints(rings), tan = [], nor = [], bin = [], t0 = new THREE.Vector3(), n0 = new THREE.Vector3(o.up?.[0] ?? 0, o.up?.[1] ?? 0, o.up?.[2] ?? 1), b0 = new THREE.Vector3();
    for (let i = 0; i <= rings; i++) {
      t0.subVectors(P[Math.min(i + 1, rings)], P[Math.max(i - 1, 0)]).normalize(); n0.addScaledVector(t0, -n0.dot(t0));
      if (n0.lengthSq() < 1e-6) n0.set(t0.y, t0.z, t0.x); n0.normalize(); b0.crossVectors(t0, n0); tan.push(t0.clone()); nor.push(n0.clone()); bin.push(b0.clone());
    }
    const flat = o.flat ?? 1, rf = typeof r === 'function' ? r : () => r, depth = o.ribDepth ?? .16;
    const V = [], F = [];
    for (let i = 0; i <= rings; i++) {
      const t = i / rings, rib = ribs ? 1 + depth * (i % 2 ? .75 : -.55) : 1, R = rf(t) * rib;
      for (let k = 0; k < sides; k++) { const a = k / sides * TAU, ca = Math.cos(a) * R, sa = Math.sin(a) * R * flat; V.push([P[i].x + nor[i].x * ca + bin[i].x * sa, P[i].y + nor[i].y * ca + bin[i].y * sa, P[i].z + nor[i].z * ca + bin[i].z * sa]); }
    }
    for (let i = 0; i < rings; i++) for (let k = 0; k < sides; k++) { const a = i * sides + k, b = i * sides + (k + 1) % sides, c = a + sides, d = b + sides; F.push(a, b, c, b, d, c); }
    if (o.cap !== false) for (const i of [0, rings]) { const c = V.length; V.push([P[i].x, P[i].y, P[i].z]); for (let k = 0; k < sides; k++) F.push(c, i * sides + k, i * sides + (k + 1) % sides); }
    return this.surf(V, F, { crease: ribs ? 75 : 60, out: (cx, cy, cz) => { let b = 0, bd = 1e9; for (let i = 0; i <= rings; i += Math.max(1, rings >> 3)) { const d = (P[i].x - cx) ** 2 + (P[i].y - cy) ** 2 + (P[i].z - cz) ** 2; if (d < bd) { bd = d; b = i; } } return [cx - P[b].x, cy - P[b].y, cz - P[b].z]; }, ...o });
  }

  /** Sculpted plate: star-shaped 2D outline [u,v], thick by t, bevelled, wrapped by map(u,v,h) -> [x,y,z] (h = height over the surface). */
  plate(outline, map, o = {}) {
    const t = o.t ?? .012, bev = o.bevel ?? t * .55, pts = o.round === 0 || this.lod >= 1 ? outline : chaikin(outline, o.round ?? 1); let cu = 0, cv = 0; for (const p of pts) { cu += p[0]; cv += p[1]; } cu /= pts.length; cv /= pts.length;
    let rad = 0; for (const p of pts) rad += Math.hypot(p[0] - cu, p[1] - cv); rad /= pts.length; const k = 1 - bev / Math.max(rad, 1e-4), dome = o.dome ?? 0;
    const inner = this.lod === 0 ? Math.min(o.inner ?? 1, 2) : 1, rows = this.lod >= 1 ? [[1, -(o.skirt ?? .002)], [k, t]] : [[1, -(o.skirt ?? .002)], [1, t - bev], [k, t]]; for (let i = 1; i <= inner; i++) rows.push([k * (1 - i / (inner + 1)), t + dome * Math.sin((i / (inner + 1)) * Math.PI / 2)]);
    const n = pts.length, V = [], F = [];
    for (const [s, h] of rows) for (const p of pts) V.push(map(cu + (p[0] - cu) * s, cv + (p[1] - cv) * s, h));
    for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < n; i++) { const a = r * n + i, b = r * n + (i + 1) % n, c = a + n, d = b + n; F.push(a, b, c, b, d, c); }
    const c = V.length; V.push(map(cu, cv, t + dome)); for (let i = 0; i < n; i++) F.push(c, (rows.length - 1) * n + i, (rows.length - 1) * n + (i + 1) % n);
    const a0 = map(cu, cv, 0), a1 = map(cu, cv, 1), dir = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]];
    return this.surf(V, F, { crease: o.crease ?? 52, out: () => dir, ...o });
  }

  /** Raised crescent: the disc of radius r minus a disc of radius r2 shifted by d along the axis `ang`. map(u,v,h) places it on a surface. */
  crescentDecal(map, r, r2, d, ang, o = {}) {
    const n = this.seg(o.n ?? 16, 6), t = o.t ?? .002, ca = Math.cos(ang), sa = Math.sin(ang), a0 = Math.acos(clamp((d * d + r * r - r2 * r2) / (2 * d * r), -1, 1)), V = [], F = [];
    const rot = (x, y) => [x * ca - y * sa, x * sa + y * ca], b0 = Math.atan2(r * Math.sin(a0), r * Math.cos(a0) - d);
    for (let i = 0; i <= n; i++) {
      const k = i / n, a = a0 + (TAU - 2 * a0) * k, oP = rot(r * Math.cos(a), r * Math.sin(a)), b = b0 + (TAU - 2 * b0) * k, iP = rot(d + r2 * Math.cos(b), r2 * Math.sin(b));
      V.push(map(oP[0], oP[1], -.001), map(oP[0], oP[1], t), map(iP[0], iP[1], t), map(iP[0], iP[1], -.001));
    }
    for (let i = 0; i < n; i++) for (let q = 0; q < 3; q++) { const a = i * 4 + q, b = a + 1, c = a + 4, e = b + 4; F.push(a, b, c, b, e, c); }
    const a0p = map(0, 0, 0), a1p = map(0, 0, 1), dir = [a1p[0] - a0p[0], a1p[1] - a0p[1], a1p[2] - a0p[2]];
    return this.surf(V, F, { crease: 40, out: () => dir, ...o });
  }

  toGeometry() {
    const n = this.n, g = new THREE.BufferGeometry(), sw = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {   // normalized bytes whose sum is exactly 255
      const q = i * 4, W = this.SW; let a = Math.round(W[q] * 255), b = Math.round(W[q + 1] * 255), c = Math.round(W[q + 2] * 255), d = Math.round(W[q + 3] * 255);
      const e = 255 - (a + b + c + d); if (a >= b && a >= c && a >= d) a += e; else if (b >= c && b >= d) b += e; else if (c >= d) c += e; else d += e; sw[q] = a; sw[q + 1] = b; sw[q + 2] = c; sw[q + 3] = d;
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.P), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.N), 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(this.SI), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
    g.setAttribute('aFit', new THREE.BufferAttribute(new Uint8Array(this.A), 4));
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(this.I) : new Uint16Array(this.I), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .95, 0), 1.55);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-1.2, -.3, -1.2), new THREE.Vector3(1.2, 2.3, 1.2));
    this.P = this.N = this.SI = this.SW = this.A = this.I = null;
    return g;
  }
}

/** Curved panel laid on a surface map(u, v, h): u from u0 to u1, v from lo(u) to hi(u) (numbers or functions of u), thickness t, a bevel of width `edge`
 *  (share of the panel) at LOD0, a skirt under its border. Grid tessellation: wide wrapped plates stay smooth instead of fanning into slivers.
 *  o: t, edge, dome (extra height at the middle), nu, nv, round (0..1: how much the corners are rounded off), slot, skin, out, ao, crease. */
export function panel(m, map, u0, u1, lo, hi, o = {}) {
  const t = o.t ?? .01, nu = m.seg(o.nu ?? 14, 3), nv = m.seg(o.nv ?? 5, 2), e = m.lod === 0 ? (o.edge ?? .1) : 0, dome = o.dome ?? 0, rc = o.round ?? .35;
  const L = typeof lo === 'function' ? lo : () => lo, Hf = typeof hi === 'function' ? hi : () => hi;
  const ax = n => { const a = [0, 0]; for (let i = 0; i <= n; i++) a.push(e + (1 - 2 * e) * i / n); a.push(1, 1); return a; }, A = ax(nu), Bv = ax(nv), NA = A.length, NB = Bv.length;
  const ring = (i, n) => i === 0 || i === n - 1 ? 0 : i === 1 || i === n - 2 ? 1 : 2, V = [], F = [], p = rc > 0 ? lerp(14, 3.2, rc) : 0;
  for (let j = 0; j < NB; j++) for (let i = 0; i < NA; i++) {
    const k = Math.min(ring(i, NA), ring(j, NB));          // 0: skirt, 1: top of the bevel, 2: face
    let x = A[i] * 2 - 1, y = Bv[j] * 2 - 1;
    if (p) { const r = Math.max(Math.abs(x), Math.abs(y)); if (r > 1e-6) { const s = 1 / Math.pow(Math.abs(x / r) ** p + Math.abs(y / r) ** p, 1 / p); x *= s; y *= s; } }      // square -> rounded square
    const aa = (x + 1) / 2, bb = (y + 1) / 2, u = lerp(u0, u1, aa), v = lerp(L(u), Hf(u), bb);
    V.push(map(u, v, k === 0 ? -(o.skirt ?? .002) : k === 1 ? t * (e > 0 ? .62 : 1) : t + dome * Math.sin(Math.PI * aa) * Math.sin(Math.PI * bb)));
  }
  for (let j = 0; j < NB - 1; j++) for (let i = 0; i < NA - 1; i++) { const p = i + j * NA, q = p + 1, r = p + NA, s = r + 1; F.push(p, q, r, q, s, r); }
  let out = o.out; if (!out) { const uc = (u0 + u1) / 2, vc = (L(uc) + Hf(uc)) / 2, p0 = map(uc, vc, 0), p1 = map(uc, vc, 1), d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]; out = () => d; }
  return m.surf(V, F, { crease: o.crease ?? 48, ...o, out });
}
/** Corner cutting: turns a polygon into a machined outline with soft corners. */
export function chaikin(pts, it = 1, k = .22) {
  let a = pts;
  for (let c = 0; c < it; c++) { const o = []; for (let i = 0; i < a.length; i++) { const p = a[i], q = a[(i + 1) % a.length]; o.push([lerp(p[0], q[0], k), lerp(p[1], q[1], k)], [lerp(p[0], q[0], 1 - k), lerp(p[1], q[1], 1 - k)]); } a = o; }
  return a;
}
/** Wrap map around a vertical elliptical body section: u = arc length from the front (m, + toward the soldier's right), v = height. side: -1 front, +1 back. */
export function wrapMap(rx, rz, cz = 0, side = -1, lean = 0, yRef = 0) {
  return (u, v, h) => { const a = u / ((rx + rz) * .5), R = rx + h, Q = rz + h; return [R * Math.sin(a), v, cz + side * (Q * Math.cos(a) + lean * (v - yRef))]; };
}
/** Sphere map for helmet panels: u longitude (rad, 0 = front, + toward the soldier's right), v latitude (rad, 0 = equator). */
export function domeMap(c, r) {
  return (u, v, h) => { const cv = Math.cos(v), R = 1 + h / r[1]; return [c[0] + r[0] * R * Math.sin(u) * cv, c[1] + r[1] * R * Math.sin(v), c[2] - r[2] * R * Math.cos(u) * cv]; };
}
/** Flat map on a plane given by an origin and two axes (normal = U x V, flip with nf=-1). */
export function planeMap(o, U, W, nf = 1) {
  const n = [(U[1] * W[2] - U[2] * W[1]) * nf, (U[2] * W[0] - U[0] * W[2]) * nf, (U[0] * W[1] - U[1] * W[0]) * nf], l = Math.hypot(n[0], n[1], n[2]) || 1;
  return (u, v, h) => [o[0] + U[0] * u + W[0] * v + n[0] / l * h, o[1] + U[1] * u + W[1] * v + n[1] / l * h, o[2] + U[2] * u + W[2] * v + n[2] / l * h];
}
/** Regular polygon outline (for bolts, filter faces, hexagons). */
export const ngon = (n, r, phase = 0) => Array.from({ length: n }, (_, i) => [Math.cos(i / n * TAU + phase) * r, Math.sin(i / n * TAU + phase) * r]);
/** Crescent outline: disc of radius r bitten by a disc of radius r2 shifted by d along +u. Star-shaped around its middle for d >= r*.35. */
export function crescent(r, r2, d, n = 14) {
  const o = [], a0 = Math.acos(clamp((d * d + r * r - r2 * r2) / (2 * d * r), -1, 1));
  for (let i = 0; i <= n; i++) { const a = a0 + (TAU - 2 * a0) * (i / n); o.push([r * Math.cos(a), r * Math.sin(a)]); }
  const b0 = Math.atan2(r * Math.sin(a0), r * Math.cos(a0) - d);
  for (let i = 1; i < n; i++) { const a = -b0 + (2 * b0) * (i / n); o.push([d + r2 * Math.cos(a), r2 * Math.sin(a)]); }
  return o;
}

// ---------------------------------------------------------------- reusable body pieces
const superRing = (n, cx, y, cz, rx, rz, e = 2.4, disp = null) => {
  const o = [], p = 2 / e;
  for (let i = 0; i < n; i++) { const a = i / n * TAU, s = Math.sin(a), c = Math.cos(a), d = disp ? 1 + disp(a, y) : 1; o.push([cx + rx * d * Math.sign(s) * Math.abs(s) ** p, y, cz - rz * d * Math.sign(c) * Math.abs(c) ** p]); }
  return o;
};
/** Base layer: torso, arms and legs in soft cloth with shallow fabric folds. o.folds scales the wrinkles; o.slotLegs / o.slotArms choose palette slots. */
/** Trouser leg joined to the other leg: maps a point p of the ring of leg s (centre x c, radius r) so that, with weight g, its inner half meets the
 *  midline (gap: half the centre seam). One garment through the crotch instead of two tubes stuck under the torso. */
export function legJoin(p, s, c, r, g, gap = .0016) {
  const dx = p[0] - c; if (g <= 0 || s * dx >= 0) return p;
  const t = Math.min(1, -s * dx / r), xi = c - s * (Math.abs(c) - gap) * t ** .3;
  return [lerp(p[0], xi, g), p[1], p[2]];
}
export function buildSuit(m, o = {}) {
  const folds = (o.folds ?? 1) * (m.lod === 0 ? 1 : m.lod === 1 ? .5 : 0), slot = o.slot ?? SLOT.CLOTH;
  const nT = m.seg(22, 9);
  const dT = (a, y) => folds * (.012 * Math.sin(a * 3 + y * 11) + .008 * Math.sin(a * 7 - y * 17) * sstep(1.0, 1.15, y));
  const torso = [[.84, .066, .056, 0], [.875, .098, .076, .004], [.92, .126, .09, .005], [.97, .146, .103, .005], [1.03, .158, .117, 0], [1.09, .15, .111, 0], [1.16, .156, .113, 0], [1.24, .17, .12, 0], [1.32, .182, .125, 0], [1.39, .184, .124, .002], [1.435, .166, .112, .006], [1.47, .125, .092, .006], [1.5, .078, .07, .002], [1.56, .056, .056, -.004]];
  const rows = m.lod === 2 ? torso.filter((_, i) => i % 2 === 0 || i === torso.length - 1) : torso;
  m.loft(rows.map(r => superRing(nT, 0, r[0], r[3], r[1], r[2], 2.5, dT)), { slot, skin: torsoSkin, crease: 180, capA: true, capB: true, out: (x, y, z) => [x, y > 1.53 ? .4 : y < .86 ? -.4 : 0, z], ao: (x, y) => .72 + .28 * sstep(.86, 1.0, y) });
  // legs: one garment with the torso. Toward the top each leg widens and deepens into the hip (their union meets the torso ring at 1.03), their inner
  // sides meet along the centre seam (a gusset: no edge round the crotch); folds at the hip, crotch and knee; an inside-leg seam up close.
  const nL = m.seg(16, 8), legR = [[1.035, .0775], [.985, .082], [.93, .096], [.85, .1], [.79, .098], [.75, .094], [.65, .083], [.57, .074], [.52, .071], [.47, .07], [.4, .07], [.345, .067], [.31, .065], [.28, .063], [.24, .06], [.18, .056], [.13, .052]], bl = o.blouse === false ? 0 : 1;
  const legRows = m.lod === 2 ? legR.filter((_, i) => i % 2 === 0) : legR;
  for (const s of [-1, 1]) {
    const dL = (a, y) => folds * (.034 * Math.sin(a * 2 + y * 11 + s) * sstep(.14, .32, y) * (1 - sstep(.72, .95, y)) + .022 * Math.sin(a * 3 - y * 13) * Math.exp(-(((y - .52) / .13) ** 2)) + .026 * Math.sin(a * 3 + y * 14) * (1 - sstep(.17, .3, y)));
    const dC = (a, y) => folds * (.014 * Math.sin(a * 4 + y * 30 + s) * Math.exp(-(((y - .87) / .045) ** 2)) * Math.max(0, -s * Math.sin(a)) + .009 * Math.sin(a * 3 - y * 26 + s) * Math.exp(-(((y - .98) / .04) ** 2)));
    const dB = (a, y) => dL(a, y) + dC(a, y) + bl * (.14 * Math.exp(-(((y - .305) / .03) ** 2)) + (m.lod === 2 ? 0 : .03 * Math.sin(a * 5 + s * 2) * Math.exp(-(((y - .305) / .032) ** 2))));
    const ring = (r, n = nL) => { const y = r[0], k = sstep(.9, 1.03, y), c = s * lerp(.1, .079, k); return superRing(n, c, y, y > .6 ? .004 : 0, r[1], r[1] * 1.04 * (1 + .42 * k), 2.1, dB).map(p => legJoin(p, s, c, r[1], sstep(.78, .85, y))); };
    m.loft(legRows.map(r => ring(r)), { slot: o.slotLegs ?? slot, skin: legSkin(s), crease: 180, capA: true, capB: true, out: (x, y, z) => [x - s * .1, y > .95 ? .3 : y < .14 ? -.3 : 0, z], ao: (x, y) => .68 + .32 * sstep(.68, .9, y) * (1 - .3 * sstep(.2, .1, y)) + .12 * sstep(.2, .55, y) });
    if (m.keep(0)) { const ix = s < 0 ? 1 : 3, pts = legR.filter(r => r[0] <= .86 && r[0] >= .3).map(r => { const p = ring(r, 4)[ix]; return [p[0] - s * .0003, p[1], p[2]]; }); m.tube(pts, .0011, { slot: o.slotLegs ?? slot, skin: legSkin(s), sides: 4, n: pts.length * 3, cap: false, crease: 70 }); }
  }
  // arms: sleeve with a shoulder cap, an elbow gather and a tighter wrist
  const nA = m.seg(12, 6), armR = [[1.505, .026], [1.49, .056], [1.46, .074], [1.41, .075], [1.34, .068], [1.26, .061], [1.2, .057], [1.16, .056], [1.12, .056], [1.05, .054], [.98, .049], [.92, .045], [.875, .043]];
  const armRows = m.lod === 2 ? armR.filter((_, i) => i % 2 === 0) : armR;
  for (const s of [-1, 1]) {
    const dA = (a, y) => folds * (.04 * Math.sin(a * 2 + y * 14 + s * 2) * Math.exp(-(((y - 1.16) / .12) ** 2)) + .018 * Math.sin(a * 2 - y * 10) * sstep(1.45, 1.3, y));
    m.loft(armRows.map(r => superRing(nA, s * .2, r[0], 0, r[1], r[1] * 1.03, 2.05, dA)), { slot: o.slotArms ?? slot, skin: armSkin(s), crease: 180, capA: true, capB: true, out: (x, y, z) => [x - s * .2, y > 1.48 ? .4 : y < .88 ? -.4 : 0, z], ao: (x, y) => .78 + .22 * sstep(1.0, 1.25, y) });
  }
}

/** Moulded knuckle guard: one shell across the four knuckles, a ridge over each. Shared by the third-person glove and the first-person kit.
 *  place(u, v, h) -> [x,y,z]: u across the hand (-1..1), v along it (0..1), h = height over the glove. */
export function knuckleGuard(m, place, ks, o = {}) {
  const nu = m.seg(o.nu ?? 22, 8), nv = m.lod === 0 ? 4 : 2, t = o.t ?? .0026, bump = o.bump ?? .0026;
  const ridge = u => { let r = 0; for (const k of ks) r = Math.max(r, Math.cos(Math.min(Math.abs(u - k) / (o.w ?? .24), 1) * Math.PI / 2) ** 2); return r; };
  m.grid(nu, nv, (a, b) => { const u = a * 2 - 1, edge = Math.min(1, (1 - Math.abs(u)) * 7) ** .5 * Math.sin(b * Math.PI) ** .6; return place(u, b, (t + bump * ridge(u) * Math.sin(b * Math.PI)) * edge + .0004); }, { slot: o.slot ?? SLOT.PLATE, skin: o.skin ?? 0, crease: 70, out: o.out, noEdge: !!o.noEdge });
}
/** Armoured tactical glove: palm block, three-segment fingers with guards on the first segment, moulded knuckle guard, back plate, cuff. */
export function buildGlove(m, s, o = {}) {
  const H = s < 0 ? BONE.HAL : BONE.HAR, F = s < 0 ? BONE.FAL : BONE.FAR, x = s * .2, slot = o.slot ?? SLOT.RUBBER, sk = o.slotKnuckle ?? SLOT.PLATE;
  const nP = m.seg(10, 5), palm = [[.895, .026, .036], [.875, .027, .044], [.845, .026, .047], [.815, .024, .045], [.795, .021, .042]];
  m.loft(palm.map(r => superRing(nP, x, r[0], -.004, r[1], r[2], 3)), { slot, skin: H, crease: 180, capA: true, capB: true, out: [x, .845, -.004] });
  const fN = m.keep(1) ? 4 : 1, zs = fN === 4 ? [-.033, -.012, .01, .03] : [0], lens = [.044, .05, .047, .036];
  for (let i = 0; i < fN; i++) {
    const z = zs[i] - .004, L = fN === 4 ? lens[i] : .05, r = fN === 4 ? .0098 - (i === 3 ? .0012 : 0) : .03, cu = -s;
    const path = [[x + s * .004, .8, z], [x + s * .003, .8 - L * .55, z - .002], [x + cu * .012, .8 - L * 1.05, z - .004], [x + cu * .03, .8 - L * 1.35, z - .005], [x + cu * .046, .8 - L * 1.42, z - .006]];
    m.tube(path, t => r * (1 - .14 * t + .07 * Math.sin(t * 9.4) ** 2), { slot, skin: H, sides: m.keep(0) ? 5 : 3, n: m.keep(0) ? 6 : 2, crease: 80 });
    if (m.keep(0) && fN === 4 && o.guard !== false) m.tube(path.slice(0, 3).map((p, k) => k === 0 ? [p[0], p[1] - L * .1, p[2]] : p), t => r * 1.07 * (1 - .1 * t), { slot: sk, skin: H, sides: 5, n: 3, crease: 60, cap: true, tension: .3, noEdge: true });     // guard on the first segment
  }
  m.tube([[x - s * .012, .862, -.035], [x - s * .022, .835, -.056], [x - s * .03, .805, -.066], [x - s * .036, .782, -.066]], t => .0118 * (1 - .18 * t), { slot, skin: H, sides: m.keep(1) ? 6 : 3, n: m.keep(0) ? 5 : 2 });
  if (m.keep(1) && o.guard !== false) {        // guard: false = a plain glove (no knuckle guard, no back plate)
    const back = (u, v, h) => [x + s * (.0262 + h - .011 * u * u), .818 - v * .019 - .004 * u * u, u * .043 - .006];
    knuckleGuard(m, (u, v, h) => back(u, v, h), [-.73, -.27, .24, .7], { slot: sk, skin: H, out: () => [s, 0, 0], nu: m.keep(0) ? 18 : 8, bump: .0036, t: .0022, noEdge: true });
    const bm = planeMap([x + s * .0272, .848, -.004], [0, 0, 1], [0, 1, 0], s < 0 ? 1 : -1);
    m.plate([[-.024, -.013], [.024, -.013], [.027, .01], [.012, .022], [-.012, .022], [-.027, .01]], (u, v, h) => bm(u, v, h + .006 * (1 - (u / .03) ** 2)), { t: .0022, bevel: .0011, slot: o.slotBack ?? SLOT.PLATE2, skin: H, dome: .0008, crease: 55 });
  }
  m.revolve([[.04, .912], [.0488, .912], [.0512, .9], [.0512, .875], [.047, .862], [.038, .862]].map(p => [p[0], p[1] - .885]), { sides: m.keep(0) ? 12 : 6, slot: o.slotCuff ?? SLOT.CLOTH2, skin: F, m: T(x, .885, 0, 0, 0, 0, 1, 1, 1.04), crease: 50 });
  if (o.cuff !== false && m.keep(1)) m.revolve([[.0522, .012], [.0522, -.002]], { sides: 12, slot: o.slotBand ?? SLOT.ACCENT, skin: F, m: T(x, .885, 0, 0, 0, 0, 1, 1, 1.04), crease: 60 });
}

// z, outer half-width, inner half-width, height of the upper, height of its base: a real last, heel to toe
const FOOT = [[.09, .018, .018, .062, .024], [.084, .032, .031, .108, .022], [.06, .043, .041, .138, .021], [.025, .047, .044, .15, .021], [-.015, .048, .043, .138, .023], [-.055, .05, .042, .11, .025], [-.095, .053, .045, .086, .023], [-.13, .053, .047, .07, .022], [-.158, .048, .044, .06, .023], [-.178, .04, .037, .05, .025], [-.192, .026, .024, .038, .028], [-.199, .01, .01, .027, .031]];
const footRow = z => { for (let i = 0; i < FOOT.length - 1; i++) { const a = FOOT[i], b = FOOT[i + 1]; if (z <= a[0] && z >= b[0]) { const t = (a[0] - z) / (a[0] - b[0]); return a.map((v, k) => lerp(v, b[k], t)); } } return z > 0 ? FOOT[0] : FOOT[FOOT.length - 1]; };
const footAt = (r, a, s, off = 0) => { const sn = Math.sin(a), cs = Math.cos(a), hw = (sn * s > 0 ? r[1] : r[2]) + off, up = cs > 0 ? (r[3] + off) * cs ** .82 : -.008 * (-cs); return [s * .1 + hw * Math.sign(sn) * Math.abs(sn) ** .72, r[4] + up, r[0]]; };
const soleY = z => .006 * sstep(.03, .005, z) * sstep(-.085, -.05, z) + .014 * sstep(-.135, -.2, z);      // raised arch, toe spring
/** Closed outline of the last at its base, heel -> outer side -> toe -> inner side, resampled to n points. */
function footOutline(s, off, n) {
  const pts = [...FOOT.map(r => [s * (r[1] + off), r[0]]), ...FOOT.map(r => [-s * (r[2] + off), r[0]]).reverse()], seg = [];
  let L = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(d); L += d; }
  const out = []; let i = 0, acc = 0;
  for (let k = 0; k < n; k++) { const want = k / n * L; while (acc + seg[i] < want) { acc += seg[i]; i = (i + 1) % pts.length; } const t = (want - acc) / seg[i], a = pts[i], b = pts[(i + 1) % pts.length]; out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); }
  return out;
}
/** Combat boot: shaped last, rubber rand around the base, two-layer sole (midsole, lugged outsole) with a welt, toe cap, heel counter, tongue, ankle strap. Laces and eyelets: buildBootDetail. */
export function buildBoot(m, s, o = {}) {
  const x = s * .1, FO = s < 0 ? BONE.FOL : BONE.FOR, SH = s < 0 ? BONE.SHL : BONE.SHR, slot = o.slot ?? SLOT.RUBBER, skin = (px, py) => blend2(FO, SH, py, .17, .03);
  const n = m.seg(12, 6);
  const shaft = [[.272, .062], [.268, .069], [.255, .07], [.2, .064], [.15, .06], [.115, .058]];
  m.loft(shaft.map(r => superRing(n, x, r[0], .006, r[1], r[1] * 1.1, 2.1)), { slot, skin, crease: 180, capA: true, out: (px, py, pz) => [px - x, py > .27 ? .5 : 0, pz - .006] });
  const rows = m.lod === 0 ? FOOT : m.lod === 1 ? FOOT.filter((_, i) => i % 2 === 0 || i === FOOT.length - 1) : FOOT.filter((_, i) => i % 3 === 0 || i === FOOT.length - 1), nf = m.seg(12, 6);
  m.grid(nf, rows.length - 1, (u, v) => footAt(rows[Math.round(v * (rows.length - 1))], u * TAU, s), { wrapU: true, slot, skin: FO, crease: 180, capA: true, capB: true, out: [x, .05, -.05], ao: (px, py) => .74 + .26 * sstep(.03, .09, py) });
  const K = m.lod === 0 ? 26 : m.lod === 1 ? 14 : 10, ring = footOutline(s, .0034, K), lugs = m.lod < 2;
  // lugged outsole: a toothed wall with its tread face, then the midsole above it
  m.grid(K, 1, (u, v) => { const i = Math.round(u * K) % K, p = ring[i], tooth = lugs && i % 2 && p[1] > -.16 && p[1] < .06, c = tooth ? .965 : 1.012; return [x + p[0] * c, soleY(p[1]) + (v ? .0085 : -.001), p[1] * (tooth ? .99 : 1.003)]; }, { wrapU: true, capA: true, slot: o.slotSole ?? SLOT.CLOTH2, skin: FO, crease: 40, out: (px, py, pz) => [px - x, 0, pz + .05] });
  m.grid(K, 2, (u, v) => { const p = ring[Math.round(u * K) % K], b = 1 + .025 * Math.sin(v * Math.PI); return [x + p[0] * b, soleY(p[1]) + .0075 + v * .0125, p[1] * (1 + .008 * Math.sin(v * Math.PI))]; }, { wrapU: true, capB: true, slot: o.slotMid ?? SLOT.RUBBER, skin: FO, crease: 60, out: (px, py, pz) => [px - x, 0, pz + .05] });
  if (m.keep(0)) {
    // rubber rand: a band around the base of the upper, proud of it
    const RK = 22, ro = footOutline(s, .0052, RK), ri = footOutline(s, .0008, RK), hs = [.019, .029, .035, .037];
    m.grid(RK, 3, (u, v) => { const i = Math.round(u * RK) % RK, j = Math.round(v * 3), P = j < 3 ? ro[i] : ri[i]; return [x + P[0], soleY(P[1]) + hs[j], P[1]]; }, { wrapU: true, slot: o.slotRand ?? SLOT.PLATE2, skin: FO, crease: 55, out: (px, py, pz) => [px - x, .3, pz + .05] });
    const wp = [...ring, ring[0]].map(p => [x + p[0] * 1.03, soleY(p[1]) + .0198, p[1] * 1.006]);
    m.tube(wp, .0022, { slot: o.slotWelt ?? SLOT.CLOTH2, skin: FO, sides: 3, n: 16, cap: false, up: [0, 1, 0] });
  }
  if (m.keep(1)) {
    // toe cap and heel counter: shells laid on the last
    const toe = FOOT.slice(7);
    m.grid(m.seg(10, 5), toe.length - 1, (u, v) => footAt(toe[Math.round(v * (toe.length - 1))], (u - .5) * 2.6, s, .0026), { slot: o.slotToe ?? SLOT.PLATE, skin: FO, crease: 180, out: () => [0, 1, -.35], ao: 1 });
    m.plate([[-.042, -.024], [.042, -.024], [.04, .026], [.016, .044], [-.016, .044], [-.04, .026]], (u, v, h) => [x + u, .06 + v, .092 + h - 11 * u * u], { t: .005, slot: o.slotTongue ?? SLOT.PLATE, skin: FO, out: () => [0, 0, 1], inner: 1 });
    m.plate([[-.021, -.112], [.021, -.112], [.025, -.03], [.021, .012], [-.021, .012], [-.025, -.03]], (u, v, h) => { const p = footAt(footRow(v), u / .025 * .62, 1, h + .0002); return [p[0] - .1 + x, p[1], v]; }, { t: .0012, bevel: .0006, slot: o.slotPanel ?? SLOT.CLOTH2, skin: FO, out: () => [0, 1, 0], inner: 1, round: 0 });
    m.revolve([[.0705, .012], [.0745, .008], [.0745, -.008], [.0705, -.012]], { sides: 12, slot: o.slotPanel ?? SLOT.CLOTH2, skin: SH, m: T(x, .226, .006, 0, 0, 0, 1, 1, 1.1), crease: 50 });
  }
}
/** Close range only: ring eyelets, round laces crossing over the tongue, ankle buckle, pull loop, stitching on the rand. */
export function buildBootDetail(m, s, o = {}) {
  const x = s * .1, FO = s < 0 ? BONE.FOL : BONE.FOR, SH = s < 0 ? BONE.SHL : BONE.SHR, N = 5, A = .7, zOf = i => .004 - i * .026;
  const eye = (i, k, off = .0016) => { const p = footAt(footRow(zOf(i)), k * A, 1, off); return [p[0] - .1 + x, p[1], p[2]]; };
  for (let i = 0; i < N; i++) for (const k of [-1, 1]) m.revolve([[.0016, .0014], [.0036, .0016], [.0044, .0006], [.0044, -.0006]], { sides: 8, slot: SLOT.METAL, skin: FO, m: faceTo(eye(i, k), [k * .64, .76, -.1]), crease: 50 });
  const lace = (a, b, zA, zB, steps) => { const pts = []; for (let q = 0; q <= steps; q++) { const t = q / steps, f = footAt(footRow(lerp(zA, zB, t)), lerp(a, b, t), 1, .0042 + .0012 * Math.sin(t * Math.PI)); pts.push([f[0] - .1 + x, f[1], f[2]]); } m.tube(pts, .0026, { slot: o.slotLace ?? SLOT.CLOTH, skin: FO, sides: 5, n: steps + 1, cap: true, crease: 80 }); };
  for (let i = 0; i < N - 1; i++) for (const k of [-1, 1]) lace(k * A, -k * A, zOf(i), zOf(i + 1), 4);
  lace(-A, A, zOf(0), zOf(0), 4);
  buckleAt(m, [x + s * .0765, .226, .006], [s, 0, 0], { up: [0, 0, 1], w: .02, d: .022, skin: SH });
  m.tube([[x - .012, .262, .074], [x, .292, .086], [x + .012, .262, .074]], .003, { slot: SLOT.CLOTH2, skin: SH, sides: 4, n: 5, flat: .5 });
  const rr = footOutline(s, .0058, 36); stitchLine(m, [...rr, rr[0]].map(p => [x + p[0], soleY(p[1]) + .031, p[1]]), { skin: FO, n: 28 });
}

/** Pouch: a filled-out pillow body (rounded edges, the front bulging, a little fuller at the bottom) under a thick flap with rounded edges that folds
 *  over the top and down the front, a rounded tab with a snap. The pouch's outward normal is +Z in its local frame (place with m); w, h, d its size.
 *  o: slot, slotFlap, slotTab, skin, flap (share of the height the flap covers, .38), tab (false: none), ft (flap thickness). */
export function buildPouch(m, w, h, d, place, o = {}) {
  const slot = o.slot ?? SLOT.CLOTH2, skin = o.skin ?? BONE.SPI, P = m.lod === 0 ? 5 : m.lod === 1 ? 4 : 3, fl = o.flap ?? .38, ft = o.ft ?? Math.max(.0035, Math.min(.008, d * .2));
  const body = (qx, qy, qz, off = 0) => {
    const l = (Math.abs(qx) ** P + Math.abs(qy) ** P + Math.abs(qz) ** P) ** (1 / P) || 1, x0 = qx / l, y0 = qy / l, z0 = qz / l;
    const fx = Math.max(0, 1 - x0 * x0), fy = Math.max(0, 1 - y0 * y0), bul = z0 > 0 ? .2 * fx * fy * z0 : 0, sag = 1 + .05 * Math.max(0, -y0);
    const nl = Math.hypot(x0 / w, y0 / h, z0 / d) || 1;
    return [x0 * w / 2 * sag + off * x0 / w / nl, y0 * h / 2 + off * y0 / h / nl, (z0 + bul) * d / 2 + off * z0 / d / nl];
  };
  const nx = m.seg(5, 2), ny = m.seg(5, 2), nz = m.seg(3, 1), V = [], F = [];
  const face = (na, nb, f) => { const b0 = V.length; for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) V.push(body(...f(i / na * 2 - 1, j / nb * 2 - 1))); for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) { const q = b0 + i + j * (na + 1), r = q + 1, u = q + na + 1, v = u + 1; F.push(q, r, u, r, v, u); } };
  face(nx, ny, (a, b) => [a, b, 1]); face(nx, ny, (a, b) => [-a, b, -1]); face(nx, nz, (a, b) => [a, 1, -b]); face(nx, nz, (a, b) => [a, -1, b]); face(nz, ny, (a, b) => [1, b, -a]); face(nz, ny, (a, b) => [-1, b, a]);
  m.surf(V, F, { slot, skin, m: place, crease: 180, ao: (x, y) => .9, out: [0, 0, 0] });
  if (!m.keep(1)) return;
  // flap: a closed shell (outer and inner layer meeting at its rims) from the back of the top, over the front edge, down a share of the front
  const nw = m.seg(7, 3), ns = m.seg(7, 4), q = (sv, xv) => { const xq = xv * 1.1; if (sv < .5) { const t = sv * 2; return [xq, 1, -1 + 2 * t]; } const t = (sv - .5) * 2; return [xq, 1 - 2 * fl * t, 1]; };
  const flap = (u, v) => { const loop = u < .5 ? u * 2 : 2 - u * 2, outer = u < .5, xv = v * 2 - 1, tx = Math.max(0, 1 - Math.abs(xv) ** 6), ts = Math.sin(Math.min(1, loop) * Math.PI * .5 + .02) * Math.min(1, (1 - loop) * 9);
    return body(...q(loop, xv), .0016 + (outer ? (ft + .0022 * sstep(.72, .95, loop)) * tx * Math.max(0, ts) : 0)); };
  m.grid(ns * 2, nw, flap, { wrapU: true, slot: o.slotFlap ?? slot, skin, m: place, crease: 70, ao: 1, noEdge: true, out: [0, -h * .2, -d * .3] });
  if (o.tab !== false) {
    const [tx, ty, tz] = body(0, 1 - 2 * fl, 1, ft + .0035);
    m.box([tx, ty - .002, tz + .0005], [w * .3, .02, .005], .0022, { slot: o.slotTab ?? SLOT.ACCENT, skin, m: place });
    if (m.keep(0)) m.revolve([[.0005, .0018], [.004, .0012], [.0045, 0]], { sides: 7, slot: SLOT.METAL, skin, m: place.clone().multiply(T(tx, ty, tz + .003, Math.PI / 2, 0, 0)), crease: 40 });
  }
}

/** Ribbed hose between bones: the skin weight runs along its length from boneA to boneB. */
export function buildHose(m, path, r, boneA, boneB, o = {}) {
  const a = path[0], b = path[path.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = dx * dx + dy * dy + dz * dz || 1;
  const skin = (x, y, z) => { const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / L, 0, 1), k = sstep(o.t0 ?? .3, o.t1 ?? .75, t); return k <= 0 ? [boneA, 1] : k >= 1 ? [boneB, 1] : [boneA, 1 - k, boneB, k]; };
  m.tube(path, r, { slot: o.slot ?? SLOT.RUBBER, skin, sides: o.sides ?? 8, ribs: o.ribs ?? 0, ribDepth: o.ribDepth ?? .2, ...o.tube });
}

// ---------------------------------------------------------------- palette material
const SLOT_PBR = {     // roughness, metalness, emissive, weave
  cloth: [.92, 0, 0, 1], cloth2: [.84, 0, 0, .7], plate: [.52, .12, 0, 0], plate2: [.46, .18, 0, 0], rubber: [.72, 0, 0, .15], metal: [.38, .62, 0, 0], accent: [.44, .08, .1, 0], glow: [.3, 0, 1.5, 0], visor: [.1, .35, .03, 0], team: [.6, .05, .34, 0],
};
const SLOT_KEYS = ['cloth', 'cloth2', 'plate', 'plate2', 'rubber', 'metal', 'accent', 'glow', 'visor', 'team'];
export const TEAM_BAND = [0x7fb24a, 0xd9803a];   // the two team tints of the game's soldiers, brighter so they read on black
let noiseTex = null;
/** One small tiling value-noise texture shared by every outfit: far cheaper per pixel than procedural noise, and mipmapped so patterns do not shimmer at range. */
function noiseTexture() {
  if (noiseTex) return noiseTex;
  const L = 16, K = 4, n = L * K, lat = new Uint8Array(L * L), d = new Uint8Array(n * n); let sd = 91;
  for (let i = 0; i < L * L; i++) { sd = (sd * 16807) % 2147483647; lat[i] = sd & 255; }
  const sm = t => t * t * (3 - 2 * t), at = (x, y) => lat[((y + L) % L) * L + ((x + L) % L)];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const u = x / K, v = y / K, i = Math.floor(u), j = Math.floor(v), f = sm(u - i), g = sm(v - j); d[y * n + x] = lerp(lerp(at(i, j), at(i + 1, j), f), lerp(at(i, j + 1), at(i + 1, j + 1), f), g); }
  const t = new THREE.DataTexture(d, n, n, THREE.RedFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return (noiseTex = t);
}
let detailTex = null, detailOn = true;
const fitDetailU = { value: 1 };
/** Graphics preset (engine quality level, 0 = best): the two lowest presets drop the surface detail and the close-range geometry. */
export function setOutfitQuality(q) { const on = !(q >= 3); if (on !== detailOn) { detailOn = on; fitDetailU.value = on ? 1 : 0; } }
/** One shared 256 px tile for every outfit and colourway. R: woven cloth height, G: grain and pitting, B: scratches, A: dust and scuffs. */
export function detailTexture() {
  if (detailTex) return detailTex;
  const n = 256, d = new Uint8Array(n * n * 4), sc = new Float32Array(n * n); let sd = 77;
  const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647, sm = t => t * t * (3 - 2 * t);
  const lattice = L => { const a = new Float32Array(L * L); for (let i = 0; i < L * L; i++) a[i] = rnd(); return (x, y) => { const u = x / n * L, v = y / n * L, i = u | 0, j = v | 0, f = sm(u - i), g = sm(v - j), at = (p, q) => a[(q % L) * L + (p % L)]; return lerp(lerp(at(i, j), at(i + 1, j), f), lerp(at(i, j + 1), at(i + 1, j + 1), f), g); }; };
  const nA = lattice(7), nB = lattice(23), nC = lattice(83);
  for (let k = 0; k < 150; k++) {         // scratches: short, thin, mostly one direction, wrapping around the tile
    let x = rnd() * n, y = rnd() * n; const a = (rnd() < .7 ? .5 : 2.1) + (rnd() - .5) * .7, len = 8 + rnd() * rnd() * 90, s = .35 + rnd() * .65, dx = Math.cos(a), dy = Math.sin(a);
    for (let t = 0; t < len; t++) { const q = ((y | 0) & 255) * n + ((x | 0) & 255), e = Math.sin(t / len * Math.PI); if (s * e > sc[q]) sc[q] = s * e; x += dx; y += dy; }
  }
  const TAU2 = Math.PI * 2 / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const q = (y * n + x) * 4, w = .5 + .5 * Math.sin((x + y) * TAU2 * 64) * Math.sin((x - y) * TAU2 * 64), c = nC(x, y), b = nB(x, y), a = nA(x, y);
    d[q] = clamp((w * .74 + c * .26) * 255, 0, 255); d[q + 1] = clamp((c * .55 + b * .45) * 255, 0, 255); d[q + 2] = clamp(Math.max(sc[y * n + x], (c > .86 ? (c - .86) * 4 : 0)) * 255, 0, 255); d[q + 3] = clamp((a * .62 + b * .38) * 255, 0, 255);
  }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 2; t.needsUpdate = true;
  return (detailTex = t);
}
const matCache = new Map();
/** One material per colourway + team band. Every material shares one program ('fz-outfit-v7'). */
export function outfitMaterial(key, pal, team = -1, simple = false) {
  const id = key + '|' + team + (simple ? '|s' : ''); if (matCache.has(id)) return matCache.get(id);
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const col = [], pbr = [];
  for (let i = 0; i < NSLOT; i++) {
    const k = SLOT_KEYS[i], hex = k === 'team' ? (team >= 0 ? TEAM_BAND[team] : (pal.team ?? pal.accent)) : pal[k]; col.push(new THREE.Color(hex));
    const b = SLOT_PBR[k], o = pal.pbr && pal.pbr[k]; pbr.push(new THREE.Vector4(o?.[0] ?? b[0], o?.[1] ?? b[1], o?.[2] ?? b[2], o?.[3] ?? b[3]));
  }
  const p = pal.pattern || {}, rim = new THREE.Color(pal.rim ?? 0x6f7680), rl = Math.max(.2126 * rim.r + .7152 * rim.g + .0722 * rim.b, .001);
  const U = { uFitCol: { value: col }, uFitPbr: { value: pbr }, uFitPat: { value: new THREE.Vector4(p.type || 0, p.scale || 8, p.strength ?? .7, p.plates || 0) }, uFitPatA: { value: new THREE.Color(p.a ?? pal.cloth) }, uFitPatB: { value: new THREE.Color(p.b ?? pal.cloth2) }, uFitRim: { value: rim }, uFitRimN: { value: rim.clone().multiplyScalar(1 / rl) }, uFitLift: { value: pal.lift ?? .02 }, uFitFloor: { value: pal.floor ?? .02 }, uFitDetail: fitDetailU, uFitNoise: { value: noiseTexture() }, uFitTex: { value: detailTexture() } };
  m.userData.fit = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aFit;\nvarying vec4 vFit;\nvarying vec3 vFitP;\nvarying vec3 vFitN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFit = aFit; vFitP = position; vFitN = normal;');
    sh.fragmentShader = (simple ? '#define FIT_SIMPLE\n' : '') + sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uFitCol[${NSLOT}]; uniform vec4 uFitPbr[${NSLOT}]; uniform vec4 uFitPat; uniform vec3 uFitPatA; uniform vec3 uFitPatB; uniform vec3 uFitRim; uniform vec3 uFitRimN; uniform float uFitLift; uniform float uFitFloor; uniform float uFitDetail;
uniform sampler2D uFitNoise; uniform sampler2D uFitTex;
varying vec4 vFit; varying vec3 vFitP; varying vec3 vFitN;
float ftN(vec3 x){ return texture2D(uFitNoise, (x.xy + x.z * vec2(.37, .71)) * .0625).r; }
float ftAA(float e, float x){ float w = max(fwidth(x), .012); return smoothstep(e - w, e + w, x); }
float ftFold(vec3 p, float n){
 float ax = abs(p.x), jz = smoothstep(.1, .0, abs(p.y - .52)) * step(ax, .21) + smoothstep(.09, .0, abs(p.y - 1.16)) * step(.14, ax) + smoothstep(.1, .0, abs(p.y - .92)) * .7;
 return (sin(p.y * 62.0 + n * 4.0 + sin(p.x * 23.0 + p.z * 19.0) * 1.3) * .0021 + sin(p.y * 31.0 - p.z * 11.0 + n * 3.0) * .0009) * (.3 + jz); }
vec3 ftBump(vec3 sp, vec3 sn, float h){ vec3 dx = dFdx(sp), dy = dFdy(sp), r1 = cross(dy, sn), r2 = cross(sn, dx); float det = dot(dx, r1) * (float(gl_FrontFacing) * 2.0 - 1.0); if (abs(det) < 1e-13) return sn; vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2); return normalize(abs(det) * sn - g); }
float ftPat(vec3 p, float ty, float sc){
 float r = 0.0;
 if (ty < 1.5) { float a = ftN(p * sc * vec3(.42, .3, .42)), b = ftN(p.zyx * sc * .62 + 5.0); r = max((1.0 - ftAA(.028, abs(a - .5))) * .85, ftAA(.61, b) * .55); }      // frost: fine veins over soft drifts
 else if (ty < 2.5) { float n = ftN(p * sc * vec3(1.0, .62, 1.0)) * .7 + ftN(p * sc * 2.3) * .3; r = ftAA(.52, n); }                                                     // woodland blots
 else if (ty < 3.5) { float w = p.y * sc * 1.5 + ftN(p * sc * .7) * 2.6; r = ftAA(.16, sin(w)); }                                                                       // dune strata
 else if (ty < 4.5) r = ftAA(.52, ftN(p * vec3(sc * .16, sc * 1.1, sc * .16)));                                                                                           // long wind streaks
 else { float s = ftN(vec3(p.x * sc * 1.4, p.y * sc * .1, p.z * sc * 1.4)), b = ftN(p * sc * .45 + 3.0); r = smoothstep(.56, .82, s) * (.45 + .55 * b) + .4 * smoothstep(.6, .88, b) * (1.0 - smoothstep(.3, 1.2, p.y)); }   // grime: soft run-off streaks, a few patches, heavier low down
 return r; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
 int fitS = int(vFit.x + .5); vec3 fitC = uFitCol[fitS]; vec4 fitB = uFitPbr[fitS]; float fitAo = vFit.y / 255.0, fitEdge = vFit.z / 255.0, fitR = fitB.x;
 float fitPw = fwidth(vFitP.y) + fwidth(vFitP.x), fitWv = 1.0 - smoothstep(.0006, .0018, fitPw);
 vec3 fitAn = abs(vFitN); vec2 fitUv = fitAn.y > .72 ? vFitP.xz : (fitAn.x > fitAn.z ? vFitP.zy : vFitP.xy);
#ifdef FIT_SIMPLE
 vec4 fitD = vec4(.5), fitE = vec4(.5);
#else
 vec3 fitW = pow(fitAn, vec3(4.0)); fitW /= fitW.x + fitW.y + fitW.z;
 vec4 fitD = texture2D(uFitTex, vFitP.zy * 8.0) * fitW.x + texture2D(uFitTex, vFitP.xz * 8.0) * fitW.y + texture2D(uFitTex, vFitP.xy * 8.0) * fitW.z, fitE = texture2D(uFitTex, fitUv * 1.45 + .37);
#endif
 if (uFitPat.x > .5 && (fitS <= 1 || (uFitPat.w > .5 && (fitS == 2 || fitS == 3)))) {
   float pk = ftPat(vFitP, uFitPat.x, uFitPat.y); vec3 tint = fitS == 1 || fitS == 3 ? uFitPatB : uFitPatA;
   fitC = mix(fitC, tint, pk * uFitPat.z);
 }
#ifndef FIT_SIMPLE
 if (fitS < 7) {
   float fitLow = 1.0 - smoothstep(.03, .62, vFitP.y);
   if (fitB.w > .01) {        // cloth and rubber: weave, slight mottling
     fitC *= 1.0 + uFitDetail * fitB.w * (.07 * (fitD.r - .5) * fitWv + .04 * (fitE.g - .5));
     fitR = clamp(fitR + .1 * (fitD.g - .5), .2, 1.0);
   } else {                   // plate and metal: worn edges, fine scratches, pitting
     float wear = smoothstep(.8, .98, fitEdge * .92 + (fitD.g - .5) * .22) * uFitDetail * (fitS == 6 ? .35 : 1.0), sc = smoothstep(.74, .95, fitD.b) * .16 * uFitDetail;
     fitC *= .975 + .05 * fitD.g;
     fitC = mix(fitC, uFitCol[5] * 1.1 + vec3(.03), max(wear * .42, sc));
     fitR = mix(fitR + .07 * (fitD.g - .5), .36, wear);
   }
   float dust = uFitDetail * smoothstep(.62, .86, fitE.a) * (fitS == 6 ? 0.0 : .06 * fitLow * fitLow);       // light dust, heavier toward the ground
   fitC = mix(fitC, vec3(.2, .175, .14), dust); fitR = mix(fitR, .95, dust);
 }
 if (vFit.w > 127.0) { float st = fract((vFitP.x * .8 + vFitP.y + vFitP.z * 1.2) * 150.0); fitC = mix(fitC * .62, fitC * 1.22 + vec3(.012), smoothstep(.25, .35, st) * (1.0 - smoothstep(.75, .85, st))); }       // stitches
#endif
 diffuseColor.rgb = fitC * mix(.42, 1.0, fitAo);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = fitR;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = fitB.y;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifndef FIT_SIMPLE
 if (fitPw < .035 && uFitDetail > .5) { float fh = fitB.w > .4 ? ftFold(vFitP, fitE.a) * fitB.w + fitD.r * .00012 * fitWv : (fitS < 7 ? fitD.g * .00005 : 0.0); normal = ftBump(-vViewPosition, normal, fh * (1.0 - smoothstep(.014, .035, fitPw))); }
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 float fitF = 1.0 - saturate(dot(normalize(normal), normalize(vViewPosition)));
 totalEmissiveRadiance += fitC * fitB.z + uFitRim * (fitF * fitF * fitF * .4 + uFitLift);`)
      .replace('#include <opaque_fragment>', `{ float fL = dot(outgoingLight, vec3(.2126, .7152, .0722)), fS = (.34 + .66 * pow(saturate(dot(normal, normalize(vViewPosition))), 1.25)) * mix(.62, 1.0, fitAo) * (1.0 + .5 * fitEdge), fT = uFitFloor * fS; if (fL < fT) outgoingLight += (fT - fL) * uFitRimN; }
#include <opaque_fragment>`);          // readability floor: in the dark a black outfit keeps its shape; in daylight it never triggers
  };
  m.customProgramCacheKey = () => simple ? 'fz-outfit-v9s' : 'fz-outfit-v9';
  matCache.set(id, m);
  return m;
}

// ---------------------------------------------------------------- cloth rig (bones driven by a small Verlet grid)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
/** A cloak grid described in bind space: nodes[row][col] = [x,y,z]; row 0 is pinned to the chest. Each free node is a bone. */
export function makeClothDef(nodes) {
  const R = nodes.length - 1, C = nodes[0].length, bind = new Float32Array(3 * C * (R + 1));
  for (let r = 0; r <= R; r++) for (let c = 0; c < C; c++) bind.set(nodes[r][c], 3 * (r * C + c));
  const rest = (r0, c0, r1, c1) => Math.hypot(nodes[r0][c0][0] - nodes[r1][c1][0], nodes[r0][c0][1] - nodes[r1][c1][1], nodes[r0][c0][2] - nodes[r1][c1][2]);
  const ca = [], cb = [], cl = [], cm = [];         // constraints: node a, node b, max length, min length
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { ca.push(r * C + c); cb.push((r + 1) * C + c); const l = rest(r, c, r + 1, c); cl.push(l); cm.push(l * .7); }
  for (let r = 1; r <= R; r++) for (let c = 0; c < C - 1; c++) { ca.push(r * C + c); cb.push(r * C + c + 1); const l = rest(r, c, r, c + 1); cl.push(l * 1.06); cm.push(l * .62); }
  const tb = new Float32Array(16 * C * R);
  for (let r = 1; r <= R; r++) for (let c = 0; c < C; c++) {
    const ri = (r - 1) * C + c, u0 = Math.max(c - 1, 0), u1 = Math.min(c + 1, C - 1), d0 = r - 1, d1 = Math.min(r + 1, R);
    _a.set(nodes[d1][c][0] - nodes[d0][c][0], nodes[d1][c][1] - nodes[d0][c][1], nodes[d1][c][2] - nodes[d0][c][2]).normalize();
    _b.set(nodes[r][u1][0] - nodes[r][u0][0], nodes[r][u1][1] - nodes[r][u0][1], nodes[r][u1][2] - nodes[r][u0][2]); _b.addScaledVector(_a, -_b.dot(_a)).normalize(); _c.crossVectors(_a, _b);
    _m.makeBasis(_a, _b, _c).transpose(); tb.set(_m.elements, ri * 16);
  }
  return { R, C, bind, ca: Int16Array.from(ca), cb: Int16Array.from(cb), cl: Float32Array.from(cl), cm: Float32Array.from(cm), tb, nBones: R * C };
}
/** Bilinear skin weights for a point at grid coordinates (col, row). */
export function clothSkin(def, col, row, pinBone = BONE.CHE) {
  const C = def.C, R = def.R, c0 = clamp(Math.floor(col), 0, C - 1), c1 = Math.min(c0 + 1, C - 1), r0 = clamp(Math.floor(row), 0, R), r1 = Math.min(r0 + 1, R), fc = sstep(0, 1, col - c0), fr = sstep(0, 1, row - r0);
  const id = (r, c) => r === 0 ? pinBone : BONE.N + (r - 1) * C + c, W = new Map();
  const add = (b, w) => { if (w > .004) W.set(b, (W.get(b) || 0) + w); };
  add(id(r0, c0), (1 - fc) * (1 - fr)); add(id(r0, c1), fc * (1 - fr)); add(id(r1, c0), (1 - fc) * fr); add(id(r1, c1), fc * fr);
  const o = []; let s = 0; for (const w of W.values()) s += w; for (const [b, w] of W) o.push(b, w / s); return o;
}

// capsule colliders of the body, as bone pairs: [boneA, boneB, radius]
const CAPS = [[BONE.PEL, BONE.CHE, .165], [BONE.THL, BONE.SHL, .1], [BONE.THR, BONE.SHR, .1], [BONE.SHL, BONE.FOL, .078], [BONE.SHR, BONE.FOR, .078], [BONE.UAL, BONE.FAL, .074], [BONE.UAR, BONE.FAR, .074], [BONE.FAL, BONE.HAL, .058], [BONE.FAR, BONE.HAR, .058]];
const NCAP = CAPS.length;

// ---------------------------------------------------------------- outfit instance on a soldier
const view = { x: 0, y: 0, z: 0, set: false };
/** The engine tells the kit where the camera is (LOD choice). */
export function setOutfitView(x, y, z, q, fx, fz) { view.x = x; view.y = y; view.z = z; view.set = true; if (q !== undefined) setOutfitQuality(q); rankFits(fx, fz); }
function rankFits(fx, fz) {       // once per frame, at most 12 x 12 comparisons, no allocation
  const n = liveFits.length;
  for (let i = 0; i < n; i++) { const f = liveFits[i], r = f.rootObj.position, dx = r.x - view.x, dy = r.y - view.y, dz = r.z - view.z; let d = dx * dx + dy * dy + dz * dz; if (fx !== undefined && dx * fx + dz * fz < -1) d += 1e4; if (!f.rootObj.visible) d += 1e6; f.rankD = d; }
  for (let i = 0; i < n; i++) { const a = liveFits[i]; let k = 0; for (let j = 0; j < n; j++) { const b = liveFits[j]; if (b.rankD < a.rankD || (b.rankD === a.rankD && j < i)) k++; } a.rank = k; }
}

/** asset = { geos:[LOD0,LOD1,LOD2], cloth:def|null }, material from outfitMaterial. forceLod: test / warm-up only. */
export function attachInstance(sol, asset, material, forceLod = -1, farMaterial = null) {
  const far = farMaterial || material;
  const def = asset.cloth, nb = BONE.N + (def ? def.nBones : 0), bones = sol.bones.slice(), inverses = sol.skeleton.boneInverses.slice(), extra = [];
  if (def) for (let r = 1; r <= def.R; r++) for (let c = 0; c < def.C; c++) {
    const b = new THREE.Bone(), i = 3 * (r * def.C + c); b.name = 'cloth' + r + '_' + c; b.position.set(def.bind[i], def.bind[i + 1], def.bind[i + 2]); sol.root.add(b); bones.push(b); extra.push(b);
    inverses.push(new THREE.Matrix4().makeTranslation(-def.bind[i], -def.bind[i + 1], -def.bind[i + 2]));
  }
  void nb;
  const skeleton = new THREE.Skeleton(bones, inverses), oldSk = sol.mesh.skeleton, A = sol._dbg.A, oldGeo = sol.mesh.geometry;
  if (!A.gunGeo) { const g = new THREE.BufferGeometry(); for (const k in A.geo.attributes) g.setAttribute(k, A.geo.attributes[k]); g.setIndex(A.geo.index); g.setDrawRange(A.bodyIdx, A.geo.index.count - A.bodyIdx); g.boundingSphere = A.geo.boundingSphere; g.boundingBox = A.geo.boundingBox; A.gunGeo = g; }
  sol.mesh.geometry = A.gunGeo; sol.mesh.bind(skeleton, sol.mesh.bindMatrix);
  let lod = forceLod >= 0 ? forceLod : 0;
  const mesh = new THREE.SkinnedMesh(asset.geos[lod], material);
  mesh.castShadow = sol.mesh.castShadow; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'outfit';
  mesh.boundingSphere = asset.geos[0].boundingSphere.clone(); mesh.boundingBox = asset.geos[0].boundingBox.clone();
  sol.root.add(mesh); mesh.bind(skeleton, new THREE.Matrix4());

  let detail = null;
  if (asset.detail) { detail = new THREE.SkinnedMesh(asset.detail, material); detail.name = 'outfitDetail'; detail.castShadow = false; detail.receiveShadow = true; detail.frustumCulled = false; detail.visible = forceLod === 0 && detailOn; detail.boundingSphere = mesh.boundingSphere; detail.boundingBox = mesh.boundingBox; sol.root.add(detail); detail.bind(skeleton, new THREE.Matrix4()); }
  const P = sol._dbg.P, Q = sol._dbg.Q, root = sol.root;
  const n = def ? def.R * def.C : 0, C = def ? def.C : 0, R = def ? def.R : 0, pos = new Float32Array(3 * C * (R + 1)), prev = new Float32Array(3 * C * (R + 1)), capA = new Float32Array(NCAP * 3), capB = new Float32Array(NCAP * 3);
  let fresh = true, simT = 0, clothOn = false, restT = 0, tick = 0, pendDt = 0; const BIDX = BIND, armNode = new Uint8Array(C * (R + 1));
  for (let r = 1; r <= R; r++) for (let c = 0; c < C; c++) armNode[r * C + c] = (c <= 1 || c >= C - 2) && r <= 2 ? 1 : 0;       // only the side columns can meet an arm

  function modelToWorld(mx, my, mz, out, i) {
    const ry = root.rotation.y, c = Math.cos(ry), s = Math.sin(ry); out[i] = root.position.x + mx * c + mz * s; out[i + 1] = root.position.y + my; out[i + 2] = root.position.z - mx * s + mz * c;
  }
  function pins() {            // row 0, rigid with the chest
    const pc = P[BONE.CHE], qc = Q[BONE.CHE], b = BIDX[BONE.CHE];
    for (let c = 0; c < C; c++) { const i = c * 3; _a.set(def.bind[i] - b[0], def.bind[i + 1] - b[1], def.bind[i + 2] - b[2]).applyQuaternion(qc).add(pc); modelToWorld(_a.x, _a.y, _a.z, pos, i); prev[i] = pos[i]; prev[i + 1] = pos[i + 1]; prev[i + 2] = pos[i + 2]; }
  }
  function resetCloth() {      // everything rigid with the chest
    const pc = P[BONE.CHE], qc = Q[BONE.CHE], b = BIDX[BONE.CHE];
    for (let i = 0; i < C * (R + 1) * 3; i += 3) { _a.set(def.bind[i] - b[0], def.bind[i + 1] - b[1], def.bind[i + 2] - b[2]).applyQuaternion(qc).add(pc); modelToWorld(_a.x, _a.y, _a.z, pos, i); prev[i] = pos[i]; prev[i + 1] = pos[i + 1]; prev[i + 2] = pos[i + 2]; }
    fresh = false;
  }
  function colliders() {
    for (let k = 0; k < NCAP; k++) { const ca = CAPS[k], a = P[ca[0]], b = P[ca[1]]; modelToWorld(a.x, a.y, a.z, capA, k * 3); modelToWorld(b.x, b.y, b.z, capB, k * 3); }
  }
  function collide(i) {
    let x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const rk = sol.dead ? .5 : 1;           // a body on the ground: the cloth lies against it instead of being pushed up into a hump
    const kMax = armNode[i / 3] ? NCAP : 5;
    for (let k = 0; k < kMax; k++) {
      const q = k * 3, ax = capA[q], ay = capA[q + 1], az = capA[q + 2], ex = capB[q] - ax, ey = capB[q + 1] - ay, ez = capB[q + 2] - az, r = CAPS[k][2] * rk, px = x - ax, py = y - ay, pz = z - az;
      let t = (px * ex + py * ey + pz * ez) / (ex * ex + ey * ey + ez * ez + 1e-9); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - ex * t, dy = py - ey * t, dz = pz - ez * t, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r * r && d2 > 1e-8) { const d = Math.sqrt(d2), f = (r - d) / d; x += dx * f; y += dy * f; z += dz * f; }
    }
    pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
  }
  function simulate(dt) {
    const h = dt > .034 ? .034 : dt; if (h <= 0) return; simT += h;
    pins(); colliders();
    const fl = Math.min(root.position.y + P[BONE.FOL].y, root.position.y + P[BONE.FOR].y, root.position.y + P[BONE.PEL].y - .05) - .05, g = -7.5 * h * h, kd = Math.pow(.05, h);          // air drag of a heavy cloth
    const vx = (pos[3 * (C >> 1)] - prevA[0]) / Math.max(h, 1e-3), vz = (pos[3 * (C >> 1) + 2] - prevA[2]) / Math.max(h, 1e-3); prevA[0] = pos[3 * (C >> 1)]; prevA[2] = pos[3 * (C >> 1) + 2];
    const sp = Math.min(Math.sqrt(vx * vx + vz * vz), 8);
    for (let r = 1; r <= R; r++) for (let c = 0; c < C; c++) {
      const i = 3 * (r * C + c); let x = pos[i], y = pos[i + 1], z = pos[i + 2];
      const nx = x + (x - prev[i]) * kd, ny = y + (y - prev[i + 1]) * kd + g, nz = z + (z - prev[i + 2]) * kd;
      prev[i] = x; prev[i + 1] = y; prev[i + 2] = z; pos[i] = nx; pos[i + 1] = ny; pos[i + 2] = nz;
      if (sp > .8) { const f = Math.sin(simT * (9 + c) + r * 1.4 + c * .8) * .0009 * sp * r; pos[i] += f; pos[i + 2] -= f * .6; }     // a little flutter at speed
    }
    const na = def.ca.length;
    for (let it = 0; it < 2; it++) {
      for (let k = 0; k < na; k++) {
        const a = def.ca[k] * 3, b = def.cb[k] * 3, dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 1e-6) continue;
        const L = d > def.cl[k] ? def.cl[k] : d < def.cm[k] ? def.cm[k] : d; if (L === d) continue;
        const f = (d - L) / d, pinA = a < C * 3, wa = pinA ? 0 : .5, wb = pinA ? 1 : .5;
        pos[a] += dx * f * wa; pos[a + 1] += dy * f * wa; pos[a + 2] += dz * f * wa; pos[b] -= dx * f * wb; pos[b + 1] -= dy * f * wb; pos[b + 2] -= dz * f * wb;
      }
    }
    for (let i = C * 3; i < C * (R + 1) * 3; i += 3) { collide(i); if (pos[i + 1] < fl) pos[i + 1] = fl; }
  }
  const prevA = new Float32Array(3);
  function writeBones() {
    const ry = root.rotation.y, cy = Math.cos(ry), sy = Math.sin(ry), rx = root.position.x, ryy = root.position.y, rz = root.position.z;
    _q.setFromAxisAngle(_UP, -ry);
    for (let r = 1; r <= R; r++) for (let c = 0; c < C; c++) {
      const i = 3 * (r * C + c), b = extra[(r - 1) * C + c], wx = pos[i] - rx, wy = pos[i + 1] - ryy, wz = pos[i + 2] - rz, mx = wx * cy - wz * sy, mz = wx * sy + wz * cy;
      if (!(mx === mx && wy === wy && mz === mz)) { fresh = true; return; }
      b.position.set(mx, wy, mz);
      const d0 = 3 * ((r - 1) * C + c), d1 = 3 * (Math.min(r + 1, R) * C + c), u0 = 3 * (r * C + Math.max(c - 1, 0)), u1 = 3 * (r * C + Math.min(c + 1, C - 1));
      _a.set(pos[d1] - pos[d0], pos[d1 + 1] - pos[d0 + 1], pos[d1 + 2] - pos[d0 + 2]).applyQuaternion(_q).normalize();
      _b.set(pos[u1] - pos[u0], pos[u1 + 1] - pos[u0 + 1], pos[u1 + 2] - pos[u0 + 2]).applyQuaternion(_q); _b.addScaledVector(_a, -_b.dot(_a));
      const l = _b.length(); if (l < 1e-5) continue; _b.multiplyScalar(1 / l); _c.crossVectors(_a, _b);
      _m.makeBasis(_a, _b, _c); _m2.fromArray(def.tb, (r - 1) * C * 16 + c * 16); _m.multiply(_m2); b.quaternion.setFromRotationMatrix(_m);
    }
  }
  function rigidBones() {      // far away: the cloth rides on the chest
    const pc = P[BONE.CHE], qc = Q[BONE.CHE], bc = BIDX[BONE.CHE];
    for (let r = 1; r <= R; r++) for (let c = 0; c < C; c++) { const i = 3 * (r * C + c), b = extra[(r - 1) * C + c]; b.position.set(def.bind[i] - bc[0], def.bind[i + 1] - bc[1], def.bind[i + 2] - bc[2]).applyQuaternion(qc).add(pc); b.quaternion.copy(qc); }
    fresh = true;
  }

  let gunCast = null;
  const inst = {
    mesh, skeleton, rootObj: root, rank: 0, rankD: 0,
    shadowIn() { mesh.geometry = asset.geos[2]; gunCast = sol.mesh.castShadow; if (lod > 0) sol.mesh.castShadow = false; },
    restore() { mesh.geometry = asset.geos[lod]; if (gunCast !== null) { sol.mesh.castShadow = gunCast; gunCast = null; } },
    get lod() { return lod; },
    update(dt) {
      let close = forceLod === 0;
      if (forceLod < 0 && view.set) {
        const dx = root.position.x - view.x, dy = root.position.y - view.y, dz = root.position.z - view.z, d2 = dx * dx + dy * dy + dz * dz, h = lod === 0 ? 1.08 : .94, l0 = LOD_DIST[0] * h, l1 = LOD_DIST[1] * (lod === 2 ? .94 : 1.06);
        const want = d2 < l0 * l0 && inst.rank < MAX_LOD0 ? 0 : d2 < l1 * l1 ? 1 : 2;
        if (want !== lod) { lod = want; mesh.geometry = asset.geos[lod]; }
        close = d2 < DETAIL_DIST * DETAIL_DIST && inst.rank < MAX_DETAIL;
      }
      if (detail) { const on = close && lod === 0 && detailOn; if (detail.visible !== on) detail.visible = on; }
      { const mat = lod === 0 && detailOn ? material : far; if (mesh.material !== mat) mesh.material = mat; }
      if (mesh.castShadow !== sol.mesh.castShadow) mesh.castShadow = sol.mesh.castShadow;
      { const cull = !sol.dead; if (mesh.frustumCulled !== cull) { mesh.frustumCulled = cull; sol.mesh.frustumCulled = cull; if (detail) detail.frustumCulled = cull; } }
      if (!def) return;
      if (lod === 2 && !sol.dead) { rigidBones(); clothOn = false; return; }
      if (sol.dead && sol._dbg.isSleeping()) { restT += dt; if (restT > 1) return; } else restT = 0;       // a settled body costs nothing
      if (fresh || !clothOn) { resetCloth(); clothOn = true; prevA[0] = pos[3 * (C >> 1)]; prevA[2] = pos[3 * (C >> 1) + 2]; }
      else {       // a jump of the body (respawn, teleport): no whip
        const i = 3 * (C >> 1), b = BIDX[BONE.CHE]; _a.set(def.bind[i] - b[0], def.bind[i + 1] - b[1], def.bind[i + 2] - b[2]).applyQuaternion(Q[BONE.CHE]).add(P[BONE.CHE]); modelToWorld(_a.x, _a.y, _a.z, scratch3, 0);
        const jx = scratch3[0] - pos[i], jy = scratch3[1] - pos[i + 1], jz = scratch3[2] - pos[i + 2]; if (jx * jx + jy * jy + jz * jz > 1.5) resetCloth();
      }
      pendDt += dt; if (lod === 1 && !sol.dead && (++tick & 1)) return;
      simulate(pendDt); pendDt = 0; writeBones();
    },
    reset() { fresh = true; },
    dispose() {
      const li = liveFits.indexOf(inst); if (li >= 0) liveFits.splice(li, 1); mesh.geometry = asset.geos[lod]; sol.mesh.frustumCulled = false;
      mesh.removeFromParent(); if (detail) detail.removeFromParent(); for (const b of extra) b.removeFromParent();
      skeleton.dispose(); sol.mesh.geometry = oldGeo; sol.mesh.bind(oldSk, sol.mesh.bindMatrix);
    },
  };
  liveFits.push(inst);
  inst.update(1 / 60);
  return inst;
}
const liveFits = [];
/** Everything a set module needs once its parts are written: LODs built in small steps, attach, first-person arms, stats.
 *  sets: its OUTFIT_SETS; parts / detailParts: fn(mesher) lists; cloth: makeClothDef result or null. */
export function defineOutfitSet(sets, parts, detailParts, cloth = null, names = null) {
  const byId = new Map(sets.map(o => [o.id, o])), asset = { geos: null, detail: null, cloth, tris: null, detailTris: 0 };
  const finish = (gs, dm) => { if (asset.geos) return; asset.tris = gs.map(g => g.tris); asset.detailTris = dm.tris; asset.detail = dm.toGeometry(); asset.geos = gs.map(g => g.toGeometry()); };
  async function prepareOutfits(yieldFn) {
    if (asset.geos) return asset;
    detailTexture(); if (yieldFn) await yieldFn();
    const gs = []; for (let l = 0; l < 3; l++) { const m = new Mesher(l); for (const p of parts) { p(m); if (yieldFn) await yieldFn(); } gs.push(m); }
    const dm = new Mesher(0); for (const p of detailParts) { p(dm); if (yieldFn) await yieldFn(); }
    if (asset.geos) return asset;      // a concurrent build finished first
    const tris = gs.map(g => g.tris), det = dm.tris, out = [];
    for (const g of gs) { out.push(g.toGeometry()); if (yieldFn) await yieldFn(); }       // one geometry per step
    const detail = dm.toGeometry();
    if (!asset.geos) { asset.tris = tris; asset.detailTris = det; asset.detail = detail; asset.geos = out; }
    return asset;
  }
  const buildNow = () => { if (asset.geos) return; const gs = []; for (let l = 0; l < 3; l++) { const m = new Mesher(l); for (const p of parts) p(m); gs.push(m); } const dm = new Mesher(0); for (const p of detailParts) p(dm); finish(gs, dm); };
  return {
    outfitById: id => byId.get(id) || null, prepareOutfits,
    attachOutfit(soldier, id, opts = {}) { const def = byId.get(id); if (!def || soldier.kind !== 'soldier') return null; buildNow(); const team = opts.team === 0 || opts.team === 1 ? opts.team : -1; return attachInstance(soldier, asset, outfitMaterial(def.id, def.palette, team), opts.lod ?? -1, outfitMaterial(def.id, def.palette, team, true)); },
    fpArms(id) { const def = byId.get(id); return def ? fpArmsFor(def.id, def.palette) : null; },
    outfitTriangles: () => asset.tris, outfitDetailTriangles: () => asset.detailTris,
    outfitPartStats: () => [0, 1, 2].map(l => { const m = new Mesher(l), o = {}; parts.forEach((f, i) => { const t = m.tris; f(m); o[names?.[i] || 'p' + i] = m.tris - t; }); o.total = m.tris; return o; }),
  };
}
/** Once per renderer: outfits cast their shadow with the coarsest LOD. The render list is already built when the shadow pass runs, so the colour pass keeps its own LOD. */
export function hookOutfitShadows(renderer) {
  const sm = renderer.shadowMap; if (sm.fitHooked) return; sm.fitHooked = true; const base = sm.render;
  sm.render = function (lights, scene, camera) {
    const on = liveFits.length > 0 && sm.enabled && (sm.autoUpdate || sm.needsUpdate);
    if (on) for (let i = 0; i < liveFits.length; i++) liveFits[i].shadowIn();
    try { base.call(sm, lights, scene, camera); } finally { if (on) for (let i = 0; i < liveFits.length; i++) liveFits[i].restore(); }
  };
}
const _UP = new THREE.Vector3(0, 1, 0), _m2 = new THREE.Matrix4(), scratch3 = new Float32Array(3);

// ---------------------------------------------------------------- first-person arms
const fpCache = new Map();
/** Procedural sleeve texture and glove colour for the first-person arms (128 px, generated once per colourway at load). */
export function fpArmsFor(key, pal) {
  if (fpCache.has(key)) return fpCache.get(key);
  const n = 128, d = new Uint8Array(n * n * 4), base = new THREE.Color(pal.cloth), alt = new THREE.Color(pal.cloth2), acc = new THREE.Color(pal.accent), pat = pal.pattern || {}, pA = new THREE.Color(pat.a ?? pal.cloth2);
  base.convertLinearToSRGB(); alt.convertLinearToSRGB(); acc.convertLinearToSRGB(); pA.convertLinearToSRGB();
  for (const c of [base, alt]) { const l = Math.max(c.r, c.g, c.b), k = l < .24 ? .24 / Math.max(l, .01) : 1; c.multiplyScalar(k); }      // a black sleeve still shows its folds in a dark corridor
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, noise = new Float32Array(n); for (let i = 0; i < n; i++) noise[i] = rnd();
  // pal.fpSleeve === 'armour': plated forearm (gauntlet cuff, two vambrace lames, a dark gap at the elbow, upper plate), seams, rivets, chips and grime
  const armourSleeve = pal.fpSleeve === 'armour', grain2 = armourSleeve ? Float32Array.from({ length: n * n }, rnd) : null, pl = new THREE.Color(pal.plate), p2 = new THREE.Color(pal.plate2), mt = new THREE.Color(pal.metal ?? pal.plate2);
  pl.convertLinearToSRGB(); p2.convertLinearToSRGB(); mt.convertLinearToSRGB();
  const LAMES = [[0, .1, p2], [.1, .325, pl], [.335, .56, pl], [.56, .62, alt], [.62, 1.01, p2]];
  const armourPx = (u, v, gr) => {
    let c = pl, b0 = 0, b1 = 1; for (const s of LAMES) if (v >= s[0] && v < s[1]) { c = s[2]; b0 = s[0]; b1 = s[1]; }
    const e = Math.min(v - b0, b1 - v), bevel = e < .01 ? .55 : e < .026 ? 1.14 : 1, ridge = 1 + .07 * Math.cos((u - .25) * TAU), chip = gr > .955 && e < .05 ? 1.4 : 1, grime = .84 + .16 * gr;
    const k = bevel * ridge * grime * chip; let r = c.r * k, g = c.g * k, b = c.b * k;
    if (Math.abs(((u * 8) % 1) - .5) < .045 && (Math.abs(v - .12) < .007 || Math.abs(v - .54) < .007)) { r = mt.r * 1.25; g = mt.g * 1.25; b = mt.b * 1.25; }        // rivets
    if (v > .2 && v < .236 && u > .1 && u < .4 && ((u * 12 + v * 36) % 1) < .5) { r = acc.r; g = acc.g; b = acc.b; }                                           // warning chevrons on the outer face
    return [r, g, b];
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n, v = y / n, fold = .5 + .5 * Math.sin(v * 24 + Math.sin(u * TAU * 2) * 1.6), grain = noise[(x * 7 + y * 13) % n], weave = (x + y) % 2 ? .95 : 1.04;
    let r = base.r, g = base.g, b = base.b;
    if (pat.type) { const q = Math.sin(u * 19 + Math.sin(v * 11) * 2) + Math.sin(v * 15 + u * 7); if (q > .5) { r = lerp(r, pA.r, .7); g = lerp(g, pA.g, .7); b = lerp(b, pA.b, .7); } }
    const seam = Math.abs(u - .5) < .012 ? .72 : 1, shade = (.62 + .62 * fold * fold) * weave * (.92 + grain * .14) * seam; r *= shade; g *= shade; b *= shade;
    if (v < .09) { r = alt.r * .95; g = alt.g * .95; b = alt.b * .95; }                   // cuff
    if ((v > .1 && v < .135) || (v > .3 && v < .318) || (v > .335 && v < .343)) { r = acc.r; g = acc.g; b = acc.b; }      // accent band above the cuff, and a double stripe on the forearm
    if (armourSleeve) [r, g, b] = armourPx(u, v, grain2[y * n + x]);
    const q = (y * n + x) * 4; d[q] = clamp(r * 255, 0, 255); d[q + 1] = clamp(g * 255, 0, 255); d[q + 2] = clamp(b * 255, 0, 255); d[q + 3] = 255;
  }
  const map = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true; map.needsUpdate = true;
  const kitMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, metalness: .14, fog: false }), kits = {};
  const out = { map, glove: pal.fpGlove ?? pal.rubber, accent: pal.accent, kitMat, handKit: s => kits[s] || (kits[s] = fpHandKit(pal, s)) };
  fpCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------- close-range detail kit (reusable by every outfit)
/** Matrix placing local +Y along the normal n at point p. */
export function faceTo(p, n, up = [0, 1, 0]) {
  const Y = new THREE.Vector3(n[0], n[1], n[2]).normalize(), X = new THREE.Vector3(up[0], up[1], up[2]).cross(Y);
  if (X.lengthSq() < 1e-5) X.set(1, 0, 0).cross(Y); X.normalize(); const Z = new THREE.Vector3().crossVectors(X, Y);
  return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p[0], p[1], p[2]);
}
/** Point and normal of a surface map at (u, v, h). */
export const mapAt = (map, u, v, h = 0) => { const p = map(u, v, h), q = map(u, v, h + .01); return [p, [q[0] - p[0], q[1] - p[1], q[2] - p[2]]]; };
/** Hex-head screw or eyelet. */
export function screw(m, p, n, o = {}) { const r = o.r ?? .0032, h = o.h ?? .0016; m.revolve([[.0004, h], [r, h * .35]], { sides: 6, slot: o.slot ?? SLOT.METAL, skin: o.skin ?? 0, m: faceTo(p, n), crease: 40 }); }
/** Thin thread along a path, drawn as dashes by the shader. */
export function stitchLine(m, pts, o = {}) { m.tube(pts, o.r ?? .0011, { sides: 3, n: o.n ?? Math.max(4, pts.length * 2), stitch: 1, slot: o.slot ?? SLOT.CLOTH2, skin: o.skin ?? 0, cap: false, crease: 80, up: o.up }); }
/** A row of load-bearing webbing with bar tacks, laid on a surface map. */
export function webbingRow(m, map, u0, u1, v, o = {}) {
  const w = o.w ?? .0125, h = o.h ?? .001, t = .0022, n = Math.max(4, Math.round(Math.abs(u1 - u0) / (o.pitch ?? .02))), skin = o.skin ?? 0, slot = o.slot ?? SLOT.CLOTH2, [, d] = mapAt(map, (u0 + u1) / 2, v, h), out = () => d;
  m.grid(n, 2, (a, b) => { const q = b * 2 - 1; return map(lerp(u0, u1, a), v + q * w / 2, h + t * (1 - q * q)); }, { slot, skin, crease: 60, out, ao: .92 });
  for (let i = 1; i < n; i += 2) { const uc = lerp(u0, u1, i / n), dw = (o.tack ?? .0045) / 2; m.grid(1, 1, (a, b) => map(uc + (a - .5) * 2 * dw, v + (b - .5) * w * .86, h + t + .0005), { slot, skin, stitch: 1, crease: 30, out }); }
}
/** Strap buckle: a rounded frame of round bar, its centre bar, the prong lying on the strap, and a keeper loop round the strap next to it.
 *  Local frame: faceTo(p, n, up): the frame spans w along local X and d along local Z; the strap runs along Z under it. o: w, d, t (bar), th (strap
 *  thickness for the keeper), keeper (false: none), slot, skin, up. */
export function buckleAt(m, p, n, o = {}) {
  const w = o.w ?? .024, d = o.d ?? .016, t = o.t ?? .0032, M = faceTo(p, n, o.up ?? [0, 1, 0]), slot = o.slot ?? SLOT.METAL, skin = o.skin ?? 0;
  const W = (x, y, z) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(M); return [v.x, v.y, v.z]; };
  if (m.lod >= 2) { m.box([0, t * .3, 0], [w, t, d], .001, { slot, skin, m: M }); return; }
  const loop = (hx, hz, r, k) => { const pts = []; for (const [cx, cz, a0] of [[hx - r, hz - r, 0], [-(hx - r), hz - r, Math.PI / 2], [-(hx - r), -(hz - r), Math.PI], [hx - r, -(hz - r), Math.PI * 1.5]]) for (let i = 0; i <= k; i++) { const a = a0 + i / k * Math.PI / 2; pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } return pts; };
  const fr = loop(w / 2, d / 2, Math.min(w, d) * .24, m.keep(0) ? 2 : 1), sides = m.keep(0) ? 4 : 3;
  m.tube([...fr, fr[0], fr[1]].map(([x, z]) => W(x, t * .5, z)), t * .5, { slot, skin, sides, n: fr.length + 1, cap: false, crease: 70 });
  m.tube([W(-w / 2 + t * .3, t * .5, 0), W(w / 2 - t * .3, t * .5, 0)], t * .42, { slot, skin, sides, n: 2, cap: false });
  if (!m.keep(0)) return;
  m.tube([W(0, t * .55, 0), W(0, t * .45, d * .3), W(0, t * .2, d / 2 + t * .6)], t * .28, { slot, skin, sides: 4, n: 4, cap: true });
  if (o.keeper !== false) { const th = o.th ?? .004, kz = d / 2 + .008, kl = loop(w / 2 + .0022, th / 2 + .0016, .0016, 1); m.tube([...kl, kl[0], kl[1]].map(([x, y]) => W(x, y - th / 2 + t * .1, kz)), .0011, { slot: o.slotKeeper ?? slot, skin, sides: 4, n: kl.length + 1, cap: false, crease: 70 }); }
}
/** Belt round the waist: a thick band with rounded edges on the ellipse (rx, rz) at height y, dipping by `sag` at the front, with belt loops (keepers,
 *  at the angles o.keepers) and, unless o.buckle === false, a frame buckle at the front with the tail of the belt tucked under a loop.
 *  o: w (width .038), t (thickness .005), sag, cz, e (superellipse exponent, 2 = ellipse), slot, slotKeeper, slotBuckle, skin. Returns map(a, h, dy) of its outer face. */
export function beltRing(m, y, rx, rz, o = {}) {
  const w = o.w ?? .038, t = o.t ?? .005, sag = o.sag ?? .007, cz = o.cz ?? .004, p = 2 / (o.e ?? 2), skin = o.skin ?? BONE.PEL, slot = o.slot ?? SLOT.RUBBER;
  const at = (a, h = 0, dy = 0) => { const s = Math.sin(a), c = Math.cos(a), Y = y - sag * Math.max(0, c) ** 2; return [(rx + h) * Math.sign(s) * Math.abs(s) ** p, Y + dy, cz - (rz + h) * Math.sign(c) * Math.abs(c) ** p]; };
  const r = Math.min(t * .48, w * .2), SEC = m.lod >= 2 ? [[0, -.5], [1, -.5], [1, .5], [0, .5]] : [[0, -.5], [1 - r / t, -.5], [1, -.5 + r / w], [1, .5 - r / w], [1 - r / t, .5], [0, .5]];
  const K = SEC.length;
  m.grid(m.seg(o.n ?? 32, 12), K, (u, v) => { const k = Math.round(v * K) % K, [hh, dd] = SEC[k]; return at(u * TAU, -.0015 + hh * (t + .0015), dd * w); }, { wrapU: true, slot, skin, crease: 50, out: (x, yy, z) => [x, 0, z - cz] });
  if (m.keep(1)) for (const a of o.keepers ?? [-1.25, -.55, .55, 1.25, Math.PI]) m.grid(2, 4, (u, v) => { const da = (u - .5) * .012 / Math.max(rx, rz) * 2, ang = v * Math.PI, dy = -Math.cos(ang) * (w / 2 + .0035); return at(a + da, t * .45 + (t * .55 + .0025) * Math.sqrt(Math.sin(ang)), dy); }, { slot: o.slotKeeper ?? SLOT.CLOTH2, skin, crease: 60, out: (x, yy, z) => [x, 0, z - cz] });
  if (o.buckle !== false) {
    const p0 = at(0, t), p1 = at(0, t + .01), n = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    buckleAt(m, p0, n, { up: [1, 0, 0], w: w + .008, d: o.bw ?? .046, t: o.bt ?? .0042, th: t, slot: o.slotBuckle ?? SLOT.METAL, skin, keeper: true });
    if (m.keep(1)) { const a0 = -(o.bw ?? .046) / 2 / rz, a1 = a0 - .32; m.grid(m.seg(6, 3), 2, (u, v) => at(lerp(a0, a1, u), t + .0012 + .0035 * Math.sin(v * Math.PI), (v - .5) * (w - .004)), { slot, skin, crease: 60, out: (x, yy, z) => [x, 0, z - cz] }); }
  }
  return at;
}
/** Flat webbing strap along a path (box section w x th), its face turned toward out(x, y, z) -> outward vector. o: slot, skin, n, closed, tension. */
export function strapAlong(m, path, w, th, out, o = {}) {
  const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(p[0], p[1], p[2])), !!o.closed, 'catmullrom', o.tension ?? .5);
  const n = m.seg(o.n ?? Math.ceil(curve.getLength() / .025) + 1, 3), P = curve.getSpacedPoints(n), V = [], F = [], t = new THREE.Vector3(), N = new THREE.Vector3(), W = new THREE.Vector3(), rings = o.closed ? n : n + 1;
  // section: a rounded rectangle (real thickness, soft edges) up close, a plain box far away
  const rr = Math.min(th * .45, w * .22), kx = 1 - 2 * rr / w, ky = 1 - 2 * rr / th, SEC = m.lod >= 2 ? [[1, 1], [-1, 1], [-1, -1], [1, -1]] : [[1, ky], [kx, 1], [-kx, 1], [-1, ky], [-1, -ky], [-kx, -1], [kx, -1], [1, -ky]];
  for (let i = 0; i < rings; i++) {
    const a = o.closed ? P[(i + n - 1) % n] : P[Math.max(i - 1, 0)], b = o.closed ? P[(i + 1) % n] : P[Math.min(i + 1, n)], d = out(P[i].x, P[i].y, P[i].z);
    t.subVectors(b, a).normalize(); N.set(d[0], d[1], d[2]); N.addScaledVector(t, -N.dot(t)).normalize(); W.crossVectors(t, N);
    for (const [ca, cb] of SEC) V.push([P[i].x + W.x * ca * w / 2 + N.x * cb * th / 2, P[i].y + W.y * ca * w / 2 + N.y * cb * th / 2, P[i].z + W.z * ca * w / 2 + N.z * cb * th / 2]);
  }
  const KS = SEC.length; for (let i = 0; i < n; i++) { const r0 = i * KS, r1 = ((i + 1) % rings) * KS; for (let k = 0; k < KS; k++) { const a = r0 + k, b = r0 + (k + 1) % KS, c = r1 + k, d = r1 + (k + 1) % KS; F.push(a, b, c, b, d, c); } }
  if (!o.closed) for (const r of [0, n * KS]) for (let k = 1; k < KS - 1; k++) F.push(r, r + k, r + k + 1);
  return m.surf(V, F, { slot: o.slot ?? SLOT.ACCENT, skin: o.skin ?? 0, crease: o.crease ?? 50, ao: o.ao, out: (cx, cy, cz) => { let bi = 0, bd = 1e9; for (let i = 0; i < P.length; i += Math.max(1, P.length >> 4)) { const q = P[i], dd = (q.x - cx) ** 2 + (q.y - cy) ** 2 + (q.z - cz) ** 2; if (dd < bd) { bd = dd; bi = i; } } return [cx - P[bi].x, cy - P[bi].y, cz - P[bi].z]; } });
}
/** Carabiner: a closed oval of wire. */
export function carabiner(m, p, n, o = {}) {
  const M = faceTo(p, n, o.up ?? [0, 1, 0]).elements, a = o.a ?? .011, b = o.b ?? .019, pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12 * TAU, x = a * Math.cos(t), z = b * Math.sin(t); pts.push([M[0] * x + M[8] * z + M[12], M[1] * x + M[9] * z + M[13], M[2] * x + M[10] * z + M[14]]); }
  m.tube(pts, o.r ?? .0017, { slot: o.slot ?? SLOT.METAL, skin: o.skin ?? 0, sides: 4, n: 14, cap: false, crease: 70 });
}
/** Coiled cable between two points. */
export function coilCable(m, a, b, o = {}) {
  const turns = o.turns ?? 6, R = o.R ?? .0065, A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), D = B.clone().sub(A).normalize(), U = new THREE.Vector3(D.y, D.z, D.x).cross(D).normalize(), V = D.clone().cross(U), pts = [], N = turns * 6;
  for (let i = 0; i <= N; i++) { const t = i / N, e = i / 6 * TAU, q = A.clone().lerp(B, t).addScaledVector(U, Math.cos(e) * R * Math.min(1, Math.min(t, 1 - t) * 14)).addScaledVector(V, Math.sin(e) * R * Math.min(1, Math.min(t, 1 - t) * 14)); pts.push([q.x, q.y, q.z]); }
  m.tube(pts, o.r ?? .0015, { slot: o.slot ?? SLOT.RUBBER, skin: o.skin ?? 0, sides: 3, n: N + 2, cap: false, crease: 80 });
}
/** Accessory rail along local Z. */
export function railMount(m, M, len, o = {}) {
  const slot = o.slot ?? SLOT.METAL, skin = o.skin ?? 0, n = o.teeth ?? 6; m.box([0, .0025, 0], [.012, .005, len], .001, { slot, skin, m: M });
  for (let i = 0; i < n; i++) m.box([0, .0062, (i + .5) / n * len - len / 2], [.0135, .0026, len / n * .5], .0006, { slot, skin, m: M });
}
/** Glove, close range: seams around the back plate and along each finger, palm panel, wrist strap and buckle. */
export function buildGloveDetail(m, s, o = {}) {
  const H = s < 0 ? BONE.HAL : BONE.HAR, F = s < 0 ? BONE.FAL : BONE.FAR, x = s * .2, zs = [-.037, -.016, .006, .026], lens = [.044, .05, .047, .036];
  const bm = planeMap([x + s * .0272, .848, -.004], [0, 0, 1], [0, 1, 0], s < 0 ? 1 : -1), bo = [[-.029, -.015], [.029, -.015], [.033, .013], [.015, .027], [-.015, .027], [-.033, .013], [-.029, -.015]];
  if (o.guard !== false) stitchLine(m, bo.map(p => bm(p[0], p[1], .0042)), { skin: H, n: 24 });
  for (let i = 0; i < 4; i++) { const z = zs[i], L = lens[i], cu = -s; stitchLine(m, [[x + s * .0138, .8, z + .006], [x + s * .0128, .8 - L * .55, z + .0045], [x + cu * .003, .8 - L * 1.05, z + .003], [x + cu * .024, .8 - L * 1.33, z + .002]], { skin: H, n: 9, r: .0008 }); }
  m.plate([[-.036, -.03], [.036, -.03], [.04, .018], [.024, .034], [-.024, .034], [-.04, .018]], planeMap([x - s * .0265, .84, -.004], [0, 0, 1], [0, 1, 0], s < 0 ? -1 : 1), { t: .0028, bevel: .0012, slot: o.slotPalm ?? SLOT.CLOTH2, skin: H, inner: 1 });
  m.revolve([[.0515, .008], [.0542, .0045], [.0542, -.0045], [.0515, -.008]], { sides: 12, slot: SLOT.CLOTH2, skin: F, m: T(x, .871, 0, 0, 0, 0, 1, 1, 1.04), crease: 50 });
  buckleAt(m, [x + s * .0555, .871, 0], [s, 0, 0], { up: [0, 0, 1], w: .014, d: .016, t: .0026, skin: F });
}
/** First person: knuckle guards, back plate, wrist strap with accent, in the hand space of guns.js (back of the hand toward -Z). */
function fpHandKit(pal, s) {
  const m = new Mesher(0), color = { [SLOT.PLATE]: new THREE.Color(pal.plate), [SLOT.PLATE2]: new THREE.Color(pal.plate2), [SLOT.CLOTH2]: new THREE.Color(pal.cloth2), [SLOT.ACCENT]: new THREE.Color(pal.accent), [SLOT.METAL]: new THREE.Color(pal.metal) };
  const armour = pal.fpKit !== 'plain';      // 'plain': a thin glove, wrist strap only (no knuckle guard, no back plate)
  if (armour) knuckleGuard(m, (u, v, h) => [u * .045, .064 + v * .024 - .006 * u * u, -.0168 - h], [-.65, -.22, .22, .65], { slot: SLOT.PLATE, skin: 0, out: () => [0, 0, -1], t: .003, bump: .003, nu: 26 });
  if (armour) m.plate([[-.03, .012], [.03, .012], [.034, .05], [.02, .062], [-.02, .062], [-.034, .05]], planeMap([0, 0, -.0172], [1, 0, 0], [0, 1, 0], -1), { t: .0032, bevel: .0014, slot: SLOT.PLATE2, skin: 0, inner: 1 });
  m.box([0, -.012, 0], [.086, .017, .062], .007, { slot: pal.fpStrap === 'accent' ? SLOT.ACCENT : SLOT.CLOTH2, skin: 0 });       // fpStrap 'accent': the wrist strap in the accent colour (AS: its yellow webbing)
  if (pal.fpKit === 'heavy') {        // 'heavy': a flared gauntlet cuff over the wrist, with two rivets
    m.revolve([[.043, .004], [.05, -.003], [.054, -.026], [.051, -.044], [.045, -.047]], { sides: 14, slot: SLOT.PLATE2, skin: 0, m: T(0, -.002, 0, 0, 0, 0, 1, 1, .76), crease: 45 });
    for (const k of [-1, 1]) m.box([k * .03, -.02, -.0385], [.006, .006, .004], .0015, { slot: SLOT.METAL, skin: 0 });
  }
  m.box([0, -.012, -.0325], [.03, .012, .004], .001, { slot: SLOT.ACCENT, skin: 0 });
  for (const k of [-1, 1]) m.box([k * .0135, -.012, -.0352], [.003, .015, .003], .001, { slot: SLOT.METAL, skin: 0 });
  const g = new THREE.BufferGeometry(), n = m.n, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = color[m.A[i * 4]] || color[SLOT.PLATE]; c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m.P), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(m.N), 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setIndex(new THREE.BufferAttribute(new Uint16Array(m.I), 1));
  return g;
}
