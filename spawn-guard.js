// FRONT ZÉRO — spawn protection: the rules, shared by the server (online referee) and the browser (solo referee, picture, HUD).
// No import/export on purpose (see zone-rules.js): the server loads it with require(), the browser with `import './spawn-guard.js'` (globalThis.FZSpawnGuard).
// State lives on the soldier itself: `o.sgUntil` = end of the protection on the caller's clock (ms), 0 = none.
(function (root) {
  'use strict';
  /** Protection after a respawn, in ms, one constant per mode. 0 = none:
   *  bomb: nobody respawns inside a round, and the round start (everyone at once) sits behind the freeze;
   *  zone: no respawn at all. */
  const DURATION = { ffa: 3000, tdm: 3000, dom: 3000, bomb: 0, zombie: 3000, zone: 0 };
  /** What ends it at once (moving, aiming, reloading or changing weapon do not). */
  const ENDS = ['fire', 'throw', 'gear', 'plant', 'defuse', 'capture'];
  /** Equipment messages that count as using gear ('trig', 'ammo', 'land', 'load'... are automatic, not the player's act). */
  const GEAR_ACTS = ['use', 'throw', 'place', 'remote'];
  /** Bots: extra distance (m) given to a protected enemy when choosing whom to engage, so an exposed one comes first. */
  const BOT_PENALTY = 40;

  const duration = mode => (typeof mode === 'string' && Object.prototype.hasOwnProperty.call(DURATION, mode) ? DURATION[mode] : 0);
  /** Starts the protection of `o` for this mode. Returns its length in ms (0: this mode has none, and any old one is cleared). */
  function start(o, mode, now) { const d = duration(mode); if (o) o.sgUntil = d > 0 ? now + d : 0; return o ? d : 0; }
  /** Sets the protection from a remaining time (a referee's message): ms <= 0 clears it. */
  function set(o, ms, now) { if (o) o.sgUntil = ms > 0 ? now + ms : 0; }
  const active = (o, now) => !!o && o.sgUntil > 0 && o.sgUntil > now;
  const left = (o, now) => (active(o, now) ? o.sgUntil - now : 0);
  const clear = o => { if (o) o.sgUntil = 0; };
  /** Ends it early because `o` did `why` (one of ENDS). Returns true if it was on (the caller then tells everyone). */
  function end(o, why, now) {
    if (!active(o, now)) { if (o && o.sgUntil) o.sgUntil = 0; return false; }
    if (ENDS.indexOf(why) < 0) return false;      // anything else (moving, aiming...) never ends it
    o.sgUntil = 0; return true;
  }
  /** Damage of any kind (bullet, blast, fire, melee, gear, zombie) and blast knockback: refused while protected. */
  const blocksDamage = (o, now) => active(o, now);
  const isGearAct = a => GEAR_ACTS.indexOf(a) >= 0;
  /** Capture point: a protected soldier never counts (no capture, no contest). He "plays the objective", which ends the protection,
   *  when his presence would change the point: `owned` = the point is his team's, `mine` = its progress toward his team (-1..1). */
  const engages = (owned, mine) => !(owned && mine >= 1);
  /** One step of the capture rule for a soldier standing on a point. Returns true when he stays out of the count this tick. */
  function onPoint(o, owned, mine, now) {
    if (!active(o, now)) return false;
    if (!engages(owned, mine)) return true;       // his own point, fully held: he can stand there protected, he changes nothing
    end(o, 'capture', now); return false;         // he starts taking it: the protection ends and he counts from now on
  }

  const api = { DURATION, ENDS, GEAR_ACTS, BOT_PENALTY, duration, start, set, active, left, clear, end, blocksDamage, isGearAct, engages, onPoint };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FZSpawnGuard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
