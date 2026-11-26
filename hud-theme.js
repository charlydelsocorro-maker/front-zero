// FRONT ZÉRO — in-match HUD theme: restyles the HUD of engine-hud.js, adds the compass bar (hud-compass.js) and the round
// tactical minimap (hud-minimap.js). Loaded by main.js (?hud=classic skips it). Like hud-motion.js it only wraps the HUD's own
// methods, so every call site keeps working; each wrapper runs the original first and a failure here falls back to the classic HUD.
// Cost: the compass moves one composited strip by a transform from a precomputed table (per frame: a few multiplications, no
// allocation, no layout); the minimap is redrawn when the engine asks (20 times a second); everything else is CSS on existing nodes.
import { createCompass } from './hud-compass.js';
import { createMinimap } from './hud-minimap.js';

const CSS = `
html.fzt #hud{--fzd-h:17px;--fzd-f:15px;--fz-pad:clamp(12px,1.9vh,24px);--fz-map:clamp(128px,17.5vh,204px);--fzc-w:clamp(300px,31vw,580px);--fzc-h:clamp(26px,3.2vh,34px);--fzc-top:calc(var(--fz-pad)*.7);
 --fz-obj-top:calc(var(--fzc-top) + var(--fzc-h) + clamp(24px,2.8vh,30px));--fz-micro:clamp(10px,1.22vh,13px);--fz-body:clamp(14px,1.75vh,19px);
 --fz-ink:rgba(8,10,9,.68);--fz-ink2:rgba(8,10,9,.42);--fz-hair:rgba(236,226,198,.22);--fz-txt:#f4f0e6;--fz-dim:#c4bca5;--fz-acc:#f0ae2e;--fz-hp:#eef1ea;--fz-arm:#86bce9;--fz-low:#ff5a3c;
 --fz-plate:linear-gradient(180deg,rgba(10,13,11,.7),rgba(10,13,11,.5));
 text-shadow:0 1px 2px rgba(0,0,0,.9),0 0 1px rgba(0,0,0,.7);font-weight:600}
html.fzt.fzt-nocompass #hud{--fz-obj-top:var(--fz-pad)}
/* ---------- compass ---------- */
html.fzt #hud .fzc{position:absolute;left:50%;top:var(--fzc-top);width:var(--fzc-w);height:var(--fzc-h);transform:translateX(-50%);pointer-events:none}
html.fzt #hud .fzc-w{position:absolute;inset:0;overflow:hidden;background:linear-gradient(180deg,rgba(8,10,9,.52),rgba(8,10,9,.2));-webkit-mask-image:linear-gradient(90deg,transparent,#000 13%,#000 87%,transparent);mask-image:linear-gradient(90deg,transparent,#000 13%,#000 87%,transparent)}
html.fzt #hud .fzc-s{position:absolute;left:0;top:0;height:100%;will-change:transform}
html.fzt #hud .fzc-s i{position:absolute;bottom:0;width:1px;height:16%;background:rgba(244,240,230,.5)}
html.fzt #hud .fzc-s i.M{height:30%;width:2px;margin-left:-.5px;background:rgba(244,240,230,.85)}
html.fzt #hud .fzc-s span{position:absolute;top:13%;transform:translateX(-50%);font-size:calc(var(--fzc-h)*.36);line-height:1;font-weight:600;letter-spacing:.03em;color:rgba(232,226,210,.72);font-variant-numeric:tabular-nums;white-space:nowrap}
html.fzt #hud .fzc-s span.ic{font-size:calc(var(--fzc-h)*.44);top:9%;font-weight:700;color:#ece6d6}
html.fzt #hud .fzc-s span.c{font-size:calc(var(--fzc-h)*.56);top:4%;font-weight:800;color:#fbf8f0}
html.fzt #hud .fzc-s span.n{color:var(--fz-acc)}
html.fzt #hud .fzc:before{content:"";position:absolute;left:50%;bottom:0;width:2px;height:42%;margin-left:-1px;background:var(--fz-acc);box-shadow:0 0 0 1px rgba(0,0,0,.35);z-index:1}
html.fzt #hud .fzc-n{position:absolute;left:50%;top:-1px;width:0;height:0;margin-left:-6px;border:6px solid transparent;border-top:7px solid var(--fz-acc);border-bottom:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.7));z-index:1}
html.fzt #hud .fzc-h{position:absolute;left:50%;top:100%;margin-top:3px;transform:translateX(-50%);display:flex;justify-content:center;gap:1px;width:calc(var(--fzd-h)*2.6);height:calc(var(--fzd-h) + 2px);contain:strict;font-size:var(--fzd-f);font-weight:700;color:#fbf8f0;font-variant-numeric:tabular-nums;background:var(--fz-ink);box-shadow:inset 0 -2px 0 var(--fz-acc)}
html.fzt #hud .fzc-h i{display:block;height:var(--fzd-h);overflow:hidden;font-style:normal}
html.fzt #hud .fzc-h u{display:block;text-decoration:none;will-change:transform}
html.fzt #hud .fzc-h span{display:block;height:var(--fzd-h);line-height:var(--fzd-h);text-align:center}
html.fzt #hud .fzc-cv{position:absolute;left:0;top:0;width:100%;z-index:0;pointer-events:none}
html.fzt #hud .fzc-c .fzc-s{display:none}
html.fzt #hud .fzc-sc .fzc-w{overflow-x:scroll;overflow-y:hidden;scrollbar-width:none}
html.fzt #hud .fzc-sc .fzc-w::-webkit-scrollbar,html.fzt #hud .fzc-sc .fzc-h i::-webkit-scrollbar{display:none}
html.fzt #hud .fzc-sc .fzc-s{will-change:auto}
html.fzt #hud .fzc-sc .fzc-h i{overflow-y:scroll;scrollbar-width:none}
html.fzt #hud .fzc-sc .fzc-h u{will-change:auto}
html.fzt #hud .fzc-m{position:absolute;left:50%;top:0;width:0;height:100%;z-index:2}
html.fzt #hud .fzc-m em{position:absolute;left:0;top:50%;width:0;height:0;will-change:transform;font-style:normal}
html.fzt #hud .fzc-m em b{position:absolute;left:-8px;top:-8px;width:16px;height:16px;transform:rotate(45deg);border:2px solid currentColor;background:rgba(8,10,9,.82);box-shadow:0 0 0 1px rgba(0,0,0,.45)}
html.fzt #hud .fzc-m em s{position:absolute;left:-10px;top:-7px;width:20px;text-align:center;font-size:11px;line-height:14px;font-weight:800;color:#fff;text-decoration:none}
html.fzt #hud .fzc-m em.e b{left:-6px;top:-6px;width:12px;height:12px;opacity:.85}
html.fzt #hud .fzc-m em.e s{font-size:9px;color:currentColor}
/* ---------- minimap ---------- */
html.fzt #hud .fzmm{position:absolute;left:var(--fz-pad);top:var(--fz-pad);width:var(--fz-map);height:var(--fz-map);border-radius:50%;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.45),0 4px 16px rgba(0,0,0,.32)}
html.fzt #hud .fzmm canvas{position:absolute;left:0;top:0;width:100%;height:100%;border-radius:50%}
html.fzt.fzt-mm:not(.fzt-mmfail) #hud>[data-h="map"]{display:none}
/* ---------- match card: timer, mode and the two scores, under the minimap ---------- */
html.fzt #hud [data-h="top"]{left:var(--fz-pad);top:calc(var(--fz-pad) + var(--fz-map) + 10px);transform:none;width:max(var(--fz-map),150px);display:flex;flex-wrap:wrap;align-items:stretch;gap:2px;padding:0;background:none;font-size:var(--fz-body);white-space:nowrap}
html.fzt.fzt-nomap #hud [data-h="top"]{top:var(--fz-pad)}
html.fzt #hud [data-h="mid"]{order:-1;flex:1 0 100%;display:flex;flex-direction:row-reverse;align-items:center;justify-content:space-between;gap:8px;padding:3px 10px 3px 9px;background:var(--fz-plate);box-shadow:inset 0 1px 0 rgba(236,226,198,.16);line-height:1}
html.fzt #hud [data-h="timer"]{font-size:clamp(20px,2.7vh,30px);font-weight:700;min-width:0;letter-spacing:.04em;font-variant-numeric:tabular-nums;color:#fbf8f0}
html.fzt #hud [data-h="center"]{font-size:var(--fz-micro);letter-spacing:.16em;color:var(--fz-dim);overflow:hidden;text-overflow:ellipsis;text-transform:uppercase}
html.fzt #hud [data-h="sL"],html.fzt #hud [data-h="sR"]{flex:1 1 0;min-width:0;display:flex;flex-direction:column-reverse;align-items:flex-start;gap:1px;padding:3px 9px 4px 11px;background:var(--fz-plate);position:relative}
html.fzt #hud [data-h="sR"]{align-items:flex-end;padding:3px 11px 4px 9px}
html.fzt #hud [data-h="sL"]:before,html.fzt #hud [data-h="sR"]:before{content:"";position:absolute;top:0;bottom:0;left:0;width:3px;background:var(--tc,var(--fz-txt))}
html.fzt #hud [data-h="sR"]:before{left:auto;right:0}
html.fzt #hud [data-h="sL"] small,html.fzt #hud [data-h="sR"] small{font-size:var(--fz-micro);letter-spacing:.12em;color:var(--fz-dim);max-width:100%;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;line-height:1.1}
html.fzt #hud [data-h="sL"] b,html.fzt #hud [data-h="sR"] b{font-size:clamp(19px,2.6vh,29px);font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
/* ---------- objective line, zone panel, network ---------- */
html.fzt #hud [data-h="obj"]{top:var(--fz-obj-top);font-size:var(--fz-body);font-weight:600;letter-spacing:.05em;color:#ece6d6;background:linear-gradient(90deg,transparent,var(--fz-ink2) 18%,var(--fz-ink2) 82%,transparent);padding:2px 30px}
html.fzt #hud [data-h="zone"]{top:calc(var(--fz-obj-top) + clamp(28px,3.3vh,34px))!important;background:var(--fz-plate)!important;border:0!important;border-left:3px solid currentColor!important;padding:3px 12px 3px 9px!important;font-family:inherit!important;font-size:var(--fz-body)!important;letter-spacing:.06em!important}
html.fzt #hud [data-h="net"]{left:calc(var(--fz-pad) + var(--fz-map) + 8px)!important;top:var(--fz-pad)!important;font:700 var(--fz-micro)/1 'Barlow Condensed','Arial Narrow',Arial,sans-serif!important;letter-spacing:.06em;background:var(--fz-ink)!important;border-radius:0!important;padding:3px 7px!important;box-shadow:inset 2px 0 0 currentColor}
html.fzt.fzt-nomap #hud [data-h="net"]{left:var(--fz-pad)!important;top:calc(var(--fz-pad) + clamp(70px,8vh,84px))!important}
html.fzt #hud [data-h="fps"]{top:auto;bottom:4px;font-size:var(--fz-micro);letter-spacing:.06em;background:var(--fz-ink2);padding:1px 8px}
/* ---------- kill feed and credits ---------- */
html.fzt #hud [data-h="feed"]{right:var(--fz-pad);top:var(--fz-pad);font-size:var(--fz-body);gap:3px;max-width:40vw}
html.fzt #hud [data-h="feed"] div{display:flex;align-items:center;gap:7px;background:linear-gradient(270deg,var(--fz-ink),var(--fz-ink2) 72%,rgba(8,10,9,0));padding:2px 10px 2px 26px;color:#ece6d6;box-shadow:inset -2px 0 0 rgba(236,226,198,.35)}
html.fzt #hud [data-h="feed"] div:first-child{box-shadow:inset -2px 0 0 var(--fz-acc)}
html.fzt #hud [data-h="feed"] b{color:var(--fz-acc);font-weight:700}
html.fzt #hud [data-h="feed"] span{font-weight:600}
html.fzt #hud [data-h="feed"] span,html.fzt #hud [data-h="feed"] b{overflow:hidden;text-overflow:ellipsis;max-width:16vw}
html.fzt #hud .fzk{display:inline-block;flex:none;width:1.05em;height:.75em;color:#f4f0e6;opacity:.9}
html.fzt #hud .fzk svg{display:block;width:100%;height:100%;overflow:visible}
html.fzt #hud .fzk.h{color:var(--fz-acc);opacity:1;width:.8em;height:.8em}
html.fzt #hud .fzk.x{width:.7em;height:.7em;color:var(--fz-low)}
html.fzt #hud [data-h="earn"]{right:var(--fz-pad);top:34vh;font-size:clamp(17px,2.2vh,23px);font-weight:700;letter-spacing:.04em;color:var(--fz-acc);font-variant-numeric:tabular-nums}
html.fzt #hud [data-h="earn"] small{font-size:var(--fz-micro);letter-spacing:.1em;color:var(--fz-dim);text-transform:uppercase}
/* ---------- vitals ---------- */
html.fzt #hud [data-h="vit"]{left:var(--fz-pad);bottom:var(--fz-pad);width:clamp(214px,24vh,290px);display:grid;grid-template-columns:auto 1fr;align-items:end;column-gap:9px;padding:7px 14px 10px 15px;background:linear-gradient(90deg,var(--fz-ink),var(--fz-ink2) 76%,rgba(8,10,9,.16))}
html.fzt #hud [data-h="vit"]:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--fz-hp)}
html.fzt #hud [data-h="vit"].fzt-low:before{background:var(--fz-low);will-change:opacity}
html.fzt:not(.fzt-rm) #hud [data-h="vit"].fzt-low:before{animation:fzt-pulse .8s ease-in-out infinite alternate}
@keyframes fzt-pulse{from{opacity:1}to{opacity:.25}}
html.fzt #hud [data-h="vit"] .n{font-size:clamp(30px,4.3vh,46px);font-weight:700;line-height:.9;font-variant-numeric:tabular-nums;color:#fbf8f0;padding-left:.52em;position:relative}
html.fzt #hud [data-h="vit"] .n:before{content:"";position:absolute;left:0;top:50%;width:.34em;height:.34em;margin-top:-.2em;background:linear-gradient(currentColor,currentColor) center/100% 32% no-repeat,linear-gradient(currentColor,currentColor) center/32% 100% no-repeat;opacity:.85}
html.fzt #hud [data-h="vit"].fzt-low .n{color:var(--fz-low)}
html.fzt #hud [data-h="vit"] small{margin:0 0 .2em;font-size:var(--fz-micro);letter-spacing:.16em;color:var(--fz-dim);justify-self:end;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
html.fzt #hud [data-h="vit"] .meter{grid-column:1/-1;background:rgba(255,255,255,.13);margin-top:5px;height:4px}
html.fzt #hud [data-h="vit"] [data-h="hp"]{height:8px;margin-top:3px}
html.fzt #hud [data-h="hp"] u{background:var(--fz-hp)!important}
html.fzt #hud [data-h="vit"].fzt-low [data-h="hp"] u{background:var(--fz-low)!important}
html.fzt #hud [data-h="arm"] u{background:var(--fz-arm)}
html.fzt #hud [data-h="vit"] .meter:after{content:"";position:absolute;inset:0;z-index:2;background:repeating-linear-gradient(90deg,transparent 0 calc(10% - 2px),rgba(8,10,9,.75) calc(10% - 2px) 10%)}
html.fzt #hud [data-h="vit"] [data-h="arm"]:after{background:repeating-linear-gradient(90deg,transparent 0 calc(25% - 2px),rgba(8,10,9,.75) calc(25% - 2px) 25%)}
/* ---------- weapon, ammunition, gear ---------- */
html.fzt #hud [data-h="wp"]{right:var(--fz-pad);bottom:var(--fz-pad);display:flex;flex-direction:column;align-items:flex-end;min-width:clamp(190px,21vh,260px);padding:7px 15px 10px 14px;background:linear-gradient(270deg,var(--fz-ink),var(--fz-ink2) 76%,rgba(8,10,9,.16))}
html.fzt #hud [data-h="wp"]:before{content:"";position:absolute;right:0;top:0;bottom:0;width:3px;background:var(--fz-acc)}
html.fzt #hud [data-h="wname"]{order:-1;font-size:clamp(13px,1.6vh,17px);font-weight:700;letter-spacing:.16em;color:var(--fz-dim);line-height:1.2;margin-bottom:1px;max-width:min(320px,34vw);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
html.fzt #hud [data-h="wp"] .a{font-size:clamp(36px,5.2vh,56px);font-weight:700;line-height:.92;font-variant-numeric:tabular-nums;color:#fbf8f0;letter-spacing:.01em}
html.fzt #hud [data-h="wp"] .a span{font-size:.4em;font-weight:600;color:var(--fz-dim);letter-spacing:.04em}
html.fzt #hud .fzt-mag{order:1;display:block;align-self:stretch;height:3px;margin-top:6px;background:rgba(255,255,255,.13);overflow:hidden}
html.fzt #hud .fzt-mag u{display:block;height:100%;background:var(--fz-txt);transform-origin:100% 50%;text-decoration:none}
html.fzt #hud [data-h="wp"].fzt-lowam .fzt-mag u{background:var(--fz-low)}
html.fzt #hud [data-h="wp"].fzt-melee .fzt-mag{visibility:hidden}
html.fzt #hud [data-h="gear"]{order:2;margin-top:5px;font-size:var(--fz-micro);letter-spacing:.1em;color:var(--fz-dim)}
html.fzt #hud [data-h="torch"]{position:absolute;right:100%;bottom:10px;margin-right:6px;font-size:var(--fz-micro);letter-spacing:.14em;color:#1a1606;background:var(--fz-acc);padding:2px 7px;text-shadow:none}
html.fzt #gx-slots{right:var(--fz-pad);bottom:calc(var(--fz-pad) + clamp(98px,11.6vh,124px));gap:3px}
html.fzt #gx-slots .gx-s{width:clamp(50px,5.6vh,62px);height:clamp(38px,4.3vh,46px);border:0;border-radius:0;background:var(--fz-plate);box-shadow:inset 0 0 0 1px rgba(236,226,198,.16);clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)}
html.fzt #gx-slots .gx-s i{left:2px;top:2px;padding:0 3px;font:700 10px/12px 'Barlow Condensed','Arial Narrow',Arial,sans-serif;letter-spacing:.04em;color:#f4f0e6;background:rgba(236,226,198,.18);text-shadow:none}
html.fzt #gx-slots .gx-s b{right:4px;bottom:1px;font:700 13px/15px 'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-variant-numeric:tabular-nums}
html.fzt #gx-slots .gx-s.off{opacity:.38}
/* ---------- crosshair, hit and kill markers, screen markers ---------- */
html.fzt #hud [data-h="cross"] i,html.fzt #hud [data-h="cross"] b{box-shadow:0 0 0 1px rgba(0,0,0,.5);border-radius:1px}
html.fzt #hud [data-h="cross"] u{box-shadow:0 0 0 1px rgba(0,0,0,.42),inset 0 0 0 1px rgba(0,0,0,.42)}
html.fzt #hud [data-h="hit"]{--hc:#fff;width:32px;height:32px;margin:-16px;background:linear-gradient(45deg,transparent calc(50% - 1.2px),var(--hc) calc(50% - 1.2px) calc(50% + 1.2px),transparent calc(50% + 1.2px)),linear-gradient(-45deg,transparent calc(50% - 1.2px),var(--hc) calc(50% - 1.2px) calc(50% + 1.2px),transparent calc(50% + 1.2px));-webkit-mask:radial-gradient(circle,transparent 7.5px,#000 8px);mask:radial-gradient(circle,transparent 7.5px,#000 8px);filter:drop-shadow(0 0 1px rgba(0,0,0,.95))!important}
html.fzt #hud [data-h="hit"].fzt-hd{--hc:#ffb53c}
html.fzt #fzh .kc i{width:11px;height:11px;border-color:#ff4b36}
html.fzt #fzh .kc i:nth-child(1){left:-19px;top:-19px}html.fzt #fzh .kc i:nth-child(2){left:8px;top:-19px}html.fzt #fzh .kc i:nth-child(3){left:-19px;top:8px}html.fzt #fzh .kc i:nth-child(4){left:8px;top:8px}
html.fzt #fzh .kc.head i{border-color:#ffb53c}
html.fzt #hud .mk b{left:-9px;top:-9px;width:18px;height:18px;border-width:2px;background:rgba(8,10,9,.72);box-shadow:0 0 0 1px rgba(0,0,0,.45)}
html.fzt #hud .mk span{top:-9px;height:18px;line-height:18px;font-size:13px;font-weight:800;color:#fff;letter-spacing:0}
html.fzt #hud .mk.fzt-lg span{top:-32px;height:auto;line-height:1.1;font-size:15px;font-weight:700;letter-spacing:.08em;color:currentColor}
html.fzt #hud .mk small{top:13px;font-size:12px;font-weight:700;letter-spacing:.06em;color:#f4f0e6;font-variant-numeric:tabular-nums}
html.fzt #hud .mk.sm b{left:-3px;top:-3px;width:6px;height:6px;border-width:0;background:currentColor;box-shadow:0 0 0 1px rgba(0,0,0,.6)}
html.fzt #hud .mk.sm span{top:-22px;height:auto;line-height:1.1;font-size:13px;font-weight:600;color:currentColor;letter-spacing:.04em}
/* ---------- messages, prompts, progress ---------- */
html.fzt #hud [data-h="msg"]{top:29%;font-size:clamp(20px,3vh,32px);font-weight:700;letter-spacing:.22em;padding:2px 4px 2px calc(4px + .22em)}
html.fzt #hud [data-h="msg"]:before,html.fzt #hud [data-h="msg"]:after{content:"";position:absolute;top:50%;width:clamp(24px,4.5vw,64px);height:2px;margin-top:-1px;background:linear-gradient(90deg,transparent,currentColor)}
html.fzt #hud [data-h="msg"]:before{right:100%}
html.fzt #hud [data-h="msg"]:after{left:100%;transform:scaleX(-1)}
html.fzt #hud [data-h="prompt"],html.fzt #hud [data-h="loot"]{background:var(--fz-plate)!important;border:0!important;box-shadow:inset 3px 0 0 var(--fz-acc);padding:4px 16px 4px 15px!important;font-size:var(--fz-body)!important;letter-spacing:.04em;color:#fbf8f0!important}
html.fzt #hud [data-h="prog"]{font-size:var(--fz-micro);letter-spacing:.14em;text-transform:uppercase}
html.fzt #hud [data-h="prog"] i{height:5px;margin-top:5px;background:rgba(255,255,255,.14);box-shadow:0 0 0 1px rgba(0,0,0,.4)}
html.fzt #hud [data-h="prog"] u{background:var(--fz-acc)}
html.fzt #hud [data-h="hint"]{font-size:var(--fz-body);letter-spacing:.04em;background:linear-gradient(90deg,transparent,var(--fz-ink2) 15%,var(--fz-ink2) 85%,transparent);padding:2px 34px}
html.fzt #hud [data-h="spec"]{font-size:var(--fz-body);letter-spacing:.12em;background:var(--fz-plate);box-shadow:inset 0 -2px 0 var(--fz-acc);padding:3px 16px}
html.fzt #hud [data-h="lock"]{background:var(--fz-plate);border:0;box-shadow:inset 3px 0 0 var(--fz-acc);font-size:var(--fz-body)}
html.fzt #hud [data-h="board"]{background:linear-gradient(180deg,rgba(10,13,11,.9),rgba(10,13,11,.82));border:0;box-shadow:inset 0 2px 0 var(--fz-acc),0 10px 40px rgba(0,0,0,.4)}
html.fzt #hud [data-h="board"] h2{letter-spacing:.16em;font-size:20px}
html.fzt #hud [data-h="board"] th{letter-spacing:.16em;font-size:13px}
html.fzt #hud [data-h="board"] td{font-variant-numeric:tabular-nums}
/* ---------- spawn protection (engine-guard.js): same type and plate language, its own blue kept ---------- */
html.fzt #sg-hud b,html.fzt #sg-hud em{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:14px;letter-spacing:.14em}
html.fzt #sg-hud small{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:13px;letter-spacing:.03em}
html.fzt #sg-hud .r{border-radius:0;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
/* ---------- small screens ---------- */
@media(max-height:820px){html.fzt #hud{--fzd-h:15px;--fzd-f:13px}}
@media(max-width:760px){
 html.fzt #hud{--fz-pad:8px;--fz-map:92px;--fzc-w:min(60vw,320px);--fzc-h:24px;--fzd-h:14px;--fzd-f:12px}
 html.fzt #hud [data-h="top"]{width:max(var(--fz-map),118px)}
 html.fzt #hud [data-h="feed"]{top:calc(var(--fzc-top) + var(--fzc-h) + 26px);max-width:52vw;font-size:13px}
 html.fzt #hud [data-h="vit"]{width:40vw;padding:5px 9px 7px 11px}
 html.fzt #hud [data-h="wp"]{min-width:0;max-width:52vw;padding:5px 11px 7px 9px}
 html.fzt #hud [data-h="earn"]{top:40vh}
 html.fzt #hud [data-h="obj"]{font-size:12px}
}
@media(max-width:420px){html.fzt #hud .fzc{display:none}html.fzt #hud{--fz-obj-top:8px}}`;

