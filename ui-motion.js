// FRONT ZÉRO — menu motion. Injected CSS plus a small controller that watches the menu's renders, so any screen (present or future) gets the same motion.
// Rules: transforms and opacity only, everything under about 250 ms, nothing ever blocks a click (no overlay takes pointer events, no input is delayed).
// Background: tier A = the real map already in memory, slow camera, capped frame rate (no extra load, no extra GPU memory);
//             tier B = the map's picture with a compositor-only slow move and dust (first boot, modest GPU, low quality or no WebGL). Off with reduced motion.

const CSS = `
html.fzx-on .fzx-in{animation:fzx-rise .15s cubic-bezier(.2,.75,.25,1) calc(var(--i,0) * 8ms) both}
@keyframes fzx-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
html.fzx-on .fzx-fill .fzm-stat i u{transform-origin:0 50%;animation:fzx-fill .22s cubic-bezier(.2,.7,.2,1) both}
@keyframes fzx-fill{from{transform:scaleX(0)}to{transform:none}}
html.fzx-on .fzm-enter .fzm-end-title{animation:fzx-strike .22s cubic-bezier(.16,.8,.24,1) both}
@keyframes fzx-strike{from{opacity:0;transform:translateX(-14px) scale(1.03)}to{opacity:1;transform:none}}

html.fzx-on .fzm-btn{transition:color .12s,transform .1s cubic-bezier(.2,.7,.3,1)}
html.fzx-on .fzm-btn:hover:not(:disabled){transform:translateY(-1px)}
html.fzx-on .fzm-btn:active:not(:disabled){transform:translateY(1px) scale(.985);transition-duration:.04s}
html.fzx-on .fzm-opt{transition:border-color .12s,background .12s,transform .11s cubic-bezier(.2,.7,.3,1)}
html.fzx-on .fzm-opt:hover{transform:translateX(3px)}
html.fzx-on .fzm-opt:active{transform:translateX(1px) scale(.994);transition-duration:.04s}
html.fzx-on :is(.fzm-map,.fzm-card){transition:border-color .12s,transform .12s cubic-bezier(.2,.7,.3,1)}
html.fzx-on :is(.fzm-map,.fzm-card):hover{transform:translateY(-2px)}
html.fzx-on :is(.fzm-map,.fzm-card):active{transform:translateY(0) scale(.992);transition-duration:.04s}
html.fzx-on .fzm-thumb img.is-on{transition:opacity .18s ease-out,transform .24s cubic-bezier(.2,.7,.3,1)}
html.fzx-on .fzm-map:hover .fzm-thumb img.is-on{transform:scale(1.035)}
html.fzx-on .fzm-seg button:active,html.fzx-on .fzm-tab:active,html.fzx-on .fzm-step button:active{transform:translateY(1px)}
html.fzx-on .fzm-tab{transition:color .12s,transform .08s}
html.fzx-on .fzx-pick{animation:fzx-pick .2s cubic-bezier(.2,.8,.3,1)}
@keyframes fzx-pick{0%{transform:scale(.975)}55%{transform:scale(1.012)}100%{transform:none}}
html.fzx-on .fzm-toast.is-on{animation:fzx-toast .2s cubic-bezier(.2,.8,.3,1)}
@keyframes fzx-toast{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
html.fzx-on .fzm-layer{animation:fzm-fade .12s ease-out both}
html.fzx-on .fzm-dialog{animation:fzx-rise .15s cubic-bezier(.2,.75,.25,1) both}

.fzx-tabbar{position:absolute;left:0;top:0;width:100px;height:3px;background:var(--amber);transform-origin:0 50%;pointer-events:none;z-index:3;will-change:transform}
html.fzx-on .fzx-tabbar{transition:transform .17s cubic-bezier(.3,.75,.25,1)}
html.fzx-tabs .fzm-tab::after{display:none}
.fzx-rank{animation:fzx-rank .6s ease-out}
@keyframes fzx-rank{0%,100%{opacity:1}25%{opacity:.45}55%{opacity:1}75%{opacity:.7}}

/* background */
#fzx-bg{position:fixed;inset:0;z-index:1;overflow:hidden;background:#0d0f0b;pointer-events:none;contain:strict}
#fzx-bg img{position:absolute;inset:-5%;width:110%;height:110%;object-fit:cover;opacity:0;transition:opacity .9s ease-out;filter:saturate(.8) brightness(.72)}
#fzx-bg img.on{opacity:1;animation:fzx-kb 46s ease-in-out infinite alternate;will-change:transform}
@keyframes fzx-kb{from{transform:scale(1) translate3d(-1.6%,.6%,0)}to{transform:scale(1.075) translate3d(1.8%,-1%,0)}}
#fzx-bg u{position:absolute;inset:-30% -60%;background:linear-gradient(105deg,transparent 42%,rgba(255,226,170,.075) 49%,rgba(255,226,170,.03) 53%,transparent 60%);animation:fzx-sweep 19s ease-in-out infinite alternate;will-change:transform}
@keyframes fzx-sweep{from{transform:translate3d(-16%,0,0)}to{transform:translate3d(16%,0,0)}}
#fzx-bg i{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);border-radius:50%;background:rgba(240,222,180,.5);opacity:0;animation:fzx-dust var(--d) linear var(--w) infinite;will-change:transform,opacity}
@keyframes fzx-dust{0%{opacity:0;transform:translate3d(0,0,0)}18%{opacity:.75}80%{opacity:.45}100%{opacity:0;transform:translate3d(9vw,-7vh,0)}}
#fzx-cut{position:fixed;inset:0;z-index:2;background:#090b07;opacity:0;pointer-events:none;transition:opacity .42s ease-in-out}
html.fzx-bgon .fzm{background:linear-gradient(90deg,rgba(11,13,9,.93) 0,rgba(11,13,9,.74) 34%,rgba(11,13,9,.5) 62%,rgba(11,13,9,.56) 100%),linear-gradient(180deg,rgba(9,11,7,.25) 0,rgba(9,11,7,0) 22%,rgba(9,11,7,.6) 100%)}
html.fzx-bgon .fzm.fzx-dense{background:linear-gradient(180deg,rgba(13,15,11,.87),rgba(9,11,7,.93))}
html.fzx-bgon .fzm-cta-wrap{background:linear-gradient(to bottom,rgba(13,15,11,0),rgba(13,15,11,.78) 12px)}
@media(max-width:760px){html.fzx-bgon .fzm{background:linear-gradient(180deg,rgba(11,13,9,.8),rgba(9,11,7,.9))}#fzx-bg i:nth-child(n+7){display:none}}

/* first load: runs over a menu that is already live and clickable */
#fzx-boot{position:fixed;inset:0;z-index:25;pointer-events:none;overflow:hidden;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;animation:fzx-bootout .22s ease-in 1.02s both}
@keyframes fzx-bootout{to{opacity:0}}
#fzx-boot b{position:absolute;left:0;right:0;top:0;height:2px;background:var(--amber,#e8a628);box-shadow:0 0 14px rgba(232,166,40,.75);animation:fzx-scan .62s cubic-bezier(.45,.05,.3,1) both;will-change:transform}
@keyframes fzx-scan{from{transform:translate3d(0,-4px,0)}to{transform:translate3d(0,100vh,0)}}
#fzx-boot s{position:absolute;width:26px;height:26px;border:solid var(--amber,#e8a628);border-width:0;opacity:.85;animation:fzx-corner .26s cubic-bezier(.2,.8,.3,1) both}
#fzx-boot s:nth-of-type(1){left:14px;top:14px;border-left-width:2px;border-top-width:2px;--dx:12px;--dy:12px}
#fzx-boot s:nth-of-type(2){right:14px;top:14px;border-right-width:2px;border-top-width:2px;--dx:-12px;--dy:12px}
#fzx-boot s:nth-of-type(3){left:14px;bottom:14px;border-left-width:2px;border-bottom-width:2px;--dx:12px;--dy:-12px}
#fzx-boot s:nth-of-type(4){right:14px;bottom:14px;border-right-width:2px;border-bottom-width:2px;--dx:-12px;--dy:-12px}
@keyframes fzx-corner{from{opacity:0;transform:translate(var(--dx),var(--dy))}to{opacity:.85;transform:none}}
#fzx-boot p{position:absolute;right:22px;bottom:20px;display:grid;gap:1px;text-align:right;font-size:14px;font-weight:600;letter-spacing:.16em;color:#d8c9a3;text-shadow:0 1px 2px #000}
#fzx-boot p span{opacity:0;animation:fzx-line .08s linear both}
#fzx-boot p span:nth-child(1){animation-delay:.1s}#fzx-boot p span:nth-child(2){animation-delay:.28s}#fzx-boot p span:nth-child(3){animation-delay:.46s}#fzx-boot p span:nth-child(4){animation-delay:.64s;color:#e8a628}
@keyframes fzx-line{to{opacity:1}}
html.fzx-booting .fzm-logo{animation:fzx-strike .24s cubic-bezier(.16,.8,.24,1) .08s both}
html.fzx-booting .fzm-nav{animation:fzm-fade .2s ease-out .16s both}
html.fzx-booting .fzm-id{animation:fzm-fade .2s ease-out .24s both}

/* loading screen */
html.fzx-loading #menu{display:none!important}
.ld-bar::before{content:"";position:absolute;inset:0;z-index:1;background:repeating-linear-gradient(90deg,transparent 0 calc(5% - 2px),rgba(11,13,9,.85) calc(5% - 2px) 5%);pointer-events:none}

html.fzx-rm .fzm-enter *,html.fzx-rm .fzx-pick,html.fzx-rm .fzm-toast,html.fzx-rm .fzm-logo,html.fzx-rm .fzm-nav,html.fzx-rm .fzm-id{animation:none!important}
html.fzx-rm :is(.fzm-btn,.fzm-opt,.fzm-map,.fzm-card,.fzm-tab):is(:hover,:active){transform:none!important}
html.fzx-rm .fzx-tabbar{transition:none!important}
html.fzx-rm .fzx-rank{animation:none}
`;

