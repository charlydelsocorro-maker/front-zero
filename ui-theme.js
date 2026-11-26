// FRONT ZÉRO — menus v2: the in-match HUD's panel language (hud-v2.js) carried to the menus, the lobby, the end screens
// (menu.js and match-flow.js), the settings screen (settings.js) and the chrome of the shop and the season pass (shop-ui.js,
// pass-ui.js). Loaded by main.js (?ui=v1 skips it). It only adds a style sheet under html.fz2ui and, after each menu render,
// a few nodes the menu does not have (mode pictures, profile emblem, pass and shop entries); menu.js and the other modules are not
// edited. A failure here leaves the menus as they were. Nothing runs during a match (the observer only sees menu renders).

/* ONE SWITCH for phases 2 and 3 (menus, lobby, end screens, settings, shop and pass chrome): false = this module does nothing and every
   menu keeps its v1 look; the in-match HUD v2 (hud-v2.js) does not depend on it. At run time ?ui=v1 does the same (main.js). */
export const MENUS_V2 = true;
const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const TX = {
  play: ['JOUER', 'PLAY', 'JUGAR', 'SPIELEN', 'JOGAR', 'GIOCA'],
  shopSub: ['Nouveautés de la semaine', 'This week’s new items', 'Novedades de la semana', 'Neu diese Woche', 'Novidades da semana', 'Novità della settimana'],
  claim: ['{n} à récupérer', '{n} to claim', '{n} por recoger', '{n} abholbereit', '{n} por recolher', '{n} da riscattare'],
};
/* the picture behind each mode card (map-shots/) */
const MODE_SHOT = { ffa: 'depot', tdm: 'vieille-ville', dom: 'bunker', bomb: 'port', zombie: 'noirval', zone: 'valferrade', zone2: 'valferrade', zone3: 'valferrade', zone4: 'valferrade' };       // Zone Duo / Trio / Quatuor: the Zone picture

