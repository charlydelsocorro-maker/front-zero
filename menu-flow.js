// FRONT ZÉRO — menu flow (rc8). The JOUER tab opens on a home hub with three clear entries: PARTIE RAPIDE (online, one click, bots fill the
// teams), JOUER ENTRE AMIS (create a room or join with a code or a link) and SOLO · ENTRAÎNEMENT (offline against bots). Each sub-screen has
// a visible RETOUR and says where you are (JOUER › …). An ÉQUIPEMENT screen gathers class, weapons, gear and outfit. Light first-visit hints
// (stored locally, never blocking). The Front band sits on the hub as an invitation.
// Loaded by menu.js before its first render (guarded: if this file fails, the menu keeps the rc7 layout). It only lays out the menu's own
// pieces (menu.kit), so every data-fid of rc7 is kept: playmode:solo / playmode:multi are the SOLO and ENTRE AMIS entries of the hub.
// Switch: FLOW_ON below, or ?flow=1 / ?flow=0 in the address.
import { WEAPONS, OUTFITS, CLASSES, byId } from './data.js';
import './gear-data.js';

export const FLOW_ON = true;       // approved 25/11 (orchestrator); ?flow=0 gives the rc7 layout back
export function enabled() {
  let q = null; try { q = new URLSearchParams(location.search).get('flow'); } catch { /* no location */ }
  return q === '1' ? true : q === '0' ? false : FLOW_ON;
}

const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const TX = {       // fr, en, es, de, pt, it
  hubTitle: ['Choisis ta partie', 'Pick your game', 'Elige tu partida', 'Wähle dein Spiel', 'Escolhe a tua partida', 'Scegli la tua partita'],
  quickK: ['En ligne', 'Online', 'En línea', 'Online', 'Online', 'Online'],
  quickT: ['Partie rapide', 'Quick play', 'Partida rápida', 'Schnelles Spiel', 'Partida rápida', 'Partita rapida'],
  quickD: ['Un clic et tu joues : des bots complètent les équipes.', 'One click and you are in: bots fill the teams.', 'Un clic y a jugar: los bots completan los equipos.', 'Ein Klick und du spielst: Bots füllen die Teams auf.', 'Um clique e estás a jogar: os bots completam as equipas.', 'Un clic e giochi: i bot completano le squadre.'],
  quickGo: ['Jouer maintenant', 'Play now', 'Jugar ahora', 'Jetzt spielen', 'Jogar agora', 'Gioca ora'],
  quickMore: ['Mode et salons', 'Mode and rooms', 'Modo y salas', 'Modus und Räume', 'Modo e salas', 'Modalità e stanze'],
  modeIs: ['Mode : {m}', 'Mode: {m}', 'Modo: {m}', 'Modus: {m}', 'Modo: {m}', 'Modalità: {m}'],
  friendsK: ['Avec tes amis', 'With your friends', 'Con tus amigos', 'Mit deinen Freunden', 'Com os teus amigos', 'Con i tuoi amici'],
  friendsT: ['Jouer entre amis', 'Play with friends', 'Jugar con amigos', 'Mit Freunden spielen', 'Jogar com amigos', 'Gioca con gli amici'],
  friendsD: ['Crée un salon et envoie le lien, ou rejoins avec un code.', 'Create a room and send the link, or join with a code.', 'Crea una sala y envía el enlace, o únete con un código.', 'Erstelle einen Raum und schick den Link oder tritt mit einem Code bei.', 'Cria uma sala e envia a ligação, ou entra com um código.', 'Crea una stanza e invia il link, o entra con un codice.'],
  friendsGo: ['Créer ou rejoindre', 'Create or join', 'Crear o unirse', 'Erstellen oder beitreten', 'Criar ou entrar', 'Crea o entra'],
  soloK: ['Hors ligne', 'Offline', 'Sin conexión', 'Offline', 'Offline', 'Offline'],
  soloT: ['Solo · Entraînement', 'Solo · Training', 'Solo · Entrenamiento', 'Solo · Training', 'Solo · Treino', 'Solo · Allenamento'],
  soloD: ['Contre des bots, à ton rythme.', 'Against bots, at your own pace.', 'Contra bots, a tu ritmo.', 'Gegen Bots, in deinem Tempo.', 'Contra bots, ao teu ritmo.', 'Contro i bot, al tuo ritmo.'],
  soloGo: ['S’entraîner', 'Train', 'Entrenar', 'Trainieren', 'Treinar', 'Allenati'],
  soloMeta: ['{mode} · {map} · {n} bots', '{mode} · {map} · {n} bots', '{mode} · {map} · {n} bots', '{mode} · {map} · {n} Bots', '{mode} · {map} · {n} bots', '{mode} · {map} · {n} bot'],
  gearT: ['Équipement', 'Loadout', 'Equipamiento', 'Ausrüstung', 'Equipamento', 'Equipaggiamento'],
  gearBtn: ['Équipement', 'Loadout', 'Equipamiento', 'Ausrüstung', 'Equipamento', 'Equipaggiamento'],
  back: ['Retour', 'Back', 'Volver', 'Zurück', 'Voltar', 'Indietro'],
  crumbLabel: ['Tu es ici','You are here', 'Estás aquí', 'Du bist hier', 'Estás aqui', 'Sei qui'],
  soloSub: ['Choisis le mode, la carte et les bots, puis déploie-toi.', 'Pick the mode, the map and the bots, then deploy.', 'Elige el modo, el mapa y los bots, y despliégate.', 'Wähle Modus, Karte und Bots, dann geht es los.', 'Escolhe o modo, o mapa e os bots, e entra em ação.', 'Scegli modalità, mappa e bot, poi schierati.'],
  friendsTitle: ['Entre amis', 'With friends', 'Con amigos', 'Mit Freunden', 'Com amigos', 'Con gli amici'],
  friendsSub: ['Crée ton salon et envoie le lien à tes amis, ou entre le code qu’on t’a donné.', 'Create your room and send the link to your friends, or enter the code you were given.', 'Crea tu sala y envía el enlace a tus amigos, o introduce el código que te han dado.', 'Erstelle deinen Raum und schick den Link an deine Freunde, oder gib den Code ein, den du bekommen hast.', 'Cria a tua sala e envia a ligação aos teus amigos, ou introduz o código que te deram.', 'Crea la tua stanza e invia il link ai tuoi amici, o inserisci il codice che ti hanno dato.'],
  createT: ['Créer un salon', 'Create a room', 'Crear una sala', 'Raum erstellen', 'Criar uma sala', 'Crea una stanza'],
  createD: ['Choisis le mode et la carte. Tu auras ensuite un lien à partager.', 'Pick the mode and the map. You then get a link to share.', 'Elige el modo y el mapa. Después tendrás un enlace para compartir.', 'Wähle Modus und Karte. Danach bekommst du einen Link zum Teilen.', 'Escolhe o modo e o mapa. Depois terás uma ligação para partilhar.', 'Scegli modalità e mappa. Poi avrai un link da condividere.'],
  joinT: ['Rejoindre un ami', 'Join a friend', 'Unirse a un amigo', 'Einem Freund beitreten', 'Juntar-se a um amigo', 'Raggiungi un amico'],
  joinD: ['Entre le code de son salon. Avec son lien d’invitation, tu arrives directement ici.', 'Enter their room code. With their invite link you land here directly.', 'Introduce el código de su sala. Con su enlace de invitación llegas aquí directamente.', 'Gib seinen Raumcode ein. Mit seinem Einladungslink landest du direkt hier.', 'Introduz o código da sala. Com a ligação de convite chegas aqui diretamente.', 'Inserisci il codice della sua stanza. Con il suo link d’invito arrivi qui direttamente.'],
  youT: ['Toi', 'You', 'Tú', 'Du', 'Tu', 'Tu'],
  quickSub: ['Choisis un mode : tu rejoins un salon public, des bots tiennent les places libres.', 'Pick a mode: you join a public room, bots hold the free seats.', 'Elige un modo: entras en una sala pública y los bots ocupan las plazas libres.', 'Wähle einen Modus: Du kommst in einen öffentlichen Raum, Bots halten die freien Plätze.', 'Escolhe um modo: entras numa sala pública e os bots ocupam os lugares livres.', 'Scegli una modalità: entri in una stanza pubblica, i bot tengono i posti liberi.'],
  searching: ['Recherche d’une partie…', 'Finding a match…', 'Buscando partida…', 'Spiel wird gesucht…', 'À procura de uma partida…', 'Ricerca di una partita…'],
  wakingLong: ['Le serveur se réveille, cela peut prendre une minute.', 'The server is waking up, this can take a minute.', 'El servidor se está despertando, puede tardar un minuto.', 'Der Server wird geweckt, das kann eine Minute dauern.', 'O servidor está a acordar, pode demorar um minuto.', 'Il server si sta svegliando, può volerci un minuto.'],
  cancel: ['Annuler', 'Cancel', 'Cancelar', 'Abbrechen', 'Cancelar', 'Annulla'],
  stepWake: ['Réveil du serveur', 'Waking the server', 'Despertando el servidor', 'Server wird geweckt', 'A acordar o servidor', 'Risveglio del server'],
  stepFind: ['Recherche d’un salon', 'Finding a room', 'Buscando sala', 'Raum wird gesucht', 'À procura de sala', 'Ricerca di una stanza'],
  stepJoin: ['Entrée en partie', 'Joining the match', 'Entrando en la partida', 'Spiel wird betreten', 'A entrar na partida', 'Ingresso in partita'],
  loadoutSub: ['Ta classe, tes armes, ton équipement de combat et ta tenue. Tout est gardé pour les prochaines parties.', 'Your class, weapons, combat gear and outfit. Everything is kept for your next matches.', 'Tu clase, tus armas, tu equipo de combate y tu atuendo. Todo se guarda para las próximas partidas.', 'Deine Klasse, Waffen, Kampfausrüstung und dein Outfit. Alles bleibt für die nächsten Spiele.', 'A tua classe, as tuas armas, o teu equipamento de combate e a tua farda. Tudo fica guardado para as próximas partidas.', 'La tua classe, le tue armi, l’equipaggiamento da combattimento e la tenuta. Tutto resta per le prossime partite.'],
  clsT: ['Classe', 'Class', 'Clase', 'Klasse', 'Classe', 'Classe'],
  armsT: ['Armes et tenue', 'Weapons and outfit', 'Armas y atuendo', 'Waffen und Outfit', 'Armas e farda', 'Armi e tenuta'],
  outfit: ['Tenue', 'Outfit', 'Atuendo', 'Outfit', 'Farda', 'Tenuta'],
  combat: ['Équipement de combat', 'Combat gear', 'Equipo de combate', 'Kampfausrüstung', 'Equipamento de combate', 'Equipaggiamento da combattimento'],
  change: ['Changer', 'Change', 'Cambiar', 'Ändern', 'Trocar', 'Cambia'],
  done: ['C’est bon', 'Done', 'Listo', 'Fertig', 'Pronto', 'Fatto'],
  coachStartT: ['Commence ici', 'Start here', 'Empieza aquí', 'Hier starten', 'Começa aqui', 'Inizia qui'],
  coachStartD: ['Un clic, et tu joues en ligne.', 'One click and you are playing online.', 'Un clic y juegas en línea.', 'Ein Klick und du spielst online.', 'Um clique e jogas online.', 'Un clic e giochi online.'],
  coachGearT: ['Ton équipement', 'Your loadout', 'Tu equipamiento', 'Deine Ausrüstung', 'O teu equipamento', 'Il tuo equipaggiamento'],
  coachGearD: ['Classe, armes et tenue se changent ici.', 'Change your class, weapons and outfit here.', 'Cambia aquí tu clase, armas y atuendo.', 'Hier änderst du Klasse, Waffen und Outfit.', 'Muda aqui a classe, as armas e a farda.', 'Qui cambi classe, armi e tenuta.'],
  coachFrontT: ['Le Front', 'The Front', 'El Frente', 'Die Front', 'A Frente', 'Il Fronte'],
  coachFrontD: ['Choisis un camp : tes parties en ligne font bouger la ligne de front.', 'Pick a side: your online matches move the front line.', 'Elige un bando: tus partidas en línea mueven la línea del frente.', 'Wähle eine Seite: Deine Online-Spiele verschieben die Front.', 'Escolhe um lado: as tuas partidas online mexem a linha da frente.', 'Scegli una parte: le tue partite online spostano la linea del fronte.'],
  coachClose: ['Compris', 'Got it', 'Entendido', 'Verstanden', 'Entendido', 'Capito'],
  room: ['Salon', 'Room', 'Sala', 'Raum', 'Sala', 'Stanza'],
};

