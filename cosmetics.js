// FRONT ZÉRO — cosmetics catalogue: weapon finishes, sets, rarities and the price curve. Pure data, no three.js, no DOM.
// PRICES ARE STRUCTURES ({ credits: 1200 }) so a second currency could be added later as one more key. No payment code exists anywhere and none
// may be added here. Agreed rule if real money ever comes: cosmetics only, weapons and gear stay earnable by playing, no paid random boxes.
// All names and patterns are original.

export const LANG_ORDER = ['fr', 'en', 'es', 'de', 'pt', 'it'];
export const pickLang = (arr, lang) => { if (!Array.isArray(arr)) return String(arr ?? ''); const i = LANG_ORDER.indexOf(lang); return arr[i < 0 ? 0 : i] ?? arr[0]; };

/* ---------- rarity and price curve ----------
   A match pays about 500 credits for a modest game and 1 500 to 2 200 for a good one (kill 75, headshot +30, streak bonuses, end bonus 120 to 900, rewards already ×3).
   So: common after 1 match, uncommon after 2, rare after 3 to 5, epic after 6 to 10, legendary after 12 to 20. */
export const RARITIES = [
  { id: 'common', color: '#9aa39a', rank: 0, n: ['Commun', 'Common', 'Común', 'Gewöhnlich', 'Comum', 'Comune'] },
  { id: 'uncommon', color: '#6fbf6a', rank: 1, n: ['Peu commun', 'Uncommon', 'Poco común', 'Ungewöhnlich', 'Incomum', 'Non comune'] },
  { id: 'rare', color: '#58a6e8', rank: 2, n: ['Rare', 'Rare', 'Raro', 'Selten', 'Raro', 'Raro'] },
  { id: 'epic', color: '#b57bee', rank: 3, n: ['Épique', 'Epic', 'Épico', 'Episch', 'Épico', 'Epico'] },
  { id: 'legendary', color: '#e8a628', rank: 4, n: ['Légendaire', 'Legendary', 'Legendario', 'Legendär', 'Lendário', 'Leggendario'] },
];
export const rarityOf = id => RARITIES.find(r => r.id === id) || RARITIES[0];
export const FINISH_PRICE = { common: 800, uncommon: 1500, rare: 3000, epic: 6000, legendary: 12000 };
export const OUTFIT_PRICE = { common: 1000, uncommon: 2000, rare: 3500, epic: 7000, legendary: 14000 };
/** Set price: the sum of its parts, less this share, rounded down to 50 credits. */
export const SET_DISCOUNT = 0.15;
export const setPrice = sum => Math.floor(sum * (1 - SET_DISCOUNT) / 50) * 50;
/** The amount of one currency in a price structure. */
export const creditsOf = price => (price && Number.isFinite(price.credits) ? Math.max(0, Math.floor(price.credits)) : 0);
/* Optional second price, STORED ONLY: { credits: 12000, real: { eur: 4.99 } }. Nothing displays it, nothing sells it, the ledger only ever reads
   `credits`. Selling for real money needs server accounts, verified purchases and a payment provider the player sets up himself: none exists here.
   Agreed rule: only cosmetics (finish, outfit, set) may carry one; weapons and equipment stay earnable by playing; no paid random boxes. cleanPrice enforces it. */
export const REAL_CURRENCIES = ['eur'];
export const REAL_KINDS = ['finish', 'outfit', 'set'];
export function cleanPrice(price, kind) {
  const out = { credits: creditsOf(price) }, r = price && price.real;
  if (r && typeof r === 'object' && REAL_KINDS.includes(kind)) {
    const k = {}; for (const c of REAL_CURRENCIES) if (Number.isFinite(r[c]) && r[c] > 0 && r[c] < 1000) k[c] = Math.round(r[c] * 100) / 100;
    if (Object.keys(k).length) out.real = k;
  }
  return out;
}
/** The stored real-currency price of a cosmetic, or null. For a future server-verified store only; never used by the game today. */
export const realPriceOf = item => (item && item.price && item.price.real ? { ...item.price.real } : item && item.realPrice ? { ...item.realPrice } : null);

/* ---------- weapon finishes ----------
   pattern: which generator of weapon-skins.js draws it. c: its colours, darkest first. accent: colour of the accent role. */
