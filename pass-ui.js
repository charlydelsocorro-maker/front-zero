// FRONT ZÉRO — the season pass screen: a vertical "front line" of 50 tiers (rank-and-file rewards on the left, officer rewards on the right),
// the season clock, contracts, the officer's commission and the player's emblem and banner. Loaded on demand by pass.js; nothing here runs in a match.
// Previews are 2D (the shop's finish photos or swatches, SVG emblems, CSS banners). 3D is the shop's own preview, opened on the item on request
// (openShop focus): no new shader program, no second preview to maintain. No payment code, provider, link or real-money button.
import { WEAPONS } from './data.js';
import * as PS from './pass-season.js';
import { finishById, rarityOf } from './cosmetics.js';

const CSS = `
.fzp{--bg:#0d0e0b;--pan:#16171280;--pan2:#1d1f19;--line:rgba(201,185,143,.17);--line2:rgba(201,185,143,.36);--sand:#d8c9a3;--dim:#a29e88;--white:#f4ecd8;--amber:#e8a628;--e:#e8692c;--e2:#f2a04a;--dusk:#5a3a6e;--red:#e8664a;--green:#8fc46a;
position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;min-width:0;background:radial-gradient(90% 70% at 100% 0,rgba(90,58,110,.28),transparent 60%),radial-gradient(80% 70% at 0 100%,rgba(232,105,44,.12),transparent 60%),var(--bg);color:var(--sand);font:16px/1.3 'Barlow Condensed','Arial Narrow',Arial,sans-serif;-webkit-font-smoothing:antialiased}
.fzp *{box-sizing:border-box}.fzp button{font:inherit;color:inherit}.fzp :focus-visible{outline:2px solid var(--amber);outline-offset:1px}
.fzp-top{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px;padding:10px 22px;border-bottom:1px solid var(--line)}
.fzp-brand{display:flex;flex-direction:column;min-width:0}.fzp-brand h2{margin:0;font-size:28px;line-height:1;font-weight:800;letter-spacing:.08em;color:var(--white);text-transform:uppercase}.fzp-brand span{font-size:15px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--e2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fzp-clock{display:flex;align-items:center;gap:8px;padding:5px 11px;border:1px solid var(--line2);background:rgba(10,10,8,.5);font-size:16px;font-weight:700;color:var(--white);font-variant-numeric:tabular-nums;white-space:nowrap}.fzp-clock i{width:8px;height:8px;border-radius:50%;background:var(--e);box-shadow:0 0 8px var(--e)}
.fzp-bal{display:flex;flex-direction:column;align-items:flex-end;margin-left:auto;line-height:1.05}.fzp-bal small{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}.fzp-bal b{font-size:23px;font-weight:800;color:var(--amber);font-variant-numeric:tabular-nums}
.fzp-close{min-height:44px;padding:0 18px;background:var(--pan2);border:1px solid var(--line2);font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer}.fzp-close:hover{background:#2a2d24}
.fzp-test{flex:none;margin:0;padding:5px 22px;background:rgba(232,166,40,.1);border-bottom:1px solid rgba(232,166,40,.3);color:#efd9a8;font-size:15px}.fzp-test b{color:var(--amber);letter-spacing:.08em}
.fzp-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(300px,350px) minmax(0,1fr) minmax(340px,400px)}
.fzp-side,.fzp-lad,.fzp-detail{min-width:0;min-height:0;overflow-y:auto;scrollbar-color:#3c4133 transparent}
.fzp-side{display:flex;flex-direction:column;gap:12px;padding:14px 14px 24px 22px;border-right:1px solid var(--line)}
.fzp-side>*,.fzp-detail>*,.fzp-sheet>div>*{flex-shrink:0}       /* the hero clips its glow (overflow hidden): as a flex item it would otherwise shrink to nothing when the column is taller than the screen */
.fzp-card{padding:12px 14px;background:linear-gradient(180deg,rgba(29,31,25,.92),rgba(20,21,17,.92));border:1px solid var(--line)}
.fzp-hero{position:relative;overflow:hidden;border-color:rgba(232,105,44,.45);background:linear-gradient(160deg,rgba(90,58,110,.5),rgba(20,16,14,.9) 55%),linear-gradient(0deg,rgba(232,105,44,.25),transparent)}
.fzp-hero::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--dusk),var(--e),var(--e2))}
.fzp-tag{margin:0 0 6px;font-size:15px;color:#d9c7b0}
.fzp-tierline{display:flex;align-items:baseline;gap:10px}.fzp-tierline b{font-size:56px;line-height:.9;font-weight:800;color:var(--white);font-variant-numeric:tabular-nums}.fzp-tierline span{font-size:16px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--e2)}
.fzp-bar{height:8px;margin:8px 0 4px;background:rgba(201,185,143,.16);overflow:hidden}.fzp-bar i{display:block;height:100%;background:linear-gradient(90deg,#b8452a,var(--e),var(--e2))}
.fzp-small{font-size:15px;color:var(--dim);font-variant-numeric:tabular-nums}
.fzp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:46px;padding:0 16px;background:var(--pan2);border:1px solid var(--line2);font-size:17px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;text-align:center}.fzp-btn:hover:not([disabled]){background:#2c3126}
.fzp-btn.pri{background:var(--e);border-color:var(--e);color:#1a0c04}.fzp-btn.pri:hover:not([disabled]){background:#f47e40}.fzp-btn[disabled]{opacity:.55;cursor:not-allowed}.fzp-btn.done{background:rgba(143,196,106,.12);border-color:var(--green);color:var(--green);opacity:1}
.fzp-btn.wide{width:100%;margin-top:8px}
.fzp-com h3,.fzp-con h3{margin:0;font-size:19px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--white)}
.fzp-price{display:flex;align-items:center;gap:8px;margin:6px 0 4px;font-size:26px;font-weight:800;color:var(--amber);font-variant-numeric:tabular-nums}
.fzp-mark{padding:0 5px;border:1px solid rgba(232,166,40,.55);background:rgba(10,12,8,.8);color:var(--amber);font-size:12px;font-weight:700;letter-spacing:.08em}
.fzp-id{position:relative;display:flex;align-items:center;gap:12px;min-height:76px;padding:8px 12px;border:1px solid var(--line2);overflow:hidden;background:#1a1a18}
.fzp-id svg{flex:none;width:58px;height:58px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))}.fzp-id .fzp-noemb{flex:none;width:58px;height:58px;border:1px dashed var(--line2);border-radius:50%}
.fzp-id b{display:block;font-size:23px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fzp-id span{font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#f3e6cc;text-shadow:0 1px 2px #000}
.fzp-switch{display:none}
.fzp-con{display:flex;flex-direction:column;gap:6px}.fzp-con h4{display:flex;justify-content:space-between;gap:8px;margin:8px 0 0;font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--e2)}.fzp-con h4 span{color:var(--dim);letter-spacing:.04em;text-transform:none;font-weight:600}
.fzp-ct{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;padding:7px 10px;background:rgba(14,15,12,.7);border:1px solid var(--line);border-left:3px solid #4a4c40}
.fzp-ct.is-done{border-left-color:var(--green);opacity:.78}.fzp-ct.is-feat{border-left-color:var(--e)}
.fzp-ct p{margin:0;font-size:16px;font-weight:600;color:var(--white)}.fzp-ct em{font-style:normal;font-size:15px;font-weight:800;color:var(--e2);font-variant-numeric:tabular-nums;white-space:nowrap}
.fzp-ct .fzp-bar{grid-column:1/-1;height:5px;margin:2px 0 0}.fzp-ct small{grid-column:1/-1;font-size:13.5px;color:var(--dim);font-variant-numeric:tabular-nums}.fzp-ct.is-done small{color:var(--green)}
.fzp-lad{position:relative;padding:0 18px 30px}
.fzp-lhead{position:sticky;top:0;z-index:3;display:grid;grid-template-columns:minmax(0,1fr) 64px minmax(0,1fr);align-items:end;padding:10px 0 8px;background:#0f100d;box-shadow:0 10px 12px -8px rgba(0,0,0,.7)}
.fzp-lhead span{font-size:16px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}.fzp-lhead span:first-child{text-align:right}.fzp-lhead span:last-child{color:var(--e2)}.fzp-lhead span small{display:block;font-size:12.5px;letter-spacing:.06em;color:var(--dim);font-weight:600}
.fzp-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 64px minmax(0,1fr);align-items:center;min-height:96px;content-visibility:auto;contain-intrinsic-size:auto 96px}
.fzp-row::before{content:"";position:absolute;left:calc(50% - 2px);top:0;bottom:0;width:4px;background:#2c2e26}
.fzp-row.is-got::before{background:linear-gradient(180deg,var(--e),#b8452a)}
.fzp-row.is-cur::before{background:linear-gradient(180deg,#b8452a,var(--e) var(--f,0%),#2c2e26 var(--f,0%))}
.fzp-node{position:relative;z-index:1;justify-self:center;display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#1a1b17;border:2px solid #3c3e34;font-size:18px;font-weight:800;color:var(--dim);font-variant-numeric:tabular-nums}
.fzp-row.is-got .fzp-node{background:#2a1a10;border-color:var(--e);color:var(--white)}.fzp-row.is-cur .fzp-node{width:50px;height:50px;background:var(--e);border-color:var(--e2);color:#1a0c04;box-shadow:0 0 0 4px rgba(232,105,44,.22),0 0 18px rgba(232,105,44,.5)}
.fzp-cell{min-width:0;display:flex;padding:6px 0}.fzp-cell.free{justify-content:flex-end;padding-right:8px}.fzp-cell.prem{justify-content:flex-start;padding-left:8px}
.fzp-none{width:26px;height:2px;margin:0 10px;background:#33352c}
.fzp-rw{position:relative;display:grid;grid-template-columns:96px minmax(0,1fr);align-items:center;gap:10px;width:100%;max-width:330px;min-height:62px;padding:6px 10px 6px 6px;text-align:left;background:var(--pan2);border:1px solid var(--line);border-left:3px solid var(--r,#6c7264);cursor:pointer;transition:background .12s,border-color .12s,transform .12s}
.fzp-rw:hover{background:#262a20;transform:translateY(-1px)}.fzp-rw[aria-pressed=true]{border-color:var(--amber);box-shadow:inset 0 0 0 1px rgba(232,166,40,.5)}
.fzp-rw.is-claim{border-color:var(--e);background:linear-gradient(90deg,rgba(232,105,44,.2),var(--pan2) 70%);box-shadow:0 0 14px rgba(232,105,44,.25)}
.fzp-rw.is-lock{opacity:.62}.fzp-rw.is-got .fzp-pic{opacity:.55}
.fzp-rtx{display:flex;flex-direction:column;min-width:0}.fzp-rn{font-size:16.5px;font-weight:700;line-height:1.1;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fzp-rk{font-size:13px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fzp-st{margin-top:2px;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;color:var(--dim)}.fzp-st.claim{color:#1a0c04;background:var(--e);padding:1px 6px;justify-self:start;align-self:flex-start}.fzp-st.got{color:var(--green)}.fzp-st.lock{color:#c9a07a}
.fzp-pic{position:relative;display:block;width:96px;aspect-ratio:2/1;overflow:hidden;background:#1b1c18;border:1px solid rgba(0,0,0,.5)}
.fzp-pic>img,.fzp-pic>canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.fzp-pic.is-cr{display:flex;align-items:center;justify-content:center;gap:4px;background:radial-gradient(80% 90% at 50% 100%,rgba(232,166,40,.28),#17150f)}.fzp-pic.is-cr b{font-size:17px;font-weight:800;color:var(--amber);font-variant-numeric:tabular-nums}.fzp-pic.is-cr svg{width:22px;height:22px}
.fzp-pic.is-emb{display:grid;place-items:center;background:radial-gradient(60% 80% at 50% 50%,#2a2924,#141412)}.fzp-pic.is-emb svg{height:92%;width:auto}
.fzp-pic.is-fit i{position:absolute;right:4px;bottom:2px;font-style:normal;font-size:11px;font-weight:800;letter-spacing:.08em;color:#fff;text-shadow:0 1px 2px #000}
.fzp-ex{position:absolute;top:-6px;right:6px;padding:0 5px;background:#2a1a10;border:1px solid var(--e);color:var(--e2);font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.fzp-detail{display:flex;flex-direction:column;gap:10px;padding:14px 22px 22px 16px;border-left:1px solid var(--line);background:rgba(13,15,11,.5)}
.fzp-dview{position:relative;flex:none;width:100%;aspect-ratio:16/9;max-height:42vh;background:radial-gradient(90% 80% at 50% 42%,#2a2e25,#121410);border:1px solid var(--line2);overflow:hidden;display:grid;place-items:center}
.fzp-dview>.fzp-pic{width:100%;height:100%;aspect-ratio:auto;border:0}.fzp-dview>.fzp-pic.is-emb svg{height:80%}.fzp-dview>.fzp-pic.is-cr b{font-size:44px}.fzp-dview>.fzp-pic.is-cr svg{width:52px;height:52px}
.fzp-dview canvas.fzp-3d{position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:pan-y;opacity:0;transition:opacity .16s}.fzp-dview canvas.fzp-3d.is-on{opacity:1}
.fzp-dhead h3{margin:2px 0 0;font-size:28px;line-height:1.02;font-weight:800;color:var(--white)}
.fzp-rar{display:inline-block;padding:1px 8px;border:1px solid var(--r);color:var(--r);font-size:13.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
.fzp-meta{margin:4px 0 0;font-size:15.5px;color:var(--dim)}.fzp-note{margin:0;font-size:15.5px;color:#d9c7b0}.fzp-why{margin:0;font-size:16px;font-weight:700;color:#e8a07a}
.fzp-acts{display:flex;flex-wrap:wrap;gap:8px}.fzp-acts .fzp-btn{flex:1 1 150px}
.fzp-empty{margin:auto 0;color:var(--dim);text-align:center}
.fzp-sheet{position:fixed;inset:0;z-index:62;display:flex;align-items:flex-end;justify-content:center;background:rgba(6,7,5,.66)}
.fzp-sheet>div{display:flex;flex-direction:column;gap:10px;width:min(560px,100%);max-height:88vh;overflow-y:auto;padding:14px 16px 18px;background:#15170f;border:1px solid var(--line2);border-bottom:0;box-shadow:0 -10px 40px rgba(0,0,0,.6)}
.fzp-dlg{position:fixed;inset:0;z-index:63;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(6,7,5,.72)}
.fzp-dbox{width:min(440px,100%);padding:18px 20px;background:#1a1d15;border:1px solid var(--amber);box-shadow:0 14px 44px rgba(0,0,0,.65)}.fzp-dbox h3{margin:0 0 8px;font-size:24px;font-weight:800;letter-spacing:.04em;color:var(--white);text-transform:uppercase}
.fzp-sum{display:grid;grid-template-columns:1fr auto;gap:3px 14px;margin:8px 0 14px;font-size:17px;font-variant-numeric:tabular-nums}.fzp-sum b{color:var(--white);text-align:right}.fzp-sum .tot{color:var(--amber)}
.fzp-toast{position:fixed;left:50%;bottom:20px;z-index:64;transform:translateX(-50%);max-width:calc(100% - 32px);padding:9px 16px;background:#20261a;border:1px solid var(--green);color:var(--white);font-weight:600;box-shadow:0 6px 22px rgba(0,0,0,.55)}.fzp-toast.bad{border-color:var(--red)}
@media (max-width:1279px){.fzp-body{grid-template-columns:minmax(290px,330px) minmax(0,1fr)}.fzp-detail{display:none}}
@media (max-width:820px){.fzp{overflow-y:auto;-webkit-overflow-scrolling:touch}.fzp-top{padding:8px 16px;gap:6px 10px}.fzp-brand h2{font-size:22px}.fzp-brand span{font-size:13.5px}.fzp-clock{order:5;font-size:14.5px;padding:4px 9px;white-space:normal}.fzp-bal b{font-size:20px}.fzp-close{min-height:42px;padding:0 12px}.fzp-test{padding:4px 16px;font-size:14px}
.fzp-body{display:block;flex:none}.fzp-side{overflow:visible;padding:12px 16px 4px;border-right:0}.fzp-lad{overflow:visible;padding:0 8px 26px}
.fzp-switch{display:grid;grid-template-columns:1fr 1fr;gap:4px}.fzp-switch button{min-height:44px;background:var(--pan2);border:1px solid var(--line);font-size:17px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);cursor:pointer}.fzp-switch button[aria-pressed=true]{color:var(--white);border-color:var(--e);background:rgba(232,105,44,.16)}
.fzp.v-tiers .fzp-con{display:none}.fzp.v-con .fzp-lad{display:none}
.fzp-tierline b{font-size:44px}.fzp-row{grid-template-columns:minmax(0,1fr) 46px minmax(0,1fr);min-height:126px;contain-intrinsic-size:auto 126px}.fzp-lhead{grid-template-columns:minmax(0,1fr) 46px minmax(0,1fr)}.fzp-lhead span{font-size:14px;letter-spacing:.1em}
.fzp-node{width:34px;height:34px;font-size:15px}.fzp-row.is-cur .fzp-node{width:40px;height:40px}
.fzp-cell.free{padding-right:4px}.fzp-cell.prem{padding-left:4px}
.fzp-rw{grid-template-columns:minmax(0,1fr);gap:4px;padding:5px;max-width:none}.fzp-pic{width:100%}.fzp-rn{font-size:15.5px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.fzp-none{margin:0 auto}}
@media (prefers-reduced-motion:reduce){.fzp *{transition:none!important}}
`;
let cssDone = false;
const injectCss = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.id = 'fzp-style'; s.textContent = CSS; document.head.append(s); };
function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  if (props) for (const k of Object.keys(props)) { const v = props[k]; if (v === null || v === undefined || v === false) continue; if (k === 'text') n.textContent = v; else if (k === 'style') n.style.cssText = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.append(c);
  return n;
}
const hex = h => '#' + (h >>> 0).toString(16).padStart(6, '0');
const SVGNS = 'http://www.w3.org/2000/svg';
function svg(view, inner, label) { const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', view); s.setAttribute('aria-hidden', label ? 'false' : 'true'); if (label) { s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); } s.innerHTML = inner; return s; }

/* ---------- emblems: a shape and a glyph, three colours (dark, metal, light) ---------- */
const SHAPES = {
  roundel: (a, b) => `<circle cx="32" cy="32" r="29" fill="${a}" stroke="${b}" stroke-width="3"/><circle cx="32" cy="32" r="23.5" fill="none" stroke="${b}" stroke-opacity=".35" stroke-width="1.5"/>`,
  shield: (a, b) => `<path d="M32 3 L57 11 V30 C57 46 46 56 32 61 C18 56 7 46 7 30 V11 Z" fill="${a}" stroke="${b}" stroke-width="3" stroke-linejoin="round"/>`,
  hex: (a, b) => `<polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5" fill="${a}" stroke="${b}" stroke-width="3" stroke-linejoin="round"/>`,
  diamond: (a, b) => `<polygon points="32,2 62,32 32,62 2,32" fill="${a}" stroke="${b}" stroke-width="3" stroke-linejoin="round"/><polygon points="32,10 54,32 32,54 10,32" fill="none" stroke="${b}" stroke-opacity=".35" stroke-width="1.5"/>`,
  tab: (a, b) => `<path d="M7 9 H57 V43 L32 58 L7 43 Z" fill="${a}" stroke="${b}" stroke-width="3" stroke-linejoin="round"/>`,
};
const GLYPHS = {
  chevron: (b, c) => `<path d="M18 25 L32 37 L46 25" fill="none" stroke="${c}" stroke-width="6.5" stroke-linecap="square"/>`,
  chevron2: (b, c) => `<path d="M18 20 L32 31 L46 20 M18 32 L32 43 L46 32" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="square"/><circle cx="32" cy="51" r="2.6" fill="${b}"/>`,
  anchor: (b, c) => `<g fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"><circle cx="32" cy="15" r="4"/><path d="M32 19 V49 M23 26 H41 M17 37 Q19 50 32 50 Q45 50 47 37"/></g><path d="M14 38 l3-5 3 5z M44 38 l3-5 3 5z" fill="${c}"/>`,
  tanks: (b, c) => `<g fill="${b}" stroke="${c}" stroke-width="2.5"><rect x="12" y="27" width="12" height="20" rx="5"/><rect x="26" y="22" width="12" height="25" rx="5"/><rect x="40" y="27" width="12" height="20" rx="5"/></g><path d="M10 49 H54" stroke="${c}" stroke-width="3"/>`,
  peak: (b, c) => `<polygon points="11,47 25,25 31,33 40,17 53,47" fill="${b}"/><polygon points="40,17 44,26 36,26" fill="#f4ecd8" fill-opacity=".7"/><circle cx="20" cy="19" r="4" fill="${c}"/>`,
  bars: (b, c) => `<g fill="${c}"><rect x="17" y="17" width="30" height="5"/><rect x="17" y="26" width="30" height="5"/></g><rect x="17" y="35" width="30" height="5" fill="${b}"/>`,
  hook: (b, c) => `<path d="M12 11 H52 M32 11 V31" stroke="${b}" stroke-width="4"/><path d="M32 31 V41 A7 7 0 1 1 25 34" fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round"/><path d="M18 11 L32 22 L46 11" fill="none" stroke="${b}" stroke-width="2"/>`,
  stack: (b, c) => `<rect x="29" y="24" width="6" height="27" fill="${b}"/><path d="M22 51 H42" stroke="${b}" stroke-width="3"/><path d="M32 7 C37 13 39 17 37 21 C36 23 34 24 32 24 C30 24 27 23 27 20 C27 17 30 16 31 13 C32 16 33 17 33 18 C34 15 33 11 32 7 Z" fill="${c}"/>`,
  arch: (b, c) => `<path d="M8 43 H56 M13 43 V36 Q32 13 51 36 V43" fill="none" stroke="${c}" stroke-width="4"/><path d="M22 43 V30 M32 43 V24 M42 43 V30" stroke="${b}" stroke-width="2.5"/><path d="M10 50 H54" stroke="${b}" stroke-width="2" stroke-dasharray="4 3"/>`,
  sun: (b, c) => `<path d="M16 38 A16 16 0 0 1 48 38 Z" fill="${c}"/><path d="M11 42 H53 M15 47 H49 M20 52 H44" stroke="${b}" stroke-width="2.5"/>`,
  crossed: (b, c) => `<path d="M18 48 L42 18 M46 48 L22 18" stroke="${b}" stroke-width="4.5" stroke-linecap="round"/><circle cx="43" cy="16" r="4.5" fill="${c}"/><circle cx="21" cy="16" r="4.5" fill="${c}"/>`,
  ember: (b, c) => `<path d="M32 9 C40 20 47 25 45 38 C44 47 38 53 32 53 C26 53 19 47 19 38 C19 29 26 26 28 19 C30 26 34 28 34 33 C37 28 35 18 32 9 Z" fill="${b}"/><path d="M32 30 C35 35 38 38 37 43 C36 47 34 49 32 49 C29 49 27 46 27 43 C27 39 30 37 32 30 Z" fill="${c}"/><circle cx="46" cy="14" r="2" fill="${c}"/><circle cx="17" cy="20" r="1.6" fill="${c}"/>`,
};
export function emblemSvg(e, label) { const [a, b, c] = e.c; return svg('0 0 64 64', (SHAPES[e.shape] || SHAPES.roundel)(a, b) + (GLYPHS[e.glyph] || GLYPHS.chevron)(b, c), label); }
/* outfit pictures made by the shop (.handoff/shop/capture-outfits.cjs): only ids listed in outfit-shots/index.json are requested, never a 404 */
let shotsP = null;
const loadOutfitShots = () => shotsP || (shotsP = fetch(new URL('outfit-shots/index.json', import.meta.url)).then(r => (r.ok ? r.json() : null)).then(j => new Set(j && Array.isArray(j.ids) ? j.ids : [])).catch(() => new Set()));
const outfitShot = id => new URL(`outfit-shots/${encodeURIComponent(id)}.webp`, import.meta.url).href;
const COIN = '<circle cx="12" cy="12" r="10" fill="#e8a628"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="#7a5310" stroke-width="1.6"/><path d="M14.6 9.2 A4 4 0 1 0 14.6 14.8" fill="none" stroke="#5a3d0a" stroke-width="2"/>';

/** deps: { pass, engine, profile, i18n, audio, onChange?, onClose? } */
export async function openPassScreen(deps) {
  injectCss();
  const { pass, engine, profile, i18n, audio, onChange, onClose } = deps;
  const L = () => pass.lang(), T = (k, p) => pass.T(k, p), num = pass.num;
  const sfx = () => { try { if (audio && audio.ui) audio.ui(); } catch { /* optional */ } };
  let skins = null; try { skins = await import('./weapon-skins.js'); } catch { /* 2D colour fallback */ }
  const fitShots = await Promise.race([loadOutfitShots(), new Promise(r => setTimeout(() => r(new Set()), 1500))]);
  const wide = () => { try { return matchMedia('(min-width:1280px)').matches; } catch { return true; } };
  const st = { sel: null, view: 'tiers', closed: false, dlg: null, sheet: null, toastT: 0, prev: null };
  const root = el('div', { class: 'fzp v-tiers', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('title'), 'data-fid': 'pass:screen' });
  const S = () => pass.season, state = () => pass.state, TEST = pass.test;

  /* ---------- pictures ---------- */
  const swatchQ = []; let swatchRun = false;
  const pump = () => { if (swatchRun) return; swatchRun = true; const step = () => { if (st.closed || !swatchQ.length) { swatchRun = false; return; } const j = swatchQ.shift(); if (j.c.isConnected && skins && skins.drawSwatch) { try { skins.drawSwatch(j.c, j.id); } catch { /* keeps its colours */ } } setTimeout(step, 0); }; setTimeout(step, 0); };
  function pic(r) {
    if (r.kind === 'cr') return el('span', { class: 'fzp-pic is-cr' }, svg('0 0 24 24', COIN), el('b', { text: `${num(r.cr)} ₡` }));
    const it = PS.itemById(r.id);
    if (!it) return el('span', { class: 'fzp-pic' });
    if (r.kind === 'emb') return el('span', { class: 'fzp-pic is-emb' }, emblemSvg(it));
    if (r.kind === 'ban') { const b = el('span', { class: 'fzp-pic', style: `background:${it.bg}` }); return b; }
    if (r.kind === 'fit') {       // the shop's picture of the real soldier when it exists; the colour bands stay underneath as the fallback
      const p = it.palette, shot = fitShots.has(it.id) ? el('img', { alt: '', loading: 'lazy', decoding: 'async', src: outfitShot(it.id), onerror: e => e.target.remove() }) : null;
      return el('span', { class: 'fzp-pic is-fit', style: `background:linear-gradient(135deg,${hex(p.cloth)} 0 38%,${hex(p.plate)} 38% 64%,${hex(p.cloth2)} 64% 84%,${hex(p.accent)} 84%)` }, shot, el('i', { text: PS.SET_NAMES[it.setId] || '' }));
    }
    const box = el('span', { class: 'fzp-pic', style: `background:linear-gradient(135deg,${it.c.map((c, i) => `${hex(c)} ${Math.round(i / it.c.length * 100)}% ${Math.round((i + 1) / it.c.length * 100)}%`).join(',')})` });
    const swatch = () => { if (finishById(it.id) && skins && skins.drawSwatch) { const c = el('canvas', { width: 128, height: 128, 'aria-hidden': 'true' }); box.prepend(c); swatchQ.push({ c, id: it.id }); pump(); } };
    box.append(el('img', { alt: '', loading: 'lazy', decoding: 'async', src: new URL(`weapon-shots/fin-${encodeURIComponent(it.id)}.webp`, import.meta.url).href, onerror: e => { e.target.remove(); swatch(); } }));
    box.append(el('i', { style: `position:absolute;left:0;right:0;bottom:0;height:3px;background:${hex(it.accent)}` }));
    return box;
  }
  const rewardName = r => (r.kind === 'cr' ? `${num(r.cr)} ${T('credits')}` : PS.itemName(PS.itemById(r.id), L()));
  const rewardKind = r => PS.pick(PS.W.kinds[r.kind], L());
  const rarityColor = r => { if (r.kind === 'cr') return '#e8a628'; const it = PS.itemById(r.id); return it ? rarityOf(it.rarity).color : '#6c7264'; };

  /* ---------- states ---------- */
  function cellState(r) {
    const s = S(), x = state(), c = PS.claimCheck(x, s, r.tier, r.track, TEST);
    if (c.ok) return 'claim';
    if (c.reason === 'claimed') return 'got';
    if (c.reason === 'tier') return 'tier';
    if (c.reason === 'locked') return 'locked';
    return 'none';
  }
  const stateLabel = (r, cs) => cs === 'claim' ? T('claim') : cs === 'got' ? (r.track === 'premium' && TEST && !state().prem ? T('claimedTest') : T('claimed')) : cs === 'tier' ? T('tierShort', { n: r.tier }) : cs === 'locked' ? T('locked') : '';

  /* ---------- top ---------- */
  const clockEl = el('span', { class: 'fzp-clock', role: 'timer', 'data-fid': 'pass:clock' }), balEl = el('b', { 'data-fid': 'pass:credits' });
  const brand = el('div', { class: 'fzp-brand' }, el('h2', { text: T('title') }), el('span', { text: `${T('season', { n: S().num })} · ${PS.pick(S().name, L())}` }));
  function drawClock() {
    const s = S(), t = pass.now(), ph = PS.seasonPhase(s, t);
    clockEl.replaceChildren(el('i', { 'aria-hidden': 'true' }), ph === 'live' ? T('endsIn', { t: PS.fmtLeft(PS.seasonEndsAt(s) - t, L()) }) : ph === 'soon' ? T('soon', { t: PS.fmtLeft(PS.dayStart(s.startDay) - t, L()) }) : T('endedShort'));
  }
  const drawBal = () => { balEl.textContent = `${num(profile.data.cr)} ₡`; };
  root.append(el('div', { class: 'fzp-top' }, brand, clockEl, el('div', { class: 'fzp-bal' }, el('small', { text: PS.pick(['Solde', 'Balance', 'Saldo', 'Guthaben', 'Saldo', 'Saldo'], L()) }), balEl),
    el('button', { type: 'button', class: 'fzp-close', 'data-fid': 'pass:close', onclick: () => close() }, T('back'))));
  if (TEST) root.append(el('p', { class: 'fzp-test', 'data-fid': 'pass:testnote' }, el('b', { text: T('testMark') }), ' · ', T('testBar')));

  /* ---------- side: hero, commission, identity, contracts ---------- */
  const side = el('div', { class: 'fzp-side' }), lad = el('div', { class: 'fzp-lad', 'data-fid': 'pass:ladder' }), detail = el('div', { class: 'fzp-detail', 'data-fid': 'pass:detail' });
  function hero() {
    const s = S(), x = state(), pr = PS.tierProgress(x.xp, s), n = pass.claimable().length;
    return el('section', { class: 'fzp-card fzp-hero', 'data-fid': 'pass:hero' },
      el('p', { class: 'fzp-tag', text: PS.pick(s.tagline, L()) }),
      PS.seasonPhase(s, pass.now()) === 'ended' ? el('p', { class: 'fzp-why', text: T('ended') }) : null,
      el('div', { class: 'fzp-tierline' }, el('b', { text: String(pr.tier) }), el('span', { text: `/ ${s.tiers} · ${T('tier', { n: '' }).trim()}` })),
      el('div', { class: 'fzp-bar', role: 'progressbar', 'aria-label': T('seasonXp'), 'aria-valuemin': '0', 'aria-valuemax': String(pr.need || 1), 'aria-valuenow': String(pr.need ? pr.into : 1) }, el('i', { style: `width:${pr.frac * 100}%` })),
      el('div', { class: 'fzp-small', 'data-fid': 'pass:xp' }, pr.need ? T('toNext', { a: num(pr.into), b: num(pr.need), n: pr.tier + 1 }) : T('maxed')),
      el('div', { class: 'fzp-small', text: `${T('seasonXp')} : ${num(x.xp)} · ${T('local')}` }),
      n ? el('button', { type: 'button', class: 'fzp-btn pri wide', 'data-fid': 'pass:claim-all', onclick: claimAll }, T('claimAll', { n })) : null);
  }
  function commissionCard() {
    const c = pass.commission(), x = state();
    const kids = [el('h3', { text: T('commission') }), el('p', { class: 'fzp-note', text: T('commissionNote') })];
    kids.push(el('div', { class: 'fzp-price', 'data-fid': 'pass:price' }, `${num(c.credits)} ₡`, TEST ? el('span', { class: 'fzp-mark', text: T('testMark') }) : null));
    if (x.prem) kids.push(el('button', { type: 'button', class: 'fzp-btn done wide', disabled: true, 'data-fid': 'pass:commission' }, T('commissionOwned')));
    else if (TEST) kids.push(el('p', { class: 'fzp-note', 'data-fid': 'pass:testopen', text: T('testOpen') }));
    else {
      const live = PS.seasonPhase(S(), pass.now()) === 'live';
      kids.push(el('button', { type: 'button', class: `fzp-btn wide${c.missing ? '' : ' pri'}`, disabled: !live || c.missing > 0, 'data-fid': 'pass:commission', onclick: askCommission }, T('getCommission')));
      if (c.missing > 0) kids.push(el('p', { class: 'fzp-why', text: T('missing', { n: num(c.missing) }) }));
    }
    return el('section', { class: 'fzp-card fzp-com', id: 'fzp-com', 'data-fid': 'pass:commission-card' }, kids);
  }
  function identity() {
    const x = state(), e = x.equip.emb && pass.owns(x.equip.emb) ? PS.itemById(x.equip.emb) : null, b = x.equip.ban && pass.owns(x.equip.ban) ? PS.itemById(x.equip.ban) : null;
    return el('section', { class: 'fzp-id', style: b ? `background:${b.bg}` : null, 'data-fid': 'pass:identity' },
      e ? emblemSvg(e) : el('span', { class: 'fzp-noemb', 'aria-hidden': 'true' }),
      el('div', { style: 'min-width:0' }, el('b', { text: profile.data.name || T('soldier') }), el('span', { text: `${T('tier', { n: PS.tierOf(x.xp, S()) })} · ${PS.pick(S().name, L())}` })));
  }
  function contractsBox() {
    const cs = pass.contracts(), x = state(), t = pass.now(), s = S(), live = PS.seasonPhase(s, t) === 'live';
    const row = (c, box) => {
      const done = box.n === (c.scope === 'd' ? cs.day : cs.week) && box.done.includes(c.k), v = done ? c.n : box.n === (c.scope === 'd' ? cs.day : cs.week) ? Math.min(c.n, box.p[c.k] | 0) : 0;
      return el('div', { class: `fzp-ct${done ? ' is-done' : ''}${c.scope === 'w' && c.k === 'map' ? ' is-feat' : ''}`, 'data-fid': `pass:contract:${c.key}` },
        el('p', { text: PS.contractText(c, L(), pass.names) }), el('em', { text: `+${num(c.xp)} XP` }),
        el('div', { class: 'fzp-bar' }, el('i', { style: `width:${(v / c.n) * 100}%` })),
        el('small', { text: done ? `✓ ${T('done')}` : `${num(v)} / ${num(c.n)}` }));
    };
    const kids = [el('h3', { text: T('contracts') })];
    if (!live) kids.push(el('p', { class: 'fzp-note', text: T('noGain') }));
    else {
      kids.push(el('h4', null, T('daily'), el('span', { text: T('renews', { t: PS.fmtLeft(PS.nextDayAt(t) - t, L()) }) })), cs.daily.map(c => row(c, x.day)));
      kids.push(el('h4', null, T('weekly'), el('span', { text: T('renews', { t: PS.fmtLeft(PS.nextWeekAt(s, t) - t, L()) }) })), cs.weekly.map(c => row(c, x.week)));
    }
    return el('section', { class: 'fzp-card fzp-con', 'data-fid': 'pass:contracts' }, kids);
  }
  const switchEl = el('div', { class: 'fzp-switch', role: 'group', 'aria-label': T('title') });
  function drawSwitch() {
    const b = (v, label) => el('button', { type: 'button', 'aria-pressed': st.view === v ? 'true' : 'false', 'data-fid': `pass:view:${v}`, onclick: () => { if (st.view === v) return; st.view = v; sfx(); root.classList.toggle('v-tiers', v === 'tiers'); root.classList.toggle('v-con', v === 'con'); drawSwitch(); } }, label);
    switchEl.replaceChildren(b('tiers', T('tracks')), b('con', T('contracts')));
  }
  function drawSide() { const y = side.scrollTop; drawSwitch(); side.replaceChildren(hero(), commissionCard(), identity(), switchEl, contractsBox()); side.scrollTop = y; }

  /* ---------- the ladder ---------- */
  function card(r) {
    const cs = cellState(r), it = r.kind === 'cr' ? null : PS.itemById(r.id), selected = st.sel && st.sel.tier === r.tier && st.sel.track === r.track;
    return el('button', { type: 'button', class: `fzp-rw${cs === 'claim' ? ' is-claim' : cs === 'got' ? ' is-got' : cs === 'tier' || cs === 'locked' ? ' is-lock' : ''}`, style: `--r:${rarityColor(r)}`,
      'aria-pressed': selected ? 'true' : 'false', 'data-fid': `pass:rw:${r.track}:${r.tier}`, 'aria-label': `${T('tier', { n: r.tier })} · ${rewardName(r)} · ${stateLabel(r, cs)}`,
      onclick: () => onCard(r, cs) },
      it && r.kind !== 'cr' ? el('span', { class: 'fzp-ex', text: '★' }) : null,
      pic(r), el('span', { class: 'fzp-rtx' }, el('span', { class: 'fzp-rn', text: rewardName(r) }), el('span', { class: 'fzp-rk', text: rewardKind(r) }),
        el('span', { class: `fzp-st${cs === 'claim' ? ' claim' : cs === 'got' ? ' got' : cs === 'tier' || cs === 'locked' ? ' lock' : ''}`, text: stateLabel(r, cs) })));
  }
  function drawLadder(scrollToCurrent) {
    const s = S(), x = state(), pr = PS.tierProgress(x.xp, s), top = lad.scrollTop, winTop = root.scrollTop;
    const head = el('div', { class: 'fzp-lhead' }, el('span', null, T('free'), el('small', { text: T('freeNote') })), el('span', null, ''), el('span', null, T('premium'), el('small', { text: x.prem ? T('commissionOwned') : TEST ? T('testMark') : T('locked') })));
    const rows = [];
    for (let n = 1; n <= s.tiers; n++) {
      const f = PS.rewardAt(s, n, 'free'), p = PS.rewardAt(s, n, 'premium'), got = n < pr.tier, cur = n === pr.tier;
      rows.push(el('div', { class: `fzp-row${got ? ' is-got' : ''}${cur ? ' is-cur' : ''}`, style: cur ? `--f:${Math.round(pr.frac * 100)}%` : null, 'data-tier': String(n) },
        el('div', { class: 'fzp-cell free' }, f ? card(f) : el('span', { class: 'fzp-none', 'aria-hidden': 'true' })),
        el('div', { class: 'fzp-node', 'aria-hidden': 'true' }, String(n)),
        el('div', { class: 'fzp-cell prem' }, p ? card(p) : el('span', { class: 'fzp-none', 'aria-hidden': 'true' }))));
    }
    lad.replaceChildren(head, ...rows);
    if (scrollToCurrent) {
      const row = lad.querySelector(`[data-tier="${Math.max(1, pr.tier - 1)}"]`);
      if (row) requestAnimationFrame(() => { try { if (getComputedStyle(lad).overflowY === 'auto') lad.scrollTop = Math.max(0, row.offsetTop - 60); } catch { /* layout */ } });
    } else { lad.scrollTop = top; root.scrollTop = winTop; }
  }

  /* ---------- detail ---------- */
  /* 3D: the shop's own preview, opened on this item (shop-ui.js openShop focus). The pass builds no 3D of its own. */
  let shopOpen = false;
  const primary = () => WEAPONS.find(w => w.id === profile.data.primary) || WEAPONS.find(w => w.slot === 0);
  async function preview3d(tab, id) {
    if (shopOpen || st.closed || (engine && (engine.running || engine.loading))) return;
    shopOpen = true;
    try {
      const m = await import('./shop-ui.js');
      await m.openShop({ engine, profile, i18n, sfx: () => sfx(), focus: { tab, id }, onChange: () => { if (!st.closed) changed(); },
        onClose: () => { shopOpen = false; if (!st.closed) { changed(); root.querySelector('[data-fid="pass:3d-btn"]')?.focus({ preventScroll: true }); } } });
    } catch (e) { shopOpen = false; console.warn('[pass] shop preview', e); toast(T('failed'), true); }
  }
  function detailKids(r) {
    if (!r) return [el('p', { class: 'fzp-empty', text: T('tracks') })];
    const cs = cellState(r), it = r.kind === 'cr' ? null : PS.itemById(r.id), rar = it ? rarityOf(it.rarity) : null;
    const view = el('div', { class: 'fzp-dview', 'data-fid': 'pass:dview' }, pic(r));
    const kids = [view, el('div', { class: 'fzp-dhead' },
      rar ? el('span', { class: 'fzp-rar', style: `--r:${rar.color}`, text: PS.pick(rar.n, L()) }) : null,
      el('h3', { 'data-fid': 'pass:dname', text: rewardName(r) }),
      el('p', { class: 'fzp-meta', text: `${rewardKind(r)} · ${r.track === 'premium' ? T('premium') : T('free')} · ${T('tier', { n: r.tier })}${it ? ' · ' + T('exclusive') : ''}` }))];
    const acts = [];
    if (cs === 'claim') acts.push(el('button', { type: 'button', class: 'fzp-btn pri', 'data-fid': 'pass:claim', onclick: () => doClaim(r) }, T('claim')));
    else if (cs === 'tier') kids.push(el('p', { class: 'fzp-why', text: T('notYet', { n: r.tier }) }));
    else if (cs === 'locked') { kids.push(el('p', { class: 'fzp-why', text: T('locked') })); acts.push(el('button', { type: 'button', class: 'fzp-btn', 'data-fid': 'pass:goto-commission', onclick: () => { closeSheet(); side.querySelector('#fzp-com')?.scrollIntoView({ block: 'center' }); } }, T('commission'))); }
    if (it && cs === 'got') {
      if (r.kind === 'fin') {
        if (finishById(it.id) && pass.owns(it.id)) {
          const w = primary(), on = profile.data.cos && profile.data.cos.w && profile.data.cos.w[w.id] === it.id;
          acts.push(on ? el('button', { type: 'button', class: 'fzp-btn done', disabled: true, 'data-fid': 'pass:equip' }, T('applied', { w: w.name }))
            : el('button', { type: 'button', class: 'fzp-btn pri', 'data-fid': 'pass:equip', onclick: () => { if (profile.equipFin && profile.equipFin(w.id, it.id)) { sfx(); changed(); } } }, T('apply', { w: w.name })));
        }
      } else if (r.kind === 'fit') {
        if (!(profile.outfitOf && profile.outfitOf(it.id))) kids.push(el('p', { class: 'fzp-note', text: T('pendingFit') }));
        else if (pass.owns(it.id)) acts.push(profile.outfitWorn && profile.outfitWorn(it.id) ? el('button', { type: 'button', class: 'fzp-btn done', disabled: true, 'data-fid': 'pass:equip' }, T('worn'))
          : el('button', { type: 'button', class: 'fzp-btn pri', 'data-fid': 'pass:equip', onclick: () => { if (profile.wearOutfit && profile.wearOutfit(it.id)) { sfx(); changed(); } } }, T('wear')));
      } else if ((r.kind === 'emb' || r.kind === 'ban') && pass.owns(it.id)) {
        const on = state().equip[r.kind] === it.id;
        acts.push(on ? el('button', { type: 'button', class: 'fzp-btn', 'data-fid': 'pass:equip', onclick: async () => { await pass.equip(r.kind, null); sfx(); changed(); } }, T('remove'))
          : el('button', { type: 'button', class: 'fzp-btn pri', 'data-fid': 'pass:equip', onclick: async () => { if (await pass.equip(r.kind, it.id)) { sfx(); changed(); } } }, T('use')));
      }
    }
    const in3d = r.kind === 'fin' ? !!finishById(r.id) : r.kind === 'fit' ? !!(profile.outfitOf && profile.outfitOf(r.id)) : false;       // any state: see what a tier will give
    if (in3d && !(engine && engine.running)) acts.push(el('button', { type: 'button', class: 'fzp-btn', 'data-fid': 'pass:3d-btn', onclick: () => { sfx(); preview3d(r.kind === 'fin' ? 'finishes' : 'outfits', r.id); } }, T('preview3d')));
    if (acts.length) kids.push(el('div', { class: 'fzp-acts' }, acts));
    return kids;
  }
  function drawDetail() { detail.replaceChildren(...detailKids(st.sel)); }
  function closeSheet() { if (!st.sheet) return; const n = st.sheet; st.sheet = null; n.remove(); const b = st.sel && lad.querySelector(`[data-fid="pass:rw:${st.sel.track}:${st.sel.tier}"]`); if (b) b.focus({ preventScroll: true }); }
  function openSheet() {
    closeSheet();
    const box = el('div', { role: 'document' }, ...detailKids(st.sel), el('button', { type: 'button', class: 'fzp-btn', 'data-fid': 'pass:sheet-close', onclick: closeSheet }, T('back')));
    const n = el('div', { class: 'fzp-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': rewardName(st.sel), 'data-fid': 'pass:sheet', onclick: e => { if (e.target === n) closeSheet(); } }, box);
    st.sheet = n; root.append(n); (box.querySelector('.fzp-btn.pri') || box.querySelector('.fzp-btn'))?.focus({ preventScroll: true });
  }
  function select(r) { st.sel = r; if (wide()) { drawLadder(false); drawDetail(); } else { drawLadder(false); openSheet(); } }
  async function onCard(r, cs) { sfx(); if (cs === 'claim') { await doClaim(r); st.sel = r; if (wide()) drawDetail(); return; } select(r); }

  /* ---------- actions ---------- */
  function toast(text, bad) { root.querySelector('.fzp-toast')?.remove(); clearTimeout(st.toastT); const n = el('div', { class: `fzp-toast${bad ? ' bad' : ''}`, role: 'status', 'data-fid': 'pass:toast', text }); root.append(n); st.toastT = setTimeout(() => n.remove(), 3200); }
  async function doClaim(r) {
    const res = await pass.claim(r.tier, r.track);
    if (st.closed) return;
    if (res.ok) { try { if (audio && audio.buy) audio.buy(); else sfx(); } catch { /* optional */ } toast(T('got', { item: rewardName(r) })); }
    else if (res.reason !== 'claimed') toast(T('failed'), true);
    changed(true);
  }
  async function claimAll() {
    const got = await pass.claimAll(); if (st.closed) return;
    if (got.length) { try { if (audio && audio.buy) audio.buy(); else sfx(); } catch { /* optional */ } toast(got.length === 1 ? T('got', { item: rewardName(got[0]) }) : T('gotMany', { n: got.length })); }
    changed(true);
  }
  function closeDlg() { if (!st.dlg) return; const d = st.dlg; st.dlg = null; d.remove(); side.querySelector('[data-fid="pass:commission"]')?.focus({ preventScroll: true }); }
  function askCommission() {
    if (st.dlg || TEST) return;
    const c = pass.commission(); if (c.owned || c.missing > 0) { drawSide(); return; }
    const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; let paying = false;
    const yes = el('button', { type: 'button', class: 'fzp-btn pri', 'data-fid': 'pass:confirm', onclick: async () => {
      if (paying) return; paying = true; yes.disabled = true;
      const r = await pass.buyCommission(token); if (st.closed) return; closeDlg();
      if (r.ok) { try { if (audio && audio.buy) audio.buy(); } catch { /* optional */ } toast(T('bought')); }
      else if (r.reason === 'credits') toast(T('missing', { n: num(r.missing) }), true);
      else if (r.reason !== 'owned') toast(T('failed'), true);
      changed(true);
    } }, T('confirm'));
    const n = el('div', { class: 'fzp-dlg', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': T('confirmTitle'), 'data-fid': 'pass:dialog', onclick: e => { if (e.target === n) closeDlg(); } },
      el('div', { class: 'fzp-dbox' }, el('h3', { text: T('confirmTitle') }), el('p', { class: 'fzp-note', text: T('commission') }),
        el('div', { class: 'fzp-sum' }, el('span', { text: T('balance') }), el('b', { text: `${num(profile.data.cr)} ₡` }), el('span', { text: T('cost') }), el('b', { class: 'tot', text: `− ${num(c.credits)} ₡` }), el('span', { text: T('after') }), el('b', { text: `${num(profile.data.cr - c.credits)} ₡` })),
        el('div', { class: 'fzp-acts' }, yes, el('button', { type: 'button', class: 'fzp-btn', 'data-fid': 'pass:cancel', onclick: closeDlg }, T('cancel')))));
    st.dlg = n; root.append(n); yes.focus({ preventScroll: true });
  }
  function draw(scroll) { drawClock(); drawBal(); drawSide(); drawLadder(scroll); if (wide()) drawDetail(); }
  function changed(keepSheet) {
    drawClock(); drawBal(); drawSide(); drawLadder(false);
    if (wide()) drawDetail(); else if (st.sheet && keepSheet !== false) openSheet();
    if (onChange) { try { onChange(); } catch (e) { console.warn('[pass] change', e); } }
  }

  /* ---------- open and close ---------- */
  const offPass = pass.on(() => { if (!st.closed && !st.dlg) { drawSide(); drawLadder(false); } });
  const offProfile = profile.on ? profile.on(() => { if (!st.closed) drawBal(); }) : null;
  const offLang = i18n && i18n.on ? (() => { try { return i18n.on('change', () => { if (!st.closed) { brand.replaceChildren(el('h2', { text: T('title') }), el('span', { text: `${T('season', { n: S().num })} · ${PS.pick(S().name, L())}` })); draw(false); } }); } catch { return null; } })() : null;
  let offLoad = null; if (engine && engine.on) { try { offLoad = engine.on('loading', ev => { if (ev && ev.active) close(); }); } catch { /* optional */ } }
  const clockT = setInterval(() => { if (!st.closed) { drawClock(); } }, 30000);
  const mq = (() => { try { return matchMedia('(min-width:1280px)'); } catch { return null; } })(), onMq = () => { if (st.closed) return; closeSheet(); if (wide()) drawDetail(); };
  if (mq && mq.addEventListener) mq.addEventListener('change', onMq);
  const onKey = e => { if (e.key !== 'Escape' || shopOpen) return; e.stopPropagation();       // the shop on top handles its own Escape
 e.preventDefault(); if (st.dlg) closeDlg(); else if (st.sheet) closeSheet(); else close(); };
  document.addEventListener('keydown', onKey, true);
  function close() {
    if (st.closed) return; st.closed = true; clearInterval(clockT); clearTimeout(st.toastT);
    for (const off of [offPass, offProfile, offLoad]) { try { if (typeof off === 'function') off(); } catch { /* gone */ } }
    try { if (typeof offLang === 'function') offLang(); } catch { /* gone */ }
    if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq);
    document.removeEventListener('keydown', onKey, true); root.remove();
    if (onClose) { try { onClose(); } catch { /* menu */ } }
  }
  root.append(el('div', { class: 'fzp-body' }, side, lad, detail));
  document.body.append(root);
  const s0 = S(), cur = PS.tierProgress(state().xp, s0).tier;
  st.sel = PS.rewardAt(s0, cur, 'premium') || PS.rewardAt(s0, 1, 'premium');
  draw(true);
  root.querySelector('[data-fid="pass:close"]')?.focus({ preventScroll: true });
  return { close, get state() { return st; }, redraw: () => draw(false), select: (tier, track) => { const r = PS.rewardAt(S(), tier, track); if (r) select(r); } };
}
