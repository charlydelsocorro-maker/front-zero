// FRONT ZÉRO — static game data shared by every module. Display names are French defaults; prefer i18n keys when they exist.
// Every weapon is an original fictional design (archetypes only, no real brand or model name).
import { EXTRA_WEAPONS, EXTRA_LEVELS, EXTRA_LIVE } from './weapons-extra.js';
//
// Weapon fields
//  slot   0 primary, 1 secondary, 2 gear (thrown, own key)
//  cat    assault | smg | shotgun | lmg | sniper | launcher | special | pistol | melee | gear
//  kind   hitscan (default) | projectile | melee | thrown
//  dmg    per pellet / per hit; for explosives it is the damage at the centre of the blast
//  rpm, mag, reload (s), spread (rad), pellets, range (m, damage falls off after it), auto, mob (speed factor),
//  len (model length, m), rec (recoil, rad), hs (headshot multiplier), col (base colour), fov (ADS fov), scope
//  burst / burstGap   rounds per trigger pull and pause between bursts (s)
//  spin               spin-up time before the first round (s)
//  reserve            spare rounds per life beyond the magazine (undefined = unlimited)
//  proj               {speed m/s, gravity m/s², radius m (blast), fuse s, bounce 0..1, self (self-damage factor)}
//  silent             no loud report (bots do not hear it)
export const ALL_WEAPONS=[
 // ---- secondaries
 {id:'p9',name:'Sentinelle P9',type:'Pistolet',cat:'pistol',slot:1,price:0,dmg:26,rpm:380,mag:14,reload:1.1,spread:.012,pellets:1,range:32,auto:false,mob:1.06,len:.24,rec:.012,hs:1.7,col:0x2b2c2a,fov:62},
 {id:'hp',name:'Colosse H-50',type:'Pistolet lourd',cat:'pistol',slot:1,price:900,dmg:48,rpm:220,mag:7,reload:1.5,spread:.014,pellets:1,range:38,auto:false,mob:1.03,len:.3,rec:.04,hs:1.8,col:0x8a8f93,fov:60},
 {id:'rev',name:'Verdict .44',type:'Revolver',cat:'pistol',slot:1,price:700,dmg:62,rpm:150,mag:6,reload:2.2,spread:.01,pellets:1,range:42,auto:false,mob:1.04,len:.31,rec:.05,hs:1.9,col:0x3a3c40,fov:58},
 {id:'mp',name:'Guêpe MP-3',type:'Pistolet-mitrailleur',cat:'pistol',slot:1,price:800,dmg:16,rpm:950,mag:20,reload:1.3,spread:.03,pellets:1,range:18,auto:true,mob:1.08,len:.27,rec:.008,hs:1.4,col:0x202224,fov:64},
 {id:'knife',name:'Lame K-1',type:'Couteau',cat:'melee',kind:'melee',slot:1,price:300,dmg:75,rpm:110,mag:1,reload:0,spread:0,pellets:1,range:2.1,auto:false,mob:1.16,len:.28,rec:0,hs:1,col:0x9aa0a4,fov:70,silent:true},
 // ---- assault rifles
 {id:'ar',name:'Faucon AR-7',type:'Fusil d’assaut',cat:'assault',slot:0,price:0,dmg:24,rpm:640,mag:30,reload:1.7,spread:.018,pellets:1,range:48,auto:true,mob:1,len:.62,rec:.009,hs:1.6,col:0x353a2c,fov:58},
 {id:'car',name:'Lynx MK-4',type:'Carabine',cat:'assault',slot:0,price:1100,dmg:22,rpm:780,mag:30,reload:1.5,spread:.016,pellets:1,range:44,auto:true,mob:1.04,len:.56,rec:.008,hs:1.6,col:0x2a2b2d,fov:56},
 {id:'akr',name:'Kodiak R-47',type:'Fusil d’assaut lourd',cat:'assault',slot:0,price:1300,dmg:31,rpm:560,mag:30,reload:1.9,spread:.022,pellets:1,range:46,auto:true,mob:.97,len:.64,rec:.014,hs:1.6,col:0x5a3c22,fov:58},
 {id:'brst',name:'Trident B3',type:'Fusil à rafales',cat:'assault',slot:0,price:1500,dmg:28,rpm:900,mag:30,reload:1.8,spread:.012,pellets:1,range:55,auto:false,burst:3,burstGap:.24,mob:1,len:.6,rec:.007,hs:1.7,col:0x3d4148,fov:50},
 {id:'bat',name:'Sentence BR-8',type:'Fusil de combat',cat:'assault',slot:0,price:1900,dmg:44,rpm:420,mag:20,reload:2.1,spread:.014,pellets:1,range:70,auto:true,mob:.94,len:.7,rec:.02,hs:1.7,col:0x4b4636,fov:48},
 // ---- submachine guns
 {id:'smg',name:'Vipère K-4',type:'Mitraillette',cat:'smg',slot:0,price:900,dmg:17,rpm:900,mag:36,reload:1.4,spread:.026,pellets:1,range:24,auto:true,mob:1.1,len:.42,rec:.006,hs:1.4,col:0x25272a,fov:64},
 {id:'pdw',name:'Frelon M-9',type:'Mitraillette compacte',cat:'smg',slot:0,price:1200,dmg:15,rpm:1080,mag:40,reload:1.5,spread:.03,pellets:1,range:20,auto:true,mob:1.12,len:.38,rec:.005,hs:1.4,col:0x33363a,fov:64},
 {id:'hsmg',name:'Mastiff 45',type:'Mitraillette lourde',cat:'smg',slot:0,price:1000,dmg:24,rpm:620,mag:25,reload:1.6,spread:.022,pellets:1,range:28,auto:true,mob:1.07,len:.46,rec:.009,hs:1.5,col:0x3b3a34,fov:62},
 // ---- shotguns
 {id:'sg',name:'Marteau 12',type:'Fusil à pompe',cat:'shotgun',slot:0,price:1400,dmg:14,rpm:95,mag:6,reload:2.2,spread:.075,pellets:9,range:15,auto:false,mob:1.02,len:.66,rec:.05,hs:1.3,col:0x4a3524,fov:62},
 {id:'asg',name:'Ouragan A-12',type:'Fusil automatique',cat:'shotgun',slot:0,price:2000,dmg:11,rpm:300,mag:8,reload:2.6,spread:.09,pellets:8,range:13,auto:true,mob:.98,len:.64,rec:.035,hs:1.3,col:0x26282a,fov:62},
 {id:'dbs',name:'Jumelle 2C',type:'Fusil double',cat:'shotgun',slot:0,price:800,dmg:17,rpm:220,mag:2,reload:1.9,spread:.1,pellets:10,range:11,auto:false,mob:1.05,len:.58,rec:.07,hs:1.3,col:0x6a4424,fov:64},
 // ---- machine guns
 {id:'lmg',name:'Titan M-60R',type:'Mitrailleuse',cat:'lmg',slot:0,price:2200,dmg:27,rpm:620,mag:75,reload:3.2,spread:.03,pellets:1,range:52,auto:true,mob:.84,len:.8,rec:.011,hs:1.5,col:0x2f3327,fov:56},
 {id:'mini',name:'Cyclone G-6',type:'Mitrailleuse rotative',cat:'lmg',slot:0,price:4000,dmg:16,rpm:1500,mag:200,reload:4.6,spread:.04,pellets:1,range:40,auto:true,spin:.6,mob:.72,len:.86,rec:.004,hs:1.3,col:0x3a3d40,fov:66},
 // ---- precision
 {id:'dmr',name:'Éclair DM-9',type:'Fusil de tireur',cat:'sniper',slot:0,price:2300,dmg:58,rpm:260,mag:12,reload:2,spread:.006,pellets:1,range:95,auto:false,mob:.95,len:.82,rec:.03,hs:1.9,col:0x3f4435,fov:34},
 {id:'sr',name:'Longue-Vue L3',type:'Précision',cat:'sniper',slot:0,price:3000,dmg:200,rpm:48,mag:5,reload:2.6,spread:.05,pellets:1,range:120,auto:false,mob:.92,len:.95,rec:.06,hs:2,col:0x3b3f30,fov:18,scope:true},
 {id:'hsr',name:'Goliath .50',type:'Précision lourde',cat:'sniper',slot:0,price:4200,dmg:320,rpm:30,mag:4,reload:3.4,spread:.07,pellets:1,range:160,auto:false,mob:.82,len:1.2,rec:.1,hs:2,col:0x2c2e2b,fov:14,scope:true},
 // ---- launchers and special
 {id:'rl',name:'Bélier RL-4',type:'Lance-roquettes',cat:'launcher',kind:'projectile',slot:0,price:3800,dmg:140,rpm:40,mag:1,reserve:4,reload:2.8,spread:.004,pellets:1,range:200,auto:false,mob:.86,len:1.05,rec:.09,hs:1,col:0x414833,fov:50,proj:{speed:46,gravity:0,radius:5.5,fuse:6,bounce:0,self:.6,flight:{eject:22,ign:.12,burn:.7,thrust:100,drag:.0052,boostG:.05,ramp:.35,g:9.81,inherit:.5,wobble:.012}}},
 {id:'gl',name:'Mortier GL-6',type:'Lance-grenades',cat:'launcher',kind:'projectile',slot:0,price:3200,dmg:95,rpm:110,mag:6,reserve:12,reload:3.2,spread:.01,pellets:1,range:120,auto:false,mob:.9,len:.7,rec:.05,hs:1,col:0x3a3f34,fov:58,proj:{speed:30,gravity:14,radius:4.2,fuse:2.2,bounce:.35,self:.6}},
 {id:'xbow',name:'Silence X-1',type:'Arbalète',cat:'special',kind:'projectile',slot:0,price:1700,dmg:95,rpm:38,mag:1,reload:1.6,spread:.002,pellets:1,range:140,auto:false,mob:1,len:.74,rec:.02,hs:2,col:0x2b2f26,fov:36,silent:true,proj:{speed:90,gravity:5,radius:0,fuse:8,bounce:0,self:0}},
 // ---- gear
 {id:'frag',name:'Grenade F-1',type:'Grenade',cat:'gear',kind:'thrown',slot:2,price:0,dmg:120,rpm:45,mag:1,reserve:1,reload:.9,spread:0,pellets:1,range:40,auto:false,mob:1,len:.1,rec:0,hs:1,col:0x3e4a30,fov:70,proj:{speed:19,gravity:16,radius:5,fuse:2.6,bounce:.4,self:1}},
 // ---- second wave (weapons-extra.js)
 ...EXTRA_WEAPONS,
];
// Player level required to BUY each weapon (credits still pay for it). Attachments have their own level in attachments.js.
// Together they give a reward at every level from 2 to 26. Enforced as soon as TEST_UNLOCK_ALL below is false.
export const WEAPON_LEVELS={ar:1,p9:1,frag:1,knife:2,smg:3,rev:5,mp:6,dbs:7,hp:8,hsmg:9,car:10,pdw:11,akr:12,sg:13,brst:14,xbow:15,bat:16,asg:17,lmg:18,dmr:19,sr:21,gl:22,rl:24,mini:25,hsr:26,...EXTRA_LEVELS};
// ARSENAL GATE (temporary): players are live while the new weapons are being built, so the browser only sees the six
// finished weapons unless the page URL has ?arsenal=1. Node (server, tests) always sees the full list.
// The orchestrator removes this gate once every weapon in ALL_WEAPONS works end to end.
// 23/11: the 19 new weapons passed the validation run and were added here one by one.
const LIVE_IDS=new Set(['p9','ar','smg','sg','lmg','sr',
 'hp','rev','mp','knife','car','akr','brst','bat','pdw','hsmg','asg','dbs','mini','dmr','hsr','rl','gl','xbow','frag',...EXTRA_LIVE]);