const F = (id, pattern, rarity, c, accent, n, extra) => { const o = { id, pattern, rarity, c, accent, n, level: 1, ...extra }; o.price = cleanPrice({ credits: FINISH_PRICE[rarity], ...(extra && extra.price) }, 'finish'); return o; };
const MAPF = (id, map, mapName, pattern, rarity, c, accent, words, level) => F(id, pattern, rarity, c, accent, words.map(w => `${mapName} · ${w}`), { family: 'map', map, mapName, level });
const ECL = (id, colorway, accent, rarity, n, extra) => F(id, 'eclipse', rarity, [0x0d0f13, 0x15181d, 0x262a31], accent, n, { family: 'eclipse', colorway, ...extra });

export const FINISHES = [
  /* ÉCLIPSE: matte black, coloured accents, subtle panel wear. One per outfit colourway. */
  ECL('ecl_jaune', 'noir-jaune', 0xf2c21c, 'epic', ['Éclipse Noir/Jaune', 'Eclipse Black/Yellow', 'Eclipse Negro/Amarillo', 'Eclipse Schwarz/Gelb', 'Eclipse Preto/Amarelo', 'Eclipse Nero/Giallo']),
  ECL('ecl_rouge', 'noir-rouge', 0xdf2a22, 'epic', ['Éclipse Noir/Rouge', 'Eclipse Black/Red', 'Eclipse Negro/Rojo', 'Eclipse Schwarz/Rot', 'Eclipse Preto/Vermelho', 'Eclipse Nero/Rosso']),
  ECL('ecl_blanc', 'noir-blanc', 0xe6e6e0, 'epic', ['Éclipse Noir/Blanc', 'Eclipse Black/White', 'Eclipse Negro/Blanco', 'Eclipse Schwarz/Weiß', 'Eclipse Preto/Branco', 'Eclipse Nero/Bianco']),
  ECL('ecl_arctique', 'arctique', 0x9fd8ea, 'epic', ['Éclipse Arctique', 'Eclipse Arctic', 'Eclipse Ártico', 'Eclipse Arktis', 'Eclipse Ártico', 'Eclipse Artico']),
  ECL('ecl_desert', 'desert', 0xd2a868, 'epic', ['Éclipse Désert', 'Eclipse Desert', 'Eclipse Desierto', 'Eclipse Wüste', 'Eclipse Deserto', 'Eclipse Deserto']),
  ECL('ecl_foret', 'foret', 0x6f9a48, 'epic', ['Éclipse Forêt', 'Eclipse Forest', 'Eclipse Bosque', 'Eclipse Wald', 'Eclipse Floresta', 'Eclipse Foresta']),
  ECL('ecl_cyan', 'acier-cyan', 0x2fd6d8, 'epic', ['Éclipse Acier/Cyan', 'Eclipse Steel/Cyan', 'Eclipse Acero/Cian', 'Eclipse Stahl/Cyan', 'Eclipse Aço/Ciano', 'Eclipse Acciaio/Ciano'], { c: [0x1a1d21, 0x262a30, 0x383d44] }),
  ECL('ecl_or', 'or-noir', 0xd9a93a, 'legendary', ['Éclipse Or Noir', 'Eclipse Black Gold', 'Eclipse Oro Negro', 'Eclipse Schwarzgold', 'Eclipse Ouro Negro', 'Eclipse Oro Nero'], { level: 15 }),
  /* digital camouflages */
  F('pix_foret', 'digital', 'common', [0x20281b, 0x37432a, 0x566240, 0x7f8560], 0x2c3324, ['Pixel Sous-bois', 'Understory Pixel', 'Píxel Sotobosque', 'Pixel Unterholz', 'Pixel Sub-bosque', 'Pixel Sottobosco']),
  F('pix_sable', 'digital', 'common', [0x6f5f45, 0x94805c, 0xb8a47c, 0xd6c8a4], 0x57492f, ['Pixel Dune', 'Dune Pixel', 'Píxel Duna', 'Pixel Düne', 'Pixel Duna', 'Pixel Duna']),
  F('pix_neige', 'digital', 'uncommon', [0x6c777d, 0x9aa5a9, 0xc6cfd1, 0xecf0f0], 0x4c565c, ['Pixel Névé', 'Firn Pixel', 'Píxel Neviza', 'Pixel Firn', 'Pixel Neve', 'Pixel Nevato']),
  /* organic camouflages */
  F('sylve', 'woodland', 'uncommon', [0x1b1f15, 0x3a4628, 0x5d5a38, 0x7c7650], 0x2b3020, ['Sylve', 'Sylvan', 'Silva', 'Forsthain', 'Silvestre', 'Silvano']),
  F('givre', 'woodland', 'rare', [0x8b989f, 0xb3bfc4, 0xd8e0e2, 0xf1f4f4], 0x56636a, ['Givre', 'Hoarfrost', 'Escarcha', 'Raureif', 'Geada', 'Brina']),
  F('fauve', 'tiger', 'rare', [0x15120d, 0x47331a, 0x8a6a33, 0xb4935a], 0x241a0c, ['Fauve', 'Wildcat', 'Fiera', 'Raubkatze', 'Fera', 'Belva']),
  F('eclats', 'splinter', 'rare', [0x23282e, 0x3d4650, 0x626e7a, 0x98a3ad], 0x1b1f24, ['Éclats', 'Shards', 'Esquirlas', 'Splitter', 'Estilhaços', 'Schegge']),
  /* materials */
  F('carbone', 'carbon', 'rare', [0x0c0d0f, 0x1b1d21, 0x2e3137], 0x3a3e45, ['Carbone Tressé', 'Woven Carbon', 'Carbono Trenzado', 'Karbongewebe', 'Carbono Trançado', 'Carbonio Intrecciato']),
  F('acier', 'brushed', 'uncommon', [0x6e7276, 0x93979b, 0xb9bdc0], 0x3b3e42, ['Acier Brossé', 'Brushed Steel', 'Acero Cepillado', 'Gebürsteter Stahl', 'Aço Escovado', 'Acciaio Spazzolato']),
  F('obsidienne', 'veined', 'epic', [0x08090c, 0x14161c, 0x2a2e38, 0x8a7cc8], 0x8a7cc8, ['Obsidienne', 'Obsidian', 'Obsidiana', 'Obsidian', 'Obsidiana', 'Ossidiana'], { level: 10 }),
  F('cuivre', 'heat', 'epic', [0x2a1610, 0x7a3a1e, 0xb8622e, 0x5a3f7a], 0xd98a4a, ['Cuivre Brûlé', 'Burnt Copper', 'Cobre Quemado', 'Gebranntes Kupfer', 'Cobre Queimado', 'Rame Bruciato'], { level: 10 }),
  F('dorure', 'gilded', 'legendary', [0x6d4c14, 0xb48a2c, 0xe2bc55, 0xf8e6a4], 0xf2d27a, ['Dorure', 'Gilded', 'Dorado', 'Vergoldet', 'Dourado', 'Doratura'], { level: 20 }),
  /* one per map, drawn from its look (map name kept as a proper noun in every language) */
  MAPF('map_depot', 'depot', 'Dépôt 7', 'mottle', 'rare', [0x6e5f45, 0x9c8762, 0xc4ae84, 0xd8c69c], 0x8c3d24, ['Sable de piste', 'Airstrip Sand', 'Arena de pista', 'Pistensand', 'Areia de pista', 'Sabbia di pista'], 6),
  MAPF('map_vieille_ville', 'vieille-ville', 'Vieille Ville', 'cobble', 'epic', [0x3e4044, 0x6c6e70, 0x8f8f8c, 0xb04f32], 0xb04f32, ['Pavé et tuile', 'Cobble and Tile', 'Adoquín y teja', 'Pflaster und Ziegel', 'Calçada e telha', 'Selciato e coppo'], 10),
  MAPF('map_port', 'port', 'Port du Couchant', 'patchwork', 'epic', [0x23282d, 0x6e3a2f, 0x86683f, 0x4a543c, 0x3c4a57], 0xd07a44, ['Conteneurs', 'Containers', 'Contenedores', 'Container', 'Contentores', 'Container'], 10),
  MAPF('map_bunker', 'bunker', 'Bunker Sigma', 'concrete', 'rare', [0x5b5352, 0x7d7270, 0x9a8f8b, 0xb7aca6], 0xe0b21e, ['Béton de coffrage', 'Shuttered Concrete', 'Hormigón encofrado', 'Schalbeton', 'Betão cofrado', 'Cemento cassero'], 6),
  MAPF('map_col_blanc', 'col-blanc', 'Col Blanc', 'facet', 'legendary', [0x3a4146, 0x6c7378, 0xc9d1d6, 0xeef1f3], 0x2f5146, ['Arête', 'Ridgeline', 'Arista', 'Grat', 'Aresta', 'Cresta'], 14),
  MAPF('map_sept_vents', 'sept-vents', 'Piste Sept-Vents', 'asphalt', 'rare', [0x2b2d2f, 0x45484a, 0x5e6163, 0x7b7e7f], 0xd8b23a, ['Tarmac', 'Tarmac', 'Asfalto', 'Rollfeld', 'Asfalto', 'Asfalto'], 6),
  MAPF('map_noirval', 'noirval', 'Raffinerie Noirval', 'crackle', 'epic', [0x17181a, 0x3a3735, 0x5c5450, 0xc9742e], 0xd98a3a, ['Brut', 'Crude', 'Crudo', 'Rohöl', 'Bruto', 'Greggio'], 10),
  MAPF('map_val_cendre', 'val-cendre', 'Val de Cendre', 'woodland', 'rare', [0x2e3329, 0x5d6450, 0x8a8b83, 0x9c5f30], 0xa8622c, ['Feuilles d’octobre', 'October Leaves', 'Hojas de octubre', 'Oktoberlaub', 'Folhas de outubro', 'Foglie d’ottobre'], 6),
  MAPF('map_roqueseche', 'roqueseche', 'Roquesèche', 'topo', 'legendary', [0x7a4a33, 0xb08e62, 0xcfb487, 0xe6d3a8], 0xa6553a, ['Relevé de crête', 'Ridge Survey', 'Plano de cresta', 'Kammvermessung', 'Levantamento de crista', 'Rilievo di cresta'], 14),
  MAPF('map_barrage', 'barrage', 'Barrage d’Aiguenoire', 'spillway', 'epic', [0x24282b, 0x4a4f53, 0x6f7477, 0x9c9e98], 0x9a4a2a, ['Déversoir', 'Spillway', 'Aliviadero', 'Überlauf', 'Vertedouro', 'Sfioratore'], 10),
  MAPF('map_marais', 'marais', 'Marais de Saulnes', 'reeds', 'rare', [0x1a1e16, 0x3c3e28, 0x6a6140, 0x958659], 0xc0522c, ['Roselière', 'Reed Bed', 'Carrizal', 'Schilfgürtel', 'Caniçal', 'Canneto'], 6),
  MAPF('map_cite', 'cite', 'Cité Verrière', 'shatter', 'legendary', [0x464d54, 0x4c5a60, 0x24585e, 0xd8e8ec], 0xa9cdd4, ['Verre brisé', 'Shattered Glass', 'Cristal roto', 'Splitterglas', 'Vidro estilhaçado', 'Vetro infranto'], 14),
];
const FIN_MAP = new Map(FINISHES.map(f => [f.id, f]));       // shop finishes, then those registered by the season pass (see registerFinishes)
export const finishById = id => FIN_MAP.get(id) || null;
export const isFinish = id => typeof id === 'string' && FIN_MAP.has(id);
export const finishName = (f, lang) => pickLang(f.n, lang);
/** Ids sold in the shop. server/server.js keeps a copy (FIN_IDS), compared by a test. */
export const FINISH_IDS = FINISHES.map(f => f.id);       // grows with registerFinishes
/** The shop's own ids, fixed: server/server.js copies exactly these into FIN_IDS (a test compares them); season ids pass there by PASS_ID. */
export const SHOP_FINISH_IDS = Object.freeze(FINISH_IDS.slice());
/** Every pattern weapon-skins.js can draw. */
export const FINISH_PATTERNS = ['digital', 'woodland', 'tiger', 'splinter', 'carbon', 'brushed', 'gilded', 'heat', 'veined', 'eclipse', 'mottle', 'cobble', 'patchwork', 'concrete', 'facet', 'asphalt', 'crackle', 'topo', 'spillway', 'reeds', 'shatter'];

