'use strict';
/* FRONT ZERO: static host + authoritative room referee. Run: node server.js */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = fs.realpathSync.native(path.resolve(__dirname, '..'));
const SERVER_DIR = fs.realpathSync.native(__dirname);
// Internet hosting only (unset on a LAN). FZ_ORIGINS: comma-separated page origins allowed to open the game socket.
// FZ_TRUST_PROXY=1: behind a host's proxy, read the player's address from X-Forwarded-For for the per-address limit.
const ORIGINS = new Set((process.env.FZ_ORIGINS || '').split(',').map(s => s.trim().toLowerCase().replace(/\/$/, '')).filter(Boolean));
const TRUST_PROXY = process.env.FZ_TRUST_PROXY === '1';
// Test-only multiplier for game timers (0.02 to 1). Fire-rate limits are never scaled.
const SCALE = Math.min(1, Math.max(0.02, Number(process.env.FZ_TIME_SCALE) || 1));
const T = ms => Math.max(1, ms * SCALE);

const MAX_PLAYERS = 12, MAX_ROOMS = 200, MAX_PER_IP = 32, MAX_PAYLOAD = 8192;
const TICK_MS = 50, HEARTBEAT_MS = 15000, UNJOINED_TTL = 120000;
const SOFT_BUFFER = 512 * 1024, HARD_BUFFER = 4 * 1024 * 1024;

// Must stay in sync with ALL_WEAPONS in data.js and CLASSES in data.js. At start-up the table is refreshed from data.js when this
// Node version can import it (see syncWeapons below); the literal values are the fallback.
// kind: hitscan (default) | melee | projectile | thrown. proj: blast radius (0 = direct hit only), speed, fuse, self-damage factor.
const WEAPONS = {
  p9:    { dmg: 26,  rpm: 380,  pellets: 1,  range: 32,  hs: 1.7, mag: 14,  reload: 1.1 },
  hp:    { dmg: 48,  rpm: 220,  pellets: 1,  range: 38,  hs: 1.8, mag: 7,   reload: 1.5 },
  rev:   { dmg: 62,  rpm: 150,  pellets: 1,  range: 42,  hs: 1.9, mag: 6,   reload: 2.2 },
  mp:    { dmg: 16,  rpm: 950,  pellets: 1,  range: 18,  hs: 1.4, mag: 20,  reload: 1.3 },
  knife: { dmg: 75,  rpm: 110,  pellets: 1,  range: 2.1, hs: 1,   mag: 1,   reload: 0, kind: 'melee' },
  ar:    { dmg: 24,  rpm: 640,  pellets: 1,  range: 48,  hs: 1.6, mag: 30,  reload: 1.7 },
  car:   { dmg: 22,  rpm: 780,  pellets: 1,  range: 44,  hs: 1.6, mag: 30,  reload: 1.5 },
  akr:   { dmg: 31,  rpm: 560,  pellets: 1,  range: 46,  hs: 1.6, mag: 30,  reload: 1.9 },
  brst:  { dmg: 28,  rpm: 900,  pellets: 1,  range: 55,  hs: 1.7, mag: 30,  reload: 1.8, burst: 3, burstGap: 0.24 },
  bat:   { dmg: 44,  rpm: 420,  pellets: 1,  range: 70,  hs: 1.7, mag: 20,  reload: 2.1 },
  smg:   { dmg: 17,  rpm: 900,  pellets: 1,  range: 24,  hs: 1.4, mag: 36,  reload: 1.4 },
  pdw:   { dmg: 15,  rpm: 1080, pellets: 1,  range: 20,  hs: 1.4, mag: 40,  reload: 1.5 },
  hsmg:  { dmg: 24,  rpm: 620,  pellets: 1,  range: 28,  hs: 1.5, mag: 25,  reload: 1.6 },
  sg:    { dmg: 14,  rpm: 95,   pellets: 9,  range: 15,  hs: 1.3, mag: 6,   reload: 2.2 },
  asg:   { dmg: 11,  rpm: 300,  pellets: 8,  range: 13,  hs: 1.3, mag: 8,   reload: 2.6 },
  dbs:   { dmg: 17,  rpm: 220,  pellets: 10, range: 11,  hs: 1.3, mag: 2,   reload: 1.9 },
  lmg:   { dmg: 27,  rpm: 620,  pellets: 1,  range: 52,  hs: 1.5, mag: 75,  reload: 3.2 },
  mini:  { dmg: 16,  rpm: 1500, pellets: 1,  range: 40,  hs: 1.3, mag: 200, reload: 4.6, spin: 0.6 },
  dmr:   { dmg: 58,  rpm: 260,  pellets: 1,  range: 95,  hs: 1.9, mag: 12,  reload: 2 },
  sr:    { dmg: 200, rpm: 48,   pellets: 1,  range: 120, hs: 2,   mag: 5,   reload: 2.6 },
  hsr:   { dmg: 320, rpm: 30,   pellets: 1,  range: 160, hs: 2,   mag: 4,   reload: 3.4 },
  rl:    { dmg: 140, rpm: 40,   pellets: 1,  range: 200, hs: 1,   mag: 1,   reload: 2.8, reserve: 4,  kind: 'projectile', proj: { radius: 5.5, speed: 46, fuse: 6,   self: 0.6 } },
  gl:    { dmg: 95,  rpm: 110,  pellets: 1,  range: 120, hs: 1,   mag: 6,   reload: 3.2, reserve: 12, kind: 'projectile', proj: { radius: 4.2, speed: 30, fuse: 2.2, self: 0.6 } },
  xbow:  { dmg: 95,  rpm: 38,   pellets: 1,  range: 140, hs: 2,   mag: 1,   reload: 1.6, kind: 'projectile', proj: { radius: 0, speed: 90, fuse: 8, self: 0 } },
  frag:  { dmg: 120, rpm: 45,   pellets: 1,  range: 40,  hs: 1,   mag: 1,   reload: 0.9, reserve: 1,  kind: 'thrown', proj: { radius: 5, speed: 19, fuse: 2.6, self: 1 } },
};
// Derived referee limits per weapon:
//  rate/cap  token bucket for shots: +15 % over the legal sustained rate. Burst weapons get one burst of credit, the minigun a
//            jitter allowance, single-shot weapons (rocket, bolt, grenade) one round per reload.
//  ttl       how long a shot can still produce a hit (ms): 1.5 s for bullets, the flight time for bolts
//  maxMul    cap on one hit, as a multiple of dmg: the headshot factor, or 2 for a knife in the back
//  life      rounds per life (mag + reserve) for weapons with limited spare ammunition
function prepWeapon(w) {
  const rps = w.rpm / 60, kind = w.kind || 'hitscan', pr = w.proj || null;
  w.kind = kind; w.blast = !!(pr && pr.radius > 0);
  if (w.burst > 1) { w.rate = w.burst / ((w.burst - 1) / rps + (w.burstGap || 0)) * 1.15; w.cap = w.burst + 1; }
  else if (w.mag === 1 && kind !== 'melee') { w.rate = 1.15 / Math.max(w.reload || 0, kind === 'thrown' ? 1 / rps : 0, 0.3); w.cap = 1.2; }
  else { w.rate = rps * 1.15; w.cap = Math.max(2, Math.ceil(rps * 0.2)); }
  w.ttl = pr ? Math.min(12000, (pr.fuse || 2) * 1000 + 600) : kind === 'melee' ? 700 : CREDIT_TTL;
  w.maxMul = kind === 'melee' ? 2 : w.hs;
  w.life = w.reserve === undefined ? Infinity : w.mag + w.reserve;
  return w;
}
const CLASSES = {
  assaut:    { hp: 100, armor: 60 },
  eclaireur: { hp: 90,  armor: 15 },
  lourd:     { hp: 130, armor: 70 },
  medic:     { hp: 100, armor: 30, regen: 2.5 },
};
const MODES = new Set(['ffa', 'tdm', 'dom', 'bomb', 'zombie']);
const TEAM_MODES = new Set(['tdm', 'dom', 'bomb']);
const MODE_RULES = {
  ffa: { limit: 30, time: 480000 }, tdm: { limit: 75, time: 600000 }, dom: { limit: 200, time: 600000 },
};
const BOMB = { freeze: 5000, round: 100000, fuse: 40000, plant: 3000, defuse: 5000, gap: 5000, win: 5, half: 4, defuseR: 3.5 };
const ZOMBIE = { waves: 10, gap: 12000, first: 5000, bleed: 30000, revive: 3000, reviveR: 3, maxHit: 50 };
const DOM = { capture: 8000, radius: 6 };
const RESPAWN_MS = 3000, MAX_SPEED = 25, MAX_RAY = 185, CREDIT_TTL = 1500, ASSIST_MS = 10000;
// Explosions: a splash hit must name a victim within the blast radius (+ SPLASH_SLACK m for lag) of a detonation the shooter reported
// less than BOOM_TTL ms ago, and one detonation can hurt at most SPLASH_CAP victims, each once.
const SPLASH_SLACK = 2.5, SPLASH_CAP = 12, BOOM_TTL = 1500, MELEE_SLACK = 3;
for (const id of Object.keys(WEAPONS)) prepWeapon(WEAPONS[id]);
// Balance lives in data.js (an ES module): refresh the table from it when this Node can import it; otherwise the literals above stand.
(function syncWeapons() {
  let url; try { url = require('url').pathToFileURL(path.join(__dirname, '..', 'data.js')).href; } catch { return; }
  import(url).then(mod => {
    const list = mod && Array.isArray(mod.ALL_WEAPONS) ? mod.ALL_WEAPONS : null; if (!list) return;
    let n = 0;
    for (const d of list) {
      if (!d || typeof d.id !== 'string' || !/^[a-z0-9]{1,8}$/.test(d.id) || !(d.dmg > 0) || !(d.rpm > 0) || !(d.range > 0) || !(d.mag > 0)) continue;
      const w = { dmg: d.dmg, rpm: d.rpm, pellets: Math.max(1, d.pellets | 0), range: d.range, hs: d.hs > 0 ? d.hs : 1, mag: d.mag, reload: d.reload > 0 ? d.reload : 0 };
      if (d.burst > 1) { w.burst = d.burst | 0; w.burstGap = d.burstGap > 0 ? d.burstGap : 0; }
      if (d.reserve !== undefined && d.reserve >= 0) w.reserve = d.reserve | 0;
      if (d.kind === 'melee' || d.kind === 'projectile' || d.kind === 'thrown') w.kind = d.kind;
      if (d.proj && d.proj.speed > 0) w.proj = { radius: d.proj.radius > 0 ? d.proj.radius : 0, speed: d.proj.speed, fuse: d.proj.fuse > 0 ? d.proj.fuse : 3, self: d.proj.self >= 0 ? d.proj.self : 1 };
      if ((w.kind === 'projectile' || w.kind === 'thrown') && !w.proj) continue;
      WEAPONS[d.id] = prepWeapon(w); n++;
    }
    console.log(`weapon table: ${n} weapons read from data.js`);
  }).catch(() => { console.log('weapon table: data.js not importable here, using the built-in values'); });
})();
const RELAY_ACTIONS = new Set(['reload', 'emote', 'chat', 'jump', 'marker']);
const LIMITS = {
  state: [30, 40], shot: [40, 40], hit: [120, 120], action: [40, 60], boom: [8, 12],
  lobby: [8, 16], join: [2, 5], ping: [2, 5], all: [200, 300], err: [10, 20], loot: [20, 30],
};

