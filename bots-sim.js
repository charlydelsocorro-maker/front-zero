// FRONT ZÉRO — online bots, client side (loaded by online-ui.js). Server side and rules: net-bots.js.
// Every client sees the bots as ordinary remote soldiers ("[BOT] name"). The one client the server picks as simulator (room.bs, chosen by
// measured frame time and ping) turns those same actors into solo-AI bots in place (no new soldier is built) and reports, 20 times a
// second, their positions, shots, blasts, hits and objective actions ({t:'bt'}). The server referees each report as it would a player's
// own message and owns the bots' health: on the simulator they carry `netRef`, so the engine reports damage to them instead of applying it.
// Every client also reports its smoothed frame time and ping every 2 s ({t:'bp'}) so the server can move the bots to the best machine.
import { newBotAI } from './engine-ai.js';

const GUNS = [['ar', 5], ['smg', 3], ['sg', 2], ['lmg', 2], ['car', 1], ['akr', 1], ['hsmg', 1], ['dmr', 1], ['pdw', 1], ['sr', 1]];
const SEND = 0.05, PERF = 2, ORDERS = 1, ACT = 0.2, ACT_RESEND = 0.6;
const DOM_R = 6, SITE_R = 5, DEFUSE_R = 3.2;
const r2 = v => Math.round(v * 100) / 100;
const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const hash = s => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; };
function gunFor(id) {
  let total = 0; for (const g of GUNS) total += g[1];
  let r = hash(id) % total; for (const g of GUNS) { r -= g[1]; if (r < 0) return g[0]; }
  return 'ar';
}

