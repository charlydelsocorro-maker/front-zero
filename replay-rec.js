// FRONT ZÉRO — MEILLEUR MOMENT (best moment), part 1: the recorder, the best-moment picker and the end-of-match card.
// While a match runs it keeps the last 16 s of the world as this client sees it (every actor at 20 Hz: position, aim, velocity, crouch,
// alive, reloading, weapon, health; shots, kills, blasts, objective actions, hits given and taken by the player) in preallocated typed
// rings: nothing is allocated per frame. Online, remote players are sampled where this screen draws them (net interpolation).
// Around the player's kills it scores candidate windows (multi-kills, headshots, long shots, no-scope, low health, clutch, explosive
// multi-kills, objective under fire, breach then kill, streaks) and copies the best three into fixed buffers as soon as their window
// closes, so later events cannot overwrite them. At the end of the match the end screens (menu.js, match-flow.js) ask
// globalThis.FZReplay.endBlock(where) for the card; the replay (replay-view.js) and the video (replay-export.js) load only then.
// Settings: gameplay.replay (on/off, default on) and gameplay.replayFormat (portrait | landscape). A failure here never touches a match.
import { ALL_WEAPONS, byId } from './data.js';

export const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
export const TX = {
  card: ['MEILLEUR MOMENT', 'BEST MOMENT', 'MEJOR MOMENTO', 'BESTER MOMENT', 'MELHOR MOMENTO', 'MOMENTO MIGLIORE'],
  watch: ['VOIR', 'WATCH', 'VER', 'ANSEHEN', 'VER', 'GUARDA'],
  share: ['Créer la vidéo', 'Make the video', 'Crear el vídeo', 'Video erstellen', 'Criar o vídeo', 'Crea il video'],
  others: ['{n} autres moments', '{n} more moments', '{n} momentos más', '{n} weitere Momente', 'mais {n} momentos', 'altri {n} momenti'],
  other1: ['1 autre moment', '1 more moment', '1 momento más', '1 weiterer Moment', 'mais 1 momento', 'un altro momento'],
  m2: ['DOUBLÉ', 'DOUBLE KILL', 'DOBLE', 'DOPPEL', 'DUPLO', 'DOPPIETTA'],
  m3: ['TRIPLÉ', 'TRIPLE KILL', 'TRIPLE', 'DREIFACH', 'TRIPLO', 'TRIPLETTA'],
  m4: ['RAFLE ×{n}', 'SWEEP ×{n}', 'BARRIDO ×{n}', 'AUFRÄUMER ×{n}', 'VARRIDO ×{n}', 'RETATA ×{n}'],
  head: ['TIR À LA TÊTE', 'HEADSHOT', 'DISPARO A LA CABEZA', 'KOPFSCHUSS', 'TIRO NA CABEÇA', 'COLPO ALLA TESTA'],
  heads: ['TIRS À LA TÊTE', 'HEADSHOTS', 'DISPAROS A LA CABEZA', 'KOPFSCHÜSSE', 'TIROS NA CABEÇA', 'COLPI ALLA TESTA'],
  long: ['LONGUE PORTÉE · {d} M', 'LONG SHOT · {d} M', 'LARGA DISTANCIA · {d} M', 'WEITSCHUSS · {d} M', 'LONGO ALCANCE · {d} M', 'LUNGA GITTATA · {d} M'],
  noscope: ['SANS LUNETTE', 'NO-SCOPE', 'SIN MIRA', 'OHNE ZIELFERNROHR', 'SEM MIRA', 'SENZA MIRINO'],
  melee: ['CORPS À CORPS', 'CLOSE QUARTERS', 'CUERPO A CUERPO', 'NAHKAMPF', 'CORPO A CORPO', 'CORPO A CORPO'],
  boom: ['EXPLOSIF', 'EXPLOSIVE', 'EXPLOSIVO', 'EXPLOSIV', 'EXPLOSIVO', 'ESPLOSIVO'],
  clutch: ['DERNIER DEBOUT', 'LAST ONE STANDING', 'EL ÚLTIMO EN PIE', 'LETZTER MANN', 'O ÚLTIMO DE PÉ', 'ULTIMO IN PIEDI'],
  low: ['SUR LE FIL', 'ON THE EDGE', 'AL LÍMITE', 'AUF MESSERS SCHNEIDE', 'NO LIMITE', 'SUL FILO'],
  cap: ['CAPTURE SOUS LE FEU', 'CAPTURE UNDER FIRE', 'CAPTURA BAJO FUEGO', 'EROBERUNG UNTER BESCHUSS', 'CAPTURA SOB FOGO', 'CONQUISTA SOTTO TIRO'],
  plant: ['BOMBE POSÉE', 'BOMB PLANTED', 'BOMBA COLOCADA', 'BOMBE GELEGT', 'BOMBA PLANTADA', 'BOMBA PIAZZATA'],
  defuse: ['BOMBE DÉSAMORCÉE', 'BOMB DEFUSED', 'BOMBA DESACTIVADA', 'BOMBE ENTSCHÄRFT', 'BOMBA DESARMADA', 'BOMBA DISINNESCATA'],
  breach: ['BRÈCHE', 'BREACH', 'BRECHA', 'BRESCHE', 'BRECHA', 'BRECCIA'],
  streak: ['SÉRIE DE {n}', '{n} IN A ROW', 'RACHA DE {n}', '{n} IN FOLGE', 'SEQUÊNCIA DE {n}', 'SERIE DI {n}'],
  kill: ['ÉLIMINATION', 'ELIMINATION', 'ELIMINACIÓN', 'AUSSCHALTUNG', 'ELIMINAÇÃO', 'ELIMINAZIONE'],
  you: ['VOUS', 'YOU', 'TÚ', 'DU', 'TU', 'TU'],
  // settings (settings.js reads them through its own local table)
};
const li = i18n => Math.max(0, LANGS.indexOf((i18n && i18n.lang) || 'fr'));
/** Local text, 6 languages; {x} placeholders. */
export function tr(i18n, k, p) {
  let s = (TX[k] && (TX[k][li(i18n)] || TX[k][0])) || k;
  if (p) s = s.replace(/\{(\w+)\}/g, (m, x) => (x in p ? String(p[x]) : m));
  return s;
}

