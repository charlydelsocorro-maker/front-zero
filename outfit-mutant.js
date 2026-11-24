// outfit-mutant.js — FRONT ZÉRO: MUTANT, the look of the brute zombies (visual only: stats, waves, AI and server are unchanged).
// Original design: a soldier gone wrong. Desaturated grey-yellow skin with bruising, dark veins, scars, lesions and tumour clusters; a hunched back
// with bone plates breaking through the spine; an oversized left arm and shoulder; ribs showing through torn skin on the right flank; shredded fatigues
// (a torn shirt hanging from the right shoulder and the back, trousers ripped off at the left knee), the remains of a plate carrier slipped to one side
// with a snapped strap; a cracked gas mask fused to the face (one eyepiece smashed, a dim eye in the hole) and a fragment of helmet grown into the skull.
// Up close: mottled, bruised skin (baked in the vertex ambient term), boils, stitched scars and staples, muscle through torn skin, frayed and torn
// fatigues, a burst seam, a sleeve split by the swollen arm, a cracked rig with a pouch hanging open, dog tags, a plate fragment in the chest, a pack frame
// and a dented tank with a hose to the mask, bony ridges, spurs and knuckle growths, a bandaged forearm, a torn glove, a boot split by the swollen foot.
// Built with the kit, drawn with the shared outfit material (no new shader program), scaled to the brute's proportions.
// Public: MUTANT_TYPE, prepareZombies(yieldFn), zombieSkin(soldier, zombieType, {lod}).
import * as THREE from 'three';
import { BONE as B, SLOT as S, T, lerp, clamp, sstep, blend2, torsoSkin, armSkin, legSkin, legJoin, buildGlove, buildBoot, buildPouch, panel, faceTo, defineOutfitSet, attachInstance, outfitMaterial } from './outfit-kit.js';

const TAU = Math.PI * 2;
export const MUTANT_TYPE = 'brute';
const SCALE = [1.24, 1.12, 1.24];         // must match ZTYPE.brute.scale in soldier.js
const PAL = { cloth: 0xa5a891, cloth2: 0x3c3e32, plate: 0xb2a78e, plate2: 0x4e1c1a, rubber: 0x2a2b27, metal: 0x50544a, accent: 0x8e8c50, glow: 0xc8b85a, visor: 0x161a19, team: 0x4c4050, rim: 0xc0c8ba, lift: .02, floor: .035,
  pbr: { team: [.86, 0, 0, .35], cloth: [.82, 0, 0, .4], cloth2: [.95, 0, 0, .9], plate: [.6, 0, 0, 0], plate2: [.42, 0, 0, .1], rubber: [.78, 0, 0, .2], metal: [.58, .45, 0, 0], accent: [.86, 0, 0, .3], glow: [.4, 0, .55, 0], visor: [.2, .3, .02, 0] },
  pattern: { type: 1, scale: 24, strength: .72, a: 0x463846, b: 0x2c2e26 } };      // bruising on the skin, faded blotches on the fatigues
const SETS = [{ id: 'mutant-brute', setId: 'mutant', name: 'MUTANT', colorway: 'Brute', palette: PAL }];

let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gs = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const aw = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const lumpy = (a, y, k) => k * (.5 * Math.sin(a * 3 + y * 11) + .3 * Math.sin(a * 7 - y * 17) + .2 * Math.sin(a * 13 + y * 29));
const ring = (n, cx, y, cz, rx, rz, disp) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, d = disp ? disp(a, y) : 0; return [cx + (rx + d) * Math.sin(a), y, cz - (rz + d) * Math.cos(a)]; });
const radAt = (R, y) => { if (y >= R[0][0]) return R[0][1]; for (let i = 0; i < R.length - 1; i++) { const a = R[i], b = R[i + 1]; if (y >= b[0]) return lerp(a[1], b[1], (a[0] - y) / (a[0] - b[0])); } return R[R.length - 1][1]; };
/** A few lumps around a centre (tumour cluster). */
function tumours(m, c, R, n, skin, sd) { seed = sd; for (let i = 0; i < n; i++) { const r = R * (.42 + .5 * rnd()), a = rnd() * TAU, b = (rnd() - .5) * 1.2; m.ell([c[0] + Math.cos(a) * R * .45, c[1] + b * R * .5, c[2] + Math.sin(a) * R * .45], [r, r * (.7 + .2 * rnd()), r * .85], { slot: S.CLOTH, skin, nu: m.keep(1) ? 9 : 6, nv: m.keep(1) ? 6 : 4, ao: .7 }); } }

// ---------------------------------------------------------------- torso: hunched, swollen on the left, sunken right flank
const TROWS = [[.86, .1, .09, .01], [.95, .17, .14, .01], [1.04, .178, .152, 0], [1.12, .19, .16, -.006], [1.22, .214, .174, -.012], [1.31, .232, .184, -.018], [1.39, .232, .18, -.022], [1.45, .2, .16, -.022], [1.5, .14, .122, -.016], [1.56, .072, .072, -.012]];
const rowAt = y => { const R = TROWS; if (y <= R[0][0]) return R[0]; for (let i = 0; i < R.length - 1; i++) { const a = R[i], b = R[i + 1]; if (y <= b[0]) { const t = (y - a[0]) / (b[0] - a[0]); return a.map((v, k) => lerp(v, b[k], t)); } } return R[R.length - 1]; };
const tDisp = (a, y, L = 1) => { const w = aw(a); return L * lumpy(a, y, .007)
  + .044 * gs(Math.abs(w), Math.PI, .85) * gs(y, 1.4, .08)                                   // hump
  + .03 * gs(w, -1.25, .6) * gs(y, 1.3, .12)                                                  // swollen left side
  + .018 * gs(w, -.45, .32) * gs(y, 1.33, .06) + .009 * gs(w, .45, .3) * gs(y, 1.33, .06)     // chest, the left side bigger
  + .016 * gs(w, 0, .6) * gs(y, 1.06, .07) - .008 * gs(w, 0, .07) * sstep(1.16, 1.24, y) * sstep(1.46, 1.38, y)
  - .014 * gs(w, 1.3, .24) * gs(y, 1.21, .07) + .012 * gs(Math.abs(w), Math.PI, .1) * sstep(1.05, 1.15, y) * sstep(1.5, 1.42, y); };      // + spine ridge                                             // sunken right flank (ribs)