/* filter groups shown in the shop */
export const FINISH_GROUPS = [
  { id: 'eclipse', n: ['Éclipse', 'Eclipse', 'Eclipse', 'Eclipse', 'Eclipse', 'Eclipse'], test: f => f.family === 'eclipse' && !f.source },
  { id: 'camo', n: ['Camouflages', 'Camouflage', 'Camuflajes', 'Tarnmuster', 'Camuflagens', 'Mimetiche'], test: f => !f.source && f.family !== 'map' && ['digital', 'woodland', 'tiger', 'splinter'].includes(f.pattern) },
  { id: 'material', n: ['Matières', 'Materials', 'Materiales', 'Materialien', 'Materiais', 'Materiali'], test: f => !f.source && f.family !== 'map' && ['carbon', 'brushed', 'veined', 'heat', 'gilded'].includes(f.pattern) },
  { id: 'map', n: ['Cartes', 'Maps', 'Mapas', 'Karten', 'Mapas', 'Mappe'], test: f => f.family === 'map' && !f.source },
  { id: 'pass', n: ['Passe', 'Pass', 'Pase', 'Pass', 'Passe', 'Pass'], test: f => f.source === 'pass' },
];

/* ---------- outfits ---------- */
const OUTFIT_RARITY = { Standard: 'common', 'Spécial': 'uncommon', 'Élite': 'rare', 'Légende': 'legendary' };
/** The rarity id of an entry of OUTFITS (data.js) or OUTFIT_SETS (outfit-eclipse.js). */
export function outfitRarity(o) {
  if (!o) return 'common';
  if (RARITIES.some(r => r.id === o.rarity)) return o.rarity;
  const low = String(o.rarity || '').toLowerCase();
  if (low.startsWith('l')) return 'legendary'; if (low.startsWith('é') || low.startsWith('ep')) return 'epic';
  return OUTFIT_RARITY[o.r] || 'common';
}
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
/** Which ÉCLIPSE finish goes with an outfit colourway ("Noir/Jaune", "Or Noir", "Acier/Cyan"...). */
export function finishForColorway(colorway) {
  const k = norm(colorway);
  return FINISHES.find(f => f.family === 'eclipse' && (f.colorway === k || k.includes(f.colorway))) || null;
}
/** Price structure of an outfit: its own, or the one of its rarity. */
export function outfitPrice(o) {
  if (o && o.price && typeof o.price === 'object') return cleanPrice(o.price, 'outfit');
  if (o && Number.isFinite(o.price)) return { credits: o.price };
  return { credits: OUTFIT_PRICE[outfitRarity(o)] };
}

