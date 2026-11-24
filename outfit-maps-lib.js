// outfit-maps-lib.js — FRONT ZÉRO: shared geometry helpers of the map-themed outfits (outfit-map-<map>.js). Built on outfit-kit.js, which stays untouched:
// garments lofted from height tables (with folds where cloth really folds), surface maps to lay pockets and tapes on them, padded sweeps, laid rope,
// small hardware. No material, no state: every outfit keeps the kit's shader program and LODs.
// Conventions (bind pose, model space, as in outfit-kit.js): feet at y=0, front = -Z, the soldier's left = -X; angle a = 0 at the front, + toward his right.
import * as THREE from 'three';
import { BONE as B, SLOT as S, T, lerp, clamp, sstep, blend2, torsoSkin, legSkin, panel, stitchLine, chaikin } from './outfit-kit.js';

export const TAU = Math.PI * 2;
/** Smooth bump: 1 at c, 0 beyond c ± w. */
export const bump = (x, c, w) => { const t = (x - c) / w; return t <= -1 || t >= 1 ? 0 : (1 - t * t) ** 2; };
const sgnPow = (v, p) => Math.sign(v) * Math.abs(v) ** p;

/** Superellipse ring at height y (exponent e, 2 = ellipse); disp(a, y) -> relative change of the radius. */
export function ringAt(n, cx, y, cz, rx, rz, e = 2.4, disp = null, warp = null) {
  const o = [], p = 2 / e;
  for (let i = 0; i < n; i++) { const a = i / n * TAU, d = disp ? 1 + disp(a, y) : 1; o.push([cx + rx * d * sgnPow(Math.sin(a), p), warp ? y + warp(a, y) : y, cz - rz * d * sgnPow(Math.cos(a), p)]); }
  return o;
}
/** Row of a height table [[y, rx, rz, cz], ...] (ascending y) at height y, linear between rows. */
export function rowAt(rows, y) {
  if (y <= rows[0][0]) return rows[0];
  for (let i = 0; i < rows.length - 1; i++) { const a = rows[i], b = rows[i + 1]; if (y <= b[0]) { const t = (y - a[0]) / (b[0] - a[0]); return a.map((v, k) => lerp(v, b[k] ?? v, t)); } }
  return rows[rows.length - 1];
}
/** A pin, or a list of pins, as one point transform (p, lod) -> p. */
const pinOf = pin => !pin ? null : Array.isArray(pin) ? (p, lod, dg) => pin.reduce((q, f) => f(q, lod, dg), p) : pin;
/** A garment (or body part) as one loft through a height table. o: n (points per ring), e, disp(a, y), cx, slot, skin, ao, capA, capB, out, sub (extra rows between rows at LOD0),
 *  pin (beltPin or a list: keeps the garment under the belts). rows.warp(a, y) (set by blouseRows) lowers the rings where a belt sags. */
export function garment(m, rows, o = {}) {
  const n = m.seg(o.n ?? 24, 8), e = o.e ?? 2.4, cx = o.cx ?? 0, disp = m.lod === 2 && !o.keepDisp ? null : o.disp, k = m.lod === 2 ? .45 : m.lod === 1 ? .8 : 1;
  const d = disp ? (a, y) => disp(a, y) * k : null;
  let R = rows;
  if (m.lod === 0 && o.sub) { R = []; for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < o.sub; j++) R.push(rowAt(rows, lerp(rows[i][0], rows[i + 1][0], j / o.sub))); R.push(rows[rows.length - 1]); }
  else if (m.lod === 2 && rows.length > 6) R = rows.filter((_, i) => i % 2 === 0 || i === rows.length - 1);
  const ox = o.ox ?? (() => cx), oz = row => row[3] ?? 0, warp = rows.warp, pin = pinOf(o.pin);
  return m.loft(R.map(r => { const ring = ringAt(n, typeof ox === 'function' ? ox(r[0]) : ox, r[0], oz(r), r[1], r[2], e, d, warp); return pin ? ring.map(q => pin(q, m.lod)) : ring; }), { slot: o.slot ?? S.CLOTH, skin: o.skin ?? torsoSkin, crease: 180, capA: !!o.capA, capB: !!o.capB, out: o.out ?? ((x, y, z) => [x - cx, 0, z]), ao: o.ao });
}
/** Surface map of a garment: (a, y, h) -> point at angle a and height y, h above its surface (folds included). */
export function garmentMap(rows, o = {}) {
  const e = o.e ?? 2.4, p = 2 / e, cx = o.cx ?? 0, disp = o.disp, warp = rows.warp, pin = pinOf(o.pin);
  return (a, y, h = 0) => { const r = rowAt(rows, y), d = disp ? 1 + disp(a, y) : 1, q = [cx + (r[1] * d + h) * sgnPow(Math.sin(a), p), warp ? y + warp(a, y) : y, (r[3] ?? 0) - (r[2] * d + h) * sgnPow(Math.cos(a), p)]; return pin ? pin(q, 0) : q; };
}
/** Arm sleeve map: u around the arm (0 = outside, PI/2 = back), v = height. Leg map: u around the leg (0 = front, + toward the outside). */
export const armMap = (s, R) => (u, v, h = 0) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .2 + s * r * Math.cos(u), v, r * Math.sin(u)]; };
export const legMap = (s, R, cz = .003) => (u, v, h = 0) => { const r = (typeof R === 'function' ? R(u, v) : R) + h; return [s * .1 + s * r * Math.sin(u), v, cz - r * Math.cos(u)]; };

/** A band around a garment (tape, team band, hem): angles a0..a1 (full turn when omitted), centred at height y, width w, raised by h0 then t. */
export function bandOn(m, map, y, w, o = {}) {
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU, full = Math.abs(a1 - a0) >= TAU - 1e-6, nu = m.seg(o.n ?? 32, 10), h0 = o.h0 ?? .0015, t = o.t ?? .0016;
  const prof = [[-.5, 0], [-.5, 1], [.5, 1], [.5, 0]];
  return m.grid(nu, 3, (u, v) => { const j = Math.round(v * 3), q = prof[j], a = lerp(a0, a1, u), yy = (o.slope ? o.slope(a) : 0) + y + q[0] * w; return map(a, yy, h0 + q[1] * t); }, { wrapU: full, slot: o.slot ?? S.ACCENT, skin: o.skin ?? torsoSkin, crease: 50, out: o.out, ao: o.ao, noEdge: o.noEdge });
}

/** Padded band swept along a path laid on a surface: rounded-rectangle section (exponent e) of width w(t) and thickness th(t), its inner face on the path,
 *  rounded ends in plan. out(x, y, z) -> outward direction. o: slot, skin, k (section points), e, puff (pillow on the outer face), ends (false: square ends). */