const torsoPt = (a, y, h = 0, L = 1) => { const r = rowAt(y), d = tDisp(a, y, L) + h; return [(r[1] + d) * Math.sin(a), y, r[3] - (r[2] + d) * Math.cos(a)]; };
const radial = (x, y, z) => [x, 0, z];
function torso(m) {
  const n = m.seg(24, 10), L = m.lod === 2 ? 0 : 1, ys = [], st = m.lod === 0 ? .04 : m.lod === 1 ? .07 : .14;
  for (let y = .86; y < 1.555; y += st) ys.push(y); ys.push(1.56);
  m.loft(ys.map(y => Array.from({ length: n }, (_, i) => torsoPt(i / n * TAU, y, 0, L))), { slot: S.CLOTH, skin: torsoSkin, crease: 180, capA: true, capB: true, out: radial, ao: (x, y, z) => (.7 + .3 * sstep(.9, 1.2, y)) * skinAO(x, y, z) });
  // ribs through torn skin on the right flank: raw patch, a lip of skin, four rib bars
  const rl = u => 1.135 + .018 * Math.sin(u * 9), rh = u => 1.29 + .02 * Math.sin(u * 7 + 1);
  panel(m, (u, v, h) => torsoPt(u, v, h + .001, L), 1.02, 1.58, rl, rh, { t: .004, nu: 6, nv: 5, slot: S.PLATE2, skin: torsoSkin, out: radial, edge: .2, round: .55 });
  for (let k = 0; k < 4; k++) { const y0 = 1.16 + k * .037; m.tube([0, 1, 2, 3, 4].map(i => { const a = lerp(1.08, 1.52, i / 4); return torsoPt(a, y0 + (a - 1.08) * .035, .007 + .003 * Math.sin(i * 1.4), L); }), t => .0064 * (1 - .3 * t), { slot: S.PLATE, skin: torsoSkin, sides: m.keep(1) ? 5 : 3, n: m.seg(8, 3), cap: true }); }
  if (m.keep(1)) m.tube(Array.from({ length: 21 }, (_, i) => { const t = i / 20 * TAU, u = 1.3 + .29 * Math.cos(t), v = lerp(rl(u), rh(u), .5 + .5 * Math.sin(t)) + .006 * Math.sin(t * 7); return torsoPt(u, v, .003, L); }), .0055, { slot: S.CLOTH, skin: torsoSkin, sides: 5, n: 30, cap: false });
  // irregular bony plates breaking through the spine ridge, raw flesh round their base
  seed = 77; for (let k = 0; k < 11; k++) { const y = 1.08 + k * .038 + .008 * rnd(), off = (rnd() - .5) * .16, h = (.018 + .03 * Math.sin(k / 10 * Math.PI)) * (.7 + .6 * rnd()), tw = rnd() * 3, tl = (rnd() - .5) * .5, up = .01 + .01 * rnd(); if (m.lod === 2 && k % 2) continue;
    const p = torsoPt(Math.PI + off, y, -.004, L), q = torsoPt(Math.PI + off, y, .03, L), M = faceTo(p, [q[0] - p[0], q[1] - p[1] + up, q[2] - p[2]]).multiply(T(0, 0, 0, 0, tw, tl));
    m.revolve([[.002, h * .8], [.012, h * .55], [.026, h * .18], [.032, -.006]], { sides: m.keep(1) ? 6 : 4, slot: S.PLATE, skin: () => torsoSkin(0, y), m: M.clone().multiply(T(0, 0, 0, -.5, 0, 0, 1.3, 1, .55)), crease: 40 }); }
  // tumour clusters on the left of the neck and the right of the lower back
  tumours(m, [-.12, 1.48, .03], .048, m.keep(1) ? 6 : 3, () => [B.CHE, .55, B.NEC, .15, B.UAL, .3], 11);
  tumours(m, torsoPt(2.7, 1.13, .01), .034, m.keep(1) ? 4 : 2, () => torsoSkin(.1, 1.13), 23);
  if (!m.keep(1)) return;
  // lesions, scars, veins
  for (const [a, y, w, hg] of [[.55, 1.37, .22, .05], [-.35, 1.05, .25, .045], [2.5, 1.27, .3, .06], [-2.3, 1.1, .2, .05], [-.9, 1.4, .18, .04]]) panel(m, (u, v, h) => torsoPt(u, v, h + .001, L), a - w / 2, a + w / 2, u => y - hg / 2 + .012 * Math.sin(u * 23) + .006 * Math.sin(u * 57), u => y + hg / 2 + .012 * Math.sin(u * 19 + 2) + .006 * Math.sin(u * 61), { t: .002, nu: 6, nv: 2, slot: S.TEAM, skin: torsoSkin, out: radial, edge: .3, round: .5, dome: .003 });
  for (const [a0, y0, a1, y1] of [[-.25, 1.43, .3, 1.18], [1.9, 1.4, 2.6, 1.12], [-1.6, 1.2, -1.0, 1.0]]) m.tube([0, 1, 2, 3, 4, 5].map(i => torsoPt(lerp(a0, a1, i / 5), lerp(y0, y1, i / 5), .0025, L)), .0032, { slot: S.PLATE2, skin: torsoSkin, sides: 4, n: 10, cap: true });
  seed = 9; for (let k = 0; k < 12; k++) { const a0 = (rnd() - .5) * 3.0, y0 = 1.08 + rnd() * .36, pts = []; for (let i = 0; i < 5; i++) pts.push(torsoPt(a0 + (rnd() - .5) * .22 * i, y0 - i * .045, .003, L)); m.tube(pts, t => .0062 * (1 - .55 * t), { slot: S.TEAM, skin: torsoSkin, sides: 4, n: 6, cap: false }); }
}

// ---------------------------------------------------------------- arms: the left one oversized (shoulder mass, tumours, bone plates, claws), the right one lean in a torn sleeve
const ARM_BIG = [[1.52, .04], [1.48, .115], [1.4, .13], [1.3, .118], [1.22, .1], [1.16, .088], [1.1, .095], [1.02, .088], [.95, .072], [.9, .058]];
const ARM_LEAN = [[1.5, .03], [1.47, .08], [1.4, .086], [1.3, .078], [1.22, .068], [1.16, .06], [1.1, .064], [1.02, .058], [.95, .049], [.9, .044]];
function arms(m) {
  const L = m.lod === 2 ? 0 : 1;
  for (const s of [-1, 1]) {
    const big = s < 0, n = m.seg(14, 7), R = big ? ARM_BIG : ARM_LEAN;
    m.loft(R.map(r => ring(n, s * .2, r[0], 0, r[1], r[1] * 1.05, (a, y) => L * lumpy(a, y, big ? .009 : .005))), { slot: S.CLOTH, skin: armSkin(s), crease: 180, capA: true, capB: true, out: (x, y, z) => [x - s * .2, 0, z], ao: (x, y, z) => (.74 + .26 * sstep(1.0, 1.3, y)) * skinAO(x, y, z) });
    if (big) {
      // shoulder mass rising to the neck, tumours on the upper arm, bone plates through the shoulder and forearm
      m.ell([-.25, 1.45, .005], [.095, .075, .1], { slot: S.CLOTH, skin: () => [B.UAL, .65, B.CHE, .35], nu: m.seg(14, 7), nv: m.seg(9, 5) });
      tumours(m, [-.31, 1.3, .045], .04, m.keep(1) ? 5 : 3, B.UAL, 41);
      for (let i = 0; i < 4; i++) { const a = -.6 + i * .4, y = 1.5 - Math.abs(a) * .03; m.revolve([[.002, .05], [.01, .03], [.022, 0], [.024, -.012]], { sides: m.keep(1) ? 6 : 4, slot: S.PLATE, skin: () => [B.CHE, .4, B.UAL, .6], m: T(-.24 - .1 * Math.cos(a), y, .11 * Math.sin(a), Math.sin(a) * .6, 0, .9, 1, 1, .5), crease: 50 }); }
      for (let i = 0; i < 3; i++) m.revolve([[.002, .034], [.008, .02], [.015, 0], [.017, -.008]], { sides: m.keep(1) ? 6 : 4, slot: S.PLATE, skin: B.FAL, m: T(-.2 - .098, 1.1 - i * .05, .02, 0, 0, 1.4, 1, 1, .5), crease: 50 });
      if (m.keep(1)) { seed = 51; for (let k = 0; k < 5; k++) { const a0 = -Math.PI / 2 + (rnd() - .5) * 1.6, y0 = 1.38 - rnd() * .3, pts = []; for (let i = 0; i < 4; i++) { const a = a0 + (rnd() - .5) * .3 * i, y = y0 - i * .05, r = radAt(R, y) + .003; pts.push([-.2 + r * Math.sin(a), y, -r * 1.05 * Math.cos(a)]); } m.tube(pts, t => .006 * (1 - .5 * t), { slot: S.TEAM, skin: armSkin(-1), sides: 4, n: 6, cap: false }); } }
      // four bone claws past the fingers
      for (let i = 0; i < 4; i++) { const z = -.036 + i * .024; m.tube([[-.18, .8, z], [-.155, .755, z - .01], [-.13, .728, z - .022]], t => .0065 * (1 - .85 * t), { slot: S.PLATE, skin: B.HAL, sides: m.keep(1) ? 4 : 3, n: 4, cap: true }); }
    } else {
      // torn sleeve of the shirt: ragged lower edge
      const sl = m.seg(5, 2);
      m.grid(n, sl, (u, v) => { const a = u * TAU, y = lerp(1.475, 1.27 + .035 * Math.sin(a * 5 + 1) + .018 * Math.sin(a * 11), v), r = radAt(R, y) + .011 + .004 * Math.sin(a * 3 + y * 30); return [.2 + r * Math.sin(a), y, -r * 1.05 * Math.cos(a)]; }, { wrapU: true, slot: S.CLOTH2, skin: (x, y) => (y > 1.45 ? [B.UAR, .7, B.CHE, .3] : [B.UAR, 1]), crease: 180, out: (x, y, z) => [x - .2, 0, z], ao: .88 });
    }
  }
}

