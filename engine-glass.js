// FRONT ZÉRO — [vitres] broken glass, drawn from the pane state engine-props.js already keeps (and syncs online):
//  - a bullet's first hit holes and cracks a window: a star of cracks around the impact, the pane stays in place;
//  - a broken window keeps jagged, translucent pieces in its frame with a light fracture edge, and leaves glass on the floor on both sides;
//  - the break throws shards that spin, fall, bounce, glint in the sun, then lie a few seconds;
//  - vehicle and cabin glazing (baked in the map) gets a spider-web crack around the impact instead of a dark hole.
// Materials: the props' Lambert (vertex colours) and two copies of the pane glass with the same parameters: no shader program of its own.
// Every mesh is instanced and built at attach (behind the loading screen, warmed with the map); fixed pools, no allocation in play.
import * as THREE from 'three';
import { seeded } from './map-props.js';

const POOL = 240, GRAV = 9.8, VARS = 3, CRACK_MAX = 128, SPAWN_FRAME = 150, REST = 6, REST_RND = 4, FADE = 0.6, CRACK_R = 0.36, WEB_R = 0.32;

/* ---------- geometry, built once ---------- */
function soup() {
  const p = [], n = [], c = [];
  return {
    /** Two-sided triangle in the planes z = +zf (normal +z) and z = -zf (normal -z), vertex colour (r, g, b). */
    tri2(ax, ay, bx, by, cx, cy, r, g, b, zf) {
      if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0) { let t = bx; bx = cx; cx = t; t = by; by = cy; cy = t; }
      p.push(ax, ay, zf, bx, by, zf, cx, cy, zf, ax, ay, -zf, cx, cy, -zf, bx, by, -zf);
      for (let i = 0; i < 3; i++) n.push(0, 0, 1); for (let i = 0; i < 3; i++) n.push(0, 0, -1);
      for (let i = 0; i < 6; i++) c.push(r, g, b);
    },
    /** Triangle in the plane z = 0, for the double-sided glass (position only). */
    tri(ax, ay, bx, by, cx, cy) { p.push(ax, ay, 0, bx, by, 0, cx, cy, 0); },
    /** Triangle lying on the floor (y = 0), facing up. */
    flat(ax, az, bx, bz, cx, cz, r, g, b) {
      if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) < 0) { let t = bx; bx = cx; cx = t; t = bz; bz = cz; cz = t; }
      p.push(ax, 0, az, bx, 0, bz, cx, 0, cz); for (let i = 0; i < 3; i++) { n.push(0, 1, 0); c.push(r, g, b); }
    },
    /** Thin two-sided strip from (x0, y0) to (x1, y1), width w0 then w1. */
    seg(x0, y0, x1, y1, w0, w1, r, g, b, zf) {
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l / 2, ny = dx / l / 2;
      this.tri2(x0 + nx * w0, y0 + ny * w0, x1 + nx * w1, y1 + ny * w1, x1 - nx * w1, y1 - ny * w1, r, g, b, zf);
      this.tri2(x0 + nx * w0, y0 + ny * w0, x1 - nx * w1, y1 - ny * w1, x0 - nx * w0, y0 - ny * w0, r, g, b, zf);
    },
    geo(lit) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      if (lit) { g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); }
      return g;
    },
  };
}
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * What stays in a frame (unit square, centred): pieces from the frame toward the centre, long teeth between short stubs, a corner piece
 * held by two edges, runs where the glass fell right out of the putty. Translucent pieces (with doubled layers that read as reflections)
 * and, for the Lambert, the light fracture edge along their inner outline and a few cracks through the long teeth.
 */
