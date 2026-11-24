// FRONT ZÉRO — player profile (credits, xp, owned and equipped items, attachments), persisted in localStorage key 'frontzero'.
// Loadout: data.primary (slot 0), data.secondary (slot 1), data.gear (slot 2). Free items (price 0) are always owned.
// Progression: the player level (1 per 1000 XP) unlocks attachments and the right to buy each weapon. TEST_UNLOCK_ALL (data.js) lifts every lock.
import {WEAPONS,OUTFITS,CLASSES,RANKS,TEST_UNLOCK_ALL,WEAPON_LEVELS} from './data.js';
import {sanitize,applyAttachments,attUnlocked,rewardsAt,nextReward,levelOfXp,ATTACHMENTS} from './attachments.js';
import './gear-data.js';
import {cleanCos} from './cosmetics.js';
import {attachLedger} from './shop-ledger.js';
const GX=globalThis.FZGearData;
const KEY='frontzero',DEF={cr:500,xp:0,weapons:['ar','p9','frag'],outfits:['desert'],primary:'ar',secondary:'p9',gear:'frag',outfit:'desert',cls:'assaut',name:''};
const LISTS={weapon:WEAPONS,outfit:OUTFITS,class:CLASSES};
const SLOT_KEY=['primary','secondary','gear'],SLOT_DEF=['ar','p9','frag'];
const isMap=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
export function createProfile(){
 const subs=new Set();let d={...DEF};
 try{const raw=JSON.parse(localStorage.getItem(KEY)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))d={...DEF,...raw}}catch{}
 const has=(list,id)=>list.some(x=>x.id===id),arr=a=>Array.isArray(a)?a:[];
 d.cr=Math.max(0,Math.floor(+d.cr||0));d.xp=Math.max(0,Math.floor(+d.xp||0));
 d.weapons=[...new Set([...arr(d.weapons).filter(i=>has(WEAPONS,i)),...WEAPONS.filter(w=>w.price===0).map(w=>w.id)])];
 d.outfits=[...new Set([...arr(d.outfits).filter(i=>has(OUTFITS,i)),...OUTFITS.filter(o=>o.price===0).map(o=>o.id)])];
 // Saves older than the attachments have none of these fields; everything else in the save is left as it is.
 {const a={};if(isMap(d.att))for(const id of Object.keys(d.att)){if(!has(WEAPONS,id))continue;const l=sanitize(id,d.att[id]);if(l.length)a[id]=l}d.att=a;
  const m={};if(isMap(d.wstats))for(const id of Object.keys(d.wstats)){if(!has(WEAPONS,id)||!isMap(d.wstats[id]))continue;const s=d.wstats[id];m[id]={xp:Math.max(0,Math.floor(+s.xp||0)),kills:Math.max(0,Math.floor(+s.kills||0)),heads:Math.max(0,Math.floor(+s.heads||0)),wins:Math.max(0,Math.floor(+s.wins||0))}}d.wstats=m;
  // An old save does not replay the rewards of levels it already had.
  const lv=levelOfXp(d.xp);d.seenLevel=Number.isInteger(d.seenLevel)&&d.seenLevel>=1&&d.seenLevel<=lv?d.seenLevel:lv}
 // What the player really bought is kept apart, so the test unlock never ends up in the save.
 const real={weapons:d.weapons.slice(),outfits:d.outfits.slice()};
 if(TEST_UNLOCK_ALL){d.weapons=WEAPONS.map(w=>w.id);d.outfits=OUTFITS.map(o=>o.id)}
 SLOT_KEY.forEach((k,slot)=>{const w=WEAPONS.find(x=>x.id===d[k]);if(!w||w.slot!==slot||!d.weapons.includes(d[k]))d[k]=SLOT_DEF[slot]});
 // Equipment slots. An old save has none: the frag stays the lethal item, the free tactical and medical items fill the other two.
 d.gx=GX.cleanLoadout(d.gx);d.gxOwned=[...new Set(arr(d.gxOwned).filter(i=>GX.isLive(i)))];
 d.cos=cleanCos(d.cos);       // shop: finishes, special outfits, equipped finish per weapon. An old save simply starts with none.
 if(!d.outfits.includes(d.outfit))d.outfit='desert';if(!has(CLASSES,d.cls))d.cls='assaut';
 const clean=n=>String(n||'').replace(/[<>&"'`]/g,'').slice(0,16);d.name=clean(d.name);
 const emit=()=>subs.forEach(f=>{try{f(d)}catch{}});
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(TEST_UNLOCK_ALL?{...d,weapons:real.weapons,outfits:real.outfits}:d))}catch{}emit()};
 const owned=type=>type==='weapon'?d.weapons:type==='outfit'?d.outfits:null;
 const lvl=()=>levelOfXp(d.xp);
 const p={
  data:d,save,
  get level(){return lvl()},
  get rank(){return RANKS[Math.min(this.level-1,RANKS.length-1)]},
  /** type: 'weapon' | 'outfit' | 'class' */
  owns(type,id){return type==='class'?has(CLASSES,id):!!owned(type)?.includes(id)},
  /** Level needed to buy a weapon. */
  weaponLevel(id){return WEAPON_LEVELS[id]||1},
  levelOk(type,id){return type!=='weapon'||TEST_UNLOCK_ALL||lvl()>=(WEAPON_LEVELS[id]||1)},
  canBuy(type,id){const it=LISTS[type]?.find(x=>x.id===id);return !!it&&type!=='class'&&!p.owns(type,id)&&d.cr>=it.price&&p.levelOk(type,id)},
  buy(type,id){p.sync();if(!p.canBuy(type,id))return false;d.cr-=LISTS[type].find(x=>x.id===id).price;owned(type).push(id);if(TEST_UNLOCK_ALL&&real[type+'s']&&!real[type+'s'].includes(id))real[type+'s'].push(id);save();return true},
  /** Equipping a weapon puts it in the slot it belongs to (primary, secondary or gear). */
  equip(type,id){if(!p.owns(type,id))return false;if(type==='weapon'){const w=WEAPONS.find(x=>x.id===id);if(!w||!SLOT_KEY[w.slot])return false;d[SLOT_KEY[w.slot]]=id}else if(type==='outfit'){d.outfit=id;d.cos.outfit=null}else d.cls=id;save();return true},
  /** true when the item is the one currently equipped in its slot */
  equipped(type,id){if(type==='weapon')return d.primary===id||d.secondary===id||d.gear===id;return type==='outfit'?d.outfit===id:d.cls===id},
  award(cr,xp){p.sync();d.cr+=Math.max(0,Math.floor(cr||0));d.xp+=Math.max(0,Math.floor(xp||0));save()},
  setName(n){d.name=clean(n);save()},
  /* ---------- equipment slots (gear-data.js) ---------- */
  gxOwns(id){const it=GX.ITEMS[id];return !!it&&GX.isLive(id)&&(TEST_UNLOCK_ALL||it.price===0||d.gxOwned.includes(id))},
  gxLevelOk(id){const it=GX.ITEMS[id];return !!it&&(TEST_UNLOCK_ALL||lvl()>=it.level)},
  gxBuy(id){p.sync();const it=GX.ITEMS[id];if(!it||!GX.isLive(id)||p.gxOwns(id)||!p.gxLevelOk(id)||d.cr<it.price)return false;d.cr-=it.price;d.gxOwned.push(id);save();return true},
  gxEquip(id){const it=GX.ITEMS[id];if(!it||!p.gxOwns(id))return false;d.gx[it.slot]=id;save();return true},
  /* ---------- attachments ---------- */
  attUnlocked(id){return attUnlocked(id,lvl())},
  /** What is mounted on this weapon and usable at the current level (a locked item stays in the save, it just does not apply). */
  attOf(wid){const l=d.att[wid];return l?l.filter(i=>attUnlocked(i,lvl())):[]},
  /** The weapon definition with this player's attachments applied. */
  armed(def){return def?applyAttachments(def,p.attOf(def.id)):def},
  /** Mounts an attachment (replaces the one in its slot), or empties a slot with id = null. */
  setAtt(wid,slot,id){
   if(id!==null&&(!ATTACHMENTS[id]||ATTACHMENTS[id].slot!==slot||!attUnlocked(id,lvl())))return false;
   const cur=(d.att[wid]||[]).filter(i=>ATTACHMENTS[i].slot!==slot),next=sanitize(wid,id?[...cur,id]:cur);
   if(id&&!next.includes(id))return false;
   if(next.length)d.att[wid]=next;else delete d.att[wid];save();return true},
  /* ---------- per-weapon record (secondary track, unlocks nothing) ---------- */
  weaponStat(wid){return d.wstats[wid]||{xp:0,kills:0,heads:0,wins:0}},
  mastery(wid){return Math.floor(p.weaponStat(wid).xp/500)+1},
  /** Kills, headshots and wins of a match, in one save. */
  creditWeapons(map,winId){let any=false;for(const id of Object.keys(map||{})){if(!has(WEAPONS,id))continue;const m=map[id],s=d.wstats[id]||(d.wstats[id]={xp:0,kills:0,heads:0,wins:0}),k=Math.max(0,m.kills|0),h=Math.max(0,m.heads|0);s.kills+=k;s.heads+=h;s.xp+=k*50+h*25;any=true}
   if(winId&&has(WEAPONS,winId)){const s=d.wstats[winId]||(d.wstats[winId]={xp:0,kills:0,heads:0,wins:0});s.wins++;s.xp+=150;any=true}if(any)save()},
  /* ---------- level rewards ---------- */
  nextReward(){return nextReward(lvl())},
  /** Rewards of the levels reached since they were last shown: [{level, rewards}], oldest first. Marks them as seen. */
  takeRewards(){const now=lvl(),out=[];for(let l=d.seenLevel+1;l<=now;l++){const r=rewardsAt(l);if(r.length)out.push({level:l,rewards:r})}if(d.seenLevel!==now){d.seenLevel=now;save()}return out},
  /** subscribe to changes; returns an unsubscribe function */
  on(fn){subs.add(fn);return()=>subs.delete(fn)},
 };
 attachLedger(p,{key:KEY,data:d,real,save,emit,level:lvl,gear:()=>GX,extraOutfits:()=>globalThis.FZOutfitSets||[]});
 return p;
}
