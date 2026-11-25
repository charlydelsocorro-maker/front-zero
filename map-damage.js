// FRONT ZÉRO — war damage of a heavily contested map (living front, phase 2). Decor only: no solid, no nav node, no spawn is touched,
// nothing collides with it. Level 1 = damaged, 2 = ruined (the server's heat of the territory). Loaded by front-ui.js at a match start.
// Cost budget: one merged mesh (scorch marks, rubble piles, glass shards) drawn with a material BORROWED from the loaded map (same
// shader program), and at high quality two point clouds (smoke columns, small fires) whose material is a clone of the map's own
// particle material (same program). So: no new shader program, 1 to 3 draw calls, about 8 000 triangles at most, a 10 Hz update of a few
// hundred floats for the smoke. Low quality ("bas" preset): scorch marks and rubble only, one draw call.
// Placement is seeded by the map id and level, so every player sees the same ruins.

import * as THREE from 'three';

const COUNTS = { 1: { scorch: 8, rubble: 10, shards: 6, smoke: 1, fire: 1 }, 2: { scorch: 16, rubble: 20, shards: 14, smoke: 3, fire: 5 } };
const SMOKE_N = 22, FIRE_N = 12, SMOKE_H = 16;

function rng(text) { let h = 2166136261 >>> 0; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0; return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A growable buffer of triangles: position, normal, colour (non-indexed). */
function tris() {
  const P = [], N = [], C = [];
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };       // vertex colours are linear
  const col = hex => [lin(hex >> 16 & 255), lin(hex >> 8 & 255), lin(hex & 255)];
  function tri(a, b, c, n, ca, cb, cc) { P.push(...a, ...b, ...c); N.push(...n, ...n, ...n); C.push(...ca, ...(cb || ca), ...(cc || ca)); }
  function quad(a, b, c, d, n, k) { tri(a, b, c, n, k); tri(a, c, d, n, k); }
  /** box centred at (x, y, z), size (sx, sy, sz), turned by ry around Y and tilted by rx around X */
  function box(x, y, z, sx, sy, sz, ry, rx, hex, shade) {
    const cy = Math.cos(ry), sy_ = Math.sin(ry), cx = Math.cos(rx), sx_ = Math.sin(rx);
    const tf = (u, v, w) => { const v2 = v * cx - w * sx_, w2 = v * sx_ + w * cx; return [x + u * cy + w2 * sy_, y + v2, z - u * sy_ + w2 * cy]; };
    const tn = (u, v, w) => { const v2 = v * cx - w * sx_, w2 = v * sx_ + w * cx; return [u * cy + w2 * sy_, v2, -u * sy_ + w2 * cy]; };
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, base = col(hex);
    const k = f => [base[0] * f, base[1] * f, base[2] * f];
    const faces = [
      [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz], [1, 0, 0], 0.86],
      [[-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz], [-1, 0, 0], 0.8],
      [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [0, 1, 0], 1],
      [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], [0, 0, 1], 0.9],
      [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [0, 0, -1], 0.84],
    ];
    for (const [a, b, c, d, n, f] of faces) quad(tf(...a), tf(...b), tf(...c), tf(...d), tn(...n), k(f * (shade || 1)));
  }
  /** irregular flat disc (scorch): dark centre, edge closer to the ground colour */
  function disc(x, y, z, r, R, inner, outer, seg = 12) {
    const ci = col(inner), co = col(outer), pts = [];
    for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2, rr = r * (0.72 + 0.5 * R()); pts.push([x + Math.cos(a) * rr, y, z + Math.sin(a) * rr]); }
    for (let i = 0; i < seg; i++) tri([x, y + 0.012, z], pts[(i + 1) % seg], pts[i], [0, 1, 0], ci, co, co);
  }
  /** irregular broken chunk: a jittered, flattened icosahedron with faceted shading (never a box) */
  const ICO = (() => { const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(q => { const l = Math.hypot(...q); return q.map(c => c / l); });
    const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]; return { v, f }; })();
  const OCT = { v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], f: [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]] };
  function rock(x, y, z, sx, sy, sz, ry, R, hex, shade) {
    const c0 = col(hex), cy = Math.cos(ry), sn = Math.sin(ry), M = sx < 0.1 ? OCT : ICO;       // gravel: 8 faces, chunks: 20
    const pts = M.v.map(([a, b, c]) => { const j = 0.72 + R() * 0.5, u = a * sx * j, v = Math.max(-0.35, b) * sy * j, w = c * sz * j; return [x + u * cy + w * sn, y + v, z - u * sn + w * cy]; });
    for (const [i, j, k] of M.f) {
      const A = pts[i], Bp = pts[j], Cp = pts[k], ux = Bp[0] - A[0], uy = Bp[1] - A[1], uz = Bp[2] - A[2], vx = Cp[0] - A[0], vy = Cp[1] - A[1], vz = Cp[2] - A[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const f = (0.72 + 0.28 * Math.max(0, ny)) * (shade || 1);
      tri(A, Bp, Cp, [nx, ny, nz], [c0[0] * f, c0[1] * f, c0[2] * f]);
    }
  }
  function shard(x, y, z, s, a, hex) { const c = col(hex); tri([x, y, z], [x + Math.cos(a) * s, y, z + Math.sin(a) * s], [x + Math.cos(a + 2.2) * s * 0.6, y, z + Math.sin(a + 2.2) * s * 0.6], [0, 1, 0], c); }
  return { P, N, C, box, rock, disc, shard, get count() { return P.length / 9; } };
}

