// FRONT ZÉRO — player profile (credits, xp, owned and equipped items), persisted in localStorage key 'frontzero'.
// Loadout: data.primary (slot 0), data.secondary (slot 1), data.gear (slot 2). Free items (price 0) are always owned.
import {WEAPONS,OUTFITS,CLASSES,RANKS,TEST_UNLOCK_ALL} from './data.js';
const KEY='frontzero',DEF={cr:500,xp:0,weapons:['ar','p9','frag'],outfits:['desert'],primary:'ar',secondary:'p9',gear:'frag',outfit:'desert',cls:'assaut',name:''};
const LISTS={weapon:WEAPONS,outfit:OUTFITS,class:CLASSES};
const SLOT_KEY=['primary','secondary','gear'],SLOT_DEF=['ar','p9','frag'];
export function createProfile(){
 const subs=new Set();let d={...DEF};
 try{const raw=JSON.parse(localStorage.getItem(KEY)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))d={...DEF,...raw}}catch{}
 const has=(list,id)=>list.some(x=>x.id===id),arr=a=>Array.isArray(a)?a:[];
 d.cr=Math.max(0,Math.floor(+d.cr||0));d.xp=Math.max(0,Math.floor(+d.xp||0));
 d.weapons=[...new Set([...arr(d.weapons).filter(i=>has(WEAPONS,i)),...WEAPONS.filter(w=>w.price===0).map(w=>w.id)])];
 d.outfits=[...new Set([...arr(d.outfits).filter(i=>has(OUTFITS,i)),...OUTFITS.filter(o=>o.price===0).map(o=>o.id)])];
 // What the player really bought is kept apart, so the test unlock never ends up in the save.
 const real={weapons:d.weapons.slice(),outfits:d.outfits.slice()};
 if(TEST_UNLOCK_ALL){d.weapons=WEAPONS.map(w=>w.id);d.outfits=OUTFITS.map(o=>o.id)}
 SLOT_KEY.forEach((k,slot)=>{const w=WEAPONS.find(x=>x.id===d[k]);if(!w||w.slot!==slot||!d.weapons.includes(d[k]))d[k]=SLOT_DEF[slot]});
 if(!d.outfits.includes(d.outfit))d.outfit='desert';if(!has(CLASSES,d.cls))d.cls='assaut';
 const clean=n=>String(n||'').replace(/[<>&"'`]/g,'').slice(0,16);d.name=clean(d.name);
 const emit=()=>subs.forEach(f=>{try{f(d)}catch{}});
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(TEST_UNLOCK_ALL?{...d,weapons:real.weapons,outfits:real.outfits}:d))}catch{}emit()};
 const owned=type=>type==='weapon'?d.weapons:type==='outfit'?d.outfits:null;
 const p={
  data:d,save,
  get level(){return Math.floor(d.xp/1000)+1},
  get rank(){return RANKS[Math.min(this.level-1,RANKS.length-1)]},
  /** type: 'weapon' | 'outfit' | 'class' */
  owns(type,id){return type==='class'?has(CLASSES,id):!!owned(type)?.includes(id)},
  canBuy(type,id){const it=LISTS[type]?.find(x=>x.id===id);return !!it&&type!=='class'&&!p.owns(type,id)&&d.cr>=it.price},
  buy(type,id){if(!p.canBuy(type,id))return false;d.cr-=LISTS[type].find(x=>x.id===id).price;owned(type).push(id);save();return true},
  /** Equipping a weapon puts it in the slot it belongs to (primary, secondary or gear). */
  equip(type,id){if(!p.owns(type,id))return false;if(type==='weapon'){const w=WEAPONS.find(x=>x.id===id);if(!w||!SLOT_KEY[w.slot])return false;d[SLOT_KEY[w.slot]]=id}else if(type==='outfit')d.outfit=id;else d.cls=id;save();return true},
  /** true when the item is the one currently equipped in its slot */
  equipped(type,id){if(type==='weapon')return d.primary===id||d.secondary===id||d.gear===id;return type==='outfit'?d.outfit===id:d.cls===id},
  award(cr,xp){d.cr+=Math.max(0,Math.floor(cr||0));d.xp+=Math.max(0,Math.floor(xp||0));save()},
  setName(n){d.name=clean(n);save()},
  /** subscribe to changes; returns an unsubscribe function */
  on(fn){subs.add(fn);return()=>subs.delete(fn)},
 };
 return p;
}
