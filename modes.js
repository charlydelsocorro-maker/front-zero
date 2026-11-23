// FRONT ZÉRO — game modes: rules, scoring, bot orders, HUD and the online mirror of server/server.js.
// createMode(id, E, cfg) -> { start(), update(dt), stop() }. Coded against CONTRACT.md (Engine API) only.
import { WEAPONS } from './data.js';
import { DICTS, LANGS } from './i18n.js';

/* ---------- local dictionary: [fr, en, es, de, pt, it] (only keys missing from i18n.js) ---------- */
const LOCAL = {
  'l.leader': ['EN TÊTE', 'LEADER', 'LÍDER', 'FÜHRENDER', 'LÍDER', 'IN TESTA'],
  'l.alpha': ['ALPHA', 'ALPHA', 'ALFA', 'ALPHA', 'ALFA', 'ALFA'],
  'l.bravo': ['BRAVO', 'BRAVO', 'BRAVO', 'BRAVO', 'BRAVO', 'BRAVO'],
  'l.player': ['Joueur', 'Player', 'Jugador', 'Spieler', 'Jogador', 'Giocatore'],
  'l.objFfa': ['Premier à {n} éliminations', 'First to {n} eliminations', 'Primero en llegar a {n} eliminaciones', 'Zuerst {n} Eliminierungen', 'Primeiro a chegar às {n} eliminações', 'Primo a {n} eliminazioni'],
  'l.objTdm': ['Première équipe à {n} éliminations', 'First team to {n} eliminations', 'Primer equipo en llegar a {n} eliminaciones', 'Erstes Team mit {n} Eliminierungen', 'Primeira equipa a chegar às {n} eliminações', 'Prima squadra a {n} eliminazioni'],
  'l.objDom': ['Capturez et tenez les points : {n} pour gagner', 'Capture and hold the points: {n} to win', 'Captura y mantén los puntos: {n} para ganar', 'Punkte erobern und halten: {n} zum Sieg', 'Captura e mantém os pontos: {n} para vencer', 'Conquista e mantieni i punti: {n} per vincere'],
  'l.held': ['Points tenus : {n}/3', 'Points held: {n}/3', 'Puntos en tu poder: {n}/3', 'Gehaltene Punkte: {n}/3', 'Pontos controlados: {n}/3', 'Punti controllati: {n}/3'],
  'l.contested': ['Point {point} contesté', 'Point {point} contested', 'Punto {point} disputado', 'Punkt {point} umkämpft', 'Ponto {point} disputado', 'Punto {point} conteso'],
  'l.kill': ['Élimination', 'Elimination', 'Eliminación', 'Eliminierung', 'Eliminação', 'Eliminazione'],
  'l.capture': ['Capture', 'Capture', 'Captura', 'Eroberung', 'Captura', 'Conquista'],
  'l.defend': ['Défendez les sites A et B', 'Defend sites A and B', 'Defiende las zonas A y B', 'Verteidige die Ziele A und B', 'Defende os locais A e B', 'Difendi i siti A e B'],
  'l.escort': ['Escortez {name}, porteur de la bombe', 'Escort {name}, the bomb carrier', 'Escolta a {name}, que lleva la bomba', 'Eskortiere {name}, den Bombenträger', 'Escolta {name}, que leva a bomba', 'Scorta {name}, che porta la bomba'],
  'l.carrier': ['Vous portez la bombe', 'You carry the bomb', 'Llevas la bomba', 'Du trägst die Bombe', 'Tens a bomba', 'Hai la bomba'],
  'l.getBomb': ['Récupérez la bombe', 'Recover the bomb', 'Recupera la bomba', 'Hol die Bombe zurück', 'Recupera a bomba', 'Recupera la bomba'],
  'l.dropped': ['Bombe au sol', 'Bomb dropped', 'Bomba en el suelo', 'Bombe fallen gelassen', 'Bomba no chão', 'Bomba a terra'],
  'l.picked': ['Bombe récupérée', 'Bomb recovered', 'Bomba recuperada', 'Bombe aufgenommen', 'Bomba recuperada', 'Bomba recuperata'],
  'l.protect': ['Protégez la bombe', 'Protect the bomb', 'Protege la bomba', 'Beschütze die Bombe', 'Protege a bomba', 'Proteggi la bomba'],
  'l.swap': ['CHANGEMENT DE CAMP', 'SIDES SWAPPED', 'CAMBIO DE BANDO', 'SEITENWECHSEL', 'TROCA DE LADO', 'CAMBIO DI CAMPO'],
  'l.matchPoint': ['BALLE DE MATCH', 'MATCH POINT', 'PUNTO DE PARTIDA', 'MATCHBALL', 'PONTO DE PARTIDA', 'MATCH POINT'],
  'l.elim': ['Équipe adverse éliminée', 'Enemy team eliminated', 'Equipo enemigo eliminado', 'Gegnerteam eliminiert', 'Equipa inimiga eliminada', 'Squadra nemica eliminata'],
  'l.wiped': ['Votre équipe est éliminée', 'Your team was eliminated', 'Tu equipo ha sido eliminado', 'Dein Team wurde eliminiert', 'A tua equipa foi eliminada', 'La tua squadra è stata eliminata'],
  'l.prepare': ['Préparez-vous', 'Get ready', 'Prepárate', 'Mach dich bereit', 'Prepara-te', 'Preparati'],
  'l.allyPlanting': ['{name} pose la bombe', '{name} is planting the bomb', '{name} está colocando la bomba', '{name} legt die Bombe', '{name} está a plantar a bomba', '{name} sta piazzando la bomba'],
  'l.wave': ['VAGUE', 'WAVE', 'OLEADA', 'WELLE', 'VAGA', 'ONDATA'],
  'l.left': ['RESTANTS', 'LEFT', 'RESTANTES', 'ÜBRIG', 'RESTANTES', 'RIMASTI'],
  'l.survive': ['Survivez aux vagues', 'Survive the waves', 'Sobrevive a las oleadas', 'Überlebe die Wellen', 'Sobrevive às vagas', 'Sopravvivi alle ondate'],
  'l.resupply': ['Ravitaillement : santé et munitions', 'Resupply: health and ammo', 'Reabastecimiento: salud y munición', 'Nachschub: Gesundheit und Munition', 'Reabastecimento: vida e munições', 'Rifornimento: salute e munizioni'],
  'l.statWave': ['Vague atteinte', 'Wave reached', 'Oleada alcanzada', 'Erreichte Welle', 'Vaga alcançada', 'Ondata raggiunta'],
  'l.statScore': ['Score', 'Score', 'Puntuación', 'Punkte', 'Pontuação', 'Punteggio'],
  'l.statRank': ['Classement', 'Rank', 'Posición', 'Platz', 'Classificação', 'Posizione'],
  'l.statStreak': ['Meilleure série', 'Best streak', 'Mejor racha', 'Beste Serie', 'Melhor sequência', 'Serie migliore'],
  'l.statRounds': ['Manches', 'Rounds', 'Rondas', 'Runden', 'Rondas', 'Round'],
  'l.statCaps': ['Captures', 'Captures', 'Capturas', 'Eroberungen', 'Capturas', 'Conquiste'],
  'l.statPlants': ['Bombes posées', 'Bombs planted', 'Bombas colocadas', 'Gelegte Bomben', 'Bombas plantadas', 'Bombe piazzate'],
  'l.statDefuses': ['Désamorçages', 'Defuses', 'Desactivaciones', 'Entschärfungen', 'Desarmes', 'Disinneschi'],
  'l.leftGame': ['{name} a quitté la partie', '{name} left the match', '{name} ha abandonado la partida', '{name} hat das Match verlassen', '{name} saiu da partida', '{name} ha lasciato la partita'],
};

/* ---------- constants ---------- */
const BLUE = '#4aa3ff', RED = '#ff5a4a', NEUTRAL = '#d9d4c4', GOLD = '#e8a628', BOMB_HI = '#ff3b30', BOMB_LO = '#8a1c14';
const MSG_INFO = { kind: 'info', dur: 2.6 }, MSG_GOOD = { kind: 'good', dur: 3 }, MSG_BAD = { kind: 'bad', dur: 3 };
const BOT_NAMES = ['Renard', 'Vautour', 'Lynx', 'Corbeau', 'Mistral', 'Granit', 'Sirocco', 'Fauve', 'Orage', 'Brume', 'Silex', 'Cobalt', 'Loutre', 'Ronce', 'Tison', 'Givre', 'Écho', 'Rafale', 'Basalte', 'Faucille'];
const BOT_GUNS = WEAPONS.filter(w => w.slot === 0).map(w => w.id);
const BOT_GUN_WEIGHT = { ar: 5, smg: 3, sg: 2, lmg: 2, sr: 1, rl: 0.6, gl: 0.6 };      // every other weapon of the arsenal weighs 1
const ZONE_IDS = ['A', 'B', 'C'];
const ONLINE_LIMIT = { ffa: 30, tdm: 75, dom: 200 };        // display only: mirrors MODE_RULES in server/server.js
const NET_DEFUSE_R = 3.5, NET_REVIVE_R = 3, SITE_A = { site: 'A' }, SITE_B = { site: 'B' }, NO_DATA = {};                 // mirrors BOMB.defuseR / ZOMBIE.reviveR (prompts only)

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const d2 = (ax, az, bx, bz) => { const x = ax - bx, z = az - bz; return x * x + z * z; };
const fmt = (text, params) => (params ? text.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(params, k) ? String(params[k] ?? '') : m)) : text);

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- text ---------- */
function makeT(E, cfg) {
  const ext = E.i18n && typeof E.i18n.t === 'function' ? E.i18n : cfg.i18n && typeof cfg.i18n.t === 'function' ? cfg.i18n : null;
  const lang = () => {
    let l = ext && ext.lang;
    if (!l) { try { l = E.settings && E.settings.get && E.settings.get('language'); } catch { l = null; } }
    if (!l && typeof document !== 'undefined' && document.documentElement) l = document.documentElement.lang;
    return LANGS.includes(l) ? l : 'fr';
  };
  return (key, params) => {
    const loc = LOCAL[key];
    if (loc) { const i = LANGS.indexOf(lang()); return fmt(loc[i] === undefined ? loc[0] : loc[i], params); }
    if (ext) return ext.t(key, params);
    const d = DICTS[lang()] || DICTS.fr;
    return fmt(typeof d[key] === 'string' ? d[key] : typeof DICTS.fr[key] === 'string' ? DICTS.fr[key] : String(key), params);
  };
}
function interactKey(E, cfg) {
  const s = E.settings || cfg.settings;
  let code = null;
  try { if (s && s.get) { code = s.get('keys.interact'); if (s.keyLabel) return s.keyLabel(code); } } catch { code = null; }
  if (!code) { try { const raw = JSON.parse(localStorage.getItem('frontzero.settings') || 'null'); code = raw && raw.keys && raw.keys.interact; } catch { code = null; } }
  if (typeof code !== 'string' || !code) code = 'KeyE';
  if (typeof DICTS.fr['keyname.' + code] === 'string') return makeT(E, cfg)('keyname.' + code);
  return /^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit\d$/.test(code) ? code.slice(5) : code;
}
function playerClass(E, cfg) {
  if (typeof cfg.cls === 'string') return cfg.cls;
  try { if (E.profile && E.profile.data && E.profile.data.cls) return E.profile.data.cls; } catch { /* fall through */ }
  try { const raw = JSON.parse(localStorage.getItem('frontzero') || 'null'); if (raw && typeof raw.cls === 'string') return raw.cls; } catch { /* no storage */ }
  return 'assaut';
}

