/* FRONT ZÉRO : l'horizon. Terrain lointain, silhouettes et perspective aérienne, en UN seul maillage et UN seul matériau par carte.
   Purement visuel : aucune collision, aucun spawn, aucune navigation. Tout commence à 28 m au-delà de la limite et reste hors d'atteinte.
   - Le maillage est dessiné APRÈS le décor opaque, au plan lointain, sans écrire la profondeur : seuls les pixels encore vides sont peints,
     il ne dépend donc pas de la distance d'affichage et il n'est jamais coupé par le plan lointain.
   - Pas de tampon de profondeur entre ses couches : les triangles sont rangés du plus loin au plus près (ordre du peintre, anneau par anneau).
   - La brume vise la couleur réelle du ciel dans la direction du regard (texture du ciel) : la terre se dissout dans l'horizon sans ligne.
   Une carte ajoutée plus tard marche sans rien faire : elle prend le thème de son ENV, ou un thème déduit de son ambiance. */
import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v), mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

function makeNoise(seed) {
  const P = new Float32Array(1024); let s = seed | 0;
  for (let i = 0; i < 1024; i++) { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; P[i] = ((t ^ t >>> 14) >>> 0) / 4294967296; }
  const h = (a, b) => P[(a * 57 + b * 131 + (a ^ b) * 7) & 1023];
  const v = (x, y) => { const X = Math.floor(x), Y = Math.floor(y), f = x - X, g = y - Y, u = f * f * (3 - 2 * f), w = g * g * (3 - 2 * g); return mix(mix(h(X, Y), h(X + 1, Y), u), mix(h(X, Y + 1), h(X + 1, Y + 1), u), w); };
  const fbm = (x, y, o = 3) => { let a = .5, t = 0, n = 0; for (let i = 0; i < o; i++) { t += a * v(x, y); n += a; a *= .5; x = x * 2.03 + 17.1; y = y * 2.03 - 9.7; } return t / n; };
  const ridge = (x, y, o = 3) => { let a = .5, t = 0, n = 0; for (let i = 0; i < o; i++) { const q = 1 - Math.abs(2 * v(x, y) - 1); t += a * q * q; n += a; a *= .5; x = x * 2.1 - 5.3; y = y * 2.1 + 11.9; } return t / n; };
  return { v, fbm, ridge };
}

/* Un thème par ambiance. ridges : chaînes concentriques (at = distance au-delà de la limite, w = demi-largeur, h = hauteur, f = fréquence,
   ridge = crêtes vives, mesa = plateaux à gradins). built : silhouettes. dress : petit décor proche. haze : distance de dissolution (m). */
export const HORIZON_THEMES = {
  desert: { seed: 11, roll: 1.6, mid: '#a8895f', far: '#b89c7c', rock: '#9c7656', haze: 1500, ridges: [{ at: 170, w: 60, h: 10, f: .011 }, { at: 430, w: 120, h: 48, f: .0062, mesa: 1 }, { at: 860, w: 210, h: 125, f: .0034, mesa: 1 }], built: { style: 'mud', n: 26, from: 44, to: 190, h: [2.6, 5] }, dress: { scrub: 90, rock: 40, wall: 12, pole: 10 } },
  urban: { seed: 23, roll: .7, mid: '#6e6558', far: '#857c70', rock: '#6f675c', haze: 1300, ridges: [{ at: 600, w: 150, h: 40, f: .006 }, { at: 980, w: 220, h: 95, f: .0036 }], built: { style: 'old', n: 460, from: 36, to: 640, bias: 1.7, h: [6, 17], towers: 8 }, dress: { rock: 16, wall: 8, pole: 6 } },
  port: { seed: 37, roll: 1.2, mid: '#5b5450', far: '#6c5f62', rock: '#544a4a', haze: 1400, sea: { deep: '#141d2c' }, ridges: [{ at: 300, w: 90, h: 30, f: .009 }, { at: 820, w: 210, h: 115, f: .0038, ridge: 1 }], built: { style: 'block', n: 130, from: 38, to: 360, bias: 1.3, h: [5, 15], cranes: 4 }, dress: { rock: 18, wall: 10, pole: 14 } },
  snow: { seed: 41, roll: 3, mid: '#dfe6ee', far: '#cfdbe8', rock: '#6f7a8a', snow: 6, haze: 1500, ridges: [{ at: 96, w: 46, h: 24, f: .017 }, { at: 330, w: 115, h: 88, f: .0075, ridge: 1 }, { at: 780, w: 230, h: 270, f: .0036, ridge: 1 }], built: { style: 'pine', n: 170, from: 36, to: 330, h: [6, 13] }, dress: { rock: 30 } },
  airbase: { seed: 53, roll: 1, mid: '#8d8660', far: '#8a8a6c', rock: '#79735f', haze: 1500, ridges: [{ at: 440, w: 130, h: 20, f: .007 }, { at: 930, w: 230, h: 85, f: .0035 }], built: { style: 'hangar', n: 26, from: 40, to: 320, h: [4, 9] }, dress: { scrub: 90, wall: 14, pole: 34 } },
  refinery: { seed: 67, roll: .7, mid: '#6d645a', far: '#6e5d58', rock: '#5c524c', haze: 1250, ridges: [{ at: 780, w: 220, h: 38, f: .004 }], built: { style: 'plant', n: 64, from: 44, to: 540, bias: 1.3, h: [5, 13], stacks: 18, tanks: 20 }, dress: { rock: 14, wall: 12, pole: 26 } },
  valley: { seed: 79, roll: 3, mid: '#565c3c', far: '#62756e', rock: '#67675a', snow: 185, haze: 1450, ridges: [{ at: 120, w: 60, h: 36, f: .014 }, { at: 380, w: 130, h: 125, f: .0072, ridge: 1 }, { at: 810, w: 240, h: 290, f: .0034, ridge: 1 }], built: { style: 'pine', n: 170, from: 36, to: 340, h: [6, 12], houses: 12 }, dress: { scrub: 40, rock: 30, wall: 8 } },
};
const themeOf = (env, E) => HORIZON_THEMES[env] || HORIZON_THEMES[E && E.as] || HORIZON_THEMES.desert;

