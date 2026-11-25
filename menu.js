/* FRONT ZÉRO - menus : accueil, salon multijoueur, arsenal, tenues, classes, paramètres, fin de partie.
   createMenu(rootEl, deps) -> { show(screen?), hide(), showEnd(result), destroy() }
   Le module ne dessine que dans rootEl, injecte son propre CSS (préfixe .fzm) et ne touche ni au canvas ni au HUD. */
import { WEAPONS, WEAPON_CATS, OUTFITS, CLASSES, MODES as DATA_MODES, byId } from './data.js';
import { attText, rewardName, slotsOf } from './attachments.js';
import { openCustomizer, rewardLines, rewardBlock, rewardToast } from './attachments-ui.js';
import { gearPanel } from './gear-ui.js';

const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const PREFS_KEY = 'frontzero.menu';
const XP_PER_LEVEL = 1000;
const MODE_KEY = { ffa: 'mode.deathmatch', tdm: 'mode.teams', dom: 'mode.domination', bomb: 'mode.bomb', zombie: 'mode.zombies', zone: 'mode.zone' };
const RARITY_KEY = { 'Standard': 'standard', 'Spécial': 'special', 'Élite': 'elite', 'Légende': 'legend' };
const DIFFICULTIES = ['easy', 'normal', 'hard'];
const FALLBACK_MAPS = [
  { id: 'depot', env: 'desert' }, { id: 'vieille-ville', env: 'urban' }, { id: 'port', env: 'port' },
  { id: 'bunker', env: 'bunker' }, { id: 'col-blanc', env: 'snow' },
];
const SCREEN_ALIASES = {
  play: 'play', home: 'play', accueil: 'play', jouer: 'play', solo: 'play',
  multi: 'multi', multiplayer: 'multi', multijoueur: 'multi', lobby: 'multi', salon: 'multi',
  arsenal: 'arsenal', weapons: 'arsenal', armes: 'arsenal',
  outfits: 'outfits', tenues: 'outfits',
  classes: 'classes', class: 'classes',
  settings: 'settings', parametres: 'settings', 'paramètres': 'settings', options: 'settings',
  end: 'end',
};
/* Codes d’erreur du serveur qui concernent le salon (les autres relèvent de la partie en cours). */
const LOBBY_ERRORS = new Set(['too_many_rooms', 'in_progress', 'no_public', 'connect_failed', 'not_connected', 'room_not_found', 'room_full', 'server_full', 'bad_code', 'bad_mode', 'bad_map',
  'not_enough_players', 'players_not_ready', 'not_host', 'not_in_lobby', 'not_in_room', 'already_started', 'already_in_room', 'rate_limited',
  'no_teams_in_mode', 'server_error']);

