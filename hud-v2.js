// FRONT ZÉRO — in-match HUD v2: a second pass over hud-theme.js (loaded by it unless ?hud=v1; ?hud=classic skips both).
// One panel language for every block: angular cut corner, 1 px hairline, dark inner gradient, short amber accent tick, same paddings.
// Like hud-theme.js and hud-motion.js it only wraps the HUD's own methods (original first, then this under try) and adds classes
// under html.fz2, so a failure here leaves the v1 HUD. Cost rules: nothing per frame; the wrappers run at the HUD's own 20 Hz and
// touch the DOM only when a value changes (cached), with no string built on the unchanged path; animations are CSS
// (transform/opacity) restarted by swapping two identical keyframe names; the only layout read is the weapon panel height after a resize.

const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
/* New labels, in the six languages (fr, en, es, de, pt, it). */
const TX = {
  auto: ['AUTO', 'AUTO', 'AUTO', 'AUTO', 'AUTO', 'AUTO'],
  semi: ['SEMI', 'SEMI', 'SEMI', 'EINZEL', 'SEMI', 'SEMI'],
  burst: ['RAFALE', 'BURST', 'RÁFAGA', 'SALVE', 'RAJADA', 'RAFFICA'],
  melee: ['MÊLÉE', 'MELEE', 'CUERPO A CUERPO', 'NAHKAMPF', 'CORPO A CORPO', 'CORPO A CORPO'],
  reload: ['RECHARGER', 'RELOAD', 'RECARGAR', 'NACHLADEN', 'RECARREGAR', 'RICARICA'],
  empty: ['VIDE', 'EMPTY', 'VACÍO', 'LEER', 'VAZIO', 'VUOTO'],
  m2: ['DOUBLÉ', 'DOUBLE', 'DOBLE', 'DOPPEL', 'DUPLO', 'DOPPIETTA'],
  m3: ['TRIPLÉ', 'TRIPLE', 'TRIPLE', 'DREIFACH', 'TRIPLO', 'TRIPLETTA'],
  m4: ['RAFLE', 'SWEEP', 'BARRIDO', 'AUFRÄUMER', 'VARRIDO', 'RETATA'],
};

