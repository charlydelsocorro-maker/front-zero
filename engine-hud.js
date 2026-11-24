// FRONT ZÉRO — engine helper: in-match HUD. Markup is injected into the hud root; styles live in next.html.
// Every DOM write is cached: nothing is touched when the value did not change.
import * as THREE from 'three';

/* Strings missing from i18n.js (fr, en, es, de, pt, it). */
const L = {
  settings: ['PARAMÈTRES', 'SETTINGS', 'AJUSTES', 'EINSTELLUNGEN', 'DEFINIÇÕES', 'IMPOSTAZIONI'],
  back: ['RETOUR', 'BACK', 'VOLVER', 'ZURÜCK', 'VOLTAR', 'INDIETRO'],
  loading: ['CHARGEMENT DE LA CARTE…', 'LOADING MAP…', 'CARGANDO MAPA…', 'KARTE WIRD GELADEN…', 'A CARREGAR O MAPA…', 'CARICAMENTO MAPPA…'],
  spectating: ['SPECTATEUR · {name}', 'SPECTATING · {name}', 'ESPECTADOR · {name}', 'ZUSCHAUER · {name}', 'ESPECTADOR · {name}', 'SPETTATORE · {name}'],
  specNext: ['Tir : joueur suivant', 'Fire: next player', 'Disparo: siguiente jugador', 'Feuer: nächster Spieler', 'Disparo: jogador seguinte', 'Fuoco: giocatore successivo'],
  dead: ['ÉLIMINÉ', 'ELIMINATED', 'ELIMINADO', 'AUSGESCHALTET', 'ELIMINADO', 'ELIMINATO'],
  waiting: ['En attente de la prochaine manche…', 'Waiting for the next round…', 'Esperando la siguiente ronda…', 'Warten auf die nächste Runde…', 'A aguardar a próxima ronda…', 'In attesa del prossimo round…'],
  player: ['Joueur', 'Player', 'Jugador', 'Spieler', 'Jogador', 'Giocatore'],
  kills: ['Élim.', 'Kills', 'Bajas', 'Kills', 'Abates', 'Uccisioni'],
  deaths: ['Morts', 'Deaths', 'Muertes', 'Tode', 'Mortes', 'Morti'],
  muted: ['SON COUPÉ', 'SOUND OFF', 'SONIDO APAGADO', 'TON AUS', 'SOM DESLIGADO', 'AUDIO DISATTIVATO'],
  unmuted: ['SON ACTIVÉ', 'SOUND ON', 'SONIDO ACTIVADO', 'TON AN', 'SOM LIGADO', 'AUDIO ATTIVO'],
  noLock: ['Verrouillage impossible ici : flèches ou bords de l’écran pour tourner.', 'Pointer lock unavailable here: use the arrow keys or screen edges to turn.', 'Bloqueo imposible aquí: usa las flechas o los bordes de la pantalla para girar.', 'Mauszeiger kann hier nicht gesperrt werden: Pfeiltasten oder Bildschirmränder zum Drehen.', 'Bloqueio impossível aqui: usa as setas ou as margens do ecrã para rodar.', 'Blocco impossibile qui: usa le frecce o i bordi dello schermo per ruotare.'],
  you: ['VOUS', 'YOU', 'TÚ', 'DU', 'TU', 'TU'],
  start: ['DÉPLOYER', 'DEPLOY', 'DESPLEGAR', 'EINSATZ', 'DESTACAR', 'SCHIERA'],
  map: ['Carte', 'Map', 'Mapa', 'Karte', 'Mapa', 'Mappa'],
  eliminations: ['ÉLIMINATIONS', 'KILLS', 'BAJAS', 'KILLS', 'ABATES', 'UCCISIONI'],
  killReward: ['Élimination', 'Kill', 'Baja', 'Kill', 'Abate', 'Uccisione'],
  headReward: ['Tir à la tête', 'Headshot', 'Tiro a la cabeza', 'Kopfschuss', 'Tiro na cabeça', 'Colpo alla testa'],
  bots: ['Adversaires', 'Opponents', 'Oponentes', 'Gegner', 'Adversários', 'Avversari'],
  again: ['REJOUER', 'PLAY AGAIN', 'JUGAR DE NUEVO', 'NOCHMAL', 'JOGAR DE NOVO', 'RIGIOCA'],
  torch: ['LAMPE', 'LIGHT', 'LINTERNA', 'LAMPE', 'LANTERNA', 'TORCIA'],
  noGear: ['Plus de grenade', 'No grenades left', 'Sin granadas', 'Keine Granaten mehr', 'Sem granadas', 'Granate esaurite'],
  noAmmo: ['Plus de munitions', 'Out of ammo', 'Sin munición', 'Keine Munition mehr', 'Sem munições', 'Munizioni esaurite'],
};
const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
/** t(key,params): i18n key when it exists, otherwise the local table, fr as fallback. */
export function makeT(i18n) {
  return (key, params) => {
    if (L[key]) { const i = Math.max(0, LANGS.indexOf(i18n && i18n.lang)); let s = L[key][i] || L[key][0]; if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)); return s; }
    return i18n ? i18n.t(key, params) : key;
  };
}

