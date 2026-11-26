// FRONT ZÉRO — the living front ("Front vivant"), client side. Loaded by main.js (guarded import): a failure leaves the game as it was.
// - Home screen: a front band inside the play grid (live theatre map, sides, weekly offensive, your side) that opens the war room.
// - War room: the theatre map (territories, front line, control bars, live offensive), your side and contribution, news of the front.
// - Faction choice (first use; one switch per season), the end-of-match "contribution to the front" block, the special rule of a weekly
//   objective during an online match (fog, dark, scarce ammo; faster respawn is the server's), and the war-damage decor (map-damage.js).
// Talks to the server through /api/front (public state), /api/front/me (identity, side) and the WebSocket ('fid' / 'front').
// Nothing runs per frame during a match; the menus' animations are CSS (stopped with reduced motion).
import { FACTIONS, emblem, motto, LANGS } from './front-factions.js';

/* ---------- the theatre (same graph as front-war.js; a test compares them) ---------- */
const IDS = ['port', 'valferrade', 'marais', 'vieille-ville', 'depot', 'col-blanc', 'cite', 'sept-vents', 'barrage', 'bunker', 'val-cendre', 'roqueseche', 'noirval'];
const ADJ = {
  port: ['valferrade', 'vieille-ville', 'marais'],
  valferrade: ['port', 'vieille-ville', 'col-blanc'],
  marais: ['port', 'vieille-ville', 'depot'],
  'vieille-ville': ['port', 'valferrade', 'marais', 'col-blanc', 'cite', 'depot'],
  depot: ['marais', 'vieille-ville', 'cite', 'sept-vents'],
  'col-blanc': ['valferrade', 'vieille-ville', 'cite', 'barrage'],
  cite: ['vieille-ville', 'col-blanc', 'barrage', 'bunker', 'sept-vents', 'depot'],
  'sept-vents': ['val-cendre', 'bunker', 'cite', 'depot'],
  barrage: ['roqueseche', 'bunker', 'cite', 'col-blanc'],
  bunker: ['noirval', 'val-cendre', 'roqueseche', 'sept-vents', 'cite', 'barrage'],
  'val-cendre': ['noirval', 'bunker', 'sept-vents'],
  roqueseche: ['noirval', 'bunker', 'barrage'],
  noirval: ['val-cendre', 'bunker', 'roqueseche'],
};
const START = { A: ['port', 'valferrade', 'marais', 'vieille-ville', 'depot'], B: ['noirval', 'val-cendre', 'roqueseche', 'bunker', 'barrage'] };
/* Positions on a 1000 × 600 sheet (180° symmetric around Cité Verrière). The borders are the Voronoi cells of these points, whose
   neighbours are exactly ADJ; each shared border gets the same hand-drawn wobble from both sides. */
const SITES = { port: [110, 300], valferrade: [215, 135], marais: [195, 470], 'vieille-ville': [330, 300], depot: [380, 470], 'col-blanc': [430, 140], cite: [500, 300],
  'sept-vents': [570, 460], barrage: [620, 130], bunker: [670, 300], 'val-cendre': [785, 465], roqueseche: [805, 130], noirval: [890, 300] };
const VW = 1000, VH = 600;
const COAST = [[58, 0], [52, 58], [72, 112], [46, 176], [64, 228], [38, 262], [74, 292], [56, 334], [30, 368], [54, 424], [36, 482], [84, 522], [118, 556], [170, 600]];
const RIVER = 'M642 -4 C628 50 612 92 604 128 C596 170 560 200 540 236 C514 282 488 330 444 362 C404 392 340 404 292 432 C252 456 214 470 176 500 C140 528 104 552 70 604';