export function install({ net, engine }) {
  const E = engine;
  if (!net || !E || typeof E.on !== 'function') return null;
  const S = { room: null, simId: null, bots: new Set(), mine: new Map(), sim: false, seq: 0, gunQ: [], gunT: 0,
    sendT: 0, perfT: 0, orderT: 0, actT: 0, ft: 16.7, ftN: 0, applying: false, boomBy: null, boomW: null,
    att: 'A', phase: '', plant: null, defuse: null, planter: null, target: 'A', acting: new Map(), lastSent: 0, stats: { sent: 0, shots: 0, hits: 0, booms: 0, acts: 0 } };
  const out = { s: [], f: [], b: [], h: [], a: [] };
  net.joinCaps = Object.assign({}, net.joinCaps, { bc: 1 });       // tells the server this client can simulate bots
  // the server relays my bots' shots and blasts to every client, me included: already drawn here
  net.mute = (event, d) => S.sim && (event === 'shot' || event === 'boom') && !!d && S.mine.has(d.id);
  // a bot at a closed door asks for it every frame until the server's answer arrives: at most once per door every 0.5 s, 8 a second in all
  // (engine-props.js sends them; the server's 'prop' rate limit would otherwise treat a crowd of bots at doors as abuse)
  const doorAt = new Map(); let doorN = 0, doorT = 0;
  if (typeof net.sendProp === 'function') {
    const rawProp = net.sendProp;
    net.sendProp = function (o) {
      if (o && o.a === 'use' && o.z === 1) {
        const now = performance.now();
        if (now - doorT > 1000) { doorT = now; doorN = 0; }
        if (now - (doorAt.get(o.id) || -1e9) < 500 || doorN >= 8) return;
        doorAt.set(o.id, now); doorN++;
      }
      return rawProp.call(this, o);
    };
  }

  const online = () => !!(E.running && E.cfg && E.cfg.online);
  const actorById = id => (id && id === net.id ? E.player : E.actors.find(a => a.id === id) || null);
  const teamLetter = t => (t === 0 ? 'A' : t === 1 ? 'B' : null);
  const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
  function setOrder(a, type, x, z, radius) {
    const ai = a.ai; if (!ai) return; const o = ai.order;
    if (o && o.type === type && (type === 'hunt' || (o.x === x && o.z === z && o.radius === radius))) return;
    ai.order = type === 'hunt' ? { type } : { type, x, z, radius };
  }

  /* ---------- who is a bot, who simulates ---------- */
  function readRoom(r) {
    if (!r || !Array.isArray(r.players)) return;
    S.room = r; S.simId = r.bs || null;
    S.bots = new Set(r.players.filter(p => p && p.bot).map(p => p.id));
  }
  function toAI(a) {
    const fresh = !!a.ghost;       // never seen on this screen yet: it starts at a spawn point
    a.isRemote = false; a.ghost = false; a.netRef = true;
    a.ai = newBotAI('normal', ++S.seq); a.maxArmor = 0; a.speed = 4.7 * ((a.wdef && a.wdef.mob) || 1);
    if (!a.data) a.data = {};
    S.mine.set(a.id, a);
    if (a.alive) { if (fresh) E.respawn(a, { at: null, delay: 0 }); else if (a.body) { a.body.vy = 0; a.vx = a.vz = 0; } }
    const g = gunFor(a.id); if (g !== a.weaponId) S.gunQ.push(a);
  }
  function toRemote(a) { a.isRemote = true; a.netRef = false; a.ai = null; S.mine.delete(a.id); }
  function apply() {
    if (!online() || E.loading) return;
    const amSim = !!net.btOk && !!net.id && S.simId === net.id;
    for (const a of E.actors) {
      if (a === E.player || a.kind !== 'soldier' || !S.bots.has(a.id)) continue;
      if (amSim && !a.netRef) toAI(a);
      else if (!amSim && a.netRef) toRemote(a);
    }
    for (const [id, a] of [...S.mine]) if (!S.bots.has(id) || E.actors.indexOf(a) < 0) S.mine.delete(id);
    S.sim = amSim;
  }
  function reset() { for (const a of S.mine.values()) { a.netRef = false; } S.mine.clear(); S.gunQ.length = 0; S.sim = false; S.plant = S.defuse = S.planter = null; S.acting.clear(); for (const k of Object.keys(out)) out[k].length = 0; }

  net.on('room', r => { readRoom(r); queueMicrotask(apply); });       // after the mode's own handler has added the new soldiers
  net.on('start', r => { readRoom(r); reset(); S.att = 'A'; S.phase = ''; });
  E.on('matchStart', () => { if (net.room) readRoom(net.room); apply(); });
  E.on('matchEnd', reset); E.on('quit', reset);

  /* ---------- what the server tells the simulator ---------- */
  net.on('action', m => {
    const d = (m && m.data) || {};
    switch (m && m.type) {
      case 'bot_hp': {       // a hit on one of my bots, applied by the server: mirror the health, the AI turns to the shooter
        const b = S.mine.get(d.id); if (!b) return;
        if (typeof d.hp === 'number') b.hp = d.hp; if (typeof d.armor === 'number') b.armor = d.armor;
        const by = actorById(d.by);
        if (by && b.alive && by !== b) { S.applying = true; try { E.damage(b, 0.001, { by }); } catch { /* optional */ } finally { S.applying = false; } }
        return;
      }
      case 'side_swap': if (d.attackers === 'A' || d.attackers === 'B') S.att = d.attackers; return;
      case 'plant_start': S.plant = d.by || null; return;
      case 'plant_cancel': if (S.plant === d.by || d.by == null) S.plant = null; S.acting.delete(d.by); return;
      case 'bomb_planted': S.plant = null; S.acting.clear(); return;
      case 'defuse_start': S.defuse = d.by || null; return;
      case 'defuse_cancel': if (S.defuse === d.by || d.by == null) S.defuse = null; S.acting.delete(d.by); return;
      case 'bomb_defused': case 'bomb_exploded': S.defuse = null; S.acting.clear(); return;
      default: return;
    }
  });
  net.on('round', r => {
    if (!r) return;
    if (r.attackers === 'A' || r.attackers === 'B') S.att = r.attackers;
    S.phase = r.phase || '';
    if (r.phase === 'freeze') { S.plant = S.defuse = S.planter = null; S.acting.clear(); S.target = Math.random() < 0.5 ? 'A' : 'B'; queueMicrotask(placeSides); }
  });
  /** Bomb: each side starts on its own spawns (side 0 attacks), the bots after the humans of their team (same slots as modes.js). */
  function placeSides() {
    if (!S.sim || !E.cfg || E.cfg.mode !== 'bomb') return;
    const att = S.att === 'A' ? 0 : 1, list = [...S.mine.values()].filter(a => a.alive && (a.team === 0 || a.team === 1)).sort((x, y) => (x.id < y.id ? -1 : 1)), k = [0, 0];
    for (const a of list) {
      const sp = E.spawns(a.team === att ? 0 : 1) || []; if (!sp.length) continue;
      const s = sp[k[a.team]++ % sp.length];
      E.respawn(a, { at: [s[0], s[1]], delay: 0 });
      setOrder(a, 'hold', a.pos.x, a.pos.z, 1);
    }
  }

  /* ---------- what the simulator reports ---------- */
  const proj = E.projectiles, rawSpawn = proj && proj.spawn;
  if (proj && rawSpawn) proj.spawn = function (def, owner, x, y, z, vx, vy, vz, mul, visual, ...rest) {
    const id = rawSpawn.call(this, def, owner, x, y, z, vx, vy, vz, mul, visual, ...rest);
    try {
      if (id && !visual && S.sim && owner && S.mine.get(owner.id) === owner && out.f.length < 32) {
        const l = Math.hypot(vx, vy, vz) || 1;
        out.f.push([owner.id, r2(x), r2(y), r2(z), +(vx / l).toFixed(4), +(vy / l).toFixed(4), +(vz / l).toFixed(4), def.id, def.kind === 'thrown' ? 't' : 'p', id, r2(vx), r2(vy), r2(vz)]);
        S.stats.shots++;
      }
    } catch { /* a lost mirror must not stop the shot */ }
    return id;
  };
  E.on('shot', e => {
    const a = e && e.actor; if (!S.sim || !a || S.mine.get(a.id) !== a || out.f.length >= 32) return;
    const def = a.wdef; if (!def || def.kind === 'projectile' || def.kind === 'thrown') return;       // those go through proj.spawn above
    const cp = Math.cos(a.pitch || 0), oy = a.pos.y + (a.crouch > 0.5 ? 1.05 : 1.5);
    out.f.push([a.id, r2(a.pos.x), r2(oy), r2(a.pos.z), +(-Math.sin(a.yaw) * cp).toFixed(4), +Math.sin(a.pitch || 0).toFixed(4), +(-Math.cos(a.yaw) * cp).toFixed(4), def.id]);
    S.stats.shots++;
  });
  E.on('explosion', e => {
    const by = e && e.by; if (!S.sim || !by || S.mine.get(by.id) !== by || !e.weaponId) return;
    if (out.b.length < 8) { out.b.push([by.id, r2(e.x), r2(e.y), r2(e.z), e.weaponId, 0]); S.stats.booms++; }
    S.boomBy = by; S.boomW = e.weaponId;
    queueMicrotask(() => { S.boomBy = null; S.boomW = null; });       // the engine hurts the bodies right after this event, in the same call
  });
  E.on('damage', e => {
    if (S.applying || !S.sim || !e) return;
    const a = e.attacker; if (!a || S.mine.get(a.id) !== a || !(e.amount > 0)) return;
    const v = e.victim; if (!v) return;
    const vid = v === E.player ? net.id : (v.isRemote && v.kind !== 'zombie') || v.netRef ? v.id : null;
    if (!vid || out.h.length >= 48) return;
    let w = a.weaponId, splash = 0;
    if (S.boomBy === a && S.boomW) { w = S.boomW; splash = 1; }
    else if (a.wdef && a.wdef.proj && a.wdef.proj.radius > 0) return;       // a rocket's direct hit: the blast that follows carries the damage
    out.h.push([a.id, vid, r2(e.amount), e.head ? 1 : 0, w, splash]);
    S.stats.hits++;
  });

  /* ---------- objectives: Domination points, Bomb sites ---------- */
  const modeImpl = () => { try { const m = E.internals && E.internals.mode; return m && m.impl ? m.impl : null; } catch { return null; } };
  function domOrders() {
    const impl = modeImpl(), Z = impl && impl.points; if (!Z || !Z.length) return;
    for (let team = 0; team < 2; team++) {
      const cnt = [0, 0, 0], letter = teamLetter(team); let idx = 0;
      for (const a of S.mine.values()) {
        if (!a.alive || a.team !== team || !a.ai) continue;
        const holder = idx++ % 3 === 2; let best = -1, bestV = Infinity, hold = false;
        if (holder) for (let k = 0; k < Z.length; k++) { if (Z[k].owner !== letter) continue; const v = cnt[k] * 30 + Math.sqrt(d2(a.pos.x, a.pos.z, Z[k].x, Z[k].z)); if (v < bestV) { bestV = v; best = k; hold = true; } }
        if (best < 0) for (let k = 0; k < Z.length; k++) { if (Z[k].owner === letter) continue; const v = cnt[k] * 14 + Math.sqrt(d2(a.pos.x, a.pos.z, Z[k].x, Z[k].z)) - (a.data.zone === k ? 6 : 0); if (v < bestV) { bestV = v; best = k; } }
        if (best < 0) { hold = true; for (let k = 0; k < Z.length; k++) if (cnt[k] < bestV) { bestV = cnt[k]; best = k; } }
        if (best < 0) continue;
        cnt[best]++; a.data.zone = best;
        const r = Z[best].r || DOM_R;
        if (hold) setOrder(a, 'hold', Z[best].x, Z[best].z, r - 1); else setOrder(a, 'goto', Z[best].x, Z[best].z, r * 0.5);
      }
    }
  }
  function bombState() { const impl = modeImpl(); return impl && impl.state && impl.state.sites ? impl.state : null; }
  function bombOrders() {
    const B = bombState(); if (!B || S.phase === 'freeze' || S.phase === 'intermission') return;
    const att = S.att === 'A' ? 0 : 1, site = B.sites[S.target] || B.sites.A, bomb = S.phase === 'planted' ? B.bomb : null;
    let ia = 0, id = 0;
    for (const a of S.mine.values()) {
      if (!a.alive || !a.ai || S.acting.has(a.id)) continue;
      if (a.team === att) {
        if (bomb) setOrder(a, 'hold', bomb.x, bomb.z, 7);
        else if (ia++ < 2) setOrder(a, 'goto', site.x, site.z, 1.5);       // two go straight to the site to plant, the others cover it
        else setOrder(a, 'goto', site.x, site.z, SITE_R);
      } else if (bomb) setOrder(a, 'goto', bomb.x, bomb.z, 1.2);
      else { const s = B.sites[id++ & 1 ? 'B' : 'A']; setOrder(a, 'hold', s.x, s.z, SITE_R + 2); }
    }
  }
  /** Plant and defuse: a bot standing on the spot holds still and asks the server, which times it as for a player. */
  function bombActs(dt) {
    const B = bombState(); if (!B) return;
    const att = S.att === 'A' ? 0 : 1;
    for (const [bid, t] of [...S.acting]) {
      const a = S.mine.get(bid);
      if (!a || !a.alive) { S.acting.delete(bid); continue; }
      if (S.plant === bid || S.defuse === bid) { S.acting.set(bid, ACT_RESEND); continue; }       // the server is timing it
      if (t - dt > 0) S.acting.set(bid, t - dt); else S.acting.delete(bid);       // refused or cancelled: free to try again
    }
    if (S.acting.size) return;
    if (S.phase === 'live' && !S.plant) {
      const site = B.sites[S.target] || B.sites.A;
      for (const a of S.mine.values()) {
        if (!a.alive || a.team !== att) continue;
        if (d2(a.pos.x, a.pos.z, site.x, site.z) > (site.r || SITE_R) * (site.r || SITE_R) * 0.8) continue;
        S.acting.set(a.id, ACT_RESEND); setOrder(a, 'hold', a.pos.x, a.pos.z, 0.6); out.a.push([a.id, 'plant_start', S.target]); S.stats.acts++;
        break;
      }
    } else if (S.phase === 'planted' && B.bomb && !S.defuse) {
      for (const a of S.mine.values()) {
        if (!a.alive || a.team === att) continue;
        if (d2(a.pos.x, a.pos.z, B.bomb.x, B.bomb.z) > DEFUSE_R * DEFUSE_R) continue;
        S.acting.set(a.id, ACT_RESEND); setOrder(a, 'hold', a.pos.x, a.pos.z, 0.6); out.a.push([a.id, 'defuse_start']); S.stats.acts++;
        break;
      }
    }
  }

  /* ---------- the frame ---------- */
  function flush() {
    const s = out.s; s.length = 0;
    for (const a of S.mine.values()) {
      if (!a.alive || s.length >= 12) continue;
      const e = a.data.bt || (a.data.bt = new Array(10)); e[0] = a.id;
      e[1] = r2(a.pos.x); e[2] = r2(a.pos.y); e[3] = r2(a.pos.z); e[4] = r2(wrap(a.yaw)); e[5] = r2(Math.max(-1.5, Math.min(1.5, a.pitch || 0)));
      e[6] = r2(Math.max(-55, Math.min(55, a.vx || 0))); e[7] = r2(Math.max(-55, Math.min(55, a.vz || 0))); e[8] = a.weaponId; e[9] = a.crouch > 0.5 ? 1 : 0;
      s.push(e);
    }
    const m = { s };
    if (out.f.length) m.f = out.f.splice(0, 32);
    if (out.b.length) m.b = out.b.splice(0, 8);
    if (out.h.length) m.h = out.h.splice(0, 48);
    if (out.a.length) m.a = out.a.splice(0, 8);
    const now = performance.now();
    if (!s.length && !m.f && !m.b && !m.h && !m.a && now - S.lastSent < 1000) return;       // all my bots dead (a Bomb round): still one report a second, or the server would think this simulator gone
    S.lastSent = now; net.sendBots(m); S.stats.sent++;
  }
  E.on('tick', dt => {
    if (!online() || E.loading || !(dt > 0)) return;
    S.ft += (Math.min(dt, 0.25) * 1000 - S.ft) * (S.ftN < 30 ? 0.2 : 0.04); S.ftN++;
    S.perfT += dt; if (S.perfT >= PERF) { S.perfT = 0; if (net.sendPerf) net.sendPerf({ ft: Math.round(S.ft * 10) / 10, rtt: Math.round(net.rtt || 0) }); }
    if (!S.sim || !S.mine.size) return;
    if (S.gunQ.length && (S.gunT -= dt) <= 0) {       // one weapon model per few frames: no burst of soldier rebuilds at the start
      S.gunT = 0.08; const a = S.gunQ.shift();
      if (a && S.mine.get(a.id) === a) { E.addRemote({ id: a.id, weaponId: gunFor(a.id) }); a.speed = 4.7 * ((a.wdef && a.wdef.mob) || 1); a.ai = newBotAI('normal', ++S.seq); }
    }
    const mode = E.cfg.mode;
    if ((S.orderT -= dt) <= 0) { S.orderT = ORDERS; if (mode === 'dom') domOrders(); else if (mode === 'bomb') bombOrders(); }
    if (mode === 'bomb' && (S.actT -= dt) <= 0) { const step = ACT - S.actT; S.actT = ACT; bombActs(step); }
    if ((S.sendT -= dt) <= 0) { S.sendT = Math.max(0, S.sendT + SEND); if (S.sendT > SEND) S.sendT = SEND; flush(); }
  });
  return { state: S, apply, get sim() { return S.sim; }, get mine() { return [...S.mine.keys()]; } };
}
