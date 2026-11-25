// FRONT ZÉRO — the v2 menus at phone sizes (360x740 to 430x932 portrait, and landscape for the installed app).
// Style only, all inside media queries (narrow screens, short screens, coarse pointers): the desktop menus are untouched.
// Installed by input-hub.js. Touch targets of at least 44 px on a coarse pointer, one scrollable row of top tabs instead of three
// wrapped rows, a compact rank chip, and the active tab kept in view after each redraw of the menu.
const CSS = `
/* ---------- top bar ---------- */
@media (max-width:600px){
 .fzm-top{gap:6px 10px!important;padding-bottom:0!important}
 .fzm-nav{flex-wrap:nowrap!important;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;margin:0 calc(var(--pad,16px) * -1);padding:0 var(--pad,16px);
  -webkit-mask:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 22px),transparent);mask:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 22px),transparent)}
 .fzm-nav::-webkit-scrollbar{display:none}
 .fzm-tab{flex:0 0 auto!important;min-height:46px!important;padding:0 13px!important}
}
@media (max-width:520px){
 /* rank chip: the level hexagon alone (name and XP are on the profile screens); credits a little smaller: the logo keeps its room */
 .fzm-top .fzm-rank{flex:0 0 50px!important;width:50px;min-height:50px;padding:0!important;gap:0!important}
 .fzm-top .fzm-rank>:not(.fz2-emb){display:none!important}
 html.fz2ui .fzm-top .fzm-rank .fz2-emb{left:6px}
 html.fz2ui .fzm-cr{height:46px!important;padding:0 10px 0 10px!important}
 html.fz2ui .fzm-cr b{font-size:22px!important}
 .fzm-logo{font-size:21px!important}
 .fzm-id{gap:8px!important}
}
@media (max-width:380px){html.fz2ui .fzm-logo::before{width:24px;height:24px}.fzm-logo{font-size:19px!important;gap:8px!important}}
/* ---------- touch targets (finger, not mouse) ---------- */
@media (pointer:coarse){
 .fzm :is(.fzm-tab,.fzm-btn,.fzm-link,.fzm-seg button,.fzm-opt,.fzm-select,.fzm-input),
 .fzs :is(.fzs-tab,.fzs-key,.fzs-mini,.fzs-reset,.fzs-radio span,.fzs-ctl select,.fzs-dialog button),
 :is(.fzp,.fzw,.fzo,.fzf,#fz-flow,[data-fid="shop:screen"]) :is(button,select,[role=tab]){min-height:44px}
 .fzm :is(.fzm-link){display:inline-flex;align-items:center;min-width:44px}
 .fzm input[type=range],.fzs input[type=range]{min-height:44px}
 .fzs .fzs-switch{min-height:44px}
 .fzm [data-fid="play:bots-"],.fzm [data-fid="play:bots+"],[data-fid^="online:bz"],[data-fid^="lobby:bz"]{min-width:44px!important;min-height:44px!important}
 [data-fid="front:later"],[data-fid^="online:rvis"],[data-fid="pass:end-open"]{min-height:44px!important}       /* known small ones: their own rules are more specific */
}
/* ---------- landscape phone (installed app opens in landscape): short screens ---------- */
@media (max-height:500px) and (orientation:landscape){
 /* one row: logo, scrolling tabs, credits (the rank chip is on the profile screens) */
 .fzm-top{min-height:52px!important;flex-wrap:nowrap!important;padding-top:0!important;gap:10px!important}
 html.fz2ui .fzm-top{min-height:52px!important}
 .fzm-top .fzm-rank{display:none!important}
 .fzm-id{flex:none!important}
 .fzm-nav{order:0!important;flex:1 1 auto!important;flex-wrap:nowrap!important;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;align-self:stretch;
  -webkit-mask:linear-gradient(90deg,transparent 0,#000 12px,#000 calc(100% - 20px),transparent);mask:linear-gradient(90deg,transparent 0,#000 12px,#000 calc(100% - 20px),transparent)}
 .fzm-nav::-webkit-scrollbar{display:none}
 .fzm-tab{flex:0 0 auto!important;padding:0 11px!important;font-size:15px!important;min-height:46px!important}
 html.fz2ui .fzm-cr{height:44px!important}
 .fzm-logo{font-size:20px!important;flex:none}
 .fzm-cta{min-height:50px!important;font-size:22px!important}
 .fzm-cta-wrap{padding-top:6px!important;padding-bottom:6px!important}
 .fzs-head{padding:8px 16px 6px!important}.fzs-title{font-size:22px!important}
}
`;

export function installMobileUi(ctx) {
  if (document.getElementById('fzmob-style')) return;
  const st = document.createElement('style'); st.id = 'fzmob-style'; st.textContent = CSS; document.head.appendChild(st);
  // the menu draws its top bar again on each change: keep the current tab in view on a narrow screen
  const menuRoot = (ctx && ctx.menuRoot) || document.getElementById('menu'); if (!menuRoot) return;
  const narrow = matchMedia('(max-width:600px), (max-height:500px) and (orientation:landscape)');
  let queued = false, lastNav = null;
  const keep = () => {
    queued = false; if (!narrow.matches) return;
    const nav = menuRoot.querySelector('.fzm-nav'); if (!nav || nav === lastNav) return;      // only a freshly drawn bar: never fight the player's own scrolling
    lastNav = nav; const cur = nav.querySelector('[aria-current="page"]'); if (!cur) return;
    const a = cur.offsetLeft, b = a + cur.offsetWidth, l = nav.scrollLeft, w = nav.clientWidth;
    if (a < l + 16) nav.scrollLeft = Math.max(0, a - 24); else if (b > l + w - 24) nav.scrollLeft = b - w + 32;
  };
  new MutationObserver(() => { if (!queued && narrow.matches) { queued = true; requestAnimationFrame(keep); } }).observe(menuRoot, { childList: true, subtree: true });
}
