// FRONT ZÉRO — compact binary frames for high-frequency traffic (positions, bullets, bots). Rare events stay in JSON.
// No import/export on purpose: the server loads it with require(), the browser with `import './net-codec.js'` (globalThis.FZNetCodec).
// Every frame is absolute (no delta against a previous frame), so a frame dropped under congestion never corrupts the next one.
(function (root) {
  'use strict';
  const VERSION = 1;
  const FRAME = { STATES: 1, ZOMBIES: 2, VOLATILE: 3, SHOTS: 4, UP_STATE: 16, UP_ZOMBIES: 17, UP_BOTS: 18 };
  const STATUS = ['alive', 'dead', 'downed', 'lobby'];
  const ZTYPES = ['walker', 'runner', 'brute'];
  const TAU = Math.PI * 2;
  const WIDE = 0x80, CROUCH = 1;
  const POS = 50, HGT = 100, PITCH = 80, VEL = 4, DIR = 32767;       // 2 cm, 1 cm, 0.7 degree, 0.25 m/s
  const POS_MAX = 32767 / POS, HGT_MAX = 32767 / HGT;
  const ACTOR = 14, ACTOR_WIDE = 20, SHOT = 14, UP_STATE = 14, UP_STATE_WIDE = 20, UP_BOT = 16;

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const i16 = (b, o, v) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; };
  const r16 = (b, o) => ((b[o] | (b[o + 1] << 8)) << 16) >> 16;
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const w32 = (b, o, v) => { b[o] = v & 255; b[o + 1] = (v >>> 8) & 255; b[o + 2] = (v >>> 16) & 255; b[o + 3] = (v >>> 24) & 255; };
  const fbuf = new Float32Array(1), fbytes = new Uint8Array(fbuf.buffer);
  const wf = (b, o, v) => { fbuf[0] = v; b[o] = fbytes[0]; b[o + 1] = fbytes[1]; b[o + 2] = fbytes[2]; b[o + 3] = fbytes[3]; };
  const rf = (b, o) => { fbytes[0] = b[o]; fbytes[1] = b[o + 1]; fbytes[2] = b[o + 2]; fbytes[3] = b[o + 3]; return fbuf[0]; };
  const q = (v, k) => Math.round(v * k);
  const yawOut = v => { let a = v % TAU; if (a < 0) a += TAU; return Math.round(a / TAU * 65536) & 0xffff; };
  const yawIn = v => { const a = v / 65536 * TAU; return a > Math.PI ? a - TAU : a; };
  const small = s => Math.abs(s.x) < POS_MAX && Math.abs(s.z) < POS_MAX && Math.abs(s.y) < HGT_MAX;
  const statusCode = s => { const i = STATUS.indexOf(s); return i < 0 ? 0 : i; };

  /* ---------- positions, server to clients ---------- */
  const actorSize = s => (small(s) ? ACTOR : ACTOR_WIDE);
  function writeActor(b, o, slot, weapon, s) {
    const wide = !small(s);
    b[o] = slot; b[o + 1] = (s.crouch ? CROUCH : 0) | (statusCode(s.status) << 1) | (wide ? WIDE : 0);
    let p = o + 2;
    if (wide) { wf(b, p, s.x); wf(b, p + 4, s.y); wf(b, p + 8, s.z); p += 12; }
    else { i16(b, p, q(s.x, POS)); i16(b, p + 2, q(s.y, HGT)); i16(b, p + 4, q(s.z, POS)); p += 6; }
    i16(b, p, yawOut(s.yaw)); b[p + 2] = clamp(q(s.pitch || 0, PITCH), -127, 127) & 255;
    b[p + 3] = clamp(q(s.vx || 0, VEL), -127, 127) & 255; b[p + 4] = clamp(q(s.vz || 0, VEL), -127, 127) & 255; b[p + 5] = weapon;
    return p + 6;
  }
  /** Header of a STATES frame: type, u32 time since the connection's epoch, record count. */
  function writeStatesHead(b, tsRel, count) { b[0] = FRAME.STATES; w32(b, 1, tsRel); b[5] = count; return 6; }
  /** Calls fn(slot, record) for each actor; `out` is reused, copy what you keep. Returns the frame's relative time. */
  function readStates(b, out, fn) {
    const tsRel = u32(b, 1), n = b[5];
    let o = 6;
    for (let i = 0; i < n; i++) {
      if (o + ACTOR > b.length) break;
      const slot = b[o], fl = b[o + 1];
      let p = o + 2;
      if (fl & WIDE) { if (o + ACTOR_WIDE > b.length) break; out.x = rf(b, p); out.y = rf(b, p + 4); out.z = rf(b, p + 8); p += 12; }
      else { out.x = r16(b, p) / POS; out.y = r16(b, p + 2) / HGT; out.z = r16(b, p + 4) / POS; p += 6; }
      out.yaw = yawIn(u16(b, p)); out.pitch = ((b[p + 2] << 24) >> 24) / PITCH;
      out.vx = ((b[p + 3] << 24) >> 24) / VEL; out.vz = ((b[p + 4] << 24) >> 24) / VEL;
      out.w = b[p + 5]; out.crouch = !!(fl & CROUCH); out.status = STATUS[(fl >> 1) & 3];
      o = p + 6;
      fn(slot, out);
    }
    return tsRel;
  }

  /* ---------- hitscan shots, server to clients ---------- */
  function writeShot(b, o, slot, weapon, m) {
    b[o] = slot; b[o + 1] = weapon;
    i16(b, o + 2, clamp(q(m.ox, POS), -32767, 32767)); i16(b, o + 4, clamp(q(m.oy, HGT), -32767, 32767)); i16(b, o + 6, clamp(q(m.oz, POS), -32767, 32767));
    i16(b, o + 8, clamp(q(m.dx, DIR), -32767, 32767)); i16(b, o + 10, clamp(q(m.dy, DIR), -32767, 32767)); i16(b, o + 12, clamp(q(m.dz, DIR), -32767, 32767));
    return o + SHOT;
  }
  const shotFits = m => Math.abs(m.ox) < POS_MAX && Math.abs(m.oz) < POS_MAX && Math.abs(m.oy) < HGT_MAX;
  function readShots(b, fn) {
    const n = b[1];
    let o = 2;
    for (let i = 0; i < n && o + SHOT <= b.length; i++, o += SHOT) {
      fn(b[o], b[o + 1], { ox: r16(b, o + 2) / POS, oy: r16(b, o + 4) / HGT, oz: r16(b, o + 6) / POS, dx: r16(b, o + 8) / DIR, dy: r16(b, o + 10) / DIR, dz: r16(b, o + 12) / DIR });
    }
  }

  /* ---------- zombies (host to server, server to clients) ---------- */
  function encodeZombies(list, type) {
    const n = Math.min(255, list.length), b = new Uint8Array(2 + n * 15);
    b[0] = type; b[1] = n;
    let o = 2;
    for (let i = 0; i < n; i++) {
      const z = list[i];
      let id = z.id >>> 0;
      while (id > 127) { b[o++] = (id & 127) | 128; id >>>= 7; }
      b[o++] = id;
      i16(b, o, clamp(q(z.x, POS), -32767, 32767)); i16(b, o + 2, clamp(q(z.y || 0, HGT), -32767, 32767)); i16(b, o + 4, clamp(q(z.z, POS), -32767, 32767));
      b[o + 6] = Math.round((((z.yaw || 0) % TAU + TAU) % TAU) / TAU * 256) & 255;
      i16(b, o + 7, clamp(Math.ceil(z.hp || 0), 0, 65535));
      const t = ZTYPES.indexOf(z.state); b[o + 9] = t < 0 ? 0 : t;
      o += 10;
    }
    return b.subarray(0, o);
  }
  function decodeZombies(b) {
    const n = b[1], list = new Array(n);
    let o = 2, k = 0;
    for (; k < n; k++) {
      let id = 0, sh = 0, c;
      do { if (o >= b.length) return list.slice(0, k); c = b[o++]; id += (c & 127) * 2 ** sh; sh += 7; } while (c & 128 && sh < 35);
      if (o + 10 > b.length) return list.slice(0, k);
      const y = b[o + 6] / 256 * TAU;
      list[k] = { id, x: r16(b, o) / POS, y: r16(b, o + 2) / HGT, z: r16(b, o + 4) / POS, yaw: y > Math.PI ? y - TAU : y, hp: u16(b, o + 7), state: ZTYPES[b[o + 9]] || 'walker' };
      o += 10;
    }
    return list;
  }

  /* ---------- the player's own state, client to server ---------- */
  function encodeUpState(b, weapon, s) {
    const wide = !small(s);
    b[0] = FRAME.UP_STATE; b[1] = (s.crouch ? CROUCH : 0) | (wide ? WIDE : 0); b[2] = weapon;
    let p = 3;
    if (wide) { wf(b, p, s.x); wf(b, p + 4, s.y); wf(b, p + 8, s.z); p += 12; }
    else { i16(b, p, q(s.x, POS)); i16(b, p + 2, q(s.y, HGT)); i16(b, p + 4, q(s.z, POS)); p += 6; }
    i16(b, p, yawOut(s.yaw)); b[p + 2] = clamp(q(s.pitch || 0, PITCH), -127, 127) & 255;
    b[p + 3] = clamp(q(s.vx || 0, VEL), -127, 127) & 255; b[p + 4] = clamp(q(s.vz || 0, VEL), -127, 127) & 255;
    return p + 5;
  }
  /** Fills `m` and returns the weapon index, or -1 when the frame is malformed. */
  function decodeUpState(b, m) {
    if (b.length < UP_STATE) return -1;
    const fl = b[1];
    let p = 3;
    if (fl & WIDE) { if (b.length < UP_STATE_WIDE) return -1; m.x = rf(b, p); m.y = rf(b, p + 4); m.z = rf(b, p + 8); p += 12; }
    else { m.x = r16(b, p) / POS; m.y = r16(b, p + 2) / HGT; m.z = r16(b, p + 4) / POS; p += 6; }
    m.yaw = yawIn(u16(b, p)); m.pitch = ((b[p + 2] << 24) >> 24) / PITCH;
    m.vx = ((b[p + 3] << 24) >> 24) / VEL; m.vz = ((b[p + 4] << 24) >> 24) / VEL; m.crouch = !!(fl & CROUCH);
    return b[2];
  }

  /* ---------- the bots a client simulates, client to server (Zone) ---------- */
  function encodeBots(list, weaponIndex) {
    const n = Math.min(32, list.length), b = new Uint8Array(2 + n * UP_BOT);
    b[0] = FRAME.UP_BOTS; b[1] = n;
    let o = 2;
    for (let i = 0; i < n; i++, o += UP_BOT) {
      const e = list[i];
      b[o] = Number(String(e[0]).slice(1)) & 255;
      i16(b, o + 1, clamp(q(e[1], POS), -32767, 32767)); i16(b, o + 3, clamp(q(e[2], HGT), -32767, 32767)); i16(b, o + 5, clamp(q(e[3], POS), -32767, 32767));
      i16(b, o + 7, yawOut(e[4])); b[o + 9] = clamp(q(e[5] || 0, PITCH), -127, 127) & 255;
      b[o + 10] = clamp(q(e[6] || 0, VEL), -127, 127) & 255; b[o + 11] = clamp(q(e[7] || 0, VEL), -127, 127) & 255;
      b[o + 12] = weaponIndex(e[8]); b[o + 13] = e[9] ? 1 : 0;
      i16(b, o + 14, clamp(Math.ceil((e[10] || 0) * 10), 0, 65535));
    }
    return b;
  }
  function decodeBots(b, weaponOf) {
    const n = b[1], out = [];
    let o = 2;
    for (let i = 0; i < n && o + UP_BOT <= b.length; i++, o += UP_BOT) {
      const w = weaponOf(b[o + 12]);
      if (!w) continue;
      out.push(['b' + b[o], r16(b, o + 1) / POS, r16(b, o + 3) / HGT, r16(b, o + 5) / POS, yawIn(u16(b, o + 7)), ((b[o + 9] << 24) >> 24) / PITCH, ((b[o + 10] << 24) >> 24) / VEL, ((b[o + 11] << 24) >> 24) / VEL, w, b[o + 13] ? 1 : 0, u16(b, o + 14) / 10]);
    }
    return out;
  }

  const statesTime = b => u32(b, 1);
  const api = { VERSION, FRAME, ACTOR, ACTOR_WIDE, SHOT, UP_STATE_WIDE, statesTime, actorSize, writeActor, writeStatesHead, readStates, writeShot, shotFits, readShots, encodeZombies, decodeZombies, encodeUpState, decodeUpState, encodeBots, decodeBots };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FZNetCodec = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