const CSS = (u) => `
html.fz2ui .fzm,html.fz2ui .fzf,html.fz2ui .fzs,html.fz2ui .fzp{--hair:rgba(236,226,198,.17);--hair2:rgba(236,226,198,.36);--cut:12px;--tick:22px}
html.fz2ui .fzm{--line:rgba(236,226,198,.15);--line-2:rgba(236,226,198,.32);--panel:linear-gradient(180deg,rgba(26,30,24,.92),rgba(14,16,13,.9))}
/* ---------- the shared panel: cut corner, hairline, inner gradient, accent tick ---------- */
html.fz2ui :is(.fzm-panel,.fzm-reward,.fzm-team,.fzm-end-stat,.fzm-slot,.fzm-dialog,.fzf-rew,.fzf-board,.fzf-stat,.fzs:not([data-fid]) .fzs-group,.fzp-card,.fzs-dbox,.fzp-dbox){
 border:1px solid var(--hair);
 background:linear-gradient(#f0ae2e,#f0ae2e) 0 0/var(--tick) 2px no-repeat border-box,
  linear-gradient(to top left,transparent calc(50% - .75px),var(--hair2) calc(50% - .75px) calc(50% + .75px),transparent calc(50% + .75px)) 100% 100%/var(--cut) var(--cut) no-repeat border-box,
  linear-gradient(180deg,rgba(28,32,26,.94),rgba(13,15,12,.92));
 clip-path:polygon(0 0,100% 0,100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,0 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
html.fz2ui :is(.fzm-end-stat,.fzf-stat,.fzm-slot){--cut:9px;--tick:14px}
/* ---------- top bar: logo mark, tabs, profile chip ---------- */
html.fz2ui .fzm-top{min-height:76px;background:linear-gradient(180deg,rgba(6,8,6,.82),rgba(10,12,9,.62));border-bottom:1px solid var(--line);box-shadow:0 1px 0 rgba(0,0,0,.5),0 10px 30px rgba(0,0,0,.18)}
html.fz2ui .fzm-logo{display:flex;align-items:center;gap:12px}
html.fz2ui .fzm-logo::before{content:"";flex:none;width:30px;height:30px;background:linear-gradient(135deg,#ffcf6a,#e39d22);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%,22% 50%,50% 78%,78% 50%,50% 22%,22% 50%,0 50%);filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}
html.fz2ui .fzm-tab{font-weight:700;letter-spacing:.12em}
html.fz2ui .fzm-tab[aria-current=page]{color:#fff;background:linear-gradient(180deg,transparent 30%,rgba(240,174,46,.12))}
html.fz2ui .fzm-tab::after{height:3px;left:14px;right:14px}
html.fz2ui .fzm-id{gap:10px}
html.fz2ui .fzm-rank{position:relative;flex:0 1 230px;padding:6px 14px 7px 58px;border:1px solid var(--hair);background:linear-gradient(180deg,rgba(28,32,26,.9),rgba(12,14,11,.9));clip-path:polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%);gap:4px}
html.fz2ui .fz2-emb{position:absolute;left:8px;top:50%;width:40px;height:44px;margin-top:-22px;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#ffd27a,#d98f1c);clip-path:polygon(50% 0,100% 24%,100% 76%,50% 100%,0 76%,0 24%);color:#17140a;font-weight:800;font-size:20px;line-height:1;font-variant-numeric:tabular-nums}
html.fz2ui .fz2-emb::before{content:"";position:absolute;inset:3px;background:linear-gradient(160deg,#2a2412,#15120a);clip-path:polygon(50% 0,100% 24%,100% 76%,50% 100%,0 76%,0 24%)}
html.fz2ui .fz2-emb b{position:relative;color:#ffd27a;font-weight:800;font-size:21px;margin-top:4px}
html.fz2ui .fz2-emb i{position:absolute;left:50%;top:6px;width:16px;height:3px;margin-left:-8px;background:#ffd27a;clip-path:polygon(0 0,50% 100%,100% 0,100% 100%,0 100%);opacity:.9}
html.fz2ui .fzm-rank-line b{font-size:16px}
html.fz2ui .fzm-xp{height:5px;background:rgba(255,255,255,.1)}
html.fz2ui .fzm-xp i{background:linear-gradient(90deg,#e39d22,#ffd27a)}
html.fz2ui .fzm-cr{height:52px;padding:0 16px 0 14px;border:1px solid var(--hair);background:linear-gradient(180deg,rgba(28,32,26,.9),rgba(12,14,11,.9));align-items:center;box-shadow:inset 3px 0 0 #f0ae2e;clip-path:polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%)}
html.fz2ui .fzm-cr b{font-size:27px;font-weight:800}
/* ---------- home: mode cards with their picture, play block, pass and shop entries ---------- */
html.fz2ui .fzm-play-head{justify-content:space-between}
html.fz2ui .fzm-seg{border-color:var(--hair2);background:rgba(8,10,7,.55)}
html.fz2ui .fzm-seg--big button{min-height:56px}
html.fz2ui .fzm-h{letter-spacing:.2em}
html.fz2ui .fzm-opt{min-height:96px;padding:14px 16px 15px 20px;border-color:var(--hair);background:linear-gradient(90deg,rgba(11,13,10,.96) 30%,rgba(11,13,10,.62) 66%,rgba(11,13,10,.3)),var(--shot,none) 70% 50%/cover no-repeat,#15180f;clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}
html.fz2ui .fzm-opt:hover{border-color:var(--hair2);background:linear-gradient(90deg,rgba(11,13,10,.95) 30%,rgba(11,13,10,.6) 70%,rgba(11,13,10,.3)),var(--shot,none) 70% 50%/cover no-repeat,#15180f}
html.fz2ui .fzm-opt[aria-checked=true]{border-color:#f0ae2e;background:linear-gradient(90deg,rgba(30,24,10,.95) 30%,rgba(30,24,10,.55) 70%,rgba(30,24,10,.2)),var(--shot,none) 70% 50%/cover no-repeat,#15180f}
html.fz2ui .fzm-opt-name{font-size:25px;font-weight:800;text-shadow:0 2px 8px rgba(0,0,0,.6)}
html.fz2ui .fzm-opt-desc{max-width:78%;color:#c9c2ab;text-shadow:0 1px 4px rgba(0,0,0,.8)}
html.fz2ui .fzm-opt .fzm-tag{background:rgba(8,10,7,.7)}
${Object.keys(MODE_SHOT).map(m => `html.fz2ui .fzm-opt[data-fid="mode:${m}"]{--shot:url("${u('map-shots/' + MODE_SHOT[m] + '.webp')}")}`).join('\n')}
html.fz2ui .fzm-map{border-color:var(--hair);clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}
html.fz2ui .fzm-map[aria-checked=true]{box-shadow:inset 0 0 0 1px #f0ae2e;border-color:#f0ae2e}
html.fz2ui .fzm-map-body{background:linear-gradient(180deg,rgba(20,23,18,.95),rgba(12,14,11,.95))}
html.fz2ui .fzm-side .fzm-panel{padding:0 18px 18px;gap:15px}
html.fz2ui .fzm-side .fzm-panel>.fzm-h{margin:16px 0 0}
html.fz2ui .fzm-side .fzm-sum{grid-template-columns:minmax(0,1fr);gap:0;margin:0 -18px;position:relative}
html.fz2ui .fzm-side .fzm-sum .fzm-thumb{grid-area:1/1;aspect-ratio:16/8;border:0;border-top:1px solid var(--hair);border-bottom:1px solid var(--hair)}
html.fz2ui .fzm-side .fzm-sum .fzm-thumb::after{background:linear-gradient(180deg,rgba(8,10,7,0) 30%,rgba(8,10,7,.9))}
html.fz2ui .fzm-side .fzm-sum>div{grid-area:1/1;align-self:end;position:relative;z-index:1;padding:0 18px 12px}
html.fz2ui .fzm-side .fzm-sum-map{font-size:32px;font-weight:800;letter-spacing:.02em;text-shadow:0 2px 10px rgba(0,0,0,.7)}
html.fz2ui .fzm-side .fzm-sum-mode{font-size:16px;letter-spacing:.14em;text-shadow:0 1px 4px rgba(0,0,0,.8)}
html.fz2ui .fzm-side .fzm-sum-desc{padding:12px 18px 0}
html.fz2ui .fzm-cta{min-height:78px;font-size:34px;letter-spacing:.16em}
html.fz2ui .fzm-cta>span::after{content:"";display:inline-block;width:.42em;height:.42em;margin:0 0 .08em .42em;border-right:.13em solid currentColor;border-top:.13em solid currentColor;transform:rotate(45deg);vertical-align:middle}
html.fz2ui .fzm-btn--primary::before,html.fz2ui .fzm-btn--primary::after{background:linear-gradient(180deg,#ffc650,#e5a024)}
html.fz2ui .fzm-btn--primary:hover:not(:disabled)::before,html.fz2ui .fzm-btn--primary:hover:not(:disabled)::after{background:linear-gradient(180deg,#ffd77a,#f0ae2e)}
html.fz2ui .fz2-entries{display:flex;flex-wrap:wrap;gap:10px;margin-left:auto}
html.fz2ui .fz2-ent{position:relative;display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 40px 6px 10px;text-align:left;color:#f4ecd8;border:1px solid var(--hair);background:linear-gradient(180deg,rgba(28,32,26,.94),rgba(13,15,12,.92));clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);cursor:pointer;transition:border-color .12s,background .12s}
html.fz2ui .fz2-ent:hover{border-color:#f0ae2e;background:linear-gradient(180deg,rgba(48,40,18,.94),rgba(20,18,10,.92))}
html.fz2ui .fz2-ent::after{content:"";position:absolute;right:16px;top:50%;width:9px;height:9px;margin-top:-5px;border-right:2px solid #f0ae2e;border-top:2px solid #f0ae2e;transform:rotate(45deg)}
html.fz2ui .fz2-ent>i{flex:none;display:flex;align-items:center;justify-content:center;width:40px;height:40px;color:#17140a;background:linear-gradient(160deg,#ffd27a,#d98f1c);clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)}
html.fz2ui .fz2-ent>i svg{width:24px;height:24px}
html.fz2ui .fz2-ent b{display:block;font-size:19px;font-weight:800;letter-spacing:.12em;line-height:1.05}
html.fz2ui .fz2-ent small{display:block;font-size:14px;font-weight:600;letter-spacing:.06em;color:#bdb59c;white-space:nowrap}
html.fz2ui .fz2-ent em{display:inline-block;margin-left:8px;height:16px;padding:0 6px;font-style:normal;font-size:11px;font-weight:800;letter-spacing:.06em;line-height:16px;vertical-align:1px;color:#17140a;background:#9cc264}
/* ---------- lobby ---------- */
html.fz2ui .fzm-team-head{background:linear-gradient(180deg,rgba(255,255,255,.04),transparent);letter-spacing:.14em}
html.fz2ui .fzm-team--a .fzm-team-head{box-shadow:inset 4px 0 #4aa3ff}
html.fz2ui .fzm-team--b .fzm-team-head{box-shadow:inset 4px 0 #ff5a4a}
html.fz2ui .fzm-player{border-top-color:var(--hair)}
html.fz2ui .fzm-dot{width:9px;height:9px;transform:rotate(45deg)}
html.fz2ui .fzm-player.is-ready .fzm-dot{box-shadow:0 0 8px rgba(156,194,100,.7)}
html.fz2ui .fzm-code-val{font-variant-numeric:tabular-nums;text-shadow:0 2px 12px rgba(240,174,46,.25)}
html.fz2ui .fzm-callout{border-left-color:#f0ae2e;background:linear-gradient(90deg,rgba(240,174,46,.14),rgba(240,174,46,.03))}
html.fz2ui .fzm-input,html.fz2ui .fzm-select{border-color:var(--hair2);background:rgba(6,8,5,.6)}
/* ---------- end of match (solo) ---------- */
html.fz2ui .fzm-end{background:radial-gradient(900px 420px at 50% 22%,rgba(240,174,46,.09),transparent 70%)}
html.fz2ui .fzm-end.is-lost{background:radial-gradient(900px 420px at 50% 22%,rgba(236,128,104,.08),transparent 70%)}
html.fz2ui .fzm-end-eyebrow{display:flex;align-items:center;gap:14px;letter-spacing:.26em}
html.fz2ui .fzm-end-eyebrow::before,html.fz2ui .fzm-end-eyebrow::after{content:"";width:44px;height:2px;background:linear-gradient(90deg,transparent,#f0ae2e)}
html.fz2ui .fzm-end-eyebrow::after{transform:scaleX(-1)}
html.fz2ui .fzm-end-title{text-shadow:0 6px 30px rgba(0,0,0,.5);letter-spacing:.03em}
html.fz2ui .fzm-end-state{border:0;padding:4px 18px;background:rgba(255,255,255,.06);box-shadow:inset 0 -2px 0 currentColor}
html.fz2ui .fzm-end-stat{padding:12px 18px 14px}
html.fz2ui .fzm-end-stat b{font-size:44px}
html.fz2ui .fzm-reward{padding:18px 22px 20px}
html.fz2ui .fzm-gain b{font-size:42px;text-shadow:0 2px 14px rgba(240,174,46,.22)}
html.fz2ui .fzm-lvl-bar{height:8px;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(0,0,0,.3)}
html.fz2ui .fzm-lvl-bar i{background:linear-gradient(90deg,#e39d22,#ffd27a)}
html.fz2ui .fzm-levelup{clip-path:polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%);background:linear-gradient(180deg,#ffc650,#e5a024)}
/* ---------- end of match (online flow) ---------- */
html.fz2ui .fzf{--panel:rgba(20,23,18,.94);--line:rgba(236,226,198,.15);--line-2:rgba(236,226,198,.32)}
html.fz2ui .fzf-head{border-bottom:1px solid var(--line);background:linear-gradient(180deg,rgba(6,8,6,.7),transparent)}
html.fz2ui .fzf-eyebrow{letter-spacing:.24em}
html.fz2ui .fzf-clock b{min-width:2.2ch;padding:2px 12px;background:rgba(8,10,7,.7);border:1px solid var(--hair);box-shadow:inset 0 -2px 0 #f0ae2e}
html.fz2ui .fzf-title{text-shadow:0 6px 30px rgba(0,0,0,.5)}
html.fz2ui .fzf-board h2{color:#f0ae2e;letter-spacing:.2em}
html.fz2ui .fzf-table tr.is-me td{background:linear-gradient(90deg,rgba(240,174,46,.2),rgba(240,174,46,.06))}
html.fz2ui .fzf-table tr.is-me td:first-child{box-shadow:inset 3px 0 0 #f0ae2e}
html.fz2ui .fzf-team{transform:rotate(45deg)}
html.fz2ui .fzf-card{border:1px solid var(--hair);clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}
html.fz2ui .fzf-card.is-mine{border-color:#f0ae2e;box-shadow:inset 0 0 0 1px #f0ae2e;background:linear-gradient(180deg,rgba(54,42,16,.94),rgba(24,20,10,.94))}
html.fz2ui .fzf-meter{height:6px}
html.fz2ui .fzf-meter i{background:linear-gradient(90deg,#e39d22,#ffd27a)}
html.fz2ui .fzf-btn{clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);border-color:var(--hair2)}
html.fz2ui .fzf-btn--main{background:linear-gradient(180deg,#ffc650,#e5a024);border-color:#f0ae2e}
html.fz2ui .fzf-foot{background:linear-gradient(180deg,rgba(8,10,6,.5),rgba(8,10,6,.85))}
html.fz2ui .fzf-win-text small{display:flex;align-items:center;gap:12px}
html.fz2ui .fzf-win-text small::before{content:"";width:36px;height:2px;background:#f0ae2e}
/* ---------- shop chrome (shop-ui.js): header, tabs, filters, cards, buttons; the showcase (.fzs-view) is left as it is ---------- */
html.fz2ui [data-fid="shop:screen"] .fzs-top,html.fz2ui .fzp-top{min-height:72px;padding-top:10px;padding-bottom:10px;background:linear-gradient(180deg,rgba(6,8,6,.82),rgba(10,12,9,.6));border-bottom:1px solid rgba(236,226,198,.15);box-shadow:0 1px 0 rgba(0,0,0,.5),0 10px 30px rgba(0,0,0,.16)}
html.fz2ui [data-fid="shop:screen"] .fzs-top h2,html.fz2ui .fzp-brand h2{display:flex;align-items:center;gap:12px;letter-spacing:.12em}
html.fz2ui [data-fid="shop:screen"] .fzs-top h2::before,html.fz2ui .fzp-brand h2::before{content:"";flex:none;width:26px;height:26px;background:linear-gradient(135deg,#ffcf6a,#e39d22);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%,22% 50%,50% 78%,78% 50%,50% 22%,22% 50%,0 50%)}
html.fz2ui .fzp-brand h2::before{background:linear-gradient(135deg,#f2a04a,#e8692c)}
html.fz2ui [data-fid="shop:screen"] .fzs-tab{position:relative;letter-spacing:.12em;border-bottom:0}
html.fz2ui [data-fid="shop:screen"] .fzs-tab::after{content:"";position:absolute;left:12px;right:12px;bottom:-1px;height:3px;background:#f0ae2e;transform:scaleX(0);transform-origin:left;transition:transform .16s ease-out}
html.fz2ui [data-fid="shop:screen"] .fzs-tab[aria-selected=true]{background:linear-gradient(180deg,transparent 30%,rgba(240,174,46,.12))}
html.fz2ui [data-fid="shop:screen"] .fzs-tab[aria-selected=true]::after{transform:scaleX(1)}
html.fz2ui :is([data-fid="shop:screen"] .fzs-cr,.fzp-bal){padding:4px 14px 5px;border:1px solid rgba(236,226,198,.16);background:linear-gradient(180deg,rgba(28,32,26,.9),rgba(12,14,11,.9));box-shadow:inset 3px 0 0 #f0ae2e;clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)}
html.fz2ui [data-fid="shop:screen"] .fzs-lvl{border-color:rgba(236,226,198,.3);clip-path:polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)}
html.fz2ui :is([data-fid="shop:screen"] .fzs-back,.fzp-close){border-color:rgba(236,226,198,.32);background:linear-gradient(180deg,rgba(32,36,29,.95),rgba(15,17,13,.95));clip-path:polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%);letter-spacing:.12em}
html.fz2ui :is([data-fid="shop:screen"] .fzs-back,.fzp-close):hover{border-color:#f0ae2e;background:linear-gradient(180deg,rgba(60,48,20,.95),rgba(24,20,10,.95))}
html.fz2ui :is([data-fid="shop:screen"] .fzs-test,.fzp-test){background:linear-gradient(90deg,rgba(240,174,46,.16),rgba(240,174,46,.03));box-shadow:inset 3px 0 0 #f0ae2e}
html.fz2ui [data-fid="shop:screen"] .fzs-chip{clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%);letter-spacing:.06em}
html.fz2ui [data-fid="shop:screen"] .fzs-chip[aria-pressed=true]{background:linear-gradient(180deg,rgba(240,174,46,.24),rgba(240,174,46,.1))}
html.fz2ui [data-fid="shop:screen"] .fzs-card{background:linear-gradient(180deg,rgba(28,32,26,.95),rgba(15,17,13,.95));clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}
html.fz2ui [data-fid="shop:screen"] .fzs-card:hover{background:linear-gradient(180deg,rgba(36,40,32,.95),rgba(19,21,16,.95))}
html.fz2ui [data-fid="shop:screen"] .fzs-card[aria-pressed=true]{background:linear-gradient(180deg,rgba(50,42,20,.96),rgba(22,19,11,.96))}
html.fz2ui [data-fid="shop:screen"] .fzs-week{clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);border-left-width:4px}
html.fz2ui [data-fid="shop:screen"] .fzs-flag{clip-path:polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%);padding-right:14px}
html.fz2ui :is([data-fid="shop:screen"] .fzs-btn,.fzp-btn){border-color:rgba(236,226,198,.32);clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);letter-spacing:.1em}
html.fz2ui [data-fid="shop:screen"] .fzs-btn.pri{background:linear-gradient(180deg,#ffc650,#e5a024);border-color:#f0ae2e}
html.fz2ui [data-fid="shop:screen"] .fzs-btn.pri:hover:not([disabled]){background:linear-gradient(180deg,#ffd77a,#f0ae2e)}
html.fz2ui .fzp-btn.pri{background:linear-gradient(180deg,#f48a4c,#e0601f)}
html.fz2ui [data-fid="shop:screen"] .fzs-target select{border-color:rgba(236,226,198,.32);background:rgba(6,8,5,.7)}
html.fz2ui [data-fid="shop:screen"] .fzs-detail,html.fz2ui .fzp-detail{background:linear-gradient(90deg,rgba(6,8,6,.45),rgba(13,15,11,.55))}
/* ---------- season pass chrome (pass-ui.js): same panels and buttons, the season colours kept ---------- */
html.fz2ui .fzp-card{--tick:18px}
html.fz2ui .fzp-hero{border-color:rgba(232,105,44,.45)!important;background:linear-gradient(#e8692c,#e8692c) 0 0/24px 2px no-repeat border-box,linear-gradient(160deg,rgba(90,58,110,.55),rgba(20,16,14,.92) 55%),linear-gradient(0deg,rgba(232,105,44,.25),transparent)!important}
html.fz2ui .fzp-clock{clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%);border-color:rgba(236,226,198,.3)}
html.fz2ui .fzp-rw{background:linear-gradient(180deg,rgba(32,35,28,.95),rgba(18,19,15,.95))}
html.fz2ui .fzp-rw.is-claim{background:linear-gradient(90deg,rgba(232,105,44,.26),rgba(22,20,16,.95) 70%)}
html.fz2ui .fzp-ct{clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)}
html.fz2ui .fzp-lhead{background:linear-gradient(180deg,#0d0f0b,#10120d)}
/* ---------- settings ---------- */
html.fz2ui .fzs:not([data-fid]){--fzs-line:rgba(236,226,198,.15);--fzs-panel:rgba(20,23,18,.9)}
html.fz2ui .fzs:not([data-fid]) .fzs-head{display:flex;align-items:center;gap:14px;padding:20px 30px 14px;background:linear-gradient(180deg,rgba(6,8,6,.6),transparent)}
html.fz2ui .fzs:not([data-fid]) .fzs-head::before{content:"";width:6px;height:28px;background:linear-gradient(180deg,#ffc650,#e5a024);clip-path:polygon(0 0,100% 0,100% 100%,0 calc(100% - 6px))}
html.fz2ui .fzs:not([data-fid]) .fzs-title{font-size:30px;letter-spacing:.14em}
html.fz2ui .fzs:not([data-fid]) .fzs-tabs{width:220px;padding:14px 10px 14px 0;gap:4px;background:linear-gradient(90deg,rgba(6,8,6,.45),transparent)}
html.fz2ui .fzs:not([data-fid]) .fzs-tab{position:relative;min-height:46px;padding:8px 18px 8px 26px;font-weight:700;letter-spacing:.1em;border-left:0;clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)}
html.fz2ui .fzs:not([data-fid]) .fzs-tab[aria-selected="true"]{color:#fff;background:linear-gradient(90deg,rgba(240,174,46,.2),rgba(240,174,46,.04));box-shadow:inset 3px 0 0 #f0ae2e}
html.fz2ui .fzs:not([data-fid]) .fzs-panel{padding:22px 32px 32px}
html.fz2ui .fzs:not([data-fid]) .fzs-inner{max-width:820px}
html.fz2ui .fzs:not([data-fid]) .fzs-h{display:flex;align-items:center;gap:10px;margin:26px 0 10px;letter-spacing:.2em;font-size:15px}
html.fz2ui .fzs:not([data-fid]) .fzs-h::before{content:"";width:8px;height:8px;background:#f0ae2e;transform:rotate(45deg)}
html.fz2ui .fzs:not([data-fid]) .fzs-h::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--fzs-line),transparent)}
html.fz2ui .fzs:not([data-fid]) .fzs-row{min-height:52px;padding:7px 16px;border-top-color:rgba(236,226,198,.08)}
html.fz2ui .fzs:not([data-fid]) .fzs-row:hover{background:rgba(255,255,255,.025)}
html.fz2ui .fzs:not([data-fid]) .fzs-switch i{width:48px;height:24px;border-color:var(--hair2);clip-path:polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)}
html.fz2ui .fzs:not([data-fid]) .fzs-switch i::after{background:#e9e1c9}
html.fz2ui .fzs:not([data-fid]) .fzs-switch input:checked+i{background:linear-gradient(180deg,#ffc650,#e5a024)}
html.fz2ui .fzs:not([data-fid]) .fzs-key{text-align:center;border-color:var(--hair2);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.25));box-shadow:inset 0 -2px 0 rgba(0,0,0,.45);border-radius:3px}
html.fz2ui .fzs:not([data-fid]) .fzs-radio span{border-color:var(--hair);clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)}
html.fz2ui .fzs:not([data-fid]) .fzs-radio input:checked+span{background:linear-gradient(180deg,#ffc650,#e5a024)}
html.fz2ui .fzs:not([data-fid]) .fzs-ctl select{border-color:var(--hair2);background:rgba(6,8,5,.7)}
html.fz2ui .fzs:not([data-fid]) .fzs-reset,html.fz2ui .fzs:not([data-fid]) .fzs-mini{border-color:var(--hair2);clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)}
html.fz2ui .fzs:not([data-fid]) .fzs-status{background:linear-gradient(90deg,rgba(240,174,46,.1),rgba(0,0,0,.25))}
@media (max-width:1120px){html.fz2ui .fz2-entries{margin-left:0}}
/* the mission panel never runs under the sticky DÉPLOYER: capped to the room left above the button (it scrolls inside if a long
   language or the multiplayer form still needs more), and a compact header below 840 px of height */
@media (min-width:1181px){html.fz2ui .fzm-side>.fzm-panel{max-height:calc(100vh - 80px - clamp(16px,2.2vw,34px) - 58px - clamp(16px,1.8vw,26px) - 104px);overflow:hidden auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(236,226,198,.3) transparent}}
@media (min-width:1181px) and (max-height:840px){
html.fz2ui .fzm-side .fzm-panel{gap:10px;padding-bottom:14px}
html.fz2ui .fzm-side .fzm-panel>.fzm-h{margin-top:12px}
html.fz2ui .fzm-side .fzm-sum .fzm-thumb{aspect-ratio:16/3}
html.fz2ui .fzm-side .fzm-sum-map{font-size:22px}
html.fz2ui .fzm-side .fzm-sum-mode{font-size:13px}
html.fz2ui .fzm-side .fzm-sum>div{padding-bottom:7px}
html.fz2ui .fzm-side .fzm-field{gap:6px}
html.fz2ui .fzm-side .fzm-step{grid-template-columns:38px minmax(0,1fr) 38px}
html.fz2ui .fzm-side .fzm-step button{height:38px}
html.fz2ui .fzm-side .fzm-seg button{min-height:38px}
html.fz2ui .fzm-side .fzm-load{padding-top:10px}
html.fz2ui .fzm-cta{min-height:58px;font-size:27px}}
@media (max-height:840px){html.fz2ui .fz2-ent{min-height:48px;padding-top:4px;padding-bottom:4px}html.fz2ui .fz2-ent>i{width:34px;height:34px}}
@media (max-width:720px){html.fz2ui .fzs:not([data-fid]) .fzs-tabs{width:100%;padding:0 8px;background:none}html.fz2ui .fzs:not([data-fid]) .fzs-tab{clip-path:none}html.fz2ui .fzs:not([data-fid]) .fzs-tab[aria-selected="true"]{box-shadow:inset 0 -3px 0 #f0ae2e}}
@media (max-width:760px){html.fz2ui .fzm-opt-desc{max-width:none}html.fz2ui .fz2-ent{flex:1 1 200px}}
@media (max-width:520px){html.fz2ui .fzm-rank{padding-left:50px}html.fz2ui .fz2-emb{width:34px;height:38px;margin-top:-19px;font-size:17px}}`;