function frameShape(k) {
  const rnd = seeded('vitres:frame:' + k), O = [], F = [], C4 = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  for (let s = 0; s < 4; s++) {
    const a = C4[s], b = C4[(s + 1) & 3];
    for (let t = 0; t < 0.95; t += 0.1 + rnd() * 0.15) { O.push(lerp2(a, b, t)); F.push(t === 0 ? -1 : 0); }
  }
  const N = O.length, clear = new Uint8Array(N), peakOf = new Uint8Array(N);
  for (let r = 0; r < 2; r++) { const s0 = Math.floor(rnd() * N), len = 1 + Math.floor(rnd() * 3); for (let j = 0; j < len; j++) clear[(s0 + j) % N] = 1; }
  let peak = rnd() < 0.5;
  for (let i = 0; i < N; i++) {
    let f;
    if (F[i] === -1) f = 0.15 + rnd() * 0.2;                                   // a corner keeps a piece: two edges hold it
    else if (clear[i]) f = 0.012 + rnd() * 0.012;                             // fell right out of the putty
    else if (peak) { f = 0.1 + Math.pow(rnd(), 1.3) * 0.36; peakOf[i] = 1; if (O[i][1] > 0.45) f *= 1.22; }       // a tooth (longer from the top: they hang)
    else f = 0.022 + rnd() * 0.05;                                             // a stub between two teeth
    F[i] = Math.min(0.55, f); peak = peakOf[i] ? false : rnd() < 0.78;
  }
  { let b = Math.floor(rnd() * N); for (let k = 0; k < N && (clear[b] || clear[(b + 1) % N]); k++) b = (b + 1) % N; F[b] = 0.3 + rnd() * 0.12; F[(b + 1) % N] = 0.28 + rnd() * 0.14; peakOf[b] = 1; }       // one broad piece still in place
  const I = O.map((o, i) => { const l = Math.hypot(o[0], o[1]) || 1, j = (rnd() - 0.5) * 0.07 * F[i]; return [o[0] * (1 - F[i]) - o[1] / l * j, o[1] * (1 - F[i]) + o[0] / l * j]; });
  const T = soup(), R = soup();
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, a = O[i], b = O[j], c = I[j], d = I[i];
    T.tri(a[0], a[1], b[0], b[1], c[0], c[1]); T.tri(a[0], a[1], c[0], c[1], d[0], d[1]);
    if (peakOf[i] && F[i] > 0.19 && rnd() < 0.7) {                            // a second layer on part of a long tooth: it reads as a reflection
      const p0 = lerp2(a, b, 0.2), p1 = lerp2(a, d, 0.78), p2 = lerp2(a, b, 0.5); T.tri(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1]);
      const h = (i + N - 1) % N, q0 = lerp2(O[h], a, 0.55), q1 = lerp2(a, d, 0.5), q2 = lerp2(O[h], a, 0.85); T.tri(q0[0], q0[1], q1[0], q1[1], q2[0], q2[1]);
    }
    const v = 0.86 + rnd() * 0.28, w = Math.max(F[i], F[j]) > 0.035 ? 0.01 : 0.006;
    R.seg(d[0], d[1], c[0], c[1], w, w, 0.42 * v, 0.52 * v, 0.5 * v, 0.004);
    if (peakOf[i] && F[i] > 0.22 && rnd() < 0.55) { const p0 = lerp2(a, b, 0.3 + rnd() * 0.3), p1 = lerp2(lerp2(a, d, 0.62), p0, 0.15); R.seg(p0[0], p0[1], p1[0], p1[1], 0.007, 0.003, 0.5, 0.58, 0.58, 0.004); }
  }
  return [T.geo(false), R.geo(true)];
}

/** Cracks around an impact (metres, centred, in the planes ±zf): the hole, the crushed ring, radial cracks, broken rings between them. */
function crackShape(seed, R, nRad, rings, wRad, zf) {
  const rnd = seeded(seed), S = soup(), K = 9, hole = [], crush = [];
  for (let i = 0; i < K; i++) { const a = i / K * 6.2832, r = 0.026 + rnd() * 0.016, h = 0.006 + rnd() * 0.004; hole.push([Math.cos(a) * h, Math.sin(a) * h]); crush.push([Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 0; i < K; i++) {
    const j = (i + 1) % K, h0 = hole[i], h1 = hole[j], c0 = crush[i], c1 = crush[j];
    S.tri2(0, 0, h0[0], h0[1], h1[0], h1[1], 0.1, 0.11, 0.12, zf);
    S.tri2(h0[0], h0[1], c0[0], c0[1], c1[0], c1[1], 1.65, 1.7, 1.75, zf); S.tri2(h0[0], h0[1], c1[0], c1[1], h1[0], h1[1], 1.65, 1.7, 1.75, zf);       // above 1: the crushed glass stays white in the shade
  }
  const rays = [];
  for (let i = 0; i < nRad; i++) {
    let a = (i + 0.2 + rnd() * 0.6) / nRad * 6.2832, x = Math.cos(a) * 0.02, y = Math.sin(a) * 0.02;
    const L = R * (0.38 + 0.62 * rnd()), steps = 3 + Math.floor(rnd() * 2), pts = [[x, y, 0]]; let d = 0;
    for (let s = 0; s < steps; s++) {
      a += (rnd() - 0.5) * 0.55; const l = (L - 0.02) / steps * (0.75 + rnd() * 0.5), nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l, d1 = d + l;
      const t0 = d / L, t1 = Math.min(1, d1 / L), v0 = 1.5 - 0.4 * t0, v1 = 1.5 - 0.4 * t1;
      S.seg(x, y, nx, ny, wRad * (1 - 0.62 * t0), wRad * (1 - 0.62 * t1), v0 * 0.97, v0, v0 * 1.02, zf); x = nx; y = ny; d = d1; pts.push([x, y, d]);
    }
    rays.push(pts);
  }
  const at = (pts, r) => { for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i]; if (q[2] >= r) { const t = (r - p[2]) / ((q[2] - p[2]) || 1); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; } } return null; };
  for (let k = 0; k < rings; k++) {
    const r0 = R * (rings > 2 ? [0.1, 0.22, 0.38, 0.6][k] : [0.13, 0.3][k]);
    for (let i = 0; i < nRad; i++) {
      if (rnd() > 0.72) continue; const p = at(rays[i], r0 * (0.88 + rnd() * 0.24)), q = at(rays[(i + 1) % nRad], r0 * (0.88 + rnd() * 0.24)); if (!p || !q) continue;
      S.seg(p[0], p[1], q[0], q[1], wRad * 0.7, wRad * 0.7, 1.2, 1.25, 1.28, zf);
    }
  }
  for (let i = 0; i < 7; i++) { const a = rnd() * 6.2832, r = 0.035 + rnd() * 0.03, s = 0.008 + rnd() * 0.008, x = Math.cos(a) * r, y = Math.sin(a) * r; S.tri2(x - s, y, x + s, y - s * 0.4, x, y + s, 1.7, 1.75, 1.8, zf); }       // chips round the hole
  return S.geo(true);
}