const CSS = `
html.fz2 #hud{--g-bg:linear-gradient(180deg,rgba(20,23,21,.84),rgba(9,11,10,.72));--g-bg2:linear-gradient(180deg,rgba(20,23,21,.74),rgba(9,11,10,.6));
 --g-hair:rgba(236,226,198,.19);--g-hair2:rgba(236,226,198,.44);--g-hi:inset 0 1px 0 rgba(255,255,255,.055);--g-cut:clamp(7px,.85vh,10px);
 --g-px:clamp(10px,1.2vh,15px);--g-py:clamp(6px,.72vh,9px);--g-tick:clamp(14px,1.7vh,22px);
 --f-mi:clamp(10px,1.12vh,12.5px);--f-sm:clamp(12px,1.36vh,15px);--f-bd:clamp(14px,1.62vh,18px);
 --fz-map:clamp(136px,18.6vh,214px);--fzd-h:15px;--fzd-f:13px;
 --fz2-wing:clamp(118px,8.7vw,174px);--fz2-gap:clamp(4px,.36vw,7px);--fz2-tab:clamp(24px,2.75vh,31px);--fz2-pill:clamp(20px,2.3vh,26px);
 --fz2-r2:calc(var(--fz2-tab) + 4px);--fz2-r3:0px;--fz-obj-top:calc(var(--fzc-top) + var(--fzc-h) + var(--fz2-r2) + var(--fz2-r3) + 8px);
 --fz2-wph:clamp(84px,10.4vh,118px);--c-ally:#8fc4f2;--c-enemy:#ff7a62;--c-me:#f6b73c;--c-txt:#ece6d6}
html.fz2.fz2-pills #hud{--fz2-r3:calc(var(--fz2-pill) + 16px)}
html.fz2.fz2-notab #hud,html.fz2.fzt-nocompass #hud{--fz2-r2:0px}
html.fz2.fzt-nocompass.fz2-pills #hud{--fz2-r3:calc(var(--fz2-pill) + 18px)}
/* ---------- the shared panel ---------- */
html.fz2 #hud :is([data-h="vit"],[data-h="sL"],[data-h="sR"],[data-h="mid"],[data-h="prompt"],[data-h="loot"],[data-h="spec"],[data-h="prog"],[data-h="lock"],[data-h="zone"],.fz2-p){
 background:var(--g-bg);border:1px solid var(--g-hair);box-shadow:var(--g-hi)}
html.fz2 #hud :is([data-h="vit"],[data-h="prompt"],[data-h="loot"],[data-h="spec"],[data-h="prog"],[data-h="lock"],[data-h="zone"]){
 background:linear-gradient(to top left,transparent calc(50% - .75px),var(--g-hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 100% 100%/var(--g-cut) var(--g-cut) no-repeat border-box,var(--g-bg);
 clip-path:polygon(0 0,100% 0,100% calc(100% - var(--g-cut)),calc(100% - var(--g-cut)) 100%,0 100%)}
/* the weapon panel keeps children outside its box (light chip, classic grenade line): its shape is drawn by a pseudo-element */
html.fz2 #hud [data-h="wp"]{background:none;border:1px solid transparent;box-shadow:none;isolation:isolate}
html.fz2 #hud [data-h="wp"]::after{content:"";position:absolute;inset:-1px;z-index:-1;border:1px solid var(--g-hair);box-shadow:var(--g-hi);pointer-events:none;
 background:linear-gradient(to top right,transparent calc(50% - .75px),var(--g-hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 0 100%/var(--g-cut) var(--g-cut) no-repeat border-box,var(--g-bg);
 clip-path:polygon(0 0,100% 0,100% 100%,var(--g-cut) 100%,0 calc(100% - var(--g-cut)))}
html.fz2 #hud kbd.fz2-k{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:1.55em;height:1.55em;padding:0 .32em;margin:0;font:800 .82em/1 'Barlow Condensed','Arial Narrow',Arial,sans-serif;letter-spacing:.02em;color:#121410;background:linear-gradient(180deg,#f6f1e3,#d9d1ba);border-radius:3px;box-shadow:0 2px 0 rgba(0,0,0,.6),inset 0 -2px 0 rgba(0,0,0,.16);text-shadow:none;text-transform:uppercase}
/* ---------- top centre: compass with the two team wings, the timer tab and the objective pills ---------- */
html.fz2 #hud .fzc-w{background:linear-gradient(180deg,rgba(20,23,21,.8),rgba(9,11,10,.6));box-shadow:inset 0 0 0 1px var(--g-hair);-webkit-mask-image:linear-gradient(90deg,transparent 0 3.2%,#000 11%,#000 89%,transparent 96.8%);mask-image:linear-gradient(90deg,transparent 0 3.2%,#000 11%,#000 89%,transparent 96.8%)}
html.fz2 #hud .fzc-n{display:none}
html.fz2 #hud .fzc:before{height:calc(var(--fzc-h) - var(--fzd-h) - 2px);width:2px;z-index:3}
html.fz2 #hud .fzc-h{top:0;margin-top:0;z-index:3;width:calc(var(--fzd-h)*2.7);background:rgba(6,8,7,.94);box-shadow:inset 0 0 0 1px var(--g-hair2),inset 0 -2px 0 var(--fz-acc)}
html.fz2 #hud .fzc-m{z-index:4}
html.fz2 #hud .fzc-m em{top:74%}
html.fz2 #hud .fzc-m em b{left:-7px;top:-7px;width:14px;height:14px}
html.fz2 #hud .fzc-m em s{left:-9px;top:-7px;width:18px;font-size:10px;line-height:14px}
html.fz2 #hud [data-h="top"]{left:50%;top:var(--fzc-top);transform:translateX(-50%);width:calc(var(--fzc-w) + 2*var(--fz2-wing) + 2*var(--fz2-gap));display:grid;grid-template-columns:var(--fz2-wing) minmax(0,1fr) var(--fz2-wing);grid-template-rows:var(--fzc-h) auto auto;gap:0 var(--fz2-gap);align-items:stretch;padding:0;background:none;box-shadow:none;font-size:var(--f-bd);white-space:nowrap}
html.fz2.fzt-nocompass #hud [data-h="top"]{width:auto;grid-template-columns:var(--fz2-wing) auto var(--fz2-wing)}
html.fz2 #hud :is([data-h="sL"],[data-h="sR"]){grid-row:1;position:relative;display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:6px;min-width:0;padding:0 calc(var(--g-cut) + 7px) 0 11px;line-height:1}
html.fz2 #hud [data-h="sL"]{grid-column:1;border-right:0;background:linear-gradient(to bottom right,transparent calc(50% - .75px),var(--g-hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 100% 0/var(--g-cut) 100% no-repeat border-box,var(--g-bg);clip-path:polygon(0 0,100% 0,calc(100% - var(--g-cut)) 100%,0 100%)}
html.fz2 #hud [data-h="sR"]{grid-column:3;flex-direction:row-reverse;border-left:0;padding:0 11px 0 calc(var(--g-cut) + 7px);background:linear-gradient(to bottom left,transparent calc(50% - .75px),var(--g-hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 0 0/var(--g-cut) 100% no-repeat border-box,var(--g-bg);clip-path:polygon(0 0,100% 0,100% 100%,var(--g-cut) 100%)}
html.fz2 #hud :is([data-h="sL"],[data-h="sR"]):before{top:-1px;bottom:-1px;width:3px;left:-1px;background:var(--tc,var(--c-txt))}
html.fz2 #hud [data-h="sR"]:before{left:auto;right:-1px}
html.fz2 #hud :is([data-h="sL"],[data-h="sR"]):after{content:"";position:absolute;left:12px;right:calc(var(--g-cut) + 10px);bottom:-1px;height:2px;background:linear-gradient(90deg,var(--tc,var(--c-txt)),transparent);opacity:.55}
html.fz2 #hud [data-h="sR"]:after{left:calc(var(--g-cut) + 10px);right:12px;background:linear-gradient(270deg,var(--tc,var(--c-txt)),transparent)}
html.fz2 #hud :is([data-h="sL"],[data-h="sR"]) small{font-size:var(--f-mi);font-weight:700;letter-spacing:.1em;color:#cfc7b0;line-height:1.35;min-width:0}
html.fz2 #hud :is([data-h="sL"],[data-h="sR"]) b{flex:none;font-size:clamp(20px,2.6vh,30px);font-weight:800;letter-spacing:.01em;line-height:1}
html.fz2 #hud :is([data-h="sL"],[data-h="sR"]).fz2-long b{font-size:clamp(15px,1.95vh,23px);letter-spacing:0}
html.fz2 #hud :is([data-h="sL"],[data-h="sR"]).fz2-long small{letter-spacing:.06em}
html.fz2 #hud [data-h="mid"]{grid-row:2;grid-column:2;justify-self:center;display:flex;flex-direction:row-reverse;align-items:center;justify-content:center;gap:10px;height:var(--fz2-tab);margin-top:4px;padding:0 calc(var(--g-cut) + 14px);border-top:0;line-height:1;
 background:linear-gradient(to top right,transparent calc(50% - .75px),var(--g-hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 0 0/var(--g-cut) 100% no-repeat border-box,linear-gradient(to top left,transparent calc(50% - .75px),var(--g-hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 100% 0/var(--g-cut) 100% no-repeat border-box,var(--g-bg);
 border-left:0;border-right:0;clip-path:polygon(0 0,100% 0,calc(100% - var(--g-cut)) 100%,var(--g-cut) 100%)}
html.fz2.fzt-nocompass #hud [data-h="mid"]{grid-row:1;height:auto;margin-top:0}
html.fz2.fz2-notab #hud [data-h="mid"]{visibility:hidden}
html.fz2 #hud [data-h="timer"]{font-size:clamp(17px,2.25vh,25px);font-weight:800;letter-spacing:.05em;color:#fbf8f0}
html.fz2 #hud [data-h="center"]{font-size:var(--f-mi);font-weight:700;letter-spacing:.18em;color:#cfc7b0;max-width:22vw;line-height:1.35;padding-top:1px}
html.fz2 #hud .fz2-dup{display:none!important}
html.fz2 #hud .fz2-pills{grid-row:3;grid-column:2;justify-self:center;display:flex;gap:clamp(14px,1.6vh,20px);margin-top:10px;height:var(--fz2-pill)}
html.fz2.fzt-nocompass #hud .fz2-pills{grid-row:2;margin-top:10px}
html.fz2 #hud .fz2-pl{--pc:#d9d4c4;position:relative;display:flex;align-items:center;justify-content:center;width:var(--fz2-pill);height:var(--fz2-pill);font-size:calc(var(--fz2-pill)*.54);font-weight:800;line-height:1;color:#fbf8f0}
html.fz2 #hud .fz2-pl:before{content:"";position:absolute;inset:15%;transform:rotate(45deg);border:2px solid var(--pc);background:rgba(8,10,9,.84);box-shadow:0 0 0 1px rgba(0,0,0,.5)}
html.fz2 #hud .fz2-pl b{position:relative;font-weight:800}
html.fz2 #hud .fz2-pl.own:before,html.fz2 #hud .fz2-pl.foe:before{background:var(--pc)}
html.fz2 #hud .fz2-pl.own b,html.fz2 #hud .fz2-pl.foe b{text-shadow:0 1px 1px rgba(0,0,0,.6)}
html.fz2 #hud .fz2-pl.con:after{content:"";position:absolute;inset:-8%;transform:rotate(45deg);border:2px dashed var(--pc);opacity:.9}       /* contested: a static dashed outer diamond (no endless animation) */
html.fz2 #hud .fz2-pl u{position:absolute;inset:-24%;border-radius:50%;opacity:0;text-decoration:none;background:conic-gradient(var(--rc,var(--c-ally)) calc(var(--p,0) * 1turn),rgba(255,255,255,.2) 0);-webkit-mask:radial-gradient(circle closest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px));mask:radial-gradient(circle closest-side,transparent calc(100% - 3px),#000 calc(100% - 2.5px))}
html.fz2 #hud .fz2-pl.cap u{opacity:1}
html.fz2 #hud .fz2-pl.them{--rc:var(--c-enemy)}
/* ---------- objective line, zone panel, network chip ---------- */
html.fz2 #hud [data-h="obj"]{top:var(--fz-obj-top);font-size:var(--f-bd);letter-spacing:.06em;padding:2px 34px;background:linear-gradient(90deg,transparent,rgba(9,11,10,.5) 20%,rgba(9,11,10,.5) 80%,transparent)}
html.fz2 #hud [data-h="zone"]{top:calc(var(--fz-obj-top) + clamp(30px,3.4vh,36px))!important;border:1px solid var(--g-hair)!important;box-shadow:inset 3px 0 0 currentColor,var(--g-hi)!important;padding:4px 16px 4px 12px!important}
html.fz2 #hud [data-h="net"]{gap:6px!important;height:clamp(19px,2.1vh,23px);padding:0 9px 0 7px!important;font:700 var(--f-mi)/1 'Barlow Condensed','Arial Narrow',Arial,sans-serif!important;letter-spacing:.08em;background:linear-gradient(to top left,transparent calc(50% - .75px),var(--g-hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 100% 100%/6px 6px no-repeat border-box,var(--g-bg)!important;border:1px solid var(--g-hair)!important;box-shadow:none!important;clip-path:polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%);text-shadow:0 1px 1px rgba(0,0,0,.8)}
html.fz2 #hud [data-h="net"]::before{content:"";flex:none;width:10px;height:9px;background:linear-gradient(currentColor,currentColor) 0 100%/2px 40% no-repeat,linear-gradient(currentColor,currentColor) 4px 100%/2px 70% no-repeat,linear-gradient(currentColor,currentColor) 8px 100%/2px 100% no-repeat}
/* ---------- minimap ---------- */
html.fz2 #hud .fzmm{box-shadow:0 0 0 1px rgba(0,0,0,.5),0 0 0 3px rgba(9,11,10,.35),0 6px 18px rgba(0,0,0,.3)}
/* ---------- kill feed ---------- */
html.fz2 #hud [data-h="feed"]{right:var(--fz-pad);top:var(--fz-pad);gap:3px;font-size:var(--f-sm);max-width:min(34vw,calc(50vw - var(--fzc-w)/2 - var(--fz2-wing) - var(--fz2-gap) - var(--fz-pad) - 14px))}
html.fz2.fzt-nocompass #hud [data-h="feed"]{max-width:30vw}
html.fz2 #hud [data-h="feed"] div{position:relative;display:flex;align-items:center;gap:7px;height:clamp(22px,2.55vh,29px);padding:0 11px 0 calc(var(--g-cut) + 8px);color:var(--c-txt);
 background:linear-gradient(to bottom right,transparent calc(50% - .75px),var(--g-hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 0 0/var(--g-cut) var(--g-cut) no-repeat border-box,linear-gradient(90deg,rgba(9,11,10,.52),rgba(14,17,15,.8) 40%);
 border:1px solid var(--g-hair);border-right:0;box-shadow:inset -2px 0 0 rgba(236,226,198,.42);clip-path:polygon(var(--g-cut) 0,100% 0,100% 100%,0 100%,0 var(--g-cut))}
html.fz2 #hud [data-h="feed"] div:first-child{box-shadow:inset -2px 0 0 rgba(236,226,198,.42)}
html.fz2 #hud [data-h="feed"] div.me{background:linear-gradient(to bottom right,transparent calc(50% - .75px),rgba(246,183,60,.7) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 0 0/var(--g-cut) var(--g-cut) no-repeat border-box,linear-gradient(90deg,rgba(64,46,12,.5),rgba(70,50,14,.82) 40%);border-color:rgba(246,183,60,.5);box-shadow:inset -3px 0 0 var(--c-me)}
html.fz2 #hud [data-h="feed"] :is(b,span){font-weight:700;white-space:nowrap;max-width:13vw;line-height:1.35}
html.fz2 #hud [data-h="feed"] .ta{color:var(--c-ally)}html.fz2 #hud [data-h="feed"] .te{color:var(--c-enemy)}html.fz2 #hud [data-h="feed"] .tm{color:var(--c-me)}html.fz2 #hud [data-h="feed"] .tn{color:var(--c-txt)}
html.fz2 #hud .fz2-wi{display:inline-block;flex:none;width:2.9em;height:1.05em;background:currentColor;-webkit-mask:var(--wi) center/contain no-repeat;mask:var(--wi) center/contain no-repeat;color:#f1ecdd;opacity:.95}
html.fz2 #hud [data-h="feed"] .fzk{color:#f1ecdd}
html.fz2 #hud [data-h="feed"] .fzk.h{color:var(--c-me);width:.95em;height:.95em}
html.fz2 #hud [data-h="feed"] .fzk.x{color:var(--c-enemy)}
/* ---------- credits and medals: total chip and a short stack ---------- */
html.fz2 #hud [data-h="earn"]{right:var(--fz-pad);top:35vh;display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:var(--f-bd)}
html.fz2 #hud [data-h="earn"]>b{display:inline-flex;align-items:center;height:clamp(24px,2.7vh,30px);padding:0 12px 0 14px;font-size:clamp(16px,2vh,22px);font-weight:800;letter-spacing:.04em;color:var(--c-me);background:var(--g-bg);border:1px solid var(--g-hair);box-shadow:inset 3px 0 0 var(--c-me),var(--g-hi);font-variant-numeric:tabular-nums}
html.fz2 #hud [data-h="earn"]>small{display:none}
html.fz2 #hud .fz2-rws{display:flex;flex-direction:column;align-items:flex-end;gap:3px}
html.fz2 #hud .fz2-rw{display:none;align-items:center;gap:8px;height:clamp(21px,2.4vh,27px);padding:0 10px 0 8px;font-size:var(--f-sm);font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--c-txt);background:var(--g-bg2);border:1px solid var(--g-hair);white-space:nowrap}
html.fz2 #hud .fz2-rw.on{display:flex}
html.fz2 #hud .fz2-rw i{display:block;flex:none;width:1.05em;height:1.05em;color:var(--c-me)}
html.fz2 #hud .fz2-rw i svg{display:block;width:100%;height:100%}
html.fz2 #hud .fz2-rw b{font-weight:800;color:var(--c-me);font-variant-numeric:tabular-nums;letter-spacing:.03em}
html.fz2 #hud .fz2-rw.md{color:#17140a;background:linear-gradient(90deg,#f8c552,#e39d22);border-color:#ffd77e;text-shadow:none}
html.fz2 #hud .fz2-rw.md i,html.fz2 #hud .fz2-rw.md b{color:#17140a}
html.fz2 #hud .fz2-rw.p0{animation:fz2-rw0 2.7s cubic-bezier(.2,.8,.3,1) both}
html.fz2 #hud .fz2-rw.p1{animation:fz2-rw1 2.7s cubic-bezier(.2,.8,.3,1) both}
@keyframes fz2-rw0{0%{opacity:0;transform:translateX(22px) scale(1.06)}7%{opacity:1;transform:none}82%{opacity:1;transform:none}100%{opacity:0;transform:translateX(8px)}}
@keyframes fz2-rw1{0%{opacity:0;transform:translateX(22px) scale(1.06)}7%{opacity:1;transform:none}82%{opacity:1;transform:none}100%{opacity:0;transform:translateX(8px)}}
html.fz2.fzt-rm #hud .fz2-rw.p0{animation-name:fz2-rwf0}html.fz2.fzt-rm #hud .fz2-rw.p1{animation-name:fz2-rwf1}
@keyframes fz2-rwf0{0%{opacity:0}5%{opacity:1}85%{opacity:1}100%{opacity:0}}
@keyframes fz2-rwf1{0%{opacity:0}5%{opacity:1}85%{opacity:1}100%{opacity:0}}
/* ---------- vitals: health, armour plates, trail ---------- */
html.fz2 #hud [data-h="vit"]{left:var(--fz-pad);bottom:var(--fz-pad);width:clamp(244px,30.5vh,344px);display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto auto;column-gap:12px;align-items:end;padding:calc(var(--g-py) + 3px) var(--g-px) calc(var(--g-py) + 4px)}
html.fz2 #hud [data-h="vit"]:before{left:-1px;top:-1px;bottom:auto;width:var(--g-tick);height:2px;background:var(--fz-acc)}
html.fz2 #hud [data-h="vit"].fzt-low{border-color:rgba(255,90,60,.55);background:linear-gradient(to top left,transparent calc(50% - .75px),rgba(255,90,60,.7) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 100% 100%/var(--g-cut) var(--g-cut) no-repeat border-box,linear-gradient(180deg,rgba(58,16,10,.78),rgba(22,8,6,.74))}
html.fz2 #hud [data-h="vit"].fzt-low:before{background:var(--fz-low);width:100%}
html.fz2 #hud [data-h="vit"] .n{grid-area:1/1;font-size:clamp(34px,4.9vh,54px);font-weight:800;line-height:.86;padding-left:.5em;letter-spacing:.005em}
html.fz2 #hud [data-h="vit"] .n:before{width:.32em;height:.32em;margin-top:-.19em;opacity:.9;color:var(--fz-acc)}
html.fz2 #hud [data-h="vit"].fzt-low .n:before{color:var(--fz-low)}
html.fz2 #hud [data-h="vit"]>small{grid-area:1/2;align-self:start;justify-self:end;margin:1px 0 0;font-size:var(--f-mi);font-weight:700;letter-spacing:.18em;line-height:1.35}
html.fz2 #hud .fz2-av{grid-area:2/2;justify-self:end;display:flex;align-items:center;gap:5px;margin-top:7px;font-size:var(--f-sm);font-weight:800;line-height:1;color:var(--fz-arm);font-variant-numeric:tabular-nums}
html.fz2 #hud .fz2-av svg{display:block;width:.95em;height:1.05em}
html.fz2 #hud .fz2-av.z{color:rgba(196,188,165,.55)}
html.fz2 #hud [data-h="vit"] .meter{grid-column:1;margin-top:7px;background:rgba(255,255,255,.12)}
html.fz2 #hud [data-h="vit"] [data-h="arm"]{grid-row:2;height:clamp(6px,.7vh,8px);transform:skewX(-24deg);margin-left:3px;-webkit-mask:repeating-linear-gradient(90deg,#000 0 calc(25% - 4px),transparent calc(25% - 4px) 25%) 0 0/calc(100% + 4px) 100%;mask:repeating-linear-gradient(90deg,#000 0 calc(25% - 4px),transparent calc(25% - 4px) 25%) 0 0/calc(100% + 4px) 100%}
html.fz2 #hud [data-h="vit"] [data-h="arm"]:after{content:none}
html.fz2 #hud [data-h="vit"] [data-h="hp"]{grid-row:3;grid-column:1/-1;height:clamp(8px,1vh,11px);margin-top:6px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
html.fz2 #hud [data-h="vit"] [data-h="hp"]:after{background:repeating-linear-gradient(90deg,transparent 0 calc(25% - 2px),rgba(8,10,9,.8) calc(25% - 2px) 25%)}
html.fz2 #hud [data-h="hp"] u{background:linear-gradient(180deg,#ffffff,#dfe3dc)!important}
html.fz2 #hud [data-h="vit"].fzt-low [data-h="hp"] u{background:var(--fz-low)!important}
html.fz2 #hud [data-h="arm"] u{background:linear-gradient(180deg,#a9d3f6,#6fa9dd)}
html.fz2 #hud [data-h="hp"] s{background:rgba(255,255,255,.82)}
html.fz2 #hud [data-h="arm"] s{background:#e1f0ff}
/* ---------- weapon: silhouette, ammunition, fire mode, magazine, reload ---------- */
html.fz2 #hud [data-h="wp"]{right:var(--fz-pad);bottom:var(--fz-pad);display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto auto;column-gap:clamp(12px,1.5vh,20px);align-items:end;min-width:clamp(250px,31vh,352px);padding:calc(var(--g-py) + 3px) var(--g-px) calc(var(--g-py) + 4px)}
html.fz2 #hud [data-h="wp"]:before{right:-1px;left:auto;top:-1px;bottom:auto;width:var(--g-tick);height:2px;background:var(--fz-acc);z-index:1}
html.fz2 #hud [data-h="wp"]>.fz2-wi{grid-area:1/1/3/2;align-self:center;width:clamp(100px,12.4vh,142px);height:clamp(30px,3.7vh,42px);margin:0 4px 0 2px;color:#f1ecdd;opacity:.94}
html.fz2 #hud [data-h="wname"]{grid-area:1/2;justify-self:end;margin:0 0 3px;font-size:clamp(12px,1.45vh,16px);font-weight:700;letter-spacing:.16em;color:#cfc7b0;max-width:min(240px,24vw);line-height:1.35}
html.fz2 #hud [data-h="wp"].fz2-rl [data-h="wname"]{color:var(--fz-acc)}
html.fz2 #hud [data-h="wp"] .a{grid-area:2/2;justify-self:end;font-size:clamp(38px,5.4vh,60px);font-weight:800;line-height:.86;letter-spacing:0}
html.fz2 #hud [data-h="wp"] .a span{font-size:.42em;font-weight:700;color:#cfc7b0;letter-spacing:.04em}
html.fz2 #hud [data-h="am"]{min-width:1.1em;text-align:right}
html.fz2 #hud .fz2-fm{grid-area:3/1;justify-self:start;align-self:center;display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:2px 7px;font-size:var(--f-mi);font-weight:800;font-style:normal;letter-spacing:.16em;line-height:1.2;color:#cfc7b0;border:1px solid var(--g-hair2);white-space:nowrap}
html.fz2 #hud .fz2-fm i{display:inline-block;width:3px;height:.8em;background:currentColor;box-shadow:5px 0 0 currentColor,10px 0 0 currentColor}
html.fz2 #hud .fz2-fm.s1 i{box-shadow:none}html.fz2 #hud .fz2-fm.s1{gap:5px}
html.fz2 #hud .fz2-fm.s3 i{box-shadow:5px 0 0 currentColor,10px 0 0 currentColor;margin-right:10px}
html.fz2 #hud .fz2-fm.sa i{box-shadow:5px 0 0 currentColor,10px 0 0 currentColor,15px 0 0 currentColor;margin-right:15px}
html.fz2 #hud .fz2-fm.s1 i,html.fz2 #hud .fz2-fm.s0 i{margin-right:0}
html.fz2 #hud .fz2-fm.s0 i{display:none}
html.fz2 #hud .fz2-fm.lo{color:#fff;background:rgba(255,90,60,.86);border-color:#ff8a6e;padding:1px 6px 1px 3px}
html.fz2 #hud .fz2-fm.lo i{display:none}
html.fz2 #hud .fz2-fm kbd.fz2-k{font-size:.98em;height:1.35em;min-width:1.35em}
html.fz2:not(.fzt-rm) #hud .fz2-fm.lo{animation:fz2-lo .55s ease-in-out infinite alternate}
@keyframes fz2-lo{from{opacity:1}to{opacity:.6}}
html.fz2 #hud .fzt-mag{grid-area:3/2;position:relative;align-self:center;height:clamp(4px,.55vh,6px);margin-top:8px;background:rgba(255,255,255,.13);overflow:hidden}
html.fz2 #hud .fzt-mag:after{content:"";position:absolute;inset:0;z-index:1;background:repeating-linear-gradient(90deg,transparent 0 calc(100% / var(--mt,10) - 1px),rgba(8,10,9,.9) calc(100% / var(--mt,10) - 1px) calc(100% / var(--mt,10)))}
html.fz2 #hud .fzt-mag.nt:after{display:none}
html.fz2 #hud .fzt-mag u{background:linear-gradient(180deg,#fff,#d9dcd4)}
html.fz2 #hud .fzt-mag s{position:absolute;inset:0;z-index:2;background:var(--fz-acc);transform-origin:0 50%;transform:scaleX(0);opacity:0;text-decoration:none}
html.fz2 #hud [data-h="wp"].fz2-rl .fzt-mag s{opacity:1}
html.fz2 #hud [data-h="wp"].fz2-rl .fzt-mag s.p0{animation:fz2-rl0 var(--d,1.5s) linear both}
html.fz2 #hud [data-h="wp"].fz2-rl .fzt-mag s.p1{animation:fz2-rl1 var(--d,1.5s) linear both}
@keyframes fz2-rl0{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes fz2-rl1{from{transform:scaleX(0)}to{transform:scaleX(1)}}
html.fz2 #hud [data-h="wp"].fzt-melee .fzt-mag{visibility:hidden}
html.fz2 #hud [data-h="wp"].fzt-melee .a{visibility:hidden}
html.fz2 #hud [data-h="gear"]{position:absolute;right:-1px;bottom:calc(100% + 8px);display:flex;align-items:center;gap:7px;margin:0;padding:4px 10px 4px 5px;font-size:var(--f-sm);font-weight:700;letter-spacing:.06em;color:var(--c-txt);background:var(--g-bg);border:1px solid var(--g-hair);white-space:nowrap}
html.fz2 #hud [data-h="gear"] b{font-weight:800;color:#fbf8f0;font-variant-numeric:tabular-nums}
html.fz2 #hud [data-h="torch"]{position:absolute;right:calc(100% + 8px);bottom:8px;display:flex;align-items:center;gap:6px;margin:0;padding:3px 9px 3px 4px;font-size:var(--f-mi);font-weight:800;letter-spacing:.14em;color:#17140a;background:linear-gradient(180deg,#f8c552,#e39d22);box-shadow:none}
html.fz2 #hud [data-h="torch"] kbd.fz2-k{background:#17140a;color:#f8c552;box-shadow:none;height:1.4em}
/* gear tiles (engine-gear.js): key caps and a charge fill */
html.fz2 #gx-slots{right:var(--fz-pad);bottom:calc(var(--fz-pad) + var(--fz2-wph) + 9px);gap:5px}
html.fz2 #gx-slots .gx-s{width:clamp(54px,6.1vh,68px);height:clamp(44px,5.1vh,57px);border:1px solid var(--g-hair);border-radius:0;box-shadow:var(--g-hi);
 background:linear-gradient(to top left,transparent calc(50% - .75px),var(--g-hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 100% 100%/var(--g-cut) var(--g-cut) no-repeat border-box,var(--g-bg);clip-path:polygon(0 0,100% 0,100% calc(100% - var(--g-cut)),calc(100% - var(--g-cut)) 100%,0 100%)}
html.fz2 #gx-slots .gx-s img{inset:auto;left:18%;top:12%;width:70%;height:62%}
html.fz2 #gx-slots .gx-s i{left:3px;top:3px;min-width:15px;height:15px;padding:0 3px;font:800 10.5px/15px 'Barlow Condensed','Arial Narrow',Arial,sans-serif;text-align:center;color:#121410;background:linear-gradient(180deg,#f6f1e3,#d9d1ba);border-radius:2px;box-shadow:0 2px 0 rgba(0,0,0,.6);text-shadow:none}
html.fz2 #gx-slots .gx-s b{right:5px;bottom:7px;font:800 13px/14px 'Barlow Condensed','Arial Narrow',Arial,sans-serif;color:#fbf8f0;font-variant-numeric:tabular-nums}
html.fz2 #gx-slots .gx-s.off{opacity:.55}
html.fz2 #gx-slots .gx-s.off img{filter:grayscale(1) brightness(.75)}
html.fz2 #gx-slots .gx-s.off b{color:var(--fz-low)}
html.fz2 #gx-slots .fz2-ch{position:absolute;left:4px;right:calc(var(--g-cut) + 2px);bottom:3px;height:3px;background:rgba(255,255,255,.14);overflow:hidden}
html.fz2 #gx-slots .fz2-ch s{display:block;height:100%;background:var(--fz-acc);transform-origin:0 50%;transform:scaleX(1);text-decoration:none}
html.fz2 #gx-slots .fz2-ch:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(100% / var(--c,1) - 2px),rgba(8,10,9,.95) calc(100% / var(--c,1) - 2px) calc(100% / var(--c,1)))}
html.fz2 #gx-hot{right:var(--fz-pad);bottom:calc(var(--fz-pad) + var(--fz2-wph) + clamp(44px,5.1vh,57px) + 16px)}
html.fz2 #gx-use{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:14px;letter-spacing:.08em}
html.fz2 #gx-use div{height:5px;border-radius:0;box-shadow:0 0 0 1px rgba(0,0,0,.45)}
/* ---------- world markers: objectives with a capture ring and distance, small teammate tags ---------- */
html.fz2 #hud .mk b{left:-12px;top:-12px;width:24px;height:24px;border-width:2px;background:rgba(8,10,9,.82);box-shadow:0 0 0 1px rgba(0,0,0,.55)}
html.fz2 #hud .mk span{top:-12px;height:24px;line-height:24px;font-size:15px;font-weight:800;color:#fff}
html.fz2 #hud .mk.fzt-lg span{top:-40px;height:auto;line-height:1.1;font-size:14px;font-weight:800;letter-spacing:.1em;color:currentColor}
html.fz2 #hud .mk small{top:20px;left:0;width:max-content;transform:translateX(-50%);padding:1px 6px;font-size:12px;font-weight:700;line-height:15px;letter-spacing:.05em;color:#f4f0e6;background:rgba(8,10,9,.74);box-shadow:inset 0 0 0 1px var(--g-hair);opacity:1}
html.fz2 #hud .mk small:empty{display:none}
html.fz2 #hud .mk .fz2-rg{position:absolute;left:-23px;top:-23px;width:46px;height:46px;border-radius:50%;opacity:0;background:conic-gradient(var(--rc,#8fc4f2) calc(var(--p,0) * 1turn),rgba(255,255,255,.16) 0);-webkit-mask:radial-gradient(circle,transparent 19px,#000 19.6px,#000 22px,transparent 22.6px);mask:radial-gradient(circle,transparent 19px,#000 19.6px,#000 22px,transparent 22.6px)}
html.fz2 #hud .mk .fz2-rg.on{opacity:1}
html.fz2 #hud .mk.fz2-fade{opacity:.3}
html.fz2 #hud .mk.sm b{left:-4px;top:-3px;width:0;height:0;border:4px solid transparent;border-top:5px solid currentColor;border-bottom:0;background:none;box-shadow:none;filter:drop-shadow(0 0 1px rgba(0,0,0,.9))}
html.fz2 #hud .mk.sm span{top:-21px;font-size:12.5px;font-weight:700;letter-spacing:.04em;text-shadow:0 0 2px #000,0 1px 2px #000,0 0 1px #000}
/* ---------- messages, prompts, progress, hints ---------- */
html.fz2 #hud [data-h="msg"]{padding:5px 34px 5px calc(34px + .22em);text-transform:uppercase;letter-spacing:.22em;line-height:1.25;text-shadow:0 0 6px rgba(0,0,0,.55),0 1px 2px rgba(0,0,0,.95),0 0 1px #000;background:linear-gradient(90deg,rgba(8,10,9,0),rgba(8,10,9,.5) 22%,rgba(8,10,9,.5) 78%,rgba(8,10,9,0))}
html.fz2 #hud [data-h="msg"]:before{right:calc(100% - 26px)}html.fz2 #hud [data-h="msg"]:after{left:calc(100% - 26px)}
html.fz2 #hud :is([data-h="prompt"],[data-h="loot"]){display:flex;align-items:center;gap:10px;padding:5px 18px 5px 6px!important;border:1px solid var(--g-hair)!important;box-shadow:inset 0 -2px 0 var(--fz-acc),var(--g-hi)!important;font-size:var(--f-bd)!important;font-weight:700;letter-spacing:.04em;width:max-content}
html.fz2 #hud :is([data-h="prompt"],[data-h="loot"]).fz2-nk{padding-left:16px!important}
html.fz2 #hud [data-h="loot"]{top:calc(66% + clamp(44px,4.8vh,54px))!important}       /* below the capture bar (66 %), which it used to cover */
html.fz2 #hud [data-h="prog"]{padding:6px 12px 8px;font-size:var(--f-mi);font-weight:700;letter-spacing:.16em}
html.fz2 #hud [data-h="prog"] i{height:6px;margin-top:6px;background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}
html.fz2 #hud [data-h="prog"] u{background:linear-gradient(180deg,#ffd27a,var(--fz-acc))}
html.fz2 #hud [data-h="hint"]{padding:4px 30px;font-size:var(--f-bd);font-weight:700;letter-spacing:.08em;background:linear-gradient(90deg,transparent,rgba(9,11,10,.62) 18%,rgba(9,11,10,.62) 82%,transparent);box-shadow:inset 0 -1px 0 rgba(236,226,198,.18)}
html.fz2 #hud [data-h="spec"]{display:flex!important;flex-direction:column;align-items:center;gap:2px;padding:6px 20px 7px;box-shadow:inset 0 -2px 0 var(--fz-acc),var(--g-hi);letter-spacing:.12em}
html.fz2 #hud [data-h="spec"][style*="none"]{display:none!important}
html.fz2 #hud [data-h="spec"] b{font-size:var(--f-bd);font-weight:800;letter-spacing:.14em;color:#fbf8f0}
html.fz2 #hud [data-h="spec"] small{display:flex;align-items:center;gap:6px;font-size:var(--f-mi);font-weight:700;letter-spacing:.12em;color:#cfc7b0}
html.fz2 #hud [data-h="lock"]{box-shadow:inset 0 -2px 0 var(--fz-acc),var(--g-hi)}
/* spawn protection (engine-guard.js): same panel language, its blue kept */
html.fz2 #sg-hud .r{border-radius:0;border:1px solid rgba(150,216,255,.42);background:linear-gradient(180deg,rgba(24,52,68,.82),rgba(8,20,28,.76));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -2px 0 #6fc8ff;clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%);padding:5px 14px 6px 8px}
html.fz2 #sg-hud b{font-size:clamp(13px,1.4vh,15px);font-weight:800}
html.fz2 #sg-hud em{font-size:clamp(13px,1.4vh,15px);font-weight:800}
html.fz2 #sg-hud i{height:4px;border-radius:0;box-shadow:0 0 0 1px rgba(0,0,0,.4)}
/* ---------- scoreboard (Tab) ---------- */
html.fz2 #hud [data-h="board"]{top:54%;min-width:min(660px,92vw);padding:0 0 12px;border:1px solid var(--g-hair);box-shadow:0 18px 60px rgba(0,0,0,.45);text-shadow:none;
 background:linear-gradient(var(--fz-acc),var(--fz-acc)) 0 0/44px 3px no-repeat border-box,linear-gradient(to top left,transparent calc(50% - .75px),var(--g-hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 100% 100%/14px 14px no-repeat border-box,linear-gradient(180deg,rgba(22,26,21,.95),rgba(9,11,9,.93));
 clip-path:polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%)}
html.fz2 #hud [data-h="board"] h2{margin:0;padding:14px 22px 12px;font-size:21px;font-weight:800;letter-spacing:.2em;color:#fbf8f0;border-bottom:1px solid var(--g-hair);background:linear-gradient(180deg,rgba(255,255,255,.04),transparent)}
html.fz2 #hud [data-h="board"] table{margin-top:4px;font-size:18px;font-variant-numeric:tabular-nums}
html.fz2 #hud [data-h="board"] th{padding:8px 14px 6px;font-size:12px;font-weight:800;letter-spacing:.18em;color:#a8a08a;border-bottom:1px solid var(--g-hair)}
html.fz2 #hud [data-h="board"] td{padding:6px 14px;font-weight:700;color:#e4dcc4;border-top:1px solid rgba(255,255,255,.035)}
html.fz2 #hud [data-h="board"] tr:nth-child(even) td{background:rgba(255,255,255,.022)}
html.fz2 #hud [data-h="board"] td:first-child{padding-left:20px;color:#fbf8f0}
html.fz2 #hud [data-h="board"] tr.t0 td:first-child{box-shadow:inset 3px 0 0 #4aa3ff;color:var(--c-ally)}
html.fz2 #hud [data-h="board"] tr.t1 td:first-child{box-shadow:inset 3px 0 0 #ff5a4a;color:var(--c-enemy)}
html.fz2 #hud [data-h="board"] tr.me td{background:rgba(240,174,46,.17);color:#fff}
html.fz2 #hud [data-h="board"] tr.me td:first-child{color:var(--c-me);box-shadow:inset 3px 0 0 var(--c-me)}
html.fz2 #hud [data-h="board"] tr.dead td{opacity:.42}
/* ---------- pause ---------- */
html.fz2 #hud [data-h="pause"]{background:radial-gradient(900px 500px at 50% 40%,rgba(240,174,46,.07),transparent 70%),rgba(6,8,6,.86)}
html.fz2 #hud [data-h="pmain"] h1{letter-spacing:.06em;text-shadow:0 6px 30px rgba(0,0,0,.5);margin-bottom:10px}
html.fz2 #hud [data-h="pmain"] button,html.fz2 #hud [data-h="psetback"]{border:1px solid rgba(236,226,198,.3);background:linear-gradient(180deg,rgba(28,32,26,.92),rgba(12,14,11,.92));clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);color:#ece6d6;letter-spacing:.14em}
html.fz2 #hud [data-h="resume"]{color:#17140a!important;background:linear-gradient(180deg,#ffc650,#e5a024)!important;border-color:#f0ae2e!important}
html.fz2 #hud [data-h="pmain"] button:hover,html.fz2 #hud [data-h="psetback"]:hover{border-color:#f0ae2e;color:#fff;background:linear-gradient(180deg,rgba(60,48,20,.95),rgba(24,20,10,.95))}
/* ---------- small screens ---------- */
@media(max-height:820px){html.fz2 #hud{--fzd-h:13px;--fzd-f:12px}}
@media(max-width:760px){
 html.fz2 #hud{--fzd-h:12px;--fzd-f:11px;--fz2-wing:clamp(70px,16vw,104px);--fz-map:92px}
 html.fz2 #hud [data-h="vit"]{width:42vw}
 html.fz2 #hud [data-h="wp"]{min-width:0;max-width:54vw}
 html.fz2 #hud [data-h="wp"]>.fz2-wi{display:none}
 html.fz2 #hud [data-h="feed"]{top:calc(var(--fz-obj-top) + 28px);max-width:52vw}
}`;

