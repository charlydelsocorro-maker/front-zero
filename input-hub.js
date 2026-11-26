// FRONT ZÉRO — touch screens and gamepads (loaded by main.js; a failure leaves mouse and keyboard exactly as they were).
// This hub owns: the input store (localStorage 'frontzero.input'), the device modes (html.fzin-touch / html.fzin-pad), the aim assist
// (touch and gamepad only, never the mouse), haptics, the settings rows (Commandes tab), button glyphs in prompts, the Mobile preset on the
// first visit from a phone, fullscreen and orientation, and the "turn your phone" prompt. input-touch.js (on-screen controls, layout editor)
// and input-pad.js (Gamepad API, menu navigation) are imported only when a touch screen or a gamepad is actually there.
// Engine hooks used (game.js): E.input.axis (analog move), E.input.set/held, E.on('input') (before the player moves), E.internals.P / camera.
import { installMobileUi } from './mobile-ui.js';

const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const KEY = 'frontzero.input';
/* Gamepad actions (input-pad.js), in the order of the remapping list. 'use' = reload, or interact when a prompt is on screen. */
export const PAD_ACTIONS = ['fire', 'aim', 'jump', 'crouch', 'use', 'nextWeapon', 'grenade', 'tactical', 'medical', 'flashlight', 'sprint', 'inspect', 'weapon1', 'weapon2', 'scoreboard', 'pause'];
/* Standard mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back/View, 9 Start, 10 L3, 11 R3, 12 up, 13 down, 14 left, 15 right. */
export const PAD_DEFAULT = { fire: 7, aim: 6, jump: 0, crouch: 1, use: 2, nextWeapon: 3, grenade: 4, tactical: 5, medical: 13, flashlight: 12, sprint: 10, inspect: 11, weapon1: 14, weapon2: 15, scoreboard: 8, pause: 9 };
const DEF = {
  touch: { mode: 'auto', sens: 1, accel: 0.5, ads: 0.75, holdFire: true, aimHold: false, assist: true, haptics: true, fullscreen: true, alpha: 0.85, layout: {} },
  pad: { sens: 1, ads: 0.6, invert: false, dead: 0.15, curve: 'std', assist: true, rumble: true, map: {} },
  auto: { preset: false },
};
const LOC = {       // fr, en, es, de, pt, it
  touchGroup: ['Écran tactile', 'Touch screen', 'Pantalla táctil', 'Touchscreen', 'Ecrã tátil', 'Schermo touch'],
  touchMode: ['Commandes tactiles', 'Touch controls', 'Controles táctiles', 'Touch-Steuerung', 'Controlos táteis', 'Comandi touch'],
  touchModeHint: ['Auto : affichées sur téléphone et tablette.', 'Auto: shown on phones and tablets.', 'Auto: en móviles y tabletas.', 'Auto: auf Handy und Tablet.', 'Auto: em telemóveis e tablets.', 'Auto: su telefoni e tablet.'],
  auto: ['Auto', 'Auto', 'Auto', 'Auto', 'Auto', 'Auto'],
  on: ['Activées', 'On', 'Activados', 'An', 'Ativados', 'Attivi'],
  off: ['Désactivées', 'Off', 'Desactivados', 'Aus', 'Desativados', 'Disattivi'],
  lookSens: ['Sensibilité de la visée', 'Look sensitivity', 'Sensibilidad de la vista', 'Blickempfindlichkeit', 'Sensibilidade da mira', 'Sensibilità visuale'],
  accel: ['Accélération des gestes rapides', 'Fast swipe acceleration', 'Aceleración de gestos rápidos', 'Beschleunigung schneller Wischer', 'Aceleração dos gestos rápidos', 'Accelerazione gesti rapidi'],
  adsSens: ['Sensibilité en visée', 'Aiming sensitivity', 'Sensibilidad apuntando', 'Empfindlichkeit beim Zielen', 'Sensibilidade a apontar', 'Sensibilità in mira'],
  holdFire: ['Tir en maintenant le doigt à droite', 'Fire by holding on the right side', 'Disparar manteniendo el dedo a la derecha', 'Feuern durch Halten rechts', 'Disparar mantendo o dedo à direita', 'Fuoco tenendo premuto a destra'],
  holdFireHint: ['Un doigt posé et immobile une fraction de seconde fait feu, puis vise en glissant.', 'A finger held still for a moment fires, then aims as it slides.', 'Un dedo quieto un instante dispara y luego apunta al deslizar.', 'Ein kurz ruhiger Finger feuert und zielt dann beim Wischen.', 'Um dedo parado um instante dispara e depois aponta ao deslizar.', 'Un dito fermo per un attimo spara, poi mira scorrendo.'],
  aimMode: ['Bouton de visée', 'Aim button', 'Botón de apuntar', 'Zielknopf', 'Botão de apontar', 'Pulsante mira'],
  aimToggle: ['Appui (bascule)', 'Tap (toggle)', 'Toque (alterna)', 'Tippen (umschalten)', 'Toque (alterna)', 'Tocco (alterna)'],
  aimHold: ['Maintien', 'Hold', 'Mantener', 'Halten', 'Manter', 'Tieni premuto'],
  assist: ['Assistance de visée', 'Aim assist', 'Asistencia de apuntado', 'Zielhilfe', 'Assistência de mira', 'Mira assistita'],
  assistHintT: ['Ralentit un peu la visée sur une cible. Jamais de visée automatique, jamais à la souris.', 'Slightly slows aiming over a target. Never aims for you, never with a mouse.', 'Frena un poco la mira sobre un objetivo. Nunca apunta sola, nunca con ratón.', 'Bremst das Zielen über einem Gegner leicht. Zielt nie selbst, nie mit Maus.', 'Abranda um pouco a mira sobre um alvo. Nunca aponta sozinha, nunca com rato.', 'Rallenta un po’ la mira su un bersaglio. Mai mira automatica, mai col mouse.'],
  haptics: ['Vibrations', 'Vibration', 'Vibración', 'Vibration', 'Vibração', 'Vibrazione'],
  hapticsHint: ['Touche et élimination (si le téléphone le permet).', 'Hits and eliminations (where the phone allows it).', 'Impactos y eliminaciones (si el móvil lo permite).', 'Treffer und Eliminierungen (wenn das Gerät es kann).', 'Impactos e eliminações (se o telemóvel permitir).', 'Colpi ed eliminazioni (se il telefono lo consente).'],
  fullscreen: ['Plein écran automatique', 'Automatic fullscreen', 'Pantalla completa automática', 'Automatisch Vollbild', 'Ecrã inteiro automático', 'Schermo intero automatico'],
  fsEnter: ['Plein écran', 'Fullscreen', 'Pantalla completa', 'Vollbild', 'Ecrã inteiro', 'Schermo intero'],
  fsExit: ['Quitter le plein écran', 'Exit fullscreen', 'Salir de pantalla completa', 'Vollbild beenden', 'Sair do ecrã inteiro', 'Esci da schermo intero'],
  fsIosT: ['Plein écran sur iPhone', 'Fullscreen on iPhone', 'Pantalla completa en iPhone', 'Vollbild auf dem iPhone', 'Ecrã inteiro no iPhone', 'Schermo intero su iPhone'],
  fsIosB: ['Touche Partager, puis « Sur l’écran d’accueil ». Lance ensuite le jeu depuis cette icône : il s’ouvre en plein écran.', 'Tap Share, then “Add to Home Screen”. Start the game from that icon: it opens fullscreen.', 'Toca Compartir y luego «Añadir a pantalla de inicio». Abre el juego desde ese icono: se abre a pantalla completa.', 'Tippe auf Teilen, dann „Zum Home-Bildschirm“. Starte das Spiel über dieses Symbol: Es öffnet sich im Vollbild.', 'Toca em Partilhar e depois «Adicionar ao ecrã principal». Abre o jogo a partir desse ícone: abre em ecrã inteiro.', 'Tocca Condividi, poi «Aggiungi alla schermata Home». Avvia il gioco da quell’icona: si apre a schermo intero.'],
  fsClose: ['Fermer', 'Close', 'Cerrar', 'Schließen', 'Fechar', 'Chiudi'],
  opacity: ['Opacité des boutons', 'Button opacity', 'Opacidad de los botones', 'Deckkraft der Tasten', 'Opacidade dos botões', 'Opacità dei pulsanti'],
  layout: ['Disposition des boutons', 'Button layout', 'Disposición de botones', 'Tastenanordnung', 'Disposição dos botões', 'Disposizione pulsanti'],
  layoutHint: ['Déplacer, agrandir, rendre plus ou moins visibles.', 'Move, resize and fade them.', 'Mover, agrandar y atenuar.', 'Verschieben, vergrößern, abblenden.', 'Mover, aumentar e atenuar.', 'Sposta, ridimensiona, attenua.'],
  edit: ['Modifier', 'Edit', 'Editar', 'Bearbeiten', 'Editar', 'Modifica'],
  padGroup: ['Manette', 'Controller', 'Mando', 'Controller', 'Comando', 'Controller'],
  padNone: ['Aucune manette détectée : branche-la et appuie sur un bouton.', 'No controller found: plug it in and press a button.', 'Ningún mando detectado: conéctalo y pulsa un botón.', 'Kein Controller erkannt: anschließen und eine Taste drücken.', 'Nenhum comando detetado: liga-o e carrega num botão.', 'Nessun controller: collegalo e premi un tasto.'],
  padOn: ['Manette connectée', 'Controller connected', 'Mando conectado', 'Controller verbunden', 'Comando ligado', 'Controller collegato'],
  padSens: ['Sensibilité du stick droit', 'Right stick sensitivity', 'Sensibilidad del stick derecho', 'Empfindlichkeit rechter Stick', 'Sensibilidade do analógico direito', 'Sensibilità stick destro'],
  invert: ['Inverser l’axe vertical', 'Invert vertical axis', 'Invertir eje vertical', 'Vertikale Achse umkehren', 'Inverter eixo vertical', 'Inverti asse verticale'],
  dead: ['Zone morte des sticks', 'Stick deadzone', 'Zona muerta de los sticks', 'Stick-Totzone', 'Zona morta dos analógicos', 'Zona morta stick'],
  curve: ['Courbe de réponse', 'Response curve', 'Curva de respuesta', 'Reaktionskurve', 'Curva de resposta', 'Curva di risposta'],
  curveLin: ['Linéaire', 'Linear', 'Lineal', 'Linear', 'Linear', 'Lineare'],
  curveStd: ['Classique', 'Standard', 'Clásica', 'Standard', 'Clássica', 'Classica'],
  curveFine: ['Précise', 'Precise', 'Precisa', 'Präzise', 'Precisa', 'Precisa'],
  rumble: ['Vibrations de la manette', 'Controller rumble', 'Vibración del mando', 'Controller-Vibration', 'Vibração do comando', 'Vibrazione controller'],
  remap: ['Boutons de la manette', 'Controller buttons', 'Botones del mando', 'Controller-Tasten', 'Botões do comando', 'Pulsanti controller'],
  remapHint: ['Choisis une action puis appuie sur le bouton voulu.', 'Pick an action, then press the button you want.', 'Elige una acción y pulsa el botón deseado.', 'Aktion wählen, dann gewünschte Taste drücken.', 'Escolhe uma ação e carrega no botão pretendido.', 'Scegli un’azione e premi il pulsante voluto.'],
  press: ['Appuie sur un bouton…', 'Press a button…', 'Pulsa un botón…', 'Taste drücken…', 'Carrega num botão…', 'Premi un pulsante…'],
  resetPad: ['Boutons par défaut', 'Default buttons', 'Botones por defecto', 'Standardtasten', 'Botões predefinidos', 'Pulsanti predefiniti'],
  'act.use': ['Recharger / utiliser', 'Reload / use', 'Recargar / usar', 'Nachladen / benutzen', 'Recarregar / usar', 'Ricarica / usa'],
  'act.crouch': ['S’accroupir / glisser', 'Crouch / slide', 'Agacharse / deslizarse', 'Ducken / rutschen', 'Agachar / deslizar', 'Accovacciati / scivola'],
  rotateT: ['Tourne ton téléphone', 'Turn your phone', 'Gira tu móvil', 'Dreh dein Handy', 'Roda o telemóvel', 'Ruota il telefono'],
  rotateB: ['FRONT ZÉRO se joue à l’horizontale.', 'FRONT ZÉRO is played in landscape.', 'FRONT ZÉRO se juega en horizontal.', 'FRONT ZÉRO wird im Querformat gespielt.', 'FRONT ZÉRO joga-se na horizontal.', 'FRONT ZÉRO si gioca in orizzontale.'],
  rotatePaused: ['Partie en pause.', 'Match paused.', 'Partida en pausa.', 'Spiel pausiert.', 'Partida em pausa.', 'Partita in pausa.'],
  mobileOn: ['Graphismes : préréglage « Mobile »', 'Graphics: “Mobile” preset', 'Gráficos: ajuste «Móvil»', 'Grafik: Voreinstellung „Mobil“', 'Gráficos: predefinição «Telemóvel»', 'Grafica: preset «Mobile»'],
};
const clampN = (v, a, b, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);

