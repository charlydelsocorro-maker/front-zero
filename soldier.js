// soldier.js — FRONT ZÉRO procedural animated soldier / zombie.
// One SkinnedMesh per character (rigid skinning), shared geometry per variant,
// procedural locomotion with distance-driven gait + 2-bone IK, Verlet ragdoll deaths.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------------------------------------------------------------- constants
const PEL = 0, SPI = 1, CHE = 2, NEC = 3, HEA = 4, UAL = 5, FAL = 6, HAL = 7, UAR = 8, FAR = 9, HAR = 10,
  THL = 11, SHL = 12, FOL = 13, THR = 14, SHR = 15, FOR = 16, GUN = 17, NB = 18;
const PARENT = [-1, PEL, SPI, CHE, NEC, CHE, UAL, FAL, CHE, UAR, FAR, PEL, THL, SHL, PEL, THR, SHR, CHE];
const NAMES = ['pelvis', 'spine', 'chest', 'neck', 'head', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'gun'];
const BIND0 = [[0, .96, 0], [0, 1.09, 0], [0, 1.27, 0], [0, 1.49, 0], [0, 1.585, -.005], [-.2, 1.445, 0], [-.2, 1.155, 0], [-.2, .885, 0],
  [.2, 1.445, 0], [.2, 1.155, 0], [.2, .885, 0], [-.1, .935, 0], [-.1, .505, 0], [-.1, .09, 0], [.1, .935, 0], [.1, .505, 0], [.1, .09, 0], [.12, 1.25, -.45]];
const BALL0 = [0, -.09, -.175];               // ball-of-foot pivot relative to ankle (foot bone)
const TAU = Math.PI * 2;
const STATIC_SLIP = .3 / 120;   // m per ragdoll substep (0.3 m/s)

// gun-local layout: origin = top of pistol grip, barrel toward -Z
const WEAP = {
  ar:  { butt: .25, buttY: -.01, fore: -.22, foreY: -.015, muzzle: -.545, my: .03, rec: 1.0, blade: -.42, mag: -.07 },
  smg: { butt: .22, buttY: -.01, fore: -.17, foreY: -.02, muzzle: -.35, my: .03, rec: .7, blade: -.40, mag: -.08 },
  sg:  { butt: .27, buttY: -.02, fore: -.27, foreY: -.03, muzzle: -.66, my: .035, rec: 2.2, blade: -.42, mag: -.02 },
  lmg: { butt: .27, buttY: -.01, fore: -.25, foreY: -.02, muzzle: -.74, my: .04, rec: 1.15, blade: -.45, mag: -.06 },
  sr:  { butt: .30, buttY: -.02, fore: -.25, foreY: -.02, muzzle: -.84, my: .03, rec: 2.6, blade: -.45, mag: -.04 },
  p9:  { butt: 0, buttY: 0, fore: 0, foreY: 0, muzzle: -.17, my: .035, rec: .8, blade: -.15, mag: .0, pistol: true },
  // newer weapons. Optional keys: hold ('shoulder' | 'hip' | 'melee' | 'throw'), pitch (resting pitch), foreX, magY
  hp:   { butt: 0, buttY: 0, fore: 0, foreY: 0, muzzle: -.21, my: .045, rec: 1.3, blade: -.15, mag: 0, pistol: true },
  rev:  { butt: 0, buttY: 0, fore: 0, foreY: 0, muzzle: -.23, my: .04, rec: 1.5, blade: -.15, mag: 0, pistol: true },
  mp:   { butt: 0, buttY: 0, fore: 0, foreY: 0, muzzle: -.22, my: .035, rec: .5, blade: -.15, mag: 0, pistol: true },
  knife: { butt: 0, buttY: 0, fore: 0, foreY: 0, muzzle: -.08, my: .2, rec: 0, blade: -.25, mag: 0, hold: 'melee', pitch: -.6 },
  car:  { butt: .25, buttY: -.01, fore: -.2, foreY: -.015, muzzle: -.5, my: .03, rec: .9, blade: -.42, mag: -.07 },
  akr:  { butt: .27, buttY: -.015, fore: -.24, foreY: -.02, muzzle: -.62, my: .03, rec: 1.2, blade: -.42, mag: -.08 },
  brst: { butt: .3, buttY: -.01, fore: -.14, foreY: -.03, muzzle: -.38, my: .03, rec: .8, blade: -.4, mag: .15 },
  bat:  { butt: .28, buttY: -.01, fore: -.25, foreY: -.02, muzzle: -.66, my: .035, rec: 1.5, blade: -.43, mag: -.08 },
  pdw:  { butt: .2, buttY: -.01, fore: -.11, foreY: -.035, muzzle: -.28, my: .035, rec: .6, blade: -.38, mag: .02 },
  hsmg: { butt: .25, buttY: -.01, fore: -.2, foreY: -.02, muzzle: -.39, my: .04, rec: .9, blade: -.4, mag: -.09 },
  asg:  { butt: .27, buttY: -.02, fore: -.27, foreY: -.03, muzzle: -.63, my: .045, rec: 1.8, blade: -.42, mag: -.07 },
  dbs:  { butt: .27, buttY: -.02, fore: -.2, foreY: -.02, muzzle: -.5, my: .035, rec: 2.6, blade: -.42, mag: -.02 },
  mini: { butt: 0, buttY: 0, fore: -.2, foreY: .095, foreX: -.1, muzzle: -.74, my: .02, rec: .5, blade: -.3, mag: -.03, hold: 'hip' },
  dmr:  { butt: .29, buttY: -.01, fore: -.27, foreY: -.02, muzzle: -.8, my: .03, rec: 1.8, blade: -.44, mag: -.07 },
  hsr:  { butt: .32, buttY: -.02, fore: -.27, foreY: -.03, muzzle: -1.08, my: .035, rec: 3.2, blade: -.46, mag: -.05 },
  rl:   { butt: .2, buttY: .1, fore: -.2, foreY: .0, muzzle: -.5, my: .1, rec: 2, blade: -.3, mag: -.5, magY: .1, hold: 'shoulder' },
  gl:   { butt: .24, buttY: -.01, fore: -.29, foreY: -.03, muzzle: -.4, my: .035, rec: 1.6, blade: -.4, mag: -.1 },
  xbow: { butt: .27, buttY: -.01, fore: -.22, foreY: -.02, muzzle: -.5, my: .06, rec: .6, blade: -.42, mag: -.2, magY: .06 },
  frag: { butt: 0, buttY: 0, fore: 0, foreY: 0, muzzle: -.05, my: 0, rec: 0, blade: -.2, mag: 0, hold: 'throw' },
};
const ZTYPE = {
  walker: { stride: .78, lean: .30, bob: 1.3, sway: 1.7, width: 0, limp: 1, frantic: 0, heavy: 0, skin: 0x9aa58a, scale: [1, 1, 1] },
  runner: { stride: .84, lean: .42, bob: 1.2, sway: 1.1, width: 0, limp: 0, frantic: 1, heavy: 0, skin: 0xa99d90, scale: [1, .99, 1] },
  brute:  { stride: 1.1, lean: .24, bob: 1.9, sway: 1.9, width: .05, limp: 0, frantic: 0, heavy: 1, skin: 0x7f8c6c, scale: [1.24, 1.12, 1.24] },
};
const SOLDIER_K = { stride: 1, lean: 0, bob: 1, sway: 1, width: 0, limp: 0, frantic: 0, heavy: 0 };

// ---------------------------------------------------------------- math helpers
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const wrapA = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const fract = x => x - Math.floor(x);
const fin = (x, d) => (typeof x === 'number' && isFinite(x)) ? x : d;
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const h = (a, b, c) => hash3(ix + a, iy + b, iz + c);
  return lerp(lerp(lerp(h(0, 0, 0), h(1, 0, 0), fx), lerp(h(0, 1, 0), h(1, 1, 0), fx), fy),
    lerp(lerp(h(0, 0, 1), h(1, 0, 1), fx), lerp(h(0, 1, 1), h(1, 1, 1), fx), fy), fz);
}

// shared scratch (module level, single-threaded, allocation-free per frame)
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(),
  _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3(), _v7 = new THREE.Vector3(), _v8 = new THREE.Vector3(),
  _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _pp = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _e = new THREE.Euler();
const _col = new THREE.Color();

function qEul(out, x, y, z) { _e.set(x, y, z, 'YXZ'); return out.setFromEuler(_e); }
function bindT(ax, ay, az, bx, by, bz) {   // transposed bind basis for frameQ
  const a = new THREE.Vector3(ax, ay, az).normalize(), b = new THREE.Vector3(bx, by, bz);
  b.addScaledVector(a, -b.dot(a)).normalize(); const c = new THREE.Vector3().crossVectors(a, b);
  return new THREE.Matrix4().makeBasis(a, b, c).transpose();
}
// rotation mapping bind (primary, secondary) onto current (primary a, secondary b)
function frameQ(out, ax, ay, az, bx, by, bz, bt) {
  let l = Math.hypot(ax, ay, az);
  if (l < 1e-9) { ax = 0; ay = 1; az = 0; l = 1; }
  _v1.set(ax / l, ay / l, az / l);
  _v2.set(bx, by, bz); _v2.addScaledVector(_v1, -_v2.dot(_v1)); l = _v2.length();
  if (l < 1e-6) { _v2.set(1, 0, 0).addScaledVector(_v1, -_v1.x); l = _v2.length(); if (l < 1e-6) { _v2.set(0, 0, 1).addScaledVector(_v1, -_v1.z); l = _v2.length(); } }
  _v2.multiplyScalar(1 / l); _v3.crossVectors(_v1, _v2);
  _m1.makeBasis(_v1, _v2, _v3).multiply(bt);
  return out.setFromRotationMatrix(_m1);
}
// two-bone IK: writes mid/end, returns nothing. pole = direction the middle joint should point to.
function ik2(root, l1, l2, target, pole, outMid, outEnd) {
  _d.subVectors(target, root); let dist = _d.length();
  if (dist < 1e-6) { _d.set(0, -1, 0); dist = 1e-6; } else _d.multiplyScalar(1 / dist);
  dist = clamp(dist, Math.abs(l1 - l2) + 1e-3, (l1 + l2) * .9995);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _pp.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_pp.lengthSq() < 1e-10) { _pp.set(0, 0, -1).addScaledVector(_d, -_d.z); if (_pp.lengthSq() < 1e-10) _pp.set(1, 0, 0); }
  _pp.normalize();
  outMid.copy(root).addScaledVector(_d, a).addScaledVector(_pp, h);
  outEnd.copy(root).addScaledVector(_d, dist);
}

const BT_TORSO = bindT(0, 1, 0, 1, 0, 0);
const BT_LEG_IK = bindT(0, -1, 0, 0, 0, -1);
const BT_ARM_IK = bindT(0, -1, 0, 0, 0, 1);
const BT_LEG_RD = bindT(0, -1, 0, -1, 0, 0);
const BT_ARM_RD = bindT(0, -1, 0, 1, 0, 0);
const Q_GRIP_R = qEul(new THREE.Quaternion(), 1.25, 0, 0);
const Q_GRIP_L = qEul(new THREE.Quaternion(), 1.45, -.35, -1.1);
const Q_GRIP_LP = qEul(new THREE.Quaternion(), 1.2, .5, -.4);
const Q_GRIP_LH = qEul(new THREE.Quaternion(), 1.5, .2, .9);      // left hand on a side carrying grip
const Q_GRIP_L1 = qEul(new THREE.Quaternion(), 1.2, .2, .5);      // free left hand (knife, grenade)
const Q_RX = new THREE.Quaternion();

// ---------------------------------------------------------------- geometry builder
function C(hex, sh = 1) { _col.set(hex); return [_col.r * sh, _col.g * sh, _col.b * sh, 0, 0, 0, 0]; }
const PBs = (s = 1) => [s, s, s, 1, 0, 0, 0], PDs = (s = 1) => [s, s, s, 0, 1, 0, 0], PLs = (s = 1) => [s, s, s, 0, 0, 1, 0];
const ROT = p => { const q = p.slice(); q[6] = 1; return q; };
const _mp = new THREE.Vector3(), _ms = new THREE.Vector3(), _mq = new THREE.Quaternion(), _mm = new THREE.Matrix4();
function M(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return _mm.compose(_mp.set(x, y, z), _mq.setFromEuler(_e.set(rx, ry, rz, 'XYZ')), _ms.set(sx, sy, sz));
}
class Builder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.pal = []; this.bi = []; this.idx = []; this.n = 0; }
  add(g, bone, paint, mat) {
    if (mat) g.applyMatrix4(mat);
    const p = g.attributes.position.array, nn = g.attributes.normal.array, cnt = g.attributes.position.count, base = this.n;
    for (let i = 0; i < cnt; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      this.pos.push(x, y, z); this.nor.push(nn[i * 3], nn[i * 3 + 1], nn[i * 3 + 2]);
      let r = paint[0], gg = paint[1], b = paint[2];
      if (paint[6]) {           // rotten mottling
        const k = .62 + .62 * vnoise(x * 14, y * 14, z * 14), k2 = vnoise(x * 5 + 3, y * 5, z * 5);
        r *= k * (1 + .25 * k2); gg *= k * (1.08 - .1 * k2); b *= k * (1 + .18 * k2);
      }
      this.col.push(r, gg, b); this.pal.push(paint[3], paint[4], paint[5]); this.bi.push(bone);
    }
    const ix = g.index;
    if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.array[i]);
    else for (let i = 0; i < cnt; i++) this.idx.push(base + i);
    this.n += cnt; g.dispose();
  }
}
function mkShapes(bd) {
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion(), pa = new THREE.Vector3();
  const orient = (a, c) => { dir.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); const len = dir.length(); dir.multiplyScalar(1 / len); q.setFromUnitVectors(up, dir); return len; };
  return {
    ell(bone, c, r, paint, rx = 0, ry = 0, rz = 0, ws = 12, hs = 8) {
      bd.add(new THREE.SphereGeometry(1, ws, hs), bone, paint, M(c[0], c[1], c[2], rx, ry, rz, r[0], r[1], r[2]));
    },
    box(bone, c, s, paint, rx = 0, ry = 0, rz = 0, rad = 0) {
      const rr = Math.min(rad, Math.min(s[0], s[1], s[2]) / 2 - .001);
      const g = rr > .002 ? new RoundedBoxGeometry(s[0], s[1], s[2], 1, rr) : new THREE.BoxGeometry(s[0], s[1], s[2]);
      bd.add(g, bone, paint, M(c[0], c[1], c[2], rx, ry, rz));
    },
    tube(bone, a, c, ra, rc, paint, seg = 10) {      // tapered capsule
      const len = orient(a, c), pts = [], N = 3;
      for (let k = 0; k <= N; k++) { const t = -Math.PI / 2 + k / N * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(ra * Math.cos(t), 1e-4), ra * Math.sin(t))); }
      for (let k = 0; k <= N; k++) { const t = k / N * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(rc * Math.cos(t), 1e-4), len + rc * Math.sin(t))); }
      const g = new THREE.LatheGeometry(pts, seg);
      bd.add(g, bone, paint, _mm.compose(pa.set(a[0], a[1], a[2]), q, _ms.set(1, 1, 1)));
    },
    cyl(bone, a, c, ra, rc, paint, seg = 10) {
      const len = orient(a, c), g = new THREE.CylinderGeometry(rc, ra, len, seg, 1, false);
      bd.add(g, bone, paint, _mm.compose(pa.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), q, _ms.set(1, 1, 1)));
    },
    ring(bone, c, rx, rz, t, paint, tilt = 0) {
      const g = new THREE.TorusGeometry(1, t / ((rx + rz) / 2), 5, 22);
      bd.add(g, bone, paint, M(c[0], c[1], c[2], Math.PI / 2 + tilt, 0, 0, rx, rz, 1));
    },
    dome(bone, c, r, paint, frac = .52) {
      bd.add(new THREE.SphereGeometry(1, 18, 8, 0, TAU, 0, Math.PI * frac), bone, paint, M(c[0], c[1], c[2], 0, 0, 0, r[0], r[1], r[2]));
    },
  };
}

