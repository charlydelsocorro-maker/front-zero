// FRONT ZÉRO — the account panel (loaded by account-ui.js on click, never at boot). Loads Google Identity Services
// (https://accounts.google.com/gsi/client) only here, renders Google's own button, then: pseudo for a new account, done.
// Signed in: pseudo, sync state, « Télécharger mes données », « Se déconnecter », « Supprimer mon compte » (with a confirmation).
// Links to confidentialite.html and mentions-legales.html. Six languages. Escape closes it without touching the menu behind.
const GIS_URL = 'https://accounts.google.com/gsi/client';
const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const TX = {
  title: ['Compte FRONT ZÉRO', 'FRONT ZÉRO account', 'Cuenta FRONT ZÉRO', 'FRONT ZÉRO-Konto', 'Conta FRONT ZÉRO', 'Account FRONT ZÉRO'],
  pitch: ['Garde ta progression (crédits, niveau, armes, tenues) sur tous tes appareils.', 'Keep your progress (credits, level, weapons, outfits) on all your devices.', 'Guarda tu progreso (créditos, nivel, armas, atuendos) en todos tus dispositivos.', 'Behalte deinen Fortschritt (Credits, Level, Waffen, Outfits) auf all deinen Geräten.', 'Guarda o teu progresso (créditos, nível, armas, fardas) em todos os teus aparelhos.', 'Conserva i tuoi progressi (crediti, livello, armi, tenute) su tutti i tuoi dispositivi.'],
  keep: ['On garde seulement un pseudo et ta progression de jeu. Jamais ton e-mail, ton nom ni ta photo.', 'We only keep a nickname and your game progress. Never your email, your name or your picture.', 'Solo guardamos un apodo y tu progreso de juego. Nunca tu correo, tu nombre ni tu foto.', 'Wir speichern nur einen Spielernamen und deinen Spielfortschritt. Nie deine E-Mail, deinen Namen oder dein Foto.', 'Guardamos apenas um nome de jogador e o teu progresso. Nunca o teu e-mail, o teu nome nem a tua foto.', 'Conserviamo solo un nickname e i tuoi progressi di gioco. Mai la tua email, il tuo nome o la tua foto.'],
  carry: ['Ta progression actuelle (niveau {l}, {c} ₡) sera rattachée à ton compte.', 'Your current progress (level {l}, {c} ₡) will be added to your account.', 'Tu progreso actual (nivel {l}, {c} ₡) se añadirá a tu cuenta.', 'Dein aktueller Fortschritt (Level {l}, {c} ₡) wird deinem Konto hinzugefügt.', 'O teu progresso atual (nível {l}, {c} ₡) será juntado à tua conta.', 'I tuoi progressi attuali (livello {l}, {c} ₡) saranno aggiunti al tuo account.'],
  minors: ['Moins de 15 ans ? Demande l’accord d’un parent avant de créer un compte.', 'Under 15? Ask a parent for permission before creating an account.', '¿Menos de 15 años? Pide permiso a un padre o madre antes de crear una cuenta.', 'Unter 15? Frag vorher einen Elternteil um Erlaubnis.', 'Menos de 15 anos? Pede autorização a um dos pais antes de criar uma conta.', 'Meno di 15 anni? Chiedi il permesso a un genitore prima di creare un account.'],
  loading: ['Chargement de Google…', 'Loading Google…', 'Cargando Google…', 'Google wird geladen…', 'A carregar o Google…', 'Caricamento di Google…'],
  gisFail: ['Google ne répond pas. Vérifie ta connexion ou réessaie plus tard.', 'Google is not answering. Check your connection or try again later.', 'Google no responde. Revisa tu conexión o inténtalo más tarde.', 'Google antwortet nicht. Prüfe deine Verbindung oder versuche es später.', 'O Google não responde. Verifica a ligação ou tenta mais tarde.', 'Google non risponde. Controlla la connessione o riprova più tardi.'],
  localNote: ['La connexion Google ne marche que sur le site public du jeu.', 'Google sign-in only works on the game’s public site.', 'El acceso con Google solo funciona en el sitio público del juego.', 'Die Google-Anmeldung funktioniert nur auf der öffentlichen Seite des Spiels.', 'O início de sessão Google só funciona no site público do jogo.', 'L’accesso con Google funziona solo sul sito pubblico del gioco.'],
  off: ['Les comptes ne sont pas disponibles sur ce serveur.', 'Accounts are not available on this server.', 'Las cuentas no están disponibles en este servidor.', 'Konten sind auf diesem Server nicht verfügbar.', 'As contas não estão disponíveis neste servidor.', 'Gli account non sono disponibili su questo server.'],
  pseudoT: ['Choisis ton pseudo', 'Choose your nickname', 'Elige tu apodo', 'Wähle deinen Spielernamen', 'Escolhe o teu nome de jogador', 'Scegli il tuo nickname'],
  pseudoH: ['3 à 16 caractères : lettres, chiffres, _ et -. Les autres joueurs le verront.', '3 to 16 characters: letters, digits, _ and -. Other players will see it.', 'De 3 a 16 caracteres: letras, cifras, _ y -. Los demás jugadores lo verán.', '3 bis 16 Zeichen: Buchstaben, Ziffern, _ und -. Andere Spieler sehen ihn.', '3 a 16 caracteres: letras, algarismos, _ e -. Os outros jogadores vão vê-lo.', 'Da 3 a 16 caratteri: lettere, cifre, _ e -. Gli altri giocatori lo vedranno.'],
  create: ['Créer mon compte', 'Create my account', 'Crear mi cuenta', 'Konto erstellen', 'Criar a minha conta', 'Crea il mio account'],
  cancel: ['Annuler', 'Cancel', 'Cancelar', 'Abbrechen', 'Cancelar', 'Annulla'],
  close: ['Fermer', 'Close', 'Cerrar', 'Schließen', 'Fechar', 'Chiudi'],
  free: ['Disponible', 'Available', 'Disponible', 'Verfügbar', 'Disponível', 'Disponibile'],
  checking: ['Vérification…', 'Checking…', 'Comprobando…', 'Wird geprüft…', 'A verificar…', 'Verifica…'],
  'why.format': ['3 à 16 caractères : lettres, chiffres, _ ou -.', '3 to 16 characters: letters, digits, _ or -.', 'De 3 a 16 caracteres: letras, cifras, _ o -.', '3 bis 16 Zeichen: Buchstaben, Ziffern, _ oder -.', '3 a 16 caracteres: letras, algarismos, _ ou -.', 'Da 3 a 16 caratteri: lettere, cifre, _ o -.'],
  'why.taken': ['Ce pseudo est déjà pris.', 'This nickname is taken.', 'Ese apodo ya está ocupado.', 'Dieser Name ist schon vergeben.', 'Esse nome já está ocupado.', 'Questo nickname è già preso.'],
  'why.blocked': ['Ce pseudo n’est pas accepté. Choisis-en un autre.', 'This nickname is not allowed. Pick another one.', 'Ese apodo no está permitido. Elige otro.', 'Dieser Name ist nicht erlaubt. Wähle einen anderen.', 'Esse nome não é permitido. Escolhe outro.', 'Questo nickname non è consentito. Scegline un altro.'],
  'why.reserved': ['Ce pseudo est réservé.', 'This nickname is reserved.', 'Ese apodo está reservado.', 'Dieser Name ist reserviert.', 'Esse nome está reservado.', 'Questo nickname è riservato.'],
  signedAs: ['Connecté', 'Signed in', 'Conectado', 'Angemeldet', 'Sessão iniciada', 'Connesso'],
  syncedAt: ['Synchronisé {t}', 'Synced {t}', 'Sincronizado {t}', 'Synchronisiert {t}', 'Sincronizado {t}', 'Sincronizzato {t}'],
  never: ['Pas encore synchronisé', 'Not synced yet', 'Aún sin sincronizar', 'Noch nicht synchronisiert', 'Ainda não sincronizado', 'Non ancora sincronizzato'],
  syncPending: ['Modifications en attente d’envoi', 'Changes waiting to be sent', 'Cambios pendientes de envío', 'Änderungen warten auf Übertragung', 'Alterações à espera de envio', 'Modifiche in attesa di invio'],
  syncNow: ['Synchroniser', 'Sync now', 'Sincronizar', 'Jetzt synchronisieren', 'Sincronizar', 'Sincronizza'],
  export: ['Télécharger mes données', 'Download my data', 'Descargar mis datos', 'Meine Daten herunterladen', 'Descarregar os meus dados', 'Scarica i miei dati'],
  signOut: ['Se déconnecter', 'Sign out', 'Cerrar sesión', 'Abmelden', 'Terminar sessão', 'Esci'],
  signOutNote: ['En te déconnectant, cet appareil repart d’une progression d’invité. La tienne reste sur ton compte.', 'Signing out puts this device back to a guest progress. Yours stays on your account.', 'Al cerrar sesión, este dispositivo vuelve a un progreso de invitado. El tuyo queda en tu cuenta.', 'Nach dem Abmelden startet dieses Gerät mit einem Gastfortschritt. Deiner bleibt im Konto.', 'Ao terminar a sessão, este aparelho volta a um progresso de convidado. O teu fica na conta.', 'Uscendo, questo dispositivo torna a un progresso da ospite. Il tuo resta nell’account.'],
  delete: ['Supprimer mon compte', 'Delete my account', 'Eliminar mi cuenta', 'Mein Konto löschen', 'Eliminar a minha conta', 'Elimina il mio account'],
  delT: ['Supprimer ton compte ?', 'Delete your account?', '¿Eliminar tu cuenta?', 'Konto löschen?', 'Eliminar a tua conta?', 'Eliminare il tuo account?'],
  delB: ['Ton compte « {p} », ta progression enregistrée et toutes tes sessions seront effacés du serveur. C’est définitif. Sur cet appareil, la progression repartira de zéro.', 'Your account “{p}”, your saved progress and all your sessions will be erased from the server. This cannot be undone. On this device, progress will start from zero.', 'Tu cuenta «{p}», tu progreso guardado y todas tus sesiones se borrarán del servidor. Es definitivo. En este dispositivo el progreso empezará de cero.', 'Dein Konto „{p}“, dein gespeicherter Fortschritt und alle Sitzungen werden vom Server gelöscht. Das ist endgültig. Auf diesem Gerät beginnt der Fortschritt bei null.', 'A tua conta «{p}», o progresso guardado e todas as sessões serão apagados do servidor. É definitivo. Neste aparelho o progresso recomeça do zero.', 'Il tuo account «{p}», i progressi salvati e tutte le sessioni saranno cancellati dal server. È definitivo. Su questo dispositivo i progressi ripartiranno da zero.'],
  delFirst: ['Télécharger mes données d’abord', 'Download my data first', 'Descargar mis datos antes', 'Zuerst meine Daten herunterladen', 'Descarregar os meus dados primeiro', 'Scarica prima i miei dati'],
  delGo: ['Supprimer définitivement', 'Delete for good', 'Eliminar definitivamente', 'Endgültig löschen', 'Eliminar definitivamente', 'Elimina definitivamente'],
  deleted: ['Compte supprimé. Le jeu redémarre…', 'Account deleted. The game restarts…', 'Cuenta eliminada. El juego se reinicia…', 'Konto gelöscht. Das Spiel startet neu…', 'Conta eliminada. O jogo vai reiniciar…', 'Account eliminato. Il gioco si riavvia…'],
  signedOut: ['Déconnecté. Le jeu redémarre…', 'Signed out. The game restarts…', 'Sesión cerrada. El juego se reinicia…', 'Abgemeldet. Das Spiel startet neu…', 'Sessão terminada. O jogo vai reiniciar…', 'Disconnesso. Il gioco si riavvia…'],
  welcome: ['Bienvenue, {p} ! Ta progression est sauvegardée.', 'Welcome, {p}! Your progress is saved.', '¡Bienvenido, {p}! Tu progreso está guardado.', 'Willkommen, {p}! Dein Fortschritt ist gespeichert.', 'Bem-vindo, {p}! O teu progresso está guardado.', 'Benvenuto, {p}! I tuoi progressi sono salvati.'],
  exported: ['Fichier téléchargé.', 'File downloaded.', 'Archivo descargado.', 'Datei heruntergeladen.', 'Ficheiro descarregado.', 'File scaricato.'],
  'err.network': ['Serveur injoignable. Réessaie dans un moment.', 'Server unreachable. Try again in a moment.', 'Servidor inaccesible. Inténtalo en un momento.', 'Server nicht erreichbar. Versuche es gleich noch einmal.', 'Servidor inacessível. Tenta daqui a pouco.', 'Server irraggiungibile. Riprova tra poco.'],
  'err.rate': ['Trop d’essais. Attends quelques secondes.', 'Too many tries. Wait a few seconds.', 'Demasiados intentos. Espera unos segundos.', 'Zu viele Versuche. Warte ein paar Sekunden.', 'Demasiadas tentativas. Espera uns segundos.', 'Troppi tentativi. Aspetta qualche secondo.'],
  'err.token': ['La connexion Google a échoué. Réessaie.', 'Google sign-in failed. Try again.', 'El acceso con Google ha fallado. Inténtalo de nuevo.', 'Die Google-Anmeldung ist fehlgeschlagen. Versuche es erneut.', 'O início de sessão Google falhou. Tenta outra vez.', 'L’accesso con Google non è riuscito. Riprova.'],
  'err.ticket': ['Délai dépassé : recommence la connexion avec Google.', 'Too slow: sign in with Google again.', 'Tiempo agotado: vuelve a entrar con Google.', 'Zeit abgelaufen: melde dich erneut mit Google an.', 'Tempo esgotado: volta a entrar com o Google.', 'Tempo scaduto: accedi di nuovo con Google.'],
  'err.many': ['Trop de comptes créés depuis cette connexion aujourd’hui.', 'Too many accounts created from this connection today.', 'Demasiadas cuentas creadas desde esta conexión hoy.', 'Heute wurden zu viele Konten über diese Verbindung erstellt.', 'Demasiadas contas criadas a partir desta ligação hoje.', 'Troppi account creati da questa connessione oggi.'],
  'err.auth': ['Ta session a expiré. Reconnecte-toi avec Google.', 'Your session expired. Sign in with Google again.', 'Tu sesión ha caducado. Vuelve a entrar con Google.', 'Deine Sitzung ist abgelaufen. Melde dich erneut mit Google an.', 'A tua sessão expirou. Volta a entrar com o Google.', 'La sessione è scaduta. Accedi di nuovo con Google.'],
  'err.other': ['Une erreur est survenue. Réessaie.', 'Something went wrong. Try again.', 'Algo ha fallado. Inténtalo de nuevo.', 'Etwas ist schiefgelaufen. Versuche es erneut.', 'Algo correu mal. Tenta outra vez.', 'Qualcosa è andato storto. Riprova.'],
  privacy: ['Confidentialité', 'Privacy', 'Privacidad', 'Datenschutz', 'Privacidade', 'Privacy'],
  legal: ['Mentions légales', 'Legal notice', 'Aviso legal', 'Impressum', 'Aviso legal', 'Note legali'],
};
const CSS = `
#fzacc-panel{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,9,6,.84);color:#d8c9a3;font-family:"Barlow Condensed","Arial Narrow",Arial,sans-serif}
#fzacc-panel *{box-sizing:border-box}
.fzacc-box{position:relative;width:100%;max-width:540px;max-height:calc(100vh - 32px);overflow:auto;display:grid;gap:14px;padding:24px 26px 20px;border:1px solid rgba(201,185,143,.3);border-left:4px solid #e8a628;background:linear-gradient(180deg,#191c14,#11130e);clip-path:polygon(0 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%)}
.fzacc-box h2{margin:0;padding-right:40px;font-size:30px;font-weight:800;letter-spacing:.06em;line-height:1.05;text-transform:uppercase;color:#f4ecd8}
.fzacc-box p{margin:0;font-size:19px;line-height:1.3}
.fzacc-box .fzacc-small{font-size:16px;color:#a5a18a}
.fzacc-x{position:absolute;top:12px;right:12px;width:40px;height:40px;font:inherit;font-size:28px;line-height:1;color:#d8c9a3;background:transparent;border:1px solid rgba(201,185,143,.25);cursor:pointer}
.fzacc-x:hover,.fzacc-x:focus-visible{border-color:#e8a628;color:#f4ecd8;outline:0}
.fzacc-gis{display:flex;align-items:center;justify-content:center;min-height:56px;padding:6px 0}
.fzacc-gis .fzacc-wait{font-size:17px;color:#a5a18a}
.fzacc-row{display:flex;flex-wrap:wrap;gap:10px}
.fzacc-btn{min-height:44px;padding:8px 18px;font:inherit;font-size:19px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#d8c9a3;background:transparent;border:1px solid rgba(201,185,143,.4);cursor:pointer}
.fzacc-btn:hover,.fzacc-btn:focus-visible{border-color:#e8a628;color:#f4ecd8;outline:0}
.fzacc-btn[disabled]{opacity:.45;cursor:default}
.fzacc-btn.is-main{color:#181407;background:#e8a628;border-color:#e8a628}
.fzacc-btn.is-main:hover,.fzacc-btn.is-main:focus-visible{background:#ffc041}
.fzacc-btn.is-danger{color:#ff9a86;border-color:rgba(224,73,47,.6)}
.fzacc-btn.is-danger.is-main{color:#fff;background:#c2391f;border-color:#c2391f}
.fzacc-field{display:grid;gap:6px}
.fzacc-field input{width:100%;height:50px;padding:0 14px;font:inherit;font-size:24px;font-weight:700;letter-spacing:.04em;color:#f4ecd8;background:rgba(0,0,0,.35);border:1px solid rgba(201,185,143,.4);outline:0}
.fzacc-field input:focus{border-color:#e8a628}
.fzacc-st{min-height:22px;font-size:17px}
.fzacc-st.is-ok{color:#9cc264}.fzacc-st.is-bad{color:#ff8a72}
.fzacc-who{display:grid;gap:2px;padding:12px 14px;border:1px solid rgba(201,185,143,.2);background:rgba(0,0,0,.25)}
.fzacc-who small{font-size:14px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#a5a18a}
.fzacc-who b{font-size:32px;font-weight:800;letter-spacing:.04em;color:#e8a628;overflow-wrap:anywhere}
.fzacc-msg{padding:8px 12px;font-size:18px;border-left:3px solid #9cc264;background:rgba(156,194,100,.1)}
.fzacc-msg.is-bad{border-left-color:#e0492f;background:rgba(224,73,47,.12)}
.fzacc-links{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:16px}
.fzacc-links a{color:#a5a18a}
@media (max-width:760px),(pointer:coarse){.fzacc-links a{display:inline-flex;align-items:center;min-height:44px}}
.fzacc-links a:hover,.fzacc-links a:focus-visible{color:#f4ecd8;outline:0}
.fzacc-sep{height:1px;background:rgba(201,185,143,.16)}
@media (max-width:560px){.fzacc-box{padding:20px 16px 16px}.fzacc-box h2{font-size:25px}.fzacc-btn{flex:1 1 auto}}
`;

