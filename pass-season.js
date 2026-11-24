// FRONT ZÉRO — season pass: seasons, tiers, rewards, season XP, contracts and the save format. Pure data and logic: no DOM, no three.js, no storage.
// Runtime: pass.js (tracker, save, claims). Screen: pass-ui.js. Tuning and rules: the dev notes.
// PRICES ARE STRUCTURES ({ credits: n }), as in cosmetics.js: a second currency could become one more key once a server verifies payments.
// There is no payment code anywhere and none may be added here. Rewards are cosmetic only: no weapon, gear, XP boost or stat behind any track.
// All names, item designs and wording are original to FRONT ZÉRO.

export const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
export const pick = (arr, lang) => { if (!Array.isArray(arr)) return String(arr ?? ''); const i = LANGS.indexOf(lang); return arr[i < 0 ? 0 : i] ?? arr[0]; };
const DAY = 864e5;
/** Days since 1970 of the LOCAL calendar date (a daylight-saving hour never moves it). Both brothers are in the same time zone. */
export const dayNumber = t => { const d = new Date(t); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); };
const dn = (y, m, d) => Math.round(Date.UTC(y, m, d) / DAY);
/** Local midnight that starts day number n. */
export const dayStart = n => { const d = new Date(n * DAY); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime(); };

/* ---------- seasons ----------
   Season 1 "Ligne de Braise": the autumn front, from the harbour at dusk (Port du Couchant) through the fires of the Noirval refinery
   to the ashes of Val de Cendre. Eight weeks, Monday 23 November 2026 to Monday 18 January 2027 (local midnight). */
export const SEASONS = [{
  id: 's1', num: 1, startDay: dn(2026, 10, 23), endDay: dn(2027, 0, 18), tiers: 50,
  name: ['Ligne de Braise', 'Ember Line', 'Línea de Brasa', 'Glutlinie', 'Linha de Brasa', 'Linea di Brace'],
  tagline: ['Du port au crépuscule jusqu’aux cendres du val, le front s’embrase.', 'From the harbour at dusk to the ashes of the valley, the front catches fire.', 'Del puerto al anochecer a las cenizas del valle, el frente arde.', 'Vom Hafen in der Dämmerung bis zur Asche im Tal: Die Front steht in Flammen.', 'Do porto ao entardecer às cinzas do vale, a frente incendeia-se.', 'Dal porto al tramonto fino alle ceneri della valle, il fronte prende fuoco.'],
  maps: ['port', 'noirval', 'val-cendre'],
  /** The officer's commission (premium track). Credits only for now; a real-money key may be added later, never shown without a server. */
  premium: { price: { credits: 32000 } },
}];
export const seasonById = id => SEASONS.find(s => s.id === id) || null;
/** The season of this moment: the running one, else the last one that ended, else the first one to come. */
export function seasonAt(t) {
  const d = dayNumber(t);
  return SEASONS.find(s => d >= s.startDay && d < s.endDay) || [...SEASONS].reverse().find(s => d >= s.endDay) || SEASONS[0];
}
export const seasonPhase = (s, t) => { const d = dayNumber(t); return d < s.startDay ? 'soon' : d >= s.endDay ? 'ended' : 'live'; };
export const seasonDay = (s, t) => dayNumber(t) - s.startDay;
export const seasonWeek = (s, t) => Math.floor(seasonDay(s, t) / 7);
export const seasonEndsAt = s => dayStart(s.endDay);
export const nextDayAt = t => dayStart(dayNumber(t) + 1);
export const nextWeekAt = (s, t) => dayStart(s.startDay + (seasonWeek(s, t) + 1) * 7);
/** The credits of a price structure (other keys are ignored on purpose). */
export const creditsOf = price => (price && Number.isFinite(price.credits) ? Math.max(0, Math.floor(price.credits)) : 0);

/* ---------- tiers ----------
   Reaching tier n (2..50) costs TIER_BASE + TIER_STEP * (n - 2) season XP: 1 250 for tier 2, 2 210 for tier 50, 84 770 in all.
   Tuned with test/pass simulation (the dev notes): a regular player (3 evenings a week, about an hour of matches each) reaches tier 50 in week 8. */
export const TIER_BASE = 1250, TIER_STEP = 20;
const TOTALS = (() => { const a = [0, 0]; for (let n = 2; n <= 60; n++) a[n] = a[n - 1] + TIER_BASE + TIER_STEP * (n - 2); return a; })();
/** Total season XP needed to reach tier n (tier 1 = 0). */
export const xpForTier = n => TOTALS[Math.max(1, Math.min(TOTALS.length - 1, n | 0))];
export function tierOf(xp, s = SEASONS[0]) { let n = 1; while (n < s.tiers && xp >= TOTALS[n + 1]) n++; return n; }
/** Where the player stands inside the current tier: { tier, into, need, frac }. need is 0 at the last tier. */
export function tierProgress(xp, s = SEASONS[0]) {
  const tier = tierOf(xp, s);
  if (tier >= s.tiers) return { tier, into: 0, need: 0, frac: 1 };
  const into = xp - TOTALS[tier], need = TOTALS[tier + 1] - TOTALS[tier];
  return { tier, into, need, frac: Math.max(0, Math.min(1, into / need)) };
}

/* ---------- season XP from one match ----------
   m: { min, kills, heads, obj, waves, won, online, mode, map, best, cats: { assault: n, ... } } (pass.js measures it). */
export const XP_RULES = { perMin: 12, maxMin: 20, finishMin: 1.5, finish: 40, kill: 6, head: 3, maxKills: 40, obj: 25, wave: 15, maxObj: 12, win: 60, draw: 30 };
const int = (x, max = 1e6) => { const n = Math.floor(Number(x)); return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0; };
/** A clean copy of a match record, whatever it held. */
export function cleanMatch(m) {
  const o = m && typeof m === 'object' ? m : {}, cats = {};
  if (o.cats && typeof o.cats === 'object') for (const k of Object.keys(o.cats).slice(0, 16)) if (/^[a-z]{2,12}$/.test(k)) cats[k] = int(o.cats[k], 999);
  const min = Number.isFinite(+o.min) ? Math.max(0, Math.min(240, +o.min)) : 0;
  return { min, done: min >= XP_RULES.finishMin ? 1 : 0, kills: int(o.kills, 999), heads: Math.min(int(o.heads, 999), int(o.kills, 999)), obj: int(o.obj, 99), waves: int(o.waves, 99),
    won: o.won === true ? true : o.won === false ? false : null, online: !!o.online, mode: typeof o.mode === 'string' ? o.mode.slice(0, 16) : '', map: typeof o.map === 'string' ? o.map.slice(0, 24) : '', best: int(o.best, 999), cats };
}
export function matchXp(raw) {
  const m = cleanMatch(raw), R = XP_RULES, k = Math.min(m.kills, R.maxKills);
  const time = Math.round(Math.min(m.min, R.maxMin) * R.perMin);
  const finish = m.done ? R.finish : 0;
  const kills = k * R.kill + Math.min(m.heads, k) * R.head;
  const obj = Math.min(m.obj * R.obj + m.waves * R.wave, R.maxObj * R.obj);
  const win = !m.done ? 0 : m.won === true ? R.win : m.won === null ? R.draw : 0;
  return { time, finish, kills, obj, win, total: time + finish + kills + obj + win };
}