// ---------------------------------------------------------------- legs and shredded fatigues, belt, boots
const LEG = [[.95, .12], [.86, .12], [.75, .108], [.62, .092], [.53, .08], [.45, .08], [.36, .074], [.27, .064], [.2, .06]];
function legs(m) {
  const L = m.lod === 2 ? 0 : 1;
  for (const s of [-1, 1]) {
    const n = m.seg(14, 7), k = s < 0 ? 1.08 : 1, ol = (x, y, z) => [x - s * .1, 0, z];
    m.loft(LEG.map(r => ring(n, s * .1, r[0], .004, r[1] * k, r[1] * k * 1.04, (a, y) => L * lumpy(a, y + s, .006))), { slot: S.CLOTH, skin: legSkin(s), crease: 180, capA: true, capB: true, out: ol, ao: (x, y, z) => (.72 + .28 * sstep(.3, .6, y)) * skinAO(x, y, z) });
    // trousers: the left leg ripped off below the knee, the right one down into the boot
    const hem = s < 0 ? .4 : .27, rows = m.seg(9, 4), hemAt = a => hem + (s < 0 ? .05 * Math.sin(a * 6 + 1) + .03 * Math.sin(a * 13) : .015 * Math.sin(a * 5));
    const tRows = m.seg(12, 5);
    m.grid(n, tRows, (u, v) => { const a = u * TAU, y = lerp(1.02, hemAt(a), v), hk = sstep(.86, 1.0, y), r = radAt(LEG, y) * k + .014 + L * (.006 * Math.sin(a * 3 + y * 22) + .011 * Math.sin(a * 4 + y * 30 + s) * gs(y, .87, .045) * Math.max(0, -s * Math.sin(a)));
      return legJoin([s * .1 + r * Math.sin(a), y, .004 - r * 1.04 * (1 + .2 * hk) * Math.cos(a)], s, s * .1, r, sstep(.76, .84, y)); }, { wrapU: true, slot: S.CLOTH2, skin: legSkin(s), crease: 180, out: ol, ao: (x, y) => .78 + .18 * sstep(.4, .9, y) });
    if (s < 0 && m.keep(1)) for (let i = 0; i < 5; i++) { const a = -.3 + i * 1.25, y0 = hemAt(a) + .01, r = radAt(LEG, y0) * k + .016; m.tube([0, 1, 2].map(j => { const y = y0 - j * .05, rr = r - j * .004; return [s * .1 + rr * Math.sin(a + j * .05), y, .004 - rr * 1.04 * Math.cos(a + j * .05)]; }), t => .011 * (1 - .5 * t), { slot: S.CLOTH2, skin: legSkin(s), sides: 4, flat: .3, n: 5, cap: true }); }
    // cracked knee pad on the right knee
    if (s > 0) for (const [u0, u1] of [[-1.0, -.06], [.02, 1.0]]) panel(m, (u, v, h) => { const r = radAt(LEG, v) + .03 + h; return [.1 + r * Math.sin(u), v, .004 - r * 1.04 * Math.cos(u)]; }, u0, u1, .44, u => .57 - .02 * Math.abs(u), { t: .01, nu: 5, nv: 3, slot: S.RUBBER, skin: (x, y) => blend2(B.SHR, B.THR, y, .52, .03), out: ol, edge: .12, round: .4 });
  }
  // fly and seat: the trousers' centre front and back panels over the belly and seat, down into the crotch
  for (const a0 of [0, Math.PI]) panel(m, (u, v, h) => torsoPt(u, v, h + .02, L), a0 - .34, a0 + .34, u => .8 + .08 * ((u - a0) / .34) ** 2, .976, { t: .008, nu: 6, nv: 4, slot: S.CLOTH2, skin: (x, y) => (y > .93 ? [B.PEL, 1] : [B.PEL, .5, x < 0 ? B.THL : B.THR, .5]), out: radial, edge: .2, round: .5 });
  // belt and buckle
  m.grid(m.seg(24, 10), 1, (u, v) => { const a = u * TAU; return [.2 * Math.sin(a), lerp(.985, 1.03, v), .006 - .172 * Math.cos(a)]; }, { wrapU: true, slot: S.RUBBER, skin: B.PEL, crease: 180, out: radial });
  m.box([.03, 1.008, -.18], [.04, .036, .01], .003, { slot: S.METAL, skin: B.PEL });
}

// ---------------------------------------------------------------- shirt remnant (right shoulder and back) and the slipped plate carrier
function shirt(m) {
  const n = m.seg(22, 8), rows = m.seg(9, 4), L = m.lod === 2 ? 0 : 1;
  const aL = y => -.3 + .07 * Math.sin(y * 47) + .04 * Math.sin(y * 91), aR = y => Math.PI - .2 + .05 * Math.sin(y * 53);      // torn open on the swollen left side and down the spine
  const hemAt = a => lerp(1.31, 1.02, sstep(1.6, 2.4, Math.abs(aw(a)))) + .022 * Math.sin(a * 7) + .012 * Math.sin(a * 13 + 1);
  m.grid(n, rows, (u, v) => { const y0 = lerp(1.47, 1.1, v), a = lerp(aL(y0), aR(y0), u), y = lerp(1.47, hemAt(a), v); return torsoPt(a, y, .011 + L * .003 * Math.sin(a * 5 + y * 30), L); }, { slot: S.CLOTH2, skin: torsoSkin, crease: 180, out: radial, ao: .86 });
}
function carrier(m) {
  const L = m.lod === 2 ? 0 : 1, on = (u, v, h) => torsoPt(u, v + (u - .4) * .07, h + .032, L);
  panel(m, on, .02, .8, 1.1, 1.36, { t: .022, nu: 7, nv: 4, slot: S.RUBBER, skin: torsoSkin, out: radial, edge: .12, round: .25 });
  for (const [a, y] of [[.22, 1.17], [.56, 1.17]]) { const p = on(a, y, .038); buildPouch(m, .07, .07, .03, T(p[0], p[1], p[2], 0, Math.PI - a, 0), { slot: S.RUBBER, slotFlap: S.CLOTH2, skin: torsoSkin, tab: false }); }
  // right shoulder strap over the hump; the left one snapped and hanging; the cummerbund torn off at the back
  const top = on(.72, 1.36, .0), tl = on(.08, 1.36, .0);
  m.tube([top, [.15, 1.47, -.07], [.15, 1.505, .04], torsoPt(Math.PI - .55, 1.4, .03, L), torsoPt(Math.PI - .45, 1.27, .02, L)], .012, { slot: S.RUBBER, skin: (x, y) => (y > 1.46 ? [B.CHE, .8, B.NEC, .2] : torsoSkin(x, y)), sides: 5, flat: .3, n: m.seg(14, 5), up: [1, 0, 0] });
  m.tube([tl, [tl[0] - .05, tl[1] - .05, tl[2] - .03], [tl[0] - .07, tl[1] - .14, tl[2] - .02], [tl[0] - .06, tl[1] - .21, tl[2] - .01]], .011, { slot: S.RUBBER, skin: torsoSkin, sides: 5, flat: .3, n: m.seg(10, 4), up: [0, 0, -1] });
  m.tube([.8, 1.2, 1.6, 2.0, 2.35].map(a => torsoPt(a, 1.17 + (a - .8) * .02, .024, L)), .013, { slot: S.RUBBER, skin: torsoSkin, sides: 5, flat: .3, n: m.seg(12, 5), up: [0, 1, 0] });
  if (m.keep(1)) m.box([.152, 1.455, -.09], [.03, .008, .026], .002, { slot: S.METAL, skin: B.CHE });
}

// ---------------------------------------------------------------- head: low and forward, a swollen left temple; cracked gas mask fused to the face, helmet fragment in the skull
const HCm = [0, 1.652, -.03];
const skullD = (lon, lat, L) => .022 * gs(lon, -1.2, .4) * gs(lat, .25, .35) + .012 * gs(Math.abs(aw(lon)), Math.PI, .9) * gs(lat, .35, .45) + .014 * gs(aw(lon), 0, .7) * gs(lat, -.55, .22)
  + L * (.006 * Math.sin(lon * 3 + lat * 5) + .004 * Math.sin(lon * 7 - lat * 9));
