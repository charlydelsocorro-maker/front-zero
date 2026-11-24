// FRONT ZÉRO — engine helper: uniform spatial grid over the world solids (AABB {x0,x1,y0,y1,z0,z1,surface})
// plus the character mover (step-up, ground snap, sub-stepping). No allocation in any query.
const EPS = 1e-3;
export const STEP_H = 0.32;

export function createGrid(cell = 4) {
  let S = [], inv = 1 / cell, gx0 = 0, gz0 = 0, nx = 1, nz = 1;
  let start = new Int32Array(2), items = new Int32Array(0), stamp = new Int32Array(0), sid = 0;
  const cx = v => { const i = Math.floor((v - gx0) * inv); return i < 0 ? 0 : i >= nx ? nx - 1 : i; };
  const cz = v => { const i = Math.floor((v - gz0) * inv); return i < 0 ? 0 : i >= nz ? nz - 1 : i; };

  function rayBox(ox, oy, oz, dx, dy, dz, b) {
    let t0 = 0, t1 = 1e9, u, v, w;
    if (dx > -1e-7 && dx < 1e-7) { if (ox < b.x0 || ox > b.x1) return Infinity; }
    else { u = (b.x0 - ox) / dx; v = (b.x1 - ox) / dx; if (u > v) { w = u; u = v; v = w; } if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) return Infinity; }
    if (dy > -1e-7 && dy < 1e-7) { if (oy < b.y0 || oy > b.y1) return Infinity; }
    else { u = (b.y0 - oy) / dy; v = (b.y1 - oy) / dy; if (u > v) { w = u; u = v; v = w; } if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) return Infinity; }
    if (dz > -1e-7 && dz < 1e-7) { if (oz < b.z0 || oz > b.z1) return Infinity; }
    else { u = (b.z0 - oz) / dz; v = (b.z1 - oz) / dz; if (u > v) { w = u; u = v; v = w; } if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) return Infinity; }
    return t0;
  }

  const g = {
    hit: null, ground: false, rayBox, skipPane: false,       // skipPane: intact glass is transparent to this ray (sight lines, blast cover, mirrored projectiles)
    get cells() { return nx * nz; }, get size() { return S.length; },
    /** Rebuild over a solids array (kept by reference). Call on every map load. */
    build(solids) {
      S = solids || [];
      let ax = Infinity, bx = -Infinity, az = Infinity, bz = -Infinity;
      for (let i = 0; i < S.length; i++) { const s = S[i]; if (s.x0 < ax) ax = s.x0; if (s.x1 > bx) bx = s.x1; if (s.z0 < az) az = s.z0; if (s.z1 > bz) bz = s.z1; }
      if (!S.length) { ax = az = -50; bx = bz = 50; }
      ax = Math.max(ax, -500); az = Math.max(az, -500); bx = Math.min(bx, 500); bz = Math.min(bz, 500);
      gx0 = ax - 1; gz0 = az - 1; nx = Math.max(1, Math.ceil((bx - ax + 2) * inv)); nz = Math.max(1, Math.ceil((bz - az + 2) * inv));
      const cnt = new Int32Array(nx * nz + 1);
      for (let i = 0; i < S.length; i++) { const s = S[i], i0 = cx(s.x0), i1 = cx(s.x1), j0 = cz(s.z0), j1 = cz(s.z1); for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) cnt[j * nx + k + 1]++; }
      for (let c = 0; c < nx * nz; c++) cnt[c + 1] += cnt[c];
      start = cnt.slice(); items = new Int32Array(cnt[nx * nz]);
      const cur = cnt.slice();
      for (let i = 0; i < S.length; i++) { const s = S[i], i0 = cx(s.x0), i1 = cx(s.x1), j0 = cz(s.z0), j1 = cz(s.z1); for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) items[cur[j * nx + k]++] = i; }
      stamp = new Int32Array(S.length); sid = 0;
    },
    /** Unique solids whose cells touch the XZ rectangle; fills `out`, returns the count. */
    boxQuery(x0, x1, z0, z1, out) {
      const i0 = cx(x0), i1 = cx(x1), j0 = cz(z0), j1 = cz(z1); let n = 0;
      if (i0 === i1 && j0 === j1) { const c = j0 * nx + i0; for (let k = start[c], e = start[c + 1]; k < e; k++) out[n++] = S[items[k]]; return n; }
      const id = ++sid;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = j * nx + i; for (let k = start[c], e = start[c + 1]; k < e; k++) { const si = items[k]; if (stamp[si] !== id) { stamp[si] = id; out[n++] = S[si]; } } }
      return n;
    },
    /** Distance to the first solid (or the ground plane y=0) along a normalised ray; `max` when nothing is hit. Sets g.hit / g.ground. */
    ray(ox, oy, oz, dx, dy, dz, max) {
      let best = max; g.hit = null; g.ground = false;
      if (dy < 0) { const tg = -oy / dy; if (tg < best) { best = tg < 0 ? 0 : tg; g.ground = true; } }
      const lx = ox - gx0, lz = oz - gz0;
      if (lx < 0 || lz < 0 || lx >= nx * cell || lz >= nz * cell) {       // origin outside the grid: rare, brute force
        for (let i = 0; i < S.length; i++) { if (g.skipPane && S[i].pane) continue; const t = rayBox(ox, oy, oz, dx, dy, dz, S[i]); if (t < best) { best = t; g.hit = S[i]; g.ground = false; } }
        return best;
      }
      let ix = Math.floor(lx * inv), iz = Math.floor(lz * inv);
      const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
      const adx = dx < 0 ? -dx : dx, adz = dz < 0 ? -dz : dz;
      let tx = adx > 1e-9 ? ((ix + (dx > 0 ? 1 : 0)) * cell - lx) / dx : Infinity, tz = adz > 1e-9 ? ((iz + (dz > 0 ? 1 : 0)) * cell - lz) / dz : Infinity;
      const ddx = adx > 1e-9 ? cell / adx : Infinity, ddz = adz > 1e-9 ? cell / adz : Infinity;
      const id = ++sid;
      while (ix >= 0 && ix < nx && iz >= 0 && iz < nz) {
        const c = iz * nx + ix;
        for (let k = start[c], e = start[c + 1]; k < e; k++) {
          const si = items[k]; if (stamp[si] === id) continue; stamp[si] = id;
          if (g.skipPane && S[si].pane) continue;
          const t = rayBox(ox, oy, oz, dx, dy, dz, S[si]); if (t < best) { best = t; g.hit = S[si]; g.ground = false; }
        }
        const te = tx < tz ? tx : tz;
        if (best <= te || te > max) break;
        if (tx < tz) { ix += sx; tx += ddx; } else { iz += sz; tz += ddz; }
      }
      return best;
    },
    /** Line of sight between two points. */
    los(ax, ay, az, bx, by, bz) {
      const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-4) return true;
      const was = g.skipPane; g.skipPane = true; const r = g.ray(ax, ay, az, dx / d, dy / d, dz / d, d); g.skipPane = was;       // one can see through a window
      return r >= d - 0.02;
    },
    /** Any solid overlapping the box? Returns it, or null. */
    overlap(x0, x1, y0, y1, z0, z1, buf) {
      const n = g.boxQuery(x0, x1, z0, z1, buf);
      for (let i = 0; i < n; i++) { const c = buf[i]; if (x1 > c.x0 && x0 < c.x1 && z1 > c.z0 && z0 < c.z1 && y0 < c.y1 - EPS && y1 > c.y0 + EPS) return c; }
      return null;
    },
    /** Solids near a point, for ragdoll colliders. Fills and truncates `out`. */
    gather(x, y, z, r, out) {
      const n = g.boxQuery(x - r, x + r, z - r, z + r, gbuf); let m = 0;
      for (let i = 0; i < n && m < 60; i++) { const c = gbuf[i]; if (c.x1 < x - r || c.x0 > x + r || c.z1 < z - r || c.z0 > z + r || c.y1 < y - r - 1 || c.y0 > y + r) continue; out[m++] = c; }
      out.length = m; return out;
    },
    /** Highest solid top under the point at or below y+tol (the ground plane counts as 0). Sets g.hit. */
    floorAt(x, y, z, tol = 0.25) {
      const n = g.boxQuery(x, x, z, z, gbuf); let top = 0; g.hit = null;
      for (let i = 0; i < n; i++) { const c = gbuf[i]; if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && c.y1 <= y + tol && c.y1 > top) { top = c.y1; g.hit = c; } }
      return top;
    },
  };
  const gbuf = [];
  return g;
}