const TEMPLATE = `
<div data-h="vig"></div><div data-h="scope"></div><div data-h="dmg"><i></i><i></i><i></i><i></i></div>
<div data-h="cross"><i></i><i></i><i></i><i></i><b></b><u></u></div><div data-h="hit"></div><div data-h="nums"></div><div data-h="markers"></div>
<canvas data-h="map" width="170" height="170"></canvas>
<div data-h="top"><span data-h="sL"><small></small><b></b></span><span data-h="mid"><b data-h="timer"></b><i data-h="center"></i></span><span data-h="sR"><small></small><b></b></span></div>
<div data-h="obj"></div><div data-h="earn"><b></b><small></small></div><div data-h="feed"></div><div data-h="msg"></div><div data-h="prompt"></div><div data-h="loot"></div>
<div data-h="prog"><span></span><i><u></u></i></div><div data-h="hint"></div><div data-h="spec"></div><div data-h="fps"></div><div data-h="lock"></div>
<div data-h="vit"><span class="n" data-h="hpN">100</span><small data-h="cls"></small><div class="meter" data-h="arm"><u></u></div><div class="meter" data-h="hp"><u></u></div></div>
<div data-h="wp"><div class="a"><b data-h="am">0</b> <span data-h="mg"></span></div><div data-h="wname"></div><div data-h="gear"></div><div data-h="torch"></div></div>
<div data-h="board"></div><div data-h="load"></div>
<div data-h="pause"><div data-h="pmain"><h1 data-h="ptitle"></h1><button data-h="resume"></button><button data-h="opts"></button><button data-h="quit"></button></div><div data-h="pset"><div data-h="psetbody"></div><button data-h="psetback"></button></div></div>`;