export function padSweep(m, path, w, th, out, o = {}) {
  const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', o.tension ?? .5), L = curve.getLength();
  const W = typeof w === 'function' ? w : () => w, H = typeof th === 'function' ? th : () => th, K = m.seg(o.k ?? 14, 6), p = 2 / (o.e ?? 3.2), puff = o.puff ?? .25;
  const step = (o.step ?? .022) * (m.lod === 0 ? 1 : m.lod === 1 ? 1.8 : 3), us = [], ends = o.ends !== false, bead = m.lod === 0 ? (o.bead ?? 0) : 0;
  const cap0 = ends ? W(0) / 2 : 0, cap1 = ends ? W(1) / 2 : 0, nm = Math.max(2, Math.ceil(L / step));
  if (ends) { const ne = m.lod === 0 ? 5 : 3; for (let i = 0; i < ne; i++) us.push((1 - Math.cos(i / ne * Math.PI / 2)) * cap0 / L); }
  for (let i = 0; i <= nm; i++) { const u = lerp(cap0 / L, 1 - cap1 / L, i / nm); us.push(u); }
  if (ends) { const ne = m.lod === 0 ? 5 : 3; for (let i = ne - 1; i >= 0; i--) us.push(1 - (1 - Math.cos(i / ne * Math.PI / 2)) * cap1 / L); }
  const V = [], F = [], T0 = new THREE.Vector3(), N = new THREE.Vector3(), X = new THREE.Vector3(), P = new THREE.Vector3();
  for (const u of us) {
    curve.getPointAt(clamp(u, 0, 1), P); curve.getTangentAt(clamp(u, 0, 1), T0); const d = out(P.x, P.y, P.z); N.set(d[0], d[1], d[2]); N.addScaledVector(T0, -N.dot(T0)).normalize(); X.crossVectors(T0, N);
    const dl = u * L, de = Math.min(dl, L - dl), cap = dl < L / 2 ? cap0 : cap1, f = cap > 0 && de < cap ? Math.sqrt(Math.max(0, 1 - ((cap - de) / cap) ** 2)) : 1;
    const ww = W(u) / 2 * Math.max(f, .02), hh = H(u) / 2 * (.45 + .55 * f);
    for (let k = 0; k < K; k++) { const ang = k / K * TAU, ex = sgnPow(Math.cos(ang), p), ey = sgnPow(Math.sin(ang), p), up = ey > 0 ? ey * (1 + puff * (1 - ex * ex)) : ey * .9; const sx = ex * (ww + ((k === 0 || k * 2 === K) && f > .5 ? bead : 0)), sy = hh + up * hh; V.push([P.x + X.x * sx + N.x * sy, P.y + X.y * sx + N.y * sy, P.z + X.z * sx + N.z * sy]); }
  }
  const R = us.length;
  for (let i = 0; i < R - 1; i++) for (let k = 0; k < K; k++) { const a = i * K + k, b = i * K + (k + 1) % K, c = a + K, e = b + K; F.push(a, b, c, b, e, c); }
  for (const i of [0, R - 1]) { const c = V.length; let x = 0, y = 0, z = 0; for (let k = 0; k < K; k++) { const q = V[i * K + k]; x += q[0]; y += q[1]; z += q[2]; } V.push([x / K, y / K, z / K]); for (let k = 0; k < K; k++) F.push(c, i * K + k, i * K + (k + 1) % K); }
  const smp = Array.from({ length: 24 }, (_, i) => curve.getPointAt(i / 23));
  return m.surf(V, F, { slot: o.slot ?? S.PLATE, skin: o.skin ?? torsoSkin, crease: o.crease ?? 70, ao: o.ao, out: (cx, cy, cz) => { let q = smp[0], bd = 1e9; for (const r of smp) { const dd = (r.x - cx) ** 2 + (r.y - cy) ** 2 + (r.z - cz) ** 2; if (dd < bd) { bd = dd; q = r; } } const qq = [cx - q.x, cy - q.y, cz - q.z]; return qq[0] * qq[0] + qq[1] * qq[1] + qq[2] * qq[2] > 1e-10 ? qq : out(q.x, q.y, q.z); } });
}

