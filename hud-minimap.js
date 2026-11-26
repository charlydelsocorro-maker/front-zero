// FRONT ZÉRO — round tactical minimap (installed by hud-theme.js). Replaces the HUD's own drawMap/setMap; the classic canvas
// stays untouched and hidden, so the classic minimap can come back at once if this one ever fails.
// Off the page's paint path: the visible canvas is handed to an OffscreenCanvas (its frames go straight to the compositor, no
// repaint or relayering of the page); a plain canvas is used where that is not supported.
// The map is drawn once per map and size into a background canvas (walls, outline, 10 m grid); each update (the engine calls
// drawMap 20 times a second, never per frame) only copies it under a rotation, then draws dots, objectives and the frame.
// Nothing is allocated per update: fonts, colours and the view-cone gradient are built at resize time.
const TAU = Math.PI * 2;
const C = {
  disk: 'rgba(9,12,11,.68)', grid: 'rgba(236,226,198,.07)', wallEdge: 'rgba(4,6,5,.85)', wall: 'rgba(214,206,182,.56)', wallHi: 'rgba(238,231,210,.74)',
  bound: 'rgba(236,226,198,.22)', band: 'rgba(5,7,6,.55)', ring: 'rgba(236,226,198,.55)', ringIn: 'rgba(236,226,198,.16)', tick: 'rgba(236,226,198,.5)',
  north: '#f0ae2e', nBack: 'rgba(5,7,6,.92)', me: '#f0ae2e', meEdge: 'rgba(0,0,0,.85)', dotEdge: 'rgba(0,0,0,.7)', text: '#fff', mkFill: 'rgba(8,10,9,.78)',
};

