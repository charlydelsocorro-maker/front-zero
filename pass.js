// FRONT ZÉRO — season pass runtime: registers the pass items in the shop's catalogue, measures each match from engine events, keeps the save,
// claims rewards and buys the officer's commission with credits. The screen is pass-ui.js (loaded on demand); the end-of-match block lives here.
// Installed by main.js after the menu. Every hook is guarded: a failure here never touches a match. Nothing runs per frame.
// LOCAL SAVE, CHEATABLE until server accounts exist (see the dev notes). No payment code, provider, link or real-money button: credits only.
import { TEST_UNLOCK_ALL, WEAPONS } from './data.js';
import * as COS from './cosmetics.js';
import * as PS from './pass-season.js';

const KEY = 'frontzero.pass', PASS_LOCK = 'frontzero-pass', SHOP_LOCK = 'frontzero-shop';
const lockOf = name => fn => (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request ? navigator.locks.request(name, fn) : Promise.resolve().then(fn));
const inPass = lockOf(PASS_LOCK), inShop = lockOf(SHOP_LOCK);       // always pass then shop: the ledger never takes the pass lock, so no deadlock

/* ---------- catalogue: pass finishes join the shop's list as "not sold" items (cosmetics.js registerFinishes) ---------- */
let finIds = [];
try { finIds = COS.registerFinishes(PS.PASS_FINISHES); } catch (e) { console.warn('[pass] finishes', e); }
export const finishesRegistered = () => PS.PASS_FINISHES.every(f => typeof COS.finishById === 'function' && !!COS.finishById(f.id));

const MODE_KEY = { ffa: 'mode.deathmatch', tdm: 'mode.teams', dom: 'mode.domination', bomb: 'mode.bomb', zombie: 'mode.zombies', zone: 'mode.zone' };
const CAT = new Map(WEAPONS.map(w => [w.id, w.cat]));
const CSS = `
.fzp-end{--e:#e8692c;--e2:#f2a04a;--ln:rgba(201,185,143,.2);display:grid;gap:7px;margin-top:10px;padding:11px 14px 12px;background:linear-gradient(100deg,rgba(232,105,44,.1),rgba(24,20,16,.86) 46%);border:1px solid var(--ln);border-left:3px solid var(--e);color:#d8c9a3;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;text-align:left;min-width:0}
.fzp-end[hidden]{display:none}
.fzm-end .fzp-end{width:min(100%,640px);margin-top:0}
.fzp-end-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 14px}
.fzp-end-k{font-size:14px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#bfae8a}
.fzp-end-gain{font-size:clamp(22px,2.2vw,28px);font-weight:800;color:var(--e2);font-variant-numeric:tabular-nums}
.fzp-end-line{display:flex;justify-content:space-between;gap:10px;font-size:16px;font-weight:600;font-variant-numeric:tabular-nums}
.fzp-end-bar{height:6px;background:rgba(201,185,143,.16);overflow:hidden}.fzp-end-bar i{display:block;height:100%;background:linear-gradient(90deg,#b8452a,var(--e),var(--e2))}
.fzp-end-parts{display:flex;flex-wrap:wrap;gap:2px 12px;margin:0;padding:0;list-style:none;font-size:14.5px;color:#a9a28b}.fzp-end-parts b{color:#f4ecd8;font-weight:700}
.fzp-end-done{display:grid;gap:3px;margin:0;padding:0;list-style:none;font-size:15.5px;color:#f4ecd8}.fzp-end-done li::before{content:"✓ ";color:#8fc46a;font-weight:800}.fzp-end-done span{color:var(--e2);font-weight:700;font-variant-numeric:tabular-nums}
.fzp-end-up{font-size:17px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8fc46a}
.fzp-end-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px;font-size:16px;font-weight:600;color:var(--e2)}
.fzp-end-btn{min-height:40px;padding:0 14px;font:inherit;font-size:16px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#f4ecd8;background:rgba(232,105,44,.16);border:1px solid var(--e);cursor:pointer}.fzp-end-btn:hover{background:rgba(232,105,44,.3)}
.fzp-end-note{font-size:14.5px;color:#a9a28b}
`;
let api = null, readyResolve = null;
const ready = new Promise(r => { readyResolve = r; });

