// FRONT ZÉRO — world props data: what each map holds, and what can be read from its layout (maps.js is never edited for this).
// Pure data and geometry, no DOM or WebGL: also usable under Node.

/** Per map: explosive drums, gas cylinders, share of doors that start open (the rest start closed), door cap, pane cap. */
export const PROP_MAPS = {
  depot:           { barrels: 9,  gas: 3, open: 0.4,  doors: 24, panes: 420 },
  'vieille-ville': { barrels: 8,  gas: 4, open: 0.35, doors: 64, panes: 420 },
  port:            { barrels: 11, gas: 4, open: 0.4,  doors: 24, panes: 420 },
  bunker:          { barrels: 7,  gas: 4, open: 0.5,  doors: 32, panes: 420 },
  'col-blanc':     { barrels: 7,  gas: 3, open: 0.4,  doors: 24, panes: 420 },
  'sept-vents':    { barrels: 16, gas: 6, open: 0.45, doors: 40, panes: 420 },
  noirval:         { barrels: 18, gas: 6, open: 0.45, doors: 40, panes: 420 },
  'val-cendre':    { barrels: 12, gas: 5, open: 0.35, doors: 64, panes: 420 },
};
export const PROP_DEFAULT = { barrels: 8, gas: 3, open: 0.4, doors: 32, panes: 420 };
export const GLAZING_MAX = 180;       // windscreens and cabin glass per map

/** The bunker's openings are carved in rock, with no trim to read: its heavy doors sit in the connectors between rooms and the ring. */
const bunkerDoors = () => {
  const out = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * 20.5;
    out.push({ ax: 'x', a: cx - 1, b: cx + 1, c: sz * 20.5 });                                   // room to outer ring
    out.push({ ax: 'x', a: cx - 1, b: cx + 1, c: sz * 3.6 });                                    // room to the east-west spine
    out.push({ ax: 'z', a: sz < 0 ? -10.5 : 8.5, b: sz < 0 ? -8.5 : 10.5, c: sx * 12.5 });       // room to the reactor hall (the carve snaps to a 50 cm grid)
    out.push({ ax: 'x', a: sx < 0 ? -12 : 9.5, b: sx < 0 ? -9.5 : 12, c: sz * 27.5 });           // ring to the store rooms
  }
  return out;
};
export const HEAVY_DOORS = { bunker: bunkerDoors };

/** Explosive props. hp: damage to set off; burn: seconds on fire once below half; radius and damage go to the engine's explode(). */
export const BARREL = {
  drum: { hp: 60, burn: 2.4, radius: 4.8, damage: 130, r: 0.3, h: 0.92 },
  gas:  { hp: 35, burn: 1.6, radius: 3.8, damage: 105, r: 0.16, h: 1.24 },
  chainDepth: 5, chainDelay: 0.24, perTick: 1,
};

/* ---------- bullet penetration ----------
   Energy lost per metre of material crossed. 0 = stops every bullet (thick concrete, stone, hesco, sandbags, rock, snow). */
export const PEN_RATE = {
  glass: 0.6, door: 2.6, wood: 2.8, woodD: 2.8, crate: 2.8, tarp: 1.5,
  plaster: 1.7, plasterB: 1.7, plasterO: 1.7, tile: 2.4,
  corr: 5, rust: 5, plate: 6, panel: 5, paint: 5, steel: 6.5, frame: 6, burn: 5, barrel: 0, cont0: 5, cont1: 5, cont2: 5, cont3: 5,
  conc: 0, concD: 0, stone: 0, brick: 0, bwall: 0, ceil: 0, hesco: 0, sand: 0, sandbag: 0, rock: 0, rockS: 0, snow: 0,
};
const SURF_RATE = { wood: 2.8, metal: 5.5 };       // solids that only exist as collision: judged from their surface
export const PEN_MAX_THICK = 0.62;                  // beyond this length through one solid, nothing passes
export const PEN_MIN_LEFT = 0.15;                   // a bullet left with less than this share of its energy stops inside
export const PEN_LAYERS = 3;

/** Bullet energy, from the weapon's damage per projectile. The balance table stays untouched. */
export const powerOf = def => { const p = def.dmg / 30; return p < 0.3 ? 0.3 : p > 3.2 ? 3.2 : p; };
/** Energy cost of crossing `len` metres at `rate`. */
export const penCost = (rate, len) => rate * len + 0.03;