/* ---------- sets: an outfit plus its finishes, a small discount, each piece still sold alone ---------- */
const BASE_SETS = [
  { id: 'set_foret', outfit: 'foret', finishes: ['pix_foret', 'sylve'], n: ['Ensemble Sous-bois', 'Understory Set', 'Conjunto Sotobosque', 'Set Unterholz', 'Conjunto Sub-bosque', 'Set Sottobosco'] },
  { id: 'set_arctique', outfit: 'arctique', finishes: ['pix_neige', 'givre'], n: ['Ensemble Banquise', 'Ice Shelf Set', 'Conjunto Banquisa', 'Set Packeis', 'Conjunto Banquisa', 'Set Banchisa'] },
  { id: 'set_urbain', outfit: 'urbain', finishes: ['eclats', 'acier'], n: ['Ensemble Béton', 'Concrete Set', 'Conjunto Hormigón', 'Set Beton', 'Conjunto Betão', 'Set Cemento'] },
  { id: 'set_nuit', outfit: 'nuit', finishes: ['carbone', 'obsidienne'], n: ['Ensemble Nuit Noire', 'Pitch Night Set', 'Conjunto Noche Cerrada', 'Set Finsternacht', 'Conjunto Noite Cerrada', 'Set Notte Fonda'] },
  { id: 'set_braise', outfit: 'braise', finishes: ['cuivre', 'fauve'], n: ['Ensemble Fournaise', 'Furnace Set', 'Conjunto Horno', 'Set Glutofen', 'Conjunto Fornalha', 'Set Fornace'] },
];
const SET_WORD = ['Ensemble', 'Set', 'Conjunto', 'Set', 'Conjunto', 'Set'];
/** All sets, from the base outfits and whatever ÉCLIPSE colourways exist. */
export function buildSets(outfits, outfitSets) {
  const out = [], known = id => outfits.some(o => o.id === id) || (outfitSets || []).some(o => o.id === id);
  for (const s of BASE_SETS) if (known(s.outfit)) out.push({ ...s, finishes: s.finishes.slice(), realPrice: cleanPrice({ real: s.real }, 'set').real || null });       // realPrice: stored only, see cleanPrice
  for (const o of outfitSets || []) {
    if (notSold(o)) continue;        // a season-pass colourway is not sold, so it is in no set either
    if (o.setId && o.setId !== 'eclipse') continue;        // the ÉCLIPSE finishes belong to ÉCLIPSE only (a COLOSSE colourway named like one is not its set)
    const f = finishForColorway(o.colorway || o.name); if (!f) continue;
    out.push({ id: 'set_' + o.id, outfit: o.id, finishes: [f.id], family: 'eclipse', n: LANG_ORDER.map((_, i) => `${SET_WORD[i]} ${pickLang(f.n, LANG_ORDER[i])}`) });
  }
  return out;
}
/** Parts of a set that still have to be paid, and what that costs now (already owned parts are not charged twice). */
export function setQuote(set, ownsOutfit, ownsFinish, outfitOf) {
  const missing = { outfit: ownsOutfit(set.outfit) ? null : set.outfit, finishes: set.finishes.filter(id => !ownsFinish(id)) };
  const full = creditsOf(outfitPrice(outfitOf(set.outfit))) + set.finishes.reduce((n, id) => n + creditsOf(finishById(id)?.price), 0);
  const left = (missing.outfit ? creditsOf(outfitPrice(outfitOf(set.outfit))) : 0) + missing.finishes.reduce((n, id) => n + creditsOf(finishById(id)?.price), 0);
  const parts = (missing.outfit ? 1 : 0) + missing.finishes.length, whole = 1 + set.finishes.length;
  const pay = parts === whole ? setPrice(full) : parts > 1 ? setPrice(left) : left;       // one single missing piece has no discount left to give
  return { full, left, pay, missing, complete: parts === 0, saved: Math.max(0, left - pay) };
}

