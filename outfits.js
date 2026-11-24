// outfits.js — FRONT ZÉRO: registry of the premium outfit sets. Each set lives in its own module (outfit-<set>.js or outfit-map-<map>.js), built with
// outfit-kit.js; a module that fails to load is skipped and the others still work. Same public face as one set module, so game.js and the shop use it directly.
// Public: OUTFIT_SETS, outfitById, setOf, WARM_IDS, prepareOutfits(yieldFn, ids), attachOutfit(soldier, id, opts), fpArms(id), setOutfitView, setOutfitQuality, hookOutfitShadows.
// Sets are built on demand: a match load builds the first set (it warms the shared shader programs) and the sets already asked for; a set first seen during a
// match is built one step per frame while that soldier keeps the standard uniform, then put on. All sets share the same shader programs: nothing compiles late.
// A set may declare `map: '<map id>'` on its colourways (map-themed sets); setOf() reports it, null otherwise.
export { setOutfitView, setOutfitQuality, hookOutfitShadows } from './outfit-kit.js';
import { attachInstance, outfitMaterial, fpArmsFor } from './outfit-kit.js';

const MODULES = ['./outfit-eclipse.js', './outfit-colosse.js', './outfit-fantome.js', './outfit-as.js',
  './outfit-demineur.js',
  './outfit-abysse.js', './outfit-blizzard.js', './outfit-ronin.js', './outfit-sentinelle.js',
  './outfit-map-port.js',
  './outfit-map-depot.js',
  './outfit-map-vieille-ville.js',
  './outfit-map-roqueseche.js',
  './outfit-map-col-blanc.js',
  './outfit-map-bunker.js',
  './outfit-map-sept-vents.js',
  './outfit-map-noirval.js',
  './outfit-map-val-cendre.js',
  './outfit-map-valferrade.js',
];
const mods = [];
for (const r of await Promise.allSettled(MODULES.map(p => import(p)))) {
  if (r.status === 'fulfilled' && r.value && Array.isArray(r.value.OUTFIT_SETS)) mods.push(r.value);
  else if (r.status === 'rejected') console.warn('[outfit] set unavailable', r.reason && r.reason.message);
}
const OWNER = new Map(), BY_ID = new Map();
export const OUTFIT_SETS = [];
for (const m of mods) for (const o of m.OUTFIT_SETS) if (!BY_ID.has(o.id)) { OUTFIT_SETS.push(o); BY_ID.set(o.id, o); OWNER.set(o.id, m); }
export const outfitById = id => BY_ID.get(id) || null;
/** The sets in shop order: [{ id, name, map }]. */
export const setOf = () => { const seen = new Map(); for (const o of OUTFIT_SETS) if (!seen.has(o.setId)) seen.set(o.setId, { id: o.setId, name: o.name, map: typeof o.map === 'string' ? o.map : null }); return [...seen.values()]; };

const ready = new Set(), building = new Map(), wanted = new Set(), ASSET = new Map(), EXTRA = new Map();
/** Extra colourways for existing sets (season pass...): defs [{ id, setId, colorway, rarity, palette }]. Same geometry and shader program as the set;
 *  the set's own palette defaults (pbr, first-person style) apply where the def leaves them out. Duplicate or unknown-set ids are ignored. Returns the ids added. */