const CSS = `
/* ---------- hub ---------- */
.fzm .fzh-hub{display:grid;gap:clamp(14px,1.5vw,22px)}
.fzm .fzh-hub>.fzm-play-head{order:-1;margin:0;align-items:flex-end;justify-content:space-between}
.fzm .fzh-hello small{display:block;margin-bottom:4px;font-size:15px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;color:var(--amber)}
.fzm .fzh-hello h2{font-size:clamp(30px,2.6vw,46px);font-weight:800;letter-spacing:.04em;line-height:1;text-transform:uppercase;color:var(--white)}
.fzm .fzh-cards{display:grid;grid-template-columns:minmax(0,1.42fr) minmax(0,1fr) minmax(0,1fr);gap:clamp(12px,1.3vw,20px)}
.fzm .fzh-card{position:relative;isolation:isolate;min-height:clamp(230px,calc(100vh - 450px),540px);min-width:0;overflow:hidden;border:1px solid var(--hair,var(--line));background:#12150f;clip-path:polygon(0 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%)}
.fzm .fzh-card>.fzm-thumb{position:absolute;inset:0;z-index:-2;width:100%;height:100%;aspect-ratio:auto}
.fzm .fzh-card>.fzm-thumb::after{display:none}
.fzm .fzh-card>.fzm-thumb img{transform:scale(1.07)}
.fzm .fzh-card::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgba(9,11,7,.05) 0%,rgba(9,11,7,.45) 42%,rgba(9,11,7,.94) 100%),linear-gradient(90deg,rgba(9,11,7,.55),transparent 75%)}
.fzm .fzh-card::after{content:"";position:absolute;left:0;top:0;z-index:2;width:34px;height:3px;background:var(--amber);pointer-events:none}
.fzm .fzh-card:hover{border-color:var(--hair2,var(--line-2))}
.fzm .fzh-card--quick{border-color:rgba(240,174,46,.6);box-shadow:inset 4px 0 0 var(--amber)}
.fzm .fzh-card--quick::after{width:64px}
.fzm .fzh-card{display:flex;flex-direction:column}
.fzm .fzh-front>.fzh-coach{order:-1}
.fzm :is(.fzh-main,.fzh-body){position:relative;flex:1 1 auto;width:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;gap:5px;padding:clamp(16px,1.6vw,28px);text-align:left;color:var(--white)}
.fzm .fzh-main:focus-visible{outline:2px solid var(--white);outline-offset:-6px}
.fzm .fzh-card.is-split{cursor:pointer}
.fzm .fzh-body{pointer-events:none}
.fzm .fzh-body :is(button,.fzo-pill){pointer-events:auto}
.fzm .fzh-krow{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px}
.fzm .fzh-krow .fzo-pill{min-height:26px;padding:1px 10px;font-size:14px;color:var(--sand);background:rgba(8,10,7,.74);border:1px solid var(--hair,var(--line));cursor:default}
.fzm .fzh-acts{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:10px}
.fzm .fzh-acts .fzh-go{margin-top:0}
.fzm .fzh-go.is-primary:focus-visible{outline:2px solid var(--white);outline-offset:3px}
.fzm .fzh-go.is-primary:hover{background:linear-gradient(180deg,#ffd77a,#f0ae2e)}
.fzm .fzh-k{font-size:15px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--amber);text-shadow:0 1px 4px rgba(0,0,0,.8)}
.fzm .fzh-t{font-size:clamp(28px,2.5vw,46px);font-weight:800;letter-spacing:.03em;line-height:.98;text-transform:uppercase;text-shadow:0 2px 14px rgba(0,0,0,.65)}
.fzm .fzh-card--quick .fzh-t{font-size:clamp(34px,3.2vw,58px)}
.fzm .fzh-d{max-width:36ch;font-size:clamp(16px,1.1vw,19px);line-height:1.25;color:#ddd4ba;text-shadow:0 1px 6px rgba(0,0,0,.85)}
.fzm .fzh-meta{margin-top:2px;padding:1px 9px;font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--sand);background:rgba(8,10,7,.72);border:1px solid var(--hair,var(--line))}
.fzm .fzh-go{position:relative;display:inline-flex;align-items:center;gap:12px;margin-top:10px;font-size:18px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--amber)}
.fzm .fzh-go::after,.fzm .fzh-chev{content:"";flex:none;display:inline-block;width:9px;height:9px;border-right:3px solid currentColor;border-top:3px solid currentColor;transform:rotate(45deg)}
.fzm .fzh-chev--l{transform:rotate(-135deg)}
.fzm :is(.is-primary .fzh-go,.fzh-go.is-primary){min-height:56px;padding:0 30px 0 26px;overflow:hidden;font-size:22px;color:#17140a;background:linear-gradient(180deg,#ffc650,#e5a024);clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}
.fzm .fzh-more::after{background:rgba(14,16,12,.88)}
/* ÉQUIPEMENT inside the loadout line: its own full-width row (the line keeps its text readable in narrow panels) */
.fzm .fzm-load:has(.fzh-gearbtn){grid-template-columns:54px minmax(0,1fr)}
.fzm .fzm-load .fzh-gearbtn{grid-column:1/-1;width:100%;min-height:44px}
.fzm .fzh-main:hover .fzh-go{color:var(--amber-2)}
.fzm .fzh-main.is-primary:hover .fzh-go{color:#17140a;background:linear-gradient(180deg,#ffd77a,#f0ae2e)}
.fzm .fzh-top{position:absolute;left:clamp(16px,1.6vw,28px);right:clamp(12px,1.2vw,20px);top:clamp(12px,1.2vw,18px);z-index:1;display:flex;align-items:flex-start;justify-content:flex-end;flex-wrap:wrap;gap:8px;pointer-events:none}
.fzm .fzh-top>*{pointer-events:auto}
.fzm .fzh-top .fzo-pill{min-height:30px;padding:2px 10px;font-size:14px;color:var(--sand);background:rgba(8,10,7,.76);border:1px solid var(--hair,var(--line))}
.fzm .fzh-more{min-height:34px;padding:3px 12px;font-size:14px}
.fzm .fzh-more::after{background:rgba(14,16,12,.86)}
.fzm .fzh-row2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:clamp(12px,1.3vw,20px);align-items:stretch}
.fzm .fzh-gearbox{position:relative;display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:14px;align-items:center;min-width:0;padding:14px 16px;border:1px solid var(--hair,var(--line));background:linear-gradient(180deg,rgba(28,32,26,.94),rgba(13,15,12,.92));clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}
.fzm .fzh-gearbox::before{content:"";position:absolute;left:0;top:0;width:22px;height:2px;background:var(--amber)}
.fzm .fzh-gearbox :is(canvas,img){display:block;width:64px;height:64px;border:1px solid var(--line-2)}
.fzm img.fzh-fitpic{object-fit:cover;object-position:46% 35%;background:#0d0f0b}
.fzm .fzh-slot img.fzh-fitpic{width:104px;height:52px;border:1px solid var(--line-2)}
.fzm .fzh-gtext{display:grid;gap:2px;min-width:0}
.fzm .fzh-gtext small{font-size:14px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--amber)}
.fzm .fzh-gtext b{overflow:hidden;font-size:22px;font-weight:800;letter-spacing:.03em;line-height:1.05;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase;color:var(--white)}
.fzm .fzh-gtext span{overflow:hidden;font-size:16px;text-overflow:ellipsis;white-space:nowrap;color:var(--dim)}
.fzm .fzh-gearbtn{gap:12px;white-space:nowrap}
.fzm .fzh-front{position:relative;min-width:0}
.fzm .fzh-front:not(:has(.fzw-band)) .fzh-coach{display:none}
/* the Front band on the hub: compact, a still map (front-ui.js), no light sweep */
.fzm .fzh-front .fzw-band{min-height:0;height:100%;grid-template-columns:minmax(150px,210px) minmax(0,1fr) auto}
.fzm .fzh-front .fzw-band::after{display:none}
.fzm .fzh-front .fzw-bmid{gap:6px;padding:10px 16px}
.fzm .fzh-front .fzw-offline,.fzm .fzh-front .fzw-chips,.fzm .fzh-front .fzw-note{display:none}
@media (max-width:1560px){.fzm .fzh-front .fzw-band{grid-template-columns:minmax(140px,190px) minmax(0,1fr)}}
/* ---------- sub-screens: RETOUR + where you are ---------- */
.fzm .fzh-head{display:flex;align-items:center;flex-wrap:wrap;gap:12px 22px;margin-bottom:clamp(14px,1.6vw,24px)}
.fzm .fzh-back{flex:none;min-height:48px;padding:6px 18px 6px 16px;gap:12px}
.fzm .fzh-where{display:grid;gap:2px;min-width:0;flex:1 1 320px}
.fzm .fzh-crumb{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;font-size:15px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}
.fzm .fzh-crumb i{font-style:normal;color:var(--amber)}
.fzm .fzh-where .fzm-title{font-size:clamp(30px,2.6vw,44px)}
.fzm .fzh-sub{font-size:18px;line-height:1.25;color:var(--dim)}
.fzm .fzh-tabhead{display:flex;align-items:center;flex-wrap:wrap;gap:10px 18px;margin-bottom:14px}
.fzm .fzh-tabhead .fzh-crumb{font-size:14px}
.fzm .fzm-settings{position:relative}
.fzm .fzm-settings>.fzh-back{position:absolute;top:12px;right:clamp(16px,2.4vw,32px);z-index:3}
@media (min-width:1181px) and (max-height:840px){.fzm .fzh-head{margin-bottom:10px}.fzm .fzh-sub{display:none}.fzm .fzh-where .fzm-title{font-size:30px}}
/* solo: the rc7 columns under the head (the side panel's cap counts the taller head) */
@media (min-width:1181px){html.fz2ui .fzh-solo .fzm-side>.fzm-panel{max-height:calc(100vh - 80px - clamp(16px,2.2vw,34px) - 104px - 104px)}}
@media (min-width:1181px) and (max-height:840px){html.fz2ui .fzh-solo .fzm-side>.fzm-panel{max-height:calc(100vh - 80px - clamp(16px,2.2vw,34px) - 62px - 84px)}}
/* friends: 1 create | 2 join + you */
.fzm .fzh-fgrid{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(300px,1fr);gap:clamp(14px,1.6vw,24px);align-items:start}
.fzm .fzh-fside{display:grid;gap:clamp(14px,1.6vw,24px);min-width:0}
.fzm .fzh-step{display:flex;align-items:center;gap:12px;font-size:25px;font-weight:800;letter-spacing:.08em;line-height:1.05;text-transform:uppercase;color:var(--white)}
.fzm .fzh-step i{flex:none;display:grid;place-items:center;width:34px;height:34px;font-size:21px;font-style:normal;color:#17140a;background:linear-gradient(180deg,#ffc650,#e5a024);clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)}
.fzm .fzh-hint{margin-top:-8px;font-size:17px;line-height:1.25;color:var(--dim)}
.fzm .fzh-pick{display:grid;gap:0;min-width:0}
.fzm :is(.fzh-create,.fzh-qmodes) .fzm-modes{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.fzm .fzh-qmodes .fzm-modes{grid-template-columns:minmax(0,1fr)}
html.fz2ui :is(.fzh-create,.fzh-qmodes) .fzm-opt{min-height:0;padding:10px 12px 10px 16px}
.fzm :is(.fzh-create,.fzh-qmodes) .fzm-opt-desc,.fzm .fzh-create .fzm-opt .fzm-tag{display:none}
html.fz2ui :is(.fzh-create,.fzh-qmodes) .fzm-opt-name{font-size:20px}
.fzm .fzh-create .fzm-maps{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.fzm .fzh-create .fzm-map-desc{display:none}
.fzm .fzh-create .fzm-map-body{padding:6px 9px 8px}
.fzm .fzh-create .fzm-map-name{font-size:17px}
.fzm .fzh-create .fzm-map .fzm-tag{font-size:11px;padding:0 5px}
/* the sticky CRÉER bar: a fade above it, and the map grid ends clear of it (the last row is fully readable once scrolled) */
.fzm .fzh-create .fzm-cta-wrap{margin:-6px -18px -18px;padding:28px 18px 16px;background:linear-gradient(to bottom,rgba(15,17,13,0),rgba(15,17,13,.96) 26px)}
.fzm .fzh-create .fzm-cta-wrap .fzm-hint{display:none}
.fzm .fzh-create .fzm-maps{padding-bottom:4px}
/* quick: modes | public rooms | you */
.fzm .fzh-qgrid{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(0,2.1fr) minmax(260px,.9fr);gap:clamp(14px,1.6vw,24px);align-items:start}
.fzm .fzh-qmain{display:grid;gap:12px;min-width:0}
.fzm .fzh-qmain .fzo-list{max-height:none}
.fzm .fzh-search{display:flex;align-items:center;flex-wrap:wrap;gap:12px 16px;margin-bottom:clamp(14px,1.6vw,22px);padding:14px 18px;color:var(--white);border:1px solid var(--amber);background:linear-gradient(90deg,rgba(240,174,46,.18),rgba(240,174,46,.03));clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}
.fzm .fzh-search .fzm-spin{width:22px;height:22px;border-width:3px}
.fzm .fzh-search div{display:grid;flex:1 1 220px;min-width:0}
.fzm .fzh-search b{font-size:22px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.fzm .fzh-search small{font-size:16px;color:var(--sand)}
.fzm .fzh-steps{display:flex;flex-wrap:wrap;gap:4px 18px;margin:6px 0 0;padding:0;list-style:none;font-size:14px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.fzm .fzh-steps li{display:flex;align-items:center;gap:8px}
.fzm .fzh-steps li::before{content:"";flex:none;width:9px;height:9px;border:2px solid currentColor;transform:rotate(45deg)}
.fzm .fzh-steps li.is-on{color:var(--amber)}
.fzm .fzh-steps li.is-done{color:var(--green)}
.fzm .fzh-steps li.is-done::before{background:currentColor}
.fzm .fzh-prog{position:relative;display:block;height:4px;margin-top:8px;overflow:hidden;background:rgba(255,255,255,.1)}
.fzm .fzh-prog i{position:absolute;inset:0;background:linear-gradient(90deg,#e39d22,#ffd27a);transform-origin:0 50%}
.fzm .fzh-prog.is-wake i{transform:scaleX(.03);animation:fzhWake 60s cubic-bezier(.15,.6,.35,1) both}
.fzm .fzh-prog.is-find i{right:auto;width:34%;animation:fzhFind 1.1s ease-in-out infinite}
@keyframes fzhWake{to{transform:scaleX(.94)}}
@keyframes fzhFind{from{transform:translateX(-110%)}to{transform:translateX(310%)}}
@media (prefers-reduced-motion:reduce){.fzm .fzh-prog i{animation:none!important}.fzm .fzh-prog.is-find i{width:100%;opacity:.6}}
html.fzx-rm .fzm .fzh-prog i{animation:none!important}
/* loadout */
.fzm .fzh-lgrid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:clamp(14px,1.6vw,24px);align-items:start}
.fzm .fzh-cls-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.fzm .fzh-cls{position:relative;display:grid;gap:6px;align-content:start;min-width:0;padding:12px 14px 14px 16px;text-align:left;border:1px solid var(--hair,var(--line));background:rgba(8,10,7,.5);clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);transition:border-color .12s,background .12s}
.fzm .fzh-cls:hover{border-color:var(--hair2,var(--line-2))}
.fzm .fzh-cls[aria-checked=true]{border-color:var(--amber);background:linear-gradient(180deg,rgba(64,50,18,.9),rgba(28,23,11,.9));box-shadow:inset 0 0 0 1px var(--amber)}
.fzm .fzh-cls-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.fzm .fzh-cls-top b{font-size:23px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--white)}
.fzm .fzh-cls-d{font-size:15px;line-height:1.25;color:var(--dim)}
.fzm .fzh-cls .fzm-stats{display:grid;gap:5px}
.fzm .fzh-cls .fzm-stat{grid-template-columns:72px minmax(0,1fr) 44px;font-size:14px}
.fzm .fzh-cls[aria-checked=true] .fzm-stat i u{background:var(--amber)}
.fzm .fzh-slot{display:grid;grid-template-columns:104px minmax(0,1fr) auto;gap:14px;align-items:center;min-width:0;padding:10px 0;border-top:1px solid var(--line)}
.fzm .fzh-slot:first-of-type{border-top:0}
.fzm .fzh-slot .fzm-gun{height:52px;color:var(--amber)}
.fzm .fzh-slot .fzm-gun svg{height:42px}
.fzm .fzh-slot canvas{display:block;width:104px;height:52px;border:1px solid var(--line-2)}
.fzm .fzh-slot>div{display:grid;gap:1px;min-width:0}
.fzm .fzh-slot small{font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
.fzm .fzh-slot b{overflow:hidden;font-size:21px;font-weight:700;line-height:1.1;text-overflow:ellipsis;white-space:nowrap;color:var(--white)}
.fzm .fzh-slot span{font-size:15px;color:var(--dim)}
.fzm .fzh-gx{display:flex;align-items:center;justify-content:center;gap:2px;height:52px;border:1px solid var(--line);background:rgba(0,0,0,.25)}
.fzm .fzh-gx img{width:32px;height:44px;object-fit:contain}
.fzm .fzh-ldone{display:flex;justify-content:flex-end;margin-top:clamp(14px,1.6vw,22px)}
.fzm .fzh-ldone .fzm-btn{min-width:min(100%,300px);min-height:60px;font-size:24px}
/* lobby: the invite link is THE action of a room among friends */
.fzm .fzh-lobbyside{display:flex;align-items:center;gap:10px}
.fzm.fzh-on [data-fid="lobby:invite"]{color:var(--ink)}
.fzm.fzh-on [data-fid="lobby:invite"]::before,.fzm.fzh-on [data-fid="lobby:invite"]::after{background:linear-gradient(180deg,#ffc650,#e5a024)}
.fzm.fzh-on [data-fid="lobby:invite"]:hover::before,.fzm.fzh-on [data-fid="lobby:invite"]:hover::after{background:linear-gradient(180deg,#ffd77a,#f0ae2e)}
.fzm.fzh-on [data-fid="lobby:invite"].is-done{color:#17140a}
/* ---------- first-visit hints: never blocking (only their close button takes the pointer) ---------- */
.fzm .fzh-coach{position:absolute;z-index:4;display:grid;gap:1px;max-width:min(320px,86%);padding:9px 46px 10px 14px;color:#17140a;background:linear-gradient(180deg,#ffd46e,#f0ae2e);clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);box-shadow:0 6px 24px rgba(0,0,0,.45);pointer-events:none}
.fzm .fzh-coach b{font-size:17px;font-weight:800;letter-spacing:.16em;line-height:1.1;text-transform:uppercase}
.fzm .fzh-coach span{font-size:15px;font-weight:600;line-height:1.2}
.fzm .fzh-coach-x{position:absolute;right:4px;top:50%;width:38px;height:38px;margin-top:-19px;font-size:15px;font-weight:800;line-height:1;color:#17140a;pointer-events:auto;cursor:pointer}
.fzm .fzh-coach-x::before,.fzm .fzh-coach-x::after{content:"";position:absolute;left:50%;top:50%;width:18px;height:3px;margin:-1.5px 0 0 -9px;background:rgba(23,20,10,.7);transform:rotate(45deg)}
.fzm .fzh-coach-x::after{transform:rotate(-45deg)}
@media (pointer:coarse){.fzm .fzh-coach-x{width:44px;height:44px;margin-top:-22px;right:1px}}
.fzm .fzh-coach-x:hover::before,.fzm .fzh-coach-x:hover::after{background:#17140a}
.fzm .fzh-coach-x:focus-visible{outline:2px solid #17140a;outline-offset:-4px}
.fzm .fzh-coach--start{left:clamp(16px,1.6vw,28px);top:clamp(12px,1.2vw,18px)}
.fzm .fzh-card:has(.fzh-coach) .fzh-body{padding-top:calc(clamp(12px,1.2vw,18px) + 80px)}
/* the equipment and Front hints sit inside their block, as its first row (their blocks are cut with clip-path) */
.fzm .fzh-coach--inline{position:relative;grid-column:1/-1;max-width:none;box-shadow:none}
.fzm .fzh-front:has(.fzh-coach){display:grid;gap:10px;align-content:start}
/* ---------- narrow screens ---------- */
@media (max-width:899px){
 .fzm .fzh-cards{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
 .fzm .fzh-card--quick{grid-column:1/-1}
}
@media (max-height:620px){.fzm .fzh-card{min-height:200px}.fzm .fzh-hub{gap:12px}}
@media (max-width:1180px){
 .fzm .fzh-row2{grid-template-columns:minmax(0,1fr)}
 .fzm .fzh-fgrid,.fzm .fzh-qgrid,.fzm .fzh-lgrid{grid-template-columns:minmax(0,1fr)}
 .fzm .fzh-qmodes .fzm-modes{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media (max-width:760px){
 .fzm .fzh-cards{grid-template-columns:minmax(0,1fr)}
 .fzm .fzh-card{min-height:178px}
 .fzm .fzh-card--quick{min-height:236px}
 .fzm .fzh-card--quick .fzh-t{font-size:36px}
 .fzm .fzh-t{font-size:28px}
 .fzm .fzh-d{font-size:16px}
 .fzm :is(.is-primary .fzh-go,.fzh-go.is-primary){min-height:50px;padding:0 22px;font-size:19px}
 .fzm .fzh-card--quick .fzh-acts{width:100%}
 .fzm .fzh-card--quick .fzh-go.is-primary{flex:1 1 auto;justify-content:center}
 .fzm .fzh-gearbox{grid-template-columns:52px minmax(0,1fr);row-gap:10px}
 .fzm .fzh-gearbox canvas{width:52px;height:52px}
 .fzm .fzh-gearbtn{grid-column:1/-1}
 .fzm .fzh-front .fzw-band{grid-template-columns:minmax(0,1fr)}
 .fzm .fzh-front .fzw-bmap{min-height:120px}
 .fzm :is(.fzh-create,.fzh-qmodes) .fzm-modes{grid-template-columns:repeat(2,minmax(0,1fr))}
 .fzm .fzh-create .fzm-maps{grid-template-columns:repeat(2,minmax(0,1fr))}
 .fzm .fzh-cls-list{grid-template-columns:minmax(0,1fr)}
 .fzm .fzh-slot{grid-template-columns:72px minmax(0,1fr)}
 .fzm .fzh-slot .fzm-btn{grid-column:1/-1}
 .fzm .fzh-slot canvas{width:72px}
 .fzm .fzh-head{gap:10px}
 .fzm .fzh-sub{font-size:16px}
 .fzm .fzh-ldone .fzm-btn{width:100%}
 .fzm .fzh-coach{max-width:min(300px,92%)}
 /* the three entries first, PASSE and BOUTIQUE after them */
 .fzm .fzh-hub>.fzm-play-head{display:contents}
 .fzm .fzh-hub .fzh-hello{order:-1}
 .fzm .fzh-hello h2{font-size:28px}
 .fzm .fzh-hub .fzh-cards{order:1}
 .fzm .fzh-hub .fzh-row2{order:2}
 .fzm .fzh-hub .fz2-entries{order:3}
 .fzm .fzh-qmodes .fzm-tag{display:none}
}`;