/* Textes absents de i18n.js : [fr, en, es, de, pt, it]. */
const LOCAL = {
  'm.navLabel': ['Navigation principale', 'Main navigation', 'Navegación principal', 'Hauptnavigation', 'Navegação principal', 'Navigazione principale'],
  'm.tagTeams': ['En équipe', 'Team-based', 'Por equipos', 'Im Team', 'Em equipa', 'A squadre'],
  'm.tagFfa': ['Chacun pour soi', 'Free-for-all', 'Todos contra todos', 'Jeder gegen jeden', 'Todos contra todos', 'Tutti contro tutti'],
  'm.tagCoop': ['Coopération', 'Co-op', 'Cooperativo', 'Koop', 'Cooperativo', 'Cooperativa'],
  'm.modeDesc.ffa': ['Chacun pour soi. Le premier à 20 éliminations gagne.', 'Every soldier for themselves. First to 20 eliminations wins.', 'Cada soldado por su cuenta. Gana el primero en lograr 20 eliminaciones.', 'Jeder für sich. Wer zuerst 20 Eliminierungen erzielt, gewinnt.', 'Cada um por si. Vence o primeiro a chegar às 20 eliminações.', 'Ognuno per sé. Vince il primo che arriva a 20 eliminazioni.'],
  'm.modeDesc.tdm': ['Deux équipes. La première à 40 éliminations gagne.', 'Two teams. First team to 40 eliminations wins.', 'Dos equipos. Gana el primero en lograr 40 eliminaciones.', 'Zwei Teams. Das erste Team mit 40 Eliminierungen gewinnt.', 'Duas equipas. Vence a primeira a chegar às 40 eliminações.', 'Due squadre. Vince la prima che arriva a 40 eliminazioni.'],
  'm.modeDesc.dom': ['Capturez et tenez trois zones pour marquer des points.', 'Capture and hold three zones to score points.', 'Captura y mantén tres zonas para sumar puntos.', 'Erobert und haltet drei Zonen, um Punkte zu sammeln.', 'Captura e mantém três zonas para marcar pontos.', 'Conquista e mantieni tre zone per segnare punti.'],
  'm.modeDesc.bomb': ['Les attaquants posent la bombe, les défenseurs la désamorcent. Pas de réapparition pendant la manche.', 'Attackers plant the bomb, defenders defuse it. No respawns during a round.', 'Los atacantes colocan la bomba y los defensores la desactivan. Sin reapariciones durante la ronda.', 'Angreifer legen die Bombe, Verteidiger entschärfen sie. Kein Wiedereinstieg während der Runde.', 'Os atacantes plantam a bomba, os defensores desarmam-na. Sem reaparecimento durante a ronda.', 'Gli attaccanti piazzano la bomba, i difensori la disinnescano. Nessun rientro durante il round.'],
  'm.modeDesc.zombie': ['Survivez à des vagues de plus en plus dures.', 'Survive increasingly tough waves.', 'Sobrevive a oleadas cada vez más duras.', 'Überlebe immer härtere Wellen.', 'Sobrevive a vagas cada vez mais duras.', 'Sopravvivi a ondate sempre più dure.'],
  'm.modeDesc.zone': ['Une arme de poing, des caisses à fouiller, une zone qui se referme. Le dernier en vie gagne.', 'One sidearm, crates to search, a closing zone. Last one standing wins.', 'Una pistola, cajas que registrar, una zona que se cierra. Gana el último en pie.', 'Eine Pistole, Kisten zum Durchsuchen, eine schrumpfende Zone. Der Letzte gewinnt.', 'Uma pistola, caixas para revistar, uma zona a fechar. Vence o último de pé.', 'Una pistola, casse da frugare, una zona che si chiude. Vince l’ultimo in vita.'],
  'm.mapDesc.depot': ['Base militaire du désert : hangar traversant, tranchées de sacs, tour de guet et longues lignes de tir.', 'Desert military base: a drive-through hangar, sandbag trenches, a watchtower and long firing lines.', 'Base militar del desierto: hangar pasante, trincheras de sacos, torre de vigilancia y largas líneas de tiro.', 'Militärbasis in der Wüste: durchgehender Hangar, Sandsackgräben, Wachturm und lange Schusslinien.', 'Base militar no deserto: hangar aberto dos dois lados, trincheiras de sacos, torre de vigia e longas linhas de tiro.', 'Base militare nel deserto: hangar passante, trincee di sacchi, torre di guardia e lunghe linee di tiro.'],
  'm.mapDesc.vieille-ville': ['Cité meurtrie : ruelles, arcades, cours, maisons à étages et passerelles entre les toits.', 'War-torn town: alleys, arcades, courtyards, multi-storey houses and walkways between rooftops.', 'Ciudad herida: callejones, soportales, patios, casas de varias plantas y pasarelas entre tejados.', 'Gezeichnete Stadt: Gassen, Arkaden, Höfe, mehrstöckige Häuser und Stege zwischen den Dächern.', 'Cidade ferida: ruelas, arcadas, pátios, casas de vários andares e passadiços entre telhados.', 'Città ferita: vicoli, portici, cortili, case a più piani e passerelle tra i tetti.'],
  'm.mapDesc.port': ['Docks au crépuscule : labyrinthe de conteneurs, entrepôt traversant, coursives et grues au-dessus de l’eau.', 'Docks at dusk: a container maze, a drive-through warehouse, gangways and cranes above the water.', 'Muelles al atardecer: laberinto de contenedores, almacén pasante, pasarelas y grúas sobre el agua.', 'Docks in der Dämmerung: Containerlabyrinth, durchgehende Lagerhalle, Laufstege und Kräne über dem Wasser.', 'Docas ao crepúsculo: labirinto de contentores, armazém aberto dos dois lados, passadiços e gruas sobre a água.', 'Banchine al tramonto: labirinto di container, magazzino passante, camminamenti e gru sopra l’acqua.'],
  'm.mapDesc.bunker': ['Complexe souterrain : couloirs, salles de contrôle, gaines techniques et hall du réacteur.', 'Underground complex: corridors, control rooms, service ducts and the reactor hall.', 'Complejo subterráneo: pasillos, salas de control, conductos técnicos y sala del reactor.', 'Unterirdischer Komplex: Korridore, Kontrollräume, Versorgungsschächte und Reaktorhalle.', 'Complexo subterrâneo: corredores, salas de controlo, condutas técnicas e sala do reator.', 'Complesso sotterraneo: corridoi, sale di controllo, condotti tecnici e sala del reattore.'],
  'm.mapDesc.sept-vents': ['Base aérienne battue par le vent : piste géante, hangars ouverts, tour de contrôle, épaves d’avions et dépôt de carburant.', 'Windswept airbase: a huge runway, open hangars, a control tower, aircraft wrecks and a fuel depot.', 'Base aérea azotada por el viento: pista enorme, hangares abiertos, torre de control, restos de aviones y depósito de combustible.', 'Windgepeitschter Fliegerhorst: riesige Startbahn, offene Hangars, Kontrollturm, Flugzeugwracks und Treibstofflager.', 'Base aérea varrida pelo vento: pista gigante, hangares abertos, torre de controle, destroços de aviões e depósito de combustível.', 'Base aerea battuta dal vento: pista enorme, hangar aperti, torre di controllo, relitti di aerei e deposito di carburante.'],
  'm.mapDesc.col-blanc': ['Passage de montagne enneigé : ravin, pont de bois, tranchées, chalets et pins.', 'Snowy mountain pass: a ravine, a wooden bridge, trenches, chalets and pines.', 'Paso de montaña nevado: barranco, puente de madera, trincheras, cabañas y pinos.', 'Verschneiter Gebirgspass: Schlucht, Holzbrücke, Gräben, Hütten und Kiefern.', 'Passagem de montanha nevada: ravina, ponte de madeira, trincheiras, chalés e pinheiros.', 'Passo di montagna innevato: burrone, ponte di legno, trincee, baite e pini.'],
  'm.env.desert': ['Désert', 'Desert', 'Desierto', 'Wüste', 'Deserto', 'Deserto'],
  'm.env.urban': ['Urbain', 'Urban', 'Urbano', 'Stadt', 'Urbano', 'Urbano'],
  'm.env.port': ['Portuaire', 'Harbor', 'Portuario', 'Hafen', 'Portuário', 'Portuale'],
  'm.env.bunker': ['Souterrain', 'Underground', 'Subterráneo', 'Untergrund', 'Subterrâneo', 'Sotterraneo'],
  'm.env.snow': ['Neige', 'Snow', 'Nieve', 'Schnee', 'Neve', 'Neve'],
  'm.env.airbase': ['Base aérienne', 'Airbase', 'Base aérea', 'Luftwaffenbasis', 'Base aérea', 'Base aerea'],
  'm.env.refinery': ['Industriel', 'Industrial', 'Industrial', 'Industrie', 'Industrial', 'Industriale'],
  'm.env.hillside': ['Village perché', 'Hill village', 'Pueblo en colina', 'Bergdorf', 'Aldeia na encosta', 'Borgo collinare'], 'm.env.mineval': ['Vallée minière', 'Mining valley', 'Valle minero', 'Bergbautal', 'Vale mineiro', 'Valle mineraria'], 'm.env.marsh': ['Marais', 'Marshland', 'Marisma', 'Marschland', 'Pântano', 'Palude'], 'm.mapDesc.marais': ['Delta brumeux : digue et station de pompage, roselières, péniche à demi coulée, village sur pilotis et aqueducs sous le marais.', 'Misty delta: a levee and pumping station, reed beds, a half-sunken barge, a stilt village and culverts under the marsh.', 'Delta brumoso: dique y estación de bombeo, carrizales, una barcaza medio hundida, un pueblo sobre pilotes y alcantarillas bajo la marisma.', 'Nebliges Delta: Deich und Pumpwerk, Schilfgürtel, ein halb gesunkener Lastkahn, ein Pfahldorf und Durchlässe unter dem Sumpf.', 'Delta enevoado: dique e estação de bombagem, caniçais, uma barcaça meio afundada, uma aldeia sobre estacas e aquedutos sob o pântano.', 'Delta nebbioso: argine e idrovora, canneti, una chiatta semiaffondata, un villaggio su palafitte e canali sotto la palude.'],'m.mapDesc.valferrade': ['Bourg minier au fond d’une vallée de montagne : gare de chargement, rue haute et place, chevalement, voie sur chevalet et galeries de mine reliées.', 'Mining town at the head of a mountain valley: a loading station, a high street and square, a headframe, a trestle railway and connected mine galleries.', 'Pueblo minero al fondo de un valle de montaña: estación de carga, calle mayor y plaza, castillete, vía sobre caballete y galerías de mina conectadas.', 'Bergbaustädtchen am Ende eines Gebirgstals: Verladebahnhof, Hauptstraße und Platz, Förderturm, Holzviadukt und verbundene Stollen.', 'Vila mineira no fundo de um vale de montanha: estação de carga, rua principal e praça, castelete, via sobre cavalete e galerias de mina ligadas.', 'Borgo minerario in fondo a una valle di montagna: stazione di carico, via maestra e piazza, castello di estrazione, ferrovia su cavalletti e gallerie collegate.'],'m.env.valley': ['Montagne', 'Mountain', 'Montaña', 'Gebirge', 'Montanha', 'Montagna'], 'm.env.gorge': ['Gorge et barrage', 'Dam gorge', 'Garganta y presa', 'Staudamm-Schlucht', 'Garganta e barragem', 'Gola e diga'], 'm.mapDesc.barrage': ['Barrage-poids au fond d’une gorge rocheuse, occupé par l’armée : couronnement et tour de prise d’eau, galeries et usine dans le barrage, retenue, lit de la rivière, poste électrique et passerelle haute.', 'Gravity dam deep in a rocky gorge, held by the army: crest road and intake tower, galleries and turbine hall inside the dam, reservoir, riverbed, switchyard and a high footbridge.', 'Presa de gravedad al fondo de un desfiladero rocoso, ocupada por el ejército: coronación y torre de toma, galerías y sala de turbinas dentro de la presa, embalse, cauce del río, subestación y pasarela alta.', 'Gewichtsstaumauer tief in einer Felsschlucht, vom Militär besetzt: Mauerkrone und Entnahmeturm, Stollen und Turbinenhalle in der Mauer, Stausee, Flussbett, Umspannwerk und hoher Steg.', 'Barragem de gravidade no fundo de um desfiladeiro rochoso, ocupada pelo exército: coroamento e torre de tomada, galerias e casa das turbinas dentro da barragem, albufeira, leito do rio, subestação e passadiço alto.', 'Diga a gravità in fondo a una gola rocciosa, occupata dall’esercito: coronamento e torre di presa, cunicoli e sala turbine nella diga, bacino, letto del fiume, sottostazione e passerella alta.'], 'm.env.cite': ['Quartier d’affaires', 'Business district', 'Distrito financiero', 'Geschäftsviertel', 'Distrito comercial', 'Quartiere degli affari'], 'm.mapDesc.cite': ['Quartier d’affaires en ruines : tours de verre à visiter, atrium à escalators, passerelle effondrée, parvis à fontaine sèche, avenue barricadée, chantier à grue et parking souterrain relié au métro.', 'Ruined business district: glass towers to explore, an atrium with escalators, a collapsed skybridge, a plaza with a dry fountain, a barricaded avenue, a crane construction site and an underground car park linked to the metro.', 'Distrito financiero en ruinas: torres de cristal visitables, atrio con escaleras mecánicas, pasarela derrumbada, plaza con fuente seca, avenida con barricadas, obra con grúa y aparcamiento subterráneo unido al metro.', 'Zerstörtes Geschäftsviertel: begehbare Glastürme, ein Atrium mit Rolltreppen, eine eingestürzte Hochbrücke, ein Platz mit trockenem Brunnen, eine verbarrikadierte Allee, eine Baustelle mit Kran und eine Tiefgarage mit Zugang zur U-Bahn.', 'Distrito comercial em ruínas: torres de vidro para explorar, átrio com escadas rolantes, passadiço desabado, praça com fonte seca, avenida com barricadas, obra com grua e parque subterrâneo ligado ao metro.', 'Quartiere degli affari in rovina: torri di vetro da esplorare, atrio con scale mobili, passerella crollata, piazza con fontana asciutta, viale barricato, cantiere con gru e parcheggio sotterraneo collegato alla metropolitana.'],
  'm.mapDesc.noirval': ['Complexe pétrolier au crépuscule : parcs de cuves, racks de tuyaux, passerelles sur plusieurs niveaux, entrepôts et gare de triage.', 'Oil complex at dusk: tank farms, pipe racks, catwalks on several levels, warehouses and a rail yard.', 'Complejo petrolero al anochecer: parques de tanques, racks de tuberías, pasarelas en varios niveles, almacenes y playa de vías.', 'Ölanlage in der Dämmerung: Tanklager, Rohrbrücken, Laufstege auf mehreren Ebenen, Lagerhallen und ein Rangierbahnhof.', 'Complexo petrolífero ao anoitecer: parques de tanques, racks de tubagens, passadiços em vários níveis, armazéns e pátio ferroviário.', 'Complesso petrolifero al crepuscolo: parchi serbatoi, rack di tubi, passerelle su più livelli, magazzini e scalo ferroviario.'],
  'm.mapDesc.roqueseche': ['Village en terrasses au-dessus d’une rivière à sec : ruelles, marché couvert, toits et rempart, citernes et égouts qui relient tout.', 'Terraced village above a dry river: alleys, a covered market, rooftops and a rampart, with cisterns and drains linking it all.', 'Pueblo en terrazas sobre un río seco: callejones, mercado cubierto, tejados y muralla, con cisternas y alcantarillas que lo conectan todo.', 'Terrassendorf über einem trockenen Fluss: Gassen, überdachter Markt, Dächer und Wehrmauer, verbunden durch Zisternen und Kanäle.', 'Aldeia em socalcos sobre um rio seco: vielas, mercado coberto, telhados e muralha, com cisternas e esgotos que ligam tudo.', 'Borgo a terrazze su un fiume in secca: vicoli, mercato coperto, tetti e bastioni, con cisterne e fogne che collegano tutto.'], 'm.mapDesc.val-cendre': ['Village de montagne à l’automne : maisons à visiter, pont sur la rivière à sec, terrasses étagées et crête fortifiée.', 'Mountain village in autumn: houses to enter, bridges over a dry river bed, stepped terraces and a fortified ridge.', 'Pueblo de montaña en otoño: casas accesibles, puentes sobre un río seco, terrazas escalonadas y una cresta fortificada.', 'Bergdorf im Herbst: begehbare Häuser, Brücken über ein trockenes Flussbett, Terrassen und ein befestigter Grat.', 'Aldeia de montanha no outono: casas para explorar, pontes sobre um rio seco, socalcos e uma crista fortificada.', 'Villaggio di montagna in autunno: case visitabili, ponti su un fiume in secca, terrazze a gradoni e una cresta fortificata.'],
  'm.random': ['Aléatoire', 'Random', 'Aleatorio', 'Zufall', 'Aleatório', 'Casuale'],
  'm.randomTag': ['Surprise', 'Surprise', 'Sorpresa', 'Überraschung', 'Surpresa', 'Sorpresa'],
  'm.randomDesc': ['Une carte tirée au sort à chaque déploiement.', 'A map drawn at random on every deployment.', 'Un mapa elegido al azar en cada despliegue.', 'Bei jedem Einsatz wird eine Karte ausgelost.', 'Um mapa sorteado em cada mobilização.', 'Una mappa estratta a sorte a ogni schieramento.'],
  'm.brief': ['Ordre de mission', 'Mission brief', 'Orden de misión', 'Einsatzbefehl', 'Ordem de missão', 'Ordine di missione'],
  'm.bots': ['Bots', 'Bots', 'Bots', 'Bots', 'Bots', 'Bot'],
  'm.allies': ['Alliés (bots)', 'Allies (bots)', 'Aliados (bots)', 'Verbündete (Bots)', 'Aliados (bots)', 'Alleati (bot)'],
  'm.less': ['Moins de bots', 'Fewer bots', 'Menos bots', 'Weniger Bots', 'Menos bots', 'Meno bot'],
  'm.more': ['Plus de bots', 'More bots', 'Más bots', 'Mehr Bots', 'Mais bots', 'Più bot'],
  'm.difficulty': ['Difficulté', 'Difficulty', 'Dificultad', 'Schwierigkeit', 'Dificuldade', 'Difficoltà'],
  'm.diff.easy': ['Facile', 'Easy', 'Fácil', 'Leicht', 'Fácil', 'Facile'],
  'm.diff.normal': ['Normale', 'Normal', 'Normal', 'Normal', 'Normal', 'Normale'],
  'm.diff.hard': ['Difficile', 'Hard', 'Difícil', 'Schwer', 'Difícil', 'Difficile'],
  'm.loadout': ['Équipement', 'Loadout', 'Equipamiento', 'Ausrüstung', 'Equipamento', 'Equipaggiamento'],
  'm.edit': ['Modifier', 'Change', 'Cambiar', 'Ändern', 'Alterar', 'Modifica'],
  'm.deploying': ['Déploiement…', 'Deploying…', 'Desplegando…', 'Einsatz läuft…', 'A mobilizar…', 'Schieramento…'],
  'm.deployFail': ['Impossible de lancer la partie.', 'Could not start the match.', 'No se pudo iniciar la partida.', 'Das Match konnte nicht gestartet werden.', 'Não foi possível iniciar a partida.', 'Impossibile avviare la partita.'],
  'm.or': ['ou', 'or', 'o', 'oder', 'ou', 'oppure'],
  'm.namePh': ['Soldat', 'Soldier', 'Soldado', 'Soldat', 'Soldado', 'Soldato'],
  'm.createHint': ['Le salon utilisera le mode et la carte sélectionnés.', 'The room will use the selected mode and map.', 'La sala usará el modo y el mapa seleccionados.', 'Der Raum verwendet den gewählten Modus und die gewählte Karte.', 'A sala usará o modo e o mapa selecionados.', 'La stanza userà la modalità e la mappa selezionate.'],
  'm.join': ['Rejoindre', 'Join', 'Unirse', 'Beitreten', 'Entrar', 'Entra'],
  'm.codeHelp': ['6 lettres', '6 letters', '6 letras', '6 Buchstaben', '6 letras', '6 lettere'],
  'm.share': ['Hôte : donnez l’adresse de cette page et le code du salon aux joueurs connectés au même réseau.', 'Host: give the address of this page and the room code to players on the same network.', 'Anfitrión: da la dirección de esta página y el código de la sala a los jugadores de la misma red.', 'Host: Gib die Adresse dieser Seite und den Raumcode an Spieler im selben Netzwerk weiter.', 'Anfitrião: dá o endereço desta página e o código da sala aos jogadores da mesma rede.', 'Host: comunica l’indirizzo di questa pagina e il codice della stanza ai giocatori sulla stessa rete.'],
  'm.shareLocal': ['Cette adresse locale ne fonctionne que sur cet ordinateur : remplacez le nom d’hôte par l’adresse IP de cet ordinateur sur le réseau (par exemple 192.168.1.20).', 'This local address only works on this computer: replace the host name with this computer’s IP address on the network (for example 192.168.1.20).', 'Esta dirección local solo funciona en este ordenador: sustituye el nombre del host por la dirección IP de este ordenador en la red (por ejemplo 192.168.1.20).', 'Diese lokale Adresse funktioniert nur auf diesem Computer: Ersetze den Hostnamen durch die IP-Adresse dieses Computers im Netzwerk (zum Beispiel 192.168.1.20).', 'Este endereço local só funciona neste computador: substitui o nome do anfitrião pelo endereço IP deste computador na rede (por exemplo 192.168.1.20).', 'Questo indirizzo locale funziona solo su questo computer: sostituisci il nome host con l’indirizzo IP di questo computer sulla rete (ad esempio 192.168.1.20).'],
  'm.copyAddr': ['Copier l’adresse', 'Copy address', 'Copiar dirección', 'Adresse kopieren', 'Copiar endereço', 'Copia indirizzo'],
  'm.addrCopied': ['Adresse copiée', 'Address copied', 'Dirección copiada', 'Adresse kopiert', 'Endereço copiado', 'Indirizzo copiato'],
  'm.copyFail': ['Copie impossible : sélectionnez le texte.', 'Could not copy: select the text.', 'No se pudo copiar: selecciona el texto.', 'Kopieren nicht möglich: Text markieren.', 'Não foi possível copiar: seleciona o texto.', 'Copia non riuscita: seleziona il testo.'],
  'm.unassigned': ['Répartition automatique', 'Auto-assigned', 'Reparto automático', 'Automatische Zuteilung', 'Distribuição automática', 'Assegnazione automatica'],
  'm.setReady': ['Je suis prêt', 'I am ready', 'Estoy listo', 'Ich bin bereit', 'Estou pronto', 'Sono pronto'],
  'm.cancelReady': ['Annuler « prêt »', 'Cancel ready', 'Cancelar «listo»', 'Bereitschaft aufheben', 'Cancelar «pronto»', 'Annulla «pronto»'],
  'm.waitHost': ['En attente du lancement par l’hôte…', 'Waiting for the host to start…', 'Esperando a que el anfitrión inicie…', 'Warte auf den Start durch den Host…', 'À espera que o anfitrião inicie…', 'In attesa che l’host avvii…'],
  'm.needPlayers': ['Il faut au moins 2 joueurs.', 'At least 2 players are required.', 'Se necesitan al menos 2 jugadores.', 'Mindestens 2 Spieler erforderlich.', 'São necessários pelo menos 2 jogadores.', 'Servono almeno 2 giocatori.'],
  'm.needReady': ['Tous les joueurs doivent être prêts.', 'All players must be ready.', 'Todos los jugadores deben estar listos.', 'Alle Spieler müssen bereit sein.', 'Todos os jogadores têm de estar prontos.', 'Tutti i giocatori devono essere pronti.'],
  'm.allReady': ['Tout le monde est prêt.', 'Everyone is ready.', 'Todos están listos.', 'Alle sind bereit.', 'Estão todos prontos.', 'Sono tutti pronti.'],
  'm.hostOnly': ['Seul l’hôte peut changer le mode et la carte.', 'Only the host can change the mode and map.', 'Solo el anfitrión puede cambiar el modo y el mapa.', 'Nur der Host kann Modus und Karte ändern.', 'Só o anfitrião pode alterar o modo e o mapa.', 'Solo l’host può cambiare modalità e mappa.'],
  'm.inProgress': ['Partie en cours', 'Match in progress', 'Partida en curso', 'Match läuft', 'Partida em curso', 'Partita in corso'],
  'm.rejoin': ['Rejoindre la partie', 'Rejoin match', 'Volver a la partida', 'Match wieder beitreten', 'Voltar à partida', 'Rientra in partita'],
  'm.reconnect': ['Reconnecter', 'Reconnect', 'Reconectar', 'Neu verbinden', 'Religar', 'Riconnetti'],
  'm.retry': ['Réessayer', 'Retry', 'Reintentar', 'Erneut versuchen', 'Tentar de novo', 'Riprova'],
  'm.inRoom': ['Salon {code}', 'Room {code}', 'Sala {code}', 'Raum {code}', 'Sala {code}', 'Stanza {code}'],
  'm.errConnect': ['Connexion au serveur impossible. Vérifiez que le serveur de jeu est lancé et que cette page est ouverte depuis son adresse.', 'Could not reach the server. Check that the game server is running and that this page was opened from its address.', 'No se pudo conectar con el servidor. Comprueba que el servidor del juego está en marcha y que esta página se abrió desde su dirección.', 'Server nicht erreichbar. Prüfe, ob der Spielserver läuft und diese Seite über seine Adresse geöffnet wurde.', 'Não foi possível ligar ao servidor. Verifica se o servidor do jogo está a correr e se esta página foi aberta a partir do seu endereço.', 'Impossibile raggiungere il server. Verifica che il server di gioco sia avviato e che questa pagina sia aperta dal suo indirizzo.'],
  'm.errCode': ['Code invalide : il faut 6 lettres.', 'Invalid code: 6 letters are required.', 'Código no válido: se necesitan 6 letras.', 'Ungültiger Code: 6 Buchstaben erforderlich.', 'Código inválido: são necessárias 6 letras.', 'Codice non valido: servono 6 lettere.'],
  'm.errRate': ['Trop de demandes. Patientez quelques secondes.', 'Too many requests. Wait a few seconds.', 'Demasiadas solicitudes. Espera unos segundos.', 'Zu viele Anfragen. Warte ein paar Sekunden.', 'Demasiados pedidos. Aguarda alguns segundos.', 'Troppe richieste. Attendi qualche secondo.'],
  'm.waking': ['Le serveur se réveille, cela peut prendre jusqu’à une minute…', 'The server is waking up, this can take up to a minute…', 'El servidor se está despertando, puede tardar hasta un minuto…', 'Der Server wird geweckt, das kann bis zu einer Minute dauern…', 'O servidor está a acordar, pode demorar até um minuto…', 'Il server si sta svegliando, può richiedere fino a un minuto…'],
  'm.errServerFull': ['Le serveur est complet.', 'The server is full.', 'El servidor está lleno.', 'Der Server ist voll.', 'O servidor está cheio.', 'Il server è pieno.'],
  'm.errGeneric': ['Erreur du serveur ({code}).', 'Server error ({code}).', 'Error del servidor ({code}).', 'Serverfehler ({code}).', 'Erro do servidor ({code}).', 'Errore del server ({code}).'],
  'm.errTried': ['Adresse essayée : {url}', 'Address tried: {url}', 'Dirección probada: {url}', 'Versuchte Adresse: {url}', 'Endereço tentado: {url}', 'Indirizzo provato: {url}'],
  'm.errFile': ['Cette page est ouverte comme un simple fichier : le multijoueur exige de l’ouvrir depuis l’adresse du serveur de jeu (par exemple http://localhost:8080).', 'This page was opened as a plain file: multiplayer needs it opened from the game server address (for example http://localhost:8080).', 'Esta página se abrió como un archivo: el multijugador exige abrirla desde la dirección del servidor del juego (por ejemplo http://localhost:8080).', 'Diese Seite wurde als Datei geöffnet: Der Mehrspielermodus braucht die Adresse des Spielservers (zum Beispiel http://localhost:8080).', 'Esta página foi aberta como um ficheiro: o multijogador exige abri-la a partir do endereço do servidor do jogo (por exemplo http://localhost:8080).', 'Questa pagina è stata aperta come file: il multigiocatore richiede di aprirla dall’indirizzo del server di gioco (ad esempio http://localhost:8080).'],
  'm.errNoNet': ['Le multijoueur n’est pas disponible ici.', 'Multiplayer is not available here.', 'El multijugador no está disponible aquí.', 'Mehrspieler ist hier nicht verfügbar.', 'O multijogador não está disponível aqui.', 'Il multigiocatore non è disponibile qui.'],
  'm.confirmBuy': ['Confirmer l’achat', 'Confirm purchase', 'Confirmar compra', 'Kauf bestätigen', 'Confirmar compra', 'Conferma acquisto'],
  'm.buyQuestion': ['Acheter {name} pour {price} ₡ ?', 'Buy {name} for {price} ₡?', '¿Comprar {name} por {price} ₡?', '{name} für {price} ₡ kaufen?', 'Comprar {name} por {price} ₡?', 'Acquistare {name} per {price} ₡?'],
  'm.balanceAfter': ['Solde après achat : {n} ₡', 'Balance after purchase: {n} ₡', 'Saldo tras la compra: {n} ₡', 'Guthaben nach dem Kauf: {n} ₡', 'Saldo após a compra: {n} ₡', 'Saldo dopo l’acquisto: {n} ₡'],
  'm.missing': ['Il manque {n} ₡', '{n} ₡ short', 'Faltan {n} ₡', 'Es fehlen {n} ₡', 'Faltam {n} ₡', 'Mancano {n} ₡'],
  'm.bought': ['{name} : achat confirmé', '{name}: purchase confirmed', '{name}: compra confirmada', '{name}: Kauf bestätigt', '{name}: compra confirmada', '{name}: acquisto confermato'],
  'm.owned': ['Acquis', 'Owned', 'Adquirido', 'Im Besitz', 'Adquirido', 'Acquisito'],
  'm.mag': ['Chargeur', 'Magazine', 'Cargador', 'Magazin', 'Carregador', 'Caricatore'],
  'm.reloadTime': ['Rechargement', 'Reload', 'Recarga', 'Nachladen', 'Recarga', 'Ricarica'],
  'm.sidearmNote': ['Toujours équipée', 'Always equipped', 'Siempre equipada', 'Immer ausgerüstet', 'Sempre equipada', 'Sempre equipaggiata'],
  /* arsenal : emplacements, catégories et caractéristiques propres à chaque type d’arme */
  'm.arsenalNote': ['Composez votre équipement : une arme principale, une arme secondaire et un équipement à lancer.', 'Build your loadout: one primary weapon, one sidearm and one piece of throwable gear.', 'Compón tu equipo: un arma principal, un arma secundaria y un equipo arrojadizo.', 'Stell deine Ausrüstung zusammen: eine Primärwaffe, eine Zweitwaffe und ein Wurfgerät.', 'Compõe o teu equipamento: uma arma principal, uma arma secundária e um equipamento de arremesso.', 'Componi il tuo equipaggiamento: un’arma primaria, un’arma secondaria e un equipaggiamento da lancio.'],
  'm.slot0': ['Principale', 'Primary', 'Principal', 'Primär', 'Principal', 'Primaria'],
  'm.slot1': ['Secondaire', 'Secondary', 'Secundaria', 'Sekundär', 'Secundária', 'Secondaria'],
  'm.slot2': ['Équipement', 'Gear', 'Equipo', 'Ausrüstung', 'Equipamento', 'Equipaggiamento'],
  'm.cat.assault': ['Fusils d’assaut', 'Assault rifles', 'Fusiles de asalto', 'Sturmgewehre', 'Espingardas de assalto', 'Fucili d’assalto'],
  'm.cat.smg': ['Mitraillettes', 'Submachine guns', 'Subfusiles', 'Maschinenpistolen', 'Pistolas-metralhadoras', 'Mitra'],
  'm.cat.shotgun': ['Fusils à pompe', 'Shotguns', 'Escopetas', 'Schrotflinten', 'Caçadeiras', 'Fucili a pompa'],
  'm.cat.lmg': ['Mitrailleuses', 'Machine guns', 'Ametralladoras', 'Maschinengewehre', 'Metralhadoras', 'Mitragliatrici'],
  'm.cat.sniper': ['Précision', 'Marksman rifles', 'Precisión', 'Präzisionsgewehre', 'Precisão', 'Precisione'],
  'm.cat.launcher': ['Lanceurs', 'Launchers', 'Lanzadores', 'Werfer', 'Lançadores', 'Lanciatori'],
  'm.cat.special': ['Spécial', 'Special', 'Especial', 'Spezial', 'Especial', 'Speciale'],
  'm.cat.pistol': ['Armes de poing', 'Handguns', 'Armas cortas', 'Faustfeuerwaffen', 'Armas de mão', 'Armi corte'],
  'm.cat.melee': ['Corps à corps', 'Melee', 'Cuerpo a cuerpo', 'Nahkampf', 'Corpo a corpo', 'Corpo a corpo'],
  'm.cat.gear': ['Équipement', 'Gear', 'Equipo', 'Ausrüstung', 'Equipamento', 'Equipaggiamento'],
  'm.blast': ['Rayon', 'Blast', 'Radio', 'Radius', 'Raio', 'Raggio'],
  'm.carried': ['Munitions', 'Rounds', 'Munición', 'Munition', 'Munições', 'Munizioni'],
  'm.burst': ['Rafale', 'Burst', 'Ráfaga', 'Feuerstoß', 'Rajada', 'Raffica'],
  'm.spin': ['Mise en rotation', 'Spin-up', 'Giro previo', 'Anlaufzeit', 'Arranque', 'Avvio rotazione'],
  'm.fuse': ['Mèche', 'Fuse', 'Mecha', 'Zünder', 'Rastilho', 'Miccia'],
  'm.head': ['Tête', 'Head', 'Cabeza', 'Kopf', 'Cabeça', 'Testa'],
  'm.backstab': ['Dans le dos', 'From behind', 'Por la espalda', 'Von hinten', 'Pelas costas', 'Alle spalle'],
  'm.silent': ['Silencieuse', 'Silent', 'Silenciosa', 'Lautlos', 'Silenciosa', 'Silenziosa'],
  'm.selfDmg': ['Dangereux à courte portée', 'Dangerous at close range', 'Peligroso a corta distancia', 'Auf kurze Distanz gefährlich', 'Perigoso a curta distância', 'Pericoloso a distanza ravvicinata'],
  'm.regen': ['Régénération rapide', 'Fast regeneration', 'Regeneración rápida', 'Schnelle Regeneration', 'Regeneração rápida', 'Rigenerazione rapida'],
  'm.report': ['Rapport de mission', 'Mission report', 'Informe de misión', 'Einsatzbericht', 'Relatório de missão', 'Rapporto di missione'],
  'm.rewards': ['Récompenses', 'Rewards', 'Recompensas', 'Belohnungen', 'Recompensas', 'Ricompense'],
  'm.xp': ['Expérience', 'Experience', 'Experiencia', 'Erfahrung', 'Experiência', 'Esperienza'],
  'm.levelUp': ['Niveau supérieur', 'Level up', 'Subida de nivel', 'Stufenaufstieg', 'Subida de nível', 'Livello superiore'],
  'm.levelN': ['Niveau {n}', 'Level {n}', 'Nivel {n}', 'Stufe {n}', 'Nível {n}', 'Livello {n}'],
  'm.backLobby': ['Retour au salon', 'Back to lobby', 'Volver a la sala', 'Zurück zur Lobby', 'Voltar à sala', 'Torna alla lobby'],
};