/* ---------- static files ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ktx2': 'image/ktx2', '.hdr': 'application/octet-stream',
};
const isInside = (dir, p) => p === dir || p.startsWith(dir + path.sep);
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const insideFold = (dir, p) => process.platform === 'win32' ? isInside(dir.toLowerCase(), p.toLowerCase()) : isInside(dir, p);

function resolveStatic(rawUrl) {
  let pathname;
  try { pathname = decodeURIComponent(String(rawUrl).split(/[?#]/)[0]); } catch { return null; }
  if (!pathname.startsWith('/') || /[\0\\:*?"<>|]/.test(pathname)) return null;
  if (pathname.endsWith('/')) pathname += 'index.html';
  const segs = pathname.split('/').filter(Boolean);
  for (const s of segs) {
    // Leading dot covers dotfiles and traversal; trailing dot/space and ~ cover Windows aliases.
    if (s.startsWith('.') || /[. ]$/.test(s) || s.includes('~')) return null;
  }
  if (!segs.length || ['server', 'node_modules'].includes(segs[0].toLowerCase())) return null;
  const type = MIME[path.extname(segs[segs.length - 1]).toLowerCase()];
  if (!type) return null;
  const full = path.resolve(ROOT, ...segs);
  if (!insideFold(ROOT, full)) return null;
  let real;
  try { real = fs.realpathSync.native(full); } catch { return null; }
  if (!insideFold(ROOT, real) || insideFold(SERVER_DIR, real) || samePath(real, SERVER_DIR)) return null;
  // Re-check the resolved path so a symlink cannot reach a dot directory.
  if (path.relative(ROOT, real).split(path.sep).some(s => s.startsWith('.'))) return null;
  return { file: real, type };
}

const server = http.createServer((req, res) => {
  const headers = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  const fail = (code, text) => { res.writeHead(code, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' }); res.end(req.method === 'HEAD' ? undefined : text); };
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); return fail(405, 'Method not allowed'); }
  const hit = resolveStatic(req.url);
  if (!hit) return fail(404, 'Not found');
  fs.stat(hit.file, (err, st) => {
    if (err || !st.isFile()) return fail(404, 'Not found');
    res.writeHead(200, { ...headers, 'Content-Type': hit.type, 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(hit.file);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
});

/* ---------- helpers ---------- */
const rooms = new Map();
const ipCount = new Map();
let nextId = 1;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r2 = v => Math.round(v * 100) / 100;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const other = t => (t === 'A' ? 'B' : 'A');
const validMap = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(v);

