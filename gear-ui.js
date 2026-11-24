// FRONT ZÉRO — menu panel of the equipment slots: one row per slot, each item with its real picture, level and price.
import './gear-data.js';
const D = globalThis.FZGearData;
const CSS = `
.gxm{margin:14px 0 22px}.gxm h3{margin:0 0 10px;font-size:15px;letter-spacing:.06em;text-transform:uppercase}
.gxm-row{margin:0 0 12px}.gxm-row>small{display:block;margin:0 0 5px;opacity:.72;text-transform:uppercase;letter-spacing:.08em;font-size:11px}
.gxm-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:7px}
.gxm-it{appearance:none;display:block;text-align:left;padding:5px 6px 6px;color:inherit;font:inherit;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.12);border-radius:4px;cursor:pointer}
.gxm-it:hover,.gxm-it:focus-visible{background:rgba(255,255,255,.1);outline:none}.gxm-it.on{border-color:#d9b65a;background:rgba(217,182,90,.14)}.gxm-it.lock{opacity:.5;cursor:default}
.gxm-it img{display:block;width:100%;height:70px;object-fit:contain}.gxm-it b{display:block;font-size:12px;line-height:15px;margin-top:2px}
.gxm-it span{display:block;font-size:10.5px;line-height:13px;opacity:.76;min-height:13px}`;
let styled = false;
const pic = id => new URL('map-shots/gear-' + id + '.webp', import.meta.url).href;
function statLine(id, lang) {
  const it = D.ITEMS[id], t = k => D.t(k, lang), s = v => String(+(v / 1000).toFixed(1)).replace('.', lang === 'en' ? '.' : ',') + ' s', out = [t('carry') + ' ' + it.carry];
  if (it.heal) out.push('+' + it.heal + ' ' + t('over') + ' ' + s(it.useMs + (it.hotMs || 0)));
  if (it.armor) out.push('+' + it.armor + ' ' + t('armor'));
  if (it.boost) out.push(t('speed') + ' +' + Math.round((it.boost - 1) * 100) + ' %');
  if (it.dmg) out.push(t('dmg') + ' ' + it.dmg);
  if (it.fire) out.push(it.fire.dps + '/s');
  if (it.cloud) out.push(s(it.cloud.ms));
  return out.join(' · ');
}
/** Returns the panel element. deps = { profile, lang() , sfx(name) }. Everything is drawn again after each choice. */
export function gearPanel(deps) {
  const { profile, lang, sfx } = deps;
  if (!styled) { styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
  const root = document.createElement('section'); root.className = 'gxm'; root.dataset.fid = 'gear-panel';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  function draw() {
    const L = lang(); root.textContent = ''; root.appendChild(el('h3', '', D.t('title', L)));
    for (const slot of ['L', 'T', 'M']) {
      const row = el('div', 'gxm-row'), list = el('div', 'gxm-list'); row.appendChild(el('small', '', D.slotName(slot, L)));
      for (const id of D.listFor(slot)) {
        const it = D.ITEMS[id], owns = profile.gxOwns(id), lvlOk = profile.gxLevelOk(id), on = profile.data.gx[slot] === id, can = owns || (lvlOk && profile.data.cr >= it.price);
        const b = el('button', 'gxm-it' + (on ? ' on' : '') + (can ? '' : ' lock')); b.type = 'button'; b.dataset.fid = 'gear:' + id; b.dataset.gear = id; b.setAttribute('aria-pressed', on ? 'true' : 'false');
        const img = el('img'); img.alt = ''; img.loading = 'lazy'; img.src = pic(id); b.appendChild(img); b.appendChild(el('b', '', D.nameOf(id, L))); b.appendChild(el('span', '', statLine(id, L)));
        b.appendChild(el('span', '', on ? D.t('equipped', L) : owns ? D.t('equip', L) : !lvlOk ? D.t('level', L) + ' ' + it.level : it.price + ' cr'));
        b.addEventListener('click', () => { if (!owns) { if (!profile.gxBuy(id)) return; try { sfx('buy'); } catch { /* optional */ } } else try { sfx('ui'); } catch { /* optional */ } profile.gxEquip(id); draw(); });
        list.appendChild(b);
      }
      row.appendChild(list); root.appendChild(row);
    }
  }
  draw(); return root;
}
