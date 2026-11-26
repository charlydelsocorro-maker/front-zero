// FRONT ZÉRO — bot outfits in the browser: the bots of a match wear outfits of the catalogue (outfits.js), drawn at random per match.
// Rules (pool size, modes, readability exclusions, draw, deal): bot-outfits-rules.js, shared with the server.
// - Solo (FFA, TDM, Domination, Bomb, Zone): this page draws the pool when the match loads; game.js builds and warms it behind the loading screen,
//   then E.addBot deals one to each bot (the least worn, a repeat stays within one team).
// - Online: the server draws the pool and deals one to each bot (room view `bf`, net.fitOf reads it); this page only asks for those sets at load,
//   with the outfits the players in the room wear, so nothing is built mid-match.
// The player's own outfit is not touched. Zombies (and Zombies mode) keep their own look. Any failure here leaves the standard uniform.
import './bot-outfits-rules.js';

const R = globalThis.FZBotOutfits;
const S = { pool: [], solo: false };
/** Solo: sets built in one page session before the draw keeps to them (each built set holds a few MB of geometry until the page closes). */
const SESSION_SETS = 12;
/** Solo on the low presets (weak machines): fewer sets to build at load. Online the server's draw stands (every client must show the same outfit). */
const LOW_PRESETS = ['bas', 'mobile'], LOW_PER_MATCH = 3;
/** Dev and tests: `globalThis.FZBotOutfitsOff = true` before a match turns the feature off (A/B measures). */
const off = () => globalThis.FZBotOutfitsOff === true || !R;

/** The catalogue ids this page can draw from: every colourway of OUTFIT_SETS except season-pass rewards (rules: R.eligible). */
function catalogue(fitMod) {
  const ids = [];
  for (const o of fitMod.OUTFIT_SETS || []) if (o && typeof o.id === 'string' && !o.source && o.season === undefined) ids.push(o.id);
  return R.eligible(ids);
}
/** One colourway per set of `ids` (what the loader puts on its warm-up soldiers: one per geometry). */
function perSet(fitMod, ids) {
  const seen = new Set(), out = [];
  for (const id of ids) { const o = fitMod.outfitById(id), k = o ? o.setId : null; if (k && !seen.has(k)) { seen.add(k); out.push(id); } }
  return out;
}

/** Called by the match load, before the outfit build. Returns { ids, warm } for the loader, or null when nothing changes.
 *  ids: the sets to build (undefined = the loader's own default: first set + every set asked for); warm: one colourway per set to warm (null = the loader's own list). */
export function plan(cfg, fitMod, net, warmAll, preset) {
  S.pool = []; S.solo = false;
  if (off() || !cfg || !fitMod || !fitMod.OUTFIT_SETS || !R.modeOn(cfg.mode)) return null;
  if (net) {       // online: the server's pool and the outfits worn in the room, asked for before the loader's build
    const r = net.room || {}, want = new Set();
    if (r.bf && typeof r.bf === 'object') for (const k in r.bf) if (typeof r.bf[k] === 'string') want.add(r.bf[k]);
    for (const q of Array.isArray(r.players) ? r.players : []) if (q && typeof q.fit === 'string') want.add(q.fit);
    const known = [...want].filter(id => fitMod.outfitById(id));
    if (!known.length) return null;
    fitMod.wantOutfits(known);
    // the loader builds its first set online anyway (a late joiner may wear it): warm it with this match's sets, not every set built since the page opened
    const first = fitMod.OUTFIT_SETS[0] ? [fitMod.OUTFIT_SETS[0].id] : [];
    return { ids: undefined, warm: warmAll ? null : perSet(fitMod, [...known, ...first]) };
  }
  const most = LOW_PRESETS.indexOf(preset) >= 0 ? LOW_PER_MATCH : R.PER_MATCH;
  const nb = Number(cfg.bots), n = cfg.mode === 'zone' || !Number.isFinite(nb) ? most : Math.max(0, Math.min(most, Math.round(nb)));
  if (!n) return null;
  const seed = cfg.botFitSeed != null ? Number(cfg.botFitSeed) || 1 : Math.floor(Math.random() * 0x7fffffff);
  // built sets stay in memory for the session: once SESSION_SETS are built, later matches draw among those only (no new build, memory bounded)
  let ids = catalogue(fitMod);
  const built = new Set((fitMod.WARM_IDS || []).map(id => { const o = fitMod.outfitById(id); return o ? o.setId : null; }).filter(Boolean));
  if (built.size >= SESSION_SETS) { const kept = ids.filter(id => { const o = fitMod.outfitById(id); return o && built.has(o.setId); }); if (kept.length) ids = kept; }
  const pool = R.draw(ids, n, R.rng(seed)).filter(id => fitMod.outfitById(id));
  if (!pool.length) return null;
  S.pool = pool; S.solo = true;
  fitMod.wantOutfits(pool);
  return warmAll ? { ids: undefined, warm: null } : { ids: pool, warm: perSet(fitMod, pool) };
}

/** The outfit of a bot the engine is adding (E.addBot): solo, dealt from this match's pool; online (the Zone simulator's bots), the server's. */
export function forBot(a, actors, net) {
  if (off() || !a || a.kind !== 'soldier') return null;
  if (net) return typeof net.fitOf === 'function' ? net.fitOf(a.id) : null;
  if (!S.solo || !S.pool.length) return null;
  const others = [];
  for (const b of actors || []) if (b && b !== a && !b.isPlayer && !b.isRemote && b.kind === 'soldier' && b.fit) others.push([b.fit, b.team]);
  return R.pick(S.pool, others, a.team);
}

/** Tests and tools: this match's solo pool. */
export const pool = () => S.pool.slice();