/* ---------- reading the layout ---------- */
const near = (a, b, e = 0.012) => Math.abs(a - b) < e;
const isFrame = o => o && o.t === 'b' && o.m === 'frame';

/**
 * Every opening the map Kit cut in a wall leaves the same trim in its ops: two 9 cm jambs, then a lintel and, for a window, a sill.
 * Returns ground-level doors, windows, and the material of each solid (same index as L.solids).
 */
export function deriveProps(L) {
  const ops = L.ops || [], doors = [], windows = [];
  for (let i = 0; i + 1 < ops.length; i++) {
    const A = ops[i], B = ops[i + 1];
    if (!isFrame(A) || !isFrame(B) || !near(A.y0, B.y0) || !near(A.y1, B.y1)) continue;
    const wx = A.x1 - A.x0, wz = A.z1 - A.z0; let ax, a, b, c, th;
    if (near(wx, 0.09) && near(B.x1 - B.x0, 0.09) && wz > 0.15 && near(A.z0, B.z0)) { ax = 'x'; a = A.x1; b = B.x0; c = (A.z0 + A.z1) / 2; th = wz - 0.1; }
    else if (near(wz, 0.09) && near(B.z1 - B.z0, 0.09) && wx > 0.15 && near(A.x0, B.x0)) { ax = 'z'; a = A.z1; b = B.z0; c = (A.x0 + A.x1) / 2; th = wx - 0.1; }
    else continue;
    const w = b - a, h = A.y1 - A.y0; if (!(w > 0.5)) continue;
    i++;                                     // this pair is consumed: the next hole's jambs must not pair with this one's
    let sill = false;
    for (let k = i + 1; k <= i + 2 && k < ops.length; k++) { const q = ops[k]; if (isFrame(q) && near(q.y1, A.y0) && near(q.y1 - q.y0, 0.06)) sill = true; }
    if (!sill && A.y0 < 0.02 && w >= 0.8 && w <= 3.2 && h >= 1.8 && h <= 3.3) doors.push({ ax, c, a, b, y0: A.y0, h, th });
    else if (sill && A.y0 >= 0.3 && w <= 1.8 && h >= 0.7 && h <= 2.2) windows.push({ ax, c, a, b, y0: A.y0, h, th });
  }
  const byBox = new Map();
  for (const o of ops) if (o.t === 'b') byBox.set(o.x0 + '|' + o.x1 + '|' + o.y0 + '|' + o.y1 + '|' + o.z0 + '|' + o.z1, o.m);
  const rates = new Float32Array((L.solids || []).length);
  (L.solids || []).forEach((s, i) => {
    const m = byBox.get(s.x0 + '|' + s.x1 + '|' + s.y0 + '|' + s.y1 + '|' + s.z0 + '|' + s.z1);
    const r = m !== undefined ? PEN_RATE[m] : undefined;
    rates[i] = r !== undefined ? r : (SURF_RATE[s.surface] || 0);
  });
  return { doors, windows, rates };
}

/**
 * Glazing drawn on vehicles, cabins and towers (ops of material 'glass'): vertical panes inside the playable area.
 * A block of glass gives one pane per side. Returns [{x, y, z, hw, hh, th, nx, nz, ux, uz}] (centre, half sizes, unit normal and width axis).
 */
export function deriveGlazing(L) {
  const out = [], S = L.size - 0.3;
  const add = (x, y, z, hw, hh, th, nx, nz) => { if (Math.abs(x) < S && Math.abs(z) < S && hw >= 0.12 && hh >= 0.12 && out.length < GLAZING_MAX) out.push({ x, y, z, hw, hh, th, nx, nz, ux: nz, uz: -nx }); };
  for (const o of L.ops || []) {
    if (o.m !== 'glass') continue;
    let w, h, d, x, y, z, ry = 0;
    if (o.t === 'r') { w = o.w; h = o.h; d = o.d; x = o.x; y = o.y + h / 2; z = o.z; ry = o.ry || 0; }
    else if (o.t === 'b') { w = o.x1 - o.x0; h = o.y1 - o.y0; d = o.z1 - o.z0; x = (o.x0 + o.x1) / 2; y = (o.y0 + o.y1) / 2; z = (o.z0 + o.z1) / 2; }
    else continue;
    if (h <= 0.15) continue;                // a flat skylight: not a window one shoots through from the ground
    const c = Math.cos(ry), s = Math.sin(ry), lx = [c, -s], lz = [s, c];       // world directions of the box's local x and z
    if (d <= 0.15) add(x, y, z, w / 2, h / 2, d, lz[0], lz[1]);
    else if (w <= 0.15) add(x, y, z, d / 2, h / 2, w, lx[0], lx[1]);
    else for (const q of [1, -1]) { add(x + lz[0] * q * d / 2, y, z + lz[1] * q * d / 2, w / 2, h / 2, 0.02, lz[0] * q, lz[1] * q); add(x + lx[0] * q * w / 2, y, z + lx[1] * q * w / 2, d / 2, h / 2, 0.02, lx[0] * q, lx[1] * q); }
  }
  return out;
}