/** Frames along a path (point, tangent, normal, binormal) at n+1 spaced points; up = hint for the normal. */
export function frames(path, n, up = [0, 1, 0], closed = false, tension = .5) {
  const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(p[0], p[1], p[2])), closed, 'catmullrom', tension), P = curve.getSpacedPoints(n), out = [];
  const nn = new THREE.Vector3(up[0], up[1], up[2]);
  for (let i = 0; i <= n; i++) {
    const t = new THREE.Vector3().subVectors(P[Math.min(i + 1, n)], P[Math.max(i - 1, 0)]).normalize(); nn.addScaledVector(t, -nn.dot(t)); if (nn.lengthSq() < 1e-8) nn.set(t.y, t.z, t.x); nn.normalize();
    out.push({ p: P[i].clone(), t, n: nn.clone(), b: new THREE.Vector3().crossVectors(t, nn) });
  }
  return { F: out, L: curve.getLength() };
}
/** Laid rope: at close range three strands twisted round the core (helix of pitch `lay`), each a little proud of it. */
export function ropeStrands(m, path, r, o = {}) {
  const lay = o.lay ?? r * 7, { F: fr, L } = frames(path, Math.max(8, Math.ceil((o.L ?? 0.4) / (lay / 7))), o.up, !!o.closed), n = fr.length - 1;
  for (let j = 0; j < 3; j++) {
    const pts = []; for (let i = 0; i <= n; i++) { const f = fr[i], ph = j / 3 * TAU + (i / n) * L / lay * TAU, c = Math.cos(ph) * r * .52, s = Math.sin(ph) * r * .52; pts.push([f.p.x + f.n.x * c + f.b.x * s, f.p.y + f.n.y * c + f.b.y * s, f.p.z + f.n.z * c + f.b.z * s]); }
    m.tube(pts, r * .56, { slot: o.slot ?? S.PLATE2, skin: o.skin ?? 0, sides: 4, n: pts.length, cap: false, crease: 70, tension: .5 });
  }
}
/** Apply a Matrix4 (elements) to a point. */
export const xf = (M, p) => { const e = M.elements; return [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]]; };
/** Local frame on the body at angle a (0 = front): Z outward, Y up, X along the surface (to the right of someone facing that surface); origin p. */
export function bodyFrame(p, a, tilt = 0) {
  const X = new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a)), Z = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)), Y = new THREE.Vector3(0, 1, 0);       // right-handed: X = Y x Z
  if (tilt) { Y.applyAxisAngle(X, tilt); Z.applyAxisAngle(X, tilt); }
  return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p[0], p[1], p[2]);
}
/** Snap or press stud: a low dome on a ring. */
export function stud(m, p, n, o = {}) {
  const r = o.r ?? .0042, M = new THREE.Matrix4(), Y = new THREE.Vector3(n[0], n[1], n[2]).normalize(), X = new THREE.Vector3(0, 1, 0).cross(Y); if (X.lengthSq() < 1e-6) X.set(1, 0, 0); X.normalize(); const Z = new THREE.Vector3().crossVectors(X, Y);
  M.makeBasis(X, Y, Z).setPosition(p[0], p[1], p[2]);
  m.revolve([[.0003, r * .55], [r * .55, r * .48], [r * .9, r * .3], [r, 0]], { sides: m.keep(0) ? 10 : 6, slot: o.slot ?? S.METAL, skin: o.skin ?? 0, m: M, crease: 50 });
}
/** Sleeve weights with a wider elbow blend than the kit's arm (less pinching when the arm folds at the elbow). */
export const sleeveSkin = (s, w = .07) => { const U = s < 0 ? B.UAL : B.UAR, F = s < 0 ? B.FAL : B.FAR, H = s < 0 ? B.HAL : B.HAR; return (x, y) => y > 1.0 ? blend2(F, U, y, 1.16, w) : blend2(H, F, y, .895, .012); };
/** Dark lining inside a sleeve round the elbow: where a sharp bend turns the sleeve inside out, the lining shows instead of a hole. */
export function elbowLiner(m, s, rows, slot = S.CLOTH2, y0 = 1.04, y1 = 1.29) {
  if (m.lod === 2) return;
  const R = rows.filter(r => r[0] >= y0 && r[0] <= y1).map(r => [r[0], r[1] * .93, r[2] * .93, r[3] ?? 0]);
  if (R.length >= 2) garment(m, R, { n: 12, e: 2.05, cx: s * .2, slot, skin: sleeveSkin(s), out: (x, y, z) => [-(x - s * .2), 0, -z], ao: .35 });
}
/** Weights of a skirt or hem hung from the pelvis that follows the thighs a little toward its lower edge, so a stride does not push a leg through it. */
export function skirtSkin(yTop = .99, yLow = .82, kMax = .55) {
  return (x, y) => {
    const k = sstep(yTop, yLow, y) * kMax; if (k < .01) return torsoSkin(x, y);
    const l = sstep(.05, -.05, x), out = [B.PEL, 1 - k]; if (l > .01) out.push(B.THL, k * l); if (l < .99) out.push(B.THR, k * (1 - l)); return out;
  };
}
/** Frame of a lens or window: a rounded-rectangle ring (half-sizes rx, ry, exponent e) of radial width w and depth d, in the local XY plane of M (+Z out). */
export function lensFrame(m, M, rx, ry, w, d, o = {}) {
  const n = m.seg(o.n ?? 24, 8), p = 2 / (o.e ?? 3.2), prof = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];       // inner back, outer back, outer front, inner front: outward winding
  const at = (a, k, q) => { const c = Math.cos(a), s = Math.sin(a), r = 1 + (w / Math.max(rx, ry)) * k; return xf(M, [rx * r * sgnPow(c, p), ry * r * sgnPow(s, p), d * q - (o.back ?? 0)]); };
  m.grid(n, 4, (u, v) => { const q = prof[Math.round(v * 4)]; return at(u * TAU, q[0], q[1]); }, { wrapU: true, slot: o.slot ?? S.RUBBER, skin: o.skin ?? 0, crease: 50, out: false });
  if (o.lens !== false) m.grid(n, 1, (u, v) => { const a = u * TAU, k = 1 - v; return xf(M, [rx * k * sgnPow(Math.cos(a), p), ry * k * sgnPow(Math.sin(a), p), d * (o.lensZ ?? .55) - (o.back ?? 0) + (o.bulge ?? 0) * (1 - k * k)]); }, { wrapU: true, capB: false, slot: o.lensSlot ?? S.VISOR, skin: o.skin ?? 0, crease: 180, out: false });
}

// ---------------------------------------------------------------- one-piece lower garment (waders, coveralls, trousers): hips that become legs
/** Both legs of a garment that is ONE surface from the hips down, with no brief-shaped edge: above the crotch each leg is its half of the hip ring
 *  (hip(a, y), a from the front centre round its side to the back centre) closed by the centre seam on x = 0, which the two legs share; through the
 *  gusset the seam opens into the inner thigh and the hips narrow into the thigh tubes; below, the legs follow their own table.
 *  o: hip(a, y) -> point (the body garment's map, so the top ring meets it exactly), yTop (top ring: under a belt, or where the body garment ends),
 *  yCrotch (where the legs part), yThigh (plain tubes below), LG ([[y, r, rz, cz]], legs at x = +-.1), e (leg exponent), lgDisp(a, y), n (points of
 *  the full hip ring, as the body garment uses), folds (amplitude of the drag folds radiating from the crotch), pin, slot, ao.
 *  The skin keeps the seam on the pelvis and gives the outer thigh to the thigh bone, so a stride bends the garment instead of opening it. */
export function legsFromHips(m, o) {
  const yTop = o.yTop, yC = o.yCrotch ?? .9, yT = o.yThigh ?? .76, LG = o.LG, p = 2 / (o.e ?? 2.1), lgD = o.lgDisp, pin = pinOf(o.pin), folds = o.folds ?? .02;
  const nh = Math.max(4, Math.round(m.seg(o.n ?? 30, 8) / 2)), ns = Math.max(3, Math.round(nh * .55));
  // heights: dense through the gusset, then the leg table's own rows
  const step = m.lod === 0 ? .02 : m.lod === 1 ? .04 : .07, ys = [];
  for (let y = yTop; y > yT + 1e-4; y -= step) ys.push(y);
  ys.push(yT); for (const r of [...LG].reverse()) if (r[0] < yT - .01) ys.push(r[0]);
  const Y = m.lod === 2 ? ys.filter((y, i) => y >= yT - .001 || i % 2 === 0 || i === ys.length - 1) : ys;
  for (const s of [-1, 1]) {
    const ring = y => {
      const w = sstep(yC + .05, yT, y), wi = sstep(yC + .015, yT + .03, y), r = rowAt(LG, y), pts = [];
      const thigh = (phi, h = 0) => { const a = s * phi, d = lgD ? 1 + lgD(a, y) * (m.lod === 2 ? .45 : 1) : 1, rr = r[1] * d + h, rz = (r[2] ?? r[1]) * d + h;
        return [s * .1 + rr * sgnPow(Math.sin(a), p), y, (r[3] ?? 0) - rz * sgnPow(Math.cos(a), p)]; };
      const fold = phi => folds * Math.sin(phi * 3 + y * 34) * bump(y, yC - .02, .07) * (m.lod === 2 ? .4 : 1);
      for (let j = 0; j <= nh; j++) {          // hip half: front centre, round the side, back centre -> thigh from front-inner to back-inner
        const a = j / nh * Math.PI, H = o.hip(s * a, y), phi = lerp(-.55, Math.PI + .55, j / nh), T = thigh(phi, fold(phi) * r[1]);
        pts.push([lerp(H[0], T[0], w), y, lerp(H[2], T[2], w)]);
      }
      const F = o.hip(0, y), Bk = o.hip(Math.PI, y);
      for (let j = 1; j < ns; j++) {           // centre seam, back to front -> inner thigh
        const t = j / ns, phi = lerp(Math.PI + .55, TAU - .55, t), T = thigh(phi), H = [0, y, lerp(Bk[2], F[2], t)];
        pts.push([lerp(H[0], T[0], wi), y, lerp(H[2], T[2], wi)]);
      }
      return pin ? pts.map(q => pin(q, m.lod)) : pts;
    };
    const skin = (x, y) => { if (y < .75) return legSkin(s)(x, y); const k = sstep(.99, .84, y) * clamp(s * x / .07, 0, 1) ** .7, TH = s < 0 ? B.THL : B.THR; return k <= .01 ? [B.PEL, 1] : k >= .99 ? [TH, 1] : [B.PEL, 1 - k, TH, k]; };
    m.loft(Y.map(ring), { slot: o.slot ?? S.CLOTH2, skin, crease: 70, capB: true, ao: o.ao, out: (x, y, z) => [x - s * .1 * sstep(1.0, .8, y), y < .2 ? -.3 : 0, z - .004] });
  }
}