function buildGeometry() {
  const ids = IDS, P = ids.map(id => SITES[id]);
  const cells = {}, pairs = new Map();
  ids.forEach((id, i) => {
    let poly = [{ x: 0, y: 0, t: -1 }, { x: VW, y: 0, t: -1 }, { x: VW, y: VH, t: -1 }, { x: 0, y: VH, t: -1 }];
    const [px, py] = P[i];
    for (let j = 0; j < ids.length; j++) {
      if (j === i) continue;
      const [qx, qy] = P[j], mx = (px + qx) / 2, my = (py + qy) / 2, nx = qx - px, ny = qy - py, f = v => (v.x - mx) * nx + (v.y - my) * ny, out = [];
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length], fa = f(a), fb = f(b), ina = fa <= 0, inb = fb <= 0;
        if (ina) out.push(a);
        if (ina !== inb) { const s = fa / (fa - fb), I = { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, t: ina ? j : a.t }; out.push(I); }
      }
      poly = out;
    }
    cells[id] = poly;
    poly.forEach((v, k) => { if (v.t < 0) return; const w = poly[(k + 1) % poly.length], key = i < v.t ? i + '|' + v.t : v.t + '|' + i; if (!pairs.has(key) && i < v.t) pairs.set(key, { a: i, b: v.t, p: [v.x, v.y], q: [w.x, w.y] }); });
  });
  // the wobble of each shared border: fixed ends, a smooth perpendicular offset seeded by the pair
  for (const e of pairs.values()) {
    const [x0, y0] = e.p, [x1, y1] = e.q, L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1), n = Math.max(2, Math.round(L / 22)), seed = e.a * 7.13 + e.b * 3.71;
    e.line = [];
    for (let k = 0; k <= n; k++) { const s = k / n, amp = k === 0 || k === n ? 0 : Math.min(7, L * 0.05) * (Math.sin(seed + s * 9.1) * 0.7 + Math.sin(seed * 2.3 + s * 21.7) * 0.3); e.line.push([x0 + (x1 - x0) * s + nx * amp, y0 + (y1 - y0) * s + ny * amp]); }
  }
  const near = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
  const path = {};
  ids.forEach((id, i) => {
    const poly = cells[id], pts = [];
    poly.forEach((v, k) => {
      const w = poly[(k + 1) % poly.length];
      if (v.t < 0) { pts.push([v.x, v.y]); return; }
      const e = pairs.get(i < v.t ? i + '|' + v.t : v.t + '|' + i);
      const line = near(e.line[0], [v.x, v.y]) ? e.line : e.line.slice().reverse();
      for (let q = 0; q < line.length - 1; q++) pts.push(line[q]);
      void w;
    });
    path[id] = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
  });
  const edges = [...pairs.values()].map(e => ({ a: ids[e.a], b: ids[e.b], d: 'M' + e.line.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') }));
  return { path, edges };
}
const GEO = buildGeometry();

/* ---------- texts (fr, en, es, de, pt, it) ---------- */
const TX = {
  title: ['Front vivant', 'Living front', 'Frente vivo', 'Lebende Front', 'Frente viva', 'Fronte vivo'],
  season: ['Saison {n}', 'Season {n}', 'Temporada {n}', 'Saison {n}', 'Temporada {n}', 'Stagione {n}'],
  week: ['Semaine {w}/{n}', 'Week {w}/{n}', 'Semana {w}/{n}', 'Woche {w}/{n}', 'Semana {w}/{n}', 'Settimana {w}/{n}'],
  endsIn: ['fin dans {d}', 'ends in {d}', 'termina en {d}', 'endet in {d}', 'termina em {d}', 'finisce tra {d}'],
  dh: ['{d} j {h} h', '{d} d {h} h', '{d} d {h} h', '{d} T {h} Std', '{d} d {h} h', '{d} g {h} h'],
  hm: ['{h} h {m} min', '{h} h {m} min', '{h} h {m} min', '{h} Std {m} Min', '{h} h {m} min', '{h} h {m} min'],
  open: ['Carte du front', 'Front map', 'Mapa del frente', 'Frontkarte', 'Mapa da frente', 'Mappa del fronte'],
  choose: ['Choisis ton camp', 'Choose your side', 'Elige tu bando', 'Wähle deine Seite', 'Escolhe o teu lado', 'Scegli la tua parte'],
  chooseSub: ['Chaque partie en ligne compte pour ton camp, sur la carte où elle se joue. Gagne, élimine, prends les objectifs : le front avance.', 'Every online match counts for your side, on the map where it is played. Win, eliminate, take objectives: the front moves.', 'Cada partida en línea cuenta para tu bando, en el mapa donde se juega. Gana, elimina, toma objetivos: el frente avanza.', 'Jedes Online-Match zählt für deine Seite, auf der Karte, auf der es gespielt wird. Gewinne, eliminiere, nimm Ziele ein: Die Front bewegt sich.', 'Cada partida online conta para o teu lado, no mapa onde é jogada. Vence, elimina, toma objetivos: a frente avança.', 'Ogni partita online conta per la tua parte, sulla mappa in cui si gioca. Vinci, elimina, prendi gli obiettivi: il fronte avanza.'],
  join: ['Rejoindre {f}', 'Join {f}', 'Unirse a {f}', '{f} beitreten', 'Juntar-me a {f}', 'Unisciti a {f}'],
  later: ['Plus tard', 'Later', 'Más tarde', 'Später', 'Mais tarde', 'Più tardi'],
  holdsW: ['Tient l’ouest : la côte, le marais, les mines du nord-ouest.', 'Holds the west: the coast, the marsh, the north-west mines.', 'Domina el oeste: la costa, el pantano, las minas del noroeste.', 'Hält den Westen: Küste, Sumpf, Minen im Nordwesten.', 'Domina o oeste: a costa, o pântano, as minas do noroeste.', 'Tiene l’ovest: la costa, la palude, le miniere a nord-ovest.'],
  holdsE: ['Tient l’est : la raffinerie, les collines sèches, la vallée du sud-est.', 'Holds the east: the refinery, the dry hills, the south-east valley.', 'Domina el este: la refinería, las colinas secas, el valle del sureste.', 'Hält den Osten: Raffinerie, trockene Hügel, das Tal im Südosten.', 'Domina o leste: a refinaria, as colinas secas, o vale do sudeste.', 'Tiene l’est: la raffineria, le colline aride, la valle a sud-est.'],
  switchRule: ['Changement de camp : une fois par saison, 48 h après ton choix. Les parties solo ne comptent pas.', 'Switching sides: once per season, 48 h after your choice. Solo matches do not count.', 'Cambio de bando: una vez por temporada, 48 h después de elegir. Las partidas en solitario no cuentan.', 'Seitenwechsel: einmal pro Saison, 48 Std nach deiner Wahl. Solo-Matches zählen nicht.', 'Mudança de lado: uma vez por temporada, 48 h após a escolha. As partidas a solo não contam.', 'Cambio di parte: una volta per stagione, 48 h dopo la scelta. Le partite in solitaria non contano.'],
  yourSide: ['Ton camp', 'Your side', 'Tu bando', 'Deine Seite', 'O teu lado', 'La tua parte'],
  noSide: ['Aucun camp choisi', 'No side chosen', 'Sin bando', 'Keine Seite gewählt', 'Nenhum lado escolhido', 'Nessuna parte scelta'],
  pickNow: ['Choisir un camp', 'Choose a side', 'Elegir bando', 'Seite wählen', 'Escolher lado', 'Scegli una parte'],
  terr: ['{n} territoires', '{n} territories', '{n} territorios', '{n} Gebiete', '{n} territórios', '{n} territori'],
  soldiers: ['{n} soldats', '{n} soldiers', '{n} soldados', '{n} Soldaten', '{n} soldados', '{n} soldati'],
  pts: ['{n} pts', '{n} pts', '{n} pts', '{n} Pkt', '{n} pts', '{n} pt'],
  myPts: ['{n} points cette saison · {m} parties', '{n} points this season · {m} matches', '{n} puntos esta temporada · {m} partidas', '{n} Punkte diese Saison · {m} Matches', '{n} pontos nesta temporada · {m} partidas', '{n} punti questa stagione · {m} partite'],
  share: ['{s} % de l’effort de {f}', '{s} % of {f}’s effort', '{s} % del esfuerzo de {f}', '{s} % des Einsatzes von {f}', '{s} % do esforço de {f}', '{s} % dello sforzo di {f}'],
  offensive: ['Offensive de la semaine', 'Offensive of the week', 'Ofensiva de la semana', 'Offensive der Woche', 'Ofensiva da semana', 'Offensiva della settimana'],
  x2: ['Points ×2', 'Points ×2', 'Puntos ×2', 'Punkte ×2', 'Pontos ×2', 'Punti ×2'],
  r_fog: ['Brouillard dense', 'Dense fog', 'Niebla densa', 'Dichter Nebel', 'Nevoeiro denso', 'Nebbia fitta'],
  r_dark: ['Pénombre', 'Low light', 'Penumbra', 'Halbdunkel', 'Penumbra', 'Penombra'],
  r_respawn: ['Renforts rapides', 'Fast reinforcements', 'Refuerzos rápidos', 'Schnelle Verstärkung', 'Reforços rápidos', 'Rinforzi rapidi'],
  r_ammo: ['Munitions rares', 'Scarce ammo', 'Munición escasa', 'Knappe Munition', 'Munições raras', 'Munizioni scarse'],
  d_fog: ['On voit deux fois moins loin.', 'You see half as far.', 'Se ve la mitad de lejos.', 'Die Sicht ist halbiert.', 'Vê-se a metade da distância.', 'Si vede a metà distanza.'],
  d_dark: ['Lumière basse : allume ta lampe ({k}).', 'Low light: switch on your flashlight ({k}).', 'Poca luz: enciende tu linterna ({k}).', 'Wenig Licht: Lampe einschalten ({k}).', 'Pouca luz: liga a lanterna ({k}).', 'Poca luce: accendi la torcia ({k}).'],
  d_respawn: ['Réapparition en 1,5 s.', 'Respawn in 1.5 s.', 'Reaparición en 1,5 s.', 'Wiedereinstieg nach 1,5 s.', 'Reaparecimento em 1,5 s.', 'Rientro in 1,5 s.'],
  d_ammo: ['Deux chargeurs de réserve seulement : ramasse les armes.', 'Only two spare magazines: pick up weapons.', 'Solo dos cargadores de reserva: recoge armas.', 'Nur zwei Reservemagazine: Waffen aufsammeln.', 'Só dois carregadores de reserva: apanha armas.', 'Solo due caricatori di riserva: raccogli le armi.'],
  heldBy: ['Tenu par {f}', 'Held by {f}', 'En manos de {f}', 'Gehalten von {f}', 'Nas mãos de {f}', 'Tenuto da {f}'],
  neutral: ['Zone neutre', 'Neutral ground', 'Zona neutral', 'Neutrales Gebiet', 'Zona neutra', 'Zona neutrale'],
  contested: ['Contesté', 'Contested', 'Disputado', 'Umkämpft', 'Disputado', 'Conteso'],
  hq: ['QG', 'HQ', 'CG', 'HQ', 'QG', 'QG'],
  hqNote: ['Quartier général : ne tombe jamais.', 'Headquarters: never falls.', 'Cuartel general: nunca cae.', 'Hauptquartier: fällt nie.', 'Quartel-general: nunca cai.', 'Quartier generale: non cade mai.'],
  attBy: ['Attaquable par {f}', 'Open to {f}', 'Atacable por {f}', 'Angreifbar für {f}', 'Atacável por {f}', 'Attaccabile da {f}'],
  dmg1: ['Endommagé par les combats', 'Damaged by the fighting', 'Dañado por los combates', 'Von den Kämpfen beschädigt', 'Danificado pelos combates', 'Danneggiato dai combattimenti'],
  dmg2: ['Ravagé par les combats', 'Ruined by the fighting', 'Arrasado por los combates', 'Von den Kämpfen verwüstet', 'Arrasado pelos combates', 'Devastato dai combattimenti'],
  control: ['Contrôle', 'Control', 'Control', 'Kontrolle', 'Controlo', 'Controllo'],
  play: ['Jouer cette carte en ligne', 'Play this map online', 'Jugar este mapa en línea', 'Diese Karte online spielen', 'Jogar este mapa online', 'Gioca questa mappa online'],
  news: ['Nouvelles du front', 'News from the front', 'Noticias del frente', 'Nachrichten von der Front', 'Notícias da frente', 'Notizie dal fronte'],
  ev_flip: ['{f} prend {map}', '{f} takes {map}', '{f} toma {map}', '{f} erobert {map}', '{f} toma {map}', '{f} prende {map}'],
  ev_counter: ['Riposte de {f} sur {map}', '{f} strikes back at {map}', 'Contraataque de {f} en {map}', 'Gegenschlag von {f} bei {map}', 'Contra-ataque de {f} em {map}', 'Contrattacco di {f} su {map}'],
  ev_week: ['Nouvelle offensive : {maps}', 'New offensive: {maps}', 'Nueva ofensiva: {maps}', 'Neue Offensive: {maps}', 'Nova ofensiva: {maps}', 'Nuova offensiva: {maps}'],
  ev_season: ['Saison {n} : le front se met en place', 'Season {n}: the front takes shape', 'Temporada {n}: el frente se forma', 'Saison {n}: Die Front formiert sich', 'Temporada {n}: a frente forma-se', 'Stagione {n}: il fronte prende forma'],
  ago: ['il y a {d}', '{d} ago', 'hace {d}', 'vor {d}', 'há {d}', '{d} fa'],
  how: ['Comment ça marche', 'How it works', 'Cómo funciona', 'So funktioniert’s', 'Como funciona', 'Come funziona'],
  how1: ['Victoire, éliminations et objectifs donnent des points de front à ton camp, sur la carte jouée.', 'Wins, eliminations and objectives give front points to your side, on the map played.', 'Victorias, eliminaciones y objetivos dan puntos de frente a tu bando, en el mapa jugado.', 'Siege, Eliminierungen und Ziele geben deiner Seite Frontpunkte auf der gespielten Karte.', 'Vitórias, eliminações e objetivos dão pontos de frente ao teu lado, no mapa jogado.', 'Vittorie, eliminazioni e obiettivi danno punti fronte alla tua parte, sulla mappa giocata.'],
  how2: ['On ne peut attaquer qu’un territoire au contact de son camp. À 75 % de contrôle, il change de mains.', 'You can only attack a territory touching your side. At 75 % control it changes hands.', 'Solo se puede atacar un territorio en contacto con tu bando. Con el 75 % de control cambia de manos.', 'Angreifen kann man nur Gebiete, die an die eigene Seite grenzen. Bei 75 % Kontrolle wechselt es den Besitzer.', 'Só se pode atacar um território em contacto com o teu lado. Com 75 % de controlo muda de mãos.', 'Si può attaccare solo un territorio a contatto con la propria parte. Al 75 % di controllo cambia mano.'],
  how3: ['Contre des bots, les points comptent moitié. Les parties solo ne comptent jamais.', 'Against bots, points count half. Solo matches never count.', 'Contra bots, los puntos valen la mitad. Las partidas en solitario nunca cuentan.', 'Gegen Bots zählen die Punkte halb. Solo-Matches zählen nie.', 'Contra bots, os pontos contam metade. As partidas a solo nunca contam.', 'Contro i bot i punti valgono metà. Le partite in solitaria non contano mai.'],
  how4: ['Fin de saison : le camp qui tient le plus de territoires gagne un revêtement exclusif, jamais vendu.', 'Season end: the side holding more territory wins an exclusive finish, never sold.', 'Fin de temporada: el bando con más territorios gana un acabado exclusivo, nunca a la venta.', 'Saisonende: Die Seite mit mehr Gebieten gewinnt ein exklusives Finish, nie im Verkauf.', 'Fim de temporada: o lado com mais territórios ganha um acabamento exclusivo, nunca vendido.', 'Fine stagione: la parte con più territori vince una finitura esclusiva, mai in vendita.'],
  contrib: ['Contribution au front', 'Contribution to the front', 'Contribución al frente', 'Beitrag zur Front', 'Contribuição para a frente', 'Contributo al fronte'],
  frontPts: ['points de front', 'front points', 'puntos de frente', 'Frontpunkte', 'pontos de frente', 'punti fronte'],
  m_attack: ['Attaque', 'Attack', 'Ataque', 'Angriff', 'Ataque', 'Attacco'],
  m_defend: ['Défense', 'Defence', 'Defensa', 'Verteidigung', 'Defesa', 'Difesa'],
  m_reserve: ['Effort général : ce territoire n’est pas au contact de ton camp', 'General effort: this territory does not touch your side', 'Esfuerzo general: este territorio no toca tu bando', 'Allgemeiner Einsatz: Dieses Gebiet grenzt nicht an deine Seite', 'Esforço geral: este território não toca o teu lado', 'Sforzo generale: questo territorio non tocca la tua parte'],
  w_short: ['Partie trop courte (2 min minimum) : ne compte pas.', 'Match too short (2 min minimum): does not count.', 'Partida demasiado corta (2 min mínimo): no cuenta.', 'Match zu kurz (mind. 2 Min): zählt nicht.', 'Partida demasiado curta (2 min mínimo): não conta.', 'Partita troppo breve (minimo 2 min): non conta.'],
  w_presence: ['Arrivé trop tard dans la partie : ne compte pas.', 'Joined too late: does not count.', 'Llegaste demasiado tarde: no cuenta.', 'Zu spät beigetreten: zählt nicht.', 'Entraste tarde demais: não conta.', 'Entrato troppo tardi: non conta.'],
  w_opposition: ['Pas assez d’adversaires : ne compte pas.', 'Not enough opponents: does not count.', 'Pocos adversarios: no cuenta.', 'Zu wenige Gegner: zählt nicht.', 'Adversários insuficientes: não conta.', 'Avversari insufficienti: non conta.'],
  w_idle: ['Aucune action dans la partie : ne compte pas.', 'No action in the match: does not count.', 'Ninguna acción en la partida: no cuenta.', 'Keine Aktion im Match: zählt nicht.', 'Nenhuma ação na partida: não conta.', 'Nessuna azione in partita: non conta.'],
  w_reason: ['Partie interrompue : ne compte pas.', 'Match interrupted: does not count.', 'Partida interrumpida: no cuenta.', 'Match abgebrochen: zählt nicht.', 'Partida interrompida: não conta.', 'Partita interrotta: non conta.'],
  c_bots: ['Bots ×{w}', 'Bots ×{w}', 'Bots ×{w}', 'Bots ×{w}', 'Bots ×{w}', 'Bot ×{w}'],
  c_obj: ['Objectif ×2', 'Objective ×2', 'Objetivo ×2', 'Ziel ×2', 'Objetivo ×2', 'Obiettivo ×2'],
  c_under: ['Renfort ×{m}', 'Underdog ×{m}', 'Refuerzo ×{m}', 'Verstärkung ×{m}', 'Reforço ×{m}', 'Rinforzo ×{m}'],
  c_cap: ['Plafond horaire atteint', 'Hourly cap reached', 'Límite por hora alcanzado', 'Stundenlimit erreicht', 'Limite horário atingido', 'Limite orario raggiunto'],
  won: ['Territoire conquis !', 'Territory taken!', '¡Territorio conquistado!', 'Gebiet erobert!', 'Território conquistado!', 'Territorio conquistato!'],
  lost: ['Territoire perdu', 'Territory lost', 'Territorio perdido', 'Gebiet verloren', 'Território perdido', 'Territorio perso'],
  seasonLine: ['Saison : {n} pts · {s} % de {f}', 'Season: {n} pts · {s} % of {f}', 'Temporada: {n} pts · {s} % de {f}', 'Saison: {n} Pkt · {s} % von {f}', 'Temporada: {n} pts · {s} % de {f}', 'Stagione: {n} pt · {s} % di {f}'],
  offline: ['Serveur injoignable : dernière carte connue.', 'Server unreachable: last known map.', 'Servidor inaccesible: último mapa conocido.', 'Server nicht erreichbar: letzte bekannte Karte.', 'Servidor inacessível: último mapa conhecido.', 'Server irraggiungibile: ultima mappa nota.'],
  waiting: ['En attente du serveur…', 'Waiting for the server…', 'Esperando al servidor…', 'Warte auf den Server…', 'À espera do servidor…', 'In attesa del server…'],
  oldServer: ['Ce serveur n’a pas encore le front.', 'This server has no front yet.', 'Este servidor aún no tiene el frente.', 'Dieser Server hat noch keine Front.', 'Este servidor ainda não tem a frente.', 'Questo server non ha ancora il fronte.'],
  soloNote: ['Solo : ne compte pas pour le front', 'Solo: does not count for the front', 'Solitario: no cuenta para el frente', 'Solo: zählt nicht für die Front', 'Solo: não conta para a frente', 'Solitaria: non conta per il fronte'],
  switch: ['Changer de camp', 'Switch sides', 'Cambiar de bando', 'Seite wechseln', 'Mudar de lado', 'Cambia parte'],
  switchIn: ['Changement de camp possible dans {d}', 'Side switch possible in {d}', 'Cambio de bando posible en {d}', 'Seitenwechsel möglich in {d}', 'Mudança de lado possível em {d}', 'Cambio di parte possibile tra {d}'],
  switchNo: ['Plus de changement de camp cette saison', 'No more side switch this season', 'No más cambios de bando esta temporada', 'Kein Seitenwechsel mehr in dieser Saison', 'Sem mais mudanças de lado nesta temporada', 'Niente più cambi di parte questa stagione'],
  switchAsk: ['Passer à {f} ? Un seul changement par saison.', 'Switch to {f}? Only one switch per season.', '¿Pasar a {f}? Solo un cambio por temporada.', 'Zu {f} wechseln? Nur ein Wechsel pro Saison.', 'Passar para {f}? Só uma mudança por temporada.', 'Passare a {f}? Un solo cambio per stagione.'],
  confirm: ['Confirmer', 'Confirm', 'Confirmar', 'Bestätigen', 'Confirmar', 'Conferma'],
  cancel: ['Annuler', 'Cancel', 'Cancelar', 'Abbrechen', 'Cancelar', 'Annulla'],
  back: ['Retour', 'Back', 'Volver', 'Zurück', 'Voltar', 'Indietro'],
  reward: ['Récompense de saison', 'Season reward', 'Recompensa de temporada', 'Saisonbelohnung', 'Recompensa de temporada', 'Ricompensa stagionale'],
  rewardFor: ['Si {f} tient le plus de territoires à la fin de la saison', 'If {f} holds more territory at the end of the season', 'Si {f} tiene más territorios al final de la temporada', 'Wenn {f} am Saisonende mehr Gebiete hält', 'Se {f} tiver mais territórios no fim da temporada', 'Se {f} tiene più territori a fine stagione'],
  rewardMin: ['60 points de front pour {f} au moins. Jamais vendu.', 'At least 60 front points for {f}. Never sold.', 'Al menos 60 puntos de frente para {f}. Nunca a la venta.', 'Mindestens 60 Frontpunkte für {f}. Nie im Verkauf.', 'Pelo menos 60 pontos de frente para {f}. Nunca vendido.', 'Almeno 60 punti fronte per {f}. Mai in vendita.'],
  rewardGot: ['Obtenu', 'Earned', 'Obtenido', 'Erhalten', 'Obtido', 'Ottenuto'],
  apply: ['Appliquer sur {w}', 'Apply to {w}', 'Aplicar a {w}', 'Auf {w} anwenden', 'Aplicar a {w}', 'Applica a {w}'],
  lastContrib: ['Dernière contribution : {p} · {map}', 'Last contribution: {p} · {map}', 'Última contribución: {p} · {map}', 'Letzter Beitrag: {p} · {map}', 'Última contribuição: {p} · {map}', 'Ultimo contributo: {p} · {map}'],
  objBanner: ['Objectif de la semaine', 'Objective of the week', 'Objetivo de la semana', 'Ziel der Woche', 'Objetivo da semana', 'Obiettivo della settimana'],
  lockNote: ['Dernière semaine : changements de camp fermés.', 'Last week: side switches closed.', 'Última semana: cambios de bando cerrados.', 'Letzte Woche: Seitenwechsel geschlossen.', 'Última semana: mudanças de lado fechadas.', 'Ultima settimana: cambi di parte chiusi.'],
  tw_revanche: ['Revanche : le camp vaincu commence avec la Cité', 'Revenge: the beaten side starts with the City', 'Revancha: el bando vencido empieza con la Ciudad', 'Revanche: Die besiegte Seite beginnt mit der Stadt', 'Desforra: o lado vencido começa com a Cidade', 'Rivincita: la parte sconfitta parte con la Città'],
  tw_brulee: ['Terre brûlée : le centre part en ruines', 'Scorched earth: the centre starts in ruins', 'Tierra quemada: el centro empieza en ruinas', 'Verbrannte Erde: Das Zentrum beginnt in Trümmern', 'Terra queimada: o centro começa em ruínas', 'Terra bruciata: il centro parte in rovina'],
  tw_inverse: ['Front inversé : les camps échangent leurs moitiés', 'Reversed front: the sides swap halves', 'Frente invertido: los bandos cambian de mitad', 'Umgekehrte Front: Die Seiten tauschen ihre Hälften', 'Frente invertida: os lados trocam de metade', 'Fronte invertito: le parti si scambiano le metà'],
  sheet: ['Théâtre du Couchant', 'Couchant theatre', 'Teatro del Couchant', 'Kriegsschauplatz Couchant', 'Teatro do Couchant', 'Teatro del Couchant'],
  live: ['En direct', 'Live', 'En directo', 'Live', 'Em direto', 'In diretta'],
  forces: ['Rapport des forces', 'Balance of forces', 'Equilibrio de fuerzas', 'Kräfteverhältnis', 'Relação de forças', 'Rapporto di forze'],
  holds: ['Territoires tenus', 'Territories held', 'Territorios', 'Gehaltene Gebiete', 'Territórios', 'Territori tenuti'],
  sea: ['Golfe du Couchant', 'Gulf of Couchant', 'Golfo del Couchant', 'Golf von Couchant', 'Golfo do Couchant', 'Golfo del Couchant'],
};

/* ---------- small helpers ---------- */
const KEY = 'frontzero.front';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const httpBase = url => String(url || '').replace(/^ws(s?):/i, 'http$1:').replace(/\/ws\/?$/, '');
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const newId = () => { const b = new Uint8Array(16); crypto.getRandomValues(b); return b64url(b); };
function load() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* private mode: the session keeps it */ } }

/** The starting front, shown before the server answered once. */
function localState(now) {
  const terr = IDS.map(id => { const own = START.A.includes(id) ? 'A' : START.B.includes(id) ? 'B' : null; return { id, own, v: own === 'A' ? -70 : own === 'B' ? 70 : 0, dmg: 0, ...(id === 'port' || id === 'noirval' ? { cap: 1, v: id === 'port' ? -100 : 100 } : null), ...(own ? null : { c: 1, att: ['A', 'B'] }) }; });
  return { v: 1, t: now, local: 1, season: { id: 's1', n: 1, week: 0, weeks: 8, start: 0, end: 0, wEnd: 0 }, sides: { A: { terr: 5, pts: 0, n: 0 }, B: { terr: 5, pts: 0, n: 0 } }, terr, off: [], ev: [], hist: [] };
}

