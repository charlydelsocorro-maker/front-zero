// FRONT ZÉRO — online lobby: wakes the free game server as soon as the menu loads, lists the public rooms (light poll of /api/rooms),
// quick play, the "create" dialog (private or public, fill with bots) and the room options in the lobby. Loaded by main.js; the menu
// calls in through menu.ext and lends its own building blocks (menu.kit), so everything keeps the menus v2 look (ui-theme.js).
// A failure here leaves the menu as it was: private rooms by code. The online bots themselves run in bots-sim.js (loaded from here).
const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const TX = {
  pubTitle: ['Salons publics', 'Public rooms', 'Salas públicas', 'Öffentliche Räume', 'Salas públicas', 'Stanze pubbliche'],
  quick: ['Partie rapide', 'Quick play', 'Partida rápida', 'Schnelles Spiel', 'Partida rápida', 'Partita rapida'],
  quickSub: ['{mode} · rejoindre ou créer', '{mode} · join or create', '{mode} · unirse o crear', '{mode} · beitreten oder erstellen', '{mode} · entrar ou criar', '{mode} · entra o crea'],
  waking: ['Réveil du serveur…', 'Waking the server…', 'Despertando el servidor…', 'Server wird geweckt…', 'A acordar o servidor…', 'Risveglio del server…'],
  wakingLong: ['jusqu’à une minute', 'up to a minute', 'hasta un minuto', 'bis zu einer Minute', 'até um minuto', 'fino a un minuto'],
  woke: ['Serveur réveillé ({s} s)', 'Server woke up ({s} s)', 'Servidor despierto ({s} s)', 'Server geweckt ({s} s)', 'Servidor acordado ({s} s)', 'Server risvegliato ({s} s)'],
  onlineNow: ['Serveur en ligne', 'Server online', 'Servidor en línea', 'Server online', 'Servidor online', 'Server online'],
  online: ['Serveur en ligne · {ms} ms', 'Server online · {ms} ms', 'Servidor en línea · {ms} ms', 'Server online · {ms} ms', 'Servidor online · {ms} ms', 'Server online · {ms} ms'],
  down: ['Serveur injoignable · nouvel essai dans {s} s', 'Server unreachable · retrying in {s} s', 'Servidor inaccesible · reintento en {s} s', 'Server nicht erreichbar · neuer Versuch in {s} s', 'Servidor inacessível · nova tentativa em {s} s', 'Server irraggiungibile · nuovo tentativo tra {s} s'],
  downStop: ['Serveur injoignable', 'Server unreachable', 'Servidor inaccesible', 'Server nicht erreichbar', 'Servidor inacessível', 'Server irraggiungibile'],
  retry: ['Réessayer', 'Retry', 'Reintentar', 'Erneut versuchen', 'Tentar de novo', 'Riprova'],
  old: ['Ce serveur ne liste pas encore les salons', 'This server does not list rooms yet', 'Este servidor aún no lista salas', 'Dieser Server listet noch keine Räume', 'Este servidor ainda não lista salas', 'Questo server non elenca ancora le stanze'],
  empty: ['Aucun salon public pour l’instant. Lance une partie rapide : des bots t’attendent, et les joueurs qui arrivent prennent leur place.', 'No public room right now. Start a quick play: bots are waiting, and players who arrive take their seats.', 'Ninguna sala pública por ahora. Lanza una partida rápida: los bots te esperan y los jugadores que llegan ocupan su lugar.', 'Gerade kein öffentlicher Raum. Starte ein schnelles Spiel: Bots warten, und neue Spieler übernehmen ihre Plätze.', 'Nenhuma sala pública por agora. Lança uma partida rápida: os bots esperam por ti e os jogadores que chegam ocupam o lugar deles.', 'Nessuna stanza pubblica per ora. Avvia una partita rapida: i bot ti aspettano e chi arriva prende il loro posto.'],
  loading: ['Recherche des salons…', 'Looking for rooms…', 'Buscando salas…', 'Räume werden gesucht…', 'À procura de salas…', 'Ricerca delle stanze…'],
  join: ['Rejoindre', 'Join', 'Unirse', 'Beitreten', 'Entrar', 'Entra'],
  full: ['Complet', 'Full', 'Llena', 'Voll', 'Cheia', 'Piena'],
  locked: ['En cours', 'In progress', 'En curso', 'Läuft', 'Em curso', 'In corso'],
  stLobby: ['Au salon', 'In lobby', 'En sala', 'In der Lobby', 'Na sala', 'In stanza'],
  stPlay: ['En partie', 'In match', 'En partida', 'Im Spiel', 'Em jogo', 'In partita'],
  stRound: ['Manche {n}', 'Round {n}', 'Ronda {n}', 'Runde {n}', 'Ronda {n}', 'Round {n}'],
  stVote: ['Vote', 'Vote', 'Votación', 'Abstimmung', 'Votação', 'Voto'],
  bots: ['+{n} bots', '+{n} bots', '+{n} bots', '+{n} Bots', '+{n} bots', '+{n} bot'],
  host: ['Hôte : {name}', 'Host: {name}', 'Anfitrión: {name}', 'Host: {name}', 'Anfitrião: {name}', 'Host: {name}'],
  createTitle: ['Créer un salon', 'Create a room', 'Crear una sala', 'Raum erstellen', 'Criar uma sala', 'Crea una stanza'],
  visibility: ['Visibilité', 'Visibility', 'Visibilidad', 'Sichtbarkeit', 'Visibilidade', 'Visibilità'],
  private: ['Privée', 'Private', 'Privada', 'Privat', 'Privada', 'Privata'],
  privateDesc: ['Code uniquement, jamais listée.', 'Code only, never listed.', 'Solo con código, nunca listada.', 'Nur per Code, nie gelistet.', 'Só com código, nunca listada.', 'Solo con codice, mai elencata.'],
  public: ['Publique', 'Public', 'Pública', 'Öffentlich', 'Pública', 'Pubblica'],
  publicDesc: ['Affichée dans la liste : tout le monde peut la voir et la rejoindre.', 'Shown in the list: anyone can see and join it.', 'Aparece en la lista: cualquiera puede verla y unirse.', 'In der Liste sichtbar: alle können sie sehen und beitreten.', 'Aparece na lista: qualquer pessoa pode vê-la e entrar.', 'Mostrata nella lista: chiunque può vederla e unirsi.'],
  fill: ['Compléter avec des bots', 'Fill with bots', 'Completar con bots', 'Mit Bots auffüllen', 'Completar com bots', 'Completa con bot'],
  fillDesc: ['Les bots prennent les places libres et en cèdent une à chaque joueur qui arrive.', 'Bots take the empty seats and give one up whenever a player arrives.', 'Los bots ocupan las plazas libres y ceden una a cada jugador que llega.', 'Bots belegen freie Plätze und machen für jeden neuen Spieler einen frei.', 'Os bots ocupam os lugares livres e cedem um a cada jogador que chega.', 'I bot occupano i posti liberi e ne cedono uno a ogni giocatore che arriva.'],
  size: ['Taille visée', 'Target size', 'Tamaño objetivo', 'Zielgröße', 'Tamanho alvo', 'Dimensione obiettivo'],
  players: ['{n} joueurs', '{n} players', '{n} jugadores', '{n} Spieler', '{n} jogadores', '{n} giocatori'],
  noBots: ['Ce mode a ses propres adversaires : pas de bots.', 'This mode has its own opponents: no bots.', 'Este modo tiene sus propios rivales: sin bots.', 'Dieser Modus hat eigene Gegner: keine Bots.', 'Este modo tem os seus próprios adversários: sem bots.', 'Questa modalità ha i suoi avversari: niente bot.'],
  createBtn: ['Créer le salon', 'Create room', 'Crear sala', 'Raum erstellen', 'Criar sala', 'Crea stanza'],
  cancel: ['Annuler', 'Cancel', 'Cancelar', 'Abbrechen', 'Cancelar', 'Annulla'],
  share: ['Partage ce code avec tes amis.', 'Share this code with your friends.', 'Comparte este código con tus amigos.', 'Teile diesen Code mit deinen Freunden.', 'Partilha este código com os teus amigos.', 'Condividi questo codice con i tuoi amici.'],
  sharePub: ['Le salon est aussi dans la liste des salons publics.', 'The room is also in the public room list.', 'La sala también aparece en la lista de salas públicas.', 'Der Raum steht auch in der Liste der öffentlichen Räume.', 'A sala também aparece na lista de salas públicas.', 'La stanza è anche nella lista delle stanze pubbliche.'],
  roomOpts: ['Options du salon','Room options', 'Opciones de la sala', 'Raumoptionen', 'Opções da sala', 'Opzioni della stanza'],
  botsOn: ['{n} bots · cible {t} joueurs', '{n} bots · target {t} players', '{n} bots · objetivo {t} jugadores', '{n} Bots · Ziel {t} Spieler', '{n} bots · alvo {t} jogadores', '{n} bot · obiettivo {t} giocatori'],
  botsOff: ['Pas de bots', 'No bots', 'Sin bots', 'Keine Bots', 'Sem bots', 'Nessun bot'],
  simBy: ['Bots pilotés par {name}', 'Bots run by {name}', 'Bots controlados por {name}', 'Bots gesteuert von {name}', 'Bots controlados por {name}', 'Bot gestiti da {name}'],
  noSim: ['Aucun joueur ne peut piloter les bots (version trop ancienne).', 'No player can run the bots (outdated version).', 'Ningún jugador puede controlar los bots (versión antigua).', 'Kein Spieler kann die Bots steuern (veraltete Version).', 'Nenhum jogador pode controlar os bots (versão antiga).', 'Nessun giocatore può gestire i bot (versione vecchia).'],
  errTooMany: ['Trop de salons publics ouverts depuis cette adresse. Ferme-en un d’abord.', 'Too many public rooms open from this address. Close one first.', 'Demasiadas salas públicas abiertas desde esta dirección. Cierra una primero.', 'Zu viele öffentliche Räume von dieser Adresse aus. Schließe zuerst einen.', 'Demasiadas salas públicas abertas a partir deste endereço. Fecha uma primeiro.', 'Troppe stanze pubbliche aperte da questo indirizzo. Chiudine prima una.'],
  errInProgress: ['Cette partie a commencé et n’accepte plus de joueurs.', 'This match has started and no longer takes players.', 'Esta partida ha empezado y ya no admite jugadores.', 'Dieses Spiel hat begonnen und nimmt keine Spieler mehr auf.', 'Esta partida já começou e não aceita mais jogadores.', 'Questa partita è iniziata e non accetta più giocatori.'],
  errNoPublic: ['Ce serveur ne connaît pas encore les salons publics : crée un salon et partage son code.', 'This server does not support public rooms yet: create a room and share its code.', 'Este servidor aún no admite salas públicas: crea una sala y comparte su código.', 'Dieser Server kennt noch keine öffentlichen Räume: erstelle einen Raum und teile den Code.', 'Este servidor ainda não suporta salas públicas: cria uma sala e partilha o código.', 'Questo server non supporta ancora le stanze pubbliche: crea una stanza e condividi il codice.'],
};
/* invite links (?join=CODE or #join=CODE) */
Object.assign(TX, {
  inviteBtn: ['Copier le lien d’invitation', 'Copy the invite link', 'Copiar el enlace de invitación', 'Einladungslink kopieren', 'Copiar a ligação de convite', 'Copia il link d’invito'],
  inviteShare: ['Inviter des amis', 'Invite friends', 'Invitar a amigos', 'Freunde einladen', 'Convidar amigos', 'Invita amici'],
  linkCopied: ['Lien d’invitation copié', 'Invite link copied', 'Enlace de invitación copiado', 'Einladungslink kopiert', 'Ligação de convite copiada', 'Link d’invito copiato'],
  linkShow: ['Copie ce lien : {url}', 'Copy this link: {url}', 'Copia este enlace: {url}', 'Kopiere diesen Link: {url}', 'Copia esta ligação: {url}', 'Copia questo link: {url}'],
  cardLink: ['Copier le lien', 'Copy link', 'Copiar enlace', 'Link kopieren', 'Copiar ligação', 'Copia link'],
  shareText: ['Rejoins-moi sur FRONT ZÉRO, salon {code} :', 'Join me on FRONT ZÉRO, room {code}:', 'Únete a mí en FRONT ZÉRO, sala {code}:', 'Komm zu mir in FRONT ZÉRO, Raum {code}:', 'Junta-te a mim no FRONT ZÉRO, sala {code}:', 'Raggiungimi su FRONT ZÉRO, stanza {code}:'],
  inviteTitle: ['Invitation au salon {code}', 'Invitation to room {code}', 'Invitación a la sala {code}', 'Einladung in Raum {code}', 'Convite para a sala {code}', 'Invito alla stanza {code}'],
  inviteName: ['Choisis ton nom de soldat pour rejoindre la partie.', 'Pick your soldier name to join the match.', 'Elige tu nombre de soldado para unirte a la partida.', 'Wähle deinen Soldatennamen, um beizutreten.', 'Escolhe o teu nome de soldado para entrar na partida.', 'Scegli il tuo nome di soldato per unirti alla partita.'],
  inviteGo: ['Rejoindre', 'Join', 'Unirse', 'Beitreten', 'Entrar', 'Entra'],
  inviteWait: ['Invitation au salon {code} : connexion dès que le serveur répond…', 'Invitation to room {code}: joining as soon as the server answers…', 'Invitación a la sala {code}: conexión en cuanto responda el servidor…', 'Einladung in Raum {code}: Beitritt, sobald der Server antwortet…', 'Convite para a sala {code}: ligação assim que o servidor responder…', 'Invito alla stanza {code}: ingresso appena il server risponde…'],
  inviteJoining: ['Connexion au salon {code}…', 'Joining room {code}…', 'Entrando en la sala {code}…', 'Raum {code} wird betreten…', 'A entrar na sala {code}…', 'Ingresso nella stanza {code}…'],
  badLink: ['Ce lien d’invitation n’est pas valide (le code doit faire 6 lettres). Choisis un salon public ou entre un code.', 'This invite link is not valid (the code must be 6 letters). Pick a public room or enter a code.', 'Este enlace de invitación no es válido (el código debe tener 6 letras). Elige una sala pública o introduce un código.', 'Dieser Einladungslink ist ungültig (der Code hat 6 Buchstaben). Wähle einen öffentlichen Raum oder gib einen Code ein.', 'Esta ligação de convite não é válida (o código tem 6 letras). Escolhe uma sala pública ou introduz um código.', 'Questo link d’invito non è valido (il codice è di 6 lettere). Scegli una stanza pubblica o inserisci un codice.'],
  inviteGone: ['Le salon {code} n’existe plus : la partie est finie ou l’hôte est parti. Rejoins un salon public ou crée le tien.', 'Room {code} no longer exists: the match is over or the host left. Join a public room or create your own.', 'La sala {code} ya no existe: la partida terminó o el anfitrión se fue. Únete a una sala pública o crea la tuya.', 'Raum {code} gibt es nicht mehr: Das Spiel ist vorbei oder der Host ist gegangen. Tritt einem öffentlichen Raum bei oder erstelle deinen eigenen.', 'A sala {code} já não existe: a partida acabou ou o anfitrião saiu. Entra numa sala pública ou cria a tua.', 'La stanza {code} non esiste più: la partita è finita o l’host è uscito. Entra in una stanza pubblica o creane una tua.'],
});
const BOT_SIZE = { ffa: 8, tdm: 8, dom: 10, bomb: 8 }, BOT_MODES = Object.keys(BOT_SIZE);       // default target size per mode (same table in net-bots.js)
const sizeKey = mode => 'frontzero.botSize.' + mode;
const BACKOFF = [3000, 6000, 12000, 24000, 30000, 30000, 30000];      // after a failed ping; then it waits for the multiplayer tab or a click
const POLL_MS = 5000, POLL_SLOW = 12000, PING_TIMEOUT = 70000, LIST_TIMEOUT = 15000;

