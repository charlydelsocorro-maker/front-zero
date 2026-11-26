'use strict';
/* FRONT ZÉRO — player accounts, HTTP side (server). Required by server/server.js; without this file the server runs as before.
   Sign-in with Google (auth-google.js) -> our own session token (account-store.js), sent back by the page as "Authorization: Bearer <token>".
   The page and this server are on different sites: no cookies, CORS limited to FZ_ORIGINS (plus same host); anything else -> 403.
   Routes (JSON in and out, "Cache-Control: no-store"):
     POST   /api/auth/google  {credential}                 -> {tok, exp, pseudo, rev}  (known account)   | {need:'pseudo', ticket, exp}  (new)
     POST   /api/auth/pseudo  {ticket, pseudo, profile?}   -> 201 {tok, exp, pseudo, rev}   (creates the account; profile = the guest progress)
     GET    /api/auth/pseudo?p=<pseudo>                    -> {ok} | {ok:false, why}       (availability, for the form)
     POST   /api/auth/logout                               -> {ok}   (ends this session)
     GET    /api/me                                        -> {pseudo, rev, updated, profile}
     PUT    /api/me           {base, profile}              -> {rev, updated} | 409 {err:'conflict', rev, profile}
     DELETE /api/account                                   -> {deleted:1}   (record and every session)
     GET    /api/account/export                            -> everything kept about this account, as a JSON file
     POST   /api/contact      {topic, message, reply?}     -> 201 {ok}   (the legal pages' contact form; no account needed)
   Contact messages: <data dir>/contact/<time>-<random>.json, no address kept, deleted after 12 months; read them on the host
   (Render: Shell tab, `ls /var/data/contact`, `cat /var/data/contact/<file>`).
   A rotated session comes back as {session:{tok, exp}} on any authenticated answer.
   Every body is checked against a fixed schema: unknown fields, wrong types, oversized bodies are refused (400 / 413 / 415).
   Rate limits per address (and per account for writes). Env: FZ_GOOGLE_CLIENT_ID (public), FZ_DATA_DIR, FZ_AUTH_TEST_JWKS (tests only),
   FZ_ACCOUNTS_PER_IP (tests only: new accounts per address per day, default 10).
   WebSocket: onJoinMsg(p, m) reads an optional m.acct (session token) on create / join / quick: valid -> the room shows the account
   pseudo instead of the free name; the token is removed from the message at once. A guest whose free name is a registered pseudo is shown
   as "~name". Older clients send no acct and play exactly as before. */

const crypto = require('crypto'), fs = require('fs'), path = require('path');
const { fromEnv } = require('./auth-google.js');
const { createAccountStore, dataDir, checkPseudo, writeAtomic } = require('./account-store.js');

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