function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  return v.slice(0, max * 4).normalize('NFKC').replace(/[\p{C}<>&"'`\\/]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}
const cleanName = v => cleanText(v, 16) || 'Soldat';

function makeCode() {
  for (let tries = 0; tries < 50; tries++) {
    let c = '';
    for (let i = 0; i < 6; i++) c += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}

function take(p, key) {
  const [rate, cap] = LIMITS[key], now = Date.now();
  const b = p.limits[key] || (p.limits[key] = { n: cap, at: now });
  b.n = Math.min(cap, b.n + (now - b.at) / 1000 * rate); b.at = now;
  if (b.n < 1) return false;
  b.n -= 1; return true;
}

function raw(p, text, volatile) {
  const ws = p.ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > HARD_BUFFER) { ws.terminate(); return; }
  if (volatile && ws.bufferedAmount > SOFT_BUFFER) return;
  ws.send(text, err => { if (err) { /* socket closing: close handler cleans up */ } });
}
const send = (p, o) => raw(p, JSON.stringify(o));
function all(room, o, except) {
  const s = JSON.stringify(o);
  for (const q of room.players.values()) if (q !== except) raw(q, s);
}
const notify = (room, type, data, except) => all(room, { t: 'action', type, data, from: null }, except);

function reject(p, code) {
  if (take(p, 'err')) send(p, { t: 'error', code });
}
function strike(p, code) {
  const now = Date.now();
  if (now - p.strikeAt > 10000) { p.strikes = 0; p.strikeAt = now; }
  p.strikes++;
  if (code) reject(p, code);
  if (p.strikes > 100) p.ws.close(1008, 'abuse');
}

/* ---------- room views ---------- */
const publicPlayer = q => ({ id: q.id, name: q.name, ready: q.ready, team: q.team, status: q.status, cls: q.cls });
function roomView(room) {
  return {
    code: room.code, hostId: room.hostId, mode: room.mode, map: room.map, state: room.state, maxPlayers: MAX_PLAYERS,
    players: [...room.players.values()].map(publicPlayer), domPoints: room.domPoints, sites: room.sites,
  };
}
function sendRoom(room) {
  const view = roomView(room);
  for (const q of room.players.values()) send(q, { t: 'room', ...view, you: q.id });
}
function timeLeft(m) {
  if (m.mode === 'bomb' || m.mode === 'zombie') return Math.max(0, Math.round(m.phaseEnds - Date.now()));
  return Math.max(0, Math.round(m.endsAt - Date.now()));
}
function scoreView(room) {
  const m = room.match;
  return {
    mode: room.mode, teams: m ? { ...m.teamScore } : { A: 0, B: 0 }, timeLeft: m ? timeLeft(m) : 0,
    players: [...room.players.values()].map(q => ({ id: q.id, team: q.team, kills: q.kills, deaths: q.deaths, assists: q.assists, score: q.score, status: q.status })),
    points: m && m.points ? m.points.map(c => ({ x: c.x, y: c.y, z: c.z, r: c.r, owner: c.owner, progress: r2(c.progress) })) : undefined,
    wave: m && m.mode === 'zombie' ? m.wave : undefined, remaining: m && m.mode === 'zombie' ? m.remaining : undefined,
  };
}
const sendScore = room => all(room, { t: 'score', ...scoreView(room) });
function roundView(room, extra) {
  const m = room.match;
  const v = { mode: m.mode, phase: m.phase, timeLeft: timeLeft(m) };
  if (m.mode === 'bomb') {
    Object.assign(v, { round: m.round, attackers: m.attackers, defenders: other(m.attackers), wins: { ...m.teamScore }, bomb: m.bomb ? { site: m.bomb.site, x: m.bomb.x, y: m.bomb.y, z: m.bomb.z } : null });
  } else if (m.mode === 'zombie') {
    Object.assign(v, { wave: m.wave, totalWaves: ZOMBIE.waves, remaining: m.remaining });
  }
  return { ...v, ...extra };
}
const sendRound = (room, extra) => all(room, { t: 'round', ...roundView(room, extra) });

/* ---------- teams ---------- */
function teamCount(room, t) { let n = 0; for (const q of room.players.values()) if (q.team === t) n++; return n; }
const smaller = room => (teamCount(room, 'A') <= teamCount(room, 'B') ? 'A' : 'B');
function normalizeTeams(room) {
  for (const q of room.players.values()) {
    if (room.mode === 'ffa') q.team = null;
    else if (room.mode === 'zombie') q.team = 'A';
    else if (q.team !== 'A' && q.team !== 'B') q.team = null;
  }
}
function balance(room) {
  normalizeTeams(room);
  if (!TEAM_MODES.has(room.mode)) return;
  for (const q of room.players.values()) if (!q.team) q.team = smaller(room);
  for (;;) {
    const a = teamCount(room, 'A'), b = teamCount(room, 'B');
    if (Math.abs(a - b) <= 1) return;
    const big = a > b ? 'A' : 'B';
    const list = [...room.players.values()].filter(q => q.team === big);
    const mover = list.reverse().find(q => q.id !== room.hostId) || list[0];
    mover.team = other(big);
  }
}

/* ---------- player life ---------- */
function resetLife(p) {
  const c = CLASSES[p.cls];
  p.hp = c.hp; p.maxHp = c.hp; p.armor = c.armor; p.status = 'alive'; p.snap = true;
  p.respawnAt = 0; p.bleedAt = 0; p.regenAt = 0; p.damageBy.clear(); p.credits.length = 0; p.revive = null;
  p.used = {};      // rounds fired this life with limited-reserve weapons (live projectiles and detonations outlive their owner on purpose)
  p.inv = null; p.life = (p.life | 0) + 1;      // what this life carries (reported by loot-aware clients, then kept by the server); null = older client
}
function respawn(room, p, extra) {
  resetLife(p);
  all(room, { t: 'respawn', id: p.id, hp: p.hp, armor: p.armor, team: p.team, life: p.life, ...extra });
}
function applyDamage(room, target, amount, attacker, weapon, head) {
  const absorbed = Math.min(target.armor, amount * 0.6);
  target.armor = r2(target.armor - absorbed);
  target.hp = r2(Math.max(0, target.hp - (amount - absorbed)));
  target.regenAt = Date.now() + (CLASSES[target.cls].regen || 5) * 1000;
  const msg = { t: 'damage', target: target.id, from: attacker ? attacker.id : null, amount: r2(amount), hp: target.hp, armor: target.armor, head: !!head, weapon: weapon || null };
  send(target, msg);
  if (attacker && attacker !== target) send(attacker, msg);
  return target.hp <= 0;
}
function killPlayer(room, victim, killer, weapon, head) {
  const m = room.match, now = Date.now();
  victim.status = 'dead'; victim.hp = 0; victim.deaths++; victim.plantCancel = true;
  const assists = [];
  for (const [id, at] of victim.damageBy) {
    if (id !== killer.id && now - at < ASSIST_MS) {
      const q = room.players.get(id);
      if (q) { q.assists++; q.score += 50; assists.push(id); }
    }
  }
  victim.damageBy.clear();
  const self = killer === victim;       // own explosive: a death, no kill, no point
  if (!self) { killer.kills++; killer.score += head ? 125 : 100; }
  all(room, { t: 'death', id: victim.id, by: self ? null : killer.id, weapon, head: !!head, assists });
  dropLoot(room, victim);
  if (m.mode === 'bomb') { clearActs(m, victim); sendScore(room); checkBombElimination(room); return; }
  victim.respawnAt = now + T(RESPAWN_MS);
  if (m.mode === 'tdm' && !self) m.teamScore[killer.team]++;
  sendScore(room);
  if (self) return;
  if (m.mode === 'ffa' && killer.kills >= MODE_RULES.ffa.limit) endMatch(room, killer.id, 'score');
  else if (m.mode === 'tdm' && m.teamScore[killer.team] >= MODE_RULES.tdm.limit) endMatch(room, killer.team, 'score');
}

/* ---------- loot: what a dead soldier leaves on the ground ----------
   The server owns every drop (id, contents, lifetime) and every pickup, so an item cannot be duplicated. Clients that know about loot
   report what they carry ('inv'); from then on the server counts their shots against it. Older clients never report: no drop, old rules. */
const LOOT = { ttl: 30000, cap: 24, takeR: 4.5, takeY: 3.2 };
const SIDEARMS = new Set(['p9', 'hp', 'rev', 'mp', 'knife']);
const slotOf = id => (WEAPONS[id].kind === 'thrown' ? 2 : SIDEARMS.has(id) ? 1 : 0);
const lootView = (d, now) => ({ id: d.id, k: d.k, w: d.w, a: d.a, r: d.r, x: d.x, y: d.y, z: d.z, ttl: Math.max(0, d.exp - now) });
const lootLeft = e => e.a + Math.max(e.r, 0);
function carried(p, id) {
  if (!p.inv) return null;
  if (p.inv.g && p.inv.g.id === id) return p.inv.g;
  return p.inv.w.find(e => e.id === id) || null;
}
function addDrops(room, list, x, y, z) {
  const m = room.match;
  if (!m || !m.drops || !list.length) return;
  const now = Date.now(), items = [], gone = [];
  for (const o of list) {
    const d = { id: ++m.lootId, k: o.k, w: o.w, a: o.a, r: o.r, x: r2(x), y: r2(y), z: r2(z), exp: now + T(LOOT.ttl) };
    m.drops.set(d.id, d); items.push(lootView(d, now));
  }
  while (m.drops.size > LOOT.cap) { const id = m.drops.keys().next().value; m.drops.delete(id); gone.push(id); }      // oldest first
  if (gone.length) all(room, { t: 'loot', op: 'del', ids: gone });
  all(room, { t: 'loot', op: 'add', items: items.filter(i => m.drops.has(i.id)) });
}
function dropLoot(room, v) {
  const inv = v.inv;
  v.inv = null;
  if (!inv || !v.hasPos || !room.match || room.mode === 'zombie') return;
  const list = [];
  for (const e of inv.w) if (WEAPONS[e.id].life === Infinity || lootLeft(e) > 0) list.push({ k: 'w', w: e.id, a: e.a, r: e.r });
  if (inv.g && inv.g.a > 0) list.push({ k: 'g', w: inv.g.id, a: inv.g.a, r: 0 });
  addDrops(room, list, v.x, v.y, v.z);
}
function clearLoot(room) {
  const m = room.match;
  if (!m || !m.drops || !m.drops.size) return;
  m.drops.clear();
  all(room, { t: 'loot', op: 'clear' });
}
function tickLoot(room, now) {
  const m = room.match;
  if (!m.drops || !m.drops.size) return;
  let gone = null;
  for (const d of m.drops.values()) {       // same lifetime for all: the map is in expiry order
    if (now < d.exp) break;
    (gone || (gone = [])).push(d.id);
  }
  if (!gone) return;
  for (const id of gone) m.drops.delete(id);
  all(room, { t: 'loot', op: 'del', ids: gone });
}
function onInv(p, m) {
  const room = p.room;
  if (!room || !room.match || room.mode === 'zombie' || p.status !== 'alive' || m.l !== p.life) return;      // a report from a previous life is stale, not abuse
  if (!Array.isArray(m.w) || m.w.length < 1 || m.w.length > 2) return strike(p, 'bad_inv');
  const list = [];
  for (const e of m.w) {
    const w = isObj(e) && typeof e.id === 'string' && Object.hasOwn(WEAPONS, e.id) ? WEAPONS[e.id] : null;
    if (!w || w.kind === 'thrown' || !Number.isInteger(e.a) || !Number.isInteger(e.r) || e.a < 0 || e.a > w.mag) return strike(p, 'bad_inv');
    if (w.reserve === undefined ? e.r !== -1 : e.r < 0 || e.r > w.reserve) return strike(p, 'bad_inv');
    if (list.some(q => slotOf(q.id) === slotOf(e.id))) return strike(p, 'bad_inv');
    list.push({ id: e.id, a: e.a, r: e.r });
  }
  let g = null;
  if (m.g !== undefined && m.g !== null) {
    const w = isObj(m.g) && typeof m.g.id === 'string' && Object.hasOwn(WEAPONS, m.g.id) ? WEAPONS[m.g.id] : null;
    if (!w || w.kind !== 'thrown' || !Number.isInteger(m.g.n) || m.g.n < 0 || m.g.n > w.life) return strike(p, 'bad_inv');
    g = { id: m.g.id, a: m.g.n, r: 0 };
  }
  if (!p.inv) { p.inv = { w: list, g }; return; }
  // After the first report of a life the server owns the contents: a report moves rounds between magazine and reserve, it never adds any.
  for (const e of list) {
    const cur = p.inv.w.find(q => q.id === e.id), w = WEAPONS[e.id];
    if (!cur) continue;       // crossed a swap on the wire
    if (w.life === Infinity) { cur.a = e.a; continue; }
    const total = Math.min(lootLeft(e), lootLeft(cur));
    cur.a = Math.min(e.a, total); cur.r = total - cur.a;
  }
  // Grenades are not read back from later reports: the client may count one as gone while the throw animation runs, before its shot arrives.
  // The server's own count (first report, accepted throws, pickups) stays right, and a grenade still in hand at death falls with the body.
}
function onTake(p, m) {
  const room = p.room, g = room && room.match;
  if (!g || !g.drops || room.mode === 'zombie') return;
  if (!Number.isInteger(m.id)) return strike(p, 'bad_take');
  const fail = () => send(p, { t: 'loot', op: 'fail', id: m.id });
  const d = g.drops.get(m.id);
  if (!d || p.status !== 'alive' || !p.inv || !p.hasPos || !canFight(room)) return fail();
  if (Math.hypot(p.x - d.x, p.z - d.z) > LOOT.takeR || Math.abs(p.y - d.y) > LOOT.takeY) return fail();
  const w = WEAPONS[d.w], gone = () => { g.drops.delete(d.id); all(room, { t: 'loot', op: 'del', ids: [d.id] }); };
  const left = () => { if (lootLeft(d) > 0) all(room, { t: 'loot', op: 'upd', id: d.id, a: d.a, r: d.r }); else gone(); };
  if (d.k === 'g') {
    const cur = p.inv.g && p.inv.g.id === d.w ? p.inv.g : null, have = cur ? cur.a : 0, n = Math.min(w.life - have, d.a);
    if (!(n > 0)) return fail();
    if (cur) cur.a += n; else p.inv.g = { id: d.w, a: n, r: 0 };
    d.a -= n; left();
    return send(p, { t: 'loot', op: 'got', id: d.id, k: 'g', w: d.w, n });
  }
  const mine = p.inv.w.find(e => e.id === d.w);
  if (m.swap !== true) {       // walking over: only spare rounds for a limited weapon already carried
    if (!mine || w.life === Infinity) return fail();
    const n = Math.min(w.reserve - mine.r, lootLeft(d));
    if (!(n > 0)) return fail();
    mine.r += n;
    const fromR = Math.min(n, Math.max(d.r, 0)); d.r -= fromR; d.a -= n - fromR; left();
    return send(p, { t: 'loot', op: 'got', id: d.id, k: 'a', w: d.w, n });
  }
  if (mine) return fail();
  const slot = slotOf(d.w), i = p.inv.w.findIndex(e => slotOf(e.id) === slot), out = i >= 0 ? p.inv.w[i] : null, item = { id: d.w, a: d.a, r: d.r };
  if (i >= 0) p.inv.w[i] = item; else p.inv.w.push(item);
  gone();
  if (out && (WEAPONS[out.id].life === Infinity || lootLeft(out) > 0)) addDrops(room, [{ k: 'w', w: out.id, a: out.a, r: out.r }], p.x, p.y, p.z);
  send(p, { t: 'loot', op: 'got', id: d.id, k: 'w', w: d.w, a: d.a, r: d.r });
}

/* ---------- match flow ---------- */
function startMatch(room) {
  balance(room);
  for (const q of room.players.values()) { q.kills = q.deaths = q.assists = q.score = 0; resetLife(q); }
  const now = Date.now();
  const m = room.match = { mode: room.mode, startedAt: now, phase: 'live', phaseEnds: 0, endsAt: 0, teamScore: { A: 0, B: 0 }, lastScoreTick: now, drops: new Map(), lootId: 0 };
  room.state = 'playing';
  if (MODE_RULES[m.mode]) m.endsAt = now + T(MODE_RULES[m.mode].time);
  if (m.mode === 'dom') m.points = room.domPoints ? buildPoints(room.domPoints) : null;
  if (m.mode === 'bomb') { m.round = 0; m.attackers = 'A'; m.bomb = null; m.plantAct = null; m.defuseAct = null; }
  if (m.mode === 'zombie') { m.wave = 0; m.remaining = 0; m.seen = new Set(); m.phase = 'intermission'; m.phaseEnds = now + T(ZOMBIE.first); }
  const view = roomView(room);
  for (const q of room.players.values()) send(q, { t: 'start', ...view, you: q.id, hp: q.hp, armor: q.armor, life: q.life });
  if (m.mode === 'bomb') beginBombRound(room);
  else if (m.mode === 'zombie') sendRound(room);
  sendScore(room);
}
function endMatch(room, winner, reason) {
  if (!room.match) return;
  const final = scoreView(room);
  all(room, { t: 'end', mode: room.mode, winner, reason, ...final });
  room.match = null; room.state = 'lobby';
  for (const q of room.players.values()) { q.ready = false; q.status = 'lobby'; q.respawnAt = 0; q.bleedAt = 0; q.revive = null; }
  sendRoom(room);
}
function timeUpWinner(room) {
  const m = room.match;
  if (m.mode === 'ffa') {
    const sorted = [...room.players.values()].sort((a, b) => b.kills - a.kills);
    return sorted.length > 1 && sorted[0].kills === sorted[1].kills ? null : (sorted[0] ? sorted[0].id : null);
  }
  if (m.teamScore.A === m.teamScore.B) return null;
  return m.teamScore.A > m.teamScore.B ? 'A' : 'B';
}

/* domination */
function buildPoints(list) { return list.map(c => ({ x: c.x, y: c.y, z: c.z, r: c.r, owner: null, progress: 0 })); }
function tickDom(room, dt) {
  const m = room.match;
  if (!m.points) return;
  const rate = dt / T(DOM.capture);
  for (let i = 0; i < m.points.length; i++) {
    const c = m.points[i];
    let a = 0, b = 0;
    for (const q of room.players.values()) {
      if (q.status === 'alive' && q.hasPos && dist2d(q, c) <= c.r) { if (q.team === 'A') a++; else if (q.team === 'B') b++; }
    }
    if (a && b) continue;
    const before = c.owner;
    if (a || b) {
      const dir = a ? 1 : -1;
      c.progress = clamp(c.progress + dir * rate * Math.min(3, a + b), -1, 1);
    } else {
      const home = c.owner === 'A' ? 1 : c.owner === 'B' ? -1 : 0;
      if (c.progress !== home) {
        const step = Math.sign(home - c.progress) * rate;
        c.progress = Math.abs(home - c.progress) <= rate ? home : c.progress + step;
      }
    }
    if (c.progress >= 1) c.owner = 'A';
    else if (c.progress <= -1) c.owner = 'B';
    else if ((c.owner === 'A' && c.progress <= 0) || (c.owner === 'B' && c.progress >= 0)) c.owner = null;
    if (c.owner !== before) { notify(room, 'dom_capture', { index: i, owner: c.owner }); sendScore(room); }
  }
  const now = Date.now();
  if (now - m.lastScoreTick >= T(1000)) {
    m.lastScoreTick = now;
    for (const c of m.points) if (c.owner) m.teamScore[c.owner]++;
    sendScore(room);
    for (const t of ['A', 'B']) if (m.teamScore[t] >= MODE_RULES.dom.limit) return endMatch(room, t, 'score');
  }
}

/* bomb */
function clearActs(m, p) {
  if (m.plantAct && (!p || m.plantAct.by === p.id)) m.plantAct = null;
  if (m.defuseAct && (!p || m.defuseAct.by === p.id)) m.defuseAct = null;
}
function beginBombRound(room) {
  const m = room.match;
  m.round++;
  if (m.round === BOMB.half + 1) { m.attackers = other(m.attackers); notify(room, 'side_swap', { attackers: m.attackers }); }
  m.phase = 'freeze'; m.phaseEnds = Date.now() + T(BOMB.freeze); m.bomb = null; clearActs(m); clearLoot(room);
  for (const q of room.players.values()) if (q.team) respawn(room, q, { round: m.round });
  sendRound(room);
}
function endBombRound(room, winner, reason) {
  const m = room.match;
  if (!m || m.phase === 'intermission') return;
  clearActs(m);
  m.teamScore[winner]++;
  m.phase = 'intermission'; m.phaseEnds = Date.now() + T(BOMB.gap);
  sendRound(room, { winner, reason });
  sendScore(room);
  if (m.teamScore[winner] >= BOMB.win) endMatch(room, winner, 'rounds');
}
function aliveOn(room, t) { let n = 0; for (const q of room.players.values()) if (q.team === t && q.status === 'alive') n++; return n; }
function checkBombElimination(room) {
  const m = room.match;
  if (!m || m.mode !== 'bomb' || m.phase === 'intermission') return;
  const d = other(m.attackers);
  if (aliveOn(room, d) === 0) return endBombRound(room, m.attackers, 'elimination');
  if (!m.bomb && aliveOn(room, m.attackers) === 0) endBombRound(room, d, 'elimination');
}
function tickBomb(room) {
  const m = room.match, now = Date.now();
  if (m.plantAct) {
    const q = room.players.get(m.plantAct.by), site = room.sites && room.sites[m.plantAct.site];
    if (!q || q.status !== 'alive' || !site || dist2d(q, site) > site.r || m.phase !== 'live') {
      m.plantAct = null; notify(room, 'plant_cancel', { by: q ? q.id : null });
    } else if (now >= m.plantAct.ends) {
      m.bomb = { site: m.plantAct.site, x: r2(q.x), y: r2(q.y), z: r2(q.z), by: q.id };
      m.plantAct = null; m.phase = 'planted'; m.phaseEnds = now + T(BOMB.fuse);
      q.score += 150;
      notify(room, 'bomb_planted', { by: q.id, site: m.bomb.site, x: m.bomb.x, y: m.bomb.y, z: m.bomb.z, fuse: T(BOMB.fuse) });
      sendRound(room); sendScore(room);
    }
  }
  if (m.defuseAct) {
    const q = room.players.get(m.defuseAct.by);
    if (!q || q.status !== 'alive' || !m.bomb || dist2d(q, m.bomb) > BOMB.defuseR) {
      m.defuseAct = null; notify(room, 'defuse_cancel', { by: q ? q.id : null });
    } else if (now >= m.defuseAct.ends) {
      q.score += 150; m.defuseAct = null;
      notify(room, 'bomb_defused', { by: q.id });
      return endBombRound(room, other(m.attackers), 'defused');
    }
  }
  if (now < m.phaseEnds) return;
  if (m.phase === 'freeze') { m.phase = 'live'; m.phaseEnds = now + T(BOMB.round); sendRound(room); }
  else if (m.phase === 'live') endBombRound(room, other(m.attackers), 'time');
  else if (m.phase === 'planted') { notify(room, 'bomb_exploded', { site: m.bomb.site }); endBombRound(room, m.attackers, 'detonated'); }
  else if (m.phase === 'intermission') beginBombRound(room);
}

/* zombie */
const waveSize = (w, n) => 6 + 4 * w + 2 * Math.max(0, n - 1);
function beginWave(room) {
  const m = room.match;
  m.wave++; m.remaining = waveSize(m.wave, room.players.size); m.seen = new Set();
  m.phase = 'live'; m.phaseEnds = Date.now() + T(600000);
  for (const q of room.players.values()) if (q.status !== 'alive') respawn(room, q, { wave: m.wave });
  sendRound(room); sendScore(room);
}
function checkWipe(room) {
  const m = room.match;
  if (!m || m.mode !== 'zombie' || m.phase !== 'live') return;
  for (const q of room.players.values()) if (q.status === 'alive') return;
  endMatch(room, null, 'wiped');
}
function waveCleared(room) {
  const m = room.match;
  if (m.wave >= ZOMBIE.waves) return endMatch(room, 'humans', 'survived');
  m.phase = 'intermission'; m.phaseEnds = Date.now() + T(ZOMBIE.gap);
  for (const q of room.players.values()) if (q.status !== 'alive') respawn(room, q, { wave: m.wave });
  sendRound(room, { cleared: m.wave }); sendScore(room);
}
function tickZombie(room) {
  const m = room.match, now = Date.now();
  for (const q of room.players.values()) {
    if (q.status === 'downed' && now >= q.bleedAt) {
      q.status = 'dead'; q.bleedAt = 0;
      all(room, { t: 'death', id: q.id, by: null, final: true });
      checkWipe(room);
      if (!room.match) return;
    }
    if (q.revive) {
      const t = room.players.get(q.revive.target);
      if (q.status !== 'alive' || !t || t.status !== 'downed' || dist2d(q, t) > ZOMBIE.reviveR) {
        notify(room, 'revive_cancel', { by: q.id }); q.revive = null;
      } else if (now >= q.revive.ends) {
        q.revive = null; q.score += 100;
        const keep = { x: t.x, y: t.y, z: t.z };
        resetLife(t); Object.assign(t, keep); t.snap = false;
        t.hp = Math.round(t.maxHp / 2); t.armor = 0; t.regenAt = now + 5000;
        all(room, { t: 'respawn', id: t.id, hp: t.hp, armor: t.armor, team: t.team, revived: true, by: q.id });
        sendScore(room);
      }
    }
  }
  if (m.phase === 'intermission' && now >= m.phaseEnds) beginWave(room);
  else if (m.phase === 'live' && now >= m.phaseEnds) endMatch(room, null, 'time');
}

/* main tick */
let lastTick = Date.now();
function tickRoom(room, now, dt) {
  const m = room.match;
  if (MODE_RULES[m.mode] && now >= m.endsAt) return endMatch(room, timeUpWinner(room), 'time');
  for (const q of room.players.values()) {
    if (q.status === 'dead' && q.respawnAt && now >= q.respawnAt) respawn(room, q);
    if (q.status === 'alive' && q.regenAt && now >= q.regenAt && q.hp < q.maxHp) {
      const c = CLASSES[q.cls];
      q.hp = Math.min(q.maxHp, q.hp + dt / 1000 * (c.regen ? 34 : 17));
      if (now - q.hpSent >= 250 || q.hp >= q.maxHp) { q.hpSent = now; send(q, { t: 'action', type: 'hp', data: { hp: r2(q.hp), armor: q.armor }, from: null }); }
    }
  }
  if (m.mode === 'dom') tickDom(room, dt);
  else if (m.mode === 'bomb') tickBomb(room);
  else if (m.mode === 'zombie') tickZombie(room);
  if (!room.match) return;
  tickLoot(room, now);
  const batch = [];
  for (const q of room.players.values()) {
    if (!q.dirty) continue;
    q.dirty = false;
    batch.push({ id: q.id, x: r2(q.x), y: r2(q.y), z: r2(q.z), yaw: r2(q.yaw), pitch: r2(q.pitch), vx: r2(q.vx), vz: r2(q.vz), weapon: q.weapon, crouch: q.crouch, status: q.status });
  }
  if (batch.length) {
    const s = JSON.stringify({ t: 'states', ts: now, s: batch });
    for (const q of room.players.values()) raw(q, s, true);
  }
}
setInterval(() => {
  const now = Date.now(), dt = Math.min(250, now - lastTick);
  lastTick = now;
  for (const room of rooms.values()) {
    if (!room.match) continue;
    try { tickRoom(room, now, dt); }
    catch (e) { console.error('tick error', room.code, e); endMatch(room, null, 'server_error'); }
  }
}, TICK_MS);

/* ---------- message handlers ---------- */
function needRoom(p) { if (!p.room) { reject(p, 'not_in_room'); return null; } return p.room; }
function needHost(p) {
  const room = needRoom(p);
  if (!room) return null;
  if (room.hostId !== p.id) { reject(p, 'not_host'); return null; }
  return room;
}
function addToRoom(p, room, name) {
  p.name = cleanName(name); p.room = room; p.ready = false; p.team = null; p.status = 'lobby';
  p.kills = p.deaths = p.assists = p.score = 0;
  room.players.set(p.id, p);
  normalizeTeams(room);
  if (room.match) {
    if (TEAM_MODES.has(room.mode)) p.team = smaller(room);
    resetLife(p);
    if (room.mode === 'bomb' || (room.mode === 'zombie' && room.match.phase === 'live')) { p.status = 'dead'; p.hp = 0; }
    sendRoom(room);
    send(p, { t: 'start', ...roomView(room), you: p.id, hp: p.hp, armor: p.armor, late: true, life: p.life });
    if (room.match.drops && room.match.drops.size) { const now = Date.now(); send(p, { t: 'loot', op: 'sync', items: [...room.match.drops.values()].map(d => lootView(d, now)) }); }
    if (room.mode === 'bomb' || room.mode === 'zombie') send(p, { t: 'round', ...roundView(room) });
    sendScore(room);
  } else sendRoom(room);
}
function onCreate(p, m) {
  if (p.room) return reject(p, 'already_in_room');
  if (rooms.size >= MAX_ROOMS) return reject(p, 'server_full');
  const mode = m.mode === undefined ? 'ffa' : m.mode, map = m.map === undefined ? 'default' : m.map;
  if (!MODES.has(mode)) return strike(p, 'bad_mode');
  if (!validMap(map)) return strike(p, 'bad_map');
  const code = makeCode();
  if (!code) return reject(p, 'server_full');
  const room = { code, hostId: p.id, mode, map, state: 'lobby', players: new Map(), match: null, domPoints: null, sites: null };
  rooms.set(code, room);
  addToRoom(p, room, m.name);
}
function onJoin(p, m) {
  if (p.room) return reject(p, 'already_in_room');
  if (typeof m.code !== 'string' || !/^[A-Za-z]{6}$/.test(m.code)) return strike(p, 'bad_code');
  const room = rooms.get(m.code.toUpperCase());
  if (!room) return reject(p, 'room_not_found');
  if (room.players.size >= MAX_PLAYERS) return reject(p, 'room_full');
  addToRoom(p, room, m.name);
}
function onReady(p, m) {
  const room = needRoom(p);
  if (!room) return;
  if (typeof m.v !== 'boolean') return strike(p, 'bad_ready');
  if (room.state !== 'lobby') return reject(p, 'not_in_lobby');
  p.ready = m.v; sendRoom(room);
}
function onTeam(p, m) {
  const room = needRoom(p);
  if (!room) return;
  if (!['A', 'B', 'auto', null].includes(m.team)) return strike(p, 'bad_team');
  if (room.state !== 'lobby') return reject(p, 'not_in_lobby');
  if (!TEAM_MODES.has(room.mode)) return reject(p, 'no_teams_in_mode');
  if (m.team === 'A' || m.team === 'B') p.team = m.team;
  else { p.team = null; p.team = smaller(room); }
  sendRoom(room);
}
function onConfig(p, m) {
  const room = needHost(p);
  if (!room) return;
  if (room.state !== 'lobby') return reject(p, 'not_in_lobby');
  if (m.mode !== undefined && !MODES.has(m.mode)) return strike(p, 'bad_mode');
  if (m.map !== undefined && !validMap(m.map)) return strike(p, 'bad_map');
  if (m.mode !== undefined) room.mode = m.mode;
  if (m.map !== undefined && m.map !== room.map) { room.map = m.map; room.domPoints = null; room.sites = null; }
  for (const q of room.players.values()) if (q.id !== room.hostId) q.ready = false;
  normalizeTeams(room);
  sendRoom(room);
}
function onStart(p) {
  const room = needHost(p);
  if (!room) return;
  if (room.state !== 'lobby') return reject(p, 'already_started');
  if (room.mode !== 'zombie' && room.players.size < 2) return reject(p, 'not_enough_players');
  for (const q of room.players.values()) if (q.id !== room.hostId && !q.ready) return reject(p, 'players_not_ready');
  startMatch(room);
}
function onState(p, m) {
  const room = p.room;
  if (!room || !room.match || p.status !== 'alive') return;
  if (!num(m.x, -5000, 5000) || !num(m.y, -200, 1000) || !num(m.z, -5000, 5000) || !num(m.yaw, -1e4, 1e4) || !num(m.pitch, -2, 2)
    || !num(m.vx, -60, 60) || !num(m.vz, -60, 60) || !WEAPONS[m.weapon] || typeof m.crouch !== 'boolean') return strike(p, 'bad_state');
  const now = Date.now();
  let x = m.x, y = m.y, z = m.z;
  if (p.hasPos && !p.snap) {
    // Clamp teleports to the fastest legal movement instead of trusting the client.
    const dt = Math.min(1, (now - p.stateAt) / 1000), max = MAX_SPEED * dt + 1;
    const dx = x - p.x, dy = y - p.y, dz = z - p.z, d = Math.hypot(dx, dy, dz);
    if (d > max) { const k = max / d; x = p.x + dx * k; y = p.y + dy * k; z = p.z + dz * k; }
  }
  Object.assign(p, { x, y, z, yaw: m.yaw, pitch: m.pitch, vx: m.vx, vz: m.vz, weapon: m.weapon, crouch: m.crouch, hasPos: true, snap: false, stateAt: now, dirty: true });
}
function canFight(room) {
  const m = room.match;
  if (!m) return false;
  if (m.mode === 'bomb') return m.phase === 'live' || m.phase === 'planted';
  return m.phase === 'live';
}
function onShot(p, m) {
  const room = needRoom(p);
  if (!room) return;
  if (!canFight(room)) return reject(p, 'not_live');
  if (p.status !== 'alive') return reject(p, 'dead');
  const w = WEAPONS[m.weapon];
  if (!w) return strike(p, 'bad_weapon');
  for (const k of ['ox', 'oy', 'oz']) if (!num(m[k], -6000, 6000)) return strike(p, 'bad_shot');
  for (const k of ['dx', 'dy', 'dz']) if (!num(m[k], -1.5, 1.5)) return strike(p, 'bad_shot');
  const len = Math.hypot(m.dx, m.dy, m.dz);
  if (len < 0.5 || len > 1.5) return strike(p, 'bad_shot');
  if (p.hasPos && !p.snap && Math.hypot(m.ox - p.x, m.oy - (p.y + 1.5), m.oz - p.z) > 4) return reject(p, 'bad_origin');
  // Optional mirror data for projectiles: id and launch velocity (a thrown grenade carries part of the thrower's speed).
  const pr = w.proj || null; let pid = 0, vel = null;
  if (pr) {
    if (m.pid !== undefined) { if (!num(m.pid, 0, 1e9)) return strike(p, 'bad_shot'); pid = Math.floor(m.pid); }
    if (m.vx !== undefined || m.vy !== undefined || m.vz !== undefined) {
      const lim = pr.speed * 1.5 + 15;
      if (!num(m.vx, -lim, lim) || !num(m.vy, -lim, lim) || !num(m.vz, -lim, lim) || Math.hypot(m.vx, m.vy, m.vz) > lim) return strike(p, 'bad_shot');
      vel = [r2(m.vx), r2(m.vy), r2(m.vz)];
    }
  }
  // Per-weapon bucket (see prepWeapon): bursts and jitter are tolerated, the sustained rate is capped at the legal rate +15 %.
  const now = Date.now();
  const b = p.fire[m.weapon] || (p.fire[m.weapon] = { n: w.cap, at: now });
  b.n = Math.min(w.cap, b.n + (now - b.at) / 1000 * w.rate); b.at = now;
  if (b.n < 1) return reject(p, 'fire_rate');
  if (w.life !== Infinity && room.mode !== 'zombie') {       // limited spare rounds per life (zombie waves resupply, so no cap there)
    const used = p.used[m.weapon] || 0;
    if (p.inv) { const e = carried(p, m.weapon); if (!e || lootLeft(e) <= 0) return reject(p, 'no_ammo'); }      // loot-aware client: the rounds it really carries
    else if (used >= w.life) return reject(p, 'no_ammo');
    p.used[m.weapon] = used + 1;
  }
  b.n -= 1;
  if (p.inv && w.kind !== 'melee') { const e = carried(p, m.weapon); if (e) { if (e.a > 0) e.a--; else if (e.r > 0) e.r--; } }
  if (w.blast) {       // explosive: no direct-hit credit; the detonation ('boom') opens the splash hits
    p.live.push({ weapon: m.weapon, pid, at: now, x: m.ox, y: m.oy, z: m.oz });
    if (p.live.length > 16) p.live.shift();
  } else {
    p.credits.push({ weapon: m.weapon, n: w.pellets, at: now, exp: now + w.ttl });
    if (p.credits.length > 32) p.credits.shift();
  }
  const out = { t: 'shot', id: p.id, ox: r2(m.ox), oy: r2(m.oy), oz: r2(m.oz), dx: +(m.dx / len).toFixed(4), dy: +(m.dy / len).toFixed(4), dz: +(m.dz / len).toFixed(4), weapon: m.weapon };
  if (w.kind !== 'hitscan') { out.k = w.kind === 'melee' ? 'm' : w.kind === 'thrown' ? 't' : 'p'; if (pr) { out.pid = pid; if (vel) { out.vx = vel[0]; out.vy = vel[1]; out.vz = vel[2]; } } }
  all(room, out, p);
}
// A client reports that one of its own explosive projectiles went off. Relayed for the visuals; remembered to validate the splash hits.
function onBoom(p, m) {
  const room = needRoom(p);
  if (!room) return;
  if (!canFight(room)) return reject(p, 'not_live');
  const w = WEAPONS[m.weapon];
  if (!w || !w.blast) return strike(p, 'bad_weapon');
  if (!num(m.x, -6000, 6000) || !num(m.y, -200, 1000) || !num(m.z, -6000, 6000) || (m.pid !== undefined && !num(m.pid, 0, 1e9))) return strike(p, 'bad_boom');
  const now = Date.now(), pid = m.pid === undefined ? 0 : Math.floor(m.pid), pr = w.proj;
  while (p.live.length && now - p.live[0].at > 15000) p.live.shift();
  let i = p.live.findIndex(s => s.weapon === m.weapon && s.pid === pid);
  if (i < 0) i = p.live.findIndex(s => s.weapon === m.weapon);
  if (i < 0) return reject(p, 'no_shot');
  const s = p.live[i], age = (now - s.at) / 1000;
  // It cannot outlive its fuse nor have flown further than its speed allows (+12 m/s inherited from a moving thrower).
  if (age > pr.fuse + 1.5 || Math.hypot(m.x - s.x, m.y - s.y, m.z - s.z) > (pr.speed + 12) * Math.min(pr.fuse, age + 0.5) + 3) { p.live.splice(i, 1); return reject(p, 'bad_boom'); }
  p.live.splice(i, 1);
  p.booms.push({ weapon: m.weapon, x: m.x, y: m.y, z: m.z, at: now, hits: 0, seen: new Set() });
  if (p.booms.length > 6) p.booms.shift();
  all(room, { t: 'boom', id: p.id, x: r2(m.x), y: r2(m.y), z: r2(m.z), weapon: m.weapon, pid }, p);
}
// Splash damage: reported by the shooter per victim, right after the detonation it belongs to.
function onSplash(p, m, room, w) {
  const now = Date.now(), pr = w.proj;
  const zombie = room.mode === 'zombie' && /^z\d{1,9}$/.test(m.target);
  const target = zombie ? null : room.players.get(m.target);
  if (!zombie && !target) return reject(p, 'bad_target');
  const self = target === p;
  if (target) {
    if (target.status !== 'alive') return reject(p, 'target_dead');
    if (self ? !(pr.self > 0) : (room.mode === 'zombie' || (TEAM_MODES.has(room.mode) && target.team === p.team))) return reject(p, 'friendly_fire');
  }
  while (p.booms.length && now - p.booms[0].at > BOOM_TTL) p.booms.shift();
  let boom = null, dist = 0;
  for (let i = p.booms.length - 1; i >= 0 && !boom; i--) {
    const q = p.booms[i];
    if (q.weapon !== m.weapon || q.hits >= SPLASH_CAP || q.seen.has(m.target)) continue;
    if (target && target.hasPos) {       // distance from the blast to the nearest point of the body (feet to head)
      const cy = clamp(q.y, target.y, target.y + 1.8), d = Math.hypot(target.x - q.x, cy - q.y, target.z - q.z);
      if (d > pr.radius + SPLASH_SLACK) continue;
      dist = d;
    }
    boom = q;
  }
  if (!boom) return reject(p, 'no_boom');
  boom.hits++; boom.seen.add(m.target);
  // Same falloff as the client (100 % at the centre, 10 % at the edge), measured SPLASH_SLACK closer to forgive lag.
  const fall = 1 - 0.9 * Math.max(0, dist - SPLASH_SLACK) / pr.radius;
  const amount = Math.min(m.damage, w.dmg * fall * (self ? pr.self : 1));
  if (!(amount > 0)) return;
  if (zombie) {
    const host = room.players.get(room.hostId);
    if (host) send(host, { t: 'action', type: 'z_hit', from: p.id, data: { zombie: m.target, damage: r2(amount), head: false, weapon: m.weapon } });
    return;
  }
  if (!self) target.damageBy.set(p.id, now);
  if (applyDamage(room, target, amount, p, m.weapon, false)) killPlayer(room, target, p, m.weapon, false);
}
function onHit(p, m) {
  const room = needRoom(p);
  if (!room) return;
  if (!canFight(room)) return reject(p, 'not_live');
  const w = WEAPONS[m.weapon];
  if (!w) return strike(p, 'bad_weapon');
  if (typeof m.target !== 'string' || m.target.length > 16 || !num(m.damage, 0.01, 1e6) || typeof m.head !== 'boolean') return strike(p, 'bad_hit');
  if (w.blast) { if (m.splash !== true) return reject(p, 'no_shot'); return onSplash(p, m, room, w); }       // a grenade can go off after its owner died
  if (p.status !== 'alive') return reject(p, 'dead');
  const zombie = room.mode === 'zombie' && /^z\d{1,9}$/.test(m.target);
  const target = zombie ? null : room.players.get(m.target);
  if (!zombie && (!target || target === p)) return reject(p, 'bad_target');
  if (target) {
    if (target.status !== 'alive') return reject(p, 'target_dead');
    if (room.mode === 'zombie' || (TEAM_MODES.has(room.mode) && target.team === p.team)) return reject(p, 'friendly_fire');
  }
  const now = Date.now();
  while (p.credits.length && now > (p.credits[0].exp || p.credits[0].at + CREDIT_TTL)) p.credits.shift();
  const credit = p.credits.find(c => c.weapon === m.weapon && c.n > 0 && now <= (c.exp || c.at + CREDIT_TTL));
  if (!credit) return reject(p, 'no_shot');
  let falloff = 1;
  if (target && p.hasPos && target.hasPos) {
    const d = Math.hypot(p.x - target.x, p.y - target.y, p.z - target.z);
    if (d > MAX_RAY) return reject(p, 'out_of_range');
    if (w.kind === 'melee') { if (d > w.range + MELEE_SLACK) return reject(p, 'out_of_range'); }
    else if (d > w.range * 1.1) falloff = 0.55; // the client applies .55 beyond weapon range
  }
  const perPellet = w.kind === 'melee' ? w.dmg * w.maxMul : w.dmg * falloff * (m.head ? w.hs : 1);      // a knife doubles from behind
  const pellets = Math.min(credit.n, Math.max(1, Math.ceil(m.damage / perPellet - 1e-6)));
  credit.n -= pellets;
  const amount = Math.min(m.damage, perPellet * pellets);
  if (zombie) {
    const host = room.players.get(room.hostId);
    if (host) send(host, { t: 'action', type: 'z_hit', from: p.id, data: { zombie: m.target, damage: r2(amount), head: m.head, weapon: m.weapon } });
    return;
  }
  target.damageBy.set(p.id, now);
  if (applyDamage(room, target, amount, p, m.weapon, m.head)) killPlayer(room, target, p, m.weapon, m.head);
}

function cleanFlat(data) {
  if (data === undefined || data === null) return {};
  if (!isObj(data)) return null;
  const keys = Object.keys(data);
  if (keys.length > 8) return null;
  const out = {};
  for (const k of keys) {
    if (!/^[A-Za-z0-9_]{1,16}$/.test(k)) return null;
    const v = data[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = cleanText(v, 120);
    else return null;
  }
  return out;
}
function cleanPoint(c, defR) {
  if (!isObj(c) || !num(c.x, -5000, 5000) || !num(c.z, -5000, 5000)) return null;
  if (c.y !== undefined && !num(c.y, -200, 1000)) return null;
  if (c.r !== undefined && !num(c.r, 1, 40)) return null;
  return { x: r2(c.x), y: r2(c.y || 0), z: r2(c.z), r: clamp(c.r === undefined ? defR : c.r, 1.5, 15) };
}
function onAction(p, msg) {
  const room = needRoom(p);
  if (!room) return;
  const type = msg.type, d = msg.data;
  if (typeof type !== 'string' || type.length > 24) return strike(p, 'bad_action');
  const m = room.match, isHost = room.hostId === p.id;
  const hostOnly = () => { if (isHost) return true; reject(p, 'not_host'); return false; };
  switch (type) {
    case 'loadout': {
      if (!isObj(d) || !Object.hasOwn(CLASSES, String(d.cls))) return strike(p, 'bad_class');
      p.cls = d.cls;
      if (!m) { resetLife(p); p.status = 'lobby'; sendRoom(room); }
      return;
    }
    case 'dom_points': {
      if (!hostOnly()) return;
      if (!isObj(d) || !Array.isArray(d.points) || d.points.length !== 3) return strike(p, 'bad_points');
      const pts = d.points.map(c => cleanPoint(c, DOM.radius));
      if (pts.includes(null)) return strike(p, 'bad_points');
      if (m && m.mode === 'dom' && m.points) return reject(p, 'points_locked');
      room.domPoints = pts;
      if (m && m.mode === 'dom') { m.points = buildPoints(pts); sendScore(room); }
      return sendRoom(room);
    }
    case 'bomb_sites': {
      if (!hostOnly()) return;
      if (!isObj(d)) return strike(p, 'bad_sites');
      const A = cleanPoint(d.A, 5), B = cleanPoint(d.B, 5);
      if (!A || !B) return strike(p, 'bad_sites');
      if (m && m.mode === 'bomb' && room.sites) return reject(p, 'sites_locked');
      room.sites = { A, B };
      return sendRoom(room);
    }
    case 'plant_start': {
      if (!m || m.mode !== 'bomb') return reject(p, 'wrong_mode');
      if (!isObj(d) || (d.site !== 'A' && d.site !== 'B')) return strike(p, 'bad_site');
      if (!room.sites) return reject(p, 'sites_missing');
      if (m.phase !== 'live' || p.status !== 'alive' || p.team !== m.attackers) return reject(p, 'cannot_plant');
      if (m.plantAct) return reject(p, 'plant_in_progress');
      if (!p.hasPos || dist2d(p, room.sites[d.site]) > room.sites[d.site].r) return reject(p, 'not_at_site');
      m.plantAct = { by: p.id, site: d.site, ends: Date.now() + T(BOMB.plant) };
      return notify(room, 'plant_start', { by: p.id, site: d.site, duration: T(BOMB.plant) });
    }
    case 'plant_cancel':
      if (m && m.plantAct && m.plantAct.by === p.id) { m.plantAct = null; notify(room, 'plant_cancel', { by: p.id }); }
      return;
    case 'defuse_start': {
      if (!m || m.mode !== 'bomb') return reject(p, 'wrong_mode');
      if (m.phase !== 'planted' || p.status !== 'alive' || p.team === m.attackers) return reject(p, 'cannot_defuse');
      if (m.defuseAct) return reject(p, 'defuse_in_progress');
      if (!p.hasPos || dist2d(p, m.bomb) > BOMB.defuseR) return reject(p, 'not_at_bomb');
      m.defuseAct = { by: p.id, ends: Date.now() + T(BOMB.defuse) };
      return notify(room, 'defuse_start', { by: p.id, duration: T(BOMB.defuse) });
    }
    case 'defuse_cancel':
      if (m && m.defuseAct && m.defuseAct.by === p.id) { m.defuseAct = null; notify(room, 'defuse_cancel', { by: p.id }); }
      return;
    case 'z_sync': {
      if (!hostOnly()) return;
      if (!m || m.mode !== 'zombie') return reject(p, 'wrong_mode');
      if (!isObj(d) || !Array.isArray(d.zombies) || d.zombies.length > 64) return strike(p, 'bad_zombies');
      const zs = [];
      for (const z of d.zombies) {
        if (!isObj(z) || !Number.isInteger(z.id) || z.id < 0 || z.id > 1e9 || !num(z.x, -5000, 5000) || !num(z.z, -5000, 5000)) return strike(p, 'bad_zombies');
        zs.push({ id: z.id, x: r2(z.x), y: num(z.y, -200, 1000) ? r2(z.y) : 0, z: r2(z.z), yaw: num(z.yaw, -1e4, 1e4) ? r2(z.yaw) : 0, hp: num(z.hp, 0, 1e5) ? r2(z.hp) : 0, state: cleanText(z.state, 12) });
      }
      const s = JSON.stringify({ t: 'action', type: 'z_sync', from: p.id, data: { zombies: zs } });
      for (const q of room.players.values()) if (q !== p) raw(q, s, true);
      return;
    }
    case 'z_kill': {
      if (!hostOnly()) return;
      if (!m || m.mode !== 'zombie' || m.phase !== 'live') return reject(p, 'wrong_mode');
      if (!isObj(d) || !Number.isInteger(d.id) || d.id < 0 || d.id > 1e9) return strike(p, 'bad_zombie');
      if (m.seen.has(d.id)) return reject(p, 'duplicate_zombie');
      m.seen.add(d.id); m.remaining--;
      const killer = typeof d.by === 'string' ? room.players.get(d.by) : null;
      if (killer) { killer.kills++; killer.score += 50; }
      notify(room, 'z_kill', { id: d.id, by: killer ? killer.id : null, remaining: m.remaining });
      sendScore(room);
      if (m.remaining <= 0) waveCleared(room);
      return;
    }
    case 'z_damage': {
      if (!hostOnly()) return;
      if (!m || m.mode !== 'zombie' || m.phase !== 'live') return reject(p, 'wrong_mode');
      if (!isObj(d) || typeof d.target !== 'string' || !num(d.damage, 0.01, 1000)) return strike(p, 'bad_damage');
      const t = room.players.get(d.target);
      if (!t || t.status !== 'alive') return reject(p, 'bad_target');
      if (applyDamage(room, t, Math.min(d.damage, ZOMBIE.maxHit), null, 'zombie', false)) {
        t.status = 'downed'; t.hp = 0; t.deaths++; t.bleedAt = Date.now() + T(ZOMBIE.bleed); t.revive = null;
        all(room, { t: 'death', id: t.id, by: null, downed: true, bleedMs: T(ZOMBIE.bleed) });
        sendScore(room);
        checkWipe(room);
      }
      return;
    }
    case 'revive_start': {
      if (!m || m.mode !== 'zombie') return reject(p, 'wrong_mode');
      if (!isObj(d) || typeof d.target !== 'string') return strike(p, 'bad_target');
      const t = room.players.get(d.target);
      if (p.status !== 'alive' || !t || t === p || t.status !== 'downed') return reject(p, 'cannot_revive');
      if (!p.hasPos || !t.hasPos || dist2d(p, t) > ZOMBIE.reviveR) return reject(p, 'too_far');
      p.revive = { target: t.id, ends: Date.now() + T(ZOMBIE.revive) };
      return notify(room, 'revive_start', { by: p.id, target: t.id, duration: T(ZOMBIE.revive) });
    }
    case 'revive_cancel':
      if (p.revive) { p.revive = null; notify(room, 'revive_cancel', { by: p.id }); }
      return;
    default: {
      if (!RELAY_ACTIONS.has(type)) return strike(p, 'bad_action');
      const clean = cleanFlat(d);
      if (!clean) return strike(p, 'bad_action');
      all(room, { t: 'action', type, from: p.id, data: clean }, p);
    }
  }
}

const HANDLERS = {
  create: ['join', onCreate], join: ['join', onJoin], ready: ['lobby', onReady], team: ['lobby', onTeam], config: ['lobby', onConfig],
  start: ['lobby', onStart], state: ['state', onState], shot: ['shot', onShot], hit: ['hit', onHit], boom: ['boom', onBoom], action: ['action', onAction], inv: ['loot', onInv], take: ['loot', onTake],
  ping: ['ping', (p, m) => { if (num(m.c, 0, 1e15)) send(p, { t: 'pong', c: m.c, ts: Date.now() }); else strike(p, 'bad_ping'); }],
};

/* ---------- connection lifecycle ---------- */
function leaveRoom(p) {
  const room = p.room;
  if (!room) return;
  room.players.delete(p.id); p.room = null;
  if (room.players.size === 0) { room.match = null; rooms.delete(room.code); return; }
  const m = room.match;
  if (m && m.mode === 'bomb') {
    if (m.plantAct && m.plantAct.by === p.id) { m.plantAct = null; notify(room, 'plant_cancel', { by: p.id }); }
    if (m.defuseAct && m.defuseAct.by === p.id) { m.defuseAct = null; notify(room, 'defuse_cancel', { by: p.id }); }
  }
  notify(room, 'player_left', { id: p.id, name: p.name });
  if (room.hostId === p.id) {
    room.hostId = room.players.keys().next().value;
    const h = room.players.get(room.hostId);
    notify(room, 'host_changed', { id: room.hostId });
    if (m && m.mode === 'zombie') send(h, { t: 'action', type: 'z_resync', from: null, data: { wave: m.wave, remaining: m.remaining, phase: m.phase, killed: [...m.seen] } });
  }
  if (m) {
    if (m.mode === 'ffa' && room.players.size < 2) endMatch(room, room.players.keys().next().value, 'forfeit');
    else if (TEAM_MODES.has(m.mode) && (teamCount(room, 'A') === 0 || teamCount(room, 'B') === 0)) endMatch(room, teamCount(room, 'A') ? 'A' : 'B', 'forfeit');
    else if (m.mode === 'bomb') checkBombElimination(room);
    else if (m.mode === 'zombie') checkWipe(room);
  }
  if (rooms.has(room.code)) sendRoom(room);
}

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD, perMessageDeflate: false });
server.on('upgrade', (req, socket, head) => {
  let pathname = '';
  try { pathname = new URL(req.url, 'http://x').pathname; } catch { /* rejected below */ }
  const forwarded = TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
  const ip = forwarded || req.socket.remoteAddress || '?';
  const refuse = line => { socket.write(`HTTP/1.1 ${line}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
  if (pathname !== '/ws') return refuse('404 Not Found');
  if (ORIGINS.size) {
    const origin = String(req.headers.origin || '').toLowerCase();
    let sameHost = false;
    try { sameHost = new URL(origin).host === String(req.headers.host || '').toLowerCase(); } catch { /* no usable origin */ }
    if (!sameHost && !ORIGINS.has(origin)) return refuse('403 Forbidden');
  }
  if ((ipCount.get(ip) || 0) >= MAX_PER_IP) return refuse('429 Too Many Requests');
  ipCount.set(ip, (ipCount.get(ip) || 0) + 1);
  wss.handleUpgrade(req, socket, head, ws => onConnection(ws, ip));
});

function onConnection(ws, ip) {
  const p = {
    id: 'p' + (nextId++).toString(36), ws, ip, room: null, name: 'Soldat', ready: false, team: null, cls: 'assaut', status: 'lobby',
    hp: 100, maxHp: 100, armor: 60, kills: 0, deaths: 0, assists: 0, score: 0,
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, weapon: 'ar', crouch: false, hasPos: false, snap: true, stateAt: 0, dirty: false,
    respawnAt: 0, bleedAt: 0, regenAt: 0, hpSent: 0, revive: null, damageBy: new Map(), credits: [], fire: {}, limits: {}, used: {}, live: [], booms: [],
    strikes: 0, strikeAt: Date.now(), connectedAt: Date.now(), alive: true,
  };
  ws.player = p;
  ws.on('pong', () => { p.alive = true; });
  ws.on('error', () => { /* close always follows */ });
  ws.on('close', () => {
    const n = (ipCount.get(ip) || 1) - 1;
    if (n <= 0) ipCount.delete(ip); else ipCount.set(ip, n);
    try { leaveRoom(p); } catch (e) { console.error('leave error', e); }
    p.ws = null;
  });
  ws.on('message', (data, isBinary) => {
    p.alive = true;
    if (!take(p, 'all')) return strike(p, 'rate_limited');
    if (isBinary) return strike(p, 'bad_message');
    let m;
    try { m = JSON.parse(data.toString('utf8')); } catch { return strike(p, 'bad_json'); }
    if (!isObj(m) || typeof m.t !== 'string' || !Object.hasOwn(HANDLERS, m.t)) return strike(p, 'bad_message');
    const [bucket, fn] = HANDLERS[m.t];
    if (!take(p, bucket)) return strike(p, 'rate_limited');
    try { fn(p, m); } catch (e) { console.error('handler error', m.t, e); reject(p, 'server_error'); }
  });
  send(p, { t: 'welcome', id: p.id, ts: Date.now(), loot: 1 });
}

setInterval(() => {
  const now = Date.now();
  for (const ws of wss.clients) {
    const p = ws.player;
    if (!p.alive || (!p.room && now - p.connectedAt > UNJOINED_TTL)) { ws.terminate(); continue; }
    p.alive = false;
    try { ws.ping(); } catch { ws.terminate(); }
  }
}, HEARTBEAT_MS);

function shutdown() {
  for (const ws of wss.clients) ws.close(1001, 'server shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('error', e => { console.error(e.message); process.exit(1); });
server.listen(PORT, () => console.log(`FRONT ZERO server on http://localhost:${PORT} (WebSocket /ws)`));
