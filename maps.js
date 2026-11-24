/* FRONT ZÉRO : système de mondes (5 cartes originales).
   Partie 1 : kit de layout pur (aucune dépendance DOM/WebGL, testable sous Node).
   Partie 2 : les cartes.  Partie 3 : rendu three.js (createWorld). */
import * as THREE from 'three';
/* Horizon (map-horizon.js) : purement visuel, chargé à part ; s'il manque ou échoue, l'ancien décor lointain reste. */let hzMod=null;const hzReady=import('./map-horizon.js').then(m=>{hzMod=m}).catch(()=>{});
/* Véhicules du contour (map-vehicles.js) : purement visuel ; s'il manque ou échoue, les anciens véhicules restent. */let vzMod=null;const vzReady=import('./map-vehicles.js').then(m=>{vzMod=m}).catch(()=>{});
/* Adoucissement (map-soften.js) : rendu seul, ne touche ni au layout ni aux collisions ; s'il manque ou échoue, le maillage d'origine reste. */let sfMod=null;const sfReady=import('./map-soften.js').then(m=>{sfMod=m}).catch(()=>{});

export const MAPS=[
 {id:'depot',name:'Dépôt 7',desc:'Base militaire du désert : hangar traversant, tranchées de sacs, tour de guet et longues lignes de tir.',env:'desert'},
 {id:'vieille-ville',name:'Vieille Ville',desc:'Cité meurtrie : ruelles, arcades, cours, maisons à étages et passerelles entre les toits.',env:'urban'},
 {id:'port',name:'Port du Couchant',desc:'Docks au crépuscule : labyrinthe de conteneurs, entrepôt traversant, coursives et grues au-dessus de l’eau.',env:'port'},
 {id:'bunker',name:'Bunker Sigma',desc:'Complexe souterrain : couloirs, salles de contrôle, gaines techniques et hall du réacteur.',env:'bunker'},
 {id:'col-blanc',name:'Col Blanc',desc:'Passage de montagne enneigé : ravin, pont de bois, tranchées, chalets et pins.',env:'snow'},
 {id:'sept-vents',name:'Piste Sept-Vents',desc:'Base aérienne battue par le vent : piste géante, hangars ouverts, tour de contrôle, épaves d’avions et dépôt de carburant.',env:'airbase'},
 {id:'noirval',name:'Raffinerie Noirval',desc:'Complexe pétrolier au crépuscule : parcs de cuves, racks de tuyaux, passerelles sur plusieurs niveaux, entrepôts et gare de triage.',env:'refinery'},
 {id:'val-cendre',name:'Val de Cendre',desc:'Village de montagne à l’automne : maisons à visiter, pont sur la rivière à sec, terrasses étagées et crête fortifiée.',env:'valley'},
];

/* ---------- KIT DE LAYOUT ---------- */
const SURF={sand:'sand',sandbag:'sand',hesco:'sand',conc:'concrete',concD:'concrete',plaster:'concrete',plasterB:'concrete',plasterO:'concrete',stone:'concrete',brick:'concrete',bwall:'concrete',ceil:'concrete',panel:'metal',tile:'concrete',rock:'concrete',rockS:'snow',snow:'snow',wood:'wood',woodD:'wood',crate:'wood',door:'wood',corr:'metal',rust:'metal',plate:'metal',steel:'metal',frame:'metal',paint:'metal',burn:'metal',barrel:'metal',cont0:'metal',cont1:'metal',cont2:'metal',cont3:'metal',tarp:'wood'};
const rng=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const D=(c,w=2.2,t=2.4)=>({a:c-w/2,b:c+w/2,s:0,t});
const W=(c,w=1.3,s=1.05,t=2.15)=>({a:c-w/2,b:c+w/2,s,t});

/* Rochers : même maillage que le rendu (icosaèdre détail 1 déformé, voir rockC) pour en tirer des collisions fidèles :
   tranches horizontales, bandes de 25 cm regroupées tant qu'aucun coin de boîte ne dépasse la roche de plus de eps. */
const ROCKV=(()=>{const t=(1+Math.sqrt(5))/2,V=[-1,t,0,1,t,0,-1,-t,0,1,-t,0,0,-1,t,0,1,t,0,-1,-t,0,1,-t,t,0,-1,t,0,1,-t,0,-1,-t,0,1],I=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];
 const P=i=>{const l=Math.hypot(V[i*3],V[i*3+1],V[i*3+2]);return[V[i*3]/l,V[i*3+1]/l,V[i*3+2]/l]},mid=(a,b)=>{const m=[a[0]+b[0],a[1]+b[1],a[2]+b[2]],l=Math.hypot(m[0],m[1],m[2]);return[m[0]/l,m[1]/l,m[2]/l]},tris=[];
 for(let f=0;f<60;f+=3){const a=P(I[f]),b=P(I[f+1]),c=P(I[f+2]),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);tris.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca)}
 return[0,1,2,3].map(v=>tris.map(([x,y,z])=>{const n=1+.22*Math.sin(x*3.1+v*1.7)*Math.cos(z*2.7-v)+.12*Math.sin(y*5+v*2.3);return[x*n,Math.max(y*n,-.6),z*n]}))})();
const clipP=(p,ax,v,s)=>{const o=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],da=s*(a[ax]-v),db=s*(b[ax]-v);if(da>=0)o.push(a);if(da>=0!==db>=0){const t=da/(da-db);o.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t])}}return o};
/* coarse : rochers de bordure (une tranche fine 0..2.1 m puis des boîtes englobantes au-dessus) */
function rockCols(k,o,host,coarse,cap=1e9){const c=Math.cos(o.ry),s=Math.sin(o.ry),S=k.size,P=ROCKV[o.v].map(([x,y,z])=>[o.x+x*o.sx*c+z*o.sz*s,o.y+y*o.sy,o.z-x*o.sx*s+z*o.sz*c]),surf=SURF[o.m]||'concrete',EPS=coarse?.4:cap<1e9?.16:.3;
 let top=0;for(const p of P)if(p[1]>top)top=p[1];if(top<.5)return;
 const emit=(x0,x1,y0,y1,z0,z1)=>{if(host&&y1<=host.y1+1e-6){const ix=x0>=host.x0&&x1<=host.x1,iz=z0>=host.z0&&z1<=host.z1;if(iz&&!ix){if(x1<=host.x1)x1=host.x0;else if(x0>=host.x0)x0=host.x1}else if(ix&&!iz){if(z1<=host.z1)z1=host.z0;else if(z0>=host.z0)z0=host.z1}}
  x0=Math.max(x0,-S);x1=Math.min(x1,S);z0=Math.max(z0,-S);z1=Math.min(z1,S);if(x1-x0<.1||z1-z0<.1)return;for(const h of k.solids)if(x0>=h.x0&&x1<=h.x1&&z0>=h.z0&&z1<=h.z1&&y0>=h.y0&&y1<=h.y1)return;k.col(x0,x1,y0,y1,z0,z1,surf)};
 const Y=[0];for(;;){const y=Y[Y.length-1]+(coarse?(Y.length>1?2.4:2.1):Y.length>4?1.4:.7);if(y>=top-.33)break;Y.push(y)}Y.push(top);
 for(let l=0;l<Y.length-1;l++){const ya=Y[l],yb=Y[l+1],polys=[];if(ya>=cap)break;let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  for(let i=0;i<P.length;i+=3){const p=clipP(clipP([P[i],P[i+1],P[i+2]],1,ya,1),1,yb,-1);if(p.length<3)continue;polys.push(p);for(const q of p){if(q[0]<x0)x0=q[0];if(q[0]>x1)x1=q[0];if(q[2]<z0)z0=q[2];if(q[2]>z1)z1=q[2]}}
  if(!polys.length)continue;if(coarse&&l){emit(x0,x1,ya,yb,z0,z1);continue}
  const U=x1-x0>=z1-z0?0:2,W=2-U,u0=U?z0:x0,ext=(U?z1:x1)-u0,n=Math.max(1,Math.ceil(ext/.25)),w=ext/n||1,lo=new Float64Array(n).fill(1e9),hi=new Float64Array(n).fill(-1e9);
  for(const p of polys){let a=1e9,b=-1e9;for(const q of p){if(q[U]<a)a=q[U];if(q[U]>b)b=q[U]}for(let i=Math.max(0,Math.floor((a-u0)/w));i<=Math.min(n-1,Math.floor((b-u0)/w));i++)for(const t of clipP(clipP(p,U,u0+i*w,1),U,u0+(i+1)*w,-1)){if(t[W]<lo[i])lo[i]=t[W];if(t[W]>hi[i])hi[i]=t[W]}}
  /* distance d'un point à l'union des bandes */
  const far=(u,v)=>{let m=1e9;for(let i=0;i<n;i++){if(hi[i]<lo[i])continue;const du=Math.max(0,u0+i*w-u,u-u0-(i+1)*w),dv=Math.max(0,lo[i]-v,v-hi[i]),d=du*du+dv*dv;if(d<m)m=d}return m>EPS*EPS};
  for(let i=0;i<n;){if(hi[i]<lo[i]){i++;continue}let j=i,a=lo[i],b=hi[i];while(j+1<n&&hi[j+1]>=lo[j+1]){const na=Math.min(a,lo[j+1]),nb=Math.max(b,hi[j+1]),ua=u0+i*w,ub=u0+(j+2)*w;if(far(ua,na)||far(ua,nb)||far(ub,na)||far(ub,nb))break;a=na;b=nb;j++}
   const ua=u0+i*w,ub=u0+(j+1)*w;if(U)emit(a,b,ya,yb,ua,ub);else emit(ua,ub,ya,yb,a,b);i=j+1}}}

class Kit{
 constructor(env,size,seed){Object.assign(this,{env,size,solids:[],ops:[],spawns:[],lights:[],smoke:[],paths:[],paints:[],glows:[],inst:[],doors:[],rises:[],floors:[],water:null});this.r=rng(seed)}
 rnd(a,b){return a+this.r()*(b-a)}
 col(x0,x1,y0,y1,z0,z1,surface='concrete'){const s={x0,x1,y0,y1,z0,z1,surface};this.solids.push(s);return s}
 vis(x0,x1,y0,y1,z0,z1,m,o){this.ops.push({t:'b',x0,x1,y0,y1,z0,z1,m,fit:o&&o.fit})}
 box(x0,x1,y0,y1,z0,z1,m,o){this.vis(x0,x1,y0,y1,z0,z1,m,o);return this.col(x0,x1,y0,y1,z0,z1,(o&&o.surface)||SURF[m]||'concrete')}
 dbox(x,y,z,w,h,d,m,ry=0){this.ops.push({t:'r',x,y,z,w,h,d,m,ry})}
 dcyl(x,y,z,r,h,m,seg=12,rx=0,rz=0,r2=r){this.ops.push({t:'c',x,y,z,r,r2,h,m,seg,rx,rz})}
 rock(x,y,z,sx,sy,sz,m='rock',host,ry,fine){const o={t:'k',x,y,z,sx,sy,sz,m,v:Math.floor(this.r()*4),ry:this.r()*6.28};if(ry!==undefined)o.ry=ry+(o.ry-3.14)*.05;this.ops.push(o);rockCols(this,o,host,ry!==undefined&&!fine,fine?2.8:1e9)}
 /* collision d'un cylindre vertical : 3 ou 5 boîtes croisées (coin à moins de 0.16 r / 0.1 r du cercle) */
 disc(x,z,r,y0,y1,surface='concrete'){for(const[a,b]of r<2?[[1,.5774],[.8165,.8165],[.5774,1]]:[[1,.4472],[.8944,.6325],[.7746,.7746],[.6325,.8944],[.4472,1]])this.col(x-r*a,x+r*a,y0,y1,z-r*b,z+r*b,surface)}
 sp(x,z){this.spawns.push([x,z])}
 light(x,y,z,color,intensity,dist,flick=0){this.lights.push({x,y,z,color,intensity,dist,flick,ph:this.r()*10})}
 glow(x,z,r,color,a=.5){this.glows.push({x,z,r,color,a})}
 fume(x,z,sz,color,h){this.smoke.push({x,z,sz,color,h})}
 perimeter(h,m){const S=this.size,T=1.2,H=18;for(const[a,b,c,d]of[[-S-T,S+T,-S-T,-S],[-S-T,S+T,S,S+T],[-S-T,-S,-S,S],[S,S+T,-S,S]]){this.vis(a,b,0,h,c,d,m);this.col(a,b,0,H,c,d,SURF[m])}}
 /* collision seule du contour : mur continu de 18 m (le décor est posé derrière par dress) */
 limit(surface='concrete'){const S=this.size,T=1.2,H=18;for(const[a,b,c,d]of[[-S-T,S+T,-S-T,-S],[-S-T,S+T,S,S+T],[-S-T,-S,-S,S],[S,S+T,-S,S]])this.col(a,b,0,H,c,d,surface)}
 wall(axis,c,a,b,y0,y1,holes,m,t=.3){
  const seg=(u0,u1,v0,v1)=>{if(u1-u0<.01||v1-v0<.01)return;axis==='x'?this.box(u0,u1,v0,v1,c-t/2,c+t/2,m):this.box(c-t/2,c+t/2,v0,v1,u0,u1,m)};
  let u=a;for(const h of[...(holes||[])].sort((p,q)=>p.a-q.a)){seg(u,h.a,y0,y1);if(h.s>0)seg(h.a,h.b,y0,y0+h.s);if(y0+h.t<y1)seg(h.a,h.b,y0+h.t,y1);if(h.s===0)this.doors.push({w:h.b-h.a,h:Math.min(h.t,y1-y0)});this.trim(axis,c,h,y0,t,y1);u=h.b}
  seg(u,b,y0,y1)}
 trim(axis,c,h,y0,t,y1){const o=t+.1,top=Math.min(y0+h.t,y1),mk=(u0,u1,v0,v1)=>axis==='x'?this.vis(u0,u1,v0,v1,c-o/2,c+o/2,'frame'):this.vis(c-o/2,c+o/2,v0,v1,u0,u1,'frame');
  mk(h.a-.09,h.a,y0+h.s,top);mk(h.b,h.b+.09,y0+h.s,top);if(top<y1)mk(h.a-.09,h.b+.09,top,Math.min(top+.09,y1));if(h.s>0)mk(h.a-.09,h.b+.09,y0+h.s-.06,y0+h.s)}
 room(x0,x1,z0,z1,y0,y1,h,m,t=.3){h=h||{};this.wall('x',z0+t/2,x0,x1,y0,y1,h.zn,m,t);this.wall('x',z1-t/2,x0,x1,y0,y1,h.zp,m,t);this.wall('z',x0+t/2,z0+t,z1-t,y0,y1,h.xn,m,t);this.wall('z',x1-t/2,z0+t,z1-t,y0,y1,h.xp,m,t)}
 slab(x0,x1,z0,z1,y,m,th=.2,hole){this.floors.push({x0,x1,z0,z1,y});const s=(a,b,c,d)=>{if(b-a>.01&&d-c>.01)this.box(a,b,y-th,y,c,d,m)};if(!hole)return s(x0,x1,z0,z1);const[a,b,c,d]=hole;s(x0,a,z0,z1);s(b,x1,z0,z1);s(a,b,z0,c);s(a,b,d,z1)}
 stairs(x,z,w,dir,y0,y1,m='conc',dep=.42){const n=Math.ceil((y1-y0)/.27-1e-6),r=(y1-y0)/n,sg=dir[1]==='+'?1:-1;this.rises.push(r);
  for(let i=0;i<n;i++){const p=sg*i*dep,q=sg*(i+1)*dep,top=y0+r*(i+1);if(dir[0]==='x')this.box(x+Math.min(p,q),x+Math.max(p,q),y0,top,z-w/2,z+w/2,m);else this.box(x-w/2,x+w/2,y0,top,z+Math.min(p,q),z+Math.max(p,q),m)}return n*dep}
 rail(x0,x1,z0,z1,y,h=1.02){this.box(x0,x1,y+h-.06,y+h,z0,z1,'steel');const lx=x1-x0>=z1-z0,L=lx?x1-x0:z1-z0,n=Math.max(1,Math.round(L/1.6));for(let i=0;i<=n;i++){const u=i/n;this.dbox(lx?x0+L*u:(x0+x1)/2,y,lx?(z0+z1)/2:z0+L*u,.05,h,.05,'steel')}this.col(x0,x1,y,y+h,z0,z1,'metal')}
 bridge(x0,x1,z0,z1,y,m='wood'){this.slab(x0,x1,z0,z1,y,m,.16);if(x1-x0>z1-z0){this.rail(x0,x1,z0,z0+.07,y);this.rail(x0,x1,z1-.07,z1,y)}else{this.rail(x0,x0+.07,z0,z1,y);this.rail(x1-.07,x1,z0,z1,y)}}
 /* maison creuse à étage : doors/up = centres de portes par côté, stair = côté de l'escalier */
 house(x0,x1,z0,z1,o={}){const t=.3,F=3,R=6,m=o.m||'plaster',dn=o.doors||{},up=o.up||{},self=this;
  const w=(s,y0,y1,hs)=>{if(s==='zn')self.wall('x',z0+t/2,x0,x1,y0,y1,hs,m,t);if(s==='zp')self.wall('x',z1-t/2,x0,x1,y0,y1,hs,m,t);if(s==='xn')self.wall('z',x0+t/2,z0+t,z1-t,y0,y1,hs,m,t);if(s==='xp')self.wall('z',x1-t/2,z0+t,z1-t,y0,y1,hs,m,t)};
  const span=s=>s[0]==='z'?[x0+t,x1-t]:[z0+t,z1-t];
  const autoW=(s,ds,skip)=>{if(skip)return[];const[a,b]=span(s),out=[],n=Math.floor((b-a)/3);for(let i=0;i<n;i++){const u=a+(i+.5)*(b-a)/n;if(ds.every(h=>u+.85<h.a-.15||u-.85>h.b+.15))out.push(W(u))}return out};
  const flight=(side,y0,y1)=>{const n=Math.ceil((y1-y0)/.27-1e-6),run=n*.42,W2=1.9;let hole;
   if(side[0]==='z'){const cz=side==='zn'?z0+t+W2/2:z1-t-W2/2,sx=x0+t+1;self.stairs(sx,cz,W2,'x+',y0,y1,o.sm||'stone');hole=[sx-.05,sx+run+.02,cz-W2/2,cz+W2/2];const rz=side==='zn'?hole[3]:hole[2]-.07;self.rail(hole[0],hole[1]-.5,rz,rz+.07,y1);self.rail(hole[0]-.07,hole[0],side==='zn'?hole[2]:hole[2]-.07,side==='zn'?hole[3]+.07:hole[3],y1)}
   else{const cx=side==='xn'?x0+t+W2/2:x1-t-W2/2,sz=z0+t+1;self.stairs(cx,sz,W2,'z+',y0,y1,o.sm||'stone');hole=[cx-W2/2,cx+W2/2,sz-.05,sz+run+.02];const rx=side==='xn'?hole[1]:hole[0]-.07;self.rail(rx,rx+.07,hole[2],hole[3]-.5,y1);self.rail(side==='xn'?hole[0]:hole[0]-.07,side==='xn'?hole[1]+.07:hole[1],hole[2]-.07,hole[2],y1)}
   return hole};
  for(const s of['zn','zp','xn','xp']){const ds=(dn[s]||[]).map(c=>D(c));w(s,0,F,[...ds,...autoW(s,ds,o.stair===s)]);const us=(up[s]||[]).map(c=>D(c,2,2.4));w(s,F,R-.2,[...us,...autoW(s,us,o.roofStair===s)])}
  this.slab(x0,x1,z0,z1,F,o.fm||'wood',.2,flight(o.stair||'zn',0,F));
  const rh=o.roofStair?flight(o.roofStair,F,R):null;if(rh)this.slab(x0,x1,z0,z1,R,o.rm||'tile',.2,rh);else this.box(x0,x1,R-.2,R,z0,z1,o.rm||'tile');
  const g=o.gaps||{};for(const s of['zn','zp','xn','xp']){const hs=(g[s]||[]).map(c=>({a:c-1.1,b:c+1.1,s:.0001,t:9}));const pm=o.pm||m;if(s==='zn')this.wall('x',z0+.12,x0,x1,R,R+.85,hs,pm,.24);if(s==='zp')this.wall('x',z1-.12,x0,x1,R,R+.85,hs,pm,.24);if(s==='xn')this.wall('z',x0+.12,z0+.24,z1-.24,R,R+.85,hs,pm,.24);if(s==='xp')this.wall('z',x1-.12,z0+.24,z1-.24,R,R+.85,hs,pm,.24)}
  /* bandeau de façade : un anneau dans l'épaisseur des murs, jamais en travers de la cage d'escalier */for(const[a,b,c,d]of[[x0-.06,x1+.06,z0-.06,z0+t-.02],[x0-.06,x1+.06,z1-t+.02,z1+.06],[x0-.06,x0+t-.02,z0+t-.02,z1-t+.02],[x1-t+.02,x1+.06,z0+t-.02,z1-t+.02]])this.vis(a,b,F-.1,F+.04,c,d,'stone');}
 trench(pts,hw,h,m){const nrm=(a,b)=>{const dx=Math.sign(b[0]-a[0]),dz=Math.sign(b[1]-a[1]);return[-dz,dx]},L=[],R=[];
  for(let i=0;i<pts.length;i++){const n0=i>0?nrm(pts[i-1],pts[i]):nrm(pts[i],pts[i+1]),n1=i<pts.length-1?nrm(pts[i],pts[i+1]):n0,nx=i>0&&i<pts.length-1?n0[0]+n1[0]:n0[0],nz=i>0&&i<pts.length-1?n0[1]+n1[1]:n0[1];L.push([pts[i][0]+nx*hw,pts[i][1]+nz*hw]);R.push([pts[i][0]-nx*hw,pts[i][1]-nz*hw])}
  for(const P of[L,R])for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1];this.box(Math.min(a[0],b[0])-.28,Math.max(a[0],b[0])+.28,0,h,Math.min(a[1],b[1])-.28,Math.max(a[1],b[1])+.28,m)}}
 crate(x,z,s=1.4,h=s,y=0){this.box(x-s/2,x+s/2,y,y+h,z-s/2,z+s/2,'crate',{fit:1})}
 barrel(x,z,m='barrel'){this.dcyl(x,.55,z,.34,1.1,m,14);for(const y of[.3,.8])this.dcyl(x,y,z,.355,.04,'steel',14);this.col(x-.33,x+.33,0,1.1,z-.33,z+.33,'metal')}
 jersey(x0,x1,z0,z1){this.box(x0,x1,0,.3,z0,z1,'conc');const ix=x1-x0>z1-z0?0:.12,iz=x1-x0>z1-z0?.12:0;this.box(x0+ix,x1-ix,.3,1.05,z0+iz,z1-iz,'conc')}
 bags(x0,x1,z0,z1,h=1.25){this.box(x0,x1,0,h,z0,z1,'sandbag')}
 container(x,z,rot,y=0,c=0){const L=6.1,Wd=2.44,H=2.6,hx=(rot?Wd:L)/2,hz=(rot?L:Wd)/2,m='cont'+(c%4);this.box(x-hx,x+hx,y,y+H,z-hz,z+hz,m,{fit:1});for(const s of[-1,1]){if(rot)this.vis(x-hx-.03,x+hx+.03,y+H-.1,y+H+.02,z+s*(hz-.06)-.06,z+s*(hz-.06)+.06,'steel');else this.vis(x+s*(hx-.06)-.06,x+s*(hx-.06)+.06,y+H-.1,y+H+.02,z-hz-.03,z+hz+.03,'steel')}}
 truck(x,z,rot,burnt){const pt=(a,b)=>rot?[x+b,z+a]:[x+a,z+b],ry=rot?Math.PI/2:0,body=burnt?'burn':'paint',B=(a,y,b,w,h,d,m)=>{const q=pt(a,b);this.dbox(q[0],y,q[1],w,h,d,m,ry)};
  B(0,.62,-.1,2.25,.18,5.9,'steel');B(0,.8,-1.95,2.15,1.28,1.6,body);B(0,1.45,-2.76,1.75,.5,.05,'glass');B(0,.8,-2.95,2.2,.62,.5,body);B(0,.24,-2.96,2.15,.4,.46,'steel');B(0,.8,1,2.3,.5,3.95,body);
  if(!burnt)B(0,1.3,1,2.26,1.32,3.85,'tarp');else for(const b of[-.8,.5,1.8])B(0,1.3,b,2.2,.07,.08,'steel');
  for(const a of[-1.08,1.08])for(const b of[-2.05,.25,1.9]){const q=pt(a,b);this.dcyl(q[0],.48,q[1],.48,.34,'rubber',12,rot?Math.PI/2:0,rot?0:Math.PI/2)}
  for(const[b0,b1,h]of[[-3.2,-2.75,1.42],[-2.75,-1.15,2.08],[-1.15,2.98,burnt?1.38:2.62]])rot?this.col(x+b0,x+b1,0,h,z-1.25,z+1.25,'metal'):this.col(x-1.25,x+1.25,0,h,z+b0,z+b1,'metal');if(burnt)this.fume(x,z,1.3,0x29272a,8)}
 apc(x,z,rot){const hx=rot?3:1.45,hz=rot?1.45:3;this.box(x-hx,x+hx,.35,1.75,z-hz,z+hz,'paint');this.vis(x-hx*.75,x+hx*.75,1.75,2.25,z-hz*.75,z+hz*.75,'paint');this.dcyl(x,2.5,z,.62,.5,'burn',10);this.dcyl(rot?x+1.6:x,2.55,rot?z:z+1.6,.07,2.6,'steel',8,rot?0:Math.PI/2,rot?Math.PI/2:0);
  for(const s of[-1,1])for(const u of[-2,-.7,.7,2]){const px=rot?x+u:x+s*(hx+.02),pz=rot?z+s*(hz+.02):z+u;this.dcyl(px,.5,pz,.5,.36,'rubber',12,rot?Math.PI/2:0,rot?0:Math.PI/2)}this.col(x-hx-.2,x+hx+.2,0,1.75,z-hz-.2,z+hz+.2,'metal');this.col(x-hx*.75,x+hx*.75,1.75,2.25,z-hz*.75,z+hz*.75,'metal');this.col(x-.6,x+.6,2.25,2.75,z-.6,z+.6,'metal')}
 /* gravats décoratifs le long des bases de murs (petit clutter sans collision) */
 scatter(n,kind='rubble'){const g=this.solids.filter(s=>s.y0===0&&s.x1-s.x0>1.2&&s.x1-s.x0<30&&s.z1-s.z0<30);for(let i=0;i<n&&g.length;i++){const c=g[Math.floor(this.r()*g.length)],side=Math.floor(this.r()*4),u=this.r(),off=this.r()**2*1.1+.06,x=side<2?c.x0+(c.x1-c.x0)*u:side===2?c.x0-off:c.x1+off,z=side>=2?c.z0+(c.z1-c.z0)*u:side===0?c.z0-off:c.z1+off;if(Math.abs(x)>this.size||Math.abs(z)>this.size)continue;this.inst.push({k:kind,x,y:0,z,s:this.rnd(.05,kind==='shrub'?.12:.2),ry:this.r()*6})}}
 free(x,z,m){return this.solids.every(s=>x<s.x0-m||x>s.x1+m||z<s.z0-m||z>s.z1+m)}
 far(n,rMin,rMax,hMin,hMax,m='far'){for(let i=0;i<n;i++){const a=this.r()*6.283,r=this.rnd(rMin,rMax),w=this.rnd(8,25),d=this.rnd(8,22),h=this.rnd(hMin,hMax),x=Math.cos(a)*r,z=Math.sin(a)*r;this.dbox(x,0,z,w,h,d,m,a);if(this.r()<.6)this.dbox(x+this.rnd(-2,2),h,z+this.rnd(-2,2),w*this.rnd(.25,.6),this.rnd(2,8),d*.4,m,a)}}
}

/* ---------- BORDURES : contour en couches ----------
   Repère d'un bord : u le long du bord, v vers l'extérieur (v=0 : limite de jeu). La collision reste un mur continu de 18 m posé sur v=0..1.2 (Kit.limit) :
   tout ce qui est dessiné ici commence à v>=.02, donc derrière cette collision, et les faces avant affleurent la ligne (balles et joueur s'arrêtent sur ce qui est dessiné).
   Seuls les piliers entrent dans l'aire de jeu (.32 m, collision exacte, hauteur non escaladable). Aucune texture ni lumière nouvelle : matériaux existants, lots fusionnés par bord. */
