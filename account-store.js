'use strict';
/* FRONT ZÉRO — player accounts on disk (server). No package.
   Where: FZ_DATA_DIR when set (Render: the persistent disk, /var/data), else <game>/.data for local work (a dot folder: never served
   by the game server, never copied by the public build). A copy of the game inside a frozen folder (rc*, play) uses the system temp
   folder instead, so a frozen version is never written to.
     <dir>/salt.key              32 random bytes (hex), made once. The Google account id is kept only as HMAC-SHA256(salt, sub).
     <dir>/accounts/<id>.json    one file per account; <id> = 32 hex chars made here (never from a request).
   Why one file per account: a sync rewrites only that player's few kilobytes (one big file would rewrite every player at each sync),
   a damaged file costs one account, deleting an account deletes its file. Each write: temp file, fsync, rename over (atomic on the same
   disk), then fsync of the folder where the system allows it. Writes are async (libuv thread pool) so the game loop never waits on the disk;
   writes of one account are serialised and coalesced (the latest version wins); a last synchronous flush runs at process exit.
   Record: { v:1, id, sub (salted hash), pseudo, created, updated, seen, rev, profile, sessions:[{h, c, u, e, r?}] }.
   Never stored: email, name, picture, the raw Google id, raw session tokens (only their SHA-256).
   Sessions: 32 random bytes (base64url) given to the client once; 90 days; a session used more than 7 days after it was made is
   replaced by a new one (the old one keeps working 60 s for requests already on their way); at most 8 per account.
   Memory: the indexes (Google hash, pseudo, session hashes) for every account, full records only for the last 256 used. */

const fs = require('fs'), fsp = fs.promises, path = require('path'), crypto = require('crypto'), os = require('os');

const DAY = 864e5;
const T = { session: 90 * DAY, rotateAfter: 7 * DAY, grace: 60e3, touch: 6 * 36e5, ticket: 10 * 60e3, inactive: 3 * 365 * DAY };
const MAX_SESSIONS = 8, CACHE = 256;
const ID_RE = /^[a-f0-9]{32}$/, TOKEN_RE = /^[A-Za-z0-9_-]{43}$/, HEX64 = /^[a-f0-9]{64}$/;

/* ---------- where ---------- */
function dataDir(env = process.env) {
  if (env.FZ_DATA_DIR) return path.resolve(String(env.FZ_DATA_DIR));
  const here = path.resolve(__dirname);
  if (here.split(path.sep).some(s => /^(rc[\d.]*|play|play-prev)$/i.test(s))) return path.join(os.tmpdir(), 'front-zero-data-' + path.basename(here));
  return path.join(here, '.data');
}

/* ---------- pseudo rules ---------- */
const PSEUDO_RE = /^[A-Za-z0-9_-]{3,16}$/;
const RESERVED = new Set(['admin', 'administrateur', 'administrator', 'moderateur', 'moderator', 'modo', 'mod', 'support', 'staff', 'system', 'systeme', 'serveur', 'server',
  'frontzero', 'front-zero', 'front_zero', 'soldat', 'soldier', 'bot', 'bots', 'google', 'officiel', 'official', 'equipe', 'team', 'root', 'null', 'undefined', 'anonyme', 'anonymous', 'invite', 'guest']);
// Insults, slurs and hate, French and English, after normalisation (lower case, common digit swaps, repeated letters collapsed).
// Long words are looked for anywhere in the pseudo; short ones only as a whole part (split on _ and -) or as the whole pseudo,
// so that "Technique", "Computer" or "Scunthorpe" stay allowed.
const BLOCK_ANY = ['conard', 'conase', 'salope', 'salaud', 'encule', 'batard', 'merde', 'putain', 'enfoire', 'couile', 'tapete', 'gouine', 'negre', 'bougnoul', 'youpin',
  'branleur', 'pouf', 'tamere', 'fuck', 'bitch', 'bastard', 'ashole', 'whore', 'niger', 'niga', 'fagot', 'hitler', 'pusy', 'porn', 'shit', 'motherf', 'nazis'];
const BLOCK_PART = ['pute', 'pd', 'pede', 'fdp', 'ntm', 'tg', 'nique', 'con', 'cone', 'bite', 'cul', 'suce', 'suceur', 'cunt', 'slut', 'fag', 'dick', 'cock', 'retard', 'rape', 'nazi', 'kk', 'sex', 'anus', 'tepu', 'chienasse'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's' };
const normWord = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[0134578@$9]/g, c => LEET[c]).replace(/(.)\1+/g, '$1');
/** null when the pseudo is fine, else 'format' | 'reserved' | 'blocked'. */
function checkPseudo(p) {
  if (typeof p !== 'string' || !PSEUDO_RE.test(p)) return 'format';
  const low = p.toLowerCase();
  if (RESERVED.has(low) || RESERVED.has(low.replace(/[_-]/g, ''))) return 'reserved';
  const parts = low.split(/[_-]+/).filter(Boolean).map(normWord), whole = normWord(low.replace(/[_-]+/g, ''));
  if (BLOCK_ANY.some(w => whole.includes(w))) return 'blocked';
  if (BLOCK_PART.some(w => whole === w || parts.includes(w))) return 'blocked';
  return null;
}
const pseudoKey = p => String(p).toLowerCase();