// ---------------------------------------------------------------- jacket skirt and belt (below the waist of a hip-length garment)
/** Skirt of a hip-length jacket, from under the belt to the hem: a rounded flare over hips and seat, soft vertical drape deepening toward the hem,
 *  front and back panels with side vents (the back panel laps over the front above the vent), a lining, a rolled hem, an optional tape near the hem.
 *  o: y0 (top), y1 (hem), r0 [rx, rz], r1 [rx, rz], cz, e, fold, sag (front/back hem dip), vent (height of the vents, 0 = none), slot, lining, hemR,
 *  tape { y, w, slot } and kMax (how much the hem follows the thighs). Returns map(a, y, h) on the outer surface (for pockets, flaps, tapes). */
function skirtGeo(o, lod = 0) {
  const y0 = o.y0 ?? .99, y1 = o.y1 ?? .85, r0 = o.r0 ?? [.172, .132], r1 = o.r1 ?? [.192, .152], cz = o.cz ?? .004, p = 2 / (o.e ?? 2.15), fold = (o.fold ?? .028) * (lod === 2 ? .35 : 1), sag = o.sag ?? .008, back = o.backDrop ?? 0, rise = o.sideRise ?? 0, flare = o.flare ?? .45;       // flare: share of the height over which it clears the hips
  const vOf = y => clamp((y0 - y) / (y0 - y1), 0, 1);
  // coarse LODs: few rows cut straight across the flare under the belt and would stand outside the fine skirt (LOD2 casts the shadows: dark blotches
  // on LOD0); they are drawn a little inside there instead
  const dent = v => (lod === 2 ? (o.dent2 ?? .012) : lod === 1 ? (o.dent1 ?? .006) : 0) * bump(v, o.dentV ?? .3, .3);
  const pin = pinOf(o.pin), point = pin ? (a, v, h) => pin(point0(a, v, h - dent(v)), lod, h < 0 ? -h : -h * .5) : (a, v, h) => point0(a, v, h - dent(v));       // inner layers (lining) pinned deeper
  const point0 = (a, v, h) => {       // the drape deepens toward the hem, and its outward folds hang a little lower: the hem undulates
    const w = sstep(0, flare, v) * .82 + .18 * v, rx = lerp(r0[0], r1[0], w), rz = lerp(r0[1], r1[1], w), wave = .6 * Math.sin(a * 5 + .5) + .4 * Math.sin(a * 9 - 1.2), f = 1 + fold * v ** 1.3 * wave, c = Math.cos(a), sn = Math.sin(a), v2 = v * v;
    return [(rx * f + h) * sgnPow(sn, p), lerp(y0, y1, v) - sag * v2 * Math.max(0, c) ** 2 - back * v2 * Math.max(0, -c) ** 1.5 + rise * v2 * sn * sn - fold * .18 * v2 * wave, cz - (rz * f + h) * sgnPow(c, p)];
  };
  return { y0, y1, cz, fold, vOf, point, map: (a, y, h = 0) => point(a, vOf(y), h) };
}
/** The outer surface of a jacketSkirt with the same options, without drawing it: map(a, y, h). */
export const skirtMap = o => skirtGeo(o).map;
export function jacketSkirt(m, o = {}) {
  const { y0, y1, cz, fold, vOf, point, map } = skirtGeo(o, m.lod), vent = o.vent ?? .065, kMax = o.kMax ?? .3;
  const skin = (x, y) => { const k = sstep(y0 - .02, y1, y) * kMax; if (k < .01) return [B.PEL, 1]; const l = sstep(.12, -.12, x), out = [B.PEL, 1 - k]; if (l > .01) out.push(B.THL, k * l); if (l < .99) out.push(B.THR, k * (1 - l)); return out; };
  const slot = o.slot ?? S.CLOTH, lin = o.lining ?? S.CLOTH2, nu = m.seg(o.nu ?? 16, 6), nv = m.seg(o.nv ?? 11, 4), vm = v => v ** 1.35, out = (x, y, z) => [x, -.15, z - cz];       // rows closer together under the belt, where the flare turns
  const ventTop = vent > 0 ? 1 - vent / (y0 - y1) : 1, half = (v, back) => Math.PI / 2 + (back ? .05 : .02) - (vent > 0 ? .13 * sstep(ventTop, 1, v) : 0);
  for (const back of [0, 1]) {
    const ctr = back ? Math.PI : 0, lift = back ? .0025 : 0, ang = (u, v) => ctr + lerp(-half(v, back), half(v, back), u);
    m.grid(nu, nv, (u, v) => point(ang(u, vm(v)), vm(v), lift), { slot, skin, crease: 180, out, ao: (x, y, z) => clamp(.84 + 4.5 * (fold * (.62 * Math.sin(Math.atan2(x, cz - z) * 7 + .5))), .6, 1) * (.8 + .2 * sstep(y1, y0, y)) });
    if (m.keep(0)) m.grid(nu, nv, (u, v) => point(ang(u, vm(v)), vm(v), lift - .004), { slot: lin, skin, crease: 180, out: (x, y, z) => { const q = out(x, y, z); return [-q[0], .15, -q[2]]; }, ao: .45 });
    // rolled hem along the bottom edge, and along the vent edges
    const hemPts = Array.from({ length: m.seg(24, 8) + 1 }, (_, i) => point(ang(i / m.seg(24, 8), 1), 1, lift - .0015));
    m.tube(hemPts, o.hemR ?? .0042, { slot, skin, sides: m.keep(0) ? 5 : 3, n: hemPts.length, cap: true, up: [0, 1, 0] });
    if (vent > 0 && m.keep(1)) for (const u of [0, 1]) m.tube(Array.from({ length: 5 }, (_, i) => { const v = lerp(ventTop, 1, i / 4); return point(ang(u, v), v, lift - .0015); }), (o.hemR ?? .0042) * .8, { slot, skin, sides: 4, n: 5, cap: false });
    // tape near the hem, on the curved surface, stopping short of the vents
    if (o.tape) { const vt = vOf(o.tape.y), dv = (o.tape.w ?? .022) / (y0 - y1) / 2; m.grid(nu, 2, (u, k) => { const v = vt + (k === .5 ? 0 : (k * 2 - 1) * dv), a = ctr + lerp(-half(v, back) + .05, half(v, back) - .05, u); return point(a, v, lift + .0018 + (k === .5 ? .0012 : 0)); }, { slot: o.tape.slot ?? S.ACCENT, skin, crease: 50, out }); }
  }
  return map;
}
/** The outer face of a beltRing with the same arguments, without drawing it: map(a, h, dy) (h above the belt's face, dy above its centre line). */
export const beltMap = (y, rx, rz, o = {}) => { const t = o.t ?? .0045, sag = o.sag ?? .008, cz = o.cz ?? .002, p = 2 / (o.e ?? 2.3); return (a, h = 0, dy = 0) => { const c = Math.cos(a); return [(rx + t + h) * sgnPow(Math.sin(a), p), y - sag * Math.max(0, c) ** 2 + dy, cz - (rz + t + h) * sgnPow(c, p)]; }; };
/** A belt round the waist on the ellipse (rx, rz): a rounded section of width w and thickness t (soft edges, never a flat band), dipping by `sag`
 *  at the front. o: buckle ('frame': frame, roller bar and prong with the tail through it | 'cobra': quick-release pair with its latch | 'plate'),
 *  buckleA (angle, 0 = front), keepers [angles] (leather loops round the belt), loops [angles] (the garment's belt loops, slot loopSlot), slot, metal,
 *  skin, n. Returns beltMap. */
