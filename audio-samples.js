// FRONT ZÉRO recorded weapon sounds: real shots and weapon handling from the CC0 "Free Firearm Sound Library"
// (see sounds/LICENSE.txt), laid over the procedural engine in audio.js.
//
// audio.js loads this module lazily after unlock() and asks it first for every shot, reload stage and dry fire.
// Each lookup answers false until the files it needs are fetched and decoded, and audio.js then plays its own synthesis,
// so a missing module, manifest or file never silences a weapon. Nothing here needs a secure origin, and the sounds
// folder is found next to this module, wherever the game is served from.
//
// sounds/manifest.json maps game events to files:
//   events['shot:<weapon>']            {near, mid, far}  -> 'set/layer' in manifest.shots
//   events['reload:<stage>:<weapon>']  {from, rate}      -> 'family/stage' in manifest.handling
//   events['dry:<weapon>']             {from, rate}
// near = microphones next to the muzzle (the player's own shots), mid and far = the same weapon recorded from a distance
// (everyone else; audio.js still applies its distance filter, delay, pan and reverb sends on top).

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const DEFAULT_BASE = new URL('./sounds/', import.meta.url).href;
const FAST_LANE = 3;          // parallel downloads for weapons that are in use
const MAX_CHAINS = 48;
const BLEND_LO = .3, BLEND_HI = .7;   // audio.js "far" factor over which the mid recording hands over to the far one

