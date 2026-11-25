// FRONT ZÉRO — boot (CONTRACT.md "Boot"). Survives a missing or broken menu.js / modes.js:
// the engine falls back to a built-in FFA mode and this file to a bare start screen.
// URL flags: ?dev=1 exposes window.__fz, ?fallback=1 forces the built-in menu and mode.
import { createSettings } from './settings.js';
import { createI18n } from './i18n.js';
import { createProfile } from './profile.js';
import { createAudio } from './audio.js';
import { createNet } from './net.js';
import { MAPS } from './maps.js';
import { MODES } from './data.js';
import { createEngine } from './game.js';
import { makeT } from './engine-hud.js';

const params = new URLSearchParams(location.search), dev = params.has('dev'), forceFallback = params.has('fallback');
const settings = createSettings(), i18n = createI18n(settings), profile = createProfile(), audio = createAudio();
let net = null; try { net = createNet(); } catch (e) { console.warn('[boot] net unavailable', e); }
const canvas = document.getElementById('c'), hudRoot = document.getElementById('hud'), menuRoot = document.getElementById('menu');
const engine = createEngine({ canvas, hudRoot, settings, i18n, profile, audio });

// audio needs a user gesture; the deploy click also unlocks it through the engine
const unlock = () => { try { audio.unlock(); } catch { /* optional */ } removeEventListener('pointerdown', unlock, true); removeEventListener('keydown', unlock, true); };
addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true);

const onPlay = cfg => engine.startMatch(forceFallback ? { ...cfg, fallback: true } : cfg);

/* Minimal built-in menu: map choice, a start button and the last result. */
function fallbackMenu(root) {
  const t = makeT(i18n); let last = null, map = params.get('map') || MAPS[0].id;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  function draw() {
    root.textContent = ''; const box = el('div', 'fb'), h = el('h1'); h.append('FRONT ', el('b', '', 'ZÉRO')); box.append(h);
    if (last) { box.append(el('p', '', last.title || '')); const st = el('div', 'st'); for (const s of last.stats || []) { const d = el('span'); d.append(el('b', '', String(s.value)), s.label); st.append(d); } const c = el('span'); c.append(el('b', '', '+' + (last.credits || 0)), t('end.credits')); st.append(c); box.append(st); }
    const lab = el('label', '', t('map') + ' '), sel = el('select');
    for (const m of MAPS) { const k = 'map.' + m.id, nm = i18n.t(k), o = el('option', '', nm && nm !== k ? nm : m.name); o.value = m.id; if (m.id === map) o.selected = true; sel.append(o); }
    sel.addEventListener('change', () => { map = sel.value; }); lab.append(sel); box.append(lab);
    const go = el('button', '', last ? t('again') : t('start')); go.addEventListener('click', () => onPlay({ mode: 'ffa', map, online: false, bots: 7, difficulty: 'normal' })); box.append(go);
    root.append(box);
  }
  const api = { show() { root.hidden = false; draw(); }, hide() { root.hidden = true; }, showEnd(r) { last = r || null; api.show(); }, destroy() { root.textContent = ''; } };
  engine.on('matchStart', () => api.hide()); engine.on('matchEnd', r => api.showEnd(r));
  api.show(); return api;
}

try { const q = await import('./maps-relief.js'); q.install(await import('./maps.js')); } catch (e) { console.warn('[boot] maps-relief', e); } try { const q2 = await import('./maps-mine.js'); q2.install(await import('./maps.js')); } catch (e) { console.warn('[boot] maps-mine', e); } try { const qc = await import('./maps-cite.js'); qc.install(await import('./maps.js')); } catch (e) { console.warn('[boot] maps-cite', e); } try { const qm = await import('./maps-marais.js'); qm.install(await import('./maps.js')); } catch (e) { console.warn('[boot] maps-marais', e); } try { const qb = await import('./maps-barrage.js'); qb.install(await import('./maps.js')); } catch (e) { console.warn('[boot] maps-barrage', e); } let menu = null;
if (!forceFallback) {
  try {
    const m = await import('./menu.js');
    menu = m.createMenu(menuRoot, { settings, i18n, profile, net, audio, engine, MAPS, MODES, onPlay });
  } catch (e) { console.warn('[boot] menu.js unavailable, using the built-in start screen:', e && e.message); menuRoot.textContent = ''; menu = null; }
}
if (!menu) menu = fallbackMenu(menuRoot);
// safety nets: the pause menu's "quit" must bring the menu back, and a started match must hide it
engine.on('quit', () => { try { menu.show(); } catch (e) { console.error('[boot] menu.show', e); } });
engine.on('matchStart', () => { try { menu.hide(); } catch { /* the menu hides itself */ } });

