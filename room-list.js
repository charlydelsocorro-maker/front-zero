'use strict';
/* FRONT ZÉRO — public rooms, quick play, joining a match in progress, and the hook point of the online bots (net-bots.js).
   Required by server/server.js as ../room-list.js (a deploy copies only server.js from server/, the game root goes with the page).
   Without this file the server keeps private rooms only, exactly as before.
   - Private room (default): code only, never listed. Public room: listed by GET /api/rooms (CORS, cached 1 s, capped, rate-limited per address).
   - GET /api/ping: the page wakes the free host with it when the menu opens.
   - {t:'quick', mode, map, name}: joins the best public room of that mode, or creates a public one with bots that starts by itself.
   - {t:'ro', pub, bots, bz}: the host's room options (lobby only). {t:'bp'} / {t:'bt'}: see net-bots.js.
   - Join in progress: FFA, TDM, Domination and Zombies at once (spawn protection on the first appearance), Bomb at the next round, Zone never from the list. */

const LIST = { cap: 40, cacheMs: 1000, rate: 2, burst: 10 };
const CREATE = { rate: 0.1, burst: 6, publicPerIp: Math.max(1, Number(process.env.FZ_PUBLIC_PER_IP) || 3) };       // the variable is for tests from one address
const LATE = { ffa: true, tdm: true, dom: true, bomb: true, zombie: true, zone: false };
const LATE_GUARD = new Set(['ffa', 'tdm', 'dom']);       // their first appearance in a running match is protected like a respawn (Bomb waits for the round, Zone has none)
const QUICK_START_MS = 3000;