export function registerColorways(defs) {
  const added = [];
  for (const d of Array.isArray(defs) ? defs : []) {
    if (!d || typeof d.id !== 'string' || BY_ID.has(d.id) || !d.palette || typeof d.palette !== 'object') continue;
    const base = OUTFIT_SETS.find(o => o.setId === d.setId); if (!base) continue;
    const bp = base.palette || {}, palette = { ...d.palette };
    for (const k of ['pbr', 'fpKit', 'fpSleeve']) if (palette[k] === undefined && bp[k] !== undefined) palette[k] = bp[k];
    const o = { id: d.id, setId: d.setId, name: base.name, colorway: d.colorway, rarity: d.rarity || base.rarity, palette, ...(base.map ? { map: base.map } : null) };
    for (const k of ['source', 'price', 'season', 'passTier', 'passTrack']) if (Object.hasOwn(d, k)) o[k] = d[k];      // pass colourways: the shop reads these (price null / source 'pass' = not sold)
    OUTFIT_SETS.push(o); BY_ID.set(o.id, o); OWNER.set(o.id, OWNER.get(base.id)); EXTRA.set(o.id, o); added.push(o.id);
  }
  return added;
}
const attachExtra = (m, soldier, o, opts = {}) => { const asset = ASSET.get(m); if (!asset || !asset.geos) return null; const team = opts.team === 0 || opts.team === 1 ? opts.team : -1; return attachInstance(soldier, asset, outfitMaterial(o.id, o.palette, team), opts.lod ?? -1, outfitMaterial(o.id, o.palette, team, true)); };
const attachAny = (m, soldier, id, opts) => EXTRA.has(id) ? attachExtra(m, soldier, EXTRA.get(id), opts) : m.attachOutfit(soldier, id, opts);
/** One colourway of each set built so far (the match load puts one soldier of each at every LOD before the first frame). Refreshed by prepareOutfits. */
export const WARM_IDS = [];
const refreshWarm = () => { WARM_IDS.length = 0; for (const m of mods) if (ready.has(m) && m.OUTFIT_SETS[0]) WARM_IDS.push(m.OUTFIT_SETS[0].id); };
function build(m, yieldFn) {
  if (ready.has(m)) return Promise.resolve();
  if (!building.has(m)) building.set(m, Promise.resolve(m.prepareOutfits ? m.prepareOutfits(yieldFn) : null).then(a => { if (a && a.geos) ASSET.set(m, a); ready.add(m); building.delete(m); refreshWarm(); }, e => { building.delete(m); console.warn('[outfit] build failed', e && e.message); }));
  return building.get(m);
}
/** Builds geometry in small steps (await yieldFn() between parts): the sets of `ids`, or (no ids) the first set plus every set asked for so far. */
export async function prepareOutfits(yieldFn, ids) {
  const want = Array.isArray(ids) ? new Set(ids.map(i => OWNER.get(i)).filter(Boolean)) : new Set([mods[0], ...[...wanted].map(i => OWNER.get(i))].filter(Boolean));
  for (const m of mods) if (want.has(m)) await build(m, yieldFn);
  refreshWarm();
}
/** Marks outfits as needed soon (for example the fits announced in a room), so the next prepareOutfits() builds them. */
export function wantOutfits(ids) { for (const i of ids || []) if (OWNER.has(i)) wanted.add(i); }

// at most two late attaches per 16 ms: twelve soldiers waiting for the same set do not all dress in one frame
let attachT = 0, attachN = 0;
const takeAttach = () => { const t = typeof performance !== 'undefined' ? performance.now() : Date.now(); if (t - attachT > 16) { attachT = t; attachN = 0; } return attachN++ < 2; };
const nextFrame = () => new Promise(r => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 16)));
/** Puts outfit `id` on a soldier. Null for an unknown id (the standard uniform stays on). If its set is not built yet, a placeholder keeps the standard
 *  uniform, builds the set one step per frame, then puts the outfit on (the soldier calls update() every frame). */
export function attachOutfit(soldier, id, opts) {
  const m = OWNER.get(id); if (!m || soldier.kind !== 'soldier') return null;
  wanted.add(id);
  if (ready.has(m)) return attachAny(m, soldier, id, opts);
  let real = null, dead = false; build(m, nextFrame);
  const p = {
    pending: true, rank: 0,
    update(dt) { if (dead) return; if (!real && ready.has(m) && takeAttach()) { real = attachAny(m, soldier, id, opts); if (real) p.pending = false; } if (real) real.update(dt); },
    reset() { if (real) real.reset(); },
    dispose() { dead = true; if (real) real.dispose(); real = null; },
    get lod() { return real ? real.lod : -1; }, get mesh() { return real ? real.mesh : null; }, get skeleton() { return real ? real.skeleton : null; }, get real() { return real; },
  };
  return p;
}
// zombie looks (outfit-mutant.js): visual only, never sold, never in OUTFIT_SETS; a failure leaves the stock zombies
let mutant = null; try { mutant = await import('./outfit-mutant.js'); } catch (e) { console.warn('[outfit] mutant unavailable', e && e.message); }
/** The look of a zombie of this type (the brutes are mutants), or null. */
export const zombieSkin = (soldier, type, opts) => (mutant ? mutant.zombieSkin(soldier, type, opts) : null);
/** Builds the zombie looks in small steps (zombie matches, at load). */
export const prepareZombies = yieldFn => (mutant ? mutant.prepareZombies(yieldFn) : Promise.resolve(null));
/** First-person sleeves and gloves of a colourway (a small texture, no geometry build). */
export function fpArms(id) { const m = OWNER.get(id); if (EXTRA.has(id)) { const o = EXTRA.get(id); return fpArmsFor(o.id, o.palette); } return m && m.fpArms ? m.fpArms(id) : null; }
/** Triangles per LOD and close-range layer, per built set (tooling). */
export function outfitStats() { const o = {}; for (const m of mods) { const id = m.OUTFIT_SETS[0] && m.OUTFIT_SETS[0].setId; if (id && m.outfitTriangles && m.outfitTriangles()) o[id] = { lods: m.outfitTriangles(), detail: m.outfitDetailTriangles ? m.outfitDetailTriangles() : 0 }; } return o; }