export function beltRing(m, y, rx, rz, o = {}) {
  const w = o.w ?? .04, t = o.t ?? .0045, sag = o.sag ?? .008, cz = o.cz ?? .002, p = 2 / (o.e ?? 2.3), n = m.seg(o.n ?? 44, 14), K = m.lod === 0 ? 12 : m.lod === 1 ? 8 : 4, q = 2 / (o.se ?? 4.5), skin = o.skin ?? B.PEL, slot = o.slot ?? S.RUBBER, metal = o.metal ?? S.METAL;
  const yAt = a => y - sag * Math.max(0, Math.cos(a)) ** 2;
  const P = (a, d, yy) => [(rx + d) * sgnPow(Math.sin(a), p), yy, cz - (rz + d) * sgnPow(Math.cos(a), p)];
  const sec = (a, k, dt = 0, dw = 0) => { const g = k * TAU, ht = t * .55 + dt, d = t * .45 + ht * sgnPow(Math.cos(g), q); return P(a, d, yAt(a) + (w / 2 + dw) * sgnPow(Math.sin(g), q)); };
  const aOf = (x, z) => Math.atan2(x / rx, -(z - cz) / rz), secOut = (x, yy, z) => { const a = aOf(x, z), c = P(a, t * .45, yAt(a)); return [x - c[0], yy - c[1], z - c[2]]; };
  m.grid(n, K, (u, v) => sec(u * TAU, v), { wrapU: true, slot, skin, crease: 75, out: secOut });
  // two rows of stitching along the edges (close range), stopping short of the buckle
  if (m.keep(0) && o.stitch !== false) { const b0 = o.buckleA ?? 0; for (const dy of [-1, 1]) stitchLine(m, Array.from({ length: 41 }, (_, i) => { const a = b0 + .22 + (TAU - .44) * i / 40; return P(a, t * .95 + .0004, yAt(a) + dy * (w / 2 - .0045)); }), { skin, n: 64, slot: o.stitchSlot ?? slot }); }
  // keepers: short leather loops round the belt
  for (const a of o.keepers || []) if (m.keep(1)) { const da = .007 / rx; m.grid(1, K, (u, v) => sec(a + (u - .5) * 2 * da, v, .0018, .0028), { slot, skin, crease: 75, out: secOut }); }
  // the garment's belt loops: a strap from under the belt, over it, back into the cloth above
  for (const a of o.loops || []) if (m.keep(0)) { const yy = yAt(a); padSweep(m, [P(a, -.0015, yy - w / 2 - .012), P(a, t + .0005, yy - w / 2 - .003), P(a, t + .0022, yy), P(a, t + .0005, yy + w / 2 + .003), P(a, -.0015, yy + w / 2 + .01)], .011, .0024, () => [Math.sin(a), 0, -Math.cos(a)], { slot: o.loopSlot ?? S.CLOTH2, skin, k: 6, e: 3, puff: .2, step: .012 }); }
  const ba = o.buckleA ?? 0, F = bodyFrame(P(ba, t, yAt(ba)), ba), fz = () => { const e = F.elements; return [e[8], e[9], e[10]]; };
  if (o.buckle === 'frame') {
    // the tail of the belt through the buckle, lying on the belt with a rounded end; frame, roller bar and prong; a keeper after it
    const tail = (u, v, h) => { const a = ba + u / rx; return P(a, t + .0004 + h, yAt(a) + v); };
    m.plate(chaikin([[-.004, -w * .44], [.058, -w * .44], [.07, -w * .2], [.072, 0], [.07, w * .2], [.058, w * .44], [-.004, w * .44]], 1), tail, { t: t * .75, bevel: t * .3, slot, skin, crease: 50, out: fz, round: 0 });
    lensFrame(m, F.clone().multiply(T(-.006, 0, .0012)), .02, w / 2 + .002, .0042, .0042, { slot: metal, skin, e: 3, n: 20, lens: false });
    if (m.keep(1)) { m.tube([xf(F, [-.021, -w / 2 - .002, .004]), xf(F, [-.021, w / 2 + .002, .004])], .0026, { slot: metal, skin, sides: 6, n: 3 }); m.tube([xf(F, [-.021, 0, .0045]), xf(F, [-.004, 0, .0068]), xf(F, [.014, 0, .0062]), xf(F, [.017, 0, .003])], .0015, { slot: metal, skin, sides: 5, n: 6 }); }
    if (m.keep(1)) { const a = ba + .085 / rx; m.grid(1, K, (u, v) => sec(a + (u - .5) * 2 * .006 / rx, v, .0018 + t * .8, .003), { slot, skin, crease: 75, out: secOut }); }
  } else if (o.buckle === 'cobra') {
    // quick-release: the female, a rounded frame block on one belt end with its darker throat; the male, a tapered plate with a raised spine whose
    // two spring wings sit in the female's side slots (squeeze them to release); the other belt end wrapped round the male's bar
    m.box([-.017, 0, .0045], [.03, w + .008, .011], .0055, { slot: metal, skin, m: F });
    m.plate(chaikin([[-.003, -w * .4], [.024, -w * .3], [.035, -w * .13], [.035, w * .13], [.024, w * .3], [-.003, w * .4]], 1), (u, v, hh) => xf(F, [u, v, .0035 + hh]), { t: .0062, bevel: .0022, slot: metal, skin, crease: 50, out: fz, round: 0 });
    if (m.keep(1)) {
      m.box([-.017, 0, .0103], [.02, w * .62, .0016], .0008, { slot: o.latchSlot ?? slot, skin, m: F });
      m.box([.013, 0, .0102], [.03, .0055, .0028], .0014, { slot: metal, skin, m: F });
      for (const k of [-1, 1]) m.box([-.002, k * (w * .38 + .002), .0072], [.009, .0055, .0085], .0024, { slot: metal, skin, m: F });
      m.box([.039, 0, .0025], [.007, w * .84, .007], .003, { slot, skin, m: F });
    }
  } else if (o.buckle === 'sr') {
    // side-release (moulded plastic): the female shell, open at its mouth, with a window on each side where the male's two spring prongs click in;
    // the male, a tapered body with a raised centre bar; each belt end wrapped round a ladder bar
    m.box([-.013, 0, .0045], [.03, w + .006, .0105], .0052, { slot: metal, skin, m: F });
    m.plate(chaikin([[-.002, -w * .42], [.022, -w * .42], [.031, -w * .26], [.031, w * .26], [.022, w * .42], [-.002, w * .42]], 1), (u, v, hh) => xf(F, [u, v, .0035 + hh]), { t: .0058, bevel: .002, slot: metal, skin, crease: 50, out: fz, round: 0 });
    if (m.keep(1)) {
      for (const k of [-1, 1]) m.box([-.006, k * (w / 2 + .0015), .0058], [.013, .0028, .0058], .0011, { slot: o.latchSlot ?? slot, skin, m: F });
      m.box([.012, 0, .0095], [.022, .0055, .0022], .0011, { slot: metal, skin, m: F });
      for (const x of [-.032, .036]) m.box([x, 0, .002], [.0045, w * .88, .0055], .002, { slot: metal, skin, m: F });
    }
  } else if (o.buckle === 'plate') {
    m.box([0, 0, .003], [.05, w + .006, .008], .004, { slot: metal, skin, m: F });
    if (m.keep(1)) lensFrame(m, F.clone().multiply(T(0, 0, .0072)), .014, w / 2 - .006, .0025, .0016, { slot, skin, e: 3, n: 16, lens: false });
  }
  return beltMap(y, rx, rz, o);
}
/** Keeps a garment under a belt BELT = [y, rx, rz, {w, sag, cz, e}] (as given to beltRing): inside the belt's band, which follows its sag, any point
 *  outside the belt's inner face less `gap` is drawn in with a soft limit (no crease), and the pull fades out over o.below under the band and o.above
 *  over it, so the cloth meets the belt's edges in a smooth curve instead of a step. Layers keep their order: give the inner layers a larger gap.
 *  Pass as o.pin to garment, garmentMap, jacketSkirt or skirtMap (a list of pins for several belts). At a coarse LOD the belt's chords are allowed for.
 *  The returned pin takes (p, lod, dg): dg widens the gap for a layer drawn inside (a lining), so the two never merge under the belt. */