/* ---------- the profile schema (what a client may store) ---------- */
const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,47}$/, KEY = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/, BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']);
const int = (lo, hi) => ({ t: 'int', lo, hi });
const ids = max => ({ t: 'ids', max });
const SCHEMA = {
  cr: int(0, 1e9), xp: int(0, 1e10),
  weapons: ids(200), outfits: ids(200),
  primary: { t: 'id' }, secondary: { t: 'id' }, gear: { t: 'id' }, outfit: { t: 'id' }, cls: { t: 'id' }, name: { t: 'str', max: 16 },
  att: { t: 'map', max: 120, of: ids(8) },
  wstats: { t: 'map', max: 120, of: { t: 'obj', fields: { xp: int(0, 1e10), kills: int(0, 1e9), heads: int(0, 1e9), wins: int(0, 1e9) } } },
  seenLevel: int(1, 1e6),
  gx: { t: 'obj', fields: { L: { t: 'id' }, T: { t: 'id' }, M: { t: 'id' } } },
  gxOwned: ids(100),
  cos: { t: 'obj', fields: { fin: ids(400), out: ids(200), w: { t: 'map', max: 120, of: { t: 'id' } }, outfit: { t: 'id', nullable: true }, tx: { t: 'strs', max: 24, len: 40 } } },
};
const PROFILE = { t: 'obj', fields: SCHEMA };
/** -> { value } or { path } (where it went wrong). Builds a fresh object with only known fields. */
function check(spec, v, at) {
  switch (spec.t) {
    case 'int': return Number.isInteger(v) && v >= spec.lo && v <= spec.hi ? { value: v } : { path: at };
    case 'id': if (v === null && spec.nullable) return { value: null }; return typeof v === 'string' && ID.test(v) ? { value: v } : { path: at };
    case 'str': return typeof v === 'string' && v.length <= spec.max && !/[\u0000-\u001f\u007f<>&"'`\\]/.test(v) ? { value: v } : { path: at };
    case 'ids': {
      if (!Array.isArray(v) || v.length > spec.max) return { path: at };
      for (let i = 0; i < v.length; i++) if (typeof v[i] !== 'string' || !ID.test(v[i])) return { path: `${at}[${i}]` };
      return { value: [...new Set(v)] };
    }
    case 'strs': {
      if (!Array.isArray(v) || v.length > spec.max) return { path: at };
      for (let i = 0; i < v.length; i++) if (typeof v[i] !== 'string' || v[i].length > spec.len || /[^\x20-\x7e]/.test(v[i])) return { path: `${at}[${i}]` };
      return { value: v.slice() };
    }
    case 'map': {
      if (!isObj(v)) return { path: at };
      const keys = Object.keys(v); if (keys.length > spec.max) return { path: at };
      const out = {};
      for (const k of keys) { if (!KEY.test(k) || BAD_KEYS.has(k)) return { path: `${at}.${k.slice(0, 40)}` }; const r = check(spec.of, v[k], `${at}.${k}`); if (r.path) return r; out[k] = r.value; }
      return { value: out };
    }
    case 'obj': {
      if (!isObj(v)) return { path: at };
      const out = {};
      for (const k of Object.keys(v)) { if (!own(spec.fields, k)) return { path: `${at}.${k.slice(0, 40)}`, unknown: true }; const r = check(spec.fields[k], v[k], `${at}.${k}`); if (r.path) return r; out[k] = r.value; }
      return { value: out };
    }
    default: return { path: at };
  }
}
const checkProfile = v => check(PROFILE, v, 'profile');
/** A request body: exactly these keys (optional ones may be absent). */
function shape(body, required, optional = []) {
  if (!isObj(body)) return 'body';
  for (const k of Object.keys(body)) if (!required.includes(k) && !optional.includes(k)) return 'unknown:' + k.slice(0, 40);
  for (const k of required) if (!own(body, k)) return 'missing:' + k;
  return null;
}

/* ---------- the module ---------- */
function createAccounts(api = {}) {
  const env = api.env || process.env, ORIGINS = api.ORIGINS || new Set(), TRUST_PROXY = !!api.TRUST_PROXY, now = api.now || Date.now;
  const auth = api.auth || fromEnv(env);
  let store = null;
  try { store = api.store || createAccountStore({ dir: dataDir(env), now }); }
  catch (e) { console.error('[accounts] store unavailable, accounts are off:', e.message); }
  console.log(`[accounts] sign-in: ${auth.mode}${auth.clientId ? ' (' + auth.clientId.slice(0, 12) + '…)' : ''}; store: ${store ? store.dir + ', ' + store.size + ' account(s)' : 'OFF'}`);
  const PER_IP_DAY = Math.max(1, Number(env.FZ_ACCOUNTS_PER_IP) || 10);

  // upkeep: expired sessions, tickets, replayed ID tokens, rate buckets; inactive accounts once a day
  const tickets = new Map(), jtis = new Map(), byIp = new Map(), newPerIp = new Map(), byAcct = new Map();
  const sweep = setInterval(() => {
    const t = now();
    for (const [k, v] of tickets) if (v.exp <= t) tickets.delete(k);
    for (const [k, v] of jtis) if (v <= t) jtis.delete(k);
    for (const [k, v] of byIp) if (t - v.seen > 600e3) byIp.delete(k);
    for (const [k, v] of byAcct) if (t - v.at > 600e3) byAcct.delete(k);
    for (const [k, v] of newPerIp) if (t - v.at > 864e5) newPerIp.delete(k);
  }, 60e3); sweep.unref();
  if (store) { const p = () => store.purge().catch(e => console.error('[accounts] upkeep', e.message)); setTimeout(p, 60e3).unref(); setInterval(p, 864e5).unref(); }

  function bucket(map, key, rate, cap) {
    const t = now(); let e = map.get(key); if (!e) map.set(key, e = {});
    e.seen = t; const b = e.b || (e.b = { n: cap, at: t });
    b.n = Math.min(cap, b.n + (t - b.at) / 1000 * rate); b.at = t;
    if (b.n < 1) return false; b.n -= 1; return true;
  }
  const allow = (ip, kind) => { const [rate, cap] = { auth: [0.1, 6], write: [0.5, 10], read: [1, 12], contact: [1 / 120, 3] }[kind]; return bucket(byIp, kind + '|' + ip, rate, cap); };
  const allowAcct = id => { const t = now(); let e = byAcct.get(id); if (!e) byAcct.set(id, e = { n: 6, at: t }); e.n = Math.min(6, e.n + (t - e.at) / 1000 * 0.5); e.at = t; if (e.n < 1) return false; e.n -= 1; return true; };

  function originOk(req) {
    const origin = req.headers.origin; if (origin === undefined) return { ok: true, allow: null };       // not a browser page: no CORS header needed
    const o = String(origin).toLowerCase().replace(/\/$/, '');
    let same = false; try { same = new URL(o).host === String(req.headers.host || '').toLowerCase(); } catch { /* "null" or garbage */ }
    if (!ORIGINS.size) return { ok: true, allow: String(origin) };       // LAN / local work: any page
    return same || ORIGINS.has(o) ? { ok: true, allow: String(origin) } : { ok: false };
  }
  function readBody(req, max) {
    return new Promise(resolve => {
      const ct = String(req.headers['content-type'] || '');
      if (!/^application\/json(\s*;|$)/i.test(ct)) { req.resume(); return resolve({ code: 415 }); }
      const len = Number(req.headers['content-length']); if (len > max) { req.resume(); return resolve({ code: 413 }); }
      const chunks = []; let size = 0, done = false;
      const finish = r => { if (done) return; done = true; clearTimeout(timer); resolve(r); };
      const timer = setTimeout(() => { finish({ code: 408 }); req.destroy(); }, 8000);
      req.on('data', d => { if (done) return; size += d.length; if (size > max) { finish({ code: 413 }); req.resume(); return; } chunks.push(d); });
      req.on('error', () => finish({ code: 400 }));
      req.on('end', () => { if (done) return; let v; try { v = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return finish({ code: 400, err: 'bad_json' }); } finish({ body: v }); });
    });
  }
  const bearer = req => { const m = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(String(req.headers.authorization || '')); return m ? m[1] : null; };

  /** -> true when the request was one of ours (answered or being answered). */
  function http(req, res) {
    const url = String(req.url || '');
    if (!url.startsWith('/api/auth/') && !url.startsWith('/api/me') && !url.startsWith('/api/account') && !url.startsWith('/api/contact')) return false;
    let u; try { u = new URL(url, 'http://x'); } catch { return false; }
    const route = u.pathname;
    if (!['/api/auth/google', '/api/auth/pseudo', '/api/auth/logout', '/api/me', '/api/account', '/api/account/export', '/api/contact'].includes(route)) {
      if (route !== '/api/me' && !route.startsWith('/api/auth/') && !route.startsWith('/api/account')) return false;       // e.g. /api/members or /api/contacts: not ours
    }
    const o = originOk(req);
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin' };
    if (o.allow) headers['Access-Control-Allow-Origin'] = o.allow;
    let sent = false;
    const end = (code, obj, extra) => { if (sent) return; sent = true; try { res.writeHead(code, { ...headers, ...(extra || null) }); res.end(obj === undefined ? undefined : JSON.stringify(obj)); } catch { /* client gone */ } };
    if (!o.ok) { end(403, { err: 'origin' }); req.resume(); return true; }
    if (req.method === 'OPTIONS') { end(204, undefined, { 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' }); return true; }
    const fwd = TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
    const ip = fwd || (req.socket && req.socket.remoteAddress) || '?';
    const routes = {
      'POST /api/auth/google': ['auth', authGoogle], 'POST /api/auth/pseudo': ['auth', createAccount], 'GET /api/auth/pseudo': ['read', pseudoFree],
      'POST /api/auth/logout': ['write', logout], 'GET /api/me': ['read', getMe], 'PUT /api/me': ['write', putMe],
      'DELETE /api/account': ['write', del], 'GET /api/account/export': ['read', exportData], 'POST /api/contact': ['contact', contact],
    };
    const r = routes[req.method + ' ' + route];
    if (!r) { const known = Object.keys(routes).filter(k => k.endsWith(' ' + route)).map(k => k.split(' ')[0]); req.resume(); end(known.length ? 405 : 404, { err: known.length ? 'method' : 'not_found' }, known.length ? { Allow: known.join(', ') + ', OPTIONS' } : null); return true; }
    if (r[1] !== contact && (!store || (r[1] !== pseudoFree && auth.mode === 'off' && (route === '/api/auth/google' || route === '/api/auth/pseudo')))) { req.resume(); end(503, { err: 'accounts_off' }); return true; }
    if (!allow(ip, r[0])) { req.resume(); end(429, { err: 'rate_limited' }, { 'Retry-After': '5' }); return true; }
    Promise.resolve().then(() => r[1]({ req, res, ip, u, end })).catch(e => { console.error('[accounts] route error', route, e && e.message); end(500, { err: 'server_error' }); });
    return true;
  }
  const withSession = (ctx, fn, rotate = true) => {       // rotate: false where the answer cannot carry a new token (export file, deletion)
    const tok = bearer(ctx.req); if (!tok) { ctx.req.resume(); return ctx.end(401, { err: 'auth' }); }
    const s = store.useSession(tok, { rotate }); if (!s) { ctx.req.resume(); return ctx.end(401, { err: 'auth' }); }
    return fn(s, s.rotated ? { session: s.rotated } : null, tok);
  };
  async function body(ctx, max) {
    const b = await readBody(ctx.req, max);
    if (b.code) { ctx.end(b.code, { err: b.err || ({ 400: 'bad_body', 408: 'timeout', 413: 'too_large', 415: 'json_only' })[b.code] }, b.code === 413 ? { Connection: 'close' } : null); return null; }
    return b.body;
  }

  /* ---------- routes ---------- */
  async function authGoogle(ctx) {
    const b = await body(ctx, 8192); if (b === null) return;
    const bad = shape(b, ['credential']); if (bad) return ctx.end(400, { err: 'schema', path: bad });
    let claims; try { claims = await auth.verifier.verify(b.credential); } catch (e) { return ctx.end(401, { err: 'bad_token', why: e && e.code ? e.code : 'error' }); }
    if (claims.jti) { if (jtis.has(claims.jti)) return ctx.end(401, { err: 'bad_token', why: 'replay' }); if (jtis.size < 100000) jtis.set(claims.jti, claims.exp * 1000 + 120e3); }
    const sh = store.subHash(claims.sub);
    const s = store.signIn(sh);
    if (s) { await s.saved; return ctx.end(200, { v: 1, tok: s.session.tok, exp: s.session.exp, pseudo: s.rec.pseudo, rev: s.rec.rev }); }
    const ticket = crypto.randomBytes(32).toString('base64url'), exp = now() + 10 * 60e3;
    tickets.set(sha256(ticket), { sh, exp });
    return ctx.end(200, { v: 1, need: 'pseudo', ticket, exp });
  }
  function pseudoFree(ctx) {
    const p = ctx.u.searchParams.get('p') || '';
    const why = checkPseudo(p) || (store.pseudoTaken(p) ? 'taken' : null);
    ctx.end(200, why ? { v: 1, ok: false, why } : { v: 1, ok: true });
  }
  async function createAccount(ctx) {
    const b = await body(ctx, 72 * 1024); if (b === null) return;
    const bad = shape(b, ['ticket', 'pseudo'], ['profile']); if (bad) return ctx.end(400, { err: 'schema', path: bad });
    const tk = typeof b.ticket === 'string' && /^[A-Za-z0-9_-]{43}$/.test(b.ticket) ? tickets.get(sha256(b.ticket)) : null;
    if (!tk || tk.exp <= now()) return ctx.end(401, { err: 'ticket' });
    const why = checkPseudo(b.pseudo); if (why) return ctx.end(400, { err: 'pseudo', why });
    if (store.pseudoTaken(b.pseudo)) return ctx.end(409, { err: 'pseudo', why: 'taken' });
    let profile = null;
    if (own(b, 'profile') && b.profile !== null) { const c = checkProfile(b.profile); if (c.path) return ctx.end(400, { err: 'schema', path: c.path }); profile = c.value; }
    const existing = store.signIn(tk.sh);       // signed up meanwhile (another tab): just sign in
    if (existing) { tickets.delete(sha256(b.ticket)); await existing.saved; return ctx.end(200, { v: 1, tok: existing.session.tok, exp: existing.session.exp, pseudo: existing.rec.pseudo, rev: existing.rec.rev }); }
    const day = newPerIp.get(ctx.ip); if (day && day.n >= PER_IP_DAY && now() - day.at < 864e5) return ctx.end(429, { err: 'too_many_accounts' });
    const r = store.create({ sh: tk.sh, pseudo: b.pseudo, profile });
    if (r.err) return ctx.end(r.err === 'taken' ? 409 : 400, { err: 'pseudo', why: r.err });
    tickets.delete(sha256(b.ticket));
    if (day && now() - day.at < 864e5) day.n++; else newPerIp.set(ctx.ip, { n: 1, at: now() });
    await r.saved;
    return ctx.end(201, { v: 1, tok: r.session.tok, exp: r.session.exp, pseudo: r.rec.pseudo, rev: r.rec.rev });
  }
  function logout(ctx) {
    const tok = bearer(ctx.req); ctx.req.resume();
    if (tok) store.revokeSession(tok);
    ctx.end(200, { v: 1, ok: 1 });
  }
  function getMe(ctx) {
    return withSession(ctx, (s, extra) => { ctx.req.resume(); ctx.end(200, { v: 1, pseudo: s.rec.pseudo, rev: s.rec.rev, updated: s.rec.updated, profile: s.rec.profile, ...extra }); });
  }
  function putMe(ctx) {
    return withSession(ctx, async (s, extra) => {
      if (!allowAcct(s.id)) { ctx.req.resume(); return ctx.end(429, { err: 'rate_limited' }, { 'Retry-After': '3' }); }
      const b = await body(ctx, 64 * 1024); if (b === null) return;
      const bad = shape(b, ['base', 'profile']); if (bad) return ctx.end(400, { err: 'schema', path: bad });
      if (!Number.isInteger(b.base) || b.base < 0) return ctx.end(400, { err: 'schema', path: 'base' });
      const c = checkProfile(b.profile); if (c.path) return ctx.end(400, { err: 'schema', path: c.path });
      const r = store.saveProfile(s.id, c.value, b.base);
      if (!r) return ctx.end(401, { err: 'auth' });       // deleted meanwhile
      if (r.conflict) return ctx.end(409, { v: 1, err: 'conflict', rev: r.rev, profile: r.profile, ...extra });
      await r.saved;
      return ctx.end(200, { v: 1, rev: r.rev, updated: r.updated, ...extra });
    });
  }
  function del(ctx) {
    return withSession(ctx, async s => { ctx.req.resume(); await store.remove(s.id); ctx.end(200, { v: 1, deleted: 1 }); }, false);
  }
  function exportData(ctx) {
    return withSession(ctx, s => {
      ctx.req.resume();
      const iso = t => (Number.isFinite(t) ? new Date(t).toISOString() : null), rec = s.rec;
      const out = {
        format: 'front-zero-account-export', version: 1, exported_at: iso(now()),
        account: { pseudo: rec.pseudo, created: iso(rec.created), updated: iso(rec.updated), last_seen: iso(rec.seen), revision: rec.rev,
          google_account: { stored_as: 'salted HMAC-SHA256 of the Google account id', value: rec.sub } },
        sessions: rec.sessions.map(x => ({ created: iso(x.c), last_used: iso(x.u), expires: iso(x.r ? Math.min(x.e, x.r) : x.e) })),
        profile: rec.profile,
        not_stored: ['email address', 'name', 'profile picture', 'raw Google account id', 'raw session tokens (only their SHA-256)'],
      };
      ctx.end(200, out, { 'Content-Disposition': `attachment; filename="front-zero-${rec.pseudo}.json"` });
    }, false);
  }

  /* ---------- contact form (legal pages) ---------- */
  const contactDir = path.join(dataDir(env), 'contact'), TOPICS = new Set(['question', 'data', 'report', 'other']);
  let contactDay = { n: 0, at: 0 };
  const clean = (v, max) => String(v).normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max).trim();
  async function contact(ctx) {
    const b = await body(ctx, 8192); if (b === null) return;
    const bad = shape(b, ['topic', 'message'], ['reply', 'lang']); if (bad) return ctx.end(400, { err: 'schema', path: bad });
    if (!TOPICS.has(b.topic) || typeof b.message !== 'string' || (b.reply !== undefined && typeof b.reply !== 'string') || (b.lang !== undefined && !/^[a-z]{2}$/.test(String(b.lang)))) return ctx.end(400, { err: 'schema', path: 'fields' });
    const message = clean(b.message, 2000), reply = b.reply ? clean(b.reply, 120) : '';
    if (message.length < 5) return ctx.end(400, { err: 'schema', path: 'message' });
    const t = now(); if (t - contactDay.at > 864e5) contactDay = { n: 0, at: t };
    if (contactDay.n >= 300) return ctx.end(429, { err: 'rate_limited' });
    contactDay.n++;
    await fs.promises.mkdir(contactDir, { recursive: true, mode: 0o700 });
    const name = new Date(t).toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(4).toString('hex') + '.json';
    await writeAtomic(path.join(contactDir, name), JSON.stringify({ at: new Date(t).toISOString(), topic: b.topic, lang: b.lang || null, reply: reply || null, message }, null, 1));
    return ctx.end(201, { v: 1, ok: 1 });
  }
  async function purgeContact() {       // 12 months
    let n = 0; try { for (const f of await fs.promises.readdir(contactDir)) { const p = path.join(contactDir, f); const st = await fs.promises.stat(p); if (now() - st.mtimeMs > 365 * 864e5) { await fs.promises.rm(p, { force: true }); n++; } } } catch { /* no folder yet */ }
    if (n) console.log(`[accounts] upkeep: ${n} contact message(s) older than 12 months removed`);
  }
  { const p = () => purgeContact(); setTimeout(p, 90e3).unref(); setInterval(p, 864e5).unref(); }

  /* ---------- WebSocket: the account pseudo as the display name ---------- */
  function onJoinMsg(p, m) {
    if (!store || !m || typeof m !== 'object') return;
    const tok = m.acct; if (own(m, 'acct')) delete m.acct;       // never kept, never sent to anyone
    const s = typeof tok === 'string' ? store.peekSession(tok) : null;
    if (s) { p.acct = s.id; m.name = s.pseudo; return; }
    p.acct = null;
    const n = typeof m.name === 'string' ? m.name.trim() : '';
    if (n && store.pseudoTaken(n)) m.name = '~' + n.slice(0, 15);       // a guest cannot pass for a registered player
  }

  return { http, onJoinMsg, store, mode: auth.mode, checkProfile, close: async () => { clearInterval(sweep); if (store) await store.close(); } };
}

module.exports = createAccounts;
module.exports.checkProfile = checkProfile;
module.exports.SCHEMA = SCHEMA;
