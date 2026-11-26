/* FRONT ZÉRO — map-soften.js : passe d'adoucissement des cartes (rendu seulement).
   Ne lit que L.ops et ne modifie RIEN dans le layout : solides, apparitions et nav restent identiques.
   - Faces cachées retirées, boîtes voisines fusionnées visuellement (pas de biseau sur une jonction).
   - Biseaux sur les arêtes exposées, par matériau, normales lissées, occlusion et usure cuites dans l'attribut fzAO.
   - Pièces sculptées : conteneurs, caisses, fûts, citernes, sacs, hesco, roches, encadrements, plinthes, couvertines, chaînages, gravats.
   Tout reste à moins de 5 cm des boîtes de collision (relief sur les murs, débris bas sans collision).
   Aucune dépendance : testable sous Node. Accroche : voir softenBuild / softenShader / softenGeo. */

export const RELIEF_ENVS = new Set(['snow', 'valley', 'airbase', 'refinery', 'port', 'bunker', 'desert', 'urban']);
export const SOFT_ENVS = new Set(['desert', 'urban', 'port', 'snow', 'bunker', 'airbase', 'refinery', 'valley']);
const EPS = 1e-3, PI = Math.PI, MAX_PROUD = 0.05;

/* r : rayon de biseau ; wob : irrégularité (part de r) ; seg : pas des stations irrégulières ; wear : éclaircissement de l'arête ; ao : force du contact */
const PROF = {
  plaster: { r: .042, wob: .62, seg: 1, wear: .34, ao: .34, masonry: 1 }, plasterB: { r: .042, wob: .62, seg: 1, wear: .3, ao: .34, masonry: 1 }, plasterO: { r: .042, wob: .62, seg: 1, wear: .34, ao: .34, masonry: 1 },
  stone: { r: .048, wob: .7, seg: .85, wear: .36, ao: .4, masonry: 1 }, brick: { r: .036, wob: .6, seg: .8, wear: .22, ao: .38, masonry: 1 },
  conc: { r: .03, wob: .3, seg: 1.1, wear: .3, ao: .34, masonry: 1 }, concD: { r: .03, wob: .3, seg: 1.1, wear: .26, ao: .34 }, bwall: { r: .028, wob: .2, seg: 1.4, wear: .24, ao: .32 }, ceil: { r: .02, wob: 0, seg: 9, wear: .12, ao: .3 },
  corr: { r: .014, wob: 0, seg: 9, wear: .3, ao: .26 }, rust: { r: .014, wob: .15, seg: 1.2, wear: .34, ao: .28 }, plate: { r: .012, wob: 0, seg: 9, wear: .34, ao: .22 }, panel: { r: .012, wob: 0, seg: 9, wear: .2, ao: .22 },
  steel: { r: .008, wob: 0, seg: 9, wear: .36, ao: .16 }, frame: { r: .012, wob: 0, seg: 9, wear: .3, ao: .18 }, paint: { r: .026, wob: 0, seg: 9, wear: .3, ao: .24 }, burn: { r: .026, wob: .3, seg: .8, wear: .16, ao: .24 }, door: { r: .012, wob: 0, seg: 9, wear: .22, ao: .2 },
  wood: { r: .016, wob: .35, seg: .7, wear: .24, ao: .28 }, woodD: { r: .016, wob: .35, seg: .7, wear: .2, ao: .28 }, crate: { r: .022, wob: .2, seg: .6, wear: .3, ao: .22 }, tile: { r: .018, wob: .3, seg: .7, wear: .14, ao: .28 }, tarp: { r: .02, wob: 0, seg: 9, wear: .1, ao: .18 }, tarpR: { r: .02, wob: 0, seg: 9, wear: .1, ao: .18 },
  sandbag: { r: .05, pillow: [.64, .205, .036, .022], ao: .5 }, hesco: { r: .05, pillow: [1.1, 1.1, .018, .013], ao: .22, rigid: 1 },
  cont0: { r: .02, wear: .3, ao: .2 }, cont1: { r: .02, wear: .3, ao: .2 }, cont2: { r: .02, wear: .3, ao: .2 }, cont3: { r: .02, wear: .3, ao: .2 },
  snow: { r: .05, wob: .5, seg: .6, wear: 0, ao: .16 }, rock: { r: .05, wob: .7, seg: .4, wear: .12, ao: .3 }, rockS: { r: .05, wob: .7, seg: .4, wear: .12, ao: .3 },
};
const ZP = { frame: -3, steel: -2, plate: -1, rock: 1, wood: 2, woodD: 2 };                     // same depth priority as ZR in maps.js
const NO_OCC = /^(far|lamp|glass|fence|chain|tarp)/;

const fract = v => v - Math.floor(v);
const rn = (a, b = 0) => fract(Math.sin(a * 127.13 + b * 311.71 + 1.37) * 43758.5453);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ---------- sortie : tampons par lot ---------- */
class Sink {
  constructor(m, o, uvS) { this.m = m; this.o = o; this.uvS = uvS; this.p = []; this.n = []; this.u = []; this.a = []; this.i = []; this.xf = null; this.fit = null }
  /* f : face (2*axe + signe), sert au dépliage `fit` identique à BoxGeometry */
  v(x, y, z, nx, ny, nz, ao, f) {
    const F = this.fit; let U, V;
    if (F) {
      const dx = F.hi[0] - F.lo[0] || 1, dy = F.hi[1] - F.lo[1] || 1, dz = F.hi[2] - F.lo[2] || 1;
      if (f === 1) { U = (F.hi[2] - z) / dz; V = (y - F.lo[1]) / dy } else if (f === 0) { U = (z - F.lo[2]) / dz; V = (y - F.lo[1]) / dy }
      else if (f === 3) { U = (x - F.lo[0]) / dx; V = (F.hi[2] - z) / dz } else if (f === 2) { U = (x - F.lo[0]) / dx; V = (z - F.lo[2]) / dz }
      else if (f === 5) { U = (x - F.lo[0]) / dx; V = (y - F.lo[1]) / dy } else { U = (F.hi[0] - x) / dx; V = (y - F.lo[1]) / dy }
    }
    const t = this.xf; if (t) { const X = x * t.c + z * t.s, Z = -x * t.s + z * t.c, NX = nx * t.c + nz * t.s, NZ = -nx * t.s + nz * t.c; x = X + t.x; z = Z + t.z; nx = NX; nz = NZ }
    if (this.gnd) { U = (x + this.gnd) / (2 * this.gnd); V = (this.gnd - z) / (2 * this.gnd) } else if (!F) { const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz), s = this.uvS; if (ax >= ay && ax >= az) { U = z / s; V = y / s } else if (ay >= az) { U = x / s; V = z / s } else { U = x / s; V = y / s } }
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(U, V); this.a.push(ao); return this.p.length / 3 - 1;
  }
  vu(x, y, z, nx, ny, nz, ao, u, v) { const l = Math.hypot(nx, ny, nz) || 1; this.p.push(x, y, z); this.n.push(nx / l, ny / l, nz / l); this.u.push(u, v); this.a.push(ao); return this.p.length / 3 - 1 }
  front(a, b, c) { const P = this.p, N = this.n, A = a * 3, B = b * 3, C = c * 3, ux = P[B] - P[A], uy = P[B + 1] - P[A + 1], uz = P[B + 2] - P[A + 2], vx = P[C] - P[A], vy = P[C + 1] - P[A + 1], vz = P[C + 2] - P[A + 2];
    return (uy * vz - uz * vy) * (N[A] + N[B] + N[C]) + (uz * vx - ux * vz) * (N[A + 1] + N[B + 1] + N[C + 1]) + (ux * vy - uy * vx) * (N[A + 2] + N[B + 2] + N[C + 2]) >= 0 }
  tri(a, b, c) { this.front(a, b, c) ? this.i.push(a, b, c) : this.i.push(a, c, b) }
  side(a, b, c) { const P = this.p, N = this.n, A = a * 3, B = b * 3, C = c * 3, ux = P[B] - P[A], uy = P[B + 1] - P[A + 1], uz = P[B + 2] - P[A + 2], vx = P[C] - P[A], vy = P[C + 1] - P[A + 1], vz = P[C + 2] - P[A + 2]; return (uy * vz - uz * vy) * (N[A] + N[B] + N[C]) + (uz * vx - ux * vz) * (N[A + 1] + N[B + 1] + N[C + 1]) + (ux * vy - uy * vx) * (N[A + 2] + N[B + 2] + N[C + 2]) }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d) }
}

/* ---------- index spatial des boîtes ---------- */
class Grid {
  constructor(c) { this.c = c; this.m = new Map(); this.st = 0 }
  k(i, j) { return (i + 4096) * 8192 + j + 4096 }
  add(b) { const c = this.c; for (let i = Math.floor(b.lo[0] / c); i <= Math.floor((b.hi[0] - 1e-6) / c); i++) for (let j = Math.floor(b.lo[2] / c); j <= Math.floor((b.hi[2] - 1e-6) / c); j++) { const k = this.k(i, j); let l = this.m.get(k); if (!l) this.m.set(k, l = []); l.push(b) } }
  each(x0, x1, z0, z1, fn) { const c = this.c, s = ++this.st; for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) { const l = this.m.get(this.k(i, j)); if (!l) continue; for (let n = 0; n < l.length; n++) { const b = l[n]; if (b._s !== s) { b._s = s; if (fn(b) === true) return true } } } return false }
  solidAt(x, y, z, skip) { return this.each(x, x, z, z, b => b !== skip && x > b.lo[0] && x < b.hi[0] && y > b.lo[1] && y < b.hi[1] && z > b.lo[2] && z < b.hi[2]) }
}

/* rectangles : {b0,b1,c0,c1} dans le repère de la face (axes (A+1)%3 et (A+2)%3) */
function subRect(list, b0, b1, c0, c1) {
  const out = [];
  for (const r of list) {
    if (b1 <= r.b0 + EPS || b0 >= r.b1 - EPS || c1 <= r.c0 + EPS || c0 >= r.c1 - EPS) { out.push(r); continue }
    if (b0 > r.b0 + EPS) out.push({ b0: r.b0, b1: b0, c0: r.c0, c1: r.c1 });
    if (b1 < r.b1 - EPS) out.push({ b0: b1, b1: r.b1, c0: r.c0, c1: r.c1 });
    const a = Math.max(b0, r.b0), e = Math.min(b1, r.b1);
    if (c0 > r.c0 + EPS) out.push({ b0: a, b1: e, c0: r.c0, c1: c0 });
    if (c1 < r.c1 - EPS) out.push({ b0: a, b1: e, c0: c1, c1: r.c1 });
  }
  return out;
}
function mergeRects(l) {
  for (let again = true; again;) {
    again = false;
    outer: for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const p = l[i], q = l[j];
      if (Math.abs(p.c0 - q.c0) < EPS && Math.abs(p.c1 - q.c1) < EPS && (Math.abs(p.b1 - q.b0) < EPS || Math.abs(q.b1 - p.b0) < EPS)) { p.b0 = Math.min(p.b0, q.b0); p.b1 = Math.max(p.b1, q.b1); l.splice(j, 1); again = true; break outer }
      if (Math.abs(p.b0 - q.b0) < EPS && Math.abs(p.b1 - q.b1) < EPS && (Math.abs(p.c1 - q.c0) < EPS || Math.abs(q.c1 - p.c0) < EPS)) { p.c0 = Math.min(p.c0, q.c0); p.c1 = Math.max(p.c1, q.c1); l.splice(j, 1); again = true; break outer }
    }
  }
  return l;
}
const fullRects = b => { const R = []; for (let f = 0; f < 6; f++) { const A = f >> 1, B = (A + 1) % 3, C = (A + 2) % 3; R.push([{ b0: b.lo[B], b1: b.hi[B], c0: b.lo[C], c1: b.hi[C] }]) } return R };

/* intervalle le long de E où la face f touche la frontière (axe X, côté v) */
function touchSpans(list, F, X, v) {
  const out = [], isB = X === (F + 1) % 3;
  for (const r of list) { if (isB) { if (Math.abs(r.b0 - v) < EPS || Math.abs(r.b1 - v) < EPS) out.push([r.c0, r.c1]) } else if (Math.abs(r.c0 - v) < EPS || Math.abs(r.c1 - v) < EPS) out.push([r.b0, r.b1]) }
  out.sort((a, b) => a[0] - b[0]); const m = []; for (const s of out) { const l = m[m.length - 1]; if (l && s[0] <= l[1] + EPS) l[1] = Math.max(l[1], s[1]); else m.push([s[0], s[1]]) } return m;
}
function interSpans(a, b) { const o = []; for (const p of a) for (const q of b) { const s = Math.max(p[0], q[0]), e = Math.min(p[1], q[1]); if (e - s > EPS * 2) o.push([s, e]) } return o }
const inSpans = (sp, t) => { for (const s of sp) if (t >= s[0] - EPS && t <= s[1] + EPS) return true; return false };
const coversSpan = (sp, a, b) => { for (const s of sp) if (a >= s[0] - EPS && b <= s[1] + EPS) return true; return false };

/* rayon irrégulier le long d'une arête : même valeur vue des deux faces et des deux boîtes voisines */
function edgeR(P, r, t, pa, px) { if (!P.wob) return r; const k = Math.round(pa * 23) * 7 + Math.round(px * 23) * 13, n = rn(Math.round(t / (P.seg * .5)), k), chip = rn(Math.round(t / (P.seg * 1.7)), k + 3) > .8 ? 1.55 : 1; return Math.min(MAX_PROUD, r * (1 - P.wob * .7 * n) * chip) }
function stations(t0, t1, seg) { const o = []; if (seg > 5 || t1 - t0 < .9) return o; const k0 = Math.ceil(t0 / seg), k1 = Math.floor(t1 / seg); for (let k = k0; k <= k1; k++) { const t = (k + (rn(k, 9) - .5) * .55) * seg; if (t > t0 + .03 && t < t1 - .03 && (!o.length || t > o[o.length - 1] + .05)) o.push(t) } return o }

/* ---------- maillage d'une boîte à partir de ses faces exposées ---------- */
function meshBox(S, box, rects, P, opt) {
  const lo = box.lo, hi = box.hi, min = Math.min(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), max = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), r0 = opt.noBevel || (!opt.relief && (min < .14 || max < .45 || opt.lod)) ? 0 : Math.min(P.r * (opt.lod ? .7 : 1), min * .32);
  const seg = opt.lod || box.rot ? 99 : P.seg, wear = -(P.wear || 0), planes = f => (f & 1) ? hi[f >> 1] : lo[f >> 1];
  const SP = new Array(36);
  if (r0 > .002) for (let f = 0; f < 6; f++) for (let g = f + 1; g < 6; g++) {
    if ((f >> 1) === (g >> 1) || !rects[f].length || !rects[g].length) continue;
    const A = f >> 1, X = g >> 1, s = interSpans(touchSpans(rects[f], A, X, planes(g)), touchSpans(rects[g], X, A, planes(f)));
    if (s.length) SP[f * 6 + g] = SP[g * 6 + f] = s;
  }
  const spanOf = (f, g) => SP[f * 6 + g] || null;
  /* faces */
  for (let f = 0; f < 6; f++) {
    if (opt.noFaces) break;
    if (!rects[f].length) continue;
    const A = f >> 1, B = (A + 1) % 3, C = (A + 2) % 3, sg = f & 1 ? 1 : -1, pl = planes(f), nor = [0, 0, 0]; nor[A] = sg;
    const pos = [0, 0, 0], V = (b, c, ao) => { pos[A] = pl; pos[B] = b; pos[C] = c; return S.v(pos[0], pos[1], pos[2], nor[0], nor[1], nor[2], ao, f) };
    const fB0 = 2 * B, fB1 = 2 * B + 1, fC0 = 2 * C, fC1 = 2 * C + 1, sB0 = spanOf(f, fB0), sB1 = spanOf(f, fB1), sC0 = spanOf(f, fC0), sC1 = spanOf(f, fC1);
    for (const R of rects[f]) {
      /* découpe aux extrémités des biseaux */
      const cutC = new Set([R.c0, R.c1]), cutB = new Set([R.b0, R.b1]);
      if (Math.abs(R.b0 - lo[B]) < EPS && sB0) for (const s of sB0) for (const v of s) if (v > R.c0 + EPS && v < R.c1 - EPS) cutC.add(v);
      if (Math.abs(R.b1 - hi[B]) < EPS && sB1) for (const s of sB1) for (const v of s) if (v > R.c0 + EPS && v < R.c1 - EPS) cutC.add(v);
      if (Math.abs(R.c0 - lo[C]) < EPS && sC0) for (const s of sC0) for (const v of s) if (v > R.b0 + EPS && v < R.b1 - EPS) cutB.add(v);
      if (Math.abs(R.c1 - hi[C]) < EPS && sC1) for (const s of sC1) for (const v of s) if (v > R.b0 + EPS && v < R.b1 - EPS) cutB.add(v);
      const Bs = [...cutB].sort((a, b) => a - b), Cs = [...cutC].sort((a, b) => a - b);
      for (let bi = 0; bi + 1 < Bs.length; bi++) for (let ci = 0; ci + 1 < Cs.length; ci++) {
        const b0 = Bs[bi], b1 = Bs[bi + 1], c0 = Cs[ci], c1 = Cs[ci + 1];
        const fb0 = Math.abs(b0 - lo[B]) < EPS && sB0 && coversSpan(sB0, c0, c1), fb1 = Math.abs(b1 - hi[B]) < EPS && sB1 && coversSpan(sB1, c0, c1), fc0 = Math.abs(c0 - lo[C]) < EPS && sC0 && coversSpan(sC0, b0, b1), fc1 = Math.abs(c1 - hi[C]) < EPS && sC1 && coversSpan(sC1, b0, b1);
        const ib0 = fb0 ? r0 : 0, ib1 = fb1 ? r0 : 0, ic0 = fc0 ? r0 : 0, ic1 = fc1 ? r0 : 0;
        /* occlusion de contact sur les côtés non biseautés qui butent contre un volume ou le sol */
        const big = (b1 - b0) > .7 && (c1 - c0) > .7 && !opt.noAO && !opt.lod, W = big ? Math.min(.26, .3 * Math.min(b1 - b0, c1 - c0)) : 0, K = P.ao || .25;
        const probe = (bb, cc, db, dc) => { if (!big || !opt.grid) return 0; pos[A] = pl + sg * .012; pos[B] = bb + db * .012; pos[C] = cc + dc * .012; if (B === 1 ? Math.abs(bb) < EPS && db < 0 : C === 1 ? Math.abs(cc) < EPS && dc < 0 : false) return K * .85; return opt.grid.solidAt(pos[0], pos[1], pos[2], box) ? K : 0 };
        const ab0 = fb0 ? 0 : probe(b0, (c0 + c1) / 2, -1, 0), ab1 = fb1 ? 0 : probe(b1, (c0 + c1) / 2, 1, 0), ac0 = fc0 ? 0 : probe((b0 + b1) / 2, c0, 0, -1), ac1 = fc1 ? 0 : probe((b0 + b1) / 2, c1, 0, 1);
        const ob0 = b0 + ib0, ob1 = b1 - ib1, oc0 = c0 + ic0, oc1 = c1 - ic1, nb0 = ob0 + (ab0 ? W : 0), nb1 = ob1 - (ab1 ? W : 0), nc0 = oc0 + (ac0 ? W : 0), nc1 = oc1 - (ac1 ? W : 0);
        if (nb1 - nb0 < .001 || nc1 - nc0 < .001) continue;
        { const a = V(nb0, nc0, 0), b = V(nb1, nc0, 0), c = V(nb1, nc1, 0), d = V(nb0, nc1, 0); S.quad(a, b, c, d) }
        /* bandes d'occlusion en onglet */
        const band = (x0, y0, x1, y1, x2, y2, x3, y3, k) => S.quad(V(x0, y0, k), V(x1, y1, k), V(x2, y2, 0), V(x3, y3, 0));
        if (ac0) band(ob0, oc0, ob1, oc0, nb1, nc0, nb0, nc0, ac0);
        if (ab1) band(ob1, oc0, ob1, oc1, nb1, nc1, nb1, nc0, ab1);
        if (ac1) band(ob1, oc1, ob0, oc1, nb0, nc1, nb1, nc1, ac1);
        if (ab0) band(ob0, oc1, ob0, oc0, nb0, nc0, nb0, nc1, ab0);
      }
    }
  }
  if (r0 <= .002) return;
  /* biseaux */
  const p = [0, 0, 0];
  for (let f = 0; f < 6; f++) for (let g = f + 1; g < 6; g++) {
    const sp = spanOf(f, g); if (!sp) continue;
    const A = f >> 1, X = g >> 1, E = 3 - A - X, sA = f & 1 ? 1 : -1, sX = g & 1 ? 1 : -1, pa = planes(f), px = planes(g), h0 = 2 * E, h1 = 2 * E + 1;
    const nf = [0, 0, 0], ng = [0, 0, 0]; nf[A] = sA; ng[X] = sX;
    const corner = (e, h) => { const a = spanOf(f, h), b = spanOf(g, h); return !!a && !!b && inSpans(a, px) && inSpans(b, pa) };
    const flip = (() => { const dF = [0, 0, 0]; dF[X] = -sX; dF[A] = sA; const dE = [0, 0, 0]; dE[E] = 1; const d = [dF[1] * dE[2] - dF[2] * dE[1], dF[2] * dE[0] - dF[0] * dE[2], dF[0] * dE[1] - dF[1] * dE[0]]; return d[A] * sA + d[X] * sX < 0 })();
    for (const s of sp) {
      const c0 = Math.abs(s[0] - lo[E]) < EPS && corner(s[0], h0), c1 = Math.abs(s[1] - hi[E]) < EPS && corner(s[1], h1), t0 = s[0] + (c0 ? r0 : 0), t1 = s[1] - (c1 ? r0 : 0); if (t1 - t0 < .001) continue;
      const T = [t0, ...stations(t0, t1, seg), t1], round = !opt.lod && r0 >= .03 && t1 - t0 >= .4, Q = Math.SQRT1_2, nm = [(nf[0] + ng[0]) * Q, (nf[1] + ng[1]) * Q, (nf[2] + ng[2]) * Q], key = Math.round((A < X ? pa : px) * 23) * 7 + Math.round((A < X ? px : pa) * 23) * 13;
      let pF = -1, pG = -1, pM = -1;
      for (let k = 0; k < T.length; k++) {
        const t = T[k], end = k === 0 || k === T.length - 1;
        p[E] = t; p[A] = pa; p[X] = px - sX * r0; const a = S.v(p[0], p[1], p[2], nf[0], nf[1], nf[2], wear * .4, f);
        p[A] = pa - sA * r0; p[X] = px; const b = S.v(p[0], p[1], p[2], ng[0], ng[1], ng[2], wear * .4, g);
        if (round) {
          /* arête : profil arrondi, usé et ébréché par endroits ; aux extrémités le point reste sur la corde pour fermer l'angle */
          const n = P.wob ? rn(Math.round(t / (P.seg * .5)), key) : .1, chip = P.wob && rn(Math.round(t / (P.seg * 1.7)), key + 3) > .78, w = end ? r0 * .5 : r0 * (chip ? .92 : .3 + P.wob * .45 * n);
          p[A] = pa - sA * w; p[X] = px - sX * w; const m = S.v(p[0], p[1], p[2], nm[0], nm[1], nm[2], end ? wear : chip ? wear * .4 + .1 : wear * 1.25, f);
          if (k) { S.quad(pF, a, m, pM); S.quad(pM, m, b, pG) } pM = m;
        } else if (k) S.quad(pF, a, b, pG);
        pF = a; pG = b;
      }
      /* bouchons aux extrémités sans coin */
      const cap = (t, sign) => { p[E] = t; p[A] = pa; p[X] = px - sX * r0; const a = S.v(p[0], p[1], p[2], nf[0], nf[1], nf[2], wear, f); p[A] = pa - sA * r0; p[X] = px; const b = S.v(p[0], p[1], p[2], ng[0], ng[1], ng[2], wear, g); p[A] = pa; p[X] = px; const c = S.v(p[0], p[1], p[2], (nf[0] + ng[0]) * .707, (nf[1] + ng[1]) * .707, (nf[2] + ng[2]) * .707, wear, f); (flip === (sign > 0)) ? S.tri(a, b, c) : S.tri(b, a, c) };
      if (!c0) cap(s[0], -1); if (!c1) cap(s[1], 1);
    }
  }
  /* coins */
  for (let m = 0; m < 8; m++) {
    const fx = m & 1 ? 1 : 0, fy = m & 2 ? 3 : 2, fz = m & 4 ? 5 : 4, a = spanOf(fx, fy), b = spanOf(fx, fz), c = spanOf(fy, fz), X = planes(fx), Y = planes(fy), Z = planes(fz); if (!a || !b || !c || !inSpans(a, Z) || !inSpans(b, Y) || !inSpans(c, X)) continue;
    const sx = fx ? 1 : -1, sy = fy & 1 ? 1 : -1, sz = fz & 1 ? 1 : -1, i = S.v(X, Y - sy * r0, Z - sz * r0, sx, 0, 0, wear, fx), j = S.v(X - sx * r0, Y, Z - sz * r0, 0, sy, 0, wear, fy), k = S.v(X - sx * r0, Y - sy * r0, Z, 0, 0, sz, wear, fz);
    sx * sy * sz > 0 ? S.tri(i, j, k) : S.tri(i, k, j);
  }
}

