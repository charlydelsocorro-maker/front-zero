// FRONT ZÉRO — spawn protection in a match (rules: spawn-guard.js, shared with the server).
// Solo: this is the referee (game.js asks blocks() before any damage or blast push). Online: the server referees and sends
// {t:'sg', id, ms}; this mirrors it for the picture, the HUD and the hit markers. On an older server (no 'sg' in its welcome)
// each client times the protection itself and does not report hits on a protected player (best effort, client-only).
// Picture: a thin glowing shell over the protected soldier (one shared skinned program, compiled behind the loading screen),
// no light, nothing allocated per frame. HUD: a small countdown for the protected player. A failure here never breaks a match.
import * as THREE from 'three';
import './spawn-guard.js';
import { createSoldier } from './soldier.js';

const G = globalThis.FZSpawnGuard;
const COLOR = 0x62bfff, PUSH = 0.022, KEY = 'fz-spawn-guard-v1', FADE_IN = 0.14, FADE_OUT = 0.22, BLINK = 0.6;
const CSS = `
#sg-hud{position:absolute;left:50%;top:57%;transform:translate(-50%,6px);display:flex;flex-direction:column;align-items:center;gap:5px;pointer-events:none;opacity:0;transition:opacity .16s ease-out,transform .16s ease-out;z-index:3}
#sg-hud.on{opacity:1;transform:translate(-50%,0)}
#sg-hud .r{display:flex;align-items:center;gap:7px;padding:4px 12px 4px 7px;border-radius:999px;background:linear-gradient(180deg,rgba(30,58,74,.66),rgba(10,24,32,.66));border:1px solid rgba(150,216,255,.38);box-shadow:0 0 16px rgba(110,200,255,.2),inset 0 1px 0 rgba(255,255,255,.1)}
#sg-hud svg{width:15px;height:18px;display:block;filter:drop-shadow(0 0 3px rgba(120,205,255,.55))}
#sg-hud b{font:700 12px/16px system-ui,sans-serif;letter-spacing:.1em;color:#dff3ff;text-shadow:0 1px 2px #000}
#sg-hud em{font:700 12px/16px system-ui,sans-serif;font-style:normal;font-variant-numeric:tabular-nums;color:#9fdcff;min-width:3.1em;text-align:right;text-shadow:0 1px 2px #000}
#sg-hud i{display:block;width:150px;height:3px;border-radius:2px;background:rgba(255,255,255,.13);overflow:hidden}
#sg-hud i u{display:block;height:100%;width:100%;background:linear-gradient(90deg,#5fc2ff,#c4ecff);transform-origin:left center}
#sg-hud small{font:500 11px/14px system-ui,sans-serif;color:rgba(228,242,252,.8);text-shadow:0 1px 2px #000;white-space:nowrap}`;
const SHIELD = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M12 1.6 21.6 5.3v7.5c0 6.3-4 11-9.6 13.6C6.4 23.8 2.4 19.1 2.4 12.8V5.3z" fill="rgba(143,216,255,.22)" stroke="#a9e1ff" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 5.8v16.4M7.2 11.6h9.6" stroke="#d6f1ff" stroke-width="1.3" stroke-linecap="round" opacity=".65"/></svg>';