const lin = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/* Tampons fusionnés. Couleur stockée en racine carrée sur 8 bits (précise dans les sombres), carrée dans le vertex shader. */
class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.v = 0; }
  vert(x, y, z, nx, ny, nz, c, rim = 0, water = 0) { this.p.push(x, y, z); this.n.push(nx * 127 | 0, ny * 127 | 0, nz * 127 | 0, rim * 127 | 0); this.c.push(Math.sqrt(clamp(c[0])) * 255 | 0, Math.sqrt(clamp(c[1])) * 255 | 0, Math.sqrt(clamp(c[2])) * 255 | 0, water * 255 | 0); return this.v++; }
  quad(a, b, c, d, list) { list.push(a, b, c, a, c, d); }
  /* face plane à 4 sommets, normale calculée */
  face(A, B, C, D, ca, cb, list, flag = 0) { const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; const a = this.vert(A[0], A[1], A[2], nx, ny, nz, ca, 0, flag), b = this.vert(B[0], B[1], B[2], nx, ny, nz, ca, 0, flag), c = this.vert(C[0], C[1], C[2], nx, ny, nz, cb, 0, flag), d = this.vert(D[0], D[1], D[2], nx, ny, nz, cb, 0, flag); list.push(a, b, c, a, c, d); }
  tri(A, B, C, col, list) { const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; list.push(this.vert(A[0], A[1], A[2], nx, ny, nz, col), this.vert(B[0], B[1], B[2], nx, ny, nz, col), this.vert(C[0], C[1], C[2], nx, ny, nz, col)); }
}

/* Volume à plan irrégulier (jamais un cube parfait) : murs + toit à deux pans, en croupe ou plat à acrotère. */
function building(g, list, cx, cz, base, w, d, h, ry, wall, roof, kind, R) {
  const c = Math.cos(ry), s = Math.sin(ry), j = () => 1 + (R() - .5) * .22, P = [[-w / 2 * j(), -d / 2 * j()], [w / 2 * j(), -d / 2 * j()], [w / 2 * j(), d / 2 * j()], [-w / 2 * j(), d / 2 * j()]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]);
  const top = base + h, dark = [wall[0] * .62, wall[1] * .62, wall[2] * .62];
  for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; g.face([b[0], base, b[1]], [a[0], base, a[1]], [a[0], top, a[1]], [b[0], top, b[1]], dark, wall, list, h > 2.4 ? .25 : 0); }
  const m = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
  if (kind === 'flat') { g.face([P[3][0], top, P[3][1]], [P[2][0], top, P[2][1]], [P[1][0], top, P[1][1]], [P[0][0], top, P[0][1]], roof, roof, list); return; }
  const rise = Math.min(w, d) * (kind === 'hip' ? .36 : kind === 'shed' ? .15 : .46), long = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]) >= Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]);
  const [q0, q1, q2, q3] = long ? P : [P[1], P[2], P[3], P[0]], in_ = kind === 'hip' ? .24 : 0, r0 = m(m(q0, q3, .5), m(q1, q2, .5), in_), r1 = m(m(q0, q3, .5), m(q1, q2, .5), 1 - in_), T = v => [v[0], top, v[1]], U = v => [v[0], top + rise, v[1]];
  g.face(T(q1), T(q0), U(r0), U(r1), roof, roof, list); g.face(T(q3), T(q2), U(r1), U(r0), roof, roof, list);
  const r2 = [roof[0] * .86, roof[1] * .86, roof[2] * .86]; g.tri(T(q0), T(q3), U(r0), r2, list); g.tri(T(q2), T(q1), U(r1), r2, list);
}
/* Fût, cône ou cuve : anneau de `seg` quads, chapeau en éventail si r1 > 0. */
function drum(g, list, x, y, z, r0, r1, h, seg, c0, c1) {
  const ring = []; for (let i = 0; i < seg; i++) { const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a), sl = (r0 - r1) / h, l = Math.hypot(1, sl); ring.push([g.vert(x + ca * r0, y, z + sa * r0, ca / l, sl / l, sa / l, c0), g.vert(x + ca * r1, y + h, z + sa * r1, ca / l, sl / l, sa / l, c1)]); }
  for (let i = 0; i < seg; i++) { const a = ring[i], b = ring[(i + 1) % seg]; list.push(a[0], a[1], b[1], a[0], b[1], b[0]); }
  if (r1 > .01) { const t = g.vert(x, y + h, z, 0, 1, 0, c1); for (let i = 0; i < seg; i++) { const a = i / seg * TAU, b = (i + 1) / seg * TAU; const A = g.vert(x + Math.cos(a) * r1, y + h, z + Math.sin(a) * r1, 0, 1, 0, c1), B = g.vert(x + Math.cos(b) * r1, y + h, z + Math.sin(b) * r1, 0, 1, 0, c1); list.push(t, B, A); } }
}

