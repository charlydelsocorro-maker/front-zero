// FRONT ZÉRO — small network indicator in the match HUD: ping, and a warning when the connection degrades.
// Loaded by main.js with a dynamic import: if it fails, the game simply has no indicator. Two DOM reads of the network state per second, no write when nothing changed.
const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const L = {
  unstable: ['Connexion instable', 'Unstable connection', 'Conexión inestable', 'Instabile Verbindung', 'Ligação instável', 'Connessione instabile'],
  lost: ['Connexion perdue…', 'Connection lost…', 'Conexión perdida…', 'Verbindung verloren…', 'Ligação perdida…', 'Connessione persa…'],
};
const WARN_RTT = 180, WARN_JITTER = 90, LOST_MS = 4500, OK_RTT = 140, OK_JITTER = 60;

export function install({ net, engine, settings, hudRoot }) {
  if (!net || !net.quality || !engine || !hudRoot) return null;
  const el = document.createElement('div');
  el.dataset.h = 'net';
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:absolute;left:18px;top:194px;display:none;align-items:center;gap:5px;font:600 12px/1 system-ui,sans-serif;color:#b9c4a8;background:rgba(10,12,8,.55);padding:4px 7px;border-radius:3px;pointer-events:none;white-space:nowrap;font-variant-numeric:tabular-nums';
  el.innerHTML = '<svg width="12" height="11" viewBox="0 0 12 11" aria-hidden="true" style="display:none"><path d="M6 .5 11.6 10.5H.4Z" fill="#e8b23a"/><path d="M5.4 4h1.2v3.4H5.4zM5.4 8.2h1.2v1.2H5.4z" fill="#14160f"/></svg><span></span>';
  const icon = el.firstChild, label = el.lastChild;
  hudRoot.appendChild(el);
  let timer = 0, shown = false, warn = false, okN = 0, text = '', color = '';
  const lang = () => { const i = LANGS.indexOf(String(settings && settings.get('language') || 'fr').slice(0, 2)); return i < 0 ? 0 : i; };
  const enabled = () => !settings || settings.get('graphics.showNet') !== false;
  const show = v => { if (v !== shown) { shown = v; el.style.display = v ? 'flex' : 'none'; } };
  function update() {
    try {
      if (!enabled()) return show(false);
      const q = net.quality();
      const lost = !q.connected || q.pongAge > LOST_MS;
      if (q.rtt > WARN_RTT || q.jitter > WARN_JITTER || lost) { warn = true; okN = 0; }
      else if (warn && q.rtt < OK_RTT && q.jitter < OK_JITTER && ++okN >= 4) warn = false;       // about two calm seconds before the icon goes away
      const t = lost ? L.lost[lang()] : warn ? `${Math.round(q.rtt)} ms · ${L.unstable[lang()]}` : `${Math.round(q.rtt)} ms`;
      if (t !== text) { text = t; label.textContent = t; }
      const c = warn || lost ? '#e8b23a' : '#b9c4a8';
      if (c !== color) { color = c; el.style.color = c; icon.style.display = warn || lost ? 'block' : 'none'; }
      show(true);
    } catch { show(false); }
  }
  const stop = () => { clearInterval(timer); timer = 0; show(false); warn = false; okN = 0; };
  const offs = [
    engine.on('matchStart', c => { stop(); if (c && c.online) { update(); timer = setInterval(update, 500); } }),
    engine.on('matchEnd', stop), engine.on('quit', stop),
  ];
  return { destroy() { stop(); for (const f of offs) { try { f && f(); } catch { /* ignore */ } } el.remove(); } };
}