/* small inline icons */
const SVG = {
  shield: '<svg viewBox="0 0 12 14" aria-hidden="true"><path d="M6 .6 11.2 2.4V6.6C11.2 9.8 9 12.2 6 13.4 3 12.2.8 9.8.8 6.6V2.4Z" fill="currentColor"/></svg>',
  kill: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1v3.4M7 9.6V13M1 7h3.4M9.6 7H13" stroke="currentColor" stroke-width="1.8"/><circle cx="7" cy="7" r="3.6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  head: '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="7" r="2.2" fill="currentColor"/><path d="M7 0v2.4M7 11.6V14M0 7h2.4M11.6 7H14" stroke="currentColor" stroke-width="1.5"/></svg>',
  streak: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.5 6.2 7 2.4l5.5 3.8M1.5 11.2 7 7.4l5.5 3.8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  flag: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.4 13.4V1" stroke="currentColor" stroke-width="1.8"/><path d="M3.2 1.6h8.6l-2.2 3 2.2 3H3.2Z" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 .8 8.8 5h4.4L9.6 7.8 11 12.6 7 9.8 3 12.6 4.4 7.8.8 5h4.4Z" fill="currentColor"/></svg>',
  medal: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 .6 12.6 3.8V10.2L7 13.4 1.4 10.2V3.8Z" fill="currentColor"/><path d="M4.4 7.2 6.3 9l3.4-3.8" fill="none" stroke="#f8c552" stroke-width="1.6"/></svg>',
  zone: '<svg viewBox="0 0 16 10" aria-hidden="true"><circle cx="8" cy="5" r="4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.2 1.6"/></svg>',
  eye: '<svg viewBox="0 0 16 10" aria-hidden="true" style="width:1.3em;height:.85em"><path d="M.8 5C2.8 1.8 5.2.6 8 .6s5.2 1.2 7.2 4.4C13.2 8.2 10.8 9.4 8 9.4S2.8 8.2.8 5Z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="5" r="2.2" fill="currentColor"/></svg>',
};
const SHOT_IDS = new Set('akr ar asg asr axe bat bp bpc bplmg brst car cqc crow dbs dlmg dmr dsg dsmg frag fsmg gl hbr hp hsmg hsr knife lmg lsg lsp lsr mach mini mp p22 p9 pdw rev rl sawn scout sg smg sr ssmg ssr xbow'.split(' '));
const GEAR_IDS = new Set('adren ammobox bandage c4 c4remote claymore decoy flash medkit mine molotov plate sensor shield smoke sticky stun syringe tknife wire'.split(' '));
/* worker: weapon picture -> tight white silhouette (PNG blob) */
const CUTTER = `self.onmessage = async ev => {
  const id = ev.data && ev.data.id, src = ev.data && ev.data.src;
  try {
    const r = await fetch(src); if (!r.ok) throw 0;
    const bm = await createImageBitmap(await r.blob());
    const W = 256, H = 128, c = new OffscreenCanvas(W, H), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(bm, 0, 0, W, H); if (bm.close) bm.close();
    const d = x.getImageData(0, 0, W, H), px = d.data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) { const k = (y * W + i) * 4 + 3; if (px[k] > 120) { px[k - 3] = px[k - 2] = px[k - 1] = 255; px[k] = 255; if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; } else px[k] = 0; }
    if (x1 < 0) { self.postMessage({ id, blob: null }); return; }
    x.putImageData(d, 0, 0);
    const o = new OffscreenCanvas(x1 - x0 + 1, y1 - y0 + 1); o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    self.postMessage({ id, blob: await o.convertToBlob({ type: 'image/png' }) });
  } catch (e) { self.postMessage({ id, blob: null }); }
};`;
const BLUE = '#4aa3ff', RED = '#ff5a4a', NEUTRAL = '#d9d4c4', GOLD = '#e8a628';
const PILL = /^(dom|site)_([A-Z])$/;
const Q = 40;                                   // capture progress steps
const SCALE = []; for (let i = 0; i <= Q; i++) SCALE.push('scaleX(' + (i / Q) + ')');
const PVAL = []; for (let i = 0; i <= Q; i++) PVAL.push(String(i / Q));
const CH = []; for (let i = 0; i <= 8; i++) CH.push([]);