const BOOT = {   // fr, en, es, de, pt, it
  a: ['LIAISON', 'UPLINK', 'ENLACE', 'VERBINDUNG', 'LIGAÇÃO', 'COLLEGAMENTO'],
  b: ['ARMURERIE', 'ARMOURY', 'ARMERÍA', 'WAFFENKAMMER', 'ARMARIA', 'ARMERIA'],
  c: ['CARTOGRAPHIE', 'MAPPING', 'CARTOGRAFÍA', 'KARTIERUNG', 'CARTOGRAFIA', 'CARTOGRAFIA'],
  d: ['PRÊT', 'READY', 'LISTO', 'BEREIT', 'PRONTO', 'PRONTO'],
};
const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const shotUrl = id => new URL(`map-shots/${encodeURIComponent(id)}.webp`, import.meta.url).href;

export function install({ engine: E, settings, i18n, profile, menuRoot }) {
  if (document.getElementById('fzx-style')) return null;
  const st = document.createElement('style'); st.id = 'fzx-style'; st.textContent = CSS; document.head.append(st);
  const html = document.documentElement, mq = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => !!settings.get('gameplay.reducedMotion') || mq.matches;
  const qLevel = () => { try { return E.perf.qLevel | 0; } catch { return 4; } };
  const lowest = () => settings.get('graphics.preset') === 'bas' || qLevel() >= 4;
  const root = () => menuRoot.querySelector('.fzm');
  const shown = () => { const r = root(); return !!r && !r.hidden && menuRoot.style.display !== 'none' && !E.running && !E.loading; };
  function flags() {
    const rm = reduced();
    html.classList.toggle('fzx-rm', rm); html.classList.toggle('fzx-on', !rm && !lowest()); html.classList.add('fzx-tabs');
    bgRefresh();
  }

  /* ---------- tab indicator: one element that slides (the tabs themselves are rebuilt on each render) ---------- */
  let bar = null, barX = -1, barW = -1;
  function moveBar() {
    const r = root(); if (!r) return;
    if (!bar || !bar.isConnected) { bar = document.createElement('i'); bar.className = 'fzx-tabbar'; bar.setAttribute('aria-hidden', 'true'); r.append(bar); barX = barW = -1; }
    const tab = r.querySelector('.fzm-tab[aria-current=page]'), top = r.querySelector('.fzm-top');
    if (!tab || !top || top.hidden) { bar.style.opacity = 0; return; }
    const a = tab.getBoundingClientRect(), b = r.getBoundingClientRect(), inset = parseFloat(getComputedStyle(tab, '::after').left) || 10, x = Math.round(a.left - b.left + inset), w = Math.max(8, Math.round(a.width - inset * 2)), y = Math.round(a.bottom - b.top - 2);       // under its own tab, also when the tabs wrap on two rows
    bar.style.opacity = 1; if (x === barX && w === barW && bar._y === y) return;
    if (barX < 0 || bar._y !== y) { bar.style.transition = 'none'; bar.style.transform = `translate3d(${x}px,${y}px,0) scaleX(${w / 100})`; void bar.offsetWidth; bar.style.transition = ''; }
    else bar.style.transform = `translate3d(${x}px,${y}px,0) scaleX(${w / 100})`;
    barX = x; barW = w; bar._y = y;
  }

  /* ---------- what changed between two renders: selection, stat bars, credits, XP, level ---------- */
  let picked = new Set(), first = true; const statW = new Map();
  function selection(main) {
    const now = new Set();
    for (const e of main.querySelectorAll('[aria-checked=true][data-fid],.is-on[data-fid]')) {
      const f = e.getAttribute('data-fid'); now.add(f);
      if (!first && !picked.has(f) && !main.querySelector('.fzm-enter')) e.classList.add('fzx-pick');
    }
    picked = now;
  }
  /* the entrance is capped whatever the screen holds: a dozen visible items, stat bars in the first four (all of them at once cost 0.5 s at CPU x4 on the Arsenal) */
  const ENTER = '.fzm-opt,.fzm-map,.fzm-panel,.fzm-card,.fzm-player,.fzm-end-stat,.fzm-reward-row,.gxm-it,.fzm-slot';
  function entrance(main) {
    const v = main.querySelector('.fzm-enter'); if (!v || v._fzx || !html.classList.contains('fzx-on')) return; v._fzx = true;
    const list = v.querySelectorAll(ENTER), H = innerHeight; let n = 0;
    for (let i = 0; i < list.length && n < 12 && i < 60; i++) { const e = list[i]; if (e.parentElement.closest('.fzx-in') || e.getBoundingClientRect().top > H) continue; e.style.setProperty('--i', n); e.classList.add('fzx-in'); if (n < 4) e.classList.add('fzx-fill'); n++; }
  }
  function statBars(main) {
    const bars = main.querySelectorAll('.fzm-stat i u'); if (!bars.length || bars.length > 40) { statW.clear(); return; }
    const entering = !!main.querySelector('.fzm-enter'), on = html.classList.contains('fzx-on');
    let n = 0;
    for (const u of bars) {
      const card = u.closest('[data-fid]'), k = (card ? card.getAttribute('data-fid') : '') + ':' + (n++), w = parseFloat(u.style.width) || 0, old = statW.get(k);
      if (on && !entering && old !== undefined && Math.abs(old - w) > 0.5 && w > 0 && u.animate) { try { u.style.transformOrigin = '0 50%'; u.animate([{ transform: `scaleX(${Math.min(3, old / w)})` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' }); } catch { /* cosmetic */ } }
      statW.set(k, w);
    }
  }
  let crShown = null, crRaf = 0, lvl = null, xpFrac = null;
  const fmt = n => { try { return Math.round(n).toLocaleString(i18n.lang); } catch { return String(Math.round(n)); } };
  function counters() {
    const r = root(); if (!r) return; const P = profile.data, cr = P.cr;
    if (crShown === null) crShown = cr;
    if (cr !== crShown && !crRaf) {
      if (!html.classList.contains('fzx-on')) crShown = cr;
      else { const from = crShown, t0 = performance.now(), D = Math.min(650, 260 + Math.abs(cr - from) * .4);
        const step = now => { const k = Math.min(1, (now - t0) / D), e = 1 - (1 - k) * (1 - k), target = profile.data.cr, v = from + (target - from) * e, b = root() && root().querySelector('.fzm-cr b');
          if (b) { const s = fmt(k >= 1 ? target : v); if (b.textContent !== s) b.textContent = s; }
          if (k < 1 && shown()) crRaf = requestAnimationFrame(step); else { crRaf = 0; crShown = target; if (b) b.textContent = fmt(target); } };
        crRaf = requestAnimationFrame(step); }
    } else if (crRaf) { const b = r.querySelector('.fzm-cr b'); if (b) b.textContent = fmt(crShown); }       // a render in the middle of the count: keep counting from where it was
    const L = profile.level, xp = r.querySelector('.fzm-xp i');
    if (xp) { const f = parseFloat(xp.style.width) || 0;
      if (xpFrac !== null && Math.abs(f - xpFrac) > .2 && f > 0 && xp.animate && html.classList.contains('fzx-on')) { try { xp.style.transformOrigin = '0 50%'; xp.animate([{ transform: `scaleX(${L !== lvl ? 0 : Math.min(1, xpFrac / f)})` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' }); } catch { /* cosmetic */ } }
      xpFrac = f; }
    if (lvl !== null && L > lvl) { const k = r.querySelector('.fzm-rank'); if (k) { k.classList.remove('fzx-rank'); void k.offsetWidth; k.classList.add('fzx-rank'); } }
    lvl = L;
  }

  /* ---------- background ---------- */
  let bg = null, cut = null, imgs = [], imgI = 0, curShot = '', live = false, shots = [], shotI = 0, shotT = 0, lastMap = '', hiddenSol = false;
  const mapId = () => { const r = root(), e = r && r.querySelector('.fzm-map[aria-checked=true]'), f = e && e.getAttribute('data-fid'); return f && f.startsWith('map:') ? f.slice(4) : (E.world && E.world.id) || lastMap || 'depot'; };
  function ensureBg() {
    if (bg && bg.isConnected) return;
    bg = document.createElement('div'); bg.id = 'fzx-bg'; bg.setAttribute('aria-hidden', 'true');
    imgs = [0, 1].map(() => { const m = document.createElement('img'); m.alt = ''; m.decoding = 'async'; bg.append(m); return m; });
    bg.append(document.createElement('u'));
    for (let i = 0; i < 12; i++) { const d = document.createElement('i'), s = 1.5 + (i % 3) * 1.1; d.style.cssText = `--x:${(i * 37 + 7) % 92}%;--y:${(i * 53 + 21) % 88}%;--s:${s}px;--d:${11 + (i * 7) % 11}s;--w:-${(i * 3.7) % 13}s`; bg.append(d); }
    cut = document.createElement('div'); cut.id = 'fzx-cut';
    menuRoot.prepend(bg, cut);
  }
  function setShot(id) {
    if (id === curShot || !imgs.length) return; curShot = id;
    const next = imgs[imgI ^ 1], prev = imgs[imgI];
    next.onload = () => { if (curShot !== id) return; next.classList.add('on'); prev.classList.remove('on'); imgI ^= 1; };
    next.onerror = () => { next.onerror = null; };
    next.src = shotUrl(id);
  }
  /* Real camera: viewpoints derived from the map itself, with a clear line to what they look at. */
  function vantage() {
    const W = E.world, S = W.size || 40, out = [], free = (x, y, z) => { for (const s of W.solids) if (x > s.x0 - .4 && x < s.x1 + .4 && y > s.y0 - .4 && y < s.y1 + .4 && z > s.z0 - .4 && z < s.z1 + .4) return false; return true; };
    const indoor = W.env === 'bunker';
    const tries = [];
    if (!indoor) for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + .2; tries.push([Math.cos(a) * S * .72, 10 + (i % 3) * 2.5, Math.sin(a) * S * .72, Math.cos(a + 2.7) * S * .2, 2.2, Math.sin(a + 2.7) * S * .2]); }
    const sp = W.spawns || [];
    for (let i = 0; i < sp.length && i < 16; i++) { const a = sp[i], b = sp[(i + (sp.length >> 1)) % sp.length]; if (a && b) tries.push([a[0], 2.5, a[1], b[0], 1.6, b[1]]); }
    for (const t of tries) { if (out.length >= 4) break; if (!free(t[0], t[1], t[2])) continue; let ok = false; try { ok = E.los(t[0], t[1], t[2], t[3] + (t[0] - t[3]) * .35, t[4] + (t[1] - t[4]) * .35, t[5] + (t[2] - t[5]) * .35); } catch { ok = true; } if (ok) out.push(t); }
    return out;
  }
  let cam = null;
  function menuCamera(dt) {
    if (!shots.length) return; const K = E.internals.camera;
    shotT += Math.min(dt, .1); const LEN = 21;
    if (shotT > LEN) { shotT = 0; shotI = (shotI + 1) % shots.length; if (cut) cut.style.opacity = 0; }
    else if (shotT > LEN - .45 && cut && shots.length > 1) cut.style.opacity = 1;
    const s = shots[shotI], k = shotT / LEN, e = k * k * (3 - 2 * k), side = (e - .5) * 2.6, dx = s[3] - s[0], dz = s[5] - s[2], L = Math.hypot(dx, dz) || 1;
    K.position.set(s[0] - dz / L * side + dx / L * e * 1.2, s[1] + Math.sin(k * Math.PI) * .25, s[2] + dx / L * side + dz / L * e * 1.2);
    K.rotation.set(0, 0, 0); K.lookAt(s[3], s[4], s[5]); K.updateMatrixWorld();
  }
  function hideSoldiers() { if (hiddenSol) return; hiddenSol = true; for (const a of E.actors) { if (a.sol) { try { a.sol.setVisible(false); } catch { /* cosmetic */ } } } }
  function bgRefresh() {
    const r = root(); if (!r) return;
    const can = !E.running && !E.loading && !reduced() && !lowest() && !E.contextLost && !document.hidden;
    const realOk = can && !!E.world && !!E.world.id && qLevel() <= 2;
    const wantLive = realOk && shown();
    if (can) { ensureBg(); html.classList.add('fzx-bgon'); } else { html.classList.remove('fzx-bgon'); if (bg) { for (const m of imgs) { m.onload = m.onerror = null; m.removeAttribute('src'); } bg.remove(); bg = null; imgs = []; curShot = ''; } if (cut) { cut.remove(); cut = null; } }
    if (wantLive !== live) {
      live = wantLive;
      if (live) { lastMap = E.world.id; shots = vantage(); shotI = 0; shotT = 0; hideSoldiers(); if (!shots.length) live = false; }
    }
    if (bg) bg.style.display = live ? 'none' : '';
    if (can && !live) setShot(mapId());
    E.menuFps = live ? (qLevel() <= 1 ? 24 : 15) : 3;       // static picture: the map behind it is not visible, the GPU only idles
  }
  try {
    const W = E.world, up = W.update;
    W.update = function (dt, time, c) { up.call(W, dt, time, c); if (live && !E.running && !E.loading) { try { menuCamera(dt); } catch (e) { live = false; console.warn('[motion] menu camera', e); } } };
    E.on('matchStart', () => { live = false; hiddenSol = false; if (cut) cut.style.opacity = 0; });
    /* the match load owns the GPU: from its first event the menu leaves the page and the background is released (the menu itself only hides at matchStart) */
    let loadingNow = false;
    E.on('loading', e => { const on = !!(e && e.active); if (on === loadingNow) return; loadingNow = on; html.classList.toggle('fzx-loading', on); if (on) { live = false; hiddenSol = false; if (bootEnd) bootEnd(); } bgRefresh(); });
    E.on('contextLost', () => { live = false; bgRefresh(); });
    E.on('contextRestored', bgRefresh);
  } catch (e) { console.warn('[motion] background hook', e); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) bgRefresh(); });

  /* ---------- first load ---------- */
  let bootEnd = null;
  function boot() {
    let seen = false; try { seen = sessionStorage.getItem('fz.boot') === '1'; sessionStorage.setItem('fz.boot', '1'); } catch { /* private mode: play it */ }
    if (seen || reduced() || lowest() || E.running || E.loading) return;
    const i = Math.max(0, LANGS.indexOf(i18n.lang)), o = document.createElement('div'); o.id = 'fzx-boot'; o.setAttribute('aria-hidden', 'true');
    const p = document.createElement('p'); for (const k of ['a', 'b', 'c', 'd']) { const s = document.createElement('span'); s.textContent = (k === 'd' ? '' : '▸ ') + BOOT[k][i] + (k === 'd' ? '' : ' OK'); p.append(s); }
    o.append(document.createElement('b'), document.createElement('s'), document.createElement('s'), document.createElement('s'), document.createElement('s'), p);
    document.body.append(o); html.classList.add('fzx-booting');
    const end = () => { bootEnd = null; removeEventListener('pointerdown', end, true); removeEventListener('keydown', end, true); clearTimeout(tm); o.remove(); html.classList.remove('fzx-booting'); };
    const tm = setTimeout(end, 1300); bootEnd = end;
    addEventListener('pointerdown', end, true); addEventListener('keydown', end, true);
  }

  /* ---------- watch the renders ---------- */
  let queued = false, observed = null;
  const after = () => {
    queued = false; if (!shown()) return;
    const r = root(), main = r.querySelector('.fzm-main'); if (!main) return;
    r.classList.toggle('fzx-dense', !r.querySelector('.fzm-tab[aria-current=page][data-fid="nav:play"]'));
    try { entrance(main); moveBar(); selection(main); statBars(main); counters(); bgRefresh(); first = false; } catch (e) { console.warn('[motion] menu', e); }
  };
  const mo = new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(after); } });
  function watch() {
    const r = root(); if (!r || r === observed) return; observed = r;
    mo.disconnect(); for (const q of [r.querySelector('.fzm-main'), r.querySelector('.fzm-top')]) if (q) mo.observe(q, { childList: true });
    mo.observe(r, { attributes: true, attributeFilter: ['hidden'] });
    mo.observe(menuRoot, { attributes: true, attributeFilter: ['style', 'hidden'] });
  }
  watch();
  if (settings.on) settings.on('change', p => { if (typeof p === 'string' && (p === 'gameplay.reducedMotion' || p.startsWith('graphics.'))) flags(); });
  if (mq.addEventListener) mq.addEventListener('change', flags);
  addEventListener('resize', () => { barX = -1; if (shown()) moveBar(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { barX = -1; if (shown()) moveBar(); });
  E.on('matchEnd', () => setTimeout(() => { watch(); after(); }, 0));
  E.on('quit', () => setTimeout(() => { watch(); after(); }, 0));
  setInterval(() => { if (shown()) bgRefresh(); }, 2000);       // the quality ladder may have moved
  flags(); after(); boot();
  return { refresh: bgRefresh, get live() { return live; } };
}
