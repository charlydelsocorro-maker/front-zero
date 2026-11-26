// FRONT ZÉRO — player accounts: talking to the server and keeping the profile in step (loaded by account-ui.js for a signed-in player,
// or when the account panel opens). The profile is the 'frontzero' save (profile.js); only the fields of the server schema are sent
// (account-server.js SCHEMA), cleaned here so the server never has a reason to refuse them. Other fields of the save stay on this device.
// When: right after sign-in, 2 s after a match ends, every 60 s when something changed (not during a match), and when the page is hidden.
// How: PUT /api/me with the revision this device started from. If another device saved meanwhile (409), merge and send again:
//   counters (credits, XP, weapon records) = server + what this device earned since the last sync; owned items = union;
//   choices (loadout, attachments, finish worn) = this device's if it changed them since, else the server's.
// First sign-in on a device (its guest progress joins the account): owned items and outfits = union, XP = the higher, weapon records =
// the higher of each, credits = the account's plus what the guest earned above the 500 every new player starts with (a brand-new
// account simply takes the guest's whole save, credits included).
// Signing out (button) ends the session on the server, puts this device back to a fresh guest save and reloads the page.
// An expired or refused session (401) keeps the local save; signing in again to the same account then merges without counting twice.
import { sanitize } from './attachments.js';
import { CLASSES, WEAPONS } from './data.js';

