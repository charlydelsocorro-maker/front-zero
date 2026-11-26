// FRONT ZÉRO — menu animations (rc8). Loaded by ui-motion.js (so ?motion=0, reduced motion and the low preset turn it off the same way:
// html.fzx-on = full motion, html.fzx-rm = fades only). Transform, opacity and clip-path only; 150-350 ms; nothing ever takes the pointer or
// waits before a click is handled. No loop runs while the menu is idle: the only idle animations are CSS ones on the compositor (the primary
// button's shimmer, the Front band's live pulse) next to the existing ui-motion background.
//  - screen changes: the new screen slides in from the side it comes from, an amber line runs along the top bar's edge
//  - cards: lift, a light sweep across the picture, a small parallax of the picture under the pointer; the hub background follows the card
//  - buttons: a press and a ripple from the pointer; the primary button shimmers now and then
//  - lists: the hub cards enter one after the other; new public rooms and new players in the room slide in; a player who gets ready pulses
//  - numbers: the XP of the top bar counts up, the level emblem pops (credits already count up in ui-motion.js)
//  - toasts and first-visit hints: a cut-corner frame that wipes in
const CSS = `
/* ---------- screen changes ---------- */
html.fzx-on .fzm-main>.fzm-enter.fza-fwd{animation:fzaInF .24s cubic-bezier(.2,.75,.25,1) backwards}
html.fzx-on .fzm-main>.fzm-enter.fza-back{animation:fzaInB .24s cubic-bezier(.2,.75,.25,1) backwards}
@keyframes fzaInF{from{opacity:0;transform:translate3d(42px,0,0)}}
@keyframes fzaInB{from{opacity:0;transform:translate3d(-42px,0,0)}}
html.fzx-rm .fzm-main>.fzm-enter.fza-fwd,html.fzx-rm .fzm-main>.fzm-enter.fza-back{animation:fzaFade .16s ease-out backwards}
@keyframes fzaFade{from{opacity:0}}
.fza-line{position:absolute;left:0;top:0;z-index:4;width:38%;height:2px;background:linear-gradient(90deg,transparent,#f0ae2e 30%,#ffe2a0 70%,transparent);box-shadow:0 0 10px rgba(240,174,46,.7);opacity:0;pointer-events:none;will-change:transform,opacity}
/* ---------- hub cards: entrance, lift, sweep ---------- */
html.fzx-on .fzh-card.fzx-in{animation:fzaCard .3s cubic-bezier(.2,.75,.25,1) calc(var(--i,0) * 55ms) backwards}
@keyframes fzaCard{from{opacity:0;transform:translate3d(0,22px,0) scale(.97)}}
html.fzx-on .fzm .fzh-card{transition:transform .18s cubic-bezier(.2,.7,.3,1),border-color .12s}
html.fzx-on .fzm .fzh-card:hover{transform:translate3d(0,-5px,0)}
html.fzx-on .fzm .fzh-card:active{transform:translate3d(0,-2px,0) scale(.992);transition-duration:.05s}
html.fzx-on .fzm .fzh-card>.fzm-thumb::after{display:block;content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(100deg,transparent 30%,rgba(255,238,200,.17) 47%,rgba(255,238,200,.05) 55%,transparent 70%);transform:translate3d(-105%,0,0)}
html.fzx-on .fzm .fzh-card:hover>.fzm-thumb::after{transform:translate3d(105%,0,0);transition:transform .34s cubic-bezier(.3,.6,.3,1)}
html.fzx-on .fzm .fzh-card .fzm-thumb img{transition:transform .3s cubic-bezier(.2,.7,.3,1),opacity .18s ease-out}
html.fzx-on .fzm :is(.fzm-map,.fzo-room) .fzm-thumb::before{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(100deg,transparent 30%,rgba(255,238,200,.16) 47%,transparent 66%);transform:translate3d(-105%,0,0);pointer-events:none}
html.fzx-on .fzm :is(.fzm-map,.fzo-room):hover .fzm-thumb::before{transform:translate3d(105%,0,0);transition:transform .32s cubic-bezier(.3,.6,.3,1)}
html.fzx-on .fzm .fzh-gearbox,html.fzx-on .fzm .fzh-cls,html.fzx-on .fzm .fzh-slot{transition:transform .16s cubic-bezier(.2,.7,.3,1),border-color .12s}
html.fzx-on .fzm .fzh-cls:hover{transform:translate3d(0,-3px,0)}
/* ---------- buttons: press, ripple, shimmer ---------- */
html.fzx-on .fzm :is(.fzh-go,.fzh-gearbtn,.fzh-back,.fzh-more):active{transform:translate3d(0,1px,0) scale(.97);transition:transform .05s}
html.fzx-on .fzm :is(.fzh-go,.fzh-back,.fzh-gearbtn){transition:transform .12s cubic-bezier(.2,.7,.3,1),color .12s}
html.fzx-on .fzm .fzh-back:hover .fzh-chev--l{transform:translate3d(-3px,0,0) rotate(-135deg)}
html.fzx-on .fzm .fzh-chev,html.fzx-on .fzm .fzh-go::after{transition:transform .14s cubic-bezier(.2,.7,.3,1)}
html.fzx-on .fzm :is(.fzh-main,.fzh-go,.fzh-gearbtn):hover :is(.fzh-chev:not(.fzh-chev--l)),html.fzx-on .fzm .fzh-main:hover .fzh-go::after,html.fzx-on .fzm .fzh-go:hover::after{transform:translate3d(4px,0,0) rotate(45deg)}
.fzm :is(.fzm-seg button,.fzm-step button,.fzo-vis>button){position:relative}
.fza-rip{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}
.fza-rip i{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(255,240,205,.34) 0,rgba(255,240,205,.18) 45%,transparent 70%);transform:scale(0);opacity:1;animation:fzaRip .34s cubic-bezier(.2,.6,.3,1) forwards;will-change:transform,opacity}
.fza-rip.is-dark i{background:radial-gradient(circle,rgba(255,255,255,.5) 0,rgba(255,255,255,.22) 45%,transparent 70%)}
@keyframes fzaRip{to{transform:scale(1);opacity:0}}
html.fzx-on .fzm :is(.fzm-cta,.fzh-go.is-primary){overflow:hidden}
html.fzx-on .fzm .fzm-cta:focus-visible,html.fzx-on .fzm .fzh-go.is-primary:focus-visible{outline-offset:-5px}
html.fzx-on .fzm .fzm-cta:not(:disabled)>span::before,html.fzx-on .fzm .fzh-go.is-primary::before{content:"";position:absolute;top:0;bottom:0;left:0;z-index:0;width:42%;background:linear-gradient(100deg,transparent 15%,rgba(255,250,232,.42) 50%,transparent 85%);transform:translate3d(-120%,0,0);animation:fzaShine 6.4s cubic-bezier(.45,.1,.3,1) 1.2s infinite;pointer-events:none;will-change:transform}
@keyframes fzaShine{0%{transform:translate3d(-120%,0,0)}9%,100%{transform:translate3d(260%,0,0)}}
/* ---------- lists ---------- */
html.fzx-on .fzm .fzo-room.is-new{animation:fzaRow .26s cubic-bezier(.2,.75,.25,1) calc(var(--i,0) * 40ms) backwards}
html.fzx-on .fzm .fzm-player.fza-row{animation:fzaRow .28s cubic-bezier(.2,.75,.25,1) backwards}
@keyframes fzaRow{from{opacity:0;transform:translate3d(-26px,0,0)}}
html.fzx-on .fzm .fzm-player.fza-ready .fzm-dot{animation:fzaReady .34s cubic-bezier(.2,.7,.3,1)}
html.fzx-on .fzm .fzm-player.fza-ready::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(156,194,100,.28),transparent 70%);opacity:0;animation:fzaReadyRow .34s ease-out;pointer-events:none}
.fzm .fzm-player{position:relative}
@keyframes fzaReady{0%{transform:rotate(45deg) scale(1)}45%{transform:rotate(45deg) scale(2.1)}100%{transform:rotate(45deg) scale(1)}}
@keyframes fzaReadyRow{30%{opacity:1}100%{opacity:0}}
html.fzx-rm .fzm :is(.fzo-room.is-new,.fzm-player.fza-row){animation:fzaFade .16s ease-out backwards}
/* ---------- numbers ---------- */
html.fzx-on .fz2-emb.fza-pop{animation:fzaPop .34s cubic-bezier(.2,.8,.3,1.2)}
@keyframes fzaPop{0%{transform:scale(.7)}60%{transform:scale(1.16)}100%{transform:none}}
/* ---------- toasts, first-visit hints ---------- */
.fzm .fzm-toast{clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);border-left-width:4px}
html.fzx-on .fzm .fzm-toast.is-on{animation:fzaToast .26s cubic-bezier(.2,.8,.3,1)}
@keyframes fzaToast{from{opacity:0;transform:translate(-50%,14px);clip-path:polygon(0 0,0 0,0 calc(100% - 10px),0 100%,0 100%)}to{opacity:1;transform:translate(-50%,0);clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}}
html.fzx-on .fzm .fzh-coach.is-new{animation:fzaCoach .3s cubic-bezier(.2,.8,.3,1) .25s backwards}
@keyframes fzaCoach{from{opacity:0;transform:translate3d(0,-8px,0);clip-path:polygon(0 0,0 0,0 calc(100% - 10px),0 100%,0 100%)}to{opacity:1;transform:none;clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}}
html.fzx-rm .fzm :is(.fzm-toast.is-on,.fzh-coach.is-new){animation:fzaFade .16s ease-out backwards}
/* ---------- the Front band on the hub: a gentle live pulse ---------- */
html.fzx-on .fzm .fzh-front .fzw-band::after{display:block;content:"";position:absolute;inset:0;width:auto;transform:none;background:none;box-shadow:inset 0 0 0 1px rgba(240,174,46,.6),inset 0 0 30px rgba(240,174,46,.12);opacity:0;animation:fzaLive 3.6s ease-in-out infinite;pointer-events:none;will-change:opacity}
@keyframes fzaLive{0%,100%{opacity:0}50%{opacity:1}}
/* reduced motion: no movement anywhere in this layer */
html.fzx-rm .fzm :is(.fzh-card,.fzh-cls,.fzh-go,.fzh-back,.fzh-gearbtn,.fzh-more):is(:hover,:active){transform:none!important}
html.fzx-rm .fza-rip,html.fzx-rm .fza-line{display:none}`;