if (dev) window.__fz = { engine, menu, settings, profile, net, i18n, audio, MAPS, MODES };
// motion layers (menus, HUD, world life): purely visual, loaded after the menu so they never delay it; a failure leaves the game as it was
// ON by default since 24/11 (exclusive GPU: load +0.2 %, CPU x4 +1.4 %, no task over 250 ms from these layers; see the dev notes). ?motion=0 turns them off.
if (params.get('motion') !== '0') for (const f of ['./ui-motion.js', './hud-motion.js', './engine-ambient.js']) import(f).then(m => m.install({ engine, settings, i18n, profile, menuRoot, hudRoot })).catch(e => console.warn('[motion]', f, e));
import('./net-hud.js').then(m => m.install({ net, engine, settings, hudRoot })).catch(e => console.warn('[boot] network indicator unavailable', e));
// modern in-match HUD (compass, round minimap, restyle): wraps the HUD's own methods; ?hud=classic or a failure keeps the classic HUD (the dev notes)
if (params.get('hud') !== 'classic') import('./hud-theme.js').then(m => m.install({ engine, settings, i18n, hudRoot })).catch(e => console.warn('[boot] hud theme unavailable', e));
// menus v2 (the HUD v2 panel language on the menus, lobby, end screens, settings, shop and pass chrome): style only; ?ui=v1 skips it (the dev notes)
if (params.get('ui') !== 'v1') import('./ui-theme.js').then(m => m.install({ engine, settings, i18n, profile, menuRoot })).catch(e => console.warn('[boot] menu theme unavailable', e));
// End-of-match flow (results, map vote, next match). If it fails to load, this client simply does not announce it and keeps the old end screen.
import('./match-flow.js').then(f => { const flow = f.installMatchFlow({ net, engine, menu, i18n, profile, audio, MAPS }); if (dev && window.__fz) window.__fz.flow = flow; }).catch(e => console.warn('[boot] match-flow unavailable', e));
// Public rooms, quick play, server wake-up and online bots (online-ui.js, bots-sim.js). If it fails to load, the menu keeps private rooms by code.
import('./online-ui.js').then(o => { const ol = o.install({ net, engine, menu, i18n }); if (dev && window.__fz) window.__fz.online = ol; }).catch(e => console.warn('[boot] public rooms unavailable', e));
// Season pass (pass.js): engine events only, nothing per frame. If it fails to load, the menu tab does nothing and matches are unchanged.
import('./pass.js').then(p => { const pass = p.install({ engine, profile, i18n, net, audio, menu }); if (dev && window.__fz) window.__fz.pass = pass; }).catch(e => console.warn('[boot] season pass unavailable', e));
// Living front (front-ui.js): home band, war room, side choice, contribution after online matches. If it fails to load, nothing else changes.
import('./front-ui.js').then(f => { const front = f.install({ net, engine, menu, i18n, profile, settings, menuRoot, MAPS }); if (dev && window.__fz) window.__fz.front = front; }).catch(e => console.warn('[boot] living front unavailable', e));
// Best moment (replay-rec.js): 20 Hz record of the match, the best moment's card on the end screens, replay and video on demand. If it fails to load, matches and end screens are unchanged.
import('./replay-rec.js').then(r => { const rp = r.install({ engine, settings, i18n, profile, audio, menu, net, MAPS }); if (dev && window.__fz) window.__fz.replay = rp; }).catch(e => console.warn('[boot] best moment unavailable', e));
// Phones, tablets and gamepads (input-hub.js: touch controls, controller, phone menus, Mobile preset). If it fails to load, mouse and keyboard are unchanged.
import('./input-hub.js').then(m => { const inp = m.install({ engine, settings, i18n, profile, menu, menuRoot, hudRoot }); if (dev && window.__fz) window.__fz.input = inp; }).catch(e => console.warn('[boot] touch and gamepad input unavailable', e));

