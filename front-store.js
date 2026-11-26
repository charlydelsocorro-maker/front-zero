'use strict';
/* FRONT ZÉRO — persistence of the living front (front-war.js). One small interface, three kinds:
     const store = createStore({ kind, file, adapter });
     store.kind         'memory' | 'json-file' | 'external'
     store.durable      true when the state survives a restart of the process (json-file on a disk that is kept, external)
     await store.load() -> the last saved object, or null
     await store.save(obj)          (saves are serialised; a save asked while one runs is coalesced into the next one)
     store.flushSync(obj)           best effort, synchronous (process exit); external stores cannot, they return false
     await store.close()
   Choice at start (front-war.js): FZ_FRONT_STORE = memory | json-file | external (default json-file), FZ_FRONT_FILE = path of the JSON file
   (default: .front-state.json next to this file; a dot file, so the game server never serves it; with FZ_DATA_DIR set, the default is
   <FZ_DATA_DIR>/front-state.json, moved there once from the old file: migrateToDataDir below), FZ_FRONT_ADAPTER = module path for external.

   !! RENDER FREE: its disk is wiped at every restart, deploy and wake-up from sleep. There, json-file only lasts while the instance is
   awake. A public launch needs either a paid instance with a persistent disk (json-file on that disk) or an external database behind
   the adapter slot below. No dependency is added here and no account is created.

   ---------- Adapter slot (external database, chosen later) ----------
   FZ_FRONT_STORE=external FZ_FRONT_ADAPTER=/abs/path/my-adapter.js node server/server.js
   my-adapter.js exports either an object or a factory returning one:
     module.exports = (env) => ({
       name: 'my-db',                               // shown in the logs and in /api/front as store kind 'external'
       async load() { ... return obj or null },     // the whole front state, one JSON document (about 100 bytes per player)
       async save(obj) { ... },                     // replace that document; throw on failure (the store logs, keeps the state in memory and retries)
       async close() { ... },                       // optional
     });
   A key-value store, a document database or one row of a SQL table holding JSON all fit; Node 18+ has fetch built in, so an HTTP
   database needs no package. Secrets come from environment variables, never from the code. */

const fs = require('fs'), path = require('path');

function memoryStore() {
  let data = null;
  return {
    kind: 'memory', durable: false,
    async load() { return data ? JSON.parse(data) : null; },
    async save(obj) { data = JSON.stringify(obj); },
    flushSync(obj) { data = JSON.stringify(obj); return true; },
    async close() {},
  };
}

/** Atomic JSON file: write a temp file, fsync it, move the current file to .bak, rename the temp file over. load() falls back to .bak. */
function jsonFileStore(file) {
  const abs = path.resolve(file), bak = abs + '.bak';
  let seq = 0, running = null, pending = null;
  const tmpName = () => `${abs}.tmp-${process.pid}-${++seq}`;
  const renameRetry = (a, b) => {       // Windows: a virus scanner or an indexer can hold the file for a moment
    for (let i = 0; ; i++) {
      try { fs.renameSync(a, b); return; } catch (e) { if (i >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; const until = Date.now() + 20 * (i + 1); while (Date.now() < until) { /* short wait */ } }
    }
  };
  function writeSync(text) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = tmpName(), fd = fs.openSync(tmp, 'w');
    try { fs.writeSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try {
      if (fs.existsSync(abs)) { try { fs.rmSync(bak, { force: true }); } catch { /* old backup busy */ } renameRetry(abs, bak); }
      renameRetry(tmp, abs);
    } catch (e) { try { fs.rmSync(tmp, { force: true }); } catch { /* gone */ } throw e; }
  }
  const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return undefined; } };
  async function drain() {
    while (pending !== null) {
      const text = pending; pending = null;
      await new Promise(r => setImmediate(r));
      writeSync(text);
    }
  }
  return {
    kind: 'json-file', durable: true, file: abs,
    async load() {
      const a = fs.existsSync(abs) ? readJson(abs) : undefined;
      if (a && typeof a === 'object') return a;
      const b = fs.existsSync(bak) ? readJson(bak) : undefined;
      if (b && typeof b === 'object') { console.warn('[front] state file unreadable, using its backup'); return b; }
      return null;
    },
    save(obj) {
      pending = JSON.stringify(obj);
      if (!running) running = drain().finally(() => { running = null; });
      return running;
    },
    flushSync(obj) { try { pending = null; writeSync(JSON.stringify(obj)); return true; } catch (e) { console.error('[front] final save failed', e.message); return false; } },
    async close() { if (running) await running.catch(() => {}); },
  };
}