/* ---------- shared context ---------- */
function makeCtx(E, cfg) {
  const subs = [], markers = new Set(), netH = {};
  const t = makeT(E, cfg);
  const pTimer = { timer: null }, pCenter = { center: '' }, pObj = { objective: null };
  let lastTimer, lastCenter, lastObj, lastPrompt = null, lastProgL = null, lastProgF = -1;
  const c = {
    E, cfg, t, time: 0, ended: false, earned: 0,
    rnd: cfg.seed == null ? Math.random : mulberry(Number(cfg.seed) || 1),
    key: interactKey(E, cfg),
    st: { kills: 0, deaths: 0, heads: 0, streak: 0, best: 0, score: 0 },
    on(evt, fn) { const off = E.on(evt, fn); if (typeof off === 'function') subs.push(off); },
    netOn(evt, fn) { const off = cfg.net.on(evt, fn); if (typeof off === 'function') subs.push(off); (netH[evt] || (netH[evt] = [])).push(fn); },
    // The server sends the match's first 'score' and 'round' right after 'start', while this client is still loading the map:
    // net.js keeps the latest of each, replayed here once the mode listens (clock, first freeze, first intermission).
    replayNet() {
      const net = cfg.net, now = typeof performance !== 'undefined' ? performance.now() : 0;
      for (const [evt, m] of [['score', net.lastScore], ['round', net.lastRound]]) {
        if (!m || !netH[evt]) continue;
        const { t: _t, at, ...data } = m;
        if (typeof data.timeLeft === 'number' && typeof at === 'number') data.timeLeft = Math.max(0, data.timeLeft - (now - at));
        for (const fn of netH[evt]) { try { fn(data); } catch (e) { console.error('[modes] replay', evt, e); } }
      }
    },
    marker(id, m) { if (m) markers.add(id); else markers.delete(id); E.hud.marker(id, m || null); },
    // Per-frame numbers live in object fields (c.time, c.frac, mode state): closure variables would box a double on every write.
    frac: 0.5,
    timer(v) { if (v !== null && v < 0) v = 0; if (v === lastTimer) return; lastTimer = v; pTimer.timer = v; E.hud.set(pTimer); },
    clock(holder) { c.timer(Math.ceil(holder.left - 1e-6)); },
    center(s) { if (s === lastCenter) return; lastCenter = s; pCenter.center = s; E.hud.set(pCenter); },
    objective(s) { if (s === lastObj) return; lastObj = s; pObj.objective = s; E.hud.set(pObj); },
    score(left, right) { E.hud.set({ left, right }); },
    prompt(s) { if (s === lastPrompt) return; lastPrompt = s; E.hud.prompt(s); },
    progress(label) {                                     // the fraction is read from c.frac
      if (label == null) { if (lastProgL === null) return; lastProgL = null; lastProgF = -1; E.hud.progress(null, null); return; }
      const v = c.frac, f = Math.round((v < 0 ? 0 : v > 1 ? 1 : v) * 200);
      if (label === lastProgL && f === lastProgF) return;
      lastProgL = label; lastProgF = f; E.hud.progress(label, f / 200);
    },
    msg(text, kind) { E.hud.message(text, kind === 'good' ? MSG_GOOD : kind === 'bad' ? MSG_BAD : MSG_INFO); },
    // Economy: every credit reward in every mode is tripled here (players asked to unlock weapons faster).
    reward(n, reason) { n = Math.round(n * 3); if (n > 0) { c.earned += n; E.reward(n, reason); } },
    // Player kill bookkeeping shared by every offline mode. Returns true when the local player scored the kill.
    trackKill(e, credits, streaks) {
      const P = E.player, st = c.st;
      if (e.victim === P) { st.deaths++; st.streak = 0; }
      if (e.killer !== P || e.victim === P) return false;
      st.kills++; st.score += e.head ? 125 : 100;
      if (e.head) st.heads++;
      c.reward(credits + (e.head ? 10 : 0), e.head ? t('hud.headshot') : t('l.kill'));
      if (streaks) {
        const n = ++st.streak;
        if (n > st.best) st.best = n;
        const bonus = n === 3 ? 30 : n === 5 ? 60 : n === 7 ? 100 : n >= 10 && n % 5 === 0 ? 150 : 0;
        if (bonus) { const s = t('hud.streak', { n }); c.msg(s, 'good'); c.reward(bonus, s); if (n >= 5) E.heal(P, 25); }
      }
      return true;
    },
    baseStats() { const st = c.st; return [{ label: t('end.kills'), value: st.kills }, { label: t('end.deaths'), value: st.deaths }, { label: t('end.headshots'), value: st.heads }]; },
    finish(won, title, stats, bonus) {
      if (c.ended) return;
      c.ended = true;
      c.prompt(null); c.progress(null);
      c.reward(bonus, title);
      const xp = Math.round(c.st.score * 0.5) + (won === true ? 300 : won === null ? 180 : 100);
      E.endMatch({ won, title, stats, credits: c.earned, xp });
    },
    cleanup() {
      for (let i = 0; i < subs.length; i++) { try { subs[i](); } catch { /* listener already gone */ } }
      subs.length = 0;
      for (const id of markers) E.hud.marker(id, null);
      markers.clear();
      lastPrompt = undefined; lastProgL = undefined; lastTimer = undefined; lastObj = undefined; lastCenter = undefined;
      E.hud.prompt(null); E.hud.progress(null, null); E.hud.scoreboard(null);
      E.hud.set({ timer: null, objective: null, center: '' });
      if (E.rules) E.rules.frozen = false;
    },
  };
  return c;
}

/* ---------- helpers ---------- */
const isSoldier = a => a.kind !== 'zombie';
function ensureData(a) { if (!a.data) a.data = {}; a.data.k = 0; a.data.d = 0; a.data.s = 0; return a; }
function pickGun(rnd) {
  let total = 0;
  for (let i = 0; i < BOT_GUNS.length; i++) total += BOT_GUN_WEIGHT[BOT_GUNS[i]] || 1;
  let r = rnd() * total;
  for (let i = 0; i < BOT_GUNS.length; i++) { r -= BOT_GUN_WEIGHT[BOT_GUNS[i]] || 1; if (r <= 0) return BOT_GUNS[i]; }
  return 'ar';
}
function botCount(cfg, def, lo, hi) { const n = Number(cfg.bots); return clamp(Number.isFinite(n) ? Math.round(n) : def, lo, hi); }
function addBots(c, n, team, offset) {
  const { E, cfg } = c, out = [];
  for (let i = 0; i < n; i++) {
    const a = E.addBot({ name: BOT_NAMES[(offset + i) % BOT_NAMES.length], team, weaponId: pickGun(c.rnd), difficulty: cfg.difficulty || 'normal', hp: 100 });
    if (a) { ensureData(a); out.push(a); }
  }
  return out;
}
function setOrder(a, type, x, z, radius, actor) {
  const ai = a.ai;
  if (!ai) return;
  const o = ai.order;
  if (o && o.type === type && (type === 'hunt' || (type === 'follow' ? o.actor === actor : o.x === x && o.z === z && o.radius === radius))) return;
  ai.order = type === 'hunt' ? { type } : type === 'follow' ? { type, actor } : { type, x, z, radius };
}
function setRules(E, autoRespawn, regen) {
  const r = E.rules || (E.rules = {});
  r.friendlyFire = false; r.autoRespawn = autoRespawn; r.respawnDelay = 3; r.regen = regen; r.playerLoadout = true; r.frozen = false;
}
function board(c, teams) {
  const E = c.E, A = E.actors, rows = [];
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (!isSoldier(a) || !a.data) continue;
    const row = [a.name || c.t('l.player'), a.data.k | 0, a.data.d | 0, a.data.s | 0];
    row.team = a.team; row.me = a === E.player; row.alive = !!a.alive;
    rows.push(row);
  }
  rows.sort((x, y) => (teams ? (x.team | 0) - (y.team | 0) : 0) || y[3] - x[3] || y[1] - x[1]);
  E.hud.scoreboard({ columns: [c.t('l.player'), c.t('end.kills'), c.t('end.deaths'), c.t('l.statScore')], rows });
}
function endTitle(c, won) { return c.t(won === true ? 'end.victory' : won === false ? 'end.defeat' : 'end.draw'); }

/* map analysis: spawn sides and objective placement through E.nav */
function centroid(list) { let x = 0, z = 0; for (const p of list) { x += p[0]; z += p[1]; } const n = list.length || 1; return [x / n, z / n]; }
function geometry(E) {
  const s0 = E.spawns(0) || [], s1 = E.spawns(1) || [];
  let all = E.spawns(null) || [];
  if (!all.length) all = s0.concat(s1);
  const size = (E.world && Number(E.world.size)) || 40;
  let c0 = centroid(s0.length ? s0 : all), c1 = centroid(s1.length ? s1 : all);
  let dx = c1[0] - c0[0], dz = c1[1] - c0[1], len = Math.hypot(dx, dz);
  if (len < 6) { c0 = [-size * 0.6, 0]; c1 = [size * 0.6, 0]; dx = c1[0] - c0[0]; dz = 0; len = dx; }
  // objectives only have to stay clear of the two team spawn areas (maps also carry free-for-all spawns in the middle)
  const team = s0.length && s1.length ? s0.concat(s1) : all;
  return { s0: s0.length ? s0 : all, s1: s1.length ? s1 : all, all, team, c0, c1, ux: dx / len, uz: dz / len, len, size };
}
function minDist(p, pts) { let m = Infinity; for (const q of pts) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < m) m = d; } return m; }
const TRIES = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2]];
function pickPoint(E, g, wx, wz, avoid, minAvoid, others, minOther, from, ok) {
  const nav = E.nav, step = Math.max(4, g.size * 0.12);
  const reach = p => { for (const f of from) if (!nav.reachable(f[0], f[1], p[0], p[1])) return false; return true; };
  for (const [a, b] of TRIES) {
    const p = nav.nearest(wx + a * step, wz + b * step);
    if (!p || minDist(p, avoid) < minAvoid || minDist(p, others) < minOther || (ok && !ok(p)) || !reach(p)) continue;
    return [p[0], p[1]];
  }
  const pts = avoid.concat(others);
  for (let pass = 0; pass < 2; pass++) {
    for (let d = Math.max(minAvoid, minOther); d >= 3; d *= 0.65) {
      const p = nav.far(pts, d);
      if (p && (pass || !ok || ok(p)) && minDist(p, others) >= Math.min(d, minOther) && minDist(p, avoid) >= Math.min(d, minAvoid) * 0.8 && reach(p)) return [p[0], p[1]];
    }
  }
  const p = nav.nearest(wx, wz);
  return p ? [p[0], p[1]] : [wx, wz];
}
function pickZones(E) {
  const g = geometry(E), px = -g.uz, pz = g.ux, off = clamp(g.size * 0.42, 6, 26);
  const from = [E.nav.nearest(g.s0[0][0], g.s0[0][1]) || g.s0[0], E.nav.nearest(g.s1[0][0], g.s1[0][1]) || g.s1[0]];
  const minSpawn = clamp(g.len * 0.2, 5, 12), minSep = clamp(g.len * 0.25, 7, 16), out = [];
  const want = [[0.3, off], [0.5, -off * 0.25], [0.7, -off]];
  for (const [k, o] of want) out.push(pickPoint(E, g, g.c0[0] + g.ux * g.len * k + px * o, g.c0[1] + g.uz * g.len * k + pz * o, g.team, minSpawn, out, minSep, from, null));
  return out;
}
function pickSites(E) {
  const g = geometry(E), px = -g.uz, pz = g.ux, off = clamp(g.size * 0.4, 7, 24);
  const from = [E.nav.nearest(g.s0[0][0], g.s0[0][1]) || g.s0[0]];
  const nearDef = p => Math.hypot(p[0] - g.c1[0], p[1] - g.c1[1]) < Math.hypot(p[0] - g.c0[0], p[1] - g.c0[1]);
  const minSpawn = clamp(g.len * 0.14, 4, 9), minSep = clamp(off * 1.1, 9, 22), out = [];
  for (const o of [off, -off]) out.push(pickPoint(E, g, g.c0[0] + g.ux * g.len * 0.7 + px * o, g.c0[1] + g.uz * g.len * 0.7 + pz * o, g.team, minSpawn, out, minSep, from, nearDef));
  return { sites: out, g };
}

/* ====================================================================== */
/* OFFLINE: the mode is the referee                                       */
/* ====================================================================== */