/* boîte biseautée autonome (reliefs) ; mask : bits des faces à garder */
function rbox(S, x0, x1, y0, y1, z0, z1, r, mask = 63, wearK = .3) {
  const b = { lo: [x0, y0, z0], hi: [x1, y1, z1] }, R = fullRects(b); for (let f = 0; f < 6; f++) if (!(mask >> f & 1)) R[f] = [];
  meshBox(S, b, R, { r, wear: wearK, wob: 0, seg: 9 }, { lod: 0, noAO: true });
}

/* bloc en relief (10 triangles) : face plate et pourtour en pente jusqu'au support ; A = axe normal */
function relief(S, A, sg, pl, u0, u1, v0, v1, d, slope = .016, wear = -.16) {
  if (u1 - u0 < .01 || v1 - v0 < .01) return;
  const U = A === 0 ? 2 : 0, V = A === 1 ? 2 : 1, f = 2 * A + (sg > 0 ? 1 : 0), sl = Math.min(slope, (u1 - u0) * .3, (v1 - v0) * .3), p = [0, 0, 0], n = [0, 0, 0];
  const mk = (u, v, dd, nu, nv, nn, k) => { p[A] = pl + sg * dd; p[U] = u; p[V] = v; n[A] = sg * nn; n[U] = nu; n[V] = nv; return S.v(p[0], p[1], p[2], n[0], n[1], n[2], k, f) };
  const a0 = u0 + sl, a1 = u1 - sl, b0 = v0 + sl, b1 = v1 - sl;
  S.quad(mk(a0, b0, d, 0, 0, 1, wear * .6), mk(a1, b0, d, 0, 0, 1, wear * .6), mk(a1, b1, d, 0, 0, 1, wear * .6), mk(a0, b1, d, 0, 0, 1, wear * .6));
  const Q = .707, side = (x0, y0, x1, y1, X0, Y0, X1, Y1, nu, nv) => S.quad(mk(x0, y0, d, nu * Q, nv * Q, Q, wear), mk(x1, y1, d, nu * Q, nv * Q, Q, wear), mk(X1, Y1, -.005, nu * Q, nv * Q, Q, .3), mk(X0, Y0, -.005, nu * Q, nv * Q, Q, .3));
  const up = A !== 1 && v0 > 2.1, low = A !== 1 && v1 < 1.3; if (!up) side(a1, b1, a0, b1, u1, v1, u0, v1, 0, 1); if (!low) side(a0, b0, a1, b0, u0, v0, u1, v0, 0, -1); side(a1, b0, a1, b1, u1, v0, u1, v1, 1, 0); side(a0, b1, a0, b0, u0, v1, u0, v0, -1, 0);
}

/* ---------- faces coussinées (sacs, hesco) ---------- */
const FLAT_BEVEL = .026;
function pillowFace(S, b, f, R, cfg, P, exposed, lod, coarse) {
  const A = f >> 1, B = (A + 1) % 3, C = (A + 2) % 3, sg = f & 1 ? 1 : -1, pl = (f & 1) ? b.hi[A] : b.lo[A];
  let [pw, ph, bulge, rec] = cfg; if (P.rigid) { bulge = 0; if (lod || coarse) { pw = 2.2; ph = 2.2 } } else { if (lod) { pw *= 2.2; ph *= 2.2 } if (coarse) { pw *= 2.6; ph *= 2.6 } } const pullR = P.rigid ? FLAT_BEVEL : rec, edgeLift = P.rigid ? 0 : -rec, tk = P.rigid ? .3 : 1;
  /* rangées horizontales si la face est verticale (axe Y = B ou C) */
  const rowAxisB = B === 1, W0 = rowAxisB ? R.c0 : R.b0, W1 = rowAxisB ? R.c1 : R.b1, H0 = rowAxisB ? R.b0 : R.c0, H1 = rowAxisB ? R.b1 : R.c1;
  const vertical = A !== 1, rigid = !!P.rigid, edgesOf = (a, e, q) => { const o = [a]; for (let k = Math.ceil(a / q); k * q < e; k++) if (k * q > a + .2 && k * q < e - .2) o.push(k * q); o.push(e); return o }, rowE = rigid ? edgesOf(H0, H1, ph) : null, colE = rigid ? edgesOf(W0, W1, pw) : null, gW = W0, gH = H0, rows = rigid ? rowE.length - 1 : Math.max(1, Math.round((H1 - H0) / (vertical ? ph : Math.min(ph * 2.1, .5)))), rh = rigid ? ph : (H1 - H0) / rows;
  const nor = [0, 0, 0], pos = [0, 0, 0], ao = P.ao || .4;
  const put = (w, h, lift, tw, th) => { const bv = rowAxisB ? h : w, cv = rowAxisB ? w : h; pos[A] = pl + sg * lift; pos[B] = bv; pos[C] = cv;
    /* aux arêtes vives : rentre aussi dans l'autre axe pour fermer l'angle entre deux faces creusées */
    const pu = pullR, at = g => { const G = g >> 1, H = (G + 1) % 3, J = (G + 2) % 3, q = [0, 0, 0]; q[A] = pl; q[B] = bv; q[C] = cv; for (const e of exposed.R[g]) if (q[H] >= e.b0 - EPS && q[H] <= e.b1 + EPS && q[J] >= e.c0 - EPS && q[J] <= e.c1 + EPS) return true; return false }; const pb0 = bv <= b.lo[B] + EPS && at(2 * B), pb1 = bv >= b.hi[B] - EPS && at(2 * B + 1), pc0 = cv <= b.lo[C] + EPS && at(2 * C), pc1 = cv >= b.hi[C] - EPS && at(2 * C + 1); if (pb0) pos[B] += pu; if (pb1) pos[B] -= pu; if (pc0) pos[C] += pu; if (pc1) pos[C] -= pu;
    nor[A] = sg; const tb = (rowAxisB ? th : tw) * tk, tc = (rowAxisB ? tw : th) * tk; nor[B] = tb; nor[C] = tc; const l = Math.hypot(nor[0], nor[1], nor[2]) || 1; const e = Math.max(Math.abs(tw), Math.abs(th));
    return S.v(pos[0], pos[1], pos[2], nor[0] / l, nor[1] / l, nor[2] / l, e > .5 ? ao : e > .2 ? ao * .2 : -.1, f) };
  /* jupe : là où le rectangle s'arrête contre un volume voisin, le creux des joints est refermé (sinon une fente montre l'intérieur) */
  const openAt = (g, bv, cv) => { const G = g >> 1, H = (G + 1) % 3, J = (G + 2) % 3, q = [0, 0, 0]; q[A] = pl; q[B] = bv; q[C] = cv; for (const e of exposed.R[g]) if (q[H] >= e.b0 - EPS && q[H] <= e.b1 + EPS && q[J] >= e.c0 - EPS && q[J] <= e.c1 + EPS) return true; return false };
  const skirt = (b0, c0, b1, c1, nb, nc) => { if (P.rigid) return; const mk = (bb, cc, d) => { pos[A] = pl - sg * d; pos[B] = bb; pos[C] = cc; const m = [0, 0, 0]; m[B] = nb; m[C] = nc; return S.v(pos[0], pos[1], pos[2], m[0], m[1], m[2], ao, f) }; S.quad(mk(b0, c0, rec + .004), mk(b1, c1, rec + .004), mk(b1, c1, -.002), mk(b0, c0, -.002)) };
  const cm = (R.c0 + R.c1) / 2, bm = (R.b0 + R.b1) / 2;
  if (!(Math.abs(R.b0 - b.lo[B]) < EPS && openAt(2 * B, R.b0, cm))) skirt(R.b0, R.c0, R.b0, R.c1, 1, 0);
  if (!(Math.abs(R.b1 - b.hi[B]) < EPS && openAt(2 * B + 1, R.b1, cm))) skirt(R.b1, R.c0, R.b1, R.c1, -1, 0);
  if (!(Math.abs(R.c0 - b.lo[C]) < EPS && openAt(2 * C, bm, R.c0))) skirt(R.b0, R.c0, R.b1, R.c0, 0, 1);
  if (!(Math.abs(R.c1 - b.hi[C]) < EPS && openAt(2 * C + 1, bm, R.c1))) skirt(R.b0, R.c1, R.b1, R.c1, 0, -1);
  for (let j = 0; j < rows; j++) {
    const h0 = rigid ? rowE[j] : H0 + j * rh, h1 = rigid ? rowE[j + 1] : h0 + rh, cols = rigid ? colE.length - 1 : Math.max(1, Math.round((W1 - W0) / pw)), cw = rigid ? pw : (W1 - W0) / cols, off = !rigid && (j & 1) ? cw * .5 : 0, seed = j * 13 + Math.round(pl * 7); if (h1 - h0 < .02) continue;
    for (let i = (off ? -1 : 0); i < cols; i++) {
      const w0 = rigid ? colE[i] : Math.max(W0, gW + i * cw + off), w1 = rigid ? colE[i + 1] : Math.min(W1, gW + (i + 1) * cw + off); if (w1 - w0 < .05) continue;
      const lift = bulge * (.82 + .3 * rn(i, seed)) * (w1 - w0 < cw * .7 ? .8 : 1), jit = P.rigid ? 0 : 1, wm = (w0 + w1) / 2 + jit * (rn(i + 1, seed) - .5) * (w1 - w0) * .12, hm = (h0 + h1) / 2 + jit * (rn(i, seed + 2) - .5) * rh * .1, sag = jit * (rn(i, seed + 5) - .5) * rh * .16, rc = Math.min(rec, (w1 - w0) * .22, rh * .22);
      /* 4 x 3 sommets : bords enfoncés, ventre bombé */
      const g = [];
      for (let q = 0; q < 3; q++) { const hh = q === 0 ? h0 : q === 1 ? hm + sag * .3 : h1; for (let p = 0; p < 3; p++) { const ww = p === 0 ? w0 : p === 1 ? wm : w1, ew = p === 0 ? -1 : p === 2 ? 1 : 0, eh = q === 0 ? -1 : q === 2 ? 1 : 0, edge = ew !== 0 || eh !== 0, cn = ew !== 0 && eh !== 0; g.push(put(ww, hh, edge ? edgeLift : lift, ew * (edge ? .75 : .2), eh * (edge ? .75 : .2))) } }
      for (let q = 0; q < 2; q++) for (let p = 0; p < 2; p++) { const a = g[q * 3 + p], bb = g[q * 3 + p + 1], c = g[(q + 1) * 3 + p + 1], d = g[(q + 1) * 3 + p]; const flip = rowAxisB ? sg > 0 : sg < 0; flip ? S.quad(a, bb, c, d) : S.quad(d, c, bb, a) }
    }
  }
}

/* dessous d'une tôle larmée en hauteur (passerelle, mezzanine) : triangles tournés vers le bas déplacés dans le lot acier lisse ; le motif de
   marche se voyait au plafond (TEXTURE QA). Mêmes positions, normales et UV : aucune forme ni collision changée. */
function moveTris(S, i0, T, pred, uvS) {
  if (!T || T === S) return; const keep = [], I = S.i, N = S.n, P = S.p;
  for (let t = i0; t + 2 < I.length; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2];
    if (pred(N[a * 3], N[a * 3 + 1], N[a * 3 + 2]) && pred(N[b * 3], N[b * 3 + 1], N[b * 3 + 2]) && pred(N[c * 3], N[c * 3 + 1], N[c * 3 + 2])) for (const v of [a, b, c]) { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2]; let U = S.u[v * 2], V = S.u[v * 2 + 1];
      if (uvS) { const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz); if (ax >= ay && ax >= az) { U = z / uvS; V = y / uvS } else if (ay >= az) { U = x / uvS; V = z / uvS } else { U = x / uvS; V = y / uvS } }
      T.i.push(T.vu(x, y, z, nx, ny, nz, S.a[v], U, V)) }
    else keep.push(a, b, c) }
  I.length = i0; for (const v of keep) I.push(v);
}
const underSteel = (S, i0, T) => moveTris(S, i0, T, (nx, ny) => ny < -.9);
/* ---------- révolution : fûts, citernes ---------- */
function lathe(S, cx, cy, cz, axis, prof, seg, ao) {
  const N = prof.length, ca = axis === 'x' ? 1 : 0;
  /* UV (TEXTURE QA) : flancs en coordonnées cylindriques (tour en tuiles entières, longueur de méridien), fonds à plat ; la projection par
     normale de sommet changeait d'axe à 45° (raccords, bandes étirées). Un anneau est doublé là où le mode change : aucune bande de transition. */
  const us = S.uvS, Rm = Math.max(...prof.map(p => p[0])), ku = (q => q >= 1 ? Math.round(q) : q)(2 * PI * Rm / us), arc = [0], mode = [], ring = (i, md) => {
    const [rad, h, k] = prof[i], pv = prof[Math.max(0, i - 1)], nx = prof[Math.min(N - 1, i + 1)], dr = nx[0] - pv[0], dh = nx[1] - pv[1], l = Math.hypot(dr, dh) || 1, nr = -dh / l, nh = dr / l, b0 = S.p.length / 3;
    for (let j = 0; j <= seg; j++) { const t = j / seg * 2 * PI, c = Math.cos(t), s = Math.sin(t), x = ca ? cx + h : cx + rad * c, y = ca ? cy + rad * c : cy + h, z = cz + rad * s, U = md ? (ca ? z : x) / us : ca ? arc[i] / us : j / seg * ku, V = md ? (ca ? y : z) / us : ca ? j / seg * ku : arc[i] / us;   /* couché (axe x) : v autour, les coulures restent verticales sur les flancs */
      if (ca) S.vu(x, y, z, nh, nr * c, nr * s, k || ao || 0, U, V); else S.vu(x, y, z, nr * c, nh, nr * s, k || ao || 0, U, V) }
    return b0 };
  for (let i = 0; i < N; i++) { if (i) arc.push(arc[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1])); const pv = prof[Math.max(0, i - 1)], nx = prof[Math.min(N - 1, i + 1)], dr = nx[0] - pv[0], dh = nx[1] - pv[1]; mode.push(Math.abs(dr) / (Math.hypot(dr, dh) || 1) > .7 ? 1 : 0) }
  const w = seg + 1; let cur = ring(0, mode[0]);
  for (let i = 0; i < N - 1; i++) { const md = mode[i], nxt = ring(i + 1, md); for (let j = 0; j < seg; j++) { const a = cur + j, b = a + 1, c = nxt + j + 1, d = nxt + j; ca ? S.quad(a, d, c, b) : S.quad(a, b, c, d) } cur = mode[i + 1] === md ? nxt : ring(i + 1, mode[i + 1]) }
  void w;
}

/* ---------- pierre taillée : relief sur un mur ---------- */
function prism(S, A, sg, plane, pts, proud, ao) {          // pts : polygone convexe (u,y) dans le plan du mur ; A = axe normal (0 ou 2)
  const mk = (u, y, d, nx, ny, nz, k) => A === 0 ? S.v(plane + sg * d, y, u, nx, ny, nz, k, sg > 0 ? 1 : 0) : S.v(u, y, plane + sg * d, nx, ny, nz, k, sg > 0 ? 5 : 4), N = pts.length, n = [0, 0, 0]; n[A] = sg;
  const rev = (A === 0) === (sg > 0);        // sens du polygone vu de l'extérieur
  const f = pts.map(p => mk(p[0], p[1], proud, n[0], n[1], n[2], -.14));
  for (let i = 1; i + 1 < N; i++) rev ? S.tri(f[0], f[i + 1], f[i]) : S.tri(f[0], f[i], f[i + 1]);
  let cu = 0, cy = 0; for (const p of pts) { cu += p[0] / N; cy += p[1] / N }
  for (let i = 0; i < N; i++) {
    const p = pts[i], q = pts[(i + 1) % N]; let du = q[0] - p[0], dy = q[1] - p[1]; const l = Math.hypot(du, dy) || 1; du /= l; dy /= l; let nu = dy, ny = -du; if (nu * ((p[0] + q[0]) / 2 - cu) + ny * ((p[1] + q[1]) / 2 - cy) < 0) { nu = -nu; ny = -ny }
    const s = [0, ny, 0]; s[A === 0 ? 2 : 0] = nu; const a = mk(p[0], p[1], proud, s[0], s[1], s[2], -.1), b = mk(q[0], q[1], proud, s[0], s[1], s[2], -.1), c = mk(q[0], q[1], -.006, s[0], s[1], s[2], .3), d = mk(p[0], p[1], -.006, s[0], s[1], s[2], .3);
    rev ? S.quad(a, d, c, b) : S.quad(a, b, c, d);
  }
}

/* ---------- relief des grandes surfaces (rendu seul, collisions inchangées) ---------- */
const vn2 = (x, y, s) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy), a = rn(i + s, j), b = rn(i + 1 + s, j), c = rn(i + s, j + 1), d = rn(i + 1 + s, j + 1); return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w };
const fbm = (x, y, s) => vn2(x, y, s) * .58 + vn2(x * 2.3 + 5.1, y * 2.3 + 1.7, s + 17) * .29 + vn2(x * 5.3 + 2.2, y * 5.3 + 7.9, s + 41) * .13;
/* face en relief posée devant une face plane : décalage vers l'extérieur seulement, 8 mm au bord, `amp` au plus ; normales accentuées (k) */
function reliefOverlay(S, A, sg, pl, u0, u1, v0, v1, amp, g, seed, opt = {}) {
  const UA = A === 0 ? 2 : 0, VA = A === 1 ? 2 : 1, ins = opt.ins === undefined ? .1 : opt.ins, a0 = u0 + ins, a1 = u1 - ins, b0 = v0 + (opt.insV0 === undefined ? ins : opt.insV0), b1 = v1 - (opt.insV1 === undefined ? ins : opt.insV1);
  if (a1 - a0 < .3 || b1 - b0 < .3) return 0;
  const nu = Math.max(2, Math.round((a1 - a0) / g)), nv = Math.max(2, Math.round((b1 - b0) / g)), sc = opt.scale || .85, edge = opt.edge || .4, k = opt.k || 6, s = S.uvS, gy = opt.ground, strata = opt.strata || 0;
  const deep = opt.depth || 0, D = (u, v) => { const t = Math.min(u - a0, a1 - u, v - b0, b1 - v), tp = clamp(t / edge, 0, 1), e = tp * tp * (3 - 2 * tp), n = fbm(u * sc, v * sc, seed); return deep ? e * (-deep + (deep + amp) * clamp((n - .1) * 1.3, 0, 1)) : .008 + (amp - .008) * e * clamp((n - .12) * 1.35, 0, 1) };
  const idx = [], row = nu + 1, du0 = (a1 - a0) / nu, dv0 = (b1 - b0) / nv, Dg = new Float64Array(row * (nv + 1));
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) Dg[j * row + i] = D(a0 + du0 * i, b0 + dv0 * j);
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = a0 + du0 * i, v = b0 + dv0 * j, d = Dg[j * row + i], il = Math.max(0, i - 1), ir = Math.min(nu, i + 1), jl = Math.max(0, j - 1), jr = Math.min(nv, j + 1), hf = 5.3 * sc, ha = (deep ? deep + amp : amp) * .22 * (Math.abs(d) > .004 ? 1 : 0), du = ((Dg[j * row + ir] - Dg[j * row + il]) / ((ir - il) * du0) + ha * (vn2((u + .03) * hf, v * hf, seed + 41) - vn2((u - .03) * hf, v * hf, seed + 41)) / .06) * k, dv = ((Dg[jr * row + i] - Dg[jl * row + i]) / ((jr - jl) * dv0) + ha * (vn2(u * hf, (v + .03) * hf, seed + 41) - vn2(u * hf, (v - .03) * hf, seed + 41)) / .06) * k;
    const p = [0, 0, 0], n = [0, 0, 0]; p[A] = pl + sg * d; p[UA] = u; p[VA] = v; n[A] = sg; n[UA] = -du; n[VA] = -dv;
    let ao = deep ? .03 + clamp(-d / deep, 0, 1) * .26 * (opt.aoK || 1) : .02 + (1 - (d - .008) / (amp - .008 || 1)) * .24; if (gy !== undefined && gy !== null && VA === 1) ao += .16 * clamp(1 - (v - gy) / .7, 0, 1);
    if (strata && VA === 1) { const w = Math.abs(fract(v * strata + .35 * fbm(u * .25, v * .4, seed + 7)) - .5); ao += .16 * (opt.aoK || 1) * clamp(1 - w / .07, 0, 1) }
    idx.push(S.vu(p[0], p[1], p[2], n[0], n[1], n[2], clamp(ao, 0, .34), p[UA] / s, p[VA] / s));
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) S.quad(idx[j * row + i], idx[j * row + i + 1], idx[(j + 1) * row + i + 1], idx[(j + 1) * row + i]);
  return nu * nv * 2;
}
/* rect (b, c) d'une face -> (u, v) de reliefOverlay */
const faceUV = (A, r) => { const B = (A + 1) % 3, UA = A === 0 ? 2 : 0, VA = A === 1 ? 2 : 1; return [UA === B ? r.b0 : r.c0, UA === B ? r.b1 : r.c1, VA === B ? r.b0 : r.c0, VA === B ? r.b1 : r.c1] };
const inRects = (rects, pb, pc) => rects.some(r => pb >= r.b0 - 1e-6 && pb <= r.b1 + 1e-6 && pc >= r.c0 - 1e-6 && pc <= r.c1 + 1e-6);