/** External database behind a small adapter (see the header). Every call has a time limit; a failure is thrown to the caller (front-war.js logs it and retries). */
function externalStore(adapter, timeoutMs = 8000) {
  if (!adapter || typeof adapter.load !== 'function' || typeof adapter.save !== 'function') throw new Error('front store adapter needs load() and save()');
  const limit = (p, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`front store ${what} timed out`)), timeoutMs).unref())]);
  let running = null, pending = null;
  async function drain() { while (pending !== null) { const o = pending; pending = null; await limit(Promise.resolve(adapter.save(o)), 'save'); } }
  return {
    kind: 'external', durable: true, name: String(adapter.name || 'external').slice(0, 40),
    async load() { const o = await limit(Promise.resolve(adapter.load()), 'load'); return o && typeof o === 'object' ? o : null; },
    save(obj) { pending = JSON.parse(JSON.stringify(obj)); if (!running) running = drain().finally(() => { running = null; }); return running; },
    flushSync() { return false; },
    async close() { if (running) await running.catch(() => {}); if (typeof adapter.close === 'function') await limit(Promise.resolve(adapter.close()), 'close').catch(() => {}); },
  };
}

/** opts: { kind, file, adapter } (each falls back to its environment variable). */
function createStore(opts = {}) {
  const env = process.env, kind = String(opts.kind || env.FZ_FRONT_STORE || 'json-file').toLowerCase();
  if (kind === 'memory') return memoryStore();
  if (kind === 'external') {
    let ad = opts.adapter;
    if (!ad) { const mod = env.FZ_FRONT_ADAPTER; if (!mod) throw new Error('FZ_FRONT_STORE=external needs FZ_FRONT_ADAPTER'); const m = require(path.resolve(mod)); ad = typeof m === 'function' ? m(env) : m; }
    return externalStore(ad);
  }
  if (kind !== 'json-file') throw new Error('unknown front store kind: ' + kind);
  const legacy = path.join(__dirname, '.front-state.json');
  return jsonFileStore(opts.file || env.FZ_FRONT_FILE || (env.FZ_DATA_DIR ? migrateToDataDir(path.join(path.resolve(String(env.FZ_DATA_DIR)), 'front-state.json'), legacy) : legacy));
}

/* FZ_DATA_DIR (the persistent disk, also used by the accounts: account-store.js) -> <FZ_DATA_DIR>/front-state.json.
   One-time move: when that file does not exist yet and the old one (.front-state.json next to this file, or its .bak) does, its content
   is copied there (temp file, fsync, rename) and the old file is renamed *.migrated, so the move never runs twice.
   If the copy fails, this run keeps the old path (nothing is lost) and the next start tries again. */
function migrateToDataDir(file, legacy) {
  try {
    if (fs.existsSync(file) || fs.existsSync(file + '.bak')) return file;
    const src = [legacy, legacy + '.bak'].find(f => { try { const o = JSON.parse(fs.readFileSync(f, 'utf8')); return !!o && typeof o === 'object'; } catch { return false; } });
    if (!src) return file;
    const text = fs.readFileSync(src, 'utf8');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}-migrate`, fd = fs.openSync(tmp, 'w');
    try { fs.writeSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file);
    for (const f of [legacy, legacy + '.bak']) { try { if (fs.existsSync(f)) fs.renameSync(f, f + '.migrated'); } catch { /* the copy is done; the old file just stays */ } }
    console.log(`[front] state moved to ${file} (from ${path.basename(src)})`);
    return file;
  } catch (e) {
    console.error('[front] could not move the state to FZ_DATA_DIR, keeping the old file this time:', e.message);
    return legacy;
  }
}

module.exports = { createStore, memoryStore, jsonFileStore, externalStore };
