'use strict';
/* FRONT ZÉRO — server side of the compact protocol. Lives at the game root so a publication copies it with *.js; server.js works without it.
   Measured cause of the server load: one socket write per message and per recipient (59 % of the busy CPU). So:
   - everything sent to a client during one event-loop turn leaves in one write (cork), whatever the message type, JSON or binary;
   - hitscan shots wait for the next tick (at most 50 ms) and travel in one frame;
   - clients that announced the capability ('nc') get positions, shots and zombies in binary, encoded once per room. Others keep JSON, unchanged.
   Positions are absolute: under congestion a stale frame is skipped and the next one repairs everything. Reliable events are never skipped. */
const C = require('./net-codec.js');

module.exports = function createRelay(api) {
  const { take, strike, onState, onAction, WEAPONS, raw, OPEN, HARD_BUFFER } = api;
  const EPOCH = Date.now(), SOFT_JSON = 16384, SOFT_BIN = 6144, MAX_SLOTS = 250;
  const stats = { droppedJson: 0, droppedBin: 0 };
  let genN = 0, turnQueued = false, holding = false;
  const held = new Set();
  const upState = { t: 'state', x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, weapon: '', crouch: false };

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

  /* ---------- tick: positions, then the shots of the last 50 ms ---------- */
  function states(room, batch, now) {
    let bin = 0, json = 0;
    for (const q of room.players.values()) { if (q.nc) bin++; else json++; }
    if (batch.length) {
      if (json) {
        const s = JSON.stringify({ t: 'states', ts: now, s: batch });
        for (const q of room.players.values()) if (!q.nc) raw(q, s, true);
      }
      if (bin) {
        const nd = ensure(room, batch, 'id', 'weapon'), n = Math.min(255, batch.length);
        let size = 6; for (let i = 0; i < n; i++) size += C.actorSize(batch[i]);
        const b = Buffer.allocUnsafe(size);
        C.writeStatesHead(b, (now - EPOCH) >>> 0, n);
        let o = 6;
        for (let i = 0; i < n; i++) { const s = batch[i]; o = C.writeActor(b, o, slot(nd, s.id), wIndex(nd, s.weapon), s); }
        for (const q of room.players.values()) if (q.nc) { syncDict(nd, q); sendBin(q, b, true); }
      }
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
      if (!q.nc) continue;
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
      if (q === except) continue;
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
      if (q === from) continue;
      if (q.nc) { bin = bin || Buffer.from(C.encodeZombies(zs, C.FRAME.ZOMBIES)); sendBin(q, bin, true); }
      else { s = s || JSON.stringify({ t: 'action', type: 'z_sync', from: from.id, data: { zombies: zs } }); raw(q, s, true); }
    }
  }

  /* ---------- capability and what the client sends ---------- */
  function onCaps(p, m) {
    if (!(m.v >= 1)) return;
    p.nc = 1; p.ncW = [];
    raw(p, JSON.stringify({ t: 'nc', v: C.VERSION, ep: EPOCH }));
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
        return onState(p, upState);
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
  return { version: C.VERSION, cork, endTick, deferShot, hold, softLimit, states, shot, zombies, onCaps, onWeapon, onBinary, stats };
};
