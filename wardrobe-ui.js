// FRONT ZÉRO — TENUES (rc8): the real wardrobe. Every outfit the game has: the 6 base camos, ÉCLIPSE and the standalone sets, the map outfits
// (4 colourways each) and the season-pass colourways (the zombie-only MUTANT is not an outfit and never listed), grouped by set, each card with its
// outfit-shots/ picture (no live model per card), one large 3D preview: the shop's studio (pedestal, neon, tilted spotlight, drag to rotate, zoom),
// created while the screen is open and disposed when it is left. Wearing goes through the profile like the shop (profile.wearOutfit; online the
// server checks the id). Not owned: its price and VOIR EN BOUTIQUE, which opens the shop on it. Loaded by menu.js on the first visit of TENUES.
import { OUTFITS } from './data.js';
import { rarityOf, outfitRarity, notSold, pickLang } from './cosmetics.js';

const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const TX = {       // fr, en, es, de, pt, it
  baseGroup: ['Camouflages de base', 'Base camouflages', 'Camuflajes básicos', 'Basis-Tarnmuster', 'Camuflagens base', 'Mimetiche di base'],
  base: ['Camouflage de base', 'Base camouflage', 'Camuflaje básico', 'Basis-Tarnmuster', 'Camuflagem base', 'Mimetica di base'],
  fOwned: ['Acquises', 'Owned', 'Adquiridos', 'Im Besitz', 'Adquiridas', 'Acquisite'],
  fPass: ['Passe', 'Pass', 'Pase', 'Pass', 'Passe', 'Pass'],
  worn: ['Portée', 'Worn', 'Puesto', 'Getragen', 'Vestida', 'Indossata'],
  owned: ['Acquise', 'Owned', 'Adquirido', 'Im Besitz', 'Adquirida', 'Acquisita'],
  seeShop: ['Voir en boutique', 'See in the shop', 'Ver en la tienda', 'Im Shop ansehen', 'Ver na loja', 'Vedi nel negozio'],
  mapOf: ['Carte : {m}', 'Map: {m}', 'Mapa: {m}', 'Karte: {m}', 'Mapa: {m}', 'Mappa: {m}'],
  map: ['Carte', 'Map', 'Mapa', 'Karte', 'Mapa', 'Mappa'],
  passOnly: ['Récompense du passe de saison : elle ne se vend pas.', 'Season pass reward: it is not sold.', 'Recompensa del pase de temporada: no se vende.', 'Belohnung des Saison-Pass: nicht käuflich.', 'Recompensa do passe de temporada: não se vende.', 'Ricompensa del pass stagionale: non si vende.'],
  count: ['{n} tenues', '{n} outfits', '{n} atuendos', '{n} Outfits', '{n} fardas', '{n} tenute'],
  count1: ['1 tenue', '1 outfit', '1 atuendo', '1 Outfit', '1 farda', '1 tenuta'],
  loading: ['Ouverture de la garde-robe…', 'Opening the wardrobe…', 'Abriendo el vestuario…', 'Garderobe wird geöffnet…', 'A abrir o guarda-roupa…', 'Apertura del guardaroba…'],
  empty: ['Aucune tenue ici pour l’instant.', 'No outfit here yet.', 'Ningún atuendo aquí por ahora.', 'Hier noch kein Outfit.', 'Nenhuma farda aqui por agora.', 'Nessuna tenuta qui per ora.'],
};