function ffaOffline(c) {
  const { E, cfg, t } = c, P = E.player, LIMIT = 20, TIME = 240;
  const S = { limit: LIMIT, left: TIME, done: false };
  function refresh() {
    let top = null;
    const A = E.actors;
    for (let i = 0; i < A.length; i++) { const a = A[i]; if (a !== P && isSoldier(a) && a.data && (!top || a.data.k > top.data.k)) top = a; }
    c.score({ label: t('hud.you'), value: P.data.k, color: BLUE }, { label: top ? top.name : t('l.leader'), value: top ? top.data.k : 0, color: RED });
    board(c, false);
  }
  function end(timeUp) {
    let better = 0, equal = 0;
    const A = E.actors;
    for (let i = 0; i < A.length; i++) { const a = A[i]; if (a === P || !isSoldier(a) || !a.data) continue; if (a.data.k > P.data.k) better++; else if (a.data.k === P.data.k) equal++; }
    const won = better ? false : equal ? null : true;
    if (timeUp) c.msg(t('end.timeUp'), 'info');
    const stats = c.baseStats();
    stats.push({ label: t('l.statRank'), value: '#' + (better + 1) }, { label: t('l.statStreak'), value: c.st.best });
    c.finish(won, endTitle(c, won), stats, won ? 150 : won === null ? 80 : 40);
  }
  return {
    state: S,
    start() {
      setRules(E, true, true);
      E.clearActors(); E.setTeam(P, null); ensureData(P);
      const bots = addBots(c, botCount(cfg, 7, 1, 11), null, 0);
      for (const b of bots) setOrder(b, 'hunt');
      E.respawn(P, { at: null, delay: 0 });
      c.on('kill', e => {
        const v = e.victim, k = e.killer;
        if (c.ended || !v || !isSoldier(v)) return;
        if (v.data) v.data.d++;
        if (k && k !== v && k.data) { k.data.k++; k.data.s += e.head ? 125 : 100; }
        c.trackKill(e, 25, true);
        refresh();
        if (k && k !== v && k.data && k.data.k >= LIMIT) S.done = true;
      });
      E.hud.set({ center: t('mode.deathmatch'), objective: t('l.objFfa', { n: LIMIT }) });
      c.timer(TIME); refresh();
    },
    update(dt) { if (S.done) return end(false); S.left -= dt; c.clock(S); if (S.left <= 0) end(true); },
  };
}

function teamHud(c, score) {
  const my = c.E.player.team === 1 ? 1 : 0, en = 1 - my, t = c.t;
  c.score({ label: t(my === 0 ? 'l.alpha' : 'l.bravo'), value: score[my], color: BLUE }, { label: t(en === 0 ? 'l.alpha' : 'l.bravo'), value: score[en], color: RED });
}
function spawnTeams(c, def) {
  const { E, cfg } = c, P = E.player;
  E.clearActors(); E.setTeam(P, 0); ensureData(P);
  const total = botCount(cfg, def, 1, 11) + 1, allies = Math.ceil(total / 2) - 1, enemies = total - 1 - allies;
  return { allies: addBots(c, allies, 0, 0), enemies: addBots(c, enemies, 1, allies) };
}

function tdmOffline(c) {
  const { E, t } = c, P = E.player, LIMIT = 40, TIME = 420;
  const S = { limit: LIMIT, left: TIME, score: [0, 0], done: false };
  function end(timeUp) {
    const my = P.team, a = S.score[my], b = S.score[1 - my], won = a === b ? null : a > b;
    if (timeUp) c.msg(t('end.timeUp'), 'info');
    const stats = c.baseStats();
    stats.push({ label: t('l.statScore'), value: a + ' - ' + b }, { label: t('l.statStreak'), value: c.st.best });
    c.finish(won, endTitle(c, won), stats, won ? 180 : won === null ? 90 : 50);
  }
  return {
    state: S,
    start() {
      setRules(E, true, true);
      const { allies, enemies } = spawnTeams(c, 7);
      for (const b of allies) setOrder(b, 'hunt');
      for (const b of enemies) setOrder(b, 'hunt');
      E.respawn(P, { at: null, delay: 0 });
      c.on('kill', e => {
        const v = e.victim, k = e.killer;
        if (c.ended || !v || !isSoldier(v)) return;
        if (v.data) v.data.d++;
        const scored = k && k !== v && isSoldier(k) && k.team !== v.team && (k.team === 0 || k.team === 1);
        if (scored) { if (k.data) { k.data.k++; k.data.s += e.head ? 125 : 100; } S.score[k.team]++; }
        c.trackKill(e, 25, true);
        teamHud(c, S.score); board(c, true);
        if (scored && S.score[k.team] >= LIMIT) S.done = true;
      });
      E.hud.set({ center: t('mode.teams'), objective: t('l.objTdm', { n: LIMIT }) });
      c.timer(TIME); teamHud(c, S.score); board(c, true);
    },
    update(dt) { if (S.done) return end(false); S.left -= dt; c.clock(S); if (S.left <= 0) end(true); },
  };
}

function domOffline(c) {
  const { E, t } = c, P = E.player, LIMIT = 150, TIME = 480, CAP = 8, R = 6, R2 = R * R;
  const S = { limit: LIMIT, left: TIME, score: [0, 0], zones: [], caps: 0 };
  const sCap = [], sCon = [], cnt = [0, 0, 0];
  const T = { acc: 0, orderT: 0 };
  function mark(z) { c.marker('dom_' + z.id, { x: z.x, y: 1.2, z: z.z, label: z.id, color: z.contested ? GOLD : z.owner === null ? NEUTRAL : z.owner === P.team ? BLUE : RED }); }
  function held() { let n = 0; for (const z of S.zones) if (z.owner === P.team) n++; c.objective(t('l.held', { n })); }
  function orders() {
    const A = E.actors, Z = S.zones;
    for (let team = 0; team < 2; team++) {
      cnt[0] = cnt[1] = cnt[2] = 0;
      let idx = 0;
      for (let i = 0; i < A.length; i++) {
        const a = A[i];
        if (a.isPlayer || !isSoldier(a) || a.team !== team || !a.ai) continue;
        const holder = idx++ % 3 === 2;
        let best = -1, bestV = Infinity, hold = false;
        if (holder) for (let k = 0; k < Z.length; k++) { if (Z[k].owner !== team) continue; const v = cnt[k] * 30 + Math.sqrt(d2(a.pos.x, a.pos.z, Z[k].x, Z[k].z)); if (v < bestV) { bestV = v; best = k; hold = true; } }
        if (best < 0) for (let k = 0; k < Z.length; k++) { if (Z[k].owner === team) continue; const v = cnt[k] * 14 + Math.sqrt(d2(a.pos.x, a.pos.z, Z[k].x, Z[k].z)) - (a.data.zone === k ? 6 : 0); if (v < bestV) { bestV = v; best = k; } }
        if (best < 0) { hold = true; for (let k = 0; k < Z.length; k++) if (cnt[k] < bestV) { bestV = cnt[k]; best = k; } }
        if (best < 0) continue;
        cnt[best]++; a.data.zone = best;
        if (hold) setOrder(a, 'hold', Z[best].x, Z[best].z, R - 1); else setOrder(a, 'goto', Z[best].x, Z[best].z, R * 0.5);
      }
    }
  }
  function changed(z, before, playerIn) {
    mark(z); held(); T.orderT = 0;
    if (z.owner === P.team) {
      c.msg(t('dom.captured', { point: z.id }), 'good');
      if (playerIn) { S.caps++; c.st.score += 150; c.reward(50, t('l.capture')); if (P.data) P.data.s += 150; }
    } else if (before === P.team) c.msg(t('dom.lost', { point: z.id }), 'bad');
    else if (z.owner !== null) E.hud.feed(t('dom.lost', { point: z.id }));
  }
  function end(timeUp) {
    const my = P.team, a = S.score[my], b = S.score[1 - my], won = a === b ? null : a > b;
    if (timeUp) c.msg(t('end.timeUp'), 'info');
    const stats = c.baseStats();
    stats.push({ label: t('l.statScore'), value: a + ' - ' + b }, { label: t('l.statCaps'), value: S.caps });
    c.finish(won, endTitle(c, won), stats, won ? 200 : won === null ? 100 : 60);
  }
  return {
    state: S,
    start() {
      setRules(E, true, true);
      spawnTeams(c, 7);
      const pts = pickZones(E);
      for (let i = 0; i < 3; i++) {
        const z = { id: ZONE_IDS[i], x: pts[i][0], z: pts[i][1], r: R, owner: null, prog: 0, contested: false };
        S.zones.push(z); mark(z);
        sCap.push(t('dom.capturing', { point: z.id })); sCon.push(t('l.contested', { point: z.id }));
      }
      E.respawn(P, { at: null, delay: 0 });
      c.on('kill', e => {
        const v = e.victim, k = e.killer;
        if (c.ended || !v || !isSoldier(v)) return;
        if (v.data) v.data.d++;
        if (k && k !== v && k.data && k.team !== v.team) { k.data.k++; k.data.s += e.head ? 125 : 100; }
        c.trackKill(e, 20, true);
        board(c, true);
      });
      E.hud.set({ center: t('mode.domination') });
      c.msg(t('l.objDom', { n: LIMIT }), 'info');
      c.timer(TIME); teamHud(c, S.score); held(); orders(); board(c, true);
    },
    update(dt) {
      const A = E.actors, Z = S.zones, rate = dt / CAP;
      let inZone = -1;
      for (let zi = 0; zi < Z.length; zi++) {
        const z = Z[zi];
        let n0 = 0, n1 = 0, me = false;
        for (let i = 0; i < A.length; i++) {
          const a = A[i];
          if (!a.alive || !isSoldier(a) || (a.team !== 0 && a.team !== 1)) continue;
          const dx = a.pos.x - z.x, dz = a.pos.z - z.z;
          if (dx * dx + dz * dz > R2) continue;
          if (a.team === 0) n0++; else n1++;
          if (a === P) me = true;
        }
        const con = n0 > 0 && n1 > 0, before = z.owner;
        if (!con) {
          if (n0 || n1) { const v = z.prog + (n0 ? 1 : -1) * rate * Math.min(3, n0 + n1); z.prog = v < -1 ? -1 : v > 1 ? 1 : v; }
          else {
            const home = z.owner === 0 ? 1 : z.owner === 1 ? -1 : 0;
            if (z.prog !== home) z.prog = Math.abs(home - z.prog) <= rate ? home : z.prog + Math.sign(home - z.prog) * rate;
          }
          if (z.prog >= 1) z.owner = 0; else if (z.prog <= -1) z.owner = 1;
          else if ((z.owner === 0 && z.prog <= 0) || (z.owner === 1 && z.prog >= 0)) z.owner = null;
        }
        if (con !== z.contested) { z.contested = con; mark(z); }
        if (z.owner !== before) changed(z, before, me);
        if (me) inZone = zi;
      }
      if (inZone >= 0) {
        const z = Z[inZone], mine = z.prog * (P.team === 0 ? 1 : -1);
        c.frac = (mine + 1) / 2;
        if (z.contested) c.progress(sCon[inZone]);
        else if (z.owner === P.team && mine >= 1) c.progress(null);
        else c.progress(sCap[inZone]);
      } else c.progress(null);
      T.acc += dt;
      if (T.acc >= 1) {
        T.acc -= 1;
        let gain = false;
        for (let i = 0; i < Z.length; i++) if (Z[i].owner !== null) { S.score[Z[i].owner]++; gain = true; }
        if (gain) { teamHud(c, S.score); if (S.score[0] >= LIMIT || S.score[1] >= LIMIT) return end(false); }
      }
      T.orderT -= dt;
      if (T.orderT <= 0) { T.orderT = 1.5; orders(); }
      S.left -= dt; c.clock(S);
      if (S.left <= 0) end(true);
    },
  };
}