/* bourrelet continu le long d'une arête haute (neige ou roche) : profil arrondi, hauteur et débord variables, sans boîtes */
function edgeRoll(S, A, sg, pl, u0, u1, y, seed, hMax, ovMax, inset, reg, opt = {}) {
  const U = A === 0 ? 2 : 0, n = Math.max(2, Math.round((u1 - u0) / (opt.step || .45))), s = S.uvS, rows = [], cr = opt.crest || 0;
  const H = u => { const t = Math.min(u - u0, u1 - u), e = clamp(t / .3, 0, 1); if (cr) { const m = fbm(u * .32, 7.3, seed + 3), pt = clamp((m - .4) / .08, 0, 1), pt2 = clamp((m - .58) / .06, 0, 1), sh = pt * pt * (3 - 2 * pt) * .55 + pt2 * pt2 * (3 - 2 * pt2) * .45; return e * (m < .3 ? .02 : .04 + cr * sh + hMax * .5 * fbm(u * .9, 3.7, seed)) } return e * (.035 + hMax * clamp((fbm(u * .9, 3.7, seed) - .15) * 1.4, 0, 1)) }, OV = u => { const t = Math.min(u - u0, u1 - u), e = clamp(t / .3, 0, 1); return e * ovMax * fbm(u * .7, 9.1, seed + 5) };
  /* profil (distance vers l'extérieur, hauteur, normale vers l'extérieur, normale verticale) */
  const lite = !!opt.lite, mxI = opt.maxIn || 1e9; let insMax = 0; const prof = (h, ov) => { const ins = Math.min(inset + (cr ? h * 1.15 : 0), mxI); if (ins > insMax) insMax = ins; return lite ? [[-ins, -.005, 0, 1], [-ins * .35, h, .35, .94], [ov, h * .45, .95, .3], [ov * .6, -.03, .9, -.42]] : [[-ins, -.005, 0, 1], [-ins * .45, h * .85, .25, .97], [ov * .3, h, .6, .8], [ov, h * .55, .97, .25], [ov * .7, -.03, .9, -.42]] };
  let hiY = y;
  for (let i = 0; i <= n; i++) { const u = u0 + (u1 - u0) * i / n, h = H(u), ov = OV(u), row = []; let arc = 0, prev = null; if (y + h > hiY) hiY = y + h;
    for (const [d, yy, nA, nY] of prof(h, ov)) { const p = [0, 0, 0], q = [0, 0, 0]; p[A] = pl + sg * d; p[U] = u; p[1] = y + yy; q[A] = sg * nA; q[1] = nY; if (prev) arc += Math.hypot(d - prev[0], yy - prev[1]); prev = [d, yy];
      row.push(S.vu(p[0], p[1], p[2], q[0], q[1], q[2], .06 + (yy < 0 ? .12 : 0), u / s, arc / s)) }
    rows.push(row) }
  for (let i = 0; i < n; i++) for (let k = 0; k < rows[i].length - 1; k++) S.quad(rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]);
  const a = pl - sg * (insMax + .01), b = pl + sg * ovMax; reg(A === 0 ? { kind: 'drift', x0: Math.min(a, b), x1: Math.max(a, b), z0: u0, z1: u1, y0: y - .04, y1: hiY + .01 } : { kind: 'drift', x0: u0, x1: u1, z0: Math.min(a, b), z1: Math.max(a, b), y0: y - .04, y1: hiY + .01 });
}
/* jupe au pied d'une paroi : talus d'éboulis ou de neige, hauteur et largeur variables (pièce libre, hors collision) */
function edgeSkirt(S, A, sg, pl, u0, u1, y, seed, hMax, wMax, reg, step = .5, lite = false) {
  const U = A === 0 ? 2 : 0, n = Math.max(2, Math.round((u1 - u0) / step)), s = S.uvS, rows = [];
  for (let i = 0; i <= n; i++) { const u = u0 + (u1 - u0) * i / n, t = Math.min(u - u0, u1 - u), e = clamp(t / .4, 0, 1), h = e * (.03 + hMax * clamp((fbm(u * .7, 2.9, seed) - .22) * 1.9, 0, 1) + .06 * fbm(u * 2.4, 5.5, seed + 3)), w = .15 + e * wMax * clamp((fbm(u * .45, 6.1, seed + 9) - .15) * 1.6, 0, 1), row = []; let arc = 0, prev = null;
    for (const [d, yy, nA, nY] of lite ? [[-.04, h, .35, .94], [w * .45, h * .55, .4, .92], [w, -.03, .15, .99]] : [[-.04, h, .35, .94], [w * .3, h * .72, .45, .9], [w * .7, h * .25, .3, .95], [w, -.03, .15, .99]]) { const p = [0, 0, 0], q = [0, 0, 0]; p[A] = pl + sg * d; p[U] = u; p[1] = y + yy; q[A] = sg * nA; q[1] = nY; if (prev) arc += Math.hypot(d - prev[0], yy - prev[1]); prev = [d, yy];
      row.push(S.gnd ? S.v(p[0], p[1], p[2], q[0], q[1], q[2], d < .05 ? .2 : .04, 3) : S.vu(p[0], p[1], p[2], q[0], q[1], q[2], d < .05 ? .22 : .08, u / s, arc / s)) }
    rows.push(row) }
  for (let i = 0; i < n; i++) for (let k = 0; k < rows[i].length - 1; k++) S.quad(rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]);
  const a = pl - sg * .05, b = pl + sg * (.2 + wMax); reg(A === 0 ? { kind: 'drift', x0: Math.min(a, b), x1: Math.max(a, b), z0: u0, z1: u1, y0: y - .05, y1: y + .05 + hMax } : { kind: 'drift', x0: u0, x1: u1, z0: Math.min(a, b), z1: Math.max(a, b), y0: y - .05, y1: y + .05 + hMax });
}
/* bloc de pierre rapporté : faces explicites, flancs ombrés */
function blockBox(S, lo, hi, skip, front, aoF, aoS) {
  const s = S.uvS;
  for (let f = 0; f < 6; f++) { if (f === skip || f === 2) continue; const A = f >> 1, sg = f & 1 ? 1 : -1, B = (A + 1) % 3, C = (A + 2) % 3, pl = sg > 0 ? hi[A] : lo[A], n = [0, 0, 0], UA = A === 0 ? 2 : 0, VA = A === 1 ? 2 : 1, v = []; n[A] = sg;
    for (const [bb, cc] of [[lo[B], lo[C]], [hi[B], lo[C]], [hi[B], hi[C]], [lo[B], hi[C]]]) { const p = [0, 0, 0]; p[A] = pl; p[B] = bb; p[C] = cc; v.push(S.vu(p[0], p[1], p[2], n[0], n[1], n[2], f === front ? aoF : aoS, p[UA] / s, p[VA] / s)) }
    S.quad(v[0], v[1], v[2], v[3]) }
}
/* parois rocheuses : les grandes faces latérales sont remplacées par une surface en relief (creux dans l'épaisseur, 9 cm de saillie au plus) */
const outward = (b, f, SZ) => { const A = f >> 1; return A !== 1 && ((f & 1) ? b.hi[A] >= SZ - .5 : -b.lo[A] >= SZ - .5) };
function rockReliefFaces(b, R, SZ = 1e9) {
  const lo = b.lo, hi = b.hi; if (hi[1] - lo[1] < .5 || Math.max(hi[0] - lo[0], hi[2] - lo[2]) < 1.6 || Math.min(hi[0] - lo[0], hi[2] - lo[2]) < .55) return null;
  const big = r => (r.b1 - r.b0) > .45 && (r.c1 - r.c0) > .45 && (r.b1 - r.b0) * (r.c1 - r.c0) > .5, faces = [0, 1, 4, 5].filter(f => !outward(b, f, SZ) && R[f].some(big)); if (!faces.length) return null;
  return { faces, mesh: R.map((l, f) => faces.includes(f) ? l.filter(r => !big(r)) : l) };
}
function sculptRock(det, fr, b, R, o, reg, lod, RR, skirtM, SZ = 1e9) {
  const lo = b.lo, hi = b.hi, dx = hi[0] - lo[0], dy = hi[1] - lo[1], dz = hi[2] - lo[2]; if (lod || !RR) return;
  const snow = b.m === 'snow', S = det(b.m, o, (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2), FR = S, seed = Math.round(lo[0] * 7 + lo[2] * 13 + hi[1] * 3) % 997;
  for (const f of RR.faces) { const A = f >> 1, sg = f & 1 ? 1 : -1, pl = sg > 0 ? hi[A] : lo[A]; for (const r of R[f]) { if (!((r.b1 - r.b0) > .45 && (r.c1 - r.c0) > .45 && (r.b1 - r.b0) * (r.c1 - r.c0) > .5)) continue; const [u0, u1, v0, v1] = faceUV(A, r), big = (u1 - u0) * (v1 - v0) > 40, edgeF = SZ - Math.abs(pl) < 12, far = big && edgeF; reliefOverlay(S, A, sg, pl, u0, u1, v0, v1, .09, far ? 1.9 : big ? .95 : edgeF ? .7 : .45, seed + f * 31, { depth: Math.min(snow ? .2 : .28, (Math.min(dx, dz) - .2) / 2, dy * .35), ins: 0, edge: Math.min(.45, dy * .4), k: snow ? 2 : 3, scale: snow ? .5 : far ? .45 : .85, strata: snow ? 0 : 1.3, aoK: .8, ground: lo[1] < .05 ? lo[1] : null }); if (lo[1] < .05 && dy >= 1 && v0 <= lo[1] + .01 && u1 - u0 > 1) edgeSkirt(det('gnd', null, (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2), A, sg, pl, u0 + .02, u1 - .02, lo[1], seed + f * 7, skirtM ? .42 : .3, .7, reg, u1 - u0 > 20 ? 1.1 : .5, u1 - u0 > 20) } }
  /* arête haute arrondie et irrégulière quand le dessus est à l'air (parois de 1,5 m et plus) */
  for (const f of [0, 1, 4, 5]) { if (outward(b, f, SZ)) continue; const A = f >> 1, sg = f & 1 ? 1 : -1, pl = sg > 0 ? hi[A] : lo[A]; if (!skirtM && SZ - Math.abs(pl) < 12) continue; for (const r of R[f]) { const [u0, u1, , v1] = faceUV(A, r); if (v1 < hi[1] - .01 || u1 - u0 < .6) continue; const tp = [0, 0, 0]; tp[A] = pl - sg * .3; tp[A === 0 ? 2 : 0] = (u0 + u1) / 2; tp[1] = hi[1]; if (!inRects(R[3], tp[2], tp[0])) continue; edgeRoll(FR, A, sg, pl, u0 + .02, u1 - .02, hi[1], seed + f * 17, snow ? .22 : dy >= 1.5 ? .18 : .05, snow ? .09 : dy >= 1.5 ? .08 : .035, Math.min(dy >= 1.5 || snow ? .35 : .14, hi[A] - lo[A] - .04), reg, { crest: dy >= 1.5 ? .4 : 0, step: u1 - u0 > 20 ? 1.1 : .45, lite: u1 - u0 > 20, maxIn: hi[A] - lo[A] - .04 }) } }
}
/* congère sur un chaperon de neige : dessus bosselé et corniche irrégulière qui déborde un peu (pièces libres, au-dessus de la collision) */
function snowCap(fr, b, R, o, reg, lod) {
  const lo = b.lo, hi = b.hi, dy = hi[1] - lo[1]; if (lod || dy > .3 || lo[1] < .5 || Math.min(hi[0] - lo[0], hi[2] - lo[2]) < .5) return;
  const cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2, S = fr('snow', o, cx, cz), seed = Math.round(lo[0] * 5 + lo[2] * 11) % 991;
  if (!lod) for (const r of R[3]) { const [u0, u1, v0, v1] = faceUV(1, r); reliefOverlay(S, 1, 1, hi[1], u0, u1, v0, v1, .2, .55, seed, { ins: .03, edge: .35, scale: .45, k: 1.8 }) }
  for (const f of [0, 1, 4, 5]) { const A = f >> 1, sg = f & 1 ? 1 : -1, pl = sg > 0 ? hi[A] : lo[A]; for (const r of R[f]) { const [u0, u1] = faceUV(A, r); if (u1 - u0 > .6) edgeRoll(S, A, sg, pl, u0 + .02, u1 - .02, hi[1], seed + f * 13, .2, .09, Math.min(.3, hi[A] - lo[A] - .04), reg, { crest: u1 - u0 > 6 ? .45 : 0, step: u1 - u0 > 20 ? .6 : .45, maxIn: hi[A] - lo[A] - .04 }) } }
}
/* murs isolés en maçonnerie : chaînes de pierre, soubassement, chaperon à couvertines et dés, reprises */
function dressLongWall(det, fr, b, R, o, used, roofs, grid, reg, lod, hid = null) {
  const lo = b.lo, hi = b.hi, dx = hi[0] - lo[0], dy = hi[1] - lo[1], dz = hi[2] - lo[2], long = Math.max(dx, dz), thin = Math.min(dx, dz);
  const cast = b.m === 'conc'; if (o.bq || long < 4 || dy < (cast ? 1.5 : .8) || dy > 4.5 || lo[1] > .05) return; const thick = thin > 1.1;
  const cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
  if (roofs.some(r => cx > r.x0 - .3 && cx < r.x1 + .3 && cz > r.z0 - .3 && cz < r.z1 + .3)) return;
  if (!thick && grid.each(lo[0], hi[0], lo[2], hi[2], q => q !== b && q.lo[1] >= hi[1] - .05 && q.lo[1] <= hi[1] + .3 && q.lo[0] < hi[0] - .05 && q.hi[0] > lo[0] + .05 && q.lo[2] < hi[2] - .05 && q.hi[2] > lo[2] + .05)) return;
  const LA = dx >= dz ? 0 : 2, TA = 2 - LA, seed = Math.round(lo[LA] * 3 + lo[TA] * 17 + hi[1] * 5) % 983, S = det(b.m, o, cx, cz);
  const trimM = b.m === 'stone' ? (used.has('conc') ? 'conc' : 'stone') : used.has('stone') ? 'stone' : used.has('conc') ? 'conc' : b.m, T = det(trimM, null, cx, cz), Tf = T;
  /* reprises seulement sur enduit (brique ou pierre mise à nu) : sur un parement de pierre, une pièce claire se lisait comme un défaut */
  const patchM = b.m.startsWith('plaster') ? (used.has('brick') ? 'brick' : used.has('stone') ? 'stone' : null) : null;
  const cut = (f, a0, a1, y0, y1, t0, t1, ins) => { if (!hid) return; const l3 = [0, 0, 0], h3 = [0, 0, 0]; l3[LA] = a0; h3[LA] = a1; l3[1] = y0; h3[1] = y1; l3[TA] = t0; h3[TA] = t1; const A = f >> 1, B = (A + 1) % 3, C = (A + 2) % 3; hid.push({ f, b0: l3[B] + ins, b1: h3[B] - ins, c0: l3[C] + ins, c1: h3[C] - ins }) };
  const box = (Sk, a0, a1, y0, y1, t0, t1, r = 0, mask = 63) => LA === 0 ? rbox(Sk, a0, a1, y0, y1, t0, t1, r, mask, .3) : rbox(Sk, t0, t1, y0, y1, a0, a1, r, mask, .3);
  const fOf = sg => TA * 2 + (sg > 0 ? 1 : 0), BB = (TA + 1) % 3, vis = (sg, a, y) => { const p = [0, 0, 0]; p[LA] = a; p[1] = y; return inRects(R[fOf(sg)], p[BB], p[(TA + 2) % 3]) };
  const n = Math.max(1, Math.round(long / 3.3)), step = long / n, pil = [];
  for (let k = 1; k < n; k++) pil.push(lo[LA] + k * step);
  for (const sg of [-1, 1]) {
    const pl = sg > 0 ? hi[TA] : lo[TA], t0 = Math.min(pl, pl + sg * .075), t1 = Math.max(pl, pl + sg * .075);
    /* chaînes d'angle en pierre : blocs alternés long / court calés sur les assises du parement, joint visible, 4 à 6 cm de saillie, flancs ombrés */
    const ch = b.m === 'stone' ? .52 : .45, back = TA * 2 + (sg > 0 ? 0 : 1), front = TA * 2 + (sg > 0 ? 1 : 0);
    for (const a of pil) { if (!(vis(sg, a - .2, lo[1] + .45) && vis(sg, a + .2, lo[1] + .45) && vis(sg, a, hi[1] - .15))) continue; if (lod || cast) { box(T, a - .24, a + .24, lo[1], hi[1] - .03, Math.min(pl, pl + sg * .05), Math.max(pl, pl + sg * .05), lod ? 0 : .012, 63 & ~(1 << back)); cut(front, a - .24, a + .24, lo[1] - .1, hi[1] - .03, pl, pl, .005); continue } let y = lo[1] + .3, k = Math.round(a * 7);
      while (y < hi[1] - .12) { const yt = Math.min(hi[1] - .03, (Math.floor(y / ch + 1e-6) + 1) * ch); if (yt - y < .12) { y = yt; k++; continue } const lg = !(k & 1), half = lg ? .3 : .17, pr = lg ? .058 : .044, d1 = pl + sg * pr;
        const lo3 = [0, 0, 0], hi3 = [0, 0, 0]; lo3[LA] = a - half; hi3[LA] = a + half; lo3[1] = y + .009; hi3[1] = yt - .009; lo3[TA] = Math.min(pl, d1); hi3[TA] = Math.max(pl, d1); blockBox(T, lo3, hi3, back, front, .03, .24); cut(front, lo3[LA], hi3[LA], lo3[1], hi3[1], pl, pl, .005); y = yt; k++ } }
    if (lod) continue;
    /* soubassement : par tronçon visible au pied du mur */
    let a = lo[LA] + .05; while (a < hi[LA] - .05) { if (!vis(sg, a + .02, lo[1] + .1)) { a += .25; continue } let e = a; while (e < hi[LA] - .05 && vis(sg, e + .02, lo[1] + .1)) e += .25; e = Math.min(e, hi[LA] - .02); if (e - a > .4) { box(T, a, e, lo[1], lo[1] + .3, Math.min(pl, pl + sg * .045), Math.max(pl, pl + sg * .045)); cut(fOf(sg), a, e, lo[1] - .1, lo[1] + .3, pl, pl, .005) } a = e + .25 }
    /* reprises d'enduit ou de parement */
    if (patchM) for (let k = 0; k < Math.max(1, Math.round(long / 9)); k++) { const w = .6 + rn(seed + k, sg + 3) * .9, h = .35 + rn(seed + k, sg + 5) * .6, c = lo[LA] + .5 + rn(seed + k, sg + 7) * (long - 1 - w), y = lo[1] + .45 + rn(seed + k, sg + 9) * Math.max(0, dy - 1.2 - h);
      if (pil.some(p => p > c - .25 && p < c + w + .25)) continue; if (!vis(sg, c, y) || !vis(sg, c + w, y + h)) continue; box(det(patchM, null, cx, cz), c, c + w, y, y + h, Math.min(pl, pl + sg * .012), Math.max(pl, pl + sg * .012)); cut(fOf(sg), c, c + w, y, y + h, pl, pl, .005) }
    /* (barbacanes retirées : un carré clair à cette distance se lisait comme un défaut) */
  }
  /* chaperon : couvertines débordantes, dés plus hauts au droit des pilastres, un tronçon cassé de temps en temps ; rien là où quelque chose repose sur l'arête */
  const cuts = [lo[LA], ...pil, hi[LA]], bands = thick ? [-1, 1].filter(sg => vis(sg, (lo[LA] + hi[LA]) / 2, hi[1] - .1)).map(sg => { const pl = sg > 0 ? hi[TA] : lo[TA]; return [Math.min(pl - sg * .36, pl + sg * .05), Math.max(pl - sg * .36, pl + sg * .05), Math.min(pl - sg * .46, pl + sg * .07), Math.max(pl - sg * .46, pl + sg * .07)] }) : [[lo[TA] - .05, hi[TA] + .05, lo[TA] - .07, hi[TA] + .07]];
  const clear = (a0, a1, t0, t1) => { const x0 = LA === 0 ? a0 : t0, x1 = LA === 0 ? a1 : t1, z0 = LA === 0 ? t0 : a0, z1 = LA === 0 ? t1 : a1; return !grid.each(x0, x1, z0, z1, q => q !== b && q.lo[1] <= hi[1] + .3 && q.hi[1] > hi[1] + .1 && q.lo[0] < x1 && q.hi[0] > x0 && q.lo[2] < z1 && q.hi[2] > z0) };
  const put = (a0, a1, t0, t1, h) => { if (!clear(a0, a1, t0, t1)) return; box(Tf, a0, a1, hi[1], hi[1] + h, t0, t1, lod ? 0 : .012); cut(3, a0, a1, hi[1], hi[1], t0, t1, lod ? .005 : .015); reg(LA === 0 ? { kind: 'coping', x0: a0, x1: a1, z0: t0, z1: t1, y0: hi[1], y1: hi[1] + h } : { kind: 'coping', x0: t0, x1: t1, z0: a0, z1: a1, y0: hi[1], y1: hi[1] + h }) };
  for (const [t0, t1, p0, p1] of bands) {
    for (let k = 0; k < cuts.length - 1; k++) { if (cuts.length > 3 && rn(seed + k, 13 + t0) < .16) continue; const a0 = cuts[k] + (k ? .27 : -.03), a1 = cuts[k + 1] - (k < cuts.length - 2 ? .27 : -.03); if (a1 - a0 < .2) continue; put(a0, a1, t0, t1, .07) }
    for (const a of pil) put(a - .27, a + .27, p0, p1, .11 + rn(seed, a) * .04);
  }
}

/* roches : la surface visible recouvre l'enveloppe de collision (couches de 0,7 m) à 20 cm près */
const ROCK_LY = [0, .7, 1.4, 2.1, 2.8, 4.2, 5.6, 7, 8.4, 4.5, 6.9, 9.3];
function rockEnvelopes(L) {
  const M = new WeakMap(), S = L.solids, G = new Map(), C = 4, K = (i, j) => (i + 999) * 2048 + j + 999;
  S.forEach((s, n) => { for (let i = Math.floor(s.x0 / C); i <= Math.floor(s.x1 / C); i++) for (let j = Math.floor(s.z0 / C); j <= Math.floor(s.z1 / C); j++) { const k = K(i, j); let l = G.get(k); if (!l) G.set(k, l = []); l.push(n) } });
  for (const o of L.ops) { if (o.t !== 'k' || o.fine) continue; const Rr = Math.max(o.sx, o.sz) * 1.3 + .5, y0 = o.y - o.sy * .65 - .5, y1 = o.y + o.sy * 1.3 + .5, seen = new Set(), env = [];
    for (let i = Math.floor((o.x - Rr) / C); i <= Math.floor((o.x + Rr) / C); i++) for (let j = Math.floor((o.z - Rr) / C); j <= Math.floor((o.z + Rr) / C); j++) for (const n of G.get(K(i, j)) || []) { if (seen.has(n)) continue; seen.add(n); const s = S[n];
      if (s.x0 >= o.x - Rr && s.x1 <= o.x + Rr && s.z0 >= o.z - Rr && s.z1 <= o.z + Rr && s.y0 >= y0 && s.y1 <= y1 && ROCK_LY.some(y => Math.abs(s.y0 - y) < 1e-3)) env.push(s) }
    if (env.length) M.set(o, env) }
  return M;
}
function swellFn(o, env, mg = .2) {
  if (!env || !env.length) return p => p;
  const cx = o.x, cy = o.y, cz = o.z, iv = [];
  return p => { const dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz, r = Math.hypot(dx, dy, dz); if (r < 1e-6) return p; const ux = dx / r, uy = dy / r, uz = dz / r; iv.length = 0;
    for (const s of env) { let t0 = 0, t1 = 1e9, ok = true; for (let ax = 0; ax < 3 && ok; ax++) { const o0 = ax === 0 ? cx : ax === 1 ? cy : cz, d = ax === 0 ? ux : ax === 1 ? uy : uz, a = ax === 0 ? s.x0 : ax === 1 ? s.y0 : s.z0, b = ax === 0 ? s.x1 : ax === 1 ? s.y1 : s.z1; if (Math.abs(d) < 1e-9) { if (o0 < a || o0 > b) ok = false; continue } let ta = (a - o0) / d, tb = (b - o0) / d; if (ta > tb) { const q = ta; ta = tb; tb = q } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) ok = false } if (ok && t1 > t0) iv.push(t0, t1) }
    /* couverture continue depuis le centre ; si le centre est dehors (roche adossée à un mur), depuis la première couche rencontrée avant la surface */
    let start = .05; if (!iv.some((v, k) => !(k & 1) && v <= .05)) { start = 1e9; for (let k = 0; k < iv.length; k += 2) if (iv[k] < start) start = iv[k]; if (start > r + .3) start = -1 }
    let end = -1, found = start >= 0; while (found) { found = false; for (let k = 0; k < iv.length; k += 2) { const a = iv[k], b = iv[k + 1]; if ((end < 0 ? a <= start + 1e-6 : a <= end + .05) && b > end) { end = b; found = true } } }
    const R2 = Math.max(r, end - mg); return R2 <= r + 1e-4 ? p : [cx + ux * R2, cy + uy * R2, cz + uz * R2] };
}

/* ---------- construction ---------- */
export function* softenBuild(L, UVS, opt = {}) {
  if (!SOFT_ENVS.has(L.env)) return null;
  const RLF = RELIEF_ENVS.has(L.env), lod = (opt.q | 0) >= 2 ? 1 : 0, sinks = new Map(), skip = new Set(), CH = L.chunk || 0, SZ = L.size, stat = { boxes: 0, hiddenFaces: 0, faces: 0 };
  const used = new Set(L.ops.map(o => o.m)), STONE = used.has('stone') ? 'stone' : 'conc';
  const sink = (m, o, x, z, detail) => { const base = o && o.bq ? m + '|' + o.bq : CH ? m + '|' + Math.floor((x + SZ) / CH) + '|' + Math.floor((z + SZ) / CH) : m, k = lod ? base : base + '|ns' + (detail === 2 ? '|fr' : ''); let s = sinks.get(k); if (!s) { s = new Sink(m, o && o.bq ? o : null, UVS[m] || 3); s.cx = x; s.cz = z; s.key = k; s.sfx = lod ? '' : '|ns' + (detail === 2 ? '|fr' : ''); if (m === 'gnd') s.gnd = SZ + 2; sinks.set(k, s) } return s };
  const detail = (m, o, x, z) => sink(m, o, x, z, 1), freeS = (m, o, x, z) => sink(m, o, x, z, 2), free = [], reg = q => free.push(q);

  /* 1. boîtes alignées (b, et r à un quart de tour près) */
  const NOP = { length: 0, push() {} }, boxes = [], grid = new Grid(2), rot = [], shP = lod ? NOP : [], shI = lod ? NOP : [];
  for (let i = 0; i < L.ops.length; i++) {
    const o = L.ops[i]; let b = null; if (o.fine || o.under || (opt.skipOp && opt.skipOp(o))) continue;
    if (o.t === 'b') b = { lo: [o.x0, o.y0, o.z0], hi: [o.x1, o.y1, o.z1], m: o.m, o, fit: !!o.fit, i };
    else if (o.t === 'r') {
      const q = ((o.ry % (PI / 2)) + PI / 2) % (PI / 2);
      if (q < 1e-4 || PI / 2 - q < 1e-4) { const odd = Math.round(o.ry / (PI / 2)) & 1, w = odd ? o.d : o.w, d = odd ? o.w : o.d; b = { lo: [o.x - w / 2, o.y, o.z - d / 2], hi: [o.x + w / 2, o.y + o.h, o.z + d / 2], m: o.m, o, fit: /^cont\d/.test(o.m), i } }   /* MAP QA : marquage des conteneurs du décor dans le bon sens */
      else if (PROF[o.m] && Math.min(o.w, o.h, o.d) >= .1 && !/^far/.test(o.m)) rot.push(o);
    }
    if (!b || /^far/.test(o.m)) continue;
    b.pri = ZP[o.m] || 0; b.occ = !NO_OCC.test(o.m); boxes.push(b); if (b.occ) grid.add(b);
  }
  yield;

  /* 2. ouvertures (mêmes règles que deriveProps) */
  const openings = [], near = (a, b, e = .012) => Math.abs(a - b) < e, isF = o => o && o.t === 'b' && o.m === 'frame';
  for (let i = 0; i + 1 < L.ops.length; i++) {
    const A = L.ops[i], B = L.ops[i + 1]; if (!isF(A) || !isF(B) || !near(A.y0, B.y0) || !near(A.y1, B.y1)) continue;
    const wx = A.x1 - A.x0, wz = A.z1 - A.z0; let ax, a, b, c, th;
    if (near(wx, .09) && near(B.x1 - B.x0, .09) && wz > .15 && near(A.z0, B.z0)) { ax = 0; a = A.x1; b = B.x0; c = (A.z0 + A.z1) / 2; th = wz - .1 }
    else if (near(wz, .09) && near(B.z1 - B.z0, .09) && wx > .15 && near(A.x0, B.x0)) { ax = 2; a = A.z1; b = B.z0; c = (A.x0 + A.x1) / 2; th = wx - .1 } else continue;
    if (!(b - a > .5)) continue; i++;
    let sill = false; for (let k = i + 1; k <= i + 2 && k < L.ops.length; k++) { const q = L.ops[k]; if (isF(q) && near(q.y1, A.y0) && near(q.y1 - q.y0, .06)) sill = true }
    openings.push({ ax, a, b, c, th, y0: A.y0, y1: A.y1, sill });
  }

  const seen = reachSolids(L); yield; const roofs = L.env === 'bunker' ? [] : planRoofs(L, boxes, seen); grid.rects = roofs; yield; const faceCuts = planOpenings(openings, grid, lod); yield;

  /* 3. pièces remplacées */
  const replaced = new Set(), rockEnv = RLF ? rockEnvelopes(L) : new WeakMap();
  for (let i = 0; i < L.ops.length; i++) {
    const o = L.ops[i]; if (o.fine || o.under || (opt.skipOp && opt.skipOp(o))) continue;
    if (!lod && o.t === 'c' && o.m === 'barrel' && Math.abs(o.r - .34) < .001 && !o.rz) {             // fût : cerclages, sertis, couvercle creux
      const S = sink('barrel', o, o.x, o.z), H = o.h / 2, R = o.r, seg = lod ? 10 : 14;
      lathe(S, o.x, o.y, o.z, 'y', [[0, H - .032, .2], [R * .84, H - .032, .24], [R * .97, H + .001, -.2], [R + .006, H - .03, -.15], [R - .004, H - .06, .12], [R, .3, 0], [R + .013, .275, -.12], [R, .25, .1], [R, -.25, .1], [R + .013, -.275, -.12], [R, -.3, 0], [R - .004, -H + .06, .12], [R + .006, -H + .03, -.15], [R * .96, -H, .3]], seg);
      if (!o.ns) shadowPrism(shP, shI, 'y', [o.x, o.y, o.z], o.r, o.h / 2); skip.add(o); replaced.add(o);
    } else if (o.t === 'c' && o.m === 'barrel' && o.r > 1 && o.rz) {                          // citerne couchée à fonds bombés
      const S = sink('barrel', o, o.x, o.z), R = o.r, H = o.h / 2, D = .62, pr = [], seg = lod ? 12 : 24;
      for (let k = 0; k <= 5; k++) { const t = k / 5 * PI / 2; pr.push([Math.max(.001, R * Math.sin(t)), H - D * (1 - Math.cos(t)), k === 5 ? .1 : 0]) }
      if (!lod) for (const u of [H - D - .04, 1.1, -1.1, -H + D + .04]) pr.push([R, u + .05, .12], [R + .012, u + .035, -.16], [R + .012, u - .035, -.16], [R, u - .05, .12]);
      for (let k = 5; k >= 0; k--) { const t = k / 5 * PI / 2; pr.push([Math.max(.001, R * Math.sin(t)), -H + D * (1 - Math.cos(t)), k === 5 ? .1 : 0]) }
      lathe(S, o.x, o.y, o.z, 'x', pr, seg); if (!o.ns) shadowPrism(shP, shI, 'x', [o.x, o.y, o.z], R, H); skip.add(o); replaced.add(o);
    } else if (o.t === 'k') {                                                                  // roche : même forme, dense, normales lissées
      const S = sink(o.m, o, o.x, o.z); const env = rockEnv.get(o); organicRock(S, o, lod, rockCount(L), env); if (!lod && !o.ns) shadowRock(shP, shI, o, env); if (env) reg({ kind: 'rock-env', x0: Math.min(o.x - o.sx * 1.4, ...env.map(q => q.x0)) - .3, x1: Math.max(o.x + o.sx * 1.4, ...env.map(q => q.x1)) + .3, z0: Math.min(o.z - o.sz * 1.4, ...env.map(q => q.z0)) - .3, z1: Math.max(o.z + o.sz * 1.4, ...env.map(q => q.z1)) + .3, y0: -1, y1: Math.max(...env.map(q => q.y1)) + .5 }); skip.add(o); replaced.add(o); if (!(replaced.size & 3)) yield;
    }
  }
  yield;

  /* ombres des pièces remplacées : formes exactes, posées à leur création */
  /* 4. exposition et maillage */
  let n = 0;
  for (const b of boxes) {
    const o = b.o; if (skip.has(o)) continue; if (!(++n & 23)) yield;
    const P = PROF[b.m], S = sink(b.m, o, (b.lo[0] + b.hi[0]) / 2, (b.lo[2] + b.hi[2]) / 2); stat.boxes++;
    const R = fullRects(b);
    if (b.occ || true) for (let f = 0; f < 6; f++) {
      const A = f >> 1, B = (A + 1) % 3, C = (A + 2) % 3, sg = f & 1 ? 1 : -1, pl = sg > 0 ? b.hi[A] : b.lo[A];
      let l = R[f];
      grid.each(b.lo[0] - .02, b.hi[0] + .02, b.lo[2] - .02, b.hi[2] + .02, q => {
        if (q === b || !l.length) return;
        const beyond = sg > 0 ? q.lo[A] <= pl + EPS && q.hi[A] > pl + EPS : q.hi[A] >= pl - EPS && q.lo[A] < pl - EPS,
          coplanar = sg > 0 ? Math.abs(q.hi[A] - pl) < EPS : Math.abs(q.lo[A] - pl) < EPS;
        if (!beyond && !(coplanar && (q.pri < b.pri || (q.pri === b.pri && q.i > b.i)))) return;
        if (q.hi[B] <= b.lo[B] + EPS || q.lo[B] >= b.hi[B] - EPS || q.hi[C] <= b.lo[C] + EPS || q.lo[C] >= b.hi[C] - EPS) return;
        l = subRect(l, q.lo[B], q.hi[B], q.lo[C], q.hi[C]);
      });
      if (A !== 1) { const fc = faceCuts.get(A + '|' + sg + '|' + Math.round(pl * 1000)); if (fc) for (const q of fc) { l = A === 0 ? subRect(l, q.v0, q.v1, q.u0, q.u1) : subRect(l, q.u0, q.u1, q.v0, q.v1); if (!l.length) break } }
      if (!l.length) stat.hiddenFaces++; else stat.faces++;
      R[f] = l.length > 1 ? mergeRects(l) : l;
    }
    shadowFaces(shP, shI, b, R);
    if (P && P.masonry && !lod) roundCorners(S, b, R, grid, lod);
    let Rw = R; if (RLF && P && P.masonry) { const wc = []; dressLongWall(detail, freeS, b, R, o, used, roofs, grid, reg, lod, wc); if (wc.length) Rw = R.map((l, f) => { for (const c of wc) if (c.f === f && l.length) l = subRect(l, c.b0, c.b1, c.c0, c.c1); return l }) }
    S.fit = b.fit ? b : null;
    if (!P) { meshBox(S, b, R, { r: 0 }, { lod, noBevel: true, noAO: true, grid }); S.fit = null; continue }
    if (P.pillow && lod) meshBox(S, b, R, { r: 0 }, { lod, noBevel: true, noAO: true, grid });
    else if (P.pillow) {
      const Rp = P.rigid && b.lo[1] < .01 ? R.map((l, f) => f === 2 ? [] : l) : R;
      for (let f = 0; f < 6; f++) for (const r of R[f]) { if (f === 2 && b.lo[1] < .05) continue; pillowFace(S, b, f, r, P.pillow, P, { R: Rp }, lod, !!o.bq) }   /* MAP QA : dessous visible d'un gabion ou d'un sac surélevé (toit des casemates : on voyait le ciel au plafond) */
      if (P.rigid) meshBox(S, b, Rp, { r: FLAT_BEVEL, wear: .08, wob: 0, seg: 9 }, { lod: 0, noFaces: true });
    } else if (/^cont/.test(b.m) && !lod && b.lo[1] < 5) container(S, sink, b, R, lod, o);
    else {
      const RR = RLF && !lod && (b.m === 'rock' || b.m === 'rockS' || (b.m === 'snow' && b.hi[1] - b.lo[1] > .35)) && !o.bq ? rockReliefFaces(b, R, SZ) : null; const i0 = S.i.length, v0b = S.p.length / 3; meshBox(S, b, RR ? RR.mesh : Rw, P, RR ? { lod, grid, noBevel: true } : { lod, grid });
      if (S.fit && /^cont\d/.test(b.m)) { const wx = b.hi[0] - b.lo[0] >= b.hi[2] - b.lo[2]; for (let v = v0b; v < S.p.length / 3; v++) { const nx = S.n[v * 3], ny = S.n[v * 3 + 1], nz = S.n[v * 3 + 2]; if (Math.abs(ny) > .9) S.u[v * 2 + 1] *= .7; else if (Math.abs(wx ? nx : nz) > .9) S.u[v * 2] = .58 + S.u[v * 2] * .4 } }   /* conteneur sans tôle détaillée (basse qualité, empilés hauts) : toit et bouts sans marquage (TEXTURE QA) */ if (b.m === 'plate' && b.lo[1] > .05) underSteel(S, i0, sink('steel', o, (b.lo[0] + b.hi[0]) / 2, (b.lo[2] + b.hi[2]) / 2));
      else if (b.m === 'tile' && !o.bq) { /* dalle de toit en tuiles : tranches et dessous au matériau du mur porteur (bande de tuiles sur les façades, tuiles sous l'avant-toit, TEXTURE QA) */
        let wm = null, best = 0; grid.each(b.lo[0] - .02, b.hi[0] + .02, b.lo[2] - .02, b.hi[2] + .02, q => { if (q === b || q.m === b.m || !PROF[q.m] || PROF[q.m].pillow || Math.abs(q.hi[1] - b.lo[1]) > .03 || q.hi[1] - q.lo[1] < 1) return; const ov = Math.max(0, Math.min(q.hi[0], b.hi[0]) - Math.max(q.lo[0], b.lo[0])) + Math.max(0, Math.min(q.hi[2], b.hi[2]) - Math.max(q.lo[2], b.lo[2])); if (ov > best) { best = ov; wm = q } });
        if (wm) { const Tw = sink(wm.m, wm.o, (wm.lo[0] + wm.hi[0]) / 2, (wm.lo[2] + wm.hi[2]) / 2);   /* même lot que le mur porteur : pas d'appel de dessin en plus */ moveTris(S, i0, Tw, (nx, ny) => Math.abs(ny) < .3 || ny < -.9, Tw.uvS) } }
      if (RR) sculptRock(detail, freeS, b, R, o, reg, lod, RR, used.has('snow') && L.env === 'snow' ? 'snow' : null, SZ);
      if (b.m === 'crate') crateTrim(S, b, R, lod);
    }
    S.fit = null;
    if (P.masonry) dressWall(detail, b, R, P, grid, STONE, lod, o); else if ((b.m === 'corr' || b.m === 'rust') && !o.bq) dressMetal(detail, b, R, grid, used, lod, o);
    if (RLF && !P.masonry && b.m === 'snow' && !o.bq) snowCap(detail, b, R, o, reg, lod);
    if (!lod && !o.bq && b.lo[1] < .01 && b.hi[1] > .8 && (P.masonry || P.pillow || b.m === 'corr' || b.m === 'rust')) footings(detail, b, R, P, grid, L, openings, lod);
  }
  /* 5. boîtes tournées : biseau simple */
  for (const o of rot) {
    if (skip.has(o)) continue; if (!(++n & 63)) yield;
    shadowRot(shP, shI, o); const P = PROF[o.m], S = sink(o.m, o, o.x, o.z); S.xf = { c: Math.cos(o.ry), s: Math.sin(o.ry), x: o.x, z: o.z };
    const b = { lo: [-o.w / 2, o.y, -o.d / 2], hi: [o.w / 2, o.y + o.h, o.d / 2], rot: 1 }; S.fit = /^cont\d/.test(o.m) ? b : null; const v0r = S.p.length / 3; meshBox(S, b, fullRects(b), P, { lod, noAO: true });
    if (S.fit) { const c = S.xf.c, s = S.xf.s, wx = o.w >= o.d; for (let v = v0r; v < S.p.length / 3; v++) { const nx = S.n[v * 3], ny = S.n[v * 3 + 1], nz = S.n[v * 3 + 2]; if (Math.abs(ny) > .9) S.u[v * 2 + 1] *= .7; else if (Math.abs(wx ? nx * c - nz * s : nx * s + nz * c) > .9) S.u[v * 2] = .58 + S.u[v * 2] * .4 } }   /* toit et bouts sans marquage (TEXTURE QA) */
    S.xf = null; S.fit = null; skip.add(o);   /* MAP QA : conteneurs tournés en UV de boîte (la projection monde inversait et répétait le marquage) */
  }
  for (const b of boxes) if (!skip.has(b.o)) skip.add(b.o);
  /* 6. encadrements */
  if (!lod) for (const O of openings) { dressOpening2(detail, O, grid, STONE, lod, used); if (!(++n & 31)) yield }
  /* 6 bis. toits : pente sur ce qui est inaccessible, couronnement extérieur et mobilier mince ailleurs */
  for (const r of roofs) { const wall = roofWall(boxes, r), trim = wall === 'conc' ? 'conc' : STONE, tile = used.has('tile') ? 'tile' : used.has('rust') ? 'rust' : 'corr'; if (r.closed) pitchedRoof(freeS, r, tile, wall, used.has('steel') && !used.has('tile') ? 'steel' : trim, shP, shI, reg); else crownRoof(freeS, detail, r, grid, L, seen, used, wall, trim, shP, shI, reg, lod); yield }
  /* 7. gravats au pied des murs */
  if (!lod) debris(detail, boxes, grid, STONE, lod, L); yield;
  for (const b of boxes) { delete b._s }
  return { skip, sinks, stat, free, roofs, reach: seen, openings: openings.length, shadow: L.shadowProxy || lod ? packShadow([], []) : packShadow(shP, shI), *commit(Bf) { for (const s of sinks.values()) { for (const q of lod ? [s] : splitSink(s, SZ)) { commitSink(q, Bf); yield } } } };
}

function packShadow(p, i) { return { p: Float32Array.from(p), i: p.length / 3 > 65535 ? Uint32Array.from(i) : Uint16Array.from(i) } }
/* ombre : faces exposées à plat, sans biseau */
const NO_CAST = /^(far|lamp|hull|fence|glass|chain)/, PAL_NS = new Set(['steel', 'rubber', 'frame', 'glass', 'pipeY', 'pipeR', 'asph', 'chain', 'lightW', 'lightR']);
function shadowFaces(P, I, b, R) {
  const o = b.o; if (NO_CAST.test(b.m) || o.ns || (o.bq && PAL_NS.has(b.m))) return;
  for (let f = 0; f < 6; f++) { const A = f >> 1, B = (A + 1) % 3, C = (A + 2) % 3, sg = f & 1 ? 1 : -1, pl = sg > 0 ? b.hi[A] : b.lo[A]; for (const r of R[f]) { const n = P.length / 3, q = [0, 0, 0], put = (u, v) => { q[A] = pl; q[B] = u; q[C] = v; P.push(q[0], q[1], q[2]) }; put(r.b0, r.c0); put(r.b1, r.c0); put(r.b1, r.c1); put(r.b0, r.c1); sg > 0 ? I.push(n, n + 1, n + 2, n, n + 2, n + 3) : I.push(n, n + 2, n + 1, n, n + 3, n + 2) } }
}
/* ombres des pièces remplacées (haute qualité) : volumes simples, faces tournées vers l'extérieur */
function shadowSolid(P, I, pts, tris, c) { const b = P.length / 3; for (const p of pts) P.push(p[0], p[1], p[2]); for (const [i, j, k] of tris) { const A = pts[i], B = pts[j], C = pts[k], ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, d = nx * ((A[0] + B[0] + C[0]) / 3 - c[0]) + ny * ((A[1] + B[1] + C[1]) / 3 - c[1]) + nz * ((A[2] + B[2] + C[2]) / 3 - c[2]); if (d >= 0) I.push(b + i, b + j, b + k); else I.push(b + i, b + k, b + j) } }
function shadowPrism(P, I, ax, c, r, half, n = 8) { const pts = [], tris = [], at = (u, v, w) => ax === 'y' ? [c[0] + u, c[1] + w, c[2] + v] : [c[0] + w, c[1] + u, c[2] + v]; for (const w of [-half, half]) for (let k = 0; k < n; k++) { const a = k / n * 2 * Math.PI; pts.push(at(r * Math.cos(a), r * Math.sin(a), w)) } for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; tris.push([k, k1, n + k1], [k, n + k1, n + k]) } for (let k = 1; k < n - 1; k++) tris.push([0, k, k + 1], [n, n + k, n + k + 1]); shadowSolid(P, I, pts, tris, c) }
function shadowRock(P, I, o, env = null) { const c = Math.cos(o.ry), s = Math.sin(o.ry), v = o.v, t = (1 + Math.sqrt(5)) / 2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]], IX = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1]; const shape = (x, y, z) => { const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l; const n = 1 + .22 * Math.sin(x * 3.1 + v * 1.7) * Math.cos(z * 2.7 - v) + .12 * Math.sin(y * 5 + v * 2.3), f = .03 * Math.sin(x * 9 + y * 7 + v) * Math.cos(z * 8 - y * 5) + .016 * Math.sin(x * 21 - z * 17 + y * 13 + v), k = (n + f) * .97; return [x * k, Math.max(y * k, -.6), z * k] }; const W = (p) => { const X = p[0] * o.sx, Z = p[2] * o.sz; return [o.x + X * c + Z * s, o.y + p[1] * o.sy, o.z - X * s + Z * c] }; const SWF = swellFn(o, env), Wv = p => SWF(W(p)), pts = [], tris = [], D = 2; for (let f = 0; f < 60; f += 3) { const A = V[IX[f]], B = V[IX[f + 1]], C = V[IX[f + 2]], b0 = pts.length, row = []; let k = 0; for (let i = 0; i <= D; i++) { row.push(k); k += D - i + 1 } for (let i = 0; i <= D; i++) for (let j = 0; j <= D - i; j++) { const a = 1 - (i + j) / D, bb = i / D, e = j / D; pts.push(Wv(shape(A[0] * a + B[0] * bb + C[0] * e, A[1] * a + B[1] * bb + C[1] * e, A[2] * a + B[2] * bb + C[2] * e))) } for (let i = 0; i < D; i++) for (let j = 0; j < D - i; j++) { tris.push([b0 + row[i] + j, b0 + row[i + 1] + j, b0 + row[i] + j + 1]); if (j < D - i - 1) tris.push([b0 + row[i + 1] + j, b0 + row[i + 1] + j + 1, b0 + row[i] + j + 1]) } } shadowSolid(P, I, pts, tris, [o.x, o.y, o.z]) }
function shadowRot(P, I, o) { if (NO_CAST.test(o.m) || o.ns || (o.bq && PAL_NS.has(o.m))) return; const c = Math.cos(o.ry), n = Math.sin(o.ry), hw = o.w / 2, hd = o.d / 2, base = P.length / 3; for (const y of [o.y, o.y + o.h]) for (const [x, z] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) P.push(o.x + x * c + z * n, y, o.z - x * n + z * c); for (const t of [[4, 6, 5], [4, 7, 6], [0, 5, 1], [0, 4, 5], [1, 6, 2], [1, 5, 6], [2, 7, 3], [2, 6, 7], [3, 4, 0], [3, 7, 4]]) I.push(base + t[0], base + t[1], base + t[2]) }