const CSS = `
.fzm .fzr{max-width:1760px}
.fzm .fzr-grid{display:grid;grid-template-columns:minmax(340px,.95fr) minmax(0,1.6fr);gap:clamp(14px,1.6vw,26px);align-items:start;margin-top:6px}
.fzm .fzr-side{position:sticky;top:0;display:grid;gap:12px;min-width:0}
.fzm .fzr-view{position:relative;width:100%;aspect-ratio:16/11;max-height:58vh;overflow:hidden;border:1px solid var(--hair2,var(--line-2));background:radial-gradient(90% 80% at 50% 42%,#1f231c,#0c0e0a);clip-path:polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%)}
.fzm .fzr-view>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.9}
.fzm .fzr-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;opacity:0;transition:opacity .16s}
.fzm .fzr-view canvas.is-on{opacity:1}
.fzm .fzr-view canvas:active{cursor:grabbing}
.fzm .fzr-view canvas:focus-visible{outline:2px solid var(--amber);outline-offset:-3px}
.fzm .fzr-hint{position:absolute;left:10px;bottom:12px;z-index:2;padding:2px 8px;font-size:14px;font-weight:600;letter-spacing:.06em;color:var(--sand);background:rgba(8,10,7,.66);pointer-events:none}
.fzm .fzr-det{display:grid;gap:8px;padding:14px 16px 16px;border:1px solid var(--hair,var(--line));background:linear-gradient(180deg,rgba(28,32,26,.94),rgba(13,15,12,.92));clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%)}
.fzm .fzr-rar{justify-self:start;padding:1px 8px;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--r,#cfc8b0);border:1px solid var(--r,#cfc8b0)}
.fzm .fzr-det h3{font-size:clamp(26px,2vw,34px);font-weight:800;letter-spacing:.03em;line-height:1;text-transform:uppercase;color:var(--white)}
.fzm .fzr-det p{font-size:17px;line-height:1.25;color:var(--dim)}
.fzm .fzr-acts{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:4px}
.fzm .fzr-price{font-size:24px;font-weight:800;color:var(--amber);font-variant-numeric:tabular-nums}
.fzm .fzr-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.fzm .fzr-chip{min-height:40px;padding:4px 14px;font-size:16px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);border:1px solid var(--line-2);background:rgba(0,0,0,.25);clip-path:polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)}
.fzm .fzr-chip[aria-pressed=true]{color:var(--ink);background:var(--amber);border-color:var(--amber)}
.fzm .fzr-chip:hover{color:var(--white)}
.fzm .fzr-chip[aria-pressed=true]:hover{color:var(--ink)}
.fzm .fzr-group{margin-bottom:16px}
.fzm .fzr-gh{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px;margin-bottom:8px}
.fzm .fzr-gh b{font-size:20px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--white)}
.fzm .fzr-gh span{font-size:15px;font-weight:600;letter-spacing:.08em;color:var(--amber)}
.fzm .fzr-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px}
.fzm .fzr-card{position:relative;display:flex;flex-direction:column;min-width:0;text-align:left;border:1px solid var(--hair,var(--line));background:#12150f;clip-path:polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%);box-shadow:inset 0 -3px 0 var(--r,transparent);transition:border-color .12s,transform .12s}
.fzm .fzr-card:hover{border-color:var(--hair2,var(--line-2))}
.fzm .fzr-card[aria-pressed=true]{border-color:var(--amber);box-shadow:inset 0 0 0 1px var(--amber),inset 0 -3px 0 var(--r,transparent)}
.fzm .fzr-pic{position:relative;display:block;width:100%;aspect-ratio:4/3;overflow:hidden;background:#0d0f0b}       /* a button does not stretch its flex items */
.fzm .fzr-info{width:100%}
.fzm .fzr-pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:46% 40%}
.fzm .fzr-sw{position:absolute;inset:0;display:flex}
.fzm .fzr-sw i{flex:1}
.fzm .fzr-tag{position:absolute;left:5px;top:5px;z-index:1;padding:0 5px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#e9f0ff;background:rgba(30,60,90,.85)}
.fzm .fzr-tag.is-pass{background:rgba(232,105,44,.9);color:#17140a}
.fzm .fzr-on{position:absolute;right:5px;top:5px;z-index:1;padding:0 6px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#17140a;background:var(--amber)}
.fzm .fzr-info{display:grid;gap:1px;padding:6px 8px 8px}
.fzm .fzr-name{overflow:hidden;font-size:17px;font-weight:700;line-height:1.1;text-overflow:ellipsis;white-space:nowrap;color:var(--white)}
.fzm .fzr-st{font-size:13px;font-weight:700;letter-spacing:.06em;color:var(--dim)}
.fzm .fzr-st.is-own{color:var(--green)}
.fzm .fzr-st.is-buy{color:var(--amber)}
.fzm .fzr-load{padding:30px;font-size:20px;color:var(--dim)}.fzm .fzr-load p{margin:0 0 14px}
@media (pointer:coarse){.fzm .fzr-chip{min-height:44px}}
@media (max-width:1180px){.fzm .fzr-grid{grid-template-columns:minmax(0,1fr)}.fzm .fzr-side{position:static}.fzm .fzr-view{aspect-ratio:16/11;max-height:52vh}}
@media (max-width:520px){.fzm .fzr-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.fzm .fzr-view{aspect-ratio:4/3}}`;

