// FRONT ZÉRO — equipment table shared by the browser and the server. No import/export on purpose (like zone-rules.js):
// the server loads it with require(), the browser with `import './gear-data.js'` then reads globalThis.FZGearData.
// Every name is an invented one. live:false = hidden everywhere (menu, loot, bots) and refused by the server.
(function (root) {
  'use strict';
  const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
  // slot: L lethal, T tactical, M medical. kind: med | throw | place. Times in ms, distances in m.
  const ITEMS = {
    // ---- medical
    bandage: { slot: 'M', kind: 'med', live: true, carry: 4, price: 0, level: 1, useMs: 1800, heal: 15, hotMs: 4000, n: ['Bandage Gaze-2', 'Gauze-2 Bandage', 'Venda Gasa-2', 'Verband Gaze-2', 'Ligadura Gaze-2', 'Benda Garza-2'] },
    syringe: { slot: 'M', kind: 'med', live: true, carry: 2, price: 250, level: 2, useMs: 1250, heal: 35, hotMs: 3500, n: ['Seringue Vita', 'Vita Syringe', 'Jeringa Vita', 'Vita-Spritze', 'Seringa Vita', 'Siringa Vita'] },
    plate: { slot: 'M', kind: 'med', live: true, carry: 2, price: 400, level: 4, useMs: 2400, armor: 40, armorCap: 50, n: ['Plaque Égide', 'Aegis Plate', 'Placa Égida', 'Aegis-Platte', 'Placa Égide', 'Piastra Egida'] },
    medkit: { slot: 'M', kind: 'med', live: true, carry: 1, price: 600, level: 6, useMs: 5000, heal: 75, hotMs: 1500, fragile: true, n: ['Trousse Relais', 'Relay Medkit', 'Botiquín Relé', 'Relais-Medkit', 'Kit Relé', 'Kit Relè'] },
    adren: { slot: 'M', kind: 'med', live: true, carry: 1, price: 500, level: 9, useMs: 1000, heal: 5, hotMs: 500, boost: 1.16, boostMs: 6000, after: 0.92, afterMs: 3500, n: ['Injecteur Sursaut', 'Surge Injector', 'Inyector Impulso', 'Schub-Injektor', 'Injetor Impulso', 'Iniettore Scatto'] },
    // ---- lethal (frag lives in data.js and keeps its existing path)
    frag: { slot: 'L', kind: 'weapon', live: true, carry: 2, price: 0, level: 1, n: ['Grenade F-1', 'F-1 Grenade', 'Granada F-1', 'Granate F-1', 'Granada F-1', 'Granata F-1'] },
    sticky: { slot: 'L', kind: 'throw', live: true, carry: 1, price: 700, level: 5, speed: 17, gravity: 16, bounce: 0, stick: true, fuseMs: 2200, dmg: 110, radius: 3.8, self: 1, n: ['Grenade Ventouse', 'Limpet Grenade', 'Granada Ventosa', 'Haftgranate', 'Granada Ventosa', 'Granata Ventosa'] },
    molotov: { slot: 'L', kind: 'throw', live: true, carry: 1, price: 650, level: 7, speed: 16, gravity: 15, bounce: 0, shatter: true, fuseMs: 4000, fire: { r: 3.1, ms: 6000, dps: 15 }, n: ['Bouteille Brasier', 'Brazier Bottle', 'Botella Brasero', 'Glutflasche', 'Garrafa Braseiro', 'Bottiglia Braciere'] },
    mine: { slot: 'L', kind: 'place', live: true, carry: 2, price: 800, level: 10, armMs: 1600, trigR: 1.9, trigMs: 320, dmg: 115, radius: 3.6, self: 0.6, hp: 25, maxOut: 3, n: ['Mine Taupe', 'Mole Mine', 'Mina Topo', 'Maulwurf-Mine', 'Mina Toupeira', 'Mina Talpa'] },
    claymore: { slot: 'L', kind: 'place', live: true, carry: 1, price: 900, level: 12, armMs: 1800, trigR: 4.4, cone: 0.72, trigMs: 260, dmg: 125, radius: 5.2, self: 0.5, hp: 35, maxOut: 2, n: ['Charge Éventail', 'Fan Charge', 'Carga Abanico', 'Fächerladung', 'Carga Leque', 'Carica Ventaglio'] },
    c4: { slot: 'L', kind: 'place', live: true, carry: 1, price: 1100, level: 14, armMs: 900, remote: true, dmg: 150, radius: 5, self: 1, hp: 40, maxOut: 1, n: ['Charge Orage', 'Storm Charge', 'Carga Tormenta', 'Sturmladung', 'Carga Tormenta', 'Carica Tempesta'] },
    // breaching charge (map-breach-data.js, engine-breach.js): set on a breachable panel only (wall: true), fuse from the server once stuck
    breach: { slot: 'L', kind: 'place', live: true, carry: 1, price: 400, level: 3, wall: true, armMs: 0, fuseMs: 2500, dmg: 100, radius: 3.2, self: 1, hp: 30, maxOut: 1, n: ['Charge Bélier', 'Ram Charge', 'Carga Ariete', 'Rammladung', 'Carga Aríete', 'Carica Ariete'] },
    tknife: { slot: 'L', kind: 'throw', live: false, carry: 3, price: 450, level: 8, speed: 28, gravity: 9, dmg: 60, n: ['Couteaux Dard', 'Dart Knives', 'Cuchillos Dardo', 'Dolchmesser', 'Facas Dardo', 'Coltelli Dardo'] },
    // ---- tactical
    flash: { slot: 'T', kind: 'throw', live: true, carry: 2, price: 0, level: 1, speed: 18, gravity: 16, bounce: 0.38, fuseMs: 1700, flash: { r: 20, ms: 3600 }, n: ['Grenade Aveuglante', 'Blinder Grenade', 'Granada Cegadora', 'Blendgranate', 'Granada Cegante', 'Granata Accecante'] },
    smoke: { slot: 'T', kind: 'throw', live: true, carry: 1, price: 300, level: 3, speed: 17, gravity: 16, bounce: 0.3, fuseMs: 1500, cloud: { r: 4.6, ms: 15000, grow: 1400 }, n: ['Fumigène Brume', 'Haze Smoke', 'Fumígeno Bruma', 'Nebelkörper Dunst', 'Fumígeno Bruma', 'Fumogeno Foschia'] },
    stun: { slot: 'T', kind: 'throw', live: true, carry: 2, price: 350, level: 5, speed: 18, gravity: 16, bounce: 0.36, fuseMs: 1600, stun: { r: 7.5, ms: 3800, slow: 0.62 }, n: ['Grenade Sonnante', 'Daze Grenade', 'Granada Aturdidora', 'Betäubungsgranate', 'Granada Atordoante', 'Granata Stordente'] },
    decoy: { slot: 'T', kind: 'throw', live: true, carry: 1, price: 300, level: 6, speed: 16, gravity: 16, bounce: 0.3, fuseMs: 900, decoy: { ms: 10000 }, n: ['Leurre Écho', 'Echo Decoy', 'Señuelo Eco', 'Echo-Köder', 'Isca Eco', 'Esca Eco'] },
    sensor: { slot: 'T', kind: 'place', live: true, carry: 1, price: 450, level: 8, armMs: 700, ms: 16000, scanR: 15, hp: 20, maxOut: 1, n: ['Capteur Vigie', 'Watch Sensor', 'Sensor Vigía', 'Wacht-Sensor', 'Sensor Vigia', 'Sensore Vedetta'] },
    ammobox: { slot: 'T', kind: 'place', live: true, carry: 1, price: 500, level: 11, armMs: 500, ms: 40000, useR: 2.6, charges: 4, hp: 60, maxOut: 1, n: ['Caisse Ravitaille', 'Resupply Crate', 'Caja Suministro', 'Nachschubkiste', 'Caixa Reabastece', 'Cassa Rifornimento'] },
    wire: { slot: 'T', kind: 'place', live: true, carry: 1, price: 400, level: 13, armMs: 400, ms: 45000, halfW: 1.25, halfD: 0.55, slow: 0.5, dps: 5, hp: 45, maxOut: 2, n: ['Barbelés Ronce', 'Bramble Wire', 'Alambre Zarza', 'Dornendraht', 'Arame Silva', 'Filo Rovo'] },
    shield: { slot: 'T', kind: 'place', live: false, carry: 1, price: 900, level: 16, armMs: 500, ms: 40000, hp: 320, maxOut: 1, n: ['Bouclier Rempart', 'Rampart Shield', 'Escudo Baluarte', 'Wall-Schild', 'Escudo Baluarte', 'Scudo Bastione'] },
  };
  const DEFAULTS = { L: 'frag', T: 'flash', M: 'bandage' };
  const SLOT_NAMES = { L: ['Létal', 'Lethal', 'Letal', 'Tödlich', 'Letal', 'Letale'], T: ['Tactique', 'Tactical', 'Táctico', 'Taktisch', 'Tático', 'Tattico'], M: ['Médical', 'Medical', 'Médico', 'Medizin', 'Médico', 'Medico'] };
  // Short labels for the HUD, the loadout cards and the prompts.
  const TEXT = {
    heal: ['Soin', 'Heal', 'Cura', 'Heilung', 'Cura', 'Cura'], armor: ['Blindage', 'Armour', 'Blindaje', 'Panzerung', 'Blindagem', 'Corazza'],
    use: ['Utilisation', 'Use time', 'Uso', 'Anwendung', 'Uso', 'Uso'], over: ['sur', 'over', 'en', 'über', 'em', 'in'],
    carry: ['Emportés', 'Carried', 'Llevas', 'Mitgeführt', 'Levas', 'Trasportati'], dmg: ['Dégâts', 'Damage', 'Daño', 'Schaden', 'Dano', 'Danni'],
    radius: ['Rayon', 'Radius', 'Radio', 'Radius', 'Raio', 'Raggio'], time: ['Durée', 'Duration', 'Duración', 'Dauer', 'Duração', 'Durata'],
    speed: ['Vitesse', 'Speed', 'Velocidad', 'Tempo', 'Velocidade', 'Velocità'], level: ['Niveau', 'Level', 'Nivel', 'Stufe', 'Nível', 'Livello'],
    equip: ['Équiper', 'Equip', 'Equipar', 'Ausrüsten', 'Equipar', 'Equipaggia'], equipped: ['Équipé', 'Equipped', 'Equipado', 'Ausgerüstet', 'Equipado', 'Equipaggiato'],
    buy: ['Acheter', 'Buy', 'Comprar', 'Kaufen', 'Comprar', 'Acquista'], title: ['Équipement de combat', 'Field equipment', 'Equipo de combate', 'Feldausrüstung', 'Equipamento de combate', 'Equipaggiamento'],
    none: ['Plus rien', 'None left', 'No queda', 'Nichts mehr', 'Sem mais', 'Finito'], full: ['Déjà au maximum', 'Already full', 'Ya al máximo', 'Bereits voll', 'Já no máximo', 'Già al massimo'],
    cancelled: ['Annulé', 'Cancelled', 'Cancelado', 'Abgebrochen', 'Cancelado', 'Annullato'], detonate: ['Faire sauter', 'Detonate', 'Detonar', 'Zünden', 'Detonar', 'Detona'],
    resupplied: ['Ravitaillé', 'Resupplied', 'Reabastecido', 'Aufgefüllt', 'Reabastecido', 'Rifornito'], mine: ['Mine armée', 'Armed mine', 'Mina armada', 'Mine scharf', 'Mina armada', 'Mina armata'],
    limit: ['Trop déjà posés', 'Too many placed', 'Demasiados colocados', 'Zu viele platziert', 'Demasiados colocados', 'Troppi piazzati'], place: ['Pas de place ici', 'No room here', 'No hay sitio', 'Kein Platz hier', 'Sem espaço', 'Nessuno spazio'],
    keyT: ['Équipement tactique', 'Tactical equipment', 'Equipo táctico', 'Taktische Ausrüstung', 'Equipamento tático', 'Equipaggiamento tattico'], keyM: ['Soin / médical', 'Medical item', 'Objeto médico', 'Sanitätsobjekt', 'Item médico', 'Oggetto medico'],
  };
  const t = (key, lang) => { const a = TEXT[key]; if (!a) return key; const i = LANGS.indexOf(lang); return a[i < 0 ? 0 : i]; };
  const nameOf = (id, lang) => { const it = ITEMS[id]; if (!it) return id; const i = LANGS.indexOf(lang); return it.n[i < 0 ? 0 : i]; };
  const slotName = (s, lang) => { const a = SLOT_NAMES[s]; const i = LANGS.indexOf(lang); return a ? a[i < 0 ? 0 : i] : s; };
  const isLive = id => Object.prototype.hasOwnProperty.call(ITEMS, id) && ITEMS[id].live === true;
  const listFor = slot => Object.keys(ITEMS).filter(id => ITEMS[id].slot === slot && ITEMS[id].live);
  /** A valid {L,T,M} loadout from whatever a save or a client holds; an unknown or hidden item falls back to the slot's default. */
  function cleanLoadout(o) {
    const out = { L: DEFAULTS.L, T: DEFAULTS.T, M: DEFAULTS.M };
    if (o && typeof o === 'object') for (const s of ['L', 'T', 'M']) { const id = o[s]; if (typeof id === 'string' && isLive(id) && ITEMS[id].slot === s) out[s] = id; }
    return out;
  }
  /** What the weapon tables need for explosive items: the same shape as a thrown weapon, so blasts, credit and kill feed reuse the existing path. */
  function blastDefs() {
    const out = {};
    for (const id of Object.keys(ITEMS)) { const it = ITEMS[id]; if (!it.dmg || !it.radius || it.kind === 'weapon') continue; out[id] = { dmg: it.dmg, rpm: 60, pellets: 1, range: 40, hs: 1, mag: 1, reload: 1, kind: 'thrown', proj: { radius: it.radius, speed: it.speed || 20, fuse: 20, self: it.self } }; }
    return out;
  }
  const api = { LANGS, ITEMS, DEFAULTS, TEXT, t, nameOf, slotName, isLive, listFor, cleanLoadout, blastDefs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FZGearData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
