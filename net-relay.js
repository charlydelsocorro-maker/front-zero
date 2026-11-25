'use strict';
/* FRONT ZÉRO — server side of the compact protocol. Lives at the game root so a publication copies it with *.js; server.js works without it.
   Measured cause of the server load: one socket write per message and per recipient (59 % of the busy CPU). So:
   - everything sent to a client during one event-loop turn leaves in one write (cork), whatever the message type, JSON or binary;
   - hitscan shots wait for the next tick (at most 50 ms) and travel in one frame;
   - clients that announced the capability ('nc') get positions, shots and zombies in binary, encoded once per room. Others keep JSON, unchanged.
   Positions are absolute: under congestion a stale frame is skipped and the next one repairs everything. Reliable events are never skipped.
   Latency (25/11, measured cause: remote soldiers drawn 130-135 ms in the past at 40 ms RTT, with 0-50 ms of jitter from stamping each
   position with the tick time):
   - every accepted position gets a sample time: the v2 client's own clock mapped to server time, else its arrival time;
   - rooms of up to SMALL connected players relay each position at once (same number of writes at 2 players); bigger rooms keep the tick;
   - v2 clients get STATES_T frames (sample time per record); version-1 clients get the old frames, stamped with the sample time when relayed at once;
   - lag compensation: a short position history per player (bots included: it is recorded in onState) lets the hit checks look at the
     target where the shooter saw it, and a shot that left before its shooter's death on the server still counts (capped, never melee). */
const C = require('./net-codec.js');

