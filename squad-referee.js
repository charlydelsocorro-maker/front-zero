'use strict';
/* FRONT ZÉRO — Zone in squads (Duo, Trio, Quatuor), server side. Loaded by zone-referee.js (same folder, the game root: a publication
   copies it with *.js). The server decides who is downed, who is revived, who bleeds out, when a squad is out and which squad wins.
   A soldier (player or Zone bot) keeps status 'alive' while downed, with `down` set: enemies can finish it, its own shots, crates and
   supplies are refused. Bots stay simulated by one client (zone-referee.js): their downs come from 'zb_kill', their revives from 'sq_rv'. */
const SR = require('./squad-rules.js');
const BLEED_STEP = SR.DOWN_HP / SR.BLEED;       // health lost per second while downed

module.exports = function createSquadReferee(api) {
  const { all, send, killPlayer, endMatch, strike, r2, num, isObj, canFight, sendScore } = api;

  /** room.sq is the squad size of a Zone room (0 = everyone for themselves). Set at creation and by the host in the lobby. */
  function configure(room, p, m) {
    if (!m || m.sq === undefined) { if (room.mode !== 'zone') room.sq = 0; return true; }
    if (m.sq === 0 || m.sq === null) { room.sq = 0; return true; }
    if (room.mode !== 'zone' || !SR.validSize(m.sq)) { room.sq = 0; return true; }
    if (!p.sqv) return false;       // the client must know squads
    for (const q of room.players.values()) if (!q.sqv && !q.bot) return false;       // somebody in the room could not play it
    room.sq = m.sq; return true;
  }
  /** May this client sit in this room? A client without squads cannot play a squad match. */
  const mayJoin = (room, p) => !(room.sq > 1) || !!p.sqv;

  /* ---------- the squads of a match ---------- */
  function start(room, z) { z.sq = { size: room.sq, list: [], of: new Map(), busy: false, pings: new Map(), hpAt: 0 }; for (const q of room.players.values()) { q.down = null; q.rev = null; } }
  const on = z => !!(z && z.sq && z.sq.size > 1);
  /** Total soldiers in the match for this map size (whole squads). */
  const total = (z, base) => SR.matchSize(base, z.sq.size);
  /** Deals squads: humans first in the order they joined (friends in a room play together), bots fill the rest. Returns spawn per id. */
  function deal(room, z, humans, botIds, spawns) {
    const S = z.sq, ids = humans.map(q => q.id).concat(botIds), n = Math.ceil(ids.length / S.size), out = new Map();
    for (let i = 0; i < n; i++) S.list.push({ id: SR.wireTeam(i), i, members: [], out: false, place: 0 });
    ids.forEach((id, k) => {
      const sq = S.list[SR.squadOf(k, S.size)], j = sq.members.length, base = spawns[sq.i % spawns.length], off = SR.SPREAD[j % SR.SPREAD.length];
      sq.members.push(id); S.of.set(id, sq);
      out.set(id, [r2(base[0] + off[0]), r2(base[1] + off[1])]);
    });
    for (const q of humans) q.team = S.of.get(q.id).id;
    return out;
  }
  const squadOf = (z, id) => (on(z) ? z.sq.of.get(id) || null : null);
  const teamOf = (z, id) => { const s = squadOf(z, id); return s ? s.id : null; };
  /** Same squad: no damage between them (bullets, blasts, gear, bots). */
  function allies(z, a, b) { if (!on(z) || !a || !b || a === b) return false; const s = z.sq.of.get(a); return !!s && s === z.sq.of.get(b); }

  /* ---------- who is who ---------- */
  function member(room, z, id) { return room.players.get(id) || z.bots.get(id) || null; }
  const standing = (z, x) => !!x && x.status === 'alive' && !x.down && !z.left.has(x.id);
  function standingMates(room, z, x) { const s = squadOf(z, x.id); if (!s) return 0; let n = 0; for (const id of s.members) { if (id === x.id) continue; if (standing(z, member(room, z, id))) n++; } return n; }
  function liveSquads(room, z) { let n = 0; for (const s of z.sq.list) if (!s.out && s.members.some(id => standing(z, member(room, z, id)))) n++; return n; }
  const tell = (room, o) => all(room, { t: 'zone', ...o });

  /* ---------- downed instead of dead ---------- */
  /** A lethal hit on a soldier of a squad: downed when a squadmate still stands. Returns true when handled (no death). */
  function lethal(room, z, x, killer, weapon) {
    if (!on(z) || z.sq.busy || !z.live || !x || x.status !== 'alive' || x.down) return false;
    if (standingMates(room, z, x) === 0) return false;
    const now = Date.now();
    x.down = { at: now, by: killer && killer !== x ? killer.id : null, weapon: weapon || null, next: now + api.T(1000) };       // next: bleeding step (test clock aware)
    x.hp = SR.DOWN_HP; x.armor = 0; x.rev = null;
    for (const q of room.players.values()) if (q.rev && q.rev.reviver === x.id) q.rev = null;       // a reviver that goes down stops
    for (const b of z.bots.values()) if (b.rev && b.rev.reviver === x.id) b.rev = null;
    if (x.isBot) x.hpHold = now + 1500;       // the simulating client still reports its old health for a moment
    tell(room, { op: 'down', id: x.id, by: x.down.by, weapon: x.down.weapon, hp: x.hp, ms: SR.BLEED * 1000 });
    if (!x.isBot) send(x, { t: 'damage', target: x.id, from: null, amount: 0, hp: x.hp, armor: 0, head: false, weapon: 'down' });
    api.counts(room, z);
    return true;
  }
  /** Back on its feet: revived by a squadmate. */
  function up(room, z, x, by) {
    x.down = null; x.hp = SR.REVIVE_HP; x.armor = 0;
    if (x.isBot) x.hpHold = Date.now() + 1500;
    tell(room, { op: 'up', id: x.id, by, hp: x.hp });
    if (!x.isBot) send(x, { t: 'action', type: 'hp', from: null, data: { hp: x.hp, armor: 0 } });
    api.counts(room, z);
  }
  /** The death of a downed soldier (finished, bled out, squad out): the referee kills it the usual way. */
  function finish(room, z, x, byId, weapon) {
    const killer = byId ? member(room, z, byId) : null;
    if (x.isBot) api.killBot(room, z, x, killer ? killer.id : null, weapon || 'bleed', false);
    else killPlayer(room, x, killer || x, weapon || 'bleed', false);
  }

  /* ---------- revives ---------- */
  function revStart(room, z, rv, tg) {
    if (!rv || !tg || !standing(z, rv) || tg.status !== 'alive' || !tg.down || !allies(z, rv.id, tg.id) || !canFight(room)) return false;
    if (!(rv.hasPos !== false) || Math.hypot(rv.x - tg.x, rv.z - tg.z) > SR.REVIVE_R + 1.2 || Math.abs(rv.y - tg.y) > 2.2) return false;
    if (rv.rev && rv.rev.target === tg.id) return true;
    for (const q of room.players.values()) if (q !== rv && q.rev && q.rev.target === tg.id) return false;       // one reviver at a time
    for (const b of z.bots.values()) if (b !== rv && b.rev && b.rev.target === tg.id) return false;
    rv.rev = { target: tg.id, reviver: rv.id, ends: Date.now() + api.T(SR.REVIVE * 1000) };
    tell(room, { op: 'rv', by: rv.id, id: tg.id, ms: api.T(SR.REVIVE * 1000) });
    return true;
  }
  function revStop(room, rv) { if (!rv || !rv.rev) return; const id = rv.rev.target; rv.rev = null; tell(room, { op: 'rvx', by: rv.id, id }); }

  /* ---------- the squads that are out, and the winner ---------- */
  function check(room, z) {
    if (!on(z) || z.done || !z.live || z.sq.busy) return;
    z.sq.busy = true;
    try {
      let left = liveSquads(room, z);
      for (const s of z.sq.list) {
        if (s.out || s.members.some(id => standing(z, member(room, z, id)))) continue;
        s.out = true; s.place = left + 1;
        for (const id of s.members) {
          const x = member(room, z, id); if (!x) continue;
          if (!z.order.some(o => o.id === id)) z.order.push({ id, place: s.place });
          if (x.status === 'alive' && !z.left.has(id)) finish(room, z, x, x.down ? x.down.by : null, x.down ? x.down.weapon : null);       // squad wiped: its downed soldiers die
          if (!room.match) return;
        }
        tell(room, { op: 'sqout', team: s.id, place: s.place });
      }
      left = liveSquads(room, z);
      if (left > 1) return;
      const w = z.sq.list.find(s => !s.out) || null;
      z.done = true;
      if (w) { w.place = 1; for (const id of w.members) if (!z.order.some(o => o.id === id)) z.order.push({ id, place: 1 }); }
      tell(room, { op: 'final', winner: w ? w.id : null, team: w ? w.id : null, name: w ? SR.SQUAD_NAMES[w.i % SR.SQUAD_NAMES.length] : null, total: z.total, squads: z.sq.list.length, board: api.board(room, z) });
      endMatch(room, w ? w.id : null, w ? 'last' : 'draw');
    } finally { z.sq.busy = false; }
  }

  /* ---------- every server tick ---------- */
  function tick(room, z, now) {
    if (!on(z) || !z.live || z.done) return;
    const step = x => {
      if (x.status !== 'alive' || !x.down) return;
      if (now >= x.down.next) {       // bleeding
        x.down.next += api.T(1000); x.hp = r2(Math.max(0, x.hp - BLEED_STEP));
        if (x.isBot) { x.hpHold = now + 1500; const s = room.players.get(z.sim); if (s) send(s, { t: 'zone', op: 'bhp', l: [x.id, x.hp] }); }
        else send(x, { t: 'damage', target: x.id, from: null, amount: r2(BLEED_STEP), hp: x.hp, armor: 0, head: false, weapon: 'bleed' });
        if (x.hp <= 0) { finish(room, z, x, x.down.by, 'bleed'); return; }
      }
    };
    for (const q of [...room.players.values()]) { step(q); if (!room.match) return; }
    for (const b of [...z.bots.values()]) { step(b); if (!room.match) return; }
    const done = rv => {       // revives in progress: still close, still standing, still holding
      const r = rv.rev; if (!r) return;
      const tg = member(room, z, r.target);
      if (!tg || !standing(z, rv) || tg.status !== 'alive' || !tg.down || (rv.hasPos !== false && Math.hypot(rv.x - tg.x, rv.z - tg.z) > SR.REVIVE_R + 1.6)) { revStop(room, rv); return; }
      if (now >= r.ends) { rv.rev = null; up(room, z, tg, rv.id); }
    };
    for (const q of room.players.values()) done(q);
    for (const b of z.bots.values()) done(b);
    if (now >= z.sq.hpAt) {       // twice a second, each player gets its squadmates' health (the HUD squad panel)
      z.sq.hpAt = now + 500;
      for (const s of z.sq.list) {
        if (s.out) continue; const l = [];
        for (const id of s.members) { const x = member(room, z, id); if (x && x.status === 'alive') l.push(id, r2(x.hp)); }
        for (const id of s.members) { const q = room.players.get(id); if (q && !z.left.has(id)) send(q, { t: 'zone', op: 'sqhp', l }); }
      }
    }
  }

  /* ---------- client actions ---------- */
  function onAction(p, room, z, type, d) {
    if (!on(z)) return;
    if (!isObj(d)) return strike(p, 'bad_squad');
    const actor = () => {       // the player itself, or one of the bots it simulates
      if (d.bot === undefined) return p;
      if (p.id !== z.sim || typeof d.bot !== 'string') return null;
      return z.bots.get(d.bot) || null;
    };
    switch (type) {
      case 'sq_rv': { const rv = actor(), tg = typeof d.id === 'string' ? member(room, z, d.id) : null; if (!revStart(room, z, rv, tg)) send(p, { t: 'zone', op: 'rvno', by: rv ? rv.id : p.id, id: d.id }); return; }
      case 'sq_rvx': return revStop(room, actor());
      case 'sq_ping': {
        const who = actor(); if (!who || who.status !== 'alive' || !num(d.x, -5000, 5000) || !num(d.y, -200, 1000) || !num(d.z, -5000, 5000)) return;
        const now = Date.now(), last = z.sq.pings.get(who.id) || 0; if (now - last < 600) return; z.sq.pings.set(who.id, now);
        const s = squadOf(z, who.id); if (!s) return;
        const msg = { t: 'zone', op: 'ping', by: who.id, x: r2(d.x), y: r2(d.y), z: r2(d.z), k: d.k === 'e' ? 'e' : 'm' };
        for (const id of s.members) { const q = room.players.get(id); if (q) send(q, msg); }
        return;
      }
      default: return strike(p, 'bad_action');
    }
  }

  return {
    configure, mayJoin, start, on, total, deal, teamOf, allies, lethal, check, tick, onAction, liveSquads,
    /** A downed soldier cannot shoot, open a crate or take a supply. */
    downed: x => !!(x && x.down),
    /** Placement of a soldier: its squad's, once the squad is out (or won). */
    placeOf: (z, id) => { const s = squadOf(z, id); return s && s.place ? s.place : 0; },
    /** Leaving player: its revive stops; the squads are checked again by the caller. */
    onLeave(room, z, p) { if (!on(z)) return; revStop(room, p); for (const q of room.players.values()) if (q.rev && q.rev.target === p.id) revStop(room, q); for (const b of z.bots.values()) if (b.rev && b.rev.target === p.id) revStop(room, b); p.down = null; },
    /** What a late joiner or a resync needs: every squad with its members, who is down and who is reviving. */
    view(room, z) {
      if (!on(z)) return null;
      const downs = [], revs = [];
      const look = x => { if (x.down && x.status === 'alive') downs.push([x.id, r2(x.hp)]); if (x.rev) revs.push([x.id, x.rev.target, Math.max(0, x.rev.ends - Date.now())]); };
      for (const q of room.players.values()) look(q); for (const b of z.bots.values()) look(b);
      return { size: z.sq.size, squads: z.sq.list.map(s => ({ id: s.id, m: s.members.slice(), out: s.out ? 1 : 0, place: s.place })), downs, revs, left: liveSquads(room, z) };
    },
  };
};