/** deps: { engine, profile, i18n, net?, audio?, menu?, test?, now? } */
export function install(deps) {
  if (api) return api;
  const { engine, profile, i18n, audio } = deps || {};
  const TEST = deps && typeof deps.test === 'boolean' ? deps.test : TEST_UNLOCK_ALL, now = deps && deps.now ? deps.now : () => Date.now();
  const lang = () => (i18n && i18n.lang) || 'fr', T = (k, p) => PS.word(k, lang(), p);
  const num = n => { try { return Number(n).toLocaleString(lang()).replace(/ | /g, ' '); } catch { return String(n); } };
  const season = () => PS.seasonAt(now());
  const subs = new Set(), emit = () => subs.forEach(f => { try { f(); } catch (e) { console.warn('[pass] listener', e); } });

  /* ---------- the save ---------- */
  const read = () => { let raw = null; try { raw = localStorage.getItem(KEY); } catch { /* no storage */ } return PS.cleanState(raw, season(), now()); };
  const write = st => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { console.warn('[pass] save', e); } };
  let state = read();
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('storage', e => { if (e.key === KEY) { state = read(); emit(); } });       // another tab played or claimed

  /* ---------- names for contracts and maps (from i18n, falling back to ids) ---------- */
  const tk = (k, fb) => { try { const s = i18n && i18n.t(k); return s && s !== k ? s : fb; } catch { return fb; } };
  const names = { cat: id => tk('weaponCat.' + id, id), map: id => tk('map.' + id, id), mode: id => tk(MODE_KEY[id] || 'mode.' + id, id) };

  /* ---------- ownership ---------- */
  function owns(id) {
    const it = PS.itemById(id); if (!it) return false;
    if (it.kind === 'fin') return !!profile.ownsFin(id);
    if (it.kind === 'fit') return typeof profile.ownsOutfit === 'function' && profile.outfitOf && profile.outfitOf(id) ? !!profile.ownsOutfit(id) : (TEST || state.own.includes(id));
    return TEST || state.own.includes(id);
  }
  /** Gives a claimed finish or colourway through the shop's ledger (the only writer of ownership). Emblems and banners live in the pass save. */
  async function grantItem(r) {
    if (r.kind !== 'fin' && r.kind !== 'fit') return true;
    try { const g = await profile.grant(r.kind === 'fin' ? 'finish' : 'outfit', r.id, 'pass'); return !!(g && g.ok); } catch (e) { console.warn('[pass] grant', e); return false; }
  }
  /** Items claimed for real but missing from the profile (a lost save write, an older ledger): granted again. Idempotent. */
  async function reconcile() {
    const d = profile.data && profile.data.cos; if (!d) return;
    for (const id of state.own) {
      const it = PS.itemById(id); if (!it || (it.kind !== 'fin' && it.kind !== 'fit')) continue;
      if ((it.kind === 'fin' ? d.fin : d.out).includes(id)) continue;
      await grantItem({ kind: it.kind, id });
    }
  }

  /* ---------- match tracking: engine events only (offline and online alike), counters only, nothing per frame ---------- */
  const M = { on: false, t0: 0, pausedAt: 0, paused: 0, kills: 0, heads: 0, streak: 0, best: 0, cats: {}, online: false, mode: '', map: '' };
  let matchSeq = 0, lastSum = null, settling = false;
  const P = () => engine && (engine.player || (engine.internals && engine.internals.P && engine.internals.P.actor)) || null;
  const safe = (name, fn) => { try { engine.on(name, (...a) => { try { fn(...a); } catch (e) { console.warn('[pass] ' + name, e); } }); } catch (e) { console.warn('[pass] hook ' + name, e); } };
  if (engine && typeof engine.on === 'function') {
    safe('matchStart', cfg => {
      matchSeq++; const c = cfg || {};
      M.on = true; M.t0 = performance.now(); M.pausedAt = 0; M.paused = 0; M.kills = 0; M.heads = 0; M.streak = 0; M.best = 0; M.cats = {};
      M.online = !!c.online; M.mode = String(c.mode || ''); M.map = String(c.map || '');
    });
    safe('pause', v => { if (!M.on || M.online) return; const t = performance.now(); if (v) { if (!M.pausedAt) M.pausedAt = t; } else if (M.pausedAt) { M.paused += t - M.pausedAt; M.pausedAt = 0; } });
    safe('kill', e => {
      if (!M.on || !e) return; const me = P();
      if (me && e.victim === me) { M.streak = 0; return; }
      if (!me || e.killer !== me) return;
      M.kills++; if (e.head) M.heads++; if (++M.streak > M.best) M.best = M.streak;
      const c = CAT.get(e.weaponId); if (c) M.cats[c] = (M.cats[c] | 0) + 1;
    });
    safe('quit', () => { M.on = false; });
    safe('matchEnd', r => {
      if (!M.on) { fillEnd(); return; }
      M.on = false;
      if (!r || r.error) { fillEnd(); return; }
      const t = performance.now(), paused = M.paused + (M.pausedAt ? t - M.pausedAt : 0), o = PS.objectivesFromStats(r.stats, r.won);
      const m = { min: Math.max(0, (t - M.t0 - paused) / 60000), kills: M.kills, heads: M.heads, obj: o.obj, waves: o.waves, won: r.won, online: M.online, mode: M.mode, map: M.map, best: M.best, cats: { ...M.cats } };
      settle(m, matchSeq);
    });
  }
  async function settle(m, seq) {
    settling = true;
    try {
      const sum = await inPass(() => { const st = read(); const s = PS.applyMatch(st, season(), m, now()); s.seq = seq; write(st); state = st; return s; });
      lastSum = { ...sum, seq };
    } catch (e) { console.warn('[pass] settle', e); lastSum = null; }
    finally { settling = false; }
    emit(); fillEnd();
  }

  /* ---------- claims and the commission ---------- */
  async function claim(tier, track, quiet) {
    try {
      const res = await inPass(async () => {
        const st = read(), s = season(), r = PS.markClaimed(st, s, tier, track, TEST);
        if (!r.ok) { state = st; return r; }
        write(st); state = st;                                              // recorded first: a failure after this never loses the reward (reconcile)
        if (r.grant && r.grant.kind === 'cr') await inShop(() => profile.award(r.grant.cr, 0));
        else if (r.grant) r.granted = await grantItem(r.grant);
        return r;
      });
      if (!quiet) emit(); return res;
    } catch (e) { console.warn('[pass] claim', e); return { ok: false, reason: 'error' }; }
  }
  async function claimAll() {
    const out = []; for (const r of PS.claimable(state, season(), TEST)) { const x = await claim(r.tier, r.track, true); if (x.ok) out.push(x.reward); }
    emit(); return out;       // one redraw for the whole batch
  }
  const commission = () => { const s = season(), price = s.premium.price, cr = PS.creditsOf(price); return { price, credits: cr, owned: state.prem, test: TEST, missing: Math.max(0, cr - ((profile.data && profile.data.cr) | 0)) }; };
  /** Buys the officer's commission with credits, once (token: unique per confirmation, a replay never pays twice). Refused in test mode. */
  async function buyCommission(token) {
    if (TEST) return { ok: false, reason: 'test' };
    try {
      const res = await inPass(() => inShop(() => {
        if (typeof profile.sync === 'function') profile.sync();
        const st = read(), s = season(), cost = PS.creditsOf(s.premium.price);
        if (st.prem) { state = st; return { ok: false, reason: 'owned' }; }
        if (token && st.tx.includes(token)) { state = st; return { ok: true, repeated: true }; }
        if (PS.seasonPhase(s, now()) !== 'live') { state = st; return { ok: false, reason: 'season' }; }
        if (profile.data.cr < cost) { state = st; return { ok: false, reason: 'credits', missing: cost - profile.data.cr }; }
        st.prem = true; st.premAt = now(); if (token) st.tx = [...st.tx, token].slice(-24);
        write(st); state = st;                                              // the pass first: if the debit then fails, the player keeps the commission
        profile.data.cr -= cost; profile.save();
        return { ok: true, cost };
      }));
      emit(); return res;
    } catch (e) { console.warn('[pass] commission', e); return { ok: false, reason: 'error' }; }
  }
  async function equip(kind, id) {
    if (kind !== 'emb' && kind !== 'ban') return false;
    if (id !== null && (!PS.itemById(id) || PS.itemById(id).kind !== kind || !owns(id))) return false;
    await inPass(() => { const st = read(); st.equip[kind] = id; write(st); state = st; });
    emit(); return true;
  }

  /* ---------- end-of-match block (menu end screen and match-flow results) ---------- */
  if (typeof document !== 'undefined' && !document.getElementById('fzp-end-style')) { const s = document.createElement('style'); s.id = 'fzp-end-style'; s.textContent = CSS; document.head.append(s); }
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  function paintEnd(box, sum) {
    box.textContent = '';
    if (!sum) { box.hidden = true; return; }
    const s = PS.seasonById(sum.season) || season(), L = lang();
    const head = mk('div', 'fzp-end-head'); head.append(mk('span', 'fzp-end-k', `${T('title')} · ${PS.pick(s.name, L)}`));
    if (sum.phase !== 'live') { head.append(mk('span', 'fzp-end-note', T('noGain'))); box.append(head); box.hidden = false; return; }
    head.append(mk('b', 'fzp-end-gain', `+${num(sum.gain.total)} ${T('seasonXp')}`)); box.append(head);
    if (sum.tierAfter > sum.tierBefore) box.append(mk('div', 'fzp-end-up', `${T('tierUp')} · ${T('tier', { n: sum.tierAfter })}`));
    const pr = PS.tierProgress(sum.xpAfter, s), line = mk('div', 'fzp-end-line');
    line.append(mk('span', null, T('tier', { n: pr.tier })), mk('span', null, pr.need ? T('toNext', { a: num(pr.into), b: num(pr.need), n: pr.tier + 1 }) : T('maxed')));
    const bar = mk('div', 'fzp-end-bar'), fillI = mk('i'); fillI.style.width = `${Math.round(pr.frac * 1000) / 10}%`; bar.append(fillI);
    box.append(line, bar);
    const parts = mk('ul', 'fzp-end-parts'), g = sum.gain;
    for (const [k, v] of [['gainTime', g.time], ['gainFinish', g.finish], ['gainKills', g.kills], ['gainObj', g.obj], ['gainWin', g.win], ['gainContracts', g.contracts]]) {
      if (!v) continue; const li = mk('li', null, `${T(k)} `); li.append(mk('b', null, `+${num(v)}`)); parts.append(li);
    }
    if (parts.childElementCount) box.append(parts);
    if (sum.done.length) {
      const ul = mk('ul', 'fzp-end-done');
      for (const c of sum.done) { const li = mk('li', null, `${T('contractDone')} : ${PS.contractText(c, L, names)} `); li.append(mk('span', null, `+${num(c.xp)}`)); ul.append(li); }
      box.append(ul);
    }
    const n = PS.claimable(state, s, TEST).length;
    if (n && box.dataset.where !== 'flow') {
      const foot = mk('div', 'fzp-end-foot'), b = mk('button', 'fzp-end-btn', T('openPass'));
      b.type = 'button'; b.setAttribute('data-fid', 'pass:end-open'); b.addEventListener('click', () => { try { if (audio && audio.ui) audio.ui(); } catch { /* optional */ } open({}); });
      foot.append(mk('span', null, T('toClaim', { n })), b); box.append(foot);
    }
    box.hidden = false;
  }
  function fillEnd() { if (typeof document === 'undefined') return; const sum = lastSum && lastSum.seq === matchSeq ? lastSum : null; for (const b of document.querySelectorAll('[data-fzp-end]')) paintEnd(b, sum); }
  /** where: 'menu' | 'flow'. An element that fills itself once this match is counted (the menu draws before the pass hears the end). */
  function endBlock(where) {
    const box = mk('section', 'fzp-end'); box.setAttribute('data-fzp-end', ''); box.dataset.where = where === 'flow' ? 'flow' : 'menu'; box.setAttribute('aria-live', 'polite');
    box.setAttribute('data-fid', 'pass:end'); box.hidden = true;
    if (!settling && lastSum && lastSum.seq === matchSeq) paintEnd(box, lastSum);
    return box;
  }

  /* ---------- the screen ---------- */
  let screen = null, opening = false;
  async function open(opts) {
    if (screen || opening) return screen;
    opening = true;
    try {
      const m = await import('./pass-ui.js');
      screen = await m.openPassScreen({ pass: api, engine, profile, i18n, audio, ...(opts || {}), onClose: () => { screen = null; try { opts && opts.onClose && opts.onClose(); } catch { /* menu */ } } });
      return screen;
    } catch (e) { console.error('[pass] screen', e); screen = null; try { opts && opts.onClose && opts.onClose(); } catch { /* menu */ } return null; }
    finally { opening = false; }
  }

  /* ---------- outfit colourways: registered once outfits.js is there (it loads anyway before a match), after the menu is up ---------- */
  let fitIds = [];
  const regFits = async () => {
    try {
      const m = await import('./outfits.js');
      if (typeof m.registerColorways !== 'function') return;
      fitIds = m.registerColorways(PS.PASS_COLORWAYS.map(o => ({ ...o, colorway: PS.pick(o.colorway, lang()) })));       // the shop prints "<SET> <colorway>": a plain string in the player's language
      if (globalThis.FZOutfitSets !== m.OUTFIT_SETS && Array.isArray(m.OUTFIT_SETS)) globalThis.FZOutfitSets = m.OUTFIT_SETS;
      emit();
    } catch (e) { console.warn('[pass] colourways', e); }
  };
  const idle = typeof requestIdleCallback === 'function' ? fn => requestIdleCallback(fn, { timeout: 1500 }) : fn => setTimeout(fn, 600);
  idle(() => { regFits().then(() => reconcile()).catch(e => console.warn('[pass] reconcile', e)); });

  api = {
    get season() { return season(); }, get state() { return state; }, test: TEST, names, lang, T, num,
    get lastSummary() { return lastSum; }, get finIds() { return finIds; }, get fitIds() { return fitIds; },
    refresh() { state = read(); emit(); return state; },
    owns, claim, claimAll, commission, buyCommission, equip, endBlock, open,
    claimable: () => PS.claimable(state, season(), TEST),
    contracts: () => PS.contractsAt(season(), now()),
    progress: () => PS.tierProgress(state.xp, season()),
    now, on(fn) { subs.add(fn); return () => subs.delete(fn); },
    /** Dev and tests: the match record that the next matchEnd would settle. */
    get tracking() { return M.on ? { kills: M.kills, heads: M.heads, best: M.best, mode: M.mode, map: M.map, online: M.online } : null; },
  };
  globalThis.FZPass = api;
  readyResolve(api);
  return api;
}
/** Opens the pass screen (menu.js): waits for main.js to have installed the pass. */
export async function openPass(opts) { const a = await Promise.race([ready, new Promise(r => setTimeout(() => r(null), 4000))]); return a ? a.open(opts) : null; }