function bombOffline(c) {
  const { E, t } = c, P = E.player;
  const FREEZE = 4, ROUND = 105, FUSE = 40, PLANT = 3.2, DEFUSE = 5, GAP = 4.5, WIN = 5, HALF = 4, SITE_R = 5, DEFUSE_R2 = 3 * 3, BOT_PLANT_R2 = 3 * 3, BOT_DEFUSE_R2 = 2.6 * 2.6, PICK_R2 = 1.6 * 1.6;
  const S = {
    round: 0, wins: [0, 0], att: 0, phase: 'idle', left: 0, sites: [], carrier: null, target: 0,
    bomb: { state: 'none', x: 0, z: 0, site: -1 }, plantBy: null, plantT: 0, defBy: null, defT: 0, pDefT: 0,
    matchOver: false, lastWinner: null, lastReason: null, plants: 0, defuses: 0, pulseT: 0, scanT: 0,
  };
  let g = null, sHoldPlant = '', sPlanting = '', sHoldDefuse = '', sDefusing = '', lit = false, mkHi = null, mkLo = null, sHi = '', sLo = '';
  // a living attacker within 12 m that can see the actor
  function watched(a) {
    const A = E.actors;
    for (let i = 0; i < A.length; i++) {
      const e = A[i];
      if (!e.alive || !isSoldier(e) || e.team !== S.att) continue;
      const dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z;
      if (dx * dx + dz * dz < 144 && E.los(a.pos.x, a.pos.y + 1.4, a.pos.z, e.pos.x, e.pos.y + 1.4, e.pos.z)) return true;
    }
    return false;
  }
  const alive = (team, except) => { let n = 0; const A = E.actors; for (let i = 0; i < A.length; i++) { const a = A[i]; if (a !== except && isSoldier(a) && a.team === team && a.alive) n++; } return n; };
  function hud(except) {
    const my = P.team, en = 1 - my;
    c.score({ label: t(S.att === my ? 'bomb.attackers' : 'bomb.defenders'), value: S.wins[my], color: BLUE }, { label: t(S.att === en ? 'bomb.attackers' : 'bomb.defenders'), value: S.wins[en], color: RED });
    if (S.phase !== 'planted') c.center(t('round.number', { n: S.round }) + ' · ' + alive(my, except) + ' v ' + alive(en, except));
  }
  function objective() {
    const b = S.bomb, attacking = P.team === S.att;
    if (b.state === 'planted') c.objective(t(attacking ? 'l.protect' : 'bomb.defuse'));
    else if (!attacking) c.objective(t('l.defend'));
    else if (b.state === 'dropped') c.objective(t('l.getBomb'));
    else if (S.carrier === P) c.objective(t('l.carrier'));
    else c.objective(S.carrier ? t('l.escort', { name: S.carrier.name }) : t('bomb.plant'));
  }
  function orders() {
    const A = E.actors, b = S.bomb, planted = b.state === 'planted', site = S.sites[S.target];
    let fetcher = null, ia = 0, id = 0;
    if (b.state === 'dropped') {
      let best = Infinity;
      for (let i = 0; i < A.length; i++) { const a = A[i]; if (a.isPlayer || !isSoldier(a) || !a.alive || a.team !== S.att) continue; const d = d2(a.pos.x, a.pos.z, b.x, b.z); if (d < best) { best = d; fetcher = a; } }
    }
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (a.isPlayer || !isSoldier(a) || !a.ai) continue;
      if (a.team === S.att) {
        if (planted) setOrder(a, 'hold', b.x, b.z, 7);
        else if (a === S.carrier) setOrder(a, 'goto', site.x, site.z, 1.5);
        else if (a === fetcher) setOrder(a, 'goto', b.x, b.z, 0.5);
        else if ((ia++ & 1) === 0 && S.carrier && S.carrier.alive) setOrder(a, 'follow', 0, 0, 0, S.carrier);
        else setOrder(a, 'goto', site.x, site.z, SITE_R);
      } else if (planted) setOrder(a, 'goto', b.x, b.z, 1.5);
      else { const s = S.sites[id++ & 1]; setOrder(a, 'hold', s.x, s.z, SITE_R + 2); }
    }
  }
  function beginRound() {
    S.round++;
    if (S.round === HALF + 1) { S.att = 1 - S.att; c.msg(t('l.swap'), 'info'); }
    S.phase = 'freeze'; S.left = FREEZE; E.rules.frozen = true;
    if (typeof E.clearProjectiles === 'function') E.clearProjectiles();      // no grenade from the last round goes off in this one
    S.bomb.state = 'carried'; S.bomb.site = -1; S.plantBy = null; S.plantT = 0; S.defBy = null; S.defT = 0; S.pDefT = 0;
    c.marker('bomb', null); c.prompt(null); c.progress(null);
    sHoldPlant = t('bomb.holdPlant', { key: c.key }); sPlanting = t('bomb.planting'); sHoldDefuse = t('bomb.holdDefuse', { key: c.key }); sDefusing = t('bomb.defusing');
    const A = E.actors, idx = [0, 0], attackers = [];
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (!isSoldier(a) || (a.team !== 0 && a.team !== 1)) continue;
      const list = a.team === S.att ? g.s0 : g.s1, n = idx[a.team]++, base = list[n % list.length], ring = Math.floor(n / list.length);
      let at = [base[0], base[1]];
      if (ring) { const p = E.nav.nearest(base[0] + Math.cos(n * 2.4) * 1.6 * ring, base[1] + Math.sin(n * 2.4) * 1.6 * ring); if (p) at = [p[0], p[1]]; }
      if (!a.data) a.data = {};
      E.respawn(a, { at, delay: 0 });
      a.data.home = [a.pos.x, a.pos.z];
      if (a.team === S.att) attackers.push(a);
      if (a.ai) setOrder(a, 'hold', a.pos.x, a.pos.z, 1);
    }
    const bots = attackers.filter(a => a !== P);
    S.carrier = P.team === S.att && (!bots.length || c.rnd() < 0.5) ? P : bots[Math.floor(c.rnd() * bots.length)] || null;
    S.target = c.rnd() < 0.5 ? 0 : 1;
    c.timer(FREEZE); hud(null); objective();
    c.msg(t('round.number', { n: S.round }) + ' · ' + t(P.team === S.att ? 'bomb.attackers' : 'bomb.defenders'), 'info');
    if (S.wins[0] === WIN - 1 || S.wins[1] === WIN - 1) c.msg(t('l.matchPoint'), 'info');
    board(c, true);
  }
  function goLive() {
    const A = E.actors;
    for (let i = 0; i < A.length; i++) { const a = A[i]; if (isSoldier(a) && !a.alive && a.data && a.data.home) E.respawn(a, { at: a.data.home, delay: 0 }); }
    S.phase = 'live'; S.left = ROUND; E.rules.frozen = false;
    orders(); hud(null);
  }
  function drop(v) {
    const b = S.bomb;
    b.state = 'dropped'; b.x = v.pos.x; b.z = v.pos.z; S.carrier = null; S.plantBy = null; S.plantT = 0;
    c.marker('bomb', { x: b.x, y: 0.1, z: b.z, label: t('mode.bomb'), color: GOLD });
    c.msg(t('l.dropped'), P.team === S.att ? 'bad' : 'info');
  }
  function planted(by, si) {
    const b = S.bomb;
    b.state = 'planted'; b.x = by.pos.x; b.z = by.pos.z; b.site = si;
    S.phase = 'planted'; S.left = FUSE; S.plantBy = null; S.plantT = 0; S.defBy = null; S.defT = 0; S.pDefT = 0;
    S.plants += by === P ? 1 : 0;
    if (by.data) by.data.s += 150;
    if (by === P) { c.st.score += 150; c.reward(75, t('bomb.planted')); }
    const label = t('bomb.site', { site: S.sites[si].id });
    mkHi = { x: b.x, y: 0.1, z: b.z, label, color: BOMB_HI }; mkLo = { x: b.x, y: 0.1, z: b.z, label, color: BOMB_LO };
    sHi = '● ' + t('bomb.planted') + ' · ' + label; sLo = '○ ' + t('bomb.planted') + ' · ' + label;
    S.pulseT = 0; lit = false;
    c.msg(t('bomb.planted') + ' · ' + label, P.team === S.att ? 'good' : 'bad');
    c.prompt(null); c.progress(null);
    orders(); objective(); board(c, true);
  }
  function endRound(winner, reason) {
    if (S.phase === 'over' || S.phase === 'idle') return;
    S.phase = 'over'; S.left = GAP; E.rules.frozen = false;
    S.wins[winner]++; S.lastWinner = winner; S.lastReason = reason;
    S.plantBy = null; S.defBy = null;
    c.prompt(null); c.progress(null); c.timer(null);
    const mine = winner === P.team;
    const why = reason === 'detonated' ? t('bomb.exploded') : reason === 'defused' ? t('bomb.defused') : reason === 'time' ? t('end.timeUp') : t(mine ? 'l.elim' : 'l.wiped');
    c.msg(t(mine ? 'round.won' : 'round.lost') + ' · ' + why, mine ? 'good' : 'bad');
    if (mine) c.st.score += 100;
    c.reward(mine ? 100 : 25, t(mine ? 'round.won' : 'round.lost'));
    if (S.wins[winner] >= WIN) S.matchOver = true;
    hud(null); board(c, true);
  }
  function finish() {
    const my = P.team, won = S.wins[my] > S.wins[1 - my];
    const stats = c.baseStats();
    stats.push({ label: t('l.statRounds'), value: S.wins[my] + ' - ' + S.wins[1 - my] }, { label: t('l.statPlants'), value: S.plants }, { label: t('l.statDefuses'), value: S.defuses });
    c.finish(won, endTitle(c, won), stats, won ? 220 : 70);
  }
  function explode() {
    const b = S.bomb, A = E.actors;
    endRound(S.att, 'detonated');
    if (typeof E.explode === 'function') { E.explode(b.x, b.y || 0, b.z, { radius: 10, damage: 260, by: null, weaponId: null }); return; }      // engine blast: falloff, cover, knockback, effects
    for (let i = A.length - 1; i >= 0; i--) {
      const a = A[i];
      if (!a || !a.alive || !isSoldier(a)) continue;
      const d = Math.sqrt(d2(a.pos.x, a.pos.z, b.x, b.z));
      if (d < 10) E.damage(a, 260 * (1 - d / 10), { by: null, head: false, weaponId: null });
    }
  }
  function defused(by) {
    S.defuses += by === P ? 1 : 0;
    if (by.data) by.data.s += 150;
    if (by === P) { c.st.score += 150; c.reward(100, t('bomb.defused')); }
    c.marker('bomb', null);
    endRound(1 - S.att, 'defused');
  }
  return {
    state: S,
    start() {
      setRules(E, false, true);
      spawnTeams(c, 7);
      const picked = pickSites(E);
      g = picked.g;
      for (let i = 0; i < 2; i++) {
        const s = { id: ZONE_IDS[i], x: picked.sites[i][0], z: picked.sites[i][1], r: SITE_R };
        S.sites.push(s);
        c.marker('site_' + s.id, { x: s.x, y: 1.2, z: s.z, label: s.id, color: GOLD });
      }
      c.on('damage', e => { if (S.phase === 'freeze' && e.victim && e.victim.alive && e.amount > 0) E.heal(e.victim, e.amount); });
      c.on('kill', e => {
        const v = e.victim, k = e.killer;
        if (c.ended || !v || !isSoldier(v) || S.phase === 'freeze' || S.phase === 'idle') return;
        if (v.data) v.data.d++;
        if (k && k !== v && k.data && k.team !== v.team) { k.data.k++; k.data.s += e.head ? 125 : 100; }
        c.trackKill(e, 30, false);
        if (S.phase === 'over') { board(c, true); return; }
        if (v === S.carrier && S.bomb.state === 'carried') drop(v);
        if (v === S.plantBy) { S.plantBy = null; S.plantT = 0; }
        if (v === S.defBy) { S.defBy = null; S.defT = 0; }
        const def = 1 - S.att;
        if (alive(def, v) === 0) endRound(S.att, 'elimination');
        else if (S.bomb.state !== 'planted' && alive(S.att, v) === 0) endRound(def, 'elimination');
        else { orders(); objective(); hud(v); board(c, true); }
      });
      beginRound();
    },
    update(dt) {
      const b = S.bomb;
      S.left -= dt;
      if (S.phase === 'freeze') {
        c.clock(S);
        const h = P.data && P.data.home;
        if (h && P.alive && (Math.abs(P.pos.x - h[0]) > 0.02 || Math.abs(P.pos.z - h[1]) > 0.02)) { P.pos.x = h[0]; P.pos.z = h[1]; }
        if (S.left <= 0) goLive();
        return;
      }
      if (S.phase === 'over') { if (S.left <= 0) { if (S.matchOver) finish(); else beginRound(); } return; }
      let wp = null, wl = null;
      const A = E.actors;
      if (S.phase === 'live') {
        c.clock(S);
        if (b.state === 'dropped') {
          for (let i = 0; i < A.length; i++) {
            const a = A[i];
            if (!a.alive || !isSoldier(a) || a.team !== S.att) continue;
            const dx = a.pos.x - b.x, dz = a.pos.z - b.z;
            if (dx * dx + dz * dz > PICK_R2) continue;
            S.carrier = a; b.state = 'carried'; c.marker('bomb', null);
            if (P.team === S.att) c.msg(t(a === P ? 'l.carrier' : 'l.picked'), 'good');
            orders(); objective();
            break;
          }
        }
        const car = S.carrier;
        if (car && b.state === 'carried' && car.alive) {
          if (car === P) {
            let si = -1;
            for (let i = 0; i < 2; i++) { const dx = P.pos.x - S.sites[i].x, dz = P.pos.z - S.sites[i].z; if (dx * dx + dz * dz <= SITE_R * SITE_R) si = i; }
            if (si >= 0 && E.input.held('interact')) {
              if (S.plantBy !== P) { S.plantBy = P; S.plantT = 0; }
              S.plantT += dt; wl = sPlanting; c.frac = S.plantT / PLANT;
              if (S.plantT >= PLANT) return planted(P, si);
            } else { if (S.plantBy === P) { S.plantBy = null; S.plantT = 0; } if (si >= 0) wp = sHoldPlant; }
          } else {
            const s = S.sites[S.target], dx = car.pos.x - s.x, dz = car.pos.z - s.z;
            if (dx * dx + dz * dz <= BOT_PLANT_R2) {
              if (S.plantBy !== car) { S.plantBy = car; S.plantT = 0; setOrder(car, 'hold', car.pos.x, car.pos.z, 1); if (car.team === P.team) E.hud.feed(t('l.allyPlanting', { name: car.name })); }
              S.plantT += dt;
              if (car.team === P.team) { wl = sPlanting; c.frac = S.plantT / PLANT; }
              if (S.plantT >= PLANT) return planted(car, S.target);
            } else if (S.plantBy === car) { S.plantBy = null; S.plantT = 0; }
          }
        }
        c.prompt(wp); c.progress(wl);
        if (S.left <= 0) endRound(1 - S.att, 'time');
        return;
      }
      /* planted */
      c.clock(S);
      S.pulseT -= dt;
      if (S.pulseT <= 0) {                                // visual countdown that speeds up as the fuse burns
        S.pulseT = 0.1 + 0.9 * clamp(S.left / FUSE, 0, 1);
        lit = !lit;
        c.marker('bomb', lit ? mkHi : mkLo); c.center(lit ? sHi : sLo);
      }
      const defending = P.team !== S.att, pdx = P.pos.x - b.x, pdz = P.pos.z - b.z;
      if (defending && P.alive && pdx * pdx + pdz * pdz <= DEFUSE_R2) {
        if (E.input.held('interact')) { S.pDefT += dt; wl = sDefusing; c.frac = S.pDefT / DEFUSE; if (S.pDefT >= DEFUSE) return defused(P); }
        else { S.pDefT = 0; wp = sHoldDefuse; }
      } else S.pDefT = 0;
      let d = S.defBy;
      if (d) { const dx = d.pos.x - b.x, dz = d.pos.z - b.z; if (!d.alive || dx * dx + dz * dz > BOT_DEFUSE_R2) { d = S.defBy = null; S.defT = 0; } }
      if (!d && (S.scanT -= dt) <= 0) {
        S.scanT = 0.25;
        let best = BOT_DEFUSE_R2;
        for (let i = 0; i < A.length; i++) { const a = A[i]; if (a.isPlayer || !a.alive || !isSoldier(a) || a.team === S.att) continue; const dx = a.pos.x - b.x, dz = a.pos.z - b.z, q = dx * dx + dz * dz; if (q <= best) { best = q; d = a; } }
        if (d && S.left > 12 && watched(d)) d = null;      // clear the site first, unless time is running out
        if (d) { S.defBy = d; S.defT = 0; setOrder(d, 'hold', b.x, b.z, 1.2); }
      }
      if (d) {
        S.defT += dt;
        if (defending && wl === null) { wl = sDefusing; c.frac = S.defT / DEFUSE; }
        if (S.defT >= DEFUSE) return defused(d);
      }
      c.prompt(wp); c.progress(wl);
      if (S.left <= 0) { c.marker('bomb', null); explode(); }
    },
  };
}