const skullP = (lon, lat, h = 0, L = 1) => { const c = Math.cos(lat), d = skullD(lon, lat, L) + h; return [HCm[0] + (.1 + d) * c * Math.sin(lon), HCm[1] + .122 * Math.sin(lat) + d * Math.sin(lat) * .6, HCm[2] - (.11 + d) * c * Math.cos(lon)]; };
const headSk = (x, y) => (y > 1.585 ? [B.HEA, 1] : blend2(B.NEC, B.HEA, y, 1.56, .03));
const outH = (x, y, z) => [x - HCm[0], y - HCm[1], z - HCm[2]];
function head(m) {
  const L = m.lod === 2 ? 0 : 1;
  m.grid(m.seg(24, 10), m.seg(16, 7), (u, v) => skullP(u * TAU - Math.PI, lerp(-1.12, 1.5707, v), 0, L), { wrapU: true, capA: true, capB: true, slot: S.CLOTH, skin: headSk, crease: 180, out: outH, ao: (x, y, z) => (.66 + .34 * sstep(1.55, 1.7, y)) * skinAO(x, y, z) });
  // helmet fragment grown into the top right of the skull, flesh welling up along its broken edge
  const lo = u => .64 + .1 * Math.sin(u * 7 + 1) + .06 * Math.sin(u * 15);
  panel(m, (u, v, h) => skullP(u, v, h + .006, L), .25, 2.5, lo, 1.42, { t: .012, nu: m.seg(10, 5), nv: 4, slot: S.METAL, skin: B.HEA, out: outH, edge: .1, round: .15, dome: .008 });
  if (m.keep(1)) { seed = 31; for (let i = 0; i < 6; i++) { const u = lerp(.35, 2.4, i / 5), p = skullP(u, lo(u) - .035, .004, L), r = .012 + .01 * rnd(); m.ell(p, [r, r * .7, r], { slot: S.CLOTH, skin: B.HEA, nu: 7, nv: 5, ao: .6 }); } }
}
function mask(m) {
  const H = B.HEA, L = m.lod === 2 ? 0 : 1, mp = (u, v, h) => skullP(u, v, h + .004, L);
  const lo = u => -.82 + .18 * (u / 1.05) ** 2, hi = u => .4 - .16 * (u / 1.05) ** 2;
  panel(m, mp, -1.05, 1.05, lo, hi, { t: .013, nu: 12, nv: 8, slot: S.RUBBER, skin: headSk, out: outH, edge: .14, round: .65, dome: .004 });
  const at = (lon, lat, h) => { const p = mp(lon, lat, h), q = mp(lon, lat, h + .01); return [p, [q[0] - p[0], q[1] - p[1], q[2] - p[2]]]; };
  for (const s of [-1, 1]) {
    const [p, d] = at(s * .37, .1, .013), M = faceTo(p, d);
    m.revolve([[.021, .009], [.03, .008], [.033, .002], [.031, -.004]], { sides: m.seg(16, 8), slot: S.METAL, skin: H, m: M, crease: 40 });
    if (s > 0) {          // right eyepiece: lens with cracks
      m.revolve([[.001, .006], [.023, .005]], { sides: m.seg(16, 8), slot: S.VISOR, skin: H, m: M, crease: 40 });
      if (m.keep(1)) for (const c of [[[.009, .0068, -.006], [.014, .0068, -.001], [.016, .0068, .008], [.021, .0066, .01]], [[.009, .0068, -.006], [.001, .0068, -.004], [-.009, .0068, .003], [-.019, .0066, .006]], [[.009, .0068, -.006], [.011, .0068, -.014], [.017, .0066, -.016]], [[.003, .0068, -.0045], [.0, .0068, -.013], [-.004, .0066, -.019]], [[-.005, .0068, 0], [-.004, .0068, .009], [-.008, .0066, .016]]]) m.tube(c.map(q => { const w = new THREE.Vector3(q[0], q[1], q[2]).applyMatrix4(M); return [w.x, w.y, w.z]; }), .0009, { slot: S.PLATE, skin: H, sides: 3, n: 4, cap: false });
    } else {              // left eyepiece smashed: raw socket, a dim eye deep in it, shards on the rim
      m.revolve([[.002, -.007], [.021, -.004], [.023, .006]], { sides: m.seg(14, 7), slot: S.PLATE2, skin: H, m: M, crease: 60 });
      const e = new THREE.Vector3(0, -.002, 0).applyMatrix4(M); m.ell([e.x, e.y, e.z], [.008, .005, .008], { slot: S.GLOW, skin: H, nu: 8, nv: 4 });
      if (m.keep(1)) for (const g of [.4, 2.3, 4.4]) m.box([.018 * Math.cos(g), .006, .018 * Math.sin(g)], [.012, .0018, .007], .0005, { slot: S.VISOR, skin: H, m: M.clone().multiply(T(0, 0, 0, 0, -g, 0)) });
    }
  }
  // voicemitter, a filter on the left cheek, straps (the upper left one snapped)
  { const [p, d] = at(0, -.44, .013), M = faceTo(p, d); m.revolve([[.002, .024], [.018, .022], [.025, .012], [.027, 0]], { sides: m.seg(14, 7), slot: S.RUBBER, skin: H, m: M, crease: 40 }); m.revolve([[.02, .026], [.025, .023], [.025, .018]], { sides: m.seg(14, 7), slot: S.METAL, skin: H, m: M, crease: 40 }); }
  { const [p, d] = at(-.62, -.46, .012), M = faceTo(p, [d[0], d[1] - .006, d[2]]); m.revolve([[.002, .046], [.028, .046], [.033, .041], [.033, .006], [.025, 0]], { sides: m.seg(14, 7), slot: S.METAL, skin: H, m: M, crease: 40 }); m.revolve([[.0335, .03], [.0355, .026], [.0355, .016], [.0335, .012]], { sides: m.seg(14, 7), slot: S.RUBBER, skin: H, m: M, crease: 50 }); }
  if (m.keep(1)) {
    m.tube([1.0, 1.6, 2.2, 2.8, 3.4, 3.9].map(u => skullP(u, .32, .006, L)), .008, { slot: S.RUBBER, skin: H, sides: 4, flat: .3, n: 14, up: [0, 1, 0] });
    m.tube([-1.0, -1.5, -1.9].map(u => skullP(u, .3, .006, L)), .008, { slot: S.RUBBER, skin: H, sides: 4, flat: .3, n: 6, up: [0, 1, 0] });
    m.tube([-1.0, -1.8, -2.6, 2.6, 1.8, 1.0].map((u, i) => skullP(i < 3 ? u : u, -.32, .006, L)), .008, { slot: S.RUBBER, skin: headSk, sides: 4, flat: .3, n: 16, up: [0, 1, 0] });
  }
  // flesh grown over the mask's top left edge and the right jaw
  tumours(m, mp(-.72, hi(-.72) + .025, -.004), .03, m.keep(1) ? 3 : 1, H, 61);
  tumours(m, mp(.88, lo(.88) - .015, -.004), .022, m.keep(1) ? 2 : 1, headSk, 67);
}

// ---------------------------------------------------------------- skin shading: mottling, bruising and darker creases baked in the vertex ambient term (no new program)
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y, z) => { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const c = (a, b, d) => hash3(ix + a, iy + b, iz + d); return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v), lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w); };
/** Ambient multiplier of the skin at a point: blotchy mottling, bruise zones, creases at the neck, armpits, elbows, knees, groin. */
const skinAO = (x, y, z) => {
  const big = vnoise(x * 5 + 3, y * 5, z * 5 + 1), big2 = vnoise(x * 3.2 + 17, y * 3.2 + 5, z * 3.2), m1 = vnoise(x * 16 + 3, y * 16, z * 16), m2 = vnoise(x * 42, y * 42 + 7, z * 42);
  const livid = sstep(.5, .6, big), ashen = sstep(.54, .62, big2) * (1 - livid);
  const crease = 1 - .4 * gs(y, 1.53, .03) - .3 * gs(Math.abs(x), .17, .03) * gs(y, 1.38, .05) - .3 * gs(y, 1.17, .025) * sstep(.12, .19, Math.abs(x)) - .3 * gs(y, .52, .03) - .25 * gs(y, .9, .04) * gs(x, 0, .06);
  return clamp((.8 + .1 * m1 + .06 * m2 - .52 * livid + .2 * ashen) * crease, .26, 1);
};

