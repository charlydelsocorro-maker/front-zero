// FRONT ZÉRO — breachable panels in the map layout (no DOM; testable under Node). Hooked in maps.js like map-seams.js:
//   carve(L, id): cuts each panel of map-breach-data.js out of the wall (or floor) boxes it sits in, drawn and solid, and adds one solid
//                 per panel ({..., breach: index}); a solid a map module tagged `breachable: true` is adopted as it is. Result: L.breach.
//   draw(L, root, M, THREE): one mesh for every panel of the map (intact look, plus the blown-out look kept collapsed), the map's own
//                 vertex-colour material (no new shader program). engine-breach.js shows one or the other per panel at run time.
// If this module or a panel fails, the map stays as it was (that panel is simply not breachable).
import './map-breach-data.js';

const EPS = 1e-4;
const ov = (a, b) => a.x1 > b.x0 + EPS && a.x0 < b.x1 - EPS && a.y1 > b.y0 + EPS && a.y0 < b.y1 - EPS && a.z1 > b.z0 + EPS && a.z0 < b.z1 - EPS;
/** Pieces of box s outside box h (s itself when they do not touch). */
function cut(s, h) {
  if (!ov(s, h)) return [s];
  const out = [], P = (x0, x1, y0, y1, z0, z1) => { if (x1 - x0 > EPS && y1 - y0 > EPS && z1 - z0 > EPS) out.push({ ...s, x0, x1, y0, y1, z0, z1 }); };
  const ix0 = Math.max(s.x0, h.x0), ix1 = Math.min(s.x1, h.x1), iy0 = Math.max(s.y0, h.y0), iy1 = Math.min(s.y1, h.y1);
  P(s.x0, ix0, s.y0, s.y1, s.z0, s.z1); P(ix1, s.x1, s.y0, s.y1, s.z0, s.z1);
  P(ix0, ix1, s.y0, iy0, s.z0, s.z1); P(ix0, ix1, iy1, s.y1, s.z0, s.z1);
  P(ix0, ix1, iy0, iy1, s.z0, Math.max(s.z0, h.z0)); P(ix0, ix1, iy0, iy1, Math.min(s.z1, h.z1), s.z1);
  return out;
}
const sameBox = (a, b) => Math.abs(a.x0 - b.x0) < 1e-3 && Math.abs(a.x1 - b.x1) < 1e-3 && Math.abs(a.y0 - b.y0) < 1e-3 && Math.abs(a.y1 - b.y1) < 1e-3 && Math.abs(a.z0 - b.z0) < 1e-3 && Math.abs(a.z1 - b.z1) < 1e-3;
/** Replaces each listed item of arr by its pieces: the first piece takes its slot, the others go to the end (same order on every build). */
function splitIn(arr, items, h) {
  const gone = [];
  for (const s of items) { const i = arr.indexOf(s); if (i < 0) continue; const p = cut(s, h); if (p.length) { arr[i] = p[0]; for (let k = 1; k < p.length; k++) arr.push(p[k]); } else gone.push(i); }
  gone.sort((a, b) => b - a); for (const i of gone) arr.splice(i, 1);
}

/** Is either side of a wall panel blocked (stairs, a neighbour's wall) over more than 45 % of its width, from knee to head height, 0.8 m deep?
 *  Keeps a later map edit (a staircase moved behind a panel) from leaving a hole that leads nowhere. */
