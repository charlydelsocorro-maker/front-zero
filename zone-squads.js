// FRONT ZÉRO — Zone in squads (Duo, Trio, Quatuor), client side. Hooked by engine-zone.js (offline referee and online mirror) and
// installed by main.js (tells the server this client knows squads). Rules shared with the server: squad-rules.js.
// A downed soldier stays alive (enemies can finish it) on its knees, crawls, cannot shoot or use gear, and bleeds out unless a squadmate
// holds the interact key next to it. A squad is out when nobody in it stands; the last squad standing wins.
// Online the server decides every down, revive, death and the winner (squad-referee.js); this module shows them and drives the bots
// of the simulating client. Nothing here is allocated per frame except while a path is searched (a downed bot, at most once a second).
import './squad-rules.js';

const SR = globalThis.FZSquadRules;
const AMBER = '#e8a628', DOWN_COL = '#ff5a3c', PING_COL = '#ffd23f';
const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const TXT = {
  squads: ['ÉQUIPES', 'SQUADS', 'EQUIPOS', 'TEAMS', 'EQUIPAS', 'SQUADRE'],
  squad: ['ÉQUIPE {n}', 'SQUAD {n}', 'EQUIPO {n}', 'TEAM {n}', 'EQUIPA {n}', 'SQUADRA {n}'],
  down: ['À TERRE', 'DOWN', 'DERRIBADO', 'AM BODEN', 'CAÍDO', 'A TERRA'],
  dead: ['MORT', 'DEAD', 'MUERTO', 'TOT', 'MORTO', 'MORTO'],
  youDown: ['À TERRE · un coéquipier peut te relever · {s} s', 'DOWN · a squadmate can revive you · {s} s', 'DERRIBADO · un compañero puede levantarte · {s} s', 'AM BODEN · ein Kamerad kann dich aufheben · {s} s', 'CAÍDO · um colega pode levantar-te · {s} s', 'A TERRA · un compagno può rialzarti · {s} s'],
  revive: ['[{key}] Maintenir : relever {name}', '[{key}] Hold: revive {name}', '[{key}] Mantén: levantar a {name}', '[{key}] Halten: {name} aufheben', '[{key}] Manter: levantar {name}', '[{key}] Tieni premuto: rialza {name}'],
  reviving: ['Tu relèves {name}', 'Reviving {name}', 'Levantando a {name}', '{name} wird aufgehoben', 'A levantar {name}', 'Rialzi {name}'],
  revived: ['{name} te relève', '{name} is reviving you', '{name} te levanta', '{name} hebt dich auf', '{name} está a levantar-te', '{name} ti sta rialzando'],
  mateDown: ['{name} est à terre', '{name} is down', '{name} está derribado', '{name} ist am Boden', '{name} está caído', '{name} è a terra'],
  mateUp: ['{name} est relevé', '{name} is back up', '{name} se ha levantado', '{name} ist wieder auf den Beinen', '{name} levantou-se', '{name} è di nuovo in piedi'],
  youUp: ['Relevé !', 'Revived!', '¡Levantado!', 'Aufgehoben!', 'Levantado!', 'Rialzato!'],
  squadOut: ['Équipe {n} éliminée', 'Squad {n} eliminated', 'Equipo {n} eliminado', 'Team {n} ausgeschieden', 'Equipa {n} eliminada', 'Squadra {n} eliminata'],
  mineOut: ['Ton équipe est éliminée', 'Your squad is out', 'Tu equipo ha sido eliminado', 'Dein Team ist ausgeschieden', 'A tua equipa foi eliminada', 'La tua squadra è eliminata'],
  ping: ['{name} : par ici', '{name}: over here', '{name}: por aquí', '{name}: hier', '{name}: por aqui', '{name}: di qua'],
  obj: ['Dernière équipe debout gagne', 'Last squad standing wins', 'Gana el último equipo en pie', 'Das letzte Team gewinnt', 'Vence a última equipa de pé', 'Vince l’ultima squadra in piedi'],
  won: ['DERNIÈRE ÉQUIPE DEBOUT', 'LAST SQUAD STANDING', 'EL ÚLTIMO EQUIPO EN PIE', 'DAS LETZTE TEAM', 'A ÚLTIMA EQUIPA DE PÉ', 'L’ULTIMA SQUADRA IN PIEDI'],
  out: ['ÉQUIPE ÉLIMINÉE · #{n}', 'SQUAD ELIMINATED · #{n}', 'EQUIPO ELIMINADO · #{n}', 'TEAM AUSGESCHIEDEN · #{n}', 'EQUIPA ELIMINADA · #{n}', 'SQUADRA ELIMINATA · #{n}'],
};
function makeL(E) {
  return (key, p) => {
    const row = TXT[key], i = Math.max(0, LANGS.indexOf(E.i18n && E.i18n.lang)); let s = row ? row[i] || row[0] : key;
    if (p) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));
    return s;
  };
}
const keyLabel = (E, action, def) => { try { const s = E.settings, code = s.get('keys.' + action); return code ? (s.keyLabel ? s.keyLabel(code) : code) : def; } catch { return def; } };