/** hud: the engine HUD object. Returns { el, offscreen, setMap(solids, size), draw(player, actors, classify, heading, cx, cz, hfov), show(on), resize(), invalidate() }. */
export function createMinimap({ hud, marks, opts }) {
  const wrap = document.createElement('div'); wrap.className = 'fzmm'; wrap.setAttribute('aria-hidden', 'true');       // not 'fzm': that is the menu root's class (menu.js gives it z-index 10, so the minimap drew over the pause settings)
  const el = document.createElement('canvas'); wrap.appendChild(el);
  let cv = el;
  try { if (typeof el.transferControlToOffscreen === 'function') cv = el.transferControlToOffscreen(); } catch { cv = el; }
  const ctx = cv.getContext('2d'); if (!ctx) throw new Error('no 2d context');
  hud.el.map.parentNode.insertBefore(wrap, hud.el.map);
  let S = 0, r = 0, band = 0, inner = 0, dpr = 1, k = 1, R = 30, bg = null, bgOff = 0, solids = null, size = 0, bgFor = '', shown = true;
  let fontMk = '', fontN = '', cone = null, coneR = 0, dotR = 3, pinR = 0, vig = null;
  const X = v => (v + bgOff) * k;                       // world metres -> background pixels (the zone overlay draws in this space)

  /** Measures the drawn size (only after a resize or the first time the HUD shows), then rebuilds what depends on it. */
  function resize() {
    const w = wrap.clientWidth; if (!w) return false;
    const d = Math.min(window.devicePixelRatio || 1, 2), s = Math.round(w * d);
    if (s === S && d === dpr && cone) return true;
    S = s; dpr = d; cv.width = cv.height = S; r = S / 2; band = Math.round(11 * dpr); inner = r - band; pinR = inner - 7 * dpr; dotR = 3.1 * dpr;
    fontMk = '800 ' + Math.round(10.5 * dpr) + 'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';
    fontN = '800 ' + Math.round(11 * dpr) + 'px "Barlow Condensed","Arial Narrow",Arial,sans-serif';
    coneR = inner * 0.78; cone = ctx.createRadialGradient(0, 0, 0, 0, 0, coneR); cone.addColorStop(0, 'rgba(255,236,190,.26)'); cone.addColorStop(1, 'rgba(255,236,190,0)');
    vig = ctx.createRadialGradient(0, 0, inner * 0.5, 0, 0, inner); vig.addColorStop(0, 'rgba(4,6,5,0)'); vig.addColorStop(1, 'rgba(4,6,5,.5)');       // v2: inner vignette
    bgFor = ''; return true;
  }
  /** View radius in metres from the map half-size: small maps closer, large maps wider. */
  const radiusFor = s => Math.max(26, Math.min(70, s * 0.72));
  function buildBg() {
    if (!solids || !S) return;
    R = radiusFor(size); k = inner / R; bgOff = size + 1.2;
    const span = (size * 2 + 2.4), px = Math.min(2048, Math.ceil(span * k)); k = px / span;       // very large maps: a coarser background
    const key = S + ':' + px + ':' + size; if (key === bgFor && bg) return; bgFor = key;
    if (!bg) bg = document.createElement('canvas');
    bg.width = bg.height = px; const m = bg.getContext('2d'); m.clearRect(0, 0, px, px);
    m.strokeStyle = C.grid; m.lineWidth = 1; m.beginPath();
    for (let v = Math.ceil(-size / 10) * 10; v <= size; v += 10) { const p = Math.round(X(v)) + 0.5; m.moveTo(p, X(-size)); m.lineTo(p, X(size)); m.moveTo(X(-size), p); m.lineTo(X(size), p); }
    m.stroke();
    m.strokeStyle = C.bound; m.lineWidth = Math.max(1, dpr); m.strokeRect(X(-size), X(-size), size * 2 * k, size * 2 * k);
    const keep = c => !(c.prop || c.y1 < -5 || c.mm === 0 || (c.mm !== 1 && c.y0 > 0.6) || c.y1 - c.y0 < 0.7 || (c.x1 - c.x0 > size * 1.6 && c.z1 - c.z0 > size * 1.6));
    const e = Math.max(1, dpr);
    m.fillStyle = C.wallEdge;                            // dark rim first, light fill on top: one clean outline, no seams between pieces
    for (const c of solids) if (keep(c)) m.fillRect(X(c.x0) - e, X(c.z0) - e, Math.max(1, (c.x1 - c.x0) * k) + 2 * e, Math.max(1, (c.z1 - c.z0) * k) + 2 * e);
    for (const c of solids) if (keep(c)) { m.fillStyle = c.y1 - c.y0 > 2.4 ? C.wallHi : C.wall; m.fillRect(X(c.x0), X(c.z0), Math.max(1, (c.x1 - c.x0) * k), Math.max(1, (c.z1 - c.z0) * k)); }
  }

  const api = {
    el: wrap, resize, offscreen: cv !== el,
    get rotate() { return opts.rotate; },
    setMap(sol, s) { solids = sol; size = s; bgFor = ''; if (resize()) buildBg(); },
    show(on) { if (on !== shown) { shown = on; wrap.style.display = on ? '' : 'none'; } },
    invalidate() { S = 0; },
    /** heading: radians clockwise from north. cx/cz: centre of the view (the player, or the camera while spectating). */
    draw(player, actors, classify, heading, cx, cz, hfov) {
      if (!shown || !solids) return;
      if (!S || !cone) { if (!resize()) return; }
      if (!bgFor) buildBg(); if (!bg) return;
      const c = ctx, rot = opts.rotate ? -heading : 0, cs = Math.cos(rot), sn = Math.sin(rot), kw = inner / R;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.save();                                          // no canvas clip: the canvas's own CSS border-radius cuts the circle, the bezel covers the rim
      c.fillStyle = C.disk; c.globalCompositeOperation = 'copy'; c.fillRect(0, 0, S, S); c.globalCompositeOperation = 'source-over';
      /* map and the mode's own layer, under one transform */
      c.translate(r, r); c.rotate(rot); const z = kw / k; c.scale(z, z); c.translate(-X(cx), -X(cz));
      c.drawImage(bg, 0, 0);
      if (hud.api.mapOverlay) { try { hud.api.mapOverlay(c, X, k); } catch (e) { /* the mode's layer is optional */ } }
      c.setTransform(1, 0, 0, 1, r, r);
      /* view cone */
      const fa = opts.rotate ? 0 : heading, half = Math.min(1.2, (hfov || 1.75) / 2);
      c.rotate(fa); c.fillStyle = cone; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, coneR, -Math.PI / 2 - half, -Math.PI / 2 + half); c.closePath(); c.fill();
      c.setTransform(1, 0, 0, 1, r, r);
      /* soldiers (v2: teammates as small arrows turned to where they look) */
      c.lineWidth = Math.max(1, dpr);
      const v2 = !!opts.v2, myTeam = player ? player.team : null, ar = dotR * 1.45;
      for (let i = 0; i < actors.length; i++) {
        const a = actors[i]; if (a === player || !a.alive) continue; const col = classify(a); if (!col) continue;
        const dx = (a.pos.x - cx) * kw, dz = (a.pos.z - cz) * kw, x = dx * cs - dz * sn, y = dx * sn + dz * cs;
        if (x * x + y * y > inner * inner) continue;
        c.fillStyle = col; c.strokeStyle = C.dotEdge;
        if (v2 && myTeam !== null && myTeam !== undefined && a.team === myTeam && a.kind !== 'zombie') {
          const h = rot - (a.yaw || 0), fx = Math.sin(h), fy = -Math.cos(h);       // screen direction of the mate's view
          c.beginPath(); c.moveTo(x + fx * ar * 1.25, y + fy * ar * 1.25); c.lineTo(x - fy * ar * 0.8 - fx * ar * 0.75, y + fx * ar * 0.8 - fy * ar * 0.75);
          c.lineTo(x - fx * ar * 0.3, y - fy * ar * 0.3); c.lineTo(x + fy * ar * 0.8 - fx * ar * 0.75, y - fx * ar * 0.8 - fy * ar * 0.75); c.closePath(); c.fill(); c.stroke();
        } else { c.beginPath(); c.arc(x, y, dotR, 0, TAU); c.fill(); c.stroke(); }
      }
      c.restore();
      if (v2 && vig) { c.setTransform(1, 0, 0, 1, r, r); c.fillStyle = vig; c.beginPath(); c.arc(0, 0, inner, 0, TAU); c.fill(); }
      /* frame: dark bezel band, rings, ticks every 30 degrees, north letter */
      c.setTransform(1, 0, 0, 1, r, r);
      c.lineWidth = band; c.strokeStyle = C.band; c.beginPath(); c.arc(0, 0, r - band / 2, 0, TAU); c.stroke();
      c.lineWidth = Math.max(1, dpr); c.strokeStyle = C.ringIn; c.beginPath(); c.arc(0, 0, inner, 0, TAU); c.stroke();
      c.lineWidth = 1.4 * dpr; c.strokeStyle = C.ring; c.beginPath(); c.arc(0, 0, r - 0.8 * dpr, 0, TAU); c.stroke();
      if (v2) { c.lineWidth = 2.4 * dpr; c.strokeStyle = C.north; c.beginPath(); c.arc(0, 0, r - 1.3 * dpr, -2.62, -2.2); c.stroke(); }       // v2: the panels' accent tick, fixed at the upper left
      c.rotate(rot); c.strokeStyle = C.tick; c.lineWidth = Math.max(1, dpr); c.beginPath();
      for (let i = 1; i < 12; i++) { const a = i * TAU / 12, s1 = Math.sin(a), c1 = -Math.cos(a), l = i % 3 === 0 ? band * 0.62 : band * 0.34; c.moveTo(s1 * (r - 1.5 * dpr), c1 * (r - 1.5 * dpr)); c.lineTo(s1 * (r - 1.5 * dpr - l), c1 * (r - 1.5 * dpr - l)); }
      c.stroke();
      c.setTransform(1, 0, 0, 1, r, r);
      const nx = Math.sin(rot) * (r - band / 2), ny = -Math.cos(rot) * (r - band / 2);
      c.fillStyle = C.nBack; c.beginPath(); c.arc(nx, ny, band * 0.62, 0, TAU); c.fill();
      c.font = fontN; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = C.north; c.fillText('N', nx, ny + 0.5 * dpr);
      /* objectives: inside the ring at their place, pinned to the ring when farther */
      c.font = fontMk;
      for (let i = 0; i < marks.length; i++) {
        const m = marks[i].m; if (!m || m.small) continue;
        const dx = (m.x - cx) * kw, dz = (m.z - cz) * kw; let x = dx * cs - dz * sn, y = dx * sn + dz * cs;
        const d2 = x * x + y * y, out = d2 > pinR * pinR; if (out) { const f = pinR / Math.sqrt(d2); x *= f; y *= f; }
        const col = m.color || '#e8a628', lb = m.label && String(m.label).length <= 2 ? m.label : '', rr = (out ? 3.6 : 7) * dpr;
        c.fillStyle = out ? col : C.mkFill; c.strokeStyle = out ? C.dotEdge : col; c.lineWidth = (out ? 1 : 1.6) * dpr;       // far ones: a small solid diamond on the ring (the compass gives their letter)
        c.beginPath(); c.moveTo(x, y - rr); c.lineTo(x + rr, y); c.lineTo(x, y + rr); c.lineTo(x - rr, y); c.closePath(); c.fill(); c.stroke();
        if (lb && !out) { c.fillStyle = C.text; c.fillText(lb, x, y + 0.6 * dpr); }
      }
      /* the player: a chevron at the centre */
      c.rotate(fa); const a = 6.4 * dpr;
      c.beginPath(); c.moveTo(0, -a * 1.15); c.lineTo(a * 0.82, a * 0.8); c.lineTo(0, a * 0.36); c.lineTo(-a * 0.82, a * 0.8); c.closePath();
      c.lineWidth = 2 * dpr; c.strokeStyle = C.meEdge; c.stroke(); c.fillStyle = C.me; c.fill();
      c.setTransform(1, 0, 0, 1, 0, 0);
    },
  };
  return api;
}