/** Raised boils: small lumps with a darker tip, in clusters. */
function boils(m, c, R, n, skin, sd) { seed = sd; for (let i = 0; i < n; i++) { const a = rnd() * TAU, b = (rnd() - .5) * 1.6, r = .005 + .007 * rnd(), p = [c[0] + Math.cos(a) * R * rnd(), c[1] + b * R * .6, c[2] + Math.sin(a) * R * rnd()]; m.ell(p, [r, r * .75, r], { slot: S.CLOTH, skin, nu: 6, nv: 4, ao: .62 }); m.ell([p[0], p[1] + r * .35, p[2]], [r * .62, r * .5, r * .62], { slot: S.PLATE2, skin, nu: 5, nv: 3 }); } }
/** Muscle showing through torn skin: a dark raw bed, fibres along `dir`, a lip of skin round it. map(u, v, h) on the body, u0..u1 x v0..v1. */
function muscle(m, map, u0, u1, v0, v1, skin, sd, fib = 6) {
  seed = sd; const lo = u => v0 + .006 * Math.sin(u * 41 + sd), hi = u => v1 + .007 * Math.sin(u * 37 + sd);
  panel(m, (u, v, h) => map(u, v, h - .001), u0, u1, lo, hi, { t: .003, nu: 5, nv: 4, slot: S.RUBBER, skin, edge: .2, round: .55 });
  for (let i = 0; i < fib; i++) { const f = (i + .5) / fib, u = lerp(u0, u1, f), pts = [0, 1, 2, 3].map(k => { const t = k / 3, v = lerp(lo(u) + .004, hi(u) - .004, t); return map(u + .01 * Math.sin(t * 5 + i), v, .0035 + .002 * Math.sin(t * Math.PI)); }); m.tube(pts, t => .0042 * (1 - .4 * Math.abs(t - .5)), { slot: S.PLATE2, skin, sides: 4, n: 6, cap: true }); }
  m.tube(Array.from({ length: 17 }, (_, i) => { const t = i / 16 * TAU, u = lerp(u0, u1, .5 + .5 * Math.cos(t)), v = lerp(lo(u), hi(u), .5 + .5 * Math.sin(t)) + .004 * Math.sin(t * 6); return map(u, v, .003); }), .004, { slot: S.CLOTH, skin, sides: 4, n: 24, cap: false });
}
/** Frayed fringe: short hanging strips and threads along an edge given by points (each strip hangs from one point). */
function fringe(m, pts, skin, sd, len = .03) { seed = sd; for (const p of pts) { const l = len * (.4 + rnd()), w = .006 + .006 * rnd(), dx = (rnd() - .5) * .01; m.tube([p, [p[0] + dx * .5, p[1] - l * .5, p[2] - .002], [p[0] + dx, p[1] - l, p[2] + (rnd() - .5) * .006]], t => w * (1 - .6 * t), { slot: S.CLOTH2, skin, sides: 3, flat: .3, n: 4, cap: true }); } }
/** Stitched scar: a raised ridge with crossing stitches (map along u at v, on a body map). */
function stitched(m, map, u0, u1, v0, v1, n, skin) {
  const P = k => map(lerp(u0, u1, k), lerp(v0, v1, k), .0025);
  m.tube(Array.from({ length: 8 }, (_, i) => P(i / 7)), .0035, { slot: S.PLATE2, skin, sides: 4, n: 12, cap: true });
  for (let i = 0; i < n; i++) { const k = (i + .5) / n, a = map(lerp(u0, u1, k) - .02, lerp(v0, v1, k) + .012, .004), b = map(lerp(u0, u1, k) + .02, lerp(v0, v1, k) - .012, .004); m.tube([a, b], .0011, { slot: S.RUBBER, skin, sides: 3, n: 2, cap: true }); }
}

// ---------------------------------------------------------------- sick skin read at mid range: halos, a coarse vein network, livid patches on the limbs (LOD0-1)
const armPt = s => (a, y, h = 0) => { const big = s < 0, R = big ? ARM_BIG : ARM_LEAN, r = radAt(R, y), d = lumpy(a, y, big ? .009 : .005) + h; return [s * .2 + (r + d) * Math.sin(a), y, -(r * 1.05 + d) * Math.cos(a)]; };
const legPt = s => (a, y, h = 0) => { const k = s < 0 ? 1.08 : 1, r = radAt(LEG, y) * k, d = lumpy(a, y + s, .006) + h; return [s * .1 + (r + d) * Math.sin(a), y, .004 - (r * 1.04 + d) * Math.cos(a)]; };
const blotch = (m, map, a, y, w, hg, slot, skin, sd, h = .0012, out = (x, yy, z) => [x, 0, z]) => panel(m, (u, v, hh) => map(u, v, hh + h), a - w / 2, a + w / 2, u => y - hg / 2 + .3 * hg * Math.sin(u * 17 / w + sd) + .15 * hg * Math.sin(u * 43 / w + sd * 2), u => y + hg / 2 + .3 * hg * Math.sin(u * 13 / w + sd * 3) + .15 * hg * Math.sin(u * 37 / w + sd), { t: .0004, nu: 7, nv: 3, slot, skin, out, edge: .35, round: .85 });
function veinTree(m, map, a0, y0, da, dy, n, skin, sd, r0 = .0075) { seed = sd; const trunk = []; let a = a0, y = y0; for (let i = 0; i < n; i++) { trunk.push(map(a, y, .0035)); a += da + (rnd() - .5) * .12; y += dy + (rnd() - .5) * .02; } m.tube(trunk, t => r0 * (1 - .65 * t), { slot: S.TEAM, skin, sides: 3, n: n + 2, cap: true });
  if (m.keep(0)) for (let b = 0; b < 2; b++) { const i0 = 1 + Math.floor(rnd() * (n - 2)), pts = []; let ba = a0 + da * i0, by = y0 + dy * i0; const s = rnd() < .5 ? -1 : 1; for (let i = 0; i < 4; i++) { pts.push(map(ba, by, .0035)); ba += s * Math.abs(dy) * 2.2 + (rnd() - .5) * .08; by += dy * .7; } m.tube(pts, t => r0 * .6 * (1 - .7 * t), { slot: S.TEAM, skin, sides: 3, n: 6, cap: true }); } }
function sickSkin(m) {
  if (!m.keep(1)) return;
  const tp = (a, y, h) => torsoPt(a, y, h, 1), A = armPt(-1), Ar = armPt(1), Ll = legPt(-1);
  // a coarse vein network: neck, shoulders, chest round the wounds, forearms
  veinTree(m, tp, -.5, 1.55, .05, -.03, 6, torsoSkin, 21); veinTree(m, tp, .45, 1.55, -.04, -.03, 6, torsoSkin, 22); veinTree(m, tp, -1.2, 1.46, .08, -.035, 7, torsoSkin, 23);
  veinTree(m, tp, -.2, 1.3, -.06, -.03, 7, torsoSkin, 24); veinTree(m, tp, .9, 1.38, .06, -.035, 6, torsoSkin, 25); veinTree(m, tp, 2.6, 1.45, -.05, -.035, 6, torsoSkin, 26);
  veinTree(m, A, -Math.PI / 2 - .2, 1.44, .05, -.045, 8, armSkin(-1), 27, .008); veinTree(m, A, -Math.PI / 2 + .5, 1.12, -.04, -.04, 6, armSkin(-1), 28); veinTree(m, Ar, Math.PI / 2 - .3, 1.24, .05, -.04, 5, armSkin(1), 29, .006);
}