function blockedSide(L, s, b, own) {
  const ax = s.ax, u0 = (ax === 'x' ? b.x0 : b.z0) + .15, u1 = (ax === 'x' ? b.x1 : b.z1) - .15, W = u1 - u0;
  for (const sg of [-1, 1]) {
    const n0 = sg > 0 ? (ax === 'x' ? b.z1 : b.x1) : (ax === 'x' ? b.z0 : b.x0) - .8, n1 = n0 + .8;
    const r = ax === 'x' ? { x0: u0, x1: u1, z0: n0, z1: n1, y0: b.y0 + .4, y1: b.y0 + 1.8 } : { x0: n0, x1: n1, z0: u0, z1: u1, y0: b.y0 + .4, y1: b.y0 + 1.8 };
    const iv = [];
    for (const q of L.solids) { if (own.includes(q) || !ov(q, r)) continue; const a = Math.max(u0, ax === 'x' ? q.x0 : q.z0), c = Math.min(u1, ax === 'x' ? q.x1 : q.z1); if (c > a) iv.push([a, c]); }
    iv.sort((p, q) => p[0] - q[0]); let cov = 0, e = u0;
    for (const [a, c] of iv) { if (c <= e) continue; cov += c - Math.max(a, e); e = c; }
    if (cov > W * .45) return true;
  }
  return false;
}
/** Static panel: find the wall or floor box it sits in and cut it out. Returns {box, surface} or null (nothing changed). */
function carveStatic(L, s, D) {
  const nb = D.box(s), wall = s.ax !== 'y';
  let host = null, best = 1e9;
  if (wall) {
    const cy = s.y0 + s.h / 2;
    for (const q of L.solids) {
      if (q.breach !== undefined || !(s.x >= q.x0 - .01 && s.x <= q.x1 + .01 && s.z >= q.z0 - .01 && s.z <= q.z1 + .01 && cy >= q.y0 && cy <= q.y1)) continue;
      const t = s.ax === 'x' ? q.z1 - q.z0 : q.x1 - q.x0, d = Math.abs(t - s.t); if (d < best) { best = d; host = q; }
    }
    if (!host || best > .2) return null;
    if (s.ax === 'x') { nb.z0 = host.z0; nb.z1 = host.z1; } else { nb.x0 = host.x0; nb.x1 = host.x1; }
  } else {
    for (const q of L.solids) {
      if (q.breach !== undefined || !(s.x >= q.x0 && s.x <= q.x1 && s.z >= q.z0 && s.z <= q.z1) || Math.abs(q.y1 - s.y) > .06) continue;
      const d = Math.abs(q.y1 - q.y0 - s.t); if (d < best) { best = d; host = q; }
    }
    if (!host || best > .15) return null;
    nb.y0 = host.y0; nb.y1 = host.y1;
  }
  // every solid and drawn box in the hole must cross it whole (a wall, a slab), never a stair, a frame or a vehicle
  const spans = q => wall ? (s.ax === 'x' ? q.z0 <= nb.z0 + 1e-3 && q.z1 >= nb.z1 - 1e-3 : q.x0 <= nb.x0 + 1e-3 && q.x1 >= nb.x1 - 1e-3) : q.y0 <= nb.y0 + 1e-3 && q.y1 >= nb.y1 - 1e-3;
  const sol = L.solids.filter(q => ov(q, nb));
  if (sol.some(q => q.breachable || q.breach !== undefined || !spans(q))) return null;
  const ops = [];
  for (const o of L.ops) {
    if (o.t === 'b') { if (!ov(o, nb)) continue; if (o.fit || o.vh || o.bq || !spans(o)) return null; ops.push(o); continue; }
    if (o.x === undefined || o.z === undefined) continue;
    const y = o.y === undefined ? 0 : o.y;
    if (o.x > nb.x0 && o.x < nb.x1 && o.z > nb.z0 && o.z < nb.z1 && y > nb.y0 - .05 && y < nb.y1) return null;       // something else drawn inside the hole
  }
  if (!ops.length) return null;
  if (wall && blockedSide(L, s, nb, sol)) return null;       // a staircase or a wall right behind: the panel stays a plain wall
  splitIn(L.solids, sol, nb); splitIn(L.ops, ops, nb);
  return { box: nb, surface: host.surface || 'concrete' };
}