/* zombies: shared wave composition and spawn director (offline referee and online host) */
const Z_MAX_ALIVE = 22;
function zStats(type, w, diff) {
  const m = diff === 'easy' ? 0.8 : diff === 'hard' ? 1.25 : 1;
  if (type === 'brute') return { type, hp: Math.round((320 + 55 * w) * m), speed: 1.7 + 0.03 * w, damage: Math.round(26 * m) };
  if (type === 'runner') return { type, hp: Math.round((45 + 8 * w) * m), speed: Math.min(6.2, 4.6 + 0.08 * w), damage: Math.round(8 * m) };
  return { type, hp: Math.round((70 + 12 * w) * m), speed: 2 + 0.06 * w, damage: Math.round(10 * m) };
}
function zMix(w, total, rnd, out) {
  out.length = 0;
  const br = w >= 4 ? Math.min(0.18, 0.04 * (w - 3)) : 0, ru = w >= 2 ? Math.min(0.45, 0.1 * (w - 1)) : 0;
  for (let i = 0; i < total; i++) { const r = rnd(); out.push(r < br ? 'brute' : r < br + ru ? 'runner' : 'walker'); }
  if (w % 5 === 0 && total > 0) out[0] = 'brute';
  return out;
}
function zDirector(c, humans) {
  const { E, cfg } = c, queue = [], corpses = [], corpseT = [], safe = { team: null, avoid: humans };
  const D = {
    wave: 0, list: [], nextId: 1, spawnT: 0,
    get pending() { return queue.length; },
    begin(w, total) { D.wave = w; zMix(w, total, c.rnd, queue); D.spawnT = 0; },
    spawn(type) {
      const o = zStats(type, D.wave, cfg.difficulty), at = E.safeSpawn(safe);
      if (at) o.at = [at[0], at[1]];
      const z = E.addZombie(o);
      if (!z) return null;
      if (!z.data) z.data = {};
      z.data.zt = type; z.data.nid = D.nextId++; z.data.zc = 0;
      if (at && z.pos && d2(z.pos.x, z.pos.z, at[0], at[1]) > 4) E.respawn(z, { at: [at[0], at[1]], delay: 0 });
      D.list.push(z);
      return z;
    },
    update(dt, spawning) {
      if (spawning && queue.length && D.list.length < Z_MAX_ALIVE) { D.spawnT -= dt; if (D.spawnT <= 0) { D.spawnT = Math.max(0.15, 0.45 - 0.03 * D.wave); D.spawn(queue.pop()); } }
      while (corpses.length && corpseT[0] <= c.time) { const a = corpses.shift(); corpseT.shift(); if (E.actors.indexOf(a) >= 0) E.removeActor(a); }
    },
    died(z) { const i = D.list.indexOf(z); if (i >= 0) { D.list[i] = D.list[D.list.length - 1]; D.list.pop(); } D.bury(z); },
    bury(z) { corpses.push(z); corpseT.push(c.time + 3.5); },
    relocate() { for (let i = 0; i < D.list.length; i++) { const at = E.safeSpawn(safe); if (at) E.respawn(D.list[i], { at: [at[0], at[1]], delay: 0 }); } },
    clear() {
      queue.length = 0;
      for (const z of D.list) if (E.actors.indexOf(z) >= 0) E.removeActor(z);
      for (const z of corpses) if (E.actors.indexOf(z) >= 0) E.removeActor(z);
      D.list.length = 0; corpses.length = 0; corpseT.length = 0;
    },
  };
  return D;
}
// Health and ammo between waves. The contract has no ammo call, so a respawn in place stands in for it.
function resupply(E, a) {
  if (!a.alive) return;
  E.heal(a, a.maxHp || 100);
  if (typeof E.refill === 'function') { E.refill(a); return; }      // magazines, spare rounds and grenades (bots too)
  if (!a.isPlayer) return;
  const yaw = a.yaw, p = a.pos.y > 0.6 ? E.nav.nearest(a.pos.x, a.pos.z) : null;
  E.respawn(a, { at: p ? [p[0], p[1]] : [a.pos.x, a.pos.z], delay: 0 });
  a.yaw = yaw;
}

function zombieOffline(c) {
  const { E, cfg, t } = c, P = E.player, WAVES = 10, BREAK = 10, FIRST = 4;
  const S = { wave: 0, totalWaves: WAVES, phase: 'break', left: FIRST, remaining: 0, kills: 0, over: false, overT: 0, sinceKill: 0 };
  const humans = [P], D = zDirector(c, humans);
  let lastSec = -1;
  const hud = () => c.score({ label: t('l.wave'), value: S.wave, color: GOLD }, { label: t('l.left'), value: S.remaining, color: RED });
  function beginWave() {
    S.wave++; S.phase = 'live';
    S.remaining = 6 + 4 * S.wave + 2 * (humans.length - 1);
    D.begin(S.wave, S.remaining); S.sinceKill = 0;
    c.timer(null); c.center(t('zombie.wave', { n: S.wave })); c.objective(t('zombie.remaining', { n: S.remaining }));
    c.msg(t('zombie.wave', { n: S.wave }), 'info'); hud();
  }
  function cleared() {
    c.msg(t('zombie.waveCleared', { n: S.wave }), 'good');
    c.reward(40 + 10 * S.wave, t('zombie.waveCleared', { n: S.wave }));
    c.st.score += 100;
    if (S.wave >= WAVES) return finish(true);
    S.phase = 'break'; S.left = BREAK; lastSec = -1;
    for (let i = 0; i < humans.length; i++) {
      const a = humans[i];
      if (!a.alive) { const p = E.nav.nearest(P.pos.x + 2 + i, P.pos.z + 2) || [P.pos.x, P.pos.z]; E.respawn(a, { at: [p[0], p[1]], delay: 0 }); }
      else resupply(E, a);
    }
    E.hud.feed(t('l.resupply'));
  }
  function finish(won) {
    const stats = [{ label: t('l.statWave'), value: S.wave }, { label: t('end.kills'), value: c.st.kills }, { label: t('end.headshots'), value: c.st.heads }];
    if (won) c.msg(t('zombie.survived', { n: S.wave }), 'good');
    c.finish(won, t(won ? 'end.victory' : 'zombie.gameOver'), stats, won ? 300 : 10 * S.wave);
  }
  return {
    state: S, director: D,
    start() {
      setRules(E, false, true);
      E.clearActors(); E.setTeam(P, 0); ensureData(P);
      for (const a of addBots(c, botCount(cfg, 2, 0, 3), 0, 0)) { humans.push(a); setOrder(a, 'follow', 0, 0, 0, P); }
      E.respawn(P, { at: null, delay: 0 });
      c.on('kill', e => {
        const v = e.victim, k = e.killer;
        if (c.ended || !v) return;
        if (v.kind === 'zombie') {
          if (!v.data || v.data.zc) return;
          v.data.zc = 1; D.died(v);
          S.remaining = Math.max(0, S.remaining - 1); S.sinceKill = 0;
          if (k && k.data && isSoldier(k)) { k.data.k++; k.data.s += 50; }
          if (k === P) {
            const st = c.st, type = v.data.zt;
            st.kills++; S.kills++; st.score += 50; if (e.head) st.heads++;
            c.reward((type === 'brute' ? 40 : type === 'runner' ? 15 : 10) + (e.head ? 5 : 0), e.head ? t('hud.headshot') : t('l.kill'));
          }
          c.objective(t('zombie.remaining', { n: S.remaining })); hud();
          return;
        }
        if (v.data) v.data.d++;
        if (v === P) { c.st.deaths++; S.over = true; S.overT = 2.2; c.msg(t('zombie.gameOver'), 'bad'); }
        else c.msg(t('zombie.teammateDown', { name: v.name }), 'bad');
      });
      c.center(t('mode.zombies')); c.objective(t('l.survive')); hud();
    },
    update(dt) {
      D.update(dt, S.phase === 'live' && !S.over);
      if (S.over) { S.overT -= dt; if (S.overT <= 0) finish(false); return; }
      if (S.phase === 'break') {
        S.left -= dt;
        const s = Math.max(0, Math.ceil(S.left - 1e-6));
        if (s !== lastSec) { lastSec = s; c.objective(t('zombie.waveIncoming', { s })); c.timer(s); }
        if (S.left <= 0) beginWave();
        return;
      }
      if (S.remaining <= 0 && !D.pending) return cleared();
      S.sinceKill += dt;
      if (S.sinceKill > 45 && D.list.length > 0 && D.list.length <= 4) { S.sinceKill = 0; D.relocate(); }   // unstick stragglers
    },
    stop() { D.clear(); },
  };
}

