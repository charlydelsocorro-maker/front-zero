'use strict';
/* FRONT ZERO: end-of-match flow, server side (required by server/server.js; lives at the game root because a deploy copies only server.js from server/).
   results (8 s) -> map vote (20 s) -> winner (3 s) -> next match, same room. The server owns the proposed maps, the timers, the votes and the result.
   It only runs when every client in the room announced support (`mf: 1` in create/join); otherwise the room keeps the old behaviour. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const DUR = { results: 8000, vote: 20000, winner: 3000 };
const PROPOSED = 4, RANDOM = 'random';
const FALLBACK_MAPS = ['depot', 'vieille-ville', 'port', 'bunker', 'col-blanc', 'sept-vents', 'noirval', 'val-cendre'];
// Maps a mode must not be offered on. Every map currently has bomb sites, capture zones and a Zone plan.
const EXCLUDED = { ffa: [], tdm: [], dom: [], bomb: [], zombie: [], zone: [] };
const minPlayers = mode => (mode === 'zombie' || mode === 'zone' ? 1 : 2);
const pickOne = list => list[crypto.randomInt(list.length)];

/** The map list comes from maps.js when it can be read, so a new map is offered without touching this file. */
function readMaps() {
  try {
    const src = fs.readFileSync(path.join(__dirname, 'maps.js'), 'utf8'), at = src.indexOf('export const MAPS=['), end = src.indexOf('\n];', at);
    if (at < 0 || end < 0) return FALLBACK_MAPS;
    const ids = [...src.slice(at, end).matchAll(/\{id:'([a-z0-9-]{1,24})',name:/g)].map(m => m[1]);
    if (ids.length < PROPOSED) return FALLBACK_MAPS;
    // The vote shows real pictures: a map still without one is not offered yet. A server hosted without the pictures offers them all.
    const pictured = ids.filter(id => fs.existsSync(path.join(__dirname, 'map-shots', id + '.webp')));
    return pictured.length >= PROPOSED ? pictured : ids;
  } catch { return FALLBACK_MAPS; }
}

module.exports = function createRoomVote({ all, send, strike, reject, sendRoom, startMatch, scale }) {
  const MAPS = readMaps();
  const flowScale = Math.min(1, Math.max(0.02, Number(process.env.FZ_FLOW_SCALE) || scale || 1));
  const D = ms => Math.max(250, Math.round(ms * flowScale));

  const pool = mode => { const no = EXCLUDED[mode] || []; const list = MAPS.filter(id => !no.includes(id)); return list.length ? list : MAPS.slice(); };
  /** Four distinct maps for this mode, never the one just played unless there are too few others. */
  function propose(room) {
    const all_ = pool(room.mode), others = all_.filter(id => id !== room.map);
    const from = others.length >= PROPOSED ? others : all_, bag = from.slice(), out = [];
    while (out.length < PROPOSED && bag.length) out.push(bag.splice(crypto.randomInt(bag.length), 1)[0]);
    return out;
  }
  function tallyOf(f) {
    const t = {};
    for (const id of f.maps) t[id] = 0;
    t[RANDOM] = 0;
    for (const v of f.votes.values()) t[v] = (t[v] || 0) + 1;
    return t;
  }
  function view(room) {
    const f = room.flow;
    const v = { t: 'flow', op: 'state', phase: f.phase, left: Math.max(0, f.endsAt - Date.now()), total: f.total, maps: f.maps, tally: tallyOf(f), voted: f.votes.size, voters: room.players.size, hostId: room.hostId, mode: f.mode, played: f.played };
    if (f.phase === 'results') { v.board = f.board; v.winner = f.winner; v.reason = f.reason; v.teams = f.teams; }
    if (f.phase === 'winner') { v.pick = f.pick; v.how = f.how; v.choice = f.choice; }
    return v;
  }
  function broadcast(room) {
    const v = view(room);
    for (const q of room.players.values()) send(q, { ...v, mine: room.flow.votes.get(q.id) || null });
  }
  function toLobby(room, why) {
    room.flow = null; room.state = 'lobby';
    for (const q of room.players.values()) q.ready = false;
    all(room, { t: 'flow', op: 'lobby', why });
    sendRoom(room);
  }
  function openVote(room) {
    const f = room.flow;
    if (room.players.size < minPlayers(f.mode)) return toLobby(room, 'players');
    f.phase = 'vote'; f.total = D(DUR.vote); f.endsAt = Date.now() + f.total;
    broadcast(room);
  }
  function decide(room) {
    const f = room.flow, tally = tallyOf(f);
    let choice, how;
    if (!f.votes.size) { choice = pickOne(f.maps); how = 'none'; }
    else {
      const top = Math.max(...Object.values(tally)), tied = Object.keys(tally).filter(id => tally[id] === top);
      choice = pickOne(tied); how = tied.length > 1 ? 'tie' : 'votes';
    }
    f.choice = choice;
    if (choice === RANDOM) {
      const list = pool(f.mode), others = list.filter(id => id !== f.played);
      f.pick = pickOne(others.length ? others : list); if (how === 'votes') how = 'random';
    } else f.pick = choice;
    f.how = how; f.phase = 'winner'; f.total = D(DUR.winner); f.endsAt = Date.now() + f.total;
    broadcast(room);
  }
  function launch(room) {
    const f = room.flow;
    if (room.players.size < minPlayers(f.mode)) return toLobby(room, 'players');
    if (room.map !== f.pick) { room.map = f.pick; room.domPoints = null; room.sites = null; }      // the host's client sends the new map's points, as after a lobby change
    room.flow = null; room.state = 'lobby';
    for (const q of room.players.values()) {       // nothing of the last match survives on the player: live projectiles, detonations, last position
      q.ready = false; q.live.length = 0; q.booms.length = 0; q.hasPos = false; q.dirty = false;
    }
    startMatch(room);
  }
  const guard = (room, fn) => { try { return fn(); } catch (e) { console.error('match flow error', room.code, e); try { if (room.flow) toLobby(room, 'error'); } catch { room.flow = null; room.state = 'lobby'; } } };

  return {
    /** Before the 'end' message: will this room run the flow? */
    check(room, reason) {
      if (reason === 'server_error' || !room.players.size) return false;
      for (const q of room.players.values()) if (!q.mf) return false;
      return true;
    },
    begin(room, final, winner, reason) {
      guard(room, () => {
        const names = new Map([...room.players.values()].map(q => [q.id, q.name]));
        const board = (final.players || []).map(q => ({ id: q.id, name: names.get(q.id) || '', team: q.team, kills: q.kills, deaths: q.deaths, assists: q.assists, score: q.score }));
        const total = D(DUR.results);
        room.flow = { phase: 'results', endsAt: Date.now() + total, total, mode: room.mode, played: room.map, maps: propose(room), votes: new Map(), board, winner: winner === undefined ? null : winner, reason, teams: final.teams || null, pick: null, how: null, choice: null };
        room.state = 'flow';
        broadcast(room);
      });
    },
    tick(room, now) {
      const f = room.flow;
      if (!f || now < f.endsAt) return;
      guard(room, () => { if (f.phase === 'results') openVote(room); else if (f.phase === 'vote') decide(room); else launch(room); });
    },
    onMessage(p, m) {
      const room = p.room, f = room && room.flow;
      if (!f) return;       // a click still on the wire when the flow ended is not an error
      if (m.a === 'vote') {
        if (f.phase !== 'vote') return;
        if (typeof m.id !== 'string' || (m.id !== RANDOM && !f.maps.includes(m.id))) return strike(p, 'bad_vote');
        if (f.votes.get(p.id) === m.id) return;
        f.votes.set(p.id, m.id);
        if (f.votes.size >= room.players.size) return guard(room, () => decide(room));
        return broadcast(room);
      }
      if (m.a === 'lobby') {
        if (room.hostId !== p.id) return reject(p, 'not_host');
        return guard(room, () => toLobby(room, 'host'));
      }
      return strike(p, 'bad_flow');
    },
    /** An older client cannot follow the flow: the room goes back to the lobby before it arrives. */
    beforeJoin(room, p) { if (room.flow && !p.mf) guard(room, () => toLobby(room, 'compat')); },
    afterJoin(room, p) { if (room.flow) guard(room, () => { send(p, { ...view(room), mine: null }); if (room.flow.phase === 'vote') broadcast(room); }); },
    onLeave(room, p) {
      const f = room.flow;
      if (!f) return;
      guard(room, () => {
        f.votes.delete(p.id);
        if (f.phase !== 'results' && room.players.size < minPlayers(f.mode)) return toLobby(room, 'players');
        if (f.phase === 'vote' && f.votes.size && f.votes.size >= room.players.size) return decide(room);
        broadcast(room);
      });
    },
  };
};