/** Cuts the panels of map `id` into layout L (once). Sets L.breach = [{id, spec, box, ok}] with .hash and .extras. */
export function carve(L, id) {
  const D = globalThis.FZBreachData;
  if (!L || !D || L.breach || !Array.isArray(L.solids) || !Array.isArray(L.ops)) return L;
  const tags = [];
  for (let i = L.ops.length - 1; i >= 0; i--) {       // Kit-style tag on a drawn box: its solid becomes the panel, the box is drawn by the game
    const o = L.ops[i]; if (o.t !== 'b' || !o.breachable) continue;
    const q = L.solids.find(s => sameBox(s, o)); if (q) { q.breachable = true; if (!q.bkind && typeof o.breachable === 'string') q.bkind = o.breachable; if (!q.bkind && o.bkind) q.bkind = o.bkind; }
    L.ops.splice(i, 1);
  }
  for (const s of L.solids) if (s.breachable) { const sp = D.fromBox(s, s.bkind); if (sp) tags.push({ s, sp }); else s.breachable = false; }
  const extras = D.parseExtras(D.packExtras(D.panelsFor(id, tags.map(t => t.sp)).slice((D.MAPS[id] || []).length))) || [];
  const list = D.panelsFor(id, extras), out = [];
  const allOpen = !!globalThis.FZ_BREACH_ALL_OPEN;       // audit tools: the map as it is once every panel is blown
  for (let i = 0; i < list.length; i++) {
    const sp = list[i], tag = tags.find(t => D.same(t.sp, sp)), p = { id: i, spec: sp, box: null, ok: false, kind: sp.k };
    try {
      if (tag) { tag.s.breach = i; p.box = { x0: tag.s.x0, x1: tag.s.x1, y0: tag.s.y0, y1: tag.s.y1, z0: tag.s.z0, z1: tag.s.z1 }; p.ok = true; if (allOpen) { const k = L.solids.indexOf(tag.s); if (k >= 0) L.solids.splice(k, 1); } }
      else { const r = carveStatic(L, sp, D); if (r) { p.box = r.box; p.ok = true; if (!allOpen) L.solids.push({ ...r.box, surface: r.surface, breach: i }); } }
    } catch (e) { p.ok = false; }
    out.push(p);
  }
  out.hash = D.hash(list); out.extras = D.packExtras(list.slice((D.MAPS[id] || []).length)); out.mapId = id; out.open = allOpen;
  L.breach = out;
  return L;
}

/* ---------- drawing ---------- */
const rn = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7 + 7.3) * 43758.5453; return x - Math.floor(x); };
const COL = {
  plaster: [0xd8d0bf, 0xcfc6b2, 0xe2dbcb, 0xc3b9a4], frame: 0x6a5a44, frameS: 0x2a2622, strap: 0x5d6266, red: 0xb3352a, white: 0xe9e4d6, crack: 0x5a5146,
  wood: [0x8a6a44, 0x7a5c3a, 0x9a7650, 0x6c5134], post: 0x5c4630, gap: 0x14120f, steel: [0x6d7468, 0x7a8174, 0x646b60], rib: 0x575d54, rivet: 0x3d413c, yel: 0xd6a92a, blk: 0x1d1d1b,
  core: 0x8c8474, burnt: 0x2b2723, splinter: 0xb58f5c, torn: 0x4c524a, iron: 0x3b3a38,
};
/** Panel-local frame: u along the wall, v up from the floor (hatch: u = x, v = z, w = up), w across. Returns (u,v,w) -> world. */
function frameOf(p) {
  const s = p.spec, b = p.box;
  if (s.ax === 'y') { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, cy = (b.y0 + b.y1) / 2; return { W: b.x1 - b.x0, H: b.z1 - b.z0, T: b.y1 - b.y0, at: (u, v, w, o) => { o[0] = cx + u; o[1] = cy + w; o[2] = cz + v; } }; }
  if (s.ax === 'x') { const cz = (b.z0 + b.z1) / 2, cx = (b.x0 + b.x1) / 2; return { W: b.x1 - b.x0, H: b.y1 - b.y0, T: b.z1 - b.z0, at: (u, v, w, o) => { o[0] = cx + u; o[1] = b.y0 + v; o[2] = cz + w; } }; }
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; return { W: b.z1 - b.z0, H: b.y1 - b.y0, T: b.x1 - b.x0, at: (u, v, w, o) => { o[0] = cx + w; o[1] = b.y0 + v; o[2] = cz + u; } };
}
class Geo {
  constructor(THREE) { this.T = THREE; this.p = []; this.n = []; this.c = []; this.a = []; this.C = new THREE.Color(); }
  get count() { return this.p.length / 3; }
  /** Box centred at (u,v,w) with half sizes (hu,hv,hw), turned by rot in the u-v plane. */
  box(F, u, v, w, hu, hv, hw, rot, hex, ao = 0, shade = 0) {
    const c = Math.cos(rot), s = Math.sin(rot), P = [], o = [0, 0, 0];
    for (let i = 0; i < 8; i++) { const du = i & 1 ? hu : -hu, dv = i & 2 ? hv : -hv, dw = i & 4 ? hw : -hw; F.at(u + du * c - dv * s, v + du * s + dv * c, w + dw, o); P.push([o[0], o[1], o[2]]); }
    F.at(u, v, w, o); const cx = o[0], cy = o[1], cz = o[2];
    this.C.set(hex); const r0 = this.C.r, g0 = this.C.g, b0 = this.C.b;
    for (const [a, b, cc, d] of [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]) {
      const A = P[a], B = P[b], Cc = P[cc], Dd = P[d];
      let nx = (B[1] - A[1]) * (Dd[2] - A[2]) - (B[2] - A[2]) * (Dd[1] - A[1]), ny = (B[2] - A[2]) * (Dd[0] - A[0]) - (B[0] - A[0]) * (Dd[2] - A[2]), nz = (B[0] - A[0]) * (Dd[1] - A[1]) - (B[1] - A[1]) * (Dd[0] - A[0]);
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const fx = (A[0] + Cc[0]) / 2 - cx, fy = (A[1] + Cc[1]) / 2 - cy, fz = (A[2] + Cc[2]) / 2 - cz, flip = nx * fx + ny * fy + nz * fz < 0;
      if (flip) { nx = -nx; ny = -ny; nz = -nz; }
      const k = 1 + shade * (ny > .5 ? .06 : ny < -.5 ? -.12 : 0);
      const tri = flip ? [A, Dd, Cc, A, Cc, B] : [A, B, Cc, A, Cc, Dd];
      for (const q of tri) { this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz); this.c.push(r0 * k, g0 * k, b0 * k); this.a.push(ao); }
    }
  }
}
const pick = (arr, a, b) => arr[Math.floor(rn(a, b) * arr.length) % arr.length];