module.exports = function createRelay(api) {
  const { take, strike, onState, onAction, WEAPONS, raw, OPEN, HARD_BUFFER } = api;
  const EPOCH = Date.now(), SOFT_JSON = 16384, SOFT_BIN = 6144, MAX_SLOTS = 250;
  const SMALL = 4;                       // connected players up to which each position is relayed on arrival
  const HIST = 12, REWIND_MAX = 250;     // history slots per player (~0.6 s at 20 Hz); the furthest a hit check looks back (ms)
  const GRACE_MAX = 150, UP_DEFAULT = 30, DLY_DEFAULT = 100;       // death grace cap; one-way and view delay assumed when a client reports none
  const stats = { droppedJson: 0, droppedBin: 0, now: 0, grace: 0, rewound: 0 };
  let genN = 0, turnQueued = false, holding = false;
  const held = new Set();
  const upState = { t: 'state', x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, weapon: '', crouch: false, ct: -1, rtt: 0, dly: 0 };
  const isOpen = q => !!q.ws && q.ws.readyState === OPEN;       // online bots are players with a closed stub socket

  /* ---------- one write per client and per turn ---------- */
  function release(p) { const s = p.ckS; p.ck = 0; p.ckS = null; held.delete(p); if (s && !s.destroyed) { try { s.uncork(); } catch { /* closing */ } } }
  function endTurn() { turnQueued = false; for (const p of held) if (p.ck === 1) release(p); }
  function queueTurn() { if (!turnQueued) { turnQueued = true; setImmediate(endTurn); } }
  function cork(p) {
    const s = p.ws && p.ws._socket;
    if (!s) return;
    if (p.ck && p.ckS !== s) release(p);
    if (!p.ck) { s.cork(); p.ckS = s; held.add(p); p.ck = holding ? 2 : 1; if (!holding) queueTurn(); return; }
    if (p.ck === 2 && !holding) { p.ck = 1; queueTurn(); }      // a reliable event takes the held shots with it, in order
  }
  function endTick() { drain(Date.now()); for (const p of held) if (p.ck === 2) p.ck = 1; if (held.size) queueTurn(); }

  /* ---------- shots that arrive in a clump after a Wi-Fi stall ----------
     They are not refused: they wait, with the hits that follow them, and are released at the weapon's legal rate. The rate limit itself does not change,
     so a modified client gains nothing: it can never fire faster than the bucket allows, only later. */
  const DEFER_MAX = 32, DEFER_MS = 1500, deferred = new Set();
  function deferShot(p, m) {
    if (p.dqBusy) return false;
    const q = p.dq || (p.dq = []);
    if (q.length >= DEFER_MAX) return false;
    m.dqAt = Date.now(); q.push(m); deferred.add(p);
    return true;
  }
  /** While shots are waiting, the hits and blasts behind them keep their order. */
  function hold(p, m) {
    if (!p.dq || !p.dq.length || p.dqBusy || (m.t !== 'shot' && m.t !== 'hit' && m.t !== 'boom') || p.dq.length >= DEFER_MAX) return false;
    m.dqAt = Date.now(); p.dq.push(m);
    return true;
  }
  function drain(now) {
    for (const p of deferred) {
      const q = p.dq;
      if (!q || !p.ws || !p.room) { p.dq = null; deferred.delete(p); continue; }
      p.dqBusy = true;
      try {
        while (q.length) {
          const m = q[0];
          if (m.t === 'shot' && now - m.dqAt <= DEFER_MS) {
            const w = WEAPONS[m.weapon], b = p.fire[m.weapon];
            if (w && b && Math.min(w.cap, b.n + (now - b.at) / 1000 * w.rate) < 1) break;       // its turn has not come yet
          }
          q.shift();
          if (now - m.dqAt > DEFER_MS) { if (m.t === 'shot') api.reject(p, 'fire_rate'); continue; }
          try { api.dispatch(p, m); } catch (e) { console.error('deferred message error', m.t, e); }
        }
      } finally { p.dqBusy = false; }
      if (!q.length) { p.dq = null; deferred.delete(p); }
    }
  }
  const softLimit = p => (p.nc ? SOFT_BIN : SOFT_JSON);

  function sendBin(q, buf, volatile) {
    const ws = q.ws;
    if (!ws || ws.readyState !== OPEN) return;
    if (ws.bufferedAmount > HARD_BUFFER) { ws.terminate(); return; }
    if (volatile && ws.bufferedAmount > SOFT_BIN) { stats.droppedBin++; return; }
    cork(q);
    ws.send(buf, { binary: true }, () => { /* socket closing: the close handler cleans up */ });
  }

  /* ---------- per-room dictionaries: actor ids and weapon names travel once, as small numbers ---------- */
  const fresh = () => ({ gen: ++genN, ids: new Map(), idList: [], w: new Map(), wList: [] });
  function ensure(room, list, idKey, wKey) {
    let nd = room.nd || (room.nd = fresh()), nI = 0, nW = 0;
    for (const s of list) { if (!nd.ids.has(s[idKey])) nI++; if (!nd.w.has(s[wKey])) nW++; }
    if (nd.idList.length + nI > MAX_SLOTS || nd.wList.length + nW > MAX_SLOTS) nd = room.nd = fresh();
    return nd;
  }
  function slot(nd, id) { let v = nd.ids.get(id); if (v === undefined) { v = nd.idList.length; nd.ids.set(id, v); nd.idList.push([v, id]); } return v; }
  function wIndex(nd, w) { let v = nd.w.get(w); if (v === undefined) { v = nd.wList.length; nd.w.set(w, v); nd.wList.push([v, w]); } return v; }
  function syncDict(nd, q) {
    const reset = q.ndGen !== nd.gen;
    if (reset) { q.ndGen = nd.gen; q.ndI = 0; q.ndW = 0; }
    if (!reset && q.ndI >= nd.idList.length && q.ndW >= nd.wList.length) return;
    raw(q, JSON.stringify({ t: 'nd', ...(reset ? { r: 1 } : null), a: nd.idList.slice(q.ndI), w: nd.wList.slice(q.ndW) }));
    q.ndI = nd.idList.length; q.ndW = nd.wList.length;
  }

  /* ---------- sample times and the position history (lag compensation) ----------
     One entry point, track(p, now), called by onState for every accepted position: humans (JSON or binary) and online bots alike. */
  /* v2 client: its clock + the smallest (arrival - clock) of the last 2-4 s (two 2 s buckets), so a drift, a new route or a slower
     link is followed within 4 s. Measured on this server's monotonic clock, then moved to wall time: a wall-clock step (time sync)
     must not age every stamp until the minimum catches up. */
  const MIN_WIN = 2000;
  function sampleTime(p, now) {
    let t = now;
    if (p.upCt >= 0) {
      const mono = performance.now(), off = mono - p.upCt;
      if (p.ctB === undefined || Math.abs(off - Math.min(p.ctB, p.ctA)) > 60000) { p.ctB = p.ctA = off; p.ctAt = mono; }
      else {
        if (mono - p.ctAt >= MIN_WIN) { p.ctA = p.ctB; p.ctB = off; p.ctAt = mono; }       // the older bucket drops out
        else if (off < p.ctB) p.ctB = off;
      }
      t = p.upCt + Math.min(p.ctA, p.ctB) + (now - mono);
    }
    if (t > now) t = now; else if (t < now - REWIND_MAX) t = now - REWIND_MAX;
    if (p.sT && t <= p.sT) t = p.sT + 1;       // strictly increasing per player: the clients drop a sample that is not newer
    return t;
  }
  function track(p, now) {
    const t = sampleTime(p, now);
    const h = p.lh || (p.lh = { t: new Float64Array(HIST), x: new Float32Array(HIST), y: new Float32Array(HIST), z: new Float32Array(HIST), i: 0, n: 0 });
    if (h.n) { const k = h.i, gap = t - h.t[k]; if (gap > 400 || Math.hypot(p.x - h.x[k], p.z - h.z[k]) > 8) h.n = 0; }       // a respawn, a teleport or a long silence: no path between the two
    h.i = (h.i + 1) % HIST; h.t[h.i] = t; h.x[h.i] = p.x; h.y[h.i] = p.y; h.z[h.i] = p.z; if (h.n < HIST) h.n++;
    p.sT = t; p.acc = true;
  }
  /** How far in the past the shooter saw the others: its one-way delay plus its interpolation delay, as its client reports them (a bot: its simulator's). */
  function viewLag(p) {
    const v = p.bot ? p.simP || p : p;
    return Math.min(REWIND_MAX, (v.rttRep ? Math.min(300, v.rttRep) / 2 : UP_DEFAULT) + (v.dlyRep || DLY_DEFAULT));
  }
  const seenOut = { x: 0, y: 0, z: 0 };
  /** Where `shooter` saw `target` when it fired (the hit arrives now). Returns the target itself when no rewind applies. Reused result object. */
  function seen(shooter, target, now) {
    const h = target.lh;
    if (!h || !h.n) return target;
    const vt = now - viewLag(shooter);
    let j = h.i;
    if (vt >= h.t[j]) return target;
    stats.rewound++;
    for (let k = 1; k < h.n; k++) {
      const i = (j - 1 + HIST) % HIST;
      if (h.t[i] <= vt) {
        const f = (vt - h.t[i]) / Math.max(1, h.t[j] - h.t[i]);
        seenOut.x = h.x[i] + (h.x[j] - h.x[i]) * f; seenOut.y = h.y[i] + (h.y[j] - h.y[i]) * f; seenOut.z = h.z[i] + (h.z[j] - h.z[i]) * f;
        return seenOut;
      }
      j = i;
    }
    seenOut.x = h.x[j]; seenOut.y = h.y[j]; seenOut.z = h.z[j];
    return seenOut;
  }
  /** The server has just killed this shooter, but its shot (or hit) left before that death: sample time = arrival - its upstream delay.
      Capped at GRACE_MAX ms after the death, never for a melee swing. */
  function grace(p, w, now) {
    if (p.status !== 'dead' || !p.diedAt || !w || w.kind === 'melee') return false;
    const v = p.bot ? p.simP || p : p, up = v.rttRep ? Math.min(300, v.rttRep) / 2 : UP_DEFAULT;
    if (now - p.diedAt >= Math.min(GRACE_MAX, up + 10)) return false;
    stats.grace++;
    return true;
  }

  /* ---------- positions ---------- */
  const one = [null], rec = { id: '', x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, weapon: '', crouch: false, status: 'alive' };
  /** Small room: the position just accepted leaves now, alone, instead of waiting up to 50 ms for the tick. */
  function relayNow(p, room, now) {
    if (!room.small || !room.match || p.status !== 'alive') return;
    rec.id = p.id; rec.x = p.x; rec.y = p.y; rec.z = p.z; rec.yaw = p.yaw; rec.pitch = p.pitch; rec.vx = p.vx; rec.vz = p.vz; rec.weapon = p.weapon; rec.crouch = p.crouch; rec.status = p.status;
    one[0] = rec;
    let b1 = null, b2 = null, nd = null;
    for (const q of room.players.values()) {
      if (q === p || !q.nc || !isOpen(q)) continue;
      if (!nd) { nd = ensure(room, one, 'id', 'weapon'); slot(nd, p.id); wIndex(nd, p.weapon); }
      syncDict(nd, q);
      if (q.nc >= 2) {
        if (!b2) { const sz = 6 + C.actorSize(rec) + C.AGE; b2 = Buffer.allocUnsafe(sz); C.writeStatesHead(b2, (now - EPOCH) >>> 0, 1, C.FRAME.STATES_T); C.writeAge(b2, C.writeActor(b2, 6, slot(nd, p.id), wIndex(nd, p.weapon), rec), now - p.sT); }
        sendBin(q, b2, true);
      } else {
        if (!b1) { b1 = Buffer.allocUnsafe(6 + C.actorSize(rec)); C.writeStatesHead(b1, (p.sT - EPOCH) >>> 0, 1); C.writeActor(b1, 6, slot(nd, p.id), wIndex(nd, p.weapon), rec); }
        sendBin(q, b1, true);
      }
    }
    p.fwd = true; stats.now++;
  }
  /* ---------- tick: positions, then the shots of the last 50 ms ---------- */
  function states(room, batch, now) {
    let v1 = 0, v2 = 0, json = 0, open = 0;
    for (const q of room.players.values()) { if (!isOpen(q)) continue; open++; if (q.nc >= 2) v2++; else if (q.nc) v1++; else json++; }
    room.small = open <= SMALL;
    if (batch.length) {
      if (json) {
        const s = JSON.stringify({ t: 'states', ts: now, s: batch });
        for (const q of room.players.values()) if (!q.nc && isOpen(q)) raw(q, s, true);
      }
      if (v1 || v2) {
        let list = batch;       // positions already relayed at once leave the binary frames
        for (let i = 0; i < batch.length; i++) { const q = room.players.get(batch[i].id); if (q && q.fwd) { list = batch.filter(s => { const o = room.players.get(s.id); return !(o && o.fwd); }); break; } }
        if (list.length) {
          const nd = ensure(room, list, 'id', 'weapon'), n = Math.min(255, list.length);
          let size = 6; for (let i = 0; i < n; i++) size += C.actorSize(list[i]);
          let b1 = null, b2 = null;
          if (v1) {
            b1 = Buffer.allocUnsafe(size); C.writeStatesHead(b1, (now - EPOCH) >>> 0, n);
            let o = 6; for (let i = 0; i < n; i++) { const s = list[i]; o = C.writeActor(b1, o, slot(nd, s.id), wIndex(nd, s.weapon), s); }
          }
          if (v2) {
            b2 = Buffer.allocUnsafe(size + n * C.AGE); C.writeStatesHead(b2, (now - EPOCH) >>> 0, n, C.FRAME.STATES_T);
            let o = 6;
            for (let i = 0; i < n; i++) { const s = list[i], q = room.players.get(s.id); o = C.writeAge(b2, C.writeActor(b2, o, slot(nd, s.id), wIndex(nd, s.weapon), s), q && q.sT ? now - q.sT : 0); }
          }
          for (const q of room.players.values()) if (q.nc && isOpen(q)) { syncDict(nd, q); sendBin(q, q.nc >= 2 ? b2 : b1, true); }
        }
      }
      for (let i = 0; i < batch.length; i++) { const q = room.players.get(batch[i].id); if (q) q.fwd = false; }
    }
    if (room.ns && room.ns.length) flushShots(room);
  }
  function encodeShots(nd, list, skip) {
    const pick = skip ? list.filter(e => e.ex !== skip) : list, n = Math.min(255, pick.length);
    if (!n) return null;
    const b = Buffer.allocUnsafe(2 + n * C.SHOT);
    b[0] = C.FRAME.SHOTS; b[1] = n;
    let o = 2;
    for (let i = 0; i < n; i++) { const e = pick[i]; o = C.writeShot(b, o, slot(nd, e.id), wIndex(nd, e.weapon), e.o); }
    return b;
  }
  function flushShots(room) {
    const list = room.ns; room.ns = null;
    const nd = ensure(room, list, 'id', 'weapon');
    for (const e of list) { slot(nd, e.id); wIndex(nd, e.weapon); }
    const common = encodeShots(nd, list, null);
    for (const q of room.players.values()) {
      if (!q.nc || !isOpen(q)) continue;
      syncDict(nd, q);
      const f = list.some(e => e.ex === q) ? encodeShots(nd, list, q) : common;
      if (f) sendBin(q, f, false);
    }
  }
  /** A shot to relay. Hitscan: held for the tick. A projectile (its mirror must start at once) goes out now, in JSON. */
  function shot(room, o, except) {
    const compact = !o.k && C.shotFits(o);
    let s = null, anyBin = false;
    for (const q of room.players.values()) {
      if (q === except || !isOpen(q)) continue;
      if (q.nc && compact) { anyBin = true; continue; }
      s = s || JSON.stringify(o);
      holding = compact; try { raw(q, s); } finally { holding = false; }
    }
    if (anyBin) (room.ns || (room.ns = [])).push({ id: o.id, weapon: o.weapon, o, ex: except && except.id !== o.id ? except : null });
  }

  /* ---------- zombies: 10 Hz from the host, the largest stream of the mode ---------- */
  function zombies(room, from, zs) {
    let bin = null, s = null;
    for (const q of room.players.values()) {
      if (q === from || !isOpen(q)) continue;
      if (q.nc) { bin = bin || Buffer.from(C.encodeZombies(zs, C.FRAME.ZOMBIES)); sendBin(q, bin, true); }
      else { s = s || JSON.stringify({ t: 'action', type: 'z_sync', from: from.id, data: { zombies: zs } }); raw(q, s, true); }
    }
  }

  /* ---------- capability and what the client sends ---------- */
  function onCaps(p, m) {
    if (!(m.v >= 1)) return;
    p.nc = m.v >= 2 ? 2 : 1; p.ncW = [];
    raw(p, JSON.stringify({ t: 'nc', v: p.nc, ep: EPOCH }));
  }
  function onWeapon(p, m) {
    if (!p.nc || !Number.isInteger(m.i) || m.i < 0 || m.i > 255 || typeof m.w !== 'string' || !Object.hasOwn(WEAPONS, m.w)) return strike(p, 'bad_message');
    p.ncW[m.i] = m.w;
  }
  function onBinary(p, data) {
    if (!p.nc || data.length < 2) return strike(p, 'bad_message');
    switch (data[0]) {
      case C.FRAME.UP_STATE: {
        if (!take(p, 'state')) return;       // a burst after a Wi-Fi stall: the newest position is what matters
        const i = C.decodeUpState(data, upState);
        if (i < 0 || !p.ncW[i]) return strike(p, 'bad_state');
        upState.weapon = p.ncW[i];
        if (upState.rtt) p.rttRep = upState.rtt;
        if (upState.dly) p.dlyRep = upState.dly;
        p.upCt = upState.ct; p.acc = false;
        try { onState(p, upState); } finally { p.upCt = -1; }
        if (p.acc && p.room) relayNow(p, p.room, Date.now());
        return;
      }
      case C.FRAME.UP_ZOMBIES:
        if (!take(p, 'action')) return strike(p, 'rate_limited');
        return onAction(p, { type: 'z_sync', data: { zombies: C.decodeZombies(data) } });
      case C.FRAME.UP_BOTS:
        if (!take(p, 'action')) return strike(p, 'rate_limited');
        return onAction(p, { type: 'zb_tick', data: { s: C.decodeBots(data, i => p.ncW[i] || null) } });
      default: return strike(p, 'bad_message');
    }
  }
  return { version: C.VERSION, cork, endTick, deferShot, hold, softLimit, states, shot, zombies, onCaps, onWeapon, onBinary, track, seen, grace, viewLag, stats };
};
