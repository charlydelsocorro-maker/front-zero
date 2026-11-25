// FRONT ZÉRO — breachable panels: the per-map list and the shared rules (browser, server, Node tools). No import/export on purpose
// (like gear-data.js): the server loads it with require(), the browser with `import './map-breach-data.js'` then reads globalThis.FZBreachData.
// A panel is a box of wall (or floor) that a breach charge or a C4 can blow out. Its id is its index in panelsFor(map) on every machine.
//
// Tagging API for map modules (relief maps, new maps): push a collision solid with `breachable: true` (optional `bkind`:
// 'plaster' | 'planks' | 'sheet' | 'hatch') into the layout's solids, in a gap the map leaves in its own drawn walls. The game draws the
// panel itself (engine-breach.js). A tagged solid whose centre matches an entry of MAPS keeps that entry's id; any other one is appended
// (the server then takes the list from the first client that loads the map, and checks every other client against it with hash()).
(function (root) {
  'use strict';
  const RULES = {
    plantMs: 1700,          // hold time to set a charge on a panel
    fuseMs: 2500,           // from the charge stuck on the panel to the blast (server clock)
    useR: 2.3,              // aim reach to start a plant (m, eye to panel face)
    c4R: 1.0,               // a C4 going off this close to a panel (m, to its box) blows it too
    maxPanels: 32, maxSide: 4.4, minSide: 0.6, maxT: 1.4,
  };
  // Wall: x,z centre on the wall's mid-plane; ax 'x' = the wall runs along x (normal along z), 'z' = runs along z; w width, h height,
  // t thickness, y0 floor, k look. Hatch: ax 'y', w along x, d along z, y = top of the floor, t thickness.
  const W = (x, z, ax, w, h, t, k, y0 = 0) => ({ x, z, ax, w, h, t, k, y0 });
  const H = (x, z, w, d, y, t) => ({ x, z, ax: 'y', w, d, y, t, k: 'hatch' });
  const MAPS = {
    depot: [W(-13.4, -9.8, 'x', 2.6, 2.6, .4, 'sheet'), W(13.4, 9.8, 'x', 2.6, 2.6, .4, 'sheet'), W(-34.5, 13.15, 'x', 2.4, 2.5, .3, 'plaster'), W(34.5, -13.15, 'x', 2.4, 2.5, .3, 'plaster')],
    'vieille-ville': [W(-23.7, 7.775, 'x', 2.2, 2.5, .45, 'plaster'), W(23.6, -7.775, 'x', 2.2, 2.5, .45, 'plaster'), H(-15.8, -17.4, 1.3, 1.3, 3, .2), H(15.8, 17.4, 1.3, 1.3, 3, .2)],
    port: [W(-18.175, -43.5, 'z', 2.4, 2.6, .35, 'sheet'), W(-33, -24.175, 'x', 2.4, 2.6, .35, 'sheet')],
    bunker: [W(-34.5, -6, 'z', 2.4, 2.5, 1, 'sheet'), W(34.5, 6, 'z', 2.4, 2.5, 1, 'sheet')],
    'col-blanc': [W(25.85, -22.3, 'z', 2.2, 2.4, .3, 'planks'), W(-25.85, 22.7, 'z', 2.2, 2.4, .3, 'planks')],
    'sept-vents': [W(-58.6, -21.65, 'x', 2.6, 2.6, .7, 'plaster'), W(59.4, -21.65, 'x', 2.6, 2.6, .7, 'plaster')],
    noirval: [W(-59.6, 37.175, 'x', 2.4, 2.6, .35, 'sheet'), W(59.9, 37.175, 'x', 2.4, 2.6, .35, 'sheet'), W(-58, 56.825, 'x', 2.4, 2.6, .35, 'sheet'), W(58, 56.825, 'x', 2.4, 2.6, .35, 'sheet')],
    'val-cendre': [W(-27.6, -45.85, 'x', 2.2, 2.4, .3, 'planks'), W(40.4, -47.85, 'x', 2.2, 2.4, .3, 'planks'), W(-33.6, 36.15, 'x', 2.2, 2.4, .3, 'planks'), W(34.4, 34.15, 'x', 2.2, 2.4, .3, 'planks')],       // east end of the north wall: the house stairs run along its west part
    // relief maps: tagged by their own module (maps-relief.js / maps-mine.js, `bk` holes); listed here too so the server knows them without a manifest
    roqueseche: [W(-42.1, -12.18, 'x', 2.2, 2.4, .36, 'plaster', 8.4), W(42.15, -12.18, 'x', 2.2, 2.4, .36, 'plaster', 8.4)],
  };
  const KINDS = { plaster: 1, planks: 1, sheet: 1, hatch: 1 };
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  const r3 = v => Math.round(v * 1000) / 1000;

  /** The nominal box of a panel. */
  function box(s) {
    if (s.ax === 'y') return { x0: s.x - s.w / 2, x1: s.x + s.w / 2, y0: s.y - s.t, y1: s.y, z0: s.z - s.d / 2, z1: s.z + s.d / 2 };
    if (s.ax === 'x') return { x0: s.x - s.w / 2, x1: s.x + s.w / 2, y0: s.y0, y1: s.y0 + s.h, z0: s.z - s.t / 2, z1: s.z + s.t / 2 };
    return { x0: s.x - s.t / 2, x1: s.x + s.t / 2, y0: s.y0, y1: s.y0 + s.h, z0: s.z - s.w / 2, z1: s.z + s.w / 2 };
  }
  /** A panel from a tagged solid (or any AABB), or null when it does not look like a wall or a hatch. */
  function fromBox(b, kind) {
    const dx = b.x1 - b.x0, dy = b.y1 - b.y0, dz = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (!(dx > 0 && dy > 0 && dz > 0)) return null;
    const k = KINDS[kind] ? kind : null;
    if ((k === 'hatch' || dy < Math.min(dx, dz)) && dy <= RULES.maxT && dx >= RULES.minSide && dz >= RULES.minSide && dx <= RULES.maxSide && dz <= RULES.maxSide) return { x: r3(cx), z: r3(cz), ax: 'y', w: r3(dx), d: r3(dz), y: r3(b.y1), t: r3(dy), k: 'hatch' };
    const ax = dx >= dz ? 'x' : 'z', w = Math.max(dx, dz), t = Math.min(dx, dz);
    if (w < RULES.minSide || w > RULES.maxSide || dy < RULES.minSide || dy > RULES.maxSide || t > RULES.maxT) return null;
    return { x: r3(cx), z: r3(cz), ax, w: r3(w), h: r3(dy), t: r3(t), k: k && k !== 'hatch' ? k : 'plaster', y0: r3(b.y0) };
  }
  const same = (a, b) => a.ax === b.ax && Math.abs(a.x - b.x) < .3 && Math.abs(a.z - b.z) < .3 && Math.abs((a.ax === 'y' ? a.y : a.y0) - (b.ax === 'y' ? b.y : b.y0)) < .3;
  /** Static panels of a map, then the extra ones (tagged by a map module), each once. */
  function panelsFor(id, extra) {
    const out = (MAPS[id] || []).map(s => ({ ...s }));
    if (Array.isArray(extra)) for (const e of extra) { if (out.length >= RULES.maxPanels) break; if (e && !out.some(s => same(s, e))) out.push({ ...e }); }
    return out;
  }
  /** Extras sent by a client as a flat list [ax(0 x,1 z,2 y), x, z, base, w, h|d, t, kind(0..3)] in cm: parsed and bounded, or false. */
  const KL = ['plaster', 'planks', 'sheet', 'hatch'];
  function packExtras(list) { const o = []; for (const s of list) o.push(s.ax === 'x' ? 0 : s.ax === 'z' ? 1 : 2, Math.round(s.x * 100), Math.round(s.z * 100), Math.round((s.ax === 'y' ? s.y : s.y0) * 100), Math.round(s.w * 100), Math.round((s.ax === 'y' ? s.d : s.h) * 100), Math.round(s.t * 100), Math.max(0, KL.indexOf(s.k))); return o; }
  function parseExtras(a) {
    if (!Array.isArray(a) || a.length % 8 || a.length > RULES.maxPanels * 8) return false;
    const out = [];
    for (let i = 0; i < a.length; i += 8) {
      const q = a.slice(i, i + 8); if (!q.every(v => Number.isInteger(v))) return false;
      const [ax, x, z, b, w, hd, t, k] = q;
      if (ax < 0 || ax > 2 || k < 0 || k > 3 || Math.abs(x) > 60000 || Math.abs(z) > 60000 || b < -20000 || b > 100000) return false;
      const s = ax === 2 ? { x: x / 100, z: z / 100, ax: 'y', w: w / 100, d: hd / 100, y: b / 100, t: t / 100, k: 'hatch' } : { x: x / 100, z: z / 100, ax: ax ? 'z' : 'x', w: w / 100, h: hd / 100, t: t / 100, k: KL[k] === 'hatch' ? 'plaster' : KL[k], y0: b / 100 };
      if (!num(s.w, RULES.minSide, RULES.maxSide) || !num(ax === 2 ? s.d : s.h, RULES.minSide, RULES.maxSide) || !num(s.t, .02, RULES.maxT)) return false;
      out.push(s);
    }
    return out;
  }
  /** Same list on two machines = same string. */
  function hash(list) {
    let h = 2166136261 >>> 0;
    const mix = v => { h ^= (v | 0) & 0xffff; h = Math.imul(h, 16777619) >>> 0; h ^= ((v | 0) >>> 16) & 0xffff; h = Math.imul(h, 16777619) >>> 0; };
    for (const s of list) { mix(s.ax === 'x' ? 1 : s.ax === 'z' ? 2 : 3); mix(Math.round(s.x * 20)); mix(Math.round(s.z * 20)); mix(Math.round((s.ax === 'y' ? s.y : s.y0) * 20)); mix(Math.round(s.w * 20)); mix(Math.round((s.ax === 'y' ? s.d : s.h) * 20)); }
    return list.length + ':' + h.toString(36);
  }
  /** Distance from a point to the panel's box. */
  function dist(s, x, y, z) {
    const b = box(s), dx = Math.max(b.x0 - x, 0, x - b.x1), dy = Math.max(b.y0 - y, 0, y - b.y1), dz = Math.max(b.z0 - z, 0, z - b.z1);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  /** A charge stuck on the panel: on one of its two faces (or on top of a hatch), inside its outline. */
  function onFace(s, x, y, z) {
    if (!num(x, -6000, 6000) || !num(y, -200, 1000) || !num(z, -6000, 6000)) return false;
    if (s.ax === 'y') return Math.abs(x - s.x) <= s.w / 2 + .3 && Math.abs(z - s.z) <= s.d / 2 + .3 && y >= s.y - .3 && y <= s.y + .5;
    const n = s.ax === 'x' ? z - s.z : x - s.x, u = s.ax === 'x' ? x - s.x : z - s.z;
    return Math.abs(n) <= s.t / 2 + .35 && Math.abs(u) <= s.w / 2 + .3 && y >= s.y0 - .3 && y <= s.y0 + s.h + .3;
  }
  const api = { RULES, MAPS, box, fromBox, panelsFor, packExtras, parseExtras, hash, dist, onFace, same };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FZBreachData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