export function beltPin(BELT, gap = .0015, o = {}) {
  const [y, rx, rz, bo = {}] = BELT, w = bo.w ?? .04, sag = bo.sag ?? .008, cz = bo.cz ?? .002, E = bo.e ?? 2.3, below = o.below ?? .025, above = o.above ?? .004, dd = .03;
  const chord = [0, 1, 2].map(l => Math.max(rx, rz) * (1 - Math.cos(Math.PI / Math.max(14, Math.round((bo.n ?? 44) * [1, .42, .22][l])))));
  return (p, lod = 0, dg = 0) => {
    const x = p[0], yy = p[1], z = p[2], a = Math.atan2(x / rx, -(z - cz) / rz), yr = yy - (y - sag * Math.max(0, Math.cos(a)) ** 2);
    const bl = below * [1, 1.5, 2.2][lod], k = yr < -w / 2 ? 1 - sstep(0, bl, -w / 2 - yr) : yr > w / 2 ? 1 - sstep(0, above, yr - w / 2) : 1;       // coarse LODs: a longer fade, so their few rows stay inside the fine surface (LOD2 casts the shadows)
    if (k <= 0) return p;
    const g0 = gap + chord[lod] + dg, RX = rx - g0, RZ = rz - g0, s = (Math.abs(x / RX) ** E + Math.abs((z - cz) / RZ) ** E) ** (1 / E);
    if (s <= 1 - dd) return p;
    const f = (1 - dd) + dd * (1 - Math.exp(-(s - (1 - dd)) / dd)), g = lerp(1, f / s, k);
    return [x * g, yy, cz + (z - cz) * g];
  };
}
/** Rows of a garment worn under a belt: cinched under it, bloused over its top edge (no flat line), then back to the garment's own rows above.
 *  rows: the garment's height table [[y, rx, rz, cz]]; (by, brx, brz): centre height and half-axes of the belt, w its width; o: the belt's options
 *  (sag, cz): the rows near the belt follow its sag (rows.warp, used by garment and garmentMap). Pair with blouseDisp, and pin the garment (beltPin). */
export function blouseRows(rows, by, brx, brz, w, over = .008, o = {}) {
  const top = by + w / 2, bot = by - w / 2, out = [], sag = o.sag ?? 0, cz = o.cz ?? 0;
  for (const r of rows) { if (r[0] < bot - .004) out.push(r); else if (r[0] <= top + .002) out.push([r[0], Math.min(r[1], brx - .003), Math.min(r[2], brz - .003), cz]); }
  out.push([top + .0035, brx + over * .7, brz + over * .7, cz], [top + .013, brx + over, brz + over, cz], [top + .025, brx + over * .72, brz + over * .72, cz * .5]);
  for (const r of rows) if (r[0] > top + .036) out.push(r);
  out.sort((a, b) => a[0] - b[0]);
  if (sag) out.warp = (a, y) => -sag * Math.max(0, Math.cos(a)) ** 2 * sstep(bot - .05, bot - .02, y) * (1 - sstep(top + .03, top + .07, y));
  return out;
}
/** Folds of a blouse spilling over a belt: soft puffs over its top edge only (never inside the belt), hanging a little lower where they bulge. */
export const blouseDisp = (by, w, amp = .05) => (a, y) => { const top = by + w / 2, k = y <= top + .002 ? 0 : bump(y, top + .016, .014), wave = .6 * Math.sin(a * 9 + .7) + .4 * Math.sin(a * 5 - 1.1); return amp * k * wave * (.6 + .4 * Math.max(0, wave)); };

/** Soft pouch in the local frame M (X across, Y up, Z out, its back face on z = 0): a rounded body that bulges at the front, a flap with thickness
 *  laid over the top and down the front with rounded corners, stitching along the flap, a snap or a tab. o: slot, flapSlot, tabSlot, skin, flap, tab. */
