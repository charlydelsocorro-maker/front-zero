// FRONT ZÉRO — engine helper: bot and zombie brains. They only write intentions on the actor
// (wishX/wishZ/wishSpeed, yawT, pitch, crouchT) and call ctx.botFire / ctx.melee; the engine moves the bodies.
const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export const DIFFICULTY = {
  easy: { react: [0.6, 1.0], spread: 0.075, dmg: 0.4, burst: [2, 4], pause: [0.6, 1.3], turn: 5, sense: 0.24, fov: 0.25, range: 46 },
  normal: { react: [0.32, 0.55], spread: 0.045, dmg: 0.55, burst: [3, 5], pause: [0.35, 0.9], turn: 7.5, sense: 0.17, fov: 0.05, range: 60 },
  hard: { react: [0.16, 0.3], spread: 0.026, dmg: 0.75, burst: [3, 7], pause: [0.2, 0.55], turn: 11, sense: 0.11, fov: -0.2, range: 75 },
};
const RANGE = { p9: 12, ar: 20, smg: 12, sg: 7, lmg: 24, sr: 42 };
const CAT_RANGE = { assault: 20, smg: 12, shotgun: 7, lmg: 24, sniper: 42, launcher: 24, special: 28, pistol: 12, melee: 1.1 };
const prefRange = def => RANGE[def.id] || CAT_RANGE[def.cat] || 18;
export const ZOMBIES = {
  walker: { hp: 100, speed: 2.4, damage: 18, wind: 0.42, reach: 1.35 },
  runner: { hp: 70, speed: 5.3, damage: 14, wind: 0.3, reach: 1.3 },
  brute: { hp: 380, speed: 2.0, damage: 38, wind: 0.6, reach: 1.75 },
};

export function newBotAI(difficulty, index) {
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  return { order: { type: 'hunt' }, difficulty: DIFFICULTY[difficulty] ? difficulty : 'normal', diff, target: null, visible: false, lostT: 9, lkx: 0, lky: 0, lkz: 0,
    react: 0, burst: 0, burstCd: rnd(0.3, 1), fireCd: 0, ammo: -1, reloadT: 0, strafe: Math.random() < 0.5 ? -1 : 1, strafeT: 0,
    path: null, pi: 0, gx: 1e9, gz: 1e9, repath: 0, senseT: (index % 7) * 0.03 + Math.random() * 0.1, alert: 0, arrived: false,
    sx: 0, sz: 0, stT: 0, stuck: 0, dodgeT: 0, dodgeA: 0, cover: null, coverT: 0, coverCd: 0, huntT: 0, hx: 0, hz: 0, hy: 0, idleT: 0, idleYaw: 0, holdT: 0, wx: 0, wz: 0, wOn: false, puppet: false,
    // loadout: primary + sidearm + grenades (filled on the first update), spare rounds, spin-up, grenade avoidance
    prim: null, sec: null, ammo1: 0, ammo2: 0, res: -1, gearN: 0, swapT: 0, spin: 0, refill: false, fleeT: 0, fleeX: 0, fleeZ: 0, threatT: Math.random() * 0.2, nadeCd: rnd(3, 9) };
}
export function newZombieAI(type, o, index) {
  const z = ZOMBIES[type] || ZOMBIES.walker;
  return { order: { type: 'hunt' }, zombie: true, type, speed: o.speed ?? z.speed, damage: o.damage ?? z.damage, windT: z.wind, reach: z.reach, target: null, senseT: (index % 9) * 0.04, wind: 0, cd: rnd(0.2, 0.6),
    path: null, pi: 0, gx: 1e9, gz: 1e9, repath: 0, sx: 0, sz: 0, stT: 0, stuck: 0, dodgeT: 0, dodgeA: 0, alert: 0, arrived: false, puppet: false, groan: rnd(2, 8) };
}