/* découpe spatiale d'un lot lourd (par centre de triangle) */
function splitSink(s, SZ) {
  const T = s.i.length / 3; if (T < 6000) return [s];
  const N = T > 25000 ? 4 : 3, W = 2 * (SZ + 8) / N, cellOf = v => clamp(Math.floor((v + SZ + 8) / W), 0, N - 1), parts = new Map(), remap = new Int32Array(s.p.length / 3);
  for (let t = 0; t < s.i.length; t += 3) { const a = s.i[t] * 3, b = s.i[t + 1] * 3, c = s.i[t + 2] * 3, k = cellOf((s.p[a] + s.p[b] + s.p[c]) / 3) + N * cellOf((s.p[a + 2] + s.p[b + 2] + s.p[c + 2]) / 3); let l = parts.get(k); if (!l) parts.set(k, l = []); l.push(s.i[t], s.i[t + 1], s.i[t + 2]) }
  const out = []; let stamp = 0; const seen = new Int32Array(s.p.length / 3);
  for (const [k, l] of parts) { stamp++; const q = new Sink(s.m, s.o, s.uvS); q.cx = s.cx; q.cz = s.cz; q.sfx = (s.sfx || '|ns') + '|' + k; for (const v of l) { if (seen[v] !== stamp) { seen[v] = stamp; remap[v] = q.p.length / 3; q.p.push(s.p[v * 3], s.p[v * 3 + 1], s.p[v * 3 + 2]); q.n.push(s.n[v * 3], s.n[v * 3 + 1], s.n[v * 3 + 2]); q.u.push(s.u[v * 2], s.u[v * 2 + 1]); q.a.push(s.a[v]) } q.i.push(remap[v]) } out.push(q) }
  return out;
}