/** Intact look: body (cleared when blown), then the blown look (kept collapsed until then). */
function body(G, F, kind, sd) {
  const W = F.W, H = F.H, T = F.T, hw = W / 2, ht = T / 2;
  const frame = (hex, pr = .045, wd = .09) => {       // a frame proud of both faces, overlapping the wall edges (hides the cut)
    G.box(F, -hw - wd / 2 + .02, (H + wd - .02 + .004) / 2, 0, wd / 2, (H + wd - .02 - .004) / 2, ht + pr, 0, hex, .05, 1);
    G.box(F, hw + wd / 2 - .02, (H + wd - .02 + .004) / 2, 0, wd / 2, (H + wd - .02 - .004) / 2, ht + pr, 0, hex, .05, 1);
    G.box(F, 0, H + wd / 2 - .02, 0, hw + wd - .02, wd / 2, ht + pr, 0, hex, .05, 1);
    if (kind !== 'hatch' && kind !== 'planks') G.box(F, 0, -.005 + .03, 0, hw + wd - .02, .03, ht + pr * .6, 0, hex, .05, 1);
  };
  if (kind === 'plaster') {
    frame(COL.frame);
    const nu = 3, nv = 3;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const u0 = -hw + W * i / nu, u1 = -hw + W * (i + 1) / nu, v0 = H * j / nv, v1 = H * (j + 1) / nv, pr = .004 + .01 * rn(sd + i, j);
      G.box(F, (u0 + u1) / 2, (v0 + v1) / 2, 0, (u1 - u0) / 2, (v1 - v0) / 2, ht + pr, 0, pick(COL.plaster, sd + i * 3, j), .04 * rn(j, sd + i), 0);
    }
    for (const v of [H * .3, H * .72]) G.box(F, 0, v, 0, hw - .02, .035, ht + .022, 0, COL.strap, .1, 1);       // steel straps through the patch
    for (const sg of [-1, 1]) for (const r of [-.62, .62]) G.box(F, 0, H * .52, sg * (ht + .024), Math.min(W, H) * .46, .045, .004, r, sg > 0 ? COL.red : COL.white, 0);       // painted cross on each face
    for (let k = 0; k < 4; k++) { const sg = k & 1 ? 1 : -1, u = (rn(sd, k) - .5) * W * .7, v = H * (.15 + .7 * rn(k, sd)); G.box(F, u, v, sg * (ht + .016), .16 + .14 * rn(k + 3, sd), .006, .003, rn(sd + k, 9) * 3, COL.crack, .2); }
  } else if (kind === 'planks') {
    G.box(F, 0, H / 2, 0, hw, H / 2, ht * .6, 0, COL.gap, .5);       // dark gap behind the boards
    for (const sg of [-1, 1]) G.box(F, sg * (hw + .05), H / 2 + .022, 0, .075, H / 2 + .018, ht + .05, 0, COL.post, .05, 1);       // posts
    G.box(F, 0, H + .05, 0, hw + .12, .06, ht + .05, 0, COL.post, .05, 1);
    for (const sg of [-1, 1]) {
      let v = .06, k = 0;
      while (v < H - .05) { const hh = .085 + .03 * rn(sd + k, sg), cv = v + hh, rot = (rn(k, sd * sg) - .5) * .05; if (cv + hh > H) break; G.box(F, (rn(sd, k + 9) - .5) * .06, cv, sg * (ht - .005 + .02), hw + .03, hh - .012, .022, rot, pick(COL.wood, sd + k, sg), 0, 1); v = cv + hh + .035 + .03 * rn(k, sd + sg); k++; }
      G.box(F, 0, H / 2, sg * (ht + .05), Math.hypot(W, H) / 2 - .1, .07, .02, Math.atan2(H, W) * (sg > 0 ? 1 : -1) * .96, COL.wood[3], 0, 1);       // cross brace
    }
  } else if (kind === 'sheet') {
    frame(COL.strap, .04, .1);
    G.box(F, 0, H / 2, 0, hw, H / 2, ht + .012, 0, pick(COL.steel, sd, 1), .03, 0);
    for (const sg of [-1, 1]) {
      for (let k = 1; k < 4; k++) G.box(F, 0, H * k / 4, sg * (ht + .022), hw - .05, .03, .012, 0, COL.rib, .05, 1);       // ribs
      for (const v of [.12, H - .12]) for (let k = 0; k < 7; k++) { const u = -hw + .12 + (W - .24) * k / 6; G.box(F, u, v, sg * (ht + .02), .017, .017, .009, 0, COL.rivet, 0); }
      const ns = Math.max(4, Math.round(W / .22));
      for (let k = 0; k < ns; k++) { const u0 = -hw + W * k / ns, u1 = -hw + W * (k + 1) / ns; G.box(F, (u0 + u1) / 2, H - .32, sg * (ht + .016), (u1 - u0) / 2, .07, .004, .0, k & 1 ? COL.blk : COL.yel, 0); G.box(F, (u0 + u1) / 2, .3, sg * (ht + .016), (u1 - u0) / 2, .07, .004, 0, k & 1 ? COL.yel : COL.blk, 0); }
    }
  } else {       // hatch: boards across x, two iron straps along z, a ring; flush frame
    const n = Math.max(4, Math.round(W / .2));
    for (let k = 0; k < n; k++) { const u0 = -hw + W * k / n + .006, u1 = -hw + W * (k + 1) / n - .006; G.box(F, (u0 + u1) / 2, 0, 0, (u1 - u0) / 2, H / 2 - .01, ht + .004, 0, pick(COL.wood, sd + k, 3), 0, 1); }
    G.box(F, 0, 0, -ht * .5, hw, H / 2, ht * .45, 0, COL.gap, .5);
    for (const v of [-H * .3, H * .3]) G.box(F, 0, v, ht + .009, hw - .03, .035, .006, 0, COL.iron, .05);
    G.box(F, 0, H * .05, ht + .014, .06, .012, .006, 0, COL.iron, 0); G.box(F, 0, H * .05 + .05, ht + .016, .012, .045, .006, 0, COL.iron, 0);
  }
}
function blown(G, F, kind, sd) {
  const W = F.W, H = F.H, T = F.T, hw = W / 2, ht = T / 2;
  if (kind === 'hatch') {       // broken board ends along the two x edges, a scorched rim
    for (const sg of [-1, 1]) { G.box(F, 0, sg * (H / 2 - .035), 0, hw, .035, ht + .006, 0, COL.burnt, .2, 1); for (let k = 0; k < 6; k++) { const u = -hw + W * (k + .5) / 6, l = .05 + .12 * rn(sd + k, sg); G.box(F, u, sg * (H / 2 - .06 - l / 2), 0, W / 14, l / 2, ht * .8, (rn(k, sd) - .5) * .4, k & 1 ? COL.splinter : COL.burnt, .1, 1); } }
    for (const sg of [-1, 1]) G.box(F, sg * (hw - .03), 0, 0, .03, H / 2, ht + .006, 0, COL.burnt, .2, 1);
    return;
  }
  // scorched frame (or posts) kept around the hole
  if (kind === 'planks') { for (const sg of [-1, 1]) G.box(F, sg * (hw + .05), H / 2 + .022, 0, .075, H / 2 + .018, ht + .05, 0, COL.burnt, .1, 1); G.box(F, 0, H + .05, 0, hw + .12, .06, ht + .05, 0, COL.burnt, .1, 1); }
  else { const wd = kind === 'sheet' ? .1 : .09, pr = kind === 'sheet' ? .04 : .045; G.box(F, -hw - wd / 2 + .02, (H + wd - .02 + .004) / 2, 0, wd / 2, (H + wd - .02 - .004) / 2, ht + pr, 0, COL.frameS, .15, 1); G.box(F, hw + wd / 2 - .02, (H + wd - .02 + .004) / 2, 0, wd / 2, (H + wd - .02 - .004) / 2, ht + pr, 0, COL.frameS, .15, 1); G.box(F, 0, H + wd / 2 - .02, 0, hw + wd - .02, wd / 2, ht + pr, 0, COL.frameS, .15, 1); }
  // jagged remains clinging to the edges of the hole
  const edge = (n, place) => { for (let k = 0; k < n; k++) place(k, rn(sd + k * 1.7, n), rn(k * 2.3, sd + n)); };
  const col = (k, q) => kind === 'plaster' ? (q > .55 ? COL.core : pick(COL.plaster, sd + k, 2)) : kind === 'sheet' ? (q > .5 ? COL.torn : COL.frameS) : (q > .45 ? COL.splinter : COL.burnt);
  const thick = kind === 'sheet' ? Math.min(ht, .02) : ht * .92;
  edge(6, (k, a, b) => { const v = H * (k + .5) / 6, l = .05 + .16 * a; for (const sg of [-1, 1]) G.box(F, sg * (hw - l / 2 + .01), v, kind === 'sheet' ? sg * .01 : 0, l / 2, H / 14 + .03 * b, thick, (b - .5) * .7, col(k, b), .08, 1); });
  edge(7, (k, a, b) => { const u = -hw + W * (k + .5) / 7, l = .04 + .17 * a; G.box(F, u, H - l / 2 + .01, 0, W / 16 + .03 * b, l / 2, thick, (b - .5) * .8, col(k + 5, a), .08, 1); if (kind !== 'planks') G.box(F, u + .03, l * .3, 0, W / 18, l * .3, thick, (a - .5) * .6, col(k + 9, b), .12, 1); });
  if (kind === 'planks') for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) G.box(F, sg * (hw - .08 - .05 * k), H * (.25 + .25 * k), sg * (ht - .005 + .02), .09 + .06 * rn(k, sg), .07, .022, (rn(sd, k) - .5) * .5, COL.splinter, 0, 1);       // board stubs still nailed to the posts
}

