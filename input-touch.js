// FRONT ZÉRO — on-screen touch controls (phones, tablets), loaded by input-hub.js only when a touch screen is in use.
// Left half: a floating move stick where the thumb lands (push past the ring to sprint). Right half: drag to look (sensitivity, acceleration
// curve, modest aim assist), hold a still finger to fire (setting). Buttons in the HUD v2 language, placed from a saved layout that the
// editor changes (drag, size, opacity). Everything goes through the engine's own inputs (E.input.set, E.input.axis, player yaw/pitch):
// no rule, speed or damage is touched. The layer exists only during a match, so menus keep their normal taps and scrolling.
const SVG = {
  fire: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  aim: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path d="M12 8.5l3.5 3.5-3.5 3.5L8.5 12z"/>',
  jump: '<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>',
  crouch: '<path d="M6 5l6 6 6-6"/><path d="M5 17h14M7 21h10"/>',
  reload: '<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.5 4v4.5H15"/>',
  swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  grenade: '<ellipse cx="11" cy="14" rx="5.5" ry="6.5"/><path d="M9 7.5h4.5l1-2.5h-5.5zM14 6l4.5-1.5M8 12h6M8 16h6"/>',
  gear: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><path d="M16.5 13.5v6M13.5 16.5h6"/>',
  interact: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.6"/>',
  score: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  torch: '<path d="M9 3h6l-1 5h-4zM10 8h4v10a2 2 0 0 1-4 0z"/><path d="M5 5l2 1.5M19 5l-2 1.5"/>',
  stick: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>',
};
/* default layout, landscape: [x, y] = centre as a fraction of the screen, s = size factor, o = opacity factor */
const BTN = [
  { id: 'fire', def: [0.878, 0.6, 1.45, 1] },
  { id: 'aim', def: [0.742, 0.79, 1, 1] },
  { id: 'jump', def: [0.94, 0.855, 1, 1] },
  { id: 'crouch', def: [0.826, 0.9, 0.9, 1] },
  { id: 'reload', def: [0.952, 0.4, 0.85, 1] },
  { id: 'swap', def: [0.875, 0.27, 0.8, 1] },
  { id: 'grenade', def: [0.75, 0.505, 0.85, 1] },
  { id: 'gear', def: [0.06, 0.48, 0.85, 1] },
  { id: 'interact', def: [0.64, 0.56, 1, 1], ctx: true },
  { id: 'score', def: [0.86, 0.085, 0.72, 1] },
  { id: 'pause', def: [0.955, 0.085, 0.72, 1] },
  { id: 'stick', def: [0.17, 0.7, 1, 1], stick: true },
];
const LOC = {       // fr, en, es, de, pt, it
  fire: ['Tir', 'Fire', 'Disparo', 'Feuer', 'Disparo', 'Fuoco'],
  aim: ['Viser', 'Aim', 'Apuntar', 'Zielen', 'Apontar', 'Mira'],
  jump: ['Saut', 'Jump', 'Salto', 'Sprung', 'Salto', 'Salto'],
  crouch: ['Accroupi', 'Crouch', 'Agachar', 'Ducken', 'Agachar', 'Accovacciati'],
  reload: ['Recharger', 'Reload', 'Recargar', 'Nachladen', 'Recarregar', 'Ricarica'],
  swap: ['Arme', 'Weapon', 'Arma', 'Waffe', 'Arma', 'Arma'],
  grenade: ['Létal', 'Lethal', 'Letal', 'Tödlich', 'Letal', 'Letale'],
  gear: ['Équip.', 'Gear', 'Equipo', 'Ausr.', 'Equip.', 'Equip.'],
  interact: ['Utiliser', 'Use', 'Usar', 'Benutzen', 'Usar', 'Usa'],
  score: ['Scores', 'Scores', 'Puntos', 'Punkte', 'Pontos', 'Punteggi'],
  pause: ['Pause', 'Pause', 'Pausa', 'Pause', 'Pausa', 'Pausa'],
  stick: ['Déplacement', 'Move', 'Movimiento', 'Bewegung', 'Movimento', 'Movimento'],
  torch: ['Lampe', 'Light', 'Linterna', 'Lampe', 'Lanterna', 'Torcia'],
  sprint: ['Course', 'Sprint', 'Carrera', 'Sprint', 'Corrida', 'Scatto'],
  edTitle: ['Disposition des commandes', 'Control layout', 'Disposición de controles', 'Steuerungslayout', 'Disposição dos controlos', 'Disposizione comandi'],
  edHelp: ['Fais glisser un bouton pour le placer, touche-le pour régler sa taille et sa visibilité.', 'Drag a button to place it, tap it to set its size and visibility.', 'Arrastra un botón para colocarlo; tócalo para ajustar tamaño y visibilidad.', 'Taste ziehen zum Platzieren, antippen für Größe und Sichtbarkeit.', 'Arrasta um botão para o colocar; toca-lhe para ajustar tamanho e visibilidade.', 'Trascina un pulsante per spostarlo, toccalo per dimensione e visibilità.'],
  edPortrait: ['Tournez le téléphone : la disposition se règle à l’horizontale.', 'Turn the phone: the layout is set in landscape.', 'Gira el móvil: la disposición se ajusta en horizontal.', 'Gerät drehen: Das Layout wird im Querformat eingestellt.', 'Roda o telemóvel: a disposição ajusta-se na horizontal.', 'Ruota il telefono: la disposizione si regola in orizzontale.'],
  size: ['Taille', 'Size', 'Tamaño', 'Größe', 'Tamanho', 'Dimensione'],
  vis: ['Visibilité', 'Visibility', 'Visibilidad', 'Sichtbarkeit', 'Visibilidade', 'Visibilità'],
  reset: ['Tout réinitialiser', 'Reset all', 'Restablecer todo', 'Alles zurücksetzen', 'Repor tudo', 'Ripristina tutto'],
  cancel: ['Annuler', 'Cancel', 'Cancelar', 'Abbrechen', 'Cancelar', 'Annulla'],
  save: ['Enregistrer', 'Save', 'Guardar', 'Speichern', 'Guardar', 'Salva'],
  none: ['Aucun', 'None', 'Ninguno', 'Keins', 'Nenhum', 'Nessuno'],
};
const CSS = `
#ftc{position:fixed;inset:0;z-index:6;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;--ftc-o:.85}
#ftc[hidden],#ftc [hidden]{display:none!important}
.ftc-b{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border-radius:50%;color:#ece2c6;opacity:calc(var(--ftc-o) * var(--o,1));pointer-events:none;
 background:radial-gradient(circle at 50% 32%,rgba(40,44,38,.8),rgba(9,11,10,.72) 70%);box-shadow:inset 0 0 0 1px rgba(236,226,198,.34),inset 0 1px 0 rgba(255,255,255,.09),0 2px 8px rgba(0,0,0,.45);transition:transform .06s,background-color .06s}
.ftc-b::before{content:"";position:absolute;inset:-3px;border-radius:50%;background:conic-gradient(from -58deg,rgba(232,166,40,.95) 0 34deg,transparent 34deg);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px));mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px))}
.ftc-b svg{width:46%;height:46%;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 1px 1px rgba(0,0,0,.7))}
.ftc-b em{font-style:normal;font-size:clamp(9px,2.3vh,11px);font-weight:700;letter-spacing:.02em;text-transform:uppercase;line-height:1;text-shadow:0 1px 2px #000,0 0 3px #000;white-space:nowrap}
.ftc-b b{position:absolute;right:-2px;top:-2px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;font:800 12px/18px 'Barlow Condensed','Arial Narrow',Arial,sans-serif;text-align:center;color:#141108;background:#e8a628;box-shadow:0 1px 3px rgba(0,0,0,.6)}
.ftc-b.dn{transform:scale(.93);background:radial-gradient(circle at 50% 32%,#f8c552,#d9921c 75%);color:#16130a}
.ftc-b.dn em{text-shadow:none}.ftc-b.dn svg{filter:none}
.ftc-b.on{box-shadow:inset 0 0 0 2px #e8a628,0 0 12px rgba(232,166,40,.45);color:#f8c552}
.ftc-b.off{opacity:calc(var(--ftc-o) * var(--o,1) * .4)}
.ftc-b[data-id="fire"]{background:radial-gradient(circle at 50% 32%,rgba(70,40,24,.82),rgba(22,10,6,.74) 72%);box-shadow:inset 0 0 0 1.5px rgba(240,160,90,.6),0 2px 10px rgba(0,0,0,.5)}
.ftc-b[data-id="fire"]::before{background:conic-gradient(from -70deg,rgba(232,166,40,.95) 0 50deg,transparent 50deg 180deg,rgba(232,166,40,.95) 180deg 230deg,transparent 230deg)}
.ftc-b[data-id="fire"].dn{background:radial-gradient(circle at 50% 32%,#ffb36b,#e0632f 75%)}
.ftc-b[data-id="interact"]{animation:ftc-pulse 1.4s ease-in-out infinite}
.ftc-b[data-id="interact"].auto em{display:none}
.ftc-b[data-id="interact"] em{position:absolute;top:calc(100% + 4px);left:50%;transform:translateX(-50%);max-width:none;padding:2px 8px;font-size:12px;letter-spacing:.04em;text-transform:none;background:rgba(9,11,10,.78);box-shadow:inset 0 0 0 1px rgba(236,226,198,.25)}
@keyframes ftc-pulse{0%,100%{box-shadow:inset 0 0 0 1.5px rgba(232,166,40,.9),0 0 0 0 rgba(232,166,40,.45)}50%{box-shadow:inset 0 0 0 1.5px rgba(232,166,40,.9),0 0 0 8px rgba(232,166,40,0)}}
.ftc-stick{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;opacity:calc(var(--ftc-o) * var(--o,1))}
.ftc-ring{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(9,11,10,.18),rgba(9,11,10,.42));box-shadow:inset 0 0 0 1.5px rgba(236,226,198,.38),0 0 0 1px rgba(0,0,0,.25)}
.ftc-knob{position:absolute;border-radius:50%;background:radial-gradient(circle at 50% 35%,rgba(246,241,227,.92),rgba(190,180,150,.82));box-shadow:0 2px 6px rgba(0,0,0,.55),inset 0 0 0 1px rgba(0,0,0,.25);will-change:transform}
.ftc-stick.idle{opacity:calc(var(--ftc-o) * var(--o,1) * .55)}
.ftc-stick.run .ftc-knob{background:radial-gradient(circle at 50% 35%,#ffd77d,#e8a628)}
.ftc-run{position:absolute;left:-30px;width:60px;text-align:center;font-size:12px;font-weight:800;letter-spacing:.14em;color:#e8a628;text-shadow:0 1px 2px #000;opacity:0;transition:opacity .1s}
.ftc-run::before{content:"";display:block;width:16px;height:9px;margin:0 auto 2px;background:currentColor;clip-path:polygon(0 100%,50% 0,100% 100%,82% 100%,50% 36%,18% 100%)}
.ftc-stick.run .ftc-run{opacity:1}
#ftc.dead .ftc-b:not([data-id="fire"]):not([data-id="pause"]):not([data-id="score"]),#ftc.dead .ftc-stick{display:none}
.ftc-wheel{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}
.ftc-wheel::before{content:"";position:absolute;left:-118px;top:-118px;width:236px;height:236px;border-radius:50%;background:radial-gradient(circle,rgba(9,11,10,.82) 30%,rgba(9,11,10,.55) 62%,transparent 71%)}
.ftc-opt{position:absolute;width:96px;height:68px;margin:-34px 0 0 -48px;display:grid;justify-items:center;align-content:center;gap:1px;color:#ece2c6;background:linear-gradient(180deg,rgba(28,32,28,.94),rgba(10,12,10,.9));box-shadow:inset 0 0 0 1px rgba(236,226,198,.3);clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))}
.ftc-opt img{width:44px;height:30px;object-fit:contain}
.ftc-opt svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ftc-opt span{font-size:12px;font-weight:700;letter-spacing:.04em;max-width:90px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ftc-opt small{font-size:12px;font-weight:800;color:#e8a628}
.ftc-opt.sel{background:linear-gradient(180deg,#f8c552,#d9921c);color:#16130a}.ftc-opt.sel small{color:#16130a}
.ftc-opt.off{opacity:.38}
html.fzin-touch body.play{overscroll-behavior:none;user-select:none;-webkit-user-select:none}
html.fzin-touch.fz2 #hud [data-h="vit"]{left:auto!important;right:calc(50% + 6px)!important;bottom:4px!important;transform-origin:100% 100%;scale:var(--ftc-hs,.6)}
html.fzin-touch.fz2 #hud [data-h="wp"]{right:auto!important;left:calc(50% + 6px)!important;bottom:4px!important;transform-origin:0 100%;scale:var(--ftc-hs,.6)}
html.fzin-touch #gx-slots{display:none!important}
html.fzin-touch #hud [data-h="prompt"]{top:56%!important}
html.fzin-touch #hud [data-h="loot"]{top:63%!important}
html.fzin-touch #hud [data-h="prog"]{top:44%!important}
html.fzin-touch #hud [data-h="pmain"] button,html.fzin-touch #hud [data-h="psetback"]{min-height:46px}
html.fzin-touch #hud [data-h="feed"]{top:calc(var(--ftc-top,58px))!important}
html.fzin-touch #hud [data-h="earn"]{top:auto!important;bottom:calc(var(--ftc-hb,70px) + 8px)!important;right:auto!important;left:50%!important;transform:translateX(-50%)!important;text-align:center}
html.fzin-touch #hud .fz2-fm kbd,html.fzin-touch #hud [data-h="torch"] kbd{display:none}
#ftc-edit{position:fixed;inset:0;z-index:85;touch-action:none;user-select:none;-webkit-user-select:none;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;color:#d8c9a3;--ftc-o:1;
 background:linear-gradient(rgba(236,226,198,.05) 1px,transparent 1px) 0 0/40px 40px,linear-gradient(90deg,rgba(236,226,198,.05) 1px,transparent 1px) 0 0/40px 40px,radial-gradient(120% 90% at 50% 110%,rgba(232,166,40,.12),transparent 60%),#0b0d09}
#ftc-edit .ftc-b,#ftc-edit .ftc-stick{pointer-events:auto;cursor:grab}
#ftc-edit .ftc-b.sel,#ftc-edit .ftc-stick.sel .ftc-ring{outline:2px dashed #e8a628;outline-offset:4px}
#ftc-edit .ftc-stick{opacity:var(--o,1)}
#ftc-edit .ftc-ring{pointer-events:auto}
.ftc-epanel.top{bottom:auto;top:8px}
#ftc-edit.ptop .ftc-ehead{display:none}
.ftc-ehead{position:absolute;left:50%;top:10px;transform:translateX(-50%);width:min(560px,calc(100% - 24px));text-align:center;pointer-events:none}
.ftc-ehead b{display:block;font-size:22px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#f4ecd8}
.ftc-ehead span{font-size:15px;color:#a5a18a}
.ftc-ehead i{display:block;margin-top:4px;font-style:normal;font-size:15px;color:#e8a628}
.ftc-epanel{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:min(520px,calc(100% - 24px));display:grid;gap:6px;padding:10px 12px;background:linear-gradient(180deg,rgba(24,27,23,.96),rgba(10,12,10,.94));box-shadow:inset 0 0 0 1px rgba(236,226,198,.22),inset 0 -2px 0 #e8a628;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))}
.ftc-erow{display:grid;grid-template-columns:96px minmax(0,1fr) 52px;align-items:center;gap:10px;min-height:44px;font-size:17px}
.ftc-erow input{width:100%;height:44px;accent-color:#e8a628}
.ftc-erow output{text-align:right;font-weight:700;color:#fff;font-variant-numeric:tabular-nums}
.ftc-ename{font-size:17px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#e8a628;min-height:20px}
.ftc-ebtns{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.ftc-ebtns button{min-height:44px;padding:6px 16px;font:inherit;font-size:17px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#d8c9a3;background:rgba(0,0,0,.35);border:1px solid rgba(236,226,198,.25);cursor:pointer}
.ftc-ebtns .pri{background:#e8a628;border-color:#e8a628;color:#181407}
@media(max-height:420px){.ftc-epanel{bottom:6px;padding:6px 10px;gap:2px}.ftc-erow{min-height:44px}.ftc-ehead b{font-size:18px}.ftc-ehead span{font-size:13px}}
@media(prefers-reduced-motion:reduce){.ftc-b[data-id="interact"]{animation:none}}
`;
const icon = id => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (SVG[id] || '') + '</svg>';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createTouch(ctx) {
  const { E, store, li } = ctx, T = store.touch;
  const L = k => (LOC[k] ? LOC[k][li()] || LOC[k][0] : ctx.L(k));
  if (!document.getElementById('ftc-style')) { const st = document.createElement('style'); st.id = 'ftc-style'; st.textContent = CSS; document.head.appendChild(st); }
  const P = () => E.internals && E.internals.P, hud = () => E.internals && E.internals.hud;

  /* ---------- layout ---------- */
  let vw = innerWidth, vh = innerHeight, base = 52;
  const lay = (id, src) => { const b = BTN.find(x => x.id === id), v = (src || T.layout)[id]; return v || b.def; };
  function geom(id, src) {
    const [x, y, s] = lay(id, src), size = Math.round((id === 'stick' ? base * 1.9 : base) * s), m = 4;
    const cx = clamp(x * vw, size / 2 + m, vw - size / 2 - m), cy = clamp(y * vh, size / 2 + m, vh - size / 2 - m);
    return { cx, cy, size };
  }
  const measure = () => { vw = innerWidth; vh = innerHeight; base = clamp(Math.min(vh, vw) * 0.135, 46, 74); };

  /* ---------- DOM ---------- */
  const root = document.createElement('div'); root.id = 'ftc'; root.hidden = true; root.setAttribute('aria-hidden', 'true');
  const els = new Map();
  function makeButton(b, host) {
    const d = document.createElement('div'); d.className = 'ftc-b'; d.dataset.id = b.id;
    d.innerHTML = icon(b.id) + (b.id === 'fire' ? '' : '<em></em>') + (b.id === 'grenade' ? '<b hidden></b>' : '');
    host.appendChild(d); return d;
  }
  function makeStick(host) {
    const s = document.createElement('div'); s.className = 'ftc-stick idle'; s.dataset.id = 'stick';
    s.innerHTML = '<div class="ftc-ring"></div><div class="ftc-knob"></div><div class="ftc-run"></div>'; host.appendChild(s); return s;
  }
  for (const b of BTN) els.set(b.id, b.stick ? makeStick(root) : makeButton(b, root));
  const stickEl = els.get('stick'), ringEl = stickEl.querySelector('.ftc-ring'), knobEl = stickEl.querySelector('.ftc-knob'), runEl = stickEl.querySelector('.ftc-run');
  els.get('interact').hidden = true;
  const wheel = document.createElement('div'); wheel.className = 'ftc-wheel'; wheel.hidden = true; root.appendChild(wheel);
  document.body.appendChild(root);
  const g = {};       // id -> geometry
  let stickR = 50;
  function place(host, map, src) {
    measure();
    for (const b of BTN) {
      const d = map.get(b.id), q = geom(b.id, src); if (!d) continue; g[b.id] = q;
      const o = lay(b.id, src)[3];
      d.style.setProperty('--o', o);
      if (b.stick) {
        const r = q.size / 2; if (host === root) stickR = r;
        d.style.transform = `translate3d(${q.cx}px,${q.cy}px,0)`;
        d.querySelector('.ftc-ring').style.cssText = `left:${-r}px;top:${-r}px;width:${2 * r}px;height:${2 * r}px`;
        const k = r * 0.86; d.querySelector('.ftc-knob').style.cssText = `left:${-k / 2}px;top:${-k / 2}px;width:${k}px;height:${k}px`;
        const run = d.querySelector('.ftc-run'); if (run) run.style.top = (-r * 1.68 - 24) + 'px';
      } else {
        d.style.width = d.style.height = q.size + 'px';
        d.style.transform = `translate3d(${q.cx - q.size / 2}px,${q.cy - q.size / 2}px,0)`;
      }
    }
  }
  function texts() {
    for (const b of BTN) { const d = els.get(b.id); const em = d && d.querySelector && d.querySelector('em'); if (em && b.id !== 'interact') em.textContent = b.id === 'fire' ? '' : L(b.id); }
    runEl.textContent = L('sprint');
  }
  const applyAlpha = () => { root.style.setProperty('--ftc-o', T.alpha); };

  /* ---------- state ---------- */
  const tracks = new Map();       // touch identifier -> { role, id, x, y, x0, y0, t0, t, moved, fire }
  let crouchOn = false, aimOn = false, stickSprint = false, wheelOpen = null, interactOn = false;
  const set = (name, on) => { try { E.input.set(name, on); } catch { /* engine busy */ } };
  const tap = name => { set(name, true); set(name, false); };
  const btnDown = (id, on) => { const d = els.get(id); if (d) d.classList.toggle('dn', on); };
  function releaseAll() {
    for (const tr of tracks.values()) if (tr.role === 'btn') btnDown(tr.id, false);
    tracks.clear();
    const ax = E.input && E.input.axis; if (ax) { ax.f = 0; ax.s = 0; }
    if (stickSprint) { stickSprint = false; const p = P(); if (p) p.sprint = false; }
    for (const n of ['fire', 'jump', 'slide', 'reload', 'nextWeapon', 'grenade', 'interact', 'scoreboard']) { try { if (E.input.held(n)) set(n, false); } catch { /* ignore */ } }
    if (!T.aimHold && aimOn) { /* a toggled aim survives a pause only if the engine kept it */ aimOn = false; }
    els.get('aim').classList.toggle('on', false);
    stickIdle(); closeWheel();
  }
  function resetMatchState() { crouchOn = false; aimOn = false; els.get('crouch').classList.remove('on'); els.get('aim').classList.remove('on'); releaseAll(); }

  /* ---------- move stick ---------- */
  let sx = 0, sy = 0;
  function stickIdle() { const q = g.stick; if (!q) return; stickEl.classList.add('idle'); stickEl.classList.remove('run'); stickEl.style.transform = `translate3d(${q.cx}px,${q.cy}px,0)`; knobEl.style.transform = ''; }
  function stickStart(x, y) { const r = stickR; sx = clamp(x, r + 4, vw - r - 4); sy = clamp(y, r + 4, vh - r - 4); stickEl.classList.remove('idle'); stickEl.style.transform = `translate3d(${sx}px,${sy}px,0)`; stickMove(x, y); }
  function stickMove(x, y) {
    const r = stickR; let dx = x - sx, dy = y - sy, len = Math.hypot(dx, dy);
    if (len > r * 2.2) { const k = 1 - r * 2.2 / len; sx += dx * k; sy += dy * k; dx = x - sx; dy = y - sy; len = r * 2.2; stickEl.style.transform = `translate3d(${sx}px,${sy}px,0)`; }
    const ax = E.input.axis, dead = r * 0.14;
    if (len <= dead) { ax.f = 0; ax.s = 0; }
    else { const m = Math.min(1, (len - dead) / (r * 0.8 - dead)); ax.f = -dy / len * m; ax.s = dx / len * m; }
    const fwd = len > 0 ? -dy / len : 0, run = stickSprint ? (len > r * 1.2 && fwd > 0.7) : (len > r * 1.4 && fwd > 0.78);
    if (run !== stickSprint) { stickSprint = run; stickEl.classList.toggle('run', run); const p = P(); if (p) p.sprint = run; }
    const k = Math.min(len, run ? r * 1.25 : r) / (len || 1);
    knobEl.style.transform = `translate3d(${dx * k}px,${dy * k}px,0)`;
  }
  function stickEnd() { const ax = E.input.axis; ax.f = 0; ax.s = 0; if (stickSprint) { stickSprint = false; const p = P(); if (p) p.sprint = false; } stickIdle(); }

  /* ---------- look ---------- */
  const BASE = 0.0052;       // radians per CSS pixel at sensitivity 1 (half a phone screen ~ 120 degrees)
  function look(tr, x, y, now) {
    const dx = x - tr.x, dy = y - tr.y, dt = Math.max(4, now - tr.t); tr.x = x; tr.y = y; tr.t = now;
    if (!dx && !dy) return;
    const p = P(), a = E.player; if (!p || !a) return;
    const v = Math.hypot(dx, dy) / dt, gain = 1 + T.accel * 1.6 * clamp((v - 0.35) / 1.4, 0, 1);
    let scope = false; try { scope = !!(p.ws.length && E.internals.wNow().def.scope); } catch { /* keep */ }
    const ads = 1 - (p.ads || 0) * (1 - T.ads * (scope ? 0.3 : 0.85));
    const k = BASE * T.sens * gain * ads * ctx.assist('touch');
    a.yaw -= clamp(dx, -300, 300) * k; a.pitch = clamp(a.pitch - clamp(dy, -300, 300) * k, -1.5, 1.5);
  }

  /* ---------- gear wheel ---------- */
  const GD = () => globalThis.FZGearData;
  function wheelItems() {
    const gear = E.internals && E.internals.gear, en = !!(gear && gear.enabled), lang = ctx.LANGS[li()], out = [];
    const slots = en && gear.slots ? gear.slots : null, p = P();
    const item = (s, act) => {
      let id = slots && slots[s] ? slots[s].id : '', n = slots && slots[s] ? slots[s].n : 0;
      if (s === 'L' && p && p.gear && (!slots || n <= 0)) { id = 'frag'; n = p.gear.n; }
      const name = id && GD() ? GD().nameOf(id, lang) : (GD() ? GD().slotName(s, lang) : s);
      return { act, id, n, name, off: !id || n <= 0 || (s !== 'L' && !en) };
    };
    out.push(item('L', 'grenade')); out.push(item('T', 'tactical')); out.push(item('M', 'medical'));
    out.push({ act: 'flashlight', id: '', n: -1, name: L('torch'), off: false, torch: true });
    return out;
  }
  const OPT_POS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  let wheelSel = -1, wheelSticky = false, wheelT = 0, wx0 = 0, wy0 = 0;
  function openWheel(cx, cy) {
    const items = wheelItems(), R = 82; wheelSel = -1; wheelSticky = false; wheelT = performance.now();
    wx0 = clamp(cx, 140, vw - 140); wy0 = clamp(cy, 120, vh - 110);
    wheel.style.transform = `translate3d(${wx0}px,${wy0}px,0)`; wheel.innerHTML = '';
    items.forEach((it, i) => {
      const o = document.createElement('div'); o.className = 'ftc-opt' + (it.off ? ' off' : ''); o.dataset.i = i;
      o.style.left = OPT_POS[i][0] * R * 1.15 + 'px'; o.style.top = OPT_POS[i][1] * R * 0.78 + 'px';
      if (it.torch) o.innerHTML = '<svg viewBox="0 0 24 24">' + SVG.torch + '</svg>';
      else if (it.id) { const im = document.createElement('img'); im.alt = ''; im.src = new URL('map-shots/gear-' + it.id + '.webp', import.meta.url).href; o.appendChild(im); }
      const s = document.createElement('span'); s.textContent = it.name || L('none'); o.appendChild(s);
      if (it.n >= 0) { const c = document.createElement('small'); c.textContent = '×' + it.n; o.appendChild(c); }
      wheel.appendChild(o);
    });
    wheelOpen = items; wheel.hidden = false; btnDown('gear', true);
  }
  function wheelPick(dx, dy) {       // direction of the drag from where the thumb landed
    const d = Math.hypot(dx, dy); let sel = -1;
    if (d > 26) sel = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    if (sel !== wheelSel) { wheelSel = sel; [...wheel.children].forEach((c, i) => c.classList.toggle('sel', i === sel)); }
  }
  function wheelHit(x, y) {       // a tap on an option of a wheel left open
    for (const c of wheel.children) { const r = c.getBoundingClientRect(); if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) return +c.dataset.i; }
    return -1;
  }
  function wheelFire(i) { const it = wheelOpen && wheelOpen[i]; closeWheel(); if (it && !it.off) tap(it.act); }
  function closeWheel() { if (!wheelOpen) return; wheelOpen = null; wheel.hidden = true; wheelSel = -1; btnDown('gear', false); }

  /* ---------- buttons ---------- */
  function press(id, on, tr) {
    const p = P();
    switch (id) {
      case 'fire': set('fire', on); break;
      case 'aim': if (T.aimHold) { aimOn = on; set('aim', on); } else if (on) { aimOn = !aimOn; set('aim', aimOn); } els.get('aim').classList.toggle('on', aimOn); break;
      case 'jump': if (on && crouchOn) { crouchOn = false; set('crouch', false); els.get('crouch').classList.remove('on'); } set('jump', on); break;
      case 'crouch':
        if (on) {
          const sp = p ? Math.hypot(p.v.x, p.v.z) : 0;
          if (p && (p.sprinting || (sp > 4.4 && E.player.body && E.player.body.grounded)) && !crouchOn) { tr.slide = true; set('slide', true); }
          else { crouchOn = !crouchOn; set('crouch', crouchOn); els.get('crouch').classList.toggle('on', crouchOn); }
        } else if (tr && tr.slide) set('slide', false);
        break;
      case 'reload': set('reload', on); break;
      case 'swap': set('nextWeapon', on); break;
      case 'grenade': set('grenade', on); break;
      case 'interact': set('interact', on); break;
      case 'score': set('scoreboard', on); break;
      case 'pause': if (on) tap('pause'); break;
    }
  }
  const LOOKERS = new Set(['fire', 'aim']);       // dragging from these also turns the view (fire and aim with one thumb)
  function hitButton(x, y) {
    let best = null, bd = 1e9;
    for (const b of BTN) {
      if (b.stick) continue; const d = els.get(b.id); if (!d || d.hidden || (b.ctx && !interactOn)) continue;
      if (root.classList.contains('dead') && !['fire', 'pause', 'score'].includes(b.id)) continue;
      const q = g[b.id]; if (!q) continue; const dist = Math.hypot(x - q.cx, y - q.cy);
      if (dist <= q.size / 2 + 8 && dist < bd) { bd = dist; best = b.id; }
    }
    return best;
  }

  /* ---------- touch events (the whole layer; every touch is ours while it is shown) ---------- */
  const leftZone = x => x < vw * 0.42;
  function onStart(e) {
    e.preventDefault(); if (!fsTried) { fsTried = true; ctx.fsGesture(); }
    const now = performance.now();
    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;
      if (wheelOpen && wheelSticky) { const i = wheelHit(x, y); if (i >= 0) wheelFire(i); else closeWheel(); tracks.set(t.identifier, { role: 'none' }); continue; }
      const id = hitButton(x, y);
      if (id === 'gear') { openWheel(g.gear.cx + (g.gear.cx < vw / 2 ? 150 : -150), g.gear.cy); tracks.set(t.identifier, { role: 'wheel', x, y, t0: now }); continue; }
      if (id) { const tr = { role: 'btn', id, x, y, t: now }; tracks.set(t.identifier, tr); btnDown(id, true); press(id, true, tr); continue; }
      if (leftZone(x) && ![...tracks.values()].some(r => r.role === 'stick')) { tracks.set(t.identifier, { role: 'stick' }); stickStart(x, y); continue; }
      const tr = { role: 'look', x, y, x0: x, y0: y, t0: now, t: now, fire: false, timer: 0 };
      if (T.holdFire) tr.timer = setTimeout(() => { if (tracks.get(t.identifier) === tr && Math.hypot(tr.x - tr.x0, tr.y - tr.y0) < 14 && !E.paused) { tr.fire = true; set('fire', true); } }, 230);
      tracks.set(t.identifier, tr);
    }
  }
  function onMove(e) {
    e.preventDefault(); const now = performance.now();
    for (const t of e.changedTouches) {
      const tr = tracks.get(t.identifier); if (!tr) continue; const x = t.clientX, y = t.clientY;
      if (tr.role === 'stick') stickMove(x, y);
      else if (tr.role === 'look') look(tr, x, y, now);
      else if (tr.role === 'btn' && LOOKERS.has(tr.id)) look(tr, x, y, now);
      else if (tr.role === 'wheel') wheelPick(x - tr.x, y - tr.y);
    }
  }
  function onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const tr = tracks.get(t.identifier); if (!tr) continue; tracks.delete(t.identifier);
      if (tr.role === 'stick') stickEnd();
      else if (tr.role === 'look') { clearTimeout(tr.timer); if (tr.fire) set('fire', false); }
      else if (tr.role === 'btn') { btnDown(tr.id, false); press(tr.id, false, tr); }
      else if (tr.role === 'wheel') { if (wheelSel >= 0) wheelFire(wheelSel); else if (performance.now() - tr.t0 < 400) { wheelSticky = true; } else closeWheel(); }
    }
  }
  root.addEventListener('touchstart', onStart, { passive: false });
  root.addEventListener('touchmove', onMove, { passive: false });
  root.addEventListener('touchend', onEnd, { passive: false });
  root.addEventListener('touchcancel', e => { onEnd(e); }, { passive: false });
  root.addEventListener('contextmenu', e => e.preventDefault());
  root.addEventListener('mousedown', e => e.preventDefault());
  const noGesture = e => { if (!root.hidden) e.preventDefault(); };
  document.addEventListener('gesturestart', noGesture, { passive: false });       // iOS pinch
  document.addEventListener('dblclick', noGesture, { passive: false });

  /* ---------- visibility, contextual "use", per-frame bits ---------- */
  let shown = false, ctxT = 0, deadV = false, grenN = -2, fsTried = false;
  function visible() { return ctx.touchOn && E.running && !E.loading && !E.paused; }
  function refresh() {
    const want = visible();
    if (want !== shown) { shown = want; root.hidden = !want; if (want) { place(root, els); texts(); applyAlpha(); stickIdle(); } else releaseAll(); }
  }
  const promptText = () => {
    const H = hud(); if (!H || !H.el) return '';
    const lo = H.el.loot, pr = H.el.prompt;
    if (pr && pr._t && pr._display !== 'none') return pr._t;
    if (lo && lo._t && lo._display !== 'none') return lo._t;
    return '';
  };
  function slow() {
    const a = E.player, dead = !!(a && !a.alive); if (dead !== deadV) { deadV = dead; root.classList.toggle('dead', dead); if (dead) { releaseAll(); } }
    const pt = promptText(), on = !!pt && !dead;
    const ie = els.get('interact');
    if (on !== interactOn) { interactOn = on; ie.hidden = !on; if (!on) { for (const [k, tr] of tracks) if (tr.role === 'btn' && tr.id === 'interact') { tracks.delete(k); set('interact', false); } } }
    if (on) {
      const s = pt.replace(/\[[^\]]*\]\s*/g, '').replace(/◎/g, '').trim(), em = ie.querySelector('em'); if (em.textContent !== s) em.textContent = s.length > 30 ? s.slice(0, 29) + '…' : s;
      ie.classList.toggle('auto', !T.layout.interact);
      if (!T.layout.interact) {       // next to the prompt line, unless the player placed it
        const H = hud(), el = H && H.el && (H.el.prompt && H.el.prompt._t && H.el.prompt._display !== 'none' ? H.el.prompt : H.el.loot), r = el && el.getBoundingClientRect();
        if (r && r.width) { const q = g.interact; const cx = clamp(r.right + q.size / 2 + 14, q.size / 2 + 4, vw - q.size / 2 - 4), cy = clamp(r.top + r.height / 2, q.size / 2 + 4, vh - q.size / 2 - 4); if (Math.abs(cx - q.cx) > 2 || Math.abs(cy - q.cy) > 2) { q.cx = cx; q.cy = cy; ie.style.transform = `translate3d(${cx - q.size / 2}px,${cy - q.size / 2}px,0)`; } }
      }
    }
    // lethal count on the grenade button
    let n = -1; try { const gr = E.internals.gear, p = P(); if (gr && gr.enabled && gr.slots && gr.slots.L && gr.slots.L.n > 0) n = gr.slots.L.n; else if (p && p.gear) n = p.gear.n; } catch { n = -1; }
    if (n !== grenN) { grenN = n; const b = els.get('grenade').querySelector('b'); b.hidden = n < 0; b.textContent = String(Math.max(0, n)); els.get('grenade').classList.toggle('off', n === 0); }
    if (wheelOpen && wheelSticky && performance.now() - wheelT > 4500) closeWheel();
  }
  E.on('input', () => { if (stickSprint) { const p = P(); if (p) p.sprint = true; } });
  E.on('tick', dt => { if (!shown) return; ctxT -= dt; if (ctxT <= 0) { ctxT = 0.1; slow(); } });
  for (const ev of ['matchStart', 'matchEnd', 'quit', 'pause', 'loading', 'fatal']) E.on(ev, () => { if (ev === 'matchStart' || ev === 'matchEnd' || ev === 'quit') resetMatchState(); refresh(); });
  E.on('matchStart', () => { measureHud(); fsTried = false; });
  E.on('pause', v => { if (v) releaseAll(); else if (aimOn && !T.aimHold) set('aim', true); });
  addEventListener('resize', () => { if (shown) place(root, els); measureHud(); });
  addEventListener('blur', () => { if (shown) releaseAll(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && shown) releaseAll(); });
  ctx.on(w => { if (w === 'touch.alpha') applyAlpha(); refresh(); });
  if (ctx.i18n && ctx.i18n.on) ctx.i18n.on('change', texts);
  /* the HUD's bottom pieces shrink a little more on very short screens; the credits pill sits above them */
  function measureHud() { const hs = innerHeight < 360 ? 0.52 : innerHeight < 460 ? 0.6 : 0.72; document.documentElement.style.setProperty('--ftc-hs', hs); document.documentElement.style.setProperty('--ftc-hb', Math.round(110 * hs) + 'px'); }
  measureHud();

  /* ---------- layout editor ---------- */
  let ed = null;
  function openEditor() {
    if (ed) return;
    const work = JSON.parse(JSON.stringify(T.layout || {}));
    const host = document.createElement('div'); host.id = 'ftc-edit'; host.setAttribute('role', 'dialog'); host.setAttribute('aria-modal', 'true'); host.setAttribute('aria-label', L('edTitle'));
    host.style.setProperty('--ftc-o', T.alpha);
    const map = new Map();
    for (const b of BTN) { const d = b.stick ? makeStick(host) : makeButton(b, host); map.set(b.id, d); const em = d.querySelector('em'); if (em) em.textContent = L(b.id); if (b.stick) d.classList.remove('idle'); d.setAttribute('aria-label', L(b.id)); }
    const head = document.createElement('div'); head.className = 'ftc-ehead'; head.innerHTML = '<b></b><span></span><i></i>'; host.appendChild(head);
    head.querySelector('b').textContent = L('edTitle'); head.querySelector('span').textContent = L('edHelp');
    const panel = document.createElement('div'); panel.className = 'ftc-epanel';
    panel.innerHTML = '<div class="ftc-ename"></div><label class="ftc-erow"><span></span><input type="range" min="0.5" max="1.8" step="0.05" data-k="s"><output></output></label><label class="ftc-erow"><span></span><input type="range" min="0.15" max="1" step="0.05" data-k="o"><output></output></label><div class="ftc-ebtns"><button type="button" data-a="reset"></button><button type="button" data-a="cancel"></button><button type="button" class="pri" data-a="save"></button></div>';
    host.appendChild(panel);
    const [rs, ro] = panel.querySelectorAll('.ftc-erow');
    rs.querySelector('span').textContent = L('size'); ro.querySelector('span').textContent = L('vis');
    panel.querySelector('[data-a="reset"]').textContent = L('reset'); panel.querySelector('[data-a="cancel"]').textContent = L('cancel'); panel.querySelector('[data-a="save"]').textContent = L('save');
    document.body.appendChild(host);
    let sel = 'fire';
    const cur = id => work[id] || lay(id).slice();
    const paintSel = () => {
      const yv = cur(sel)[1], up = yv > 0.5; panel.classList.toggle('top', up); host.classList.toggle('ptop', up);
      for (const [id, d] of map) d.classList.toggle('sel', id === sel);
      const v = cur(sel); panel.querySelector('.ftc-ename').textContent = L(sel);
      const si = rs.querySelector('input'), oi = ro.querySelector('input'); si.value = v[2]; oi.value = v[3];
      rs.querySelector('output').textContent = Math.round(v[2] * 100) + ' %'; ro.querySelector('output').textContent = Math.round(v[3] * 100) + ' %';
    };
    const portraitNote = () => { head.querySelector('i').textContent = innerHeight > innerWidth ? L('edPortrait') : ''; };
    const redraw = () => { place(host, map, Object.assign({}, T.layout, work)); for (const b of BTN) { if (!work[b.id] && !T.layout[b.id]) continue; } portraitNote(); };
    redraw(); paintSel();
    let drag = null;
    host.addEventListener('pointerdown', e => {
      const d = e.target.closest && e.target.closest('.ftc-b, .ftc-stick'); if (!d || !host.contains(d)) return;
      e.preventDefault(); sel = d.dataset.id; paintSel();
      const v = cur(sel); drag = { id: sel, pid: e.pointerId, ox: e.clientX - v[0] * innerWidth, oy: e.clientY - v[1] * innerHeight };
      try { host.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    host.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.pid) return; e.preventDefault();
      const v = cur(drag.id); v[0] = clamp((e.clientX - drag.ox) / innerWidth, 0, 1); v[1] = clamp((e.clientY - drag.oy) / innerHeight, 0, 1); work[drag.id] = v; redraw();
    });
    const up = e => { if (drag && e.pointerId === drag.pid) { drag = null; } };
    host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
    panel.addEventListener('input', e => {
      const k = e.target.dataset && e.target.dataset.k; if (!k) return; const v = cur(sel); v[k === 's' ? 2 : 3] = Number(e.target.value); work[sel] = v; redraw(); paintSel();
    });
    panel.addEventListener('click', e => {
      const a = e.target.dataset && e.target.dataset.a; if (!a) return;
      if (a === 'reset') { for (const k of Object.keys(work)) delete work[k]; T.layout = {}; redraw(); paintSel(); return; }
      if (a === 'save') { T.layout = Object.assign({}, T.layout, work); for (const b of BTN) { const v = T.layout[b.id]; if (v && v.every((n, i) => Math.abs(n - b.def[i]) < 1e-3)) delete T.layout[b.id]; } ctx.save(); ctx.changed('touch.layout'); }
      close();
    });
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    const onResize = () => redraw(); addEventListener('resize', onResize);
    function close() { window.removeEventListener('keydown', onKey, true); removeEventListener('resize', onResize); host.remove(); ed = null; if (shown) place(root, els); }
    ed = { host, close };
    try { panel.querySelector('.pri').focus({ preventScroll: true }); } catch { /* optional */ }
  }

  texts(); applyAlpha(); refresh();
  return {
    refresh, openEditor, releaseAll,
    get shown() { return shown; },
    /** test hooks */
    debug: () => ({ shown, tracks: tracks.size, crouchOn, aimOn, stickSprint, interactOn, wheel: !!wheelOpen, axis: { ...E.input.axis }, geom: JSON.parse(JSON.stringify(g)) }),
  };
}