/* ---------- vignettes de carte (CSS pur) : fond + calques [background, clip-path] ---------- */
const THUMBS = {
  desert: { bg: 'linear-gradient(180deg,#c98f4a 0%,#e6c078 46%,#d9b06c 47%,#b58a52 100%)', layers: [
    ['radial-gradient(circle at 74% 26%,#fff4cf 0 5%,rgba(255,244,207,.35) 6% 13%,transparent 14%)'],
    ['#b08650', 'polygon(0 58%,16% 50%,36% 57%,58% 45%,80% 55%,100% 47%,100% 100%,0 100%)'],
    ['#5a482d', 'polygon(10% 80%,10% 60%,14% 53%,22% 49%,34% 49%,42% 53%,46% 60%,46% 80%)'],
    ['#2c2416', 'polygon(20% 80%,20% 63%,36% 63%,36% 80%)'],
    ['#473722', 'polygon(69% 82%,71% 46%,67% 46%,67% 36%,81% 36%,81% 46%,77% 46%,79% 82%,76% 82%,74.5% 50%,73.5% 50%,72% 82%)'],
    ['#7a5f3a', 'polygon(0 80%,100% 76%,100% 100%,0 100%)'],
  ] },
  urban: { bg: 'linear-gradient(180deg,#56616b 0%,#8d959a 55%,#a9aaa2 70%,#5c5f5a 100%)', layers: [
    ['#5f6a72', 'polygon(0 56%,7% 56%,7% 40%,18% 40%,18% 50%,27% 50%,27% 30%,31% 24%,35% 30%,35% 48%,48% 48%,48% 36%,60% 36%,60% 52%,70% 52%,70% 42%,84% 42%,84% 32%,93% 32%,93% 54%,100% 54%,100% 100%,0 100%)'],
    ['#30363b', 'polygon(0 100%,0 44%,5% 40%,9% 47%,14% 42%,24% 42%,24% 100%)'],
    ['#272c30', 'polygon(62% 100%,62% 50%,68% 46%,74% 52%,80% 44%,100% 44%,100% 100%,94% 100%,94% 78%,91% 72%,88% 78%,88% 100%,82% 100%,82% 78%,79% 72%,76% 78%,76% 100%,70% 100%,70% 78%,67% 72%,64% 78%,64% 100%)'],
    ['#1e2225', 'polygon(24% 50%,62% 54%,62% 57%,24% 53%)'],
    ['radial-gradient(circle at 8% 60%,#e8a628 0 1.6%,transparent 2%),radial-gradient(circle at 17% 72%,#e8a628 0 1.6%,transparent 2%),radial-gradient(circle at 90% 56%,#e8a628 0 1.6%,transparent 2%)'],
    ['#3d403b', 'polygon(0 88%,100% 88%,100% 100%,0 100%)'],
  ] },
  port: { bg: 'linear-gradient(180deg,#34304f 0%,#8a4a4a 34%,#e08f45 56%,#f2b65c 60%,#1c2b38 61%,#101b24 100%)', layers: [
    ['radial-gradient(circle at 28% 50%,#ffe6a8 0 5%,rgba(255,214,140,.4) 6% 12%,transparent 13%)'],
    ['rgba(242,182,92,.3)', 'polygon(23% 62%,33% 62%,40% 90%,16% 90%)'],
    ['#161a1f', 'polygon(58% 90%,58% 18%,40% 22%,40% 19%,58% 13%,61% 13%,90% 19%,90% 22%,61% 18%,61% 90%)'],
    ['#161a1f', 'polygon(80% 21%,81% 21%,81% 40%,83% 40%,83% 46%,78% 46%,78% 40%,80% 40%)'],
    ['#8f3b2b', 'polygon(64% 90%,64% 74%,84% 74%,84% 90%)'],
    ['#2c6170', 'polygon(84% 90%,84% 74%,100% 74%,100% 90%)'],
    ['#c18a2e', 'polygon(70% 74%,70% 60%,92% 60%,92% 74%)'],
    ['#4a5a3a', 'polygon(0 90%,0 72%,22% 72%,22% 90%)'],
    ['#22262a', 'polygon(0 90%,100% 90%,100% 100%,0 100%)'],
  ] },
  bunker: { bg: 'radial-gradient(ellipse at 50% 46%,#4a5046 0%,#262a23 45%,#0d0f0b 100%)', layers: [
    ['#1c2019', 'polygon(0 0,34% 34%,34% 60%,0 100%)'],
    ['#20241c', 'polygon(100% 0,66% 34%,66% 60%,100% 100%)'],
    ['#151812', 'polygon(0 0,100% 0,66% 34%,34% 34%)'],
    ['#2b3027', 'polygon(0 100%,34% 60%,66% 60%,100% 100%)'],
    ['#0a0c08', 'polygon(42% 36%,58% 36%,58% 60%,42% 60%)'],
    ['#c9d6c0', 'polygon(46% 5%,54% 5%,52.5% 14%,47.5% 14%)'],
    ['radial-gradient(circle at 50% 30%,#ff6a4d 0 2.5%,rgba(224,73,47,.35) 3% 16%,transparent 17%)'],
    ['repeating-linear-gradient(135deg,#e8a628 0 7px,#181407 7px 14px)', 'polygon(0 92%,100% 92%,100% 100%,0 100%)'],
  ] },
  snow: { bg: 'linear-gradient(180deg,#7fa3bf 0%,#c4d8e4 52%,#eaf1f4 100%)', layers: [
    ['#8ea6b6', 'polygon(0 60%,12% 40%,22% 52%,38% 22%,52% 50%,64% 36%,80% 56%,100% 36%,100% 100%,0 100%)'],
    ['#f4f8fa', 'polygon(38% 22%,44% 34%,40% 32%,37% 36%,33% 31%)'],
    ['#f4f8fa', 'polygon(12% 40%,16% 45%,12% 44%,9% 46%)'],
    ['#f4f8fa', 'polygon(100% 36%,100% 46%,96% 42%,93% 44%)'],
    ['#dfe9ee', 'polygon(0 72%,26% 60%,44% 70%,56% 70%,74% 58%,100% 66%,100% 100%,0 100%)'],
    ['#51697a', 'polygon(44% 70%,56% 70%,53% 100%,47% 100%)'],
    ['#5a4630', 'polygon(40% 67%,60% 67%,60% 70%,40% 70%)'],
    ['#27443a', 'polygon(6% 90%,11% 56%,16% 90%)'],
    ['#2f5145', 'polygon(15% 94%,19% 66%,23% 94%)'],
    ['#27443a', 'polygon(80% 90%,86% 50%,92% 90%)'],
    ['#2f5145', 'polygon(90% 94%,94% 64%,98% 94%)'],
    ['#f5f8f9', 'polygon(0 90%,40% 86%,47% 100%,0 100%)'],
    ['#f5f8f9', 'polygon(53% 100%,60% 86%,100% 90%,100% 100%)'],
  ] },
  random: { bg: 'repeating-linear-gradient(135deg,rgba(232,166,40,.13) 0 12px,transparent 12px 24px),#171a13', layers: [], glyph: '?' },
  refinery: { bg: 'linear-gradient(180deg,#2a2630 0%,#a4624a 42%,#f6b062 58%,#3e3430 60%,#1f1b1c 100%)', layers: [['#4a403a', 'polygon(12% 60%,12% 30%,22% 30%,22% 60%)'], ['#5a4e46', 'polygon(40% 60%,40% 44%,74% 44%,74% 60%)']] },
  cite: { bg: 'linear-gradient(180deg,#5a6470 0%,#c8b494 46%,#dcc49c 54%,#6a6052 62%,#3e3a32 100%)', layers: [['#4a4c52', 'polygon(18% 64%,18% 24%,21% 19%,26% 19%,29% 24%,29% 64%)'], ['#3c3f46', 'polygon(56% 64%,56% 15%,62% 10%,68% 15%,68% 64%)'], ['#d4a32a', 'polygon(77% 64%,77.6% 21%,78.6% 21%,79.2% 64%)'], ['#d4a32a', 'polygon(50% 21%,94% 21%,94% 22.6%,50% 22.6%)'], ['#6e655a', 'polygon(0 70%,12% 60%,38% 62%,50% 57%,84% 62%,100% 59%,100% 100%,0 100%)']] },
  marsh: { bg: 'linear-gradient(180deg,#6e7470 0%,#a9ab9a 40%,#c4c0a8 52%,#7d7f62 58%,#3e4234 100%)', layers: [['#8a8c78', 'polygon(0 56%,30% 50%,60% 53%,100% 49%,100% 60%,0 62%)'], ['#4a5236', 'polygon(0 70%,100% 66%,100% 100%,0 100%)'], ['#7a5446', 'polygon(10% 58%,10% 44%,30% 44%,30% 58%)'], ['#5e4636', 'polygon(20% 44%,20% 26%,23% 26%,23% 44%)'], ['#6b5a42', 'polygon(56% 64%,56% 46%,62% 40%,68% 46%,68% 64%)'], ['#4a3a2c', 'polygon(57% 64%,57.5% 74%,58.5% 74%,59% 64%)'], ['#4a3a2c', 'polygon(65% 64%,65.5% 74%,66.5% 74%,67% 64%)'], ['#b49a5a', 'polygon(0 100%,4% 72%,6% 100%,9% 70%,12% 100%,16% 74%,18% 100%)'], ['#a88e52', 'polygon(80% 100%,84% 70%,86% 100%,90% 72%,93% 100%,96% 68%,100% 100%)']] },
  mineval: { bg: 'linear-gradient(180deg,#3d6a9a 0%,#b8cad6 44%,#e6eaea 52%,#7a7766 60%,#4a483c 100%)', layers: [['#8c8f88', 'polygon(0 60%,18% 30%,34% 52%,52% 22%,70% 48%,86% 28%,100% 50%,100% 100%,0 100%)'], ['#eef2f6', 'polygon(14% 36%,18% 30%,22% 36%)'], ['#eef2f6', 'polygon(47% 29%,52% 22%,57% 29%)'], ['#7a7f84', 'polygon(8% 63%,20% 55%,32% 63%)'], ['#7a7f84', 'polygon(44% 59%,55% 50%,66% 59%)'], ['#5a4a3a', 'polygon(10% 78%,10% 62%,30% 62%,30% 70%,46% 70%,46% 58%,64% 58%,64% 68%,84% 68%,84% 60%,94% 60%,94% 80%)'], ['#6a4a32', 'polygon(73% 60%,75% 34%,77% 34%,79% 60%)'], ['#6b6656', 'polygon(0 82%,100% 78%,100% 100%,0 100%)']] },  hillside: { bg: 'linear-gradient(180deg,#3f7aae 0%,#a9cbdc 42%,#efe3c8 56%,#b59a70 60%,#7a6647 100%)', layers: [['#c9b48a', 'polygon(0 58%,22% 40%,46% 52%,72% 36%,100% 54%,100% 100%,0 100%)'], ['#e4d3ae', 'polygon(8% 74%,8% 54%,26% 54%,26% 62%,44% 62%,44% 48%,62% 48%,62% 60%,82% 60%,82% 52%,94% 52%,94% 76%)'], ['#b5623d', 'polygon(6% 55%,17% 47%,28% 55%)'], ['#a8553a', 'polygon(42% 49%,53% 40%,64% 49%)'], ['#b5623d', 'polygon(80% 53%,88% 46%,96% 53%)'], ['radial-gradient(ellipse at 53% 70%,#2a221a 0 4%,transparent 4.5%)'], ['#8f7a58', 'polygon(0 78%,100% 74%,100% 100%,0 100%)']] },  valley: { bg: 'linear-gradient(180deg,#56738c 0%,#c4d2d4 50%,#6d6a4a 62%,#3f4034 100%)', layers: [['#5c6450', 'polygon(0 62%,24% 30%,48% 54%,70% 24%,100% 58%,100% 100%,0 100%)'], ['#8a6a3a', 'polygon(0 82%,40% 72%,100% 80%,100% 100%,0 100%)']] },
  gorge: { bg: 'linear-gradient(180deg,#4b6f93 0%,#a9bccb 40%,#cfd6d8 50%,#6f6c60 56%,#3c3b34 100%)', layers: [['#5e5c56', 'polygon(0 30%,22% 38%,30% 62%,30% 100%,0 100%)'], ['#55534d', 'polygon(100% 28%,78% 36%,70% 62%,70% 100%,100% 100%)'], ['#9a9890', 'polygon(28% 52%,72% 52%,72% 60%,28% 60%)'], ['#7d7b72', 'polygon(30% 60%,70% 60%,66% 82%,34% 82%)'], ['#33464a', 'polygon(34% 82%,66% 82%,70% 100%,30% 100%)']] },
  airbase: { bg: 'linear-gradient(180deg,#2c64a0 0%,#8fbedb 52%,#dbe6e6 62%,#57534a 63%,#3f3d38 100%)', layers: [['#6d7068', 'polygon(8% 63%,8% 46%,38% 46%,38% 63%)'], ['#8a8c84', 'polygon(62% 63%,62% 30%,72% 30%,72% 63%)']] },
  unknown: { bg: 'linear-gradient(180deg,#3d4431,#1c2016)', layers: [['#2a2f21', 'polygon(0 70%,30% 58%,62% 66%,100% 54%,100% 100%,0 100%)']] },
};

/* ---------- silhouettes d’armes (SVG statique, formes originales) ---------- */
const GUNS = {
  p9: '<path d="M70 22h96v18H70z"/><path d="M166 26h7v9h-7z"/><path d="M78 40h82v6l-42 2H78z"/><path d="M78 40h30l-8 36H72z"/><path d="M106 48h24v9q0 7-7 7h-17v-4h15q5 0 5-5v-3h-20z"/><path d="M74 18h7v4h-7zM157 18h5v4h-5z"/>',
  ar: '<path d="M6 30l44-4v18l-20 4-24 2z"/><path d="M50 24h80v20H50z"/><path d="M130 27h56v14h-56z"/><path d="M186 31h40v5h-40z"/><path d="M226 29h8v9h-8z"/><path d="M196 21h4v10h-4z"/><path d="M70 18h40v6H70z"/><path d="M84 44h14l-6 24H78z"/><path d="M106 44h20l8 28-18 2z"/>',
  smg: '<path d="M20 28h44v5H26v19h-6z"/><path d="M64 24h70v20H64z"/><path d="M134 27h36v13h-36z"/><path d="M170 31h18v5h-18z"/><path d="M74 19h9v5h-9zM150 21h5v6h-5z"/><path d="M76 44h14l-6 22H70z"/><path d="M104 44h13v32h-13z"/>',
  sg: '<path d="M6 34l54-8v18L6 52z"/><path d="M60 25h50v19H60z"/><path d="M110 26h118v7H110z"/><path d="M110 35h96v7h-96z"/><rect x="134" y="33" width="42" height="14" rx="3"/><path d="M62 44h16l-8 18-14-2z"/><path d="M222 22h4v4h-4z"/>',
  lmg: '<path d="M4 28l42-2v20L4 50z"/><path d="M46 22h78v24H46z"/><path d="M70 14h30v8H70z"/><path d="M124 26h60v12h-60z"/><path d="M184 30h46v5h-46z"/><path d="M228 28h8v9h-8z"/><path d="M78 46h34v24H78z"/><path d="M54 46h14l-6 20H50z"/><path d="M186 35h4l-12 37h-4zM192 35h4l12 37h-4z"/>',
  sr: '<path d="M4 34l26-6h40v16l-30 2-36 8z"/><path d="M70 28h56v14H70z"/><path d="M126 32h104v5H126z"/><path d="M228 30h8v9h-8z"/><rect x="66" y="12" width="72" height="10" rx="4"/><path d="M132 10h12v14h-12zM60 11h8v12h-8z"/><path d="M80 22h5v6h-5zM116 22h5v6h-5z"/><path d="M96 42h16v14H96z"/><path d="M60 44h14l-8 18-12-2z"/><path d="M170 37h4l-10 33h-4z"/>',
};

/* Silhouettes des armes sans dessin dédié : formes simples originales, ou le dessin de l’arme la plus proche. */
const GUNS_X = {
  rl: '<path d="M16 30h172v16H16z"/><path d="M4 26h14v24H4z"/><path d="M188 26h20l16 12-16 12h-20z"/><path d="M98 46h13l-5 22H91z"/><path d="M122 19h22v11h-22z"/><path d="M50 46h32v8H50z"/>',
  gl: '<path d="M6 30l40-4v17L6 51z"/><path d="M46 24h72v20H46z"/><circle cx="106" cy="50" r="18"/><path d="M118 25h82v13h-82z"/><path d="M60 44h14l-6 24H54z"/><path d="M188 18h5v7h-5zM64 18h20v6H64z"/>',
  xbow: '<path d="M10 35h152v10H10z"/><path d="M150 8c30 6 44 18 46 32-2 14-16 26-46 32v-7c22-6 34-15 36-25-2-10-14-19-36-25z"/><path d="M158 12h3v56h-3z"/><path d="M60 45h14l-6 22H54z"/><rect x="70" y="21" width="52" height="9" rx="4"/><path d="M84 30h5v5h-5zM106 30h5v5h-5z"/>',
  knife: '<path d="M102 31h92l28 9-28 9h-92z"/><path d="M94 25h8v30h-8z"/><rect x="34" y="31" width="60" height="18" rx="7"/>',
  frag: '<ellipse cx="118" cy="48" rx="24" ry="27"/><path d="M107 12h22v11h-22z"/><path d="M129 13h18l7 36h-6l-5-28h-14z"/><path d="M94 46h48v4H94zM116 22h4v52h-4z" opacity=".35"/><circle cx="97" cy="17" r="7" fill="none" stroke="currentColor" stroke-width="3"/>',
};
Object.assign(GUNS_X, {
  mach: '<path d="M96 33l70-5 44 3 14 10-20 7-108 1z"/><rect x="34" y="32" width="62" height="17" rx="7"/><path d="M34 34l-12 8 10 6z"/>',
  axe: '<rect x="20" y="36" width="186" height="9" rx="4"/><path d="M168 36c2-12 8-22 16-28 12 4 24 14 28 30-8 14-20 24-30 28-8-8-13-18-14-30z"/><path d="M160 36l-16-10 4 10z"/>',
  crow: '<rect x="30" y="36" width="170" height="8" rx="4"/><path d="M196 36c10-1 18-8 22-20l6 3c-3 16-14 26-26 27z"/><path d="M34 36l-16-7-3 6 15 9z"/><rect x="44" y="33" width="52" height="14" rx="6"/>',
});
const GUN_ALIAS = { hp: 'p9', rev: 'p9', mp: 'p9', car: 'ar', akr: 'ar', brst: 'ar', bat: 'ar', pdw: 'smg', hsmg: 'smg', asg: 'sg', dbs: 'sg', mini: 'lmg', dmr: 'sr', hsr: 'sr',
  bpc: 'ar', cqc: 'ar', hbr: 'ar', ssr: 'ar', dsmg: 'smg', ssmg: 'smg', fsmg: 'smg', lsg: 'sg', dsg: 'sg', sawn: 'sg', bplmg: 'lmg', dlmg: 'lmg', lsr: 'sr', asr: 'sr', scout: 'sr', bp: 'p9', p22: 'p9', lsp: 'p9' };

