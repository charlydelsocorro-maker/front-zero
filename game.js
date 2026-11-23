// FRONT ZÉRO — game engine (CONTRACT.md "Engine API"). Owns rendering, world, input, player physics,
// shooting, actors, bot AI + navigation, HUD and audio hookup. Modes own rules; menus own everything else.
import * as THREE from 'three';
import { WEAPONS, ALL_WEAPONS, OUTFITS, CLASSES, byId } from './data.js';
import { createWorld } from './maps.js';
import { createViewModel } from './guns.js';
import { createSoldier } from './soldier.js';
import { createGrid, createMover } from './engine-grid.js';
import { createNav } from './engine-nav.js';
import { createFx, createPost } from './engine-fx.js';
import { createHud, makeT } from './engine-hud.js';
import { createAI, newBotAI, newZombieAI, ZOMBIES } from './engine-ai.js';
import { createProjectiles, rocketTable } from './engine-projectiles.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2, wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const RUN = 7.5, SPRINT = 1.24, GRAV = 23, JUMP = 8.1, H_STAND = 1.75, H_LOW = 1.15;
const PAL_TEAM = [[0x4c5238, 0x2a2e22, 0x7c7a5c], [0x7d5a3c, 0x3b2a20, 0x9c7c58]];
const PAL_FFA = [[0x6a6a4e, 0x41452f, 0x8a8160], [0x74777a, 0x45484b, 0xa1a3a3], [0x59633e, 0x3a4429, 0x7b7650], [0x8e7a51, 0x6b5a3a, 0xb9a678], [0x2e3540, 0x1c2026, 0x4a5462], [0x6b3a2a, 0x2a211c, 0xb5441f]];
const SURF_COL = { sand: 0x9a8a68, concrete: 0x8a8880, metal: 0xc8b48a, wood: 0x7a5c3a, snow: 0xe8eef4 };
const QL = [[1, 1, 1], [0.85, 1, 1], [0.72, 0, 2], [0.6, 0, 2], [0.5, 0, 3]];
const CALL = ['Corbeau', 'Mirage', 'Kilo', 'Tango', 'Renard', 'Sierra', 'Écho', 'Bravo', 'Loup', 'Roméo', 'Vautour', 'Orage'];
const W = id => byId(WEAPONS, id) || byId(WEAPONS, 'ar') || WEAPONS[0];
const WA = id => byId(ALL_WEAPONS, id) || W(id);      // network lookups: another client may carry a weapon this page has not unlocked
const newSlot = d => ({ def: d, ammo: d.mag, res: d.reserve === undefined ? -1 : d.reserve });      // res -1 = unlimited spare rounds

let modesPromise = null;
const loadModes = () => modesPromise || (modesPromise = import('./modes.js').then(m => (typeof m.createMode === 'function' ? m.createMode : null)).catch(e => { console.warn('[engine] modes.js unavailable, built-in FFA will be used:', e && e.message); return null; }));