export function createHud(root, { settings, i18n, onResume, onQuit }) {
  const t = makeT(i18n);
  if (!root.querySelector('[data-h="cross"]')) root.innerHTML = TEMPLATE;
  const $ = k => root.querySelector(`[data-h="${k}"]`);
  const el = {}; for (const k of ['vig', 'scope', 'dmg', 'cross', 'hit', 'nums', 'markers', 'map', 'top', 'sL', 'sR', 'timer', 'center', 'obj', 'earn', 'feed', 'msg', 'prompt', 'loot', 'prog', 'hint', 'spec', 'fps', 'lock', 'vit', 'hpN', 'cls', 'arm', 'hp', 'wp', 'am', 'mg', 'wname', 'gear', 'torch', 'board', 'load', 'pause', 'pmain', 'ptitle', 'resume', 'opts', 'quit', 'pset', 'psetbody', 'psetback']) el[k] = $(k);
  const tx = (e, v) => { if (e._t !== v) { e._t = v; e.textContent = v; } };
  const sw = (e, k, v) => { if (e['_' + k] !== v) { e['_' + k] = v; e.style[k] = v; } };
  const vis = (e, on) => sw(e, 'display', on ? '' : 'none');
  const crossI = el.cross.querySelectorAll('i'), crossDot = el.cross.querySelector('b'), crossRing = el.cross.querySelector('u');
  const dmgI = [...el.dmg.children], dmgT = new Float32Array(4), dmgA = new Float32Array(4); let dmgN = 0;
  const hpBar = el.hp.firstElementChild, armBar = el.arm.firstElementChild, progBar = el.prog.querySelector('u'), progLab = el.prog.querySelector('span');
  const sLl = el.sL.querySelector('small'), sLv = el.sL.querySelector('b'), sRl = el.sR.querySelector('small'), sRv = el.sR.querySelector('b');
  const mc = el.map.getContext('2d'); let mapBg = null, mapK = 1, mapS = 0;
  const markers = new Map(), v3 = new THREE.Vector3();
  const nums = []; for (let i = 0; i < 8; i++) { const d = document.createElement('div'); el.nums.appendChild(d); nums.push({ d, t: 0, x: 0, y: 0 }); } let numI = 0;
  const feedItems = [];
  let crossDirty = true, earnT = 0;
  const earnB = el.earn.querySelector('b'), earnS = el.earn.querySelector('small');
  let hitT = 0, hurtT = 0, msgT = 0, board = null, boardOn = false, boardT = 0, unmount = null, crossG = -1, crossKey = '', timerV = null, clock = 0, lowHp = false, deadV = false;
  el.loot.style.cssText = 'left:50%;top:67%;transform:translateX(-50%);font-size:clamp(14px,2.4vw,19px);color:#fff;background:rgba(10,12,8,.74);border:1px solid var(--line);padding:4px 14px;width:max-content;max-width:88vw;text-align:center';
  for (const k of ['msg', 'prompt', 'loot', 'prog', 'hint', 'spec', 'fps', 'lock', 'board', 'load', 'pause', 'obj', 'earn', 'pset', 'gear', 'torch']) vis(el[k], false);

  function texts() {
    el.ptitle.textContent = t('pause.title'); el.resume.textContent = t('pause.resume'); el.opts.textContent = t('settings'); el.quit.textContent = t('pause.quit'); el.psetback.textContent = t('back');
  }
  texts(); if (i18n && i18n.on) i18n.on('change', texts);
  const closeSettings = () => { if (unmount) { try { unmount(); } catch { /* ignore */ } unmount = null; } el.psetbody.textContent = ''; vis(el.pset, false); vis(el.pmain, true); };
  el.resume.addEventListener('click', () => onResume && onResume());
  el.quit.addEventListener('click', () => onQuit && onQuit());
  el.psetbody.classList.add('fzh-settings');
  el.opts.addEventListener('click', () => { vis(el.pmain, false); vis(el.pset, true); try { unmount = settings.mount(el.psetbody); } catch (e) { console.error('[hud] settings.mount', e); } });
  el.psetback.addEventListener('click', closeSettings);

  function crossStyle() {
    const style = settings.get('gameplay.crosshairStyle') || 'cross', size = settings.get('gameplay.crosshairSize') || 1, col = settings.get('gameplay.crosshairColor') || '#ffffff';
    crossDirty = false; crossG = -1;
    const lines = style === 'cross' || style === 'crossdot', dot = style === 'dot' || style === 'crossdot', ring = style === 'circle';
    for (const i of crossI) { i.style.display = lines ? '' : 'none'; i.style.background = col; }
    crossDot.style.display = dot ? '' : 'none'; crossDot.style.background = col; const ds = Math.round(3 * size + (style === 'dot' ? 2 : 0)); crossDot.style.width = crossDot.style.height = ds + 'px'; crossDot.style.margin = (-ds / 2) + 'px';
    crossRing.style.display = ring ? '' : 'none'; crossRing.style.borderColor = col;
    el.cross._size = size; el.cross._ring = ring;
  }
  function drawBoard(def) {
    const data = board || (def && def()); if (!data) return;
    const b = el.board; b.textContent = '';
    const table = document.createElement('table'), head = document.createElement('tr');
    const cols = (data.columns || []).map(c => (typeof c === 'string' ? { key: c, label: c } : c));
    for (const c of cols) { const th = document.createElement('th'); th.textContent = c.label ?? c.key ?? ''; head.appendChild(th); }
    table.appendChild(head);
    for (const r of data.rows || []) {
      const tr = document.createElement('tr'), arr = Array.isArray(r) ? r : Array.isArray(r.cells) ? r.cells : Array.isArray(r.values) ? r.values : null;
      if (r && typeof r === 'object') { if (r.me || r.isPlayer) tr.className = 'me'; if (r.color) tr.style.color = r.color; else if (r.team === 0) tr.classList.add('t0'); else if (r.team === 1) tr.classList.add('t1'); if (r.dead || r.alive === false) tr.classList.add('dead'); }
      cols.forEach((c, i) => { const td = document.createElement('td'); const v = arr ? arr[i] : r[c.key] ?? r[i]; td.textContent = v === undefined || v === null ? '' : String(v); tr.appendChild(td); });
      table.appendChild(tr);
    }
    if (data.title) { const h = document.createElement('h2'); h.textContent = data.title; b.appendChild(h); }
    b.appendChild(table);
  }
  const fmtTime = s => { const v = Math.max(0, Math.ceil(s)); return Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0'); };

  /* ---- contract API (E.hud) ---- */
  const api = {
    set(o) {
      if (!o) return;
      if ('left' in o) { const s = o.left; vis(el.sL, !!s); if (s) { tx(sLl, s.label ?? ''); tx(sLv, String(s.value ?? '')); sw(sLv, 'color', s.color || ''); } }
      if ('right' in o) { const s = o.right; vis(el.sR, !!s); if (s) { tx(sRl, s.label ?? ''); tx(sRv, String(s.value ?? '')); sw(sRv, 'color', s.color || ''); } }
      if ('center' in o) { tx(el.center, o.center || ''); vis(el.center, !!o.center); }
      if ('timer' in o) { timerV = typeof o.timer === 'number' && isFinite(o.timer) ? o.timer : null; vis(el.timer, timerV !== null); if (timerV !== null) { tx(el.timer, fmtTime(timerV)); sw(el.timer, 'color', timerV <= 10 ? 'var(--red)' : ''); } }
      if ('objective' in o) { tx(el.obj, o.objective || ''); vis(el.obj, !!o.objective); }
    },
    message(text, o) { const kind = (o && o.kind) || 'info'; tx(el.msg, String(text ?? '')); sw(el.msg, 'color', kind === 'good' ? 'var(--green)' : kind === 'bad' ? 'var(--red)' : 'var(--amber)'); msgT = (o && o.dur) || 1.6; vis(el.msg, true); },
    feed(text) { const d = document.createElement('div'); d.textContent = String(text ?? ''); addFeed(d); },
    prompt(text) { tx(el.prompt, text || ''); vis(el.prompt, !!text); },
    progress(label, frac) { const on = frac !== null && frac !== undefined; vis(el.prog, on); if (on) { tx(progLab, label || ''); sw(progBar, 'width', Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%'); } },
    marker(id, m) {
      let k = markers.get(id);
      if (!m) { if (k) { k.d.remove(); markers.delete(id); } return; }
      if (!k) { const d = document.createElement('div'); d.className = 'mk'; d.innerHTML = '<b></b><span></span><small></small>'; el.markers.appendChild(d); k = { d, lab: d.querySelector('span'), dist: d.querySelector('small'), dot: d.querySelector('b'), m: null }; markers.set(id, k); }
      k.m = m; tx(k.lab, m.label ?? ''); const col = m.color || '#e8a628'; if (k.col !== col) { k.col = col; k.d.style.color = col; } const sm = !!m.small; if (k.sm !== sm) { k.sm = sm; k.d.classList.toggle('sm', sm); }
    },
    scoreboard(data) { board = data || null; if (boardOn) drawBoard(); },
  };
  function addFeed(d) { el.feed.prepend(d); feedItems.unshift({ d, t: clock + 5.5 }); while (feedItems.length > 5) feedItems.pop().d.remove(); }

  return {
    api, t, el,
    show(on) { vis(root, on); },
    reset() {
      el.feed.textContent = ''; feedItems.length = 0; for (const k of markers.values()) k.d.remove(); markers.clear(); board = null; boardOn = false; vis(el.board, false);
      api.set({ left: null, right: null, center: '', timer: null, objective: null }); api.prompt(null); tx(el.loot, ''); vis(el.loot, false); api.progress('', null); vis(el.msg, false); msgT = 0; hitT = hurtT = 0; dmgT.fill(0); for (const d of dmgI) d.style.opacity = 0;
      vis(el.hint, false); vis(el.spec, false); vis(el.earn, false); for (const q of nums) { q.t = 0; q.d.style.opacity = 0; }
    },
    /** Kill-feed line with highlighted names. */
    feedKill(killer, victim, head, mineK, mineV) {
      const d = document.createElement('div'), a = document.createElement(mineK ? 'b' : 'span'), b = document.createElement(mineV ? 'b' : 'span');
      a.textContent = killer || ''; b.textContent = victim; d.append(a, document.createTextNode(killer ? (head ? ' ⌖ ' : ' ▸ ') : '✕ '), b); addFeed(d);
    },
    earn(total, n, reason) { vis(el.earn, total > 0); tx(earnB, '+' + total + ' ₡'); if (n) { tx(earnS, '+' + n + (reason ? ' ' + reason : '')); earnT = 2.2; sw(earnS, 'opacity', 1); } else { earnT = 0; sw(earnS, 'opacity', 0); } },
    invalidate() { crossDirty = true; },
    /** Pickup prompt, separate from the mode's objective prompt (which has priority on the interact key: see promptOn). */
    loot(text) { tx(el.loot, text || ''); vis(el.loot, !!text); },
    get promptOn() { return !!el.prompt._t; },
    vitals(hp, maxHp, armor, maxArmor, cls, alive) {
      tx(el.hpN, String(Math.max(0, Math.ceil(hp)))); sw(hpBar, 'width', Math.round(Math.max(0, hp) / maxHp * 100) + '%'); lowHp = alive && hp > 0 && hp < maxHp * 0.3; deadV = !alive;
      sw(hpBar, 'background', lowHp ? 'var(--red)' : '#f1e7cd'); sw(armBar, 'width', Math.round(Math.max(0, Math.min(1, armor / Math.max(maxArmor, 1))) * 100) + '%'); tx(el.cls, cls);
    },
    /** reserve >= 0: the weapon carries a limited number of spare rounds, shown as "mag / reserve"; otherwise "mag / mag size". A non-numeric ammo (melee) hides the counter. */
    weapon(ammo, mag, name, reloading, reserve) { tx(el.am, String(ammo)); sw(el.am, 'color', ammo <= mag * 0.2 ? 'var(--red)' : '#fff'); tx(el.mg, typeof ammo !== 'number' ? '' : reserve >= 0 ? '/ ' + reserve : '/ ' + mag); sw(el.mg, 'color', reserve === 0 ? 'var(--red)' : ''); tx(el.wname, reloading ? t('hud.reloading') : name); },
    /** Gear slot (grenades): n < 0 hides it. */
    gear(n, name, key) { vis(el.gear, n >= 0); if (n >= 0) { tx(el.gear, (key ? '[' + key + ']  ' : '') + name + '  ×' + n); sw(el.gear, 'color', n === 0 ? 'var(--red)' : ''); } },
    /** Weapon light indicator. */
    torch(on, key) { vis(el.torch, !!on); if (on) tx(el.torch, '◉ ' + t('torch') + (key ? '  [' + key + ']' : '')); },
    cross(gap, on) {
      if (crossDirty) crossStyle(); sw(el.cross, 'opacity', on ? 1 : 0); const size = el.cross._size || 1, g = Math.round(gap * size); if (g === crossG) return; crossG = g;
      const l = Math.round(9 * size), w = size > 1.6 ? 3 : 2;
      for (let n = 0; n < 4; n++) { const s = crossI[n].style, x = n === 0 ? -1 : n === 1 ? 1 : 0, y = n === 2 ? -1 : n === 3 ? 1 : 0; s.width = (x ? l : w) + 'px'; s.height = (y ? l : w) + 'px'; s.left = (x < 0 ? -g - l : x > 0 ? g : -w / 2) + 'px'; s.top = (y < 0 ? -g - l : y > 0 ? g : -w / 2) + 'px'; }
      if (el.cross._ring) { const d = (g + 5) * 2; crossRing.style.width = crossRing.style.height = d + 'px'; crossRing.style.margin = (-d / 2 - 1) + 'px'; }
    },
    hitMarker(head) { if (settings.get('gameplay.hitMarkers') === false) return; hitT = 0.16; sw(el.hit, 'filter', head ? 'sepia(1) saturate(9) hue-rotate(-40deg)' : 'none'); },
    /** rel = angle of the attacker relative to the view (0 = ahead, clockwise, radians); null for no direction. */
    hurt(rel) { hurtT = 0.45; if (rel === null || rel === undefined || !isFinite(rel)) return; const i = dmgN; dmgN = (dmgN + 1) % 4; dmgT[i] = 1.1; dmgA[i] = rel; dmgI[i].style.transform = `rotate(${rel.toFixed(3)}rad)`; },
    damageNumber(sx, sy, amount, head) { if (!settings.get('gameplay.damageNumbers')) return; const q = nums[numI]; numI = (numI + 1) % nums.length; q.t = 0.7; q.x = sx; q.y = sy; q.d.textContent = String(Math.round(amount)); q.d.style.color = head ? 'var(--amber)' : '#fff'; },
    scope(on) { sw(el.scope, 'opacity', on ? 1 : 0); },
    hint(text) { tx(el.hint, text || ''); vis(el.hint, !!text); },
    spectate(text) { tx(el.spec, text || ''); vis(el.spec, !!text); },
    fps(text) { vis(el.fps, text !== null); if (text !== null) tx(el.fps, text); },
    lockTip(text) { vis(el.lock, !!text); if (text) tx(el.lock, text); },
    loading(on) { vis(el.load, !!on); if (on) tx(el.load, t('loading')); },
    pause(on) { vis(el.pause, on); if (!on) closeSettings(); },
    get settingsOpen() { return !!unmount; },
    board(on, def) { if (on !== boardOn) { boardOn = on; vis(el.board, on); boardT = 0; } if (on && clock >= boardT) { boardT = clock + 0.5; drawBoard(def); } },
    /** Per-frame fades (cheap). */
    frame(dt) {
      clock += dt;
      if (hitT > 0) { hitT = Math.max(0, hitT - dt); } sw(el.hit, 'opacity', hitT > 0 ? 1 : 0);
      hurtT = Math.max(0, hurtT - dt); sw(el.vig, 'opacity', Math.round(Math.min(1, Math.max(hurtT * 1.6, lowHp ? 0.55 : 0, deadV ? 0.9 : 0)) * 20) / 20);
      if (msgT > 0) { msgT = Math.max(0, msgT - dt); sw(el.msg, 'opacity', Math.round(Math.min(1, msgT * 3) * 10) / 10); if (msgT === 0) vis(el.msg, false); }
      for (let i = 0; i < 4; i++) { if (dmgT[i] <= 0) continue; dmgT[i] = Math.max(0, dmgT[i] - dt); sw(dmgI[i], 'opacity', Math.round(Math.min(1, dmgT[i] * 1.6) * 10) / 10); }
      for (const q of nums) { if (q.t <= 0) continue; q.t = Math.max(0, q.t - dt); q.y -= dt * 46; q.d.style.transform = `translate(${Math.round(q.x)}px,${Math.round(q.y)}px)`; q.d.style.opacity = Math.min(1, q.t * 3).toFixed(2); }
      while (feedItems.length && feedItems[feedItems.length - 1].t < clock) feedItems.pop().d.remove();
      if (earnT > 0) { earnT -= dt; if (earnT <= 0) sw(earnS, 'opacity', 0); }
    },
    /** World-space markers: project and clamp to the screen edges. */
    markersFrame(camera, w, h, px, py, pz) {
      if (!markers.size) return;
      for (const k of markers.values()) {
        const m = k.m; v3.set(m.x, (m.y || 0) + (m.small ? 0 : 1.2), m.z); const dist = Math.hypot(m.x - px, (m.y || 0) - py, m.z - pz);
        v3.applyMatrix4(camera.matrixWorldInverse); const behind = v3.z > -0.1; v3.applyMatrix4(camera.projectionMatrix);
        let x = v3.x, y = v3.y;
        if (behind) { if (m.small) { sw(k.d, 'display', 'none'); continue; } x = -x; y = -1; const s = Math.max(Math.abs(x), 0.001); if (s < 1) x = x / s; }
        if (m.small && (Math.abs(x) > 1 || Math.abs(y) > 1 || dist > 70)) { sw(k.d, 'display', 'none'); continue; }
        x = Math.max(-0.94, Math.min(0.94, x)); y = Math.max(-0.86, Math.min(0.86, y));
        const sx = Math.round((x * 0.5 + 0.5) * w), sy = Math.round((-y * 0.5 + 0.5) * h);
        sw(k.d, 'display', ''); if (k.sx !== sx || k.sy !== sy) { k.sx = sx; k.sy = sy; k.d.style.transform = `translate(${sx}px,${sy}px)`; }
        tx(k.dist, m.small ? '' : Math.round(dist) + ' m');
      }
    },
    /** Pre-render the minimap background for the loaded map. */
    setMap(solids, size) {
      const s = 170; mapS = size; mapK = s / (size * 2 + 2.4); mapBg = document.createElement('canvas'); mapBg.width = mapBg.height = s;
      const m = mapBg.getContext('2d'), X = v => (v + size + 1.2) * mapK;
      m.fillStyle = 'rgba(216,201,163,.28)';
      for (const c of solids) { if (c.y0 > 0.6 || c.y1 - c.y0 < 0.7 || (c.x1 - c.x0 > size * 1.6 && c.z1 - c.z0 > size * 1.6)) continue; m.fillRect(X(c.x0), X(c.z0), Math.max(1, (c.x1 - c.x0) * mapK), Math.max(1, (c.z1 - c.z0) * mapK)); }
    },
    /** Minimap: actors (typed by the callback), markers and the player arrow. */
    drawMap(player, actors, classify) {
      const on = settings.get('gameplay.minimap') !== false; vis(el.map, on); if (!on || !mapBg) return;
      const s = 170, X = v => (v + mapS + 1.2) * mapK; mc.clearRect(0, 0, s, s); mc.drawImage(mapBg, 0, 0);
      for (const k of markers.values()) { const m = k.m; if (m.small) continue; mc.strokeStyle = mc.fillStyle = m.color || '#e8a628'; mc.lineWidth = 2; mc.beginPath(); mc.arc(X(m.x), X(m.z), 6, 0, 7); mc.stroke(); if (m.label) { mc.font = '700 10px sans-serif'; mc.textAlign = 'center'; mc.textBaseline = 'middle'; mc.fillText(String(m.label).slice(0, 2), X(m.x), X(m.z) + 0.5); } }
      for (let i = 0; i < actors.length; i++) { const a = actors[i]; if (a === player || !a.alive) continue; const c = classify(a); if (!c) continue; mc.fillStyle = c; mc.beginPath(); mc.arc(X(a.pos.x), X(a.pos.z), 3, 0, 7); mc.fill(); }
      mc.save(); mc.translate(X(player.pos.x), X(player.pos.z)); mc.rotate(-player.yaw); mc.fillStyle = '#e8a628'; mc.beginPath(); mc.moveTo(0, -7); mc.lineTo(5, 5); mc.lineTo(-5, 5); mc.fill(); mc.restore();
    },
  };
}
