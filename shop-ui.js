// FRONT ZÉRO — the shop: weapons, equipment, finishes, outfits and sets, each sold separately for credits, with one large 3D preview.
// Loaded on demand from menu.js. The preview draws with the game's WebGL context into an offscreen target (no second context) and is released on close or when a match loads.
// No payment code, provider, link or real-money button exists here. No random boxes.
import * as THREE from 'three';
import { WEAPONS, WEAPON_CATS, OUTFITS, TEST_UNLOCK_ALL } from './data.js';
import { FINISHES, FINISH_GROUPS, rarityOf, finishById, finishName, pickLang, creditsOf, outfitPrice, outfitRarity, buildSets, weeklyRotation, notSold } from './cosmetics.js';
import { drawSwatch, finishTexture, prepareFinishes, soldierFinish } from './weapon-skins.js';
import { createWeaponPreview } from './guns.js';
import { createSoldier, outfitHook } from './soldier.js';
import { gearMaterial, gearModel, GEAR_MODEL_IDS } from './gear-models.js';
import './gear-data.js';

const GX = globalThis.FZGearData;
const CSS = `
.fzs{--bg:#0c0e0a;--pan:#151812;--pan2:#1c2018;--line:rgba(201,185,143,.17);--line2:rgba(201,185,143,.36);--sand:#d8c9a3;--dim:#a29e88;--white:#f4ecd8;--amber:#e8a628;--red:#e8664a;--green:#8fc46a;
position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;min-width:0;background:radial-gradient(120% 90% at 78% 0,#1d2118 0,#10130d 46%,var(--bg) 100%);color:var(--sand);font:16px/1.3 'Barlow Condensed','Arial Narrow',Arial,sans-serif;-webkit-font-smoothing:antialiased}
.fzs *{box-sizing:border-box}.fzs button{font:inherit;color:inherit}
.fzs :focus-visible{outline:2px solid var(--amber);outline-offset:1px}
.fzs-top{flex:none;display:flex;align-items:center;gap:14px 20px;padding:12px 22px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.fzs-top h2{margin:0;font-size:29px;line-height:1;font-weight:800;letter-spacing:.09em;color:var(--white)}.fzs-top h2 i{font-style:normal;color:var(--amber)}
.fzs-tabs{display:flex;gap:2px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none}.fzs-tabs::-webkit-scrollbar{display:none}
.fzs-tab{flex:none;min-height:42px;padding:0 15px;background:none;border:0;border-bottom:3px solid transparent;font-size:17px!important;font-weight:700!important;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)!important;cursor:pointer}
.fzs-tab:hover{color:var(--white)!important}.fzs-tab[aria-selected=true]{color:var(--white)!important;border-bottom-color:var(--amber)}
.fzs-bal{display:flex;align-items:center;gap:14px;margin-left:auto}
.fzs-cr{display:flex;flex-direction:column;align-items:flex-end;line-height:1.05}.fzs-cr small{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}.fzs-cr b{font-size:24px;font-weight:800;color:var(--amber);font-variant-numeric:tabular-nums}
.fzs-lvl{padding:4px 9px;border:1px solid var(--line2);font-weight:700;color:var(--white);white-space:nowrap}
.fzs-back{min-height:42px;padding:0 18px;background:var(--pan2);border:1px solid var(--line2);font-weight:700!important;letter-spacing:.05em;text-transform:uppercase;cursor:pointer}.fzs-back:hover{background:#2a2f24}
.fzs-test{flex:none;padding:5px 22px;background:rgba(232,166,40,.1);border-bottom:1px solid rgba(232,166,40,.3);color:#efd9a8;font-size:15px}.fzs-test b{color:var(--amber);letter-spacing:.08em}
.fzs-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(380px,min(44vw,720px))}
.fzs-list{min-width:0;min-height:0;overflow-y:auto;padding:14px 18px 26px 22px;scrollbar-color:#3c4133 transparent}
.fzs-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.fzs-chip{min-height:34px;padding:0 12px;background:var(--pan);border:1px solid var(--line);font-size:15px!important;font-weight:600!important;color:var(--dim)!important;cursor:pointer;white-space:nowrap}
.fzs-chip:hover{border-color:var(--line2);color:var(--white)!important}.fzs-chip[aria-pressed=true]{background:rgba(232,166,40,.14);border-color:var(--amber);color:var(--white)!important}
.fzs-sep{width:1px;background:var(--line);margin:3px 4px}
.fzs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:9px}
.fzs-card{position:relative;display:flex;flex-direction:column;min-width:0;padding:0;text-align:left;background:var(--pan);border:1px solid var(--line);border-left:3px solid var(--r,#6c7264);cursor:pointer;transition:background .12s,border-color .12s,transform .12s}
.fzs-card:hover{background:var(--pan2);transform:translateY(-1px)}.fzs-card[aria-pressed=true]{background:#262a1e;border-color:var(--amber);border-left-color:var(--r,var(--amber));box-shadow:inset 0 0 0 1px rgba(232,166,40,.45)}
.fzs-pic{position:relative;display:block;width:100%;aspect-ratio:2/1;overflow:hidden;background:linear-gradient(180deg,#22261d,#171a14)}
.fzs-pic img{position:absolute;inset:4px;width:calc(100% - 8px);height:calc(100% - 8px);object-fit:contain}
.fzs-pic img.fzs-fin{inset:0;width:100%;height:100%;object-fit:cover}
.fzs-week{display:flex;justify-content:space-between;align-items:flex-end;gap:6px 14px;flex-wrap:wrap;margin:0 0 12px;padding:10px 12px;background:linear-gradient(90deg,rgba(232,166,40,.14),rgba(232,166,40,0));border-left:3px solid var(--amber)}
.fzs-week h3{margin:0;font-size:24px;line-height:1.05;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--white)}.fzs-week p{margin:3px 0 0;font-size:14.5px;color:var(--dim)}
.fzs-cd{font-size:17px;font-weight:700;color:var(--amber);font-variant-numeric:tabular-nums;white-space:nowrap}
.fzs-card.feat{grid-column:span 2}.fzs-card.feat .fzs-name{font-size:22px}
.fzs-flag{position:absolute;left:0;top:0;z-index:2;padding:2px 9px;background:var(--amber);color:#17140a;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
.fzs-new{position:absolute;left:6px;bottom:8px;z-index:2;padding:0 6px;background:rgba(10,12,8,.85);border:1px solid var(--green);color:var(--green);font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.fzs-price.fzs-pass,.fzs-pass{color:#9fc0e8}
.fzs-acc{position:absolute;left:0;right:0;bottom:0;height:4px;z-index:1}
.fzs-pic canvas{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover}
.fzs-sw{position:absolute;inset:0;display:flex}.fzs-sw i{flex:1}
.fzs-info{display:flex;flex-direction:column;gap:1px;padding:6px 9px 7px}
.fzs-name{font-size:17px;font-weight:700;line-height:1.12;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fzs-sub{font-size:13.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fzs-row{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:3px;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
.fzs-price{color:var(--amber);white-space:nowrap}.fzs-price.is-short{color:var(--red)}
.fzs-state{font-size:12.5px;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;color:var(--dim)}.fzs-state.own{color:var(--green)}.fzs-state.on{color:#14170f;background:var(--amber);padding:0 5px}.fzs-state.lock{color:var(--red)}
.fzs-mark{position:absolute;top:4px;right:4px;z-index:1;padding:0 4px;background:rgba(10,12,8,.82);border:1px solid rgba(232,166,40,.5);color:var(--amber);font-size:11px;font-weight:700;letter-spacing:.08em}
.fzs-empty{padding:30px 10px;text-align:center;color:var(--dim)}
.fzs-detail{min-width:0;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:14px 22px 22px 16px;border-left:1px solid var(--line);background:rgba(13,15,11,.5)}
.fzs-view{position:relative;flex:none;width:100%;aspect-ratio:16/10;max-height:56vh;background:radial-gradient(90% 80% at 50% 42%,#2a2e25,#121410);border:1px solid var(--line2);overflow:hidden}
.fzs-view::before,.fzs-view::after{content:"";position:absolute;width:18px;height:18px;border:2px solid var(--amber);z-index:2;pointer-events:none}.fzs-view::before{left:6px;top:6px;border-right:0;border-bottom:0}.fzs-view::after{right:6px;bottom:6px;border-left:0;border-top:0}
.fzs-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:pan-y;opacity:0;transition:opacity .16s}.fzs-view canvas.is-on{opacity:1}.fzs-view canvas:active{cursor:grabbing}
.fzs-view img{position:absolute;inset:8%;width:84%;height:84%;object-fit:contain}
.fzs-hint{position:absolute;left:12px;bottom:7px;z-index:2;font-size:13px;color:var(--dim);pointer-events:none}
.fzs-rar{display:inline-block;padding:1px 8px;border:1px solid var(--r);color:var(--r);font-size:13.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
.fzs-dhead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.fzs-dhead h3{margin:2px 0 0;font-size:29px;line-height:1.02;font-weight:800;color:var(--white)}
.fzs-dprice{flex:none;text-align:right;font-size:26px;font-weight:800;line-height:1;color:var(--amber);font-variant-numeric:tabular-nums}.fzs-dprice small{display:block;margin-top:3px;font-size:13px;font-weight:600;color:var(--dim)}.fzs-dprice s{display:block;font-size:15px;font-weight:600;color:var(--dim)}
.fzs-desc{margin:0;color:var(--sand);font-size:16px}.fzs-parts{display:flex;flex-direction:column;gap:3px;margin:0;padding:0;list-style:none;font-size:15.5px}.fzs-parts li{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px solid var(--line)}.fzs-parts span:last-child{color:var(--dim);font-variant-numeric:tabular-nums}.fzs-parts .own{color:var(--green)}
.fzs-target{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--dim)}.fzs-target select{flex:1;min-width:0;min-height:38px;padding:0 8px;background:var(--pan2);border:1px solid var(--line2);color:var(--white);font:inherit}
.fzs-acts{display:flex;gap:8px;flex-wrap:wrap}.fzs-btn{flex:1 1 150px;min-height:48px;padding:0 16px;background:var(--pan2);border:1px solid var(--line2);font-size:18px!important;font-weight:800!important;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}.fzs-btn:hover:not([disabled]){background:#2c3126}
.fzs-btn.pri{background:var(--amber);border-color:var(--amber);color:#17140a!important}.fzs-btn.pri:hover:not([disabled]){background:#f4bb49}.fzs-btn[disabled]{opacity:.55;cursor:not-allowed}.fzs-btn.done{background:rgba(143,196,106,.13);border-color:var(--green);color:var(--green)!important;opacity:1}
.fzs-why{margin:0;font-size:16px;font-weight:600;color:var(--red)}
.fzs-dlg{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(6,7,5,.72)}
.fzs-dbox{width:min(440px,100%);padding:18px 20px;background:#1a1d15;border:1px solid var(--amber);box-shadow:0 14px 44px rgba(0,0,0,.65)}.fzs-dbox h3{margin:0 0 8px;font-size:24px;font-weight:800;letter-spacing:.04em;color:var(--white);text-transform:uppercase}
.fzs-sum{display:grid;grid-template-columns:1fr auto;gap:3px 14px;margin:8px 0 14px;font-size:17px;font-variant-numeric:tabular-nums}.fzs-sum b{color:var(--white);text-align:right}.fzs-sum .tot{color:var(--amber)}
.fzs-toast{position:absolute;left:50%;bottom:20px;z-index:6;transform:translateX(-50%);max-width:calc(100% - 32px);padding:9px 16px;background:#20261a;border:1px solid var(--green);color:var(--white);font-weight:600;box-shadow:0 6px 22px rgba(0,0,0,.55)}.fzs-toast.bad{border-color:var(--red)}
@media (max-width:1180px){.fzs-tab{padding:0 10px;font-size:16px!important}.fzs-body{grid-template-columns:minmax(0,1fr) minmax(330px,42vw)}.fzs-grid{grid-template-columns:repeat(auto-fill,minmax(152px,1fr))}}
@media (max-width:820px){.fzs{overflow-y:auto;-webkit-overflow-scrolling:touch}.fzs-top{padding:8px 16px;gap:6px 10px}.fzs-top h2{font-size:23px}.fzs-tabs{order:5;flex:1 0 100%}.fzs-cr b{font-size:20px}.fzs-back{min-height:44px;padding:0 12px}.fzs-test{padding:4px 16px;font-size:14px}
.fzs-body{display:flex;flex-direction:column;flex:none;min-height:auto}.fzs-detail{order:-1;overflow:visible;padding:10px 16px;border-left:0;border-bottom:1px solid var(--line)}.fzs-view{max-height:40vh}.fzs-list{overflow:visible;padding:12px 16px 26px}.fzs-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.fzs-dhead h3{font-size:24px}.fzs-dprice{font-size:22px}.fzs-chip{min-height:40px}.fzs-filters{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-right:-16px;padding-right:16px}.fzs-sep{flex:none}}
`;
let cssDone = false;
const injectCss = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };
function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  if (props) for (const k of Object.keys(props)) { const v = props[k]; if (v === null || v === undefined || v === false) continue; if (k === 'text') n.textContent = v; else if (k === 'style') n.style.cssText = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c);
  return n;
}
const hex = h => '#' + (h >>> 0).toString(16).padStart(6, '0');

