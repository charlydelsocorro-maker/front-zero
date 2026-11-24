// FRONT ZÉRO — weapon attachments: catalogue, trade-offs, level unlocks, low-poly models for soldiers and drops, pooled laser.
// No import of three here: this file also loads in Node (tests). Whatever needs three receives it as an argument.
// Attachments NEVER change damage, pellets, range, headshot factor or rate of fire: the sniper's one-shot kill cannot be affected.
import { ALL_WEAPONS, WEAPON_LEVELS, TEST_UNLOCK_ALL } from './data.js';
import { EXTRA_ATT } from './weapons-extra.js';

export const ATT_SLOTS = ['optic', 'muzzle', 'mag', 'under', 'rail'];
export const XP_PER_LEVEL = 1000;
export const levelOfXp = xp => Math.floor((+xp || 0) / XP_PER_LEVEL) + 1;

/* m: multipliers. rec recoil, spread (all spread), hip (hip-fire only), aim (time to aim, >1 is slower), reload, mob, flash, loud; magMul magazine. */
export const ATTACHMENTS = {
  dot: { id: 'dot', slot: 'optic', lvl: 2, m: { aim: 1.04, spread: .95 } },
  hider: { id: 'hider', slot: 'muzzle', lvl: 4, m: { flash: .22, rec: .95, aim: 1.05 } },
  vg: { id: 'vg', slot: 'under', lvl: 6, m: { rec: .84, aim: 1.08, mob: .985 } },
  sup: { id: 'sup', slot: 'muzzle', lvl: 7, m: { flash: 0, loud: .4, rec: .94, spread: 1.05, aim: 1.08, mob: .985 } },
  fast: { id: 'fast', slot: 'mag', lvl: 9, m: { reload: .76, rec: 1.05, aim: 1.03 } },
  holo: { id: 'holo', slot: 'optic', lvl: 11, m: { aim: 1.08, spread: .9, mob: .995 } },
  ag: { id: 'ag', slot: 'under', lvl: 13, m: { aim: .88, rec: .95, spread: 1.05 } },
  ext: { id: 'ext', slot: 'mag', lvl: 15, m: { magMul: 1.35, reload: 1.16, mob: .97, aim: 1.05 } },
  comp: { id: 'comp', slot: 'muzzle', lvl: 17, m: { rec: .78, spread: 1.05, flash: 1.35, loud: 1.1 } },
  laser: { id: 'laser', slot: 'rail', lvl: 20, m: { hip: .8, aim: 1.03 } },
  x4: { id: 'x4', slot: 'optic', lvl: 23, m: { aim: 1.28, spread: .72, hip: 1.12, mob: .97 }, zoom: 4 },
};

