// FRONT ZÉRO procedural sound engine. Web Audio API only: no samples, no dependencies.
// Usage: const a = createAudio(); on a user gesture call a.unlock().
// Every public method is a safe no-op before unlock() or when audio is unavailable.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const finite = (v, d = 0) => (Number.isFinite(v) ? v : d);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
// Linear parameter move from the current value (avoids setTargetAtTime, which is unstable in some engines).
function glide(param, value, now, time) {
  const cur = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(Number.isFinite(cur) ? cur : value, now);
  param.linearRampToValueAtTime(value, now + Math.max(.005, time));
}

function rngOf(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const SURFACES = ['sand', 'concrete', 'metal', 'wood', 'snow'];
const surfaceOf = (s) => (SURFACES.includes(s) ? s : 'concrete');
const CAPS = { gunOwn: 6, gun: 12, step: 6, foley: 8, reload: 4, impact: 10, whizz: 3, casing: 4, hud: 3, ui: 3, amb: 10, boom: 4, rumble: 3, debris: 3, launch: 4, melee: 4 };

// ---------------------------------------------------------------------------
// Weapon designs
// ---------------------------------------------------------------------------
const GUNS = {
  p9: {
    dur: .85, level: .60, drive: 2.4, wet: .24, echo: .10,
    crack: { g: .78, f: 3000, len: 1.5 }, blast: { g: .86, f0: 2500, f1: 520, q: .8, d: .05 },
    body: { g: .42, f: 780, q: 1.3, d: .035 }, thump: { g: .62, f0: 210, f1: 72, d: .065 },
    mech: { g: .17, t: .022, gap: .036, f: 3300 }, tail: { g: .11, d: .34, lp: 1700 }, echoes: { n: 1, t: .17, g: .06, lp: 1500 },
  },
  ar: {
    dur: 1.25, level: .78, drive: 3.0, wet: .30, echo: .16,
    crack: { g: 1, f: 2600, len: 2.3 }, blast: { g: 1, f0: 2100, f1: 300, q: .7, d: .075 },
    body: { g: .62, f: 520, q: 1.1, d: .06 }, thump: { g: .86, f0: 175, f1: 48, d: .10 },
    mech: { g: .15, t: .03, gap: .043, f: 2500 }, tail: { g: .17, d: .62, lp: 1450 }, echoes: { n: 2, t: .21, g: .08, lp: 1250 },
  },
  smg: {
    dur: .78, level: .58, drive: 2.7, wet: .22, echo: .08,
    crack: { g: .70, f: 3600, len: 1.2 }, blast: { g: .82, f0: 3000, f1: 680, q: .9, d: .032 },
    body: { g: .38, f: 980, q: 1.5, d: .024 }, thump: { g: .46, f0: 240, f1: 92, d: .042 },
    mech: { g: .20, t: .014, gap: .024, f: 3900 }, tail: { g: .09, d: .26, lp: 2000 }, echoes: { n: 1, t: .13, g: .045, lp: 1700 },
  },
  sg: {
    dur: 1.9, level: 1, drive: 3.8, wet: .40, echo: .24,
    crack: { g: .62, f: 1900, len: 3.6 }, blast: { g: 1.25, f0: 1500, f1: 150, q: .55, d: .15 },
    body: { g: .95, f: 300, q: .8, d: .12 }, thump: { g: 1.25, f0: 135, f1: 32, d: .20 },
    mech: { g: .05, t: .09, gap: .05, f: 1800 }, tail: { g: .28, d: 1.05, lp: 1050 }, echoes: { n: 3, t: .27, g: .13, lp: 900 },
  },
  lmg: {
    dur: 1.45, level: .88, drive: 3.4, wet: .34, echo: .20,
    crack: { g: 1, f: 2200, len: 2.9 }, blast: { g: 1.12, f0: 1800, f1: 220, q: .62, d: .095 },
    body: { g: .78, f: 400, q: .95, d: .08 }, thump: { g: 1.05, f0: 150, f1: 40, d: .13 },
    mech: { g: .19, t: .036, gap: .05, f: 2100 }, tail: { g: .21, d: .78, lp: 1250 }, echoes: { n: 2, t: .24, g: .10, lp: 1050 },
  },
  sr: {
    dur: 3.4, level: 1, drive: 4.2, wet: .48, echo: .42,
    crack: { g: 1.45, f: 2300, len: 4.2 }, blast: { g: 1.2, f0: 1900, f1: 170, q: .55, d: .13 },
    body: { g: .84, f: 340, q: .85, d: .11 }, thump: { g: 1.2, f0: 150, f1: 30, d: .24 },
    mech: { g: .035, t: .16, gap: .07, f: 1700 }, tail: { g: .30, d: 1.75, lp: 1250 }, echoes: { n: 6, t: .38, g: .24, lp: 1150 },
  },
};
const GUN_VARIANTS = { p9: 4, ar: 4, smg: 4, sg: 3, lmg: 4, sr: 3 };
const BASE_GUNS = ['ar', 'p9', 'smg', 'sg', 'lmg', 'sr'];
// Newer weapons (rendered on first use). `rapid` is an extra level drop between shots closer than 70 ms.
Object.assign(GUNS, {
  hp: { // heavy pistol: boomy
    dur: 1.15, level: .78, drive: 3.2, wet: .32, echo: .16,
    crack: { g: .9, f: 2400, len: 2.2 }, blast: { g: 1.05, f0: 1900, f1: 300, q: .7, d: .085 },
    body: { g: .6, f: 520, q: 1.1, d: .06 }, thump: { g: .95, f0: 170, f1: 50, d: .11 },
    mech: { g: .15, t: .03, gap: .045, f: 2600 }, tail: { g: .16, d: .55, lp: 1400 }, echoes: { n: 2, t: .2, g: .09, lp: 1250 },
  },
  rev: { // revolver: the boomiest sidearm, no cycling action
    dur: 1.4, level: .84, drive: 3.5, wet: .36, echo: .2,
    crack: { g: .85, f: 2100, len: 2.8 }, blast: { g: 1.15, f0: 1600, f1: 220, q: .6, d: .11 },
    body: { g: .72, f: 430, q: .9, d: .085 }, thump: { g: 1.1, f0: 150, f1: 40, d: .15 },
    mech: { g: .03, t: .1, gap: .05, f: 2000 }, tail: { g: .2, d: .75, lp: 1250 }, echoes: { n: 2, t: .23, g: .11, lp: 1100 },
  },
  mp: { // machine pistol: fast and light
    dur: .62, level: .5, drive: 2.5, wet: .2, echo: .07,
    crack: { g: .66, f: 3900, len: 1.1 }, blast: { g: .78, f0: 3300, f1: 760, q: .95, d: .028 },
    body: { g: .34, f: 1100, q: 1.6, d: .02 }, thump: { g: .4, f0: 260, f1: 100, d: .036 },
    mech: { g: .2, t: .012, gap: .022, f: 4200 }, tail: { g: .08, d: .22, lp: 2100 }, echoes: { n: 1, t: .12, g: .04, lp: 1800 },
  },
  car: { // carbine: crisp
    dur: 1.1, level: .74, drive: 3, wet: .28, echo: .15,
    crack: { g: 1.08, f: 3000, len: 1.9 }, blast: { g: .95, f0: 2500, f1: 380, q: .78, d: .062 },
    body: { g: .55, f: 640, q: 1.2, d: .05 }, thump: { g: .74, f0: 190, f1: 56, d: .085 },
    mech: { g: .16, t: .026, gap: .038, f: 2800 }, tail: { g: .15, d: .52, lp: 1650 }, echoes: { n: 2, t: .19, g: .075, lp: 1400 },
  },
  akr: { // heavy assault rifle: deep
    dur: 1.4, level: .84, drive: 3.4, wet: .32, echo: .18,
    crack: { g: .95, f: 2200, len: 2.7 }, blast: { g: 1.1, f0: 1700, f1: 230, q: .62, d: .095 },
    body: { g: .78, f: 380, q: .95, d: .08 }, thump: { g: 1.02, f0: 150, f1: 40, d: .13 },
    mech: { g: .2, t: .036, gap: .05, f: 1900 }, tail: { g: .2, d: .72, lp: 1250 }, echoes: { n: 2, t: .23, g: .1, lp: 1050 },
  },
  brst: { // burst rifle: tight
    dur: .95, level: .72, drive: 2.9, wet: .25, echo: .12,
    crack: { g: 1.05, f: 3200, len: 1.6 }, blast: { g: .9, f0: 2700, f1: 450, q: .85, d: .048 },
    body: { g: .5, f: 720, q: 1.3, d: .04 }, thump: { g: .66, f0: 200, f1: 62, d: .07 },
    mech: { g: .15, t: .02, gap: .03, f: 3000 }, tail: { g: .12, d: .4, lp: 1700 }, echoes: { n: 1, t: .17, g: .06, lp: 1450 },
  },
  bat: { // battle rifle: sharp with a long tail
    dur: 2, level: .92, drive: 3.6, wet: .4, echo: .28,
    crack: { g: 1.3, f: 2500, len: 3.2 }, blast: { g: 1.12, f0: 2000, f1: 210, q: .6, d: .105 },
    body: { g: .76, f: 400, q: .9, d: .09 }, thump: { g: 1.08, f0: 155, f1: 36, d: .16 },
    mech: { g: .14, t: .04, gap: .055, f: 2100 }, tail: { g: .25, d: 1.15, lp: 1300 }, echoes: { n: 4, t: .29, g: .16, lp: 1150 },
  },
  pdw: { // compact SMG: fast and light
    dur: .66, level: .52, drive: 2.6, wet: .2, echo: .07,
    crack: { g: .72, f: 4000, len: 1 }, blast: { g: .8, f0: 3400, f1: 800, q: 1, d: .026 },
    body: { g: .36, f: 1150, q: 1.6, d: .02 }, thump: { g: .38, f0: 270, f1: 105, d: .034 },
    mech: { g: .22, t: .011, gap: .02, f: 4300 }, tail: { g: .08, d: .22, lp: 2200 }, echoes: { n: 1, t: .12, g: .04, lp: 1800 },
  },
  hsmg: { // heavy SMG: thumpy
    dur: .95, level: .68, drive: 3, wet: .26, echo: .1,
    crack: { g: .6, f: 2600, len: 1.7 }, blast: { g: .95, f0: 1900, f1: 380, q: .7, d: .055 },
    body: { g: .6, f: 520, q: 1.1, d: .05 }, thump: { g: .95, f0: 180, f1: 60, d: .085 },
    mech: { g: .2, t: .024, gap: .04, f: 2400 }, tail: { g: .12, d: .38, lp: 1500 }, echoes: { n: 1, t: .16, g: .06, lp: 1300 },
  },
  asg: { // automatic shotgun
    dur: 1.5, level: .92, drive: 3.7, wet: .36, echo: .2,
    crack: { g: .6, f: 2000, len: 3.2 }, blast: { g: 1.2, f0: 1600, f1: 170, q: .56, d: .13 },
    body: { g: .9, f: 320, q: .82, d: .105 }, thump: { g: 1.18, f0: 140, f1: 36, d: .17 },
    mech: { g: .16, t: .05, gap: .06, f: 1700 }, tail: { g: .22, d: .8, lp: 1100 }, echoes: { n: 2, t: .25, g: .11, lp: 950 },
  },
  dbs: { // double-barrel shotgun: the heaviest blast, no action noise
    dur: 2, level: 1, drive: 4, wet: .42, echo: .26,
    crack: { g: .58, f: 1800, len: 3.9 }, blast: { g: 1.3, f0: 1350, f1: 130, q: .5, d: .17 },
    body: { g: 1, f: 270, q: .75, d: .135 }, thump: { g: 1.3, f0: 125, f1: 30, d: .22 },
    mech: { g: .001, t: .09, gap: .05, f: 1800 }, tail: { g: .3, d: 1.15, lp: 980 }, echoes: { n: 3, t: .28, g: .14, lp: 850 },
  },
  mini: { // rotary gun: short dense reports that stack into a roar
    dur: .5, level: .56, drive: 2.6, wet: .16, echo: .05, rapid: .86,
    crack: { g: .7, f: 2900, len: 1.3 }, blast: { g: .9, f0: 2300, f1: 520, q: .8, d: .034 },
    body: { g: .5, f: 700, q: 1.2, d: .03 }, thump: { g: .6, f0: 210, f1: 80, d: .05 },
    mech: { g: .12, t: .01, gap: .016, f: 3300 }, tail: { g: .07, d: .2, lp: 1600 }, echoes: { n: 1, t: .11, g: .03, lp: 1400 },
  },
  dmr: { // marksman rifle: sharp, long tail
    dur: 2.4, level: .95, drive: 3.8, wet: .42, echo: .32,
    crack: { g: 1.4, f: 2700, len: 3.4 }, blast: { g: 1.1, f0: 2100, f1: 200, q: .58, d: .11 },
    body: { g: .74, f: 380, q: .88, d: .095 }, thump: { g: 1.05, f0: 150, f1: 34, d: .18 },
    mech: { g: .1, t: .05, gap: .06, f: 2000 }, tail: { g: .27, d: 1.35, lp: 1300 }, echoes: { n: 4, t: .32, g: .18, lp: 1150 },
  },
  hsr: { // heavy sniper: the biggest crack, eight echoes rolling away
    dur: 4.2, level: 1, drive: 4.6, wet: .55, echo: .5,
    crack: { g: 1.7, f: 1900, len: 5.2 }, blast: { g: 1.35, f0: 1500, f1: 120, q: .5, d: .17 },
    body: { g: 1, f: 260, q: .78, d: .15 }, thump: { g: 1.4, f0: 120, f1: 24, d: .32 },
    mech: { g: .02, t: .2, gap: .08, f: 1500 }, tail: { g: .36, d: 2.3, lp: 1100 }, echoes: { n: 8, t: .4, g: .3, lp: 1000 },
  },
});
Object.assign(GUN_VARIANTS, { hp: 3, rev: 3, mp: 3, car: 3, akr: 3, brst: 3, bat: 3, pdw: 3, hsmg: 3, asg: 3, dbs: 2, mini: 4, dmr: 3, hsr: 2 });

// ---------------------------------------------------------------------------
// Environments: impulse response, early reflections, slapback echo, ambience
// ---------------------------------------------------------------------------
const ENVS = {
  desert: {
    wet: .36, ownWet: .75,
    ir: { rt: 1.25, pre: .018, lp: 4300, lpMin: 500, damp: 2.4, hp: 170, level: .55,
      taps: [[.11, .36, -.45], [.19, .22, .55], [.31, .13, -.2], [.46, .08, .35]], modes: [] },
    echo: { t: .34, fb: .28, lp: 2100, g: .46 },
    events: { gunfire: [7, 18], artillery: [16, 38] },
  },
  urban: {
    wet: .52, ownWet: .9,
    ir: { rt: 1.7, pre: .008, lp: 6200, lpMin: 650, damp: 2.0, hp: 140, level: .8,
      taps: [[.019, .55, -.65], [.031, .5, .7], [.047, .38, -.35], [.068, .34, .45], [.093, .25, -.75], [.127, .2, .6], [.171, .13, -.2], [.236, .1, .3]], modes: [[730, .012, .12], [1240, .008, .09]] },
    echo: { t: .155, fb: .34, lp: 2900, g: .36 },
    events: { gunfire: [6, 15], artillery: [20, 46], creak: [18, 42] },
  },
  port: {
    wet: .5, ownWet: .82,
    ir: { rt: 2.3, pre: .014, lp: 5200, lpMin: 520, damp: 1.5, hp: 120, level: .72,
      taps: [[.042, .42, .6], [.083, .3, -.55], [.141, .24, .3], [.226, .17, -.7], [.37, .13, .55], [.59, .07, -.25]], modes: [[310, .02, .55], [655, .014, .42], [1490, .007, .26]] },
    echo: { t: .29, fb: .36, lp: 2300, g: .4 },
    events: { gunfire: [9, 22], artillery: [24, 52], gull: [4, 13], water: [3, 8], creak: [6, 16] },
  },
  bunker: {
    wet: .74, ownWet: 1,
    ir: { rt: 3.3, pre: .003, lp: 7600, lpMin: 900, damp: 1.05, hp: 95, level: 1,
      taps: [[.006, .72, -.7], [.011, .66, .72], [.017, .56, -.45], [.024, .5, .5], [.033, .42, -.8], [.045, .34, .75], [.061, .27, -.25], [.083, .2, .3]],
      modes: [[182, .05, .95], [417, .045, .8], [863, .035, .62], [1377, .024, .44], [2281, .014, .28], [3518, .008, .18]] },
    echo: { t: .071, fb: .46, lp: 3200, g: .24 },
    events: { gunfire: [13, 30], artillery: [12, 30], creak: [8, 20], tick: [3, 9] },
  },
  snow: {
    wet: .3, ownWet: .55,
    ir: { rt: 1.5, pre: .03, lp: 2100, lpMin: 260, damp: 3.2, hp: 110, level: .46,
      taps: [[.15, .18, -.4], [.42, .13, .5], [.74, .09, -.15]], modes: [] },
    echo: { t: .52, fb: .3, lp: 1100, g: .34 },
    events: { gunfire: [12, 30], artillery: [18, 44] },
  },
};

/* The impulse response is built in slices (a generator that yields every IR_SLICE samples) so it never blocks the page for long:
   the same arithmetic in the same order, so the buffer is identical to the one built in a single pass. */
const IR_SLICE = 4096;
function generateIR(ctx, cfg, seed) { const g = irSteps(ctx, cfg, seed); let r; while (!(r = g.next()).done); return r.value; }
function* irSteps(ctx, cfg, seed) {
  const sr = ctx.sampleRate;
  const len = Math.ceil((cfg.rt + cfg.pre + .08) * sr / 128) * 128;
  const buf = ctx.createBuffer(2, len, sr);
  let peak = 1e-6;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const rng = rngOf(seed + c * 991);
    const start = Math.floor(cfg.pre * sr);
    let lp = 0, hp = 0, a = .4;
    const hpA = 1 - Math.exp(-TAU * cfg.hp / sr);
    for (let i0 = start; i0 < len; i0 += IR_SLICE) {
      for (let i = i0, i1 = Math.min(len, i0 + IR_SLICE); i < i1; i++) {
        const t = (i - start) / sr;
        if ((i & 63) === 0) a = 1 - Math.exp(-TAU * (cfg.lp * Math.exp(-t * cfg.damp) + cfg.lpMin) / sr);
        lp += a * ((rng() * 2 - 1) - lp);
        hp += hpA * (lp - hp);
        d[i] = (lp - hp) * Math.exp(-6.91 * t / cfg.rt) * Math.min(1, t / .004) * cfg.level;
      }
      yield;
    }
    for (const [f, amp, tau] of cfg.modes) {
      const bq = new Biquad('bp', f * (1 + (c ? .004 : -.004)), 1.2, sr), k = amp * .5 / (.577 * Math.sqrt(Math.PI * (f / 1.2) / sr));
      for (let i0 = start; i0 < len; i0 += IR_SLICE) {
        for (let i = i0, i1 = Math.min(len, i0 + IR_SLICE); i < i1; i++) d[i] += k * Math.exp(-(i - start) / sr / tau) * bq.tick(rng() * 2 - 1);
        yield;
      }
    }
    for (const [time, gain, pan] of cfg.taps) {
      const side = c === 0 ? 1 - Math.max(0, pan) : 1 + Math.min(0, pan);
      const at = Math.floor((time + (c ? .0009 : 0)) * sr);
      const width = Math.max(3, Math.floor(.0012 * sr));
      for (let j = 0; j < width && at + j < len; j++) {
        d[at + j] += gain * side * (1 - j / width) * (j % 2 ? -.55 : 1) * (.8 + rng() * .2);
      }
    }
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    const fade = Math.floor(.05 * sr);
    for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
    yield;
  }
  const scale = .9 / peak;
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] *= scale; }
  return buf;
}

