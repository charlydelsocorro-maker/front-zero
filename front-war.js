'use strict';
/* FRONT ZÉRO — the living front ("Front vivant"), server side. Required by server/server.js as ../front-war.js (guarded: without this
   file, or if it throws at load, the server runs exactly as before and clients simply see no front).
   - Two sides, 'A' (west) and 'B' (east); their names, colours and emblems live in the client (front-factions.js).
   - Every map of the game is a territory of a theatre with fixed adjacency. Server-validated online matches give "front points" to the
     side of each player who announced a signed front identity; points push the control bar of the territory played, thresholds flip
     it, and a side can only push a territory it owns or one adjacent to a territory it owns. Solo offline matches never reach the server.
   - Weekly offensive (1-2 objective territories, double points, one special rule), 8-week seasons aligned with the season pass, an
     exclusive cosmetic for the side that holds more territory at the end, then a reset with a twist.
   - Anonymous identity: a random id made by the client, signed here (HMAC, secret FZ_FRONT_SECRET); no account.
   - Persistence behind front-store.js (memory, json-file, external adapter slot). ON RENDER FREE THE DISK IS WIPED AT EVERY RESTART:
     the front then lives only while the instance is awake (see the dev notes).
   Protocol (additions only; older clients never send these and never receive anything from this module):
     welcome.front = 1
     client -> {t:'fid', id, sig?, side?, sw?}            bind this connection to a front identity (side: first choice or switch)
     server -> {t:'front', op:'me', me}                   identity, side, season contribution, switch rules
     server -> {t:'front', op:'rule', map, rule, obj, dmg} at a match start (and to a late joiner): this match's special rule and damage
     server -> {t:'front', op:'match', ...}               after the match: what it did to the front for this player
   HTTP: GET /api/front (public state, cached 2 s, CORS, rate-limited), POST /api/front/me (text/plain JSON body {id, sig?, side?, sw?}). */

const crypto = require('crypto');
const { createStore, memoryStore } = require('./front-store.js');

/* ---------- the theatre: 13 territories, 180° rotational symmetry around Cité Verrière ---------- */
const IDS = ['port', 'valferrade', 'marais', 'vieille-ville', 'depot', 'col-blanc', 'cite', 'sept-vents', 'barrage', 'bunker', 'val-cendre', 'roqueseche', 'noirval'];
const ADJ = {
  port: ['valferrade', 'vieille-ville', 'marais'],
  valferrade: ['port', 'vieille-ville', 'col-blanc'],
  marais: ['port', 'vieille-ville', 'depot'],
  'vieille-ville': ['port', 'valferrade', 'marais', 'col-blanc', 'cite', 'depot'],
  depot: ['marais', 'vieille-ville', 'cite', 'sept-vents'],
  'col-blanc': ['valferrade', 'vieille-ville', 'cite', 'barrage'],
  cite: ['vieille-ville', 'col-blanc', 'barrage', 'bunker', 'sept-vents', 'depot'],
  'sept-vents': ['val-cendre', 'bunker', 'cite', 'depot'],
  barrage: ['roqueseche', 'bunker', 'cite', 'col-blanc'],
  bunker: ['noirval', 'val-cendre', 'roqueseche', 'sept-vents', 'cite', 'barrage'],
  'val-cendre': ['noirval', 'bunker', 'sept-vents'],
  roqueseche: ['noirval', 'bunker', 'barrage'],
  noirval: ['val-cendre', 'bunker', 'roqueseche'],
};
const CAPITAL = { A: 'port', B: 'noirval' };
const START = { A: ['port', 'valferrade', 'marais', 'vieille-ville', 'depot'], B: ['noirval', 'val-cendre', 'roqueseche', 'bunker', 'barrage'] };       // col-blanc, cite, sept-vents start neutral

/* ---------- the numbers ---------- */
const H = 3600e3, DAY = 24 * H, WEEK = 7 * DAY;
const R = {
  flip: 50, hold: 70, contested: 30, recentMs: 6 * H,                  // control bar v: -100 = all A, +100 = all B; flips past ±50
  k0: 3, kExp: 0.85,                                                   // points per control unit: k0 * max(1, activePlayers24h / 2) ^ kExp
  minMatchMs: 120e3, minPresence: 0.5, minPresenceMs: 60e3,           // match length and own presence (both scaled by FZ_TIME_SCALE)
  pts: { part: 10, win: 30, draw: 12, place2: 18, place3: 10, kill: 2, killCap: 20, assist: 1, assistCap: 10, obj: 8, objCap: 6, wave: 4, waveCap: 10, max: 100 },
  botWeight: 0.5, pveWeight: 0.5,                                      // opposition made only of bots (or zombies) counts half
  capHour: 300, capDay: 1500, capIpHour: 900,                          // effective points per identity per hour and day, per address per hour
  objMult: 2, underdogStep: 0.1, underdogMax: 1.5,
  regen: 2, quietMs: 6 * H,                                            // control units per hour back to the owner when nobody attacked for 6 h
  counter: { share: 0.25, everyMs: 12 * H, units: 30 },                // a side that made under 25 % of the last 24 h's points counter-attacks every 12 h
  heat: { perFlip: 40, halfLifeH: 72, d1: 60, d2: 160 },               // war damage: control units moved + flips, half-life 3 days
  switchCooldownMs: 48 * H, switchLockMs: WEEK, newIdsPerIpDay: 6,
  rewardMin: 60, objectives: 2,
};
const RULE_IDS = ['fog', 'dark', 'respawn', 'ammo'];
const TWISTS = ['revanche', 'brulee', 'inverse'];
const COUNT_REASONS = new Set(['score', 'time', 'rounds', 'survived', 'wiped', 'last', 'draw']);
/* Season 1 starts with the season pass (pass-season.js, s1): Monday 23 Nov 2026 00:00 Paris (UTC+1), 8 weeks. Later seasons follow every
   8 weeks unless FZ_FRONT_START / FZ_FRONT_WEEKS say otherwise (keep them in step with pass-season.js when it adds a season). */