/** Find in the loaded scene: an opaque standard material with vertex colours and no texture (borrowed, never disposed), and the map's particle material. */
function borrow(scene) {
  let vc = null, plain = null, pts = null;
  const white = m => m.color && m.color.r > 0.8 && m.color.g > 0.8 && m.color.b > 0.8;
  scene.traverse(o => {
    const m = o.material; if (!m || Array.isArray(m)) return;
    if (o.isPoints && m.isPointsMaterial && m.userData && m.userData.perMap && m.map && !pts) pts = m;
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || m.transparent || m.map || m.alphaTest || !o.visible) return;
    const g = o.geometry, ca = g && g.attributes && g.attributes.color;
    if (m.isMeshStandardMaterial && m.vertexColors && ca && white(m) && (!vc || (o.receiveShadow && !vc.o.receiveShadow))) vc = { m, o, itemSize: ca.itemSize };
    else if (m.isMeshStandardMaterial && !m.vertexColors && !plain) plain = { m, o };
  });
  const pick = vc || plain;
  return { mat: pick ? pick.m : null, owner: pick ? pick.o : null, vertexColors: !!vc, colorSize: vc ? vc.itemSize : 3, points: pts };
}

/**
 * opts: { engine, level 1|2, map, settings }. Returns { remove(), stats } or null when nothing could be placed.
 */