export function createGuard(c) {
  const { E, scene, hudRoot, t, i18n } = c, player = E.player, actors = E.actors;
  const T = { value: 0 };                       // shared clock of every shell material
  const pool = [], live = new Map(), died = new Set(), geos = new WeakMap();
  let online = false, net = null, refs = false, netOff = null, warm = null, dom = null, hudOn = false, hudTxt = '', hudFrac = -1, lang = '', label = '', hint = '';
  const now = () => E.time * 1000;
  const tr = (key, fb) => { try { const s = t(key); return typeof s === 'string' && s && s !== key ? s : fb; } catch { return fb; } };      // texts live in i18n.js
  const blocks = a => !!a && a.sgUntil > 0 && a.sgUntil > E.time * 1000;
  const actorById = id => { if (!id) return null; if (id === player.id) return player; for (let i = 0; i < actors.length; i++) if (actors[i].id === id) return actors[i]; return null; };

  /* ---------- the shell: the soldier's own skinned geometry, pushed out along the normals, additive fresnel and a rising band ---------- */
  function material() {
    const m = new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
    const K = { value: 0 };
    m.onBeforeCompile = sh => {
      sh.uniforms.uSgT = T; sh.uniforms.uSgK = K;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSgN;\nvarying vec3 vSgV;\nvarying float vSgY;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normal * ${PUSH.toFixed(3)};\nvSgY = position.y;`)
        .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_SKINNING\nvSgN = normalize( transformedNormal );\n#else\nvSgN = normalize( normalMatrix * normal );\n#endif\nvSgV = - mvPosition.xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSgT;\nuniform float uSgK;\nvarying vec3 vSgN;\nvarying vec3 vSgV;\nvarying float vSgY;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `float sgF = 1.0 - abs( dot( normalize( vSgN ), normalize( vSgV ) ) );
	float sgB = 1.0 - smoothstep( 0.0, 0.085, abs( fract( vSgY * 0.72 - uSgT * 0.62 ) - 0.5 ) );
	float sgR = sgF * sgF; sgR *= sgR;
	float sgA = uSgK * ( 0.025 + 0.62 * sgR + 0.2 * sgB * ( 0.25 + 0.75 * sgF ) );
	vec4 diffuseColor = vec4( diffuse, opacity * sgA );`);
    };
    m.customProgramCacheKey = () => KEY;
    m.userData.k = K;
    return m;
  }
  /** Only what the shell needs, sharing the soldier's buffers (no upload): its program does not depend on which body it covers. */
  function viewGeo(src) {
    let g = geos.get(src); if (g !== undefined) return g;
    const at = src && src.attributes;
    if (!at || !at.position || !at.normal || !at.skinIndex || !at.skinWeight) { geos.set(src, null); return null; }
    g = new THREE.BufferGeometry();
    g.setAttribute('position', at.position); g.setAttribute('normal', at.normal); g.setAttribute('skinIndex', at.skinIndex); g.setAttribute('skinWeight', at.skinWeight);
    if (src.index) g.setIndex(src.index);
    g.setDrawRange(src.drawRange.start, src.drawRange.count); g.boundingSphere = src.boundingSphere; g.boundingBox = src.boundingBox;
    geos.set(src, g); return g;
  }
  /** What the shell covers: a premium outfit when the soldier wears one (its own mesh and skeleton), the standard body otherwise. */
  function bodyOf(sol) {
    const ch = sol.root.children;
    for (let i = 0; i < ch.length; i++) { const o = ch[i]; if (o.isSkinnedMesh && o.name === 'outfit') return o; }
    return sol.mesh;
  }
  function take() { const e = pool.pop(); if (e) return e; const mat = material(), mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), mat); mesh.name = 'spawnGuard'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 3; return { mesh, k: mat.userData.k, sol: null, fade: 0, seed: Math.random() * 6.28 }; }
  function fit(e, sol) {
    const src = bodyOf(sol), g = viewGeo(src.geometry);
    if (!g) return false;
    if (e.mesh.geometry !== g) e.mesh.geometry = g;
    if (e.mesh.skeleton !== src.skeleton) e.mesh.bind(src.skeleton, src.bindMatrix);
    if (e.sol !== sol || e.mesh.parent !== sol.root) { e.mesh.removeFromParent(); sol.root.add(e.mesh); e.sol = sol; }
    return true;
  }
  function release(a) { const e = live.get(a); if (!e) return; live.delete(a); e.mesh.removeFromParent(); e.sol = null; e.k.value = 0; pool.push(e); }
  function show(a) { if (!a || a.isPlayer || a.kind !== 'soldier' || live.has(a)) return; const e = take(); e.fade = 0; e.k.value = 0; live.set(a, e); }

  /* ---------- state ---------- */
  function start(a, ms) {
    if (!a || a.kind !== 'soldier' || !(ms > 0)) return;
    G.set(a, ms, now()); a.sgTotal = ms;
    show(a);
  }
  function stop(a) { if (a) G.clear(a); }      // the shell fades out on its own
  /** An action of `a` that ends the protection (shot, throw, gear...). Online the server decides; ending at once here keeps the picture honest. */
  function act(a, why) { if (blocks(a)) G.end(a, why || 'fire', now()); }
  function reset() {
    for (const a of [...live.keys()]) release(a);
    G.clear(player); for (let i = 0; i < actors.length; i++) G.clear(actors[i]);
    died.clear(); setHud(false);
  }

  /* ---------- engine events ---------- */
  E.on('kill', e => { const v = e && e.victim; if (!v || v.kind !== 'soldier') return; died.add(v); stop(v); });
  E.on('spawn', e => {
    const a = e && e.actor; if (!a || a.kind !== 'soldier') return;
    if (!died.delete(a)) return;                      // a match start, a bot added, a resupply in place: not a respawn
    if (online && refs) return;                       // the server says when (its 'sg' follows the 'respawn')
    start(a, G.duration(E.cfg && E.cfg.mode));
  });
  E.on('shot', e => { if (e && e.actor && e.actor.sgUntil) act(e.actor, 'fire'); });
  E.on('loading', ev => {
    if (!ev) return;
    if (ev.active && ev.phase === 'init') begin();
    if (ev.active && !ev.done && ev.phase === 'shaders' && !warm) warmUp();
    if (!ev.active || ev.done || ev.phase === 'final') unwarm();       // 'final': every program is linked, the stand-in is not needed for the rest
  });
  E.on('matchStart', () => { if (!begun) begin(); if (online && refs && net) { try { net.sendGuard({ a: 'req' }); } catch (x) { console.warn('[guard] sync', x); } } });
  const over = () => { reset(); begun = false; if (netOff) { try { netOff(); } catch { /* gone */ } netOff = null; } };
  E.on('matchEnd', over); E.on('quit', over); E.on('fatal', over);
  E.on('tick', dt => frame(dt));

  let begun = false;
  function begin() {
    over(); begun = true;
    const cfg = E.cfg || {};
    online = !!(cfg.online && cfg.net); net = online ? cfg.net : null; refs = !!(net && net.sgOk && typeof net.sendGuard === 'function');
    if (refs) { try { netOff = net.on('sg', onNet); } catch (x) { refs = false; console.warn('[guard] net', x); } }
  }
  function onNet(m) {
    if (!m || !E.running) return;
    const lag = Math.min(150, Math.max(0, (net && net.rtt) || 0) / 2);
    if (m.op === 'sync') { if (Array.isArray(m.l)) for (const e of m.l) { if (Array.isArray(e)) { const a = actorById(e[0]); if (a && a.alive) start(a, e[1] - lag); } } return; }
    const a = actorById(m.id); if (!a) return;
    if (m.ms > 0) { if (a.alive) start(a, m.ms - lag); } else stop(a);
  }

  /* ---------- the shader is compiled with everything else, behind the loading screen (a stand-in soldier wears a shell) ---------- */
  function warmUp() {
    try {
      const s = createSoldier(scene, {}); s.root.position.copy(player.pos);
      const e = take(); e.k.value = 0.5;
      if (!fit(e, s)) { pool.push(e); s.dispose(); return; }
      warm = { s, e };
    } catch (x) { console.warn('[guard] warm-up', x); }
  }
  function unwarm() { if (!warm) return; const { s, e } = warm; warm = null; try { e.mesh.removeFromParent(); e.sol = null; e.k.value = 0; pool.push(e); s.dispose(); } catch { /* gone */ } }

  /* ---------- per frame: fades, the blink before the end, the HUD (nothing allocated) ---------- */
  let fdt = 0;
  function stepShell(e, a) {
    const on = a.alive && blocks(a);
    e.fade = on ? Math.min(1, e.fade + fdt / FADE_IN) : e.fade - fdt / FADE_OUT;
    if (!on && e.fade <= 0) { release(a); return; }
    if (!a.sol) return;                                   // body being rebuilt (weapon change): next frame
    if (!fit(e, a.sol)) { release(a); return; }
    let k = Math.max(0, e.fade) * (0.86 + 0.14 * Math.sin(E.time * 17 + e.seed));
    if (on) { const left = (a.sgUntil - E.time * 1000) / 1000; if (left < BLINK && Math.sin(left * 34) < -0.25) k *= 0.3; }       // about to end: it blinks
    e.k.value = k;
  }
  function frame(dt) {
    T.value = E.time; fdt = dt;
    if (live.size) live.forEach(stepShell);
    hud();
  }
  function setHud(on) { if (on === hudOn) return; hudOn = on; if (dom) dom.root.classList.toggle('on', on); }
  function hud() {
    const on = player.alive && blocks(player);
    if (!on) { setHud(false); return; }
    if (!dom && !build()) return;
    const l = (i18n && i18n.lang) || 'fr';
    if (l !== lang) { lang = l; label = tr('hud.guard', 'PROTECTION'); hint = tr('hud.guardHint', ''); dom.b.textContent = label; dom.s.textContent = hint; hudTxt = ''; }
    const left = Math.max(0, player.sgUntil - E.time * 1000) / 1000, s = left.toFixed(1), txt = (lang === 'en' ? s : s.replace('.', ',')) + ' s';
    if (txt !== hudTxt) { hudTxt = txt; dom.n.textContent = txt; }
    const f = Math.round(Math.min(1, left * 1000 / (player.sgTotal || 3000)) * 200) / 200;
    if (f !== hudFrac) { hudFrac = f; dom.u.style.transform = 'scaleX(' + f + ')'; }
    setHud(true);
  }
  function build() {
    if (!hudRoot || typeof document === 'undefined') return false;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'sg-hud';
    root.innerHTML = '<div class="r">' + SHIELD + '<b></b><em></em></div><i><u></u></i><small></small>';
    hudRoot.appendChild(root);
    dom = { root, b: root.querySelector('b'), n: root.querySelector('em'), u: root.querySelector('u'), s: root.querySelector('small') };
    return true;
  }

  return {
    blocks,
    /** For a hit this client would report online on `v`: 0 normal, 1 send it without a hit marker (the server refuses it), 2 do not send it (older server). */
    hitState(v) { if (!blocks(v)) return 0; return online && !refs ? 2 : 1; },
    /** Domination step for a soldier on a point (modes.js, solo): true = he stays out of the count. Taking the point ends his protection. */
    holdsOff(a, owned, mine) { return !!a && !!a.sgUntil && G.onPoint(a, owned, mine, now()); },
    /** Bots and zombies: extra distance (m) for a protected target, so an exposed one is chosen first. */
    penalty: b => (blocks(b) ? G.BOT_PENALTY : 0),
    act, left: a => G.left(a, now()), get authoritative() { return refs; },
    /** Test and debug view. */
    get stats() { return { live: live.size, pool: pool.length, online, refs, warm: !!warm }; },
  };
}
