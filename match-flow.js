/* FRONT ZÉRO - fin de partie en ligne : résultats, vote de carte, partie suivante.
   Le serveur (room-vote.js) décide de tout : cartes proposées, minuteries, votes, résultat, lancement. Ce module ne fait qu'afficher ce qu'il reçoit.
   Les comptes à rebours suivent une minuterie, jamais requestAnimationFrame : un onglet en arrière-plan reste à l'heure. */
import { rewardBlock } from './attachments-ui.js';

const XP_PER_LEVEL = 1000, TICK_MS = 120;
const MODE_KEY = { ffa: 'mode.deathmatch', tdm: 'mode.teams', dom: 'mode.domination', bomb: 'mode.bomb', zombie: 'mode.zombies', zone: 'mode.zone' };
const HOW_KEY = { votes: 'flow.howVotes', tie: 'flow.howTie', none: 'flow.howNone', random: 'flow.howRandom' };
const WHY_KEY = { host: 'flow.msgHost', players: 'flow.msgPlayers', compat: 'flow.msgCompat', error: 'flow.msgError' };
const CLOCK_KEY = { results: 'flow.clockResults', vote: 'flow.clockVote', winner: 'flow.clockWinner' };

const CSS = `
.fzf{--panel:rgba(24,27,19,.92);--line:rgba(201,185,143,.18);--line-2:rgba(201,185,143,.38);--sand:#d8c9a3;--dim:#a5a18a;--white:#f4ecd8;--amber:#e8a628;--amber-2:#ffc041;--ink:#181407;--red:#ec8068;--green:#8fc46a;--blue:#7fb2e6;
position:fixed;inset:0;z-index:15;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#0d0f0b radial-gradient(120% 90% at 16% 110%,rgba(232,166,40,.10),transparent 60%);color:var(--sand);font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:19px;line-height:1.25;cursor:default;outline:none;overflow:hidden;-webkit-user-select:none;user-select:none}
.fzf[hidden]{display:none}
.fzf *{box-sizing:border-box}
.fzf :focus-visible{outline:2px solid var(--white);outline-offset:2px}
.fzf-prog{position:absolute;top:0;left:0;right:0;height:4px;background:rgba(201,185,143,.12)}
.fzf-prog i{display:block;height:100%;background:var(--amber);transform-origin:left;transition:transform .12s linear}
.fzf-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:clamp(12px,2.2vh,22px) clamp(16px,3vw,44px) clamp(6px,1vh,12px)}
.fzf-eyebrow{min-width:0;font-size:clamp(15px,1.3vw,18px);font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fzf-clock{flex:none;display:flex;align-items:baseline;gap:10px;color:var(--white)}
.fzf-clock span{font-size:clamp(14px,1.2vw,17px);font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.fzf-clock b{min-width:2ch;text-align:right;font-size:clamp(34px,3.6vw,50px);font-weight:800;line-height:1;font-variant-numeric:tabular-nums;color:var(--amber)}
.fzf.is-urgent .fzf-clock b{color:var(--red)}
.fzf-body{min-height:0;overflow-y:auto;padding:clamp(4px,1vh,12px) clamp(16px,3vw,44px)}
.fzf-foot{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 16px;padding:clamp(8px,1.6vh,16px) clamp(16px,3vw,44px) clamp(12px,2.2vh,20px);border-top:1px solid var(--line);background:rgba(8,10,6,.6)}
.fzf-status{min-width:0;font-size:clamp(17px,1.4vw,20px);font-weight:600;letter-spacing:.04em;color:var(--sand)}
.fzf-acts{display:flex;flex-wrap:wrap;gap:10px;margin-left:auto}
.fzf-btn{min-height:44px;padding:0 20px;font:inherit;font-size:18px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sand);background:transparent;border:1px solid var(--line-2);cursor:pointer;transition:background .12s,color .12s,border-color .12s}
.fzf-btn:hover{background:rgba(201,185,143,.12);color:var(--white)}
.fzf-btn--main{color:var(--ink);background:var(--amber);border-color:var(--amber)}
.fzf-btn--main:hover{color:var(--ink);background:var(--amber-2);border-color:var(--amber-2)}
.fzf-res{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:clamp(18px,3vw,48px);align-items:center;min-height:100%}
.fzf-verdict{display:grid;gap:clamp(10px,1.8vh,18px);min-width:0}
.fzf-title{margin:0;font-size:clamp(48px,7.4vw,112px);font-weight:800;letter-spacing:.015em;line-height:.92;text-transform:uppercase;overflow-wrap:anywhere;color:var(--white)}
.fzf-res.is-won .fzf-title{color:var(--amber)}
.fzf-res.is-lost .fzf-title{color:var(--red)}
.fzf-stats{display:flex;flex-wrap:wrap;gap:8px}
.fzf-stat{flex:1 1 92px;max-width:170px;padding:7px 12px;background:var(--panel);border:1px solid var(--line)}
.fzf-stat b{display:block;font-size:clamp(24px,2.3vw,32px);font-weight:800;line-height:1.05;color:#fff;font-variant-numeric:tabular-nums}
.fzf-stat span{display:block;font-size:13px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fzf-rew{display:grid;gap:9px;padding:clamp(10px,1.6vh,16px) 16px;background:var(--panel);border:1px solid var(--line)}
.fzf-rew-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 26px}
.fzf-gain{display:flex;align-items:baseline;gap:8px}
.fzf-gain b{font-size:clamp(25px,2.4vw,33px);font-weight:800;color:var(--amber);font-variant-numeric:tabular-nums}
.fzf-gain span{font-size:14px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.fzf-lvl-line{display:flex;justify-content:space-between;gap:12px;font-size:16px;font-weight:600;color:var(--sand);font-variant-numeric:tabular-nums}
.fzf-lvl-bar{height:6px;margin-top:4px;background:rgba(201,185,143,.16);overflow:hidden}
.fzf-lvl-bar i{display:block;height:100%;background:var(--amber);transition:width .8s cubic-bezier(.2,.7,.2,1)}
.fzf-lvl-bar i.is-snap{transition:none}
.fzf-up{font-size:18px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--green)}
.fzf-board{min-width:0;background:var(--panel);border:1px solid var(--line)}
.fzf-board h2{margin:0;padding:10px 16px;font-size:16px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line)}
.fzf-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.fzf-table th{padding:6px 8px;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-align:right;color:var(--dim)}
.fzf-table td{padding:6px 8px;font-size:clamp(18px,1.5vw,21px);font-weight:600;text-align:right;border-top:1px solid var(--line)}
.fzf-table th:first-child,.fzf-table td:first-child{width:34px;padding-left:16px;text-align:left;color:var(--dim)}
.fzf-table th:nth-child(2),.fzf-table td:nth-child(2){width:auto;text-align:left;color:var(--white);overflow-wrap:anywhere}
.fzf-table th:last-child,.fzf-table td:last-child{padding-right:16px}
.fzf-table tr.is-me td{background:rgba(232,166,40,.12)}
.fzf-table tr.is-me td:nth-child(2){color:var(--amber-2)}
.fzf-team{display:inline-block;width:8px;height:8px;margin-right:8px;vertical-align:1px;background:var(--blue)}
.fzf-team.is-b{background:var(--red)}
.fzf-vote{display:flex;flex-direction:column;gap:clamp(8px,1.6vh,16px);min-height:100%;justify-content:center}
.fzf-vtitle{margin:0;font-size:clamp(30px,3.6vw,52px);font-weight:800;letter-spacing:.02em;line-height:1;text-transform:uppercase;color:var(--white)}
.fzf-vhint{margin:-4px 0 0;font-size:clamp(16px,1.3vw,19px);color:var(--dim)}
.fzf-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:clamp(8px,1vw,14px)}
.fzf-card{position:relative;display:flex;flex-direction:column;min-width:0;padding:0;font:inherit;color:var(--sand);text-align:left;background:var(--panel);border:2px solid var(--line);cursor:pointer;transition:border-color .12s,transform .12s,background .12s}
.fzf-card:hover{border-color:var(--line-2);transform:translateY(-2px)}
.fzf-card.is-mine{border-color:var(--amber);background:rgba(50,40,16,.92)}
.fzf-shot{position:relative;display:block;aspect-ratio:16/10;overflow:hidden;background:#1a1d14}
.fzf-shot img{display:block;width:100%;height:100%;object-fit:cover}
.fzf-shot--random{display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(135deg,#1c1f15 0 14px,#23271a 14px 28px)}
.fzf-shot--random b{font-size:clamp(46px,5.4vw,80px);font-weight:800;line-height:1;color:var(--amber)}
.fzf-tick{position:absolute;top:6px;right:6px;padding:2px 8px;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);background:var(--amber)}
.fzf-tick[hidden]{display:none}
.fzf-cbody{display:grid;gap:5px;padding:8px 10px 9px}
.fzf-name{font-size:clamp(18px,1.55vw,23px);font-weight:700;line-height:1.05;color:var(--white);overflow-wrap:anywhere;min-height:2.1em}
.fzf-count{display:flex;align-items:baseline;justify-content:space-between;gap:6px;font-size:14px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}
.fzf-count b{font-size:22px;font-weight:800;letter-spacing:0;color:var(--white);font-variant-numeric:tabular-nums}
.fzf-meter{height:5px;background:rgba(201,185,143,.15);overflow:hidden}
.fzf-meter i{display:block;height:100%;width:100%;background:var(--amber);transform:scaleX(0);transform-origin:left;transition:transform .18s ease-out}
.fzf-win{position:relative;display:flex;align-items:flex-end;min-height:100%;overflow:hidden;border:1px solid var(--line);background:#14170f}
.fzf-win img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.fzf-win::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(8,9,6,.92),rgba(8,9,6,.2) 58%,rgba(8,9,6,.05))}
.fzf-win-text{position:relative;z-index:1;display:grid;gap:4px;padding:clamp(16px,3vw,40px)}
.fzf-win-text small{font-size:clamp(16px,1.5vw,21px);font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--amber)}
.fzf-win-text h2{margin:0;font-size:clamp(42px,7vw,104px);font-weight:800;line-height:.95;text-transform:uppercase;color:var(--white);overflow-wrap:anywhere}
.fzf-win-text p{margin:0;font-size:clamp(17px,1.6vw,22px);color:var(--sand)}
.fzf-note{position:fixed;top:18px;left:50%;z-index:25;width:max-content;max-width:calc(100vw - 32px);padding:10px 18px;transform:translateX(-50%);font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:20px;font-weight:600;color:#f4ecd8;background:#14170f;border:1px solid rgba(201,185,143,.38);border-left:4px solid #e8a628;pointer-events:none}
@media (min-width:1001px) and (min-height:660px){.fzf-shot{aspect-ratio:4/3}}
@media (max-width:1000px){.fzf-cards{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:760px){
.fzf-res{grid-template-columns:minmax(0,1fr);align-items:start;align-content:start}
.fzf-cards{grid-template-columns:repeat(2,minmax(0,1fr))}
.fzf-card:last-child{grid-column:1/-1}
.fzf-card:last-child .fzf-shot{aspect-ratio:16/4}
.fzf-name{min-height:0}
.fzf-acts{width:100%}
.fzf-acts .fzf-btn{flex:1 1 140px;padding:0 10px;font-size:16px}
.fzf-status{width:100%}
}
@media (max-height:560px){.fzf-shot{aspect-ratio:16/7}.fzf-name{min-height:0}.fzf-title{font-size:clamp(38px,6vw,64px)}}
@media (prefers-reduced-motion:reduce){.fzf *{transition:none!important}}
`;

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k of Object.keys(attrs)) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

