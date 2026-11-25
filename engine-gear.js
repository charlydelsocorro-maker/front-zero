// FRONT ZÉRO — equipment in a match: three slots (lethal, tactical, medical), first-person gestures, thrown and placed objects, smoke, fire, flash,
// bots' use of it, HUD. The rules live in gear-referee.js (the server's copy online, a local copy in solo). A failure here must never break a match.
import * as THREE from 'three';
import './gear-data.js';
import './gear-referee.js';
import { gearModel, gearMaterial } from './gear-models.js';

const D = globalThis.FZGearData, R = globalThis.FZGearReferee, { ITEMS } = D;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), sat = v => clamp(v, 0, 1), rnd = (a, b) => a + Math.random() * (b - a);
const MAXI = 12, CLOUDS = 5, PER_CLOUD = 18, FIRES = 4, PER_FIRE = 16, GRIP = [0.006, 0.15, 0.024];
const REST = [-.2, -.24, -.42, .4, .1, -.9, .9, .1, .4], OPEN = [.8, .85, .9, .9, .5], FIST = [.95, 1, 1.02, 1.02, .75], LOOSE = [.3, .32, .35, .35, .25];
const POUCH = [-.3, -.42, -.22, .12, -.75, -.65, .92, -.12, .36];
const key = (t, p, f, hold) => [t, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], f, !!hold];
/* Gesture tracks in camera space. U = time of the effect (the server's use time); the hand is back at rest 0.3 s later. */
function injectTrack(U) {
  const show = [-.17, -.07, -.38, .55, .35, -.75, .8, -.35, .45], raise = [-.18, -.01, -.36, .45, -.72, -.53, .85, .45, .27], stab = [-.125, -.095, -.4, .45, -.72, -.53, .85, .45, .27], out = [-.175, -.02, -.37, .45, -.72, -.53, .85, .45, .27];       // the hand stays across the line of sight, so the fist never hides the needle
  return [key(0, REST, OPEN, true), key(U * .15, POUCH, LOOSE, true), key(U * .2, POUCH, FIST, true), key(U * .4, show, FIST), key(U * .58, raise, FIST), key(U * .67, stab, FIST, true), key(U * .9, stab, FIST, true), key(U + .02, out, FIST), key(U + .3, REST, OPEN, true)];
}
function wrapTrack(U) {
  const a = [-.17, -.15, -.37, .6, .35, -.72, .75, -.35, .55], b = [-.1, -.11, -.39, .35, .6, -.72, .9, -.3, .3], c = [-.16, -.19, -.36, .62, .05, -.78, .75, -.25, .6];
  const k = [key(0, REST, OPEN, true), key(Math.min(.3, U * .2), POUCH, LOOSE, true), key(Math.min(.38, U * .25), POUCH, FIST, true)];
  const n = Math.max(2, Math.round((U - .7) / .42)); for (let i = 0; i < n; i++) k.push(key(.62 + (U - .85) * i / n, i % 3 === 0 ? a : i % 3 === 1 ? b : c, FIST));
  k.push(key(U - .1, a, FIST), key(U + .3, REST, OPEN, true));
  return k;
}
function plateTrack(U) {
  const up = [-.1, -.2, -.42, .12, .75, -.65, .95, -.1, .3], chest = [-.03, -.26, -.4, .02, .85, -.52, 1, 0, .05], seat = [-.03, -.34, -.32, .02, .9, -.43, 1, 0, .05];
  return [key(0, REST, OPEN, true), key(U * .2, POUCH, LOOSE, true), key(U * .26, POUCH, FIST, true), key(U * .5, up, FIST), key(U * .72, chest, FIST, true), key(U * .9, seat, FIST), key(U + .02, seat, LOOSE, true), key(U + .3, REST, OPEN, true)];
}
function placeTrack() {
  const ahead = [-.13, -.13, -.46, .1, -.72, -.68, .95, -.15, .25], down = [-.12, -.25, -.5, .08, -.86, -.5, .95, -.15, .25];
  return [key(0, REST, OPEN, true), key(.16, POUCH, LOOSE, true), key(.22, POUCH, FIST, true), key(.46, ahead, FIST), key(.6, down, FIST, true), key(.68, down, LOOSE, true), key(.95, REST, OPEN, true)];
}
function clackTrack() {
  const up = [-.11, -.2, -.38, .12, .72, -.68, .95, -.2, .25];
  return [key(0, REST, OPEN, true), key(.14, up, FIST, true), key(.32, up, FIST, true), key(.62, REST, OPEN, true)];
}
const TRACK_OF = { syringe: injectTrack, adren: injectTrack, bandage: wrapTrack, medkit: wrapTrack, plate: plateTrack };
const CSS = `
#gx-root{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:3}
#gx-blind,#gx-smoke,#gx-stun{position:absolute;inset:0;opacity:0}
#gx-blind{background:#fff}#gx-smoke{background:#8f8e88}
#gx-stun{background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(20,18,12,.62) 100%)}
#gx-slots{position:absolute;right:18px;bottom:128px;display:flex;gap:6px}
.gx-s{position:relative;width:62px;height:46px;background:rgba(14,16,14,.55);border:1px solid rgba(255,255,255,.14);border-radius:4px;overflow:hidden}
.gx-s img{position:absolute;inset:2px 2px 2px 2px;width:calc(100% - 4px);height:calc(100% - 4px);object-fit:contain}
.gx-s b{position:absolute;right:3px;bottom:1px;font:700 12px/14px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000}
.gx-s i{position:absolute;left:3px;top:1px;font:700 10px/13px system-ui,sans-serif;font-style:normal;color:#d9c98f;text-shadow:0 1px 2px #000}
.gx-s.off{opacity:.42}
#gx-use{position:absolute;left:50%;top:76%;width:200px;margin-left:-100px;text-align:center;opacity:0;font:600 12px/16px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000}
#gx-use div{height:4px;margin-top:3px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden}
#gx-use span{display:block;height:100%;width:100%;background:#8fd08a;transform-origin:left center}
#gx-hot{position:absolute;right:18px;bottom:180px;width:194px;height:3px;background:rgba(255,255,255,.14);opacity:0}
#gx-hot span{display:block;height:100%;width:100%;background:#7fd07a;transform-origin:left center}
#gx-warn{position:absolute;left:50%;top:27%;transform:translateX(-50%);font:700 13px/18px system-ui,sans-serif;color:#ff7a5a;text-shadow:0 1px 3px #000;opacity:0}`;