/* ---------- ring sizes: 20 Hz, 16.5 s, 48 actors; 4096 events; snapshots up to 10.8 s ---------- */
export const HZ = 20;
const STEP = 1 / HZ, NF = 330, NS = 48, FW = 8, EV_MAX = 4096, EW = 12, SNF = 216, SEV = 1400, KEEP = 3;
const GAP = 4.5, SPAN_MAX = 7.5, LEAD = 2.6, TAIL = 1.8, WIN_MIN = 6, WIN_MAX = 10;
export const FWIDTH = FW, EWIDTH = EW;
/** event types; per-frame actor flags; kill flags; shot flags */
export const EV = { SHOT: 1, KILL: 2, BOOM: 3, OBJ: 4, HIT: 5 };
export const FL = { ALIVE: 1, GROUND: 2, RELOAD: 4, GHOST: 8, SEEN: 16, CROUCH: 32 };
export const KF = { HEAD: 1, BLAST: 2, MINE: 4, CLUTCH: 8, NOSCOPE: 16, MELEE: 32, LAST: 64 };
export const SF = { PROJ: 1, MELEE: 2, THROW: 4, FLAME: 8, QUIET: 16 };
const OBJ_KIND = { cap: 1, plant: 2, defuse: 3 };
export const OBJ_KEYS = ['', 'cap', 'plant', 'defuse'];
const CAPTURE_TXT = new Set(['Capture', 'Captura', 'Eroberung', 'Conquista']);       // modes.js 'l.capture', every language

const GXB = (() => { try { const d = globalThis.FZGearData ? globalThis.FZGearData.blastDefs() : {}; for (const k of Object.keys(d)) d[k].id = k; return d; } catch { return {}; } })();
const defCache = new Map();
/** Weapon or explosive item definition by id (null when unknown). */
export function weaponDef(id) {
  if (!id) return null;
  let d = defCache.get(id);
  if (d === undefined) { d = byId(ALL_WEAPONS, id) || GXB[id] || null; defCache.set(id, d); }
  return d;
}
const isBlast = d => !!(d && d.proj && d.proj.radius > 0);
const clampB = v => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