/* Touffe ou rocher : dôme bas à contour irrégulier, jamais un cône régulier. */
function blob(g, list, x, y, z, r, h, seg, c0, c1, R) {
  const J = []; for (let i = 0; i < seg; i++) J.push(.72 + R() * .5); const sx = .8 + R() * .5, rot = R() * TAU, V = [[], []];
  for (let q = 0; q < 2; q++) { const k = q ? .62 : 1, yy = y + (q ? h * .74 : 0), col = q ? c1 : c0; for (let i = 0; i < seg; i++) { const a = rot + i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a), m = r * J[i] * k, nl = Math.hypot(ca, .9, sa); V[q].push(g.vert(x + ca * m * sx, yy, z + sa * m, ca / nl, .9 / nl, sa / nl, col)); } }
  const t = g.vert(x + (R() - .5) * r * .3, y + h, z + (R() - .5) * r * .3, 0, 1, 0, c1);
  for (let i = 0; i < seg; i++) { const n = (i + 1) % seg; list.push(V[0][i], V[1][i], V[1][n], V[0][i], V[1][n], V[0][n], V[1][i], t, V[1][n]); }
}

/* Génère le maillage d'une carte. low : version simplifiée (qualité basse). */
function* buildGeometry(L, E, T, low) {
  const S = L.size, N = low ? 112 : 200, M = low ? 20 : 34, inner = 10, Rout = S + 1180, nz = makeNoise(T.seed * 977 + S), g = new Geo();
  let rs = (T.seed * 7919 + S * 31) | 0; const R = () => { rs = (rs * 16807) % 2147483647; if (rs <= 0) rs += 2147483646; return rs / 2147483647; }, rnd = (a, b) => a + R() * (b - a);
  const sq = (c, s) => (S + inner) / Math.max(Math.abs(c), Math.abs(s)), ease = j => Math.pow(j / M, 2.05), edge = (x, z) => Math.max(Math.abs(x), Math.abs(z)) - S;
  const sea = T.sea && L.water != null ? T.sea : null, coastZ = x => (L.water || S) + 30 + .0006 * x * x + 46 * (nz.fbm(x * .006 + 3, 1.7, 3) - .5) + 16 * (nz.v(x * .03, 9.2) - .5);
  const landAt = (x, z) => (sea ? sstep(-7, 9, coastZ(x) - z) : 1);
  const H = (x, z) => { const e = edge(x, z); if (e < 0) return 0; const r = Math.hypot(x, z), th = Math.atan2(z, x); let y = T.roll * sstep(8, 90, e) * (nz.fbm(x * .013 + 3, z * .013 + 7, 3) - .42) * 2.2;
    for (const q of T.ridges) { const wob = q.w * 1.1 * (nz.fbm(Math.cos(th) * 2.6 + q.at * .01, Math.sin(th) * 2.6 - q.at * .01, 3) - .5) * 2, rr = S + q.at + wob, k = (r - rr) / q.w; if (Math.abs(k) > 2.6) continue; const bump = Math.exp(-k * k), gap = sstep(.22, .55, nz.fbm(Math.cos(th) * 1.7 + q.at, Math.sin(th) * 1.7 + 4.4, 2)); let n = q.ridge ? nz.ridge(x * q.f + 5, z * q.f - 3, 4) : nz.fbm(x * q.f + 5, z * q.f - 3, 4); if (q.mesa) { const st = n * 3.4, fl = Math.floor(st), fr = st - fl; n = clamp((fl + sstep(.72, .92, fr)) / 3.4 + .12); } y += sstep(22, 78, e) * q.h * bump * (q.mesa ? .24 + .9 * n : .18 + 1.05 * n) * (.45 + .55 * gap); }
    return y; };
  const foot = (x, z, r) => Math.min(H(x, z), H(x + r, z), H(x - r, z), H(x, z + r), H(x, z - r)) - .5;
  const Cn = lin(E.ground), tint = lin(L.env === 'snow' ? 0xf4f6f8 : 0xd8d0c4), near = [Cn[0] * tint[0], Cn[1] * tint[1], Cn[2] * tint[2]], mid = lin(T.mid), far = lin(T.far), rock = lin(T.rock), snow = lin('#eef3f8');
  /* grille polaire : la 1re ligne suit le carré de la carte, la dernière est un cercle */
  const Hs = new Float32Array((N + 1) * (M + 1)), Xs = new Float32Array((N + 1) * (M + 1)), Zs = new Float32Array((N + 1) * (M + 1)), Ws = new Uint8Array((N + 1) * (M + 1)), id = (i, j) => j * (N + 1) + i;
  for (let j = 0; j <= M; j++) { yield; const u = ease(j); for (let i = 0; i <= N; i++) { const a = i / N * TAU, c = Math.cos(a), s = Math.sin(a), r = mix(sq(c, s), Rout, u), x = c * r, z = s * r, k = id(i, j); Xs[k] = x; Zs[k] = z; let y = H(x, z); if (sea) { const l = landAt(x, z); y = y * l + mix(-1.3, .2, l); Ws[k] = l < .5 ? 1 : 0; } if (j >= M - 2) y += (j - M + 3) * 62; Hs[k] = y; } }
  const iV = new Int32Array((N + 1) * (M + 1));
  for (let j = 0; j <= M; j++) { yield; for (let i = 0; i <= N; i++) { const k = id(i, j), ip = id(i === N ? 1 : i + 1, j), im = id(i === 0 ? N - 1 : i - 1, j), jp = id(i, Math.min(M, j + 1)), jm = id(i, Math.max(0, j - 1));
    const ax = Xs[ip] - Xs[im], ay = Hs[ip] - Hs[im], az = Zs[ip] - Zs[im], bx = Xs[jp] - Xs[jm], by = Hs[jp] - Hs[jm], bz = Zs[jp] - Zs[jm]; let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz2 = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz2) || 1; nx /= l; ny /= l; nz2 /= l; if (ny < 0) { nx = -nx; ny = -ny; nz2 = -nz2; }
    const x = Xs[k], z = Zs[k], y = Hs[k], e = edge(x, z), w = nz.fbm(x * .009 + 2, z * .009 + 8, 2); let c = mix3(near, mid, sstep(12, 150, e + 40 * (w - .5))); c = mix3(c, far, sstep(240, 680, e)); c = mix3(c, rock, sstep(.16, .42, 1 - ny) * (T.snow != null ? .9 : .75));
    if (T.snow != null) c = mix3(c, snow, sstep(T.snow - 14, T.snow + 26, y + 34 * (w - .5)) * sstep(.62, .4, 1 - ny * .95) * (T.snow < 20 ? 1 : sstep(280, 560, e))); const tone = .92 + .16 * nz.v(x * .05, z * .05); c = [c[0] * tone, c[1] * tone, c[2] * tone];
    iV[k] = g.vert(x, y, z, nx, ny, nz2, Ws[k] ? [.03, .05, .08] : c, sstep(M - 3.2, M - .4, j), Ws[k]); } }
  yield;
  /* bandes : bandIdx[j] = triangles du terrain, items[j] = silhouettes posées dans cette bande */
  const bands = [], items = []; for (let j = 0; j < M; j++) { const b = []; for (let i = 0; i < N; i++) { const a = iV[id(i, j)], b1 = iV[id(i + 1, j)], c = iV[id(i + 1, j + 1)], d = iV[id(i, j + 1)]; b.push(a, b1, c, a, c, d); } bands.push(b); items.push([]); }
  const bandOf = (x, z) => { const r = Math.hypot(x, z), c = x / (r || 1), s = z / (r || 1), q = sq(c, s); for (let j = 0; j < M; j++) if (r <= mix(q, Rout, ease(j + 1))) return j; return M - 1; };
  const at = (eMin, eMax, bias = 1) => { for (let t = 0; t < 8; t++) { const a = rnd(0, TAU), c = Math.cos(a), s = Math.sin(a), e = eMin + (eMax - eMin) * Math.pow(R(), bias), r = (S + e) / Math.max(Math.abs(c), Math.abs(s)), x = c * r, z = s * r; if (landAt(x, z) > .95) return [x, z, e]; } return null; };
  const put = (x, z, fn) => { const l = []; fn(l); items[bandOf(x, z)].push({ r: x * x + z * z, l }); };
  const tintAt = (x, z) => { const e = edge(x, z), w = nz.fbm(x * .009 + 2, z * .009 + 8, 2); return mix3(mix3(near, mid, sstep(12, 150, e + 40 * (w - .5))), far, sstep(240, 680, e)); };
  const contact = (l, x, z, r) => { const c = tintAt(x, z), mid_ = g.vert(x, H(x, z) + .08, z, 0, 1, 0, [c[0] * .46, c[1] * .46, c[2] * .46]), rim = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; rim.push(g.vert(px, H(px, pz) + .04, pz, 0, 1, 0, tintAt(px, pz))); } for (let i = 0; i < 8; i++) l.push(mid_, rim[(i + 1) % 8], rim[i]); };
  const k = low ? .4 : 1, B = T.built || {}, shade = (c, v) => [c[0] * v, c[1] * v, c[2] * v];
  const wallsOf = { old: ['#b9a98f', '#a8947a', '#c2b49c', '#94836d', '#b39f84'], block: ['#6f675f', '#7a7068', '#635c58', '#857a6e'], mud: ['#b09a78', '#a48c68', '#bda684'], hangar: ['#8a8674', '#7d7a6c', '#948f7c'], plant: ['#6c6660', '#7a7068', '#5e5a58'] }, roofsOf = { old: ['#8a4e38', '#7a4632', '#96583e', '#6e4a3c'], block: ['#4e4c50', '#5a5654'], mud: ['#a08a68', '#93805f'], hangar: ['#5e6660', '#71705f', '#555c58'], plant: ['#4e4a48', '#5a5450'] };
  const pick = a => lin(a[Math.floor(R() * a.length) % a.length]);
  if (B.style === 'pine') for (let n = 0, m = B.n * k | 0; n < m; n++) { if (!(n & 15)) yield; const p = at(B.from, B.to); if (!p) continue; const [x, z, e] = p, cl = nz.fbm(x * .02 + 1, z * .02 + 2, 2); if (cl < .44) continue; const h = rnd(B.h[0], B.h[1]) * (1 + e / 500), y = foot(x, z, h * .3), dk = T.snow != null && T.snow < 20 ? lin('#26332f') : lin('#2f3c26'), tip = T.snow != null && T.snow < 20 ? lin('#c9d4dc') : lin('#46553a'); put(x, z, l => { drum(g, l, x, y, z, h * .34, 0, h * .62, 5, shade(dk, .8), dk); drum(g, l, x, y + h * .4, z, h * .25, 0, h * .6, 5, dk, tip); }); }
  if (wallsOf[B.style]) { const W = wallsOf[B.style], Q = roofsOf[B.style], m = B.n * k | 0; for (let n = 0; n < m; n++) { if (!(n & 15)) yield; const p = at(B.from, B.to, B.bias || 1); if (!p) continue; const [x, z, e] = p, near_ = e < 90, dens = nz.fbm(x * .012 + 9, z * .012 + 1, 2); if (B.style !== 'old' && dens < .4) continue; const big = B.style === 'hangar' ? rnd(1.6, 3) : 1, w = rnd(7, 15) * big * (B.style === 'hangar' ? 1.7 : 1) * (near_ ? .9 : 1.15 + e / 520), d = rnd(6, 12) * big * (near_ ? .9 : 1.15 + e / 520), h = rnd(B.h[0], B.h[1]) * (B.style === 'old' ? .7 + .6 * dens : 1) * (1 + e / 900), ry = Math.atan2(z, x) + (R() < .5 ? 0 : Math.PI / 2) + rnd(-.22, .22), y = foot(x, z, Math.max(w, d) * .6), w0 = pick(W), r0 = pick(Q), q0 = R(), kind = B.style === 'old' ? (q0 < .62 ? 'gable' : 'hip') : B.style === 'mud' ? 'flat' : B.style === 'hangar' ? 'shed' : (q0 < .58 ? 'shed' : q0 < .9 ? 'hip' : 'flat'); put(x, z, l => { contact(l, x, z, Math.max(w, d) * .82); building(g, l, x, z, y, w, d, h, ry, w0, r0, kind, R); }); } }
  if (B.houses) for (let n = 0; n < B.houses * k; n++) { const p = at(44, 210); if (!p) continue; const [x, z] = p, y = H(x, z) - .6, w = rnd(6, 11), d = rnd(5, 9), ry = rnd(0, TAU), wc = lin(['#b8ab90', '#a39680', '#c3b69c'][n % 3]), rc = lin(['#6e4034', '#5a4436'][n % 2]); put(x, z, l => building(g, l, x, z, y, w, d, rnd(3.4, 5.5), ry, wc, rc, 'gable', R)); }
  if (B.towers) for (let n = 0; n < B.towers; n++) { const p = at(120, 460); if (!p) continue; const [x, z] = p, y = H(x, z) - .6, w = rnd(6, 9), h = rnd(26, 38), wc = lin('#a89a84'); put(x, z, l => { building(g, l, x, z, y, w, w, h, rnd(0, 3), wc, wc, 'flat', R); drum(g, l, x, y + h, z, w * .62, 0, w * 1.5, 6, lin('#6f5a4c'), lin('#59483e')); }); }
  if (B.stacks) for (let n = 0; n < B.stacks * (low ? .6 : 1); n++) { const p = at(70, 520); if (!p) continue; const [x, z] = p, y = H(x, z) - .5, h = rnd(26, 58), r = rnd(1.4, 2.8), c = lin('#5a524e'); put(x, z, l => { drum(g, l, x, y, z, r * 1.5, r * .8, h, 7, shade(c, .7), c); drum(g, l, x, y + h * .86, z, r * .86, r * .86, h * .03, 7, lin('#a0503c'), lin('#a0503c')); }); }
  if (B.tanks) for (let n = 0; n < B.tanks * k; n++) { const p = at(60, 420); if (!p) continue; const [x, z] = p, y = H(x, z) - .4, r = rnd(6, 13), h = rnd(5, 10), c = lin(['#8a8680', '#77726c', '#938c82'][n % 3]); put(x, z, l => { contact(l, x, z, r * 1.5); drum(g, l, x, y, z, r, r, h, 9, shade(c, .66), c); drum(g, l, x, y + h, z, r, r * .55, r * .16, 9, c, shade(c, 1.08)); }); }
  if (B.cranes) for (let n = 0; n < B.cranes; n++) { const a = -.5 - n * .36 + rnd(-.1, .1), x = Math.sin(a * 3 + 1) * (S + 120) * (n % 2 ? 1 : -1), z = coastZ(x) - 18; if (landAt(x, z) < .7) continue; const y = H(x, z), h = rnd(24, 34), c = lin('#7d5a44'), ry = rnd(-.5, .5); put(x, z, l => { building(g, l, x, z, y, 3.2, 3.2, h, ry, c, c, 'flat', R); const dx = Math.cos(ry), dz = -Math.sin(ry); building(g, l, x + dx * 9, z + dz * 9, y + h - 1, 26, 1.6, 1.3, ry, c, c, 'flat', R); }); }
  yield;
  /* petit décor proche */
  const D = T.dress || {};
  for (let n = 0, m = (D.scrub || 0) * k | 0; n < m; n++) { const p = at(34, 150); if (!p) continue; const [x, z] = p; if (nz.fbm(x * .028 + 4, z * .028 + 6, 2) < .47) continue; const y = H(x, z) - .15, r = rnd(.5, 1.5) * (1 + p[2] / 150), c = mix3(mid, lin(T.seed === 79 ? '#3c4a26' : '#5a5c38'), .62); put(x, z, l => blob(g, l, x, y, z, r * 1.25, r * rnd(.42, .7), 6, shade(c, .72), c, R)); }
  for (let n = 0, m = (D.rock || 0) * k | 0; n < m; n++) { const p = at(34, 180); if (!p) continue; const [x, z] = p, y = H(x, z) - .25, r = rnd(.9, 3.2) * (1 + p[2] / 160), c = shade(rock, rnd(.85, 1.15)); put(x, z, l => blob(g, l, x, y, z, r * 1.3, r * rnd(.4, .72), 6, shade(c, .74), c, R)); }
  for (let n = 0, m = (D.wall || 0) * k | 0; n < m; n++) { const p = at(36, 130); if (!p) continue; const [x, z] = p, y = H(x, z) - .4, w = rnd(8, 22), ry = Math.atan2(z, x) + Math.PI / 2 + rnd(-.3, .3), c = lin(T.mid); put(x, z, l => building(g, l, x, z, y, w, .7, rnd(1, 1.9), ry, shade(c, 1.08), c, 'flat', R)); }
  for (let n = 0, m = (D.pole || 0) * k | 0; n < m; n++) { const p = at(36, 190); if (!p) continue; const [x, z] = p, y = H(x, z) - .2, h = rnd(6, 10), c = lin('#3d3832'); put(x, z, l => { drum(g, l, x, y, z, .17, .12, h, 3, c, c); building(g, l, x, z, y + h - .4, 2, .16, .16, rnd(0, 3), c, c, 'flat', R); }); }
  yield;
  /* ordre du peintre : de l'anneau extérieur vers l'intérieur, silhouettes de chaque bande après son terrain */
  const idx = []; for (let j = M - 1; j >= 0; j--) { for (const v of bands[j]) idx.push(v); items[j].sort((a, b) => b.r - a.r); for (const it of items[j]) for (const v of it.l) idx.push(v); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('aN', new THREE.BufferAttribute(new Int8Array(g.n), 4, true)); geo.setAttribute('aC', new THREE.BufferAttribute(new Uint8Array(g.c), 4, true));
  geo.setIndex(g.v > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Rout + 400);
  return geo;
}