/* Palette : les pièces unies du contour partagent un seul matériau à couleurs par sommet (2 lots par bord au lieu d'une vingtaine). PAL_NS : petites pièces, sans ombre portée. */
const PAL=Object.fromEntries(Object.entries({steel:0x5c6066,rubber:0x2a2a2a,frame:0x5b5346,glass:0x2f4350,pipeY:0xb98f2c,pipeR:0x8a3a28,asph:0x45423c,paint:0x4b5235,tarp:0x5d5a3e,tarpR:0x7a3a2c,burn:0x62554a,hull:0x3b3029,rust:0x93593a,corr:0x6b7064,plate:0x70757a,panel:0x7f8f88,door:0x49503f,crate:0x6d5b39,ceil:0x7c7f82,tile:0x8a4a32,barrel:0x5c4a2c,leaf:0x3f5228,leafA:0x9a6a28,tank:0x85857b,plasterB:0xc9c3b4,chain:0xa9aeb3,lightW:0xe6dfc0,lightR:0xb5301f}).map(([k,v])=>{const c=new THREE.Color(v);return[k,[c.r,c.g,c.b]]})),PAL_NS=new Set(['steel','rubber','frame','glass','pipeY','pipeR','asph','chain','lightW','lightR']);
const EDGE_D={n:[1,0,0,-1],s:[1,0,0,1],w:[0,1,-1,0],e:[0,1,1,0]};
class Prop{
 constructor(E,u,v,a=0){const[ux,uz,vx,vz]=E.d,c=Math.cos(a),s=Math.sin(a);this.k=E.k;this.ox=E.x(u,v);this.oz=E.z(u,v);this.lx=c*ux+s*vx;this.lz=c*uz+s*vz;this.wx=-s*ux+c*vx;this.wz=-s*uz+c*vz;this.ry=Math.atan2(-this.lz,this.lx);this.rw=Math.atan2(-this.wz,this.wx)}
 X(l,w){return this.ox+l*this.lx+w*this.wx}
 Z(l,w){return this.oz+l*this.lz+w*this.wz}
 b(l0,l1,y0,y1,w0,w1,m){const l=(l0+l1)/2,w=(w0+w1)/2;this.k.ops.push({t:'r',x:this.X(l,w),y:y0,z:this.Z(l,w),w:l1-l0,h:y1-y0,d:w1-w0,m,ry:this.ry})}
 /* cylindre d'axe w (roue), l (citerne, tuyau) ou y */
 c(l,y,w,r,h,m,ax='w',seg=10,r2=r){const o={t:'c',x:this.X(l,w),y,z:this.Z(l,w),r,r2,h,m,seg,rx:0,rz:ax==='y'?0:Math.PI/2};if(ax!=='y')o.ry=ax==='w'?this.rw:this.ry;this.k.ops.push(o)}
 roof(l0,l1,y,h,w0,w1,m){const l=(l0+l1)/2,w=(w0+w1)/2;this.k.ops.push({t:'p',x:this.X(l,w),y,z:this.Z(l,w),w:l1-l0,h,d:w1-w0,ry:this.ry,m})}
 /* détails de carrosserie, lisibles à l'ombre : lignes de portes, passages de roues, feux */
 sides(l0,l1,y0,y1,w,m){for(const s of[-1,1])this.b(l0,l1,y0,y1,s*w-.014,s*w+.014,m)}
 arches(ls,r,w,m){for(const l of ls)for(const s of[-1,1]){this.b(l-r-.09,l+r+.09,r*2+.02,r*2+.1,s*w-.05,s*w+.05,m);for(const e of[-1,1])this.b(l+e*(r+.09)-.04,l+e*(r+.09)+.04,r*.9,r*2+.05,s*w-.05,s*w+.05,m)}}
 lights(front,back,y,w,dead){const a=dead?'rust':'lightW',c=dead?'rust':'lightR';for(const s of[-1,1]){this.b(front-.03,front+.015,y,y+.17,s*w-.17,s*w+.17,a);this.b(back-.015,back+.03,y,y+.13,s*w-.15,s*w+.15,c)}}
 wheels(ls,W,r=.48,t=.3){for(const l of ls)for(const s of[-1,1]){this.c(l,r,s*W/2,r,t,'rubber','w',10);this.c(l,r,s*W/2,r*.55,t+.03,'steel','w',8)}}
}
/* Véhicules et engins : l = longueur (centrée), w = largeur (centrée). L = longueur, W = largeur hors tout. */
const VEH={
 truck:{L:7.2,W:2.76,f(P,o={}){const m=o.burnt?'burn':(o.body||'paint'),gl=o.burnt?'burn':'glass';P.b(-3.3,3.45,.62,.84,-.95,.95,'steel');P.b(-3.58,-3.38,.36,.66,-1.2,1.2,'steel');P.b(-3.38,-2.25,.72,1.62,-1.08,1.08,m);P.b(-3.4,-3.37,.82,1.5,-.78,.78,'frame');P.b(-2.25,-.85,.72,2.55,-1.18,1.18,m);P.b(-2.28,-2.24,1.66,2.38,-1.02,1.02,gl);for(const s of[-1,1]){P.b(-2.05,-1.2,1.66,2.36,s*1.17-.015,s*1.17+.015,gl);P.b(-3.41,-3.38,1.18,1.36,s*.72-.14,s*.72+.14,'steel');P.b(-2.32,-2.26,1.8,2.2,s*1.3-.05,s*1.3+.05,'steel');P.b(-.6,.5,.42,.72,s*.8-.22,s*.8+.22,'steel');P.b(-2.14,-2.11,.78,2.42,s*1.18-.012,s*1.18+.012,'frame');P.b(-1.0,-.97,.78,2.42,s*1.18-.012,s*1.18+.012,'frame');P.b(-1.36,-1.16,1.42,1.47,s*1.19-.015,s*1.19+.015,'steel');P.b(-2.1,-1,.5,.57,s*1.2-.13,s*1.2+.13,'steel');P.b(-3.05,-1.96,.98,1.06,s*1.04-.13,s*1.04+.13,m);P.b(-3.05,-3,.72,.98,s*1.04-.13,s*1.04+.13,m);P.b(-2.01,-1.96,.72,.98,s*1.04-.13,s*1.04+.13,m)}P.b(-.78,3.48,.84,1.14,-1.22,1.22,m);
  if(o.burnt){for(const l of[-.3,.9,2.1,3.3])P.b(l-.05,l+.05,1.14,2.1,-1.2,1.2,'steel');P.b(-.7,3.4,2.06,2.12,-1.15,-1.05,'steel');P.b(-.7,3.4,2.06,2.12,1.05,1.15,'steel')}
  else if(o.flat){for(const l of[-.5,.5,1.5,2.5])P.b(l,l+.86,1.14,1.92,-1.1,1.1,'crate')}
  else{P.b(-.72,3.42,1.14,2.5,-1.2,1.2,o.tarp||'tarp');P.roof(-.72,3.42,2.5,.38,-1.2,1.2,o.tarp||'tarp');for(const l of[-.7,.5,1.7,2.9])P.b(l,l+.05,1.14,2.52,-1.215,1.215,'woodD');P.b(3.42,3.45,1.14,2.5,-1.1,1.1,'tarpR')}
  P.lights(-3.41,3.48,.98,.76,o.burnt);P.sides(-2.14,-1,.76,.8,1.185,'frame');P.arches([1.15,2.45],.5,1.2,o.burnt?'rust':'frame');P.wheels([-2.5,1.15,2.45],2.08,.5,.34);if(o.burnt)for(const w of[-1.04,1.04])P.b(-2.95,3,0,.12,w-.3,w+.3,'burn')}},
 apc:{L:6.4,W:2.9,f(P,o={}){const m=o.burnt?'burn':'paint';P.b(-3.1,3.1,.5,1.8,-1.34,1.34,m);P.b(-3.2,-2.2,.62,1.42,-1.2,1.2,m);P.b(2.6,3.2,.68,1.72,-1.25,1.25,m);P.b(-2.1,2.4,1.8,2.28,-1,1,m);P.c(.2,2.46,0,.66,.36,'burn','y',10);P.c(-1.2,2.54,0,.06,2.5,'steel','l',8);P.b(-.3,.5,2.64,2.8,-.34,.34,'steel');for(const s of[-1,1]){P.b(-2.6,2.6,1.05,1.1,s*1.35-.02,s*1.35+.02,'steel');P.b(-1.9,-1.1,1.25,1.6,s*1.345-.02,s*1.345+.02,'glass')}P.lights(-3.22,3.2,1.2,.9,o.burnt);P.wheels([-2.1,-.7,.7,2.1],2.6,.52,.36)}},
 car:{L:4.3,W:1.85,f(P,o={}){const m=o.burnt?'burn':(o.body||'paint'),g=o.burnt?'burn':'glass';P.b(-2.1,2.1,.36,.95,-.9,.9,m);P.b(-2.14,-2.06,.34,.62,-.86,.86,'steel');P.b(2.06,2.14,.34,.62,-.86,.86,'steel');P.b(-.95,1.25,.95,1.42,-.82,.82,m);P.b(-1.0,-.94,1.0,1.38,-.74,.74,g);P.b(1.24,1.3,1.0,1.38,-.74,.74,g);for(const s of[-1,1])P.b(-.8,1.1,1.0,1.36,s*.83-.015,s*.83+.015,g);P.lights(-2.15,2.14,.68,.62,o.burnt);P.sides(-.92,-.89,.42,.98,.915,'frame');P.sides(.12,.15,.42,.98,.915,'frame');P.sides(1.16,1.19,.42,.98,.915,'frame');P.sides(-.35,-.15,.78,.82,.925,'steel');P.sides(.55,.75,.78,.82,.925,'steel');P.arches([-1.32,1.32],.32,.86,o.burnt?'rust':'frame');P.wheels([-1.32,1.32],1.62,.32,.22);if(o.burnt){P.b(-1.9,-.95,.95,1.0,-.75,.75,'rust');P.b(-2.05,2.05,.02,.14,-.86,.86,'burn')}}},
 van:{L:5.2,W:2.1,f(P,o={}){const m=o.body||'plasterB';P.b(-2.6,2.55,.42,2.25,-1.02,1.02,m);P.b(-2.62,-2.0,.38,1.05,-.98,.98,m);P.b(-2.08,-2.0,1.2,1.95,-.9,.9,'glass');for(const s of[-1,1])P.b(-1.9,-1.05,1.25,1.9,s*1.025-.015,s*1.025+.015,'glass');P.b(2.55,2.6,.5,2.1,-.95,.95,'steel');P.b(-2.68,-2.6,.38,.6,-.98,.98,'steel');P.lights(-2.69,2.6,.74,.72);P.sides(-2,-1.97,.46,2.2,1.035,'frame');P.sides(-.95,-.92,.46,2.2,1.035,'frame');P.sides(.9,.93,.46,2.2,1.035,'frame');P.sides(-2.58,2.53,1.05,1.12,1.035,'steel');P.sides(-.2,.25,1.2,1.25,1.04,'steel');P.b(2.6,2.625,.6,2,-.01,.01,'frame');P.arches([-1.5,1.6],.36,1.0,'frame');P.wheels([-1.5,1.6],1.86,.36,.26)}},
 bus:{L:11,W:2.7,f(P,o={}){const b=o.burnt,m=b?'burn':(o.body||'plasterO'),g=b?'burn':'glass';P.b(-5.5,5.5,.42,1.5,-1.3,1.3,m);P.b(-5.5,5.5,2.5,3.05,-1.3,1.3,m);P.b(-5.45,5.45,3.05,3.15,-1.2,1.2,b?'rust':'steel');for(let l=-5.2;l<5.2;l+=1.74){for(const s of[-1,1]){P.b(l-.07,l+.07,1.5,2.5,s*1.3-.05,s*1.3+.05,m);P.b(l+.07,l+1.67,1.55,2.46,s*1.305-.012,s*1.305+.012,b&&(Math.round(l*3)%3===0)?'hull':'glass')}}P.b(-5.53,-5.47,1.5,2.5,-1.1,1.1,'glass');P.b(5.47,5.53,1.5,2.5,-1.1,1.1,'glass');P.b(-5.2,5.2,.42,3,-1.22,1.22,b?'hull':'frame');P.lights(-5.54,5.52,.82,.92,b);P.sides(-5.45,5.45,1.32,1.42,1.315,b?'rust':'steel');P.sides(-5.45,5.45,.56,.62,1.315,b?'rust':'frame');P.sides(-4.75,-4.72,.46,2.48,1.32,b?'hull':'frame');P.sides(-3.95,-3.92,.46,2.48,1.32,b?'hull':'frame');P.sides(-4.34,-4.31,.46,2.48,1.32,b?'hull':'frame');P.sides(.4,.43,.46,2.48,1.32,b?'hull':'frame');P.sides(1.2,1.23,.46,2.48,1.32,b?'hull':'frame');P.b(-5.54,-5.5,.48,1.3,-.86,.86,b?'rust':'steel');P.arches([-3.4,3.4],.54,1.28,b?'rust':'frame');P.wheels([-3.4,3.4],2.36,.54,.38);if(b)P.b(-5,5,0,.14,-1.2,1.2,'burn')}},
 tanker:{L:9.4,W:2.6,f(P,o={}){const m=o.body||'paint',T=o.tank||'tank';P.b(-4.3,4.5,.62,.86,-.92,.92,'steel');P.b(-4.7,-4.5,.38,.68,-1.2,1.2,'steel');P.b(-4.5,-3.45,.72,1.62,-1.08,1.08,m);P.b(-3.45,-2.2,.72,2.5,-1.18,1.18,m);P.b(-3.48,-3.44,1.66,2.34,-1,1,'glass');for(const s of[-1,1])P.b(-3.25,-2.4,1.66,2.32,s*1.17-.015,s*1.17+.015,'glass');P.c(1.25,1.94,0,1.14,6.4,T,'l',12);for(const l of[-1.9,4.45])P.c(l,1.94,0,1.15,.1,'steel','l',12);for(const l of[-.6,1.25,3.1]){P.c(l,1.94,0,1.17,.08,'steel','l',12);P.c(l,3.14,0,.24,.1,'steel','y',8)}P.b(-1.9,4.4,3.08,3.14,-.28,.28,'steel');P.c(4.5,1.02,.65,.06,.5,'pipeR','w',6);P.lights(-4.54,4.5,.98,.76);P.sides(-3.38,-3.35,.76,2.44,1.185,'frame');P.sides(-2.3,-2.27,.76,2.44,1.185,'frame');P.sides(-2.72,-2.52,1.42,1.47,1.195,'steel');P.arches([.2,2.6,3.8],.5,1.12,'frame');P.wheels([-3.6,.2,2.6,3.8],2.1,.5,.32)}},
 forklift:{L:3.6,W:1.5,f(P){P.b(-1.2,.9,.28,1.05,-.65,.65,'pipeY');P.b(-1.4,-.95,.3,1.18,-.6,.6,'steel');for(const s of[-1,1]){P.b(-.95,-.86,1.05,2.16,s*.58-.04,s*.58+.04,'rubber');P.b(.18,.26,1.05,2.16,s*.58-.04,s*.58+.04,'rubber');P.b(.92,1.02,.05,3.1,s*.34-.05,s*.34+.05,'steel');P.b(1.05,2.1,.12,.18,s*.32-.07,s*.32+.07,'steel')}P.b(-.95,.26,2.14,2.22,-.62,.62,'rubber');P.b(-.3,.15,1.05,1.32,-.28,.28,'rubber');P.b(1.02,1.06,.12,1.2,-.48,.48,'steel');P.wheels([.55],1.2,.34,.24);P.wheels([-.95],1.14,.26,.2)}},
 tractor:{L:4.6,W:2.1,f(P){P.b(-2.25,.1,.72,1.5,-.42,.42,'pipeR');P.b(-2.28,-2.22,.8,1.42,-.36,.36,'frame');P.b(.05,1.45,.62,1.4,-.56,.56,'pipeR');P.b(.15,1.5,1.4,1.46,-.6,.6,'rubber');for(const s of[-1,1]){P.b(.15,.22,1.45,2.6,s*.56-.03,s*.56+.03,'steel');P.b(1.4,1.47,1.45,2.6,s*.56-.03,s*.56+.03,'steel');P.b(.2,1.42,1.5,2.5,s*.555-.01,s*.555+.01,'glass')}P.b(.1,1.52,2.6,2.68,-.66,.66,'pipeR');P.c(-1.6,1.9,.24,.05,.9,'steel','y',6);P.b(-2.05,1.4,.5,.74,-.3,.3,'steel');P.c(-1.55,.46,-.88,.46,.2,'rubber');P.c(-1.55,.46,.88,.46,.2,'rubber');P.c(-1.55,.46,-.9,.22,.23,'pipeY','w',8);P.c(-1.55,.46,.9,.22,.23,'pipeY','w',8);for(const s of[-1,1]){P.c(1.15,.82,s*.86,.82,.42,'rubber','w',14);P.c(1.15,.82,s*.86,.42,.45,'pipeY','w',10)}}},
 logtruck:{L:9,W:2.6,f(P,o={}){const m=o.body||'pipeR';P.b(-4.1,4.3,.62,.84,-.95,.95,'steel');P.b(-4.5,-4.3,.38,.66,-1.2,1.2,'steel');P.b(-4.3,-3.25,.72,1.62,-1.08,1.08,m);P.b(-3.25,-2,.72,2.5,-1.18,1.18,m);P.b(-3.28,-3.24,1.66,2.32,-1,1,'glass');for(const s of[-1,1]){P.b(-3.05,-2.2,1.66,2.3,s*1.17-.015,s*1.17+.015,'glass');for(const l of[-1.2,1.2,3.6])P.b(l-.06,l+.06,.84,2.7,s*1.16-.05,s*1.16+.05,'steel')}for(let i=0;i<3;i++)for(let j=0;j<3-i;j++){const w=(j-(2-i)/2)*.74;P.c(1.05,1.25+i*.62,w,.36,6.6,j%2?'woodD':'wood','l',8)}P.lights(-4.34,4.32,.98,.76);P.sides(-3.18,-3.15,.76,2.44,1.185,'frame');P.sides(-2.1,-2.07,.76,2.44,1.185,'frame');P.sides(-2.52,-2.32,1.42,1.47,1.195,'steel');P.wheels([-3.4,1.2,2.4,3.6],2.08,.5,.32)}},
 tracked:{L:6.2,W:3.42,f(P,o={}){const m=o.body||'paint',sn=o.snow;for(const s of[-1,1]){P.b(-3,3,.2,1.02,s*1.28-.28,s*1.28+.28,'rubber');for(const l of[-2.4,-1.2,0,1.2,2.4])P.c(l,.52,s*1.28,.42,.6,'steel','w',10);P.b(-3,3,.94,1.02,s*1.28-.3,s*1.28+.3,'steel')}P.b(-2.9,2.9,.7,1.95,-1.02,1.02,m);P.b(-2.2,.9,1.95,2.85,-.96,.96,m);P.b(-2.23,-2.18,2.05,2.65,-.82,.82,'glass');for(const s of[-1,1])P.b(-2,-.4,2.1,2.65,s*.965-.015,s*.965+.015,'glass');P.b(.95,2.8,1.95,2.2,-.86,.86,'tarp');P.lights(-2.93,2.92,1.5,.72);P.sides(-1.95,-1.92,1.98,2.82,.972,'frame');P.sides(-.5,-.47,1.98,2.82,.972,'frame');P.sides(-.85,-.65,2.3,2.34,.98,'steel');if(sn){P.b(-2.3,1,2.85,3.05,-1.02,1.02,'snow');P.b(.9,2.95,2.2,2.32,-.9,.9,'snow');P.b(-3.05,3.05,.0,.42,-1.65,1.65,'snow')}}},
 fuselage:{L:30,W:5.6,f(P){P.c(0,3.1,0,2.5,24,'plasterB','l',12);P.c(-13.5,3.1,0,2.5,3,'plasterB','l',12,1.35);P.c(-14.85,3.1,0,1.35,.5,'plasterB','l',12,.55);P.c(13.8,3.45,0,1.25,3.6,'plasterB','l',12,2.5);P.b(-11.8,-11,4.25,4.85,-1.46,1.46,'glass');for(const s of[-1,1]){for(let l=-9;l<11;l+=1.5)P.b(l,l+.55,3.68,4.1,s*2.48-.02,s*2.48+.02,'glass');P.b(-6.6,-5.2,1.1,3.3,s*2.47-.02,s*2.47+.02,'steel');P.b(-6.56,-5.24,1.14,3.26,s*2.48-.02,s*2.48+.02,'plate');P.c(3,.72,s*2.5,.7,.5,'rubber','w',12);P.c(-3,.72,s*2.5,.7,.5,'rubber','w',12)}P.b(-12,12,1.0,1.12,-2.05,2.05,'rust');P.b(6,9,.1,1.2,-2.2,2.2,'steel');P.b(-2.6,3.4,5.05,5.45,-2.3,2.3,'steel');P.b(14.2,15.2,4.6,8.8,-.12,.12,'plate');P.b(13,15,5.8,6,-1,1,'plate');P.b(-1.4,.9,1,1.4,-3,-2.4,'steel')}},
 wagon:{L:13,W:3,f(P,o={}){const T=o.tank;for(let l=-6.4;l<=6.4;l+=.8)P.b(l-.11,l+.11,0,.07,-1.2,1.2,'woodD');for(const b of[-3.9,3.9])P.b(b-1.1,b+1.1,.26,.58,-.62,.62,'frame');for(const s of[-1,1]){P.b(-6.6,6.6,.07,.15,s*.72-.035,s*.72+.035,'steel');P.b(-6.3,6.3,.5,.64,s*.72-.05,s*.72+.05,'steel');for(const l of[-4.6,-3.2,3.2,4.6])P.c(l,.42,s*.72,.42,.1,'steel','w',12)}P.b(-6.4,6.4,.64,.98,-1.42,1.42,'frame');for(const e of[-6.55,6.55])P.b(e-.14,e+.14,.72,.94,-1.05,1.05,'steel');if(T){P.c(0,2.34,0,1.36,12,'tank','l',12);for(const l of[-5.95,5.95])P.c(l,2.34,0,1.38,.1,'steel','l',12);for(const l of[-3.4,0,3.4])P.c(l,2.34,0,1.4,.07,'steel','l',12);P.c(0,3.8,0,.34,.3,'steel','y',8);P.b(-.6,.6,3.72,3.76,-.54,.54,'plate')}else{P.b(-6.2,6.2,.98,3.5,-1.4,1.4,o.m||'rust');P.b(-6.3,6.3,3.5,3.66,-1.45,1.45,'corr');for(let l=-5.6;l<6;l+=1.6)for(const s of[-1,1])P.b(l-.04,l+.04,.98,3.5,s*1.42-.02,s*1.42+.02,'steel');for(const s of[-1,1])P.b(-1,1,1.15,3.3,s*1.42-.03,s*1.42+.03,'door')}}},
 cart:{L:2.4,W:1.25,H:1.52,f(P,o={}){const m=o.m||'pipeY';P.b(-1.2,1.2,.32,.48,-.6,.6,'steel');P.b(-1.1,.3,.48,.9,-.58,.58,m);P.b(-1.2,-1.12,.48,1.5,-.54,.54,'steel');P.b(-1.2,-1.1,1.42,1.5,-.58,.58,'rubber');for(const s of[-1,1])P.b(.32,1.2,.48,.72,s*.56-.03,s*.56+.03,'steel');P.b(.5,1.1,.5,.92,-.36,.36,'crate');P.wheels([-.75,.75],1.08,.2,.14)}},
};
/* Point d'entrée UNIQUE de tous les véhicules du contour : type, position (u le long du bord, v vers l'extérieur), rotation a, épave (o.wreck ou o.burnt), collision (o.collider).
   Pour brancher d'autres modèles, remplacer seulement l'appel d.f ci-dessous. k.vehicles garde la liste {type,x,z,ry,wreck,L,W} de la carte. */
function placeVehicle(E,type,u,v,a=0,o={}){const d=VEH[type];if(!d)throw new Error('véhicule inconnu : '+type);const wreck=!!(o.wreck||o.burnt),P=E.prop(u,v,a),k=E.k,n0=k.ops.length;d.f(P,{...o,burnt:wreck});for(let i=n0;i<k.ops.length;i++)k.ops[i].vh=1;(k.vehicles||(k.vehicles=[])).push({type,x:P.ox,z:P.oz,ry:P.ry,wreck,L:d.L,W:d.W,H:o.collider?d.H||2:0,o});if(o.collider)E.solid(u-d.L/2-.02,u+d.L/2+.02,0,d.H||2,v-d.W/2-.02,v+d.W/2+.02,'metal');return d}
/* Boîte chanfreinée : arêtes cassées à taille constante, quel que soit l'étirement (44 triangles). */
function chamGeo(o){const c=Math.min(o.c,(o.x1-o.x0)*.45,(o.y1-o.y0)*.45,(o.z1-o.z0)*.45),A=[o.x0,o.x1],B=[o.y0,o.y1],C=[o.z0,o.z1],mx=(o.x0+o.x1)/2,my=(o.y0+o.y1)/2,mz=(o.z0+o.z1)/2,P=[],N=[],ins=(v,i,axis)=>v[i]+(i?-c:c),
 V=(i,j,k,f)=>[f===0?A[i]:ins(A,i),f===1?B[j]:ins(B,j),f===2?C[k]:ins(C,k)],
 tri=(a,b,q)=>{let ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=q[0]-a[0],vy=q[1]-a[1],vz=q[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz);if(l<1e-10)return;nx/=l;ny/=l;nz/=l;if(nx*((a[0]+b[0]+q[0])/3-mx)+ny*((a[1]+b[1]+q[1])/3-my)+nz*((a[2]+b[2]+q[2])/3-mz)<0){const t=b;b=q;q=t;nx=-nx;ny=-ny;nz=-nz}for(const p of[a,b,q]){P.push(p[0],p[1],p[2]);N.push(nx,ny,nz)}},quad=(a,b,q,d)=>{tri(a,b,q);tri(a,q,d)};
 for(const s of[0,1]){quad(V(s,0,0,0),V(s,1,0,0),V(s,1,1,0),V(s,0,1,0));quad(V(0,s,0,1),V(1,s,0,1),V(1,s,1,1),V(0,s,1,1));quad(V(0,0,s,2),V(1,0,s,2),V(1,1,s,2),V(0,1,s,2))}
 for(const i of[0,1])for(const j of[0,1]){quad(V(i,j,0,0),V(i,j,1,0),V(i,j,1,1),V(i,j,0,1));quad(V(i,0,j,0),V(i,1,j,0),V(i,1,j,2),V(i,0,j,2));quad(V(0,i,j,1),V(1,i,j,1),V(1,i,j,2),V(0,i,j,2))}
 for(const i of[0,1])for(const j of[0,1])for(const k of[0,1])tri(V(i,j,k,0),V(i,j,k,1),V(i,j,k,2));
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));return g}
/* ---------- pièces de contour : (E,a,b,r,o) dessinent la tranche u=a..b ---------- */
const lerp=(a,b,t)=>a+(b-a)*t;
const fenceRun=(E,a,b,v,h,o={})=>{const P=E.prop(a,v),L=b-a,n=Math.max(1,Math.round(L/2.6)),T=o.top!==false;E.quad(a,b,o.y0||0,h,v);for(let i=0;i<=n;i++){const l=L*i/n;P.c(l,h/2,0,.045,h+.04,'steel','y',6);if(T)P.b(l-.015,l+.015,h,h+.34,.0,.26,'steel')}P.c(L/2,h,0,.03,L,'steel','l',5);P.c(L/2,.1,0,.018,L,'steel','l',4);if(T)for(const w of[.1,.18,.26])P.b(0,L,h+w*1.2,h+w*1.2+.012,w-.006,w+.006,'rubber');if(T&&L>3){const m=Math.round(L/1.1);for(let i=0;i<m;i++){const l=(i+.5)*L/m;P.b(l-.018,l+.018,h+.08,h+.3,.14,.16,'rubber')}}};
const signAt=(E,u,y,v,kind=0)=>{const P=E.prop(u,v);P.b(-.3,.3,y-.3,y+.3,-.012,.012,'pipeY');P.b(-.27,.27,y+.25,y+.27,-.018,.018,'rubber');P.b(-.27,.27,y-.27,y-.25,-.018,.018,'rubber');P.b(-.27,-.25,y-.27,y+.27,-.018,.018,'rubber');P.b(.25,.27,y-.27,y+.27,-.018,.018,'rubber');if(kind===0){P.b(-.035,.035,y-.06,y+.17,-.02,.02,'rubber');P.b(-.035,.035,y-.18,y-.11,-.02,.02,'rubber')}else if(kind===1){P.b(-.17,.17,y-.04,y+.04,-.02,.02,'pipeR')}else{for(let i=-2;i<=2;i++)P.b(i*.08-.03,i*.08+.03,y-.16+Math.abs(i)*.05,y+.16-Math.abs(i)*.05,-.02,.02,'rubber')}};
const hazard=(E,a,b,y,v,hh=.16)=>{const n=Math.max(2,Math.round((b-a)/.42));for(let i=0;i<n;i++){const u0=lerp(a,b,i/n),u1=lerp(a,b,(i+1)/n);E.box(u0,u1,y,y+hh,v,v+.03,i%2?'rubber':'pipeY')}};
const BM={
 /* grillage + poteaux + barbelés */
 f(E,a,b,r,o){fenceRun(E,a,b,.08,o.fh||3.1);if(b-a>4)signAt(E,lerp(a,b,.5),1.65,.055,Math.floor(r()*3))},
 /* grillage à panneaux de danger sur plots béton */
 w(E,a,b,r,o){const n=Math.max(1,Math.round((b-a)/2.4));for(let i=0;i<n;i++){const u0=lerp(a,b,i/n),u1=lerp(a,b,(i+1)/n);E.cbox(u0+.02,u1-.02,0,.42,.04,.4,'conc',.05);hazard(E,u0+.02,u1-.02,.42,.03,.09)}fenceRun(E,a,b,.2,3.0,{y0:.42});signAt(E,lerp(a,b,.3),1.8,.17,0);if(b-a>6)signAt(E,lerp(a,b,.72),1.8,.17,1)},
 /* hesco : gabions empilés, décalés */
 h(E,a,b,r){const n=Math.max(1,Math.round((b-a)/1.12)),w=(b-a)/n;for(let i=0;i<n;i++){const u=a+i*w,top=1.26,dv=(i%3)*.04,two=(i+Math.floor(r()*2))%5!==0;E.box(u+.012,u+w-.012,0,top,.03+dv,1.14+dv,'hesco');E.box(u+.05,u+w-.05,top,top+.07,.07+dv,1.1+dv,'sandbag');if(two){E.box(u+.012,u+w-.012,top,2*top,.1+dv,1.18+dv,'hesco');E.box(u+.05,u+w-.05,2*top,2*top+.07,.14+dv,1.14+dv,'sandbag');if(i%4===1){E.box(u+.012,u+w-.012,2*top,3*top,.16+dv,1.24+dv,'hesco');E.box(u+.05,u+w-.05,3*top,3*top+.07,.2+dv,1.2+dv,'sandbag')}}}},
 /* murs en T, panneaux dépareillés */
 t(E,a,b,r){const n=Math.max(1,Math.round((b-a)/1.55)),w=(b-a)/n;E.box(a,b,0,.46,.03,1.2,'conc');for(let i=0;i<n;i++){const u=a+i*w,h=3.45+((i*7)%5)*.09,d=(i%2)*.05;E.cbox(u+.015,u+w-.015,0,h,.1+d,.34+d,'conc',.04);for(const s of[.32,.68]){const q=u+w*s;E.box(q-.05,q+.05,h,h+.09,.19+d,.25+d,'steel')}if(i%3===1)E.box(u+.2,u+w-.2,1.0,1.26,.09+d,.1+d,'pipeY')}},
 /* jersey + grillage bas derrière */
 j(E,a,b,r,o){const n=Math.max(1,Math.round((b-a)/3)),w=(b-a)/n;for(let i=0;i<n;i++){const u=a+i*w,dv=(i%2)*.05;E.cbox(u+.015,u+w-.015,0,.28,.03+dv,.68+dv,'conc',.05);E.cbox(u+.015,u+w-.015,.28,1.05,.13+dv,.55+dv,'conc',.06);if(i%2)E.box(u+.15,u+w-.15,.86,1.02,.12+dv,.13+dv,'pipeY')}if(!o.jBare)fenceRun(E,a,b,.86,2.7)},
 /* sacs de sable en quinconce, grillage derrière */
 b(E,a,b,r){E.cbox(a,b,0,.42,.03,.86,'sandbag',.09);E.cbox(a+.1,b-.1,.42,.84,.06,.76,'sandbag',.09);E.cbox(a+.22,b-.22,.84,1.22,.12,.66,'sandbag',.1);fenceRun(E,a,b,.92,2.8)},
 /* brique / pierre : couronnement cassé par tronçons */
 B(E,a,b,r,o){masonry(E,a,b,o.bh||3.7,'brick',r,'conc')},
 s(E,a,b,r,o){masonry(E,a,b,o.bh||4.2,'stone',r,'conc')},
 C(E,a,b,r,o){masonry(E,a,b,o.bh||3.4,o.cm||'conc',r,'steel',1)},
 /* pierre sèche basse, piquets et fil de ferme */
 d(E,a,b,r){const n=Math.max(1,Math.round((b-a)/1.4));for(let i=0;i<n;i++){const u0=lerp(a,b,i/n),u1=lerp(a,b,(i+1)/n),h=1.05+r()*.4;E.box(u0,u1,0,h,.04+(i%2)*.04,.62,'stone');E.box(u0+.04,u1-.04,h,h+.09,.08,.56,'rock')}const P=E.prop(a,.74),L=b-a,m=Math.max(1,Math.round(L/3));for(let i=0;i<=m;i++)P.c(L*i/m,1.05,0,.06,2.1,'woodD','y',6);for(const y of[1.55,1.85])P.b(0,L,y,y+.016,-.008,.008,'rubber')},
 /* palissade de rondins */
 p(E,a,b,r,o){const n=Math.max(2,Math.round((b-a)/.37)),w=(b-a)/n,P=E.prop(a,.25),sn=o.snow;for(let i=0;i<n;i++){const h=3.5+r()*.9,l=(i+.5)*w,rr=.17+r()*.03;P.c(l,h/2,(i%2)*.04,rr,h,i%3?'woodD':'wood','y',6);P.c(l,h+.14,(i%2)*.04,rr,.28,i%3?'woodD':'wood','y',5,.02);if(sn&&i%2)P.c(l,h+.09,(i%2)*.04,rr*1.02,.14,'snow','y',6,rr*.45)}for(const y of[1.1,2.7])P.b(0,b-a,y,y+.16,-.27,-.2,'wood');if(sn)E.box(a,b,0,.32,.03,.6,'snow')},
 /* éboulis */
 r(E,a,b,r2,o){const m=o.rockM||'rock',n=Math.max(2,Math.round((b-a)/3.1));for(let i=0;i<n;i++){const u=lerp(a,b,(i+.5)/n),h=1.6+r2()*2.4,s=1.25+r2()*.9;E.rock(u,s*1.45+.1,h,s*1.05,s,m,r2);if(i%3===1)E.rock(u+.6,.98,.58,.62,.5,m,r2)}E.box(a,b,0,.5,.05,1.4,m)},
 /* boutique, rideau métallique à demi baissé, grille derrière */
 S(E,a,b,r,o){const h=o.sh||5.4,L=b-a,n=Math.max(1,Math.round(L/4.2)),w=L/n,m=o.shop||'plaster';for(let i=0;i<n;i++){const u=a+i*w;E.box(u,u+.34,0,h,.05,.6,m);E.box(u+w-.34,u+w,0,h,.05,.6,m);E.box(u,u+w,2.85,h,.05,.6,m);E.box(u,u+w,2.82,2.95,.03,.08,'steel');E.box(u+.34,u+w-.34,0,.32,.05,.6,'conc');const dn=[1.15,.82,1.4,.95][(i+Math.floor(r()*2))%4];{let q=0;for(let y=dn;y<2.82;y+=.15,q++)E.box(u+.34,u+w-.34,y,y+.135,.28,.31,q%2?'steel':'frame')}E.box(u+.34,u+w-.34,dn-.06,dn,.26,.33,'steel');E.quad(u+.34,u+w-.34,.32,dn,.22);E.box(u+.34,u+w-.34,0,2.85,1.05,1.1,'ceil');E.box(u+.34,u+w-.34,.32,.9,.62,1.04,'crate');if(i%2)E.box(u+.1,u+w-.1,3.0,3.5,.015,.04,'woodD');else E.box(u+.5,u+w-.5,3.05,3.4,.015,.04,'plate')}E.box(a-.03,b+.03,h,h+.16,.02,.66,'stone')},
 /* échafaudage devant un mur */
 x(E,a,b,r,o){masonry(E,a,b,o.xh||5.2,o.xm||'plaster',r,'stone');const L=b-a,n=Math.max(1,Math.round(L/2.4)),P=E.prop(a,.06);/* pieds et lisses restent derrière la ligne, à l'aplomb du mur */for(let i=0;i<=n;i++){const l=L*i/n;P.c(l,3.2,.46,.04,6.4,'steel','y',6);P.c(l,3.2,1.2,.04,6.4,'steel','y',6)}for(const y of[1.05,2.75,4.45,6.1]){P.c(L/2,y,.46,.03,L,'steel','l',5);P.c(L/2,y,1.2,.03,L,'steel','l',5);if(y<6)P.b(0,L,y+.03,y+.08,.42,1.24,'wood')}for(let i=0;i<n;i++){const l=L*(i+.5)/n;P.b(l-.02,l+.02,1.05,2.75,.44,.48,'steel')}},
 /* faisceau de tuyaux sur portiques */
 P(E,a,b,r){const L=b-a,Pq=E.prop(a,.8),n=Math.max(1,Math.round(L/4));E.box(a,b,0,.3,.06,1.6,'conc');for(let i=0;i<=n;i++){const l=L*i/n;Pq.b(l-.09,l+.09,0,3.5,-.68,-.54,'steel');Pq.b(l-.09,l+.09,0,3.5,.5,.64,'steel');for(const y of[1.1,2.3,3.45])Pq.b(l-.07,l+.07,y-.07,y+.07,-.68,.64,'steel')}for(const[y,w,R,m]of[[1.45,-.34,.32,'pipeY'],[1.42,.3,.28,'tank'],[2.64,-.36,.3,'pipeR'],[2.62,.28,.3,'tank'],[3.74,0,.26,'pipeY']])Pq.c(L/2,y,w,R,L,m,'l',10)},
 /* conteneurs empilés */
 K(E,a,b,r){let u=a;for(let i=0;u<b-1;i++){const c=(i+Math.floor(r()*3))%4;u=contAt(E,u,b,.04,0,c,r)}},
 /* poste de garde derrière le grillage */
 Q(E,a,b,r,o){fenceRun(E,a,b,.08,o.fh||3.1);const L=b-a,P=E.prop(a+L/2,2.1);P.b(-1.5,1.5,0,.24,-1.5,1.5,'conc');P.b(-1.4,1.4,.24,1.05,-1.4,1.4,'plasterB');for(const[l,w]of[[-1.34,-1.34],[1.34,-1.34],[-1.34,1.34],[1.34,1.34]])P.b(l-.06,l+.06,1.05,2.5,w-.06,w+.06,'steel');P.b(-1.3,1.3,1.1,2.42,-1.3,-1.29,'glass');P.b(-1.3,-1.29,1.1,2.42,-1.3,1.3,'glass');P.b(1.29,1.3,1.1,2.42,-1.3,1.3,'glass');P.b(-1.62,1.62,2.5,2.66,-1.62,1.62,'corr');P.b(-1.7,1.7,2.66,2.74,-1.7,1.7,'steel');P.b(.7,1.1,2.74,3.3,-.2,.2,'steel');for(const s of[-1,1])P.b(s*1.3-.05,s*1.3+.05,0,1.05,-1.46,-1.4,'pipeY');signAt(E,lerp(a,b,.18),1.65,.055,1)},
};
const contAt=(E,u,b,v,y,c,r)=>{const L=6.1,Wd=2.44,H=2.6,n=1+Math.floor(r()*2.6),P=E.prop(Math.min(u,b-L)+L/2,v+Wd/2);for(let i=0;i<n;i++){const d=(i%2)*.1;P.b(-L/2+d,L/2+d,y+i*H,y+(i+1)*H,-Wd/2,Wd/2,'cont'+((c+i)%4));for(const q of[-L/2+.05,L/2-.05])P.b(q+d-.05,q+d+.05,y+i*H,y+(i+1)*H,Wd/2-.02,Wd/2+.015,'steel')}return Math.min(u,b-L)+L+.08};
function masonry(E,a,b,h,m,r,cap,flat){const n=Math.max(1,Math.round((b-a)/1.6)),w=(b-a)/n;E.box(a,b,0,.34,.02,.5,cap==='steel'?'conc':'stone');for(let i=0;i<n;i++){const u=a+i*w,hh=flat?h+(i%2)*.12:h-Math.abs(Math.sin(i*2.3+a))*(.2+r()*.7);E.box(u,u+w,0,hh,.07,.44,m);if(flat||hh>h-.4)E.cbox(u-.02,u+w+.02,hh,hh+.12,.04,.48,cap,.035);else{E.box(u+.2,u+w-.3,hh,hh+.22,.09,.4,m);E.rubble(u+w/2,.7,r)}}}
/* Portail double à demi fermé : un battant rentre vers le joueur (collision en marches sous le battant), l'autre part vers l'extérieur, angles différents.
   L'écart, large de deux mains, est barré par une grosse chaîne passée autour des deux montants, avec cadenas. */