export function create(api, deps = {}) {
  const K = api.kit, h = K.h, st = K.st, profile = K.profile, i18n = deps.i18n;
  if (!document.getElementById('fzh-style')) { const s = document.createElement('style'); s.id = 'fzh-style'; s.textContent = CSS; document.head.append(s); }
  K.root.classList.add('fzh-on');
  const li = () => Math.max(0, LANGS.indexOf((i18n && i18n.lang) || 'fr'));
  const L = (k, p) => { let s = (TX[k] && (TX[k][li()] || TX[k][0])) || k; if (p) s = s.replace(/\{(\w+)\}/g, (m, x) => (x in p ? String(p[x]) : m)); return s; };
  const ext = (name, ...a) => K.extPart(name, ...a);
  const GX = globalThis.FZGearData || null;
  const lang = () => (i18n && i18n.lang) || 'fr';

  /* ---------- where we are ---------- */
  st.loFrom = st.loFrom || 'hub';
  function setFlow(f, dir) {
    const from = st.flow;
    if (from === 'hub' && f !== 'hub' && coachOn && coachOn !== 'none') markSeen(coachOn);
    if (f !== 'hub') coachOn = null;
    if (f === 'loadout' && from !== 'loadout') st.loFrom = st.screen === 'play' ? from : 'hub';
    if (from !== f || dir) K.main.setAttribute('data-fz-dir', dir || (f === 'hub' ? 'back' : 'fwd'));       // menu-anim.js: wipe direction
    st.flow = f; st.screen = 'play';
    if (f === 'solo') st.playMode = 'solo'; else if (f === 'friends' || f === 'quick') st.playMode = 'multi';
    K.savePrefs(); K.renderNow();
  }
  function back() {
    K.sfx('ui');
    if (st.screen !== 'play') { const to = st.back === 'loadout' ? 'loadout' : st.flow; st.back = null; setFlow(to, 'back'); return; }
    if (st.flow === 'loadout') { setFlow(st.loFrom && st.loFrom !== 'loadout' ? st.loFrom : 'hub', 'back'); return; }
    if (ext('quickCancel') || (st.pending && !st.room)) K.cancelPending();       // leaving while a match is being found: stop looking
    setFlow('hub', 'back');
  }
  const overlayOpen = () => [...document.querySelectorAll('#fz-front, #fz-front-pick, [data-fid="shop:screen"], .fzp, .fzm-layer, #fz-flow')].some(e => !e.hidden && e.getClientRects().length > 0);
  function escape(e) {
    const t = e && e.target;
    if (t && t !== document.body && t !== document.documentElement && t !== document && !K.root.contains(t)) return false;       // an overlay handles its own
    if (overlayOpen()) return false;
    const a = document.activeElement;
    if (a && K.root.contains(a) && a.tagName === 'INPUT' && (a.type === 'text' || a.type === '')) { a.blur(); K.main.focus({ preventScroll: true }); return true; }       // first Escape leaves the field
    if (st.screen === 'play') { if ((st.room && st.flow !== 'loadout') || st.flow === 'hub') return false; back(); return true; }
    if (st.screen === 'arsenal' || st.screen === 'outfits' || st.screen === 'classes' || st.screen === 'settings') { back(); return true; }
    return false;
  }
  function tabClick(id) {
    if (id !== 'play') { st.back = null; return false; }
    if (st.screen === 'play' && st.flow === 'hub') return true;
    K.sfx('ui'); st.back = null; setFlow('hub', 'back'); return true;
  }
  const MULTI = new Set(['multi', 'multiplayer', 'multijoueur', 'lobby', 'salon']), FRIENDS = new Set(['friends', 'amis']);
  function shown(asked) {
    if (asked === 'solo') st.flow = 'solo';
    else if (asked === 'quick' || asked === 'rapide') st.flow = 'quick';
    else if (FRIENDS.has(asked)) st.flow = 'friends';
    else if (MULTI.has(asked)) st.flow = st.flow === 'quick' ? 'quick' : 'friends';
    else if (asked === 'hub' || asked === 'home' || asked === 'accueil') st.flow = 'hub';
    else if (asked === 'loadout' || asked === 'equipement' || asked === 'équipement') { if (st.flow !== 'loadout') st.loFrom = st.flow; st.flow = 'loadout'; }
    if (st.flow === 'solo') st.playMode = 'solo'; else if (st.flow === 'friends' || st.flow === 'quick') st.playMode = 'multi';
  }

  /* ---------- first-visit hints ---------- */
  const COACH = 'frontzero.coach';
  let seen = {}; try { const v = JSON.parse(localStorage.getItem(COACH) || '{}'); if (v && typeof v === 'object') seen = v; } catch { seen = {}; }
  let coachOn = null, coachDrawn = '';
  function markSeen(id) { if (!id || id === 'none' || seen[id]) return; seen[id] = 1; try { localStorage.setItem(COACH, JSON.stringify(seen)); } catch { /* private mode: this session only */ } }
  function coachEl(id, title, text) {
    const fresh = coachDrawn !== id; coachDrawn = id;
    const x = h('button', { type: 'button', class: 'fzh-coach-x', 'data-fid': 'coach:close', 'aria-label': L('coachClose'), title: L('coachClose'), onclick: e => { e.stopPropagation(); K.sfx('ui'); markSeen(id); coachOn = 'none'; const c = e.currentTarget.closest('.fzh-coach'); if (c) c.remove(); } });
    return h('div', { class: `fzh-coach fzh-coach--${id}${id === 'start' ? '' : ' fzh-coach--inline'}${fresh ? ' is-new' : ''}`, role: 'note', 'data-fid': 'coach:' + id }, h('b', { text: title }), h('span', { text: text }), x);
  }
  function coach(quick, gear, front) {
    if (coachOn === null) coachOn = !seen.start ? 'start' : !seen.gear ? 'gear' : !seen.front && !frontSide() ? 'front' : 'none';       // one hint per hub visit
    if (coachOn === 'start') quick.append(coachEl('start', L('coachStartT'), L('coachStartD')));
    else if (coachOn === 'gear') gear.prepend(coachEl('gear', L('coachGearT'), L('coachGearD')));
    else if (coachOn === 'front') front.prepend(coachEl('front', L('coachFrontT'), L('coachFrontD')));
  }
  const frontSide = () => { try { const F = globalThis.FZFront; return !!(F && typeof F.side === 'function' && F.side()); } catch { return false; } };       // front-ui.js

  /* ---------- hub ---------- */
  function card(o) {
    const pic = K.thumb((K.mapOf(o.pic) || {}).env, o.pic);
    if (o.acts) {       // PARTIE RAPIDE: two real buttons (play now, mode and rooms); a click anywhere else on the card also plays
      const body = h('div', { class: 'fzh-body' },
        h('span', { class: 'fzh-krow' }, h('span', { class: 'fzh-k', text: o.kicker }), o.pill || null),
        h('b', { class: 'fzh-t', text: o.title }),
        h('span', { class: 'fzh-d', text: o.desc }),
        o.meta ? h('span', { class: 'fzh-meta', text: o.meta }) : null,
        h('span', { class: 'fzh-acts' }, h('button', { type: 'button', class: 'fzh-go is-primary', 'data-fid': o.fid, onclick: o.onclick }, h('span', { text: o.go })), o.acts));
      const art = h('article', { class: `fzh-card fzh-card--${o.kind} is-split`, 'data-shot': o.pic }, pic, body);
      art.addEventListener('click', e => { if (!e.target.closest('button, a, input, select')) o.onclick(); });
      return art;
    }
    const main = h('button', { type: 'button', class: 'fzh-main' + (o.primary ? ' is-primary' : ''), 'data-fid': o.fid, onclick: o.onclick },
      h('span', { class: 'fzh-k', text: o.kicker }),
      h('b', { class: 'fzh-t', text: o.title }),
      h('span', { class: 'fzh-d', text: o.desc }),
      o.meta ? h('span', { class: 'fzh-meta', text: o.meta }) : null,
      h('span', { class: 'fzh-go' }, h('span', { text: o.go })));
    return h('article', { class: `fzh-card fzh-card--${o.kind}`, 'data-shot': o.pic }, pic, main, o.top && o.top.some(Boolean) ? h('div', { class: 'fzh-top' }, o.top) : null);
  }
  function startQuick() {
    K.sfx('ui');
    setFlow('quick');
    ext('quickNow');       // waits for the server if it sleeps, then joins or creates a public room (online-ui.js)
  }
  function openLoadout() { K.sfx('ui'); setFlow('loadout'); }
  /** The outfit worn: a 3D outfit (ÉCLIPSE, sets, map colourways: name and outfit-shots picture) or the base camo. */
  function wornFit() {
    let s = null; try { s = profile.specialOutfit ? profile.specialOutfit() : null; } catch { s = null; }
    if (s && s.id) { const o = (globalThis.FZOutfitSets || []).find(x => x.id === s.id) || s; return { name: o.name ? (o.colorway ? `${o.name} ${o.colorway}` : o.name) : s.id, shot: new URL('outfit-shots/' + encodeURIComponent(s.id) + '.webp', import.meta.url).href }; }
    const o = byId(OUTFITS, profile.data.outfit); return { name: K.outfitName(o), o };
  }
  const fitPic = (f, w, hh, cls) => { if (!f.shot) return K.camo(f.o, w, hh, cls); const im = h('img', { class: cls + ' fzh-fitpic', alt: '', src: f.shot, width: String(w), height: String(hh) }); im.addEventListener('error', () => im.replaceWith(K.camo(byId(OUTFITS, profile.data.outfit), w, hh, cls))); return im; };
  function gearBox() {
    const P = profile.data, cls = byId(CLASSES, P.cls), w = byId(WEAPONS, P.primary), fit = wornFit();
    return h('section', { class: 'fzh-gearbox', 'aria-label': L('gearT') },
      fitPic(fit, 128, 128, 'fzh-camo'),
      h('div', { class: 'fzh-gtext' }, h('small', { text: L('clsT') }), h('b', { text: K.className(cls) }), h('span', { text: [w && w.name, fit.name].filter(Boolean).join(' · ') })),
      K.button('fzh-gearbtn', 'hub:loadout', [h('span', { text: L('gearBtn') }), h('i', { class: 'fzh-chev', 'aria-hidden': 'true' })], openLoadout));
  }
  const PIC = { quick: 'port', friends: 'col-blanc', solo: 'bunker' };       // three pictures that read apart at a glance: orange dusk, snow, red corridor
  const pic = (k, alt) => (K.mapOf(PIC[k]) ? PIC[k] : alt);
  function hub() {
    const mode = byId(K.MODES, st.mode);
    const bots = st.mode === 'zombie' ? Math.min(3, Math.max(0, st.bots)) : Math.min(11, Math.max(1, st.bots));
    const quick = card({ kind: 'quick', fid: 'hub:quick', pic: pic('quick', 'port'), kicker: L('quickK'), title: L('quickT'), desc: L('quickD'), go: L('quickGo'), onclick: startQuick,
      meta: mode && mode.online !== false ? L('modeIs', { m: K.modeName(mode) }) : null, pill: ext('statusPill'),
      acts: K.net ? K.button('fzm-btn--sm fzh-more', 'hub:public', L('quickMore'), () => { K.sfx('ui'); setFlow('quick'); }) : h('span') });
    const friends = card({ kind: 'friends', fid: 'playmode:multi', pic: pic('friends', 'vieille-ville'), kicker: L('friendsK'), title: L('friendsT'), desc: L('friendsD'), go: L('friendsGo'), onclick: () => { K.sfx('ui'); setFlow('friends'); } });
    const solo = card({ kind: 'solo', fid: 'playmode:solo', pic: pic('solo', 'depot'), kicker: L('soloK'), title: L('soloT'), desc: L('soloD'), go: L('soloGo'), onclick: () => { K.sfx('ui'); setFlow('solo'); },
      meta: L('soloMeta', { mode: K.modeName(mode), map: K.mapName(st.map), n: bots }) });
    if (!K.net) quick.classList.add('is-off');
    const gear = gearBox(), front = h('div', { class: 'fzh-front' });
    // DOM order = focus order (keyboard Tab, pad): PARTIE RAPIDE first; the title row is drawn above by CSS (order:-1)
    const view = h('div', { class: 'fzm-wrap fzh-view fzh-hub' },
      h('div', { class: 'fzh-cards', role: 'group', 'aria-label': L('hubTitle') }, quick, friends, solo),
      h('div', { class: 'fzh-row2' }, gear, front),
      h('div', { class: 'fzm-play-head' }, h('div', { class: 'fzh-hello' }, h('small', K.tx('nav.play')), h('h2', { text: L('hubTitle') })), h('div', { class: 'fzh-acct' })),       // ui-theme.js adds PASSE and BOUTIQUE on the right; .fzh-acct: account entry (account-ui.js)
      h('footer', { class: 'fzh-legal' }));       // filled by account-ui.js: Confidentialité · Mentions légales
    coach(quick, gear, front);
    return view;
  }

  /* ---------- sub-screens ---------- */
  const TITLES = { solo: ['soloT', 'soloSub'], friends: ['friendsTitle', 'friendsSub'], quick: ['quickT', 'quickSub'], loadout: ['gearT', 'loadoutSub'] };
  function crumb(parts) {
    return h('nav', { class: 'fzh-crumb', 'aria-label': L('crumbLabel') }, parts.map((p, i) => [i ? h('i', { 'aria-hidden': 'true', text: '›' }) : null, h('span', { text: p })]), h('i', { 'aria-hidden': 'true', text: '›' }));
  }
  const backBtn = label => K.button('fzm-btn--sm fzh-back', 'flow:back', [h('i', { class: 'fzh-chev fzh-chev--l', 'aria-hidden': 'true' }), h('span', { text: label || L('back') })], back);
  function head(kind) {
    const [t, s] = TITLES[kind], trail = [K.T('nav.play')];
    if (kind === 'loadout' && st.loFrom && TITLES[st.loFrom]) trail.push(L(TITLES[st.loFrom][0]));
    return h('div', { class: 'fzh-head' }, backBtn(), h('div', { class: 'fzh-where' }, crumb(trail), h('h2', { class: 'fzm-title', text: L(t) }), h('p', { class: 'fzh-sub', text: L(s) })));
  }
  function screen(kind, P) {
    if (kind === 'solo') {
      return h('div', { class: 'fzm-wrap fzm-play fzh-view fzh-solo' }, head('solo'),
        h('div', { class: 'fzm-play-grid' },
          h('section', { class: 'fzm-col' }, K.heading(K.T('mode.title')), P.modePicker),
          h('section', { class: 'fzm-col' }, K.heading(K.T('lobby.map')), P.mapPicker),
          h('aside', { class: 'fzm-side' }, K.soloPanel(P.summary), K.soloCta())));
    }
    if (kind === 'friends') return friendsScreen(P);
    if (kind === 'quick') return quickScreen(P);
    return null;
  }
  function friendsScreen(P) {
    const wrap = h('div', { class: 'fzm-wrap fzm-play fzm-play--multi fzh-view fzh-friends' }, head('friends'));
    if (!K.net) { wrap.append(h('div', { class: 'fzm-alert', role: 'alert', text: K.L('m.errNoNet') })); return wrap; }
    const create = h('section', { class: 'fzm-panel fzh-create' },
      h('h3', { class: 'fzh-step' }, h('i', { text: '1' }), h('span', { text: L('createT') })),
      h('p', { class: 'fzh-hint', text: L('createD') }),
      h('div', { class: 'fzh-pick' }, K.heading(K.T('mode.title')), P.modePicker),
      h('div', { class: 'fzh-pick' }, K.heading(K.T('lobby.map')), P.mapPicker),
      K.multiCta());
    const join = h('section', { class: 'fzm-panel fzh-join' },
      h('h3', { class: 'fzh-step' }, h('i', { text: '2' }), h('span', { text: L('joinT') })),
      h('p', { class: 'fzh-hint', text: L('joinD') }),
      ext('inviteStatus'), K.alertBox(), K.busyLine(), K.joinField());
    const you = h('section', { class: 'fzm-panel fzh-you' }, K.heading(L('youT')), K.nameField(), K.loadoutLine());
    wrap.append(h('div', { class: 'fzh-fgrid' }, create, h('div', { class: 'fzh-fside' }, join, you)));
    return wrap;
  }
  function cancelQuick() { K.sfx('ui'); ext('quickCancel'); K.cancelPending(); }
  function quickScreen(P) {
    const wrap = h('div', { class: 'fzm-wrap fzm-play fzm-play--multi fzh-view fzh-quick' }, head('quick'));
    if (!K.net) { wrap.append(h('div', { class: 'fzm-alert', role: 'alert', text: K.L('m.errNoNet') })); return wrap; }
    const srv = ext('serverState') || {}, wanting = !!ext('quickWaiting'), joining = st.pending === 'join' && !!st.lastIntent && typeof st.lastIntent.retry === 'function';
    if (wanting || joining) {
      // three steps: wake the server (free host, up to a minute), find a room, join it; ANNULER stops each of them
      const waking = wanting && srv.state !== 'ok', step = waking ? 0 : 1;
      const since = waking && srv.quickAt ? Math.max(0, (performance.now() - srv.quickAt) / 1000) : 0;
      const steps = h('ol', { class: 'fzh-steps', 'aria-hidden': 'true' }, [L('stepWake'), L('stepFind'), L('stepJoin')].map((t, i) => h('li', { class: i < step ? 'is-done' : i === step ? 'is-on' : null, text: t })));
      const bar = h('span', { class: 'fzh-prog' + (waking ? ' is-wake' : ' is-find'), 'aria-hidden': 'true' }, h('i', { style: waking ? `animation-delay:-${since.toFixed(1)}s` : null }));
      wrap.append(h('div', { class: 'fzh-search', role: 'status', 'aria-live': 'polite', 'data-fid': 'quick:searching' }, h('i', { class: 'fzm-spin', 'aria-hidden': 'true' }),
        h('div', null, h('b', { text: waking ? L('stepWake') + '…' : L('searching') }), h('small', { text: waking ? L('wakingLong') : K.modeName(byId(K.MODES, st.mode)) }), steps, bar),
        K.button('fzm-btn--sm', 'quick:cancel', L('cancel'), cancelQuick)));
    }
    wrap.append(h('div', { class: 'fzh-qgrid' },
      h('section', { class: 'fzh-qmodes' }, K.heading(K.T('mode.title')), P.modePicker),
      h('div', { class: 'fzh-qmain' }, K.alertBox(), ext('browser')),
      h('aside', { class: 'fzm-panel fzh-you' }, K.heading(L('youT')), K.nameField(), K.loadoutLine())));
    return wrap;
  }

  /* ---------- Équipement: class, weapons, combat gear, outfit ---------- */
  function goTab(screen, anchor) {
    K.sfx('ui'); st.back = 'loadout'; K.main.setAttribute('data-fz-dir', 'fwd'); K.go(screen);
    if (anchor) { const el = K.main.querySelector(anchor); if (el) K.main.scrollTop = Math.max(0, el.offsetTop - 16); }       // the weapons, below the combat gear
  }
  const bar = (label, pct, value) => h('span', { class: 'fzm-stat' }, label, h('i', null, h('u', { style: `width:${Math.min(100, Math.max(4, Math.round(pct)))}%` })), h('b', { text: value }));
  function loadout() {
    const P = profile.data;
    const classes = K.radios('lo:class', L('clsT'), P.cls, CLASSES.map(c => ({ id: c.id, cls: 'fzh-cls', kids: [
      h('span', { class: 'fzh-cls-top' }, h('b', { text: K.className(c) }), c.regen ? h('span', { class: 'fzm-tag fzm-tag--coop', text: K.L('m.regen') }) : null),
      h('span', { class: 'fzh-cls-d', text: K.classDesc(c) }),
      h('span', { class: 'fzm-stats' },
        bar(h('span', K.tx('stat.health')), c.hp / 1.4, String(c.hp)),
        bar(h('span', K.tx('stat.armor')), c.armor * 1.3, String(c.armor)),
        bar(h('span', K.tx('stat.speed')), (c.spd - 0.7) * 180, `${Math.round(c.spd * 100)} %`))] })),
    id => { if (profile.equip('class', id)) K.syncLoadout(); }, 'fzh-cls-list');
    const slot = (label, w, fid, to) => h('div', { class: 'fzh-slot' }, K.gun(w ? w.id : ''),
      h('div', null, h('small', { text: label }), h('b', { text: w ? w.name : '—' }), h('span', { text: w ? K.weaponType(w) : '' })),
      K.button('fzm-btn--sm', fid, L('change'), () => goTab(to, '.fzm-slots')));
    const gx = (P.gx && typeof P.gx === 'object') ? P.gx : {}, gxIds = ['L', 'T', 'M'].map(s => gx[s]).filter(Boolean);
    const gxNames = GX ? gxIds.map(id => { try { return GX.nameOf(id, lang()); } catch { return id; } }) : [];
    const gearPics = h('span', { class: 'fzh-gx', 'aria-hidden': 'true' }, gxIds.map(id => { const im = h('img', { alt: '', loading: 'lazy', src: new URL('map-shots/gear-' + encodeURIComponent(id) + '.webp', import.meta.url).href }); im.addEventListener('error', () => im.remove()); return im; }));
    const fit = wornFit();
    const arms =h('section', { class: 'fzm-panel fzh-arms' }, K.heading(L('armsT')),
      h('div', null,
        slot(K.slotName(0), byId(WEAPONS, P.primary), 'lo:primary', 'arsenal'),
        slot(K.slotName(1), byId(WEAPONS, P.secondary), 'lo:secondary', 'arsenal'),
        h('div', { class: 'fzh-slot' }, gearPics, h('div', null, h('small', { text: L('combat') }), h('b', { text: gxNames.join(' · ') || '—' })), K.button('fzm-btn--sm', 'lo:gear', L('change'), () => goTab('arsenal'))),
        h('div', { class: 'fzh-slot' }, fitPic(fit, 208, 104, 'fzh-ocamo'), h('div', null, h('small', { text: L('outfit') }), h('b', { text: fit.name })), K.button('fzm-btn--sm', 'lo:outfit', L('change'), () => goTab('outfits')))));
    return h('div', { class: 'fzm-wrap fzh-view fzh-loadout' }, head('loadout'),
      h('div', { class: 'fzh-lgrid' }, h('section', { class: 'fzm-panel fzh-lclass' }, K.heading(L('clsT')), classes), arms),
      h('div', { class: 'fzh-ldone' }, K.button('fzm-btn--primary', 'lo:done', [h('span', { text: L('done') })], back)));
  }
  function loadoutBtn() { return K.button('fzm-btn--sm fzh-gearbtn', 'play:edit', [h('span', { text: L('gearBtn') }), h('i', { class: 'fzh-chev', 'aria-hidden': 'true' })], openLoadout); }

  /* ---------- top tabs (Arsenal, Tenues, Classes, Paramètres): RETOUR + where you are ---------- */
  const TAB_KEY = { arsenal: 'nav.arsenal', outfits: 'nav.outfits', classes: 'nav.classes', settings: 'nav.settings' };
  function tab(view, screen) {
    if (!view || !TAB_KEY[screen]) return null;
    const label = st.back === 'loadout' ? `${L('back')} · ${L('gearT')}` : L('back');
    if (screen === 'settings') { view.append(backBtn(label)); return view; }
    const trail = st.back === 'loadout' ? [K.T('nav.play'), L('gearT')] : [K.T('nav.play')];
    const old = view.querySelector(':scope>.fzh-tabhead'); if (old) old.remove();       // the wardrobe view is kept across renders
    view.prepend(h('div', { class: 'fzh-tabhead' }, backBtn(label), crumb(trail)));
    return view;
  }
  /* ---------- lobby ---------- */
  function lobbyCrumb(room) { void room; return crumb([K.T('nav.play'), L(st.flow === 'quick' ? 'quickT' : 'friendsTitle')]); }
  function lobbyAside(room, playing) { void room; return playing ? h('div') : h('div', { class: 'fzh-lobbyside' }, loadoutBtn()); }

  return { hub, screen, loadout, loadoutBtn, tab, tabClick, escape, shown, lobbyCrumb, lobbyAside, back, setFlow, startQuick, get seen() { return seen; } };
}