const CSS = `
.fzm{--bg:#0d0f0b;--panel:rgba(24,27,19,.88);--line:rgba(201,185,143,.18);--line-2:rgba(201,185,143,.38);--sand:#d8c9a3;--dim:#a5a18a;--white:#f4ecd8;--amber:#e8a628;--amber-2:#ffc041;--ink:#181407;--red:#e0492f;--green:#9cc264;--blue:#7fa9d6;--pad:clamp(16px,2.4vw,40px);
position:fixed;inset:0;z-index:10;display:flex;flex-direction:column;min-width:0;color:var(--sand);font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:19px;line-height:1.25;text-align:left;overflow:hidden;user-select:none;-webkit-user-select:none;
background:radial-gradient(1100px 620px at 84% -8%,rgba(232,166,40,.13),transparent 62%),radial-gradient(900px 600px at -6% 108%,rgba(143,179,90,.08),transparent 60%),linear-gradient(180deg,rgba(18,21,14,.97),rgba(9,11,7,.97))}
.fzm[hidden],.fzm [hidden]{display:none!important}
.fzm::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(201,185,143,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(201,185,143,.035) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:linear-gradient(180deg,#000,transparent 88%);mask-image:linear-gradient(180deg,#000,transparent 88%)}
.fzm :where(*,*::before,*::after){box-sizing:border-box;margin:0;padding:0}
.fzm :where(button,select,input){font:inherit;color:inherit}
.fzm :where(button){background:none;border:0;cursor:pointer}
.fzm :where(:focus-visible){outline:2px solid var(--white);outline-offset:3px}
.fzm-main:focus,.fzm-main:focus-visible{outline:none}
.fzm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}

.fzm-top{position:relative;flex:none;display:flex;align-items:center;gap:clamp(12px,2vw,36px);min-height:72px;padding:0 var(--pad);border-bottom:1px solid var(--line);background:rgba(8,10,6,.55)}
.fzm-logo{flex:none;font-size:30px;font-weight:800;letter-spacing:.08em;line-height:1;color:var(--white);white-space:nowrap}
.fzm-logo b{color:var(--amber);font-weight:800}
.fzm-nav{display:flex;align-self:stretch;flex:1;min-width:0;gap:2px}
.fzm-tab{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 clamp(10px,1.2vw,20px);font-size:19px;font-weight:600;letter-spacing:.1em;color:var(--dim);white-space:nowrap;transition:color .12s}
.fzm-tab::after{content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:3px;background:var(--amber);transform:scaleX(0);transform-origin:left;transition:transform .16s ease-out}
.fzm-tab:hover{color:var(--sand)}
.fzm-tab[aria-current=page]{color:#fff}
.fzm-tab[aria-current=page]::after{transform:scaleX(1)}
.fzm-tab:focus-visible{outline-offset:-5px}
.fzm-tab-dot{width:8px;height:8px;background:var(--green);border-radius:50%}
.fzm-id{display:flex;align-items:center;justify-content:flex-end;gap:clamp(10px,1.6vw,26px);flex:none;min-width:0}
.fzm-rank{display:grid;gap:5px;flex:0 1 190px;min-width:0}
.fzm-rank-line{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:17px;font-weight:600;white-space:nowrap}
.fzm-rank-line b{overflow:hidden;text-overflow:ellipsis;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--white)}
.fzm-rank-line span{flex:none;font-weight:700;color:var(--amber)}
.fzm-xp{height:4px;background:rgba(255,255,255,.13)}
.fzm-xp i{display:block;height:100%;background:var(--amber);transition:width .4s ease-out}
.fzm-xp-text{font-size:13px;font-weight:600;letter-spacing:.08em;color:var(--dim);white-space:nowrap}
.fzm-cr{display:flex;align-items:baseline;gap:6px;flex:none;padding:5px 14px;border:1px solid var(--line);background:rgba(0,0,0,.28);white-space:nowrap}
.fzm-cr b{font-size:25px;font-weight:700;line-height:1.1;color:var(--amber);font-variant-numeric:tabular-nums}
.fzm-cr span{font-size:17px;font-weight:600;color:var(--dim)}

.fzm-main{position:relative;flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(201,185,143,.3) transparent}
.fzm-main--flush{overflow:hidden}
.fzm-wrap{max-width:1680px;margin:0 auto;padding:clamp(16px,2.2vw,34px) var(--pad) clamp(20px,3vw,44px)}
.fzm-enter{animation:fzm-in .18s ease-out both}
@keyframes fzm-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes fzm-fade{from{opacity:0}to{opacity:1}}
@keyframes fzm-pop{0%{opacity:0;transform:scale(.86)}60%{opacity:1;transform:scale(1.04)}100%{opacity:1;transform:none}}
@keyframes fzm-spin{to{transform:rotate(360deg)}}
.fzm-settings{height:100%}

.fzm-title{font-size:clamp(34px,3vw,50px);font-weight:800;letter-spacing:.05em;line-height:1;color:var(--white);text-transform:uppercase}
.fzm-note{max-width:760px;margin:8px 0 clamp(16px,2vw,28px);font-size:19px;color:var(--dim)}
.fzm-h{display:flex;align-items:center;gap:10px;margin-bottom:12px;font-size:15px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--amber)}
.fzm-h::before{content:"";flex:none;width:8px;height:8px;background:var(--amber);clip-path:polygon(0 0,100% 0,100% 100%)}
.fzm-h span{margin-left:auto;font-size:15px;letter-spacing:.08em;color:var(--dim)}

.fzm-btn{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:8px 20px;font-size:18px;font-weight:700;letter-spacing:.09em;line-height:1.1;text-transform:uppercase;text-align:center;color:var(--white);transition:color .12s,transform .08s}
.fzm-btn::before,.fzm-btn::after{content:"";position:absolute;z-index:-1;clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);transition:background .12s}
.fzm-btn::before{inset:0;background:var(--line-2)}
.fzm-btn::after{inset:1px;background:#171a11}
.fzm-btn:hover:not(:disabled){color:#fff}
.fzm-btn:hover:not(:disabled)::before{background:var(--amber)}
.fzm-btn:hover:not(:disabled)::after{background:#22200f}
.fzm-btn:active:not(:disabled){transform:translateY(1px)}
.fzm-btn:disabled{cursor:not-allowed;color:var(--dim)}
.fzm-btn:disabled::before{background:var(--line)}
.fzm-btn--primary{color:var(--ink)}
.fzm-btn--primary::before,.fzm-btn--primary::after{background:var(--amber)}
.fzm-btn--primary:hover:not(:disabled){color:var(--ink)}
.fzm-btn--primary:hover:not(:disabled)::before,.fzm-btn--primary:hover:not(:disabled)::after{background:var(--amber-2)}
.fzm-btn--primary:disabled{color:var(--dim)}
.fzm-btn--primary:disabled::before,.fzm-btn--primary:disabled::after{background:#3a3524}
.fzm-btn--on:disabled{color:var(--amber);cursor:default}
.fzm-btn--on:disabled::before{background:var(--amber)}
.fzm-btn--on:disabled::after{background:#1d1b0f}
.fzm-btn--danger:hover:not(:disabled)::before{background:var(--red)}
.fzm-btn--danger:hover:not(:disabled)::after{background:#26130f}
.fzm-btn--block{display:flex;width:100%}
.fzm-btn--sm{min-height:38px;padding:5px 14px;font-size:16px}
.fzm-cta{min-height:70px;font-size:31px;font-weight:800;letter-spacing:.13em}
.fzm-cta::before,.fzm-cta::after{clip-path:polygon(0 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%)}
.fzm-link{min-height:40px;padding:6px 4px;font-size:16px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--amber)}
.fzm-link:hover{color:var(--amber-2);text-decoration:underline;text-underline-offset:4px}

.fzm-tag{display:inline-block;flex:none;padding:1px 8px;font-size:13px;font-weight:700;letter-spacing:.12em;line-height:1.4;text-transform:uppercase;white-space:nowrap;color:var(--dim);border:1px solid currentColor}
.fzm-tag--team,.fzm-tag--special{color:var(--blue)}
.fzm-tag--coop{color:var(--green)}
.fzm-tag--ffa{color:var(--sand)}
.fzm-tag--elite{color:#ef8a66}
.fzm-tag--legend{color:var(--ink);background:var(--amber);border-color:var(--amber)}
.fzm-tag--host{color:var(--amber)}
.fzm-tag--you{color:var(--white)}

.fzm-seg{display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr;border:1px solid var(--line-2);background:rgba(0,0,0,.28)}
.fzm-seg button{min-height:42px;padding:6px 12px;font-size:17px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-align:center;white-space:nowrap;color:var(--dim);transition:background .12s,color .12s}
.fzm-seg button+button{border-left:1px solid var(--line)}
.fzm-seg button:hover{color:var(--white)}
.fzm-seg button[aria-checked=true]{background:var(--amber);color:var(--ink)}
.fzm-seg button:focus-visible{outline-offset:-4px}
.fzm-seg button[aria-checked=true]:focus-visible{outline-color:var(--ink)}
.fzm-seg--big button{min-height:52px;padding:8px clamp(16px,2vw,34px);font-size:22px;letter-spacing:.1em}
.fzm-seg--block{display:grid}

.fzm-play-head{display:flex;align-items:center;flex-wrap:wrap;gap:12px 22px;margin-bottom:clamp(16px,1.8vw,26px)}
.fzm-chip{display:inline-flex;align-items:center;gap:8px;font-size:17px;font-weight:600;color:var(--dim)}
.fzm-chip i{width:9px;height:9px;border-radius:50%;background:var(--green)}
.fzm-play-grid{display:grid;grid-template-columns:minmax(270px,.95fr) minmax(0,2fr) minmax(300px,390px);gap:clamp(16px,1.8vw,28px);align-items:start}
.fzm-col{min-width:0}
.fzm-side{position:sticky;top:0;display:grid;gap:14px;min-width:0}
.fzm-modes{display:grid;gap:8px}
.fzm-opt{position:relative;display:block;width:100%;padding:11px 14px 12px 18px;text-align:left;background:var(--panel);border:1px solid var(--line);transition:border-color .12s,background .12s}
.fzm-opt::before{content:"";position:absolute;left:-1px;top:-1px;bottom:-1px;width:4px;background:var(--amber);transform:scaleY(0);transition:transform .14s ease-out}
.fzm-opt:hover{border-color:var(--line-2)}
.fzm-opt[aria-checked=true]{border-color:var(--amber);background:rgba(232,166,40,.1)}
.fzm-opt[aria-checked=true]::before{transform:scaleY(1)}
.fzm-opt-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px 10px}
.fzm-opt-name{font-size:23px;font-weight:700;letter-spacing:.03em;line-height:1.1;text-transform:uppercase;color:var(--white)}
.fzm-opt-desc{display:block;margin-top:4px;font-size:16px;line-height:1.2;color:var(--dim)}
.fzm-maps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.fzm-map{position:relative;display:flex;flex-direction:column;min-width:0;text-align:left;background:var(--panel);border:1px solid var(--line);transition:border-color .12s,transform .12s}
.fzm-map:hover{border-color:var(--line-2)}
.fzm-map[aria-checked=true]{border-color:var(--amber);box-shadow:0 0 0 1px var(--amber)}
.fzm-map[aria-checked=true]::after{content:"";position:absolute;top:0;right:0;width:26px;height:26px;background:var(--amber);clip-path:polygon(0 0,100% 0,100% 100%)}
.fzm-thumb{position:relative;display:block;width:100%;aspect-ratio:16/8;overflow:hidden;background:#171a13}
.fzm-thumb i{position:absolute;inset:0;display:block}
.fzm-thumb img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .18s ease-out}
.fzm-thumb img.is-on{opacity:1}
.fzm-thumb::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(10,12,8,.5))}
.fzm-thumb b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:clamp(34px,4vw,60px);font-weight:800;color:var(--amber)}
.fzm-map .fzm-tag{position:absolute;top:8px;left:8px;z-index:1;color:var(--white);background:rgba(10,12,8,.8);border-color:transparent}
.fzm-map-body{display:block;padding:10px 12px 12px}
.fzm-map-name{display:block;font-size:21px;font-weight:700;letter-spacing:.03em;line-height:1.1;text-transform:uppercase;color:var(--white)}
.fzm-map-desc{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;margin-top:4px;font-size:15px;line-height:1.2;color:var(--dim)}

.fzm-panel{display:grid;gap:16px;min-width:0;padding:18px;background:var(--panel);border:1px solid var(--line)}
.fzm-panel .fzm-h{margin-bottom:0}
.fzm-sum{display:grid;grid-template-columns:116px minmax(0,1fr);gap:8px 14px;align-items:center}
.fzm-sum .fzm-thumb{aspect-ratio:16/10;border:1px solid var(--line)}
.fzm-sum .fzm-thumb b{font-size:30px}
.fzm-wake{display:block;margin-left:8px;opacity:0;animation:fzm-wake .25s 5s forwards}
@keyframes fzm-wake{to{opacity:1}}
@media (prefers-reduced-motion:reduce){.fzm-wake{animation:none;opacity:1}}
.fzm-sum-map{display:block;font-size:25px;font-weight:700;line-height:1.05;text-transform:uppercase;color:var(--white)}
.fzm-sum-mode{display:block;margin-top:3px;font-size:17px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--amber)}
.fzm-sum-desc{grid-column:1/-1;font-size:16px;line-height:1.25;color:var(--dim)}
.fzm-field{display:grid;gap:8px;min-width:0}
.fzm-label{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:15px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.fzm-label b{font-size:24px;line-height:1;letter-spacing:0;color:var(--white);font-variant-numeric:tabular-nums}
.fzm-label small{font-size:14px;font-weight:600;letter-spacing:.06em;text-transform:none}
.fzm-step{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;gap:10px;align-items:center}
.fzm-step button{height:44px;border:1px solid var(--line-2);font-size:26px;font-weight:700;line-height:1;text-align:center;color:var(--white);transition:border-color .12s,background .12s}
.fzm-step button:hover{border-color:var(--amber);background:rgba(232,166,40,.1)}
.fzm-step input[type=range]{width:100%;height:32px;accent-color:var(--amber);cursor:pointer;background:transparent}
.fzm-load{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:12px;align-items:center;padding-top:16px;border-top:1px solid var(--line)}
.fzm-load canvas{display:block;width:54px;height:54px;border:1px solid var(--line-2)}
.fzm-load small{display:block;font-size:14px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.fzm-load-text{display:block;font-size:18px;font-weight:600;line-height:1.2;color:var(--white)}
.fzm-cta-wrap{display:grid;gap:8px;min-width:0;position:sticky;bottom:0;z-index:2;margin-top:-12px;padding:12px 0 10px;background:linear-gradient(to bottom,rgba(13,15,11,0),rgba(13,15,11,.97) 12px)}
.fzm-hint{font-size:16px;color:var(--dim)}

.fzm-input,.fzm-select{width:100%;min-height:46px;padding:8px 12px;font-size:20px;font-weight:600;color:var(--white);background:rgba(0,0,0,.38);border:1px solid var(--line-2);border-radius:0}
.fzm-input{user-select:text;-webkit-user-select:text}
.fzm-input::placeholder{color:rgba(165,161,138,.6);font-weight:500}
.fzm-input:focus-visible,.fzm-select:focus-visible{outline:2px solid var(--amber);outline-offset:0;border-color:var(--amber)}
.fzm-input--code{padding-left:calc(12px + .3em);font-size:24px;font-weight:700;letter-spacing:.3em;text-align:center;text-transform:uppercase}
.fzm-input--code::placeholder{font-size:17px;letter-spacing:.04em;text-transform:none}
.fzm-select{background:#14170f;color-scheme:dark;cursor:pointer}
.fzm-joinrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
.fzm-or{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}
.fzm-or::before,.fzm-or::after{content:"";flex:1;height:1px;background:var(--line)}
.fzm-alert{display:grid;gap:8px;justify-items:start;padding:10px 12px;font-size:17px;line-height:1.25;color:#f6d3ca;background:rgba(224,73,47,.11);border:1px solid rgba(224,73,47,.55);border-left:4px solid var(--red)}
.fzm-status{display:flex;align-items:center;gap:10px;font-size:17px;color:var(--sand)}
.fzm-spin{flex:none;width:14px;height:14px;border:2px solid var(--line-2);border-top-color:var(--amber);border-radius:50%;animation:fzm-spin .8s linear infinite}

.fzm-lobby-head{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:10px 20px;margin-bottom:clamp(14px,1.6vw,24px)}
.fzm-lobby-sub{font-size:19px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--amber)}
.fzm-lobby-grid{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr) minmax(290px,380px);gap:clamp(14px,1.6vw,24px);align-items:start}
.fzm-code{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 14px}
.fzm-code-val{font-size:clamp(40px,3.6vw,56px);font-weight:800;letter-spacing:.2em;line-height:1;color:var(--white);user-select:all;-webkit-user-select:all}
.fzm-callout{display:grid;gap:8px;justify-items:start;padding:12px 14px;font-size:18px;line-height:1.25;color:var(--white);background:rgba(232,166,40,.1);border-left:4px solid var(--amber)}
.fzm-callout small{font-size:15px;color:var(--sand)}
.fzm-addr{max-width:100%;font-family:Consolas,'Courier New',monospace;font-size:15px;color:var(--amber);overflow-wrap:anywhere;user-select:all;-webkit-user-select:all}
.fzm-roster{display:grid;gap:12px;container-type:inline-size}
.fzm-teams{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@container (max-width:600px){.fzm-teams{grid-template-columns:minmax(0,1fr)}}
.fzm-team{min-width:0;border:1px solid var(--line);background:rgba(0,0,0,.18)}
.fzm-team-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:50px;padding:6px 8px 6px 14px;border-bottom:1px solid var(--line);font-size:19px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--white)}
.fzm-team--a .fzm-team-head{box-shadow:inset 4px 0 var(--blue)}
.fzm-team--b .fzm-team-head{box-shadow:inset 4px 0 var(--red)}
.fzm-player{display:flex;align-items:center;gap:10px;min-width:0;min-height:48px;padding:6px 12px 6px 14px;border-top:1px solid var(--line)}
.fzm-player:first-child{border-top:0}
.fzm-dot{flex:none;width:10px;height:10px;background:rgba(255,255,255,.2)}
.fzm-player.is-ready .fzm-dot{background:var(--green)}
.fzm-player-name{flex:0 1 auto;min-width:3ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:21px;font-weight:600;color:var(--white)}
.fzm-player.is-you .fzm-player-name{color:var(--amber)}
.fzm-player-cls{flex:none;font-size:15px;color:var(--dim)}
.fzm-state{flex:none;margin-left:auto;font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;color:var(--dim)}
.fzm-player.is-ready .fzm-state{color:var(--green)}
.fzm-empty{padding:12px 14px;font-size:16px;color:var(--dim)}
.fzm-lobby-actions{display:grid;gap:10px}

.fzm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:14px}
.fzm-card{position:relative;display:flex;flex-direction:column;gap:10px;min-width:0;padding:18px;background:var(--panel);border:1px solid var(--line);transition:border-color .12s}
.fzm-card:hover{border-color:var(--line-2)}
.fzm-card.is-on{border-color:var(--amber);background:linear-gradient(180deg,rgba(232,166,40,.1),rgba(24,27,19,.88) 55%)}
.fzm-card.is-on::after{content:"";position:absolute;top:-1px;right:-1px;width:24px;height:24px;background:var(--amber);clip-path:polygon(0 0,100% 0,100% 100%)}
.fzm-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:26px;padding-right:14px}
.fzm-card h3{font-size:28px;font-weight:700;letter-spacing:.03em;line-height:1.05;color:var(--white)}
.fzm-card p{font-size:17px;line-height:1.25;color:var(--dim)}
.fzm-price{font-size:20px;font-weight:700;white-space:nowrap;color:var(--amber);font-variant-numeric:tabular-nums}
.fzm-price.is-owned{font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:var(--green)}
.fzm-wbody{display:grid;gap:10px;min-width:0}
.fzm-gun{display:flex;align-items:center;justify-content:center;height:78px;color:#c9bb93;background:linear-gradient(180deg,rgba(0,0,0,.3),rgba(0,0,0,.12));border:1px solid var(--line)}
.fzm-gun svg{display:block;width:min(92%,250px);height:64px;fill:currentColor}
.fzm-card.is-on .fzm-gun{color:var(--amber)}
.fzm-gun{position:relative;overflow:hidden}
.fzm-card .fzm-gun{height:116px}
.fzm-gun img{position:absolute;inset:2px;width:calc(100% - 4px);height:calc(100% - 4px);object-fit:contain;opacity:0;transition:opacity .16s;pointer-events:none}
.fzm-card .fzm-gun img{inset:auto;left:2px;top:-11%;height:122%}
.fzm-gun.has-shot img{opacity:1}
.fzm-gun.has-shot svg{visibility:hidden}
.fzm-stats{display:grid;gap:7px}
.fzm-stat{display:grid;grid-template-columns:92px minmax(0,1fr) 56px;align-items:center;gap:10px;font-size:16px;color:var(--dim)}
.fzm-stat i{position:relative;display:block;height:7px;background:rgba(255,255,255,.1)}
.fzm-stat i u{display:block;height:100%;background:var(--sand);text-decoration:none}
.fzm-stat i::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(10% - 2px),rgba(13,15,11,.92) calc(10% - 2px) 10%)}
.fzm-card.is-on .fzm-stat i u{background:var(--amber)}
.fzm-stat b{font-weight:600;text-align:right;white-space:nowrap;color:var(--white);font-variant-numeric:tabular-nums}
.fzm-meta{display:flex;flex-wrap:wrap;gap:2px 18px;font-size:15px;color:var(--dim)}
.fzm-meta b{font-weight:600;color:var(--sand)}
.fzm-slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px;margin-bottom:6px}
.fzm-slot{display:grid;grid-template-columns:84px minmax(0,1fr);gap:12px;align-items:center;min-width:0;padding:8px 12px;background:var(--panel);border:1px solid var(--line-2)}
.fzm-slot .fzm-gun{height:46px;color:var(--amber)}
.fzm-slot .fzm-gun svg{height:38px}
.fzm-slot small{display:block;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--amber)}
.fzm-slot b{display:block;font-size:21px;font-weight:700;line-height:1.1;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fzm-slot span{display:block;font-size:14px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fzm-cat{margin-top:clamp(18px,2.4vw,30px)}
.fzm-cat-head{display:flex;align-items:baseline;gap:12px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--line-2)}
.fzm-cat-head h3{font-size:clamp(22px,2vw,29px);font-weight:800;letter-spacing:.08em;line-height:1.1;text-transform:uppercase;color:var(--white)}
.fzm-cat-head span{font-size:14px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.fzm-load-sub{display:block;margin-top:2px;font-size:15px;line-height:1.2;color:var(--dim)}
.fzm-card-foot{display:grid;gap:6px;margin-top:auto;padding-top:6px}
.fzm-short{font-size:15px;font-weight:600;text-align:center;color:#ee9a86}
.fzm-camo{display:block;width:100%;height:auto;aspect-ratio:16/7;border:1px solid var(--line)}
.fzm-trait{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--green)}
.fzm-trait::before{content:"";width:8px;height:8px;background:var(--green)}

.fzm-layer{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,6,4,.74);animation:fzm-fade .14s ease-out both}
.fzm-dialog{display:grid;gap:14px;width:min(100%,470px);padding:24px;background:#15180f;border:1px solid var(--line-2);border-top:3px solid var(--amber);box-shadow:0 24px 60px rgba(0,0,0,.6);animation:fzm-in .16s ease-out both}
.fzm-dialog h3{font-size:29px;font-weight:800;letter-spacing:.04em;line-height:1.05;text-transform:uppercase;color:var(--white)}
.fzm-dialog p{font-size:20px;color:var(--white)}
.fzm-dialog small{display:block;font-size:17px;color:var(--dim)}
.fzm-dialog-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:6px}
.fzm-toast{position:absolute;left:50%;bottom:22px;z-index:6;max-width:calc(100% - 32px);padding:10px 20px;font-size:18px;font-weight:600;text-align:center;color:var(--white);background:#1b1f14;border:1px solid var(--amber);box-shadow:0 10px 30px rgba(0,0,0,.5);pointer-events:none;opacity:0;transform:translate(-50%,10px);transition:opacity .16s,transform .16s}
.fzm-toast.is-on{opacity:1;transform:translate(-50%,0)}

.fzm-end{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(14px,2.4vh,28px);min-height:100%;padding:clamp(20px,4vh,48px) 16px;text-align:center}
.fzm-end-eyebrow{font-size:16px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--dim)}
.fzm-end-title{max-width:100%;font-size:clamp(50px,9vw,132px);font-weight:800;letter-spacing:.02em;line-height:.9;text-transform:uppercase;overflow-wrap:anywhere;color:var(--white)}
.fzm-end.is-won .fzm-end-title{color:var(--amber)}
.fzm-end.is-lost .fzm-end-title{color:#ec8068}
.fzm-end-state{padding:3px 16px;font-size:18px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;border:1px solid currentColor;color:var(--sand)}
.fzm-end.is-won .fzm-end-state{color:var(--green)}
.fzm-end.is-lost .fzm-end-state{color:#ec8068}
.fzm-end-stats{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;width:100%;max-width:1040px}
.fzm-end-stat{flex:1 1 130px;max-width:220px;padding:12px 18px;background:var(--panel);border:1px solid var(--line)}
.fzm-end-stat b{display:block;font-size:40px;font-weight:800;line-height:1.05;color:#fff;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.fzm-end-stat span{font-size:15px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.fzm-reward{display:grid;gap:14px;width:min(100%,640px);padding:18px 20px;text-align:left;background:var(--panel);border:1px solid var(--line)}
.fzm-reward .fzm-h{margin-bottom:0}
.fzm-reward-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.fzm-gain b{display:block;font-size:40px;font-weight:800;line-height:1;color:var(--amber);font-variant-numeric:tabular-nums}
.fzm-gain span{font-size:15px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.fzm-lvl{display:grid;gap:7px}
.fzm-lvl-line{display:flex;justify-content:space-between;gap:12px;font-size:18px;font-weight:600;color:var(--white)}
.fzm-lvl-line span:last-child{color:var(--dim);font-variant-numeric:tabular-nums}
.fzm-lvl-bar{height:10px;background:rgba(255,255,255,.12)}
.fzm-lvl-bar i{display:block;height:100%;background:var(--amber);transition:width .7s cubic-bezier(.2,.7,.2,1)}
.fzm-lvl-bar i.is-snap{transition:none}
.fzm-levelup{padding:8px 14px;font-size:23px;font-weight:800;letter-spacing:.12em;text-align:center;text-transform:uppercase;color:var(--ink);background:var(--amber);animation:fzm-pop .5s cubic-bezier(.2,1.3,.4,1) both}
.fzm-levelup[hidden]{display:none}
.fzm-end-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;width:min(100%,640px)}
.fzm-end-actions .fzm-btn{flex:1 1 240px;min-height:58px;font-size:22px}

@media (min-width:1500px){.fzm-map-desc{-webkit-line-clamp:3}}
@media (min-width:1700px) and (min-height:900px){
.fzm{font-size:20px}
.fzm-thumb{aspect-ratio:16/9}
.fzm-opt{padding:15px 18px 16px 22px}
.fzm-opt-name{font-size:26px}
.fzm-opt-desc,.fzm-map-desc,.fzm-sum-desc{font-size:17px}
.fzm-map-name{font-size:24px}
.fzm-map-body{padding:12px 14px 16px}
.fzm-modes{gap:10px}
.fzm-maps{gap:14px}
.fzm-panel{padding:22px;gap:20px}
.fzm-card{padding:22px;gap:12px}
.fzm-grid{grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px}
.fzm-grid--guns{grid-template-columns:repeat(3,minmax(0,1fr))}
.fzm-wbody{grid-template-columns:minmax(0,.8fr) minmax(0,1fr);gap:18px;align-items:center}
.fzm-wbody .fzm-gun{height:100%;min-height:118px}
.fzm-stat{font-size:17px}
.fzm-card p{font-size:18px}
}
@media (min-width:1181px) and (max-height:840px){
.fzm-side .fzm-sum-desc,.fzm-play .fzm-cta-wrap .fzm-hint{display:none}
.fzm-side>.fzm-panel{gap:13px;padding-top:14px;padding-bottom:14px}
}
@media (max-width:1180px){
.fzm-play-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr)}
.fzm-side{display:contents}
.fzm-side>.fzm-panel{grid-column:1/-1}
.fzm-play--multi .fzm-side>.fzm-panel{order:-1}
.fzm-cta-wrap{grid-column:1/-1;position:sticky;bottom:0;z-index:2;margin:0 calc(var(--pad) * -1);padding:10px var(--pad) 12px;background:rgba(10,12,8,.96);border-top:1px solid var(--line)}
.fzm-cta-wrap .fzm-hint{display:none}
.fzm-toast{top:10px;bottom:auto}
.fzm-lobby-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.3fr)}
.fzm-lobby-grid>.fzm-panel:last-child{grid-column:1/-1}
.fzm-lobby-actions .fzm-hint{display:block}
}
@media (max-width:1560px){
.fzm-top{gap:clamp(10px,1.2vw,22px)}
.fzm-logo{font-size:26px}
.fzm-tab{padding:0 clamp(6px,.62vw,12px);font-size:17px;letter-spacing:.07em}
.fzm-tab::after{left:6px;right:6px}
.fzm-id{gap:12px}
.fzm-rank{flex-basis:150px}
}
@media (max-width:1120px){
.fzm-top{flex-wrap:wrap;gap:6px 12px;min-height:0;padding-top:10px}
.fzm-logo{font-size:25px}
.fzm-id{flex:1}
.fzm-nav{order:3;flex:1 0 100%;flex-wrap:wrap}
.fzm-tab{flex:1 1 auto;padding:0 8px;font-size:17px;letter-spacing:.06em}
}
@media (max-width:900px){
.fzm{font-size:18px}
.fzm-top{flex-wrap:wrap;gap:6px 12px;min-height:0;padding-top:10px}
.fzm-logo{font-size:25px}
.fzm-id{flex:1}
.fzm-nav{order:3;flex:1 0 100%;flex-wrap:wrap}
.fzm-tab{flex:1 1 auto;padding:0 8px;font-size:17px;letter-spacing:.06em}
.fzm-tab::after{left:6px;right:6px}
}
@media (max-width:760px){
.fzm-play-grid,.fzm-lobby-grid{grid-template-columns:minmax(0,1fr)}
.fzm-maps{grid-template-columns:repeat(2,minmax(0,1fr))}
.fzm-seg--big{display:grid;width:100%}
.fzm-cta{min-height:60px;font-size:26px}
.fzm-end-stat b{font-size:32px}
}
@media (max-width:520px){
.fzm-logo{font-size:22px}
.fzm-rank{flex-basis:120px}
.fzm-rank-line{font-size:15px;gap:6px}
.fzm-xp-text{display:none}
.fzm-cr{padding:3px 9px}
.fzm-cr b{font-size:20px}
.fzm-cr span{font-size:15px}
.fzm-tab{flex-basis:30%;min-height:40px;font-size:16px;letter-spacing:.04em}
.fzm-teams{grid-template-columns:minmax(0,1fr)}
.fzm-panel,.fzm-card{padding:14px}
.fzm-sum{grid-template-columns:92px minmax(0,1fr)}
.fzm-map-name{font-size:19px}
.fzm-reward-row{gap:8px}
.fzm-gain b{font-size:32px}
.fzm-dialog{padding:18px}
}
@media (prefers-reduced-motion:reduce){.fzm *,.fzm *::before,.fzm *::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
`;