/** Glass on the floor (metres: x along the wall in [-0.5, 0.5], z away from it in [0, 1]): fine specks, denser at the wall, and a few larger pieces. */
function floorShape(k) {
  const rnd = seeded('vitres:floor:' + k), S = soup();
  for (let i = 0; i < 52; i++) {
    const z = 0.03 + Math.pow(rnd(), 1.8) * 0.94, x = (rnd() - 0.5) * (0.85 + 0.35 * z), s = 0.01 + rnd() * 0.02, a = rnd() * 6.2832, v = 0.48 + rnd() * 0.4;
    S.flat(x + Math.cos(a) * s, z + Math.sin(a) * s, x + Math.cos(a + 2.2) * s * 0.8, z + Math.sin(a + 2.2) * s * 0.8, x + Math.cos(a + 4.1) * s * 1.1, z + Math.sin(a + 4.1) * s * 1.1, v * 0.9, v, v * 1.02);
  }
  for (let i = 0; i < 9; i++) {
    const z = 0.04 + rnd() * 0.42, x = (rnd() - 0.5) * 0.85, s = 0.03 + rnd() * 0.045, a = rnd() * 6.2832, v = 0.6 + rnd() * 0.26, c = Math.cos(a), sn = Math.sin(a);
    const P = [[-s, -s * 0.3], [s * 0.9, -s * 0.45], [s * 0.6, s * 0.4], [-s * 0.4, s * 0.5]].map(([u, w]) => [x + u * c - w * sn, z + u * sn + w * c]);
    S.flat(P[0][0], P[0][1], P[1][0], P[1][1], P[2][0], P[2][1], v * 0.88, v, v * 1.03); S.flat(P[0][0], P[0][1], P[2][0], P[2][1], P[3][0], P[3][1], v * 0.88, v, v * 1.03);
  }
  return S.geo(true);
}