const ICON = {
  k: '<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M.5 5h8.6" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 1 15.4 5 8.2 9Z" fill="currentColor"/></svg>',
  h: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 0v3.2M6 8.8V12M0 6h3.2M8.8 6H12" stroke="currentColor" stroke-width="1.4"/><circle cx="6" cy="6" r="1.3" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.2 1.2 8.8 8.8M8.8 1.2 1.2 8.8" stroke="currentColor" stroke-width="2"/></svg>',
};

export function install({ engine: E, settings, i18n, hudRoot }) {
  if (document.getElementById('fzt-style')) return null;
  const I = E && E.internals, hud = I && I.hud; if (!hud || !hud.el || !hud.api || !hudRoot) return null;
  const html = document.documentElement, el = hud.el, camera = I.camera, api = hud.api;
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const lang = () => (i18n && i18n.lang) || 'fr';
  const opts = { rotate: true, compass: true, minimap: true };
  const readOpts = () => { opts.rotate = settings.get('gameplay.minimapRotate') !== false; opts.compass = settings.get('gameplay.compass') !== false; opts.minimap = settings.get('gameplay.minimap') !== false; };
  readOpts();

  /* objective markers seen by the compass and the minimap (the HUD keeps its own private list) */
  const marks = [], byId = new Map();
  const setLg = e => { if (!e.el) return; const lg = !!(e.m && e.m.label && String(e.m.label).length > 2); if (e.lg !== lg) { e.lg = lg; e.el.classList.toggle('fzt-lg', lg); } };

  let compass = null, mini = null, mmFail = false;
  try { compass = createCompass({ root: hudRoot, lang }); } catch (e) { console.warn('[hud-theme] compass unavailable', e); compass = null; }
  try { mini = createMinimap({ hud, marks, opts }); } catch (e) { console.warn('[hud-theme] minimap unavailable', e); mini = null; }

  const st = document.createElement('style'); st.id = 'fzt-style'; st.textContent = CSS; document.head.append(st);
  const magBar = document.createElement('i'); magBar.className = 'fzt-mag'; magBar.innerHTML = '<u></u>'; el.wp.appendChild(magBar);
  const magU = magBar.firstChild, MAG = []; for (let i = 0; i <= 100; i++) MAG.push('scaleX(' + (i / 100) + ')');
  const tpl = {}; for (const k of Object.keys(ICON)) { const s = document.createElement('i'); s.className = 'fzk ' + k; s.innerHTML = ICON[k]; tpl[k] = s; }
  const sL = el.sL, sR = el.sR;

  const guard = (obj, key, after) => { const f = obj[key]; if (typeof f !== 'function') return; obj[key] = function (a, b, c, d, e, g) { const r = f.call(this, a, b, c, d, e, g); try { after(a, b, c, d, e, g); } catch (x) { console.warn('[hud-theme]', key, x); } return r; }; };
  const flag = (node, cls, on) => { const k = '_fzt' + cls; if (node[k] !== on) { node[k] = on; node.classList.toggle(cls, on); } };

  /* markers: keep a list, mark long labels (the bomb) so their text stays above the diamond */
  {
    const f = api.marker;
    api.marker = function (id, m) {
      const had = byId.get(id), r = f.call(this, id, m);
      try {
        if (!m) { if (had) { byId.delete(id); const i = marks.indexOf(had); if (i >= 0) marks.splice(i, 1); } }
        else if (!had) { const e = { id, m, el: el.markers.lastElementChild, lg: false }; byId.set(id, e); if (!m.small) marks.push(e); setLg(e); }
        else { had.m = m; const i = marks.indexOf(had); if (m.small && i >= 0) marks.splice(i, 1); else if (!m.small && i < 0) marks.push(had); setLg(had); }
      } catch (x) { console.warn('[hud-theme] marker', x); }
      return r;
    };
  }
  guard(hud, 'reset', () => { byId.clear(); marks.length = 0; if (compass) compass.clear(); });
  let tcL = null, tcR = null;
  guard(api, 'set', o => {
    if (!o) return;
    if ('left' in o && o.left) { const c = o.left.color || ''; if (c !== tcL) { tcL = c; sL.style.setProperty('--tc', c || '#f4f0e6'); } }
    if ('right' in o && o.right) { const c = o.right.color || ''; if (c !== tcR) { tcR = c; sR.style.setProperty('--tc', c || '#f4f0e6'); } }
  });
  guard(hud, 'vitals', (hp, maxHp, armor, maxArmor, cls, alive) => flag(el.vit, 'fzt-low', !!alive && hp > 0 && hp < (maxHp || 100) * 0.3));
  let magQ = -1;
  guard(hud, 'weapon', (ammo, mag) => {
    const num = typeof ammo === 'number' && mag > 0; flag(el.wp, 'fzt-melee', !num);
    if (!num) return;
    const q = Math.max(0, Math.min(100, Math.round(ammo / mag * 100))); if (q !== magQ) { magQ = q; magU.style.transform = MAG[q]; }
    flag(el.wp, 'fzt-lowam', mag > 1 && ammo <= mag * 0.2);
  });
  guard(hud, 'hitMarker', head => flag(el.hit, 'fzt-hd', !!head));
  guard(hud, 'feedKill', (killer, victim, head) => {
    const d = el.feed.firstElementChild; if (!d) return;
    for (const n of d.childNodes) if (n.nodeType === 3) { n.replaceWith(tpl[!killer ? 'x' : head ? 'h' : 'k'].cloneNode(true)); break; }
  });

  /* minimap: same canvas, new drawing; the classic one comes back if this one ever throws */
  const orig = { setMap: hud.setMap, drawMap: hud.drawMap };
  let lastSol = null, lastSize = 0;
  function fallback(e) {
    if (mmFail) return; mmFail = true; console.warn('[hud-theme] minimap failed, classic minimap back', e);
    try { html.classList.add('fzt-mmfail'); html.classList.remove('fzt-nomap'); if (mini) mini.el.remove(); if (lastSol) orig.setMap.call(hud, lastSol, lastSize); } catch { /* keep going */ }
  }
  if (mini) {
    hud.setMap = function (solids, size) { lastSol = solids; lastSize = size; if (mmFail) return orig.setMap.call(this, solids, size); try { mini.setMap(solids, size); } catch (e) { fallback(e); } };
    hud.drawMap = function (player, actors, classify) {
      if (mmFail) return orig.drawMap.call(this, player, actors, classify);
      try {
        mini.show(opts.minimap); flag(html, 'fzt-nomap', !opts.minimap); if (!opts.minimap) return;
        const m = camera.matrixWorld.elements, heading = Math.atan2(m[2], m[0]), alive = player && player.alive;
        const hfov = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * (camera.aspect || 1.78));
        mini.draw(player, actors, classify, heading, alive ? player.pos.x : camera.position.x, alive ? player.pos.z : camera.position.z, hfov);
      } catch (e) { fallback(e); }
    };
    try { if (E.world && E.world.solids && E.world.size) { lastSol = E.world.solids; lastSize = E.world.size; mini.setMap(E.world.solids, E.world.size); } } catch (e) { fallback(e); }
  }

  /* compass: every frame, from the camera (follows the spectated soldier too) */
  let cFail = false;
  if (compass) E.on('tick', () => {
    if (cFail) return;
    try {
      if (!opts.compass) return;
      const m = camera.matrixWorld.elements, P = E.player, alive = P && P.alive;
      compass.update(Math.atan2(m[2], m[0]), alive ? P.pos.x : camera.position.x, alive ? P.pos.z : camera.position.z, marks);
    } catch (e) { cFail = true; console.warn('[hud-theme] compass failed', e); try { compass.show(false); } catch { /* gone */ } }
  });

  const refresh = () => {
    readOpts();
    html.classList.toggle('fzt-rm', !!settings.get('gameplay.reducedMotion') || mq.matches);
    if (compass && !cFail) compass.show(opts.compass); html.classList.toggle('fzt-nocompass', !opts.compass || !compass || cFail);
    if (mini && !mmFail) { mini.show(opts.minimap); html.classList.toggle('fzt-nomap', !opts.minimap); }
  };
  refresh();
  settings.on('change', p => { if (typeof p === 'string' && (p.startsWith('gameplay.') || p === 'language')) refresh(); });
  if (mq.addEventListener) mq.addEventListener('change', refresh);
  if (i18n && i18n.on) i18n.on('change', () => { try { if (compass) compass.relabel(); } catch { /* labels stay */ } });
  addEventListener('resize', () => { if (compass) compass.invalidate(); if (mini) mini.invalidate(); });
  html.classList.add('fzt'); if (mini) html.classList.add('fzt-mm');
  const out = { compass, mini, marks, opts, v2: null, get failed() { return { minimap: mmFail, compass: cFail }; } };
  try { if (window.__fz) window.__fz.hudTheme = out; } catch { /* dev only */ }
  /* HUD v2 (the dev notes): second pass loaded on top of this one unless ?hud=v1. If it fails, this HUD stays as it is. */
  let q = ''; try { q = new URLSearchParams(location.search).get('hud') || ''; } catch { /* default */ }
  if (q !== 'v1') import('./hud-v2.js').then(m => { out.v2 = m.install({ engine: E, settings, i18n, hudRoot, theme: out }); if (compass) compass.invalidate(); if (mini) mini.invalidate(); })
    .catch(e => { console.warn('[hud-theme] hud v2 unavailable', e); try { html.classList.remove('fz2'); opts.v2 = false; } catch { /* v1 stays */ } });
  return out;
}