/* ---------- save data ---------- */
/** A clean copy of the cosmetics part of a save, whatever it held. A finish id that is not known yet is kept when it is a season id
    (PASS_ID: its module may register it after the profile loads); it stays inert until then (not owned, not shown, never applied). Outfit ids are kept likewise. */
export const PASS_ID = /^s\d+_[a-z0-9_]{1,24}$/;
const keepFin = x => isFinish(x) || PASS_ID.test(x);
export function cleanCos(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}, ids = a => (Array.isArray(a) ? a.filter(x => typeof x === 'string') : []);
  const w = {}; if (o.w && typeof o.w === 'object' && !Array.isArray(o.w)) for (const k of Object.keys(o.w).slice(0, 120)) { if (k.length < 16 && typeof o.w[k] === 'string' && keepFin(o.w[k])) w[k] = o.w[k]; }
  return { fin: [...new Set(ids(o.fin).filter(keepFin))].slice(0, 400), out: [...new Set(ids(o.out).map(x => x.slice(0, 40)))].slice(0, 200), w, outfit: typeof o.outfit === 'string' ? o.outfit.slice(0, 40) : null, tx: ids(o.tx).slice(-24) };
}

/* ---------- season pass hook: another module adds finishes that are not sold ----------
   registerFinishes(list) -> ids added. Each def has the shape of F(): { id (PASS_ID, e.g. 's1_signal'), pattern (one of FINISH_PATTERNS), rarity,
   c: [3 to 5 colours 0xRRGGBB, darkest first], accent: 0xRRGGBB, n: [6 names fr en es de pt it], level, source: 'pass', season: 's1', passTier: n,
   passTrack: 'free' | 'premium', price: null, picture?: true when weapon-shots/fin-<id>.webp ships (otherwise the card shows the pattern) }. Duplicate or malformed defs are ignored. Added ids go to FINISHES, FIN_MAP and FINISH_IDS.
   price null (or source 'pass') = not sold: the ledger refuses to sell it, the shop shows "Pass · tier N", never in the weekly rotation.
   Ownership is written only by the ledger: profile.grant('finish', id, 'pass') (shop-ledger.js). */
