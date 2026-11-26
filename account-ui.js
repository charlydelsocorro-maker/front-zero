// FRONT ZÉRO — player accounts, client entry point. Loaded by main.js after the menu (small; no network and no Google script for a guest).
// Shows « Continuer avec Google » (guest) or the account pseudo (signed in) in three slots the menu leaves empty:
//   .fzh-acct  hub title row (menu-flow.js hub())       .fzm-acct  top bar profile area, after the credits (menu.js renderTop())
//   .fzh-legal hub footer: Confidentialité · Mentions légales
// When a slot is missing (another menu layout) it is created at the same place, so the entry never disappears.
// The panel (account-panel.js, which loads Google Identity Services) and the sync (account-sync.js) load on demand:
// the sync right away only for a signed-in player, the panel on click. Google's client ID comes from <meta name="fz-google-client">;
// without it the Google entry is hidden (an existing session still syncs) and nothing else changes.
// Dev (?dev=1): window.__fz.account = { state, open(), syncNow(), signOut() ... } once loaded.
const KEY = 'frontzero.account';
const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
export const DISCORD = 'https://discord.gg/Mq3qs22vUR';       // official server, permanent invite
const TX = {
  google: ['Continuer avec Google', 'Continue with Google', 'Continuar con Google', 'Weiter mit Google', 'Continuar com Google', 'Continua con Google'],
  googleShort: ['Connexion', 'Sign in', 'Entrar', 'Anmelden', 'Entrar', 'Accedi'],
  saveSub: ['Garde ta progression partout', 'Keep your progress everywhere', 'Guarda tu progreso en todas partes', 'Fortschritt überall behalten', 'Guarda o teu progresso em todo o lado', 'Conserva i progressi ovunque'],
  account: ['Compte', 'Account', 'Cuenta', 'Konto', 'Conta', 'Account'],
  synced: ['Compte · synchronisé', 'Account · synced', 'Cuenta · sincronizada', 'Konto · synchronisiert', 'Conta · sincronizada', 'Account · sincronizzato'],
  pending: ['Compte · à synchroniser', 'Account · sync pending', 'Cuenta · sin sincronizar', 'Konto · Sync ausstehend', 'Conta · por sincronizar', 'Account · da sincronizzare'],
  offline: ['Compte · hors ligne', 'Account · offline', 'Cuenta · sin conexión', 'Konto · offline', 'Conta · offline', 'Account · offline'],
  privacy: ['Confidentialité', 'Privacy', 'Privacidad', 'Datenschutz', 'Privacidade', 'Privacy'],
  legal: ['Mentions légales', 'Legal notice', 'Aviso legal', 'Impressum', 'Aviso legal', 'Note legali'],
  nameLocked: ['Ton pseudo de compte (les autres joueurs voient celui-ci)', 'Your account nickname (this is what other players see)', 'Tu apodo de cuenta (es el que ven los demás)', 'Dein Kontoname (den sehen die anderen)', 'O nome da tua conta (é o que os outros veem)', 'Il nickname del tuo account (è quello che vedono gli altri)'],
  openLabel: ['Ouvrir le compte', 'Open the account', 'Abrir la cuenta', 'Konto öffnen', 'Abrir a conta', 'Apri l’account'],
};
const CSS = `
.fzm .fzh-acct{display:flex;align-items:center;margin-left:auto}
.fzm .fzh-acct+.fz2-entries{margin-left:0}
.fzm .fzh-acct:empty,.fzm .fzm-acct:empty,.fzm .fzh-legal:empty{display:none}
.fzacc-ent{position:relative;display:flex;align-items:center;gap:12px;min-height:56px;max-width:340px;padding:6px 40px 6px 10px;font:inherit;text-align:left;color:#f4ecd8;border:1px solid rgba(236,226,198,.22);background:linear-gradient(180deg,rgba(28,32,26,.94),rgba(13,15,12,.92));clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);cursor:pointer;transition:border-color .12s,background .12s}
.fzacc-ent:hover,.fzacc-ent:focus-visible{border-color:#f0ae2e;background:linear-gradient(180deg,rgba(48,40,18,.94),rgba(20,18,10,.92));outline:0}
.fzacc-ent::after{content:"";position:absolute;right:16px;top:50%;width:9px;height:9px;margin-top:-5px;border-right:2px solid #f0ae2e;border-top:2px solid #f0ae2e;transform:rotate(45deg)}
.fzacc-ent>i{flex:none;display:flex;align-items:center;justify-content:center;width:40px;height:40px;color:#17140a;background:linear-gradient(160deg,#ffd27a,#d98f1c);clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)}
.fzacc-ent>i svg{width:24px;height:24px}
.fzacc-ent>span{min-width:0}
.fzacc-ent b{display:block;overflow:hidden;font-size:19px;font-weight:800;letter-spacing:.1em;line-height:1.05;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase}
.fzacc-ent small{display:block;overflow:hidden;font-size:14px;font-weight:600;letter-spacing:.06em;text-overflow:ellipsis;white-space:nowrap;color:#bdb59c}
.fzacc-ent.is-in>i{background:linear-gradient(160deg,#c8e29a,#7fa648)}
.fzm .fzm-acct{display:flex;align-items:center;flex:none;min-width:0}
.fzacc-chip{display:flex;align-items:center;gap:8px;max-width:220px;height:40px;padding:0 12px;font:inherit;font-size:16px;font-weight:700;letter-spacing:.06em;color:#f4ecd8;border:1px solid rgba(236,226,198,.24);background:rgba(0,0,0,.3);cursor:pointer;white-space:nowrap}
.fzacc-chip:hover,.fzacc-chip:focus-visible{border-color:#f0ae2e;outline:0}
.fzacc-chip svg{flex:none;width:18px;height:18px;color:#f0ae2e}
.fzacc-chip span{overflow:hidden;text-overflow:ellipsis}
.fzacc-chip .fzacc-s{display:none}
.fzacc-chip i{flex:none;width:8px;height:8px;border-radius:50%;background:#9cc264}
.fzacc-chip.is-pending i{background:#e8a628}.fzacc-chip.is-off i{background:#8d8a76}
.fzm .fzh-legal{order:9;display:flex;flex-wrap:wrap;justify-content:center;gap:4px 18px;padding:6px 0 2px;font-size:14px;letter-spacing:.06em}
.fzh-legal a{color:#a5a18a;text-decoration:none;border-bottom:1px solid transparent}
.fzh-legal a:hover,.fzh-legal a:focus-visible{color:#f4ecd8;border-bottom-color:#f0ae2e;outline:0}
@media (max-width:760px),(pointer:coarse){.fzm .fzh-legal{gap:0 6px;padding:0}.fzh-legal a{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;border-bottom:0}}       /* finger-sized links */
@media (max-width:1500px){.fzacc-chip .fzacc-l{display:none}.fzacc-chip .fzacc-s{display:inline}}
@media (max-width:1180px){.fzacc-chip{height:34px;padding:0 9px;font-size:14px}}
.fzacc-chip svg.fzacc-ph{display:none}
@media (max-width:760px){.fzacc-chip{width:44px;height:44px;padding:0;justify-content:center;gap:0;position:relative}.fzacc-chip>span{display:none!important}.fzacc-chip svg.fzacc-ph{display:block}.fzacc-chip i{position:absolute;right:5px;top:5px}.fzacc-chip svg{width:22px;height:22px}}       /* phones: an icon, the logo keeps its room (the hub entry has the words) */
@media (max-width:760px){.fzm .fzh-acct{margin-left:0;width:100%}.fzacc-ent{max-width:none;flex:1}.fzm .fzh-hub .fzh-acct{order:4}}
@media (max-height:840px){.fzacc-ent{min-height:48px;padding-top:4px;padding-bottom:4px}.fzacc-ent>i{width:34px;height:34px}}
`;
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';

