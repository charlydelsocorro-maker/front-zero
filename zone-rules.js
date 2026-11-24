// FRONT ZÉRO — Zone mode: rules shared by the browser and the server (circle timeline, crate contents, match size).
// No import/export on purpose: the server loads it with require(), the browser with `import './zone-rules.js'` (globalThis.FZZoneRules).
(function (root) {
  'use strict';
  const TIERS = [
    { w: 44, ids: ['smg', 'pdw', 'hsmg', 'hp', 'rev', 'mp', 'dbs', 'fsmg', 'ssmg', 'dsmg', 'cqc', 'p22', 'bp', 'lsp', 'sawn'] },
    { w: 31, ids: ['ar', 'car', 'akr', 'sg', 'brst', 'bpc', 'ssr', 'lsg'] },
    { w: 16, ids: ['bat', 'dmr', 'lmg', 'asg', 'hbr', 'bplmg', 'dsg', 'lsr'] },
    { w: 7, ids: ['sr', 'xbow', 'gl', 'mini', 'asr', 'scout', 'dlmg'] },
    { w: 2, ids: ['hsr', 'rl'] },
  ];
  const WAIT = [45, 35, 30, 25, 20, 15], SHRINK = [30, 25, 20, 18, 15, 12], RADII = [0.82, 0.58, 0.38, 0.23, 0.13, 0.07], DPS = [2, 4, 7, 11, 16, 24], COLLAPSE = { wait: 8, shrink: 20, dps: 45 };
  const MED = 50, ARMOR = 50, ARMOR_MIN_CAP = 50, GRACE = 62000;       // GRACE: opening, in ms, during which bots only search crates
  /** Collision box of a crate (half width, half depth, height), handles included. rot = 1 turns it by 90 degrees. */
  const CRATE = { hx: 0.56, hz: 0.36, h: 0.57 };

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** Players in a match, bots included: bigger map, more soldiers. */
  const matchSize = size => (size < 45 ? 8 : size < 75 ? 10 : 12);
  const phaseCount = size => (size < 45 ? 4 : size < 75 ? 5 : 6);
  const crateCount = size => (size < 45 ? 16 : size < 75 ? 26 : 40);

  /** The whole timeline. o = {seed, size, anchors:[[x,z]...] walkable and reachable, scale (test clock, 1 = real time)}. Times in ms from the start. */
  function buildPlan(o) {
    const rnd = rng(o.seed), size = o.size, n = phaseCount(size), k = (size < 45 ? 1.45 : size < 75 ? 1.12 : 1.35) * (o.scale || 1), A = o.anchors;      // about 4.5 min on small maps, 7 on the large ones
    // final point: the anchor nearest the centre out of three random ones, so the end stays in the playable heart of the map
    let F = A[Math.floor(rnd() * A.length)];
    for (let i = 0; i < 2; i++) { const q = A[Math.floor(rnd() * A.length)]; if (Math.hypot(q[0], q[1]) < Math.hypot(F[0], F[1])) F = q; }
    const R = [size * 1.5]; for (let i = 0; i < n; i++) R.push(Math.max(i === n - 1 ? 4.5 : 7, size * RADII[Math.min(i + (6 - n), RADII.length - 1)]));
    // centres are drawn from the last to the first, each circle strictly inside the previous one: the final point is inside them all
    const X = new Array(n + 1), Z = new Array(n + 1); X[n] = F[0]; Z[n] = F[1];
    for (let i = n - 1; i >= 1; i--) {
      const room = (R[i] - R[i + 1]) * 0.8; let x = X[i + 1], z = Z[i + 1];
      for (let t = 0; t < 8; t++) {
        const a = rnd() * Math.PI * 2, d = rnd() * room, cx = X[i + 1] + Math.cos(a) * d, cz = Z[i + 1] + Math.sin(a) * d;
        if (Math.abs(cx) <= size - R[i] * 0.45 && Math.abs(cz) <= size - R[i] * 0.45) { x = cx; z = cz; break; }
      }
      X[i] = x; Z[i] = z;
    }
    X[0] = 0; Z[0] = 0;
    R[0] = Math.max(R[0], Math.hypot(X[1], Z[1]) + R[1] + 0.5);       // the opening circle holds the first one, wherever it landed
    const phases = []; let t = 0;
    phases.push({ x: 0, z: 0, r: R[0], s0: 0, s1: 0, dps: 0 });
    for (let i = 1; i <= n; i++) {
      const j = i - 1 + (6 - n), s0 = t + WAIT[j] * 1000 * k, s1 = s0 + SHRINK[j] * 1000 * k;
      phases.push({ x: round(X[i]), z: round(Z[i]), r: round(R[i]), s0: Math.round(s0), s1: Math.round(s1), dps: DPS[j] });
      t = s1;
    }
    const s0 = t + COLLAPSE.wait * 1000 * k, s1 = s0 + COLLAPSE.shrink * 1000 * k;
    phases.push({ x: round(X[n]), z: round(Z[n]), r: 0, s0: Math.round(s0), s1: Math.round(s1), dps: COLLAPSE.dps });
    return { v: 1, size, n, phases, fx: round(F[0]), fz: round(F[1]), grace: Math.round(GRACE * (o.scale || 1)), end: Math.round(s1) };
  }
  const round = v => Math.round(v * 100) / 100;

  /** The circle at time t (ms from the start), written into `out` (nothing allocated). */
  function circleAt(plan, t, out) {
    const P = plan.phases, last = P.length - 1; let i = 1;
    while (i < last && t >= P[i].s1) i++;
    const a = P[i - 1], b = P[i]; out.i = i; out.last = last; out.dps = i > 1 || t >= b.s0 ? (t >= b.s0 ? b.dps : a.dps) : 0;
    out.nx = b.x; out.nz = b.z; out.nr = b.r;
    if (t >= b.s1) { out.st = 2; out.x = b.x; out.z = b.z; out.r = b.r; out.left = 0; out.dps = b.dps; return out; }
    if (t >= b.s0) { const k = (t - b.s0) / (b.s1 - b.s0); out.st = 1; out.x = a.x + (b.x - a.x) * k; out.z = a.z + (b.z - a.z) * k; out.r = a.r + (b.r - a.r) * k; out.left = b.s1 - t; return out; }
    out.st = 0; out.x = a.x; out.z = a.z; out.r = a.r; out.left = b.s0 - t;
    return out;
  }

  function pickWeapon(rnd) {
    let total = 0; for (const t of TIERS) total += t.w;
    let v = rnd() * total;
    for (let i = 0; i < TIERS.length; i++) { v -= TIERS[i].w; if (v <= 0 || i === TIERS.length - 1) return { w: TIERS[i].ids[Math.floor(rnd() * TIERS[i].ids.length)], tier: i }; }
    return { w: 'smg', tier: 0 };
  }
  /** One crate: w weapon id (always), tier 0..4, g grenades, x spare launcher rounds, s supply left in the crate ('med', 'arm' or null). */
  const GEAR_POOL = ['bandage', 'bandage', 'syringe', 'syringe', 'plate', 'adren', 'medkit', 'flash', 'smoke', 'stun', 'decoy', 'sticky', 'molotov', 'mine'];
  function rollCrate(rnd) {
    const p = pickWeapon(rnd), v = rnd();
    const c = { w: p.w, tier: p.tier, g: rnd() < 0.35 ? 1 : 0, s: v < 0.45 ? 'med' : v < 0.75 ? 'arm' : null };
    c.x = rnd() < 0.5 ? GEAR_POOL[Math.floor(rnd() * GEAR_POOL.length)] : null;       // one equipment item in about half of the crates (gear-data.js)
    return c;
  }
  /** Rarity of a weapon (0 common .. 4 legendary), -1 when it is not in the crate table (the starting sidearm). */
  const tierOf = w => { for (let i = 0; i < TIERS.length; i++) if (TIERS[i].ids.indexOf(w) >= 0) return i; return -1; };
  /** Rounds in a dropped weapon: full magazine, launcher reserve. */
  const dropRounds = def => ({ a: def.mag, r: def.reserve === undefined ? -1 : def.reserve });
  const armorCap = classArmor => Math.max(classArmor || 0, ARMOR_MIN_CAP);
  /** Where a crate's contents fall: just outside it, on the side of whoever opened it. */
  function dropSpot(cx, cz, px, pz) { const dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz) || 1, k = Math.min(0.95, d); return { x: round(cx + dx / d * k), z: round(cz + dz / d * k) }; }

  const api = { TIERS, MED, ARMOR, CRATE, rng, matchSize, phaseCount, crateCount, buildPlan, circleAt, rollCrate, tierOf, dropRounds, armorCap, dropSpot };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FZZoneRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