/** Eases the visual step offset back to zero with a critically damped spring: position and speed stay continuous across stairs, at any frame rate. */
export function settleStep(b, dt, w = 17) {
  const x = b.stepOff, v = b.stepV || 0, e = Math.exp(-w * dt), j = (v + w * x) * dt;
  b.stepOff = (x + j) * e; b.stepV = (v - w * j) * e;
  if (Math.abs(b.stepOff) < 5e-4 && Math.abs(b.stepV) < 5e-3) { b.stepOff = 0; b.stepV = 0; }
}

/** Character mover on AABB solids. Body: {pos:{x,y,z}, r, h, vy, grounded, ground, stepOff, ceil}. */
export function createMover(g) {
  const A = [], B = [];
  function blocked(x, y, z, r, h) {
    const n = g.boxQuery(x - r, x + r, z - r, z + r, B);
    for (let i = 0; i < n; i++) { const c = B[i]; if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1 && y < c.y1 - EPS && y + h > c.y0 + EPS) return c; }
    return null;
  }
  const ov = (p, r, h, c) => p.x + r > c.x0 && p.x - r < c.x1 && p.z + r > c.z0 && p.z - r < c.z1 && p.y < c.y1 - EPS && p.y + h > c.y0 + EPS;
  function depen(b, c) {
    const p = b.pos, r = b.r, up = c.y1 - p.y;
    const a0 = p.x + r - c.x0, a1 = c.x1 - (p.x - r), b0 = p.z + r - c.z0, b1 = c.z1 - (p.z - r);
    const m = Math.min(a0, a1, b0, b1);
    if (up <= m && up < 1 && !blocked(p.x, c.y1, p.z, r, b.h)) { if (up > 0) b.stepOff += up; p.y = c.y1; if (b.vy < 0) b.vy = 0; b.grounded = true; b.ground = c; return; }
    if (m === a0) p.x = c.x0 - r - EPS; else if (m === a1) p.x = c.x1 + r + EPS; else if (m === b0) p.z = c.z0 - r - EPS; else p.z = c.z1 + r + EPS;
  }
  function axis(b, ax, d) {
    if (d === 0) return false;
    const p = b.pos, r = b.r, h = b.h, o = ax === 0 ? p.x : p.z; if (ax === 0) p.x += d; else p.z += d;   // o: pre-move coordinate, a push-out never goes past it
    const n = g.boxQuery(p.x - r, p.x + r, p.z - r, p.z + r, A); let stepTo = -1, bump = false;
    for (let i = 0; i < n; i++) {
      const c = A[i]; if (!ov(p, r, h, c)) continue;
      const rise = c.y1 - p.y;
      if (rise > 0 && rise <= STEP_H + EPS) { if (c.y1 > stepTo) stepTo = c.y1; continue; }
      if (ax === 0) p.x = d > 0 ? Math.max(c.x0 - r - EPS, o) : Math.min(c.x1 + r + EPS, o); else p.z = d > 0 ? Math.max(c.z0 - r - EPS, o) : Math.min(c.z1 + r + EPS, o);
      bump = true;
    }
    if (stepTo >= 0) {
      let need = false;
      for (let i = 0; i < n; i++) if (ov(p, r, h, A[i])) { need = true; break; }
      if (need) {
        if (!blocked(p.x, stepTo, p.z, r, h)) { b.stepOff += stepTo - p.y; p.y = stepTo; if (b.vy < 0) b.vy = 0; b.grounded = true; }
        else for (let i = 0; i < n; i++) { const c = A[i]; if (!ov(p, r, h, c)) continue; if (ax === 0) p.x = d > 0 ? Math.max(c.x0 - r - EPS, o) : Math.min(c.x1 + r + EPS, o); else p.z = d > 0 ? Math.max(c.z0 - r - EPS, o) : Math.min(c.z1 + r + EPS, o); bump = true; }
      }
    }
    return bump;
  }
  function vert(b, dy) {
    const p = b.pos, r = b.r, h = b.h, prev = p.y; p.y += dy; b.grounded = false; b.ground = null;
    if (p.y <= 0) { p.y = 0; if (b.vy < 0) b.vy = 0; b.grounded = true; }
    const n = g.boxQuery(p.x - r, p.x + r, p.z - r, p.z + r, A);
    for (let i = 0; i < n; i++) {
      const c = A[i]; if (!ov(p, r, h, c)) continue;
      if (dy <= 0 && prev >= c.y1 - STEP_H - EPS) { if (c.y1 > prev) b.stepOff += c.y1 - prev; p.y = c.y1; if (b.vy < 0) b.vy = 0; b.grounded = true; b.ground = c; }
      else if (dy > 0 && prev + h <= c.y0 + 0.06) { p.y = c.y0 - h - EPS; if (b.vy > 0) b.vy = 0; b.ceil = true; }
      else depen(b, c);
    }
  }
  function snap(b) {
    const p = b.pos, r = b.r; let top = p.y <= STEP_H + 0.05 ? 0 : -1, gs = null;
    const n = g.boxQuery(p.x - r, p.x + r, p.z - r, p.z + r, A);
    for (let i = 0; i < n; i++) { const c = A[i]; if (p.x + r > c.x0 && p.x - r < c.x1 && p.z + r > c.z0 && p.z - r < c.z1 && c.y1 <= p.y + EPS && c.y1 >= p.y - STEP_H - 0.05 && c.y1 > top) { top = c.y1; gs = c; } }
    if (top < 0) return false;
    b.stepOff -= p.y - top; p.y = top; b.vy = 0; b.grounded = true; b.ground = gs; return true;
  }
  return {
    blocked,
    /** Moves the body by (dx,dy,dz), sub-stepped so nothing tunnels. Returns true when a wall was hit. */
    move(b, dx, dy, dz, noSnap) {
      const m = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)), n = m > 0.3 ? Math.min(16, Math.ceil(m / 0.3)) : 1, was = b.grounded;
      let bump = false; b.ceil = false;
      for (let i = 0; i < n; i++) { if (axis(b, 0, dx / n)) bump = true; if (axis(b, 1, dz / n)) bump = true; vert(b, dy / n); }
      if (was && !b.grounded && b.vy <= 0 && !noSnap) snap(b);
      for (let k = 0; k < 3; k++) { const c = blocked(b.pos.x, b.pos.y, b.pos.z, b.r, b.h); if (!c) break; depen(b, c); }
      if (b.stepOff > 0.7) b.stepOff = 0.7; else if (b.stepOff < -0.7) b.stepOff = -0.7;
      return bump;
    },
  };
}
