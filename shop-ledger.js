// FRONT ZÉRO — what the shop adds to the profile: finishes, cosmetic outfits, equipment ownership, and purchases that debit exactly once.
// Every purchase runs inside a lock shared by all tabs, re-reads the save, checks, debits and writes in one step. A double click and a second tab cannot pay twice.
// Prices are structures ({credits}). There is no payment code here and there must never be any without a server that verifies purchases.
import { TEST_UNLOCK_ALL, WEAPONS, WEAPON_LEVELS, OUTFITS } from './data.js';
import { cleanCos, finishById, isFinish, creditsOf, outfitPrice, setQuote, notSold, PASS_ID } from './cosmetics.js';

const LOCK = 'frontzero-shop';
const inLock = fn => (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request ? navigator.locks.request(LOCK, fn) : Promise.resolve().then(fn));

/** ctx: { key, data, real, save, level(), test? , gear() (the equipment table or null), extraOutfits() } */
export function attachLedger(p, ctx) {
  const d = ctx.data, real = ctx.real, TEST = ctx.test ?? TEST_UNLOCK_ALL;
  const gearItem = id => { const g = ctx.gear && ctx.gear(); return g && Object.hasOwn(g.ITEMS, id) ? g.ITEMS[id] : null; };
  const extra = () => (ctx.extraOutfits ? ctx.extraOutfits() : []) || [];
  const outfitOf = id => OUTFITS.find(o => o.id === id) || extra().find(o => o.id === id) || null;
  const isBase = id => OUTFITS.some(o => o.id === id);

  /** Brings this tab up to date with the save (another tab may have spent or earned since). */
  let seenRaw = null; try { seenRaw = localStorage.getItem(ctx.key); } catch { /* no storage */ }
  p.on(() => { try { seenRaw = localStorage.getItem(ctx.key); } catch { /* no storage */ } });       // our own writes are not news
  function sync() {
    let raw, text; try { text = localStorage.getItem(ctx.key); if (text === seenRaw) return; seenRaw = text; raw = JSON.parse(text || 'null'); } catch { return; }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    if (Number.isFinite(raw.cr)) d.cr = Math.max(0, Math.floor(raw.cr));
    if (Number.isFinite(raw.xp)) d.xp = Math.max(d.xp, Math.floor(raw.xp));
    for (const k of ['weapons', 'outfits']) if (Array.isArray(raw[k])) for (const id of raw[k]) {
      if (!(k === 'weapons' ? WEAPONS : OUTFITS).some(x => x.id === id)) continue;
      if (!real[k].includes(id)) real[k].push(id); if (!d[k].includes(id)) d[k].push(id);
    }
    if (Array.isArray(raw.gxOwned) && Array.isArray(d.gxOwned)) for (const id of raw.gxOwned) if (gearItem(id) && !d.gxOwned.includes(id)) d.gxOwned.push(id);
    const c = cleanCos(raw.cos), m = d.cos;
    for (const k of ['fin', 'out', 'tx']) for (const id of c[k]) if (!m[k].includes(id)) m[k].push(id);
    m.w = c.w; m.outfit = c.outfit;
    m.tx = m.tx.slice(-24);
  }
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('storage', e => { if (e.key === ctx.key && e.newValue) { try { sync(); ctx.emit(); } catch { /* the next purchase re-reads it */ } } });

  /* ---------- ownership ---------- */
  const ownsFin = id => isFinish(id) && (TEST || d.cos.fin.includes(id));
  const ownsOutfit = id => (isBase(id) ? p.owns('outfit', id) : !!outfitOf(id) && (TEST || d.cos.out.includes(id)));
  const ownsGear = id => { const it = gearItem(id); return !!it && it.live === true && (TEST || it.price === 0 || (d.gxOwned || []).includes(id)); };
  const levelNeed = (kind, id) => {
    if (kind === 'weapon') return WEAPON_LEVELS[id] || 1;
    if (kind === 'gear') return gearItem(id)?.level || 1;
    if (kind === 'finish') return finishById(id)?.level || 1;
    if (kind === 'outfit') return outfitOf(id)?.level || 1;
    return 1;
  };
  const levelOkFor = (kind, id) => TEST || ctx.level() >= levelNeed(kind, id);

  /** What buying this costs right now and whether it can be bought. */
  function quote(kind, id, set) {
    let cost = 0, owned = false, known = true, setInfo = null, ns = false, passTier = null;
    if (kind === 'weapon') { const w = WEAPONS.find(x => x.id === id); known = !!w; cost = w ? w.price : 0; owned = p.owns('weapon', id); }
    else if (kind === 'gear') { const it = gearItem(id); known = !!it && it.live === true; cost = it ? it.price : 0; owned = ownsGear(id); }
    else if (kind === 'finish') { const f = finishById(id); known = !!f; cost = creditsOf(f?.price); owned = ownsFin(id); ns = notSold(f); passTier = f && Number.isInteger(f.passTier) ? f.passTier : null; }
    else if (kind === 'outfit') { const o = outfitOf(id); known = !!o; cost = creditsOf(outfitPrice(o)); owned = ownsOutfit(id); ns = notSold(o); passTier = o && Number.isInteger(o.passTier) ? o.passTier : null; }       // a pass colourway is never sold
    else if (kind === 'set') { known = !!set; if (set) { setInfo = TEST ? setQuote(set, () => false, () => false, outfitOf) : setQuote(set, ownsOutfit, ownsFin, outfitOf); cost = setInfo.pay; owned = TEST || setInfo.complete; } }       // in test mode the real price is shown
    else known = false;
    const lvlNeed = kind === 'set' && set ? Math.max(levelNeed('outfit', set.outfit), ...set.finishes.map(f => levelNeed('finish', f))) : levelNeed(kind, id);
    const levelOk = TEST || ctx.level() >= lvlNeed, missing = Math.max(0, cost - d.cr);
    return { kind, id, known, cost, price: { credits: cost }, owned, levelOk, level: lvlNeed, missing, can: known && !ns && !owned && levelOk && missing === 0 && !TEST, test: TEST, set: setInfo, notSold: ns, passTier };
  }
  function grant(kind, id, set) {
    if (kind === 'weapon') { d.weapons.push(id); if (!real.weapons.includes(id)) real.weapons.push(id); }
    else if (kind === 'gear') { if (!d.gxOwned.includes(id)) d.gxOwned.push(id); }
    else if (kind === 'finish') { if (!d.cos.fin.includes(id)) d.cos.fin.push(id); }
    else if (kind === 'outfit') {
      if (isBase(id)) { if (!d.outfits.includes(id)) d.outfits.push(id); if (!real.outfits.includes(id)) real.outfits.push(id); }
      else if (!d.cos.out.includes(id)) d.cos.out.push(id);
    } else if (kind === 'set') { const q = setQuote(set, ownsOutfit, ownsFin, outfitOf); if (q.missing.outfit) grant('outfit', q.missing.outfit); for (const f of q.missing.finishes) grant('finish', f); }
  }

  let busy = false, seq = 0;
  Object.assign(p, {
    sync, quote, ownsFin, ownsOutfit, ownsGear, levelNeed, levelOkFor, outfitOf,
    /** Gives an item without credits: the season pass's rewards. kind 'finish' | 'outfit'; source is a label ('pass'). Same lock as purchases,
        after re-reading the save, then saved. A finish may be a season id not registered yet (PASS_ID): it stays inert until registered.
        Resolves { ok, already?, reason? }. Owned items stay owned when TEST_UNLOCK_ALL is turned off. */
    async grant(kind, id, source) {
      if (kind !== 'finish' && kind !== 'outfit') return { ok: false, reason: 'kind' };
      if (kind === 'finish' ? !(isFinish(id) || (typeof id === 'string' && PASS_ID.test(id))) : !(typeof id === 'string' && /^[a-z0-9][a-z0-9_-]{1,39}$/.test(id))) return { ok: false, reason: 'unknown' };
      return inLock(() => {
        sync();
        if (kind === 'finish') { if (d.cos.fin.includes(id)) return { ok: true, already: true }; d.cos.fin.push(id); }
        else if (isBase(id)) { if (real.outfits.includes(id)) return { ok: true, already: true }; real.outfits.push(id); if (!d.outfits.includes(id)) d.outfits.push(id); }
        else { if (d.cos.out.includes(id)) return { ok: true, already: true }; d.cos.out.push(id); }
        ctx.save(); return { ok: true, source: typeof source === 'string' ? source.slice(0, 12) : null };
      });
    },
    newToken: () => `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    /** One purchase. token: unique for this confirmation, so replaying it never pays twice. Resolves { ok, reason, cost, missing, cr }. */
    async purchase({ kind, id, set, token }) {
      if (busy) return { ok: false, reason: 'busy' };
      if (TEST) return { ok: false, reason: 'test' };
      busy = true;
      try {
        return await inLock(() => {
          sync();
          if (token && d.cos.tx.includes(token)) return { ok: true, repeated: true, cost: 0, cr: d.cr };
          const q = quote(kind, id, set);
          if (!q.known) return { ok: false, reason: 'unknown' };
          if (q.notSold) return { ok: false, reason: 'notSold' };
          if (q.owned) return { ok: false, reason: 'owned' };
          if (!q.levelOk) return { ok: false, reason: 'level', level: q.level };
          if (q.missing > 0) return { ok: false, reason: 'credits', missing: q.missing };
          d.cr -= q.cost; grant(kind, id, set);
          if (token) { d.cos.tx.push(token); d.cos.tx = d.cos.tx.slice(-24); }
          ctx.save();
          return { ok: true, cost: q.cost, cr: d.cr };
        });
      } finally { busy = false; }
    },
    /* ---------- finishes ---------- */
    /** The finish really shown on this weapon: equipped, and still owned. */
    finOf(wid) { const f = d.cos.w[wid]; return f && ownsFin(f) ? f : null; },
    finishMap() { const out = {}; for (const k of Object.keys(d.cos.w)) { const f = p.finOf(k); if (f) out[k] = f; } return out; },
    /** id = null goes back to the factory look. */
    equipFin(wid, id) {
      if (!WEAPONS.some(w => w.id === wid)) return false;
      if (id === null) { sync(); delete d.cos.w[wid]; ctx.save(); return true; }
      if (!ownsFin(id)) return false;
      sync(); d.cos.w[wid] = id; ctx.save(); return true;
    },
    /* ---------- outfits that are not in data.js (ÉCLIPSE) ---------- */
    /** The outfit worn: a special one when it is equipped and owned, otherwise null (data.outfit then applies). */
    specialOutfit() {
      const id = d.cos.outfit; if (!id || isBase(id)) return null;
      const o = outfitOf(id); if (o) return ownsOutfit(id) ? o : null;
      return TEST || d.cos.out.includes(id) ? { id } : null;      // its module is not loaded yet after a page reload: the id is enough, the game validates it
    },
    wearOutfit(id) {
      if (!ownsOutfit(id)) return false;
      sync();
      if (isBase(id)) { d.cos.outfit = null; d.outfit = id; } else d.cos.outfit = id;
      ctx.save(); return true;
    },
    outfitWorn(id) { const s = p.specialOutfit(); return s ? s.id === id : d.outfit === id; },
  });
  return p;
}
