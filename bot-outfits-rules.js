// FRONT ZÉRO — bot outfits: the rules, shared by the server (online rooms, room-list.js) and the browser (solo matches, bot-outfits.js).
// No import/export on purpose (see spawn-guard.js): the server loads it with require(), the browser with `import './bot-outfits-rules.js'` (globalThis.FZBotOutfits).
// Each match draws a few outfits from the catalogue (base outfits, map outfits, their colourways), one per set while there are sets enough;
// the bots of that match share them, the least worn first, so each bot wears a different one when the pool allows it.
(function (root) {
  'use strict';
  /** Distinct outfits per match. Every one is built and warmed at load and stays in memory: this bounds the cost on a weak machine. */
  const PER_MATCH = 6;
  /** Modes whose bots wear outfits. Zombies keeps its own look (its allied bots stay in the standard uniform). */
  const MODES = ['ffa', 'tdm', 'dom', 'bomb', 'zone'];
  /** Colourways left out of the pool: more than 20 % less contrasted than the standard soldier (readability rule of the outfits).
   *  Source: the contrast tables of the outfit notes: base outfits (40 base colourways, worst FANTÔME Cendre -16 %), map outfits (40, means -12 % at worst)
   *  and new-map outfits (12, means -8 % at worst): none fails today. A colourway that fails a later measure goes here. */
  const EXCLUDE = [];
  /** zone-referee.js names its bots b1..b11; they appear after the match started, so their outfits are dealt in advance. */
  const ZONE_BOTS = 11;

  /** The set of a colourway id: its first word (eclipse-noir-jaune -> eclipse, serre-frein-houille -> serre). Unique per set in the catalogue. */
  const setKey = id => String(id).split('-')[0];
  /** Small seeded generator (mulberry32). */
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  /** The ids that may go in the pool: strings, not excluded, not a season-pass colourway (s1-...: earned, never dealt to bots), no duplicates. */
  function eligible(ids) {
    const out = [], seen = new Set();
    for (const id of ids || []) if (typeof id === 'string' && id && !seen.has(id) && EXCLUDE.indexOf(id) < 0 && !/^s\d+-/.test(id)) { seen.add(id); out.push(id); }
    return out;
  }
  /** `n` distinct colourways drawn at random: one per set while there are sets enough, then second colourways of the same sets. */
  function draw(ids, n, rnd) {
    const bySet = new Map();
    for (const id of eligible(ids)) { const k = setKey(id); if (!bySet.has(k)) bySet.set(k, []); bySet.get(k).push(id); }
    const sets = shuffle([...bySet.values()], rnd), out = [];
    for (const s of sets) shuffle(s, rnd);
    for (let round = 0; out.length < n; round++) {
      let any = false;
      for (const s of sets) { if (out.length >= n) break; if (round < s.length) { out.push(s[round]); any = true; } }
      if (!any) break;
    }
    return out;
  }
  /** The pool entry for one more bot: the least worn; on a tie, one only its own side already wears (a repeat stays within a team); then pool order.
   *  `others`: [outfit id, team] of the bots already dressed. */
  function pick(pool, others, team) {
    if (!pool || !pool.length) return null;
    let best = null, bn = Infinity, bs = -1;
    for (let i = 0; i < pool.length; i++) {
      let n = 0, mine = 0;
      for (const o of others) if (o[0] === pool[i]) { n++; if (team !== null && team !== undefined && o[1] === team) mine++; }
      const s = n > 0 && n === mine ? 1 : 0;
      if (n < bn || (n === bn && s > bs)) { best = pool[i]; bn = n; bs = s; }
    }
    return best;
  }
  const modeOn = mode => MODES.indexOf(mode) >= 0;

  /* ---------- server ---------- */
  let tok = 0;
  /** What the room messages carry for the bots of the running match: { botId: outfitId }, or null. The pool is drawn once per match from the
   *  server's whitelist; each bot keeps its outfit for the whole match; a bot added mid-match gets the least worn one. Zone bots (b1..b11) are dealt
   *  in pool order. Clients that do not know this field (older versions) ignore it and show the standard uniform. */
  function roomFits(room, fitIds, isBot) {
    const m = room && room.match;
    if (!m || !modeOn(m.mode) || !fitIds) return null;
    if (!m.bfPool) { m.bfPool = draw([...fitIds], PER_MATCH, rng(Math.floor(Math.random() * 0x7fffffff))); m.bfTok = ++tok; }
    const pool = m.bfPool; if (!pool.length) return null;
    const by = {}, others = [], fresh = [];
    for (const q of room.players.values()) {
      if (!isBot(q)) continue;
      if (q.bfTok === m.bfTok && q.bf) { by[q.id] = q.bf; others.push([q.bf, q.team]); } else fresh.push(q);
    }
    for (const q of fresh) { q.bf = pick(pool, others, q.team); q.bfTok = m.bfTok; by[q.id] = q.bf; others.push([q.bf, q.team]); }
    if (m.mode === 'zone') for (let i = 1; i <= ZONE_BOTS; i++) by['b' + i] = pool[(i - 1) % pool.length];
    return by;
  }

  const api = { PER_MATCH, MODES, EXCLUDE, ZONE_BOTS, setKey, rng, eligible, draw, pick, modeOn, roomFits };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FZBotOutfits = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