export function install({ engine: E, settings, i18n, hudRoot, theme }) {
  if (document.getElementById('fz2-style')) return null;
  const I = E && E.internals, hud = I && I.hud; if (!hud || !hud.el || !hud.api || !hudRoot || !theme) return null;
  const html = document.documentElement, el = hud.el, api = hud.api;
  const li = () => Math.max(0, LANGS.indexOf((i18n && i18n.lang) || 'fr'));
  const T = k => TX[k][li()] || TX[k][0];
  const tr = k => { try { const v = i18n ? i18n.t(k) : k; return v && v !== k ? v : ''; } catch { return ''; } };
  const st = document.createElement('style'); st.id = 'fz2-style'; st.textContent = CSS; document.head.append(st);
  const guard = (obj, key, after) => { const f = obj[key]; if (typeof f !== 'function') return; obj[key] = function (a, b, c, d, e, g) { const r = f.call(this, a, b, c, d, e, g); try { after(a, b, c, d, e, g); } catch (x) { console.warn('[hud-v2]', key, x); } return r; }; };
  const flag = (node, cls, on) => { const k = '_fz2' + cls; if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); } };
  const mk = (tag, cls, inner) => { const e = document.createElement(tag); if (cls) e.className = cls; if (inner) e.innerHTML = inner; return e; };
  const url = p => { try { return new URL(p, import.meta.url).href; } catch { return p; } };
  /* weapon silhouettes: the studio render (weapon-shots/, or the gear picture) cut once per weapon in a worker (fetch, decode, small
     OffscreenCanvas, soft shadow removed by an alpha threshold, margins cropped, PNG blob), then used as a CSS mask: any colour, sharp,
     filling its box. Nothing of it runs on the main thread (a canvas read-back there stalled ~0.5 s behind the WebGL frames).
     Without workers or OffscreenCanvas the raw picture is the mask (softer, smaller, still right). */
  const sil = new Map();
  const hasIcon = id => !!id && (SHOT_IDS.has(id) || GEAR_IDS.has(id));
  const srcOf = id => (SHOT_IDS.has(id) ? url('weapon-shots/' + id + '.webp') : url('map-shots/gear-' + id + '.webp'));
  const finish = (e, u) => { e.url = u; const w = e.wait; e.wait = null; for (const f of w) { try { f(u); } catch { /* one line */ } } };
  let wk = null;
  try {
    if (typeof Worker === 'function' && typeof OffscreenCanvas === 'function') {
      const wu = URL.createObjectURL(new Blob([CUTTER], { type: 'text/javascript' }));
      wk = new Worker(wu);
      wk.onmessage = ev => { const m = ev.data || {}, e = sil.get(m.id); if (!e || !e.wait) return; finish(e, m.blob ? 'url("' + URL.createObjectURL(m.blob) + '")' : 'url("' + srcOf(m.id) + '")'); };
      wk.onerror = () => { const w = wk; wk = null; try { w.terminate(); } catch { /* gone */ } for (const [id, e] of sil) if (e.wait) finish(e, 'url("' + srcOf(id) + '")'); };
    }
  } catch { wk = null; }
  /** cb(cssUrl) now or once the picture is cut ('' when there is none). */
  function silhouette(id, cb) {
    let e = sil.get(id);
    if (e) { if (e.wait) e.wait.push(cb); else cb(e.url); return; }
    if (!hasIcon(id)) { sil.set(id, { url: '', wait: null }); cb(''); return; }
    e = { url: '', wait: [cb] }; sil.set(id, e);
    if (wk) { try { wk.postMessage({ id, src: srcOf(id) }); return; } catch { /* below */ } }
    finish(e, 'url("' + srcOf(id) + '")');
  }
  /* the reload key and the interact key, read again only when the bindings change */
  let keyR = '', keyE = '';
  const readKeys = () => { try { keyR = settings.keyLabel ? settings.keyLabel(settings.get('keys.reload')) : 'R'; keyE = settings.keyLabel ? settings.keyLabel(settings.get('keys.interact')) : 'E'; } catch { keyR = 'R'; keyE = 'E'; } };
  readKeys();
  const kbd = text => { const k = document.createElement('kbd'); k.className = 'fz2-k'; k.textContent = text; return k; };

  /* ================= top centre: wings, timer tab, pills ================= */
  const pillBox = mk('div', 'fz2-pills'); pillBox.setAttribute('aria-hidden', 'true'); el.top.appendChild(pillBox);
  const pills = new Map();        // letter -> pill
  const rings = new Map();        // marker id -> { e, q, on, them }
  /* each piece of information once: a tab label that repeats the left panel (Zombies: "Wave 3" next to WAVE 3) and an objective line that
     repeats the right one (Zombies: "14 left" next to LEFT 14) are hidden; the tab then shows only the timer, or nothing */
  const sLl = el.sL.querySelector('small'), sLv = el.sL.querySelector('b'), sRv = el.sR.querySelector('b');
  const norm = x => String(x || '').toUpperCase().replace(/\s+/g, '');
  function dupPass() {
    const c = el.center._t || '', dupC = !!c && el.sL._display !== 'none' && norm(c) === norm((sLl._t || '') + (sLv._t || ''));
    flag(el.center, 'fz2-dup', dupC);
    let dupO = false; const ob = el.obj._t || '', v = sRv._t || '';
    if (ob && v && el.sR._display !== 'none') { const md = I.mode; if (md && md.id === 'zombie') dupO = ob.split(/\D+/).indexOf(v) >= 0; }
    flag(el.obj, 'fz2-dup', dupO);
    flag(html, 'fz2-notab', !(el.timer._display !== 'none' || (el.center._display !== 'none' && !dupC)));
  }
  guard(api, 'set', o => {
    if (!o) return;
    if ('timer' in o || 'center' in o || 'left' in o || 'right' in o || 'objective' in o) dupPass();
    if ('left' in o && o.left) flag(el.sL, 'fz2-long', String(o.left.value ?? '').length > 3);
    if ('right' in o && o.right) flag(el.sR, 'fz2-long', String(o.right.value ?? '').length > 3);
  });
  function pillState(p, m, site) {
    const c = m.color || NEUTRAL, s = site ? 'site' : c === BLUE ? 'own' : c === RED ? 'foe' : c === GOLD ? 'con' : 'neu';
    if (p.col !== c) { p.col = c; p.e.style.setProperty('--pc', c); }
    if (p.st !== s) { if (p.st) p.e.classList.remove(p.st); p.st = s; p.e.classList.add(s); }
  }
  function addPill(letter, m, site) {
    const e = mk('i', 'fz2-pl'), b = document.createElement('b'), u = document.createElement('u');
    b.textContent = letter; e.append(u, b);
    let at = null; for (const n of pillBox.children) if (n._l > letter) { at = n; break; }
    e._l = letter; pillBox.insertBefore(e, at);
    const p = { e, col: '', st: '', q: -1, cap: false, them: false, site }; pills.set(letter, p); pillState(p, m, site);
    flag(html, 'fz2-pills', true); return p;
  }
  function dropPill(letter) { const p = pills.get(letter); if (!p) return; p.e.remove(); pills.delete(letter); flag(html, 'fz2-pills', pills.size > 0); }

  /* markers: objective pills and capture rings (the HUD's own list is private: same id as the engine) */
  const known = new Map();        // id -> { d: marker element, m: marker data, placement state }
  {
    const f = api.marker;
    api.marker = function (id, m) {
      const had = known.has(id), r = f.call(this, id, m);
      try {
        if (!m) { if (had) { known.delete(id); rings.delete(id); const g = PILL.exec(id); if (g) dropPill(g[2]); } }
        else {
          if (!had) { const d = el.markers.lastElementChild; known.set(id, { d, m, on: false, small: false, dist: 0, x0: 0, x1: 0, y0: 0, y1: 0, pdy: 0, dy: 0, pfade: false, fade: false }); const g = PILL.exec(id); if (g && d && !m.small) { const rg = mk('i', 'fz2-rg'); d.appendChild(rg); rings.set(id, { e: rg, q: -1, on: false, them: false }); } }
          else known.get(id).m = m;
          const g = PILL.exec(id); if (g && !m.small) { const p = pills.get(g[2]); if (p) pillState(p, m, g[1] === 'site'); else addPill(g[2], m, g[1] === 'site'); }
        }
      } catch (x) { console.warn('[hud-v2] marker', x); }
      return r;
    };
  }
  /* capture progress (Domination): read from the mode at 10 Hz, written only when a step changes */
  function zonesNow() {
    const md = I.mode; if (!md) return null;
    let s = null; try { s = md.state; } catch { return null; }
    if (s && Array.isArray(s.zones)) return s.zones;
    const pts = md.impl && md.impl.points; return Array.isArray(pts) ? pts : null;
  }
  const LET = 'ABCDEF';
  function progressPass() {
    if (!pills.size && !rings.size) return;
    const Z = zonesNow(); if (!Z) return;
    const P = E.player, sgn = P && P.team === 1 ? -1 : 1;
    for (let i = 0; i < Z.length && i < 6; i++) {
      const z = Z[i], letter = typeof z.id === 'string' ? z.id : LET[i];
      const pr = typeof z.prog === 'number' ? z.prog : typeof z.progress === 'number' ? z.progress : 0, v = pr * sgn, a = v < 0 ? -v : v;
      const cap = a > 0.02 && a < 0.98, q = cap ? Math.round(a * Q) : 0, them = v < 0;
      const p = pills.get(letter);
      if (p) {
        if (p.cap !== cap) { p.cap = cap; p.e.classList.toggle('cap', cap); }
        if (p.them !== them) { p.them = them; p.e.classList.toggle('them', them); }
        if (p.q !== q) { p.q = q; p.e.style.setProperty('--p', PVAL[q]); }
      }
      const rg = rings.get('dom_' + letter);
      if (rg) {
        if (rg.on !== cap) { rg.on = cap; rg.e.classList.toggle('on', cap); }
        if (rg.them !== them) { rg.them = them; rg.e.style.setProperty('--rc', them ? '#ff7a62' : '#8fc4f2'); }
        if (rg.q !== q) { rg.q = q; rg.e.style.setProperty('--p', PVAL[q]); }
      }
    }
  }

  /* ================= vitals: armour value ================= */
  const av = mk('span', 'fz2-av', SVG.shield + '<b>0</b>'), avB = av.lastChild; el.vit.appendChild(av);
  let avV = -1;
  guard(hud, 'vitals', (hp, maxHp, armor) => {
    const a = Math.max(0, Math.round(armor || 0));
    if (a !== avV) { avV = a; avB.textContent = String(a); flag(av, 'z', a <= 0); }
  });

  /* ================= weapon: silhouette, fire mode, magazine ticks, reload, low ammo ================= */
  const wi = mk('i', 'fz2-wi'), fm = mk('em', 'fz2-fm'), mag = el.wp.querySelector('.fzt-mag'), rl = document.createElement('s');
  el.wp.insertBefore(wi, el.wp.firstChild); el.wp.appendChild(fm); if (mag) mag.appendChild(rl);
  const fmI = document.createElement('i'), fmT = document.createElement('span'); fm.append(fmI, fmT);
  let wId = '', fmKey = '', relV = false, lowV = -1, relP = false, fmLang = '';
  function fireMode(d) { return !d || d.kind === 'melee' ? ['melee', 's0'] : d.auto ? ['auto', 'sa'] : d.burst > 1 ? ['burst', 's3'] : ['semi', 's1']; }
  /* state 0: fire mode, 1: low, with the reload key, 2: magazine and reserve both empty */
  function paintFm(state) {
    const key = state + ':' + li() + ':' + keyR + ':' + wId;
    if (key === fmKey) return; fmKey = key;
    fm.className = 'fz2-fm'; fm.textContent = '';
    if (state === 1) { fm.classList.add('lo'); fm.append(kbd(keyR), document.createTextNode(T('reload'))); return; }
    if (state === 2) { fm.classList.add('lo'); fm.append(document.createTextNode(T('empty'))); return; }
    let d = null; try { const w = I.wNow && I.wNow(); d = w && w.def; } catch { d = null; }
    const [k, c] = fireMode(d); fm.classList.add(c); fmI.className = ''; fm.append(fmI, fmT); fmT.textContent = T(k);
  }
  guard(hud, 'weapon', (ammo, magN, name, reloading, reserve) => {
    let w = null; try { w = I.wNow && I.wNow(); } catch { w = null; }
    const id = w && w.def ? w.def.id : '';
    if (id !== wId) {
      wId = id; wi.style.setProperty('--wi', 'none'); silhouette(id, u => { if (wId === id) wi.style.setProperty('--wi', u || 'none'); });
      const mt = magN > 0 && magN <= 40 ? magN : 10; if (mag) { mag.style.setProperty('--mt', String(mt)); mag.classList.toggle('nt', !(magN > 1)); }
      fmKey = '';
    }
    const num = typeof ammo === 'number' && magN > 0;
    const state = !num || reloading ? 0 : ammo === 0 && reserve === 0 ? 2 : magN > 1 && ammo <= magN * 0.2 && reserve !== 0 ? 1 : 0;
    if (state !== lowV || fmKey === '' || fmLang !== keyR) { lowV = state; fmLang = keyR; paintFm(state); }
    const r = !!reloading;
    if (r !== relV) {
      relV = r; flag(el.wp, 'fz2-rl', r);
      if (r) { const left = I.P && I.P.reload > 0 ? I.P.reload : 1.5; el.wp.style.setProperty('--d', Math.max(0.2, left).toFixed(2) + 's'); relP = !relP; rl.className = relP ? 'p0' : 'p1'; }
      else rl.className = '';
    }
  });
  /* classic gear line (when the gear system is off) and the weapon light: key caps */
  let gK = '';
  guard(hud, 'gear', (n, name, key) => {
    if (!(n >= 0)) { gK = ''; return; }
    const k = n + '|' + name + '|' + key + '|' + li(); if (k === gK) return; gK = k;
    el.gear.textContent = ''; if (key) el.gear.appendChild(kbd(key));
    const s = document.createElement('span'); s.textContent = name || ''; const b = document.createElement('b'); b.textContent = '×' + n; el.gear.append(s, b);
  });
  let tK = '';
  guard(hud, 'torch', (on, key) => {
    if (!on) { tK = ''; return; }
    const k = (key || '') + '|' + li(); if (k === tK) return; tK = k;
    el.torch.textContent = ''; if (key) el.torch.appendChild(kbd(key)); el.torch.appendChild(document.createTextNode(hud.t ? hud.t('torch') : 'LAMPE'));
  });

  /* weapon panel height: the gear tiles sit just above it (one layout read, after a resize only) */
  let wph = -1;
  const measure = () => { const h = el.wp.offsetHeight; if (h > 20 && h !== wph) { wph = h; hudRoot.style.setProperty('--fz2-wph', h + 'px'); } };
  let mT = 0; const remeasure = () => { clearTimeout(mT); mT = setTimeout(() => { try { measure(); } catch { /* keep the estimate */ } }, 120); };
  addEventListener('resize', remeasure);
  const noop = () => {};
  E.on('matchStart', () => { remeasure(); try { for (const w of (I.P && I.P.ws) || []) if (w && w.def) silhouette(w.def.id, noop); } catch { /* cut on first use */ } });

  /* ================= gear tiles (engine-gear.js): key caps are CSS; charge fill on change only ================= */
  let gxObs = null;
  const GD = () => (globalThis.FZGearData && globalThis.FZGearData.ITEMS) || null;
  function paintTiles(box) {
    const items = GD();
    for (const d of box.children) {
      if (!d.classList || !d.classList.contains('gx-s')) continue;
      let ch = d._fz2; if (!ch) { const u = document.createElement('u'), s = document.createElement('s'); u.className = 'fz2-ch'; u.appendChild(s); d.appendChild(u); ch = d._fz2 = { u, s, c: -1, f: -1 }; }
      const b = d.querySelector('b'), img = d.querySelector('img'); if (!b || !img) continue;
      const n = parseInt(String(b.textContent).replace(/[^0-9]/g, ''), 10) || 0;
      const g = /gear-([a-z0-9]+)\.webp/.exec(img.getAttribute('src') || ''), it = g && items ? items[g[1]] : null;
      const c = Math.max(1, Math.min(8, (it && it.carry) || Math.max(1, n)));
      if (c !== ch.c) { ch.c = c; ch.u.style.setProperty('--c', String(c)); }
      const f = Math.max(0, Math.min(Q, Math.round(n / c * Q))); if (f !== ch.f) { ch.f = f; ch.s.style.transform = SCALE[f]; }
    }
  }
  function watchTiles() {
    if (gxObs) return true;
    const box = document.getElementById('gx-slots'); if (!box) return false;
    gxObs = new MutationObserver(() => { try { paintTiles(box); } catch (x) { console.warn('[hud-v2] tiles', x); } });
    gxObs.observe(box, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['src', 'class'] });
    try { paintTiles(box); } catch { /* next change */ }
    return true;
  }
  if (!watchTiles()) { const ro = new MutationObserver(() => { if (watchTiles()) ro.disconnect(); }); ro.observe(hudRoot, { childList: true }); }

  /* ================= kill feed: team colours, weapon silhouette, headshot, own lines ================= */
  let pend = null;
  guard(hud, 'feedKill', (killer, victim, head, mineK, mineV) => {
    const d = el.feed.firstElementChild; if (!d) return;
    pend = d; if (mineK || mineV) d.classList.add('me');
  });
  const side = (a, P) => (!a ? 'tn' : a === P ? 'tm' : P && P.team !== null && P.team !== undefined ? (a.team === P.team ? 'ta' : 'te') : 'tn');
  let multiN = 0, multiT = -1e9, killNow = 0, killHead = false, killUsed = 0;
  const clearKill = () => { killNow = 0; };
  const CAPTURE = new Set(['Capture', 'Captura', 'Eroberung', 'Conquista']);       // modes.js 'l.capture' in the six languages
  E.on('kill', e => {
    const P = E.player;
    try {
      if (pend && e) {
        const d = pend; pend = null; const kids = d.children, a = kids[0], b = kids[kids.length - 1];
        if (e.killer && e.killer !== e.victim && a) a.classList.add(side(e.killer, P));
        if (b) b.classList.add(side(e.victim, P));
        const ic = d.querySelector('.fzk');
        const wid = e.weaponId || (e.killer && e.killer.weaponId) || '';
        if (ic && !ic.classList.contains('x') && hasIcon(wid)) {
          const w = mk('i', 'fz2-wi'); d.insertBefore(w, ic); if (!e.head) ic.remove();
          silhouette(wid, u => { if (u) w.style.setProperty('--wi', u); });
        } else if (ic && wid === 'zone') ic.outerHTML = '<i class="fzk x">' + SVG.zone + '</i>';
      }
      if (e && P && e.killer === P && e.victim && e.victim !== P) {
        // the mode's own 'kill' listener (registered later) pays the reward in this same task: the flag lives until it ends
        killNow = 1; killHead = !!e.head; killUsed = 0; queueMicrotask(clearKill);
        if (e.victim.kind !== 'zombie') {
          const now = performance.now(); if (now - multiT < 4500) multiN++; else multiN = 1; multiT = now;
          if (multiN >= 2) { const lab = T(multiN === 2 ? 'm2' : multiN === 3 ? 'm3' : 'm4'); queueMicrotask(() => push(lab, 0, 'medal', true)); }       // after the kill's own reward row: the medal lands on top
        }
      }
    } catch (x) { console.warn('[hud-v2] kill', x); }
  });

  /* ================= credits stack ================= */
  const rws = mk('div', 'fz2-rws'); el.earn.appendChild(rws);
  const rows = []; let rowI = 0;
  for (let i = 0; i < 5; i++) {
    const r = mk('div', 'fz2-rw'), ic = document.createElement('i'), s = document.createElement('span'), b = document.createElement('b'); r.append(ic, s, b); rws.appendChild(r);
    const o = { r, ic, s, b, p: false, icon: '' }; rows.push(o);
    r.addEventListener('animationend', ev => { if (ev.target === r) { r.classList.remove('on', 'p0', 'p1'); } });
  }
  function push(label, n, icon, medal) {
    const o = rows[rowI]; rowI = (rowI + 1) % rows.length;
    if (o.icon !== icon) { o.icon = icon; o.ic.innerHTML = SVG[icon] || SVG.star; }
    o.s.textContent = label || ''; o.b.textContent = n > 0 ? '+' + n + ' ₡' : '';
    o.r.classList.toggle('md', !!medal);
    rws.insertBefore(o.r, rws.firstChild);
    o.p = !o.p; o.r.classList.remove('p0', 'p1'); o.r.classList.add('on', o.p ? 'p0' : 'p1');
  }
  guard(hud, 'earn', (total, n, reason) => {
    if (!(n > 0)) return;
    let icon = 'star';
    if (killNow) { icon = killUsed === 0 ? (killHead ? 'head' : 'kill') : 'streak'; killUsed++; }
    else if (reason && CAPTURE.has(reason)) icon = 'flag';
    push(reason || '', n, icon, false);
  });

  /* ================= prompts and pickups: key caps ================= */
  const KEYED = /^\[([^\]]{1,14})\]\s*(.+)$/;
  function keyed(node) {
    const s = node._t; if (!s || (node._fz2k === s && node.textContent !== s)) return; node._fz2k = s;       // the same prompt shown again comes back as plain text from engine-hud: rebuild it
    let g = KEYED.exec(s), key = '', before = '', after = '';
    if (g) { key = g[1]; after = g[2]; }
    else if (keyE) { const i = (' ' + s + ' ').indexOf(' ' + keyE + ' '); if (i >= 0) { key = keyE; before = s.slice(0, i).trim(); after = s.slice(i + keyE.length).trim(); } }
    if (!key) { flag(node, 'fz2-nk', true); return; }
    flag(node, 'fz2-nk', false); node.textContent = '';
    if (before) { const b = document.createElement('span'); b.textContent = before; node.appendChild(b); }
    node.appendChild(kbd(key));
    const a = document.createElement('span'); a.textContent = after; node.appendChild(a);
  }
  guard(api, 'prompt', () => keyed(el.prompt));
  guard(hud, 'loot', () => keyed(el.loot));
  guard(hud, 'door', () => keyed(el.loot));
  /* spectator line: name, then the hint under it */
  let spK = '';
  guard(hud, 'spectate', text => {
    const s = text || ''; if (s === spK) return; spK = s; if (!s) return;
    const parts = s.split(/\s{2}·\s{2}/); el.spec.textContent = '';
    const b = document.createElement('b'); b.textContent = parts[0]; el.spec.appendChild(b);
    if (parts[1]) { const sm = document.createElement('small'); sm.innerHTML = SVG.eye; sm.appendChild(document.createTextNode(parts[1])); el.spec.appendChild(sm); }
    el.spec._t = s;
  });

  /* ================= world markers: no two labels on top of each other (20 Hz) =================
     The markers are projected here the way engine-hud.js does it (same clamps), objectives first: one that would cover another
     moves by a row; then teammate tags from the nearest: a tag that would cover anything is lifted by a line (twice at most),
     otherwise faded. Only the marker's own `translate` and a class are written, and only when they change. */
  const ORD = [], DYS = new Map(), OBJ_TRY = [0, 40, -40, 80, -80], TAG_TRY = [0, -16, -32];
  const dyStr = v => { let x = DYS.get(v); if (!x) { x = '0 ' + v + 'px'; DYS.set(v, x); } return x; };
  function declutter() {
    if (!known.size) return;
    const cam = I.camera, P = E.player; if (!cam || !P) return;
    const me = cam.matrixWorldInverse.elements, pe = cam.projectionMatrix.elements, w = innerWidth, h = innerHeight, px = P.pos.x, py = P.pos.y, pz = P.pos.z;
    let n = 0;
    for (const e of known.values()) {
      const m = e.m; e.on = false; if (!m || !e.d) continue;
      const small = !!m.small, X = m.x, Y = (m.y || 0) + (small ? 0 : 1.2), Z = m.z;
      const vx = me[0] * X + me[4] * Y + me[8] * Z + me[12], vy = me[1] * X + me[5] * Y + me[9] * Z + me[13], vz = me[2] * X + me[6] * Y + me[10] * Z + me[14];
      const iw = 1 / (pe[3] * vx + pe[7] * vy + pe[11] * vz + pe[15]);
      let x = (pe[0] * vx + pe[4] * vy + pe[8] * vz + pe[12]) * iw, y = (pe[1] * vx + pe[5] * vy + pe[9] * vz + pe[13]) * iw;
      const dist = Math.hypot(m.x - px, (m.y || 0) - py, m.z - pz);
      if (vz > -0.1) { if (small) continue; x = -x; y = -1; const q = Math.max(Math.abs(x), 0.001); if (q < 1) x /= q; }
      if (small && (x > 1 || x < -1 || y > 1 || y < -1 || dist > 120)) continue;       // same reach as engine-hud.js (ally tags out to 120 m)
      x = x < -0.94 ? -0.94 : x > 0.94 ? 0.94 : x; y = y < -0.86 ? -0.86 : y > 0.86 ? 0.86 : y;
      const sx = (x * 0.5 + 0.5) * w, sy = (-y * 0.5 + 0.5) * h;
      e.on = true; e.small = small; e.dist = dist;
      if (small) { const hw = (typeof m.label === 'string' ? m.label.length : 4) * 3.4 + 5; e.x0 = sx - hw; e.x1 = sx + hw; e.y0 = sy - 24; e.y1 = sy + 3; }
      else { const lg = typeof m.label === 'string' && m.label.length > 2; e.x0 = sx - 25; e.x1 = sx + 25; e.y0 = sy - (lg ? 44 : 25); e.y1 = sy + 36; }
      ORD[n++] = e;
    }
    for (let a = 1; a < n; a++) { const o = ORD[a], k = (o.small ? 1e6 : 0) + o.dist; let b = a - 1; while (b >= 0 && (ORD[b].small ? 1e6 : 0) + ORD[b].dist > k) { ORD[b + 1] = ORD[b]; b--; } ORD[b + 1] = o; }
    for (let i = 0; i < n; i++) {
      const e = ORD[i], tries = e.small ? TAG_TRY : OBJ_TRY; let dy = 0, ok = false;
      for (let t = 0; t < tries.length && !ok; t++) {
        dy = tries[t]; ok = true;
        for (let j = 0; j < i; j++) { const o = ORD[j]; if (o.pfade) continue; if (e.x0 < o.x1 + 2 && e.x1 > o.x0 - 2 && e.y0 + dy < o.y1 + o.pdy && e.y1 + dy > o.y0 + o.pdy) { ok = false; break; } }
      }
      if (!ok && e.small) {       // an ally tag is never dimmed by an objective marker (outfits carry no team colour: the tag is the team cue); only by another tag
        dy = 0; ok = true;
        for (let j = 0; j < i; j++) { const o = ORD[j]; if (o.pfade || !o.small) continue; if (e.x0 < o.x1 + 2 && e.x1 > o.x0 - 2 && e.y0 < o.y1 + o.pdy && e.y1 > o.y0 + o.pdy) { ok = false; break; } }
      }
      e.pdy = ok ? dy : 0; e.pfade = !ok;
    }
    for (const e of known.values()) {
      if (!e.on) { e.pdy = 0; e.pfade = false; }
      if (e.dy !== e.pdy) { e.dy = e.pdy; e.d.style.translate = e.dy ? dyStr(e.dy) : ''; }       // the CSS translate property composes with the engine's transform
      if (e.fade !== e.pfade) { e.fade = e.pfade; e.d.classList.toggle('fz2-fade', e.fade); }
    }
    for (let i = 0; i < n; i++) ORD[i] = null;
  }

  /* ================= 20 Hz pass: capture progress (every other call), marker declutter ================= */
  let tick = 0;
  guard(hud, 'drawMap', () => { if ((++tick & 1) === 0) progressPass(); declutter(); });

  guard(hud, 'reset', () => {
    for (const k of [...pills.keys()]) dropPill(k); known.clear(); rings.clear(); pend = null; multiN = 0; avV = -1; wId = ''; fmKey = ''; relV = false; lowV = -1; gK = ''; tK = ''; spK = '';
    flag(el.wp, 'fz2-rl', false); rl.className = '';
    for (const o of rows) o.r.classList.remove('on', 'p0', 'p1');
    remeasure();
  });
  settings.on('change', p => { if (typeof p === 'string' && p.startsWith('keys.')) { readKeys(); fmKey = ''; } });
  addEventListener('fz-keys', () => { readKeys(); fmKey = ''; });      // gamepad / touch glyphs switched on or off (input-hub.js)
  if (i18n && i18n.on) i18n.on('change', () => { fmKey = ''; gK = ''; tK = ''; });

  theme.opts.v2 = true;
  html.classList.add('fz2');
  remeasure();
  return { pills, rings, rows, push, get keys() { return { reload: keyR, interact: keyE }; } };
}
