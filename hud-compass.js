// FRONT ZÉRO — compass bar at the top centre of the match HUD (installed by hud-theme.js, styles in its sheet).
// One strip of ticks and labels (720 degrees wide) is built once per size and language; each frame only slides it.
// Default route ('scroll'): the DOM strip sits in a scroller and moves by its scroll offset (an integer from a table), which Chrome
// applies on its scrolling fast path; the heading digits are three small scrollers too. Measured on this page at CPU x4: a CSS
// transform on the strip made Chrome re-layer the whole page every frame (~0.7 ms, plus style); the scroll offset does not.
// ?fzc=canvas: pre-rendered strip copied into an OffscreenCanvas each frame (lowest page lifecycle cost, but ~1 ms of script at x4).
// ?fzc=css: the strip slid by a CSS transform. Per frame, every route: no layout read, no string built, no allocation.
const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
/* N, NE, E, SE, S, SW, W, NW in each language (fr, en, es, de, pt, it) */
const CARD = [
  ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
  ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
  ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
  ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'],
  ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
];
const SPAN = 120;                 // degrees visible across the bar
const Q = 4;                      // CSS route table: one entry per quarter degree
const MAXM = 6;                   // objective markers shown on the bar
const GAP = 19;                   // px between two markers on the bar
const XS = new Float64Array(MAXM), ORD = new Int32Array(MAXM), MC = new Array(MAXM).fill(''), ML = new Array(MAXM).fill(''), ME = new Uint8Array(MAXM);
const DEG = 180 / Math.PI;
const FONT = '"Barlow Condensed","Arial Narrow",Arial,sans-serif';
const DIG = []; for (let d = 0; d < 10; d++) DIG.push('translate3d(0,' + (-d * 10) + '%,0)');

/** root: the HUD root. lang(): current language code. Returns { el, mode, update(heading, px, pz, marks), show(on), relabel(), resize(), invalidate(), clear() }.
 *  heading: radians, clockwise from north (north = -z, east = +x). marks: array of { m } (hud markers, world x/z, label, color). */