export function createRecorder(E, { settings, profile } = {}) {
  /* ring of frames: time, per actor slot (x, y, z, yaw, pitch, vx, vz, crouch), flags, weapon index, health; the player's aim and eye */
  const fT = new Float64Array(NF), fD = new Float32Array(NF * NS * FW), fF = new Uint8Array(NF * NS), fW = new Uint8Array(NF * NS), fH = new Uint8Array(NF * NS);
  const pA = new Uint8Array(NF), pE = new Float32Array(NF);
  const eD = new Float32Array(EV_MAX * EW), eT = new Float64Array(EV_MAX);
  let head = 0, count = 0, eHead = 0, eN = 0, on = false;       // integers only here: per-frame doubles live in object fields (a closure double is re-boxed on every write)
  const sAct = new Array(NS).fill(null), sLast = new Float64Array(NS).fill(-1e9), slotOf = new Map();
  const meta = []; for (let i = 0; i < NS; i++) meta.push({ id: '', name: '', team: null, kind: 'soldier', zType: null, pal: null, fit: null, isPlayer: false, isRemote: false });
  const wTab = [''], wMap = new Map([['', 0]]);
  const widx = id => { let i = wMap.get(id || ''); if (i === undefined) { if (wTab.length >= 255) return 0; i = wTab.length; wTab.push(id); wMap.set(id, i); } return i; };
  const st = { map: '', mode: '', online: false, t0: 0, streak: 0, hurtT: -99, breachT: -99, playerSlot: -1, name: '', team: null, fit: null, ended: true, acc: 0.5, metaT: 0.5 };
  st.acc = 0; st.metaT = 0;       // created as doubles: the fields stay unboxed

  /* ---------- candidate windows: kills of the player that follow each other closely ---------- */
  const KMAX = 24, cl = { open: false, tFirst: 0, tLast: 0, n: 0, obj: 0, objT: 0, breach: false, kills: [] };
  for (let i = 0; i < KMAX; i++) cl.kills.push({ t: 0, wid: '', head: false, dist: 0, hp: 1, clutch: false, last: false, noscope: false, melee: false, blast: false, streak: 0 });
  /* the three best moments of the match, each in its own fixed buffer */
  let pool = null;
  const moments = [], history = [];
  function makePool() {
    pool = [];
    for (let i = 0; i < KEEP + 1; i++) pool.push({ used: false, t: new Float64Array(SNF), d: new Float32Array(SNF * NS * FW), f: new Uint8Array(SNF * NS), w: new Uint8Array(SNF * NS), h: new Uint8Array(SNF * NS), ads: new Uint8Array(SNF), eye: new Float32Array(SNF), ev: new Float32Array(SEV * EW), evT: new Float64Array(SEV), nF: 0, nS: 0, nE: 0 });
  }

  let P = null;
  const playerOf = () => E.player;

  function assign(a, t) {
    let s = -1;
    for (let i = 0; i < NS; i++) { if (sAct[i] === null) { s = i; break; } }
    if (s < 0) { let old = t - (NF / HZ + 0.5); for (let i = 0; i < NS; i++) if (sLast[i] < old) { old = sLast[i]; s = i; } if (s >= 0) slotOf.delete(sAct[s]); }
    if (s < 0) return -1;
    sAct[s] = a; slotOf.set(a, s); sLast[s] = t; fillMeta(s, a);
    return s;
  }
  function fillMeta(s, a) {
    const m = meta[s]; m.id = a.id; m.name = a.name || ''; m.team = a.team ?? null; m.kind = a.kind || 'soldier'; m.zType = a.zType || null;
    m.pal = a.pal || null; m.fit = a.fit || null; m.isPlayer = !!a.isPlayer; m.isRemote = !!a.isRemote;
  }
  const slotFor = (a, t) => { if (!a) return -1; const s = slotOf.get(a); return s === undefined ? assign(a, t) : s; };

  function sample(t) {
    const f = head, base = f * NS, A = E.actors; fT[f] = t;
    fF.fill(0, base, base + NS);
    for (let k = 0; k < A.length; k++) {
      const a = A[k]; let s = slotOf.get(a);
      if (s === undefined) { s = assign(a, t); if (s < 0) continue; }
      const i = base + s, d = i * FW, p = a.pos;
      fD[d] = p.x; fD[d + 1] = p.y; fD[d + 2] = p.z; fD[d + 3] = a.yaw; fD[d + 4] = a.pitch || 0; fD[d + 5] = a.vx || 0; fD[d + 6] = a.vz || 0; fD[d + 7] = a.crouch || 0;
      let fl = FL.SEEN; if (a.alive) fl |= FL.ALIVE; if (!a.body || a.body.grounded) fl |= FL.GROUND; if (a.ghost) fl |= FL.GHOST; if (a.crouch > 0.5) fl |= FL.CROUCH;
      if (a.isPlayer) { if (P && P.reload > 0) fl |= FL.RELOAD; } else if (a.ai && a.ai.reloadT > 0) fl |= FL.RELOAD;
      fF[i] = fl; fW[i] = widx(a.weaponId); fH[i] = clampB(a.maxHp > 0 ? a.hp / a.maxHp * 255 : 0); sLast[s] = t;
    }
    pA[f] = P ? clampB(P.ads * 255) : 0; pE[f] = P ? P.eye : 1.62;
    head = (head + 1) % NF; if (count < NF) count++;
    if (t - st.metaT > 1) { st.metaT = t; for (let s = 0; s < NS; s++) { const a = sAct[s]; if (a && sLast[s] === t) { const m = meta[s]; m.team = a.team ?? null; m.name = a.name || m.name; if (a.pal) m.pal = a.pal; m.fit = a.fit || null; } } }
  }
  /** One event into the ring: t, type, two actor slots, weapon index, flags, six numbers. */
  function ev(t, type, sa, sb, wi, fl, x0, y0, z0, x1, y1, z1) {
    const o = eHead * EW; eT[eHead] = t;
    eD[o] = t; eD[o + 1] = type; eD[o + 2] = sa; eD[o + 3] = sb; eD[o + 4] = wi; eD[o + 5] = fl; eD[o + 6] = x0; eD[o + 7] = y0; eD[o + 8] = z0; eD[o + 9] = x1; eD[o + 10] = y1; eD[o + 11] = z1;
    eHead = (eHead + 1) % EV_MAX; if (eN < EV_MAX) eN++;
  }

  /* ---------- engine events (each listener returns at once when the recorder is off) ---------- */
  function onShot(e) {
    if (!on || !e || !e.actor) return;
    const a = e.actor, t = E.time, s = slotFor(a, t); if (s < 0) return;
    const D = weaponDef(e.weaponId); let fl = 0;
    if (D) { if (D.kind === 'melee') fl |= SF.MELEE; else if (D.kind === 'thrown') fl |= SF.THROW | SF.PROJ; else if (D.kind === 'projectile' || D.proj) fl |= SF.PROJ; if (D.flame) fl |= SF.FLAME; if (D.silent) fl |= SF.QUIET; }
    const pl = a === playerOf(), cp = Math.cos(a.pitch || 0), yaw = a.yaw;
    const eye = pl ? (P ? P.eye : 1.62) : a.crouch > 0.5 ? 1.05 : 1.5;
    ev(t, EV.SHOT, s, -1, widx(e.weaponId), fl, a.pos.x, a.pos.y + eye, a.pos.z, -Math.sin(yaw) * cp, Math.sin(a.pitch || 0), -Math.cos(yaw) * cp);
  }
  function onKill(e) {
    if (!on || !e || !e.victim) return;
    const t = E.time, pl = playerOf(), v = e.victim, k = e.killer || null, sv = slotFor(v, t), sk = k ? slotFor(k, t) : -1;
    if (sv < 0) return;
    const D = weaponDef(e.weaponId); let fl = 0;
    if (e.head) fl |= KF.HEAD; if (isBlast(D)) fl |= KF.BLAST; if (D && D.kind === 'melee') fl |= KF.MELEE;
    const dist = k ? Math.hypot(v.pos.x - k.pos.x, v.pos.y - k.pos.y, v.pos.z - k.pos.z) : 0;
    const hp = pl.maxHp > 0 ? Math.max(0, pl.hp) / pl.maxHp : 1, ads = P ? P.ads : 0;
    if (v === pl) { st.streak = 0; }
    if (k === pl && v !== pl) {
      fl |= KF.MINE; st.streak++;
      if (D && D.scope && ads < 0.35 && dist > 6) fl |= KF.NOSCOPE;
      const c = clutchAt(v); if (c === 1) fl |= KF.CLUTCH; else if (c === 2) fl |= KF.CLUTCH | KF.LAST;
      playerKill(t, e.weaponId || '', !!e.head, dist, hp, fl);
    }
    ev(t, EV.KILL, sk, sv, widx(e.weaponId), fl, v.pos.x, v.pos.y, v.pos.z, dist, hp, ads);
  }
  /** 1 = the player alone against two or more (Bombe), 2 = nobody left standing but the player (Zone, Bombe). */
  function clutchAt(victim) {
    const mode = st.mode, pl = playerOf(); if (mode !== 'bomb' && mode !== 'zone') return 0;
    let allies = 0, foes = 0;
    for (const a of E.actors) {
      if (a === pl || !a.alive || a.ghost || a.kind === 'zombie') continue;
      if (pl.team !== null && pl.team !== undefined && a.team === pl.team) allies++; else foes++;
    }
    if (allies > 0) return 0;
    if (foes === 0) return 2;
    return foes + 1 >= 2 ? 1 : 0;
  }
  function onBoom(e) {
    if (!on || !e) return;
    const t = E.time, pl = playerOf(), s = e.by ? slotFor(e.by, t) : -1; let fl = 0;
    if (e.weaponId === 'breach' && e.by === pl) { fl |= 1; st.breachT = t; }
    ev(t, EV.BOOM, s, -1, widx(e.weaponId || ''), fl, e.x, e.y, e.z, e.radius || 5, 0, 0);
  }
  function onDamage(e) {
    if (!on || !e) return;
    const pl = playerOf(), a = e.attacker, v = e.victim; if (v !== pl && a !== pl) return;
    const t = E.time; if (v === pl && a !== pl) st.hurtT = t;
    if (!v) return;
    ev(t, EV.HIT, a ? slotFor(a, t) : -1, slotFor(v, t), 0, e.head ? 1 : 0, e.amount || 0, 0, 0, 0, 0, 0);
  }
  /** Objective actions arrive as credit rewards (modes.js): capture, bomb planted, bomb defused. */
  function onReward(reason) {
    if (!on || typeof reason !== 'string') return;
    let kind = 0;
    if (CAPTURE_TXT.has(reason)) kind = OBJ_KIND.cap;
    else { try { const i = E.i18n; if (i && reason === i.t('bomb.planted')) kind = OBJ_KIND.plant; else if (i && reason === i.t('bomb.defused')) kind = OBJ_KIND.defuse; } catch { /* optional */ } }
    if (!kind) return;
    const t = E.time, pl = playerOf(), s = slotFor(pl, t), under = t - st.hurtT < 5 || cl.open;
    ev(t, EV.OBJ, s, -1, 0, kind | (under ? 8 : 0), pl.pos.x, pl.pos.y, pl.pos.z, 0, 0, 0);
    if (!under && kind === OBJ_KIND.cap) return;       // a quiet capture is not a moment; a plant or a defuse always is a candidate
    if (!cl.open) openCluster(t);
    cl.obj = kind; cl.objT = t; cl.tLast = Math.max(cl.tLast, t);
  }

  function openCluster(t) { cl.open = true; cl.tFirst = t; cl.tLast = t; cl.n = 0; cl.obj = 0; cl.objT = 0; cl.breach = false; }
  function playerKill(t, wid, head, dist, hp, fl) {
    if (cl.open && (t - cl.tLast > GAP || t - cl.tFirst > SPAN_MAX || cl.n >= KMAX)) closeCluster(t);
    if (!cl.open) openCluster(t);
    const k = cl.kills[cl.n++]; k.t = t; k.wid = wid; k.head = head; k.dist = dist; k.hp = hp; k.clutch = !!(fl & KF.CLUTCH); k.last = !!(fl & KF.LAST);
    k.noscope = !!(fl & KF.NOSCOPE); k.melee = !!(fl & KF.MELEE); k.blast = !!(fl & KF.BLAST); k.streak = st.streak;
    cl.tLast = t; if (t - st.breachT < 6) cl.breach = true;
  }

  /* ---------- scoring ---------- */
  const MULTI = [0, 100, 350, 650, 1000, 1400];
  function scoreCluster(out) {
    const n = cl.n; let s = n < MULTI.length ? MULTI[n] : 1400 + (n - 5) * 400, heads = 0, longD = 0, sniperLong = false, noscope = 0, melee = 0, blastN = 0, low = false, clutch = false, last = false, maxStreak = 0;
    for (let i = 0; i < n; i++) {
      const k = cl.kills[i], D = weaponDef(k.wid);
      if (k.head) { heads++; s += 60; }
      if (k.dist > 30) { s += Math.min(150, (k.dist - 30) * 3); if (k.dist > longD) longD = k.dist; }
      if (D && D.cat === 'sniper' && k.dist >= 45) { s += 80; sniperLong = true; }
      if (k.noscope) { s += 150; noscope++; }
      if (k.melee) { s += 90; melee++; }
      if (k.blast) blastN++;
      if (k.hp <= 0.3) { s += k.hp <= 0.15 ? 180 : 120; low = true; }
      if (k.clutch) { clutch = true; } if (k.last) last = true;
      if (k.streak > maxStreak) maxStreak = k.streak;
    }
    if (clutch) s += last ? 320 : 250;
    if (blastN >= 2) s += 200;
    if (cl.obj) s += cl.obj === OBJ_KIND.cap ? 220 : 260;
    if (cl.breach && n) s += 140;
    if (maxStreak >= 10) s += 120; else if (maxStreak >= 5) s += 60;
    if (n >= 2) s += Math.max(0, GAP - (cl.tLast - cl.tFirst)) * 30;
    // tags, in the order they read best
    const tags = out.tags; tags.length = 0;
    if (n >= 4) tags.push({ k: 'm4', p: { n } }); else if (n === 3) tags.push({ k: 'm3' }); else if (n === 2) tags.push({ k: 'm2' });
    if (clutch) tags.push({ k: 'clutch' });
    if (cl.obj) tags.push({ k: OBJ_KEYS[cl.obj] });
    if (cl.breach && n) tags.push({ k: 'breach' });
    if (noscope) tags.push({ k: 'noscope' });
    if (n && heads === n) tags.push({ k: n > 1 ? 'heads' : 'head' });
    if (sniperLong || longD >= 40) tags.push({ k: 'long', p: { d: Math.round(longD) } });
    if (blastN >= 2 || (blastN && n === 1)) tags.push({ k: 'boom' });
    if (low) tags.push({ k: 'low' });
    if (melee) tags.push({ k: 'melee' });
    if (maxStreak >= 5) tags.push({ k: 'streak', p: { n: maxStreak } });
    if (!tags.length) tags.push({ k: 'kill' });
    out.score = Math.round(s); out.n = n; out.heads = heads; out.longD = Math.round(longD);
    return out.score;
  }

  /* ---------- snapshot: copy the window out of the rings into a pool buffer ---------- */
  const scratch = { tags: [], score: 0, n: 0, heads: 0, longD: 0 };
  function closeCluster(now) {
    if (!cl.open) return; cl.open = false;
    if (!cl.n && !cl.obj) return;
    const sc = scoreCluster(scratch);
    if (history.length < 24) history.push({ t: +cl.tFirst.toFixed(2), n: cl.n, score: sc, tags: scratch.tags.map(x => x.k) });       // every candidate of the match (tests, tuning)
    if (moments.length >= KEEP && sc <= moments[moments.length - 1].score) return;
    // window: lead-in before the first kill, tail after the last, 6 to 10 s, inside what the ring still holds
    const oldest = count ? fT[(head - count + NF) % NF] : now, newest = count ? fT[(head - 1 + NF) % NF] : now;
    const first = cl.n ? cl.kills[0].t : cl.objT, lastK = cl.n ? cl.kills[cl.n - 1].t : cl.objT, lastE = Math.max(lastK, cl.obj ? cl.objT : lastK);
    let a = first - LEAD, b = Math.min(newest, lastE + TAIL);
    if (b - a > WIN_MAX) a = Math.max(first - 1.2, b - WIN_MAX);
    if (b - a > WIN_MAX) a = b - WIN_MAX;       // a long chain: the end of it, where the last kills are
    if (b - a < WIN_MIN) a = b - WIN_MIN;
    a = Math.max(a, oldest); if (b - a < 1) return;
    let buf = null;
    for (const p of pool) if (!p.used) { buf = p; break; }
    if (!buf) { const lowM = moments.pop(); buf = lowM.buf; }
    if (!snapshot(buf, a, b)) { buf.used = false; return; }
    const kills = []; for (let i = 0; i < cl.n; i++) { const k = cl.kills[i]; kills.push({ t: k.t, wid: k.wid, head: k.head, dist: Math.round(k.dist), hp: k.hp, noscope: k.noscope, melee: k.melee, blast: k.blast }); }
    const m = { id: ++momentSeq, buf, score: sc, tags: scratch.tags.map(x => ({ k: x.k, p: x.p ? { ...x.p } : null })), n: scratch.n, heads: scratch.heads, longD: scratch.longD, kills,
      t0: a, t1: b, map: st.map, mode: st.mode, online: st.online, name: st.name, team: st.team, fit: st.fit, playerSlot: buf.playerSlot, obj: cl.obj, objT: cl.objT, weapons: wTab.slice(), slots: buf.slots,
      bk: (() => { try { const B = E.breach; return B && B.history ? B.history() : null; } catch { return null; } })() };       // breached walls of this match with their times (engine-breach.js)
    if (!m.slots || m.playerSlot < 0) { buf.used = false; return; }
    moments.push(m); moments.sort((x, y) => y.score - x.score);
    while (moments.length > KEEP) { const x = moments.pop(); x.buf.used = false; }
    try { E.replayMoments = moments; } catch { /* optional */ }
  }
  let momentSeq = 0;
  function snapshot(buf, a, b) {
    // frames in [a, b], oldest first
    const fr = []; for (let k = count; k >= 1; k--) { const f = (head - k + NF) % NF; const t = fT[f]; if (t >= a - 1e-6 && t <= b + 1e-6) fr.push(f); }
    if (fr.length < 4) return false;
    if (fr.length > SNF) fr.splice(0, fr.length - SNF);
    // slots seen in the window, compacted; the player first
    const map = [], pl = playerOf(), ps = slotOf.get(pl);
    if (ps === undefined) return false;
    map.push(ps);
    for (let s = 0; s < NS; s++) { if (s === ps) continue; for (const f of fr) { if (fF[f * NS + s] & FL.SEEN) { map.push(s); break; } } }
    const nS = map.length, nF = fr.length;
    for (let j = 0; j < nF; j++) {
      const f = fr[j]; buf.t[j] = fT[f]; buf.ads[j] = pA[f]; buf.eye[j] = pE[f];
      for (let q = 0; q < nS; q++) {
        const s = map[q], src = f * NS + s, dst = j * nS + q;
        buf.f[dst] = fF[src]; buf.w[dst] = fW[src]; buf.h[dst] = fH[src];
        const so = src * FW, dO = dst * FW; for (let c = 0; c < FW; c++) buf.d[dO + c] = fD[so + c];
      }
    }
    // events from 0.6 s before the window (a grenade already in the air) to its end, slots remapped (-1 when outside the window)
    const back = new Int16Array(NS).fill(-1); for (let q = 0; q < nS; q++) back[map[q]] = q;
    let nE = 0;
    for (let k = eN; k >= 1 && nE < SEV; k--) {
      const i = (eHead - k + EV_MAX) % EV_MAX, t = eT[i]; if (t < a - 0.6 || t > b + 1e-6) continue;
      const o = i * EW, d = nE * EW; buf.evT[nE] = t;
      for (let c = 0; c < EW; c++) buf.ev[d + c] = eD[o + c];
      const sa = eD[o + 2], sb = eD[o + 3];
      buf.ev[d + 2] = sa >= 0 ? back[sa] : -1; buf.ev[d + 3] = sb >= 0 ? back[sb] : -1;
      nE++;
    }
    buf.nF = nF; buf.nS = nS; buf.nE = nE; buf.used = true; buf.playerSlot = 0;
    buf.slots = map.map(s => { const m = meta[s], a = sAct[s]; return { id: m.id, name: m.name, team: m.team, kind: m.kind, zType: m.zType, pal: m.pal ? m.pal.slice() : null, fit: a === pl ? st.fit : m.fit, isPlayer: m.isPlayer, isRemote: m.isRemote, fin: finOf(a) }; });
    return true;
  }
  /** Weapon finishes worn by this actor (the player's from the profile, a remote player's from the room), id -> finish id. */
  function finOf(a) {
    const out = {};
    try {
      if (!a || a.kind !== 'soldier') return out;
      if (a === playerOf()) { const m = profile && profile.finishMap ? profile.finishMap() : null; if (m) for (const k of Object.keys(m)) if (typeof m[k] === 'string') out[k] = m[k]; }
      else if (a.isRemote && E.cfg && E.cfg.net && E.cfg.net.finOf) { for (const id of wTab) { if (!id) continue; const f = E.cfg.net.finOf(a.id, id); if (f) out[id] = f; } }
    } catch { /* cosmetic */ }
    return out;
  }

  /* ---------- match lifecycle ---------- */
  const enabled = () => { try { return settings ? settings.get('gameplay.replay') !== false : true; } catch { return true; } };
  function begin(cfg) {
    on = false; head = count = 0; eHead = eN = 0; st.acc = 0; st.metaT = 0;
    slotOf.clear(); sAct.fill(null); sLast.fill(-1e9); wTab.length = 1; wMap.clear(); wMap.set('', 0);
    for (const m of moments) m.buf.used = false; moments.length = 0; history.length = 0; try { E.replayMoments = moments; } catch { /* optional */ }
    cl.open = false; st.streak = 0; st.hurtT = -99; st.breachT = -99; st.ended = false;
    if (!enabled()) return;
    if (!pool) makePool();
    P = E.internals ? E.internals.P : null;
    const c = cfg || E.cfg || {}; st.map = c.map || (E.world && E.world.id) || ''; st.mode = c.mode || ''; st.online = !!c.online; st.t0 = E.time;
    st.name = E.player.name || ''; st.team = E.player.team ?? null;
    try { const o = profile && profile.specialOutfit ? profile.specialOutfit() : null; st.fit = o && o.id ? o.id : null; } catch { st.fit = null; }
    on = true;
  }
  /** End of the match (or quit): close the window still open with what the ring holds. Idempotent. */
  function finish() {
    if (st.ended) return; st.ended = true;
    if (on) { try { closeCluster(E.time); } catch (e) { console.warn('[replay] finish', e); } }
    on = false;
  }
  function tick(dt) {
    st.acc += dt; if (st.acc < STEP) return;
    st.acc -= STEP; if (st.acc > STEP) st.acc = 0;       // after a hitch: one sample, not a burst
    const t = E.time;
    if (cl.open && t - cl.tLast > GAP) closeCluster(t);
    st.name = E.player.name || st.name; st.team = E.player.team ?? null;
    sample(t);
  }

  E.on('matchStart', cfg => { try { begin(cfg); } catch (e) { on = false; console.warn('[replay] start', e); } });
  // tests set globalThis.__fzReplayProf = { ms: 0, n: 0 } before the page boots: the time inside every listener is then summed (never in a real game)
  const PROF = globalThis.__fzReplayProf && typeof globalThis.__fzReplayProf === 'object' ? globalThis.__fzReplayProf : null;
  const timed = fn => (PROF ? x => { const t0 = performance.now(); fn(x); PROF.ms += performance.now() - t0; PROF.n++; } : fn);
  E.on('tick', timed(dt => { if (!on) return; try { tick(dt); } catch (e) { on = false; console.warn('[replay] recorder stopped', e); } }));
  E.on('shot', timed(e => { if (on) { try { onShot(e); } catch { /* never the match */ } } }));
  E.on('kill', timed(e => { if (on) { try { onKill(e); } catch { /* never the match */ } } }));
  E.on('explosion', timed(e => { if (on) { try { onBoom(e); } catch { /* never the match */ } } }));
  E.on('damage', timed(e => { if (on) { try { onDamage(e); } catch { /* never the match */ } } }));
  E.on('matchEnd', () => finish());
  E.on('quit', () => finish());
  // objective actions: the modes credit them through E.reward(credits, reason)
  try { const r0 = E.reward; if (typeof r0 === 'function' && !r0.__fzr) { const w = function (credits, reason) { if (on) { try { onReward(reason); } catch { /* optional */ } } return r0.call(this, credits, reason); }; w.__fzr = true; E.reward = w; } } catch { /* optional */ }
  if (settings && settings.on) { try { settings.on('change', p => { if (p === 'gameplay.replay' && !enabled()) on = false; }); } catch { /* optional */ } }

  return {
    get on() { return on; }, get ended() { return st.ended; }, moments, finish, st,
    /** Test and tools: the ring itself (read only). */
    debug: () => ({ head, count, eN, slots: slotOf.size, weapons: wTab.length, cluster: { open: cl.open, n: cl.n }, history: history.slice(), moments: moments.map(m => ({ score: m.score, tags: m.tags.map(x => x.k), t0: m.t0, t1: m.t1, nF: m.buf.nF, nS: m.buf.nS, nE: m.buf.nE })) }),
  };
}