// ---------------------------------------------------------------- body models
const SKIN = 0xb98d6e, BLACK = 0x1a1b1d, METAL = 0x2b2d30, GLOVE = 0x2f2c27, BOOT = 0x33291f, SOLE = 0x151413, RED = 0xb01c16,
  LENS = 0x10171c, TAN = 0x6b604a, WOUND = 0x5c130d, GORE = 0x2a0705, BONE = 0xd5ccb0, TEETH = 0xbfb38e, HAIR = 0x2a251f;

function buildSoldierBody(S) {
  const { ell, box, tube, cyl, ring, dome } = S, PB = PBs, PD = PDs, PL = PLs;
  // pelvis / belt
  ell(PEL, [0, .955, .005], [.165, .13, .125], PB(.95));
  ring(PEL, [0, 1.0, 0], .168, .13, .022, PD(.9));
  box(PEL, [0, 1.0, -.133], [.05, .036, .012], C(METAL));
  for (const s of [-1, 1]) box(PEL, [s * .155, .985, .055], [.05, .085, .075], PD(.85), 0, 0, 0, .012);
  box(PEL, [0, .99, .135], [.13, .075, .05], PD(.9), 0, 0, 0, .012);
  // abdomen
  ell(SPI, [0, 1.12, 0], [.155, .15, .112], PB(.9));
  ell(SPI, [0, 1.165, 0], [.176, .07, .133], PD(.95));
  // chest + carrier
  ell(CHE, [0, 1.33, 0], [.183, .175, .122], PB);
  box(CHE, [0, 1.30, -.1], [.30, .33, .07], PD, 0, 0, 0, .02);
  box(CHE, [0, 1.31, .1], [.30, .34, .07], PD(.95), 0, 0, 0, .02);
  for (const s of [-1, 1]) box(CHE, [s * .11, 1.452, 0], [.065, .035, .25], PD(.9), 0, 0, 0, .01);
  for (const x of [-.082, 0, .082]) { box(CHE, [x, 1.215, -.155], [.068, .11, .045], PB(.78), 0, 0, 0, .01); box(CHE, [x, 1.272, -.158], [.07, .022, .05], PD(.8)); }
  box(CHE, [0, 1.385, -.145], [.15, .075, .035], PL(.9), 0, 0, 0, .01);
  box(CHE, [-.14, 1.32, -.143], [.05, .1, .04], PD(.8), 0, 0, 0, .01);
  ring(CHE, [0, 1.462, 0], .125, .1, .03, PD(.85));
  // backpack
  box(CHE, [0, 1.30, .2], [.28, .34, .12], PB(.82), 0, 0, 0, .03);
  box(CHE, [0, 1.465, .2], [.27, .05, .13], PD(.9), 0, 0, 0, .02);
  for (const s of [-1, 1]) box(CHE, [s * .158, 1.25, .2], [.04, .15, .085], PD(.9), 0, 0, 0, .012);
  tube(CHE, [-.15, 1.505, .205], [.15, 1.505, .205], .05, .05, PL(.85), 8);
  tube(CHE, [-.1, 1.44, .25], [-.125, 1.86, .27], .006, .004, C(BLACK), 5);
  // neck + head
  tube(NEC, [0, 1.47, 0], [0, 1.6, -.005], .055, .052, PD(.85));
  ell(HEA, [0, 1.668, -.01], [.085, .105, .098], PD(.85));
  ell(HEA, [0, 1.686, -.071], [.064, .03, .04], C(SKIN));
  ell(HEA, [0, 1.652, -.097], [.017, .026, .02], PD(.85));
  box(HEA, [0, 1.69, -.094], [.15, .046, .032], C(BLACK), 0, 0, 0, .012);
  for (const s of [-1, 1]) box(HEA, [s * .036, 1.69, -.111], [.058, .032, .006], C(LENS));
  ring(HEA, [0, 1.69, -.005], .093, .103, .012, C(BLACK));
  // helmet with rim
  dome(HEA, [0, 1.70, -.005], [.122, .118, .136], PB(1.05));
  ring(HEA, [0, 1.703, -.005], .124, .138, .011, PB(.85));
  ring(HEA, [0, 1.74, -.005], .112, .126, .009, PD(.8));
  box(HEA, [0, 1.75, -.13], [.045, .035, .022], C(BLACK), -.3, 0, 0, .006);
  for (const s of [-1, 1]) {
    box(HEA, [s * .121, 1.71, -.01], [.012, .022, .11], C(BLACK));
    ell(HEA, [s * .103, 1.655, 0], [.026, .046, .046], PD(.75));
    tube(HEA, [s * .095, 1.64, -.01], [s * .02, 1.575, -.06], .007, .007, C(BLACK), 5);
  }
  // arms
  for (const s of [-1, 1]) {
    const x = s * .2, UA = s < 0 ? UAL : UAR, FA = s < 0 ? FAL : FAR, HA = s < 0 ? HAL : HAR;
    ell(UA, [x, 1.428, 0], [.072, .076, .078], PB(.95));
    tube(UA, [x, 1.42, 0], [x, 1.17, 0], .058, .05, PB(.95));
    cyl(UA, [x, 1.25, 0], [x, 1.30, 0], .061, .063, C(RED), 12);
    box(UA, [x + s * .058, 1.36, 0], [.012, .07, .065], PL(.9));
    ell(FA, [x, 1.155, .03], [.05, .052, .042], PD(.8));
    tube(FA, [x, 1.15, 0], [x, .95, 0], .05, .04, PB(.95));
    tube(FA, [x, .96, 0], [x, .9, 0], .044, .042, C(GLOVE));
    box(HA, [x, .835, -.004], [.048, .092, .086], C(GLOVE), 0, 0, 0, .018);
    box(HA, [x - s * .004, .77, -.004], [.044, .055, .082], C(GLOVE, .9), .25, 0, 0, .016);
    tube(HA, [x - s * .012, .865, -.04], [x - s * .01, .8, -.062], .016, .014, C(GLOVE), 6);
  }
  // legs
  for (const s of [-1, 1]) {
    const x = s * .1, TH = s < 0 ? THL : THR, SH = s < 0 ? SHL : SHR, FO = s < 0 ? FOL : FOR;
    tube(TH, [x, .94, 0], [x, .52, 0], .088, .064, PB(.92));
    box(TH, [x + s * .078, .70, .005], [.03, .13, .11], PB(.8), 0, 0, 0, .01);
    if (s > 0) { box(TH, [x + .085, .79, .01], [.035, .17, .08], PD(.85), 0, 0, 0, .01); box(TH, [x + .085, .9, .03], [.03, .05, .035], C(BLACK)); }
    tube(SH, [x, .52, 0], [x, .16, 0], .062, .046, PB(.92));
    box(SH, [x, .5, -.058], [.092, .115, .042], PD(.85), 0, 0, 0, .016);
    ring(SH, [x, .47, 0], .064, .064, .008, C(BLACK));
    tube(FO, [x, .2, 0], [x, .075, 0], .055, .052, C(BOOT));
    ell(FO, [x, .062, -.06], [.053, .05, .12], C(BOOT));
    box(FO, [x, .017, -.055], [.1, .034, .272], C(SOLE), 0, 0, 0, .012);
  }
}

function buildGun(S, id, gx, gy, gz) {
  const { box, cyl } = S;
  const B = (c, s, p, rx = 0, rad = .004) => box(GUN, [gx + c[0], gy + c[1], gz + c[2]], s, p, rx, 0, 0, rad);
  const Z = (z0, z1, r0, r1, y, p, seg = 10, x = 0) => cyl(GUN, [gx + x, gy + y, gz + z0], [gx + x, gy + y, gz + z1], r0, r1, p, seg);
  const K = C(BLACK), MT = C(METAL), F = C(TAN), PDk = PDs(.7);
  if (id === 'ar') {
    B([0, .03, -.02], [.05, .07, .30], K); B([0, .075, -.06], [.03, .014, .36], MT, 0, 0);
    B([0, .03, -.30], [.056, .062, .24], F); Z(-.42, -.50, .011, .011, .03, MT, 8); Z(-.49, -.545, .016, .016, .03, K, 8);
    B([0, .07, -.40], [.012, .04, .015], K); B([0, -.075, -.075], [.03, .12, .062], K, .25); B([0, -.16, -.10], [.028, .07, .055], K, .5);
    B([0, -.05, .03], [.032, .09, .04], K, -.3); Z(.12, .27, .016, .016, .035, K, 8); B([0, .005, .22], [.044, .085, .11], F, 0, .01);
    B([0, -.005, .285], [.048, .115, .022], K); B([0, .115, -.04], [.042, .046, .085], K, 0, .01); Z(-.085, -.09, .018, .018, .115, C(LENS), 10);
  } else if (id === 'smg') {
    B([0, .03, -.05], [.05, .08, .26], K); Z(-.17, -.35, .022, .022, .035, K, 10); B([0, -.1, -.08], [.03, .16, .038], K, .08);
    B([0, -.05, .025], [.032, .09, .04], K, -.3); B([0, .085, -.06], [.03, .03, .05], K); B([0, .085, -.06], [.034, .02, .1], MT);
    for (const y of [.035, -.03]) Z(.08, .21, .006, .006, y, MT, 5); B([0, .0, .22], [.04, .095, .018], K);
    B([0, -.01, -.16], [.04, .05, .05], F);
  } else if (id === 'sg') {
    B([0, .03, -.02], [.052, .08, .27], K); Z(-.15, -.66, .013, .013, .045, MT, 10); Z(-.15, -.60, .014, .014, .002, K, 10);
    B([0, -.002, -.33], [.054, .052, .17], F, 0, .012); B([0, -.05, .03], [.034, .09, .042], K, -.3);
    B([0, -.005, .2], [.046, .1, .26], F, -.06, .015); B([0, -.01, .33], [.05, .12, .025], K); B([.03, .035, .02], [.012, .05, .14], MT);
    B([0, .075, -.65], [.008, .02, .01], MT);
  } else if (id === 'lmg') {
    B([0, .04, -.02], [.075, .11, .34], K); B([0, .1, -.03], [.07, .02, .3], MT); Z(-.2, -.74, .016, .016, .045, MT, 10);
    Z(-.18, -.44, .03, .03, .045, K, 12); B([-.06, -.07, -.05], [.09, .13, .12], PDk, 0, .02); B([0, .14, -.12], [.025, .05, .12], K);
    B([0, -.05, .04], [.034, .09, .042], K, -.3); B([0, .01, .25], [.05, .1, .2], K, 0, .012); B([0, .0, .36], [.054, .12, .025], K);
    for (const s of [-1, 1]) Z(-.56, -.36, .006, .006, -.0, MT, 5, s * .022);
    B([0, .12, -.02], [.04, .04, .07], K);
  } else if (id === 'sr') {
    B([0, .03, 0], [.052, .07, .30], K); Z(-.15, -.66, .012, .012, .035, MT, 10); Z(-.64, -.84, .02, .02, .035, K, 10);
    Z(-.2, .12, .022, .022, .12, K, 12); Z(-.25, -.19, .03, .022, .12, K, 12); Z(.11, .16, .022, .028, .12, K, 12);
    for (const z of [-.12, .04]) B([0, .08, z], [.025, .05, .02], MT);
    Z(-.05, -.035, .013, .013, .15, MT, 8); B([.045, .045, .06], [.04, .014, .014], MT);
    B([0, -.05, .04], [.034, .09, .042], K, -.3); B([0, -.0, .25], [.05, .12, .28], F, 0, .015); B([0, .06, .22], [.04, .03, .16], F, 0, .01);
    B([0, -.01, .39], [.052, .13, .025], K); B([0, -.07, -.04], [.03, .07, .07], K); B([0, -.005, -.27], [.05, .055, .22], F, 0, .012);
    for (const s of [-1, 1]) Z(-.6, -.42, .006, .006, -.01, MT, 5, s * .02);
  } else if (buildGunX(S, id, gx, gy, gz)) { /* newer weapons: see buildGunX */
  } else { // p9
    B([0, .035, -.06], [.03, .036, .2], MT, 0, .006); B([0, .006, -.05], [.028, .024, .17], K); B([0, -.05, .012], [.03, .1, .046], K, -.25, .008);
    B([0, -.1, .03], [.032, .012, .05], K, -.25); Z(-.16, -.172, .006, .006, .04, K, 6); B([0, .058, .02], [.012, .01, .012], K);
  }
}