export function readAccount() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } }
export function writeAccount(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* private mode: this page only */ } }
export const googleClientId = () => { try { const m = document.querySelector('meta[name="fz-google-client"]'); const v = m && String(m.content || '').trim(); return v && /^[A-Za-z0-9._-]{1,200}\.apps\.googleusercontent\.com$/.test(v) ? v : ''; } catch { return ''; } };
export const httpBase = url => String(url || '').replace(/^ws(s?):/i, 'http$1:').replace(/\/ws\/?$/, '');

export function install(deps = {}) {
  const { net, engine, i18n, profile, menuRoot } = deps;
  const li = () => { const i = LANGS.indexOf(i18n && i18n.lang); return i < 0 ? 0 : i; };
  const L = k => (TX[k] ? TX[k][li()] || TX[k][0] : k);
  const base = httpBase(net && net.url) || location.origin;
  let sync = null, syncLoad = null, panelLoad = null, status = 'idle';
  const signedIn = () => !!readAccount().tok;
  const listeners = new Set();
  const changed = () => { draw(); for (const f of listeners) { try { f(api.state); } catch { /* a listener */ } } };
  try { if (!document.getElementById('fzacc-css')) { const s = document.createElement('style'); s.id = 'fzacc-css'; s.textContent = CSS; document.head.append(s); } } catch { /* style is cosmetic */ }

  // The game server learns the account from the session token on create / join / quick (older servers ignore the field).
  function setCaps() {
    if (!net) return;
    const tok = readAccount().tok, caps = Object.assign({}, net.joinCaps);
    if (tok) caps.acct = tok; else delete caps.acct;
    net.joinCaps = caps;
  }
  const ctx = () => ({ net, engine, i18n, profile, menuRoot, base, readAccount, writeAccount, googleClientId, setCaps, changed, setStatus: s => { if (s !== status) { status = s; draw(); } }, api });
  function loadSync() {
    if (!syncLoad) syncLoad = import('./account-sync.js').then(m => { sync = m.start(ctx()); return sync; }).catch(e => { syncLoad = null; console.warn('[account] sync unavailable', e); return null; });
    return syncLoad;
  }
  function open(focus) {
    if (!panelLoad) panelLoad = import('./account-panel.js').catch(e => { panelLoad = null; throw e; });
    return Promise.all([panelLoad, loadSync()]).then(([m, s]) => m.open({ ...ctx(), sync: s, focus })).catch(e => console.warn('[account] panel unavailable', e));
  }

  /* ---------- slots ---------- */
  const el = (tag, cls, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const k in attrs || {}) e.setAttribute(k, attrs[k]); return e; };
  function entry(acc) {
    const b = el('button', 'fzacc-ent' + (acc.tok ? ' is-in' : ''), { type: 'button', 'data-fid': 'acct:open' });
    const i = el('i'); i.innerHTML = ICON;
    const t = el('span'), h = el('b'), s = el('small');
    h.textContent = acc.tok ? acc.pseudo || L('account') : L('google');
    s.textContent = acc.tok ? L(status === 'pending' ? 'pending' : status === 'offline' ? 'offline' : 'synced') : L('saveSub');
    t.append(h, s); b.append(i, t); b.setAttribute('aria-label', acc.tok ? `${L('account')} : ${acc.pseudo || ''}` : L('google'));
    b.addEventListener('click', () => open());
    return b;
  }
  function chip(acc) {
    const b = el('button', 'fzacc-chip' + (status === 'pending' ? ' is-pending' : status === 'offline' ? ' is-off' : ''), { type: 'button', 'data-fid': 'acct:chip' });
    if (acc.tok) { const ic = el('span'); ic.innerHTML = ICON; ic.firstChild.classList.add('fzacc-ph'); const d = el('i'); const n = el('span', 'fzacc-n'); n.textContent = acc.pseudo || L('account'); b.append(ic.firstChild, d, n); b.title = L('openLabel'); b.setAttribute('aria-label', `${L('account')} : ${acc.pseudo || ''}`); }
    else { const ic = el('span'); ic.innerHTML = ICON; const l = el('span', 'fzacc-l'), s = el('span', 'fzacc-s'); l.textContent = L('google'); s.textContent = L('googleShort'); b.append(ic.firstChild, l, s); b.setAttribute('aria-label', L('google')); }
    b.addEventListener('click', () => open());
    return b;
  }
  function legal() {
    const f = document.createDocumentFragment();
    for (const [href, k] of [['confidentialite.html', 'privacy'], ['mentions-legales.html', 'legal']]) {
      const a = el('a', null, { href: href + (li() ? '#en' : ''), target: '_blank', rel: 'noopener', 'data-fid': 'legal:' + k }); a.textContent = L(k); f.append(a);
    }
    const dc = el('a', null, { href: DISCORD, target: '_blank', rel: 'noopener', 'data-fid': 'legal:discord' }); dc.textContent = 'Discord'; f.append(dc);       // the game's official server
    return f;
  }
  const keyOf = acc => [li(), acc.tok ? 1 : 0, acc.pseudo || '', status, googleClientId() ? 1 : 0].join('|');
  function fill(slot, make, k) {
    if (!slot || slot.dataset.k === k) return;
    slot.dataset.k = k; slot.textContent = ''; const n = make(); if (n) slot.append(n);
  }
  function draw() {
    const root = menuRoot && menuRoot.querySelector('.fzm'); if (!root) return;
    const acc = readAccount(), show = !!acc.tok || !!googleClientId(), k = keyOf(acc);
    // hub title row
    let hub = root.querySelector('.fzh-acct');
    if (!hub) { const head = root.querySelector('.fzh-hub .fzm-play-head'); if (head) { hub = el('div', 'fzh-acct'); const hello = head.querySelector('.fzh-hello'); if (hello) hello.after(hub); else head.prepend(hub); } }
    fill(hub, () => (show ? entry(acc) : null), k);
    // top bar, after the credits
    let top = root.querySelector('.fzm-acct');
    if (!top) { const id = root.querySelector('.fzm-top .fzm-id'); if (id) { top = el('div', 'fzm-acct'); id.append(top); } }
    fill(top, () => (show ? chip(acc) : null), k);
    // hub footer
    let foot = root.querySelector('.fzh-legal');
    if (!foot) { const hubView = root.querySelector('.fzh-hub'); if (hubView) { foot = el('footer', 'fzh-legal'); hubView.append(foot); } }
    fill(foot, legal, String(li()));
    // signed in: the free name field shows the account pseudo, read-only (the game server uses the pseudo anyway)
    const nf = root.querySelector('[data-fid="multi:name"]');
    if (nf) { if (acc.tok) { nf.readOnly = true; if (nf.value !== (acc.pseudo || '')) nf.value = acc.pseudo || ''; nf.title = L('nameLocked'); nf.dataset.fzacc = '1'; } else if (nf.dataset.fzacc) { nf.readOnly = false; nf.title = ''; delete nf.dataset.fzacc; } }
  }
  let queued = false, observed = null;
  const after = () => { queued = false; try { draw(); } catch (e) { console.warn('[account] slots', e); } };
  const mo = new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(after); } });
  function watch() {
    const r = menuRoot && menuRoot.querySelector('.fzm'); if (!r || r === observed) return !!r; observed = r;
    mo.disconnect(); for (const q of [r.querySelector('.fzm-main'), r.querySelector('.fzm-top')]) if (q) mo.observe(q, { childList: true });
    after(); return true;
  }
  if (!watch() && menuRoot) { const w = new MutationObserver(() => { if (watch()) w.disconnect(); }); w.observe(menuRoot, { childList: true }); }
  try { if (i18n && typeof i18n.on === 'function') i18n.on('change', () => after()); } catch { /* language changes redraw on the next menu render anyway */ }

  const api = {
    get state() { const a = readAccount(); return { signedIn: !!a.tok, pseudo: a.pseudo || null, rev: a.rev || 0, at: a.at || 0, status, google: !!googleClientId() }; },
    open, on: f => { listeners.add(f); return () => listeners.delete(f); },
    syncNow: () => loadSync().then(s => (s ? s.syncNow('manual') : null)),
    signOut: () => loadSync().then(s => (s ? s.signOut() : null)),
    get sync() { return sync; },
    base,
  };
  setCaps();
  if (signedIn()) loadSync();       // a guest loads nothing more
  return api;
}
