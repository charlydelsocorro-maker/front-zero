/* FRONT ZÉRO - traductions. Chaque ligne : clé: [fr, en, es, de, pt, it]. */
import { EXTRA_TYPES } from './weapons-extra.js';
export const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
export const FALLBACK_LANG = 'fr';

const same = v => [v, v, v, v, v, v];

const TABLE = {
  /* Langues */
  'lang.fr': same('Français'), 'lang.en': same('English'), 'lang.es': same('Español'),
  'lang.de': same('Deutsch'), 'lang.pt': same('Português'), 'lang.it': same('Italiano'),

  /* Navigation et menu principal */
  'nav.play': ['JOUER', 'PLAY', 'JUGAR', 'SPIELEN', 'JOGAR', 'GIOCA'],
  'nav.arsenal': ['ARSENAL', 'ARSENAL', 'ARSENAL', 'ARSENAL', 'ARSENAL', 'ARSENALE'],
  'nav.outfits': ['TENUES', 'OUTFITS', 'UNIFORMES', 'OUTFITS', 'UNIFORMES', 'DIVISE'],
  'nav.classes': ['CLASSES', 'CLASSES', 'CLASES', 'KLASSEN', 'CLASSES', 'CLASSI'],
  'nav.shop': ['BOUTIQUE', 'SHOP', 'TIENDA', 'SHOP', 'LOJA', 'NEGOZIO'],
  'nav.pass': ['PASSE', 'PASS', 'PASE', 'PASS', 'PASSE', 'PASS'],
  'nav.settings': ['PARAMÈTRES', 'SETTINGS', 'AJUSTES', 'EINSTELLUNGEN', 'DEFINIÇÕES', 'IMPOSTAZIONI'],
  'menu.heroLine1': ['TENEZ', 'HOLD', 'DEFENDED', 'HALTET', 'DEFENDAM', 'DIFENDETE'],
  'menu.heroLine2': ['LE DÉPÔT 7', 'DEPOT 7', 'EL DEPÓSITO 7', 'DEPOT 7', 'O DEPÓSITO 7', 'IL DEPOSITO 7'],
  'menu.sub': [
    'Match de {minutes} minutes. Atteignez {kills} éliminations avant la fin du temps et gagnez des crédits pour équiper votre soldat.',
    '{minutes}-minute match. Reach {kills} eliminations before time runs out and earn credits to equip your soldier.',
    'Partida de {minutes} minutos. Consigue {kills} eliminaciones antes de que acabe el tiempo y gana créditos para equipar a tu soldado.',
    '{minutes}-Minuten-Match. Erreiche {kills} Eliminierungen vor Ablauf der Zeit und verdiene Credits für die Ausrüstung deines Soldaten.',
    'Partida de {minutes} minutos. Alcança {kills} eliminações antes do fim do tempo e ganha créditos para equipar o teu soldado.',
    'Partita da {minutes} minuti. Raggiungi {kills} eliminazioni prima dello scadere del tempo e guadagna crediti per equipaggiare il tuo soldato.',
  ],
  'menu.deploy': ['DÉPLOYER', 'DEPLOY', 'DESPLEGAR', 'EINSATZ', 'MOBILIZAR', 'SCHIERATI'],
  'menu.loadout': ['{cls} · {weapon} · Tenue {outfit}', '{cls} · {weapon} · {outfit} outfit', '{cls} · {weapon} · Uniforme {outfit}', '{cls} · {weapon} · Outfit {outfit}', '{cls} · {weapon} · Uniforme {outfit}', '{cls} · {weapon} · Divisa {outfit}'],
  'menu.level': ['NIV {n}', 'LVL {n}', 'NV {n}', 'STUFE {n}', 'NÍV {n}', 'LIV {n}'],
  'menu.moveKeys': ['ZQSD / WASD', 'WASD', 'WASD', 'WASD', 'WASD', 'WASD'],
  'menu.hintMove': ['Bouger', 'Move', 'Moverse', 'Bewegen', 'Mover', 'Muoviti'],
  'menu.hintJump': ['Sauter, maintenir pour enchaîner', 'Jump, hold to chain', 'Saltar, mantén para encadenar', 'Springen, halten zum Verketten', 'Saltar, manter para encadear', 'Salta, tieni premuto per concatenare'],
  'menu.hintSlide': ['Glisser', 'Slide', 'Deslizarse', 'Rutschen', 'Deslizar', 'Scivola'],
  'menu.hintAim': ['Viser', 'Aim', 'Apuntar', 'Zielen', 'Apontar', 'Mira'],
  'menu.hintReload': ['Recharger', 'Reload', 'Recargar', 'Nachladen', 'Recarregar', 'Ricarica'],
  'menu.hintSwitch': ['Changer d’arme', 'Switch weapon', 'Cambiar de arma', 'Waffe wechseln', 'Trocar de arma', 'Cambia arma'],

  /* Boutique */
  'shop.arsenalNote': ['Achetez une arme principale avec vos crédits. Le pistolet reste toujours en second.', 'Buy a primary weapon with your credits. The pistol always stays as your sidearm.', 'Compra un arma principal con tus créditos. La pistola siempre queda como arma secundaria.', 'Kaufe mit deinen Credits eine Primärwaffe. Die Pistole bleibt immer deine Zweitwaffe.', 'Compra uma arma principal com os teus créditos. A pistola fica sempre como arma secundária.', 'Acquista un’arma primaria con i tuoi crediti. La pistola resta sempre l’arma secondaria.'],
  'shop.outfitsNote': ['Purement esthétique. Votre camouflage apparaît sur les bras de votre soldat.', 'Purely cosmetic. Your camouflage appears on your soldier’s arms.', 'Puramente estético. Tu camuflaje aparece en los brazos de tu soldado.', 'Rein kosmetisch. Deine Tarnung erscheint an den Armen deines Soldaten.', 'Puramente estético. A tua camuflagem aparece nos braços do teu soldado.', 'Puramente estetico. La mimetica appare sulle braccia del tuo soldato.'],
  'shop.classesNote': ['Chaque classe change votre façon de combattre.', 'Each class changes the way you fight.', 'Cada clase cambia tu forma de combatir.', 'Jede Klasse verändert deine Kampfweise.', 'Cada classe muda a tua forma de combater.', 'Ogni classe cambia il tuo modo di combattere.'],
  'shop.buy': ['ACHETER {price} ₡', 'BUY {price} ₡', 'COMPRAR {price} ₡', 'KAUFEN {price} ₡', 'COMPRAR {price} ₡', 'ACQUISTA {price} ₡'],
  'shop.equip': ['ÉQUIPER', 'EQUIP', 'EQUIPAR', 'AUSRÜSTEN', 'EQUIPAR', 'EQUIPAGGIA'],
  'shop.equipped': ['ÉQUIPÉE', 'EQUIPPED', 'EQUIPADA', 'AUSGERÜSTET', 'EQUIPADA', 'EQUIPAGGIATA'],
  'shop.wear': ['PORTER', 'WEAR', 'VESTIR', 'TRAGEN', 'VESTIR', 'INDOSSA'],
  'shop.worn': ['PORTÉE', 'WORN', 'PUESTO', 'GETRAGEN', 'VESTIDO', 'INDOSSATA'],
  'shop.choose': ['CHOISIR', 'SELECT', 'ELEGIR', 'WÄHLEN', 'ESCOLHER', 'SCEGLI'],
  'shop.selected': ['SÉLECTIONNÉE', 'SELECTED', 'SELECCIONADA', 'AUSGEWÄHLT', 'SELECIONADA', 'SELEZIONATA'],
  'stat.damage': ['Dégâts', 'Damage', 'Daño', 'Schaden', 'Dano', 'Danni'],
  'stat.rate': ['Cadence', 'Fire rate', 'Cadencia', 'Kadenz', 'Cadência', 'Cadenza'],
  'stat.range': ['Portée', 'Range', 'Alcance', 'Reichweite', 'Alcance', 'Gittata'],
  'stat.mobility': ['Mobilité', 'Mobility', 'Movilidad', 'Mobilität', 'Mobilidade', 'Mobilità'],
  'stat.health': ['Santé', 'Health', 'Salud', 'Gesundheit', 'Saúde', 'Salute'],
  'stat.armor': ['Blindage', 'Armor', 'Blindaje', 'Panzerung', 'Blindagem', 'Corazza'],
  'stat.speed': ['Vitesse', 'Speed', 'Velocidad', 'Tempo', 'Velocidade', 'Velocità'],

  /* Types d’armes (par id d’arme) */
  'weaponType.p9': ['Pistolet', 'Pistol', 'Pistola', 'Pistole', 'Pistola', 'Pistola'],
  'weaponType.ar': ['Fusil d’assaut', 'Assault rifle', 'Fusil de asalto', 'Sturmgewehr', 'Espingarda de assalto', 'Fucile d’assalto'],
  'weaponType.smg': ['Mitraillette', 'Submachine gun', 'Subfusil', 'Maschinenpistole', 'Pistola-metralhadora', 'Mitra'],
  'weaponType.sg': ['Fusil à pompe', 'Shotgun', 'Escopeta', 'Schrotflinte', 'Caçadeira', 'Fucile a pompa'],
  'weaponType.lmg': ['Mitrailleuse', 'Machine gun', 'Ametralladora', 'Maschinengewehr', 'Metralhadora', 'Mitragliatrice'],
  'weaponType.sr': ['Précision', 'Marksman', 'Precisión', 'Präzision', 'Precisão', 'Precisione'],
  'weaponType.hp': ['Pistolet lourd', 'Heavy pistol', 'Pistola pesada', 'Schwere Pistole', 'Pistola pesada', 'Pistola pesante'],
  'weaponType.rev': ['Revolver', 'Revolver', 'Revólver', 'Revolver', 'Revólver', 'Revolver'],
  'weaponType.mp': ['Pistolet-mitrailleur', 'Machine pistol', 'Pistola automática', 'Reihenfeuerpistole', 'Pistola automática', 'Pistola mitragliatrice'],
  'weaponType.knife': ['Couteau', 'Knife', 'Cuchillo', 'Messer', 'Faca', 'Coltello'],
  'weaponType.car': ['Carabine', 'Carbine', 'Carabina', 'Karabiner', 'Carabina', 'Carabina'],
  'weaponType.akr': ['Fusil d’assaut lourd', 'Heavy assault rifle', 'Fusil de asalto pesado', 'Schweres Sturmgewehr', 'Espingarda de assalto pesada', 'Fucile d’assalto pesante'],
  'weaponType.brst': ['Fusil à rafales', 'Burst rifle', 'Fusil de ráfagas', 'Feuerstoßgewehr', 'Espingarda de rajadas', 'Fucile a raffica'],
  'weaponType.bat': ['Fusil de combat', 'Battle rifle', 'Fusil de combate', 'Gefechtsgewehr', 'Espingarda de combate', 'Fucile da battaglia'],
  'weaponType.pdw': ['Mitraillette compacte', 'Compact SMG', 'Subfusil compacto', 'Kompakt-MP', 'Pistola-metralhadora compacta', 'Mitra compatta'],
  'weaponType.hsmg': ['Mitraillette lourde', 'Heavy SMG', 'Subfusil pesado', 'Schwere MP', 'Pistola-metralhadora pesada', 'Mitra pesante'],
  'weaponType.asg': ['Fusil automatique', 'Auto shotgun', 'Escopeta automática', 'Automatische Schrotflinte', 'Caçadeira automática', 'Fucile automatico'],
  'weaponType.dbs': ['Fusil double', 'Double-barrel shotgun', 'Escopeta de dos cañones', 'Doppelflinte', 'Caçadeira de dois canos', 'Doppietta'],
  'weaponType.mini': ['Mitrailleuse rotative', 'Rotary machine gun', 'Ametralladora rotativa', 'Rotations-MG', 'Metralhadora rotativa', 'Mitragliatrice rotante'],
  'weaponType.dmr': ['Fusil de tireur', 'Marksman rifle', 'Fusil de tirador', 'Schützengewehr', 'Espingarda de atirador', 'Fucile da tiratore'],
  'weaponType.hsr': ['Précision lourde', 'Heavy sniper', 'Precisión pesada', 'Schwere Präzision', 'Precisão pesada', 'Precisione pesante'],
  'weaponType.rl': ['Lance-roquettes', 'Rocket launcher', 'Lanzacohetes', 'Raketenwerfer', 'Lança-foguetes', 'Lanciarazzi'],
  'weaponType.gl': ['Lance-grenades', 'Grenade launcher', 'Lanzagranadas', 'Granatwerfer', 'Lança-granadas', 'Lanciagranate'],
  'weaponType.xbow': ['Arbalète', 'Crossbow', 'Ballesta', 'Armbrust', 'Besta', 'Balestra'],
  'weaponType.frag': ['Grenade', 'Grenade', 'Granada', 'Granate', 'Granada', 'Granata'],

  /* Catégories d’armes (ids de WEAPON_CATS dans data.js) */
  'weaponCat.assault': ['Fusils d’assaut', 'Assault rifles', 'Fusiles de asalto', 'Sturmgewehre', 'Espingardas de assalto', 'Fucili d’assalto'],
  'weaponCat.smg': ['Mitraillettes', 'Submachine guns', 'Subfusiles', 'Maschinenpistolen', 'Pistolas-metralhadoras', 'Mitra'],
  'weaponCat.shotgun': ['Fusils à pompe', 'Shotguns', 'Escopetas', 'Schrotflinten', 'Caçadeiras', 'Fucili a pompa'],
  'weaponCat.lmg': ['Mitrailleuses', 'Machine guns', 'Ametralladoras', 'Maschinengewehre', 'Metralhadoras', 'Mitragliatrici'],
  'weaponCat.sniper': ['Précision', 'Marksman rifles', 'Precisión', 'Präzisionsgewehre', 'Precisão', 'Precisione'],
  'weaponCat.launcher': ['Lanceurs', 'Launchers', 'Lanzadores', 'Werfer', 'Lançadores', 'Lanciatori'],
  'weaponCat.special': ['Spécial', 'Special', 'Especial', 'Spezial', 'Especial', 'Speciale'],
  'weaponCat.pistol': ['Armes de poing', 'Handguns', 'Armas cortas', 'Faustfeuerwaffen', 'Armas de mão', 'Armi corte'],
  'weaponCat.melee': ['Corps à corps', 'Melee', 'Cuerpo a cuerpo', 'Nahkampf', 'Corpo a corpo', 'Corpo a corpo'],
  'weaponCat.gear': ['Équipement', 'Gear', 'Equipo', 'Ausrüstung', 'Equipamento', 'Equipaggiamento'],

  /* Emplacements d’équipement, grenades et étiquettes d’armes */
  'slot.primary': ['Arme principale', 'Primary weapon', 'Arma principal', 'Primärwaffe', 'Arma principal', 'Arma primaria'],
  'slot.secondary': ['Arme secondaire', 'Secondary weapon', 'Arma secundaria', 'Zweitwaffe', 'Arma secundária', 'Arma secondaria'],
  'slot.gear': ['Équipement', 'Gear', 'Equipo', 'Ausrüstung', 'Equipamento', 'Equipaggiamento'],
  'slot.primaryShort': ['Principale', 'Primary', 'Principal', 'Primär', 'Principal', 'Primaria'],
  'slot.secondaryShort': ['Secondaire', 'Secondary', 'Secundaria', 'Sekundär', 'Secundária', 'Secondaria'],
  'loadout.title': ['Équipement', 'Loadout', 'Equipamiento', 'Ausrüstung', 'Equipamento', 'Equipaggiamento'],
  'loadout.note': [
    'Composez votre équipement : une arme principale, une arme secondaire et un équipement à lancer.',
    'Build your loadout: one primary weapon, one sidearm and one piece of throwable gear.',
    'Compón tu equipo: un arma principal, un arma secundaria y un equipo arrojadizo.',
    'Stell deine Ausrüstung zusammen: eine Primärwaffe, eine Zweitwaffe und ein Wurfgegenstand.',
    'Monta o teu equipamento: uma arma principal, uma arma secundária e um equipamento de arremesso.',
    'Componi il tuo equipaggiamento: un’arma primaria, un’arma secondaria e un equipaggiamento da lancio.',
  ],
  'gear.grenade': ['Grenade', 'Grenade', 'Granada', 'Granate', 'Granada', 'Granata'],
  'gear.grenades': ['Grenades', 'Grenades', 'Granadas', 'Granaten', 'Granadas', 'Granate'],
  'gear.none': ['Aucun équipement', 'No gear', 'Sin equipo', 'Keine Ausrüstung', 'Sem equipamento', 'Nessun equipaggiamento'],
  'gear.throwHint': ['{key} pour lancer', '{key} to throw', '{key} para lanzar', '{key} zum Werfen', '{key} para lançar', '{key} per lanciare'],
  'hud.noAmmo': ['Plus de munitions', 'Out of ammo', 'Sin munición', 'Keine Munition mehr', 'Sem munições', 'Munizioni esaurite'],
  'hud.noGear': ['Plus de grenade', 'No grenades left', 'Sin granadas', 'Keine Granaten mehr', 'Sem granadas', 'Granate esaurite'],
  'door.open': ['[{key}] Ouvrir la porte', '[{key}] Open door', '[{key}] Abrir la puerta', '[{key}] Tür öffnen', '[{key}] Abrir a porta', '[{key}] Apri la porta'],
  'door.close': ['[{key}] Fermer la porte', '[{key}] Close door', '[{key}] Cerrar la puerta', '[{key}] Tür schließen', '[{key}] Fechar a porta', '[{key}] Chiudi la porta'],
  'loot.take': ['[{key}] Ramasser {name}{ammo}', '[{key}] Pick up {name}{ammo}', '[{key}] Recoger {name}{ammo}', '[{key}] {name}{ammo} aufheben', '[{key}] Apanhar {name}{ammo}', '[{key}] Raccogli {name}{ammo}'],
  'hud.reserve': ['Réserve', 'Reserve', 'Reserva', 'Reserve', 'Reserva', 'Riserva'],
  'action.grenade': ['Lancer une grenade', 'Throw grenade', 'Lanzar granada', 'Granate werfen', 'Lançar granada', 'Lancia granata'],
  'action.flashlight': ['Lampe torche', 'Flashlight', 'Linterna', 'Taschenlampe', 'Lanterna', 'Torcia'],
  'action.weapon3': ['Équipement', 'Gear', 'Equipo', 'Ausrüstung', 'Equipamento', 'Equipaggiamento'],
  'stat.magazine': ['Chargeur', 'Magazine', 'Cargador', 'Magazin', 'Carregador', 'Caricatore'],
  'stat.reload': ['Rechargement', 'Reload', 'Recarga', 'Nachladen', 'Recarga', 'Ricarica'],
  'stat.blast': ['Rayon d’explosion', 'Blast radius', 'Radio de explosión', 'Explosionsradius', 'Raio de explosão', 'Raggio dell’esplosione'],
  'weaponTag.burst': ['Rafale de {n}', '{n}-round burst', 'Ráfaga de {n}', '{n}-Schuss-Feuerstoß', 'Rajada de {n}', 'Raffica da {n}'],
  'weaponTag.silent': ['Silencieux', 'Silent', 'Silencioso', 'Lautlos', 'Silencioso', 'Silenzioso'],
  'weaponTag.explosive': ['Explosif', 'Explosive', 'Explosivo', 'Explosiv', 'Explosivo', 'Esplosivo'],
  'weaponTag.spinUp': ['Mise en rotation', 'Spin-up', 'Giro previo', 'Anlaufzeit', 'Arranque', 'Avviamento'],
  'weaponTag.limited': ['Munitions limitées', 'Limited ammo', 'Munición limitada', 'Begrenzte Munition', 'Munições limitadas', 'Munizioni limitate'],

  /* Tenues et raretés */
  'outfit.desert': ['Sable', 'Sand', 'Arena', 'Sand', 'Areia', 'Sabbia'],
  'outfit.foret': ['Forêt', 'Forest', 'Bosque', 'Wald', 'Floresta', 'Foresta'],
  'outfit.urbain': ['Urbain', 'Urban', 'Urbano', 'Urban', 'Urbano', 'Urbano'],
  'outfit.arctique': ['Arctique', 'Arctic', 'Ártico', 'Arktis', 'Ártico', 'Artico'],
  'outfit.nuit': ['Opération Nuit', 'Night Operation', 'Operación Noche', 'Operation Nacht', 'Operação Noite', 'Operazione Notte'],
  'outfit.braise': ['Braise', 'Ember', 'Brasa', 'Glut', 'Brasa', 'Brace'],
  // map outfits of the three new maps (outfit-map-barrage/marais/cite.js): the set name stays a proper noun, the colourway is translated
  'outfit.descendeur-aiguenoire': ['DESCENDEUR Aiguenoire', 'DESCENDEUR Aiguenoire', 'DESCENDEUR Aiguenoire', 'DESCENDEUR Aiguenoire', 'DESCENDEUR Aiguenoire', 'DESCENDEUR Aiguenoire'],
  'outfit.descendeur-conduite': ['DESCENDEUR Conduite', 'DESCENDEUR Penstock', 'DESCENDEUR Tubería', 'DESCENDEUR Druckrohr', 'DESCENDEUR Conduta', 'DESCENDEUR Condotta'],
  'outfit.descendeur-turbine': ['DESCENDEUR Turbine', 'DESCENDEUR Turbine', 'DESCENDEUR Turbina', 'DESCENDEUR Turbine', 'DESCENDEUR Turbina', 'DESCENDEUR Turbina'],
  'outfit.descendeur-embrun': ['DESCENDEUR Embrun', 'DESCENDEUR Spray', 'DESCENDEUR Rocío', 'DESCENDEUR Gischt', 'DESCENDEUR Borrifo', 'DESCENDEUR Spruzzo'],
  'outfit.roselier-saulnes': ['ROSELIER Saulnes', 'ROSELIER Saulnes', 'ROSELIER Saulnes', 'ROSELIER Saulnes', 'ROSELIER Saulnes', 'ROSELIER Saulnes'],
  'outfit.roselier-vasiere': ['ROSELIER Vasière', 'ROSELIER Mudflat', 'ROSELIER Marisma', 'ROSELIER Watt', 'ROSELIER Lodaçal', 'ROSELIER Barena'],
  'outfit.roselier-heron': ['ROSELIER Héron', 'ROSELIER Heron', 'ROSELIER Garza', 'ROSELIER Reiher', 'ROSELIER Garça', 'ROSELIER Airone'],
  'outfit.roselier-tourbe': ['ROSELIER Tourbe', 'ROSELIER Peat', 'ROSELIER Turba', 'ROSELIER Torf', 'ROSELIER Turfa', 'ROSELIER Torba'],
  'outfit.ecarteur-verriere': ['ÉCARTEUR Verrière', 'ÉCARTEUR Verrière', 'ÉCARTEUR Verrière', 'ÉCARTEUR Verrière', 'ÉCARTEUR Verrière', 'ÉCARTEUR Verrière'],
  'outfit.ecarteur-gravats': ['ÉCARTEUR Gravats', 'ÉCARTEUR Rubble', 'ÉCARTEUR Escombros', 'ÉCARTEUR Schutt', 'ÉCARTEUR Entulho', 'ÉCARTEUR Macerie'],
  'outfit.ecarteur-suie': ['ÉCARTEUR Suie', 'ÉCARTEUR Soot', 'ÉCARTEUR Hollín', 'ÉCARTEUR Ruß', 'ÉCARTEUR Fuligem', 'ÉCARTEUR Fuliggine'],
  'outfit.ecarteur-signal': ['ÉCARTEUR Signal', 'ÉCARTEUR Signal', 'ÉCARTEUR Señal', 'ÉCARTEUR Signal', 'ÉCARTEUR Sinal', 'ÉCARTEUR Segnale'],
  'rarity.standard': ['Standard', 'Standard', 'Estándar', 'Standard', 'Padrão', 'Standard'],
  'rarity.special': ['Spécial', 'Special', 'Especial', 'Spezial', 'Especial', 'Speciale'],
  'rarity.elite': ['Élite', 'Elite', 'Élite', 'Elite', 'Elite', 'Élite'],
  'rarity.legend': ['Légende', 'Legend', 'Leyenda', 'Legende', 'Lenda', 'Leggenda'],

  /* Classes */
  'class.assaut.name': ['Assaut', 'Assault', 'Asalto', 'Sturm', 'Assalto', 'Assalto'],
  'class.assaut.desc': ['Polyvalent. Commence avec plus de blindage.', 'Versatile. Starts with extra armor.', 'Versátil. Empieza con más blindaje.', 'Vielseitig. Startet mit mehr Panzerung.', 'Versátil. Começa com mais blindagem.', 'Versatile. Inizia con più corazza.'],
  'class.eclaireur.name': ['Éclaireur', 'Scout', 'Explorador', 'Späher', 'Batedor', 'Esploratore'],
  'class.eclaireur.desc': ['Le plus rapide du front, glissades plus longues.', 'Fastest on the front, with longer slides.', 'El más rápido del frente, con deslizamientos más largos.', 'Der Schnellste an der Front, mit längeren Rutschpartien.', 'O mais rápido da frente, com deslizes mais longos.', 'Il più rapido del fronte, con scivolate più lunghe.'],
  'class.lourd.name': ['Lourd', 'Heavy', 'Pesado', 'Schwer', 'Pesado', 'Pesante'],
  'class.lourd.desc': ['Encaisse énormément, mais se déplace moins vite.', 'Takes a huge beating, but moves more slowly.', 'Aguanta muchísimo, pero se mueve más despacio.', 'Steckt enorm viel ein, bewegt sich aber langsamer.', 'Aguenta imenso, mas desloca-se mais devagar.', 'Incassa moltissimo, ma si muove più lentamente.'],
  'class.medic.name': ['Médic', 'Medic', 'Médico', 'Sanitäter', 'Médico', 'Medico'],
  'class.medic.desc': ['Sa santé remonte plus tôt et bien plus vite.', 'Health regenerates sooner and much faster.', 'Su salud se regenera antes y mucho más rápido.', 'Gesundheit regeneriert früher und deutlich schneller.', 'A saúde regenera mais cedo e muito mais depressa.', 'La salute si rigenera prima e molto più in fretta.'],

  /* Grades */
  'rank.0': ['Recrue', 'Recruit', 'Recluta', 'Rekrut', 'Recruta', 'Recluta'],
  'rank.1': ['Soldat', 'Private', 'Soldado', 'Soldat', 'Soldado', 'Soldato'],
  'rank.2': ['Caporal', 'Corporal', 'Cabo', 'Korporal', 'Cabo', 'Caporale'],
  'rank.3': ['Sergent', 'Sergeant', 'Sargento', 'Feldwebel', 'Sargento', 'Sergente'],
  'rank.4': ['Adjudant', 'Warrant Officer', 'Brigada', 'Stabsfeldwebel', 'Sargento-mor', 'Maresciallo'],
  'rank.5': ['Lieutenant', 'Lieutenant', 'Teniente', 'Leutnant', 'Tenente', 'Tenente'],
  'rank.6': ['Capitaine', 'Captain', 'Capitán', 'Hauptmann', 'Capitão', 'Capitano'],
  'rank.7': ['Commandant', 'Major', 'Comandante', 'Major', 'Major', 'Maggiore'],
  'rank.8': ['Colonel', 'Colonel', 'Coronel', 'Oberst', 'Coronel', 'Colonnello'],
  'rank.9': ['Général', 'General', 'General', 'General', 'General', 'Generale'],

  /* HUD */
  'hud.lockTip': ['Clique dans le jeu pour verrouiller la souris', 'Click in the game to lock the mouse', 'Haz clic en el juego para bloquear el ratón', 'Klicke ins Spiel, um die Maus zu sperren', 'Clica no jogo para bloquear o rato', 'Clicca nel gioco per bloccare il mouse'],
  'hud.lockImpossible': ['Verrouillage impossible ici : ouvre le jeu dans Chrome ou Edge. Flèches ou bords de l’écran pour tourner.', 'Mouse lock is unavailable here: open the game in Chrome or Edge. Use arrow keys or screen edges to turn.', 'No se puede bloquear aquí: abre el juego en Chrome o Edge. Usa las flechas o los bordes de la pantalla para girar.', 'Sperren hier nicht möglich: Öffne das Spiel in Chrome oder Edge. Drehen mit Pfeiltasten oder Bildschirmrändern.', 'Bloqueio impossível aqui: abre o jogo no Chrome ou Edge. Usa as setas ou as margens do ecrã para rodar.', 'Blocco non disponibile qui: apri il gioco in Chrome o Edge. Usa le frecce o i bordi dello schermo per girarti.'],
  'hud.mouseNotLocked': ['SOURIS NON VERROUILLÉE, RECLIQUE', 'MOUSE NOT LOCKED, CLICK AGAIN', 'RATÓN NO BLOQUEADO, VUELVE A HACER CLIC', 'MAUS NICHT GESPERRT, ERNEUT KLICKEN', 'RATO NÃO BLOQUEADO, CLICA OUTRA VEZ', 'MOUSE NON BLOCCATO, CLICCA DI NUOVO'],
  'hud.you': ['VOUS', 'YOU', 'TÚ', 'DU', 'TU', 'TU'],
  'hud.headTag': ['⌖ tête', '⌖ head', '⌖ cabeza', '⌖ Kopf', '⌖ cabeça', '⌖ testa'],
  'hud.streak': ['SÉRIE DE {n}', '{n} STREAK', 'RACHA DE {n}', '{n}ER-SERIE', 'SEQUÊNCIA DE {n}', 'SERIE DI {n}'],
  'hud.headshot': ['TIR À LA TÊTE', 'HEADSHOT', 'DISPARO A LA CABEZA', 'KOPFSCHUSS', 'TIRO NA CABEÇA', 'COLPO ALLA TESTA'],
  'hud.eliminated': ['ÉLIMINÉ', 'ELIMINATED', 'ELIMINADO', 'ELIMINIERT', 'ELIMINADO', 'ELIMINATO'],
  'hud.respawning': ['Redéploiement…', 'Redeploying…', 'Redesplegando…', 'Neuer Einsatz…', 'A remobilizar…', 'Nuovo schieramento…'],
  'hud.respawnIn': ['Redéploiement dans {s}…', 'Redeploying in {s}…', 'Redespliegue en {s}…', 'Neuer Einsatz in {s}…', 'Remobilização em {s}…', 'Nuovo schieramento tra {s}…'],
  'hud.reloading': ['RECHARGEMENT…', 'RELOADING…', 'RECARGANDO…', 'NACHLADEN…', 'A RECARREGAR…', 'RICARICA…'],
  'hud.guard': ['PROTECTION', 'SPAWN SHIELD', 'PROTECCIÓN', 'SCHUTZ', 'PROTEÇÃO', 'PROTEZIONE'],
  'hud.guardHint': ['Tirer, lancer ou prendre l’objectif y met fin', 'Firing, throwing or taking the objective ends it', 'Disparar, lanzar o tomar el objetivo la termina', 'Schießen, Werfen oder das Ziel einnehmen beendet ihn', 'Disparar, lançar ou tomar o objetivo termina-a', 'Sparare, lanciare o prendere l’obiettivo la termina'],

  /* Pause et fin de partie */
  'pause.title': ['PAUSE', 'PAUSED', 'PAUSA', 'PAUSE', 'PAUSA', 'PAUSA'],
  'pause.resume': ['REPRENDRE', 'RESUME', 'CONTINUAR', 'WEITER', 'CONTINUAR', 'RIPRENDI'],
  'pause.quit': ['QUITTER LA PARTIE', 'QUIT MATCH', 'SALIR DE LA PARTIDA', 'MATCH VERLASSEN', 'SAIR DA PARTIDA', 'ABBANDONA LA PARTITA'],
  'end.win': ['SECTEUR TENU', 'SECTOR HELD', 'SECTOR DEFENDIDO', 'SEKTOR GEHALTEN', 'SETOR DEFENDIDO', 'SETTORE DIFESO'],
  'end.timeUp': ['TEMPS ÉCOULÉ', 'TIME’S UP', 'TIEMPO AGOTADO', 'ZEIT ABGELAUFEN', 'TEMPO ESGOTADO', 'TEMPO SCADUTO'],
  'end.victory': ['VICTOIRE', 'VICTORY', 'VICTORIA', 'SIEG', 'VITÓRIA', 'VITTORIA'],
  'end.defeat': ['DÉFAITE', 'DEFEAT', 'DERROTA', 'NIEDERLAGE', 'DERROTA', 'SCONFITTA'],
  'end.draw': ['ÉGALITÉ', 'DRAW', 'EMPATE', 'UNENTSCHIEDEN', 'EMPATE', 'PAREGGIO'],
  'end.kills': ['Éliminations', 'Eliminations', 'Eliminaciones', 'Eliminierungen', 'Eliminações', 'Eliminazioni'],
  'end.deaths': ['Morts', 'Deaths', 'Muertes', 'Tode', 'Mortes', 'Morti'],
  'end.headshots': ['Tirs à la tête', 'Headshots', 'Disparos a la cabeza', 'Kopfschüsse', 'Tiros na cabeça', 'Colpi alla testa'],
  'end.credits': ['Crédits', 'Credits', 'Créditos', 'Credits', 'Créditos', 'Crediti'],
  'end.again': ['REJOUER', 'PLAY AGAIN', 'JUGAR DE NUEVO', 'NOCHMAL SPIELEN', 'JOGAR NOVAMENTE', 'GIOCA ANCORA'],
  'end.back': ['RETOUR AU QG', 'BACK TO HQ', 'VOLVER AL CG', 'ZURÜCK ZUM HQ', 'VOLTAR AO QG', 'TORNA AL QG'],

  /* Modes */
  'mode.title': ['Mode de jeu', 'Game mode', 'Modo de juego', 'Spielmodus', 'Modo de jogo', 'Modalità di gioco'],
  'mode.solo': ['Solo', 'Solo', 'Individual', 'Solo', 'Solo', 'Singolo'],
  'mode.multiplayer': ['Multijoueur', 'Multiplayer', 'Multijugador', 'Mehrspieler', 'Multijogador', 'Multigiocatore'],
  'mode.deathmatch': ['Match à mort', 'Deathmatch', 'Todos contra todos', 'Deathmatch', 'Combate mortal', 'Deathmatch'],
  'mode.teams': ['Équipes', 'Teams', 'Equipos', 'Teams', 'Equipas', 'Squadre'],
  'mode.domination': ['Domination', 'Domination', 'Dominación', 'Herrschaft', 'Dominação', 'Dominio'],
  'mode.bomb': ['Bombe', 'Bomb', 'Bomba', 'Bombe', 'Bomba', 'Bomba'],
  'mode.zombies': ['Zombies', 'Zombies', 'Zombis', 'Zombies', 'Zombies', 'Zombie'],
  'mode.zone': ['Zone', 'Zone', 'Zona', 'Zone', 'Zona', 'Zona'],

  /* Salon */
  'lobby.title': ['Salon', 'Lobby', 'Sala', 'Lobby', 'Sala', 'Lobby'],
  'lobby.create': ['CRÉER UN SALON', 'CREATE ROOM', 'CREAR SALA', 'RAUM ERSTELLEN', 'CRIAR SALA', 'CREA STANZA'],
  'lobby.join': ['REJOINDRE UN SALON', 'JOIN ROOM', 'UNIRSE A SALA', 'RAUM BEITRETEN', 'ENTRAR NA SALA', 'ENTRA NELLA STANZA'],
  'lobby.code': ['Code du salon', 'Room code', 'Código de sala', 'Raumcode', 'Código da sala', 'Codice stanza'],
  'lobby.codePlaceholder': ['Entrez le code', 'Enter code', 'Introduce el código', 'Code eingeben', 'Introduz o código', 'Inserisci il codice'],
  'lobby.copyCode': ['Copier le code', 'Copy code', 'Copiar código', 'Code kopieren', 'Copiar código', 'Copia codice'],
  'lobby.copied': ['Code copié', 'Code copied', 'Código copiado', 'Code kopiert', 'Código copiado', 'Codice copiato'],
  'lobby.name': ['Nom de joueur', 'Player name', 'Nombre de jugador', 'Spielername', 'Nome de jogador', 'Nome giocatore'],
  'lobby.players': ['Joueurs', 'Players', 'Jugadores', 'Spieler', 'Jogadores', 'Giocatori'],
  'lobby.ready': ['PRÊT', 'READY', 'LISTO', 'BEREIT', 'PRONTO', 'PRONTO'],
  'lobby.notReady': ['PAS PRÊT', 'NOT READY', 'NO LISTO', 'NICHT BEREIT', 'NÃO PRONTO', 'NON PRONTO'],
  'lobby.host': ['Hôte', 'Host', 'Anfitrión', 'Host', 'Anfitrião', 'Host'],
  'lobby.team': ['Équipe', 'Team', 'Equipo', 'Team', 'Equipa', 'Squadra'],
  'lobby.teamA': ['Équipe Alpha', 'Team Alpha', 'Equipo Alfa', 'Team Alpha', 'Equipa Alfa', 'Squadra Alfa'],
  'lobby.teamB': ['Équipe Bravo', 'Team Bravo', 'Equipo Bravo', 'Team Bravo', 'Equipa Bravo', 'Squadra Bravo'],
  'lobby.map': ['Carte', 'Map', 'Mapa', 'Karte', 'Mapa', 'Mappa'],
  'lobby.start': ['LANCER LA PARTIE', 'START MATCH', 'INICIAR PARTIDA', 'MATCH STARTEN', 'INICIAR PARTIDA', 'AVVIA PARTITA'],
  'lobby.leave': ['QUITTER LE SALON', 'LEAVE ROOM', 'SALIR DE LA SALA', 'RAUM VERLASSEN', 'SAIR DA SALA', 'ESCI DALLA STANZA'],
  'lobby.waiting': ['En attente des joueurs…', 'Waiting for players…', 'Esperando jugadores…', 'Warte auf Spieler…', 'À espera de jogadores…', 'In attesa dei giocatori…'],
  'lobby.connecting': ['Connexion…', 'Connecting…', 'Conectando…', 'Verbinde…', 'A ligar…', 'Connessione…'],
  'lobby.disconnected': ['Connexion perdue', 'Connection lost', 'Conexión perdida', 'Verbindung verloren', 'Ligação perdida', 'Connessione persa'],
  'lobby.notFound': ['Salon introuvable', 'Room not found', 'Sala no encontrada', 'Raum nicht gefunden', 'Sala não encontrada', 'Stanza non trovata'],
  'lobby.full': ['Salon complet', 'Room is full', 'Sala llena', 'Raum ist voll', 'Sala cheia', 'Stanza piena'],

  /* Domination */
  'dom.capturing': ['Capture du point {point}…', 'Capturing point {point}…', 'Capturando el punto {point}…', 'Punkt {point} wird erobert…', 'A capturar o ponto {point}…', 'Conquista del punto {point}…'],
  'dom.captured': ['Point {point} capturé', 'Point {point} captured', 'Punto {point} capturado', 'Punkt {point} erobert', 'Ponto {point} capturado', 'Punto {point} conquistato'],
  'dom.lost': ['Point {point} perdu', 'Point {point} lost', 'Punto {point} perdido', 'Punkt {point} verloren', 'Ponto {point} perdido', 'Punto {point} perso'],

  /* Bombe */
  'bomb.plant': ['Poser la bombe', 'Plant the bomb', 'Colocar la bomba', 'Bombe legen', 'Plantar a bomba', 'Piazza la bomba'],
  'bomb.holdPlant': ['Maintenez {key} pour poser la bombe', 'Hold {key} to plant the bomb', 'Mantén {key} para colocar la bomba', 'Halte {key}, um die Bombe zu legen', 'Mantém {key} para plantar a bomba', 'Tieni premuto {key} per piazzare la bomba'],
  'bomb.planting': ['Pose de la bombe…', 'Planting bomb…', 'Colocando la bomba…', 'Bombe wird gelegt…', 'A plantar a bomba…', 'Piazzamento bomba…'],
  'bomb.planted': ['BOMBE POSÉE', 'BOMB PLANTED', 'BOMBA COLOCADA', 'BOMBE GELEGT', 'BOMBA PLANTADA', 'BOMBA PIAZZATA'],
  'bomb.defuse': ['Désamorcer la bombe', 'Defuse the bomb', 'Desactivar la bomba', 'Bombe entschärfen', 'Desarmar a bomba', 'Disinnesca la bomba'],
  'bomb.holdDefuse': ['Maintenez {key} pour désamorcer', 'Hold {key} to defuse', 'Mantén {key} para desactivar', 'Halte {key} zum Entschärfen', 'Mantém {key} para desarmar', 'Tieni premuto {key} per disinnescare'],
  'bomb.defusing': ['Désamorçage…', 'Defusing…', 'Desactivando…', 'Wird entschärft…', 'A desarmar…', 'Disinnesco…'],
  'bomb.defused': ['BOMBE DÉSAMORCÉE', 'BOMB DEFUSED', 'BOMBA DESACTIVADA', 'BOMBE ENTSCHÄRFT', 'BOMBA DESARMADA', 'BOMBA DISINNESCATA'],
  'bomb.exploded': ['LA BOMBE A EXPLOSÉ', 'THE BOMB EXPLODED', 'LA BOMBA HA EXPLOTADO', 'DIE BOMBE IST EXPLODIERT', 'A BOMBA EXPLODIU', 'LA BOMBA È ESPLOSA'],
  'bomb.site': ['Site {site}', 'Site {site}', 'Zona {site}', 'Ziel {site}', 'Local {site}', 'Sito {site}'],
  'bomb.attackers': ['Attaquants', 'Attackers', 'Atacantes', 'Angreifer', 'Atacantes', 'Attaccanti'],
  'bomb.defenders': ['Défenseurs', 'Defenders', 'Defensores', 'Verteidiger', 'Defensores', 'Difensori'],
  'round.number': ['Manche {n}', 'Round {n}', 'Ronda {n}', 'Runde {n}', 'Ronda {n}', 'Round {n}'],
  'round.won': ['MANCHE GAGNÉE', 'ROUND WON', 'RONDA GANADA', 'RUNDE GEWONNEN', 'RONDA GANHA', 'ROUND VINTO'],
  'round.lost': ['MANCHE PERDUE', 'ROUND LOST', 'RONDA PERDIDA', 'RUNDE VERLOREN', 'RONDA PERDIDA', 'ROUND PERSO'],

  /* Zombies */
  'zombie.wave': ['Vague {n}', 'Wave {n}', 'Oleada {n}', 'Welle {n}', 'Vaga {n}', 'Ondata {n}'],
  'zombie.waveIncoming': ['Prochaine vague dans {s}…', 'Next wave in {s}…', 'Próxima oleada en {s}…', 'Nächste Welle in {s}…', 'Próxima vaga em {s}…', 'Prossima ondata tra {s}…'],
  'zombie.waveCleared': ['VAGUE {n} REPOUSSÉE', 'WAVE {n} CLEARED', 'OLEADA {n} SUPERADA', 'WELLE {n} ABGEWEHRT', 'VAGA {n} REPELIDA', 'ONDATA {n} RESPINTA'],
  'zombie.remaining': ['{n} restants', '{n} remaining', '{n} restantes', '{n} übrig', '{n} restantes', '{n} rimasti'],
  'zombie.revive': ['Réanimer', 'Revive', 'Reanimar', 'Wiederbeleben', 'Reanimar', 'Rianima'],
  'zombie.holdRevive': ['Maintenez {key} pour réanimer {name}', 'Hold {key} to revive {name}', 'Mantén {key} para reanimar a {name}', 'Halte {key}, um {name} wiederzubeleben', 'Mantém {key} para reanimar {name}', 'Tieni premuto {key} per rianimare {name}'],
  'zombie.reviving': ['Réanimation…', 'Reviving…', 'Reanimando…', 'Wiederbelebung…', 'A reanimar…', 'Rianimazione…'],
  'zombie.revived': ['{name} réanimé', '{name} revived', '{name} reanimado', '{name} wiederbelebt', '{name} reanimado', '{name} rianimato'],
  'zombie.downed': ['À TERRE', 'DOWNED', 'DERRIBADO', 'AM BODEN', 'CAÍDO', 'A TERRA'],
  'zombie.teammateDown': ['{name} est à terre', '{name} is down', '{name} ha caído', '{name} ist am Boden', '{name} caiu', '{name} è a terra'],
  'zombie.bleedout': ['Mort dans {s}…', 'Bleeding out in {s}…', 'Te desangras en {s}…', 'Verblutest in {s}…', 'A sangrar: {s}…', 'Dissanguamento tra {s}…'],
  'zombie.gameOver': ['FRONT PERDU', 'FRONT LOST', 'FRENTE PERDIDO', 'FRONT VERLOREN', 'FRENTE PERDIDA', 'FRONTE PERDUTO'],
  'zombie.survived': ['{n} vagues survécues', '{n} waves survived', '{n} oleadas superadas', '{n} Wellen überlebt', '{n} vagas sobrevividas', '{n} ondate superate'],

  /* Cartes */
  'map.depot': ['Le Dépôt', 'The Depot', 'El Depósito', 'Das Depot', 'O Depósito', 'Il Deposito'],
  'map.vieille-ville': ['Vieille Ville', 'Old Town', 'Ciudad Vieja', 'Altstadt', 'Cidade Velha', 'Città Vecchia'],
  'map.port': ['Le Port', 'The Harbor', 'El Puerto', 'Der Hafen', 'O Porto', 'Il Porto'],
  'map.bunker': ['Le Bunker', 'The Bunker', 'El Búnker', 'Der Bunker', 'O Bunker', 'Il Bunker'],
  'map.col-blanc': ['Col Blanc', 'White Pass', 'Paso Blanco', 'Weißer Pass', 'Passo Branco', 'Passo Bianco'],
  'map.sept-vents': ['Piste Sept-Vents', 'Seven Winds Airfield', 'Pista Siete Vientos', 'Flugfeld Sieben Winde', 'Pista Sete Ventos', 'Pista Sette Venti'],
  'map.noirval': ['Raffinerie Noirval', 'Noirval Refinery', 'Refinería Noirval', 'Raffinerie Noirval', 'Refinaria Noirval', 'Raffineria Noirval'],
  'map.roqueseche': ['Roquesèche', 'Roquesèche', 'Roquesèche', 'Roquesèche', 'Roquesèche', 'Roquesèche'], 'map.valferrade': ['Valferrade', 'Valferrade', 'Valferrade', 'Valferrade', 'Valferrade', 'Valferrade'], 'map.barrage': ['Barrage d’Aiguenoire', 'Aiguenoire Dam', 'Presa de Aiguenoire', 'Aiguenoire-Staudamm', 'Barragem de Aiguenoire', 'Diga di Aiguenoire'], 'map.marais': ['Marais de Saulnes', 'Saulnes Marsh', 'Marisma de Saulnes', 'Saulnes-Marsch', 'Pântano de Saulnes', 'Palude di Saulnes'],'map.cite': ['Cité Verrière', 'Cité Verrière', 'Cité Verrière', 'Cité Verrière', 'Cité Verrière', 'Cité Verrière'],'map.val-cendre': ['Val de Cendre', 'Ash Valley', 'Valle de Ceniza', 'Aschental', 'Vale de Cinza', 'Val di Cenere'],

  /* Paramètres : structure */
  'settings.title': ['PARAMÈTRES', 'SETTINGS', 'AJUSTES', 'EINSTELLUNGEN', 'DEFINIÇÕES', 'IMPOSTAZIONI'],
  'section.keys': ['Commandes', 'Controls', 'Controles', 'Steuerung', 'Controlos', 'Comandi'],
  'section.mouse': ['Souris', 'Mouse', 'Ratón', 'Maus', 'Rato', 'Mouse'],
  'section.graphics': ['Graphismes', 'Graphics', 'Gráficos', 'Grafik', 'Gráficos', 'Grafica'],
  'section.audio': ['Audio', 'Audio', 'Audio', 'Audio', 'Áudio', 'Audio'],
  'section.gameplay': ['Jouabilité', 'Gameplay', 'Jugabilidad', 'Gameplay', 'Jogabilidade', 'Giocabilità'],
  'section.language': ['Langue', 'Language', 'Idioma', 'Sprache', 'Idioma', 'Lingua'],
  'group.movement': ['Déplacement', 'Movement', 'Movimiento', 'Bewegung', 'Movimento', 'Movimento'],
  'group.combat': ['Combat', 'Combat', 'Combate', 'Kampf', 'Combate', 'Combattimento'],
  'group.weapons': ['Armes', 'Weapons', 'Armas', 'Waffen', 'Armas', 'Armi'],
  'group.interface': ['Interface', 'Interface', 'Interfaz', 'Oberfläche', 'Interface', 'Interfaccia'],
  'group.quality': ['Qualité', 'Quality', 'Calidad', 'Qualität', 'Qualidade', 'Qualità'],
  'group.effects': ['Effets', 'Effects', 'Efectos', 'Effekte', 'Efeitos', 'Effetti'],
  'group.display': ['Affichage', 'Display', 'Pantalla', 'Anzeige', 'Ecrã', 'Schermo'],
  'group.crosshair': ['Réticule', 'Crosshair', 'Mira', 'Fadenkreuz', 'Mira', 'Mirino'],
  'group.feedback': ['Retours en jeu', 'In-game feedback', 'Indicadores en juego', 'Rückmeldungen im Spiel', 'Indicadores no jogo', 'Indicatori di gioco'],
  'group.accessibility': ['Accessibilité', 'Accessibility', 'Accesibilidad', 'Barrierefreiheit', 'Acessibilidade', 'Accessibilità'],

  /* Actions */
  'action.forward': ['Avancer', 'Move forward', 'Avanzar', 'Vorwärts', 'Avançar', 'Avanti'],
  'action.back': ['Reculer', 'Move back', 'Retroceder', 'Rückwärts', 'Recuar', 'Indietro'],
  'action.left': ['Aller à gauche', 'Strafe left', 'Izquierda', 'Links', 'Esquerda', 'Sinistra'],
  'action.right': ['Aller à droite', 'Strafe right', 'Derecha', 'Rechts', 'Direita', 'Destra'],
  'action.jump': ['Sauter', 'Jump', 'Saltar', 'Springen', 'Saltar', 'Salta'],
  'action.slide': ['Glisser', 'Slide', 'Deslizarse', 'Rutschen', 'Deslizar', 'Scivola'],
  'action.crouch': ['S’accroupir', 'Crouch', 'Agacharse', 'Ducken', 'Agachar', 'Accovacciati'],
  'action.sprint': ['Sprinter', 'Sprint', 'Esprintar', 'Sprinten', 'Correr', 'Scatta'],
  'action.fire': ['Tirer', 'Fire', 'Disparar', 'Schießen', 'Disparar', 'Spara'],
  'action.aim': ['Viser', 'Aim', 'Apuntar', 'Zielen', 'Apontar', 'Mira'],
  'action.reload': ['Recharger', 'Reload', 'Recargar', 'Nachladen', 'Recarregar', 'Ricarica'],
  'action.weapon1': ['Arme principale', 'Primary weapon', 'Arma principal', 'Primärwaffe', 'Arma principal', 'Arma primaria'],
  'action.weapon2': ['Arme secondaire', 'Secondary weapon', 'Arma secundaria', 'Zweitwaffe', 'Arma secundária', 'Arma secondaria'],
  'action.nextWeapon': ['Arme suivante', 'Next weapon', 'Arma siguiente', 'Nächste Waffe', 'Arma seguinte', 'Arma successiva'],
  'action.interact': ['Interagir (ramasser, poser, désamorcer, réanimer)', 'Interact (pick up, plant, defuse, revive)', 'Interactuar (recoger, colocar, desactivar, reanimar)', 'Interagieren (aufheben, legen, entschärfen, wiederbeleben)', 'Interagir (apanhar, plantar, desarmar, reanimar)', 'Interagisci (raccogli, piazza, disinnesca, rianima)'],
  'action.scoreboard': ['Tableau des scores', 'Scoreboard', 'Marcador', 'Punktetafel', 'Tabela de pontuação', 'Classifica'],
  'action.pause': ['Pause', 'Pause', 'Pausa', 'Pause', 'Pausa', 'Pausa'],
  'action.toggleMute': ['Couper le son', 'Toggle mute', 'Silenciar', 'Ton an/aus', 'Silenciar', 'Disattiva audio'],
  'action.toggleFps': ['Afficher les IPS', 'Toggle FPS display', 'Mostrar FPS', 'FPS ein/aus', 'Mostrar FPS', 'Mostra FPS'],

  /* Rebind */
  'bind.press': ['Appuyez…', 'Press…', 'Pulsa…', 'Taste drücken…', 'Prime…', 'Premi…'],
  'bind.instructions': ['Appuyez sur une touche ou un bouton de souris pour « {action} ». Échap pour annuler.', 'Press a key or mouse button for “{action}”. Escape to cancel.', 'Pulsa una tecla o botón del ratón para «{action}». Esc para cancelar.', 'Drücke eine Taste oder Maustaste für „{action}“. Esc zum Abbrechen.', 'Prime uma tecla ou botão do rato para «{action}». Esc para cancelar.', 'Premi un tasto o un pulsante del mouse per «{action}». Esc per annullare.'],
  'bind.unbound': ['Non assignée', 'Unbound', 'Sin asignar', 'Nicht belegt', 'Não atribuída', 'Non assegnato'],
  'bind.conflict': ['{key} est déjà assignée à « {other} ». Échanger avec « {action} » ?', '{key} is already bound to “{other}”. Swap with “{action}”?', '{key} ya está asignada a «{other}». ¿Intercambiar con «{action}»?', '{key} ist bereits mit „{other}“ belegt. Mit „{action}“ tauschen?', '{key} já está atribuída a «{other}». Trocar com «{action}»?', '{key} è già assegnato a «{other}». Scambiare con «{action}»?'],
  'bind.swap': ['Échanger', 'Swap', 'Intercambiar', 'Tauschen', 'Trocar', 'Scambia'],
  'bind.reserved': ['{key} est réservée et ne peut pas être assignée.', '{key} is reserved and cannot be bound.', '{key} está reservada y no se puede asignar.', '{key} ist reserviert und kann nicht belegt werden.', '{key} está reservada e não pode ser atribuída.', '{key} è riservato e non può essere assegnato.'],
  'bind.done': ['« {action} » : {key}', '“{action}”: {key}', '«{action}»: {key}', '„{action}“: {key}', '«{action}»: {key}', '«{action}»: {key}'],
  'bind.escapeNote': ['Échap reste réservée à la pause et ne peut pas être réassignée.', 'Escape stays reserved for pause and cannot be rebound.', 'Esc queda reservada para la pausa y no se puede reasignar.', 'Esc bleibt für die Pause reserviert und kann nicht neu belegt werden.', 'Esc fica reservada para a pausa e não pode ser reatribuída.', 'Esc resta riservato alla pausa e non può essere riassegnato.'],

  /* Boutons communs */
  'common.cancel': ['Annuler', 'Cancel', 'Cancelar', 'Abbrechen', 'Cancelar', 'Annulla'],
  'common.confirm': ['Confirmer', 'Confirm', 'Confirmar', 'Bestätigen', 'Confirmar', 'Conferma'],
  'common.reset': ['Rétablir les valeurs par défaut', 'Reset to defaults', 'Restablecer valores', 'Auf Standard zurücksetzen', 'Repor predefinições', 'Ripristina predefiniti'],
  'common.resetConfirm': ['Rétablir les valeurs par défaut de « {section} » ?', 'Reset “{section}” to defaults?', '¿Restablecer «{section}» a los valores predeterminados?', '„{section}“ auf Standard zurücksetzen?', 'Repor as predefinições de «{section}»?', 'Ripristinare i valori predefiniti di «{section}»?'],
  'common.on': ['Activé', 'On', 'Activado', 'An', 'Ligado', 'Attivo'],
  'common.off': ['Désactivé', 'Off', 'Desactivado', 'Aus', 'Desligado', 'Disattivo'],

  /* Souris */
  'set.sensitivity': ['Sensibilité', 'Sensitivity', 'Sensibilidad', 'Empfindlichkeit', 'Sensibilidade', 'Sensibilità'],
  'set.adsMultiplier': ['Multiplicateur en visée', 'Aim sensitivity multiplier', 'Multiplicador al apuntar', 'Multiplikator beim Zielen', 'Multiplicador ao apontar', 'Moltiplicatore in mira'],
  'set.invertY': ['Inverser l’axe vertical', 'Invert vertical axis', 'Invertir eje vertical', 'Vertikale Achse umkehren', 'Inverter eixo vertical', 'Inverti asse verticale'],
  'set.rawInput': ['Entrée brute', 'Raw input', 'Entrada directa', 'Rohdaten-Eingabe', 'Entrada direta', 'Input diretto'],
  'set.rawInputHint': ['Ignore l’accélération du système si le navigateur le permet.', 'Ignores system acceleration when the browser supports it.', 'Ignora la aceleración del sistema si el navegador lo permite.', 'Ignoriert die Systembeschleunigung, wenn der Browser es unterstützt.', 'Ignora a aceleração do sistema se o navegador o permitir.', 'Ignora l’accelerazione di sistema se il browser lo consente.'],

  /* Graphismes */
  'set.preset': ['Préréglage', 'Preset', 'Preajuste', 'Voreinstellung', 'Predefinição', 'Preimpostazione'],
  'preset.bas': ['Bas', 'Low', 'Bajo', 'Niedrig', 'Baixo', 'Basso'],
  'preset.moyen': ['Moyen', 'Medium', 'Medio', 'Mittel', 'Médio', 'Medio'],
  'preset.eleve': ['Élevé', 'High', 'Alto', 'Hoch', 'Alto', 'Alto'],
  'preset.ultra': same('Ultra'),
  'preset.personnalise': ['Personnalisé', 'Custom', 'Personalizado', 'Benutzerdefiniert', 'Personalizado', 'Personalizzato'],
  'set.renderScale': ['Échelle de rendu', 'Render scale', 'Escala de renderizado', 'Renderskalierung', 'Escala de renderização', 'Scala di rendering'],
  'set.autoResolution': ['Résolution automatique', 'Auto resolution', 'Resolución automática', 'Automatische Auflösung', 'Resolução automática', 'Risoluzione automatica'],
  'set.autoResolutionHint': ['Baisse l’échelle de rendu pour maintenir la fluidité.', 'Lowers render scale to keep the game smooth.', 'Reduce la escala de renderizado para mantener la fluidez.', 'Senkt die Renderskalierung für ein flüssiges Spiel.', 'Reduz a escala de renderização para manter a fluidez.', 'Riduce la scala di rendering per mantenere la fluidità.'],
  'set.shadows': ['Qualité des ombres', 'Shadow quality', 'Calidad de sombras', 'Schattenqualität', 'Qualidade das sombras', 'Qualità delle ombre'],
  'set.antialiasing': ['Anticrénelage', 'Anti-aliasing', 'Antialiasing', 'Kantenglättung', 'Antialiasing', 'Antialiasing'],
  'set.postProcessing': ['Post-traitement', 'Post-processing', 'Posprocesado', 'Nachbearbeitung', 'Pós-processamento', 'Post-elaborazione'],
  'set.filmGrain': ['Grain de film', 'Film grain', 'Grano de película', 'Filmkorn', 'Grão de filme', 'Grana della pellicola'],
  'set.vignette': ['Vignettage', 'Vignette', 'Viñeta', 'Vignette', 'Vinheta', 'Vignettatura'],
  'set.particles': ['Densité des particules', 'Particle density', 'Densidad de partículas', 'Partikeldichte', 'Densidade de partículas', 'Densità delle particelle'],
  'set.viewDistance': ['Distance d’affichage', 'View distance', 'Distancia de visión', 'Sichtweite', 'Distância de visão', 'Distanza visiva'],
  'set.fov': ['Champ de vision', 'Field of view', 'Campo de visión', 'Sichtfeld', 'Campo de visão', 'Campo visivo'],
  'set.fpsLimit': ['Limite d’IPS', 'FPS limit', 'Límite de FPS', 'FPS-Limit', 'Limite de FPS', 'Limite FPS'],
  'set.showFps': ['Afficher les IPS', 'Show FPS', 'Mostrar FPS', 'FPS anzeigen', 'Mostrar FPS', 'Mostra FPS'],
  'set.showNet': ['Indicateur réseau', 'Network indicator', 'Indicador de red', 'Netzwerkanzeige', 'Indicador de rede', 'Indicatore di rete'],
  'opt.off': ['Désactivé', 'Off', 'Desactivado', 'Aus', 'Desligado', 'Disattivo'],
  'opt.low': ['Basse', 'Low', 'Baja', 'Niedrig', 'Baixa', 'Bassa'],
  'opt.medium': ['Moyenne', 'Medium', 'Media', 'Mittel', 'Média', 'Media'],
  'opt.high': ['Élevée', 'High', 'Alta', 'Hoch', 'Alta', 'Alta'],
  'opt.fxaa': same('FXAA'),
  'opt.msaa': same('MSAA'),
  'opt.unlimited': ['Illimité', 'Unlimited', 'Ilimitado', 'Unbegrenzt', 'Ilimitado', 'Illimitato'],

  /* Audio */
  'set.master': ['Volume général', 'Master volume', 'Volumen general', 'Gesamtlautstärke', 'Volume geral', 'Volume generale'],
  'set.effects': ['Effets sonores', 'Sound effects', 'Efectos de sonido', 'Soundeffekte', 'Efeitos sonoros', 'Effetti sonori'],
  'set.music': ['Musique et ambiance', 'Music and ambience', 'Música y ambiente', 'Musik und Atmosphäre', 'Música e ambiente', 'Musica e ambiente'],
  'set.ui': ['Interface', 'Interface', 'Interfaz', 'Oberfläche', 'Interface', 'Interfaccia'],
  'set.muteUnfocused': ['Couper le son hors de la fenêtre', 'Mute when unfocused', 'Silenciar sin foco', 'Stumm, wenn nicht im Fokus', 'Silenciar sem foco', 'Silenzia quando non in primo piano'],

  /* Jouabilité */
  'set.crosshairStyle': ['Style', 'Style', 'Estilo', 'Stil', 'Estilo', 'Stile'],
  'set.crosshairSize': ['Taille', 'Size', 'Tamaño', 'Größe', 'Tamanho', 'Dimensione'],
  'set.crosshairColor': ['Couleur', 'Color', 'Color', 'Farbe', 'Cor', 'Colore'],
  'set.crosshairPreview': ['Aperçu du réticule', 'Crosshair preview', 'Vista previa de la mira', 'Fadenkreuz-Vorschau', 'Pré-visualização da mira', 'Anteprima del mirino'],
  'crosshair.cross': ['Croix', 'Cross', 'Cruz', 'Kreuz', 'Cruz', 'Croce'],
  'crosshair.dot': ['Point', 'Dot', 'Punto', 'Punkt', 'Ponto', 'Punto'],
  'crosshair.circle': ['Cercle', 'Circle', 'Círculo', 'Kreis', 'Círculo', 'Cerchio'],
  'crosshair.crossdot': ['Croix et point', 'Cross and dot', 'Cruz y punto', 'Kreuz und Punkt', 'Cruz e ponto', 'Croce e punto'],
  'set.hitMarkers': ['Marqueurs d’impact', 'Hit markers', 'Marcadores de impacto', 'Treffermarker', 'Marcadores de impacto', 'Indicatori di colpo'],
  'set.damageNumbers': ['Chiffres de dégâts', 'Damage numbers', 'Números de daño', 'Schadenszahlen', 'Números de dano', 'Numeri dei danni'],
  'set.minimap': ['Mini-carte', 'Minimap', 'Minimapa', 'Minikarte', 'Minimapa', 'Minimappa'],
  'set.minimapRotate': ['Mini-carte tournante (sinon nord en haut)', 'Rotating minimap (otherwise north up)', 'Minimapa giratorio (si no, norte arriba)', 'Drehende Minikarte (sonst Norden oben)', 'Minimapa rotativo (senão, norte em cima)', 'Minimappa rotante (altrimenti nord in alto)'],
  'set.compass': ['Boussole en haut de l’écran', 'Compass at the top of the screen', 'Brújula en la parte superior', 'Kompass oben am Bildschirm', 'Bússola no topo do ecrã', 'Bussola in alto sullo schermo'],
  'gfx.nextMatch': ['Qualité plus haute : appliquée à la prochaine partie.', 'Higher quality: applied at the next match.', 'Mayor calidad: se aplicará en la próxima partida.', 'Höhere Qualität: gilt ab dem nächsten Match.', 'Qualidade mais alta: aplicada na próxima partida.', 'Qualità più alta: applicata alla prossima partita.'],
  'set.reducedMotion': ['Mouvements de caméra réduits', 'Reduced camera motion', 'Movimiento de cámara reducido', 'Reduzierte Kamerabewegung', 'Movimento de câmara reduzido', 'Movimento della telecamera ridotto'],
  'set.reducedMotionHint': ['Atténue les secousses, le balancement et le recul visuel.', 'Softens camera shake, head bob and visual recoil.', 'Atenúa las sacudidas, el balanceo y el retroceso visual.', 'Mildert Kamerawackeln, Kopfbewegung und sichtbaren Rückstoß.', 'Atenua os abanões, o balanço e o recuo visual.', 'Attenua scosse, oscillazione e rinculo visivo.'],

  /* Noms de touches */
  'keyname.Space': ['Espace', 'Space', 'Espacio', 'Leertaste', 'Espaço', 'Spazio'],
  'keyname.ShiftLeft': ['Maj gauche', 'Left Shift', 'Mayús izq.', 'Umschalt links', 'Shift esq.', 'Maiusc sin.'],
  'keyname.ShiftRight': ['Maj droite', 'Right Shift', 'Mayús der.', 'Umschalt rechts', 'Shift dir.', 'Maiusc des.'],
  'keyname.ControlLeft': ['Ctrl gauche', 'Left Ctrl', 'Ctrl izq.', 'Strg links', 'Ctrl esq.', 'Ctrl sin.'],
  'keyname.ControlRight': ['Ctrl droite', 'Right Ctrl', 'Ctrl der.', 'Strg rechts', 'Ctrl dir.', 'Ctrl des.'],
  'keyname.AltLeft': ['Alt gauche', 'Left Alt', 'Alt izq.', 'Alt links', 'Alt esq.', 'Alt sin.'],
  'keyname.AltRight': ['Alt Gr', 'Right Alt', 'Alt Gr', 'Alt Gr', 'Alt Gr', 'Alt Gr'],
  'keyname.Tab': ['Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab'],
  'keyname.Enter': ['Entrée', 'Enter', 'Intro', 'Eingabe', 'Enter', 'Invio'],
  'keyname.Backspace': ['Retour arrière', 'Backspace', 'Retroceso', 'Rücktaste', 'Retrocesso', 'Backspace'],
  'keyname.CapsLock': ['Verr. Maj', 'Caps Lock', 'Bloq Mayús', 'Feststell', 'Caps Lock', 'Bloc Maiusc'],
  'keyname.Delete': ['Suppr', 'Delete', 'Supr', 'Entf', 'Delete', 'Canc'],
  'keyname.Insert': ['Inser', 'Insert', 'Insert', 'Einfg', 'Insert', 'Ins'],
  'keyname.Home': ['Début', 'Home', 'Inicio', 'Pos1', 'Home', 'Home'],
  'keyname.End': ['Fin', 'End', 'Fin', 'Ende', 'End', 'Fine'],
  'keyname.PageUp': ['Page préc.', 'Page Up', 'Re Pág', 'Bild auf', 'Page Up', 'Pag su'],
  'keyname.PageDown': ['Page suiv.', 'Page Down', 'Av Pág', 'Bild ab', 'Page Down', 'Pag giù'],
  'keyname.Numpad': ['Pavé num. {k}', 'Numpad {k}', 'Teclado num. {k}', 'Num {k}', 'Teclado num. {k}', 'Tastierino {k}'],
  'keyname.Mouse0': ['Clic gauche', 'Left click', 'Clic izquierdo', 'Linksklick', 'Clique esquerdo', 'Clic sinistro'],
  'keyname.Mouse1': ['Clic molette', 'Middle click', 'Clic central', 'Mittelklick', 'Clique central', 'Clic centrale'],
  'keyname.Mouse2': ['Clic droit', 'Right click', 'Clic derecho', 'Rechtsklick', 'Clique direito', 'Clic destro'],
  'keyname.Mouse3': ['Souris 4', 'Mouse 4', 'Ratón 4', 'Maus 4', 'Rato 4', 'Mouse 4'],
  'keyname.Mouse4': ['Souris 5', 'Mouse 5', 'Ratón 5', 'Maus 5', 'Rato 5', 'Mouse 5'],
  'keyname.WheelUp': ['Molette haut', 'Wheel up', 'Rueda arriba', 'Mausrad hoch', 'Roda acima', 'Rotella su'],
  'keyname.WheelDown': ['Molette bas', 'Wheel down', 'Rueda abajo', 'Mausrad runter', 'Roda abaixo', 'Rotella giù'],

  /* Boutique (shop-ui.js) */
  'store.title': ['BOUTIQUE', 'SHOP', 'TIENDA', 'SHOP', 'LOJA', 'NEGOZIO'],
  'store.tab.weapons': ['Armes', 'Weapons', 'Armas', 'Waffen', 'Armas', 'Armi'],
  'store.tab.gear': ['Équipements', 'Equipment', 'Equipamiento', 'Ausrüstung', 'Equipamentos', 'Equipaggiamento'],
  'store.tab.finishes': ['Revêtements', 'Finishes', 'Acabados', 'Lackierungen', 'Acabamentos', 'Finiture'],
  'store.tab.outfits': ['Tenues', 'Outfits', 'Uniformes', 'Outfits', 'Uniformes', 'Divise'],
  'store.tab.sets': ['Ensembles', 'Sets', 'Conjuntos', 'Sets', 'Conjuntos', 'Set'],
  'store.preview': ['Aperçu 3D', '3D preview', 'Vista 3D', '3D-Vorschau', 'Pré-visualização 3D', 'Anteprima 3D'],
  'store.dragHint': ['Glisser pour tourner', 'Drag to rotate', 'Arrastra para girar', 'Zum Drehen ziehen', 'Arraste para rodar', 'Trascina per ruotare'],
  'store.all': ['Tout', 'All', 'Todo', 'Alle', 'Tudo', 'Tutto'],
  'store.fBase': ['Classiques', 'Classics', 'Clásicos', 'Klassiker', 'Clássicos', 'Classici'],
  'store.fMaps': ['Cartes', 'Maps', 'Mapas', 'Karten', 'Mapas', 'Mappe'],
  'store.statusAll': ['Tous', 'Any', 'Todos', 'Alle', 'Todos', 'Tutti'],
  'store.statusBuy': ['Achetables', 'Affordable', 'Comprables', 'Kaufbar', 'Compráveis', 'Acquistabili'],
  'store.statusOwned': ['Possédés', 'Owned', 'En propiedad', 'Im Besitz', 'Possuídos', 'Posseduti'],
  'store.noResult': ['Aucun article pour ce filtre.', 'No item matches this filter.', 'Ningún artículo con este filtro.', 'Kein Artikel für diesen Filter.', 'Nenhum artigo para este filtro.', 'Nessun articolo per questo filtro.'],
  'store.setParts': ['{n} pièces', '{n} pieces', '{n} piezas', '{n} Teile', '{n} peças', '{n} pezzi'],
  'store.equip': ['Équiper', 'Equip', 'Equipar', 'Ausrüsten', 'Equipar', 'Equipaggia'],
  'store.equipped': ['Équipé', 'Equipped', 'Equipado', 'Ausgerüstet', 'Equipado', 'Equipaggiato'],
  'store.owned': ['Possédé', 'Owned', 'En propiedad', 'Im Besitz', 'Possuído', 'Posseduto'],
  'store.applyOn': ['Appliquer', 'Apply', 'Aplicar', 'Anwenden', 'Aplicar', 'Applica'],
  'store.remove': ['Retirer', 'Remove', 'Quitar', 'Entfernen', 'Remover', 'Rimuovi'],
  'store.wear': ['Porter', 'Wear', 'Vestir', 'Tragen', 'Vestir', 'Indossa'],
  'store.equipSet': ['Équiper l’ensemble', 'Equip set', 'Equipar conjunto', 'Set ausrüsten', 'Equipar conjunto', 'Equipaggia set'],
  'store.buy': ['Acheter', 'Buy', 'Comprar', 'Kaufen', 'Comprar', 'Acquista'],
  'store.level': ['Niveau {n}', 'Level {n}', 'Nivel {n}', 'Stufe {n}', 'Nível {n}', 'Livello {n}'],
  'store.lvlShort': ['Niv. {n}', 'Lv. {n}', 'Niv. {n}', 'St. {n}', 'Nív. {n}', 'Liv. {n}'],
  'store.levelReq': ['Niveau {n} requis', 'Level {n} required', 'Requiere nivel {n}', 'Stufe {n} nötig', 'Requer nível {n}', 'Richiede livello {n}'],
  'store.missing': ['Il manque {n} ₡', '{n} ₡ short', 'Faltan {n} ₡', 'Es fehlen {n} ₡', 'Faltam {n} ₡', 'Mancano {n} ₡'],
  'store.free': ['Gratuit', 'Free', 'Gratis', 'Gratis', 'Grátis', 'Gratis'],
  'store.testMark': ['TEST', 'TEST', 'PRUEBA', 'TEST', 'TESTE', 'TEST'],
  'store.testPrice': ['prix réel, gratuit en test', 'real price, free in test', 'precio real, gratis en prueba', 'echter Preis, im Test gratis', 'preço real, grátis em teste', 'prezzo reale, gratis in test'],
  'store.testNote': ['Mode test : tout s’équipe gratuitement, les prix affichés sont les vrais.', 'Test mode: everything equips for free, the prices shown are the real ones.', 'Modo de prueba: todo se equipa gratis, los precios mostrados son los reales.', 'Testmodus: Alles ist gratis ausrüstbar, die angezeigten Preise sind echt.', 'Modo de teste: tudo se equipa grátis, os preços mostrados são os reais.', 'Modalità test: tutto si equipaggia gratis, i prezzi mostrati sono quelli reali.'],
  'store.onWeapon': ['Sur l’arme', 'On weapon', 'En el arma', 'Auf Waffe', 'Na arma', 'Sull’arma'],
  'store.setSaving': ['Vous économisez {n} ₡ par rapport aux pièces séparées.', 'You save {n} ₡ over buying the pieces separately.', 'Ahorras {n} ₡ frente a las piezas por separado.', 'Du sparst {n} ₡ gegenüber Einzelkauf.', 'Poupa {n} ₡ face às peças separadas.', 'Risparmi {n} ₡ rispetto ai pezzi singoli.'],
  'store.bought': ['{item} acheté', '{item} bought', '{item} comprado', '{item} gekauft', '{item} comprado', '{item} acquistato'],
  'store.failed': ['Achat impossible', 'Purchase failed', 'Compra imposible', 'Kauf nicht möglich', 'Compra impossível', 'Acquisto non riuscito'],
  'store.confirmTitle': ['Confirmer l’achat', 'Confirm purchase', 'Confirmar compra', 'Kauf bestätigen', 'Confirmar compra', 'Conferma acquisto'],
  'store.confirm': ['Confirmer', 'Confirm', 'Confirmar', 'Bestätigen', 'Confirmar', 'Conferma'],
  'store.cancel': ['Annuler', 'Cancel', 'Cancelar', 'Abbrechen', 'Cancelar', 'Annulla'],
  'store.balance': ['Solde', 'Balance', 'Saldo', 'Guthaben', 'Saldo', 'Saldo'],
  'store.cost': ['Prix', 'Price', 'Precio', 'Preis', 'Preço', 'Prezzo'],
  'store.after': ['Après achat', 'After purchase', 'Tras la compra', 'Nach dem Kauf', 'Após a compra', 'Dopo l’acquisto'],
  'store.back': ['Retour', 'Back', 'Volver', 'Zurück', 'Voltar', 'Indietro'],
  'store.tab.weekly': ['Cette semaine', 'This week', 'Esta semana', 'Diese Woche', 'Esta semana', 'Questa settimana'],
  'store.weekTitle': ['Sélection de la semaine', 'This week’s selection', 'Selección de la semana', 'Auswahl der Woche', 'Seleção da semana', 'Selezione della settimana'],
  'store.weekNote': ['La même pour tous les joueurs, renouvelée chaque lundi à 0 h.', 'The same for every player, renewed every Monday at midnight.', 'La misma para todos los jugadores, se renueva cada lunes a las 0 h.', 'Für alle Spieler gleich, jeden Montag um 0 Uhr neu.', 'A mesma para todos os jogadores, renovada todas as segundas às 0 h.', 'Uguale per tutti i giocatori, rinnovata ogni lunedì alle 0.'],
  'store.renew': ['Nouvelle sélection dans {d} j {h} h {m} min', 'New selection in {d} d {h} h {m} min', 'Nueva selección en {d} d {h} h {m} min', 'Neue Auswahl in {d} T {h} Std. {m} Min.', 'Nova seleção em {d} d {h} h {m} min', 'Nuova selezione tra {d} g {h} h {m} min'],
  'store.featured': ['À la une', 'Featured', 'Destacado', 'Im Fokus', 'Destaque', 'In evidenza'],
  'store.new': ['Nouveau', 'New', 'Nuevo', 'Neu', 'Novo', 'Nuovo'],
  'store.passItem': ['Passe · palier {n}', 'Pass · tier {n}', 'Pase · nivel {n}', 'Pass · Stufe {n}', 'Passe · nível {n}', 'Pass · livello {n}'],
  'store.passOnly': ['Exclusif au passe de saison : il ne se vend pas.', 'Season pass exclusive: not for sale.', 'Exclusivo del pase de temporada: no se vende.', 'Exklusiv im Saisonpass: nicht käuflich.', 'Exclusivo do passe de temporada: não está à venda.', 'Esclusiva del pass stagionale: non in vendita.'],

  /* Fin de partie en ligne : résultats, vote de carte, partie suivante (match-flow.js) */
  'flow.over': ['Partie terminée', 'Match over', 'Partida terminada', 'Spiel beendet', 'Partida terminada', 'Partita terminata'],
  'flow.board': ['Classement', 'Scoreboard', 'Clasificación', 'Rangliste', 'Classificação', 'Classifica'],
  'flow.player': ['Joueur', 'Player', 'Jugador', 'Spieler', 'Jogador', 'Giocatore'],
  'flow.k': ['É', 'K', 'E', 'K', 'E', 'U'],
  'flow.d': ['M', 'D', 'M', 'T', 'M', 'M'],
  'flow.a': ['A', 'A', 'A', 'A', 'A', 'A'],
  'flow.kills': ['Éliminations', 'Kills', 'Eliminaciones', 'Eliminierungen', 'Eliminações', 'Uccisioni'],
  'flow.deaths': ['Morts', 'Deaths', 'Muertes', 'Tode', 'Mortes', 'Morti'],
  'flow.assists': ['Assistances', 'Assists', 'Asistencias', 'Assists', 'Assistências', 'Assist'],
  'flow.score': ['Score', 'Score', 'Puntos', 'Punkte', 'Pontos', 'Punti'],
  'flow.rewards': ['Récompenses', 'Rewards', 'Recompensas', 'Belohnungen', 'Recompensas', 'Ricompense'],
  'flow.xp': ['Expérience', 'Experience', 'Experiencia', 'Erfahrung', 'Experiência', 'Esperienza'],
  'flow.level': ['Niveau {n}', 'Level {n}', 'Nivel {n}', 'Level {n}', 'Nível {n}', 'Livello {n}'],
  'flow.levelUp': ['Niveau supérieur', 'Level up', 'Subes de nivel', 'Levelaufstieg', 'Subiste de nível', 'Livello superiore'],
  'flow.clockResults': ['Vote dans', 'Vote in', 'Voto en', 'Wahl in', 'Voto em', 'Voto tra'],
  'flow.clockVote': ['Fin du vote', 'Vote ends', 'Fin del voto', 'Wahl endet', 'Fim do voto', 'Fine del voto'],
  'flow.clockWinner': ['Lancement', 'Starting', 'Inicio', 'Start', 'Início', 'Avvio'],
  'flow.nextVote': ['Le vote de la prochaine carte arrive', 'The vote for the next map is coming', 'Llega la votación del próximo mapa', 'Gleich wird die nächste Karte gewählt', 'A votação do próximo mapa vem aí', 'Sta per iniziare il voto della prossima mappa'],
  'flow.voteTitle': ['Votez pour la prochaine carte', 'Vote for the next map', 'Vota el próximo mapa', 'Wähle die nächste Karte', 'Vota no próximo mapa', 'Vota la prossima mappa'],
  'flow.voteHint': ['Vous pouvez changer de vote jusqu’à la fin', 'You can change your vote until the end', 'Puedes cambiar tu voto hasta el final', 'Du kannst deine Wahl bis zum Ende ändern', 'Podes mudar o voto até ao fim', 'Puoi cambiare voto fino alla fine'],
  'flow.voted': ['{n} sur {m} ont voté', '{n} of {m} voted', '{n} de {m} han votado', '{n} von {m} haben gewählt', '{n} de {m} votaram', '{n} su {m} hanno votato'],
  'flow.votes': ['Votes', 'Votes', 'Votos', 'Stimmen', 'Votos', 'Voti'],
  'flow.mine': ['Votre vote', 'Your vote', 'Tu voto', 'Deine Wahl', 'O teu voto', 'Il tuo voto'],
  'flow.random': ['Aléatoire', 'Random', 'Aleatorio', 'Zufall', 'Aleatório', 'Casuale'],
  'flow.randomHint': ['Une carte au hasard', 'A map at random', 'Un mapa al azar', 'Eine zufällige Karte', 'Um mapa ao acaso', 'Una mappa a caso'],
  'flow.next': ['Prochaine carte', 'Next map', 'Próximo mapa', 'Nächste Karte', 'Próximo mapa', 'Prossima mappa'],
  'flow.howVotes': ['Choisie par les joueurs', 'Chosen by the players', 'Elegido por los jugadores', 'Von den Spielern gewählt', 'Escolhido pelos jogadores', 'Scelta dai giocatori'],
  'flow.howTie': ['Égalité : tirage au sort', 'Tie: drawn at random', 'Empate: sorteo', 'Gleichstand: ausgelost', 'Empate: sorteio', 'Pareggio: sorteggio'],
  'flow.howNone': ['Aucun vote : tirage au sort', 'No votes: drawn at random', 'Sin votos: sorteo', 'Keine Stimmen: ausgelost', 'Sem votos: sorteio', 'Nessun voto: sorteggio'],
  'flow.howRandom': ['Le hasard a choisi', 'Picked at random', 'Elegido al azar', 'Zufällig gewählt', 'Escolhido ao acaso', 'Scelta a caso'],
  'flow.starting': ['La partie suivante se prépare', 'The next match is getting ready', 'La próxima partida se prepara', 'Das nächste Spiel wird vorbereitet', 'A próxima partida está a preparar-se', 'La prossima partita si sta preparando'],
  'flow.backLobby': ['Retour au salon', 'Back to lobby', 'Volver a la sala', 'Zurück zur Lobby', 'Voltar à sala', 'Torna alla lobby'],
  'flow.leave': ['Quitter le salon', 'Leave the lobby', 'Salir de la sala', 'Lobby verlassen', 'Sair da sala', 'Esci dalla lobby'],
  'flow.msgHost': ['L’hôte a ramené tout le monde au salon.', 'The host brought everyone back to the lobby.', 'El anfitrión ha devuelto a todos a la sala.', 'Der Host hat alle zur Lobby zurückgebracht.', 'O anfitrião trouxe todos de volta à sala.', 'L’host ha riportato tutti nella lobby.'],
  'flow.msgPlayers': ['Pas assez de joueurs : retour au salon.', 'Not enough players: back to the lobby.', 'No hay suficientes jugadores: vuelta a la sala.', 'Zu wenige Spieler: zurück zur Lobby.', 'Jogadores insuficientes: de volta à sala.', 'Giocatori insufficienti: ritorno alla lobby.'],
  'flow.msgCompat': ['Un joueur avec une ancienne version a rejoint : retour au salon.', 'A player on an older version joined: back to the lobby.', 'Se ha unido un jugador con una versión antigua: vuelta a la sala.', 'Ein Spieler mit älterer Version ist beigetreten: zurück zur Lobby.', 'Entrou um jogador com uma versão antiga: de volta à sala.', 'È entrato un giocatore con una versione vecchia: ritorno alla lobby.'],
  'flow.msgError': ['Retour au salon après une erreur.', 'Back to the lobby after an error.', 'Vuelta a la sala tras un error.', 'Nach einem Fehler zurück zur Lobby.', 'De volta à sala após um erro.', 'Ritorno alla lobby dopo un errore.'],
};