const S1_START = Date.UTC(2026, 10, 22, 23, 0, 0), SEASON_WEEKS = 8;
const DEV_SECRET = 'fz-front-dev-secret-not-for-production';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const other = s => (s === 'A' ? 'B' : 'A');
const dirOf = s => (s === 'A' ? -1 : 1);
const r1 = v => Math.round(v * 10) / 10;
const isSide = s => s === 'A' || s === 'B';

/* ---------- pure rules (exported for the tests) ---------- */
function seasonAt(t, cfg) {
  const len = cfg.weeks * WEEK, n = t < cfg.start ? 1 : Math.floor((t - cfg.start) / len) + 1, start = cfg.start + (n - 1) * len;
  return { id: 's' + n, n, start, end: start + len, weeks: cfg.weeks };
}
const weekIdx = (st, t) => clamp(Math.floor((t - st.sStart) / WEEK), 0, st.sWeeks - 1);
function seededInts(text, n) { const h = crypto.createHash('sha256').update(text).digest(); const out = []; for (let i = 0; i < n; i++) out.push(h.readUInt32BE((i * 4) % 28)); return out; }

function newTerritories(twist, loser) {
  const terr = {};
  const owner = { A: START.A, B: START.B };
  const swap = twist === 'inverse';
  for (const id of IDS) terr[id] = { own: null, v: 0, heat: 0, flips: 0, hitA: 0, hitB: 0, pA: 0, pB: 0, cap: 0 };
  for (const s of ['A', 'B']) {
    const side = swap ? other(s) : s;
    for (const id of owner[s]) { const tr = terr[id]; tr.own = side; tr.v = dirOf(side) * R.hold; }
    const cap = terr[CAPITAL[s]]; cap.own = side; cap.v = dirOf(side) * 100; cap.cap = 1;
  }
  if (twist === 'revanche' && isSide(loser)) { const c = terr.cite; c.own = loser; c.v = dirOf(loser) * 60; }
  if (twist === 'brulee') {
    for (const id of ['col-blanc', 'cite', 'sept-vents']) terr[id].heat = 200;
    for (const id of IDS) { const tr = terr[id]; if (tr.own && !tr.cap) tr.v = dirOf(tr.own) * 55; }
  }
  return terr;
}
function pickTwist(n, winner) {
  if (n <= 1) return 'none';
  const t = TWISTS[(n - 2) % TWISTS.length];
  return t === 'revanche' && !isSide(winner) ? 'brulee' : t;
}
function freshState(t, cfg, prev) {
  const s = seasonAt(t, cfg), last = prev && prev.hist && prev.hist.length ? prev.hist[prev.hist.length - 1] : null;
  const twist = prev ? pickTwist(s.n, last ? last.winner : null) : 'none', loser = last && isSide(last.winner) ? other(last.winner) : null;
  const st = {
    v: 1, rev: 1, season: s.id, sn: s.n, sStart: s.start, sEnd: s.end, sWeeks: s.weeks, twist,
    week: -1, wStart: 0, wEnd: 0, off: [], terr: newTerritories(twist, loser),
    tot: { A: 0, B: 0 }, h24: [], hourAt: Math.floor(t / H) * H, pop: 0, ctr: { A: t, B: t },
    players: prev ? prev.players : {}, ev: [], hist: prev ? prev.hist : [],
  };
  rollWeek(st, t);
  pushEv(st, { t, k: 'season', season: s.id, twist });
  return st;
}
function pushEv(st, e) { st.ev.push(e); if (st.ev.length > 40) st.ev.splice(0, st.ev.length - 40); }
function countOf(st, side) { let n = 0; for (const id of IDS) if (st.terr[id].own === side) n++; return n; }
/** 'own' (defend), 'attack' (owned by the enemy or neutral, and adjacent to one of ours) or null. Capitals are never attacked. */
function relation(st, side, map) {
  const tr = st.terr[map]; if (!tr) return null;
  if (tr.own === side) return 'own';
  if (tr.cap) return null;
  for (const n of ADJ[map]) if (st.terr[n].own === side) return 'attack';
  return null;
}
const kOf = st => R.k0 * Math.pow(Math.max(1, (st.pop || 0) / 2), R.kExp);
function contested(tr, t) {
  if (tr.cap) return false;
  if (!tr.own) return true;
  const toward = dirOf(tr.own) * tr.v;       // 100 = full hold
  return toward < R.contested || t - (tr.own === 'A' ? tr.hitB : tr.hitA) < R.recentMs || t - (tr.fa || 0) < R.recentMs;       // weak hold, recent attack or fresh conquest
}
const dmgOf = tr => (tr.heat >= R.heat.d2 ? 2 : tr.heat >= R.heat.d1 ? 1 : 0);
function flipCheck(st, map, t, why) {
  const tr = st.terr[map];
  const to = tr.own !== 'A' && tr.v <= -R.flip ? 'A' : tr.own !== 'B' && tr.v >= R.flip ? 'B' : null;
  if (!to) return null;
  const from = tr.own; tr.own = to; tr.flips++; tr.heat += R.heat.perFlip; tr.fa = t;
  pushEv(st, { t, k: 'flip', map, side: to, from, why: why || 'battle' });
  return to;
}
/** Effective points of one side on one map. Returns what happened (mode 'defend' | 'attack' | 'reserve'). */
function applyPoints(st, side, map, pts, t) {
  const out = { mode: 'reserve', units: 0, before: null, after: null, flipped: null, own: null };
  if (!(pts > 0) || !isSide(side)) return out;
  st.tot[side] += pts;
  const hb = st.h24.length && st.h24[st.h24.length - 1].h === st.hourAt ? st.h24[st.h24.length - 1] : (st.h24.push({ h: st.hourAt, A: 0, B: 0 }), st.h24[st.h24.length - 1]);
  hb[side] += pts;
  const rel = relation(st, side, map), tr = st.terr[map];
  if (tr) { out.before = r1(tr.v); out.own = tr.own; out.after = out.before; }
  if (!rel || (tr.cap && rel === 'own')) return out;
  const units = pts / kOf(st);
  tr.v = clamp(tr.v + dirOf(side) * units, -100, 100);
  tr.heat += units; tr['p' + side] += pts;
  if (rel === 'attack') tr['hit' + side] = t;
  out.mode = rel === 'own' ? 'defend' : 'attack'; out.units = r1(units); out.flipped = flipCheck(st, map, t, 'battle');
  out.after = r1(tr.v); out.own = tr.own;
  return out;
}
/** Raw points of one player for one match (before weight, multipliers and caps). */
function matchPoints(x) {
  const P = R.pts;
  let p = P.part;
  if (x.won) p += P.win; else if (x.draw) p += P.draw; else if (x.place === 2) p += P.place2; else if (x.place === 3) p += P.place3;
  p += Math.min(x.kills | 0, P.killCap) * P.kill + Math.min(x.assists | 0, P.assistCap) * P.assist + Math.min(x.obj | 0, P.objCap) * P.obj + Math.min(x.waves | 0, P.waveCap) * P.wave;
  return Math.min(P.max, p);
}
/** Weight of the opposition: 1 against humans only, botWeight against bots only, linear in between. */
const weightOf = (enemies, humanEnemies) => (enemies > 0 ? R.botWeight + (1 - R.botWeight) * Math.min(1, humanEnemies / enemies) : 0);
function underdog(st, side) { const d = countOf(st, other(side)) - countOf(st, side); return d > 0 ? Math.min(R.underdogMax, 1 + R.underdogStep * d) : 1; }

