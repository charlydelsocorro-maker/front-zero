// FRONT ZÉRO — breachable walls in a match: plant a breaching charge on a panel, blow it (solids, nav, look, debris, dust, soot, sound,
// shake), keep every screen in step. Panels come from the layout (map-breach.js, data in map-breach-data.js); the rules live in
// breach-referee.js (the server's copy online, a local copy in solo) and gear-referee.js (the charge itself). Hooks in game.js, engine-gear.js.
// A failure here must never break a match: every hook is guarded by its caller and this module stays inert when anything is missing.
import * as THREE from 'three';
import './map-breach-data.js';
import './breach-referee.js';

const D = globalThis.FZBreachData, R = globalThis.FZBreachReferee;
const AWAY = -60, DEBRIS_N = 24, LIFE = 10, LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const TXT = {
  plant: ['[{k}] Poser la charge de brèche', '[{k}] Set the breaching charge', '[{k}] Colocar la carga de brecha', '[{k}] Breschladung anbringen', '[{k}] Colocar a carga de brecha', '[{k}] Piazza la carica da breccia'],
  c4: ['[{k}] C4 au pied de la paroi : elle ouvre le passage', '[{k}] C4 at the foot of this wall blows it open', '[{k}] C4 al pie de la pared: abre el paso', '[{k}] C4 am Fuß der Wand sprengt sie auf', '[{k}] C4 ao pé da parede: abre a passagem', '[{k}] C4 ai piedi della parete: apre il varco'],
  weak: ['Paroi fragile : charge de brèche ou C4', 'Weak wall: breaching charge or C4', 'Pared frágil: carga de brecha o C4', 'Schwache Wand: Breschladung oder C4', 'Parede frágil: carga de brecha ou C4', 'Parete fragile: carica da breccia o C4'],
  hatch: ['Trappe fragile : charge de brèche ou C4', 'Weak hatch: breaching charge or C4', 'Trampilla frágil: carga de brecha o C4', 'Schwache Luke: Breschladung oder C4', 'Alçapão frágil: carga de brecha ou C4', 'Botola fragile: carica da breccia o C4'],
  planting: ['Pose de la charge…', 'Setting the charge…', 'Colocando la carga…', 'Ladung wird angebracht…', 'Colocando a carga…', 'Piazzando la carica…'],
  aim: ['Vise une paroi fragile, de près', 'Aim at a weak wall, up close', 'Apunta a una pared frágil, de cerca', 'Ziele aus der Nähe auf eine schwache Wand', 'Aponta de perto a uma parede frágil', 'Mira da vicino una parete fragile'],
  off: ['Brèches indisponibles dans cette partie', 'Breaching is off in this match', 'Brechas no disponibles en esta partida', 'Breschen in diesem Spiel nicht verfügbar', 'Brechas indisponíveis nesta partida', 'Brecce non disponibili in questa partita'],
  cancel: ['Pose interrompue', 'Plant interrupted', 'Colocación interrumpida', 'Anbringen abgebrochen', 'Colocação interrompida', 'Posa interrotta'],
};
const CSS = `#bk-root{position:absolute;inset:0;pointer-events:none;z-index:3}
#bk-hint{position:absolute;left:50%;top:60%;transform:translateX(-50%);font:600 13px/18px system-ui,sans-serif;color:#f3e6c4;text-shadow:0 1px 3px #000;opacity:0;white-space:nowrap;letter-spacing:.02em}
#bk-hint b{color:#ffcf6a;font-weight:800}
#bk-prog{position:absolute;left:50%;top:66%;width:210px;margin-left:-105px;text-align:center;opacity:0;font:600 12px/16px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000}
#bk-prog div{height:4px;margin-top:3px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden}
#bk-prog span{display:block;height:100%;width:100%;background:#ffb347;transform-origin:left center;transform:scaleX(0)}`;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), rnd = (a, b) => a + Math.random() * (b - a);
/* viewmodel hand track (same pose space as engine-gear.js): reach to the pouch, raise the charge, press it on the wall, hold, let go */
const REST = [-.2, -.24, -.42, .4, .1, -.9, .9, .1, .4], OPEN = [.8, .85, .9, .9, .5], FIST = [.95, 1, 1.02, 1.02, .75], LOOSE = [.3, .32, .35, .35, .25], POUCH = [-.3, -.42, -.22, .12, -.75, -.65, .92, -.12, .36];
const key = (t, p, f, hold) => [t, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], f, !!hold];
function plantTrack(U) {
  const ahead = [-.12, -.12, -.46, .1, -.72, -.68, .95, -.15, .25], press = [-.09, -.05, -.52, .1, -.74, -.66, .95, -.15, .25], push = [-.09, -.05, -.55, .1, -.74, -.66, .95, -.15, .25];
  return [key(0, REST, OPEN, true), key(.15, POUCH, LOOSE, true), key(.22, POUCH, FIST, true), key(.5, ahead, FIST), key(.72, press, FIST, true), key(U * .7, push, FIST, true), key(U - .1, press, FIST, true), key(U, press, LOOSE, true), key(U + .3, REST, OPEN, true)];
}
/** Irregular chunk: a box with jittered corners, flat normals, vertex colours. */
function chunkGeo(hexes, seed) {
  const C = new THREE.Color(), P = [];
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 8; i++) P.push([(i & 1 ? .5 : -.5) * (.75 + .5 * r()), (i & 2 ? .5 : -.5) * (.6 + .5 * r()), (i & 4 ? .5 : -.5) * (.75 + .5 * r())]);
  const pos = [], nor = [], col = [];
  [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]].forEach((f, k) => {
    const [a, b, c, d] = f.map(i => P[i]); C.set(hexes[k % hexes.length]); const shade = .85 + .3 * r();
    for (const [A, B, Cc] of [[a, b, c], [a, c, d]]) {
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = Cc[0] - A[0], vy = Cc[1] - A[1], vz = Cc[2] - A[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const cx = (A[0] + B[0] + Cc[0]) / 3, cy = (A[1] + B[1] + Cc[1]) / 3, cz = (A[2] + B[2] + Cc[2]) / 3, out = nx * cx + ny * cy + nz * cz >= 0;
      const tri = out ? [A, B, Cc] : [A, Cc, B]; if (!out) { nx = -nx; ny = -ny; nz = -nz; }
      for (const q of tri) { pos.push(q[0], q[1], q[2]); nor.push(nx, ny, nz); col.push(C.r * shade, C.g * shade, C.b * shade); }
    }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function createBreach(c) {
  const { scene, camera, grid, nav, world, fx, audio, settings, i18n, player, P, rules, hud, hudRoot, vm, gear, proj } = c;
  const E = () => c.getE();
  let enabled = false, online = false, net = null, me = 'player', core = null, simMs = 0, mapId = null, B = null, authOff = false, ready = false;
  let panels = [], mesh = null, attr = null, orig = null, ranges = null;
  const lang = () => { const i = LANGS.indexOf((i18n && i18n.lang) || 'fr'); return i < 0 ? 0 : i; }, tx = k => TXT[k][lang()];
  const play = (n, a, b) => { try { const f = audio && audio[n]; if (typeof f === 'function') f.call(audio, a, b); } catch { /* audio is optional */ } };
  const snd = { x: 0, y: 0, z: 0, size: 1, own: false, occluded: false }, at = (x, y, z, size) => { snd.x = x; snd.y = y; snd.z = z; snd.size = size === undefined ? 1 : size; snd.own = false; snd.occluded = false; return snd; };
  const say = (text, kind) => { try { hud.api.message(text, { kind: kind || 'info', dur: 1.3 }); } catch { /* optional */ } };

  /* ---------- debris: three pooled instanced meshes (light plaster, wood, steel), the props' shard program ---------- */
  const lam = new THREE.MeshLambertMaterial({ vertexColors: true }), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), AX = new THREE.Vector3();
  const KINDS = { plaster: 0, hatch: 1, planks: 1, sheet: 2 };
  const dm = [chunkGeo([0xd8d0bf, 0xc9bfa9, 0x8c8474, 0xe0d8c6], 11), chunkGeo([0x8a6a44, 0x6c5134, 0xb58f5c, 0x7a5c3a], 23), chunkGeo([0x6d7468, 0x4c524a, 0x7a8174, 0x3d413c], 37)].map(g => {
    const m = new THREE.InstancedMesh(g, lam, DEBRIS_N); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.visible = false; m.name = 'breach-debris'; return m;
  });
  const NT = DEBRIS_N * 3, dP = new Float32Array(NT * 3), dV = new Float32Array(NT * 3), dA = new Float32Array(NT * 4), dS = new Float32Array(NT), dL = new Float32Array(NT), dR = new Uint8Array(NT), dK = new Uint8Array(NT), dB = new Uint8Array(NT);
  let dLive = 0, added = false;
  function addMeshes() { if (added) return; added = true; for (const m of dm) scene.add(m); }

  /* ---------- HUD ---------- */
  let dom = null;
  function buildDom() {
    if (dom || !hudRoot || typeof document === 'undefined') return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'bk-root'; root.innerHTML = '<div id="bk-hint"></div><div id="bk-prog"><em style="font-style:normal"></em><div><span></span></div></div>';
    hudRoot.appendChild(root); dom = { root, hint: root.querySelector('#bk-hint'), prog: root.querySelector('#bk-prog'), progT: root.querySelector('#bk-prog em'), progB: root.querySelector('#bk-prog span'), hintK: '', hintO: -1, progO: -1 };
  }
  function setHint(k, text) { if (!dom) return; if (dom.hintK !== k) { dom.hintK = k; dom.hint.innerHTML = text || ''; } const o = k ? 1 : 0; if (dom.hintO !== o) { dom.hintO = o; dom.hint.style.opacity = o; } }
  function setProg(f) { if (!dom) return; const o = f >= 0 ? 1 : 0; if (dom.progO !== o) { dom.progO = o; dom.prog.style.opacity = o; if (o) dom.progT.textContent = tx('planting'); } if (o) dom.progB.style.transform = 'scaleX(' + clamp(f, 0, 1).toFixed(3) + ')'; }
  const esc = s => String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));

  /* ---------- panels ---------- */
  function zoneOf(p) { const b = p.box, s = p.spec; if (s.ax === 'y') return [b.x0 - .3, b.x1 + .3, b.z0 - .3, b.z1 + .3, b.y1, b.y1]; return s.ax === 'x' ? [b.x0, b.x1, b.z0 - .45, b.z1 + .45, b.y0, b.y1] : [b.x0 - .45, b.x1 + .45, b.z0, b.z1, b.y0, b.y1]; }
  function showRange(a, b, on) {
    if (!attr || b <= a) return;
    const arr = attr.array; if (on) arr.set(orig.subarray(a * 3, b * 3), a * 3); else arr.fill(0, a * 3, b * 3);
    if (attr.addUpdateRange) attr.addUpdateRange(a * 3, (b - a) * 3); else attr.updateRange = { offset: a * 3, count: (b - a) * 3 };
    attr.needsUpdate = true;
  }
  function look(p, blown) { const r = ranges && ranges[p.id]; if (!r) return; p.lk = !!blown; showRange(r.b0, r.b1, !blown); showRange(r.r0, r.r1, blown); }
  /** The minimap background is drawn once per map: after a panel opens (or the walls are restored) it is rebuilt, once for a burst of panels. */
  let mapT = 0; const mapDirty = () => { if (mapT) return; mapT = setTimeout(() => { mapT = 0; try { if (hud && hud.setMap && world && world.solids) hud.setMap(world.solids, world.size); } catch { /* minimap is optional */ } }, 60); };
  const fold = p => { for (const s of p.solids) { s.y0 = AWAY - 1; s.y1 = AWAY; } };
  const unfold = p => { for (const s of p.solids) { s.y0 = s.bkY0; s.y1 = s.bkY1; } };
  /** Everything whole again: solids, look, nav strips cut. */
  function restoreAll() {
    try { if (nav.openZones) nav.openZones(); } catch { /* nav without breach support */ }
    mapDirty();
    for (const p of panels) {
      p.broken = false; if (!p.ok) continue; unfold(p); look(p, false);
      if (p.spec.ax !== 'y') { try { nav.cutZone && nav.cutZone('bk' + p.id, ...p.zone); } catch { /* optional */ } }
    }
  }
  /** One panel blown: solids away, nav opened (wall) or cut (hatch), blown look, then the show unless silent. */
  function blow(id, silent, byId, how) {
    const p = panels[id]; if (!p || p.broken) return false;
    p.broken = true; if (!p.ok) return false;
    try { log.push({ t: silent ? -1 : E().time, id }); if (log.length > 256) log.shift(); } catch { /* replay log is optional */ }
    fold(p); look(p, true); mapDirty();
    try { if (p.spec.ax !== 'y') nav.openZone && nav.openZone('bk' + p.id); else nav.cutZone && nav.cutZone('bkh' + p.id, ...p.zone); } catch { /* optional */ }
    if (plantSt && plantSt.id === id) stopPlant(false);
    if (!silent) show(p, byId, how);
    return true;
  }
  function show(p, byId, how) {
    const b = p.box, s = p.spec, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2, k = KINDS[p.kind] || 0;
    const dens = clamp(c.density ? c.density() : 1, .25, 1.5), n = Math.round((s.ax === 'y' ? 10 : 18) * dens) + 4;
    // which side was the charge on: debris flies away from it
    let sx = 0, sz = 0, sy = 0;
    if (s.ax === 'y') sy = -1;
    else {       // the charge's side: the nearest charge still on the panel, else the last local plant
      let cp = p.lastSide || 1, bd = 2.5; const objs = gear.objs;
      if (objs) for (const o of objs.values()) { if (o.id !== 'breach' && o.id !== 'c4') continue; const d = Math.hypot(o.x - cx, o.z - cz); if (d < bd) { bd = d; cp = (s.ax === 'x' ? o.z - cz : o.x - cx) >= 0 ? 1 : -1; } }
      if (s.ax === 'x') sz = -cp; else sx = -cp;
    }
    for (let i = 0; i < n; i++) {
      const u = rnd(-.45, .45), v = rnd(.05, .95), x = s.ax === 'z' ? cx + rnd(-.1, .1) : cx + u * (b.x1 - b.x0), z = s.ax === 'x' ? cz + rnd(-.1, .1) : cz + u * (b.z1 - b.z0), y = s.ax === 'y' ? cy : b.y0 + v * (b.y1 - b.y0);
      const back = Math.random() < .22 ? -.5 : 1, sp = rnd(3, 9) * back;
      spawnChunk(i % 5 === 4 && k === 0 ? 1 : k, x, y, s.ax === 'y' ? cz + u * (b.z1 - b.z0) : z, sx * sp + rnd(-2, 2), (sy ? sy * rnd(1, 4) : rnd(.5, 4.5)), sz * sp + rnd(-2, 2), rnd(.06, s.ax === 'y' ? .16 : .22));
    }
    const dust = k === 2 ? 0x6b6a63 : k === 1 ? 0x8a7458 : 0xbdb3a0;
    try { for (let i = 0; i < 6; i++) { const u = rnd(-.4, .4); fx.puff(s.ax === 'z' ? cx : cx + u * (b.x1 - b.x0), s.ax === 'y' ? cy - .3 : b.y0 + rnd(.2, .9) * (b.y1 - b.y0), s.ax === 'x' ? cz : cz + u * (b.z1 - b.z0), dust, 5, 2.2); } } catch { /* optional */ }
    // soot around the hole on both faces (pooled decals of the explosions)
    try {
      if (proj && proj.scorch) {
        if (s.ax === 'y') proj.scorch(cx, b.y1 + .01, cz, 0, 1, 0, Math.max(b.x1 - b.x0, b.z1 - b.z0) * 1.1);
        else for (const sg of [-1, 1]) { const nx = s.ax === 'z' ? sg : 0, nz = s.ax === 'x' ? sg : 0, fxp = s.ax === 'z' ? (sg > 0 ? b.x1 : b.x0) : 0, fzp = s.ax === 'x' ? (sg > 0 ? b.z1 : b.z0) : 0, w = (s.ax === 'x' ? b.x1 - b.x0 : b.z1 - b.z0) / 2 + .55;
          for (const [du, dy] of [[-w, -.1], [w, -.1], [0, .62]]) proj.scorch(s.ax === 'z' ? fxp : cx + du, dy > 0 ? b.y1 + dy - .1 : b.y0 + (b.y1 - b.y0) * .45, s.ax === 'x' ? fzp : cz + du, nx, 0, nz, dy > 0 ? 1.1 : .95); }
      }
    } catch { /* optional */ }
    const surf = k === 2 ? 'metal' : k === 1 ? 'wood' : 'concrete';
    pend.push([simMs + 40, surf, cx, cy, cz, .9], [simMs + 170, surf, cx + rnd(-.5, .5), cy - .4, cz + rnd(-.5, .5), .7], [simMs + 330, surf, cx, b.y0 + .2, cz, .5]);
    // the blast's own shake comes with the explosion; a breach adds a short jolt for whoever stands near the wall
    const d = Math.hypot(camera.position.x - cx, camera.position.y - cy, camera.position.z - cz);
    if (d < 16 && !(settings.get && settings.get('gameplay.reducedMotion'))) P.shake = Math.max(P.shake || 0, .55 * (1 - d / 16));
    void byId; void how;
  }
  const pend = [], log = [];       // log: this match's breaches {t, id} and round resets {t, reset}, engine time (replays: replay-rec.js / replay-view.js)

  /* ---------- debris simulation (no collision with players; floor and walls only) ---------- */
  function spawnChunk(k, x, y, z, vx, vy, vz, size) {
    let slot = -1, old = -1, oldL = 1e9;
    for (let i = k * DEBRIS_N; i < (k + 1) * DEBRIS_N; i++) { if (!dL[i]) { slot = i; break; } if (dL[i] < oldL) { oldL = dL[i]; old = i; } }
    if (slot < 0) slot = old; if (slot < 0) return;
    if (!dL[slot]) dLive++;
    dP[slot * 3] = x; dP[slot * 3 + 1] = y; dP[slot * 3 + 2] = z; dV[slot * 3] = vx; dV[slot * 3 + 1] = vy; dV[slot * 3 + 2] = vz;
    AX.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(); dA[slot * 4] = AX.x; dA[slot * 4 + 1] = AX.y; dA[slot * 4 + 2] = AX.z; dA[slot * 4 + 3] = rnd(0, 6);
    dS[slot] = size; dL[slot] = LIFE + rnd(0, 2); dR[slot] = 0; dK[slot] = k; dB[slot] = 0;
  }
  let bounceSnd = 0;
  function stepDebris(dt) {
    if (!dLive) return;
    const counts = [0, 0, 0]; bounceSnd = Math.max(0, bounceSnd - dt);
    for (let i = 0; i < NT; i++) {
      if (!dL[i]) continue;
      dL[i] -= dt; if (dL[i] <= 0) { dL[i] = 0; dLive--; continue; }
      const o = i * 3, sz = dS[i];
      if (!dR[i]) {
        dV[o + 1] -= 18 * dt;
        const vx = dV[o], vz = dV[o + 2], hs = Math.sqrt(vx * vx + vz * vz);
        if (hs > .05) { const t = grid.ray(dP[o], dP[o + 1], dP[o + 2], vx / hs, 0, vz / hs, hs * dt + sz * .5); if (t < hs * dt + sz * .5) { dV[o] = -vx * .3; dV[o + 2] = -vz * .3; } }
        dP[o] += dV[o] * dt; dP[o + 1] += dV[o + 1] * dt; dP[o + 2] += dV[o + 2] * dt;
        const f = grid.floorAt(dP[o], dP[o + 1] + .3, dP[o + 2], .3) + sz * .3;
        if (dP[o + 1] < f) {
          dP[o + 1] = f;
          if (dV[o + 1] < -1.2 && !dB[i] && bounceSnd <= 0 && Math.hypot(dP[o] - camera.position.x, dP[o + 2] - camera.position.z) < 25) { dB[i] = 1; bounceSnd = .07; play('bounce', dK[i] === 2 ? 'metal' : dK[i] === 1 ? 'wood' : 'concrete', at(dP[o], dP[o + 1], dP[o + 2], .35)); }
          dV[o + 1] = -dV[o + 1] * .28; dV[o] *= .55; dV[o + 2] *= .55; dA[i * 4 + 3] *= .7;
          if (Math.abs(dV[o + 1]) < .7 && Math.hypot(dV[o], dV[o + 2]) < .5) { dR[i] = 1; dV[o] = dV[o + 1] = dV[o + 2] = 0; }
        }
        dA[i * 4 + 3] += dt * 9 * Math.min(1, Math.hypot(dV[o], dV[o + 1], dV[o + 2]) / 4);
      }
      const m = dm[dK[i]], j = counts[dK[i]]++, s = sz * clamp(dL[i] / .8, 0, 1);
      AX.set(dA[i * 4], dA[i * 4 + 1], dA[i * 4 + 2]); Q.setFromAxisAngle(AX, dA[i * 4 + 3]); V.set(dP[o], dP[o + 1], dP[o + 2]); S.set(s, s * .7, s); M4.compose(V, Q, S); m.setMatrixAt(j, M4);
    }
    for (let k = 0; k < 3; k++) { const m = dm[k], on = counts[k] > 0; m.count = counts[k]; if (m.visible !== on) m.visible = on; if (on) m.instanceMatrix.needsUpdate = true; }
  }
  function clearDebris() { dL.fill(0); dLive = 0; for (const m of dm) { m.count = 0; m.visible = false; } pend.length = 0; }

  /* ---------- aiming and planting ---------- */
  const FWD = new THREE.Vector3(), aimOut = { id: -1, t: 0, x: 0, y: 0, z: 0 };
  /** Intact panel under the crosshair within reach (fills aimOut), or -1. */
  function aimPanel(reach) {
    aimOut.id = -1; if (!panels.length) return -1;
    camera.getWorldDirection(FWD); const cp = camera.position;
    const was = grid.skipPane; grid.skipPane = true; const t = grid.ray(cp.x, cp.y, cp.z, FWD.x, FWD.y, FWD.z, reach); const h = grid.hit; grid.skipPane = was;
    if (!h || h.breach === undefined || t >= reach) return -1;
    const p = panels[h.breach]; if (!p || p.broken || !p.ok) return -1;
    aimOut.id = p.id; aimOut.t = t; aimOut.x = cp.x + FWD.x * t; aimOut.y = cp.y + FWD.y * t; aimOut.z = cp.z + FWD.z * t; return p.id;
  }
  let plantSt = null, hintT = 0;
  const pl = () => { const q = gear.pl; q.x = player.pos.x; q.y = player.pos.y; q.z = player.pos.z; q.status = player.alive ? 'alive' : 'dead'; q.team = player.team; return q; };
  const toRef = m => { if (online) { if (net && net.sendBreach) net.sendBreach(m); } else if (core) core.msg(pl(), m); };
  function wallPlace(id, it) {
    if (!ready || !enabled || authOff) { say(tx('off'), 'bad'); return; }
    if (plantSt) return;
    if (aimPanel(D.RULES.useR) < 0) { say(tx('aim'), 'bad'); return; }
    const p = panels[aimOut.id];
    plantSt = { id: p.id, t: 0, U: D.RULES.plantMs / 1000, x0: player.pos.x, z0: player.pos.z, gest: false, item: id, cur: P.cur };
    P.sprint = false; P.burstN = 0;
    toRef({ a: 'plant', id: p.id });
    try {
      const pr = gear.handProp(id), U = plantSt.U;
      plantSt.gest = vm.playGesture({ keys: vm.gestureTrack(plantTrack(U)), ev: [[.2, 'grab'], [.72, 'stick'], [U - .05, 'arm']], end: U + .3, prop: pr.g,
        onFrame(T) { pr.g.visible = T >= .2 && T < U; },
        onEvent(n) { play('reload', n === 'grab' ? 'pouch' : n === 'stick' ? 'magIn' : 'magTap', player.weaponId); },
        onEnd(done) { if (!done && plantSt && plantSt.gest) stopPlant(true); } }) !== false;
    } catch (e) { plantSt.gest = false; }
  }
  function stopPlant(tell) { if (!plantSt) return; const g = plantSt.gest; plantSt = null; setProg(-1); toRef({ a: 'stop' }); if (tell) say(tx('cancel'), 'bad'); if (g) { try { vm.cancelGrenade(); } catch { /* optional */ } } }
  function finishPlant() {
    const st = plantSt, p = panels[st.id]; plantSt = null; setProg(-1);
    if (!p || p.broken || !p.ok) return;
    const s = p.spec, b = p.box, cp = camera.position;
    let x, y, z, yaw;
    if (s.ax === 'y') { x = clamp(aimOut.x, b.x0 + .2, b.x1 - .2); z = clamp(aimOut.z, b.z0 + .2, b.z1 - .2); y = b.y1 + .005; yaw = player.yaw; }
    else {
      const off = p.kind === 'planks' ? .065 : p.kind === 'sheet' ? .05 : .04, side = s.ax === 'x' ? Math.sign(cp.z - (b.z0 + b.z1) / 2) || 1 : Math.sign(cp.x - (b.x0 + b.x1) / 2) || 1;
      p.lastSide = side;
      const nx = s.ax === 'z' ? side : 0, nz = s.ax === 'x' ? side : 0;
      y = clamp(aimOut.y - .23, b.y0 + .15, b.y1 - .62);
      if (s.ax === 'x') { x = clamp(aimOut.x, b.x0 + .24, b.x1 - .24); z = (side > 0 ? b.z1 : b.z0) + nz * off; }
      else { z = clamp(aimOut.z, b.z0 + .24, b.z1 - .24); x = (side > 0 ? b.x1 : b.x0) + nx * off; }
      yaw = Math.atan2(nx, nz);
    }
    if (!gear.placeAt(st.item, Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100, Math.round(yaw * 1000) / 1000, { pan: p.id })) toRef({ a: 'stop' });
  }
  function updatePlant(dt) {
    if (!plantSt) return;
    const st = plantSt;
    if (!player.alive || rules.frozen || Math.hypot(player.pos.x - st.x0, player.pos.z - st.z0) > .6 || P.cur !== st.cur) { stopPlant(true); return; }
    if (aimPanel(D.RULES.useR + .5) !== st.id) { stopPlant(true); return; }
    st.t += dt; P.next = Math.max(P.next, E().time + .1); P.sprint = false;
    setProg(st.t / st.U);
    if (st.t >= st.U) finishPlant();
  }
  function updateHint(dt) {
    hintT -= dt; if (hintT > 0) return; hintT = .1;
    if (!dom) return;
    if (!ready || !player.alive || plantSt || rules.frozen) { setHint('', ''); return; }
    const id = aimPanel(4); if (id < 0) { setHint('', ''); return; }
    const L = gear.slots && gear.slots.L, kl = settings.keyLabel ? settings.keyLabel(settings.get('keys.grenade')) : 'G', p = panels[id];
    if (L && L.id === 'breach' && L.n > 0 && enabled && !authOff) { if (aimOut.t <= D.RULES.useR) setHint('p' + lang() + kl, esc(tx('plant')).replace('{k}', '<b>' + esc(kl) + '</b>')); else setHint('w' + lang() + p.kind, esc(tx(p.kind === 'hatch' ? 'hatch' : 'weak'))); return; }
    if (L && L.id === 'c4' && L.n > 0 && enabled && !authOff) { setHint('c' + lang() + kl, esc(tx('c4')).replace('{k}', '<b>' + esc(kl) + '</b>')); return; }
    if (aimOut.t <= 2.6) setHint('w' + lang() + p.kind, esc(tx(p.kind === 'hatch' ? 'hatch' : 'weak'))); else setHint('', '');
  }
  /* fuse ticks of the charges on panels (the LED blinks in engine-gear.js) */
  function fuseTicks(dt) {
    const objs = gear.objs; if (!objs || !objs.size) return;
    const fuse = (globalThis.FZGearData && globalThis.FZGearData.ITEMS.breach && globalThis.FZGearData.ITEMS.breach.fuseMs || 2500) / 1000;
    for (const o of objs.values()) {
      if (o.id !== 'breach' || o.st !== 'trig') continue;
      o.bkT = (o.bkT === undefined ? .05 : o.bkT) - dt;
      if (o.bkT <= 0) { const k = clamp((o.age || 0) / fuse, 0, 1); o.bkT = .46 - .37 * k; play('bounce', 'metal', at(o.x, o.y + .25, o.z, .14 + .1 * k)); }
    }
  }

  /* ---------- referee messages ---------- */
  function onMsg(m) {
    if (!m || typeof m.op !== 'string') return;
    if (m.op === 'set') { restoreAll(); authOff = false; if (Array.isArray(m.ids)) for (const id of m.ids) if (Number.isInteger(id)) blow(id, true); ready = true; }
    else if (m.op === 'off') { authOff = true; ready = true; }
    else if (m.op === 'brk') { if (Number.isInteger(m.id)) blow(m.id, false, m.by, m.k); }
    else if (m.op === 'reset') { restoreAll(); clearDebris(); try { log.push({ t: E().time, reset: 1 }); } catch { /* optional */ } }
  }
  function localCore() {
    return R.createBreachCore({ now: () => simMs, map: () => mapId, all(m) { onMsg(m); }, send(p, m) { onMsg(m); } });
  }

  return {
    get panels() { return panels; }, get enabled() { return enabled && !authOff; }, core: () => core,
    /** Right after world.load / props.attach: the panels of this map, their mesh and their solids. */
    attach(id) {
      addMeshes(); buildDom();
      mapId = id; B = world.breach || null; panels = []; mesh = null; attr = null; orig = null; ranges = null; enabled = false; ready = false; plantSt = null;
      if (!B || !B.length || !D || !R) return;
      mesh = B.mesh || null; attr = mesh ? mesh.geometry.attributes.position : null; orig = B.orig || null; ranges = B.ranges || null;
      for (const q of B) {
        const p = { id: q.id, spec: q.spec, box: q.box, ok: !!q.ok, kind: q.kind, broken: false, solids: [], zone: null, lastSide: 1 };
        if (p.ok) { for (const s of world.solids) if (s.breach === q.id) { s.bkY0 = s.y0; s.bkY1 = s.y1; p.solids.push(s); } p.zone = zoneOf(p); if (!p.solids.length) p.ok = false; }
        panels.push(p);
      }
      for (const m of dm) { m.count = 1; m.setMatrixAt(0, ZERO); m.instanceMatrix.needsUpdate = true; m.visible = true; }       // linked with the map (shader warm-up)
    },
    /** The nav grid is built with every wall panel away (a breach then opens its strip without any rebuild). */
    navFold(on) { for (const p of panels) { if (!p.ok || p.spec.ax === 'y') continue; if (on) fold(p); else unfold(p); } },
    begin(isOnline, theNet, myId) {
      log.length = 0; online = !!isOnline; net = theNet || null; me = myId || 'player'; simMs = 0; plantSt = null; authOff = false; clearDebris(); setHint('', ''); setProg(-1);
      for (const m of dm) { m.count = 0; m.visible = false; }
      if (!panels.length) { enabled = false; ready = false; return; }
      restoreAll();
      enabled = panels.some(p => p.ok) && (!online || !!(net && net.bkOk));
      ready = false; core = null;
      if (!enabled) return;
      const req = { a: 'req', h: B.hash, ...(B.extras && B.extras.length ? { x: B.extras } : null) };
      if (online) toRef(req); else { core = localCore(); core.msg(pl(), req); }
    },
    end() { if (plantSt) stopPlant(false); try { if (nav.openZones) nav.openZones(); } catch { /* optional */ } for (const p of panels) { p.broken = false; if (p.ok) { unfold(p); look(p, false); } } enabled = false; ready = false; core = null; clearDebris(); setHint('', ''); setProg(-1); },
    /** Solo, between rounds (online the server sends 'reset'). */
    roundReset() { if (!online && core) core.reset(); },
    onNet(m) { try { onMsg(m); } catch (e) { console.warn('[breach] net', e); } },
    /** engine-gear.js: a lethal item with wall:true was pressed. */
    wallPlace(id, it) { try { wallPlace(id, it); } catch (e) { console.warn('[breach] plant', e); plantSt = null; } },
    /** engine-gear.js local referee hooks (solo). */
    placeCheck(p, m, it, now) { return core ? core.placeCheck(p, m, it, now) : 'off'; },
    detonated(o, now) { if (core) core.detonated(o, now); },
    cancel() { if (plantSt) stopPlant(false); },
    get planting() { return !!plantSt; },
    update(dt) {
      if (!panels.length) return;
      simMs += dt * 1000;
      if (ready) { updatePlant(dt); fuseTicks(dt); }
      updateHint(dt);
      for (let i = pend.length - 1; i >= 0; i--) { const q = pend[i]; if (simMs < q[0]) continue; pend.splice(i, 1); play('impact', q[1], at(q[2], q[3], q[4], q[5])); }
      stepDebris(dt);
    },
    /** Tests and tools: blow a panel as the referee would (solo only). */
    debugBlow(id) { if (!online && core) return core.blow(id, me, 'debug'); return false; },
    /** Tests: a visual blast (no damage), the same as a charge's. */
    debugBlast(x, y, z, r) { try { proj.explode(x, y, z, { radius: r || 3.2, damage: 0, by: null, weaponId: 'breach', visual: true, pid: 0 }); } catch { /* optional */ } },
    /** Replays (replay-rec.js, replay-view.js): this match's breach log, kept after the match until the next one starts. */
    history() { return log.map(e => ({ ...e })); },
    /** Replays: show the panels as they were at engine time t according to a history; look only (no solid, no nav, no sound). */
    showAt(h, t) { if (!Array.isArray(h) || !panels.length) return; const on = new Set(); for (const e of h) { if (!e || e.t > t) continue; if (e.reset) on.clear(); else on.add(e.id); } for (const p of panels) { if (!p.ok) continue; const want = on.has(p.id); if (p.lk !== want) look(p, want); } },
    /** Replays: back to the live look (what the solids say). */
    restoreLook() { for (const p of panels) if (p.ok && p.lk !== p.broken) look(p, p.broken); },
    debug() { let rest = 0; for (let i = 0; i < NT; i++) if (dL[i] && dR[i]) rest++; return { ready, enabled, authOff, online, planting: plantSt ? { id: plantSt.id, t: plantSt.t } : null, panels: panels.map(p => ({ id: p.id, ok: p.ok, broken: p.broken, lk: !!p.lk, kind: p.kind, box: p.box, ax: p.spec.ax })), debris: dLive, resting: rest, hint: dom ? dom.hintK : '' }; },
  };
}
