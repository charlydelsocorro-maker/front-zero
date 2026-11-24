/* FRONT ZERO multiplayer client. n.remote(id, timeNow) expects performance.now() milliseconds. */
const EVENTS = ['room', 'start', 'state', 'shot', 'damage', 'death', 'respawn', 'score', 'round', 'action', 'end', 'error', 'close', 'boom', 'loot', 'prop', 'zone', 'att', 'gx', 'flow', 'fin', 'sg'];
const SEND_INTERVAL = 50, INTERP_DELAY = 100, MIN_DELAY = 90, MAX_DELAY = 240, MAX_EXTRAPOLATE = 100, COAST = 0.07, BUFFER = 24, SNAP_DIST = 8, PING_MS = 2000;
const WAKE_MS = 75000, WAKE_RETRY_MS = 2500;   // a free host sleeps when idle and can take up to a minute to answer

const clock = () => performance.now();
const lerp = (a, b, t) => a + (b - a) * t;
function lerpAngle(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}
// Set at publish time (<meta name="fz-server">) when the page and the game server live on different hosts.
function hostedServer() {
  if (typeof document === 'undefined') return '';
  const m = document.querySelector('meta[name="fz-server"]');
  return (m && m.content) || '';
}
function defaultUrl() {
  if (typeof location === 'undefined') return 'ws://localhost:8080/ws';
  return hostedServer() || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

const syncModule = import('./net-sync.js').catch(() => null);       // compact protocol: without it the game stays in JSON

export function createNet(url) {
  const target = url || defaultUrl();
  const handlers = new Map(EVENTS.map(e => [e, new Set()]));
  const buffers = new Map();
  const pings = [];
  let stopWake = null;
  let ws = null, connecting = null, pingTimer = 0, stateTimer = 0, lastState = -Infinity, pendingState = null, offset = 0;

  const emit = (event, data) => {
    for (const fn of [...handlers.get(event)]) {
      try { fn(data); } catch (e) { console.error(`[net] "${event}" handler failed`, e); }
    }
  };
  const isOpen = () => !!ws && ws.readyState === WebSocket.OPEN;
  const raw = o => { if (isOpen()) ws.send(JSON.stringify(o)); };
  const send = o => {
    if (isOpen() && n.id) raw(o);
    else emit('error', { code: 'not_connected' });
  };
  const withConnection = o => {
    n.connect().then(() => raw(o), () => { /* connect() already emitted the error */ });
  };
  function stopTimers() {
    clearInterval(pingTimer); clearTimeout(stateTimer);
    pingTimer = 0; stateTimer = 0; pendingState = null; lastState = -Infinity;
  }
  function ping() { raw({ t: 'ping', c: clock() }); }
  function onPong(m) {
    const now = clock(), rtt = now - m.c;
    if (rtt < 0) return;
    pings.push({ rtt, offset: m.ts + rtt / 2 - now });
    if (pings.length > 8) pings.shift();
    const best = pings.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    offset = best.offset; n.rtt = rtt; lastPong = now;
  }
  function pushSnapshot(s, ts) {
    let b = buffers.get(s.id);
    if (!b) buffers.set(s.id, b = []);
    if (b.length && ts <= b[b.length - 1].ts) return;
    b.push({ ...s, ts });
    if (b.length > BUFFER) b.shift();
  }
  // Playback clock of the remote players: the server clock estimate is slewed (a new best ping must not move everybody at once)
  // and the delay follows the real lateness of the packets, so a late one is waited for instead of guessed and corrected.
  let clockS = NaN, lastRemote = 0, delayS = INTERP_DELAY, latePeak = 0, lastArrival = 0;
  function noteArrival(ts) {
    const now = clock(), late = now + (clockS === clockS ? clockS : offset) - ts;
    latePeak = Math.max(late, latePeak - (now - lastArrival) * 0.012); lastArrival = now;
  }
  function playbackTime(now) {
    const step = Math.min(100, Math.max(0, now - lastRemote)); lastRemote = now;
    if (!(clockS === clockS) || Math.abs(offset - clockS) > 250) clockS = offset;
    else { const m = step * 0.03, d = offset - clockS; clockS += d > m ? m : d < -m ? -m : d; }
    const want = Math.min(MAX_DELAY, Math.max(MIN_DELAY, latePeak + 16)), r = step * (want > delayS ? 0.12 : 0.02), e = want - delayS;
    delayS += e > r ? r : e < -r ? -r : e;
    return now + clockS - delayS;
  }
  const outs = new Map();
  function sampleRemote(b, at, o) {
    const last = b[b.length - 1];
    if (at >= last.ts) {       // nothing newer yet: coast, slowing down, so a player who stopped is not carried past the spot and pulled back
      const t = Math.min(at - last.ts, MAX_EXTRAPOLATE) / 1000, d = t < 0.05 ? t : 0.05 + COAST * (1 - Math.exp(-(t - 0.05) / COAST));
      Object.assign(o, last); o.x = last.x + last.vx * d; o.z = last.z + last.vz * d;
      return;
    }
    if (at <= b[0].ts) { Object.assign(o, b[0]); return; }
    let i = b.length - 2;
    while (i > 0 && b[i].ts > at) i--;
    const a = b[i], c = b[i + 1];
    if (Math.hypot(c.x - a.x, c.y - a.y, c.z - a.z) > SNAP_DIST) { Object.assign(o, c); return; }
    const k = (at - a.ts) / (c.ts - a.ts), h = (c.ts - a.ts) / 1000, cx = (c.x - a.x) / h, cz = (c.z - a.z) / h;
    Object.assign(o, c); o.ts = at;
    o.x = hermite(a.x, c.x, tangent(a.vx, cx) * h, tangent(c.vx, cx) * h, k);       // speed stays continuous across snapshots
    o.z = hermite(a.z, c.z, tangent(a.vz, cz) * h, tangent(c.vz, cz) * h, k);
    o.y = lerp(a.y, c.y, k); o.vx = lerp(a.vx, c.vx, k); o.vz = lerp(a.vz, c.vz, k);
    o.yaw = lerpAngle(a.yaw, c.yaw, k); o.pitch = lerp(a.pitch, c.pitch, k);
  }
  const tangent = (v, chord) => (typeof v === 'number' && Math.abs(v - chord) < 2.5 ? v : chord);   // a wall hit or a stop: the reported speed no longer describes the segment
  function hermite(p0, p1, m0, m1, t) {
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
  }
  function pruneBuffers(players) {
    const ids = new Set(players.map(p => p.id));
    for (const id of buffers.keys()) if (!ids.has(id)) buffers.delete(id);
  }
  // Drops of the running match: they can arrive while this client is still loading the map, the engine reads them once it is ready.
  const lootItems = new Map();
  function lootMirror(m) {
    if (m.op === 'clear' || m.op === 'sync') lootItems.clear();
    if (m.op === 'add' || m.op === 'sync') { const at = clock(); for (const d of m.items || []) lootItems.set(d.id, { ...d, at }); }
    else if (m.op === 'del') { for (const id of m.ids || []) lootItems.delete(id); }
    else if (m.op === 'upd') { const d = lootItems.get(m.id); if (d) { d.a = m.a; d.r = m.r; } }
  }
  // What each player has mounted on the weapons they carry (room snapshots for late joiners, 'att' messages after that).
  const attMap = new Map();
  function attRead(players) { if (Array.isArray(players)) for (const q of players) { if (q && q.att && typeof q.att === 'object') attMap.set(q.id, q.att); if (q && q.fin && typeof q.fin === 'object') finMap.set(q.id, q.fin); if (q && typeof q.fit === 'string') fitMap.set(q.id, q.fit); } }
  const finMap = new Map();       // weapon finishes of the other players, same path as the attachments
  const fitMap = new Map();       // premium outfit of the other players (cosmetic, ids validated by the server)
  let wire = null, lastPong = 0;
  function startWire(sock) {
    syncModule.then(mod => {
      if (!mod || ws !== sock || !isOpen()) return;
      wire = mod.createWire({ socket: () => (isOpen() ? ws : null), myId: () => n.id, hostId: () => (n.room ? n.room.hostId : null), sendJson: raw, pushSnapshot, noteArrival, emit, wantsState: () => handlers.get('state').size > 0 });
      raw({ t: 'nc', v: mod.WIRE_VERSION });
    }).catch(e => console.warn('[net] compact protocol off', e));
  }
  function onMessage(ev) {
    if (typeof ev.data !== 'string') { if (wire) { try { wire.onFrame(ev.data); } catch (e) { console.warn('[net] bad frame', e); } } return; }
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'nc': if (wire) wire.onAck(m); return;
      case 'nd': if (wire) wire.onDict(m); return;
      case 'welcome': if (m.nc >= 1) startWire(ev.target); n.lootOk = m.loot === 1; n.propsOk = m.props === 1; n.zoneOk = m.zone === 1; n.attOk = m.att === 1; n.finOk = m.fin === 1; n.fitOk = m.fit === 1; n.xwOk = m.xw === 1; n.gxOk = m.gx === 1; n.flowOk = m.mf === 1; n.sgOk = m.sg === 1; return;
      case 'att': if (typeof m.id === 'string' && m.w && typeof m.w === 'object') attMap.set(m.id, m.w); break;
      case 'fin': if (typeof m.id === 'string' && m.w && typeof m.w === 'object') finMap.set(m.id, m.w); break;
      case 'fit': if (typeof m.id === 'string') { if (typeof m.o === 'string') fitMap.set(m.id, m.o); else fitMap.delete(m.id); } return;
      case 'loot': lootMirror(m); break;
      case 'pong': return onPong(m);
      case 'states':
        noteArrival(m.ts);
        for (const s of m.s) {
          if (s.id === n.id) continue;
          pushSnapshot(s, m.ts);
          emit('state', { ...s, ts: m.ts });
        }
        return;
      case 'room':
        n.room = m; pruneBuffers(m.players); attRead(m.players);
        break;
      case 'start':
        attRead(m.players);
        n.room = m; buffers.clear(); outs.clear(); n.lastRound = null; n.lastScore = null; lootItems.clear(); n.life = m.life | 0;
        break;
      // The match's first 'round' and 'score' arrive while the client is still loading the map: keep the latest for a late replay.
      case 'round': n.lastRound = { ...m, at: clock() }; break;
      case 'score': n.lastScore = { ...m, at: clock() }; break;
      case 'end': n.lastRound = null; n.lastScore = null; lootItems.clear(); break;
      case 'respawn':
        buffers.delete(m.id); outs.delete(m.id);
        if (m.id === n.id && m.life) n.life = m.life;
        break;
    }
    if (handlers.has(m.t)) {
      const { t, ...data } = m;
      emit(t, data);
    }
  }

  const n = {
    id: null, room: null, rtt: 0, lastRound: null, lastScore: null, url: target,
    get connected() { return isOpen() && !!n.id; },

    connect() {
      if (n.connected) return Promise.resolve(n);
      if (connecting) return connecting;
      connecting = new Promise((resolve, reject) => {
        let settled = false, retry = 0;
        const wakes = target === hostedServer(), until = wakes ? clock() + WAKE_MS : 0;
        const fail = code => {
          if (settled) return;
          settled = true; connecting = null; stopWake = null;
          clearTimeout(retry); clearTimeout(limit);
          emit('error', { code });
          reject(new Error(code));
        };
        const limit = wakes ? setTimeout(() => { const s = ws; fail('connect_failed'); if (s) s.close(); }, WAKE_MS) : 0;
        stopWake = () => fail('connect_failed');
        const attempt = () => {
          const sock = ws = new WebSocket(target);
          sock.binaryType = 'arraybuffer';
          let down = false;
          const lost = () => {
            if (settled || down) return;
            down = true;
            if (clock() < until) retry = setTimeout(attempt, WAKE_RETRY_MS);
            else fail('connect_failed');
          };
          const onWelcome = ev => {
            let m;
            try { m = JSON.parse(ev.data); } catch { return; }
            if (m.t !== 'welcome' || settled) return;
            settled = true; connecting = null; stopWake = null;
            clearTimeout(limit);
            sock.removeEventListener('message', onWelcome);
            n.id = m.id; offset = m.ts - clock(); pings.length = 0;
            ping();
            pingTimer = setInterval(ping, PING_MS);
            resolve(n);
          };
          sock.addEventListener('message', onWelcome);
          sock.addEventListener('message', onMessage);
          sock.addEventListener('error', lost);
          sock.addEventListener('close', ev => {
            lost();
            if (!settled || ws !== sock) return;   // still waking up: the next attempt takes over
            stopTimers(); wire = null;
            ws = null; n.id = null; n.room = null; n.lastRound = null; n.lastScore = null; buffers.clear();
            emit('close', { code: ev.code, reason: ev.reason });
          });
        };
        attempt();
      });
      return connecting;
    },
    disconnect() {
      stopTimers();
      if (stopWake) stopWake();
      if (ws) ws.close(1000, 'leave');
    },

    createRoom({ name, mode, map } = {}) { withConnection({ t: 'create', name, mode, map, zv: 1, ...(n.flowClient ? { mf: 1 } : null) }); },
    joinRoom(code, name) { withConnection({ t: 'join', code, name, zv: 1, ...(n.flowClient ? { mf: 1 } : null) }); },
    setReady(v) { send({ t: 'ready', v: !!v }); },
    setTeam(t) { send({ t: 'team', team: t }); },
    setConfig({ mode, map } = {}) { send({ t: 'config', mode, map }); },
    startMatch() { send({ t: 'start' }); },

    sendState({ x, y, z, yaw, pitch, vx, vz, weapon, crouch }) {
      if (!isOpen() || !n.id) return;
      pendingState = { t: 'state', x, y, z, yaw, pitch, vx, vz, weapon, crouch: !!crouch };
      const wait = SEND_INTERVAL - (clock() - lastState);
      const flush = () => {
        stateTimer = 0;
        if (!pendingState) return;
        lastState = clock();
        if (wire && wire.active) wire.sendState(pendingState, lastState);
        else if (isOpen() && ws.bufferedAmount < 16384) raw(pendingState);       // congested: this position is stale before it leaves
        pendingState = null;
      };
      if (wait <= 0) { clearTimeout(stateTimer); flush(); }
      else if (!stateTimer) stateTimer = setTimeout(flush, wait);
    },
    // k: 'p' projectile, 't' thrown, 'm' melee (absent = hitscan). pid and the optional velocity let the other clients mirror the projectile.
    sendShot({ ox, oy, oz, dx, dy, dz, weapon, k, pid, vx, vy, vz }) {
      const m = { t: 'shot', ox, oy, oz, dx, dy, dz, weapon };
      if (k) { m.k = k; if (pid) m.pid = pid; if (typeof vx === 'number') { m.vx = vx; m.vy = vy; m.vz = vz; } }
      send(m);
    },
    // splash: the hit comes from the blast of our last reported detonation (sendBoom), not from a direct hit.
    sendHit({ target, damage, head, weapon, splash }) { const m = { t: 'hit', target, damage, head: !!head, weapon }; if (splash) m.splash = true; send(m); },
    /** Detonation of one of our own projectiles. The server relays it ('boom' event: {id, x, y, z, weapon, pid}) and validates the splash hits that follow against it. */
    sendBoom({ x, y, z, weapon, pid }) { send({ t: 'boom', x, y, z, weapon, pid: pid || 0 }); },
    sendAction(type, data) { if (wire && wire.active && isOpen() && n.id && wire.sendAction(type, data)) return; send({ t: 'action', type, data }); },
    /** Connection quality for the HUD indicator. */
    quality() { const now = clock(); let lo = Infinity, hi = 0; for (const p of pings) { if (p.rtt < lo) lo = p.rtt; if (p.rtt > hi) hi = p.rtt; } return { connected: n.connected, rtt: n.rtt, jitter: pings.length > 1 ? hi - lo : 0, pongAge: lastPong ? now - lastPong : 0, delay: delayS, binary: !!(wire && wire.active) }; },
    // Loot (only when this server announced it in 'welcome'; an older server would count these as bad messages).
    lootOk: false, life: 0,
    sendInv(w, g) { if (n.lootOk && isOpen() && n.id) raw({ t: 'inv', l: n.life, w, g }); },
    sendTake(id, swap) { if (n.lootOk && isOpen() && n.id) raw({ t: 'take', id, swap: !!swap }); },
    // Attachments (only when this server announced them in 'welcome').
    attOk: false,
    sendAtt(w) { if (n.attOk && isOpen() && n.id) raw({ t: 'att', w }); },
    attOf(id, weapon) { const m = attMap.get(id); return m && Array.isArray(m[weapon]) ? m[weapon] : []; },
    // Weapon finishes (only when this server announced them in 'welcome'). Sending once, even empty, also asks to receive the others'.
    finOk: false,
    sendFin(w) { if (n.finOk && isOpen() && n.id) raw({ t: 'fin', w }); },
    // Premium outfit (only when this server announced it in 'welcome').
    fitOk: false,
    sendFit(o) { if (n.fitOk && isOpen() && n.id) raw({ t: 'fit', o: o || null }); },
    fitOf(id) { return fitMap.get(id) || null; },
    finOf(id, weapon) { const m = finMap.get(id); return m && typeof m[weapon] === 'string' ? m[weapon] : null; },
    finIds() { const out = new Set(); for (const m of finMap.values()) for (const k of Object.keys(m)) if (typeof m[k] === 'string') out.add(m[k]); return [...out]; },
    // World props (doors, glass, drums): only when this server announced them in 'welcome'.
    propsOk: false,
    sendProp(o) { if (n.propsOk && isOpen() && n.id) raw({ t: 'prop', ...o }); },
    // Equipment (only when this server announced it in 'welcome').
    gxOk: false,
    sendGear(o) { if (n.gxOk && isOpen() && n.id) raw({ t: 'gx', ...o }); },
    // End-of-match flow (match-flow.js sets flowClient once it is installed; the server announces it in 'welcome').
    flowOk: false, flowClient: false,
    sendFlow(o) { if (n.flowOk && isOpen() && n.id) raw({ t: 'flow', ...o }); },
    // Spawn protection (only when this server announced it in 'welcome'; engine-guard.js asks who is protected once it has loaded).
    sgOk: false,
    sendGuard(o) { if (n.sgOk && isOpen() && n.id) raw({ t: 'sg', ...o }); },
    /** The drops currently on the map, with their remaining lifetime. */
    lootNow() { const now = clock(), out = []; for (const d of lootItems.values()) out.push({ ...d, ttl: Math.max(0, d.ttl - (now - d.at)) }); return out; },

    on(event, fn) {
      if (!handlers.has(event)) throw new Error(`Unknown net event: ${event}`);
      handlers.get(event).add(fn);
      return () => handlers.get(event).delete(fn);
    },

    remote(id, timeNow = clock()) {
      const b = buffers.get(id);
      if (!b || !b.length) return null;
      const at = playbackTime(timeNow);
      let o = outs.get(id); if (!o) outs.set(id, o = { _t: -1, _x: 0, _z: 0, _ex: 0, _ez: 0 });       // one result object per player: called every frame
      sampleRemote(b, at, o);
      // A late packet can move the sampled path by a few cm at once: that gap is absorbed over ~90 ms instead of shown as a jump.
      const dts = o._t < 0 ? 0 : Math.min(0.2, Math.max(0, timeNow - o._t) / 1000), tx = o.x, tz = o.z;
      if (o._t < 0 || Math.hypot(tx - o._x, tz - o._z) > SNAP_DIST * 0.5) { o._ex = o._ez = 0; }
      else {
        const fade = Math.exp(-dts / 0.09), jx = tx - o._x - (o.vx || 0) * dts, jz = tz - o._z - (o.vz || 0) * dts;
        o._ex *= fade; o._ez *= fade;
        if (jx * jx + jz * jz > 0.0009) { o._ex -= jx; o._ez -= jz; }
      }
      o._t = timeNow; o._x = tx; o._z = tz; o.x = tx + o._ex; o.z = tz + o._ez;
      return o;
    },
  };
  return n;
}