export function applyDamage({ engine, level, map, settings }) {
  const lv = level >= 2 ? 2 : level >= 1 ? 1 : 0;
  if (!lv || !engine || !engine.internals) return null;
  const I = engine.internals, scene = I.scene;
  const world = engine.world, nav = engine.nav, grid = I.grid;
  if (!scene || !world || !world.solids || !nav || !grid) return null;
  const low = (() => { try { const q = settings && settings.get('graphics.preset'); return q === 'bas' || q === 'mobile'; } catch { return false; } })();       // 'mobile' (touch devices) is below 'bas'
  const B = borrow(scene);
  if (!B.mat) return null;
  const R = rng(`${map}:${lv}`), size = world.size || 60, N = COUNTS[lv];
  const groundAt = (x, z) => (world.levelAt ? world.levelAt(x, z) : 0);
  const spawns = world.spawns || [], objectives = [];
  try { const o = world.objectives; const add = v => { if (Array.isArray(v)) for (const q of v) if (q && typeof q.x === 'number') objectives.push(q); }; if (Array.isArray(o)) add(o); else if (o) for (const k of Object.keys(o)) add(o[k]); } catch { /* optional */ }
  const near = (x, z, list, r) => list.some(s => s && Math.hypot((s.x || 0) - x, (s.z || 0) - z) < r);
  const buf = [];
  /** open ground: a ground nav node right there, no solid in the first 0.5 m above it */
  function open(x, z) {
    const g = groundAt(x, z), q = nav.nearest(x, z);
    if (!q || Math.hypot(q[0] - x, q[1] - z) > 0.36) return null;
    const k = grid.boxQuery(x - 0.2, x + 0.2, z - 0.2, z + 0.2, buf);
    for (let i = 0; i < k; i++) { const s = buf[i]; if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.y1 > g + 0.05 && s.y0 < g + 0.5) return null; }
    return g;
  }
  function wallNear(x, z, g) {
    const k = grid.boxQuery(x - 1, x + 1, z - 1, z + 1, buf);
    for (let i = 0; i < k; i++) { const s = buf[i]; if (s.y1 - g > 1.6 && s.y0 <= g + 0.3 && Math.min(s.x1 - s.x0, s.z1 - s.z0) < 1.4) return true; }
    return false;
  }
  const T = tris(), placed = { scorch: 0, rubble: 0, shards: 0 }, spots = { scorch: [], rubble: [] };
  const ground = [0x3a342c, 0x2e2b26];
  const pick = (want, test) => { const out = []; for (let tries = 0; tries < want * 40 && out.length < want; tries++) { const x = (R() * 2 - 1) * size * 0.92, z = (R() * 2 - 1) * size * 0.92; const g = test(x, z); if (g !== null && g !== undefined) out.push([x, g, z]); } return out; };
  // scorch marks: open ground, away from spawns
  for (const [x, g, z] of pick(low ? Math.ceil(N.scorch / 2) : N.scorch, (x, z) => (near(x, z, spawns, 4) ? null : open(x, z)))) { T.disc(x, g + 0.035, z, 1.4 + R() * 1.8, R, 0x080706, ground[(R() * 2) | 0], 14); placed.scorch++; spots.scorch.push([x, g, z]); }
  // rubble piles: against walls, never on a doorway or a corridor (nav.splits), away from spawns and objectives
  const piles = pick(low ? Math.ceil(N.rubble / 2) : N.rubble, (x, z) => {
    if (near(x, z, spawns, 4) || near(x, z, objectives, 5)) return null;
    const g = open(x, z); if (g === null || !wallNear(x, z, g)) return null;
    try { if (nav.splits && nav.splits(x - 0.7, x + 0.7, z - 0.7, z + 0.7, g)) return null; } catch { /* keep */ }
    return g;
  });
  const RUB = [0x7a756b, 0x6c675e, 0x857e70, 0x74463a, 0x4a4743, 0x5e4c39, 0x8e887b];
  for (const [x, g, z] of piles) {
    const n = 10 + ((R() * 7) | 0);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 1.1, s = 0.16 + R() * 0.42 * (1.2 - d / 1.4), h = s * (0.35 + R() * 0.6);
      T.rock(x + Math.cos(a) * d, g + h * 0.2 + (1.1 - d) * 0.1, z + Math.sin(a) * d, s * (0.6 + R() * 0.5), h, s * (0.5 + R() * 0.4), R() * 6.28, R, RUB[(R() * RUB.length) | 0], 0.85 + R() * 0.3);
    }
    for (let i = 0; i < 2; i++) { const a = R() * 6.28; T.box(x + Math.cos(a) * 0.5, g + 0.12, z + Math.sin(a) * 0.5, 1.1 + R() * 0.6, 0.07, 0.09, a + 1.2, (R() - 0.5) * 0.5, 0x4a4844, 1); }       // bent rebar / beams
    for (let i = 0; i < 9; i++) { const a = R() * 6.28, d = 0.9 + R() * 0.9, s = 0.05 + R() * 0.08; T.rock(x + Math.cos(a) * d, g + s * 0.2, z + Math.sin(a) * d, s, s * 0.6, s, R() * 6.28, R, RUB[(R() * RUB.length) | 0], 0.9); }       // gravel around the pile
    placed.rubble++; spots.rubble.push([x, g, z]);
  }
  // broken glass: shards on the ground on both sides of some windows (the panes themselves are untouched)
  if (!low) {
    let panes = []; try { panes = (I.props && (I.props.glazing && I.props.glazing.length ? I.props.glazing : I.props.panes)) || []; } catch { panes = []; }
    const list = panes.filter(p => p && typeof p.cx === 'number' && typeof p.cz === 'number'), start = (R() * Math.max(1, list.length)) | 0;
    for (let k = 0; k < list.length && placed.shards < N.shards; k++) {
      const p = list[(start + k * 7) % list.length];
      const nx = typeof p.nx === 'number' ? p.nx : p.ax === 'x' ? 0 : 1, nz = typeof p.nz === 'number' ? p.nz : p.ax === 'x' ? 1 : 0;
      const sill = (typeof p.y0 === 'number' ? p.y0 : p.cy - 0.8);
      let done = false;
      for (const side of [1, -1]) {
        const x = p.cx + nx * 0.75 * side, z = p.cz + nz * 0.75 * side, g = open(x, z);
        if (g === null || sill - g < 0.3 || sill - g > 1.6) continue;       // a ground-floor window only
        for (let i = 0; i < 10; i++) { const u = (R() - 0.5) * 1.6, v = R() * 0.9; T.shard(x + nz * u + nx * v * side, g + 0.018, z - nx * u + nz * v * side, 0.05 + R() * 0.09, R() * 6.28, R() < 0.5 ? 0xb9d2dc : 0x8fb0bc); }
        done = true;
      }
      if (done) placed.shards++;
    }
  }
  // smoke and fire spots are chosen now: the fires leave a scorch mark in the merged mesh
  let smokeSpots = [], fireSpots = [];
  if (!low && B.points) {
    const spots = pick(N.smoke + N.fire, (x, z) => (near(x, z, spawns, 6) || near(x, z, objectives, 4) ? null : open(x, z)));
    smokeSpots = spots.slice(0, N.smoke); fireSpots = spots.slice(N.smoke);
    for (const f of fireSpots) T.disc(f[0], f[1] + 0.03, f[2], 0.9, R, 0x0b0a09, 0x2a2622);
  }
  if (!T.count) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(T.P), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(T.N), 3));
  if (B.vertexColors) {       // same attribute layout as the owner of the material (rgb or rgba): same shader program
    let C = T.C; if (B.colorSize === 4) { C = []; for (let i = 0; i < T.C.length; i += 3) C.push(T.C[i], T.C[i + 1], T.C[i + 2], 1); }
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), B.colorSize));
  }
  const og = B.owner && B.owner.geometry;
  if (og && og.attributes.uv && !geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(T.count * 6), 2));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, B.mat); mesh.name = 'fz-damage'; mesh.receiveShadow = !!(B.owner && B.owner.receiveShadow); mesh.castShadow = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  scene.add(mesh);
  const added = [mesh], clouds = [];
  // smoke columns and small fires (high quality only): clones of the map's particle material, same program
  if (!low && B.points) {
    const cloud = (count, color, opacity, sz, additive) => {
      const m = B.points.clone(); m.color.setHex(color); m.opacity = opacity; m.size = sz; m.depthWrite = false; m.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending; m.userData = { fzDamage: true };
      const g = new THREE.BufferGeometry(), pos = new Float32Array(count * 3); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pt = new THREE.Points(g, m); pt.frustumCulled = false; pt.name = 'fz-damage-pts'; scene.add(pt); added.push(pt);
      return { pt, pos, m, g };
    };
    const cols = smokeSpots.map(([x, g, z]) => ({ x, g, z, ph: R() * 10 }));
    if (cols.length) { const c = cloud(cols.length * SMOKE_N, 0x1e1c1a, 0.62, 6.5, false); clouds.push({ kind: 'smoke', ...c, cols }); }
    if (fireSpots.length) { const c = cloud(fireSpots.length * FIRE_N, 0xff7a2a, 0.95, 1.1, true); clouds.push({ kind: 'fire', ...c, cols: fireSpots.map(([x, g, z]) => ({ x, g, z, ph: R() * 10 })) }); }
  }
  // 10 Hz: smoke rises and drifts, fires flicker. No allocation; stops with the match (front-ui.js calls remove()).
  let t0 = performance.now(), timer = 0;
  const step = force => {
    if (!force && (!engine.running || document.hidden)) return;
    const t = (performance.now() - t0) / 1000;
    for (const c of clouds) {
      const pos = c.pos;
      if (c.kind === 'smoke') {
        for (let k = 0; k < c.cols.length; k++) { const q = c.cols[k]; for (let i = 0; i < SMOKE_N; i++) { const f = ((t * 0.06 + i / SMOKE_N + q.ph) % 1), y = f * SMOKE_H, j = (k * SMOKE_N + i) * 3; pos[j] = q.x + Math.sin(q.ph + y * 0.35) * (0.3 + f) + f * f * 4; pos[j + 1] = q.g + 0.4 + y; pos[j + 2] = q.z + Math.cos(q.ph + y * 0.3) * (0.3 + f) + f * f * 1.5; } }
      } else {
        for (let k = 0; k < c.cols.length; k++) { const q = c.cols[k]; for (let i = 0; i < FIRE_N; i++) { const f = ((t * 0.9 + i / FIRE_N + q.ph) % 1), j = (k * FIRE_N + i) * 3; pos[j] = q.x + Math.sin(i * 2.4 + q.ph) * 0.25 * (1 - f); pos[j + 1] = q.g + 0.15 + f * 0.9; pos[j + 2] = q.z + Math.cos(i * 1.7 + q.ph) * 0.25 * (1 - f); } }
        c.m.opacity = 0.75 + 0.2 * Math.sin(t * 11) * Math.sin(t * 7.3);
      }
      c.g.attributes.position.needsUpdate = true;
    }
  };
  if (clouds.length) { step(true); timer = setInterval(step, 100); }
  const stats = { level: lv, low, tris: T.count, scorch: placed.scorch, rubble: placed.rubble, shards: placed.shards, smoke: clouds.filter(c => c.kind === 'smoke').reduce((n, c) => n + c.cols.length, 0), fire: clouds.filter(c => c.kind === 'fire').reduce((n, c) => n + c.cols.length, 0), borrowed: B.vertexColors ? 'vertexColors' : 'plain', draws: added.length, spots: { ...spots, smoke: smokeSpots, fire: fireSpots } };
  return {
    stats,
    remove() {
      clearInterval(timer); timer = 0;
      for (const o of added) { try { scene.remove(o); o.geometry.dispose(); if (o.material && o.material.userData && o.material.userData.fzDamage) o.material.dispose(); } catch { /* gone */ } }
      added.length = 0;
    },
  };
}
