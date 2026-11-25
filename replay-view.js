// FRONT ZÉRO — MEILLEUR MOMENT, part 2: the replay (loaded by replay-rec.js after a match that has a moment).
// It rebuilds the moment in the map that is still loaded: its own soldiers (soldier.js, palettes, outfits, weapon finishes), its own
// tracers and puffs (engine-fx.js), the engine's projectile and blast effects, the first-person weapon (guns.js) — and drives the
// engine's camera from a wrapper on world.update (the engine renders it with its own post chain: no new shader program).
// Cameras: first person, a cinematic third person that orbits and tracks, and a director that cuts to a slow-motion beat (0.3x) on
// each kill. Reduced motion: no slow motion, no push-in, no orbit. Uses: the card preview (copied into the end-screen card), the
// full-screen viewer, and the video export (replay-export.js). Everything stops the moment a match starts loading.
import * as THREE from 'three';
import { createSoldier } from './soldier.js';
import { createFx } from './engine-fx.js';
import { EV, FL, KF, SF, FWIDTH as FW, EWIDTH as EW, LANGS, weaponDef, momentTitle, tr } from './replay-rec.js';

const VX = {
  aria: ['Meilleur moment', 'Best moment', 'Mejor momento', 'Bester Moment', 'Melhor momento', 'Momento migliore'],
  play: ['Lecture', 'Play', 'Reproducir', 'Abspielen', 'Reproduzir', 'Riproduci'],
  pause: ['Pause', 'Pause', 'Pausa', 'Pause', 'Pausa', 'Pausa'],
  restart: ['Revoir depuis le début', 'Watch from the start', 'Ver desde el principio', 'Von vorn ansehen', 'Ver desde o início', 'Rivedi dall’inizio'],
  close: ['Fermer', 'Close', 'Cerrar', 'Schließen', 'Fechar', 'Chiudi'],
  cam: ['Caméra', 'Camera', 'Cámara', 'Kamera', 'Câmara', 'Camera'],
  auto: ['Réalisateur', 'Director', 'Director', 'Regie', 'Realizador', 'Regia'],
  fp: ['1re personne', 'First person', '1.ª persona', 'Ego-Sicht', '1.ª pessoa', '1ª persona'],
  orbit: ['Cinéma', 'Cinematic', 'Cine', 'Kino', 'Cinema', 'Cinema'],
  moment: ['Moment {n}', 'Moment {n}', 'Momento {n}', 'Moment {n}', 'Momento {n}', 'Momento {n}'],
  portrait: ['Vidéo 9:16', '9:16 video', 'Vídeo 9:16', '9:16-Video', 'Vídeo 9:16', 'Video 9:16'],
  portraitSub: ['TikTok · Shorts', 'TikTok · Shorts', 'TikTok · Shorts', 'TikTok · Shorts', 'TikTok · Shorts', 'TikTok · Shorts'],
  landscape: ['Vidéo 16:9', '16:9 video', 'Vídeo 16:9', '16:9-Video', 'Vídeo 16:9', 'Video 16:9'],
  landscapeSub: ['YouTube · Discord', 'YouTube · Discord', 'YouTube · Discord', 'YouTube · Discord', 'YouTube · Discord', 'YouTube · Discord'],
  vote: ['Vote de la carte · {s} s', 'Map vote · {s} s', 'Votación · {s} s', 'Kartenwahl · {s} s', 'Votação · {s} s', 'Voto mappa · {s} s'],
  next: ['Partie suivante · {s} s', 'Next match · {s} s', 'Siguiente partida · {s} s', 'Nächstes Spiel · {s} s', 'Próxima partida · {s} s', 'Prossima partita · {s} s'],
  play2: ['Joue gratuitement :', 'Play free:', 'Juega gratis:', 'Kostenlos spielen:', 'Joga grátis:', 'Gioca gratis:'],
  tagline: ['FPS tactique gratuit, directement dans le navigateur', 'Free tactical FPS, right in your browser', 'FPS táctico gratis, directamente en el navegador', 'Kostenloser Taktik-Shooter direkt im Browser', 'FPS tático grátis, direto no navegador', 'FPS tattico gratuito, direttamente nel browser'],
  you: ['VOUS', 'YOU', 'TÚ', 'DU', 'TU', 'TU'],
};

const PAL_TEAM = [[0x4c5238, 0x2a2e22, 0x7c7a5c], [0x7d5a3c, 0x3b2a20, 0x9c7c58]];
const OUT_PAL = { desert: [0xb9a678, 0x8e7a51, 0x6b5a3a], foret: [0x59633e, 0x3a4429, 0x7b7650], urbain: [0x74777a, 0x45484b, 0xa1a3a3], arctique: [0xdfe3e2, 0xa9b3b6, 0x737d80], nuit: [0x1c2026, 0x2e3540, 0x11141a], braise: [0x2a211c, 0xb5441f, 0xe8a628] };
const TAU = Math.PI * 2, clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, k) => a + (b - a) * k, sm = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const wrapA = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const cr = (p0, p1, p2, p3, k) => { const k2 = k * k; return 0.5 * (2 * p1 + (p2 - p0) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k2 + (3 * p1 - p0 - 3 * p2 + p3) * k2 * k); };
const jumpOk = (D, a, b) => { const dx = D[b] - D[a], dz = D[b + 2] - D[a + 2]; return dx * dx + dz * dz <= 16; };
const SLOW = 0.3, PRE = 0.28, POST = 0.62, RAMP = 0.14;
const FONT = '"Barlow Condensed","Arial Narrow",Arial,sans-serif';
const C = { amber: '#f0ae2e', amber2: '#ffcf6a', white: '#f4ecd8', sand: '#d8c9a3', dim: '#a5a18a', red: '#ec6a50', blue: '#7fb2e6', ink: '#0b0d09' };
const SURF = 0x9a8a68, BLOOD = 0x8c1f12, GREEN = 0x3d4a16;

