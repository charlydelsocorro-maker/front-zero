// FRONT ZÉRO — client side of the compact protocol. net.js loads it with a dynamic import: if it is missing, the game stays in JSON.
// Active only after the server answered the capability ('nc'), so an older server never receives a binary frame.
// Version 2 (only when the server answers v >= 2): each state carries this client's clock, ping and view delay, and STATES_T records come
// with their own sample time, so a remote soldier is drawn at the moment its position was true instead of the moment of a server tick.
import './net-codec.js';
const C = globalThis.FZNetCodec;
const KEEPALIVE_MS = 1000, SETTLE_MS = 1000, CONGESTED = 8192;

export const WIRE_VERSION = C.VERSION;

/** io: { socket(), myId(), hostId(), sendJson(o), pushSnapshot(s, ts), noteArrival(ts), emit(event, data), wantsState(), quality?() } */
export function createWire(io) {
  const ids = [], weapons = [], upIndex = new Map(), up = new Uint8Array(C.UP_STATE_MAX), rec = {}, tail = { ct: 0, rtt: 0, dly: 0 };
  let srvV = 1;
  let active = false, epoch = 0, lastSent = -Infinity, lastChange = -Infinity, sx = 0, sy = 0, sz = 0, syaw = 0, spitch = 0, svx = 0, svz = 0, sw = -1, scr = false;
  let ts = 0, aged = false;
  /* Lateness of timed records, for net.js's adaptive delay. Records that arrive together (a burst after a Wi-Fi or TCP stall) count only
     through the newest one of each player: the old ones of a burst say how long the stall was, not how late the next positions will be,
     and counting them pinned the delay at its 240 ms cap for seconds after a single hiccup. When STALL_N stalls fall within STALL_MS
     (a lossy line), they count in full again: a longer delay then beats a correction at every stall. STALL_GAP is over two send intervals,
     so two positions that merely queued behind a long frame of this page are not taken for a network stall. */
  const BURST_MS = 40;       // a backlog can reach this page over several tasks with frames drawn in between: wait a little before judging it
  const STALL_GAP = 120, STALL_MS = 3000, STALL_N = 3, stalls = new Array(STALL_N - 1).fill(-Infinity);
  const burst = new Map();       // id -> { t: newest sample time, at: its arrival (performance.now), late: worst lateness in this burst, gen }
  let burstGen = 0, burstTimer = 0;
  function flushBurst() {
    burstTimer = 0;
    const now = performance.now();
    let fresh = null, worst = -Infinity;
    for (const e of burst.values()) if (e.gen === burstGen) { if (!fresh || e.at - e.t > fresh.at - fresh.t) fresh = e; if (e.late > worst) worst = e.late; }
    burstGen++;
    if (!fresh) return;
    let late = fresh.at - fresh.t;
    if (worst - late > STALL_GAP) {       // stalls[] holds the STALL_N - 1 previous ones, oldest first
      if (now - stalls[0] < STALL_MS) late = worst;
      stalls.shift(); stalls.push(now);
    }
    io.noteArrival(fresh.at - late + (now - fresh.at));       // as if it had been noted when that record came in
  }
  function noteTimed(id, t) {
    let e = burst.get(id);
    if (!e) burst.set(id, e = { t: -Infinity, at: 0, late: 0, gen: -1 });
    const at = performance.now();
    if (e.gen !== burstGen) { e.t = t; e.at = at; e.late = at - t; e.gen = burstGen; }
    else { if (t > e.t) { e.t = t; e.at = at; } if (at - t > e.late) e.late = at - t; }
    if (!burstTimer) burstTimer = setTimeout(flushBurst, BURST_MS);
  }

  const onRecord = (slot, r) => {
    const id = ids[slot];
    if (id === undefined || id === io.myId()) return;
    const t = ts - r.age;       // STATES_T: when this position was true (server clock); STATES: the frame time
    if (aged) noteTimed(id, t);
    const s = { id, x: r.x, y: r.y, z: r.z, yaw: r.yaw, pitch: r.pitch, vx: r.vx, vz: r.vz, weapon: weapons[r.w], crouch: r.crouch, status: r.status };
    io.pushSnapshot(s, t);
    if (io.wantsState()) io.emit('state', { ...s, ts: t });
  };
  const onShot = (slot, w, o) => {
    const id = ids[slot], weapon = weapons[w];
    if (id === undefined || weapon === undefined || id === io.myId()) return;
    o.id = id; o.weapon = weapon;
    io.emit('shot', o);
  };
  function weaponIndex(name) {
    let i = upIndex.get(name);
    if (i === undefined) {
      if (upIndex.size >= 255) return -1;
      i = upIndex.size; upIndex.set(name, i);
      io.sendJson({ t: 'ncw', i, w: name });
    }
    return i;
  }
  const sendBytes = b => { const ws = io.socket(); if (ws) ws.send(b); };

  return {
    get active() { return active; },
    reset() { active = false; srvV = 1; burst.clear(); clearTimeout(burstTimer); burstTimer = 0; ids.length = 0; weapons.length = 0; upIndex.clear(); lastSent = -Infinity; sw = -1; },
    onAck(m) { epoch = m.ep; srvV = m.v | 0 || 1; active = true; },
    onDict(m) {
      if (m.r) { ids.length = 0; weapons.length = 0; }
      if (Array.isArray(m.a)) for (const e of m.a) ids[e[0]] = e[1];
      if (Array.isArray(m.w)) for (const e of m.w) weapons[e[0]] = e[1];
    },
    onFrame(data) {
      const b = new Uint8Array(data);
      if (b.length < 2) return;
      switch (b[0]) {
        case C.FRAME.STATES:
          ts = epoch + C.statesTime(b); aged = false;
          io.noteArrival(ts);
          C.readStates(b, rec, onRecord);
          break;
        case C.FRAME.STATES_T:
          ts = epoch + C.statesTime(b); aged = true;
          C.readStates(b, rec, onRecord);
          break;
        case C.FRAME.SHOTS: C.readShots(b, onShot); break;
        case C.FRAME.ZOMBIES: io.emit('action', { type: 'z_sync', from: io.hostId(), data: { zombies: C.decodeZombies(b) } }); break;
        default: break;
      }
    },
    /** Sends the player's state. Returns false when this frame was not needed (nothing changed) or the socket is congested. */
    sendState(s, now) {
      const ws = io.socket();
      if (!ws || ws.bufferedAmount > CONGESTED) return false;       // stale before it leaves: the next one carries the newest position
      const w = weaponIndex(s.weapon);
      if (w < 0) return false;
      const same = w === sw && !!s.crouch === scr && Math.abs(s.x - sx) < 0.01 && Math.abs(s.y - sy) < 0.01 && Math.abs(s.z - sz) < 0.01 && Math.abs(s.yaw - syaw) < 0.003 && Math.abs(s.pitch - spitch) < 0.006 && Math.abs(s.vx - svx) < 0.1 && Math.abs(s.vz - svz) < 0.1;
      // Keep sending for a second after the last change: the server walks a clamped position towards ours one state at a time.
      if (!same) lastChange = now;
      else if (now - lastChange > SETTLE_MS && now - lastSent < KEEPALIVE_MS) return false;
      sx = s.x; sy = s.y; sz = s.z; syaw = s.yaw; spitch = s.pitch; svx = s.vx; svz = s.vz; sw = w; scr = !!s.crouch; lastSent = now;
      let t = null;
      if (srvV >= 2) {       // when this position was true (this clock), and how late this client sees the others: the server's lag compensation
        const q = io.quality ? io.quality() : null;
        tail.ct = performance.now(); tail.rtt = q && q.rtt > 0 ? q.rtt : 0; tail.dly = q && q.delay > 0 ? q.delay : 0; t = tail;
      }
      sendBytes(up.subarray(0, C.encodeUpState(up, w, s, t)));
      return true;
    },
    /** Takes over the two high-frequency bot actions. Returns true when the message was sent here. */
    sendAction(type, data) {
      if (type === 'z_sync' && data && Array.isArray(data.zombies)) { sendBytes(C.encodeZombies(data.zombies, C.FRAME.UP_ZOMBIES)); return true; }
      if (type === 'zb_tick' && data && Array.isArray(data.s)) {
        for (const e of data.s) if (weaponIndex(e[8]) < 0) return false;
        sendBytes(C.encodeBots(data.s, name => upIndex.get(name)));
        if (data.f || data.d || data.b) { const rest = {}; if (data.f) rest.f = data.f; if (data.d) rest.d = data.d; if (data.b) rest.b = data.b; io.sendJson({ t: 'action', type, data: rest }); }
        return true;
      }
      return false;
    },
  };
}