/** Moment title: the two best tags, e.g. "TRIPLÉ · TIR À LA TÊTE". */
export function momentTitle(i18n, m) {
  if (!m) return '';
  const t = m.tags.slice(0, 2).map(x => tr(i18n, x.k, x.p));
  if (t.length === 1 && !m.tags[0].p && m.kills && m.kills.length) { const D = weaponDef(m.kills[m.kills.length - 1].wid); if (D && D.name) t.push(String(D.name).toUpperCase()); }
  return t.join(' · ');
}

/* ---------- the end-of-match card (menu.js and match-flow.js ask for it through globalThis.FZReplay.endBlock) ---------- */
const CSS = `
.fzr-card{--amber:#f0ae2e;--hair:rgba(236,226,198,.17);--hair2:rgba(236,226,198,.36);position:relative;display:grid;grid-template-columns:minmax(150px,236px) minmax(0,1fr);gap:14px;align-items:center;width:100%;max-width:640px;margin:0 auto;padding:10px 12px 10px 10px;text-align:left;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;color:#d8c9a3;border:1px solid var(--hair);
 background:linear-gradient(#f0ae2e,#f0ae2e) 0 0/22px 2px no-repeat border-box,linear-gradient(to top left,transparent calc(50% - .75px),var(--hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 100% 100%/12px 12px no-repeat border-box,linear-gradient(180deg,rgba(28,32,26,.94),rgba(13,15,12,.92));
 clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.04);box-sizing:border-box}
.fzr-card[hidden]{display:none}
.fzr-card *{box-sizing:border-box}
.fzr-pv{position:relative;display:block;width:100%;aspect-ratio:16/9;overflow:hidden;padding:0;border:1px solid rgba(236,226,198,.22);background:#0b0d09 center/cover no-repeat;cursor:pointer}
.fzr-pv canvas{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .4s}
.fzr-pv.is-live canvas{opacity:1}
.fzr-pv::before,.fzr-pv::after{content:"";position:absolute;left:0;right:0;height:7%;background:#000;z-index:1;pointer-events:none}
.fzr-pv::before{top:0}.fzr-pv::after{bottom:0}
.fzr-pv i{position:absolute;left:50%;top:50%;z-index:2;width:42px;height:42px;margin:-21px 0 0 -21px;border-radius:50%;background:rgba(10,12,8,.62);border:1px solid rgba(240,174,46,.75);box-shadow:0 2px 12px rgba(0,0,0,.5);transition:transform .15s,background .15s}
.fzr-pv i::after{content:"";position:absolute;left:16px;top:12px;border-left:14px solid #f0ae2e;border-top:9px solid transparent;border-bottom:9px solid transparent}
.fzr-pv:hover i,.fzr-pv:focus-visible i{transform:scale(1.08);background:rgba(40,30,8,.8)}
.fzr-body{display:grid;gap:6px;min-width:0}
.fzr-eye{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--amber)}
.fzr-eye::before{content:"";width:11px;height:11px;flex:none;background:linear-gradient(135deg,#ffcf6a,#e39d22);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
.fzr-title{margin:0;font-size:clamp(22px,2vw,29px);font-weight:800;line-height:1.02;letter-spacing:.02em;text-transform:uppercase;color:#f4ecd8;overflow-wrap:anywhere}
.fzr-sub{font-size:15px;font-weight:600;letter-spacing:.06em;color:#a5a18a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fzr-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}
.fzr-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 16px;font:inherit;font-size:17px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#d8c9a3;background:rgba(10,12,8,.4);border:1px solid rgba(236,226,198,.32);cursor:pointer;clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%);transition:background .12s,color .12s,border-color .12s}
.fzr-btn:hover{background:rgba(201,185,143,.12);color:#fff}
.fzr-btn--main{color:#181407;background:linear-gradient(180deg,#ffc94f,#e8a628);border-color:#f0ae2e}
.fzr-btn--main:hover{color:#181407;background:linear-gradient(180deg,#ffd46e,#f0ae2e)}
.fzr-btn svg{width:16px;height:16px;flex:none}
.fzr-card :focus-visible{outline:2px solid #f4ecd8;outline-offset:2px}
.fzr-card.is-vote{max-width:760px;grid-template-columns:minmax(140px,200px) minmax(0,1fr);margin:0 0 4px}
@media (max-height:820px){.fzr-card.is-flow{display:none}}       /* online results on a short window: no room under the rewards; the vote screen, 8 s later, carries the card */
@media (max-width:620px){.fzr-card{grid-template-columns:minmax(0,1fr)}.fzr-card .fzr-pv{max-width:none}}
@media (max-height:700px){.fzr-card{grid-template-columns:minmax(120px,170px) minmax(0,1fr);padding:8px}.fzr-title{font-size:21px}.fzr-btn{min-height:34px;font-size:15px}}
/* solo end screen, wide window: in the free space right of the results column, so the results and their buttons do not move */
@media (min-width:1180px){
.fzm-end:has(>.fzr-card.is-menu:not([hidden])){position:relative}
.fzr-card.is-menu{position:absolute;right:clamp(16px,2.2vw,44px);top:0;bottom:0;height:fit-content;margin:auto 0;width:clamp(250px,calc((100% - 660px) / 2 - 36px),360px);max-width:none;grid-template-columns:minmax(0,1fr);gap:10px;padding:10px}
.fzr-card.is-menu .fzr-acts{display:grid;grid-template-columns:minmax(0,1fr)}
}
@media (prefers-reduced-motion:reduce){.fzr-pv canvas,.fzr-pv i,.fzr-btn{transition:none}}`;
const SHARE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6h14v-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function install({ engine: E, settings, i18n, profile, audio, menu, net, MAPS }) {
  if (!E || typeof E.on !== 'function') return null;
  const rec = createRecorder(E, { settings, profile });
  const L = (k, p) => tr(i18n, k, p);
  const mapName = id => { try { const k = 'map.' + id, s = i18n.t(k); if (s && s !== k) return s; } catch { /* fallback below */ } const m = (MAPS || []).find(x => x.id === id); return m ? m.name : id; };
  let viewMod = null, viewP = null, view = null;
  const loadView = () => viewP || (viewP = import('./replay-view.js').then(m => { viewMod = m; view = m.createView({ engine: E, settings, i18n, profile, audio, menu, net, rec, L, mapName }); return view; }).catch(e => { console.warn('[replay] viewer unavailable', e); viewP = null; return null; }));
  if (!document.getElementById('fzr-card-style')) { const s = document.createElement('style'); s.id = 'fzr-card-style'; s.textContent = CSS; document.head.append(s); }

  const cards = new Map();       // where -> { el, title, sub, pv, canvas, others }
  const best = () => (rec.moments.length ? rec.moments[0] : null);
  const replayable = m => !!m && !E.running && !E.loading && !!E.world && E.world.id === m.map;
  function card(where) {
    let c = cards.get(where);
    if (!c) {
      const el = document.createElement('section'); el.className = 'fzr-card is-' + where; el.setAttribute('data-fid', 'replay:card:' + where); el.setAttribute('aria-label', L('card'));
      const pv = document.createElement('button'); pv.type = 'button'; pv.className = 'fzr-pv'; pv.setAttribute('data-fid', 'replay:preview:' + where);
      const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 216; pv.append(canvas, document.createElement('i'));
      const body = document.createElement('div'); body.className = 'fzr-body';
      const eye = document.createElement('div'); eye.className = 'fzr-eye'; const title = document.createElement('h3'); title.className = 'fzr-title'; const sub = document.createElement('div'); sub.className = 'fzr-sub';
      const acts = document.createElement('div'); acts.className = 'fzr-acts';
      const watch = document.createElement('button'); watch.type = 'button'; watch.className = 'fzr-btn fzr-btn--main'; watch.setAttribute('data-fid', 'replay:watch:' + where);
      const share = document.createElement('button'); share.type = 'button'; share.className = 'fzr-btn'; share.setAttribute('data-fid', 'replay:share:' + where); share.innerHTML = SHARE_SVG; const sl = document.createElement('span'); share.append(sl);
      acts.append(watch, share); body.append(eye, title, sub, acts); el.append(pv, body);
      const open = exp => { try { if (audio && audio.ui) audio.ui(); } catch { /* optional */ } const m = best(); if (!replayable(m)) return; loadView().then(v => { if (v) v.open(m, { moments: rec.moments, exportNow: exp ? prefFormat() : null }); }); };
      pv.addEventListener('click', () => open(false)); watch.addEventListener('click', () => open(false)); share.addEventListener('click', () => open(true));
      c = { el, title, sub, eye, pv, canvas, watch, sl, momentId: 0 };
      cards.set(where, c);
    }
    paint(c);
    return c.el;
  }
  const prefFormat = () => { try { return settings.get('gameplay.replayFormat') === 'landscape' ? 'landscape' : 'portrait'; } catch { return 'portrait'; } };
  function paint(c) {
    const m = best();
    if (!m || !rec.ended) { c.el.hidden = true; return; }
    c.el.hidden = false;
    c.eye.textContent = L('card'); c.watch.textContent = L('watch'); c.sl.textContent = L('share');
    const title = momentTitle(i18n, m); c.title.textContent = title;
    const n = rec.moments.length - 1, w = m.kills.length ? weaponDef(m.kills[m.kills.length - 1].wid) : null, wn = w && w.name && !title.includes(String(w.name).toUpperCase()) ? w.name : null;
    c.sub.textContent = [mapName(m.map), wn, n > 0 ? (n === 1 ? L('other1') : L('others', { n })) : null].filter(Boolean).join(' · ');
    if (c.momentId !== m.id) { c.momentId = m.id; c.pv.classList.remove('is-live'); try { c.pv.style.backgroundImage = `url("${new URL(`map-shots/${encodeURIComponent(m.map)}.webp`, import.meta.url).href}")`; } catch { /* poster is optional */ } }
    c.pv.setAttribute('aria-label', `${L('watch')} : ${c.title.textContent}`);
  }

  /* the preview: while a card is on screen after the match, the replay plays (cinematic camera) and is copied into the card */
  let pvTimer = 0;
  const visibleCanvases = () => { const out = []; for (const c of cards.values()) { if (c.el.hidden || !c.el.isConnected || document.hidden) continue; if (!c.el.getClientRects().length) continue; out.push(c); } return out; };
  function previewTick() {
    const m = best();
    if (!m || !rec.ended || !replayable(m)) { if (view) view.stopPreview(); if (!m || E.running || E.loading) { clearInterval(pvTimer); pvTimer = 0; } return; }
    const vis = visibleCanvases();
    if (!vis.length) { if (view && !view.viewing) view.stopPreview(); return; }
    loadView().then(v => { if (v && !v.viewing) v.preview(m, vis.map(c => ({ canvas: c.canvas, onLive: () => c.pv.classList.add('is-live') }))); });
  }
  function watchCards() { if (!pvTimer) pvTimer = setInterval(previewTick, 300); setTimeout(previewTick, 0); }

  const api = {
    /** The card for an end screen: 'menu' (solo and the menu's own end screen), 'flow' (online results), 'vote' (online map vote). */
    endBlock(where = 'menu') {
      try {
        if (!rec.ended && !E.running) rec.finish();       // the end screens render inside the engine's own matchEnd: settle the moments first
        const m = best(); if (!m || !rec.ended) return null;
        const el = card(where); watchCards(); return el;
      } catch (e) { console.warn('[replay] card', e); return null; }
    },
    rec, get moments() { return rec.moments; }, best, view: () => view, loadView, title: m => momentTitle(i18n, m), mapName, L,
  };
  E.on('matchEnd', () => { for (const c of cards.values()) paint(c); if (best()) { loadView(); watchCards(); } });
  E.on('quit', () => { for (const c of cards.values()) paint(c); });
  let loadingNow = false;       // 'loading' comes with every progress step: act once per load
  E.on('loading', e => { const a = !!(e && e.active); if (a === loadingNow) return; loadingNow = a; if (a) { if (view) view.release(); for (const c of cards.values()) c.el.hidden = true; clearInterval(pvTimer); pvTimer = 0; } });
  if (i18n && i18n.on) { try { i18n.on('change', () => { for (const c of cards.values()) paint(c); }); } catch { /* optional */ } }
  globalThis.FZReplay = api;
  return api;
}