// ---------------------------------------------------------------------------
// Sample-level DSP used by foley, UI and fallback sounds
// ---------------------------------------------------------------------------
class Biquad {
  constructor(type, f, q, sr) { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.type = type; this.sr = sr; this.set(f, q); }
  set(f, q) {
    const w = TAU * clamp(f, 10, this.sr * .45) / this.sr, cs = Math.cos(w), al = Math.sin(w) / (2 * Math.max(.1, q));
    let b0, b1, b2;
    if (this.type === 'lp') { b1 = 1 - cs; b0 = b2 = b1 / 2; }
    else if (this.type === 'hp') { b1 = -(1 + cs); b0 = b2 = (1 + cs) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * cs / a0; this.a2 = (1 - al) / a0;
  }
  tick(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

const outBuf = (sr, dur) => new Float32Array(Math.ceil(dur * sr));
function addNoise(o, sr, rng, t, dur, amp, tau, type, f, q = .8, attack = .0005) {
  const bq = new Biquad(type, f, q, sr), a = Math.floor(t * sr), n = Math.min(o.length - a, Math.ceil(dur * sr)), atk = Math.max(1, attack * sr);
  for (let i = 0; i < n; i++) o[a + i] += bq.tick(rng() * 2 - 1) * amp * Math.exp(-i / (tau * sr)) * Math.min(1, i / atk);
}
// Every procedural sound is shaped noise: there is no sine, oscillator or tuned resonance left, so nothing can read as a beep.
let noiseState = 0x2f6e2b1;
const white = () => { noiseState ^= noiseState << 13; noiseState ^= noiseState >>> 17; noiseState ^= noiseState << 5; return (noiseState >>> 0) / 2147483648 - 1; };
// A knock with colour around f: a wide band of noise that dies within a few tens of milliseconds.
function addRing(o, sr, t, f, amp, tau) {
  const q = Math.min(.9, f / 480), d = Math.min(tau, .014), a = Math.floor(t * sr), n = Math.min(o.length - a, Math.ceil(d * 6 * sr)), bw = f / q, bq = new Biquad('bp', f, q, sr);
  const k = amp * .5 / (.577 * Math.sqrt(Math.PI * bw / sr)), atk = Math.max(1, .00015 * sr);
  for (let i = 0; i < n; i++) o[a + i] += bq.tick(white()) * k * Math.exp(-i / (d * sr)) * Math.min(1, i / atk);
}
// A body thud: a steep sub-bass band of noise for the weight, under a broad short knock (200 Hz - 2 kHz) that keeps it a thud and not a pitch.
function addDrop(o, sr, t, f0, f1, amp, tau) {
  const a = Math.floor(t * sr), n = Math.min(o.length - a, Math.ceil(tau * 6 * sr)), c = clamp(f1 * 1.5, 62, 118), top = clamp(f0 * 9, 1100, 2400), knockTau = Math.min(tau * .55, .03);
  const l1 = new Biquad('lp', c, .7, sr), l2 = new Biquad('lp', c, .7, sr), l3 = new Biquad('lp', c, .7, sr), hp = new Biquad('hp', 210, .7, sr), hp2 = new Biquad('hp', 210, .7, sr), lk = new Biquad('lp', top, .6, sr);
  const kb = amp * .62 / (.577 * Math.sqrt(2 * c / sr)), kk = amp * .3 / (.577 * Math.sqrt(2 * top / sr));
  for (let i = 0; i < n; i++) {
    const atk = Math.min(1, i / (.001 * sr));
    o[a + i] += l3.tick(l2.tick(l1.tick(white()))) * kb * Math.exp(-i / (tau * sr)) * atk + lk.tick(hp2.tick(hp.tick(white()))) * kk * Math.exp(-i / (knockTau * sr)) * atk;
  }
}
// Takes the hump out of the low mids, where the skirt of a sub-bass noise band would otherwise gather and read as a note.
function scoop(d, sr, f, q, k) {
  const bq = new Biquad('bp', f, q, sr);
  for (let i = 0; i < d.length; i++) d[i] -= k * bq.tick(d[i]);
  return d;
}
function addGrains(o, sr, rng, t, span, count, amp, fLo, fHi) {
  for (let i = 0; i < count; i++) {
    const at = t + rng() * rng() * span;
    addRing(o, sr, at, fLo + rng() * (fHi - fLo), amp * (.35 + rng() * .65) * (rng() < .5 ? -1 : 1), .0012 + rng() * .003, rng() * TAU);
  }
}
function polish(d, sr, target = .85, fadeMs = 6) {
  let x1 = 0, y1 = 0, peak = 1e-6;
  const R = 1 - TAU * 25 / sr;
  for (let i = 0; i < d.length; i++) { const x = d[i]; y1 = x - x1 + R * y1; x1 = x; d[i] = y1; peak = Math.max(peak, Math.abs(y1)); }
  const scale = target / peak, fade = Math.min(d.length, Math.floor(fadeMs * .001 * sr));
  for (let i = 0; i < d.length; i++) d[i] *= scale;
  for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;
  return d;
}

// Surface materials: thud [f0,f1,amp,tau], scuff [type,f,q,amp,tau], grains [count,amp,fLo,fHi], rings [[f,amp,tau],...]
const STEP_MAT = {
  sand: { len: .24, thud: [105, 52, .34, .028], scuff: ['bp', 1650, .55, .34, .05], grains: [34, .075, 1100, 4300], rings: [] },
  concrete: { len: .2, thud: [150, 66, .62, .018], scuff: ['hp', 2100, .7, .24, .012], grains: [9, .09, 1800, 5200], rings: [] },
  metal: { len: .42, thud: [165, 86, .48, .018], scuff: ['bp', 2500, 1.3, .16, .01], grains: [4, .06, 2600, 6200], rings: [[437, .17, .08], [1131, .12, .055], [2217, .07, .034], [3462, .04, .022]] },
  wood: { len: .27, thud: [132, 72, .58, .026], scuff: ['bp', 880, .9, .2, .018], grains: [5, .05, 900, 2500], rings: [[196, .22, .034], [351, .16, .026], [634, .08, .017]] },
  snow: { len: .31, thud: [84, 45, .24, .035], scuff: ['bp', 1050, .5, .3, .07], grains: [46, .058, 650, 2700], rings: [] },
};

function genStep(sr, rng, surface, weight) {
  const m = STEP_MAT[surface], o = outBuf(sr, m.len * (weight > 1.3 ? 1.35 : 1));
  const v = (x, a = .1) => x * (1 + (rng() * 2 - 1) * a);
  const contact = (t, a) => {
    addDrop(o, sr, t, v(m.thud[0]), v(m.thud[1]), m.thud[2] * a * weight, m.thud[3] * (weight > 1.3 ? 1.5 : 1));
    addNoise(o, sr, rng, t, m.scuff[4] * 5, m.scuff[3] * a, m.scuff[4], m.scuff[0], v(m.scuff[1], .16), m.scuff[2]);
    addGrains(o, sr, rng, t, .045 + m.scuff[4], Math.round(m.grains[0] * a), m.grains[1] * a, m.grains[2], m.grains[3]);
    for (const [f, amp, tau] of m.rings) addRing(o, sr, t, v(f, .025), amp * a * weight, v(tau, .15), rng() * TAU);
  };
  contact(.002, 1);
  contact(.03 + rng() * .035, .46 + rng() * .24);
  return polish(o, sr, .82);
}

function genLand(sr, rng, surface) {
  const base = genStep(sr, rng, surface, 1.75), o = outBuf(sr, base.length / sr + .12);
  o.set(base, 0);
  addDrop(o, sr, .004, 92, 38, .72, .06);
  addNoise(o, sr, rng, .01, .17, .17, .05, 'bp', 800, .34, .008);
  softClip(o, 1.9);
  return polish(o, sr, .86);
}

function genSlide(sr, rng, surface) {
  const cfg = {
    sand: [1500, .6, .85, 22], concrete: [2300, .75, .75, 12], metal: [3100, 2.2, .62, 7],
    wood: [920, 1, .72, 14], snow: [1050, .55, .78, 26],
  }[surface];
  const dur = .62, o = outBuf(sr, dur), bq = new Biquad('bp', cfg[0], cfg[1], sr), low = new Biquad('lp', 260, .7, sr);
  let rough = 0, target = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    if (i % Math.max(8, Math.floor(sr / (70 * cfg[3]))) === 0) target = rng();
    rough += .025 * (target - rough);
    if ((i & 31) === 0) bq.set(cfg[0] * (1.15 - .35 * t / dur) * (1 + .08 * Math.sin(t * 37)), cfg[1]);
    const e = Math.min(1, t / .025) * Math.pow(1 - t / dur, 1.5);
    const n = rng() * 2 - 1;
    o[i] = (bq.tick(n) * (.45 + rough * .9) * cfg[2] + low.tick(n) * .22) * e;
  }
  if (surface === 'metal') for (let k = 0; k < 4; k++) addRing(o, sr, .03 + rng() * .36, 1900 + rng() * 2200, .035, .05, rng() * TAU);
  if (surface === 'sand' || surface === 'snow') addGrains(o, sr, rng, .02, .5, 80, .035, 700, 3800);
  if (surface === 'concrete') addGrains(o, sr, rng, .02, .5, 34, .05, 1800, 5200);
  return polish(o, sr, .72, 18);
}

function genJump(sr, rng) {
  const o = outBuf(sr, .24);
  addDrop(o, sr, 0, 120, 62, .34, .022);
  addNoise(o, sr, rng, .004, .05, .13, .012, 'hp', 1800);
  addNoise(o, sr, rng, .012, .2, .24, .06, 'bp', 780, .55, .018);
  return polish(o, sr, .62, 14);
}

function metalClack(o, sr, rng, t, amp, base, low = 240, ratios = [1, 1.59, 2.37, 3.41, 4.73]) {
  addNoise(o, sr, rng, t, .012, amp * .75, .0022, 'hp', 3200, .7, .00015);
  addDrop(o, sr, t, low * 1.45, low * .8, amp * .42, .009);
  ratios.forEach((r, i) => {
    const f = base * r * (1 + (rng() * 2 - 1) * .018);
    addRing(o, sr, t, f, amp * .42 / (1 + i * .55), (.018 - i * .0023) * (.8 + rng() * .4), rng() * TAU);
  });
}
const friction = (o, sr, rng, t, dur, amp, f) => addNoise(o, sr, rng, t, dur, amp, dur * .85, 'bp', f, 1.6, dur * .3);

function genImpact(sr, rng, surface) {
  const o = outBuf(sr, surface === 'metal' ? .62 : .42);
  const v = (x, a = .08) => x * (1 + (rng() * 2 - 1) * a);
  switch (surface) {
    case 'sand':
      addDrop(o, sr, .001, 170, 70, .45, .016);
      addNoise(o, sr, rng, .001, .22, .62, .055, 'bp', v(1200), .55);
      addGrains(o, sr, rng, .012, .25, 48, .06, 900, 4300);
      break;
    case 'metal':
      addNoise(o, sr, rng, 0, .014, .9, .0025, 'hp', 3600);
      [[v(1180), .5, .11], [v(1876), .42, .085], [v(2930), .3, .062], [v(4415), .2, .038], [v(6220), .1, .022]]
        .forEach(([f, a, tau]) => addRing(o, sr, 0, f, a, tau, rng() * TAU));
      addDrop(o, sr, 0, 280, 130, .25, .014);
      softClip(o, 3.4);
      break;
    case 'wood':
      addNoise(o, sr, rng, 0, .025, .68, .005, 'bp', v(2300), .8);
      addDrop(o, sr, .001, 250, 120, .58, .018);
      addRing(o, sr, .001, v(415), .28, .026);
      addRing(o, sr, .001, v(790), .17, .017);
      addGrains(o, sr, rng, .012, .16, 15, .08, 1400, 4200);
      break;
    case 'snow':
      addDrop(o, sr, .001, 120, 54, .34, .026);
      addNoise(o, sr, rng, .001, .25, .48, .07, 'bp', v(760), .55, .002);
      addGrains(o, sr, rng, .012, .24, 38, .04, 500, 2200);
      break;
    default: // concrete
      addNoise(o, sr, rng, 0, .018, 1, .0034, 'hp', 2500);
      addDrop(o, sr, .001, 310, 110, .52, .012);
      addNoise(o, sr, rng, .004, .17, .3, .04, 'bp', v(1750), .7);
      addGrains(o, sr, rng, .025, .3, 24, .09, 1500, 5600);
  }
  return polish(o, sr, .84);
}

function genWhizz(sr, rng) {
  const dur = .34 + rng() * .08, o = outBuf(sr, dur), mid = .34 + rng() * .1;
  const bq = new Biquad('bp', 3000, 1.6, sr), body = new Biquad('bp', 900, 1.4, sr);
  const f0 = 3700 + rng() * 1200, f1 = 620 + rng() * 260;
  for (let i = 0; i < o.length; i++) {
    const u = i / o.length, s = 1 / (1 + Math.exp((u - mid) * 15));
    const f = f1 + (f0 - f1) * s;
    if ((i & 15) === 0) { bq.set(f, 1.6); body.set(f * .42, .9); }
    const e = Math.exp(-Math.pow((u - mid) / (u < mid ? .16 : .27), 2));
    const n = rng() * 2 - 1;
    o[i] = (bq.tick(n) * .72 + body.tick(n) * .34) * e;
  }
  return polish(o, sr, .8, 10);
}

function genUi(sr, kind, rng) {
  const o = outBuf(sr, kind === 'kill' ? .34 : kind === 'buy' ? .42 : kind === 'hurt' ? .48 : .14);
  if (kind === 'hurt') {
    addDrop(o, sr, 0, 110, 38, .9, .06);
    addNoise(o, sr, rng, 0, .22, .16, .05, 'bp', 720, .34, .002);
    addNoise(o, sr, rng, .012, .05, .08, .012, 'bp', 1200, .8);
  } else if (kind === 'buy') {
    addRing(o, sr, 0, 880, .24, .04);
    addRing(o, sr, 0, 1760, .08, .03);
    addRing(o, sr, .085, 1318, .26, .07);
    addRing(o, sr, .085, 2637, .08, .05);
  } else {
    addRing(o, sr, 0, 1180, .3, .007);
    addNoise(o, sr, rng, 0, .008, .08, .0015, 'hp', 2800);
  }
  if (kind === 'hurt') softClip(o, 3.2);
  return polish(o, sr, kind === 'hurt' ? .82 : .5, 8);
}

function genArtillery(sr, rng) {
  const o = outBuf(sr, 3.4);
  addDrop(o, sr, .004, 72, 25, .9, .34);
  addNoise(o, sr, rng, .004, 3.2, .55, .62, 'lp', 62, .7, .025);
  addNoise(o, sr, rng, .004, 1.6, .3, .32, 'bp', 760, .3, .012);
  for (let i = 0; i < 4; i++) addDrop(o, sr, .32 + i * (.34 + rng() * .25), 52 + rng() * 15, 24, .24 / (1 + i * .4), .24);
  softClip(o, 4.5);
  scoop(o, sr, 215, .55, .8);
  return polish(o, sr, .82, 60);
}
function genWaterLap(sr, rng) {
  const o = outBuf(sr, 1.15), a = new Biquad('bp', 420, .8, sr), b = new Biquad('bp', 1250, 1.6, sr);
  for (let i = 0; i < o.length; i++) {
    const u = i / o.length;
    if ((i & 63) === 0) a.set(280 + 340 * Math.sin(Math.PI * u), .8);
    const n = rng() * 2 - 1;
    o[i] = (a.tick(n) + b.tick(n) * .24 * (1 - u)) * Math.pow(Math.sin(Math.PI * u), 1.4);
  }
  addGrains(o, sr, rng, .15, .75, 18, .025, 500, 1800);
  return polish(o, sr, .46, 20);
}
function genCreak(sr, rng) {
  const dur = .75 + rng() * .85, o = outBuf(sr, dur), f0 = 120 + rng() * 90;
  let ph = 0, nextPulse = 0;
  const bq = new Biquad('bp', 900 + rng() * 800, .8, sr);
  for (let i = 0; i < o.length; i++) {
    const u = i / o.length;
    const f = f0 * (1 + .55 * Math.sin(Math.PI * u) + .08 * Math.sin(u * 19));
    ph += f / sr;
    let pulse = 0;
    if (ph >= nextPulse) { pulse = .7 + rng() * .3; nextPulse += .4 + rng() * 1.5; }
    o[i] = bq.tick(pulse + (rng() * 2 - 1) * .035) * Math.sin(Math.PI * u) ** .7;
  }
  return polish(o, sr, .42, 25);
}
function genGunFallback(sr, rng, spec) {
  const o = outBuf(sr, Math.min(.42, spec.dur));
  addNoise(o, sr, rng, 0, .012, spec.crack.g * .75, .0025, 'hp', spec.crack.f, .7, .0001);
  addNoise(o, sr, rng, 0, .28, spec.blast.g * .7, spec.blast.d, 'bp', spec.blast.f0 * .55, spec.blast.q);
  addDrop(o, sr, 0, spec.thump.f0, spec.thump.f1, spec.thump.g * .72, spec.thump.d);
  return polish(o, sr, .84, 15);
}

// ---------------------------------------------------------------------------
// Arsenal: launchers, explosions, grenades, blades, crossbow (sample-level, no offline context needed)
// ---------------------------------------------------------------------------
function softClip(d, drive) {
  const n = Math.tanh(drive);
  for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * drive) / n;
  return d;
}
// Band-passed noise whose centre glides from f0 to f1; env(u) shapes the level over the normalised time u.
function sweepNoise(o, sr, rng, t, dur, amp, f0, f1, q, env) {
  const bq = new Biquad('bp', f0, q, sr), a = Math.floor(t * sr), n = Math.min(o.length - a, Math.ceil(dur * sr));
  for (let i = 0; i < n; i++) {
    const u = i / n;
    if ((i & 15) === 0) bq.set(f0 * Math.pow(f1 / f0, u), q);
    o[a + i] += bq.tick(rng() * 2 - 1) * amp * env(u);
  }
}
const bell = (u, mid = .4, w = .25) => Math.exp(-Math.pow((u - mid) / (u < mid ? w * .7 : w), 2));

function genBoomNear(sr, rng) {
  const o = outBuf(sr, 1.7);
  addNoise(o, sr, rng, 0, .02, 1.2, .0035, 'hp', 1800, .7, .0001); // shock front
  sweepNoise(o, sr, rng, .001, .5, 1.5, 2600, 160, .6, (u) => Math.exp(-u * 7)); // fireball
  addDrop(o, sr, .001, 110, 30, 1.3, .2); // pressure wave
  addDrop(o, sr, .03, 64, 22, .9, .34);
  addNoise(o, sr, rng, .02, 1.5, .5, .32, 'lp', 62, .7, .01); // rolling body
  addNoise(o, sr, rng, .03, .9, .4, .2, 'bp', 900, .32, .012);
  softClip(o, 5);
  scoop(o, sr, 215, .55, .8);
  return polish(o, sr, .9, 40);
}
function genBoomRumble(sr, rng) {
  const o = outBuf(sr, 3.6);
  addDrop(o, sr, .004, 70, 24, .95, .4);
  addNoise(o, sr, rng, .004, 3.4, .6, .7, 'lp', 60, .7, .03);
  addNoise(o, sr, rng, .004, 1.8, .34, .36, 'bp', 760, .3, .014);
  for (let i = 0; i < 4; i++) addDrop(o, sr, .3 + i * (.32 + rng() * .25), 50 + rng() * 16, 23, .26 / (1 + i * .45), .26);
  softClip(o, 4.5);
  scoop(o, sr, 215, .55, .8);
  return polish(o, sr, .84, 80);
}
function genDebris(sr, rng) {
  const o = outBuf(sr, 2);
  sweepNoise(o, sr, rng, .12, 1.2, .2, 2600, 1100, .7, (u) => Math.sin(Math.PI * Math.min(1, u * 1.6)) * Math.exp(-u * 2.2)); // falling dirt
  addGrains(o, sr, rng, .15, 1.4, 110, .1, 900, 5200);
  for (let i = 0; i < 7; i++) {
    const t = .2 + rng() * 1.3;
    addDrop(o, sr, t, 210 + rng() * 160, 90, .12 + rng() * .1, .012);
    addNoise(o, sr, rng, t, .04, .1, .01, 'bp', 1500 + rng() * 2500, 1);
  }
  for (let i = 0; i < 3; i++) addRing(o, sr, .3 + rng() * 1.1, 2100 + rng() * 2600, .05, .03, rng() * TAU); // metal fragments
  return polish(o, sr, .6, 60);
}
function genRocketLaunch(sr, rng) {
  const o = outBuf(sr, 1.3);
  addNoise(o, sr, rng, 0, .03, .9, .006, 'hp', 1500, .7, .0002); // ignition pop
  addDrop(o, sr, .002, 150, 46, 1, .11); // back-blast
  sweepNoise(o, sr, rng, .004, 1.2, 1, 500, 2600, .7, (u) => Math.min(1, u * 30) * Math.exp(-u * 3.4)); // motor leaving
  addNoise(o, sr, rng, .01, 1.2, .5, .3, 'lp', 110, .7, .01);
  addNoise(o, sr, rng, .01, .6, .12, .14, 'bp', 900, .35, .006);
  softClip(o, 1.8);
  return polish(o, sr, .86, 50);
}
// Seamless loop for a rocket in flight (the head is cross-faded with the material that follows the tail).
function genRocketLoop(sr, rng) {
  const n = Math.floor(.9 * sr), f = Math.floor(.12 * sr), raw = new Float32Array(n + f), o = new Float32Array(n);
  const hi = new Biquad('bp', 1500, .8, sr), lo = new Biquad('lp', 260, .7, sr);
  for (let i = 0; i < raw.length; i++) {
    const x = rng() * 2 - 1, t = i / sr;
    raw[i] = (hi.tick(x) * .7 + lo.tick(x) * 1.1) * (.82 + .18 * Math.sin(TAU * 41 * t) * Math.sin(TAU * 6.7 * t));
  }
  let peak = 1e-6;
  for (let i = 0; i < n; i++) {
    o[i] = i < f ? raw[i] * Math.sin(i / f * Math.PI / 2) + raw[n + i] * Math.cos(i / f * Math.PI / 2) : raw[i];
    peak = Math.max(peak, Math.abs(o[i]));
  }
  const scale = .7 / peak;
  for (let i = 0; i < n; i++) o[i] *= scale;
  return o;
}
function genThump(sr, rng) {
  const o = outBuf(sr, .7);
  addDrop(o, sr, .001, 170, 58, 1, .07);
  addNoise(o, sr, rng, .001, .12, .5, .02, 'bp', 420, 1.6, .0005);
  addRing(o, sr, .002, 236, .3, .045); // tube resonance
  addRing(o, sr, .002, 472, .14, .03);
  addRing(o, sr, .002, 715, .07, .02);
  addNoise(o, sr, rng, 0, .01, .4, .002, 'hp', 2200);
  addNoise(o, sr, rng, .02, .5, .1, .14, 'lp', 700, .7, .01);
  metalClack(o, sr, rng, .06, .2, 1900, 220);
  return polish(o, sr, .84, 30);
}
function genXbow(sr, rng) {
  const o = outBuf(sr, .45);
  addDrop(o, sr, .001, 210, 84, .7, .028);
  addRing(o, sr, .001, 146, .3, .06); // string hum
  addRing(o, sr, .001, 293, .16, .04);
  addNoise(o, sr, rng, .001, .03, .5, .006, 'bp', 1300, 1.2, .0003); // limb slap
  sweepNoise(o, sr, rng, .003, .12, .22, 3200, 1200, 1.4, (u) => Math.exp(-u * 5)); // bolt leaving the rail
  metalClack(o, sr, rng, .012, .22, 2300, 260);
  return polish(o, sr, .7, 20);
}
function genFlesh(sr, rng) {
  const o = outBuf(sr, .3);
  addDrop(o, sr, .001, 170, 62, .8, .03);
  addNoise(o, sr, rng, .001, .1, .34, .02, 'bp', 760, .35, .0005);
  addNoise(o, sr, rng, .006, .09, .32, .018, 'bp', 1500, .9, .002);
  addGrains(o, sr, rng, .01, .09, 14, .08, 500, 1800);
  softClip(o, 2.4);
  return polish(o, sr, .74, 12);
}
function genBounce(sr, rng, surface) {
  const o = outBuf(sr, .36), soft = surface === 'sand' || surface === 'snow';
  addDrop(o, sr, .001, soft ? 150 : 240, soft ? 60 : 110, soft ? .7 : .55, soft ? .022 : .012);
  if (soft) {
    addNoise(o, sr, rng, .001, .14, .4, .035, 'bp', surface === 'snow' ? 800 : 1300, .6);
    addGrains(o, sr, rng, .01, .12, 16, .05, 700, 3000);
  } else {
    addNoise(o, sr, rng, 0, .01, .6, .002, 'hp', 2600);
    const k = surface === 'wood' ? .45 : 1, base = surface === 'metal' ? 1280 : 1560;
    [[1, .4, .03], [1.62, .3, .022], [2.55, .2, .015], [3.9, .1, .01]]
      .forEach(([r, a, tau]) => addRing(o, sr, .001, base * r * (.97 + rng() * .06), a * k, tau * (surface === 'metal' ? 1.8 : 1), rng() * TAU));
    if (surface === 'metal') addRing(o, sr, .001, 520, .2, .07, rng() * TAU);
    if (surface === 'wood') { addRing(o, sr, .001, 240, .3, .028); addRing(o, sr, .001, 410, .16, .02); }
  }
  return polish(o, sr, .7, 14);
}
// ---------------------------------------------------------------------------
// Offline rendering
// ---------------------------------------------------------------------------
function renderOffline(oc) {
  return new Promise((resolve, reject) => {
    oc.oncomplete = (e) => resolve(e.renderedBuffer);
    let p;
    try { p = oc.startRendering(); } catch (err) { reject(err); return; }
    if (p && p.then) p.then(resolve, reject);
  });
}
function bufferValid(buf) {
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) if (!Number.isFinite(d[i])) return false;
  }
  return true;
}
function driveCurve(drive) {
  const n = 2048, curve = new Float32Array(n), norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * drive) / norm; }
  return curve;
}
function noiseBuffer(oc, rng, dur) {
  const b = oc.createBuffer(1, Math.ceil(dur * oc.sampleRate), oc.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
  return b;
}
function envGain(oc, t, peak, atk, dec) {
  const g = oc.createGain(), p = Math.max(.0002, peak);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(p, t + Math.max(.0002, atk));
  g.gain.exponentialRampToValueAtTime(.0001, t + atk + dec);
  return g;
}
function noiseSrc(oc, nb, rng, t, dur) {
  const s = oc.createBufferSource();
  s.buffer = nb; s.loop = true;
  s.start(t, rng() * nb.duration * .9);
  s.stop(Math.min(oc.length / oc.sampleRate, t + dur));
  return s;
}
function filt(oc, type, f, q = .7) {
  const n = oc.createBiquadFilter();
  n.type = type; n.frequency.value = f; n.Q.value = q;
  return n;
}

async function renderGun(Off, spec, seed, sr) {
  const rng = rngOf(seed), vary = (x, a = .07) => x * (1 + (rng() * 2 - 1) * a);
  const len = Math.ceil(spec.dur * sr), oc = new Off(2, len, sr), nb = noiseBuffer(oc, rng, 1.4);
  const mix = oc.createGain(), shaper = oc.createWaveShaper(), tailBus = oc.createGain();
  mix.gain.value = .62;
  shaper.curve = driveCurve(spec.drive);
  shaper.oversample = '2x';
  mix.connect(shaper); shaper.connect(oc.destination);
  tailBus.gain.value = .85; tailBus.connect(oc.destination);

  // Supersonic crack: a short N-wave followed by a brief high noise burst.
  const crackLen = Math.max(8, Math.ceil(vary(spec.crack.len) * .001 * sr));
  const crackBuf = oc.createBuffer(1, crackLen, sr), cd = crackBuf.getChannelData(0);
  for (let i = 0; i < crackLen; i++) { const u = i / crackLen; cd[i] = (1 - 2 * u) * (1 - u * .15) + (rng() * 2 - 1) * .28 * (1 - u); }
  const crackSrc = oc.createBufferSource(), crackGain = oc.createGain();
  crackSrc.buffer = crackBuf; crackGain.gain.value = spec.crack.g;
  crackSrc.connect(filt(oc, 'highpass', spec.crack.f * .55)).connect(crackGain).connect(mix);
  crackSrc.start(0);
  const hiss = noiseSrc(oc, nb, rng, 0, .022), hissGain = envGain(oc, 0, spec.crack.g * .4, .0003, .0085);
  hiss.connect(filt(oc, 'highpass', vary(spec.crack.f))).connect(hissGain).connect(mix);

  // Muzzle blast: band-limited noise whose centre falls quickly.
  const blastDur = vary(spec.blast.d), blastT = .0006;
  const blast = noiseSrc(oc, nb, rng, blastT, blastDur * 2.2), bp = filt(oc, 'bandpass', vary(spec.blast.f0), Math.min(spec.blast.q, .6));
  bp.frequency.setValueAtTime(vary(spec.blast.f0), blastT);
  bp.frequency.exponentialRampToValueAtTime(vary(spec.blast.f1), blastT + blastDur * 1.5);
  blast.connect(bp).connect(envGain(oc, blastT, spec.blast.g, .0012, blastDur)).connect(mix);

  // Body resonance of the receiver and barrel.
  const bodyDur = vary(spec.body.d), body = noiseSrc(oc, nb, rng, .001, bodyDur * 2);
  body.connect(filt(oc, 'bandpass', vary(spec.body.f), Math.min(spec.body.q, .6))).connect(envGain(oc, .001, spec.body.g, .002, bodyDur)).connect(mix);

  // Low-frequency thump with pitch drop.
  const thDur = vary(spec.thump.d), th = noiseSrc(oc, nb, rng, 0, thDur + .02), thLp = filt(oc, 'lowpass', vary(spec.thump.f0) * 3, .6);
  thLp.frequency.exponentialRampToValueAtTime(Math.max(160, vary(spec.thump.f1) * 3), thDur * .9);
  th.connect(thLp).connect(envGain(oc, 0, spec.thump.g * 2.4, .0018, thDur)).connect(mix);

  // Mechanical action: bolt travelling back then slamming home.
  for (let k = 0; k < 2; k++) {
    const t = spec.mech.t * vary(1, .1) + k * spec.mech.gap, f = vary(spec.mech.f, .05) * (k ? .82 : 1), g = spec.mech.g * (k ? 1 : .7);
    [1, 1.57, 2.43].forEach((r, i) => {
      noiseSrc(oc, nb, rng, t, .035).connect(filt(oc, 'bandpass', f * r, 1.1)).connect(envGain(oc, t, g * 2 / (1 + i * .75), .0006, .018 / (1 + i * .35))).connect(mix);
    });
    const c = noiseSrc(oc, nb, rng, t, .012);
    c.connect(filt(oc, 'highpass', 2800)).connect(envGain(oc, t, g * .75, .0003, .006)).connect(mix);
  }

  // Decorrelated stereo tail.
  const merge = oc.createChannelMerger(2);
  merge.connect(tailBus);
  for (let ch = 0; ch < 2; ch++) {
    const tailDur = Math.min(spec.dur - .03, vary(spec.tail.d)), n = noiseSrc(oc, nb, rng, .01, tailDur + .02), lp = filt(oc, 'lowpass', spec.tail.lp, .5);
    lp.frequency.setValueAtTime(spec.tail.lp, .01);
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, spec.tail.lp * .18), .01 + tailDur);
    n.connect(lp).connect(envGain(oc, .01, spec.tail.g, .014, tailDur)).connect(merge, 0, ch);
  }

  // Discrete echoes, alternating sides; the sniper rolls away across six of them.
  for (let e = 0; e < spec.echoes.n; e++) {
    const t = spec.echoes.t * (e + 1) * vary(1, .08);
    if (t > spec.dur - .1) break;
    const a = spec.echoes.g * Math.pow(.68, e), side = (e % 2 ? -1 : 1) * (.45 + rng() * .4), d = Math.min(spec.dur - t - .01, .19 + e * .06);
    const src = noiseSrc(oc, nb, rng, t, d + .01), f = filt(oc, 'lowpass', spec.echoes.lp * Math.pow(.78, e), .6);
    const env = envGain(oc, t, a, .006, d);
    const left = oc.createGain(), right = oc.createGain();
    left.gain.value = Math.cos((side + 1) * Math.PI / 4); right.gain.value = Math.sin((side + 1) * Math.PI / 4);
    src.connect(f).connect(env);
    env.connect(left).connect(merge, 0, 0);
    env.connect(right).connect(merge, 0, 1);
    const low = noiseSrc(oc, nb, rng, t, d), lowLp = filt(oc, 'lowpass', vary(82) * 3, .6), lowEnv = envGain(oc, t, a * 1.6, .01, d * .75);
    lowLp.frequency.setValueAtTime(vary(82) * 3, t);
    lowLp.frequency.exponentialRampToValueAtTime(120, t + d * .8);
    low.connect(lowLp).connect(lowEnv);
    lowEnv.connect(left); lowEnv.connect(right);
  }

  const out = await renderOffline(oc);
  if (!bufferValid(out)) throw new Error('invalid gun buffer');
  for (let c = 0; c < out.numberOfChannels; c++) polish(scoop(out.getChannelData(c), sr, 340, .5, .7), sr, 1, 25);
  let peak = 1e-6;
  for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  const scale = .89 / peak;
  for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= scale; }
  return out;
}