export function createCompass({ root, lang }) {
  const box = document.createElement('div'); box.className = 'fzc'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = '<div class="fzc-w"><div class="fzc-s"></div></div><div class="fzc-m"></div><i class="fzc-n"></i><b class="fzc-h"></b>';
  const win = box.firstChild, strip = win.firstChild, mk = box.children[1], hd = box.lastChild;
  /* ---------- route choice ---------- */
  let cvEl = null, ctx = null, want = 'scroll';       // measured at CPU x4: scroll ~ classic, canvas +~1 ms of script per frame, CSS transform +~2 ms (re-layering)
  try { const q = new URLSearchParams(location.search).get('fzc'); if (q === 'css' || q === 'scroll' || q === 'canvas') want = q; } catch { /* default */ }
  try {
    const c = document.createElement('canvas');
    if (want !== 'canvas') throw 0;
    if (typeof c.transferControlToOffscreen === 'function') { const off = c.transferControlToOffscreen(); const x = off.getContext('2d'); if (x) { cvEl = c; ctx = x; c.className = 'fzc-cv'; box.appendChild(c); } }
  } catch { cvEl = null; ctx = null; }
  const canvas = !!ctx, scroll = !canvas && want === 'scroll'; box.classList.toggle('fzc-c', canvas); box.classList.toggle('fzc-sc', scroll);
  root.appendChild(box);
  try { if (canvas && document.fonts) { const again = () => { W = 0; }; document.fonts.addEventListener('loadingdone', again); document.fonts.ready.then(again); } } catch { /* the bitmap keeps the fallback face */ }

  let W = 0, half = 0, ppd = 0, last = -1, lastH = -1, lang0 = '', shown = true, dirty = true, nPrev = 0;
  /* ---------- CSS route (fallback) ---------- */
  const labels = [], ticks = [], pool = [], col = [], colV = [-1, -1, -1];
  let tbl = null, mtbl = null, SXT = null, digH = 0;
  if (!canvas) {
    for (let c = 0; c < 3; c++) { const w = document.createElement('i'), u = document.createElement('u'); for (let d = 0; d < 10; d++) { const s = document.createElement('span'); s.textContent = String(d); u.appendChild(s); } w.appendChild(u); hd.appendChild(w); col.push(u); }
    for (let d = -180; d < 540; d += 5) {
      const t = document.createElement('i'); if (d % 15 === 0) t.className = 'M'; strip.appendChild(t); ticks.push({ d, el: t });
      if (d % 15 === 0) { const s = document.createElement('span'); const a = ((d % 360) + 360) % 360; s.className = a % 90 === 0 ? (a === 0 ? 'c n' : 'c') : a % 45 === 0 ? 'ic' : ''; strip.appendChild(s); labels.push({ a, el: s }); }
    }
    for (let i = 0; i < MAXM; i++) { const e = document.createElement('em'); e.innerHTML = '<b></b><s></s>'; e.style.display = 'none'; mk.appendChild(e); pool.push({ e, lab: e.lastChild, on: false, txt: '', col: '', edge: false, x: 1e9 }); }
  }
  const digit = (c, d) => { if (colV[c] !== d) { colV[c] = d; if (scroll) col[c].parentNode.scrollTop = d * digH; else col[c].style.transform = DIG[d]; } };

  /* ---------- canvas route ---------- */
  let dpr = 1, barH = 0, Hd = 0, Wd = 0, ppdD = 0, stripBm = null, fade = null, atlas = null, cw = 0, chH = 0, digY = 0, digX0 = 0, fontMk = '', fontMkE = '';
  const card = () => CARD[Math.max(0, LANGS.indexOf(lang()))];
  function buildBitmaps() {
    const c = card(), H = barH * dpr;
    if (!stripBm) stripBm = document.createElement('canvas');
    stripBm.width = Math.ceil(720 * ppdD) + 2; stripBm.height = H;
    const s = stripBm.getContext('2d'); s.clearRect(0, 0, stripBm.width, H);
    s.shadowColor = 'rgba(0,0,0,.9)'; s.shadowBlur = 2 * dpr; s.shadowOffsetY = dpr;
    s.fillStyle = 'rgba(244,240,230,.5)';
    for (let d = -180; d < 540; d += 5) if (d % 15) s.fillRect(Math.round((d + 180) * ppdD), H - Math.round(H * 0.16), Math.max(1, Math.round(dpr)), Math.round(H * 0.16));
    s.fillStyle = 'rgba(244,240,230,.85)';
    for (let d = -180; d < 540; d += 15) s.fillRect(Math.round((d + 180) * ppdD) - Math.round(dpr / 2), H - Math.round(H * 0.3), Math.max(2, Math.round(2 * dpr)), Math.round(H * 0.3));
    s.textAlign = 'center'; s.textBaseline = 'top';
    for (let d = -180; d < 540; d += 15) {
      const a = ((d % 360) + 360) % 360, x = Math.round((d + 180) * ppdD);
      if (a % 90 === 0) { s.font = '800 ' + Math.round(H * 0.56) + 'px ' + FONT; s.fillStyle = a === 0 ? '#f0ae2e' : '#fbf8f0'; s.fillText(c[a / 45], x, Math.round(H * 0.04)); }
      else if (a % 45 === 0) { s.font = '700 ' + Math.round(H * 0.44) + 'px ' + FONT; s.fillStyle = '#ece6d6'; s.fillText(c[a / 45], x, Math.round(H * 0.09)); }
      else { s.font = '600 ' + Math.round(H * 0.36) + 'px ' + FONT; s.fillStyle = 'rgba(232,226,210,.72)'; s.fillText(String(a), x, Math.round(H * 0.13)); }
    }
    if (!fade) fade = document.createElement('canvas');
    fade.width = Wd; fade.height = H; const f = fade.getContext('2d'), g = f.createLinearGradient(0, 0, Wd, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.13, '#000'); g.addColorStop(0.87, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); f.clearRect(0, 0, Wd, H); f.fillStyle = g; f.fillRect(0, 0, Wd, H);
    /* digit atlas for the heading readout */
    const fs = parseFloat(getComputedStyle(hd).fontSize) || 15, fontD = '700 ' + Math.round(fs * dpr) + 'px ' + FONT;
    if (!atlas) atlas = document.createElement('canvas');
    const a = atlas.getContext('2d'); a.font = fontD; cw = Math.ceil(a.measureText('0').width + 2 * dpr); chH = Math.round(hd.clientHeight * dpr) || Math.round(17 * dpr);
    atlas.width = cw * 10; atlas.height = chH; a.font = fontD; a.textAlign = 'center'; a.textBaseline = 'middle'; a.fillStyle = '#fbf8f0';
    for (let d = 0; d < 10; d++) a.fillText(String(d), d * cw + cw / 2, chH / 2 + dpr);
    fontMk = '800 ' + Math.round(11 * dpr) + 'px ' + FONT; fontMkE = '800 ' + Math.round(9 * dpr) + 'px ' + FONT;
  }

  function relabel() {
    const l = lang(); if (l === lang0) return; lang0 = l;
    if (canvas) { if (W) { buildBitmaps(); dirty = true; } return; }
    const c = card();
    for (const L of labels) L.el.textContent = L.a % 45 === 0 ? c[L.a / 45] : String(L.a);
  }
  /** Reads the bar size (layout read only after a resize or when the HUD first shows) and rebuilds positions, tables or bitmaps. */
  function resize() {
    const w = win.clientWidth; if (!w) return false;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    if (w === W && d === dpr && (canvas ? stripBm : tbl)) return true;
    W = w; half = Math.floor(W / 2); ppd = W / SPAN; dpr = d; last = -1; lastH = -1; dirty = true;
    if (canvas) {
      barH = win.clientHeight; Wd = Math.round(W * dpr); ppdD = ppd * dpr;
      const top = hd.offsetTop, hh = hd.offsetHeight; Hd = Math.round((top + hh) * dpr);
      cvEl.style.height = (top + hh) + 'px';
      const off = ctx.canvas; off.width = Wd; off.height = Hd;
      buildBitmaps();
      digY = Math.round(top * dpr); digX0 = Math.round(Wd / 2 - cw * 1.5);
      lang0 = lang();
      return true;
    }
    strip.style.width = Math.round(720 * ppd) + 'px';
    for (const T of ticks) T.el.style.left = Math.round((T.d + 180) * ppd) + 'px';
    for (let i = 0; i < labels.length; i++) labels[i].el.style.left = Math.round((ticks[i * 3].d + 180) * ppd) + 'px';
    if (scroll) { SXT = new Int32Array(360 * Q); for (let q = 0; q < 360 * Q; q++) SXT[q] = Math.round((q / Q + 180) * ppd - W / 2); digH = col[0].parentNode.clientHeight; for (let c = 0; c < 3; c++) colV[c] = -1; tbl = []; }
    else tbl = new Array(360 * Q); for (let q = 0; !scroll && q < 360 * Q; q++) tbl[q] = 'translate3d(' + Math.round(W / 2 - (q / Q + 180) * ppd) + 'px,0,0)';
    mtbl = new Array(2 * half + 1); for (let x = -half; x <= half; x++) mtbl[x + half] = 'translate3d(' + x + 'px,0,0)';
    for (const p of pool) p.x = 1e9;
    return true;
  }
  function hideFrom(i) { for (; i < pool.length; i++) { const p = pool[i]; if (p.on) { p.on = false; p.e.style.display = 'none'; } } }
  /* markers pass: fills XS (px from the centre), MC (colour), ML (label), ME (edge); returns how many */
  function markPass(marks, px, pz, deg) {
    let n = 0; const lim = SPAN / 2 - 3;
    if (marks) for (let i = 0; i < marks.length && n < MAXM; i++) {
      const m = marks[i].m; if (!m || m.small) continue;
      const dx = m.x - px, dz = m.z - pz; if (dx * dx + dz * dz < 0.25) continue;
      let rel = Math.atan2(dx, -dz) * DEG - deg; rel = ((rel + 540) % 360) - 180;
      const edge = rel > lim || rel < -lim;          // out of the field: pinned to its edge
      XS[n] = (edge ? (rel > 0 ? lim : -lim) : rel) * ppd; ORD[n] = n; MC[n] = m.color || '#e8a628'; ML[n] = m.label && String(m.label).length <= 2 ? String(m.label) : ''; ME[n] = edge ? 1 : 0; n++;
    }
    if (n > 1) {                                       // never two markers on top of each other: sort, then push apart
      for (let a = 1; a < n; a++) { const o = ORD[a]; let b = a - 1; while (b >= 0 && XS[ORD[b]] > XS[o]) { ORD[b + 1] = ORD[b]; b--; } ORD[b + 1] = o; }
      for (let a = 1; a < n; a++) if (XS[ORD[a]] < XS[ORD[a - 1]] + GAP) XS[ORD[a]] = XS[ORD[a - 1]] + GAP;
      if (XS[ORD[n - 1]] > half) { XS[ORD[n - 1]] = half; for (let a = n - 2; a >= 0; a--) if (XS[ORD[a]] > XS[ORD[a + 1]] - GAP) XS[ORD[a]] = XS[ORD[a + 1]] - GAP; }
    }
    for (let a = 0; a < n; a++) { let x = Math.round(XS[a]); if (x > half) x = half; else if (x < -half) x = -half; XS[a] = x; }
    return n;
  }
  function drawCanvas(q, h, n) {
    const c = ctx, H = barH * dpr;
    c.globalCompositeOperation = 'copy'; c.drawImage(stripBm, Math.round((q / Q + 180) * ppdD - Wd / 2), 0, Wd, H, 0, 0, Wd, H);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(fade, 0, 0);
    c.globalCompositeOperation = 'source-over';
    for (let a = 0; a < n; a++) {
      const x = Wd / 2 + XS[a] * dpr, y = H / 2, r = (ME[a] ? 6 : 8) * dpr;
      c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath();
      c.fillStyle = 'rgba(8,10,9,.82)'; c.fill(); c.lineWidth = 2 * dpr; c.strokeStyle = MC[a]; c.stroke();
      if (ML[a]) { c.font = ME[a] ? fontMkE : fontMk; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ME[a] ? MC[a] : '#fff'; c.fillText(ML[a], x, y + 0.5 * dpr); }
    }
    const d0 = (h / 100) | 0, d1 = ((h / 10) | 0) % 10, d2 = h % 10;
    c.drawImage(atlas, d0 * cw, 0, cw, chH, digX0, digY, cw, chH);
    c.drawImage(atlas, d1 * cw, 0, cw, chH, digX0 + cw, digY, cw, chH);
    c.drawImage(atlas, d2 * cw, 0, cw, chH, digX0 + 2 * cw, digY, cw, chH);
  }

  return {
    el: box, mode: canvas ? 'canvas' : scroll ? 'scroll' : 'css',
    relabel, resize,
    invalidate() { W = 0; },
    show(on) { if (on !== shown) { shown = on; box.style.display = on ? '' : 'none'; if (on) W = 0; } },
    update(heading, px, pz, marks) {
      if (!shown) return;
      if (!W) { if (!resize()) return; if (!canvas) relabel(); }
      let deg = heading * DEG; deg = deg % 360; if (deg < 0) deg += 360;
      let q = Math.round(deg * Q); if (q >= 360 * Q) q -= 360 * Q;
      let h = Math.round(deg); if (h >= 360) h -= 360;
      const n = markPass(marks, px, pz, deg);
      if (canvas) {
        if (!dirty && q === last && n === 0 && nPrev === 0) return;       // nothing moved (with markers on the bar it redraws: they move with the player)
        dirty = false; last = q; nPrev = n; drawCanvas(q, h, n);
        return;
      }
      if (q !== last) { last = q; if (scroll) win.scrollLeft = SXT[q]; else strip.style.transform = tbl[q]; }
      if (h !== lastH) { lastH = h; digit(0, (h / 100) | 0); digit(1, ((h / 10) | 0) % 10); digit(2, h % 10); }
      for (let a = 0; a < n; a++) {
        const p = pool[a], x = XS[a];
        if (!p.on) { p.on = true; p.e.style.display = ''; }
        if (p.x !== x) { p.x = x; p.e.style.transform = mtbl[x + half]; }
        if (p.col !== MC[a]) { p.col = MC[a]; p.e.style.color = MC[a]; }
        if (p.txt !== ML[a]) { p.txt = ML[a]; p.lab.textContent = ML[a]; }
        const e = !!ME[a]; if (p.edge !== e) { p.edge = e; p.e.classList.toggle('e', e); }
      }
      hideFrom(n);
    },
    clear() { hideFrom(0); dirty = true; },
  };
}