/* ---------- studio: soldier and equipment previews, same offscreen approach as the weapon preview ----------
   opts.stage: the outfit stage (round bevelled pedestal with a neon strip, spotlight, contact shadow, abstract backdrop).
   opts.fancy: haze cone, glow halos and backdrop lines (false = the simple static stage: lowest quality or reduced motion).
   opts.motion: idle rotation and slow backdrop drift (false = still image, drag still rotates). opts.ring: neon colour. */
const GLOW_VS = 'varying vec2 vUv;varying vec3 vP;varying vec3 vN;void main(){vUv=uv;vP=position;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
// one program for every glow: 0 band rising from the neon, 1 disc falloff (light pool, floor halo), 2 haze cone, 3 contact shadow, 4 the neon's reflection on the top
const GLOW_FS = `uniform vec3 uColor;uniform float uK;uniform float uMode;uniform float uR0;uniform float uR1;varying vec2 vUv;varying vec3 vP;varying vec3 vN;
void main(){float a=0.;
 if(uMode<.5){float d=(vUv.y-.5)*2.;a=exp(-d*d*5.);}
 else if(uMode<1.5){float r=length(vP.xy);a=smoothstep(uR1,uR0,r);a*=a;}
 else if(uMode<2.5){float t=clamp(vP.y/uR1+.5,0.,1.);a=mix(.35,1.,t)*smoothstep(0.,.12,t)*smoothstep(1.,.86,t)*pow(abs(vN.z),1.8);}
 else if(uMode<3.5){float r=length(vP.xy)/uR0;a=1.-smoothstep(0.,1.,r);a*=a;gl_FragColor=vec4(0.,0.,0.,a*uK);return;}
 else{float d=(length(vP.xy)-uR0)/uR1;a=exp(-d*d*2.)*.85+exp(-d*d*.22)*.15;}
 gl_FragColor=vec4(uColor*uK*a,1.);}`;
const BLIT_FS = `uniform sampler2D t;uniform float uStage;uniform float uLines;uniform float uTime;uniform vec3 uTint;uniform float uAspect;varying vec2 vUv;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
vec3 backdrop(vec2 uv){
 vec2 p=(uv-vec2(.5,.56))*vec2(uAspect,1.);float r=length(p);
 vec3 col=mix(vec3(.0052,.0075,.012),vec3(.0005,.0007,.0013),smoothstep(.02,.9,r));
 col+=uTint*.011*exp(-r*r*3.2);
 if(uLines>.5){
  float px=1./720.,l=0.;
  for(int i=0;i<4;i++){float fi=float(i);float o=fract(fi*.29+uTime*.006*(1.+fi*.35));vec2 a=vec2(-.2+o*1.4,1.1),b=vec2(-.6+o*1.4,-.1);l+=(1.-smoothstep(px*.6,px*2.2,seg(uv,a,b)))*(.5+.5*sin(fi*2.1));}
  float ring=abs(length(p*vec2(1.,1.15))-.42);l+=(1.-smoothstep(px*.5,px*2.,ring))*.8*smoothstep(.0,.25,abs(p.x));
  vec2 g=fract(vec2(p.x*7.,(p.y+.62)*7.));float grid=step(p.y,-.3)*(1.-smoothstep(0.,.035,min(g.x,g.y)))*smoothstep(-.3,-.62,p.y)*.35;
  col+=(uTint*.5+vec3(.25,.42,.6))*(l*.032+grid*.026);
 }
 return col;}
void main(){vec4 c=texture2D(t,vUv);vec3 bg;
 if(uStage>.5)bg=backdrop(vUv);else{vec2 p=vUv-.5;float r=dot(p,p);bg=mix(vec3(.105,.115,.095),vec3(.018,.02,.02),clamp(r*3.,0.,1.));}
 vec3 col=aces(c.rgb*1.05)+bg*(1.-clamp(c.a,0.,1.));gl_FragColor=vec4(pow(col,vec3(1./2.2)),1.);}`;