const FULL = { optic: ['dot', 'holo', 'x4'], muzzle: ['sup', 'comp', 'hider'], mag: ['ext', 'fast'], under: ['vg', 'ag'], rail: ['laser'] };
const SMG = { ...FULL, optic: ['dot', 'holo'] };
const PISTOL = { optic: ['dot'], muzzle: ['sup', 'comp'], mag: ['ext', 'fast'], rail: ['laser'] };
/** What physically fits each weapon. Absent (knife, grenade) = nothing. */
export const WEAPON_SLOTS = {
  p9: PISTOL, hp: PISTOL, mp: PISTOL, rev: { optic: ['dot'], rail: ['laser'] },
  ar: FULL, car: FULL, akr: FULL, brst: FULL, bat: FULL, dmr: FULL,
  smg: SMG, pdw: SMG, hsmg: SMG,
  sg: { optic: ['dot', 'holo'], muzzle: ['comp', 'hider'], mag: ['ext'], rail: ['laser'] },
  asg: { optic: ['dot', 'holo'], muzzle: ['comp', 'hider'], mag: ['ext', 'fast'], under: ['vg', 'ag'], rail: ['laser'] },
  dbs: { optic: ['dot'], rail: ['laser'] },
  lmg: { optic: ['dot', 'holo', 'x4'], muzzle: ['comp', 'hider'], mag: ['ext'], rail: ['laser'] },
  mini: { optic: ['dot', 'holo'], rail: ['laser'] },
  sr: { muzzle: ['sup', 'comp'], mag: ['ext', 'fast'], rail: ['laser'] },
  hsr: { muzzle: ['comp'], mag: ['fast'], rail: ['laser'] },
  rl: { rail: ['laser'] },
  gl: { optic: ['dot', 'holo'], rail: ['laser'] },
  xbow: { optic: ['dot', 'x4'], rail: ['laser'] },
};
for (const [id, list] of Object.entries(EXTRA_ATT)) { const s = {}; for (const a of list.split(' ')) (s[ATTACHMENTS[a].slot] ||= []).push(a); WEAPON_SLOTS[id] = s; }
export const slotsOf = wid => WEAPON_SLOTS[wid] || {};
export const fits = (wid, id) => { const a = ATTACHMENTS[id]; return !!a && !!(slotsOf(wid)[a.slot] || []).includes(id); };
/** Keeps legal ids only, one per slot, in slot order (a stable key for caches and the network). */
export function sanitize(wid, ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const out = [];
  for (const s of ATT_SLOTS) { const hit = ids.find(i => typeof i === 'string' && ATTACHMENTS[i] && ATTACHMENTS[i].slot === s && fits(wid, i)); if (hit) out.push(hit); }
  return out;
}
/** The server holds the same rule (ATT_ALLOW and attMag in server/server.js). */
export const extendedMag = mag => Math.max(mag + 1, Math.round(mag * 1.35));

const cache = new Map();
/** The weapon as carried: a cached copy of the base definition (the base object is never touched). Same def + ids = same object, no allocation. */
export function applyAttachments(def, ids) {
  const base = def && def.base ? def.base : def;
  if (!base || !WEAPON_SLOTS[base.id]) return base;
  const list = sanitize(base.id, ids); if (!list.length) return base;
  const key = base.id + ':' + list.join(','); let e = cache.get(key); if (e) return e;
  let rec = 1, spread = 1, hip = 1, aim = 1, reload = 1, mob = 1, flash = 1, loud = 1, magged = false, zoom = 0;
  for (const id of list) {
    const a = ATTACHMENTS[id], m = a.m;
    if (m.rec) rec *= m.rec; if (m.spread) spread *= m.spread; if (m.hip) hip *= m.hip; if (m.aim) aim *= m.aim; if (m.reload) reload *= m.reload; if (m.mob) mob *= m.mob;
    if (m.flash !== undefined) flash *= m.flash; if (m.loud) loud *= m.loud; if (m.magMul) magged = true; if (a.zoom) zoom = a.zoom;
  }
  e = { ...base, base, att: list, attKey: list.join(','), rec: base.rec * rec, spread: base.spread * spread, reload: base.reload * reload, mob: base.mob * mob, mag: magged ? extendedMag(base.mag) : base.mag, recK: rec, hipK: hip, aimK: aim, flashK: flash, loudK: loud, laser: list.includes('laser') };
  if (list.includes('sup')) e.silent = true;
  if (zoom) { e.fov = Math.min(base.fov, 84 / zoom); e.scope = 'x' + zoom; e.scopeK = .82; }
  cache.set(key, Object.freeze(e));
  return e;
}

/* ---------- level rewards ---------- */
/** Everything the player earns on reaching this level: attachments and weapons that become available. */
export function rewardsAt(level) {
  const out = [];
  for (const k of Object.keys(ATTACHMENTS)) if (ATTACHMENTS[k].lvl === level) out.push({ type: 'att', id: k });
  for (const w of ALL_WEAPONS) if ((WEAPON_LEVELS[w.id] || 1) === level && level > 1) out.push({ type: 'weapon', id: w.id, name: w.name });
  return out;
}
export function nextReward(level) { for (let l = level + 1; l <= 40; l++) { const r = rewardsAt(l); if (r.length) return { level: l, rewards: r }; } return null; }
export const attUnlocked = (id, level) => !!ATTACHMENTS[id] && (TEST_UNLOCK_ALL || level >= ATTACHMENTS[id].lvl);
export const weaponLevel = id => WEAPON_LEVELS[id] || 1;