/* Macro-variation partagée par le sol extérieur et le terrain lointain : aucune répétition, aucun raccord entre les deux. */
const MACRO = `float hzMacro(vec2 p){return sin(p.x*.021+1.7*sin(p.y*.013))*sin(p.y*.017+1.3*sin(p.x*.011))+.5*sin(p.x*.067+p.y*.041+2.*sin(p.y*.029));}`;
/* Brouillard du décor lointain : suit celui de la carte au début, puis plafonne ; la dissolution vers le ciel est portée par la distance. */
const CAPFOG = `float hzFog(float z,float k){float w=1.-exp(-k*k*z*z);return .22*(1.-exp(-w/.22));}`;
/* Le ciel et la brume sont évalués par sommet : le maillage couvre souvent la moitié de l'écran, le fragment reste donc très léger. */
const VS = `uniform sampler2D uSky;uniform vec4 uHaze;uniform float fogDensity;attribute vec4 aN;attribute vec4 aC;varying vec3 vW;varying vec3 vN;varying vec3 vC;varying vec2 vK;varying vec3 vSky;varying vec2 vH;
${CAPFOG}
void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=aN.xyz;vC=aC.rgb*aC.rgb;float rim=clamp(aN.w,0.,1.);vK=vec2(aC.a,rim);vec4 mv=viewMatrix*w;
 vec3 V=w.xyz-cameraPosition;float d=length(V);vec3 D=V/d,up=normalize(vec3(D.x,max(D.y,.03),D.z));vSky=textureLod(uSky,vec2(atan(up.z,up.x)*.15915494+.5,asin(clamp(up.y,-1.,1.))*.31830989+.5),1.).rgb;
 float hy=exp(-max(w.y,0.)/uHaze.y),far=1.-exp(-pow(d/uHaze.x,1.15)*(.78+.22*hy)),h=1.-(1.-hzFog(-mv.z,fogDensity))*(1.-far);vH=vec2(max(clamp(h,0.,1.),rim),smoothstep(uHaze.z,uHaze.w,d));
 gl_Position=projectionMatrix*mv;gl_Position.z=gl_Position.w*(1.-2e-6);}`;