const CSS = `
.fzm .fzo-band{display:grid;gap:12px;min-width:0;margin:0;padding:14px 18px 16px}
/* the band sits in the play grid above the mode and map columns: the side panel starts where ui-theme sizes it (right under the head) */
@media (min-width:1181px){.fzm .fzm-play-grid>.fzo-band{grid-column:1/3;grid-row:1}.fzm .fzm-play-grid>.fzo-band~.fzm-col{grid-row:2}.fzm .fzm-play-grid>.fzo-band~.fzm-side{grid-column:3;grid-row:1/3}}
@media (max-width:1180px){.fzm .fzm-play-grid>.fzo-band{grid-column:1/-1;order:-4}}       /* rc8: above the Front band, so PARTIE RAPIDE is on the first screen (960x540, 1024x600) and never under the sticky CRÉER bar */
/* the multiplayer CRÉER block carries a hint line under its button (the solo one does not): ui-theme reserves 104 px for it, it takes ~120.
   Same cap as ui-theme with the real height, the hint kept on one line (under 841 px of height ui-theme hides it and its own cap stands). */
@media (min-width:1181px) and (min-height:841px){html.fz2ui .fzm-play--multi .fzm-side>.fzm-panel{max-height:calc(100vh - 80px - clamp(16px,2.2vw,34px) - 58px - clamp(16px,1.8vw,26px) - 126px)}.fzm-play--multi .fzm-cta-wrap .fzm-hint{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}}
.fzm .fzo-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px}
.fzm .fzo-head .fzm-h{margin:0}
.fzm .fzo-srv{display:inline-flex;align-items:center;gap:9px;min-height:30px;font-size:15px;font-weight:600;letter-spacing:.05em;color:var(--dim)}
.fzm .fzo-srv>i{flex:none;width:9px;height:9px;transform:rotate(45deg);background:#6d6a5c}
.fzm .fzo-srv.is-ok>i{background:var(--green);box-shadow:0 0 8px rgba(156,194,100,.7)}
.fzm .fzo-srv.is-wake>i{background:var(--amber);animation:fzo-pulse 1s ease-in-out infinite}
.fzm .fzo-srv.is-down>i,.fzm .fzo-srv.is-old>i{background:var(--red)}
.fzm .fzo-srv.is-ok.is-mid>i{background:var(--amber);box-shadow:0 0 8px rgba(232,166,40,.7)}       /* network delay: < 80 ms green, 80-150 amber, more red */
.fzm .fzo-srv.is-ok.is-bad>i{background:var(--red);box-shadow:0 0 8px rgba(224,73,47,.7)}
.fzm .fzo-srv small{font-size:13px;opacity:.8}
.fzm .fzo-srv .fzm-btn{min-height:30px;padding:2px 12px;font-size:14px}
@keyframes fzo-pulse{50%{opacity:.35}}
.fzm .fzo-quick{margin-left:auto;flex-direction:column;align-items:flex-start;gap:0;min-height:56px;padding:6px 46px 7px 20px;text-align:left}
.fzm .fzo-quick b{font-size:21px;font-weight:800;letter-spacing:.14em}
.fzm .fzo-quick small{font-size:13px;font-weight:700;letter-spacing:.08em;opacity:.78}
.fzm .fzo-quick::after{clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}
.fzm .fzo-quick>i{position:absolute;right:18px;top:50%;width:10px;height:10px;margin-top:-6px;border-right:3px solid currentColor;border-top:3px solid currentColor;transform:rotate(45deg)}
.fzm .fzo-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:10px;max-height:250px;overflow:auto;scrollbar-width:thin;scrollbar-color:rgba(236,226,198,.3) transparent}
.fzm .fzo-room{position:relative;display:grid;grid-template-columns:112px minmax(0,1fr) auto;grid-template-areas:"pic info act" "pic meta act" "pic sub act";gap:1px 12px;align-items:center;min-height:78px;padding:8px 10px 8px 8px;border:1px solid var(--hair,var(--line));background:linear-gradient(180deg,rgba(28,32,26,.94),rgba(13,15,12,.92));clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}
.fzm .fzo-room.is-mode{box-shadow:inset 3px 0 0 var(--amber)}
.fzm .fzo-room:hover{border-color:var(--hair2,var(--line-2))}
.fzm .fzo-room .fzm-thumb{grid-area:pic;align-self:stretch;width:112px;aspect-ratio:auto;min-height:62px;border:1px solid var(--line)}
.fzm .fzo-room .fzm-thumb b{font-size:22px}
.fzm .fzo-info{grid-area:info;min-width:0}
.fzm .fzo-info b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:20px;font-weight:800;letter-spacing:.04em;line-height:1.1;text-transform:uppercase;color:var(--white)}
.fzm .fzo-meta,.fzm .fzo-sub{display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;min-width:0;font-size:15px;line-height:1.25;color:var(--dim)}
.fzm .fzo-meta{grid-area:meta}
.fzm .fzo-sub{grid-area:sub}
.fzm .fzo-m{font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--amber)}
.fzm .fzo-n{font-weight:700;color:var(--sand);font-variant-numeric:tabular-nums}
.fzm .fzo-b{color:#9fc0e0}
.fzm .fzo-sub .fzm-tag{font-size:12px;padding:0 6px}
.fzm .fzo-sub .is-live{color:var(--green)}
.fzm .fzo-h{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:16ch;font-size:14px}
.fzm .fzo-room>.fzm-btn{grid-area:act}
.fzm .fzo-empty{grid-column:1/-1;display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 14px;font-size:17px;color:var(--dim);border:1px dashed var(--line)}
.fzm .fzo-empty::before{content:"";flex:none;width:10px;height:10px;transform:rotate(45deg);border:2px solid var(--amber)}
/* dialog */
.fzm .fzo-dlg{width:min(100%,600px);max-height:calc(100% - 24px);overflow:auto;gap:16px}
.fzm .fzo-dlg h3{display:flex;align-items:center;gap:12px}
.fzm .fzo-dlg h3::before{content:"";flex:none;width:6px;height:26px;background:linear-gradient(180deg,#ffc650,#e5a024);clip-path:polygon(0 0,100% 0,100% 100%,0 calc(100% - 6px))}
.fzm .fzo-sum{display:grid;grid-template-columns:128px minmax(0,1fr);gap:12px;align-items:center}
.fzm .fzo-sum .fzm-thumb{width:128px;aspect-ratio:16/9;border:1px solid var(--line)}
.fzm .fzo-sum b{display:block;font-size:22px;font-weight:800;text-transform:uppercase;color:var(--white)}
.fzm .fzo-sum span{font-size:15px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--amber)}
.fzm .fzo-vis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.fzm .fzo-vis>button{display:grid;gap:4px;align-content:start;min-height:96px;padding:12px 14px 14px 16px;text-align:left;color:var(--white);border:1px solid var(--line-2);background:rgba(8,10,7,.55);clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);transition:border-color .12s,background .12s}
.fzm .fzo-vis>button:hover{border-color:var(--amber)}
.fzm .fzo-vis>button[aria-checked=true]{border-color:var(--amber);background:linear-gradient(180deg,rgba(64,50,18,.9),rgba(28,23,11,.9));box-shadow:inset 0 0 0 1px var(--amber)}
.fzm .fzo-vis b{display:flex;align-items:center;gap:9px;font-size:20px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.fzm .fzo-vis b::before{content:"";flex:none;width:12px;height:12px;border:2px solid var(--line-2);transform:rotate(45deg)}
.fzm .fzo-vis>button[aria-checked=true] b::before{border-color:var(--amber);background:var(--amber)}
.fzm .fzo-vis small{font-size:15px;line-height:1.3;color:var(--sand)}
.fzm .fzo-sw{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 14px;align-items:center;cursor:pointer}
.fzm .fzo-sw input{position:absolute;opacity:0;width:1px;height:1px}
.fzm .fzo-sw>i{position:relative;grid-row:1/3;width:52px;height:26px;border:1px solid var(--line-2);background:rgba(8,10,7,.7);clip-path:polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%);transition:background .12s}
.fzm .fzo-sw>i::after{content:"";position:absolute;left:4px;top:4px;width:16px;height:16px;background:#e9e1c9;transition:transform .14s ease-out}
.fzm .fzo-sw input:checked+i{background:linear-gradient(180deg,#ffc650,#e5a024);border-color:var(--amber)}
.fzm .fzo-sw input:checked+i::after{transform:translateX(26px);background:#17140a}
.fzm .fzo-sw input:focus-visible+i{outline:2px solid var(--amber);outline-offset:2px}
.fzm .fzo-sw b{font-size:19px;font-weight:700;letter-spacing:.06em;color:var(--white)}
.fzm .fzo-sw small{font-size:15px;line-height:1.3;color:var(--dim)}
.fzm .fzo-size{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center}
.fzm .fzo-size .fzm-step{grid-template-columns:40px 7.5ch 40px;gap:8px}
.fzm .fzo-size .fzm-step button{height:40px}
.fzm .fzo-size .fzm-step output{font-size:22px;font-weight:800;text-align:center;color:var(--white);font-variant-numeric:tabular-nums}
.fzm .fzo-size.is-off{opacity:.45;pointer-events:none}
.fzm .fzo-note{font-size:16px;color:var(--dim)}
/* lobby options */
.fzm .fzo-opts{display:grid;gap:12px;padding-top:14px;border-top:1px solid var(--line)}
.fzm .fzo-opts .fzm-h{margin:0}
.fzm .fzo-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 14px}
.fzm .fzo-row>span{font-size:15px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.fzm .fzo-row .fzm-seg button{min-height:38px;font-size:15px}
.fzm .fzo-badge{display:inline-flex;align-items:center;gap:8px;padding:2px 10px;font-size:14px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--amber);border:1px solid currentColor}
.fzm .fzo-badge.is-private{color:var(--sand)}
.fzm .fzo-state{font-size:16px;color:var(--sand)}
.fzm .fzo-sim{font-size:14px;color:var(--dim)}
/* bot rows in the roster */
.fzm .fzm-player.is-bot .fzm-player-name{color:#c9d6e2;font-weight:500}
.fzm .fzm-player.is-bot .fzm-dot{background:#7fa9d6}
.fzm .fzo-bot{color:#9fc0e0;border-color:rgba(159,192,224,.6)}
/* invite links */
.fzm .fzo-invite{width:100%;gap:10px}
.fzm .fzo-invite svg,.fzo-flow-inv svg{flex:none;width:18px;height:18px}
.fzm .fzo-act{grid-area:act;display:grid;gap:4px;justify-items:stretch}
.fzm .fzo-copy{min-height:0;padding:2px 4px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--amber);background:none;border:0;cursor:pointer;text-align:center}
.fzm .fzo-copy:hover{color:var(--amber-2);text-decoration:underline}
.fzm .fzo-copy.is-done{color:var(--green)}
.fzm .fzo-inv-wait{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:10px 14px;font-size:17px;color:var(--white);border:1px solid var(--amber);background:linear-gradient(90deg,rgba(240,174,46,.16),rgba(240,174,46,.03))}
.fzm .fzm-end-actions .fzo-endinv{flex:1 1 100%;min-height:46px;font-size:18px}
.fzf .fzo-flow-inv{display:inline-flex;align-items:center;gap:8px}
@media (max-width:760px){.fzm .fzo-quick{margin-left:0;width:100%}.fzm .fzo-list{grid-template-columns:minmax(0,1fr);max-height:none}.fzm .fzo-vis{grid-template-columns:minmax(0,1fr)}.fzm .fzo-room{grid-template-columns:84px minmax(0,1fr);grid-template-areas:"pic info" "pic meta" "pic sub" "act act"}.fzm .fzo-room .fzm-thumb{width:84px}.fzm .fzo-room .fzm-btn{justify-self:stretch}.fzm .fzo-sum{grid-template-columns:96px minmax(0,1fr)}.fzm .fzo-sum .fzm-thumb{width:96px}}
@media (prefers-reduced-motion:reduce){.fzm .fzo-srv.is-wake>i{animation:none}}`;

