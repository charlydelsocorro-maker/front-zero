'use strict';
/* FRONT ZÉRO — online bots, server side (required by room-list.js; lives at the game root because a deploy copies only server.js from server/).
   A bot is an entry of room.players without a socket: same object shape as a player, `bot: true`, `ws` = a closed stub (every send to it is dropped).
   The server has no map, so one client (the "simulator", chosen by measured frame time and ping) runs the solo AI for the bots and reports
   what they do ('bt', 20 Hz). Each report goes through the very same referee code as a human's own messages (onState, onShot, onHit, onBoom,
   onAction): speed clamp, fire-rate bucket, hit credits, range, friendly fire, damage caps, spawn protection. The server owns their health,
   deaths, respawns, scores and objectives. Older clients see them as ordinary players named "[BOT] ...". */

const TAG = '[BOT] ';
const NAMES = ['Renard', 'Vautour', 'Lynx', 'Corbeau', 'Mistral', 'Granit', 'Sirocco', 'Fauve', 'Orage', 'Brume', 'Silex', 'Cobalt'];
const SIZE = { ffa: 8, tdm: 8, dom: 10, bomb: 8 };       // modes with bots, and the default size of the match they fill to (Zombies and Zone have their own NPCs); same table in online-ui.js
const CLS = 'eclaireur';                                  // 90 hp, 15 armour: the closest class to a solo bot (100 hp, no armour)
const STUB = Object.freeze({ readyState: 3, bufferedAmount: 0, send() {}, close() {}, terminate() {}, ping() {} });
// Simulator choice: score = smoothed frame time + 0.2 x ping. Migration when the simulator leaves, goes quiet, or stays clearly worse than the best candidate.
const SIM = { quiet: 5000, fresh: 4000, worse: 1.5, floor: 25, strikes: 3, hold: 15000, unknown: 40 };
const ACTS = new Set(['plant_start', 'plant_cancel', 'defuse_start', 'defuse_cancel']);