/* ---------- styles ---------- */
const CSS = `
.fzw-band,.fzw,.fzw-pick,.fzw-contrib,.fzw-obj{--A:${FACTIONS.A.main};--Al:${FACTIONS.A.light};--Ad:${FACTIONS.A.dark};--B:${FACTIONS.B.main};--Bl:${FACTIONS.B.light};--Bd:${FACTIONS.B.dark};--amber:#f0ae2e;--hair:rgba(236,226,198,.17);--hair2:rgba(236,226,198,.36);--sand:#e9e1c9;--dim:#a9a28b;--white:#f7f0dc;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif}
.fzw-panel{border:1px solid var(--hair);background:linear-gradient(#f0ae2e,#f0ae2e) 0 0/22px 2px no-repeat border-box,linear-gradient(180deg,rgba(28,32,26,.94),rgba(13,15,12,.92));clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}
/* theatre map */
.fzw-map{display:block;width:100%;height:auto;user-select:none;-webkit-user-select:none}
.fzw-map text{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif}
.fzw-cell{transition:fill-opacity .25s}
.fzw-t{cursor:pointer;outline:none}
/* hover = one outline path in the light overlay (.fzw-hov, set by hoverAt): a :hover rule on the cell repainted the whole detailed map
   on every territory change, and the names, markers and bars on top of a cell dropped the hover (it flickered); they let the pointer through now */
.fzw-t:focus-visible .fzw-cell{fill-opacity:.62}
.fzw-t.is-sel .fzw-cell{stroke:#fff;stroke-width:2.4;stroke-opacity:.9}
.fzw-mw{position:relative}
.fzw-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;will-change:transform}
/* The map overlay is driven by ONE 10 Hz timer writing a few custom properties on the overlay root (fxTick): one small style update
   and one small overlay repaint per tick, nothing when the menu is hidden, the tab is hidden, the motion is reduced or the preset is low. */
.fzw-fx .fzw-fl{stroke-dasharray:16 11;stroke-dashoffset:calc(var(--fzA, 0) * -1px)}
.fzw-fx .fzw-fln{stroke-dasharray:6 8;stroke-dashoffset:calc(var(--fzB, 0) * -1px)}
.fzw-fx .fzw-arrow{stroke-dasharray:12 9;stroke-dashoffset:calc(var(--fzC, 0) * -1px)}
.fzw-fx .fzw-pulse{transform-box:fill-box;transform-origin:center;transform:scale(var(--fzS, 1));opacity:var(--fzO, .7)}
.fzw-fx .fzw-glowA{opacity:var(--fzG, .8)}
.fzw-zz .fzw-fl{stroke-dasharray:16 11;animation:fzwFlow 2s steps(24) infinite}
.fzw-sweep{animation:fzwSweep 9s linear infinite;transform-origin:500px 300px}
@keyframes fzwFlow{to{stroke-dashoffset:-54}}
@keyframes fzwPulse{0%{transform:scale(.55);opacity:.95}100%{transform:scale(1.5);opacity:0}}
@keyframes fzwBreath{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes fzwCont{0%,100%{opacity:.25}50%{opacity:.7}}
@keyframes fzwSweep{to{transform:rotate(360deg)}}
/* home band */
.fzm .fzm-play-grid>.fzw-band{grid-column:1/-1}
@media (min-width:1181px){.fzm .fzm-play-grid>.fzw-band{grid-column:1/3;grid-row:1}.fzm .fzm-play-grid>.fzw-band~.fzm-col{grid-row:2}.fzm .fzm-play-grid>.fzw-band~.fzm-side{grid-column:3;grid-row:1/3}
 .fzm .fzm-play-grid>.fzw-band~.fzo-band{grid-column:1/3;grid-row:2}.fzm .fzm-play-grid>.fzw-band~.fzo-band~.fzm-col{grid-row:3}.fzm .fzm-play-grid>.fzw-band~.fzo-band~.fzm-side{grid-row:1/4}}
@media (max-width:1180px){.fzm .fzm-play-grid>.fzw-band{order:-3}}
.fzw-band{position:relative;display:grid;grid-template-columns:minmax(220px,340px) minmax(0,1fr) auto;align-items:stretch;gap:0;min-height:150px;padding:0;color:var(--sand);cursor:pointer;overflow:hidden;
 border:1px solid var(--hair);background:radial-gradient(420px 220px at 14% 50%,rgba(60,201,166,.10),transparent 70%),radial-gradient(420px 220px at 40% 50%,rgba(229,122,58,.08),transparent 70%),linear-gradient(180deg,rgba(24,28,22,.96),rgba(10,12,9,.95));clip-path:polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%)}
.fzw-band::before{content:"";position:absolute;left:0;top:0;width:28px;height:2px;background:var(--amber);z-index:2}
.fzw-band::after{content:"";position:absolute;top:0;bottom:0;left:0;width:40%;background:linear-gradient(105deg,transparent 20%,rgba(255,240,200,.06) 50%,transparent 80%);transform:translateX(-110%);animation:fzwShine 7s ease-in-out infinite;pointer-events:none;will-change:transform}
@keyframes fzwShine{0%,60%{transform:translateX(-110%)}100%{transform:translateX(260%)}}
.fzw-band:hover{border-color:var(--hair2)}
.fzw-band:focus-visible{outline:2px solid var(--white);outline-offset:2px}
.fzw-bmap{position:relative;border-right:1px solid var(--hair);background:#0a0d0b;min-height:100%}
.fzw-bmap svg,.fzw-bmap .fzw-mw{position:absolute;inset:0;width:100%;height:100%}
.fzw-bmid{display:grid;align-content:center;gap:10px;padding:14px 20px;min-width:0}
.fzw-bhead{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.fzw-bhead b{font-size:24px;font-weight:800;letter-spacing:.16em;color:var(--white);text-transform:uppercase}
.fzw-bhead span{font-size:15px;font-weight:700;letter-spacing:.12em;color:var(--dim);text-transform:uppercase}
.fzw-live{display:inline-flex;align-items:center;gap:7px;font-size:13px!important;font-weight:800!important;letter-spacing:.2em!important;color:#ff6a4a!important}
.fzw-live{position:relative}
.fzw-live::before{content:"";width:8px;height:8px;border-radius:50%;background:#ff5a3a}
.fzw-live::after{content:"";position:absolute;left:0;top:50%;width:8px;height:8px;margin-top:-4px;border-radius:50%;border:2px solid rgba(255,90,58,.8);box-sizing:border-box;animation:fzwLive 1.6s ease-out infinite;will-change:transform,opacity}
@keyframes fzwLive{0%{transform:scale(1);opacity:1}100%{transform:scale(3);opacity:0}}
.fzw-tug{display:grid;grid-template-columns:auto minmax(80px,1fr) auto;align-items:center;gap:12px}
.fzw-tug-side{display:flex;align-items:center;gap:8px;font-size:20px;font-weight:800;letter-spacing:.08em;white-space:nowrap}
.fzw-tug-side small{font-size:14px;font-weight:700;color:var(--dim);letter-spacing:.06em}
.fzw-tug-side.is-a{color:var(--A)}.fzw-tug-side.is-b{color:var(--B);flex-direction:row-reverse}
.fzw-tugbar{position:relative;height:10px;background:rgba(255,255,255,.06);clip-path:polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%);overflow:hidden}
.fzw-tugbar i{position:absolute;top:0;bottom:0}
.fzw-tugbar .a{left:0;background:linear-gradient(90deg,var(--Ad),var(--A))}.fzw-tugbar .b{right:0;background:linear-gradient(270deg,var(--Bd),var(--B))}
.fzw-tugbar .n{background:repeating-linear-gradient(135deg,rgba(236,226,198,.12) 0 4px,transparent 4px 8px)}
.fzw-chips{display:flex;flex-wrap:wrap;gap:8px}
.fzw-offline{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:-2px}
.fzw-offline b{font-size:16px;font-weight:800;letter-spacing:.16em;color:var(--amber);text-transform:uppercase}
.fzw-offline small{font-size:14px;color:var(--dim);font-weight:700;letter-spacing:.06em}
.fzw-chip{display:inline-flex;align-items:center;gap:8px;min-height:30px;padding:3px 12px 3px 8px;font-size:16px;font-weight:700;letter-spacing:.06em;color:var(--white);border:1px solid rgba(240,174,46,.45);background:linear-gradient(90deg,rgba(240,174,46,.18),rgba(240,174,46,.04));clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%);white-space:nowrap}
.fzw-chip em{font-style:normal;font-size:13px;font-weight:800;color:#17140a;background:var(--amber);padding:0 6px;letter-spacing:.04em}
.fzw-chip small{font-size:14px;color:var(--dim);font-weight:600}
.fzw-bright{display:grid;align-content:center;justify-items:end;gap:10px;padding:14px 18px 14px 6px}
.fzw-me{display:flex;align-items:center;gap:10px;font-size:15px;color:var(--dim);font-weight:600;letter-spacing:.04em;text-align:right}
.fzw-me b{display:block;font-size:19px;font-weight:800;letter-spacing:.12em;color:var(--white)}
.fzw-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:0 20px;font:inherit;font-size:18px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#17140a;background:linear-gradient(180deg,#ffc650,#e5a024);border:0;cursor:pointer;clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);white-space:nowrap}
.fzw-btn:hover{background:linear-gradient(180deg,#ffd77a,#f0ae2e)}
.fzw-btn.ghost{color:var(--sand);background:rgba(8,10,7,.5);border:1px solid var(--hair2)}
.fzw-btn.ghost:hover{border-color:var(--amber);color:#fff}
.fzw-btn::after{content:"";width:8px;height:8px;border-right:2px solid currentColor;border-top:2px solid currentColor;transform:rotate(45deg)}
.fzw-btn.noarrow::after{display:none}
/* no side yet: CHOISIR UN CAMP breathes and a light runs across it, 4 times each time the band is drawn, then rests (a clip-path button
   repaints while it scales: ~15 ms of main thread per second if it never stopped); off with reduced motion or the low preset */
.fzw-invite{overflow:hidden;animation:fzwInvite 2.6s ease-in-out .8s 4}
.fzw-invite::before{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);transform:translateX(-120%);animation:fzwInviteSheen 2.6s ease-in-out .8s 4;pointer-events:none}
@keyframes fzwInvite{0%,100%{transform:scale(1)}45%{transform:scale(1.045)}60%{transform:scale(1)}}
@keyframes fzwInviteSheen{0%,40%{transform:translateX(-120%)}75%,100%{transform:translateX(120%)}}
html.fzw-still .fzw-invite,html.fzw-still .fzw-invite::before,html.fzx-rm .fzw-invite,html.fzx-rm .fzw-invite::before{animation:none}
@media (prefers-reduced-motion:reduce){.fzw-invite,.fzw-invite::before{animation:none}}
.fzw-note{font-size:14px;color:var(--dim);letter-spacing:.04em}
.fzw-tug-side{min-width:0;overflow:hidden;text-overflow:ellipsis}
@media (max-width:1560px){.fzw-band{grid-template-columns:minmax(200px,270px) minmax(0,1fr)}.fzw-bright{grid-column:2;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;justify-items:start;gap:8px 14px;padding:0 20px 14px}.fzw-me{text-align:left}.fzw-bmid{padding-bottom:6px}.fzw-tug-side svg{display:none}.fzw-bmap{grid-row:1/3}}
@media (max-height:840px) and (min-width:1181px){.fzw-band{min-height:118px}.fzw-bmid{gap:7px;padding:10px 16px}.fzw-bhead b{font-size:20px}.fzw-chip{min-height:26px;font-size:15px}.fzw-tug-side{font-size:17px}.fzw-btn{min-height:38px;font-size:16px}}
@media (max-width:760px){.fzw-band{grid-template-columns:1fr}.fzw-bmap{grid-row:auto;min-height:190px;border-right:0;border-bottom:1px solid var(--hair)}.fzw-bright{grid-column:auto;justify-items:stretch;padding:0 16px 14px}.fzw-me{text-align:left}}
/* war room */
.fzw{position:fixed;inset:0;z-index:17;display:grid;grid-template-rows:auto minmax(0,1fr);color:var(--sand);background:#090b09 radial-gradient(1200px 700px at 50% 40%,rgba(240,174,46,.07),transparent 65%);overflow:hidden;font-size:18px}
.fzw[hidden],.fzw-pick[hidden]{display:none}
.fzw *,.fzw-pick *{box-sizing:border-box}
.fzw :focus-visible,.fzw-pick :focus-visible{outline:2px solid var(--white);outline-offset:2px}
.fzw-top{display:flex;align-items:center;gap:18px;flex-wrap:wrap;min-height:72px;padding:10px clamp(14px,2.4vw,36px);background:linear-gradient(180deg,rgba(6,8,6,.85),rgba(10,12,9,.6));border-bottom:1px solid rgba(236,226,198,.15)}
.fzw-top h2{display:flex;align-items:center;gap:12px;margin:0;font-size:30px;font-weight:800;letter-spacing:.14em;color:var(--white);text-transform:uppercase}
.fzw-top h2::before{content:"";width:26px;height:26px;background:linear-gradient(135deg,var(--A) 0 50%,var(--B) 50%);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
.fzw-season{display:flex;gap:16px;flex-wrap:wrap;font-size:16px;font-weight:700;letter-spacing:.12em;color:var(--dim);text-transform:uppercase}
.fzw-season b{color:var(--white)}
.fzw-top .fzw-btn{margin-left:auto}
.fzw-body{display:grid;grid-template-columns:minmax(260px,320px) minmax(0,1fr) minmax(280px,340px);gap:clamp(12px,1.4vw,22px);padding:clamp(12px,1.6vw,24px) clamp(14px,2.4vw,36px);min-height:0;overflow:auto}
.fzw-col{display:grid;align-content:start;gap:clamp(10px,1.2vw,16px);min-width:0}
.fzw-mapbox{position:relative;align-self:start;border:1px solid var(--hair);background:#080a08;clip-path:polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%)}
.fzw-mapbox::before{content:"";position:absolute;left:0;top:0;width:30px;height:2px;background:var(--amber);z-index:2}
.fzw-maplegend{display:flex;flex-wrap:wrap;gap:6px 18px;padding:8px 14px;font-size:14px;color:var(--dim);letter-spacing:.06em;border-top:1px solid var(--hair)}
.fzw-maplegend i{display:inline-block;width:18px;height:8px;margin-right:6px;vertical-align:1px}
.fzw-box{padding:14px 16px 16px}
.fzw-h{margin:0 0 10px;display:flex;align-items:center;gap:10px;font-size:15px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}
.fzw-h::before{content:"";width:8px;height:8px;background:var(--amber);transform:rotate(45deg)}
.fzw-side{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 14px;align-items:center}
.fzw-side .emb{grid-row:1/4}
.fzw-side b{font-size:32px;font-weight:800;letter-spacing:.12em;line-height:1}
.fzw-side i{font-style:normal;font-size:17px;color:var(--sand)}
.fzw-side small{font-size:15px;color:var(--dim)}
.fzw-score{display:grid;gap:10px}
.fzw-srow{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;font-size:17px}
.fzw-srow b{display:block;font-size:22px;font-weight:800;letter-spacing:.1em;line-height:1.05}
.fzw-srow small{display:block;color:var(--dim);font-size:14px}
.fzw-srow strong{font-size:44px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;text-shadow:0 0 18px currentColor}
.fzw-off{position:relative;display:grid;gap:10px;padding:14px 16px 16px;border:1px solid rgba(240,174,46,.5);background:linear-gradient(160deg,rgba(80,52,12,.55),rgba(20,16,8,.92) 60%);clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%);overflow:hidden}
.fzw-off::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(240,174,46,.06) 0 10px,transparent 10px 22px);pointer-events:none}
.fzw-offh{display:grid;gap:2px}
.fzw-offh b{font-size:21px;font-weight:800;letter-spacing:.16em;color:var(--amber);text-transform:uppercase}
.fzw-offh span{font-size:15px;color:var(--sand);font-weight:700;letter-spacing:.06em}
.fzw-obj{position:relative;display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;align-items:center;min-height:66px;cursor:pointer;z-index:1}
.fzw-obj img,.fzw-obj .ph{width:96px;height:60px;object-fit:cover;border:1px solid rgba(240,174,46,.45);background:#1a1610;clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)}
.fzw-obj b{display:block;font-size:20px;font-weight:800;color:var(--white);letter-spacing:.04em}
.fzw-obj span{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--sand);font-weight:700;letter-spacing:.04em}
.fzw-obj span em{font-style:normal;font-size:13px;font-weight:800;color:#17140a;background:var(--amber);padding:0 6px}
.fzw-obj small{display:block;font-size:14px;color:var(--dim)}
.fzw-det b.n{display:block;font-size:28px;font-weight:800;color:var(--white);letter-spacing:.03em;line-height:1.05}
.fzw-det .st{display:flex;flex-wrap:wrap;gap:6px 12px;margin:6px 0 10px;font-size:15px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.fzw-ctl{position:relative;height:14px;margin:4px 0 6px;background:rgba(255,255,255,.05)}
.fzw-ctl i{position:absolute;top:0;bottom:0}
.fzw-ctl .a{left:0;background:linear-gradient(90deg,var(--Ad),var(--A))}.fzw-ctl .b{right:0;background:linear-gradient(270deg,var(--Bd),var(--B))}
.fzw-ctl .t{width:2px;background:rgba(255,255,255,.55)}
.fzw-ctl .m{width:4px;margin-left:-2px;top:-4px;bottom:-4px;background:#fff;box-shadow:0 0 8px #fff}
.fzw-ctlx{display:flex;justify-content:space-between;font-size:14px;font-weight:700;letter-spacing:.06em}
.fzw-feed{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.fzw-feed li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:start;font-size:16px;line-height:1.2}
.fzw-feed li small{display:block;color:var(--dim);font-size:13px}
.fzw-feed svg{width:22px;height:22px}
.fzw-how{margin:0;padding-left:18px;display:grid;gap:6px;font-size:16px;line-height:1.25;color:var(--sand)}
.fzw-rew{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.fzw-rew figure{margin:0;display:grid;gap:6px;justify-items:center;padding:10px 8px;border:1px solid var(--hair);background:rgba(0,0,0,.3);text-align:center;font-size:14px;color:var(--dim)}
.fzw-rew figure b{font-size:16px;color:var(--white);letter-spacing:.04em}
.fzw-swatch{position:relative;display:block;width:100%;aspect-ratio:2/1;border:1px solid rgba(255,255,255,.12);overflow:hidden}
.fzw-swatch img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.fzw-rew figure.is-a{box-shadow:inset 0 2px 0 var(--A)}.fzw-rew figure.is-b{box-shadow:inset 0 2px 0 var(--B)}
@media (max-width:1180px){.fzw-body{grid-template-columns:minmax(0,1fr) minmax(260px,320px)}.fzw-body>.fzw-col:first-child{order:2}.fzw-mapbox{grid-column:1/-1}}
@media (max-width:760px){.fzw-body{grid-template-columns:minmax(0,1fr)}.fzw-top h2{font-size:24px}}
/* faction choice */
.fzw-pick{position:fixed;inset:0;z-index:19;display:grid;grid-template-rows:auto minmax(0,1fr) auto;color:var(--sand);background:#070807;overflow:auto}
.fzw-pick-head{position:relative;z-index:2;display:grid;justify-items:center;gap:8px;padding:clamp(18px,4vh,42px) 16px 8px;text-align:center}
.fzw-pick-head h2{margin:0;font-size:clamp(34px,4.6vw,64px);font-weight:800;letter-spacing:.16em;color:var(--white);text-transform:uppercase;text-shadow:0 6px 30px rgba(0,0,0,.6)}
.fzw-pick-head p{margin:0;max-width:760px;font-size:clamp(17px,1.5vw,21px);color:var(--sand);line-height:1.3}
.fzw-halves{position:relative;display:grid;grid-template-columns:1fr 1fr;min-height:0}
.fzw-half{position:relative;display:grid;align-content:center;justify-items:center;gap:14px;padding:clamp(16px,3vh,36px) clamp(16px,3vw,48px);text-align:center;overflow:hidden;cursor:pointer;border:0;font:inherit;color:inherit;background:none}
.fzw-half::before{content:"";position:absolute;inset:0;opacity:.85;transition:opacity .3s}
.fzw-half.is-a::before{background:radial-gradient(60% 70% at 50% 45%,rgba(60,201,166,.26),transparent 70%),linear-gradient(90deg,rgba(12,37,32,.9),rgba(7,8,7,.3))}
.fzw-half.is-b::before{background:radial-gradient(60% 70% at 50% 45%,rgba(229,122,58,.26),transparent 70%),linear-gradient(270deg,rgba(42,20,9,.9),rgba(7,8,7,.3))}
.fzw-half:hover::before,.fzw-half:focus-visible::before{opacity:1}
.fzw-half>*{position:relative}
.fzw-half .emb svg{filter:drop-shadow(0 0 28px var(--glow));transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.fzw-half:hover .emb svg{transform:scale(1.05)}
.fzw-half.is-a{--glow:rgba(60,201,166,.55)}.fzw-half.is-b{--glow:rgba(229,122,58,.55)}
.fzw-half h3{margin:0;font-size:clamp(46px,6vw,92px);font-weight:800;letter-spacing:.14em;line-height:.95}
.fzw-half.is-a h3{color:var(--A)}.fzw-half.is-b h3{color:var(--B)}
.fzw-half q{font-size:clamp(20px,1.9vw,27px);color:var(--white);quotes:"« " " »"}
.fzw-half p{margin:0;max-width:420px;font-size:17px;color:var(--sand);line-height:1.3}
.fzw-half .stat{font-size:16px;font-weight:700;letter-spacing:.12em;color:var(--dim);text-transform:uppercase}
.fzw-half .go{margin-top:6px;min-height:56px;font-size:22px}
.fzw-half.is-a .go{background:linear-gradient(180deg,#6fe3c4,#2fb592);color:#04140f}
.fzw-half.is-b .go{background:linear-gradient(180deg,#ffa86a,#d9652a);color:#1c0b03}
.fzw-pick-bg{position:absolute;inset:0;opacity:.34;pointer-events:none}
.fzw-pick-bg svg{width:100%;height:100%}
.fzw-pick-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,20,17,.55),rgba(7,8,7,.75) 50%,rgba(26,12,5,.55)),radial-gradient(70% 60% at 50% 50%,transparent,rgba(5,6,5,.85))}
.fzw-pick-head small{font-size:16px;font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:var(--amber)}
.fzw-half .wm{position:absolute;top:50%;width:620px;height:620px;margin-top:-310px;opacity:.07;pointer-events:none}
.fzw-half.is-a .wm{left:-170px;transform:rotate(-10deg)}.fzw-half.is-b .wm{right:-170px;transform:rotate(10deg)}
.fzw-half .held{max-width:440px;font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--sand);opacity:.75;line-height:1.5}
.fzw-half:focus-visible{outline:2px solid var(--glow);outline-offset:-8px}
.fzw-zz{position:absolute;left:50%;top:0;width:40px;height:100%;margin-left:-20px;z-index:1;pointer-events:none}
.fzw-divide{position:absolute;left:50%;top:0;bottom:0;width:0;z-index:1;pointer-events:none}
.fzw-divide::before{content:"";position:absolute;left:-1px;top:0;bottom:0;width:2px;background:linear-gradient(180deg,transparent,var(--amber) 20%,var(--amber) 80%,transparent);box-shadow:0 0 18px rgba(240,174,46,.7)}
.fzw-divide::after{content:"";position:absolute;left:-1px;top:0;bottom:0;width:2px;background:repeating-linear-gradient(180deg,#fff 0 12px,transparent 12px 26px);opacity:.75;animation:fzwDown 1.2s linear infinite}
@keyframes fzwDown{to{background-position:0 26px}}
.fzw-pick-foot{position:relative;z-index:2;display:flex;justify-content:center;align-items:center;gap:20px;flex-wrap:wrap;padding:12px 16px clamp(14px,3vh,28px);font-size:16px;color:var(--dim);text-align:center}
.fzw-link{font:inherit;font-size:17px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--sand);background:none;border:0;border-bottom:1px solid var(--hair2);cursor:pointer;padding:4px 2px}
.fzw-link:hover{color:#fff;border-color:var(--amber)}
/* phones: portrait 390 px, landscape 412 px high, fingers (44 px targets) */
@media (max-width:760px){.fzw-pick{display:block}.fzw-pick>*{position:relative}.fzw-halves{display:block}.fzw-half{display:grid;width:100%;overflow:hidden;align-content:start}.fzw-pick-bg{position:fixed}.fzw-half .emb svg{width:120px;height:120px}.fzw-half h3{font-size:46px}.fzw-half .held{display:none}.fzw-half{padding:14px 16px;gap:8px}.fzw-pick-head h2{font-size:30px}.fzw-top{min-height:56px}.fzw-season{font-size:13px;gap:8px}}
@media (max-height:500px){.fzw-pick-head{padding-top:8px;gap:2px}.fzw-pick-head h2{font-size:26px}.fzw-pick-head p{display:none}.fzw-half{gap:4px;padding:6px 16px}.fzw-half .emb svg{width:84px;height:84px}.fzw-half h3{font-size:36px}.fzw-half q{font-size:17px}.fzw-half p,.fzw-half .held,.fzw-half .stat{display:none}.fzw-half .go{margin-top:2px;min-height:44px;font-size:17px}.fzw-pick-foot{padding:4px 16px 8px;font-size:14px}.fzw-top{min-height:52px;padding-top:4px;padding-bottom:4px}.fzw-top h2{font-size:22px}}
@media (pointer:coarse){.fzw-link{display:inline-flex;align-items:center;min-height:44px}.fzw-btn{min-height:44px}.fzw-chip{min-height:36px}}
@media (max-width:760px){.fzw-halves{grid-template-columns:1fr}.fzw-divide,.fzw-zz{display:none}.fzw-half .wm{display:none}}
/* end-of-match contribution */
.fzw-contrib{position:relative;display:grid;gap:8px;padding:12px 16px 12px;color:var(--sand);border:1px solid var(--hair);background:linear-gradient(#f0ae2e,#f0ae2e) 0 0/22px 2px no-repeat border-box,radial-gradient(360px 160px at 0% 0%,var(--tint),transparent 70%),linear-gradient(180deg,rgba(28,32,26,.95),rgba(13,15,12,.93));clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%);overflow:hidden}
.fzw-contrib.is-a{--tint:rgba(60,201,166,.22);--c:var(--A)}.fzw-contrib.is-b{--tint:rgba(229,122,58,.22);--c:var(--B)}
.fzw-ch{display:flex;align-items:center;gap:12px}
.fzw-ch .t{display:grid;gap:2px;min-width:0}
.fzw-ch .t small{font-size:14px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.fzw-ch .t b{font-size:clamp(26px,2.4vw,34px);font-weight:800;color:var(--c);line-height:1;font-variant-numeric:tabular-nums}
.fzw-ch .t b span{font-size:15px;letter-spacing:.1em;color:var(--sand);margin-left:6px;text-transform:uppercase}
.fzw-ch .where{margin-left:auto;text-align:right;font-size:15px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sand)}
.fzw-ch .where small{display:block;color:var(--dim);font-size:13px}
.fzw-contrib .fzw-ctl{height:12px}
.fzw-contrib .fzw-ctl i{transition:width 1.1s cubic-bezier(.2,.7,.2,1),left 1.1s cubic-bezier(.2,.7,.2,1)}
.fzw-cbar{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;font-size:13px;font-weight:800;letter-spacing:.12em}
.fzw-cbar .fzw-ctl{margin:0}
.fzw-cfoot{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px}
.fzw-cfoot .c{font-size:14px;font-weight:800;letter-spacing:.06em;padding:1px 8px;border:1px solid var(--hair2);color:var(--sand)}
.fzw-cfoot .c.hot{border-color:var(--amber);color:var(--amber)}
.fzw-cfoot .fzw-note{margin-left:auto}
.fzw-flip{font-size:17px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#17140a;background:var(--c);padding:3px 12px;justify-self:start;clip-path:polygon(0 0,100% 0,calc(100% - 10px) 100%,0 100%);padding-right:22px;animation:fzwPop .5s cubic-bezier(.2,1.4,.4,1) both .9s}
.fzw-flip.lost{background:#ec8068}
@keyframes fzwPop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
.fzw-why{font-size:16px;color:var(--sand)}
/* in-match objective notice (DOM, removed after 7 s) */
.fzw-obj-note{position:fixed;left:50%;top:132px;z-index:12;transform:translateX(-50%);display:grid;justify-items:center;gap:2px;padding:8px 22px 10px;color:var(--white);text-align:center;border:1px solid rgba(240,174,46,.6);background:linear-gradient(180deg,rgba(60,40,10,.88),rgba(16,13,8,.88));clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 50%,calc(100% - 10px) 100%,10px 100%,0 50%);animation:fzwNote 7s ease both;pointer-events:none}
.fzw-obj-note small{font-size:14px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--amber)}
.fzw-obj-note b{font-size:24px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.fzw-obj-note span{font-size:16px;color:var(--sand)}
@keyframes fzwNote{0%{opacity:0;transform:translate(-50%,-8px)}8%,85%{opacity:1;transform:translate(-50%,0)}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.fzw-live::after,.fzw-fl,.fzw-fln,.fzw-arrow,.fzw-pulse,.fzw-glowA,.fzw-cont,.fzw-sweep,.fzw-band::after,.fzw-divide::after,.fzw-flip{animation:none!important}.fzw-pulse{opacity:.5}}
html.fzw-still .fzw-band::after,html.fzw-still .fzw-live::after,html.fzx-rm .fzw-live::after,html.fzx-rm .fzw-fl,html.fzx-rm .fzw-fln,html.fzx-rm .fzw-arrow,html.fzx-rm .fzw-pulse,html.fzx-rm .fzw-glowA,html.fzx-rm .fzw-cont,html.fzx-rm .fzw-sweep,html.fzx-rm .fzw-band::after,html.fzx-rm .fzw-divide::after,html.fzx-rm .fzw-flip{animation:none!important}
`;