// third-person models of the newer weapons (same gun-local layout: origin = top of the pistol grip, barrel toward -Z)
const WOOD = 0x6b4226, STEELC = 0x8a8f93, OLIVE = 0x4a5236, BRASSC = 0xb08d3c, BLADE = 0xb9bec2;
function buildGunX(S, id, gx, gy, gz) {
  const { box, cyl, ell } = S;
  const B = (c, s, p, rx = 0, rad = .004, ry = 0) => box(GUN, [gx + c[0], gy + c[1], gz + c[2]], s, p, rx, ry, 0, rad);
  const Z = (z0, z1, r0, r1, y, p, seg = 10, x = 0) => cyl(GUN, [gx + x, gy + y, gz + z0], [gx + x, gy + y, gz + z1], r0, r1, p, seg);
  const L = (a, c, r, p) => cyl(GUN, [gx + a[0], gy + a[1], gz + a[2]], [gx + c[0], gy + c[1], gz + c[2]], r, r, p, 5);
  const K = C(BLACK), MT = C(METAL), F = C(TAN), WD = C(WOOD), ST = C(STEELC), OL = C(OLIVE), PDk = PDs(.7);
  const grip = (p = K) => B([0, -.05, .03], [.032, .09, .04], p, -.3);
  const stock = (z0, len, p, h = .1) => { B([0, -.005, z0 + len / 2], [.044, h, len], p, -.05, .012); B([0, -.01, z0 + len + .008], [.048, h + .02, .022], K); };
  const tele = z1 => { Z(.1, z1 - .08, .015, .015, .035, K, 8); B([0, .005, z1 - .05], [.042, .085, .1], K, 0, .01); B([0, -.005, z1 + .008], [.046, .11, .02], K); };
  const dot = z => { B([0, .085, z], [.03, .02, .06], K); B([0, .115, z], [.04, .044, .05], K, 0, .01); };
  const scope = (zf, zr, y, r) => {       // front (more negative z) to rear
    Z(zf, zr, r, r, y, K, 12); Z(zf - .05, zf, r * 1.35, r, y, K, 12); Z(zr, zr + .04, r, r * 1.2, y, K, 12);
    for (const z of [zf * .7 + zr * .3, zf * .15 + zr * .85]) B([0, y - r - .014, z], [.024, .04, .02], MT);
  };
  const bipod = (z0, z1) => { for (const s of [-1, 1]) Z(z0, z1, .006, .006, -.005, MT, 5, s * .022); };
  switch (id) {
    case 'car':
      B([0, .03, -.02], [.048, .068, .29], K); B([0, .072, -.1], [.03, .012, .42], MT); B([0, .03, -.27], [.046, .05, .21], K, 0, .012);
      Z(-.37, -.46, .01, .01, .03, MT, 8); Z(-.45, -.5, .014, .014, .03, K, 8);
      B([0, -.08, -.07], [.028, .13, .055], MT, .12); B([0, -.15, -.085], [.028, .05, .055], MT, .3); grip(); tele(.26); dot(-.03); B([0, -.03, -.3], [.03, .03, .05], K);
      break;
    case 'akr':
      B([0, .02, -.02], [.046, .07, .3], MT); B([0, .062, -.03], [.04, .02, .24], K, 0, .008); B([0, .01, -.27], [.05, .05, .2], WD, 0, .012); B([0, .058, -.26], [.034, .026, .16], WD, 0, .01);
      Z(-.17, -.6, .011, .011, .03, MT, 8); Z(-.34, -.42, .008, .008, .062, MT, 6); B([0, .07, -.52], [.012, .06, .02], K); Z(-.58, -.62, .014, .014, .03, K, 8);
      B([0, -.075, -.085], [.03, .1, .06], MT, .3); B([0, -.165, -.135], [.03, .1, .056], MT, .7); grip(WD);
      B([0, -.01, .25], [.04, .095, .27], WD, -.07, .014); B([0, -.022, .39], [.044, .11, .018], MT);
      break;
    case 'brst':
      B([0, .03, .06], [.054, .095, .5], PDk, 0, .02); B([0, .03, -.22], [.046, .06, .1], K, 0, .012); Z(-.26, -.36, .011, .011, .03, MT, 8); Z(-.34, -.38, .015, .015, .03, K, 8);
      B([0, -.075, .16], [.028, .13, .056], K, .08); grip(); B([0, .0, .32], [.056, .12, .024], K); B([0, .092, 0], [.03, .02, .22], K); scope(-.07, .04, .135, .024);
      break;
    case 'bat':
      B([0, .03, -.02], [.052, .075, .32], K); B([0, .03, -.31], [.058, .064, .26], K, 0, .014); Z(-.44, -.6, .013, .012, .035, MT, 8); Z(-.58, -.66, .016, .016, .035, K, 8);
      B([0, -.075, -.07], [.032, .11, .07], MT, .05); grip(); stock(.13, .24, PDk); scope(-.07, .05, .105, .022);
      break;
    case 'pdw':
      B([0, .03, -.04], [.05, .078, .25], K, 0, .008); Z(-.16, -.28, .016, .016, .035, K, 10); B([0, -.12, .024], [.026, .2, .036], MT, -.06); grip();
      B([0, -.045, -.11], [.036, .04, .08], K, 0, .01); for (const y of [.045, .02]) Z(.08, .2, .006, .006, y, MT, 5); B([0, .0, .21], [.04, .1, .018], K); dot(-.03);
      break;
    case 'hsmg':
      B([0, .03, -.03], [.054, .085, .27], K); Z(-.16, -.34, .014, .014, .04, MT, 10); Z(-.18, -.28, .022, .022, .04, K, 10); B([0, .04, -.365], [.03, .034, .05], K);
      B([0, .0, -.23], [.05, .04, .13], WD, 0, .012); B([0, -.11, -.09], [.026, .2, .045], MT); grip(WD);
      B([0, -.005, .22], [.042, .1, .24], WD, -.07, .014); B([0, -.02, .345], [.046, .115, .018], MT); B([0, .085, .02], [.012, .03, .014], K); B([0, .075, -.33], [.01, .03, .012], K);
      break;
    case 'asg':
      B([0, .03, -.02], [.058, .09, .3], K); B([0, .02, -.31], [.06, .07, .26], K, 0, .014); Z(-.17, -.6, .015, .015, .045, MT, 10); Z(-.58, -.63, .02, .02, .045, K, 10);
      B([0, -.085, -.07], [.04, .13, .085], K, .05); grip(); stock(.13, .23, K); B([0, .09, -.02], [.014, .03, .02], K); B([0, .085, -.43], [.012, .03, .014], K);
      break;
    case 'dbs':
      B([0, .02, 0], [.056, .07, .14], MT); for (const s of [-1, 1]) Z(-.06, -.5, .014, .013, .035, MT, 8, s * .014); B([0, .002, -.2], [.054, .036, .2], WD, 0, .012);
      B([0, -.03, .06], [.036, .07, .08], WD, -.5, .014); B([0, -.03, .21], [.042, .095, .26], WD, -.1, .016); B([0, -.045, .34], [.046, .115, .02], K); B([0, .055, -.49], [.006, .012, .008], C(BRASSC));
      break;
    case 'mini':
      B([0, .02, -.06], [.13, .13, .3], K, 0, .02); Z(-.2, -.3, .07, .06, .02, K, 12); Z(-.28, -.72, .042, .042, .02, MT, 6);
      for (const z of [-.4, -.56, -.7]) Z(z, z - .02, .052, .052, .02, K, 10);
      B([0, .115, -.1], [.02, .07, .02], K); B([0, .115, 0], [.02, .07, .02], K); B([0, .15, -.05], [.026, .022, .14], K);
      B([-.1, .06, -.2], [.03, .03, .14], K, 0, .01); B([-.08, .05, -.14], [.05, .02, .02], K); B([-.08, .05, -.26], [.05, .02, .02], K);
      B([0, -.13, -.03], [.12, .14, .2], F, 0, .015); grip(); B([0, .02, .12], [.07, .09, .06], K, 0, .012);
      break;
    case 'dmr':
      B([0, .03, -.02], [.05, .07, .3], K); B([0, .03, -.33], [.05, .055, .32], PDk, 0, .012); Z(-.48, -.72, .012, .011, .03, MT, 8); Z(-.7, -.8, .018, .018, .03, K, 8);
      B([0, -.065, -.07], [.03, .09, .065], K, .08); grip(); stock(.13, .25, K); B([0, .055, .2], [.034, .03, .12], K, 0, .008); scope(-.1, .07, .11, .024); bipod(-.46, -.28);
      break;
    case 'hsr':
      B([0, .03, 0], [.058, .08, .34], MT); B([0, -.01, -.22], [.056, .06, .4], PDk, 0, .014); Z(-.17, -.98, .018, .014, .035, MT, 10); B([0, .035, -1.03], [.07, .045, .1], K, 0, .008);
      scope(-.24, .1, .13, .028); B([.05, .045, .07], [.05, .016, .016], MT); grip(); B([0, -.07, -.05], [.034, .08, .11], K);
      B([0, .0, .28], [.05, .12, .3], PDk, 0, .016); B([0, .068, .25], [.04, .03, .16], K, 0, .01); B([0, -.01, .44], [.054, .14, .025], K); bipod(-.62, -.4);
      break;
    case 'rl':
      Z(.5, -.42, .05, .05, .1, OL, 12); Z(.6, .5, .07, .05, .1, K, 12); Z(-.4, -.45, .056, .056, .1, K, 12);
      for (const z of [.4, .06, -.22]) Z(z, z - .02, .054, .054, .1, K, 12); Z(.34, .12, .054, .054, .1, K, 12);
      Z(-.42, -.52, .04, .056, .1, OL, 10); Z(-.52, -.57, .056, .056, .1, OL, 10); Z(-.57, -.68, .056, .012, .1, OL, 10);
      B([0, .03, 0], [.034, .07, .12], K); grip(); B([0, .0, -.2], [.03, .11, .036], K); B([-.06, .16, -.02], [.016, .05, .05], K); B([-.045, .13, -.02], [.03, .014, .03], K);
      break;
    case 'gl':
      B([0, .035, .02], [.05, .08, .16], PDk); Z(-.03, -.17, .062, .062, -.005, K, 12); B([0, .085, -.1], [.03, .014, .3], K); B([0, .0, -.2], [.05, .12, .05], PDk);
      Z(-.2, -.4, .032, .032, .035, MT, 10); B([0, -.04, -.3], [.04, .04, .12], K, 0, .012); grip();
      for (const y of [.05, .02]) Z(.1, .24, .006, .006, y, MT, 5); B([0, .0, .25], [.04, .1, .018], K); dot(0);
      break;
    case 'xbow':
      B([0, .02, -.18], [.04, .05, .62], PDk, 0, .012); B([0, .05, -.2], [.02, .012, .5], K); stock(.13, .22, PDk); grip();
      for (const s of [-1, 1]) { B([s * .14, .05, -.415], [.3, .026, .014], K, 0, .004, -s * .38); L([s * .27, .05, -.36], [0, .05, -.12], .004, K); }
      scope(-.1, .02, .115, .022); B([0, .05, -.48], [.1, .05, .03], MT); Z(-.1, -.5, .005, .005, .062, C(STEELC), 5);
      break;
    case 'knife':
      B([0, -.05, .03], [.026, .12, .032], K, -.3, .008); B([0, .012, .012], [.03, .012, .07], MT, -.3); B([0, .11, -.02], [.007, .19, .034], C(BLADE), -.3, .002);
      break;
    case 'frag':
      ell(GUN, [gx, gy - .05, gz + .03], [.04, .048, .04], OL); B([0, .0, .02], [.02, .03, .02], MT); B([0, -.03, -.012], [.012, .07, .012], MT, -.2);
      break;
    case 'hp':
      B([0, .04, -.07], [.034, .045, .25], ST, 0, .006); B([0, .006, -.05], [.03, .026, .19], K); B([0, -.055, .014], [.033, .115, .05], K, -.25, .008);
      B([0, -.11, .03], [.034, .012, .054], K, -.25); Z(-.19, -.205, .008, .008, .045, K, 6); B([0, .068, .03], [.014, .012, .014], K); B([0, .068, -.18], [.006, .012, .012], K);
      break;
    case 'rev':
      B([0, .03, -.02], [.022, .06, .11], MT); Z(0, -.06, .024, .024, .03, MT, 10); B([0, .04, -.14], [.02, .036, .16], MT, 0, .006);
      B([0, -.05, .02], [.03, .1, .044], WD, -.3, .012); B([0, .065, .035], [.01, .02, .014], MT); B([0, .066, -.2], [.006, .014, .014], K);
      break;
    case 'mp':
      B([0, .035, -.06], [.03, .036, .2], MT, 0, .006); B([0, .006, -.05], [.028, .024, .17], K); B([0, -.05, .012], [.03, .1, .046], K, -.25, .008);
      B([0, -.13, .045], [.024, .13, .036], MT, -.25); B([0, .035, -.185], [.03, .04, .05], K); B([0, -.03, -.1], [.024, .05, .03], K); B([0, .058, .02], [.012, .01, .012], K);
      break;
    default: return false;
  }
  return true;
}

function buildZombieBody(S, zt) {
  const { ell, box, tube, cyl, ring } = S, PB = PBs, PD = PDs, PL = PLs;
  const Z = ZTYPE[zt], heavy = Z.heavy, sk = ROT(C(Z.skin)), skD = ROT(C(Z.skin, .78)), W = C(WOUND), G = C(GORE), BN = C(BONE);
  const t = heavy ? 1.35 : 1;      // limb thickness factor
  // pelvis pants
  ell(PEL, [0, .955, .005], [.162, .13, .122], PD(.9));
  ring(PEL, [0, 1.0, 0], .165, .128, .018, C(0x2a2018));
  // abdomen: skin belly peeking under torn shirt
  ell(SPI, [0, 1.11, -.002], [.15, .15, .11], sk);
  ell(SPI, [-.05, 1.08, -.095], [.05, .04, .025], W); ell(SPI, [-.05, 1.08, -.1], [.03, .022, .015], G);
  ell(SPI, [0, 1.17, 0], [.162 * t, .1, .123 * t], PB(.85));
  for (let i = 0; i < 7; i++) {   // torn hanging shirt strips
    const a = i / 7 * TAU + .3, r = .15 * t;
    box(SPI, [Math.sin(a) * r, 1.07 - (i % 3) * .015, Math.cos(a) * r * .8], [.05, .09 + (i % 2) * .04, .01], PB(.8), .15 * Math.cos(a), a, .2 * Math.sin(i * 2.1));
  }
  // chest
  if (heavy) {
    ell(CHE, [0, 1.32, 0], [.24, .2, .165], sk);
    ell(CHE, [0, 1.43, .1], [.2, .11, .12], skD);                 // hunched back mass
    box(CHE, [0, 1.27, -.13], [.26, .26, .03], PB(.8), .1, 0, 0, .01);   // ragged apron/vest front
    box(CHE, [0, 1.27, .155], [.3, .28, .03], PB(.75), -.1, 0, 0, .01);
    for (const s of [-1, 1]) ell(CHE, [s * .19, 1.44, 0], [.11, .09, .1], sk);
    ell(CHE, [.1, 1.36, -.155], [.05, .07, .02], W);
  } else {
    ell(CHE, [0, 1.33, 0], [.178, .17, .118], PB(.85));
    ell(CHE, [.085, 1.3, -.09], [.06, .08, .04], G);                 // torn hole exposing ribs
    for (let i = 0; i < 3; i++) tube(CHE, [.045, 1.27 + i * .035, -.118], [.13, 1.26 + i * .035, -.098], .007, .006, BN, 5);
    ell(CHE, [-.06, 1.4, -.1], [.07, .05, .03], sk);                  // collar torn open
    ell(CHE, [-.12, 1.25, .1], [.05, .07, .03], W);
  }
  tube(NEC, [0, 1.46, 0], [0, 1.6, -.01], .048 * t, .045 * t, sk, 8);
  ell(NEC, [.03, 1.53, -.035], [.02, .03, .015], W);
  // head (no helmet)
  ell(HEA, [0, 1.675, -.01], [.083, .102, .095], sk);
  ell(HEA, [0, 1.705, -.075], [.075, .022, .03], skD);                // brow ridge
  for (const s of [-1, 1]) { ell(HEA, [s * .032, 1.678, -.083], [.022, .017, .012], C(0x120c0a)); ell(HEA, [s * .032, 1.678, -.089], [.008, .008, .005], C(0xcfcba8)); }
  ell(HEA, [0, 1.655, -.093], [.014, .02, .012], skD);
  ell(HEA, [0, 1.6, -.045], [.06, .03, .055], sk, .5, 0, 0);          // dropped open jaw
  ell(HEA, [0, 1.618, -.075], [.04, .014, .02], C(0x1a0605));        // mouth cavity
  box(HEA, [0, 1.628, -.083], [.05, .01, .008], C(TEETH));
  box(HEA, [0, 1.592, -.078], [.04, .008, .008], C(TEETH), .5);
  ell(HEA, [-.02, 1.75, .02], [.07, .04, .07], C(HAIR));             // patchy hair
  ell(HEA, [.045, 1.73, -.02], [.035, .03, .04], BN);                 // exposed skull
  ell(HEA, [.05, 1.73, -.025], [.042, .036, .046], W);
  for (const s of [-1, 1]) ell(HEA, [s * .085, 1.665, 0], [.012, .025, .018], skD);
  // arms
  for (const s of [-1, 1]) {
    const x = s * .2, UA = s < 0 ? UAL : UAR, FA = s < 0 ? FAL : FAR, HA = s < 0 ? HAL : HAR;
    ell(UA, [x, 1.425, 0], [.064 * t, .07 * t, .07 * t], heavy ? sk : PB(.85));
    tube(UA, [x, 1.42, 0], [x, 1.17, 0], .048 * t, .041 * t, sk, 8);
    if (s < 0 && !heavy) { tube(UA, [x, 1.43, 0], [x, 1.3, 0], .058, .056, PB(.85), 8); for (let i = 0; i < 4; i++) box(UA, [x + Math.sin(i * 1.6) * .056, 1.285, Math.cos(i * 1.6) * .056], [.03, .05, .008], PB(.8), 0, i * 1.6, .2); }
    else ell(UA, [x + s * .03 * t, 1.3, -.03], [.025, .05, .02], W);
    tube(FA, [x, 1.15, 0], [x, .92, 0], .042 * t, .032 * t, sk, 8);
    ell(FA, [x, 1.155, .02], [.045 * t, .045 * t, .04 * t], skD);
    ell(HA, [x, .85, -.004], [.026 * t, .05 * t, .042 * t], sk);
    for (let i = 0; i < 4; i++) {
      const z = (-.03 + i * .02) * t;
      tube(HA, [x, .81, z], [x - s * .01, .72 - Math.abs(i - 1.5) * .012, z - .012], .009 * t, .006 * t, sk, 5);
      ell(HA, [x - s * .01, .715 - Math.abs(i - 1.5) * .012, z - .013], [.006 * t, .012, .006 * t], C(0x2a1d14));
    }
    tube(HA, [x - s * .012, .855, -.04 * t], [x - s * .01, .79, -.06 * t], .01 * t, .008 * t, sk, 5);
  }
  // legs
  for (const s of [-1, 1]) {
    const x = s * .1, TH = s < 0 ? THL : THR, SH = s < 0 ? SHL : SHR, FO = s < 0 ? FOL : FOR;
    tube(TH, [x, .94, 0], [x, .52, 0], .085 * (heavy ? 1.2 : 1), .062 * (heavy ? 1.2 : 1), PD(.9), 10);
    if (s < 0) ell(TH, [x, .56, -.055], [.04, .045, .02], sk);   // knee rip
    if (s < 0 && zt !== 'brute') {
      tube(SH, [x, .52, 0], [x, .16, 0], .05, .038, sk, 8); ell(SH, [x, .33, -.04], [.03, .05, .015], W);
      for (let i = 0; i < 6; i++) box(SH, [x + Math.sin(i) * .062, .47, Math.cos(i) * .062], [.035, .06, .008], PD(.85), 0, i, .3 * Math.sin(i * 3));
    } else tube(SH, [x, .52, 0], [x, .16, 0], .06 * (heavy ? 1.2 : 1), .047 * (heavy ? 1.15 : 1), PD(.9), 10);
    if (zt === 'runner') {      // barefoot
      tube(FO, [x, .16, 0], [x, .06, 0], .04, .042, sk, 8);
      ell(FO, [x, .035, -.065], [.045, .035, .11], sk); ell(FO, [x, .03, -.16], [.04, .025, .03], skD);
    } else {
      tube(FO, [x, .18, 0], [x, .075, 0], .052, .05, C(0x2c241d), 8);
      ell(FO, [x, .062, -.06], [.052, .05, .12], C(0x2c241d));
      box(FO, [x, .017, -.055], [.1, .034, .27], C(SOLE), 0, 0, 0, .01);
    }
  }
}

