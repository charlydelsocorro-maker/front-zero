// FRONT ZÉRO — client side of the compact protocol. net.js loads it with a dynamic import: if it is missing, the game stays in JSON.
// Active only after the server answered the capability ('nc'), so an older server never receives a binary frame.
import './net-codec.js';
const C = globalThis.FZNetCodec;
const KEEPALIVE_MS = 1000, SETTLE_MS = 1000, CONGESTED = 8192;

export const WIRE_VERSION = C.VERSION;

/** io: { socket(), myId(), hostId(), sendJson(o), pushSnapshot(s, ts), noteArrival(ts), emit(event, data), wantsState() } */
export function createWire(io) {
  const ids = [], weapons = [], upIndex = new Map(), up = new Uint8Array(C.UP_STATE_WIDE), rec = {};
  let active = false, epoch = 0, lastSent = -Infinity, lastChange = -Infinity, sx = 0, sy = 0, sz = 0, syaw = 0, spitch = 0, svx = 0, svz = 0, sw = -1, scr = false;
  let ts = 0;

  const onRecord = (slot, r) => {
    const id = ids[slot];
    if (id === undefined || id === io.myId()) return;
    const s = { id, x: r.x, y: r.y, z: r.z, yaw: r.yaw, pitch: r.pitch, vx: r.vx, vz: r.vz, weapon: weapons[r.w], crouch: r.crouch, status: r.status };
    io.pushSnapshot(s, ts);
    if (io.wantsState()) io.emit('state', { ...s, ts });
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
    reset() { active = false; ids.length = 0; weapons.length = 0; upIndex.clear(); lastSent = -Infinity; sw = -1; },
    onAck(m) { epoch = m.ep; active = true; },
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
          ts = epoch + C.statesTime(b);
          io.noteArrival(ts);
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
      sendBytes(up.subarray(0, C.encodeUpState(up, w, s)));
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