const SAVE = 'frontzero', START_CR = 500, PERIOD = 60e3;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,47}$/, KEY = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/, BAD = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const int = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.floor(+v))) : null);
const ids = (a, max) => (Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string' && ID.test(x)))].slice(0, max) : null);
const mapOf = (o, max, fn) => { if (!isObj(o)) return null; const out = {}; let n = 0; for (const k of Object.keys(o)) { if (n >= max) break; if (!KEY.test(k) || BAD.has(k)) continue; const v = fn(o[k]); if (v !== null && v !== undefined) { out[k] = v; n++; } } return out; };

/** The part of a save the server keeps, cleaned to its schema (bad entries dropped, never a reason for a refusal). */
export function pick(raw) {
  const o = isObj(raw) ? raw : {}, out = {};
  const put = (k, v) => { if (v !== null && v !== undefined) out[k] = v; };
  put('cr', int(o.cr, 0, 1e9)); put('xp', int(o.xp, 0, 1e10));
  put('weapons', ids(o.weapons, 200)); put('outfits', ids(o.outfits, 200));
  for (const k of ['primary', 'secondary', 'gear', 'outfit', 'cls']) if (typeof o[k] === 'string' && ID.test(o[k])) out[k] = o[k];
  if (typeof o.name === 'string') out.name = o.name.replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').slice(0, 16);
  put('att', mapOf(o.att, 120, v => ids(v, 8)));
  put('wstats', mapOf(o.wstats, 120, v => (isObj(v) ? { xp: int(v.xp, 0, 1e10) || 0, kills: int(v.kills, 0, 1e9) || 0, heads: int(v.heads, 0, 1e9) || 0, wins: int(v.wins, 0, 1e9) || 0 } : null)));
  if (o.seenLevel !== undefined) { const s = int(o.seenLevel, 1, 1e6); if (s) out.seenLevel = s; }
  if (isObj(o.gx)) { const g = {}; for (const s of ['L', 'T', 'M']) if (typeof o.gx[s] === 'string' && ID.test(o.gx[s])) g[s] = o.gx[s]; out.gx = g; }
  put('gxOwned', ids(o.gxOwned, 100));
  if (isObj(o.cos)) {
    const c = o.cos;
    out.cos = { fin: ids(c.fin, 400) || [], out: ids(c.out, 200) || [], w: mapOf(c.w, 120, v => (typeof v === 'string' && ID.test(v) ? v : null)) || {},
      outfit: typeof c.outfit === 'string' && ID.test(c.outfit) ? c.outfit : null,
      tx: (Array.isArray(c.tx) ? c.tx.filter(x => typeof x === 'string' && x.length <= 40 && !/[^\x20-\x7e]/.test(x)) : []).slice(-24) };
  }
  return out;
}
/** Key-order independent JSON, to compare two profiles. */
export function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (isObj(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const union = (a, b, max) => [...new Set([...(a || []), ...(b || [])])].slice(0, max);
const same = (a, b) => canon(a) === canon(b);
const empty = p => !isObj(p) || !Object.keys(p).length;

/** First sign-in of this device: its guest progress joins the account (see the header). */
export function mergeGuest(server, guest) {
  const g = pick(guest);
  if (empty(server)) return g;
  const s = pick(server), out = { ...g, ...s };       // choices: the account's, the guest's where the account has none
  out.cr = Math.min(1e9, (s.cr || 0) + Math.max(0, (g.cr ?? START_CR) - START_CR));
  out.xp = Math.max(s.xp || 0, g.xp || 0);
  out.weapons = union(s.weapons, g.weapons, 200); out.outfits = union(s.outfits, g.outfits, 200); out.gxOwned = union(s.gxOwned, g.gxOwned, 100);
  out.att = { ...(g.att || {}), ...(s.att || {}) };
  const ws = { ...(g.wstats || {}) };
  for (const [k, v] of Object.entries(s.wstats || {})) { const a = ws[k]; ws[k] = a ? { xp: Math.max(a.xp, v.xp), kills: Math.max(a.kills, v.kills), heads: Math.max(a.heads, v.heads), wins: Math.max(a.wins, v.wins) } : v; }
  out.wstats = ws;
  if (s.seenLevel || g.seenLevel) out.seenLevel = Math.max(s.seenLevel || 1, g.seenLevel || 1);
  if (s.cos || g.cos) { const a = s.cos || {}, b = g.cos || {}; out.cos = { fin: union(a.fin, b.fin, 400), out: union(a.out, b.out, 200), w: { ...(b.w || {}), ...(a.w || {}) }, outfit: a.outfit ?? b.outfit ?? null, tx: union(a.tx, b.tx, 1e3).slice(-24) }; }
  return pick(out);
}
/** Another device saved since our base: server + what this device did since base. */
export function merge3(server, local, base) {
  const s = pick(server), l = pick(local), b = pick(base);
  if (empty(s)) return l;
  const out = {};
  const pref = k => { if (k in l && !same(l[k], b[k])) out[k] = l[k]; else if (k in s) out[k] = s[k]; else if (k in l) out[k] = l[k]; };
  for (const k of ['primary', 'secondary', 'gear', 'outfit', 'cls', 'name', 'gx']) pref(k);
  out.cr = Math.min(1e9, Math.max(0, (s.cr ?? 0) + ((l.cr ?? 0) - (b.cr ?? l.cr ?? 0))));
  out.xp = Math.min(1e10, (s.xp ?? 0) + Math.max(0, (l.xp ?? 0) - (b.xp ?? l.xp ?? 0)));
  out.weapons = union(s.weapons, l.weapons, 200); out.outfits = union(s.outfits, l.outfits, 200); out.gxOwned = union(s.gxOwned, l.gxOwned, 100);
  const map3 = (sm, lm, bm) => { const o = { ...(sm || {}) }; for (const k of new Set([...Object.keys(lm || {}), ...Object.keys(bm || {})])) { const lv = (lm || {})[k], bv = (bm || {})[k]; if (!same(lv, bv)) { if (lv === undefined) delete o[k]; else o[k] = lv; } } return o; };
  out.att = map3(s.att, l.att, b.att);
  const ws = { ...(s.wstats || {}) };
  for (const [k, v] of Object.entries(l.wstats || {})) { const bv = (b.wstats || {})[k] || { xp: 0, kills: 0, heads: 0, wins: 0 }, sv = ws[k] || { xp: 0, kills: 0, heads: 0, wins: 0 }; ws[k] = { xp: sv.xp + Math.max(0, v.xp - bv.xp), kills: sv.kills + Math.max(0, v.kills - bv.kills), heads: sv.heads + Math.max(0, v.heads - bv.heads), wins: sv.wins + Math.max(0, v.wins - bv.wins) }; }
  out.wstats = ws;
  if (s.seenLevel || l.seenLevel) out.seenLevel = Math.max(s.seenLevel || 1, l.seenLevel || 1);
  if (s.cos || l.cos) {
    const a = s.cos || {}, c = l.cos || {}, bc = b.cos || {};
    out.cos = { fin: union(a.fin, c.fin, 400), out: union(a.out, c.out, 200), w: map3(a.w, c.w, bc.w), outfit: !same(c.outfit, bc.outfit) ? c.outfit ?? null : a.outfit ?? null, tx: union(a.tx, c.tx, 1e3).slice(-24) };
  }
  return pick(out);
}

const readSave = () => { try { const o = JSON.parse(localStorage.getItem(SAVE) || 'null'); return isObj(o) ? o : {}; } catch { return {}; } };

export function start(ctx) {
  const { net, engine, profile, base: apiBase, readAccount, writeAccount, setCaps, changed, setStatus } = ctx;
  const patch = o => { const a = readAccount(); writeAccount({ ...a, ...o }); };
  let busy = null, timer = 0, lastErr = '', schemaErr = '';
  const lock = fn => (navigator.locks && navigator.locks.request ? navigator.locks.request('frontzero-account', fn) : fn());

  /* ---------- HTTP ---------- */
  async function call(method, path, body, opt = {}) {
    const tok = opt.noAuth ? null : readAccount().tok;
    const headers = {}; if (tok) headers.Authorization = 'Bearer ' + tok; if (body !== undefined) headers['Content-Type'] = 'application/json';
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), opt.timeout || 12000);
    try {
      const r = await fetch(apiBase + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit', cache: 'no-store', keepalive: !!opt.keepalive, signal: opt.keepalive ? undefined : ctl.signal });
      let j = null; try { j = await r.json(); } catch { j = null; }
      if (j && j.session && typeof j.session.tok === 'string') { patch({ tok: j.session.tok, exp: j.session.exp }); setCaps(); }       // rotated session
      return { status: r.status, j: j || {} };
    } catch (e) { return { status: 0, j: { err: 'network' }, e }; }
    finally { clearTimeout(to); }
  }

  /* ---------- applying a profile to this device ---------- */
  function apply(p, pseudo) {
    const raw = readSave(), next = { ...raw, ...p };
    if (pseudo) next.name = pseudo;
    try { localStorage.setItem(SAVE, JSON.stringify(next)); } catch { /* storage full: the in-memory profile still gets it */ }
    try { if (typeof profile.sync === 'function') profile.sync(); } catch (e) { console.warn('[account] profile re-read', e); }       // credits, XP, owned items, finishes (shop-ledger.js)
    const d = profile.data;
    try {
      if (isObj(p.att)) { const a = {}; for (const [w, l] of Object.entries(p.att)) { if (!WEAPONS.some(x => x.id === w)) continue; const s = sanitize(w, l); if (s.length) a[w] = s; } d.att = a; }
      if (isObj(p.wstats)) { const m = {}; for (const [w, s] of Object.entries(p.wstats)) if (WEAPONS.some(x => x.id === w)) m[w] = { ...s }; d.wstats = m; }
      if (Number.isInteger(p.seenLevel)) d.seenLevel = Math.max(d.seenLevel || 1, Math.min(p.seenLevel, profile.level));
      const slotKey = ['primary', 'secondary', 'gear'];
      slotKey.forEach((k, slot) => { const w = WEAPONS.find(x => x.id === p[k]); if (w && w.slot === slot && d.weapons.includes(w.id)) d[k] = w.id; });
      if (p.outfit && d.outfits.includes(p.outfit)) d.outfit = p.outfit;
      if (p.cls && CLASSES.some(c => c.id === p.cls)) d.cls = p.cls;
      const GX = globalThis.FZGearData; if (isObj(p.gx) && GX && GX.cleanLoadout) d.gx = GX.cleanLoadout(p.gx);
      if (pseudo) d.name = pseudo;
    } catch (e) { console.warn('[account] apply', e); }
    try { profile.save(); } catch (e) { console.warn('[account] save', e); }
  }
  const local = () => pick(readSave());

  /* ---------- sync ---------- */
  const dirty = () => { const a = readAccount(); return !!a.tok && (!a.base || !same(local(), a.base)); };
  function signedOutRemotely() {
    const a = readAccount();
    writeAccount({ owner: a.owner, base: a.base, rev: a.rev, out: 'expired' });       // keeps what it needs to merge without counting twice if the same account signs in again
    setCaps(); setStatus('idle'); changed();
  }
  /** Sends this device's profile; merges first when another device saved meanwhile. */
  async function push(reason, keepalive) {
    const a = readAccount(); if (!a.tok) return { skipped: 'out' };
    const mine = local();
    if (a.base && same(mine, a.base)) { setStatus('ok'); return { skipped: 'same' }; }
    if (keepalive) {       // page hidden or closing: one request, no waiting; recorded so the next start knows whether it landed
      patch({ pend: { rev: (a.rev || 0) + 1, profile: mine } });
      call('PUT', '/api/me', { base: a.rev || 0, profile: mine }, { keepalive: true }).then(r => { if (r.status === 200) patch({ rev: r.j.rev, base: mine, at: Date.now(), pend: null }); else if (r.status) patch({ pend: null }); }, () => {});
      return { sent: 'keepalive' };
    }
    let r = await call('PUT', '/api/me', { base: a.rev || 0, profile: mine });
    if (r.status === 409 && isObj(r.j)) {
      const merged = merge3(r.j.profile || {}, mine, a.base || {});
      apply(merged, readAccount().pseudo);
      r = await call('PUT', '/api/me', { base: r.j.rev, profile: merged });
      if (r.status === 200) { patch({ rev: r.j.rev, base: merged, at: Date.now(), pend: null }); setStatus('ok'); changed(); return { merged: true, rev: r.j.rev }; }
    }
    if (r.status === 200) { patch({ rev: r.j.rev, base: mine, at: Date.now(), pend: null }); setStatus('ok'); return { rev: r.j.rev }; }
    return fail(r, 'push ' + reason);
  }
  function fail(r, what) {
    if (r.status === 401) { signedOutRemotely(); return { err: 'auth' }; }
    if (r.status === 400 && r.j && r.j.err === 'schema') { if (schemaErr !== r.j.path) { schemaErr = r.j.path; console.warn('[account] server refused a field:', r.j.path); } }
    const e = r.j && r.j.err || 'http_' + r.status; if (e !== lastErr) { lastErr = e; console.warn('[account]', what, e); }
    setStatus(r.status === 0 ? 'offline' : 'pending'); return { err: e };
  }
  /** Fetches the account: another device's progress comes in, then this device's unsent progress goes out. */
  async function pull() {
    const a = readAccount(); if (!a.tok) return { skipped: 'out' };
    const r = await call('GET', '/api/me');
    if (r.status !== 200) return fail(r, 'pull');
    let acc = readAccount();
    if (acc.pend) {       // a request sent while the page was closing: did it land?
      // same revision and same content: it landed; a later revision: most likely landed then another device wrote (counted once, not twice)
      const landed = r.j.rev > acc.pend.rev || (r.j.rev === acc.pend.rev && same(pick(r.j.profile || {}), acc.pend.profile));
      if (landed) patch({ base: acc.pend.profile, rev: acc.pend.rev, pend: null }); else patch({ pend: null });
      acc = readAccount();
    }
    if (r.j.rev !== acc.rev || !acc.base) {
      const merged = acc.base ? merge3(r.j.profile || {}, local(), acc.base) : mergeGuest(r.j.profile || {}, readSave());
      apply(merged, r.j.pseudo);
      patch({ rev: r.j.rev, base: pick(r.j.profile || {}), pseudo: r.j.pseudo });
      changed();
    }
    if (dirty()) return push('pull');
    setStatus('ok'); patch({ at: Date.now() }); return { rev: r.j.rev };
  }
  function syncNow(reason) {
    if (busy) return busy;
    busy = lock(() => (reason === 'boot' || reason === 'manual' || reason === 'visible' ? pull() : push(reason))).finally(() => { busy = null; });
    return busy;
  }

  /* ---------- sign-in, sign-out, export, delete (used by account-panel.js) ---------- */
  /** credential: Google's ID token. -> { ok } | { need: 'pseudo', ticket } | { err } */
  async function signInWithGoogle(credential) {
    const r = await call('POST', '/api/auth/google', { credential }, { noAuth: true });
    if (r.status !== 200) return { err: r.j.err || 'http_' + r.status, why: r.j.why, status: r.status };
    if (r.j.need === 'pseudo') return { need: 'pseudo', ticket: r.j.ticket };
    return finishSignIn(r.j);
  }
  async function finishSignIn(j) {
    const prev = readAccount(), sameOwner = prev.owner && prev.owner === String(j.pseudo).toLowerCase() && prev.base;
    writeAccount({ tok: j.tok, exp: j.exp, pseudo: j.pseudo, owner: String(j.pseudo).toLowerCase(), rev: j.rev || 0, base: null, at: 0 });
    setCaps();
    const me = await call('GET', '/api/me');
    if (me.status !== 200) { changed(); return { ok: true, synced: false }; }
    const server = me.j.profile || {};
    const merged = sameOwner ? merge3(server, readSave(), prev.base) : mergeGuest(server, readSave());
    merged.name = j.pseudo;
    apply(merged, j.pseudo);
    patch({ rev: me.j.rev, base: pick(server) });
    const r = await push('signin');
    changed();
    return { ok: true, synced: !r.err, merged };
  }
  async function checkPseudo(p) { const r = await call('GET', '/api/auth/pseudo?p=' + encodeURIComponent(p), undefined, { noAuth: true, timeout: 6000 }); return r.status === 200 ? r.j : { ok: null, why: r.j.err || 'network' }; }
  /** New account: the guest progress of this device becomes the account's (credits included). */
  async function createAccount(ticket, pseudo) {
    const profile = pick(readSave()); profile.name = pseudo;
    const r = await call('POST', '/api/auth/pseudo', { ticket, pseudo, profile }, { noAuth: true });
    if (r.status !== 201 && r.status !== 200) return { err: r.j.err || 'http_' + r.status, why: r.j.why, status: r.status };
    if (r.status === 200) return finishSignIn(r.j);       // the account existed already (another tab)
    writeAccount({ tok: r.j.tok, exp: r.j.exp, pseudo: r.j.pseudo, owner: String(r.j.pseudo).toLowerCase(), rev: r.j.rev, base: profile, at: Date.now() });
    setCaps(); apply(profile, r.j.pseudo);
    await push('created');       // the profile module fills defaults into the save (attachments, records...): sent at once, so nothing is left pending
    setStatus(dirty() ? 'pending' : 'ok'); changed();
    return { ok: true, created: true };
  }
  function resetDevice() {
    try { localStorage.removeItem(SAVE); localStorage.removeItem('frontzero.account'); } catch { /* storage unavailable */ }
    setCaps();
  }
  async function signOut() {
    await push('signout').catch(() => {});
    await call('POST', '/api/auth/logout', undefined, { timeout: 5000 }).catch(() => {});
    resetDevice(); changed();
    return { ok: true };
  }
  async function exportData() {
    const r = await call('GET', '/api/account/export');
    if (r.status !== 200) return fail(r, 'export');
    return { ok: true, data: r.j };
  }
  async function deleteAccount() {
    const r = await call('DELETE', '/api/account', undefined, { timeout: 15000 });
    if (r.status !== 200) return fail(r, 'delete');
    resetDevice(); changed();
    return { ok: true };
  }

  /* ---------- when ---------- */
  const off = [];
  try { off.push(profile.on(() => { if (readAccount().tok) setStatus(dirty() ? 'pending' : 'ok'); })); } catch { /* profile without events */ }
  if (engine && typeof engine.on === 'function') engine.on('matchEnd', () => { clearTimeout(timer); timer = setTimeout(() => { if (dirty()) syncNow('match'); }, 2000); });
  setInterval(() => { if (document.hidden || (engine && (engine.running || engine.loading))) return; if (dirty()) syncNow('timer'); }, PERIOD);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); if (dirty()) push('hide', true); }
    else if (hiddenAt && Date.now() - hiddenAt > PERIOD && readAccount().tok) syncNow('visible');
  });
  addEventListener('pagehide', () => { if (dirty()) push('pagehide', true); });
  if (readAccount().tok) setTimeout(() => syncNow('boot'), 1500);

  /** After sign-out or deletion: the save is wiped once more (nothing may have written it back meanwhile), then the page restarts as a guest. */
  function restart() { if (!readAccount().tok) { try { localStorage.removeItem(SAVE); } catch { /* storage unavailable */ } } location.reload(); }

  return { restart, syncNow, pull, push, signInWithGoogle, createAccount, checkPseudo, signOut, exportData, deleteAccount, dirty, call, get lastError() { return lastErr; } };
}