function loadStore() {
  let raw = null; try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  const s = JSON.parse(JSON.stringify(DEF)), r = raw && typeof raw === 'object' ? raw : {};
  const t = r.touch || {}, p = r.pad || {};
  s.touch.mode = ['auto', 'on', 'off'].includes(t.mode) ? t.mode : 'auto';
  s.touch.sens = clampN(t.sens, 0.2, 3, 1); s.touch.accel = clampN(t.accel, 0, 1, 0.5); s.touch.ads = clampN(t.ads, 0.2, 1.5, 0.75); s.touch.alpha = clampN(t.alpha, 0.2, 1, 0.85);
  for (const k of ['holdFire', 'aimHold', 'assist', 'haptics', 'fullscreen']) if (typeof t[k] === 'boolean') s.touch[k] = t[k];
  if (t.layout && typeof t.layout === 'object') for (const [id, v] of Object.entries(t.layout)) if (Array.isArray(v) && v.length === 4 && v.every(n => typeof n === 'number' && Number.isFinite(n))) s.touch.layout[id] = [clampN(v[0], 0, 1, 0.5), clampN(v[1], 0, 1, 0.5), clampN(v[2], 0.5, 1.8, 1), clampN(v[3], 0.15, 1, 1)];
  s.pad.sens = clampN(p.sens, 0.2, 3, 1); s.pad.ads = clampN(p.ads, 0.2, 1.5, 0.6); s.pad.dead = clampN(p.dead, 0.04, 0.4, 0.15);
  s.pad.curve = ['lin', 'std', 'fine'].includes(p.curve) ? p.curve : 'std';
  for (const k of ['invert', 'assist', 'rumble']) if (typeof p[k] === 'boolean') s.pad[k] = p[k];
  if (p.map && typeof p.map === 'object') for (const a of PAD_ACTIONS) if (Number.isInteger(p.map[a]) && p.map[a] >= 0 && p.map[a] < 17) s.pad.map[a] = p.map[a];
  s.auto.preset = !!(r.auto && r.auto.preset);
  return s;
}