module.exports = function createRoomList(api) {
  const { rooms, MODES, MAX_PLAYERS, LIMITS, ORIGINS, TRUST_PROXY, reject, strike, sendRoom, onCreate, onJoin, startMatch, guardStart, validMap } = api;
  let Bots = null;
  try { Bots = require('./net-bots.js')(api); } catch (e) { Bots = null; console.warn('online bots unavailable:', e.message); }
  LIMITS.bt = [30, 45]; LIMITS.bp = [1, 4];
  const isBot = q => !!q && q.bot === true;
  // bot outfits (bot-outfits-rules.js): each match deals outfits of the server's whitelist to its bots (room view `bf`); without it, the standard uniform
  let BotFits = null;
  try { BotFits = api.FIT_IDS ? require('./bot-outfits-rules.js') : null; } catch (e) { BotFits = null; console.warn('bot outfits unavailable:', e.message); }
  const botFits = room => { if (!BotFits) return null; try { const bf = BotFits.roomFits(room, api.FIT_IDS, isBot); return bf ? { bf } : null; } catch (e) { console.error('bot outfits', e); return null; } };

  /* ---------- per-address buckets (list requests, room creation) ---------- */
  const byIp = new Map();
  function allow(ip, key, rate, cap) {
    const now = Date.now(); let e = byIp.get(ip); if (!e) byIp.set(ip, e = {});
    const b = e[key] || (e[key] = { n: cap, at: now });
    b.n = Math.min(cap, b.n + (now - b.at) / 1000 * rate); b.at = now; e.seen = now;
    if (b.n < 1) return false;
    b.n -= 1; return true;
  }
  setInterval(() => { const now = Date.now(); for (const [ip, e] of byIp) if (now - e.seen > 600000) byIp.delete(ip); }, 60000).unref();

  /* ---------- the list ---------- */
  const humans = room => { let n = 0; for (const q of room.players.values()) if (!isBot(q)) n++; return n; };
  const joinable = room => humans(room) < MAX_PLAYERS && (!room.match || LATE[room.mode] !== false);
  function item(room) {
    const n = humans(room), h = room.players.get(room.hostId), m = room.match;
    const o = { c: room.code, m: room.mode === 'zone' && room.sq > 1 ? 'zone' + room.sq : room.mode, map: room.map, n, b: room.players.size - n, max: MAX_PLAYERS, st: m ? 'playing' : room.flow ? 'flow' : 'lobby',
      bo: room.botsOn ? 1 : 0, bz: Bots ? Bots.sizeOf(room) : 0, j: joinable(room) ? 1 : 0, h: h && !isBot(h) ? h.name : '' };
    if (m && room.mode === 'bomb' && m.round) o.r = m.round;
    return o;
  }
  let cache = { at: 0, body: '' };
  function listBody() {
    const now = Date.now();
    if (now - cache.at < LIST.cacheMs) return cache.body;
    const out = [];
    for (const room of rooms.values()) if (room.pub && room.players.size) out.push(item(room));
    out.sort((a, b) => b.j - a.j || b.n - a.n || (a.st === 'lobby' ? -1 : 0) - (b.st === 'lobby' ? -1 : 0));
    const total = out.length;
    cache = { at: now, body: JSON.stringify({ v: 1, t: now, total, rooms: out.slice(0, LIST.cap) }) };
    return cache.body;
  }

  /* ---------- HTTP: /api/ping and /api/rooms ---------- */
  function corsOrigin(req) {
    const origin = String(req.headers.origin || '');
    if (!ORIGINS || !ORIGINS.size) return '*';
    const o = origin.toLowerCase().replace(/\/$/, '');
    let same = false; try { same = new URL(o).host === String(req.headers.host || '').toLowerCase(); } catch { /* no origin */ }
    return same || ORIGINS.has(o) ? origin : null;
  }
  function http(req, res) {
    const url = String(req.url || '');
    if (!url.startsWith('/api/')) return false;
    const pathname = url.split(/[?#]/)[0];
    if (pathname !== '/api/rooms' && pathname !== '/api/ping') return false;
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin' };
    const allowO = corsOrigin(req); if (allowO) headers['Access-Control-Allow-Origin'] = allowO;
    if (req.method === 'OPTIONS') { res.writeHead(204, { ...headers, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' }); res.end(); return true; }
    const end = (code, body, extra) => { res.writeHead(code, { ...headers, ...(extra || null) }); res.end(req.method === 'HEAD' ? undefined : body); };
    if (req.method !== 'GET' && req.method !== 'HEAD') { end(405, '{"err":"method"}', { Allow: 'GET, HEAD, OPTIONS' }); return true; }
    const fwd = TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
    const ip = fwd || (req.socket && req.socket.remoteAddress) || '?';
    if (!allow(ip, 'list', LIST.rate, LIST.burst)) { end(429, '{"err":"rate_limited"}', { 'Retry-After': '3' }); return true; }
    if (pathname === '/api/ping') { let n = 0; for (const r of rooms.values()) if (r.pub) n++; end(200, JSON.stringify({ ok: 1, v: 1, t: Date.now(), pub: n })); return true; }
    end(200, listBody()); return true;
  }

  /* ---------- hooks called by server.js ---------- */
  /** onCreate, before the room exists: per-address creation rate and a cap on public rooms per address. */
  function mayCreate(p, m) {
    if (!allow(p.ip, 'create', CREATE.rate, CREATE.burst)) { reject(p, 'rate_limited'); return false; }
    if (m.pub === 1) { let n = 0; for (const r of rooms.values()) if (r.pub && r.pubIp === p.ip) n++; if (n >= CREATE.publicPerIp) { reject(p, 'too_many_rooms'); return false; } }
    return true;
  }
  /** onCreate, before the creator enters: visibility, bots (on by default in a public room), quick-play start. */
  function setup(room, p, m) {
    p.bc = m.bc === 1;
    room.pub = m.pub === 1; room.pubIp = p.ip;
    room.botsOn = !!Bots && (m.bots === 1 || (room.pub && m.bots !== 0));
    if (Number.isInteger(m.bz) && m.bz >= 2 && m.bz <= MAX_PLAYERS) room.botSize = m.bz;
    if (m.quick === 1) room.autoAt = Date.now() + QUICK_START_MS;
  }
  /** onCreate, once the creator is in its room: the bots fill it. */
  function created(room) {
    if (Bots && Bots.fit(room)) sendRoom(room);
    cache.at = 0;
  }
  /** onJoin, before the capacity check. A full room with bots frees a seat; Zone in progress is not joined from the public list. */
  function beforeJoin(room, p, m) {
    p.bc = m.bc === 1;
    if (m.ls === 1 && room.match && LATE[room.mode] === false) { reject(p, 'in_progress'); return false; }
    if (room.players.size >= MAX_PLAYERS && Bots && humans(room) < MAX_PLAYERS) Bots.makeRoom(room);
    return true;
  }
  /** onJoin, once in: one bot leaves for the newcomer, and a newcomer in a running match is protected when it first appears. */
  function afterJoin(room, p) {
    if (room.match && LATE_GUARD.has(room.mode)) p.lateSg = true;
    if (Bots && Bots.fit(room)) sendRoom(room);
    cache.at = 0;
  }
  /** leaveRoom, right after the player is removed (before the host migration): no human left = no bot left; otherwise a bot takes the seat. */
  function onLeave(room, p) {
    if (Bots) { if (!Bots.humansIn(room)) Bots.removeAll(room); else Bots.fit(room); }
    cache.at = 0;
  }
  /** onConfig (host changed mode or map), before its sendRoom. */
  function onConfig(room) { if (Bots) Bots.fit(room); cache.at = 0; }
  /** What the room messages carry for this feature (older clients ignore it). */
  function view(room) {
    return { pub: room.pub ? 1 : 0, bo: room.botsOn ? 1 : 0, bz: Bots ? Bots.sizeOf(room) : 0, bs: Bots ? Bots.simOf(room) : null, bm: Bots ? Object.keys(Bots.SIZE) : [], ...botFits(room) };
  }

  /* ---------- messages ---------- */
  /** Host options in the lobby: {pub: bool, bots: bool, bz: 2..12}. */
  function onOpts(p, m) {
    const room = p.room;
    if (!room) return reject(p, 'not_in_room');
    if (room.hostId !== p.id) return reject(p, 'not_host');
    if (room.match) return reject(p, 'not_in_lobby');
    if (m.pub !== undefined && typeof m.pub !== 'boolean') return strike(p, 'bad_opts');
    if (m.bots !== undefined && typeof m.bots !== 'boolean') return strike(p, 'bad_opts');
    if (m.bz !== undefined && !(Number.isInteger(m.bz) && m.bz >= 2 && m.bz <= MAX_PLAYERS)) return strike(p, 'bad_opts');
    if (m.pub === true && !room.pub) { let n = 0; for (const r of rooms.values()) if (r.pub && r.pubIp === p.ip) n++; if (n >= CREATE.publicPerIp) return reject(p, 'too_many_rooms'); room.pubIp = p.ip; }
    if (m.pub !== undefined) room.pub = m.pub;
    if (m.bots !== undefined) room.botsOn = !!Bots && m.bots;
    if (m.bz !== undefined) room.botSize = m.bz;
    if (Bots) Bots.fit(room);
    cache.at = 0;
    sendRoom(room);
  }
  /** Quick play: the best public room of that mode (most humans, a seat a bot can give up), else a new public room with bots. */
  function onQuick(p, m) {
    if (p.room) return reject(p, 'already_in_room');
    const sqm = typeof m.mode === 'string' ? /^zone([234])$/.exec(m.mode) : null, sq = sqm ? +sqm[1] : 0;       // Zone Duo / Trio / Quatuor ('zone2'..'zone4', data.js): a 'zone' room with room.sq
    if (sqm && m.sqv !== 1) return reject(p, 'client_outdated');
    const mode = sqm ? 'zone' : typeof m.mode === 'string' && MODES.has(m.mode) ? m.mode : 'tdm';
    let pick = null, ps = -Infinity;
    for (const room of rooms.values()) {
      if (!room.pub || room.mode !== mode || (room.sq > 1 ? room.sq : 0) !== sq || !room.players.size || !joinable(room)) continue;
      if (room.mode === 'zone' && !m.zv) continue;
      const n = humans(room), s = n * 10 + (room.match ? 0 : 4) + (room.players.size - n > 0 ? 2 : 0) - (room.flow ? 1 : 0);
      if (s > ps) { ps = s; pick = room; }
    }
    const caps = { zv: m.zv === 1 ? 1 : 0, mf: m.mf === 1 ? 1 : 0, bc: m.bc === 1 ? 1 : 0, sqv: m.sqv === 1 ? 1 : 0 };
    if (pick) {
      onJoin(p, { t: 'join', code: pick.code, name: m.name, ls: 1, ...caps });
      if (p.room === pick && !pick.match) { p.ready = true; sendRoom(pick); }      // came to play: ready at once
      return;
    }
    onCreate(p, { t: 'create', mode: sqm ? m.mode : mode, map: validMap(m.map) ? m.map : 'depot', name: m.name, pub: 1, bots: 1, quick: 1, ...caps });
  }

  /* ---------- 4 Hz: late joiners' protection, quick-play start, simulator health ---------- */
  let simCheck = 0;
  setInterval(() => {
    const now = Date.now(), checkSim = now - simCheck >= 2000;
    if (checkSim) simCheck = now;
    for (const room of rooms.values()) {
      try {
        if (room.match) {
          for (const q of room.players.values()) if (q.lateSg && q.hasPos) { q.lateSg = false; if (q.status === 'alive') guardStart(room, q); }
          if (checkSim && Bots) Bots.check(room, now);
        } else if (room.autoAt && now >= room.autoAt) {
          room.autoAt = 0;
          const host = room.players.get(room.hostId);
          if (room.state === 'lobby' && !room.flow && host && (room.players.size >= 2 || room.mode === 'zombie' || room.mode === 'zone') && !(room.mode === 'zone' && [...room.players.values()].some(q => !isBot(q) && !q.zv))) startMatch(room);
        }
      } catch (e) { console.error('room-list tick', room.code, e); }
    }
  }, 250).unref();

  return {
    http, view, mayCreate, setup, created, beforeJoin, afterJoin, onLeave, onConfig,
    damaged(room, target, msg) { if (Bots && isBot(target)) Bots.damaged(room, target, msg); },
    /** Doors: the bot simulator may open them for its bots, like the Zone simulator (no distance check from the sender). */
    isBotSim(room, p) { return !!Bots && !!room && room.botSim === p.id && Bots.count(room) > 0; },
    handlers: {
      quick: ['join', onQuick], ro: ['lobby', onOpts],
      bt: ['bt', (p, m) => { if (Bots) Bots.onTick(p, m); }], bp: ['bp', (p, m) => { if (Bots) Bots.onPerf(p, m); }],
    },
    caps: { pub: 1, bt: Bots ? 1 : 0 },
    isBot,
  };
};