function injectCss() {
  if (document.getElementById('fzm-style')) return;
  const style = document.createElement('style');
  style.id = 'fzm-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

/* La police du jeu est chargée par la page hôte ; si elle ne l’a pas déclarée, on ajoute la même feuille que index.html. */
function ensureFont() {
  try {
    if (document.querySelector('link[href*="Barlow+Condensed"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&display=swap';
    link.setAttribute('data-fzm', '');
    document.head.appendChild(link);
  } catch { /* la police de repli suffit */ }
}

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value') el.value = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  }
  return el;
}

const format = (text, params) => (params ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k] ?? '') : m)) : String(text));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hex = n => '#' + ((n >>> 0) & 0xffffff).toString(16).padStart(6, '0');

function seeded(str) {
  let a = 2166136261;
  for (let i = 0; i < str.length; i++) { a ^= str.charCodeAt(i); a = Math.imul(a, 16777619); }
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Aperçu de camouflage : taches organiques tirées des trois couleurs de la tenue (résultat stable par tenue). */
function drawCamo(canvas, outfit) {
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch { /* pas de canvas 2D */ }
  if (!ctx || !outfit || !Array.isArray(outfit.c)) return;
  const w = canvas.width, hh = canvas.height, rnd = seeded('camo:' + outfit.id), unit = Math.min(w, hh);
  const cols = outfit.c.map(hex);
  ctx.fillStyle = cols[0];
  ctx.fillRect(0, 0, w, hh);
  const blobs = (color, count, size) => {
    ctx.fillStyle = color;
    for (let n = 0; n < count; n++) {
      const cx = rnd() * w, cy = rnd() * hh, r = unit * size * (0.6 + rnd() * 0.9), pts = [];
      const steps = 9, stretch = 1.2 + rnd() * 0.9, rot = rnd() * Math.PI;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2, rr = r * (0.55 + rnd() * 0.75);
        const px = Math.cos(a) * rr * stretch, py = Math.sin(a) * rr;
        pts.push([cx + px * Math.cos(rot) - py * Math.sin(rot), cy + px * Math.sin(rot) + py * Math.cos(rot)]);
      }
      ctx.beginPath();
      for (let i = 0; i < steps; i++) {
        const p = pts[i], q = pts[(i + 1) % steps], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        if (i === 0) ctx.moveTo(mx, my);
        const r2 = pts[(i + 2) % steps];
        ctx.quadraticCurveTo(q[0], q[1], (q[0] + r2[0]) / 2, (q[1] + r2[1]) / 2);
      }
      ctx.closePath();
      ctx.fill();
    }
  };
  blobs(cols[1] || cols[0], Math.round(w / 26), 0.34);
  blobs(cols[2] || cols[0], Math.round(w / 40), 0.26);
  blobs(cols[0], Math.round(w / 60), 0.2);
  const shade = ctx.createLinearGradient(0, 0, 0, hh);
  shade.addColorStop(0, 'rgba(255,255,255,.07)');
  shade.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, hh);
}