/* ---------- the theatre map (SVG string) ---------- */
const RULE_ICON = {
  fog: '<path d="M3 8h13M6 12h15M3 16h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  dark: '<path d="M3 9h7l3-3h3v12h-3l-3-3H3Z" fill="currentColor"/><path d="M18 8l3-2M18 12h4M18 16l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  respawn: '<path d="M12 4v4M12 16v4M4 12h4M16 12h4" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  ammo: '<path d="M7 20V9l2-4 2 4v11ZM13 20V9l2-4 2 4v11Z" fill="currentColor"/>',
};
const ruleSvg = (r, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${RULE_ICON[r] || ''}</svg>`;
function emblemAt(f, x, y, size) { return emblem(f, size).replace('<svg ', `<svg x="${(x - size / 2).toFixed(1)}" y="${(y - size / 2).toFixed(1)}" `); }
/* terrain of the sheet: soft regions, contour lines around the hills, supply roads between neighbours (they show the adjacency) */
const HILLS = [[220, 92, 70], [450, 70, 80], [640, 80, 60], [800, 70, 70], [760, 520, 60], [880, 470, 50], [300, 210, 40], [560, 380, 36]];
function terrain(uid, compact) {
  let t = `<rect width="${VW}" height="${VH}" fill="#1a1e17"/>`
    + `<ellipse cx="200" cy="150" rx="260" ry="170" fill="url(#${uid}-rF)"/><ellipse cx="520" cy="40" rx="520" ry="120" fill="url(#${uid}-rS)"/>`
    + `<ellipse cx="820" cy="470" rx="300" ry="200" fill="url(#${uid}-rD)"/><ellipse cx="190" cy="520" rx="220" ry="130" fill="url(#${uid}-rM)"/><ellipse cx="500" cy="300" rx="170" ry="120" fill="url(#${uid}-rU)"/>`;
  if (compact) return t;
  let c = '';
  for (const [x, y, r] of HILLS) for (let k = 1; k <= 4; k++) { const rr = r * k / 4, pts = []; for (let a = 0; a < 24; a++) { const th = a / 24 * Math.PI * 2, w = rr * (1 + 0.12 * Math.sin(th * 3 + x) + 0.07 * Math.sin(th * 5 + y)); pts.push((x + Math.cos(th) * w * 1.25).toFixed(1) + ' ' + (y + Math.sin(th) * w * 0.8).toFixed(1)); } c += `<path d="M${pts.join('L')}Z"/>`; }
  t += `<g fill="none" stroke="#e9e1c9" stroke-opacity=".07" stroke-width="1">${c}</g>`;
  let roads = '';
  for (const a of IDS) for (const b of ADJ[a]) if (a < b) { const [x0, y0] = SITES[a], [x1, y1] = SITES[b], mx = (x0 + x1) / 2 + (y1 - y0) * 0.08, my = (y0 + y1) / 2 - (x1 - x0) * 0.08; roads += `<path d="M${x0} ${y0}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1} ${y1}"/>`; }
  return t + `<g fill="none" stroke="#e9dcb8" stroke-opacity=".2" stroke-width="1.4" stroke-dasharray="2 6" stroke-linecap="round">${roads}</g>`;
}
function coastPath() { const c = COAST; return 'M' + c.map(p => p[0] + ' ' + p[1]).join('L'); }
function landPath() { const c = COAST; return `M${c[0][0]} 0L${VW} 0L${VW} ${VH}L${c[c.length - 1][0]} ${VH}` + c.slice().reverse().map(p => 'L' + p[0] + ' ' + p[1]).join('') + 'Z'; }
function seaPath() { const c = COAST; return 'M0 0L' + c.map(p => p[0] + ' ' + p[1]).join('L') + `L0 ${VH}Z`; }
/** opts: { compact, sel, names(id)->string, label(k), uid } */
function theatreSvg(st, opts) {
  const o = opts || {}, compact = !!o.compact, uid = o.uid || 'm', T = {};
  for (const t of st.terr) T[t.id] = t;
  const fill = s => (s === 'A' ? 'var(--A)' : s === 'B' ? 'var(--B)' : '#3a3d36');
  let defs = `<defs>
    <clipPath id="${uid}-land"><path d="${landPath()}"/></clipPath>
    <linearGradient id="${uid}-sea" x1="0" x2="1"><stop offset="0" stop-color="#0c1a22"/><stop offset="1" stop-color="#132631"/></linearGradient>
    <radialGradient id="${uid}-vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
    <radialGradient id="${uid}-gA"><stop offset="0" stop-color="${FACTIONS.A.main}" stop-opacity=".55"/><stop offset="1" stop-color="${FACTIONS.A.main}" stop-opacity="0"/></radialGradient>
    <radialGradient id="${uid}-gB"><stop offset="0" stop-color="${FACTIONS.B.main}" stop-opacity=".55"/><stop offset="1" stop-color="${FACTIONS.B.main}" stop-opacity="0"/></radialGradient>
    <radialGradient id="${uid}-gO"><stop offset="0" stop-color="#f0ae2e" stop-opacity=".6"/><stop offset="1" stop-color="#f0ae2e" stop-opacity="0"/></radialGradient>
    <radialGradient id="${uid}-rF"><stop offset="0" stop-color="#2a3a26" stop-opacity=".9"/><stop offset="1" stop-color="#2a3a26" stop-opacity="0"/></radialGradient>
    <radialGradient id="${uid}-rS"><stop offset="0" stop-color="#5a6470" stop-opacity=".75"/><stop offset="1" stop-color="#5a6470" stop-opacity="0"/></radialGradient>
    <radialGradient id="${uid}-rD"><stop offset="0" stop-color="#5a4528" stop-opacity=".85"/><stop offset="1" stop-color="#5a4528" stop-opacity="0"/></radialGradient>
    <radialGradient id="${uid}-rM"><stop offset="0" stop-color="#22362f" stop-opacity=".9"/><stop offset="1" stop-color="#22362f" stop-opacity="0"/></radialGradient>
    <radialGradient id="${uid}-rU"><stop offset="0" stop-color="#3a3832" stop-opacity=".8"/><stop offset="1" stop-color="#3a3832" stop-opacity="0"/></radialGradient>
    <pattern id="${uid}-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V9" stroke="#e9e1c9" stroke-opacity=".12" stroke-width="2.5"/></pattern>
    <pattern id="${uid}-sA" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><path d="M0 0V14" stroke="${FACTIONS.A.main}" stroke-width="5"/></pattern>
    <pattern id="${uid}-sB" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><path d="M0 0V14" stroke="${FACTIONS.B.main}" stroke-width="5"/></pattern>
    <pattern id="${uid}-waves" width="40" height="18" patternUnits="userSpaceOnUse"><path d="M0 9 q10 -6 20 0 t20 0" fill="none" stroke="#5d8aa0" stroke-opacity=".16" stroke-width="1.2"/></pattern>
    <marker id="${uid}-hA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${FACTIONS.A.main}"/></marker>
    <marker id="${uid}-hB" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${FACTIONS.B.main}"/></marker>
  </defs>`;
  let g = `<rect width="${VW}" height="${VH}" fill="#0b0e0b"/>`;
  // sea, waves, coast
  g += `<path d="${seaPath()}" fill="url(#${uid}-sea)"/><path d="${seaPath()}" fill="url(#${uid}-waves)"/>`;
  // territories
  let cells = '';
  for (const id of IDS) {
    const t = T[id] || { own: null, v: 0 }, hold = t.own ? clamp((t.own === 'A' ? -t.v : t.v) / 100, 0, 1) : 0;
    const op = t.own ? (compact ? 0.3 + 0.3 * hold : 0.14 + 0.22 * hold) : 1;
    cells += `<g class="fzw-t${o.sel === id ? ' is-sel' : ''}" data-t="${id}"${compact ? '' : ` tabindex="0" role="button" aria-label="${esc(o.names ? o.names(id) : id)}"`}>`
      + `<path class="fzw-cell" d="${GEO.path[id]}" fill="${t.own ? fill(t.own) : `url(#${uid}-hatch)`}" fill-opacity="${op.toFixed(2)}" stroke="#050605" stroke-opacity=".55" stroke-width="3"/>`
      + `<path d="${GEO.path[id]}" fill="none" stroke="#e9e1c9" stroke-opacity=".16" stroke-width="1" pointer-events="none"/>`;
    if (t.c && !t.cap) { const att = (t.att || []).filter(s => s !== t.own); const s = att.length === 1 ? att[0] : t.own ? (t.own === 'A' ? 'B' : 'A') : null; if (s) cells += `<path d="${GEO.path[id]}" fill="url(#${uid}-s${s})" fill-opacity=".3" pointer-events="none"/>`; }
    cells += '</g>';
  }
  g += `<g clip-path="url(#${uid}-land)">${terrain(uid, compact)}${cells}`;
  // relief: river, mountains (north), dunes (south-east), contour wobble
  g += `<path d="${RIVER}" fill="none" stroke="#7fb3c8" stroke-opacity=".35" stroke-width="${compact ? 3 : 4}" stroke-linecap="round" pointer-events="none"/>`;
  if (!compact) {
    let mts = '';
    for (const [x, y, s] of [[160, 46, 1], [205, 30, 1.3], [262, 52, .9], [340, 38, 1.1], [395, 62, .8], [455, 34, 1.4], [515, 56, 1], [560, 28, 1.1], [690, 44, 1.2], [742, 30, .9], [800, 52, 1.1], [860, 36, 1], [930, 60, .8]]) mts += `<path d="M${x - 16 * s} ${y + 10 * s}L${x} ${y - 12 * s}L${x + 16 * s} ${y + 10 * s}M${x - 5 * s} ${y - 4 * s}L${x} ${y - 12 * s}L${x + 4 * s} ${y - 6 * s}" fill="none" stroke="#e9e1c9" stroke-opacity=".22" stroke-width="1.4"/>`;
    for (const [x, y] of [[700, 545], [760, 575], [840, 560], [905, 530], [930, 585], [650, 585]]) mts += `<path d="M${x - 22} ${y}q22 -14 44 0" fill="none" stroke="#d8b070" stroke-opacity=".22" stroke-width="1.4"/>`;
    g += `<g pointer-events="none">${mts}</g>`;
  }
  // borders between territories (all) and the front line (owners differ)
  let fl = '', fn = '';
  for (const e of GEO.edges) {
    const a = T[e.a] || {}, b = T[e.b] || {};
    if (a.own === b.own) continue;
    if (a.own && b.own) fl += `<path d="${e.d}"/>`;
    else fn += `<path d="${e.d}" stroke="${a.own ? fill(a.own) : fill(b.own)}"/>`;
  }
  g += `<g fill="none" stroke-linecap="round" pointer-events="none">`
    + `<g stroke="#f0ae2e" stroke-opacity=".18" stroke-width="${compact ? 9 : 16}">${fl}</g><g stroke="#ffcf6a" stroke-opacity=".55" stroke-width="${compact ? 3.5 : 5}">${fl}</g>`
    + `<g stroke-opacity=".35" stroke-width="${compact ? 2 : 2.6}">${fn}</g></g>`;
  let fx = `<g clip-path="url(#${uid}x-land)" fill="none" stroke-linecap="round"><g class="fzw-fl" stroke="#fff6dc" stroke-width="${compact ? 1.6 : 2}">${fl}</g>`
    + `<g class="fzw-fln" stroke-opacity=".8" stroke-width="${compact ? 2 : 2.6}">${fn}</g></g>`;
  g += '</g>';
  g += `<path d="${coastPath()}" fill="none" stroke="#9fc4d4" stroke-opacity=".45" stroke-width="2" pointer-events="none"/>`;
  // live offensive: arrows into each objective from each side that can attack it, pulsing target
  let off = '';
  for (const ob of st.off || []) {
    const t = T[ob.map]; if (!t || !SITES[ob.map]) continue;
    const [tx, ty] = SITES[ob.map];
    fx += `<circle cx="${tx}" cy="${ty}" r="${compact ? 70 : 74}" fill="url(#${uid}x-gO)" class="fzw-glowA"/>`;
    fx += `<circle class="fzw-pulse" cx="${tx}" cy="${ty}" r="${compact ? 30 : 34}" fill="none" stroke="#f0ae2e" stroke-width="${compact ? 3 : 2.5}"/>`;
    for (const s of t.att || []) {
      if (s === t.own) continue;
      let best = null, bd = 1e9;
      for (const n of ADJ[ob.map]) { const nt = T[n]; if (!nt || nt.own !== s) continue; const [nx, ny] = SITES[n], d = Math.hypot(nx - tx, ny - ty); if (d < bd) { bd = d; best = [nx, ny]; } }
      if (!best) continue;
      const [sx, sy] = best, ex = sx + (tx - sx) * 0.72, ey = sy + (ty - sy) * 0.72, mx = (sx + ex) / 2 + (ey - sy) * 0.18, my = (sy + ey) / 2 - (ex - sx) * 0.18;
      const sx2 = sx + (tx - sx) * 0.18, sy2 = sy + (ty - sy) * 0.18;
      off += `<path d="M${sx2.toFixed(1)} ${sy2.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${fill(s)}" stroke-opacity=".35" stroke-width="${compact ? 7 : 10}" stroke-linecap="round"/>`
        + `<path d="M${sx2.toFixed(1)} ${sy2.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${fill(s)}" stroke-opacity=".5" stroke-width="${compact ? 3.5 : 4}" stroke-linecap="round" marker-end="url(#${uid}-h${s})"/>`;
      fx += `<path class="fzw-arrow" d="M${sx2.toFixed(1)} ${sy2.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${fill(s)}" stroke-width="${compact ? 3.5 : 4}" stroke-linecap="round"/>`;
    }
  }
  g += `<g pointer-events="none">${off}</g>`;
  // sites: capitals with their emblem, markers, labels and control bars
  let sites = '';
  for (const id of IDS) {
    const t = T[id] || {}, [x, y] = SITES[id];
    if (t.cap && t.own) {
      fx += `<circle cx="${x}" cy="${y}" r="${compact ? 60 : 54}" fill="url(#${uid}x-g${t.own})" class="fzw-glowA"/>`;
      sites += `<circle cx="${x}" cy="${y}" r="${compact ? 60 : 54}" fill="url(#${uid}-g${t.own})" opacity=".45"/>` + emblemAt(FACTIONS[t.own], x, y, compact ? 58 : 50);
    } else if (!compact) {
      const c = t.own ? fill(t.own) : '#c9c2ab';
      sites += `<path d="M${x} ${y - 7}L${x + 7} ${y}L${x} ${y + 7}L${x - 7} ${y}Z" fill="${c}" stroke="#0b0e0b" stroke-width="2"/>`;
    }
    if (compact) continue;
    const name = (o.names ? o.names(id) : id).toUpperCase(), ly = t.cap ? y + 40 : y + 24;
    sites += `<text x="${x}" y="${ly}" text-anchor="middle" font-size="15" font-weight="800" letter-spacing="1.4" fill="#f7f0dc" stroke="#070807" stroke-width="3.4" paint-order="stroke">${esc(name)}</text>`;
    const w = 74, a = clamp((100 - (t.v || 0)) / 200, 0, 1), bx = x - w / 2, by = ly + 6;
    sites += `<rect x="${bx}" y="${by}" width="${w}" height="6" fill="#070807" stroke="#070807" stroke-width="2"/><rect x="${bx}" y="${by}" width="${(w * a).toFixed(1)}" height="6" fill="var(--A)"/><rect x="${(bx + w * a).toFixed(1)}" y="${by}" width="${(w * (1 - a)).toFixed(1)}" height="6" fill="var(--B)"/>`
      + `<rect x="${(bx + w * 0.25).toFixed(1)}" y="${by - 1}" width="1.2" height="8" fill="#070807"/><rect x="${(bx + w * 0.75).toFixed(1)}" y="${by - 1}" width="1.2" height="8" fill="#070807"/>`;
    let tag = '';
    if (t.cap) tag = o.label('hq');
    else if (t.c) tag = o.label('contested');
    if (tag) sites += `<text x="${x}" y="${by + 20}" text-anchor="middle" font-size="12" font-weight="800" letter-spacing="2" fill="${t.cap ? '#a9a28b' : '#f0ae2e'}" stroke="#070807" stroke-width="3" paint-order="stroke">${esc(tag.toUpperCase())}</text>`;
    if (t.dmg) sites += `<g transform="translate(${x + 30} ${y - 26})" opacity=".9"><circle r="${4 + t.dmg}" cx="0" cy="0" fill="#5b5650"/><circle r="${3 + t.dmg}" cx="5" cy="-6" fill="#46423d"/><circle r="${2 + t.dmg}" cx="-2" cy="-12" fill="#3a3733"/>${t.dmg > 1 ? '<path d="M-3 7q3 -9 6 -2q1 -6 4 -1q2 6 -5 8q-6 -1 -5 -5Z" fill="#ff7a2a"/>' : ''}</g>`;
    const ob = (st.off || []).find(q => q.map === id);
    if (ob) sites += `<g transform="translate(${x - 34} ${y - 50})"><rect width="68" height="22" fill="#f0ae2e"/><text x="34" y="16" text-anchor="middle" font-size="15" font-weight="800" fill="#17140a" letter-spacing="1">×2</text><g transform="translate(4 2)" color="#17140a">${ruleSvg(ob.rule, 18)}</g></g>`;
  }
  g += `<g pointer-events="none">${sites}</g>`;       // names, markers, bars and tags never take the pointer from the territory under them
  // frame: vignette, graticule ticks, compass, sea name
  if (!compact) {
    let ticks = ''; for (let x = 50; x < VW; x += 50) ticks += `<path d="M${x} 0v${x % 100 ? 5 : 9}M${x} ${VH}v-${x % 100 ? 5 : 9}"/>`; for (let y = 50; y < VH; y += 50) ticks += `<path d="M0 ${y}h${y % 100 ? 5 : 9}M${VW} ${y}h-${y % 100 ? 5 : 9}"/>`;
    g += `<g stroke="#e9e1c9" stroke-opacity=".35" stroke-width="1" pointer-events="none">${ticks}</g>`;
    g += `<g transform="translate(46 540)" pointer-events="none" opacity=".75"><circle r="22" fill="none" stroke="#e9e1c9" stroke-opacity=".35"/><path d="M0 -26L5 0L0 26L-5 0Z" fill="#e9e1c9" fill-opacity=".55"/><path d="M0 -26L5 0L-5 0Z" fill="#f0ae2e"/><text y="-31" text-anchor="middle" font-size="12" font-weight="800" fill="#e9e1c9">N</text></g>`;
    g += `<text x="30" y="200" font-size="14" font-weight="700" letter-spacing="4" fill="#8fb4c4" fill-opacity=".55" transform="rotate(-90 30 200)" text-anchor="middle" pointer-events="none">${esc(o.label('sea').toUpperCase())}</text>`;
  }
  if (!compact) g += `<g transform="translate(${VW - 214} ${VH - 58})" pointer-events="none"><rect width="196" height="42" fill="#070807" fill-opacity=".72" stroke="#e9e1c9" stroke-opacity=".25"/><text x="10" y="17" font-size="12" font-weight="800" letter-spacing="2.4" fill="#e9e1c9">${esc(o.label('sheet').toUpperCase())}</text><path d="M10 30h80" stroke="#e9e1c9" stroke-width="3"/><path d="M10 30h40" stroke="#070807" stroke-width="1.6" stroke-dasharray="8 8"/><text x="98" y="34" font-size="12" fill="#a9a28b">0 — 10 km</text></g>`;
  g += `<rect width="${VW}" height="${VH}" fill="url(#${uid}-vig)" pointer-events="none"/>`;
  g += `<rect x=".5" y=".5" width="${VW - 1}" height="${VH - 1}" fill="none" stroke="#e9e1c9" stroke-opacity=".18" pointer-events="none"/>`;
  const par = compact ? 'xMidYMid slice' : 'xMidYMid meet';
  const base = `<svg class="fzw-map" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="${par}" role="img" aria-label="${esc(o.label('title'))}">${defs}${g}</svg>`;
  if (o.noFx) return base;
  /* Only this light overlay animates (its own compositor layer, stepped animations): the detailed map under it is painted once. */
  const fdefs = `<defs><clipPath id="${uid}x-land"><path d="${landPath()}"/></clipPath>`
    + ['O', 'A', 'B'].map(k => { const c = k === 'O' ? '#f0ae2e' : FACTIONS[k].main; return `<radialGradient id="${uid}x-g${k}"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`; }).join('') + '</defs>';
  const hov = compact ? '' : `<g clip-path="url(#${uid}x-land)"><path class="fzw-hov" d="M0 0" fill="#f7f0dc" fill-opacity=".14" stroke="#fff6dc" stroke-opacity=".8" stroke-width="2.4" stroke-linejoin="round"/></g>`;
  return `<div class="fzw-mw">${base}<svg class="fzw-fx" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="${par}" aria-hidden="true">${fdefs}${hov}${fx}</svg></div>`;
}

/* ---------- the module ---------- */
export function install({ net, engine, menu, i18n, profile, settings, menuRoot, MAPS }) {
  if (document.getElementById('fzw-style')) return null;
  const li = () => Math.max(0, LANGS.indexOf((i18n && i18n.lang) || 'fr'));
  const L = (k, p) => { const row = TX[k]; let s = row ? (row[li()] || row[0]) : k; if (p) s = s.replace(/\{(\w+)\}/g, (m, x) => (x in p ? String(p[x]) : m)); return s; };
  const fmt = n => { try { return Number(n).toLocaleString((i18n && i18n.lang) || 'fr'); } catch { return String(n); } };
  const mapName = id => { try { const k = 'map.' + id, s = i18n.t(k); if (s && s !== k) return s; } catch { /* fall back */ } const m = (MAPS || []).find(x => x.id === id); return m ? m.name : id; };
  const fname = s => (FACTIONS[s] ? FACTIONS[s].name : '');
  const sfx = () => { try { if (engine && engine.audio && engine.audio.ui) engine.audio.ui(); } catch { /* optional */ } };
  const reduced = () => { try { return !!(settings && settings.get('gameplay.reducedMotion')) || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const dur = ms => { ms = Math.max(0, ms); const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4); return d ? L('dh', { d, h }) : L('hm', { h, m }); };
  const st = document.createElement('style'); st.id = 'fzw-style'; st.textContent = CSS; document.head.append(st);
  const base = httpBase(net && net.url);

  /* ---------- local memory ---------- */
  const mem = load();
  if (!mem.id || !/^[A-Za-z0-9_-]{22}$/.test(mem.id)) { mem.id = newId(); mem.sig = null; save(mem); }
  let pub = mem.cache && mem.cache.terr ? mem.cache : null, pubAt = 0, fetching = null, failN = 0, retryT = 0, hasServer = null, serverOld = false;
  const state = () => pub || localState(Date.now());
  const side = () => mem.side || mem.pend || null;

  /* ---------- server ---------- */
  async function fetchFront(force) {
    if (!base) return null;
    if (fetching) return fetching;
    if (!force && pub && !pub.local && Date.now() - pubAt < 45000) return pub;
    fetching = (async () => {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 70000);
      try {
        const r = await fetch(base + '/api/front', { cache: 'no-store', credentials: 'omit', signal: ctl.signal });
        if (r.status === 404) { serverOld = true; hasServer = true; return pub; }
        if (r.status === 429 || r.status === 503) { clearTimeout(retryT); retryT = setTimeout(() => { fetchFront(true).then(refresh); }, 4000); return pub; }       // busy, not down
        if (!r.ok) throw new Error('http ' + r.status);
        const j = await r.json();
        if (j && j.v === 1 && Array.isArray(j.terr)) { pub = j; pubAt = Date.now(); hasServer = true; serverOld = false; failN = 0; mem.cache = j; save(mem); }
        return pub;
      } catch { hasServer = false; failN++; clearTimeout(retryT); if (failN < 4) retryT = setTimeout(() => { fetchFront(true).then(refresh); }, [3000, 10000, 30000][failN - 1] || 30000); return pub; }
      finally { clearTimeout(to); fetching = null; }
    })();
    return fetching;
  }
  /* The signature of a new id comes from ONE request at a time (HTTP first): the WebSocket and HTTP never race on a fresh id,
     which the server would then see as "known id without signature". */
  let signing = null;
  function ensureSig() {
    if (mem.sig) return Promise.resolve(true);
    if (!base) return Promise.resolve(false);
    if (!signing) signing = (async () => {
      try {
        for (let k = 0; k < 2 && !mem.sig; k++) {
          const r = await fetch(base + '/api/front/me', { method: 'POST', body: JSON.stringify({ id: mem.id }), headers: { 'Content-Type': 'text/plain' }, credentials: 'omit', cache: 'no-store' });
          if (r.status === 404) { serverOld = true; return false; }
          const j = await r.json();
          if (j && j.sig && j.id === mem.id) { mem.sig = j.sig; save(mem); return true; }
          if (j && j.code === 'taken') { mem.id = newId(); save(mem); continue; }       // astronomically rare: someone else's id
          return false;
        }
        return !!mem.sig;
      } catch { return false; } finally { signing = null; }
    })();
    return signing;
  }
  async function postMe(extra) {
    if (!base) return null;
    try {
      if (!(await ensureSig())) return null;
      const body = { id: mem.id, sig: mem.sig, ...extra };
      const r = await fetch(base + '/api/front/me', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' }, credentials: 'omit', cache: 'no-store' });
      if (r.status === 404) { serverOld = true; return null; }
      const j = await r.json();
      return onMe(j);
    } catch { return null; }
  }
  /** {code?, id, sig, me} from HTTP or WS */
  let meAt = 0;
  function onMe(j) {
    if (!j) return null;
    meAt = Date.now();
    if (j.code === 'taken' || j.code === 'bad_sig' || j.code === 'bad_id') {       // this identity cannot be used here: a fresh one, same side choice
      mem.id = newId(); mem.sig = null; if (mem.side) { mem.pend = mem.side; mem.side = null; } save(mem);
      return j;
    }
    if (j.sig) mem.sig = j.sig;
    if (j.me && (j.me.side === 'A' || j.me.side === 'B')) { mem.side = j.me.side; if (mem.pend === j.me.side) mem.pend = null; mem.me = j.me; }
    else if (j.me && j.me.side === null && mem.side) { mem.pend = mem.side; mem.side = null; }       // the server lost its state: our choice is sent again
    save(mem); refresh();
    return j;
  }
  function hello() {
    if (!net || !net.frontOk || !net.sendFront) return;
    ensureSig().then(() => { if (net.frontOk && !signing) net.sendFront({ id: mem.id, ...(mem.sig ? { sig: mem.sig } : null), ...(side() ? { side: side() } : null) }); });       // no signature after HTTP failed: the WebSocket is the first contact
  }
  let rule = null, lastMatch = mem.last || null, shownMatch = null; void shownMatch;
  if (net && net.on) {
    net.on('front', m => {
      if (!m) return;
      if (m.op === 'hello') { setTimeout(hello, 0); return; }
      if (m.op === 'me') { const j = onMe(m); if (j && (j.code === 'taken' || j.code === 'bad_sig')) setTimeout(hello, 50); return; }
      if (m.op === 'rule') { rule = { map: m.map, rule: m.rule || null, dmg: m.dmg | 0, own: m.own || null, at: performance.now() }; applyIfRunning(); return; }
      if (m.op === 'match') {
        lastMatch = { ...m, at: Date.now() }; delete lastMatch.op; mem.last = lastMatch; if (m.me) mem.me = m.me; save(mem);
        if (m.terr && pub && !pub.local) { const t = pub.terr.find(x => x.id === m.map); if (t) Object.assign(t, m.terr); }
        pubAt = 0; injectContrib();
      }
    });
  }

  /* ---------- season reward (cosmetics.js: registered as not sold; granted when the server says this player earned it) ---------- */
  const REWARD = {
    A: { pattern: 'topo', c: [0x061210, 0x0d2a24, 0x1b5a4c, 0x3cc9a6], accent: 0x8ff3d8, n: ['Phare de la Vigie', 'Vigie Beacon', 'Faro de la Vigía', 'Leuchtfeuer der Wache', 'Farol da Vigia', 'Faro della Vedetta'] },
    B: { pattern: 'crackle', c: [0x070302, 0x1e0c07, 0x4a1c0c, 0xff8c3a], accent: 0xffc08a, n: ['Coulée de la Fournaise', 'Furnace Flow', 'Colada del Horno', 'Glutstrom', 'Escoada da Fornalha', 'Colata della Fornace'] },
  };
  const finId = (season, s) => `${season}_front_${s.toLowerCase()}`;
  let COS = null;
  import('./cosmetics.js').then(m => {
    COS = m;
    const defs = [];
    for (let n = 1; n <= 6; n++) for (const s of ['A', 'B']) defs.push({ id: finId('s' + n, s), pattern: REWARD[s].pattern, rarity: 'legendary', c: REWARD[s].c, accent: REWARD[s].accent, n: REWARD[s].n.map(x => `${x} · S${n}`), level: 1, source: 'front', season: 's' + n, price: null, picture: n === 1 });       // weapon-shots/fin-s1_front_*.webp
    try { m.registerFinishes(defs); } catch (e) { console.warn('[front] finishes', e); }
    grantRewards();
  }).catch(e => console.warn('[front] cosmetics', e));
  async function grantRewards() {
    const me = mem.me, hist = (pub && pub.hist) || [];
    if (!me || !Array.isArray(me.rw) || !profile || typeof profile.grant !== 'function' || !COS) return;
    for (const sid of me.rw) { const h = hist.find(x => x.id === sid); if (!h || (h.winner !== 'A' && h.winner !== 'B')) continue; try { await profile.grant('finish', finId(sid, h.winner), 'front'); } catch { /* retried next time */ } }
  }
  const swatchCss = s => { const c = REWARD[s].c.map(x => '#' + x.toString(16).padStart(6, '0')); return `background:repeating-linear-gradient(${s === 'A' ? '160deg' : '35deg'},${c[1]} 0 6px,${c[2]} 6px 9px,${c[1]} 9px 16px,${c[3]} 16px 17px),${c[0]}`; };

  /* ---------- home band ---------- */
  function seasonLine(p, short) {
    const s = p.season || {}, now = Date.now();
    const parts = [L('season', { n: s.n || 1 })];
    if (s.weeks) parts.push(L('week', { w: (s.week | 0) + 1, n: s.weeks }));
    if (s.end && !short) parts.push(L('endsIn', { d: dur(s.end - now) }));
    return parts.join(' · ');
  }
  function tugBar(p) {
    const a = p.sides && p.sides.A ? p.sides.A.terr : 0, b = p.sides && p.sides.B ? p.sides.B.terr : 0, n = Math.max(0, IDS.length - a - b);
    return `<div class="fzw-tugbar" aria-hidden="true"><i class="a" style="width:${a / IDS.length * 100}%"></i><i class="n" style="left:${a / IDS.length * 100}%;width:${n / IDS.length * 100}%"></i><i class="b" style="width:${b / IDS.length * 100}%"></i></div>`;
  }
  function offChips(p, max) {
    const now = Date.now(), off = (p.off || []).slice(0, max || 2);
    if (!off.length) return '';
    void now;
    return off.map(o => `<span class="fzw-chip">${ruleSvg(o.rule, 18)}<b>${esc(mapName(o.map))}</b><small>${esc(L('r_' + o.rule))}</small></span>`).join('');
  }
  function bandHtml() {
    const p = state(), s = side(), me = mem.me, f = s ? FACTIONS[s] : null;
    const status = serverOld ? L('oldServer') : hasServer === false ? (pub ? L('offline') : L('waiting')) : seasonLine(p, true);
    const right = f
      ? `<div class="fzw-me">${emblem(f, 44, true)}<div><b style="color:${f.main}">${esc(f.name)}</b>${me && me.pts !== undefined ? esc(L('pts', { n: fmt(me.pts) })) : esc(L('yourSide'))}</div></div><button type="button" class="fzw-btn" data-fid="front:open">${esc(L('open'))}</button>`
      : `<div class="fzw-me"><div><b>${esc(L('noSide'))}</b>${esc(L('choose'))}</div></div><button type="button" class="fzw-btn fzw-invite" data-fid="front:pick">${esc(L('pickNow'))}</button>`;
    return `<div class="fzw-bmap">${theatreSvg(p, { compact: true, uid: 'fzb', label: L, noFx: bandCompact })}</div>`       // the hub's compact band: still map (no 10 Hz overlay), the war room keeps the live one
      + `<div class="fzw-bmid"><div class="fzw-bhead"><b>${esc(L('title'))}</b>${hasServer && !serverOld ? `<span class="fzw-live">${esc(L('live'))}</span>` : ''}<span>${esc(status)}</span></div>`
      + `<div class="fzw-tug"><span class="fzw-tug-side is-a">${emblem(FACTIONS.A, 26)}${esc(FACTIONS.A.name)} <small>${p.sides ? p.sides.A.terr : 0}</small></span>${tugBar(p)}<span class="fzw-tug-side is-b">${emblem(FACTIONS.B, 26)}${esc(FACTIONS.B.name)} <small>${p.sides ? p.sides.B.terr : 0}</small></span></div>`
      + ((p.off || []).length ? `<div class="fzw-offline"><b>${esc(L('offensive'))} ×2</b>${p.season && p.season.wEnd ? `<small>${esc(L('endsIn', { d: dur(p.season.wEnd - Date.now()) }))}</small>` : ''}</div><div class="fzw-chips">${offChips(p, 2)}</div>` : '')
      + (lastMatch && Date.now() - lastMatch.at < 6 * 36e5 && lastMatch.pts > 0 ? `<div class="fzw-note">${esc(L('lastContrib', { p: '+' + fmt(lastMatch.pts), map: mapName(lastMatch.map) }))}</div>` : bandSolo ? `<div class="fzw-note">${esc(L('soloNote'))}</div>` : '')
      + `</div><div class="fzw-bright">${right}</div>`;
  }
  function decorate() {
    const root = menuRoot && menuRoot.querySelector('.fzm'); if (!root) return;
    // rc8 menu flow (menu-flow.js): the band lives on the home hub only (.fzh-front), compact and with a still map; rc7 layout: the play grid
    const slot = root.querySelector('.fzh-front'), grid = slot || (root.querySelector('.fzh-view') ? null : root.querySelector('.fzm-play-grid')); if (!grid) return;
    const compact = !!slot; if (compact !== bandCompact) { bandCompact = compact; const old = grid.querySelector(':scope>.fzw-band'); if (old) old.dataset.k = ''; }
    bandSolo = !slot && !root.querySelector('.fzm-play--multi');
    let band = grid.querySelector(':scope>.fzw-band');
    if (!band) {
      band = document.createElement('div'); band.className = 'fzw-band'; band.setAttribute('data-fid', 'front:band'); band.tabIndex = 0; band.setAttribute('role', 'button');
      band.addEventListener('click', e => { const b = e.target.closest('[data-fid]'); sfx(); if ((b && b.dataset.fid === 'front:pick') || !side()) openPick(); else openRoom(); });
      band.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === band) { e.preventDefault(); band.click(); } });
      grid.prepend(band);
      band.innerHTML = bandHtml(); band.dataset.k = bandKey();
      if (!pub || Date.now() - pubAt > 45000) fetchFront().then(refresh);
      maybeAutoPick(root);
    } else if (band.dataset.k !== bandKey()) { band.innerHTML = bandHtml(); band.dataset.k = bandKey(); }
    band.setAttribute('aria-label', L('open'));
  }
  let bandSolo = false, bandCompact = false;
  const bandKey = () => [li(), bandSolo, bandCompact, side(), pub ? pub.rev || pub.t : 0, hasServer, serverOld, mem.me ? mem.me.pts : '', lastMatch ? lastMatch.at : 0].join('|');
  /* first use (rc8): no window that opens by itself any more (in rc7 it stole the focus of the room-code field when the player typed at once).
     The band's CHOISIR UN CAMP button pulses instead (.fzw-invite, transform/opacity only), until a side is chosen. */
  function maybeAutoPick(root) { void root; }
  let queued = false, observed = null;
  const after = () => { queued = false; try { decorate(); if (lastMatch && menuRoot.querySelector('.fzm-end')) injectContrib(); } catch (e) { console.warn('[front] band', e); } };
  const mo = new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(after); } });
  function watch() {
    const r = menuRoot && menuRoot.querySelector('.fzm'); if (!r || r === observed) return !!r; observed = r;
    mo.disconnect(); const main = r.querySelector('.fzm-main'); if (main) mo.observe(main, { childList: true });
    after(); return true;
  }
  if (!watch()) { const w = new MutationObserver(() => { if (watch()) w.disconnect(); }); if (menuRoot) w.observe(menuRoot, { childList: true }); }
  function refresh() {
    try { const b = document.querySelector('.fzw-band'); if (b && b.dataset.k !== bandKey()) { b.innerHTML = bandHtml(); b.dataset.k = bandKey(); } } catch (e) { console.warn('[front] refresh', e); }
    if (room && !room.hidden) drawRoom();
    grantRewards();
  }
  setTimeout(() => { fetchFront().then(refresh); if (mem.sig || side()) postMe(side() && !mem.side ? { side: side() } : {}); }, 1500);
  setInterval(() => { if (document.hidden || (engine && (engine.running || engine.loading))) return; const vis = (room && !room.hidden) || !!document.querySelector('.fzw-band'); if (vis) fetchFront(!!(room && !room.hidden)).then(refresh); }, 30000);
  if (i18n && i18n.on) i18n.on('change', () => { refresh(); if (pick && !pick.hidden) drawPick(); });

  /* ---------- war room ---------- */
  let room = null, sel = null, roomTimer = 0, hovId = null;
  /** The territory under the pointer gets its outline in the overlay (only that small layer repaints). */
  function hoverAt(t) {
    const c = t && t.closest ? t.closest('.fzw-mapbox .fzw-t') : null, id = c ? c.dataset.t : null;
    if (id === hovId) return; hovId = id; paintHover();
  }
  function paintHover() { const h = room && room.querySelector('.fzw-mapbox .fzw-hov'); if (h) h.setAttribute('d', hovId && GEO.path[hovId] ? GEO.path[hovId] : 'M0 0'); }
  function openRoom(focus) {
    if (!room) {
      room = document.createElement('div'); room.className = 'fzw'; room.id = 'fz-front'; room.setAttribute('role', 'dialog'); room.setAttribute('aria-modal', 'true'); room.tabIndex = -1; room.hidden = true;
      document.body.append(room);
      room.addEventListener('click', onRoomClick);
      room.addEventListener('pointerover', e => hoverAt(e.target));
      room.addEventListener('pointerleave', () => hoverAt(null));
      room.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeRoom(); } else if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.fzw-t')) { e.preventDefault(); select(e.target.closest('.fzw-t').dataset.t); } });
    }
    if (focus) sel = focus;
    room.hidden = false; drawRoom(); fetchFront(true).then(refresh);
    if (side() && !mem.side) postMe({ side: side() }); else if (Date.now() - meAt > 30000) postMe({});       // personal figures, at most twice a minute
    clearInterval(roomTimer); roomTimer = setInterval(() => { if (!room.hidden && !document.hidden) fetchFront(true).then(refresh); }, 20000);
    try { room.focus({ preventScroll: true }); } catch { /* optional */ }
  }
  function closeRoom() { if (!room) return; room.hidden = true; room.textContent = ''; clearInterval(roomTimer); const b = document.querySelector('.fzw-band'); if (b) try { b.focus({ preventScroll: true }); } catch { /* optional */ } }
  function select(id) { sel = id; sfx(); drawRoom(); const g = room.querySelector(`.fzw-t[data-t="${CSS_ESC(id)}"]`); if (g) try { g.focus({ preventScroll: true }); } catch { /* optional */ } }
  const CSS_ESC = s => String(s).replace(/[^a-z0-9-]/gi, '');
  function ctlBar(v, extra) {
    const a = clamp((100 - (v || 0)) / 200, 0, 1) * 100;
    return `<div class="fzw-ctl" ${extra || ''}><i class="a" style="width:${a}%"></i><i class="b" style="width:${100 - a}%"></i><i class="t" style="left:25%"></i><i class="t" style="left:75%"></i><i class="m" style="left:${a}%"></i></div>`;
  }
  function detailHtml(p) {
    const id = sel && SITES[sel] ? sel : null;
    if (!id) return '';
    const t = p.terr.find(x => x.id === id) || {}, a = clamp((100 - (t.v || 0)) / 200, 0, 1);
    const tags = [];
    tags.push(t.own ? `<span style="color:${FACTIONS[t.own].main}">${esc(L('heldBy', { f: fname(t.own) }))}</span>` : `<span>${esc(L('neutral'))}</span>`);
    if (t.cap) tags.push(`<span>${esc(L('hq'))}</span>`);
    if (t.c) tags.push(`<span style="color:var(--amber)">${esc(L('contested'))}</span>`);
    for (const s of t.att || []) if (s !== t.own) tags.push(`<span style="color:${FACTIONS[s].main}">${esc(L('attBy', { f: fname(s) }))}</span>`);
    const ob = (p.off || []).find(o => o.map === id);
    return `<section class="fzw-panel fzw-box fzw-det"><h3 class="fzw-h">${esc(L('control'))}</h3><b class="n">${esc(mapName(id))}</b><div class="st">${tags.join('')}</div>`
      + ctlBar(t.v) + `<div class="fzw-ctlx"><span style="color:var(--A)">${esc(FACTIONS.A.name)} ${Math.round(a * 100)} %</span><span style="color:var(--B)">${Math.round((1 - a) * 100)} % ${esc(FACTIONS.B.name)}</span></div>`
      + (t.cap ? `<p class="fzw-note">${esc(L('hqNote'))}</p>` : '')
      + (ob ? `<p class="fzw-note" style="color:var(--amber)">${ruleSvg(ob.rule, 16)} ${esc(L('r_' + ob.rule))} · ${esc(L('x2'))} — ${esc(ruleDesc(ob.rule))}</p>` : '')
      + (t.dmg ? `<p class="fzw-note">${esc(L(t.dmg > 1 ? 'dmg2' : 'dmg1'))}</p>` : '')
      + `<button type="button" class="fzw-btn" data-act="play" data-map="${esc(id)}" style="margin-top:10px">${esc(L('play'))}</button></section>`;
  }
  const keyLabel = () => { try { return settings && settings.keyLabel ? settings.keyLabel(settings.get('keys.flashlight')) : 'L'; } catch { return 'L'; } };
  const ruleDesc = r => L('d_' + r, { k: keyLabel() });
  function offBannerHtml(p) {
    const now = Date.now(), off = p.off || [];
    if (!off.length) return '';
    return `<section class="fzw-off" data-fid="front:offensive"><div class="fzw-offh"><b>${esc(L('offensive'))}</b><span>${p.season && p.season.wEnd ? esc(L('endsIn', { d: dur(p.season.wEnd - now) })) : ''}</span></div>`
      + off.map(o => `<div class="fzw-obj" data-act="sel" data-map="${esc(o.map)}"><img src="map-shots/${encodeURIComponent(o.map)}.webp" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph'}))"><div><b>${esc(mapName(o.map))}</b><span>${ruleSvg(o.rule, 16)} ${esc(L('r_' + o.rule))} <em>×2</em></span><small>${esc(ruleDesc(o.rule))}</small></div></div>`).join('')
      + '</section>';
  }
  function evIcon(e) {
    const c = e.side ? FACTIONS[e.side].main : '#f0ae2e';
    if (e.k === 'flip') return `<svg viewBox="0 0 22 22"><path d="M5 20V3l11 4-11 4" fill="${c}" stroke="${c}" stroke-width="1.5"/></svg>`;
    if (e.k === 'counter') return `<svg viewBox="0 0 22 22"><path d="M4 11h12M11 5l6 6-6 6" fill="none" stroke="${c}" stroke-width="2.4"/></svg>`;
    return `<svg viewBox="0 0 22 22"><path d="M11 3l2.4 5 5.6.6-4.2 3.8 1.2 5.6L11 15.2 6 18l1.2-5.6L3 8.6 8.6 8Z" fill="${c}"/></svg>`;
  }
  function evText(e) {
    if (e.k === 'flip') return L('ev_flip', { f: fname(e.side), map: mapName(e.map) });
    if (e.k === 'counter') return L('ev_counter', { f: fname(e.side), map: mapName(e.map) });
    if (e.k === 'week') return L('ev_week', { maps: (e.off || []).map(mapName).join(', ') });
    if (e.k === 'season') return L('ev_season', { n: String(e.season || 's1').replace(/\D/g, '') || 1 }) + (e.twist && e.twist !== 'none' ? ' — ' + L('tw_' + e.twist) : '');
    return '';
  }
  function sideHtml(p) {
    const s = side(), f = s ? FACTIONS[s] : null, me = mem.me, now = Date.now();
    if (!f) return `<section class="fzw-panel fzw-box"><h3 class="fzw-h">${esc(L('yourSide'))}</h3><p class="fzw-note" style="font-size:17px;color:var(--sand)">${esc(L('chooseSub'))}</p><button type="button" class="fzw-btn" data-act="pick">${esc(L('pickNow'))}</button></section>`;
    let sw = '';
    if (me && me.side === s) {
      if (me.canSwitch) sw = `<button type="button" class="fzw-btn ghost noarrow" data-act="switch">${esc(L('switch'))}</button>`;
      else if ((me.sw | 0) >= 1) sw = `<p class="fzw-note">${esc(L('switchNo'))}</p>`;
      else if (me.switchLock && now >= me.switchLock) sw = `<p class="fzw-note">${esc(L('lockNote'))}</p>`;
      else if (me.switchFrom) sw = `<p class="fzw-note">${esc(L('switchIn', { d: dur(me.switchFrom - now) }))}</p>`;
    }
    return `<section class="fzw-panel fzw-box"><h3 class="fzw-h">${esc(L('yourSide'))}</h3><div class="fzw-side"><span class="emb">${emblem(f, 84, true)}</span><b style="color:${f.main}">${esc(f.name)}</b><i>« ${esc(motto(f, (i18n && i18n.lang) || 'fr'))} »</i>`
      + `<small>${me && me.side === s ? esc(L('myPts', { n: fmt(me.pts | 0), m: fmt(me.m | 0) })) + (me.share ? '<br>' + esc(L('share', { s: String(me.share).replace('.', ','), f: f.name })) : '') : esc(L('waiting'))}</small></div>${sw ? '<div style="margin-top:12px">' + sw + '</div>' : ''}</section>`;
  }
  function scoreHtml(p) {
    const row = s => { const f = FACTIONS[s], x = (p.sides && p.sides[s]) || { terr: 0, pts: 0, n: 0 }; return `<div class="fzw-srow">${emblem(f, 40)}<div><b style="color:${f.main}">${esc(f.name)}</b><small>${esc(L('pts', { n: fmt(x.pts) }))} · ${esc(L('soldiers', { n: fmt(x.n) }))}</small></div><strong style="color:${f.main}" title="${esc(L('holds'))}">${x.terr}</strong></div>`; };
    return `<section class="fzw-panel fzw-box fzw-score"><h3 class="fzw-h">${esc(L('forces'))}</h3>${row('A')}${tugBar(p)}${row('B')}</section>`;
  }
  function rewardHtml() {
    const s = side(), now = Date.now(), me = mem.me, hist = (pub && pub.hist) || [];
    const sid = (pub && pub.season && pub.season.id) || 's1';
    const fig = x => {
      const won = me ? (me.rw || []).slice().reverse().find(r => { const h = hist.find(q => q.id === r); return h && h.winner === x; }) : null;       // the latest season this player won with that side
      return `<figure class="is-${x.toLowerCase()}"><span class="fzw-swatch" style="${swatchCss(x)}"><img src="weapon-shots/fin-${finId('s1', x)}.webp" alt="" loading="lazy" onerror="this.remove()"></span>${emblem(FACTIONS[x], 30)}<b>${esc(REWARD[x].n[li()] || REWARD[x].n[0])}</b>`
        + `<span>${won ? `<b style="color:var(--amber)">${esc(L('rewardGot'))} · ${esc(L('season', { n: won.replace(/\D/g, '') }))}</b>` : esc(L('rewardFor', { f: fname(x) }))}</span>`
        + `${won ? `<button type="button" class="fzw-btn ghost noarrow" data-act="apply" data-fin="${esc(finId(won, x))}" style="font-size:14px">${esc(L('apply', { w: primaryName() }))}</button>` : ''}</figure>`;
    };
    void now;
    return `<section class="fzw-panel fzw-box"><h3 class="fzw-h">${esc(L('reward'))}</h3><div class="fzw-rew">${fig('A')}${fig('B')}</div><p class="fzw-note" style="margin:10px 0 0">${esc(L('rewardMin', { f: s ? fname(s) : FACTIONS.A.name + ' / ' + FACTIONS.B.name }))}</p></section>`;
  }
  const primaryName = () => { try { return String(profile.data.primary || '').toUpperCase(); } catch { return ''; } };
  function drawRoom() {
    if (!room || room.hidden) return;
    const p = state(), scrollers = [...room.querySelectorAll('.fzw-body')].map(x => x.scrollTop);
    const status = serverOld ? L('oldServer') : hasServer === false ? (pub ? L('offline') : L('waiting')) : '';
    room.setAttribute('aria-label', L('title'));
    const feed = (p.ev || []).slice().reverse().slice(0, 8).map(e => `<li>${evIcon(e)}<div>${esc(evText(e))}<small>${e.t ? esc(L('ago', { d: dur(Date.now() - e.t) })) : ''}</small></div></li>`).join('');
    room.innerHTML = `<header class="fzw-top"><h2>${esc(L('title'))}</h2><div class="fzw-season"><b>${esc(seasonLine(p))}</b>${p.season && p.season.twist && p.season.twist !== 'none' ? `<span>${esc(L('tw_' + p.season.twist))}</span>` : ''}${status ? `<span style="color:var(--amber)">${esc(status)}</span>` : ''}</div><button type="button" class="fzw-btn ghost noarrow" data-act="close" data-fid="front:close">${esc(L('back'))}</button></header>`
      + `<div class="fzw-body"><div class="fzw-col">${sideHtml(p)}${scoreHtml(p)}${rewardHtml()}</div>`
      + `<div class="fzw-col"><div class="fzw-mapbox" data-fid="front:map">${theatreSvg(p, { uid: 'fzr', sel, names: mapName, label: L })}<div class="fzw-maplegend"><span><i style="background:var(--A)"></i>${esc(FACTIONS.A.name)}</span><span><i style="background:var(--B)"></i>${esc(FACTIONS.B.name)}</span><span><i style="background:repeating-linear-gradient(135deg,#6b6a60 0 3px,#1b1d18 3px 6px)"></i>${esc(L('neutral'))}</span><span><i style="background:#ffcf6a;height:3px;vertical-align:3px"></i>${esc(L('title'))}</span><span><i style="background:#f0ae2e"></i>${esc(L('offensive'))}</span></div></div>`
      + `<section class="fzw-panel fzw-box"><h3 class="fzw-h">${esc(L('how'))}</h3><ul class="fzw-how"><li>${esc(L('how1'))}</li><li>${esc(L('how2'))}</li><li>${esc(L('how3'))}</li><li>${esc(L('how4'))}</li></ul></section></div>`
      + `<div class="fzw-col">${offBannerHtml(p)}${detailHtml(p)}<section class="fzw-panel fzw-box"><h3 class="fzw-h">${esc(L('news'))}</h3><ul class="fzw-feed">${feed || `<li><span></span><div>${esc(L('waiting'))}</div></li>`}</ul></section></div></div>`;
    room.querySelectorAll('.fzw-body').forEach((x, i) => { x.scrollTop = scrollers[i] || 0; });
    paintHover();       // the 20 s refresh rebuilds the map: the outline stays on the territory under the pointer
  }
  async function onRoomClick(e) {
    const t = e.target.closest ? e.target : null; if (!t) return;
    const act = t.closest('[data-act]'), cell = t.closest('.fzw-t');
    if (act) {
      const a = act.dataset.act; sfx();
      if (a === 'close') return closeRoom();
      if (a === 'pick') return openPick();
      if (a === 'sel') return select(act.dataset.map);
      if (a === 'play') return playMap(act.dataset.map);
      if (a === 'switch') return askSwitch();
      if (a === 'apply') { try { const w = profile.data.primary; if (profile.equipFin && profile.equipFin(w, act.dataset.fin)) act.textContent = '✓'; } catch { /* optional */ } return; }
      return;
    }
    if (cell) select(cell.dataset.t);
  }
  /** Back to the menu, multiplayer tab, this map selected (the menu's own controls). */
  function playMap(id) {
    closeRoom();
    try {
      menu.show('friends');       // multiplayer: the "Entre amis" screen (rc8 flow) or the Multijoueur tab (rc7 layout)
      setTimeout(() => { const m = document.querySelector(`[data-fid="map:${CSS_ESC(id)}"]`); if (m) { m.click(); m.scrollIntoView({ block: 'nearest' }); } }, 60);
    } catch (err) { console.warn('[front] play', err); }
  }
  function askSwitch() {
    const s = side(), to = s === 'A' ? 'B' : 'A';
    confirmBox(L('switchAsk', { f: fname(to) }), async () => { const r = await postMe({ side: to, sw: 1 }); if (r && !r.code) { mem.side = to; save(mem); } refresh(); });
  }
  function confirmBox(text, ok) {
    const box = document.createElement('div'); box.className = 'fzw-pick'; box.style.cssText = 'grid-template-rows:1fr;place-items:center;background:rgba(5,6,5,.86)';
    box.innerHTML = `<div class="fzw-panel fzw-box" role="alertdialog" aria-modal="true" style="max-width:520px;display:grid;gap:16px"><p style="margin:0;font-size:21px;color:var(--white)">${esc(text)}</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="fzw-btn" data-k="ok">${esc(L('confirm'))}</button><button type="button" class="fzw-btn ghost noarrow" data-k="no">${esc(L('cancel'))}</button></div></div>`;
    box.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b && e.target !== box) return; box.remove(); if (b && b.dataset.k === 'ok') ok(); });
    box.addEventListener('keydown', e => { if (e.key === 'Escape') box.remove(); });
    document.body.append(box); const f = box.querySelector('[data-k="ok"]'); if (f) f.focus();
  }

  /* ---------- faction choice ---------- */
  let pick = null;
  function openPick() {
    if (!pick) {
      pick = document.createElement('div'); pick.className = 'fzw-pick'; pick.id = 'fz-front-pick'; pick.setAttribute('role', 'dialog'); pick.setAttribute('aria-modal', 'true'); pick.hidden = true;
      document.body.append(pick);
      pick.addEventListener('click', e => { const b = e.target.closest('[data-side],[data-act]'); if (!b) return; sfx(); if (b.dataset.act === 'later') return closePick(); if (b.dataset.side) choose(b.dataset.side); });
      pick.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closePick(); } });       // the menu below must not also go back a screen
    }
    const was = document.activeElement; pickBack = was && was !== document.body && !pick.contains(was) ? was : null;       // given back on close
    pick.hidden = false; drawPick(); pick.tabIndex = -1;
    try { pick.focus({ preventScroll: true }); } catch { /* optional */ }
  }
  let pickBack = null;
  function closePick() {
    if (!pick || pick.hidden) return;
    pick.hidden = true; pick.textContent = '';
    const b = pickBack && pickBack.isConnected ? pickBack : null; pickBack = null;
    if (b && !(engine && (engine.running || engine.loading))) try { b.focus({ preventScroll: true }); } catch { /* optional */ }
  }
  function drawPick() {
    const p = state(), lang = (i18n && i18n.lang) || 'fr';
    const half = s => {
      const f = FACTIONS[s], x = (p.sides && p.sides[s]) || { terr: 0, n: 0 }, held = (p.terr || []).filter(t => t.own === s).map(t => mapName(t.id));
      return `<button type="button" class="fzw-half is-${s.toLowerCase()}" data-side="${s}" data-fid="front:side:${s}"><span class="wm" aria-hidden="true">${emblem(f, 620)}</span><span class="emb">${emblem(f, 210)}</span><h3>${esc(f.name)}</h3><q>${esc(motto(f, lang))}</q><p>${esc(L(s === 'A' ? 'holdsW' : 'holdsE'))}</p>`
        + `<span class="stat">${esc(L('terr', { n: x.terr }))}${x.n ? ' · ' + esc(L('soldiers', { n: fmt(x.n) })) : ''}</span><span class="held">${held.map(esc).join(' · ')}</span><span class="fzw-btn go noarrow">${esc(L('join', { f: f.name }))}</span></button>`;
    };
    pick.setAttribute('aria-label', L('choose'));
    let zz = 'M20 0'; for (let y = 40; y <= 1000; y += 40) zz += `L${y % 80 ? 6 + (y * 7 % 11) : 34 - (y * 3 % 9)} ${y}`;
    pick.innerHTML = `<div class="fzw-pick-bg" aria-hidden="true">${theatreSvg(p, { compact: true, uid: 'fzp', label: L, noFx: true })}</div>`
      + `<div class="fzw-pick-head"><small>${esc(L('title'))} · ${esc(L('season', { n: (p.season && p.season.n) || 1 }))}</small><h2>${esc(L('choose'))}</h2><p>${esc(L('chooseSub'))}</p></div>`
      + `<div class="fzw-halves">${half('A')}<svg class="fzw-zz" viewBox="0 0 40 1000" preserveAspectRatio="none" aria-hidden="true"><path d="${zz}" fill="none" stroke="#f0ae2e" stroke-opacity=".35" stroke-width="9"/><path d="${zz}" fill="none" stroke="#ffcf6a" stroke-width="3"/><path class="fzw-fl" d="${zz}" fill="none" stroke="#fff6dc" stroke-width="1.6"/></svg>${half('B')}</div>`
      + `<div class="fzw-pick-foot"><span>${esc(L('switchRule'))}</span><button type="button" class="fzw-link" data-act="later" data-fid="front:later">${esc(L('later'))}</button></div>`;
  }
  async function choose(s) {
    if (s !== 'A' && s !== 'B') return;
    mem.pend = s; save(mem); closePick();
    await postMe({ side: s });
    hello();
    refresh(); openRoom();
  }

  /* ---------- end of match: contribution block (online results of match-flow.js, or the menu's end screen) ---------- */
  function contribHtml(m) {
    const s = m.side, f = FACTIONS[s]; if (!f) return '';
    const before = m.before === null || m.before === undefined ? (m.terr ? m.terr.v : 0) : m.before, after = m.after === null || m.after === undefined ? before : m.after;
    const mode = m.why ? '' : L('m_' + (m.mode || 'reserve'));
    const chips = [];
    if (!m.why) {
      if (m.weight && m.weight < 0.999) chips.push(`<span class="c">${esc(L('c_bots', { w: String(Math.round(m.weight * 100) / 100).replace('.', ',') }))}</span>`);
      if (m.rule) chips.push(`<span class="c hot">${esc(L('c_obj'))} · ${esc(L('r_' + m.rule))}</span>`);
      const und = m.mult && m.rule ? m.mult / 2 : m.mult;
      if (und && und > 1.001) chips.push(`<span class="c">${esc(L('c_under', { m: String(Math.round(und * 10) / 10).replace('.', ',') }))}</span>`);
      if (m.capped) chips.push(`<span class="c">${esc(L('c_cap'))}</span>`);
    }
    const flip = m.flipped ? `<div class="fzw-flip${m.flipped === s ? '' : ' lost'}">${esc(L(m.flipped === s ? 'won' : 'lost'))}</div>` : '';
    const me = m.me || mem.me, season = me ? `<span class="fzw-note">${esc(L('seasonLine', { n: fmt(me.pts | 0), s: String(me.share || 0).replace('.', ','), f: f.name }))}</span>` : '';
    return `<div class="fzw-ch">${emblem(f, 46, true)}<div class="t"><small>${esc(L('contrib'))}</small><b data-count="${m.pts | 0}">+0<span>${esc(L('frontPts'))}</span></b></div><div class="where">${esc(mapName(m.map))}<small>${esc(mode)}</small></div></div>`
      + (m.why ? `<div class="fzw-why">${esc(L('w_' + m.why))}</div>` : m.mode === 'reserve' ? '' : `<div class="fzw-cbar"><span style="color:var(--A)">${esc(FACTIONS.A.name)}</span>${ctlBar(before, `data-to="${after}"`)}<span style="color:var(--B)">${esc(FACTIONS.B.name)}</span></div>`)
      + `<div class="fzw-cfoot">${flip}${chips.join('')}${season}</div>`;
  }
  function animateContrib(box, m) {
    const b = box.querySelector('[data-count]'), n = m.pts | 0, span = b ? b.querySelector('span') : null;
    const setN = k => { if (b) { b.firstChild.nodeValue = '+' + fmt(k); if (span && b.lastChild !== span) b.append(span); } };
    if (reduced() || !n) setN(n);
    else { let i = 0; const t = setInterval(() => { i++; setN(Math.round(n * (1 - Math.pow(1 - i / 20, 3)))); if (i >= 20) clearInterval(t); }, 40); }
    const bar = box.querySelector('[data-to]');
    if (bar) { const to = Number(bar.dataset.to), a = clamp((100 - to) / 200, 0, 1) * 100; setTimeout(() => { const A = bar.querySelector('.a'), B = bar.querySelector('.b'), M = bar.querySelector('.m'); if (A) A.style.width = a + '%'; if (B) B.style.width = (100 - a) + '%'; if (M) M.style.left = a + '%'; }, reduced() ? 0 : 350); }
  }
  function injectContrib() {
    const m = lastMatch; if (!m || Date.now() - m.at > 10 * 60e3) return;
    const host = document.querySelector('#fz-flow:not([hidden]) .fzf-verdict') || (menuRoot && menuRoot.querySelector('.fzm-end'));
    if (!host || host.querySelector('.fzw-contrib')) return;
    const box = document.createElement('section'); box.className = `fzw-contrib is-${String(m.side).toLowerCase()}`; box.setAttribute('data-fid', 'front:contrib');
    box.innerHTML = contribHtml(m);
    const acts = host.querySelector(':scope>.fzm-end-actions');
    if (acts) { box.style.cssText = 'width:min(100%,640px);margin:0 auto 14px'; host.insertBefore(box, acts); } else host.append(box);
    animateContrib(box, m); shownMatch = m.at;
  }
  { let tries = 0; const fl = () => { const f = document.querySelector('#fz-flow .fzf-body'); if (f) new MutationObserver(() => injectContrib()).observe(f, { childList: true }); else if (++tries < 30) setTimeout(fl, 1000); }; fl(); }

  /* ---------- in match: the objective's special rule and the war damage ---------- */
  let applied = null, damage = null;
  function applyRule(cfg) {
    if (applied) return;
    const R = rule && cfg && cfg.online && rule.map === cfg.map && performance.now() - rule.at < 240000 ? rule : null;
    const dmgLevel = R ? R.dmg : (() => { const t = pub && !pub.local && cfg ? pub.terr.find(x => x.id === cfg.map) : null; return t ? t.dmg | 0 : 0; })();
    applied = { fog: null, lights: [], exp: null, bg: null, fogCol: null, ammo: false, map: cfg && cfg.map };
    const I = engine.internals || {}, scene = I.scene, renderer = I.renderer;
    try {
      if (R && R.rule === 'fog' && scene && scene.fog && typeof scene.fog.density === 'number') { applied.fog = scene.fog.density; scene.fog.density *= 2.3; }
      if (R && R.rule === 'dark' && scene) {
        scene.traverse(o => { if ((o.isHemisphereLight || o.isDirectionalLight || o.isAmbientLight) && !(o.parent && o.parent.isCamera)) { applied.lights.push([o, o.intensity]); o.intensity *= o.isDirectionalLight ? 0.18 : 0.32; } });
        if (renderer) { applied.exp = renderer.toneMappingExposure; renderer.toneMappingExposure *= 0.78; }
        if (typeof scene.backgroundIntensity === 'number') { applied.bg = scene.backgroundIntensity; scene.backgroundIntensity *= 0.3; }       // uniforms only: no shader change
        if (scene.fog && scene.fog.color) { applied.fogCol = scene.fog.color.getHex(); scene.fog.color.multiplyScalar(0.35); }
      }
      if (R && R.rule === 'ammo') { applied.ammo = true; scarce(); }
      if (R && R.rule) note(R);
    } catch (e) { console.warn('[front] rule', e); }
    if (dmgLevel > 0 && cfg && cfg.map) {
      import('./map-damage.js').then(m => { if (!applied || applied.map !== cfg.map) return; damage = m.applyDamage({ engine, level: dmgLevel, map: cfg.map, settings }); }).catch(e => console.warn('[front] damage', e));
    }
  }
  function scarce() {       // after each own spawn: a third of the reserve (at least one magazine)
    if (!applied || !applied.ammo) return;
    try {
      const P = engine.internals.P;
      for (const w of P.ws || []) {
        if (!w || !w.def || typeof w.res !== 'number') continue;
        const full = w.def.reserve === undefined || w.def.reserve === null ? -1 : w.def.reserve;
        if (w.res !== full) continue;       // only a fresh loadout: never cut twice
        w.res = full < 0 ? 2 * (w.def.mag || 10) : Math.max(w.def.mag || 1, Math.floor(full / 3));
      }
    } catch (e) { console.warn('[front] ammo', e); }
  }
  function revert() {
    if (!applied) return;
    try {
      const I = engine.internals || {};
      if (applied.fog !== null && I.scene && I.scene.fog) I.scene.fog.density = applied.fog;
      for (const [o, v] of applied.lights) o.intensity = v;
      if (applied.exp !== null && I.renderer) I.renderer.toneMappingExposure = applied.exp;
      if (applied.bg !== null && I.scene) I.scene.backgroundIntensity = applied.bg;
      if (applied.fogCol !== null && I.scene && I.scene.fog) I.scene.fog.color.setHex(applied.fogCol);
    } catch (e) { console.warn('[front] revert', e); }
    try { if (damage) damage.remove(); } catch (e) { console.warn('[front] damage remove', e); }
    damage = null; applied = null;
  }
  function note(R) {
    const el = document.createElement('div'); el.className = 'fzw-obj-note'; el.setAttribute('role', 'status');
    el.innerHTML = `<small>${esc(L('objBanner'))} · ${esc(L('x2'))}</small><b>${esc(L('r_' + R.rule))}</b><span>${esc(ruleDesc(R.rule))}</span>`;
    document.body.append(el); setTimeout(() => el.remove(), 7200);
  }
  function applyIfRunning() { if (engine && engine.running && engine.cfg && !applied) applyRule(engine.cfg); }
  if (engine && engine.on) {
    engine.on('matchStart', cfg => { revert(); closeRoom(); closePick(); try { applyRule(cfg); } catch (e) { console.warn('[front] start', e); } });
    engine.on('spawn', e => { if (e && e.actor === engine.player) scarce(); });
    for (const ev of ['matchEnd', 'quit', 'fatal']) engine.on(ev, () => { revert(); if (ev === 'matchEnd') setTimeout(injectContrib, 50); });
  }

  /* the overlay clock (see the CSS): 10 Hz, only for overlays that are on screen */
  const fxT0 = performance.now();
  const still = () => { try { const q = settings && settings.get('graphics.preset'); return reduced() || q === 'bas' || q === 'mobile'; } catch { return false; } };       // 'mobile' (touch devices) is below 'bas'
  setInterval(() => {
    if (document.hidden || (engine && engine.running)) return;
    const els = document.getElementsByClassName('fzw-fx'); if (!els.length) return;
    const t = (performance.now() - fxT0) / 1000, st0 = still();
    document.documentElement.classList.toggle('fzw-still', st0);       // low preset or reduced motion: the band's light sweep and live dot stop too
    const ph = (period, n) => (t / period % 1) * n;
    const pulse = (t / 2.5) % 1, glow = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * Math.PI / 2));
    for (let i = 0; i < els.length; i++) {
      const el = els[i]; if (!el.getClientRects().length) continue;
      const s0 = el.style;
      if (st0) { if (s0.getPropertyValue('--fzA')) { s0.removeProperty('--fzA'); s0.removeProperty('--fzB'); s0.removeProperty('--fzC'); s0.removeProperty('--fzS'); s0.removeProperty('--fzO'); s0.removeProperty('--fzG'); } continue; }
      s0.setProperty('--fzA', ph(2, 54).toFixed(1)); s0.setProperty('--fzB', ph(3, 56).toFixed(1)); s0.setProperty('--fzC', ph(1.5, 42).toFixed(1));
      s0.setProperty('--fzS', (0.55 + 0.95 * pulse).toFixed(3)); s0.setProperty('--fzO', (0.95 * (1 - pulse)).toFixed(3)); s0.setProperty('--fzG', glow.toFixed(3));
    }
  }, 100);

  const api = { openRoom, openPick, side: () => side(), get state() { return state(); }, get me() { return mem; }, fetch: () => fetchFront(true).then(refresh), get applied() { return applied; }, get damage() { return damage; }, theatreSvg: (p, o) => theatreSvg(p || state(), { label: L, names: mapName, ...o }) };
  try { globalThis.FZFront = api; } catch { /* menu-flow.js only uses it for its first-visit hint */ }
  return api;
}