/** main.js: this client knows squads (the server lets it into Zone Duo / Trio / Quatuor rooms). */
export function install({ net } = {}) { if (net) net.joinCaps = Object.assign({}, net.joinCaps, { sqv: 1 }); return { SR }; }
export const total = (base, size) => SR.matchSize(base, size);
export const valid = n => SR.validSize(n);

/**
 * One squad match. o = { size, online, B (onlineBase), bots (online: Map id -> actor), sim() (online: this client simulates the bots) }.
 * engine-zone.js calls: spawnOffline, lethal (E.lethal), onKill, update, over, result, scoreLeft, sync / onZone (online), dispose;
 * core.hooks: bot, hold, busy, prompt.
 */
export function createSquads(c, H, core, o) {
  const E = c.E, I = E.internals, P = E.player, nav = I.nav, mover = I.mover, grid = I.grid, camera = I.camera, L = makeL(E);
  const size = o.size, online = !!o.online, B = o.B || null;
  const S = { list: [], mine: null, over: false, busy: false, hudT: 0, revive: null, revNo: -1, pingDown: false, sent: 0, ping: null };
  const ofId = new Map();       // soldier id -> squad
  const idOf = a => (a === P ? (online ? B.me : 'player') : a ? a.id : null);
  const actorOf = id => { if (id == null) return null; if (online) { if (id === B.me) return P; return (o.bots && o.bots.get(id)) || B.remotes.get(id) || null; } if (id === 'player') return P; for (let i = 0; i < E.actors.length; i++) if (E.actors[i].id === id) return E.actors[i]; return null; };
  const squadOf = a => (a ? ofId.get(idOf(a)) || null : null);
  const isDown = a => !!(a && a.alive && a.data && a.data.down);
  const standing = a => !!(a && a.alive && !(a.data && a.data.down));
  const nameOf = a => (a === P ? (P.name || 'TOI') : a && a.name ? String(a.name).replace(/^\[BOT\]\s*/, '') : '?');
  const v3 = { x: 0, y: 0, z: 0 };

  function newSquad(i) { const s = { i, team: SR.engineTeam(i), wire: SR.wireTeam(i), name: SR.SQUAD_NAMES[i % SR.SQUAD_NAMES.length], ids: [], out: false, place: 0 }; S.list.push(s); return s; }
  function join(s, id) { if (s.ids.indexOf(id) < 0) s.ids.push(id); ofId.set(id, s); }
  function membersOf(s, out) { out.length = 0; for (let i = 0; i < s.ids.length; i++) { const a = actorOf(s.ids[i]); if (a) out.push(a); } return out; }
  const tmpM = [], tmpN = [], tmpK = [], tmpW = [];
  function standingIn(s, except) { membersOf(s, tmpM); let n = 0; for (let i = 0; i < tmpM.length; i++) if (tmpM[i] !== except && standing(tmpM[i])) n++; return n; }
  function liveSquads() { let n = 0; for (const s of S.list) if (!s.out) n++; return n; }

  /* ---------- offline: who plays where ---------- */
  function spawnOffline(spawns, totalN, rnd, bots, difficulty) {
    const n = Math.ceil(totalN / size), sp = spawns.slice(0, Math.max(1, n));
    for (let i = sp.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = sp[i]; sp[i] = sp[j]; sp[j] = t; }
    for (let i = 0; i < n; i++) newSquad(i);
    const at = (s, j) => { const b = sp[s.i % sp.length], off = SR.SPREAD[j % SR.SPREAD.length]; return [b[0] + off[0], b[1] + off[1]]; };
    S.mine = S.list[0]; join(S.mine, 'player'); E.setTeam(P, S.mine.team); E.respawn(P, { at: at(S.mine, 0), delay: 0 }); P.armor = 0;
    for (let k = 1; k < totalN; k++) {
      const s = S.list[SR.squadOf(k, size)], j = k % size;
      const a = E.addBot({ name: H.botName(k - 1), team: s.team, weaponId: 'p9', difficulty: difficulty || 'normal', hp: 100, at: at(s, j) });
      if (!a) continue;
      H.ensureData(a); bots.push(a); H.setOrder(a, 'hunt'); join(s, a.id);
    }
    return totalN;
  }

  /* ---------- downed, up, dead ---------- */
  function markDown(a, by, hp) {
    const d = a.data || (a.data = {});
    d.down = { by: by || null, t: c.time, rev: null, path: null, pi: 0, pathT: 0 }; d.zk = 0;
    a.hp = typeof hp === 'number' ? hp : SR.DOWN_HP; a.armor = 0; a.hScale = 0.62;
    if (d.crate) { d.crate.claim = null; d.crate = null; }
    if (d.reviving) stopRevive(a);
    if (a.ai) { a.ai.puppet = true; a.ai.target = null; a.ai.visible = false; a.ai.path = null; a.wishX = a.wishZ = 0; a.vx = a.vz = 0; a.crouch = 1; a.crouchT = 1; }
    if (a === P) { S.revive = null; }
    else if (squadOf(a) === S.mine) { c.msg(L('mateDown', { name: nameOf(a) }), 'bad'); mark(a, true); }
  }
  function markUp(a, hp) {
    const d = a.data; if (!d || !d.down) return;
    if (d.down.rev && d.down.rev.data && d.down.rev.data.reviving) stopRevive(d.down.rev);
    d.down = null; a.hp = typeof hp === 'number' ? hp : SR.REVIVE_HP; a.hScale = 1; unTilt(a);
    if (a.ai) { a.ai.puppet = false; a.ai.path = null; a.crouchT = 0; }
    mark(a, false);
    if (a === P) { c.msg(L('youUp'), 'good'); try { E.input.set('crouch', false); } catch { /* optional */ } }
    else if (squadOf(a) === S.mine) c.msg(L('mateUp', { name: nameOf(a) }), 'good');
  }
  function cleared(a) { if (!a || !a.data) return; if (a.data.reviving) stopRevive(a); if (a.data.down) { a.data.down = null; a.hScale = 1; unTilt(a); if (a.ai) a.ai.puppet = false; } mark(a, false); }
  /** E.lethal (offline, and online for the bots this client simulates): a lethal hit on a soldier whose squadmate still stands. */
  function lethal(a, opt) {
    if (S.over || !a || a.kind === 'zombie' || !a.alive) return false;
    const s = squadOf(a); if (!s) return false;
    if (online) {       // the server decides: report the hit, keep the bot on 1 hp until its answer ('down' or 'death')
      if (!o.sim() || !o.bots || o.bots.get(a.id) !== a) return false;
      const d = a.data || (a.data = {}); a.hp = 1;
      if (!d.zk) { d.zk = 1; const by = opt && opt.by; B.send('zb_kill', { id: a.id, by: by === P ? B.me : by ? by.id : undefined, weapon: (opt && opt.weaponId) || undefined, head: !!(opt && opt.head) }); }
      return true;
    }
    if (a.data && a.data.down) return false;       // finished
    if (!standingIn(s, a)) return false;           // nobody left standing: a real death, then the squad is out
    markDown(a, opt && opt.by ? opt.by : null);
    return true;
  }
  /** Engine 'kill' event: the dead are no longer downed; offline, the squads that are out and the winner. */
  function onKill(e) {
    const v = e && e.victim; if (!v || v.kind === 'zombie') return;
    cleared(v);
    for (const s of S.list) { membersOf(s, tmpK); for (const m of tmpK) if (m.data && m.data.reviving && m.data.reviving.t === v) stopRevive(m); }
    if (S.revive && S.revive.t === v) S.revive = null;
    if (!online) wipeCheck();
  }
  function wipeCheck() {
    if (S.busy || S.over) return; S.busy = true;
    try {
      for (const s of S.list) {
        if (s.out || standingIn(s, null)) continue;
        s.out = true; s.place = liveSquads() + 1;
        membersOf(s, tmpW);
        for (const m of tmpW) if (m.alive) E.kill(m, { by: m.data && m.data.down && m.data.down.by && m.data.down.by.alive !== undefined ? m.data.down.by : null, weaponId: 'bleed' });       // squad wiped: its downed soldiers die
        c.msg(s === S.mine ? L('mineOut') : L('squadOut', { n: s.name }), s === S.mine ? 'bad' : 'info');
      }
      if (liveSquads() <= 1) { S.over = true; for (const s of S.list) if (!s.out) s.place = 1; }
    } finally { S.busy = false; }
  }

  /* ---------- the look of a downed soldier: on its knees, leaning forward; a red cross for its squadmates ---------- */
  function tilt(a) {
    const r = a.sol && a.sol.root; if (!r) return;
    if (r.rotation.order !== 'YXZ') r.rotation.order = 'YXZ';
    r.rotation.x = -0.95; r.position.y -= 0.12;
  }
  function unTilt(a) { const r = a.sol && a.sol.root; if (r && r.rotation.x !== 0) { r.rotation.x = 0; r.rotation.order = 'XYZ'; } }
  const marks = new Map();
  function mark(a, on) {
    const id = '_sqd' + idOf(a);
    if (on && a !== P) { const m = marks.get(id) || { x: 0, y: 0, z: 0, label: '+', color: DOWN_COL }; m.x = a.pos.x; m.y = a.pos.y; m.z = a.pos.z; marks.set(id, m); c.marker(id, m); if (a.data && a.data.down) a.data.down.mk = m; }
    else if (marks.has(id)) { marks.delete(id); c.marker(id, null); }
  }

  /* ---------- revives ---------- */
  function startRevive(a, t) {       // a bot of this client starts reviving t
    const d = a.data; d.reviving = { t, time: 0, sent: false, at: c.time };
    if (a.ai) { a.ai.puppet = true; a.wishX = a.wishZ = 0; a.vx = a.vz = 0; a.crouch = 1; a.crouchT = 1; a.yaw = Math.atan2(-(t.pos.x - a.pos.x), -(t.pos.z - a.pos.z)); }
    t.data.down.rev = a;
    if (online) { d.reviving.sent = true; B.send('zone_rv', { id: idOf(t), bot: a.id }); }
  }
  function stopRevive(a) {
    const d = a.data, r = d && d.reviving; if (!r) return;
    d.reviving = null; if (r.t && r.t.data && r.t.data.down && r.t.data.down.rev === a) r.t.data.down.rev = null;
    if (a.ai && !(d.down)) { a.ai.puppet = false; a.crouchT = 0; }
    if (online && r.sent) B.send('zone_rvx', { bot: a.id });
  }
  /** The downed squadmate nearest to the local player, within reach, nobody else reviving it. */
  function reviveTarget() {
    if (!standing(P) || !S.mine) return null;
    membersOf(S.mine, tmpM); let best = null, bd = SR.REVIVE_R * SR.REVIVE_R;
    for (const m of tmpM) {
      if (m === P || !isDown(m)) continue; const rv = m.data.down.rev; if (rv && rv !== P) continue;
      const dx = m.pos.x - P.pos.x, dz = m.pos.z - P.pos.z, q = dx * dx + dz * dz; if (q <= bd && Math.abs(m.pos.y - P.pos.y) < 1.8) { bd = q; best = m; }
    }
    return best;
  }

  /* ---------- the bots of a squad: revive, stick to the leader, go where the leader pinged ---------- */
  function leaderOf(s) {
    membersOf(s, tmpN);
    for (const m of tmpN) if (!m.ai && standing(m)) return m;       // a human (this player or a remote one) leads
    for (const m of tmpN) if (standing(m)) return m;
    return null;
  }
  function downedFor(a, s) {
    membersOf(s, tmpN); let best = null, bd = 40 * 40;
    for (const m of tmpN) {
      if (m === a || !isDown(m)) continue; const rv = m.data.down.rev; if (rv && rv !== a && rv.alive) continue;
      const dx = m.pos.x - a.pos.x, dz = m.pos.z - a.pos.z, q = dx * dx + dz * dz; if (q < bd) { bd = q; best = m; }
    }
    return best;
  }
  function goTo(a, x, y, z, r) { const ai = a.ai; if (!ai) return; const q = ai.order; if (q && q.type === 'goto' && Math.abs(q.x - x) < 0.3 && Math.abs(q.z - z) < 0.3 && q.radius === r) return; ai.order = { type: 'goto', x, z, y, radius: r }; }
  /** core.hooks.bot: true when the squad took this bot's order. */
  function botHook(a) {
    const d = a.data; if (!d) return false;
    if (d.down || d.reviving) return true;
    const s = squadOf(a); if (!s) return false;
    const C = core.C, dc = Math.hypot(a.pos.x - C.x, a.pos.z - C.z); if (dc > C.r - 1.5) return false;       // the gas first: the zone director runs it inside
    const ai = a.ai, fighting = ai && ai.visible && ai.target && ai.target.alive && Math.hypot(ai.target.pos.x - a.pos.x, ai.target.pos.z - a.pos.z) < 16;
    const t = !fighting ? downedFor(a, s) : null;
    if (t) {
      const dist = Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z);
      if (dist <= SR.REVIVE_R - 0.4 && Math.abs(t.pos.y - a.pos.y) < 1.6) { startRevive(a, t); return true; }
      t.data.down.rev = t.data.down.rev && t.data.down.rev.alive ? t.data.down.rev : null; goTo(a, t.pos.x, t.pos.y, t.pos.z, 1.1); return true;
    }
    const lead = leaderOf(s); if (!lead || lead === a) return false;
    const pg = S.ping && S.ping.s === s && c.time < S.ping.until ? S.ping : null, fx = pg ? pg.x : lead.pos.x, fz = pg ? pg.z : lead.pos.z;
    if (Math.hypot(fx - a.pos.x, fz - a.pos.z) > (pg ? 6 : 15)) { goTo(a, fx, pg ? pg.y : lead.pos.y, fz, pg ? 2.5 : 4); return true; }
    return false;
  }
  /** core.hooks.hold: where a squad bot waits (next to its leader, or the leader's ping), or null for the zone's own spot. */
  const HOLD = { x: 0, z: 0 };
  function holdHook(a) {
    const s = squadOf(a); if (!s) return null; const lead = leaderOf(s); if (!lead || lead === a) return null;
    const pg = S.ping && S.ping.s === s && c.time < S.ping.until ? S.ping : null;
    HOLD.x = pg ? pg.x : lead.pos.x; HOLD.z = pg ? pg.z : lead.pos.z; return HOLD;
  }

  /* ---------- a downed bot of this client crawls: toward the zone, then toward a standing squadmate ---------- */
  function crawl(a, dt) {
    const dd = a.data.down, C = core.C, sp = 4.7 * SR.CRAWL;
    a.crouch = 1; a.wishX = a.wishZ = 0;
    if (dd.rev && dd.rev.alive) { dd.path = null; dd.pathT = 0; return; }       // someone is reviving it: stay put
    dd.pathT -= dt;
    if (dd.pathT <= 0) {
      dd.pathT = 1.2; dd.path = null; dd.pi = 0;
      let tx = null, tz = 0, ty = 0;
      if (Math.hypot(a.pos.x - C.x, a.pos.z - C.z) > C.r - 1) { const q = nav.nearest(C.x, C.z); tx = q[0]; tz = q[1]; ty = q.length > 2 ? q[2] : 0; }
      else {       // toward the nearest standing squadmate, unless it is already close
        const s = squadOf(a); membersOf(s, tmpN); let bd = 60, near = null;
        for (const m of tmpN) { if (m === a || !standing(m)) continue; const q = Math.hypot(m.pos.x - a.pos.x, m.pos.z - a.pos.z); if (q < bd) { bd = q; near = m; } }
        if (near && bd > 2.2) { tx = near.pos.x; tz = near.pos.z; ty = near.pos.y; }
      }
      if (tx !== null) dd.path = nav.path(a.pos.x, a.pos.y, a.pos.z, tx, ty, tz);
    }
    const p = dd.path; if (!p || dd.pi >= p.length) return;
    const w = p[dd.pi], dx = w.x - a.pos.x, dz = w.z - a.pos.z, l = Math.hypot(dx, dz);
    if (l < 0.35) { dd.pi++; return; }
    const k = Math.min(l, sp * dt) / l; a.body.vy = 0;
    mover.move(a.body, dx * k, -0.05, dz * k);
    a.yaw = Math.atan2(-dx, -dz);
  }

  /* ---------- the local player downed: knees, crawl, no gun, no gear ---------- */
  const BLOCK = new Set(['grenade', 'tactical', 'medical', 'reload', 'weapon1', 'weapon2', 'nextWeapon', 'inspect', 'slide', 'jump']);
  const capture = e => {
    if (!isDown(P)) return;
    let code = e.code; if (e.type === 'mousedown') code = 'Mouse' + e.button; else if (e.type === 'wheel') code = e.deltaY > 0 ? 'WheelDown' : 'WheelUp';
    let act = null; try { act = E.settings.action(code); } catch { /* none */ }
    if (act && BLOCK.has(act)) { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); }
  };
  addEventListener('keydown', capture, true); addEventListener('mousedown', capture, true); addEventListener('wheel', capture, { capture: true, passive: false });
  c.on('input', () => {
    if (!isDown(P)) return;
    try { E.input.set('fire', false); E.input.set('aim', false); E.input.set('jump', false); E.input.set('slide', false); E.input.set('crouch', true); } catch { /* optional */ }
    const IP = I.P; if (IP) { IP.jumpBuf = 0; IP.sprint = false; IP.gxSpeed = SR.CRAWL / 0.5; IP.reload = 0; }       // crouched speed is half the run: x CRAWL / 0.5 = CRAWL
  });
  if (online) c.on('kill', onKill);       // offline, engine-zone.js calls onKill itself (then refreshes the board)

  /* ---------- HUD: squad panel, downed screen, pings ---------- */
  const hudRoot = (I.hud && I.hud.el && I.hud.el.top && I.hud.el.top.parentNode) || document.body;
  const panel = document.createElement('div'); panel.dataset.h = 'squad';
  panel.style.cssText = 'position:absolute;left:var(--fz-pad,16px);top:calc(var(--fz-pad,16px) + var(--fz-map,170px) + clamp(86px,11vh,112px));width:clamp(170px,17vw,220px);display:flex;flex-direction:column;gap:3px;pointer-events:none;z-index:3;font-weight:700;font-size:clamp(11px,1.35vh,14px);letter-spacing:.04em;color:#f1e7cd;text-shadow:0 1px 2px rgba(0,0,0,.9)';
  const head = document.createElement('div'); head.style.cssText = 'font-size:.85em;letter-spacing:.14em;color:#c4bca5;padding:0 2px'; panel.appendChild(head);
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const r = document.createElement('div'); r.style.cssText = 'display:none;align-items:center;gap:6px;padding:3px 7px;background:linear-gradient(90deg,rgba(10,13,11,.72),rgba(10,13,11,.38));border-left:3px solid #7fb2e6';
    const nm = document.createElement('span'); nm.style.cssText = 'flex:0 0 auto;max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    const bar = document.createElement('i'); bar.style.cssText = 'flex:1 1 auto;height:5px;background:rgba(255,255,255,.14);position:relative;overflow:hidden';
    const fill = document.createElement('b'); fill.style.cssText = 'position:absolute;left:0;top:0;bottom:0;width:100%;background:#eef1ea;transform-origin:0 50%'; bar.appendChild(fill);
    const st = document.createElement('small'); st.style.cssText = 'flex:0 0 auto;font-size:.82em;color:' + DOWN_COL;
    r.append(nm, bar, st); panel.appendChild(r); rows.push({ r, nm, fill, st, ln: '', ls: '', lw: -1, lc: '', on: false });
  }
  hudRoot.appendChild(panel);
  const veil = document.createElement('div'); veil.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at 50% 55%,rgba(120,0,0,0) 35%,rgba(120,0,0,.55) 100%)';
  const banner = document.createElement('div'); banner.style.cssText = 'position:absolute;left:50%;bottom:clamp(120px,19vh,190px);transform:translateX(-50%);display:none;flex-direction:column;align-items:center;gap:5px;pointer-events:none;z-index:3;font-weight:800;letter-spacing:.06em;color:#ffd9cf;text-shadow:0 1px 3px #000;font-size:clamp(13px,1.9vh,18px);white-space:nowrap';
  const btxt = document.createElement('span'), bbar = document.createElement('i'), bfill = document.createElement('b');
  bbar.style.cssText = 'display:block;width:clamp(160px,22vw,280px);height:6px;background:rgba(0,0,0,.5);overflow:hidden'; bfill.style.cssText = 'display:block;height:100%;width:100%;background:' + DOWN_COL + ';transform-origin:0 50%';
  bbar.appendChild(bfill); banner.append(btxt, bbar); hudRoot.append(veil, banner);
  let lb = '', lbw = -1, lv = -1;
  function hud() {
    if (!S.mine) { panel.style.display = 'none'; return; }
    const h = L('squad', { n: S.mine.name }); if (h !== head.textContent) head.textContent = h;
    membersOf(S.mine, tmpM); let k = 0;
    for (const m of tmpM) {
      if (m === P || k >= rows.length) continue; const R = rows[k++];
      if (!R.on) { R.on = true; R.r.style.display = 'flex'; }
      const nm = nameOf(m); if (nm !== R.ln) { R.ln = nm; R.nm.textContent = nm; }
      const down = isDown(m), dead = !m.alive, w = dead ? 0 : Math.max(0, Math.min(1, down ? m.hp / SR.DOWN_HP : m.hp / (m.maxHp || 100)));
      const wr = Math.round(w * 50) / 50; if (wr !== R.lw) { R.lw = wr; R.fill.style.transform = 'scaleX(' + wr + ')'; }
      const col = dead ? '#555' : down ? DOWN_COL : '#eef1ea'; if (col !== R.lc) { R.lc = col; R.fill.style.background = col; R.r.style.borderLeftColor = dead ? '#555' : down ? DOWN_COL : '#7fb2e6'; R.r.style.opacity = dead ? '0.55' : '1'; }
      const s = dead ? L('dead') : down ? L('down') + ' ' + Math.max(0, Math.ceil(m.hp / (SR.DOWN_HP / SR.BLEED))) + ' s' : ''; if (s !== R.ls) { R.ls = s; R.st.textContent = s; }
    }
    for (; k < rows.length; k++) if (rows[k].on) { rows[k].on = false; rows[k].r.style.display = 'none'; }
    // the local player downed
    const me = isDown(P), v = me ? 1 : 0; if (v !== lv) { lv = v; veil.style.opacity = String(v); banner.style.display = me ? 'flex' : 'none'; if (!me) lb = ''; }
    if (me) {
      const rv = P.data.down.rev, t = rv && rv.alive ? L('revived', { name: nameOf(rv) }) : L('youDown', { s: Math.max(0, Math.ceil(P.hp / (SR.DOWN_HP / SR.BLEED))) });
      if (t !== lb) { lb = t; btxt.textContent = t; }
      const w = Math.round(Math.max(0, Math.min(1, P.hp / SR.DOWN_HP)) * 100) / 100; if (w !== lbw) { lbw = w; bfill.style.transform = 'scaleX(' + w + ')'; }
    }
  }
  const scoreBox = { label: '', value: '', color: AMBER };
  function scoreLeft() { scoreBox.label = L('squads'); scoreBox.value = liveSquads() + ' / ' + S.list.length; return scoreBox; }

  /* ---------- pings: the ping key marks where the player looks, for the squad (screen and minimap) ---------- */
  const pingMarks = new Map(), PV = new (camera.position.constructor)();
  function addPing(by, x, y, z) {
    const s = squadOf(by) || S.mine, id = '_sqp' + (idOf(by) || 'x');
    const m = pingMarks.get(id) || { x: 0, y: 0, z: 0, label: '!', color: PING_COL, until: 0 }; m.x = x; m.y = y; m.z = z; m.until = c.time + SR.PING_TTL; pingMarks.set(id, m); c.marker(id, m);
    S.ping = { s, x, y, z, until: c.time + 12 };
    if (by !== P) c.msg(L('ping', { name: nameOf(by) }), 'info');
  }
  function pingNow() {
    camera.getWorldDirection(PV); const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
    const d = Math.min(150, grid.ray(ox, oy, oz, PV.x, PV.y, PV.z, 150)) - 0.25, x = ox + PV.x * d, y = Math.max(0, oy + PV.y * d - 0.2), z = oz + PV.z * d;
    if (online) { if (c.time - S.sent < 0.6) return; S.sent = c.time; B.send('zone_ping', { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100 }); }
    addPing(P, x, y, z);
  }

  /* ---------- every frame ---------- */
  function update(dt) {
    // the local player: revive a squadmate by holding the interact key, ping
    const held = E.input.held('interact'), tg = reviveTarget();
    if (tg && held && !S.over && c.time > S.revNo) {
      if (!S.revive || S.revive.t !== tg) { S.revive = { t: tg, time: 0, label: L('reviving', { name: nameOf(tg) }) }; if (online) B.send('zone_rv', { id: idOf(tg) }); }
      S.revive.time += dt; c.frac = S.revive.time / SR.REVIVE; c.progress(S.revive.label);
      tg.data.down.rev = P;
      if (!online && S.revive.time >= SR.REVIVE) { markUp(tg); S.revive = null; c.progress(null); }
    } else if (S.revive) {
      if (online) B.send('zone_rvx', {});
      if (S.revive.t && S.revive.t.data && S.revive.t.data.down && S.revive.t.data.down.rev === P) S.revive.t.data.down.rev = null;
      S.revive = null; c.progress(null);
    }
    let ping = false; try { ping = E.input.held('ping'); } catch { /* no key */ }
    if (ping && !S.pingDown && P.alive && !E.rules.frozen) pingNow();
    S.pingDown = ping;
    if (pingMarks.size) for (const [id, m] of pingMarks) if (c.time > m.until) { pingMarks.delete(id); c.marker(id, null); }
    // soldiers: downed look, crawl, bleed (offline), bot revives
    const sim = !online || o.sim();
    for (let i = 0; i < E.actors.length; i++) {
      const a = E.actors[i], d = a.data; if (!d || !a.alive) continue;
      if (d.down) {
        if (a !== P) tilt(a);
        const mk = d.down.mk; if (mk) { mk.x = a.pos.x; mk.y = a.pos.y; mk.z = a.pos.z; }
        if (!online) { a.hp -= dt * SR.DOWN_HP / SR.BLEED; if (a.hp <= 0) { a.hp = 0; E.kill(a, { by: d.down.by && d.down.by.alive !== undefined ? d.down.by : null, weaponId: 'bleed' }); continue; } }
        if (a.ai && sim && !E.rules.frozen) crawl(a, dt);
      } else if (d.reviving && sim) {
        const r = d.reviving, t = r.t;
        if (!t || !isDown(t) || Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z) > SR.REVIVE_R + 0.8 || (online && c.time - r.at > SR.REVIVE + 3)) { stopRevive(a); continue; }
        a.crouch = 1; r.time += dt;
        if (!online && r.time >= SR.REVIVE) { stopRevive(a); markUp(t); }
      }
    }
    S.hudT -= dt; if (S.hudT <= 0) { S.hudT = 0.2; if (online) applyTeams(); hud(); }       // online: a stale 'score' replayed at the first frame (modes.js replayNet) carries the teams of before the deal
  }
  /** After the engine moved everyone: hide the local gun while downed. */
  c.on('tick', () => { if (isDown(P) && I.vm && I.vm.group) I.vm.group.visible = false; });

  /* ---------- online: the server's word ---------- */
  function applyTeams() {
    for (const s of S.list) for (const id of s.ids) { const a = actorOf(id); if (a && a.team !== s.team) E.setTeam(a, s.team); }
  }
  function sync(m) {
    const v = m && m.sq; if (!v || !Array.isArray(v.squads)) return;
    for (const q of v.squads) {
      const i = Math.max(0, (SR.fromWire(q.id) || 101) - 101); let s = S.list.find(x => x.i === i); if (!s) { s = newSquad(i); S.list.sort((a, b) => a.i - b.i); }
      s.out = !!q.out; s.place = q.place | 0; for (const id of q.m || []) join(s, id);
    }
    S.mine = ofId.get(B.me) || null;
    applyTeams();
    for (const [id, hp] of v.downs || []) { const a = actorOf(id); if (a && a.alive && !isDown(a)) markDown(a, null, hp); }
  }
  function onZone(m) {
    switch (m.op) {
      case 'down': { const a = actorOf(m.id); if (a && a.alive) { markDown(a, actorOf(m.by), m.hp); if (a === P) P.hp = m.hp; } return true; }
      case 'up': { const a = actorOf(m.id); if (a) { markUp(a, m.hp); if (a === P && typeof m.hp === 'number') P.hp = m.hp; } if (S.revive && S.revive.t === a) { S.revive = null; c.progress(null); } return true; }
      case 'rv': { const t = actorOf(m.id), rv = actorOf(m.by); if (t && t.data && t.data.down) t.data.down.rev = rv || null; return true; }
      case 'rvx': case 'rvno': { const t = actorOf(m.id), rv = actorOf(m.by); if (rv === P && m.op === 'rvno' && S.revive) { S.revive = null; S.revNo = c.time + 1; c.progress(null); } if (t && t.data && t.data.down && t.data.down.rev === rv) t.data.down.rev = null; if (rv && rv.data && rv.data.reviving) { rv.data.reviving.sent = false; stopRevive(rv); } return true; }
      case 'ping': { if (m.by === B.me) return true; const a = actorOf(m.by); if (a) addPing(a, m.x, m.y, m.z); return true; }
      case 'sqout': { const i = (SR.fromWire(m.team) || 101) - 101, s = S.list.find(x => x.i === i); if (s && !s.out) { s.out = true; s.place = m.place | 0; c.msg(s === S.mine ? L('mineOut') : L('squadOut', { n: s.name }), s === S.mine ? 'bad' : 'info'); } return true; }
      case 'sqhp': { if (Array.isArray(m.l)) for (let i = 0; i + 1 < m.l.length; i += 2) { const a = actorOf(m.l[i]); if (a && a !== P && !(o.sim() && o.bots && o.bots.get(a.id) === a)) a.hp = m.l[i + 1]; } return true; }
      default: return false;
    }
  }

  /* ---------- core hooks ---------- */
  core.hooks.bot = botHook; core.hooks.hold = holdHook;
  core.hooks.busy = () => isDown(P) || !!reviveTarget();
  core.hooks.obj = () => L('obj');
  core.hooks.prompt = () => { if (isDown(P)) return ''; const t = reviveTarget(); return t ? L('revive', { key: keyLabel(E, 'interact', 'E'), name: nameOf(t) }) : null; };
  c.objective(L('obj'));

  return {
    S, L, lethal, onKill, update, sync, onZone, spawnOffline, scoreLeft, liveSquads, applyTeams,
    engineTeam: w => SR.fromWire(w),
    /** Online takeover: a bot that was already down when this client started simulating it. */
    downById(id, hp) { const a = actorOf(id); if (a && a.alive && !isDown(a)) markDown(a, null, hp); },
    over: () => S.over,
    /** Placement of a soldier: its squad's, once the squad is out (0 before). */
    placeOf: a => { const s = squadOf(a); return s && s.place ? s.place : 0; },
    /** Offline end: placement of this player's squad, out of all squads. */
    result() { const s = S.mine, place = s && s.place ? s.place : liveSquads(); return { place, of: S.list.length, won: !!s && s.place === 1 && S.over }; },
    isMine: w => !!S.mine && w === S.mine.wire,
    title: (won, place) => (won ? L('won') : L('out', { n: place })),
    /** The squads' own objective line, for the core's HUD. */
    objective: () => L('obj'),
    dispose() {
      removeEventListener('keydown', capture, true); removeEventListener('mousedown', capture, true); removeEventListener('wheel', capture, { capture: true });
      for (const id of marks.keys()) c.marker(id, null); for (const id of pingMarks.keys()) c.marker(id, null); marks.clear(); pingMarks.clear();
      for (const a of E.actors) { if (a.data && (a.data.down || a.data.reviving)) { a.data.down = null; a.data.reviving = null; } a.hScale = 1; unTilt(a); if (a.ai) a.ai.puppet = false; }
      if (core.hooks) { core.hooks.bot = core.hooks.hold = core.hooks.busy = core.hooks.prompt = core.hooks.obj = null; }
      panel.remove(); veil.remove(); banner.remove();
    },
  };
}