/* ---------- contracts: 3 daily and 7 weekly, the same for everyone on the same date (seeded, no server) ---------- */
export const CATS = ['assault', 'smg', 'shotgun', 'sniper', 'pistol', 'lmg'];
export const CONTRACT_MODES = ['ffa', 'tdm', 'dom', 'bomb', 'zombie', 'zone'];
const DAILY = [
  { k: 'done', metric: 'done', n: 3, xp: 200 }, { k: 'kills', metric: 'kills', n: 15, xp: 200 }, { k: 'heads', metric: 'heads', n: 5, xp: 220 },
  { k: 'wins', metric: 'wins', n: 1, xp: 200 }, { k: 'min', metric: 'min', n: 20, xp: 200 }, { k: 'obj', metric: 'obj', n: 3, xp: 220 },
  { k: 'cat', metric: 'cat', n: 8, xp: 220, param: 'cat' }, { k: 'map', metric: 'map', n: 2, xp: 220, param: 'map' }, { k: 'mode', metric: 'mode', n: 1, xp: 200, param: 'mode' },
];
const WEEKLY = [
  { k: 'map', metric: 'map', n: 5, xp: 900, param: 'featured' },       // always there: the season map of the week
  { k: 'done', metric: 'done', n: 15, xp: 900 }, { k: 'kills', metric: 'kills', n: 80, xp: 900 }, { k: 'heads', metric: 'heads', n: 25, xp: 900 },
  { k: 'wins', metric: 'wins', n: 6, xp: 900 }, { k: 'min', metric: 'min', n: 90, xp: 800 }, { k: 'obj', metric: 'obj', n: 15, xp: 900 },
  { k: 'cat', metric: 'cat', n: 30, xp: 800, param: 'cat' }, { k: 'online', metric: 'online', n: 4, xp: 800 }, { k: 'streak', metric: 'streak', n: 5, xp: 700 },
  { k: 'waves', metric: 'waves', n: 15, xp: 800 }, { k: 'mode', metric: 'mode', n: 4, xp: 800, param: 'mode' },
];
export const DAILY_COUNT = 3, WEEKLY_COUNT = 7;
/** Deterministic generator: FNV-1a of the text, then mulberry32. Same numbers in every browser. */
export function seeded(text) {
  let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (list, r) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const paramOf = (def, r, s, week) => def.param === 'cat' ? CATS[Math.floor(r() * CATS.length)] : def.param === 'mode' ? CONTRACT_MODES[Math.floor(r() * CONTRACT_MODES.length)]
  : def.param === 'map' ? s.maps[Math.floor(r() * s.maps.length)] : def.param === 'featured' ? s.maps[((week % s.maps.length) + s.maps.length) % s.maps.length] : null;
/** The contracts of a date: { day, week, daily: [3], weekly: [7] }. Each: { key, scope 'd'|'w', k, metric, n, xp, param }. */
export function contractsAt(s, t) {
  const day = seasonDay(s, t), week = Math.floor(day / 7);
  const rd = seeded(`${s.id}:d:${day}`), rw = seeded(`${s.id}:w:${week}`);
  const make = (def, scope, r) => ({ key: `${scope}${scope === 'd' ? day : week}:${def.k}`, scope, k: def.k, metric: def.metric, n: def.n, xp: def.xp, param: paramOf(def, r, s, week) });
  const daily = shuffle(DAILY, rd).slice(0, DAILY_COUNT).map(d => make(d, 'd', rd));
  const weekly = [make(WEEKLY[0], 'w', rw), ...shuffle(WEEKLY.slice(1), rw).slice(0, WEEKLY_COUNT - 1).map(d => make(d, 'w', rw))];
  return { day, week, daily, weekly };
}
/** How much one match moves a contract. */
export function contractGain(c, m) {
  switch (c.metric) {
    case 'done': return m.done; case 'kills': return m.kills; case 'heads': return m.heads; case 'wins': return m.done && m.won === true ? 1 : 0;
    case 'min': return Math.round(m.min); case 'obj': return m.obj; case 'waves': return m.waves; case 'cat': return m.cats[c.param] | 0;
    case 'map': return m.done && m.map === c.param ? 1 : 0; case 'mode': return m.done && m.mode === c.param ? 1 : 0; case 'online': return m.done && m.online ? 1 : 0;
    case 'streak': return m.best;       // the best run of one match, not a sum
    default: return 0;
  }
}

/* ---------- catalogue: only cosmetics ---------- */
// Weapon finishes, registered into the shop's catalogue (cosmetics.js registerFinishes). Existing pattern generators only: no new texture code, no new shader.
const FIN = (id, pattern, rarity, c, accent, n, tier, track) => ({ id, pattern, rarity, c, accent, n, level: 1, source: 'pass', season: 's1', passTier: tier, passTrack: track, price: null, picture: true });       // picture: weapon-shots/fin-<id>.webp ships (.handoff/shop/capture-finishes.cjs)
export const PASS_FINISHES = [
  FIN('s1_brulis', 'digital', 'common', [0x2a1d14, 0x55331f, 0x86562f, 0xb48651], 0x3a2618, ['Pixel Brûlis', 'Slash-burn Pixel', 'Píxel Quemado', 'Pixel Brandrodung', 'Pixel Queimada', 'Pixel Debbio'], 5, 'free'),
  FIN('s1_cendre', 'woodland', 'uncommon', [0x37373a, 0x58585a, 0x828078, 0xaeaaa0], 0x2a2a2c, ['Cendre Froide', 'Cold Ash', 'Ceniza Fría', 'Kalte Asche', 'Cinza Fria', 'Cenere Fredda'], 15, 'free'),
  FIN('s1_tole', 'brushed', 'uncommon', [0x6a5746, 0x8f7660, 0xb6997d], 0x45372a, ['Tôle Chaude', 'Hot Sheet Metal', 'Chapa Caliente', 'Heißes Blech', 'Chapa Quente', 'Lamiera Calda'], 29, 'free'),
  FIN('s1_couchant', 'heat', 'rare', [0x22163a, 0x5a2f5e, 0xc0582e, 0xf09a3e], 0xf2a04a, ['Couchant', 'Sundown', 'Ocaso', 'Abendrot', 'Poente', 'Tramonto'], 1, 'premium'),
  FIN('s1_quai', 'splinter', 'rare', [0x1d2830, 0x34505e, 0x8a4a2a, 0xb87a4a], 0x16202a, ['Quai Rouillé', 'Rusted Quay', 'Muelle Oxidado', 'Rostiger Kai', 'Cais Enferrujado', 'Molo Arrugginito'], 8, 'premium'),
  FIN('s1_signal', 'carbon', 'epic', [0x0e0f11, 0x1c1e22, 0x30333a], 0xff7a1a, ['Signal', 'Flare', 'Bengala', 'Signalfeuer', 'Sinalizador', 'Segnale'], 17, 'premium'),
  FIN('s1_noirval', 'veined', 'epic', [0x07080a, 0x121418, 0x23272e, 0x3fb8a8], 0x5fd0c0, ['Nappe de Noirval', 'Noirval Slick', 'Mancha de Noirval', 'Noirval-Ölfilm', 'Mancha de Noirval', 'Chiazza di Noirval'], 25, 'premium'),
  FIN('s1_braise', 'veined', 'legendary', [0x0b0706, 0x1a0f0b, 0x3a1c12, 0xff6a1e], 0xffa040, ['Braise Vive', 'Live Ember', 'Brasa Viva', 'Lebende Glut', 'Brasa Viva', 'Brace Viva'], 50, 'premium'),
];
// Outfit colourways, registered through outfits.js registerColorways (same geometry and program as their set; a colourway is a palette).
// Mid-tone cloth on purpose: the readability rule asks them to stay within 20 % of the standard soldier's contrast in Bunker Sigma and Col Blanc.
const FIT = (id, setId, rarity, colorway, palette, tier) => ({ id, setId, rarity, colorway, palette, source: 'pass', season: 's1', passTier: tier, passTrack: 'premium', price: null });
export const PASS_COLORWAYS = [
  FIT('s1-eclipse-braise', 'eclipse', 'epic', ['Braise', 'Ember', 'Brasa', 'Glut', 'Brasa', 'Brace'],
    { cloth: 0x4a3d34, cloth2: 0x342b25, plate: 0x5c4c40, plate2: 0x6e5644, rubber: 0x231d19, metal: 0x7a6c60, accent: 0xff6a1e, glow: 0xff8a3a, visor: 0x2a1206, rim: 0x6a5e56, lift: .03 }, 5),
  FIT('s1-colosse-cendre', 'colosse', 'rare', ['Cendre', 'Ash', 'Ceniza', 'Asche', 'Cinza', 'Cenere'],
    { cloth: 0x45433e, cloth2: 0x302e2a, plate: 0x64615a, plate2: 0x45423d, rubber: 0x221f1c, metal: 0x8a857b, accent: 0xd8642a, glow: 0xff9a4a, visor: 0x1a0e08, rim: 0x6c6a64, lift: .02, pattern: { type: 5, scale: 20, strength: .3, a: 0x55524c, b: 0x34322e } }, 14),
  FIT('s1-fantome-couchant', 'fantome', 'epic', ['Couchant', 'Sundown', 'Ocaso', 'Abendrot', 'Poente', 'Tramonto'],
    { cloth: 0x5e4c52, cloth2: 0x3c3036, plate: 0x7c6052, plate2: 0x4c3c3c, rubber: 0x281f22, metal: 0x524849, accent: 0x9a5a3a, glow: 0xf0a060, visor: 0x140c10, rim: 0x6a5a60, lift: .02, pattern: { type: 2, scale: 9.5, strength: .6, a: 0x7c5c4e, b: 0x3c3036, plates: 1 } }, 23),
  FIT('s1-as-noirval', 'as', 'rare', ['Noirval', 'Noirval', 'Noirval', 'Noirval', 'Noirval', 'Noirval'],
    { cloth: 0x3b3631, cloth2: 0x2b2724, plate: 0xb0a898, plate2: 0x34302c, rubber: 0x1f1d1b, metal: 0x8a8a84, accent: 0x3fc0b0, glow: 0x7ff0e0, visor: 0x081414, rim: 0x5c5a56, lift: .02 }, 30),
  FIT('s1-colosse-braise', 'colosse', 'epic', ['Braise', 'Ember', 'Brasa', 'Glut', 'Brasa', 'Brace'],
    { cloth: 0x4c4038, cloth2: 0x352d27, plate: 0x6e5a48, plate2: 0x4a3c31, rubber: 0x221c18, metal: 0x9a8064, accent: 0xff7a24, glow: 0xffa040, visor: 0x2a1004, rim: 0x6c5e54, lift: .025, pattern: { type: 5, scale: 20, strength: .3, a: 0x5e4c40, b: 0x3a3029 } }, 44),
];
// Emblems and banners: drawn by pass-ui.js (SVG and CSS), cost nothing in a match. glyph/shape and colours are the whole design.
const EMB = (id, rarity, shape, glyph, c, n) => ({ id, kind: 'emb', rarity, shape, glyph, c, n });
export const EMBLEMS = [
  EMB('s1-em-recrue', 'common', 'roundel', 'chevron', ['#2b2a26', '#8d8a80', '#e8692c'], ['Recrue de Braise', 'Ember Recruit', 'Recluta de Brasa', 'Glut-Rekrut', 'Recruta de Brasa', 'Recluta di Brace']),
  EMB('s1-em-quai', 'uncommon', 'shield', 'anchor', ['#1d2830', '#5a7a88', '#e9a24a'], ['Quai du Couchant', 'Sundown Quay', 'Muelle del Ocaso', 'Abendrot-Kai', 'Cais do Poente', 'Molo del Tramonto']),
  EMB('s1-em-cuves', 'uncommon', 'hex', 'tanks', ['#1c1f22', '#7d858c', '#3fb8a8'], ['Parc à cuves', 'Tank Farm', 'Parque de tanques', 'Tanklager', 'Parque de tanques', 'Parco serbatoi']),
  EMB('s1-em-val', 'rare', 'diamond', 'peak', ['#2a2420', '#b0a898', '#e8692c'], ['Crête du Val', 'Valley Ridge', 'Cresta del Valle', 'Talgrat', 'Crista do Vale', 'Cresta della Valle']),
  EMB('s1-em-veteran', 'rare', 'shield', 'chevron2', ['#26201c', '#c9b48a', '#e8692c'], ['Vétéran de la Ligne', 'Line Veteran', 'Veterano de la Línea', 'Veteran der Linie', 'Veterano da Linha', 'Veterano della Linea']),
  EMB('s1-em-officier', 'rare', 'tab', 'bars', ['#1e1a16', '#d9c08a', '#e8692c'], ['Brevet', 'Commission', 'Despacho', 'Patent', 'Patente', 'Brevetto']),
  EMB('s1-em-grue', 'rare', 'roundel', 'hook', ['#1f2a30', '#d39a3a', '#f2c36a'], ['Grue', 'Crane', 'Grúa', 'Kran', 'Grua', 'Gru']),
  EMB('s1-em-torche', 'epic', 'shield', 'stack', ['#141518', '#6e737a', '#ff7a1a'], ['Torchère', 'Flare Stack', 'Antorcha de gas', 'Gasfackel', 'Tocha de gás', 'Torcia di gas']),
  EMB('s1-em-pont', 'rare', 'hex', 'arch', ['#2a241e', '#a8957a', '#e8692c'], ['Pont à sec', 'Dry Bridge', 'Puente seco', 'Trockene Brücke', 'Ponte seca', 'Ponte asciutto']),
  EMB('s1-em-crepuscule', 'epic', 'roundel', 'sun', ['#22163a', '#c0582e', '#f6c26a'], ['Crépuscule', 'Dusk', 'Crepúsculo', 'Dämmerung', 'Crepúsculo', 'Crepuscolo']),
  EMB('s1-em-fusees', 'epic', 'diamond', 'crossed', ['#181614', '#9a8f80', '#ff6a1e'], ['Fusées croisées', 'Crossed Flares', 'Bengalas cruzadas', 'Gekreuzte Fackeln', 'Sinalizadores cruzados', 'Razzi incrociati']),
  EMB('s1-em-ancre-or', 'epic', 'shield', 'anchor', ['#1a1712', '#c9a24a', '#f4dc94'], ['Ancre d’or', 'Gold Anchor', 'Ancla de oro', 'Goldanker', 'Âncora de ouro', 'Ancora d’oro']),
  EMB('s1-em-braise', 'legendary', 'diamond', 'ember', ['#120c0a', '#ff6a1e', '#ffd27a'], ['Cœur de Braise', 'Ember Heart', 'Corazón de Brasa', 'Glutherz', 'Coração de Brasa', 'Cuore di Brace']),
];
const BAN = (id, rarity, bg, n) => ({ id, kind: 'ban', rarity, bg, n });
export const BANNERS = [
  BAN('s1-bn-cendre', 'common', 'repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 9px),linear-gradient(100deg,#2c2c2e,#5b5a57 60%,#3a3936)', ['Cendre', 'Ash', 'Ceniza', 'Asche', 'Cinza', 'Cenere']),
  BAN('s1-bn-couchant', 'uncommon', 'linear-gradient(180deg,rgba(0,0,0,0) 62%,rgba(20,12,24,.55) 62% 66%,rgba(0,0,0,0) 66% 74%,rgba(20,12,24,.55) 74% 77%,rgba(0,0,0,0) 77%),linear-gradient(180deg,#2a1a44,#7a3a5c 48%,#e0703a 78%,#f2b056)', ['Couchant', 'Sundown', 'Ocaso', 'Abendrot', 'Poente', 'Tramonto']),
  BAN('s1-bn-noirval', 'rare', 'linear-gradient(100deg,transparent 30%,rgba(63,184,168,.35) 42%,rgba(150,110,200,.25) 50%,transparent 62%),linear-gradient(180deg,#0c0e10,#1a1e22)', ['Noirval', 'Noirval', 'Noirval', 'Noirval', 'Noirval', 'Noirval']),
  BAN('s1-bn-ligne', 'epic', 'linear-gradient(90deg,transparent 0 14%,#e8692c 14% 15%,transparent 15%),linear-gradient(180deg,transparent 46%,rgba(232,105,44,.9) 46% 54%,transparent 54%),linear-gradient(100deg,#141210,#2a201a)', ['Ligne de Braise', 'Ember Line', 'Línea de Brasa', 'Glutlinie', 'Linha de Brasa', 'Linea di Brace']),
  BAN('s1-bn-crepuscule', 'rare', 'radial-gradient(60% 120% at 80% 120%,rgba(240,154,62,.55),transparent 60%),linear-gradient(180deg,#141a36,#30345c)', ['Heure bleue', 'Blue Hour', 'Hora azul', 'Blaue Stunde', 'Hora azul', 'Ora blu']),
  BAN('s1-bn-docks', 'rare', 'repeating-linear-gradient(90deg,rgba(0,0,0,.28) 0 2px,transparent 2px 12px),linear-gradient(90deg,#7a3a24 0 25%,#2c4a5e 25% 50%,#4a5a2c 50% 75%,#8a6a2a 75%)', ['Docks', 'Docks', 'Muelles', 'Docks', 'Docas', 'Banchine']),
  BAN('s1-bn-cuves', 'rare', 'radial-gradient(circle at 18% 64%,#5c636a 0 16%,transparent 17%),radial-gradient(circle at 46% 64%,#4c535a 0 16%,transparent 17%),radial-gradient(circle at 74% 64%,#5c636a 0 16%,transparent 17%),linear-gradient(180deg,#3a2a40,#c0582e)', ['Raffinerie', 'Refinery', 'Refinería', 'Raffinerie', 'Refinaria', 'Raffineria']),
  BAN('s1-bn-brasier', 'epic', 'radial-gradient(40% 90% at 30% 110%,rgba(255,180,80,.8),transparent 70%),radial-gradient(40% 90% at 70% 110%,rgba(255,106,30,.85),transparent 70%),linear-gradient(180deg,#160c08,#4a1a0c)', ['Brasier', 'Blaze', 'Hoguera', 'Flammenmeer', 'Braseiro', 'Rogo']),
  BAN('s1-bn-marees', 'epic', 'repeating-radial-gradient(ellipse at 50% 160%,rgba(255,255,255,.08) 0 3px,transparent 3px 14px),linear-gradient(180deg,#2a1a44,#1c3a4a)', ['Marée du soir', 'Evening Tide', 'Marea vespertina', 'Abendflut', 'Maré da tarde', 'Marea serale']),
  BAN('s1-bn-braise-or', 'legendary', 'linear-gradient(100deg,transparent 35%,rgba(255,230,160,.35) 48%,transparent 60%),radial-gradient(50% 120% at 50% 120%,rgba(255,120,30,.75),transparent 70%),linear-gradient(180deg,#1a120a,#5a3a12)', ['Braise d’or', 'Golden Ember', 'Brasa de oro', 'Goldglut', 'Brasa de ouro', 'Brace d’oro']),
];

/* ---------- reward tracks ----------
   kind: cr (credits), fin (finish), fit (outfit colourway), emb (emblem), ban (banner). Free track: 25 rewards. Officer track: one per tier. */
const FREE = [[1, 'emb', 's1-em-recrue'], [3, 'cr', 300], [5, 'fin', 's1_brulis'], [7, 'cr', 400], [9, 'ban', 's1-bn-cendre'], [11, 'cr', 400], [13, 'emb', 's1-em-quai'], [15, 'fin', 's1_cendre'],
  [17, 'cr', 500], [19, 'cr', 500], [21, 'emb', 's1-em-cuves'], [23, 'cr', 600], [25, 'ban', 's1-bn-couchant'], [27, 'cr', 600], [29, 'fin', 's1_tole'], [31, 'cr', 700], [33, 'emb', 's1-em-val'],
  [35, 'cr', 700], [37, 'cr', 800], [39, 'ban', 's1-bn-noirval'], [41, 'cr', 800], [43, 'emb', 's1-em-veteran'], [45, 'cr', 900], [47, 'cr', 1000], [50, 'ban', 's1-bn-ligne']];
const PREM = [[1, 'fin', 's1_couchant'], [2, 'emb', 's1-em-officier'], [3, 'cr', 400], [4, 'ban', 's1-bn-crepuscule'], [5, 'fit', 's1-eclipse-braise'], [6, 'cr', 400], [7, 'emb', 's1-em-grue'],
  [8, 'fin', 's1_quai'], [9, 'cr', 400], [10, 'ban', 's1-bn-docks'], [11, 'cr', 500], [12, 'emb', 's1-em-torche'], [13, 'cr', 500], [14, 'fit', 's1-colosse-cendre'], [15, 'cr', 500],
  [16, 'emb', 's1-em-pont'], [17, 'fin', 's1_signal'], [18, 'cr', 500], [19, 'ban', 's1-bn-cuves'], [20, 'cr', 600], [21, 'emb', 's1-em-crepuscule'], [22, 'cr', 600], [23, 'fit', 's1-fantome-couchant'],
  [24, 'cr', 600], [25, 'fin', 's1_noirval'], [26, 'cr', 600], [27, 'cr', 600], [28, 'ban', 's1-bn-brasier'], [29, 'cr', 700], [30, 'fit', 's1-as-noirval'], [31, 'cr', 700], [32, 'cr', 700],
  [33, 'cr', 700], [34, 'emb', 's1-em-fusees'], [35, 'cr', 700], [36, 'cr', 800], [37, 'ban', 's1-bn-marees'], [38, 'cr', 800], [39, 'cr', 800], [40, 'emb', 's1-em-ancre-or'], [41, 'cr', 800],
  [42, 'cr', 900], [43, 'cr', 900], [44, 'fit', 's1-colosse-braise'], [45, 'cr', 900], [46, 'cr', 1000], [47, 'cr', 1000], [48, 'emb', 's1-em-braise'], [49, 'ban', 's1-bn-braise-or'], [50, 'fin', 's1_braise']];
const toReward = track => ([tier, kind, v]) => (kind === 'cr' ? { tier, track, kind, cr: v, id: null } : { tier, track, kind, id: v, cr: 0 });
export const REWARDS = { s1: { free: FREE.map(toReward('free')), premium: PREM.map(toReward('premium')) } };
export const TRACKS = ['free', 'premium'];
export const rewardAt = (s, tier, track) => (REWARDS[s.id]?.[track] || []).find(r => r.tier === tier) || null;

const ITEM_MAP = new Map();
for (const f of PASS_FINISHES) ITEM_MAP.set(f.id, { kind: 'fin', ...f });
for (const o of PASS_COLORWAYS) ITEM_MAP.set(o.id, { kind: 'fit', ...o });
for (const e of EMBLEMS) ITEM_MAP.set(e.id, e);
for (const b of BANNERS) ITEM_MAP.set(b.id, b);
export const itemById = id => ITEM_MAP.get(id) || null;
/** Display name of a pass item; colourways get their set's name in front ("ÉCLIPSE Braise"). */
export const SET_NAMES = { eclipse: 'ÉCLIPSE', colosse: 'COLOSSE', fantome: 'FANTÔME', as: 'AS' };
export function itemName(it, lang) {
  if (!it) return '';
  if (it.kind === 'fit') return `${SET_NAMES[it.setId] || it.setId.toUpperCase()} ${pick(it.colorway, lang)}`;
  return pick(it.n, lang);
}

/* ---------- the save ('frontzero.pass' in localStorage) ----------
   Versioned and migration-safe: unknown fields are kept, wrong types are dropped, a new season archives the old one.
   LOCAL AND CHEATABLE until server accounts exist: anyone can edit their own localStorage. Nothing here is trusted by the server. */
export const SAVE_VERSION = 1;
const SEASONAL = ['xp', 'prem', 'premAt', 'claimed', 'test', 'day', 'week', 'stats', 'last'];
const KNOWN = new Set(['v', 'season', ...SEASONAL, 'own', 'equip', 'past', 'tx']);
const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
const ID_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;
const tiersList = (a, max) => [...new Set((Array.isArray(a) ? a : []).filter(n => Number.isInteger(n) && n >= 1 && n <= max))].sort((x, y) => x - y);
const progress = (o, n) => { const p = {}; let done = []; if (isObj(o) && Number.isInteger(o.n) && o.n === n) { if (isObj(o.p)) for (const k of Object.keys(o.p).slice(0, 24)) if (/^[a-z]{2,10}$/.test(k)) p[k] = int(o.p[k], 1e5); done = [...new Set((Array.isArray(o.done) ? o.done : []).filter(k => typeof k === 'string' && /^[a-z]{2,10}$/.test(k)))].slice(0, 24); } return { n, p, done }; };
export function freshSeasonal(s, t) {
  return { xp: 0, prem: false, premAt: 0, claimed: { free: [], premium: [] }, test: { premium: [] }, day: { n: seasonDay(s, t), p: {}, done: [] }, week: { n: seasonWeek(s, t), p: {}, done: [] }, stats: { matches: 0, min: 0, kills: 0, wins: 0 }, last: null };
}
/** A clean save for season s at time t, whatever raw held (null, garbage, an older version, another season, a newer version). */
export function cleanState(raw, s, t) {
  let o = raw;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
  if (!isObj(o)) o = {};
  const keep = {}; for (const k of Object.keys(o)) if (!KNOWN.has(k) && k.length < 32) keep[k] = o[k];       // a newer version's fields survive an older client
  const v = Number.isInteger(o.v) && o.v > SAVE_VERSION ? o.v : SAVE_VERSION;
  const past = {}; if (isObj(o.past)) for (const k of Object.keys(o.past).slice(0, 40)) { const q = o.past[k]; if (/^s\d{1,3}$/.test(k) && isObj(q)) past[k] = { xp: int(q.xp, 1e7), tier: int(q.tier, 999), prem: q.prem === true }; }
  const own = [...new Set((Array.isArray(o.own) ? o.own : []).filter(x => typeof x === 'string' && ID_RE.test(x)))].slice(0, 400);
  const eq = isObj(o.equip) ? o.equip : {}, equip = { emb: typeof eq.emb === 'string' && ID_RE.test(eq.emb) ? eq.emb : null, ban: typeof eq.ban === 'string' && ID_RE.test(eq.ban) ? eq.ban : null };
  const tx = (Array.isArray(o.tx) ? o.tx : []).filter(x => typeof x === 'string' && x.length <= 40).slice(-24);
  const base = { ...keep, v, season: s.id, own, equip, past, tx };
  const sameSeason = o.season === s.id || (o.season === undefined && Number.isFinite(+o.xp));       // v0 (no season field): its xp belongs to the first season
  if (!sameSeason) {
    if (typeof o.season === 'string' && /^s\d{1,3}$/.test(o.season) && !past[o.season]) { const os = seasonById(o.season); past[o.season] = { xp: int(o.xp, 1e7), tier: os ? tierOf(int(o.xp, 1e7), os) : 0, prem: o.prem === true }; }
    return { ...base, ...freshSeasonal(s, t) };
  }
  const max = s.tiers, cl = isObj(o.claimed) ? o.claimed : {}, te = isObj(o.test) ? o.test : {}, st = isObj(o.stats) ? o.stats : {};
  const last = isObj(o.last) && Number.isFinite(o.last.at) ? o.last : null;
  return { ...base, xp: int(o.xp, 1e7), prem: o.prem === true, premAt: Number.isFinite(o.premAt) ? o.premAt : 0,
    claimed: { free: tiersList(cl.free, max), premium: tiersList(cl.premium, max) }, test: { premium: tiersList(te.premium, max) },
    day: progress(o.day, seasonDay(s, t)), week: progress(o.week, seasonWeek(s, t)),
    stats: { matches: int(st.matches), min: int(st.min, 1e6), kills: int(st.kills, 1e7), wins: int(st.wins) }, last };
}
/** Daily and weekly progress follow the calendar: a new day or week starts empty. */
export function rollContracts(state, s, t) {
  const d = seasonDay(s, t), w = seasonWeek(s, t);
  if (!state.day || state.day.n !== d) state.day = { n: d, p: {}, done: [] };
  if (!state.week || state.week.n !== w) state.week = { n: w, p: {}, done: [] };
}

/** Adds one match to the save (state is changed in place). Returns the summary shown on the end screens. */
export function applyMatch(state, s, rawMatch, t) {
  const m = cleanMatch(rawMatch), phase = seasonPhase(s, t), xpBefore = state.xp, tierBefore = tierOf(xpBefore, s);
  const sum = { at: t, season: s.id, phase, xpBefore, xpAfter: xpBefore, tierBefore, tierAfter: tierBefore, gain: { time: 0, finish: 0, kills: 0, obj: 0, win: 0, contracts: 0, total: 0 }, done: [] };
  if (phase !== 'live') { state.last = sum; return sum; }
  rollContracts(state, s, t);
  const g = matchXp(m); Object.assign(sum.gain, g);
  const cs = contractsAt(s, t);
  for (const [list, box] of [[cs.daily, state.day], [cs.weekly, state.week]]) for (const c of list) {
    if (box.done.includes(c.k)) continue;
    const before = box.p[c.k] | 0, add = contractGain(c, m), now = c.metric === 'streak' ? Math.max(before, Math.min(add, c.n)) : Math.min(c.n, before + add);
    box.p[c.k] = now;
    if (now >= c.n) { box.done.push(c.k); sum.gain.contracts += c.xp; sum.done.push({ key: c.key, scope: c.scope, k: c.k, metric: c.metric, n: c.n, param: c.param, xp: c.xp }); }
  }
  sum.gain.total = g.total + sum.gain.contracts;
  state.xp = Math.min(1e7, state.xp + sum.gain.total);
  state.stats.matches += m.done; state.stats.min += Math.round(m.min); state.stats.kills += m.kills; state.stats.wins += m.done && m.won === true ? 1 : 0;
  sum.xpAfter = state.xp; sum.tierAfter = tierOf(state.xp, s);
  state.last = sum;
  return sum;
}

/* ---------- claims ----------
   test: TEST_UNLOCK_ALL. In test mode the officer track can be claimed without the commission and without any debit; those claims are kept apart
   (state.test.premium), grant nothing for real (TEST already owns every cosmetic, credits are not paid) and vanish once the flag is off. */
export const isClaimed = (state, tier, track, test) => (track === 'premium' && test && !state.prem ? state.test.premium : state.claimed[track]).includes(tier);
export function claimCheck(state, s, tier, track, test) {
  const r = rewardAt(s, tier, track);
  if (!r) return { ok: false, reason: 'none' };
  if (tierOf(state.xp, s) < tier) return { ok: false, reason: 'tier', reward: r };
  if (isClaimed(state, tier, track, test)) return { ok: false, reason: 'claimed', reward: r };
  if (track === 'premium' && !state.prem && !test) return { ok: false, reason: 'locked', reward: r };
  return { ok: true, reward: r, testOnly: track === 'premium' && !state.prem && !!test };
}
/** Marks a claim. Returns what must really be granted: null for a test-only claim. */
export function markClaimed(state, s, tier, track, test) {
  const c = claimCheck(state, s, tier, track, test); if (!c.ok) return c;
  if (c.testOnly) { state.test.premium.push(tier); state.test.premium.sort((a, b) => a - b); return { ok: true, reward: c.reward, grant: null }; }
  state.claimed[track].push(tier); state.claimed[track].sort((a, b) => a - b);
  if (c.reward.id && c.reward.kind !== 'cr' && !state.own.includes(c.reward.id)) state.own.push(c.reward.id);
  return { ok: true, reward: c.reward, grant: c.reward };
}
/** Every reward that can be claimed now. */
export function claimable(state, s, test) {
  const out = [];
  for (const track of TRACKS) for (const r of REWARDS[s.id]?.[track] || []) if (claimCheck(state, s, r.tier, track, test).ok) out.push(r);
  return out;
}
/** Shop value of the officer track, for the handoff and the screen: credits, plus how many items of each kind. */
export function trackTotals(s, track) {
  const list = REWARDS[s.id]?.[track] || [], t = { cr: 0, fin: 0, fit: 0, emb: 0, ban: 0, count: list.length };
  for (const r of list) { if (r.kind === 'cr') t.cr += r.cr; else t[r.kind]++; }
  return t;
}

/* ---------- words (6 languages) ---------- */
export const W = {
  title: ['Passe de saison', 'Season pass', 'Pase de temporada', 'Saisonpass', 'Passe de temporada', 'Pass stagionale'],
  season: ['Saison {n}', 'Season {n}', 'Temporada {n}', 'Saison {n}', 'Temporada {n}', 'Stagione {n}'],
  free: ['Troupe', 'Rank and file', 'Tropa', 'Truppe', 'Tropa', 'Truppa'],
  premium: ['Officier', 'Officer', 'Oficial', 'Offizier', 'Oficial', 'Ufficiale'],
  commission: ['Brevet d’officier', 'Officer’s commission', 'Despacho de oficial', 'Offizierspatent', 'Patente de oficial', 'Brevetto da ufficiale'],
  commissionNote: ['Ouvre la piste Officier : coloris de tenues, revêtements, emblèmes et bannières. Uniquement de l’apparence, aucun avantage en partie.', 'Opens the Officer track: outfit colourways, finishes, emblems and banners. Looks only, no advantage in a match.', 'Abre la pista Oficial: colores de uniforme, acabados, emblemas y estandartes. Solo apariencia, ninguna ventaja en partida.', 'Öffnet die Offiziersspur: Uniformfarben, Lackierungen, Embleme und Banner. Nur Aussehen, kein Vorteil im Match.', 'Abre a pista Oficial: cores de uniforme, acabamentos, emblemas e estandartes. Só aparência, nenhuma vantagem em partida.', 'Apre la pista Ufficiale: colori delle divise, finiture, emblemi e stendardi. Solo aspetto, nessun vantaggio in partita.'],
  getCommission: ['Obtenir le brevet', 'Get the commission', 'Obtener el despacho', 'Patent erhalten', 'Obter a patente', 'Ottieni il brevetto'],
  commissionOwned: ['Brevet obtenu', 'Commission held', 'Despacho obtenido', 'Patent erhalten', 'Patente obtida', 'Brevetto ottenuto'],
  testOpen: ['TEST : piste Officier ouverte sans débit. Ses crédits ne sont pas versés.', 'TEST: Officer track open without any debit. Its credits are not paid.', 'TEST: pista Oficial abierta sin cobro. Sus créditos no se abonan.', 'TEST: Offiziersspur ohne Abbuchung offen. Ihre Credits werden nicht ausgezahlt.', 'TESTE: pista Oficial aberta sem débito. Os seus créditos não são pagos.', 'TEST: pista Ufficiale aperta senza addebito. I suoi crediti non vengono versati.'],
  testMark: ['TEST', 'TEST', 'TEST', 'TEST', 'TESTE', 'TEST'],
  testBar: ['Mode test : prix réels affichés, rien n’est débité. La progression compte pour de vrai.', 'Test mode: real prices shown, nothing is debited. Progress counts for real.', 'Modo prueba: precios reales, no se cobra nada. El progreso cuenta de verdad.', 'Testmodus: echte Preise, nichts wird abgebucht. Der Fortschritt zählt wirklich.', 'Modo de teste: preços reais, nada é debitado. O progresso conta a sério.', 'Modalità test: prezzi reali, nulla viene addebitato. Il progresso conta davvero.'],
  tier: ['Palier {n}', 'Tier {n}', 'Nivel {n}', 'Stufe {n}', 'Patamar {n}', 'Livello {n}'],
  tierShort: ['P{n}', 'T{n}', 'N{n}', 'S{n}', 'P{n}', 'L{n}'],
  seasonXp: ['XP de saison', 'Season XP', 'XP de temporada', 'Saison-EP', 'XP de temporada', 'XP stagionali'],
  toNext: ['{a} / {b} XP vers le palier {n}', '{a} / {b} XP to tier {n}', '{a} / {b} XP para el nivel {n}', '{a} / {b} EP bis Stufe {n}', '{a} / {b} XP para o patamar {n}', '{a} / {b} XP al livello {n}'],
  maxed: ['Dernier palier atteint', 'Final tier reached', 'Último nivel alcanzado', 'Letzte Stufe erreicht', 'Último patamar alcançado', 'Ultimo livello raggiunto'],
  endsIn: ['Fin de saison dans {t}', 'Season ends in {t}', 'La temporada termina en {t}', 'Saisonende in {t}', 'A temporada acaba em {t}', 'La stagione finisce tra {t}'],
  ended: ['Saison terminée. Les récompenses gagnées restent à récupérer.', 'Season over. Rewards you earned can still be claimed.', 'Temporada terminada. Las recompensas ganadas aún se pueden recoger.', 'Saison beendet. Verdiente Belohnungen können noch abgeholt werden.', 'Temporada terminada. As recompensas ganhas ainda podem ser recolhidas.', 'Stagione finita. Le ricompense ottenute si possono ancora riscattare.'],
  endedShort: ['Saison terminée', 'Season over', 'Temporada terminada', 'Saison beendet', 'Temporada terminada', 'Stagione finita'],
  soon: ['La saison commence dans {t}', 'The season starts in {t}', 'La temporada empieza en {t}', 'Die Saison beginnt in {t}', 'A temporada começa em {t}', 'La stagione inizia tra {t}'],
  claim: ['Récupérer', 'Claim', 'Recoger', 'Abholen', 'Recolher', 'Riscatta'],
  claimAll: ['Tout récupérer ({n})', 'Claim all ({n})', 'Recoger todo ({n})', 'Alles abholen ({n})', 'Recolher tudo ({n})', 'Riscatta tutto ({n})'],
  claimed: ['Récupéré', 'Claimed', 'Recogido', 'Abgeholt', 'Recolhido', 'Riscattato'],
  claimedTest: ['Récupéré (TEST)', 'Claimed (TEST)', 'Recogido (TEST)', 'Abgeholt (TEST)', 'Recolhido (TESTE)', 'Riscattato (TEST)'],
  locked: ['Brevet requis', 'Commission needed', 'Requiere despacho', 'Patent nötig', 'Requer patente', 'Serve il brevetto'],
  notYet: ['Palier {n} requis', 'Tier {n} needed', 'Requiere nivel {n}', 'Stufe {n} nötig', 'Requer patamar {n}', 'Serve il livello {n}'],
  credits: ['Crédits', 'Credits', 'Créditos', 'Credits', 'Créditos', 'Crediti'],
  kinds: { cr: ['Crédits', 'Credits', 'Créditos', 'Credits', 'Créditos', 'Crediti'], fin: ['Revêtement d’arme', 'Weapon finish', 'Acabado de arma', 'Waffenlackierung', 'Acabamento de arma', 'Finitura arma'], fit: ['Coloris de tenue', 'Outfit colourway', 'Color de uniforme', 'Uniformfarbe', 'Cor de uniforme', 'Colore divisa'], emb: ['Emblème', 'Emblem', 'Emblema', 'Emblem', 'Emblema', 'Emblema'], ban: ['Bannière', 'Banner', 'Estandarte', 'Banner', 'Estandarte', 'Stendardo'] },
  exclusive: ['Exclusif au passe', 'Pass exclusive', 'Exclusivo del pase', 'Pass-exklusiv', 'Exclusivo do passe', 'Esclusiva del pass'],
  contracts: ['Contrats', 'Contracts', 'Contratos', 'Aufträge', 'Contratos', 'Contratti'],
  daily: ['Du jour', 'Today', 'Del día', 'Heute', 'Do dia', 'Del giorno'],
  weekly: ['De la semaine', 'This week', 'De la semana', 'Diese Woche', 'Da semana', 'Della settimana'],
  renews: ['Nouveaux dans {t}', 'New ones in {t}', 'Nuevos en {t}', 'Neue in {t}', 'Novos em {t}', 'Nuovi tra {t}'],
  done: ['Terminé', 'Done', 'Hecho', 'Erledigt', 'Feito', 'Fatto'],
  tracks: ['Paliers', 'Tiers', 'Niveles', 'Stufen', 'Patamares', 'Livelli'],
  apply: ['Appliquer sur {w}', 'Apply to {w}', 'Aplicar a {w}', 'Auf {w} anwenden', 'Aplicar em {w}', 'Applica su {w}'],
  applied: ['Sur {w}', 'On {w}', 'En {w}', 'Auf {w}', 'Em {w}', 'Su {w}'],
  wear: ['Porter', 'Wear', 'Vestir', 'Tragen', 'Vestir', 'Indossa'],
  worn: ['Portée', 'Worn', 'Puesto', 'Getragen', 'Vestido', 'Indossata'],
  use: ['Arborer', 'Display', 'Lucir', 'Zeigen', 'Exibir', 'Esponi'],
  inUse: ['Arboré', 'Displayed', 'Lucido', 'Gezeigt', 'Exibido', 'Esposto'],
  remove: ['Retirer', 'Remove', 'Quitar', 'Entfernen', 'Remover', 'Rimuovi'],
  pendingFit: ['Coloris enregistré : il se charge avec les tenues, réessayez dans un instant.', 'Colourway saved: it loads with the outfits, try again in a moment.', 'Color guardado: se carga con los uniformes, inténtalo en un momento.', 'Farbe gespeichert: Sie lädt mit den Uniformen, gleich erneut versuchen.', 'Cor guardada: carrega com os uniformes, tenta daqui a pouco.', 'Colore salvato: si carica con le divise, riprova tra un attimo.'],
  preview3d: ['Aperçu 3D', '3D preview', 'Vista 3D', '3D-Vorschau', 'Pré-visualização 3D', 'Anteprima 3D'],
  back: ['Retour', 'Back', 'Volver', 'Zurück', 'Voltar', 'Indietro'],
  confirmTitle: ['Confirmer l’achat', 'Confirm purchase', 'Confirmar compra', 'Kauf bestätigen', 'Confirmar compra', 'Conferma acquisto'],
  balance: ['Solde', 'Balance', 'Saldo', 'Guthaben', 'Saldo', 'Saldo'],
  cost: ['Prix', 'Price', 'Precio', 'Preis', 'Preço', 'Prezzo'],
  after: ['Après', 'After', 'Después', 'Danach', 'Depois', 'Dopo'],
  confirm: ['Confirmer', 'Confirm', 'Confirmar', 'Bestätigen', 'Confirmar', 'Conferma'],
  cancel: ['Annuler', 'Cancel', 'Cancelar', 'Abbrechen', 'Cancelar', 'Annulla'],
  missing: ['Il manque {n} ₡', '{n} ₡ short', 'Faltan {n} ₡', 'Es fehlen {n} ₡', 'Faltam {n} ₡', 'Mancano {n} ₡'],
  bought: ['Brevet obtenu. La piste Officier est ouverte.', 'Commission obtained. The Officer track is open.', 'Despacho obtenido. La pista Oficial está abierta.', 'Patent erhalten. Die Offiziersspur ist offen.', 'Patente obtida. A pista Oficial está aberta.', 'Brevetto ottenuto. La pista Ufficiale è aperta.'],
  gotMany: ['{n} récompenses récupérées', '{n} rewards claimed', '{n} recompensas recogidas', '{n} Belohnungen abgeholt', '{n} recompensas recolhidas', '{n} ricompense riscattate'],
  freeNote: ['Gratuite', 'Free', 'Gratuita', 'Kostenlos', 'Gratuita', 'Gratuita'],
  got: ['Obtenu : {item}', 'Received: {item}', 'Obtenido: {item}', 'Erhalten: {item}', 'Obtido: {item}', 'Ottenuto: {item}'],
  failed: ['Action impossible, réessayez.', 'That did not work, try again.', 'No se pudo, inténtalo de nuevo.', 'Das hat nicht geklappt, bitte erneut versuchen.', 'Não foi possível, tenta de novo.', 'Non è riuscito, riprova.'],
  local: ['Progression enregistrée sur cet appareil.', 'Progress is saved on this device.', 'Progreso guardado en este dispositivo.', 'Fortschritt auf diesem Gerät gespeichert.', 'Progresso guardado neste dispositivo.', 'Progresso salvato su questo dispositivo.'],
  soldier: ['Soldat', 'Soldier', 'Soldado', 'Soldat', 'Soldado', 'Soldato'],
  gainTime: ['Temps de jeu', 'Time played', 'Tiempo jugado', 'Spielzeit', 'Tempo jogado', 'Tempo di gioco'],
  gainFinish: ['Partie terminée', 'Match finished', 'Partida terminada', 'Match beendet', 'Partida terminada', 'Partita finita'],
  gainKills: ['Éliminations', 'Eliminations', 'Eliminaciones', 'Eliminierungen', 'Eliminações', 'Eliminazioni'],
  gainObj: ['Objectifs', 'Objectives', 'Objetivos', 'Ziele', 'Objetivos', 'Obiettivi'],
  gainWin: ['Victoire', 'Victory', 'Victoria', 'Sieg', 'Vitória', 'Vittoria'],
  gainContracts: ['Contrats', 'Contracts', 'Contratos', 'Aufträge', 'Contratos', 'Contratti'],
  contractDone: ['Contrat rempli', 'Contract complete', 'Contrato cumplido', 'Auftrag erfüllt', 'Contrato cumprido', 'Contratto completato'],
  tierUp: ['Nouveau palier !', 'New tier!', '¡Nuevo nivel!', 'Neue Stufe!', 'Novo patamar!', 'Nuovo livello!'],
  toClaim: ['{n} récompense(s) à récupérer', '{n} reward(s) to claim', '{n} recompensa(s) por recoger', '{n} Belohnung(en) abholbereit', '{n} recompensa(s) por recolher', '{n} ricompensa/e da riscattare'],
  openPass: ['Ouvrir le passe', 'Open the pass', 'Abrir el pase', 'Pass öffnen', 'Abrir o passe', 'Apri il pass'],
  noGain: ['Saison non active : pas d’XP de saison.', 'Season not running: no season XP.', 'Temporada inactiva: sin XP de temporada.', 'Saison nicht aktiv: keine Saison-EP.', 'Temporada inativa: sem XP de temporada.', 'Stagione non attiva: niente XP stagionali.'],
};
const CT = {
  done: ['Terminer {n} parties', 'Finish {n} matches', 'Termina {n} partidas', 'Beende {n} Matches', 'Termina {n} partidas', 'Completa {n} partite'],
  kills: ['Éliminer {n} adversaires', 'Eliminate {n} opponents', 'Elimina a {n} rivales', 'Schalte {n} Gegner aus', 'Elimina {n} adversários', 'Elimina {n} avversari'],
  heads: ['{n} éliminations d’un tir à la tête', '{n} headshot eliminations', '{n} eliminaciones con disparo a la cabeza', '{n} Eliminierungen per Kopfschuss', '{n} eliminações com tiro na cabeça', '{n} eliminazioni con colpo alla testa'],
  wins: ['Gagner {n} parties', 'Win {n} matches', 'Gana {n} partidas', 'Gewinne {n} Matches', 'Vence {n} partidas', 'Vinci {n} partite'],
  wins1: ['Gagner une partie', 'Win a match', 'Gana una partida', 'Gewinne ein Match', 'Vence uma partida', 'Vinci una partita'],
  min: ['Jouer {n} minutes en partie', 'Play {n} minutes of matches', 'Juega {n} minutos de partida', 'Spiele {n} Minuten im Match', 'Joga {n} minutos de partida', 'Gioca {n} minuti di partita'],
  obj: ['Réussir {n} objectifs (zone prise, bombe posée ou désamorcée)', 'Complete {n} objectives (zone taken, bomb planted or defused)', 'Cumple {n} objetivos (zona tomada, bomba colocada o desactivada)', 'Erfülle {n} Ziele (Zone erobert, Bombe gelegt oder entschärft)', 'Cumpre {n} objetivos (zona tomada, bomba plantada ou desarmada)', 'Completa {n} obiettivi (zona presa, bomba piazzata o disinnescata)'],
  cat: ['{n} éliminations : {cat}', '{n} eliminations: {cat}', '{n} eliminaciones: {cat}', '{n} Eliminierungen: {cat}', '{n} eliminações: {cat}', '{n} eliminazioni: {cat}'],
  map: ['Terminer {n} parties sur {map}', 'Finish {n} matches on {map}', 'Termina {n} partidas en {map}', 'Beende {n} Matches auf {map}', 'Termina {n} partidas em {map}', 'Completa {n} partite su {map}'],
  mode: ['Terminer {n} parties en {mode}', 'Finish {n} matches of {mode}', 'Termina {n} partidas de {mode}', 'Beende {n} Matches im Modus {mode}', 'Termina {n} partidas de {mode}', 'Completa {n} partite in {mode}'],
  mode1: ['Terminer une partie en {mode}', 'Finish a match of {mode}', 'Termina una partida de {mode}', 'Beende ein Match im Modus {mode}', 'Termina uma partida de {mode}', 'Completa una partita in {mode}'],
  online: ['Terminer {n} parties en ligne', 'Finish {n} online matches', 'Termina {n} partidas en línea', 'Beende {n} Online-Matches', 'Termina {n} partidas online', 'Completa {n} partite online'],
  streak: ['Enchaîner {n} éliminations sans mourir', 'Chain {n} eliminations without dying', 'Encadena {n} eliminaciones sin morir', '{n} Eliminierungen ohne zu sterben', 'Encadeia {n} eliminações sem morrer', 'Concatena {n} eliminazioni senza morire'],
  waves: ['Survivre à {n} vagues de zombies', 'Survive {n} zombie waves', 'Sobrevive a {n} oleadas de zombis', 'Überlebe {n} Zombiewellen', 'Sobrevive a {n} vagas de zombies', 'Sopravvivi a {n} ondate di zombie'],
};
const fill = (s, p) => String(s).replace(/\{(\w+)\}/g, (_, k) => (p && p[k] !== undefined ? p[k] : `{${k}}`));
export const word = (key, lang, p) => fill(pick(W[key], lang), p);
/** names: { cat(id), map(id), mode(id) } -> localised names (from i18n); missing ones fall back to the id. */
export function contractText(c, lang, names = {}) {
  const key = c.metric === 'wins' && c.n === 1 ? 'wins1' : c.metric === 'mode' && c.n === 1 ? 'mode1' : c.metric;
  const nm = (f, id) => { try { const v = f && f(id); return v || id; } catch { return id; } };
  return fill(pick(CT[key] || [key], lang), { n: c.n, cat: nm(names.cat, c.param), map: nm(names.map, c.param), mode: nm(names.mode, c.param) });
}
/** "54 j 3 h", "5 h 12 min", "8 min". */
const UNITS = { fr: ['j', 'h', 'min'], en: ['d', 'h', 'min'], es: ['d', 'h', 'min'], de: ['T', 'Std', 'Min'], pt: ['d', 'h', 'min'], it: ['g', 'h', 'min'] };
export function fmtLeft(ms, lang) {
  const u = UNITS[lang] || UNITS.fr, m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d > 0 ? `${d} ${u[0]} ${h} ${u[1]}` : h > 0 ? `${h} ${u[1]} ${mm} ${u[2]}` : `${Math.max(1, mm)} ${u[2]}`;
}
/** Objective labels written by modes.js on its end screens (all six languages), so an objective counts whatever the language. A test compares them with modes.js. */
export const OBJ_LABELS = {
  caps: ['Captures', 'Captures', 'Capturas', 'Eroberungen', 'Capturas', 'Conquiste'],
  plants: ['Bombes posées', 'Bombs planted', 'Bombas colocadas', 'Gelegte Bomben', 'Bombas plantadas', 'Bombe piazzate'],
  defuses: ['Désamorçages', 'Defuses', 'Desactivaciones', 'Entschärfungen', 'Desarmes', 'Disinneschi'],
  wave: ['Vague atteinte', 'Wave reached', 'Oleada alcanzada', 'Erreichte Welle', 'Vaga alcançada', 'Ondata raggiunta'],
};
/** Objectives and survived waves of a match, read from the end-screen stats of modes.js. */
export function objectivesFromStats(stats, won) {
  let obj = 0, waves = 0;
  for (const s of Array.isArray(stats) ? stats : []) {
    if (!s || typeof s.label !== 'string') continue;
    const v = Math.max(0, Math.floor(+s.value || 0));
    if (OBJ_LABELS.caps.includes(s.label) || OBJ_LABELS.plants.includes(s.label) || OBJ_LABELS.defuses.includes(s.label)) obj += Math.min(v, 30);
    else if (OBJ_LABELS.wave.includes(s.label)) waves = Math.min(30, won === true ? v : Math.max(0, v - 1));
  }
  return { obj, waves };
}