export const ARSENAL_PREVIEW=typeof location==='undefined'||/[?&]arsenal=1(&|$)/.test(location.search);
export const WEAPONS=ARSENAL_PREVIEW?ALL_WEAPONS:ALL_WEAPONS.filter(w=>LIVE_IDS.has(w.id));
// TEST MODE (temporary, asked by the players while they test): every weapon and outfit counts as owned.
// Purchases already made stay saved; set to false to go back to the normal shop.
export const TEST_UNLOCK_ALL=true;
export const WEAPON_CATS=[
 {id:'assault',name:'Fusils d’assaut'},{id:'smg',name:'Mitraillettes'},{id:'shotgun',name:'Fusils à pompe'},{id:'lmg',name:'Mitrailleuses'},
 {id:'sniper',name:'Précision'},{id:'launcher',name:'Lanceurs'},{id:'special',name:'Spécial'},{id:'pistol',name:'Armes de poing'},{id:'melee',name:'Corps à corps'},{id:'gear',name:'Équipement'},
];
export const OUTFITS=[
 {id:'desert',name:'Sable',r:'Standard',price:0,c:[0xb9a678,0x8e7a51,0x6b5a3a]},
 {id:'foret',name:'Forêt',r:'Standard',price:350,c:[0x59633e,0x3a4429,0x7b7650]},
 {id:'urbain',name:'Urbain',r:'Spécial',price:700,c:[0x74777a,0x45484b,0xa1a3a3]},
 {id:'arctique',name:'Arctique',r:'Spécial',price:1100,c:[0xdfe3e2,0xa9b3b6,0x737d80]},
 {id:'nuit',name:'Opération Nuit',r:'Élite',price:1800,c:[0x1c2026,0x2e3540,0x11141a]},
 {id:'braise',name:'Braise',r:'Légende',price:3500,c:[0x2a211c,0xb5441f,0xe8a628]},
];
export const CLASSES=[
 {id:'assaut',name:'Assaut',d:'Polyvalent. Commence avec plus de blindage.',hp:100,armor:60,spd:1},
 {id:'eclaireur',name:'Éclaireur',d:'Le plus rapide du front, glissades plus longues.',hp:90,armor:15,spd:1.14},
 {id:'lourd',name:'Lourd',d:'Encaisse énormément, mais se déplace moins vite.',hp:130,armor:70,spd:.88},
 {id:'medic',name:'Médic',d:'Sa santé remonte plus tôt et bien plus vite.',hp:100,armor:30,spd:1.03,regen:2.5},
];
export const RANKS=['Recrue','Soldat','Caporal','Sergent','Adjudant','Lieutenant','Capitaine','Commandant','Colonel','Général'];
// Mode ids match server/server.js. solo = playable offline with bots, online = playable through the server.
export const MODES=[
 {id:'ffa',teams:false,solo:true,online:true,name:'Match à mort',desc:'Chacun pour soi. Le premier à 20 éliminations gagne.'},
 {id:'tdm',teams:true,solo:true,online:true,name:'Équipes',desc:'Deux équipes. La première à 40 éliminations gagne.'},
 {id:'dom',teams:true,solo:true,online:true,name:'Domination',desc:'Capturez et tenez trois zones pour marquer des points.'},
 {id:'bomb',teams:true,solo:true,online:true,name:'Bombe',desc:'Les attaquants posent la bombe, les défenseurs la désamorcent. Pas de réapparition pendant la manche.'},
 {id:'zombie',teams:false,coop:true,solo:true,online:true,name:'Zombies',desc:'Survivez à des vagues de plus en plus dures.'},
 {id:'zone',teams:false,solo:true,online:true,name:'Zone',desc:'Une arme de poing, des caisses à fouiller, une zone qui se referme. Le dernier en vie gagne.'},
];
export const byId=(list,id)=>list.find(x=>x.id===id);