// ---------------------------------------------------------------- close detail on the body (LOD0)
function bodyDetail(m) {
  if (!m.keep(0)) return;
  const tp = (a, y, h) => torsoPt(a, y, h, 1);
  // boils and growths in clusters, asymmetric
  boils(m, tp(-.95, 1.22, .006), .05, 9, torsoSkin, 101); boils(m, tp(2.2, 1.34, .008), .04, 7, torsoSkin, 103); boils(m, tp(-2.6, 1.05, .006), .035, 6, torsoSkin, 107);
  boils(m, [-.33, 1.2, .04], .035, 7, B.UAL, 109); boils(m, [-.29, 1.02, -.03], .03, 5, B.FAL, 113);
  tumours(m, tp(-1.55, 1.08, .012), .04, 4, () => torsoSkin(-.2, 1.08), 117);
  // stitched scars on the chest and the lower back, staples down the right flank
  stitched(m, tp, -.7, -.15, 1.42, 1.2, 9, torsoSkin); stitched(m, tp, 2.6, 3.5, 1.08, 1.16, 8, torsoSkin);
  for (let i = 0; i < 7; i++) { const a = 1.62 + i * .06, y = 1.05 + i * .018, p = tp(a, y, .004), M = faceTo(p, [Math.sin(a), 0, -Math.cos(a)], [0, 1, 0]); m.box([0, .0008, 0], [.014, .0016, .0025], .0005, { slot: S.METAL, skin: torsoSkin, m: M }); }
  // muscle through torn skin on the left of the belly and the upper back
  muscle(m, tp, -.6, -.25, 1.06, 1.15, torsoSkin, 3, 6); muscle(m, tp, 2.15, 2.55, 1.22, 1.33, torsoSkin, 5, 5);
  // flesh bulging over the belt on the bare left side and round the carrier strap on the shoulder
  for (const a of [-1.15, -.75, -.4]) m.ell(tp(a, 1.045, -.004), [.04, .018, .03], { slot: S.CLOTH, skin: () => torsoSkin(0, 1.04), nu: 8, nv: 5, ao: .85 });
  for (const dz of [-.045, .035]) m.ell([.15, 1.49, -.03 + dz], [.03, .018, .025], { slot: S.CLOTH, skin: () => [B.CHE, .8, B.NEC, .2], nu: 8, nv: 5, ao: .85 });
  // dog tags on a ball chain, hanging on the bare chest
  { const chain = [[-.06, 1.53, -.06], [-.07, 1.47, -.15], [-.05, 1.4, -.205], [-.02, 1.36, -.22]]; m.tube(chain, .0012, { slot: S.METAL, skin: torsoSkin, sides: 3, n: 10, cap: false }); m.tube([[.06, 1.53, -.06], [.04, 1.45, -.17], [.0, 1.37, -.215]], .0012, { slot: S.METAL, skin: torsoSkin, sides: 3, n: 8, cap: false });
    for (const [dx, rz] of [[-.012, .2], [.004, -.15]]) m.box([0, 0, 0], [.02, .032, .0025], .004, { slot: S.METAL, skin: torsoSkin, m: T(-.01 + dx, 1.335, -.226, .2, 0, rz) }); }
  // a fragment of armour plate driven into the swollen left chest, flesh grown round it
  { const p = tp(-.62, 1.3, .004), M = faceTo(p, [Math.sin(-.62), .2, -Math.cos(-.62)], [0, 1, 0]); m.plate([[-.03, -.022], [.026, -.03], [.036, .008], [.01, .03], [-.024, .02]], (u, v, h) => { const q = new THREE.Vector3(u, h + .002, v).applyMatrix4(M); return [q.x, q.y, q.z]; }, { t: .006, bevel: .002, slot: S.METAL, skin: torsoSkin, out: () => [Math.sin(-.62), 0, -Math.cos(-.62)] });
    seed = 131; for (let i = 0; i < 5; i++) { const g = i / 5 * TAU, q = new THREE.Vector3(Math.cos(g) * .034, .002, Math.sin(g) * .028).applyMatrix4(M); m.ell([q.x, q.y, q.z], [.012, .008, .012], { slot: S.CLOTH, skin: torsoSkin, nu: 6, nv: 4, ao: .8 }); } }
}

// ---------------------------------------------------------------- uniform detail (LOD0): frayed edges, tears instead of stains, burst seam, a sleeve split by the swollen arm, a torn-off patch
function uniformDetail(m) {
  const L = 1;
  if (m.keep(1)) {
    // the left sleeve, split open by the swollen arm: a remnant on the back of the upper arm, threads across the split
    const R = ARM_BIG, ap = (a, y, h) => { const r = radAt(R, y) + .012 + h; return [-.2 + r * Math.sin(a), y, -r * 1.05 * Math.cos(a)]; };
    panel(m, ap, -2.7, -1.2, u => 1.3 + .03 * Math.sin(u * 9), u => 1.47, { t: .004, nu: m.seg(6, 3), nv: 3, slot: S.CLOTH2, skin: () => [B.UAL, .8, B.CHE, .2], out: (x, y, z) => [x + .2, 0, z], edge: .2, round: .3 });
    if (m.keep(0)) { for (const y of [1.36, 1.41, 1.45]) m.tube([ap(-1.2, y, .004), ap(-.7, y - .01, .012), ap(-.35, y + .005, .006)], .0014, { slot: S.CLOTH2, skin: B.UAL, sides: 3, n: 6, cap: false }); fringe(m, [-2.6, -2.3, -2.0, -1.7, -1.4].map(a => ap(a, 1.3 + .03 * Math.sin(a * 9), .004)), B.UAL, 141, .025); }
  }
  if (!m.keep(0)) return;
  // frayed hems: shirt, right sleeve, left trouser leg
  { const hemAt = a => lerp(1.31, 1.02, sstep(1.6, 2.4, Math.abs(aw(a)))) + .022 * Math.sin(a * 7) + .012 * Math.sin(a * 13 + 1); fringe(m, Array.from({ length: 13 }, (_, i) => { const a = -.2 + i * .24; return torsoPt(a, hemAt(a) + .004, .012, L); }), torsoSkin, 151, .035); }
  fringe(m, Array.from({ length: 9 }, (_, i) => { const a = i / 9 * TAU, y = 1.27 + .035 * Math.sin(a * 5 + 1) + .018 * Math.sin(a * 11), r = radAt(ARM_LEAN, y) + .012; return [.2 + r * Math.sin(a), y + .003, -r * 1.05 * Math.cos(a)]; }), B.UAR, 157, .03);
  fringe(m, Array.from({ length: 11 }, (_, i) => { const a = i / 11 * TAU, y = .4 + .05 * Math.sin(a * 6 + 1) + .03 * Math.sin(a * 13), r = radAt(LEG, y) * 1.08 + .015; return [-.1 + r * Math.sin(a), y + .004, .004 - r * 1.04 * Math.cos(a)]; }), legSkin(-1), 163, .045);
  // tears in the trousers: the cloth peeled open, a dark gap, skin and muscle showing, frayed lips
  for (const [s, a0, y0] of [[1, -.25, .72], [1, 2.7, .86], [-1, .35, .66]]) {
    const k = s < 0 ? 1.08 : 1, lp = (u, v, h) => { const r = radAt(LEG, v) * k + h; return [s * .1 + r * Math.sin(u), v, .004 - r * 1.04 * Math.cos(u)]; };
    muscle(m, (u, v, h) => lp(u, v, h + .006), a0 - .22, a0 + .22, y0 - .035, y0 + .035, legSkin(s), 170 + a0 * 10, 4);
    panel(m, (u, v, h) => lp(u, v, h + .016), a0 - .3, a0 + .3, u => y0 - .05 - .03 * (1 - ((u - a0) / .3) ** 2), y0 - .038, { t: .003, nu: 5, nv: 2, slot: S.CLOTH2, skin: legSkin(s), out: (x, y, z) => [x - s * .1, 0, z], edge: .2, round: .2 });
    fringe(m, [-.2, -.1, 0, .1, .2].map(d => lp(a0 + d, y0 + .04 + .006 * Math.sin(d * 30), .017)), legSkin(s), 180 + a0 * 7, .02);
  }
  // burst outer seam on the left thigh: a split with the swollen leg bulging through, threads across
  { const lp = (u, v, h) => { const r = radAt(LEG, v) * 1.08 + h; return [-.1 + r * Math.sin(u), v, .004 - r * 1.04 * Math.cos(u)]; };
    m.ell(lp(-1.57, .8, .006), [.012, .06, .022], { slot: S.CLOTH, skin: legSkin(-1), nu: 8, nv: 6, ao: .8 });
    for (const y of [.76, .79, .82, .85]) m.tube([lp(-1.75, y, .016), lp(-1.57, y + .004, .021), lp(-1.39, y, .016)], .0013, { slot: S.CLOTH2, skin: legSkin(-1), sides: 3, n: 5, cap: false }); }
  // a blank unit patch torn half off the right sleeve, hanging by a corner
  { const M = T(.287, 1.36, .02, 0, Math.PI / 2, .5); m.box([0, -.022, 0], [.05, .044, .003], .006, { slot: S.RUBBER, skin: B.UAR, m: M }); m.tube([[.287, 1.375, .045], [.288, 1.39, .02]], .0012, { slot: S.CLOTH2, skin: B.UAR, sides: 3, n: 3, cap: false }); }
}