/** Neon colour of a rarity: its own colour, brightened (common's grey would look dead as a light). */
export const ringColorOf = rarity => ({ common: 0x9fe7e0, uncommon: 0x7be07a, rare: 0x5cb2ff, epic: 0xc187ff, legendary: 0xffb43a })[rarity] || 0x9fe7e0;
export function createStudio(renderer, canvas, opts = {}) {
  const gl = renderer.getContext(); if (!gl || gl.isContextLost()) throw new Error('no WebGL context');
  const ctx2d = canvas.getContext('2d', { alpha: false }), W = canvas.width, H = canvas.height, scene = new THREE.Scene(), pivot = new THREE.Group(); scene.add(pivot);
  const stage = !!opts.stage, fancy = stage && opts.fancy !== false, motion = opts.motion !== false, ringCol = new THREE.Color(opts.ring ?? 0x9fe7e0);
  const hemi = new THREE.HemisphereLight(0xcfdcec, 0x5b4d3a, stage ? .55 : 1.3), key = new THREE.DirectionalLight(0xffe2bd, stage ? 1.0 : 2.8), rim = new THREE.DirectionalLight(stage ? ringCol : 0xb9cfff, stage ? 2.2 : 1.2);
  key.position.set(1.4, 2.6, 3); rim.position.set(-2.4, 1.2, -2.2); scene.add(hemi, key, rim);
  const back = stage ? new THREE.DirectionalLight(0xbcd4ff, 1.5) : null; if (back) { back.position.set(2.3, 1.7, -2.1); scene.add(back); }       // cool back light: a dark outfit keeps its outline against the dark backdrop
  const own = [];                         // stage geometries, materials and textures: released by dispose()
  let spot = null, neonMat = null, glows = [], under = null;
  if (stage) {
    const R = .62, mesh = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; own.push(geo, mat); scene.add(m); return m; };
    const glow = (mode, k, extra) => { const m = new THREE.ShaderMaterial({ vertexShader: GLOW_VS, fragmentShader: GLOW_FS, uniforms: { uColor: { value: ringCol.clone() }, uK: { value: k }, uMode: { value: mode }, uR0: { value: extra.r0 || 0 }, uR1: { value: extra.r1 || 1 } }, transparent: true, depthWrite: false, side: extra.side || THREE.FrontSide,
      ...(mode === 3 ? { blending: THREE.NormalBlending } : { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }) }); glows.push(m); return m; };
    // pedestal: a lathe with bevelled top and bottom edges, satin dark metal (smooth enough to catch the neon and the spot)
    const prof = [[0, -.17], [R - .07, -.17], [R - .025, -.162], [R - .004, -.135], [R, -.11], [R, -.035], [R - .006, -.012], [R - .026, 0], [0, 0]].map(p => new THREE.Vector2(p[0], p[1]));
    mesh(new THREE.LatheGeometry(prof, 72), new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: .72, roughness: .26 }));
    const groove = mesh(new THREE.RingGeometry(R - .13, R - .118, 72), new THREE.MeshBasicMaterial({ color: 0x07080a }), .0015); groove.rotation.x = -Math.PI / 2;
    // the neon: one thin line all around the top, just inside the rim, and its soft reflection on the satin top
    neonMat = new THREE.MeshBasicMaterial({ color: ringCol.clone().multiplyScalar(2.8), toneMapped: false });
    const line = mesh(new THREE.TorusGeometry(R - .035, .0055, 6, 128), neonMat, .0045); line.rotation.x = Math.PI / 2;
    const refl = mesh(new THREE.RingGeometry(R - .2, R - .007, 96, 1), glow(4, .5, { r0: R - .035, r1: .05 }), .0025); refl.rotation.x = -Math.PI / 2; refl.renderOrder = 2;
    // the spotlight, tilted about 25 degrees from the front right: lit side, shaded side, pool and shadow offset
    const SP = new THREE.Vector3(.8, 3.05, .74), AIM = new THREE.Vector3(0, .85, 0), dir = AIM.clone().sub(SP).normalize(), hit = SP.clone().addScaledVector(dir, -SP.y / dir.y);
    const pc = new THREE.Vector2(hit.x, hit.z); if (pc.length() > .15) pc.setLength(.15);           // the pool stays on the pedestal
    const shadow = mesh(new THREE.CircleGeometry(.36, 40), glow(3, .62, { r0: .36 }), .003); shadow.rotation.x = -Math.PI / 2; shadow.position.x = -.09; shadow.position.z = -.08; shadow.scale.set(1.2, 1, 1); shadow.renderOrder = 1;       // cast away from the light
    const pool = mesh(new THREE.CircleGeometry(.44, 48), glow(1, .34, { r0: .08, r1: .44 }), .0035); pool.rotation.x = -Math.PI / 2; pool.position.x = pc.x; pool.position.z = pc.y; pool.renderOrder = 2; pool.material.uniforms.uColor.value.set(0xfff1dc);
    // the neon lights the boots and shins from below: one low point light at the front, and the hemisphere's ground colour
    under = new THREE.PointLight(ringCol.clone(), 1.15, 1.5, 2); under.position.set(0, .07, .5); scene.add(under);
    hemi.groundColor.copy(ringCol).multiplyScalar(.55);
    if (fancy) {
      mesh(new THREE.CylinderGeometry(R - .035, R - .035, .18, 96, 1, true), glow(0, .24, { side: THREE.DoubleSide }), .004).renderOrder = 3;       // light rising from the line (its lower half is inside the pedestal)
      const floor = mesh(new THREE.CircleGeometry(1.02, 64), glow(1, .14, { r0: R * .98, r1: 1.02 }), -.175); floor.rotation.x = -Math.PI / 2; floor.renderOrder = 0;
      const base = new THREE.Vector3(pc.x, 0, pc.y), L = SP.distanceTo(base);
      const cone = mesh(new THREE.CylinderGeometry(.08, .52, L, 48, 1, true), glow(2, .13, { r1: L, side: THREE.BackSide }));       // far wall only: the haze surrounds the outfit, never veils it
      cone.position.copy(SP).add(base).multiplyScalar(.5); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), SP.clone().sub(base).normalize()); cone.renderOrder = 4; cone.material.uniforms.uColor.value.set(0xe8eeff);
    }
    spot = new THREE.SpotLight(0xfff4e6, 38, 8, .42, .55, 2); spot.position.copy(SP); spot.target.position.copy(AIM); scene.add(spot, spot.target);
  }
  const cam = new THREE.PerspectiveCamera(24, W / H, .05, 30);
  const half = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const hdr = new THREE.WebGLRenderTarget(W, H, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 4 }), ldr = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
  const blitMat = new THREE.ShaderMaterial({ uniforms: { t: { value: hdr.texture }, uStage: { value: stage ? 1 : 0 }, uLines: { value: fancy ? 1 : 0 }, uTime: { value: 0 }, uTint: { value: ringCol.clone() }, uAspect: { value: W / H } }, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=vec2(uv.x,1.-uv.y);gl_Position=vec4(position.xy,0.,1.);}', fragmentShader: BLIT_FS });
  const blitScene = new THREE.Scene(), blitCam = new THREE.Camera(), blitGeo = new THREE.PlaneGeometry(2, 2), blit = new THREE.Mesh(blitGeo, blitMat); blit.frustumCulled = false; blitScene.add(blit);
  const pixels = new Uint8ClampedArray(W * H * 4), image = new ImageData(pixels, W, H), _c = new THREE.Color();
  let alive = true, raf = 0, last = 0, yaw = Math.PI - .55, pitch = stage ? .12 : .06, hold = 0, dirty = true, tickFn = null, ready = false, cy = 0, dist = 3, clock = 0;
  const draw = () => {
    const prev = renderer.getRenderTarget(), ac = renderer.autoClear, ca = renderer.getClearAlpha(); renderer.getClearColor(_c);
    try {
      pivot.rotation.set(0, yaw, 0); cam.position.set(0, cy + Math.sin(pitch) * dist, Math.cos(pitch) * dist); cam.lookAt(0, cy, 0);       // the camera orbits: the pedestal never tilts
      blitMat.uniforms.uTime.value = clock;
      renderer.autoClear = true; renderer.setClearColor(0, 0); renderer.setRenderTarget(hdr); renderer.render(scene, cam); renderer.setRenderTarget(ldr); renderer.render(blitScene, blitCam); renderer.readRenderTargetPixels(ldr, 0, 0, W, H, pixels);
    } finally { renderer.setRenderTarget(prev); renderer.autoClear = ac; renderer.setClearColor(_c, ca); }
    ctx2d.putImageData(image, 0, 0);
  };
  let autoOn = motion, frames = 0, spent = 0, avg = 0;       // a slow machine keeps the preview but stops its idle motion, like the weapon preview
  const tick = now => {
    if (!alive) return; raf = requestAnimationFrame(tick); if (!ready || document.hidden || now - last < 40) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (autoOn && now > hold) { yaw += dt * .42; dirty = true; } if (autoOn && tickFn) { tickFn(dt); dirty = true; } if (autoOn && fancy) clock += dt;
    if (!dirty || gl.isContextLost()) return; dirty = false;
    const t0 = performance.now(); draw(); spent += performance.now() - t0; if (++frames === 24) { avg = spent / frames; if (avg > 22) autoOn = false; frames = 0; spent = 0; }
  };
  return {
    pivot, scene,
    /** Average draw time of the last 24 frames (ms) and whether the idle motion still runs. */
    get stats() { return { avg: +avg.toFixed(2), autoOn, stage, fancy, W, H }; },
    frame(height, centerY, radius) { cy = centerY; const vf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)); dist = Math.max(height / (2 * vf), radius * 2 / (2 * vf * cam.aspect)) * 1.12; cam.near = Math.max(.02, dist - radius * 2.2); cam.far = dist + radius * 2.2 + 4; cam.updateProjectionMatrix(); },
    onTick(fn) { tickFn = fn; },
    /** The neon colour (rarity of the item shown). */
    setRing(hex) { ringCol.set(hex); if (neonMat) neonMat.color.copy(ringCol).multiplyScalar(2.6); for (const m of glows) if (m.uniforms.uMode.value === 0 || m.uniforms.uMode.value === 4 || (m.uniforms.uMode.value === 1 && m.uniforms.uR1.value > 1)) m.uniforms.uColor.value.copy(ringCol); if (stage) { rim.color.copy(ringCol); hemi.groundColor.copy(ringCol).multiplyScalar(.55); if (under) under.color.copy(ringCol); } blitMat.uniforms.uTint.value.copy(ringCol); dirty = true; },
    async start() {
      const prev = renderer.getRenderTarget(); let wait;
      try { renderer.setRenderTarget(hdr); wait = renderer.compileAsync ? renderer.compileAsync(scene, cam) : null; renderer.setRenderTarget(ldr); renderer.compile(blitScene, blitCam); } finally { renderer.setRenderTarget(prev); }
      if (wait) await Promise.race([wait, new Promise(r => setTimeout(r, 6000))]);
      if (!alive || gl.isContextLost()) return false;
      draw(); ready = true; last = performance.now(); raf = requestAnimationFrame(tick); return true;
    },
    rotate(dx, dy) { yaw += dx; pitch = Math.max(-.3, Math.min(.6, pitch + dy)); hold = performance.now() + 2600; dirty = true; },
    /** Draws one frame now (captures reuse one studio). False if the context is lost. */
    render() { if (!alive || gl.isContextLost()) return false; draw(); return true; },
    get lost() { return gl.isContextLost(); },
    dispose() { if (!alive) return; alive = false; cancelAnimationFrame(raf); for (const o of own) o.dispose(); blitGeo.dispose(); blitMat.dispose(); hdr.dispose(); ldr.dispose(); key.dispose(); rim.dispose(); hemi.dispose(); if (back) back.dispose(); if (spot) spot.dispose(); if (under) under.dispose(); },
  };
}

