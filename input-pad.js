// FRONT ZÉRO — gamepads (Gamepad API, "standard" mapping), loaded by input-hub.js when a controller shows up.
// In a match: polled in the engine's 'input' event (same frame as the player's move), left stick = analog move, right stick = look with
// deadzone, response curve, turn boost and the modest aim assist; buttons go through E.input.set like keys. Outside a match (menus, pause,
// end screens): spatial focus navigation with a visible ring, A = choose, B = back (Escape), LB/RB = tabs, right stick = scroll.
// Remapping lives in the settings (input-hub.js); glyphs follow the pad family (letters, or shapes for Sony pads).
const STD = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', '⧉', '≡', 'L3', 'R3', '↑', '↓', '←', '→', '◉'];
const SONY = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', '⧉', '≡', 'L3', 'R3', '↑', '↓', '←', '→', '◉'];
/* engine action -> gamepad action (input-hub.js PAD_ACTIONS) */
const ENGINE_TO_PAD = { reload: 'use', interact: 'use', slide: 'crouch', crouch: 'crouch', fire: 'fire', aim: 'aim', jump: 'jump', nextWeapon: 'nextWeapon', grenade: 'grenade', tactical: 'tactical', medical: 'medical', flashlight: 'flashlight', sprint: 'sprint', inspect: 'inspect', weapon1: 'weapon1', weapon2: 'weapon2', scoreboard: 'scoreboard', pause: 'pause' };
const HOLD = new Set(['fire', 'aim', 'jump', 'scoreboard', 'nextWeapon', 'grenade', 'tactical', 'medical', 'flashlight', 'inspect', 'weapon1', 'weapon2']);
const CURVE = { lin: 1, std: 1.8, fine: 2.6 };
const LOC = {       // fr, en, es, de, pt, it
  choose: ['Choisir', 'Select', 'Elegir', 'Wählen', 'Escolher', 'Scegli'],
  back: ['Retour', 'Back', 'Atrás', 'Zurück', 'Voltar', 'Indietro'],
  tabs: ['Onglets', 'Tabs', 'Pestañas', 'Reiter', 'Separadores', 'Schede'],
  scroll: ['Défiler', 'Scroll', 'Desplazar', 'Scrollen', 'Deslizar', 'Scorri'],
};
const FOCUSABLE = 'button, a[href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"]), [role=button], [role=tab], [role=switch], [role=option]';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createPad(ctx) {
  const { E, store, li } = ctx, PD = store.pad;
  const L = k => (LOC[k] ? LOC[k][li()] || LOC[k][0] : k);
  const P = () => E.internals && E.internals.P;
  let idx = -1, id = '', sony = false;
  function getPad() {
    let list = []; try { list = navigator.getGamepads ? navigator.getGamepads() : []; } catch { return null; }
    if (idx >= 0 && list[idx] && list[idx].connected) return list[idx];
    for (const gp of list) if (gp && gp.connected && gp.mapping === 'standard') { idx = gp.index; setId(gp.id); return gp; }
    for (const gp of list) if (gp && gp.connected) { idx = gp.index; setId(gp.id); return gp; }
    idx = -1; return null;
  }
  function setId(s) { if (s === id) return; id = s; sony = /054c|playstation|dualsense|dualshock|wireless controller/i.test(s); ctx.changed('padConn'); }
  const glyphForButton = i => ((sony ? SONY : STD)[i] || '?');
  const btnOf = a => ctx.padButton(a);

  /* ---------- reading ---------- */
  const N = 17, now = new Uint8Array(N), was = new Uint8Array(N), axes = new Float32Array(4);
  let connectedV = false;
  function read() {
    const gp = getPad();
    if (!gp) { if (connectedV) { connectedV = false; lost(); ctx.changed('padConn'); } return false; }
    if (!connectedV) { connectedV = true; ctx.changed('padConn'); }
    was.set(now);
    for (let i = 0; i < N; i++) { const b = gp.buttons[i]; const v = b ? (typeof b === 'object' ? b.value || (b.pressed ? 1 : 0) : b) : 0; now[i] = (i === 6 || i === 7) ? (v > 0.3 ? 1 : 0) : (b && (b.pressed || v > 0.5) ? 1 : 0); }
    for (let i = 0; i < 4; i++) axes[i] = gp.axes[i] || 0;
    return true;
  }
  const edge = i => now[i] && !was[i], rel = i => !now[i] && was[i];
  function activity() {
    for (let i = 0; i < N; i++) if (now[i]) return true;
    for (let i = 0; i < 4; i++) if (Math.abs(axes[i]) > Math.max(0.35, PD.dead + 0.1)) return true;
    return false;
  }
  function stick(x, y, out) {
    const m = Math.hypot(x, y), d = PD.dead;
    if (m <= d) { out[0] = 0; out[1] = 0; out[2] = 0; return out; }
    const k = Math.min(1, (m - d) / (1 - d)); out[0] = x / m; out[1] = y / m; out[2] = k; return out;
  }
  const LS = [0, 0, 0], RS = [0, 0, 0];

  /* ---------- in a match ---------- */
  const set = (name, on) => { try { E.input.set(name, on); } catch { /* engine busy */ } };
  const tap = name => { set(name, true); set(name, false); };
  let crouchOn = false, moving = false, boost = 0, boostT = 0, useAs = '', slideHeld = false;
  const promptOn = () => { try { const H = E.internals.hud; if (!H || !H.el) return false; const pr = H.el.prompt, lo = H.el.loot; return !!((pr && pr._t && pr._display !== 'none') || (lo && lo._t && lo._display !== 'none')); } catch { return false; } };
  function releaseAll() {
    for (const n of ['fire', 'aim', 'jump', 'scoreboard', 'nextWeapon', 'grenade', 'tactical', 'medical', 'flashlight', 'inspect', 'weapon1', 'weapon2', 'reload', 'interact', 'slide']) { try { if (E.input.held(n)) set(n, false); } catch { /* ignore */ } }
    if (moving) { moving = false; const ax = E.input.axis; if (ax) { ax.f = 0; ax.s = 0; } }
    useAs = ''; slideHeld = false; boost = 0; boostT = 0;
  }
  function lost() { releaseAll(); if (ctx.padActive) ctx.setPadActive(false); }
  function gameplay(dt) {
    const p = P(), a = E.player; if (!p || !a) return;
    // move
    stick(axes[0], axes[1], LS);
    const ax = E.input.axis;
    if (LS[2] > 0) { ax.f = -LS[1] * LS[2]; ax.s = LS[0] * LS[2]; moving = true; }
    else if (moving) { ax.f = 0; ax.s = 0; moving = false; }
    // look
    stick(axes[2], axes[3], RS);
    if (RS[2] > 0 && a.alive) {
      const c = Math.pow(RS[2], CURVE[PD.curve] || 1.8);
      if (RS[2] > 0.96) { boostT += dt; if (boostT > 0.22) boost = Math.min(1, boost + dt / 0.35); } else { boostT = 0; boost = Math.max(0, boost - dt * 4); }
      let scope = false; try { scope = !!(p.ws.length && E.internals.wNow().def.scope); } catch { /* keep */ }
      const ads = 1 - (p.ads || 0) * (1 - PD.ads * (scope ? 0.55 : 1));
      const k = PD.sens * c * (1 + boost * 0.55) * ads * ctx.assist('pad') * dt;
      a.yaw -= RS[0] * 3.3 * k; a.pitch = clamp(a.pitch - RS[1] * 2.3 * k * (PD.invert ? -1 : 1), -1.5, 1.5);
    } else { boostT = 0; boost = 0; }
    // buttons
    for (const act of ctx.PAD_ACTIONS) {
      const b = btnOf(act); if (b === undefined) continue;
      if (edge(b)) down(act, p); else if (rel(b)) up(act);
    }
  }
  function down(act, p) {
    switch (act) {
      case 'crouch': {
        const sp = Math.hypot(p.v.x, p.v.z);
        if (!crouchOn && (p.sprinting || (sp > 4.4 && E.player.body && E.player.body.grounded))) { slideHeld = true; set('slide', true); }
        else { crouchOn = !crouchOn; set('crouch', crouchOn); }
        return;
      }
      case 'jump': if (crouchOn) { crouchOn = false; set('crouch', false); } set('jump', true); return;
      case 'use': useAs = promptOn() ? 'interact' : 'reload'; set(useAs, true); return;
      case 'sprint': tap('sprint'); return;
      case 'pause': tap('pause'); return;
      default: if (HOLD.has(act)) set(act, true);
    }
  }
  function up(act) {
    if (act === 'crouch') { if (slideHeld) { slideHeld = false; set('slide', false); } return; }
    if (act === 'use') { if (useAs) set(useAs, false); useAs = ''; return; }
    if (HOLD.has(act)) set(act, false);
  }
  E.on('input', dt => {
    if (!read()) return;
    if (activity() && !ctx.padActive) ctx.setPadActive(true);
    if (capture) { captureStep(); return; }
    if (!ctx.padActive) return;
    gameplay(dt);
  });
  for (const ev of ['matchStart', 'matchEnd', 'quit']) E.on(ev, () => { crouchOn = false; releaseAll(); });
  E.on('pause', v => { if (v) { useAs = ''; slideHeld = false; if (moving) { moving = false; const ax = E.input.axis; ax.f = 0; ax.s = 0; } } });

  /* ---------- capture for remapping ---------- */
  let capture = null;
  function captureStep() {
    for (let i = 0; i < N; i++) if (edge(i)) { const c = capture; capture = null; clearTimeout(c.timer); c.cb(i); return; }
  }
  function startCapture(cb) {
    if (capture) { clearTimeout(capture.timer); capture.cb(null); }
    capture = { cb, timer: setTimeout(() => { const c = capture; capture = null; if (c) c.cb(null); }, 8000) };
    loop();
  }

  /* ---------- menus: spatial focus ---------- */
  const vis = e => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  function layer() {
    const modal = [...document.querySelectorAll('[aria-modal="true"], [role="dialog"], [role="alertdialog"], #fz-fatal')].filter(vis);
    if (modal.length) return modal[modal.length - 1];
    if (E.running && E.paused) { const pz = document.querySelector('#hud [data-h="pause"]'); if (pz && vis(pz)) return pz; }
    const pts = [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.25, 0.75], [0.75, 0.75], [0.5, 0.15], [0.5, 0.85]], count = new Map();
    for (const [fx, fy] of pts) {
      let e = document.elementFromPoint(innerWidth * fx, innerHeight * fy);
      while (e && e.parentElement && e.parentElement !== document.body) e = e.parentElement;
      if (e && e !== document.body && e.id !== 'c' && e.id !== 'ftc' && e.id !== 'fzpad-hint') count.set(e, (count.get(e) || 0) + 1);
    }
    let best = null, n = 0; for (const [e, c] of count) if (c > n) { n = c; best = e; }
    return best || document.getElementById('menu') || document.body;
  }
  function onTop(el) {
    const r = el.getBoundingClientRect(), x0 = Math.max(0, r.left), x1 = Math.min(innerWidth, r.right), y0 = Math.max(0, r.top), y1 = Math.min(innerHeight, r.bottom);
    if (x1 - x0 < 2 || y1 - y0 < 2) return true;       // scrolled out of view: reachable by scrolling
    const hit = document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2);
    return !!hit && (hit === el || el.contains(hit) || (hit.tagName === 'LABEL' && hit.contains(el)) || (el.labels && [...el.labels].some(l => l.contains(hit))));
  }
  function candidates(root) {
    const out = [];
    for (const e of root.querySelectorAll(FOCUSABLE)) {
      if (e.disabled || e.closest('[inert], [aria-hidden="true"]')) continue;
      const tgt = ringOf(e); if (!vis(tgt)) continue;
      if (getComputedStyle(e).pointerEvents === 'none' && e.tagName !== 'INPUT') continue;
      if (!onTop(tgt) || big(tgt)) continue;
      out.push(e);
    }
    return out;
  }
  const ringOf = e => (e.tagName === 'INPUT' && (e.type === 'checkbox' || e.type === 'radio') && e.closest('label')) || e;
  let ringEl = null;
  function focusEl(e) {
    if (!e) return;
    try { e.focus({ preventScroll: true }); } catch { /* not focusable */ }
    const r = ringOf(e); if (ringEl && ringEl !== r) ringEl.classList.remove('fzpad-f'); ringEl = r; r.classList.add('fzpad-f');
    try { r.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { /* old browser */ }
  }
  const big = e => { const r = e.getBoundingClientRect(); return r.width * r.height > innerWidth * innerHeight * 0.3; };       // a scrolling panel that takes focus is not a control
  const current = root => { const a = document.activeElement; return a && a !== document.body && root.contains(a) && vis(ringOf(a)) && !big(a) ? a : null; };
  function preferred(list) {
    return list.find(e => e.matches('.fzm-cta, [data-fid="resume"], [data-h="resume"], .is-primary, .pri')) || list.slice().sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); })[0];
  }
  function move(dx, dy) {
    const root = layer(), list = candidates(root); if (!list.length) return;
    const cur = current(root);
    if (!cur) { focusEl(preferred(list)); return; }
    const a = ringOf(cur).getBoundingClientRect(), ax = (a.left + a.right) / 2, ay = (a.top + a.bottom) / 2;
    let best = null, bs = 1e12;
    for (const e of list) {
      if (e === cur || ringOf(e) === ringOf(cur)) continue;
      const r = ringOf(e).getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      const along = dx ? (cx - ax) * dx : (cy - ay) * dy; if (along < 4) continue;
      const overlap = dx ? Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top) : Math.min(a.right, r.right) - Math.max(a.left, r.left);
      const across = overlap > 0 ? 0 : Math.abs(dx ? cy - ay : cx - ax);
      const s = along + across * 2.4; if (s < bs) { bs = s; best = e; }
    }
    if (best) focusEl(best);
    else if (dy) { const sc = scroller(cur); if (sc) sc.scrollBy(0, dy * 160); }
  }
  function scroller(e) { for (let n = e; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 4) return n; } return document.scrollingElement; }
  function choose() {
    const root = layer(), cur = current(root);
    if (!cur) { const list = candidates(root); focusEl(preferred(list)); return; }
    if (cur.tagName === 'SELECT') { cycleSelect(cur, 1); return; }
    if (cur.tagName === 'INPUT' && cur.type === 'range') return;
    if (cur.tagName === 'INPUT' && (cur.type === 'text' || cur.type === 'search' || cur.type === '')) { cur.focus(); return; }
    cur.click();
  }
  function cycleSelect(s, d) { const n = s.options.length; if (!n) return; s.selectedIndex = (s.selectedIndex + d + n) % n; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }
  function adjust(d) {       // left/right on a slider or a list
    const cur = document.activeElement; if (!cur) return false;
    if (cur.tagName === 'INPUT' && cur.type === 'range') { try { if (d > 0) cur.stepUp(); else cur.stepDown(); } catch { return false; } cur.dispatchEvent(new Event('input', { bubbles: true })); cur.dispatchEvent(new Event('change', { bubbles: true })); return true; }
    if (cur.tagName === 'SELECT') { cycleSelect(cur, d); return true; }
    return false;
  }
  function back() {
    if (E.running && E.paused) {
      const sb = document.querySelector('#hud [data-h="psetback"]'); if (sb && vis(sb)) { sb.click(); return; }
      tap('pause'); return;
    }
    const tgt = document.activeElement && document.activeElement !== document.body ? document.activeElement : document;
    const ev = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }); ev.__fzPad = true; tgt.dispatchEvent(ev);
    const ev2 = new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true }); ev2.__fzPad = true; tgt.dispatchEvent(ev2);
  }
  function tabs(d) {
    const sets = ['.fzs-tab[role="tab"]', '[data-fid^="shop:tab:"]', '.fzp [role="tab"]', '[data-fid^="nav:"]'];
    const root = layer();
    for (const sel of sets) {
      const list = [...document.querySelectorAll(sel)].filter(e => vis(e) && (root.contains(e) || sel === '[data-fid^="nav:"]') && onTop(e)); if (list.length < 2) continue;
      let i = list.findIndex(e => e.getAttribute('aria-selected') === 'true' || e.getAttribute('aria-current') === 'page' || e.classList.contains('on') || e.classList.contains('is-on') || e.classList.contains('active'));
      if (i < 0) i = 0; const n = list[(i + d + list.length) % list.length]; n.click(); setTimeout(() => focusEl(n.isConnected ? n : null), 60); return;
    }
  }
  let rep = { k: '', t: 0 };
  function menus(dt) {
    if (!ctx.padActive) return;
    const dirs = [[12, 0, -1], [13, 0, 1], [14, -1, 0], [15, 1, 0]];
    let k = '', dx = 0, dy = 0;
    for (const [b, x, y] of dirs) if (now[b]) { k = 'd' + b; dx = x; dy = y; }
    if (!k) { const lx = axes[0], ly = axes[1]; if (Math.hypot(lx, ly) > 0.55) { if (Math.abs(lx) > Math.abs(ly)) { dx = Math.sign(lx); k = 'x' + dx; } else { dy = Math.sign(ly); k = 'y' + dy; } } }
    if (k) {
      const t = performance.now();
      if (k !== rep.k) { rep = { k, t: t + 380 }; step(dx, dy); }
      else if (t >= rep.t) { rep.t = t + 120; step(dx, dy); }
    } else rep.k = '';
    if (edge(0)) choose();
    if (edge(1)) back();
    if (edge(4)) tabs(-1);
    if (edge(5)) tabs(1);
    if (edge(9) && E.running && E.paused) tap('pause');
    const ry = Math.abs(axes[3]) > 0.25 ? axes[3] : 0;
    if (ry) { const cur = current(layer()); const sc = scroller(cur || layer()); if (sc) sc.scrollBy(0, ry * 900 * dt); }
  }
  function step(dx, dy) { if (dx && adjust(dx)) return; move(dx, dy); }

  /* ---------- menu loop: only while a pad is connected and no match is being played ---------- */
  let raf = 0, lastT = 0;
  function loop() {
    if (raf) return;
    lastT = performance.now();
    const tick = t => {
      raf = 0;
      const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
      const playing = E.running && !E.paused && !E.loading;
      if (!playing) {
        if (!read()) { hint(); if (!connectedV && !capture) return; }
        else {
          if (activity() && !ctx.padActive) ctx.setPadActive(true);
          if (capture) captureStep(); else menus(dt);
        }
      }
      hint();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  addEventListener('gamepadconnected', () => { getPad(); loop(); });
  addEventListener('gamepaddisconnected', () => { setTimeout(() => { if (!getPad()) lost(); ctx.changed('padConn'); }, 50); });

  /* ---------- hint bar and focus ring ---------- */
  const st = document.createElement('style'); st.textContent = `
#fzpad-ring{position:fixed;left:0;top:0;z-index:96;pointer-events:none;border:3px solid #f0ae2e;border-radius:3px;box-shadow:0 0 0 3px rgba(0,0,0,.5),0 0 16px rgba(240,174,46,.55);transition:transform .07s ease-out,width .07s,height .07s}
#fzpad-ring[hidden]{display:none}
#fzpad-hint{position:fixed;left:12px;bottom:10px;z-index:95;display:flex;gap:14px;align-items:center;padding:6px 12px;font:700 15px/1 'Barlow Condensed','Arial Narrow',Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#d8c9a3;background:linear-gradient(180deg,rgba(24,27,23,.94),rgba(10,12,10,.9));box-shadow:inset 0 0 0 1px rgba(236,226,198,.2),inset 0 -2px 0 #e8a628;pointer-events:none}
#fzpad-hint[hidden]{display:none}
#fzpad-hint span{display:inline-flex;align-items:center;gap:6px}
#fzpad-hint kbd{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 5px;border-radius:12px;font:800 13px/1 'Barlow Condensed','Arial Narrow',Arial,sans-serif;color:#16130a;background:linear-gradient(180deg,#f8d27a,#e2a43a)}`;
  document.head.appendChild(st);
  let hintEl = null, hintK = '', ringBox = null, rk = '';
  /* the focus ring is drawn over the control, not as its outline: the v2 buttons are cut with clip-path, which would clip an outline */
  function ring() {
    const a = document.activeElement, tgt = a && a !== document.body ? ringOf(a) : null;
    if (!ringBox) { ringBox = document.createElement('div'); ringBox.id = 'fzpad-ring'; ringBox.setAttribute('aria-hidden', 'true'); document.body.appendChild(ringBox); }
    if (!tgt || !vis(tgt) || big(tgt)) { ringBox.hidden = true; rk = ''; return; }
    const r = tgt.getBoundingClientRect(), k = Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width) + ',' + Math.round(r.height);
    ringBox.hidden = false; if (k === rk) return; rk = k;
    ringBox.style.transform = 'translate(' + Math.round(r.left - 5) + 'px,' + Math.round(r.top - 5) + 'px)'; ringBox.style.width = Math.round(r.width + 10) + 'px'; ringBox.style.height = Math.round(r.height + 10) + 'px';
  }
  function hint() {
    const want = ctx.padActive && connectedV && !(E.running && !E.paused && !E.loading);
    if (!want) { if (hintEl) hintEl.hidden = true; if (ringBox) ringBox.hidden = true; if (ringEl && !ctx.padActive) { ringEl.classList.remove('fzpad-f'); ringEl = null; } return; }
    ring();
    if (!hintEl) { hintEl = document.createElement('div'); hintEl.id = 'fzpad-hint'; hintEl.setAttribute('aria-hidden', 'true'); document.body.appendChild(hintEl); }
    const k = li() + (sony ? 's' : 'x');
    if (k !== hintK) { hintK = k; const g = glyphForButton; hintEl.innerHTML = `<span><kbd>${g(0)}</kbd>${L('choose')}</span><span><kbd>${g(1)}</kbd>${L('back')}</span><span><kbd>${g(4)}</kbd><kbd>${g(5)}</kbd>${L('tabs')}</span>`; }
    hintEl.hidden = false;
  }

  /* ---------- rumble ---------- */
  function rumble(kind) {
    const gp = getPad(), va = gp && gp.vibrationActuator; if (!va || !va.playEffect) return;
    const o = kind === 'kill' ? { duration: 150, strongMagnitude: 0.55, weakMagnitude: 0.45 } : kind === 'hurt' ? { duration: 120, strongMagnitude: 0.4, weakMagnitude: 0.15 } : { duration: 40, strongMagnitude: 0, weakMagnitude: 0.32 };
    try { const r = va.playEffect('dual-rumble', Object.assign({ startDelay: 0 }, o)); if (r && r.catch) r.catch(() => {}); } catch { /* not supported */ }
  }

  getPad(); loop();
  return {
    connected: () => !!getPad(),
    name: () => String(id || '').replace(/\s*\(.*$/, '').slice(0, 40) || 'Gamepad',
    glyphForButton,
    glyphForAction: a => { const pa = ENGINE_TO_PAD[a]; if (!pa) return null; const b = btnOf(pa); return b === undefined ? null : glyphForButton(b); },
    capture: startCapture,
    rumble,
    releaseAll,
    debug: () => ({ connected: connectedV, active: ctx.padActive, idx, id, crouchOn, moving, focus: document.activeElement && (document.activeElement.getAttribute('data-fid') || document.activeElement.className || document.activeElement.tagName) }),
  };
}
