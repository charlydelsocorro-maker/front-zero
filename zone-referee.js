'use strict';
/* FRONT ZÉRO — Zone mode, server side: the referee of the circle, zone damage, crates, alive count, placement and winner.
   The server has no map: the first client that finishes loading sends the walkable spots it measured on the nav grid ('zone_setup'),
   everything after that (timeline, contents, who opened what, who is alive) is decided here. Bots are simulated by one client (`sim`):
   it reports their positions and shots, and their deaths are settled here. Lives at the game root so a publication copies it with *.js. */
const crypto = require('crypto');
const R = require('./zone-rules.js');
const OPEN_R = 3.4, OPEN_Y = 2.8, BOT_OPEN_R = 6, USE_R = 3.2, LOAD_WAIT = 15000, DEPLOY = 4000, SIM_WAIT = 8000, NO_SETUP = 45000;
const BOT_NAMES = ['Renard', 'Vautour', 'Corbeau', 'Mistral', 'Granit', 'Sirocco', 'Fauve', 'Orage', 'Brume', 'Silex', 'Cobalt', 'Ronce'];

module.exports = function createZoneReferee(api) {
  const { all, send, WEAPONS, CLASSES, T, applyDamage, killPlayer, addDrops, endMatch, strike, r2, num, isObj, canFight, scale } = api;
  const zoneOf = room => (room && room.match && room.match.zone) || null;
  const isBotId = id => typeof id === 'string' && /^b\d{1,3}$/.test(id);

  function start(room) {
    const m = room.match;
    m.phase = 'deploy';          // nobody can shoot or loot until the deploy countdown ends
    m.zone = { plan: null, t0: 0, live: false, sim: room.hostId, hello: new Set(), crates: [], bots: new Map(), spawns: new Map(), at: Date.now(), order: [], total: room.players.size, dmgAt: 0, c: {}, done: false, simAt: Date.now(), left: new Set() };
    for (const q of room.players.values()) { q.armor = 0; q.zoneTp = null; }
  }

  /* ---------- views ---------- */
  function aliveList(room, z) {
    const out = [];
    for (const q of room.players.values()) if (q.status === 'alive' && !z.left.has(q.id)) out.push(q);
    for (const b of z.bots.values()) if (b.status === 'alive') out.push(b);
    return out;
  }
  function board(room, z) {
    const rows = [];
    for (const q of room.players.values()) rows.push({ id: q.id, name: q.name, k: q.kills, alive: q.status === 'alive' && !z.left.has(q.id), place: placeOf(z, q.id) });
    for (const b of z.bots.values()) rows.push({ id: b.id, name: b.name, k: b.kills, alive: b.status === 'alive', bot: 1, place: placeOf(z, b.id) });
    return rows;
  }
  const placeOf = (z, id) => { for (let i = 0; i < z.order.length; i++) if (z.order[i].id === id) return z.order[i].place; return 0; };
  const crateView = c => ({ i: c.id, x: c.x, y: c.y, z: c.z, r: c.rot, o: c.open ? 1 : 0, s: c.open ? c.c.s : null });
  function syncMsg(room, z, q) {
    const now = Date.now();
    return { t: 'zone', op: 'sync', plan: z.plan, el: z.t0 ? now - z.t0 : null, live: z.live, sim: z.sim, total: z.total, alive: aliveList(room, z).length,
      crates: z.crates.map(crateView), bots: [...z.bots.values()].map(b => ({ id: b.id, name: b.name, alive: b.status === 'alive', weapon: b.weapon, x: b.x, y: b.y, z: b.z, hp: b.hp })),
      board: board(room, z), spawn: q ? z.spawns.get(q.id) || null : null };
  }
  const syncAll = (room, z) => { for (const q of room.players.values()) send(q, syncMsg(room, z, q)); };
  const counts = (room, z) => all(room, { t: 'zone', op: 'board', alive: aliveList(room, z).length, total: z.total, board: board(room, z) });

  /* ---------- setup: the first client to finish loading measures the map ---------- */
  const pts = (a, n, dims) => Array.isArray(a) && a.length >= 1 && a.length <= n && a.every(p => Array.isArray(p) && p.length === dims && p.every((v, i) => num(v, dims >= 3 && i === 1 ? -200 : -5000, dims >= 3 && i === 1 ? 1000 : 5000)));
  function onSetup(room, p, d) {
    const z = zoneOf(room);
    z.hello.add(p.id);
    if (z.plan) { send(p, syncMsg(room, z, p)); return; }
    if (!isObj(d) || !num(d.size, 10, 500) || !pts(d.anchors, 64, 2) || !pts(d.crates, 60, 4) || !pts(d.spawns, 24, 2)) return strike(p, 'bad_zone');
    const seed = crypto.randomInt(1, 0x7fffffff), rnd = R.rng(seed);
    z.plan = R.buildPlan({ seed, size: d.size, anchors: d.anchors, scale });
    z.crates = d.crates.map((c, i) => ({ id: i, x: r2(c[0]), y: r2(c[1]), z: r2(c[2]), rot: c[3] ? 1 : 0, open: false, c: R.rollCrate(rnd) }));
    const humans = [...room.players.values()].filter(q => q.status === 'alive'), nBots = Math.max(0, Math.min(11, R.matchSize(d.size) - humans.length));
    // the report lists spawns farthest-apart first: keep as many as there are soldiers, then deal them at random
    const sp = d.spawns.slice(0, Math.max(1, humans.length + nBots)).map(s => [r2(s[0]), r2(s[1])]);
    for (let i = sp.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = sp[i]; sp[i] = sp[j]; sp[j] = t; }
    let k = 0;
    for (const q of humans) { const s = sp[k++ % sp.length]; z.spawns.set(q.id, s); q.zoneTp = s; }
    for (let i = 0; i < nBots; i++) {
      const id = 'b' + (i + 1), s = sp[k++ % sp.length];
      z.bots.set(id, { id, isBot: true, name: BOT_NAMES[i % BOT_NAMES.length], status: 'alive', hp: 100, armor: 0, x: s[0], y: 0, z: s[1], yaw: 0, pitch: 0, vx: 0, vz: 0, weapon: 'p9', crouch: false, kills: 0, deaths: 0, assists: 0, score: 0, hasPos: true, dirty: true, damageBy: new Map() });
      z.spawns.set(id, s);
    }
    z.total = humans.length + nBots;
    z.simAt = Date.now();
    syncAll(room, z);
  }

  /* ---------- timeline ---------- */
  function pickSim(room, z) {
    const cur = room.players.get(z.sim);
    if (cur && z.hello.has(cur.id) && !z.left.has(cur.id)) return;
    for (const q of room.players.values()) if (z.hello.has(q.id) && !z.left.has(q.id)) { z.sim = q.id; z.simAt = Date.now(); all(room, { t: 'zone', op: 'sim', sim: q.id, bots: [...z.bots.values()].map(b => ({ id: b.id, name: b.name, alive: b.status === 'alive', weapon: b.weapon, x: b.x, y: b.y, z: b.z, hp: b.hp })) }); return; }
  }
  function tick(room, now) {
    const m = room.match, z = m.zone;
    if (!z || z.done) return;
    if (!z.plan) { if (now - z.at > NO_SETUP) endMatch(room, null, 'server_error'); return; }
    if (!z.live) {
      if (!z.t0) {
        let allIn = true; for (const q of room.players.values()) if (!z.hello.has(q.id)) allIn = false;
        if (allIn || now - z.at > LOAD_WAIT) { z.t0 = now + T(DEPLOY); syncAll(room, z); }
        return;
      }
      if (now < z.t0) return;
      z.live = true; m.phase = 'live'; z.dmgAt = now + 1000;
      all(room, { t: 'zone', op: 'go', el: now - z.t0, alive: aliveList(room, z).length });
      check(room, z);       // everybody else may have left during the countdown
      return;
    }
    if (z.sim && !z.hello.has(z.sim) && now - z.simAt > SIM_WAIT) { z.hello.delete(z.sim); pickSim(room, z); }
    if (now < z.dmgAt) return;
    z.dmgAt = now + 1000;
    const c = R.circleAt(z.plan, now - z.t0, z.c);
    if (!(c.dps > 0)) return;
    const r2c = c.r * c.r, hurtBots = [];
    for (const q of [...room.players.values()]) {
      if (q.status !== 'alive' || !q.hasPos || z.left.has(q.id)) continue;
      const dx = q.x - c.x, dz = q.z - c.z; if (dx * dx + dz * dz <= r2c) continue;
      q.hp = r2(Math.max(0, q.hp - c.dps));
      send(q, { t: 'damage', target: q.id, from: null, amount: c.dps, hp: q.hp, armor: q.armor, head: false, weapon: 'zone' });
      if (q.hp <= 0) { killPlayer(room, q, q, 'zone', false); if (!room.match) return; }
    }
    for (const b of z.bots.values()) {
      if (b.status !== 'alive') continue;
      const dx = b.x - c.x, dz = b.z - c.z; if (dx * dx + dz * dz <= r2c) continue;
      b.hp = r2(Math.max(0, b.hp - c.dps)); hurtBots.push(b.id, b.hp);
      if (b.hp <= 0) { killBot(room, z, b, null, 'zone', false); if (!room.match) return; }
    }
    if (hurtBots.length) { const s = room.players.get(z.sim); if (s) send(s, { t: 'zone', op: 'bhp', l: hurtBots }); }
  }

  /* ---------- deaths and the end ---------- */
  function noteDeath(room, z, id) {
    if (placeOf(z, id)) return;
    const left = aliveList(room, z).length;
    z.order.push({ id, place: left + 1 });
  }
  function onKilled(room, victim) {
    const z = zoneOf(room); if (!z) return;
    noteDeath(room, z, victim.id); counts(room, z); check(room, z);
  }
  function killBot(room, z, b, by, weapon, head) {
    b.status = 'dead'; b.hp = 0; b.deaths++;
    const killer = by ? room.players.get(by) || z.bots.get(by) || null : null;
    if (killer && killer !== b) { killer.kills++; killer.score += head ? 125 : 100; }
    all(room, { t: 'death', id: b.id, by: killer && killer !== b ? killer.id : null, weapon, head: !!head, assists: [] });
    const w = WEAPONS[b.weapon];
    if (w && room.match && room.match.drops) addDrops(room, [{ k: 'w', w: b.weapon, ...R.dropRounds(w) }], b.x, b.y, b.z);
    api.sendScore(room);
    noteDeath(room, z, b.id); counts(room, z); check(room, z);
  }
  function check(room, z) {
    if (z.done || !z.live) return;
    const list = aliveList(room, z);
    if (list.length > 1) return;
    z.done = true;
    const w = list[0] || null;
    if (w) z.order.push({ id: w.id, place: 1 });
    all(room, { t: 'zone', op: 'final', winner: w ? w.id : null, name: w ? w.name : null, total: z.total, board: board(room, z) });
    endMatch(room, w ? w.id : null, w ? 'last' : 'draw');
  }

  /* ---------- crates ---------- */
  function openCrate(room, z, p, d) {
    const c = Number.isInteger(d.id) ? z.crates[d.id] : null;
    if (!c) return strike(p, 'bad_crate');
    const fail = () => send(p, { t: 'zone', op: 'fail', id: d.id });
    if (c.open || !canFight(room)) return fail();
    if (d.bot !== undefined) {           // the simulating client opens for one of its bots
      if (p.id !== z.sim || !isBotId(d.bot)) return fail();
      const b = z.bots.get(d.bot);
      if (!b || b.status !== 'alive' || Math.hypot(b.x - c.x, b.z - c.z) > BOT_OPEN_R) return fail();
      c.open = true; c.by = b.id;
      return all(room, { t: 'zone', op: 'open', id: c.id, by: b.id, s: c.c.s, w: c.c.w, g: c.c.g });       // the bot's weapon comes back in its next report
    }
    if (p.status !== 'alive' || !p.hasPos || z.left.has(p.id) || Math.hypot(p.x - c.x, p.z - c.z) > OPEN_R || Math.abs(p.y - c.y) > OPEN_Y) return fail();
    c.open = true; c.by = p.id;
    all(room, { t: 'zone', op: 'open', id: c.id, by: p.id, s: c.c.s });
    const list = [], w = WEAPONS[c.c.w];
    if (w) list.push({ k: 'w', w: c.c.w, ...R.dropRounds(w) });
    if (c.c.g && WEAPONS.frag) list.push({ k: 'g', w: 'frag', a: c.c.g, r: 0 });
    if (c.c.x) list.push({ k: 'x', w: c.c.x, a: 1, r: 0 });       // equipment item: the count is kept by gear-referee.js when it is picked up
    const at = R.dropSpot(c.x, c.z, p.x, p.z);
    addDrops(room, list, at.x, c.y + 0.5, at.z);
  }
  function useSupply(room, z, p, d) {
    const c = Number.isInteger(d.id) ? z.crates[d.id] : null;
    if (!c) return strike(p, 'bad_crate');
    const fail = () => send(p, { t: 'zone', op: 'fail', id: d.id });
    if (!c.open || !c.c.s || p.status !== 'alive' || !p.hasPos || !canFight(room) || Math.hypot(p.x - c.x, p.z - c.z) > USE_R || Math.abs(p.y - c.y) > OPEN_Y) return fail();
    if (c.c.s === 'med') { if (p.hp >= p.maxHp) return fail(); p.hp = Math.min(p.maxHp, p.hp + R.MED); }
    else { const cap = R.armorCap(CLASSES[p.cls] && CLASSES[p.cls].armor); if (p.armor >= cap) return fail(); p.armor = Math.min(cap, p.armor + R.ARMOR); }
    const s = c.c.s; c.c.s = null;
    send(p, { t: 'action', type: 'hp', from: null, data: { hp: r2(p.hp), armor: r2(p.armor) } });
    all(room, { t: 'zone', op: 'used', id: c.id, by: p.id, s });
  }

  /* ---------- what the simulating client reports for its bots, ten times a second ---------- */
  function onTick(room, z, p, d) {
    if (p.id !== z.sim || !isObj(d)) return;
    const now = Date.now();
    if (Array.isArray(d.s) && d.s.length <= 16) for (const e of d.s) {
      if (!Array.isArray(e) || e.length !== 11) return strike(p, 'bad_zone');
      const b = z.bots.get(e[0]);
      if (!b || b.status !== 'alive') continue;
      if (!num(e[1], -5000, 5000) || !num(e[2], -200, 1000) || !num(e[3], -5000, 5000) || !num(e[4], -1e4, 1e4) || !num(e[5], -2, 2) || !num(e[6], -60, 60) || !num(e[7], -60, 60) || !WEAPONS[e[8]]) return strike(p, 'bad_zone');
      b.x = e[1]; b.y = e[2]; b.z = e[3]; b.yaw = e[4]; b.pitch = e[5]; b.vx = e[6]; b.vz = e[7]; b.weapon = e[8]; b.crouch = e[9] === 1;
      if (num(e[10], 0, 1000)) b.hp = Math.min(b.hp, r2(e[10]));
      b.dirty = true;
    }
    if (!canFight(room)) return;
    if (Array.isArray(d.f) && d.f.length <= 24) for (const f of d.f) {
      if (!Array.isArray(f) || (f.length !== 8 && f.length !== 12)) return strike(p, 'bad_zone');
      const b = z.bots.get(f[0]), w = typeof f[7] === 'string' && Object.hasOwn(WEAPONS, f[7]) ? WEAPONS[f[7]] : null;
      if (!b || b.status !== 'alive' || !w || (f.length === 8) !== (w.kind === 'hitscan' || w.kind === 'melee')) continue;
      let ok = true; for (let i = 1; i <= 6; i++) if (!num(f[i], -6000, 6000)) ok = false;
      if (!ok) continue;
      const out = { t: 'shot', id: b.id, ox: r2(f[1]), oy: r2(f[2]), oz: r2(f[3]), dx: +f[4].toFixed(4), dy: +f[5].toFixed(4), dz: +f[6].toFixed(4), weapon: f[7] };
      if (f.length === 12) {       // rocket, grenade, bolt: the other screens fly a mirror of it
        const lim = w.proj.speed * 1.5 + 15; if (!num(f[8], -lim, lim) || !num(f[9], -lim, lim) || !num(f[10], -lim, lim) || !num(f[11], 0, 1e9)) continue;
        out.k = w.kind === 'thrown' ? 't' : 'p'; out.pid = Math.floor(f[11]); out.vx = r2(f[8]); out.vy = r2(f[9]); out.vz = r2(f[10]);
      }
      all(room, out, p);
    }
    if (Array.isArray(d.b) && d.b.length <= 8) for (const q of d.b) {
      if (!Array.isArray(q) || q.length !== 5) return strike(p, 'bad_zone');
      const b = z.bots.get(q[0]), w = typeof q[4] === 'string' && Object.hasOwn(WEAPONS, q[4]) ? WEAPONS[q[4]] : null;
      if (!b || !w || !w.blast || !num(q[1], -6000, 6000) || !num(q[2], -200, 1000) || !num(q[3], -6000, 6000)) continue;
      all(room, { t: 'boom', id: b.id, x: r2(q[1]), y: r2(q[2]), z: r2(q[3]), weapon: q[4], pid: 0 }, p);
    }
    if (Array.isArray(d.d) && d.d.length <= 32) for (const h of d.d) {
      if (!Array.isArray(h) || h.length !== 5) return strike(p, 'bad_zone');
      const b = z.bots.get(h[0]), t = room.players.get(h[1]), w = WEAPONS[h[4]];
      if (!b || b.status !== 'alive' || !t || t.status !== 'alive' || !w || !num(h[2], 0.01, 2000)) continue;
      if (t.hasPos && Math.hypot(t.x - b.x, t.z - b.z) > Math.max(w.range * 1.6, 12) + 6) continue;
      const amount = Math.min(h[2], w.dmg * w.maxMul * (w.pellets || 1));
      // no attacker in the 'damage' message: the simulating client would read it back as a new hit by its bot. The direction goes separately.
      const dead = applyDamage(room, t, amount, null, h[4], h[3] === 1);
      send(t, { t: 'zone', op: 'hitby', by: b.id });
      if (dead) { killPlayer(room, t, b, h[4], h[3] === 1); if (!room.match) return; }
    }
    void now;
  }

  return {
    start, tick, onKilled, isBotId,
    /** Keeps the assigned spawn teleport from being clamped as an impossible move. */
    onState(p, m) { if (p.zoneTp && Math.hypot(m.x - p.zoneTp[0], m.z - p.zoneTp[1]) < 4) { p.snap = true; p.zoneTp = null; } },
    /** A human's bullet on a bot: the simulating client applies it, its death comes back through 'zb_kill'. */
    botHit(room, id, p, damage, head, weapon) {
      const z = zoneOf(room); if (!z) return false;
      const b = z.bots.get(id); if (!b || b.status !== 'alive') return false;
      const s = room.players.get(z.sim); if (s) send(s, { t: 'action', type: 'zb_hit', from: p.id, data: { bot: id, damage: r2(damage), head: !!head, weapon } });
      return true;
    },
    stateBatch(room, batch) {
      const z = zoneOf(room); if (!z) return;
      for (const b of z.bots.values()) { if (!b.dirty) continue; b.dirty = false; batch.push({ id: b.id, x: r2(b.x), y: r2(b.y), z: r2(b.z), yaw: r2(b.yaw), pitch: r2(b.pitch), vx: r2(b.vx), vz: r2(b.vz), weapon: b.weapon, crouch: b.crouch, status: b.status }); }
    },
    lateJoin(room, p) { const z = zoneOf(room); if (z) { p.status = 'dead'; p.hp = 0; z.left.delete(p.id); } },
    onLeave(room, p) {
      const z = zoneOf(room); if (!z) return;
      z.hello.delete(p.id); z.left.delete(p.id);
      if (z.live && !placeOf(z, p.id) && p.status === 'alive') { p.status = 'dead'; noteDeath(room, z, p.id); }
      pickSim(room, z);
      if (z.live) { counts(room, z); check(room, z); }
    },
    onAction(p, room, type, d) {
      const z = zoneOf(room);
      if (!z) return;
      switch (type) {
        case 'zone_setup': return onSetup(room, p, d);
        case 'zone_open': return isObj(d) ? openCrate(room, z, p, d) : strike(p, 'bad_zone');
        case 'zone_use': return isObj(d) ? useSupply(room, z, p, d) : strike(p, 'bad_zone');
        case 'zb_tick': return onTick(room, z, p, d);
        case 'zb_kill': {
          if (p.id !== z.sim || !isObj(d)) return;
          const b = z.bots.get(d.id); if (!b || b.status !== 'alive') return;
          return killBot(room, z, b, typeof d.by === 'string' ? d.by : null, typeof d.weapon === 'string' && WEAPONS[d.weapon] ? d.weapon : null, !!d.head);
        }
        case 'zone_leave': {       // this player went back to the menu: it no longer watches nor simulates, the match goes on without it
          if (p.status === 'alive') return;
          z.left.add(p.id); pickSim(room, z);
          for (const q of room.players.values()) if (!z.left.has(q.id)) return;
          z.done = true;
          return endMatch(room, null, 'abandoned');
        }
        default: return strike(p, 'bad_action');
      }
    },
  };
};
