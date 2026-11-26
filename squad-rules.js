// FRONT ZÉRO — Zone in squads (Duo, Trio, Quatuor): rules shared by the browser and the server.
// No import/export on purpose, like zone-rules.js: the server loads it with require(), the browser with `import './squad-rules.js'` (globalThis.FZSquadRules).
(function (root) {
  'use strict';
  const SIZES = [2, 3, 4];
  const DOWN_HP = 100;        // health of a downed soldier: an enemy finishes it by shooting it down to 0
  const BLEED = 30;           // seconds for a downed soldier to bleed out (DOWN_HP drains over that time)
  const REVIVE = 4;           // seconds a teammate holds the interact key
  const REVIVE_R = 2.4;       // metres between the reviver and the downed soldier (the server allows a little more for lag)
  const REVIVE_HP = 30;       // health after a revive
  const CRAWL = 0.24;         // speed of a downed soldier, as a share of the normal run speed
  const PING_TTL = 9;         // seconds a ping stays on the teammates' screens
  const SQUAD_NAMES = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT'];

  const validSize = n => SIZES.indexOf(n) >= 0;
  /** Soldiers in a squad match on a map of this size: the solo count rounded up to whole squads, at least three squads, at most twelve soldiers. */
  function matchSize(base, sq) { return Math.min(12, Math.max(3 * sq, Math.ceil(base / sq) * sq)); }
  /** Squad of the n-th soldier dealt (humans first, then bots): 0-based. */
  const squadOf = (n, sq) => Math.floor(n / sq);
  /** Team id on the wire ('S1'...) and in the engine (101...): never 0/1, which are the two team colours of the team modes. */
  const wireTeam = i => 'S' + (i + 1);
  const engineTeam = i => 101 + i;
  const fromWire = v => (typeof v === 'string' && /^S\d{1,2}$/.test(v) ? 100 + Number(v.slice(1)) : null);
  const toWire = t => (typeof t === 'number' && t > 100 && t < 200 ? 'S' + (t - 100) : null);
  /** Offsets around a squad's spawn point, metres: the squad lands together without standing inside each other. */
  const SPREAD = [[0, 0], [1.4, 0.4], [-1.2, 1.1], [0.3, -1.5]];

  const api = { SIZES, DOWN_HP, BLEED, REVIVE, REVIVE_R, REVIVE_HP, CRAWL, PING_TTL, SQUAD_NAMES, SPREAD, validSize, matchSize, squadOf, wireTeam, engineTeam, fromWire, toWire };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FZSquadRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