/** Monday roll: 1-2 objective territories on the front line, each with a special rule (seeded by season and week). */
function rollWeek(st, t) {
  const w = weekIdx(st, t);
  if (w === st.week) return false;
  st.week = w; st.wStart = st.sStart + w * WEEK; st.wEnd = Math.min(st.sEnd, st.wStart + WEEK);
  const cands = IDS.filter(id => !st.terr[id].cap && (relation(st, 'A', id) === 'attack' || relation(st, 'B', id) === 'attack'));
  cands.sort((a, b) => Math.abs(st.terr[a].v) - Math.abs(st.terr[b].v) || st.terr[b].heat - st.terr[a].heat || IDS.indexOf(a) - IDS.indexOf(b));
  const rnd = seededInts(`${st.season}:${w}`, 4), off = [];
  if (cands.length) off.push(cands[0]);
  const rest = cands.slice(1, 6);
  if (rest.length && R.objectives > 1) off.push(rest[rnd[0] % rest.length]);
  const rules = RULE_IDS.slice(), pick = [];
  for (let i = 0; i < off.length; i++) { const j = rnd[1 + i] % rules.length; pick.push(rules.splice(j, 1)[0]); }
  st.off = off.map((map, i) => ({ map, rule: pick[i] }));
  pushEv(st, { t, k: 'week', week: w, off: st.off.map(o => o.map) });
  return true;
}
/** One hour of the war: active population, regeneration of quiet territories, heat decay, counter-attacks of a starved side. */
function hourly(st, t) {
  st.hourAt += H;
  while (st.h24.length && st.h24[0].h <= st.hourAt - DAY) st.h24.shift();
  let pop = 0; for (const id in st.players) if (st.players[id].last >= st.hourAt - DAY) pop++;
  st.pop = pop;
  const decay = Math.pow(0.5, 1 / R.heat.halfLifeH);
  for (const id of IDS) {
    const tr = st.terr[id]; tr.heat *= decay; if (tr.heat < 0.05) tr.heat = 0;
    if (tr.cap) continue;
    if (st.hourAt - Math.max(tr.hitA, tr.hitB) >= R.quietMs) {
      const home = tr.own ? dirOf(tr.own) * 100 : 0, d = home - tr.v;
      tr.v = Math.abs(d) <= R.regen ? home : tr.v + Math.sign(d) * R.regen;
    }
  }
  let sum = { A: 0, B: 0 }; for (const b of st.h24) { sum.A += b.A; sum.B += b.B; }
  const total = sum.A + sum.B;
  for (const s of ['A', 'B']) {
    if (!(total > 0) || sum[s] / total >= R.counter.share || st.hourAt - (st.ctr[s] || 0) < R.counter.everyMs) continue;
    const targets = IDS.filter(id => relation(st, s, id) === 'attack');
    if (!targets.length) continue;
    targets.sort((a, b) => dirOf(s) * st.terr[b].v - dirOf(s) * st.terr[a].v || st.terr[b].heat - st.terr[a].heat || IDS.indexOf(a) - IDS.indexOf(b));
    const map = targets[0], tr = st.terr[map];
    tr.v = clamp(tr.v + dirOf(s) * R.counter.units, -100, 100); tr.heat += R.counter.units; tr['hit' + s] = st.hourAt;
    st.ctr[s] = st.hourAt;
    pushEv(st, { t: st.hourAt, k: 'counter', map, side: s });
    flipCheck(st, map, st.hourAt, 'counter');
  }
}
/** Season end: winner = more territory, then more season points; rewards for its players with enough points for that side; reset with a twist. */
function endSeason(st, t, cfg) {
  const a = countOf(st, 'A'), b = countOf(st, 'B');
  const winner = a > b ? 'A' : b > a ? 'B' : st.tot.A > st.tot.B ? 'A' : st.tot.B > st.tot.A ? 'B' : null;
  st.hist.push({ id: st.season, n: st.sn, winner, A: a, B: b, pA: Math.round(st.tot.A), pB: Math.round(st.tot.B), end: st.sEnd });
  if (st.hist.length > 20) st.hist.splice(0, st.hist.length - 20);
  for (const id in st.players) {
    const pl = st.players[id];
    if (winner && pl.ps && (pl.ps[winner] || 0) >= R.rewardMin) (pl.rw = pl.rw || []).push(st.season);
    pl.pts = 0; pl.ps = {}; pl.sw = 0; pl.m = 0;
  }
  const next = freshState(Math.max(t, st.sEnd), cfg, st);
  return next;
}
/** Catch up the clock: hours, Monday rolls, season ends (a sleeping free host wakes up late). */
function advance(st, t, cfg) {
  let s = st, guard = 0;
  while (t >= s.sEnd && guard++ < 50) {
    while (s.hourAt + H <= s.sEnd) hourly(s, s.hourAt + H);
    s = endSeason(s, s.sEnd, cfg);
  }
  let steps = 0;
  while (s.hourAt + H <= t) {
    if (steps++ > 24 * 14) { s.hourAt = Math.floor(t / H) * H; break; }       // over two weeks asleep: skip the rest
    hourly(s, s.hourAt + H);
    rollWeek(s, s.hourAt);
  }
  rollWeek(s, t);
  return s;
}
function publicView(st, t) {
  const terr = IDS.map(id => {
    const tr = st.terr[id], o = { id, own: tr.own, v: r1(tr.v), dmg: dmgOf(tr), f: tr.flips };
    if (tr.cap) o.cap = 1;
    if (contested(tr, t)) o.c = 1;
    const att = []; for (const s of ['A', 'B']) if (relation(st, s, id) === 'attack') att.push(s);
    if (att.length) o.att = att;
    const ob = st.off.find(x => x.map === id); if (ob) o.obj = ob.rule;
    return o;
  });
  const sideStat = s => { let n = 0; for (const id in st.players) { const pl = st.players[id]; if (pl.s === s && pl.pts > 0) n++; } return { terr: countOf(st, s), pts: Math.round(st.tot[s]), n, mult: underdog(st, s) }; };
  return {
    v: 1, t, rev: st.rev,
    season: { id: st.season, n: st.sn, start: st.sStart, end: st.sEnd, weeks: st.sWeeks, week: st.week, wStart: st.wStart, wEnd: st.wEnd, twist: st.twist },
    sides: { A: sideStat('A'), B: sideStat('B') }, terr, adj: ADJ, off: st.off, pop: st.pop,
    ev: st.ev.slice(-12), hist: st.hist.slice(-3).map(h => ({ id: h.id, winner: h.winner, A: h.A, B: h.B })),
    rules: { flip: R.flip, objMult: R.objMult, botWeight: R.botWeight, cap: R.capHour },
  };
}
function meView(st, pl, t) {
  if (!pl) return { side: null };
  const sinceOk = (pl.swAt || pl.at || 0) + R.switchCooldownMs, lock = st.sEnd - R.switchLockMs;
  const canSwitch = (pl.sw | 0) < 1 && t >= sinceOk && t < lock;
  return { side: pl.s, at: pl.at, pts: Math.round(pl.pts || 0), m: pl.m | 0, sw: pl.sw | 0, canSwitch, switchFrom: (pl.sw | 0) < 1 ? sinceOk : null, switchLock: lock,
    share: st.tot[pl.s] > 0 ? Math.round((pl.pts || 0) / st.tot[pl.s] * 1000) / 10 : 0, rw: (pl.rw || []).slice(-8) };
}