// ---------------------------------------------------------------- assets (shared per variant)
const assetCache = new Map();
function getAsset(kind, sub) {
  const key = kind + ':' + sub;
  if (assetCache.has(key)) return assetCache.get(key);
  const bd = new Builder(), S = mkShapes(bd), zk = kind === 'zombie' ? ZTYPE[sub] : null;
  const sc = zk ? zk.scale : [1, 1, 1];
  if (zk) buildZombieBody(S, sub); else { buildSoldierBody(S); buildGun(S, sub, BIND0[GUN][0], BIND0[GUN][1], BIND0[GUN][2]); }
  const n = bd.n, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = bd.pos[i * 3] * sc[0]; pos[i * 3 + 1] = bd.pos[i * 3 + 1] * sc[1]; pos[i * 3 + 2] = bd.pos[i * 3 + 2] * sc[2];
    let nx = bd.nor[i * 3] / sc[0], ny = bd.nor[i * 3 + 1] / sc[1], nz = bd.nor[i * 3 + 2] / sc[2]; const l = Math.hypot(nx, ny, nz) || 1;
    nor[i * 3] = nx / l; nor[i * 3 + 1] = ny / l; nor[i * 3 + 2] = nz / l;
    si[i * 4] = bd.bi[i]; sw[i * 4] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(bd.col), 3));
  geo.setAttribute('aPal', new THREE.BufferAttribute(new Float32Array(bd.pal), 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.setIndex(n > 65535 ? new THREE.BufferAttribute(new Uint32Array(bd.idx), 1) : new THREE.BufferAttribute(new Uint16Array(bd.idx), 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .9, 0), 2.6);
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-1.8, -.3, -1.8), new THREE.Vector3(1.8, 2.3, 1.8));
  const B = BIND0.map(b => new THREE.Vector3(b[0] * sc[0], b[1] * sc[1], b[2] * sc[2]));
  const OFF = B.map((b, i) => PARENT[i] < 0 ? b.clone() : b.clone().sub(B[PARENT[i]]));
  const inv = B.map(b => new THREE.Matrix4().makeTranslation(-b.x, -b.y, -b.z));
  const ball = new THREE.Vector3(BALL0[0] * sc[0], BALL0[1] * sc[1], BALL0[2] * sc[2]);
  const W = zk ? null : WEAP[sub];
  const A = { key, kind, sub, geo, B, OFF, inv, ball, sc, W, zk, tris: bd.idx.length / 3,
    lT: B[THL].distanceTo(B[SHL]), lS: B[SHL].distanceTo(B[FOL]), lU: B[UAL].distanceTo(B[FAL]), lF: B[FAL].distanceTo(B[HAL]) };
  // sparse hull of every bone (extreme vertices along 64 directions) for cheap ground-contact checks
  const sup = [], picked = [];
  for (let b = 0; b < NB; b++) picked.push(new Set());
  const ND = 64, best = new Int32Array(NB), bv = new Float64Array(NB);
  for (let k = 0; k < ND; k++) {
    const y = 1 - 2 * (k + .5) / ND, r = Math.sqrt(1 - y * y), ph = k * 2.399963, dx = Math.cos(ph) * r, dz = Math.sin(ph) * r;
    best.fill(-1); bv.fill(-1e9);
    for (let i = 0; i < n; i++) { const b = si[i * 4], v = pos[i * 3] * dx + pos[i * 3 + 1] * y + pos[i * 3 + 2] * dz; if (v > bv[b]) { bv[b] = v; best[b] = i; } }
    for (let b = 0; b < NB; b++) if (best[b] >= 0) picked[b].add(best[b]);
  }
  for (let b = 0; b < NB; b++) for (const i of picked[b]) sup.push(b, pos[i * 3] - B[b].x, pos[i * 3 + 1] - B[b].y, pos[i * 3 + 2] - B[b].z);
  A.sup = Float32Array.from(sup);
  A.rag = buildRagDef(A);
  assetCache.set(key, A);
  return A;
}

// ---------------------------------------------------------------- material (palette + camo in shader)
const matCache = new Map();
function getMaterial(pal, camo) {
  const key = pal.join(',') + '|' + camo;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: .04 });
  const u = { uBase: { value: new THREE.Color(pal[0]) }, uDark: { value: new THREE.Color(pal[1]) }, uLight: { value: new THREE.Color(pal[2]) }, uCamo: { value: camo } };
  m.userData.uniforms = u;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aPal;\nvarying vec3 vPal;\nvarying vec3 vBP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPal = aPal; vBP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uBase; uniform vec3 uDark; uniform vec3 uLight; uniform float uCamo;