export function install({ settings, i18n, profile, menuRoot, refreshBg }) {
  if (document.getElementById('fza-style')) return null;
  const st = document.createElement('style'); st.id = 'fza-style'; st.textContent = CSS; document.head.append(st);
  const html = document.documentElement, on = () => html.classList.contains('fzx-on');
  const fine = (() => { try { return matchMedia('(hover: hover) and (pointer: fine)'); } catch { return { matches: false }; } })();
  const root = () => menuRoot.querySelector('.fzm');

  /* ---------- screen changes ---------- */
  let lastView = null, line = null;
  function enter(main) {
    const v = main.firstElementChild; if (!v || v === lastView) return; lastView = v;
    if (!v.classList.contains('fzm-enter')) return;
    const dir = main.getAttribute('data-fz-dir') === 'back' ? 'back' : 'fwd'; main.removeAttribute('data-fz-dir');
    v.classList.add(dir === 'back' ? 'fza-back' : 'fza-fwd');
    if (!on()) return;
    const r = root(), top = r && r.querySelector('.fzm-top'); if (!r || !top || top.hidden) return;
    if (!line || !line.isConnected) { line = document.createElement('i'); line.className = 'fza-line'; line.setAttribute('aria-hidden', 'true'); r.append(line); }
    if (!line.animate) return;
    const y = top.offsetTop + top.offsetHeight - 1, w = r.clientWidth;       // one read per screen change
    const from = dir === 'back' ? w : -w * 0.4, to = dir === 'back' ? -w * 0.4 : w;
    try { line.animate([{ transform: `translate3d(${from}px,${y}px,0)`, opacity: 1 }, { transform: `translate3d(${to}px,${y}px,0)`, opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.4,.1,.3,1)' }); } catch { /* cosmetic */ }
  }

  /* ---------- ripple: from the pointer, on what was pressed ---------- */
  const RIPPLE = '.fzm-btn,.fzh-go,.fzh-main,.fzm-opt,.fzm-map,.fzh-cls,.fzm-seg button,.fzo-vis>button,.fz2-ent,.fzw-btn,.fzm-step button';
  menuRoot.addEventListener('pointerdown', e => {
    if (!on() || e.button > 0) return;
    const b = e.target.closest && e.target.closest(RIPPLE); if (!b || b.disabled || !menuRoot.contains(b)) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
    const box = document.createElement('span'); box.className = 'fza-rip' + (b.matches('.fzm-btn--primary,.fzh-go.is-primary,.fzw-btn,[aria-checked=true]') ? ' is-dark' : ''); box.setAttribute('aria-hidden', 'true');
    const dot = document.createElement('i'); dot.style.cssText = `left:${(e.clientX - r.left - d / 2).toFixed(0)}px;top:${(e.clientY - r.top - d / 2).toFixed(0)}px;width:${d.toFixed(0)}px;height:${d.toFixed(0)}px`;
    box.append(dot); b.append(box);
    setTimeout(() => box.remove(), 380);
  }, { passive: true });

  /* ---------- picture parallax under the pointer (fine pointers only), and the hub background that follows the card ---------- */
  let pCard = null, pImg = null, pRect = null, pRaf = 0, pX = 0, pY = 0, bgTimer = 0;
  const reset = () => { if (pImg) { pImg.style.transition = ''; pImg.style.transform = ''; } pCard = pImg = pRect = null; };
  menuRoot.addEventListener('pointermove', e => {
    if (!on() || !fine.matches || e.pointerType === 'touch') return;
    const c = e.target.closest && e.target.closest('.fzh-card,.fzm-map,.fzo-room');
    if (c !== pCard) {
      reset();
      if (!c) return;
      pCard = c; pImg = c.querySelector('.fzm-thumb img'); pRect = c.getBoundingClientRect();       // one read per card entered
      if (pImg) pImg.style.transition = 'transform .12s linear,opacity .18s ease-out';
      const shot = c.getAttribute('data-shot'); if (shot && refreshBg) { clearTimeout(bgTimer); bgTimer = setTimeout(() => { const r = root(); if (r && r.dataset.fzBg !== shot) { r.dataset.fzBg = shot; try { refreshBg(); } catch { /* cosmetic */ } } }, 140); }
    }
    if (!pImg || !pRect) return;
    pX = (e.clientX - pRect.left) / pRect.width - 0.5; pY = (e.clientY - pRect.top) / pRect.height - 0.5;
    if (!pRaf) pRaf = requestAnimationFrame(() => { pRaf = 0; if (!pImg) return; const k = pCard.classList.contains('fzh-card') ? 14 : 6; pImg.style.transform = `translate3d(${(-pX * k).toFixed(1)}px,${(-pY * k * 0.6).toFixed(1)}px,0) scale(1.08)`; });
  }, { passive: true });
  menuRoot.addEventListener('pointerleave', reset, { passive: true });

  /* ---------- after each menu render: screen change, room rows, ready pulses, XP count-up ---------- */
  let rows = null, ready = new Set(), rooms = null, xpShown = null, lvlShown = null, xpRaf = 0;
  const num = n => { try { return Math.round(n).toLocaleString((i18n && i18n.lang) || 'fr'); } catch { return String(Math.round(n)); } };
  function lobby(main) {
    const list = main.querySelectorAll('.fzm-lobby .fzm-player');
    if (!list.length) { rows = null; ready = new Set(); return; }
    const now = new Set(), rd = new Set();
    for (const el of list) {
      const n = el.querySelector('.fzm-player-name'), k = (n ? n.textContent : '') + '|' + (el.closest('.fzm-team--a') ? 'A' : el.closest('.fzm-team--b') ? 'B' : '');
      now.add(k); if (el.classList.contains('is-ready')) rd.add(k);
      if (rows && !rows.has(k)) el.classList.add('fza-row');
      else if (rows && rd.has(k) && !ready.has(k) && !el.classList.contains('is-bot')) el.classList.add('fza-ready');
    }
    rows = now; ready = rd;
  }
  function publicRooms(r) {
    const list = r.querySelectorAll('.fzo-room[data-fid]'); if (!list.length) return;
    const now = new Set(); let i = 0;
    for (const el of list) { const k = el.getAttribute('data-fid'); now.add(k); if (rooms && !rooms.has(k) && !el.classList.contains('is-new')) { el.classList.add('is-new'); el.style.setProperty('--i', String(i++)); } }
    rooms = now;
  }
  function counters(r) {
    if (!profile || !profile.data) return;
    const xp = profile.data.xp, lvl = profile.level, txt = r.querySelector('.fzm-xp-text');
    if (xpShown === null) { xpShown = xp; lvlShown = lvl; return; }
    if (lvl > lvlShown) requestAnimationFrame(() => { const e = r.querySelector('.fz2-emb'); if (e && on()) { e.classList.remove('fza-pop'); requestAnimationFrame(() => e.classList.add('fza-pop')); } });
    lvlShown = lvl;
    if (xp === xpShown || !txt || !on()) { xpShown = xp; return; }
    const from = xpShown % 1000, to = xp % 1000, sameLvl = Math.floor(xpShown / 1000) === Math.floor(xp / 1000), a = sameLvl ? from : 0, t0 = performance.now();
    xpShown = xp; cancelAnimationFrame(xpRaf);
    const step = t => { const k = Math.min(1, (t - t0) / 320), e = 1 - (1 - k) * (1 - k), el = root() && root().querySelector('.fzm-xp-text'); if (el) el.textContent = `${num(a + (to - a) * e)} / ${num(1000)} XP`; if (k < 1) xpRaf = requestAnimationFrame(step); else xpRaf = 0; };
    xpRaf = requestAnimationFrame(step);
  }
  let queued = false;
  const after = () => {
    queued = false; const r = root(); if (!r || r.hidden) return; const main = r.querySelector('.fzm-main'); if (!main) return;
    try {
      enter(main); lobby(main); publicRooms(r); counters(r); if (pCard && !pCard.isConnected) reset();
      const l = r.querySelector('.fzo-list'); if (l && !l._fza) { l._fza = true; mo.observe(l, { childList: true }); }       // the public list is redrawn by online-ui.js between menu renders
    } catch (e) { console.warn('[menu-anim]', e); }
  };
  const mo = new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(after); } });
  let observed = null;
  function watch() {
    const r = root(); if (!r || r === observed) return; observed = r;
    mo.disconnect();
    const main = r.querySelector('.fzm-main'), top = r.querySelector('.fzm-top');
    if (main) mo.observe(main, { childList: true });
    if (top) mo.observe(top, { childList: true });
  }
  watch(); after();
  void settings;
  return { after };
}
