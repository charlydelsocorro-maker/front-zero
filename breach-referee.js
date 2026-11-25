// FRONT ZÉRO — breach referee: which panels of the match are blown. The same code runs on the server (one core per match) and in the browser
// for solo play, so the rules cannot differ (like gear-referee.js). No import/export.
// Messages (client -> referee, {t:'bk', a}): 'req' {h, x?} (after load: hash of the client's panel list, extras it found tagged in the map),
// 'plant' {id} (a plant starts), 'stop' (it stopped). Referee -> clients: {t:'bk', op:'set', ids} (state, late joiners), 'off' (another map
// build: no breach for that client), 'brk' {id, by, k} (a panel is blown), 'reset' (new Bombe round).
// The charge itself goes through gear-referee.js ('place' with pan = panel id): placeCheck() refuses it unless the panel is intact, the
// charge sits on it and its owner started a plant there at least the plant time before; detonated() blows the panel when the fuse ends.
(function (root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./map-breach-data.js') : root.FZBreachData;
  const { RULES } = D;

  /** h = { now(), map() -> map id, all(msg), send(p, msg) } */
  function createBreachCore(h) {
    let list = D.panelsFor(h.map()), hash = D.hash(list), extrasSet = false;
    const broken = new Set(), plants = new Map();
    const intact = id => Number.isInteger(id) && id >= 0 && id < list.length && !broken.has(id);
    function blow(id, by, k) { if (!intact(id)) return false; broken.add(id); h.all({ t: 'bk', op: 'brk', id, by: by || null, k: k || 'charge' }); return true; }
    return {
      get list() { return list; }, get hash() { return hash; }, broken,
      msg(p, m) {
        const now = h.now();
        if (m.a === 'req') {
          if (m.x !== undefined && !extrasSet && !broken.size) {       // the first client that brings tagged panels sets them for the match
            const ex = D.parseExtras(m.x);
            if (ex && ex.length) { list = D.panelsFor(h.map(), ex); hash = D.hash(list); extrasSet = true; }
          }
          if (typeof m.h !== 'string' || m.h !== hash) return h.send(p, { t: 'bk', op: 'off' });
          return h.send(p, { t: 'bk', op: 'set', ids: [...broken] });
        }
        if (m.a === 'plant') {
          if (!intact(m.id) || p.status !== 'alive') return;
          if (p.hasPos !== false && D.dist(list[m.id], p.x, p.y + 1, p.z) > RULES.useR + 1.5) return;
          plants.set(p.id, { id: m.id, at: now });
          return;
        }
        if (m.a === 'stop') { plants.delete(p.id); return; }
        return undefined;
      },
      /** gear-referee 'place' of an item with wall:true. Returns a refusal reason, or null. */
      placeCheck(p, m, it, now) {
        const id = m.pan;
        if (!intact(id)) return 'panel';
        const s = list[id];
        if (!D.onFace(s, m.x, m.y, m.z)) return 'panel';
        if (p.hasPos !== false && D.dist(s, p.x, p.y + 1, p.z) > RULES.useR + 1.5) return 'far';
        const pl = plants.get(p.id);
        if (!pl || pl.id !== id || now - pl.at < RULES.plantMs - 350 || now - pl.at > RULES.plantMs + 8000) return 'time';
        plants.delete(p.id);
        return null;
      },
      /** gear-referee: a blast item goes off. A breaching charge blows its panel; a C4 blows the nearest panel within reach. */
      detonated(o) {
        if (o.id === 'breach' || (o.pan !== undefined && o.id !== 'c4')) { if (intact(o.pan)) blow(o.pan, o.by, 'charge'); return; }
        if (o.id !== 'c4') return;
        let best = -1, bd = RULES.c4R;
        for (let i = 0; i < list.length; i++) { if (broken.has(i)) continue; const d = D.dist(list[i], o.x, o.y + .05, o.z); if (d <= bd) { bd = d; best = i; } }
        if (best >= 0) blow(best, o.by, 'c4');
      },
      blow,
      onLeave(p) { plants.delete(p.id); },
      /** New Bombe round: every panel is whole again. */
      reset() { plants.clear(); if (broken.size) { broken.clear(); } h.all({ t: 'bk', op: 'reset' }); },
      sync(p) { h.send(p, { t: 'bk', op: 'set', ids: [...broken] }); },
    };
  }
  const api = { createBreachCore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FZBreachReferee = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