/* ====================================================================== */
/* ONLINE: server/server.js is the referee, the mode only mirrors it       */
/* ====================================================================== */

const teamIdx = v => (v === 'A' ? 0 : v === 'B' ? 1 : null);
const teamLetter = i => (i === 0 ? 'A' : i === 1 ? 'B' : null);

function onlineBase(c) {
  const { E, cfg, t } = c, P = E.player, net = cfg.net, mode = cfg.mode;
  const room0 = cfg.room || net.room || {};
  const B = {
    me: room0.you || net.id, hostId: room0.hostId || null, remotes: new Map(), list: [], names: new Map(), left: 0, clockOn: false, last: null, myScore: 0, mode,
    isHost() { return B.hostId === B.me; },
    team() { return P.team === 1 ? 1 : 0; },
    actor(id) { return id === B.me ? P : B.remotes.get(id) || null; },
    name(id) { return id === B.me ? (P.name || t('hud.you')) : B.names.get(id) || t('l.player'); },
    sync(players) {
      if (!Array.isArray(players)) return;
      for (const p of players) {
        const team = mode === 'ffa' ? null : mode === 'zombie' ? 0 : teamIdx(p.team);
        B.names.set(p.id, p.name);
        if (p.id === B.me) { if (P.team !== team) E.setTeam(P, team); continue; }
        let a = B.remotes.get(p.id);
        if (!a) {
          a = E.addRemote({ id: p.id, name: p.name, team, weaponId: 'ar' });
          if (!a) continue;
          if (!a.data) a.data = {};
          a.data.st = p.status || 'alive';
          // a late joiner waits dead for the next round or wave: no phantom soldier standing at a spawn point meanwhile
          if (p.status === 'dead' || p.status === 'downed') { a.alive = false; a.hp = 0; if (a.sol && a.sol.setVisible) a.sol.setVisible(false); }
          B.remotes.set(p.id, a); B.list.push(a);
        } else if (a.team !== team) E.setTeam(a, team);
      }
      for (const [id, a] of B.remotes) if (!players.some(p => p.id === id)) B.drop(id, a);
    },
    drop(id, a) {
      B.remotes.delete(id);
      const i = B.list.indexOf(a);
      if (i >= 0) B.list.splice(i, 1);
      if (E.actors.indexOf(a) >= 0) E.removeActor(a);
    },
    send(type, data) { net.sendAction(type, data); },
    // Everything a 'score' message carries for every mode: stats, earnings, scoreboard, clock.
    score(s) {
      B.last = s; if (typeof s.timeLeft === 'number') { B.left = s.timeLeft / 1000; B.clockOn = true; }
      const rows = [];
      for (const q of s.players || []) {
        const idx = mode === 'ffa' ? null : mode === 'zombie' ? 0 : teamIdx(q.team);
        const row = [B.name(q.id), q.kills, q.deaths, q.score];
        row.team = idx; row.me = q.id === B.me; row.alive = q.status === 'alive';
        rows.push(row);
        if (q.id === B.me) {
          const gain = q.score - B.myScore;
          if (gain > 0) c.reward(gain / 4, t('l.statScore'));
          B.myScore = q.score; c.st.kills = q.kills; c.st.deaths = q.deaths; c.st.score = q.score;
          if (P.team !== idx) E.setTeam(P, idx);
        } else { const a = B.remotes.get(q.id); if (a) { if (!a.data) a.data = {}; a.data.st = q.status; if (a.team !== idx) E.setTeam(a, idx); } }
      }
      rows.sort((x, y) => (x.team | 0) - (y.team | 0) || y[3] - x[3] || y[1] - x[1]);
      E.hud.scoreboard({ columns: [t('l.player'), t('end.kills'), t('end.deaths'), t('l.statScore')], rows });
    },
    teamScore(s) {
      const my = B.team(), a = teamLetter(my), b = teamLetter(1 - my);
      c.score({ label: t(my === 0 ? 'l.alpha' : 'l.bravo'), value: s.teams[a], color: BLUE }, { label: t(my === 0 ? 'l.bravo' : 'l.alpha'), value: s.teams[b], color: RED });
    },
    // Actions every mode understands. Returns true when handled.
    common(a) {
      const d = a.data || {};
      switch (a.type) {
        case 'hp':
          if (typeof d.hp === 'number') { if (d.hp > P.hp) E.heal(P, d.hp - P.hp); if (typeof d.armor === 'number') P.armor = d.armor; }
          return true;
        case 'player_left': {
          c.msg(t('l.leftGame', { name: d.name || B.name(d.id) }), 'info');
          const r = B.remotes.get(d.id);
          if (r) B.drop(d.id, r);
          // the server sends no new 'score' when someone leaves: drop the row from the scoreboard now
          if (B.last && Array.isArray(B.last.players) && B.last.players.some(q => q.id === d.id)) { B.last.players = B.last.players.filter(q => q.id !== d.id); B.score(B.last); }
          return true;
        }
        case 'host_changed': B.hostId = d.id; return false;       // modes may react as well
        default: return false;
      }
    },
    won(e) {
      if (e.reason === 'server_error') return null;
      if (mode === 'zombie') return e.winner === 'humans';
      if (e.winner == null) return null;
      return mode === 'ffa' ? e.winner === B.me : e.winner === teamLetter(B.team());
    },
    end(e, stats, title) {
      if (e.players) B.score(e);
      const won = B.won(e);
      c.finish(won, title || endTitle(c, won), stats, won === true ? 150 : won === null ? 80 : 40);
    },
    init() {
      setRules(E, false, false);
      E.clearActors(); ensureData(P);
      const fresh = net.room && Array.isArray(net.room.players) ? net.room : room0;   // someone may have left while the map loaded
      if (fresh.hostId) B.hostId = fresh.hostId;
      B.sync(fresh.players || []);
      if (!(room0.late && room0.hp === 0)) E.respawn(P, { at: null, delay: 0 });   // late joiners of a running round wait for the server
      c.netOn('room', r => { if (c.ended) return; if (r.hostId) B.hostId = r.hostId; B.sync(r.players); });
      // server stopped or connection dropped: leave the dead match with a message instead of playing on alone forever
      c.netOn('close', () => { if (c.ended) return; c.msg(t('lobby.disconnected'), 'bad'); c.finish(null, t('lobby.disconnected'), c.baseStats(), 0); });
      B.send('loadout', { cls: playerClass(E, cfg) });
      c.on('kill', e => { if (e.killer === P && e.victim !== P) { if (e.head) c.st.heads++; const n = ++c.st.streak; if (n > c.st.best) c.st.best = n; } else if (e.victim === P) c.st.streak = 0; });
    },
  };
  return B;
}

function scoreOnline(c) {                                   // ffa and tdm: kills are scored by the server
  const { t, cfg } = c, B = onlineBase(c), ffa = cfg.mode === 'ffa';
  return {
    state: B,
    start() {
      B.init();
      c.E.hud.set({ center: t(ffa ? 'mode.deathmatch' : 'mode.teams'), objective: t(ffa ? 'l.objFfa' : 'l.objTdm', { n: ONLINE_LIMIT[cfg.mode] }) });
      c.netOn('score', s => {
        if (c.ended) return;
        B.score(s);
        if (!ffa) return B.teamScore(s);
        let mine = 0, top = null;
        for (const q of s.players) { if (q.id === B.me) mine = q.kills; else if (!top || q.kills > top.kills) top = q; }
        c.score({ label: t('hud.you'), value: mine, color: BLUE }, { label: top ? B.name(top.id) : t('l.leader'), value: top ? top.kills : 0, color: RED });
      });
      c.netOn('action', a => { if (!c.ended) B.common(a); });
      c.netOn('end', e => {
        if (c.ended) return;
        const stats = c.baseStats();
        if (ffa) { let rank = 1; for (const q of e.players || []) if (q.id !== B.me && q.kills > c.st.kills) rank++; stats.push({ label: t('l.statRank'), value: '#' + rank }); }
        else if (e.teams) { const my = teamLetter(B.team()); stats.push({ label: t('l.statScore'), value: e.teams[my] + ' - ' + e.teams[my === 'A' ? 'B' : 'A'] }); }
        if (e.reason === 'time') c.msg(t('end.timeUp'), 'info');
        B.end(e, stats);
      });
    },
    update(dt) { if (B.clockOn) { B.left -= dt; c.clock(B); } },
  };
}

function domOnline(c) {
  const { E, t } = c, P = E.player, B = onlineBase(c);
  const pts = [], sCap = [], sCon = [];
  let sent = false, caps = 0;
  function mark(i) { const p = pts[i]; c.marker('dom_' + ZONE_IDS[i], { x: p.x, y: (p.y || 0) + 1.2, z: p.z, label: ZONE_IDS[i], color: p.owner == null ? NEUTRAL : teamIdx(p.owner) === B.team() ? BLUE : RED }); }
  function propose() {
    if (sent || !B.isHost() || pts.length) return;
    sent = true;
    B.send('dom_points', { points: pickZones(E).map(p => ({ x: p[0], y: 0, z: p[1], r: 6 })) });
  }
  function held() { let n = 0; for (const p of pts) if (teamIdx(p.owner) === B.team()) n++; c.objective(t('l.held', { n })); }
  return {
    state: B, points: pts,
    start() {
      B.init();
      E.hud.set({ center: t('mode.domination'), objective: t('l.objDom', { n: ONLINE_LIMIT.dom }) });
      for (let i = 0; i < 3; i++) { sCap.push(t('dom.capturing', { point: ZONE_IDS[i] })); sCon.push(t('l.contested', { point: ZONE_IDS[i] })); }
      c.netOn('score', s => {
        if (c.ended) return;
        B.score(s); B.teamScore(s);
        if (!s.points) return propose();
        for (let i = 0; i < s.points.length && i < 3; i++) {
          const q = s.points[i], p = pts[i] || (pts[i] = { x: 0, y: 0, z: 0, r: 6, owner: undefined, progress: 0 });
          const moved = p.x !== q.x || p.z !== q.z || p.owner !== q.owner;
          p.x = q.x; p.y = q.y; p.z = q.z; p.r = q.r; p.owner = q.owner; p.progress = q.progress;
          if (moved) mark(i);
        }
        held();
      });
      c.netOn('action', a => {
        if (c.ended || B.common(a)) return;
        const d = a.data || {};
        if (a.type === 'host_changed') { sent = false; propose(); }
        else if (a.type === 'dom_capture') {
          const p = pts[d.index], id = ZONE_IDS[d.index], before = p ? p.owner : null, my = teamLetter(B.team());
          if (p) { p.owner = d.owner; mark(d.index); held(); }
          if (d.owner === my) { c.msg(t('dom.captured', { point: id }), 'good'); if (p && P.alive && d2(P.pos.x, P.pos.z, p.x, p.z) <= p.r * p.r) caps++; }
          else if (before === my) c.msg(t('dom.lost', { point: id }), 'bad');
        }
      });
      c.netOn('end', e => {
        if (c.ended) return;
        const stats = c.baseStats(), my = teamLetter(B.team());
        if (e.teams) stats.push({ label: t('l.statScore'), value: e.teams[my] + ' - ' + e.teams[my === 'A' ? 'B' : 'A'] });
        stats.push({ label: t('l.statCaps'), value: caps });
        if (e.reason === 'time') c.msg(t('end.timeUp'), 'info');
        B.end(e, stats);
      });
      propose();
    },
    update(dt) {
      if (B.clockOn) { B.left -= dt; c.clock(B); }
      let shown = false;
      if (P.alive) {
        const sgn = B.team() === 0 ? 1 : -1;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const dx = P.pos.x - p.x, dz = P.pos.z - p.z;
          if (dx * dx + dz * dz > p.r * p.r) continue;
          const mine = p.progress * sgn;
          if (!(teamIdx(p.owner) === B.team() && mine >= 1)) { c.frac = (mine + 1) / 2; c.progress(sCap[i]); shown = true; }
          break;
        }
      }
      if (!shown) c.progress(null);
    },
  };
}