let gisLoad = null, gisInit = '', current = null, prompted = false, onCred = null;       // GIS is initialised once per page: its callback goes to the panel open now
function loadGis() {
  const ok = () => !!(window.google && window.google.accounts && window.google.accounts.id);
  if (ok()) return Promise.resolve(window.google.accounts.id);
  if (gisLoad) return gisLoad;
  gisLoad = new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = GIS_URL; s.async = true; s.defer = true;
    const to = setTimeout(() => reject(new Error('timeout')), 15000);
    s.onload = () => { clearTimeout(to); if (ok()) resolve(window.google.accounts.id); else reject(new Error('gis')); };
    s.onerror = () => { clearTimeout(to); reject(new Error('gis')); };
    document.head.append(s);
  });
  gisLoad.catch(() => { gisLoad = null; document.querySelectorAll(`script[src="${GIS_URL}"]`).forEach(x => x.remove()); });
  return gisLoad;
}

export function open(ctx) {
  if (current) { current.focus(); return current; }
  const { i18n, profile, sync, readAccount, googleClientId } = ctx;
  const li = () => { const i = LANGS.indexOf(i18n && i18n.lang); return i < 0 ? 0 : i; };
  const L = (k, v) => { let s = (TX[k] && (TX[k][li()] || TX[k][0])) || k; for (const n in v || {}) s = s.split('{' + n + '}').join(String(v[n])); return s; };
  if (!document.getElementById('fzacc-pcss')) { const st = document.createElement('style'); st.id = 'fzacc-pcss'; st.textContent = CSS; document.head.append(st); }
  const opener = document.activeElement;
  const mk = (tag, cls, text, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; for (const k in attrs || {}) e.setAttribute(k, attrs[k]); return e; };
  const btn = (label, cls, fid, fn) => { const b = mk('button', 'fzacc-btn' + (cls ? ' ' + cls : ''), label, { type: 'button', 'data-fid': fid }); b.addEventListener('click', fn); return b; };
  const wrap = mk('div', null, null, { id: 'fzacc-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fzacc-h' });
  const box = mk('div', 'fzacc-box'); wrap.append(box);
  const closeBtn = mk('button', 'fzacc-x', '×', { type: 'button', 'aria-label': L('close'), 'data-fid': 'acct:close' });
  closeBtn.addEventListener('click', () => close());
  wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    if (e.key === 'Tab') { const f = [...box.querySelectorAll('button,input,a[href],iframe,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  };
  window.addEventListener('keydown', onKey, true);
  let closed = false, msg = null, view = '';
  function close() {
    if (closed) return; closed = true; current = null;
    window.removeEventListener('keydown', onKey, true);
    try { if (window.google && window.google.accounts && window.google.accounts.id) window.google.accounts.id.cancel(); } catch { /* one tap already gone */ }
    wrap.remove();
    try { if (opener && opener.isConnected) opener.focus(); } catch { /* focus is a nicety */ }
  }
  const links = () => { const d = mk('div', 'fzacc-links'); const en = li() ? '#en' : ''; d.append(mk('a', null, L('privacy'), { href: 'confidentialite.html' + en, target: '_blank', rel: 'noopener', 'data-fid': 'acct:privacy' }), mk('a', null, L('legal'), { href: 'mentions-legales.html' + en, target: '_blank', rel: 'noopener', 'data-fid': 'acct:legal' }), mk('a', null, 'Discord', { href: 'https://discord.gg/Mq3qs22vUR', target: '_blank', rel: 'noopener', 'data-fid': 'acct:discord' })); return d; };
  const say = (text, bad) => { msg = text ? { text, bad: !!bad } : null; const m = box.querySelector('.fzacc-msg'); if (m) m.remove(); if (msg) { const e = mk('div', 'fzacc-msg' + (bad ? ' is-bad' : ''), msg.text, { role: bad ? 'alert' : 'status' }); const h = box.querySelector('h2'); if (h) h.after(e); else box.prepend(e); } };
  const errText = r => { const e = (r && r.err) || 'other'; if (e === 'network' || (r && r.status === 0)) return L('err.network'); if (e === 'rate_limited') return L('err.rate'); if (e === 'bad_token') return L('err.token'); if (e === 'ticket') return L('err.ticket'); if (e === 'too_many_accounts') return L('err.many'); if (e === 'accounts_off') return L('off'); if (e === 'auth') return L('err.auth'); if (e === 'pseudo' && r.why) return L('why.' + r.why); return L('err.other'); };
  function frame(title) { box.textContent = ''; box.append(closeBtn, mk('h2', null, title, { id: 'fzacc-h' })); if (msg) say(msg.text, msg.bad); }

  /* ---------- guest: Google's button ---------- */
  function guest() {
    view = 'guest'; frame(L('title'));
    const P = profile && profile.data ? profile.data : { cr: 0 };
    box.append(mk('p', null, L('pitch')), mk('p', 'fzacc-small', L('keep')));
    const slot = mk('div', 'fzacc-gis', null, { 'data-fid': 'acct:gis' }); slot.append(mk('span', 'fzacc-wait', L('loading'))); box.append(slot);
    let local = false; try { local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)|\.local$/i.test(location.hostname); } catch { local = false; }
    if (local) box.append(mk('p', 'fzacc-small', L('localNote')));
    box.append(mk('p', 'fzacc-small', L('carry', { l: profile ? profile.level : 1, c: Number(P.cr || 0).toLocaleString(i18n && i18n.lang || 'fr') })), mk('p', 'fzacc-small', L('minors')), links());
    const cid = googleClientId();
    if (!cid) { slot.textContent = ''; slot.append(mk('span', 'fzacc-wait', L('off'))); return; }
    loadGis().then(id => {
      if (closed || view !== 'guest') return;
      if (gisInit !== cid) { id.initialize({ client_id: cid, callback: r => { if (onCred) onCred(r); }, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true, context: 'signin', itp_support: true, use_fedcm_for_prompt: true }); gisInit = cid; }
      slot.textContent = '';
      const w = Math.min(320, Math.max(220, slot.clientWidth || 300));
      id.renderButton(slot, { type: 'standard', theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'left', width: w, locale: LANGS[li()] });
      if (!prompted) { prompted = true; try { id.prompt(); } catch { /* One Tap is optional: the button is there */ } }
    }, () => { if (closed) return; slot.textContent = ''; slot.append(mk('span', 'fzacc-wait', L('gisFail'))); });
  }
  let busy = false;
  onCred = onCredential;
  async function onCredential(resp) {
    if (closed || busy || !resp || typeof resp.credential !== 'string') return;
    busy = true; say('');
    const slot = box.querySelector('.fzacc-gis'); if (slot) { slot.textContent = ''; slot.append(mk('span', 'fzacc-wait', L('checking'))); }
    try {
      const r = await sync.signInWithGoogle(resp.credential);
      if (r.need === 'pseudo') return pseudoForm(r.ticket);
      if (r.ok) { say(L('welcome', { p: readAccount().pseudo || '' })); return signedIn(); }
      say(errText(r), true); guest();
    } finally { busy = false; }
  }

  /* ---------- new account: pseudo ---------- */
  function pseudoForm(ticket) {
    view = 'pseudo'; frame(L('pseudoT'));
    const inp = mk('input', null, null, { type: 'text', id: 'fzacc-pseudo', maxlength: '16', autocomplete: 'nickname', spellcheck: 'false', autocapitalize: 'off', 'data-fid': 'acct:pseudo', 'aria-describedby': 'fzacc-ph fzacc-pst' });
    const cur = String(profile && profile.data && profile.data.name || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16); if (cur.length >= 3 && cur.toLowerCase() !== 'soldat') inp.value = cur;
    const st = mk('div', 'fzacc-st', '', { id: 'fzacc-pst', 'aria-live': 'polite' });
    const field = mk('div', 'fzacc-field'); field.append(mk('label', null, L('pseudoT'), { for: 'fzacc-pseudo', class: 'fzacc-small' }), inp, mk('p', 'fzacc-small', L('pseudoH'), { id: 'fzacc-ph' }), st);
    const go = btn(L('create'), 'is-main', 'acct:create', submit), no = btn(L('cancel'), '', 'acct:cancel', () => { say(''); guest(); });
    const row = mk('div', 'fzacc-row'); row.append(go, no);
    box.append(field, row, mk('p', 'fzacc-small', L('minors')), links());
    let t = 0, seq = 0;
    const local = v => /^[A-Za-z0-9_-]{3,16}$/.test(v);
    const show = (text, cls) => { st.textContent = text; st.className = 'fzacc-st' + (cls ? ' ' + cls : ''); };
    function check() {
      const v = inp.value.trim(); clearTimeout(t);
      if (!v) { show(''); return; }
      if (!local(v)) { show(L('why.format'), 'is-bad'); return; }
      show(L('checking')); const n = ++seq;
      t = setTimeout(async () => { const r = await sync.checkPseudo(v); if (n !== seq || closed) return; if (r.ok === true) show(L('free'), 'is-ok'); else if (r.ok === false) show(L('why.' + r.why), 'is-bad'); else show(''); }, 350);
    }
    inp.addEventListener('input', check);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    async function submit() {
      const v = inp.value.trim(); if (!local(v)) { show(L('why.format'), 'is-bad'); inp.focus(); return; }
      go.disabled = true; no.disabled = true;
      const r = await sync.createAccount(ticket, v);
      if (closed) return;
      go.disabled = false; no.disabled = false;
      if (r.ok) { say(L('welcome', { p: v })); return signedIn(); }
      if (r.err === 'pseudo') { show(L('why.' + (r.why || 'format')), 'is-bad'); inp.focus(); return; }
      if (r.err === 'ticket') { say(L('err.ticket'), true); return guest(); }
      say(errText(r), true);
    }
    if (inp.value) check();
    setTimeout(() => { try { inp.focus(); } catch { /* focus */ } }, 0);
  }

  /* ---------- signed in ---------- */
  function ago(t) {
    if (!t) return L('never');
    const s = Math.round((Date.now() - t) / 1000);
    try { const rt = new Intl.RelativeTimeFormat(LANGS[li()], { numeric: 'auto' }); return L('syncedAt', { t: s < 60 ? rt.format(-s, 'second') : s < 3600 ? rt.format(-Math.round(s / 60), 'minute') : s < 86400 ? rt.format(-Math.round(s / 3600), 'hour') : rt.format(-Math.round(s / 86400), 'day') }); }
    catch { return L('syncedAt', { t: '' }); }
  }
  function signedIn() {
    view = 'in'; const a = readAccount(); frame(L('title'));
    const who = mk('div', 'fzacc-who'); who.append(mk('small', null, L('signedAs')), mk('b', null, a.pseudo || '', { 'data-fid': 'acct:name' })); box.append(who);
    const state = mk('p', 'fzacc-small', sync.dirty() ? L('syncPending') : ago(a.at), { 'data-fid': 'acct:state' }); box.append(state);
    const doSync = btn(L('syncNow'), '', 'acct:sync', async () => { doSync.disabled = true; const r = await sync.syncNow('manual'); doSync.disabled = false; if (closed) return; if (r && r.err) { if (r.err === 'auth') { say(L('err.auth'), true); return guest(); } say(errText(r), true); } else say(''); state.textContent = sync.dirty() ? L('syncPending') : ago(readAccount().at); });
    const exp = btn(L('export'), '', 'acct:export', () => download(exp));
    const out = btn(L('signOut'), '', 'acct:signout', async () => { out.disabled = true; await sync.signOut(); say(L('signedOut')); setTimeout(() => sync.restart(), 900); });
    const r1 = mk('div', 'fzacc-row'); r1.append(doSync, exp, out); box.append(r1, mk('p', 'fzacc-small', L('signOutNote')));
    box.append(mk('div', 'fzacc-sep'));
    const del = btn(L('delete'), 'is-danger', 'acct:delete', confirmDelete); const r2 = mk('div', 'fzacc-row'); r2.append(del); box.append(r2, links());
  }
  async function download(b) {
    if (b) b.disabled = true;
    const r = await sync.exportData();
    if (b) b.disabled = false;
    if (closed) return false;
    if (!r.ok) { say(errText(r), true); return false; }
    const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob);
    const a = mk('a', null, null, { href: url, download: `front-zero-${(readAccount().pseudo || 'compte').replace(/[^A-Za-z0-9_-]/g, '')}.json` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    say(L('exported')); return true;
  }
  function confirmDelete() {
    view = 'del'; const a = readAccount(); msg = null; frame(L('delT'));
    box.append(mk('p', null, L('delB', { p: a.pseudo || '' })));
    const first = btn(L('delFirst'), '', 'acct:delexport', () => download(first));
    const go = btn(L('delGo'), 'is-danger is-main', 'acct:delconfirm', async () => {
      go.disabled = true; no.disabled = true;
      const r = await sync.deleteAccount();
      if (closed) return;
      if (r.ok) { box.querySelectorAll('button:not(.fzacc-x)').forEach(x => { x.disabled = true; }); say(L('deleted')); setTimeout(() => sync.restart(), 1200); return; }
      go.disabled = false; no.disabled = false; say(errText(r), true);
    });
    const no = btn(L('cancel'), '', 'acct:delcancel', () => signedIn());
    const r1 = mk('div', 'fzacc-row'); r1.append(first); const r2 = mk('div', 'fzacc-row'); r2.append(go, no);
    box.append(r1, r2);
    setTimeout(() => { try { no.focus(); } catch { /* focus */ } }, 0);
  }

  document.body.append(wrap);
  if (readAccount().tok) signedIn(); else guest();
  setTimeout(() => { try { (box.querySelector('input') || box.querySelector('.fzacc-btn') || closeBtn).focus(); } catch { /* focus */ } }, 0);
  current = { close, focus: () => { try { closeBtn.focus(); } catch { /* focus */ } }, get view() { return view; } };
  return current;
}
