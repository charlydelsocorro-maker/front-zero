// FRONT ZÉRO — second wave of the arsenal: data only (no import), merged into ALL_WEAPONS by data.js. Same fields as data.js.
// Every design is an original fictional archetype: no real manufacturer or model name.
export const EXTRA_WEAPONS = [
  // ---- assault
  { id: 'bpc', name: 'Mistral B-2', type: 'Carabine bullpup', cat: 'assault', slot: 0, price: 1450, dmg: 23, rpm: 720, mag: 30, reload: 2.05, spread: .015, pellets: 1, range: 46, auto: true, mob: 1.02, len: .52, rec: .0085, hs: 1.6, col: 0x4a4a3c, fov: 54 },
  { id: 'cqc', name: 'Furet C-11', type: 'Fusil compact', cat: 'assault', slot: 0, price: 1150, dmg: 20, rpm: 860, mag: 25, reload: 1.45, spread: .024, pellets: 1, range: 30, auto: true, mob: 1.08, len: .44, rec: .0095, hs: 1.5, col: 0x2e3033, fov: 60 },
  { id: 'hbr', name: 'Massue HB-10', type: 'Fusil de combat lourd', cat: 'assault', slot: 0, price: 2500, dmg: 52, rpm: 340, mag: 16, reload: 2.5, spread: .016, pellets: 1, range: 78, auto: true, mob: .9, len: .78, rec: .028, hs: 1.7, col: 0x54452f, fov: 46 },
  { id: 'ssr', name: 'Murmure S-5', type: 'Fusil silencieux', cat: 'assault', slot: 0, price: 1650, dmg: 23, rpm: 600, mag: 25, reload: 1.8, spread: .017, pellets: 1, range: 38, auto: true, mob: 1, len: .66, rec: .0075, hs: 1.5, col: 0x30352e, fov: 56, silent: true },
  // ---- submachine guns
  { id: 'dsmg', name: 'Tambour D-50', type: 'Mitraillette à tambour', cat: 'smg', slot: 0, price: 1250, dmg: 15, rpm: 820, mag: 60, reload: 2.6, spread: .032, pellets: 1, range: 22, auto: true, mob: 1, len: .5, rec: .007, hs: 1.4, col: 0x3a2f24, fov: 64 },
  { id: 'ssmg', name: 'Ombre S-9', type: 'Mitraillette silencieuse', cat: 'smg', slot: 0, price: 1050, dmg: 16, rpm: 760, mag: 30, reload: 1.6, spread: .024, pellets: 1, range: 20, auto: true, mob: 1.09, len: .5, rec: .0048, hs: 1.4, col: 0x1f2326, fov: 62, silent: true },
  { id: 'fsmg', name: 'Canif F-7', type: 'Mitraillette pliante', cat: 'smg', slot: 0, price: 850, dmg: 14, rpm: 960, mag: 25, reload: 1.25, spread: .036, pellets: 1, range: 16, auto: true, mob: 1.15, len: .34, rec: .0065, hs: 1.35, col: 0x3c4044, fov: 66 },
  // ---- shotguns
  { id: 'lsg', name: 'Cavalier L-12', type: 'Fusil à levier', cat: 'shotgun', slot: 0, price: 1000, dmg: 15, rpm: 80, mag: 5, reload: 2.4, spread: .062, pellets: 9, range: 17, auto: false, mob: 1.03, len: .68, rec: .055, hs: 1.3, col: 0x5a3b22, fov: 60 },
  { id: 'dsg', name: 'Barrique D-20', type: 'Fusil à tambour', cat: 'shotgun', slot: 0, price: 2300, dmg: 9, rpm: 260, mag: 16, reload: 3.6, spread: .1, pellets: 8, range: 12, auto: true, mob: .92, len: .66, rec: .032, hs: 1.25, col: 0x2c2d2b, fov: 62 },
  { id: 'sawn', name: 'Mâchoire S-2', type: 'Fusil scié', cat: 'shotgun', slot: 1, price: 650, dmg: 13, rpm: 180, mag: 2, reload: 2, spread: .14, pellets: 8, range: 7.5, auto: false, mob: 1.07, len: .34, rec: .08, hs: 1.2, col: 0x6a4424, fov: 66 },
  // ---- machine guns
  { id: 'bplmg', name: 'Bastion B-90', type: 'Mitrailleuse bullpup', cat: 'lmg', slot: 0, price: 2700, dmg: 24, rpm: 680, mag: 60, reload: 3.8, spread: .026, pellets: 1, range: 50, auto: true, mob: .88, len: .68, rec: .0095, hs: 1.5, col: 0x38402f, fov: 56 },
  { id: 'dlmg', name: 'Citerne T-120', type: 'Mitrailleuse à tambour', cat: 'lmg', slot: 0, price: 3300, dmg: 22, rpm: 560, mag: 120, reload: 5, spread: .036, pellets: 1, range: 46, auto: true, mob: .78, len: .84, rec: .012, hs: 1.4, col: 0x33352c, fov: 58 },
  // ---- precision
  { id: 'lsr', name: 'Trappeur L-30', type: 'Carabine à levier', cat: 'sniper', slot: 0, price: 1750, dmg: 88, rpm: 70, mag: 7, reload: 2.7, spread: .008, pellets: 1, range: 100, auto: false, mob: .98, len: .86, rec: .04, hs: 2, col: 0x5b3d25, fov: 32 },
  { id: 'asr', name: 'Faucheuse SA-3', type: 'Précision semi-auto', cat: 'sniper', slot: 0, price: 4300, dmg: 105, rpm: 110, mag: 8, reload: 2.9, spread: .055, pellets: 1, range: 110, auto: false, mob: .88, len: 1, rec: .07, hs: 1.9, col: 0x383c35, fov: 20, scope: true },
  { id: 'scout', name: 'Éclaireur V-6', type: 'Précision légère', cat: 'sniper', slot: 0, price: 2900, dmg: 120, rpm: 52, mag: 5, reload: 2.2, spread: .04, pellets: 1, range: 105, auto: false, mob: 1.02, len: .88, rec: .05, hs: 1.9, col: 0x4a5040, fov: 24, scope: true },
  // ---- pistols
  { id: 'bp', name: 'Triplet T-3', type: 'Pistolet à rafales', cat: 'pistol', slot: 1, price: 850, dmg: 19, rpm: 780, mag: 18, reload: 1.35, spread: .015, pellets: 1, range: 28, auto: false, burst: 3, burstGap: .3, mob: 1.05, len: .25, rec: .01, hs: 1.6, col: 0x2a2d30, fov: 62 },
  { id: 'p22', name: 'Souris .22', type: 'Pistolet silencieux', cat: 'pistol', slot: 1, price: 500, dmg: 15, rpm: 520, mag: 12, reload: 1, spread: .01, pellets: 1, range: 22, auto: false, mob: 1.1, len: .3, rec: .004, hs: 1.7, col: 0x34373a, fov: 64, silent: true },
  { id: 'lsp', name: 'Aiguille LS-6', type: 'Pistolet de match', cat: 'pistol', slot: 1, price: 1000, dmg: 34, rpm: 260, mag: 10, reload: 1.6, spread: .006, pellets: 1, range: 50, auto: false, mob: 1.01, len: .33, rec: .024, hs: 1.85, col: 0x8d9296, fov: 56 },
  // ---- melee
  { id: 'mach', name: 'Serpe M-4', type: 'Machette', cat: 'melee', kind: 'melee', slot: 1, price: 350, dmg: 62, rpm: 130, mag: 1, reload: 0, spread: 0, pellets: 1, range: 2.5, auto: false, mob: 1.12, len: .46, rec: 0, hs: 1, col: 0x9aa0a4, fov: 70, silent: true },
  { id: 'axe', name: 'Cognée H-2', type: 'Hache de combat', cat: 'melee', kind: 'melee', slot: 1, price: 600, dmg: 105, rpm: 62, mag: 1, reload: 0, spread: 0, pellets: 1, range: 2.3, auto: false, mob: 1.04, len: .42, rec: 0, hs: 1, col: 0x7c8084, fov: 70, silent: true },
  // ---- stage 2: new mechanics. drawT: seconds to full draw. flame: {dps, t} burn after a hit; noPen: never goes through a wall. flare: glowing round.
  { id: 'flame', name: 'Salamandre T-9', type: 'Lance-flammes', cat: 'special', slot: 0, price: 3200, dmg: 4, rpm: 600, mag: 120, reserve: 120, reload: 3.4, spread: .11, pellets: 3, range: 9, auto: true, mob: .9, len: .82, rec: .0006, hs: 1, col: 0x4a3a22, fov: 66, flame: { dps: 10, t: 2.2 }, noPen: true },
  { id: 'bow', name: 'Roseau C-70', type: 'Arc à poulies', cat: 'special', kind: 'projectile', slot: 0, price: 1900, dmg: 110, rpm: 50, mag: 1, reserve: 14, reload: .85, spread: .003, pellets: 1, range: 120, auto: false, mob: 1.03, len: .95, rec: .012, hs: 2, col: 0x2d2f2a, fov: 44, silent: true, drawT: .85, proj: { speed: 74, gravity: 9.5, radius: 0, fuse: 8, bounce: 0, self: 0 } },
  { id: 'flare', name: 'Luciole F-1', type: 'Pistolet lance-fusée', cat: 'pistol', kind: 'projectile', slot: 1, price: 1400, dmg: 55, rpm: 40, mag: 1, reserve: 5, reload: 1.7, spread: .006, pellets: 1, range: 60, auto: false, mob: 1.04, len: .26, rec: .035, hs: 1, col: 0xb5441f, fov: 60, flare: true, proj: { speed: 34, gravity: 7, radius: 2.4, fuse: 4.5, bounce: .22, self: .5 } },
  { id: 'crow', name: 'Levier C-9', type: 'Pied-de-biche', cat: 'melee', kind: 'melee', slot: 1, price: 450, dmg: 85, rpm: 85, mag: 1, reload: 0, spread: 0, pellets: 1, range: 2.6, auto: false, mob: 1, len: .52, rec: 0, hs: 1, col: 0x4a5a6a, fov: 70, silent: true },
];
export const EXTRA_IDS = new Set(EXTRA_WEAPONS.map(w => w.id));
/** Player level required to buy each one: placed between existing weapons of the same price. */
export const EXTRA_LEVELS = { p22: 3, mach: 3, fsmg: 4, sawn: 5, crow: 6, bp: 7, ssmg: 8, lsg: 9, cqc: 10, axe: 10, lsp: 11, dsmg: 12, bpc: 13, ssr: 15, lsr: 16, dsg: 18, hbr: 20, bplmg: 21, scout: 22, dlmg: 24, asr: 27, flare: 14, bow: 17, flame: 23 };
/** Weapons that passed the full check. data.js adds them to LIVE_IDS; anything else stays behind ?arsenal=1. */
export const EXTRA_LIVE = ['bpc', 'cqc', 'hbr', 'ssr', 'dsmg', 'ssmg', 'fsmg', 'lsg', 'dsg', 'sawn', 'bplmg', 'dlmg', 'lsr', 'asr', 'scout', 'bp', 'p22', 'lsp', 'mach', 'axe', 'crow'];
/** Attachments that physically fit (same lists as WEAPON_SLOTS in attachments.js; the server keeps its own copy). Built-in suppressors take no muzzle device. */
export const EXTRA_ATT = {
  bpc: 'dot holo x4 sup comp hider ext fast vg ag laser', cqc: 'dot holo sup comp hider ext fast vg ag laser', hbr: 'dot holo x4 sup comp hider ext fast vg ag laser', ssr: 'dot holo x4 ext fast vg ag laser',
  dsmg: 'dot holo sup comp hider vg ag laser', ssmg: 'dot holo ext fast vg ag laser', fsmg: 'dot sup comp hider ext fast laser',
  lsg: 'dot laser', dsg: 'dot holo comp hider vg ag laser', sawn: 'laser',
  bplmg: 'dot holo x4 comp hider ext laser', dlmg: 'dot holo comp hider laser',
  lsr: 'dot x4 laser', asr: 'comp fast laser', scout: 'sup comp ext fast laser',
  flame: 'laser', bow: 'laser', flare: 'laser',
  bp: 'dot sup comp ext fast laser', p22: 'dot ext fast laser', lsp: 'dot comp ext fast laser',
};
/** Real recordings only: each weapon borrows an existing weapon's takes at another playback rate (audio-samples.js). hand = family for reload stages. */
export const EXTRA_SOUNDS = {
  bpc: { as: 'car', rate: 1.03 }, cqc: { as: 'car', rate: 1.09 }, hbr: { as: 'bat', rate: .91 }, ssr: { as: 'ar', rate: 1.05, rel: .05, quiet: .4 },
  dsmg: { as: 'hsmg', rate: 1.06 }, ssmg: { as: 'smg', rate: .94, quiet: .4 }, fsmg: { as: 'pdw', rate: 1.05 },
  lsg: { as: 'sg', rate: .95 }, dsg: { as: 'asg', rate: 1.04 }, sawn: { as: 'dbs', rate: .92 },
  bplmg: { as: 'lmg', rate: 1.05 }, dlmg: { as: 'lmg', rate: .94 },
  lsr: { as: 'dmr', rate: .97, hand: 'sr' }, asr: { as: 'dmr', rate: .88 }, scout: { as: 'sr', rate: 1.07 },
  bp: { as: 'p9', rate: 1.06 }, p22: { as: 'mp', rate: 1.2, quiet: .32 }, lsp: { as: 'hp', rate: 1.08 },
  bow: { as: 'xbow', rate: 1.12, quiet: .7 }, flare: { as: 'gl', rate: 1.25 },
  mach: { melee: 1.04 }, axe: { melee: .82 }, crow: { melee: .9 },
};
/** Adds the weapons above to a loaded sounds/manifest.json (in memory): same recordings, their own pitch; integral suppressors are quieter and darker. */
export function extendSoundManifest(m) {
  for (const [id, s] of Object.entries(EXTRA_SOUNDS)) {
    if (m.weapons[id]) continue;
    if (s.melee) {
      m.weapons[id] = { set: 'gear', rate: s.melee };
      for (const st of ['swing', 'stab']) { const c = m.common && m.common[st]; if (c) m.events['reload:' + st + ':' + id] = { ...c, rate: (c.rate || 1) * s.melee }; }
      continue;
    }
    const src = m.weapons[s.as], shot = m.events['shot:' + s.as]; if (!src || !shot) continue;
    const w = { ...src, rate: (src.rate || 1) * s.rate }; if (s.rel) w.rel = s.rel;
    if (s.quiet) { w.gain = (src.gain || 1) * s.quiet; w.lp = 3200; w.sub = 0; }
    m.weapons[id] = w;
    const ev = { ...shot }; if (shot.rates) { ev.rates = {}; for (const k of Object.keys(shot.rates)) ev.rates[k] = shot.rates[k] * s.rate; }
    m.events['shot:' + id] = ev;
    const h = s.hand || s.as, tail = ':' + h;
    for (const k of Object.keys(m.events)) if (k.startsWith('reload:') && k.endsWith(tail)) m.events[k.slice(0, -h.length) + id] = m.events[k];
    if (m.events['dry:' + h]) m.events['dry:' + id] = m.events['dry:' + h];
  }
  return m;
}
/** weaponType.<id> in fr, en, es, de, pt, it. */
export const EXTRA_TYPES = {
  bpc: ['Carabine bullpup', 'Bullpup carbine', 'Carabina bullpup', 'Bullpup-Karabiner', 'Carabina bullpup', 'Carabina bullpup'],
  cqc: ['Fusil compact', 'Compact rifle', 'Fusil compacto', 'Kompaktgewehr', 'Fuzil compacto', 'Fucile compatto'],
  hbr: ['Fusil de combat lourd', 'Heavy battle rifle', 'Fusil de combate pesado', 'Schweres Kampfgewehr', 'Fuzil de combate pesado', 'Fucile da battaglia pesante'],
  ssr: ['Fusil silencieux', 'Suppressed rifle', 'Fusil silenciado', 'Schallgedämpftes Gewehr', 'Fuzil silenciado', 'Fucile silenziato'],
  dsmg: ['Mitraillette à tambour', 'Drum SMG', 'Subfusil de tambor', 'Trommel-MP', 'Submetralhadora de tambor', 'Mitra a tamburo'],
  ssmg: ['Mitraillette silencieuse', 'Suppressed SMG', 'Subfusil silenciado', 'Schallgedämpfte MP', 'Submetralhadora silenciada', 'Mitra silenziato'],
  fsmg: ['Mitraillette pliante', 'Folding SMG', 'Subfusil plegable', 'Klapp-MP', 'Submetralhadora dobrável', 'Mitra pieghevole'],
  lsg: ['Fusil à levier', 'Lever-action shotgun', 'Escopeta de palanca', 'Unterhebelflinte', 'Espingarda de alavanca', 'Fucile a leva'],
  dsg: ['Fusil à tambour', 'Drum shotgun', 'Escopeta de tambor', 'Trommelflinte', 'Espingarda de tambor', 'Fucile a tamburo'],
  sawn: ['Fusil scié', 'Sawn-off shotgun', 'Escopeta recortada', 'Abgesägte Flinte', 'Espingarda serrada', 'Fucile a canne mozze'],
  bplmg: ['Mitrailleuse bullpup', 'Bullpup machine gun', 'Ametralladora bullpup', 'Bullpup-MG', 'Metralhadora bullpup', 'Mitragliatrice bullpup'],
  dlmg: ['Mitrailleuse à tambour', 'Drum machine gun', 'Ametralladora de tambor', 'Trommel-MG', 'Metralhadora de tambor', 'Mitragliatrice a tamburo'],
  lsr: ['Carabine à levier', 'Lever-action rifle', 'Rifle de palanca', 'Unterhebelbüchse', 'Rifle de alavanca', 'Carabina a leva'],
  asr: ['Précision semi-auto', 'Semi-auto sniper', 'Precisión semiautomática', 'Halbautomatisches Präzisionsgewehr', 'Precisão semiautomática', 'Precisione semiautomatica'],
  scout: ['Précision légère', 'Light scout rifle', 'Precisión ligera', 'Leichtes Spähergewehr', 'Precisão leve', 'Precisione leggera'],
  bp: ['Pistolet à rafales', 'Burst pistol', 'Pistola de ráfagas', 'Feuerstoß-Pistole', 'Pistola de rajadas', 'Pistola a raffica'],
  p22: ['Pistolet silencieux', 'Suppressed pistol', 'Pistola silenciada', 'Schallgedämpfte Pistole', 'Pistola silenciada', 'Pistola silenziata'],
  lsp: ['Pistolet de match', 'Match pistol', 'Pistola de competición', 'Matchpistole', 'Pistola de competição', 'Pistola da gara'],
  mach: ['Machette', 'Machete', 'Machete', 'Machete', 'Facão', 'Machete'],
  axe: ['Hache de combat', 'Combat axe', 'Hacha de combate', 'Kampfaxt', 'Machado de combate', 'Ascia da combattimento'],
  crow: ['Pied-de-biche', 'Crowbar', 'Palanca', 'Brecheisen', 'Pé de cabra', 'Piede di porco'],
  flame: ['Lance-flammes', 'Flamethrower', 'Lanzallamas', 'Flammenwerfer', 'Lança-chamas', 'Lanciafiamme'],
  bow: ['Arc à poulies', 'Compound bow', 'Arco compuesto', 'Compoundbogen', 'Arco composto', 'Arco compound'],
  flare: ['Pistolet lance-fusée', 'Flare pistol', 'Pistola de bengalas', 'Signalpistole', 'Pistola sinalizadora', 'Pistola lanciarazzi'],
};