// ---------------------------------------------------------------- broken chest rig detail, the tank and pack frame on the back, the mask hose and cables
function rigDetail(m) {
  const L = m.lod === 2 ? 0 : 1, on = (u, v, h) => torsoPt(u, v + (u - .4) * .07, h + .032, L);
  if (m.keep(0)) {
    // cracks across the carrier panel
    for (const c of [[[.08, 1.34], [.2, 1.29], [.26, 1.31], [.38, 1.24]], [[.55, 1.35], [.5, 1.28], [.58, 1.22]], [[.7, 1.13], [.62, 1.19]]]) m.tube(c.map(([u, v]) => on(u, v, .0235)), .0013, { slot: S.VISOR, skin: torsoSkin, sides: 3, n: 8, cap: false });
  }
  if (m.keep(1)) {
    // a third pouch hanging open: its flap fallen down, a magazine sticking out
    const p = on(.38, 1.27, .03), M = T(p[0], p[1], p[2], .1, Math.PI - .38, .12);
    m.box([0, 0, 0], [.06, .06, .028], .008, { slot: S.RUBBER, skin: torsoSkin, m: M });
    m.box([0, -.045, .018], [.058, .036, .006], .004, { slot: S.CLOTH2, skin: torsoSkin, m: M.clone().multiply(T(0, 0, 0, -.5, 0, 0)) });
    m.box([0, .042, -.002], [.03, .05, .014], .003, { slot: S.METAL, skin: torsoSkin, m: M.clone().multiply(T(0, 0, 0, 0, 0, .25)) });
  }
  // pack frame on the back (one rail snapped), a dented tank strapped to it, cables
  const bp = (a, y, h) => torsoPt(a, y, h, L), rail = s => [1.04, 1.16, 1.28, 1.36].map(y => bp(Math.PI - s * .55, y, .05));
  for (const s of [-1, 1]) { const r = rail(s); if (s < 0) r.pop(); m.tube(r, .0085, { slot: S.METAL, skin: torsoSkin, sides: m.keep(1) ? 6 : 4, n: m.seg(10, 4), cap: true }); }
  m.tube([bp(Math.PI - .55, 1.13, .05), bp(Math.PI, 1.13, .075), bp(Math.PI + .55, 1.13, .05)], .007, { slot: S.METAL, skin: torsoSkin, sides: m.keep(1) ? 6 : 4, n: m.seg(8, 3), cap: true });
  if (m.keep(1)) m.tube([bp(Math.PI + .55, 1.3, .05), bp(Math.PI + .3, 1.34, .085), [bp(Math.PI + .15, 1.36, .1)[0], 1.33, bp(Math.PI + .15, 1.36, .1)[2]]], .006, { slot: S.METAL, skin: torsoSkin, sides: 5, n: 6, cap: true });     // the snapped cross bar
  const tc = bp(Math.PI - .5, 1.22, .1), TM = T(tc[0], tc[1], tc[2], 0, 0, -.18);
  m.revolve([[.002, .12], [.025, .118], [.04, .105], [.046, .08], [.046, -.04], [.04, -.05], [.046, -.06], [.046, -.1], [.04, -.112], [.002, -.115]], { sides: m.seg(14, 7), slot: S.METAL, skin: torsoSkin, m: TM, crease: 45 });      // the dent is the notch in the profile
  if (m.keep(1)) { m.revolve([[.002, .14], [.012, .14], [.014, .118]], { sides: 8, slot: S.RUBBER, skin: torsoSkin, m: TM, crease: 40 }); for (const y of [.05, -.085]) m.revolve([[.0465, .007], [.049, .004], [.049, -.004], [.0465, -.007]], { sides: 12, slot: S.RUBBER, skin: torsoSkin, m: TM.clone().multiply(T(0, y, 0)), crease: 50 }); }
  // hose from the mask's voicemitter over the right shoulder to the tank, corrugated
  const tt = new THREE.Vector3(0, .14, 0).applyMatrix4(TM);
  m.tube([skullP(0, -.5, .03, L), [.06, 1.53, -.17], [.17, 1.52, -.08], [.19, 1.5, .08], [tt.x, tt.y + .02, tt.z]], .011, { slot: S.RUBBER, skin: (x, y) => (y > 1.56 ? [B.HEA, .6, B.NEC, .4] : [B.CHE, 1]), sides: m.keep(1) ? 6 : 4, n: m.seg(18, 6), ribs: m.keep(0) ? 16 : 0, ribDepth: .2 });
  if (m.keep(0)) for (const [dx, l] of [[.02, .16], [-.015, .22]]) m.tube([[tc[0] + dx, tc[1] - .1, tc[2]], [tc[0] + dx * 2, tc[1] - .1 - l * .5, tc[2] + .02], [tc[0] + dx * 3, tc[1] - .1 - l, tc[2] + .01]], .0022, { slot: S.RUBBER, skin: torsoSkin, sides: 3, n: 8, cap: true });
}

// ---------------------------------------------------------------- hands and arms detail
function limbDetail(m) {
  if (m.keep(1)) {
    // bony spurs at the elbows
    for (const [s, a, y, k] of [[-1, Math.PI + .35, 1.18, 1], [-1, Math.PI - .05, 1.15, .8], [-1, Math.PI + .7, 1.21, .7], [1, Math.PI - .3, 1.16, .6]]) { const R = s < 0 ? ARM_BIG : ARM_LEAN, r = radAt(R, y) - .004, p = [s * .2 + r * Math.sin(a), y, -r * 1.05 * Math.cos(a)]; m.revolve([[.002, .03 * k], [.006, .018 * k], [.012, 0], [.013, -.006]], { sides: 5, slot: S.PLATE, skin: s < 0 ? B.FAL : B.FAR, m: faceTo(p, [Math.sin(a), -.25, -Math.cos(a)]), crease: 50 }); }
    // dirty bandage wound round the right forearm, a loose end
    m.tube(Array.from({ length: 30 }, (_, i) => { const t = i / 29, a = t * TAU * 4.2, y = lerp(1.1, .94, t), r = radAt(ARM_LEAN, y) + .006; return [.2 + r * Math.sin(a), y, -r * 1.05 * Math.cos(a)]; }), .0085, { slot: S.PLATE, skin: armSkin(1), sides: 4, flat: .25, n: 60, cap: true, up: [0, 1, 0] });
    m.tube([[.25, .95, .01], [.262, .91, .02], [.258, .87, .03]], .008, { slot: S.PLATE, skin: B.FAR, sides: 3, flat: .25, n: 4, cap: true });
  }
  if (!m.keep(0)) return;
  // knuckle growths and thick cracked nails on the big left hand
  seed = 191; for (const z of [-.037, -.016, .006, .026]) { const r = .008 + .005 * rnd(); m.ell([-.226, .81 + .004 * rnd(), z], [r * .8, r, r], { slot: S.TEAM, skin: B.HAL, nu: 6, nv: 4, ao: .85 }); }
  // the right hand: a glove torn off two fingertips, nails showing
  for (const [z, L] of [[-.037, .044], [-.016, .05]]) { const p = [.2 - .044, .8 - L * 1.4, z - .006]; m.ell(p, [.0105, .009, .0105], { slot: S.TEAM, skin: B.HAR, nu: 7, nv: 5 }); m.ell([p[0] - .003, p[1] - .004, p[2]], [.006, .004, .0065], { slot: S.PLATE2, skin: B.HAR, nu: 5, nv: 3 }); }
  m.tube([[.226, .875, -.02], [.236, .86, .0], [.232, .845, .02]], .004, { slot: S.RUBBER, skin: B.HAR, sides: 3, flat: .3, n: 4, cap: true });      // the torn cuff flap
}