module.exports = function createBots(api) {
  const { TEAM_MODES, MAX_PLAYERS, WEAPONS, sendRoom, sendScore, notify, onState, onShot, onHit, onBoom, onAction, resetLife, strike, isObj, num, checkBombElimination } = api;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const isBot = q => !!q && q.bot === true;
  const sizeOf = room => clamp(Number.isInteger(room.botSize) ? room.botSize : SIZE[room.mode] || 8, 2, MAX_PLAYERS);

  /* ---------- roster ---------- */
  function makeBot(room, team) {
    let n = 1; while (room.players.has('nb' + n)) n++;
    const now = Date.now(), id = 'nb' + n;
    const b = {
      id, bot: true, ws: STUB, ip: '', room, name: TAG + NAMES[(n - 1) % NAMES.length], team: team || null, cls: CLS, status: 'lobby',
      hp: 90, maxHp: 90, armor: 15, kills: 0, deaths: 0, assists: 0, score: 0,
      x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, weapon: 'ar', crouch: false, hasPos: false, snap: true, stateAt: 0, dirty: false,
      respawnAt: 0, bleedAt: 0, regenAt: 0, hpSent: 0, revive: null, damageBy: new Map(), credits: [], fire: {}, limits: {}, used: {}, live: [], booms: [],
      strikes: 0, strikeAt: now, connectedAt: now, alive: true, mf: true, zv: true, nc: 1, simP: room.players.get(room.botSim) || null,
    };
    Object.defineProperty(b, 'ready', { get: () => true, set() { /* a bot is always ready */ }, enumerable: true });
    room.players.set(id, b);
    if (room.match) {       // joins a running match like a late human: dead until the next round in Bomb, protected when it first appears elsewhere
      resetLife(b);
      if (room.mode === 'bomb') { b.status = 'dead'; b.hp = 0; } else b.lateSg = true;
    }
    return b;
  }
  function dropBot(room, b) {
    room.players.delete(b.id); b.room = null; b.dirty = false; b.dq = null;
    const m = room.match;
    if (!m) return;
    if (m.gx) { try { m.gx.onLeave(b); } catch (e) { console.error('bots: gear leave', e); } }
    if (m.plantAct && m.plantAct.by === b.id) { m.plantAct = null; notify(room, 'plant_cancel', { by: b.id }); }
    if (m.defuseAct && m.defuseAct.by === b.id) { m.defuseAct = null; notify(room, 'defuse_cancel', { by: b.id }); }
  }
  /** Humans first, bots last: room.players is a Map in insertion order and the host migration takes the first key. */
  function reorder(room) {
    const hs = [], bs = []; let sorted = true, seenBot = false;
    for (const e of room.players) { if (isBot(e[1])) { bs.push(e); seenBot = true; } else { hs.push(e); if (seenBot) sorted = false; } }
    if (sorted) return;
    room.players.clear();
    for (const e of hs) room.players.set(e[0], e[1]);
    for (const e of bs) room.players.set(e[0], e[1]);
  }
  /** Adds or removes bots so the room reaches its target size, teams even. Returns true when the roster changed. */
  function fit(room) {
    const humans = [], bots = [];
    for (const q of room.players.values()) (isBot(q) ? bots : humans).push(q);
    let changed = false;
    pickSim(room);
    const on = !!room.botsOn && !!SIZE[room.mode] && humans.length > 0 && !!room.botSim;
    if (!on) { for (const b of bots) { dropBot(room, b); changed = true; } return changed; }
    const size = sizeOf(room), want = clamp(Math.max(size, humans.length) - humans.length, 0, MAX_PLAYERS - humans.length);
    const deadFirst = (a, b) => (a.status === 'alive' ? 1 : 0) - (b.status === 'alive' ? 1 : 0);
    if (TEAM_MODES.has(room.mode)) {
      const count = t => { let n = 0; for (const q of room.players.values()) if (q.team === t) n++; return n; };
      for (const h of humans) if (h.team !== 'A' && h.team !== 'B') { h.team = count('A') <= count('B') ? 'A' : 'B'; changed = true; }       // with bots, nobody waits unassigned (the start would do the same)
      for (const b of bots) if (b.team !== 'A' && b.team !== 'B') { b.team = count('A') <= count('B') ? 'A' : 'B'; changed = true; }
      let have = bots.length;
      while (have > want) {       // too many: one from the bigger side, a dead one first
        const big = count('A') >= count('B') ? 'A' : 'B', list = [...room.players.values()].filter(q => isBot(q) && q.team === big).sort(deadFirst);
        const v = list[0] || [...room.players.values()].filter(isBot).sort(deadFirst)[0];
        if (!v) break;
        dropBot(room, v); have--; changed = true;
      }
      while (have < want) { makeBot(room, count('A') <= count('B') ? 'A' : 'B'); have++; changed = true; }
      // uneven sides with a bot on the bigger one: in the lobby it changes side, in a match it is replaced (a soldier never switches colours mid-fight)
      for (let guard = 0; guard < MAX_PLAYERS; guard++) {
        const a = count('A'), bb = count('B'); if (Math.abs(a - bb) <= 1) break;
        const big = a > bb ? 'A' : 'B', small = big === 'A' ? 'B' : 'A';
        const v = [...room.players.values()].filter(q => isBot(q) && q.team === big).sort(deadFirst)[0];
        if (!v) break;
        if (room.match) { dropBot(room, v); makeBot(room, small); } else v.team = small;
        changed = true;
      }
    } else {
      let have = bots.length;
      if (have > want) { for (const v of bots.slice().sort(deadFirst).slice(0, have - want)) dropBot(room, v); have = want; changed = true; }
      while (have < want) { makeBot(room, null); have++; changed = true; }
      for (const b of room.players.values()) if (isBot(b) && b.team !== null) { b.team = null; changed = true; }
    }
    reorder(room);
    const simP = room.players.get(room.botSim) || null;
    for (const q of room.players.values()) if (isBot(q)) q.simP = simP;
    if (changed && room.match) { if (room.mode === 'bomb') checkBombElimination(room); if (room.match) sendScore(room); }
    return changed;
  }
  /** A room at capacity frees one seat for a human: one bot leaves (a dead one first). */
  function makeRoom(room) {
    const v = [...room.players.values()].filter(isBot).sort((a, b) => (a.status === 'alive' ? 1 : 0) - (b.status === 'alive' ? 1 : 0))[0];
    if (v) dropBot(room, v);
    return !!v;
  }
  function removeAll(room) { for (const q of [...room.players.values()]) if (isBot(q)) dropBot(room, q); }
  const humansIn = room => { let n = 0; for (const q of room.players.values()) if (!isBot(q)) n++; return n; };

  /* ---------- the simulating client ---------- */
  const open = q => !!q && !isBot(q) && q.bc === true && !!q.ws && q.ws.readyState === 1;
  const fresh = (q, now) => !!q.botPerf && now - q.botPerf.at < SIM.fresh;
  const score = (q, now) => (fresh(q, now) ? q.botPerf.ft + 0.2 * q.botPerf.rtt : q.botPerf ? q.botPerf.ft + 0.2 * q.botPerf.rtt + 5 : SIM.unknown);
  function best(room, now, except) {
    let pick = null, ps = Infinity;
    for (const q of room.players.values()) {
      if (!open(q) || q === except) continue;
      const s = score(q, now) - (q.id === room.hostId ? 0.5 : 0);       // ties go to the host
      if (s < ps) { ps = s; pick = q; }
    }
    return pick;
  }
  function setSim(room, q, now) {
    const id = q ? q.id : null;
    if (room.botSim === id) return false;
    room.botSim = id; room.simAt = now; room.btAt = now; room.simStrikes = 0; room.simHold = now + SIM.hold;
    for (const b of room.players.values()) if (isBot(b)) b.simP = q || null;
    return true;
  }
  /** Keeps a simulator while it is valid; otherwise the best candidate. Returns true when it changed. */
  function pickSim(room) {
    const now = Date.now(), cur = room.players.get(room.botSim);
    if (open(cur)) return false;
    return setSim(room, best(room, now, null), now);
  }
  /** Every 2 s: quiet simulator (no tick for 5 s while another one is loaded and reporting), or clearly worse than another for 3 checks in a row. */
  function check(room, now) {
    if (!room.match || !room.botSim) return;
    let any = false; for (const q of room.players.values()) if (isBot(q)) { any = true; break; }
    if (!any) return;
    const cur = room.players.get(room.botSim);
    if (!open(cur)) { if (setSim(room, best(room, now, null), now)) sendRoom(room); return; }
    const alt = best(room, now, cur);
    if (!alt || !fresh(alt, now)) { room.simStrikes = 0; return; }
    if (now - room.btAt > SIM.quiet && now - room.simAt > SIM.quiet) { setSim(room, alt, now); sendRoom(room); return; }
    const sc = score(cur, now), sa = score(alt, now);
    if (fresh(cur, now) && cur.botPerf.ft > SIM.floor && sc > sa * SIM.worse) room.simStrikes = (room.simStrikes || 0) + 1; else room.simStrikes = 0;
    if (room.simStrikes >= SIM.strikes && now >= room.simHold) { setSim(room, alt, now); sendRoom(room); }
  }

  /* ---------- messages ---------- */
  /** {t:'bp', ft, rtt}: what a client measures while a match runs (smoothed frame time in ms, ping in ms). */
  function onPerf(p, m) {
    if (!num(m.ft, 1, 1000) || (m.rtt !== undefined && !num(m.rtt, 0, 10000))) return strike(p, 'bad_bp');
    p.botPerf = { ft: Math.round(m.ft * 10) / 10, rtt: m.rtt === undefined ? 0 : Math.round(m.rtt), at: Date.now() };
  }
  const st = { t: 'state', x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, weapon: '', crouch: false };
  /** {t:'bt', s, f, b, h, a}: the simulator's report for its bots, applied in that order (positions, shots, blasts, hits, objective actions). */
  function onTick(p, m) {
    const room = p.room;
    if (!room || !room.match || room.botSim !== p.id) return;       // a report crossing a migration on the wire is not abuse
    room.btAt = Date.now();
    const bot = id => { const b = typeof id === 'string' ? room.players.get(id) : null; return isBot(b) ? b : null; };
    const list = (v, max) => v === undefined ? [] : Array.isArray(v) && v.length <= max ? v : null;
    const S = list(m.s, 12), F = list(m.f, 32), B = list(m.b, 8), H = list(m.h, 48), A = list(m.a, 8);
    if (!S || !F || !B || !H || !A) return strike(p, 'bad_bt');
    for (const e of S) {
      if (!Array.isArray(e) || e.length !== 10) return strike(p, 'bad_bt');
      const b = bot(e[0]); if (!b) continue;
      st.x = e[1]; st.y = e[2]; st.z = e[3]; st.yaw = e[4]; st.pitch = e[5]; st.vx = e[6]; st.vz = e[7]; st.weapon = e[8]; st.crouch = e[9] === 1;
      onState(b, st);
    }
    for (const e of F) {
      if (!Array.isArray(e) || (e.length !== 8 && e.length !== 13)) return strike(p, 'bad_bt');
      const b = bot(e[0]); if (!b || typeof e[7] !== 'string' || !Object.hasOwn(WEAPONS, e[7])) continue;
      const sm = { t: 'shot', ox: e[1], oy: e[2], oz: e[3], dx: e[4], dy: e[5], dz: e[6], weapon: e[7] };
      if (e.length === 13) { sm.k = e[8]; sm.pid = e[9]; sm.vx = e[10]; sm.vy = e[11]; sm.vz = e[12]; }
      onShot(b, sm);
    }
    for (const e of B) {
      if (!Array.isArray(e) || e.length !== 6) return strike(p, 'bad_bt');
      const b = bot(e[0]); if (!b) continue;
      onBoom(b, { t: 'boom', x: e[1], y: e[2], z: e[3], weapon: e[4], pid: e[5] });
    }
    for (const e of H) {
      if (!Array.isArray(e) || e.length !== 6) return strike(p, 'bad_bt');
      const b = bot(e[0]); if (!b) continue;
      const hm = { t: 'hit', target: e[1], damage: e[2], head: e[3] === 1, weapon: e[4] };
      if (e[5] === 1) hm.splash = true;
      onHit(b, hm);
    }
    for (const e of A) {
      if (!Array.isArray(e) || e.length < 2 || !ACTS.has(e[1])) return strike(p, 'bad_bt');
      const b = bot(e[0]); if (!b) continue;
      onAction(b, { t: 'action', type: e[1], data: e[2] === 'A' || e[2] === 'B' ? { site: e[2] } : {} });
    }
  }
  /** A hit on a bot: its simulator mirrors the health (and the AI turns to the attacker). Only that client gets it. */
  function damaged(room, b, msg) {
    const s = room.players.get(room.botSim);
    if (open(s)) api.send(s, { t: 'action', type: 'bot_hp', from: null, data: { id: b.id, hp: msg.hp, armor: msg.armor, by: msg.from } });
  }

  return {
    SIZE, isBot, sizeOf, fit, makeRoom, removeAll, humansIn, pickSim, check, onPerf, onTick, damaged,
    simOf: room => room.botSim || null,
    count(room) { let n = 0; for (const q of room.players.values()) if (isBot(q)) n++; return n; },
  };
};