/** Small seeded generator: placements are identical on every client. */
export function seeded(str) {
  let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = h + 0x6D2B79F5 | 0; let t = Math.imul(h ^ h >>> 15, 1 | h); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/**
 * Explosive props against walls, away from spawns, doors and each other. `grid` is built over the map's solids.
 * Returns [{x, y, z, kind:'drum'|'gas'}].
 */
export function placeBarrels(id, cfg, grid, size, spawns, doors) {
  const rnd = seeded('props:' + id), out = [], buf = [], cand = [], STEP = 2.5;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const clear = (x, z, r, h) => !grid.overlap(x - r, x + r, 0.02, h, z - r, z + r, buf);
  const farFrom = (x, z, list, d) => { for (const p of list) { const px = Array.isArray(p) ? p[0] : p.x, pz = Array.isArray(p) ? p[1] : p.z; if ((px - x) * (px - x) + (pz - z) * (pz - z) < d * d) return false; } return true; };
  const doorPts = doors.map(d => (d.ax === 'x' ? { x: (d.a + d.b) / 2, z: d.c } : { x: d.c, z: (d.a + d.b) / 2 }));
  for (let x = -size + 2; x < size - 2; x += STEP) for (let z = -size + 2; z < size - 2; z += STEP) {
    const px = x + rnd() * 0.8, pz = z + rnd() * 0.8;
    if (!clear(px, pz, 0.45, 1.3) || grid.floorAt(px, 1, pz) > 0.02) continue;
    let bd = 1.25, bi = -1;
    for (let k = 0; k < 4; k++) { const t = grid.ray(px, 0.5, pz, DIRS[k][0], 0, DIRS[k][1], 1.25); if (t < bd && grid.hit) { bd = t; bi = k; } }
    if (bi < 0) continue;
    const dx = DIRS[bi][0], dz = DIRS[bi][1], qx = px + dx * (bd - 0.4), qz = pz + dz * (bd - 0.4);
    if (grid.ray(qx, 0.5, qz, -dx, 0, -dz, 2.6) < 2.6) continue;                       // keep the way past it open
    if (!clear(qx, qz, 0.36, 1.3) || grid.floorAt(qx, 1, qz) > 0.02) continue;
    if (!farFrom(qx, qz, spawns, 15) || !farFrom(qx, qz, doorPts, 3.2)) continue;
    cand.push({ x: qx, z: qz, wx: -dz, wz: dx, k: rnd() });
  }
  cand.sort((p, q) => p.k - q.k);
  const want = cfg.barrels + cfg.gas; let drums = 0, gas = 0;
  const put = (x, z, kind) => { out.push({ x, y: 0, z, kind }); if (kind === 'drum') drums++; else gas++; };
  for (const c of cand) {
    if (out.length >= want) break;
    if (!farFrom(c.x, c.z, out, 8)) continue;
    const kind = drums < cfg.barrels && (gas >= cfg.gas || rnd() < 0.72) ? 'drum' : 'gas'; put(c.x, c.z, kind);
    if (out.length < want && rnd() < 0.45) {                                            // a pair along the wall: the classic chain
      const s = rnd() < 0.5 ? 1 : -1, nx = c.x + c.wx * s * 0.95, nz = c.z + c.wz * s * 0.95;
      if (clear(nx, nz, 0.36, 1.3) && grid.floorAt(nx, 1, nz) <= 0.02 && farFrom(nx, nz, spawns, 15) && farFrom(nx, nz, doorPts, 3.2)) put(nx, nz, drums < cfg.barrels ? 'drum' : 'gas');
    }
  }
  return out;
}