export function createEngine(opts) {
  const { canvas, hudRoot, settings, i18n, profile, audio } = opts;
  const t = makeT(i18n);
  /* ---------- renderer / scene ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(84, 1, 0.05, 260); scene.add(camera);
  const vmLights = [];
  const world = createWorld(scene, renderer), vm = createViewModel(camera, scene), fx = createFx(scene), post = createPost(renderer, scene, camera);
  // guns.js parents its muzzle light under the viewmodel group, which is hidden when scoped/dead/spectating: every toggle changes the
  // light count and makes three.js rebuild all lit programs (a ~1 s hitch). Keep the light on the camera so the count never changes.
  vm.group.traverse(o => { if (o.isPointLight) vmLights.push(o); }); for (const l of vmLights) { camera.add(l); l.position.set(0.12, -0.08, -0.75); }
  // Weapon light: one spot light on the camera, in the scene from the start with intensity 0 when off, so the light count never changes (no shader rebuild on toggle).
  // It sits ahead of the weapon (so the viewmodel is not washed out) and slides back to the eye near a wall (a light without shadows must not end up behind the surface it lights).
  const TORCH_I = 85, torch = new THREE.SpotLight(0xfff0d6, 0, 38, THREE.MathUtils.degToRad(16), 0.55, 1.25);
  torch.castShadow = false; torch.position.set(0.1, -0.1, -0.75); torch.target.position.set(0.02, -0.02, -9); camera.add(torch); camera.add(torch.target);
  const grid = createGrid(4), mover = createMover(grid), nav = createNav(grid);
  let groundSurf = 'concrete', sun = null, teamSp = [[], []];

  /* ---------- events ---------- */
  const subs = new Map();
  const emit = (evt, arg) => { const s = subs.get(evt); if (!s) return; for (const fn of s) { try { fn(arg); } catch (e) { console.error(`[engine] "${evt}" listener`, e); } } };
  const evShot = { actor: null, weaponId: '' }, evDamage = { attacker: null, victim: null, amount: 0, head: false };

  /* ---------- state ---------- */
  const rules = { friendlyFire: false, autoRespawn: true, respawnDelay: 3, regen: true, playerLoadout: true, frozen: false, killFeed: true };
  const actors = [], held = Object.create(null), keyTurn = { l: false, r: false, u: false, d: false };
  const budget = { path: 1, cover: 1 }, stats = { unstuck: 0 };
  let cfg = null, mode = null, online = false, net = null, netOff = [], netT = 0, myId = 'player';
  let running = false, paused = false, menuOpen = false, loading = false, earned = 0, idSeq = 0, botSeq = 0;
  let loadP = null, solQ = null;   // chunked loading (see startMatch)
  let vw = 1280, vh = 720;   // cached viewport: reading layout sizes every frame forces a reflow whenever the HUD changed
  let locked = false, noLock = false, tipUntil = 0, mouseIn = false, mx0 = 0, my0 = 0, muted = false, focused = true;
  let specTarget = null, specDist = 3.4;

  function makeActor(o) {
    const pos = new THREE.Vector3();
    return { id: o.id, name: o.name || '', kind: o.kind || 'soldier', team: o.team ?? null, pos, yaw: 0, pitch: 0, hp: o.hp || 100, maxHp: o.hp || 100, armor: 0, maxArmor: 0, alive: false,
      isPlayer: !!o.isPlayer, isRemote: !!o.isRemote, weaponId: o.weaponId || 'ar', kills: 0, deaths: 0, data: {}, ai: null,
      vx: 0, vz: 0, wishX: 0, wishZ: 0, wishSpeed: 0, yawT: 0, crouch: 0, crouchT: 0, speed: 4.7, bump: false, hScale: 1, rScale: 1,
      body: { pos, r: 0.32, h: H_STAND, vy: 0, grounded: true, ground: null, stepOff: 0, ceil: false },
      sol: null, wdef: W(o.weaponId || 'ar'), respawnT: -1, respawnAt: null, cols: [], regenT: 0, stepD: 0, lodAcc: 0, lodN: 0, tag: null, shotT: 0, px: 0, pz: 0, zType: o.zType || null, pal: null, shadow: true, ghost: false, kx: 0, kz: 0, ragT: 0 };
  }
  const player = makeActor({ id: 'player', name: '', isPlayer: true }); player.body.r = 0.38; actors.push(player);
  const P = { v: new THREE.Vector3(), slide: 0, slideCd: 0, ws: [], cur: 0, reload: 0, next: 0, ads: 0, eye: 1.62, kick: 0, bob: 0, cls: CLASSES[0], rc: 0, fired: false, sprint: false, sprinting: false, crouched: false, stepD: 0, dryT: -9, hintS: -1, outfit: OUTFITS[0], aim: false, yawPrev: 0, pitchPrev: 0, vmBlock: 0, land: 0, gear: null, burstN: 0, spin: 0, shake: 0, torch: false, torchK: 0 };
  const wNow = () => P.ws[P.cur];

  /* ---------- HUD ---------- */
  const hud = createHud(hudRoot, { settings, i18n, onResume: () => { setPause(false); lock(); }, onQuit: () => E.quit() });
  hud.show(false);

  /* ---------- world / map ---------- */
  function loadMap(id) {
    if (world.id !== id) {
      for (const a of actors) if (a.sol) { a.sol.dispose(); a.sol = null; }
      world.load(id);
      grid.build(world.solids); nav.build(world.size, world.spawns, id); mapReady();
    }
    fx.clear(); proj.clear();
  }
  /** Everything derived from a freshly built world (shared by the synchronous loadMap and the chunked loader). */
  function mapReady() {
      hud.setMap(world.solids, world.size);
      groundSurf = world.surfaceAt(0, -100, 0);
      sun = null; scene.traverse(o => { if (o.isDirectionalLight && !sun) sun = o; });
      const s = world.size, lo = [], hi = []; let vx = 0, vz = 0;
      for (const p of world.spawns) { vx += p[0] * p[0]; vz += p[1] * p[1]; }
      const ax = vx >= vz ? 0 : 1;
      for (const p of world.spawns) { if (p[ax] < -0.35 * s) lo.push(p); else if (p[ax] > 0.35 * s) hi.push(p); }
      if (lo.length < 2 || hi.length < 2) { const sorted = [...world.spawns].sort((a, b) => a[ax] - b[ax]), n = Math.max(1, Math.floor(sorted.length * 0.4)); teamSp = [sorted.slice(0, n), sorted.slice(-n)]; } else teamSp = [lo, hi];
      try { audio.setEnvironment(world.env); } catch { /* audio is optional */ }
      applyGraphics();
  }
  const surfaceOf = b => (b.ground ? b.ground.surface : groundSurf) || groundSurf;

  /* ---------- actors ---------- */
  const isEnemy = (a, b) => { if (!a || !b || a === b || a.ghost || b.ghost) return false; const za = a.kind === 'zombie', zb = b.kind === 'zombie'; if (za || zb) return za !== zb; return a.team === null || b.team === null || a.team !== b.team; };
  const actorById = id => { if (id === myId || id === 'player') return player; for (let i = 0; i < actors.length; i++) if (actors[i].id === id) return actors[i]; return null; };
  function buildSoldier(a) {
    if (a.isPlayer) return;
    if (a.sol) { a.sol.dispose(); a.sol = null; }
    if (!world.id) return;
    if (solQ) { if (solQ.indexOf(a) < 0) solQ.push(a); return; }       // loading: the loader builds them one per slice
    a.pal = a.kind === 'zombie' ? null : a.team === 0 || a.team === 1 ? PAL_TEAM[a.team] : PAL_FFA[Math.abs(a.palI | 0) % PAL_FFA.length];
    a.sol = createSoldier(scene, { palette: a.pal || undefined, weaponId: a.weaponId, kind: a.kind, zombieType: a.zType || undefined });
    a.sol.root.position.copy(a.pos); a.shadow = true;
  }
  function place(a, at) {
    let x = at[0], z = at[1], y = at.length > 2 ? at[2] : 0;
    if (mover.blocked(x, y, z, a.body.r, a.body.h)) { const q = nav.nearest(x, z); x = q[0]; z = q[1]; y = 0; }
    a.pos.set(x, y, z); a.body.vy = 0; a.body.grounded = true; a.body.ground = null; a.body.stepOff = 0; a.vx = a.vz = 0; a.wishX = a.wishZ = 0; a.px = x; a.pz = z;
    a.yaw = a.yawT = faceOpen(x, y, z, Math.atan2(x, z)); a.pitch = 0;
  }
  /** Spawn facing: toward the map centre unless a wall stands right there, then the most open of 16 directions (nearest to the centre on ties). */
  function faceOpen(x, y, z, yaw) {
    const ey = y + 1.5; if (grid.ray(x, ey, z, -Math.sin(yaw), 0, -Math.cos(yaw), 8) >= 8) return yaw;
    let best = yaw, bs = -1e9;
    for (let k = 0; k < 16; k++) { const a = yaw + k * Math.PI / 8, d = grid.ray(x, ey, z, -Math.sin(a), 0, -Math.cos(a), 30) - Math.abs(wrap(a - yaw)) * 1.5; if (d > bs) { bs = d; best = a; } }
    return wrap(best);
  }
  function spawnsFor(team) { return (team === 0 || team === 1) && teamSp[team].length ? teamSp[team] : world.spawns; }
  function safeSpawn(o) {
    const team = o ? o.team : undefined, list = spawnsFor(team), avoid = o && Array.isArray(o.avoid) && o.avoid.length ? o.avoid : null;
    if (!list.length) return [0, 0];
    let best = list[0], bs = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const s = list[i]; let d = 60;
      if (avoid) for (const q of avoid) { const p = q && q.pos ? q.pos : q; if (!p) continue; const px = Array.isArray(p) ? p[0] : p.x, pz = Array.isArray(p) ? p[1] : p.z; d = Math.min(d, Math.hypot(s[0] - px, s[1] - pz)); }
      for (let k = 0; k < actors.length; k++) { const b = actors[k]; if (!b.alive) continue; const q = Math.hypot(s[0] - b.pos.x, s[1] - b.pos.z); if (q < 2.5) d -= 40; else if (!avoid && (team === undefined || team === null || b.team !== team || b.kind === 'zombie')) d = Math.min(d, q); }
      d += rnd(0, 9); if (d > bs) { bs = d; best = s; }
    }
    return nav.nearest(best[0] + rnd(-1.3, 1.3), best[1] + rnd(-1.3, 1.3));
  }
  function addActor(a, at) {
    actors.push(a); buildSoldier(a); a.alive = true; a.hp = a.maxHp;
    place(a, at || safeSpawn({ team: a.team })); if (a.sol) { a.sol.root.position.copy(a.pos); solSt.vx = solSt.vz = 0; solSt.yaw = a.yaw; solSt.aimPitch = 0; solSt.grounded = true; solSt.crouch = 0; a.sol.update(0, solSt); a.sol.respawn(); }
    emit('spawn', { actor: a }); return a;
  }
  function removeActor(a) {
    if (!a || a === player) return; const i = actors.indexOf(a); if (i >= 0) actors.splice(i, 1);
    if (a.sol) { a.sol.dispose(); a.sol = null; } if (a.tag) { hud.api.marker('_t' + a.id, null); a.tag = null; } a.alive = false; if (specTarget === a) specTarget = null;
  }
  function setTeam(a, team) { if (!a || a.team === team) return; a.team = team ?? null; if (!a.isPlayer && a.kind !== 'zombie') { const dead = !a.alive; buildSoldier(a); if (dead && a.sol) a.sol.setVisible(false); } }
  function setWeapon(a, id) { if (a.weaponId === id || !byId(WEAPONS, id)) return; a.weaponId = id; a.wdef = W(id); if (a.ai && !a.ai.zombie) a.ai.ammo = a.wdef.mag; const dead = !a.alive; buildSoldier(a); if (dead && a.sol) a.sol.setVisible(false); }

  function respawn(a, o) {
    if (!a) return; const delay = (o && o.delay) || 0;
    if (delay > 0) { a.respawnT = delay; a.respawnAt = (o && o.at) || null; return; }
    if (a.isPlayer) playerLoadout();
    place(a, (o && o.at) || safeSpawn({ team: a.team }));
    a.kx = a.kz = 0; a.hp = a.maxHp; a.armor = a.maxArmor; a.alive = true; a.respawnT = -1; a.respawnAt = null; a.crouch = a.crouchT = 0; a.regenT = 0;
    if (a.ai) { const ai = a.ai; ai.path = null; ai.target = null; ai.visible = false; ai.repath = 0; ai.stuck = 0; ai.arrived = false; if (!ai.zombie) { ai.ammo = a.wdef.mag; ai.reloadT = 0; ai.coverOn = false; ai.lostT = 9; ai.huntT = 0; ai.refill = true; } else { ai.wind = 0; } }
    if (a.sol) { a.sol.root.position.copy(a.pos); solSt.vx = solSt.vz = 0; solSt.yaw = a.yaw; solSt.aimPitch = 0; solSt.grounded = true; solSt.crouch = 0; a.sol.setVisible(true); a.sol.update(0, solSt); a.sol.respawn(); }
    if (a.isPlayer) { P.v.set(0, 0, 0); P.slide = 0; P.reload = 0; P.ads = 0; P.rc = 0; P.kick = 0; P.sprint = false; P.eye = 1.62; a.body.h = H_STAND; P.hintS = -1; hud.hint(null); hud.spectate(null); specTarget = null; vm.cancelReload(); for (const w of P.ws) { w.ammo = w.def.mag; w.res = w.def.reserve === undefined ? -1 : w.def.reserve; } if (P.gear) { P.gear.n = P.gear.def.mag + (P.gear.def.reserve || 0); P.gear.next = 0; } P.burstN = 0; P.spin = 0; P.shake = 0; P.next = Math.min(P.next, E.time + 0.2); P.yawPrev = a.yaw; P.pitchPrev = 0; }      // P.next: E.time restarts at 0 with each match, a stale value would block the trigger
    emit('spawn', { actor: a });
  }
  function heal(a, amount) { if (a && a.alive && amount > 0) a.hp = Math.min(a.maxHp, a.hp + amount); }

  function feedback(a, by, amount, head, dx, dz) {
    if (dx === undefined || (dx === 0 && dz === 0)) { if (by) { dx = a.pos.x - by.pos.x; dz = a.pos.z - by.pos.z; } else { dx = 0; dz = 0; } }
    if (a.sol && a.alive) a.sol.hit(dx, dz, head);
    if (a.ai && by) ai.alert(a, by);
    if (a.isPlayer) {
      try { audio.hurt(); } catch { /* optional */ }
      let rel = null; if (by && by !== a) { const vx = by.pos.x - a.pos.x, vz = by.pos.z - a.pos.z, sn = Math.sin(a.yaw), cs = Math.cos(a.yaw); rel = Math.atan2(vx * cs - vz * sn, -vx * sn - vz * cs); }
      hud.hurt(rel); a.regenT = P.cls.regen || 5;
    }
    if (by === player && a !== player) { hud.hitMarker(head); try { audio.hit(head); } catch { /* optional */ } hud.damageNumber(vw / 2 + rnd(-24, 24), vh / 2 - 30, amount, head); }
  }
  function emitDamage(by, a, amount, head) { evDamage.attacker = by; evDamage.victim = a; evDamage.amount = amount; evDamage.head = head; emit('damage', evDamage); }
  function damage(a, amount, o) {
    if (!a || !a.alive || a.ghost || !(amount > 0)) return false;
    const by = (o && o.by) || null, head = !!(o && o.head);
    if (by && by !== a && !rules.friendlyFire && !isEnemy(by, a)) return false;
    if (online && (a.isPlayer || (a.isRemote && a.kind !== 'zombie'))) { emitDamage(by, a, amount, head); return false; }   // the server referees players
    let dm = amount; if (a.armor > 0) { const ab = Math.min(a.armor, dm * 0.6); a.armor -= ab; dm -= ab; }
    a.hp -= dm; if (!a.isPlayer) a.regenT = 6;
    const dir = o && o.dir; feedback(a, by, amount, head, dir ? (dir.x ?? dir[0]) : undefined, dir ? (dir.z ?? dir[1]) : undefined);
    emitDamage(by, a, amount, head);
    if (a.hp <= 0) { kill(a, o); return true; }
    return false;
  }
  function kill(a, o) {
    if (!a || !a.alive) return;
    const by = (o && o.by) || null, head = !!(o && o.head), weaponId = (o && o.weaponId) || (by ? by.weaponId : null);
    a.alive = false; a.hp = 0; a.deaths++; if (by && by !== a) by.kills++;
    let dx = 0, dz = 0; const dir = o && o.dir; if (dir) { dx = dir.x ?? dir[0] ?? 0; dz = dir.z ?? dir[1] ?? 0; } else if (by && by !== a) { dx = a.pos.x - by.pos.x; dz = a.pos.z - by.pos.z; }
    if (a.sol) { grid.gather(a.pos.x, a.pos.y + 1, a.pos.z, 3.2, a.cols); a.sol.setColliders(a.cols); a.sol.die(dx, dz, head, o && o.force > 0 ? o.force : weaponId === 'sg' || weaponId === 'sr' ? 2 : by && by.kind === 'zombie' ? 1.3 : 1);
      const bl = isBlastKill(o, weaponId) ? nearBlast(a) : null;
      if (bl) a.sol.blast(bl.x, bl.y, bl.z, bl.r, 1); else if (hitInfo.on && hitInfo.v === a) a.sol.shove(hitInfo.x, hitInfo.y, hitInfo.z, hitInfo.dx, hitInfo.dy, hitInfo.dz, hitInfo.power);
      a.ragT = 0; }
    a.vx = a.vz = 0; a.kx = a.kz = 0; a.wishX = a.wishZ = 0;
    if (a.tag) { hud.api.marker('_t' + a.id, null); a.tag = null; }
    if (a.isPlayer) { P.slide = 0; P.reload = 0; vm.cancelReload(); P.hintS = -1; if (!rules.autoRespawn) hud.hint(null); }
    if (rules.autoRespawn && !(online && (a.isPlayer || a.isRemote))) a.respawnT = rules.respawnDelay;
    if (rules.killFeed !== false && a.kind !== 'zombie') hud.feedKill(by && by !== a ? (by === player ? t('hud.you') : by.name) : '', a === player ? t('hud.you') : a.name, head, by === player, a === player);
    if (by === player && a !== player) { try { audio.kill(); } catch { /* optional */ } hud.api.message(head ? t('hud.headshot') : t('hud.eliminated'), { kind: 'info', dur: 1.1 }); }
    emit('kill', { killer: by, victim: a, weaponId, head });
  }

  /* ---------- physical hits: where a bullet landed, and the last blasts (a body killed by one flies from its centre) ---------- */
  const hitInfo = { on: false, v: null, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 1, power: 0 }, ragC = { x: 0, y: 0, z: 0 };
  const blasts = []; for (let i = 0; i < 6; i++) blasts.push({ x: 0, y: 0, z: 0, r: 0, t: -99 }); let blastI = 0, rkT = null;
  const shotPower = def => clamp(1.4 + def.dmg * (def.pellets || 1) / 28, 1.6, 6.5);
  const rocketT = f => rkT || (rkT = rocketTable(f));
  function isBlastKill(o, weaponId) { if (o && o.blast) return true; const d = weaponId ? byId(ALL_WEAPONS, weaponId) : null; return !!(d && d.proj && d.proj.radius > 0); }
  function nearBlast(a) {
    let best = null;
    for (let i = 0; i < blasts.length; i++) { const b = blasts[i], age = E.time - b.t; if (age < 0 || age > 1.6 || (best && b.t < best.t)) continue; const dx = a.pos.x - b.x, dz = a.pos.z - b.z, rr = b.r + 3; if (dx * dx + dz * dz < rr * rr) best = b; }
    return best;
  }
  /* ---------- shooting ---------- */
  const hbH = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 }, hbB = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 };
  let hitT = 0, hitHead = false, shotVictim = null, shotDmg = 0, shotHead = false;
  function hitActors(shooter, ox, oy, oz, dx, dy, dz, tMax) {
    let best = null; hitT = tMax; hitHead = false;
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i]; if (a === shooter || !a.alive || a.ghost) continue;
      const hs = a.hScale, px = a.pos.x - ox, py = a.pos.y + 0.9 * hs - oy, pz = a.pos.z - oz, along = px * dx + py * dy + pz * dz;
      if (along < -1.2 || along > hitT + 1.2) continue;
      const cx = px - dx * along, cy = py - dy * along, cz = pz - dz * along; if (cx * cx + cy * cy + cz * cz > 1.7 * hs * hs) continue;
      const ch = a.crouch > 0.5 ? 0.72 : 1, rs = a.rScale, x = a.pos.x, y = a.pos.y, z = a.pos.z, neck = 1.42 * hs * ch, top = 1.82 * hs * ch;
      hbH.x0 = x - 0.2 * rs; hbH.x1 = x + 0.2 * rs; hbH.y0 = y + neck; hbH.y1 = y + top; hbH.z0 = z - 0.2 * rs; hbH.z1 = z + 0.2 * rs;
      hbB.x0 = x - 0.34 * rs; hbB.x1 = x + 0.34 * rs; hbB.y0 = y; hbB.y1 = y + neck; hbB.z0 = z - 0.34 * rs; hbB.z1 = z + 0.34 * rs;
      const q = grid.rayBox(ox, oy, oz, dx, dy, dz, hbH), w = grid.rayBox(ox, oy, oz, dx, dy, dz, hbB);
      if (q < hitT) { hitT = q; best = a; hitHead = true; }
      if (w < hitT) { hitT = w; best = a; hitHead = false; }
    }
    return best;
  }
  /** One hitscan ray: tracer, impact, whizz. Leaves the victim in shotVictim/shotDmg/shotHead (damage not applied). */
  function shootRay(shooter, ox, oy, oz, dx, dy, dz, def, mul, mx, my, mz, col, op) {
    const tw = grid.ray(ox, oy, oz, dx, dy, dz, 180), solid = grid.hit, ground = grid.ground;
    const v = hitActors(shooter, ox, oy, oz, dx, dy, dz, tw), tt = v ? hitT : tw, ex = ox + dx * tt, ey = oy + dy * tt, ez = oz + dz * tt;
    fx.tracer(mx, my, mz, ex, ey, ez, col, op);
    shotVictim = v; shotHead = hitHead; shotDmg = 0; hitInfo.x = ex; hitInfo.y = ey; hitInfo.z = ez; hitInfo.dx = dx; hitInfo.dy = dy; hitInfo.dz = dz;
    if (!v) for (let i = 0; i < actors.length; i++) { const c = actors[i]; if (!c.alive && c.sol && c.sol.dead && c.sol.root.visible && c.sol.shot(ox, oy, oz, dx, dy, dz, tt, shotPower(def))) break; }       // a body on the ground takes the bullet too
    if (v) { shotDmg = def.dmg * (tt > def.range ? 0.55 : 1) * (hitHead ? def.hs : 1) * mul; fx.puff(ex, ey, ez, v.kind === 'zombie' ? 0x3d4a16 : 0x8c1f12, 4); }
    else if (tt < 175) { const s = solid ? solid.surface : ground ? groundSurf : null; if (s) { fx.puff(ex, ey, ez, SURF_COL[s] || 0x9a8a68, s === 'metal' ? 3 : 4, s === 'metal' ? 1.6 : 1); try { audio.impact(s, impactAt(ex, ey, ez)); } catch { /* optional */ } } }
    if (shooter !== player && v !== player && player.alive) {   // near miss
      const cx = camera.position.x - ox, cy = camera.position.y - oy, cz = camera.position.z - oz, al = cx * dx + cy * dy + cz * dz;
      if (al > 2 && al < tt) { const qx = cx - dx * al, qy = cy - dy * al, qz = cz - dz * al; if (qx * qx + qy * qy + qz * qz < 2.6) { try { audio.whizz(impactAt(ox + dx * al, oy + dy * al, oz + dz * al)); } catch { /* optional */ } } }
    }
  }
  const sndPos = { x: 0, y: 0, z: 0 }, sndShot = { x: 0, y: 0, z: 0, own: false, occluded: false }, sndOwn = { own: true }, sndStep = { x: 0, y: 0, z: 0, own: false, run: true }, sndOwnStep = { own: true, run: false };
  const impactAt = (x, y, z) => { sndPos.x = x; sndPos.y = y; sndPos.z = z; return sndPos; };
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), vR = new THREE.Vector3(), vU = new THREE.Vector3(), vF = new THREE.Vector3(), vO = new THREE.Vector3(), dirV = { x: 0, z: 0 };
  const dmgOpt = { by: null, head: false, weaponId: '', dir: dirV };
  function applyShot(shooter, def, dx, dz) { if (!shotVictim) return; dmgOpt.by = shooter; dmgOpt.head = shotHead; dmgOpt.weaponId = def.id; dirV.x = dx; dirV.z = dz; if (def.kind !== 'melee') { hitInfo.on = true; hitInfo.v = shotVictim; hitInfo.power = shotPower(def); } damage(shotVictim, shotDmg, dmgOpt); hitInfo.on = false; hitInfo.v = null; }
  function botFire(a, dx, dy, dz, mul) {
    const def = a.wdef, ox = a.pos.x, oy = a.pos.y + (a.crouch > 0.5 ? 1.05 : 1.5), oz = a.pos.z;
    if (a.sol) { a.sol.fire(); a.sol.muzzle(v1); } else v1.set(ox, oy, oz);
    if (def.kind === 'projectile' || def.kind === 'melee') {
      if (def.kind === 'melee') { if (meleeHit(a, ox, oy, oz, dx, dy, dz, def, mul)) applyShot(a, def, dx, dz); }
      else {
        const s = def.proj.speed, fl = def.proj.flight; let ix = 0, iz = 0;
        if (fl) {       // the AI leads with the nominal speed and aims flat: correct it with the real time of flight and drop of the rocket
          const tg = a.ai && a.ai.target, hl = Math.sqrt(dx * dx + dz * dz);
          if (tg && hl > 1e-3) {
            const T = rocketT(fl), hd = Math.max(3, Math.hypot(tg.pos.x - ox, tg.pos.z - oz)), sc = hd / hl, lead = T.tof(hd) - hd / (s * 0.94);
            const px = dx * sc + (tg.vx || 0) * lead, py = dy * sc + T.drop(hd), pz = dz * sc + (tg.vz || 0) * lead, pl = Math.sqrt(px * px + py * py + pz * pz); dx = px / pl; dy = py / pl; dz = pz / pl;
          }
          ix = a.vx * fl.inherit; iz = a.vz * fl.inherit;
        }
        proj.spawn(def, a, ox, oy, oz, dx * s + ix, dy * s, dz * s + iz, mul, false, 0, v1.x, v1.y, v1.z, ix, 0, iz); shotSound(a, def.id);
      }
      if (!def.silent) a.shotT = 1.5; evShot.actor = a; evShot.weaponId = def.id; emit('shot', evShot); return;
    }
    for (let n = 0; n < def.pellets; n++) {
      let x = dx, y = dy, z = dz; if (def.pellets > 1) { x += rnd(-def.spread, def.spread); y += rnd(-def.spread, def.spread); z += rnd(-def.spread, def.spread); const l = Math.sqrt(x * x + y * y + z * z); x /= l; y /= l; z /= l; }
      shootRay(a, ox, oy, oz, x, y, z, def, mul, v1.x, v1.y, v1.z, 0xffb36a, 0.55); applyShot(a, def, x, z);
    }
    a.shotT = 1.5; shotSound(a, def.id); evShot.actor = a; evShot.weaponId = def.id; emit('shot', evShot);
  }
  function shotSound(a, id) {
    const cp = camera.position, d2 = (a.pos.x - cp.x) ** 2 + (a.pos.z - cp.z) ** 2; if (d2 > 110 * 110) return;
    sndShot.x = a.pos.x; sndShot.y = a.pos.y + 1.4; sndShot.z = a.pos.z; sndShot.own = false; sndShot.occluded = !grid.los(cp.x, cp.y, cp.z, a.pos.x, a.pos.y + 1.5, a.pos.z);
    try { gunSound(id, sndShot); } catch { /* optional */ }
  }
  /** Launchers have their own report when audio.js provides one. */
  function gunSound(id, o) { if (id === 'rl' && audio.rocketLaunch) audio.rocketLaunch(o); else if (id === 'gl' && audio.thump) audio.thump(o); else audio.shot(id, o); }
  /** Melee: a short forward sweep (5 rays over ±0.4 rad) against the hitboxes, stopped by walls. Leaves the victim in shotVictim/shotDmg; damage is doubled from behind. */
  let meleeBack = false;
  function meleeHit(s, ox, oy, oz, dx, dy, dz, def, mul) {
    const hl = Math.hypot(dx, dz) || 1, rx = -dz / hl, rz = dx / hl, own = s === player;
    let best = null, bt = def.range, wall = def.range, wallS = null, wallG = false;
    for (let i = 0; i < 5; i++) {
      const an = (i === 0 ? 0 : i < 3 ? 0.2 : 0.4) * (i & 1 ? 1 : -1), c = Math.cos(an), sn = Math.sin(an);
      let x = dx * c + rx * sn, y = dy * c, z = dz * c + rz * sn; const l = Math.sqrt(x * x + y * y + z * z) || 1; x /= l; y /= l; z /= l;
      const tw = grid.ray(ox, oy, oz, x, y, z, def.range); if (i === 0) { wall = tw; wallS = grid.hit; wallG = grid.ground; }
      const v = hitActors(s, ox, oy, oz, x, y, z, tw); if (v && hitT < bt) { best = v; bt = hitT; }
    }
    meleeBack = false; shotVictim = best; shotHead = false; shotDmg = 0;
    try { if (audio.swing) audio.swing(own ? sndOwn : impactAt(ox, oy, oz)); } catch { /* optional */ }
    if (best) {
      const vx = best.pos.x - s.pos.x, vz = best.pos.z - s.pos.z, vl = Math.hypot(vx, vz) || 1;
      meleeBack = (-Math.sin(best.yaw) * vx - Math.cos(best.yaw) * vz) / vl > 0.3;       // the victim is looking away from the attacker
      shotDmg = def.dmg * (meleeBack ? 2 : 1) * mul;
      fx.puff(ox + dx * bt, oy + dy * bt, oz + dz * bt, best.kind === 'zombie' ? 0x3d4a16 : 0x8c1f12, 5);
      try { if (audio.stab) audio.stab(own ? sndOwn : impactAt(best.pos.x, best.pos.y + 1.2, best.pos.z)); } catch { /* optional */ }
    } else if (wall < def.range) {
      const sf = wallS ? wallS.surface : wallG ? groundSurf : null;
      if (sf) { const ex = ox + dx * wall, ey = oy + dy * wall, ez = oz + dz * wall; fx.puff(ex, ey, ez, SURF_COL[sf] || 0x9a8a68, 3); try { audio.impact(sf, impactAt(ex, ey, ez)); } catch { /* optional */ } }
    }
    return best;
  }
  /* ---------- projectiles / explosions (engine-projectiles.js) ---------- */
  const projHit = { t: 0, head: false }, pDir = { x: 0, z: 0 }, pOpt = { by: null, head: false, weaponId: '', dir: pDir, force: 0, blast: false }, evBoom = { x: 0, y: 0, z: 0, radius: 0, by: null, weaponId: null };
  let fxDensity = 1;
  function projDamage(v, amount, by, weaponId, dx, dz, force, head, splash) {
    if (online && by === player && (v.isRemote || v === player)) {       // the server referees players (and the host its zombies): report, never apply
      if (v !== player && !rules.friendlyFire && !isEnemy(player, v)) return false;
      if (net) { try { net.sendHit({ target: v === player ? myId : v.id, damage: amount, head: !!head, weapon: weaponId, splash: !!splash }); } catch (e) { console.warn('[engine] net send', e); } }
      if (v !== player) hud.hitMarker(!!head);
      return false;
    }
    pOpt.by = by; pOpt.head = !!head; pOpt.weaponId = weaponId; pDir.x = dx; pDir.z = dz; pOpt.force = force; pOpt.blast = !!splash;
    return damage(v, amount, pOpt);
  }
  function knock(a, ix, iy, iz) {
    if (a.isRemote || (a.ai && a.ai.puppet)) return;
    if (a.isPlayer) { P.v.x += ix; P.v.z += iz; P.slide = 0; const n = Math.hypot(P.v.x, P.v.z); if (n > 16) { P.v.x *= 16 / n; P.v.z *= 16 / n; } }
    else { a.kx += ix; a.kz += iz; const n = Math.hypot(a.kx, a.kz); if (n > 12) { a.kx *= 12 / n; a.kz *= 12 / n; } }       // bounded, and kept apart from the walking speed so the AI cannot cancel it at once
    if (iy > 0) { a.body.vy = Math.min(Math.max(a.body.vy, 0) + iy, 9); a.body.grounded = false; a.body.ground = null; }
  }
  const proj = createProjectiles({
    scene, grid, fx, audio, actors, rules, isEnemy, hit: projHit, camPos: camera.position,
    hitActors(owner, ox, oy, oz, dx, dy, dz, tMax) { const v = hitActors(owner, ox, oy, oz, dx, dy, dz, tMax); projHit.t = hitT; projHit.head = hitHead; return v; },
    damage: projDamage, knock, shake: k => { if (k > P.shake) P.shake = k; },
    bodyBlast(a, x, y, z, radius, k) { a.sol.blast(x, y, z, radius, k); a.ragT = 0; },
    surface: s => (s ? s.surface : groundSurf) || groundSurf, density: () => fxDensity,
    onExplode(x, y, z, radius, by, weaponId, pid, visual) {
      { const b = blasts[blastI]; blastI = (blastI + 1) % blasts.length; b.x = x; b.y = y + 0.25; b.z = z; b.r = radius; b.t = E.time; }
      if (online && net && by === player && !visual && pid && net.sendBoom) { try { net.sendBoom({ x, y, z, weapon: weaponId, pid }); } catch (e) { console.warn('[engine] net send', e); } }
      evBoom.x = x; evBoom.y = y; evBoom.z = z; evBoom.radius = radius; evBoom.by = by; evBoom.weaponId = weaponId; emit('explosion', evBoom);
    },
  });
  const netHits = [];
  function playerFire(now) {
    const w = wNow(), D = w.def; if (!player.alive || now < P.next) return;
    if (D.kind === 'melee') { playerMelee(now, D); return; }
    if (P.reload > 0) { if (D.id === 'sg' && w.ammo > 0) { vm.cancelReload(); P.reload = 0; } else return; }
    if (w.ammo <= 0) { if (now - P.dryT > 0.45) { P.dryT = now; try { audio.dry(D.id); } catch { /* optional */ } } startReload();
      if (w.res === 0) { const j = P.cur ? 0 : 1, o = P.ws[j]; hud.api.message(t('noAmmo'), { kind: 'bad', dur: 1 }); if (o && (o.ammo > 0 || o.res !== 0)) switchW(j); }       // nothing left to load: draw the other weapon
      return; }
    P.next = now + 60 / D.rpm; w.ammo--; P.sprint = false;
    vm.fire(); try { gunSound(D.id, sndOwn); if (D.kind !== 'projectile') audio.casing(surfaceOf(player.body)); } catch { /* optional */ }
    camera.updateMatrixWorld(); vO.setFromMatrixPosition(camera.matrixWorld); camera.matrixWorld.extractBasis(vR, vU, vF); vF.negate();
    const sp = Math.hypot(P.v.x, P.v.z), base = D.spread * (1 - P.ads * (D.scope ? 0.995 : 0.72)) * (1 + sp * 0.05) + (player.body.grounded ? 0 : 0.012 * (1 - P.ads)) + (P.crouched ? -D.spread * 0.2 * (1 - P.ads) : 0);
    if (vm.scoped || !vm.group.visible) v2.copy(vO).addScaledVector(vR, 0.05).addScaledVector(vU, -0.08).addScaledVector(vF, 0.6); else vm.muzzle(v2);
    netHits.length = 0; let any = false; const np = D.kind === 'projectile' ? 0 : D.pellets;
    if (!np) playerLaunch(D, base);
    for (let n = 0; n < np; n++) {
      const sx = rnd(-base, base), sy = rnd(-base, base);
      const dx = vF.x + vR.x * sx + vU.x * sy, dy = vF.y + vR.y * sx + vU.y * sy, dz = vF.z + vR.z * sx + vU.z * sy, l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      shootRay(player, vO.x, vO.y, vO.z, dx / l, dy / l, dz / l, D, 1, v2.x, v2.y, v2.z, 0xffdf9e, 0.7);
      const v = shotVictim; if (!v) continue;
      if (online && v.isRemote) {       // referee: send, show the marker, never apply locally
        if (!rules.friendlyFire && !isEnemy(player, v)) continue;
        let h = null; for (const q of netHits) if (q.target === v.id && q.head === shotHead) h = q; if (!h) { h = { target: v.id, damage: 0, head: shotHead, weapon: D.id }; netHits.push(h); } h.damage += shotDmg; any = true;
      } else applyShot(player, D, dx / l, dz / l);
    }
    if (online && net && np) { try { net.sendShot({ ox: vO.x, oy: vO.y, oz: vO.z, dx: vF.x, dy: vF.y, dz: vF.z, weapon: D.id }); for (const h of netHits) net.sendHit(h); } catch (e) { console.warn('[engine] net send', e); } if (any) hud.hitMarker(netHits[0].head); }
    const up = D.rec * (1 - P.ads * 0.45) * (P.crouched ? 0.8 : 1); player.pitch = clamp(player.pitch + up, -1.5, 1.5); P.rc += up * 0.8; player.yaw += rnd(-D.rec, D.rec) * 0.35; P.kick = Math.min(1, P.kick + D.rec * 11 + 0.12);
    if (!D.silent) player.shotT = 1.5; evShot.actor = player; evShot.weaponId = D.id; emit('shot', evShot);
  }
  /** Rocket, launcher grenade or bolt: simulated from the eye (so it cannot start behind a wall), drawn from the muzzle. */
  function playerLaunch(D, spread) {
    const pr = D.proj, sx = rnd(-spread, spread), sy = rnd(-spread, spread);
    let dx = vF.x + vR.x * sx + vU.x * sy, dy = vF.y + vR.y * sx + vU.y * sy, dz = vF.z + vR.z * sx + vU.z * sy; const l = Math.sqrt(dx * dx + dy * dy + dz * dz); dx /= l; dy /= l; dz /= l;
    const fl = pr.flight; let ix = 0, iy = 0, iz = 0;       // a rocket keeps part of the shooter's own velocity
    if (fl) { ix = P.v.x * fl.inherit; iz = P.v.z * fl.inherit; const h = Math.hypot(ix, iz); if (h > 6) { ix *= 6 / h; iz *= 6 / h; } iy = player.body.grounded ? 0 : clamp(player.body.vy * fl.inherit, -5, 5); }
    const vx = dx * pr.speed + ix, vy = dy * pr.speed + iy, vz = dz * pr.speed + iz, pid = proj.spawn(D, player, vO.x, vO.y, vO.z, vx, vy, vz, 1, false, 0, v2.x, v2.y, v2.z, ix, iy, iz);
    if (online && net && pid) { try { if (fl) net.sendShot({ ox: vO.x, oy: vO.y, oz: vO.z, dx, dy, dz, weapon: D.id, k: 'p', pid, vx, vy, vz }); else net.sendShot({ ox: vO.x, oy: vO.y, oz: vO.z, dx, dy, dz, weapon: D.id, k: 'p', pid }); } catch (e) { console.warn('[engine] net send', e); } }
  }
  function playerMelee(now, D) {
    P.next = now + 60 / D.rpm; P.sprint = false; vm.fire();
    camera.updateMatrixWorld(); vO.setFromMatrixPosition(camera.matrixWorld); camera.matrixWorld.extractBasis(vR, vU, vF); vF.negate();
    const v = meleeHit(player, vO.x, vO.y, vO.z, vF.x, vF.y, vF.z, D, 1), remote = online && v && v.isRemote;
    if (online && net) { try { net.sendShot({ ox: vO.x, oy: vO.y, oz: vO.z, dx: vF.x, dy: vF.y, dz: vF.z, weapon: D.id, k: 'm' }); if (remote && (rules.friendlyFire || isEnemy(player, v))) { net.sendHit({ target: v.id, damage: shotDmg, head: false, weapon: D.id }); hud.hitMarker(false); } } catch (e) { console.warn('[engine] net send', e); } }
    if (v && !remote) applyShot(player, D, vF.x, vF.z);
    P.kick = Math.min(1, P.kick + 0.3); evShot.actor = player; evShot.weaponId = D.id; emit('shot', evShot);
  }
  /** The grenade key: throw the gear item (profile.data.gear) on an arc from the eye, with part of the player's own velocity. */
  function throwGear() {
    const g = P.gear, now = E.time; if (!g || !player.alive || rules.frozen) return;
    if (g.n <= 0) { if (now - P.dryT > 0.45) { P.dryT = now; try { audio.dry(); } catch { /* optional */ } hud.api.message(t('noGear'), { kind: 'bad', dur: 1 }); } return; }
    if (now < g.next) return;
    const D = g.def, pr = D.proj; g.n--; g.next = now + Math.max(60 / D.rpm, D.reload || 0); P.sprint = false; P.burstN = 0;
    camera.updateMatrixWorld(); vO.setFromMatrixPosition(camera.matrixWorld); camera.matrixWorld.extractBasis(vR, vU, vF); vF.negate();
    let dx = vF.x + vU.x * 0.16, dy = vF.y + vU.y * 0.16, dz = vF.z + vU.z * 0.16; const l = Math.sqrt(dx * dx + dy * dy + dz * dz); dx /= l; dy /= l; dz /= l;
    const vx = dx * pr.speed + P.v.x * 0.6, vy = dy * pr.speed + Math.max(0, player.body.vy) * 0.3, vz = dz * pr.speed + P.v.z * 0.6;
    const pid = proj.spawn(D, player, vO.x, vO.y, vO.z, vx, vy, vz, 1, false, 0, vO.x + vR.x * 0.24 - vU.x * 0.16 + vF.x * 0.3, vO.y + vR.y * 0.24 - vU.y * 0.16 + vF.y * 0.3, vO.z + vR.z * 0.24 - vU.z * 0.16 + vF.z * 0.3);
    try { if (audio.pinPull) audio.pinPull(sndOwn); if (audio.throw) audio.throw(sndOwn); } catch { /* optional */ }
    if (online && net && pid) { try { net.sendShot({ ox: vO.x, oy: vO.y, oz: vO.z, dx, dy, dz, weapon: D.id, k: 't', pid, vx, vy, vz }); } catch (e) { console.warn('[engine] net send', e); } }
    P.next = Math.max(P.next, now + 0.3); P.kick = Math.min(1, P.kick + 0.35); evShot.actor = player; evShot.weaponId = D.id; emit('shot', evShot);
  }
  function startReload() {
    const w = wNow(), D = w.def; if (!player.alive || P.reload > 0 || w.ammo >= D.mag) return;
    if (D.kind === 'melee' || w.res === 0) return;
    P.burstN = 0;
    if (D.id === 'sg') { const empty = w.ammo === 0; P.reload = 1; vm.reload(empty ? 3.1 : 1.45, empty); }
    else { P.reload = D.reload; vm.reload(D.reload, w.ammo === 0); }
  }
  vm.onSound = stage => {
    try { audio.reload(stage, player.weaponId); } catch { /* optional */ }
    if (stage === 'shell' && P.ws.length) { const w = wNow(); if (w.def.id === 'sg' && P.reload > 0 && w.ammo < w.def.mag) w.ammo++; }
  };
  function toggleTorch() { if (!player.alive) return; P.torch = !P.torch; try { if (audio.click) audio.click(); else audio.ui(); } catch { /* optional */ } }
  function switchW(i) {
    if (i === P.cur || !player.alive || !P.ws[i]) return;
    P.cur = i; P.reload = 0; P.burstN = 0; P.spin = 0; vm.cancelReload(); P.next = E.time + 0.32; P.kick = 0.3; vm.equip(wNow().def, P.outfit); player.weaponId = wNow().def.id; player.wdef = wNow().def;
  }
  function playerLoadout(dry) {
    const d = profile.data; P.cls = byId(CLASSES, d.cls) || CLASSES[0]; P.outfit = byId(OUTFITS, d.outfit) || OUTFITS[0];
    player.maxHp = P.cls.hp; player.maxArmor = P.cls.armor; player.name = d.name || t('hud.you');
    const sec = byId(WEAPONS, d.secondary), secId = rules.playerLoadout && sec && sec.slot === 1 ? sec.id : 'p9', gdef = rules.playerLoadout ? byId(WEAPONS, d.gear) : null;
    const prim = rules.playerLoadout ? W(d.primary) : W(player.weaponId), ids = prim.slot === 0 ? [prim.id, secId] : [prim.slot === 1 ? prim.id : secId];
    if (P.ws.length !== ids.length || P.ws.some((w, i) => w.def.id !== ids[i])) { P.ws = ids.map(id => newSlot(W(id))); P.cur = 0; }
    if (gdef && gdef.slot === 2 && gdef.proj) { if (!P.gear || P.gear.def !== gdef) P.gear = { def: gdef, n: gdef.mag + (gdef.reserve || 0), next: 0, label: gdef.name.toUpperCase() }; } else P.gear = null;
    if (dry) { player.weaponId = wNow().def.id; player.wdef = wNow().def; return; }      // the loader equips the viewmodels itself, one per slice
    for (let i = P.ws.length - 1; i >= 0; i--) if (i !== P.cur) vm.equip(P.ws[i].def, P.outfit);
    vm.equip(wNow().def, P.outfit); player.weaponId = wNow().def.id; player.wdef = wNow().def;
  }

  /* ---------- player ---------- */
  function updatePlayer(dt) {
    const a = player, b = a.body, p = a.pos;
    if (!a.alive) {
      P.eye += (0.4 - P.eye) * Math.min(1, dt * 5); P.ads = 0;
      if (a.respawnT >= 0) { a.respawnT -= dt; const s = Math.max(0, Math.ceil(a.respawnT)); if (s !== P.hintS) { P.hintS = s; hud.hint(t('hud.respawnIn', { s })); } if (a.respawnT < 0) respawn(a, { at: a.respawnAt }); }
      return;
    }
    const turn = dt * 2.4 * (1 - P.ads * 0.45);
    if (keyTurn.l) a.yaw += turn; if (keyTurn.r) a.yaw -= turn; if (keyTurn.u) a.pitch = clamp(a.pitch + turn * 0.7, -1.5, 1.5); if (keyTurn.d) a.pitch = clamp(a.pitch - turn * 0.7, -1.5, 1.5);
    if (!locked && mouseIn) { const ex = (mx0 / vw - 0.5) * 2, ey = (my0 / vh - 0.5) * 2; if (Math.abs(ex) > 0.82) a.yaw -= Math.sign(ex) * (Math.abs(ex) - 0.82) / 0.18 * dt * 2.6; if (Math.abs(ey) > 0.82) a.pitch = clamp(a.pitch - Math.sign(ey) * (Math.abs(ey) - 0.82) / 0.18 * dt * 1.5, -1.5, 1.5); }
    const frozen = rules.frozen, D = wNow().def;
    const fw = frozen ? 0 : (held.forward ? 1 : 0) - (held.back ? 1 : 0), st = frozen ? 0 : (held.right ? 1 : 0) - (held.left ? 1 : 0), sn = Math.sin(a.yaw), cs = Math.cos(a.yaw);
    let wx = -sn * fw + cs * st, wz = -cs * fw - sn * st; const wl = Math.hypot(wx, wz); if (wl) { wx /= wl; wz /= wl; }
    const wantLow = P.slide > 0 || (held.crouch && !frozen);
    if (wantLow) b.h = H_LOW; else if (b.h < H_STAND && !mover.blocked(p.x, p.y, p.z, b.r, H_STAND)) b.h = H_STAND;
    P.crouched = b.h < 1.5 && P.slide <= 0; a.crouch = b.h < 1.5 ? 1 : 0;
    if (fw <= 0 || P.crouched || P.ads > 0.4) P.sprint = false;
    P.sprinting = P.sprint && b.grounded && P.slide <= 0;
    P.ads += ((P.aim && !frozen && !(P.reload > 0 && D.id !== 'sg') && !P.sprinting ? 1 : 0) - P.ads) * Math.min(1, dt * 14);
    const max = RUN * P.cls.spd * D.mob * (1 - P.ads * 0.48) * (P.crouched ? 0.5 : 1) * (P.sprinting ? SPRINT : 1), sp = Math.hypot(P.v.x, P.v.z);
    P.slideCd -= dt;
    if (held.slide && !frozen && b.grounded && P.slide <= 0 && P.slideCd <= 0 && sp > 4.2) { P.slide = P.cls.id === 'eclaireur' ? 0.85 : 0.68; P.slideCd = 0.28; const k = Math.min(sp * 1.3, 14.5 * P.cls.spd) / sp; P.v.x *= k; P.v.z *= k; b.h = H_LOW; try { audio.slide(surfaceOf(b)); } catch { /* optional */ } }
    if (b.grounded) {
      if (P.slide > 0) { P.slide -= dt; const k = Math.exp(-1.25 * dt); P.v.x = P.v.x * k + wx * 2.6 * dt; P.v.z = P.v.z * k + wz * 2.6 * dt; if (sp < 3.2) P.slide = 0; }
      else { const k = 1 - Math.exp(-13 * dt); P.v.x += (wx * max - P.v.x) * k; P.v.z += (wz * max - P.v.z) * k; }
    } else { P.v.x += wx * 17 * dt; P.v.z += wz * 17 * dt; const n = Math.hypot(P.v.x, P.v.z), cap = Math.max(max, sp); if (n > cap) { P.v.x *= cap / n; P.v.z *= cap / n; } }
    let jumped = false;
    if (held.jump && !frozen && b.grounded) {
      b.vy = JUMP; b.grounded = false; jumped = true; try { audio.jump(); } catch { /* optional */ }
      if (P.slide > 0) { P.slide = 0; const n = Math.hypot(P.v.x, P.v.z), k = Math.min(n * 1.03, 15.5 * P.cls.spd) / Math.max(n, 0.01); P.v.x *= k; P.v.z *= k; }
    }
    const was = b.grounded || jumped, preVy = b.vy;
    b.vy -= GRAV * dt; const px = p.x, pz = p.z;
    mover.move(b, P.v.x * dt, b.vy * dt, P.v.z * dt, jumped);
    if (dt > 0) { const ax = (p.x - px) / dt, az = (p.z - pz) / dt; if (Math.abs(ax) < Math.abs(P.v.x) * 0.5) P.v.x *= 0.6; if (Math.abs(az) < Math.abs(P.v.z) * 0.5) P.v.z *= 0.6; a.vx = ax; a.vz = az; }
    if (!(p.x === p.x && p.y === p.y && p.z === p.z) || p.y < -20) { const q = nav.nearest(0, 0); p.set(q[0], 0, q[1]); P.v.set(0, 0, 0); b.vy = 0; }
    if (b.grounded && !was) { if (preVy < -6) { try { audio.land(surfaceOf(b)); } catch { /* optional */ } P.land = Math.min(1, -preVy / 14); P.stepD = 0; } if (!held.slide) P.slide = 0; }
    P.eye += ((P.slide > 0 ? 0.92 : b.h < 1.5 ? 1.05 : 1.62) - P.eye) * Math.min(1, dt * 16);
    b.stepOff *= Math.exp(-13 * dt); if (Math.abs(b.stepOff) < 0.002) b.stepOff = 0;
    P.land = Math.max(0, P.land - dt * 5);
    if (b.grounded && P.slide <= 0) { P.bob += dt * sp * 1.25; P.stepD += sp * dt; if (P.stepD > (P.sprinting ? 2.5 : 2.15)) { P.stepD = 0; sndOwnStep.run = sp > 6; try { audio.step(surfaceOf(b), sndOwnStep); } catch { /* optional */ } } }
    if (rules.regen && !online && a.hp < a.maxHp) { a.regenT -= dt; if (a.regenT <= 0) a.hp = Math.min(a.maxHp, a.hp + dt * (P.cls.regen ? 34 : 17)); }
  }
  function updateWeapons(dt) {
    const a = player; if (!a.alive) return;
    if (a.weaponId !== wNow().def.id) { const i = P.ws.findIndex(w => w.def.id === a.weaponId); if (i >= 0) switchW(i); else if (byId(WEAPONS, a.weaponId)) { const d = W(a.weaponId); P.ws[d.slot === 0 ? 0 : P.ws.length - 1] = newSlot(d); P.cur = d.slot === 0 ? 0 : P.ws.length - 1; P.reload = 0; vm.cancelReload(); vm.equip(d, P.outfit); a.wdef = d; } else a.weaponId = wNow().def.id; }
    const w = wNow(), D = w.def, now = E.time;
    if (P.reload > 0) {
      if (D.id === 'sg') { if (!vm.reloading) { if (w.ammo < D.mag) vm.reload(1.45, false); else P.reload = 0; } }
      else { P.reload -= dt; if (P.reload <= 0) { P.reload = 0; if (w.res >= 0) { const n = Math.min(D.mag - w.ammo, w.res); w.ammo += n; w.res -= n; } else w.ammo = D.mag; } }
    }
    const fire = held.fire && !rules.frozen;
    if (vm.setAmmo && P.reload <= 0) vm.setAmmo(w.ammo);       // rocket / bolt shown to match the magazine (respawn or resupply right after a shot)
    if (D.spin) { const want = (fire || (P.aim && !rules.frozen)) && P.reload <= 0 && w.ammo > 0; P.spin = clamp(P.spin + (want ? dt / D.spin : -dt / (D.spin * 1.5)), 0, 1); if (vm.spin) vm.spin(P.spin, dt); }       // barrels must be up to speed before the first round
    else if (P.spin > 0) { P.spin = 0; if (vm.spin) vm.spin(0, dt); }
    if (D.burst) {       // one pull = D.burst rounds at the weapon's rate, then a pause
      if (fire && !P.fired && P.burstN <= 0 && now >= P.next && P.reload <= 0) P.burstN = D.burst;
      if (P.burstN > 0 && now >= P.next) { const before = w.ammo; playerFire(now); if (w.ammo < before) { if (--P.burstN <= 0) P.next = now + D.burstGap; } else P.burstN = 0; }
      if (fire) P.fired = true;
    } else if (fire && (D.auto || !P.fired) && (!D.spin || P.spin >= 1 || w.ammo <= 0)) { playerFire(now); P.fired = true; }       // an empty rotary gun cannot spin up: the pull still clicks and reloads
    if (!held.fire) P.fired = false;
    if (D.kind === 'projectile' && w.ammo <= 0 && P.reload <= 0 && w.res !== 0 && now > P.next - 60 / D.rpm + 0.4) startReload();       // launchers reload on their own
    if (P.rc > 0 && now > P.next + 0.09) { const back = Math.min(P.rc, dt * (0.3 + P.rc * 8)); P.rc -= back; a.pitch -= back; }
  }
  const fitFov = f => { const asp = camera.aspect, ref = 16 / 9; if (asp >= ref) return f; return Math.min(128, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(f) / 2) * ref / asp))); };
  const vmSt = { ads: 0, speed: 0, grounded: true, sliding: false, yawDelta: 0, pitchDelta: 0, blocked: 0, dead: false };
  let baseFov = 84, reduced = false;
  function updateCamera(dt) {
    const a = player, b = a.body, p = a.pos, D = wNow().def, sp = Math.hypot(P.v.x, P.v.z);
    if (!a.alive && !rules.autoRespawn && a.respawnT < 0) { spectateCam(dt); return; }
    const bob = reduced ? 0 : Math.sin(P.bob) * 0.035 * (1 - P.ads);
    camera.position.set(p.x, p.y + P.eye - b.stepOff + bob - (reduced ? 0 : P.land * 0.09), p.z);
    camera.rotation.set(a.pitch, a.yaw, P.slide > 0 && !reduced ? 0.055 : 0, 'YXZ');
    if (P.shake > 0.003) { if (!reduced) { const s = P.shake; camera.rotation.x += rnd(-0.028, 0.028) * s; camera.rotation.y += rnd(-0.028, 0.028) * s; camera.rotation.z += rnd(-0.05, 0.05) * s; camera.position.y += rnd(-0.04, 0.04) * s; } P.shake *= Math.exp(-6.5 * dt); } else P.shake = 0;
    const fov = baseFov + (D.fov / 84 * baseFov - baseFov) * P.ads + (reduced ? 0 : clamp(sp - 8, 0, 7) * 0.9 * (1 - P.ads)), fit = fitFov(fov);
    if (Math.abs(camera.fov - fit) > 0.05) { camera.fov = fit; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    P.kick = Math.max(0, P.kick - dt * 6.5);
    { const want = P.torch && a.alive ? 1 : 0; if (P.torchK !== want) { P.torchK = want > P.torchK ? Math.min(1, P.torchK + dt * 9) : Math.max(0, P.torchK - dt * 9); torch.intensity = TORCH_I * P.torchK * P.torchK; } if (P.torchK > 0) torch.position.z = -0.12 - 0.63 * (1 - P.vmBlock); }
    camera.getWorldDirection(v1); const wallT = a.alive ? grid.ray(camera.position.x, camera.position.y, camera.position.z, v1.x, v1.y, v1.z, 1.15) : 1.15;
    P.vmBlock += (clamp((1.15 - wallT) / 0.75, 0, 1) - P.vmBlock) * Math.min(1, dt * 14);
    vmSt.ads = P.ads; vmSt.speed = sp; vmSt.grounded = b.grounded; vmSt.sliding = P.slide > 0; vmSt.yawDelta = wrap(a.yaw - P.yawPrev); vmSt.pitchDelta = a.pitch - P.pitchPrev; vmSt.blocked = P.vmBlock; vmSt.dead = !a.alive;
    P.yawPrev = a.yaw; P.pitchPrev = a.pitch;
    vm.update(dt, vmSt); hud.scope(vm.scoped && a.alive);
  }
  function spectateCam(dt) {
    if (!specTarget || !specTarget.alive) nextSpectate();
    vm.group.visible = false; hud.scope(false);
    const s = specTarget, a = player;
    const tx = s ? s.pos.x : a.pos.x, ty = (s ? s.pos.y : a.pos.y) + 1.55, tz = s ? s.pos.z : a.pos.z;
    const cp = Math.cos(a.pitch), dx = Math.sin(a.yaw) * cp, dy = -Math.sin(a.pitch) + 0.25, dz = Math.cos(a.yaw) * cp, l = Math.hypot(dx, dy, dz);
    const d = Math.min(specDist, Math.max(0.5, grid.ray(tx, ty, tz, dx / l, dy / l, dz / l, specDist) - 0.25));
    camera.position.set(tx + dx / l * d, ty + dy / l * d, tz + dz / l * d); camera.lookAt(tx, ty, tz);
    const fit = fitFov(baseFov - 10); if (Math.abs(camera.fov - fit) > 0.05) { camera.fov = fit; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }
  function nextSpectate() {
    let first = null, pick = null, after = false;
    for (const b of actors) { if (b === player || !b.alive || b.kind === 'zombie') continue; if (player.team !== null && b.team !== player.team) continue; if (!first) first = b; if (after && !pick) pick = b; if (b === specTarget) after = true; }
    if (!first) for (const b of actors) { if (b !== player && b.alive) { first = b; break; } }
    specTarget = pick || first; hud.spectate(specTarget ? t('spectating', { name: specTarget.name }) + '  ·  ' + t('specNext') : t('waiting'));
  }

  /* ---------- AI / actor simulation ---------- */
  const solSt = { vx: 0, vz: 0, yaw: 0, aimPitch: 0, grounded: true, crouch: 0 };
  /** Bots swap between their primary and their sidearm (the soldier model is rebuilt with the new weapon) and throw grenades. */
  function botWeapon(a, id) { if (a.weaponId === id || !byId(WEAPONS, id)) return; setWeapon(a, id); a.speed = 4.7 * a.wdef.mob; }
  function botThrow(a, def, dx, dy, dz, mul) {
    const ox = a.pos.x, oy = a.pos.y + (a.crouch > 0.5 ? 1.05 : 1.5), oz = a.pos.z, s = def.proj.speed;
    proj.spawn(def, a, ox, oy, oz, dx * s, dy * s, dz * s, mul, false, 0);
    try { if (audio.throw) audio.throw(impactAt(ox, oy, oz)); } catch { /* optional */ }
  }
  const ai = createAI({ E: null, grid, nav, budget, stats, botFire, weapons: WEAPONS, gear: WEAPONS.find(w => w.slot === 2 && w.proj) || null, fullLoadout: WEAPONS.some(w => w.slot === 2), setWeapon: botWeapon, botThrow, threat: a => proj.threat(a), botReload: (a, d) => { if (a.sol) a.sol.reload(d); }, zombieSwing: a => { if (a.sol) a.sol.fire(); }, melee: (z, tg, dmg) => { dmgOpt.by = z; dmgOpt.head = false; dmgOpt.weaponId = 'zombie'; dirV.x = tg.pos.x - z.pos.x; dirV.z = tg.pos.z - z.pos.z; damage(tg, dmg, dmgOpt); } });
  function updateActors(dt) {
    budget.path = 1; budget.cover = 1;
    const cp = camera.position, fxv = -Math.sin(camera.rotation.y), fzv = -Math.cos(camera.rotation.y), far2 = camera.far * camera.far, now = performance.now();
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i]; if (a.isPlayer) { if (a.shotT > 0) a.shotT -= dt; continue; }
      if (a.shotT > 0) a.shotT -= dt;
      if (!a.alive) {
        if (a.respawnT >= 0) { a.respawnT -= dt; if (a.respawnT < 0) { respawn(a, { at: a.respawnAt }); continue; } }
        if (a.sol) {       // the body keeps falling during the respawn delay; its colliders follow it while it travels
          if (a.sol.ragCenter(ragC)) { a.ragT -= dt; if (a.ragT <= 0) { a.ragT = 0.12; grid.gather(ragC.x, ragC.y, ragC.z, 3.4, a.cols); a.sol.setColliders(a.cols); } }
          a.sol.update(dt, solSt);
        }
        continue;
      }
      const b = a.body, ox = a.pos.x, oz = a.pos.z;
      if (a.isRemote && a.kind !== 'zombie') {
        const s = net ? net.remote(a.id, now) : null;
        if (s) { a.ghost = false; a.pos.set(s.x, s.y, s.z); a.yaw = s.yaw; a.pitch = s.pitch || 0; a.vx = s.vx || 0; a.vz = s.vz || 0; a.crouch = s.crouch ? 1 : 0; if (s.weapon && s.weapon !== a.weaponId) setWeapon(a, s.weapon); }
      } else if (a.isRemote || (a.ai && a.ai.puppet) || !a.ai) {
        if (dt > 0) { a.vx = (a.pos.x - a.px) / dt; a.vz = (a.pos.z - a.pz) / dt; }
      } else {
        if (rules.frozen) { a.wishX = a.wishZ = 0; } else ai.update(a, dt);
        const k = 1 - Math.exp(-10 * dt); a.vx += (a.wishX * a.wishSpeed - a.vx) * k; a.vz += (a.wishZ * a.wishSpeed - a.vz) * k;
        if (a.kx || a.kz) { const kd = Math.exp(-(b.grounded ? 5.5 : 1) * dt); a.kx *= kd; a.kz *= kd; if (a.kx * a.kx + a.kz * a.kz < 0.01) a.kx = a.kz = 0; }       // blast push
        const wvx = a.vx + a.kx, wvz = a.vz + a.kz;
        b.vy -= GRAV * dt; a.bump = mover.move(b, wvx * dt, b.vy * dt, wvz * dt);
        if (dt > 0) { const mx = (a.pos.x - ox) / dt, mz = (a.pos.z - oz) / dt; if (Math.abs(mx) < Math.abs(wvx) * 0.5) a.kx = 0; if (Math.abs(mz) < Math.abs(wvz) * 0.5) a.kz = 0; a.vx = mx - a.kx; a.vz = mz - a.kz; }
        a.yaw += wrap(a.yawT - a.yaw) * Math.min(1, dt * (a.ai.diff ? a.ai.diff.turn : 6));
        a.crouch += (a.crouchT - a.crouch) * Math.min(1, dt * 8);
        b.stepOff *= Math.exp(-12 * dt);
        if (!(a.pos.x === a.pos.x && a.pos.y === a.pos.y) || a.pos.y < -20) { const q = nav.nearest(0, 0); a.pos.set(q[0], 0, q[1]); b.vy = 0; a.vx = a.vz = 0; }
        if (rules.regen && a.kind !== 'zombie' && a.hp < a.maxHp) { a.regenT -= dt; if (a.regenT <= 0) a.hp = Math.min(a.maxHp, a.hp + dt * 10); }
      }
      a.px = a.pos.x; a.pz = a.pos.z;
      const dx = a.pos.x - cp.x, dz = a.pos.z - cp.z, d2 = dx * dx + dz * dz, sp = Math.hypot(a.vx, a.vz);
      if (d2 < 900 && b.grounded && sp > 1.5) { a.stepD += sp * dt; if (a.stepD > 2.3) { a.stepD = 0; sndStep.x = a.pos.x; sndStep.y = a.pos.y; sndStep.z = a.pos.z; sndStep.run = sp > 3.5; try { audio.step(surfaceOf(b), sndStep); } catch { /* optional */ } } }
      if (a.tag) { a.tag.x = a.pos.x; a.tag.y = a.pos.y + 2.05 * a.hScale; a.tag.z = a.pos.z; }
      const s = a.sol; if (!s) continue;
      s.root.position.set(a.pos.x, a.pos.y - b.stepOff, a.pos.z);
      const vis = d2 < far2 && !a.ghost; if (s.root.visible !== vis) s.setVisible(vis);
      const sh = d2 < 55 * 55; if (a.shadow !== sh) { a.shadow = sh; s.mesh.castShadow = sh; }
      const front = dx * fxv + dz * fzv > -3, lod = d2 > 60 * 60 ? 3 : d2 > 30 * 30 || !front ? 2 : 1;
      a.lodAcc += dt; if (++a.lodN >= lod) { solSt.vx = a.vx; solSt.vz = a.vz; solSt.yaw = a.yaw; solSt.aimPitch = a.pitch; solSt.grounded = b.grounded; solSt.crouch = a.crouch; s.update(a.lodAcc, solSt); a.lodAcc = 0; a.lodN = 0; }
    }
    // soft separation between living bodies (bots yield to the player)
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i]; if (!a.alive || a.isRemote || (a.ai && a.ai.puppet)) continue;
      for (let j = i + 1; j < actors.length; j++) {
        const c = actors[j]; if (!c.alive) continue; const dx = c.pos.x - a.pos.x, dz = c.pos.z - a.pos.z, d2 = dx * dx + dz * dz, r = 0.36 * (a.rScale + c.rScale);
        if (d2 > r * r || d2 < 1e-6 || Math.abs(c.pos.y - a.pos.y) > 1.6) continue;
        const d = Math.sqrt(d2), push = (r - d) * 6, nx = dx / d, nz = dz / d;
        if (!a.isPlayer) { a.vx -= nx * push; a.vz -= nz * push; } if (!c.isPlayer && !c.isRemote && !(c.ai && c.ai.puppet)) { c.vx += nx * push; c.vz += nz * push; }
      }
    }
  }

  /* ---------- graphics / quality ---------- */
  let qLevel = 0, basePr = 1, shadowEvery = 2, shTick = 0, fpsLimit = 0, showFps = false, lastRender = 0;
  let pfN = 0, pfT0 = 0, pfLast = 0, pfBad = false, pfSkip = 2, pfGood = 0, pfRaised = false, pfRetry = 0, pfBack = 120000, fpsN = 0, fpsT = 0, manual = false, vclock = 0, autoRes = true;
  try { qLevel = clamp(parseInt(localStorage.getItem('frontzero.q')) || 0, 0, QL.length - 1); } catch { /* storage unavailable */ }
  // First run on an integrated or unknown GPU: start two steps down (72 % scale, no MSAA) and let the ladder climb, rather than start at the top and stutter down.
  try { if (localStorage.getItem('frontzero.q') === null) { const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info'), name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''; if (!/NVIDIA|GeForce|RTX|GTX|Radeon RX|Radeon Pro|Apple M|Arc(TM) A/i.test(name)) qLevel = 2; } } catch { /* keep the default */ }
  function resize() {
    const w = Math.max(1, canvas.clientWidth || innerWidth), h = Math.max(1, canvas.clientHeight || innerHeight); vw = w; vh = h;
    const pr = clamp(basePr * QL[qLevel][0], 0.3, 2);
    post.setSize(w, h, pr); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function applyGraphics() {
    const g = k => settings.get('graphics.' + k);
    autoRes = g('autoResolution') !== false; if (!autoRes) qLevel = 0;
    basePr = Math.min(window.devicePixelRatio || 1, 1.5) * (g('renderScale') || 1);
    const aa = g('antialiasing'), msaaOk = QL[qLevel][1] === 1, sh = g('shadows') || 'medium';
    reduced = !!settings.get('gameplay.reducedMotion');
    post.configure({ post: g('postProcessing') !== false, grain: g('filmGrain') !== false, vignette: g('vignette') !== false, msaa: aa === 'msaa' && msaaOk, fxaa: aa === 'fxaa' || (aa === 'msaa' && !msaaOk), reduced, q: qLevel });
    if (sun) {
      const on = sh !== 'off', size = sh === 'low' ? 1024 : sh === 'high' ? 4096 : 2048;
      if (sun.castShadow !== on) sun.castShadow = on;
      if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
      renderer.shadowMap.needsUpdate = true;
    }
    shadowEvery = (sh === 'low' ? 4 : sh === 'high' ? 1 : 2) * QL[qLevel][2];
    const dens = g('particles') ?? 1; fx.setDensity(dens); fxDensity = dens;
    scene.traverse(o => { if (o.isPoints && o.material && o.material.userData && o.material.userData.perMap) { const n = o.geometry.attributes.position.count; o.geometry.setDrawRange(0, Math.round(n * Math.min(1, dens))); } });
    camera.far = clamp(g('viewDistance') || 200, 60, 400); baseFov = clamp((g('fov') || 90) - 6, 50, 110);
    fpsLimit = g('fpsLimit') || 0; showFps = !!g('showFps'); if (!showFps) hud.fps(null);
    resize();
  }
  let mouseSens = 1, mouseAds = 0.8, mouseInv = 1;
  function applyMouse() { mouseSens = settings.get('mouse.sensitivity') ?? 1; mouseAds = settings.get('mouse.adsMultiplier') ?? 0.8; mouseInv = settings.get('mouse.invertY') ? -1 : 1; }
  function applyAudio() {
    const m = settings.get('audio.master') ?? 0.8, e = settings.get('audio.effects') ?? 1, off = muted || (!focused && settings.get('audio.muteUnfocused') !== false);
    try { audio.setMasterVolume(off ? 0 : m * e); if (running && (settings.get('audio.music') ?? 0.6) > 0) audio.startAmbience(); else audio.stopAmbience(); } catch { /* optional */ }
  }
  settings.on('change', path => { if (typeof path !== 'string') return; if (path.startsWith('graphics.') || path === 'gameplay.reducedMotion') applyGraphics(); else if (path.startsWith('audio.')) applyAudio(); else if (path.startsWith('mouse.')) applyMouse(); if (path.startsWith('gameplay.')) hud.invalidate(); });
  function setQ(l) { qLevel = clamp(l, 0, QL.length - 1); applyGraphics(); pfSkip = 1; try { localStorage.setItem('frontzero.q', qLevel); } catch { /* storage unavailable */ } }
  function perfTick(ms) {
    const gap = ms - pfLast; pfLast = ms;
    if (showFps) { fpsN++; if (ms - fpsT > 500) { hud.fps(Math.round(fpsN * 1000 / (ms - fpsT)) + ' FPS · ' + Math.round(clamp(basePr * QL[qLevel][0], 0.3, 2) / Math.min(window.devicePixelRatio || 1, 1.5) * 100) + ' %'); fpsN = 0; fpsT = ms; } }
    if (!running || paused || menuOpen || document.hidden || manual || !autoRes) { pfN = 0; pfT0 = ms; pfBad = false; return; }
    if (gap > 250) pfBad = true; pfN++; if (ms - pfT0 < 2000) return;
    const fps = pfN * 1000 / (ms - pfT0), bad = pfBad; pfN = 0; pfT0 = ms; pfBad = false;
    if (bad) return; if (pfSkip > 0) { pfSkip--; return; }
    const target = fpsLimit > 0 ? Math.min(60, fpsLimit) : 60;
    if (fps < target * 0.83) { pfGood = 0; if (pfRaised) { pfRetry = ms + pfBack; pfBack = Math.min(pfBack * 2, 960000); pfRaised = false; } if (qLevel < QL.length - 1) setQ(qLevel + 1); }
    else { pfRaised = false; if (fps > target * 0.95 && qLevel > 0 && ms > pfRetry) { if (++pfGood >= 4) { pfGood = 0; pfRaised = true; setQ(qLevel - 1); } } else pfGood = 0; }
  }

  /* ---------- input ---------- */
  const blocked = () => !running || paused || menuOpen || loading;
  function lock(force) {
    if (!running && force !== true) return;
    try {
      const raw = settings.get('mouse.rawInput') !== false; let r;
      try { r = raw ? canvas.requestPointerLock({ unadjustedMovement: true }) : canvas.requestPointerLock(); } catch { r = canvas.requestPointerLock && canvas.requestPointerLock(); }
      if (r && r.catch) r.catch(e => {
        if (e && e.name === 'NotSupportedError') { try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch { /* ignore */ } }
        if (e && e.name === 'WrongDocumentError') { noLock = true; tipUntil = performance.now() + 7000; }
      });
    } catch { /* pointer lock unavailable */ }
  }
  function setPause(v) {
    if (!running || loading) return; v = !!v;
    if (online) { if (menuOpen === v) return; menuOpen = v; } else { if (paused === v) return; paused = v; }
    for (const k in held) held[k] = false; P.aim = false; keyTurn.l = keyTurn.r = keyTurn.u = keyTurn.d = false;
    hud.pause(v); if (v) hud.lockTip(null); if (v && document.pointerLockElement === canvas) document.exitPointerLock();
    emit('pause', v);
  }
  const isPaused = () => paused || menuOpen;
  function onPress(name) {
    switch (name) {
      case 'pause': setPause(!isPaused()); if (!isPaused()) lock(); return;
      case 'toggleMute': muted = !muted; applyAudio(); if (running) hud.api.message(t(muted ? 'muted' : 'unmuted'), { dur: 1 }); return;
      case 'toggleFps': settings.set('graphics.showFps', !settings.get('graphics.showFps')); return;
    }
    if (blocked()) return;
    switch (name) {
      case 'reload': startReload(); break;
      case 'weapon1': switchW(0); break;
      case 'weapon2': switchW(1); break;
      case 'nextWeapon': switchW(P.cur ? 0 : 1); break;
      case 'grenade': throwGear(); break;
      case 'flashlight': toggleTorch(); break;
      case 'sprint': P.sprint = !P.sprint; break;
      case 'fire': if (!player.alive && !rules.autoRespawn) nextSpectate(); break;
    }
  }
  function act(code, down) {
    const name = settings.action(code); if (!name) return null;
    if (!down) { held[name] = false; if (name === 'aim') P.aim = false; return name; }
    if (blocked() && !settings.isPauseSafe(name)) return name;
    if (!held[name]) { held[name] = true; if (name === 'aim') P.aim = true; onPress(name); }
    return name;
  }
  const typing = e => { const tg = e.target; return tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable); };
  addEventListener('keydown', e => {
    if (!running) return;
    if (e.code === 'Escape') { if (hud.settingsOpen) return; if (isPaused()) { setPause(false); lock(); } else if (!locked) setPause(true); return; }
    if (isPaused() && (typing(e) || hud.settingsOpen)) return;
    if (e.repeat) { if (!isPaused() && settings.action(e.code)) e.preventDefault(); return; }
    const name = act(e.code, true);
    if (!name && !isPaused()) { if (e.code === 'ArrowLeft') keyTurn.l = true; else if (e.code === 'ArrowRight') keyTurn.r = true; else if (e.code === 'ArrowUp') keyTurn.u = true; else if (e.code === 'ArrowDown') keyTurn.d = true; }
    if (!isPaused() && (name || e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow'))) e.preventDefault();
  });
  addEventListener('keyup', e => { act(e.code, false); if (e.code === 'ArrowLeft') keyTurn.l = false; else if (e.code === 'ArrowRight') keyTurn.r = false; else if (e.code === 'ArrowUp') keyTurn.u = false; else if (e.code === 'ArrowDown') keyTurn.d = false; });
  addEventListener('blur', () => { for (const k in held) held[k] = false; P.aim = false; keyTurn.l = keyTurn.r = keyTurn.u = keyTurn.d = false; focused = false; applyAudio(); });
  addEventListener('focus', () => { focused = true; applyAudio(); });
  document.documentElement.addEventListener('mouseleave', () => { mouseIn = false; });
  document.addEventListener('pointerlockerror', () => { if (running && !isPaused()) hud.api.message(t('hud.mouseNotLocked'), { kind: 'bad', dur: 1.6 }); });
  document.addEventListener('mousemove', e => {
    mx0 = e.clientX; my0 = e.clientY; mouseIn = true; if (blocked()) return;
    const scope = P.ws.length && wNow().def.scope, s = 0.0021 * mouseSens * (1 - P.ads * (1 - mouseAds * (scope ? 0.3 : 0.85)));
    player.yaw -= clamp(e.movementX || 0, -900, 900) * s; player.pitch = clamp(player.pitch - clamp(e.movementY || 0, -900, 900) * s * mouseInv, -1.5, 1.5);
  });
  canvas.addEventListener('mousedown', e => { if (blocked()) return; if (document.pointerLockElement !== canvas) lock(); act('Mouse' + e.button, true); e.preventDefault(); });
  addEventListener('mouseup', e => { act('Mouse' + e.button, false); });
  addEventListener('contextmenu', e => { if (running && !isPaused()) e.preventDefault(); });
  document.addEventListener('pointerlockchange', () => { const l = document.pointerLockElement === canvas; if (locked && !l && running && !isPaused() && !loading) setPause(true); locked = l; });
  addEventListener('wheel', e => { if (blocked()) return; const code = e.deltaY > 0 ? 'WheelDown' : 'WheelUp'; if (act(code, true)) act(code, false); }, { passive: true });
  addEventListener('resize', resize);

  /* ---------- failure handling: never leave a dead screen ---------- */
  let ctxLost = false, frameErr = 0, startGen = 0;
  /** Abort whatever is going on (a stuck load, a match whose frames keep throwing) and tell the shell (main.js shows the error panel). */
  function fail(kind, e) {
    const message = String((e && e.message) || e || '');
    console.error('[engine] ' + kind + ' failure', e); startGen++;
    try { if (running) stopMatch(); } catch (x) { console.error('[engine] stopMatch', x); running = false; E.running = false; }
    loading = false; try { hud.loading(false); hud.show(false); } catch { /* the HUD is optional here */ }
    emit('fatal', { kind, message });
  }
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); ctxLost = true; console.warn('[engine] WebGL context lost');
    if (running && !online && !isPaused()) setPause(true);      // offline the match waits; online the server goes on and the panel offers to reload
    emit('contextLost', null);
  });
  canvas.addEventListener('webglcontextrestored', () => { ctxLost = false; console.warn('[engine] WebGL context restored'); try { renderer.shadowMap.needsUpdate = true; resize(); } catch { /* the next frame retries */ } emit('contextRestored', null); });

  /* ---------- online ---------- */
  const netState = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, weapon: 'ar', crouch: false };
  function netStart() {
    net = cfg.net; myId = (cfg.room && cfg.room.you) || net.id || 'player'; player.id = myId; netT = 0;
    const on = (ev, fn) => { try { const off = net.on(ev, fn); if (typeof off === 'function') netOff.push(off); } catch (e) { console.warn('[engine] net.on', ev, e); } };
    on('shot', m => {
      const a = actorById(m.id); if (!a || a === player || !a.alive || !running) return;
      const rd = WA(m.weapon);
      if (rd.kind === 'melee' || ((rd.kind === 'projectile' || rd.kind === 'thrown') && rd.proj)) {       // a swing, or a mirror projectile that flies without dealing damage
        if (rd.kind === 'melee') { if (a.sol) a.sol.fire(); try { if (audio.swing) audio.swing(impactAt(m.ox, m.oy, m.oz)); } catch { /* optional */ } }
        else {
          if (rd.kind === 'projectile' && a.sol) { a.sol.fire(); a.sol.muzzle(v1); } else v1.set(m.ox, m.oy, m.oz);
          const s = rd.proj.speed, hv = typeof m.vx === 'number' && typeof m.vy === 'number' && typeof m.vz === 'number';
          const inh = hv && rd.proj.flight;       // a rocket's relayed velocity is aim * nominal speed + what it inherited from its shooter
          proj.spawn(rd, a, m.ox, m.oy, m.oz, hv ? m.vx : m.dx * s, hv ? m.vy : m.dy * s, hv ? m.vz : m.dz * s, 0, true, m.pid | 0, v1.x, v1.y, v1.z, inh ? m.vx - m.dx * s : 0, inh ? m.vy - m.dy * s : 0, inh ? m.vz - m.dz * s : 0);
          if (rd.kind === 'projectile') { if (!rd.silent) a.shotT = 1.5; shotSound(a, m.weapon); } else { try { if (audio.throw) audio.throw(impactAt(m.ox, m.oy, m.oz)); } catch { /* optional */ } }
        }
        evShot.actor = a; evShot.weaponId = m.weapon; emit('shot', evShot); return;
      }
      if (a.sol) { a.sol.fire(); a.sol.muzzle(v1); } else v1.set(m.ox, m.oy, m.oz);
      shootRay(a, m.ox, m.oy, m.oz, m.dx, m.dy, m.dz, W(m.weapon), 0, v1.x, v1.y, v1.z, 0xffb36a, 0.55);
      a.shotT = 1.5; shotSound(a, m.weapon); evShot.actor = a; evShot.weaponId = m.weapon; emit('shot', evShot);
    });
    on('boom', m => {       // another client's projectile went off: drop its mirror and play the blast here (the server sends the damage)
      if (!running || m.id === myId || typeof m.x !== 'number' || typeof m.y !== 'number' || typeof m.z !== 'number') return;
      const rd = WA(m.weapon); if (rd.proj) proj.remoteBoom(actorById(m.id), m.pid | 0, m.x, m.y, m.z, rd);
    });
    on('damage', m => {
      if (!running) return; const tg = actorById(m.target), from = m.from ? actorById(m.from) : null; if (!tg) return;
      if (typeof m.hp === 'number') tg.hp = m.hp; if (typeof m.armor === 'number') tg.armor = m.armor;
      feedback(tg, from, m.amount, !!m.head); emitDamage(from, tg, m.amount, !!m.head);
    });
    on('death', m => { if (!running) return; const v = actorById(m.id); if (v && v.alive) kill(v, { by: m.by ? actorById(m.by) : null, head: !!m.head, weaponId: m.weapon || null }); });
    on('respawn', m => {
      if (!running) return; const a = actorById(m.id); if (!a) return;
      respawn(a, { at: m.revived || a.isRemote ? [a.pos.x, a.pos.z, a.pos.y] : null, delay: 0 });
      if (typeof m.hp === 'number') { a.hp = m.hp; a.maxHp = Math.max(a.maxHp, m.hp); } if (typeof m.armor === 'number') a.armor = m.armor;
    });
  }
  function netStop() { for (const f of netOff) { try { f(); } catch { /* ignore */ } } netOff.length = 0; net = null; online = false; myId = 'player'; player.id = 'player'; }
  function netTick(dt) {
    netT += dt; if (netT < 0.05 || !player.alive) return; netT = 0;
    const s = netState; s.x = player.pos.x; s.y = player.pos.y; s.z = player.pos.z; s.yaw = wrap(player.yaw); s.pitch = player.pitch; s.vx = player.vx; s.vz = player.vz; s.weapon = player.weaponId; s.crouch = player.crouch > 0.5;
    try { net.sendState(s); } catch { /* connection lost */ }
  }

  /* ---------- match flow ----------
     Loading is chunked: every step runs for a few milliseconds and gives the frame back, so the page never freezes and the loading screen
     keeps moving. Shader programs are only *created* during the load (they link in the GPU process, see kick) while the textures are
     painted, the GPU receives its work in small submissions, and nothing is shown until it has caught up. Progress: the 'loading' event. */
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const LOAD_ABORT = { aborted: true }, loadEv = { active: false, done: false, progress: 0, phase: '', map: '', mode: '', online: false };
  const loadStats = { ms: 0, programs: 0, late: 0, lateNames: [], fallback: 0, linkMs: 0, quality: 0 };
  const macro = (() => { const ch = new MessageChannel(), q = []; ch.port1.onmessage = () => { const r = q.shift(); if (r) r(); }; return () => new Promise(r => { q.push(r); ch.port2.postMessage(0); }); })();
  let sliceT = 0, audioReady = false, reloadCfg = null;
  try { if (audio.ready && audio.ready.then) audio.ready.then(() => { audioReady = true; }); else audioReady = true; } catch { audioReady = true; }
  function loadProgress(p, phase) { if (p > loadEv.progress) loadEv.progress = p > 1 ? 1 : p; if (phase) loadEv.phase = phase; emit('loading', loadEv); }

  // three.js links a program the first time it is drawn and waits for the result: ~0.4 s each on an integrated GPU, seconds of frozen
  // page (or a hung driver) on a cold start. kick() creates the programs an object will be drawn with (colour pass, and the shadow pass
  // through a stand-in for three's internal depth material) without using them: with KHR_parallel_shader_compile they link in the
  // GPU process and programsLeft() says when they are ready.
  const depthStand = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), lambert = new Map();
  const drawable = o => (o.isMesh || o.isPoints || o.isLine) && o.material && !Array.isArray(o.material);
  function kick(o, seen, anyMap) {
    const m = o.material, kind = (o.isSkinnedMesh ? 's' : '') + (o.isInstancedMesh ? (o.instanceColor ? 'c' : 'i') : '') + (o.isPoints ? 'p' : ''), sig = m.uuid + kind;
    if (!seen.has(sig)) { seen.add(sig); renderer.setRenderTarget(post.target); renderer.compile(o, camera, scene); }
    if (o.isMesh && o.castShadow && renderer.shadowMap.enabled && sun && sun.visible && sun.castShadow) {
      const side = m.side === THREE.FrontSide ? THREE.BackSide : m.side === THREE.BackSide ? THREE.FrontSide : THREE.DoubleSide, dsig = 'depth' + side + kind;
      if (!seen.has(dsig)) {
        seen.add(dsig); const fog = scene.fog; scene.fog = null; o.material = depthStand; depthStand.side = side; renderer.setRenderTarget(post.composer.readBuffer);
        try { for (let k = 0; k < 2; k++) { if (k && !anyMap) break; depthStand.map = k ? anyMap : null; depthStand.needsUpdate = true; renderer.compile(o, camera, scene); } }
        finally { o.material = m; scene.fog = fog; depthStand.map = null; }
      }
    }
    renderer.setRenderTarget(null);
  }
  async function kickAll(slice) {
    const list = [], seen = new Set(); let anyMap = null;
    scene.traverse(o => { if (drawable(o)) { list.push(o); if (!anyMap && o.castShadow && o.material.map) anyMap = o.material.map; } });
    try { post.prewarm(); } catch (e) { console.warn('[engine] post prewarm', e); }
    for (const o of list) { try { kick(o, seen, anyMap); } catch (e) { renderer.setRenderTarget(null); console.warn('[engine] shader kick', e); } await slice(); }
  }
  const programsLeft = () => { let n = 0; const ps = renderer.info.programs; if (ps && !ctxLost) for (let i = 0; i < ps.length; i++) if (ps[i].isReady && !ps[i].isReady()) n++; return n; };
  /** Resolves once the GPU process has finished everything queued so far (uploads, links, first draws). Never blocks: it polls a fence. */
  async function gpuIdle(maxMs) {
    const gl = renderer.getContext(); if (!gl.fenceSync || ctxLost) { await wait(30); return; }
    const s = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), t0 = performance.now(); gl.flush();
    while (performance.now() - t0 < maxMs) { await wait(4); const st = gl.getSyncParameter(s, gl.SYNC_STATUS); if (st === gl.SIGNALED || st === null) break; }
    gl.deleteSync(s);
  }
  /** One hidden frame of the real pipeline with only draw[i..j) drawn (visible and unculled): uploads their buffers and lets the driver build its draw state, one small submission at a time. */
  function warmPass(draw, i, j, shadows) {
    const hidden = [], cull = [], masks = [];
    scene.traverse(o => { if (o.isLight) return; if (!o.visible) { o.visible = true; hidden.push(o); } });
    for (let k = 0; k < draw.length; k++) { const o = draw[k]; masks.push(o.layers.mask); if (k < i || k >= j) o.layers.mask = 0; else if (o.frustumCulled) { o.frustumCulled = false; cull.push(o); } }
    try { proj.warm(true); renderer.shadowMap.needsUpdate = !!shadows; renderer.info.reset(); post.render(0, 0); }
    finally { try { proj.warm(false); } catch { /* optional */ } for (let k = 0; k < draw.length; k++) draw[k].layers.mask = masks[k]; for (const o of cull) o.frustumCulled = true; for (const o of hidden) o.visible = false; }
  }
  /** A plain material for whatever a program that failed to link was drawing: something on screen rather than a hole. */
  function lambertFor(m) {
    let l = lambert.get(m);
    if (!l) { l = new THREE.MeshLambertMaterial({ color: m.color ? m.color.getHex() : 0x888888, map: m.map || null, vertexColors: !!m.vertexColors, side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, fog: m.fog }); lambert.set(m, l); }
    return l;
  }
  /** Everything the GPU needs before a frame may be shown: programs linked in the background, textures and buffers sent in small pieces, the driver's first draws done. p0..p1 is its share of the progress bar. */
  async function warmGpu(h, temps, p0, p1) {
    const { slice, brk, pause, gate } = h, span = p1 - p0, tLink = performance.now();
    loadProgress(p0, 'shaders'); await brk();
    await kickAll(slice);
    { const t0 = performance.now(); let total = 0;
      for (;;) { const left = programsLeft(), el = performance.now() - t0; if (left > total) total = left; if ((!left && (audioReady || el > 3000)) || el > 20000) break; loadProgress(p0 + span * 0.45 * (total ? 1 - left / total : 1)); await pause(12); } }
    loadStats.linkMs = Math.round(performance.now() - tLink);
    await gpuIdle(8000); gate();
    loadProgress(p0 + span * 0.5, 'final');
    { const texs = new Set(), add = v => { if (v && v.isTexture && v.image && !v.isRenderTargetTexture) texs.add(v); };
      scene.traverse(o => { const m = o.material; if (!m || Array.isArray(m)) return; for (const k in m) add(m[k]); if (m.uniforms) for (const k in m.uniforms) add(m.uniforms[k] && m.uniforms[k].value); });
      let n = 0; sliceT = performance.now();
      for (const tx of texs) { try { renderer.initTexture(tx); } catch { /* uploaded on first draw instead */ } if (!(++n & 3)) { await gpuIdle(2000); gate(); sliceT = performance.now(); } else await slice(); } }   // four textures per submission
    await gpuIdle(8000); gate();
    for (const s of temps) s.root.position.copy(player.pos);
    updateCamera(0); const draw = [], n0 = renderer.info.programs ? renderer.info.programs.length : 0;
    scene.traverse(o => { if (o.isMesh || o.isPoints || o.isLine) draw.push(o); });
    const chunks = async shadows => {
      for (let i = 0, j; i < draw.length; i = j) {          // ~40k vertices per pass: no single big upload, no whole-map draw
        let n = 0; for (j = i; j < draw.length && (j === i || n < 40000); j++) { const p = draw[j].geometry && draw[j].geometry.attributes && draw[j].geometry.attributes.position; n += p ? p.count : 0; }
        await brk(); if (ctxLost) throw new Error('context lost'); warmPass(draw, i, j, shadows); await gpuIdle(3000); gate(); loadProgress(p0 + span * (0.55 + (shadows ? 0.25 : 0) + 0.2 * j / draw.length));
      }
    };
    warmPass(draw, 0, 0, false); await gpuIdle(4000); gate();          // sky and post passes alone
    await chunks(false);                                                // colour pass, piece by piece
    if (sun && sun.visible && sun.castShadow) await chunks(true);       // then the same pieces into the shadow map
    const ps = renderer.info.programs || []; loadStats.programs = ps.length; loadStats.late = Math.max(0, ps.length - n0); loadStats.lateNames = ps.slice(n0).map(p => p.name || String(p.cacheKey).slice(0, 48));
    const bad = ps.filter(p => p.diagnostics && p.diagnostics.runnable === false);
    if (bad.length && !ctxLost && renderer.properties) {
      let n = 0; for (const o of draw) { const m = o.material; if (!m || Array.isArray(m)) continue; const cp = renderer.properties.get(m).currentProgram; if (!cp || bad.indexOf(cp) < 0) continue; if (o.isMesh && m.isMeshStandardMaterial) { o.material = lambertFor(m); n++; } else if (!m.isMeshLambertMaterial) o.visible = false; }
      console.warn('[engine] ' + bad.length + ' shader program(s) failed to link: ' + n + ' object(s) fall back to a plain material'); loadStats.fallback = n;
      if (n) { await kickAll(slice); for (let k = 0; k < 400 && programsLeft(); k++) await pause(12); await gpuIdle(4000); gate(); }
    }
  }

  /** Starts a match. Returns a promise that resolves when the match is playable (or the load was abandoned). A call made while a load is running returns that load's promise. */
  function startMatch(c) {
    if (loading) return loadP;
    if (running) stopMatch();
    return (loadP = runLoad(c));
  }
  async function runLoad(c) {
    const tok = ++startGen, tStart = performance.now(), temps = [];
    const gate = () => { if (tok !== startGen) throw LOAD_ABORT; };
    const brk = async () => { await macro(); gate(); sliceT = performance.now(); };                  // give the frame back
    const slice = () => (performance.now() - sliceT > 6 ? brk() : undefined);                         // ... only once the slice budget is spent
    const pause = async ms => { await wait(ms); gate(); sliceT = performance.now(); };
    const h = { slice, brk, pause, gate };
    cfg = Object.assign({ mode: 'ffa', map: 'depot', online: false, bots: 7, difficulty: 'normal' }, c || {}); E.cfg = cfg; reloadCfg = null;
    loading = true; hud.show(true); hud.reset(); hud.pause(false); hud.loading(true);
    loadEv.active = true; loadEv.done = false; loadEv.progress = 0; loadEv.phase = 'init'; loadEv.map = cfg.map; loadEv.mode = cfg.mode; loadEv.online = !!cfg.online; emit('loading', loadEv);
    try { audio.unlock(); } catch { /* optional */ }
    lock(true);                                             // now, while the click that launched the match still counts as a user gesture
    let ok = false;
    try {
      await pause(30);                                      // the loading screen paints first
      const createMode = cfg.fallback ? null : (opts.createMode || await loadModes()); gate(); sliceT = performance.now();
      for (let i = actors.length - 1; i >= 0; i--) if (actors[i] !== player) removeActor(actors[i]);
      Object.assign(rules, { friendlyFire: false, autoRespawn: true, respawnDelay: 3, regen: true, playerLoadout: true, frozen: false, killFeed: true });
      online = !!(cfg.online && cfg.net); earned = 0; idSeq = 0; botSeq = 0; E.time = 0; paused = false; menuOpen = false; stats.unstuck = 0;
      player.team = null; player.kills = player.deaths = 0; player.data = {}; player.alive = false; player.respawnT = -1; P.ws = []; playerLoadout(true);
      for (let i = P.ws.length - 1; i >= 0; i--) { await brk(); vm.equip(P.ws[i].def, P.outfit); }        // one viewmodel per slice, the current weapon last
      loadProgress(0.04, 'map'); await brk();
      temps.push(createSoldier(scene, {}));                 // stands in for every soldier and ragdoll until the mode has created its own
      if (world.id !== cfg.map) {
        for (const a of actors) if (a.sol) { a.sol.dispose(); a.sol = null; }
        let kicked = false;
        await world.loadAsync(cfg.map, async lp => {
          if (lp.phase === 'scene' && !kicked) {            // scene graph complete, textures still blank: start the shader links now, paint while they run
            kicked = true; grid.build(world.solids); await brk(); mapReady(); await brk(); await kickAll(slice);
          }
          loadProgress(lp.phase === 'tex' ? 0.14 + 0.34 * lp.done / Math.max(1, lp.total) : lp.phase === 'ground' ? 0.49 : lp.phase === 'scene' ? 0.13 : 0.08, lp.phase === 'tex' || lp.phase === 'ground' ? 'textures' : 'map');
          await slice();
        });
        gate(); loadProgress(0.5, 'nav');
        for (const f of nav.buildSteps(world.size, world.spawns, cfg.map)) { loadProgress(0.5 + 0.08 * f); await slice(); }
      }
      fx.clear(); proj.clear(); proj.resetIds(); P.torch = world.env === 'bunker'; P.torchK = 0; torch.intensity = 0;      // the weapon light starts on in the dark map only
      loadProgress(0.58, 'units'); await brk();
      if (online) netStart();
      running = true; E.running = true;
      mode = null; solQ = [];                               // soldiers asked for while the mode starts are built below, one per slice
      if (createMode) { try { mode = createMode(cfg.mode, E, cfg); mode.start(); } catch (e) { console.error('[engine] mode failed to start, using the built-in FFA', e); try { mode && mode.stop && mode.stop(); } catch { /* ignore */ } for (let i = actors.length - 1; i >= 0; i--) if (actors[i] !== player) removeActor(actors[i]); mode = null; } }
      if (!mode && running && tok === startGen) { mode = fallbackMode(E, cfg, t); mode.start(); }
      if (!running || tok !== startGen) throw LOAD_ABORT;   // the mode ended the match while starting
      { const q = solQ; solQ = null;
        for (const a of q) { if (actors.indexOf(a) < 0 || a.sol) continue; await brk(); buildSoldier(a); if (a.sol) { a.sol.root.position.copy(a.pos); solSt.vx = solSt.vz = 0; solSt.yaw = a.yaw; solSt.aimPitch = 0; solSt.grounded = true; solSt.crouch = 0; a.sol.update(0, solSt); a.sol.respawn(); if (!a.alive) a.sol.setVisible(false); } } }
      // bodies that would otherwise be built in the middle of the fight: every zombie type, and online every weapon another player may carry
      if (cfg.mode === 'zombie') for (const zt of Object.keys(ZOMBIES)) { await brk(); temps.push(createSoldier(scene, { kind: 'zombie', zombieType: zt })); }
      if (online) for (const d of WEAPONS) { if (d.slot > 1) continue; await brk(); createSoldier(null, { weaponId: d.id }).dispose(); }
      if (!player.alive && player.respawnT < 0 && rules.autoRespawn) respawn(player, { at: null, delay: 0 });
      applyAudio(); hud.earn(0);
      loadProgress(0.64, 'audio'); await brk();
      try { if (audio.preload) audio.preload([...new Set([...P.ws.map(w => w.def.id), ...actors.map(a => a.weaponId)])]); } catch { /* optional */ }      // recorded sounds of the weapons in this match first (not awaited)
      if (typeof audio.pump === 'function') { let left = audio.pump(4); const n0 = left; while (left > 0) { await brk(); left = audio.pump(4); loadProgress(0.64 + 0.06 * (1 - left / n0)); } }
      await warmGpu(h, temps, 0.7, 0.97);
      { const s = temps[0]; s.setColliders(grid.gather(player.pos.x, 1, player.pos.z, 3.2, [])); s.die(0, 1, false, 1); await brk(); for (let i = 0; i < 40; i++) s.update(1 / 60, solSt); }   // JIT the ragdoll solver now, not on the first kill
      for (const s of temps) s.dispose(); temps.length = 0;
      // the frames the player will see first, timed (CPU + GPU): if this machine cannot hold them, step the quality ladder down here, not in the first fight
      for (let step = 0; step < QL.length; step++) {
        let sum = 0; const N = 4;
        for (let k = 0; k < N; k++) { await brk(); const t0 = performance.now(); updateCamera(0); renderer.shadowMap.needsUpdate = k === 0; renderer.info.reset(); post.render(0, k); await gpuIdle(2000); gate(); if (k) sum += performance.now() - t0; }
        if (!autoRes || sum / (N - 1) < 24 || qLevel >= QL.length - 1) break;
        setQ(qLevel + 1);
      }
      loadStats.quality = qLevel; loadProgress(0.99);
      slowT = 0; pfSkip = 2; pfN = 0; ok = true;
    } catch (e) {
      if (e !== LOAD_ABORT && tok === startGen) {
        if (ctxLost) { console.warn('[engine] load interrupted by a context loss, it restarts when the context is back'); reloadCfg = cfg; stopMatch(); }
        else { console.error('[engine] startMatch failed', e); stopMatch(); hud.show(false); emit('matchEnd', { won: null, title: 'ERREUR', stats: [], credits: 0, xp: 0, error: String(e && e.message || e) }); emit('fatal', { kind: 'start', message: String(e && e.message || e) }); }
      }
    } finally { solQ = null; for (const s of temps) { try { s.dispose(); } catch { /* ignore */ } } }
    if (!ok || tok !== startGen) { if (!loading && loadEv.active) { loadEv.active = false; loadEv.done = false; emit('loading', loadEv); } return; }   // abandoned: whoever stopped it put the rest back
    loading = false; hud.loading(false); loadStats.ms = Math.round(performance.now() - tStart);
    loadEv.active = false; loadEv.done = true; loadEv.progress = 1; last = performance.now();
    emit('matchStart', cfg); emit('loading', loadEv);
    if (document.pointerLockElement !== canvas) lock();
  }
  // A restored context comes back empty: three.js would rebuild every program, texture and buffer inside the next frame (the freeze, or the
  // hang, all over again). Rebuild behind the loading screen instead, in the same small steps, at the lowest quality level.
  canvas.addEventListener('webglcontextlost', () => { if (loading && cfg) { reloadCfg = cfg; if (running) stopMatch(); else { startGen++; loading = false; hud.loading(false); } } });
  canvas.addEventListener('webglcontextrestored', async () => {
    try { if (world.restoreGpu) world.restoreGpu(); } catch (e) { console.warn('[engine] world.restoreGpu', e); }
    if (autoRes) setQ(QL.length - 1);
    if (reloadCfg) { const c = reloadCfg; reloadCfg = null; startMatch(c); return; }
    if (loading || !world.id) return;
    const tok = ++startGen, gate = () => { if (tok !== startGen) throw LOAD_ABORT; };
    const brk = async () => { await macro(); gate(); sliceT = performance.now(); }, slice = () => (performance.now() - sliceT > 6 ? brk() : undefined), pause = async ms => { await wait(ms); gate(); sliceT = performance.now(); };
    loading = true; loadEv.active = true; loadEv.done = false; loadEv.progress = 0; loadEv.phase = 'shaders'; loadEv.map = world.id; loadEv.mode = cfg ? cfg.mode : ''; loadEv.online = online; emit('loading', loadEv);
    try { const temps = [createSoldier(scene, {})]; try { await warmGpu({ slice, brk, pause, gate }, temps, 0.02, 0.98); } finally { for (const s of temps) s.dispose(); } }
    catch (e) { if (e !== LOAD_ABORT) console.warn('[engine] re-warm after a context loss failed', e); }
    if (tok !== startGen) { if (!loading && loadEv.active) { loadEv.active = false; emit('loading', loadEv); } return; }
    loading = false; loadEv.active = false; loadEv.done = true; loadEv.progress = 1; last = performance.now(); renderer.shadowMap.needsUpdate = true; emit('loading', loadEv);
  });
  /** Compile every material and upload the first frame while the loading screen is still up (no hitch on the first enemy). */
  function warmup() {
    // HOTFIX (orchestrator, 23 Nov): rendering the whole map unculled in ONE frame hung a player's GPU for over 2 s; Windows then
    // reset the driver (DXGI_ERROR_DEVICE_HUNG), the WebGL context was lost and the screen stayed blank. Disabled until the
    // warm-up is spread over many small frames. Set E.fullWarmup = true to run the old behaviour in tests.
    if (!E.fullWarmup) return;
    try {
      updateCamera(0); const cull = [], hidden = [], extra = [];
      if (cfg.mode === 'zombie') for (const zt of Object.keys(ZOMBIES)) { const s = createSoldier(scene, { kind: 'zombie', zombieType: zt }); s.root.position.set(player.pos.x, player.pos.y, player.pos.z); extra.push(s); }
      scene.traverse(o => { if (o.isLight) return; if (!o.visible) { o.visible = true; hidden.push(o); } if ((o.isMesh || o.isPoints || o.isLine) && o.frustumCulled) { o.frustumCulled = false; cull.push(o); } });
      proj.warm(true); renderer.shadowMap.needsUpdate = true; renderer.info.reset(); post.render(0, 0); proj.warm(false);
      for (const o of cull) o.frustumCulled = true; for (const o of hidden) o.visible = false;
      { const s = createSoldier(scene, {}); s.root.position.set(player.pos.x, player.pos.y, player.pos.z); s.setColliders(grid.gather(player.pos.x, 1, player.pos.z, 3.2, [])); s.die(0, 1, false, 1); for (let i = 0; i < 40; i++) s.update(1 / 60, solSt); extra.push(s); }   // JIT the ragdoll solver now, not on the first kill
      for (const s of extra) s.dispose();
      renderer.shadowMap.needsUpdate = true;
    } catch (e) { console.warn('[engine] warm-up skipped', e); }
  }
  function stopMatch() {
    if (loading) { startGen++; loading = false; solQ = null; hud.loading(false); loadEv.active = false; loadEv.done = false; emit('loading', loadEv); }   // a load in flight stops at its next step
    running = false; E.running = false; paused = false; menuOpen = false; E.paused = false;
    try { mode && mode.stop && mode.stop(); } catch (e) { console.error('[engine] mode.stop', e); } mode = null;
    if (online || netOff.length) netStop();
    for (const k in held) held[k] = false; P.aim = false;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    hud.pause(false); hud.show(false); vm.group.visible = false; rules.frozen = false; setPlayClass(false); for (const l of vmLights) l.intensity = 0; torch.intensity = 0; P.torchK = 0; proj.clear();
    applyAudio();
  }
  function endMatch(result) {
    if (!running) return; const r = result || {};
    stopMatch();
    try { profile.award(r.credits || 0, r.xp || 0); } catch (e) { console.error('[engine] profile.award', e); }
    emit('matchEnd', r);
  }

  /* ---------- frame ---------- */
  let slowT = 0, idle = 0, simMs = 0, renderMs = 0, playCls = false, skipRender = false;
  const setPlayClass = on => { if (on !== playCls) { playCls = on; document.body.classList.toggle('play', on); } };
  const classify = a => { if (a.ghost) return null; if (a.kind === 'zombie') { const d = Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z); return d < 32 ? '#9ad04a' : null; } if (!isEnemy(player, a)) return '#7fb2e6'; return a.shotT > 0 || Math.hypot(a.pos.x - player.pos.x, a.pos.z - player.pos.z) < 24 ? '#e0492f' : null; };
  const defaultBoard = () => ({ columns: [t('player'), t('kills'), t('deaths')], rows: actors.filter(a => a.kind !== 'zombie').sort((a, b) => b.kills - a.kills).map(a => { const r = [a === player ? t('hud.you') : a.name, a.kills, a.deaths]; r.me = a === player; r.team = a.team; r.alive = a.alive; return r; }) });
  function slowHud() {
    const a = player, w = wNow();
    if (P.clsLang !== i18n.lang + P.cls.id) { P.clsLang = i18n.lang + P.cls.id; P.clsLabel = t('class.' + P.cls.id + '.name').toUpperCase(); }
    hud.vitals(a.hp, a.maxHp, a.armor, a.maxArmor, P.clsLabel, a.alive || (!rules.autoRespawn && a.respawnT < 0));
    if (w) hud.weapon(w.def.kind === 'melee' ? '—' : w.ammo, w.def.mag, w.label || (w.label = w.def.name.toUpperCase()), P.reload > 0, w.res);
    if (hud.gear) { if (P.gear) hud.gear(P.gear.n, P.gear.label, settings.keyLabel ? settings.keyLabel(settings.get('keys.grenade')) : ''); else hud.gear(-1); }
    if (hud.torch) hud.torch(P.torch && a.alive, settings.keyLabel ? settings.keyLabel(settings.get('keys.flashlight')) : '');
    for (let i = 0; i < actors.length; i++) {
      const b = actors[i], want = b !== a && b.alive && !b.ghost && b.kind !== 'zombie' && a.team !== null && b.team === a.team;
      if (want && !b.tag) { b.tag = { x: b.pos.x, y: b.pos.y + 2.05, z: b.pos.z, label: b.name, color: '#8fc0f0', small: true }; hud.api.marker('_t' + b.id, b.tag); }
      else if (!want && b.tag) { hud.api.marker('_t' + b.id, null); b.tag = null; }
    }
    hud.drawMap(a, actors, classify);
    hud.board(!!held.scoreboard, defaultBoard);
    const lockMsg = isPaused() || locked ? null : noLock ? (performance.now() < tipUntil ? t('noLock') : null) : t('hud.lockTip'); hud.lockTip(lockMsg);
    if (!a.alive && !rules.autoRespawn && a.respawnT < 0 && !specTarget) hud.spectate(t('waiting'));
    setPlayClass(!isPaused());
  }
  function frame(ms, dtRaw) {
    const dt = clamp(dtRaw, 0, 0.08), t0 = performance.now(), time = ms / 1000;
    if (running && !paused && !loading) {
      E.time += dt;
      updatePlayer(dt);
      updateCamera(dt);
      updateWeapons(dt);
      updateActors(dt);
      try { mode && mode.update(dt); } catch (e) { console.error('[engine] mode.update', e); }
      if (running) {
        emit('tick', dt);
        if (online && net) netTick(dt);
        fx.update(dt); proj.update(dt);
        const sp = Math.hypot(P.v.x, P.v.z), D = wNow().def;
        hud.cross(3 + D.spread * 210 * (1 - P.ads) + sp * 0.45 * (1 - P.ads) + P.kick * 7, !(P.ads > 0.7 || !player.alive || vm.scoped));
        hud.frame(dt); hud.markersFrame(camera, vw, vh, player.pos.x, player.pos.y, player.pos.z);
        slowT -= dt; if (slowT <= 0) { slowT = 0.05; slowHud(); }
        try { audio.setListener(camera.position.x, camera.position.y, camera.position.z, player.yaw); } catch { /* optional */ }
      }
    } else if (!running && !loading && world.id) {
      idle += dt * 0.07; vm.group.visible = false; const r = world.size * 0.82;
      const fit = fitFov(62); if (Math.abs(camera.fov - fit) > 0.05) { camera.fov = fit; camera.updateProjectionMatrix(); }
      camera.position.set(Math.cos(idle) * r, 11 + Math.sin(idle * 2) * 1.5, Math.sin(idle) * r); camera.rotation.set(0, 0, 0); camera.lookAt(0, 2, 0); camera.updateMatrixWorld();
    }
    vm.tick(dt);
    if (world.id && !loading) world.update(dt, time, camera.position);
    simMs = performance.now() - t0;
    if (world.id && !skipRender && !loading) {       // the loader draws its own hidden frames; nothing half-built reaches the screen
      if (++shTick % shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
      perfTick(ms);
      renderer.info.reset(); post.render(dt, time);
    }
    renderMs = performance.now() - t0 - simMs;
  }
  let last = performance.now();
  function raf(ms) {
    requestAnimationFrame(raf); if (manual) return;
    const lim = running ? (isPaused() ? 30 : fpsLimit) : 10;
    if (lim > 0 && ms - lastRender < 1000 / lim - 1.5) return;
    lastRender = ms; const dt = (ms - last) / 1000; last = ms;
    // a frame that throws must not freeze the picture for good: after 20 failures in a row the match is aborted with a visible error
    try { frame(ms, dt); frameErr = 0; } catch (e) { if (++frameErr === 1) console.error('[engine] frame failed', e); if (frameErr >= 20) { frameErr = 0; if (running || loading) fail('frame', e); } }
  }

  /* ---------- public API ---------- */
  const E = {
    running: false, time: 0, cfg: null, rules, actors, player, world, nav, settings, i18n, profile, audio,
    get paused() { return paused || menuOpen; }, set paused(v) { /* read-only: use the pause action */ },
    /** `loading`: true from startMatch until the match is playable. Progress: on('loading', {active, done, progress 0..1, phase, map, mode, online}). */
    get loadStats() { return loadStats; },
    get loading() { return loading; }, get contextLost() { return ctxLost; },
    /** Extra (not in the contract): give up a stuck load or a broken match; emits 'fatal' ({kind, message}). */
    abort(reason) { if (loading || running) fail('abort', reason); },
    startMatch, endMatch,
    quit() { if (!running) return; stopMatch(); emit('quit', null); },
    on(evt, fn) { let s = subs.get(evt); if (!s) subs.set(evt, s = new Set()); s.add(fn); return () => s.delete(fn); },
    addBot(o = {}) {
      const a = makeActor({ id: o.id || 'bot' + (++idSeq), name: o.name || CALL[botSeq % CALL.length], team: o.team, weaponId: byId(WEAPONS, o.weaponId) ? o.weaponId : 'ar', hp: o.hp || 100 });
      a.palI = botSeq++; a.ai = newBotAI(o.difficulty || cfg?.difficulty || 'normal', botSeq); a.maxArmor = 0; a.speed = 4.7 * a.wdef.mob;
      return addActor(a, o.at);
    },
    addZombie(o = {}) {
      const type = ZOMBIES[o.type] ? o.type : 'walker', z = ZOMBIES[type];
      const a = makeActor({ id: o.id || 'zom' + (++idSeq), name: o.name || 'Zombie', kind: 'zombie', team: null, weaponId: 'p9', hp: o.hp || z.hp, zType: type });
      a.ai = newZombieAI(type, o, idSeq); a.ai.puppet = !!o.remote; a.speed = a.ai.speed; if (type === 'brute') { a.hScale = 1.12; a.rScale = 1.24; a.body.r = 0.4; a.body.h = 1.95; }
      return addActor(a, o.at);
    },
    addRemote(o = {}) {
      let a = actorById(o.id); if (a && a !== player) { if (o.name) a.name = o.name; if (o.team !== undefined) setTeam(a, o.team); if (o.weaponId) setWeapon(a, o.weaponId); return a; }
      a = makeActor({ id: o.id, name: o.name || t('player'), team: o.team, weaponId: byId(WEAPONS, o.weaponId) ? o.weaponId : 'ar', hp: 100, isRemote: true }); a.palI = botSeq++;
      a.ghost = online;       // not there yet: hidden and untouchable until its first state arrives (that client may still be loading)
      return addActor(a, o.at);
    },
    removeActor, clearActors() { for (let i = actors.length - 1; i >= 0; i--) if (actors[i] !== player) removeActor(actors[i]); },
    damage, kill, heal, respawn, setTeam, isEnemy,
    /** Blast at a point: radial falloff, cover attenuation, knockback, FX and sound. o = {radius, damage, by, weaponId, self (factor on `by` itself, default 1)}. */
    explode(x, y, z, o) { const q = o || {}; proj.explode(x, y, z, { radius: q.radius, damage: q.damage, by: q.by || null, weaponId: q.weaponId || null, self: q.self, mul: 1 }); },
    /** Remove every live projectile and blast effect (modes call it between rounds). */
    clearProjectiles() { proj.clear(); },
    projectiles: proj,
    /** Extra (not in the contract): full magazines for an actor. */
    refill(a) {
      if (a === player) { for (const w of P.ws) { w.ammo = w.def.mag; w.res = w.def.reserve === undefined ? -1 : w.def.reserve; } if (P.gear) P.gear.n = P.gear.def.mag + (P.gear.def.reserve || 0); P.reload = 0; vm.cancelReload(); }
      else if (a && a.ai && !a.ai.zombie) { a.ai.ammo = a.wdef.mag; a.ai.reloadT = 0; a.ai.refill = true; }
    },
    spawns(team) { return spawnsFor(team); },
    safeSpawn,
    los: (ax, ay, az, bx, by, bz) => grid.los(ax, ay, az, bx, by, bz),
    hud: hud.api,
    input: { held: name => !!held[name], set(name, on) { if (on) { if (!held[name]) { held[name] = true; if (name === 'aim') P.aim = true; onPress(name); } } else { held[name] = false; if (name === 'aim') P.aim = false; } } },
    reward(credits, reason) { const n = Math.round(credits || 0); if (!(n > 0)) return; earned += n; hud.earn(earned, n, reason); },
    get earned() { return earned; },
    /** Dev/test: advance one frame by `ms` with a virtual clock (stops the rAF loop from stepping). Returns the frame cost in ms. */
    debugFrame(ms = 1000 / 60, finish, noRender) { manual = true; vclock += ms; skipRender = !!noRender; const t0 = performance.now(); frame(vclock, ms / 1000); skipRender = false; if (finish) renderer.getContext().finish(); return performance.now() - t0; },
    get perf() { return { sim: simMs, render: renderMs, qLevel, pixelRatio: renderer.getPixelRatio(), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, navNodes: nav.nodes, solids: grid.size, unstuck: stats.unstuck, pathSearches: nav.searches }; },
    setQuality: setQ, loadMap, lock,
    internals: { P, grid, nav, mover, vm, renderer, scene, camera, hud, switchW, startReload, wNow, get mode() { return mode; } },
  };
  ai.setEngine(E);
  applyGraphics(); applyAudio(); applyMouse();
  requestAnimationFrame(raf);
  return E;
}