/* ---------- texts (six languages; fr is the fallback) ---------- */
const TXT = {
  fr: { optic: 'Optique', muzzle: 'Bouche', mag: 'Chargeur', under: 'Sous le canon', rail: 'Rail latéral', none: 'Aucun', dot: 'Point Braise', holo: 'Halo V2', x4: 'Vigie x4', sup: 'Silencieux Murmure', comp: 'Compensateur Butoir', hider: 'Cache-flamme Éteignoir', ext: 'Chargeur long Grenier', fast: 'Chargeur rapide Vif', vg: 'Poignée droite Pilier', ag: 'Poignée inclinée Biais', laser: 'Laser Fil Rouge', custom: 'Personnaliser', back: 'Retour', level: 'Niveau {n}', locked: 'Niveau {n} requis', next: 'Prochain déblocage', nextAt: 'Niveau {n} : {what}', unlocked: 'Niveau {n} : {what} débloqué', unlockedMany: 'Niveau {n} : {what} débloqués', newGear: 'Nouveaux déblocages', testAll: 'Mode test : tout est disponible', mastery: 'Maîtrise {n}', noSlots: 'Cette arme ne prend pas d’accessoire.', s_rec: 'Recul', s_spread: 'Précision', s_hip: 'Tir à la hanche', s_aim: 'Mise en joue', s_reload: 'Rechargement', s_mag: 'Chargeur', s_mob: 'Mobilité', s_flash: 'Flamme', s_loud: 'Bruit', zoom: 'Zoom x4', visible: 'Faisceau visible', weaponLock: 'Niveau {n} requis pour l’acheter', base: 'Base', with: 'Équipée' },
  en: { optic: 'Optic', muzzle: 'Muzzle', mag: 'Magazine', under: 'Underbarrel', rail: 'Side rail', none: 'None', dot: 'Ember Dot', holo: 'Halo V2', x4: 'Watchman x4', sup: 'Whisper suppressor', comp: 'Bulwark compensator', hider: 'Snuffer flash hider', ext: 'Granary extended mag', fast: 'Swift fast mag', vg: 'Pillar vertical grip', ag: 'Slant angled grip', laser: 'Red Thread laser', custom: 'Customise', back: 'Back', level: 'Level {n}', locked: 'Level {n} required', next: 'Next unlock', nextAt: 'Level {n}: {what}', unlocked: 'Level {n}: {what} unlocked', unlockedMany: 'Level {n}: {what} unlocked', newGear: 'New unlocks', testAll: 'Test mode: everything is available', mastery: 'Mastery {n}', noSlots: 'This weapon takes no attachment.', s_rec: 'Recoil', s_spread: 'Accuracy', s_hip: 'Hip fire', s_aim: 'Aim speed', s_reload: 'Reload', s_mag: 'Magazine', s_mob: 'Mobility', s_flash: 'Flash', s_loud: 'Noise', zoom: 'x4 zoom', visible: 'Visible beam', weaponLock: 'Level {n} required to buy', base: 'Base', with: 'Equipped' },
  es: { optic: 'Óptica', muzzle: 'Boca', mag: 'Cargador', under: 'Bajo el cañón', rail: 'Riel lateral', none: 'Ninguno', dot: 'Punto Ascua', holo: 'Halo V2', x4: 'Vigía x4', sup: 'Silenciador Susurro', comp: 'Compensador Tope', hider: 'Apagallamas Apagador', ext: 'Cargador largo Granero', fast: 'Cargador rápido Veloz', vg: 'Empuñadura recta Pilar', ag: 'Empuñadura inclinada Sesgo', laser: 'Láser Hilo Rojo', custom: 'Personalizar', back: 'Volver', level: 'Nivel {n}', locked: 'Requiere nivel {n}', next: 'Próximo desbloqueo', nextAt: 'Nivel {n}: {what}', unlocked: 'Nivel {n}: {what} desbloqueado', unlockedMany: 'Nivel {n}: {what} desbloqueados', newGear: 'Nuevos desbloqueos', testAll: 'Modo prueba: todo disponible', mastery: 'Maestría {n}', noSlots: 'Esta arma no admite accesorios.', s_rec: 'Retroceso', s_spread: 'Precisión', s_hip: 'Disparo de cadera', s_aim: 'Apuntado', s_reload: 'Recarga', s_mag: 'Cargador', s_mob: 'Movilidad', s_flash: 'Fogonazo', s_loud: 'Ruido', zoom: 'Zoom x4', visible: 'Haz visible', weaponLock: 'Requiere nivel {n} para comprar', base: 'Base', with: 'Equipada' },
  de: { optic: 'Optik', muzzle: 'Mündung', mag: 'Magazin', under: 'Unterlauf', rail: 'Seitenschiene', none: 'Keins', dot: 'Glutpunkt', holo: 'Halo V2', x4: 'Wächter x4', sup: 'Schalldämpfer Flüstern', comp: 'Kompensator Prellbock', hider: 'Mündungsfeuerdämpfer Löscher', ext: 'Langmagazin Speicher', fast: 'Schnellmagazin Flink', vg: 'Senkrechtgriff Pfeiler', ag: 'Schräggriff Keil', laser: 'Laser Roter Faden', custom: 'Anpassen', back: 'Zurück', level: 'Stufe {n}', locked: 'Stufe {n} nötig', next: 'Nächste Freischaltung', nextAt: 'Stufe {n}: {what}', unlocked: 'Stufe {n}: {what} freigeschaltet', unlockedMany: 'Stufe {n}: {what} freigeschaltet', newGear: 'Neu freigeschaltet', testAll: 'Testmodus: alles verfügbar', mastery: 'Meisterschaft {n}', noSlots: 'Diese Waffe nimmt kein Zubehör an.', s_rec: 'Rückstoß', s_spread: 'Präzision', s_hip: 'Hüftfeuer', s_aim: 'Zielen', s_reload: 'Nachladen', s_mag: 'Magazin', s_mob: 'Mobilität', s_flash: 'Mündungsfeuer', s_loud: 'Lärm', zoom: 'x4-Zoom', visible: 'Sichtbarer Strahl', weaponLock: 'Kauf ab Stufe {n}', base: 'Basis', with: 'Ausgerüstet' },
  pt: { optic: 'Óptica', muzzle: 'Boca', mag: 'Carregador', under: 'Sob o cano', rail: 'Trilho lateral', none: 'Nenhum', dot: 'Ponto Brasa', holo: 'Halo V2', x4: 'Vigia x4', sup: 'Silenciador Sussurro', comp: 'Compensador Batente', hider: 'Abafa-chamas Apagador', ext: 'Carregador longo Celeiro', fast: 'Carregador rápido Ágil', vg: 'Punho reto Pilar', ag: 'Punho inclinado Viés', laser: 'Laser Fio Vermelho', custom: 'Personalizar', back: 'Voltar', level: 'Nível {n}', locked: 'Requer nível {n}', next: 'Próximo desbloqueio', nextAt: 'Nível {n}: {what}', unlocked: 'Nível {n}: {what} desbloqueado', unlockedMany: 'Nível {n}: {what} desbloqueados', newGear: 'Novos desbloqueios', testAll: 'Modo de teste: tudo disponível', mastery: 'Maestria {n}', noSlots: 'Esta arma não aceita acessórios.', s_rec: 'Recuo', s_spread: 'Precisão', s_hip: 'Tiro da cintura', s_aim: 'Pontaria', s_reload: 'Recarga', s_mag: 'Carregador', s_mob: 'Mobilidade', s_flash: 'Clarão', s_loud: 'Ruído', zoom: 'Zoom x4', visible: 'Feixe visível', weaponLock: 'Requer nível {n} para comprar', base: 'Base', with: 'Equipada' },
  it: { optic: 'Ottica', muzzle: 'Volata', mag: 'Caricatore', under: 'Sotto canna', rail: 'Slitta laterale', none: 'Nessuno', dot: 'Punto Brace', holo: 'Halo V2', x4: 'Vedetta x4', sup: 'Silenziatore Sussurro', comp: 'Compensatore Fermo', hider: 'Spegnifiamma Smorzo', ext: 'Caricatore lungo Granaio', fast: 'Caricatore rapido Lesto', vg: 'Impugnatura dritta Pilastro', ag: 'Impugnatura inclinata Sbieco', laser: 'Laser Filo Rosso', custom: 'Personalizza', back: 'Indietro', level: 'Livello {n}', locked: 'Richiede livello {n}', next: 'Prossimo sblocco', nextAt: 'Livello {n}: {what}', unlocked: 'Livello {n}: {what} sbloccato', unlockedMany: 'Livello {n}: {what} sbloccati', newGear: 'Nuovi sblocchi', testAll: 'Modalità test: tutto disponibile', mastery: 'Maestria {n}', noSlots: 'Quest’arma non accetta accessori.', s_rec: 'Rinculo', s_spread: 'Precisione', s_hip: 'Tiro d’anca', s_aim: 'Mira', s_reload: 'Ricarica', s_mag: 'Caricatore', s_mob: 'Mobilità', s_flash: 'Vampa', s_loud: 'Rumore', zoom: 'Zoom x4', visible: 'Raggio visibile', weaponLock: 'Richiede livello {n} per l’acquisto', base: 'Base', with: 'Equipaggiata' },
};
export function attText(lang, key, params) {
  const l = TXT[lang] || TXT.fr; let s = l[key] ?? TXT.fr[key] ?? key;
  if (params) for (const k of Object.keys(params)) s = s.replace('{' + k + '}', params[k]);
  return s;
}
export const rewardName = (lang, r) => (r.type === 'att' ? attText(lang, r.id) : r.name);
export function unlockLine(lang, level, list) {
  const what = list.map(r => rewardName(lang, r)).join(', ');
  return attText(lang, list.length > 1 ? 'unlockedMany' : 'unlocked', { n: level, what });
}