/* vers les lots de maps.js */
function commitSink(s, Bf) {
  if (!s.p.length) return;
  const b = Bf(s.m, s.cx, s.cz, s.o, s.sfx === undefined ? '|ns' : s.sfx), base = b.p.length / 3, nV = s.p.length / 3, t = b.tint;
  for (let i = 0; i < s.p.length; i++) b.p.push(s.p[i]); for (let i = 0; i < s.n.length; i++) b.n.push(s.n[i]); for (let i = 0; i < s.u.length; i++) b.u.push(s.u[i]);
  if (t) for (let i = 0; i < nV; i++) b.c.push(t[0], t[1], t[2]); for (let i = 0; i < s.i.length; i++) b.i.push(base + s.i[i]);
  (b.ao || (b.ao = [])).push([base, Float32Array.from(s.a)]);
}
export function softenLevel(renderer) {
  try { const v = localStorage.getItem('frontzero.q'); if (v !== null) return parseInt(v) || 0 } catch { return 0 }
  try { const gl = renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'), n = d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : ''; return /NVIDIA|GeForce|RTX|GTX|Radeon RX|Radeon Pro|Apple M|Arc\(TM\) A/i.test(n) ? 0 : 2 } catch { return 0 }
}
/* accroche Batch.geo : attribut d'occlusion (0 pour les sommets non traités) */
export function softenGeo(b, g, THREE) { if (!b.ao) return; const a = new Float32Array(b.p.length / 3); for (const [o, v] of b.ao) a.set(v, o); g.setAttribute('fzAO', new THREE.BufferAttribute(a, 1)) }
/* accroche bakeHook : même programme pour toutes les cartes ; attribut absent = 0 = aucun effet */
export function softenShader(s) {
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float fzAO;varying float vFzAO;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFzAO=fzAO;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFzAO;').replace('#include <emissivemap_fragment>', 'diffuseColor.rgb*=1.-max(vFzAO,0.)+.7*max(-vFzAO,0.);\n#include <emissivemap_fragment>');
}

/* ---------- roche organique : icosphère dense sur la même fonction que maps.js ---------- */
const RK = new WeakMap(), rockCount = L => { let n = RK.get(L); if (n === undefined) RK.set(L, n = L.ops.filter(o => o.t === 'k').length); return n };
function organicRock(S, o, lod, nk = 0, env = null) {
  const c = Math.cos(o.ry), s = Math.sin(o.ry), v = o.v, D = lod ? 2 : nk <= 8 ? 6 : Math.max(o.sx, o.sy, o.sz) > 2.2 ? 4 : 3, t = (1 + Math.sqrt(5)) / 2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]], I = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
  const shape = (x, y, z) => { const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l; const n = 1 + .22 * Math.sin(x * 3.1 + v * 1.7) * Math.cos(z * 2.7 - v) + .12 * Math.sin(y * 5 + v * 2.3), f = .03 * Math.sin(x * 9 + y * 7 + v) * Math.cos(z * 8 - y * 5) + .016 * Math.sin(x * 21 - z * 17 + y * 13 + v), k = (n + f) * .97; return [x * k, Math.max(y * k, -.6), z * k] };
  const W = (p) => { const X = p[0] * o.sx, Z = p[2] * o.sz; return [o.x + X * c + Z * s, o.y + p[1] * o.sy, o.z - X * s + Z * c] };
  const SWF = swellFn(o, env, lod ? -.06 : .2), Wv = p => SWF(W(p));
  for (let f = 0; f < 60; f += 3) {
    const A = V[I[f]], B = V[I[f + 1]], C = V[I[f + 2]], idx = [], /* axe de projection pris sur la normale de la facette déformée (l'écart au centre, mis à l'échelle sx/sy/sz, choisissait l'axe le long de la face sur les rochers allongés : texture étirée en stries, MAP QA) */FA = Wv(shape(A[0], A[1], A[2])), FB = Wv(shape(B[0], B[1], B[2])), FC = Wv(shape(C[0], C[1], C[2])), e1x = FB[0] - FA[0], e1y = FB[1] - FA[1], e1z = FB[2] - FA[2], e2x = FC[0] - FA[0], e2y = FC[1] - FA[1], e2z = FC[2] - FA[2], qx = Math.abs(e1y * e2z - e1z * e2y), qy = Math.abs(e1z * e2x - e1x * e2z), qz = Math.abs(e1x * e2y - e1y * e2x), PAX = qx >= qy && qx >= qz ? 0 : qy >= qz ? 1 : 2, US = S.uvS;
    for (let i = 0; i <= D; i++) for (let j = 0; j <= D - i; j++) {
      const a = 1 - (i + j) / D, b = i / D, e = j / D, x = A[0] * a + B[0] * b + C[0] * e, y = A[1] * a + B[1] * b + C[1] * e, z = A[2] * a + B[2] * b + C[2] * e, P = Wv(shape(x, y, z)), h = .012;
      const l0 = Math.hypot(x, y, z), rx = x / l0, ry = y / l0, rz = z / l0, ux = ry, uy = -rx, uz = 0, ul = Math.hypot(ux, uy) || 1, tx = Math.abs(rz) > .9 ? 1 : ux / ul, ty = Math.abs(rz) > .9 ? 0 : uy / ul, tz = 0, bx = ry * tz - rz * ty, by = rz * tx - rx * tz, bz = rx * ty - ry * tx;
      const Q = (u, w) => Wv(shape(x + (tx * u + bx * w), y + (ty * u + by * w), z + (tz * u + bz * w))), T1 = Q(h, 0), T2 = Q(0, h), d1 = [T1[0] - P[0], T1[1] - P[1], T1[2] - P[2]], d2 = [T2[0] - P[0], T2[1] - P[1], T2[2] - P[2]]; let nx = d1[1] * d2[2] - d1[2] * d2[1], ny = d1[2] * d2[0] - d1[0] * d2[2], nz = d1[0] * d2[1] - d1[1] * d2[0];
      const ol = Math.hypot(P[0] - o.x, P[1] - o.y, P[2] - o.z) || 1; if (nx * (P[0] - o.x) + ny * (P[1] - o.y) + nz * (P[2] - o.z) < 0) { nx = -nx; ny = -ny; nz = -nz } const nl = Math.hypot(nx, ny, nz) || 1;
      void ol; const low = clamp((P[1] - Math.max(o.y - .6 * o.sy, 0)) / .55, 0, 1);
      idx.push([P[0], P[1], P[2], nx / nl, ny / nl, nz / nl, (1 - low) * .3 + (rn(Math.round(x * 5) + Math.round(z * 7), Math.round(y * 6)) - .5) * .08]);
    }
    /* axe de projection par petit triangle (normales lissées de ses sommets), sommets doublés seulement où l'axe change : la facette bombée
       tournait de travers à son axe unique (plages étirées et lissées, TEXTURE QA). Formes et collision inchangées. */
    void PAX; const vid = new Map(), vtx = (g, ax) => { const key = g * 3 + ax; let r = vid.get(key); if (r === undefined) { const q = idx[g]; r = S.vu(q[0], q[1], q[2], q[3], q[4], q[5], q[6], ax === 0 ? q[2] / US : q[0] / US, ax === 1 ? q[2] / US : q[1] / US); vid.set(key, r) } return r };
    const tri3 = (a, b, e) => { const qa = idx[a], qb = idx[b], qe = idx[e], ux = qb[0] - qa[0], uy = qb[1] - qa[1], uz = qb[2] - qa[2], wx = qe[0] - qa[0], wy = qe[1] - qa[1], wz = qe[2] - qa[2], sx = Math.abs(uy * wz - uz * wy), sy = Math.abs(uz * wx - ux * wz), sz = Math.abs(ux * wy - uy * wx), bx = sx >= sy && sx >= sz ? 0 : sy >= sz ? 1 : 2, cm = [sx, sy, sz], ax = cm[PAX] >= .75 * cm[bx] ? PAX : bx; S.tri(vtx(a, ax), vtx(b, ax), vtx(e, ax)) };   /* normale géométrique du triangle ; l'axe de la facette est gardé tant qu'il reste proche (moins d'îlots) : étirement ≤ 2,3 */
    let k = 0; const row = []; for (let i = 0; i <= D; i++) { row.push(k); k += D - i + 1 }
    for (let i = 0; i < D; i++) for (let j = 0; j < D - i; j++) { const a = row[i] + j, b = row[i + 1] + j, e = row[i] + j + 1; tri3(a, b, e); if (j < D - i - 1) { const d = row[i + 1] + j + 1; tri3(b, d, e) } }
  }
}