/* ---------- the glass of one map ---------- */
export function createGlass(ctx) {
  const { scene, grid, camera, lam } = ctx;
  const tintM = new THREE.MeshBasicMaterial({ color: 0xc4d9de, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });       // same parameters as the pane glass: same program
  const glintM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
  const geoTeeth = [], geoRim = [];
  for (let k = 0; k < VARS; k++) { const [t, r] = frameShape(k); geoTeeth.push(t); geoRim.push(r); }
  const geoCrack = crackShape('vitres:crack', CRACK_R, 9, 2, 0.014, 0.003), geoWeb = crackShape('vitres:web', WEB_R, 12, 3, 0.013, 0.5), geoFloor = [floorShape(0), floorShape(1)];
  const geoShard = (() => { const S = soup(), P = [[-0.055, -0.03], [0.048, -0.05], [0.066, 0.038], [-0.016, 0.072]]; S.tri2(P[0][0], P[0][1], P[1][0], P[1][1], P[2][0], P[2][1], 0.62, 0.72, 0.75, 0); S.tri2(P[0][0], P[0][1], P[2][0], P[2][1], P[3][0], P[3][1], 0.54, 0.65, 0.68, 0); return S.geo(true); })();
  const geoGlint = (() => { const S = soup(); S.tri(-0.5, 0, 0, 0.07, 0.5, 0); S.tri(-0.5, 0, 0.5, 0, 0, -0.07); S.tri(0, -0.5, 0.07, 0, 0, 0.5); S.tri(0, -0.5, 0, 0.5, -0.07, 0); return S.geo(false); })();
  const M = new THREE.Matrix4(), M2 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), AX = new THREE.Vector3(), NV = new THREE.Vector3(), HV = new THREE.Vector3();
  const SUN = new THREE.Vector3(0.3, 0.9, 0.3).normalize(), XAX = new THREE.Vector3(1, 0, 0), YAX = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  // shard pool
  const sP = new Float32Array(POOL * 3), sV = new Float32Array(POOL * 3), sA = new Float32Array(POOL * 3), sN = new Float32Array(POOL * 3), sQ = new Float32Array(POOL * 4);
  const sAng = new Float32Array(POOL), sW = new Float32Array(POOL), sL = new Float32Array(POOL), sF = new Float32Array(POOL), sX = new Float32Array(POOL), sY = new Float32Array(POOL), sSt = new Uint8Array(POOL), sB = new Uint8Array(POOL);
  let sHead = 0, sLive = 0, spawnN = 0, now = 0, on = true, sun = null, sunK = 1;
  let meshes = [], teeth = [], rims = [], crack = null, web = null, floor = [], shard = null, glint = null, panes = [];
  const tUsed = new Int32Array(VARS), fUsed = new Int32Array(2); let wUsed = 0, cUsed = 0, cTop = 0, cSteal = 0, cFree = new Int32Array(0), cOwner = [], fData = [null, null], pend = new Int32Array(0), nPend = 0;
  const SF = new Float32Array(2), SD = new Float32Array(2), SW = new Float32Array(2), SM = new Float32Array(2), SX = new Float32Array(2), SZ = new Float32Array(2);
  const hash = id => { let h = Math.imul(id + 1, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function mk(g, m, cap, lit, order) {
    const q = new THREE.InstancedMesh(g, m, Math.max(1, cap)); q.instanceMatrix.setUsage(THREE.DynamicDrawUsage); q.frustumCulled = false; q.castShadow = false; q.receiveShadow = !!lit;
    q.setMatrixAt(0, ZERO); q.count = 1; if (order) q.renderOrder = order; q.userData.used = 0; scene.add(q); meshes.push(q); return q;       // drawn once with nothing in it while the map warms: its program is linked with the map
  }
  const use = (q, n) => { q.userData.used = n; q.count = Math.max(1, n); q.visible = on && n > 0; q.instanceMatrix.needsUpdate = true; };
  function clear() { for (const q of meshes) { scene.remove(q); q.dispose(); } meshes = []; teeth = []; rims = []; crack = web = shard = glint = null; floor = []; panes = []; }

  /** The house pane's two sides: floor height, free distance, how wide and deep the glass on the floor can lie. */
  function sides(p) {
    const nx = p.ax === 'x' ? 0 : 1, nz = 1 - nx, ux = nz, uz = nx, half = (p.th > 0 ? p.th : 0.25) / 2 + 0.035, w = p.b - p.a, y = p.y0 + 0.05;
    for (let s = 0; s < 2; s++) {
      const sg = s ? -1 : 1, bx = p.cx + nx * sg * half, bz = p.cz + nz * sg * half, f0 = grid.floorAt(bx + nx * sg * 0.3, y, bz + nz * sg * 0.3, 0.3);
      const free = grid.ray(bx + nx * sg * 0.02, f0 + 0.1, bz + nz * sg * 0.02, nx * sg, 0, nz * sg, 3), mid = Math.min(1, Math.max(0.2, free - 0.1));
      const fl = grid.floorAt(bx + nx * sg * 0.2 - ux * w * 0.55, y, bz + nz * sg * 0.2 - uz * w * 0.55, 0.3), fr = grid.floorAt(bx + nx * sg * 0.2 + ux * w * 0.55, y, bz + nz * sg * 0.2 + uz * w * 0.55, 0.3), fm = grid.floorAt(bx + nx * sg * mid, y, bz + nz * sg * mid, 0.3);
      SF[s] = f0; SD[s] = free; SW[s] = Math.abs(fl - f0) > 0.05 || Math.abs(fr - f0) > 0.05 ? 0.7 : 1; SM[s] = Math.abs(fm - f0) > 0.05 ? 0.35 : 9; SX[s] = bx; SZ[s] = bz;       // a step, a table or a hole near the wall: the glass keeps to the wall
    }
  }
  function putFloor(k, slot, f) { const d = fData[k], o = slot * 7; V.set(d[o], d[o + 1], d[o + 2]); Q.setFromAxisAngle(YAX, d[o + 3]); S.set(d[o + 4] * f, 1, d[o + 5] * f); M.compose(V, Q, S); floor[k].setMatrixAt(slot, M); floor[k].instanceMatrix.needsUpdate = true; }
  function placeFloor(p, s, exit, live, h) {
    const k = (s + (h >>> 8)) & 1, q = floor[k]; if (!q || fUsed[k] >= q.instanceMatrix.count) return;
    const fall = Math.max(0, p.y0 - SF[s]), w = p.b - p.a, nx = p.ax === 'x' ? 0 : 1, nz = 1 - nx, sg = s ? -1 : 1;
    let depth = exit ? Math.min(1.9, 0.85 + 0.3 * fall) : Math.min(0.9, 0.4 + 0.12 * fall); depth = Math.min(depth, SD[s] - 0.08, SM[s]); if (depth < 0.18) return;
    const width = Math.min(w + 1.2, (exit ? w + 0.3 : w * 0.85) + 0.15 * fall) * SW[s], slot = fUsed[k], d = fData[k], o = slot * 7;
    d[o] = SX[s]; d[o + 1] = SF[s] + 0.006; d[o + 2] = SZ[s]; d[o + 3] = Math.atan2(nx * sg, nz * sg) + (((h >>> 10) % 100) / 100 - 0.5) * 0.16; d[o + 4] = width; d[o + 5] = depth;
    d[o + 6] = live ? now + 0.75 * Math.sqrt(2 * Math.max(0.2, p.cy - SF[s]) / GRAV) : -1;
    use(q, slot + 1); fUsed[k] = slot + 1;
    if (!live) putFloor(k, slot, 1); else { q.setMatrixAt(slot, ZERO); if (nPend < pend.length) pend[nPend++] = slot * 2 + k; }       // it lands with the shards
  }
  function stepFloor() {
    for (let j = nPend - 1; j >= 0; j--) {
      const e = pend[j], k = e & 1, slot = e >> 1, t = now - fData[k][slot * 7 + 6]; if (t < 0) continue;
      const f = t >= 0.55 ? 1 : 0.3 + 0.7 * t / 0.55; putFloor(k, slot, f); if (f >= 1) pend[j] = pend[--nPend];
    }
  }

  /* ---------- shards ---------- */
  function spawn(x, y, z, vx, vy, vz, fy, sc) {
    const i = sHead; sHead = (sHead + 1) % POOL; if (!sSt[i]) sLive++;
    const k = i * 3, rnd = Math.random; sP[k] = x; sP[k + 1] = y; sP[k + 2] = z; sV[k] = vx; sV[k + 1] = vy; sV[k + 2] = vz; sF[i] = fy;
    AX.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5); if (AX.lengthSq() < 1e-4) AX.set(0, 1, 0); AX.normalize(); sA[k] = AX.x; sA[k + 1] = AX.y; sA[k + 2] = AX.z;
    sAng[i] = rnd() * 6.2832; sW[i] = (8 + rnd() * 16) * (rnd() < 0.5 ? -1 : 1) * (sc < 0.9 ? 1.4 : 1); sX[i] = sc * (0.6 + rnd()); sY[i] = sc * (0.6 + rnd());
    const tl = rnd() * 0.62, az = rnd() * 6.2832; sN[k] = Math.sin(tl) * Math.cos(az); sN[k + 1] = Math.cos(tl); sN[k + 2] = Math.sin(tl) * Math.sin(az);       // the facet that may catch the sun once it lies
    Q.setFromAxisAngle(YAX, rnd() * 6.2832); Q2.setFromAxisAngle(XAX, -Math.PI / 2); Q.multiply(Q2); sQ[i * 4] = Q.x; sQ[i * 4 + 1] = Q.y; sQ[i * 4 + 2] = Q.z; sQ[i * 4 + 3] = Q.w;
    sSt[i] = 1; sB[i] = 0; sL[i] = 0; if (shard) shard.visible = on; if (glint) glint.visible = on;
  }
  /** A house window: most of the glass goes the bullet's way (exit side), some falls back, the lowest pieces stay on the sill. */
  function burstHouse(p, exit, blast) {
    const nx = p.ax === 'x' ? 0 : 1, nz = 1 - nx, ux = nz, uz = nx, w = p.b - p.a, hg = p.h, half = (p.th > 0 ? p.th : 0.25) / 2, rnd = Math.random;
    let n = Math.round(Math.min(24, 10 + w * hg * 9)); if (spawnN > SPAWN_FRAME) n = 4; else if (spawnN > SPAWN_FRAME / 2) n = Math.min(n, 8); spawnN += n;       // a blast through a whole street: fewer each
    for (let j = 0; j < n; j++) {
      const sill = j < n * 0.15, s = sill ? (rnd() < 0.5 ? 0 : 1) : (rnd() < (blast ? 0.85 : 0.62) ? exit : 1 - exit), sg = s ? -1 : 1;
      const u = (rnd() - 0.5) * w * 0.82, v = sill ? -hg * (0.12 + rnd() * 0.32) : (rnd() - 0.5) * hg * 0.8, x = p.cx + ux * u, y = p.cy + v, z = p.cz + uz * u;
      const vy = blast ? rnd() * 1.8 - 0.2 : rnd() * 0.9 - 0.35, tS = (vy + Math.sqrt(vy * vy + 2 * GRAV * Math.max(0.02, y - p.y0))) / GRAV;       // time to drop to the sill
      let out, fy;
      if (sill) { out = Math.min(0.05 + rnd() * 0.25, (half + 0.03) / tS); fy = p.y0 + 0.004; }
      else {
        fy = SF[s] + 0.004; const need = (half + 0.06) / tS;       // clears the wall face before it drops below the sill
        out = s === exit ? (blast ? 2.6 + rnd() * 4 : 0.7 + rnd() * 2.2) : 0.35 + rnd() * 0.9; if (out < need) out = need;
        const tF = (vy + Math.sqrt(vy * vy + 2 * GRAV * Math.max(0.02, y - fy))) / GRAV, room = half + Math.max(0, SD[s] - 0.12); if (out * tF > room) out = room / tF;
        if (out < need) { fy = p.y0 + 0.004; out = Math.min(out, (half + 0.03) / tS); }       // no room on that side: it stays on the sill
      }
      const lat = (rnd() - 0.5) * 0.7 + u * 0.5;
      spawn(x + nx * sg * 0.02, y, z + nz * sg * 0.02, nx * sg * out + ux * lat, vy, nz * sg * out + uz * lat, fy, blast ? 0.8 : 1);
    }
  }
  /** Vehicle glass holds together (laminated): a few chips only. */
  function burstDecor(p, sg) {
    const rnd = Math.random, fy = grid.floorAt(p.cx + p.nx * sg * 0.6, p.cy - 0.1, p.cz + p.nz * sg * 0.6, 0.1) + 0.004; spawnN += 5;
    for (let j = 0; j < 5; j++) { const u = (rnd() - 0.5) * p.hw, v = (rnd() - 0.5) * p.hh, out = 0.3 + rnd() * 0.9, lat = (rnd() - 0.5) * 0.5; spawn(p.cx + p.ux * u + p.nx * sg * 0.03, p.cy + v, p.cz + p.uz * u + p.nz * sg * 0.03, p.nx * sg * out + p.ux * lat, rnd() * 0.8, p.nz * sg * out + p.uz * lat, fy, 0.7); }
  }

  /* ---------- cracks ---------- */
  /** M = translation · turn about Y · scale in the pane's axes · spin in the pane: the scale bounds hold whatever the spin. */
  function planeMatrix(x, y, z, yaw, sx, sy, sz, spin) { M.makeRotationZ(spin); M2.makeScale(sx, sy, sz); M.premultiply(M2); M2.makeRotationY(yaw); M.premultiply(M2); M.setPosition(x, y, z); return M; }
  function freeCrack(p) { if (!(p.gC >= 0) || !crack) return; crack.setMatrixAt(p.gC, ZERO); crack.instanceMatrix.needsUpdate = true; cOwner[p.gC] = null; cFree[cTop++] = p.gC; p.gC = -1; }
  function webAt(p) {
    if (p.gW >= 0 || !web || wUsed >= web.instanceMatrix.count) return;
    const h = hash(p.id), fresh = p.hT > now - 1.5, mu = Math.max(0, p.hw - 0.16), mv = Math.max(0, p.hh - 0.1);
    const u = clamp(fresh ? p.hu : (((h >>> 7) % 101) / 100 - 0.5) * p.hw * 0.9, -mu, mu), v = clamp(fresh ? p.hv : (((h >>> 15) % 101) / 100 - 0.5) * p.hh * 0.7, -mv, mv);
    const sw = clamp(Math.min(p.hw - Math.abs(u), p.hh - Math.abs(v)) / WEB_R, 0.45, 1.5), slot = wUsed; p.gW = slot; planeMatrix(p.cx + p.ux * u, p.cy + v, p.cz + p.uz * u, Math.atan2(p.nx, p.nz), sw, sw, (p.th || 0.02) + 0.012, ((h >>> 20) % 628) / 100);
    web.setMatrixAt(slot, M); wUsed = slot + 1; use(web, wUsed);
  }

  return {
    get now() { return now; },
    /** Right after the props of a new map: one set of meshes for its panes and glazing. */
    attach(list, nWin, nGlaz) {
      clear(); panes = list; tUsed.fill(0); fUsed.fill(0); wUsed = 0; cUsed = 0; nPend = 0; sLive = 0; sHead = 0; sSt.fill(0); now = 0;
      sun = null; scene.traverse(o => { if (!sun && o.isDirectionalLight) sun = o; }); sunK = sun && sun.visible && sun.intensity > 0.3 ? 1 : 0.35;       // no sun (the bunker): the glints stay faint
      for (const p of list) { p.gS = -1; p.gC = -1; p.gW = -1; p.gV = 0; p.hT = -1e9; p.hu = 0; p.hv = 0; p.cracked = false; }
      if (nWin) {
        for (let k = 0; k < VARS; k++) { teeth.push(mk(geoTeeth[k], tintM, nWin, false, 3)); rims.push(mk(geoRim[k], lam, nWin, true)); }
        const cc = Math.min(nWin, CRACK_MAX); crack = mk(geoCrack, lam, cc, true); cFree = new Int32Array(cc); cOwner = new Array(cc).fill(null); cTop = 0; for (let i = cc - 1; i >= 0; i--) cFree[cTop++] = i; cSteal = 0;
        for (let k = 0; k < 2; k++) { floor.push(mk(geoFloor[k], lam, nWin, true)); fData[k] = new Float32Array(nWin * 7); }
        pend = new Int32Array(nWin * 2); glint = mk(geoGlint, glintM, POOL, false, 4);
      }
      if (nGlaz) web = mk(geoWeb, lam, nGlaz, true);
      shard = mk(geoShard, lam, POOL, true); for (let i = 1; i < POOL; i++) shard.setMatrixAt(i, ZERO); shard.count = POOL;
      if (glint) { for (let i = 1; i < POOL; i++) glint.setMatrixAt(i, ZERO); glint.count = POOL; }
    },
    clear,
    /** Round start: every pane whole again. */
    reset() {
      for (const q of meshes) { q.setMatrixAt(0, ZERO); if (q !== shard && q !== glint) use(q, 0); }
      for (let i = 0; i < POOL; i++) { sSt[i] = 0; if (shard) shard.setMatrixAt(i, ZERO); if (glint) glint.setMatrixAt(i, ZERO); }
      for (const q of [shard, glint]) if (q) { q.visible = false; q.instanceMatrix.needsUpdate = true; }
      tUsed.fill(0); fUsed.fill(0); wUsed = 0; cUsed = 0; nPend = 0; sLive = 0;
      if (crack) { cTop = 0; for (let i = cFree.length - 1; i >= 0; i--) { cFree[cTop++] = i; cOwner[i] = null; } }
      for (const p of panes) { p.gS = -1; p.gC = -1; p.gW = -1; p.cracked = false; p.hT = -1e9; }
    },
    setVisible(v) { on = !!v; for (const q of meshes) q.visible = on && (q === shard || q === glint ? sLive > 0 : q.userData.used > 0); },
    /** A bullet's first hit on a house window: the crack star where it went through. */
    crack(p, x, y, z) {
      if (!crack || p.decor || p.broken || p.gC >= 0) return;
      let slot; if (cTop > 0) slot = cFree[--cTop]; else { slot = cSteal; cSteal = (cSteal + 1) % cFree.length; const o = cOwner[slot]; if (o) o.gC = -1; }       // more cracked panes than the pool: the oldest loses its star
      const ux = p.ax === 'x' ? 1 : 0, uz = p.ax === 'x' ? 0 : -1, hw = (p.b - p.a) / 2, hh = p.h / 2;
      const u = clamp((x - p.cx) * ux + (z - p.cz) * uz, -Math.max(0, hw - 0.18), Math.max(0, hw - 0.18)), v = clamp(y - p.cy, -Math.max(0, hh - 0.18), Math.max(0, hh - 0.18)), sc = clamp(Math.min(hw - Math.abs(u), hh - Math.abs(v)) / CRACK_R, 0.5, 1);       // one scale: the lines keep their width
      planeMatrix(p.cx + ux * u, p.cy + v, p.cz + uz * u, p.ax === 'x' ? 0 : Math.PI / 2, sc, sc, 1, Math.random() * 6.2832);
      crack.setMatrixAt(slot, M); cOwner[slot] = p; p.gC = slot; if (slot + 1 > cUsed) cUsed = slot + 1; use(crack, cUsed);
    },
    /** A pane broke (live: this frame, with the fall; otherwise a state from the server). dx, dz: the way it was hit (0, 0: unknown). */
    shatter(p, dx, dz, live, blast) {
      if (p.decor) { webAt(p); if (live) burstDecor(p, dx * p.nx + dz * p.nz >= 0 ? 1 : -1); return; }
      if (!teeth.length || p.gS >= 0) return; freeCrack(p);
      const h = hash(p.id), k = h % VARS, slot = tUsed[k]; if (slot >= teeth[k].instanceMatrix.count) return;
      Q.setFromAxisAngle(YAX, p.ax === 'x' ? 0 : Math.PI / 2); if ((h >>> 4) & 1) { Q2.setFromAxisAngle(ZAX, Math.PI); Q.multiply(Q2); }       // half of them turned over in their frame (never mirrored: the lit edge keeps its faces)
      V.set(p.cx, p.cy, p.cz); S.set((p.b - p.a) * 1.02, p.h * 1.02, 1); M.compose(V, Q, S); teeth[k].setMatrixAt(slot, M); rims[k].setMatrixAt(slot, M);
      p.gV = k; p.gS = slot; tUsed[k] = slot + 1; use(teeth[k], slot + 1); use(rims[k], slot + 1);
      sides(p); const dn = p.ax === 'x' ? dz : dx, exit = dn > 0 ? 0 : dn < 0 ? 1 : (h >>> 6) & 1;
      for (let s = 0; s < 2; s++) placeFloor(p, s, s === exit, live, h);
      if (live) burstHouse(p, exit, !!blast);
    },
    update(dt) {
      now += dt; spawnN = 0; if (nPend) stepFloor();
      if (!sLive || !shard) return;
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      if (sun) { SUN.copy(sun.position).sub(sun.target.position); if (SUN.lengthSq() > 1e-6) SUN.normalize(); else SUN.set(0, 1, 0); }
      let live = 0, moved = false;
      for (let i = 0; i < POOL; i++) {
        const st = sSt[i]; if (!st) continue; const k = i * 3, q4 = i * 4;
        if (st === 1) {
          sV[k + 1] -= GRAV * dt; sP[k] += sV[k] * dt; sP[k + 1] += sV[k + 1] * dt; sP[k + 2] += sV[k + 2] * dt; sAng[i] += sW[i] * dt;
          if (sP[k + 1] <= sF[i]) {
            sP[k + 1] = sF[i];
            if (sV[k + 1] < -1.2 && sB[i] < 2) { sV[k + 1] *= -0.3; sV[k] *= 0.45; sV[k + 2] *= 0.45; sW[i] *= 0.55; sB[i]++; }       // a small bounce
            else { sSt[i] = 2; sL[i] = REST + Math.random() * REST_RND; }       // lies flat
          }
          if (sSt[i] === 1) { AX.set(sA[k], sA[k + 1], sA[k + 2]); Q.setFromAxisAngle(AX, sAng[i]); NV.set(0, 0, 1).applyQuaternion(Q); }
          else { Q.set(sQ[q4], sQ[q4 + 1], sQ[q4 + 2], sQ[q4 + 3]); NV.set(sN[k], sN[k + 1], sN[k + 2]); }
          V.set(sP[k], sP[k + 1], sP[k + 2]); S.set(sX[i], sY[i], 1); M.compose(V, Q, S); shard.setMatrixAt(i, M); moved = true;
        } else {
          sL[i] -= dt;
          if (sL[i] <= 0) { sSt[i] = 0; shard.setMatrixAt(i, ZERO); if (glint) glint.setMatrixAt(i, ZERO); moved = true; continue; }
          if (sL[i] < FADE) { const f = sL[i] / FADE; Q.set(sQ[q4], sQ[q4 + 1], sQ[q4 + 2], sQ[q4 + 3]); V.set(sP[k], sP[k + 1], sP[k + 2]); S.set(sX[i] * f, sY[i] * f, 1); M.compose(V, Q, S); shard.setMatrixAt(i, M); moved = true; }
          NV.set(sN[k], sN[k + 1], sN[k + 2]);
        }
        live++;
        if (glint) {       // a sun glint where the shard's face sits between the sun and the eye
          HV.set(cx - sP[k], cy - sP[k + 1], cz - sP[k + 2]); const d2 = HV.lengthSq(); let g = 0;
          if (d2 < 1600 && d2 > 1e-4) { HV.multiplyScalar(1 / Math.sqrt(d2)).add(SUN).normalize(); g = Math.abs(NV.dot(HV)); g = g * g; g = g * g; g = g * g; g = g * g * g; }       // power 24
          if (g > 0.08 && (st === 1 || sL[i] > FADE)) { V.set(sP[k], sP[k + 1] + 0.006, sP[k + 2]); const s = (0.04 + 0.1 * g) * sunK; S.set(s, s, s); M.compose(V, camera.quaternion, S); glint.setMatrixAt(i, M); }
          else glint.setMatrixAt(i, ZERO);
        }
      }
      sLive = live; if (moved) shard.instanceMatrix.needsUpdate = true; if (glint) glint.instanceMatrix.needsUpdate = true;
      if (!live) { shard.visible = false; if (glint) glint.visible = false; }       // nothing alive: no draw call
    },
    /** For tests and the report. */
    stats() { return { sun: !!sun, sunK, live: sLive, teeth: Array.from(tUsed), floor: Array.from(fUsed), cracks: cOwner.filter(Boolean).length, crackSlots: cUsed, webs: wUsed, pend: nPend, meshes: meshes.length, visible: meshes.filter(q => q.visible).length }; },
  };
}