/* ---------- the screen ---------- */
const TABS = [['weekly', 'store.tab.weekly'], ['weapons', 'store.tab.weapons'], ['gear', 'store.tab.gear'], ['finishes', 'store.tab.finishes'], ['outfits', 'store.tab.outfits'], ['sets', 'store.tab.sets']];
const SLOT_ORDER = ['L', 'T', 'M'];
const gearPic = id => new URL('map-shots/gear-' + id + '.webp', import.meta.url).href;
const shotUrl = id => new URL(`weapon-shots/${encodeURIComponent(id)}.webp`, import.meta.url).href;
const finShot = id => shotUrl('fin-' + id);
/* outfit pictures (.handoff/shop/capture-outfits.cjs): only the ids listed in outfit-shots/index.json are requested, so a colourway added later shows its swatch, never a 404 */
const outfitShot = id => new URL(`outfit-shots/${encodeURIComponent(id)}.webp`, import.meta.url).href;
let shotsP = null;
const loadOutfitShots = () => shotsP || (shotsP = fetch(new URL('outfit-shots/index.json', import.meta.url)).then(r => (r.ok ? r.json() : null)).then(j => new Set(j && Array.isArray(j.ids) ? j.ids : [])).catch(() => new Set()));       // the real weapon in this finish (.handoff/shop/capture-finishes.cjs)

let live = null;       // one shop at a time: a second openShop() call focuses the open one
/** deps: { engine, profile, i18n } required; optional { sfx(name), weaponType(w), outfitName(o), onChange(), onClose(), focus: { tab: 'finishes' | 'outfits' | ..., id } }.
    The season pass opens the 3D preview on one of its items with openShop({ engine, profile, i18n, focus: { tab: 'finishes', id: 's1_signal' } }). */