export function softPouch(m, w, h, d, M, o = {}) {
  const slot = o.slot ?? S.CLOTH2, flapSlot = o.flapSlot ?? slot, skin = o.skin ?? B.PEL, K = m.seg(20, 8), rows = m.seg(9, 3), q = 2 / 3, rb = Math.min(.02, d * .5, w * .3, h * .25), bulge = (o.bulge ?? .2) * d;
  const ring = y => { const lo = Math.max(0, (-h / 2 + rb) - y) / rb, hi = Math.max(0, y - (h / 2 - rb * .6)) / rb, sb = Math.sqrt(Math.max(.02, 1 - lo * lo)) * Math.sqrt(Math.max(.15, 1 - hi * hi * .6)), hx = w / 2 * (.86 + .14 * sb), hz = d / 2 * sb, yy = Math.max(-h / 2, Math.min(h / 2, y));
    return Array.from({ length: K }, (_, k) => { const g = k / K * TAU, c = Math.cos(g), s = Math.sin(g), x = hx * sgnPow(c, q), front = s > 0 ? bulge * (1 - (x / (w / 2)) ** 2) * Math.max(0, 1 - (yy / (h / 2)) ** 2) : 0; return xf(M, [x, yy, d / 2 + hz * sgnPow(s, q) + front]); }); };
  const ys = Array.from({ length: rows + 1 }, (_, j) => -h / 2 + h * (1 - Math.cos(j / rows * Math.PI)) / 2);
  const ctr = xf(M, [0, 0, d / 2]);
  m.loft(ys.map(ring), { slot, skin, crease: 70, capA: true, capB: true, ao: .92, out: (x, y, z) => [x - ctr[0], y - ctr[1], z - ctr[2]] });
  if (!m.keep(1)) return;
  const fh = h * (o.flap ?? .36), rr = Math.min(.009, d * .45), L = (d - rr) + rr * Math.PI / 2 + (fh - rr), wx = w / 2 + .0025;
  const fm = (u, v, hh) => { const s = v * L; let y, z, ny, nz;
    if (s < d - rr) { y = h / 2; z = s; ny = 1; nz = 0; } else if (s < d - rr + rr * Math.PI / 2) { const th = (s - (d - rr)) / rr; y = h / 2 - rr + rr * Math.cos(th); z = d - rr + rr * Math.sin(th); ny = Math.cos(th); nz = Math.sin(th); } else { y = h / 2 - rr - (s - (d - rr) - rr * Math.PI / 2); z = d; ny = 0; nz = 1; }
    const off = .0015 + hh + nz * bulge * (1 - u * u) * Math.max(0, 1 - (y / (h / 2)) ** 2); return xf(M, [u * wx, y + ny * off, z + nz * off]); };
  const e = M.elements;
  panel(m, fm, -1, 1, 0, 1, { t: .0046, nu: m.seg(7, 3), nv: m.seg(9, 4), slot: flapSlot, skin, edge: .2, round: .62, out: () => [e[4] + e[8], e[5] + e[9], e[6] + e[10]] });
  if (m.keep(0)) stitchLine(m, Array.from({ length: 11 }, (_, i) => { const u = lerp(-.82, .82, i / 10); return fm(u, .93 - .05 * u * u, .0045); }), { skin, n: 22 });
  if (o.tab) m.box([0, h / 2 - fh + .004, d + .0045 + bulge * Math.max(0, 1 - ((h / 2 - fh) / (h / 2)) ** 2)], [Math.min(.02, w * .3), .022, .004], .0015, { slot: o.tabSlot ?? S.ACCENT, skin, m: M });
  else stud(m, fm(0, .9, .0035), [e[8], e[9], e[10]], { skin, r: .004, slot: o.tabSlot ?? S.METAL });
}
/** A flask in a fabric cover (local frame M, its back on z = 0): the flask's shoulder and neck above the cover, a ridged cap and its retaining strap,
 *  a cover flap over the front of the shoulder with a snap, a seam, the attachment strap up the back (o.hang: more points, e.g. over a belt). o: slot (cover), flaskSlot, capSlot, skin, r, h. */