export function createAI(ctx) {
  const { grid, nav } = ctx, P = { x: 0, y: 0, z: 0 };
  let E = ctx.E;
  const c3 = [null, null, null], d3 = [0, 0, 0], PA = { x: 0, y: 0, z: 0 };
  const defOf = id => { const W = ctx.weapons || []; for (let i = 0; i < W.length; i++) if (W[i].id === id) return W[i]; return null; };
  /** Sidearm by role (launchers and snipers prefer an automatic pistol, close-range roles sometimes a knife), spare rounds and grenades. */
  function initLoadout(a) {
    const ai = a.ai, W = ctx.weapons || [], prim = a.wdef; ai.prim = prim.id; ai.sec = null; ai.res = -1; ai.gearN = 0; ai.ammo1 = prim.mag; ai.ammo2 = 0;
    if (!ctx.fullLoadout || prim.slot !== 0) return;
    let n = 0, pick = null;
    for (let i = 0; i < W.length; i++) {
      const w = W[i]; if (w.slot !== 1) continue;
      const far = prim.cat === 'sniper' || prim.cat === 'launcher', wt = w.kind === 'melee' ? (prim.cat === 'smg' || prim.cat === 'shotgun' ? 1.2 : 0.3) : w.auto ? (far ? 2.5 : 1) : 1;
      n += wt; if (Math.random() * n < wt) pick = w;
    }
    if (pick) { ai.sec = pick.id; ai.ammo2 = pick.mag; ai.res = prim.reserve === undefined ? -1 : prim.reserve; }
    const g = ctx.gear; if (g && g.proj) ai.gearN = g.mag + (g.reserve || 0);
  }
  const canReload = a => a.wdef.kind !== 'melee' && !(a.weaponId === a.ai.prim && a.ai.res === 0);
  function swap(a, id) {
    const ai = a.ai; if (a.weaponId === id) return;
    if (a.weaponId === ai.prim) ai.ammo1 = ai.ammo; else ai.ammo2 = ai.ammo;
    ctx.setWeapon(a, id);
    ai.ammo = id === ai.prim ? ai.ammo1 : ai.ammo2; ai.reloadT = 0; ai.burst = 0; ai.spin = 0; ai.swapT = 2.5; ai.react = Math.max(ai.react, 0.35); ai.fireCd = Math.max(ai.fireCd, 0.3);
    if (ai.ammo <= 0 && canReload(a)) { ai.reloadT = a.wdef.reload; ctx.botReload(a, ai.reloadT); }
  }
  /** Weapon for the range: sidearm when the primary is dry, too close for an explosive or a scope, or instead of a reload under fire. */
  function chooseWeapon(a, dist) {
    const ai = a.ai; if (!ai.sec || ai.swapT > 0) return;
    const pd = defOf(ai.prim), sd = defOf(ai.sec); if (!pd || !sd) return;
    const onPrim = a.weaponId === ai.prim, pAmmo = onPrim ? ai.ammo : ai.ammo1, dry = pAmmo <= 0 && ai.res === 0;
    let sec;
    if (dry) sec = true;
    else if (pd.proj && pd.proj.radius > 0) sec = dist < pd.proj.radius + (onPrim ? 2.5 : 4.5);
    else if (sd.kind === 'melee') sec = dist < (onPrim ? 3 : 4.5) && (pd.scope || pd.cat === 'sniper' || pAmmo <= 0 || (onPrim && ai.reloadT > 0));
    else if (pd.scope) sec = dist < (onPrim ? 6 : 9);
    else sec = pAmmo <= 0 && dist < 11 && (!onPrim || ai.reloadT > 0.6);
    if (sec === !onPrim) return;
    swap(a, sec ? ai.sec : ai.prim);
  }
  /**
   * Aim for a projectile weapon: leads the target, aims splash at the feet, solves the arc under gravity.
   * Refuses (false) at point-blank, with a teammate in the blast or in the line of fire, or when the first metres are blocked. Result in PA.
   */
  function aimProjectile(a, tx0, ty0, tz0, tvx, tvz, def, err, skip) {
    const pr = def.proj, s = pr.speed, g = pr.gravity || 0, blast = pr.radius > 0, ex = a.pos.x, ey = a.pos.y + (a.crouch > 0.5 ? 1.05 : 1.5), ez = a.pos.z;
    let tx = tx0, tz = tz0, hx = tx - ex, hz = tz - ez, hd = Math.sqrt(hx * hx + hz * hz) || 1e-3;
    for (let k = 0; k < 2; k++) { const tt = hd / (s * 0.94); tx = tx0 + tvx * tt; tz = tz0 + tvz * tt; hx = tx - ex; hz = tz - ez; hd = Math.sqrt(hx * hx + hz * hz) || 1e-3; }
    if (blast && hd < pr.radius + 1.5) return false;
    const list = E.actors, side = blast ? 1.3 : 0.6, br = pr.radius * 0.85;
    for (let i = 0; i < list.length; i++) {
      const b = list[i]; if (b === a || b === skip || !b.alive || E.isEnemy(a, b)) continue;
      const px = b.pos.x - ex, pz = b.pos.z - ez;
      if (blast && (b.pos.x - tx) * (b.pos.x - tx) + (b.pos.z - tz) * (b.pos.z - tz) < br * br) return false;
      const along = (px * hx + pz * hz) / hd; if (along > 0.3 && along < hd && Math.abs(px * hz - pz * hx) / hd < side) return false;
    }
    let ty = ty0;
    if (blast && !g && !grid.los(ex, ey, ez, tx, ty0, tz)) ty = ty0 + 0.9;      // feet hidden: aim at the body instead
    const dy = ty - ey; let vh, vy;
    if (g > 0) { const s2 = s * s, disc = s2 * s2 - g * (g * hd * hd + 2 * dy * s2); if (disc < 0) return false; const tan = (s2 - Math.sqrt(disc)) / (g * hd), c = 1 / Math.sqrt(1 + tan * tan); vh = c; vy = tan * c; }
    else { const l = Math.sqrt(hd * hd + dy * dy); vh = hd / l; vy = dy / l; }
    let x = hx / hd * vh, y = vy, z = hz / hd * vh;
    const need = Math.min(hd, blast ? pr.radius + 2 : 2.5); if (grid.ray(ex, ey, ez, x, y, z, need) < need - 0.05) return false;
    x += (Math.random() + Math.random() - 1) * err; y += (Math.random() + Math.random() - 1) * err * 0.6; z += (Math.random() + Math.random() - 1) * err;
    const l = Math.sqrt(x * x + y * y + z * z); PA.x = x / l; PA.y = y / l; PA.z = z / l; return true;
  }
  /** Grenades: mostly to flush a target that just broke line of sight, sometimes at a visible one. Never with a teammate near the landing point. */
  function tryThrow(a) {
    const ai = a.ai, t = ai.target, g = ctx.gear; if (!g || !t || !t.alive || ai.reloadT > 0 || ai.lostT > 3.5 || ai.react > 0) return;
    if (ai.visible ? Math.random() > (ai.difficulty === 'easy' ? 0.08 : 0.22) : ai.lostT < 0.7) return;
    const tx = ai.visible ? t.pos.x : ai.lkx, ty = ai.visible ? t.pos.y : ai.lky, tz = ai.visible ? t.pos.z : ai.lkz;
    const hx = tx - a.pos.x, hz = tz - a.pos.z, hd = Math.hypot(hx, hz); if (hd < g.proj.radius + 4 || hd > 20) return;
    if (Math.abs(wrap(Math.atan2(-hx, -hz) - a.yaw)) > 0.7) return;
    if (!aimProjectile(a, tx, ty + 0.1, tz, ai.visible ? t.vx || 0 : 0, ai.visible ? t.vz || 0 : 0, g, ai.diff.spread * 0.8, t)) return;
    ctx.botThrow(a, g, PA.x, PA.y, PA.z, ai.diff.dmg); ai.gearN--; ai.nadeCd = rnd(7, 13); ai.fireCd = Math.max(ai.fireCd, 0.6);
  }

  function visible(a, b) {
    const ex = a.pos.x, ey = a.pos.y + (a.crouch > 0.5 ? 1.05 : 1.5), ez = a.pos.z, hs = b.hScale || 1;
    return grid.los(ex, ey, ez, b.pos.x, b.pos.y + 1.15 * hs * (b.crouch > 0.5 ? 0.7 : 1), b.pos.z) || grid.los(ex, ey, ez, b.pos.x, b.pos.y + 1.6 * hs * (b.crouch > 0.5 ? 0.7 : 1), b.pos.z);
  }
  function sense(a) {
    const ai = a.ai, diff = ai.diff, fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), list = E.actors;
    c3[0] = c3[1] = c3[2] = null; d3[0] = d3[1] = d3[2] = Infinity;
    for (let i = 0; i < list.length; i++) {
      const b = list[i]; if (b === a || !b.alive || !E.isEnemy(a, b)) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; let d = Math.sqrt(dx * dx + dz * dz); if (d > diff.range) continue;
      if (b !== ai.target) { if (d > 9 && ai.alert <= 0 && (dx * fx + dz * fz) / d < diff.fov) continue; } else d *= 0.75;
      if (d < d3[0]) { c3[2] = c3[1]; d3[2] = d3[1]; c3[1] = c3[0]; d3[1] = d3[0]; c3[0] = b; d3[0] = d; }
      else if (d < d3[1]) { c3[2] = c3[1]; d3[2] = d3[1]; c3[1] = b; d3[1] = d; }
      else if (d < d3[2]) { c3[2] = b; d3[2] = d; }
    }
    let seen = null;
    for (let k = 0; k < 3 && !seen; k++) if (c3[k] && visible(a, c3[k])) seen = c3[k];
    if (seen) {
      if (seen !== ai.target || !ai.visible) ai.react = rnd(diff.react[0], diff.react[1]) * (ai.lostT < 1.2 && seen === ai.target ? 0.4 : 1);
      ai.target = seen; ai.visible = true; ai.lostT = 0; ai.lkx = seen.pos.x; ai.lky = seen.pos.y; ai.lkz = seen.pos.z;
    } else ai.visible = false;
  }
  function steer(a, x, z) { const dx = x - a.pos.x, dz = z - a.pos.z, d = Math.sqrt(dx * dx + dz * dz); if (d < 1e-4) { a.wishX = a.wishZ = 0; return 0; } a.wishX = dx / d; a.wishZ = dz / d; return d; }
  /** Path-follow to a 3D goal. Returns true when within tol. */
  function goTo(a, x, y, z, dt, tol, minRepath) {
    const ai = a.ai, dx = x - a.pos.x, dz = z - a.pos.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d < tol && Math.abs(y - a.pos.y) < 1.6) { ai.path = null; a.wishX = a.wishZ = 0; return true; }
    ai.repath -= dt;
    const moved = Math.hypot(ai.gx - x, ai.gz - z);
    const need = !ai.path || ai.pi >= ai.path.length || (moved > 2.5 && ai.repath < 3 - (minRepath || 0.4)) || ai.repath <= 0;
    if (need && ctx.budget.path > 0) {
      ctx.budget.path--; ai.path = nav.path(a.pos.x, a.pos.y, a.pos.z, x, y, z); ai.pi = 0; ai.gx = x; ai.gz = z; ai.repath = rnd(3, 4.5);
      if (ai.path && ai.path.length > 1) { const w = ai.path[0]; if (Math.hypot(w.x - a.pos.x, w.z - a.pos.z) < 0.5) ai.pi = 1; }
    }
    if (ai.path && ai.pi < ai.path.length) {
      let w = ai.path[ai.pi];
      if (Math.hypot(w.x - a.pos.x, w.z - a.pos.z) < 0.42 && Math.abs(w.y - a.pos.y) < 0.7) { ai.pi++; if (ai.pi < ai.path.length) w = ai.path[ai.pi]; else { steer(a, x, z); return false; } }
      steer(a, w.x, w.z);
    } else steer(a, x, z);
    return false;
  }
  function unstick(a, dt) {
    const ai = a.ai; ai.stT += dt;
    if (ai.dodgeT > 0) { ai.dodgeT -= dt; const c = Math.cos(ai.dodgeA), s = Math.sin(ai.dodgeA), x = a.wishX, z = a.wishZ; a.wishX = x * c - z * s; a.wishZ = x * s + z * c; }
    if (ai.stT < 0.8) return; ai.stT = 0;
    const wants = (a.wishX !== 0 || a.wishZ !== 0) && a.wishSpeed > 0.5, moved = Math.hypot(a.pos.x - ai.sx, a.pos.z - ai.sz); ai.sx = a.pos.x; ai.sz = a.pos.z;
    if (!wants || moved > 0.3) { ai.stuck = 0; return; }
    ai.stuck++; ai.path = null; ai.repath = 0; ai.dodgeT = 0.55; ai.dodgeA = Math.random() < 0.5 ? 1.35 : -1.35;
    if (ai.stuck >= 5) { const i = nav.nodeAt(a.pos.x, a.pos.y, a.pos.z, false, 12); if (i >= 0) { nav.nodePos(i, P); a.pos.x = P.x; a.pos.y = P.y; a.pos.z = P.z; a.body.vy = 0; } ai.stuck = 0; ctx.stats.unstuck++; }
  }
  function clearShot(a, t, dx, dz, dist) {
    const list = E.actors;
    for (let i = 0; i < list.length; i++) {
      const b = list[i]; if (b === a || b === t || !b.alive || E.isEnemy(a, b)) continue;
      const px = b.pos.x - a.pos.x, pz = b.pos.z - a.pos.z, along = px * dx + pz * dz; if (along < 0.3 || along > dist) continue;
      if (Math.abs(px * dz - pz * dx) < 0.6) return false;
    }
    return true;
  }
  function findCover(a, t) {
    let bs = Infinity, found = false;
    for (let k = 0; k < 10; k++) {
      const i = nav.randomNear(a.pos.x, a.pos.z, 9); if (i < 0) continue; nav.nodePos(i, P);
      if (Math.abs(P.y - a.pos.y) > 1.2 || grid.los(P.x, P.y + 1.5, P.z, t.pos.x, t.pos.y + 1.5, t.pos.z)) continue;
      const d = Math.hypot(P.x - a.pos.x, P.z - a.pos.z) - Math.hypot(P.x - t.pos.x, P.z - t.pos.z) * 0.15;
      if (d < bs) { bs = d; if (!a.ai.cover) a.ai.cover = { x: 0, y: 0, z: 0 }; a.ai.cover.x = P.x; a.ai.cover.y = P.y; a.ai.cover.z = P.z; found = true; }
    }
    return found;
  }
  function fight(a, dt, anchorX, anchorZ, anchorR, noMove) {
    const ai = a.ai, diff = ai.diff, t = ai.target, def = a.wdef;
    const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, dist = Math.sqrt(dx * dx + dz * dz) || 1e-3, nx = dx / dist, nz = dz / dist;
    const hs = t.hScale || 1, ty = t.pos.y + (t.crouch > 0.5 ? 0.8 : 1.15) * hs, ey = a.pos.y + 1.5;
    a.yawT = Math.atan2(-dx, -dz); a.pitch = Math.atan2(ty - ey, dist);
    // movement: cover when hurt/reloading, otherwise range keeping + strafing
    const wantCover = !noMove && (a.hp < a.maxHp * 0.4 || ai.reloadT > 0) && ai.coverCd <= 0;
    if (noMove) ai.coverOn = false;
    if (wantCover && !ai.coverOn && ctx.budget.cover > 0) { ctx.budget.cover--; if (findCover(a, t)) { ai.coverOn = true; ai.coverT = rnd(2.2, 3.6); ai.path = null; } else ai.coverCd = 1.5; }
    if (ai.coverOn) {
      ai.coverT -= dt; a.wishSpeed = a.speed;
      if (goTo(a, ai.cover.x, ai.cover.y, ai.cover.z, dt, 0.5)) a.crouchT = 1;
      if (ai.coverT <= 0 && ai.reloadT <= 0) { ai.coverOn = false; ai.coverCd = rnd(4, 7); ai.path = null; }
    } else if (!noMove && def.kind === 'melee') {
      a.wishSpeed = a.speed; a.crouchT = 0;
      if (dist > 3) goTo(a, t.pos.x, t.pos.y, t.pos.z, dt, 0.9, 0.3); else if (dist > 0.9) { a.wishX = nx; a.wishZ = nz; } else a.wishX = a.wishZ = 0;
    } else if (!noMove) {
      ai.strafeT -= dt; if (ai.strafeT <= 0 || a.bump) { ai.strafe = -ai.strafe; if (Math.random() < 0.3) ai.strafe = 0; else if (ai.strafe === 0) ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = rnd(0.5, 1.4); }
      const pref = prefRange(def), adv = dist > pref * 1.25 ? 1 : dist < pref * 0.45 ? -0.7 : 0;
      let wx = nx * adv - nz * ai.strafe * 0.8, wz = nz * adv + nx * ai.strafe * 0.8;
      if (anchorR > 0) { const ox = a.pos.x + wx * 1.2 - anchorX, oz = a.pos.z + wz * 1.2 - anchorZ; if (ox * ox + oz * oz > anchorR * anchorR) { wx = anchorX - a.pos.x; wz = anchorZ - a.pos.z; } }
      const l = Math.hypot(wx, wz); if (l > 1e-3) { a.wishX = wx / l; a.wishZ = wz / l; } else a.wishX = a.wishZ = 0;
      a.wishSpeed = a.speed * 0.82; a.crouchT = ai.strafe === 0 && dist > 14 ? 1 : 0;
    }
    // fire control
    if (ai.reloadT > 0) { ai.spin = 0; return; }
    if (ai.react > 0) { ai.react -= dt; return; }
    ai.fireCd -= dt; ai.burstCd -= dt;
    if (def.spin) { ai.spin += dt; if (ai.spin < def.spin) return; }       // spin-up: no round before the barrels are up to speed
    if (def.kind === 'melee') {
      if (ai.fireCd > 0 || dist > def.range * 0.92 || Math.abs(t.pos.y - a.pos.y) > 1.6 || Math.abs(wrap(a.yawT - a.yaw)) > 0.5) return;
      const my = ty - ey, ml = Math.sqrt(dist * dist + my * my); ctx.botFire(a, dx / ml, my / ml, dz / ml, Math.min(1, diff.dmg + 0.25)); ai.fireCd = 60 / def.rpm * rnd(1.1, 1.6); return;
    }
    if (ai.burst <= 0) { if (ai.burstCd > 0) return; ai.burst = def.burst ? def.burst : Math.round(rnd(diff.burst[0], diff.burst[1])) * (def.auto ? 1 : 0) + (def.auto ? 0 : 1 + (Math.random() < 0.5 ? 1 : 0)); ai.first = true; }
    if (ai.fireCd > 0) return;
    if (Math.abs(wrap(a.yawT - a.yaw)) > 0.2) return;
    if (def.kind === 'projectile') {       // lead + arc; explosives never at point-blank or near a teammate
      const blast = def.proj.radius > 0, perr = diff.spread * (0.6 + Math.hypot(t.vx || 0, t.vz || 0) * 0.04);
      if (!aimProjectile(a, t.pos.x, blast ? t.pos.y + (def.proj.bounce > 0 ? 0.95 : 0.15) : ty, t.pos.z, t.vx || 0, t.vz || 0, def, perr, t)) { ai.strafeT = 0; ai.fireCd = 0.25; return; }      // rockets at the feet, bouncing grenades at the body (they go off on contact)
      ctx.botFire(a, PA.x, PA.y, PA.z, diff.dmg);
      ai.first = false; ai.burst--; ai.ammo--; ai.fireCd = Math.max(60 / def.rpm * rnd(1.15, 1.5), rnd(0.5, 0.8));
      if (ai.burst <= 0) ai.burstCd = rnd(diff.pause[0], diff.pause[1]);
      if (ai.ammo <= 0 && canReload(a)) { ai.reloadT = def.reload * 1.15; ctx.botReload(a, ai.reloadT); }
      return;
    }
    if (!clearShot(a, t, nx, nz, dist)) { ai.strafeT = 0; ai.fireCd = 0.15; return; }
    const tv = Math.hypot(t.vx || 0, t.vz || 0), own = Math.hypot(a.vx, a.vz);
    const err = diff.spread * (1 + tv * 0.09 + own * 0.05 + (ai.first ? 0 : 0.25)) + def.spread;
    const ax = dx + (-nz) * (Math.random() + Math.random() - 1) * err * dist, ay = (ty - ey) + (Math.random() + Math.random() - 1) * err * dist * 0.8, az = dz + nx * (Math.random() + Math.random() - 1) * err * dist;
    const al = Math.sqrt(ax * ax + ay * ay + az * az);
    ctx.botFire(a, ax / al, ay / al, az / al, diff.dmg);
    ai.first = false; ai.burst--; ai.ammo--;
    ai.fireCd = def.burst ? 60 / def.rpm : def.id === 'sg' ? rnd(0.95, 1.25) : def.id === 'sr' ? rnd(1.5, 1.9) : def.auto ? Math.max(def.spin ? 0.06 : 0.105, 60 / def.rpm) : Math.max(60 / def.rpm * rnd(1.15, 1.5), rnd(0.26, 0.42));
    if (ai.burst <= 0) ai.burstCd = def.burst ? Math.max(def.burstGap || 0.2, rnd(diff.pause[0], diff.pause[1])) : rnd(diff.pause[0], diff.pause[1]);
    if (ai.ammo <= 0 && canReload(a)) { ai.reloadT = def.reload * 1.15; ctx.botReload(a, ai.reloadT); }
  }
  function idle(a, dt) {
    const ai = a.ai; a.wishX = a.wishZ = 0; ai.idleT -= dt;
    if (ai.idleT <= 0) { ai.idleT = rnd(1.2, 3); ai.idleYaw = a.yaw + rnd(-1.4, 1.4); }
    a.yawT = ai.idleYaw; a.pitch = 0;
  }
  function faceMove(a) { if (a.wishX !== 0 || a.wishZ !== 0) a.yawT = Math.atan2(-a.wishX, -a.wishZ); a.pitch *= 0.9; }

  /** Wrapper around the brain: live grenades come first (run), then grenade throws. */
  function bot(a, dt) {
    const ai = a.ai;
    botCore(a, dt);
    if (ctx.threat) {
      ai.threatT -= dt;
      if (ai.threatT <= 0) {
        ai.threatT = 0.1 + Math.random() * 0.08; const p = ctx.threat(a);
        if (p) { let fx = a.pos.x - p.x, fz = a.pos.z - p.z; const l = Math.hypot(fx, fz); if (l < 0.3) { const r = Math.random() * TAU; fx = Math.cos(r); fz = Math.sin(r); } else { fx /= l; fz /= l; } if (ai.fleeT <= 0 || fx * ai.fleeX + fz * ai.fleeZ < 0.2) { ai.fleeX = fx; ai.fleeZ = fz; } ai.fleeT = 0.45; }
      }
      if (ai.fleeT > 0) {
        ai.fleeT -= dt;
        if (a.bump) { const c = 0.5, s = ai.strafe < 0 ? -0.866 : 0.866, x = ai.fleeX, z = ai.fleeZ; ai.fleeX = x * c - z * s; ai.fleeZ = x * s + z * c; }      // wall in the way: slide along it
        a.wishX = ai.fleeX; a.wishZ = ai.fleeZ; a.wishSpeed = a.speed * 1.12; a.crouchT = 0; ai.coverOn = false; ai.path = null; ai.repath = 0;
        if (!ai.visible) a.yawT = Math.atan2(-a.wishX, -a.wishZ);
      }
    }
    if (ai.gearN > 0 && ai.fleeT <= 0) { ai.nadeCd -= dt; if (ai.nadeCd <= 0) { ai.nadeCd = 1; tryThrow(a); } }
  }
  function botCore(a, dt) {
    const ai = a.ai, o = ai.order || (ai.order = { type: 'hunt' });
    if (ai.ammo < 0) ai.ammo = a.wdef.mag;
    if (!ai.prim) initLoadout(a);
    if (ai.refill) {       // new life or resupply: back to the primary with full reserves
      ai.refill = false; const pd = defOf(ai.prim), sd = ai.sec ? defOf(ai.sec) : null, g = ctx.gear;
      if (pd) { ai.ammo1 = pd.mag; if (ai.sec) ai.res = pd.reserve === undefined ? -1 : pd.reserve; } if (sd) ai.ammo2 = sd.mag; if (ai.sec && g && g.proj) ai.gearN = g.mag + (g.reserve || 0);
      if (a.weaponId !== ai.prim && pd) { ctx.setWeapon(a, ai.prim); } ai.ammo = a.wdef.mag; ai.reloadT = 0; ai.swapT = 0; ai.spin = 0; ai.fleeT = 0;
    }
    if (ai.swapT > 0) ai.swapT -= dt;
    if (ai.alert > 0) ai.alert -= dt; if (ai.coverCd > 0) ai.coverCd -= dt;
    if (ai.reloadT > 0) { ai.reloadT -= dt; if (ai.reloadT <= 0) { const d = a.wdef; if (a.weaponId === ai.prim && ai.res >= 0) { const n = Math.min(d.mag - Math.max(0, ai.ammo), ai.res); ai.ammo = Math.max(0, ai.ammo) + n; ai.res -= n; } else ai.ammo = d.mag; } }
    ai.senseT -= dt; if (ai.senseT <= 0) { ai.senseT = ai.diff.sense * rnd(0.85, 1.2); sense(a); }
    if (ai.target && !ai.target.alive) { ai.target = null; ai.visible = false; ai.coverOn = false; }
    if (!ai.visible) ai.lostT += dt;
    a.crouchT = 0; a.wishSpeed = a.speed;
    const t = ai.target;
    if (t && ai.visible) {
      chooseWeapon(a, Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z));
      if (o.type === 'goto' && !ai.arrived && Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z) > 12) {
        // objective first: keep running the path, shoot on the move
        fight(a, dt, 0, 0, 0, true);
        goTo(a, o.x, 0, o.z, dt, Math.min(1.2, o.radius || 2)); a.wishSpeed = a.speed * 0.85;
      } else if (o.type === 'hold' || (o.type === 'goto' && ai.arrived)) fight(a, dt, o.x, o.z, Math.max(2, o.radius || 4));
      else if (o.type === 'follow' && o.actor && o.actor.alive && Math.hypot(o.actor.pos.x - a.pos.x, o.actor.pos.z - a.pos.z) > 18) { fight(a, dt, 0, 0, 0, true); goTo(a, o.actor.pos.x, o.actor.pos.y, o.actor.pos.z, dt, 4); }
      else fight(a, dt, 0, 0, 0);
      unstick(a, dt); return;
    }
    ai.coverOn = false; ai.spin = 0;
    if (ai.sec && ai.swapT <= 0) {       // nobody in sight: back to the primary, unless it is spent
      const dry = (a.weaponId === ai.prim ? ai.ammo : ai.ammo1) <= 0 && ai.res === 0;
      if (dry) swap(a, ai.sec); else if (a.weaponId !== ai.prim && ai.lostT > 1.5) swap(a, ai.prim);
    }
    if (ai.ammo < a.wdef.mag * 0.35 && ai.reloadT <= 0 && ai.ammo !== a.wdef.mag && canReload(a)) { ai.reloadT = a.wdef.reload * 1.1; ctx.botReload(a, ai.reloadT); }
    // lost a target recently: push to its last known position (unless told to hold)
    if (t && ai.lostT < 5 && o.type !== 'hold' && o.type !== 'goto') {
      if (goTo(a, ai.lkx, ai.lky, ai.lkz, dt, 1.2)) { ai.target = null; }
      faceMove(a); unstick(a, dt); return;
    }
    if (ai.lostT >= 5) ai.target = null;
    if (o.type === 'goto' || o.type === 'hold') {
      const r = Math.max(0.8, o.radius || 2), d = Math.hypot(o.x - a.pos.x, o.z - a.pos.z);
      if (d <= r) {
        ai.arrived = true;
        if (o.type === 'hold') {       // patrol inside the zone
          ai.holdT -= dt;
          if (ai.holdT <= 0) { ai.holdT = rnd(3.5, 8); const i = nav.randomNear(o.x, o.z, r * 0.8); if (i >= 0) { nav.nodePos(i, P); ai.wx = P.x; ai.wz = P.z; ai.wOn = true; } }
          if (ai.wOn) { a.wishSpeed = a.speed * 0.5; if (goTo(a, ai.wx, a.pos.y, ai.wz, dt, 0.6)) ai.wOn = false; faceMove(a); } else idle(a, dt);
        } else idle(a, dt);
      } else { ai.arrived = false; goTo(a, o.x, 0, o.z, dt, Math.min(r, 1.2)); faceMove(a); }
    } else if (o.type === 'follow' && o.actor) {
      const f = o.actor, d = Math.hypot(f.pos.x - a.pos.x, f.pos.z - a.pos.z);
      if (d > 5 || Math.abs(f.pos.y - a.pos.y) > 2) { goTo(a, f.pos.x, f.pos.y, f.pos.z, dt, 3); faceMove(a); ai.arrived = false; } else { ai.arrived = true; ai.path = null; idle(a, dt); }
    } else {     // hunt: head for the nearest enemy's rough position, or roam between spawns
      ai.huntT -= dt;
      if (ai.huntT <= 0) {
        ai.huntT = rnd(3, 6); let best = null, bd = Infinity; const list = E.actors;
        for (let i = 0; i < list.length; i++) { const b = list[i]; if (b === a || !b.alive || !E.isEnemy(a, b)) continue; const d = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) * rnd(0.7, 1.3); if (d < bd) { bd = d; best = b; } }
        if (best) { ai.hx = best.pos.x + rnd(-5, 5); ai.hz = best.pos.z + rnd(-5, 5); ai.hy = best.pos.y; }
        else { const sp = E.world.spawns; if (sp.length) { const s = sp[Math.floor(Math.random() * sp.length)]; ai.hx = s[0]; ai.hz = s[1]; ai.hy = 0; } }
      }
      if (goTo(a, ai.hx, ai.hy, ai.hz, dt, 1.5)) ai.huntT = Math.min(ai.huntT, 0.4);
      faceMove(a);
    }
    unstick(a, dt);
  }

  function zombie(a, dt) {
    const ai = a.ai; a.crouchT = 0;
    ai.senseT -= dt;
    if (ai.senseT <= 0) {
      ai.senseT = rnd(0.35, 0.6); let best = null, bd = Infinity; const list = E.actors;
      for (let i = 0; i < list.length; i++) { const b = list[i]; if (!b.alive || b.kind === 'zombie' || b.data.downed) continue; let d = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) + Math.abs(b.pos.y - a.pos.y) * 2; if (b === ai.target) d *= 0.8; if (d < bd) { bd = d; best = b; } }
      ai.target = best;
    }
    const t = ai.target; if (ai.cd > 0) ai.cd -= dt;
    if (!t || !t.alive) { a.wishX = a.wishZ = 0; ai.wind = 0; return; }
    const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, d = Math.sqrt(dx * dx + dz * dz), dy = Math.abs(t.pos.y - a.pos.y);
    if (ai.wind > 0) {
      ai.wind -= dt; a.yawT = Math.atan2(-dx, -dz); a.wishSpeed = ai.speed * 0.2; steer(a, t.pos.x, t.pos.z);
      if (ai.wind <= 0) { ai.cd = rnd(0.55, 0.95); if (d < ai.reach + 0.75 && dy < 1.7) ctx.melee(a, t, ai.damage); }
      return;
    }
    if (d < ai.reach && dy < 1.5 && ai.cd <= 0) { ai.wind = ai.windT; ctx.zombieSwing(a); a.wishX = a.wishZ = 0; return; }
    a.wishSpeed = ai.speed;
    if (d < 8 && dy < 0.7 && grid.los(a.pos.x, a.pos.y + 0.45, a.pos.z, t.pos.x, t.pos.y + 0.45, t.pos.z) && grid.los(a.pos.x, a.pos.y + 1.3, a.pos.z, t.pos.x, t.pos.y + 1.3, t.pos.z)) { steer(a, t.pos.x, t.pos.z); ai.path = null; if (d < ai.reach * 0.7) a.wishX = a.wishZ = 0; }
    else goTo(a, t.pos.x, t.pos.y, t.pos.z, dt, ai.reach * 0.7, Math.min(2.4, Math.max(0.5, d / 16)));
    faceMove(a); unstick(a, dt);
  }

  return {
    setEngine(e) { E = e; },
    update(a, dt) { if (a.ai.zombie) zombie(a, dt); else bot(a, dt); },
    /** Being shot wakes a bot up and turns it toward the shooter. */
    alert(a, by) { const ai = a.ai; if (!ai || ai.zombie) return; ai.alert = 3; if (by && by.alive && !ai.visible && E.isEnemy(a, by)) { ai.lkx = by.pos.x; ai.lky = by.pos.y; ai.lkz = by.pos.z; if (!ai.target) { ai.target = by; ai.lostT = 0.5; } a.yawT = Math.atan2(-(by.pos.x - a.pos.x), -(by.pos.z - a.pos.z)); ai.senseT = 0; } },
  };
}