varying vec3 vPal; varying vec3 vBP;
float fzH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fzN(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
 return mix(mix(mix(fzH(i), fzH(i + vec3(1,0,0)), f.x), mix(fzH(i + vec3(0,1,0)), fzH(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(fzH(i + vec3(0,0,1)), fzH(i + vec3(1,0,1)), f.x), mix(fzH(i + vec3(0,1,1)), fzH(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
 float fzW = vPal.x + vPal.y + vPal.z;
 if (fzW > 0.001) {
   vec3 pc = (uBase * vPal.x + uDark * vPal.y + uLight * vPal.z) / fzW;
   float n1 = fzN(vBP * vec3(6.0, 3.5, 6.0)) * 0.7 + fzN(vBP * 13.0) * 0.3;
   float n2 = fzN(vBP * vec3(9.0, 5.0, 9.0) + 11.0);
   vec3 cc = mix(pc, uDark * 0.9, smoothstep(0.52, 0.58, n1) * 0.6 * uCamo);
   cc = mix(cc, uLight, smoothstep(0.66, 0.7, n2) * 0.4 * uCamo);
   cc *= 0.92 + 0.16 * fzN(vBP * 60.0);
   diffuseColor.rgb *= mix(vec3(1.0), cc, min(fzW, 1.0));
 }`);
  };
  m.customProgramCacheKey = () => 'fz-soldier-v1';
  matCache.set(key, m);
  return m;
}

// ---------------------------------------------------------------- ragdoll definition
// particle ids
const R_PEL = 0, R_SPI = 1, R_CHE = 2, R_NEC = 3, R_HEA = 4, R_HC = 5, R_HIPL = 6, R_HIPR = 7, R_KNL = 8, R_KNR = 9, R_ANL = 10, R_ANR = 11,
  R_TOL = 12, R_TOR = 13, R_SHL = 14, R_SHR = 15, R_ELL = 16, R_ELR = 17, R_WRL = 18, R_WRR = 19, R_HTL = 20, R_HTR = 21, R_PACK = 22, R_FRONT = 23,
  R_GB = 24, R_GM = 25, R_GG = 26, NP = 27;
function buildRagDef(A) {
  const B = A.B, sc = A.sc, s0 = sc[0], zk = A.zk, heavy = zk && zk.heavy;
  const P = []; const v = (x, y, z) => new THREE.Vector3(x * sc[0], y * sc[1], z * sc[2]);
  P[R_PEL] = B[PEL].clone(); P[R_SPI] = B[SPI].clone(); P[R_CHE] = B[CHE].clone(); P[R_NEC] = B[NEC].clone(); P[R_HEA] = B[HEA].clone();
  P[R_HC] = v(0, 1.69, -.015);
  P[R_HIPL] = B[THL].clone(); P[R_HIPR] = B[THR].clone(); P[R_KNL] = B[SHL].clone(); P[R_KNR] = B[SHR].clone();
  P[R_ANL] = B[FOL].clone(); P[R_ANR] = B[FOR].clone();
  P[R_TOL] = B[FOL].clone().add(A.ball).add(v(0, .035, .0)); P[R_TOR] = B[FOR].clone().add(A.ball).add(v(0, .035, 0));
  P[R_SHL] = B[UAL].clone(); P[R_SHR] = B[UAR].clone(); P[R_ELL] = B[FAL].clone(); P[R_ELR] = B[FAR].clone();
  P[R_WRL] = B[HAL].clone(); P[R_WRR] = B[HAR].clone(); P[R_HTL] = B[HAL].clone().add(v(0, -.13, -.01)); P[R_HTR] = B[HAR].clone().add(v(0, -.13, -.01));
  P[R_PACK] = zk ? v(0, 1.33, .08) : v(0, 1.31, .2); P[R_FRONT] = zk ? v(0, 1.28, -.07) : v(0, 1.28, -.12);
  const W = A.W || { butt: .25, muzzle: -.5 };
  const g = B[GUN];
  P[R_GB] = g.clone().add(new THREE.Vector3(0, -.01, Math.max(W.butt, .06)));
  P[R_GM] = g.clone().add(new THREE.Vector3(0, .03, W.muzzle));
  P[R_GG] = g.clone().add(new THREE.Vector3(0, -.15, -.03));
  const bone = [PEL, SPI, CHE, NEC, HEA, HEA, THL, THR, SHL, SHR, FOL, FOR, FOL, FOR, UAL, UAR, FAL, FAR, HAL, HAR, HAL, HAR, CHE, CHE, GUN, GUN, GUN];
  const rad = new Float32Array(NP), im = new Float32Array(NP);
  const R = [.13, .14, .14, .06, .06, zk ? .1 : .118, .088, .088, .068, .068, .092, .092, .04, .04, .075, .075, .052, .052, .048, .048, .045, .045, zk ? .11 : .15, zk ? .09 : .11, .035, .025, .03];
  const Ms = [10, 8, 10, 3, 2, 4, 6, 6, 4, 4, 2, 2, 1, 1, 3, 3, 1.6, 1.6, .9, .9, .7, .7, zk ? 4 : 5, 3, 1.5, 1.5, 1.5];
  for (let i = 0; i < NP; i++) { rad[i] = R[i] * (i < R_GB ? (heavy ? (i === R_CHE || i === R_PACK || i === R_FRONT || i === R_SPI ? 1.3 : 1.15) : s0) : 1); im[i] = 1 / (Ms[i] * (heavy ? 1.6 : 1)); }
  const ca = [], cb = [], cmin = [], cmax = [], ck = [];
  const D = (a, b, lo = 1, hi = 1, k = 1) => { const d = P[a].distanceTo(P[b]); ca.push(a); cb.push(b); cmin.push(d * lo); cmax.push(d * hi); ck.push(k); };
  const group = ids => { for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) D(ids[i], ids[j]); };
  group([R_PEL, R_SPI, R_HIPL, R_HIPR]);
  group([R_SPI, R_CHE, R_NEC, R_SHL, R_SHR, R_PACK, R_FRONT]);
  D(R_NEC, R_HEA); D(R_HEA, R_HC); D(R_NEC, R_HC, .93, 1);
  // spine bend / twist limits expressed as distance ranges (stable in Verlet)
  D(R_HIPL, R_SHR, .9, 1.06, .5); D(R_HIPR, R_SHL, .9, 1.06, .5);
  D(R_HIPL, R_SHL, .82, 1.05, .5); D(R_HIPR, R_SHR, .82, 1.05, .5);
  D(R_PEL, R_NEC, .85, 1.02, .5); D(R_PEL, R_FRONT, .8, 1.12, .5); D(R_PEL, R_PACK, .85, 1.12, .5);
  for (const [h, k, an, to] of [[R_HIPL, R_KNL, R_ANL, R_TOL], [R_HIPR, R_KNR, R_ANR, R_TOR]]) {
    D(h, k); D(k, an); D(an, to); D(k, to, .84, 1.08); D(h, an, .4, 1);
  }
  for (const [sh, el, wr, ht] of [[R_SHL, R_ELL, R_WRL, R_HTL], [R_SHR, R_ELR, R_WRR, R_HTR]]) {
    D(sh, el); D(el, wr); D(wr, ht); D(el, ht, .8, 1.02); D(sh, wr, .3, 1);
  }
  D(R_GB, R_GM); D(R_GB, R_GG); D(R_GM, R_GG);
  const bp = new Float32Array(NP * 3); for (let i = 0; i < NP; i++) { bp[i * 3] = P[i].x; bp[i * 3 + 1] = P[i].y; bp[i * 3 + 2] = P[i].z; }
  const hc = P[R_HC].clone().sub(P[R_HEA]), toe = P[R_TOL].clone().sub(P[R_ANL]), gm = P[R_GM].clone().sub(P[R_GB]), gg = P[R_GG].clone().sub(P[R_GB]);
  return {
    P, bp, bone, rad, im, ca: Int8Array.from(ca), cb: Int8Array.from(cb), cmin: Float32Array.from(cmin), cmax: Float32Array.from(cmax), ck: Float32Array.from(ck),
    nActive: A.kind === 'zombie' ? R_GB : NP,
    btHead: bindT(hc.x, hc.y, hc.z, 1, 0, 0), btFoot: bindT(toe.x, toe.y, toe.z, -1, 0, 0), btGun: bindT(gm.x, gm.y, gm.z, gg.x, gg.y, gg.z),
    gunOff: B[GUN].clone().sub(P[R_GB]),
    lens: [[R_HIPL, R_KNL], [R_KNL, R_ANL], [R_HIPR, R_KNR], [R_KNR, R_ANR], [R_SHL, R_ELL], [R_ELL, R_WRL], [R_SHR, R_ELR], [R_ELR, R_WRR], [R_NEC, R_HC], [R_PEL, R_SPI], [R_SPI, R_CHE]]
      .map(([a, b]) => [a, b, P[a].distanceTo(P[b])]),
  };
}

// ---------------------------------------------------------------- createSoldier
export function createSoldier(scene, opts = {}) {
  const kind = opts.kind === 'zombie' ? 'zombie' : 'soldier';
  const sub = kind === 'zombie' ? (ZTYPE[opts.zombieType] ? opts.zombieType : 'walker') : (WEAP[opts.weaponId] ? opts.weaponId : 'ar');
  const pal = Array.isArray(opts.palette) && opts.palette.length >= 3 ? opts.palette : (kind === 'zombie' ? [0x5a5248, 0x2e2a26, 0x8a8070] : [0x4c5238, 0x2a2e22, 0x7c7a5c]);
  const A = getAsset(kind, sub), RD = A.rag, B = A.B, OFF = A.OFF, W = A.W, zk = A.zk;
  const K = zk || SOLDIER_K, isZ = kind === 'zombie', sx = A.sc[0], sy = A.sc[1];
  const material = getMaterial(pal, isZ ? .35 : 1);

  const root = new THREE.Group(); root.name = isZ ? 'zombie' : 'soldier';
  const bones = [];
  for (let i = 0; i < NB; i++) { const b = new THREE.Bone(); b.name = NAMES[i]; bones.push(b); }
  for (let i = 0; i < NB; i++) { const p = PARENT[i]; bones[i].position.copy(OFF[i]); (p < 0 ? root : bones[p]).add(bones[i]); }
  const skeleton = new THREE.Skeleton(bones, A.inv.slice());
  const mesh = new THREE.SkinnedMesh(A.geo, material);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.boundingSphere = A.geo.boundingSphere.clone(); mesh.boundingBox = A.geo.boundingBox.clone();
  root.add(mesh);
  mesh.bind(skeleton, new THREE.Matrix4());
  if (scene) scene.add(root);

  // pose buffers (model space)
  const P = B.map(b => b.clone()), Q = B.map(() => new THREE.Quaternion());
  const mk = side => ({ side, off: side > 0 ? 0 : .5, plant: new THREE.Vector3(), yaw: 0, pitch: 0, swing: false, t: 0, armed: true,
    from: new THREE.Vector3(), fromYaw: 0, fromPitch: 0, ideal: new THREE.Vector3(), idealYaw: 0, ball: new THREE.Vector3(), ankle: new THREE.Vector3(),
    q: new THREE.Quaternion(), world: new THREE.Vector3() });
  const feet = [mk(-1), mk(1)];
  const lastPos = new THREE.Vector3(), tmpW = new THREE.Vector3(), gunPos = new THREE.Vector3(), gq = new THREE.Quaternion();
  const hipW = new THREE.Vector3(), knee = new THREE.Vector3(), ankleOut = new THREE.Vector3(), pole = new THREE.Vector3();
  const shoulder = new THREE.Vector3(), elbow = new THREE.Vector3(), wristT = new THREE.Vector3(), wristL = new THREE.Vector3(), wristR = new THREE.Vector3();
  const hqL = new THREE.Quaternion(), hqR = new THREE.Quaternion();
  const lst = { vx: 0, vz: 0, yaw: 0, aimPitch: 0, grounded: true, crouch: 0 };

  let time = Math.random() * 100, yawS = 0, needSnap = true, velX = 0, velZ = 0, phase = 0, gaitOn = false, back = false;
  let runS = 0, moveB = 0, crouchS = 0, airB = 0, airTime = 0, hipYaw = 0, leanF = 0, leanR = 0, turnV = 0, aimS = 0;
  let actT = -1, actDur = 1;   // one-handed action (knife slash, grenade throw)
  let recP = 0, recV = 0, relT = -1, relDur = 1, atkT = -1, flP = 0, flPV = 0, flR = 0, flRV = 0, flY = 0, flYV = 0, flH = 0, flHV = 0;
  let landY = 0, landV = 0, shuffleCd = 0, pelYPrev = B[PEL].y, seed = Math.random() * 10;
  let dead = false;

  // ragdoll state
  const rp = new Float32Array(NP * 3), rq = new Float32Array(NP * 3), rs = new Float32Array(NP * 3), rm = new Float32Array(NP * 3), rcon = new Uint8Array(NP), rn = new Float32Array(NP * 3);
  const fr = new Float32Array(12);   // pelvis x,y,z axes? (x,y,z for pelvis: 0..5 x,y ; chest 6..11)
  const colIdx = new Int32Array(64); let colN = 0, colliders = null;
  let limK = 1, rAcc = 0, rT = 0, sleeping = false, stillT = 0, rootSig = 0;
  const rootQ = new THREE.Quaternion(), rootInvQ = new THREE.Quaternion(), rootInv = new THREE.Matrix4();

  // --------------------------------------------------------------- helpers
  function fk(i) { const p = PARENT[i]; P[i].copy(OFF[i]).applyQuaternion(Q[p]).add(P[p]); }
  function toModel(w, out) {   // world -> model (root translation + yawS)
    const dx = w.x - root.position.x, dz = w.z - root.position.z, c = Math.cos(yawS), s = Math.sin(yawS);
    out.set(dx * c - dz * s, w.y - root.position.y, dx * s + dz * c); return out;
  }
  function toWorldXZ(mx, mz, out) {
    const c = Math.cos(yawS), s = Math.sin(yawS);
    out.set(root.position.x + mx * c + mz * s, root.position.y, root.position.z - mx * s + mz * c); return out;
  }
  function computeIdeal(f) {
    const s = f.side, w = (.112 + .05 * crouchS + K.width) * sx + (isZ ? 0 : .015 * (1 - moveB));
    const stag = isZ ? s * .03 : s * .085 * (1 - moveB) * (1 - crouchS * .3);
    const fy = hipYaw * .85 - s * (.1 + (K.heavy ? .12 : 0) + (K.limp && s > 0 ? .25 : 0));
    const c = Math.cos(hipYaw), sn = Math.sin(hipYaw);
    let lx = s * w * c + stag * sn, lz = -s * w * sn + stag * c;
    lx += -Math.sin(fy) * -A.ball.z * 1; lz += -Math.cos(fy) * -A.ball.z;   // ball sits ahead of ankle
    toWorldXZ(lx, lz, f.ideal); f.idealYaw = yawS + fy;
  }
  function snapFeet() {
    for (const f of feet) { computeIdeal(f); f.plant.copy(f.ideal); f.yaw = f.idealYaw; f.pitch = 0; f.swing = false; f.t = 0; f.armed = true; }
    lastPos.copy(root.position); needSnap = false;
  }
  function startSwing(f) { f.swing = true; f.t = 0; f.armed = false; f.from.copy(f.plant); f.fromYaw = f.yaw; f.fromPitch = f.pitch; }
  function writeBones() {
    for (let i = 0; i < NB; i++) {
      const p = PARENT[i], b = bones[i];
      if (p < 0) { b.position.copy(P[i]); b.quaternion.copy(Q[i]); }
      else { _q1.copy(Q[p]).invert(); b.quaternion.copy(_q1).multiply(Q[i]); b.position.subVectors(P[i], P[p]).applyQuaternion(_q1); }
    }
  }

  // --------------------------------------------------------------- alive pose
  function poseAlive(dt, rawDt, st) {
    const vxC = fin(st.vx, 0), vzC = fin(st.vz, 0), yawT = fin(st.yaw, yawS), aim = clamp(fin(st.aimPitch, 0), -1.2, 1.2);
    const grounded = st.grounded !== false, crouch = clamp(fin(st.crouch, 0), 0, 1);
    time += dt;
    // smoothed yaw
    if (needSnap) yawS = yawT;
    const dyaw = wrapA(yawT - yawS); let stp = dyaw * (1 - Math.exp(-11 * dt)); stp = clamp(stp, -9 * dt, 9 * dt);
    yawS = wrapA(yawS + stp); root.rotation.y = yawS;
    turnV = damp(turnV, dt > 0 ? stp / dt : 0, 8, dt);
    // measured displacement (feet obey the real motion => no sliding)
    let dx = root.position.x - lastPos.x, dz = root.position.z - lastPos.z;
    if (needSnap || dx * dx + dz * dz > 2.25 || !isFinite(dx + dz)) { snapFeet(); dx = dz = 0; }
    lastPos.copy(root.position);
    if (rawDt > 1e-5) { velX = damp(velX, dx / rawDt, 14, dt); velZ = damp(velZ, dz / rawDt, 14, dt); }
    const sY = Math.sin(yawS), cY = Math.cos(yawS);
    const vF = -velX * sY - velZ * cY, vR = velX * cY - velZ * sY, speed = Math.hypot(vF, vR), dist = Math.hypot(dx, dz);
    const cF = -vxC * sY - vzC * cY, cR = vxC * cY - vzC * sY;
    gaitOn = speed > (gaitOn ? .12 : .3) && grounded;
    runS = damp(runS, ss(2.4, 4.4, speed), 6, dt);
    moveB = damp(moveB, ss(.1, .9, speed), 7, dt);
    crouchS = damp(crouchS, crouch, 9, dt);
    airB = damp(airB, grounded ? 0 : 1, grounded ? 14 : 7, dt);
    if (!grounded) airTime += dt; else { if (airTime > .12) landV -= Math.min(1.6, airTime * 2.2); airTime = 0; }
    landV += (-120 * landY - 16 * landV) * dt; landY += landV * dt;
    const ang = Math.atan2(vR, vF);
    if (speed > .4) { if (!back && Math.abs(ang) > 1.8) back = true; else if (back && Math.abs(ang) < 1.35) back = false; }
    let ha = back ? ang - Math.PI * Math.sign(ang) : ang; ha = clamp(ha, -1.05, 1.05);
    hipYaw = damp(hipYaw, -ha * .62 * ss(.2, 1, speed) + clamp(-turnV * .06, -.3, .3), 7, dt);
    const lat = speed > .1 ? Math.abs(vR) / speed : 0, fwdness = speed > .1 ? Math.max(0, vF / speed) : 0;
    const stride = Math.max(.35, (.9 + .38 * Math.min(speed, 4.4)) * sY * (1 - .25 * crouchS) * (1 - .15 * lat) * K.stride);
    const duty = lerp(.62, .38, runS);
    const dPh = gaitOn ? dist / stride : 0; phase = fract(phase + dPh);
    const T = stride / Math.max(speed, .3), swingDur = (1 - duty) * T;

    // ---- feet
    shuffleCd -= dt;
    for (let k = 0; k < 2; k++) {
      const f = feet[k], o = feet[1 - k];
      computeIdeal(f);
      if (!grounded) { f.swing = false; f.plant.copy(f.ideal); f.yaw = f.idealYaw; f.armed = true; f.pitch = damp(f.pitch, .25, 6, dt); continue; }
      if (f.swing) {
        const rate = gaitOn ? Math.max(dPh / (1 - duty), dt / .5) : dt / .3;
        f.t = Math.min(1, f.t + rate);
        // landing target: Raibert-style lead along velocity
        let lead = gaitOn ? (1 - f.t) * swingDur + duty * T * .5 * lerp(1, .72, runS) : 0;
        let lx = velX * lead, lz = velZ * lead; const ll = Math.hypot(lx, lz), lmax = .55 * sy * (isZ && K.limp && f.side > 0 ? .7 : 1);
        if (ll > lmax) { lx *= lmax / ll; lz *= lmax / ll; }
        const e = f.t * f.t * f.t * (f.t * (f.t * 6 - 15) + 10);
        f.world.set(lerp(f.from.x, f.ideal.x + lx, e), 0, lerp(f.from.z, f.ideal.z + lz, e));
        if (f.t >= 1) { f.plant.copy(f.world); f.yaw = f.idealYaw; f.swing = false; f.pitch = 0; }
      } else {
        // lift-off decisions
        _v4.copy(f.plant).sub(f.ideal); _v4.y = 0; const err = _v4.length();
        const yawErr = Math.abs(wrapA(f.idealYaw - f.yaw));
        if (gaitOn) {
          const pf = fract(phase + f.off);
          if (pf < duty) f.armed = true;
          else if (f.armed && (!o.swing || runS > .5)) startSwing(f);
          if (!f.swing && err > .62 * sy && !o.swing) startSwing(f);
          const u = f.armed ? pf / duty : 0;
          f.pitch = damp(f.pitch, -lerp(.45, .85, runS) * ss(.55, 1, u) * fwdness * moveB, 18, dt);
        } else {
          f.armed = true; f.pitch = damp(f.pitch, 0, 10, dt);
          if (!o.swing && shuffleCd <= 0) {
            const oe = Math.hypot(o.plant.x - o.ideal.x, o.plant.z - o.ideal.z), oy = Math.abs(wrapA(o.idealYaw - o.yaw));
            if ((err > .16 * sy || yawErr > .55) && (err + yawErr * .3 >= oe + oy * .3)) { startSwing(f); shuffleCd = .12; }
          }
        }
      }
    }
    // ---- foot transforms (model)
    for (let fi = 0; fi < 2; fi++) { const f = feet[fi];
      let yW, bx, by, bz, pit = f.pitch;
      if (f.swing) {
        const e = f.t * f.t * (3 - 2 * f.t), arc = Math.sin(Math.PI * f.t);
        let clr = lerp(.085, .17, runS) * (1 - .3 * crouchS) * sy;
        if (isZ) { if (K.limp && f.side > 0) clr *= .25; if (K.heavy) clr *= 1.25; if (K.frantic) clr *= 1.25; }
        toModel(f.world, _v5); bx = _v5.x; bz = _v5.z; by = clr * Math.pow(arc, .8);
        yW = f.fromYaw + wrapA(f.idealYaw - f.fromYaw) * e;
        pit = lerp(f.fromPitch, 0, e) - .3 * arc * fwdness * (isZ && K.limp && f.side > 0 ? -1.2 : 1);
        f.pitch = pit;
      } else { toModel(f.plant, _v5); bx = _v5.x; bz = _v5.z; by = 0; yW = f.yaw; }
      if (airB > .001) {   // tucked in-air pose
        toModel(f.ideal, _v6);
        const ax = _v6.x, az = _v6.z + (f.side < 0 ? -.12 : .1) * sy, ay = (f.side < 0 ? .28 : .36) * sy;
        bx = lerp(bx, ax, airB); by = lerp(by, ay, airB); bz = lerp(bz, az, airB);
      }
      qEul(f.q, pit, wrapA(yW - yawS), 0);
      f.ball.set(bx, by, bz);
      f.ankle.copy(A.ball).applyQuaternion(f.q).negate().add(f.ball);
      // keep heel and toe above the ground plane
      _v6.set(0, -.09 * sy, .085 * sx).applyQuaternion(f.q).add(f.ankle);
      _v7.set(0, -.075 * sy, -.195 * sx).applyQuaternion(f.q).add(f.ankle);
      const lo = Math.min(_v6.y, _v7.y, f.ball.y - .0);
      if (lo < 0) { f.ankle.y -= lo; f.ball.y -= lo; }
    }

    // ---- pelvis
    const bobA = lerp(.022, -.034, runS) * moveB * sy * K.bob, ph2 = Math.cos(TAU * 2 * (phase - duty * .5));
    let bob = bobA * ph2;
    if (K.heavy) bob = -Math.abs(bob) * 1.4 + .02 * moveB;
    if (K.limp) bob += -.035 * moveB * ss(.0, .25, fract(phase + .5) - duty * .0) * (fract(phase) < duty ? 0 : 1);
    const breath = Math.sin(time * 1.6 + seed) * .004;
    const swX = Math.cos(TAU * (phase - duty * .5)) * .022 * moveB * (1 - .6 * runS) * K.sway * sx;
    const idleX = Math.sin(time * .45 + seed) * .016 * (1 - moveB) * (isZ ? 1.5 : 1);
    const yawSw = Math.cos(TAU * phase) * .13 * moveB * (1 - .3 * runS) * (K.heavy ? 1.5 : 1);
    leanF = damp(leanF, clamp(cF * .045 + vF * .02, -.18, .32) + crouchS * .22 + K.lean * (isZ ? (.6 + .4 * moveB + (K.frantic ? .5 * runS : 0)) : 0), 5, dt);
    leanR = damp(leanR, clamp(cR * .03, -.12, .12), 5, dt);
    const roll = -swX * 2.5 * (K.limp ? 2.5 : 1) + leanR * .5;
    let py = B[PEL].y - .027 * sy - .035 * runS * sy - (isZ ? .02 : 0) - crouchS * .33 * sy + bob + breath + landY * .12 - airB * .06;
    if (K.heavy) py -= .04 * sy;
    P[PEL].set(swX + idleX + (isZ ? 0 : -.01), py, -.02 * moveB + leanF * .05);
    qEul(Q[PEL], -leanF * .45 - crouchS * .12 + airB * .15, hipYaw + yawSw, roll);
    // reach clamp: pelvis drops so both planted ankles are reachable (never slide the feet)
    const Lmax = (A.lT + A.lS) * .995;
    let minDy = 0;
    for (let fi = 0; fi < 2; fi++) { const f = feet[fi];
      hipW.copy(f.side < 0 ? OFF[THL] : OFF[THR]).applyQuaternion(Q[PEL]).add(P[PEL]);
      const hx = f.ankle.x - hipW.x, hz = f.ankle.z - hipW.z, h2 = hx * hx + hz * hz;
      const need = f.ankle.y + Math.sqrt(Math.max(Lmax * Lmax - h2, .01)) - hipW.y;
      if (need < minDy) minDy = need;
    }
    P[PEL].y += minDy;
    pelYPrev = P[PEL].y;

    // ---- torso
    const blade = isZ ? 0 : W.blade * (1 - .5 * runS);
    const sway = isZ ? Math.sin(TAU * phase) * .12 * moveB * K.sway : 0;
    const chP = (isZ ? 0 : aim * .45) - leanF * .55 + Math.sin(time * 1.6 + seed) * .012 - recP * .04 + flP + (isZ && K.frantic ? Math.sin(time * 17) * .03 * moveB : 0);
    const chY = -yawSw * .75 + blade + flY + (isZ ? sway * .5 : 0);
    const chR = -roll * .5 + flR + (isZ && K.limp ? -swX * 3 : 0) + sway * .3;
    qEul(Q[CHE], chP, chY, chR);
    Q[SPI].copy(Q[PEL]).slerp(Q[CHE], .5);
    fk(SPI); fk(CHE);
    // head
    let hP = isZ ? -.25 + Math.sin(time * 1.1 + seed) * .12 : aim * .8, hY = isZ ? Math.sin(time * .7 + seed) * .25 : -blade * .2, hR = isZ ? .3 * Math.sin(time * .5 + seed * 2) + (K.limp ? .25 : 0) : (isZ ? 0 : -.1 * (1 - runS));
    if (K.frantic) { hP += Math.sin(time * 23) * .05; hR += Math.sin(time * 19 + 1) * .06; }
    qEul(Q[HEA], hP + flH, hY - flY * .5, hR + flR * .6);
    Q[NEC].copy(Q[CHE]).slerp(Q[HEA], .45);
    fk(NEC); fk(HEA);
    fk(UAL); fk(UAR);

    // ---- springs
    recV += (-180 * recP - 18 * recV) * dt; recP += recV * dt;
    flPV += (-150 * flP - 13 * flPV) * dt; flP += flPV * dt;
    flRV += (-150 * flR - 13 * flRV) * dt; flR += flRV * dt;
    flYV += (-150 * flY - 13 * flYV) * dt; flY += flYV * dt;
    flHV += (-170 * flH - 12 * flHV) * dt; flH += flHV * dt;

    if (!isZ) {
      // ---- weapon
      let rl = 0, ru = -1;
      if (relT >= 0) { relT += dt; ru = relT / relDur; if (ru >= 1) { relT = -1; ru = -1; } else rl = ss(0, .12, ru) * (1 - ss(.82, 1, ru)); }
      const sprint = ss(.45, 1, runS) * fwdness;
      const hold = W.hold, one = hold === 'melee' || hold === 'throw';
      let au = -1, ox = 0, oy = 0, oz = 0, aP = 0, aY = 0, aR = 0;
      if (actT >= 0) { actT += dt; au = actT / actDur; if (au >= 1) { actT = -1; au = -1; } }
      if (au >= 0 && hold === 'melee') {          // wind up to the right, cut across to the left
        const wind = ss(0, .22, au) * (1 - ss(.22, .4, au)), cut = ss(.2, .5, au) * (1 - ss(.62, 1, au));
        ox = wind * .1 - cut * .36; oy = wind * .12 - cut * .08; oz = -cut * .2; aY = cut * .9 - wind * .4; aP = -cut * .35; aR = cut * .6;
      } else if (au >= 0 && hold === 'throw') {   // arm back and up, then forward; the grenade leaves the hand at the top
        const back = ss(0, .16, au) * (1 - ss(.2, .28, au)), fwd = ss(.2, .3, au) * (1 - ss(.4, .58, au));
        ox = back * .08 - fwd * .05; oy = back * .42 + fwd * .38; oz = back * .36 - fwd * .3; aP = back * .6 - fwd * .7;
      }
      aimS = damp(aimS, aim, 14, dt);
      const bounce = Math.sin(TAU * 2 * phase) * .012 * moveB;
      const gp = aimS * (1 - sprint * .6) - sprint * .55 + recP * .06 + rl * .22 + bounce * .5 + flP * .5 + (W.pitch || 0) * (1 - sprint * .5) + aP;
      const gyw = Math.sin(TAU * phase) * .03 * moveB + sprint * .35 + rl * .15;
      qEul(gq, gp, gyw + aY, rl * .55 + sprint * .3 + aR);
      if (W.pistol) _v5.set(.04, .17 - sprint * .1, -.36 + sprint * .15);
      else if (hold === 'shoulder') _v5.set(.165, .3 + aimS * .02 - sprint * .05 - rl * .06, -.02 + rl * .04);      // tube rests on the shoulder
      else if (hold === 'hip') _v5.set(.21 - sprint * .02, -.2 + aimS * .06 - rl * .03, -.08 + rl * .04);            // carried at the waist
      else if (one) _v5.set(.2 + ox, -.03 + aimS * .1 + oy - sprint * .08, -.3 + oz + sprint * .12);                  // held out in the right hand
      else _v5.set(.1 - sprint * .02, .185 + aimS * .04 - sprint * .08 - rl * .05, -.07 + rl * .05);
      _v5.applyQuaternion(Q[CHE]).add(P[CHE]);    // shoulder pocket in model space
      _v5.y += bounce;
      gunPos.set(0, W.buttY, W.butt + recP * .045).applyQuaternion(gq); gunPos.negate().add(_v5);
      // hands on the weapon
      hqR.copy(gq).multiply(Q_GRIP_R);
      hqL.copy(gq).multiply(W.pistol ? Q_GRIP_LP : Q_GRIP_L);
      for (let pass = 0; pass < 2; pass++) {
        wristR.set(0, -.045, .025).applyQuaternion(gq).add(gunPos); _v6.set(0, .05 * sy, 0).applyQuaternion(hqR); wristR.add(_v6);
        if (W.pistol) wristL.set(-.035, -.06, .015); else wristL.set(W.foreX || -.012, W.foreY - .035, W.fore);
        wristL.applyQuaternion(gq).add(gunPos); _v6.set(0, .05 * sy, 0).applyQuaternion(hqL); wristL.add(_v6);
        const reach = (A.lU + A.lF) * .985, dL = wristL.distanceTo(P[UAL]), dR = wristR.distanceTo(P[UAR]);
        const over = Math.max(dL - reach, dR - reach);
        if (over > 0 && pass === 0) { _v6.set(0, 0, 1).applyQuaternion(gq); gunPos.addScaledVector(_v6, over * 1.05); } else break;
      }
      if (hold === 'hip') hqL.copy(gq).multiply(Q_GRIP_LH);
      if (one) {        // free left hand held low in front of the body
        wristL.set(-.2, -.15 + (au >= 0 ? .05 : 0), -.2).applyQuaternion(Q[CHE]).add(P[CHE]); hqL.copy(Q[CHE]).multiply(Q_GRIP_L1);
      }
      if (ru >= 0 && !one) {    // reload: left hand to magazine -> pouch -> magazine -> handguard
        _v6.set(-.02, W.magY === undefined ? -.1 : W.magY, W.mag).applyQuaternion(gq).add(gunPos);                          // mag well
        _v7.set(-.1, -.1, -.19).applyQuaternion(Q[CHE]).add(P[CHE]);                        // chest mag pouch
        let a, b, t;
        if (ru < .15) { a = wristL; b = _v6; t = ss(0, .15, ru); }
        else if (ru < .25) { a = _v6; b = _v6; t = 0; _v6.y -= .03 * ss(.15, .25, ru); }
        else if (ru < .45) { a = _v6; b = _v7; t = ss(.25, .45, ru); }
        else if (ru < .55) { a = _v7; b = _v7; t = 0; }
        else if (ru < .72) { a = _v7; b = _v6; t = ss(.55, .72, ru); }
        else if (ru < .8) { a = _v6; b = _v6; t = 0; _v6.y += .02 * Math.sin((ru - .72) / .08 * Math.PI); }
        else { a = _v6; b = wristL; t = ss(.8, 1, ru); }
        _v8.copy(a).lerp(b, t); wristL.copy(_v8);
        hqL.copy(gq).multiply(qEul(_q2, .6, 0, -.6));
      }
      Q[GUN].copy(gq); P[GUN].copy(gunPos);
      if (hold === 'throw') bones[GUN].scale.setScalar(au > .27 && au < .86 ? .001 : 1);   // thrown: gone until the next one is in hand
    } else {
      // ---- zombie arms: reaching forward, swinging, claw attack
      let au = -1;
      if (atkT >= 0) { atkT += dt; au = atkT / .75; if (au >= 1) { atkT = -1; au = -1; } }
      for (let k = 0; k < 2; k++) {
        const s = k ? 1 : -1, ph = TAU * phase + (s > 0 ? 0 : Math.PI);
        if (K.heavy) _v6.set(s * .3, -.22 - .05 * Math.sin(ph) * moveB, -.22 + Math.sin(ph) * .2 * moveB);
        else if (K.frantic) _v6.set(s * .2 + Math.sin(time * 9 + s) * .05, .12 + Math.sin(ph * 2 + s) * .12 * moveB + Math.sin(time * 13 + s * 2) * .03, -.46 + Math.sin(ph) * .1 * moveB);
        else _v6.set(s * .19, (s < 0 ? .14 : .04) + Math.sin(time * 1.3 + s + seed) * .04, -.47 + Math.sin(ph) * .05 * moveB);
        _v6.x *= sx; _v6.y *= sy; _v6.z *= sx;
        if (au >= 0) {
          const d = k ? 0 : .12, u = clamp(au - d, 0, 1);
          const rs = ss(0, .35, u) * (1 - ss(.35, .55, u)), sw = ss(.35, .55, u) * (1 - ss(.7, 1, u));
          _v6.x = lerp(_v6.x, s * .35, rs); _v6.y = lerp(_v6.y, .5 * sy, rs); _v6.z = lerp(_v6.z, .05, rs);
          _v6.x = lerp(_v6.x, -s * .08, sw); _v6.y = lerp(_v6.y, -.05, sw); _v6.z = lerp(_v6.z, -.68 * sx, sw);
        }
        _v6.applyQuaternion(Q[CHE]).add(P[CHE]);
        (k ? wristR : wristL).copy(_v6);
        qEul(k ? hqR : hqL, 1.35 + Math.sin(time * 2 + k) * .1, 0, s * .4);
        (k ? hqR : hqL).premultiply(Q[CHE]);
      }
      if (au >= 0) {   // lunge
        const l = ss(.3, .5, au) * (1 - ss(.6, 1, au));
        qEul(_q2, -.45 * l, -.35 * l, 0); Q[CHE].premultiply(_q2); fk(NEC); fk(HEA); fk(UAL); fk(UAR);
        Q[SPI].copy(Q[PEL]).slerp(Q[CHE], .5);
      }
      Q[GUN].copy(Q[CHE]); P[GUN].copy(B[GUN]).sub(B[CHE]).applyQuaternion(Q[CHE]).add(P[CHE]);
    }

    // ---- arm IK
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1, ua = k ? UAR : UAL, fa = k ? FAR : FAL, hh = k ? HAR : HAL, tgt = k ? wristR : wristL, hq = k ? hqR : hqL;
      if (isZ) pole.set(s * .55, -.75, .25); else if (k) pole.set(.75, -.55, .35); else pole.set(-.7, -.7, .12);
      pole.applyQuaternion(Q[CHE]);
      shoulder.copy(P[ua]);
      ik2(shoulder, A.lU, A.lF, tgt, pole, elbow, wristT);
      frameQ(Q[ua], elbow.x - shoulder.x, elbow.y - shoulder.y, elbow.z - shoulder.z, pole.x, pole.y, pole.z, BT_ARM_IK);
      frameQ(Q[fa], wristT.x - elbow.x, wristT.y - elbow.y, wristT.z - elbow.z, pole.x, pole.y, pole.z, BT_ARM_IK);
      P[fa].copy(elbow); P[hh].copy(wristT); Q[hh].copy(hq);
    }
    // ---- leg IK
    for (let k = 0; k < 2; k++) {
      const f = feet[k], th = k ? THR : THL, sh = k ? SHR : SHL, fo = k ? FOR : FOL;
      fk(th);
      _v6.set(0, 0, -1).applyQuaternion(f.q); _v7.set(0, 0, -1).applyQuaternion(Q[PEL]);
      pole.copy(_v6).add(_v7).addScaledVector(_v7, crouchS); pole.x += f.side * .12; pole.y = 0;
      ik2(P[th], A.lT, A.lS, f.ankle, pole, knee, ankleOut);
      frameQ(Q[th], knee.x - P[th].x, knee.y - P[th].y, knee.z - P[th].z, pole.x, pole.y, pole.z, BT_LEG_IK);
      frameQ(Q[sh], ankleOut.x - knee.x, ankleOut.y - knee.y, ankleOut.z - knee.z, pole.x, pole.y, pole.z, BT_LEG_IK);
      P[sh].copy(knee); P[fo].copy(ankleOut); Q[fo].copy(f.q);
    }
    writeBones();
  }

  // --------------------------------------------------------------- ragdoll
  function ragFrames() {
    const p = rp;
    // pelvis frame
    let x0 = p[R_HIPR * 3] - p[R_HIPL * 3], x1 = p[R_HIPR * 3 + 1] - p[R_HIPL * 3 + 1], x2 = p[R_HIPR * 3 + 2] - p[R_HIPL * 3 + 2];
    let y0 = p[R_SPI * 3] - p[R_PEL * 3], y1 = p[R_SPI * 3 + 1] - p[R_PEL * 3 + 1], y2 = p[R_SPI * 3 + 2] - p[R_PEL * 3 + 2];
    setFrame(0, x0, x1, x2, y0, y1, y2);
    x0 = p[R_SHR * 3] - p[R_SHL * 3]; x1 = p[R_SHR * 3 + 1] - p[R_SHL * 3 + 1]; x2 = p[R_SHR * 3 + 2] - p[R_SHL * 3 + 2];
    y0 = p[R_NEC * 3] - p[R_CHE * 3]; y1 = p[R_NEC * 3 + 1] - p[R_CHE * 3 + 1]; y2 = p[R_NEC * 3 + 2] - p[R_CHE * 3 + 2];
    setFrame(6, x0, x1, x2, y0, y1, y2);
  }
  const frZ = new Float32Array(6);
  function setFrame(o, x0, x1, x2, y0, y1, y2) {
    let l = Math.hypot(x0, x1, x2) || 1; x0 /= l; x1 /= l; x2 /= l;
    const d = y0 * x0 + y1 * x1 + y2 * x2; y0 -= x0 * d; y1 -= x1 * d; y2 -= x2 * d;
    l = Math.hypot(y0, y1, y2) || 1; y0 /= l; y1 /= l; y2 /= l;
    fr[o] = x0; fr[o + 1] = x1; fr[o + 2] = x2; fr[o + 3] = y0; fr[o + 4] = y1; fr[o + 5] = y2;
    const zo = o ? 3 : 0; frZ[zo] = x1 * y2 - x2 * y1; frZ[zo + 1] = x2 * y0 - x0 * y2; frZ[zo + 2] = x0 * y1 - x1 * y0;
  }
  function cone(par, ch, fo, ax, ay, az, maxA, k) {
    const zo = fo ? 3 : 0;
    let wx = fr[fo] * ax + fr[fo + 3] * ay + frZ[zo] * az, wy = fr[fo + 1] * ax + fr[fo + 4] * ay + frZ[zo + 1] * az, wz = fr[fo + 2] * ax + fr[fo + 5] * ay + frZ[zo + 2] * az;
    let l = Math.hypot(wx, wy, wz) || 1; wx /= l; wy /= l; wz /= l;
    const p = par * 3, c = ch * 3;
    let dx = rp[c] - rp[p], dy = rp[c + 1] - rp[p + 1], dz = rp[c + 2] - rp[p + 2]; const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return;
    dx /= len; dy /= len; dz /= len;
    const cs = dx * wx + dy * wy + dz * wz, cm = Math.cos(maxA);
    if (cs >= cm) return;
    let px = dx - wx * cs, py = dy - wy * cs, pz = dz - wz * cs; l = Math.hypot(px, py, pz);
    if (l < 1e-6) { px = frZ[zo]; py = frZ[zo + 1]; pz = frZ[zo + 2]; l = 1; }
    px /= l; py /= l; pz /= l; const sm = Math.sin(maxA);
    const tx = rp[p] + (wx * cm + px * sm) * len, ty = rp[p + 1] + (wy * cm + py * sm) * len, tz = rp[p + 2] + (wz * cm + pz * sm) * len;
    const wc = RD.im[ch], wp = RD.im[par] * .5, w = wc + wp, kc = k * limK * wc / w, kp = k * limK * wp / w;
    const ex = tx - rp[c], ey = ty - rp[c + 1], ez = tz - rp[c + 2];
    nudge(ch, ex * kc, ey * kc, ez * kc); nudge(par, -ex * kp, -ey * kp, -ez * kp);
  }
  // limit corrections move the previous position too (mostly), so they cannot pump energy into the body
  function nudge(i, x, y, z) {
    const i3 = i * 3; rp[i3] += x; rp[i3 + 1] += y; rp[i3 + 2] += z;
    rq[i3] += x * .85; rq[i3 + 1] += y * .85; rq[i3 + 2] += z * .85;
  }
  // hinge limit for knees / elbows: the middle joint must stay on the anatomical side of the
  // root->end line (bend direction = sgn * (torsoX x limbDir)); violations are projected onto the line.
  function hinge(a, b, c, fo, sgn) {
    const A3 = a * 3, B3 = b * 3, C3 = c * 3;
    let lx = rp[C3] - rp[A3], ly = rp[C3 + 1] - rp[A3 + 1], lz = rp[C3 + 2] - rp[A3 + 2]; const ll = Math.hypot(lx, ly, lz);
    if (ll < 1e-5) return;
    lx /= ll; ly /= ll; lz /= ll;
    const ax = fr[fo], ay = fr[fo + 1], az = fr[fo + 2];
    let bx = (ay * lz - az * ly) * sgn, by = (az * lx - ax * lz) * sgn, bz = (ax * ly - ay * lx) * sgn; const bl = Math.hypot(bx, by, bz);
    if (bl < .3) return;                     // limb nearly parallel to the hinge axis: undefined, skip
    bx /= bl; by /= bl; bz /= bl;
    const ox = rp[B3] - rp[A3], oy = rp[B3 + 1] - rp[A3 + 1], oz = rp[B3 + 2] - rp[A3 + 2];
    const d = ox * bx + oy * by + oz * bz;
    if (d >= -.03) return;
    const k = -d - .02;
    // split the correction: mid moves forward, ends move back (momentum-neutral)
    const wb = RD.im[b], we = RD.im[c], w = wb + we;
    const mb = k * wb / w * .6 * limK, me = k * we / w * .6 * limK;
    nudge(b, bx * mb, by * mb, bz * mb); nudge(c, -bx * me, -by * me, -bz * me);
  }
  function solveDist() {
    const n = RD.ca.length, im = RD.im, act = RD.nActive;
    for (let i = 0; i < n; i++) {
      const a = RD.ca[i], b = RD.cb[i]; if (a >= act || b >= act) continue;
      const a3 = a * 3, b3 = b * 3;
      const dx = rp[b3] - rp[a3], dy = rp[b3 + 1] - rp[a3 + 1], dz = rp[b3 + 2] - rp[a3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 1e-7) continue;
      let tgt; if (d < RD.cmin[i]) tgt = RD.cmin[i]; else if (d > RD.cmax[i]) tgt = RD.cmax[i]; else continue;
      const w = im[a] + im[b]; const f = (d - tgt) / (d * w) * RD.ck[i];
      rp[a3] += dx * f * im[a]; rp[a3 + 1] += dy * f * im[a]; rp[a3 + 2] += dz * f * im[a];
      rp[b3] -= dx * f * im[b]; rp[b3 + 1] -= dy * f * im[b]; rp[b3 + 2] -= dz * f * im[b];
    }
  }
  function collide(final) {
    const act = RD.nActive;
    for (let i = 0; i < act; i++) {
      const i3 = i * 3, r = RD.rad[i];
      let x = rp[i3], y = rp[i3 + 1], z = rp[i3 + 2], hit = false, nx = 0, ny = 0, nz = 0;
      if (y < r) { y = r; hit = true; ny = 1; }
      for (let k = 0; k < colN; k++) {
        const c = colliders[colIdx[k]];
        {   // swept: panels are as thin as 7 cm, a fast limb must not jump across one in a single step
          const ax = rq[i3], ay = rq[i3 + 1], az = rq[i3 + 2];
          if ((ax <= c.x0 && x >= c.x1) || (ax >= c.x1 && x <= c.x0)) { const e = ax <= c.x0 ? c.x0 : c.x1, u = (e - ax) / (x - ax), py = ay + (y - ay) * u, pz = az + (z - az) * u; if (py > c.y0 - r && py < c.y1 + r && pz > c.z0 - r && pz < c.z1 + r) { const s = ax <= c.x0 ? -1 : 1; x = e + s * r; nx = s; ny = 0; nz = 0; hit = true; } }
          if ((az <= c.z0 && z >= c.z1) || (az >= c.z1 && z <= c.z0)) { const e = az <= c.z0 ? c.z0 : c.z1, u = (e - az) / (z - az), px = ax + (x - ax) * u, py = ay + (y - ay) * u; if (px > c.x0 - r && px < c.x1 + r && py > c.y0 - r && py < c.y1 + r) { const s = az <= c.z0 ? -1 : 1; z = e + s * r; nx = 0; ny = 0; nz = s; hit = true; } }
          if ((ay <= c.y0 && y >= c.y1) || (ay >= c.y1 && y <= c.y0)) { const e = ay <= c.y0 ? c.y0 : c.y1, u = (e - ay) / (y - ay), px = ax + (x - ax) * u, pz = az + (z - az) * u; if (px > c.x0 - r && px < c.x1 + r && pz > c.z0 - r && pz < c.z1 + r) { const s = ay <= c.y0 ? -1 : 1; y = e + s * r; nx = 0; ny = s; nz = 0; hit = true; } }
        }
        const cx = x < c.x0 ? c.x0 : x > c.x1 ? c.x1 : x, cy = y < c.y0 ? c.y0 : y > c.y1 ? c.y1 : y, cz = z < c.z0 ? c.z0 : z > c.z1 ? c.z1 : z;
        let dx = x - cx, dy = y - cy, dz = z - cz; const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-12) { const d = Math.sqrt(d2); dx /= d; dy /= d; dz /= d; x = cx + dx * r; y = cy + dy * r; z = cz + dz * r; nx = dx; ny = dy; nz = dz; }
        else {   // centre inside the box: leave by the face it came in through (previous position), so a fast limb cannot cross a thin wall; else the nearest face
          const qx = rq[i3], qy = rq[i3 + 1], qz = rq[i3 + 2]; let m = Infinity, ax = 0, ay = 0, az = 0;
          if (qx <= c.x0 && x - c.x0 < m) { m = x - c.x0; ax = -1; ay = 0; az = 0; }
          if (qx >= c.x1 && c.x1 - x < m) { m = c.x1 - x; ax = 1; ay = 0; az = 0; }
          if (qy <= c.y0 && y - c.y0 < m) { m = y - c.y0; ax = 0; ay = -1; az = 0; }
          if (qy >= c.y1 && c.y1 - y < m) { m = c.y1 - y; ax = 0; ay = 1; az = 0; }
          if (qz <= c.z0 && z - c.z0 < m) { m = z - c.z0; ax = 0; ay = 0; az = -1; }
          if (qz >= c.z1 && c.z1 - z < m) { m = c.z1 - z; ax = 0; ay = 0; az = 1; }
          if (m === Infinity) {
            m = x - c.x0; ax = -1; ay = 0; az = 0;
            if (c.x1 - x < m) { m = c.x1 - x; ax = 1; ay = 0; az = 0; }
            if (y - c.y0 < m) { m = y - c.y0; ax = 0; ay = -1; az = 0; }
            if (c.y1 - y < m) { m = c.y1 - y; ax = 0; ay = 1; az = 0; }
            if (z - c.z0 < m) { m = z - c.z0; ax = 0; ay = 0; az = -1; }
            if (c.z1 - z < m) { m = c.z1 - z; ax = 0; ay = 0; az = 1; }
          }
          x += ax * (m + r); y += ay * (m + r); z += az * (m + r); nx = ax; ny = ay; nz = az;
        }
        hit = true;
      }
      rp[i3] = x; rp[i3 + 1] = y; rp[i3 + 2] = z;
      if (hit) { rcon[i] = 1; rn[i3] = nx; rn[i3 + 1] = ny; rn[i3 + 2] = nz; }
      if (final && rcon[i]) {   // friction + low restitution via the Verlet "previous" position
        const n0 = rn[i3], n1 = rn[i3 + 1], n2 = rn[i3 + 2];
        let vx = x - rq[i3], vy = y - rq[i3 + 1], vz = z - rq[i3 + 2];
        const vn = vx * n0 + vy * n1 + vz * n2;
        let tx = vx - n0 * vn, ty = vy - n1 * vn, tz = vz - n2 * vn;
        // Coulomb-like friction: static below a small slip speed, kinetic otherwise
        const tl = Math.hypot(tx, ty, tz), stat = STATIC_SLIP * (rT > 1 ? 2 : 1);
        if (tl < stat) { tx = ty = tz = 0; } else { const kf = .45; tx *= 1 - kf; ty *= 1 - kf; tz *= 1 - kf; }
        let vn2 = vn < 0 ? -vn * .1 : vn;
        if (vn2 > 0 && vn2 < stat) vn2 = 0;
        vx = tx + n0 * vn2; vy = ty + n1 * vn2; vz = tz + n2 * vn2;
        rq[i3] = x - vx; rq[i3 + 1] = y - vy; rq[i3 + 2] = z - vz;
      }
    }
  }
  function ragStep(h) {
    const act = RD.nActive, g = -9.81 * h * h;
    limK = rT < 1.2 ? 1 : Math.max(0, 1 - (rT - 1.2) / .5);   // limits matter while falling; fade at rest to avoid solver fights
    const dmp = rT < .5 ? .996 : rT < 1.8 ? .988 : rT < 2.6 ? .96 : .9;
    for (let i = 0; i < act; i++) {
      const i3 = i * 3;
      for (let j = 0; j < 3; j++) { const p = rp[i3 + j], v = (p - rq[i3 + j]) * dmp; rq[i3 + j] = p; rp[i3 + j] = p + v; }
      rp[i3 + 1] += g; rcon[i] = 0;
    }
    for (let it = 0; it < 8; it++) {
      if (!(it & 1) && it < 6 && limK > 0) {
        ragFrames();
        // joint limits (frames: 0 = pelvis, 6 = chest)
        hinge(R_HIPL, R_KNL, R_ANL, 0, 1); hinge(R_HIPR, R_KNR, R_ANR, 0, 1);
        hinge(R_SHL, R_ELL, R_WRL, 6, -1); hinge(R_SHR, R_ELR, R_WRR, 6, -1);
        cone(R_HIPL, R_KNL, 0, -.12, -.75, -.66, 1.2, .5); cone(R_HIPR, R_KNR, 0, .12, -.75, -.66, 1.2, .5);
        cone(R_SHL, R_ELL, 6, -.35, -.6, -.5, 1.75, .4); cone(R_SHR, R_ELR, 6, .35, -.6, -.5, 1.75, .4);
        cone(R_NEC, R_HC, 6, 0, 1, -.25, .62, .4);
      }
      solveDist();
      collide(it === 7);
    }
  }
  function gatherColliders() {
    colN = 0; if (!colliders || !colliders.length) return;
    const cx = rp[0], cy = rp[1], cz = rp[2], R = 3.2;
    for (let i = 0; i < colliders.length && colN < colIdx.length; i++) {
      const c = colliders[i]; if (!c) continue;
      if (c.x1 < cx - R || c.x0 > cx + R || c.y1 < cy - R - 1 || c.y0 > cy + R || c.z1 < cz - R || c.z0 > cz + R) continue;
      colIdx[colN++] = i;
    }
  }
  function rootSignature() { const p = root.position; return p.x * 1.3 + p.y * 7.1 + p.z * 3.7 + root.rotation.y * 11.3 + root.rotation.x * 5.1 + root.rotation.z * 2.9; }
  // helpers on model-space particle positions (rm); defined once so the ragdoll loop allocates nothing
  function V(o, a, b) { return o.set(rm[b * 3] - rm[a * 3], rm[b * 3 + 1] - rm[a * 3 + 1], rm[b * 3 + 2] - rm[a * 3 + 2]); }
  function at(o, a) { return o.set(rm[a * 3], rm[a * 3 + 1], rm[a * 3 + 2]); }
  // limbs: secondary axis = bend-plane normal, falling back to torso axis when straight
  function limb(r0, r1, r2, r3, b0, b1, b2, fx, fy, fz, sgn, bt) {
    V(_v4, r0, r1); V(_v5, r1, r2);
    _v6.crossVectors(_v4, _v5).multiplyScalar(sgn); const nl = _v6.length(), w = Math.min(1, nl / (.25 * _v4.length() * _v5.length() + 1e-9));
    _v6.multiplyScalar(nl > 1e-9 ? w / nl : 0); _v6.x += fx * (1 - w); _v6.y += fy * (1 - w); _v6.z += fz * (1 - w);
    _v7.copy(_v6);
    frameQ(Q[b0], _v4.x, _v4.y, _v4.z, _v7.x, _v7.y, _v7.z, bt); at(P[b0], r0);
    frameQ(Q[b1], _v5.x, _v5.y, _v5.z, _v7.x, _v7.y, _v7.z, bt); at(P[b1], r1);
    V(_v4, r2, r3);
    frameQ(Q[b2], _v4.x, _v4.y, _v4.z, _v7.x, _v7.y, _v7.z, bt === BT_LEG_RD ? RD.btFoot : bt); at(P[b2], r2);
  }
  function ragToBones() {
    root.updateWorldMatrix(true, false);
    rootInv.copy(root.matrixWorld).invert();
    root.getWorldQuaternion(rootQ); rootInvQ.copy(rootQ).invert();
    const e = rootInv.elements;
    for (let i = 0; i < NP; i++) {
      const x = rp[i * 3], y = rp[i * 3 + 1], z = rp[i * 3 + 2];
      rm[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; rm[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; rm[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
    V(_a, R_HIPL, R_HIPR); V(_b, R_SHL, R_SHR);
    V(_c, R_PEL, R_SPI); frameQ(Q[PEL], _c.x, _c.y, _c.z, _a.x, _a.y, _a.z, BT_TORSO); at(P[PEL], R_PEL);
    V(_c, R_SPI, R_CHE); frameQ(Q[SPI], _c.x, _c.y, _c.z, _a.x + _b.x, _a.y + _b.y, _a.z + _b.z, BT_TORSO); at(P[SPI], R_SPI);
    V(_c, R_CHE, R_NEC); frameQ(Q[CHE], _c.x, _c.y, _c.z, _b.x, _b.y, _b.z, BT_TORSO); at(P[CHE], R_CHE);
    V(_c, R_NEC, R_HEA); frameQ(Q[NEC], _c.x, _c.y, _c.z, _b.x, _b.y, _b.z, BT_TORSO); at(P[NEC], R_NEC);
    V(_c, R_HEA, R_HC); frameQ(Q[HEA], _c.x, _c.y, _c.z, _b.x, _b.y, _b.z, RD.btHead); at(P[HEA], R_HEA);
    _a.normalize(); _b.normalize();
    // legs: bind secondary is -X and a valid knee bend normal is -X, so sgn=+1 with fallback -pelvisX
    limb(R_HIPL, R_KNL, R_ANL, R_TOL, THL, SHL, FOL, -_a.x, -_a.y, -_a.z, 1, BT_LEG_RD);
    limb(R_HIPR, R_KNR, R_ANR, R_TOR, THR, SHR, FOR, -_a.x, -_a.y, -_a.z, 1, BT_LEG_RD);
    limb(R_SHL, R_ELL, R_WRL, R_HTL, UAL, FAL, HAL, _b.x, _b.y, _b.z, 1, BT_ARM_RD);
    limb(R_SHR, R_ELR, R_WRR, R_HTR, UAR, FAR, HAR, _b.x, _b.y, _b.z, 1, BT_ARM_RD);
    if (RD.nActive > R_GB) {
      V(_v4, R_GB, R_GM); V(_v5, R_GB, R_GG);
      frameQ(Q[GUN], _v4.x, _v4.y, _v4.z, _v5.x, _v5.y, _v5.z, RD.btGun);
      at(P[GUN], R_GB).add(_v6.copy(RD.gunOff).applyQuaternion(Q[GUN]));
    } else { Q[GUN].copy(Q[CHE]); P[GUN].copy(P[CHE]); }
    // visual ground contact: particles are spheres, the mesh is not; lift the skin if any hull point dips under y=0
    const sup = A.sup, me = root.matrixWorld.elements; let mn = 0;
    for (let k = 0; k < sup.length; k += 4) {
      const b = sup[k]; _v4.set(sup[k + 1], sup[k + 2], sup[k + 3]).applyQuaternion(Q[b]).add(P[b]);
      const y = me[1] * _v4.x + me[5] * _v4.y + me[9] * _v4.z + me[13]; if (y < mn) mn = y;
    }
    if (mn < 0) { _v4.set(0, -mn, 0).applyQuaternion(rootInvQ); for (let i = 0; i < NB; i++) P[i].add(_v4); }
    writeBones();
    rootSig = rootSignature();
  }
  function startRagdoll(dirX, dirZ, isHead, force) {
    root.updateWorldMatrix(true, false);
    const mw = root.matrixWorld, h = 1 / 120;
    for (let i = 0; i < NP; i++) {
      const b = RD.bone[i];
      _v4.set(RD.bp[i * 3], RD.bp[i * 3 + 1], RD.bp[i * 3 + 2]).sub(B[b]).applyQuaternion(Q[b]).add(P[b]).applyMatrix4(mw);
      if (!isFinite(_v4.x + _v4.y + _v4.z)) _v4.set(root.position.x, root.position.y + 1, root.position.z);
      rp[i * 3] = _v4.x; rp[i * 3 + 1] = _v4.y; rp[i * 3 + 2] = _v4.z;
      rq[i * 3] = _v4.x - velX * h; rq[i * 3 + 1] = _v4.y; rq[i * 3 + 2] = _v4.z - velZ * h;
    }
    let l = Math.hypot(dirX, dirZ); if (!(l > 1e-6)) { dirX = Math.sin(yawS); dirZ = Math.cos(yawS); l = 1; }   // default: pushed backward
    dirX /= l; dirZ /= l; force = clamp(fin(force, 1), .2, 4);
    const fx = -Math.sin(yawS), fz = -Math.cos(yawS);                  // facing (forward)
    const facing = dirX * fx + dirZ * fz;                              // >0: pushed forward (shot from behind)
    const imp = (i, vx, vy, vz) => { rq[i * 3] -= vx * h; rq[i * 3 + 1] -= vy * h; rq[i * 3 + 2] -= vz * h; };
    const upper = [R_CHE, R_NEC, R_SHL, R_SHR, R_PACK, R_FRONT, R_HEA, R_HC];
    if (isHead) {        // head snaps along the shot, legs give way instantly
      imp(R_HC, dirX * 3.4 * force, .4, dirZ * 3.4 * force); imp(R_HEA, dirX * 1.6 * force, 0, dirZ * 1.6 * force);
      imp(R_KNL, fx * 1.1, -.6, fz * 1.1); imp(R_KNR, fx * 1.1, -.6, fz * 1.1); imp(R_PEL, -dirX * .2, -1.2, -dirZ * .2);
    } else {
      const variant = facing > .35 ? 2 : facing < -.35 ? (Math.random() < .55 ? 1 : 0) : (Math.random() < .5 ? 0 : 2);
      if (variant === 1) {   // thrown backward
        for (const i of upper) imp(i, dirX * 2.6 * force, .5, dirZ * 2.6 * force);
        imp(R_PEL, dirX * 1.4 * force, .2, dirZ * 1.4 * force); imp(R_SPI, dirX * 1.8 * force, .2, dirZ * 1.8 * force);
      } else if (variant === 0) {   // knees buckle
        for (const i of upper) imp(i, dirX * .9 * force, 0, dirZ * .9 * force);
        imp(R_KNL, fx * 1.6, -.8, fz * 1.6); imp(R_KNR, fx * 1.5, -.8, fz * 1.5); imp(R_PEL, 0, -1.5, 0);
      } else {   // spin and fall forward / sideways
        const px = -dirZ, pz = dirX, sp = (Math.random() < .5 ? 1 : -1) * 2.2 * force;
        imp(R_SHL, px * sp + dirX * 1.2 * force, 0, pz * sp + dirZ * 1.2 * force);
        imp(R_SHR, -px * sp + dirX * 1.2 * force, 0, -pz * sp + dirZ * 1.2 * force);
        imp(R_HC, dirX * 1.5 * force, 0, dirZ * 1.5 * force); imp(R_KNL, fx * .9, -.4, fz * .9); imp(R_KNR, fx * .7, -.4, fz * .7);
      }
    }
    gatherColliders();
    rAcc = 0; rT = 0; sleeping = false; stillT = 0;
    ragToBones();
  }
  // velocity change on one particle, bounded so that a body can never cross a wall in one 1/120 s step
  function ragKick(i, vx, vy, vz) {
    const i3 = i * 3, h = 1 / 120, max = 12 * h;
    let ox = rp[i3] - rq[i3] + vx * h, oy = rp[i3 + 1] - rq[i3 + 1] + vy * h, oz = rp[i3 + 2] - rq[i3 + 2] + vz * h;
    const l = Math.sqrt(ox * ox + oy * oy + oz * oz); if (l > max) { const k = max / l; ox *= k; oy *= k; oz *= k; }
    rq[i3] = rp[i3] - ox; rq[i3 + 1] = rp[i3 + 1] - oy; rq[i3 + 2] = rp[i3 + 2] - oz;
  }
  function ragWake() { sleeping = false; stillT = 0; if (rT > .35) rT = .35; rAcc = 0; gatherColliders(); }
  // along the shot at the hit point, with a smaller push on the whole body
  function ragShove(hx, hy, hz, dx, dy, dz, power) {
    const act = RD.nActive, P0 = clamp(fin(power, 2), 0, 7.5), l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= l; dy /= l; dz /= l;
    for (let i = 0; i < act; i++) {
      const i3 = i * 3, ex = rp[i3] - hx, ey = rp[i3 + 1] - hy, ez = rp[i3 + 2] - hz, w = Math.exp(-(ex * ex + ey * ey + ez * ez) / .18), v = P0 * (.2 + 1.5 * w);
      ragKick(i, dx * v, dy * v + .06 * v, dz * v);
    }
    ragWake();
  }
  function updateRagdoll(rawDt) {
    if (sleeping) { if (rootSignature() !== rootSig) ragToBones(); return; }
    const dt = Math.min(rawDt, .05), h = 1 / 120;
    rAcc += dt; let n = 0;
    rs.set(rp);
    while (rAcc >= h && n < 6) { ragStep(h); rAcc -= h; rT += h; n++; }
    if (n === 6) rAcc = 0;
    // NaN guard: never let a bad value propagate
    for (let i = 0; i < NP * 3; i++) if (!isFinite(rp[i])) { for (let j = 0; j < NP * 3; j++) rq[j] = rp[j] = isFinite(rp[j]) ? rp[j] : (j % 3 === 1 ? .2 : root.position.getComponent(j % 3)); break; }
    if (n > 0) {   // sleep test on real displacement over this frame
      let mv = 0; for (let i = 0; i < RD.nActive * 3; i += 3) { const d = (rp[i] - rs[i]) ** 2 + (rp[i + 1] - rs[i + 1]) ** 2 + (rp[i + 2] - rs[i + 2]) ** 2; if (d > mv) mv = d; }
      if (Math.sqrt(mv) / (n * h) < .06) stillT += n * h; else stillT = 0;
    }
    if ((stillT > .35 && rT > .8) || rT > 3.8) { sleeping = true; for (let i = 0; i < NP * 3; i++) rq[i] = rp[i]; }
    ragToBones();
  }

  // --------------------------------------------------------------- public API
  const s = {
    root, mesh, skeleton, bones, kind, type: sub, dead: false,
    update(dt, st) {
      st = st || lst;
      const rawDt = fin(dt, 0) > 0 ? dt : 0, cdt = Math.min(rawDt, .05);
      lst.vx = fin(st.vx, 0); lst.vz = fin(st.vz, 0); lst.yaw = fin(st.yaw, yawS); lst.aimPitch = fin(st.aimPitch, 0); lst.grounded = st.grounded !== false; lst.crouch = fin(st.crouch, 0);
      if (dead) { updateRagdoll(rawDt); return; }
      if (!root.visible) { needSnap = true; return; }
      poseAlive(cdt, rawDt, lst);
    },
    fire() {
      if (dead) return;
      if (isZ) { if (atkT < 0 || atkT > .6) atkT = 0; return; }
      recV += 9 * W.rec; flPV -= .25 * W.rec;
      if (W.hold === 'melee') { actT = 0; actDur = .42; flYV += 2.2; } else if (W.hold === 'throw') { actT = 0; actDur = 1.3; flPV -= .6; }
    },
    reload(duration = 2) { if (dead || isZ) return; relDur = Math.max(.3, fin(duration, 2)); relT = 0; },
    hit(dirX, dirZ, isHead) {
      if (dead) return;
      const l = Math.hypot(fin(dirX, 0), fin(dirZ, 0)) || 1, x = fin(dirX, 0) / l, z = fin(dirZ, 0) / l;
      const c = Math.cos(yawS), sn = Math.sin(yawS), lx = x * c - z * sn, lz = x * sn + z * c;   // model space: +Z = back
      const k = isHead ? .6 : 1;
      flPV += lz * 4.2 * k; flRV -= lx * 4.2 * k; flYV += (Math.random() - .5) * 3;
      if (isHead) flHV += lz * 9 + 2;
      if (relT >= 0 && relT / relDur < .3) relT = -1;      // interrupted reload
    },
    die(dirX, dirZ, isHead, force = 1) {
      if (dead) return;
      dead = true; s.dead = true; relT = -1; atkT = -1; actT = -1; bones[GUN].scale.setScalar(1);
      startRagdoll(fin(dirX, 0), fin(dirZ, 0), !!isHead, force);
    },
    /** Blast wave on a dead body, from the centre (world space): nearer limbs get more, so the body turns as it flies. */
    blast(cx, cy, cz, radius = 5, k = 1) {
      if (!dead) return;
      const act = RD.nActive, R = Math.max(1, fin(radius, 5)), K = clamp(fin(k, 1), 0, 1.5);
      for (let i = 0; i < act; i++) {
        const i3 = i * 3; let dx = rp[i3] - cx, dy = rp[i3 + 1] - cy, dz = rp[i3 + 2] - cz, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < .05) { dx = 0; dy = 1; dz = 0; d = 1; }
        const u = d / R; if (u >= 1.3) continue;
        const q = u / .38, v = Math.min(11.5, 15 * K / (1 + q * q)); let ux = dx / d, uy = Math.max(dy / d, 0) + .42, uz = dz / d; const n = Math.sqrt(ux * ux + uy * uy + uz * uz); ux /= n; uy /= n; uz /= n;
        ragKick(i, ux * v, Math.min(uy * v, 6), uz * v);
      }
      ragWake();
    },
    /** A bullet that killed this body: pushes along the shot at the hit location. */
    shove(hx, hy, hz, dx, dy, dz, power) { if (dead) ragShove(hx, hy, hz, dx, dy, dz, power); },
    /** A shot passing through a body on the ground: true when it touched a limb. */
    shot(ox, oy, oz, dx, dy, dz, tMax, power) {
      if (!dead) return false;
      const px = rp[0] - ox, py = rp[1] - oy, pz = rp[2] - oz, al = px * dx + py * dy + pz * dz;
      if (al < -1.2 || al > tMax + 1.2) return false;
      const cx = px - dx * al, cy = py - dy * al, cz = pz - dz * al; if (cx * cx + cy * cy + cz * cz > 2.9) return false;
      let best = -1, bd = Infinity, bt = 0;
      for (let i = 0; i < RD.nActive; i++) {
        const i3 = i * 3, qx = rp[i3] - ox, qy = rp[i3 + 1] - oy, qz = rp[i3 + 2] - oz, t = qx * dx + qy * dy + qz * dz; if (t < 0 || t > tMax) continue;
        const ex = qx - dx * t, ey = qy - dy * t, ez = qz - dz * t, e = ex * ex + ey * ey + ez * ez, r = RD.rad[i] + .1;
        if (e < r * r && t < bd) { bd = t; best = i; bt = t; }
      }
      if (best < 0) return false;
      ragShove(ox + dx * bt, oy + dy * bt, oz + dz * bt, dx, dy, dz, power); return true;
    },
    /** Centre of a moving body; false once it sleeps. The engine refreshes its colliders while it travels. */
    ragCenter(out) { if (!dead || sleeping) return false; out.x = rp[0]; out.y = rp[1]; out.z = rp[2]; return true; },
    respawn() {
      dead = false; s.dead = false; sleeping = false; needSnap = true;
      recP = recV = flP = flPV = flR = flRV = flY = flYV = flH = flHV = landY = landV = 0; relT = -1; atkT = -1; actT = -1;
      velX = velZ = 0; phase = 0; airB = 0; airTime = 0; hipYaw = 0; leanF = leanR = 0;
      yawS = lst.yaw; root.rotation.set(0, yawS, 0);
      poseAlive(1 / 60, 0, lst);
    },
    setVisible(v) { root.visible = !!v; if (!v) needSnap = true; },
    setColliders(arr) { colliders = Array.isArray(arr) ? arr : null; if (dead && !sleeping) gatherColliders(); },
    muzzle(target) {
      target = target || new THREE.Vector3();
      if (isZ) target.set(0, -.1 * sy, -.01).applyQuaternion(Q[HAR]).add(P[HAR]);
      else target.set(0, W.my, W.muzzle).applyQuaternion(Q[GUN]).add(P[GUN]);
      root.updateWorldMatrix(true, false);
      return target.applyMatrix4(root.matrixWorld);
    },
    dispose() { if (root.parent) root.parent.remove(root); skeleton.dispose(); },
    // debug/test hooks (read-only use)
    _dbg: { P, Q, feet, rp, RD, A, isSleeping: () => sleeping, ragTime: () => rT },
  };
  Object.defineProperty(s, 'dead', { get: () => dead, set: () => { }, enumerable: true });
  poseAlive(1 / 60, 0, lst);
  return s;
}

export const SOLDIER_WEAPONS = Object.keys(WEAP);
export const ZOMBIE_TYPES = Object.keys(ZTYPE);