const isCol = x => Number.isInteger(x) && x >= 0 && x <= 0xffffff;
const TRACKS = ['free', 'premium'];
export function registerFinishes(list) {
  const added = [];
  for (const x of Array.isArray(list) ? list : []) {
    if (!x || typeof x.id !== 'string' || !PASS_ID.test(x.id) || FIN_MAP.has(x.id)) continue;
    if (!FINISH_PATTERNS.includes(x.pattern) || !RARITIES.some(r => r.id === x.rarity) || !Array.isArray(x.c) || x.c.length < 3 || x.c.length > 5 || !x.c.every(isCol) || !isCol(x.accent)) continue;
    if (!Array.isArray(x.n) || x.n.length !== 6 || !x.n.every(t => typeof t === 'string' && t.length > 0 && t.length <= 40)) continue;
    const e = { id: x.id, pattern: x.pattern, rarity: x.rarity, c: x.c.slice(), accent: x.accent, n: x.n.slice(), level: Number.isInteger(x.level) && x.level >= 1 && x.level <= 99 ? x.level : 1,
      source: typeof x.source === 'string' ? x.source.slice(0, 12) : 'pass', season: typeof x.season === 'string' ? x.season.slice(0, 8) : null, passTier: Number.isInteger(x.passTier) ? x.passTier : null,
      passTrack: TRACKS.includes(x.passTrack) ? x.passTrack : null, picture: x.picture === true, price: x.price === null || x.price === undefined ? null : cleanPrice(x.price, 'finish') };
    FINISHES.push(e); FIN_MAP.set(e.id, e); FINISH_IDS.push(e.id); added.push(e.id);
  }
  return added;
}
/** Not for sale: a price of null, or a season-pass item. */
export const notSold = f => !!f && (f.price === null || f.source === 'pass');