const FS = `uniform sampler2D uSky;uniform vec3 uSun,uSunC,uAmb,uDeep,uGain;uniform float uEdge;uniform vec3 fogColor;varying vec3 vW;varying vec3 vN;varying vec3 vC;varying vec2 vK;varying vec3 vSky;varying vec2 vH;
${MACRO}
vec3 hzSky(vec3 D,float l){return textureLod(uSky,vec2(atan(D.z,D.x)*.15915494+.5,asin(clamp(D.y,-1.,1.))*.31830989+.5),l).rgb;}
void main(){vec3 N=normalize(vN);vec3 c;
 if(vK.x>.5){vec3 V=vW-cameraPosition;float d=length(V);vec3 D=V/d;float r=sin(vW.x*.13+1.9*sin(vW.z*.07))*sin(vW.z*.19+vW.x*.05);vec3 W=normalize(vec3(.018*r,1.,.024*r));vec3 Rf=reflect(D,W);Rf.y=abs(Rf.y)+.015;float F=.05+.95*pow(1.-clamp(-dot(D,W),0.,1.),4.);c=mix(uDeep*(uAmb+.3*uSunC),hzSky(normalize(Rf),2.),F);c+=uSunC*.5*pow(max(dot(normalize(Rf),uSun),0.),90.);}
 else{float m=hzMacro(vW.xz),eg=max(abs(vW.x),abs(vW.z))-uEdge,pt=sin(vW.x*.19+2.*sin(vW.z*.11))*sin(vW.z*.23+2.*sin(vW.x*.13));float wl=step(.1,vK.x),sn=max(dot(N,uSun),0.)*(1.-.42*wl);c=vC*mix(uGain,vec3(1.),smoothstep(24.,210.,eg))*(1.+m*mix(.11,.2,smoothstep(30.,130.,eg))+.07*pt*smoothstep(30.,90.,eg))*(uAmb*(.62+.38*N.y)+uSunC*sn);if(wl>.5){float d=length(vW-cameraPosition),u=dot(vW.xz,vec2(-N.z,N.x)),fy=fract(vW.y/3.1),fx=fract(u/2.9),w=smoothstep(.2,.26,fx)*(1.-smoothstep(.7,.76,fx))*smoothstep(.3,.36,fy)*(1.-smoothstep(.74,.8,fy));c*=1.-(.5*w+.12*(1.-smoothstep(0.,.08,fy)))*(1.-smoothstep(150.,430.,d));}}
 gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 vec3 so=linearToOutputTexel(vec4(vSky,1.)).rgb;gl_FragColor.rgb=mix(gl_FragColor.rgb,mix(fogColor,so,vH.y),vH.x);
 gl_FragColor.rgb+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255.;
}`;