/* ---------- third-person models: a few flat-shaded boxes in gun-bone space (origin = top of the grip, barrel toward -Z) ---------- */
const C_DARK = [.035, .036, .038], C_STEEL = [.2, .21, .22], C_RED = [1.6, .08, .05], C_LENS = [.16, .3, .34];
const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function pushBox(o, cx, cy, cz, sx, sy, sz, c) {
  for (const n of FACES) {
    const ax = n[0] ? [0, 1, 0] : [1, 0, 0], bx = [n[1] * ax[2] - n[2] * ax[1], n[2] * ax[0] - n[0] * ax[2], n[0] * ax[1] - n[1] * ax[0]];
    const P = (s, t) => [cx + (n[0] + ax[0] * s + bx[0] * t) * sx / 2, cy + (n[1] + ax[1] * s + bx[1] * t) * sy / 2, cz + (n[2] + ax[2] * s + bx[2] * t) * sz / 2];
    for (const q of [P(-1, -1), P(1, -1), P(1, 1), P(-1, -1), P(1, 1), P(-1, 1)]) { o.p.push(q[0], q[1], q[2]); o.n.push(n[0], n[1], n[2]); o.c.push(c[0], c[1], c[2]); }
  }
}
function drawAttachment(o, id, g) {
  const z = g.z, top = g.top, mz = g.muzzle, my = g.my, uz = g.zMin * .58, uy = g.under, sx = g.half;
  switch (id) {
    case 'dot': pushBox(o, 0, top + .008, z, .026, .016, .05, C_DARK); pushBox(o, 0, top + .03, z - .012, .03, .03, .006, C_LENS); pushBox(o, 0, top + .046, z, .03, .004, .036, C_DARK); break;
    case 'holo': pushBox(o, 0, top + .008, z, .036, .016, .07, C_DARK); for (const s of [-1, 1]) pushBox(o, s * .019, top + .032, z - .012, .004, .04, .036, C_DARK); pushBox(o, 0, top + .054, z - .012, .042, .004, .04, C_DARK); pushBox(o, 0, top + .032, z - .026, .034, .034, .003, C_LENS); break;
    case 'x4': pushBox(o, 0, top + .008, z, .024, .016, .07, C_DARK); pushBox(o, 0, top + .036, z, .034, .034, .17, C_DARK); pushBox(o, 0, top + .036, z - .092, .046, .046, .03, C_DARK); pushBox(o, 0, top + .036, z - .108, .04, .04, .003, C_LENS); break;
    case 'sup': pushBox(o, 0, my, mz - .075, .034, .034, .15, C_DARK); pushBox(o, 0, my, mz - .152, .026, .026, .006, C_STEEL); break;
    case 'comp': pushBox(o, 0, my, mz - .028, .03, .03, .056, C_STEEL); pushBox(o, 0, my + .016, mz - .03, .012, .006, .024, C_DARK); break;
    case 'hider': pushBox(o, 0, my, mz - .025, .024, .024, .05, C_DARK); break;
    case 'ext': pushBox(o, 0, g.magY - .022, g.magZ, .03, .05, .056, C_STEEL); pushBox(o, 0, g.magY - .05, g.magZ, .036, .01, .064, C_DARK); break;
    case 'fast': pushBox(o, 0, g.magY - .004, g.magZ, .036, .012, .062, C_STEEL); break;
    case 'vg': pushBox(o, 0, uy - .012, uz, .028, .024, .05, C_DARK); pushBox(o, 0, uy - .05, uz, .028, .07, .032, C_DARK); break;
    case 'ag': pushBox(o, 0, uy - .012, uz, .028, .024, .08, C_DARK); pushBox(o, 0, uy - .032, uz + .026, .028, .03, .032, C_DARK); break;
    case 'laser': pushBox(o, sx + .012, g.railY, uz, .02, .022, .06, C_DARK); pushBox(o, sx + .012, g.railY, uz - .032, .012, .012, .004, C_RED); break;
  }
}
const gunInfo = new Map(), attGeos = new Map();
/** Measures a weapon's third-person model once (from the soldier geometry), so each accessory sits on the real gun. */
export function measureGun(sol, wid) {
  let g = gunInfo.get(wid); if (g) return g;
  const mesh = sol.mesh, bones = mesh.skeleton.bones, bi = bones.findIndex(b => b.name === 'gun'); if (bi < 0) return null;
  const inv = mesh.skeleton.boneInverses[bi].elements, ox = -inv[12], oy = -inv[13], oz = -inv[14];
  const P = mesh.geometry.attributes.position, S = mesh.geometry.attributes.skinIndex, I = mesh.geometry.index;
  let zMin = 0, zMax = 0, yMin = 0, half = .02; const pts = [], tri = [];
  for (let i = 0; i < P.count; i++) {
    if (S.getX(i) !== bi) continue;
    const x = P.getX(i) - ox, y = P.getY(i) - oy, z = P.getZ(i) - oz; pts.push(x, y, z);
    if (z < zMin) zMin = z; if (z > zMax) zMax = z; if (y < yMin) yMin = y; if (Math.abs(x) > half && Math.abs(x) < .05) half = Math.abs(x);
  }
  if (I) for (let i = 0; i + 2 < I.count; i += 3) { const a = I.getX(i), b = I.getX(i + 1), c = I.getX(i + 2); if (S.getX(a) !== bi || S.getX(b) !== bi || S.getX(c) !== bi) continue; for (const v of [a, b, c]) tri.push(P.getX(v) - ox, P.getY(v) - oy, P.getZ(v) - oz); }
  /* highest or lowest point of the gun's real cross-section (triangle edges cut at z), not just of the vertices near it */
  const cut = (z0, f, init) => { let v = init; for (let t = 0; t + 8 < tri.length; t += 9) for (let e = 0; e < 3; e++) { const a = t + e * 3, b = t + (e + 1) % 3 * 3, za = tri[a + 2] - z0, zb = tri[b + 2] - z0; if ((za > 0) === (zb > 0)) continue; const k = za / (za - zb); if (Math.abs(tri[a] + (tri[b] - tri[a]) * k) < .035) v = f(v, tri[a + 1] + (tri[b + 1] - tri[a + 1]) * k); } return v; };
  const band = (z0, z1, f, init) => { let v = init; for (let i = 0; i < pts.length; i += 3) if (pts[i + 2] >= z0 && pts[i + 2] <= z1 && Math.abs(pts[i]) < .035) v = f(v, pts[i + 1]); for (const q of [z0, (z0 + z1) / 2, z1]) v = cut(q, f, v); return v; };
  const z = Math.max(zMin * .5, -.1), top = band(z - .03, z + .03, Math.max, 0), uz = zMin * .58, under = band(uz - .03, uz + .03, Math.min, 0), tipY = band(zMin - .001, zMin + .012, Math.max, -1), tipL = band(zMin - .001, zMin + .012, Math.min, 1);
  g = { z, top: Math.min(top, .13), zMin, muzzle: zMin, my: tipY > -1 ? (tipY + tipL) / 2 : .03, under, half: Math.min(half, .04), railY: under + .03, magY: Math.max(yMin, -.24), magZ: -.08 };
  { let best = 1e9, bz = -.08; for (let i = 0; i < pts.length; i += 3) if (pts[i + 2] < .02 && pts[i + 2] > zMin * .75 && pts[i + 1] < best) { best = pts[i + 1]; bz = pts[i + 2]; } if (best < -.05) { g.magY = best; g.magZ = bz; } }
  gunInfo.set(wid, g); return g;
}
/** The measurements taken by measureGun, or null when this weapon was not measured yet. */
export const measuredGun = wid => gunInfo.get(wid) || null;
/** One small cached geometry per weapon + combination. */
export function attachmentGeometry(THREE, wid, ids, info) {
  const key = wid + ':' + ids.join(','); let geo = attGeos.get(key); if (geo) return geo;
  const o = { p: [], n: [], c: [] }; for (const id of ids) drawAttachment(o, id, info);
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(o.p), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(o.n), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(o.c), 3));
  geo.computeBoundingSphere(); attGeos.set(key, geo); return geo;
}
/** Same parameters as the ground-weapon material of engine-loot.js: three reuses its compiled program. */
let sharedMat = null;
export const attachmentMaterial = THREE => sharedMat || (sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .22 }));