function gate(E,a,b,o={}){const st=o.style||'mesh',pm=o.post||'conc',ph=o.ph||3.5,leafH=o.lh||2.75,k=E.k,gap=.2,hA=a+.24,hB=b-.24,hv=.08,inw=E.clear(a,b,-.72,0),TA=inw?-.23:.27,TB=.11,L=(hB-hA-gap)/(Math.cos(TA)+Math.cos(TB));
 for(const[u,s]of[[a,1],[b,-1]]){E.cbox(Math.min(u,u+s*.24),Math.max(u,u+s*.24),0,ph,.02,.46,pm,.04);E.cbox(Math.min(u,u+s*.24)-.03,Math.max(u,u+s*.24)+.03,ph,ph+.1,.02,.5,pm==='conc'?'conc':'steel',.035);E.box(Math.min(u,u+s*.2),Math.max(u,u+s*.2),1.05,1.28,.015,.025,'pipeY')}
 const leaf=(P,len)=>{const f=.07;P.b(0,f,.08,leafH,-.04,.04,'frame');P.b(len-f,len,.08,leafH,-.04,.04,'frame');P.b(0,len,.08,.15,-.04,.04,'frame');P.b(0,len,leafH-.07,leafH,-.04,.04,'frame');P.b(0,len,1.24,1.3,-.035,.035,'frame');
  if(st==='mesh')E.quadP(P,f,len-f,.15,leafH-.07,0);
  else if(st==='wood'){const n=Math.round(len/.17);for(let i=0;i<n;i++){const q=lerp(f,len-f,i/n);P.b(q,q+(len-2*f)/n+.002,.15,leafH-.07,-.022,.022,i%3?'wood':'woodD')}P.b(f,len-f,.5,.62,.022,.05,'woodD');P.b(f,len-f,1.9,2.02,.022,.05,'woodD')}
  else if(st==='iron'){const n=Math.round(len/.16);for(let i=0;i<=n;i++){const q=lerp(f,len-f,i/n);P.c(q,(leafH+.15)/2,0,.016,leafH-.15,'frame','y',5);P.c(q,leafH+.1,0,.024,.14,'frame','y',4,.005)}P.b(f,len-f,.5,.55,-.025,.025,'frame');P.b(f,len-f,2.05,2.1,-.025,.025,'frame')}
  else{P.b(f,len-f,.15,leafH-.07,-.015,.015,o.plate||'rust');const n=Math.round(len/.55);for(let i=1;i<n;i++){const q=lerp(f,len-f,i/n);P.b(q-.018,q+.018,.15,leafH-.07,-.03,.03,'frame')}}
  for(const y of[.45,leafH-.4])P.b(-.02,.2,y-.05,y+.05,-.05,.05,'steel')};
 const A=E.prop(hA,hv,TA),B=E.prop(hB,hv,Math.PI-TB);leaf(A,L);leaf(B,L);
 const ua=hA+L*Math.cos(TA),va=hv+L*Math.sin(TA),ub=hB-L*Math.cos(TB),vb=hv+L*Math.sin(TB);
 /* collision : marches qui suivent le battant rentrant, puis l'écart barré par la chaîne */
 if(inw){const n=Math.ceil((ua-hA)/.3);for(let i=0;i<n;i++){const u0=lerp(hA,ua,i/n),u1=lerp(hA,ua,(i+1)/n),f=Math.min(hv+(u0-hA)*Math.tan(TA),hv+(u1-hA)*Math.tan(TA))-.05;if(f<-.005)E.solid(u0,u1,0,leafH,f,0,'metal')}E.solid(ua,ub,0,leafH,va-.05,0,'metal')}
 /* chaîne : maillons alternés, deux brins, boucle autour de chaque montant */
 const tA=[A.X(L-.035,0),A.Z(L-.035,0)],tB=[B.X(L-.035,0),B.Z(L-.035,0)],du=tB[0]-tA[0],dz=tB[1]-tA[1],dist=Math.hypot(du,dz),ry=Math.atan2(-dz,du),cr=Math.cos(ry),sr=Math.sin(ry),link=(x,y,z,flat,yaw=ry)=>k.ops.push({t:'r',x,y,z,w:.105,h:flat?.026:.058,d:flat?.058:.026,m:'chain',ry:yaw});
 const ring=(q,y,yaw)=>{const c=Math.cos(yaw),n=Math.sin(yaw);for(const e of[-1,1]){k.ops.push({t:'r',x:q[0]+n*e*.075,y,z:q[1]+c*e*.075,w:.2,h:.05,d:.028,m:'chain',ry:yaw});k.ops.push({t:'r',x:q[0]+c*e*.09,y,z:q[1]-n*e*.09,w:.028,h:.05,d:.17,m:'chain',ry:yaw})}};
 for(const[y,sg]of[[1.08,.07],[1.24,.05]]){const n=Math.max(5,Math.round(dist/.082));for(let i=0;i<=n;i++){const t=i/n,sag=Math.sin(t*Math.PI)*sg;link(tA[0]+du*t,y-sag-.02,tA[1]+dz*t,i&1)}ring(tA,y-.02,A.ry);ring(tB,y-.02,B.ry)}
 /* cadenas côté joueur, bout de chaîne pendant */
 const cx=tA[0]+du*.5,cz=tA[1]+dz*.5,nx=E.d[2],nz=E.d[3],px=cx-nx*.05,pz=cz-nz*.05,py=.76;k.ops.push({t:'r',x:px,y:py,z:pz,w:.17,h:.15,d:.08,m:'pipeY',ry});k.ops.push({t:'r',x:px-nx*.042,y:py+.045,z:pz-nz*.042,w:.024,h:.05,d:.012,m:'rubber',ry});for(const e of[-1,1])k.ops.push({t:'r',x:px+cr*e*.058,y:py+.15,z:pz-sr*e*.058,w:.03,h:.11,d:.03,m:'chain',ry});k.ops.push({t:'r',x:px,y:py+.255,z:pz,w:.146,h:.03,d:.03,m:'chain',ry});for(let i=0;i<5;i++)link(px+cr*.11,.7-i*.075,pz-sr*.11,i&1,ry+Math.PI/2);
 signAt(E,a+.13,2.1,.015,o.sign||0);if(o.road)E.box(a+.3,b-.3,.0,.028,.0,6.5,o.road)}