// Ambience beds render at a low rate to save memory, then crossfade into a seamless loop.
function windLayer(oc, nb, rng, dest, type, f, q, gain, gust, dur) {
  const fl = filt(oc, type, f, q), g = oc.createGain();
  g.gain.setValueAtTime(gain * (.75 + rng() * .4), 0);
  fl.frequency.setValueAtTime(f, 0);
  for (let t = .7 + rng(); t < dur; t += .8 + rng() * 1.9) {
    g.gain.linearRampToValueAtTime(gain * (1 - gust + rng() * gust * 2), t);
    fl.frequency.linearRampToValueAtTime(f * (1 - gust * .55 + rng() * gust * 1.1), t);
  }
  const merge = oc.createChannelMerger(2);
  for (let ch = 0; ch < 2; ch++) {
    const s = oc.createBufferSource();
    s.buffer = nb; s.loop = true;
    s.start(0, rng() * nb.duration * .95);
    s.connect(fl);
  }
  fl.connect(g).connect(merge, 0, 0);
  const side = filt(oc, type, f * 1.08, q), sideGain = oc.createGain(), s2 = oc.createBufferSource();
  sideGain.gain.value = gain * .92;
  s2.buffer = nb; s2.loop = true;
  s2.start(0, rng() * nb.duration * .95);
  s2.connect(side).connect(sideGain).connect(merge, 0, 1);
  merge.connect(dest);
}
function hum(oc, nb, dest, f, gain, rng) {
  const s = oc.createBufferSource(), bp = filt(oc, 'bandpass', f * (1 + (rng() - .5) * .003), 1.4), g = oc.createGain();
  s.buffer = nb; s.loop = true;
  g.gain.value = gain * 3.2;
  s.connect(bp).connect(g).connect(dest);
  s.start(0, rng() * nb.duration * .9);
}
async function renderBed(Off, name) {
  const sr = 24000, dur = 9, xf = 1.2, oc = new Off(2, Math.ceil((dur + xf) * sr), sr), rng = rngOf(hashStr('bed:' + name));
  const nb = noiseBuffer(oc, rng, 7.3), bus = oc.createGain(), total = dur + xf;
  bus.gain.value = .5; bus.connect(oc.destination);
  const W = (type, f, q, g, gust) => windLayer(oc, nb, rng, bus, type, type === 'lowpass' ? f * .42 : f, type === 'lowpass' ? .5 : Math.min(q, 1), g, gust, total);
  windLayer(oc, nb, rng, bus, 'bandpass', 950, .32, .075, .4, total);
  if (name === 'desert') { W('lowpass', 390, .6, .36, .4); W('bandpass', 1350, 1.1, .17, .6); W('highpass', 3400, .5, .012, .5); }
  else if (name === 'urban') { W('lowpass', 165, .6, .8, .22); W('bandpass', 620, .55, .1, .35); W('bandpass', 2300, .7, .018, .4); hum(oc, nb, bus, 62, .025, rng); }
  else if (name === 'port') { W('lowpass', 340, .6, .46, .36); W('bandpass', 430, .5, .3, .55); W('highpass', 2800, .5, .025, .65); }
  else if (name === 'bunker') {
    W('lowpass', 115, .7, .52, .08); W('bandpass', 315, 3.2, .16, .1); W('bandpass', 1240, 1.8, .018, .15);
    hum(oc, nb, bus, 50, .09, rng); hum(oc, nb, bus, 100, .055, rng); hum(oc, nb, bus, 150, .022, rng); hum(oc, nb, bus, 237, .01, rng);
  } else { W('bandpass', 640, 2.1, .25, .62); W('lowpass', 240, .6, .46, .3); W('bandpass', 1680, 4.5, .025, .75); }
  const r = await renderOffline(oc);
  const n = Math.floor(dur * sr), fade = Math.floor(xf * sr), out = oc.createBuffer(2, n, sr);
  let peak = 1e-6;
  for (let c = 0; c < 2; c++) {
    const src = r.getChannelData(c), d = out.getChannelData(c);
    for (let i = 0; i < n; i++) {
      if (i < fade) { const u = i / fade; d[i] = src[i] * Math.sin(u * Math.PI / 2) + src[n + i] * Math.cos(u * Math.PI / 2); }
      else d[i] = src[i];
      peak = Math.max(peak, Math.abs(d[i]));
    }
  }
  const scale = .6 / peak;
  for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < n; i++) d[i] *= scale; }
  if (!bufferValid(out)) throw new Error('invalid bed buffer');
  return out;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