export function createMenu(rootEl, deps = {}) {
  if (!rootEl) throw new Error('createMenu: rootEl manquant');
  const { settings, i18n, profile, net, audio, engine } = deps;
  const onPlay = typeof deps.onPlay === 'function' ? deps.onPlay : null;
  const MAPS = Array.isArray(deps.MAPS) && deps.MAPS.length ? deps.MAPS : FALLBACK_MAPS;
  const MODES = Array.isArray(deps.MODES) && deps.MODES.length ? deps.MODES : DATA_MODES;
  const uid = 'fzm' + Math.random().toString(36).slice(2, 7);

  injectCss();
  ensureFont();

  /* ---------- textes ---------- */
  const lang = () => (i18n && LANGS.includes(i18n.lang) ? i18n.lang : 'fr');
  const T = (key, params) => (i18n ? i18n.t(key, params) : key);
  const hasKey = key => !!i18n && i18n.t(key) !== key;
  const L = (key, params) => {
    const row = LOCAL[key];
    if (!row) return T(key, params);
    return format(row[LANGS.indexOf(lang())] || row[0], params);
  };
  /* Nœud traduit par i18n.apply (data-i18n) quand la clé vient de i18n.js. */
  const tx = (key, params) => ({ 'data-i18n': key, 'data-i18n-params': params ? JSON.stringify(params) : null, text: T(key, params) });
  const num = n => { try { return Number(n).toLocaleString(lang()); } catch { return String(n); } };
  const modeName = m => (m && hasKey(MODE_KEY[m.id]) ? T(MODE_KEY[m.id]) : (m && (m.name || m.id)) || '');
  const modeDesc = m => {
    if (!m) return '';
    if (lang() === 'fr' && m.desc) return m.desc;
    return LOCAL['m.modeDesc.' + m.id] ? L('m.modeDesc.' + m.id) : (m.desc || '');
  };
  const modeTag = m => (m && m.coop ? ['coop', L('m.tagCoop')] : m && m.teams ? ['team', L('m.tagTeams')] : ['ffa', L('m.tagFfa')]);
  const mapOf = id => byId(MAPS, id);
  const mapName = id => {
    if (id === 'random') return L('m.random');
    if (hasKey('map.' + id)) return T('map.' + id);
    const m = mapOf(id);
    return (m && m.name) || String(id || '');
  };
  const mapDesc = id => {
    if (id === 'random') return L('m.randomDesc');
    const m = mapOf(id);
    if (lang() === 'fr' && m && m.desc) return m.desc;
    return LOCAL['m.mapDesc.' + id] ? L('m.mapDesc.' + id) : (m && m.desc) || '';
  };
  const envName = env => (LOCAL['m.env.' + env] ? L('m.env.' + env) : String(env || ''));
  const outfitName = o => (o ? (hasKey('outfit.' + o.id) ? T('outfit.' + o.id) : o.name) : '');
  const className = c => (c ? (hasKey(`class.${c.id}.name`) ? T(`class.${c.id}.name`) : c.name) : '');
  const classDesc = c => (hasKey(`class.${c.id}.desc`) ? T(`class.${c.id}.desc`) : c.d || '');
  const weaponType = w => (hasKey('weaponType.' + w.id) ? T('weaponType.' + w.id) : w.type || '');
  const rankName = level => { const k = 'rank.' + Math.min(Math.max(level, 1) - 1, 9); return hasKey(k) ? T(k) : (profile && profile.rank) || ''; };

  /* ---------- état ---------- */
  const st = {
    screen: 'play', playMode: 'solo', mode: MODES[0].id, map: MAPS[0].id, bots: 7, difficulty: 'normal',
    room: null, pending: null, netError: null, joinCode: '', lastCode: null, lastIntent: null, leaving: false,
    deploying: false, lastCfg: null, end: null,
  };
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (raw && typeof raw === 'object') {
      if (MODES.some(m => m.id === raw.mode)) st.mode = raw.mode;
      if (raw.map === 'random' || mapOf(raw.map)) st.map = raw.map;
      if (Number.isFinite(raw.bots)) st.bots = clamp(Math.round(raw.bots), 0, 11);
      if (DIFFICULTIES.includes(raw.difficulty)) st.difficulty = raw.difficulty;
      if (raw.playMode === 'multi' || raw.playMode === 'solo') st.playMode = raw.playMode;
    }
  } catch { /* préférences illisibles : valeurs par défaut */ }
  const savePrefs = () => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ mode: st.mode, map: st.map, bots: st.bots, difficulty: st.difficulty, playMode: st.playMode })); } catch { /* stockage indisponible */ }
  };

  let visible = false, destroyed = false, shownKey = null, settingsOff = null, dialog = null;
  let pointerDown = false, renderPending = false, toastTimer = 0, deployTimer = 0, connTimer = 0, endGuardUntil = 0, sentLoadout = '', xpAtHide = null, muteProfile = false;
  const endTimers = [];
  const offs = [];

  /* ---------- structure fixe ---------- */
  const top = h('header', { class: 'fzm-top' });
  const main = h('main', { class: 'fzm-main', tabindex: '-1' });
  const toastEl = h('div', { class: 'fzm-toast', role: 'status', 'aria-live': 'polite' });
  const root = h('div', { class: 'fzm', hidden: true }, top, main, toastEl);
  rootEl.append(root);

  const attLang = () => (i18n && i18n.lang) || 'fr';
  const sfx = kind => { try { if (audio && typeof audio[kind] === 'function') audio[kind](); } catch { /* audio facultatif */ } };
  const unlockAudio = () => { try { if (audio && typeof audio.unlock === 'function') audio.unlock(); } catch { /* audio facultatif */ } };

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
  }

  /* ---------- petits composants ---------- */
  const heading = (text, extra) => h('h3', { class: 'fzm-h' }, text, extra ? h('span', { text: extra }) : null);
  const tag = (kind, text) => h('span', { class: `fzm-tag fzm-tag--${kind}`, text });
  function button(cls, fid, label, onclick, extra) {
    return h('button', { type: 'button', class: `fzm-btn ${cls || ''}`, 'data-fid': fid, onclick, ...(extra || {}) }, label);
  }
  /* Vraie image de la carte (map-shots/<id>.webp, à côté de ce module : marche depuis la racine et depuis play/), posée sur le dessin
     d'environnement qui reste en secours. Le menu se reconstruit à chaque choix : on retient ce qui a chargé (pas de clignotement) ou échoué (pas de nouvelle requête). */
  const shotOk = new Set(), shotBad = new Set();
  function thumb(env, mapId) {
    const def = THUMBS[env] || THUMBS.unknown;
    const el = h('span', { class: 'fzm-thumb', 'aria-hidden': 'true', style: `background:${def.bg}` });
    for (const [bg, clip] of def.layers) el.append(h('i', { style: `background:${bg}${clip ? `;clip-path:${clip}` : ''}` }));
    if (def.glyph) el.append(h('b', { text: def.glyph }));
    if (mapId && mapOf(mapId) && !shotBad.has(mapId)) {
      const img = document.createElement('img'), known = shotOk.has(mapId);
      img.alt = ''; img.width = 960; img.height = 540; img.loading = known ? 'eager' : 'lazy'; img.decoding = known ? 'sync' : 'async';
      if (known) img.className = 'is-on';
      img.addEventListener('load', () => { shotOk.add(mapId); img.classList.add('is-on'); });
      img.addEventListener('error', () => { shotOk.delete(mapId); shotBad.add(mapId); img.remove(); });
      img.src = new URL(`map-shots/${encodeURIComponent(mapId)}.webp`, import.meta.url).href;
      el.append(img);
    }
    return el;
  }
  function camo(outfit, w, hh, cls) {
    const c = h('canvas', { class: cls || 'fzm-camo', width: w, height: hh, 'aria-hidden': 'true' });
    drawCamo(c, outfit);
    return c;
  }
  /* Vraie image de l'arme (weapon-shots/<id>.webp, rendu studio de son modèle 3D, voir .handoff/weapon-shots/capture.cjs), posée sur le dessin qui reste en secours. */
  const gunOk = new Set(), gunBad = new Set();
  const gunShotUrl = id => new URL(`weapon-shots/${encodeURIComponent(id)}.webp`, import.meta.url).href;
  const gunDrawing = id => `<svg viewBox="0 0 240 80" focusable="false">${GUNS[id] || GUNS_X[id] || GUNS[GUN_ALIAS[id]] || GUNS.ar}</svg>`;
  function gun(id) {
    const box = h('div', { class: 'fzm-gun', 'aria-hidden': 'true' });
    box.innerHTML = gunDrawing(id);
    if (id && !gunBad.has(id)) {
      const img = document.createElement('img'), known = gunOk.has(id);
      img.alt = ''; img.width = 720; img.height = 360; img.draggable = false; img.loading = known ? 'eager' : 'lazy'; img.decoding = known ? 'sync' : 'async';
      if (known) box.classList.add('has-shot');
      img.addEventListener('load', () => { gunOk.add(id); box.classList.add('has-shot'); });
      img.addEventListener('error', () => { gunOk.delete(id); gunBad.add(id); box.classList.remove('has-shot'); img.remove(); });
      img.src = gunShotUrl(id);
      box.append(img);
    }
    return box;
  }
  function stat(label, pct, value) {
    return h('div', { class: 'fzm-stat' }, label, h('i', null, h('u', { style: `width:${clamp(Math.round(pct), 4, 100)}%` })), h('b', { text: value }));
  }
  /* Groupe de boutons radio : une seule tabulation, flèches pour changer, sélection immédiate. */
  function radios(name, label, value, options, pick, cls) {
    const group = h('div', { class: cls, role: 'radiogroup', 'aria-label': label });
    const any = options.some(o => o.id === value);
    options.forEach((o, i) => {
      const on = o.id === value;
      group.append(h('button', {
        type: 'button', class: o.cls || null, role: 'radio', 'aria-checked': on ? 'true' : 'false', tabindex: on || (!any && i === 0) ? '0' : '-1',
        'data-fid': `${name}:${o.id}`, onclick: () => { if (o.id !== value) { sfx('ui'); pick(o.id); } },
      }, o.kids));
    });
    group.addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step && e.key !== 'Home' && e.key !== 'End') return;
      const els = [...group.querySelectorAll('[role=radio]')], cur = els.indexOf(document.activeElement);
      if (cur < 0) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? els.length - 1 : (cur + step + els.length) % els.length;
      els[next].focus();
      els[next].click();
    });
    return group;
  }

  /* ---------- dialogue de confirmation ---------- */
  function closeDialog() {
    if (!dialog) return;
    const d = dialog;
    dialog = null;
    d.layer.remove();
    top.inert = false;
    main.inert = false;
    const back = d.fid && root.querySelector(`[data-fid="${d.fid}"]`);
    if (back && !back.disabled) back.focus({ preventScroll: true }); else main.focus({ preventScroll: true });
  }
  function openDialog({ title, body, confirmLabel, onConfirm }) {
    closeDialog();
    const active = document.activeElement;
    const fid = active && root.contains(active) ? active.getAttribute('data-fid') : null;
    const titleId = `${uid}-dlg`;
    const cancel = button('', null, T('common.cancel'), () => { sfx('ui'); closeDialog(); });
    const ok = button('fzm-btn--primary', null, confirmLabel || T('common.confirm'), () => { closeDialog(); onConfirm(); });
    const box = h('div', { class: 'fzm-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, h('h3', { id: titleId, text: title }), body,
      h('div', { class: 'fzm-dialog-actions' }, cancel, ok));
    const layer = h('div', { class: 'fzm-layer' }, box);
    layer.addEventListener('mousedown', e => { if (e.target === layer) closeDialog(); });
    layer.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const els = [cancel, ok], i = els.indexOf(document.activeElement);
      e.preventDefault();
      els[(i + (e.shiftKey ? els.length - 1 : 1)) % els.length].focus();
    });
    top.inert = true;
    main.inert = true;
    root.append(layer);
    dialog = { layer, fid };
    ok.focus();
  }

  /* ---------- rendu ---------- */
  function scheduleRender() {
    if (!visible || destroyed) return;
    if (pointerDown) { renderPending = true; return; }
    render();
  }

  function render() {
    if (destroyed || !visible) return;
    renderPending = false;
    const active = document.activeElement;
    const inside = active && root.contains(active) && !(dialog && dialog.layer.contains(active));
    const fid = inside ? active.getAttribute('data-fid') : null;
    const caret = fid && active.tagName === 'INPUT' && active.type === 'text' ? [active.selectionStart, active.selectionEnd] : null;
    const key = st.screen === 'play' ? `play:${st.playMode}:${st.playMode === 'multi' && st.room ? 'lobby' : 'pick'}` : st.screen;
    const entering = key !== shownKey;
    const scroll = entering ? 0 : main.scrollTop;
    shownKey = key;

    const isEnd = st.screen === 'end';
    top.hidden = isEnd;
    if (!isEnd) renderTop();

    if (st.screen === 'settings') {
      if (!settingsOff) {
        main.textContent = '';
        main.className = 'fzm-main fzm-main--flush';
        const box = h('div', { class: 'fzm-settings fzm-enter' });
        main.append(box);
        try { settingsOff = settings && typeof settings.mount === 'function' ? settings.mount(box) : null; } catch (err) { console.error('[menu] settings.mount', err); }
        if (!settingsOff) settingsOff = () => {};
      }
    } else {
      unmountSettings();
      main.className = 'fzm-main';
      const view = st.screen === 'arsenal' ? viewArsenal() : st.screen === 'outfits' ? viewOutfits() : st.screen === 'classes' ? viewClasses()
        : isEnd ? viewEnd() : viewPlay();
      if (entering) view.classList.add('fzm-enter');
      main.textContent = '';
      main.append(view);
      main.scrollTop = scroll;
    }
    if (i18n && typeof i18n.apply === 'function' && st.screen !== 'settings') i18n.apply(main);
    if (i18n && typeof i18n.apply === 'function' && !isEnd) i18n.apply(top);

    if (fid) {
      const el = root.querySelector(`[data-fid="${fid}"]`);
      if (el && !el.disabled) {
        el.focus({ preventScroll: true });
        if (caret && el.tagName === 'INPUT') { try { el.setSelectionRange(caret[0], caret[1]); } catch { /* type sans sélection */ } }
      } else if (inside) main.focus({ preventScroll: true });
    } else if (entering && !dialog && (!active || active === document.body || (root.contains(active) && !active.isConnected))) {
      main.focus({ preventScroll: true });
    }
    if (isEnd) runEndAnimation();
  }

  function unmountSettings() {
    if (!settingsOff) return;
    const off = settingsOff;
    settingsOff = null;
    try { off(); } catch (err) { console.error('[menu] settings destroy', err); }
  }

  function go(screen, opts) {
    st.screen = screen;
    if (opts && opts.playMode) { st.playMode = opts.playMode; savePrefs(); }
    render();
  }

  /* ---------- en-tête ---------- */
  const NAV = [['play', 'nav.play'], ['arsenal', 'nav.arsenal'], ['shop', 'nav.shop'], ['pass', 'nav.pass'], ['outfits', 'nav.outfits'], ['classes', 'nav.classes'], ['settings', 'nav.settings']];
  /* Passe de saison : son propre écran (pass.js, pass-ui.js), chargé au clic. Une erreur ici ne touche jamais le menu. */
  let passBusy = false;
  async function openSeasonPass() {
    if (passBusy) return; passBusy = true;
    try { const m = await import('./pass.js'); const s = await m.openPass({ onChange: () => { if (st.room) syncLoadout(st.room); scheduleRender(); }, onClose: () => { passBusy = false; scheduleRender(); } }); if (!s) passBusy = false; }
    catch (err) { passBusy = false; console.error('[menu] pass', err); }
  }
  /* Boutique : son propre écran (shop-ui.js), chargé au premier clic. Une erreur ici ne touche jamais le menu. */
  let shopBusy = false;
  async function openStore() {
    if (shopBusy) return; shopBusy = true;
    try { const m = await import('./shop-ui.js'); await m.openShop({ engine, profile, i18n, settings, sfx, weaponType, outfitName, onChange: () => { if (st.room) syncLoadout(st.room); scheduleRender(); }, onClose: () => { shopBusy = false; scheduleRender(); } }); }
    catch (err) { shopBusy = false; console.error('[menu] shop', err); }
  }
  function renderTop() {
    const P = profile.data, level = profile.level, into = P.xp % XP_PER_LEVEL;
    const nav = h('nav', { class: 'fzm-nav', 'aria-label': L('m.navLabel') });
    for (const [id, key] of NAV) {
      nav.append(h('button', {
        type: 'button', class: 'fzm-tab', 'data-fid': `nav:${id}`, 'aria-current': st.screen === id ? 'page' : null,
        onclick: () => { if (id === 'shop') { sfx('ui'); openStore(); return; } if (id === 'pass') { sfx('ui'); openSeasonPass(); return; } if (st.screen !== id) { sfx('ui'); go(id); } },
      }, h('span', tx(key)), id === 'play' && st.room ? h('i', { class: 'fzm-tab-dot', title: L('m.inRoom', { code: st.room.code }) }) : null));
    }
    nav.addEventListener('keydown', e => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step && e.key !== 'Home' && e.key !== 'End') return;
      const els = [...nav.querySelectorAll('.fzm-tab')], cur = els.indexOf(document.activeElement);
      if (cur < 0) return;
      e.preventDefault();
      els[e.key === 'Home' ? 0 : e.key === 'End' ? els.length - 1 : (cur + step + els.length) % els.length].focus();
    });
    top.textContent = '';
    top.append(
      h('h1', { class: 'fzm-logo' }, 'FRONT ', h('b', { text: 'ZÉRO' })),
      nav,
      h('div', { class: 'fzm-id' },
        h('div', { class: 'fzm-rank' },
          h('div', { class: 'fzm-rank-line' }, h('b', { text: rankName(level) }), h('span', tx('menu.level', { n: level }))),
          h('div', { class: 'fzm-xp', role: 'progressbar', 'aria-label': L('m.xp'), 'aria-valuemin': '0', 'aria-valuemax': String(XP_PER_LEVEL), 'aria-valuenow': String(into) },
            h('i', { style: `width:${(into / XP_PER_LEVEL) * 100}%` })),
          h('div', { class: 'fzm-xp-text', text: `${num(into)} / ${num(XP_PER_LEVEL)} XP` })),
        h('div', { class: 'fzm-cr', 'aria-label': `${T('end.credits')} : ${num(P.cr)}` }, h('b', { text: num(P.cr) }), h('span', { text: '₡' }))),
    );
  }

  /* ---------- accueil / jouer ---------- */
  const modesFor = multi => { const list = MODES.filter(m => (multi ? m.online !== false && !(m.id === 'zone' && net && net.connected && net.zoneOk === false) : m.solo !== false)); return list.length ? list : MODES; };       // an older server does not know the Zone mode
  const botRange = () => (st.mode === 'zombie' ? { min: 0, max: 3 } : { min: 1, max: 11 });
  const botCount = () => { const r = botRange(); return clamp(st.bots, r.min, r.max); };
  const randomMap = () => MAPS[Math.floor(Math.random() * MAPS.length)].id;

  function loadoutLine() {
    const P = profile.data, outfit = byId(OUTFITS, P.outfit), weapon = byId(WEAPONS, P.primary), cls = byId(CLASSES, P.cls);
    const sec = byId(WEAPONS, P.secondary), gear = byId(WEAPONS, P.gear), extra = [sec ? `${slotName(1)} : ${sec.name}` : '', gear ? `${slotName(2)} : ${gear.name}` : ''].filter(Boolean).join('  ·  ');
    return h('div', { class: 'fzm-load' },
      camo(outfit, 108, 108, 'fzm-load-camo'),
      h('div', null, h('small', { text: L('m.loadout') }),
        h('span', { class: 'fzm-load-text', text: T('menu.loadout', { cls: className(cls), weapon: weapon ? weapon.name : '', outfit: outfitName(outfit) }) }),
        extra ? h('span', { class: 'fzm-load-sub', 'data-fid-info': 'loadout-extra', text: extra }) : null),
      h('button', { type: 'button', class: 'fzm-link', 'data-fid': 'play:edit', onclick: () => { sfx('ui'); go('arsenal'); } }, L('m.edit')));
  }

  function viewPlay() {
    const multi = st.playMode === 'multi';
    if (multi && st.room) return viewLobby();
    const modes = modesFor(multi);
    if (!modes.some(m => m.id === st.mode)) st.mode = modes[0].id;
    const mode = byId(MODES, st.mode), mapEnv = st.map === 'random' ? 'random' : (mapOf(st.map) || {}).env;
    const [, tagText] = modeTag(mode);

    const modePicker = radios('mode', T('mode.title'), st.mode, modes.map(m => {
      const [kind, text] = modeTag(m);
      return { id: m.id, cls: 'fzm-opt', kids: [
        h('span', { class: 'fzm-opt-top' }, h('span', { class: 'fzm-opt-name', text: modeName(m) }), tag(kind, text)),
        h('span', { class: 'fzm-opt-desc', text: modeDesc(m) })] };
    }), id => { st.mode = id; savePrefs(); render(); }, 'fzm-modes');

    const mapItems = [...MAPS.map(m => ({ id: m.id, env: m.env, tag: envName(m.env) })), { id: 'random', env: 'random', tag: L('m.randomTag') }];
    const mapPicker = radios('map', T('lobby.map'), st.map, mapItems.map(m => ({ id: m.id, cls: 'fzm-map', kids: [
      thumb(m.env, m.id), tag('env', m.tag),
      h('span', { class: 'fzm-map-body' }, h('span', { class: 'fzm-map-name', text: mapName(m.id) }), h('span', { class: 'fzm-map-desc', text: mapDesc(m.id) }))] })),
    id => { st.map = id; savePrefs(); render(); }, 'fzm-maps');

    const summary = h('div', { class: 'fzm-sum' }, thumb(mapEnv, st.map),
      h('div', null, h('span', { class: 'fzm-sum-map', text: mapName(st.map) }), h('span', { class: 'fzm-sum-mode', text: `${modeName(mode)} · ${tagText}` })),
      h('p', { class: 'fzm-sum-desc', text: mapDesc(st.map) }));

    return h('div', { class: multi ? 'fzm-wrap fzm-play fzm-play--multi' : 'fzm-wrap fzm-play' },
      h('div', { class: 'fzm-play-head' },
        radios('playmode', `${T('mode.solo')} / ${T('mode.multiplayer')}`, st.playMode, [
          { id: 'solo', kids: h('span', tx('mode.solo')) }, { id: 'multi', kids: h('span', tx('mode.multiplayer')) },
        ], id => { st.playMode = id; savePrefs(); render(); }, 'fzm-seg fzm-seg--big')),
      h('div', { class: 'fzm-play-grid' },
        multi ? extPart('browser') : null,       // public rooms and quick play (online-ui.js): above the mode and map columns, the side panel keeps its place
        h('section', { class: 'fzm-col' }, heading(T('mode.title')), modePicker),
        h('section', { class: 'fzm-col' }, heading(T('lobby.map')), mapPicker),
        h('aside', { class: 'fzm-side' }, multi ? multiPanel(summary) : soloPanel(summary), multi ? multiCta() : soloCta())));
  }

  function soloPanel(summary) {
    const range = botRange(), value = botCount();
    const out = h('b', { text: String(value) });
    const slider = h('input', { type: 'range', min: String(range.min), max: String(range.max), step: '1', value: String(value), 'data-fid': 'play:bots', 'aria-label': L('m.bots') });
    const setBots = v => { st.bots = clamp(v, range.min, range.max); slider.value = String(st.bots); out.textContent = String(st.bots); savePrefs(); };
    slider.addEventListener('input', () => setBots(Number(slider.value)));
    return h('div', { class: 'fzm-panel' },
      heading(L('m.brief')), summary,
      st.mode === 'zone' ? null : h('div', { class: 'fzm-field' },       // Zone sizes the match from the map
        h('div', { class: 'fzm-label' }, h('span', { text: st.mode === 'zombie' ? L('m.allies') : L('m.bots') }), out),
        h('div', { class: 'fzm-step' },
          h('button', { type: 'button', 'data-fid': 'play:bots-', 'aria-label': L('m.less'), onclick: () => { sfx('ui'); setBots(st.bots - 1); } }, '−'),
          slider,
          h('button', { type: 'button', 'data-fid': 'play:bots+', 'aria-label': L('m.more'), onclick: () => { sfx('ui'); setBots(st.bots + 1); } }, '+'))),
      h('div', { class: 'fzm-field' },
        h('div', { class: 'fzm-label' }, h('span', { text: L('m.difficulty') })),
        radios('diff', L('m.difficulty'), st.difficulty, DIFFICULTIES.map(d => ({ id: d, kids: L('m.diff.' + d) })),
          id => { st.difficulty = id; savePrefs(); render(); }, 'fzm-seg fzm-seg--block')),
      loadoutLine());
  }

  function soloCta() {
    return h('div', { class: 'fzm-cta-wrap' },
      button('fzm-btn--primary fzm-btn--block fzm-cta', 'play:deploy', st.deploying ? L('m.deploying') : h('span', tx('menu.deploy')), deploySolo, { disabled: st.deploying }));
  }

  function deploySolo() {
    if (st.deploying) return;
    launch({ mode: st.mode, map: st.map === 'random' ? randomMap() : st.map, online: false, bots: botCount(), difficulty: st.difficulty });
  }

  function launch(cfg) {
    st.lastCfg = cfg;
    st.deploying = true;
    sfx('ui');
    render();
    clearTimeout(deployTimer);
    deployTimer = setTimeout(() => { if (st.deploying) { st.deploying = false; scheduleRender(); } }, 8000);
    const fail = err => {
      console.error('[menu] onPlay', err);
      st.deploying = false;
      clearTimeout(deployTimer);
      if (visible) { toast(L('m.deployFail')); scheduleRender(); }
    };
    try {
      const result = onPlay ? onPlay({ ...cfg }) : null;
      if (result && typeof result.then === 'function') result.then(null, fail);
    } catch (err) { fail(err); }
  }

  /* ---------- multijoueur : connexion ---------- */
  const me = room => (room && Array.isArray(room.players) ? room.players.find(p => p.id === room.you) : null);
  const playerName = () => (profile.data.name || '').trim() || L('m.namePh');
  function commitName(input) {
    const el = input || root.querySelector('[data-fid="multi:name"]');
    /* Sans nouveau rendu : reconstruire le panneau pendant un changement de focus ferait perdre le champ suivant. */
    if (el && el.value !== profile.data.name) { muteProfile = true; try { profile.setName(el.value); } finally { muteProfile = false; } }
    if (el && el.value !== profile.data.name) el.value = profile.data.name;
  }
  function expectReply() {
    clearTimeout(connTimer);
    connTimer = setTimeout(() => { if (st.pending) { st.pending = null; st.netError = { code: 'connect_failed' }; scheduleRender(); } }, 9000);
  }
  function createRoom(opts) {       // opts (online-ui.js): {pub, bots, bz}; none = private room, as before
    if (!net || st.pending) return;
    commitName();
    const map = st.map === 'random' ? randomMap() : st.map;
    st.netError = null; st.pending = 'create'; st.lastIntent = { type: 'create', opts };
    expectReply();
    sfx('ui');
    net.createRoom({ name: playerName(), mode: st.mode, map, ...(opts || null) });
    render();
  }
  function joinRoom(raw, extra) {
    if (!net || st.pending) return;
    commitName();
    const code = String(raw || '').trim().toUpperCase();
    if (!/^[A-Z]{6}$/.test(code)) { st.netError = { code: 'bad_code' }; render(); return; }
    st.netError = null; st.pending = 'join'; st.lastIntent = { type: 'join', code };
    expectReply();
    sfx('ui');
    net.joinRoom(code, playerName(), extra);
    render();
  }
  function leaveRoom() {
    if (!net) return;
    st.leaving = !!net.connected;
    st.room = null; st.pending = null; st.netError = null; st.lastCode = null; sentLoadout = '';
    clearTimeout(connTimer);
    try { net.disconnect(); } catch { /* déjà fermé */ }
    sfx('ui');
    render();
  }
  function retryNet() {
    const code = st.lastCode || (st.lastIntent && st.lastIntent.type === 'join' && st.lastIntent.code);
    if (!code && st.lastIntent && typeof st.lastIntent.retry === 'function') { st.lastIntent.retry(); return; }       // quick play (online-ui.js)
    if (code) joinRoom(code); else createRoom(st.lastIntent && st.lastIntent.opts);
  }
  function syncLoadout(room) {
    const self = me(room);
    if (!net || !self || room.state !== 'lobby') return;
    const want = profile.data.cls, mark = `${room.code}:${want}`;
    if (self.cls === want || sentLoadout === mark) return;
    sentLoadout = mark;
    try { net.sendAction('loadout', { cls: want }); } catch { /* hors ligne */ }
  }
  function errorText(code) {
    switch (code) {
      case 'connect_failed': {
        let file = false; try { file = location.protocol === 'file:'; } catch { /* pas de location */ }
        if (file) return L('m.errFile');
        return L('m.errConnect') + (net && net.url ? ' ' + L('m.errTried', { url: net.url }) : '');
      }
      case 'lost': case 'not_connected': return T('lobby.disconnected');
      case 'room_not_found': return T('lobby.notFound');
      case 'room_full': return T('lobby.full');
      case 'server_full': return L('m.errServerFull');
      case 'bad_code': return L('m.errCode');
      case 'not_enough_players': return L('m.needPlayers');
      case 'players_not_ready': return L('m.needReady');
      case 'not_host': return L('m.hostOnly');
      case 'rate_limited': return L('m.errRate');
      case 'no_net': return L('m.errNoNet');
      default: return extPart('errorText', code) || L('m.errGeneric', { code });
    }
  }
  /* Online lobby extension (online-ui.js sets api.ext): public rooms, quick play, room options, bots. A failure there never breaks the menu. */
  function extPart(name, ...args) {
    try { const f = api.ext && api.ext[name]; return typeof f === 'function' ? f(...args) || null : null; } catch (err) { console.warn('[menu] ext', name, err); return null; }
  }
  function alertBox() {
    if (!st.netError) return null;
    const code = st.netError.code, canRetry = ['connect_failed', 'lost', 'not_connected'].includes(code) && (st.lastCode || st.lastIntent);
    return h('div', { class: 'fzm-alert', role: 'alert' }, h('span', { text: errorText(code) }),
      canRetry ? button('fzm-btn--sm', 'multi:retry', st.lastCode ? L('m.reconnect') : L('m.retry'), retryNet) : null);
  }
  function copyText(text, okMessage) {
    const fallback = () => {
      const ta = h('textarea', { style: 'position:absolute;left:-999px;top:0;opacity:0', 'aria-hidden': 'true', tabindex: '-1' });
      ta.value = text;
      root.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      toast(ok ? okMessage : L('m.copyFail'));
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(okMessage), fallback);
      else fallback();
    } catch { fallback(); }
  }

  function multiPanel(summary) {
    if (!net) return h('div', { class: 'fzm-panel' }, heading(T('mode.multiplayer')), h('div', { class: 'fzm-alert', role: 'alert', text: errorText('no_net') }));
    const busy = !!st.pending;
    const name = h('input', { class: 'fzm-input', type: 'text', id: `${uid}-name`, 'data-fid': 'multi:name', maxlength: '16', autocomplete: 'off', spellcheck: 'false',
      value: profile.data.name || '', placeholder: L('m.namePh') });
    name.addEventListener('change', () => commitName(name));
    const code = h('input', { class: 'fzm-input fzm-input--code', type: 'text', id: `${uid}-code`, 'data-fid': 'multi:code', maxlength: '6', autocomplete: 'off', autocapitalize: 'characters',
      spellcheck: 'false', value: st.joinCode, 'aria-describedby': `${uid}-codehelp`, 'data-i18n-attr': 'placeholder:lobby.codePlaceholder', placeholder: T('lobby.codePlaceholder') });
    code.addEventListener('input', () => {
      const clean = code.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6);
      if (clean !== code.value) code.value = clean;
      st.joinCode = clean;
    });
    const join = () => joinRoom(code.value);
    code.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); join(); } });
    name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commitName(name); } });
    return h('div', { class: 'fzm-panel' },
      heading(T('mode.multiplayer')), summary,
      h('div', { class: 'fzm-field' }, h('label', { class: 'fzm-label', for: `${uid}-name` }, h('span', tx('lobby.name'))), name),
      alertBox(),
      busy ? h('div', { class: 'fzm-status', role: 'status' }, h('i', { class: 'fzm-spin' }), h('span', tx('lobby.connecting')),
        document.querySelector('meta[name="fz-server"]') ? h('small', { class: 'fzm-wake', text: L('m.waking') }) : null) : null,
      h('div', { class: 'fzm-or', text: L('m.or') }),
      h('div', { class: 'fzm-field' },
        h('label', { class: 'fzm-label', for: `${uid}-code` }, h('span', tx('lobby.code')), h('small', { id: `${uid}-codehelp`, text: L('m.codeHelp') })),
        h('div', { class: 'fzm-joinrow' }, code, button('', 'multi:join', L('m.join'), join, { disabled: busy, 'aria-label': T('lobby.join') }))),
      loadoutLine());
  }

  function multiCta() {
    if (!net) return null;
    return h('div', { class: 'fzm-cta-wrap' },
      button('fzm-btn--primary fzm-btn--block fzm-cta', 'multi:create', h('span', tx('lobby.create')), () => { if (!extPart('create', createRoom)) createRoom(); }, { disabled: !!st.pending, style: 'font-size:clamp(22px,1.6vw,27px)' }),       // online-ui.js asks private or public first
      h('p', { class: 'fzm-hint', text: L('m.createHint') }));
  }

  /* ---------- multijoueur : salon ---------- */
  function playOnline(room) {
    const cfg = { mode: room.mode, map: room.map, online: true, net, room: (net && net.room) || room, bots: 0, difficulty: 'normal' };
    launch(cfg);
  }

  function viewLobby() {
    const room = st.room, self = me(room), isHost = !!self && room.hostId === self.id;
    const players = Array.isArray(room.players) ? room.players : [];
    const mode = byId(MODES, room.mode), teamMode = !!(mode && mode.teams), playing = room.state === 'playing';
    const others = players.filter(p => p.id !== room.hostId);
    const needPlayers = room.mode !== 'zombie' && room.mode !== 'zone' && players.length < 2, notReady = others.some(p => !p.ready);
    const env = (mapOf(room.map) || {}).env;

    const row = p => (p.bot ? extPart('botRow', p) : null) || h('div', { class: `fzm-player${p.ready || p.id === room.hostId ? ' is-ready' : ''}${self && p.id === self.id ? ' is-you' : ''}` },       // an online bot: its own row (online-ui.js)
      h('i', { class: 'fzm-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'fzm-player-name', text: p.name || '' }),
      self && p.id === self.id ? h('span', { class: 'fzm-tag fzm-tag--you', ...tx('hud.you') }) : null,
      p.id === room.hostId ? h('span', { class: 'fzm-tag fzm-tag--host', ...tx('lobby.host') }) : null,
      p.id === room.hostId ? null : h('span', { class: 'fzm-state', ...tx(p.ready ? 'lobby.ready' : 'lobby.notReady') }));
    const list = (items, emptyKey) => (items.length ? items.map(row) : h('div', { class: 'fzm-empty', ...tx(emptyKey || 'lobby.waiting') }));

    let roster;
    if (teamMode) {
      const column = (team, key, cls) => {
        const mine = self && self.team === team;
        return h('div', { class: `fzm-team ${cls}` },
          h('div', { class: 'fzm-team-head' }, h('span', tx(key)),
            self && !mine && !playing ? button('fzm-btn--sm', `lobby:team${team}`, L('m.join'), () => { sfx('ui'); net.setTeam(team); }, { 'aria-label': `${L('m.join')} : ${T(key)}` }) : null),
          h('div', null, list(players.filter(p => p.team === team))));
      };
      const loose = players.filter(p => p.team !== 'A' && p.team !== 'B');
      roster = h('div', { class: 'fzm-roster' },
        h('div', { class: 'fzm-teams' }, column('A', 'lobby.teamA', 'fzm-team--a'), column('B', 'lobby.teamB', 'fzm-team--b')),
        loose.length ? h('div', { class: 'fzm-team' }, h('div', { class: 'fzm-team-head' }, h('span', { text: L('m.unassigned') })), h('div', null, loose.map(row))) : null);
    } else {
      roster = h('div', { class: 'fzm-roster' }, h('div', { class: 'fzm-team' }, list(players)));
    }

    const select = (fid, label, value, options, onChange) => {
      const el = h('select', { class: 'fzm-select', 'data-fid': fid, 'aria-label': label, disabled: !isHost || playing });
      for (const [id, text] of options) el.append(h('option', { value: id, text }));
      if (!options.some(o => o[0] === value)) el.append(h('option', { value, text: String(value) }));
      el.value = value;
      el.addEventListener('change', () => { sfx('ui'); onChange(el.value); });
      return el;
    };
    const onlineModes = modesFor(true);
    const [, tagText] = modeTag(mode);

    let action;
    if (playing) {
      action = [h('div', { class: 'fzm-status', role: 'status' }, h('i', { class: 'fzm-spin' }), h('span', { text: L('m.inProgress') })),
        button('fzm-btn--primary fzm-btn--block', 'lobby:rejoin', L('m.rejoin'), () => playOnline(room), { disabled: st.deploying })];
    } else if (isHost) {
      const blocked = needPlayers || notReady;
      action = [
        button('fzm-btn--primary fzm-btn--block fzm-cta', 'lobby:start', h('span', tx('lobby.start')), () => { sfx('ui'); net.startMatch(); },
          { disabled: blocked, style: 'font-size:clamp(22px,1.6vw,27px)', 'aria-describedby': `${uid}-why` }),
        h('p', { class: 'fzm-hint', id: `${uid}-why`, role: 'status', text: needPlayers ? L('m.needPlayers') : notReady ? L('m.needReady') : L('m.allReady') })];
    } else {
      const ready = !!(self && self.ready);
      action = [
        button(`fzm-btn--block fzm-cta ${ready ? '' : 'fzm-btn--primary'}`, 'lobby:ready', ready ? L('m.cancelReady') : L('m.setReady'),
          () => { sfx('ui'); net.setReady(!ready); }, { 'aria-pressed': ready ? 'true' : 'false', style: 'font-size:clamp(22px,1.6vw,27px)' }),
        h('p', { class: 'fzm-hint', role: 'status', text: ready ? L('m.waitHost') : T('lobby.waiting') })];
    }

    const address = (() => { try { return location.origin + location.pathname; } catch { return ''; } })();
    const local = (() => { try { return /^(localhost|127\.|\[?::1\]?$)/i.test(location.hostname); } catch { return false; } })();

    return h('div', { class: 'fzm-wrap fzm-lobby' },
      h('div', { class: 'fzm-lobby-head' },
        h('div', null, h('h2', { class: 'fzm-title', ...tx('lobby.title') }), h('p', { class: 'fzm-lobby-sub', text: `${modeName(mode) || room.mode} · ${mapName(room.map)}` })),
        radios('playmode', `${T('mode.solo')} / ${T('mode.multiplayer')}`, st.playMode, [
          { id: 'solo', kids: h('span', tx('mode.solo')) }, { id: 'multi', kids: h('span', tx('mode.multiplayer')) },
        ], id => { st.playMode = id; savePrefs(); render(); }, 'fzm-seg')),
      h('div', { class: 'fzm-lobby-grid' },
        h('section', { class: 'fzm-panel' },
          heading(T('lobby.code')),
          h('div', { class: 'fzm-code' }, h('span', { class: 'fzm-code-val', 'data-fid': 'lobby:codeval', text: room.code }),
            button('fzm-btn--sm', 'lobby:copy', h('span', tx('lobby.copyCode')), () => copyText(room.code, T('lobby.copied')))),
          extPart('invite', room),       // invite link (online-ui.js)
          isHost ? extPart('share') || h('div', { class: 'fzm-callout' }, h('span', { text: L('m.share') }), address ? h('span', { class: 'fzm-addr', text: address }) : null,       // online-ui.js: on the public site, "share this code" instead of the network address
            local ? h('small', { text: L('m.shareLocal') }) : null,
            address ? button('fzm-btn--sm', 'lobby:copyaddr', L('m.copyAddr'), () => copyText(address, L('m.addrCopied'))) : null) : null,
          alertBox(),
          button('fzm-btn--danger fzm-btn--block', 'lobby:leave', h('span', tx('lobby.leave')), leaveRoom)),
        h('section', { class: 'fzm-panel' }, heading(T('lobby.players'), `${players.length} / ${room.maxPlayers || 12}`), roster, extPart('lobby', room, isHost, playing)),       // visibility and bots (online-ui.js)
        h('aside', { class: 'fzm-side' }, h('section', { class: 'fzm-panel' },
          heading(L('m.brief')),
          h('div', { class: 'fzm-sum' }, thumb(env, room.map),
            h('div', null, h('span', { class: 'fzm-sum-map', text: mapName(room.map) }), h('span', { class: 'fzm-sum-mode', text: `${modeName(mode) || room.mode} · ${tagText}` })),
            h('p', { class: 'fzm-sum-desc', text: modeDesc(mode) })),
          h('div', { class: 'fzm-field' }, h('div', { class: 'fzm-label' }, h('span', tx('mode.title'))),
            select('lobby:mode', T('mode.title'), room.mode, onlineModes.map(m => [m.id, modeName(m)]), v => net.setConfig({ mode: v }))),
          h('div', { class: 'fzm-field' }, h('div', { class: 'fzm-label' }, h('span', tx('lobby.map'))),
            select('lobby:map', T('lobby.map'), room.map, MAPS.map(m => [m.id, mapName(m.id)]), v => net.setConfig({ map: v }))),
          !isHost ? h('p', { class: 'fzm-hint', text: L('m.hostOnly') }) : null),
          h('div', { class: 'fzm-cta-wrap fzm-lobby-actions' }, action))));
  }

  /* ---------- arsenal / tenues / classes ---------- */
  function askBuy(type, item, name) {
    const price = item.price;
    openDialog({
      title: L('m.confirmBuy'),
      body: [h('p', { text: L('m.buyQuestion', { name, price: num(price) }) }), h('small', { text: L('m.balanceAfter', { n: num(profile.data.cr - price) }) })],
      onConfirm: () => {
        if (profile.buy(type, item.id)) {
          profile.equip(type, item.id);
          sfx('buy');
          toast(L('m.bought', { name }));
        }
        scheduleRender();
      },
    });
  }
  /* Bouton d’action d’une carte de boutique : équipé, à équiper, à acheter ou trop cher. */
  function shopFoot(type, item, name, labels) {
    const P = profile.data, owned = profile.owns(type, item.id), on = type === 'weapon' ? P.primary === item.id || P.secondary === item.id || P.gear === item.id : P.outfit === item.id;
    const fid = `${type}:${item.id}`;
    if (on) return h('div', { class: 'fzm-card-foot' }, button('fzm-btn--block fzm-btn--on', fid, h('span', tx(labels.on)), null, { disabled: true }));
    if (owned) return h('div', { class: 'fzm-card-foot' }, button('fzm-btn--block', fid, h('span', tx(labels.use)), () => { if (profile.equip(type, item.id)) sfx('ui'); scheduleRender(); }));
    if (type === 'weapon' && profile.levelOk && !profile.levelOk('weapon', item.id)) return h('div', { class: 'fzm-card-foot' }, button('fzm-btn--block', fid, h('span', { text: attText(attLang(), 'weaponLock', { n: profile.weaponLevel(item.id) }) }), null, { disabled: true }));
    const short = item.price - P.cr;
    if (short > 0) {
      return h('div', { class: 'fzm-card-foot' },
        button('fzm-btn--block', fid, h('span', tx('shop.buy', { price: num(item.price) })), null, { disabled: true, 'aria-describedby': `${uid}-short-${item.id}` }),
        h('span', { class: 'fzm-short', id: `${uid}-short-${item.id}`, text: L('m.missing', { n: num(short) }) }));
    }
    return h('div', { class: 'fzm-card-foot' },
      button('fzm-btn--block fzm-btn--primary', fid, h('span', tx('shop.buy', { price: num(item.price) })), () => { sfx('ui'); askBuy(type, item, name); }));
  }
  const priceTag = (owned, price) => h('span', { class: `fzm-price${owned ? ' is-owned' : ''}`, text: owned ? L('m.owned') : `${num(price)} ₡` });
  const screenHead = (titleKey, noteKey) => [h('h2', { class: 'fzm-title', ...tx(titleKey) }), h('p', { class: 'fzm-note', ...tx(noteKey) })];

  /* Arsenal : trois emplacements (principale, secondaire, équipement) et les armes groupées par catégorie. */
  const SLOT_FIELD = ['primary', 'secondary', 'gear'], SLOT_TAG = ['env', 'ffa', 'coop'];
  const slotName = s => L('m.slot' + s);
  const catName = c => (hasKey('weaponCat.' + c.id) ? T('weaponCat.' + c.id) : LOCAL['m.cat.' + c.id] ? L('m.cat.' + c.id) : c.name || '');
  const metaItem = (label, value) => h('span', null, `${label} `, h('b', { text: value }));
  /* Lignes de caractéristiques selon le type : une arme explosive montre son rayon et ses munitions emportées plutôt qu’une cadence. */
  function weaponStats(w) {
    const blast = !!(w.proj && w.proj.radius > 0);
    const rows = [stat(h('span', tx('stat.damage')), Math.sqrt((w.dmg * w.pellets) / 320) * 100, w.pellets > 1 ? `${w.dmg}×${w.pellets}` : String(w.dmg))];
    if (blast) {
      rows.push(stat(h('span', { text: L('m.blast') }), (w.proj.radius / 7) * 100, `${num(w.proj.radius)} m`));
      rows.push(stat(h('span', { text: L('m.carried') }), ((w.mag + (w.reserve || 0)) / 18) * 100, w.reserve === undefined ? '∞' : String(w.mag + w.reserve)));
    } else {
      rows.push(stat(h('span', tx('stat.rate')), w.rpm / 15, String(w.rpm)));
      rows.push(stat(h('span', tx('stat.range')), Math.sqrt(w.range / 160) * 100, `${num(w.range)} m`));
    }
    rows.push(stat(h('span', tx('stat.mobility')), (w.mob - 0.7) * 200, `${Math.round(w.mob * 100)} %`));
    return rows;
  }
  function weaponMeta(w) {
    const blast = !!(w.proj && w.proj.radius > 0), out = [];
    if (w.kind !== 'melee' && w.kind !== 'thrown') { out.push(metaItem(L('m.mag'), String(w.mag))); if (w.reload > 0) out.push(metaItem(L('m.reloadTime'), `${num(w.reload)} s`)); }
    if (w.reserve !== undefined && !blast) out.push(metaItem(L('m.carried'), String(w.mag + w.reserve)));
    if (w.burst > 1) out.push(metaItem(L('m.burst'), `×${w.burst}`));
    if (w.spin > 0) out.push(metaItem(L('m.spin'), `${num(w.spin)} s`));
    if (blast && w.proj.fuse < 5) out.push(metaItem(L('m.fuse'), `${num(w.proj.fuse)} s`));
    if (w.kind === 'melee') out.push(metaItem(L('m.backstab'), '×2'));
    else if (!blast && w.hs > 1) out.push(metaItem(L('m.head'), `×${num(w.hs)}`));
    if (w.silent) out.push(h('span', null, h('b', { text: L('m.silent') })));
    if (blast && w.proj.self > 0) out.push(h('span', { text: L('m.selfDmg') }));
    return out;
  }
  function weaponCard(w) {
    const P = profile.data, owned = profile.owns('weapon', w.id), on = P[SLOT_FIELD[w.slot]] === w.id;
    return h('article', { class: `fzm-card${on ? ' is-on' : ''}`, 'data-weapon': w.id },
      h('div', { class: 'fzm-card-top' }, tag(SLOT_TAG[w.slot] || 'env', weaponType(w)), priceTag(owned, w.price)),
      h('h3', { text: w.name }),
      h('div', { class: 'fzm-wbody' }, gun(w.id), h('div', { class: 'fzm-stats' }, weaponStats(w))),
      h('div', { class: 'fzm-meta' }, weaponMeta(w)),
      shopFoot('weapon', w, w.name, { on: 'shop.equipped', use: 'shop.equip' }),
      Object.keys(slotsOf(w.id)).length ? button('fzm-btn--block', `custom:${w.id}`, h('span', { text: attText(attLang(), 'custom') + (profile.attOf(w.id).length ? ` (${profile.attOf(w.id).length})` : '') }), () => { sfx('ui'); openCustomizer({ weaponId: w.id, profile, lang: attLang, sfx, engine, gunSvg: gunDrawing, gunShot: id => (gunBad.has(id) ? '' : gunShotUrl(id)), onClose: scheduleRender }); }) : null);
  }
  function nextUnlockNote() {
    const n = profile.nextReward && profile.nextReward(); if (!n) return null;
    return h('p', { class: 'fzm-note', 'data-fid': 'arsenal:next' }, h('b', { text: `${attText(attLang(), 'next')} · ` }), attText(attLang(), 'nextAt', { n: n.level, what: n.rewards.map(r => rewardName(attLang(), r)).join(', ') }));
  }
  function viewArsenal() {
    const P = profile.data, slots = [0, 1].filter(s => WEAPONS.some(w => w.slot === s));       // equipment has its own panel (gear-ui.js)
    const groups = WEAPON_CATS.filter(c => c.id !== 'gear').map(c => ({ c, list: WEAPONS.filter(w => w.cat === c.id) })).filter(g => g.list.length);
    const rest = WEAPONS.filter(w => !WEAPON_CATS.some(c => c.id === w.cat)); if (rest.length) groups.push({ c: { id: 'other', name: '' }, list: rest });
    let gearEl = null; try { gearEl = gearPanel({ profile, lang: attLang, sfx }); } catch (e) { console.warn('[menu] equipment panel', e); }
    return h('div', { class: 'fzm-wrap' },
      h('h2', { class: 'fzm-title', ...tx('nav.arsenal') }),
      slots.length > 2 ? h('p', { class: 'fzm-note', text: L('m.arsenalNote') }) : h('p', { class: 'fzm-note', ...tx('shop.arsenalNote') }),
      nextUnlockNote(), gearEl,
      h('div', { class: 'fzm-slots' }, slots.map(s => {
        const w = byId(WEAPONS, P[SLOT_FIELD[s]]);
        return h('div', { class: 'fzm-slot', 'data-slot': String(s) }, gun(w ? w.id : ''), h('div', null, h('small', { text: slotName(s) }), h('b', { text: w ? w.name : '—' }), h('span', { text: w ? weaponType(w) : '' })));
      })),
      groups.map(g => h('section', { class: 'fzm-cat', 'data-cat': g.c.id },
        h('div', { class: 'fzm-cat-head' }, h('h3', { text: catName(g.c) }), h('span', { text: String(g.list.length) })),
        h('div', { class: 'fzm-grid fzm-grid--guns' }, g.list.map(weaponCard)))));
  }

  function viewOutfits() {
    const P = profile.data;
    return h('div', { class: 'fzm-wrap' }, screenHead('nav.outfits', 'shop.outfitsNote'),
      h('div', { class: 'fzm-grid' }, OUTFITS.map(o => {
        const owned = profile.owns('outfit', o.id), rarity = RARITY_KEY[o.r] || 'standard';
        return h('article', { class: `fzm-card${P.outfit === o.id ? ' is-on' : ''}` },
          camo(o, 480, 210),
          h('div', { class: 'fzm-card-top' }, h('span', { class: `fzm-tag fzm-tag--${rarity}`, ...tx('rarity.' + rarity) }), priceTag(owned, o.price)),
          h('h3', { text: outfitName(o) }),
          shopFoot('outfit', o, outfitName(o), { on: 'shop.worn', use: 'shop.wear' }));
      })));
  }

  function viewClasses() {
    const P = profile.data;
    return h('div', { class: 'fzm-wrap' }, screenHead('nav.classes', 'shop.classesNote'),
      h('div', { class: 'fzm-grid' }, CLASSES.map(c => {
        const on = P.cls === c.id;
        return h('article', { class: `fzm-card${on ? ' is-on' : ''}` },
          h('h3', { text: className(c) }),
          h('p', { text: classDesc(c) }),
          h('div', { class: 'fzm-stats' },
            stat(h('span', tx('stat.health')), c.hp / 1.4, String(c.hp)),
            stat(h('span', tx('stat.armor')), c.armor * 1.3, String(c.armor)),
            stat(h('span', tx('stat.speed')), (c.spd - 0.7) * 180, `${Math.round(c.spd * 100)} %`)),
          c.regen ? h('div', { class: 'fzm-trait', text: L('m.regen') }) : null,
          h('div', { class: 'fzm-card-foot' }, on
            ? button('fzm-btn--block fzm-btn--on', `class:${c.id}`, h('span', tx('shop.selected')), null, { disabled: true })
            : button('fzm-btn--block', `class:${c.id}`, h('span', tx('shop.choose')), () => {
              if (profile.equip('class', c.id)) { sfx('ui'); if (st.room) syncLoadout(st.room); }
              scheduleRender();
            })));
      })));
  }

  /* ---------- fin de partie ---------- */
  const levelOf = xp => Math.floor(xp / XP_PER_LEVEL) + 1;
  function clearEndTimers() { while (endTimers.length) { const t = endTimers.pop(); clearTimeout(t); clearInterval(t); } }

  function viewEnd() {
    const e = st.end || { won: null, title: '', stats: [], credits: 0, xp: 0, xpBefore: profile.data.xp, xpAfter: profile.data.xp };
    const cfg = e.cfg, verdict = e.won === true ? 'end.victory' : e.won === false ? 'end.defeat' : 'end.draw';
    const title = e.title || T(verdict);
    const online = !!(cfg && cfg.online);
    const lvlBefore = levelOf(e.xpBefore), lvlAfter = levelOf(e.xpAfter), up = lvlAfter > lvlBefore;
    const startLevel = e.animated ? lvlAfter : lvlBefore, startXp = e.animated ? e.xpAfter : e.xpBefore;
    const guard = fn => () => { if (performance.now() >= endGuardUntil) fn(); };
    return h('div', { class: `fzm-end${e.won === true ? ' is-won' : e.won === false ? ' is-lost' : ''}` },
      h('p', { class: 'fzm-end-eyebrow', text: cfg ? `${L('m.report')} · ${modeName(byId(MODES, cfg.mode)) || cfg.mode} · ${mapName(cfg.map)}` : L('m.report') }),
      h('h2', { class: 'fzm-end-title', text: title }),
      e.title && e.title !== T(verdict) ? h('p', { class: 'fzm-end-state', ...tx(verdict) }) : null,
      e.stats.length ? h('div', { class: 'fzm-end-stats' }, e.stats.map(s => h('div', { class: 'fzm-end-stat' }, h('b', { text: String(s.value ?? '') }), h('span', { text: String(s.label ?? '') })))) : null,
      h('div', { class: 'fzm-reward' },
        heading(L('m.rewards')),
        h('div', { class: 'fzm-reward-row' },
          h('div', { class: 'fzm-gain' }, h('b', { 'data-end': 'cr', text: `+${num(e.animated ? e.credits : 0)} ₡` }), h('span', tx('end.credits'))),
          h('div', { class: 'fzm-gain' }, h('b', { 'data-end': 'xp', text: `+${num(e.animated ? e.xp : 0)} XP` }), h('span', { text: L('m.xp') }))),
        h('div', { class: 'fzm-levelup', 'data-end': 'up', hidden: !(up && e.animated), text: `${L('m.levelUp')} · ${L('m.levelN', { n: lvlAfter })} · ${rankName(lvlAfter)}` }),
        e.unlocks && e.unlocks.length ? rewardBlock(e.unlocks, attLang) : null,
        h('div', { class: 'fzm-lvl' },
          h('div', { class: 'fzm-lvl-line' }, h('span', { 'data-end': 'lvl', text: `${rankName(startLevel)} · ${L('m.levelN', { n: startLevel })}` }),
            h('span', { 'data-end': 'into', text: `${num(startXp % XP_PER_LEVEL)} / ${num(XP_PER_LEVEL)} XP` })),
          h('div', { class: 'fzm-lvl-bar' }, h('i', { 'data-end': 'bar', class: 'is-snap', style: `width:${((startXp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100}%` })))),
      (() => { try { return globalThis.FZPass && globalThis.FZPass.endBlock ? globalThis.FZPass.endBlock('menu') : null; } catch { return null; } })(),       // passe de saison (pass.js)
      (() => { try { return globalThis.FZReplay && globalThis.FZReplay.endBlock ? globalThis.FZReplay.endBlock('menu') : null; } catch { return null; } })(),       // meilleur moment (replay-rec.js)
      h('div', { class: 'fzm-end-actions' },
        button('fzm-btn--primary', 'end:again', online ? L('m.backLobby') : h('span', tx('end.again')), guard(endAgain)),
        button('', 'end:back', h('span', tx('end.back')), guard(endBack)),
        online && st.room ? extPart('endInvite', st.room) : null));       // the room goes on: invite friends (online-ui.js)
  }

  function runEndAnimation() {
    const e = st.end;
    if (!e || e.animated) return;
    e.animated = true;
    clearEndTimers();
    const q = name => main.querySelector(`[data-end="${name}"]`);
    const bar = q('bar'), lvl = q('lvl'), into = q('into'), up = q('up'), cr = q('cr'), xp = q('xp');
    if (!bar) return;
    const lvlBefore = levelOf(e.xpBefore), lvlAfter = levelOf(e.xpAfter), levelUp = lvlAfter > lvlBefore;
    const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
    const finish = () => {
      cr.textContent = `+${num(e.credits)} ₡`;
      xp.textContent = `+${num(e.xp)} XP`;
      lvl.textContent = `${rankName(lvlAfter)} · ${L('m.levelN', { n: lvlAfter })}`;
      into.textContent = `${num(e.xpAfter % XP_PER_LEVEL)} / ${num(XP_PER_LEVEL)} XP`;
      bar.style.width = `${((e.xpAfter % XP_PER_LEVEL) / XP_PER_LEVEL) * 100}%`;
      if (levelUp) up.hidden = false;
    };
    if (reduced) { finish(); return; }
    /* Compteurs : pas fixes sur minuterie (ne dépend pas de requestAnimationFrame). */
    let step = 0;
    const steps = 18;
    const counter = setInterval(() => {
      step++;
      const k = 1 - Math.pow(1 - step / steps, 3);
      cr.textContent = `+${num(Math.round(e.credits * k))} ₡`;
      xp.textContent = `+${num(Math.round(e.xp * k))} XP`;
      if (step >= steps) clearInterval(counter);
    }, 34);
    endTimers.push(counter);
    endTimers.push(setTimeout(() => {
      bar.classList.remove('is-snap');
      bar.style.width = levelUp ? '100%' : `${((e.xpAfter % XP_PER_LEVEL) / XP_PER_LEVEL) * 100}%`;
      if (!levelUp) into.textContent = `${num(e.xpAfter % XP_PER_LEVEL)} / ${num(XP_PER_LEVEL)} XP`;
    }, 260));
    if (levelUp) {
      endTimers.push(setTimeout(() => {
        bar.classList.add('is-snap');
        bar.style.width = '0%';
        void bar.offsetWidth;
        bar.classList.remove('is-snap');
        finish();
        sfx('buy');
      }, 1050));
    }
  }

  function endAgain() {
    const cfg = st.end && st.end.cfg;
    clearEndTimers();
    if (cfg && cfg.online) { st.screen = 'play'; st.playMode = 'multi'; render(); return; }
    st.screen = 'play';
    st.playMode = 'solo';
    if (cfg) launch({ mode: cfg.mode, map: cfg.map, online: false, bots: cfg.bots, difficulty: cfg.difficulty });
    else deploySolo();
  }
  function endBack() {
    clearEndTimers();
    sfx('ui');
    const online = !!(st.end && st.end.cfg && st.end.cfg.online);
    st.screen = 'play';
    if (online && st.room) st.playMode = 'multi';
    render();
  }

  /* ---------- écoute des modules ---------- */
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); };
  listen(root, 'pointerdown', () => { pointerDown = true; unlockAudio(); }, true);
  const release = () => {
    if (!pointerDown) return;
    pointerDown = false;
    if (renderPending) setTimeout(() => { if (renderPending) render(); }, 0);
  };
  listen(window, 'pointerup', release, true);
  listen(window, 'pointercancel', release, true);
  listen(window, 'blur', release);
  listen(document, 'keydown', e => {
    if (!visible) return;
    unlockAudio();
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (dialog) { e.preventDefault(); closeDialog(); return; }
    if (st.screen === 'end') { if (performance.now() >= endGuardUntil) endBack(); return; }
    if (st.screen !== 'play') { sfx('ui'); go('play'); }
  });

  if (profile && typeof profile.on === 'function') offs.push(profile.on(() => { if (!muteProfile) scheduleRender(); }));
  if (i18n && typeof i18n.on === 'function') offs.push(i18n.on('change', () => { closeDialog(); scheduleRender(); }));

  const safeOn = (target, event, fn) => {
    try { const off = target.on(event, fn); if (typeof off === 'function') offs.push(off); } catch { /* évènement inconnu de ce module */ }
  };
  if (engine && typeof engine.on === 'function') {
    safeOn(engine, 'matchStart', cfg => { if (cfg && typeof cfg === 'object') st.lastCfg = cfg; api.hide(); });
    safeOn(engine, 'matchEnd', result => api.showEnd(result));
    try { const pending = rewardLines(profile, attLang); if (pending.length) rewardToast(pending, attLang); } catch { /* optional */ }       // levels reached in a session that closed before showing them
  }
  if (net && typeof net.on === 'function') {
    safeOn(net, 'room', room => {
      clearTimeout(connTimer);
      st.room = room; st.pending = null; st.netError = null; st.lastCode = room.code; st.leaving = false;
      syncLoadout(room);
      scheduleRender();
    });
    safeOn(net, 'start', room => {
      clearTimeout(connTimer);
      st.room = room; st.pending = null; st.netError = null; st.lastCode = room.code;
      playOnline(room);
    });
    safeOn(net, 'error', err => {
      const code = err && err.code;
      if (!LOBBY_ERRORS.has(code)) return;
      if (!visible && !st.pending) return;
      clearTimeout(connTimer);
      st.pending = null;
      st.netError = { code };
      scheduleRender();
    });
    safeOn(net, 'close', () => {
      const had = st.room || st.pending;
      clearTimeout(connTimer);
      st.room = null; st.pending = null; sentLoadout = '';
      if (st.leaving) st.leaving = false;
      else if (had) st.netError = { code: 'lost' };
      scheduleRender();
    });
    if (net.room && net.room.code) { st.room = net.room; st.lastCode = net.room.code; }
  }

  /* ---------- API ---------- */
  function reveal() {
    if (rootEl.style.display === 'none') rootEl.style.display = '';
    rootEl.hidden = false;
    rootEl.classList.remove('hide', 'hidden');
    root.hidden = false;
    if (!visible) shownKey = null;
    visible = true;
  }
  const api = {
    show(screen) {
      if (destroyed) return;
      const asked = String(screen || '').toLowerCase(), target = SCREEN_ALIASES[asked];
      if (target === 'multi') { st.screen = 'play'; st.playMode = 'multi'; }
      else if (target === 'end') st.screen = st.end ? 'end' : 'play';
      else if (target) { st.screen = target; if (asked === 'solo') st.playMode = 'solo'; }
      else if (st.screen === 'end') st.screen = 'play';
      st.deploying = false;
      clearTimeout(deployTimer);
      reveal();
      render();
    },
    hide() {
      if (destroyed) return;
      visible = false;
      st.deploying = false;
      clearTimeout(deployTimer);
      clearEndTimers();
      closeDialog();
      unmountSettings();
      toastEl.classList.remove('is-on');
      shownKey = null;
      root.hidden = true;
      rootEl.style.display = 'none';
      xpAtHide = profile.data.xp;
      const active = document.activeElement;
      if (active && root.contains(active) && typeof active.blur === 'function') active.blur();
    },
    /* match-flow.js : quitter le salon depuis l'écran de vote, relire ce que l'écran de fin a calculé. */
    leaveRoom() { leaveRoom(); },
    get lastEnd() { return st.end; },
    /* online-ui.js : ses morceaux d'écran (ext) et les briques du menu qu'il réutilise (kit), pour garder le même rendu. */
    ext: null,
    kit: {
      h, button, radios, heading, tag, thumb, modeName, mapName, mapOf, L, T, tx, sfx, toast, st, MODES, MAPS, uid, joinRoom, render: () => scheduleRender(),
      pending(kind, retry) { if (!net || st.pending) return null; commitName(); st.netError = null; st.pending = kind; st.lastIntent = { type: kind, retry }; expectReply(); sfx('ui'); render(); return playerName(); },
    },
    showEnd(result) {
      if (destroyed) return;
      const r = result && typeof result === 'object' ? result : {};
      const xp = Math.max(0, Math.floor(+r.xp || 0)), credits = Math.max(0, Math.floor(+r.credits || 0));
      /* Le moteur verse la récompense avant matchEnd (contrat) ; si ce n’est pas encore fait, on l’anticipe à l’affichage. */
      const paid = xpAtHide === null || profile.data.xp - xpAtHide >= xp;
      const xpAfter = profile.data.xp + (paid ? 0 : xp);
      xpAtHide = null;
      clearEndTimers();
      st.end = {
        won: r.won === true ? true : r.won === false ? false : null,
        title: typeof r.title === 'string' ? r.title : '',
        stats: Array.isArray(r.stats) ? r.stats.filter(s => s && typeof s === 'object').slice(0, 8) : [],
        credits, xp, xpAfter, xpBefore: Math.max(0, xpAfter - xp),
        cfg: st.lastCfg || (engine && engine.cfg) || null, animated: false,
      };
      try { st.end.unlocks = rewardLines(profile, attLang); } catch { st.end.unlocks = []; }
      st.screen = 'end';
      st.deploying = false;
      clearTimeout(deployTimer);
      endGuardUntil = performance.now() + 700;
      reveal();
      shownKey = null;
      render();
      const again = root.querySelector('[data-fid="end:again"]');
      if (again) again.focus({ preventScroll: true });
    },
    destroy() {
      if (destroyed) return;
      api.hide();
      destroyed = true;
      clearTimeout(toastTimer);
      clearTimeout(connTimer);
      for (const off of offs.splice(0)) { try { off(); } catch { /* déjà retiré */ } }
      root.remove();
      rootEl.style.display = '';
      if (!document.querySelector('.fzm')) { const style = document.getElementById('fzm-style'); if (style) style.remove(); }
    },
  };

  api.show();
  return api;
}