export function createWardrobe(deps) {
  const { engine, profile, i18n, settings, openStore, onChange } = deps, sfx = deps.sfx || (() => {}), outfitName = deps.outfitName || (o => (o ? o.name : ''));
  if (!document.getElementById('fzr-style')) { const s = document.createElement('style'); s.id = 'fzr-style'; s.textContent = CSS; document.head.append(s); }
  const li = () => Math.max(0, LANGS.indexOf((i18n && i18n.lang) || 'fr')), lang = () => (i18n && i18n.lang) || 'fr';
  const L = (k, p) => { let s = (TX[k] && (TX[k][li()] || TX[k][0])) || k; if (p) s = s.replace(/\{(\w+)\}/g, (m, x) => (x in p ? String(p[x]) : m)); return s; };
  const T = (k, p) => (i18n ? i18n.t(k, p) : k);
  const num = n => { try { return Number(n).toLocaleString(lang()); } catch { return String(n); } };
  const el = (tag, props, ...kids) => { const n = document.createElement(tag); if (props) for (const k of Object.keys(props)) { const v = props[k]; if (v === null || v === undefined || v === false) continue; if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k === 'style') n.style.cssText = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.append(c); return n; };
  const hex = h => '#' + ((h >>> 0) & 0xffffff).toString(16).padStart(6, '0');
  const shotUrl = id => new URL(`outfit-shots/${encodeURIComponent(id)}.webp`, import.meta.url).href;
  const glCanvas = engine && engine.internals && engine.internals.renderer ? engine.internals.renderer.domElement : null;

  const st = { filter: 'all', sel: null };
  let M = null, specials = [], setList = [], shots = new Set(), ready = false, loading = null, shown = false;

  /* ---------- the persistent screen (the menu redraws itself often: this element and its canvas are kept) ---------- */
  const root = el('div', { class: 'fzm-wrap fzr', 'data-fid': 'wardrobe' });
  const head = el('div', null, el('h2', { class: 'fzm-title', text: T('nav.outfits') }), el('p', { class: 'fzm-note', text: T('shop.outfitsNote') }));
  const canvas = el('canvas', { role: 'img', tabindex: '0', 'aria-label': T('store.preview'), 'data-fid': 'wardrobe:preview' }), fallback = el('img', { alt: '' });
  const hint = el('span', { class: 'fzr-hint' }), viewBox = el('div', { class: 'fzr-view' }, fallback, canvas, hint);
  const detail = el('div', { class: 'fzr-det', 'data-fid': 'wardrobe:detail' }), list = el('div', { class: 'fzr-list' });
  root.append(head, el('div', { class: 'fzr-grid' }, el('div', { class: 'fzr-side' }, viewBox, detail), list));

  /* ---------- the catalogue ---------- */
  const all = () => [...OUTFITS, ...specials];
  const byId = id => all().find(o => o.id === id) || null;
  const label = o => (o.colorway ? (T('outfit.' + o.id) !== 'outfit.' + o.id ? T('outfit.' + o.id) : `${o.name} ${o.colorway}`) : outfitName(o));
  const short = o => (o.colorway || outfitName(o));
  const isPass = o => notSold(o) || o.source === 'pass';
  const mine = q => (q.mine === undefined ? q.owned && !q.test : !!q.mine);       // really owned (the TEST_UNLOCK_ALL unlocks aside), as the shop's « Possédé »
  const FILTERS = [['all', () => T('store.all'), () => true], ['owned', () => L('fOwned'), o => mine(profile.quote('outfit', o.id))],['maps', () => T('store.fMaps'), o => typeof o.map === 'string'], ['pass', () => L('fPass'), isPass]];
  function groups() {
    const f = FILTERS.find(x => x[0] === st.filter) || FILTERS[0], out = [{ id: 'base', name: L('baseGroup'), items: OUTFITS.filter(f[2]) }];
    const sets = setList.slice().sort((a, b) => (!!a.map - !!b.map));       // the standalone sets first, then the map sets
    for (const s of sets) { const items = specials.filter(o => o.setId === s.id).filter(f[2]); if (items.length) out.push({ id: s.id, name: s.name, mapName: items[0].mapName || null, items }); }
    return out.filter(g => g.items.length);
  }
  const worn = () => { try { const s = profile.specialOutfit && profile.specialOutfit(); return s ? s.id : profile.data.outfit; } catch { return profile.data.outfit; } };

  /* ---------- drawing ---------- */
  function state(o) {
    const q = profile.quote('outfit', o.id), on = profile.outfitWorn(o.id);
    if (on) return { cls: 'is-own', text: L('worn'), q, on };
    if (mine(q)) return { cls: 'is-own', text: L('owned'), q, on };
    if (q.notSold) return { cls: '', text: T('store.passItem', { n: q.passTier ?? '—' }), q, on };
    return { cls: 'is-buy', text: `${num(q.cost)} ₡`, q, on };
  }
  function card(o) {
    const s = state(o), r = rarityOf(outfitRarity(o)), pic = el('span', { class: 'fzr-pic' });
    const cols = Array.isArray(o.c) ? o.c : o.palette ? [o.palette.cloth, o.palette.cloth2 ?? o.palette.plate, o.palette.accent ?? o.palette.plate] : [0x444444, 0x333333, 0x222222];
    pic.append(el('span', { class: 'fzr-sw', 'aria-hidden': 'true' }, cols.filter(c => c !== undefined).map(c => el('i', { style: `background:${hex(c)}` }))));
    if (shots.has(o.id)) pic.append(el('img', { alt: '', loading: 'lazy', decoding: 'async', src: shotUrl(o.id), onerror: e => e.target.remove() }));
    if (isPass(o)) pic.append(el('span', { class: 'fzr-tag is-pass', text: L('fPass') })); else if (typeof o.map === 'string') pic.append(el('span', { class: 'fzr-tag', text: L('map') }));
    if (s.on) pic.append(el('span', { class: 'fzr-on', text: L('worn') }));
    return el('button', { type: 'button', class: 'fzr-card' + (st.sel === o.id ? ' is-primary' : ''), style:`--r:${r.color}`, 'aria-pressed': st.sel === o.id ? 'true' : 'false', 'data-fid': 'fit:' + o.id, 'aria-label': `${label(o)} · ${pickLang(r.n, lang())} · ${s.text}`, onclick: () => pick(o.id) },
      pic, el('span', { class: 'fzr-info' }, el('span', { class: 'fzr-name', text: short(o) }), el('span', { class: 'fzr-st ' + s.cls, text: s.text })));
  }
  function drawList() {
    const top = list.scrollTop, gs = groups(), n = gs.reduce((a, g) => a + g.items.length, 0);
    list.replaceChildren(
      el('div', { class: 'fzr-filters', role: 'group' }, FILTERS.map(f => el('button', { type: 'button', class: 'fzr-chip', 'aria-pressed': st.filter === f[0] ? 'true' : 'false', 'data-fid': 'wardrobe:filter:' + f[0], onclick: () => { if (st.filter !== f[0]) { st.filter = f[0]; sfx('ui'); drawList(); } } }, f[1]())),
        el('span', { class: 'fzr-st', style: 'align-self:center;margin-left:6px', text: n === 1 ? L('count1') : L('count', { n }) })),
      ...(gs.length ? gs : [null]).map(g => !g ? el('div', { class: 'fzr-load', 'data-fid': 'wardrobe:empty' }, el('p', { text: L('empty') }), st.filter !== 'all' ? el('button', { type: 'button', class: 'fzr-chip', 'data-fid': 'wardrobe:showall', onclick: () => { st.filter = 'all'; sfx('ui'); drawList(); } }, T('store.showAll')) : null) : el('section', { class: 'fzr-group', 'data-fid': 'wardrobe:set:' + g.id }, el('div', { class: 'fzr-gh' }, el('b', { text: g.name }), g.mapName ? el('span', { text: L('mapOf', { m: g.mapName }) }) : null), el('div', { class: 'fzr-cards' }, g.items.map(card)))));
    list.scrollTop = top;
  }
  function drawDetail() {
    const o = byId(st.sel); if (!o) { detail.replaceChildren(); return; }
    const s = state(o), r = rarityOf(outfitRarity(o)), acts = [];
    if (s.q.owned) acts.push(s.on ? el('button', { type: 'button', class: 'fzm-btn fzm-btn--on', disabled: true, 'data-fid': 'wardrobe:wear' }, L('worn')) : el('button', { type: 'button', class: 'fzm-btn fzm-btn--primary', 'data-fid': 'wardrobe:wear', onclick: wear }, T('store.wear')));
    else {
      if (!s.q.notSold) acts.push(el('span', { class: 'fzr-price', 'data-fid': 'wardrobe:price', text: `${num(s.q.cost)} ₡` }));
      acts.push(el('button', { type: 'button', class: 'fzm-btn', 'data-fid': 'wardrobe:shop', onclick: () => { sfx('ui'); if (openStore) openStore(o.id); } }, L('seeShop')));
    }
    detail.replaceChildren(...[       // replaceChildren would print a null
      el('span', { class: 'fzr-rar', style: `--r:${r.color}`, text: pickLang(r.n, lang()) }),
      el('h3', { text: label(o) }),
      el('p', { text: o.colorway ? (typeof o.map === 'string' ? L('mapOf', { m: o.mapName || o.map }) : o.name) : L('base') }),
      s.q.notSold && !s.q.owned ? el('p', { text: L('passOnly') }) : null,
      s.q.test && s.q.cost > 0 && !s.q.notSold && !mine(s.q) ? el('p', { text: `${T('store.testMark')} · ${T('store.testPrice')}` }) : null,
      el('div', { class: 'fzr-acts' }, acts)].filter(Boolean));
  }
  function wear() {
    const o = byId(st.sel); if (!o) return;
    if (profile.wearOutfit(o.id)) { sfx('ui'); try { if (onChange) onChange(); } catch (e) { console.warn('[wardrobe] change', e); } draw(); const b = detail.querySelector('[data-fid="wardrobe:wear"]'); if (b) b.focus({ preventScroll: true }); }
  }
  function pick(id) {
    if (st.sel === id) return; st.sel = id; sfx('ui');
    for (const b of list.querySelectorAll('.fzr-card[aria-pressed=true]')) { b.setAttribute('aria-pressed', 'false'); b.classList.remove('is-primary'); }
    const b = list.querySelector(`[data-fid="fit:${String(id).replace(/["\\]/g, '')}"]`); if (b) { b.setAttribute('aria-pressed', 'true'); b.classList.add('is-primary'); }       // (this module's CSS string hides the global CSS object)
    drawDetail(); preview();
  }
  function draw() { drawList(); drawDetail(); hint.textContent = M && M.shop.zoomHint ? M.shop.zoomHint(T) : T('store.dragHint'); }

  /* ---------- the 3D preview: the shop's studio, one at a time, only while the screen is shown ---------- */
  let cur = null, curKey = '', tok = 0, previewTimer = 0;
  const lowFx = () => { try { return /^(bas|mobile)$/.test(settings.get('graphics.preset')); } catch { return false; } };
  const stillFx = () => { try { return !!settings.get('gameplay.reducedMotion') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const paletteOf = o => { if (!o) return undefined; if (Array.isArray(o.c)) return o.c; const p = o.palette || {}; return [p.cloth ?? 0x4c5238, p.cloth2 ?? 0x2a2e22, p.plate ?? 0x7c7a5c]; };
  function drop() { const p = cur; cur = null; curKey = ''; if (p) { try { p.s.dispose(); } catch (e) { console.warn('[wardrobe] studio', e); } if (p.sol) { const sol = p.sol; (p.s.settled || Promise.resolve()).then(() => { try { sol.dispose(); } catch { /* gone */ } }); } } canvas.classList.remove('is-on'); }       // the soldier is freed once its shaders are linked (three's compileAsync)
  const sizeCanvas = () => { const b = viewBox.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = Math.max(360, Math.min(720, Math.round((b.width || 600) * dpr))), h = Math.max(220, Math.round(w * ((b.height || 410) / (b.width || 600)))); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } };
  function preview() { clearTimeout(previewTimer); previewTimer = setTimeout(applyPreview, 90); }
  async function applyPreview() {
    if (!shown || !ready || !glCanvas || (engine && (engine.running || engine.loading))) return;
    const o = byId(st.sel); if (!o) return;
    fallback.src = shots.has(o.id) ? shotUrl(o.id) : '';
    if (o.id === curKey && cur) return;
    const my = ++tok; drop(); curKey = o.id;
    try {
      sizeCanvas(); const R = engine.internals.renderer, { createStudio, ringColorOf } = M.shop;
      const s = createStudio(R, canvas, { stage: true, fancy: !lowFx(), motion: !lowFx() && !stillFx(), ring: ringColorOf(outfitRarity(o)) }), p = { s }; cur = p;
      if (o.colorway && M.fits.prepareOutfits) { await M.fits.prepareOutfits(() => new Promise(r => setTimeout(r, 0)), [o.id]); if (my !== tok) { if (cur === p) drop(); return; } }
      const sol = M.soldier.createSoldier(s.pivot, { palette: paletteOf(o), weaponId: profile.data.primary, outfit: o.colorway ? o.id : undefined, outfitLod: 0 }); p.sol = sol;
      try { M.skins.soldierFinish(sol, profile.finOf ? profile.finOf(profile.data.primary) : null); } catch { /* plain weapon */ }
      const pose = { vx: 0, vz: 0, yaw: 0, aimPitch: -.08, grounded: true, crouch: 0, y: 0 }; sol.update(1 / 60, pose);
      s.frame(2.55, .8, 1.1, 1.5); s.onTick(dt => sol.update(dt, pose));
      if (!(await s.start()) || my !== tok) { if (cur === p) drop(); return; }
      canvas.classList.add('is-on');
    } catch (e) { console.warn('[wardrobe] 3D preview unavailable, keeping the picture', e); if (my === tok) drop(); }
  }
  let dragId = null, dragX = 0, dragY = 0;
  canvas.addEventListener('pointerdown', e => { dragId = e.pointerId; dragX = e.clientX; dragY = e.clientY; try { canvas.setPointerCapture(dragId); } catch { /* synthetic */ } });
  canvas.addEventListener('pointermove', e => { if (e.pointerId !== dragId || !cur || canvas.dataset.pinch) return; cur.s.rotate((e.clientX - dragX) * .011, (e.clientY - dragY) * .007); dragX = e.clientX; dragY = e.clientY; });
  const endDrag = e => { if (e.pointerId === dragId) dragId = null; }; canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', e => { if (!cur) return; const k = { ArrowLeft: [-.18, 0], ArrowRight: [.18, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] }[e.key]; if (k) { e.preventDefault(); e.stopPropagation(); cur.s.rotate(k[0], k[1]); } else if (e.key === '+' || e.key === '=') { e.preventDefault(); cur.s.zoomBy(1.4); } else if (e.key === '-') { e.preventDefault(); cur.s.zoomBy(1 / 1.4); } });
  if (glCanvas) { glCanvas.addEventListener('webglcontextlost', () => { tok++; drop(); }); glCanvas.addEventListener('webglcontextrestored', () => { if (shown) preview(); }); }
  async function load() {
    const [fits, shop, soldier, skins] = await Promise.all([import('./outfits.js'), import('./shop-ui.js'), import('./soldier.js'), import('./weapon-skins.js')]);
    M = { fits, shop, soldier, skins };
    if (!soldier.outfitHook.attach && fits.attachOutfit) soldier.outfitHook.attach = fits.attachOutfit;
    // season-pass colourways register when the menu is idle: wait until the registry stops growing (2 s at most)
    let n = -1; for (let t = 0; t < 10 && n !== fits.OUTFIT_SETS.length; t++) { n = fits.OUTFIT_SETS.length; await new Promise(r => setTimeout(r, 200)); }
    specials = fits.OUTFIT_SETS; setList = fits.setOf ? fits.setOf() : [];
    if (!globalThis.FZOutfitSets) globalThis.FZOutfitSets = specials;       // the profile reads it to know what it may wear
    try { const r = await fetch(new URL('outfit-shots/index.json', import.meta.url)); const j = r.ok ? await r.json() : null; shots = new Set(j && Array.isArray(j.ids) ? j.ids : []); } catch { shots = new Set(); }
    shop.attachZoom(viewBox, canvas, () => (cur ? cur.s : null), T);
    ready = true;
  }
  return {
    /** The screen (the same element every time). Starts the preview when it is on screen. */
    view() {
      shown = true;
      root.classList.remove('fzm-enter', 'fza-fwd', 'fza-back');       // the menu adds them back when the screen is entered (motion)
      if (!ready) {
        if (!loading) loading = load().then(() => { if (!st.sel) st.sel = worn(); draw(); preview(); }).catch(e => { console.warn('[wardrobe]', e); list.replaceChildren(el('p', { class: 'fzr-load', text: L('empty') })); });
        if (!list.childElementCount) list.append(el('p', { class: 'fzr-load', text: L('loading') }));
        return root;
      }
      if (!st.sel || !byId(st.sel)) st.sel = worn();
      draw(); preview();
      return root;
    },
    /** Leaves the screen: the studio is disposed (nothing kept on the GPU), the pictures stay. */
    leave() { shown = false; clearTimeout(previewTimer); tok++; drop(); },
    select(id) { if (byId(id)) { st.sel = id; if (shown) { draw(); preview(); } } },
    get stats() { return { ready, shown, sel: st.sel, studio: !!cur, studioStats: cur ? cur.s.stats : null, zoom: cur && cur.s.zoomLevel ? cur.s.zoomLevel : null, items: all().length, shots: shots.size }; },
  };
}
