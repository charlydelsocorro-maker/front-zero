/* FRONT ZERO multiplayer client. n.remote(id, timeNow) expects performance.now() milliseconds. */
const EVENTS = ['room', 'start', 'state', 'shot', 'damage', 'death', 'respawn', 'score', 'round', 'action', 'end', 'error', 'close', 'boom'];
const SEND_INTERVAL = 50, INTERP_DELAY = 100, MAX_EXTRAPOLATE = 100, BUFFER = 24, SNAP_DIST = 8, PING_MS = 2000;
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
    offset = best.offset; n.rtt = rtt;
  }
  function pushSnapshot(s, ts) {
    let b = buffers.get(s.id);
    if (!b) buffers.set(s.id, b = []);
    if (b.length && ts <= b[b.length - 1].ts) return;
    b.push({ ...s, ts });
    if (b.length > BUFFER) b.shift();
  }
  function pruneBuffers(players) {
    const ids = new Set(players.map(p => p.id));
    for (const id of buffers.keys()) if (!ids.has(id)) buffers.delete(id);
  }
  function onMessage(ev) {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'welcome': return;
      case 'pong': return onPong(m);
      case 'states':
        for (const s of m.s) {
          if (s.id === n.id) continue;
          pushSnapshot(s, m.ts);
          emit('state', { ...s, ts: m.ts });
        }
        return;
      case 'room':
        n.room = m; pruneBuffers(m.players);
        break;
      case 'start':
        n.room = m; buffers.clear(); n.lastRound = null; n.lastScore = null;
        break;
      // The match's first 'round' and 'score' arrive while the client is still loading the map: keep the latest for a late replay.
      case 'round': n.lastRound = { ...m, at: clock() }; break;
      case 'score': n.lastScore = { ...m, at: clock() }; break;
      case 'end': n.lastRound = null; n.lastScore = null; break;
      case 'respawn':
        buffers.delete(m.id);
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
            stopTimers();
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

    createRoom({ name, mode, map } = {}) { withConnection({ t: 'create', name, mode, map }); },
    joinRoom(code, name) { withConnection({ t: 'join', code, name }); },
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
        raw(pendingState);
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
    sendAction(type, data) { send({ t: 'action', type, data }); },

    on(event, fn) {
      if (!handlers.has(event)) throw new Error(`Unknown net event: ${event}`);
      handlers.get(event).add(fn);
      return () => handlers.get(event).delete(fn);
    },

    remote(id, timeNow = clock()) {
      const b = buffers.get(id);
      if (!b || !b.length) return null;
      const at = timeNow + offset - INTERP_DELAY;
      const last = b[b.length - 1];
      if (at >= last.ts) {
        const dt = Math.min(at - last.ts, MAX_EXTRAPOLATE) / 1000;
        return { ...last, x: last.x + last.vx * dt, z: last.z + last.vz * dt };
      }
      if (at <= b[0].ts) return { ...b[0] };
      let i = b.length - 2;
      while (i > 0 && b[i].ts > at) i--;
      const a = b[i], c = b[i + 1];
      if (Math.hypot(c.x - a.x, c.y - a.y, c.z - a.z) > SNAP_DIST) return { ...c };
      const k = (at - a.ts) / (c.ts - a.ts);
      return {
        ...c, ts: at,
        x: lerp(a.x, c.x, k), y: lerp(a.y, c.y, k), z: lerp(a.z, c.z, k),
        vx: lerp(a.vx, c.vx, k), vz: lerp(a.vz, c.vz, k),
        yaw: lerpAngle(a.yaw, c.yaw, k), pitch: lerp(a.pitch, c.pitch, k),
      };
    },
  };
  return n;
}
