// FRONT ZÉRO — engine helper: layered navigation grid (ground + upper floors + stairs) and A*.
// Built from the solids through the spatial grid on every map load.
const CS = 0.5, CL = 0.4, HH = 1.7, ST = 0.32, MAXH = 16;
/* [fin] règle de pente (engine-grid STEP_T) : un solide `slope` (herbe, terre, pavés d'une grille de relief) se gravit jusqu'à 0,5 m par case ; ailleurs ST. */
const STS = 0.5;
const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1];
const COST = [1, 1, 1, 1, 1.4142, 1.4142, 1.4142, 1.4142];

export function createNav(grid) {
  let N = 0, half = 0, n = 0;
  let cellFirst = new Int32Array(0), cellCnt = new Uint8Array(0), nCell = new Int32Array(0), nH = new Float32Array(0), nei = new Int32Array(0);
  let gS = new Float32Array(0), fS = new Float32Array(0), par = new Int32Array(0), st = new Int32Array(0), heap = new Int32Array(0), sid = 0;
  let ground = new Int32Array(0), levelFn = null; /* cartes à rues surélevées : le « sol » est la surface principale donnée par la carte (world.levelAt), pas y=0 */ const isG = i => (levelFn ? Math.abs(nH[i] - levelFn(nodeX(i), nodeZ(i))) <= 0.4 : nH[i] <= 0.35);
  const buf = [], cand = [];
  const nodeX = i => -half + ((nCell[i] % N) + 0.5) * CS, nodeZ = i => -half + (Math.floor(nCell[i] / N) + 0.5) * CS;
  const cellOf = (x, z) => { const cx = Math.floor((x + half) / CS), cz = Math.floor((z + half) / CS); return cx < 0 || cz < 0 || cx >= N || cz >= N ? -1 : cz * N + cx; };

  /** Valid standing height in [lo,hi] at (x,z) with a footprint half-width r, or -1. */
  function standH(x, z, lo, hi, r) {
    const k = grid.boxQuery(x - r, x + r, z - r, z + r, buf); let best = -1;
    for (let c = -1; c < k; c++) {
      const h = c < 0 ? 0 : buf[c].y1;
      if (c >= 0) { const s = buf[c]; if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue; }
      if (h < lo - 1e-3 || h > hi + 1e-3) continue;
      let ok = true;
      for (let i = 0; i < k; i++) { const s = buf[i]; if (x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1 && s.y1 > h + (s.slope ? STS : ST) && s.y0 < h + HH) { ok = false; break; } }
      if (ok && h > best) best = h;
    }
    return best;
  }
  function find(cell, h, tol) {
    let best = -1, bd = tol + 1e-3;
    for (let i = cellFirst[cell], e = i + cellCnt[cell]; i < e; i++) { const d = Math.abs(nH[i] - h); if (d <= bd) { bd = d; best = i; } }
    return best;
  }

  // Built grids are kept per map id (the solids of a map never change within a session): replaying a map restores it instantly.
  const cache = new Map();
  function scratch() { gS = new Float32Array(n); fS = new Float32Array(n); par = new Int32Array(n); st = new Int32Array(n); heap = new Int32Array(n + 1); sid = 0; nav.ready = n > 0; nav.nodes = n; }
  function build(size, spawns, key) { const g = buildSteps(size, spawns, key); while (!g.next().done); }
  /** Same as build() as a generator: every `yield` is a point where a chunked loader may give the frame back (value = progress 0..1). */
  function* buildSteps(size, spawns, key) {
    openZones();       // breach panels (engine-breach.js): the graph being left gets back every edge they had cut, so a cached graph stays whole
    const hit = key != null ? cache.get(key) : null;
    if (hit && hit.size === size) { ({ N, half, n, cellFirst, cellCnt, nCell, nH, nei, ground } = hit); scratch(); return; }
    half = size + 1; N = Math.ceil(2 * half / CS);
    const rc = [], rh = [], rs = [], cs = [];
    for (let cz = 0; cz < N; cz++) { if (!(cz & 7)) yield 0.6 * cz / N; for (let cx = 0; cx < N; cx++) {
      const x = -half + (cx + 0.5) * CS, z = -half + (cz + 0.5) * CS;
      const k = grid.boxQuery(x - CL, x + CL, z - CL, z + CL, buf);
      cand.length = 0; cand.push(0); cs.length = 0;
      for (let i = 0; i < k; i++) { const c = buf[i]; if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && c.y1 > 0.02 && c.y1 < MAXH) { cand.push(c.y1); if (c.slope) cs.push(c.y1); } }
      if (cand.length > 2) cand.sort((a, b) => a - b); else if (cand.length === 2 && cand[1] < cand[0]) { const t = cand[0]; cand[0] = cand[1]; cand[1] = t; }
      let last = -9, lastI = -1;
      for (let q = 0; q < cand.length; q++) {
        const h = cand[q]; if (h - last < 0.02) continue;
        let ok = true;
        for (let i = 0; i < k; i++) { const c = buf[i]; if (x + CL > c.x0 && x - CL < c.x1 && z + CL > c.z0 && z - CL < c.z1 && c.y1 > h + (c.slope ? STS : ST) && c.y0 < h + HH) { ok = false; break; } }
        if (!ok) continue;
        const sl = cs.length && cs.indexOf(h) >= 0 ? 1 : 0;
        if (lastI >= 0 && h - last <= ST) { rh[lastI] = h; rs[lastI] = sl; last = h; continue; }
        lastI = rc.length; rc.push(cz * N + cx); rh.push(h); rs.push(sl); last = h;
      }
    } }
    // provisional arrays
    let m = rc.length; nCell = Int32Array.from(rc); nH = Float32Array.from(rh); const nSl = Uint8Array.from(rs), up = (a, b) => (nH[a] >= nH[b] ? nSl[a] : nSl[b]);   /* [fin] la marche se lit sur le solide du haut */
    cellFirst = new Int32Array(N * N).fill(-1); cellCnt = new Uint8Array(N * N);
    for (let i = 0; i < m; i++) { const c = nCell[i]; if (cellFirst[c] < 0) cellFirst[c] = i; cellCnt[c]++; }
    nei = new Int32Array(m * 8).fill(-1); n = m;
    for (let i = 0; i < m; i++) {
      if (!(i & 4095)) yield 0.6 + 0.3 * i / m;
      const c = nCell[i], cx = c % N, cz = (c - cx) / N, h = nH[i];
      for (let d = 0; d < 4; d++) {
        const x2 = cx + DX[d], z2 = cz + DZ[d]; if (x2 < 0 || z2 < 0 || x2 >= N || z2 >= N) continue;
        const c2 = z2 * N + x2; if (!cellCnt[c2]) continue;
        let j = find(c2, h, ST);
        if (j < 0) { const js = find(c2, h, STS); if (js >= 0 && up(i, js)) j = js; }
        if (j < 0) {
          const j2 = find(c2, h, 0.62);
          if (j2 >= 0) { const h2 = nH[j2], lo = Math.max(h, h2) - ST, hi = Math.min(h, h2) + ST; if (standH(-half + (cx + 0.5 + DX[d] * 0.5) * CS, -half + (cz + 0.5 + DZ[d] * 0.5) * CS, lo, hi, 0.3) >= 0) j = j2; }
        }
        nei[i * 8 + d] = j;
      }
    }
    for (let i = 0; i < m; i++) for (let d = 4; d < 8; d++) {
      const a = nei[i * 8 + (DX[d] > 0 ? 0 : 1)], b = nei[i * 8 + (DZ[d] > 0 ? 2 : 3)]; if (a < 0 || b < 0) continue;
      const j = nei[a * 8 + (DZ[d] > 0 ? 2 : 3)], j2 = nei[b * 8 + (DX[d] > 0 ? 0 : 1)];
      if (j >= 0 && j === j2 && Math.abs(nH[j] - nH[i]) <= (up(i, j) ? STS : ST)) nei[i * 8 + d] = j;
    }
    yield 0.92;
    // connected components, keep the one the spawns live in
    const comp = new Int32Array(m).fill(-1), sizes = [], stack = new Int32Array(m); let nc = 0;
    for (let s = 0; s < m; s++) {
      if (comp[s] >= 0) continue; let top = 0, cnt = 0; stack[top++] = s; comp[s] = nc;
      while (top) { const i = stack[--top]; cnt++; for (let d = 0; d < 8; d++) { const j = nei[i * 8 + d]; if (j >= 0 && comp[j] < 0) { comp[j] = nc; stack[top++] = j; } } }
      sizes.push(cnt); nc++;
    }
    const votes = new Map();
    for (const sp of spawns || []) { const i = rawNear(sp[0], sp[1], m); if (i >= 0) votes.set(comp[i], (votes.get(comp[i]) || 0) + 1); }
    let main = -1, bv = -1;
    for (const [c, v] of votes) if (v > bv || (v === bv && sizes[c] > sizes[main])) { bv = v; main = c; }
    if (main < 0) { let bs = -1; for (let c = 0; c < nc; c++) if (sizes[c] > bs) { bs = sizes[c]; main = c; } }
    yield 0.96;
    const map = new Int32Array(m).fill(-1); let k = 0;
    for (let i = 0; i < m; i++) if (comp[i] === main) map[i] = k++;
    const c2 = new Int32Array(k), h2 = new Float32Array(k), ne2 = new Int32Array(k * 8).fill(-1), gl = [];
    for (let i = 0; i < m; i++) { const q = map[i]; if (q < 0) continue; c2[q] = nCell[i]; h2[q] = nH[i]; if (isG(i)) gl.push(q); for (let d = 0; d < 8; d++) { const j = nei[i * 8 + d]; ne2[q * 8 + d] = j >= 0 ? map[j] : -1; } }
    nCell = c2; nH = h2; nei = ne2; n = k; ground = Int32Array.from(gl);
    cellFirst.fill(-1); cellCnt.fill(0);
    for (let i = 0; i < n; i++) { const c = nCell[i]; if (cellFirst[c] < 0) cellFirst[c] = i; cellCnt[c]++; }
    scratch();
    if (key != null) cache.set(key, { size, N, half, n, cellFirst, cellCnt, nCell, nH, nei, ground });
  }
  function rawNear(x, z, m) {   // used during build only (ground level)
    const c0 = cellOf(x, z); if (c0 < 0) return -1; const cx = c0 % N, cz = (c0 - cx) / N;
    for (let r = 0; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const x2 = cx + dx, z2 = cz + dz; if (x2 < 0 || z2 < 0 || x2 >= N || z2 >= N) continue;
      const c = z2 * N + x2; for (let i = cellFirst[c], e = i + cellCnt[c]; i < e && i >= 0; i++) if (isG(i)) return i;
    }
    return -1;
  }
  /** Nearest node to a 3D point (height weighted); groundOnly restricts to the ground level. */
  function nodeAt(x, y, z, groundOnly, maxR = 30) {
    if (!n) return -1;
    let cx = Math.floor((x + half) / CS), cz = Math.floor((z + half) / CS); cx = cx < 0 ? 0 : cx >= N ? N - 1 : cx; cz = cz < 0 ? 0 : cz >= N ? N - 1 : cz;
    let best = -1, bd = Infinity, stop = maxR;
    for (let r = 0; r <= stop; r++) {
      for (let dz = -r; dz <= r; dz++) {
        const z2 = cz + dz; if (z2 < 0 || z2 >= N) continue; const edge = dz === -r || dz === r;
        for (let dx = -r; dx <= r; dx += edge ? 1 : 2 * r || 1) {
          const x2 = cx + dx; if (x2 < 0 || x2 >= N) continue; const c = z2 * N + x2;
          for (let i = cellFirst[c], e = i + cellCnt[c]; i < e && i >= 0; i++) {
            if (groundOnly && !isG(i)) continue;
            if ((off && off[i]) || (bkOff && bkOff[i])) continue;
            const ex = nodeX(i) - x, ez = nodeZ(i) - z, ey = (nH[i] - y) * 2.5, d = ex * ex + ez * ez + ey * ey;
            if (d < bd) { bd = d; best = i; }
          }
        }
      }
      if (best >= 0 && stop === maxR) stop = Math.min(maxR, r + Math.ceil(Math.sqrt(bd) / CS) + 1);
    }
    return best;
  }
  function walkLine(a, b) {
    const ax = nodeX(a), az = nodeZ(a), bx = nodeX(b), bz = nodeZ(b), dx = bx - ax, dz = bz - az, L = Math.sqrt(dx * dx + dz * dz), steps = Math.ceil(L / 0.2);
    let cur = a;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, c = cellOf(ax + dx * t, az + dz * t); if (c === nCell[cur]) continue;
      let nx = -1; for (let d = 0; d < 8; d++) { const j = nei[cur * 8 + d]; if (j >= 0 && nCell[j] === c) { nx = j; break; } }
      if (nx < 0) return false; cur = nx;
    }
    return cur === b;
  }
  // binary heap on fS
  let hn = 0, wH = 1;     // wH: weighted A* on the large maps (paths ~ optimal, several times fewer expansions)
  function push(i) { let k = ++hn; heap[k] = i; while (k > 1) { const p = k >> 1; if (fS[heap[p]] <= fS[heap[k]]) break; const t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p; } }
  function pop() { const top = heap[1]; heap[1] = heap[hn--]; let k = 1; for (;;) { let c = k << 1; if (c > hn) break; if (c < hn && fS[heap[c + 1]] < fS[heap[c]]) c++; if (fS[heap[k]] <= fS[heap[c]]) break; const t = heap[k]; heap[k] = heap[c]; heap[c] = t; k = c; } return top; }
  const heur = (i, gx, gz, gh) => { const ax = Math.abs(nodeX(i) - gx), az = Math.abs(nodeZ(i) - gz); return wH * (((ax > az ? ax + az * 0.4142 : az + ax * 0.4142) / CS) + Math.abs(nH[i] - gh) * 2); };
  const tmpPath = [];
  // Temporary obstacles (a mode's crates): the nodes under them are cut out of the graph, and restored by clearBlocks().
  let off = null; const cutEdges = [], win = [];
  // Breach panels (engine-breach.js): the graph is built with every wall panel away, then each intact panel cuts its strip out (exact edges
  // kept per panel); blowing it restores them in O(nodes of the strip). bkOff: nodes under a panel, never a start, goal or random point.
  let bkOff = null; const bkCuts = new Map();
  function cutZone(key, x0, x1, z0, z1, y0, y1) {
    if (bkCuts.has(key) || !n) return 0;
    if (!bkOff || bkOff.length !== n) bkOff = new Uint8Array(n);
    const rec = [], nodes = [];
    eachCell(x0, x1, z0, z1, i => {
      if (nH[i] < y0 - 0.4 || nH[i] > y1 + 0.1 || !inRect(i, x0, x1, z0, z1)) return;
      nodes.push(i); if (bkOff[i] < 255) bkOff[i]++;
      for (let d = 0; d < 8; d++) {
        const j = nei[i * 8 + d]; if (j < 0) continue;
        rec.push(i * 8 + d, j); nei[i * 8 + d] = -1;
        for (let k = 0; k < 8; k++) if (nei[j * 8 + k] === i) { rec.push(j * 8 + k, i); nei[j * 8 + k] = -1; }
      }
    });
    bkCuts.set(key, { rec, nodes, nei }); return nodes.length;
  }
  function openZone(key) {
    const c = bkCuts.get(key); if (!c) return 0; bkCuts.delete(key);
    const a = c.nei, r = c.rec;
    for (let k = r.length - 2; k >= 0; k -= 2) if (a[r[k]] === -1) a[r[k]] = r[k + 1];
    if (a === nei && bkOff) for (const i of c.nodes) if (bkOff[i] > 0) bkOff[i]--;
    return c.nodes.length;
  }
  function openZones() { for (const key of [...bkCuts.keys()]) openZone(key); bkOff = null; }
  const eachCell = (x0, x1, z0, z1, fn) => {
    const a = Math.max(0, Math.floor((x0 + half) / CS)), b = Math.min(N - 1, Math.floor((x1 + half) / CS)), c = Math.max(0, Math.floor((z0 + half) / CS)), d = Math.min(N - 1, Math.floor((z1 + half) / CS));
    for (let z = c; z <= d; z++) for (let x = a; x <= b; x++) { const q = z * N + x; for (let i = cellFirst[q], e = i + cellCnt[q]; i < e && i >= 0; i++) fn(i); }
  };
  const inRect = (i, x0, x1, z0, z1) => { const x = nodeX(i), z = nodeZ(i); return x >= x0 && x <= x1 && z >= z0 && z <= z1; };

  const nav = {
    ready: false, nodes: 0, cell: CS, build, buildSteps, nodeAt, searches: 0,
    /** Cuts every node of the rectangle whose height is within [y0-0.4, y1+0.1] out of the graph. */
    block(x0, x1, z0, z1, y0, y1) {
      if (!off || off.length !== n) off = new Uint8Array(n);
      eachCell(x0, x1, z0, z1, i => {
        if (off[i] || nH[i] < y0 - 0.4 || nH[i] > y1 + 0.1 || !inRect(i, x0, x1, z0, z1)) return;
        off[i] = 1;
        for (let d = 0; d < 8; d++) {
          const j = nei[i * 8 + d]; if (j < 0) continue;
          cutEdges.push(i * 8 + d, j); nei[i * 8 + d] = -1;
          for (let k = 0; k < 8; k++) if (nei[j * 8 + k] === i) { cutEdges.push(j * 8 + k, i); nei[j * 8 + k] = -1; }
        }
      });
    },
    clearBlocks() { for (let k = cutEdges.length - 2; k >= 0; k -= 2) nei[cutEdges[k]] = cutEdges[k + 1]; cutEdges.length = 0; off = null; },
    cutZone, openZone, openZones,
    /** Would blocking this rectangle separate walkable ground around it (a corridor, a doorway)? Compares the local connected pieces with and without it. */
    splits(x0, x1, z0, z1, y, R = 2.4) {
      const wx0 = x0 - R, wx1 = x1 + R, wz0 = z0 - R, wz1 = z1 + R; win.length = 0;
      eachCell(wx0, wx1, wz0, wz1, i => { if (Math.abs(nH[i] - y) <= 0.7 && !(off && off[i]) && inRect(i, wx0, wx1, wz0, wz1)) win.push(i); });
      const count = cut => {
        const id = (++sid) * 2; let parts = 0; const stack = [];
        for (let w = 0; w < win.length; w++) st[win[w]] = id;
        for (let w = 0; w < win.length; w++) {
          const s = win[w]; if (st[s] !== id || inRect(s, x0, x1, z0, z1)) continue;
          parts++; st[s] = id + 1; stack.push(s);
          while (stack.length) { const i = stack.pop(); for (let d = 0; d < 8; d++) { const j = nei[i * 8 + d]; if (j < 0 || st[j] !== id || (cut && inRect(j, x0, x1, z0, z1))) continue; st[j] = id + 1; stack.push(j); } }
        }
        return parts;
      };
      return count(true) > count(false);
    },
    nodePos(i, out) { out.x = nodeX(i); out.y = nH[i]; out.z = nodeZ(i); return out; },
    /** Walkable ground-level point nearest to (x,z). */
    nearest(x, z) { const i = nodeAt(x, levelFn ? levelFn(x, z) : 0, z, true, 400); return i < 0 ? [x, z] : levelFn ? [nodeX(i), nodeZ(i), nH[i]] : [nodeX(i), nodeZ(i)]; }, setLevel(f) { levelFn = f || null; }, near3(x, y, z) { const i = nodeAt(x, y, z, false, 8); return i < 0 ? [x, z, y] : [nodeX(i), nodeZ(i), nH[i]]; }, levelY(x, z) { return levelFn ? levelFn(x, z) : 0; },
    reachable(ax, az, bx, bz) {
      const a = nodeAt(ax, levelFn ? levelFn(ax, az) : 0, az, true, 4), b = nodeAt(bx, levelFn ? levelFn(bx, bz) : 0, bz, true, 4); if (a < 0 || b < 0) return false;
      return Math.hypot(nodeX(a) - ax, nodeZ(a) - az) < 1.6 && Math.hypot(nodeX(b) - bx, nodeZ(b) - bz) < 1.6;
    },
    /** A walkable ground point at least minDist from every given point ([x,z] or {x,z}); best effort otherwise. */
    far(points, minDist = 10) {
      if (!ground.length) return [0, 0]; let best = ground[0], bs = -1;
      for (let k = 0; k < 80; k++) {
        const i = ground[Math.floor(Math.random() * ground.length)], x = nodeX(i), z = nodeZ(i); let d = Infinity; if (bkOff && bkOff[i]) continue;
        for (const p of points || []) { const px = Array.isArray(p) ? p[0] : p.x, pz = Array.isArray(p) ? p[1] : p.z; const q = Math.hypot(px - x, pz - z); if (q < d) d = q; }
        if (d > bs) { bs = d; best = i; if (d >= minDist * 1.5) break; }
      }
      return levelFn ? [nodeX(best), nodeZ(best), nH[best]] : [nodeX(best), nodeZ(best)];
    },
    /** Random walkable ground point within radius of (x,z), or null. */
    randomNear(x, z, radius) {
      for (let k = 0; k < 12; k++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * radius, i = nodeAt(x + Math.cos(a) * r, 0, z + Math.sin(a) * r, false, 3); if (i >= 0 && Math.hypot(nodeX(i) - x, nodeZ(i) - z) <= radius + 0.5) return i; }
      return -1;
    },
    /** A* from a to b (3D points). Returns an array of {x,y,z} waypoints (smoothed) or null. */
    path(ax, ay, az, bx, by, bz, maxExp = n > 60000 ? Math.round(n * (n > 120000 ? 0.5 : 0.3)) : 14000) {
      const s = nodeAt(ax, ay, az, false, 12), g = nodeAt(bx, by, bz, false, 40); if (s < 0 || g < 0) return null;
      nav.searches++;
      const gx = nodeX(g), gz = nodeZ(g), gh = nH[g], id = (++sid) * 2; hn = 0;
      wH = n > 60000 ? 1.35 : 1; gS[s] = 0; fS[s] = heur(s, gx, gz, gh); par[s] = -1; st[s] = id; push(s);
      let found = -1, exp = 0, close = s, cd = fS[s];
      while (hn) {
        const i = pop(); if (st[i] === id + 1) continue; st[i] = id + 1;
        if (i === g) { found = i; break; }
        if (++exp > maxExp) break;
        const hh = fS[i] - gS[i]; if (hh < cd) { cd = hh; close = i; }
        for (let d = 0; d < 8; d++) {
          const j = nei[i * 8 + d]; if (j < 0 || st[j] === id + 1) continue;
          const ng = gS[i] + COST[d] + Math.abs(nH[j] - nH[i]) * 1.5;
          if (st[j] !== id || ng < gS[j]) { gS[j] = ng; fS[j] = ng + heur(j, gx, gz, gh); par[j] = i; st[j] = id; push(j); }
        }
      }
      if (found < 0) found = close;
      tmpPath.length = 0; for (let i = found; i >= 0; i = par[i]) tmpPath.push(i); tmpPath.reverse();
      const out = []; let a = 0; const last = tmpPath.length - 1;
      while (a < last) {
        let j = a + 1; const lim = Math.min(last, a + 40);
        while (j < lim && Math.abs(nH[tmpPath[j + 1]] - nH[tmpPath[a]]) < 0.05 && walkLine(tmpPath[a], tmpPath[j + 1])) j++;
        const q = tmpPath[j]; out.push({ x: nodeX(q), y: nH[q], z: nodeZ(q) }); a = j;
      }
      if (found === g && Math.hypot(bx - gx, bz - gz) < 0.9 && Math.abs(by - gh) < 1) { if (out.length) { out[out.length - 1].x = bx; out[out.length - 1].z = bz; } else out.push({ x: bx, y: gh, z: bz }); }
      else if (!out.length) out.push({ x: gx, y: gh, z: gz });
      out.complete = found === g;
      return out;
    },
  };
  return nav;
}