/** Builds the panels' mesh into root. L.breach gets {mesh, ranges:[{b0,b1,r0,r1}], orig}. */
export function draw(L, root, M, THREE) {
  const B = L && L.breach; if (!B || !B.length || !THREE || !root) return;
  const G = new Geo(THREE), ranges = [];
  for (const p of B) {
    const r = { b0: G.count, b1: G.count, r0: G.count, r1: G.count };
    if (p.ok && p.box) {
      const F = frameOf(p), sd = (p.id + 1) * 7.31 + (p.box.x0 * .37 + p.box.z0 * .11);
      body(G, F, p.kind, sd); r.b1 = r.r0 = G.count; blown(G, F, p.kind, sd); r.r1 = G.count;
    }
    ranges.push(r);
  }
  if (!G.count) return;
  const g = new THREE.BufferGeometry(), pos = new Float32Array(G.p);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(G.n), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(G.c), 3));
  g.setAttribute('fzAO', new THREE.BufferAttribute(new Float32Array(G.a), 1));
  g.computeBoundingSphere();
  const orig = pos.slice();
  for (let i = 0; i < B.length; i++) { const r = ranges[i]; if (B.open) pos.fill(0, r.b0 * 3, r.b1 * 3); else pos.fill(0, r.r0 * 3, r.r1 * 3); }       // intact look shown, blown look collapsed (audit: the reverse)
  let mat = null; try { mat = M('pal'); } catch { mat = null; }
  if (!mat) mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: .1 });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'breach-panels'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  root.add(mesh);
  B.mesh = mesh; B.ranges = ranges; B.orig = orig;
}
