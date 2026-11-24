// FRONT ZÉRO — interactive world: doors, glass, explosive props, bullet penetration. Data in map-props.js; hooks in game.js.
// Door, pane and barrel solids live in the map's solids array (so the grid, mover and rays need no second structure): a solid that is
// "away" is collapsed under the ground. The nav grid is built with doors and panes away, so a closed door never cuts a path.
import * as THREE from 'three';
import { buildLayout } from './maps.js';
import { createMover } from './engine-grid.js';
import { PROP_MAPS, PROP_DEFAULT, BARREL, HEAVY_DOORS, PEN_MAX_THICK, PEN_MIN_LEFT, PEN_LAYERS, powerOf, penCost, deriveProps, deriveGlazing, placeBarrels, seeded } from './map-props.js';

const AWAY = -60, SWING = 1.78, SWING_RATE = 5.2, USE_R = 2.5, USE_DOT = 0.62, MAX_SHARDS = 72, PANE_T = 0.05, LEAF_T = 0.07, EPS = 0.012;
const SURF = { sand: 0x9a8a68, concrete: 0x8a8880, metal: 0xc8b48a, wood: 0x7a5c3a, snow: 0xe8eef4 };

/** Non-indexed box soup with vertex colours, for one merged instanced model. */
function boxes(list) {
  const n = list.length * 36, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), C = new THREE.Color(); let v = 0;
  const FACES = [[0, 1, 2, 1], [0, 1, 2, -1], [1, 2, 0, 1], [1, 2, 0, -1], [2, 0, 1, 1], [2, 0, 1, -1]];
  for (const [x0, x1, y0, y1, z0, z1, hex] of list) {
    C.set(hex); const lo = [x0, y0, z0], hi = [x1, y1, z1];
    for (const [a, b, c, s] of FACES) {
      const q = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]], shade = c === 1 ? (s > 0 ? 1 : 0.6) : 0.82;
      for (const [u, w] of (s > 0 ? q : q.slice().reverse())) {
        const p = [0, 0, 0]; p[a] = u ? hi[a] : lo[a]; p[b] = w ? hi[b] : lo[b]; p[c] = s > 0 ? hi[c] : lo[c];
        pos.set(p, v * 3); const m = [0, 0, 0]; m[c] = s; nor.set(m, v * 3); col[v * 3] = C.r * shade; col[v * 3 + 1] = C.g * shade; col[v * 3 + 2] = C.b * shade; v++;
      }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function paintCyl(r0, h, seg, hexBody, hexBand) {
  const g = new THREE.CylinderGeometry(r0, r0, h, seg, 4).translate(0, h / 2, 0).toNonIndexed(), p = g.attributes.position, c = new Float32Array(p.count * 3), A = new THREE.Color(hexBody), B = new THREE.Color(hexBand);
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h, band = (y > 0.3 && y < 0.36) || (y > 0.64 && y < 0.7) || y > 0.97, q = band ? B : A; c[i * 3] = q.r; c[i * 3 + 1] = q.g; c[i * 3 + 2] = q.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
/** The dark, jagged gap left in a windscreen or cabin window (that glass is baked into the map): a unit square fan on both faces. */
function holeGeometry() {
  const N = 16, pos = [], nor = [], col = [], P = [], O = [];       // P: jagged edge of the gap, O: the frame of the pane; between them, pale crazed facets
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = 0.5 / Math.max(Math.abs(c), Math.abs(s)), k = i & 1 ? 0.74 : 0.38 + 0.2 * ((i * 7) % 5) / 5; P.push([c * e * k, s * e * k]); O.push([c * e, s * e]); }
  const put = (f, tri, r, g, b) => { for (const q of f > 0 ? tri : [tri[0], tri[2], tri[1]]) { pos.push(q[0], q[1], f * 0.5); nor.push(0, 0, f); col.push(r, g, b); } };
  for (const f of [1, -1]) for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, v = 0.34 + 0.26 * (((i * 5) % 7) / 6), w = 0.34 + 0.26 * (((i * 3 + 2) % 7) / 6);
    put(f, [[0, 0], P[i], P[j]], 0.03, 0.035, 0.04);
    put(f, [P[i], O[i], O[j]], v, v * 1.06, v * 1.12); put(f, [P[i], O[j], P[j]], w, w * 1.06, w * 1.12);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function createProps(ctx) {
  const { scene, grid, fx, audio, actors, player, hud, t, settings, camera } = ctx;
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glassM = new THREE.MeshBasicMaterial({ color: 0xa8c4cc, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), YAX = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), fw = new THREE.Vector3();
  const leafGeo = boxes([[0, 1, 0, 1, -0.5, 0.5, 0x64503a], [0.87, 0.94, 0.44, 0.48, -1.5, 1.5, 0xb9b09a]]);       // 24 triangles: there can be 112 leaves on a map
  const steelGeo = boxes([[0, 1, 0, 1, -0.5, 0.5, 0x87938c], [0.05, 0.95, 0.12, 0.2, -0.72, 0.72, 0xa3afa7], [0.05, 0.95, 0.8, 0.88, -0.72, 0.72, 0xa3afa7], [0.8, 0.92, 0.43, 0.5, -1.7, 1.7, 0x6f6a5c]]), holeGeo = holeGeometry();
  const paneGeo = new THREE.PlaneGeometry(1, 1), drumGeo = paintCyl(BARREL.drum.r, BARREL.drum.h, 10, 0x8a2f1e, 0x3a3128), gasGeo = paintCyl(BARREL.gas.r, BARREL.gas.h, 8, 0xc9a227, 0x4a4438);
  const shardGeo = new THREE.BufferGeometry(); shardGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.05, -0.03, 0, 0.05, -0.04, 0, 0.01, 0.06, 0, 0.05, -0.04, 0, -0.05, -0.03, 0, 0.01, 0.06, 0]), 3)); shardGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1]), 3)); shardGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(18).fill(0.82), 3));
  const inst = (g, m, n) => { const q = new THREE.InstancedMesh(g, m, Math.max(1, n)); q.count = 0; q.frustumCulled = false; q.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(q); return q; };
  const shards = inst(shardGeo, lam, MAX_SHARDS); shards.castShadow = false;
  for (let i = 0; i < MAX_SHARDS; i++) shards.setMatrixAt(i, ZERO); shards.count = MAX_SHARDS;       // always drawn (scaled to nothing): its program is linked with the map
  const sP = new Float32Array(MAX_SHARDS * 3), sV = new Float32Array(MAX_SHARDS * 3), sL = new Float32Array(MAX_SHARDS), sR = new Float32Array(MAX_SHARDS); let sHead = 0, sLive = 0;

  let doorMesh = null, steelMesh = null, paneMesh = null, holeMesh = null, drumMesh = null, gasMesh = null, mapId = null, ready = false, enabled = false, isOnline = false, authOff = false;
  let doors = [], panes = [], barrels = [], moving = [], scan = 0, focus = null, focusT = 0, shownKey = 0, chainUsed = 0, chainT = 0, removed = [];
  let glazing = [], gCells = [], gN = 0, gHalf = 0, gStamp = new Int32Array(0), gSid = 0;       // windscreens and cabin glass, in a coarse grid for the bullet test
  const G_CELL = 4;
  const snd = { x: 0, y: 0, z: 0, size: 1, own: false }, at = (x, y, z, size = 1) => { snd.x = x; snd.y = y; snd.z = z; snd.size = size; return snd; };
  const play = (name, a, b) => { const f = audio && audio[name]; if (typeof f === 'function') { try { f.call(audio, a, b); } catch { /* audio is optional */ } } };
  const ovBuf = [], walker = createMover(grid);
  const net = () => (isOnline && ctx.net ? ctx.net() : null);
  const hide = s => { s.y0 = AWAY; s.y1 = AWAY; }, show = s => { s.y0 = s.oy0; s.y1 = s.oy1; };
  const sol = (x0, x1, y0, y1, z0, z1, surface, pen) => ({ x0, x1, y0: AWAY, y1: AWAY, z0, z1, surface, pen, prop: null, pane: false, oy0: y0, oy1: y1 });

  /* ---------- building: right after world.load, before grid.build ---------- */
  function clearMeshes() { for (const m of [doorMesh, steelMesh, paneMesh, holeMesh, drumMesh, gasMesh]) if (m) { scene.remove(m); m.dispose(); } doorMesh = steelMesh = paneMesh = holeMesh = drumMesh = gasMesh = null; }
  /** A real walk through the opening, both ways, with the player's body: from 95 cm before it to 80 cm past it, at any of five lateral offsets. */
  function canWalk(h) {
    const nx = h.ax === 'x' ? 0 : 1, nz = h.ax === 'x' ? 1 : 0, ux = nz, uz = nx, mid = (h.a + h.b) / 2, cx = h.ax === 'x' ? mid : h.c, cz = h.ax === 'x' ? h.c : mid, room = Math.max(0, (h.b - h.a) / 2 - 0.4);
    for (let sg = -1; sg <= 1; sg += 2) {
      let ok = false;
      for (let o = 0; o < 5 && !ok; o++) {
        const off = room * [0, 0.5, -0.5, 1, -1][o], x = cx + ux * off - nx * sg * 0.95, z = cz + uz * off - nz * sg * 0.95, y = grid.floorAt(x, h.y0 + 0.33, z);
        if (walker.blocked(x, y + 0.01, z, 0.38, 1.75)) continue;
        const b = { pos: { x, y, z }, r: 0.38, h: 1.75, vy: 0, grounded: true, ground: null, stepOff: 0, stepV: 0, ceil: false };
        for (let i = 0; i < 36; i++) walker.move(b, nx * sg * 0.06, -0.02, nz * sg * 0.06);
        ok = (b.pos.x - cx) * nx * sg + (b.pos.z - cz) * nz * sg > 0.8;
      }
      if (!ok) return false;
    }
    return true;
  }
  function addGlazing(list) {
    glazing = []; const size = ctx.world.size; gHalf = size + 2; gN = Math.ceil(2 * gHalf / G_CELL) + 1; gCells = new Array(gN * gN).fill(null);
    for (const q of list) {
      const s = sol(q.x, q.x, q.y - q.hh, q.y + q.hh, q.z, q.z, 'metal', 0);       // never enters the grid: the vehicle's own collision stays
      const p = { id: panes.length, decor: true, slot: glazing.length, ax: Math.abs(q.nz) >= Math.abs(q.nx) ? 'x' : 'z', c: 0, a: -q.hw, b: q.hw, y0: q.y - q.hh, h: q.hh * 2, cx: q.x, cy: q.y, cz: q.z, s, broken: false, nx: q.nx, nz: q.nz, ux: q.ux, uz: q.uz, hw: q.hw, hh: q.hh, th: q.th };
      s.prop = p; panes.push(p); glazing.push(p);
      const ex = Math.abs(q.ux) * q.hw + 0.1, ez = Math.abs(q.uz) * q.hw + 0.1, cell = v => Math.max(0, Math.min(gN - 1, Math.floor((v + gHalf) / G_CELL)));
      for (let i = cell(q.x - ex); i <= cell(q.x + ex); i++) for (let j = cell(q.z - ez); j <= cell(q.z + ez); j++) (gCells[j * gN + i] || (gCells[j * gN + i] = [])).push(p);
    }
    gStamp = new Int32Array(glazing.length); gSid = 0;
  }
  /** Every windscreen or cabin window the bullet crossed on its way to `tt`. No allocation. */
  function hitGlazing(ox, oy, oz, dx, dy, dz, tt) {
    if (!glazing.length) return; const id = ++gSid; let last = -1;
    for (let t = 0; ; t += 1.5) {
      const q = t > tt ? tt : t, ci = Math.floor((ox + dx * q + gHalf) / G_CELL), cj = Math.floor((oz + dz * q + gHalf) / G_CELL), c = ci < 0 || cj < 0 || ci >= gN || cj >= gN ? -1 : cj * gN + ci;
      if (c >= 0 && c !== last) {
        last = c; const list = gCells[c];
        if (list) for (let k = 0; k < list.length; k++) {
          const p = list[k]; if (gStamp[p.slot] === id) continue; gStamp[p.slot] = id; if (p.broken) continue;
          const dn = dx * p.nx + dz * p.nz; if (dn > -0.04 && dn < 0.04) continue;
          const tp = ((p.cx - ox) * p.nx + (p.cz - oz) * p.nz) / dn; if (tp < 0 || tp > tt + 0.35) continue;
          const hy = oy + dy * tp - p.cy; if (hy > p.hh || hy < -p.hh) continue;
          const u = (ox + dx * tp - p.cx) * p.ux + (oz + dz * tp - p.cz) * p.uz; if (u > p.hw || u < -p.hw) continue;
          breakPane(p, dx, dz); if (isOnline) glOut.push(p.id);
        }
      }
      if (t > tt) break;
    }
  }
  function attach(id) {
    ready = false; enabled = false; clearMeshes(); doors = []; panes = []; barrels = []; moving = []; focus = null; mapId = id; removed = []; glazing = [];
    try {
      const L = buildLayout(id), solids = ctx.world.solids; if (L.solids.length !== solids.length) throw new Error('layout and world differ');
      const cfg = PROP_MAPS[id] || PROP_DEFAULT, D = deriveProps(L);
      for (let i = 0; i < solids.length; i++) solids[i].pen = D.rates[i];
      grid.build(solids);
      const rd = seeded('doors:' + id), lockSpawn = (x, z, r) => { for (const p of ctx.world.spawns) if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < r * r) return true; return false; };
      const heavy = [];
      for (const q of HEAVY_DOORS[id] ? HEAVY_DOORS[id]() : []) {       // only where the rock really frames the opening; the height comes from its ceiling
        const mx = (q.a + q.b) / 2, px = q.ax === 'x' ? mx : q.c, pz = q.ax === 'x' ? q.c : mx, up = grid.ray(px, 0.4, pz, 0, 1, 0, 6) + 0.4;
        const jamb = u => (q.ax === 'x' ? grid.overlap(u - 0.02, u + 0.02, 0.9, 1.1, q.c - 0.02, q.c + 0.02, ovBuf) : grid.overlap(q.c - 0.02, q.c + 0.02, 0.9, 1.1, u - 0.02, u + 0.02, ovBuf));
        if (jamb(q.a - 0.12) && jamb(q.b + 0.12) && !jamb(mx) && up >= 2 && up <= 3.4) heavy.push({ ax: q.ax, c: q.c, a: q.a, b: q.b, y0: 0, h: up, heavy: true }); else removed.push({ x: px, z: pz, why: 'frame' });
      }
      for (const h of D.doors.concat(heavy)) {
        if (doors.length >= cfg.doors) break;
        const mid = (h.a + h.b) / 2, cx = h.ax === 'x' ? mid : h.c, cz = h.ax === 'x' ? h.c : mid; if (lockSpawn(cx, cz, 2.2)) continue;
        const startOpen = rd() < cfg.open;       // drawn for every opening, so that dropping one never changes the others
        if (!canWalk(h)) { removed.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), why: 'walk' }); continue; }       // stairs or a wall right behind it: the opening stays free
        const half = LEAF_T / 2, surf = h.heavy ? 'metal' : 'wood', rate = h.heavy ? 10 : 2.6, s = h.ax === 'x' ? sol(h.a, h.b, h.y0, h.y0 + h.h, h.c - half, h.c + half, surf, rate) : sol(h.c - half, h.c + half, h.y0, h.y0 + h.h, h.a, h.b, surf, rate);
        const d = { id: doors.length, slot: 0, heavy: !!h.heavy, ax: h.ax, c: h.c, a: h.a, b: h.b, y0: h.y0, h: h.h, cx, cz, s, startOpen, open: false, ang: 0, side: 1, noSwing: 0, moving: false, listed: false, wait: 0 }; s.prop = d;
        // A leaf never swings into a staircase or a wall right behind the opening: side s sends the leaves toward -s.
        const w = (h.b - h.a) / 2, hits = sg => (h.ax === 'x' ? grid.overlap(h.a + 0.05, h.b - 0.05, h.y0 + 0.12, h.y0 + 2, sg > 0 ? h.c - w : h.c + 0.2, sg > 0 ? h.c - 0.2 : h.c + w, ovBuf) : grid.overlap(sg > 0 ? h.c - w : h.c + 0.2, sg > 0 ? h.c - 0.2 : h.c + w, h.y0 + 0.12, h.y0 + 2, h.a + 0.05, h.b - 0.05, ovBuf));
        const bp = !!hits(1), bn = !!hits(-1); d.noSwing = bp && !bn ? 1 : bn && !bp ? -1 : 0;
        if (bp && bn) { removed.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), why: 'swing' }); continue; }       // no side for the leaves to go
        doors.push(d); solids.push(s);
      }
      for (const h of D.windows) {
        if (panes.length >= cfg.panes) break;
        const half = PANE_T / 2, s = h.ax === 'x' ? sol(h.a, h.b, h.y0, h.y0 + h.h, h.c - half, h.c + half, 'metal', 0.6) : sol(h.c - half, h.c + half, h.y0, h.y0 + h.h, h.a, h.b, 'metal', 0.6);
        s.pane = true; const p = { id: panes.length, ax: h.ax, c: h.c, a: h.a, b: h.b, y0: h.y0, h: h.h, cx: h.ax === 'x' ? (h.a + h.b) / 2 : h.c, cy: h.y0 + h.h / 2, cz: h.ax === 'x' ? h.c : (h.a + h.b) / 2, s, broken: false }; s.prop = p; panes.push(p); solids.push(s);
      }
      const nWin = panes.length; addGlazing(deriveGlazing(L));       // ids after the real windows
      for (const q of placeBarrels(id, cfg, grid, ctx.world.size, ctx.world.spawns, D.doors.concat(heavy))) {
        const k = BARREL[q.kind], s = sol(q.x - k.r, q.x + k.r, q.y, q.y + k.h, q.z - k.r, q.z + k.r, 'metal', 0); show(s);
        const b = { id: barrels.length, kind: q.kind, k, x: q.x, y: q.y, z: q.z, s, hp: k.hp, state: 0, fuse: 0, by: null, gen: 0, fireT: 0, slot: 0 }; s.prop = b; barrels.push(b); solids.push(s);
      }
      let nw = 0, ns = 0; for (const d of doors) d.slot = d.heavy ? ns++ : nw++;
      if (nw) { doorMesh = inst(leafGeo, lam, nw * 2); doorMesh.castShadow = true; doorMesh.receiveShadow = true; doorMesh.count = nw * 2; }
      if (ns) { steelMesh = inst(steelGeo, lam, ns * 2); steelMesh.castShadow = true; steelMesh.receiveShadow = true; steelMesh.count = ns * 2; }
      if (nWin) { paneMesh = inst(paneGeo, glassM, nWin); paneMesh.count = nWin; paneMesh.renderOrder = 3; }
      if (glazing.length) { holeMesh = inst(holeGeo, lam, glazing.length); holeMesh.count = glazing.length; }
      let nd = 0, ng = 0; for (const b of barrels) b.slot = b.kind === 'drum' ? nd++ : ng++;
      if (nd) { drumMesh = inst(drumGeo, lam, nd); drumMesh.castShadow = true; drumMesh.count = nd; }
      if (ng) { gasMesh = inst(gasGeo, lam, ng); gasMesh.castShadow = true; gasMesh.count = ng; }
      resetAll(true); for (const d of doors) { d.open = true; d.ang = SWING; hide(d.s); drawDoor(d); } for (const p of panes) hide(p.s);       // away until begin(): the nav grid is built without them
      ready = true;
    } catch (e) { console.warn('[props] disabled on this map:', e && e.message); ready = false; }
  }

  /* ---------- drawing ---------- */
  function drawDoor(d) {
    const mesh = d.heavy ? steelMesh : doorMesh; if (!mesh) return; const w = (d.b - d.a) / 2, th = d.ang * d.side;
    for (let k = 0; k < 2; k++) {
      let ry, x, z;
      if (d.ax === 'x') { x = k ? d.b : d.a; z = d.c; ry = k ? Math.PI - th : th; } else { x = d.c; z = k ? d.b : d.a; ry = k ? Math.PI / 2 + th : -Math.PI / 2 - th; }
      Q.setFromAxisAngle(YAX, ry); V.set(x, d.y0, z); S.set(w - 0.01, d.h - 0.015, LEAF_T); M.compose(V, Q, S); mesh.setMatrixAt(d.slot * 2 + k, M);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  function drawPane(p) {
    if (p.decor) {       // the glass itself is baked into the map: a broken one gets its dark gap on top
      if (!holeMesh) return; if (!p.broken) holeMesh.setMatrixAt(p.slot, ZERO);
      else { Q.setFromAxisAngle(YAX, Math.atan2(p.nx, p.nz)); V.set(p.cx, p.cy, p.cz); S.set(p.hw * 2.02, p.hh * 2.02, p.th + 0.03); M.compose(V, Q, S); holeMesh.setMatrixAt(p.slot, M); }
      holeMesh.instanceMatrix.needsUpdate = true; return;
    }
    if (!paneMesh) return; if (p.broken) paneMesh.setMatrixAt(p.id, ZERO);
    else { if (p.ax === 'x') Q.identity(); else Q.setFromAxisAngle(YAX, Math.PI / 2); V.set(p.cx, p.cy, p.cz); S.set(p.b - p.a, p.h, 1); M.compose(V, Q, S); paneMesh.setMatrixAt(p.id, M); }
    paneMesh.instanceMatrix.needsUpdate = true;
  }
  function drawBarrel(b) {
    const m = b.kind === 'drum' ? drumMesh : gasMesh; if (!m) return;
    if (b.state === 2) m.setMatrixAt(b.slot, ZERO); else { Q.identity(); V.set(b.x, b.y, b.z); S.set(1, 1, 1); M.compose(V, Q, S); m.setMatrixAt(b.slot, M); }
    m.instanceMatrix.needsUpdate = true;
  }
  function resetAll(noDoorAnim) {
    for (const d of doors) { d.open = d.startOpen; d.ang = d.open ? SWING : 0; d.side = d.id & 1 ? 1 : -1; d.moving = false; d.listed = false; d.wait = 0; if (d.open) hide(d.s); else show(d.s); drawDoor(d); }
    moving.length = 0;
    for (const p of panes) { p.broken = false; show(p.s); drawPane(p); }
    for (const b of barrels) { b.hp = b.k.hp; b.state = 0; b.fuse = 0; b.by = null; b.gen = 0; show(b.s); drawBarrel(b); }
    for (let i = 0; i < MAX_SHARDS; i++) { sL[i] = 0; shards.setMatrixAt(i, ZERO); } shards.instanceMatrix.needsUpdate = true; sLive = 0;
    chainUsed = 0; chainT = 0; focus = null; if (!noDoorAnim) doorPrompt(null);
  }

  /* ---------- doors ---------- */
  function occupied(d) {
    const s = d.s, m = 0.46;
    for (let i = 0; i < actors.length; i++) { const a = actors[i]; if (!a.alive || a.ghost) continue; const r = (a.body ? a.body.r : 0.35) + m - 0.34; if (a.pos.x + r > s.x0 && a.pos.x - r < s.x1 && a.pos.z + r > s.z0 && a.pos.z - r < s.z1 && a.pos.y < d.y0 + d.h && a.pos.y + 1.8 > d.y0) return true; }
    return false;
  }
  const sideOf = (d, x, z) => ((d.ax === 'x' ? z - d.c : x - d.c) >= 0 ? 1 : -1);
  function setDoor(d, open, side, quiet) {
    if (d.open === open) return; d.open = open; if (open) { d.side = side === d.noSwing ? -side : side; hide(d.s); }       // an opening door stops blocking at once: it can never trap anyone
    d.moving = true; d.wait = 0; if (!d.listed) { d.listed = true; moving.push(d); }
    if (!quiet && open && (d.cx - camera.position.x) ** 2 + (d.cz - camera.position.z) ** 2 < 1600) play('doorOpen', at(d.cx, d.y0 + 1.1, d.cz, d.heavy ? 1.4 : 1));
  }
  function useDoor(d, who) {
    const side = sideOf(d, who.pos.x, who.pos.z), n = net();
    if (n) { try { n.sendProp({ a: 'use', id: d.id, s: side, z: who !== player ? 1 : 0 }); } catch { /* connection lost */ } return; }
    if (d.open && occupied(d) && who === player && Math.hypot(who.pos.x - d.cx, who.pos.z - d.cz) < 0.5) return;
    setDoor(d, !d.open, side);
  }
  function stepDoors(dt) {
    for (let i = moving.length - 1; i >= 0; i--) {
      const d = moving[i], goal = d.open ? SWING : 0;
      if (!d.open && occupied(d)) {       // somebody stepped into the doorway: wait with the door held, never close on them
        d.wait += dt; if (d.ang < 0.5) { d.ang = Math.min(SWING, d.ang + SWING_RATE * dt); drawDoor(d); } continue;
      }
      const st = SWING_RATE * (d.heavy ? 0.62 : 1) * dt, e = goal - d.ang; d.ang += e > st ? st : e < -st ? -st : e; drawDoor(d);
      if (d.ang === goal) { d.moving = false; d.listed = false; moving.splice(i, 1); if (!d.open) { show(d.s); const n2 = (d.cx - camera.position.x) ** 2 + (d.cz - camera.position.z) ** 2; if (n2 < 900) play('doorSlam', at(d.cx, d.y0 + 1, d.cz, d.heavy ? 1.4 : 1)); } }
    }
    const n = doors.length; if (!n) return;                                       // bots: a slice of the doors each frame
    for (let k = Math.min(n, 6); k > 0; k--) {
      const d = doors[scan = (scan + 1) % n]; if (d.open) continue;
      for (let i = 0; i < actors.length; i++) {
        const a = actors[i]; if (!a.alive || a.isPlayer || a.isRemote || !a.ai || a.ai.puppet) continue;
        const dx = d.cx - a.pos.x, dz = d.cz - a.pos.z, q = dx * dx + dz * dz; if (q > 3.6 || Math.abs(a.pos.y - d.y0) > 1.4) continue;
        const l = Math.sqrt(q) || 1; if ((a.wishX * dx + a.wishZ * dz) / l > 0.25 || (a.bump && q < 1.5)) { useDoor(d, a); break; }
      }
    }
  }
  function doorPrompt(d) {
    const st = d ? (d.open ? 2 : 1) : 0; if (st === shownKey) return; shownKey = st;       // no string built per frame
    if (!d) { hud.door(null); return; }
    const code = settings.get('keys.interact'), key = settings.keyLabel ? settings.keyLabel(code) : 'E'; hud.door(t(d.open ? 'door.close' : 'door.open', { key }));
  }
  function pickDoor() {
    if (!player.alive || ctx.rules.frozen) return null;
    const p = player.pos, cp = camera.position; camera.getWorldDirection(fw); let best = null, bs = -1;
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i], dx = d.cx - p.x, dz = d.cz - p.z, q = dx * dx + dz * dz; if (q > USE_R * USE_R || Math.abs(p.y - d.y0) > 1.3) continue;
      const vx = d.cx - cp.x, vy = d.y0 + 1.1 - cp.y, vz = d.cz - cp.z, l = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1, dot = (vx * fw.x + vy * fw.y + vz * fw.z) / l;
      if (q > 0.8 && dot < USE_DOT) continue; if (dot > bs) { bs = dot; best = d; }
    }
    return best;
  }

  /* ---------- glass ---------- */
  function shardBurst(x, y, z, nx, nz, ax, w, h) {
    const n = Math.round(Math.min(18, 8 + w * h * 5));
    for (let i = 0; i < n; i++) {
      const j = sHead; sHead = (sHead + 1) % MAX_SHARDS; if (sL[j] <= 0) sLive++; shards.visible = true;
      const u = (Math.random() - 0.5) * w, v = (Math.random() - 0.5) * h, out = (Math.random() < 0.72 ? 1 : -0.5) * (1 + Math.random() * 3.4);
      sP[j * 3] = x + (ax === 'x' ? u : 0); sP[j * 3 + 1] = y + v; sP[j * 3 + 2] = z + (ax === 'x' ? 0 : u);
      sV[j * 3] = nx * out + (Math.random() - 0.5) * 1.4; sV[j * 3 + 1] = Math.random() * 1.6 - 0.2; sV[j * 3 + 2] = nz * out + (Math.random() - 0.5) * 1.4; sL[j] = 0.8 + Math.random() * 0.75; sR[j] = Math.random() * 6.28;
    }
  }
  function crash(x, y, z) { if ((x - camera.position.x) ** 2 + (z - camera.position.z) ** 2 <= 3600) play('glass', at(x, y, z, 1)); }       // named event: silent until audio.js has it
  function ignite(b) { if ((b.x - camera.position.x) ** 2 + (b.z - camera.position.z) ** 2 > 3600) return; if (b.kind === 'gas') play('gasHiss', at(b.x, b.y + b.k.h, b.z, 1)); play('fire', at(b.x, b.y + b.k.h, b.z, 1)); }
  function breakPane(p, dx, dz, quiet) {
    if (p.broken) return; p.broken = true; hide(p.s); drawPane(p);
    const nx = p.ax === 'x' ? 0 : (dx >= 0 ? 1 : -1), nz = p.ax === 'x' ? (dz >= 0 ? 1 : -1) : 0;
    shardBurst(p.cx, p.cy, p.cz, nx, nz, p.ax, p.b - p.a, p.h); try { fx.puff(p.cx, p.cy, p.cz, 0xd6e4e8, 3, 1.1); } catch { /* optional */ }
    if (!quiet) crash(p.cx, p.cy, p.cz);
  }
  const glOut = [];
  function reportPanes() { const n = net(); if (n && glOut.length) { try { n.sendProp({ a: 'gl', ids: glOut.slice(0, 16) }); } catch { /* connection lost */ } } glOut.length = 0; }

  /* ---------- explosive props ---------- */
  function hitBarrel(b, amount, by) {
    if (b.state === 2 || !(amount > 0)) return;
    b.hp -= amount; if (by) b.by = by;
    if (b.hp <= 0) { b.fuse = b.state === 1 ? Math.min(b.fuse, 0.08) : 0.08; b.state = 1; }
    else if (b.hp <= b.k.hp * 0.5 && b.state === 0) { b.state = 1; b.fuse = b.k.burn; b.fireT = 0; ignite(b); }
  }
  function blowBarrel(b) {
    b.state = 2; hide(b.s); drawBarrel(b);
    const r = b.k.radius, x = b.x, y = b.y + b.k.h * 0.45, z = b.z;
    if (chainT <= 0) chainUsed = 0; chainT = 0.9; chainUsed++;
    if (chainUsed <= BARREL.chainDepth + 3) ctx.explode(x, y, z, r, b.k.damage, b.by);
    else try { fx.puff(x, y, z, 0xff8a3a, 6, 2); } catch { /* optional */ }       // the chain limit: the rest only burst
    if (b.gen < BARREL.chainDepth) for (let i = 0; i < barrels.length; i++) {
      const o = barrels[i]; if (o === b || o.state === 2) continue; const dx = o.x - b.x, dz = o.z - b.z; if (dx * dx + dz * dz > r * r * 0.72) continue;
      o.gen = Math.max(o.gen, b.gen + 1); if (b.by) o.by = b.by; const f = BARREL.chainDelay + i * 0.012; o.fuse = o.state === 1 ? Math.min(o.fuse, f) : f; if (o.state === 0) ignite(o); o.state = 1;
    }
  }
  function stepBarrels(dt) {
    let blown = 0; if (chainT > 0) chainT -= dt;
    for (let i = 0; i < barrels.length; i++) {
      const b = barrels[i]; if (b.state !== 1) continue;
      b.fireT -= dt; if (b.fireT <= 0) { b.fireT = 0.075; const near = (b.x - camera.position.x) ** 2 + (b.z - camera.position.z) ** 2 < 4900; if (near) { try { fx.puff(b.x + (Math.random() - 0.5) * 0.16, b.y + b.k.h + 0.05, b.z + (Math.random() - 0.5) * 0.16, Math.random() < 0.7 ? 0xff8a2a : 0x3a3430, 2, 0.5); } catch { /* optional */ } } }
      if (isOnline) continue;                 // the server runs the fuses online
      b.fuse -= dt; if (b.fuse <= 0 && blown < BARREL.perTick) { blown++; blowBarrel(b); }
    }
  }

  /* ---------- bullets ---------- */
  const T = { t: 0, solid: null, ground: false, n: 0, tIn: new Float32Array(PEN_LAYERS), tOut: new Float32Array(PEN_LAYERS), k: new Float32Array(PEN_LAYERS), hit: [null, null, null] };
  function farT(ox, oy, oz, dx, dy, dz, b) {       // where the ray leaves the box
    let t1 = 1e9, u, v;
    if (dx > 1e-7 || dx < -1e-7) { u = (b.x0 - ox) / dx; v = (b.x1 - ox) / dx; if (u > v) u = v, v = (b.x0 - ox) / dx; if (v < t1) t1 = v; }
    if (dy > 1e-7 || dy < -1e-7) { u = (b.y0 - oy) / dy; v = (b.y1 - oy) / dy; if (u > v) u = v, v = (b.y0 - oy) / dy; if (v < t1) t1 = v; }
    if (dz > 1e-7 || dz < -1e-7) { u = (b.z0 - oz) / dz; v = (b.z1 - oz) / dz; if (u > v) u = v, v = (b.z0 - oz) / dz; if (v < t1) t1 = v; }
    return t1;
  }
  /** Walks the bullet through thin solids. Returns the distance where it finally stops; T holds the layers crossed. No allocation. */
  function trace(ox, oy, oz, dx, dy, dz, def) {
    let d = grid.ray(ox, oy, oz, dx, dy, dz, 180), s = grid.hit, g = grid.ground; T.n = 0;
    if (ready && s && !g && s.pen > 0 && def && def.kind !== 'melee' && !def.noPen) {
      const pw = powerOf(def); let left = pw;
      while (T.n < PEN_LAYERS && s && !g && s.pen > 0) {
        const ex = farT(ox, oy, oz, dx, dy, dz, s), len = ex - d; if (!(len >= 0) || len > PEN_MAX_THICK) break;
        const c = penCost(s.pen, len); if (left - c < pw * PEN_MIN_LEFT) break;
        left -= c; const i = T.n++; T.tIn[i] = d; T.tOut[i] = ex; T.k[i] = left / pw; T.hit[i] = s;
        const from = ex + EPS, reach = Math.min(180 - from, 7 + 58 * left); if (reach <= 0.05) { d = from; s = null; g = false; break; }
        const q = grid.ray(ox + dx * from, oy + dy * from, oz + dz * from, dx, dy, dz, reach); s = grid.hit; g = grid.ground; d = from + q;
        if (q >= reach && !s && !g) { s = null; break; }
      }
    }
    T.t = d; T.solid = s; T.ground = g; return d;
  }
  /** Damage left at distance `tt` along the last traced ray. */
  function kAt(tt) { let k = 1; for (let i = 0; i < T.n; i++) if (T.tOut[i] <= tt) k = T.k[i]; return k; }
  /** What the bullet did on its way to `tt`: impacts on both faces, panes, barrels. `visual` = mirror of another client's shot. */
  function applyShot(ox, oy, oz, dx, dy, dz, def, shooter, tt, visual) {
    if (!ready) return; const mine = !visual && (!isOnline || shooter === player);
    for (let i = 0; i < T.n; i++) {
      if (T.tIn[i] > tt) break; const s = T.hit[i], a = T.tIn[i], b = T.tOut[i], col = s.pane ? 0xd6e4e8 : SURF[s.surface] || 0x9a8a68;
      try { fx.puff(ox + dx * a, oy + dy * a, oz + dz * a, col, 3, 0.9); if (b <= tt) fx.puff(ox + dx * b, oy + dy * b, oz + dz * b, col, 3, 1.25); } catch { /* optional */ }
      if (s.pane) { if (mine && enabled) { const p = s.prop; breakPane(p, dx, dz); if (isOnline) glOut.push(p.id); } }
      else play('impact', s.surface, at(ox + dx * a, oy + dy * a, oz + dz * a, 0.8));
    }
    if (mine && enabled) {
      hitGlazing(ox, oy, oz, dx, dy, dz, tt);
      const s = T.solid; if (s && tt >= T.t - 0.02 && s.prop && !s.pane && s.prop.k) damageBarrel(s.prop, def.dmg * kAt(tt), shooter, def.id);
      else if (s && tt >= T.t - 0.02 && s.pane) { breakPane(s.prop, dx, dz); if (isOnline) glOut.push(s.prop.id); }
      reportPanes();
    }
  }
  function damageBarrel(b, amount, by, weapon) {
    const n = net(); if (n) { try { n.sendProp({ a: 'hit', id: b.id, d: Math.round(amount * 10) / 10, w: weapon }); } catch { /* connection lost */ } } else hitBarrel(b, amount, by);
  }

  /* ---------- public ---------- */
  return {
    attach, trace, kAt, applyShot, T,
    get removed() { return removed; }, get glazing() { return glazing; }, get doors() { return doors; }, get panes() { return panes; }, get barrels() { return barrels; }, get enabled() { return enabled; },
    /** Match start, map fully loaded. */
    begin(online) {
      isOnline = !!online; enabled = false; shownKey = 0; hud.door(null); if (!ready) { for (const m of [doorMesh, steelMesh, paneMesh, holeMesh, drumMesh, gasMesh]) if (m) m.visible = false; return; }
      const n = isOnline ? net() : null; authOff = isOnline && !(n && n.propsOk);
      if (authOff) {       // a server that does not know the props: no door or pane in the way, nobody disagrees about the world
        for (const d of doors) { d.open = true; d.ang = SWING; hide(d.s); drawDoor(d); } for (const p of panes) { p.broken = true; hide(p.s); drawPane(p); } for (const b of barrels) { b.state = 2; hide(b.s); drawBarrel(b); }
        for (const m of [doorMesh, steelMesh, paneMesh, holeMesh, drumMesh, gasMesh]) if (m) m.visible = false; return;
      }
      for (const m of [doorMesh, steelMesh, paneMesh, holeMesh, drumMesh, gasMesh]) if (m) m.visible = true;
      resetAll(); enabled = true;
      if (n) { try { n.sendProp({ a: 'man', h: mapId, d: doors.flatMap(q => [Math.round(q.cx * 10), Math.round(q.cz * 10), q.startOpen ? 1 : 0]), g: panes.length, b: barrels.flatMap(q => [Math.round(q.x * 10), Math.round(q.z * 10), q.kind === 'drum' ? 0 : 1]) }); n.sendProp({ a: 'req' }); } catch (e) { console.warn('[props] manifest', e); } }
    },
    end() { enabled = false; focus = null; hud.door(null); shownKey = 0; moving.length = 0; },
    /** Between rounds (offline; online the server sends 'reset'). */
    roundReset() { if (enabled && !isOnline) resetAll(); },
    /** The interact key. True when a door took it. The objective keeps priority through hud.promptOn. */
    press() { if (!enabled || !focus || hud.promptOn || !player.alive || ctx.rules.frozen) return false; useDoor(focus, player); return true; },
    update(dt) {
      if (!enabled) return;
      stepDoors(dt); stepBarrels(dt);
      focusT -= dt; if (focusT <= 0) { focusT = 0.09; focus = pickDoor(); }
      doorPrompt(focus && !hud.promptOn ? focus : null);
      if (sLive > 0) {
        let any = 0;
        for (let i = 0; i < MAX_SHARDS; i++) {
          if (sL[i] <= 0) continue; sL[i] -= dt;
          if (sL[i] <= 0) { shards.setMatrixAt(i, ZERO); continue; }
          any++; const k = i * 3; sV[k + 1] -= 13 * dt; sP[k] += sV[k] * dt; sP[k + 1] += sV[k + 1] * dt; sP[k + 2] += sV[k + 2] * dt;
          if (sP[k + 1] < 0.02) { sP[k + 1] = 0.02; sV[k + 1] *= -0.25; sV[k] *= 0.5; sV[k + 2] *= 0.5; }
          sR[i] += dt * 9; Q.setFromAxisAngle(YAX, sR[i]); V.set(sP[k], sP[k + 1], sP[k + 2]); const z = Math.min(1, sL[i] * 3); S.set(z, z, z); M.compose(V, Q, S); shards.setMatrixAt(i, M);
        }
        sLive = any; shards.instanceMatrix.needsUpdate = true;
      } else if (shards.visible) shards.visible = false;       // no shard alive: no draw call (its program was linked during the load)
    },
    /** A rocket or grenade reached an intact pane: it breaks, the projectile carries on. */
    breakPane(s, owner, dx, dz) { const p = s && s.prop; if (!p || p.broken || !enabled) return false; breakPane(p, dx || 0, dz || 0); if (isOnline && owner === player) { glOut.push(p.id); reportPanes(); } return true; },
    /** Any blast: panes in its radius break, barrels take damage. `real` = this client owns the blast (online: not a mirror). */
    onBlast(x, y, z, radius, by, weaponId, visual) {
      if (!enabled) return; const own = !visual && (!isOnline || by === player || (!by && ctx.isHost && ctx.isHost())); let loud = 0;       // at most three crashes per blast
      for (let i = 0; i < panes.length; i++) {
        const p = panes[i]; if (p.broken) continue; const dx = p.cx - x, dy = p.cy - y, dz = p.cz - z, q = dx * dx + dy * dy + dz * dz, r = radius * 1.15; if (q > r * r) continue;
        if (own) { breakPane(p, dx, dz, loud++ >= 3); if (isOnline) { glOut.push(p.id); if (glOut.length >= 16) reportPanes(); } }
      }
      if (own) reportPanes();
      if (!own || (isOnline && weaponId === 'barrel')) return;       // online the server chains barrels itself
      for (let i = 0; i < barrels.length; i++) {
        const b = barrels[i]; if (b.state === 2) continue; const dx = b.x - x, dy = b.y + 0.4 - y, dz = b.z - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d >= radius || d < 0.05) continue;
        damageBarrel(b, 120 * (1 - d / radius) + 10, by, weaponId && weaponId !== 'barrel' ? weaponId : 'frag');
      }
    },
    onNet(m) {
      if (!ready) return;
      switch (m.op) {
        case 'door': { const d = doors[m.id]; if (d) setDoor(d, !!m.o, m.s > 0 ? 1 : -1); break; }
        case 'gl': for (const id of m.ids || []) { const p = panes[id]; if (p && !p.broken) breakPane(p, p.cx - camera.position.x, p.cz - camera.position.z); } break;
        case 'brl': { const b = barrels[m.id]; if (b && b.state === 0) { b.state = 1; b.fireT = 0; ignite(b); } break; }
        case 'boom': { const b = barrels[m.id]; if (!b || b.state === 2) break; b.state = 2; hide(b.s); drawBarrel(b); ctx.remoteBlast(b.x, b.y + b.k.h * 0.45, b.z, b.k.radius, b.k.damage, m.by); break; }
        case 'sync': {
          if (Array.isArray(m.d)) for (let i = 0; i < m.d.length && i < doors.length; i++) { const d = doors[i], v = m.d[i], o = !!v; if (v === 1 || v === -1) d.side = v === d.noSwing ? -v : v; d.open = o; d.ang = o ? SWING : 0; d.moving = false; d.listed = false; if (o) hide(d.s); else show(d.s); drawDoor(d); }
          moving.length = 0;
          for (const id of m.g || []) { const p = panes[id]; if (p && !p.broken) { p.broken = true; hide(p.s); drawPane(p); } }
          for (const e of m.b || []) { const b = barrels[e[0]]; if (!b) continue; b.state = e[1]; if (b.state === 2) { hide(b.s); drawBarrel(b); } }
          break;
        }
        case 'reset': if (enabled) resetAll(); break;
        case 'off': enabled = false; for (const d of doors) { d.open = true; hide(d.s); } for (const p of panes) { p.broken = true; hide(p.s); } for (const b of barrels) { b.state = 2; hide(b.s); } for (const q of [doorMesh, steelMesh, paneMesh, holeMesh, drumMesh, gasMesh]) if (q) q.visible = false; hud.door(null); break;
      }
    },
  };
}