export function createView(cx) {
  const { engine: E, settings, i18n, profile, audio, menu, rec, mapName } = cx;
  const I = E.internals, scene = I.scene, camera = I.camera, renderer = I.renderer, grid = I.grid, vm = I.vm, glCanvas = renderer.domElement;
  const li = () => Math.max(0, LANGS.indexOf(i18n.lang || 'fr'));
  const V = (k, p) => { let s = (VX[k] && (VX[k][li()] || VX[k][0])) || k; if (p) s = s.replace(/\{(\w+)\}/g, (m, x) => (x in p ? String(p[x]) : m)); return s; };
  const reduced = () => { try { return !!settings.get('gameplay.reducedMotion') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  let fitMod = null; const fitP = import('./outfits.js').then(m => { fitMod = m; return m; }).catch(() => null);
  let skins = null; import('./weapon-skins.js').then(m => { skins = m; }).catch(() => {});

  /* ---------- replay state ---------- */
  const R = {
    m: null, b: null, act: [], queue: [], ready: false, active: false, mode: '', style: 'auto', aspect: 0, portrait: false,
    t: 0, tA: 0, tB: 0, fi: 0, ei: 0, hold: 0, real: 0, paused: false, beats: [], shots: [], shotI: -1, cut: true,
    feed: [], multi: { n: 0, at: -9, label: '' }, hitAt: -9, hurtAt: -9, banner: { text: '', at: -9 }, introAt: 0, scoped: false, fpOn: false,
    targets: null, onFrame: null, sound: false, wpn: '', lastYaw: 0, lastPitch: 0, endCard: 0, beatK: 0, ads: 0, eye: 1.62, list: null, vmRel: false,
  };
  const fxRoot = new THREE.Group(); fxRoot.name = 'replay-fx'; const fx = createFx(fxRoot);
  const proj = E.projectiles;
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), vLook = new THREE.Vector3(), vCam = new THREE.Vector3(), vT = new THREE.Vector3();
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fp: false, yaw: 0, pitch: 0, vfov: 60, sPos: new THREE.Vector3(), sLook: new THREE.Vector3(), r: 3.6, ang: 0 };
  const st = { vx: 0, vz: 0, yaw: 0, aimPitch: 0, grounded: true, crouch: 0, y: 0 };
  const vmSt = { ads: 0, speed: 0, grounded: true, sliding: false, yawDelta: 0, pitchDelta: 0, blocked: 0, dead: false };
  const snd = { x: 0, y: 0, z: 0, own: false, occluded: false, loud: 1 }, sndOwn = { own: true, loud: 1 };
  const groundAt = (x, y, z) => grid.floorAt(x, y, z, 0.4);
  const hiddenEngine = [];
  const baseFov = () => clamp((settings.get('graphics.fov') || 90) - 6, 50, 110);

  /* ---------- soldiers: one per slot and weapon carried in the window, built one per frame ---------- */
  function teamPal(s) { if (s.kind === 'zombie') return null; if (s.pal) return s.pal; if (s.team === 0 || s.team === 1) return PAL_TEAM[s.team]; if (s.isPlayer) { const o = profile && profile.data && OUT_PAL[profile.data.outfit]; return o || OUT_PAL.desert; } return null; }
  function plan(m) {
    release(true);
    const b = m.buf, nS = b.nS, nF = b.nF;
    R.m = m; R.b = b; R.act = []; R.queue = []; R.ready = false;
    for (let j = 0; j < nS; j++) {
      const s = m.slots[j], used = new Set();
      for (let f = 0; f < nF; f++) { const i = f * nS + j; if (b.f[i] & FL.SEEN) used.add(b.w[i]); }
      const a = { j, s, sols: new Map(), sol: null, wi: -1, tok: { id: 'rp' + j, name: s.name }, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, cr: 0, fl: 0, seen: false, alive: false, dead: false, cols: [], hp: 1 };
      R.act.push(a);
      if (s.kind === 'zombie') { R.queue.push([a, 0]); continue; }
      for (const wi of used) R.queue.push([a, wi]);
      if (!used.size) R.queue.push([a, 0]);
    }
    // the player's own outfit: its set may still need building (solo: nobody else wore it); built in steps before the player's soldier, 4 s at most
    const pf = m.slots[0] && m.slots[0].fit, tok = R.fitTok = {};
    R.fitReady = !pf; R.fitT0 = performance.now();
    if (pf) fitP.then(fm => (fm && fm.prepareOutfits ? fm.prepareOutfits(() => new Promise(r => setTimeout(r, 0)), [pf]) : null)).catch(() => null).then(() => { if (R.fitTok === tok) R.fitReady = true; });
  }
  function buildOne() {
    if (!R.fitReady && performance.now() - R.fitT0 < 4000 && R.queue.length && R.queue[0][0].j === 0) return;
    const q = R.queue.shift(); if (!q) { R.ready = true; return; }
    const [a, wi] = q, s = a.s, wid = R.m.weapons[wi] || 'ar';
    try {
      const sol = createSoldier(scene, { palette: teamPal(s) || undefined, weaponId: wid, kind: s.kind, zombieType: s.zType || undefined, outfit: s.kind === 'soldier' ? s.fit || undefined : undefined, outfitTeam: s.team });
      sol.setGround(groundAt); sol.setVisible(false);
      if (s.kind === 'soldier' && skins && s.fin && s.fin[wid]) { const fid = s.fin[wid]; if (skins.finishReady(fid)) skins.soldierFinish(sol, fid); else skins.prepareFinishes([fid]).then(() => { try { if (a.sols.get(wi) === sol) skins.soldierFinish(sol, fid); } catch { /* cosmetic */ } }).catch(() => {}); }
      a.sols.set(wi, sol);
    } catch (e) { console.warn('[replay] soldier', e); }
    if (!R.queue.length) R.ready = true;
  }
  function disposeSoldiers() { for (const a of R.act) { for (const s of a.sols.values()) { try { s.dispose(); } catch { /* gone */ } } a.sols.clear(); a.sol = null; } }

  /* ---------- timeline: slow motion on the player's kills, director shots ---------- */
  function beatsFor(m, a, b, only) {
    const out = []; if (reduced()) return out;
    for (const k of m.kills) if (k.t >= a - 0.05 && k.t <= b + 0.05) out.push(k.t);
    return only ? out.filter(t => t === only) : out;
  }
  function rateAt(t) {
    let r = 1;
    for (let i = 0; i < R.beats.length; i++) {
      const tk = R.beats[i], a = tk - PRE - RAMP, b = tk + POST + RAMP; if (t < a || t > b) continue;
      const k = t < tk - PRE ? 1 - (1 - SLOW) * sm((t - a) / RAMP) : t <= tk + POST ? SLOW : SLOW + (1 - SLOW) * sm((t - tk - POST) / RAMP);
      if (k < r) r = k;
    }
    return r;
  }
  /** Real seconds to play [a, b] with the current beats. */
  function realLen(a, b) { let s = 0; for (let t = a; t < b; t += 0.01) s += 0.01 / rateAt(t); return s; }
  function buildShots(style) {
    const m = R.m, sh = [], ks = m.kills.filter(k => k.t >= R.tA && k.t <= R.tB), red = reduced();
    if (style === 'fp') { sh.push({ a: -1e9, b: 1e9, type: 'fp' }); return sh; }
    if (style === 'orbit' || (red && style !== 'auto')) { sh.push({ a: -1e9, b: 1e9, type: 'orbit' }); return sh; }
    const base = style === 'cine' ? 'orbit' : 'fp';
    if (red) { sh.push({ a: -1e9, b: ks.length ? ks[ks.length - 1].t + 0.9 : 1e9, type: base }); if (ks.length) sh.push({ a: ks[ks.length - 1].t + 0.9, b: 1e9, type: 'orbit' }); return sh; }
    let t = -1e9;
    for (let i = 0; i < ks.length; i++) {
      let a = ks[i].t - PRE - RAMP - 0.05, b = ks[i].t + POST + RAMP + 0.12, j = i;
      while (j + 1 < ks.length && ks[j + 1].t - PRE - RAMP - 0.05 < b + 0.9) { j++; b = ks[j].t + POST + RAMP + 0.12; }
      if (a > t) sh.push({ a: t, b: a, type: base });
      sh.push({ a, b, type: 'kill', k0: i, k1: j });
      t = b; i = j;
    }
    const tail = R.tB - t;
    if (ks.length && tail > 0.6 && base === 'fp') sh.push({ a: t, b: 1e9, type: 'orbit' }); else sh.push({ a: t, b: 1e9, type: base });
    return sh;
  }

  /* ---------- seeking ---------- */
  function frameAt(t) {
    const T = R.b.t, n = R.b.nF; let i = R.fi;
    if (i >= n || T[i] > t) i = 0;
    while (i + 1 < n && T[i + 1] <= t) i++;
    R.fi = i; return i;
  }
  /** Interpolated state of every slot at time t. */
  function sampleAt(t) {
    try { const B = E.breach; if (B && B.showAt && R.m && R.m.bk) B.showAt(R.m.bk, t); } catch { /* breached walls as they were at t (engine-breach.js), look only */ }
    const b = R.b, nS = b.nS, nF = b.nF, i = frameAt(t), i1 = Math.min(i + 1, nF - 1), T = b.t;
    const k = i1 > i && T[i1] > T[i] ? clamp((t - T[i]) / (T[i1] - T[i]), 0, 1) : 0;
    for (let j = 0; j < nS; j++) {
      const a = R.act[j], q0 = i * nS + j, q1 = i1 * nS + j, f0 = b.f[q0], f1 = b.f[q1], d0 = q0 * FW, d1 = q1 * FW, D = b.d;
      a.seen = !!(f0 & FL.SEEN) && !(f0 & FL.GHOST); a.fl = f0; a.alive = !!(f0 & FL.ALIVE); a.wi = a.wi < 0 ? b.w[q0] : a.wi; a.nwi = b.w[q0]; a.hp = b.h[q0] / 255;
      let kk = k; if (!(f1 & FL.SEEN) || (f1 & FL.ALIVE) !== (f0 & FL.ALIVE)) kk = 0;
      else { const dx = D[d1] - D[d0], dz = D[d1 + 2] - D[d0 + 2]; if (dx * dx + dz * dz > 16) kk = 0; }
      // Catmull-Rom through the neighbouring samples (slow motion plays the 20 Hz record at ~6 Hz: straight segments would show), linear at the edges
      const ip = i > 0 ? i - 1 : i, i2 = i1 + 1 < nF ? i1 + 1 : i1, qp = ip * nS + j, q2 = i2 * nS + j;
      if (kk > 0 && ip < i && i2 > i1 && (b.f[qp] & FL.SEEN) && (b.f[q2] & FL.SEEN) && (b.f[qp] & FL.ALIVE) === (f0 & FL.ALIVE) && (b.f[q2] & FL.ALIVE) === (f0 & FL.ALIVE) && jumpOk(D, qp * FW, d0) && jumpOk(D, d1, q2 * FW)) {
        const dp = qp * FW, d2 = q2 * FW;
        a.x = cr(D[dp], D[d0], D[d1], D[d2], kk); a.y = cr(D[dp + 1], D[d0 + 1], D[d1 + 1], D[d2 + 1], kk); a.z = cr(D[dp + 2], D[d0 + 2], D[d1 + 2], D[d2 + 2], kk);
        const y1 = D[d0 + 3], y0 = y1 + wrapA(D[dp + 3] - y1), y2 = y1 + wrapA(D[d1 + 3] - y1), y3 = y2 + wrapA(D[d2 + 3] - y2);
        a.yaw = cr(y0, y1, y2, y3, kk); a.pitch = cr(D[dp + 4], D[d0 + 4], D[d1 + 4], D[d2 + 4], kk);
      } else {
        a.x = lerp(D[d0], D[d1], kk); a.y = lerp(D[d0 + 1], D[d1 + 1], kk); a.z = lerp(D[d0 + 2], D[d1 + 2], kk);
        a.yaw = D[d0 + 3] + wrapA(D[d1 + 3] - D[d0 + 3]) * kk; a.pitch = lerp(D[d0 + 4], D[d1 + 4], kk);
      }
      a.vx = lerp(D[d0 + 5], D[d1 + 5], kk); a.vz = lerp(D[d0 + 6], D[d1 + 6], kk); a.cr = lerp(D[d0 + 7], D[d1 + 7], kk);
    }
    R.ads = lerp(b.ads[i], b.ads[i1], k) / 255; R.eye = lerp(b.eye[i], b.eye[i1], k) || 1.62;
  }
  function reset() {
    const b = R.b; R.fi = 0; R.t = R.tA; R.hold = 0; R.real = 0; R.introAt = 0; R.feed.length = 0; R.multi.n = 0; R.multi.at = -9; R.hitAt = -9; R.hurtAt = -9; R.banner.at = -9; R.endCard = 0;
    try { fx.clear(); } catch { /* optional */ } try { proj.clear(); } catch { /* optional */ }
    for (const a of R.act) { for (const s of a.sols.values()) { if (s.dead) s.respawn(); s.setVisible(false); } a.sol = null; a.wi = -1; a.dead = false; }
    sampleAt(R.t);
    for (const a of R.act) syncSoldier(a, 0, true);
    // events: first one in the window; a grenade or rocket already in the air is launched and moved on to the window start
    R.ei = 0; while (R.ei < b.nE && b.evT[R.ei] < R.tA) {
      const o = R.ei * EW; if (b.ev[o + 1] === EV.SHOT && (b.ev[o + 5] & SF.PROJ)) { try { shotEvent(o, true); proj.update(R.tA - b.evT[R.ei]); } catch { /* optional */ } }
      R.ei++;
    }
    R.shotI = -1; R.cut = true; R.wpn = '';
  }

  /* ---------- events ---------- */
  function killerOf(o) { const b = R.b, sa = b.ev[o + 2], t = b.ev[o]; for (let e = R.ei; e < b.nE; e++) { const q = e * EW; if (b.ev[q] > t + 0.16) break; if (b.ev[q + 1] === EV.KILL && b.ev[q + 2] === sa) return q; } return -1; }
  function shotEvent(o, pre) {
    const b = R.b, sa = b.ev[o + 2], wid = R.m.weapons[b.ev[o + 4]] || '', fl = b.ev[o + 5], A = sa >= 0 ? R.act[sa] : null, D = weaponDef(wid);
    const ex = b.ev[o + 6], ey = b.ev[o + 7], ez = b.ev[o + 8], dx = b.ev[o + 9], dy = b.ev[o + 10], dz = b.ev[o + 11], me = sa === 0;
    const fpShot = me && R.fpOn && !pre;
    if (A && A.sol && !pre && A.seen) A.sol.fire();
    if (fpShot) { try { vm.fire(); } catch { /* optional */ } }
    // where the shot starts on screen: the first-person muzzle, the soldier's muzzle, or the eye
    if (fpShot && vm.group.visible) vm.muzzle(v1); else if (A && A.sol && A.sol.root.visible) A.sol.muzzle(v1); else v1.set(ex, ey, ez);
    if (fl & SF.PROJ) {
      if (!D || !D.proj || R.mode === 'preview') return;       // the card stays silent: no rocket or grenade sounds behind the results
      let x = dx, y = dy + (fl & SF.THROW ? 0.16 : 0), z = dz; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      const s = D.proj.speed || 30;
      try { proj.spawn(D, A ? A.tok : null, ex, ey, ez, x * s, y * s, z * s, 0, true, 0, v1.x, v1.y, v1.z); } catch { /* optional */ }
      if (!pre) sound(wid, sa, ex, ey, ez, fpShot);
      return;
    }
    if (pre || (fl & SF.MELEE)) { if (!pre) sound(wid, sa, ex, ey, ez, fpShot); return; }
    // hitscan: to the victim if this shot killed, else to the first wall along the aim
    const kq = killerOf(o); let tx, ty, tz, flesh = false;
    if (kq >= 0) { tx = b.ev[kq + 6]; ty = b.ev[kq + 7] + (b.ev[kq + 5] & KF.HEAD ? 1.62 : 1.15); tz = b.ev[kq + 8]; flesh = true; }
    else { const d = grid.ray(ex, ey, ez, dx, dy, dz, 160); tx = ex + dx * d; ty = ey + dy * d; tz = ez + dz * d; flesh = d < 159 && hitsBody(ex, ey, ez, dx, dy, dz, d, sa); }
    const n = D && D.pellets > 1 ? Math.min(5, D.pellets) : 1, sp = D && D.pellets > 1 ? D.spread || 0.06 : 0, L = Math.hypot(tx - ex, ty - ey, tz - ez);
    for (let p = 0; p < n; p++) {
      const jx = p ? (Math.random() - 0.5) * 2 * sp * L : 0, jy = p ? (Math.random() - 0.5) * 2 * sp * L : 0, jz = p ? (Math.random() - 0.5) * 2 * sp * L : 0;
      if (!(fl & SF.FLAME)) fx.tracer(v1.x, v1.y, v1.z, tx + jx, ty + jy, tz + jz, me ? 0xffdf9e : 0xffb36a, (fl & SF.QUIET) ? 0.15 : me ? 0.75 : 0.6);
    }
    if (L < 158 && !(fl & SF.FLAME)) fx.puff(tx, ty, tz, flesh ? BLOOD : SURF, flesh ? 4 : 3);
    sound(wid, sa, ex, ey, ez, fpShot);
  }
  /** Does the shot pass through a living replay body before the wall (a hit that did not kill: a puff of blood)? */
  function hitsBody(ox, oy, oz, dx, dy, dz, max, self) {
    for (const a of R.act) {
      if (a.j === self || !a.seen || !a.alive) continue;
      const px = a.x - ox, py = a.y + 1 - oy, pz = a.z - oz, al = px * dx + py * dy + pz * dz; if (al < 0 || al > max) continue;
      const cx = px - dx * al, cy = py - dy * al, cz = pz - dz * al; if (cx * cx + cz * cz < 0.12 && cy * cy < 0.8) return true;
    }
    return false;
  }
  function sound(wid, sa, x, y, z, own) {
    if (!R.sound || !audio) return;
    try { if (own) { sndOwn.loud = 1; audio.shot(wid, sndOwn); } else { snd.x = x; snd.y = y; snd.z = z; snd.own = false; snd.occluded = !grid.los(camera.position.x, camera.position.y, camera.position.z, x, y, z); audio.shot(wid, snd); } } catch { /* optional */ }
  }
  function killEvent(o) {
    const b = R.b, sk = b.ev[o + 2], sv = b.ev[o + 3], fl = b.ev[o + 5], wid = R.m.weapons[b.ev[o + 4]] || '';
    const K = sk >= 0 ? R.act[sk] : null, Vv = sv >= 0 ? R.act[sv] : null;
    if (Vv && Vv.sol && !Vv.sol.dead) {
      let dx = 0, dz = 0; if (K) { dx = Vv.x - K.x; dz = Vv.z - K.z; }
      try {
        grid.gather(Vv.x, Vv.y + 1, Vv.z, 3.2, Vv.cols); Vv.sol.setColliders(Vv.cols);
        Vv.sol.die(dx, dz, !!(fl & KF.HEAD), wid === 'sg' || wid === 'sr' || wid === 'hsr' ? 2 : 1); Vv.dead = true;
        if (fl & KF.BLAST) { const q = boomNear(b.ev[o], Vv.x, Vv.z); if (q >= 0) Vv.sol.blast(b.ev[q + 6], b.ev[q + 7] + 0.25, b.ev[q + 8], b.ev[q + 9], 1); }
      } catch (e) { console.warn('[replay] die', e); }
    }
    const kn = K ? (K.j === 0 ? V('you') : K.s.name) : '', vn = Vv ? (Vv.j === 0 ? V('you') : Vv.s.name) : '';
    if (Vv && Vv.s.kind !== 'zombie') R.feed.push({ k: kn, v: vn, w: weaponName(wid), head: !!(fl & KF.HEAD), kc: K ? colorOf(K.s) : C.dim, vc: Vv ? colorOf(Vv.s) : C.dim, at: R.real, mine: sk === 0 });
    if (R.feed.length > 5) R.feed.shift();
    if (sk === 0 && sv !== 0) {
      R.multi.n++; R.multi.at = R.real; R.multi.label = R.multi.n >= 4 ? tr(i18n, 'm4', { n: R.multi.n }) : R.multi.n === 3 ? tr(i18n, 'm3') : R.multi.n === 2 ? tr(i18n, 'm2') : (fl & KF.HEAD ? tr(i18n, 'head') : '');
      R.hitAt = R.real;
      if (R.sound) { try { audio.hit(!!(fl & KF.HEAD)); audio.kill(); } catch { /* optional */ } }
    }
  }
  function boomNear(t, x, z) { const b = R.b; let best = -1, bd = 1e9; for (let e = 0; e < b.nE; e++) { const q = e * EW; if (b.ev[q + 1] !== EV.BOOM || Math.abs(b.ev[q] - t) > 0.6) continue; const d = Math.hypot(b.ev[q + 6] - x, b.ev[q + 8] - z); if (d < bd) { bd = d; best = q; } } return best; }
  function boomEvent(o) {
    const b = R.b, sa = b.ev[o + 2], wid = R.m.weapons[b.ev[o + 4]] || 'frag', x = b.ev[o + 6], y = b.ev[o + 7], z = b.ev[o + 8], r = b.ev[o + 9] || 5;
    if (R.mode === 'preview') {       // the card is silent: the blast look without the engine's blast sound
      for (let i = 0; i < 3; i++) fx.puff(x, y + 0.4, z, i ? 0xff9a3a : 0xfff1c9, 10, 3.5 + i);
      fx.puff(x, y + 0.6, z, 0x5d5850, 14, 2);
      return;
    }
    let D = weaponDef(wid); if (!D || !D.proj || !(D.proj.radius > 0)) D = { id: wid, proj: { radius: r } };
    try { proj.remoteBoom(sa >= 0 ? R.act[sa].tok : null, 0, x, y, z, D); } catch (e) { console.warn('[replay] blast', e); }
  }
  function hitEvent(o) {
    const b = R.b, sa = b.ev[o + 2], sb = b.ev[o + 3], head = !!(b.ev[o + 5] & 1), A = sa >= 0 ? R.act[sa] : null, B = sb >= 0 ? R.act[sb] : null;
    if (B && B.sol && !B.sol.dead && B.seen) { try { B.sol.hit(A ? B.x - A.x : 0, A ? B.z - A.z : 0, head); } catch { /* optional */ } }
    if (sb === 0 && sa !== 0) R.hurtAt = R.real;
    if (sa === 0 && sb !== 0) { R.hitAt = R.real; if (R.sound) { try { audio.hit(head); } catch { /* optional */ } } }
  }
  function objEvent(o) { const k = R.b.ev[o + 5] & 7; const key = k === 1 ? 'cap' : k === 2 ? 'plant' : k === 3 ? 'defuse' : ''; if (key) { R.banner.text = tr(i18n, key); R.banner.at = R.real; } }
  function fire(t0, t1) {
    const b = R.b;
    while (R.ei < b.nE && b.evT[R.ei] <= t1) {
      const o = R.ei * EW, ty = b.ev[o + 1]; R.ei++;
      if (b.evT[R.ei - 1] < t0 - 0.2) continue;
      try { if (ty === EV.SHOT) shotEvent(o, false); else if (ty === EV.KILL) killEvent(o); else if (ty === EV.BOOM) boomEvent(o); else if (ty === EV.HIT) hitEvent(o); else if (ty === EV.OBJ) objEvent(o); } catch (e) { console.warn('[replay] event', e); }
    }
  }
  const weaponName = id => { const d = weaponDef(id); return d && d.name ? String(d.name) : ''; };
  function colorOf(s) { if (s.isPlayer) return C.amber; const me = R.m.slots[0]; if (s.kind === 'zombie') return '#9ad04a'; if (me.team !== null && me.team !== undefined && s.team === me.team) return C.blue; return C.red; }

  /* ---------- soldiers each frame ---------- */
  function syncSoldier(a, dt, snap) {
    const hideMe = a.j === 0 && R.fpOn;
    if (!a.seen) { if (a.sol) { a.sol.setVisible(false); } return; }
    // weapon change: the soldier built for the new weapon takes over
    const want = a.s.kind === 'zombie' ? a.sols.get(0) || a.sols.values().next().value : a.sols.get(a.nwi) || a.sol || a.sols.values().next().value;
    if (!want) return;
    if (a.sol !== want && (a.alive || !a.sol)) {       // a body on the ground keeps its ragdoll until it is back on its feet
      if (a.sol) a.sol.setVisible(false);
      a.sol = want; st.vx = st.vz = 0; st.yaw = a.yaw; st.aimPitch = a.pitch; st.grounded = true; st.crouch = a.cr; st.y = a.y;
      want.root.position.set(a.x, a.y, a.z); want.update(0, st); want.respawn(); snap = true;
    }
    const s = a.sol;
    if (a.alive) {
      if (s.dead) { s.respawn(); a.dead = false; snap = true; }
      if (s.root.visible === hideMe) s.setVisible(!hideMe);
      s.root.position.set(a.x, a.y, a.z);
      st.vx = a.vx; st.vz = a.vz; st.yaw = a.yaw; st.aimPitch = a.pitch; st.grounded = !!(a.fl & FL.GROUND); st.crouch = a.cr; st.y = a.y;
      if ((a.fl & FL.RELOAD) && !a.rel) { a.rel = true; try { const d = weaponDef(R.m.weapons[a.nwi]); s.reload(d && d.reload ? d.reload : 2); } catch { /* optional */ } } else if (!(a.fl & FL.RELOAD)) a.rel = false;
      s.update(snap ? 0 : dt, st);
    } else if (s.dead) { if (!s.root.visible && !hideMe) s.setVisible(true); s.update(dt, st); }
    else if (!snap && s.root.visible) {       // gone without a kill in the window (fall, zone, server): drops where it stood
      try { grid.gather(a.x, a.y + 1, a.z, 3.2, a.cols); s.setColliders(a.cols); s.die(0, 0, false, 0.6); a.dead = true; } catch { s.setVisible(false); }
    } else s.setVisible(false);
  }

  /* ---------- cameras ---------- */
  const P0 = () => R.act[0];
  function fpCam(dtR) {
    const p = P0(), D = weaponDef(R.m.weapons[p.nwi]);
    cam.fp = true; cam.pos.set(p.x, p.y + (R.eye || 1.62), p.z); cam.yaw = p.yaw; cam.pitch = p.pitch;
    const b = baseFov(), adsF = D && D.fov ? D.fov / 84 * b : b * 0.72, f = b + (adsF - b) * R.ads;
    cam.vfov = R.portrait ? vfovFromH(62 * f / b) : fitV(f);
    if (R.beatK > 0 && !reduced()) cam.vfov *= 1 - 0.07 * R.beatK;
  }
  const vfovFromH = h => 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(h) / 2) / Math.max(0.2, aspect())));
  const fitV = f => { const asp = aspect(), ref = 16 / 9; if (asp >= ref) return f; return Math.min(128, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(f) / 2) * ref / asp))); };
  const aspect = () => R.aspect || camera.aspect || 16 / 9;
  /** Pull a camera in front of the first wall between the subject and it. */
  function clear(from, to, out) {
    v3.subVectors(to, from); const L = v3.length(); if (L < 1e-3) { out.copy(to); return L; }
    v3.multiplyScalar(1 / L); const d = grid.ray(from.x, from.y, from.z, v3.x, v3.y, v3.z, L + 0.3);
    const k = d < L + 0.25 ? Math.max(0.45, d - 0.28) : L; out.copy(from).addScaledVector(v3, k); return k;
  }
  function chestOf(a, out) { const h = a.s.kind === 'zombie' ? 1.25 : a.cr > 0.5 ? 0.95 : 1.3; return out.set(a.x, a.y + h, a.z); }
  function orbitCam(dtR, sdt, snap) {
    const p = P0(); cam.fp = false; chestOf(p, vT);
    const red = reduced(), r0 = R.portrait ? 3.1 : 4.1, el = R.portrait ? 0.22 : 0.32, speed = red ? 0 : (R.mode === 'preview' ? 0.2 : 0.24) * (0.35 + 0.65 * (sdt / Math.max(1e-4, dtR)));
    if (snap) { cam.ang = p.yaw + Math.PI + 0.75; cam.r = r0; }
    cam.ang += speed * dtR;
    vCam.set(vT.x + Math.sin(cam.ang) * Math.cos(el) * r0, vT.y + Math.sin(el) * r0 + 0.15, vT.z + Math.cos(cam.ang) * Math.cos(el) * r0);
    const k = clear(vT, vCam, v2), want = Math.min(r0, k);
    cam.r += (want - cam.r) * (snap || want < cam.r ? 1 : 1 - Math.exp(-2.5 * dtR));
    v3.subVectors(v2, vT).normalize(); cam.pos.copy(vT).addScaledVector(v3, cam.r);
    cam.look.copy(vT); cam.look.y -= R.portrait ? 0.28 : 0.1;
    cam.vfov = R.portrait ? 64 : 46;
  }
  function killCam(shot, dtR, snap) {
    const m = R.m, p = P0(), ks = m.kills, t = R.t;
    let k = shot.k0; for (let i = shot.k0; i <= shot.k1; i++) if (ks[i].t - 0.35 <= t) k = i;
    const kq = killEventAt(ks[k].t), vx = kq >= 0 ? R.b.ev[kq + 6] : p.x + 3, vy = kq >= 0 ? R.b.ev[kq + 7] : p.y, vz = kq >= 0 ? R.b.ev[kq + 8] : p.z;
    chestOf(p, vT); vLook.set(vx, vy + 1.15, vz);
    let fx2 = vx - p.x, fz2 = vz - p.z; const d = Math.hypot(fx2, fz2) || 1; fx2 /= d; fz2 /= d;
    const u = sm((t - shot.a) / Math.max(0.3, shot.b - shot.a)), push = reduced() ? 0 : u * 0.18;
    // the viewpoint is chosen once per target: the first one that sees both the player and the target (a crate or a truck must not fill the frame)
    const key = k * 1000 + (R.portrait ? 1 : 0);
    if (shot.ck !== key) { shot.ck = key; shot.cv = pickKillView(d, fx2, fz2, vx, vy, vz, p.alive); }
    if (shot.cv < 0) { fpCam(dtR); return; }       // nowhere clear: the player's own view
    killView(shot.cv, d, fx2, fz2, vx, vy, vz, vCam);
    cam.fp = false; vCam.lerp(vLook, push);
    if (shot.cv < 3) { clear(vT, vCam, cam.pos); cam.look.lerpVectors(vT, vLook, d < 7 ? 0.5 : 0.78); cam.vfov = R.portrait ? 66 : 50; }
    else { clear(vLook, vCam, cam.pos); cam.look.copy(vLook); cam.vfov = R.portrait ? 62 : 44; }
  }
  /** Kill viewpoints: 0 right shoulder, 1 left shoulder, 2 high behind (player and target in frame), 3 and 4 beside the target (long shots). */
  function killView(i, d, fx2, fz2, vx, vy, vz, out) {
    const rx = -fz2, rz = fx2;
    if (i < 3) {
      const back = (R.portrait ? 2.5 : 2.25) + (i === 2 ? 0.5 : 0), side = i === 2 ? 0 : (i === 0 ? 1 : -1) * (R.portrait ? 0.45 : 0.82), up = (R.portrait ? 0.55 : 0.36) + (i === 2 ? 0.95 : 0);
      return out.set(vT.x - fx2 * back + rx * side, vT.y + up, vT.z - fz2 * back + rz * side);
    }
    const sd = i === 3 ? 2.6 : -2.6;
    return out.set(vx + rx * sd - fx2 * 1.9, vy + 1.65, vz + rz * sd - fz2 * 1.9);
  }
  function pickKillView(d, fx2, fz2, vx, vy, vz, alive) {
    const order = d < 26 || !alive ? [0, 1, 2, 3, 4] : [3, 4, 0, 1, 2];
    for (const i of order) {
      killView(i, d, fx2, fz2, vx, vy, vz, vCam);
      if (i < 3) clear(vT, vCam, v2); else clear(vLook, vCam, v2);
      if (v2.distanceTo(vCam) > 0.6) continue;       // a wall right behind: too close to frame anything
      if (!grid.los(v2.x, v2.y, v2.z, vLook.x, vLook.y, vLook.z)) continue;
      if (i < 3 && alive && !grid.los(v2.x, v2.y, v2.z, vT.x, vT.y + 0.3, vT.z)) continue;
      return i;
    }
    return -1;
  }
  function killEventAt(t) { const b = R.b; for (let e = 0; e < b.nE; e++) { const q = e * EW; if (b.ev[q + 1] === EV.KILL && b.ev[q + 2] === 0 && Math.abs(b.ev[q] - t) < 1e-3) return q; } return -1; }
  function updateCamera(dtR, sdt) {
    let i = R.shotI; const sh = R.shots;
    if (i < 0 || R.t < sh[i].a || R.t >= sh[i].b) { for (i = 0; i < sh.length; i++) if (R.t >= sh[i].a && R.t < sh[i].b) break; if (i >= sh.length) i = sh.length - 1; }
    const cut = i !== R.shotI || R.cut; R.shotI = i; R.cut = false;
    let type = sh[i].type; const p = P0();
    if (type === 'fp' && !p.alive) type = 'orbit';
    const was = cam.kind; cam.kind = type;
    if (type === 'fp') fpCam(dtR);
    else if (type === 'kill') killCam(sh[i], dtR, cut);
    else orbitCam(dtR, sdt, cut || was !== 'orbit');
    if (R.fpOn !== cam.fp) {       // the player's own body: hidden in first person, shown otherwise, from this very frame
      R.fpOn = cam.fp; const a0 = R.act[0];
      if (a0 && a0.sol && a0.alive && a0.seen) a0.sol.setVisible(!R.fpOn);
    }
    // third-person cameras glide (the 20 Hz record would shake them), cuts snap
    if (!cam.fp) {
      if (cut || was !== type) { cam.sPos.copy(cam.pos); cam.sLook.copy(cam.look); }
      else { const k = 1 - Math.exp(-9 * dtR); cam.sPos.lerp(cam.pos, k); cam.sLook.lerp(cam.look, 1 - Math.exp(-12 * dtR)); }
    }
  }
  function applyCamera() {
    if (cam.fp) { camera.position.copy(cam.pos); camera.rotation.set(cam.pitch, cam.yaw, 0, 'YXZ'); }
    else { camera.position.copy(cam.sPos); camera.up.set(0, 1, 0); camera.lookAt(cam.sLook); }
    const asp = aspect();
    if (Math.abs(camera.fov - cam.vfov) > 0.01 || Math.abs(camera.aspect - asp) > 1e-4) { camera.fov = cam.vfov; camera.aspect = asp; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }

  /* ---------- the first-person weapon ---------- */
  const camLights = () => R.lights || (R.lights = camera.children.filter(o => o.isPointLight));
  /* guns.js keeps its ejected casings and muzzle smoke in world space, sized for the first-person camera: seen from a third-person camera they
     float like giant shells. Found once by their materials (an instanced brass mesh without fog, the smoke shader), hidden outside first person. */
  const vmWorld = () => R.vmFx || (R.vmFx = scene.children.filter(o => (o.isInstancedMesh && o.instanceColor && o.material && o.material.isMeshStandardMaterial && o.material.fog === false && o.material.metalness === 0.85 && o.material.roughness === 0.38)
    || (o.isPoints && o.material && o.material.isShaderMaterial && typeof o.material.vertexShader === 'string' && o.material.vertexShader.startsWith('attribute vec2 aData;varying float vA;uniform float uH;'))));
  const vmFxShow = on => { for (const o of vmWorld()) if (o.visible !== on) o.visible = on; };
  function updateVm(sdt) {
    const p = P0();
    vmFxShow(R.fpOn && p.alive);
    if (!R.fpOn || !p.alive) {       // the weapon's muzzle light lives on the camera: off whenever the first-person weapon is not drawn
      if (vm.group.visible) vm.group.visible = false; R.scoped = false;
      for (const l of camLights()) if (l.intensity !== 0) l.intensity = 0;
      return;
    }
    const wid = R.m.weapons[p.nwi] || 'ar';
    if (wid !== R.wpn) { R.wpn = wid; const D = weaponDef(wid); if (D && D.slot !== undefined && D.slot <= 2 && D.kind !== 'thrown') { try { vm.equip(D, I.P.outfit); } catch { /* optional */ } } }
    if ((p.fl & FL.RELOAD) && !R.vmRel) { R.vmRel = true; try { const D = weaponDef(wid); vm.reload(D && D.reload ? D.reload : 2, false); } catch { /* optional */ } } else if (!(p.fl & FL.RELOAD)) R.vmRel = false;
    vmSt.ads = R.ads; vmSt.speed = Math.hypot(p.vx, p.vz); vmSt.grounded = !!(p.fl & FL.GROUND); vmSt.sliding = false; vmSt.dead = false; vmSt.blocked = 0;
    vmSt.yawDelta = wrapA(p.yaw - R.lastYaw); vmSt.pitchDelta = p.pitch - R.lastPitch; R.lastYaw = p.yaw; R.lastPitch = p.pitch;
    try { vm.update(sdt, vmSt); } catch (e) { if (!R.vmWarned) { R.vmWarned = true; console.warn('[replay] weapon', e); } }
    R.scoped = !!vm.scoped;
    if (R.portrait && vm.group.visible) vm.group.visible = false;       // the arms are posed for a wide picture: a phone frame cuts them in half
  }

  /* ---------- one replay frame, from the engine's frame (world.update wrapper) ---------- */
  function step(dtR) {
    if (!R.active || !R.m) return false;
    if (E.running || E.loading || !E.world || E.world.id !== R.m.map || E.contextLost) { stopAll(); return false; }
    if (!R.ready) { buildOne(); if (!R.ready) return false; start(); }
    if (fxRoot.parent !== scene) scene.add(fxRoot);
    dtR = clamp(dtR, 0, 0.1); R.real += dtR;
    let sdt = 0;
    if (R.paused) sdt = 0;
    else if (R.hold > 0) { R.hold -= dtR; if (R.hold <= 0) { if (!onEnd()) return true; } }
    else {
      const rate = rateAt(R.t); R.beatK = 1 - (rate - SLOW) / (1 - SLOW); sdt = dtR * rate;
      const t1 = Math.min(R.t + sdt, R.tB); fire(R.t, t1); R.t = t1;
      if (R.t >= R.tB - 1e-6) R.hold = R.mode === 'export' ? 1e9 : R.mode === 'preview' ? 0.9 : 1.2;
    }
    sampleAt(R.t);
    for (const a of R.act) syncSoldier(a, sdt, false);
    try { fx.update(sdt); } catch { /* optional */ }
    try { proj.update(R.hold > 0 ? dtR * 0.35 : sdt); } catch { /* optional */ }
    updateCamera(dtR, sdt);
    updateVm(sdt);
    try { if (fitMod && fitMod.setOutfitView) { const q = E.perf ? E.perf.qLevel : 0; fitMod.setOutfitView(camera.position.x, camera.position.y, camera.position.z, q, -Math.sin(cam.fp ? cam.yaw : 0), -Math.cos(cam.fp ? cam.yaw : 0)); } } catch { /* cosmetic */ }
    if (R.sound && audio) { try { audio.setListener(cam.fp ? cam.pos.x : cam.sPos.x, cam.fp ? cam.pos.y : cam.sPos.y, cam.fp ? cam.pos.z : cam.sPos.z, cam.fp ? cam.yaw : Math.atan2(cam.sPos.x - cam.sLook.x, cam.sPos.z - cam.sLook.z)); } catch { /* optional */ } }
    return true;
  }
  /** End of the clip: loop (card, viewer); the export decides on its own (end card). Returns false when the replay stopped. */
  function onEnd() { if (R.mode === 'export') return true; reset(); return true; }

  /* ---------- the engine hooks: world.update (camera before and after the other wrappers), the menu frame rate, the copy ---------- */
  let hooked = false, fpsWant = 0, fpsStore;
  function hook() {
    if (hooked) return; hooked = true;
    const W = E.world, inner = W.update;
    W.update = function (dt, time, c) {
      let on = false;
      try { on = step(dt); if (on) { applyCamera(); if (R.targets || R.onFrame) queueMicrotask(afterRender); } } catch (e) { console.warn('[replay] frame', e); stopAll(); }
      inner.call(W, dt, time, c);
      if (on) { try { applyCamera(); } catch { /* the next frame retries */ } }
    };
    try {
      fpsStore = E.menuFps;
      Object.defineProperty(E, 'menuFps', { configurable: true, enumerable: true, get() { return fpsWant > 0 ? fpsWant : fpsStore; }, set(v) { fpsStore = v; } });
    } catch { /* the menu frame rate then stays the motion layer's */ }
  }
  function afterRender() {
    if (!R.active) return;
    if (R.onFrame) { try { R.onFrame(glCanvas); } catch (e) { console.warn('[replay] export frame', e); } }
    if (R.targets && R.mode === 'preview') {
      const W = glCanvas.width, H = glCanvas.height; let sw = W, sh = H, sx = 0, sy = 0;
      if (W / H > 16 / 9) { sw = H * 16 / 9; sx = (W - sw) / 2; } else { sh = W * 9 / 16; sy = (H - sh) / 2; }
      for (const tg of R.targets) {
        try { const g = tg.g || (tg.g = tg.canvas.getContext('2d', { alpha: false })); g.imageSmoothingQuality = 'medium'; g.drawImage(glCanvas, sx, sy, sw, sh, 0, 0, tg.canvas.width, tg.canvas.height); if (!tg.live) { tg.live = true; if (tg.onLive) tg.onLive(); } } catch { /* the next frame retries */ }
      }
    }
  }
  function hideEngineSoldiers() { for (const a of E.actors) { if (a.sol && a.sol.root && a.sol.root.visible) { a.sol.setVisible(false); hiddenEngine.push(a.sol); } } }
  function showEngineSoldiers() { for (const s of hiddenEngine.splice(0)) { try { if (s.root.parent) s.setVisible(true); } catch { /* disposed */ } } }

  /* ---------- modes ---------- */
  function load(m) { if (R.m !== m) plan(m); hook(); R.active = true; }
  function start() {
    const m = R.m; R.tA = m.t0; R.tB = m.t1; R.beats = beatsFor(m, R.tA, R.tB);
    R.shots = buildShots(R.mode === 'preview' ? 'cine' : R.style);
    hideEngineSoldiers(); reset();
  }
  function stopAll() {
    if (R.mode === 'view' || R.mode === 'export') { try { closeViewer(true); } catch { /* already closed */ } }
    try { const B = E.breach; if (B && B.restoreLook) B.restoreLook(); } catch { /* the walls as the live world has them */ }
    R.active = false; R.mode = ''; R.targets = null; R.onFrame = null; fpsWant = 0; R.sound = false; R.fpOn = false;
    try { vm.group.visible = false; vm.cancelReload(); } catch { /* optional */ }
    for (const l of camLights()) l.intensity = 0;
    vmFxShow(true);       // the match's own casings and smoke, as they were
    for (const a of R.act) { if (a.sol) a.sol.setVisible(false); }
    try { fx.clear(); proj.clear(); } catch { /* optional */ }
    if (fxRoot.parent) fxRoot.parent.remove(fxRoot);
  }
  /** Drops everything (a match is loading, or another moment): soldiers disposed, engine soldiers shown again. */
  function release(keepHook) {
    stopAll(); disposeSoldiers(); R.act = []; R.queue = []; R.ready = false; R.m = null; R.b = null; showEngineSoldiers();
    if (!keepHook) { /* the wrapper stays: it does nothing while inactive */ }
  }

  /* ---------- the full-screen viewer ---------- */
  let ui = null, exportMod = null, exporter = null, flowTimer = 0, keyOff = null, lastFocus = null;
  const CSS = `
html.fzr-open #menu,html.fzr-open #fz-flow,html.fzr-open #hud{visibility:hidden!important}
.fzr-v{position:fixed;inset:0;z-index:40;font-family:${FONT};color:${C.sand};user-select:none;-webkit-user-select:none}
.fzr-v *{box-sizing:border-box}
.fzr-ov{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.fzr-bar{position:absolute;left:0;right:0;bottom:0;display:grid;gap:8px;padding:10px clamp(12px,2.4vw,36px) 14px;background:linear-gradient(0deg,rgba(5,6,4,.92),rgba(5,6,4,.7) 70%,transparent)}
.fzr-tl{position:relative;height:6px;background:rgba(236,226,198,.16);cursor:pointer}
.fzr-tl i{position:absolute;left:0;top:0;bottom:0;width:0;background:${C.amber}}
.fzr-tl b{position:absolute;top:-4px;width:3px;height:14px;margin-left:-1px;background:${C.white};box-shadow:0 0 0 1px rgba(0,0,0,.6)}
.fzr-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px}
.fzr-grp{display:flex;align-items:center;gap:0;border:1px solid rgba(236,226,198,.28)}
.fzr-lbl{font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${C.dim};margin-right:2px}
.fzr-b{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 14px;font:inherit;font-size:17px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.sand};background:rgba(10,12,8,.55);border:1px solid rgba(236,226,198,.3);cursor:pointer;white-space:nowrap}
.fzr-grp .fzr-b{border:0;border-right:1px solid rgba(236,226,198,.18)}
.fzr-grp .fzr-b:last-child{border-right:0}
.fzr-b:hover{background:rgba(201,185,143,.14);color:#fff}
.fzr-b[aria-pressed=true]{color:#181407;background:${C.amber}}
.fzr-b--main{color:#181407;background:linear-gradient(180deg,#ffc94f,#e8a628);border-color:${C.amber};clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)}
.fzr-b--main:hover{color:#181407;background:linear-gradient(180deg,#ffd46e,#f0ae2e)}
.fzr-b small{font-size:13px;font-weight:600;letter-spacing:.06em;opacity:.75;text-transform:none}
.fzr-b svg{width:18px;height:18px}
.fzr-sp{flex:1 1 auto}
.fzr-close{position:absolute;top:max(4px,calc(3.25vh - 20px));right:clamp(10px,1.6vw,24px);min-height:38px}
.fzr-chip{padding:4px 10px;font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.amber};border:1px solid rgba(240,174,46,.5);background:rgba(10,12,8,.6)}
@media (max-width:1440px){.fzr-lbl{display:none}}
@media (max-width:1360px){.fzr-b small{display:none}}
.fzr-chip[hidden]{display:none}
.fzr-v :focus-visible{outline:2px solid ${C.white};outline-offset:2px}
.fzr-x{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,6,4,.86)}
.fzr-x[hidden]{display:none}
.fzr-xp{display:grid;grid-template-columns:auto minmax(0,360px);gap:22px;align-items:center;max-width:960px;max-height:100%;padding:18px;border:1px solid rgba(236,226,198,.2);background:linear-gradient(180deg,rgba(28,32,26,.97),rgba(13,15,12,.97));clip-path:polygon(0 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%)}
.fzr-xs{display:flex;align-items:center;justify-content:center;background:#000;border:1px solid rgba(236,226,198,.18)}
.fzr-xs canvas,.fzr-xs video{display:block;max-width:min(60vw,560px);max-height:calc(100vh - 120px);width:auto;height:auto;background:#000}
.fzr-xi{display:grid;gap:10px;align-content:start}
.fzr-xi h3{margin:0;font-size:28px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:${C.white}}
.fzr-xi p{margin:0;font-size:17px;color:${C.sand}}
.fzr-xi .fzr-meta{font-size:15px;letter-spacing:.06em;color:${C.dim}}
.fzr-prog{height:6px;background:rgba(236,226,198,.16)}
.fzr-prog i{display:block;height:100%;width:0;background:${C.amber}}
.fzr-xi .fzr-row{gap:8px}
@media (max-width:760px){.fzr-xp{grid-template-columns:minmax(0,1fr)}.fzr-xs canvas,.fzr-xs video{max-width:100%;max-height:50vh}.fzr-b{min-height:36px;padding:0 10px;font-size:15px}.fzr-b small{display:none}.fzr-lbl{display:none}}
@media (prefers-reduced-motion:reduce){.fzr-v *{transition:none!important}}`;
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" fill="currentColor"/></svg>',
    restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 3.5v5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    wide: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const el = (tag, cls, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (attrs) for (const k of Object.keys(attrs)) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); } return e; };
  function btn(cls, fid, html, label, fn) { const b = el('button', 'fzr-b' + (cls ? ' ' + cls : ''), { type: 'button', 'data-fid': fid, html }); if (label) b.setAttribute('aria-label', label); b.addEventListener('click', e => { e.stopPropagation(); try { if (audio && audio.ui) audio.ui(); } catch { /* optional */ } fn(e); }); return b; }
  function buildUi() {
    if (!document.getElementById('fzr-view-style')) { const s = el('style'); s.id = 'fzr-view-style'; s.textContent = CSS; document.head.append(s); }
    const root = el('div', 'fzr-v', { id: 'fzr-view', role: 'dialog', 'aria-modal': 'true', 'aria-label': V('aria'), tabindex: '-1' });
    const ov = el('canvas', 'fzr-ov', { 'aria-hidden': 'true' });
    const bar = el('div', 'fzr-bar'), tl = el('div', 'fzr-tl', { 'data-fid': 'replay:timeline' }), tlFill = el('i'); tl.append(tlFill);
    const row = el('div', 'fzr-row');
    const playB = btn('', 'replay:play', ICON.pause, V('pause'), () => { R.paused = !R.paused; paintUi(); });
    const restartB = btn('', 'replay:restart', ICON.restart, V('restart'), () => { R.paused = false; if (R.ready) reset(); paintUi(); });
    const camG = el('div', 'fzr-grp', { role: 'group', 'aria-label': V('cam') });
    const camB = {}; for (const k of ['auto', 'fp', 'orbit']) { camB[k] = btn('', 'replay:cam:' + k, '', null, () => setStyle(k)); camG.append(camB[k]); }
    const momG = el('div', 'fzr-grp', { role: 'group' });
    const chip = el('span', 'fzr-chip', { hidden: '' });
    const pB = btn('fzr-b--main', 'replay:export:portrait', ICON.phone, null, () => doExport('portrait'));
    const lB = btn('', 'replay:export:landscape', ICON.wide, null, () => doExport('landscape'));
    const closeB = btn('fzr-close', 'replay:close', ICON.close, V('close'), () => closeViewer());
    closeB.append(el('span', '', { text: V('close') }));
    row.append(playB, restartB, el('span', 'fzr-lbl', { text: V('cam') }), camG, momG, el('span', 'fzr-sp'), chip, pB, lB);
    bar.append(tl, row);
    const x = el('div', 'fzr-x', { hidden: '', 'data-fid': 'replay:export-panel' });
    root.append(ov, bar, closeB, x);
    tl.addEventListener('click', e => { if (!R.ready) return; const r = tl.getBoundingClientRect(), k = clamp((e.clientX - r.left) / r.width, 0, 1); seek(R.tA + (R.tB - R.tA) * k); });
    ui = { root, ov, og: ov.getContext('2d'), bar, tl, tlFill, playB, restartB, camB, momG, chip, pB, lB, closeB, x, marks: [] };
    return ui;
  }
  function paintUi() {
    if (!ui) return;
    ui.playB.innerHTML = R.paused ? ICON.play : ICON.pause; ui.playB.setAttribute('aria-label', R.paused ? V('play') : V('pause'));
    for (const k of Object.keys(ui.camB)) { ui.camB[k].textContent = V(k); ui.camB[k].setAttribute('aria-pressed', String(R.style === k)); }
    const pref = (() => { try { return settings.get('gameplay.replayFormat') === 'landscape' ? 'landscape' : 'portrait'; } catch { return 'portrait'; } })();
    const lab = (b, k, icon) => { b.innerHTML = icon; const s = el('span', '', { text: V(k) }), sm2 = el('small', '', { text: V(k + 'Sub') }); b.append(s, sm2); };
    lab(ui.pB, 'portrait', ICON.phone); lab(ui.lB, 'landscape', ICON.wide);
    ui.pB.className = 'fzr-b' + (pref === 'portrait' ? ' fzr-b--main' : ''); ui.lB.className = 'fzr-b' + (pref === 'landscape' ? ' fzr-b--main' : '');
    if (pref === 'landscape' && ui.lB.nextSibling !== ui.pB) ui.pB.before(ui.lB);
    ui.momG.textContent = '';
    const ms = R.list || [];
    if (ms.length > 1) ms.forEach((m, i) => { const b = btn('', 'replay:moment:' + (i + 1), '', momentTitle(i18n, m), () => { if (m !== R.m) switchMoment(m); }); b.textContent = String(i + 1); b.setAttribute('aria-pressed', String(m === R.m)); b.title = momentTitle(i18n, m); ui.momG.append(b); });
    ui.momG.hidden = ms.length < 2;
    // kill marks on the timeline
    for (const mk of ui.marks) mk.remove(); ui.marks.length = 0;
    if (R.m) for (const k of R.m.kills) { if (k.t < R.tA || k.t > R.tB) continue; const b = el('b'); b.style.left = ((k.t - R.tA) / Math.max(0.01, R.tB - R.tA) * 100) + '%'; ui.tl.append(b); ui.marks.push(b); }
  }
  function setStyle(k) { R.style = k; if (R.ready && R.mode === 'view') { R.beats = beatsFor(R.m, R.tA, R.tB); R.shots = buildShots(k); R.shotI = -1; R.cut = true; } paintUi(); }
  function seek(t) { reset(); R.paused = false; const save = R.sound; R.sound = false; while (R.t < t - 1e-4) { const d = Math.min(0.05, t - R.t); fire(R.t, R.t + d); R.t += d; sampleAt(R.t); for (const a of R.act) syncSoldier(a, d, false); proj.update(d); fx.update(d); } R.sound = save; R.cut = true; R.shotI = -1; paintUi(); }
  function switchMoment(m) { const style = R.style; R.mode = ''; plan(m); R.style = style; R.mode = 'view'; R.sound = true; R.active = true; paintUi(); }
  function flowChip() {
    if (!ui) return;
    const fr = document.getElementById('fz-flow'), b = fr && !fr.hidden ? fr.querySelector('.fzf-clock b') : null, s = b ? parseInt(b.textContent, 10) : NaN;
    if (!Number.isFinite(s)) { ui.chip.hidden = true; return; }
    ui.chip.hidden = false; ui.chip.textContent = fr.querySelector('.fzf-vote') ? V('vote', { s }) : V('next', { s });
  }

  function openViewer(m, opts = {}) {
    if (!m || E.running || E.loading || !E.world || E.world.id !== m.map) return false;
    if (R.mode === 'export') return false;
    R.list = (opts.moments || [m]).filter(x => x && x.map === m.map);
    lastFocus = document.activeElement;
    load(m); R.mode = 'view'; R.sound = true; R.paused = false; R.aspect = 0; R.portrait = false; R.targets = null; R.onFrame = null; R.style = R.style === 'fp' || R.style === 'orbit' ? R.style : 'auto';
    if (R.ready) start();
    fpsWant = 60;
    if (!ui) buildUi();
    document.documentElement.classList.add('fzr-open');
    if (!ui.root.isConnected) document.body.append(ui.root);
    paintUi(); sizeOverlay();
    try { ui.playB.focus({ preventScroll: true }); } catch { /* optional */ }
    if (!keyOff) { const k = e => onKey(e); addEventListener('keydown', k, true); const r = () => sizeOverlay(); addEventListener('resize', r); keyOff = () => { removeEventListener('keydown', k, true); removeEventListener('resize', r); }; }
    clearInterval(flowTimer); flowTimer = setInterval(flowChip, 250); flowChip();
    drawLoop();
    if (opts.exportNow) setTimeout(() => doExport(opts.exportNow), 60);
    return true;
  }
  function onKey(e) {
    if (!ui || !ui.root.isConnected) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (exporter && exporter.busy) exporter.cancel(); else if (!ui.x.hidden) hidePanel(); else closeViewer(); return; }
    if ((e.key === ' ' || e.code === 'Space') && ui.x.hidden && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); e.stopImmediatePropagation(); R.paused = !R.paused; paintUi(); }
  }
  function sizeOverlay() { if (!ui) return; const dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr); if (ui.ov.width !== w || ui.ov.height !== h) { ui.ov.width = w; ui.ov.height = h; } ui.barH = (ui.bar.offsetHeight || 0) * dpr; }
  let raf = 0;
  function drawLoop() {
    cancelAnimationFrame(raf);
    const f = () => {
      if (!ui || !ui.root.isConnected) return;
      raf = requestAnimationFrame(f);
      if (R.panelPause && ui.x.hidden) { R.panelPause = false; R.paused = false; paintUi(); }
      const g = ui.og, W = ui.ov.width, H = ui.ov.height; g.clearRect(0, 0, W, H);
      if (R.mode === 'view' && R.ready) drawOverlay(g, W, H, { letterbox: true, controls: true, bottom: ui.barH || 0 });
      if (R.ready && R.tB > R.tA) ui.tlFill.style.width = ((R.t - R.tA) / (R.tB - R.tA) * 100).toFixed(2) + '%';
    };
    raf = requestAnimationFrame(f);
  }
  function closeViewer(fromStop) {
    if (exporter && exporter.busy) exporter.cancel(true);
    cancelAnimationFrame(raf); clearInterval(flowTimer);
    if (keyOff) { keyOff(); keyOff = null; }
    if (ui && ui.root.isConnected) ui.root.remove();
    if (ui) hidePanel();
    document.documentElement.classList.remove('fzr-open');
    try { const B = E.breach; if (B && B.restoreLook && !fromStop) B.restoreLook(); } catch { /* breached walls back to the live look */ }
    R.sound = false; R.aspect = 0; R.portrait = false;
    if (!fromStop) { R.mode = ''; R.active = false; fpsWant = 0; try { vm.group.visible = false; } catch { /* optional */ } if (fxRoot.parent) fxRoot.parent.remove(fxRoot); }
    try { if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true }); } catch { /* optional */ }
  }
  function hidePanel() { if (!ui) return; ui.x.hidden = true; ui.x.textContent = ''; if (exporter) exporter.dispose(); }

  /* ---------- export (replay-export.js) ---------- */
  async function doExport(format) {
    if (!R.m || (exporter && exporter.busy)) return;
    try { if (!exportMod) exportMod = await import('./replay-export.js'); } catch (e) { console.warn('[replay] export unavailable', e); return; }
    if (!exporter) exporter = exportMod.createExporter({ engine: E, audio, i18n, settings, menu, core });
    exporter.run(R.m, format, ui.x);
  }
  /** What the exporter drives: the clip plan, the render size, the frame callback, the overlay. */
  const core = {
    get R() { return R; }, V, drawOverlay, glCanvas, title: () => momentTitle(i18n, R.m), mapName,
    /** Clip for a video: [a, b] and slow-motion beats so that it plays in at most `max` seconds (the end card comes on top). */
    planClip(m, max) {
      let a = m.t0, b = m.t1; const ks = m.kills;
      const lastK = ks.length ? ks[ks.length - 1].t : m.objT || b;
      b = Math.min(b, lastK + 1.6);
      R.beats = beatsFor(m, a, b);
      const fit = () => realLen(a, b) <= max;
      if (!fit() && ks.length) a = Math.max(a, ks[0].t - 1.4);
      if (!fit() && R.beats.length > 1) { const best = ks.slice().sort((x, y) => (y.head - x.head) || (y.t - x.t))[0]; R.beats = beatsFor(m, a, b, best.t); }
      if (!fit()) a = Math.max(a, b - max * 0.8);
      while (!fit() && b - a > 2) a += 0.1;
      return { a, b, real: realLen(a, b) };
    },
    begin(m, format, clip, onFrame) {
      R.mode = 'export'; R.portrait = format === 'portrait'; R.sound = true; R.paused = false;
      R.tA = clip.a; R.tB = clip.b; R.shots = buildShots(R.style === 'fp' || R.style === 'orbit' ? R.style : 'auto');
      R.onFrame = onFrame; fpsWant = 30; reset();
    },
    end() {
      R.onFrame = null; R.portrait = false; R.aspect = 0; R.hold = 0;
      if (ui && ui.root.isConnected) { R.mode = 'view'; fpsWant = 60; R.tA = R.m.t0; R.tB = R.m.t1; R.beats = beatsFor(R.m, R.tA, R.tB); R.shots = buildShots(R.style); reset(); R.paused = true; R.panelPause = true; paintUi(); }       // still and silent behind the finished video
    },
    setAspect(a) { R.aspect = a; },
    get done() { return R.hold > 0; },
    get ready() { return R.ready; },
    get post() { return I.post || null; },
  };

  /** The player's name for the picture: none when the profile has none (the engine then calls the player "VOUS"). */
  function playerName() {
    const n = String((R.m && (R.m.name || (R.m.slots[0] && R.m.slots[0].name))) || '').trim();
    let you = ''; try { you = i18n.t('hud.you'); } catch { /* none */ }
    return !n || n === you || n === V('you') ? '' : n;
  }
  /* ---------- the overlay: one drawing for the viewer and the video ---------- */
  function logo(g, x, y, s, align) {
    g.save(); g.font = `800 ${Math.round(34 * s)}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left';
    try { g.letterSpacing = `${(2.4 * s).toFixed(1)}px`; } catch { /* older canvas */ }
    const w1 = g.measureText('FRONT ').width, w2 = g.measureText('ZÉRO').width, d = 30 * s, w = d + 10 * s + w1 + w2;
    let x0 = align === 'center' ? x - w / 2 : x;
    const cx = x0 + d / 2, cy = y; g.beginPath(); g.moveTo(cx, cy - d / 2); g.lineTo(cx + d / 2, cy); g.lineTo(cx, cy + d / 2); g.lineTo(cx - d / 2, cy); g.closePath();
    const gr = g.createLinearGradient(cx - d / 2, cy - d / 2, cx + d / 2, cy + d / 2); gr.addColorStop(0, '#ffcf6a'); gr.addColorStop(1, '#e39d22'); g.fillStyle = gr; g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 6 * s; g.fill();
    g.shadowBlur = 0; g.beginPath(); g.moveTo(cx, cy - d * 0.22); g.lineTo(cx + d * 0.22, cy); g.lineTo(cx, cy + d * 0.22); g.lineTo(cx - d * 0.22, cy); g.closePath(); g.fillStyle = '#1b1508'; g.fill();
    x0 += d + 10 * s; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8 * s; g.fillStyle = C.white; g.fillText('FRONT ', x0, cy + 1); g.fillStyle = C.amber; g.fillText('ZÉRO', x0 + w1, cy + 1);
    g.restore(); return w;
  }
  function text(g, s, x, y, size, color, weight = 700, align = 'left', spacing = 0, shadow = true) {
    g.font = `${weight} ${Math.round(size)}px ${FONT}`; g.textAlign = align; g.fillStyle = color;
    try { g.letterSpacing = spacing ? `${spacing.toFixed(1)}px` : '0px'; } catch { /* older canvas */ }
    if (shadow) { g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = size * 0.18; g.shadowOffsetY = size * 0.05; } else { g.shadowBlur = 0; g.shadowOffsetY = 0; }
    g.fillText(s, x, y); g.shadowBlur = 0; g.shadowOffsetY = 0;
    return g.measureText(s).width;
  }
  /**
   * opts: { letterbox, portrait, video (export frame), endK (0..1 end card), site (address), controls (viewer: room for the bar) }
   */
  function drawOverlay(g, W, H, o = {}) {
    if (!R.m) return;
    const s = Math.min(W, H) / 1080 * (o.portrait ? 1.5 : 1), red = reduced(), real = R.real, P = o.portrait;
    g.save(); g.textBaseline = 'alphabetic';
    // first-person aids: scope, hurt, crosshair, hit marker
    if (R.fpOn && R.scoped) {
      const r = Math.min(W, H) * 0.44, cx = W / 2, cy = H / 2;
      g.fillStyle = '#000'; g.beginPath(); g.rect(0, 0, W, H); g.arc(cx, cy, r, 0, TAU, true); g.fill('evenodd');
      g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = Math.max(1, 2 * s); g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.stroke();
      const rg = g.createRadialGradient(cx, cy, r * 0.82, cx, cy, r); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.7)'); g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    }
    const hurt = real - R.hurtAt; if (hurt < 0.6) { const k = 1 - hurt / 0.6, rg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); rg.addColorStop(0, 'rgba(160,20,10,0)'); rg.addColorStop(1, `rgba(160,20,10,${(0.55 * k).toFixed(3)})`); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
    if (R.fpOn && !R.scoped && R.act[0] && R.act[0].alive) {
      const cx = W / 2, cy = H / 2, gap = 5 * s, len = 7 * s; g.strokeStyle = 'rgba(255,255,255,.82)'; g.lineWidth = Math.max(1.5, 2 * s); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 2;
      g.beginPath(); g.moveTo(cx - gap - len, cy); g.lineTo(cx - gap, cy); g.moveTo(cx + gap, cy); g.lineTo(cx + gap + len, cy); g.moveTo(cx, cy - gap - len); g.lineTo(cx, cy - gap); g.moveTo(cx, cy + gap); g.lineTo(cx, cy + gap + len); g.stroke(); g.shadowBlur = 0;
      const ht = real - R.hitAt; if (ht < 0.22) { const k = 1 - ht / 0.22, a = 7 * s, b2 = 15 * s; g.strokeStyle = `rgba(255,255,255,${k.toFixed(3)})`; g.lineWidth = Math.max(2, 2.5 * s); g.beginPath(); for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { g.moveTo(cx + sx * a, cy + sy * a); g.lineTo(cx + sx * b2, cy + sy * b2); } g.stroke(); }
    }
    // letterbox (wide picture) or soft bands (phone picture), for the text
    const bar = o.letterbox && !P ? Math.round(H * 0.065) : 0;
    if (bar) { g.fillStyle = 'rgba(0,0,0,.9)'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar); }
    if (P && o.video) { let gr = g.createLinearGradient(0, 0, 0, H * 0.22); gr.addColorStop(0, 'rgba(0,0,0,.62)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.22); gr = g.createLinearGradient(0, H, 0, H * 0.74); gr.addColorStop(0, 'rgba(0,0,0,.66)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, H * 0.74, W, H * 0.26); }
    const pad = 28 * s, top = bar + pad;
    // logo and the moment's title
    const intro = R.real - R.introAt, introK = intro < 2.6 ? 1 : intro < 3.1 ? 1 - (intro - 2.6) / 0.5 : 0;
    if (o.video || o.controls) {
      if (P) { logo(g, W / 2, top + 18 * s, s * 1.05, 'center'); }
      else logo(g, pad, top + 18 * s, s, 'left');
      if (o.video && o.site && !P) text(g, o.site, pad + 2 * s, top + 60 * s, 17 * s, 'rgba(216,201,163,.8)', 600, 'left', 1);
      if (introK < 1) { g.globalAlpha = 1 - introK; const tt = momentTitle(i18n, R.m); if (P) text(g, tt, W / 2, top + 76 * s, 30 * s, C.amber, 800, 'center', 2); else text(g, tt, pad + 2 * s, top + (o.video && o.site ? 92 : 64) * s, 24 * s, C.amber, 800, 'left', 2); g.globalAlpha = 1; }
    }
    // kill feed
    const fx0 = P ? W - pad : W - pad, fy0 = P ? top + 120 * s : top + 14 * s, fs = (P ? 26 : 22) * s;
    let fy = fy0;
    for (let i = 0; i < R.feed.length; i++) {
      const e = R.feed[i], age = real - e.at; if (age > 5) continue;
      const a = age < 0.15 ? age / 0.15 : age > 4.5 ? 1 - (age - 4.5) / 0.5 : 1; g.globalAlpha = clamp(a, 0, 1);
      try { g.letterSpacing = '0px'; } catch { /* older canvas */ }
      let ww = 0; if (e.w) { g.font = `600 ${Math.round(fs * 0.78)}px ${FONT}`; ww = g.measureText(e.w).width; }
      g.font = `700 ${Math.round(fs)}px ${FONT}`; const wv = g.measureText(e.v).width, wk = e.k ? g.measureText(e.k).width : 0;
      const hw = e.head ? fs * 0.95 : 0, gap = fs * 0.45, total = wk + gap + ww + (hw ? gap + hw : 0) + gap + wv + fs * 0.9, x0 = fx0 - total, h = fs * 1.45;
      g.fillStyle = e.mine ? 'rgba(52,38,10,.78)' : 'rgba(8,10,7,.66)'; g.fillRect(x0, fy, total, h); if (e.mine) { g.fillStyle = C.amber; g.fillRect(x0, fy, 3 * s, h); }
      let x = x0 + fs * 0.45; const yb = fy + h * 0.72;
      if (e.k) { text(g, e.k, x, yb, fs, e.kc, 700, 'left', 0, false); x += wk + gap; }
      if (e.w) { text(g, e.w, x, yb - fs * 0.02, fs * 0.78, C.dim, 600, 'left', 0, false); x += ww + gap; }
      if (e.head) { const cx = x + hw / 2, cy = fy + h / 2, r = fs * 0.36; g.strokeStyle = C.amber; g.lineWidth = Math.max(1.5, 2 * s); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.moveTo(cx - r * 1.45, cy); g.lineTo(cx + r * 1.45, cy); g.moveTo(cx, cy - r * 1.45); g.lineTo(cx, cy + r * 1.45); g.stroke(); x += hw + gap; }
      text(g, e.v, x, yb, fs, e.vc, 700, 'left', 0, false);
      fy += h + 5 * s;
    }
    g.globalAlpha = 1;
    // multi-kill stamp
    const ma = real - R.multi.at;
    if (R.multi.n >= 2 && ma < 1.6) {
      const k = ma < 0.12 ? ma / 0.12 : ma > 1.25 ? 1 - (ma - 1.25) / 0.35 : 1, pop = red ? 1 : 1 + 0.35 * Math.max(0, 1 - ma / 0.18);
      const cx = W / 2, cy = P ? H * 0.34 : H * 0.3;
      g.globalAlpha = clamp(k, 0, 1); g.save(); g.translate(cx, cy); g.scale(pop, pop);
      text(g, '×' + R.multi.n, 0, 0, 92 * s, C.amber, 800, 'center', 2);
      text(g, R.multi.label, 0, 40 * s, 30 * s, C.white, 800, 'center', 5);
      g.restore(); g.globalAlpha = 1;
    } else if (R.multi.n === 1 && ma < 1.1 && R.multi.label) {
      const k = ma < 0.1 ? ma / 0.1 : ma > 0.8 ? 1 - (ma - 0.8) / 0.3 : 1; g.globalAlpha = clamp(k, 0, 1);
      text(g, R.multi.label, W / 2, P ? H * 0.36 : H * 0.32, 34 * s, C.white, 800, 'center', 5); g.globalAlpha = 1;
    }
    const bt = real - R.banner.at; if (bt < 2.2 && R.banner.text) { g.globalAlpha = clamp(bt < 0.15 ? bt / 0.15 : bt > 1.8 ? 1 - (bt - 1.8) / 0.4 : 1, 0, 1); text(g, R.banner.text, W / 2, P ? H * 0.42 : H * 0.4, 32 * s, C.amber2, 800, 'center', 4); g.globalAlpha = 1; }
    // intro: the moment, the player, the map
    const who = [playerName(), mapName(R.m.map)].filter(Boolean).join(' · ');
    if (introK > 0 && (o.video || o.controls)) {
      g.globalAlpha = introK;
      const yb = P ? H * 0.71 : H - Math.max(bar, o.bottom || 0) - pad - 18 * s, x = P ? W / 2 : pad, al = P ? 'center' : 'left';
      text(g, tr(i18n, 'card'), x, yb - 66 * s, 20 * s, C.amber, 700, al, 5);
      text(g, momentTitle(i18n, R.m), x, yb - 22 * s, (P ? 54 : 50) * s, C.white, 800, al, 1.5);
      text(g, who, x, yb + 14 * s, 24 * s, C.sand, 600, al, 1.5);
      g.globalAlpha = 1;
    } else if (o.video) {
      const x = P ? W / 2 : pad, al = P ? 'center' : 'left', yb = P ? H - 150 * s : H - bar - pad;
      text(g, who, x, yb, 22 * s, C.sand, 600, al, 1.5);
    }
    // end card (video only)
    if (o.endK > 0) {
      const k = clamp(o.endK, 0, 1); g.fillStyle = `rgba(8,9,6,${(0.86 * k).toFixed(3)})`; g.fillRect(0, 0, W, H); g.globalAlpha = k;
      const cy = H * (P ? 0.42 : 0.4); logo(g, W / 2, cy - 70 * s, s * (P ? 1.9 : 1.7), 'center');
      text(g, momentTitle(i18n, R.m), W / 2, cy + 20 * s, 34 * s, C.white, 800, 'center', 2);
      text(g, V('tagline'), W / 2, cy + 62 * s, 22 * s, C.sand, 600, 'center', 1);
      text(g, V('play2'), W / 2, cy + (P ? 150 : 128) * s, 26 * s, C.sand, 700, 'center', 3);
      if (o.site) text(g, o.site, W / 2, cy + (P ? 196 : 170) * s, (P ? 30 : 34) * s, C.amber, 800, 'center', 1);
      g.globalAlpha = 1;
    }
    g.restore();
  }

  /* ---------- public ---------- */
  const api = {
    get viewing() { return R.mode === 'view' || R.mode === 'export'; },
    /** Card preview: the moment plays with the cinematic camera, each frame is copied into the card canvases. */
    preview(m, targets) {
      if (R.mode === 'view' || R.mode === 'export') return;
      const same = R.m === m && R.mode === 'preview';
      if (!same) { load(m); R.mode = 'preview'; R.sound = false; R.aspect = 0; R.portrait = false; if (R.ready) start(); }
      const old = R.targets || []; R.targets = targets.map(t => { const o = old.find(x => x.canvas === t.canvas); return o || { canvas: t.canvas, onLive: t.onLive, live: false, g: null }; });
      let q = 0; try { q = E.perf ? E.perf.qLevel : 0; } catch { /* default */ }
      fpsWant = q <= 1 ? 24 : 15;
    },
    stopPreview() { if (R.mode === 'preview') { R.targets = null; R.mode = ''; R.active = false; fpsWant = 0; for (const a of R.act) if (a.sol) a.sol.setVisible(false); try { fx.clear(); proj.clear(); } catch { /* optional */ } if (fxRoot.parent) fxRoot.parent.remove(fxRoot); } },
    open: openViewer, close: () => closeViewer(), release,
    core,
    /** Tests and tools: jump to a match time, choose a camera, pause. */
    seek(t) { if (R.ready && R.mode === 'view') seek(clamp(t, R.tA, R.tB)); },
    setStyle, pause(v) { R.paused = !!v; paintUi(); },
    /** Tests: state of the replay. */
    debug() {
      const vis = R.act.filter(a => a.sol && a.sol.root.visible).length;
      const nan = R.act.some(a => !(Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z))) || !Number.isFinite(camera.position.x + camera.position.y + camera.position.z);
      return { mode: R.mode, ready: R.ready, t: R.t, tA: R.tA, tB: R.tB, style: R.style, shot: R.shots[R.shotI] ? R.shots[R.shotI].type : null, fp: R.fpOn, scoped: R.scoped, visible: vis, actors: R.act.length, soldiers: R.act.reduce((n, a) => n + a.sols.size, 0), dead: R.act.filter(a => a.dead).length, feed: R.feed.length, multi: R.multi.n, nan, cam: [camera.position.x, camera.position.y, camera.position.z].map(v => +v.toFixed(2)), fov: +camera.fov.toFixed(1), fps: fpsWant, outfits: R.act.filter(a => a.sol && a.sol.outfit).length, beats: R.beats.length, shots: R.shots.map(s => s.type).join(','), rate: +rateAt(R.t).toFixed(2), vmFx: vmWorld().length };
    },
    state: R,
  };
  return api;
}