// ---------------------------------------------------------------- the left boot split open by the swollen foot, toes and claws out; knee pad straps cutting in
function footDetail(m) {
  if (m.keep(1)) {
    m.box([-.1, .032, -.18], [.07, .02, .02], .006, { slot: S.RUBBER, skin: B.FOL, m: null });
    seed = 211; for (let i = 0; i < 4; i++) { const x = -.128 + i * .019, r = .011 + .003 * rnd(); m.ell([x, .04, -.196 - .004 * rnd()], [r, r * .85, r * 1.2], { slot: S.TEAM, skin: B.FOL, nu: 7, nv: 5, ao: .7 }); m.tube([[x, .036, -.208], [x, .026, -.226], [x + .002, .012, -.236]], t => .005 * (1 - .8 * t), { slot: S.PLATE, skin: B.FOL, sides: 4, n: 4, cap: true }); }
    // knee pad straps biting into the right trouser leg, cloth bulging between
    for (const y of [.43, .585]) { const r = radAt(LEG, y) + .012; m.revolve([[r, .009], [r + .004, .005], [r + .004, -.005], [r, -.009]], { sides: 14, slot: S.RUBBER, skin: y > .52 ? B.THR : B.SHR, m: T(.1, y, .004), crease: 50 }); for (const d of [-.016, .016]) m.revolve([[r + .002, .006], [r + .006, 0], [r + .002, -.006]], { sides: 14, slot: S.CLOTH2, skin: y > .52 ? B.THR : B.SHR, m: T(.1, y + d, .004), crease: 180 }); }
  }
}

// ---------------------------------------------------------------- skull: bony ridges, the mask straps sunk into swollen flesh
function headDetail(m) {
  if (!m.keep(1)) return;
  const L = 1;
  // a bony ridge running off-centre over the crown and down the left temple
  seed = 231; for (let i = 0; i < 6; i++) { const lon = -.25 - i * .22, lat = 1.25 - i * .14, p = skullP(lon, lat, -.002, L), q = skullP(lon, lat, .02, L), k = .7 + .5 * rnd(); m.revolve([[.002, .016 * k], [.009, .009 * k], [.016, 0], [.017, -.006]], { sides: 6, slot: S.PLATE, skin: B.HEA, m: faceTo(p, [q[0] - p[0], q[1] - p[1], q[2] - p[2]]).multiply(T(0, 0, 0, 0, 0, 0, 1, 1, .55)), crease: 50 }); }
  if (!m.keep(0)) return;
  // flesh swelling over the mask straps on both sides of each strap
  for (const lat of [.32, -.32]) for (const d of [.03, -.03]) for (const u of [1.3, 1.9, 2.5, -1.3]) { if (lat > 0 && u < 0) continue; const p = skullP(u, lat + d, .004, L); m.ell(p, [.012, .007, .012], { slot: S.CLOTH, skin: lat < 0 ? headSk : B.HEA, nu: 6, nv: 4, ao: .8 }); }
  // surgical staples over the left temple
  for (let i = 0; i < 5; i++) { const lon = -1.45 + i * .07, lat = .45 - i * .05, p = skullP(lon, lat, .002, L), q = skullP(lon, lat, .02, L); m.box([0, .0008, 0], [.012, .0016, .0024], .0004, { slot: S.METAL, skin: B.HEA, m: faceTo(p, [q[0] - p[0], q[1] - p[1], q[2] - p[2]], [0, 1, 0]) }); }
}

const PARTS = [
  torso, arms, legs, shirt, carrier, head, mask,
  m => { for (const s of [-1, 1]) buildGlove(m, s, { slot: s > 0 ? S.RUBBER : S.TEAM, slotCuff: S.CLOTH2, guard: false, cuff: false }); },
  sickSkin, bodyDetail, uniformDetail, rigDetail, limbDetail, footDetail, headDetail,
  m => { for (const s of [-1, 1]) buildBoot(m, s, { slot: S.RUBBER, slotToe: S.RUBBER, slotRand: S.RUBBER, slotSole: S.RUBBER, slotMid: S.RUBBER, slotTongue: S.CLOTH2, slotPanel: S.RUBBER, slotLace: S.CLOTH2 }); },
];
const SET = defineOutfitSet(SETS, PARTS, [], null, ['torso', 'arms', 'legs', 'shirt', 'carrier', 'head', 'mask', 'hands', 'sick', 'body+', 'uniform+', 'rig+', 'limbs+', 'feet+', 'head+', 'feet']);

// ---------------------------------------------------------------- brute scale, attach
let scaled = null;
const scaleGeo = g => { const c = g.clone(), p = c.attributes.position, nr = c.attributes.normal; for (let i = 0; i < p.count; i++) { p.setXYZ(i, p.getX(i) * SCALE[0], p.getY(i) * SCALE[1], p.getZ(i) * SCALE[2]); let x = nr.getX(i) / SCALE[0], y = nr.getY(i) / SCALE[1], z = nr.getZ(i) / SCALE[2]; const l = Math.hypot(x, y, z) || 1; nr.setXYZ(i, x / l, y / l, z / l); } c.boundingSphere = g.boundingSphere.clone(); c.boundingSphere.radius *= 1.24; c.boundingBox = g.boundingBox.clone(); return c; };
/** Builds the mutant in small steps (await yieldFn() between parts). */
export async function prepareZombies(yieldFn) {
  if (scaled) return scaled;
  const a = await SET.prepareOutfits(yieldFn); if (scaled) return scaled;
  const geos = []; for (const g of a.geos) { geos.push(scaleGeo(g)); if (yieldFn) await yieldFn(); }
  scaled = { geos, detail: null, cloth: null };
  return scaled;
}
const nextFrame = () => new Promise(r => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 16)));
let building = null;
/** The look of a zombie of this type, or null. Not built yet: a placeholder keeps the stock zombie body and dresses it once the build (one step per frame) ends. */
export function zombieSkin(sol, zombieType, opts = {}) {
  if (zombieType !== MUTANT_TYPE || !sol || sol.kind !== 'zombie') return null;
  const A = sol._dbg && sol._dbg.A; if (!A) return null;
  if (!A.gunGeo) { const g = new THREE.BufferGeometry(); for (const k in A.geo.attributes) g.setAttribute(k, A.geo.attributes[k]); g.setIndex(A.geo.index); g.setDrawRange(0, 0); g.boundingSphere = A.geo.boundingSphere; g.boundingBox = A.geo.boundingBox; A.gunGeo = g; }      // the stock body is hidden while the mutant is on
  const mat = outfitMaterial('mutant-brute', PAL, -1), far = outfitMaterial('mutant-brute', PAL, -1, true);
  if (scaled) return attachInstance(sol, scaled, mat, opts.lod ?? -1, far);
  if (!building) building = prepareZombies(nextFrame);
  let real = null, dead = false;
  return { pending: true, rank: 0,
    update(dt) { if (dead) return; if (!real && scaled) real = attachInstance(sol, scaled, mat, opts.lod ?? -1, far); if (real) real.update(dt); },
    reset() { if (real) real.reset(); }, dispose() { dead = true; if (real) real.dispose(); real = null; },
    get lod() { return real ? real.lod : -1; }, get mesh() { return real ? real.mesh : null; }, get skeleton() { return real ? real.skeleton : null; }, get real() { return real; } };
}
export const mutantTriangles = () => SET.outfitTriangles();
void clamp;