export function createGear(c) {
  const { scene, camera, grid, audio, settings, i18n, profile, vm, actors, player, P, rules, hudRoot } = c;
  const hud = c.hud, E = () => c.getE();
  let enabled = false, online = false, net = null, me = 'player', core = null, simMs = 0, tokenSeq = 0, scanT = 0, botT = 0;
  const slots = { L: { id: 'frag', n: 0 }, T: { id: 'flash', n: 0 }, M: { id: 'bandage', n: 0 } };
  const objs = new Map(), byToken = new Map(), fxs = { blind: 0, blindMax: 1, stun: 0, stunMax: 1, boost: 0, after: 0, hot: 0, hotMax: 1 };
  let use = null, hitAcc = 0;
  const lang = () => (i18n && i18n.lang) || 'fr', tx = k => D.t(k, lang());
  const reduced = () => !!settings.get('gameplay.reducedMotion');
  const snd = { x: 0, y: 0, z: 0, size: 1, own: false, occluded: false, run: false };
  const at = (x, y, z, size) => { snd.x = x; snd.y = y; snd.z = z; snd.size = size === undefined ? 1 : size; return snd; };
  const play = (n, a, b) => { try { const f = audio[n]; if (typeof f === 'function') f.call(audio, a, b); } catch { /* audio is optional */ } };
  const stage = s => play('reload', s, player.weaponId);
  const say = (text, kind) => { try { hud.api.message(text, { kind: kind || 'info', dur: 1.2 }); } catch { /* optional */ } };

  /* ---------- world models: one instanced mesh per item, one shared material ---------- */
  const worldMat = gearMaterial(THREE, false), inst = new Map(), parts = new Map();
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), EU = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), V2 = new THREE.Vector3(), COL = new THREE.Color();
  function worldMesh(id) {
    let im = inst.get(id); if (im) return im;
    const m = gearModel(THREE, id); im = new THREE.InstancedMesh(m.geo, worldMat, MAXI); im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.visible = false; scene.add(im); inst.set(id, im);
    if (m.parts.led) parts.set(id, m.parts.led.pivot);
    return im;
  }
  const ledGeo = new THREE.SphereGeometry(0.014, 8, 6), ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const leds = new THREE.InstancedMesh(ledGeo, ledMat, 24); leds.count = 0; leds.frustumCulled = false; leds.instanceMatrix.setUsage(THREE.DynamicDrawUsage); leds.setColorAt(0, COL.setHex(0xffffff)); leds.visible = false; scene.add(leds);

  /* ---------- smoke and fire: two point clouds, drawn only when something is alive ---------- */
  const NS = CLOUDS * PER_CLOUD, NF = FIRES * PER_FIRE;
  const vs = 'attribute vec2 aD;varying float vA;uniform float uH;void main(){vA=aD.y;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aD.y>0.?clamp(aD.x*uH*projectionMatrix[1][1]/max(.3,-mv.z),1.,520.):0.;}';
  const smokeMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uH: { value: 720 } }, vertexShader: vs, fragmentShader: 'varying float vA;void main(){vec2 p=gl_PointCoord-.5;float r=dot(p,p)*4.;if(r>1.)discard;float n=.86+.14*sin(gl_PointCoord.x*9.+gl_PointCoord.y*7.);gl_FragColor=vec4(vec3(.60,.59,.56)*n,pow(1.-r,1.25)*vA);}' });
  const fireMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uH: smokeMat.uniforms.uH }, vertexShader: vs, fragmentShader: 'varying float vA;void main(){vec2 p=gl_PointCoord-.5;float r=dot(p,p)*4.;if(r>1.)discard;float k=1.-r;gl_FragColor=vec4(vec3(1.,.42+.4*k,.12+.25*k*k)*k*vA,k*vA);}' });
  const mkPts = (n, mat, order) => { const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), d = new Float32Array(n * 2); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aD', new THREE.BufferAttribute(d, 2).setUsage(THREE.DynamicDrawUsage)); const o = new THREE.Points(g, mat); o.frustumCulled = false; o.renderOrder = order; o.visible = false; scene.add(o); return { o, pos, d, g }; };
  const sm = mkPts(NS, smokeMat, 7), fi = mkPts(NF, fireMat, 8);
  const seedS = new Float32Array(NS * 4), seedF = new Float32Array(NF * 4); for (let i = 0; i < NS; i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()); seedS[i * 4] = Math.cos(a) * r; seedS[i * 4 + 1] = Math.random(); seedS[i * 4 + 2] = Math.sin(a) * r; seedS[i * 4 + 3] = Math.random() * 6.283; } for (let i = 0; i < NF; i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()); seedF[i * 4] = Math.cos(a) * r; seedF[i * 4 + 1] = Math.random(); seedF[i * 4 + 2] = Math.sin(a) * r; seedF[i * 4 + 3] = Math.random() * 6.283; }
  const cloudUsed = new Array(CLOUDS).fill(null), fireUsed = new Array(FIRES).fill(null);
  const takeSlot = (arr, o) => { for (let i = 0; i < arr.length; i++) if (!arr[i]) { arr[i] = o; return i; } let old = 0; for (let i = 1; i < arr.length; i++) if (arr[i].t0 < arr[old].t0) old = i; arr[old].slot = -1; arr[old] = o; return old; };
  const freeSlot = (arr, o) => { if (o.slot >= 0 && arr[o.slot] === o) arr[o.slot] = null; o.slot = -1; };

  /* ---------- viewmodel props: built during the load ---------- */
  const props = new Map();
  function prop(id) {
    let p = props.get(id); if (p) return p;
    const m = gearModel(THREE, id), mat = gearMaterial(THREE, true), g = new THREE.Group(), main = new THREE.Mesh(m.geo, mat); main.frustumCulled = false; g.add(main); const sub = {};
    for (const k of Object.keys(m.parts)) { const q = m.parts[k], o = new THREE.Mesh(q.geo, mat); o.frustumCulled = false; o.position.set(q.pivot[0], q.pivot[1], q.pivot[2]); g.add(o); sub[k] = o; o.userData.py = q.pivot[1]; }
    g.position.set(GRIP[0], GRIP[1], GRIP[2]);
    const big = m.radius > 0.16, sc = big ? 0.16 / m.radius : 1; g.scale.setScalar(sc);
    if (id === 'syringe' || id === 'adren') { g.rotation.set(Math.PI, 0, 0); g.scale.setScalar(1.35); }       // needle toward the fingertips
    else if (id === 'plate') g.rotation.set(0, Math.PI / 2, 0);       // its flat face toward the eye
    p = { g, sub }; vm.mountProp(g); props.set(id, p); return p;
  }

  /* ---------- HUD ---------- */
  let dom = null;
  function buildDom() {
    if (dom || !hudRoot) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'gx-root';
    root.innerHTML = '<div id="gx-smoke"></div><div id="gx-stun"></div><div id="gx-blind"></div><div id="gx-slots"></div><div id="gx-use"><em style="font-style:normal"></em><div><span></span></div></div><div id="gx-hot"><span></span></div><div id="gx-warn"></div>';
    hudRoot.appendChild(root);
    const $ = s => root.querySelector(s), chips = {};
    for (const s of ['L', 'T', 'M']) { const d = document.createElement('div'); d.className = 'gx-s'; d.innerHTML = '<img alt=""><i></i><b></b>'; $('#gx-slots').appendChild(d); chips[s] = { d, img: d.querySelector('img'), key: d.querySelector('i'), n: d.querySelector('b'), id: '', cn: -1, k: '' }; }
    dom = { root, chips, blind: $('#gx-blind'), smoke: $('#gx-smoke'), stun: $('#gx-stun'), use: $('#gx-use'), useT: $('#gx-use em'), useB: $('#gx-use span'), hot: $('#gx-hot'), hotB: $('#gx-hot span'), warn: $('#gx-warn'), vals: {} };
  }
  const setO = (el, k, v) => { const r = Math.round(v * 100) / 100; if (dom.vals[k] !== r) { dom.vals[k] = r; el.style.opacity = r; } };
  const KEYS = { L: 'keys.grenade', T: 'keys.tactical', M: 'keys.medical' };
  const fragUp = () => ITEMS[slots.L.id].kind === 'weapon' || (slots.L.n <= 0 && !!P.gear && P.gear.n > 0);
  const shown = s => { if (s !== 'L' || !fragUp()) return slots[s].n; return P.gear ? P.gear.n : 0; };
  function paintSlots() {
    if (!dom) return;
    for (const s of ['L', 'T', 'M']) {
      const ch = dom.chips[s], sl = slots[s], n = shown(s), lbl = settings.keyLabel ? settings.keyLabel(settings.get(KEYS[s])) : '', sid = s === 'L' && fragUp() ? 'frag' : sl.id;
      if (ch.id !== sid) { ch.id = sid; ch.img.src = new URL('map-shots/gear-' + sid + '.webp', import.meta.url).href; ch.d.title = D.nameOf(sid, lang()); }
      if (ch.cn !== n) { ch.cn = n; ch.n.textContent = '×' + n; ch.d.classList.toggle('off', n <= 0); }
      if (ch.k !== lbl) { ch.k = lbl; ch.key.textContent = lbl; }
    }
  }

  /* ---------- talking to the referee ---------- */
  const syncPl = () => { pl.hp = player.hp; pl.armor = player.armor; pl.maxHp = player.maxHp; pl.maxArmor = player.maxArmor; pl.team = player.team; pl.status = player.alive ? 'alive' : 'dead'; pl.x = player.pos.x; pl.y = player.pos.y; pl.z = player.pos.z; pl.vx = player.vx; pl.vz = player.vz; };
  const ACTS = { use: 1, throw: 1, place: 1, remote: 1 };       // the player's own gear acts: they end the spawn protection (c.onAct, engine-guard.js)
  const send = m => { if (c.onAct && ACTS[m.a] === 1) { try { c.onAct(player); } catch { /* optional */ } } if (online) { if (net && net.sendGear) net.sendGear(m); } else if (core) { syncPl(); core.msg(pl, m); } };
  const pl = { id: 'player', team: null, status: 'lobby', hp: 100, maxHp: 100, armor: 0, maxArmor: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0, life: 0, hasPos: true, gx: null };
  const recs = new Map();
  const recOf = a => { let r = recs.get(a); if (!r) { r = { id: a.id, actor: a, team: a.team, status: 'alive', hp: a.hp, maxHp: a.maxHp, armor: 0, maxArmor: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0, life: 1, hasPos: true, gx: null }; recs.set(a, r); } return r; };
  const actorOf = id => { if (id === me || id === 'player') return player; for (let i = 0; i < actors.length; i++) if (actors[i].id === id) return actors[i]; return null; };
  function localCore() {
    const list = [];
    return R.createGearCore({
      now: () => simMs, canFight: () => !rules.frozen, npcs: () => false, emptyStart: () => !rules.playerLoadout,
      all(m, except) { if (except !== pl) onMsg(m); }, send(p, m) { if (p === pl) onMsg(m); },
      players() { list.length = 0; list.push(pl); for (let i = 0; i < actors.length; i++) { const a = actors[i]; if (a === player) continue; const r = recOf(a); r.status = a.alive ? 'alive' : 'dead'; r.x = a.pos.x; r.y = a.pos.y; r.z = a.pos.z; r.vx = a.vx; r.vz = a.vz; r.team = a.team; list.push(r); } return list; },
      isEnemy(a, b) { return c.isEnemy(a === pl ? player : a.actor || null, b === pl ? player : b.actor || null); },
      blast() { /* the owner's client explodes it on the 'det' message */ },
      hurt(q, amount, owner, id) { const v = q === pl ? player : q.actor, by = owner ? (owner === pl ? player : owner.actor) : null; if (v) E().damage(v, amount, { by: by === v ? null : by, weaponId: id }); },
      refill() { /* the launchers' reserve is refilled on the 'ammo' answer */ },
      placeCheck(p, m, it, now) { return c.breachCheck ? c.breachCheck(p, m, it, now) : 'off'; },       // breaching charge rules (engine-breach.js, local breach referee)
      detonated(o, now) { if (c.breachBlast) c.breachBlast(o, now); },
    });
  }

  /* ---------- objects ---------- */
  function mk(o) {
    const it = ITEMS[o.id]; if (!it) return null;
    const q = { oid: o.oid, id: o.id, by: o.by, team: o.team === undefined ? null : o.team, x: o.x, y: o.y, z: o.z, yaw: o.yaw || 0, st: o.st || 'placed', vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, t0: simMs, arm: o.arm || 0, left: (o.left || 0) / 1000, spin: Math.random() * 6, rot: Math.random() * 6, rest: false, age: (o.age || 0) / 1000, slot: -1, att: null, ax: 0, ay: 0, az: 0, sent: false, polar: o.polar || null, c: o.c || 0, nextAsk: 0, trigAt: 0, sndT: rnd(.4, 1.2), hpF: 1, mark: false, ring: 0 };
    if (o.oid !== undefined && o.oid !== null) objs.set(o.oid, q);
    worldMesh(o.id);
    if (q.st === 'cloud') q.slot = takeSlot(cloudUsed, q); else if (q.st === 'fire') q.slot = takeSlot(fireUsed, q);
    return q;
  }
  function rm(o) {
    if (o.st === 'cloud') freeSlot(cloudUsed, o); else if (o.st === 'fire') freeSlot(fireUsed, o);
    if (o.mark) { o.mark = false; try { hud.api.marker('gx' + o.oid, null); } catch { /* optional */ } }
    objs.delete(o.oid);
  }
  const mine = o => o.by === me;
  const hostileTo = (o) => { if (o.by === me) return false; const a = actorOf(o.by); return a ? c.isEnemy(a, player) : (o.team === null || o.team !== player.team); };

  /* flight of thrown items: same steps on every screen, a contact stops or bounces them */
  function faceN(s, x, y, z, out) { let m = Math.abs(x - s.x0); out[0] = -1; out[1] = 0; out[2] = 0; let q = Math.abs(x - s.x1); if (q < m) { m = q; out[0] = 1; out[1] = 0; out[2] = 0; } q = Math.abs(y - s.y0); if (q < m) { m = q; out[0] = 0; out[1] = -1; out[2] = 0; } q = Math.abs(y - s.y1); if (q < m) { m = q; out[0] = 0; out[1] = 1; out[2] = 0; } q = Math.abs(z - s.z0); if (q < m) { m = q; out[0] = 0; out[1] = 0; out[2] = -1; } q = Math.abs(z - s.z1); if (q < m) { out[0] = 0; out[1] = 0; out[2] = 1; } }
  const NRM = [0, 1, 0];
  function landed(o, stuckId) {
    o.rest = true; o.vx = o.vy = o.vz = 0;
    if (o.by === me && !o.sent && o.oid > 0) { o.sent = true; send({ a: 'land', oid: o.oid, x: o.x, y: o.y, z: o.z, ...(stuckId ? { stuck: stuckId } : null) }); }
    if (Math.hypot(o.x - camera.position.x, o.z - camera.position.z) < 16) play('casing', 'metal');
  }
  function flyStep(o, h) {
    const it = ITEMS[o.id]; o.vy -= it.gravity * h;
    const sp = Math.sqrt(o.vx * o.vx + o.vy * o.vy + o.vz * o.vz) || 1e-3, dist = sp * h, dx = o.vx / sp, dy = o.vy / sp, dz = o.vz / sp, tt = grid.ray(o.x, o.y, o.z, dx, dy, dz, dist + 0.05);
    if (it.stick) for (let i = 0; i < actors.length; i++) { const a = actors[i]; if (!a.alive || a.ghost || a.id === o.by || (a === player && o.by === me)) continue; const hx = a.pos.x - o.x, hz = a.pos.z - o.z; if (hx * hx + hz * hz < 0.3 && o.y > a.pos.y && o.y < a.pos.y + 1.85) { o.att = a; o.ax = -hx; o.ay = o.y - a.pos.y; o.az = -hz; landed(o, a.id); return; } }
    if (tt >= dist + 0.05) { o.x += o.vx * h; o.y += o.vy * h; o.z += o.vz * h; return; }
    const cx = o.x + dx * tt, cy = o.y + dy * tt, cz = o.z + dz * tt, s = grid.hit; if (s) faceN(s, cx, cy, cz, NRM); else { NRM[0] = 0; NRM[1] = 1; NRM[2] = 0; }
    o.x = cx + NRM[0] * 0.05; o.y = cy + NRM[1] * 0.05; o.z = cz + NRM[2] * 0.05;
    if (it.stick || it.shatter) { landed(o); return; }
    const vn = o.vx * NRM[0] + o.vy * NRM[1] + o.vz * NRM[2], b = it.bounce || 0.3;
    o.vx -= (1 + b) * vn * NRM[0]; o.vy -= (1 + b) * vn * NRM[1]; o.vz -= (1 + b) * vn * NRM[2];
    if (NRM[1] > 0.7) { o.vx *= 0.5; o.vz *= 0.5; if (Math.abs(o.vy) < 1.3) { o.y = cy + 0.06; landed(o); return; } }
    if (Math.abs(vn) > 2 && Math.hypot(o.x - camera.position.x, o.z - camera.position.z) < 18) play('casing', 'metal');
  }

  /* ---------- effects ---------- */
  function flashAt(x, y, z, it) {
    const cp = camera.position, dx = x - cp.x, dy = y + 0.2 - cp.y, dz = z - cp.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz), R0 = it.flash.r;
    if (player.alive && d < R0 && grid.los(cp.x, cp.y, cp.z, x, y + 0.2, z)) {
      camera.getWorldDirection(V); const dot = d > 0.01 ? (V.x * dx + V.y * dy + V.z * dz) / d : 1, fall = 1 - Math.pow(d / R0, 1.4), k = fall * (dot > 0 ? 0.5 + 0.5 * dot : 0.3 + 0.2 * (1 + dot));
      const sec = k * it.flash.ms / 1000; if (sec > fxs.blind) { fxs.blind = sec; fxs.blindMax = Math.max(0.5, sec); }
    }
    if (!online) for (let i = 0; i < actors.length; i++) { const a = actors[i]; if (a === player || !a.alive || !a.ai || a.ai.zombie) continue; const ax = a.pos.x - x, az = a.pos.z - z, ad = Math.hypot(ax, az); if (ad > R0 || !grid.los(x, y + 0.2, z, a.pos.x, a.pos.y + 1.5, a.pos.z)) continue; const f = -Math.sin(a.yaw) * -ax / (ad || 1) + -Math.cos(a.yaw) * -az / (ad || 1), k = (1 - ad / R0) * (f > 0 ? 1 : 0.55); a.ai.react = Math.max(a.ai.react || 0, k * 2.8); a.ai.fireCd = Math.max(a.ai.fireCd || 0, k * 2.4); }
  }
  function stunAt(x, y, z, it) {
    const p = player.pos, d = Math.hypot(p.x - x, p.y - y, p.z - z), R0 = it.stun.r;
    if (player.alive && d < R0 && grid.los(x, y + 0.25, z, p.x, p.y + 1.4, p.z)) { const sec = (1 - d / R0 * 0.6) * it.stun.ms / 1000; if (sec > fxs.stun) { fxs.stun = sec; fxs.stunMax = sec; } if (!reduced()) P.shake = Math.max(P.shake, 0.5); }
    if (!online) for (let i = 0; i < actors.length; i++) { const a = actors[i]; if (a === player || !a.alive || !a.ai || a.ai.zombie) continue; const ad = Math.hypot(a.pos.x - x, a.pos.z - z); if (ad > R0 || !grid.los(x, y + 0.25, z, a.pos.x, a.pos.y + 1.4, a.pos.z)) continue; a.ai.react = Math.max(a.ai.react || 0, 1.3); a.gxSlow = simMs + it.stun.ms; }
  }
  const pop = (x, y, z, size) => { try { c.proj.explode(x, y, z, { radius: size, damage: 0, by: null, weaponId: null, self: 0, mul: 1, visual: true, pid: 0 }); } catch { /* optional */ } };
  function clayHits(o, it) {
    const fx0 = -Math.sin(o.yaw), fz0 = -Math.cos(o.yaw), R0 = it.radius;
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i]; if (!a.alive || a.ghost || (a !== player && !c.isEnemy(player, a)) || (a === player)) continue;
      const dx = a.pos.x - o.x, dz = a.pos.z - o.z, d = Math.hypot(dx, dz); if (d > R0 || Math.abs(a.pos.y - o.y) > 2.2) continue;
      if (d > 0.4 && (dx * fx0 + dz * fz0) / d < it.cone) continue;
      if (!grid.los(o.x, o.y + 0.35, o.z, a.pos.x, a.pos.y + 0.9, a.pos.z)) continue;
      c.blastHit(a, it.dmg * (1 - 0.7 * d / R0), 'claymore', dx / (d || 1), dz / (d || 1));
    }
  }
  function onDet(m) {
    let o = objs.get(m.oid); const it = ITEMS[m.id]; if (!it) return;
    if (!o) o = mk({ oid: m.oid, id: m.id, by: m.by, x: m.x, y: m.y, z: m.z, yaw: m.yaw, st: 'rest' }); if (!o) return;
    if (!o.att) { o.x = m.x; o.y = m.y; o.z = m.z; }
    if (it.dmg && it.radius) {
      const x = o.att ? o.x : m.x, y = o.att ? o.y : m.y, z = o.att ? o.z : m.z; rm(o);
      if (m.by === me) {
        if (m.id === 'claymore') { c.proj.explode(x, y + 0.3, z, { radius: it.radius * 0.72, damage: 0, by: player, weaponId: m.id, self: 0, mul: 1, pid: m.oid }); clayHits(o, it); }
        else c.proj.explode(x, y + (it.kind === 'place' ? 0.32 : 0), z, { radius: it.radius, damage: it.dmg, by: player, weaponId: m.id, self: it.self, mul: 1, pid: m.oid });       // a charge on the floor bursts upward: its cover test must not start in the ground
      }
      return;
    }
    if (it.flash) { pop(o.x, o.y + 0.1, o.z, 1.1); flashAt(o.x, o.y, o.z, it); o.st = 'spent'; }
    else if (it.stun) { pop(o.x, o.y + 0.1, o.z, 1.6); stunAt(o.x, o.y, o.z, it); o.st = 'spent'; }
    else if (it.cloud) { o.st = 'cloud'; o.age = 0; o.left = (m.left || it.cloud.ms) / 1000; o.slot = takeSlot(cloudUsed, o); play('throw', at(o.x, o.y, o.z)); }
    else if (it.fire) {
      o.st = 'fire'; o.age = 0; o.left = (m.left || it.fire.ms) / 1000; o.slot = takeSlot(fireUsed, o); pop(o.x, o.y + 0.1, o.z, 1.3);
      const pr = []; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, t = grid.ray(o.x, o.y + 0.3, o.z, Math.cos(a), 0, Math.sin(a), it.fire.r); pr.push(Math.round(Math.max(0.2, t >= it.fire.r ? it.fire.r : t - 0.1) * 100) / 100); }
      o.polar = pr; if (mine(o)) send({ a: 'fire', oid: o.oid, r: pr });
    } else if (it.decoy) { o.st = 'decoy'; o.age = 0; o.left = (m.left || it.decoy.ms) / 1000; }
  }
  function onMsg(m) {
    switch (m.op) {
      case 'inv': for (const k of ['L', 'T', 'M']) { slots[k].id = m.s[k].id; slots[k].n = m.s[k].n; } if (m.got) say('+' + m.k + ' ' + D.nameOf(m.got, lang()), 'good'); paintSlots(); break;
      case 'use': break;
      case 'cancel': { if (use) { const u = use; use = null; if (m.why === 'full') say(tx('full'), 'info'); else if (m.why === 'hit') say(tx('cancelled'), 'bad'); if (vm.gestureOn && u.gest) vm.cancelGrenade(); } break; }
      case 'done': { const s = slots[ITEMS[m.id].slot]; if (s.id === m.id) s.n = m.n; if (m.id === (use && use.id)) use = null; player.armor = m.armor; if (m.hot) { fxs.hot = m.hot / 1000; fxs.hotMax = fxs.hot; } if (m.boost) { fxs.boost = m.boost / 1000; fxs.after = m.after / 1000; } paintSlots(); break; }
      case 'hp': if (player.alive) { player.hp = m.hp; player.armor = m.armor; if (!m.on) fxs.hot = 0; } break;
      case 'thrown': case 'placed': { const q = byToken.get(m.c); if (q) { byToken.delete(m.c); objs.delete(q.oid); q.oid = m.oid; objs.set(m.oid, q); if (q.rest && !q.sent) { q.sent = true; send({ a: 'land', oid: q.oid, x: q.x, y: q.y, z: q.z }); } } const s = slots[ITEMS[m.id].slot]; if (s.id === m.id) s.n = m.n; paintSlots(); break; }
      case 'nope': { const q = byToken.get(m.c); if (q) { byToken.delete(m.c); rm(q); } const s = slots[ITEMS[m.id] ? ITEMS[m.id].slot : 'T']; if (s && s.id === m.id) { s.n++; if (online) send({ a: 'sync' }); } if (m.why === 'limit') say(tx('limit'), 'bad'); paintSlots(); break; }
      case 'fly': if (!objs.has(m.oid)) mk({ ...m, st: 'fly' }); break;
      case 'land': { const o = objs.get(m.oid); if (o) { o.x = m.x; o.y = m.y; o.z = m.z; o.vx = o.vy = o.vz = 0; o.rest = true; if (m.stuck) { const a = actorOf(m.stuck); if (a) { o.att = a; o.ax = o.x - a.pos.x; o.ay = o.y - a.pos.y; o.az = o.z - a.pos.z; } } } break; }
      case 'obj': if (!objs.has(m.o.oid)) mk(m.o); break;
      case 'objc': { const o = objs.get(m.oid); if (o) o.c = m.c; break; }
      case 'objhp': { const o = objs.get(m.oid); if (o) o.hpF = m.f; break; }
      case 'beep': { const o = objs.get(m.oid); if (o) { o.st = 'trig'; if (Math.hypot(o.x - camera.position.x, o.z - camera.position.z) < 18) play('reload', 'magTap', player.weaponId); } break; }
      case 'det': onDet(m); break;
      case 'polar': { const o = objs.get(m.oid); if (o) o.polar = m.r; break; }
      case 'del': { const o = objs.get(m.oid); if (o) rm(o); break; }
      case 'clear': for (const o of [...objs.values()]) rm(o); byToken.clear(); break;
      case 'sync': { for (const o of [...objs.values()]) if (o.oid > 0) rm(o); for (const v of m.objs || []) { if (!ITEMS[v.id]) continue; const q = mk(v); if (q && v.st === 'fire' && v.polar) q.polar = v.polar; } if (m.s) for (const k of ['L', 'T', 'M']) { slots[k].id = m.s[k].id; slots[k].n = m.s[k].n; } paintSlots(); break; }
      case 'ammo': { if (m.s) for (const k of ['L', 'T', 'M']) { slots[k].id = m.s[k].id; slots[k].n = m.s[k].n; } for (const w of P.ws) if (w.def.reserve !== undefined) w.res = w.def.reserve; c.invChanged(); say(tx('resupplied'), 'good'); play('reload', 'magIn', player.weaponId); paintSlots(); break; }
    }
  }

  /* ---------- using an item ---------- */
  const canAct = () => player.alive && !rules.frozen && !vm.grenadeBusy && !use;
  function startMed(sl, it) {
    const U = it.useMs / 1000; use = { id: sl.id, t: 0, U, gest: true };
    P.sprint = false; P.burstN = 0; P.next = Math.max(P.next, E().time + U + 0.3);
    const pr = prop(sl.id), plunger = pr.sub.plunger, cap = pr.sub.cap, flap = pr.sub.flap, base = plunger ? plunger.userData.py : 0, capY = cap ? cap.userData.py : 0;
    if (cap) { cap.visible = true; cap.position.y = capY; } if (plunger) plunger.position.y = base; if (flap) flap.rotation.x = 0;
    const ok = vm.playGesture({ keys: vm.gestureTrack((TRACK_OF[sl.id] || wrapTrack)(U)), ev: [[U * .18, 'grab'], [U * .67, 'in'], [U * .92, 'tap']], end: U + 0.3, prop: pr.g,
      onFrame(T) { pr.g.visible = T >= U * 0.18 && T < U + 0.2; if (plunger) plunger.position.y = base - 0.052 * sat((T - U * .7) / (U * .2)); if (cap) { const k = sat((T - U * .32) / (U * .12)); cap.position.y = capY - k * 0.1; cap.visible = k < 1; } if (flap) flap.rotation.x = sat((T - U * .3) / .25) * 1.05 * (1 - sat((T - U * .86) / .2)); },
      onEvent(n) { if (n === 'grab') stage('pouch'); else if (n === 'in') stage(sl.id === 'plate' ? 'magIn' : 'grenadeGrab'); else if (n === 'tap') stage(sl.id === 'plate' ? 'magTap' : 'spoon'); },
      onEnd(done) { if (!done && use && use.id === sl.id) { use = null; send({ a: 'cancel' }); } } });
    if (!ok) { use = null; return; }
    send({ a: 'use', id: sl.id });
  }
  function startThrow(sl, it) {
    P.sprint = false; P.burstN = 0; P.next = Math.max(P.next, E().time + 0.62);
    const pr = prop(sl.id), id = sl.id;
    vm.playGesture({ keys: null, ev: [[.16, 'grenadeGrab'], [.32, 'pinPull'], [.5, 'throw'], [.515, 'spoon']], end: .95, prop: pr.g,
      onFrame(T) { pr.g.visible = T >= .16 && T < .5; },
      onEvent(n) { if (n !== 'throw') stage(n); else { pr.g.visible = false; stage('throw'); release(id, it, pr.g); } } });
  }
  function release(id, it, g) {
    const s = slots[it.slot]; if (s.id !== id || s.n <= 0 || !player.alive || rules.frozen) return;
    s.n--; paintSlots();
    camera.updateMatrixWorld(); const e = camera.matrixWorld.elements, ox = e[12], oy = e[13], oz = e[14]; let dx = -e[8] + e[4] * 0.16, dy = -e[9] + e[5] * 0.16, dz = -e[10] + e[6] * 0.16; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    const vx = dx * it.speed + P.v.x * 0.6, vy = dy * it.speed + Math.max(0, player.body.vy) * 0.3, vz = dz * it.speed + P.v.z * 0.6, tk = ++tokenSeq;
    const q = mk({ oid: -tk, id, by: me, team: player.team, x: ox, y: oy, z: oz, vx, vy, vz, st: 'fly' }); byToken.set(tk, q);
    send({ a: 'throw', id, c: tk, x: ox, y: oy, z: oz, vx, vy, vz });
  }
  /** Where a placed item goes: a little ahead of the feet, on the floor, clear of walls. Null when there is no room. */
  function spot(halfW) {
    const p = player.pos, sn = -Math.sin(player.yaw), cs = -Math.cos(player.yaw), reach = Math.min(1.35, grid.ray(p.x, p.y + 0.4, p.z, sn, 0, cs, 1.75) - 0.32 - halfW * 0.25); if (reach < 0.25) return null;
    const x = p.x + sn * reach, z = p.z + cs * reach, y = grid.floorAt(x, p.y + 0.6, z, 0.05); if (!(y > p.y - 1.1 && y < p.y + 0.7)) return null;
    return { x, y: y + 0.01, z };
  }
  function startPlace(sl, it) {
    const q0 = spot(sl.id === 'wire' ? 1.1 : 0.25); if (!q0) { say(tx('place'), 'bad'); return; }
    P.sprint = false; P.burstN = 0; P.next = Math.max(P.next, E().time + 0.72);
    const pr = prop(sl.id), id = sl.id;
    vm.playGesture({ keys: vm.gestureTrack(placeTrack()), ev: [[.2, 'grab'], [.62, 'put']], end: .95, prop: pr.g,
      onFrame(T) { pr.g.visible = T >= .2 && T < .62; },
      onEvent(n) {
        if (n === 'grab') { stage('pouch'); return; }
        pr.g.visible = false; const s = slots[it.slot]; if (s.id !== id || s.n <= 0 || !player.alive) return;
        const w = spot(id === 'wire' ? 1.1 : 0.25); if (!w) { say(tx('place'), 'bad'); return; }
        s.n--; paintSlots(); stage('magIn'); const tk = ++tokenSeq, yaw = player.yaw;
        const o = mk({ oid: -tk, id, by: me, team: player.team, x: w.x, y: w.y, z: w.z, yaw, st: 'placed', arm: it.armMs || 0 }); byToken.set(tk, o);
        if (it.ms) o.left = it.ms / 1000;
        if (it.charges) o.c = it.charges;
        send({ a: 'place', id, c: tk, x: w.x, y: w.y, z: w.z, yaw });
      } });
  }
  function clacker() {
    const pr = prop('c4remote'), lv = pr.sub.lever;
    vm.playGesture({ keys: vm.gestureTrack(clackTrack()), ev: [[.24, 'click']], end: .62, prop: pr.g,
      onFrame(T) { pr.g.visible = T >= .06 && T < .56; if (lv) lv.rotation.z = -0.16 * sat((T - .18) / .06) * (1 - sat((T - .36) / .1)); },
      onEvent() { stage('magTap'); send({ a: 'remote' }); } });
  }
  function press(s) {
    if (!enabled) return false;
    const sl = slots[s], it = ITEMS[sl.id]; if (!it) return false;
    if (it.kind === 'weapon') return false;       // the frag keeps its existing path
    if (it.remote) { for (const o of objs.values()) if (o.id === sl.id && mine(o) && o.st === 'placed') { if (canAct()) clacker(); return true; } }       // a charge is down: the key is its detonator
    if (s === 'L' && sl.n <= 0 && P.gear && P.gear.n > 0) return false;       // a frag picked up with another lethal item spent
    if (!canAct()) return true;
    if (sl.n <= 0) { if (E().time - P.dryT > 0.45) { P.dryT = E().time; play('dry'); say(tx('none'), 'bad'); } return true; }
    if (it.kind === 'med') startMed(sl, it); else if (it.kind === 'throw') startThrow(sl, it); else if (it.wall) { if (c.wallPlace) { try { c.wallPlace(sl.id, it); } catch (e) { console.warn('[gear] wall', e); } } } else startPlace(sl, it);       // a breaching charge goes on a panel (engine-breach.js)
    return true;
  }
  /** Weapon change, interact, fire: a medical gesture in progress stops, nothing is spent. */
  function cancelUse() { if (use && use.gest) { vm.cancelGrenade(); return true; } return false; }

  /* ---------- per frame ---------- */
  function drawObjects(dt) {
    for (const im of inst.values()) { im.count = 0; }
    let nl = 0; const t = simMs / 1000;
    for (const o of objs.values()) {
      if (o.st === 'cloud' || o.st === 'fire' || o.st === 'spent') continue;
      const im = inst.get(o.id); if (!im || im.count >= MAXI) continue;
      const it = ITEMS[o.id];
      if (!o.rest && it.kind === 'throw') { o.rot += dt * 9; EU.set(o.rot, o.spin, o.rot * 0.6); } else if (it.kind === 'throw' && o.id !== 'decoy') { EU.set(1.5, o.spin, 0); } else EU.set(0, o.yaw, 0);
      Q.setFromEuler(EU); V.set(o.x, o.y + (it.kind === 'throw' && o.rest && o.id !== 'decoy' ? 0.04 : 0), o.z); M4.compose(V, Q, S); im.setMatrixAt(im.count++, M4);
      const piv = parts.get(o.id);
      if (piv && nl < 24 && (o.st === 'placed' || o.st === 'trig') && !(o.id === 'wire')) {
        const armed = o.arm <= 0, own = !hostileTo(o), blink = o.st === 'trig' ? Math.sin(t * 40) > 0 : armed ? Math.sin(t * 5 + o.oid) > 0.2 : Math.sin(t * 16) > 0;
        V2.set(piv[0], piv[1], piv[2]).applyQuaternion(Q); V.set(o.x + V2.x, o.y + V2.y, o.z + V2.z); S.setScalar(blink ? 1 : 0.35); M4.compose(V, Q, S); S.setScalar(1); leds.setMatrixAt(nl, M4);
        leds.setColorAt(nl, COL.setHex(o.st === 'trig' ? 0xff2010 : own ? (armed ? 0x38d0ff : 0xffc040) : armed ? 0xff3010 : 0xffc040)); nl++;
      }
    }
    for (const im of inst.values()) { const on = im.count > 0; if (im.visible !== on) im.visible = on; if (on) im.instanceMatrix.needsUpdate = true; }
    leds.count = nl; if (leds.visible !== (nl > 0)) leds.visible = nl > 0; if (nl) { leds.instanceMatrix.needsUpdate = true; if (leds.instanceColor) leds.instanceColor.needsUpdate = true; }
  }
  function drawClouds(dt) {
    let anyS = false, anyF = false, inside = 0; const t = simMs / 1000, cp = camera.position;
    smokeMat.uniforms.uH.value = c.viewH();
    for (let s = 0; s < CLOUDS; s++) {
      const o = cloudUsed[s], base = s * PER_CLOUD;
      if (!o) { if (sm.d[base * 2 + 1] !== 0) for (let j = 0; j < PER_CLOUD; j++) sm.d[(base + j) * 2 + 1] = 0; continue; }
      anyS = true; const it = ITEMS[o.id].cloud, g = sat(o.age * 1000 / it.grow), ge = 1 - (1 - g) * (1 - g), fade = sat(o.left / 2.6), Rn = it.r * (0.45 + 0.55 * ge);
      for (let j = 0; j < PER_CLOUD; j++) {
        const i = base + j, q = i * 4, h = seedS[q + 1], wob = Math.sin(t * 0.35 + seedS[q + 3]) * 0.22;
        sm.pos[i * 3] = o.x + (seedS[q] * 0.82 + wob * 0.3) * Rn; sm.pos[i * 3 + 1] = o.y + 0.25 + h * h * Rn * 0.95 + wob * 0.2 + o.age * 0.012; sm.pos[i * 3 + 2] = o.z + (seedS[q + 2] * 0.82 - wob * 0.3) * Rn;
        const dc = Math.hypot(sm.pos[i * 3] - cp.x, sm.pos[i * 3 + 1] - cp.y, sm.pos[i * 3 + 2] - cp.z), near = sat((dc - 0.6) / 1.6);
        sm.d[i * 2] = Rn * (0.9 + 0.5 * (1 - h)); sm.d[i * 2 + 1] = 0.5 * g * fade * near + 0.0001;
      }
      const dc = Math.hypot(o.x - cp.x, (o.y + 1.2 - cp.y) * 0.8, o.z - cp.z); inside = Math.max(inside, sat((Rn * 0.95 - dc) / (Rn * 0.45)) * g * fade);
    }
    for (let s = 0; s < FIRES; s++) {
      const o = fireUsed[s], base = s * PER_FIRE;
      if (!o) { if (fi.d[base * 2 + 1] !== 0) for (let j = 0; j < PER_FIRE; j++) fi.d[(base + j) * 2 + 1] = 0; continue; }
      anyF = true; const it = ITEMS[o.id].fire, fade = sat(o.left / 0.9) * sat(o.age / 0.25);
      for (let j = 0; j < PER_FIRE; j++) {
        const i = base + j, q = i * 4, a = Math.atan2(seedF[q + 2], seedF[q]), rr = Math.hypot(seedF[q], seedF[q + 2]); let lim = it.r;
        if (o.polar) { const u = (a + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 4), k = Math.floor(u) % 8, f = u - Math.floor(u); lim = o.polar[k] * (1 - f) + o.polar[(k + 1) % 8] * f; }
        const ph = (t * (1.1 + seedF[q + 1] * 0.8) + seedF[q + 3]) % 1;
        fi.pos[i * 3] = o.x + Math.cos(a) * rr * lim * 0.92; fi.pos[i * 3 + 1] = o.y + 0.08 + ph * (0.55 + seedF[q + 1] * 0.6); fi.pos[i * 3 + 2] = o.z + Math.sin(a) * rr * lim * 0.92;
        fi.d[i * 2] = (0.42 + seedF[q + 1] * 0.5) * (1 - ph * 0.55); fi.d[i * 2 + 1] = 0.62 * fade * (1 - ph) * sat(ph * 6) + 0.0001;
      }
    }
    if (sm.o.visible !== anyS) sm.o.visible = anyS; if (fi.o.visible !== anyF) fi.o.visible = anyF;
    if (anyS) { sm.g.attributes.position.needsUpdate = true; sm.g.attributes.aD.needsUpdate = true; }
    if (anyF) { fi.g.attributes.position.needsUpdate = true; fi.g.attributes.aD.needsUpdate = true; }
    if (dom) setO(dom.smoke, 's', inside * 0.93);
  }
  /** Whether the segment a-b crosses an active smoke cloud (allocation-free; used for bots' sight). */
  function smokeBlocks(ax, ay, az, bx, by, bz) {
    for (let s = 0; s < CLOUDS; s++) {
      const o = cloudUsed[s]; if (!o || o.left < 0.8) continue;
      const it = ITEMS[o.id].cloud, g = sat(o.age * 1000 / it.grow); if (g < 0.5) continue;
      const r = it.r * (0.45 + 0.55 * g) * 0.82, cx = o.x, cy = o.y + 1.1, cz = o.z, dx = bx - ax, dy = by - ay, dz = bz - az, fx = ax - cx, fy = ay - cy, fz = az - cz, A = dx * dx + dy * dy + dz * dz; if (A < 1e-4) continue;
      let u = -(fx * dx + fy * dy + fz * dz) / A; u = u < 0 ? 0 : u > 1 ? 1 : u;
      const px = fx + dx * u, py = (fy + dy * u) * 1.25, pz = fz + dz * u; if (px * px + py * py + pz * pz < r * r) return true;
    }
    return false;
  }
  function updateObjs(dt) {
    let trig = false; scanT -= dt; if (scanT <= 0) { scanT = 0.1; trig = true; }
    for (const o of [...objs.values()]) {
      if (o.arm > 0) o.arm -= dt * 1000;
      if (o.left > 0) o.left -= dt;
      o.age += dt;
      if (o.st === 'fly' && !o.rest) { let left = dt; for (let k = 0; k < 6 && left > 1e-4 && !o.rest; k++) { const h = Math.min(left, 1 / 90); flyStep(o, h); left -= h; } const it = ITEMS[o.id]; if (mine(o) && !o.rest && it.fuseMs && o.age * 1000 > it.fuseMs - 180 && o.oid > 0 && !o.sent) { o.sent = true; send({ a: 'land', oid: o.oid, x: o.x, y: o.y, z: o.z }); } }
      if (o.att) { if (o.att.alive || !o.att.isPlayer) { o.x = o.att.pos.x + o.ax; o.y = o.att.pos.y + o.ay; o.z = o.att.pos.z + o.az; } }
      if (o.st === 'decoy') {
        o.sndT -= dt;
        if (o.sndT <= 0) {
          const near = Math.hypot(o.x - camera.position.x, o.z - camera.position.z);
          if (near < 70) { if (Math.random() < 0.55) { snd.own = false; snd.occluded = !grid.los(camera.position.x, camera.position.y, camera.position.z, o.x, o.y + 0.4, o.z); snd.loud = 0.8; play('shot', 'ar', at(o.x, o.y + 0.4, o.z)); o.sndT = rnd(0.11, 0.2); if (Math.random() < 0.25) o.sndT = rnd(0.9, 2.3); } else { snd.run = true; play('step', 'concrete', at(o.x, o.y, o.z)); o.sndT = rnd(0.28, 0.42); } } else o.sndT = 0.5;
        }
        const show = hostileTo(o); if (show !== o.mark) { o.mark = show; try { hud.api.marker('gx' + o.oid, show ? { x: o.x, y: o.y + 0.3, z: o.z, label: '', color: '#e0492f', small: true } : null); } catch { /* optional */ } }
      }
      if (!trig || o.oid <= 0) continue;
      const it = ITEMS[o.id];
      if (mine(o) && it.trigR && o.st === 'placed' && o.arm <= 0) {
        const fx0 = -Math.sin(o.yaw), fz0 = -Math.cos(o.yaw);
        for (let i = 0; i < actors.length; i++) {
          const a = actors[i]; if (a === player || !a.alive || a.ghost || !c.isEnemy(player, a) || Math.abs(a.pos.y - o.y) > 1.6) continue;
          const dx = a.pos.x - o.x, dz = a.pos.z - o.z, d = Math.hypot(dx, dz); if (d > it.trigR) continue;
          if (it.cone && d > 0.4 && (dx * fx0 + dz * fz0) / d < it.cone) continue;
          if (!grid.los(o.x, o.y + 0.25, o.z, a.pos.x, a.pos.y + 0.8, a.pos.z)) continue;
          send({ a: 'trig', oid: o.oid }); o.st = 'trig'; break;
        }
      }
      if (o.id === 'sensor' && o.st === 'placed' && o.arm <= 0 && !hostileTo(o)) for (let i = 0; i < actors.length; i++) { const a = actors[i]; if (a === player || !a.alive || a.ghost || !c.isEnemy(player, a)) continue; if (Math.hypot(a.pos.x - o.x, a.pos.z - o.z) <= it.scanR) a.shotT = Math.max(a.shotT, 0.35); }
      if (o.id === 'ammobox' && o.st === 'placed' && o.arm <= 0 && simMs >= o.nextAsk && player.alive && !hostileTo(o) && Math.hypot(player.pos.x - o.x, player.pos.z - o.z) <= it.useR && needsAmmo()) { o.nextAsk = simMs + 2500; send({ a: 'ammo', oid: o.oid }); }
    }
  }
  function needsAmmo() { for (const w of P.ws) if (w.def.reserve !== undefined && w.res < w.def.reserve) return true; for (const k of ['L', 'T']) { const it = ITEMS[slots[k].id]; if (it.kind !== 'weapon' && slots[k].id !== 'ammobox' && slots[k].n < it.carry) return true; } return false; }
  function wireSlow() {
    const p = player.pos; let k = 1;
    for (const o of objs.values()) { if (o.id !== 'wire' || o.st !== 'placed' || o.arm > 0 || Math.abs(p.y - o.y) > 1.2 || !hostileTo(o)) continue; const it = ITEMS.wire, cs = Math.cos(o.yaw), sn = Math.sin(o.yaw), dx = p.x - o.x, dz = p.z - o.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; if (Math.abs(lx) <= it.halfW && Math.abs(lz) <= it.halfD) k = it.slow; }
    return k;
  }
  let warnOn = false, warnAcc = 0;
  function warnMines(dt) {
    warnAcc -= dt; if (warnAcc > 0 || !dom) return; warnAcc = 0.15;
    let near = false; const p = player.pos;
    if (player.alive) for (const o of objs.values()) { const it = ITEMS[o.id]; if (!it.trigR || o.st !== 'placed' || o.arm > 0 || !hostileTo(o)) continue; if (Math.hypot(o.x - p.x, o.z - p.z) < it.trigR + 3.5 && Math.abs(o.y - p.y) < 2 && grid.los(camera.position.x, camera.position.y, camera.position.z, o.x, o.y + 0.15, o.z)) near = true; }
    if (near !== warnOn) { warnOn = near; dom.warn.textContent = near ? '⚠ ' + tx('mine') : ''; setO(dom.warn, 'w', near ? 1 : 0); }
  }
  function updateFx(dt) {
    fxs.blind = Math.max(0, fxs.blind - dt); fxs.stun = Math.max(0, fxs.stun - dt); fxs.hot = Math.max(0, fxs.hot - dt);
    if (fxs.boost > 0) fxs.boost = Math.max(0, fxs.boost - dt); else if (fxs.after > 0) fxs.after = Math.max(0, fxs.after - dt);
    const adren = ITEMS.adren, stunIt = ITEMS.stun.stun; let sp = 1;
    if (fxs.boost > 0) sp *= adren.boost; else if (fxs.after > 0) sp *= adren.after;
    if (fxs.stun > 0) sp *= stunIt.slow;
    sp *= wireSlow(); P.gxSpeed = sp;
    if (dom) {
      const peak = reduced() ? 0.78 : 1, k = fxs.blind / Math.max(0.01, fxs.blindMax), b = fxs.blind <= 0 ? 0 : Math.min(1, fxs.blind / 0.9) * peak * (k > 0.8 ? 1 : 0.55 + 0.45 * k / 0.8);
      setO(dom.blind, 'b', b); setO(dom.stun, 't', fxs.stun > 0 ? Math.min(1, fxs.stun / 0.8) : 0);
      if (use) { use.t += dt; setO(dom.use, 'u', 1); const f = sat(use.t / use.U); if (dom.vals.un !== use.id) { dom.vals.un = use.id; dom.useT.textContent = D.nameOf(use.id, lang()); } dom.useB.style.transform = 'scaleX(' + f.toFixed(3) + ')'; } else setO(dom.use, 'u', 0);
      if (fxs.hot > 0) { setO(dom.hot, 'h', 1); dom.hotB.style.transform = 'scaleX(' + (fxs.hot / fxs.hotMax).toFixed(3) + ')'; } else setO(dom.hot, 'h', 0);
    }
    if (fxs.stun > 0 && !reduced() && Math.random() < dt * 5) P.shake = Math.max(P.shake, 0.18);
  }
  /* ---------- bots (solo only): heal when hurt, flash or smoke at a target, step away from mines (see threat) ---------- */
  function botTick(a, dt) {
    if (online || !enabled || !a.alive || !a.ai || a.ai.zombie) return;
    const ai = a.ai;
    if (a.gxSlow && simMs > a.gxSlow) a.gxSlow = 0;
    if (a.gxHeal > 0) { const h = Math.min(a.gxHeal, 11 * dt); a.gxHeal -= h; a.hp = Math.min(a.maxHp, a.hp + h); }
    ai.gxT = (ai.gxT === undefined ? rnd(6, 16) : ai.gxT) - dt; if (ai.gxT > 0) return;
    ai.gxT = rnd(1, 2.4);
    if (a.hp < a.maxHp * 0.5 && !ai.visible && !(a.gxHeal > 0) && simMs > (a.gxMedT || 0)) { a.gxHeal = 32; a.gxMedT = simMs + 22000; return; }
    if (!ai.visible || !ai.target || !ai.target.alive || ai.react > 0 || simMs < (a.gxTac || 0)) return;
    const t = ai.target, hx = t.pos.x - a.pos.x, hz = t.pos.z - a.pos.z, hd = Math.hypot(hx, hz); if (hd < 7 || hd > 19) return;
    if (Math.random() > (ai.difficulty === 'easy' ? 0.1 : 0.28)) return;
    const id = Math.random() < 0.6 ? 'flash' : 'smoke', it = ITEMS[id], r = recOf(a);
    if (!r.gx || r.gx.life !== r.life) { r.gx = null; core.msg(r, { a: 'load', s: { L: 'frag', T: id, M: 'bandage' } }); }
    r.gx.s.T.id = id; r.gx.s.T.n = 1; r.x = a.pos.x; r.y = a.pos.y; r.z = a.pos.z;
    const s = it.speed, g = it.gravity, tof = Math.max(0.35, hd / (s * 0.9)), vh = hd / tof, vy = Math.min(s * 0.7, 0.5 * g * tof + (t.pos.y - a.pos.y - 0.4) / tof);
    a.gxTac = simMs + rnd(20000, 34000);
    core.msg(r, { a: 'throw', id, c: 0, x: a.pos.x, y: a.pos.y + 1.5, z: a.pos.z, vx: hx / hd * vh, vy, vz: hz / hd * vh });
    play('throw', at(a.pos.x, a.pos.y + 1.4, a.pos.z));
    if (c.onAct) { try { c.onAct(a); } catch { /* optional */ } }       // ends the bot's spawn protection
  }
  const threatOut = { x: 0, y: 0, z: 0, radius: 2.5 };
  function threat(a) {
    if (!enabled) return null; let best = null, bd = 1e9;
    for (const o of objs.values()) {
      const it = ITEMS[o.id]; let R0 = 0;
      if (it.trigR && o.st === 'placed' && o.arm <= 0) R0 = it.trigR + 0.7; else if (o.st === 'fire') R0 = it.fire.r + 0.4; else continue;
      const owner = actorOf(o.by); if (owner && owner !== a && !c.isEnemy(owner, a)) continue; if (owner === a) continue;
      const d = (a.pos.x - o.x) ** 2 + (a.pos.z - o.z) ** 2; if (d < R0 * R0 && d < bd && Math.abs(a.pos.y - o.y) < 2 && grid.los(a.pos.x, a.pos.y + 1.4, a.pos.z, o.x, o.y + 0.2, o.z)) { bd = d; best = o; }
    }
    if (!best) return null; threatOut.x = best.x; threatOut.y = best.y; threatOut.z = best.z; return threatOut;
  }
  /* bullets hit equipment on the ground (mines can be shot from a distance: the counter-play) */
  const rayHitObj = (e) => {
    if (e.actor !== player || hitAcc > 0) return; const def = player.wdef; if (!def || def.kind === 'melee') return;
    camera.getWorldDirection(V); const cp = camera.position, far = grid.ray(cp.x, cp.y, cp.z, V.x, V.y, V.z, 90); let best = null, bt = far;
    for (const o of objs.values()) { const it = ITEMS[o.id]; if (!it.hp || (o.st !== 'placed' && o.st !== 'trig')) continue; if (mine(o) && o.st === 'placed') continue; const ox = o.x - cp.x, oy = o.y + 0.12 - cp.y, oz = o.z - cp.z, along = ox * V.x + oy * V.y + oz * V.z; if (along < 0 || along > bt) continue; const qx = ox - V.x * along, qy = oy - V.y * along, qz = oz - V.z * along; if (qx * qx + qy * qy + qz * qz < 0.11) { bt = along; best = o; } }
    if (best && best.oid > 0) { hitAcc = 0.12; send({ a: 'hitobj', oid: best.oid, d: Math.min(200, def.dmg * Math.max(1, def.pellets || 1)) }); }
  };

  return {
    get slots() { return slots; }, get objs() { return objs; }, get fx() { return fxs; }, get use() { return use; }, get enabled() { return enabled; }, core: () => core, pl,
    /** Builds what this match can show, one model per slice, so the first use compiles and allocates nothing. */
    async prepare(brk) {
      buildDom();
      for (const id of Object.keys(ITEMS)) { if (!ITEMS[id].live) continue; try { if (ITEMS[id].kind !== 'weapon') { worldMesh(id); if (c.addLootModel) c.addLootModel(id, gearModel(THREE, id).geo); prop(id); } } catch (e) { console.warn('[gear] model', id, e); } await brk(); }
      try { prop('c4remote'); } catch (e) { console.warn('[gear] model', e); }
      // every instanced mesh, the LEDs and the two point clouds go through the shader warm-up
      for (const im of inst.values()) { im.count = 1; im.setMatrixAt(0, M4.makeScale(0, 0, 0)); im.visible = true; } leds.count = 1; leds.setMatrixAt(0, M4); leds.visible = true; sm.o.visible = fi.o.visible = true;
    },
    begin(isOnline, theNet, myId) {
      for (const im of inst.values()) { im.count = 0; im.visible = false; } leds.count = 0; leds.visible = false; sm.o.visible = fi.o.visible = false;
      online = !!isOnline; net = theNet || null; me = myId || 'player'; enabled = !online || !!(net && net.gxOk); simMs = 0; use = null; fxs.blind = fxs.stun = fxs.boost = fxs.after = fxs.hot = 0; P.gxSpeed = 1; objs.clear(); byToken.clear(); cloudUsed.fill(null); fireUsed.fill(null); recs.clear(); warnOn = false;
      core = online || !enabled ? null : localCore(); pl.id = me; pl.life = 0; pl.gx = null;
      if (dom) { dom.root.style.display = enabled ? '' : 'none'; for (const k of Object.keys(dom.vals)) delete dom.vals[k]; dom.blind.style.opacity = dom.smoke.style.opacity = dom.stun.style.opacity = dom.use.style.opacity = dom.hot.style.opacity = dom.warn.style.opacity = '0'; }
      const pick = D.cleanLoadout(profile.data.gx); for (const k of ['L', 'T', 'M']) { slots[k].id = pick[k]; slots[k].n = ITEMS[pick[k]].kind === 'weapon' ? 0 : ITEMS[pick[k]].carry; }
      if (online && enabled) send({ a: 'sync' });
    },
    end() { enabled = false; use = null; objs.clear(); byToken.clear(); cloudUsed.fill(null); fireUsed.fill(null); P.gxSpeed = 1; core = null; for (const im of inst.values()) { im.count = 0; im.visible = false; } leds.count = 0; leds.visible = false; sm.o.visible = fi.o.visible = false; if (dom) dom.root.style.display = 'none'; },
    /** A new life of the local player: announce the loadout (rules.playerLoadout false = no equipment in this mode's start). */
    onSpawn() {
      if (!enabled) return;
      const pick = D.cleanLoadout(profile.data.gx); for (const k of ['L', 'T', 'M']) { slots[k].id = pick[k]; slots[k].n = ITEMS[pick[k]].kind === 'weapon' ? 0 : ITEMS[pick[k]].carry; }
      use = null; fxs.blind = fxs.stun = fxs.boost = fxs.after = fxs.hot = 0;
      if (online) send({ a: 'load', s: pick }); else { pl.life++; pl.status = 'alive'; pl.gx = null; pl.maxHp = player.maxHp; pl.maxArmor = player.maxArmor; core.msg(pl, { a: 'load', s: pick }); }
      paintSlots();
    },
    /** Solo: what the dead player leaves on the ground. Online the server does it. */
    deathItems() { if (online || !core) return null; pl.status = 'dead'; return core.onDeath(pl); },
    onDeath(a) { if (a !== player || !enabled) return; if (use) { use = null; } fxs.hot = 0; fxs.boost = fxs.after = 0; P.gxSpeed = 1; },
    onDamage(a) { if (!online && core && a === player) core.onDamage(pl); },
    onShot(e) { try { rayHitObj(e); } catch { /* never breaks a shot */ } },
    gainItem(id, n) { if (!enabled || online) return 0; return core ? core.take(pl, id, n) : 0; },
    wantsItem(id) { if (!enabled) return false; if (!online) return !!core && core.wants(pl, id); const it = ITEMS[id]; if (!it) return false; const s = slots[it.slot]; return s.id === id ? s.n < it.carry : s.n <= 0; },
    update(dt) {
      if (!enabled) return;
      simMs += dt * 1000; hitAcc = Math.max(0, hitAcc - dt);
      if (!online && core) { syncPl(); core.tick(simMs, dt * 1000); if (player.alive && pl.hp > player.hp) player.hp = pl.hp; }       // solo: the heal of this tick lands at once
      if (use) P.next = Math.max(P.next, E().time + 0.05);
      updateObjs(dt); updateFx(dt); warnMines(dt); drawObjects(dt); drawClouds(dt);
      botT -= dt; if (botT <= 0) { botT = 0.2; paintSlots(); }
    },
    onNet(m) { if (enabled) { try { onMsg(m); } catch (e) { console.warn('[gear] net', e); } } },
    clearRound() { if (!online && core) core.clear(); },
    press, cancelUse, smokeBlocks, threat, botTick,
    /** A charge set by engine-breach.js at a spot it chose (on a panel): spends one, shows it at once, asks the referee. */
    placeAt(id, x, y, z, yaw, extra) {
      const it = ITEMS[id], s = it && slots[it.slot]; if (!enabled || !s || s.id !== id || s.n <= 0 || !player.alive) return false;
      s.n--; paintSlots(); stage('magIn'); const tk = ++tokenSeq;
      const o = mk({ oid: -tk, id, by: me, team: player.team, x, y, z, yaw, st: it.wall ? 'trig' : 'placed', arm: it.armMs || 0 }); byToken.set(tk, o);
      send({ a: 'place', id, c: tk, x, y, z, yaw, ...(extra || null) });
      return true;
    },
    handProp(id) { return prop(id); },
    canAct() { return enabled && canAct(); },
  };
}