export function createSampleBank(opts = {}) {
  const base = opts.base || DEFAULT_BASE;
  const fetchFn = opts.fetch || ((...a) => globalThis.fetch(...a));
  const report = typeof opts.report === 'function' ? opts.report : () => {};
  const idleFn = opts.idle || ((fn) => (typeof globalThis.requestIdleCallback === 'function' ? globalThis.requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 60)));

  let ctx = null, manifest = null, failed = false, active = 0, idleQueued = false, ownId = null, enabled = true, isSettled = false;
  const buffers = new Map();      // file -> AudioBuffer, or false when it could not be loaded
  const pending = new Set();
  const fast = [], slow = [];
  const lastTake = new Map();     // 'set/layer' or 'family/stage' -> index of the take played last
  const chains = new Map();       // voice-steal key -> voices of the last shot
  const primed = new Set();
  const plays = { shot: 0, sub: 0, handling: 0, dry: 0, stolen: 0 };
  let resolveSettled;
  const settled = new Promise((r) => { resolveSettled = r; });
  const settle = () => { if (!isSettled) { isSettled = true; resolveSettled(); } };

  const safe = (e) => { try { report(e); } catch { /* ignore */ } };

  // ---- loading -----------------------------------------------------------
  function decode(data) {
    return new Promise((resolve, reject) => {
      let p;
      try { p = ctx.decodeAudioData(data, resolve, reject); } catch (e) { reject(e); return; }
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
  }
  // MP3 decoders differ in how much encoder delay they leave at the start; cut to 2 ms before the first audible sample.
  function trim(buf) {
    const n = buf.length, sr = buf.sampleRate, chs = buf.numberOfChannels;
    let peak = 0;
    const data = [];
    for (let c = 0; c < chs; c++) { const d = buf.getChannelData(c); data.push(d); for (let i = 0; i < n; i++) { const v = d[i] < 0 ? -d[i] : d[i]; if (v > peak) peak = v; } }
    if (!(peak > 1e-5)) return null;
    const thr = Math.max(peak * .012, 1e-4);
    let first = n;
    for (let c = 0; c < chs; c++) { const d = data[c]; for (let i = 0; i < first; i++) if (d[i] > thr || d[i] < -thr) { first = i; break; } }
    const start = Math.max(0, first - Math.round(.002 * sr));
    if (start < Math.round(.0015 * sr) || n - start < 64) return buf;
    const out = ctx.createBuffer(chs, n - start, sr), ramp = Math.min(48, n - start);
    for (let c = 0; c < chs; c++) {
      const o = out.getChannelData(c);
      o.set(data[c].subarray(start));
      for (let i = 0; i < ramp; i++) o[i] *= i / ramp;
    }
    return out;
  }
  function load(file) {
    if (buffers.has(file) || pending.has(file)) return false;
    pending.add(file); active++;
    Promise.resolve()
      .then(() => fetchFn(base + file))
      .then((r) => { if (!r || !r.ok) throw new Error('sample ' + file + ': HTTP ' + (r ? r.status : 'error')); return r.arrayBuffer(); })
      .then(decode)
      .then((buf) => { const t = trim(buf); if (!t) throw new Error('sample ' + file + ': silent'); buffers.set(file, t); })
      .catch((e) => { buffers.set(file, false); safe(e); })
      .then(() => { pending.delete(file); active--; pump(); });
    return true;
  }
  function pump() {
    while (active < FAST_LANE && fast.length) load(fast.shift());
    if (fast.length || active) return;
    if (!slow.length) { settle(); return; }
    if (idleQueued) return;
    idleQueued = true;
    idleFn(() => {
      idleQueued = false;
      while (slow.length && !load(slow.shift())) { /* already there */ }
      pump();
    });
  }
  const entries = (ref, table) => { if (!ref) return null; const i = ref.indexOf('/'), g = table[ref.slice(0, i)]; return (g && g[ref.slice(i + 1)]) || null; };
  // Every file a weapon can need, the ones heard first (own shot, handling) in front.
  function filesOf(id) {
    const out = [], ev = manifest.events, shot = ev['shot:' + id];
    const add = (list) => { if (list) for (const e of list) if (!out.includes(e[0])) out.push(e[0]); };
    if (shot) add(entries(shot.near, manifest.shots));
    const tail = ':' + id;
    for (const k of Object.keys(ev)) if (k.endsWith(tail) && k !== 'shot:' + id) add(entries(ev[k].from, manifest.handling));
    if (shot) { add(entries(shot.mid, manifest.shots)); add(entries(shot.far, manifest.shots)); }
    return out;
  }
  // Moves a weapon's files to the front of the queue. Safe to call with unknown ids or before the manifest is there.
  function prime(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    for (const id of list) if (typeof id === 'string') primed.add(id);
    if (!manifest) return;
    const want = [];
    for (const id of list) if (typeof id === 'string' && manifest.weapons[id]) for (const f of filesOf(id)) if (!buffers.has(f) && !pending.has(f) && !want.includes(f)) want.push(f);
    if (!want.length) return;
    for (let i = fast.length - 1; i >= 0; i--) if (want.includes(fast[i])) fast.splice(i, 1);
    fast.unshift(...want);
    pump();
  }
  function begin(m) {
    if (!m || typeof m !== 'object' || !m.events || !m.shots || !m.handling || !m.weapons) throw new Error('sample manifest: unexpected shape');
    m.mix = Object.assign({ near: 1, mid: 1, far: 1, handling: 1, dry: 1, sub: 1 }, m.mix);
    m.targets = Object.assign({ near: -23, mid: -22, far: -25, handling: -30 }, m.targets);
    manifest = m;
    const first = [...primed, ...(Array.isArray(m.priority) ? m.priority : [])];
    for (const id of first) if (m.weapons[id]) for (const f of filesOf(id)) if (!fast.includes(f)) fast.push(f);
    for (const id of Object.keys(m.weapons)) for (const f of filesOf(id)) if (!fast.includes(f) && !slow.includes(f)) slow.push(f);
    pump();
  }
  function attach(context) {
    if (ctx || !context) return api;
    ctx = context;
    Promise.resolve()
      .then(() => fetchFn(base + 'manifest.json'))
      .then((r) => { if (!r || !r.ok) throw new Error('sample manifest: HTTP ' + (r ? r.status : 'error')); return r.json(); })
      .then(begin)
      .catch((e) => { failed = true; safe(e); settle(); });
    return api;
  }

  // ---- lookup ------------------------------------------------------------
  // A decoded take of the list, never the one played last when there is a choice. Returns [entry, how many were ready].
  function take(ref, list) {
    let ready = 0, n = 0, chosen = -1;
    const last = lastTake.get(ref);
    for (let i = 0; i < list.length; i++) if (buffers.get(list[i][0])) ready++;
    if (!ready) return null;
    for (let i = 0; i < list.length; i++) {
      if (!buffers.get(list[i][0]) || (ready > 1 && i === last)) continue;
      n++;
      if (Math.random() * n < 1) chosen = i;
    }
    lastTake.set(ref, chosen);
    return [list[chosen], ready];
  }
  const level = (lufs, target) => clamp(Math.pow(10, (target - (Number.isFinite(lufs) ? lufs : target)) / 20), .7, 2);
  // One layer ('near' | 'mid' | 'far') of a weapon's shot, or null while it is not decoded.
  function layer(id, want) {
    const ev = manifest.events['shot:' + id], w = manifest.weapons[id];
    const ref = ev[want], list = entries(ref, manifest.shots);
    if (!list) return null;
    const t = take(ref, list);
    if (!t) return null;
    const kind = ref.slice(ref.indexOf('/') + 1);                       // what the recording really is (a missing far falls back to mid)
    const few = t[1] < 3 ? .012 : 0;                                    // sets with one or two takes get a little more pitch movement
    return {
      buffer: buffers.get(t[0][0]), layer: kind, ref,
      rate: ((ev.rates && ev.rates[want]) || w.rate || 1) * (1 + rand(-few, few)),
      gain: (manifest.mix[kind] || 1) * (w.gain || 1) * level(t[0][1], manifest.targets[kind]) * rand(.9, 1),
      sub: want === 'near' ? (w.sub || 0) * manifest.mix.sub : 0,
      rel: clamp(w.rel || .08, .02, .4), lp: w.lp > 0 ? w.lp : 0,
    };
  }
  // The recordings to play for one shot: the near take for the player, mid and/or far for everyone else.
  // Returns null when the weapon has no recording or nothing usable is decoded yet (the caller then synthesizes).
  function shot(id, own, far = 0) {
    if (!manifest || !enabled || typeof id !== 'string') return null;
    if (!manifest.events['shot:' + id] || !manifest.weapons[id]) return null;
    const out = [];
    if (own) { const a = layer(id, 'near'); if (a) out.push(a); }
    else {
      const k = clamp((far - BLEND_LO) / (BLEND_HI - BLEND_LO), 0, 1);
      const a = k < 1 ? layer(id, 'mid') : null, b = k > 0 ? layer(id, 'far') : null;
      if (a && b && a.ref !== b.ref) { a.gain *= Math.cos(k * Math.PI / 2); b.gain *= Math.sin(k * Math.PI / 2); out.push(a, b); }
      else if (a || b) out.push(a || b);
      else { const c = layer(id, k < .5 ? 'far' : 'mid') || layer(id, 'near'); if (c) out.push(c); }
    }
    if (!out.length) { prime(id); return null; }
    return out;
  }
  function handling(id, stage) {
    if (!manifest || !enabled) return null;
    const wid = typeof id === 'string' ? id : ownId;                     // a named weapon is never replaced by another one
    if (!wid || !manifest.weapons[wid]) return null;
    const ev = manifest.events[stage === 'dry' ? 'dry:' + wid : 'reload:' + stage + ':' + wid];
    if (!ev) return null;
    const list = entries(ev.from, manifest.handling);
    const t = list && take(ev.from, list);
    if (!t) { prime(wid); return null; }
    return { buffer: buffers.get(t[0][0]), rate: ev.rate || 1, gain: manifest.mix[stage === 'dry' ? 'dry' : 'handling'] * (ev.gain || 1) * level(t[0][1], manifest.targets.handling) * rand(.9, 1) };
  }

  // ---- playback through audio.js -------------------------------------------
  // A new shot of the same weapon from the same place fades the previous one out quickly, so automatic fire stays a row of
  // distinct reports instead of a smear of overlapping tails; the last shot of a burst rings out in full.
  function release(v, when, rel) {
    if (!v || !(v.end > when)) return;
    try {
      const t = Math.max(when, ctx.currentTime), fade = (p, from) => { p.setValueAtTime(from, t); p.linearRampToValueAtTime(0, t + rel); };
      fade(v.g.gain, v.gain);
      // reverb and echo sends are taken before the voice gain: fade them too, or the cut would click into the reverb
      if (v.nodes) for (const n of v.nodes) if (n !== v.g && n.gain && typeof n.gain.setValueAtTime === 'function' && !n.frequency) fade(n.gain, n.gain.value);
      v.src.stop(t + rel + .012);
      v.end = Math.min(v.end, t + rel + .02);
      plays.stolen++;
    } catch (e) { safe(e); }
  }
  function chain(key, voices, when, rel) {
    const prev = chains.get(key);
    if (prev) for (const v of prev) release(v, when, rel);
    chains.set(key, voices);
    if (chains.size > MAX_CHAINS) { const now = ctx.currentTime; for (const [k, list] of chains) if (list.every((v) => v.end <= now)) chains.delete(k); }
  }
  // play = audio.js play(category, buffer, options). s = its spatial() result for other actors, null for the player's own shot.
  // Returns true when recordings were started (or would have been: the voice was inaudible), false to ask for the synthesis.
  function fire(play, cat, id, s, opt, now, pos) {
    const own = !s;
    if (own && typeof id === 'string') ownId = id;
    const list = shot(id, own, s ? s.far : 0);
    if (!list) return false;
    const when = Math.max(now, Number.isFinite(opt.when) ? opt.when : now), voices = [];
    let rel = .08;
    for (const sm of list) {
      const o = Object.assign({}, opt, { gain: opt.gain * sm.gain, rate: opt.rate * sm.rate });
      if (sm.lp) o.lp = Math.min(o.lp > 0 ? o.lp : 20000, sm.lp);
      if (sm.layer !== 'near' && o.send) o.send *= .75;      // distant takes already carry their own outdoor tail
      const v = play(cat, sm.buffer, o);
      rel = sm.rel;
      if (!v) continue;
      voices.push(v); plays.shot++;
      if (sm.sub > 0) {       // weight for the big calibres: the same take an octave down, low-passed, dry
        const u = play(cat, sm.buffer, Object.assign({}, o, { gain: o.gain * sm.sub, rate: o.rate * .5, lp: 240, send: 0, echo: 0 }));
        if (u) { voices.push(u); plays.sub++; }
      }
    }
    if (voices.length) chain(own ? 'own:' + id : id + ':' + (pos && Number.isFinite(pos.x) && Number.isFinite(pos.z) ? Math.round(pos.x / 5) + ':' + Math.round(pos.z / 5) : 'far'), voices, when, rel);
    return true;
  }
  // Reload stage or dry fire ('dry') of weapon id (the weapon the player fired last when id is not given).
  function hand(play, id, stage, opt) {
    const sm = handling(id, stage);
    if (!sm) return false;
    if (play('reload', sm.buffer, Object.assign({}, opt, { gain: opt.gain * sm.gain, rate: opt.rate * sm.rate }))) plays[stage === 'dry' ? 'dry' : 'handling']++;
    return true;
  }

  const api = {
    attach, prime, shot, handling, fire, hand,
    // The weapon the player holds; reload and dry-fire calls that do not name a weapon use it.
    own(id) { if (typeof id === 'string') { ownId = id; prime(id); } },
    setEnabled(on) { enabled = !!on; },
    // Resolves once every file has either loaded or failed (also when the manifest itself is missing).
    settled,
    stats() {
      let loaded = 0, bad = 0;
      for (const b of buffers.values()) if (b) loaded++; else bad++;
      return { manifest: !!manifest, failed, loaded, bad, pending: pending.size, queued: fast.length + slow.length, settled: isSettled, own: ownId, enabled, plays: Object.assign({}, plays) };
    },
    // true when the buffer is one of the decoded recordings (tests use it to tell recordings from synthesis)
    owns(buffer) { for (const b of buffers.values()) if (b === buffer) return true; return false; },
    manifest: () => manifest,
  };
  return api;
}