/* ---------- identity: a random id from the client, an HMAC from the server ---------- */
const ID_RE = /^[A-Za-z0-9_-]{22}$/, SIG_RE = /^[A-Za-z0-9_-]{22}$/;
function signer(secret) {
  const sign = id => crypto.createHmac('sha256', secret).update('fz-front:v1:' + id).digest('base64url').slice(0, 22);
  const verify = (id, sig) => { if (!ID_RE.test(id) || !SIG_RE.test(sig)) return false; const a = Buffer.from(sign(id)), b = Buffer.from(sig); return a.length === b.length && crypto.timingSafeEqual(a, b); };
  return { sign, verify };
}

/* ---------- the module ---------- */
const EXITS = new Set();       // one exit hook for every instance (the tests make several): a last synchronous save
let exitHooked = false;
function hookExit() { if (exitHooked) return; exitHooked = true; const run = () => { for (const f of EXITS) { try { f(); } catch { /* best effort */ } } }; process.on('exit', run); process.on('SIGTERM', run); process.on('SIGINT', run); }
function createFrontWar(api) {
  hookExit();
  const { rooms, ORIGINS, TRUST_PROXY, send, LIMITS } = api;
  const T = typeof api.T === 'function' ? api.T : (ms => ms);
  const now = typeof api.now === 'function' ? api.now : Date.now;
  const env = process.env;
  const cfg = { start: Number(env.FZ_FRONT_START) || S1_START, weeks: clamp(Number(env.FZ_FRONT_WEEKS) || SEASON_WEEKS, 1, 16) };
  if (!env.FZ_FRONT_SECRET) console.warn('[front] FZ_FRONT_SECRET is not set: using the development secret (anyone could forge identities). Set it on a public server.');
  const ids = signer(env.FZ_FRONT_SECRET || DEV_SECRET);
  let store;
  try { store = api.store || createStore(); } catch (e) { console.error('[front] store unavailable, keeping the front in memory:', e.message); store = memoryStore(); }
  if (!store.durable || store.kind === 'json-file') console.log(`[front] store: ${store.kind}${store.file ? ' ' + store.file : ''} (on a host whose disk is wiped at restart, the front is lost at restart)`);
  if (LIMITS) LIMITS.front = [1, 4];
  if (Number(env.FZ_FRONT_IDS_PER_IP) > 0) R.newIdsPerIpDay = Number(env.FZ_FRONT_IDS_PER_IP);       // tests from one address only

  let st = freshState(now(), cfg, null), ready = false, dirty = false, saveTimer = 0, saving = false, failAt = 0;
  const waiting = [];
  store.load().then(o => {
    if (o && o.v === 1 && o.terr && o.players && IDS.every(id => o.terr[id])) { st = o; st.ev = st.ev || []; st.hist = st.hist || []; }
    else if (o) console.warn('[front] saved state not understood, starting a new front');
    ready = true; tick(); for (const f of waiting.splice(0)) { try { f(); } catch (e) { console.error('[front] deferred', e); } }
  }).catch(e => { console.error('[front] load failed, starting a new front:', e.message); ready = true; for (const f of waiting.splice(0)) { try { f(); } catch { /* ignore */ } } });
  const whenReady = f => (ready ? f() : waiting.push(f));

  function touch() { st.rev = (st.rev | 0) + 1; cache.at = 0; dirty = true; if (!saveTimer) saveTimer = setTimeout(flush, 3000); }
  function flush() {
    saveTimer = 0;
    if (!dirty || saving) { if (dirty && !saveTimer) saveTimer = setTimeout(flush, 3000); return; }
    dirty = false; saving = true;
    store.save(st).then(() => { failAt = 0; }, e => { dirty = true; if (!failAt) console.error('[front] save failed (will retry):', e.message); failAt = now(); if (!saveTimer) saveTimer = setTimeout(flush, 15000); })
      .finally(() => { saving = false; });
  }
  EXITS.add(() => { if (dirty || saving) { try { store.flushSync(st); } catch { /* best effort */ } dirty = false; } });

  function tick() {
    if (!ready) return;
    const t = now(), before = st;
    const rev = st.rev, wk = st.week, hour = st.hourAt;
    st = advance(st, t, cfg);
    if (st !== before || st.week !== wk || st.hourAt !== hour || st.rev !== rev) touch();
  }
  const clock = setInterval(() => { try { tick(); } catch (e) { console.error('[front] tick', e); } }, 30000); clock.unref();

  /* ---------- identity and sides ---------- */
  const ipNew = new Map();       // address -> { day, n } new identities recorded today
  const ipHour = new Map();      // address -> { h, p } effective points this hour
  setInterval(() => { const t = now(); for (const [k, v] of ipNew) if (t - v.day > DAY) ipNew.delete(k); for (const [k, v] of ipHour) if (t - v.h > H) ipHour.delete(k); }, 600000).unref();
  /** body {id, sig?, side?, sw?} -> {code?, id, sig, me}. code: bad_id | taken | bad_sig | too_many | no_switch | wait */
  function hello(body, ip) {
    const t = now(), id = body && body.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) return { code: 'bad_id' };
    let sig = body.sig, pl = st.players[id];
    if (sig === undefined || sig === null) {
      if (pl) return { code: 'taken' };       // a known id is only ever used with its signature
      sig = ids.sign(id);
    } else if (typeof sig !== 'string' || !ids.verify(id, sig)) return { code: 'bad_sig' };
    const side = body.side;
    if (isSide(side) && !pl) {       // first choice (or the state was lost and the client still remembers its side)
      const q = ipNew.get(ip) || { day: t, n: 0 }; if (t - q.day > DAY) { q.day = t; q.n = 0; }
      if (q.n >= R.newIdsPerIpDay) return { code: 'too_many', id, sig, me: meView(st, null, t) };
      q.n++; ipNew.set(ip, q);
      pl = st.players[id] = { s: side, at: t, sw: 0, swAt: 0, pts: 0, ps: {}, m: 0, last: 0, rw: [] };
      touch();
    } else if (isSide(side) && pl && side !== pl.s && body.sw === 1) {
      const me = meView(st, pl, t);
      if (!me.canSwitch) return { code: (pl.sw | 0) >= 1 || t >= me.switchLock ? 'no_switch' : 'wait', id, sig, me };
      pl.s = side; pl.sw = (pl.sw | 0) + 1; pl.swAt = t; touch();
    }
    return { id, sig, me: meView(st, pl, t) };
  }

  /* ---------- WebSocket ---------- */
  function onFid(p, m) {
    whenReady(() => {
      const r = hello({ id: m.id, sig: m.sig, side: m.side, sw: m.sw }, p.ip);
      p.fc = true;
      if (r.id && !r.code) { const pl = st.players[r.id]; p.front = { id: r.id, side: pl ? pl.s : null }; }
      else if (r.code === 'bad_sig' || r.code === 'bad_id' || r.code === 'taken') p.front = null;
      send(p, { t: 'front', op: 'me', ...(r.code ? { code: r.code } : null), id: r.id || null, sig: r.sig || null, me: r.me || { side: null } });
      if (p.room && p.room.match && p.room.match.fr) sendRule(p, p.room);
    });
  }

  /* ---------- matches ---------- */
  function ruleOf(map) { const o = st.off.find(x => x.map === map); return o ? o.rule : null; }
  function sendRule(p, room) {
    const fr = room.match && room.match.fr; if (!fr || !p.fc) return;
    send(p, { t: 'front', op: 'rule', map: room.map, rule: fr.rule, obj: fr.rule ? 1 : 0, dmg: fr.dmg, own: fr.own, mult: fr.rule ? R.objMult : 1 });
    fr.told.add(p.id);
  }
  function onStart(room) {
    try {
      const m = room.match; if (!m) return;
      const tr = st.terr[room.map], t = now();
      m.fr = { at: t, rule: ruleOf(room.map), dmg: tr ? dmgOf(tr) : 0, own: tr ? tr.own : null, seen: new Map(), obj: new Map(), dom: null, bomb: null, def: null, told: new Set() };
      for (const q of room.players.values()) { if (!q.bot) m.fr.seen.set(q.id, t); sendRule(q, room); }
    } catch (e) { console.error('[front] start', e); }
  }
  const credit = (fr, id) => fr.obj.set(id, (fr.obj.get(id) || 0) + 1);
  /* 4 Hz: late joiners (rule + presence), Domination captures, Bomb plants and defuses (counted here: server.js keeps no per-player tally) */
  setInterval(() => {
    const t = now();
    for (const room of rooms.values()) {
      const m = room.match, fr = m && m.fr; if (!fr) continue;
      try {
        for (const q of room.players.values()) {
          if (q.bot) continue;
          if (!fr.seen.has(q.id)) fr.seen.set(q.id, t);
          if (q.fc && !fr.told.has(q.id)) sendRule(q, room);
        }
        if (m.mode === 'dom' && m.points) {
          if (!fr.dom) fr.dom = m.points.map(c => c.owner);
          m.points.forEach((c, i) => {
            if (c.owner === fr.dom[i]) return;
            fr.dom[i] = c.owner;
            if (c.owner) for (const q of room.players.values()) if (!q.bot && q.team === c.owner && q.status === 'alive' && Math.hypot(q.x - c.x, q.z - c.z) <= c.r + 1.5) credit(fr, q.id);
          });
        } else if (m.mode === 'bomb') {
          if (m.bomb && m.bomb !== fr.bomb) { fr.bomb = m.bomb; if (m.bomb.by) credit(fr, m.bomb.by); }
          if (m.defuseAct) fr.def = { by: m.defuseAct.by, ends: m.defuseAct.ends };
          else if (fr.def) { if (t >= fr.def.ends - 400 && m.phase === 'intermission') credit(fr, fr.def.by); fr.def = null; }
        }
      } catch (e) { console.error('[front] poll', room.code, e); }
    }
  }, 250).unref();

  /** endMatch, before the match is cleared. final = scoreView(room). */
  function onEnd(room, winner, reason, final) {
    try {
      const m = room.match; if (!m) return;
      const fr = m.fr || { at: m.startedAt, rule: null, seen: new Map(), obj: new Map() };
      const t = now(), dur = t - (m.startedAt || fr.at), map = room.map, mode = room.mode;
      const players = [...room.players.values()], humans = players.filter(q => !q.bot);
      const zone = mode === 'zone' ? m.zone : null;
      const byKills = (final && Array.isArray(final.players) ? final.players : players).slice().sort((a, b) => (b.kills | 0) - (a.kills | 0));
      const best = new Map();       // front id -> {q, res} : one result per identity, even with two tabs
      for (const q of humans) {
        if (!q.fc || !q.front || !q.front.id) continue;
        const pl = st.players[q.front.id]; if (!pl) continue;
        const side = pl.s, res = { map, mode, side, pts: 0, raw: 0, weight: 0, mult: 1, why: null, rule: fr.rule };
        const present = t - (fr.seen.get(q.id) || t), obj = fr.obj.get(q.id) || 0;
        let enemies = 0, humanEnemies = 0;
        if (mode === 'ffa' || mode === 'zone') {
          const sqd = zone && zone.sq && zone.sq.of ? zone.sq.of.get(q.id) : null;       // Zone Duo / Trio / Quatuor (squad-referee.js): squadmates are not opposition
          for (const o of players) if (o !== q) { if (sqd && sqd.members.includes(o.id)) continue; enemies++; if (!o.bot) humanEnemies++; }
          if (zone && zone.bots) { enemies += zone.bots.size; if (sqd) for (const id of sqd.members) if (zone.bots.has(id)) enemies--; }
        }
        else if (mode === 'zombie') { enemies = 1; }
        else for (const o of players) if (o.team && q.team && o.team !== q.team) { enemies++; if (!o.bot) humanEnemies++; }
        const waves = mode === 'zombie' ? (reason === 'survived' ? m.wave | 0 : Math.max(0, (m.wave | 0) - 1)) : 0;
        if (!COUNT_REASONS.has(reason)) res.why = 'reason';
        else if (dur < T(R.minMatchMs)) res.why = 'short';
        else if (present < Math.max(T(R.minPresenceMs), dur * R.minPresence)) res.why = 'presence';
        else if (mode === 'zombie' ? waves < 2 : !(enemies >= 2 || humanEnemies >= 1)) res.why = 'opposition';
        else if (!((q.score | 0) > 0 || (q.kills | 0) > 0 || obj > 0 || waves > 0)) res.why = 'idle';
        if (!res.why) {
          const won = TEAM(mode) ? winner === q.team : mode === 'zombie' ? reason === 'survived' : winner === q.id || !!(zone && zone.sq && q.team && winner === q.team);       // squad Zone: endMatch's winner is the squad id (squad-referee.js final)
          const draw = !won && (winner === null || winner === undefined) && (reason === 'time' || reason === 'draw') && mode !== 'zombie';
          let place = 0;
          if (mode === 'ffa') place = byKills.findIndex(x => x.id === q.id) + 1;
          else if (zone && Array.isArray(zone.order)) { const o = zone.order.find(x => x.id === q.id); place = o ? o.place : 0; }
          res.raw = matchPoints({ won, draw, place, kills: q.kills, assists: q.assists, obj, waves });
          res.weight = mode === 'zombie' ? R.pveWeight : weightOf(enemies, humanEnemies);
          res.won = won ? 1 : 0; res.bots = humanEnemies < enemies ? 1 : 0;
        }
        const prev = best.get(q.front.id);
        if (!prev || res.raw * res.weight > prev.res.raw * prev.res.weight) best.set(q.front.id, { q, res, pl });
      }
      if (!best.size) return;
      whenReady(() => {
        for (const { q, res, pl } of best.values()) {
          if (!res.why) {
            res.mult = (ruleOf(map) ? R.objMult : 1) * underdog(st, res.side);
            let eff = Math.round(res.raw * res.weight * res.mult);
            // caps: per identity per hour and per day, per address per hour
            const hs = Math.floor(t / H) * H, ds = Math.floor(t / DAY) * DAY;
            if (pl.ch !== hs) { pl.ch = hs; pl.hp = 0; }
            if (pl.cd !== ds) { pl.cd = ds; pl.dp = 0; }
            const ipb = ipHour.get(q.ip) || { h: hs, p: 0 }; if (ipb.h !== hs) { ipb.h = hs; ipb.p = 0; }
            const room1 = Math.max(0, Math.min(R.capHour - pl.hp, R.capDay - pl.dp, R.capIpHour - ipb.p));
            if (eff > room1) { res.capped = 1; eff = room1; }
            pl.hp += eff; pl.dp += eff; ipb.p += eff; ipHour.set(q.ip, ipb);
            res.pts = eff;
            if (eff > 0) {
              Object.assign(res, applyPoints(st, res.side, map, eff, t));
              pl.pts = (pl.pts || 0) + eff; pl.ps = pl.ps || {}; pl.ps[res.side] = (pl.ps[res.side] || 0) + eff; pl.tot = (pl.tot || 0) + eff;
            }
            pl.m = (pl.m | 0) + 1; pl.last = t;
            touch();
          }
          const tr = st.terr[map];
          res.terr = tr ? { own: tr.own, v: r1(tr.v), c: contested(tr, t) ? 1 : 0, dmg: dmgOf(tr) } : null;
          send(q, { t: 'front', op: 'match', ...res, me: meView(st, pl, t) });
        }
      });
    } catch (e) { console.error('[front] end', e); }
  }
  const TEAM = mode => mode === 'tdm' || mode === 'dom' || mode === 'bomb';

  /* ---------- HTTP: GET /api/front, POST /api/front/me ---------- */
  const byIp = new Map();
  function allow(ip, key, rate, cap) {
    const t = Date.now(); let e = byIp.get(ip); if (!e) byIp.set(ip, e = {});
    const b = e[key] || (e[key] = { n: cap, at: t });
    b.n = Math.min(cap, b.n + (t - b.at) / 1000 * rate); b.at = t; e.seen = t;
    if (b.n < 1) return false;
    b.n -= 1; return true;
  }
  setInterval(() => { const t = Date.now(); for (const [ip, e] of byIp) if (t - e.seen > 600000) byIp.delete(ip); }, 60000).unref();
  const cache = { at: 0, body: '' };
  function body() { const t = now(); if (t - cache.at < 2000 && cache.body) return cache.body; cache.at = t; cache.body = JSON.stringify({ ...publicView(st, t), store: store.kind, durable: store.durable ? 1 : 0 }); return cache.body; }
  function corsOrigin(req) {
    const origin = String(req.headers.origin || '');
    if (!ORIGINS || !ORIGINS.size) return '*';
    const o = origin.toLowerCase().replace(/\/$/, '');
    let same = false; try { same = new URL(o).host === String(req.headers.host || '').toLowerCase(); } catch { /* no origin */ }
    return same || ORIGINS.has(o) ? origin : null;
  }
  function http(req, res) {
    const url = String(req.url || '');
    if (!url.startsWith('/api/front')) return false;
    const pathname = url.split(/[?#]/)[0];
    if (pathname !== '/api/front' && pathname !== '/api/front/me') return false;
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin' };
    const allowO = corsOrigin(req); if (allowO) headers['Access-Control-Allow-Origin'] = allowO;
    const end = (code, text, extra) => { res.writeHead(code, { ...headers, ...(extra || null) }); res.end(req.method === 'HEAD' ? undefined : text); };
    if (req.method === 'OPTIONS') { res.writeHead(204, { ...headers, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); res.end(); return true; }
    const fwd = TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
    const ip = fwd || (req.socket && req.socket.remoteAddress) || '?';
    if (pathname === '/api/front') {
      if (req.method !== 'GET' && req.method !== 'HEAD') { end(405, '{"err":"method"}', { Allow: 'GET, HEAD, OPTIONS' }); return true; }
      if (!allow(ip, 'get', 5, 30)) { end(429, '{"err":"rate_limited"}', { 'Retry-After': '3' }); return true; }       // cached body: generous, several tabs or a household share an address
      if (!ready) { end(503, '{"err":"loading"}', { 'Retry-After': '2' }); return true; }
      end(200, body()); return true;
    }
    if (req.method !== 'POST') { end(405, '{"err":"method"}', { Allow: 'POST, OPTIONS' }); return true; }
    if (!allow(ip, 'me', 2, 12)) { end(429, '{"err":"rate_limited"}', { 'Retry-After': '3' }); return true; }
    let text = '', over = false;
    const timer = setTimeout(() => { over = true; end(408, '{"err":"timeout"}', { Connection: 'close' }); setTimeout(() => req.destroy(), 1000).unref(); }, 5000);
    req.setEncoding('utf8');
    req.on('data', d => {
      if (over) return;
      text += d;
      if (text.length > 2048) { over = true; text = ''; clearTimeout(timer); end(413, '{"err":"too_large"}', { Connection: 'close' }); setTimeout(() => req.destroy(), 2000).unref(); }       // the rest is read and dropped, then the socket closes
    });
    req.on('error', () => { clearTimeout(timer); });
    req.on('end', () => {
      if (over) return; clearTimeout(timer);
      let b; try { b = JSON.parse(text); } catch { return end(400, '{"err":"bad_json"}'); }
      if (!b || typeof b !== 'object' || Array.isArray(b)) return end(400, '{"err":"bad_json"}');
      whenReady(() => { const r = hello(b, ip); end(r.code && !r.id ? 400 : 200, JSON.stringify({ v: 1, ...(r.code ? { code: r.code } : null), id: r.id || null, sig: r.sig || null, me: r.me || { side: null }, t: now() })); });
    });
    return true;
  }

  /* ---------- small hooks ---------- */
  /** killPlayer: respawn delay (faster reinforcements on an objective with that rule; modes without respawn are unchanged). */
  function respawnMs(room, base) { try { const fr = room && room.match && room.match.fr; return fr && fr.rule === 'respawn' ? Math.round(base / 2) : base; } catch { return base; } }
  /** onFin: the exclusive season finish of a side ('s<n>_front_a' / '_b') is shown to the others only for a player who earned it. */
  function finOk(p, id) {
    try {
      const m = /^s(\d{1,3})_front_([ab])$/.exec(typeof id === 'string' ? id : ''); if (!m) return true;
      const pl = p && p.front && st.players[p.front.id], h = st.hist.find(x => x.id === 's' + m[1]);
      return !!pl && !!h && h.winner === m[2].toUpperCase() && (pl.rw || []).includes(h.id);
    } catch { return false; }
  }

  return {
    caps: { front: 1 }, handlers: { fid: ['front', onFid] },
    http, onStart, onEnd, respawnMs, finOk,
    get state() { return st; }, flushNow: () => (dirty ? store.save(st) : Promise.resolve()), store, tick,
  };
}

module.exports = createFrontWar;
module.exports.core = { IDS, ADJ, CAPITAL, START, R, RULE_IDS, TWISTS, S1_START, SEASON_WEEKS, H, DAY, WEEK, seasonAt, freshState, relation, applyPoints, matchPoints, weightOf, underdog, rollWeek, hourly, endSeason, advance, publicView, meView, contested, dmgOf, countOf, kOf, signer, pickTwist };