/* ---------- conteneur : tôle ondulée, montants et pièces de coin ---------- */
function container(S, sink, b, R, lod, o) {
  const lo = b.lo, hi = b.hi, st = sink('steel', o, (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2), D = .028, P = lod ? .42 : .3, post = .13;
  /* toit et fond : la bande basse de la texture (nervures et rouille, sans le marquage du flanc ; le texte s'affichait sur les toits, TEXTURE QA) */
  const uTop = S.u.length; meshBox(S, b, [R[0].length ? [] : [], R[1].length ? [] : [], R[2], R[3], [], []].map((l, f) => f < 2 ? [] : f < 4 ? l : []), PROF[b.m], { lod, noAO: true }); if (S.fit) for (let i = uTop + 1; i < S.u.length; i += 2) S.u[i] *= .7;
  for (const f of [0, 1, 4, 5]) {
    if (!R[f].length) continue;
    const A = f >> 1, U = A === 0 ? 2 : 0, sg = f & 1 ? 1 : -1, pl = sg > 0 ? hi[A] : lo[A], u0 = lo[U] + post, u1 = hi[U] - post, y0 = lo[1] + .12, y1 = hi[1] - .1, nn = Math.max(4, Math.round((u1 - u0) / P)), step = (u1 - u0) / nn;
    /* bout de 2,44 m : la partie sans marquage de la texture à l'échelle du flanc (le texte entier y était écrasé et coupé, MAP QA) */
    const F0 = S.fit; if (F0 && hi[U] - lo[U] < 3) { const W = 6.1, a = (f === 0 || f === 5) ? lo[U] - .58 * W : hi[U] - .42 * W, l2 = F0.lo.slice(), h2 = F0.hi.slice(); l2[U] = a; h2[U] = a + W; S.fit = { lo: l2, hi: h2 } }
    /* profil trapézoïdal : crête au plan du conteneur, creux à -D */
    let pv = null; const put = (u, d, nu, nA) => { const x = A === 0 ? pl - sg * d : u, z = A === 0 ? u : pl - sg * d, nx = A === 0 ? sg * nA : nu, nz = A === 0 ? nu : sg * nA, a = S.v(x, y0, z, nx, 0, nz, d > .01 ? .2 : -.06, f), c = S.v(x, y1, z, nx, 0, nz, d > .01 ? .2 : -.06, f); return [a, c] };
    const seq = []; for (let i = 0; i <= nn; i++) { const u = u0 + i * step; seq.push([u, 0, 0, 1]); if (i < nn) { seq.push([u + step * .18, 0, 0, 1], [u + step * .3, D, .7, .7], [u + step * .7, D, -.7, .7], [u + step * .82, 0, 0, 1]) } }
    for (const q of seq) { const v = put(q[0], q[1], q[2], q[3]); if (pv) { const flip = (A === 0) === (sg > 0); flip ? S.quad(pv[0], pv[1], v[1], v[0]) : S.quad(pv[0], v[0], v[1], pv[1]) } pv = v }
    S.fit = F0; const face = 1 << f;
    for (const u of [lo[U], hi[U] - post]) { const ux0 = u, ux1 = u + post; if (A === 0) rbox(st, sg > 0 ? pl - .05 : pl - .004, sg > 0 ? pl + .004 : pl + .05, lo[1], hi[1], ux0, ux1, .012, face | 12 | 16 | 32); else rbox(st, ux0, ux1, lo[1], hi[1], sg > 0 ? pl - .05 : pl - .004, sg > 0 ? pl + .004 : pl + .05, .012, face | 12 | 1 | 2) }
    for (const[v0, v1] of [[lo[1], lo[1] + .12], [hi[1] - .1, hi[1]]]) { if (A === 0) rbox(st, sg > 0 ? pl - .05 : pl - .004, sg > 0 ? pl + .004 : pl + .05, v0, v1, u0, u1, .01, face | 12); else rbox(st, u0, u1, v0, v1, sg > 0 ? pl - .05 : pl - .004, sg > 0 ? pl + .004 : pl + .05, .01, face | 12) }
    if (hi[U] - lo[U] < 3) { /* extrémité : barres de porte */
      for (const k of [.22, .4, .6, .78]) { const uc = lo[U] + (hi[U] - lo[U]) * k; if (A === 0) rbox(st, sg > 0 ? pl - .002 : pl - .022, sg > 0 ? pl + .022 : pl + .002, lo[1] + .14, hi[1] - .12, uc - .018, uc + .018, .006, face | 12 | 16 | 32); else rbox(st, uc - .018, uc + .018, lo[1] + .14, hi[1] - .12, sg > 0 ? pl - .002 : pl - .022, sg > 0 ? pl + .022 : pl + .002, .006, face | 12 | 1 | 2) }
    }
  }
  /* pièces de coin moulées */
  if (!lod) for (const x of [lo[0], hi[0]]) for (const z of [lo[2], hi[2]]) for (const y of [lo[1], hi[1]]) { const sx = x === lo[0] ? 1 : -1, sz = z === lo[2] ? 1 : -1, sy = y === lo[1] ? 1 : -1, c = .17, e = .012; rbox(st, Math.min(x - sx * e, x + sx * c), Math.max(x - sx * e, x + sx * c), Math.min(y, y + sy * .13), Math.max(y, y + sy * .13), Math.min(z - sz * e, z + sz * c), Math.max(z - sz * e, z + sz * c), .012) }
}

/* ---------- caisse : liteaux rapportés ---------- */
function crateTrim(S, b, R, lod) {
  if (lod) return;
  const lo = b.lo, hi = b.hi, t = .085, e = .014, dx = hi[0] - lo[0], dz = hi[2] - lo[2], dy = hi[1] - lo[1]; if (Math.min(dx, dz, dy) < .6) return;
  for (let f = 0; f < 6; f++) {
    if (f === 2 || !R[f].length) continue; const A = f >> 1, sg = f & 1 ? 1 : -1, pl = sg > 0 ? hi[A] : lo[A], back = 1 << (f ^ 1), mask = 63 & ~back;
    const P0 = sg > 0 ? pl - .003 : pl - e, P1 = sg > 0 ? pl + e : pl + .003;
    const bar = (u0, u1, v0, v1) => { if (A === 0) rbox(S, P0, P1, v0, v1, u0, u1, .006, mask, .22); else if (A === 2) rbox(S, u0, u1, v0, v1, P0, P1, .006, mask, .22); else rbox(S, u0, u1, P0, P1, v0, v1, .006, mask, .22) };
    const U0 = A === 0 ? lo[2] : lo[0], U1 = A === 0 ? hi[2] : hi[0], V0 = A === 1 ? lo[2] : lo[1], V1 = A === 1 ? hi[2] : hi[1];
    bar(U0, U1, V0, V0 + t); bar(U0, U1, V1 - t, V1); bar(U0, U0 + t, V0 + t, V1 - t); bar(U1 - t, U1, V0 + t, V1 - t);
  }
}

/* façade : extérieur ? (rien au-dessus à 0,7 m devant le mur) */
function isExterior(grid, A, sg, pl, u, y) { const X = A === 0 ? pl + sg * .7 : u, Z = A === 0 ? u : pl + sg * .7, Y = y - .9; let hit = false; if (grid.rects) for (const r of grid.rects) if (X > r.x0 + .01 && X < r.x1 - .01 && Z > r.z0 + .01 && Z < r.z1 - .01 && y <= r.y + .02) return false; grid.each(X, X, Z, Z, q => { if (X > q.lo[0] && X < q.hi[0] && Z > q.lo[2] && Z < q.hi[2] && q.lo[1] >= Y && q.hi[1] - q.lo[1] < 1.2 && q.hi[0] - q.lo[0] > 1.5 && q.hi[2] - q.lo[2] > 1.5) { hit = true; return true } }); return !hit }

/* ---------- habillage des murs : plinthe, chaînages d'angle, couvertine ---------- */
function dressWall(sink, b, R, P, grid, STONE, lod, o) {
  const lo = b.lo, hi = b.hi, h = hi[1] - lo[1], cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2, trimM = b.m === 'conc' ? 'conc' : STONE, S = sink(trimM, o, cx, cz);
  for (const f of [0, 1, 4, 5]) {
    const A = f >> 1, U = A === 0 ? 2 : 0, sg = f & 1 ? 1 : -1, pl = sg > 0 ? hi[A] : lo[A];
    for (const r of R[f]) {
      const u0 = A === 0 ? r.c0 : r.b0, u1 = A === 0 ? r.c1 : r.b1, v0 = A === 0 ? r.b0 : r.c0, v1 = A === 0 ? r.b1 : r.c1, um = (u0 + u1) / 2;
      if (u1 - u0 < .35 || v1 - v0 < .4 || !isExterior(grid, A, sg, pl, um, v1)) continue;
      /* soubassement fondu dans le mur */
      if (!lod && v0 <= .01 && lo[1] < .01 && h > 1) plinthBlend(sink(b.m, o, cx, cz), A, sg, pl, u0, u1, v1, Math.round(pl * 5) * 13 + f, lod);
      /* chaînage : seulement sur pierre et brique (et un enduit sur trois), à côté de l'arrondi */
      if (!lod && h > 2.2 && b.rnd && (b.m === 'stone' || b.m === 'brick')) for (const side of [0, 1]) {
        const su = side ? -1 : 1, uE = side ? hi[U] : lo[U], c = b.rnd.find(q => (A === 0 ? q.sx === sg && q.sz === (side ? 1 : -1) : q.sz === sg && q.sx === (side ? 1 : -1))); if (!c || Math.abs((side ? u1 : u0) - (uE + su * c.r)) > .02) continue;
        let y = v0 + (v0 < .01 ? .62 : .06), k = 0, ue = uE + su * (c.r + .012);
        while (y < v1 - .16) { const ch = .46 + rn(k, Math.round(uE * 5)) * .12, y1 = Math.min(v1 - .012, y + ch), len = (k & 1 ? .2 : .38) + rn(k + 2, Math.round(pl * 3)) * .08, a = su > 0 ? ue : ue - len, e = su > 0 ? ue + len : ue; if (e - a <= u1 - u0 + .01) relief(b.m === 'brick' ? sink('brick', o, cx, cz) : S, A, sg, pl, Math.max(a, u0), Math.min(e, u1), y, y1, .018, .014, .05 + rn(k, Math.round(uE * 3)) * .14); y = y1 + .014; k++ }
      }
    }
  }
  /* couvertine en pierres sur les murs à tête libre */
  const top = R[3]; if (!lod && top.length && hi[1] > 1.1 && hi[1] - lo[1] > .5 && P.masonry) for (const r of top) {
    const dx = (r.c1 - r.c0), dz = (r.b1 - r.b0);                                           // face +Y : b = z, c = x
    const alongX = dx >= dz, len = alongX ? dx : dz, wid = alongX ? dz : dx; if (wid > .75 || len < .5) continue;
    let a = alongX ? r.c0 : r.b0; const end = alongX ? r.c1 : r.b1; let k = 0;
    while (a < end - .02) { const L = lod ? end - a : Math.min(end - a, 1.5 + rn(k, Math.round((alongX ? lo[2] : lo[0]) * 7)) * .9), e = end - a - L < .4 ? end : a + L, y = hi[1] + (lod ? 0 : (rn(k + 7, Math.round(hi[1] * 3)) - .5) * .012);
      if (alongX) relief(S, 1, 1, y - .05, a + .003, e - .003, r.b0 - .032, r.b1 + .032, .082, .03); else relief(S, 1, 1, y - .05, r.c0 - .032, r.c1 + .032, a + .003, e - .003, .082, .03); a = e; k++ }
  }
}

/* ---------- bardage métallique : ossature, soubassement, lisses, rive ---------- */
function dressMetal(sink, b, R, grid, used, lod, o) {
  const lo = b.lo, hi = b.hi; if (hi[1] - lo[1] < 2.4) return;
  const cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2, St = sink('steel', o, cx, cz), Cu = sink(used.has('conc') ? 'conc' : 'steel', o, cx, cz), Ru = sink(used.has('rust') ? 'rust' : 'steel', o, cx, cz);
  for (const f of [0, 1, 4, 5]) {
    const A = f >> 1, U = A === 0 ? 2 : 0, sg = f & 1 ? 1 : -1, pl = sg > 0 ? hi[A] : lo[A];
    for (const r of R[f]) {
      const u0 = A === 0 ? r.c0 : r.b0, u1 = A === 0 ? r.c1 : r.b1, v0 = A === 0 ? r.b0 : r.c0, v1 = A === 0 ? r.b1 : r.c1; if (u1 - u0 < .3 || v1 - v0 < .5 || !isExterior(grid, A, sg, pl, (u0 + u1) / 2, v1)) continue;
      if (v0 < .02) relief(Cu, A, sg, pl, u0, u1, v0 - .01, Math.min(.46, v1), .042, .02);
      const y0 = Math.max(v0, v0 < .02 ? .46 : v0);
      if (v1 > 2) { const cols = []; for (let k = Math.ceil(u0 / 4); k * 4 < u1; k++) { const u = k * 4; if (u - .13 > u0 && u + .13 < u1) cols.push(u) } for (const u of cols) { relief(St, A, sg, pl, u - .12, u + .12, y0, v1 - .02, .03, .012); if (!lod) relief(St, A, sg, pl, u - .045, u + .045, y0, v1 - .02, .046, .01) } }
      if (!lod) for (const yy of [2.55, 5.05]) if (yy > y0 + .1 && yy < v1 - .2) relief(St, A, sg, pl, u0, u1, yy, yy + .085, .022, .008);
      if (v1 >= hi[1] - .01) relief(Ru, A, sg, pl, u0, u1, v1 - .26, v1 + .01, .036, .014);
      for (const side of [0, 1]) { const uE = side ? hi[U] : lo[U]; if (Math.abs((side ? u1 : u0) - uE) > EPS || !R[2 * U + side].length) continue; const su = side ? -1 : 1, a = su > 0 ? uE : uE - .17, e = su > 0 ? uE + .17 : uE; relief(St, A, sg, pl, a, e, y0, v1, .03, .012) }
    }
  }
}

/* ---------- encadrements de portes et fenêtres ---------- */
function dressOpening(sink, O, grid, STONE, lod, L) {
  const { ax, a, b, c, th, y0, y1, sill } = O, W = b - a, A = ax === 0 ? 2 : 0, cu = (a + b) / 2, isDoor = !sill;
  const hostAt = (u, y, sg) => { const q = c + sg * (th / 2 - .03), X = ax === 0 ? u : q, Z = ax === 0 ? q : u; let host = null; grid.each(X, X, Z, Z, B => { if (!host && B.m !== 'frame' && X > B.lo[0] && X < B.hi[0] && y > B.lo[1] && y < B.hi[1] && Z > B.lo[2] && Z < B.hi[2]) host = B }); return host };
  for (const sg of [-1, 1]) {
    const host = hostAt(a - .14, (y0 + y1) / 2, sg) || hostAt(b + .14, (y0 + y1) / 2, sg); if (!host || !PROF[host.m] || !PROF[host.m].masonry) continue;
    const pl = c + sg * th / 2; if (!isExterior(grid, A, sg, pl, cu, y1)) continue;
    const trim = host.m === 'conc' ? 'conc' : STONE, S = sink(trim, host.o, ax === 0 ? cu : c, ax === 0 ? c : cu), onWall = (u, y) => !!hostAtAny(grid, ax, c, sg, th, u, y);
    const bx = (u0, u1, v0, v1, d = .032, sl = .014) => relief(S, A, sg, pl, u0, u1, v0, v1, d, sl);
    const J = .17, hw = .09, rich = isDoor || rn(Math.round(a * 3), Math.round(c * 7)) > .6;
    /* piédroits harpés : deux à quatre grandes pierres */
    if (rich && !lod) for (const side of [0, 1]) {
      let v = y0 + .004, k = 0;
      while (v < y1 - .08) { const ch = (isDoor ? .52 : .38) + rn(k, Math.round(a * 11) + side) * .2, v1 = y1 - v - ch < .16 ? y1 : v + ch, w = J * (k & 1 ? .74 : 1.15), u0 = side ? b + hw : a - hw - w, u1 = side ? b + hw + w : a - hw; if (onWall((u0 + u1) / 2, (v + v1) / 2)) bx(u0, u1, v, v1); v = v1 + .012; k++ }
    }
    /* linteau : arc segmentaire en claveaux (porte) ou plate-bande */
    const topY = y1 + .09; let room = 0; while (room < .8) { const yy = topY + room + .03, px = ax === 0 ? cu : pl + sg * .02, pz = ax === 0 ? pl + sg * .02 : cu; if (!onWall(cu, yy) || grid.solidAt(px, yy, pz)) break; room += .04 }
    const dep = .17, arch = !lod && rich && W >= 1 && W <= 3.4 && room >= .3 && rn(Math.round(a * 3), Math.round(c * 5)) > .25;
    if (arch) {
      const span = W + .22, rise = Math.max(.07, Math.min(span * .17, room - dep - .05)), R = (span * span / 4 + rise * rise) / (2 * rise), cy = topY + rise - R, n = Math.max(5, Math.round(span / .36)) | 1, th0 = Math.asin(span / 2 / R);
      for (let i = 0; i < n; i++) {
        const t0 = -th0 + (i + .03) / n * 2 * th0, t1 = -th0 + (i + .97) / n * 2 * th0, key = i === (n - 1) / 2, r1 = R + dep * (key ? 1.2 : 1) + (i & 1 ? .014 : 0), lift = key ? -.02 : 0, pt = (t, rr) => [cu + Math.sin(t) * rr, cy + Math.cos(t) * rr + lift], q = [pt(t0, R), pt(t1, R), pt(t1, r1), pt(t0, r1)];
        if (q.every(p => onWall(p[0], p[1]))) prism(S, A, sg, pl, q, key ? .042 : .03);
      }
      /* tympan légèrement en saillie entre la plate-bande et l'arc */
      const m = 3; for (let i = 0; i < m; i++) { const u0 = a - hw + i / m * (W + 2 * hw), u1 = a - hw + (i + 1) / m * (W + 2 * hw), yA = cy + Math.sqrt(Math.max(0, R * R - (u0 - cu) ** 2)) - .012, yB = cy + Math.sqrt(Math.max(0, R * R - (u1 - cu) ** 2)) - .012, poly = [[u0, topY], [u1, topY], [u1, Math.max(topY + .004, yB)], [u0, Math.max(topY + .004, yA)]]; if (poly.every(p => onWall(p[0], p[1] - .002))) flatPoly(S, A, sg, pl + sg * .012, poly) }
    } else if (onWall(cu, topY + .1)) { bx(a - hw - J * .6, b + hw + J * .6, topY - .002, topY + .17, .036, .016); if (!lod && rich) bx(cu - .13, cu + .13, topY - .002, topY + .215, .044, .012) }
    /* appui de fenêtre à nez */
    if (sill && onWall(cu, y0 - .1)) { bx(a - hw - .07, b + hw + .07, y0 - .13, y0 - .06, .046, .016); if (!lod && rich) bx(a - hw - .03, b + hw + .03, y0 - .19, y0 - .13, .026, .01) }
  }
}
function flatPoly(S, A, sg, pl, pts) { const n = [0, 0, 0]; n[A] = sg; const f = 2 * A + (sg > 0 ? 1 : 0), id = pts.map(p => A === 0 ? S.v(pl, p[1], p[0], n[0], n[1], n[2], .05, f) : S.v(p[0], p[1], pl, n[0], n[1], n[2], .05, f)); for (let i = 1; i + 1 < id.length; i++) S.tri(id[0], id[i], id[i + 1]) }
function hostAtAny(grid, ax, c, sg, th, u, y) { const q = c + sg * (th / 2 - .03), X = ax === 0 ? u : q, Z = ax === 0 ? q : u; let h = null; grid.each(X, X, Z, Z, B => { if (X > B.lo[0] && X < B.hi[0] && y > B.lo[1] && y < B.hi[1] && Z > B.lo[2] && Z < B.hi[2]) { h = B; return true } }); return h }

/* ---------- gravats et éboulis au pied des murs ---------- */
function debris(sink, boxes, grid, STONE, lod, L) {
  const S0 = L.size - .3, tones = [...new Set(boxes.filter(b => PROF[b.m] && PROF[b.m].masonry).map(b => b.m))];
  const stone = (S, x, z, s, sy) => { const yaw = rn(x * 3, z * 5) * 6.28, c = Math.cos(yaw), n = Math.sin(yaw), P = [[1, .15, 0], [.3, .2, .9], [-.8, .1, .55], [-.75, .25, -.6], [.25, .1, -.95], [.05, 1, .1]].map((q, i) => { const k = .72 + rn(i + x * 7, z * 11) * .55, X = q[0] * s * k, Z = q[2] * s * k; return [x + X * c + Z * n, q[1] * sy * (i === 5 ? (.75 + rn(x, z) * .5) : 1) - .006, z - X * n + Z * c] });
    for (let i = 0; i < 5; i++) { const a = P[i], b = P[(i + 1) % 5], t = P[5]; const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = t[0] - a[0], vy = t[1] - a[1], vz = t[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1, flip = ny < 0; nx /= flip ? -l : l; ny /= flip ? -l : l; nz /= flip ? -l : l; const A = S.v(a[0], a[1], a[2], nx, ny, nz, .42, 3), B = S.v(b[0], b[1], b[2], nx, ny, nz, .42, 3), C = S.v(t[0], t[1], t[2], nx, ny, nz, .1, 3); flip ? S.tri(A, B, C) : S.tri(A, C, B) } };
  const dens = lod ? .3 : 1;
  let serial = 0;
  if (tones.length) for (const q of L.inst) { if (q.k !== 'rubble' || Math.abs(q.x) > S0 || Math.abs(q.z) > S0 || grid.solidAt(q.x, .03, q.z)) continue; serial++; let best = null, bd = 9; grid.each(q.x - 1.2, q.x + 1.2, q.z - 1.2, q.z + 1.2, B => { if (!PROF[B.m] || !PROF[B.m].masonry) return; const dx = Math.max(B.lo[0] - q.x, 0, q.x - B.hi[0]), dz = Math.max(B.lo[2] - q.z, 0, q.z - B.hi[2]), d = dx + dz; if (d < bd) { bd = d; best = B } }); const m = best ? best.m : tones[serial % tones.length], Sx = sink(m, null, q.x, q.z), big = Math.min(.1, q.s * .55); stone(Sx, q.x, q.z, big, big * .62); if (!lod) for (let k = 0; k < 3; k++) { const a = rn(serial, k) * 6.28, d = big * (1.1 + rn(k, serial) * 1.6), x = q.x + Math.cos(a) * d, z = q.z + Math.sin(a) * d, t = big * (.22 + rn(serial + 1, k) * .3); if (!grid.solidAt(x, .03, z)) stone(Sx, x, z, t, t * .7) } }
  for (const b of boxes) {
    const P = PROF[b.m]; if (!P || !P.masonry || b.lo[1] > .01 || b.hi[1] < 1.2) continue;
    for (const f of [0, 1, 4, 5]) {
      const A = f >> 1, U = A === 0 ? 2 : 0, sg = f & 1 ? 1 : -1, pl = sg > 0 ? b.hi[A] : b.lo[A], len = b.hi[U] - b.lo[U]; if (len < .8) continue;
      if (!isExterior(grid, A, sg, pl, (b.lo[U] + b.hi[U]) / 2, b.hi[1])) continue;
      const S = sink(rn(b.i, f) < .55 ? b.m : (b.m === 'conc' ? 'conc' : STONE), b.o, (b.lo[0] + b.hi[0]) / 2, (b.lo[2] + b.hi[2]) / 2), n = Math.round(len * 1.5 * dens);
      /* quelques amas : les éclats se groupent au lieu d'être semés régulièrement */
      const heaps = 1 + Math.floor(len / 5);
      for (let i = 0; i < n; i++) {
        serial++; const hp = Math.floor(rn(serial, 1) * heaps), cu = b.lo[U] + (hp + .25 + rn(hp, b.i) * .5) / heaps * len, sp = .25 + rn(serial, 2) * .9, u = cu + (rn(serial, 3) - .5) * 2 * sp, off = .03 + Math.pow(rn(serial, 4), 2) * .42, s = .025 + Math.pow(rn(serial, 5), 2.2) * .085 * (off < .15 ? 1.25 : .9), x = A === 0 ? pl + sg * off : u, z = A === 0 ? u : pl + sg * off;
        if (u < b.lo[U] || u > b.hi[U] || Math.abs(x) > S0 || Math.abs(z) > S0) continue;
        if (grid.solidAt(x, .03, z)) continue;
        stone(S, x, z, s, s * (.55 + rn(serial, 6) * .4));
      }
    }
  }
}

/* ========== ÉTAPE 2 : silhouette, coins, ouvertures profondes, raccord au sol ========== */
const vn = (t, k = 0) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return rn(i, k) * (1 - u) + rn(i + 1, k) * u };
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) };

/* ---------- portée du joueur : graphe des surfaces, sauts balistiques sans obstacle (surestime volontairement) ---------- */
export function reachSolids(L, VH = 10.5) {
  const S = L.solids, G = new Map(), C = 4, K = (i, j) => (i + 999) * 2048 + j + 999;
  S.forEach((s, n) => { for (let i = Math.floor(s.x0 / C); i <= Math.floor(s.x1 / C); i++) for (let j = Math.floor(s.z0 / C); j <= Math.floor(s.z1 / C); j++) { const k = K(i, j); let l = G.get(k); if (!l) G.set(k, l = []); l.push(n) } });
  const MK = new Uint32Array(S.length); let NS = 0; const near = (a, b, c, d, fn) => { const st = ++NS; for (let i = Math.floor(a / C); i <= Math.floor(b / C); i++) for (let j = Math.floor(c / C); j <= Math.floor(d / C); j++) { const l = G.get(K(i, j)); if (l) for (const n of l) if (MK[n] !== st) { MK[n] = st; fn(n) } } };
  const free = (x, y, z) => { let ok = true; near(x - .3, x + .3, z - .3, z + .3, n => { const q = S[n]; if (x + .3 > q.x0 && x - .3 < q.x1 && z + .3 > q.z0 && z - .3 < q.z1 && q.y1 > y + .32 && q.y0 < y + 1.7) ok = false }); return ok };
  const stand = s => { const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2, ix = Math.min(.25, (s.x1 - s.x0) / 2), iz = Math.min(.25, (s.z1 - s.z0) / 2); for (const [x, z] of [[mx, mz], [s.x0 + ix, s.z0 + iz], [s.x1 - ix, s.z0 + iz], [s.x0 + ix, s.z1 - iz], [s.x1 - ix, s.z1 - iz], [mx, s.z0 + iz], [mx, s.z1 - iz], [s.x0 + ix, mz], [s.x1 - ix, mz]]) if (free(x, s.y1, z)) return true; return false };
  const ok = S.map(s => s.y1 < 17 && Math.abs(s.x0) <= L.size + 1.3 && stand(s)), seen = new Uint8Array(S.length), q = [];
  S.forEach((s, n) => { if (ok[n] && s.y1 <= 1.75) { seen[n] = 1; q.push(n) } });
  const dist = dh => { const v = 8.1, g = 23, t = dh > 1.426 ? v / g : (v + Math.sqrt(Math.max(0, v * v - 2 * g * dh))) / g; return VH * t + .8 };
  while (q.length) { const a = S[q.pop()], R = dist(-6); near(a.x0 - R, a.x1 + R, a.z0 - R, a.z1 + R, n => { if (seen[n] || !ok[n]) return; const b = S[n], dh = b.y1 - a.y1; if (dh > 1.75) return; const gx = Math.max(b.x0 - a.x1, a.x0 - b.x1, 0), gz = Math.max(b.z0 - a.z1, a.z0 - b.z1, 0); if (Math.hypot(gx, gz) <= dist(dh)) { seen[n] = 1; q.push(n) } }) }
  return seen;
}

/* ---------- coins de bâtiment réellement arrondis (écart au coin vif : r x 0,414, soit 5 cm au plus) ---------- */
const CORNER_R = { plaster: .12, plasterB: .12, plasterO: .12, stone: .105, brick: .095, conc: .07 };
const cutFace = (R, F, rg) => { const B = (F + 1) % 3, C = (F + 2) % 3; R[F] = subRect(R[F], rg[B][0], rg[B][1], rg[C][0], rg[C][1]) };
const rectHas = (list, F, x, y, z) => { const q = [x, y, z], B = (F + 1) % 3, C = (F + 2) % 3; for (const r of list) if (q[B] >= r.b0 - EPS && q[B] <= r.b1 + EPS && q[C] >= r.c0 - EPS && q[C] <= r.c1 + EPS) return true; return false };
function roundCorners(S, b, R, grid, lod) {
  const r0 = CORNER_R[b.m]; if (!r0 || b.o.bq || b.hi[1] - b.lo[1] < .7) return;
  const lo = b.lo, hi = b.hi, dx = hi[0] - lo[0], dz = hi[2] - lo[2], thin = Math.min(dx, dz); if (thin < .18) return;
  const r = Math.min(r0, thin * .42), pier = Math.max(dx, dz) < 1, longX = dx >= dz, T = thin, seg = lod ? 2 : 3; b.rnd = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const fX = sx > 0 ? 1 : 0, fZ = sz > 0 ? 5 : 4, px = sx > 0 ? hi[0] : lo[0], pz = sz > 0 ? hi[2] : lo[2], sp = interSpans(touchSpans(R[fX], 0, 2, pz), touchSpans(R[fZ], 2, 0, px));
    if (!sp.length) continue; const ym = (sp[0][0] + sp[0][1]) / 2;
    if (!pier) { const qx = longX ? px - sx * .08 : px - sx * (T + .1), qz = longX ? pz - sz * (T + .1) : pz - sz * .08; if (!grid.solidAt(qx, ym, qz)) continue; if (!isExterior(grid, longX ? 2 : 0, longX ? sz : sx, longX ? pz : px, longX ? px - sx * .3 : pz - sz * .3, sp[0][1])) continue }
    const cx = px - sx * r, cz = pz - sz * r, X0 = Math.min(px, cx), X1 = Math.max(px, cx), Z0 = Math.min(pz, cz), Z1 = Math.max(pz, cz), key = Math.round(px * 7) * 31 + Math.round(pz * 7);
    for (const [y0, y1] of sp) {
      if (y1 - y0 < .25) continue;
      const ys = [y0]; if (!lod) for (let k = Math.ceil(y0 / .8); k * .8 < y1; k++) { const y = k * .8 + (rn(k, key) - .5) * .28; if (y > ys[ys.length - 1] + .12 && y < y1 - .1) ys.push(y) } ys.push(y1);
      let prev = null;
      for (let j = 0; j < ys.length; j++) {
        const row = [], end = j === 0 || j === ys.length - 1, nick = end ? 0 : rn(j * 3, key), chip = nick > .74 ? .024 : nick * .012;
        for (let i = 0; i <= seg; i++) { const t = i / seg * PI / 2, c = Math.cos(t), s = Math.sin(t), w = Math.sin(2 * t), rr = r - chip * w; row.push(S.v(cx + sx * rr * c, ys[j], cz + sz * rr * s, sx * c, 0, sz * s, -(.1 + .22 * (end ? .4 : vn(ys[j] * 2.3, key))) * w + (nick > .74 ? .16 * w : 0), i < seg / 2 ? fX : fZ)) }
        if (prev) for (let i = 0; i < seg; i++) S.quad(prev[i], prev[i + 1], row[i + 1], row[i]);
        prev = row;
      }
      const cap = (Y, ny) => { const m = S.v(cx, Y, cz, 0, ny, 0, 0, ny > 0 ? 3 : 2); let p = -1; for (let i = 0; i <= seg; i++) { const t = i / seg * PI / 2, q = S.v(cx + sx * r * Math.cos(t), Y, cz + sz * r * Math.sin(t), 0, ny, 0, -.08, ny > 0 ? 3 : 2); if (i) S.tri(m, p, q); p = q } };
      if (Math.abs(y1 - hi[1]) < EPS && rectHas(R[3], 3 >> 1, px - sx * .01, hi[1], pz - sz * .01)) { cutFace(R, 3, [[X0, X1], [0, 0], [Z0, Z1]]); cap(hi[1], 1) }
      if (Math.abs(y0 - lo[1]) < EPS && lo[1] > .01 && rectHas(R[2], 2 >> 1, px - sx * .01, lo[1], pz - sz * .01)) { cutFace(R, 2, [[X0, X1], [0, 0], [Z0, Z1]]); cap(lo[1], -1) }
      cutFace(R, fX, [[0, 0], [y0, y1], [Z0, Z1]]); cutFace(R, fZ, [[X0, X1], [y0, y1], [0, 0]]);
    }
    b.rnd.push({ sx, sz, r });
  }
}