/* ---------- laser: one instanced beam mesh and one instanced dot mesh; no light, no per-frame allocation ---------- */
const ENV_LASER = { desert: .34, snow: .3, airbase: .38, valley: .46, urban: .6, port: .74, refinery: .74, bunker: 1 };
const MAX_BEAMS = 13;
/** ctx: { THREE, scene, camera, grid, hitActors(shooter, ox, oy, oz, dx, dy, dz, tMax) -> victim|null, hitDist() } */
export function createLasers(ctx) {
  const { THREE, scene, camera, grid } = ctx;
  const bg = new THREE.BufferGeometry(), R = .0016;
  const bp = new Float32Array([-R, 0, 0, R, 0, 0, R, 0, -1, -R, 0, 0, R, 0, -1, -R, 0, -1, 0, -R, 0, 0, R, 0, 0, R, -1, 0, -R, 0, 0, R, -1, 0, -R, -1]);
  // the beam samples the dot texture: bright at the emitter, fading toward the far end. Beam and dot then share one shader program.
  const buv = new Float32Array(24); for (let i = 0; i < 12; i++) { buv[i * 2] = .5; buv[i * 2 + 1] = bp[i * 3 + 2] < -.5 ? .24 : .5; }
  bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bg.setAttribute('uv', new THREE.BufferAttribute(buv, 2));
  const n = 32, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = Math.hypot((x + .5) / n * 2 - 1, (y + .5) / n * 2 - 1), v = Math.pow(Math.max(0, 1 - r), 2.4) + (r < .22 ? .7 : 0), q = (y * n + x) * 4; d[q] = Math.min(255, v * 255); d[q + 1] = Math.min(255, v * 70); d[q + 2] = Math.min(255, v * 44); d[q + 3] = 255; }
  const tex = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const dotMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false });
  dotMat.forceSinglePass = true;       // three draws a transparent double-sided material in two passes and sets needsUpdate (a program lookup) three times per draw, every frame
  const beams = new THREE.InstancedMesh(bg, dotMat, MAX_BEAMS); beams.frustumCulled = false; beams.renderOrder = 7; beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage); beams.name = 'laser-beams';
  const dots = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), dotMat, MAX_BEAMS); dots.frustumCulled = false; dots.renderOrder = 8; dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dots.name = 'laser-dots';
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, -1), col = new THREE.Color();
  for (let i = 0; i < MAX_BEAMS; i++) { beams.setMatrixAt(i, zero); dots.setMatrixAt(i, zero); beams.setColorAt(i, col.setRGB(1, 1, 1)); dots.setColorAt(i, col); }
  beams.count = dots.count = 1; scene.add(beams, dots);
  let used = 0, envK = .6, frame = 0; const shade = new Float32Array(MAX_BEAMS).fill(0);
  return {
    beams, dots,
    get used() { return used; },
    setEnv(env) { envK = ENV_LASER[env] ?? .6; },
    begin() { used = 0; frame++; },
    /** Adds one laser: (fx,fy,fz) emitter, (ox,oy,oz)+(dx,dy,dz) the aim ray. The ray stops on the world or on a player. Returns the distance. */
    add(shooter, fx, fy, fz, ox, oy, oz, dx, dy, dz, maxD = 70, dotOnly = false) {
      if (used >= MAX_BEAMS) return 0;
      const i = used++, tw = grid.ray(ox, oy, oz, dx, dy, dz, maxD);
      let t = tw; if (ctx.hitActors) { const v = ctx.hitActors(shooter, ox, oy, oz, dx, dy, dz, tw); if (v) t = ctx.hitDist(); }
      const hit = t < maxD - .01, hx = ox + dx * t, hy = oy + dy * t, hz = oz + dz * t;
      if ((frame + i) % 8 === 0) shade[i] = hit && grid.ray(hx - dx * .05, hy - dy * .05 + .04, hz - dz * .05, 0, 1, 0, 28) < 28 ? 1 : 0;      // under a roof: the sun does not wash it out
      const k = envK + (1 - envK) * shade[i] * .85;
      a.set(fx, fy, fz); b.set(hx, hy, hz); const len = Math.max(.02, a.distanceTo(b));
      b.sub(a).divideScalar(len); q.setFromUnitVectors(zAxis, b);
      const camD = a.distanceTo(camera.position), w = Math.min(4, 1 + camD * .1);
      if (dotOnly) beams.setMatrixAt(i, zero); else { m.compose(a, q, s.set(w, w, len)); beams.setMatrixAt(i, m); }       // through a scope the beam would cross the whole view: only its dot shows
      beams.setColorAt(i, col.setRGB(k, k, k));
      if (hit) {
        p.set(hx - dx * .025, hy - dy * .025, hz - dz * .025); const dc = p.distanceTo(camera.position), sz = .035 + dc * .0052;
        m.compose(p, camera.quaternion, s.set(sz, sz, sz)); dots.setMatrixAt(i, m); dots.setColorAt(i, col.setRGB(Math.min(1, k * 1.4), Math.min(1, k * 1.4), Math.min(1, k * 1.4)));
      } else dots.setMatrixAt(i, zero);
      return t;
    },
    end() {
      for (let i = used; i < beams.count; i++) { beams.setMatrixAt(i, zero); dots.setMatrixAt(i, zero); }
      beams.count = dots.count = Math.max(1, used); if (!used) { beams.setMatrixAt(0, zero); dots.setMatrixAt(0, zero); }
      beams.instanceMatrix.needsUpdate = dots.instanceMatrix.needsUpdate = true;
      if (beams.instanceColor) beams.instanceColor.needsUpdate = true; if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
    },
    clear() { used = 0; for (let i = 0; i < MAX_BEAMS; i++) { beams.setMatrixAt(i, zero); dots.setMatrixAt(i, zero); } beams.count = dots.count = 1; beams.instanceMatrix.needsUpdate = dots.instanceMatrix.needsUpdate = true; },
  };
}