const ICON = {
  pass: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16v6l-3 3 3 3v6H4v-6l3-3-3-3Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 8h6M9 12h6M9 16h6" stroke="currentColor" stroke-width="1.8"/></svg>',
  shop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18l-1.6 12.4H4.6Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 13.5h6" stroke="currentColor" stroke-width="2"/></svg>',
};

export function install({ engine, settings, i18n, profile, menuRoot }) {
  if (!MENUS_V2 || document.getElementById('fz2ui-style')) return null;
  const html = document.documentElement;
  const u = p => { try { return new URL(p, import.meta.url).href; } catch { return p; } };
  const li = () => Math.max(0, LANGS.indexOf((i18n && i18n.lang) || 'fr'));
  const L = (k, p) => { let s = TX[k][li()] || TX[k][0]; if (p) s = s.replace(/\{(\w+)\}/g, (m, x) => (x in p ? String(p[x]) : m)); return s; };
  const T = (k, p) => { try { const v = i18n.t(k, p); return v && v !== k ? v : ''; } catch { return ''; } };
  const num = n => { try { return Number(n).toLocaleString((i18n && i18n.lang) || 'fr'); } catch { return String(n); } };
  const st = document.createElement('style'); st.id = 'fz2ui-style'; st.textContent = CSS(u); document.head.append(st);
  html.classList.add('fz2ui');

  /* after each menu render: profile emblem, pass and shop entries (the menu rebuilds its screens, so these are added again) */
  const mk = (tag, cls, inner) => { const e = document.createElement(tag); if (cls) e.className = cls; if (inner) e.innerHTML = inner; return e; };
  const go = id => { const b = document.querySelector('[data-fid="nav:' + id + '"]'); if (b) b.click(); };
  function entry(id, icon, title, sub, badge) {
    const b = mk('button', 'fz2-ent'); b.type = 'button'; b.setAttribute('data-fid', 'home:' + id);
    const i = mk('i', null, icon), t = mk('span'), h = mk('b'), s = mk('small'); h.textContent = title; s.textContent = sub; t.append(h, s); b.append(i, t);
    if (badge) { const e = mk('em'); e.textContent = badge; s.appendChild(e); }
    b.addEventListener('click', () => go(id));
    return b;
  }
  function decorate() {
    const root = menuRoot && menuRoot.querySelector('.fzm'); if (!root) return;
    const rank = root.querySelector('.fzm-rank');
    if (rank && !rank.querySelector('.fz2-emb')) { const e = mk('i', 'fz2-emb', '<i></i><b></b>'); e.lastChild.textContent = String((profile && profile.level) || 1); rank.prepend(e); }
    const head = root.querySelector('.fzm-play-head');
    if (head && !head.querySelector('.fz2-entries')) {
      const box = mk('div', 'fz2-entries');
      let passSub = '', badge = '';
      try { const P = globalThis.FZPass; if (P) { hookPass(P); const pr = P.progress(); passSub = P.T ? P.T('tier', { n: pr.tier }) : String(pr.tier); const c = P.claimable(); if (c && c.length) badge = L('claim', { n: c.length }); } else if (!retry && tries < 12) { tries++; retry = setTimeout(() => { retry = 0; const b = document.querySelector('.fz2-entries'); if (b) { b.remove(); after(); } }, 500); } } catch { /* the pass may not be loaded yet */ }
      const cr = profile && profile.data ? num(profile.data.cr) + ' ₡' : L('shopSub');
      box.append(entry('pass', ICON.pass, T('nav.pass') || 'PASSE', passSub, badge), entry('shop', ICON.shop, T('nav.shop') || 'BOUTIQUE', cr));
      head.appendChild(box);
    }
  }
  let queued = false, observed = null, retry = 0, tries = 0, passHooked = false;
  function hookPass(P) { if (passHooked || !P.on) return; passHooked = true; P.on(() => { const b = document.querySelector('.fz2-entries'); if (b) { b.remove(); after(); } }); }
  const after = () => { queued = false; try { decorate(); } catch (e) { console.warn('[ui-theme]', e); } };
  const mo = new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(after); } });
  function watch() {
    const r = menuRoot && menuRoot.querySelector('.fzm'); if (!r || r === observed) return !!r; observed = r;
    mo.disconnect(); for (const q of [r.querySelector('.fzm-main'), r.querySelector('.fzm-top')]) if (q) mo.observe(q, { childList: true });
    after(); return true;
  }
  if (!watch()) { const w = new MutationObserver(() => { if (watch()) w.disconnect(); }); if (menuRoot) w.observe(menuRoot, { childList: true }); }
  return { decorate };
}