function bombOnline(c) {
  const { E, t } = c, P = E.player, B = onlineBase(c);
  const S = { phase: 'idle', round: 0, att: 0, wins: { A: 0, B: 0 }, bomb: null, sites: null, act: null, plants: 0, defuses: 0 };
  const T = { resend: 0, pulseT: 0 };
  let sent = false, holding = null, lit = false, fuse = 40, mkHi = null, mkLo = null, sHi = '', sLo = '', spot = null;
  let sHoldPlant = '', sPlanting = '', sHoldDefuse = '', sDefusing = '';
  function propose() {
    if (sent || !B.isHost() || S.sites) return;
    sent = true;
    const p = pickSites(E).sites;
    B.send('bomb_sites', { A: { x: p[0][0], y: 0, z: p[0][1], r: 5 }, B: { x: p[1][0], y: 0, z: p[1][1], r: 5 } });
  }
  function setSites(sites) {
    if (!sites || S.sites) return;
    S.sites = sites;
    for (const id of ['A', 'B']) c.marker('site_' + id, { x: sites[id].x, y: (sites[id].y || 0) + 1.2, z: sites[id].z, label: id, color: GOLD });
  }
  function hud() {
    const my = B.team(), a = teamLetter(my), b = teamLetter(1 - my);
    c.score({ label: t(S.att === my ? 'bomb.attackers' : 'bomb.defenders'), value: S.wins[a], color: BLUE }, { label: t(S.att === my ? 'bomb.defenders' : 'bomb.attackers'), value: S.wins[b], color: RED });
    const attacking = S.att === my;
    if (S.phase === 'planted') c.objective(t(attacking ? 'l.protect' : 'bomb.defuse'));
    else { c.center(t('round.number', { n: S.round })); c.objective(t(attacking ? 'bomb.plant' : 'l.defend')); }
  }
  function placeBomb(b) {
    S.bomb = b;
    const label = t('bomb.site', { site: b.site });
    mkHi = { x: b.x, y: (b.y || 0) + 0.1, z: b.z, label, color: BOMB_HI }; mkLo = { x: b.x, y: (b.y || 0) + 0.1, z: b.z, label, color: BOMB_LO };
    sHi = '● ' + t('bomb.planted') + ' · ' + label; sLo = '○ ' + t('bomb.planted') + ' · ' + label;
    T.pulseT = 0; lit = false;
  }
  function round(r) {
    const prev = S.phase;
    S.phase = r.phase; S.round = r.round; S.att = teamIdx(r.attackers) || 0; S.wins = r.wins || S.wins;
    B.left = r.timeLeft / 1000; B.clockOn = true;
    if (r.phase === 'freeze') {
      S.bomb = null; S.act = null; holding = null; c.marker('bomb', null); c.prompt(null); c.progress(null);
      sHoldPlant = t('bomb.holdPlant', { key: c.key }); sPlanting = t('bomb.planting'); sHoldDefuse = t('bomb.holdDefuse', { key: c.key }); sDefusing = t('bomb.defusing');
      E.rules.frozen = true;
      // attackers start on side 0, defenders on side 1, whatever the team letter (keeps the sites on the defenders' side after the swap)
      const mine = B.team(), list = E.spawns(mine === S.att ? 0 : 1) || [];
      let slot = 0;
      for (const a of B.list) if (a.team === mine && String(a.id) < String(B.me)) slot++;
      spot = list.length ? list[slot % list.length] : null;
      if (spot && P.alive) { if (d2(P.pos.x, P.pos.z, spot[0], spot[1]) > 4) E.respawn(P, { at: [spot[0], spot[1]], delay: 0 }); spot = [P.pos.x, P.pos.z]; }
      c.msg(t('round.number', { n: r.round }) + ' · ' + t(mine === S.att ? 'bomb.attackers' : 'bomb.defenders'), 'info');
      if (S.wins.A === 4 || S.wins.B === 4) c.msg(t('l.matchPoint'), 'info');
    } else {
      E.rules.frozen = false;
      if (r.phase === 'planted' && r.bomb && (!S.bomb || prev !== 'planted')) placeBomb(r.bomb);
      if (r.phase === 'intermission') {
        S.act = null; holding = null; c.prompt(null); c.progress(null); c.marker('bomb', null);
        if (r.winner) {
          const mine = r.winner === teamLetter(B.team());
          const why = r.reason === 'detonated' ? t('bomb.exploded') : r.reason === 'defused' ? t('bomb.defused') : r.reason === 'time' ? t('end.timeUp') : t(mine ? 'l.elim' : 'l.wiped');
          c.msg(t(mine ? 'round.won' : 'round.lost') + ' · ' + why, mine ? 'good' : 'bad');
        }
      }
    }
    hud();
  }
  function action(a) {
    if (B.common(a)) return;
    const d = a.data || {};
    switch (a.type) {
      case 'host_changed': sent = false; propose(); break;
      case 'side_swap': c.msg(t('l.swap'), 'info'); break;
      case 'plant_start': case 'defuse_start': {
        const actor = B.actor(d.by);
        if (d.by === B.me || (actor && actor.team === B.team())) S.act = { by: d.by, t: 0, dur: Math.max(0.05, d.duration / 1000), label: a.type === 'plant_start' ? sPlanting : sDefusing };
        if (a.type === 'plant_start' && d.by !== B.me && actor && actor.team === B.team()) E.hud.feed(t('l.allyPlanting', { name: B.name(d.by) }));
        break;
      }
      case 'plant_cancel': case 'defuse_cancel': if (S.act && (d.by == null || S.act.by === d.by)) S.act = null; break;
      case 'bomb_planted':
        S.act = null; fuse = Math.max(1, d.fuse / 1000);
        placeBomb({ site: d.site, x: d.x, y: d.y, z: d.z });
        if (d.by === B.me) S.plants++;
        c.msg(t('bomb.planted') + ' · ' + t('bomb.site', { site: d.site }), S.att === B.team() ? 'good' : 'bad');
        break;
      case 'bomb_defused': S.act = null; if (d.by === B.me) S.defuses++; c.marker('bomb', null); break;
      case 'bomb_exploded': S.act = null; c.marker('bomb', null); if (S.bomb && typeof E.explode === 'function' && typeof S.bomb.x === 'number') E.explode(S.bomb.x, S.bomb.y || 0, S.bomb.z, { radius: 10, damage: 0, by: null, weaponId: null }); break;      // the server deals the damage
      default: break;
    }
  }
  function hold(kind, data, dt) {                              // press starts the server timer, release cancels it
    if (holding !== kind) { holding = kind; T.resend = 0; }
    if (!S.act || S.act.by !== B.me) { T.resend -= dt; if (T.resend <= 0) { T.resend = 0.6; B.send(kind + '_start', data); } }
  }
  function release() { if (holding) { B.send(holding + '_cancel', NO_DATA); holding = null; if (S.act && S.act.by === B.me) S.act = null; } }
  return {
    state: S, base: B,
    start() {
      B.init();
      const room = c.cfg.room || {};
      setSites(room.sites || (c.cfg.net.room && c.cfg.net.room.sites));
      c.netOn('room', r => { if (!c.ended) setSites(r.sites); });
      c.netOn('score', s => { if (!c.ended) B.score(s); });
      c.netOn('round', r => { if (!c.ended) round(r); });
      c.netOn('action', a => { if (!c.ended) action(a); });
      c.netOn('end', e => {
        if (c.ended) return;
        const stats = c.baseStats(), my = teamLetter(B.team());
        if (e.teams) stats.push({ label: t('l.statRounds'), value: e.teams[my] + ' - ' + e.teams[my === 'A' ? 'B' : 'A'] });
        stats.push({ label: t('l.statPlants'), value: S.plants }, { label: t('l.statDefuses'), value: S.defuses });
        B.end(e, stats);
      });
      E.hud.set({ center: t('mode.bomb') });
      propose();
    },
    update(dt) {
      if (B.clockOn && S.phase !== 'intermission') { B.left -= dt; c.clock(B); } else c.timer(null);
      const my = B.team(), attacking = my === S.att;
      let wp = null, wl = null, can = false;
      if (S.phase === 'freeze') { if (spot && P.alive && (Math.abs(P.pos.x - spot[0]) > 0.02 || Math.abs(P.pos.z - spot[1]) > 0.02)) { P.pos.x = spot[0]; P.pos.z = spot[1]; } }
      else if (S.phase === 'live' && attacking && P.alive && S.sites) {
        const sa = S.sites.A, sb = S.sites.B, ax = P.pos.x - sa.x, az = P.pos.z - sa.z, bx = P.pos.x - sb.x, bz = P.pos.z - sb.z;
        const id = ax * ax + az * az <= sa.r * sa.r ? 'A' : bx * bx + bz * bz <= sb.r * sb.r ? 'B' : null;
        if (id) { can = true; if (E.input.held('interact')) hold('plant', id === 'A' ? SITE_A : SITE_B, dt); else { release(); wp = sHoldPlant; } }
      } else if (S.phase === 'planted') {
        T.pulseT -= dt;
        if (T.pulseT <= 0 && mkHi) { T.pulseT = 0.1 + 0.9 * clamp(B.left / fuse, 0, 1); lit = !lit; c.marker('bomb', lit ? mkHi : mkLo); c.center(lit ? sHi : sLo); }
        const bm = S.bomb, dx = bm ? P.pos.x - bm.x : 99, dz = bm ? P.pos.z - bm.z : 99;
        if (!attacking && P.alive && dx * dx + dz * dz <= NET_DEFUSE_R * NET_DEFUSE_R) {
          can = true;
          if (E.input.held('interact')) hold('defuse', NO_DATA, dt); else { release(); wp = sHoldDefuse; }
        }
      }
      if (!can && holding) release();
      if (S.act) { S.act.t += dt; wl = S.act.label; c.frac = S.act.t / S.act.dur; if (S.act.by === B.me) wp = null; }
      c.prompt(wp); c.progress(wl);
    },
  };
}