export function install({ engine: E, settings, i18n, profile, menu, menuRoot, hudRoot }) {
  if (!E || !settings) return null;
  const html = document.documentElement;
  const store = loadStore();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage unavailable */ } };
  const li = () => { const i = LANGS.indexOf(i18n && i18n.lang); return i < 0 ? 0 : i; };
  const L = k => (LOC[k] ? LOC[k][li()] || LOC[k][0] : k);
  const listeners = new Set(), changed = what => { for (const f of listeners) { try { f(what); } catch (e) { console.warn('[input]', e); } } };
  const coarse = matchMedia('(pointer: coarse)');
  const isTouchDevice = () => coarse.matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);

  const ctx = {
    E, settings, i18n, profile, menu, menuRoot, hudRoot, store, save, L, LANGS, li, PAD_ACTIONS, PAD_DEFAULT,
    touchOn: false, padActive: false, touch: null, pad: null,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    changed,
    online: () => !!(E.cfg && E.cfg.online),
    inMatch: () => !!(E.running && !E.loading),
  };

  /* ---------- device modes ---------- */
  let sawTouch = false, lastTouchT = -1e9;
  const touchWanted = () => store.touch.mode === 'on' || (store.touch.mode === 'auto' && (isTouchDevice() || sawTouch));
  let touchLoad = null;
  function applyTouch() {
    const on = touchWanted();
    if (on && !ctx.touch && !touchLoad) touchLoad = import('./input-touch.js').then(m => { ctx.touch = m.createTouch(ctx); applyTouch(); }).catch(e => { console.warn('[input] touch controls unavailable', e); });
    if (ctx.touchOn === on) return;
    ctx.touchOn = on; html.classList.toggle('fzin-touch', on); suppressLock(); glyphsChanged(); changed('touch');
    if (ctx.touch) ctx.touch.refresh();
  }
  addEventListener('touchstart', () => { lastTouchT = performance.now(); if (!sawTouch && store.touch.mode === 'auto') { sawTouch = true; applyTouch(); } if (ctx.padActive) setPadActive(false); }, { capture: true, passive: true });
  // a real mouse (not one emulated after a touch) brings a touch laptop back to mouse and keyboard
  addEventListener('mousedown', e => { if (performance.now() - lastTouchT < 1200 || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents)) return; if (sawTouch && !isTouchDevice()) { sawTouch = false; applyTouch(); } }, true);
  try { coarse.addEventListener('change', applyTouch); } catch { /* old Safari */ }

  let padLoad = null;
  function loadPad() {
    if (ctx.pad || padLoad) return padLoad;
    padLoad = import('./input-pad.js').then(m => { ctx.pad = m.createPad(ctx); changed('pad'); return ctx.pad; }).catch(e => { console.warn('[input] gamepad unavailable', e); padLoad = null; return null; });
    return padLoad;
  }
  ctx.loadPad = loadPad;
  addEventListener('gamepadconnected', () => loadPad());
  try { const g = navigator.getGamepads ? navigator.getGamepads() : []; if (g && [...g].some(Boolean)) loadPad(); } catch { /* blocked by a permissions policy */ }
  function setPadActive(on) {
    on = !!on; if (ctx.padActive === on) return;
    ctx.padActive = on; html.classList.toggle('fzin-pad', on); suppressLock(); glyphsChanged(); changed('padActive');
    if (on) { try { document.documentElement.dispatchEvent(new MouseEvent('mouseleave')); } catch { /* the engine's edge turning only listens to this */ } }
  }
  ctx.setPadActive = setPadActive;
  // the mouse or the keyboard takes over again: keyboard glyphs and pointer lock come back
  addEventListener('mousemove', e => { if (ctx.padActive && (Math.abs(e.movementX) + Math.abs(e.movementY) > 6)) setPadActive(false); }, { passive: true });
  addEventListener('keydown', e => { if (ctx.padActive && !e.__fzPad) setPadActive(false); }, true);

  /* no pointer lock with a touch screen or a gamepad: it would only fail ("mouse not captured") or grab a cursor nobody uses */
  const canvas = document.getElementById('c');
  function suppressLock() {
    if (!canvas) return;
    const want = ctx.touchOn || ctx.padActive, has = Object.prototype.hasOwnProperty.call(canvas, 'requestPointerLock');
    if (want && !has) canvas.requestPointerLock = function () { return Promise.resolve(); };
    else if (!want && has) delete canvas.requestPointerLock;
  }

  /* ---------- glyphs in prompts: settings.keyLabel answers with the gamepad button (or the touch "use" mark) ---------- */
  const origKeyLabel = settings.keyLabel;
  const bindRows = document.getElementsByClassName('fzs-key');      // the key-binding list of the settings screen keeps keyboard names
  let glyphGen = 0;
  function glyphsChanged() { glyphGen++; try { window.dispatchEvent(new Event('fz-keys')); } catch { /* old browser */ } try { E.internals.hud.invalidate(); } catch { /* optional */ } }
  if (typeof origKeyLabel === 'function') {
    settings.keyLabel = code => {
      try {
        if ((ctx.padActive || ctx.touchOn) && !bindRows.length) {
          const action = settings.action(code);
          if (action) {
            if (ctx.padActive && ctx.pad) { const g = ctx.pad.glyphForAction(action); if (g) return g; }
            else if (ctx.touchOn && action === 'interact') return '◎';
          }
        }
      } catch { /* fall back to the key name */ }
      return origKeyLabel(code);
    };
  }

  /* ---------- aim assist: a modest slowdown of the look speed over an enemy, never a pull (touch and gamepad only) ---------- */
  let aaRaw = 1, aaF = 1, aaT = 0;
  const STRENGTH = { touch: 0.36, pad: 0.42 };
  function assistScan() {
    aaRaw = 1;
    const P = E.player, I = E.internals, cam = I && I.camera; if (!P || !P.alive || !cam) return;
    const m = cam.matrixWorld.elements, fx = -m[8], fy = -m[9], fz = -m[10], cx = m[12], cy = m[13], cz = m[14];
    let best = 9, tx = 0, ty = 0, tz = 0;
    for (let i = 0; i < E.actors.length; i++) {
      const a = E.actors[i]; if (a === P || !a.alive || a.ghost || !E.isEnemy(P, a)) continue;
      const ay = a.pos.y + (a.crouch ? 0.85 : 1.25), dx = a.pos.x - cx, dy = ay - cy, dz = a.pos.z - cz, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 0.6 || d > 75) continue;
      const dot = (dx * fx + dy * fy + dz * fz) / d; if (dot < 0.94) continue;
      const r = Math.acos(Math.min(1, dot)) / (Math.atan(0.45 / d) + 0.01);      // angle over the body's half-width seen from here
      if (r < best) { best = r; tx = a.pos.x; ty = ay; tz = a.pos.z; }
    }
    if (best > 2.4) return;
    try { if (!E.los(cx, cy, cz, tx, ty, tz)) return; } catch { return; }
    aaRaw = best <= 1 ? 0 : (best - 1) / 1.4;       // 0 = on the body, 1 = out of reach
  }
  E.on('tick', dt => {
    if (!(ctx.touchOn || ctx.padActive)) { aaF = 1; return; }
    aaT -= dt; if (aaT <= 0) { aaT = 0.05; assistScan(); }
    aaF += (aaRaw - aaF) * Math.min(1, dt * 14);
  });
  /** look-speed factor for 'touch' or 'pad' (1 = none): only with that device, only when its setting is on */
  ctx.assist = kind => { const on = kind === 'pad' ? store.pad.assist : store.touch.assist; if (!on) return 1; return 1 - STRENGTH[kind] * (1 - aaF); };

  /* ---------- haptics ---------- */
  let buzzT = 0;
  function buzz(kind) {
    const now = performance.now(); if (now - buzzT < (kind === 'kill' ? 0 : 70)) return; buzzT = now;
    if (ctx.touchOn && store.touch.haptics && navigator.vibrate) { try { navigator.vibrate(kind === 'kill' ? [18, 45, 28] : kind === 'hurt' ? 22 : 9); } catch { /* not allowed */ } }
    if (ctx.padActive && store.pad.rumble && ctx.pad) ctx.pad.rumble(kind);
  }
  E.on('damage', e => { if (!e || !E.player) return; if (e.attacker === E.player && e.victim !== E.player) buzz('hit'); else if (e.victim === E.player && e.amount > 0) buzz('hurt'); });
  E.on('kill', e => { if (e && e.killer === E.player && e.victim !== E.player) buzz('kill'); });

  /* ---------- "Mobile" preset, once, on the first visit from a phone or tablet ---------- */
  if (!store.auto.preset && isTouchDevice()) {
    store.auto.preset = true; save();
    try { if (settings.get('graphics.preset') === 'eleve') { settings.set('graphics.preset', 'mobile'); ctx.presetPicked = true; } } catch (e) { console.warn('[input] mobile preset', e); }
  }

  /* ---------- fullscreen and orientation ---------- */
  const standalone = () => { try { return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
  const fsOk = () => !!(document.fullscreenEnabled && html.requestFullscreen);
  function lockLandscape() { try { if (document.fullscreenElement && screen.orientation && screen.orientation.lock && (E.running || E.loading)) screen.orientation.lock('landscape').catch(() => {}); } catch { /* not allowed here */ } }
  /** called from a user gesture (a deploy tap, the first touch in a match) */
  ctx.fsGesture = () => {
    if (!ctx.touchOn || !store.touch.fullscreen || standalone() || !fsOk() || document.fullscreenElement) return;
    try { const p = html.requestFullscreen({ navigationUI: 'hide' }); if (p && p.then) p.then(lockLandscape, () => {}); } catch { /* refused */ }
  };
  document.addEventListener('click', e => { const t = e.target; if (t && t.closest && t.closest('.fzm-cta, .fzo-quick, [data-fid^="lobby:"], [data-fid^="multi:"], [data-fid="end:again"], .fzf-cta')) ctx.fsGesture(); }, true);
  E.on('matchStart', lockLandscape);
  const unlockOrient = () => { try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch { /* not locked */ } };
  E.on('matchEnd', unlockOrient); E.on('quit', unlockOrient);

  /* ---------- fullscreen button (phones and tablets): in the menus and the pause screen, never over a running match ---------- */
  const noFsApi = () => !fsOk() && /iP(hone|od)/.test(navigator.userAgent);       // iPhone Safari has no fullscreen for pages: the home-screen app is the way
  const FS_IN = '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>', FS_OUT = '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>';
  let fsBtn = null, fsTip = null;
  function fsTipShow(on) {
    if (on && !fsTip) {
      fsTip = document.createElement('div'); fsTip.id = 'fzin-fstip'; fsTip.setAttribute('role', 'dialog');
      fsTip.innerHTML = '<b></b><span></span><button type="button" class="fzin-fsx">×</button>'; document.body.appendChild(fsTip);
      fsTip.querySelector('button').addEventListener('click', e => { e.stopPropagation(); fsTipShow(false); });
    }
    if (!fsTip) return;
    if (on) {
      fsTip.querySelector('b').textContent = L('fsIosT'); fsTip.querySelector('span').textContent = L('fsIosB'); fsTip.querySelector('button').setAttribute('aria-label', L('fsClose'));
      const r = fsBtn && fsBtn.getBoundingClientRect(), top = fsBtn && fsBtn.classList.contains('in-top');       // under the button in the menu bar, above it in the pause screen
      fsTip.style.top = top ? Math.round(r.bottom + 8) + 'px' : ''; fsTip.style.bottom = top ? 'auto' : ''; fsTip.style.left = top ? 'auto' : ''; fsTip.style.right = top ? Math.max(10, Math.round(innerWidth - r.right)) + 'px' : '';
    }
    fsTip.hidden = !on;
  }
  /* in the menus the button sits in the top bar, after the credits and the account chip (the bar is redrawn: put it back each time) */
  function fsSlot() {
    if (!fsBtn) return;
    const id = !E.running && !E.loading && menuRoot && menuRoot.querySelector('.fzm-top .fzm-id');
    if (id) { if (fsBtn.parentElement !== id || fsBtn.nextElementSibling) id.append(fsBtn); fsBtn.classList.add('in-top'); }
    else { if (fsBtn.parentElement !== document.body) document.body.append(fsBtn); fsBtn.classList.remove('in-top'); }
  }
  let fsQ = false; const fsMo = new MutationObserver(() => { if (fsQ || !fsBtn || fsBtn.hidden) return; fsQ = true; queueMicrotask(() => { fsQ = false; fsSlot(); }); });
  if (menuRoot) fsMo.observe(menuRoot, { childList: true, subtree: true });
  function fsRefresh() {
    const inPlay = E.loading || (E.running && !E.paused);
    const installed = !document.fullscreenElement && standalone();       // (display-mode: fullscreen) also matches a page put in fullscreen by the button
    const want = ctx.touchOn && !installed && (fsOk() || noFsApi()) && !inPlay;
    if (want && !fsBtn) {
      fsBtn = document.createElement('button'); fsBtn.type = 'button'; fsBtn.id = 'fzin-fs';
      fsBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"></svg>';
      fsBtn.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        if (!fsOk()) { fsTipShow(!fsTip || fsTip.hidden); return; }
        try {
          if (document.fullscreenElement) { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); }
          else { const p = html.requestFullscreen({ navigationUI: 'hide' }); if (p && p.then) p.then(lockLandscape, () => {}); }
        } catch { /* refused */ }
      });
      document.body.appendChild(fsBtn);
    }
    if (!fsBtn) return;
    fsBtn.hidden = !want; if (!want) fsTipShow(false); else fsSlot();
    const full = !!document.fullscreenElement, lab = L(full ? 'fsExit' : 'fsEnter');
    fsBtn.querySelector('svg').innerHTML = full ? FS_OUT : FS_IN; fsBtn.setAttribute('aria-label', lab); fsBtn.title = lab;
  }
  document.addEventListener('fullscreenchange', fsRefresh);
  for (const ev of ['matchStart', 'matchEnd', 'quit', 'loading', 'pause']) E.on(ev, fsRefresh);
  ctx.on(fsRefresh); fsRefresh();

  /* ---------- "turn your phone": portrait during a match (solo pauses) ---------- */
  let rot = null;
  const portrait = matchMedia('(orientation: portrait)');
  function rotateCheck() {
    const want = ctx.touchOn && (E.running || E.loading) && portrait.matches && innerWidth < 900;
    if (want && !rot) {
      rot = document.createElement('div'); rot.id = 'fzin-rotate'; rot.setAttribute('role', 'alertdialog'); rot.setAttribute('aria-live', 'assertive');
      rot.innerHTML = '<div class="fzr-box"><svg class="fzr-ph" viewBox="0 0 64 64" aria-hidden="true"><rect x="20" y="6" width="24" height="44" rx="4"/><path d="M28 44h8"/><path class="fzr-arc" d="M50 30a20 20 0 0 1-16 20M46 50l-12 0 4-6"/></svg><b></b><span></span><small></small></div>';
      document.body.appendChild(rot);
    }
    if (rot) {
      rot.hidden = !want;
      if (want) {
        rot.querySelector('b').textContent = L('rotateT'); rot.querySelector('span').textContent = L('rotateB');
        const solo = !ctx.online();
        if (solo && E.running && !E.loading && !E.paused) { try { E.input.set('pause', true); E.input.set('pause', false); } catch { /* optional */ } }
        rot.querySelector('small').textContent = solo && E.paused ? L('rotatePaused') : '';
      }
    }
  }
  try { portrait.addEventListener('change', rotateCheck); } catch { /* old Safari */ }
  addEventListener('resize', rotateCheck);
  for (const ev of ['matchStart', 'matchEnd', 'quit', 'loading', 'pause']) E.on(ev, rotateCheck);
  ctx.on(rotateCheck);

  /* ---------- settings rows (Commandes tab): touch first on a phone, at the end elsewhere ---------- */
  const mkRow = (h, label, ctl, hint) => h('div', { class: 'fzs-row fzin-row' }, h('div', { class: 'fzs-label' }, label, hint ? h('small', { class: 'fzs-hint', text: hint }) : null), h('div', { class: 'fzs-ctl' }, ctl));
  const mkToggle = (h, t, get, set) => {
    const state = h('span', { text: t(get() ? 'common.on' : 'common.off') }), input = h('input', { type: 'checkbox', role: 'switch' });
    input.checked = !!get(); input.addEventListener('change', () => { set(!!input.checked); state.textContent = t(input.checked ? 'common.on' : 'common.off'); });
    return h('label', { class: 'fzs-switch' }, state, input, h('i', { 'aria-hidden': 'true' }));
  };
  const mkSlider = (h, get, set, min, max, step, fmt, label) => {
    const out = h('output', { class: 'fzs-out', text: fmt(get()) }), input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), 'aria-label': label });
    input.value = String(get()); input.addEventListener('input', () => { const v = Number(input.value); set(v); out.textContent = fmt(v); });
    return [input, out];
  };
  const mkSelect = (h, opts, get, set, label) => {
    const el = h('select', { 'aria-label': label }, opts.map(([v, txt]) => h('option', { value: v, text: txt }))); el.value = get();
    el.addEventListener('change', () => set(el.value)); return el;
  };
  const grp = (h, title, rows) => [h('h3', { class: 'fzs-h', text: title }), h('div', { class: 'fzs-group' }, rows)];
  const T = store.touch, PD = store.pad;
  const setT = (k, v) => { T[k] = v; save(); changed('touch.' + k); if (k === 'mode') applyTouch(); };
  const setP = (k, v) => { PD[k] = v; save(); changed('pad.' + k); };
  function touchRows({ t, h }) {
    const x = v => '×' + Number(v).toFixed(2), pc = v => Math.round(v * 100) + ' %';
    const edit = h('button', { type: 'button', class: 'fzs-mini fzin-edit', text: L('edit'), onclick: () => openEditor() });
    return grp(h, L('touchGroup'), [
      mkRow(h, L('touchMode'), mkSelect(h, [['auto', L('auto')], ['on', L('on')], ['off', L('off')]], () => T.mode, v => setT('mode', v), L('touchMode')), L('touchModeHint')),
      mkRow(h, L('lookSens'), mkSlider(h, () => T.sens, v => setT('sens', v), 0.2, 3, 0.05, x, L('lookSens'))),
      mkRow(h, L('accel'), mkSlider(h, () => T.accel, v => setT('accel', v), 0, 1, 0.05, pc, L('accel'))),
      mkRow(h, L('adsSens'), mkSlider(h, () => T.ads, v => setT('ads', v), 0.2, 1.5, 0.05, x, L('adsSens'))),
      mkRow(h, L('holdFire'), mkToggle(h, t, () => T.holdFire, v => setT('holdFire', v)), L('holdFireHint')),
      mkRow(h, L('aimMode'), mkSelect(h, [['toggle', L('aimToggle')], ['hold', L('aimHold')]], () => (T.aimHold ? 'hold' : 'toggle'), v => setT('aimHold', v === 'hold'), L('aimMode'))),
      mkRow(h, L('assist'), mkToggle(h, t, () => T.assist, v => setT('assist', v)), L('assistHintT')),
      mkRow(h, L('haptics'), mkToggle(h, t, () => T.haptics, v => setT('haptics', v)), L('hapticsHint')),
      mkRow(h, L('fullscreen'), mkToggle(h, t, () => T.fullscreen, v => setT('fullscreen', v))),
      mkRow(h, L('opacity'), mkSlider(h, () => T.alpha, v => setT('alpha', v), 0.2, 1, 0.05, pc, L('opacity'))),
      mkRow(h, L('layout'), edit, L('layoutHint')),
    ]);
  }
  function padRows({ t, h }) {
    const x = v => '×' + Number(v).toFixed(2), pc = v => Math.round(v * 100) + ' %';
    const status = h('small', { class: 'fzs-hint fzin-padst', text: ctx.pad && ctx.pad.connected() ? L('padOn') + ' · ' + ctx.pad.name() : L('padNone') });
    const rows = [
      h('div', { class: 'fzs-row fzin-row', style: 'grid-template-columns:minmax(0,1fr)' }, status),
      mkRow(h, L('padSens'), mkSlider(h, () => PD.sens, v => setP('sens', v), 0.2, 3, 0.05, x, L('padSens'))),
      mkRow(h, L('adsSens'), mkSlider(h, () => PD.ads, v => setP('ads', v), 0.2, 1.5, 0.05, x, L('adsSens'))),
      mkRow(h, L('invert'), mkToggle(h, t, () => PD.invert, v => setP('invert', v))),
      mkRow(h, L('dead'), mkSlider(h, () => PD.dead, v => setP('dead', v), 0.04, 0.4, 0.01, pc, L('dead'))),
      mkRow(h, L('curve'), mkSelect(h, [['lin', L('curveLin')], ['std', L('curveStd')], ['fine', L('curveFine')]], () => PD.curve, v => setP('curve', v), L('curve'))),
      mkRow(h, L('assist'), mkToggle(h, t, () => PD.assist, v => setP('assist', v)), L('assistHintT')),
      mkRow(h, L('rumble'), mkToggle(h, t, () => PD.rumble, v => setP('rumble', v))),
    ];
    const remap = [h('div', { class: 'fzs-row fzin-row', style: 'grid-template-columns:minmax(0,1fr)' }, h('small', { class: 'fzs-hint', text: L('remapHint') }))];
    const btns = new Map();
    const paint = () => { for (const [a, b] of btns) { const i = padButton(a); b.textContent = ctx.pad ? ctx.pad.glyphForButton(i) : glyphFallback(i); b.className = 'fzs-key fzin-glyph'; } };
    for (const a of PAD_ACTIONS) {
      const b = h('button', { type: 'button', class: 'fzs-key fzin-glyph', 'data-pad-action': a });
      b.addEventListener('click', async () => {
        const pad = await loadPad(); if (!pad) return;
        b.textContent = L('press'); b.className = 'fzs-key fzin-glyph is-capture';
        pad.capture(i => { if (i !== null) assignPad(a, i); paint(); });
      });
      btns.set(a, b);
      const lab = LOC['act.' + a] ? L('act.' + a) : t('action.' + a);
      remap.push(mkRow(h, lab, h('div', { class: 'fzs-bind' }, b)));
    }
    remap.push(h('div', { class: 'fzs-row fzin-row', style: 'grid-template-columns:minmax(0,1fr)' }, h('button', { type: 'button', class: 'fzs-mini', text: L('resetPad'), onclick: () => { PD.map = {}; save(); changed('pad.map'); glyphsChanged(); paint(); } })));
    paint();
    const off = ctx.on(w => { if (w === 'pad' || w === 'padConn') status.textContent = ctx.pad && ctx.pad.connected() ? L('padOn') + ' · ' + ctx.pad.name() : L('padNone'); if (!status.isConnected) off(); });
    return [...grp(h, L('padGroup'), rows), ...grp(h, L('remap'), remap)];
  }
  const GLYPH_STD = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', '⧉', '≡', 'L3', 'R3', '↑', '↓', '←', '→', '◉'];
  const glyphFallback = i => GLYPH_STD[i] || '?';
  const padButton = a => (Number.isInteger(PD.map[a]) ? PD.map[a] : PAD_DEFAULT[a]);
  ctx.padButton = padButton;
  function assignPad(action, btn) {
    const cur = padButton(action);
    for (const a of PAD_ACTIONS) if (a !== action && padButton(a) === btn) PD.map[a] = cur;      // swap with the action that had it
    PD.map[action] = btn; save(); changed('pad.map'); glyphsChanged();
  }
  ctx.glyphFallback = glyphFallback;
  const sections = o => [...touchRows(o), ...padRows(o)];
  if (typeof settings.addPart === 'function') {
    settings.addPart('keys:top', o => (ctx.touchOn || ctx.padActive ? sections(o) : []));
    settings.addPart('keys', o => (ctx.touchOn || ctx.padActive ? [] : sections(o)));
  }
  async function openEditor() {
    try { if (!ctx.touch) { const m = await import('./input-touch.js'); ctx.touch = m.createTouch(ctx); } ctx.touch.openEditor(); } catch (e) { console.warn('[input] layout editor', e); }
  }
  ctx.openEditor = openEditor;

  /* ---------- styles shared by both devices ---------- */
  const st = document.createElement('style'); st.id = 'fzin-style';
  st.textContent = `
#fzin-rotate{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(120% 90% at 50% 100%,rgba(232,166,40,.12),transparent 60%),#0b0d09;color:#d8c9a3;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;text-align:center;touch-action:none;user-select:none;-webkit-user-select:none}
#fzin-rotate[hidden]{display:none}
#fzin-rotate .fzr-box{display:grid;justify-items:center;gap:10px;max-width:320px}
#fzin-rotate .fzr-ph{width:96px;height:96px;fill:none;stroke:#e8a628;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;animation:fzr-turn 2.4s ease-in-out infinite;transform-origin:32px 28px}
#fzin-rotate .fzr-arc{stroke:#f4ecd8;opacity:.75}
#fzin-rotate b{font-size:30px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#f4ecd8;line-height:1}
#fzin-rotate span{font-size:19px;line-height:1.25}
#fzin-rotate small{font-size:16px;letter-spacing:.08em;text-transform:uppercase;color:#e8a628;min-height:1em}
@keyframes fzr-turn{0%,30%{transform:rotate(0)}55%,85%{transform:rotate(-90deg)}100%{transform:rotate(0)}}
@media(prefers-reduced-motion:reduce){#fzin-rotate .fzr-ph{animation:none;transform:rotate(-90deg)}}
html.fzin-touch #hud [data-h="lock"],html.fzin-pad #hud [data-h="lock"]{display:none!important}
#fzin-fs{position:fixed;left:calc(10px + env(safe-area-inset-left,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:60;width:44px;height:44px;display:grid;place-items:center;padding:0;border:1px solid rgba(232,166,40,.55);border-radius:10px;background:rgba(13,15,11,.8);color:#e8a628;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
#fzin-fs[hidden],#fzin-fstip[hidden]{display:none}
#fzin-fs svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
#fzin-fs:active{transform:scale(.94)}
#fzin-fs.in-top{position:static;flex:none;width:44px;height:44px;margin-left:2px}
#fzin-fstip{position:fixed;left:calc(10px + env(safe-area-inset-left,0px));bottom:calc(62px + env(safe-area-inset-bottom,0px));z-index:61;max-width:min(320px,calc(100vw - 20px));padding:12px 40px 12px 14px;border:1px solid rgba(232,166,40,.55);border-radius:10px;background:rgba(13,15,11,.95);color:#f4ecd8;font:16px/1.35 'Barlow Condensed','Arial Narrow',Arial,sans-serif}
#fzin-fstip b{display:block;margin-bottom:4px;color:#e8a628;font-size:15px;letter-spacing:.06em;text-transform:uppercase}
#fzin-fstip .fzin-fsx{position:absolute;top:4px;right:4px;width:36px;height:36px;border:0;background:none;color:#f4ecd8;font-size:24px;line-height:1;cursor:pointer}
html.fzin-pad #hud kbd.fz2-k{border-radius:999px;min-width:1.7em;background:linear-gradient(180deg,#f8d27a,#e2a43a);color:#16130a}
.fzs .fzin-glyph{text-transform:none}
.fzs .fzin-edit{min-width:120px;min-height:44px}
`;
  document.head.appendChild(st);
  try { installMobileUi(ctx); } catch (e) { console.warn('[input] mobile menus', e); }

  applyTouch();
  // say it once, in the menu's own toast line (the menu has no toast API: its element is reused as is)
  if (ctx.presetPicked) setTimeout(() => { try { const te = menuRoot && menuRoot.querySelector('.fzm-toast'); if (!te || E.running) return; te.textContent = L('mobileOn'); te.classList.add('is-on'); setTimeout(() => te.classList.remove('is-on'), 3200); } catch { /* optional */ } }, 1800);
  return ctx;
}
