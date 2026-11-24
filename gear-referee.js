// FRONT ZÉRO — equipment referee. The same code runs on the server (one core per match) and in the browser for solo play, so the rules cannot differ.
// It owns carried counts, medical use and heal over time, placed objects, fuses, triggers and area damage. No import/export (see zone-rules.js).
(function (root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./gear-data.js') : root.FZGearData;
  const { ITEMS } = D;
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  const r2 = v => Math.round(v * 100) / 100;
  const MAX_OBJS = 48, USE_GAP = 350, THROW_GAP = 800, PLACE_GAP = 700, REACH = 3.6;

  /** h = { now(), all(msg, except), send(p, msg), players() -> iterable, isEnemy(owner, q), canFight(), blast(owner, id, x, y, z, oid), hurt(q, amount, owner, id), refill(p), npcs() -> bool } */
  function createGearCore(h) {
    const objs = new Map(); let seq = 0;
    const view = o => ({ oid: o.oid, id: o.id, by: o.by, team: o.team, x: o.x, y: o.y, z: o.z, yaw: o.yaw, st: o.st, age: Math.max(0, h.now() - o.t0), arm: Math.max(0, o.armAt - h.now()), left: o.until ? Math.max(0, o.until - h.now()) : 0, ...(o.polar ? { polar: o.polar } : null), ...(o.c ? { c: o.c } : null) });
    const counts = g => ({ L: { id: g.s.L.id, n: g.s.L.n }, T: { id: g.s.T.id, n: g.s.T.n }, M: { id: g.s.M.id, n: g.s.M.n } });
    const ownerOf = o => { for (const q of h.players()) if (q.id === o.by) return q; return null; };
    const live = (p, id) => { let n = 0; for (const o of objs.values()) if (o.by === p.id && o.id === id && o.st !== 'gone') n++; return n; };
    const slotOf = (g, id) => { const it = ITEMS[id]; if (!it || !g) return null; const s = g.s[it.slot]; return s && s.id === id ? s : null; };

    function load(p, m) {
      if (p.gx && p.gx.life === p.life) return;       // first report of a life wins
      const c = D.cleanLoadout(m.s), s = {};
      const empty = !!(h.emptyStart && h.emptyStart());       // Zone: everything is found in crates and on the dead
      for (const k of ['L', 'T', 'M']) s[k] = { id: c[k], n: empty || ITEMS[c[k]].kind === 'weapon' ? 0 : ITEMS[c[k]].carry };       // the frag keeps its own count
      p.gx = { life: p.life, s, use: null, hot: null, next: {}, fx: {}, hpAt: 0 };
      h.send(p, { t: 'gx', op: 'inv', s: counts(p.gx) });
    }
    function cancel(p, why) {
      const g = p.gx; if (!g || !g.use) return;
      g.use = null; h.send(p, { t: 'gx', op: 'cancel', why: why || '' });
    }
    function startUse(p, m, now) {
      const g = p.gx, it = ITEMS[m.id];
      if (!g || !it || it.kind !== 'med' || !it.live || p.status !== 'alive' || !h.canFight()) return h.send(p, { t: 'gx', op: 'cancel', why: 'refused' });
      const s = slotOf(g, m.id);
      if (!s || s.n <= 0 || g.use || now < (g.next.use || 0)) return h.send(p, { t: 'gx', op: 'cancel', why: 'refused' });
      if (it.heal && !it.boost && p.hp >= p.maxHp) return h.send(p, { t: 'gx', op: 'cancel', why: 'full' });
      if (it.armor && p.armor >= Math.max(p.maxArmor || 0, it.armorCap)) return h.send(p, { t: 'gx', op: 'cancel', why: 'full' });
      g.use = { id: m.id, end: now + it.useMs };
      h.send(p, { t: 'gx', op: 'use', id: m.id, ms: it.useMs });
    }
    function finishUse(p, g, now) {
      const u = g.use, it = ITEMS[u.id], s = g.s[it.slot]; g.use = null; g.next.use = now + USE_GAP;
      if (!s || s.id !== u.id || s.n <= 0) return h.send(p, { t: 'gx', op: 'cancel', why: 'refused' });
      s.n--;
      if (it.heal) g.hot = { rate: it.heal / it.hotMs, left: it.heal, end: now + it.hotMs };
      if (it.armor) { p.armor = r2(Math.min(Math.max(p.maxArmor || 0, it.armorCap), (p.armor || 0) + it.armor)); }
      if (it.boost) { g.fx.boost = now + it.boostMs; g.fx.after = now + it.boostMs + it.afterMs; }
      h.send(p, { t: 'gx', op: 'done', id: u.id, n: s.n, hp: r2(p.hp), armor: r2(p.armor || 0), hot: it.heal ? it.hotMs : 0, boost: it.boost ? it.boostMs : 0, after: it.boost ? it.afterMs : 0 });
    }
    function add(p, it, id, x, y, z, yaw, st, now) {
      if (objs.size >= MAX_OBJS) { const old = objs.values().next().value; del(old); }
      const o = { oid: ++seq, id, by: p.id, team: p.team === undefined ? null : p.team, x: r2(x), y: r2(y), z: r2(z), yaw: r2(yaw || 0), st, t0: now, armAt: now + (it.armMs || 0), fuseAt: 0, until: 0, hp: it.hp || 0, polar: null, used: null, ox: x, oy: y, oz: z, sp: 0 };
      objs.set(o.oid, o); return o;
    }
    function del(o) { if (!objs.delete(o.oid)) return; o.st = 'gone'; h.all({ t: 'gx', op: 'del', oid: o.oid }); }

    function onThrow(p, m, now) {
      const g = p.gx, it = ITEMS[m.id];
      const bad = () => h.send(p, { t: 'gx', op: 'nope', c: m.c | 0, id: m.id });
      if (!g || !it || it.kind !== 'throw' || !it.live || p.status !== 'alive' || !h.canFight()) return bad();
      const s = slotOf(g, m.id); if (!s || s.n <= 0 || now < (g.next[m.id] || 0)) return bad();
      if (!num(m.x, -6000, 6000) || !num(m.y, -200, 1000) || !num(m.z, -6000, 6000)) return bad();
      const lim = it.speed * 1.5 + 15;
      if (!num(m.vx, -lim, lim) || !num(m.vy, -lim, lim) || !num(m.vz, -lim, lim) || Math.hypot(m.vx, m.vy, m.vz) > lim) return bad();
      if (p.hasPos !== false && Math.hypot(m.x - p.x, m.y - (p.y + 1.5), m.z - p.z) > 4) return bad();
      s.n--; g.next[m.id] = now + THROW_GAP;
      const o = add(p, it, m.id, m.x, m.y, m.z, 0, 'fly', now); o.fuseAt = now + it.fuseMs; o.sp = Math.hypot(m.vx, m.vy, m.vz);
      h.send(p, { t: 'gx', op: 'thrown', c: m.c | 0, oid: o.oid, id: m.id, n: s.n });
      h.all({ t: 'gx', op: 'fly', oid: o.oid, id: m.id, by: p.id, team: o.team, x: r2(m.x), y: r2(m.y), z: r2(m.z), vx: r2(m.vx), vy: r2(m.vy), vz: r2(m.vz) }, p);
    }
    function onLand(p, m, now) {
      const o = objs.get(m.oid); if (!o || o.by !== p.id || o.st !== 'fly') return;
      if (!num(m.x, -6000, 6000) || !num(m.y, -200, 1000) || !num(m.z, -6000, 6000)) return;
      const age = (now - o.t0) / 1000, reach = (o.sp + 12) * Math.min(6, age + 0.5) + 3;
      if (Math.hypot(m.x - o.ox, m.y - o.oy, m.z - o.oz) > reach) return;
      o.x = r2(m.x); o.y = r2(m.y); o.z = r2(m.z); o.st = 'rest';
      h.all({ t: 'gx', op: 'land', oid: o.oid, x: o.x, y: o.y, z: o.z, ...(m.stuck ? { stuck: String(m.stuck).slice(0, 16) } : null) }, p);
      if (ITEMS[o.id].shatter) o.fuseAt = now;       // a bottle breaks where it lands
    }
    function onPlace(p, m, now) {
      const g = p.gx, it = ITEMS[m.id];
      const bad = why => h.send(p, { t: 'gx', op: 'nope', c: m.c | 0, id: m.id, why: why || '' });
      if (!g || !it || it.kind !== 'place' || !it.live || p.status !== 'alive' || !h.canFight()) return bad();
      const s = slotOf(g, m.id); if (!s || s.n <= 0 || now < (g.next[m.id] || 0)) return bad();
      if (!num(m.x, -6000, 6000) || !num(m.y, -200, 1000) || !num(m.z, -6000, 6000) || !num(m.yaw, -20, 20)) return bad();
      if (p.hasPos !== false && Math.hypot(m.x - p.x, m.y - p.y, m.z - p.z) > REACH) return bad();
      if (it.maxOut && live(p, m.id) >= it.maxOut) return bad('limit');
      s.n--; g.next[m.id] = now + PLACE_GAP;
      const o = add(p, it, m.id, m.x, m.y, m.z, m.yaw, 'placed', now);
      if (it.ms) o.until = now + it.ms;
      if (it.charges) o.c = it.charges;
      h.send(p, { t: 'gx', op: 'placed', c: m.c | 0, oid: o.oid, id: m.id, n: s.n });
      h.all({ t: 'gx', op: 'obj', o: view(o) }, p);
    }
    /** Fuse or trigger reached. Blast items go through the owner's client (cover, credit) with the existing boom and splash checks. */
    function detonate(o, now) {
      const it = ITEMS[o.id], owner = ownerOf(o);
      if (it.dmg && it.radius) {
        h.all({ t: 'gx', op: 'det', oid: o.oid, id: o.id, by: o.by, x: o.x, y: o.y, z: o.z, yaw: o.yaw });
        objs.delete(o.oid); o.st = 'gone';
        if (owner) h.blast(owner, o.id, o.x, o.y, o.z, o.oid);
        return;
      }
      if (it.fire) { o.st = 'fire'; o.until = now + it.fire.ms; o.tickAt = now; }
      else if (it.cloud) { o.st = 'cloud'; o.until = now + it.cloud.ms; }
      else if (it.decoy) { o.st = 'decoy'; o.until = now + it.decoy.ms; }
      else { o.st = 'spent'; o.until = now + 200; }
      h.all({ t: 'gx', op: 'det', oid: o.oid, id: o.id, by: o.by, x: o.x, y: o.y, z: o.z, yaw: o.yaw, left: o.until - now });
    }
    function onTrig(p, m, now) {
      const o = objs.get(m.oid), it = o && ITEMS[o.id];
      if (!o || o.by !== p.id || !it || it.kind !== 'place' || !it.trigR || o.st !== 'placed' || now < o.armAt) return;
      let near = h.npcs();
      for (const q of h.players()) { if (q === p || q.status !== 'alive' || q.hasPos === false || !h.isEnemy(p, q)) continue; if (Math.hypot(q.x - o.x, q.z - o.z) <= it.trigR + 1.6) near = true; }
      if (!near) return;
      o.st = 'trig'; o.fuseAt = now + it.trigMs;
      h.all({ t: 'gx', op: 'beep', oid: o.oid });
    }
    function onRemote(p, now) {
      for (const o of [...objs.values()]) { const it = ITEMS[o.id]; if (o.by === p.id && it.remote && o.st === 'placed' && now >= o.armAt) detonate(o, now); }
    }
    function onHitObj(p, m, now) {
      const o = objs.get(m.oid), it = o && ITEMS[o.id];
      if (!o || !it || !it.hp || !num(m.d, 0.1, 400) || (o.st !== 'placed' && o.st !== 'trig') || !h.canFight()) return;
      if (p.hasPos !== false && Math.hypot(p.x - o.x, p.z - o.z) > 170) return;
      o.hp -= m.d;
      if (o.hp > 0) return h.all({ t: 'gx', op: 'objhp', oid: o.oid, f: r2(o.hp / it.hp) });
      if (it.dmg && it.radius) detonate(o, now); else del(o);
    }
    function onFire(p, m) {
      const o = objs.get(m.oid); if (!o || o.by !== p.id || o.st !== 'fire' || o.polar) return;
      const it = ITEMS[o.id]; if (!Array.isArray(m.r) || m.r.length !== 8 || !m.r.every(v => num(v, 0, it.fire.r + 0.01))) return;
      o.polar = m.r.map(r2); h.all({ t: 'gx', op: 'polar', oid: o.oid, r: o.polar }, p);
    }
    function onAmmo(p, m, now) {
      const o = objs.get(m.oid), it = o && ITEMS[o.id], g = p.gx;
      if (!o || !g || !it || !it.charges || o.st !== 'placed' || now < o.armAt || p.status !== 'alive' || !(o.c > 0)) return;
      if (o.team !== null && o.team !== p.team) return;
      if (o.team === null && o.by !== p.id) return;       // free-for-all: your own crate only
      if (p.hasPos !== false && Math.hypot(p.x - o.x, p.z - o.z) > it.useR + 1) return;
      o.used = o.used || {}; if (now < (o.used[p.id] || 0)) return;
      o.used[p.id] = now + 12000; o.c--;
      for (const k of ['L', 'T']) { const s = g.s[k], item = ITEMS[s.id]; if (item.kind !== 'weapon' && s.id !== 'ammobox' && s.n < item.carry) s.n++; }
      try { h.refill(p); } catch { /* optional */ }
      h.send(p, { t: 'gx', op: 'ammo', oid: o.oid, s: counts(g) });
      if (o.c <= 0) del(o); else h.all({ t: 'gx', op: 'objc', oid: o.oid, c: o.c });
    }

    function tickPlayers(now, dt) {
      for (const p of h.players()) {
        const g = p.gx; if (!g || p.status !== 'alive') continue;
        if (g.use && now >= g.use.end) finishUse(p, g, now);
        if (g.hot) {
          const add = Math.min(g.hot.left, g.hot.rate * dt); g.hot.left -= add; p.hp = Math.min(p.maxHp, p.hp + add);
          const end = g.hot.left <= 0.001 || now >= g.hot.end + 200 || p.hp >= p.maxHp;
          if (end) g.hot = null;
          if (end || now - g.hpAt >= 200) { g.hpAt = now; h.send(p, { t: 'gx', op: 'hp', hp: r2(p.hp), armor: r2(p.armor || 0), on: end ? 0 : 1 }); }
        }
      }
    }
    function tickObjs(now) {
      for (const o of [...objs.values()]) {
        const it = ITEMS[o.id];
        if ((o.st === 'fly' || o.st === 'rest' || o.st === 'trig') && o.fuseAt && now >= o.fuseAt) { detonate(o, now); continue; }
        if (o.until && now >= o.until) { del(o); continue; }
        if (o.st === 'fire' && now >= o.tickAt + 250) {
          const owner = ownerOf(o), step = (now - o.tickAt) / 1000; o.tickAt = now;
          for (const q of h.players()) {
            if (q.status !== 'alive' || q.hasPos === false || Math.abs(q.y - o.y) > 1.6) continue;
            if (owner && q !== owner && !h.isEnemy(owner, q)) continue;
            const dx = q.x - o.x, dz = q.z - o.z, d = Math.hypot(dx, dz); let r = it.fire.r;
            if (o.polar) { const a = (Math.atan2(dz, dx) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 4), i = Math.floor(a) % 8, f = a - Math.floor(a); r = o.polar[i] * (1 - f) + o.polar[(i + 1) % 8] * f; }
            if (d <= r) h.hurt(q, it.fire.dps * step, owner, o.id);
          }
        }
        if (o.id === 'wire' && o.st === 'placed' && now >= o.armAt) {
          if (!o.tickAt) o.tickAt = now;
          if (now >= o.tickAt + 400) {
            const owner = ownerOf(o), step = (now - o.tickAt) / 1000; o.tickAt = now;
            const c = Math.cos(o.yaw), sn = Math.sin(o.yaw);
            for (const q of h.players()) {
              if (q.status !== 'alive' || q.hasPos === false || Math.abs(q.y - o.y) > 1.2 || (owner && (q === owner || !h.isEnemy(owner, q)))) continue;
              const dx = q.x - o.x, dz = q.z - o.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c;
              if (Math.abs(lx) <= it.halfW && Math.abs(lz) <= it.halfD && Math.hypot(q.vx || 0, q.vz || 0) > 0.4) h.hurt(q, it.dps * step, owner, o.id);
            }
          }
        }
      }
    }
    return {
      msg(p, m) {
        const now = h.now();
        switch (m.a) {
          case 'load': return load(p, m);
          case 'use': return startUse(p, m, now);
          case 'cancel': return cancel(p, 'user');
          case 'throw': return onThrow(p, m, now);
          case 'land': return onLand(p, m, now);
          case 'place': return onPlace(p, m, now);
          case 'trig': return onTrig(p, m, now);
          case 'remote': return onRemote(p, now);
          case 'hitobj': return onHitObj(p, m, now);
          case 'fire': return onFire(p, m);
          case 'ammo': return onAmmo(p, m, now);
          case 'sync': { const out = []; for (const o of objs.values()) if (o.st !== 'gone') out.push(view(o)); return h.send(p, { t: 'gx', op: 'sync', objs: out, ...(p.gx ? { s: counts(p.gx) } : null) }); }
        }
        return undefined;
      },
      tick(now, dt) { tickPlayers(now, dt); tickObjs(now); },
      /** Damage taken: a fragile use (the long medkit) is interrupted. */
      onDamage(p) { const g = p.gx; if (g && g.use && ITEMS[g.use.id].fragile) cancel(p, 'hit'); },
      /** Death or a new life: nothing keeps running on this body. What it carried is returned for the drop. */
      onDeath(p) {
        const g = p.gx; if (!g) return null;
        const left = []; for (const k of ['L', 'T', 'M']) { const s = g.s[k]; if (s.n > 0 && ITEMS[s.id].kind !== 'weapon') left.push({ id: s.id, n: s.n }); }
        g.use = null; g.hot = null; g.fx = {}; p.gx = null;
        h.send(p, { t: 'gx', op: 'cancel', why: 'dead' });
        return left;
      },
      onLife(p) { if (p.gx) { p.gx = null; } },
      onLeave(p) { for (const o of [...objs.values()]) if (o.by === p.id) del(o); p.gx = null; },
      /** Walking over a dropped item. Returns how many were taken. */
      take(p, id, n) {
        const g = p.gx, it = ITEMS[id]; if (!g || !it || !it.live || p.status !== 'alive') return 0;
        const s = g.s[it.slot]; if (s.id !== id) { if (s.n > 0) return 0; s.id = id; s.n = 0; }
        const k = Math.min(it.carry - s.n, n); if (k <= 0) return 0; s.n += k;
        h.send(p, { t: 'gx', op: 'inv', s: counts(g), got: id, k });
        return k;
      },
      wants(p, id) { const g = p.gx, it = ITEMS[id]; if (!g || !it) return false; const s = g.s[it.slot]; return s.id === id ? s.n < it.carry : s.n <= 0; },
      sync(p) { const out = []; for (const o of objs.values()) if (o.st !== 'gone') out.push(view(o)); h.send(p, { t: 'gx', op: 'sync', objs: out, ...(p.gx ? { s: counts(p.gx) } : null) }); },
      clear() { if (objs.size) { objs.clear(); h.all({ t: 'gx', op: 'clear' }); } },
      objs, counts,
    };
  }
  const api = { createGearCore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FZGearReferee = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