const FOGC = `#ifdef FOG_EXP2
 {float hzE=max(abs(hzW.x),abs(hzW.y))-hzS,hzK=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,mix(hzK,hzFog(vFogDepth,fogDensity),smoothstep(1.,18.,hzE)));}
 #endif`;
const skyLight = new WeakMap();
function skyDiffuse(img) {
  if (skyLight.has(img)) return skyLight.get(img);
  const c = document.createElement('canvas'); c.width = 32; c.height = 16; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 32, 16);
  const d = x.getImageData(0, 0, 32, 8).data, q = new THREE.Color(), t = [0, 0, 0]; let W = 0;
  for (let j = 0, k = 0; j < 8; j++) { const el = (.5 - (j + .5) / 16) * Math.PI, w = Math.sin(el) * Math.cos(el); for (let i = 0; i < 32; i++, k += 4) { q.setRGB(d[k] / 255, d[k + 1] / 255, d[k + 2] / 255, THREE.SRGBColorSpace); t[0] += q.r * w; t[1] += q.g * w; t[2] += q.b * w; W += w; } }
  const r = [t[0] / W, t[1] / W, t[2] / W]; skyLight.set(img, r); return r;
}
let mat = null, U = null, outerU = null, patched = new WeakSet();
function material() {
  if (mat) return mat;
  U = { uSky: { value: null }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Vector3(1, 1, 1) }, uAmb: { value: new THREE.Vector3(.5, .5, .5) }, uDeep: { value: new THREE.Vector3(.02, .03, .05) }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uEdge: { value: 50 }, uHaze: { value: new THREE.Vector4(900, 90, 110, 340) }, fogColor: { value: new THREE.Color() }, fogDensity: { value: .005 }, fogNear: { value: 1 }, fogFar: { value: 2000 } };
  mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, fog: true, depthWrite: false, depthTest: true, side: THREE.FrontSide });
  mat.name = 'horizon'; return mat;
}
/* Sol extérieur : continue la carte (miroir de son sol cuit), passe au terrain, puis s'efface au-dessus du maillage lointain. */
function patchOuter(m) {
  if (patched.has(m)) return; patched.add(m);
  outerU = outerU || { hzG: { value: null }, hzS: { value: 50 }, hzA: { value: new THREE.Color() } };
  m.transparent = true; m.onBeforeCompile = s => { s.uniforms.hzG = outerU.hzG; s.uniforms.hzS = outerU.hzS; s.uniforms.hzA = outerU.hzA;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 hzW;').replace('#include <project_vertex>', '#include <project_vertex>\nhzW=(modelMatrix*vec4(transformed,1.)).xz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nuniform sampler2D hzG;uniform float hzS;uniform vec3 hzA;varying vec2 hzW;${MACRO}${CAPFOG}`).replace('#include <map_fragment>', `#include <map_fragment>
 {float E=max(abs(hzW.x),abs(hzW.y))-hzS;if(E>0.){float M=hzMacro(hzW);vec2 q=hzW;if(abs(q.x)>hzS)q.x=sign(q.x)*(2.*hzS-abs(q.x));if(abs(q.y)>hzS)q.y=sign(q.y)*(2.*hzS-abs(q.y));float I=.5/(hzS+2.);
  vec3 b=texture2D(hzG,vec2(.5+q.x*I,.5-q.y*I)).rgb;diffuseColor.rgb=mix(b,diffuseColor.rgb,smoothstep(2.,15.,E+2.5*M));diffuseColor.rgb=mix(diffuseColor.rgb,hzA*(1.+.11*M),smoothstep(10.,26.,E));diffuseColor.a*=1.-smoothstep(19.,33.,E+2.*M);}}`).replace('#include <fog_fragment>', FOGC); };
  m.customProgramCacheKey = () => 'hz-outer1'; m.needsUpdate = true;
}
function patchWater(m) {
  if (patched.has(m)) return; patched.add(m);
  m.transparent = true; m.onBeforeCompile = s => { s.uniforms.hzS = outerU.hzS; s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 hzW;').replace('#include <project_vertex>', '#include <project_vertex>\nhzW=(modelMatrix*vec4(transformed,1.)).xz;'); s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nuniform float hzS;varying vec2 hzW;${CAPFOG}`).replace('#include <map_fragment>', '#include <map_fragment>\n{float E=max(abs(hzW.x),abs(hzW.y))-hzS;diffuseColor.a*=1.-smoothstep(36.,92.,E);}').replace('#include <fog_fragment>', FOGC); };
  m.customProgramCacheKey = () => 'hz-water1'; m.needsUpdate = true;
}