/* ---------- atomic files ---------- */
let seq = 0;
const tmpOf = f => `${f}.tmp-${process.pid}-${(++seq).toString(36)}`;
function fsyncDirSync(dir) { try { const fd = fs.openSync(dir, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } } catch { /* not possible on every system (Windows) */ } }
function renameRetrySync(a, b) {       // Windows: an indexer or a virus scanner can hold the file for a moment
  for (let i = 0; ; i++) { try { fs.renameSync(a, b); return; } catch (e) { if (i >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; const until = Date.now() + 20 * (i + 1); while (Date.now() < until) { /* short wait */ } } }
}
async function renameRetry(a, b) {
  for (let i = 0; ; i++) { try { await fsp.rename(a, b); return; } catch (e) { if (i >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; await new Promise(r => setTimeout(r, 20 * (i + 1))); } }
}
function writeAtomicSync(file, text) {
  const tmp = tmpOf(file), fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { renameRetrySync(tmp, file); } catch (e) { try { fs.rmSync(tmp, { force: true }); } catch { /* gone */ } throw e; }
  fsyncDirSync(path.dirname(file));
}
async function writeAtomic(file, text) {
  const tmp = tmpOf(file), fh = await fsp.open(tmp, 'w', 0o600);
  try { await fh.writeFile(text); await fh.sync(); } finally { await fh.close(); }
  try { await renameRetry(tmp, file); } catch (e) { await fsp.rm(tmp, { force: true }).catch(() => {}); throw e; }
  fsyncDirSync(path.dirname(file));
}

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/* ---------- the store ---------- */
const EXITS = new Set(); let exitHooked = false;
function hookExit() { if (exitHooked) return; exitHooked = true; const run = () => { for (const f of EXITS) { try { f(); } catch { /* best effort */ } } }; process.on('exit', run); }

function createAccountStore({ dir = dataDir(), now = Date.now, timing = null } = {}) {
  const TT = { ...T, ...(timing || null) };
  const root = path.resolve(dir), accDir = path.join(root, 'accounts');
  const fileOf = id => { if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('bad account id'); const f = path.join(accDir, id + '.json'); if (path.dirname(f) !== accDir) throw new Error('bad account id'); return f; };
  // Nothing is written until the first real sign-in: a server without sign-in (local work, other tests) leaves no folder behind.
  const accFiles = () => (fs.existsSync(accDir) ? fs.readdirSync(accDir) : []);
  // Salt. Made once; if accounts exist without it, refuse to start (a new salt would orphan every account).
  const saltFile = path.join(root, 'salt.key');
  let salt = null;
  if (fs.existsSync(saltFile)) { salt = fs.readFileSync(saltFile, 'utf8').trim(); if (!HEX64.test(salt)) throw new Error('accounts: salt.key is damaged'); }
  else if (accFiles().some(f => f.endsWith('.json'))) throw new Error('accounts: salt.key is missing while accounts exist; restore it from a backup');
  function ensure() {
    fs.mkdirSync(accDir, { recursive: true, mode: 0o700 });
    if (!salt) { salt = crypto.randomBytes(32).toString('hex'); writeAtomicSync(saltFile, salt + '\n'); }
  }
  const subHash = sub => { if (!salt) ensure(); return crypto.createHmac('sha256', Buffer.from(salt, 'hex')).update('google:' + String(sub)).digest('hex'); };

  // Indexes, rebuilt from the files at start.
  const meta = new Map();       // id -> { sub, pk, seen, ses: [{h, e}] }
  const bySub = new Map(), byPseudo = new Map(), bySession = new Map();
  const cache = new Map();      // id -> record (LRU)
  const pending = new Map(), writing = new Map(), gone = new Set();
  const index = rec => {
    const m = { sub: rec.sub, pk: pseudoKey(rec.pseudo), pseudo: rec.pseudo, seen: rec.seen || rec.updated || rec.created, ses: rec.sessions.map(s => ({ h: s.h, e: s.r ? Math.min(s.e, s.r) : s.e })) };
    const old = meta.get(rec.id); if (old) for (const s of old.ses) if (bySession.get(s.h) === rec.id) bySession.delete(s.h);
    meta.set(rec.id, m); bySub.set(m.sub, rec.id); byPseudo.set(m.pk, rec.id); for (const s of m.ses) bySession.set(s.h, rec.id);
  };
  const unindex = id => { const m = meta.get(id); if (!m) return; meta.delete(id); if (bySub.get(m.sub) === id) bySub.delete(m.sub); if (byPseudo.get(m.pk) === id) byPseudo.delete(m.pk); for (const s of m.ses) if (bySession.get(s.h) === id) bySession.delete(s.h); };
  const okRecord = r => isObj(r) && r.v === 1 && typeof r.id === 'string' && ID_RE.test(r.id) && typeof r.sub === 'string' && HEX64.test(r.sub) && typeof r.pseudo === 'string' && PSEUDO_RE.test(r.pseudo)
    && Number.isInteger(r.rev) && r.rev >= 0 && Array.isArray(r.sessions) && r.sessions.every(s => isObj(s) && HEX64.test(s.h) && Number.isFinite(s.e) && Number.isFinite(s.c)) && (r.profile === null || isObj(r.profile));
  let bad = 0;
  for (const f of accFiles()) {
    if (/\.tmp-/.test(f)) { try { fs.rmSync(path.join(accDir, f), { force: true }); } catch { /* left for next start */ } continue; }       // a write cut by a crash: the previous file is intact
    const m = /^([a-f0-9]{32})\.json$/.exec(f); if (!m) continue;
    let rec = null; try { rec = JSON.parse(fs.readFileSync(path.join(accDir, f), 'utf8')); } catch { rec = null; }
    if (!okRecord(rec) || rec.id !== m[1]) { bad++; continue; }
    index(rec);
  }
  if (bad) console.error(`[accounts] ${bad} account file(s) unreadable, left in place and ignored`);

  function touchCache(id, rec) {
    cache.delete(id); cache.set(id, rec);
    if (cache.size <= CACHE) return;
    for (const k of cache.keys()) { if (cache.size <= CACHE) break; if (k !== id && !pending.has(k) && !writing.has(k)) cache.delete(k); }       // records still being written stay
  }
  function get(id) {
    if (typeof id !== 'string' || !ID_RE.test(id) || !meta.has(id) || gone.has(id)) return null;
    let rec = pending.get(id) || cache.get(id);
    if (!rec) { try { rec = JSON.parse(fs.readFileSync(fileOf(id), 'utf8')); } catch { return null; } if (!okRecord(rec) || rec.id !== id) return null; }
    touchCache(id, rec); return rec;
  }

  /** Saves this record (latest version wins). Resolves when that version is on disk. */
  function persist(rec) {
    index(rec); touchCache(rec.id, rec);
    pending.set(rec.id, rec);
    if (!writing.has(rec.id)) writing.set(rec.id, drain(rec.id));
    const p = writing.get(rec.id); return p;
  }
  async function drain(id) {
    try {
      while (pending.has(id)) {
        const rec = pending.get(id); pending.delete(id);
        if (gone.has(id)) break;
        try { await writeAtomic(fileOf(id), JSON.stringify(rec)); }
        catch (e) { console.error('[accounts] write failed, retrying:', e.message); if (!pending.has(id)) pending.set(id, rec); await new Promise(r => setTimeout(r, 2000)); }
      }
    } finally {
      writing.delete(id);
      if (gone.has(id)) { try { fs.rmSync(fileOf(id), { force: true }); } catch { /* removed already */ } }
    }
  }
  function flushSync() {
    for (const [id, rec] of pending) { if (gone.has(id)) continue; try { writeAtomicSync(fileOf(id), JSON.stringify(rec)); pending.delete(id); } catch (e) { console.error('[accounts] final write failed', id, e.message); } }
  }
  hookExit(); const exitFn = () => flushSync(); EXITS.add(exitFn);

  /* ---------- sessions ---------- */
  function addSession(rec, t) {
    const tok = crypto.randomBytes(32).toString('base64url'), h = sha256(tok), e = t + TT.session;
    rec.sessions.push({ h, c: t, u: t, e });
    rec.sessions.sort((a, b) => b.c - a.c); rec.sessions = rec.sessions.filter(s => s.e > t && !(s.r && s.r <= t)).slice(0, MAX_SESSIONS);
    return { tok, exp: e };
  }
  /** Looks a token up without changing anything (WebSocket). -> { id, pseudo } or null */
  function peekSession(tok) {
    if (typeof tok !== 'string' || !TOKEN_RE.test(tok)) return null;
    const h = sha256(tok), id = bySession.get(h); if (!id) return null;
    const m = meta.get(id), s = m && m.ses.find(x => x.h === h), t = now();
    if (!s || s.e <= t) return null;
    return { id, pseudo: m.pseudo };
  }
  /** A request's token: -> { id, rec, rotated: {tok, exp} | null } or null. Rotates sessions older than 7 days. */
  function useSession(tok, opts) {
    const mayRotate = !(opts && opts.rotate === false);
    if (typeof tok !== 'string' || !TOKEN_RE.test(tok)) return null;
    const h = sha256(tok), id = bySession.get(h); if (!id) return null;
    const rec = get(id); if (!rec) { bySession.delete(h); return null; }
    const t = now(), s = rec.sessions.find(x => x.h === h);
    if (!s || s.e <= t || (s.r && s.r <= t)) { if (s) { rec.sessions = rec.sessions.filter(x => x !== s); persist(rec); } else bySession.delete(h); return null; }
    let rotated = null, dirty = false;
    if (mayRotate && !s.r && t - s.c > TT.rotateAfter) { rotated = addSession(rec, t); s.r = t + TT.grace; if (!rec.sessions.includes(s)) rec.sessions.push(s); dirty = true; }
    if (t - (s.u || 0) > TT.touch) { s.u = t; rec.seen = t; dirty = true; }
    if (dirty) persist(rec);
    return { id, rec, rotated };
  }
  function revokeSession(tok) {
    if (typeof tok !== 'string' || !TOKEN_RE.test(tok)) return false;
    const h = sha256(tok), id = bySession.get(h), rec = id && get(id); if (!rec) return false;
    rec.sessions = rec.sessions.filter(s => s.h !== h); bySession.delete(h); persist(rec); return true;
  }

  /* ---------- accounts ---------- */
  /** sh: subHash(sub) (the raw Google id is never passed around longer than needed). */
  function create({ sh, pseudo, profile }) {
    const t = now();
    if (typeof sh !== 'string' || !HEX64.test(sh)) return { err: 'sub' };
    if (bySub.has(sh)) return { err: 'exists' };
    const why = checkPseudo(pseudo); if (why) return { err: why };
    if (byPseudo.has(pseudoKey(pseudo))) return { err: 'taken' };
    let id; do id = crypto.randomBytes(16).toString('hex'); while (meta.has(id) || gone.has(id));
    ensure();
    const rec = { v: 1, id, sub: sh, pseudo, created: t, updated: t, seen: t, rev: profile ? 1 : 0, profile: profile || null, sessions: [] };
    const session = addSession(rec, t);
    return { rec, session, saved: persist(rec) };
  }
  function signIn(sh) {
    const id = bySub.get(sh), rec = id && get(id); if (!rec) return null;
    const t = now(), session = addSession(rec, t); rec.seen = t;
    return { rec, session, saved: persist(rec) };
  }
  /** Optimistic write: base must be the revision the client started from. */
  function saveProfile(id, profile, base) {
    const rec = get(id); if (!rec) return null;
    if (base !== rec.rev) return { conflict: true, rev: rec.rev, profile: rec.profile };
    const t = now(); rec.profile = profile; rec.rev += 1; rec.updated = t; rec.seen = t;
    return { ok: true, rev: rec.rev, updated: t, saved: persist(rec) };
  }
  /** Deletes the account file and every session of it. Resolves when the file is gone. */
  async function remove(id) {
    if (typeof id !== 'string' || !ID_RE.test(id) || !meta.has(id)) return false;
    gone.add(id); unindex(id); pending.delete(id); cache.delete(id);
    const w = writing.get(id); if (w) await w.catch(() => {});
    await fsp.rm(fileOf(id), { force: true });
    fsyncDirSync(accDir);
    return true;
  }
  /** Daily upkeep: expired sessions out, accounts unused for 3 years deleted. */
  async function purge() {
    const t = now(); let sessions = 0, accounts = 0;
    for (const [id, m] of [...meta]) {
      if (t - (m.seen || 0) > TT.inactive) { await remove(id); accounts++; continue; }
      if (m.ses.some(s => s.e <= t)) { const rec = get(id); if (!rec) continue; const before = rec.sessions.length; rec.sessions = rec.sessions.filter(s => s.e > t && !(s.r && s.r <= t)); sessions += before - rec.sessions.length; persist(rec); }
    }
    if (sessions || accounts) console.log(`[accounts] upkeep: ${sessions} expired session(s), ${accounts} inactive account(s) removed`);
    return { sessions, accounts };
  }
  async function close() { for (const p of [...writing.values()]) await p.catch(() => {}); flushSync(); EXITS.delete(exitFn); }

  return {
    dir: root, get size() { return meta.size; }, subHash, checkPseudo,
    findBySub: sh => bySub.get(sh) || null,
    pseudoTaken: p => typeof p === 'string' && byPseudo.has(pseudoKey(p)),
    get, create, signIn, saveProfile, remove, purge, peekSession, useSession, revokeSession, flushSync, close,
    get pendingWrites() { return pending.size + writing.size; },
  };
}

module.exports = { createAccountStore, dataDir, checkPseudo, pseudoKey, writeAtomic, writeAtomicSync, PSEUDO_RE, ID_RE, TOKEN_RE, T };
