// FRONT ZÉRO — engine helper: what a dead soldier leaves on the ground (weapons with their ammunition, grenades).
// Offline this module is the referee; online the server owns every drop and pickup (see "loot" in server/server.js) and this module
// only shows them and asks. Meshes are pooled and share one material, built during the match load: a death allocates no GPU resource.
import * as THREE from 'three';
import { createSoldier } from './soldier.js';
import { applyAttachments, measureGun, measuredGun, attachmentGeometry, attachmentMaterial, sanitize } from './attachments.js';
import { dropFinishMaterials } from './weapon-skins.js';

export const LOOT_TTL = 30, LOOT_CAP = 24;
const POOL = LOOT_CAP + 2, FLY = 0.5, SETTLE = 0.22, NEAR = 1.7, LOOK = 3.4, LOOK_DOT = 0.955, AUTO = 1.4, RETRY = 0.5, BLINK = 4;

/** The third-person weapon model, cut out of the soldier geometry and laid on its side (the grenade stays upright). */
const geos = new Map();
function gunGeometry(id) {
  let g = geos.get(id); if (g) return g;
  // The gun bone and its bind position are read from the skeleton, so this keeps working if soldier.js changes its rig.
  const s = createSoldier(null, { weaponId: id }), src = s.mesh.geometry, bone = s.mesh.skeleton.bones.findIndex(b => b.name === 'gun');
  const o = new THREE.Vector3(); if (bone >= 0) o.setFromMatrixPosition(s.mesh.skeleton.boneInverses[bone].clone().invert());
  try { measureGun(s, id); } catch { /* the drop then shows without its accessories */ }
  s.dispose();
  const idx = src.index, si = src.attributes.skinIndex, P = src.attributes.position, N = src.attributes.normal, C = src.attributes.color, flat = id !== 'frag';
  const pos = [], nor = [], col = [];
  if (bone >= 0 && idx && si && P && N && C) for (let i = 0; i + 2 < idx.count; i += 3) {
    const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
    if (si.getX(a) !== bone || si.getX(b) !== bone || si.getX(c) !== bone) continue;
    for (const v of [a, b, c]) {
      const x = P.getX(v) - o.x, y = P.getY(v) - o.y, z = P.getZ(v) - o.z, nx = N.getX(v), ny = N.getY(v), nz = N.getZ(v);
      if (flat) { pos.push(-y, x, z); nor.push(-ny, nx, nz); } else { pos.push(x, y, z); nor.push(nx, ny, nz); }
      col.push(C.getX(v), C.getY(v), C.getZ(v));
    }
  }
  if (!pos.length) {       // no gun found in the model: a plain dark shape rather than an invisible drop
    const box = new THREE.BoxGeometry(0.06, 0.08, flat ? 0.6 : 0.09).toNonIndexed(), bp = box.attributes.position, bn = box.attributes.normal;
    for (let i = 0; i < bp.count; i++) { pos.push(bp.getX(i), bp.getY(i), bp.getZ(i)); nor.push(bn.getX(i), bn.getY(i), bn.getZ(i)); col.push(0.05, 0.05, 0.05); }
    box.dispose();
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < pos.length; i += 3) { x0 = Math.min(x0, pos[i]); x1 = Math.max(x1, pos[i]); y0 = Math.min(y0, pos[i + 1]); z0 = Math.min(z0, pos[i + 2]); z1 = Math.max(z1, pos[i + 2]); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let i = 0; i < pos.length; i += 3) { pos[i] -= cx; pos[i + 1] -= y0; pos[i + 2] -= cz; }
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.computeBoundingSphere(); g.userData.half = Math.max(0.06, (z1 - z0) / 2); g.userData.ox = cx; g.userData.oy = y0; g.userData.oz = cz; g.userData.flat = flat;
  geos.set(id, g);
  return g;
}