function zombieOnline(c) {
  const { E, t } = c, P = E.player, B = onlineBase(c);
  const S = { phase: 'intermission', wave: 0, total: 10, remaining: 0, downed: false, bleed: 0, act: null };
  const humans = [P], D = zDirector(c, humans);
  const mirrors = new Map(), mirrorList = [], pool = [], syncArr = [], syncMsg = { zombies: syncArr }, killed = new Set();
  const T = { syncT: 0, resend: 0 };
  let stamp = 0, holding = null, lastSec = -1, hosting = false, sReviving = '';
  const hud = () => c.score({ label: t('l.wave'), value: S.wave, color: GOLD }, { label: t('l.left'), value: Math.max(0, S.remaining), color: RED });
  const serverId = a => (a === P ? B.me : a && a.isRemote ? a.id : undefined);
  function refreshHumans() { humans.length = 1; for (const a of B.list) humans.push(a); }
  function dropMirror(nid, a, corpse) {
    mirrors.delete(nid);
    const i = mirrorList.indexOf(a);
    if (i >= 0) { mirrorList[i] = mirrorList[mirrorList.length - 1]; mirrorList.pop(); }
    if (corpse) D.bury(a); else if (E.actors.indexOf(a) >= 0) E.removeActor(a);
  }
  function clearMirrors() { for (const [nid, a] of [...mirrors]) dropMirror(nid, a, false); }
  function round(r) {
    const prev = S.phase;
    S.phase = r.phase; S.wave = r.wave; S.total = r.totalWaves || S.total; S.remaining = r.remaining;
    B.left = r.timeLeft / 1000; B.clockOn = true; lastSec = -1;
    hosting = B.isHost();
    if (r.phase === 'live') {
      c.timer(null); c.center(t('zombie.wave', { n: S.wave })); c.objective(t('zombie.remaining', { n: S.remaining }));
      c.msg(t('zombie.wave', { n: S.wave }), 'info');
      if (prev !== 'live') { killed.clear(); if (hosting) { refreshHumans(); D.begin(S.wave, S.remaining); } }
      S.downed = false;
    } else {
      if (typeof r.cleared === 'number') { c.msg(t('zombie.waveCleared', { n: r.cleared }), 'good'); E.hud.feed(t('l.resupply')); if (typeof E.refill === 'function') E.refill(E.player); }
      S.downed = false; S.act = null;
    }
    hud();
  }
  function onSync(list) {
    if (hosting) return;
    stamp++;
    for (const z of list) {
      if (killed.has(z.id)) continue;
      let a = mirrors.get(z.id);
      if (a && !a.alive) { dropMirror(z.id, a, false); a = null; }
      if (!a) {
        const type = z.state === 'runner' || z.state === 'brute' ? z.state : 'walker';
        a = E.addZombie({ type, hp: z.hp || 100, speed: 0, damage: 0, id: 'z' + z.id, remote: true, at: [z.x, z.z] });
        if (!a) continue;
        if (!a.data) a.data = {};
        a.id = 'z' + z.id; a.isRemote = true; a.data.nid = z.id; a.data.zt = type;
        if (a.pos) { a.pos.x = z.x; a.pos.y = z.y || 0; a.pos.z = z.z; }
        mirrors.set(z.id, a); mirrorList.push(a);
      }
      a.data.tx = z.x; a.data.ty = z.y || 0; a.data.tz = z.z; a.data.tyaw = z.yaw || 0; a.data.seen = stamp;
      if (typeof z.hp === 'number') a.hp = z.hp;
    }
    for (let i = mirrorList.length - 1; i >= 0; i--) { const a = mirrorList[i]; if (stamp - a.data.seen > 12) dropMirror(a.data.nid, a, false); }
  }
  function action(a) {
    if (B.common(a)) return;
    const d = a.data || {};
    switch (a.type) {
      case 'host_changed': hosting = B.isHost(); break;
      case 'z_sync': if (Array.isArray(d.zombies)) onSync(d.zombies); break;
      case 'z_hit': {                                         // a client hit one of the zombies this host simulates
        if (!hosting || typeof d.zombie !== 'string') break;
        const nid = Number(d.zombie.slice(1));
        for (let i = 0; i < D.list.length; i++) { const z = D.list[i]; if (z.data.nid === nid && z.alive) { E.damage(z, d.damage, { by: B.actor(a.from), head: !!d.head, weaponId: d.weapon }); break; } }
        break;
      }
      case 'z_kill': {
        killed.add(d.id);
        if (typeof d.remaining === 'number') S.remaining = d.remaining;
        const m = mirrors.get(d.id);
        if (m) { dropMirror(d.id, m, true); if (m.alive) E.kill(m, { by: B.actor(d.by) }); }
        c.objective(t('zombie.remaining', { n: Math.max(0, S.remaining) })); hud();
        break;
      }
      case 'z_resync': {                                      // this client just became the host mid-wave
        hosting = true; clearMirrors(); D.clear(); refreshHumans();
        let max = 0;
        for (const id of d.killed || []) { killed.add(id); if (id > max) max = id; }
        D.nextId = Math.max(D.nextId, max + 1, 100000 + Math.floor(c.time));
        S.wave = d.wave; S.remaining = d.remaining; S.phase = d.phase;
        if (d.phase === 'live' && d.remaining > 0) D.begin(d.wave, d.remaining);
        hud();
        break;
      }
      case 'revive_start':
        if (d.by === B.me || d.target === B.me) S.act = { by: d.by, t: 0, dur: Math.max(0.05, d.duration / 1000) };
        break;
      case 'revive_cancel': if (S.act && S.act.by === d.by) S.act = null; break;
      default: break;
    }
  }
  return {
    state: S, base: B, director: D, mirrors,
    start() {
      B.init();
      hosting = B.isHost(); refreshHumans(); sReviving = t('zombie.reviving');
      c.netOn('room', () => { if (!c.ended) { hosting = B.isHost(); refreshHumans(); } });
      c.netOn('score', s => {
        if (c.ended) return;
        for (const q of s.players || []) {
          if (q.id === B.me) continue;
          const a = B.remotes.get(q.id);
          if (a && a.data && a.data.st === 'downed' && q.status === 'alive') c.msg(t('zombie.revived', { name: B.name(q.id) }), 'good');
        }
        B.score(s);
        if (typeof s.wave === 'number') S.wave = s.wave;
        if (typeof s.remaining === 'number') S.remaining = s.remaining;
        if (S.phase === 'live') B.clockOn = false;
        hud();
      });
      c.netOn('round', r => { if (!c.ended) round(r); });
      c.netOn('action', a => { if (!c.ended) action(a); });
      c.netOn('death', m => {                                 // HUD only: the engine applies the death itself
        if (c.ended) return;
        if (m.id === B.me) { if (m.downed) { S.downed = true; S.bleed = (m.bleedMs || 0) / 1000; c.msg(t('zombie.downed'), 'bad'); } else S.downed = false; }
        else if (m.downed) c.msg(t('zombie.teammateDown', { name: B.name(m.id) }), 'bad');
      });
      c.netOn('respawn', m => { if (m.id === B.me) { S.downed = false; S.act = null; } });
      c.netOn('end', e => {
        if (c.ended) return;
        const won = e.winner === 'humans';
        const stats = [{ label: t('l.statWave'), value: typeof e.wave === 'number' ? e.wave : S.wave }, { label: t('end.kills'), value: c.st.kills }, { label: t('end.deaths'), value: c.st.deaths }];
        if (won) c.msg(t('zombie.survived', { n: S.wave }), 'good');
        B.end(e, stats, t(won ? 'end.victory' : 'zombie.gameOver'));
      });
      // host only: report what its zombies do so the server can referee it
      c.on('kill', e => {
        const v = e.victim;
        if (!hosting || c.ended || !v || v.kind !== 'zombie' || !v.data || v.data.zc || mirrors.has(v.data.nid)) return;
        v.data.zc = 1; D.died(v);
        B.send('z_kill', { id: v.data.nid, by: serverId(e.killer) });
      });
      c.on('damage', e => {
        if (!hosting || c.ended || !e.attacker || e.attacker.kind !== 'zombie' || !e.victim || e.victim.kind === 'zombie' || !(e.amount > 0)) return;
        const target = serverId(e.victim);
        if (target) B.send('z_damage', { target, damage: Math.min(1000, e.amount) });
      });
      c.center(t('mode.zombies')); c.objective(t('l.survive')); hud();
    },
    update(dt) {
      D.update(dt, hosting && S.phase === 'live');
      if (hosting) {
        T.syncT -= dt;
        if (T.syncT <= 0 && D.list.length) {
          T.syncT = 0.1;
          const L = D.list;
          syncArr.length = L.length;
          for (let i = 0; i < L.length; i++) {
            const z = L[i], o = pool[i] || (pool[i] = { id: 0, x: 0, y: 0, z: 0, yaw: 0, hp: 0, state: '' });
            o.id = z.data.nid; o.x = z.pos.x; o.y = z.pos.y || 0; o.z = z.pos.z; o.yaw = z.yaw || 0; o.hp = Math.max(0, z.hp || 0); o.state = z.data.zt;
            syncArr[i] = o;
          }
          B.send('z_sync', syncMsg);
        }
      } else {
        const k = 1 - Math.exp(-12 * dt);
        for (let i = 0; i < mirrorList.length; i++) {
          const a = mirrorList[i], d = a.data;
          a.pos.x += (d.tx - a.pos.x) * k; a.pos.y += (d.ty - a.pos.y) * k; a.pos.z += (d.tz - a.pos.z) * k; a.yaw = d.tyaw;
        }
      }
      if (S.phase !== 'live' && B.clockOn) {
        B.left -= dt;
        const s = Math.max(0, Math.ceil(B.left - 1e-6));
        if (s !== lastSec) { lastSec = s; c.objective(t('zombie.waveIncoming', { s })); c.timer(s); }
      }
      let wp = null, wl = null, target = null;
      if (S.downed) { S.bleed -= dt; const s = Math.max(0, Math.ceil(S.bleed)); if (s !== lastSec) { lastSec = s; c.objective(t('zombie.bleedout', { s })); } }
      else if (P.alive) {
        let best = NET_REVIVE_R * NET_REVIVE_R;
        for (let i = 0; i < B.list.length; i++) { const a = B.list[i]; if (!a.data || a.data.st !== 'downed') continue; const dx = P.pos.x - a.pos.x, dz = P.pos.z - a.pos.z, q = dx * dx + dz * dz; if (q <= best) { best = q; target = a; } }
      }
      if (target) {
        if (E.input.held('interact')) {
          if (holding !== target) { holding = target; T.resend = 0; }
          if (!S.act || S.act.by !== B.me) { T.resend -= dt; if (T.resend <= 0) { T.resend = 0.6; B.send('revive_start', { target: target.id }); } }
        } else {
          if (holding) { B.send('revive_cancel', NO_DATA); holding = null; if (S.act && S.act.by === B.me) S.act = null; }
          if (target.data.pn !== target.name || !target.data.pt) { target.data.pn = target.name; target.data.pt = t('zombie.holdRevive', { key: c.key, name: target.name }); }
          wp = target.data.pt;
        }
      } else if (holding) { B.send('revive_cancel', NO_DATA); holding = null; if (S.act && S.act.by === B.me) S.act = null; }
      if (S.act) { S.act.t += dt; wl = sReviving; c.frac = S.act.t / S.act.dur; if (S.act.t > S.act.dur + 0.5) S.act = null; }
      c.prompt(wp); c.progress(wl);
    },
    stop() { clearMirrors(); D.clear(); },
  };
}

const OFFLINE = { ffa: ffaOffline, tdm: tdmOffline, dom: domOffline, bomb: bombOffline, zombie: zombieOffline };
const ONLINE = { ffa: scoreOnline, tdm: scoreOnline, dom: domOnline, bomb: bombOnline, zombie: zombieOnline };

export function createMode(id, E, cfg) {
  cfg = cfg || E.cfg || {};
  if (!OFFLINE[id]) id = OFFLINE[cfg.mode] ? cfg.mode : 'ffa';
  if (cfg.mode !== id) cfg = Object.assign({}, cfg, { mode: id });
  const c = makeCtx(E, cfg);
  const impl = (cfg.online && cfg.net ? ONLINE : OFFLINE)[id](c);
  let started = false, stopped = false, resync = !!(cfg.online && cfg.net);
  return {
    id,
    get state() { return impl.state; },
    impl,
    start() { if (started) return; started = true; impl.start(); if (cfg.online && cfg.net && !c.ended) c.replayNet(); },
    update(dt) {
      if (!started || stopped || c.ended || !(dt > 0)) return;
      if (dt > 0.25) dt = 0.25;
      // the engine's shader warm-up blocks for seconds between start() and the first frame: replay again so the clocks are right
      if (resync) { resync = false; c.replayNet(); if (c.ended) return; }
      c.time += dt;
      impl.update(dt);
    },
    stop() {
      if (stopped) return;
      stopped = true; c.ended = true;
      if (started && impl.stop) impl.stop();
      c.cleanup();
    },
  };
}