/* ---------- weekly rotation: same selection for everyone, without a server ----------
   Changes every Monday at 00:00 local time. Seeded by the week number, so two players on the same version and time zone see the same shop. */
const WEEK0 = () => new Date(2026, 0, 5);      // a Monday
/** Local midnight of the Monday that starts this date's week. */
export function weekStart(date = new Date()) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; }
/** Weeks since 5 January 2026 (rounded, so a daylight-saving hour never shifts it). */
export function weekIndex(date = new Date()) { return Math.round((weekStart(date) - WEEK0()) / 6048e5); }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** pool: [{ key: 'finish:<id>' | 'outfit:<id>', kind, rarity, family?, notSold? }] (items not sold are ignored). Returns { week, start, end, featured, keys }: 6 to 8 keys, featured first. */
export function weeklyRotation(pool, date = new Date()) {
  const week = weekIndex(date), start = weekStart(date), end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const list = pool.filter(x => x && typeof x.key === 'string' && !x.notSold).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const R = rng(0x9e3779b9 ^ Math.imul(week + 1013, 2654435761));
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; }
  const count = Math.min(list.length, 6 + Math.floor(R() * 3));
  if (!count) return { week, start, end, featured: null, keys: [] };
  // featured: an epic or legendary finish first (it has a real picture for the large slot), then any epic or legendary item
  const featured = list.find(x => x.kind === 'finish' && rarityOf(x.rarity).rank >= 3) || list.find(x => rarityOf(x.rarity).rank >= 3) || list[0], out = [featured], fam = {};
  const capOf = f => (f === 'eclipse' || f === 'map' ? 2 : 9);
  fam[featured.family] = 1;
  for (const x of list) { if (out.length >= count) break; if (x === featured || (fam[x.family] || 0) >= capOf(x.family)) continue; out.push(x); fam[x.family] = (fam[x.family] || 0) + 1; }
  for (const x of list) { if (out.length >= count) break; if (!out.includes(x)) out.push(x); }        // small pools: fill without the family caps
  if (!out.some(x => x.kind === 'outfit')) { const o = list.find(x => x.kind === 'outfit'); if (o && out.length > 1) out[out.length - 1] = o; }       // at least one outfit when there is one
  return { week, start, end, featured: featured.key, keys: out.map(x => x.key) };
}