/** ctx: { scene, grid, mover, camera, player, P, rules, hud, t, settings, audio, vm, defOf(id), online(), sendInv(), sendTake(id, swap), invChanged() } */
export function createLoot(ctx) {
  const { scene, grid, mover, camera, player, P, rules, hud, t, settings, audio, vm, defOf } = ctx;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.22 });
  const matHi = mat.clone(); matHi.color.setRGB(2.1, 1.95, 1.6); matHi.emissive.setHex(0x14100a);       // brighter but keeps the weapon's shapes; same program, focusing one compiles nothing
  const free = [], live = [], fw = new THREE.Vector3();
  for (let i = 0; i < POOL; i++) {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.visible = false; m.castShadow = true; m.receiveShadow = false; m.matrixAutoUpdate = false; m.name = 'loot';
    const am = new THREE.Mesh(new THREE.BufferGeometry(), attachmentMaterial(THREE)); am.visible = false; am.castShadow = true; am.frustumCulled = false; am.matrixAutoUpdate = false; m.add(am);       // the accessories of this drop: same program as the weapon
    scene.add(m); free.push({ attMesh: am, att: null, mesh: m, id: 0, k: 'w', w: '', def: null, a: 0, r: 0, x: 0, y: 0, z: 0, yaw: 0, sx: 0, sy: 0, sz: 0, ox: 0, oy: 0, oz: 0, t: 0, left: 0, landed: false, wait: 0, surf: null });
  }
  let enabled = false, seq = 0, clock = 0, focus = null, focusT = 0, shownD = null, shownA = -9, shownR = -9, shownK = '', shownL = '', shown = false;

  const limited = def => def.reserve !== undefined, rounds = (a, r) => a + Math.max(r, 0);
  const owned = id => { for (let i = 0; i < P.ws.length; i++) if (P.ws[i].def.id === id) return P.ws[i]; return null; };
  const find = id => { for (let i = 0; i < live.length; i++) if (live[i].id === id) return live[i]; return null; };
  const gearMax = def => def.mag + (def.reserve || 0);

  /** Where it lands: near the body, on a floor, clear of walls, on the same level when possible. Depends only on the id and the map, so every screen agrees. */
  function landing(d) {
    const x = d.ox, y = d.oy, z = d.oz, half = d.mesh.geometry.userData.half || 0.3;
    let lx = x, lz = z, ly = grid.floorAt(x, y + 0.5, z, 0.05), yaw = d.id * 1.7, surf = grid.hit;
    search: for (let k = 0; k < 8; k++) {
      const an = d.id * 2.39996 + k * 0.9, dx = Math.sin(an), dz = Math.cos(an), want = k === 7 ? 0 : 0.45 + (d.id % 4) * 0.12;
      const clear = Math.min(grid.ray(x, y + 0.55, z, dx, 0, dz, want + 0.25), grid.ray(x, y + 0.15, z, dx, 0, dz, want + 0.25)), dist = Math.max(0, Math.min(want, clear - 0.25));
      const px = x + dx * dist, pz = z + dz * dist, fl = grid.floorAt(px, y + 0.5, pz, 0.05), sf = grid.hit;
      if (k < 7 && fl < y - 1) continue;       // over an edge: keep it on this level
      if (mover.blocked(px, fl + 0.03, pz, 0.1, 0.12)) continue;
      for (let j = 0; j < 4; j++) {
        const ya = d.id * 1.7 + j * Math.PI / 4, ex = Math.sin(ya) * half, ez = Math.cos(ya) * half;
        if (mover.blocked(px + ex, fl + 0.03, pz + ez, 0.04, 0.08) || mover.blocked(px - ex, fl + 0.03, pz - ez, 0.04, 0.08)) continue;
        lx = px; lz = pz; ly = fl; yaw = ya; surf = sf; break search;
      }
    }
    d.x = lx; d.y = ly + 0.012; d.z = lz; d.yaw = yaw; d.surf = surf ? surf.surface : null;
  }
  function place(d, x, y, z, rx) { const m = d.mesh; m.position.set(x, y, z); m.rotation.set(rx, d.yaw, 0); m.updateMatrix(); m.matrixWorldNeedsUpdate = true; }

  function fitAtt(d, ids) {
    const am = d.attMesh, g = geos.get(d.w), info = ids.length ? measuredGun(d.w) : null;       // measured by gunGeometry() during the load
    am.visible = false; if (!info || !g) return;
    am.geometry = attachmentGeometry(THREE, d.w, ids, info);
    if (g.userData.flat) { am.rotation.set(0, 0, Math.PI / 2); am.position.set(-g.userData.ox, -g.userData.oy, -g.userData.oz); } else { am.rotation.set(0, 0, 0); am.position.set(-g.userData.ox, -g.userData.oy, -g.userData.oz); }
    am.updateMatrix(); am.visible = true;
  }
  const finMats = fin => { try { return fin ? dropFinishMaterials(mat, matHi, fin) : null; } catch (e) { console.warn('[loot] finish', e); return null; } };
  function add(id, k, wid, a, r, x, y, z, ttl, att, fin) {
    if (find(id)) return null;
    const base = defOf(wid); if (!base || !geos.has(wid)) return null;
    const ids = k === 'w' ? sanitize(wid, att) : [], def = ids.length ? applyAttachments(base, ids) : base;
    while (live.length >= LOOT_CAP) remove(live[0]);
    const d = free.pop(); if (!d) return null;
    d.id = id; d.k = k; d.w = wid; d.def = def; d.att = ids.length ? ids : null; d.a = a; d.r = r; d.ox = x; d.oy = y; d.oz = z; d.t = 0; d.left = ttl; d.landed = false; d.wait = 0;
    d.fm = k === 'w' ? finMats(fin) : null; d.mesh.geometry = geos.get(wid); d.mesh.material = d.fm ? d.fm.mat : mat; d.mesh.visible = true;
    try { fitAtt(d, ids); } catch (e) { d.attMesh.visible = false; console.warn('[loot] attachments', e); }
    landing(d); d.sx = x; d.sy = y + 0.95; d.sz = z; place(d, d.sx, d.sy, d.sz, 2.6);
    live.push(d);
    return d;
  }
  function remove(d) {
    const i = live.indexOf(d); if (i < 0) return;
    live.splice(i, 1); d.mesh.visible = false; d.mesh.material = mat; d.fm = null; d.attMesh.visible = false; d.att = null; d.def = null; free.push(d);
    if (focus === d) focus = null;
    if (shownD === d) shownD = null;
  }
  function clear() { while (live.length) remove(live[live.length - 1]); focus = null; showPrompt(null); }

  /* ---------- prompt ---------- */
  function showPrompt(d) {
    if (!d) { if (shown) { shown = false; shownD = null; hud.loot(null); } return; }
    const code = settings.get('keys.interact'), lang = (ctx.i18n && ctx.i18n.lang) || '';
    if (shown && shownD === d && shownA === d.a && shownR === d.r && shownK === code && shownL === lang) return;
    shown = true; shownD = d; shownA = d.a; shownR = d.r; shownK = code; shownL = lang;
    const D = d.def, key = settings.keyLabel ? settings.keyLabel(code) : 'E', ammo = D.kind === 'melee' ? '' : ' (' + d.a + '/' + (d.r >= 0 ? d.r : D.mag) + ')';
    hud.loot(t('loot.take', { key, name: D.name, ammo }));
  }
  function setFocus(d) {
    if (focus === d) return;
    if (focus) focus.mesh.material = focus.fm ? focus.fm.mat : mat;
    focus = d; if (d) d.mesh.material = d.fm ? d.fm.hi : matHi;
  }
  function pickFocus() {
    let best = null, bs = 1e9; const p = player.pos, cp = camera.position; camera.getWorldDirection(fw);
    for (let i = 0; i < live.length; i++) {
      const d = live[i]; if (d.k !== 'w' || !d.landed || owned(d.w)) continue;
      const dx = d.x - p.x, dz = d.z - p.z, h2 = dx * dx + dz * dz; if (h2 > LOOK * LOOK || Math.abs(d.y - p.y) > 1.8) continue;
      const vx = d.x - cp.x, vy = d.y + 0.05 - cp.y, vz = d.z - cp.z, l = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1, dot = (vx * fw.x + vy * fw.y + vz * fw.z) / l;
      let s; if (h2 <= NEAR * NEAR) s = h2 - dot; else if (dot >= LOOK_DOT) s = 4 + (1 - dot) * 20 + h2 * 0.1; else continue;
      if (s < bs && grid.los(cp.x, cp.y, cp.z, d.x, d.y + 0.14, d.z)) { bs = s; best = d; }
    }
    setFocus(best);
  }

  /* ---------- taking ---------- */
  const say = (n, name) => { try { hud.api.message('+' + n + ' ' + name, { kind: 'good', dur: 1.1 }); } catch { /* optional */ } };
  const clink = () => { try { audio.reload('magIn', player.weaponId); } catch { /* optional */ } };
  /** Puts the weapon in the matching slot, in hand, with the normal draw animation. Returns the weapon it replaced. */
  function equipLoot(def, a, r) {
    let i = -1; for (let k = 0; k < P.ws.length; k++) if (P.ws[k].def.slot === def.slot) i = k;
    const slot = { def, ammo: a, res: r }, out = i >= 0 ? P.ws[i] : null;
    if (i >= 0) P.ws[i] = slot; else if (def.slot === 0) { P.ws.unshift(slot); i = 0; } else { P.ws.push(slot); i = P.ws.length - 1; }
    P.cur = i; P.reload = 0; P.burstN = 0; P.spin = 0; vm.cancelReload(); P.next = Math.max(P.next, ctx.now() + 0.32); P.kick = 0.3;
    vm.equip(def, P.outfit); player.weaponId = def.id; player.wdef = def; clink(); ctx.invChanged();
    return out;
  }
  function gainGear(def, n) {
    if (P.gear && P.gear.def === def) P.gear.n += n; else P.gear = { def, n, next: 0, label: def.name.toUpperCase() };
    clink(); say(n, def.name); ctx.invChanged();
  }
  function gainRounds(w, n) { w.res += n; clink(); say(n, w.def.name); ctx.invChanged(); }
  function take(d, swap) {
    if (ctx.online()) { if (clock < d.wait) return; d.wait = clock + RETRY; ctx.sendInv(); ctx.sendTake(d.id, swap); return; }
    if (d.k === 'x') { const n = ctx.gearItem ? ctx.gearItem.gain(d.w, d.a) : 0; if (n > 0) { d.a -= n; clink(); if (d.a <= 0) remove(d); } return; }       // equipment: the slot and the count live in engine-gear.js
    if (d.k === 'g') {
      const def = d.def, have = P.gear && P.gear.def === def ? P.gear.n : 0, n = Math.min(gearMax(def) - have, d.a); if (n <= 0) return;
      d.a -= n; if (d.a <= 0) remove(d); gainGear(def, n); return;
    }
    if (swap) {
      const def = d.def, a = d.a, r = d.r, px = player.pos.x, py = player.pos.y, pz = player.pos.z; remove(d);
      const out = equipLoot(def, a, r);
      if (out && (!limited(out.def) || rounds(out.ammo, out.res) > 0)) add(++seq, 'w', out.def.id, out.ammo, out.res, px, py, pz, LOOT_TTL, out.def.att, ctx.finOf ? ctx.finOf(out.def.id) : null);
      return;
    }
    const w = owned(d.w); if (!w || !limited(d.def)) return;
    const n = Math.min(d.def.reserve - w.res, rounds(d.a, d.r)); if (n <= 0) return;
    const fromR = Math.min(n, Math.max(d.r, 0)); d.r -= fromR; d.a -= n - fromR;
    if (rounds(d.a, d.r) <= 0) remove(d);
    gainRounds(w, n);
  }
  function wantsWalk(d) {
    if (d.k === 'x') return !!ctx.gearItem && ctx.gearItem.wants(d.w);
    if (d.k === 'g') return gearMax(d.def) - (P.gear && P.gear.def === d.def ? P.gear.n : 0) > 0;
    const w = owned(d.w); return !!w && limited(d.def) && w.res < d.def.reserve;
  }

  return {
    get live() { return live; }, get focus() { return focus; }, get enabled() { return enabled; },
    /** Builds every weapon's ground model, one per slice, and gives each pooled mesh one so the load uploads them all. */
    async prepare(defs, brk) {
      for (const D of defs) { if (!geos.has(D.id)) { gunGeometry(D.id); await brk(); } }
      for (let i = 0; i < free.length && defs.length; i++) free[i].mesh.geometry = geos.get(defs[i % defs.length].id);
    },
    /** An equipment model for the ground (same attributes and material as the weapons). */
    addModel(id, g) { if (geos.has(id)) return; if (!g.boundingSphere) g.computeBoundingSphere(); g.userData.half = Math.min(0.3, g.boundingSphere.radius); g.userData.ox = g.userData.oy = g.userData.oz = 0; geos.set(id, g); },
    /** Load only: one idle pooled mesh carries a finished material, so the warm-up links its program (add() resets the material). */
    warmFinish(fin) { const f = finMats(fin), d = free[free.length - 1]; if (f && d) d.mesh.material = f.mat; },
    begin(on) { clear(); enabled = !!on; seq = 0; clock = 0; },
    end() { clear(); enabled = false; },
    clear,
    /** Offline: a soldier just died. */
    onDeath(a) {
      if (!enabled || ctx.online() || a.kind !== 'soldier') return;
      const x = a.pos.x, y = a.pos.y, z = a.pos.z, drop = (D, am, re) => { if (D && (!limited(D) || rounds(am, re) > 0)) add(++seq, 'w', D.id, am, re, x, y, z, LOOT_TTL, D.att, a.isPlayer && ctx.finOf ? ctx.finOf(D.id) : null); };
      if (a.isPlayer) {
        for (const w of P.ws) drop(w.def, w.ammo, w.res);
        if (P.gear && P.gear.n > 0) add(++seq, 'g', P.gear.def.id, P.gear.n, 0, x, y, z, LOOT_TTL);
        if (ctx.gearItem) { const left = ctx.gearItem.drops(); if (left) for (const e of left) add(++seq, 'x', e.id, e.n, 0, x, y, z, LOOT_TTL); }
        return;
      }
      const ai = a.ai; if (!ai || ai.zombie) return;
      const pd = defOf(ai.prim || a.weaponId), sd = ai.sec ? defOf(ai.sec) : null, onP = !ai.prim || a.weaponId === ai.prim, cur = Math.max(0, ai.ammo | 0);
      if (pd) drop(pd, onP ? cur : Math.max(0, ai.ammo1 | 0), !limited(pd) ? -1 : ai.res < 0 ? pd.reserve : Math.min(ai.res, pd.reserve));
      if (sd) drop(sd, onP ? Math.max(0, ai.ammo2 | 0) : cur, limited(sd) ? sd.reserve : -1);
      if (ai.gearN > 0) { const g = defOf('frag'); if (g) add(++seq, 'g', 'frag', Math.min(ai.gearN, gearMax(g)), 0, x, y, z, LOOT_TTL); }
    },
    /** The interact key. False when it did nothing here (the objective keeps the key whenever it shows its own prompt). */
    press() {
      if (!enabled || !focus || !player.alive || rules.frozen || hud.promptOn || vm.throwPending) return false;       // no pickup until the grenade in hand has left it
      take(focus, true); return true;
    },
    update(dt) {
      if (!enabled) return;
      clock += dt;
      const on = player.alive && !rules.frozen, p = player.pos;
      for (let i = live.length - 1; i >= 0; i--) {
        const d = live[i]; d.left -= dt;
        if (d.left <= (ctx.online() ? -2 : 0)) { remove(d); continue; }       // online the server says when; this is only a safety net
        if (!d.landed) {
          d.t += dt;
          if (d.t < FLY) { const k = d.t / FLY; place(d, d.sx + (d.x - d.sx) * k, d.sy + (d.y - d.sy) * k + 1.3 * k * (1 - k), d.sz + (d.z - d.sz) * k, 2.6 * (1 - k)); }
          else if (d.t < FLY + SETTLE) place(d, d.x, d.y + 0.05 * Math.sin(Math.PI * (d.t - FLY) / SETTLE), d.z, 0);
          else {
            place(d, d.x, d.y, d.z, 0); d.landed = true;
            const nx = d.x - p.x, nz = d.z - p.z; if (nx * nx + nz * nz < 196) { try { audio.casing(d.surf || 'concrete'); } catch { /* optional */ } }
          }
        }
        if (d.left < BLINK) { const vis = Math.sin(d.left * 9) > -0.45; if (d.mesh.visible !== vis) d.mesh.visible = vis; }
        if (on && d.landed && clock >= d.wait) {
          const dx = d.x - p.x, dz = d.z - p.z;
          if (dx * dx + dz * dz <= AUTO * AUTO && Math.abs(d.y - p.y) < 1.6 && wantsWalk(d)) { if (ctx.online()) take(d, false); else { d.wait = clock + RETRY; take(d, false); } }
        }
      }
      focusT -= dt;
      if (focusT <= 0) { focusT = 0.08; if (on) pickFocus(); else setFocus(null); }
      showPrompt(on && focus && !hud.promptOn ? focus : null);
    },
    /** Online: everything the server says about drops. */
    onNet(m) {
      if (!enabled) return;
      switch (m.op) {
        case 'sync': clear(); // falls through
        case 'add': for (const q of m.items || []) add(q.id, q.k, q.w, q.a, q.r, q.x, q.y, q.z, (q.ttl || 0) / 1000, q.att, q.fin); break;
        case 'del': for (const id of m.ids || []) { const d = find(id); if (d) remove(d); } break;
        case 'upd': { const d = find(m.id); if (d) { d.a = m.a; d.r = m.r; } break; }
        case 'clear': clear(); break;
        case 'got': {
          const def = defOf(m.w); if (!def) break;
          if (m.k === 'x') clink();       // the new count arrives on the 'gx' channel
          else if (m.k === 'g') gainGear(def, m.n);
          else if (m.k === 'a') { const w = owned(m.w); if (w) gainRounds(w, m.n); }
          else if (m.k === 'w') equipLoot(applyAttachments(def, m.att), m.a, m.r);
          break;
        }
        case 'fail': { const d = find(m.id); if (d) d.wait = clock + RETRY; break; }
      }
    },
  };
}