/* ---------- failure surface: a broken match, a lost WebGL context or a dead screen always ends on a visible panel ---------- */
const FT = {       // fr, en, es, de, pt, it
  errTitle: ['Le jeu a rencontré une erreur', 'The game hit an error', 'El juego ha encontrado un error', 'Im Spiel ist ein Fehler aufgetreten', 'O jogo encontrou um erro', 'Il gioco ha riscontrato un errore'],
  errBody: ['La partie n’a pas pu continuer. Revenez au menu et relancez ; si cela se reproduit, rechargez la page.', 'The match could not continue. Go back to the menu and try again; if it happens again, reload the page.', 'La partida no pudo continuar. Vuelve al menú e inténtalo de nuevo; si se repite, recarga la página.', 'Das Spiel konnte nicht fortgesetzt werden. Kehre zum Menü zurück und versuche es erneut; lade sonst die Seite neu.', 'A partida não pôde continuar. Volta ao menu e tenta de novo; se voltar a acontecer, recarrega a página.', 'La partita non è potuta continuare. Torna al menu e riprova; se succede ancora, ricarica la pagina.'],
  slow: ['Le chargement de la carte ne répond plus.', 'The map stopped loading.', 'La carga del mapa ha dejado de responder.', 'Das Laden der Karte reagiert nicht mehr.', 'O carregamento do mapa deixou de responder.', 'Il caricamento della mappa non risponde più.'],
  ctxTitle: ['Affichage interrompu', 'Display interrupted', 'Pantalla interrumpida', 'Anzeige unterbrochen', 'Imagem interrompida', 'Visualizzazione interrotta'],
  ctxBody: ['La carte graphique a cessé de répondre (contexte WebGL perdu), le plus souvent par manque de mémoire vidéo ou après un redémarrage du pilote. Rechargez la page pour reprendre. Sur une machine modeste, choisissez le préréglage graphique « Bas » dans Paramètres.', 'The graphics card stopped responding (WebGL context lost), usually because it ran out of video memory or its driver restarted. Reload the page to continue. On a modest machine, pick the “Low” graphics preset in Settings.', 'La tarjeta gráfica ha dejado de responder (contexto WebGL perdido), normalmente por falta de memoria de vídeo o porque su controlador se ha reiniciado. Recarga la página para continuar. En un equipo modesto, elige el ajuste gráfico «Bajo» en Ajustes.', 'Die Grafikkarte reagiert nicht mehr (WebGL-Kontext verloren), meist wegen zu wenig Grafikspeicher oder eines Treiberneustarts. Lade die Seite neu, um weiterzuspielen. Auf schwächeren Rechnern hilft die Grafikvoreinstellung „Niedrig“ in den Einstellungen.', 'A placa gráfica deixou de responder (contexto WebGL perdido), normalmente por falta de memória de vídeo ou porque o controlador reiniciou. Recarrega a página para continuar. Numa máquina modesta, escolhe a predefinição gráfica «Baixo» nas Definições.', 'La scheda grafica ha smesso di rispondere (contesto WebGL perso), di solito per mancanza di memoria video o per il riavvio del driver. Ricarica la pagina per continuare. Su un computer modesto scegli il preset grafico «Basso» nelle Impostazioni.'],
  ctxBack: ['L’affichage est revenu, mais des textures peuvent manquer. Rechargez la page pour tout rétablir, ou continuez ainsi.', 'The display is back, but some textures may be missing. Reload the page to restore everything, or carry on as is.', 'La imagen ha vuelto, pero pueden faltar texturas. Recarga la página para restaurarlo todo o continúa así.', 'Die Anzeige ist zurück, aber es können Texturen fehlen. Lade die Seite neu, um alles wiederherzustellen, oder spiele so weiter.', 'A imagem voltou, mas podem faltar texturas. Recarrega a página para repor tudo ou continua assim.', 'L’immagine è tornata, ma possono mancare delle texture. Ricarica la pagina per ripristinare tutto oppure continua così.'],
  reload: ['Recharger la page', 'Reload the page', 'Recargar la página', 'Seite neu laden', 'Recarregar a página', 'Ricarica la pagina'],
  menu: ['Retour au menu', 'Back to menu', 'Volver al menú', 'Zurück zum Menü', 'Voltar ao menu', 'Torna al menu'],
  cont: ['Continuer', 'Continue', 'Continuar', 'Weiter', 'Continuar', 'Continua'],
};
const ft = k => { const i = ['fr', 'en', 'es', 'de', 'pt', 'it'].indexOf(i18n.lang); return FT[k][i < 0 ? 0 : i]; };
let panel = null, panelKind = '';
function closePanel() { if (panel) { panel.remove(); panel = null; panelKind = ''; } }
function showPanel(kind, title, body, detail, buttons) {
  closePanel(); panelKind = kind;
  const mk = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text) e.textContent = text; return e; };
  panel = mk('div', 'position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,9,6,.93);color:#d8c9a3;font-family:"Barlow Condensed","Arial Narrow",Arial,sans-serif');
  panel.id = 'fz-fatal'; panel.setAttribute('role', 'alertdialog'); panel.setAttribute('aria-modal', 'true');
  const box = mk('div', 'max-width:620px;width:100%;border:1px solid rgba(201,185,143,.3);border-left:4px solid #e0492f;background:#14170f;padding:22px 24px;display:grid;gap:14px');
  box.append(mk('h2', 'margin:0;font-size:30px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#f4ecd8', title), mk('p', 'margin:0;font-size:20px;line-height:1.3', body));
  if (detail) box.append(mk('p', 'margin:0;font:13px/1.35 ui-monospace,Consolas,monospace;color:#8d8a76;overflow-wrap:anywhere;max-height:5.4em;overflow:hidden', String(detail).slice(0, 300)));
  const row = mk('div', 'display:flex;flex-wrap:wrap;gap:10px');
  buttons.forEach(([label, fn], i) => { const b = mk('button', 'font:inherit;font-size:20px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:10px 22px;cursor:pointer;border:1px solid ' + (i ? 'rgba(201,185,143,.4)' : '#e8a628') + ';background:' + (i ? 'transparent' : '#e8a628') + ';color:' + (i ? '#d8c9a3' : '#181407'), label); b.type = 'button'; b.addEventListener('click', fn); row.append(b); });
  box.append(row); panel.append(box); document.body.append(panel);
  try { if (document.pointerLockElement) document.exitPointerLock(); row.firstChild.focus(); } catch { /* focus is a nicety */ }
}
const reloadPage = () => location.reload();
const backToMenu = () => { closePanel(); try { engine.quit(); } catch (e) { console.error('[boot] quit', e); } try { menu.show('play'); } catch (e) { console.error('[boot] menu.show', e); } };
engine.on('fatal', f => showPanel('error', ft('errTitle'), ft('errBody'), f && f.message, [[ft('menu'), backToMenu], [ft('reload'), reloadPage]]));
engine.on('contextLost', () => showPanel('ctx', ft('ctxTitle'), ft('ctxBody'), '', [[ft('reload'), reloadPage], [ft('menu'), backToMenu]]));
// the engine rebuilds the GPU side behind its loading screen when the context comes back: the panel only covers the time without a picture
engine.on('contextRestored', () => { if (panelKind === 'ctx') closePanel(); });
// Watchdogs: a load that never finishes (sooner when a script error was seen meanwhile) and a screen with neither match, menu nor panel.
let loadSince = 0, loadErr = '', deadFor = 0;
const noteError = m => { if (engine.loading) loadErr = String(m || '').slice(0, 300); };
addEventListener('error', e => noteError(e && (e.message || (e.error && e.error.message))));
addEventListener('unhandledrejection', e => noteError(e && e.reason && (e.reason.message || e.reason)));
setInterval(() => {
  const now = performance.now();
  if (engine.loading) { if (!loadSince) { loadSince = now; loadErr = ''; } else if (now - loadSince > (loadErr ? 20000 : 90000)) { loadSince = 0; engine.abort(ft('slow') + (loadErr ? ' ' + loadErr : '')); } } else loadSince = 0;
  const menuShown = !menuRoot.hidden && menuRoot.style.display !== 'none' && menuRoot.childElementCount > 0;
  if (!engine.running && !engine.loading && !menuShown && !panel) { if (++deadFor >= 3) { deadFor = 0; console.warn('[boot] nothing on screen: back to the menu'); try { menu.show('play'); } catch (e) { showPanel('error', ft('errTitle'), ft('errBody'), e && e.message, [[ft('reload'), reloadPage]]); } } } else deadFor = 0;
}, 1000);
/* ---------- loading screen: markup and style in next.html, progress from the engine's 'loading' event ---------- */
{
  const LD = {       // fr, en, es, de, pt, it
    init: ['Préparation', 'Getting ready', 'Preparación', 'Vorbereitung', 'Preparação', 'Preparazione'],
    map: ['Construction du terrain', 'Building the terrain', 'Construyendo el terreno', 'Gelände wird aufgebaut', 'A construir o terreno', 'Costruzione del terreno'],
    textures: ['Peinture des textures', 'Painting textures', 'Pintando texturas', 'Texturen werden gemalt', 'A pintar texturas', 'Pittura delle texture'],
    nav: ['Calcul des itinéraires', 'Plotting routes', 'Calculando rutas', 'Routen werden berechnet', 'A calcular rotas', 'Calcolo dei percorsi'],
    units: ['Déploiement des unités', 'Deploying units', 'Desplegando unidades', 'Einheiten rücken aus', 'A destacar unidades', 'Schieramento delle unità'],
    audio: ['Réglage du son', 'Tuning the sound', 'Ajustando el sonido', 'Ton wird eingestellt', 'A afinar o som', 'Regolazione dell’audio'],
    shaders: ['Préparation des graphismes', 'Preparing the graphics', 'Preparando los gráficos', 'Grafik wird vorbereitet', 'A preparar os gráficos', 'Preparazione della grafica'],
    final: ['Derniers préparatifs', 'Final checks', 'Últimos preparativos', 'Letzte Vorbereitungen', 'Últimos preparativos', 'Ultimi preparativi'],
    tipk: ['Conseil', 'Tip', 'Consejo', 'Tipp', 'Dica', 'Consiglio'],
    tips: [
      ['Glissez en pleine course pour franchir un espace découvert.', 'Slide while running to cross open ground.', 'Deslízate en carrera para cruzar campo abierto.', 'Rutsche im Lauf, um offenes Gelände zu überqueren.', 'Desliza em corrida para atravessar terreno aberto.', 'Scivola in corsa per attraversare il terreno scoperto.'],
      ['Visez la tête : les dégâts sont nettement plus élevés.', 'Aim for the head: the damage is much higher.', 'Apunta a la cabeza: el daño es mucho mayor.', 'Ziele auf den Kopf: Der Schaden ist deutlich höher.', 'Aponta à cabeça: o dano é muito maior.', 'Mira alla testa: il danno è molto più alto.'],
      ['Rechargez à couvert, jamais au milieu d’une rue.', 'Reload behind cover, never in the middle of a street.', 'Recarga a cubierto, nunca en medio de la calle.', 'Lade in Deckung nach, nie mitten auf der Straße.', 'Recarrega em cobertura, nunca no meio da rua.', 'Ricarica al coperto, mai in mezzo alla strada.'],
      ['Les étages et les passerelles offrent de longues lignes de tir.', 'Upper floors and walkways give long lines of fire.', 'Los pisos altos y las pasarelas ofrecen largas líneas de tiro.', 'Obergeschosse und Stege bieten lange Schusslinien.', 'Os pisos superiores e os passadiços dão longas linhas de tiro.', 'I piani alti e le passerelle offrono lunghe linee di tiro.'],
      ['Accroupi, votre tir est plus précis.', 'Crouching makes your fire more accurate.', 'Agachado, tu disparo es más preciso.', 'In der Hocke schießt du genauer.', 'Agachado, o teu tiro é mais preciso.', 'Accovacciato, il tuo fuoco è più preciso.'],
      ['Le premier chargement d’une carte prépare les graphismes ; les suivants sont plus rapides.', 'The first load of a map prepares the graphics; later ones are faster.', 'La primera carga de un mapa prepara los gráficos; las siguientes son más rápidas.', 'Das erste Laden einer Karte bereitet die Grafik vor; danach geht es schneller.', 'O primeiro carregamento de um mapa prepara os gráficos; os seguintes são mais rápidos.', 'Il primo caricamento di una mappa prepara la grafica; i successivi sono più rapidi.'],
    ],
  };
  const MODE_KEY = { ffa: 'mode.deathmatch', tdm: 'mode.teams', dom: 'mode.domination', bomb: 'mode.bomb', zombie: 'mode.zombies' };
  const root = document.getElementById('loading'), part = {};
  if (root) for (const e of root.querySelectorAll('[data-l]')) part[e.dataset.l] = e;
  const li = () => { const i = ['fr', 'en', 'es', 'de', 'pt', 'it'].indexOf(i18n.lang); return i < 0 ? 0 : i; };
  const tr = (key, fallback) => { const v = key ? i18n.t(key) : ''; return v && v !== key ? v : fallback; };
  const put = (e, s) => { if (e && e.textContent !== s) e.textContent = s; };
  let shown = false, pct = -1, phase = '', tipI = Math.floor(Math.random() * LD.tips.length), tipTimer = 0, hideTimer = 0;
  const tip = () => { put(part.tipk, LD.tipk[li()]); put(part.tip, LD.tips[tipI % LD.tips.length][li()]); };
  function hide(fade) {
    if (!shown) return; shown = false; clearInterval(tipTimer); clearTimeout(hideTimer);
    if (!fade) { root.hidden = true; root.classList.remove('out'); return; }
    root.classList.add('out'); hideTimer = setTimeout(() => { root.hidden = true; root.classList.remove('out'); }, 300);
  }
  if (root && part.fill) {
    engine.on('loading', e => {
      if (!e || !e.active) { if (e && e.done) part.fill.style.transform = 'scaleX(1)'; hide(!!(e && e.done)); return; }
      if (!shown) {
        shown = true; pct = -1; phase = ''; clearTimeout(hideTimer); root.classList.remove('out');
        part.fill.style.transition = 'none'; part.fill.style.transform = 'scaleX(0)'; void part.fill.offsetWidth; part.fill.style.transition = '';
        const m = MAPS.find(x => x.id === e.map), md = MODES.find(x => x.id === e.mode);
        put(part.map, tr('map.' + e.map, m ? m.name : String(e.map || ''))); put(part.mode, tr(MODE_KEY[e.mode], md ? md.name : ''));
        tipI++; tip(); tipTimer = setInterval(() => { tipI++; tip(); }, 4500);
        root.hidden = false;
      }
      const p = Math.round(Math.max(0, Math.min(1, e.progress || 0)) * 100);
      if (p !== pct) { pct = p; part.fill.style.transform = 'scaleX(' + p / 100 + ')'; put(part.pct, p + ' %'); if (part.bar) part.bar.setAttribute('aria-valuenow', String(p)); }
      if (e.phase !== phase) { phase = e.phase; put(part.phase, (LD[phase] || LD.init)[li()]); }
    });
    for (const ev of ['fatal', 'matchEnd', 'quit']) engine.on(ev, () => hide(false));
  }
}
window.__fzBooted = true;
{ const bf = document.getElementById('fz-boot-fail'); if (bf) bf.remove(); }       // a slow start that made it after all