export function canteen(m, M, o = {}) {
  const r = o.r ?? .046, h = o.h ?? .14, skin = o.skin ?? B.PEL, slot = o.slot ?? S.CLOTH2, flask = o.flaskSlot ?? S.METAL, cap = o.capSlot ?? S.RUBBER, sq = o.flat ?? .62, sides = m.lod === 0 ? 18 : m.lod === 1 ? 10 : 6;
  const C = M.clone().multiply(T(0, 0, r * sq + .002, 0, 0, 0, 1, 1, sq)), cc = xf(C, [0, 0, 0]), out = (x, y, z) => [x - cc[0], y - cc[1], z - cc[2]];
  const FP = [[0, h * .5], [r * .34, h * .5], [r * .38, h * .44], [r * .78, h * .36], [r * .96, h * .25], [r, h * .1]], prof = P => y => { for (let i = 1; i < P.length; i++) if (y >= P[i][1]) { const a = P[i], b = P[i - 1], t = (y - a[1]) / (b[1] - a[1]); return lerp(a[0], b[0], t); } return P[P.length - 1][0]; }, rf = prof(FP);
  const CP = [[r * .9, h * .305], [r * .99, h * .28], [r * 1.055, h * .24], [r * 1.07, h * .18], [r * 1.07, -h * .38], [r * 1.0, -h * .48], [r * .7, -h * .52], [0, -h * .52]], rc = prof(CP.slice(0, 5));
  m.revolve(FP, { sides, slot: flask, skin, m: C, crease: 50 });
  m.revolve(CP, { sides, slot, skin, m: C, crease: 45, ao: .92 });
  m.revolve([[r * .4, h * .5], [r * .43, h * .53], [r * .43, h * .6], [r * .38, h * .62], [0, h * .62]], { sides: m.keep(1) ? 12 : 6, slot: cap, skin, m: C, crease: 40 });
  if (!m.keep(1)) return;
  if (m.keep(0)) m.revolve([[r * .895, h * .3], [r * .91, h * .318], [r * .945, h * .32], [r * .965, h * .3]], { sides, slot, skin, m: C, crease: 60 });      // rolled top edge of the cover
  if (m.keep(0)) for (let k = 0; k < 10; k++) m.box([Math.cos(k / 10 * TAU) * r * .44, h * .565, Math.sin(k / 10 * TAU) * r * .44], [.0028, h * .06, .0028], .0006, { slot: cap, skin, m: C });
  if (m.keep(0)) m.tube([xf(C, [r * .42, h * .58, 0]), xf(C, [r * .75, h * .52, 0]), xf(C, [r * .98, h * .3, 0])], .0018, { slot: cap, skin, sides: 4, n: 6 });
  // the cover flap over the front of the shoulder, a snap at its tip
  const fm = (u, v, hh) => { const a = lerp(-.95, .95, u), y = lerp(h * .16, h * .43, v), R = Math.max(rf(y) + .0032, y < h * .305 ? rc(y) + .003 : 0) + hh; return xf(C, [R * Math.sin(a), y, R * Math.cos(a)]); };
  panel(m, fm, 0, 1, 0, 1, { t: .0034, nu: 6, nv: 5, slot, skin, edge: .16, round: .55, out });
  stud(m, fm(.5, .12, .0045), out(...fm(.5, .12, .0045)), { skin, r: .0042 });
  if (m.keep(0)) stitchLine(m, Array.from({ length: 8 }, (_, i) => xf(C, [r * 1.075, lerp(h * .06, -h * .44, i / 7), 0])), { skin, n: 14 });
  padSweep(m, [xf(M, [0, h * .05, .001]), xf(M, [0, h * .45, .0015]), ...(o.hang || [xf(M, [0, h * .62, .002])])], .024, .0025, () => [-M.elements[8], -M.elements[9], -M.elements[10]], { slot, skin, k: 6, e: 3, puff: .2, step: .015 });
}
/** Hand radio (local frame M, its back on z = 0): a rounded body, a recessed grille, knobs, the aerial on its rubber base, a press-to-talk key, a belt clip. */
export function radio(m, M, o = {}) {
  const w = o.w ?? .05, h = o.h ?? .085, d = o.d ?? .026, skin = o.skin ?? B.CHE, slot = o.slot ?? S.RUBBER;
  m.box([0, 0, d / 2 + .002], [w, h, d], Math.min(.009, d * .4), { slot, skin, m: M });
  if (m.keep(1)) { for (let k = 0; k < 5; k++) m.box([0, -h * .32 + k * .009, d + .0018], [w * .62, .0034, .0024], .001, { slot: o.grilleSlot ?? S.METAL, skin, m: M }); m.box([w / 2 + .001, h * .12, d / 2 + .002], [.004, .022, .011], .0018, { slot: o.keySlot ?? S.ACCENT, skin, m: M }); }
  m.revolve([[.0004, .013], [.006, .012], [.007, .004], [.007, 0]], { sides: m.keep(1) ? 10 : 6, slot: o.knobSlot ?? S.METAL, skin, m: M.clone().multiply(T(-w * .22, h / 2 + .002, d / 2 + .002)), crease: 40 });
  m.revolve([[.0002, .02], [.0055, .018], [.0062, .004], [.0062, 0]], { sides: m.keep(1) ? 10 : 6, slot, skin, m: M.clone().multiply(T(w * .2, h / 2 + .002, d / 2 + .002)), crease: 40 });
  m.tube([xf(M, [w * .2, h / 2 + .02, d / 2 + .002]), xf(M, [w * .2, h / 2 + .06, d / 2 + .003]), xf(M, [w * .21, h / 2 + (o.aerial ?? .085), d / 2 + .004])], t => lerp(.0036, .0022, t), { slot, skin, sides: m.keep(1) ? 6 : 3, n: 4 });
  if (m.keep(1)) m.box([0, h * .1, -.0015], [w * .45, h * .62, .003], .0012, { slot: o.clipSlot ?? S.METAL, skin, m: M });
}
/** Clipboard (local frame M, its back on z = 0): a board with rounded corners, a sheet with a lifted corner and ruled lines, a spring clip. */
export function clipboard(m, M, o = {}) {
  const w = o.w ?? .1, h = o.h ?? .135, skin = o.skin ?? B.CHE, e = M.elements, outZ = () => [e[8], e[9], e[10]];
  m.plate(chaikin([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], 2, .2), (u, v, hh) => xf(M, [u, v, hh]), { t: .005, bevel: .0016, slot: o.slot ?? S.RUBBER, skin, round: 0, out: outZ });
  if (!m.keep(1)) return;
  m.plate(chaikin([[-w * .44, -h * .46], [w * .38, -h * .46], [w * .44, -h * .4], [w * .44, h * .4], [-w * .44, h * .4]], 1, .2), (u, v, hh) => xf(M, [u, v, .0052 + hh + (u > w * .3 && v < -h * .3 ? (u - w * .3) * (-h * .3 - v) * 1.2 : 0)]), { t: .0008, bevel: .0003, slot: o.sheetSlot ?? S.PLATE2, skin, round: 0, out: outZ });
  if (m.keep(0)) for (let k = 0; k < 7; k++) m.box([-w * .05 + (k % 2) * w * .04, h * .25 - k * h * .085, .0066], [w * (.62 - (k % 3) * .1), .0018, .0006], .0003, { slot: o.lineSlot ?? S.RUBBER, skin, m: M });
  m.tube([xf(M, [-w * .22, h / 2 - .004, .006]), xf(M, [-w * .22, h / 2 + .006, .011]), xf(M, [w * .22, h / 2 + .006, .011]), xf(M, [w * .22, h / 2 - .004, .006])], .0026, { slot: o.metal ?? S.METAL, skin, sides: 5, n: 10, tension: .2 });
  m.box([0, h / 2 - .012, .0085], [w * .42, .016, .003], .0015, { slot: o.metal ?? S.METAL, skin, m: M });
}

// ---------------------------------------------------------------- the head under every map outfit's headgear
/** Head centre and half-sizes (a little smaller than a helmet: headgear sits on it). */
export const HC = [0, 1.664, -.006], HR = [.082, .101, .099];
/** Point of the head at longitude lon (0 = face, + toward his right) and latitude lat (0 = eyes, + up), off above the skin: jaw narrows, nose and chin stand out. */
export function headP(lon, lat, off = 0) {
  const jaw = lerp(1, .84, sstep(-.3, -1.15, lat)), f = Math.max(0, Math.cos(lon)), c = Math.cos(lat);
  const nose = .017 * Math.exp(-((lon / .17) ** 2) - (((lat + .2) / .2) ** 2)) * (lat < .05 ? 1 : Math.exp(-(((lat - .05) / .05) ** 2))), chin = .008 * Math.exp(-((lon / .35) ** 2) - (((lat + .78) / .18) ** 2));
  return [HC[0] + (HR[0] * jaw + off) * Math.sin(lon) * c, HC[1] + (HR[1] + off) * Math.sin(lat), HC[2] - (HR[2] + off + (nose + chin) * f) * Math.cos(lon) * c];
}
export const outH = (x, y, z) => [x - HC[0], y - HC[1] + .02, z - HC[2]];
/** The head itself as a dark under-layer (only the odd gap of the headgear shows it). */
export function headBase(m, slot = S.CLOTH2) { m.grid(m.seg(20, 8), m.seg(8, 4), (u, v) => headP(u * TAU - Math.PI, lerp(-1.2, 1.45, v)), { wrapU: true, capB: true, slot, skin: B.HEA, crease: 180, out: outH, ao: .55 }); }
export { lerp, clamp, sstep };