for (const id of Object.keys(EXTRA_TYPES)) TABLE['weaponType.' + id] = EXTRA_TYPES[id];       // second-wave weapons
export const DICTS = Object.freeze(Object.fromEntries(LANGS.map((code, i) => {
  const dict = Object.create(null);
  for (const key of Object.keys(TABLE)) dict[key] = TABLE[key][i];
  return [code, dict];
})));

const has = (lang, key) => typeof key === 'string' && DICTS[lang] && typeof DICTS[lang][key] === 'string';

function format(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) return m;
    const v = params[name];
    return v === undefined || v === null ? '' : String(v);
  });
}

export function createI18n(settings) {
  if (settings && settings.i18n) return settings.i18n;
  const listeners = new Set();
  const valid = code => LANGS.includes(code);
  let current = FALLBACK_LANG;
  try {
    const stored = settings && settings.get && settings.get('language');
    if (valid(stored)) current = stored;
  } catch { /* repli sur le français */ }

  const syncDocument = () => {
    try { if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = current; } catch { /* sans DOM */ }
  };

  const change = code => {
    if (code === current) return;
    current = code;
    syncDocument();
    for (const fn of [...listeners]) {
      try { fn(current); } catch (err) { console.error('[i18n] listener', err); }
    }
  };

  function t(key, params) {
    const text = has(current, key) ? DICTS[current][key]
      : has(FALLBACK_LANG, key) ? DICTS[FALLBACK_LANG][key]
      : (key === undefined || key === null ? '' : String(key));
    return format(text, params);
  }

  function translateEl(el) {
    const key = el.getAttribute('data-i18n');
    let params;
    const rawParams = el.getAttribute('data-i18n-params');
    if (rawParams) { try { params = JSON.parse(rawParams); } catch { params = undefined; } }
    if (key) el.textContent = t(key, params);
    const attrs = el.getAttribute('data-i18n-attr');
    if (attrs) {
      for (const pair of attrs.split(';')) {
        const idx = pair.indexOf(':');
        if (idx < 1) continue;
        const name = pair.slice(0, idx).trim();
        const attrKey = pair.slice(idx + 1).trim();
        if (name && attrKey) el.setAttribute(name, t(attrKey, params));
      }
    }
  }

  function apply(rootEl) {
    const root = rootEl || (typeof document !== 'undefined' ? document.documentElement : null);
    if (!root) return;
    if (root.getAttribute && (root.getAttribute('data-i18n') || root.getAttribute('data-i18n-attr'))) translateEl(root);
    if (root.querySelectorAll) root.querySelectorAll('[data-i18n],[data-i18n-attr]').forEach(translateEl);
  }

  const api = {
    t,
    get lang() { return current; },
    setLang(code) {
      if (!valid(code)) return false;
      if (settings && settings.set) settings.set('language', code);
      change(code);
      return true;
    },
    apply,
    on(event, fn) {
      if (event !== 'change' || typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  if (settings && settings.on) settings.on('change', (path, value) => { if (path === 'language' && valid(value)) change(value); });
  if (settings) { try { settings.i18n = api; } catch { /* objet gelé */ } }
  syncDocument();
  return api;
}