class Edge{
 constructor(k,side,T,r){this.k=k;this.side=side;this.S=k.size;this.d=EDGE_D[side];this.T=T;this.r=r}
 x(u,v){return this.d[0]*u+this.d[2]*(this.S+v)}
 z(u,v){return this.d[1]*u+this.d[3]*(this.S+v)}
 box(a,b,y0,y1,v0,v1,m){const x0=this.x(a,v0),x1=this.x(b,v1),z0=this.z(a,v0),z1=this.z(b,v1);this.k.vis(Math.min(x0,x1),Math.max(x0,x1),y0,y1,Math.min(z0,z1),Math.max(z0,z1),m)}
 cbox(a,b,y0,y1,v0,v1,m,c=.05){const x0=this.x(a,v0),x1=this.x(b,v1),z0=this.z(a,v0),z1=this.z(b,v1);this.k.ops.push({t:'v',x0:Math.min(x0,x1),x1:Math.max(x0,x1),y0,y1,z0:Math.min(z0,z1),z1:Math.max(z0,z1),m,c})}
 prop(u,v,a=0){return new Prop(this,u,v,a)}
 quad(a,b,y0,y1,v){const P=this.prop(a,v);this.quadP(P,0,b-a,y0,y1,0)}
 quadP(P,l0,l1,y0,y1,w){const l=(l0+l1)/2;this.k.ops.push({t:'q',x:P.X(l,w),y:y0,z:P.Z(l,w),w:l1-l0,h:y1-y0,ry:P.ry,m:'fence'})}
 rock(u,v,h,sx,sz,m,r){this.k.ops.push({t:'k',x:this.x(u,v),y:h*.42,z:this.z(u,v),sx,sy:h*.62,sz,m,v:Math.floor(r()*4),ry:r()*6.28})}
 rubble(u,v,r){const s=.09+r()*.14;this.k.inst.push({k:'rubble',x:this.x(u+(r()-.5)*.8,v+r()*.3),y:0,z:this.z(u+(r()-.5)*.8,v+r()*.3),s,ry:r()*6})}
 solid(a,b,y0,y1,v0,v1,surface='metal'){const x0=this.x(a,v0),x1=this.x(b,v1),z0=this.z(a,v0),z1=this.z(b,v1),c=this.k.col(Math.min(x0,x1),Math.max(x0,x1),y0,y1,Math.min(z0,z1),Math.max(z0,z1),surface);c.bd=1;return c}
 /* la tranche u=a..b, v=v0..v1 est-elle libre (marge de passage, apparitions), hors décor du contour ? */
 clear(a,b,v0,v1,M=1.5){const k=this.k,x0=Math.min(this.x(a,v0),this.x(b,v1)),x1=Math.max(this.x(a,v0),this.x(b,v1)),z0=Math.min(this.z(a,v0),this.z(b,v1)),z1=Math.max(this.z(a,v0),this.z(b,v1));return k.solids.every(s=>s.bd||(s.y1-s.y0>=17&&s.y0===0)||x1+M<=s.x0||x0-M>=s.x1||z1+M<=s.z0||z0-M>=s.z1)&&k.spawns.every(([x,z])=>x<x0-1.3||x>x1+1.3||z<z0-1.3||z>z1+1.3)}
 /* pilier : seul élément dans l'aire de jeu, posé seulement si le passage reste large */
 pillar(u,h,m){const k=this.k,x0=Math.min(this.x(u-.26,-.32),this.x(u+.26,.02)),x1=Math.max(this.x(u-.26,-.32),this.x(u+.26,.02)),z0=Math.min(this.z(u-.26,-.32),this.z(u+.26,.02)),z1=Math.max(this.z(u-.26,-.32),this.z(u+.26,.02)),M=1.5;
  const ok=k.solids.every(s=>s.bd||(s.y1-s.y0>=17&&s.y0===0)||x1+M<=s.x0||x0-M>=s.x1||z1+M<=s.z0||z0-M>=s.z1)&&k.spawns.every(([x,z])=>x<x0-1.3||x>x1+1.3||z<z0-1.3||z>z1+1.3)&&Math.abs(u)<this.S-2;
  if(ok){k.ops.push({t:'v',x0,x1,y0:0,y1:h,z0,z1,m,c:.05});k.col(x0,x1,0,h,z0,z1,SURF[m]||'concrete').bd=1;this.cbox(u-.3,u+.3,h,h+.1,-.32,.05,m,.035)}else this.cbox(u-.26,u+.26,0,h,.02,.5,m,.05)}
}
function dress(k,T,seed){const S=k.size,r=rng(seed),n0=k.ops.length,m0=k.inst.length;
 /* corniches sans écart aux quatre coins */
 for(const[sx,sz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){const a=sx<0?-S-2.6:S+.02,b=a+2.58,c=sz<0?-S-2.6:S+.02,d=c+2.58;k.vis(a,b,0,T.cornerH||5,c,d,T.corner||'conc');k.vis(a-.08,b+.08,T.cornerH||5,(T.cornerH||5)+.16,c-.08,d+.08,'steel')}
 for(const side of['n','e','s','w']){const E=new Edge(k,side,T,r),spec=T.edges[side];if(!spec)continue;
  /* bande de sol derrière la limite : recouvre la jonction entre sol cuit et sol lointain */
  if(!T.interior)E.box(-S-3,S+3,-.04,.012,.0,T.roadW||7,T.road||'g_'+k.env);
  const toks=spec.trim().split(/\s+/).map(t=>{const q=/^([A-Za-z]+?)(\d+(?:\.\d+)?)?(?:@(-?\d+(?:\.\d+)?))?$/.exec(t);if(!q)throw new Error('bord: '+t);return{n:q[1],l:q[2]?+q[2]:0,at:q[3]===undefined?null:+q[3]}});
  const vn=t=>T.alias?.[t.n]||t.n,fixW=t=>VEH[vn(t)]?VEH[vn(t)].L+.14:t.n[0]==='G'?(t.l||5.2):0;let u=-S;
  const place=(t,sc)=>{const nm=vn(t);if(VEH[nm]){const d=VEH[nm],o=T.opt?.[t.n]||T.opt?.[nm];placeVehicle(E,nm,u+d.L/2+.07,d.W/2+.03,0,o);if(T.under)E.box(u,u+d.L+.14,0,.2,.03,.24,T.under);u+=d.L+.14}
   else if(t.n[0]==='G'){const w=t.l||5.2,st={m:'mesh',s:'steel',w:'wood',i:'iron'}[t.n[1]]||'mesh';gate(E,u,u+w,{style:st,post:T.gatePost||'conc',ph:T.gateH||3.5,lh:T.leafH||2.75,road:T.gateRoad,sign:Math.floor(r()*3)});u+=w}
   else{const f=BM[t.n];if(!f)throw new Error('pièce inconnue '+t.n);const L=t.l*sc;f(E,u,u+L,r,T);u+=L;if(u<S-1&&T.pillar)E.pillar(u,T.pillarH||4.1,T.pillar)}};
  for(let i=0;i<toks.length;){let j=i;while(j<toks.length&&toks[j].at===null)j++;const end=j<toks.length?toks[j].at-fixW(toks[j])/2:S,seg=toks.slice(i,j),fx=seg.reduce((q,t)=>q+fixW(t),0),fl=seg.reduce((q,t)=>q+(fixW(t)?0:t.l),0),sc=(end-u-fx)/(fl||1);for(const t of seg)place(t,sc);if(j<toks.length)place(toks[j],1);i=j+1}
  if(T.band)T.band(E,r)}
 /* un lot par matériau et par bord (frustum culling) ; ns : hors du cadrage du soleil */
 for(let i=n0;i<k.ops.length;i++){const o=k.ops[i],cx=o.x0!==undefined?(o.x0+o.x1)/2:o.x,cz=o.x0!==undefined?(o.z0+o.z1)/2:o.z,ax=Math.abs(cx),az=Math.abs(cz);o.bq='b_a';const over=Math.max(ax,az)-S,sz=o.x0!==undefined?Math.min(o.x1-o.x0,o.z1-o.z0):o.t==='r'?Math.min(o.w,o.d):o.t==='c'?o.r*2:9;o.ns=o.t==='q'||over>3.4||sz<.13||(o.x0!==undefined&&o.y1<.1)}
}
/* Bunker : la limite (±40) est dans la roche ; le mur que le joueur touche est celui de l'anneau de service (±38, plafond 2.4). On l'habille en relief, chaque saillie a sa collision. */
function dressBunker(k,seed){const r=rng(seed),n0=k.ops.length,Y=2.4,solid=(E,a,b,y0,y1,v0,v1)=>{const x0=E.x(a,v0),x1=E.x(b,v1),z0=E.z(a,v0),z1=E.z(b,v1);k.col(Math.min(x0,x1),Math.max(x0,x1),y0,y1,Math.min(z0,z1),Math.max(z0,z1),'metal')},hit=(E,a,b,y0,y1,v0,v1,m)=>{const x0=E.x(a,v0),x1=E.x(b,v1),z0=E.z(a,v0),z1=E.z(b,v1);k.box(Math.min(x0,x1),Math.max(x0,x1),y0,y1,Math.min(z0,z1),Math.max(z0,z1),m)},
 free=(E,a,b,v0,v1)=>{const x0=Math.min(E.x(a,v0),E.x(b,v1)),x1=Math.max(E.x(a,v0),E.x(b,v1)),z0=Math.min(E.z(a,v0),E.z(b,v1)),z1=Math.max(E.z(a,v0),E.z(b,v1));return k.solids.every(s=>s.y0>1.9||s.y1<.05||x1<=s.x0||x0>=s.x1||z1<=s.z0||z0>=s.z1)&&k.spawns.every(([x,z])=>x<x0-1.2||x>x1+1.2||z<z0-1.2||z>z1+1.2)},
 MOD={
  /* panneaux, boîtiers, conduits */
  p(E,a,b){const n=Math.max(1,Math.round((b-a)/1.25));for(let i=0;i<=n;i++){const u=lerp(a,b,i/n);E.box(u-.04,u+.04,0,Y,-.035,-.002,'frame')}for(let i=0;i<n;i++){const u=lerp(a,b,(i+.5)/n);if(i%3===0){E.box(u-.2,u+.2,1.0,1.5,-.018,-.002,'panel');E.box(u-.05,u+.05,1.55,1.86,-.03,-.002,'steel')}else if(i%3===1)for(const q of[-.14,0,.14])E.box(u+q-.012,u+q+.012,.05,1.86,-.028,-.002,q?'steel':'pipeY')}E.box(a,b,0,.14,-.05,-.002,'plate')},
  /* grilles de ventilation sur fond sombre */
  g(E,a,b){const n=Math.max(1,Math.round((b-a)/1.7));for(let i=0;i<n;i++){const u0=lerp(a,b,i/n)+.08,u1=lerp(a,b,(i+1)/n)-.08;E.box(u0,u1,.32,1.74,-.012,-.002,'hull');for(let y=.4;y<1.68;y+=.16)E.box(u0+.02,u1-.02,y,y+.075,-.045,-.012,'steel');E.box(u0-.05,u1+.05,.27,.32,-.05,-.002,'steel');E.box(u0-.05,u1+.05,1.74,1.79,-.05,-.002,'steel');E.box(u0-.05,u0,.32,1.74,-.05,-.002,'steel');E.box(u1,u1+.05,.32,1.74,-.05,-.002,'steel')}E.box(a,b,0,.14,-.05,-.002,'plate')},
  /* porte blindée entrouverte, chaînée (fente sombre d'une main) */
  D(E,a,b){const W=b-a,h=2.28,c=(a+b)/2,gap=.07;solid(E,a,b,0,Y,-.21,0);solid(E,a+.3,b-.3,0,h,-.32,-.21);E.box(a,b,0,Y,-.13,-.002,'bwall');E.box(a+.28,b-.28,.02,h-.06,-.137,-.13,'hull');for(const[u0,u1,dv]of[[a+.3,c-gap,0],[c+gap,b-.3,.05]]){E.box(u0,u1,.03,h-.08,-.205-dv,-.13,'plate');const nr=3;for(let i=1;i<nr;i++){const q=lerp(u0,u1,i/nr);E.box(q-.035,q+.035,.05,h-.1,-.222-dv,-.2-dv,'steel')}E.box(u0+.04,u1-.04,.86,1.06,-.214-dv,-.2-dv,'pipeY');hazard(E,u0+.03,u1-.03,.05,-.222-dv,.17)}E.box(a,a+.28,0,Y,-.2,-.002,'frame');E.box(b-.28,b,0,Y,-.2,-.002,'frame');E.box(a,b,h,Y,-.2,-.002,'frame');hazard(E,a+.28,b-.28,h-.06,-.205,.05);
   const n=Math.round(1.1/.055);for(const y0 of[1.2,1.3])for(let i=0;i<n;i++){const u=lerp(c-.55,c+.55,i/(n-1)),sag=Math.cos((u-c)/.55*1.57)*.04;E.box(u-.038,u+.038,y0-sag-(i&1?.012:.027),y0-sag+(i&1?.012:.027),-.3,i&1?-.27:-.262,'chain')}E.box(c-.085,c+.085,.86,1.01,-.305,-.232,'pipeY');E.box(c-.012,c+.012,.91,.96,-.31,-.3,'rubber');for(const q of[-.058,.058])E.box(c+q-.015,c+q+.015,1.01,1.12,-.285,-.255,'chain');E.box(c-.073,c+.073,1.12,1.15,-.285,-.255,'chain')},
  /* section effondrée : blocs et ferraillage contre le mur */
  c(E,a,b){const n=Math.max(2,Math.round((b-a)/.9));for(let i=0;i<n;i++){const u0=lerp(a,b,i/n),u1=lerp(a,b,(i+1)/n),t=Math.sin((i+.5)/n*Math.PI),h=.28+t*(.45+r()*.3),d=.3+t*.5;hit(E,u0,u1,0,h,-d,0,i%3?'conc':'ceil');if(i%2){hit(E,u0+.08,u1-.08,h,h+.16,-d*.55,0,'conc');for(const q of[.25,.6])E.prop(lerp(u0,u1,q),-d*.5).c(0,h+.3,0,.012,.5,'rust','y',4)}E.rubble((u0+u1)/2,-d-.15,r)}E.box(a,b,.9,Y,-.015,-.002,'hull');for(let i=0;i<5;i++){const u=lerp(a+.3,b-.3,i/4);E.box(u-.012,u+.012,.9+r()*.3,Y,-.02,-.004,'frame')}},
  /* chariot de maintenance garé contre le mur */
  v(E,a,b){const w=VEH.cart.W,u=(a+b)/2;MOD.p(E,a,b);if(!free(E,u-1.5,u+1.5,-w-1.05,-.02))return;placeVehicle(E,'cart',u,-w/2-.05,0,{m:r()<.5?'pipeY':'paint',collider:1})},
 };
 for(const side of['n','e','s','w']){const E=new Edge(k,side,{},r);E.S=38;const toks={n:'p6 D5 g6 c5 p4 v5 g5 D5 p5 c4 g6 p5 v5 g5',e:'g5 p5 c5 D5 p6 v5 g5 p4 c5 D5 g6 p5 v5 p5',s:'c5 p5 g6 v5 D5 p5 g5 c4 p6 D5 g5 v5 p5 c4',w:'p5 g5 D5 c5 v5 p6 g5 D5 p4 c5 g6 v5 p5 g5'}[side].split(' ').map(t=>[t[0],+t.slice(1)]),tot=toks.reduce((a,t)=>a+t[1],0),sc=74/tot;let u=-37;for(const[n,l]of toks){MOD[n](E,u,u+l*sc);u+=l*sc}
  /* tuyaux et chemin de câbles sous le plafond */
  const P=E.prop(-37,-.13);for(const[y,w,R,m]of[[2.2,.0,.075,'pipeY'],[2.2,-.07,.05,'pipeR']])P.c(37,y,w,R,74,m,'l',7);P.b(0,74,1.98,2.02,-.13,.13,'steel');for(let i=0;i<=30;i++)P.b(i*74/30-.02,i*74/30+.02,1.98,Y,-.13,.13,'frame');for(let i=0;i<4;i++)P.b(0,74,2.02+i*.012,2.03+i*.012,-.1+i*.05,-.08+i*.05,i%2?'rubber':'pipeR');solid(E,-37,37,1.96,Y,-.27,0)}
 for(let i=n0;i<k.ops.length;i++){const o=k.ops[i],cx=o.x0!==undefined?(o.x0+o.x1)/2:o.x,cz=o.x0!==undefined?(o.z0+o.z1)/2:o.z,ax=Math.abs(cx),az=Math.abs(cz);o.bq='b_a';const sz=o.x0!==undefined?Math.min(o.x1-o.x0,o.z1-o.z0):o.t==='r'?Math.min(o.w,o.d):o.t==='c'?o.r*2:9;o.ns=o.t==='q'||sz<.13}}
/* décor de fond partagé */
const BG={
 pine(E,u,v,s,r){E.k.inst.push({k:'pine',x:E.x(u,v),y:0,z:E.z(u,v),s,ry:r()*6,ns:1})},
 tree(E,u,v,s,r,c='leaf'){const P=E.prop(u,v);P.c(0,1.5*s,0,.16*s,3*s,'woodD','y',6);for(const[y,R,h]of[[2.3,1.6,2.2],[3.6,1.2,1.9],[4.8,.75,1.5]])P.c(0,(y+h/2)*s,0,.02,h*s,c,'y',7,R*s)},
 bush(E,u,v,s,r,c='leaf'){E.k.ops.push({t:'k',x:E.x(u,v),y:s*.4,z:E.z(u,v),sx:s,sy:s*.7,sz:s*(.8+r()*.4),m:c,v:Math.floor(r()*4),ry:r()*6})},
 shed(E,u,v,w,d,h,a,m='corr',rm='rust'){const P=E.prop(u,v,a);P.b(-w/2,w/2,0,h,-d/2,d/2,m);P.roof(-w/2-.2,w/2+.2,h,1,-d/2-.25,d/2+.25,rm);P.b(-w*.2,w*.2,0,Math.min(2.4,h-.2),-d/2-.03,-d/2+.01,'door');for(const s of[-.34,.34])P.b(s*w-.4,s*w+.4,h*.5,h*.5+.6,-d/2-.025,-d/2+.01,'glass')},
 house(E,u,v,w,d,h,a,m='plaster',rm='tile'){const P=E.prop(u,v,a);P.b(-w/2,w/2,0,h,-d/2,d/2,m);P.roof(-w/2-.25,w/2+.25,h,1.7,-d/2-.3,d/2+.3,rm);for(let x=-w/2+1;x<w/2-.8;x+=2)for(let y=1;y<h-1;y+=2.7)P.b(x,x+.9,y,y+1.25,-d/2-.025,-d/2+.01,'glass');P.b(-.6,.6,0,2.2,-d/2-.03,-d/2+.01,'door')},
 pole(E,u,v){const P=E.prop(u,v);P.c(0,3.4,0,.09,6.8,'steel','y',6);P.b(-.7,.7,6.2,6.28,-.03,.03,'steel');for(const s of[-.6,0,.6])P.c(s,6.34,0,.04,.12,'rubber','y',5)},
 pallets(E,u,v,r){const P=E.prop(u,v,r()*.6);const n=2+Math.floor(r()*4);for(let i=0;i<n;i++){P.b(-.6,.6,i*.15,i*.15+.035,-.5,.5,'wood');P.b(-.6,.6,i*.15+.11,i*.15+.145,-.5,.5,'wood');for(const q of[-.42,0,.42])P.b(q-.05,q+.05,i*.15+.035,i*.15+.11,-.5,.5,'woodD')}},
 tyres(E,u,v,r){const P=E.prop(u,v);const n=2+Math.floor(r()*3);for(let i=0;i<n;i++){P.c((r()-.5)*.1,.12+i*.24,(r()-.5)*.1,.42,.22,'rubber','y',12)}},
 drums(E,u,v,r){const P=E.prop(u,v);for(const[a,b]of[[0,0],[.68,.1],[.2,.62]]){P.c(a,.55,b,.32,1.1,r()<.5?'barrel':'rust','y',10);P.c(a,.32,b,.335,.04,'steel','y',10);P.c(a,.8,b,.335,.04,'steel','y',10)}},
 cont(E,u,v,a,n,c){const L=6.1,W=2.44,H=2.6,P=E.prop(u,v,a);for(let i=0;i<n;i++)P.b(-L/2+(i%2)*.15,L/2+(i%2)*.15,i*H,(i+1)*H,-W/2,W/2,'cont'+((c+i)%4))},
};
/* Thèmes de contour. Jetons : lettre + longueur relative (murs), nom de véhicule, G + style (m grillage, s tôle, w bois, i fer) + largeur. */
const genBand=(E,r,A,B,st0=11)=>{const S=E.S,st=st0*1.45;for(let u=-S+5;u<S-4;u+=st+r()*7){const f=A[Math.floor(r()*A.length)];f(E,u,5+r()*4.5,(r()-.5)*.6,r)}for(let u=-S+3;u<S-3;u+=st+2+r()*9){const f=B[Math.floor(r()*B.length)];f(E,u,14+r()*8,(r()-.5)*.5,r)}};
const I={
 truck:(E,u,v,a)=>placeVehicle(E,'truck',u,v,a),cover:(E,u,v,a)=>placeVehicle(E,'truck',u,v,a,{tarp:'tarpR'}),flat:(E,u,v,a)=>placeVehicle(E,'truck',u,v,a,{flat:1}),apc:(E,u,v,a)=>placeVehicle(E,'apc',u,v,a),car:(E,u,v,a)=>placeVehicle(E,'car',u,v,a,{body:'plasterO'}),carB:(E,u,v,a)=>placeVehicle(E,'car',u,v,a,{burnt:1}),van:(E,u,v,a)=>placeVehicle(E,'van',u,v,a),tanker:(E,u,v,a)=>placeVehicle(E,'tanker',u,v,a),lift:(E,u,v,a)=>placeVehicle(E,'forklift',u,v,a),tractor:(E,u,v,a)=>placeVehicle(E,'tractor',u,v,a),logs:(E,u,v,a)=>placeVehicle(E,'logtruck',u,v,a),
 shed:(E,u,v,a)=>BG.shed(E,u,v,7,5,3,a),shedW:(E,u,v,a)=>BG.shed(E,u,v,6,4.5,2.7,a,'woodD','corr'),house:(E,u,v,a,r)=>BG.house(E,u,v,8+r()*3,6,5.4+r()*2.7,a,['plaster','plasterB','plasterO','brick'][Math.floor(r()*4)]),farm:(E,u,v,a)=>BG.house(E,u,v,9,6,3.4,a,'stone','tile'),
 tree:(E,u,v,a,r)=>BG.tree(E,u,v,1+r()*.7,r),treeA:(E,u,v,a,r)=>BG.tree(E,u,v,1+r()*.7,r,r()<.5?'leafA':'leaf'),bush:(E,u,v,a,r)=>BG.bush(E,u,v,.9+r()*.9,r),rock:(E,u,v,a,r)=>E.rock(u,v,2+r()*2.5,1.6+r(),1.5+r(),'rock',r),rockS:(E,u,v,a,r)=>E.rock(u,v,2+r()*3,1.8+r(),1.6+r(),'rockS',r),
 pine:(E,u,v,a,r)=>BG.pine(E,u,v,.8+r()*.7,r),hay:(E,u,v,a,r)=>{const P=E.prop(u,v,a);P.c(0,.75,0,.75,1.5,'crate','l',10);P.c(1.7,.75,.2,.75,1.5,'crate','l',10)},tankF:(E,u,v,a,r)=>{const P=E.prop(u,v),R=3+r()*2,h=5+r()*3;P.c(0,h/2,0,R,h,'tank','y',12);P.c(0,h+.2,0,R+.06,.4,'steel','y',12);P.c(0,h+.5,0,.3,.6,'tank','y',8,R*.98)},pipeF:(E,u,v,a)=>{const P=E.prop(u,v,a);for(const l of[-4,0,4])P.b(l-.1,l+.1,0,3.2,-.7,.7,'steel');P.c(0,3,-.35,.32,10,'pipeY','l',8);P.c(0,3,.35,.28,10,'pipeR','l',8)},wagonF:(E,u,v,a)=>placeVehicle(E,'wagon',u,v,a),wagonT:(E,u,v,a)=>placeVehicle(E,'wagon',u,v,a,{tank:1}),
 pole:(E,u,v)=>BG.pole(E,u,v),pallets:(E,u,v,a,r)=>BG.pallets(E,u,v,r),tyres:(E,u,v,a,r)=>BG.tyres(E,u,v,r),drums:(E,u,v,a,r)=>BG.drums(E,u,v,r),cont1:(E,u,v,a,r)=>BG.cont(E,u,v,a,1,Math.floor(r()*4)),cont2:(E,u,v,a,r)=>BG.cont(E,u,v,a,2,Math.floor(r()*4)),cont3:(E,u,v,a,r)=>BG.cont(E,u,v,a,3,Math.floor(r()*4)),
};
const BT={
 depot:{surface:'sand',corner:'hesco',cornerH:3.9,pillar:'conc',pillarH:4.1,road:'asph',roadW:6.5,gatePost:'conc',fh:3.1,
  edges:{n:'h7 t6 truck h5 Gm5.4 f7 h6 apc t7 b6 cover h5 f6',e:'t6 h6 cover f8 Gs5.4 h6 t5 truck b6 h7 apc t6',s:'h6 f7 apc t6 h5 Gm5.4 b6 truck t6 h7 f6 cover h5',w:'f6 t6 truck h6 b6 Gs5.4 t7 apc h6 cover f7 t5'},
  opt:{cover:{tarp:'tarpR'}},alias:{cover:'truck'},band:(E,r)=>genBand(E,r,[I.truck,I.cover,I.apc,I.flat,I.pallets,I.drums,I.tyres,I.cont1],[I.shed,I.shed,I.cont2,I.pole,I.truck,I.bush])},
 'vieille-ville':{surface:'concrete',corner:'stone',cornerH:6.2,pillar:'stone',pillarH:5.2,road:'asph',roadW:6,gateRoad:'conc',gatePost:'stone',gateH:3.9,leafH:3.1,shop:'plasterO',bh:4.4,xh:5.6,xm:'plaster',
  edges:{n:'s6 S8 bus Gi5 B6 x7 carB s5 S8 B5',e:'B6 Gi5 s6 S8 carB x7 B5 bus s6',s:'x7 s5 carB S8 Gi5 B6 bus s6 S8',w:'S8 B5 bus s7 x7 Gi5 B6 carB s6'},
  opt:{bus:{burnt:1},carB:{burnt:1}},alias:{carB:'car'},band:(E,r)=>genBand(E,r,[I.carB,I.car,I.van,I.drums,I.tyres,I.pallets,I.pole],[I.house,I.house,I.house,I.tree])},
 'sept-vents':{jBare:1,surface:'concrete',corner:'conc',cornerH:4,pillar:'conc',pillarH:3.6,road:'asph',roadW:7,gatePost:'steel',fh:3.3,
  edges:{n:'j8 f8 tanker j7 Gm5.6 t9 fuselage j8 Q6 t8 truck j7 t8 j6',e:'t9 j7 tanker f8 Q6 Gm5.6 j8 truck t9 fuselage j7 t8 j7',s:'j7 truck t9 Q6 Gm5.6 j8 fuselage t9 j7 tanker f8 j8 apc t7',w:'t8 tanker j7 t9 fuselage j8 Gm5.6 Q6 f8 apc j7 t9 j6'},
  band:(E,r)=>genBand(E,r,[I.truck,I.van,I.drums,I.pallets,I.cont1,I.lift],[I.shed,I.cont2,I.pole,I.bush],21)},
 noirval:{surface:'concrete',corner:'conc',cornerH:4.4,pillar:'conc',pillarH:3.9,road:'asph',roadW:7,gatePost:'steel',fh:3.2,
  edges:{n:'w8 P9 wagonT w7 Gs5.6 P8 wagon C7 tanker w8 P9 wagonT C7 w7',e:'P9 w7 wagon C7 Gs5.6 P8 wagonT w8 tanker P9 w7 wagon C7',s:'C7 wagonT P9 w7 tanker Gs5.6 w8 P8 wagon C7 wagonT w8 P7',w:'w8 wagon P9 C7 wagonT w7 Gs5.6 P9 tanker w8 wagonT C7 P7'},
  alias:{wagonT:'wagon'},opt:{wagonT:{tank:1}},band:(E,r)=>genBand(E,r,[I.drums,I.pallets,I.pipeF,I.wagonF,I.cont1],[I.tankF,I.tankF,I.shed,I.pole],20)},
 'val-cendre':{surface:'concrete',corner:'stone',cornerH:2.6,roadW:6,gateRoad:'g_valley',gatePost:'woodD',gateH:2.6,leafH:1.9,rockM:'rock',
  edges:{n:'d9 r7 tractor d8 p7 r8 Gw5@0 d6 logtruck d9 r7 d8 tractor p7 d8',e:'r8 d9 logtruck p7 d8 Gw5 r7 d9 tractor r8 d8 p7 logtruck d7',s:'d9 tractor r7 p8 d9 Gw5 r8 logtruck d8 p7 tractor d9 r7 d7',w:'p7 d9 r8 tractor d8 logtruck Gw5 r7 d9 p8 tractor r7 d8'},
  band:(E,r)=>genBand(E,r,[I.hay,I.tractor,I.bush,I.treeA,I.rock,I.pallets],[I.farm,I.treeA,I.treeA,I.tree,I.rock,I.bush],13)},
 port:{surface:'metal',corner:'conc',cornerH:4,pillar:'conc',pillarH:3.8,road:'asph',roadW:7,gatePost:'steel',fh:3.3,
  edges:{n:'K13 f6 forklift K13 Gm5.6 f6 K13 van f6 K12',e:'f6 K13 forklift t6 Gs5.6 K13 truck f6 K12',w:'K13 f7 truck K13 Gm5.6 t6 forklift K13 f6'},
  band:(E,r)=>genBand(E,r,[I.lift,I.cont1,I.truck,I.pallets,I.drums,I.cont2],[I.cont3,I.cont2,I.shed,I.pole,I.cont3],10)},
 'col-blanc':{surface:'snow',corner:'rockS',cornerH:5,road:'snow',roadW:7,gateRoad:'snow',gatePost:'woodD',gateH:3.5,leafH:2.7,rockM:'rockS',snow:1,
  edges:{n:'r7 p6 Gw5@-4.5 p4 truck@11.5 r5 p6 tracked@40.5 r3',e:'r8 p7 tracked@-26 p9 r7 Gw5@8 r4 truck@24 p6 r6',s:'r9 p6 Gw5@-26 p9 r8 tracked@9 p7 truck@31 r6',w:'r3 Gw5@-48 p9 r8 p7 tracked@1.5 truck@8.5 p9 r8 p6'},
  opt:{tracked:{snow:1},truck:{tarp:'tarp'}},band:(E,r)=>genBand(E,r,[I.pine,I.rockS,I.pine,I.shedW],[I.pine,I.pine,I.rockS,I.shedW],7)},
};

/* ---------- CARTES ---------- */
function mapDepot(){const k=new Kit('desert',52,7007);k.limit('sand');
 // Hangar traversant : grandes portes E/O, portes piétons N/S, mezzanine nord
 const hz=10;k.room(-16,16,-hz,hz,0,7.6,{xn:[D(0,6.5,4.4)],xp:[D(0,6.5,4.4)],zn:[D(-9,3.2,2.8),D(9,3.2,2.8)],zp:[D(-9,3.2,2.8),D(9,3.2,2.8)]},'corr',.4);
 k.box(-16.6,16.6,7.6,8.1,-hz-.6,hz+.6,'rust');for(let x=-14;x<=14;x+=4){k.dbox(x,6.9,0,.25,.5,19.2,'steel');k.dbox(x,8.1,0,.4,.35,21,'steel')}
 for(const x of[-15.2,15.2]){for(const z of[-3.7,3.25])k.box(x-.275,x+.275,0,4.6,z,z+.45,'frame',{surface:'metal'});k.box(x-.275,x+.275,4.4,4.6,-3.25,3.25,'frame',{surface:'metal'})}
 k.slab(-15.6,15.6,6,9.6,3.2,'plate',.25);k.rail(-6.3,6.4,5.93,6,3.2);k.rail(-15.6,-12.6,5.93,6,3.2);k.rail(12.6,15.6,5.93,6,3.2);
 k.stairs(-12.4,5.05,1.8,'x+',0,3.2,'plate');k.stairs(12.4,5.05,1.8,'x-',0,3.2,'plate');
 for(const x of[-11,-6,6,11])k.dbox(x,0,8.8,.2,3,.2,'steel');
 k.truck(-5,-5.5,true,false);k.crate(7,-6.5,1.6);k.crate(8.7,-6.3,1.2);k.crate(7.4,-6.5,1.2,1.2,1.6);k.crate(-9.5,4,1.4);k.crate(9,4.2,1.4);k.crate(10.6,3.5,1.1);
 for(const p of[[13.5,-7.5],[12.7,-8.4],[-13.8,-8]])k.barrel(...p);
 k.light(0,6.8,-3,0xffd9a8,30,24,1);k.light(-10,2.8,7.5,0xffc890,9,12,0);
 for(const x of[-8,8])k.dbox(x,7.1,-3,1.4,.12,.5,'lampW');k.glow(-8,-3,5,'#ffe0a8',.22);k.glow(8,-3,5,'#ffe0a8',.22);
 // Lignes HESCO avec brèches
 for(const[a,b]of[[-44,-30],[-25,-8],[8,25],[30,44]])for(const z of[-25,24])k.box(a,b,0,2.2,z,z+1.1,'hesco');
 // Tranchées en zigzag (murs de sacs)
 k.trench([[-47,-11],[-40,-11],[-40,-3],[-31,-3],[-31,7],[-22,7]],1.45,1.45,'sandbag');
 k.trench([[47,11],[40,11],[40,3],[31,3],[31,-7],[22,-7]],1.45,1.45,'sandbag');
 // Baraquements creux
 k.room(-46,-32,13,21,0,3,{zn:[D(-39)],zp:[D(-42),D(-35)],xn:[D(17)],xp:[D(17)]},'conc');k.box(-46.3,-31.7,3,3.3,12.7,21.3,'corr');
 k.room(32,46,-21,-13,0,3,{zp:[D(39)],zn:[D(35),D(42)],xn:[D(-17)],xp:[D(-17)]},'conc');k.box(31.7,46.3,3,3.3,-21.3,-12.7,'corr');
 k.crate(-44,19.3,1.3);k.crate(44,-19.2,1.3);k.light(-39,2.7,17,0xffb070,6,10,2);k.dbox(-39,2.9,17,.5,.1,.5,'lampA');
 // Poste de commandement (sur sacs) au NE
 k.room(26,38,30,40,0,3.2,{zn:[D(32,2.4)],xn:[D(35)],xp:[D(35)]},'plasterO');k.box(25.7,38.3,3.2,3.45,29.7,40.3,'conc');for(const x of[28,36])k.dbox(x,3.45,35,.06,3.5,.06,'steel');k.dbox(28,6.9,35,1.6,.08,1.6,'frame');
 // Tour de guet (plateforme 5.2 m, escalier)
 const tx0=-44,tx1=-38,tz0=-47.5,tz1=-41.5;for(const[a,b]of[[tx0,tz0],[tx1-.4,tz0],[tx0,tz1-.4],[tx1-.4,tz1-.4]])k.box(a,a+.4,0,5,b,b+.4,'woodD');
 k.slab(tx0,tx1,tz0,tz1,5.2,'wood',.25);k.box(tx0,tx1,5.2,6.2,tz0,tz0+.3,'sandbag');k.box(tx0,tx0+.3,5.2,6.2,tz0+.3,tz1,'sandbag');k.box(tx1-.3,tx1,5.2,6.2,tz0+.3,tz1-.3,'sandbag');k.box(tx0+.3,-42,5.2,6.2,tz1-.3,tz1,'sandbag');
 k.stairs(-41,-32.8,1.8,'z-',0,5.2,'woodD');for(const[a,b]of[[tx0,tz0],[tx1-.2,tz0],[tx0,tz1-.2],[tx1-.2,tz1-.2]])k.dbox(a+.1,6.2,b+.1,.12,1.9,.12,'woodD');k.dbox(-41,8.1,-44.5,6.8,.18,6.8,'corr');
 k.dbox(-41,7.6,-47.2,.5,.3,.4,'lampW');k.light(-41,7.4,-44.5,0xfff0cf,6,12,0);
 // Véhicules, conteneurs, citernes, jerseys
 k.truck(-4,-36,true,true);k.truck(18,36,false,true);k.apc(26,-38,true);k.apc(-26,36,false);
 for(const[x,z,r,y,c]of[[-28,-16,0,0,0],[-28,-16,0,2.6,2],[28,16,0,0,1],[24,-32,1,0,3],[-10,36,0,0,2],[45,32,1,0,0],[45,32,1,2.6,1],[-6,-46,0,0,1]])k.container(x,z,r,y,c);
 for(const[x,z]of[[38,40],[44,40]]){k.dcyl(x,1.6,z,1.7,6.4,'barrel',18,0,Math.PI/2);k.col(x-3.2,x+3.2,0,3.3,z-1.7,z+1.7,'metal');k.box(x-2.8,x-2.2,0,1,z-1.4,z+1.4,'conc');k.box(x+2.2,x+2.8,0,1,z-1.4,z+1.4,'conc')}
 for(const[a,b,c,d]of[[-2,2,-17,-16.3],[-2,2,16.3,17],[-21,-20.3,-2,2],[20.3,21,-2,2],[14,18,44,44.7],[-18,-14,-44.7,-44]])k.jersey(a,b,c,d);
 for(const[a,b,c,d]of[[-10,-6,-21,-20.2],[6,10,20.2,21],[20,24,10,10.8],[-24,-20,-10.8,-10]])k.bags(a,b,c,d);
 for(const p of[[22,10.2],[23,9.4],[-22,-12.1],[-13,24],[13.8,-24.6],[36,-28],[-36,28.6],[-48,40]])k.barrel(...p);
 for(const p of[[-12,-30],[12,30],[34,6],[-34,-6.5],[-6,-28],[6,28],[2,44]])k.crate(...p,1.5);
 // Antennes / radar
 k.dcyl(-6,8.1+1.5,-4,.06,3,'steel',6);k.dcyl(-6,11.4,-4,1.2,.12,'frame',16,.6);k.dcyl(10,8.1+2.4,3,.03,4.8,'steel',5);
 // Peinture au sol : routes, hélisurface
 k.paths.push({pts:[[-52,0],[52,0]],w:7,c:'#4a463e'},{pts:[[0,-52],[0,-10]],w:6,c:'#4a463e'},{pts:[[0,10],[0,52]],w:6,c:'#4a463e'});
 k.paints.push({t:'H',x:-30,z:-36,r:6},{t:'H',x:34,z:-2,r:0});
 for(const[x,z,s,c]of[[80,-60,9,0x35322e],[-90,40,11,0x45413a],[30,95,8,0x2d2b28]])k.fume(x,z,s,c,58);
 k.far(48,70,150,6,24,'far');for(let i=0;i<10;i++){const a=i*.63+1,r=k.rnd(150,190);k.dbox(Math.cos(a)*r,0,Math.sin(a)*r,k.rnd(40,90),k.rnd(14,30),k.rnd(30,60),'farM',a)}
 for(const p of[[44,44],[-44,-30],[44,-44],[-44,46],[0,46],[0,-41],[46,0],[-48,0],[22,22],[-22,-18],[20,-20],[-20,20],[0,-6],[10,0],[-34,-20],[34,22]])k.sp(...p);
 k.scatter(240,'rubble');k.scatter(60,'shrub');dress(k,BT["depot"],9117);return k}

function mapVille(){const k=new Kit('urban',46,4242);k.limit('concrete');const H=(a,b,c,d,o)=>k.house(a,b,c,d,o);
 // rangée nord (z -41..-29), passerelles à z=-35 au premier étage
 H(-41,-29,-41,-29,{m:'plaster',doors:{zp:[-35],xp:[-32]},up:{xp:[-35],zp:[-35]},stair:'zn'});
 H(-26,-14,-41,-31,{m:'plasterB',doors:{zp:[-17,-23],xn:[-33.5]},up:{xn:[-35],xp:[-35]},stair:'zn'});
 H(-11,3,-41,-30,{m:'brick',doors:{zp:[-4],xp:[-32.5]},up:{xn:[-35],xp:[-35]},stair:'zn',roofStair:'zp',gaps:{xp:[-32]}});
 H(6,18,-41,-30,{m:'plasterO',doors:{zp:[12],xn:[-33]},up:{xn:[-35],xp:[-35]},stair:'zn',roofStair:'zp',gaps:{xn:[-32]}});
 H(21,41,-41,-29,{m:'plaster',doors:{zp:[26,36],xn:[-33]},up:{xn:[-35],zp:[35]},stair:'zn'});
 for(const x of[-29,-14,3,18])k.bridge(x,x+(x===-29?3:3),-36,-34,3);k.bridge(3,6,-33.2,-30.8,6,'woodD');
 // rangée sud (z 29..41), passerelles à z=35
 H(-41,-27,29,41,{m:'plasterB',doors:{zn:[-34],xp:[32]},up:{xp:[35],zn:[-35]},stair:'zp'});
 H(-24,-10,30,41,{m:'stone',doors:{zn:[-20,-13],xn:[33]},up:{xn:[35],xp:[35]},stair:'zp'});
 H(-7,7,30,41,{m:'plasterO',doors:{zn:[0],xp:[33]},up:{xn:[35],xp:[35]},stair:'zp',roofStair:'zn',gaps:{xp:[32]}});
 H(10,24,30,41,{m:'brick',doors:{zn:[14,21],xn:[33]},up:{xn:[35],xp:[35]},stair:'zp',roofStair:'zn',gaps:{xn:[32]}});
 H(27,41,29,41,{m:'plaster',doors:{zn:[34],xn:[32]},up:{xn:[35],zn:[35]},stair:'zp'});
 for(const x of[-27,-10,7,24])k.bridge(x,x+3,34,36,3);k.bridge(7,10,30.8,33.2,6,'woodD');
 // colonnes ouest/est (avec passerelles au-dessus des ruelles nord/sud)
 H(-41,-29,-24,-9,{m:'stone',doors:{xp:[-20,-12],zp:[-37]},up:{zn:[-35],xp:[-16.5]},stair:'xn'});
 H(-41,-29,9,24,{m:'plasterO',doors:{xp:[12,20],zn:[-37]},up:{zp:[-35],xp:[16.5]},stair:'xn'});
 H(29,41,-24,-9,{m:'plasterB',doors:{xn:[-20,-12],zp:[37]},up:{zn:[35],xn:[-16.5]},stair:'xp'});
 H(29,41,9,24,{m:'brick',doors:{xn:[12,20],zn:[37]},up:{zp:[35],xn:[16.5]},stair:'xp'});
 k.bridge(-36,-34,-29,-24,3);k.bridge(-36,-34,24,29,3);k.bridge(34,36,-29,-24,3);k.bridge(34,36,24,29,3);
 // îlots intérieurs + arcades couvertes (toit praticable à 3 m)
 H(-25,-13,-22,-12,{m:'plaster',doors:{xn:[-17],zn:[-19],zp:[-15.5]},up:{xp:[-19.5],xn:[-16.5]},stair:'zp'});
 H(13,25,-22,-12,{m:'stone',doors:{xp:[-17],zn:[19],zp:[15.5]},up:{xn:[-19.5],xp:[-16.5]},stair:'zp'});
 H(-25,-13,12,22,{m:'brick',doors:{xn:[17],zp:[-19],zn:[-15.5]},up:{xp:[19.5],xn:[16.5]},stair:'zn'});
 H(13,25,12,22,{m:'plasterB',doors:{xp:[17],zp:[19],zn:[15.5]},up:{xn:[19.5],xp:[16.5]},stair:'zn'});
 k.bridge(-29,-25,-17.5,-15.5,3,'woodD');k.bridge(25,29,-17.5,-15.5,3,'woodD');k.bridge(-29,-25,15.5,17.5,3,'woodD');k.bridge(25,29,15.5,17.5,3,'woodD');
 const arcade=(z0,z1)=>{k.slab(-13,13,z0,z1,3,'stone',.35);for(let x=-11;x<=11;x+=4.4)for(const z of[z0+.2,z1-.6]){k.box(x-.25,x+.25,0,2.65,z,z+.45,'stone');k.dbox(x-.45,2.35,z+.22,.3,.3,.5,'stone');k.dbox(x+.45,2.35,z+.22,.3,.3,.5,'stone')}
  for(const z of[z0,z1-.25])k.box(-13,13,3,3.85,z,z+.25,'stone');k.vis(-13,13,2.35,2.65,z0,z0+.15,'stone');k.vis(-13,13,2.35,2.65,z1-.15,z1,'stone')};
 arcade(-22,-17);arcade(17,22);
 // cours fermées par murs avec arches (ouest/est), rue principale E-O
 const yard=(x0,x1)=>{k.room(x0,x1,-8,8,0,3.4,{zn:[D((x0+x1)/2,2.6,2.6)],zp:[D((x0+x1)/2,2.6,2.6)],xn:[D(0,3,2.8)],xp:[D(0,3,2.8)]},'stone',.45);k.crate(x0+2,5.5,1.2);k.crate(x1-2,-5.5,1.2);k.dcyl((x0+x1)/2,.45,4,1.3,.9,'stone',16);k.disc((x0+x1)/2,4,1.3,0,.9)};
 yard(-25,-13);yard(13,25);
 // place du marché : étals, fontaine, monument
 k.dcyl(0,.4,0,2.6,.8,'stone',20);k.disc(0,0,2.6,0,.8);k.box(-.6,.6,.8,3.8,-.6,.6,'stone');k.dcyl(0,4.2,0,.5,.8,'brick',8);k.col(-.5,.5,3.8,4.6,-.5,.5);
 const stall=(x,z,c)=>{k.box(x-1.5,x+1.5,0,.9,z-.6,z+.6,'woodD');for(const a of[-1.4,1.4])for(const b of[-.55,.55])k.dbox(x+a,0,z+b,.08,2.3,.08,'woodD');k.dbox(x,2.3,z,3.4,.06,1.8,c);k.col(x-1.7,x+1.7,2.3,2.36,z-.9,z+.9,'wood')};
 stall(-7,-7,'tarp');stall(7,-7,'tarpR');stall(-7,7,'tarpR');stall(7,7,'tarp');stall(0,-9.5,'tarpR');
 for(const p of[[-10,0],[10,0],[0,10],[3.5,-4]])k.crate(...p,1.1);k.truck(-35,0,true,true);k.truck(35,2,true,false);
 for(const p of[[-43.5,-40],[43.5,40],[-26.5,26],[26.5,-26.5],[-44,26],[44,-26]])k.barrel(...p);
 k.bags(-5,-1,-26.5,-25.7);k.bags(1,5,25.7,26.5);k.bags(-45,-42,-3.5,-2.7);k.bags(42,45,2.7,3.5);
 for(const[x,z]of[[-35,-35],[-20,-36],[-4,-35.5],[12,-35.5],[31,-35],[-34,35],[-17,35.5],[0,35.5],[17,35.5],[34,35],[-19,-17],[19,-17],[-19,17],[19,17]]){k.dbox(x,2.75,z,.25,.12,.25,'lampA');k.glow(x,z,3.5,'#ffb46a',.22)}
 for(const[x,z]of[[-35,-35],[12,-35.5],[-17,35.5],[34,35],[-19,-17],[19,17]])k.light(x,2.6,z,0xffb46a,4,9,2);
 k.light(0,5,0,0xffa050,14,26,2);for(const[x,z]of[[-20,0],[20,0],[-35,-26.5],[35,26.5]])k.fume(x,z,1.2,0x333030,10);k.fume(-70,-50,10,0x2a2826,60);k.fume(60,70,12,0x35322f,60);
 k.paths.push({pts:[[-46,0],[46,0]],w:4,c:'#5d564b'},{pts:[[0,-46],[0,46]],w:4,c:'#5d564b'});k.paints.push({t:'cobble'});
 k.far(64,62,140,10,34,'farU');
 for(const p of[[-44,-44],[44,44],[44,-44],[-44,44],[0,-44],[0,44],[-44,0],[44,0],[-10,-26],[10,26],[-8,0],[8,0],[0,-14.5],[-27.5,-4],[27.5,4]])k.sp(...p);
 k.scatter(320,'rubble');dress(k,BT["vieille-ville"],9134);return k}

function mapPort(){const k=new Kit('port',56,1312);const S=56;
 k.limit('concrete');k.solids[1].surface='metal';k.vis(-S-1.2,S+1.2,0,1.1,S,S+.5,'conc');k.ops.push({t:'f',x0:-S,x1:S,z:S+.3,h:3.6});
 for(let x=-S+2;x<S;x+=6)k.dbox(x,0,S+.3,.12,3.7,.12,'steel');for(let x=-S+5;x<S;x+=9){k.dcyl(x,.35,S-1,.28,.7,'rust',10);k.col(x-.27,x+.27,0,.7,S-1.27,S-.73,'metal')}
 k.water=S+.8;
 // Entrepôt traversant (NO)
 k.room(-48,-18,-48,-24,0,7,{zp:[D(-40,5,4.2),D(-26,5,4.2)],xp:[D(-36,3,2.8),D(-30,2.4,2.5)],xn:[D(-36,2.4)],zn:[D(-33,2.4)]},'corr',.35);
 k.box(-48.5,-17.5,7,7.4,-48.5,-23.5,'rust');for(let x=-46;x<=-20;x+=4)k.dbox(x,6.3,-36,.2,.6,24,'steel');
 for(const z of[-43.5,-28.5]){k.box(-40,-23,0,3.2,z-.55,z+.55,'steel');for(let x=-39;x<=-24;x+=2.2){k.dbox(x,3.2,z,1.8,.06,1,'crate');k.dbox(x,1,z,1.1,1,.9,'crate')}}
 k.slab(-47.6,-42.5,-47.6,-24.4,3.2,'plate',.2);k.rail(-42.5,-42.43,-47.6,-36,3.2);k.rail(-42.5,-42.43,-29.8,-24.4,3.2);k.stairs(-41.6,-30,1.8,'z-',0,3.2,'plate');
 for(const x of[-38,-30,-22])k.dbox(x,6.5,-36,1.6,.1,.4,'lampW');k.light(-33,5.8,-36,0xdfe8ff,22,22,1);
 // Parc à conteneurs : rangées avec allées, piles de 1 ou 2
 const xs=[-8,1,10,19,28,37,46],zs=[-41,-34.6,-28.2,-21.8,-15.4,-9,-2.6];let ci=0;
 for(let j=0;j<zs.length;j++)for(let i=0;i<xs.length;i++){const h=(i*7+j*5)%9;if(h===4||(j===3&&i%2===0)||(i===3&&j===5)||(i===6&&j===0))continue;const two=(i+j)%3===0;k.container(xs[i],zs[j],false,0,ci++);if(two)k.container(xs[i],zs[j],false,2.6,ci++)}
 // Coursives au-dessus des allées (y 3.4) avec escaliers
 const cw=(z,x0,x1)=>{k.slab(x0,x1,z-.9,z+.9,3.4,'plate',.15);for(const[a,b]of[[x0,22.6],[24.4,x1]]){k.rail(a,b,z-.97,z-.9,3.4);k.rail(a,b,z+.9,z+.97,3.4)}for(let x=x0;x<=x1;x+=6.5)for(const s of[-1,1])k.box(x,x+.14,0,3.25,z+s*.9-.07,z+s*.9+.07,'steel')};
 cw(-31.4,-4,42);k.stairs(-9.1,-31.4,1.8,'x+',0,3.4,'plate');k.stairs(47.1,-31.4,1.8,'x-',0,3.4,'plate');
 cw(-12.2,-4,42);k.stairs(-9.1,-12.2,1.8,'x+',0,3.4,'plate');k.stairs(47.1,-12.2,1.8,'x-',0,3.4,'plate');
 k.slab(22.6,24.4,-30.5,-13.1,3.4,'plate',.15);k.rail(22.53,22.6,-30.5,-13.1,3.4);k.rail(24.4,24.47,-30.5,-13.1,3.4);
 // Quai : grues portiques, bittes, palettes, chariot élévateur
 const crane=(x)=>{for(const a of[x-6,x+6])for(const z of[34,48]){k.box(a-.5,a+.5,0,1,z-.6,z+.6,'rust');k.dbox(a,1,z,.7,20,.7,'paint');k.col(a-.35,a+.35,1,21,z-.35,z+.35,'metal')}for(const z of[34,48])k.dbox(x,20,z,13,1.2,1,'paint');k.dbox(x,21.2,41,13.5,1.4,30,'paint');k.dbox(x,19,30,2.6,2.2,3,'paint');k.dbox(x,22.6,41,3,2,3,'frame');k.dcyl(x,14,41,.04,14,'steel',4);k.dbox(x,21.4,58,1,.3,.3,'lampR')};
 crane(-24);crane(14);k.light(-24,18,41,0xffc070,40,40,0);k.light(14,18,41,0xffc070,40,40,0);
 for(const[x,z,y,c]of[[-44,38,0,1],[-44,38,2.6,2],[34,22,0,2],[46,42,0,0],[-8,24,0,3],[2,24,0,0],[2,24,2.6,1]])k.container(x,z,false,y,c);
 for(const p of[[-36,22],[-34.6,22.3],[30,48],[-2,46],[44,24.5],[20,24]])k.crate(...p,1.3);
 for(const p of[[-14,30],[-13.3,30.7],[8,44],[24,30],[50,14],[-50,14]])k.barrel(...p,'rust');
 k.box(-28.5,-25.5,0,1.9,14,15.4,'paint');k.dbox(-25.4,0,14.7,.12,2.6,1,'steel');k.dbox(-27,1.9,14.7,1.6,.9,1.2,'glass');k.col(-25.5,-25.34,0,2.6,14.2,15.2,'metal');k.col(-27.8,-26.2,1.9,2.8,14.1,15.3,'metal');
 for(const[a,b,c,d]of[[-52,-44,6,6.8],[44,52,6,6.8],[-2,6,12,12.8],[-20,-12,46,46.8]])k.jersey(a,b,c,d);
 // Bureau du port (creux) à l'est
 k.room(40,52,-52,-44,0,3,{zp:[D(46)],xn:[D(-48)]},'plasterB');k.box(39.7,52,3,3.25,-52.3,-43.7,'rust');k.light(46,2.6,-48,0xfff2d0,6,10,1);
 // Eau, navire au large, horizon
 k.ops.push({t:'r',x:20,y:-6,z:92,w:110,h:18,d:20,m:'hull',ry:.06},{t:'r',x:48,y:12,z:93,w:20,h:12,d:16,m:'farU',ry:.06});
 for(let i=0;i<6;i++)k.dbox(-14+i*12,12,92,11,5.2,8,'cont'+(i%4),.06);
 k.far(40,70,150,8,30,'farU');k.paths.push({pts:[[-56,8],[56,8]],w:5,c:'#2c2c2e'},{pts:[[-12,-56],[-12,56]],w:4.5,c:'#2c2c2e'});k.paints.push({t:'quay'});
 for(const[x,z,s,c]of[[-80,-70,10,0x2a2622],[90,-30,8,0x342e2a]])k.fume(x,z,s,c,60);k.fume(-8,24,1.2,0x2a2828,9);
 for(const p of[[-52,-52],[52,52],[-52,52],[30,-52],[-52,0],[52,0],[0,52],[-10,-52],[-33,-36],[-12,40],[30,30],[5,-25],[24,-38],[-12,0],[46,-40],[28,6]])k.sp(...p);
 k.scatter(140,'rubble');dress(k,BT["port"],9202);return k}

function mapBunker(){const k=new Kit('bunker',40,909);const S=40,G=.5,N=S*2/G,TOP=7.4,ceil=new Float32Array(N*N);
 const carve=(x0,x1,z0,z1,h)=>{for(let i=Math.round((x0+S)/G);i<Math.round((x1+S)/G);i++)for(let j=Math.round((z0+S)/G);j<Math.round((z1+S)/G);j++)if(!ceil[i*N+j])ceil[i*N+j]=h};
 const R=[];const room=(a,b,c,d,h)=>{carve(a,b,c,d,h);R.push([a,b,c,d,h])};
 room(-11,11,-11,11,6.6);// hall du réacteur
 room(-31,31,-25,-22,3);room(-31,31,22,25,3);room(-34,-31,-25,25,3);room(31,34,-25,25,3);// anneau
 room(-1.5,1.5,-22,-11,3.2);room(-1.5,1.5,11,22,3.2);room(-31,-11,-1.25,1.25,3.2);room(11,31,-1.25,1.25,3.2);
 for(const[sx,sz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){const a=sx<0?-27:14,b=sx<0?-14:27,c=sz<0?-19:6,d=sz<0?-6:19;room(a,b,c,d,3.6);
  const cx=(a+b)/2;carve(cx-1,cx+1,sz<0?-22:19,sz<0?-19:22,2.6);carve(cx-1,cx+1,sz<0?-6:1.25,sz<0?-1.25:6,2.6);carve(sx<0?-14:11,sx<0?-11:14,sz<0?-10.6:8.4,sz<0?-8.4:10.6,2.5)}
 room(-14,14,-37,-30,3.8);carve(-12,-9.5,-30,-25,3);carve(9.5,12,-30,-25,3);room(-14,14,30,37,3.8);carve(-12,-9.5,25,30,3);carve(9.5,12,25,30,3);
 room(-38,-35,-37,37,2.4);room(35,38,-37,37,2.4);room(-38,38,-38,-37,2.4);room(-38,38,37,38,2.4);carve(-38,-35,-38,38,2.4);
 room(-38,-14,-38,-35.5,2.4);room(14,38,-38,-35.5,2.4);room(-38,-14,35.5,38,2.4);room(14,38,35.5,38,2.4);
 for(const z of[-12,12])carve(-35,-34,z-1,z+1,2.4),carve(34,35,z-1,z+1,2.4);carve(-35,-34,-1,1,2.4);carve(34,35,-1,1,2.4);
 // fusion gloutonne des cellules (roche = 0, plafonds = h)
 const used=new Uint8Array(N*N);for(let i=0;i<N;i++)for(let j=0;j<N;j++){if(used[i*N+j])continue;const h=ceil[i*N+j];let w=1,d=1;while(i+w<N&&!used[(i+w)*N+j]&&ceil[(i+w)*N+j]===h)w++;
  outer:while(j+d<N){for(let u=i;u<i+w;u++)if(used[u*N+j+d]||ceil[u*N+j+d]!==h)break outer;d++}
  for(let u=i;u<i+w;u++)for(let v=j;v<j+d;v++)used[u*N+v]=1;const x0=-S+i*G,x1=x0+w*G,z0=-S+j*G,z1=z0+d*G;k.box(x0,x1,h,TOP,z0,z1,h?'ceil':'bwall')}
 k.limit('concrete');
 // hall : cœur du réacteur, passerelles hautes et escaliers
 k.box(-3,3,0,6.6,-3,3,'panel');for(let a=0;a<8;a++){const px=Math.cos(a*.785)*3.2,pz=Math.sin(a*.785)*3.2;k.dcyl(px,3.3,pz,.18,6.6,'steel',8);if(!(a&1))k.col(px-.18,px+.18,0,6.6,pz-.18,pz+.18,'metal')}k.dbox(0,1.2,-3.05,2,.8,.1,'lampG');k.dbox(0,1.2,3.05,2,.8,.1,'lampG');
 for(const s of[-1,1]){const z0=s<0?-10.9:8.3,z1=s<0?-8.3:10.9;k.slab(-10.9,10.9,z0,z1,3.3,'plate',.2);k.rail(-8.4,10.9,s<0?z1:z0-.07,s<0?z1+.07:z0,3.3);k.stairs(-5.1,s<0?-7.55:7.55,1.5,'x-',0,3.3,'plate')}
 for(const s of[-1,1])for(const x of[-9.5,-4.5,4.5,9.5])k.box(x-.15,x+.15,0,3.1,s*8.6-.15,s*8.6+.15,'steel');
 // mobilier : consoles, caisses, armoires, tuyaux
 for(const[sx,sz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){const cx=sx*20.5,cz=sz*12.5;k.box(cx-3,cx+3,0,1,cz-.5,cz+.5,'panel');k.dbox(cx,1,cz,5.6,.5,.12,'lampB');k.col(cx-2.8,cx+2.8,1,1.5,cz-.06,cz+.06,'metal');k.crate(cx+sx*4.5,cz+sz*4,1.2);k.box(cx-sx*6.3-.4,cx-sx*6.3+.4,0,2.2,cz+sz*2-1,cz+sz*2+1,'steel')}
 for(const s of[-1,1]){k.crate(-20,s*24.4,1.1);k.crate(20,s*24.45,1);k.barrel(5,s*22.4,'rust')}
 for(const z of[-33.5,33.5])for(const x of[-9,-4,4,9])k.box(x-1,x+1,0,1.3,z-.6,z+.6,'crate',{fit:1});
 for(const z of[-24.6,24.6])k.dcyl(0,2.6,z,.12,62,'rust',8,0,Math.PI/2);for(const x of[-33.6,33.6])k.dcyl(x,2.6,0,.12,50,'rust',8,Math.PI/2,0);
 // lampes émissives + lueurs au sol cuites ; 8 vraies lumières max
 /* luminaires : moitié nord en blanc froid, moitié sud en blanc chaud (on s'oriente à la couleur), gaines techniques rouges, hall vert.
    Ces lueurs éclairent aussi murs, plafonds et objets (champ de lumière cuit, voir paintBake / ENV.bunker.bake). */
 const cw=z=>z<0?'lampW':'lampY',cg=z=>z<0?'#cfe6ff':'#ffe0ae';
 for(let x=-28;x<=28;x+=8)for(const z of[-23.5,23.5]){k.dbox(x,2.95,z,1.2,.05,.2,cw(z));k.glow(x,z,3.4,cg(z),.3)}
 for(let z=-20;z<=20;z+=8)for(const x of[-32.5,32.5]){k.dbox(x,2.95,z,.2,.05,1.2,cw(z));k.glow(x,z,3.4,cg(z),.3)}
 for(const s of[-1,1]){k.dbox(0,3.15,s*16.5,.2,.05,1.2,cw(s));k.glow(0,s*16.5,3.6,cg(s),.34);for(const x of[16,26]){k.dbox(s*x,3.15,0,1.2,.05,.2,'lampW');k.glow(s*x,0,3.6,'#dfe8f0',.34)}
  for(const x of[-10.75,10.75]){k.dbox(x,2.95,s*27.5,.2,.05,1.2,'lampA');k.glow(x,s*27.5,3,'#ffc880',.28)}
  for(const x of[-6,6]){k.dbox(x,3.05,s*9.6,1.2,.05,.2,'lampW');k.glow(x,s*9.6,3.2,'#d8f0e4',.26)}k.dbox(s*10.94,4.3,0,.1,.25,2.4,'lampW');k.glow(s*8.5,0,5.5,'#d0f4e0',.24)}
 for(let z=-35;z<=35;z+=7)for(const x of[-36.5,36.5]){k.dbox(x,2.35,z,.3,.05,.3,'lampR');k.glow(x,z,2.8,'#ff6044',.36)}
 for(const x of[-30,-22,22,30])for(const z of[-36.75,36.75]){k.dbox(x,2.35,z,.3,.05,.3,'lampR');k.glow(x,z,2.8,'#ff6044',.36)}
 for(const[x,z]of[[-20.5,-12.5],[20.5,-12.5],[-20.5,12.5],[20.5,12.5]]){k.dbox(x,3.55,z,2,.05,.3,cw(z));k.glow(x,z,5.5,z<0?'#bfe0ff':'#ffe6c0',.3)}
 k.glow(0,0,11,'#60ff90',.15);k.dbox(0,6.5,-6,2.4,.1,.5,'lampG');k.dbox(0,6.5,6,2.4,.1,.5,'lampW');for(const z of[-33.5,33.5]){k.dbox(0,3.75,z,3,.05,.3,'lampA');k.glow(0,z,7,'#ffc070',.3);for(const x of[-9.5,9.5]){k.dbox(x,3.75,z,1.6,.05,.3,'lampA');k.glow(x,z,3.6,'#ffc070',.2)}}
 k.light(0,5.8,-6,0x80ffb0,40,24,1);k.light(0,5.8,6,0xd8f0ff,36,24,0);k.light(-20.5,3.3,-12.5,0xbfe0ff,22,15,0);k.light(20.5,3.3,-12.5,0xbfe0ff,22,15,2);
 k.light(-20.5,3.3,12.5,0xffe2b8,22,15,0);k.light(20.5,3.3,12.5,0xff5040,22,15,3);k.light(0,3.5,-33.5,0xffc070,26,19,0);k.light(0,3.5,33.5,0xffc070,26,19,1);
 k.paints.push({t:'bunker',rooms:R});k.fume(0,0,1.6,0x3a4040,6);
 for(const p of[[-36.5,-30],[36.5,30],[-36.5,30],[36.5,-30],[0,-35],[0,35],[-25,-23.5],[25,23.5],[-20.5,-9],[20.5,9],[-20.5,9],[20.5,-9],[-6,-5],[6,5],[-22,0],[22,0]])k.sp(...p);
 k.scatter(160,'rubble');dressBunker(k,9236);return k}

function mapCol(){const k=new Kit('snow',54,2718);k.limit('snow');const S=54;
 const OPEN={n:[-4.5,11.5,40.5],e:[-26,8,24],s:[-26,9,31],w:[-48,1.5,8.5]},shut=(e,u)=>OPEN[e].some(c=>Math.abs(c-u)<5.6),nearO=()=>true;for(let x=-S;x<S;x+=7){for(const z of[-S-.6,S+.6]){const e=z<0?'n':'s',u=x+3.5;if(shut(e,u)){k.r();k.r()}else{k.rock(u,1.8,z,5,4.2,2.2,'rockS',null,0,nearO(e,u));k.vis(x,x+7,0,5.2,z<0?-S-1.2:S,z<0?-S:S+1.2,'rockS')}}}for(let z=-S;z<S;z+=7)for(const x of[-S-.6,S+.6]){const e=x<0?'w':'e',u=z+3.5;if(shut(e,u)){k.r();k.r()}else{k.rock(x,1.8,u,2.2,4.2,5,'rockS',null,0,nearO(e,u));k.vis(x<0?-S-1.2:S,x<0?-S:S+1.2,0,5.2,z,z+7,'rockS')}}
 const ridge=(x0,x1,z0,z1,h)=>{const hb=k.box(x0,x1,0,h,z0,z1,'rock',{surface:'concrete'});k.vis(x0-.02,x1+.02,h,h+.08,z0-.02,z1+.02,'snow');for(let z=z0+1.5;z<z1-1;z+=3.2){k.rock(x0+1,h*.3,z,.9,h*.55,1.6,'rock',hb);k.rock(x1-1,h*.3,z+1.6,.9,h*.55,1.6,'rock',hb)}};
 // ravin central (x -5..5), deux arêtes rocheuses à 3.2 m, pont de bois
 ridge(-12,-5,-38,-8,3.2);ridge(-12,-5,-4.5,34,3.2);ridge(5,12,-34,5,3.2);ridge(5,12,8.5,38,3.2);
 k.bridge(-5,5,-1.1,1.1,3.2,'woodD');for(const x of[-4.6,4.6])for(const z of[-1.3,1.3])k.dcyl(x,1.6,z,.12,3.2,'woodD',6);
 k.stairs(-17.1,20,2,'x+',0,3.2,'woodD');k.stairs(17.1,-20,2,'x-',0,3.2,'woodD');k.stairs(-17.1,-30,2,'x+',0,3.2,'stone');k.stairs(17.1,28,2,'x-',0,3.2,'stone');
 for(const[x,z]of[[-8.5,-20],[-8.5,12],[8.5,-14],[8.5,24]])k.bags(x-1.6,x+1.6,z-.3,z+.3,4.2);
 // tranchées enneigées
 k.trench([[-50,-20],[-40,-20],[-40,-10],[-26,-10],[-26,2]],1.5,1.6,'snow');k.trench([[50,20],[40,20],[40,10],[26,10],[26,-2]],1.5,1.6,'snow');
 k.trench([[-46,10],[-34,10],[-34,24]],1.4,1.5,'snow');k.trench([[46,-10],[34,-10],[34,-24]],1.4,1.5,'snow');
 // formations rocheuses (collisions boîtes + rochers irréguliers empilés)
 const pile=(x,z,w,d,h)=>{k.rock(x,h*.3,z,w*.38,h*.56,d*.38,'rockS');k.rock(x-w*.12,h*.72,z+d*.08,w*.3,h*.32,d*.3,'rock');k.rock(x+w*.12,h*.18,z-d*.1,w*.3,h*.32,d*.3,'rock')};
 for(const[x,z,w,d,h]of[[-30,-40,6,4,3.5],[22,-44,5,6,4.2],[-22,40,7,4,3],[30,42,4,5,3.8],[-46,-38,4,4,2.6],[46,36,4,4,2.8],[-18,-12,3,3,2.2],[18,12,3,3,2.2],[-44,30,3.5,3,2],[44,-30,3.5,3,2],[0,-46,5,3,3.2],[0,46,5,3,3.2]])pile(x,z,w,d,h);
 // chalets en bois creux
 const cabin=(x0,x1,z0,z1,doors)=>{k.room(x0,x1,z0,z1,0,2.9,doors,'woodD',.3);k.box(x0-.4,x1+.4,2.9,3.1,z0-.4,z1+.4,'wood');const cx=(x0+x1)/2,cz=(z0+z1)/2,lx=x1-x0>z1-z0;
  k.ops.push({t:'p',x:cx,y:3.1,z:cz,w:(lx?x1-x0:z1-z0)+.9,d:(lx?z1-z0:x1-x0)+.9,h:1.8,ry:lx?0:Math.PI/2,m:'woodD'},{t:'p',x:cx,y:3.3,z:cz,w:(lx?x1-x0:z1-z0)+1,d:(lx?z1-z0:x1-x0)+1,h:1.75,ry:lx?0:Math.PI/2,m:'snow'});
  k.dcyl(x0+1,4,z0+1,.3,2.2,'stone',8);k.col(x0+.7,x0+1.3,2.9,5.1,z0+.7,z0+1.3);k.light(cx,2.5,cz,0xffa860,5,9,2);
  {const hw=((lx?x1-x0:z1-z0)+1)/2,hd=((lx?z1-z0:x1-x0)+1)/2;for(const[ya,yb,f]of[[3.1,3.7,1],[3.7,4.3,.78],[4.3,5.05,.44]])lx?k.col(cx-hw,cx+hw,ya,yb,cz-hd*f,cz+hd*f,'snow'):k.col(cx-hd*f,cx+hd*f,ya,yb,cz-hw,cz+hw,'snow')}k.dbox(cx,2.75,cz,.3,.15,.3,'lampA');k.glow(cx,cz,4,'#ffb070',.25)};
 cabin(-42,-32,-50,-43,{zp:[D(-37)],xp:[D(-46.5)]});cabin(32,42,43,50,{zn:[D(37)],xn:[D(46.5)]});cabin(-48,-40,38,48,{xp:[D(43)],zn:[D(-44)]});cabin(40,48,-48,-38,{xn:[D(-43)],zp:[D(44)]});
 cabin(18,26,-26,-19,{xn:[D(-22.5)],zn:[D(22)],zp:[D(22)]});cabin(-26,-18,19,26,{xp:[D(22.5)],zn:[D(-22)],zp:[D(-22)]});
 k.crate(-36,-41.5,1.2);k.crate(36,41.5,1.2);k.box(-31.5,-29,0,1.1,-50,-48.6,'wood');k.box(29,31.5,0,1.1,48.6,50,'wood');
 // pins
 const SP=[[-50,-50],[50,50],[-50,50],[50,-50],[0,-30],[0,30],[-50,0],[50,0],[-22,-30],[22,30],[-30,10],[30,-10],[-36,-2],[36,2],[-16,44],[16,-44]];SP.forEach(p=>k.sp(...p));
 let n=0;for(let i=0;i<400&&n<56;i++){const x=k.rnd(-S+3,S-3),z=k.rnd(-S+3,S-3);if(Math.abs(x)<14||!k.free(x,z,2.4)||SP.some(p=>Math.hypot(p[0]-x,p[1]-z)<3))continue;const s=k.rnd(.8,1.35);k.inst.push({k:'pine',x,y:0,z,s,ry:k.r()*6});k.col(x-.26*s,x+.26*s,0,6.4*s,z-.26*s,z+.26*s,'wood');n++}
 for(let i=0;i<10;i++){const x=k.rnd(-3.5,3.5),z=k.rnd(-36,36);if(Math.abs(z)>3)k.inst.push({k:'rubble',x,y:0,z,s:k.rnd(.16,.3),ry:k.r()*6})}
 k.light(0,3,0,0xffc080,6,10,2);k.dbox(0,3.3,1.05,.2,.4,.2,'lampA');
 for(let i=0;i<26;i++){const a=i/26*6.283,r=k.rnd(85,150),h=k.rnd(30,70);k.ops.push({t:'c',x:Math.cos(a)*r,y:h/2-2,z:Math.sin(a)*r,r:k.rnd(22,40),r2:0,h,m:'farS',seg:7,rx:0,rz:0})}
 k.paints.push({t:'snow'});k.paths.push({pts:[[-5,-54],[-5,54]],w:.01,c:'#000'});
 k.scatter(80,'rubble');dress(k,BT["col-blanc"],9219);return k}

/* ---------- GRANDES CARTES : pièces communes (tout ce qui se voit a sa collision) ---------- */
Object.assign(SURF,{tank:'metal',pipeY:'metal',pipeR:'metal',leaf:'wood',leafA:'wood'});
/* cylindre couché : axe 'x' ou 'z', collision en 3 boîtes croisées */
function hcyl(k,x,y,z,r,len,ax,m,seg=10,solid=true){ax==='x'?k.dcyl(x,y,z,r,len,m,seg,0,Math.PI/2):k.dcyl(x,y,z,r,len,m,seg,Math.PI/2,0);if(!solid)return;const L=len/2,sf=SURF[m]||'metal';
 for(const[a,b]of[[1,.5774],[.8165,.8165],[.5774,1]]){const y0=Math.max(0,y-r*a),y1=y+r*a;ax==='x'?k.col(x-L,x+L,y0,y1,z-r*b,z+r*b,sf):k.col(x-r*b,x+r*b,y0,y1,z-L,z+L,sf)}}
/* cuve verticale à toit plat */
function tank(k,x,z,r,h,m='tank'){k.dcyl(x,h/2,z,r,h,m,20);k.dcyl(x,h+.12,z,r,.24,m,20,0,0,r*.92);for(const y of[h*.33,h*.66])k.dcyl(x,y,z,r+.04,.08,'steel',20);k.disc(x,z,r,0,h+.2,'metal')}
/* épave d'avion posée sur le ventre, axe 'x' ou 'z' : uniquement des boîtes alignées, collisions exactes */
function plane(k,x,z,alongX,burnt,brokenWing){const b=(a0,a1,y0,y1,c0,c1,m)=>alongX?k.box(x+a0,x+a1,y0,y1,z+c0,z+c1,m):k.box(x+c0,x+c1,y0,y1,z+a0,z+a1,m),body=burnt?'steel':'paint';
 b(-7.5,6,0,1.5,-1.25,1.25,body);b(-7,5.4,1.5,2.25,-1,1,body);b(6,8,.25,1.3,-.8,.8,burnt?'burn':'steel');b(2.6,5,2.25,2.75,-.7,.7,burnt?'burn':'glass');
 b(-1.8,1.6,.95,1.2,brokenWing?-3.6:-8.5,-1.25,body);b(-1.8,1.6,.95,1.2,1.25,8.5,body);
 b(-7.4,-5.8,2.25,4.7,-.1,.1,body);b(-7.5,-5.9,2.25,2.42,-3.1,3.1,body);
 for(const s of[-1,1]){if(brokenWing&&s<0)continue;const c=s*4.3;b(-.9,1.5,.25,.95,c-.5,c+.5,'steel')}}
/* mur pare-souffle en U, ouvert vers +z */
function revet(k,x0,x1,z0,z1,h=2.8){k.box(x0,x1,0,h,z0,z0+.7,'conc');k.box(x0,x0+.7,0,h,z0+.7,z1,'conc');k.box(x1-.7,x1,0,h,z0+.7,z1,'conc')}
/* arbre : tronc en collision, feuillage au-dessus de 2.2 m */
function tree(k,x,z,y=0,s=1,m='leaf'){k.dcyl(x,y+1.6*s,z,.2*s,3.2*s,'woodD',6);k.col(x-.2*s,x+.2*s,y,y+6.7*s,z-.2*s,z+.2*s,'wood');for(const[h,r,t]of[[2.3,1.9,2.2],[3.7,1.45,2],[5,.95,1.7]])k.dcyl(x,y+(h+t/2)*s,z,r*s,t*s,m,7,0,0,0)}
/* PISTE SEPT-VENTS : base aérienne. Piste E-O au sud, tarmac central, trois hangars au nord, tour de contrôle, casemates à l'ouest, cuves à l'est. */
function mapAir(){const S=88,k=new Kit('airbase',S,8101);k.chunk=60;k.limit('concrete');
 const hangar=(x0,x1,z0,z1,lamp)=>{const cx=(x0+x1)/2,cz=(z0+z1)/2,H=9;
  k.room(x0,x1,z0,z1,0,H,{zp:[D(cx-7.5,9,5.4),D(cx+7.5,9,5.4)],zn:[D(cx,3,2.7)],xn:[D(cz,5,4.4)],xp:[D(cz,5,4.4)]},'corr',.4);
  k.box(x0-.5,x1+.5,H,H+.4,z0-.5,z1+.5,'rust');for(let x=x0+3;x<x1-1;x+=4)k.dbox(x,H-.5,cz,.22,.5,z1-z0-.8,'steel');
  k.slab(x0+.4,x1-.4,z0+.4,z0+4.6,3.4,'plate',.2);k.rail(x0+.4,cx-2,z0+4.6,z0+4.67,3.4);k.rail(cx+2,x1-.4,z0+4.6,z0+4.67,3.4);k.stairs(cx,z0+4.6+13*.42,3,'z-',0,3.4,'plate');
  for(const x of[x0+7,x1-7])k.dbox(x,0,z0+4.5,.2,3.2,.2,'steel');
  for(const x of[cx-8,cx+8]){k.dbox(x,H-1,cz,1.6,.1,.5,'lampW');k.glow(x,cz,7,'#ffe8c0',.2)}if(lamp)k.light(cx,H-1.4,cz,0xfff0d8,85,36,1)};
 hangar(-72,-40,-66,-36,1);hangar(-16,16,-66,-36,1);hangar(40,72,-66,-36,1);
 plane(k,-63,-47,false,false,false);plane(k,63,-47,false,true,true);k.truck(-5,-46,false,false);k.crate(7,-44,1.6);k.crate(8.8,-44.2,1.2);k.crate(7.2,-44,1.1,1.1,1.6);k.crate(-10,-54,1.4);k.crate(11,-54,1.4);
 for(const[x,z]of[[-68,-41],[-44,-41],[44,-41],[68,-41],[-12,-41],[12,-41]])k.crate(x,z,1.5);for(const p of[[-69,-55],[-67.6,-55.4],[69,-55],[67.6,-54.6]])k.barrel(...p);
 // Tour de contrôle (3 niveaux + vigie à 10.8 m)
 {const cx=-28,cz=-24,x0=cx-5,x1=cx+5,z0=cz-5,z1=cz+5,F=3.6,n=14,run=n*.42;
  for(let f=0;f<3;f++)k.room(x0,x1,z0,z1,f*F,(f+1)*F,f?{zn:[W(cx-2),W(cx+2.2)],zp:[W(cx-2),W(cx+2.2)],xn:[W(cz-.5)],xp:[W(cz+.5)]}:{zn:[D(cx,2.4,2.6)],xp:[D(cz,2.2,2.4)],xn:[D(cz-1.6,2.2,2.4)]},'conc',.3);
  k.stairs(x0+1.35,z1-1.25,1.9,'x+',0,F,'conc');k.slab(x0,x1,z0,z1,F,'conc',.2,[x0+1.3,x0+1.35+run+.05,z1-2.25,z1-.25]);
  k.stairs(x1-1.6,z0+1.25,1.9,'x-',F,2*F,'conc');k.slab(x0,x1,z0,z1,2*F,'conc',.2,[x1-1.6-run-.05,x1-1.55,z0+.25,z0+2.25]);
  k.stairs(x0+1.6,z1-1.25,1.9,'x+',2*F,3*F,'conc');k.slab(x0-.6,x1+.6,z0-.6,z1+.6,3*F,'conc',.25,[x0+1.55,x0+1.6+run+.05,z1-2.25,z1-.25]);
  const y=3*F;k.box(x0-.6,x1+.6,y,y+1.05,z0-.6,z0-.35,'conc');k.box(x0-.6,x1+.6,y,y+1.05,z1+.35,z1+.6,'conc');k.box(x0-.6,x0-.35,y,y+1.05,z0-.35,z1+.35,'conc');k.box(x1+.35,x1+.6,y,y+1.05,z0-.35,z1+.35,'conc');
  for(const[a,b]of[[x0-.6,z0-.6],[x1+.25,z0-.6],[x0-.6,z1+.25],[x1+.25,z1+.25]])k.box(a,a+.35,y+1.05,y+2.9,b,b+.35,'steel');k.box(x0-1,x1+1,y+2.9,y+3.15,z0-1,z1+1,'conc');k.dcyl(cx,y+3.15+1.45,cz,.07,2.9,'steel',6);k.dcyl(cx,y+6,cz,1.1,.12,'frame',14,.6);
  k.dbox(cx,y+2.78,cz,1.4,.08,.4,'lampW');k.light(cx,y+2.2,cz,0xfff2d8,10,16,0)}
 // Tarmac : alvéoles pare-souffle, avions, tracteurs
 revet(k,-70,-48,-22,-4);revet(k,48,70,-22,-4);plane(k,-59,-11,true,false,false);plane(k,59,-11,true,true,false);
 plane(k,0,14,true,true,true);revet(k,-8,8,-30,-22,2);k.apc(-20,10,false);k.truck(22,-8,true,false);k.truck(-40,8,false,true);
 for(const[x,z]of[[-12,-10],[12,-13],[-34,-12],[36,-16],[-6,30],[20,20],[-20,28]])k.crate(x,z,1.7);for(const[x0,x1,z0,z1]of[[-30,-24,-4,-3.3],[24,30,-2,-1.3],[-16,-10,36,36.7],[10,16,36,36.7],[-46,-40,28,28.7],[40,46,30,30.7]])k.jersey(x0,x1,z0,z1);
 // Fosse antiaérienne (sacs, centre-est), abris
 {const c=28,d=-27;for(const[a,b,e,f]of[[c-6,c-1.4,d-6,d-5.2],[c+1.4,c+6,d-6,d-5.2],[c-6,c-1.4,d+5.2,d+6],[c+1.4,c+6,d+5.2,d+6],[c-6,c-5.2,d-5.2,d-1.4],[c-6,c-5.2,d+1.4,d+5.2],[c+5.2,c+6,d-5.2,d-1.4],[c+5.2,c+6,d+1.4,d+5.2]])k.bags(a,b,e,f,1.3);k.box(c-3.6,c-2.2,0,.9,d-3.6,d-2.2,'paint');k.dcyl(c-2.9,1.25,d-2.9,.5,.7,'burn',10);k.disc(c-2.9,d-2.9,.5,.9,1.6,'metal');hcyl(k,c-1.4,1.45,d-2.9,.09,2.6,'x','steel',6,false)}
 const hut=(x0,x1,z0,z1,door)=>{k.room(x0,x1,z0,z1,0,3.1,door,'corr',.25);k.box(x0-.3,x1+.3,3.1,3.35,z0-.3,z1+.3,'corr')};
 hut(-40,-30,16,23,{zp:[D(-35)],xp:[D(19.5)]});hut(-24,-14,16,23,{zp:[D(-19)],xn:[D(19.5)]});hut(14,24,14,21,{zp:[D(19)],xp:[D(17.5)]});hut(30,40,25,32,{zn:[D(35)],xn:[D(28.5)]});
 // Casemates à munitions (ouest)
 const cas=(x0,x1,z0,z1)=>{k.room(x0,x1,z0,z1,0,3,{xp:[D((z0+z1)/2,2.4,2.5)],zn:[D((x0+x1)/2,2.2,2.4)]},'conc',.4);k.box(x0-.5,x1+.5,3,3.6,z0-.5,z1+.5,'hesco');k.crate(x0+2,z0+2,1.4);k.crate(x1-2.4,z1-2,1.2)};
 cas(-84,-70,6,18);cas(-84,-70,24,36);cas(-62,-50,8,18);k.bags(-66,-62,22,22.8);k.bags(-58,-54,32,32.8);
 // Dépôt de carburant (est) : cuves, canalisations, muret
 for(const[x,z]of[[54,8],[68,8],[54,25],[68,25]])tank(k,x,z,4.8,6.6);tank(k,81,16,3.4,5);
 hcyl(k,61,.34,16.5,.32,22,'x','pipeY',8);for(const x of[54,68])hcyl(k,x,.34,16.5,.32,6,'z','pipeY',8);
 for(const[a,b,c,d]of[[46,60,-1.6,-1],[64,84,-1.6,-1],[46,46.6,-1,14],[46,46.6,19,34],[46,60,34,34.6],[64,84,34,34.6]])k.box(a,b,0,1.05,c,d,'conc');k.truck(43,8,false,false);
 // Piste : couverts espacés pour casser les lignes de tir
 k.apc(-44,52,true);plane(k,-24,57,true,true,false);plane(k,36,53,true,true,true);k.truck(8,60,true,true);k.apc(62,58,true);for(const[x,z]of[[-66,50],[-6,49],[20,63],[50,48],[74,62],[-78,60]])k.crate(x,z,1.8);
 for(const[x0,x1,z]of[[-84,-68,43],[-54,-38,43],[-26,-10,43],[6,22,43],[34,50,43],[62,78,43],[-70,-54,68],[-30,-14,68],[12,28,68],[50,66,68]])k.jersey(x0,x1,z,z+.7);
 // Merlon et tranchées (sud)
 k.trench([[-82,78],[-60,78],[-60,73],[-38,73],[-38,79],[-14,79]],1.4,1.45,'sandbag');k.trench([[82,78],[60,78],[60,73],[38,73],[38,79],[14,79]],1.4,1.45,'sandbag');
 for(const x of[-8,0,8])k.bags(x-2,x+2,74,74.8);
 // Arrière nord : route de service, conteneurs, poste de garde
 for(const[x,z,r,y,c]of[[-78,-78,0,0,0],[-78,-78,0,2.6,2],[-50,-78,1,0,1],[-26,-76,0,0,3],[0,-79,0,0,2],[0,-79,0,2.6,0],[28,-76,1,0,1],[54,-79,0,0,3],[80,-76,1,0,0],[80,-76,1,2.6,2]])k.container(x,z,r,y,c);
 hut(-44,-34,-30,-24,{zp:[D(-39)],xp:[D(-27)]});k.bags(-30,-28,-34,-33.2);k.bags(32,36,-33,-32.2);
 // Sol
 const R=(x0,x1,z0,z1,c)=>k.paints.push({t:'rect',x0,x1,z0,z1,c});
 R(-S-2,S+2,44,68,'#403f3d');R(-S-2,S+2,-34,36,'rgba(84,82,78,.55)');R(-S-2,S+2,-70,-66,'rgba(70,68,64,.8)');
 for(let x=-82;x<82;x+=10)R(x,x+5,55.75,56.25,'rgba(232,228,214,.82)');for(const s of[-1,1])for(let i=0;i<7;i++)R(s<0?-86:80,s<0?-80:86,47+i*2.8,48.3+i*2.8,'rgba(232,228,214,.85)');
 R(-S,S,45,45.25,'rgba(232,228,214,.6)');R(-S,S,66.75,67,'rgba(232,228,214,.6)');R(-S,S,38.8,39.1,'rgba(226,190,60,.6)');for(const x of[-44,44])R(x-.15,x+.15,-34,44,'rgba(226,190,60,.5)');
 k.paths.push({pts:[[-88,39],[88,39]],w:8,c:'#4b4944'},{pts:[[-44,39],[-44,-34]],w:7,c:'#4b4944'},{pts:[[44,39],[44,-34]],w:7,c:'#4b4944'},{pts:[[-88,-70],[88,-70]],w:6,c:'#47443e'});
 k.paints.push({t:'H',x:-2,z:-14,r:6});for(const[x,z,s,c]of[[120,-90,10,0x35322e],[-130,50,12,0x45413a],[50,130,9,0x2d2b28]])k.fume(x,z,s,c,60);
 k.far(44,S+34,210,6,22,'far');for(let i=0;i<14;i++){const a=i*.45+.4,r=k.rnd(190,235);k.dbox(Math.cos(a)*r,0,Math.sin(a)*r,k.rnd(60,110),k.rnd(16,34),k.rnd(40,70),'farM',a)}
 // Apparitions : équipes aux extrémités ouest/est, centre réservé au chacun pour soi
 for(const p of[[-83,-30],[-84,-6],[-84,42],[-82,64],[-76,-86],[-52,-86],[-78,-2],[-60,40],[83,-30],[84,-6],[85,42],[82,64],[76,-86],[52,-86],[78,-5],[60,42],[-10,-20],[12,-22],[0,-6],[26,8],[-8,62],[6,-72],[-24,38],[22,40]])k.sp(...p);
 k.smoke=k.smoke.filter(s=>s.sz>5);k.scatter(260,'rubble');k.scatter(50,'shrub');dress(k,BT["sept-vents"],9151);return k}
/* RAFFINERIE NOIRVAL : parcs de cuves NO/NE, unité de distillation au centre, racks de tuyaux avec passerelles à 3.6 et 7 m, entrepôts, gare de triage au sud. */
function mapRaf(){const S=88,k=new Kit('refinery',S,6203);k.chunk=60;k.limit('concrete');
 /* passerelle sur poteaux : axe x ou z, hauteur y, garde-corps des deux côtés sauf aux ouvertures (liste de centres) */
 const walk=(x0,x1,z0,z1,y,gaps=[])=>{k.slab(x0,x1,z0,z1,y,'plate',.15);const lx=x1-x0>=z1-z0,L0=lx?x0:z0,L1=lx?x1:z1,cuts=[...gaps].sort((a,b)=>a-b);let u=L0;const seg=(a,b)=>{if(b-a<.3)return;if(lx){k.rail(a,b,z0-.07,z0,y);k.rail(a,b,z1,z1+.07,y)}else{k.rail(x0-.07,x0,a,b,y);k.rail(x1,x1+.07,a,b,y)}};for(const c of cuts){seg(u,c-1.3);u=c+1.3}seg(u,L1);
  const n=Math.max(1,Math.round((L1-L0)/9));for(let i=0;i<=n;i++){const t=L0+(L1-L0)*i/n,p=Math.min(L1-.2,Math.max(L0,t-.1));for(const s of[0,1]){if(lx){const q=s?z1-.2:z0;k.box(p,p+.2,0,y-.15,q,q+.2,'steel')}else{const q=s?x1-.2:x0;k.box(q,q+.2,0,y-.15,p,p+.2,'steel')}}}};
 /* rack de tuyaux au-dessus de 2.5 m : on passe dessous, la passerelle court dessus */
 const pipes=(x0,x1,z,y,c=3)=>{for(let i=0;i<c;i++)hcyl(k,(x0+x1)/2,y+.28,z-.55+i*.55,.2,x1-x0,'x',i%2?'pipeR':'pipeY',7)};
 /* parcs de cuves avec merlon bas percé */
 const farm=(cx,cz,sx,sz)=>{for(let i=0;i<3;i++)for(let j=0;j<2;j++)if(!(i===2&&j===1))tank(k,cx+sx*i*14,cz+sz*j*15,5.4,7.6-(i+j)%2*1.6);
  const a=Math.min(cx-7,cx+sx*35),b=Math.max(cx-7,cx+sx*35),c=Math.min(cz-7.5,cz+sz*22.5),d=Math.max(cz-7.5,cz+sz*22.5),mx=(a+b)/2,mz=(c+d)/2;for(const q of[c,d]){k.box(a,mx-2.5,0,1.05,q-.3,q+.3,'conc');k.box(mx+2.5,b,0,1.05,q-.3,q+.3,'conc')}for(const q of[a,b]){k.box(q-.3,q+.3,0,1.05,c+.3,mz-2.5,'conc');k.box(q-.3,q+.3,0,1.05,mz+2.5,d-.3,'conc')}};
 farm(-74,-72,1,1);farm(74,-72,-1,1);
 // Unité de distillation : 4 colonnes, plateforme à 3.6 m, plateforme haute à 7 m
 for(const[x,z,r,h]of[[-9,-9,2.5,17],[9,-9,2.1,14],[-9,9,2.1,14],[9,9,2.5,17]]){k.dcyl(x,h/2,z,r,h,'tank',16);k.dcyl(x,h+.5,z,r,1,'steel',16,0,0,r*.25);k.disc(x,z,r,0,h+.4,'metal');for(let y=3;y<h;y+=3.4)k.dcyl(x,y,z,r+.05,.1,'steel',16)}
 k.slab(-17,17,-3.2,3.2,3.6,'plate',.18);k.rail(-15,17,-3.27,-3.2,3.6);k.rail(-17,15,3.2,3.27,3.6);for(const x of[-17,-6,6,16.8])for(const z of[-3.2,3])k.box(x,x+.2,0,3.42,z,z+.2,'steel');
 k.stairs(-17-14*.42,0,2,'x+',0,3.6,'plate');k.stairs(17+14*.42,0,2,'x-',0,3.6,'plate');
 k.slab(-3,3,-15,15,7,'plate',.18,[-1,1,-1.6,4]);for(const s of[-3.07,3])k.rail(s,s+.07,-15,15,7);for(const z of[-15,15])k.rail(-3,3,z,z+.07,7);for(const x of[-3,2.8])for(const z of[-15,-7,7,14.8])k.box(x,x+.2,0,6.82,z,z+.2,'steel');
 k.stairs(0,-1.5,1.9,'z+',3.6,7,'plate');
 k.dbox(0,6.74,-2.4,.8,.08,.8,'lampA');k.glow(0,0,11,'#ffb060',.2);k.light(0,6.4,0,0xffb878,32,30,2);
 // Racks principaux est-ouest avec passerelle à 3.6 m
 for(const z of[-27,27]){pipes(-62,62,z,2.9);walk(-62,62,z-1,z+1,3.6,[-46,46,z<0?-16:16]);}
 {const R=14*.42;k.stairs(-46,-26+R,2,'z-',0,3.6,'plate');k.stairs(46,-28-R,2,'z+',0,3.6,'plate');k.stairs(-46,28+R,2,'z-',0,3.6,'plate');k.stairs(46,26-R,2,'z+',0,3.6,'plate')}
 // Liaisons nord-sud en hauteur vers le centre
 walk(-17,-15,-26,-3.2,3.6,[]);walk(15,17,3.2,26,3.6,[]);
 // Entrepôts traversants
 const shed=(x0,x1,z0,z1)=>{const cz=(z0+z1)/2,cx=(x0+x1)/2;k.room(x0,x1,z0,z1,0,6.6,{xn:[D(cz,5,4.2)],xp:[D(cz,5,4.2)],zn:[D(cx,3,2.7)],zp:[D(cx,3,2.7)]},'corr',.35);k.box(x0-.4,x1+.4,6.6,7,z0-.4,z1+.4,'rust');k.slab(x0+.35,x0+5,z0+.35,z1-.35,3.2,'plate',.18);k.rail(x0+5,x0+5.07,z0+.35,cz-1.4,3.2);k.rail(x0+5,x0+5.07,cz+1.4,z1-.35,3.2);k.stairs(x0+5+12*.42,cz,2.4,'x-',0,3.2,'plate');for(const q of[z0+3,z1-3]){k.crate(x1-3,q,1.6);k.crate(x1-5,q,1.2)}for(const x of[cx-4,cx+6])k.dbox(x,6.1,cz,1.6,.08,.4,'lampW')};
 shed(-62,-36,37,57);shed(36,62,37,57);k.light(-49,5.6,47,0xffe6c8,60,26,1);k.light(49,5.6,47,0xffe6c8,60,26,1);
 // Gare de triage (sud) : voies, wagons-citernes, wagons plats, quai
 const wagon=(x,z,tankCar)=>{k.box(x-6,x+6,.5,1,z-1.3,z+1.3,'steel');for(const u of[-4.2,4.2])k.box(x+u-1,x+u+1,0,.5,z-1.1,z+1.1,'frame');if(tankCar){hcyl(k,x,2.2,z,1.25,11,'x','tank',12)}else k.container(x,z,false,1,(Math.abs(x)|0)%4)};
 for(const[x,z,c]of[[-72,72,1],[-44,72,0],[-30,72,1],[6,72,0],[20,72,1],[58,72,0],[-58,80,0],[-16,80,1],[-2,80,1],[34,80,0]])wagon(x,z,c);
 k.box(-24,8,0,1.05,62,65,'conc');k.stairs(-24-4*.42,63.5,2,'x+',0,1.05,'conc');k.stairs(8+4*.42,63.5,2,'x-',0,1.05,'conc');for(const x of[-18,-6,4])k.crate(x,63.5,1.2,1.2,1.05);
 // Couverts : conteneurs, chaudières, véhicules
 for(const[x,z,r,y,c]of[[-34,-10,1,0,1],[-34,-10,1,2.6,3],[34,12,1,0,2],[-58,-6,0,0,0],[58,8,0,0,3],[58,8,0,2.6,1],[-24,-50,0,0,2],[24,50,0,0,0],[-6,-56,1,0,3],[6,56,1,0,1],[-82,12,1,0,2],[82,-12,1,0,0]])k.container(x,z,r,y,c);
 for(const[x,z]of[[-46,-8],[46,6],[-22,16],[22,-18]]){hcyl(k,x,1.3,z,1.3,6,'z','rust',10);k.box(x-.9,x+.9,0,.4,z-2.6,z-2,'conc');k.box(x-.9,x+.9,0,.4,z+2,z+2.6,'conc')}
 k.truck(-70,-14,true,false);k.truck(70,16,true,true);k.apc(0,-44,true);k.apc(4,42,true);for(const[x,z]of[[-28,4],[28,-4],[-50,18],[50,-18],[-14,-40],[14,38],[-72,28],[72,-30]])k.crate(x,z,1.6);
 for(const p of[[-30,18],[-29,19],[30,-20],[31,-19],[-66,-12],[66,12]])k.barrel(...p,'rust');for(const[a,b,c,d]of[[-42,-36,-18,-17.3],[36,42,17.3,18],[-12,-6,20,20.7],[6,12,-20.7,-20],[-82,-76,0,.7],[76,82,0,.7]])k.jersey(a,b,c,d);
 // Cheminée à torche (repère lointain)
 {const x=0,z=-78;k.dcyl(x,15,z,1.25,30,'rust',12,0,0,.65);k.disc(x,z,1.25,0,6,'metal');k.dbox(x,30,z,.5,.5,.5,'lampA');k.fume(x,z,7,0x2e2a28,70)}
 // Sol
 const R=(x0,x1,z0,z1,c)=>k.paints.push({t:'rect',x0,x1,z0,z1,c});R(-S-2,S+2,67,86,'rgba(58,52,46,.8)');for(const z of[72,80]){for(const o of[-.85,.85])R(-S-2,S+2,z+o-.05,z+o+.05,'rgba(120,118,112,.9)');for(let x=-S;x<S;x+=1.2)R(x,x+.28,z-1.1,z+1.1,'rgba(52,42,32,.9)')}
 R(-S,S,-1,1,'rgba(226,190,60,.16)');k.paths.push({pts:[[-88,-38],[88,-38]],w:6,c:'#3d3b39'},{pts:[[-88,38],[88,38]],w:6,c:'#3d3b39'},{pts:[[-30,-88],[-30,66]],w:5,c:'#3d3b39'},{pts:[[30,-66],[30,88]],w:5,c:'#3d3b39'});
 k.far(46,S+36,214,8,30,'farU');for(let i=0;i<8;i++){const a=i*.8+.3,r=k.rnd(150,210);k.dcyl(Math.cos(a)*r,18,Math.sin(a)*r,3,36,'farU',8,0,0,1.8)}for(const[x,z,s,c]of[[-140,-60,12,0x2a2522],[110,120,10,0x342e2a]])k.fume(x,z,s,c,70);
 for(const p of[[-84,-40],[-84,-20],[-85,2],[-85,22],[-84,46],[-82,62],[-52,-84],[-66,84],[84,-46],[85,-22],[85,4],[85,24],[84,40],[82,62],[52,84],[66,-84],[-2,-24],[2,24],[-20,-6],[20,6],[-12,44],[12,-46],[-30,60],[26,-62]])k.sp(...p);
 k.smoke=k.smoke.filter(s=>s.sz>5);k.scatter(260,'rubble');dress(k,BT["noirval"],9168);return k}
/* VAL DE CENDRE : rivière à sec nord-sud entre deux digues, trois ponts, gués, village sur chaque rive, terrasses au nord jusqu'à une crête fortifiée. */
function mapVal(){const S=88,k=new Kit('valley',S,5519);k.chunk=60;k.perimeter(6,'rock');
 // Digues (2.6 m) coupées par deux gués au niveau du lit
 for(const s of[-1,1])for(const[a,b]of[[-88,-62],[-54,50],[58,88]]){const x0=s<0?-17:7,x1=s<0?-7:17;k.box(x0,x1,0,2.6,a,b,'stone');k.vis(x0+.02,x1-.02,2.6,2.63,a+.02,b-.02,'rock')}
 const levee=(z,s)=>{k.stairs(s*(17+4.2),z,2,s<0?'x+':'x-',0,2.6,'stone');k.stairs(s*(7-4.2),z,2,s<0?'x-':'x+',0,2.6,'stone')};
 for(const z of[-44,-18,14,40])for(const s of[-1,1])levee(z+(s>0?4:0),s);for(const s of[-1,1]){k.stairs(s*12,-62+10*.42,3,'z-',0,2.6,'stone');k.stairs(s*(17+4.2),72,2,s<0?'x+':'x-',0,2.6,'stone')}
 // Trois ponts
 k.bridge(-7,7,-3,3,2.6,'woodD');for(const x of[-5,0,5])for(const z of[-3,2.8])k.box(x,x+.25,0,2.44,z,z+.2,'woodD');k.bridge(-7,7,-37,-34.6,2.6,'wood');k.bridge(-7,7,31,33.4,2.6,'wood');for(const z of[-37,-34.8,31,33.2])for(const x of[-3.5,3.3])k.box(x,x+.2,0,2.44,z,z+.2,'woodD');
 for(const[x,z,a,b,h]of[[-3,-21.6,1.6,1.3,.8],[3.5,-48,1.9,1.5,.82],[-3.6,17.6,1.5,1.2,.78],[2.8,47.6,1.8,1.4,.8],[0,-74,2,1.5,.82],[-2,66,1.7,1.3,.78]]){k.box(x-a,x+a,0,h*.75,z-b,z+b,'rock');k.box(x-a*.62,x+a*.7,h*.75,h*1.4,z-b*.6,z+b*.55,'rock')}
 for(const[x0,x1,z,y]of[[-16,-11,-26,2.6],[11,16,22,2.6],[-16,-11,24,2.6],[11,16,-24,2.6]])k.box(x0,x1,y,y+1.05,z,z+.6,'stone');
 // Maisons
 const hs=(x0,x1,z0,z1,m,pitch)=>{const cx=(x0+x1)/2,cz=(z0+z1)/2;k.house(x0,x1,z0,z1,{m,doors:{zp:[cx],xn:[cz],xp:[cz]},stair:'zn'});if(!pitch)return;const dx=x1-x0,dz=z1-z0,lx=dx>=dz,h=2.4;k.ops.push({t:'p',x:cx,y:6,z:cz,w:(lx?dx:dz)+.7,d:(lx?dz:dx)+.7,h,ry:lx?0:Math.PI/2,m:'tile'});const hw=((lx?dx:dz)+.7)/2,hd=((lx?dz:dx)+.7)/2;for(const[a,b,f]of[[6,6.4,1],[6.4,6.8,.834],[6.8,7.2,.667],[7.2,7.6,.5],[7.6,8,.334],[8,8.4,.167]])lx?k.col(cx-hw,cx+hw,a,b,cz-hd*f,cz+hd*f,'wood'):k.col(cx-hd*f,cx+hd*f,a,b,cz-hw,cz+hw,'wood')};
 const H=[[-78,-66,-46,-34,'stone',1],[-58,-46,-46,-34,'plasterB',1],[-38,-24,-46,-34,'stone',0],[-76,-64,-14,-2,'plasterO',1],[-52,-40,-14,-2,'stone',1],[-78,-66,10,22,'stone',1],[-54,-42,10,22,'plasterB',0],[-74,-60,36,48,'plasterO',1],[-44,-30,36,48,'stone',1]];
 for(const[a,b,c,d,m,p]of H){hs(a,b,c,d,m,p);hs(-b,-a,-d,-c,m,p)}
 // Terrasses nord (1.6, 3.2, 4.8 m) sur chaque rive
 for(const s of[-1,1]){const X=(a,b)=>s<0?[a,b]:[-b,-a];for(const[z0,z1,y]of[[-62,-50,1.6],[-74,-62,3.2],[-87.9,-74,4.8]]){const[a,b]=X(-87.9,-20);k.box(a,b,0,y,z0,z1,'stone');k.vis(a+.02,b-.02,y,y+.03,z0+.02,z1-.02,'rock')}
  for(const x of[s>0?-76.5:-74,-48,-27]){const q=s*-x;k.stairs(q,-50+6*.42,2.2,'z-',0,1.6,'stone')}for(const x of[-62,-36]){const q=s*-x;k.stairs(q,-62+6*.42,2.2,'z-',1.6,3.2,'stone')}for(const x of[-78,-50,-26]){const q=s*-x;k.stairs(q,-74+6*.42,2.2,'z-',3.2,4.8,'stone')}
  // Crête fortifiée : casemate, sacs, créneaux
  const y=4.8,cx=s*52,x0=cx-7,x1=cx+7,z0=-86,z1=-78;k.room(x0,x1,z0,z1,y,y+2.7,{zp:[W(cx-4,1.5,1.05,1.75),W(cx,1.5,1.05,1.75),W(cx+4,1.5,1.05,1.75)],zn:[D(cx,2.2,2.4)],xn:[D(-82,2.2,2.4)],xp:[D(-82,2.2,2.4)]},'conc',.4);k.box(x0-.4,x1+.4,y+2.7,y+3.2,z0-.4,z1+.4,'conc');
  for(const[a,b]of[[28,34],[38,44],[60,70],[74,76.4],[79.6,84]]){const[p,q]=s<0?[-b,-a]:[a,b];k.box(p,q,y,y+1.15,-75.2,-74.5,'sandbag')}for(const[a,b,c]of[[28,30,-82],[68,70,-82]]){const[p,q]=s<0?[-b,-a]:[a,b];k.box(p,q,y,y+1.15,c,c+3,'sandbag')}
  for(const[x,z,t]of[[32,-56,1.6],[66,-57,1.6],[44,-68,3.2],[74,-68,3.2],[34,-80,4.8]])tree(k,s*x,z,t,.9,(x+z)%2?'leafA':'leaf')}
 // Places, murets, charrettes, couverts
 for(const[x0,x1,z0,z1]of[[-34,-22,29,29.8],[22,34,-29.8,-29],[-62,-58,-24,-20],[58,62,20,24],[-36,-34,-22,-14],[34,36,14,22],[-82,-70,28,28.8],[70,82,-28.8,-28],[-58,-46,54,54.8],[46,58,-54.8,-54],[-30,-20,56,56.8],[20,30,62,62.8],[-78,-70,62,62.8],[66,78,70,70.8],[-46,-34,70,70.8],[36,50,78,78.8]])k.box(x0,x1,0,1.05,z0,z1,'stone');
 k.truck(-26,-20,false,true);k.truck(44,28,true,false);k.apc(-62,28,true);k.apc(60,-30,false);for(const[x,z]of[[-30,18],[30,-18],[-20,-28],[22,30],[-62,-22],[62,4],[-40,6],[40,-22],[-24,50],[26,52],[-70,54],[70,62],[-54,74],[54,74]])k.crate(x,z,1.5);for(const p of[[-29,17],[29,-16.6],[-44,28],[44,-30]])k.barrel(...p);
 for(const[x,z,m]of[[-84,-20,'leaf'],[-58,-26,'leafA'],[-22,-52+6,'leaf'],[-84,30,'leafA'],[-52,30,'leaf'],[-26,6,'leafA'],[-66,58,'leaf'],[-40,62,'leafA'],[-26,76,'leaf'],[-58,80,'leafA'],[-76,76,'leaf'],[84,18,'leaf'],[58,-26,'leafA'],[24,44,'leaf'],[84,-32,'leafA'],[52,-30,'leaf'],[26,-6,'leafA'],[66,56,'leaf'],[40,62,'leafA'],[26,78,'leaf'],[58,82,'leafA'],[76,78,'leaf']])if(k.free(x,z,.9))tree(k,x,z,0,k.rnd(.9,1.25),m);
 k.dbox(0,3.8,3,.2,.3,.2,'lampA');k.dcyl(0,3.2,3,.05,1.2,'steel',5);k.light(0,3.9,1,0xffc890,8,14,2);k.light(-52,2.7,-40,0xffc080,5,10,2);k.light(52,2.7,40,0xffc080,5,10,2);for(const[x,z]of[[-52,-40],[52,40],[-48,16],[48,-16]]){k.dbox(x,2.85,z,.25,.12,.25,'lampA');k.glow(x,z,3.6,'#ffb46a',.2)}
 // Sol : lit de rivière, chemins
 k.paints.push({t:'rect',x0:-7,x1:7,z0:-S-2,z1:S+2,c:'rgba(150,146,128,.72)'},{t:'rect',x0:-3,x1:3,z0:-S-2,z1:S+2,c:'rgba(112,120,112,.35)'});k.paths.push({pts:[[-88,26],[-22,26],[-22,0],[-17,0]],w:4,c:'#6e6248'},{pts:[[88,-26],[22,-26],[22,0],[17,0]],w:4,c:'#6e6248'},{pts:[[-62,-48],[-62,50]],w:3,c:'#6e6248'},{pts:[[62,-48],[62,50]],w:3,c:'#6e6248'},{pts:[[-60,58],[60,58]],w:3.5,c:'#6e6248'});
 for(let i=0;i<34;i++){const a=i/34*6.283+.1,r=k.rnd(124,172),h=k.rnd(46,104),R=k.rnd(34,62),x=Math.cos(a)*r,z=Math.sin(a)*r;k.ops.push({t:'c',x,y:h/2-2,z,r:R,r2:0,h,m:'farR',seg:7,rx:0,rz:0},{t:'c',x,y:h*.86-2,z,r:R*.285,r2:0,h:h*.28,m:'farS',seg:7,rx:0,rz:0})}
 for(const p of[[-85,-26],[-84,4],[-85,28],[-66,-27],[-62,4],[-84,52],[-44,56],[-62,60],[85,-26],[84,-4],[85,28],[66,27],[62,-4],[84,52],[44,56],[62,60],[0,-28],[1,22],[-22,-10],[22,10],[0,-68],[0,70],[-30,24],[30,-24]])k.sp(...p);
 k.scatter(180,'rubble');k.scatter(150,'shrub');k.inst=k.inst.filter(i=>i.k!=='shrub'||!H.some(([a,b,c,d])=>(i.x>a&&i.x<b&&i.z>c&&i.z<d)||(i.x>-b&&i.x<-a&&i.z>-d&&i.z<-c)));return k}
/* cartes ajoutées par module (voir registerMap) */let extMat=null;const LSTEPS={};const LAYOUT={'depot':mapDepot,'vieille-ville':mapVille,'port':mapPort,'bunker':mapBunker,'col-blanc':mapCol,'sept-vents':mapAir,'noirval':mapRaf,'val-cendre':mapVal};
export{Kit};export function registerMap(o){LAYOUT[o.id]=o.build;if(o.steps)LSTEPS[o.id]=o.steps;if(o.env)Object.assign(ENV,o.env);if(o.mats)extMat=o.mats;if(o.meta&&!MAPS.some(m=>m.id===o.id))MAPS.push(o.meta)}/* Layout pur (sans three) : utile aux tests headless. */
export function buildLayout(id){const f=LAYOUT[id];if(!f)throw new Error('Carte inconnue : '+id);return f()}

/* ---------- RENDU (three.js) ---------- */
const ENV={
 desert:{sky:[[0,'#546a78'],[.3,'#879599'],[.46,'#cdbfa6'],[.5,'#dfcca8'],[.53,'#a18f75'],[1,'#5f5444']],halo:'255,226,170',clouds:420,cloudDark:'70,74,78',cloudLight:'245,236,220',sun:[52,46,18],sunCol:0xffd9a0,sunI:3.4,hemi:[0xbcd2e6,0x8a6f4c,.95],fog:[0xc9bda6,.0058],exp:.84,envI:.85,ground:'#a48f6b',gsurf:'sand',part:{n:170,col:0xe8dcc0,size:.035,op:.42,mode:'dust'}},
 urban:{sky:[[0,'#4b4f55'],[.3,'#77746e'],[.46,'#a89a86'],[.5,'#b9a084'],[.53,'#6e6358'],[1,'#3a342e']],halo:'255,190,120',clouds:520,cloudDark:'50,48,46',cloudLight:'190,180,165',sun:[-34,30,-42],sunCol:0xffbe7a,sunI:3.0,hemi:[0xaebcd2,0x70583f,1.05],fog:[0xa79e90,.0062],exp:1.52,envI:.8,ground:'#77705f',gsurf:'concrete',part:{n:140,col:0xff8a3a,size:.05,op:.85,mode:'ember'}},
 port:{sky:[[0,'#1d2540'],[.28,'#45496e'],[.42,'#b0687a'],[.48,'#f39a5a'],[.5,'#ffc27a'],[.53,'#4a3a3a'],[1,'#1c1a1e']],halo:'255,160,90',clouds:300,cloudDark:'60,40,60',cloudLight:'255,170,130',sun:[-62,11,80],sunCol:0xff9550,sunI:3.0,hemi:[0x8c98d6,0x5a4548,1.05],fog:[0x84707c,.0058],exp:1.78,envI:1.0,ground:'#4c4b4a',gsurf:'concrete',part:{n:120,col:0xd6dcf0,size:.03,op:.28,mode:'dust'}},
 bunker:{sky:[[0,'#aab2ba'],[.25,'#5a6066'],[.5,'#3a3e42'],[1,'#1c1e20']],halo:null,clouds:0,sun:null,hemi:[0xd0d3d6,0xb0aaa2,1.2],fog:[0x161a1e,.011],exp:.56,envI:.8,bake:3.4,ground:'#908d85',gsurf:'concrete',part:{n:160,col:0xbfc8c0,size:.022,op:.4,mode:'dust'}},
 snow:{sky:[[0,'#4f76a8'],[.3,'#7fa3c9'],[.46,'#c5d6e6'],[.5,'#e4ecf3'],[.53,'#b8c4d2'],[1,'#7a8492']],halo:'225,236,250',clouds:560,cloudDark:'120,136,160',cloudLight:'250,252,255',sun:[40,32,-52],sunCol:0xfff1dc,sunI:2.6,hemi:[0x9fbde0,0x6f83a0,.62],fog:[0xbfd0e2,.0055],exp:.61,envI:.6,mtn:1,ground:'#e6ebf0',gsurf:'snow',part:{n:900,col:0xffffff,size:.055,op:.85,mode:'snow'}},
};
/* ambiances des grandes cartes (as : ambiance sonore et vignette du menu, gt : type de sol) */Object.assign(ENV,{airbase:{as:'desert',gt:'port',sky:[[0,'#2c64a0'],[.28,'#659fce'],[.44,'#b4d2e4'],[.495,'#dbe6e6'],[.5,'#e6e4d6'],[.53,'#8d8266'],[1,'#57503f']],halo:'255,244,214',clouds:140,cloudDark:'120,134,150',cloudLight:'255,255,255',sun:[-46,52,30],sunCol:0xfff0d6,sunI:3.3,hemi:[0xb8d4ee,0x7c705a,.72],fog:[0xbcd3e2,.0042],exp:.76,envI:.75,ground:'#7d7666',gsurf:'concrete',part:{n:120,col:0xe8dcc0,size:.03,op:.34,mode:'dust'}}});
Object.assign(ENV,{refinery:{as:'port',gt:'port',sky:[[0,'#20222e'],[.26,'#4a4450'],[.42,'#a4624a'],[.485,'#e88a44'],[.5,'#f6b062'],[.53,'#3e3430'],[1,'#17151a']],halo:'255,150,80',clouds:420,cloudDark:'38,32,36',cloudLight:'220,130,90',sun:[58,13,-66],sunCol:0xffa060,sunI:2.9,hemi:[0xb4b2bc,0x7a6e62,1.2],fog:[0x8a7264,.0044],exp:1.38,envI:.9,ground:'#77726a',gsurf:'concrete',part:{n:130,col:0xffa860,size:.035,op:.5,mode:'ember'}}});
Object.assign(ENV,{valley:{as:'urban',gt:'desert',sky:[[0,'#3a6690'],[.3,'#7699b4'],[.46,'#b9c6c6'],[.5,'#cfc8b2'],[.53,'#6f6c56'],[1,'#3a3b30']],halo:'255,236,200',clouds:480,cloudDark:'96,100,104',cloudLight:'246,242,232',sun:[50,34,44],sunCol:0xffe6c0,sunI:2.35,hemi:[0xc0d2de,0x6a6448,.74],fog:[0xa9bcc6,.0045],exp:.84,envI:.72,ground:'#5a5a3e',gsurf:'sand',part:{n:110,col:0xd8b070,size:.04,op:.5,mode:'dust'}}});
const UVS={crate:1.5,sandbag:2.1,hesco:2.2,brick:2,stone:2.6,plate:1.6,tile:2,wood:2,woodD:2,snow:5,rock:4,rockS:4,corr:3,rust:3,panel:2.4,ceil:3,bwall:3.4,conc:4,far:18,farM:18,farU:18};

export function createWorld(scene,renderer){
 let seed=99;const rnd=(a,b)=>{seed=(seed*16807)%2147483647;return a+(seed/2147483647)*(b-a)};
 const cnv=(w,h=w)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
 /* loadAsync : la peinture des textures est mise en file (`later`) puis exécutée par tranches ; load (synchrone) peint tout de suite.
    Le canvas source est lu par nmap : willReadFrequently évite une relecture GPU par texture. */
 let later=null;const defer=f=>{later?later.push(f):f()};
 function tex(base,fn,size=256){const c=cnv(size),t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
  defer(()=>{const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle=base;x.fillRect(0,0,size,size);for(let i=0,N=size*size*.04;i<N;i++){x.fillStyle=`rgba(${rnd(0,1)<.5?'0,0,0':'255,255,255'},${rnd(0,.045)})`;x.fillRect(rnd(0,size),rnd(0,size),rnd(1,5),rnd(1,5))}fn&&fn(x,size);t.needsUpdate=true});return t}
 function nmap(t,str=2.4){const c=t.image,w=c.width,h=c.height,o=cnv(w,h),n=new THREE.CanvasTexture(o);n.wrapS=n.wrapT=THREE.RepeatWrapping;n.anisotropy=4;
  defer(()=>{const s=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data,x=o.getContext('2d'),im=x.createImageData(w,h),d=im.data,q=str/255;
   for(let j=0;j<h;j++){const r0=j*w,ru=((j+1)%h)*w,rd=((j+h-1)%h)*w;for(let i=0;i<w;i++){const dx=(s[(r0+(i+1)%w)*4]-s[(r0+(i+w-1)%w)*4])*q,dy=(s[(ru+i)*4]-s[(rd+i)*4])*q,l=Math.sqrt(dx*dx+dy*dy+1),k=(r0+i)*4;d[k]=(-dx/l+1)*127.5;d[k+1]=(dy/l+1)*127.5;d[k+2]=(1/l+1)*127.5;d[k+3]=255}}
   x.putImageData(im,0,0);n.needsUpdate=true});return n}
 const streaks=(x,s,n)=>{for(let i=0;i<n;i++){const l=rnd(s*.15,s*.65),g=x.createLinearGradient(0,0,0,l);g.addColorStop(0,`rgba(25,20,14,${rnd(.1,.32)})`);g.addColorStop(1,'rgba(25,20,14,0)');x.fillStyle=g;x.fillRect(rnd(0,s),0,rnd(2,11),l)}};
 /* Usure : bruit périodique calculé sur 66 px puis agrandi une seule fois (ni flou de canvas, ni ellipse) : taches douces, irrégulières, raccord de tuile exact. */
 const stainC=cnv(66),stainX=stainC.getContext('2d',{willReadFrequently:true}),stainI=stainX.createImageData(66,66);
 const stainN=P=>{const g=new Float32Array(P*P);for(let i=0;i<P*P;i++)g[i]=rnd(0,1);return(u,v)=>{const X=u*P,Y=v*P,a=Math.floor(X),b=Math.floor(Y),f=X-a,h=Y-b,p=f*f*(3-2*f),q=h*h*(3-2*h),i0=(a%P+P)%P,j0=(b%P+P)%P,i1=(i0+1)%P,j1=(j0+1)%P;return(g[j0*P+i0]*(1-p)+g[j0*P+i1]*p)*(1-q)+(g[j1*P+i0]*(1-p)+g[j1*P+i1]*p)*q}};
 const blotch=(x,s,n,c)=>{const[r,g,b]=c.split(',').map(Number),A=stainN(3+(rnd(0,3)|0)),B=stainN(7+(rnd(0,3)|0)),C=stainN(17),lo=.6-Math.min(.2,n/550),peak=Math.min(.32,.14+n/700),D=stainI.data;
  for(let j=0,k=0;j<66;j++)for(let i=0;i<66;i++,k+=4){const u=(i-1)/64,v=(j-1)/64,f=.56*A(u,v)+.3*B(u,v)+.14*C(u,v),t=Math.max(0,Math.min(1,(f-lo)/.2));D[k]=r;D[k+1]=g;D[k+2]=b;D[k+3]=255*peak*t*t*(3-2*t)}
  stainX.putImageData(stainI,0,0);const e=s/64;x.save();x.imageSmoothingEnabled=true;x.imageSmoothingQuality='low';x.drawImage(stainC,-e,-e,s+2*e,s+2*e);x.restore()};
 const cracks=(x,s,n)=>{x.strokeStyle='rgba(18,15,10,.6)';for(let i=0;i<n;i++){let a=rnd(0,s),b=rnd(0,s),t=rnd(0,6);x.lineWidth=rnd(.8,2);x.beginPath();x.moveTo(a,b);for(let k=0;k<12;k++){t+=rnd(-.7,.7);a+=Math.cos(t)*rnd(6,20);b+=Math.sin(t)*rnd(6,20);x.lineTo(a,b)}x.stroke()}};
 const bricks=(x,s,rows,cols,rgb,mortar,jit=14)=>{x.fillStyle=mortar;x.fillRect(0,0,s,s);const rh=s/rows;for(let r=0;r<rows;r++)for(let c=-1;c<=cols;c++){const v=rnd(-jit,jit),bx=(c+(r%2)*.5)*s/cols;x.fillStyle=`rgb(${rgb[0]+v},${rgb[1]+v},${rgb[2]+v})`;x.fillRect(bx+2,r*rh+2,s/cols-4,rh-4)}};
 const planks=(x,s,n,rgb)=>{for(let i=0;i<n;i++){const v=rnd(-16,16);x.fillStyle=`rgb(${rgb[0]+v},${rgb[1]+v},${rgb[2]+v})`;x.fillRect(0,i*s/n+1,s,s/n-3)}x.strokeStyle='rgba(30,20,10,.3)';for(let i=0;i<60;i++){const y=rnd(0,s);x.beginPath();x.moveTo(0,y);x.bezierCurveTo(s*.3,y+rnd(-5,5),s*.6,y+rnd(-5,5),s,y);x.stroke()}};
 const corrug=(x,s,a)=>{for(let i=0;i<24;i++){const g=x.createLinearGradient(i*s/24,0,(i+1)*s/24,0);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(.5,'rgba(0,0,0,.05)');g.addColorStop(1,'rgba(0,0,0,.34)');x.fillStyle=g;x.fillRect(i*s/24,0,s/24,s)}};
 const TP={
  conc:(x,s)=>{blotch(x,s,80,'58,48,34');streaks(x,s,42);cracks(x,s,5);x.strokeStyle='rgba(25,22,16,.55)';x.lineWidth=3;x.strokeRect(1,1,s-2,s-2);x.beginPath();x.moveTo(0,s/2);x.lineTo(s,s/2);x.stroke()},
  bwall:(x,s)=>{blotch(x,s,90,'74,78,82');streaks(x,s,50);cracks(x,s,6);x.strokeStyle='rgba(10,10,10,.6)';x.lineWidth=3;x.strokeRect(1,1,s-2,s-2);x.fillStyle='rgba(200,170,40,.55)';for(let i=0;i<8;i++){x.save();x.translate(i*s/8,s*.88);x.transform(1,0,-.8,1,0,0);x.fillRect(0,0,s/16,s*.12);x.restore()}},
  ceil:(x,s)=>{x.strokeStyle='rgba(8,8,8,.7)';x.lineWidth=4;for(let i=0;i<=2;i++){x.beginPath();x.moveTo(i*s/2,0);x.lineTo(i*s/2,s);x.moveTo(0,i*s/2);x.lineTo(s,i*s/2);x.stroke()}blotch(x,s,40,'60,62,64')},
  panel:(x,s)=>{x.strokeStyle='rgba(10,12,10,.6)';x.lineWidth=5;x.strokeRect(6,6,s-12,s-12);x.strokeRect(s/2,6,s/2-6,s/2);for(const p of[16,s-16])for(const q of[16,s-16]){x.fillStyle='#222';x.beginPath();x.arc(p,q,4,0,7);x.fill()}streaks(x,s,14)},
  plaster:(x,s)=>{blotch(x,s,70,'90,70,45');streaks(x,s,26);cracks(x,s,4);for(let i=0;i<2;i++){const a=rnd(0,s*.7),b=rnd(0,s*.7),w=rnd(34,92),h=rnd(22,56),N=9+(rnd(0,6)|0);x.save();x.beginPath();for(let q=0;q<N;q++){const t=q/N*6.283,d=rnd(.5,1.1);x.lineTo(a+w/2+Math.cos(t)*w/2*d,b+h/2+Math.sin(t)*h/2*d)}x.closePath();x.clip();bricks(x,s,16,5,[120,70,48],'#6a5a48',10);x.restore()}},
  stone:(x,s)=>{bricks(x,s,5,3,[134,126,110],'#5c564a',18);blotch(x,s,30,'40,35,25');streaks(x,s,18)},
  brick:(x,s)=>{bricks(x,s,12,4,[138,72,52],'#6d6150',16);blotch(x,s,30,'30,25,20');streaks(x,s,18)},
  wood:(x,s)=>planks(x,s,8,[118,88,56]),woodD:(x,s)=>{planks(x,s,7,[80,60,42]);blotch(x,s,20,'20,15,10')},
  crate:(x,s)=>{planks(x,s,6,[112,92,58]);x.strokeStyle='#463620';x.lineWidth=30;x.strokeRect(15,15,s-30,s-30);x.lineWidth=22;x.beginPath();x.moveTo(26,26);x.lineTo(s-26,s-26);x.stroke()},
  sandbag:(x,s)=>{for(let r=0;r<4;r++)for(let c=-1;c<3;c++){const bx=(c+(r%2)*.5)*s/2,by=r*s/4,v=rnd(-12,12),g=x.createLinearGradient(0,by,0,by+s/4);g.addColorStop(0,`rgb(${190+v},${172+v},${130+v})`);g.addColorStop(.65,`rgb(${156+v},${138+v},${100+v})`);g.addColorStop(1,`rgb(${88+v},${76+v},${54+v})`);x.fillStyle=g;x.beginPath();x.roundRect(bx+3,by+3,s/2-6,s/4-6,30);x.fill()}blotch(x,s,30,'50,40,25')},
  hesco:(x,s)=>{blotch(x,s,60,'70,55,35');x.strokeStyle='rgba(40,40,38,.8)';x.lineWidth=3;for(let i=0;i<=8;i++){x.beginPath();x.moveTo(i*s/8,0);x.lineTo(i*s/8,s);x.moveTo(0,i*s/8);x.lineTo(s,i*s/8);x.stroke()}x.lineWidth=6;x.strokeRect(0,0,s,s)},
  corr:(x,s)=>{corrug(x,s,.12);blotch(x,s,20,'40,40,30');streaks(x,s,26)},rust:(x,s)=>{corrug(x,s,.1);blotch(x,s,60,'110,50,20');streaks(x,s,30)},
  plate:(x,s)=>{for(let i=0;i<16;i++)for(let j=0;j<16;j++){x.save();x.translate((i+.5)*s/16,(j+.5)*s/16);x.rotate((i+j)%2?.8:-.8);x.fillStyle='rgba(255,255,255,.18)';x.fillRect(-6,-1.5,12,3);x.restore()}blotch(x,s,20,'60,40,20')},
  snow:(x,s)=>{blotch(x,s,70,'150,170,200');blotch(x,s,40,'255,255,255');for(let i=0;i<400;i++){x.fillStyle='rgba(255,255,255,.6)';x.fillRect(rnd(0,s),rnd(0,s),1.5,1.5)}},
  rock:(x,s)=>{blotch(x,s,90,'30,30,34');blotch(x,s,50,'150,150,150');cracks(x,s,14)},rockS:(x,s)=>{blotch(x,s,80,'40,42,48');cracks(x,s,10);blotch(x,s,70,'250,252,255')},
  tile:(x,s)=>{for(let r=0;r<8;r++)for(let c=0;c<8;c++){const v=rnd(-14,14);x.fillStyle=`rgb(${150+v},${80+v},${55+v})`;x.beginPath();x.arc((c+(r%2)*.5)*s/8,r*s/8+s/8,s/16,Math.PI,0);x.fill()}blotch(x,s,20,'40,30,20')},
  door:(x,s)=>{streaks(x,s,20);blotch(x,s,14,'80,45,25');x.strokeStyle='rgba(15,15,10,.7)';x.lineWidth=7;x.strokeRect(24,24,s-48,s-48)},
  tarp:(x,s)=>{blotch(x,s,50,'32,32,20');x.strokeStyle='rgba(20,20,12,.35)';x.lineWidth=5;for(let i=0;i<5;i++){x.beginPath();x.moveTo(i*s/4,0);x.quadraticCurveTo(i*s/4+18,s/2,i*s/4,s);x.stroke()}},
  farB:(x,s)=>{const R=6,C=6;for(let r=0;r<R;r++)for(let c=0;c<C;c++){const v=rnd(0,1);x.fillStyle=v<.1?'rgba(255,205,130,.7)':v<.55?'rgba(18,22,28,.5)':'rgba(30,34,40,.28)';x.fillRect((c+.22)*s/C,(r+.26)*s/R,s/C*.56,s/R*.46)}blotch(x,s,30,'28,28,32')},
  paint:(x,s)=>{blotch(x,s,44,'30,32,20');blotch(x,s,16,'92,52,28');streaks(x,s,14)},burn:(x,s)=>{blotch(x,s,70,'8,8,8');blotch(x,s,36,'104,54,26')},barrel:(x,s)=>{blotch(x,s,30,'110,54,24');streaks(x,s,18)},
 };
 /* Champ de lumière « cuit » (vue de dessus, comme les lueurs du sol) : les luminaires émissifs éclairent aussi murs, plafonds et
    objets sans vraie lumière. Les matériaux l'échantillonnent par position monde ; fzBakeK vaut 0 sur les cartes sans champ (ENV.bake). */
 const bakeC=cnv(512),bakeT=new THREE.CanvasTexture(bakeC);bakeT.colorSpace=THREE.SRGBColorSpace;bakeT.generateMipmaps=false;bakeT.minFilter=THREE.LinearFilter;
 const bakeU={map:{value:bakeT},k:{value:0},inv:{value:.01},look:{value:scene.userData.fzLook??1},mtn:{value:0}};scene.userData.fzLookU=bakeU.look;
 const bakeHook=m=>{m.onBeforeCompile=s=>{if(sfMod)sfMod.softenShader(s);s.uniforms.fzBake=bakeU.map;s.uniforms.fzBakeK=bakeU.k;s.uniforms.fzBakeInv=bakeU.inv;s.uniforms.fzLook=bakeU.look;s.uniforms.fzMtn=bakeU.mtn;
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 fzW;').replace('#include <project_vertex>','#include <project_vertex>\nfzW=(modelMatrix*vec4(transformed,1.)).xyz;');
   s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D fzBake;uniform float fzBakeK,fzBakeInv,fzLook,fzMtn;varying vec3 fzW;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nif(fzLook>.5){float fzM=sin(fzW.x*.43+1.7*sin(fzW.z*.19))*sin(fzW.z*.37+1.3*sin(fzW.y*.41+fzW.x*.13)),fzU=abs(inverseTransformDirection(normal,viewMatrix).y);diffuseColor.rgb*=(1.+.1*fzM)*mix(mix(.62,1.,smoothstep(0.,.75,fzW.y)),1.,fzU*fzU);\nif(fzMtn>.5&&dot(fzW.xz,fzW.xz)>7000.){float fzN=sin(fzW.x*.11+2.*sin(fzW.z*.07))+.6*sin(fzW.z*.23+fzW.y*.17+1.5*sin(fzW.x*.05))+.3*sin((fzW.x+fzW.z)*.53);diffuseColor.rgb=mix(vec3(.13,.16,.22)*(1.+.25*fzN),vec3(.82,.87,.95),smoothstep(23.,36.,fzW.y+7.*fzN));}}\nif(fzBakeK>0.)totalEmissiveRadiance+=diffuseColor.rgb*texture2D(fzBake,vec2(.5+fzW.x*fzBakeInv,.5-fzW.z*fzBakeInv)).rgb*(fzBakeK*(.55+.45*smoothstep(0.,3.,fzW.y)));')};return m};
 function paintBake(L,E){const S=L.size,x=bakeC.getContext('2d'),k=512/(2*S+4),W2=v=>(v+S+2)*k;x.globalCompositeOperation='source-over';x.fillStyle='#000';x.fillRect(0,0,512,512);bakeU.k.value=E.bake||0;bakeU.inv.value=1/(2*S+4);
  if(E.bake){x.globalCompositeOperation='lighter';for(const g of L.glows){const r=g.r*1.9*k,G=x.createRadialGradient(W2(g.x),W2(g.z),0,W2(g.x),W2(g.z),r),c=parseInt(g.color.slice(1),16),q=(c>>16)+','+(c>>8&255)+','+(c&255),a=Math.min(1,g.a*2.3);G.addColorStop(0,'rgba('+q+','+a+')');G.addColorStop(.45,'rgba('+q+','+a*.42+')');G.addColorStop(1,'rgba('+q+',0)');x.fillStyle=G;x.fillRect(W2(g.x)-r,W2(g.z)-r,2*r,2*r)}x.globalCompositeOperation='source-over'}
  bakeT.needsUpdate=true}
 const MD={conc:['#9b927d',.96],bwall:['#8a8e8f',.92],ceil:['#7c7f82',.9],panel:['#7f8f88',.6,.3],plaster:['#b9a585',.97],plasterB:['#c9c3b4',.97,0,'plaster'],plasterO:['#b07f55',.97,0,'plaster'],stone:['#8d8576',.95],brick:['#7a4a38',.95],wood:['#7a5b3a',.85],woodD:['#4e3a28',.88],crate:['#6d5b39',.88],sandbag:['#7f7253',1],hesco:['#a39070',1],corr:['#6b7064',.6,.55],rust:['#7a4a30',.7,.45],plate:['#70757a',.5,.5],snow:['#eef2f6',.9],rock:['#6c6a68',.95],rockS:['#7a7a7e',.95],tile:['#8a4a32',.85],door:['#49503f',.8],tarp:['#5d5a3e',.95],tarpR:['#7a3a2c',.95,0,'tarp'],paint:['#4b5235',.6,.3],burn:['#2a2723',.9,.25],barrel:['#5c4a2c',.58,.5],far:['#6f6a63',1,0,'farB'],farM:['#a08a70',1,0,'farB'],farU:['#565a63',1,0,'farB']};
 /* Priorité de profondeur : les boîtes de matériaux différents partagent des faces exactement coplanaires (chambranle / tranche du mur, 1 100 m² sur la vieille ville) ; sans départage, elles se battent en hachures. */
 const ZR={frame:-3,steel:-2,plate:-1,rock:1,wood:2,woodD:2};
 const lib=new Map();/* grandes cartes : matériaux ajoutés sous de nouveaux noms */MD.farR=['#6b6c5e',1,0];TP.farR=(x,s)=>{blotch(x,s,60,'40,42,36');blotch(x,s,40,'150,150,130');cracks(x,s,10);streaks(x,s,24)};UVS.farR=26;MD.tank=['#85857b',.62,.35];TP.tank=(x,s)=>{streaks(x,s,16);x.strokeStyle='rgba(30,28,24,.35)';x.lineWidth=2;for(let i=0;i<=4;i++){x.beginPath();x.moveTo(i*s/4,0);x.lineTo(i*s/4,s);x.stroke()}};for(const[n,c,r,mt]of[['pipeY',0xb98f2c,.55,.55],['pipeR',0x8a3a28,.6,.5],['leaf',0x3f5228,.95,0],['leafA',0x9a6a28,.95,0]]){const q=bakeHook(new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:mt}));q.userData.envI=1;lib.set(n,q)}
  function M(k){if(k==='gnd')return gMat;if(k==='fence')return fenceM;if(k==='palS')k='pal';if(lib.has(k))return lib.get(k);if(extMat&&k.startsWith('ar_')){const q=extMat(k,{tex,nmap,blotch,streaks,cracks,rnd,hook:bakeHook});if(q){lib.set(k,q);return q}}if(k==='pal'){const q=bakeHook(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.18}));q.userData.envI=1;lib.set(k,q);return q}let m;
  if(MD[k]){const[base,r,mt=0,tp]=MD[k];const t=tex(base,TP[tp||k],k==='snow'||tp==='farB'?256:512);m=new THREE.MeshStandardMaterial({map:t,normalMap:nmap(t,k==='snow'?1:tp==='farB'?.6:2.4),roughness:r,metalness:mt})}
  else if(k.startsWith('cont')){const cols=['#4f5b3a','#74402a','#37505e','#85703f'],txt=['FZ-0714','KRM-2194','RZO-0816','DPT-3307'],i=+k[4];const t=tex(cols[i],(x,s)=>{corrug(x,s,.14);blotch(x,s,26,'82,42,20');streaks(x,s,30);x.fillStyle='rgba(232,224,204,.72)';x.font='800 54px Arial';x.fillText(txt[i],30,110)},512);m=new THREE.MeshStandardMaterial({map:t,normalMap:nmap(t),roughness:.62,metalness:.42})}
  else{const P={asph:[0x45423c,.96,0],steel:[0x5c6066,.5,.6],frame:[0x5b5346,.78,.1],glass:[0x0d1316,.12,.9],rubber:[0x151515,.95,0],far:[0x6a6660,1,0],farM:[0x9a8064,1,0],farU:[0x4a4c52,1,0],farS:[0xc8d0da,1,0],hull:[0x3a1e1a,.7,.3]};
   const L={lampW:[3,2.85,2.5],lampA:[3,1.7,.6],lampR:[3,.25,.15],lampG:[.25,1.9,.7],lampB:[.07,.32,.66],lampY:[3,2.45,1.6]};
   if(L[k])m=new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(...L[k])});else{const p=P[k]||P.steel;m=new THREE.MeshStandardMaterial({color:p[0],roughness:p[1],metalness:p[2]})}}
  if(ZR[k]){m.polygonOffset=true;m.polygonOffsetFactor=m.polygonOffsetUnits=ZR[k]}if(m.isMeshStandardMaterial)bakeHook(m);m.userData.envI=m.envMapIntensity!==undefined?(k==='glass'?2:1):0;lib.set(k,m);return m}

 /* ciel + environnement par ambiance (mis en cache) */
 const skies=new Map();
 function sky(env){if(skies.has(env))return skies.get(env);const E=ENV[env],c=cnv(1024,512),x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,512);for(const[o,col]of E.sky)g.addColorStop(o,col);x.fillStyle=g;x.fillRect(0,0,1024,512);
  /* un dÃ©gradÃ© 8 bits agrandi sur tout le ciel se voit en bandes : on le recalcule en flottant avec un bruit de Â±1 niveau (dither) */
  {const st=E.sky.map(([o,h])=>[o,parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]),im=x.createImageData(1024,512),D=im.data;let k=0,i=0;
   for(let y=0;y<512;y++){const v=(y+.5)/512;while(k<st.length-2&&v>st[k+1][0])k++;const a=st[k],b=st[k+1],f=Math.min(1,Math.max(0,(v-a[0])/((b[0]-a[0])||1))),r=a[1]+(b[1]-a[1])*f,gr=a[2]+(b[2]-a[2])*f,bl=a[3]+(b[3]-a[3])*f;
    for(let px=0;px<1024;px++,i+=4){D[i]=r;D[i+1]=gr;D[i+2]=bl;D[i+3]=255}}
   x.putImageData(im,0,0)}
  if(E.sun){const d=new THREE.Vector3(...E.sun).normalize(),su=(Math.atan2(d.z,d.x)/(2*Math.PI)+.5)*1024,sv=(.5-Math.asin(d.y)/Math.PI)*512;for(const ox of[-1024,0,1024]){const h=x.createRadialGradient(su+ox,sv,4,su+ox,sv,300);h.addColorStop(0,'rgba(255,248,225,1)');h.addColorStop(.05,`rgba(${E.halo},.75)`);h.addColorStop(.35,`rgba(${E.halo},.2)`);h.addColorStop(1,`rgba(${E.halo},0)`);x.fillStyle=h;x.fillRect(0,0,1024,512)}}
  for(let i=0;i<E.clouds;i++){const px=rnd(0,1024),py=rnd(50,245),rr=rnd(14,70),a=rnd(.025,.1),dark=rnd(0,1)<.42,sx=rnd(1.8,4),b=x.createRadialGradient(0,0,0,0,0,rr);b.addColorStop(0,`rgba(${dark?E.cloudDark:E.cloudLight},${a})`);b.addColorStop(1,`rgba(${dark?E.cloudDark:E.cloudLight},0)`);x.fillStyle=b;for(const o of[-1024,0,1024]){if(Math.abs(px+o-512)>512+rr*sx)continue;x.save();x.translate(px+o,py);x.scale(sx,1);x.fillRect(-rr,-rr,rr*2,rr*2);x.restore()}}
  /* Les centaines de dégradés empilés cumulent le tramage ordonné du canvas (damier de ±7 niveaux mesuré = maillage visible dans le ciel) : un aller-retour en 1/4 de taille, raccordé en longitude, l'efface. */
  {const q=cnv(260,128),y=q.getContext('2d');y.imageSmoothingEnabled=true;y.imageSmoothingQuality='medium';for(const ox of[-254,2,258])y.drawImage(c,ox,0,256,128);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='low';x.drawImage(q,0,0,260,128,-8,0,1040,512)}
  const t=new THREE.CanvasTexture(c);t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;const pm=new THREE.PMREMGenerator(renderer),e=pm.fromEquirectangular(t).texture;pm.dispose();const r={bg:t,env:e};skies.set(env,r);return r}

 /* lumières persistantes */
 const hemi=new THREE.HemisphereLight(0xffffff,0x444444,.5),sun=new THREE.DirectionalLight(0xffffff,3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;scene.add(hemi,sun,sun.target);
 /* Cadre l'ombre sur ce qui existe vraiment (boîtes visibles, vu depuis le soleil) au lieu d'un carré fixe : texels plus fins, aucune passe en plus. */
 let sunTx=120;const fitX=new THREE.Vector3(),fitY=new THREE.Vector3();
 function fitSun(L,d,dist){const P=[],S=L.size,add=(a,b,y0,y1,c,e)=>{for(const x of[a,b])for(const y of[y0,y1])for(const z of[c,e])P.push(x,y,z)};add(-S,S,0,0,-S,S);
  for(const o of L.ops){if(/^(far|lamp)/.test(o.m)||o.ns)continue;if(o.t==='b'||o.t==='v')add(o.x0,o.x1,o.y0,o.y1,o.z0,o.z1);else if(o.t==='f')add(o.x0,o.x1,1.1,1.1+o.h,o.z,o.z);else{const R=Math.max(o.w||0,o.d||0,o.r||0,o.sx||0,o.sz||0)*.8+.1,h=o.h||o.sy||1;add(o.x-R,o.x+R,(o.y||0)-h,(o.y||0)+h,o.z-R,o.z+R)}}
  for(const i of L.inst){if(i.ns)continue;const R=(i.k==='pine'?2.2:i.k==='shrub'?4:2)*i.s;add(i.x-R,i.x+R,i.y,i.y+(i.k==='pine'?7.4:2)*i.s,i.z-R,i.z+R)}
  let B=null;for(const up of[[1,0,0],[0,0,1]]){fitX.set(up[0],up[1],up[2]).cross(d).normalize();fitY.copy(d).cross(fitX);let a=1e9,b=-1e9,c=1e9,e=-1e9,n=1e9,f=-1e9;
   for(let i=0;i<P.length;i+=3){const X=P[i],Y=P[i+1],Z=P[i+2],u=X*fitX.x+Y*fitX.y+Z*fitX.z,v=X*fitY.x+Y*fitY.y+Z*fitY.z,w=X*d.x+Y*d.y+Z*d.z;if(u<a)a=u;if(u>b)b=u;if(v<c)c=v;if(v>e)e=v;if(w<n)n=w;if(w>f)f=w}
   const A=(b-a)*(e-c);if(!B||A<B.A)B={A,up,a,b,c,e,n,f}}
  const c=sun.shadow.camera;c.up.set(B.up[0],B.up[1],B.up[2]);Object.assign(c,{left:B.a-1.5,right:B.b+1.5,bottom:B.c-1.5,top:B.e+1.5,near:Math.max(.5,dist-B.f-(sfMod&&sfMod.SOFT_ENVS.has(L.env)?9:2)),far:dist-B.n+2});c.updateProjectionMatrix();sunTx=Math.max(B.b-B.a,B.e-B.c)+3}

 /* fusion par matériau */
 const tv=new THREE.Vector3(),tn=new THREE.Vector3(),nm3=new THREE.Matrix3(),tm=new THREE.Matrix4(),tq=new THREE.Quaternion(),te=new THREE.Euler(),ts=new THREE.Vector3(),tp=new THREE.Vector3();
 const unitBox=new THREE.BoxGeometry(1,1,1),unitQuad=new THREE.PlaneGeometry(1,1),cylC=new Map(),rockC=[];
 const cylG=(seg,ratio)=>{const k=seg+'|'+ratio.toFixed(3);if(!cylC.has(k))cylC.set(k,new THREE.CylinderGeometry(ratio,1,1,seg));return cylC.get(k)};
 const prism=(()=>{const g=new THREE.CylinderGeometry(1,1,1,3,1,false,Math.PI/2);g.rotateZ(Math.PI/2);g.translate(0,.5,0);g.scale(1,1/1.5,1/.866);return g})();
 for(let v=0;v<4;v++){const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position;for(let i=0;i<p.count;i++){tv.fromBufferAttribute(p,i);const n=1+.22*Math.sin(tv.x*3.1+v*1.7)*Math.cos(tv.z*2.7-v)+.12*Math.sin(tv.y*5+v*2.3);tv.multiplyScalar(n);if(tv.y<-.6)tv.y=-.6;p.setXYZ(i,tv.x,tv.y,tv.z)}g.computeVertexNormals();rockC.push(g)}
 const IDM=new THREE.Matrix4();class Batch{constructor(){this.p=[];this.n=[];this.u=[];this.i=[];this.c=[];this.tint=null}
  add(g,m4,uvS,fit){const P=g.attributes.position,N=g.attributes.normal,U=g.attributes.uv,b=this.p.length/3;nm3.getNormalMatrix(m4);
   for(let k=0;k<P.count;k++){tv.fromBufferAttribute(P,k).applyMatrix4(m4);tn.fromBufferAttribute(N,k).applyMatrix3(nm3).normalize();this.p.push(tv.x,tv.y,tv.z);if(g.attributes.color)this.c.push(g.attributes.color.getX(k),g.attributes.color.getY(k),g.attributes.color.getZ(k));else if(this.tint)this.c.push(this.tint[0],this.tint[1],this.tint[2]);this.n.push(tn.x,tn.y,tn.z);
    if(fit)this.u.push(U.getX(k),U.getY(k));else{const ax=Math.abs(tn.x),ay=Math.abs(tn.y),az=Math.abs(tn.z);if(ax>=ay&&ax>=az)this.u.push(tv.z/uvS,tv.y/uvS);else if(ay>=az)this.u.push(tv.x/uvS,tv.z/uvS);else this.u.push(tv.x/uvS,tv.y/uvS)}}
   if(g.index)for(let k=0;k<g.index.count;k++)this.i.push(b+g.index.getX(k));else for(let k=0;k<P.count;k++)this.i.push(b+k)}
  geo(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2));if(this.c.length)g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.setIndex(this.i.length>65535?new THREE.Uint32BufferAttribute(this.i,1):new THREE.Uint16BufferAttribute(this.i,1));if(sfMod)sfMod.softenGeo(this,g,THREE);g.computeBoundingSphere();return g}}

 /* textures partagées : fumée, sol cuit, grillage, eau */
 const smokeT=(()=>{const c=cnv(128),x=c.getContext('2d');for(let i=0;i<34;i++){const p=rnd(30,98),q=rnd(30,98),r=rnd(14,36),g=x.createRadialGradient(p,q,0,p,q,r);g.addColorStop(0,'rgba(255,255,255,.2)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128)}return new THREE.CanvasTexture(c)})();
 /* L'alpha doit rester dans 0..1 : la cible de rendu est en demi-flottants (pas de saturation), un alpha > 1 extrapolait le fond en négatif = taches noires à bord orange. */
 const smokeM=new THREE.ShaderMaterial({uniforms:{map:{value:smokeT},scale:{value:600}},transparent:true,depthWrite:false,
  vertexShader:`attribute float aSize;attribute float aAlpha;attribute vec3 aCol;attribute float aRot;varying float vA;varying vec3 vC;varying vec2 vR;uniform float scale;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(aSize*scale/-mv.z,1.,512.);vA=aAlpha;vC=aCol;vR=vec2(cos(aRot),sin(aRot));gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform sampler2D map;varying float vA;varying vec3 vC;varying vec2 vR;void main(){vec2 p=gl_PointCoord-.5;vec4 t=texture2D(map,.5+vec2(p.x*vR.x-p.y*vR.y,p.x*vR.y+p.y*vR.x));float d=clamp(t.a*(1.-smoothstep(.1,.5,length(p)))*1.5,0.,1.);gl_FragColor=vec4(vC*(1.5-.6*d+.5*(.5-gl_PointCoord.y)),clamp(d*vA*1.25,0.,.8));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }`});
 const partT=(()=>{const c=cnv(32),x=c.getContext('2d'),g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.45,'rgba(255,255,255,.6)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,32,32);return new THREE.CanvasTexture(c)})();
 const gCanvas=cnv(2048),gTex=new THREE.CanvasTexture(gCanvas);gTex.colorSpace=THREE.SRGBColorSpace;gTex.anisotropy=8;const gMat=bakeHook(new THREE.MeshStandardMaterial({map:gTex,roughness:.98}));gMat.userData.envI=.7;
 const outerMat=new THREE.MeshStandardMaterial({roughness:1});outerMat.userData.envI=.6;
 const fenceT=(()=>{const c=cnv(128),x=c.getContext('2d');x.strokeStyle='#bfc2c4';x.lineWidth=3;for(let i=-128;i<256;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i+128,128);x.moveTo(i+128,0);x.lineTo(i,128);x.stroke()}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t})();
 const fenceM=new THREE.MeshStandardMaterial({map:fenceT,alphaTest:.5,side:THREE.DoubleSide,metalness:.6,roughness:.5});fenceM.userData.envI=1;
 const waterN=(()=>{const t=tex('#808080',(x,s)=>{for(let i=0;i<260;i++){x.fillStyle=`rgba(${rnd(0,1)<.5?'0,0,0':'255,255,255'},.09)`;x.beginPath();x.ellipse(rnd(0,s),rnd(0,s),rnd(6,40),rnd(2,7),0,0,7);x.fill()}},256);return nmap(t,3)})();waterN.repeat.set(40,20);
 const waterM=new THREE.MeshStandardMaterial({color:0x1b2a36,roughness:.12,metalness:.85,normalMap:waterN,normalScale:new THREE.Vector2(.6,.6)});waterM.userData.envI=1.3;
 const instGeo={rubble:new THREE.DodecahedronGeometry(1,0),shrub:new THREE.IcosahedronGeometry(1,0).scale(1,.55,1),pine:(()=>{const parts=[],cols=[];const add=(g,c)=>{g=g.toNonIndexed();const n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++)a.set(c,i*3);g.setAttribute('color',new THREE.BufferAttribute(a,3));g.deleteAttribute('uv');parts.push(g)};
  add(new THREE.CylinderGeometry(.15,.26,3.2,7).translate(0,1.6,0),[.22,.15,.1]);for(const[y,r,h]of[[2.6,2,2.5],[4,1.5,2.2],[5.2,1,1.9]]){/* branches basses au-dessus de 2 m : seul le tronc (collision) est à hauteur d'homme */add(new THREE.ConeGeometry(r,h,8).translate(0,y+h/2,0),[.1,.17,.13]);add(new THREE.ConeGeometry(r*.92,h*.35,8).translate(0,y+h*.82,0),[.85,.88,.92])}
  const g=new THREE.BufferGeometry(),n=parts.reduce((s,p)=>s+p.attributes.position.count,0),P=new Float32Array(n*3),N=new Float32Array(n*3),C=new Float32Array(n*3);let o=0;for(const p of parts){P.set(p.attributes.position.array,o*3);N.set(p.attributes.normal.array,o*3);C.set(p.attributes.color.array,o*3);o+=p.attributes.position.count}
  g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));return g})()};
 const instMat={rubble:new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),shrub:new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),pine:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95})};

 /* état par carte */
 const w={solids:[],spawns:[],size:0,env:null,id:null};let root=null,lights=[],smoke=null,parts=null,water=null,groundSurf='concrete',vehicles=null;
 let fineOn=true,fineT=0,underOn=true,underT=0;const underM=[],fineM=[],highM=[],proxyM=new THREE.ShaderMaterial({vertexShader:'void main(){gl_Position=vec4(2.,2.,2.,1.);}',fragmentShader:'void main(){gl_FragColor=vec4(0.);discard;}'});const bordM=[];let LOW=false,bdT=0,bordS=0;w.setLow=v=>{LOW=!!v;bdT=0;if(!LOW)for(const e of bordM)e.visible=true;if(vehicles&&vehicles.setLow){try{vehicles.setLow(LOW)}catch{}}};function bordUpd(c){for(const e of bordM){const d=e.userData.bd,s=bordS;if(d==='a')continue;const k=d==='n'?c.z+s:d==='s'?s-c.z:d==='e'?s-c.x:c.x+s;e.visible=true}}w.setDetail=v=>{fineOn=v;fineT=0;for(const e of fineM)e.visible=v&&(underOn||!e.userData.u)};function dispose(){fineM.length=0;bordM.length=0;underM.length=0;highM.length=0;w.deep=false;underOn=true;underT=0;if(!root)return;scene.remove(root);root.traverse(o=>{if(o.geometry&&!o.isInstancedMesh)o.geometry.dispose();if(o.isInstancedMesh)o.dispose();if(o.material&&o.material.userData.perMap)o.material.dispose()});root=null;lights=[];smoke=null;parts=null;water=null;vehicles=null}

 /* Un seul flou, a demi-resolution, pour tout un calque (ombres, halos de routes). Un filtre blur() par rectangle sur le canvas 2048x2048
    occupait le GPU ~10 s d'un bloc sur une carte integree : page figee au lancement, voire pilote reinitialise (contexte WebGL perdu). */
 const softC=[cnv(1024),cnv(1024)];
 function soft(x,S2,blur,draw){const[a,b]=softC,ya=a.getContext('2d'),yb=b.getContext('2d');ya.setTransform(1,0,0,1,0,0);ya.clearRect(0,0,1024,1024);ya.setTransform(1024/S2,0,0,1024/S2,0,0);draw(ya);ya.setTransform(1,0,0,1,0,0);
  yb.clearRect(0,0,1024,1024);yb.filter=`blur(${blur*1024/S2}px)`;yb.drawImage(a,0,0);yb.filter='none';x.drawImage(b,0,0,S2,S2)}
 function*bakeGround(L,E){const S=L.size,S2=2048,x=gCanvas.getContext('2d'),k=S2/(2*S+4),W2=v=>(v+S+2)*k;x.globalCompositeOperation='source-over';x.filter='none';
  const base=M('g_'+L.env);x.fillStyle=x.createPattern(base.map.image,'repeat');x.save();x.scale(.6,.6);x.fillRect(0,0,S2/.6,S2/.6);x.restore();
  const GT=E.gt||L.env,dark=GT==='snow'?'120,140,170':GT==='bunker'?'44,44,44':'58,44,28',lite=GT==='snow'?'255,255,255':GT==='port'?'110,110,110':'226,204,160';
  blotch(x,S2,70,dark);blotch(x,S2,30,lite);
  yield;soft(x,S2,5,y=>{y.lineJoin='round';y.lineCap='butt';y.strokeStyle='rgba(60,55,45,.5)';for(const p of L.paths){if(p.w<.1)continue;y.lineWidth=(p.w+1.5)*k;y.beginPath();p.pts.forEach((q,i)=>i?y.lineTo(W2(q[0]),W2(q[1])):y.moveTo(W2(q[0]),W2(q[1])));y.stroke()}});
  yield;for(const p of L.paths){if(p.w<.1)continue;x.lineJoin='round';x.lineCap='butt';x.beginPath();p.pts.forEach((q,i)=>i?x.lineTo(W2(q[0]),W2(q[1])):x.moveTo(W2(q[0]),W2(q[1])));x.strokeStyle=p.c;x.lineWidth=p.w*k;x.stroke();
   x.setLineDash([2.2*k,2.4*k]);x.strokeStyle='rgba(216,198,146,.4)';x.lineWidth=.16*k;x.stroke();x.setLineDash([])}
  for(const p of L.paints){
   if(p.t==='rect'){x.fillStyle=p.c;x.fillRect(W2(p.x0),W2(p.z0),(p.x1-p.x0)*k,(p.z1-p.z0)*k)}if(p.t==='H'){x.strokeStyle='rgba(225,215,180,.6)';x.lineWidth=.35*k;x.beginPath();x.arc(W2(p.x),W2(p.z),5*k,0,7);x.stroke();x.fillStyle='rgba(225,215,180,.6)';x.fillRect(W2(p.x-2),W2(p.z-2.5),.6*k,5*k);x.fillRect(W2(p.x+1.4),W2(p.z-2.5),.6*k,5*k);x.fillRect(W2(p.x-2),W2(p.z-.3),4*k,.6*k)}
   if(p.t==='cobble'){x.strokeStyle='rgba(30,26,20,.35)';x.lineWidth=1;for(let i=0;i<S2;i+=9){x.beginPath();x.moveTo(0,i);x.lineTo(S2,i+rnd(-2,2));x.stroke()}}
   if(p.t==='quay'){x.fillStyle='rgba(230,190,40,.75)';for(let i=-S;i<S;i+=4)x.fillRect(W2(i),W2(S-2.2),2*k,.3*k);x.strokeStyle='rgba(235,230,220,.45)';x.lineWidth=.15*k;for(const z of[-50,-44,-30,-12])x.strokeRect(W2(-12),W2(z),58*k,4*k)}
   if(p.t==='bunker'){for(const r of p.rooms){x.strokeStyle='rgba(220,180,40,.5)';x.lineWidth=.2*k;x.setLineDash([.6*k,.6*k]);x.strokeRect(W2(r[0]+.4),W2(r[2]+.4),(r[1]-r[0]-.8)*k,(r[3]-r[2]-.8)*k);x.setLineDash([])}}
   if(p.t==='snow'){x.strokeStyle='rgba(140,160,190,.35)';x.lineWidth=.12*k;for(let i=0;i<40;i++){let a=rnd(0,S2),b=rnd(0,S2),t=rnd(0,6);x.beginPath();x.moveTo(a,b);for(let n=0;n<20;n++){t+=rnd(-.3,.3);a+=Math.cos(t)*12;b+=Math.sin(t)*12;x.lineTo(a,b)}x.stroke()}x.fillStyle='rgba(170,200,225,.55)';x.fillRect(W2(-5),0,10*k,S2)}}
  yield;if(L.env!=='bunker'&&L.env!=='snow')for(let i=0;i<9;i++){const a=rnd(-S+4,S-4),b=rnd(-S+4,S-4),r=rnd(.9,2.2),g=x.createRadialGradient(W2(a),W2(b),0,W2(a),W2(b),r*k*1.5);g.addColorStop(0,'rgba(10,9,8,.8)');g.addColorStop(.55,'rgba(28,24,19,.55)');g.addColorStop(1,'rgba(40,32,22,0)');x.fillStyle=g;x.fillRect(W2(a)-r*k*1.6,W2(b)-r*k*1.6,r*k*3.2,r*k*3.2)}
  yield;soft(x,S2,12,y=>{y.fillStyle=L.env==='snow'?'rgba(60,80,110,.35)':'rgba(15,12,8,.55)';for(const s of L.solids){if(s.y0>.01||s.x1-s.x0>40&&s.z1-s.z0>40)continue;y.fillRect(W2(s.x0)-6,W2(s.z0)-6,(s.x1-s.x0)*k+12,(s.z1-s.z0)*k+12)}});
  yield;x.globalCompositeOperation='lighter';for(const g of L.glows){const r=g.r*k,G=x.createRadialGradient(W2(g.x),W2(g.z),0,W2(g.x),W2(g.z),r);const c=new THREE.Color(g.color);G.addColorStop(0,`rgba(${c.r*255|0},${c.g*255|0},${c.b*255|0},${g.a})`);G.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=G;x.fillRect(W2(g.x)-r,W2(g.z)-r,2*r,2*r)}x.globalCompositeOperation='source-over';
  gTex.needsUpdate=true;if(gMat.normalMap)gMat.normalMap.needsUpdate=true}

 function ensureGroundMat(env){const k='g_'+env;if(lib.has(k))return;const E=ENV[env];const fn={desert:(x,s)=>{blotch(x,s,150,'62,47,28');blotch(x,s,70,'214,190,145');for(let i=0;i<1500;i++){x.fillStyle=rnd(0,1)<.6?'rgba(45,34,22,.5)':'rgba(222,203,165,.42)';x.beginPath();x.arc(rnd(0,s),rnd(0,s),rnd(.6,2.6),0,7);x.fill()}},
  urban:(x,s)=>{bricks(x,s,10,8,[112,104,92],'#4a443a',18);blotch(x,s,40,'30,26,20')},port:(x,s)=>{blotch(x,s,90,'20,20,22');for(let i=0;i<2500;i++){x.fillStyle=rnd(0,1)<.5?'rgba(15,15,15,.5)':'rgba(150,150,150,.35)';x.fillRect(rnd(0,s),rnd(0,s),2,2)}cracks(x,s,8)},
  bunker:(x,s)=>{x.strokeStyle='rgba(15,15,15,.6)';x.lineWidth=3;x.strokeRect(1,1,s-2,s-2);x.beginPath();x.moveTo(s/2,0);x.lineTo(s/2,s);x.moveTo(0,s/2);x.lineTo(s,s/2);x.stroke();blotch(x,s,70,'62,62,60');streaks(x,s,10)},
  snow:(x,s)=>{blotch(x,s,120,'170,190,215');blotch(x,s,60,'255,255,255');for(let i=0;i<900;i++){x.fillStyle='rgba(255,255,255,.7)';x.fillRect(rnd(0,s),rnd(0,s),1.4,1.4)}}}[E.gt||env];
  const t=tex(E.ground,fn,512),m=new THREE.MeshStandardMaterial({map:t,normalMap:nmap(t,env==='snow'?1:2),roughness:1});m.userData.envI=.6;lib.set(k,m)}

 /* Générateur : chaque `yield` est un point où le chargement découpé rend la main (lp = avancement). */
 function*build(L){const E=ENV[L.env],S=L.size;root=new THREE.Group();root.name='world-'+L.env;let nOp=0;const hz=hzMod&&hzMod.steps?yield*hzMod.steps(L,E,scene):null;let vz=null;try{vz=vzMod&&L.vehicles&&L.vehicles.length?vzMod.begin(L,E):null}catch{vz=null}if(vz){yield*vz.prepare();if(!vz.ok)vz=null}
  /* L.chunk : grandes cartes, lots découpés en cellules pour que le frustum culling retire ce qui est hors champ */const CH=L.chunk||0,batches=new Map(),B=(m0,x,z,o,sx='')=>{const pc=o&&o.bq?PAL[m0]:null,m=pc?(PAL_NS.has(m0)?'palS':'pal'):m0,q=(o&&o.bq?m+'|'+(LOW?'b_'+(Math.abs(x)>Math.abs(z)?(x>0?'e':'w'):(z>0?'s':'n')):o.bq):CH?(o&&o.fine?m+'|'+Math.floor((x+S)/(CH/2))+'|'+Math.floor((z+S)/(CH/2))+(o.under?'|u':'')+'|f':m+'|'+Math.floor((x+S)/CH)+'|'+Math.floor((z+S)/CH)+(o&&o.under?'|u':'')):m)+sx;if(!batches.has(q))batches.set(q,new Batch());const bq=batches.get(q);bq.tint=pc;return bq};
  let sf=null;if(sfMod)try{sf=yield*sfMod.softenBuild(L,UVS,{q:sfMod.softenLevel(renderer),skipOp:o=>!!(hz&&hz.skip(o))||!!(vz&&o.vh)})}catch(e){console.warn('[soften]',e);sf=null}/* three trie les objets opaques par matériau : même ordre de création qu'avant, donc même surdessin ; le sol d'abord, comme sans la passe (les textures partagent la suite aléatoire de la carte) */if(sf){ensureGroundMat(L.env);for(const o of L.ops){if(!o.m||(hz&&hz.skip(o))||(vz&&o.vh))continue;const pc=o.bq&&PAL[o.m];M(pc?(PAL_NS.has(o.m)?'palS':'pal'):o.m)}}
  for(const o of L.ops){if(hz&&hz.skip(o))continue;if(vz&&o.vh)continue;if(sf&&sf.skip.has(o))continue;const uvS=UVS[o.m]||3;if(!(++nOp&127))yield;
   if(o.t==='b'){tm.compose(tp.set((o.x0+o.x1)/2,(o.y0+o.y1)/2,(o.z0+o.z1)/2),tq.identity(),ts.set(o.x1-o.x0,o.y1-o.y0,o.z1-o.z0));B(o.m,(o.x0+o.x1)/2,(o.z0+o.z1)/2,o).add(unitBox,tm,uvS,o.fit)}
   else if(o.t==='r'){tm.compose(tp.set(o.x,o.y+o.h/2,o.z),tq.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,o.ry),ts.set(o.w,o.h,o.d));B(o.m,o.x,o.z,o).add(unitBox,tm,uvS,false)}
   else if(o.t==='v'){tm.identity();B(o.m,(o.x0+o.x1)/2,(o.z0+o.z1)/2,o).add(chamGeo(o),tm,uvS,false)}
   else if(o.t==='q'){tm.compose(tp.set(o.x,o.y+o.h/2,o.z),tq.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,o.ry),ts.set(o.w,o.h,1));B(o.m,o.x,o.z,o).add(unitQuad,tm,1.15,false)}
   else if(o.t==='c'){tm.compose(tp.set(o.x,o.y,o.z),tq.setFromEuler(te.set(o.rx,o.ry||0,o.rz)),ts.set(o.r,o.h,o.r));B(o.m,o.x,o.z,o).add(cylG(o.seg,o.r2/o.r),tm,uvS,false)}
   else if(o.t==='k'){tm.compose(tp.set(o.x,o.y,o.z),tq.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,o.ry),ts.set(o.sx,o.sy,o.sz));B(o.m,o.x,o.z,o).add(rockC[o.v],tm,uvS,false)}
   else if(o.t==='p'){tm.compose(tp.set(o.x,o.y,o.z),tq.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,o.ry),ts.set(o.w,o.h,o.d/2));B(o.m,o.x,o.z,o).add(prism,tm,uvS,false)}
   else if(o.t==='g'){B(o.m,o.x,o.z,o).add(o.g,IDM,uvS,true)}else if(o.t==='f'){const g=new THREE.PlaneGeometry(o.x1-o.x0,o.h);g.translate((o.x0+o.x1)/2,o.h/2+1.1,o.z);const a=g.attributes.uv;for(let i=0;i<a.count;i++)a.setXY(i,a.getX(i)*(o.x1-o.x0)/2,a.getY(i)*o.h/2);root.add(new THREE.Mesh(g,fenceM))}}
  if(sf){yield*sf.commit(B);if(sf.shadow.i.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(sf.shadow.p,3));g.setIndex(new THREE.BufferAttribute(sf.shadow.i,1));g.computeBoundingSphere();const e=new THREE.Mesh(g,proxyM);e.castShadow=true;e.receiveShadow=false;e.name='batch-soft-shadow';root.add(e)}}
  ensureGroundMat(L.env);for(const[q,b]of batches){const m=q.split('|')[0],mat=M(m),e=new THREE.Mesh(b.geo(),mat);const fine=q.endsWith('|f'),flat=fine||q.includes('|ns')||m==='ar_hill'||(L.shadowProxy&&m.startsWith('ar_'))||/^(far|lamp|hull|fence|palS)/.test(m)||(q.includes('|b_')&&/^g_/.test(m));e.castShadow=!flat;e.receiveShadow=!/^(far|lamp)/.test(m);e.name='batch-'+m;{const bi=q.indexOf('|b_');if(bi>=0){e.userData.bd=q[bi+3];e.userData.bs=!/^(pal|conc)/.test(m);bordM.push(e);bordS=S}}{const un=/\|u(\||$)/.test(q);if(fine){fineM.push(e);e.userData.u=un;e.userData.fr=/^ar_(wood|plaster|tile)$/.test(m)?1:0}else if(un)underM.push(e);else if(L.visAt&&e.userData.bd===undefined){const g=e.geometry;if(!g.boundingBox)g.computeBoundingBox();if(g.boundingBox.min.y>=4.5)highM.push(e)}}root.add(e);yield}/* cartes détaillées : les ombres viennent d'un maillage simple tiré des collisions (invisible à l'écran) */if(L.shadowProxy){const sl=L.solids.filter(s=>!s.ug&&s.y1<17.9&&s.y1-s.y0>=.12&&Math.max(s.x1-s.x0,s.z1-s.z0)>=.45),P=new Float32Array(sl.length*24),I=new Uint32Array(sl.length*36),F=[5,1,3,5,3,7,0,4,6,0,6,2,6,7,3,6,3,2,0,1,5,0,5,4,4,5,7,4,7,6,1,0,2,1,2,3];sl.forEach((s,n)=>{const ix=s.pr&&s.pa==='x'?s.pr:0,iz=s.pr&&s.pa==='z'?s.pr:0;for(let c=0;c<8;c++){P[n*24+c*3]=c&1?s.x1+.02-ix:s.x0-.02+ix;P[n*24+c*3+1]=c&2?s.y1:s.y0-.02;P[n*24+c*3+2]=c&4?s.z1+.02-iz:s.z0-.02+iz}for(let f=0;f<36;f++)I[n*36+f]=n*8+F[f]});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setIndex(new THREE.BufferAttribute(I,1));g.computeBoundingSphere();const e=new THREE.Mesh(g,proxyM);e.castShadow=true;e.receiveShadow=false;e.name='batch-proxy';root.add(e);yield;/* pré-passage de profondeur : volumes pleins rentrés de 25 cm, jamais devant une surface visible */{const IN=.25,ol=L.solids.filter(s=>s.occ&&s.x1-s.x0>=.9&&s.z1-s.z0>=.9&&s.y1-s.y0>=.6),P2=new Float32Array(ol.length*24),I2=new Uint32Array(ol.length*36);ol.forEach((s,n)=>{for(let c=0;c<8;c++){P2[n*24+c*3]=c&1?s.x1-IN:s.x0+IN;P2[n*24+c*3+1]=c&2?s.y1-IN:s.y0+IN;P2[n*24+c*3+2]=c&4?s.z1-IN:s.z0+IN}for(let f=0;f<36;f++)I2[n*36+f]=n*8+F[f]});const g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.BufferAttribute(P2,3));g2.setIndex(new THREE.BufferAttribute(I2,1));g2.computeBoundingSphere();const oc=new THREE.Mesh(g2,proxyM.userData.occ||(proxyM.userData.occ=new THREE.MeshBasicMaterial({colorWrite:false,fog:false,toneMapped:false})));oc.renderOrder=-100;oc.castShadow=false;oc.receiveShadow=false;oc.name='batch-occl';oc.visible=false;root.userData.occl=L.visAt?oc:null;root.userData.visAt=L.visAt;root.add(oc);yield}}
  // instances
  if(vz){vz.attach(root);vehicles=vz;try{vz.setLow(LOW)}catch{}}const groups={};for(const i of L.inst)(groups[i.k]=groups[i.k]||[]).push(i);const o3=new THREE.Object3D(),col=new THREE.Color();
  for(const kname in groups){const list=groups[kname],im=new THREE.InstancedMesh(instGeo[kname],instMat[kname],list.length);list.forEach((p,n)=>{o3.position.set(p.x,p.y,p.z);o3.rotation.set(kname==='pine'?0:p.ry*.7,p.ry,kname==='pine'?0:p.ry*.3);if(kname==='rubble')o3.scale.set(p.s*rnd(.8,1.6),p.s*rnd(.5,1),p.s*rnd(.8,1.6));else if(kname==='shrub')o3.scale.set(p.s*4,p.s*3,p.s*4);else o3.scale.setScalar(p.s);o3.updateMatrix();im.setMatrixAt(n,o3.matrix);
   if(kname==='rubble'){L.env==='snow'?col.setHSL(.6,.05,rnd(.3,.5)):L.env==='bunker'?col.setHSL(.1,.03,rnd(.32,.52)):col.setHSL(.09,rnd(.04,.16),rnd(.25,.55));im.setColorAt(n,col)}if(kname==='shrub'){col.setHSL(rnd(.12,.2),.3,rnd(.18,.3));im.setColorAt(n,col)}});
   im.castShadow=im.receiveShadow=true;im.computeBoundingSphere();if(sf&&kname==='rubble')im.visible=false;root.add(im);yield}
  // sol
  ensureGroundMat(L.env);{const nm=M('g_'+L.env).normalMap.clone();nm.repeat.set(S/5,S/5);gMat.normalMap=nm;gMat.needsUpdate=true}const gp=new THREE.Mesh(new THREE.PlaneGeometry(2*S+4,2*S+4),gMat);gp.rotation.x=-Math.PI/2;gp.receiveShadow=true;root.add(gp);
  if(L.env!=='bunker'){const gm=M('g_'+L.env);outerMat.map=gm.map;outerMat.normalMap=gm.normalMap;outerMat.color.set(L.env==='snow'?0xf4f6f8:0xd8d0c4);outerMat.needsUpdate=true;
   const og=new THREE.PlaneGeometry(520,L.water?260:520);const a=og.attributes.uv;for(let i=0;i<a.count;i++)a.setXY(i,a.getX(i)*104,a.getY(i)*(L.water?52:104));const o=new THREE.Mesh(og,outerMat);o.rotation.x=-Math.PI/2;o.position.set(0,-.04,L.water?S-130:0);o.receiveShadow=true;root.add(o);hz&&hz.outer(o,outerMat,gTex)}
  if(L.water){water=new THREE.Mesh(new THREE.PlaneGeometry(600,300),waterM);water.rotation.x=-Math.PI/2;water.position.set(0,-1.3,L.water+150);root.add(water);const q=new THREE.Mesh(new THREE.BoxGeometry(2*S+2.4,1.8,.6),M('conc'));q.position.set(0,-.9,L.water-.5);root.add(q)}
  if(hz)hz.finish(root,water,waterM,sky(L.env).bg);
  // lumières pratiques
  for(const l of L.lights){const p=new THREE.PointLight(l.color,l.intensity,l.dist,2);p.position.set(l.x,l.y,l.z);root.add(p);lights.push({p,base:l.intensity,f:l.flick,ph:l.ph})}
  // fumées (un seul draw call)
  if(L.smoke.length){const per=10,n=L.smoke.length*per,pos=new Float32Array(n*3),sz=new Float32Array(n),al=new Float32Array(n),cl=new Float32Array(n*3),items=[];
   L.smoke.forEach((s,c)=>{const C=new THREE.Color(s.color);for(let i=0;i<per;i++){const j=c*per+i;cl.set([C.r,C.g,C.b],j*3);items.push({...s,a:i/per,ph:rnd(0,6)})}});
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aSize',new THREE.BufferAttribute(sz,1));g.setAttribute('aAlpha',new THREE.BufferAttribute(al,1));g.setAttribute('aCol',new THREE.BufferAttribute(cl,3));{const ro=new Float32Array(n);for(let i=0;i<n;i++)ro[i]=rnd(0,6.283);g.setAttribute('aRot',new THREE.BufferAttribute(ro,1))}
   const pts=new THREE.Points(g,smokeM);pts.frustumCulled=false;pts.renderOrder=5;root.add(pts);smoke={g,items}}
  // particules d'ambiance
  {const P=E.part,pos=new Float32Array(P.n*3);for(let i=0;i<P.n;i++){pos[i*3]=rnd(-18,18);pos[i*3+1]=rnd(0,9);pos[i*3+2]=rnd(-18,18)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
   const m=new THREE.PointsMaterial({color:P.col,map:partT,size:P.size*1.25,transparent:true,opacity:P.op,depthWrite:false,blending:P.mode==='ember'?THREE.AdditiveBlending:THREE.NormalBlending});m.userData.perMap=true;const pt=new THREE.Points(g,m);pt.frustumCulled=false;root.add(pt);parts={g,P,init:false}}
  scene.add(root);lp.phase='scene';yield;
  // textures : la scène est complète (les shaders peuvent compiler en parallèle), on peint maintenant
  if(later){const q=later;lp.phase='tex';lp.total=q.length;for(let i=0;i<q.length;i++){q[i]();lp.done=i+1;yield}q.length=0}
  lp.phase='ground';yield*bakeGround(L,E);if(hz&&L.env!=='bunker')hz.calib(M('g_'+L.env).map.image)}

 const lp={phase:'',done:0,total:0};
 function*loadG(id){let L;if(LSTEPS[id]){const q=LSTEPS[id]();let r;while(!(r=q.next()).done)yield;L=r.value}else L=buildLayout(id);const E=ENV[L.env];w.id=null;lp.phase='geo';lp.done=lp.total=0;dispose();w.solids.length=0;for(const s of L.solids)w.solids.push(s);w.spawns.length=0;for(const s of L.spawns)w.spawns.push(s);w.size=L.size;w.levelAt=L.levelAt||null;w.covered=L.covered||[];w.objectives=L.objectives||null;w.openings=L.openings||null;w.lanes=L.lanes||null;w.env=E.as||L.env;w.sk=L.env;groundSurf=E.gsurf;
  yield;const sk=sky(L.env);yield;scene.background=sk.bg;scene.environment=sk.env;scene.fog=new THREE.FogExp2(E.fog[0],E.fog[1]);renderer.toneMappingExposure=E.exp;
  for(const m of[...lib.values(),gMat,outerMat,fenceM,waterM])if(m.userData.envI)m.envMapIntensity=m.userData.envI*E.envI;
  paintBake(L,E);hemi.color.set(E.hemi[0]);hemi.groundColor.set(E.hemi[1]);hemi.intensity=E.hemi[2];
  if(E.sun){const d=new THREE.Vector3(...E.sun).normalize(),S=L.size;sun.visible=true;sun.color.set(E.sunCol);sun.intensity=E.sunI;sun.target.position.set(0,0,0);sun.position.copy(d).multiplyScalar(S*2.2);
   fitSun(L,d,S*2.2);sun.target.updateMatrixWorld();sun.updateMatrixWorld()}else sun.visible=false;bakeU.mtn.value=E.mtn?1:0;
  yield;yield*build(L);w.id=id;renderer.shadowMap.needsUpdate=true;return{solids:w.solids,spawns:w.spawns,size:w.size,env:w.env}}
 w.load=function(id){const g=loadG(id);let r;while(!(r=g.next()).done);return r.value};
 /* Chargement découpé : `step(lp)` est attendu entre deux étapes (lp={phase:'geo'|'scene'|'tex'|'ground',done,total}) ; à 'scene' le graphe est complet
    (matériaux créés, textures encore vides). w.id reste null tant que la carte n'est pas entièrement construite. */
 w.loadAsync=async function(id,step){await hzReady;await vzReady;await sfReady;const q=later=[];try{const g=loadG(id);let r;while(!(r=g.next()).done)await step(lp);return r.value}finally{if(later===q)later=null}};

 /* Contexte WebGL restauré : l'environnement PMREM (cible de rendu) est perdu, on le régénère pour la carte courante. */
 w.restoreGpu=function(){skies.clear();if(w.env&&w.id){const sk=sky(w.sk||w.env);scene.background=sk.bg;scene.environment=sk.env}};

 w.surfaceAt=function(x,y,z){let best=null,by=-1;for(const s of w.solids)if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&s.y1<=y+.25&&s.y1>by){by=s.y1;best=s}return best&&by>.05?best.surface:groundSurf};

 const tmpC=new THREE.Vector3();
 w.update=function(dt,time,cam){if(!root)return;const c=cam||tmpC;dt=Math.min(dt||0,.1);if(LOW&&bordM.length&&(bdT-=dt)<=0){bdT=.25;bordUpd(c)}if(vehicles)vehicles.update(c);if(underM.length&&(underT-=dt)<=0){underT=.1;{const ud=root.userData;if(ud.visAt){const v=ud.visAt(c.x,c.y,c.z),dp=v===1;if(ud.occl)ud.occl.visible=v===2;if(dp!==w.deep){w.deep=dp;for(let i=0;i<highM.length;i++)highM[i].visible=!dp}}}let on=c.y<5.9;const O=w.openings;if(!on&&O)for(let i=0;i<O.length;i++){const p=O[i],x=c.x-p[0],z=c.z-p[1];if(x*x+z*z<p[2]*p[2]){on=true;break}}if(on!==underOn){underOn=on;fineT=0;for(let i=0;i<underM.length;i++)underM[i].visible=on}}if(fineM.length&&fineOn&&(fineT-=dt)<=0){fineT=.25;for(let i=0;i<fineM.length;i++){const e=fineM[i],b=e.geometry.boundingSphere,x=b.center.x-c.x,z=b.center.z-c.z,r=b.radius+(e.userData.fr?(LOW?12:16):(LOW?4:5));e.visible=(c.y>=17||x*x+z*z<r*r)&&(underOn||!e.userData.u)}}sun.shadow.normalBias=Math.min(.05,Math.max(.022,sunTx/sun.shadow.mapSize.x*.7));
  for(const l of lights){let k=1;if(l.f===1)k=.92+.08*Math.sin(time*50+l.ph);else if(l.f===2)k=.75+.18*Math.sin(time*9+l.ph)+.07*Math.sin(time*23+l.ph*2);else if(l.f===3)k=(Math.sin(time*1.7+l.ph)>.6&&Math.sin(time*31)>-.2)?.05:1;l.p.intensity=l.base*k}
  if(smoke){const p=smoke.g.attributes.position.array,sz=smoke.g.attributes.aSize.array,al=smoke.g.attributes.aAlpha.array,big=v=>v>5;smoke.items.forEach((s,i)=>{s.a=(s.a+dt*(big(s.sz)?.02:.08))%1;const y=s.a*s.h;p[i*3]=s.x+Math.sin(s.ph+y*.09)*s.sz*.4+s.a*s.sz*1.5;p[i*3+1]=y+.5;p[i*3+2]=s.z+Math.cos(s.ph+y*.07)*s.sz*.3;sz[i]=s.sz*(1.1+s.a*4.2);al[i]=Math.sin(s.a*Math.PI)*(big(s.sz)?.6:.45)});
   smoke.g.attributes.position.needsUpdate=smoke.g.attributes.aSize.needsUpdate=smoke.g.attributes.aAlpha.needsUpdate=true;smokeM.uniforms.scale.value=(renderer.domElement&&renderer.domElement.height||800)*.5}
  if(parts){const a=parts.g.attributes.position.array,P=parts.P,R=18;if(!parts.init){for(let i=0;i<a.length;i+=3){a[i]+=c.x;a[i+2]+=c.z}parts.init=true}
   for(let i=0;i<a.length;i+=3){const ph=i*.37;if(P.mode==='snow'){a[i]+=Math.sin(time*.8+ph)*dt*.5+dt*.6;a[i+1]-=dt*(1+(i%7)*.12);a[i+2]+=Math.cos(time*.6+ph)*dt*.4}else if(P.mode==='ember'){a[i]+=Math.sin(time*1.3+ph)*dt*.6;a[i+1]+=dt*(.5+(i%5)*.15);a[i+2]+=Math.cos(time+ph)*dt*.5}else{a[i]+=Math.sin(time*.3+ph)*dt*.25+dt*.15;a[i+1]+=Math.sin(time*.5+ph*2)*dt*.08;a[i+2]+=Math.cos(time*.4+ph)*dt*.2}
    if(a[i]-c.x>R)a[i]-=2*R;else if(a[i]-c.x<-R)a[i]+=2*R;if(a[i+2]-c.z>R)a[i+2]-=2*R;else if(a[i+2]-c.z<-R)a[i+2]+=2*R;if(a[i+1]<0)a[i+1]+=9;else if(a[i+1]>9)a[i+1]-=9;{const qx=a[i]-c.x,qy=a[i+1]-c.y,qz=a[i+2]-c.z;if(qx*qx+qy*qy+qz*qz<4)a[i+1]=(a[i+1]+4.5)%9}}
   parts.g.attributes.position.needsUpdate=true}
  if(water){waterN.offset.x=time*.012;waterN.offset.y=time*.02}};
 return w}