/* ---------- built-in fallback mode: FFA against bots (used when modes.js is missing or broken) ---------- */
function fallbackMode(E, cfg, t) {
  const LIMIT = 20, off = [], guns = ['ar', 'smg', 'ar', 'sg', 'lmg', 'ar', 'sr', 'smg', 'p9'];
  let time = 240, sec = -1, kills = 0, deaths = 0, heads = 0, credits = 0, done = false;
  const finish = won => { if (done) return; done = true; const bonus = won ? 400 : 75; E.reward(bonus, t(won ? 'end.win' : 'end.timeUp')); credits += bonus; E.endMatch({ won, title: t(won ? 'end.win' : 'end.timeUp'), stats: [{ label: t('end.kills'), value: kills }, { label: t('end.deaths'), value: deaths }, { label: t('end.headshots'), value: heads }], credits, xp: kills * 90 + (won ? 500 : 120) }); };
  const score = () => E.hud.set({ left: { label: t('eliminations'), value: kills + ' / ' + LIMIT, color: '#fff' } });
  return {
    id: 'fallback-ffa',
    start() {
      Object.assign(E.rules, { friendlyFire: false, autoRespawn: true, respawnDelay: 3, regen: true, playerLoadout: true });
      const n = Math.max(0, Math.min(12, Number.isFinite(+cfg.bots) ? Math.round(+cfg.bots) : 7));
      for (let i = 0; i < n; i++) E.addBot({ team: null, weaponId: guns[i % guns.length], difficulty: cfg.difficulty || 'normal', hp: 100 });
      E.respawn(E.player, { at: null, delay: 0 });
      off.push(E.on('kill', e => {
        if (e.victim === E.player) deaths++;
        if (e.killer !== E.player || e.victim === E.player) return;
        kills++; if (e.head) heads++; const c = 50 + (e.head ? 25 : 0); credits += c; E.reward(c, t(e.head ? 'headReward' : 'killReward')); score();
        if (kills >= LIMIT) setTimeout(() => finish(true), 350);
      }));
      score(); E.hud.set({ timer: time, objective: null, center: '' });
    },
    update(dt) { if (done) return; time -= dt; const s = Math.ceil(time); if (s !== sec) { sec = s; E.hud.set({ timer: Math.max(0, time) }); } if (time <= 0) finish(false); },
    stop() { for (const f of off) f(); off.length = 0; },
  };
}