/* ---------- soubassement fondu : même matière que le mur, hauteur irrégulière, encrassé vers le bas ---------- */
function plinthBlend(S, A, sg, pl, u0, u1, v1, seed, lod) {
  if (u1 - u0 < .2) return;
  const U = A === 0 ? 2 : 0, f = 2 * A + (sg > 0 ? 1 : 0), base = .24 + fract(seed * .37) * .36, step = lod ? 1.6 : .75, T = [u0], p = [0, 0, 0], n = [0, 0, 0];
  for (let k = Math.ceil(u0 / step); k * step < u1; k++) { const t = k * step; if (t > T[T.length - 1] + .18 && t < u1 - .14) T.push(t) } T.push(u1);
  const mk = (t, d, y, nu, ny, ao) => { p[A] = pl + sg * d; p[1] = y; p[U] = t; n[A] = sg * nu; n[1] = ny; n[U] = 0; return S.v(p[0], p[1], p[2], n[0], n[1], n[2], ao, f) };
  let pr = null;
  for (let i = 0; i < T.length; i++) {
    const t = T[i], h = Math.min(v1 - .02, base + (vn(t * 1.7, seed) - .5) * .16 + (vn(t * .43, seed + 1) - .5) * .16), g = (vn(t * .9, seed + 2) - .5) * .08;
    const row = [mk(t, .024, -.01, 1, 0, .34 + g), mk(t, .021, h * .6, 1, .05, .14 + g * .6), mk(t, -.004, h, 1, .02, 0)];
    if (pr) for (let j = 0; j < 2; j++) S.quad(pr[j], pr[j + 1], row[j + 1], row[j]);
    pr = row;
  }
}

/* ---------- raccord au sol : bourrelet de terre et de poussière dans la texture cuite du sol ---------- */
function groundApron(Sg, A, sg, pl, u0, u1, seed, lod, openA = 1, openE = 1) {
  if (u1 - u0 < .3) return;
  const U = A === 0 ? 2 : 0, step = lod ? 1.4 : .7, T = [u0], p = [0, 0, 0], n = [0, 0, 0]; for (let k = Math.ceil(u0 / step); k * step < u1; k++) { const t = k * step; if (t > T[T.length - 1] + .16 && t < u1 - .12) T.push(t) } T.push(u1);
  const mk = (t, d, y, nu, ny, ao) => { p[A] = pl + sg * d; p[1] = y; p[U] = t; n[A] = sg * nu; n[1] = ny; n[U] = 0; return Sg.v(p[0], p[1], p[2], n[0], n[1], n[2], ao, 3) };
  let pr = null;
  for (const t of T) {
    const tp = Math.min(openA ? sstep(0, .42, t - u0) : 1, openE ? sstep(0, .42, u1 - t) : 1), w = (.22 + .62 * vn(t * .62, seed)) * (.35 + .65 * tp), h = (.022 + .06 * vn(t * 1.35, seed + 3)) * tp;
    const row = lod ? [mk(t, -.015, h + .002, .3, .95, .42), mk(t, w + .03, .0015, 0, 1, 0)] : [mk(t, -.015, h + .002, .3, .95, .46), mk(t, w * .36, h * .62 + .002, .32, .95, .24), mk(t, w + .03, .0015, 0, 1, 0)];
    if (pr) for (let j = 0; j < row.length - 1; j++) Sg.quad(pr[j], pr[j + 1], row[j + 1], row[j]);
    pr = row;
  }
}
/* bordure de rue et caniveau le long des façades */
function curbLine(Sc, Sg, A, sg, pl, u0, u1, grid, doors, seed) {
  const D0 = .62, D1 = .76, free = (u, d) => { const X = A === 0 ? pl + sg * d : u, Z = A === 0 ? u : pl + sg * d; return !grid.solidAt(X, .02, Z) }, atDoor = u => doors.some(q => q.A === A && Math.abs(q.pl - pl) < .5 && u > q.a - .55 && u < q.b + .55);
  const CL = 1.05;
  for (let k = Math.floor(u0 / CL); k * CL < u1; k++) {
    const a = Math.max(u0, k * CL), e = Math.min(u1, (k + 1) * CL), mid = (a + e) / 2; if (e - a < .05) continue;
    if (!(free(mid, D0) && free(mid, D1)) || atDoor(mid)) continue;
    const d0 = pl + sg * D0, d1 = pl + sg * D1, q0 = Math.min(d0, d1), q1 = Math.max(d0, d1), h = .028 + rn(k, seed + 2) * .012, tone = .42 + rn(k, seed + 4) * .16, ga = k * CL >= u0 ? .005 : 0, ge = (k + 1) * CL <= u1 ? .005 : 0;
    if (A === 0) relief(Sc, 1, 1, -.004, q0, q1, a + ga, e - ge, h, .018, tone); else relief(Sc, 1, 1, -.004, a + ga, e - ge, q0, q1, h, .018, tone);
    const U = A === 0 ? 2 : 0, p = [0, 0, 0], m = (t, d, ao) => { p[A] = pl + sg * d; p[1] = .0035; p[U] = t; return Sg.v(p[0], p[1], p[2], 0, 1, 0, ao, 3) };
    Sg.quad(m(a, .47, 0), m(a, .615, .3), m(e, .615, .3), m(e, .47, 0));
  }
}

/* ---------- toits ---------- */
function planRoofs(L, boxes, seen) {
  /* index local de toutes les boîtes (la grille partagée ne tient que les volumes pleins) */
  const GC = 2, GM = new Map(), gk = (i, j) => (i + 4096) * 8192 + j + 4096; for (const b of boxes) { const i0 = Math.floor(b.lo[0] / GC), j0 = Math.floor(b.lo[2] / GC); for (let i = i0; i <= Math.max(i0, Math.floor((b.hi[0] - 1e-6) / GC)); i++) for (let j = j0; j <= Math.max(j0, Math.floor((b.hi[2] - 1e-6) / GC)); j++) { const k = gk(i, j); let l = GM.get(k); if (!l) GM.set(k, l = []); l.push(b) } }
  let gs = 0; const each = (x0, x1, z0, z1, fn) => { const s = ++gs; for (let i = Math.floor(x0 / GC); i <= Math.floor(x1 / GC); i++) for (let j = Math.floor(z0 / GC); j <= Math.floor(z1 / GC); j++) { const l = GM.get(gk(i, j)); if (!l) continue; for (const b of l) if (b._pr !== s) { b._pr = s; if (fn(b) === true) return true } } return false };
  const isSlab = b => !b.o.bq && !/^(far|lamp|glass|chain|frame)/.test(b.m) && b.hi[1] - b.lo[1] <= .6 && b.hi[1] >= 2.7, big = boxes.filter(b => isSlab(b) && b.hi[0] - b.lo[0] >= 3 && b.hi[2] - b.lo[2] >= 3 && (b.hi[0] - b.lo[0]) * (b.hi[2] - b.lo[2]) >= 20);
  const over = (a, b) => Math.max(0, Math.min(a.hi[0], b.hi[0]) - Math.max(a.lo[0], b.lo[0])) * Math.max(0, Math.min(a.hi[2], b.hi[2]) - Math.max(a.lo[2], b.lo[2]));
  const tops = big.filter(c => !big.some(d => d !== c && d.hi[1] > c.hi[1] + .5 && over(c, d) > .4 * (c.hi[0] - c.lo[0]) * (c.hi[2] - c.lo[2]))), out = [], used = new Set();
  for (const c of tops) {
    if (used.has(c)) continue; used.add(c); let x0 = c.lo[0], x1 = c.hi[0], z0 = c.lo[2], z1 = c.hi[2], grew = true; const y = c.hi[1];
    while (grew) { grew = false; each(x0 - .05, x1 + .05, z0 - .05, z1 + .05, d => { if (used.has(d) || !isSlab(d) || d.m !== c.m || Math.abs(d.hi[1] - y) > .011 || d.lo[0] > x1 + .05 || d.hi[0] < x0 - .05 || d.lo[2] > z1 + .05 || d.hi[2] < z0 - .05) return; used.add(d); x0 = Math.min(x0, d.lo[0]); x1 = Math.max(x1, d.hi[0]); z0 = Math.min(z0, d.lo[2]); z1 = Math.max(z1, d.hi[2]); grew = true }) }
    let base = y; each(x0 - .05, x1 + .05, z0 - .05, z1 + .05, b => { if (b.hi[1] > y + .01 && b.hi[1] <= y + 1.3 && b.lo[1] >= y - .3 && b.lo[0] < x1 + .05 && b.hi[0] > x0 - .05 && b.lo[2] < z1 + .05 && b.hi[2] > z0 - .05 && b.hi[1] > base) base = b.hi[1] });
    let closed = true; L.solids.forEach((s, n) => { if (seen[n] && s.x1 > x0 && s.x0 < x1 && s.z1 > z0 && s.z0 < z1 && s.y1 >= y - .01) closed = false });
    const prismOn = L.ops.some(o => o.t === 'p' && o.x > x0 - 1 && o.x < x1 + 1 && o.z > z0 - 1 && o.z < z1 + 1), bigAbove = each(x0, x1, z0, z1, b => b.lo[1] >= base - .05 && b.lo[0] < x1 && b.hi[0] > x0 && b.lo[2] < z1 && b.hi[2] > z0 && Math.min(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2]) >= .8 && b.hi[1] - b.lo[1] >= .3);
    let wall = 0, tot = 0; const yw = y - 1.1; for (let t = .05; t < 1; t += .1) for (const [px, pz] of [[x0 + (x1 - x0) * t, z0 + .2], [x0 + (x1 - x0) * t, z1 - .2], [x0 + .2, z0 + (z1 - z0) * t], [x1 - .2, z0 + (z1 - z0) * t]]) { tot++; if (each(px - .45, px + .45, pz - .45, pz + .45, b => b.occ && b.hi[1] - b.lo[1] > .5 && px > b.lo[0] - .45 && px < b.hi[0] + .45 && pz > b.lo[2] - .45 && pz < b.hi[2] + .45 && yw > b.lo[1] && yw < b.hi[1])) wall++ }
    /* un toit couvre un intérieur : une crête ou une terrasse pleine (un seul volume sous toute la dalle) n'en reçoit pas */
    const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2, core = boxes.some(b => b.occ && cxm > b.lo[0] && cxm < b.hi[0] && czm > b.lo[2] && czm < b.hi[2] && yw > b.lo[1] && yw < b.hi[1] && (b.hi[0] - b.lo[0]) * (b.hi[2] - b.lo[2]) > .5 * (x1 - x0) * (z1 - z0));
    const building = wall / tot >= .55; if (prismOn || core || (!building && L.env !== 'desert')) continue;
    out.push({ x0, x1, z0, z1, y, base, closed: closed && !bigAbove, m: c.m });
  }
  out.sort((a, b) => Math.atan2(a.z0 + a.z1, a.x0 + a.x1) - Math.atan2(b.z0 + b.z1, b.x0 + b.x1)); out.forEach((r, i) => { r.style = i % 4; r.seed = i * 17 + 3 });
  return out;
}
/* pan de toit gauchi : a,b à l'égout ; d,c en haut */
function slopePatch(S, a, b, c, d, uvS, seed, rows = 3, ao0 = .1) {
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]), H = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]), cols = Math.max(1, Math.ceil(L / 1.5)), ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz } const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const g = []; for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const s = i / cols, t = j / rows, q = k => (a[k] * (1 - s) + b[k] * s) * (1 - t) + (d[k] * (1 - s) + c[k] * s) * t, edge = i === 0 || i === cols || j === 0 || j === rows, w = edge ? 0 : (vn(s * L * .8, seed) - .5) * .09 + (vn(t * 3 + s * 2, seed + 1) - .5) * .05, tx = edge ? 0 : (vn(s * L * .8 + .5, seed) - vn(s * L * .8 - .5, seed)) * .18; g.push(S.vu(q(0) + nx * w, q(1) + ny * w, q(2) + nz * w, nx + tx * ux / (L || 1), ny, nz + tx * uz / (L || 1), (j === 0 ? ao0 + .16 : j === rows ? -.08 : 0) + (vn(s * L * 1.3, seed + 5) - .5) * .14, s * L / uvS, t * H / uvS)) }
  const w = cols + 1; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) S.quad(g[j * w + i], g[j * w + i + 1], g[(j + 1) * w + i + 1], g[(j + 1) * w + i]);
}
const quad3 = (S, a, b, c, d, n, ao, uvS) => { const m = q => { const ax = Math.abs(n[0]), az = Math.abs(n[2]); /* face à plat (dessous d'avant-toit) : projection verticale ; (z, y) y donnait v constant, texture étirée en traînées (TEXTURE QA) */ if (Math.abs(n[1]) > ax && Math.abs(n[1]) > az) return [q[0] / uvS, q[2] / uvS]; return ax >= az ? [q[2] / uvS, q[1] / uvS] : [q[0] / uvS, q[1] / uvS] }, id = [a, b, c, d].map((q, i) => { const uv = m(q); return S.vu(q[0], q[1], q[2], n[0], n[1], n[2], Array.isArray(ao) ? ao[i] : ao, uv[0], uv[1]) }); S.quad(id[0], id[1], id[2], id[3]) };

function pitchedRoof(fr, R, tileM, wallM, trimM, shP, shI, reg) {
  const { x0, x1, z0, z1, base, seed } = R, ov = .46, longX = x1 - x0 >= z1 - z0, sp = longX ? z1 - z0 : x1 - x0, rise = Math.min(1.9, sp * .17), E = base + .01, cxz = longX ? (z0 + z1) / 2 : (x0 + x1) / 2, Y = E + rise, hip = R.style & 1, hl = hip ? Math.min(sp * .42, (longX ? x1 - x0 : z1 - z0) * .3) : 0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, S = fr(tileM, null, cx, cz), W = fr(wallM, null, cx, cz), T = fr(trimM, null, cx, cz), uv = S.uvS;
  const P = (l, c, y) => longX ? [l, y, c] : [c, y, l], l0 = (longX ? x0 : z0) - ov, l1 = (longX ? x1 : z1) + ov, c0 = (longX ? z0 : x0) - ov, c1 = (longX ? z1 : x1) + ov;
  slopePatch(S, P(l0, c0, E), P(l1, c0, E), P(l1 - hl, cxz, Y), P(l0 + hl, cxz, Y), uv, seed);
  slopePatch(S, P(l1, c1, E), P(l0, c1, E), P(l0 + hl, cxz, Y), P(l1 - hl, cxz, Y), uv, seed + 7);
  if (hip) { slopePatch(S, P(l0, c1, E), P(l0, c0, E), P(l0 + hl, cxz, Y), P(l0 + hl, cxz, Y), uv, seed + 11, 2); slopePatch(S, P(l1, c0, E), P(l1, c1, E), P(l1 - hl, cxz, Y), P(l1 - hl, cxz, Y), uv, seed + 13, 2) }
  else for (const [lp, sgn] of [[l0 + .1, -1], [l1 - .1, 1]]) { const n = longX ? [sgn, 0, 0] : [0, 0, sgn], a = P(lp, c0 + .1, E - .02), b = P(lp, c1 - .1, E - .02), t = P(lp, cxz, Y - .03), id = [a, b, t].map(q => W.v(q[0], q[1], q[2], n[0], n[1], n[2], .08, 0)); W.tri(id[0], id[1], id[2]) }
  /* faîtage */
  const rw = .15; slopePatch(T, P(l0 + hl, cxz - rw, Y - .03), P(l1 - hl, cxz - rw, Y - .03), P(l1 - hl, cxz, Y + .07), P(l0 + hl, cxz, Y + .07), T.uvS, seed + 3, 1, 0); slopePatch(T, P(l1 - hl, cxz + rw, Y - .03), P(l0 + hl, cxz + rw, Y - .03), P(l0 + hl, cxz, Y + .07), P(l1 - hl, cxz, Y + .07), T.uvS, seed + 4, 1, 0);
  /* rive, sous-face */
  const D = Math.max(.16, E - R.y + .06), yb = E - D, rect = [[x0 - ov, z0 - ov], [x1 + ov, z0 - ov], [x1 + ov, z1 + ov], [x0 - ov, z1 + ov]], inner = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], nrm = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
  for (let i = 0; i < 4; i++) { const a = rect[i], b = rect[(i + 1) % 4], p = inner[i], q = inner[(i + 1) % 4]; quad3(T, [a[0], yb, a[1]], [b[0], yb, b[1]], [b[0], E + .015, b[1]], [a[0], E + .015, a[1]], nrm[i], [.2, .2, -.05, -.05], T.uvS); quad3(T, [a[0], yb, a[1]], [p[0], yb, p[1]], [q[0], yb, q[1]], [b[0], yb, b[1]], [0, -1, 0], [.2, .55, .55, .2], T.uvS) }
  /* ombre portée */
  const n = shP.length / 3, v = [P(l0, c0, E), P(l1, c0, E), P(l1, c1, E), P(l0, c1, E), P(l0 + hl, cxz, Y), P(l1 - hl, cxz, Y)]; for (const q of v) shP.push(q[0], q[1], q[2]); shI.push(n, n + 4, n + 1, n + 1, n + 4, n + 5, n + 2, n + 5, n + 3, n + 3, n + 5, n + 4, n, n + 3, n + 4, n + 1, n + 5, n + 2);
  reg({ kind: 'pitched', x0: x0 - ov, x1: x1 + ov, z0: z0 - ov, z1: z1 + ov, y0: yb, y1: Y + .07, closed: 1 });
}