/** HTTP address of the game server, from its WebSocket address (wss://host/ws -> https://host). */
const httpBase = url => String(url || '').replace(/^ws(s?):/i, 'http$1:').replace(/\/ws\/?$/, '');

export function install({ net, menu, i18n, engine }) {
  if (!net || !menu || !menu.kit) return null;
  const K = menu.kit, h = K.h;
  if (!document.getElementById('fzo-style')) { const s = document.createElement('style'); s.id = 'fzo-style'; s.textContent = CSS; document.head.append(s); }
  const li = () => Math.max(0, LANGS.indexOf((i18n && i18n.lang) || 'fr'));
  const L = (k, p) => { let s = (TX[k] && (TX[k][li()] || TX[k][0])) || k; if (p) s = s.replace(/\{(\w+)\}/g, (m, x) => (x in p ? String(p[x]) : m)); return s; };
  const base = httpBase(net.url);
  const modeOf = id => (K.MODES || []).find(m => m.id === id) || null;
  const modeName = id => K.modeName(modeOf(id)) || String(id || '');
  const env = id => (K.mapOf(id) || {}).env;
  const busy = () => !!K.st.pending;

  /* ---------- server wake-up: one request, then retries with backoff ---------- */
  const W = { state: 'idle', tries: 0, timer: 0, inflight: false, ms: 0, old: false, nextAt: 0, t0: 0 };
  /** One opaque request: it resolves as soon as the server answers anything (an older server without CORS or /api/ping included), it fails if nobody answers. */
  async function reach(ms) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
    try { await fetch(base + '/api/ping', { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctl.signal }); return true; } catch { return false; } finally { clearTimeout(to); }
  }
  async function ping() {
    if (W.inflight || W.state === 'ok') return;
    clearTimeout(W.timer); W.timer = 0;
    W.inflight = true; W.state = 'wake'; W.t0 = performance.now(); paintStatus();
    const ok = await reach(PING_TIMEOUT);
    W.inflight = false;
    if (ok) {
      // rc8: this first answer is the free host's wake-up (a cold start can take seconds), not the network delay: shown apart, briefly
      const took = performance.now() - W.t0; W.state = 'ok'; W.ms = 0; W.tries = 0; W.woke = took > 1500 ? Math.max(2, Math.round(took / 1000)) : 0; W.wokeUntil = W.woke ? performance.now() + 4000 : 0;
      paintStatus(); kick(); for (const fn of awaitQ.splice(0)) { try { fn(); } catch (e) { console.warn('[online]', e); } }
      rtt(); return;
    }
    W.state = 'down';
    const wait = BACKOFF[W.tries++];
    if (wait === undefined) { W.nextAt = 0; paintStatus(); return; }       // stops here: the multiplayer tab or the retry button starts again
    W.nextAt = Date.now() + wait; paintStatus();
    W.timer = setTimeout(ping, wait);
  }
  function retryNow() { W.tries = 0; clearTimeout(W.timer); W.timer = 0; ping(); }
  /* rc8: the real network delay = median of 3 warm requests, refreshed every 30 s while a status is on screen (none while the tab is hidden or a match runs) */
  let rttTimer = 0, rttBusy = false;
  const statusOnScreen = () => (!!band && band.isConnected && band.offsetParent !== null) || (!!pillEl && pillEl.isConnected && pillEl.getClientRects().length > 0);
  async function rtt() {
    clearTimeout(rttTimer); rttTimer = 0;
    if (W.state !== 'ok' || W.old) return;
    if (!rttBusy && !document.hidden && !(engine && (engine.running || engine.loading)) && (statusOnScreen() || !W.ms)) {
      rttBusy = true; const a = [];
      for (let i = 0; i < 3; i++) { const t = performance.now(); if (!(await reach(5000))) break; a.push(performance.now() - t); }
      rttBusy = false;
      if (a.length) { a.sort((x, y) => x - y); W.ms = Math.max(1, Math.round(a[a.length >> 1])); paintStatus(); }
    }
    rttTimer = setTimeout(rtt, 30000);
  }
  const rttClass = () => (!W.ms ? '' : W.ms < 80 ? ' is-good' : W.ms <= 150 ? ' is-mid' : ' is-bad');
  /** The "online" line: the wake-up time for 4 s when the host was asleep, then the measured delay. */
  function onlineText() {
    const now = performance.now();
    if (W.woke && now < W.wokeUntil) { clearTimeout(wokeTimer); wokeTimer = setTimeout(paintStatus, W.wokeUntil - now + 60); return L('woke', { s: W.woke }); }
    return W.old ? L('old') : W.ms ? L('online', { ms: W.ms }) : L('onlineNow');
  }
  let wokeTimer = 0;

  /* ---------- the public list: light poll while it is on screen ---------- */
  const LST = { rooms: null, timer: 0, inflight: false, sig: '', total: 0 };
  const shown = () => !!band && band.isConnected && band.offsetParent !== null && !document.hidden;
  function kick() {
    if (!shown()) return;
    if (W.state !== 'ok') { if (!W.inflight && !W.timer) { W.tries = Math.min(W.tries, 2); ping(); } return; }
    if (!W.old && !LST.timer && !LST.inflight) poll();
  }
  async function poll() {
    LST.timer = 0;
    if (!shown() || W.state !== 'ok' || W.old) return;
    LST.inflight = true;
    let next = POLL_MS;
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), LIST_TIMEOUT);
    try {
      const r = await fetch(base + '/api/rooms', { cache: 'no-store', credentials: 'omit', signal: ctl.signal });
      if (r.status === 429) next = POLL_SLOW;
      else if (r.status === 404) { W.old = true; paintStatus(); }
      else if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.rooms)) { LST.rooms = j.rooms.filter(x => x && typeof x.c === 'string' && /^[A-Z]{6}$/.test(x.c)); LST.total = j.total | 0; paintList(); } }
    } catch {
      // no list: an older server (its 404 has no CORS header) still answers an opaque request; otherwise it went down again
      clearTimeout(to); next = 0;
      if (await reach(LIST_TIMEOUT)) { W.old = true; paintStatus(); } else { W.state = 'down'; W.tries = 0; paintStatus(); ping(); }
    }
    finally { clearTimeout(to); LST.inflight = false; }
    if (next && shown() && !W.old) LST.timer = setTimeout(poll, next);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(kick, 0); });

  /* ---------- the band: status, quick play, list (one element, kept across menu renders) ---------- */
  let band = null, statusEl = null, listEl = null, quickEl = null, headCount = null, statusTimer = 0, invEl = null;
  function quick() {
    const st = K.st, map = st.map === 'random' ? K.MAPS[Math.floor(Math.random() * K.MAPS.length)].id : st.map;
    const go = () => { const name = K.pending('join', go); if (name === null) return; net.quickPlay({ name, mode: st.mode, map }); };
    go();
  }
  function buildBand() {
    statusEl = h('span', { class: 'fzo-srv', role: 'status', 'aria-live': 'polite' });
    headCount = h('span', { text: '' });
    quickEl = K.button('fzm-btn--primary fzo-quick', 'online:quick', [h('b'), h('small'), h('i', { 'aria-hidden': 'true' })], () => { if (quickWant) return; if (!quickNow()) quick(); });       // rc8: waits for a sleeping server instead of failing after 9 s
    listEl = h('div', { class: 'fzo-list', role: 'list' });
    const head = h('h3', { class: 'fzm-h' }, h('b', { class: 'fzo-title', style: 'font:inherit;letter-spacing:inherit' }), headCount);
    invEl = h('div', { class: 'fzo-inv-wait', role: 'status', 'data-fid': 'online:invite-wait', hidden: true });
    band = h('section', { class: 'fzm-panel fzo-band', 'data-fid': 'online:browser' }, h('div', { class: 'fzo-head' }, head, statusEl, quickEl), invEl, listEl);
  }
  function paintStatus() {
    if (!statusEl) { paintPill(); return; }       // the band was never shown: only the home card's pill
    clearTimeout(statusTimer); statusTimer = 0;
    statusEl.textContent = '';
    statusEl.className = 'fzo-srv is-' + (W.state === 'ok' ? (W.old ? 'old' : 'ok' + rttClass()) : W.state === 'down' ? 'down' : 'wake');
    statusEl.append(h('i', { 'aria-hidden': 'true' }));
    if (W.state === 'ok') statusEl.append(h('span', { text: onlineText() }));
    else if (W.state === 'down') {
      const s = W.nextAt ? Math.max(1, Math.ceil((W.nextAt - Date.now()) / 1000)) : 0;
      statusEl.append(h('span', { text: s ? L('down', { s }) : L('downStop') }), K.button('fzm-btn--sm', 'online:retry', L('retry'), () => { K.sfx('ui'); retryNow(); }));
      if (s) statusTimer = setTimeout(paintStatus, 1000);
    } else {
      statusEl.append(h('span', { text: L('waking') }));
      if (performance.now() - W.t0 > 4000) statusEl.append(h('small', { text: '(' + L('wakingLong') + ')' }));
      else statusTimer = setTimeout(paintStatus, 4100 - (performance.now() - W.t0));
    }
    if (quickEl) quickEl.disabled = busy() || W.old || quickWant;
    paintPill();
    paintList();
  }
  /* rc8 menu flow (menu-flow.js): a small copy of the server status for the home card, and quick play started from the home card
     (it waits for the free host to wake up instead of failing after 9 s) */
  let pillEl = null, quickWant = false, quickAt = 0;
  function paintPill() {
    if (!pillEl) return;
    const cls = 'fzo-srv fzo-pill is-' + (W.state === 'ok' ? (W.old ? 'old' : 'ok' + rttClass()) : W.state === 'down' ? 'down' : 'wake'), txt = W.state === 'ok' ? onlineText() : W.state === 'down' ? L('downStop') : L('waking');
    if (pillEl.className !== cls) pillEl.className = cls;
    const s = pillEl.lastChild; if (s && s.textContent !== txt) s.textContent = txt;
  }
  function statusPill() {
    if (!pillEl) { pillEl = h('span', { class: 'fzo-srv fzo-pill', role: 'status' }, h('i', { 'aria-hidden': 'true' }), h('span', { text: '' })); }
    paintPill(); setTimeout(kickPill, 0);
    return pillEl;
  }
  function kickPill() { if (W.state !== 'ok' && !W.inflight && !W.timer) { W.tries = Math.min(W.tries, 2); ping(); } }       // the home card is on screen: wake the host
  function quickNow() {
    if (busy() || W.old || quickWant) return false;
    quickWant = true; quickAt = performance.now(); paintStatus(); K.render();
    whenAwake(() => { if (!quickWant) return; quickWant = false; paintStatus(); quick(); });
    return true;
  }
  function quickCancel() { if (!quickWant) return false; quickWant = false; paintStatus(); K.render(); return true; }
  function roomCard(r) {
    const mine = r.m === K.st.mode, can = r.j === 1 && r.n < r.max;
    const state = r.st === 'playing' ? (r.r ? L('stRound', { n: r.r }) : L('stPlay')) : r.st === 'flow' ? L('stVote') : L('stLobby');
    const label = can ? L('join') : r.n >= r.max ? L('full') : L('locked');
    return h('div', { class: 'fzo-room' + (mine ? ' is-mode' : ''), role: 'listitem', 'data-fid': 'online:room:' + r.c },
      K.thumb(env(r.map), r.map),
      h('div', { class: 'fzo-info' }, h('b', { text: K.mapName(r.map) })),
      h('div', { class: 'fzo-meta' },
        h('span', { class: 'fzo-m', text: modeName(r.m) }),
        h('span', { class: 'fzo-n', text: `${r.n} / ${r.max}` }),
        r.b > 0 ? h('span', { class: 'fzo-b', text: L('bots', { n: r.b }) }) : null),
      h('div', { class: 'fzo-sub' },
        h('span', { class: 'fzm-tag' + (r.st === 'playing' ? ' is-live' : ''), text: state }),
        r.h ? h('span', { class: 'fzo-h', text: L('host', { name: r.h }) }) : null),
      h('div', { class: 'fzo-act' },
        K.button('fzm-btn--sm', 'online:join:' + r.c, label, () => K.joinRoom(r.c, { ls: 1 }), { disabled: !can || busy(), 'aria-label': `${label} : ${K.mapName(r.map)} · ${modeName(r.m)}` }),
        can ? h('button', { type: 'button', class: 'fzo-copy', 'data-fid': 'online:link:' + r.c, title: L('inviteBtn'), onclick: e => shareLink(r.c, e.currentTarget, L('cardLink')) }, L('cardLink')) : null));
  }
  function paintList() {
    if (!listEl) return;
    const rooms = LST.rooms, st = K.st;
    const sig = JSON.stringify([li(), st.mode, busy(), W.state, W.old, rooms]);
    if (sig === LST.sig) return;
    LST.sig = sig;
    listEl.textContent = '';
    headCount.textContent = rooms ? String(rooms.length) : '';
    if (W.old) { listEl.append(h('div', { class: 'fzo-empty', text: L('errNoPublic') })); return; }
    if (!rooms) { listEl.append(h('div', { class: 'fzo-empty', text: W.state === 'ok' ? L('loading') : W.state === 'down' ? L('downStop') : L('waking') })); return; }
    if (!rooms.length) { listEl.append(h('div', { class: 'fzo-empty', text: L('empty') })); return; }
    const list = rooms.slice().sort((a, b) => (b.m === st.mode) - (a.m === st.mode) || b.j - a.j || b.n - a.n);
    for (const r of list) listEl.append(roomCard(r));
  }
  function browser() {
    if (!band) buildBand();
    band.querySelector('.fzo-title').textContent = L('pubTitle');
    quickEl.firstChild.textContent = L('quick'); quickEl.children[1].textContent = L('quickSub', { mode: modeName(K.st.mode) });
    quickEl.disabled = busy() || W.old;
    LST.sig = ''; paintStatus(); paintInvite();
    setTimeout(kick, 0);       // once the menu has put the band on screen
    return band;
  }

  /* ---------- create dialog: private (default) or public, fill with bots ---------- */
  let dlg = null;
  function closeDlg() {
    if (!dlg) return;
    const d = dlg; dlg = null; d.layer.remove();
    for (const el of d.inert) el.inert = false;
    const back = document.querySelector('[data-fid="multi:create"]'); if (back && !back.disabled) back.focus({ preventScroll: true });
  }
  /** The menu's own root (another module also uses the .fzm class): the one that holds the menu's main area. */
  const menuRoot = () => { const m = document.querySelector('.fzm>.fzm-main'); return m ? m.parentElement : null; };
  function create(createRoom) {
    if (busy() || W.old || !menuRoot()) return false;
    const st = K.st, botsHere = BOT_MODES.includes(st.mode);
    const S = { pub: false, bots: false, touched: false, bz: BOT_SIZE[st.mode] || 8 };
    try { const v = Number(localStorage.getItem(sizeKey(st.mode))); if (v >= 2 && v <= 12) S.bz = v; } catch { /* storage unavailable */ }
    const box = h('div', { class: 'fzm-dialog fzo-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fzo-dlg-t', 'data-fid': 'online:create' });
    const layer = h('div', { class: 'fzm-layer' }, box);
    function body() {
      box.textContent = '';
      const map = st.map === 'random' ? 'random' : st.map;
      const vis = K.radios('online:vis', L('visibility'), S.pub ? 'public' : 'private', [
        { id: 'private', kids: [h('b', { text: L('private') }), h('small', { text: L('privateDesc') })] },
        { id: 'public', kids: [h('b', { text: L('public') }), h('small', { text: L('publicDesc') })] },
      ], id => { S.pub = id === 'public'; if (!S.touched) S.bots = S.pub; body(); focus('[data-fid="online:vis:' + id + '"]'); }, 'fzo-vis');
      const sw = h('input', { type: 'checkbox', role: 'switch', 'data-fid': 'online:bots', 'aria-describedby': 'fzo-fill-d' }); sw.checked = S.bots;
      sw.addEventListener('change', () => { S.bots = sw.checked; S.touched = true; K.sfx('ui'); body(); focus('[data-fid="online:bots"]'); });
      const out = h('output', { text: String(S.bz), 'aria-live': 'polite' });
      const step = d => { S.bz = Math.min(12, Math.max(2, S.bz + d)); out.textContent = String(S.bz); K.sfx('ui'); };
      box.append(
        h('h3', { id: 'fzo-dlg-t', text: L('createTitle') }),
        h('div', { class: 'fzo-sum' }, K.thumb(env(map), map), h('div', null, h('b', { text: K.mapName(map) }), h('span', { text: modeName(st.mode) }))),
        h('div', { class: 'fzm-field' }, h('div', { class: 'fzm-label' }, h('span', { text: L('visibility') })), vis),
        botsHere ? h('label', { class: 'fzo-sw' }, sw, h('i', { 'aria-hidden': 'true' }), h('b', { text: L('fill') }), h('small', { id: 'fzo-fill-d', text: L('fillDesc') })) : h('p', { class: 'fzo-note', text: L('noBots') }),
        botsHere ? h('div', { class: 'fzo-size' + (S.bots ? '' : ' is-off') }, h('div', { class: 'fzm-label' }, h('span', { text: L('size') })),
          h('div', { class: 'fzm-step' }, h('button', { type: 'button', 'data-fid': 'online:bz-', 'aria-label': L('size') + ' −', onclick: () => step(-1), tabindex: S.bots ? null : '-1' }, '−'), out,
            h('button', { type: 'button', 'data-fid': 'online:bz+', 'aria-label': L('size') + ' +', onclick: () => step(1), tabindex: S.bots ? null : '-1' }, '+'))) : null,
        h('div', { class: 'fzm-dialog-actions' },
          K.button('', 'online:cancel', L('cancel'), () => { K.sfx('ui'); closeDlg(); }),
          K.button('fzm-btn--primary', 'online:confirm', L('createBtn'), () => {
            const opts = S.pub ? { pub: 1, bots: S.bots && botsHere ? 1 : 0, bz: S.bz } : S.bots && botsHere ? { bots: 1, bz: S.bz } : undefined;
            try { if (botsHere && S.bots) localStorage.setItem(sizeKey(st.mode), String(S.bz)); } catch { /* storage unavailable */ }
            closeDlg(); createRoom(opts);
          })));
    }
    const focus = sel => { const e = box.querySelector(sel); if (e) e.focus(); };
    body();
    layer.addEventListener('mousedown', e => { if (e.target === layer) closeDlg(); });
    layer.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDlg(); return; }
      if (e.key !== 'Tab') return;
      const els = [...box.querySelectorAll('button:not([disabled]):not([tabindex="-1"]),input:not([disabled])')].filter(x => x.offsetParent !== null || x.type === 'checkbox');
      if (!els.length) return;
      const i = els.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); els[els.length - 1].focus(); } else if (!e.shiftKey && (i === els.length - 1 || i < 0)) { e.preventDefault(); els[0].focus(); }
    });
    const root = menuRoot(), inert = [...root.querySelectorAll(':scope>.fzm-top,:scope>.fzm-main')];
    for (const el of inert) el.inert = true;
    root.append(layer); dlg = { layer, inert };
    focus('[data-fid="online:vis:private"]');
    return true;
  }

  /* ---------- lobby: visibility and bots ---------- */
  function lobby(room, isHost, playing) {
    if (!room || room.pub === undefined) return null;       // an older server: nothing to show
    const canEdit = isHost && !playing && net.pubOk, botsHere = Array.isArray(room.bm) && room.bm.includes(room.mode);
    const players = Array.isArray(room.players) ? room.players : [], nBots = players.filter(p => p.bot).length;
    const vis = canEdit ? K.radios('online:rvis', L('visibility'), room.pub ? 'public' : 'private', [{ id: 'private', kids: L('private') }, { id: 'public', kids: L('public') }],
      id => net.sendRoomOpts({ pub: id === 'public' }), 'fzm-seg')
      : h('span', { class: 'fzo-badge' + (room.pub ? '' : ' is-private'), text: room.pub ? L('public') : L('private') });
    const kids = [h('h3', { class: 'fzm-h', text: L('roomOpts') }), h('div', { class: 'fzo-row' }, h('span', { text: L('visibility') }), vis)];
    if (botsHere) {
      if (canEdit) {
        const sw = h('input', { type: 'checkbox', role: 'switch', 'data-fid': 'lobby:bots' }); sw.checked = room.bo === 1;
        sw.addEventListener('change', () => { K.sfx('ui'); net.sendRoomOpts({ bots: sw.checked }); });
        kids.push(h('label', { class: 'fzo-sw' }, sw, h('i', { 'aria-hidden': 'true' }), h('b', { text: L('fill') }), h('small', { text: room.bo === 1 ? L('botsOn', { n: nBots, t: room.bz }) : L('fillDesc') })));
        const set = d => { const v = Math.min(12, Math.max(2, (room.bz | 0) + d)); if (v !== room.bz) { K.sfx('ui'); try { localStorage.setItem(sizeKey(room.mode), String(v)); } catch { /* storage unavailable */ } net.sendRoomOpts({ bz: v }); } };
        kids.push(h('div', { class: 'fzo-size' + (room.bo === 1 ? '' : ' is-off') }, h('div', { class: 'fzm-label' }, h('span', { text: L('size') })),
          h('div', { class: 'fzm-step' }, h('button', { type: 'button', 'data-fid': 'lobby:bz-', 'aria-label': L('size') + ' −', onclick: () => set(-1) }, '−'), h('output', { text: String(room.bz) }),
            h('button', { type: 'button', 'data-fid': 'lobby:bz+', 'aria-label': L('size') + ' +', onclick: () => set(1) }, '+'))));
      } else kids.push(h('div', { class: 'fzo-row' }, h('span', { text: L('fill') }), h('b', { class: 'fzo-state', text: room.bo === 1 ? L('botsOn', { n: nBots, t: room.bz }) : L('botsOff') })));
      if (room.bo === 1) {
        const sim = players.find(p => p.id === room.bs);
        kids.push(h('small', { class: 'fzo-sim', text: sim ? L('simBy', { name: sim.name }) : L('noSim') }));
      }
    }
    return h('div', { class: 'fzo-opts', 'data-fid': 'lobby:options' }, kids);
  }
  function botRow(p) {
    return h('div', { class: 'fzm-player is-ready is-bot' },
      h('i', { class: 'fzm-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'fzm-player-name', text: String(p.name || '').replace(/^\[BOT\]\s*/, '') }),
      h('span', { class: 'fzm-tag fzo-bot', text: 'BOT' }));
  }
  /** Host's hint in the lobby. The menu's own one (this page's address, for players on the same network) only makes sense for a local or LAN
   *  server; on the published site (game server elsewhere: <meta name="fz-server">) or any public address, the code is what friends need. */
  function share() {
    let hosted = false;
    try { hosted = !!document.querySelector('meta[name="fz-server"]') || !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)|\.local$/i.test(location.hostname); } catch { hosted = false; }
    if (!hosted) return null;
    const room = K.st.room;
    return h('div', { class: 'fzm-callout', 'data-fid': 'lobby:share' }, h('span', { text: L('share') }), room && room.pub === 1 ? h('small', { text: L('sharePub') }) : null);
  }
  function errorText(code) {
    if (code === 'too_many_rooms') return L('errTooMany');
    if (code === 'in_progress') return L('errInProgress');
    if (code === 'no_public') return L('errNoPublic');
    if (code === 'bad_invite') return L('badLink');
    if (code === 'invite_gone') return L('inviteGone', { code: INV.gone || '' });
    return null;
  }

  /* ---------- invite links: ?join=CODE (or #join=CODE) opens the game straight into that room ---------- */
  const INV = { code: null, state: '', gone: '', last: '' }, awaitQ = [];
  let simLoad = null;       // bots-sim.js loading (set at the end of install)
  const LINK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const linkIcon = () => { const s = document.createElement('span'); s.innerHTML = LINK_SVG; return s.firstChild; };
  /** The address friends open: on the published site its canonical address (og:url), on a local or LAN server this page's own address. */
  function siteUrl() {
    try {
      const og = document.querySelector('meta[property="og:url"]');
      if (document.querySelector('meta[name="fz-server"]') && og && /^https:\/\/[^\s"<>]+$/.test(og.content)) return og.content;
      return location.origin + location.pathname;
    } catch { return ''; }
  }
  const inviteUrl = code => { const u = siteUrl(); return u ? `${u}${u.includes('?') ? '&' : '?'}join=${encodeURIComponent(code)}` : ''; };
  const touch = () => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };
  async function copyText(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch { /* the fallback below */ }
    try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0'; document.body.append(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch { return false; }
  }
  /** Phones: the system share sheet. Elsewhere: the clipboard, and the button says so for 2 s. */
  async function shareLink(code, btn) {
    const url = inviteUrl(code); if (!url) return;
    INV.last = url; K.sfx('ui');
    if (navigator.share && touch()) { try { await navigator.share({ title: 'FRONT ZÉRO', text: L('shareText', { code }), url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    const ok = await copyText(url);
    K.toast(ok ? L('linkCopied') : L('linkShow', { url }));
    if (btn && ok) {
      const span = btn.querySelector('.fzo-lbl') || btn, old = span.textContent;
      span.textContent = L('linkCopied'); btn.classList.add('is-done');
      setTimeout(() => { span.textContent = old; btn.classList.remove('is-done'); }, 2000);
    }
  }
  const inviteLabel = () => (navigator.share && touch() ? L('inviteShare') : L('inviteBtn'));
  /** Lobby: next to the code. */
  function invite(room) {
    if (!room || !room.code) return null;
    return K.button('fzm-btn--block fzo-invite', 'lobby:invite', [linkIcon(), h('span', { class: 'fzo-lbl', text: inviteLabel() })], e => shareLink(room.code, e.currentTarget));
  }
  /** The menu's own end screen of an online match (older server: no vote screen), the room goes on. */
  function endInvite(room) {
    if (!room || !room.code) return null;
    return K.button('fzo-endinv', 'end:invite', [linkIcon(), h('span', { class: 'fzo-lbl', text: L('inviteShare') })], e => shareLink(room.code, e.currentTarget));
  }
  /** The end-of-match vote screen (match-flow.js, a persistent overlay): a small "Invite friends" button beside its own. */
  function flowButton() {
    const fr = document.getElementById('fz-flow'), acts = fr && fr.querySelector('.fzf-acts'); if (!acts) return;
    let b = acts.querySelector('[data-fid="flow:invite"]');
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.className = 'fzf-btn fzo-flow-inv'; b.setAttribute('data-fid', 'flow:invite');
      const s = document.createElement('span'); s.className = 'fzo-lbl'; b.append(linkIcon(), s);
      b.addEventListener('click', () => { const r = net.room; if (r && r.code) shareLink(r.code, b); });
      acts.prepend(b);
    }
    if (!b.classList.contains('is-done')) b.querySelector('.fzo-lbl').textContent = L('inviteShare');
    b.hidden = !(net.room && net.room.code);
  }
  try { net.on('flow', () => setTimeout(flowButton, 0)); } catch { /* optional */ }

  function readInvite() {
    let code = null;
    try { const q = new URLSearchParams(location.search); if (q.has('join')) code = q.get('join'); else { const m = /[#&]join=([^&]*)/.exec(location.hash || ''); if (m) code = decodeURIComponent(m[1]); } } catch { /* no address */ }
    if (code === null) return null;
    try { const u = new URL(location.href); u.searchParams.delete('join'); if (/join=/.test(u.hash)) u.hash = ''; history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch { /* a reload would offer it again */ }
    return String(code || '').trim().toUpperCase();
  }
  function paintInvite() {
    if (!invEl) return;
    const on = !!INV.code && (INV.state === 'wait' || INV.state === 'joining');
    invEl.hidden = !on;
    if (on) invEl.textContent = INV.state === 'wait' ? L('inviteWait', { code: INV.code }) : L('inviteJoining', { code: INV.code });
  }
  function whenAwake(fn) { if (W.state === 'ok') fn(); else { awaitQ.push(fn); if (!W.inflight && !W.timer) retryNow(); } }
  function joinNow() { if (!INV.code) return; INV.state = 'joining'; paintInvite(); K.joinRoom(INV.code); }
  function setName(name) { const el = document.querySelector('[data-fid="multi:name"]'); if (el) { el.value = name; el.dispatchEvent(new Event('change', { bubbles: true })); } }
  /** The only question an invite asks, and only when no name is saved yet. */
  function nameDialog(code, done) {
    const root = menuRoot(); if (!root) { done(null); return; }
    const input = h('input', { class: 'fzm-input', type: 'text', maxlength: '16', autocomplete: 'nickname', spellcheck: 'false', 'data-fid': 'invite:name', placeholder: K.L('m.namePh'), 'aria-labelledby': 'fzo-inv-p' });
    const go = () => { const v = input.value.trim(); if (!v) { input.focus(); return; } close(); done(v); };
    const box = h('div', { class: 'fzm-dialog fzo-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fzo-inv-t', 'data-fid': 'online:invite' },
      h('h3', { id: 'fzo-inv-t', text: L('inviteTitle', { code }) }), h('p', { class: 'fzo-note', id: 'fzo-inv-p', text: L('inviteName') }), input,
      h('div', { class: 'fzm-dialog-actions', style: 'grid-template-columns:minmax(0,1fr)' }, K.button('fzm-btn--primary', 'invite:go', L('inviteGo'), go)));
    const layer = h('div', { class: 'fzm-layer' }, box), inert = [...root.querySelectorAll(':scope>.fzm-top,:scope>.fzm-main')];
    const close = () => { layer.remove(); for (const el of inert) el.inert = false; };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    layer.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); done(null); } else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === input ? box.querySelector('[data-fid="invite:go"]') : input).focus(); } });
    for (const el of inert) el.inert = true;
    root.append(layer); input.focus();
  }
  function startInvite(code) {
    try { menu.show('multi'); } catch { /* the menu shows itself */ }
    if (!/^[A-Z]{6}$/.test(code)) { K.st.netError = { code: 'bad_invite' }; K.render(); return; }
    INV.code = code; INV.state = 'name';
    setTimeout(() => {
      const el = document.querySelector('[data-fid="multi:name"]'), saved = el ? el.value.trim() : '';
      // joined too early, this client would lack what it announces in 'join': the end-of-match vote (match-flow.js sets net.flowClient; the room
      // would fall back to the old end screen for everyone) and the bot simulator (bots-sim.js sets joinCaps.bc). Both load right after the menu.
      const go = () => {
        INV.state = 'wait'; paintInvite();
        const t0 = performance.now(), ready = () => (!!net.flowClient && !!(net.joinCaps && net.joinCaps.bc)) || performance.now() - t0 > 4000;
        const step = () => { if (!INV.code) return; if (!ready()) { setTimeout(step, 100); return; } INV.state = W.state === 'ok' ? 'joining' : 'wait'; paintInvite(); whenAwake(joinNow); };
        Promise.resolve(simLoad).then(step, step);
      };
      if (saved) go();
      else nameDialog(code, name => { if (!name) { INV.code = null; INV.state = ''; paintInvite(); return; } setName(name); go(); });
    }, 0);
  }
  try {
    net.on('room', () => { if (INV.code) { INV.code = null; INV.state = ''; paintInvite(); } });
    net.on('error', e => {
      if (!INV.code || INV.state !== 'joining') return;
      const c = e && e.code, code = INV.code;
      INV.code = null; INV.state = ''; paintInvite();
      if (c === 'room_not_found' || c === 'bad_code') setTimeout(() => { INV.gone = code; K.st.netError = { code: 'invite_gone' }; K.render(); }, 0);       // after the menu's own message
    });
  } catch { /* optional */ }

  menu.ext = { browser, create, lobby, botRow, errorText, share, invite, endInvite, siteUrl,       // siteUrl: also the address on the best-moment videos (replay-export.js)
    statusPill, quickNow, quickCancel, quickWaiting: () => quickWant, serverState: () => ({ state: W.state, ms: W.ms, old: W.old, t0: W.t0, inflight: W.inflight, nextAt: W.nextAt, quickAt }),       // rc8 menu flow (menu-flow.js)
    inviteStatus: () => { if (!band) buildBand(); paintInvite(); return invEl; } };
  if (net.on) { try { net.on('room', () => { if (dlg) closeDlg(); }); } catch { /* optional */ } }
  K.render();
  ping();       // the menu just loaded: wake the free host now, not when the player clicks
  { const code = readInvite(); if (code !== null) startInvite(code); }       // opened from an invite link
  simLoad = import('./bots-sim.js').then(m => { const b = m.install({ net, engine }); try { if (window.__fz) window.__fz.bots = b; } catch { /* dev only */ } }).catch(e => console.warn('[online] bots unavailable', e));
  return { ping, wake: W, list: LST, browser, create, invite: INV, inviteUrl };
}