/* Point d'entrée du rendu. Retourne null (et l'ancien décor reste) si quoi que ce soit échoue. */
export function begin(L, E, scene) { const q = steps(L, E, scene); let r; while (!(r = q.next()).done); return r.value; }
/* Version découpée, utilisée par le chargement : rend la main entre les anneaux. */
export function* steps(L, E, scene) {
  try {
    if (!E || !E.sun || L.env === 'bunker') return null;
    const T = themeOf(L.env, E), low = scene.userData.fzLook === 0 || scene.userData.fzLowP === 1, geo = yield* buildGeometry(L, E, T, low), S = L.size;
    const m = material(), sd = new THREE.Vector3(...E.sun).normalize(), sc = new THREE.Color(E.sunCol), hs = new THREE.Color(E.hemi[0]), I = E.hemi[2];
    const av = [0, 0, 0]; let nA = 0; for (const [o, h] of E.sky) if (o <= .5) { const c = new THREE.Color(h); av[0] += c.r; av[1] += c.g; av[2] += c.b; nA++; } const ek = .6 * (E.envI || 1) / (nA || 1);
    U.uSun.value.copy(sd); U.uSunC.value.set(sc.r, sc.g, sc.b).multiplyScalar(E.sunI / Math.PI); U.uAmb.value.set(hs.r * I / Math.PI + av[0] * ek, hs.g * I / Math.PI + av[1] * ek, hs.b * I / Math.PI + av[2] * ek);
    if (T.sea) { const c = new THREE.Color(T.sea.deep); U.uDeep.value.set(c.r, c.g, c.b); }
    U.uHaze.value.set(T.haze || 950, 95, Math.max(120, S * 1.4), 1150);
    U.uGain.value.set(1, 1, 1); U.uEdge.value = S; U.fogColor.value.setHex(E.fog[0]); U.fogDensity.value = E.fog[1];
    const mesh = new THREE.Mesh(geo, m); mesh.name = 'horizon'; mesh.frustumCulled = false; mesh.renderOrder = 50; mesh.castShadow = mesh.receiveShadow = false; mesh.matrixAutoUpdate = false;
    const Cg = new THREE.Color(E.ground), Ct = new THREE.Color(L.env === 'snow' ? 0xf4f6f8 : 0xd8d0c4);
    return {
      mesh, tris: geo.index.count / 3,
      skip: o => /^far/.test(o.m),
      outer(o, om, gTex) { try { patchOuter(om); outerU.hzG.value = gTex; outerU.hzS.value = S; outerU.hzA.value.setRGB(Cg.r * Ct.r, Cg.g * Ct.g, Cg.b * Ct.b); o.renderOrder = -2; } catch (e) { console.warn('[horizon] outer', e); } },
      /* Couleur moyenne réelle du sol de la carte (tuile déjà peinte, canvas logiciel) : le terrain lointain part exactement de ce ton. */
      calib(img) { try { const d = img.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, img.width, img.height).data, c = new THREE.Color(), t = [0, 0, 0]; let n = 0; for (let i = 0; i < d.length; i += 76) { c.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace); t[0] += c.r; t[1] += c.g; t[2] += c.b; n++; } const m = t.map(v => v / n); U.uGain.value.set(clamp(m[0] / Cg.r, .72, 1.3), clamp(m[1] / Cg.g, .72, 1.3), clamp(m[2] / Cg.b, .72, 1.3)); outerU.hzA.value.setRGB(Cg.r * Ct.r * U.uGain.value.x, Cg.g * Ct.g * U.uGain.value.y, Cg.b * Ct.b * U.uGain.value.z); } catch (e) { console.warn('[horizon] calib', e); } },
      finish(root, water, wm, skyTex) { try { U.uSky.value = skyTex; { const a = skyDiffuse(skyTex.image), ei = .6 * (E.envI || 1); U.uAmb.value.set(hs.r * I / Math.PI + a[0] * ei, hs.g * I / Math.PI + a[1] * ei, hs.b * I / Math.PI + a[2] * ei); } if (water) { patchWater(wm); water.renderOrder = -1; } root.add(mesh); } catch (e) { console.warn('[horizon] finish', e); } },
    };
  } catch (e) { console.warn('[horizon] désactivé pour cette carte', e); if (outerU) outerU.hzS.value = 1e6; return null; }
}