/* toit praticable : couronnement extérieur et mobilier mince ; rien de large au-dessus de la surface jouable */
function crownRoof(fr, det, R, grid, L, seen, used, wallM, trimM, shP, shI, reg, lod) {
  const { x0, x1, z0, z1, y, base, style, seed } = R, hasPar = base > y + .3, tileM = used.has('tile') ? 'tile' : used.has('rust') ? 'rust' : 'corr', cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, Tl = fr(tileM, null, cx, cz), Wl = fr(wallM, null, cx, cz), Tr = fr(trimM, null, cx, cz), Cd = det(trimM, null, cx, cz);
  const ov0 = [.46, 0, .32, .2][style], lift = [.5, 0, .36, .26][style], eY = Math.max(3.34, base - lift + (fract(seed * .31) - .5) * .1), cY = Math.max(eY + .2, base + .05), stacks = used.has('brick') ? 'brick' : trimM, St = fr(stacks, null, cx, cz);
  const JUMP = 9.3 * .704 + .8, ownS = s => s.x0 >= x0 - .01 && s.x1 <= x1 + .01 && s.z0 >= z0 - .01 && s.z1 <= z1 + .01, sideOv = new Map(), ovOf = (A, sg) => { const k = A * 2 + (sg > 0 ? 1 : 0); if (sideOv.has(k)) return sideOv.get(k); const pl = A === 2 ? (sg > 0 ? z1 : z0) : (sg > 0 ? x1 : x0), n0 = Math.min(pl, pl + sg * JUMP), n1 = Math.max(pl, pl + sg * JUMP), u0 = (A === 2 ? x0 : z0) - .5, u1 = (A === 2 ? x1 : z1) + .5; let near = false; for (let n = 0; n < L.solids.length && !near; n++) { const s = L.solids[n]; if (!seen[n] || ownS(s) || s.y1 < eY - 1.75 || s.y1 > cY + 3) continue; const a0 = A === 2 ? s.z0 : s.x0, a1 = A === 2 ? s.z1 : s.x1, b0 = A === 2 ? s.x0 : s.z0, b1 = A === 2 ? s.x1 : s.z1; if (a1 > n0 && a0 < n1 && b1 > u0 && b0 < u1) near = true } const v = near ? Math.min(ov0, .15) : ov0; sideOv.set(k, v); return v };
  const bCand = new Map(), blockedAt = (A, sg, pl, u) => { const k = A + ':' + sg + ':' + pl; let cand = bCand.get(k); if (!cand) { const ov = ovOf(A, sg), lo = Math.min(pl, pl + sg * (ov + .25)), hi = Math.max(pl, pl + sg * (ov + .25)); cand = []; L.solids.forEach((s, n) => { if (seen[n] && (A === 0 ? s.x1 > lo && s.x0 < hi : s.z1 > lo && s.z0 < hi) && !ownS(s) && s.y1 + 3.2 > eY && s.y1 < cY + .3) cand.push(s) }); bCand.set(k, cand) } for (const s of cand) if (A === 0 ? s.z1 > u - .24 && s.z0 < u + .24 : s.x1 > u - .24 && s.x0 < u + .24) return true; return false };
  const runsAll = [];
  for (const [A, sg] of [[2, -1], [0, 1], [2, 1], [0, -1]]) {
    const pl = A === 2 ? (sg > 0 ? z1 : z0) : (sg > 0 ? x1 : x0), u0 = A === 2 ? x0 : z0, u1 = A === 2 ? x1 : z1, yt = hasPar ? base - .12 : y - .04, inset = hasPar ? .06 : .06, on = u => { const X = A === 0 ? pl - sg * inset : u, Z = A === 0 ? u : pl - sg * inset; return grid.solidAt(X, yt, Z) && !blockedAt(A, sg, pl, u) };
    const N = Math.max(2, Math.round((u1 - u0) / .36)), cell = (u1 - u0) / N, runs = []; let st = -1; for (let i = 0; i <= N; i++) { const ok = i < N && on(u0 + (i + .5) * cell); if (ok && st < 0) st = i; if (!ok && st >= 0) { runs.push([u0 + st * cell, u0 + i * cell]); st = -1 } }
    for (const [a, e] of runs) {
      if (e - a < .7) continue; runsAll.push({ A, sg, pl, a, e, atA: a <= u0 + cell * .6, atE: e >= u1 - cell * .6, len: e - a });
    }
  }
  const pt = (A, l, c, Y) => A === 2 ? [l, Y, c] : [c, Y, l];
  for (const q of runsAll) {
    const { A, sg, pl, a, e, atA, atE } = q, nor = A === 2 ? [0, 0, sg] : [sg, 0, 0], idx = Math.round(pl * 3) + Math.round(a);
    const ov = ovOf(A, sg);
    if (ov > 0) {
      const ca = atA ? a - ovOf(2 - A, -1) : a, ce = atE ? e + ovOf(2 - A, 1) : e, outer = pl + sg * ov, inner = pl - sg * .012, flip = (A === 2) === (sg > 0);
      const E0 = pt(A, flip ? ca : ce, outer, eY), E1 = pt(A, flip ? ce : ca, outer, eY), T1 = pt(A, flip ? e : a, inner, cY), T0 = pt(A, flip ? a : e, inner, cY);
      slopePatch(Tl, E0, E1, T1, T0, Tl.uvS, seed + idx, lod ? 1 : 2);
      const fh = .085, n2 = nor; quad3(Tr, [E0[0], eY - fh, E0[2]], [E1[0], eY - fh, E1[2]], [E1[0], eY + .012, E1[2]], [E0[0], eY + .012, E0[2]], n2, [.18, .18, -.08, -.08], Tr.uvS);
      const w0 = pt(A, flip ? (atA ? a : a) : (atE ? e : e), pl, eY - fh), w1 = pt(A, flip ? (atE ? e : e) : (atA ? a : a), pl, eY - fh); quad3(Tr, [E0[0], eY - fh, E0[2]], w0, w1, [E1[0], eY - fh, E1[2]], [0, -1, 0], [.25, .6, .6, .25], Tr.uvS);
      reg({ kind: 'eave', x0: A === 0 ? Math.min(pl, outer) : Math.min(E0[0], E1[0]), x1: A === 0 ? Math.max(pl, outer) : Math.max(E0[0], E1[0]), z0: A === 2 ? Math.min(pl, outer) : Math.min(E0[2], E1[2]), z1: A === 2 ? Math.max(pl, outer) : Math.max(E0[2], E1[2]), y0: eY - fh, y1: cY, skin: 1 });
    } else if (hasPar) { const h0 = base - .34 - fract(seed * .7) * .22; for (const [d, b0, b1] of [[.02, h0, h0 + .06], [.034, h0 + .06, h0 + .13], [.048, h0 + .13, h0 + .22]]) relief(Cd, A, sg, pl, a, e, b0, b1, d, .008, -.12) }
    /* têtes de mur inégales : hauteur limitée pour ne pas créer de fausse couverture devant un joueur debout */
    if (hasPar && !lod && (style === 1 || style === 3)) { let u = a + .1, k = 0; while (u < e - .4) { const w = .46 + rn(k, seed + idx) * .62, gap = .18 + rn(k + 3, seed + idx) * .72, u2 = Math.min(e - .04, u + w), h = (style === 3 ? .06 : .12) + rn(k + 5, seed + idx) * (style === 3 ? .28 : .2), P0 = sg > 0 ? pl - .24 : pl, P1 = sg > 0 ? pl : pl + .24; if (A === 0) rbox(Wl, P0, P1, base - .01, base + h, u, u2, 0, 63 & ~4); else rbox(Wl, u, u2, base - .01, base + h, P0, P1, 0, 63 & ~4); reg({ kind: 'merlon', x0: A === 0 ? P0 : u, x1: A === 0 ? P1 : u2, z0: A === 0 ? u : P0, z1: A === 0 ? u2 : P1, y0: base, y1: base + h }); u = u2 + gap; k++ } }
    if (hasPar && !lod && style === 2 && q.len > 6) { const m = (a + e) / 2, P0 = sg > 0 ? pl - .24 : pl, P1 = sg > 0 ? pl : pl + .24; for (const [w, h] of [[.34, .16], [.2, .3]]) { const s0 = m - q.len * w / 2, s1 = m + q.len * w / 2; if (A === 0) rbox(Wl, P0, P1, base - .01, base + h, s0, s1, 0, 63 & ~4); else rbox(Wl, s0, s1, base - .01, base + h, P0, P1, 0, 63 & ~4); reg({ kind: 'merlon', x0: A === 0 ? P0 : s0, x1: A === 0 ? P1 : s1, z0: A === 0 ? s0 : P0, z1: A === 0 ? s1 : P1, y0: base, y1: base + h }) } }
  }
  /* souches de cheminée sur l'épaisseur du mur (27 cm au plus) */
  if (hasPar && runsAll.length && !lod) {
    const nC = 1 + (seed % 3 === 0 ? 1 : 0) + (style === 0 ? 1 : 0);
    for (let c = 0; c < nC; c++) {
      const q = runsAll[(seed + c * 3) % runsAll.length]; if (q.len < 2.2) continue; const u = q.a + .6 + rn(c, seed) * (q.len - 1.2), mid = q.pl - q.sg * .12, hC = 1.5 + rn(c + 1, seed) * 1.3, top = base + hC, th = .13, ln = .34 + rn(c + 2, seed) * .12;
      const [bx0, bx1, bz0, bz1] = q.A === 0 ? [mid - th, mid + th, u - ln, u + ln] : [u - ln, u + ln, mid - th, mid + th];
      rbox(St, bx0, bx1, base - .02, top, bz0, bz1, 0, 63 & ~4); rbox(Tr, bx0 - .012, bx1 + .012, top, top + .06, bz0 - .03, bz1 + .03, lod ? 0 : .012, 63); shadowRot(shP, shI, { x: (bx0 + bx1) / 2, y: base, z: (bz0 + bz1) / 2, w: bx1 - bx0, h: hC, d: bz1 - bz0, ry: 0, m: stacks });
      if (!lod) for (const s of [-.15, .15]) { const px = q.A === 0 ? mid : u + s, pz = q.A === 0 ? u + s : mid; lathe(St, px, top + .17, pz, 'y', [[.001, .12, .3], [.055, .12, .25], [.07, .105, -.05], [.06, .04, 0], [.08, -.11, .12]], 6) }
      reg({ kind: 'chimney', x0: bx0, x1: bx1, z0: bz0, z1: bz1, y0: base, y1: top + .3 });
    }
  }
  /* mobilier fin au milieu du toit */
  if (R.x1 - R.x0 > 5 && R.z1 - R.z0 > 5) {
    const steel = used.has('steel') ? 'steel' : trimM, Ss = fr(steel, null, cx, cz), rp = k => rn(k, seed), deck = (px, pz, rad) => { for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]]) if (!grid.solidAt(px + a * rad, y - .05, pz + b * rad)) return false; return true };
    const tx = x0 + (x1 - x0) * (.3 + rp(1) * .4), tz = z0 + (z1 - z0) * (.3 + rp(2) * .4), Rt = .62 + rp(3) * .16;
    if (!lod && (style === 3 || style === 1) && deck(tx, tz, Rt + .45)) { /* citerne sur pieds : corps au-dessus de toute hauteur atteignable, jamais au-dessus d'une trémie */
      const by = Math.max(base, y) + 3.3, h = 1.05 + rp(4) * .3;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lx = tx + a * Rt * .68, lz = tz + b * Rt * .68; rbox(Ss, lx - .036, lx + .036, y, by, lz - .036, lz + .036, 0, 63 & ~4) } if (!lod) for (const yy of [y + 1.45, y + 2.75]) for (const [a0, b0, a1, b1] of [[-1, -1, 1, -1], [-1, 1, 1, 1], [-1, -1, -1, 1], [1, -1, 1, 1]]) { const ax = tx + a0 * Rt * .68, az = tz + b0 * Rt * .68, ex = tx + a1 * Rt * .68, ez = tz + b1 * Rt * .68; rbox(Ss, Math.min(ax, ex) - .016, Math.max(ax, ex) + .016, yy, yy + .032, Math.min(az, ez) - .016, Math.max(az, ez) + .016, 0, 63) }
      const Sb = fr(used.has('rust') ? 'rust' : steel, null, cx, cz); lathe(Sb, tx, by + h / 2, tz, 'y', [[.001, h / 2 + .24, -.05], [Rt * .5, h / 2 + .17, 0], [Rt * .9, h / 2 + .04, .05], [Rt, h / 2 - .04, .1], [Rt + .012, h / 4, -.08], [Rt, 0, .1], [Rt + .012, -h / 4, -.08], [Rt, -h / 2 + .03, .2], [Rt * .9, -h / 2, .4], [.001, -h / 2, .5]], lod ? 8 : 14);
      shadowRot(shP, shI, { x: tx, y: by, z: tz, w: Rt * 1.7, h: h + .15, d: Rt * 1.7, ry: .4, m: 'rust' }); reg({ kind: 'tank-body', x0: tx - Rt, x1: tx + Rt, z0: tz - Rt, z1: tz + Rt, y0: by, y1: by + h + .24 }); reg({ kind: 'tank-leg', x0: tx - .036, x1: tx + .036, z0: tz - .036, z1: tz + .036, y0: y, y1: by });
    }
    if (!lod) { const nV = 2 + seed % 3; for (let k = 0; k < nV; k++) { const vx = x0 + .9 + rp(10 + k) * (x1 - x0 - 1.8), vz = z0 + .9 + rp(20 + k) * (z1 - z0 - 1.8), hv = .55 + rp(30 + k) * .75; if (!deck(vx, vz, .5)) continue; lathe(Ss, vx, y + hv / 2, vz, 'y', [[.001, hv / 2 + .075, 0], [.11, hv / 2 + .02, -.1], [.1, hv / 2, .15], [.055, hv / 2 - .02, .1], [.055, -hv / 2, .3]], 7); reg({ kind: 'vent', x0: vx - .11, x1: vx + .11, z0: vz - .11, z1: vz + .11, y0: y, y1: y + hv + .08 }) } }
  }
}

/* ---------- ouvertures : plan, puis arc réellement galbé dans une découpe du mur ---------- */
function planOpenings(openings, grid, lod) {
  const cuts = new Map();
  for (const O of openings) {
    const { ax, a, b, c, th, y1, sill } = O, W = b - a, A = ax === 0 ? 2 : 0, cu = (a + b) / 2, isDoor = !sill; O.plan = {};
    for (const sg of [-1, 1]) {
      const pl = c + sg * th / 2, onWall = (u, y) => { const h = hostAtAny(grid, ax, c, sg, th, u, y); return !!h && h.m !== 'frame' }, host = hostAtAny(grid, ax, c, sg, th, a - .14, (O.y0 + y1) / 2) || hostAtAny(grid, ax, c, sg, th, b + .14, (O.y0 + y1) / 2);
      if (!host || !PROF[host.m] || !PROF[host.m].masonry || !isExterior(grid, A, sg, pl, cu, y1)) continue;
      const k = rn(Math.round(a * 3), Math.round(c * 7) + sg), kind = isDoor ? 'door' : k < .4 ? 'shutter' : k < .72 ? 'stone' : 'plain', topY = y1 + .09; let room = 0;
      while (room < .86) { const yy = topY + room + .03, px = ax === 0 ? cu : pl + sg * .02, pz = ax === 0 ? pl + sg * .02 : cu; if (!onWall(cu, yy) || grid.solidAt(px, yy, pz)) break; room += .04 }
      const P = { kind, host, pl, topY, room, arch: null };
      if (!lod && W >= .9 && W <= 3.4 && room >= .34 && (isDoor ? rn(Math.round(a * 5), Math.round(c * 3)) > .16 : k > .52 && k < .86)) {
        const span = W + .16, dep = Math.min(.17, room * .36), rise = Math.max(.1, Math.min(span * .2, room - dep - .08)), Ri = (span * span / 4 + rise * rise) / (2 * rise), cy = topY + rise - Ri, th0 = Math.asin(clamp(span / 2 / Ri, 0, 1)), Ro = Ri + dep, uo = Ro * Math.sin(th0), Y1 = cy + Ro + .03;
        if (onWall(cu - uo + .01, Y1 - .01) && onWall(cu + uo - .01, Y1 - .01) && onWall(cu, Y1 - .01) && onWall(cu - uo + .01, topY + .01) && onWall(cu + uo - .01, topY + .01)) {
          P.arch = { span, dep, rise, Ri, Ro, cy, th0, uo, Y1, n: Math.max(5, Math.round(span / .36)) | 1 };
          const key = A + '|' + sg + '|' + Math.round(pl * 1000); let l = cuts.get(key); if (!l) cuts.set(key, l = []); l.push({ u0: cu - uo, u1: cu + uo, v0: topY, v1: Y1 });
        }
      }
      O.plan[sg] = P;
    }
  }
  return cuts;
}
function archModule(Wl, Tr, A, sg, pl, cu, Q, topY) {
  const { Ri, Ro, cy, th0, uo, Y1, n } = Q, f = 2 * A + (sg > 0 ? 1 : 0), N = n, U = A === 0 ? 2 : 0, p = [0, 0, 0], nn = [0, 0, 0], REC = .045, PRD = .036;
  const mk = (S, u, y, d, nu, ny, nA, ao) => { p[A] = pl + sg * d; p[U] = u; p[1] = y; nn[A] = sg * nA; nn[U] = nu; nn[1] = ny; return S.v(p[0], p[1], p[2], nn[0], nn[1], nn[2], ao, f) };
  const at = (t, r) => [cu + Math.sin(t) * r, cy + Math.cos(t) * r], T = i => -th0 + i / N * 2 * th0;
  for (let i = 0; i < N; i++) {
    const a = at(T(i), Ro), b = at(T(i + 1), Ro), c = at(T(i), Ri), d = at(T(i + 1), Ri);
    Wl.quad(mk(Wl, a[0], a[1], 0, 0, 0, 1, .04), mk(Wl, b[0], b[1], 0, 0, 0, 1, .04), mk(Wl, b[0], Y1, 0, 0, 0, 1, 0), mk(Wl, a[0], Y1, 0, 0, 0, 1, 0));      // écoinçon
    Wl.quad(mk(Wl, c[0], c[1], -REC, 0, 0, 1, .46), mk(Wl, d[0], d[1], -REC, 0, 0, 1, .46), mk(Wl, d[0], topY, -REC, 0, 0, 1, .2), mk(Wl, c[0], topY, -REC, 0, 0, 1, .2));   // tympan en retrait
    Tr.quad(mk(Tr, c[0], c[1], -.03, 0, 0, 1, .6), mk(Tr, d[0], d[1], -.03, 0, 0, 1, .6), mk(Tr, b[0], b[1], -.03, 0, 0, 1, .6), mk(Tr, a[0], a[1], -.03, 0, 0, 1, .6));      // fond des joints
    const g = .012 / Ro, t0 = T(i) + g, t1 = T(i + 1) - g, key = i === (N - 1) / 2, ro = Ro + (i & 1 ? .012 : 0) + (key ? .03 : 0), ri = Ri - (key ? .012 : 0), dp = key ? PRD + .01 : PRD, sl = .012, wr = -.1 - rn(i, Math.round(cu * 7)) * .1;
    const fo0 = at(t0, ro - sl), fo1 = at(t1, ro - sl), fi0 = at(t0, ri + sl), fi1 = at(t1, ri + sl), oo0 = at(t0, ro), oo1 = at(t1, ro), ii0 = at(t0, ri), ii1 = at(t1, ri), tm = (t0 + t1) / 2, sx = Math.sin(tm), cx = Math.cos(tm);
    Tr.quad(mk(Tr, fi0[0], fi0[1], dp, 0, 0, 1, wr), mk(Tr, fi1[0], fi1[1], dp, 0, 0, 1, wr), mk(Tr, fo1[0], fo1[1], dp, 0, 0, 1, wr), mk(Tr, fo0[0], fo0[1], dp, 0, 0, 1, wr));
    Tr.quad(mk(Tr, fo0[0], fo0[1], dp, sx * .7, cx * .7, .7, wr), mk(Tr, fo1[0], fo1[1], dp, sx * .7, cx * .7, .7, wr), mk(Tr, oo1[0], oo1[1], -.004, sx * .7, cx * .7, .7, .22), mk(Tr, oo0[0], oo0[1], -.004, sx * .7, cx * .7, .7, .22));
    Tr.quad(mk(Tr, fi1[0], fi1[1], dp, -Math.sin(t1), -Math.cos(t1), .18, .12), mk(Tr, fi0[0], fi0[1], dp, -Math.sin(t0), -Math.cos(t0), .18, .12), mk(Tr, ii0[0], ii0[1], -REC, -Math.sin(t0), -Math.cos(t0), .1, .5), mk(Tr, ii1[0], ii1[1], -REC, -Math.sin(t1), -Math.cos(t1), .1, .5));
  }
  /* coins bas du module, à fleur de mur */
  const iL = at(-th0, Ri), oL = at(-th0, Ro), iR = at(th0, Ri), oR = at(th0, Ro);
  Wl.tri(mk(Wl, cu - uo, topY, 0, 0, 0, 1, 0), mk(Wl, iL[0], topY, 0, 0, 0, 1, 0), mk(Wl, oL[0], oL[1], 0, 0, 0, 1, 0));
  Wl.tri(mk(Wl, iR[0], topY, 0, 0, 0, 1, 0), mk(Wl, cu + uo, topY, 0, 0, 0, 1, 0), mk(Wl, oR[0], oR[1], 0, 0, 0, 1, 0));
  /* bandes verticales au-dessus des naissances */
  Wl.quad(mk(Wl, cu - uo, oL[1], 0, 0, 0, 1, 0), mk(Wl, oL[0], oL[1], 0, 0, 0, 1, 0), mk(Wl, oL[0], Y1, 0, 0, 0, 1, 0), mk(Wl, cu - uo, Y1, 0, 0, 0, 1, 0));
  Wl.quad(mk(Wl, oR[0], oR[1], 0, 0, 0, 1, 0), mk(Wl, cu + uo, oR[1], 0, 0, 0, 1, 0), mk(Wl, cu + uo, Y1, 0, 0, 0, 1, 0), mk(Wl, oR[0], Y1, 0, 0, 0, 1, 0));
}
function shutter(S, A, sg, pl, u0, u1, y0, y1, seed) {
  const tone = (rn(seed, 3) - .5) * .18; relief(S, A, sg, pl, u0, u1, y0, y1, .022, .008, tone - .02);
  const n = Math.max(3, Math.round((y1 - y0) / .17)), h = (y1 - y0 - .08) / n;
  { const U = A === 0 ? 2 : 0, f = 2 * A + (sg > 0 ? 1 : 0), p = [0, 0, 0], q = [0, 0, 0], mk = (t, y, d, ny, ao) => { p[A] = pl + sg * d; p[U] = t; p[1] = y; q[A] = sg * .8; q[U] = 0; q[1] = ny; return S.v(p[0], p[1], p[2], q[0], q[1], q[2], ao, f) }; for (let i = 0; i < n; i++) { const a = y0 + .04 + i * h, b = a + h - .008, k = tone + (i & 1 ? -.08 : -.02); S.quad(mk(u0 + .04, a, .038, -.6, k + .34), mk(u1 - .04, a, .038, -.6, k + .34), mk(u1 - .04, b, .024, .6, k), mk(u0 + .04, b, .024, .6, k)) } }
  const w = u1 - u0; for (const [a, e] of [[u0, u0 + Math.min(.05, w * .12)], [u1 - Math.min(.05, w * .12), u1]]) relief(S, A, sg, pl + sg * .016, a, e, y0, y1, .026, .006, tone - .12);
}
function dressOpening2(det, O, grid, STONE, lod, used) {
  const { ax, a, b, c, y0, y1, sill } = O, W = b - a, A = ax === 0 ? 2 : 0, cu = (a + b) / 2, isDoor = !sill;
  for (const sg of [-1, 1]) {
    const P = O.plan && O.plan[sg]; if (!P) continue;
    const { pl, topY, host, kind, arch } = P, trim = host.m === 'conc' ? 'conc' : STONE, S = det(trim, host.o, ax === 0 ? cu : c, ax === 0 ? c : cu), Wl = det(host.m, host.o, ax === 0 ? cu : c, ax === 0 ? c : cu), onWall = (u, y) => { const h = hostAtAny(grid, ax, c, sg, O.th, u, y); return !!h && h.m !== 'frame' };
    if (lod && y0 > .2 && !isDoor) continue;
    const bx = (u0, u1, v0, v1, d = .032, sl = .014) => relief(S, A, sg, pl, u0, u1, v0, v1, d, sl), J = .17, hw = .09;
    if (!lod && (isDoor || kind === 'stone')) for (const side of [0, 1]) { let v = y0 + (isDoor ? .3 : .004), k = 0; while (v < y1 - .08) { const ch = (isDoor ? .52 : .38) + rn(k, Math.round(a * 11) + side) * .2, v1 = y1 - v - ch < .16 ? y1 : v + ch, w = J * (k & 1 ? .74 : 1.15), u0 = side ? b + hw : a - hw - w, u1 = side ? b + hw + w : a - hw; if (onWall((u0 + u1) / 2, (v + v1) / 2)) bx(u0, u1, v, v1); v = v1 + .012; k++ } }
    if (arch) archModule(Wl, S, A, sg, pl, cu, arch, topY);
    else if (onWall(cu, topY + .1)) { bx(a - hw - J * .6, b + hw + J * .6, topY - .002, topY + .17, .04, .018); if (!lod && kind !== 'plain') bx(cu - .13, cu + .13, topY - .002, topY + .215, .048, .014) }
    if (sill && onWall(cu, y0 - .1)) { bx(a - hw - .07, b + hw + .07, y0 - .13, y0 - .06, .048, .018); if (!lod) bx(a - hw - .03, b + hw + .03, y0 - .19, y0 - .13, .026, .01) }
    if (!lod && kind === 'shutter' && used.has('door')) { const Sd = det('door', host.o, ax === 0 ? cu : c, ax === 0 ? c : cu), sw = Math.min(.62, W * .5), h0 = y0 + .01, h1 = y1 - .01; for (const side of [0, 1]) { const u0 = side ? b + hw + .012 : a - hw - .012 - sw, u1 = u0 + sw; if (onWall(u0 + .03, h0 + .03) && onWall(u1 - .03, h0 + .03) && onWall(u0 + .03, h1 - .03) && onWall(u1 - .03, h1 - .03)) shutter(Sd, A, sg, pl, u0, u1, h0, h1, Math.round(a * 13) + side) } }
    if (isDoor && y0 < .02 && !lod) { const Sg = det('gnd', null, ax === 0 ? cu : c, ax === 0 ? c : cu), U = A === 0 ? 2 : 0, p = [0, 0, 0], m = (t, d, k) => { p[A] = pl + sg * d; p[U] = t; p[1] = .0035; return Sg.v(p[0], p[1], p[2], 0, 1, 0, k, 3) }; Sg.quad(m(a - .02, .0, .3), m(b + .02, .0, .3), m(b + .16, .62, 0), m(a - .16, .62, 0)) }
  }
}

function roofWall(boxes, r) { const c = new Map(); for (const b of boxes) { if (!PROF[b.m] || b.hi[1] - b.lo[1] < .5 || b.hi[1] > r.base + .01 || b.hi[1] < r.y - 3.2 || b.lo[0] < r.x0 - .1 || b.hi[0] > r.x1 + .1 || b.lo[2] < r.z0 - .1 || b.hi[2] > r.z1 + .1 || !(PROF[b.m].masonry || b.m === 'corr')) continue; c.set(b.m, (c.get(b.m) || 0) + (b.hi[0] - b.lo[0]) * (b.hi[2] - b.lo[2]) + 1) } let best = 'conc', v = 0; for (const [m, q] of c) if (q > v) { v = q; best = m } return best }
const DOORS = new WeakMap(), doorsOf = O => { let d = DOORS.get(O); if (!d) DOORS.set(O, d = O.filter(q => !q.sill && q.y0 < .02).flatMap(q => [-1, 1].map(s => ({ A: q.ax === 0 ? 2 : 0, pl: q.c + s * q.th / 2, a: q.a, b: q.b })))); return d };
function footings(det, b, R, P, grid, L, openings, lod) {
  const cx = (b.lo[0] + b.hi[0]) / 2, cz = (b.lo[2] + b.hi[2]) / 2, Sg = det('gnd', null, cx, cz), street = L.env === 'urban' && P.masonry, doors = street ? doorsOf(openings) : null;
  for (const f of [0, 1, 4, 5]) {
    const A = f >> 1, sg = f & 1 ? 1 : -1, pl = sg > 0 ? b.hi[A] : b.lo[A];
    for (const r of R[f]) {
      const u0 = A === 0 ? r.c0 : r.b0, u1 = A === 0 ? r.c1 : r.b1, v0 = A === 0 ? r.b0 : r.c0, v1 = A === 0 ? r.b1 : r.c1; if (v0 > .01 || v1 < .5 || u1 - u0 < .3 || !isExterior(grid, A, sg, pl, (u0 + u1) / 2, Math.min(v1, 2.6))) continue;
      const seed = Math.round(pl * 5) * 11 + f, wallAt = u => A === 0 ? grid.solidAt(pl - sg * .03, .1, u) : grid.solidAt(u, .1, pl - sg * .03); groundApron(Sg, A, sg, pl, u0, u1, seed, lod, !wallAt(u0 - .03), !wallAt(u1 + .03));
      if (street && !lod) curbLine(det(b.m === 'brick' ? 'stone' : 'stone', null, cx, cz), Sg, A, sg, pl, u0, u1, grid, doors, seed);
    }
  }
}