export function createAudio() {
  let ctx = null, alive = false, masterVolume = .9, envName = 'urban', wantAmbience = false;
  const listener = { x: 0, y: 0, z: 0, yaw: 0 };
  const buses = {};
  const voices = Object.fromEntries(Object.keys(CAPS).map((k) => [k, []]));
  const banks = new Map(), gunBuffers = {}, irCache = {}, bedCache = {}, bedPending = {}, flameAt = {};
  const idle = [];
  let idleTimer = null, convolver = null, wetGain = null, bedVoice = null, ambTimer = null, ambOn = false, ambToken = 0;
  let lastOwnShot = -1, impactWindow = 0, impactCount = 0, lastGun = {};
  // Recorded shots and weapon handling (audio-samples.js + sounds/): loaded after unlock, asked first, synthesis is the fallback.
  let smp = null;
  const smpWant = [];
  const nextEvent = {};
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });

  const report = (e) => { try { if (globalThis.__audioDebug) globalThis.__audioDebug(e); } catch { /* ignore */ } };
  const guard = (fn) => (...args) => {
    if (!ctx || !alive) return undefined;
    try { return fn(...args); } catch (e) { report(e); return undefined; }
  };
  const running = () => ctx && ctx.state === 'running';

  function bank(key, n, gen) {
    let b = banks.get(key);
    if (!b) { b = { items: new Array(n), last: -1, gen, seed: hashStr(key) }; banks.set(key, b); }
    let i = n > 1 ? Math.floor(Math.random() * n) : 0;
    if (n > 1 && i === b.last) i = (i + 1) % n;
    b.last = i;
    if (!b.items[i]) b.items[i] = makeBuffer(b.gen(ctx.sampleRate, rngOf(b.seed + i * 7919)));
    return b.items[i];
  }
  function warm(key, n, gen) {
    let b = banks.get(key);
    if (!b) { b = { items: new Array(n), last: -1, gen, seed: hashStr(key) }; banks.set(key, b); }
    for (let i = 0; i < n; i++) idle.push(() => { if (!b.items[i]) b.items[i] = makeBuffer(b.gen(ctx.sampleRate, rngOf(b.seed + i * 7919))); });
  }
  function makeBuffer(data) {
    const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.getChannelData(0).set(data);
    return b;
  }
  function pumpIdle() {
    idleTimer = null;
    const job = idle.shift();
    if (!job) return;
    try { job(); } catch (e) { report(e); }
    if (idle.length) idleTimer = setTimeout(pumpIdle, 8);
  }
  const startIdle = () => { if (idle.length && idleTimer === null) idleTimer = setTimeout(pumpIdle, 8); };

  // Sound bank accessors
  const B = {
    step: (s, run) => bank(`step:${s}:${run ? 1 : 0}`, 4, (sr, r) => genStep(sr, r, s, run ? 1.18 : .86)),
    land: (s) => bank(`land:${s}`, 3, (sr, r) => genLand(sr, r, s)),
    slide: (s) => bank(`slide:${s}`, 2, (sr, r) => genSlide(sr, r, s)),
    jump: () => bank('jump', 3, genJump),
    impact: (s) => bank(`impact:${s}`, 4, (sr, r) => genImpact(sr, r, s)),
    whizz: () => bank('whizz', 4, genWhizz),
    ui: (k) => bank(`ui:${k}`, 1, (sr, r) => genUi(sr, k, r)),
    artillery: () => bank('artillery', 3, genArtillery),
    water: () => bank('water', 4, genWaterLap),
    creak: () => bank('creak', 4, genCreak),
  };
  function warmBanks() {
    for (const s of SURFACES) {
      warm(`step:${s}:0`, 4, (sr, r) => genStep(sr, r, s, .86));
      warm(`step:${s}:1`, 4, (sr, r) => genStep(sr, r, s, 1.18));
      warm(`impact:${s}`, 4, (sr, r) => genImpact(sr, r, s));
      warm(`land:${s}`, 3, (sr, r) => genLand(sr, r, s));
    }
    warm('whizz', 4, genWhizz);
    for (const s of SURFACES) warm(`slide:${s}`, 2, (sr, r) => genSlide(sr, r, s));
    warm('artillery', 3, genArtillery);
    startIdle();
  }

  // Arsenal sound banks (generated on first use, or ahead of time through preload)
  const X = {
    boom: () => bank('boom:near', 3, genBoomNear),
    rumble: () => bank('boom:far', 2, genBoomRumble),
    debris: () => bank('boom:debris', 3, genDebris),
    launch: () => bank('rl:launch', 2, genRocketLaunch),
    loop: () => bank('rl:loop', 1, genRocketLoop),
    thump: () => bank('gl:thump', 3, genThump),
    xbow: () => bank('xbow', 3, genXbow),
    flesh: () => bank('flesh', 3, genFlesh),
    bounce: (s) => bank(`bounce:${s}`, 3, (sr, r) => genBounce(sr, r, s)),
  };
  const lastOnce = {}, flying = [], wanted = [], gunPending = {};
  let extraChain = Promise.resolve();
  const since = (key) => ctx.currentTime - (lastOnce[key] === undefined ? -9 : lastOnce[key]);
  // The viewmodel and the engine may both report the same local event: only the first one within `gap` seconds plays.
  const once = (key, gap) => { if (since(key) < gap) return false; lastOnce[key] = ctx.currentTime; return true; };
  const mine = (o) => !o || typeof o !== 'object' || isOwn(o);
  // One-shot heard either at the player's ear or from a world position.
  function oneShot(cat, buffer, o, gain, ref, roll, opt = {}) {
    if (mine(o)) return play(cat, buffer, { when: opt.when, gain, rate: rand(.97, 1.03), send: (opt.send || .04) * E().ownWet, echo: opt.echo || 0 });
    const p = spatial(o, ref, roll, !!o.occluded);
    if (p.atten < .008) return null;
    return play(cat, buffer, {
      when: ctx.currentTime + p.delay, gain: gain * p.atten, pan: p.pan, lp: p.lp, rate: rand(.96, 1.03),
      send: (opt.send || .04) * (1 + p.far * 2), echo: (opt.echo || 0) * (1 + p.far),
    });
  }
  // Newer weapons are rendered when first needed, after the base six, so start-up costs nothing extra.
  function requestGun(id) {
    if (!GUNS[id] || BASE_GUNS.includes(id) || gunBuffers[id]) return Promise.resolve();
    if (gunPending[id]) return gunPending[id];
    const Off = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!Off) return Promise.resolve();
    const job = async () => {
      const rendered = [];
      for (let v = 0; v < (GUN_VARIANTS[id] || 2); v++) {
        try { rendered.push(await renderGun(Off, GUNS[id], hashStr(id) + v * 1301, ctx.sampleRate)); }
        catch (e) { report(e); }
      }
      if (rendered.length) gunBuffers[id] = rendered;
      delete gunPending[id];
    };
    gunPending[id] = extraChain = Promise.all([ready, extraChain]).then(job).catch(report);
    return gunPending[id];
  }
  function prepare(id) {
    if (id === 'rl' || id === 'gl' || id === 'frag') {
      warm('boom:near', 3, genBoomNear); warm('boom:far', 2, genBoomRumble); warm('boom:debris', 3, genDebris);
      if (id === 'rl') { warm('rl:launch', 2, genRocketLaunch); warm('rl:loop', 1, genRocketLoop); }
      if (id === 'gl') warm('gl:thump', 3, genThump);
      startIdle();
    }
    return requestGun(id);
  }

  function gunBuffer(id) {
    const list = gunBuffers[id];
    if (list && list.length) {
      let i = Math.floor(Math.random() * list.length);
      if (list.length > 1 && i === lastGun[id]) i = (i + 1) % list.length;
      lastGun[id] = i;
      return list[i];
    }
    if (!BASE_GUNS.includes(id)) requestGun(id);
    return bank(`gunfb:${id}`, 2, (sr, r) => genGunFallback(sr, r, GUNS[id]));
  }
  async function renderWeapons() {
    const Off = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (Off) {
      for (const id of BASE_GUNS) {
        const rendered = [];
        for (let v = 0; v < GUN_VARIANTS[id]; v++) {
          try { rendered.push(await renderGun(Off, GUNS[id], hashStr(id) + v * 1301, ctx.sampleRate)); }
          catch (e) { report(e); }
        }
        if (rendered.length) gunBuffers[id] = rendered;
      }
    }
    resolveReady();
  }

  function reap(cat, now) {
    const list = voices[cat];
    for (let i = list.length - 1; i >= 0; i--) if (list[i].end <= now) list.splice(i, 1);
  }
  function steal(v, now) {
    try {
      const gp = v.g.gain;
      gp.cancelScheduledValues(now);
      gp.setValueAtTime(v.gain, now);
      gp.linearRampToValueAtTime(0, now + .03);
      v.src.stop(now + .04);
    } catch (e) { report(e); }
  }
  function play(cat, buffer, o = {}) {
    if (!buffer || !running()) return null;
    const now = ctx.currentTime, when = Math.max(now, finite(o.when, now));
    const gain = clamp(finite(o.gain, 1), 0, 2);
    if (gain < .0012) return null;
    reap(cat, now);
    const list = voices[cat];
    while (list.length >= CAPS[cat]) steal(list.shift(), now);

    const src = ctx.createBufferSource(), g = ctx.createGain(), nodes = [src, g];
    src.buffer = buffer;
    src.playbackRate.value = clamp(finite(o.rate, 1), .5, 2);
    g.gain.value = gain;
    let head = src;
    if (o.lp && o.lp < 17500) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = clamp(o.lp, 120, 20000);
      lp.Q.value = .5;
      head.connect(lp);
      head = lp;
      nodes.push(lp);
    }
    head.connect(g);
    let tail = g;
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(finite(o.pan), -1, 1);
      g.connect(p);
      tail = p;
      nodes.push(p);
    }
    const dest = o.bus || buses.sfx;
    tail.connect(dest);
    const addSend = (amount, target) => {
      if (!(amount > .002)) return;
      const s = ctx.createGain();
      s.gain.value = clamp(amount, 0, 1.4);
      head.connect(s);
      s.connect(target);
      nodes.push(s);
    };
    addSend(o.send, buses.reverb);
    addSend(o.echo, buses.echo);
    const v = { src, g, gain, end: when + buffer.duration / src.playbackRate.value + .05 };
    list.push(v);
    v.nodes = nodes;
    src.onended = () => {
      for (const n of nodes) { try { n.disconnect(); } catch { /* already disconnected */ } }
      const idx = list.indexOf(v);
      if (idx >= 0) list.splice(idx, 1);
    };
    src.start(when);
    return v;
  }

  function spatial(p, ref, roll, occluded) {
    const dx = finite(p.x, listener.x) - listener.x, dy = finite(p.y, listener.y) - listener.y, dz = finite(p.z, listener.z) - listener.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz), hd = Math.hypot(dx, dz);
    const cs = Math.cos(listener.yaw), sn = Math.sin(listener.yaw);
    const side = dx * cs - dz * sn, front = -dx * sn - dz * cs;
    const pan = hd > .01 ? clamp(side / hd, -1, 1) * Math.min(1, hd / 2.2) * .9 : 0;
    const behind = hd > .01 && front < 0 ? -front / hd : 0;
    let atten = ref / (ref + roll * Math.max(0, d - ref));
    let lp = Math.max(420, 19500 * Math.exp(-d / 62) * (1 - .32 * behind));
    if (occluded) { atten *= .52; lp = Math.max(260, Math.min(lp * .22, 1500)); }
    return { d, pan, atten, lp, delay: d / 343, far: smooth(10, 72, d) };
  }
  const isOwn = (o) => !!o && (o.own === true || (o.own === undefined && !Number.isFinite(o.x)));
  const E = () => ENVS[envName];

  // Environment
  // Impulse responses are built a slice at a time on the idle queue (a whole one blocked the page for 300 ms at CPU x4).
  const irJobs = {}, irWait = new Set();
  function irStep(name, ms) {       // advances the IR of `name` for up to `ms`; true once it is ready
    if (irCache[name]) return true;
    const g = irJobs[name] || (irJobs[name] = irSteps(ctx, ENVS[name].ir, hashStr('ir:' + name))), t0 = performance.now();
    for (;;) { const r = g.next(); if (r.done) { irCache[name] = r.value; delete irJobs[name]; return true; } if (performance.now() - t0 >= ms) return false; }
  }
  const irJob = (name, then) => { const job = () => { if (irStep(name, 4)) { if (then) then(); } else idle.unshift(job); }; return job; };
  function irFor(name) { irStep(name, Infinity); return irCache[name]; }
  function applyEnvironment(fade = .5) {
    if (!irCache[envName]) {       // the current room's IR goes first in the queue; the reverb switches when it is ready
      const want = envName;
      if (!irWait.has(want)) { irWait.add(want); idle.unshift(irJob(want, () => { irWait.delete(want); if (alive && envName === want) applyEnvironment(fade); })); startIdle(); }
      return;
    }
    const env = E(), now = ctx.currentTime;
    const next = ctx.createConvolver(), g = ctx.createGain();
    next.normalize = true;
    next.buffer = irFor(envName);
    g.gain.setValueAtTime(.0001, now);
    g.gain.exponentialRampToValueAtTime(env.wet, now + Math.max(.02, fade));
    buses.reverb.connect(next); next.connect(g); g.connect(buses.mix);
    if (convolver) {
      const oldC = convolver, oldG = wetGain;
      glide(oldG.gain, 0, now, fade);
      setTimeout(() => { try { buses.reverb.disconnect(oldC); oldC.disconnect(); oldG.disconnect(); } catch { /* gone */ } }, (fade + .4) * 1000);
    }
    convolver = next; wetGain = g;
    glide(buses.echoDelay.delayTime, env.echo.t, now, .15);
    glide(buses.echoFb.gain, env.echo.fb, now, .15);
    glide(buses.echoLp.frequency, env.echo.lp, now, .15);
    glide(buses.echoOut.gain, env.echo.g, now, .15);
  }
  function buildGraph() {
    const mk = () => ctx.createGain();
    buses.sfx = mk(); buses.mix = mk(); buses.reverb = mk(); buses.echo = mk(); buses.amb = mk(); buses.ambSend = mk();
    buses.amb.gain.value = 0;
    buses.ambSend.gain.value = .22;
    buses.sfx.connect(buses.mix);
    buses.amb.connect(buses.mix);
    buses.amb.connect(buses.ambSend);
    buses.ambSend.connect(buses.reverb);

    buses.echoDelay = ctx.createDelay(1.2);
    buses.echoLp = ctx.createBiquadFilter();
    buses.echoLp.type = 'lowpass';
    buses.echoHp = ctx.createBiquadFilter();
    buses.echoHp.type = 'highpass';
    buses.echoHp.frequency.value = 170;
    buses.echoFb = mk(); buses.echoOut = mk();
    const e = ENVS[envName].echo;
    buses.echoDelay.delayTime.value = e.t; buses.echoFb.gain.value = e.fb; buses.echoLp.frequency.value = e.lp; buses.echoOut.gain.value = e.g;
    buses.echo.connect(buses.echoDelay);
    buses.echoDelay.connect(buses.echoLp);
    buses.echoLp.connect(buses.echoHp);
    buses.echoHp.connect(buses.echoFb);
    buses.echoFb.connect(buses.echoDelay);
    buses.echoHp.connect(buses.echoOut);
    buses.echoOut.connect(buses.mix);
    const echoVerb = mk();
    echoVerb.gain.value = .25;
    buses.echoHp.connect(echoVerb);
    echoVerb.connect(buses.reverb);

    // Master chain: trim, glue compressor, fast limiter, soft ceiling, volume.
    const trim = mk();
    trim.gain.value = .72;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 3.5; glue.attack.value = .006; glue.release.value = .16;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -5; limiter.knee.value = 1; limiter.ratio.value = 20; limiter.attack.value = .001; limiter.release.value = .09;
    const pre = mk();
    pre.gain.value = .5;
    const ceiling = ctx.createWaveShaper();
    const n = 4097, curve = new Float32Array(n), k = 2.1;
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = .94 * Math.tanh(x * k) / Math.tanh(k); }
    ceiling.curve = curve;
    ceiling.oversample = '2x';
    buses.master = mk();
    buses.master.gain.value = masterVolume;
    buses.mix.connect(trim); trim.connect(glue); glue.connect(limiter); limiter.connect(pre); pre.connect(ceiling); ceiling.connect(buses.master); buses.master.connect(ctx.destination);
  }

  // Ambience
  async function ensureBed(name) {
    if (bedCache[name]) return bedCache[name];
    if (!bedPending[name]) {
      const Off = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
      if (!Off) return null;
      bedPending[name] = renderBed(Off, name).then((b) => { bedCache[name] = b; return b; }).catch((e) => { report(e); delete bedPending[name]; return null; });
    }
    return bedPending[name];
  }
  function stopBed(fade = 1) {
    if (!bedVoice) return;
    const b = bedVoice, now = ctx.currentTime;
    bedVoice = null;
    try {
      b.g.gain.cancelScheduledValues(now);
      glide(b.g.gain, 0, now, fade);
      b.src.stop(now + fade + .4);
      b.src.onended = () => { try { b.src.disconnect(); b.g.disconnect(); } catch { /* gone */ } };
    } catch (e) { report(e); }
  }
  async function startBed() {
    const token = ++ambToken, name = envName, buf = await ensureBed(name);
    if (token !== ambToken || !ambOn || !buf || !ctx) return;
    stopBed(1.2);
    const src = ctx.createBufferSource(), g = ctx.createGain(), now = ctx.currentTime;
    src.buffer = buf; src.loop = true;
    g.gain.setValueAtTime(.0001, now);
    g.gain.exponentialRampToValueAtTime(name === 'bunker' ? .24 : .3, now + 1.8);
    src.connect(g); g.connect(buses.amb);
    src.start(now, Math.random() * buf.duration);
    bedVoice = { src, g };
  }
  function resetEvents() {
    const now = ctx.currentTime;
    for (const k of Object.keys(nextEvent)) delete nextEvent[k];
    for (const [k, [a, b]] of Object.entries(E().events)) nextEvent[k] = now + rand(a * .25, b * .6);
  }
  function ambVoice(buffer, when, gain, pan, lp, send, echo, rate = 1) {
    play('amb', buffer, { when, gain, pan, lp, send, echo, rate, bus: buses.amb });
  }
  function fireEvent(type, t) {
    const pan = rand(-.95, .95);
    if (type === 'gunfire') {
      const id = pick(['ar', 'lmg', 'smg', 'ar', 'p9']), n = id === 'p9' ? 1 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 5);
      const gap = id === 'lmg' ? .1 : id === 'smg' ? .068 : id === 'p9' ? .24 : .094;
      const level = rand(.1, .24), lp = rand(650, 1500);
      for (let i = 0; i < n; i++) {      // far-off fire is the real distant recording of that weapon, or nothing while it is not decoded
        const take = smp && smp.shot(id, false, .9);
        if (take && take[0]) ambVoice(take[0].buffer, t + i * gap * rand(.94, 1.06), level * Math.min(1.2, take[0].gain) * rand(.86, 1.05), pan, lp, .22, .24, take[0].rate * rand(.96, 1.01));
      }
    } else if (type === 'artillery') {
      ambVoice(B.artillery(), t, rand(.46, .84), pan, rand(220, 520), .3, .25, rand(.88, 1.08));
    } else if (type === 'water') {
      ambVoice(B.water(), t, rand(.14, .28), pan, 3200, .1, 0, rand(.85, 1.12));
    } else if (type === 'creak') {
      ambVoice(B.creak(), t, rand(.07, .18), pan, 3600, .4, .08, rand(.82, 1.14));
    } else if (type === 'tick') {     // a distant metal tick: a real recording, or nothing
      const sm = smp && smp.handling(null, 'casing');
      if (sm) ambVoice(sm.buffer, t, rand(.04, .1), pan, 8000, .7, .05, rand(.9, 1.15));
    }
  }
  function ambienceTick() {
    if (!ambOn || !running()) return;
    try {
      const now = ctx.currentTime, horizon = now + 1.5, events = E().events;
      for (const [k, [a, b]] of Object.entries(events)) {
        if (nextEvent[k] === undefined) nextEvent[k] = now + rand(a, b);
        let guard2 = 0;
        while (nextEvent[k] < horizon && guard2++ < 4) {
          fireEvent(k, Math.max(now + .01, nextEvent[k]));
          nextEvent[k] = Math.max(now, nextEvent[k]) + rand(a, b);
        }
      }
    } catch (e) { report(e); }
  }
  function beginAmbience() {
    if (ambOn) return;
    ambOn = true;
    const now = ctx.currentTime;
    buses.amb.gain.cancelScheduledValues(now);
    glide(buses.amb.gain, 1, now, 1);
    resetEvents();
    if (ambTimer === null) ambTimer = setInterval(ambienceTick, 400);
    startBed();
  }
  function endAmbience() {
    ambOn = false;
    ambToken++;
    if (ambTimer !== null) { clearInterval(ambTimer); ambTimer = null; }
    const now = ctx.currentTime;
    buses.amb.gain.cancelScheduledValues(now);
    glide(buses.amb.gain, 0, now, .9);
    stopBed(1);
  }

  // Weapon handling, grenade, knife and feedback sounds come only from the recorded bank (audio-samples.js). There is no synthesized
  // fallback: a sound that is not decoded yet, or a stage nobody knows, is simply silent. Returns true when a recording was started.
  function rec(stage, o, gain, cat = 'foley', send = .03, wid, extra) {
    if (!smp) return false;
    if (mine(o)) return smp.hand(play, wid, stage, Object.assign({ gain, rate: rand(.97, 1.03), send: send * E().ownWet }, extra), cat);
    const p = spatial(o, 2.5, 1.3, !!o.occluded);
    if (p.atten < .008) return false;
    return smp.hand(play, wid, stage, { when: ctx.currentTime + p.delay, gain: gain * p.atten, pan: p.pan, lp: p.lp, rate: rand(.96, 1.03), send: send * (1 + p.far * 2) }, cat);
  }
  // Launcher reports built from real blasts; false while they are not decoded (the caller then uses its procedural voice).
  function recShot(id, o, gain, ref, roll, send, echo) {
    if (!smp) return false;
    const now = ctx.currentTime;
    if (mine(o)) return smp.fire(play, 'launch', id, null, { gain, rate: rand(.985, 1.015), send: send * E().ownWet, echo }, now);
    const s = spatial(o, ref, roll, !!o.occluded);
    if (s.atten < .008) return true;
    return smp.fire(play, 'launch', id, s, { when: now + s.delay, gain: gain * s.atten, pan: s.pan, lp: s.lp, rate: rand(.97, 1.02), send: send * (1 + s.far * 2), echo: echo * (1 + s.far) }, now, o);
  }

  // Public API
  function unlock() {
    try {
      if (!ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) { resolveReady(); return; }
        ctx = new AC({ latencyHint: 'interactive' });
        buildGraph();
        applyEnvironment(.02);
        alive = true;
        if (typeof document === 'object') import('./audio-samples.js').then((m) => { const bank = m.createSampleBank({ report }); bank.prime(smpWant); bank.attach(ctx); smp = bank; }).catch(report);
        renderWeapons().catch((e) => { report(e); resolveReady(); });
        warmBanks();
        if (wanted.length) a.preload(wanted.splice(0));
        for (const n of Object.keys(ENVS)) if (n !== envName) idle.push(irJob(n));
        startIdle();
        if (wantAmbience) beginAmbience();
      }
      if (ctx.state !== 'running' && ctx.resume) {
        const p = ctx.resume();
        if (p && p.catch) p.catch(report);
      }
    } catch (e) {
      report(e);
      alive = false;
      resolveReady();
    }
  }

  const a = {
    unlock,
    // Resolves when all weapon variants are rendered; shots use a lighter fallback until then.
    ready,
    // Loading screens: run the queued sound-bank renders for up to `ms` and return how many are left (they otherwise trickle in during play).
    pump(ms = 6) {
      if (!ctx || !alive) return 0;
      const t0 = performance.now();
      while (idle.length && performance.now() - t0 < ms) { const job = idle.shift(); try { job(); } catch (e) { report(e); } }
      return idle.length;
    },
    setMasterVolume(v) {
      masterVolume = clamp(finite(v, masterVolume), 0, 1);
      if (!ctx || !alive) return;
      try { glide(buses.master.gain, masterVolume, ctx.currentTime, .06); } catch (e) { report(e); }
    },
    // Replay video (replay-export.js): stream(true) taps the final mix into a MediaStream (null if unavailable); stream(false) disconnects the tap.
    stream(on) {
      if (!ctx || !alive || !buses.master || !ctx.createMediaStreamDestination) return null;
      try {
        if (on) { if (!a._tap) a._tap = ctx.createMediaStreamDestination(); if (!a._tapOn) { buses.master.connect(a._tap); a._tapOn = true; } return a._tap.stream; }
        if (a._tap && a._tapOn) { a._tapOn = false; buses.master.disconnect(a._tap); }
      } catch (e) { report(e); }
      return null;
    },
    setEnvironment(name) {
      if (!ENVS[name] || name === envName) return;
      envName = name;
      if (!ctx || !alive) return;
      try {
        applyEnvironment(.5);
        if (ambOn) { resetEvents(); startBed(); }
      } catch (e) { report(e); }
    },
    startAmbience() {
      wantAmbience = true;
      if (!ctx || !alive) return;
      try { beginAmbience(); } catch (e) { report(e); }
    },
    stopAmbience() {
      wantAmbience = false;
      if (!ctx || !alive || !ambOn) return;
      try { endAmbience(); } catch (e) { report(e); }
    },
    setListener(x, y, z, yaw) {
      listener.x = finite(x, listener.x); listener.y = finite(y, listener.y); listener.z = finite(z, listener.z); listener.yaw = finite(yaw, listener.yaw);
    },
    shot: guard((id, o = {}) => {
      // weapons without a gunshot have their own voices
      if (id === 'rl') { a.rocketLaunch(o); return; }
      if (id === 'gl') { a.thump(o); return; }
      if (id === 'knife') { a.swing(o); return; }
      if (id === 'frag') { a.throw(o); return; }
      if (id === 'xbow') { if (!recShot('xbow', o, .62, 3, 1.3, .03, 0)) oneShot('launch', X.xbow(), o, .4, 3, 1.3, { send: .03 }); return; }
      const key = GUNS[id] ? id : 'ar', spec = GUNS[key], env = E(), buf = gunBuffer(key), now = ctx.currentTime;
      const loud = clamp(finite(o.loud, 1), .05, 2), muffle = loud < .6;       // attachments: a suppressor is quieter and duller, a compensator a little louder
      if (isOwn(o)) {
        const gapShot = now - lastOwnShot, duck = (gapShot < .16 ? .84 : 1) * (spec.rapid && gapShot < .07 ? spec.rapid : 1) * loud;
        lastOwnShot = now;
        if (smp && smp.fire(play, 'gunOwn', id, null, { gain: spec.level * duck, rate: rand(.985, 1.015), send: spec.wet * env.ownWet * duck, echo: spec.echo * duck, lp: muffle ? 3400 : 0 }, now)) return;
        play('gunOwn', buf, { gain: spec.level * duck, rate: rand(.985, 1.015), send: spec.wet * env.ownWet * duck, echo: spec.echo * duck, lp: muffle ? 3400 : 0 });
        return;
      }
      const s = spatial(o, 7, 1, !!o.occluded);
      if (s.atten < .006) return;
      if (muffle) s.lp = Math.min(s.lp, 2600);
      const body = spec.level * s.atten * (1 - s.far * .35) * loud;
      const wetBase = spec.level * Math.pow(s.atten, .62);
      if (smp && smp.fire(play, 'gun', id, s, {
        when: now + s.delay, gain: body, pan: s.pan, lp: s.lp, rate: rand(.975, 1.012),
        send: wetBase * (.2 + s.far * .55) * (o.occluded ? 1.25 : 1),
        echo: wetBase * (spec.echo * .7 + s.far * .34),
      }, now, o)) return;
      play('gun', buf, {
        when: now + s.delay, gain: body, pan: s.pan, lp: s.lp, rate: rand(.975, 1.012),
        send: wetBase * (.2 + s.far * .55) * (o.occluded ? 1.25 : 1),
        echo: wetBase * (spec.echo * .7 + s.far * .34),
      });
    }),
    // wid (optional) = the weapon in hand, so the recorded handling matches it; without it, the weapon the player fired last
    dry: guard((wid) => { rec('dry', undefined, .36, 'reload', .025, wid); }),
    // Every stage the viewmodel reports, known or not: a recording, or silence.
    reload: guard((stage, wid) => {
      if (typeof stage !== 'string') return;
      if (stage === 'swing') { a.swing(); return; }
      if (stage === 'stab') { a.stab(false); return; }
      if (stage === 'pinPull') { a.pinPull(); return; }
      if (stage === 'throw') { a.throw(); return; }
      rec(stage, undefined, .5, 'reload', .05, wid);
    }),
    // Shouldering the weapon: a light cloth movement (for game.js to call when aiming starts).
    aim: guard(() => { if (once('aim:own', .25)) rec('aim', undefined, .4, 'foley', .015); }),
    step: guard((surface, o = {}) => {
      const s = surfaceOf(surface), run = !!o.run, buf = B.step(s, run);
      if (isOwn(o)) { play('step', buf, { gain: (run ? .25 : .17) * rand(.86, 1.08), rate: rand(.93, 1.07), send: .025 * E().ownWet }); return; }
      const p = spatial(o, 2.5, 1.35, !!o.occluded);
      if (p.d > 42 || p.atten < .02) return;
      play('step', buf, { when: ctx.currentTime + p.delay, gain: (run ? .42 : .3) * p.atten * rand(.86, 1.08), pan: p.pan, lp: Math.min(p.lp, 9000), rate: rand(.93, 1.07), send: .05 + p.far * .05 });
    }),
    land: guard((surface) => { play('foley', B.land(surfaceOf(surface)), { gain: .46, rate: rand(.94, 1.05), send: .05 * E().ownWet }); }),
    slide: guard((surface) => { play('foley', B.slide(surfaceOf(surface)), { gain: .3, rate: rand(.94, 1.06), send: .05 * E().ownWet }); }),
    jump: guard(() => { play('foley', B.jump(), { gain: .22, rate: rand(.94, 1.06), send: .02 }); }),
    impact: guard((surface, o = {}) => {
      const now = ctx.currentTime;
      if (now - impactWindow > .03) { impactWindow = now; impactCount = 0; }
      if (++impactCount > 3) return;
      const p = spatial(o, 3, 1.1, !!o.occluded);
      if (p.atten < .012) return;
      play('impact', B.impact(surfaceOf(surface)), { when: now + p.delay, gain: .5 * p.atten * rand(.82, 1.05), pan: p.pan, lp: p.lp, rate: rand(.92, 1.09), send: .08 + p.far * .12, echo: p.far * .05 });
    }),
    whizz: guard((o = {}) => {
      const p = spatial(o, 3, .8, false);
      if (p.d > 18) return;
      play('whizz', B.whizz(), { gain: .34 * p.atten, pan: p.pan, lp: Math.max(p.lp, 6000), rate: rand(.92, 1.1), send: .025 });
    }),
    casing: guard((surface) => {
      const soft = surface === 'sand' || surface === 'snow';
      rec('casing', undefined, rand(.22, .36) * (soft ? .5 : 1), 'casing', .025, undefined, { when: ctx.currentTime + rand(.24, .46), pan: rand(.1, .45), rate: rand(.95, 1.08), lp: soft ? 1900 : undefined });
    }),
    hit: guard((isHead) => { rec(isHead ? 'head' : 'hit', undefined, isHead ? .44 : .4, 'hud', 0); }),
    kill: guard(() => { rec('kill', undefined, .44, 'hud', 0); }),
    hurt: guard(() => { play('hud', B.ui('hurt'), { gain: .44, lp: 1800 }); }),
    ui: guard(() => { play('ui', B.ui('tick'), { gain: .18 }); }),
    buy: guard(() => { play('ui', B.ui('buy'), { gain: .22 }); }),
    // ---- arsenal ----------------------------------------------------------
    // Optional: render the newer weapons' shots ahead of time (otherwise the first shot of each uses a lighter fallback).
    // Safe before unlock(): the ids are remembered and rendered once audio starts. Resolves when they are ready.
    preload(ids) {
      const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => typeof id === 'string');
      if (smp) smp.prime(list); else for (const id of list) if (!smpWant.includes(id)) smpWant.push(id);
      if (!ctx || !alive) { for (const id of list) if (!wanted.includes(id)) wanted.push(id); return Promise.resolve(); }
      try { return Promise.all(list.map(prepare)).then(() => undefined); } catch (e) { report(e); return Promise.resolve(); }
    },
    // Blast at a world position: crack and fireball up close, a longer low rumble with distance, falling debris nearby.
    explosion: guard((o = {}) => {
      const size = clamp(finite(o.size, 1), .3, 2), p = spatial(o, 10, .9, !!o.occluded), now = ctx.currentTime;
      const level = .62 + .38 * Math.min(size, 1.4), rate = clamp(1.1 - .16 * size, .7, 1.1), carry = level * Math.pow(p.atten, .5);
      const near = level * p.atten * (1 - p.far * .55);
      if (near > .01) {
        play('boom', X.boom(), {
          when: now + p.delay, gain: near * 1.35, pan: p.pan * .8, lp: p.lp, rate: rate * rand(.96, 1.04),
          send: Math.min(1.2, carry * (.3 + p.far * .5)), echo: carry * (.25 + p.far * .3),
        });
      }
      const roll = Math.min(.9, carry * (.3 + p.far * .5));
      if (roll > .01) play('rumble', X.rumble(), { when: now + p.delay + .02, gain: roll * 1.35, pan: p.pan * .4, lp: Math.min(p.lp, 2400 - p.far * 1700), rate: rate * rand(.92, 1.05), send: .18 });
      if (p.d < 45 && !o.occluded) play('debris', X.debris(), { when: now + p.delay + .1, gain: .42 * level * (1 - p.d / 45), pan: p.pan, lp: Math.min(p.lp, 9000), rate: rand(.9, 1.1), send: .12 });
    }),
    rocketLaunch: guard((o = {}) => {
      if (mine(o) && !once('rl:own', .08)) return;
      if (!recShot('rl', o, .8, 9, 1, .3, .2)) oneShot('launch', X.launch(), o, .78, 9, 1, { send: .3, echo: .2 });
    }),
    // Looping whoosh for a rocket in flight. Always returns { update({x,y,z}), stop() } (inert before unlock). At most four at once.
    rocketFly(o = {}) {
      const inert = { update() {}, stop() {} };
      if (!ctx || !alive || !running()) return inert;
      try {
        while (flying.length >= 4) flying[0].stop();
        const now = ctx.currentTime, src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        let live = true;
        src.buffer = X.loop(); src.loop = true;
        lp.type = 'lowpass'; lp.Q.value = .5; lp.frequency.value = 3000;
        g.gain.value = 0;
        src.connect(lp); lp.connect(g);
        if (pan) { g.connect(pan); pan.connect(buses.sfx); } else g.connect(buses.sfx);
        const place = (q, time) => {
          const p = spatial(q || {}, 6, 1, !!(q && q.occluded)), t = ctx.currentTime;
          glide(g.gain, .32 * p.atten, t, time);
          glide(lp.frequency, clamp(Math.min(p.lp, 6000), 200, 6000), t, time);
          if (pan) glide(pan.pan, p.pan, t, time);
        };
        const drop = () => { const i = flying.indexOf(handle); if (i >= 0) flying.splice(i, 1); };
        const handle = {
          update(q) { if (!live) return; try { place(q, .07); } catch (e) { report(e); } },
          stop() {
            if (!live) return;
            live = false; drop();
            try { const t = ctx.currentTime; glide(g.gain, 0, t, .05); src.stop(t + .09); } catch (e) { report(e); }
          },
        };
        src.onended = () => {
          live = false; drop();
          try { src.disconnect(); lp.disconnect(); g.disconnect(); if (pan) pan.disconnect(); } catch { /* already disconnected */ }
        };
        place(o, .04);
        src.start(now, Math.random() * .5);
        src.stop(now + 8);
        flying.push(handle);
        return handle;
      } catch (e) { report(e); return inert; }
    },
    thump: guard((o = {}) => {
      if (mine(o) && !once('gl:own', .06)) return;
      if (!recShot('gl', o, .7, 7, 1.05, .2, .1)) oneShot('launch', X.thump(), o, .66, 7, 1.05, { send: .2, echo: .1 });
    }),
    // Grenade hitting a surface; o.size (0..1) is the impact strength.
    bounce: guard((surface, o = {}) => {
      const p = spatial(o, 3, 1.1, !!o.occluded), k = clamp(finite(o.size, .7), .15, 1);
      if (p.atten < .015) return;
      play('impact', X.bounce(surfaceOf(surface)), { when: ctx.currentTime + p.delay, gain: .55 * p.atten * (.35 + .65 * k), pan: p.pan, lp: p.lp, rate: rand(.9, 1.08) * (1.06 - .1 * k), send: .08 + p.far * .1 });
    }),
    // Knife through the air. No argument (or own) = the player's own blade; a position plays it in the world.
    swing: guard((o) => {
      if (mine(o) && !once('melee:own', .12)) return;
      rec('swing', o, .56, 'melee', .02);
    }),
    // Knife thrust. stab(true) or stab({x,y,z,own}) adds the hit on a body; stab(false) or stab() is the thrust alone.
    stab: guard((arg) => {
      const o = arg && typeof arg === 'object' ? arg : undefined, hit = o ? true : !!arg;
      if (mine(o)) {
        if (once('melee:own', .12)) rec('stab', undefined, .56, 'melee', .02);
        if (hit && once('flesh:own', .08)) play('melee', X.flesh(), { when: ctx.currentTime + .03, gain: .5, rate: rand(.92, 1.08), send: .03 });
        return;
      }
      if (hit) oneShot('melee', X.flesh(), o, .6, 2.5, 1.3, { send: .03 });
      else rec('stab', o, .56, 'melee', .03);
    }),
    pinPull: guard((o) => {
      if (mine(o) && !once('pin:own', .15)) return;
      rec('pinPull', o, .5, 'foley', .03);
    }),
    throw: guard((o) => {
      if (mine(o) && !once('throw:own', .15)) return;
      // a pin pulled in the same instant (quick throw) is heard first
      rec('throw', o, .52, 'foley', .02, undefined, mine(o) && since('pin:own') < .06 ? { when: ctx.currentTime + .16 } : undefined);
    }),
    click: guard(() => { rec('click', undefined, .34, 'ui', 0); }),
    // Flamethrower: no recording fits, so a quiet shaped-noise roar (the only new synthetic sound of the arsenal). Called on each tick of the jet, thinned here.
    flame: guard((o) => {
      if (!running()) return; const now = ctx.currentTime, own = mine(o), key = own ? 'own' : 'far'; if (now - (flameAt[key] || -1) < .17) return; flameAt[key] = now;
      const buf = bank('flameRoar', 3, (sr, r) => { const n = Math.floor(sr * .34), d = new Float32Array(n); let a = 0, b = 0; for (let i = 0; i < n; i++) { const t = i / n, w = r() * 2 - 1; a += (w - a) * .16; b += (a - b) * .09; d[i] = (a * .55 + b * 1.5) * Math.min(1, t * 9) * Math.pow(1 - t, 1.3) * (.75 + .25 * Math.sin(t * 37 + r() * .4)); } return d; });
      if (own) { play('foley', buf, { gain: .3, rate: rand(.9, 1.1), send: .03 }); return; }
      const s = spatial(o, 4, 1.1, !!o.occluded); if (s.atten < .012) return; play('foley', buf, { when: now + s.delay, gain: .34 * s.atten, pan: s.pan, lp: s.lp, rate: rand(.9, 1.1), send: .05 });
    }),
    // The recorded-sound bank once its module has loaded (stats(), setEnabled(bool), settled), else null. For diagnostics and tests.
    samples: () => smp,
  };
  return a;
}