export function installMatchFlow({ net, engine, menu, i18n, profile, audio, MAPS }) {
  if (!net || !engine || !menu || typeof menu.leaveRoom !== 'function' || typeof net.sendFlow !== 'function') return null;
  const T = (k, p) => i18n.t(k, p);
  const shotUrl = id => new URL(`map-shots/${encodeURIComponent(id)}.webp`, import.meta.url).href;
  const mapName = id => { const k = 'map.' + id, s = i18n.t(k); if (s && s !== k) return s; const m = (MAPS || []).find(x => x.id === id); return m ? m.name : id; };
  const modeName = id => { const k = MODE_KEY[id]; return k ? T(k) : String(id || ''); };
  const put = (e, s) => { if (e && e.textContent !== s) e.textContent = s; };
  const fmt = n => { try { return Number(n).toLocaleString(i18n.lang); } catch { return String(n); } };
  const sfx = () => { try { if (audio && audio.ui) audio.ui(); } catch { /* optional */ } };

  let S = null, result = null, deadline = 0, timer = 0, built = '', lastSec = -1, preload = [], note = null, noteTimer = 0;
  const anim = [];
  const stopAnim = () => { while (anim.length) { const t = anim.pop(); clearTimeout(t); clearInterval(t); } };

  if (!document.getElementById('fzf-style')) document.head.append(h('style', { id: 'fzf-style', text: CSS }));
  const bar = h('i'), eyebrow = h('div', { class: 'fzf-eyebrow' }), clockLabel = h('span'), clockNum = h('b');
  const body = h('div', { class: 'fzf-body' }), status = h('div', { class: 'fzf-status', role: 'status' });
  const btnLobby = h('button', { class: 'fzf-btn fzf-btn--main', type: 'button', 'data-fid': 'flow:lobby', 'data-act': 'lobby' });
  const btnLeave = h('button', { class: 'fzf-btn', type: 'button', 'data-fid': 'flow:leave', 'data-act': 'leave' });
  const root = h('div', { class: 'fzf', id: 'fz-flow', role: 'dialog', 'aria-modal': 'true', tabindex: '-1', hidden: true },
    h('div', { class: 'fzf-prog', 'aria-hidden': 'true' }, bar),
    h('div', { class: 'fzf-head' }, eyebrow, h('div', { class: 'fzf-clock', role: 'timer' }, clockLabel, clockNum)),
    body,
    h('div', { class: 'fzf-foot' }, status, h('div', { class: 'fzf-acts' }, btnLobby, btnLeave)));
  document.body.append(root);

  /* ---------- écrans ---------- */
  function viewResults() {
    const e = menu.lastEnd, r = result, won = r ? r.won : null;
    const verdict = won === true ? 'end.victory' : won === false ? 'end.defeat' : 'end.draw';
    const title = r ? (r.title || T(verdict)) : T('flow.over');
    const stats = r && Array.isArray(r.stats) ? r.stats.filter(s => s && typeof s === 'object').slice(0, 5) : [];
    let rewards = null;
    if (r) {
      const xpAfter = e ? e.xpAfter : profile.data.xp, xpBefore = e ? e.xpBefore : Math.max(0, xpAfter - (r.xp || 0));
      const lvlB = Math.floor(xpBefore / XP_PER_LEVEL) + 1, lvlA = Math.floor(xpAfter / XP_PER_LEVEL) + 1, up = lvlA > lvlB;
      const rank = l => T('rank.' + Math.min(Math.max(l, 1) - 1, 9));
      const cr = h('b', { text: '+0 ₡' }), xp = h('b', { text: '+0 XP' }), lvl = h('span', { text: `${rank(lvlB)} · ${T('flow.level', { n: lvlB })}` }), into = h('span', { text: `${fmt(xpBefore % XP_PER_LEVEL)} / ${fmt(XP_PER_LEVEL)} XP` });
      const fill = h('i', { class: 'is-snap', style: `width:${(xpBefore % XP_PER_LEVEL) / XP_PER_LEVEL * 100}%` }), upLine = h('div', { class: 'fzf-up', hidden: true, text: `${T('flow.levelUp')} · ${T('flow.level', { n: lvlA })} · ${rank(lvlA)}` });
      let unlocks = null;
      try { if (e && e.unlocks && e.unlocks.length) unlocks = rewardBlock(e.unlocks, () => i18n.lang); } catch { /* optional */ }
      rewards = h('div', { class: 'fzf-rew' },
        h('div', { class: 'fzf-rew-row' }, h('div', { class: 'fzf-gain' }, cr, h('span', { text: T('end.credits') })), h('div', { class: 'fzf-gain' }, xp, h('span', { text: T('flow.xp') }))),
        upLine, unlocks,
        h('div', null, h('div', { class: 'fzf-lvl-line' }, lvl, into), h('div', { class: 'fzf-lvl-bar' }, fill)));
      const credits = Math.max(0, r.credits | 0), gain = Math.max(0, r.xp | 0), done = () => {
        cr.textContent = `+${fmt(credits)} ₡`; xp.textContent = `+${fmt(gain)} XP`; lvl.textContent = `${rank(lvlA)} · ${T('flow.level', { n: lvlA })}`;
        into.textContent = `${fmt(xpAfter % XP_PER_LEVEL)} / ${fmt(XP_PER_LEVEL)} XP`; upLine.hidden = !up;
      };
      let step = 0;
      const count = setInterval(() => { step++; const k = 1 - Math.pow(1 - step / 18, 3); cr.textContent = `+${fmt(Math.round(credits * k))} ₡`; xp.textContent = `+${fmt(Math.round(gain * k))} XP`; if (step >= 18) clearInterval(count); }, 34);
      anim.push(count);
      anim.push(setTimeout(() => { fill.classList.remove('is-snap'); fill.style.width = up ? '100%' : `${(xpAfter % XP_PER_LEVEL) / XP_PER_LEVEL * 100}%`; }, 240));
      anim.push(setTimeout(() => { if (up) { fill.classList.add('is-snap'); fill.style.width = '0%'; void fill.offsetWidth; fill.classList.remove('is-snap'); fill.style.width = `${(xpAfter % XP_PER_LEVEL) / XP_PER_LEVEL * 100}%`; } done(); }, up ? 1100 : 760));
    }
    const rows = (S.board || []).slice().sort((a, b) => (b.score - a.score) || (b.kills - a.kills));
    const teams = rows.some(q => q.team === 'A' || q.team === 'B');
    const board = h('section', { class: 'fzf-board' }, h('h2', { text: T('flow.board') }),
      h('table', { class: 'fzf-table' },
        h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: T('flow.player') }),
          h('th', { text: T('flow.k'), title: T('flow.kills') }), h('th', { text: T('flow.d'), title: T('flow.deaths') }), h('th', { text: T('flow.a'), title: T('flow.assists') }), h('th', { text: T('flow.score') }))),
        h('tbody', null, rows.map((q, i) => h('tr', { class: q.id === net.id ? 'is-me' : null },
          h('td', { text: String(i + 1) }),
          h('td', null, teams && q.team ? h('i', { class: `fzf-team${q.team === 'B' ? ' is-b' : ''}`, 'aria-hidden': 'true' }) : null, q.name || '—'),
          h('td', { text: String(q.kills) }), h('td', { text: String(q.deaths) }), h('td', { text: String(q.assists) }), h('td', { text: fmt(q.score) }))))));
    return h('div', { class: `fzf-res${won === true ? ' is-won' : won === false ? ' is-lost' : ''}` },
      h('section', { class: 'fzf-verdict' }, h('h1', { class: 'fzf-title', text: title }),
        stats.length ? h('div', { class: 'fzf-stats' }, stats.map(s => h('div', { class: 'fzf-stat' }, h('b', { text: String(s.value ?? '') }), h('span', { text: String(s.label ?? '') })))) : null,
        rewards,
        r ? (() => { try { return globalThis.FZPass && globalThis.FZPass.endBlock ? globalThis.FZPass.endBlock('flow') : null; } catch { return null; } })() : null,       // season pass (pass.js)
        (() => { try { return globalThis.FZReplay && globalThis.FZReplay.endBlock ? globalThis.FZReplay.endBlock('flow') : null; } catch { return null; } })()),       // best moment (replay-rec.js)
      board);
  }
  const cards = new Map();
  function card(id) {
    const random = id === 'random', tick = h('span', { class: 'fzf-tick', hidden: true, text: T('flow.mine') }), count = h('b', { text: '0' }), meter = h('i');
    let shot;
    if (random) shot = h('span', { class: 'fzf-shot fzf-shot--random' }, h('b', { text: '?', 'aria-hidden': 'true' }), tick);
    else {
      const img = h('img', { src: shotUrl(id), alt: '', decoding: 'async', draggable: 'false' });
      img.addEventListener('error', () => img.remove(), { once: true });
      shot = h('span', { class: 'fzf-shot' }, img, tick);
    }
    const name = random ? T('flow.random') : mapName(id);
    const btn = h('button', { class: 'fzf-card', type: 'button', 'data-fid': `flow:vote:${id}`, 'data-v': id, 'aria-pressed': 'false', title: random ? T('flow.randomHint') : null },
      shot, h('span', { class: 'fzf-cbody' }, h('span', { class: 'fzf-name', text: name }),
        h('span', { class: 'fzf-count' }, h('span', { text: T('flow.votes') }), count),
        h('span', { class: 'fzf-meter', 'aria-hidden': 'true' }, meter)));
    cards.set(id, { btn, tick, count, meter, name });
    return btn;
  }
  function viewVote() {
    cards.clear();
    return h('div', { class: 'fzf-vote' }, (() => { try { return globalThis.FZReplay && globalThis.FZReplay.endBlock ? globalThis.FZReplay.endBlock('vote') : null; } catch { return null; } })(),       // best moment (replay-rec.js)
      h('h2', { class: 'fzf-vtitle', text: T('flow.voteTitle') }), h('p', { class: 'fzf-vhint', text: T('flow.voteHint') }),
      h('div', { class: 'fzf-cards' }, S.maps.map(card), card('random')));
  }
  function paintVotes() {
    const tally = S.tally || {}, most = Math.max(1, S.voters || 1);
    for (const [id, c] of cards) {
      const n = tally[id] || 0, mine = S.mine === id;
      put(c.count, String(n));
      c.meter.style.transform = `scaleX(${Math.min(1, n / most)})`;
      c.tick.hidden = !mine;
      c.btn.classList.toggle('is-mine', mine);
      c.btn.setAttribute('aria-pressed', mine ? 'true' : 'false');
      c.btn.setAttribute('aria-label', `${c.name} : ${n} ${T('flow.votes')}${mine ? ' · ' + T('flow.mine') : ''}`);
    }
  }
  function viewWinner() {
    const img = h('img', { src: shotUrl(S.pick), alt: '', decoding: 'async' });
    img.addEventListener('error', () => img.remove(), { once: true });
    return h('div', { class: 'fzf-win' }, img, h('div', { class: 'fzf-win-text' },
      h('small', { text: T('flow.next') }), h('h2', { text: mapName(S.pick) }), h('p', { text: T(HOW_KEY[S.how] || HOW_KEY.votes) })));
  }

  /* ---------- affichage ---------- */
  function paintFrame() {
    put(eyebrow, `${modeName(S.mode)} · ${mapName(S.played)}`);
    put(clockLabel, T(CLOCK_KEY[S.phase]));
    put(btnLobby, T('flow.backLobby')); put(btnLeave, T('flow.leave'));
    btnLobby.hidden = S.hostId !== net.id;
    put(status, S.phase === 'vote' ? T('flow.voted', { n: S.voted, m: S.voters }) : S.phase === 'winner' ? T('flow.starting') : T('flow.nextVote'));
    root.setAttribute('aria-label', S.phase === 'vote' ? T('flow.voteTitle') : S.phase === 'winner' ? T('flow.next') : T('flow.over'));
  }
  function draw(force) {
    if (!S) return;
    const key = `${S.phase}:${S.phase === 'winner' ? S.pick : S.maps.join(',')}:${S.phase === 'results' ? (result ? 'r' : 'n') : ''}:${i18n.lang}`;
    if (force || key !== built) {
      built = key; stopAnim();
      body.textContent = '';
      body.append(S.phase === 'results' ? viewResults() : S.phase === 'vote' ? viewVote() : viewWinner());
      body.scrollTop = 0;
    }
    paintFrame();
    if (S.phase === 'vote') paintVotes();
    tick();
  }
  function tick() {
    if (!S) return;
    const left = Math.max(0, deadline - performance.now()), sec = Math.ceil(left / 1000);
    bar.style.transform = `scaleX(${S.total > 0 ? Math.min(1, left / S.total) : 0})`;
    if (sec !== lastSec) { lastSec = sec; put(clockNum, String(sec)); root.classList.toggle('is-urgent', S.phase === 'vote' && sec <= 5); }
  }
  function show() {
    if (!root.hidden) return;
    root.hidden = false;
    clearNote();
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch { /* already released */ } }
    clearInterval(timer); timer = setInterval(tick, TICK_MS);
    try { root.focus({ preventScroll: true }); } catch { /* optional */ }
  }
  function close() {
    root.hidden = true;
    clearInterval(timer); timer = 0; stopAnim();
    body.textContent = ''; cards.clear(); preload = [];
    S = null; result = null; built = ''; lastSec = -1;
  }
  function clearNote() { clearTimeout(noteTimer); if (note) { note.remove(); note = null; } }
  function showNote(text) {
    clearNote();
    note = h('div', { class: 'fzf-note', role: 'status', text });
    document.body.append(note);
    noteTimer = setTimeout(clearNote, 5000);
  }
  function toLobby(why) {
    const was = !root.hidden || !!S;
    close();
    engine.lockNeedsFocus = false;
    if (was) { try { menu.show('multi'); } catch (e) { console.error('[flow] menu.show', e); } }
    const k = WHY_KEY[why];
    if (k) showNote(T(k));
  }

  /* ---------- réseau ---------- */
  root.addEventListener('click', e => {
    const b = e.target.closest ? e.target.closest('button') : null;
    if (!b || !S) return;
    if (b.dataset.v) { if (S.phase === 'vote' && S.mine !== b.dataset.v) { sfx(); net.sendFlow({ a: 'vote', id: b.dataset.v }); } return; }
    if (b.dataset.act === 'lobby') { sfx(); net.sendFlow({ a: 'lobby' }); return; }
    if (b.dataset.act === 'leave') {
      sfx(); close(); engine.lockNeedsFocus = false;
      try { menu.leaveRoom(); menu.show('multi'); } catch (x) { console.error('[flow] leave', x); }
    }
  });
  net.on('end', e => { if (e && e.flow === 1) { engine.lockNeedsFocus = true; result = null; } });
  engine.on('matchEnd', r => { if (engine.lockNeedsFocus) { result = r || null; if (S && S.phase === 'results') draw(true); } });
  net.on('flow', m => {
    if (!m) return;
    if (m.op === 'lobby') return toLobby(m.why);
    if (m.op !== 'state') return;
    engine.lockNeedsFocus = true;
    // A load for the match that just ended must not swallow the next 'start'; a match still running here is over for the server.
    try { if (engine.loading) { engine.stopLoad(); menu.show('multi'); } else if (engine.running) engine.quit(); } catch (e) { console.error('[flow] stop', e); }
    const prev = S;
    S = { ...m, board: m.board || (prev && prev.board) || null };
    deadline = performance.now() + (m.left || 0);
    if (!prev && m.maps) preload = m.maps.map(id => { const i = new Image(); i.decoding = 'async'; i.src = shotUrl(id); return i; });
    show();
    draw(false);
  });
  net.on('start', () => { if (S || !root.hidden) close(); });
  net.on('close', () => { if (S || !root.hidden) toLobby(null); engine.lockNeedsFocus = false; });
  i18n.on('change', () => { if (S) draw(true); });

  net.flowClient = true;
  return { get phase() { return S ? S.phase : null; }, get state() { return S; }, root };
}
