// FRONT ZÉRO — arsenal customisation screen and level rewards. Opened from menu.js; keeps its own DOM and scoped CSS.
import { WEAPONS, TEST_UNLOCK_ALL } from './data.js';
import { ATTACHMENTS, ATT_SLOTS, slotsOf, applyAttachments, attText, rewardName, unlockLine, XP_PER_LEVEL } from './attachments.js';

const CSS = `
.fza{position:fixed;inset:0;z-index:60;background:#0f1211;color:#e8e4d8;overflow-y:auto;font:14px/1.4 inherit;-webkit-overflow-scrolling:touch}
.fza *{box-sizing:border-box}
.fza-in{max-width:1080px;margin:0 auto;padding:18px 16px 32px}
.fza-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.fza-top h2{margin:0;font-size:22px;letter-spacing:.04em;text-transform:uppercase;flex:1;min-width:160px}
.fza-back{min-height:44px;padding:0 18px;background:#2a2d2a;color:#e8e4d8;border:1px solid #4a4e48;border-radius:3px;font:inherit;font-weight:600;cursor:pointer}
.fza-back:hover,.fza-back:focus-visible{background:#3a3e38;outline:2px solid #e8a628;outline-offset:1px}
.fza-lvl{display:flex;flex-direction:column;gap:3px;min-width:190px;font-size:12px;color:#b5b1a4}
.fza-lvl b{color:#e8a628;font-size:14px}
.fza-bar{height:5px;background:#2c2f2c}.fza-bar i{display:block;height:100%;background:#e8a628}
.fza-next{margin:0 0 12px;padding:9px 12px;background:#1d201d;border-left:3px solid #e8a628;font-size:13px}
.fza-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:16px;align-items:start}
.fza-prev{background:#141716;border:1px solid #33372f;position:relative}
.fza-prev .fza-chips{padding:0 8px 8px}
.fza-draw{background:linear-gradient(180deg,#747a68,#4d5246);padding:8px}
.fza-prev svg{display:block;width:100%;height:auto}
.fza-view{position:relative;width:100%;aspect-ratio:2.2;overflow:hidden}
.fza-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .18s;cursor:grab;touch-action:pan-y;outline:none}
.fza-view canvas.is-on{opacity:1}.fza-view canvas:active{cursor:grabbing}.fza-view canvas:focus-visible{box-shadow:inset 0 0 0 2px #e8a628}
.fza-view .fza-draw{position:absolute;inset:0;display:flex;align-items:center}.fza-view.is-3d .fza-draw{visibility:hidden}
.fza-draw img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.fza-draw img{opacity:0}.fza-draw.has-shot img{opacity:1}.fza-draw.has-shot svg{visibility:hidden}
.fza-chips{display:flex;flex-wrap:wrap;gap:5px;min-height:24px;margin-top:6px}
.fza-chips span{font-size:11px;padding:2px 7px;background:#2d312b;border-radius:2px;color:#d9d5c8}
.fza-stats{margin-top:12px;display:grid;gap:7px}
.fza-st{display:grid;grid-template-columns:112px 1fr 92px;gap:8px;align-items:center;font-size:12px}
.fza-st span:last-child{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.fza-track{position:relative;height:8px;background:#2a2d2a;overflow:hidden}
.fza-track i{position:absolute;left:0;top:0;bottom:0;background:#7d8178}
.fza-track u{position:absolute;top:0;bottom:0;text-decoration:none}
.fza-track u.up{background:#6fbf6a}.fza-track u.down{background:#d9654b}
.fza-up{color:#8bd486}.fza-down{color:#ec8068}
.fza-slot{margin-bottom:12px}
.fza-slot h3{margin:0 0 5px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b5b1a4}
.fza-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:6px}
.fza-opt{min-height:52px;padding:6px 9px;text-align:left;background:#20231f;color:#e8e4d8;border:1px solid #3a3e38;border-radius:3px;font:inherit;font-size:12.5px;cursor:pointer;display:flex;flex-direction:column;justify-content:center;gap:2px}
.fza-opt small{font-size:11px;color:#a5a194;line-height:1.25}
.fza-opt:hover:not([disabled]),.fza-opt:focus-visible{border-color:#e8a628;outline:none}
.fza-opt.is-on{background:#3b3320;border-color:#e8a628}
.fza-opt[disabled]{opacity:.55;cursor:not-allowed}
.fza-note{font-size:12px;color:#a5a194;margin:6px 0 0}
@media (max-width:760px){.fza-grid{grid-template-columns:minmax(0,1fr)}.fza-st{grid-template-columns:96px 1fr 84px}.fza-top h2{font-size:18px}}
.fzr{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:70;width:min(440px,calc(100vw - 32px));background:#231f14;border:1px solid #e8a628;color:#f3ecd8;padding:12px 14px;box-shadow:0 6px 24px rgba(0,0,0,.6)}
.fzr b{display:block;color:#e8a628;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
.fzr p{margin:2px 0;font-size:14px}
.fzr button{margin-top:8px;min-height:40px;padding:0 16px;background:#e8a628;color:#1c1608;border:0;border-radius:3px;font:inherit;font-weight:700;cursor:pointer}
.fza-rewards{margin:12px 0 0;padding:10px 12px;background:#2a2412;border:1px solid #e8a628}
.fza-rewards b{display:block;color:#e8a628;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px}
.fza-rewards p{margin:2px 0;font-size:14px}
`;
let cssDone = false;
const injectCss = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };
function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  if (props) for (const k of Object.keys(props)) { if (props[k] === null || props[k] === undefined) continue; if (k === 'text') n.textContent = props[k]; else if (k.startsWith('on')) n.addEventListener(k.slice(2), props[k]); else n.setAttribute(k, props[k] === true ? '' : props[k]); }
  for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c);
  return n;
}
/* stat rows: value 0..1 for the bar, better = higher on screen */
const pct = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`;
function statRows(b, w, T) {
  const r = [];
  const row = (key, baseBar, nowBar, text, better) => r.push({ key, baseBar, nowBar, text, better });
  if (b.kind === 'melee') return r;
  row('s_rec', 1 - Math.min(1, b.rec * 9), 1 - Math.min(1, w.rec * 9), w.rec === b.rec ? '—' : pct(w.rec / b.rec - 1), w.rec < b.rec);
  row('s_spread', 1 - Math.min(1, b.spread * 9), 1 - Math.min(1, w.spread * 9), w.spread === b.spread ? '—' : pct(b.spread / w.spread - 1), w.spread < b.spread);
  { const h = w.hipK ?? 1; row('s_hip', .5, Math.max(0, Math.min(1, .5 + (1 - h) * 2)), h === 1 ? '—' : pct(1 / h - 1), h < 1); }
  { const a = w.aimK ?? 1; row('s_aim', .6, Math.max(0, Math.min(1, .6 + (1 - a) * 1.4)), a === 1 ? '—' : pct(1 / a - 1), a < 1); }
  if (b.reload > 0) row('s_reload', 1 - Math.min(1, b.reload / 5), 1 - Math.min(1, w.reload / 5), w.reload === b.reload ? `${b.reload.toFixed(1)} s` : `${w.reload.toFixed(2)} s`, w.reload < b.reload);
  row('s_mag', Math.min(1, b.mag / 110), Math.min(1, w.mag / 110), w.mag === b.mag ? String(b.mag) : `${b.mag} → ${w.mag}`, w.mag > b.mag);
  row('s_mob', (b.mob - .6) / .6, (w.mob - .6) / .6, w.mob === b.mob ? `${Math.round(b.mob * 100)} %` : `${Math.round(w.mob * 100)} %`, w.mob > b.mob);
  { const f = w.flashK ?? 1; row('s_flash', .6, Math.min(1, .6 * f), f === 1 ? '—' : pct(f - 1), f < 1); }
  { const l = w.loudK ?? 1; row('s_loud', .6, Math.min(1, .6 * l), l === 1 ? '—' : pct(l - 1), l < 1); }
  return r.map(x => {
    const same = Math.abs(x.nowBar - x.baseBar) < .0005, lo = Math.min(x.baseBar, x.nowBar), hi = Math.max(x.baseBar, x.nowBar);
    const good = x.better;       // less flash or noise is a shorter bar, and still an improvement
    return el('div', { class: 'fza-st' }, el('span', { text: T(x.key) }),
      el('div', { class: 'fza-track', role: 'img', 'aria-label': `${T(x.key)} ${x.text}` }, el('i', { style: `width:${Math.max(0, lo) * 100}%` }), same ? null : el('u', { class: good ? 'up' : 'down', style: `left:${Math.max(0, lo) * 100}%;width:${(hi - lo) * 100}%` })),
      el('span', { class: same ? '' : (good ? 'fza-up' : 'fza-down'), text: x.text }));
  });
}
/** Short list of what an accessory changes, on its button. */
function effects(id, T) {
  const m = ATTACHMENTS[id].m, out = [], add = (k, v, inv) => { if (v === undefined || v === 1) return; const d = inv ? 1 / v - 1 : v - 1; out.push(`${T(k)} ${d > 0 ? '+' : ''}${Math.round(d * 100)}%`); };
  add('s_rec', m.rec); add('s_spread', m.spread, true); add('s_hip', m.hip, true); add('s_aim', m.aim, true); add('s_reload', m.reload); if (m.magMul) out.push(`${T('s_mag')} +${Math.round((m.magMul - 1) * 100)}%`); add('s_mob', m.mob); if (m.flash !== undefined) add('s_flash', m.flash === 0 ? .0001 : m.flash); add('s_loud', m.loud);
  if (id === 'x4') out.unshift(T('zoom')); if (id === 'laser') out.push(T('visible'));
  return out.slice(0, 4).join(' · ');
}
/* schematic preview: the arsenal's weapon drawing with each mounted accessory drawn at its place */
const OVER = {
  dot: '<rect x="96" y="14" width="24" height="5" fill="#15171a"/><rect x="101" y="4" width="14" height="11" rx="2" fill="none" stroke="#15171a" stroke-width="2.4"/><circle cx="108" cy="9.5" r="1.3" fill="#ff3a22"/>',
  holo: '<rect x="92" y="14" width="32" height="5" fill="#15171a"/><rect x="97" y="2" width="22" height="13" fill="#39505044" stroke="#15171a" stroke-width="2.4"/><circle cx="108" cy="8.5" r="3.6" fill="none" stroke="#ff3a22" stroke-width=".9"/>',
  x4: '<rect x="84" y="13" width="36" height="6" fill="#15171a"/><rect x="70" y="3" width="66" height="9" rx="2" fill="#15171a"/><rect x="134" y="1" width="10" height="13" rx="1" fill="#15171a"/><rect x="62" y="1.5" width="9" height="12" rx="1" fill="#15171a"/>',
  sup: '<rect x="212" y="23" width="27" height="10" rx="1.5" fill="#15171a"/>',
  comp: '<rect x="212" y="24" width="15" height="8" fill="#555a5e"/><rect x="216" y="24" width="2" height="8" fill="#15171a"/><rect x="221" y="24" width="2" height="8" fill="#15171a"/>',
  hider: '<rect x="212" y="25" width="13" height="6" fill="#26282a"/><rect x="220" y="25" width="1.5" height="6" fill="#000"/>',
  ext: '<rect x="98" y="61" width="19" height="15" fill="#4a4e50"/><rect x="96" y="74" width="23" height="4" fill="#15171a"/>',
  fast: '<rect x="96" y="59" width="23" height="5" fill="#8a2a20"/>',
  vg: '<rect x="160" y="42" width="11" height="26" rx="2" fill="#15171a"/>',
  ag: '<path d="M152 42h26l-12 16h-10z" fill="#15171a"/>',
  laser: '<rect x="170" y="30" width="24" height="7" fill="#15171a"/><circle cx="195" cy="33.5" r="1.8" fill="#ff3a22"/><path d="M196 33.5H240" stroke="#ff3a22" stroke-width=".7" opacity=".8"/>',
};

export function openCustomizer({ weaponId, profile, lang, gunSvg, gunShot, sfx, onClose, engine }) {
  injectCss();
  const def = WEAPONS.find(w => w.id === weaponId); if (!def) return null;
  const T = (k, p) => attText(lang(), k, p);
  const root = el('div', { class: 'fza', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${T('custom')} ${def.name}`, 'data-fid': 'att:screen' });
  let lastFocus = null, closed = false, preview = null, offLoad = null;
  const glCanvas = engine && engine.internals && engine.internals.renderer ? engine.internals.renderer.domElement : null;
  /* the drawing stays underneath: it is what shows while the shaders link, and if WebGL is unavailable */
  const draw3d = el('canvas', { role: 'img', tabindex: '0', 'aria-label': def.name, 'data-fid': 'att:preview' }), drawing = el('div', { class: 'fza-draw' }), view = el('div', { class: 'fza-view' }, drawing, draw3d);
  const drop3d = () => { const p = preview; preview = null; if (p) { try { p.dispose(); } catch (e) { console.warn('[arsenal] preview', e); } } view.classList.remove('is-3d'); draw3d.classList.remove('is-on'); };
  const onLost = () => drop3d();
  const close = () => { if (closed) return; closed = true; drop3d(); if (offLoad) offLoad(); if (glCanvas) glCanvas.removeEventListener('webglcontextlost', onLost); root.remove(); document.removeEventListener('keydown', onKey, true); if (onClose) onClose(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey, true);
  // a match starting (the host launched it) closes this screen: nothing of the preview stays alive during play
  if (engine && engine.on) { try { offLoad = engine.on('loading', ev => { if (ev && ev.active) close(); }); } catch { /* optional */ } }
  if (glCanvas) glCanvas.addEventListener('webglcontextlost', onLost);
  let dragId = null, dragX = 0, dragY = 0;
  draw3d.addEventListener('pointerdown', e => { dragId = e.pointerId; dragX = e.clientX; dragY = e.clientY; try { draw3d.setPointerCapture(dragId); } catch { /* synthetic pointer */ } });
  draw3d.addEventListener('pointermove', e => { if (e.pointerId !== dragId || !preview) return; preview.rotate((e.clientX - dragX) * .011, (e.clientY - dragY) * .007); dragX = e.clientX; dragY = e.clientY; });
  const endDrag = e => { if (e.pointerId === dragId) dragId = null; }; draw3d.addEventListener('pointerup', endDrag); draw3d.addEventListener('pointercancel', endDrag);
  draw3d.addEventListener('keydown', e => { if (!preview) return; const k = { ArrowLeft: [-.18, 0], ArrowRight: [.18, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] }[e.key]; if (k) { e.preventDefault(); preview.rotate(k[0], k[1]); } });
  async function start3d() {
    if (!glCanvas || engine.running || engine.loading) return;
    try {
      const { createWeaponPreview } = await import('./guns.js'); if (closed) return;
      const box = view.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      draw3d.width = Math.max(320, Math.min(720, Math.round((box.width || 520) * dpr))); draw3d.height = Math.round(draw3d.width / 2.2);
      const p = createWeaponPreview(engine.internals.renderer, draw3d, def); preview = p;
      if (await p.start(applyAttachments(def, profile.attOf(def.id))) && preview === p) { view.classList.add('is-3d'); draw3d.classList.add('is-on'); } else if (preview === p) drop3d();
    } catch (e) { console.warn('[arsenal] 3D preview unavailable, keeping the drawing', e); drop3d(); }
  }
  function render() {
    const d = profile.data, level = profile.level, ids = profile.attOf(def.id), w = applyAttachments(def, ids), slots = slotsOf(def.id), into = d.xp % XP_PER_LEVEL, nx = profile.nextReward();
    const overlay = ids.map(i => OVER[i] || '').join('');
    drawing.innerHTML = gunSvg(def.id).replace('</svg>', overlay + '</svg>');
    const shotUrl = gunShot ? gunShot(def.id) : '';       // while the 3D links or without WebGL: the weapon's picture, over the drawing
    if (shotUrl) { const im = new Image(); im.alt = ''; im.onload = () => drawing.classList.add('has-shot'); im.onerror = () => { drawing.classList.remove('has-shot'); im.remove(); }; im.src = shotUrl; drawing.append(im); }
    if (preview) { try { preview.setDef(w); } catch (e) { console.warn('[arsenal] preview', e); drop3d(); } }
    const prev = el('div', { class: 'fza-prev' }, view);
    prev.append(el('div', { class: 'fza-chips' }, ids.map(i => el('span', { text: T(i) }))));
    const left = el('div', null, prev, el('div', { class: 'fza-stats' }, statRows(def, w, T)));
    const right = el('div', null);
    const names = ATT_SLOTS.filter(s => slots[s]);
    if (!names.length) right.append(el('p', { class: 'fza-note', text: T('noSlots') }));
    for (const s of names) {
      const cur = ids.find(i => ATTACHMENTS[i].slot === s) || null;
      const pick = id => { if (profile.setAtt(def.id, s, id)) { if (sfx) sfx('ui'); lastFocus = id ? `att:${def.id}:${id}` : `att:${def.id}:none:${s}`; render(); } };
      const opts = [el('button', { type: 'button', class: `fza-opt${cur ? '' : ' is-on'}`, 'aria-pressed': cur ? 'false' : 'true', 'data-fid': `att:${def.id}:none:${s}`, onclick: () => pick(null) }, el('span', { text: T('none') }))];
      for (const id of slots[s]) {
        const open = profile.attUnlocked(id), on = cur === id;
        opts.push(el('button', { type: 'button', class: `fza-opt${on ? ' is-on' : ''}`, 'aria-pressed': on ? 'true' : 'false', disabled: open ? null : true, 'data-fid': `att:${def.id}:${id}`, onclick: () => pick(id) },
          el('span', { text: T(id) }), el('small', { text: open ? effects(id, T) : T('locked', { n: ATTACHMENTS[id].lvl }) })));
      }
      right.append(el('section', { class: 'fza-slot' }, el('h3', { text: T(s) }), el('div', { class: 'fza-opts' }, opts)));
    }
    const nextLine = nx ? T('nextAt', { n: nx.level, what: nx.rewards.map(r => rewardName(lang(), r)).join(', ') }) : null;
    const stat = profile.weaponStat(def.id);
    root.replaceChildren(el('div', { class: 'fza-in' },
      el('div', { class: 'fza-top' }, el('h2', { text: def.name }),
        el('div', { class: 'fza-lvl' }, el('span', null, el('b', { text: T('level', { n: level }) }), ` · ${into} / ${XP_PER_LEVEL} XP · ${T('mastery', { n: profile.mastery(def.id) })} (${stat.kills})`), el('div', { class: 'fza-bar' }, el('i', { style: `width:${into / XP_PER_LEVEL * 100}%` }))),
        el('button', { type: 'button', class: 'fza-back', 'data-fid': 'att:back', onclick: close, text: T('back') })),
      nextLine ? el('p', { class: 'fza-next' }, el('b', { text: `${T('next')} : ` }), nextLine) : null,
      TEST_UNLOCK_ALL ? el('p', { class: 'fza-note', text: T('testAll') }) : null,
      el('div', { class: 'fza-grid' }, left, right)));
    if (lastFocus) { const b = root.querySelector(`[data-fid="${lastFocus}"]`); if (b) b.focus({ preventScroll: true }); }
  }
  document.body.append(root); render();
  const back = root.querySelector('[data-fid="att:back"]'); if (back) back.focus({ preventScroll: true });
  start3d();
  return { close, render };
}

/** The rewards of the levels just reached: lines of text, or an empty list. */
export function rewardLines(profile, lang) { return profile.takeRewards().map(g => unlockLine(lang(), g.level, g.rewards)); }
/** Banner for the end-of-match screen. */
export function rewardBlock(lines, lang) { injectCss(); return el('div', { class: 'fza-rewards', 'data-fid': 'att:rewards', role: 'status' }, el('b', { text: attText(lang(), 'newGear') }), lines.map(t => el('p', { text: t }))); }
/** A dismissable notice over the menu, for rewards not yet shown. */
export function rewardToast(lines, lang) {
  injectCss(); document.querySelectorAll('.fzr').forEach(n => n.remove());
  const n = el('div', { class: 'fzr', role: 'status', 'data-fid': 'att:toast' }, el('b', { text: attText(lang(), 'newGear') }), lines.map(t => el('p', { text: t })), el('button', { type: 'button', 'data-fid': 'att:toastOk', onclick: () => n.remove(), text: 'OK' }));
  document.body.append(n); setTimeout(() => n.remove(), 9000); return n;
}