export async function openShop(deps) {
  if (live) { live.focus(deps && deps.focus); return live; }
  injectCss();
  const { engine, profile, i18n, onChange, onClose } = deps, sfx = deps.sfx || (() => {}), weaponType = deps.weaponType || (w => w.type || ''), outfitName = deps.outfitName || (o => (o ? o.name : ''));
  const T = (k, p) => i18n.t(k, p), lang = () => i18n.lang || 'fr', num = n => Number(n).toLocaleString(lang()).replace(/\u202f|\u00a0/g, ' ');
  // premium outfit sets (outfits.js: ÉCLIPSE, COLOSSE...) and their colourways, when that module is there
  let specials = [], fitSets = [{ id: 'eclipse', name: 'ÉCLIPSE' }];
  try { const m = await import('./outfits.js'); specials = m.OUTFIT_SETS || []; if (m.setOf) fitSets = m.setOf(); globalThis.FZOutfitSets = specials; if (!outfitHook.attach && m.attachOutfit) outfitHook.attach = m.attachOutfit; if (m.prepareOutfits) { deps.prepOutfits = m.prepareOutfits; } } catch { /* the shop works without it */ }
  const outfitShots = await loadOutfitShots();
  const allOutfits = () => [...OUTFITS, ...specials], sets = buildSets(OUTFITS, specials);
  const outfitById = id => allOutfits().find(o => o.id === id) || null;
  const outLabel = o => (o.colorway ? (T('outfit.' + o.id) !== 'outfit.' + o.id ? T('outfit.' + o.id) : `${o.name} ${o.colorway}`) : outfitName(o));       // a colourway with its own i18n label uses it
  const gearIds = GX ? SLOT_ORDER.flatMap(s => GX.listFor(s)) : [];
  // weekly rotation: everything sold for credits, the same for everyone; "new" = not in last week's selection
  const pool = [...FINISHES.filter(f => !notSold(f)).map(f => ({ key: 'finish:' + f.id, kind: 'finish', rarity: f.rarity, family: f.family || f.pattern })),
    ...allOutfits().filter(o => !notSold(o) && creditsOf(outfitPrice(o)) > 0).map(o => ({ key: 'outfit:' + o.id, kind: 'outfit', rarity: outfitRarity(o), family: o.setId || 'base' }))];
  let week = null, fresh = new Set();
  const refreshWeek = () => { week = weeklyRotation(pool); const prev = weeklyRotation(pool, new Date(week.start.getTime() - 864e5)); fresh = new Set(week.keys.filter(k => !prev.keys.includes(k))); };
  refreshWeek();
  const st = { tab: 'weekly', filter: 'all', status: 'all', sel: { weapons: profile.data.primary, gear: gearIds[0] || null, finishes: 'ecl_jaune', outfits: profile.data.outfit, sets: sets[0]?.id || null, weekly: week.featured }, target: profile.data.primary };
  const root = el('div', { class: 'fzs', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('store.title'), 'data-fid': 'shop:screen' });
  const glCanvas = engine && engine.internals && engine.internals.renderer ? engine.internals.renderer.domElement : null;
  let closed = false, cur = null, curKey = '', load = 0, dlg = null, toastT = 0, offLoad = null, previewTimer = 0;

  /* ---------- preview ---------- */
  const canvas = el('canvas', { role: 'img', tabindex: '0', 'aria-label': T('store.preview'), 'data-fid': 'shop:preview' }), fallback = el('img', { alt: '' }), view = el('div', { class: 'fzs-view' }, fallback, canvas, el('span', { class: 'fzs-hint', text: T('store.dragHint') }));
  const dropPreview = () => { const p = cur; cur = null; curKey = ''; if (p) { try { p.obj.dispose(); } catch (e) { console.warn('[shop] preview', e); } if (p.extra) try { p.extra(); } catch { /* ignore */ } } canvas.classList.remove('is-on'); };
  let dragId = null, dragX = 0, dragY = 0;
  canvas.addEventListener('pointerdown', e => { dragId = e.pointerId; dragX = e.clientX; dragY = e.clientY; try { canvas.setPointerCapture(dragId); } catch { /* synthetic */ } });
  canvas.addEventListener('pointermove', e => { if (e.pointerId !== dragId || !cur) return; cur.obj.rotate((e.clientX - dragX) * .011, (e.clientY - dragY) * .007); dragX = e.clientX; dragY = e.clientY; });
  const endDrag = e => { if (e.pointerId === dragId) dragId = null; }; canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', e => { if (!cur) return; const k = { ArrowLeft: [-.18, 0], ArrowRight: [.18, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] }[e.key]; if (k) { e.preventDefault(); cur.obj.rotate(k[0], k[1]); } });
  const onLost = () => { load++; clearTimeout(previewTimer); dropPreview(); }, onBack = () => { if (!closed) syncPreview(); };       // lost: the card's picture stays; restored: the 3D comes back
  if (glCanvas) { glCanvas.addEventListener('webglcontextlost', onLost); glCanvas.addEventListener('webglcontextrestored', onBack); }
  const sizeCanvas = () => { const b = view.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = Math.max(360, Math.min(720, Math.round((b.width || 600) * dpr))), h = Math.max(220, Math.round(w * ((b.height || 375) / (b.width || 600)))); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } };

  /** What the selected item shows: a weapon (with a finish), a soldier (with an outfit) or a piece of equipment. */
  function wanted() {
    const it = selected(); if (!it) return null;
    if (it.kind === 'weapon') return { type: 'weapon', id: it.id, fin: profile.finOf(it.id) };
    if (it.kind === 'finish') return { type: 'weapon', id: st.target, fin: it.id };
    if (it.kind === 'gear') return { type: 'gear', id: it.id };
    if (it.kind === 'outfit') return { type: 'soldier', outfit: it.id, weaponId: profile.data.primary, fin: profile.finOf(profile.data.primary) };
    const s = it.set; return { type: 'soldier', outfit: s.outfit, weaponId: profile.data.primary, fin: s.finishes[0] };
  }
  // the simple static stage: lowest graphics preset, or reduced motion (game setting or system)
  const lowFx = () => { try { return !!(deps.settings && /^(bas|mobile)$/.test(deps.settings.get('graphics.preset'))); } catch { return false; } };
  const stillFx = () => { try { return !!(deps.settings && deps.settings.get('gameplay.reducedMotion')) || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; } };
  const paletteOf = o => { if (!o) return undefined; if (Array.isArray(o.c)) return o.c; const p = o.palette || {}; return [p.cloth ?? 0x4c5238, p.cloth2 ?? 0x2a2e22, p.plate ?? 0x7c7a5c]; };
  function syncPreview(now) { clearTimeout(previewTimer); previewTimer = setTimeout(applyPreview, now ? 0 : 110); }
  async function applyPreview() {
    if (closed || !glCanvas || engine.running || engine.loading) return;
    const w = wanted(); if (!w) return;
    const key = w.type === 'weapon' ? `w:${w.id}` : w.type === 'gear' ? `g:${w.id}` : `s:${w.outfit}:${w.weaponId}:${w.fin || ''}`;
    fallback.src = w.type === 'weapon' ? shotUrl(w.id) : w.type === 'gear' ? gearPic(w.id) : shotUrl(w.weaponId);
    if (key === curKey && cur) { if (w.type === 'weapon') { if (w.fin) await prepareFinishes([w.fin]); if (!closed && cur && curKey === key) cur.obj.setFinish(w.fin); } return; }
    const tok = ++load; dropPreview(); curKey = key;
    try {
      sizeCanvas(); const R = engine.internals.renderer;
      if (w.fin) await prepareFinishes([w.fin]); if (tok !== load || closed) return;
      let p;
      if (w.type === 'weapon') {
        const def = WEAPONS.find(x => x.id === w.id); if (!def) return;
        p = { obj: createWeaponPreview(R, canvas, profile.armed ? profile.armed(def) : def) }; cur = p;
        p.obj.setFinish('ecl_rouge');         // both kinds of finished material exist while the shaders link: changing finish later compiles nothing
        finishTexture('ecl_rouge');
        if (!(await p.obj.start(profile.armed ? profile.armed(def) : def)) || tok !== load) { if (cur === p) dropPreview(); return; }
        p.obj.setFinish(w.fin);
      } else if (w.type === 'gear') {
        const m = gearModel(THREE, w.id), s = createStudio(R, canvas); p = { obj: s }; cur = p;
        const mesh = new THREE.Mesh(m.geo, gearMaterial(THREE, true)); m.geo.computeBoundingBox(); const c = m.geo.boundingBox.getCenter(new THREE.Vector3()); mesh.position.copy(c).negate(); s.pivot.add(mesh); s.frame(m.radius * 2.1, 0, m.radius * 1.1);
        if (!(await s.start()) || tok !== load) { if (cur === p) dropPreview(); return; }
      } else {
        const o = outfitById(w.outfit), s = createStudio(R, canvas, { stage: true, fancy: !lowFx(), motion: !lowFx() && !stillFx(), ring: ringColorOf(outfitRarity(o)) }); p = { obj: s }; cur = p;
        if (o && o.colorway && deps.prepOutfits) { try { await deps.prepOutfits(() => new Promise(r => setTimeout(r, 0)), [o.id]); } catch (e) { console.warn('[shop] outfit', e); } if (tok !== load) { if (cur === p) dropPreview(); return; } }
        const sol = createSoldier(s.pivot, { palette: paletteOf(o), weaponId: w.weaponId, outfit: o && o.colorway ? o.id : undefined });
        soldierFinish(sol, w.fin); p.extra = () => sol.dispose();
        const pose = { vx: 0, vz: 0, yaw: 0, aimPitch: -.08, grounded: true, crouch: 0, y: 0 }; sol.update(1 / 60, pose);
        s.frame(2.55, .8, 1.1); s.onTick(dt => sol.update(dt, pose));
        if (!(await s.start()) || tok !== load) { if (cur === p) dropPreview(); return; }
      }
      if (tok === load && cur === p) canvas.classList.add('is-on');
    } catch (e) { console.warn('[shop] 3D preview unavailable, keeping the picture', e); if (tok === load) dropPreview(); }
  }

  /* ---------- catalogue ---------- */
  const weaponList = () => WEAPONS.filter(w => w.slot < 2);
  const itemOf = (tab, id) => {
    if (id === null || id === undefined) return null;
    if (tab === 'weekly') { const i = String(id).indexOf(':'), k = String(id).slice(0, i), x = itemOf(k === 'finish' ? 'finishes' : k === 'outfit' ? 'outfits' : 'sets', String(id).slice(i + 1)); return x && { ...x, key: id }; }
    if (tab === 'weapons') { const w = weaponList().find(x => x.id === id); return w ? { kind: 'weapon', id, w, name: w.name, sub: weaponType ? weaponType(w) : w.type, rarity: null, q: profile.quote('weapon', id) } : null; }
    if (tab === 'gear') { const g = GX && GX.ITEMS[id]; return g ? { kind: 'gear', id, g, name: GX.nameOf(id, lang()), sub: GX.slotName(g.slot, lang()), rarity: null, q: profile.quote('gear', id) } : null; }
    if (tab === 'finishes') { const f = finishById(id); return f ? { kind: 'finish', id, f, name: finishName(f, lang()), sub: pickLang(rarityOf(f.rarity).n, lang()), rarity: f.rarity, q: profile.quote('finish', id) } : null; }
    if (tab === 'outfits') { const o = outfitById(id); return o ? { kind: 'outfit', id, o, name: outLabel(o), sub: pickLang(rarityOf(outfitRarity(o)).n, lang()) + (o.mapName ? ' · ' + o.mapName : ''), rarity: outfitRarity(o), q: profile.quote('outfit', id) } : null; }
    const s = sets.find(x => x.id === id); if (!s) return null;
    const o = outfitById(s.outfit); return { kind: 'set', id, set: s, o, name: pickLang(s.n, lang()), sub: T('store.setParts', { n: 1 + s.finishes.length }), rarity: outfitRarity(o), q: profile.quote('set', id, s) };
  };
  const selected = () => itemOf(st.tab, st.sel[st.tab]);
  const tabIds = () => (st.tab === 'weekly' ? week.keys : st.tab === 'weapons' ? weaponList().map(w => w.id) : st.tab === 'gear' ? gearIds : st.tab === 'finishes' ? FINISHES.map(f => f.id) : st.tab === 'outfits' ? allOutfits().map(o => o.id) : sets.map(s => s.id));
  const filters = () => {
    if (st.tab === 'weekly') return [];
    if (st.tab === 'weapons') { const cats = WEAPON_CATS.filter(c => weaponList().some(w => w.cat === c.id)); return cats.map(c => [c.id, T('weaponCat.' + c.id) === 'weaponCat.' + c.id ? c.name : T('weaponCat.' + c.id), it => it.w.cat === c.id]); }
    if (st.tab === 'gear') return SLOT_ORDER.map(s => [s, GX.slotName(s, lang()), it => it.g.slot === s]);
    if (st.tab === 'finishes') return FINISH_GROUPS.map(g => [g.id, pickLang(g.n, lang()), it => g.test(it.f)]);
    if (st.tab === 'outfits') return [['base', T('store.fBase'), it => !it.o.colorway], ...fitSets.filter(f => !f.map).map(f => [f.id, f.name, it => !!it.o.colorway && (it.o.setId || 'eclipse') === f.id]),       // one filter per set (COLOSSE is the outfit, never the Colosse H-50 pistol)
      ...(fitSets.some(f => f.map) ? [['maps', T('store.fMaps'), it => !!it.o.colorway && typeof it.o.map === 'string']] : [])];       // the map-themed sets (outfit-map-*.js) share one filter; each shows its map under its name
    return [['eclipse', 'ÉCLIPSE', it => it.set.family === 'eclipse'], ['base', T('store.fBase'), it => it.set.family !== 'eclipse']];
  };
  const isOn = it => it.kind === 'weapon' ? [profile.data.primary, profile.data.secondary].includes(it.id) : it.kind === 'gear' ? profile.data.gx[it.g.slot] === it.id : it.kind === 'finish' ? profile.data.cos.w[st.target] === it.id : it.kind === 'outfit' ? profile.outfitWorn(it.id) : profile.outfitWorn(it.set.outfit) && it.set.finishes.includes(profile.data.cos.w[profile.data.primary]);
  const visible = () => {
    const all = tabIds().map(id => itemOf(st.tab, id)).filter(Boolean), f = filters().find(x => x[0] === st.filter);
    return all.filter(it => (!f || f[2](it)) && (st.status === 'all' || (st.status === 'owned' ? it.q.owned : st.status === 'buy' ? (!it.q.owned || it.q.test) && it.q.levelOk && it.q.missing === 0 : true)));
  };

  /* ---------- drawing ---------- */
  const tabsEl = el('div', { class: 'fzs-tabs', role: 'tablist', 'aria-label': T('store.title') }), balEl = el('div', { class: 'fzs-bal' }), listEl = el('div', { class: 'fzs-list', role: 'tabpanel' }), detailEl = el('div', { class: 'fzs-detail' });
  const swatchJobs = [];
  let swatchRun = false;
  const pumpSwatches = () => { if (swatchRun) return; swatchRun = true; const step = () => { if (closed || !swatchJobs.length) { swatchRun = false; return; } const j = swatchJobs.shift(); if (j.c.isConnected) { try { drawSwatch(j.c, j.id); } catch { /* the card keeps its colour */ } } setTimeout(step, 0); }; setTimeout(step, 0); };
  const priceText = q => (q.notSold ? T('store.passItem', { n: q.passTier ?? '—' }) : q.cost === 0 ? T('store.free') : `${num(q.cost)} ₡`);
  /** The finish's picture; if the file is missing, its generated pattern takes the same place. */
  function finishPic(box, fid, place) {
    const swatch = () => { const c = el('canvas', { width: 128, height: 128, 'aria-hidden': 'true', style: `background:${hex(finishById(fid).c[1])};${place}` }); box.append(c); swatchJobs.push({ c, id: fid }); pumpSwatches(); };
    const f = finishById(fid); if (!f || (f.source && !f.picture)) { swatch(); return; }       // a pass finish ships no picture unless it says so: no request, no 404
    box.append(el('img', { class: 'fzs-fin', alt: '', loading: 'lazy', decoding: 'async', style: place || null, src: finShot(fid), onerror: e => { e.target.remove(); swatch(); } }));
  }
  function picture(it) {
    const box = el('span', { class: 'fzs-pic' });
    if (it.kind === 'weapon') box.append(el('img', { alt: '', loading: 'lazy', src: shotUrl(it.id), onerror: e => e.target.remove() }));
    else if (it.kind === 'gear') box.append(el('img', { alt: '', loading: 'lazy', src: gearPic(it.id), onerror: e => e.target.remove() }));
    else if (it.kind === 'finish') { finishPic(box, it.id, ''); if (it.f.family === 'eclipse') box.append(el('i', { class: 'fzs-acc', style: `background:${hex(it.f.accent)}` })); }       // the eight ÉCLIPSE differ by their accent colour
    else {
      const o = it.o, cols = o && Array.isArray(o.c) ? o.c : o && o.palette ? [o.palette.cloth, o.palette.plate, o.palette.accent] : [0x444444, 0x333333, 0x222222], sw = el('span', { class: 'fzs-sw' }, cols.map(c => el('i', { style: `background:${hex(c)}` })));
      box.append(sw);
      const oid = it.kind === 'set' ? it.set.outfit : it.id, has = outfitShots.has(oid);
      if (has) box.append(el('img', { class: 'fzs-fin', alt: '', loading: 'lazy', decoding: 'async', style: it.kind === 'set' ? 'left:0;width:50%' : null, src: outfitShot(oid), onerror: e => e.target.remove() }));
      if (it.kind === 'set' && it.set.finishes.length) finishPic(box, it.set.finishes[0], has ? 'left:50%;width:50%' : 'left:24%;width:76%');
    }
    return box;
  }
  function card(it) {
    const q = it.q, on = isOn(it), key = st.tab === 'weekly' ? it.key : it.id, selectedNow = st.sel[st.tab] === key, r = it.rarity ? rarityOf(it.rarity).color : null, feat = st.tab === 'weekly' && key === week.featured;
    const stateEl = on ? el('span', { class: 'fzs-state on', text: T('store.equipped') }) : q.owned && !q.test ? el('span', { class: 'fzs-state own', text: T('store.owned') }) : !q.levelOk ? el('span', { class: 'fzs-state lock', text: T('store.lvlShort', { n: q.level }) }) : q.level > 1 ? el('span', { class: 'fzs-state', text: T('store.lvlShort', { n: q.level }) }) : null;
    const pic = picture(it); if (st.tab === 'weekly' && fresh.has(key)) pic.append(el('span', { class: 'fzs-new', text: T('store.new') }));
    return el('button', { type: 'button', class: `fzs-card${feat ? ' feat' : ''}`, style: r ? `--r:${r}` : null, 'aria-pressed': selectedNow ? 'true' : 'false', 'data-fid': `shop:item:${it.kind}:${it.id}`, onclick: () => pick(key) },
      feat ? el('span', { class: 'fzs-flag', text: T('store.featured') }) : null, q.test && q.cost > 0 && !q.notSold ? el('span', { class: 'fzs-mark', text: T('store.testMark') }) : null, pic,
      el('span', { class: 'fzs-info' }, el('span', { class: 'fzs-name', text: it.name }), el('span', { class: 'fzs-sub', text: it.sub }),
        el('span', { class: 'fzs-row' }, el('span', { class: `fzs-price${q.notSold ? ' fzs-pass' : !q.owned && q.missing > 0 ? ' is-short' : ''}`, text: q.notSold ? priceText(q) : q.owned && !q.test ? '' : priceText(q) }), stateEl)));
  }
  function drawTabs() {
    tabsEl.replaceChildren(...TABS.map(([id, key]) => el('button', { type: 'button', class: 'fzs-tab', role: 'tab', 'aria-selected': st.tab === id ? 'true' : 'false', 'data-fid': `shop:tab:${id}`, onclick: () => { if (st.tab !== id) { st.tab = id; st.filter = 'all'; st.status = 'all'; sfx('ui'); draw(); syncPreview(); } } }, T(key))));
    tabsEl.onkeydown = e => { const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!step) return; e.preventDefault(); const i = TABS.findIndex(t => t[0] === st.tab), nx = TABS[(i + step + TABS.length) % TABS.length][0]; st.tab = nx; st.filter = 'all'; st.status = 'all'; draw(); syncPreview(); tabsEl.querySelector(`[data-fid="shop:tab:${nx}"]`)?.focus(); };
  }
  function drawBalance() {
    balEl.replaceChildren(el('span', { class: 'fzs-lvl', text: T('store.level', { n: profile.level }) }), el('span', { class: 'fzs-cr', 'data-fid': 'shop:credits' }, el('small', { text: T('store.balance') }), el('b', { text: `${num(profile.data.cr)} ₡` })));
  }
  function drawList() {
    const top = listEl.scrollTop, chips = [['all', T('store.all')], ...filters().map(f => [f[0], f[1]])];
    const chip = (group, id, label) => el('button', { type: 'button', class: 'fzs-chip', 'aria-pressed': st[group] === id ? 'true' : 'false', 'data-fid': `shop:${group}:${id}`, onclick: () => { st[group] = id; sfx('ui'); drawList(); } }, label);
    const items = visible();
    listEl.replaceChildren(
      ...(st.tab === 'weekly' ? [el('div', { class: 'fzs-week', 'data-fid': 'shop:week' }, el('div', null, el('h3', { text: T('store.weekTitle') }), el('p', { text: T('store.weekNote') })), el('span', { class: 'fzs-cd', 'data-fid': 'shop:countdown', text: countdown() }))] : []),       // replaceChildren would print a null
      el('div', { class: 'fzs-filters' }, chips.map(c => chip('filter', c[0], c[1])), el('span', { class: 'fzs-sep' }), chip('status', 'all', T('store.statusAll')), chip('status', 'buy', T('store.statusBuy')), chip('status', 'owned', T('store.statusOwned'))),
      items.length ? el('div', { class: 'fzs-grid' }, items.map(card)) : el('p', { class: 'fzs-empty', text: T('store.noResult') }));
    listEl.scrollTop = top;
  }
  function action(it) {
    const q = it.q, out = [];
    const owned = q.owned;
    const eq = (label, fn, fid = 'shop:equip') => el('button', { type: 'button', class: 'fzs-btn pri', 'data-fid': fid, onclick: () => { if (fn()) { sfx('ui'); changed(); } } }, label);
    if (owned) {
      if (it.kind === 'weapon') out.push(isOn(it) ? el('button', { type: 'button', class: 'fzs-btn done', disabled: true, 'data-fid': 'shop:equip' }, T('store.equipped')) : eq(T('store.equip'), () => profile.equip('weapon', it.id)));
      else if (it.kind === 'gear') out.push(isOn(it) ? el('button', { type: 'button', class: 'fzs-btn done', disabled: true, 'data-fid': 'shop:equip' }, T('store.equipped')) : eq(T('store.equip'), () => profile.gxEquip(it.id)));
      else if (it.kind === 'finish') {
        out.push(isOn(it) ? el('button', { type: 'button', class: 'fzs-btn done', disabled: true, 'data-fid': 'shop:equip' }, T('store.equipped')) : eq(T('store.applyOn'), () => profile.equipFin(st.target, it.id)));
        if (profile.data.cos.w[st.target]) out.push(el('button', { type: 'button', class: 'fzs-btn', 'data-fid': 'shop:remove', onclick: () => { if (profile.equipFin(st.target, null)) { sfx('ui'); changed(); } } }, T('store.remove')));
      } else if (it.kind === 'outfit') out.push(isOn(it) ? el('button', { type: 'button', class: 'fzs-btn done', disabled: true, 'data-fid': 'shop:equip' }, T('store.equipped')) : eq(T('store.wear'), () => profile.wearOutfit(it.id)));
      else out.push(isOn(it) ? el('button', { type: 'button', class: 'fzs-btn done', disabled: true, 'data-fid': 'shop:equip' }, T('store.equipped')) : eq(T('store.equipSet'), () => { const ok = profile.wearOutfit(it.set.outfit); profile.equipFin(profile.data.primary, it.set.finishes[0]); const sec = it.set.finishes[1] || it.set.finishes[0]; profile.equipFin(profile.data.secondary, sec); return ok; }));
    } else if (q.notSold) out.push(el('p', { class: 'fzs-desc fzs-pass', 'data-fid': 'shop:passonly', text: T('store.passOnly') }));
    else if (!q.levelOk) out.push(el('button', { type: 'button', class: 'fzs-btn', disabled: true, 'data-fid': 'shop:buy' }, T('store.levelReq', { n: q.level })));
    else if (q.missing > 0) out.push(el('button', { type: 'button', class: 'fzs-btn', disabled: true, 'data-fid': 'shop:buy' }, T('store.buy')));
    else out.push(el('button', { type: 'button', class: 'fzs-btn pri', 'data-fid': 'shop:buy', onclick: () => askBuy(it) }, T('store.buy')));
    return out;
  }
  function drawDetail() {
    const it = selected();
    if (!it) { detailEl.replaceChildren(view); return; }
    const q = it.q, r = it.rarity ? rarityOf(it.rarity) : null, kids = [view];
    kids.push(el('div', { class: 'fzs-dhead' },
      el('div', null, r ? el('span', { class: 'fzs-rar', style: `--r:${r.color}`, text: pickLang(r.n, lang()) }) : el('span', { class: 'fzs-sub', text: it.sub }), el('h3', { text: it.name })),
      el('div', { class: 'fzs-dprice', 'data-fid': 'shop:price' }, q.set && q.set.saved > 0 ? el('s', { text: `${num(q.set.left)} ₡` }) : null, q.notSold ? el('span', { class: 'fzs-pass', text: priceText(q) }) : q.owned && !q.test ? el('small', { text: T('store.owned') }) : priceText(q), q.test && q.cost > 0 && !q.notSold ? el('small', { text: T('store.testPrice') }) : null)));
    if (it.kind === 'weapon') kids.push(el('p', { class: 'fzs-desc', text: `${it.sub} · ${T('store.lvlShort', { n: q.level })}` }));
    if (it.kind === 'gear') kids.push(el('p', { class: 'fzs-desc', text: `${it.sub} · ${T('store.lvlShort', { n: q.level })} · ${GX.t('carry', lang())} ${it.g.carry}` }));
    if (it.kind === 'finish') {
      kids.push(el('label', { class: 'fzs-target' }, T('store.onWeapon'), el('select', { 'data-fid': 'shop:target', onchange: e => { st.target = e.target.value; drawDetail(); drawList(); syncPreview(); } },
        WEAPONS.filter(w => w.slot < 2).map(w => el('option', { value: w.id, selected: w.id === st.target, text: w.name })))));
    }
    if (it.kind === 'set') {
      const part = (name, owned, cost) => el('li', null, el('span', { text: name }), el('span', { class: owned ? 'own' : '', text: owned ? T('store.owned') : `${num(cost)} ₡` }));
      kids.push(el('ul', { class: 'fzs-parts' }, part(outLabel(it.o), profile.ownsOutfit(it.set.outfit) && !q.test, creditsOf(outfitPrice(it.o))), it.set.finishes.map(f => part(finishName(finishById(f), lang()), profile.ownsFin(f) && !q.test, creditsOf(finishById(f).price)))));
      if (q.set.saved > 0) kids.push(el('p', { class: 'fzs-desc', text: T('store.setSaving', { n: num(q.set.saved) }) }));
    }
    if (q.notSold) { /* a pass item: no price, nothing missing */ }
    else if (!q.owned && !q.levelOk) kids.push(el('p', { class: 'fzs-why', 'data-fid': 'shop:why', text: T('store.levelReq', { n: q.level }) }));
    else if (!q.owned && q.missing > 0) kids.push(el('p', { class: 'fzs-why', 'data-fid': 'shop:why', text: T('store.missing', { n: num(q.missing) }) }));
    kids.push(el('div', { class: 'fzs-acts' }, action(it)));
    detailEl.replaceChildren(...kids);
  }
  function draw() { drawTabs(); drawBalance(); drawList(); drawDetail(); }
  function changed() { draw(); syncPreview(true); if (onChange) { try { onChange(); } catch (e) { console.warn('[shop] change', e); } } }
  function pick(id) { if (st.sel[st.tab] === id) return; st.sel[st.tab] = id; sfx('ui'); drawList(); drawDetail(); syncPreview(); const b = listEl.querySelector(`[data-fid$=":${CSS_ESC(id)}"]`); if (b) b.focus({ preventScroll: true }); }
  const CSS_ESC = s => String(s).replace(/["\\]/g, '');
  function toast(text, bad) { root.querySelector('.fzs-toast')?.remove(); clearTimeout(toastT); const n = el('div', { class: `fzs-toast${bad ? ' bad' : ''}`, role: 'status', 'data-fid': 'shop:toast', text }); root.append(n); toastT = setTimeout(() => n.remove(), 3200); }

  /* ---------- purchase ---------- */
  function closeDlg() { if (!dlg) return; const d = dlg; dlg = null; d.node.remove(); root.querySelector('[data-fid="shop:buy"]')?.focus({ preventScroll: true }); }
  function askBuy(it) {
    if (dlg) return;
    const token = profile.newToken(), q = profile.quote(it.kind, it.id, it.set); let paying = false;
    if (!q.can) { draw(); return; }
    const yes = el('button', { type: 'button', class: 'fzs-btn pri', 'data-fid': 'shop:confirm', onclick: async () => {
      if (paying) return; paying = true; yes.disabled = true;
      let r; try { r = await profile.purchase({ kind: it.kind, id: it.id, set: it.set, token }); } catch (e) { console.warn('[shop] purchase', e); r = { ok: false, reason: 'error' }; }
      if (closed) return; closeDlg();
      if (r.ok) { sfx('buy'); toast(T('store.bought', { item: it.name })); }
      else if (r.reason === 'credits') toast(T('store.missing', { n: num(r.missing) }), true);
      else if (r.reason === 'level') toast(T('store.levelReq', { n: r.level }), true);
      else if (r.reason === 'owned') toast(T('store.owned'));
      else if (r.reason !== 'busy') toast(T('store.failed'), true);
      changed();
    } }, T('store.confirm'));
    const no = el('button', { type: 'button', class: 'fzs-btn', 'data-fid': 'shop:cancel', onclick: closeDlg }, T('store.cancel'));
    const node = el('div', { class: 'fzs-dlg', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': T('store.confirmTitle'), 'data-fid': 'shop:dialog', onclick: e => { if (e.target === node) closeDlg(); } },
      el('div', { class: 'fzs-dbox' }, el('h3', { text: T('store.confirmTitle') }), el('p', { class: 'fzs-desc', text: it.name }),
        el('div', { class: 'fzs-sum' }, el('span', { text: T('store.balance') }), el('b', { text: `${num(profile.data.cr)} ₡` }), el('span', { text: T('store.cost') }), el('b', { class: 'tot', text: `− ${num(q.cost)} ₡` }), el('span', { text: T('store.after') }), el('b', { text: `${num(profile.data.cr - q.cost)} ₡` })),
        el('div', { class: 'fzs-acts' }, yes, no)));
    dlg = { node }; root.append(node); yes.focus({ preventScroll: true });
  }

  /* ---------- open and close ---------- */
  const close = () => { if (closed) return; closed = true; live = null; clearInterval(cdTimer); clearTimeout(previewTimer); clearTimeout(toastT); load++; dropPreview(); if (offLoad) offLoad(); if (offProfile) offProfile(); if (glCanvas) { glCanvas.removeEventListener('webglcontextlost', onLost); glCanvas.removeEventListener('webglcontextrestored', onBack); } document.removeEventListener('keydown', onKey, true); root.remove(); if (onClose) onClose(); };
  const onKey = e => { if (e.key !== 'Escape') return; e.stopPropagation(); e.preventDefault(); if (dlg) closeDlg(); else close(); };
  document.addEventListener('keydown', onKey, true);
  if (engine && engine.on) { try { offLoad = engine.on('loading', ev => { if (ev && ev.active) close(); }); } catch { /* optional */ } }
  const offProfile = profile.on(() => { if (!closed && !dlg) { drawBalance(); } });
  root.append(el('div', { class: 'fzs-top' }, el('h2', { text: T('store.title') }), tabsEl, balEl, el('button', { type: 'button', class: 'fzs-back', 'data-fid': 'shop:close', onclick: close }, T('store.back')))); if (TEST_UNLOCK_ALL) root.append(el('p', { class: 'fzs-test', style: 'margin:0', 'data-fid': 'shop:testnote' }, el('b', { text: T('store.testMark') }), ' · ', T('store.testNote')));
  root.append(el('div', { class: 'fzs-body' }, listEl, detailEl));
  /* countdown to Monday 00:00 (local), refreshed twice a minute; a new week while the shop is open redraws it */
  function countdown() { const ms = Math.max(0, week.end - Date.now()), m = Math.floor(ms / 6e4); return T('store.renew', { d: Math.floor(m / 1440), h: Math.floor(m / 60) % 24, m: m % 60 }); }
  const cdTimer = setInterval(() => {
    if (closed) return;
    if (Date.now() >= week.end) { refreshWeek(); if (st.tab === 'weekly') { st.sel.weekly = week.featured; drawList(); drawDetail(); syncPreview(); } return; }
    const n = listEl.querySelector('[data-fid="shop:countdown"]'), t = countdown(); if (n && n.textContent !== t) n.textContent = t;
  }, 30000);
  const KIND = { finishes: 'finish', outfits: 'outfit', sets: 'set', gear: 'gear', weapons: 'weapon' };
  /** Opens a tab on one item (the season pass uses it to show its rewards in the 3D preview). Returns false for an unknown tab or item. */
  function focusOn(fo) {
    if (closed || !fo || !KIND[fo.tab] || !itemOf(fo.tab, fo.id)) return false;
    st.tab = fo.tab; st.filter = 'all'; st.status = 'all'; st.sel[fo.tab] = fo.id; draw(); syncPreview(true);
    listEl.querySelector('[data-fid="shop:item:' + KIND[fo.tab] + ':' + CSS_ESC(fo.id) + '"]')?.scrollIntoView({ block: 'nearest' });
    return true;
  }
  if (deps.focus && KIND[deps.focus.tab] && itemOf(deps.focus.tab, deps.focus.id)) { st.tab = deps.focus.tab; st.sel[deps.focus.tab] = deps.focus.id; }
  document.body.append(root); draw();
  root.querySelector('[data-fid="shop:close"]')?.focus({ preventScroll: true });
  syncPreview(true);
  live = { close, focus: focusOn, get state() { return st; }, get week() { return week; }, get poolKeys() { return pool.map(x => x.key).sort(); }, redraw: draw, get previewKey() { return curKey; }, get previewStats() { return cur && cur.obj.stats ? cur.obj.stats : null; }, gearIds: () => GEAR_MODEL_IDS.slice() };
  return live;
}
