/* FRONT ZÉRO : Barrage d'Aiguenoire. Barrage-poids en maçonnerie au fond d'une gorge rocheuse, occupé par l'armée.
   Ouest et est : plateaux à 12 m (camps). Nord : la retenue (eau à 9,3 m), tour de prise d'eau, station de pompage, hangar à bateaux.
   Centre : le barrage (couronnement 12 m, risberme et galerie haute 8,4 m, galerie de pied 0 m, usine au pied, évacuateur de crue) ;
   escaliers à vis dans les culées rocheuses, sous les maisons de garde.
   Sud : le lit de la rivière (0 m), corniche ouest (3,6 m), poste de transformation sur la terrasse est (6 m), crête ouest et butte est (15,2 m) reliées par une passerelle.
   Le relief est peint sur une grille de 50 cm (H dessus, T type) par des « tailles » successives ; les parois suivent les contours lissés de la grille.
   Le sol du moteur (y = 0) est celui du lit et des galeries basses. */
import { Arch, noise2, TAU, archMaterial } from './map-arch.js';

const S = 72, G = .5, N = 288, NN = N * N, FACE = 2.6;
const RIV = 0, LEDGE = 4.8, SWY = 6, BERM = 8.4, WFL = 8.2, WAT = 9.3, SHORE = 9.6, TOP = 12, RIDGE = 15.2, HIGH = 22;
const GND = 0, ROCK = 1, WATER = 2, STRUCT = 3, PAVE = 4, EDGE = 5;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), sstep = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/* repères du barrage */
const ZU = -6, ZC = -.6, ZB = 1, ZBO = 3, ZT = 11, XC = 31.5, XR = 22, XB = 26;      // parement amont, aval du couronnement, pied et bord de la risberme, pied du barrage ; demi-couronnement, demi-lit, demi-risberme
const zUp = y => ZC + (ZB - ZC) * (TOP - y) / (TOP - BERM);                                 // parement aval haut (12 -> 8,4)
const zLo = y => (y <= 2 ? ZT : ZBO + (ZT - ZBO) * Math.pow(1 - (y - 2) / (BERM - 2), 1.5));   // parement aval bas, concave (8,4 -> 2), puis mur de pied vertical
const HX0 = -7.4, HX1 = 11.4, HZ1 = 22.6;                                                    // usine
const SX0 = -20.6, SX1 = -11, SW = .6;                                                       // évacuateur (bajoyers compris)
const SPX = 31.5, SPZ = 4.5, SPR = 2.25;                                                     // puits à vis des culées (±SPX), sous les maisons de garde
const FGZ0 = -4.4, FGZ1 = -1.8, FGH = 2.8, FGX = 32.8, UGX0 = -10.4, UGX1 = 26.6, UGZ0 = -4.6, UGZ1 = -2;  // galerie de pied (jusqu'aux culées), galerie haute (est de l'évacuateur)
const SPILL = SHORE;                                                                         // seuil de l'évacuateur
const spillY = z => (z <= -2 ? SPILL : SPILL * (1 - sstep((z + 2) / 20)));

/* trous creusés dans le corps du barrage et dans le rocher : galeries, rameaux, puits, passages */
const HOLES = [
  [-FGX, FGX, 0, FGH, FGZ0, FGZ1],                               // galerie de pied
  [-7, -4.4, 0, 2.6, FGZ1 - .01, ZT + .05],                       // rameau vers le lit (entre l'évacuateur et l'usine)
  [18.6, 21.2, 0, 2.6, FGZ1 - .01, ZT + .05],                     // rameau vers le lit (est des conduites forcées)
  [1.2, 3.8, 0, 2.8, FGZ1 - .01, ZT + .05],                       // rameau vers l'usine
  [UGX0, UGX1, BERM, BERM + 2.6, UGZ0, UGZ1],                     // galerie haute
  [-1.4, 1.4, BERM, BERM + 2.4, UGZ1 - .01, ZB + .05],            // galerie haute -> toit de l'usine
  [18.6, 21.2, BERM, BERM + 2.4, UGZ1 - .01, ZB + .05],           // galerie haute -> risberme est
  [24, 26.6, BERM, BERM + 2.4, UGZ1 - .01, ZB + .05],             // galerie haute (bout est) -> risberme
  [SPX - SPR - .45, SPX + SPR + .45, 0, TOP + .05, SPZ - SPR - .45, SPZ + SPR + .45],     // puits est
  [-SPX - SPR - .45, -SPX + SPR + .45, 0, TOP + .05, SPZ - SPR - .45, SPZ + SPR + .45],   // puits ouest
  [SPX - 1.3, SPX + 1.3, 0, 2.6, FGZ0, SPZ - SPR + .2], [-SPX - 1.3, -SPX + 1.3, 0, 2.6, FGZ0, SPZ - SPR + .2],   // galerie de pied -> pieds des vis
  [XB, SPX - SPR + .2, BERM, BERM + 2.4, ZB, SPZ + 1.1], [-SPX + SPR - .2, -XB, BERM, BERM + 2.4, ZB, SPZ + 1.1],   // risberme -> vis (salle taillée)
];

let lastLayout = null;
export function buildBarrage(Kit) { if (lastLayout) return lastLayout; const g = barrageSteps(Kit); let r; while (!(r = g.next()).done); return r.value; }
export function* barrageSteps(Kit) {
  const k = new Kit('gorge', S, 7331); k.chunk = 43; k.limit('concrete');
  const H = new Float32Array(NN).fill(HIGH), HR = new Float32Array(NN).fill(HIGH), ISO = new Uint8Array(NN), T = new Uint8Array(NN).fill(ROCK), GM = new Uint8Array(NN), BLD = new Uint8Array(NN), LV = new Float32Array(NN).fill(-1);
  const X = i => -S + (i + .5) * G, Ic = v => clamp(Math.floor((v + S) / G), 0, N - 1), at = (x, z) => Ic(z) * N + Ic(x);
  const sn = (x, z, f, a, o = 0) => (noise2(x * f + o, z * f - o * .7) - .5) * 2 * a;
  const fill = (x0, x1, z0, z1, f) => { const a = Math.round((x0 + S) / G), b = Math.round((x1 + S) / G), c = Math.round((z0 + S) / G), d = Math.round((z1 + S) / G); for (let j = Math.max(0, c); j < Math.min(N, d); j++) for (let i = Math.max(0, a); i < Math.min(N, b); i++) f(j * N + i, i, j); };
  /** Soustraction de boîtes : boîtes disjointes couvrant B moins les trous. */
  const minus = (B, holes) => { let out = [B]; for (const h of holes) { const nx = []; for (const b of out) { if (h[0] >= b[1] || h[1] <= b[0] || h[2] >= b[3] || h[3] <= b[2] || h[4] >= b[5] || h[5] <= b[4]) { nx.push(b); continue; } let [x0, x1, y0, y1, z0, z1] = b; if (h[0] > x0) { nx.push([x0, h[0], y0, y1, z0, z1]); x0 = h[0]; } if (h[1] < x1) { nx.push([h[1], x1, y0, y1, z0, z1]); x1 = h[1]; } if (h[4] > z0) { nx.push([x0, x1, y0, y1, z0, h[4]]); z0 = h[4]; } if (h[5] < z1) { nx.push([x0, x1, y0, y1, h[5], z1]); z1 = h[5]; } if (h[2] > y0) nx.push([x0, x1, y0, h[2], z0, z1]); if (h[3] < y1) nx.push([x0, x1, h[3], y1, z0, z1]); } out = nx; } return out; };
  const sol = (x0, x1, y0, y1, z0, z1, surf = 'concrete', mm) => { const s = k.col(Math.min(x0, x1), Math.max(x0, x1), y0, y1, Math.min(z0, z1), Math.max(z0, z1), surf); if (mm !== undefined) s.mm = mm; return s; };
  const solids = (B, holes = HOLES, surf = 'concrete', mm, inner = 1) => { for (const b of minus(B, holes)) if (b[1] - b[0] > .005 && b[3] - b[2] > .005 && b[5] - b[4] > .005) { const s = sol(b[0], b[1], b[2], b[3], b[4], b[5], surf, mm); if (inner) s.inner = 1; } };

  let C_MB = () => 0; const KNO = new Uint8Array(NN);   // cellules de la butte (pas de gradins de strates)   // bosses des plateaux (hauteur lisse), posé plus bas
  /* ---------- 1. relief : tailles successives depuis un massif à 22 m ---------- */
  const F = new Float64Array(NN), D = new Float64Array(NN), fa = new Float64Array(N), da = new Float64Array(N), vv = new Int32Array(N), zz = new Float64Array(N + 1), INF = 1e12;
  const dt1 = () => { let q2 = 0; vv[0] = 0; zz[0] = -INF; zz[1] = INF; for (let q = 1; q < N; q++) { let s = ((fa[q] + q * q) - (fa[vv[q2]] + vv[q2] * vv[q2])) / (2 * q - 2 * vv[q2]); while (s <= zz[q2]) { q2--; s = ((fa[q] + q * q) - (fa[vv[q2]] + vv[q2] * vv[q2])) / (2 * q - 2 * vv[q2]); } q2++; vv[q2] = q; zz[q2] = s; zz[q2 + 1] = INF; } q2 = 0; for (let q = 0; q < N; q++) { while (zz[q2 + 1] < q) q2++; da[q] = (q - vv[q2]) * (q - vv[q2]) + fa[vv[q2]]; } };
  const edt = M => { for (let c = 0; c < NN; c++) F[c] = M[c] ? 0 : INF; for (let i = 0; i < N; i++) { for (let j = 0; j < N; j++) fa[j] = F[j * N + i]; dt1(); for (let j = 0; j < N; j++) D[j * N + i] = da[j]; } for (let j = 0; j < N; j++) { for (let i = 0; i < N; i++) fa[i] = D[j * N + i]; dt1(); for (let i = 0; i < N; i++) D[j * N + i] = da[i]; } };
  const prof = (d, rise, x, z, o) => { const face = Math.min(rise, o.face ?? FACE); if (rise <= face + .01) return rise; const W = o.W ?? 5, t = clamp(d / W, 0, 1); let y = face + (rise - face) * (1 - Math.pow(1 - t, o.pow ?? 1.7)); y += sn(x, z, .21, o.rough ?? 1.1, 3.1) * Math.min(1, d / 1.5) * (1 - t); return clamp(y, face, rise); };
  /** Taille : dedans, le terrain descend à h ; autour, une paroi (pied vertical de FACE puis pente sur W) remonte vers le terrain d'avant. */
  const carve = (h, inside, o = {}) => { const M = new Uint8Array(NN); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (inside(X(i), X(j))) M[j * N + i] = 1; edt(M); const ty = o.type ?? GND, gm = o.gm ?? 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = j * N + i; if (T[c] === STRUCT || T[c] === EDGE) continue; if (M[c]) { H[c] = HR[c] = h; T[c] = ty; GM[c] = gm; continue; } const old = H[c]; if (old <= h + .05) continue; const d = Math.sqrt(D[c]) * G - G / 2; if (d > (o.W ?? 5) + 1) continue; const y = h + prof(d, Math.min(old, HR[c]) - h, X(i), X(j), o), yq = Math.ceil(y * 4 - 1e-6) / 4; if (yq < old - .05) { H[c] = yq; HR[c] = Math.min(y, HR[c]); T[c] = ROCK; } }
    return M; };
  const xRes = z => 1.5 * Math.sin(z * .07), wRes = z => (z > -8 ? XR : z > -30 ? XR + 8 * sstep((-8 - z) / 22) : 30 - 9 * sstep((-30 - z) / 40));
  const xRiv = z => 1.6 * Math.sin(z * .09 + .4), wRiv = z => (z < 15 ? XR : z < 28 ? XR - 5 * sstep((z - 15) / 13) : z < 58 ? 17 + .8 * Math.sin(z * .2) : 17 - 2 * sstep((z - 58) / 14));
  const ridgeIn = (x, z) => z > 15 + sn(x, z, .3, 1.2) && z < 57 + sn(x, z, .2, 1.5) && x > -43.5 + sn(x, z, .15, 1.4) && x < -31.6 + sn(x, z, .17, .9, 2);
  const knollIn = (x, z) => Math.hypot((x - 42.5) / 6.4, (z - 45.5) / 8) < 1 + sn(x, z, .3, .12);
  yield;
  const mRidge = carve(RIDGE, ridgeIn, { W: 2, gm: 5 }), mKnoll = new Uint8Array(NN); yield;
  carve(TOP, (x, z) => !mRidge[at(x, z)] && !mKnoll[at(x, z)], { W: 1.4, face: 2.4, gm: 0 });
  yield;
  yield; carve(SHORE, (x, z) => z < -9.5 + sn(x, z, .2, 1) && Math.abs(x - xRes(z)) < wRes(z) + 7 + sn(x, z, .13, 2.2, 5), { W: 6.5, face: 0, rough: .6, pow: 1.2, gm: 1 });
  yield; carve(SWY, (x, z) => z > 15.5 + sn(x, z, .2, 1) && x > 10 && x < 53 + sn(x, z, .14, 2, 7), { W: 3.2, gm: 2 });
  /* butte est : affleurement naturel (sommet plat à 15,2, paroi bombée à pied raide jusqu'à la terrasse) */
  const KX = 43.6, KZ = 46, kTop = a => 5.3 * (1 + .1 * Math.sin(a * 3 + .4) + .06 * Math.sin(a * 5 + 1.3)), kN = (a, o) => noise2(Math.cos(a) * 1.6 + o, Math.sin(a) * 1.6 - o * .7), kOut = a => kTop(a) + (Math.cos(a) > .75 ? 1.7 + .6 * kN(a, 3) : Math.sin(a) < -.55 ? 1.9 + 1.2 * kN(a, 3) : 2.6 + 3.4 * kN(a, 3) + 1.2 * kN(a * 2, 9)), kY = (r, a) => { const r0 = kTop(a), r1 = kOut(a); if (r <= r0) return RIDGE; if (r >= r1) return SWY; const t = (r - r0) / (r1 - r0), w = .45 * kN(a, 7), xx = KX + r * Math.cos(a), zz = KZ + r * Math.sin(a); return SWY + (RIDGE - SWY) * ((1 - t) * (1 - t) * (1 + 2 * t) * (1 - w) + Math.pow(1 - t, .6) * w) + (noise2(xx * .9, zz * .9) - .5) * .7 * Math.sin(Math.PI * t) + (kN(a * 3, 17) - .5) * 6 * t * (1 - t); };   /* plan irrégulier (éperons, rentrants) ; pente rugueuse tantôt bombée tantôt creuse selon le côté, bosses en éperon : plus d'anneaux ni de vires */
  fill(KX - 14.5, KX + 14.5, KZ - 14.5, KZ + 14.5, (c, i, j) => { const dx = X(i) - KX, dz = X(j) - KZ, r = Math.hypot(dx, dz), a = Math.atan2(dz, dx); if (r + .36 >= kOut(a) || T[c] === STRUCT) return; if (H[c] > SWY + .05 && r > kTop(a)) return; const y = kY(r, a); if (r <= kTop(a)) { H[c] = HR[c] = RIDGE; T[c] = GND; GM[c] = 5; ISO[c] = 0; } else { H[c] = Math.max(SWY, Math.floor(y * 4) / 4); HR[c] = y; T[c] = ROCK; ISO[c] = 0; KNO[c] = 1; } });
  /* pied de la butte : la rangée extérieure est au niveau de la terrasse, la roche rejoint le sol sans marche */
  { const rim = []; for (let c = 0; c < NN; c++) { if (!KNO[c]) continue; const i = c % N, j = (c - i) / N; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const e = (j + b) * N + i + a; if (!KNO[e] && H[e] <= SWY + .05) { rim.push(c); break; } } } for (const c of rim) H[c] = SWY; }
  yield; carve(LEDGE, (x, z) => z > 14 + sn(x, z, .25, 1, 2) && x > -27 + sn(x, z, .16, 1.2, 4) && x < -6, { W: 2.4, gm: 1 });
  yield;
  carve(RIV, (x, z) => z > 3 && Math.abs(x - xRiv(z)) < wRiv(z) + (z > 15 ? sn(x, z, .11, 1.4, 9) : 0), { W: 3.2, gm: 3 });
  yield; carve(WFL, (x, z) => z < ZU && Math.abs(x - xRes(z)) < wRes(z) + sn(x, z, .12, 1.6, 11) * clamp((-z - 8) / 6, 0, 1), { W: 1, type: WATER, gm: 4 });
  /* bosses rocheuses du lit (abris, jamais d'impasse) */
  const ISL = [[-4.5, 35, 3.2, 3.1], [9, 55, 2.7, 2.5], [-8.5, 61, 3.4, 3.4], [16, 38, 2.1, 1.9], [3, 66.5, 2.6, 2.2]];
  /* affleurements sur les plateaux et les rives (abris), même rendu que les bosses du lit */
  const OUT = [[-52, -17.4, 2.6, 2.2, TOP],   /* [stairs2] 60 cm au nord : son anneau bas (1 m) mordait sur la dernière marche de la volée (-47, -21), côté z+ */ [-60, 48, 3.2, 2.6, TOP], [-50, 22, 2, 1.6, TOP], [-66, -40, 3, 2.4, TOP], [-48, -52, 2.4, 2, TOP], [54, -14, 2.4, 2, TOP], [60, 50, 3, 2.4, TOP], [64, -44, 3, 2.4, TOP], [50, -54, 2.2, 1.8, TOP], [56, 24, 2, 1.6, TOP], [-24, -48, 2.2, 1.6, SHORE], [26, -50, 2.4, 1.8, SHORE]];
  for (const o of OUT) ISL.push([o[0], o[1], o[2], o[3], o[4]]);
  /* bancs de roche en trois lits : pied raide, corniche, lit moyen, sommet ; les facettes suivront exactement ces cellules */
  for (const [cx, cz, r, h, base = 0] of ISL) fill(cx - r - 1.5, cx + r + 1.5, cz - r - 1.5, cz + r + 1.5, (c, i, j) => { const q = Math.hypot(X(i) - cx, (X(j) - cz) * 1.15) / (r * (1 + .2 * sn(X(i), X(j), .7, 1))); if (q < 1 && T[c] === GND && Math.abs(H[c] - base) < .01) { const lv = q < .42 ? 1 : q < .7 ? .7 : .38; H[c] = HR[c] = base + Math.max(.5, Math.ceil(h * lv * 4) / 4); T[c] = ROCK; ISO[c] = 0; } });
  /* lit : galets mouillés le long du filet d'eau, bancs de graviers clairs */
  const strC = z => xRiv(z) + 3 * Math.sin(z * .06 + 1) + 2, strW = z => 2.6 + 1.2 * noise2(z * .08, 4) + (z > 40 ? 1 : 0);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = j * N + i, z = X(j); if (T[c] !== GND || GM[c] !== 3 || z < 22) continue; const d = Math.abs(X(i) - strC(z)) - strW(z); if (d < 1.4 + .8 * noise2(X(i) * .4, z * .4)) GM[c] = 8; else if (noise2(X(i) * .13 + 7, z * .13) > .62) GM[c] = 9; }
  /* pistes de terre sur les plateaux : prolongement du couronnement vers les camps, desserte du poste de commande et des rives */
  const ROADS = [[[-31.5, -3.3], [-44, -3.6], [-56, -1], [-68, 2]], [[31.5, -3.3], [44, -3.8], [56, -2], [68, 1]], [[46, -3.7], [52, 4], [54, 14], [54, 30], [52, 40]], [[-44, -3.6], [-46, -14], [-44, -24]], [[46, -3.7], [48, -16], [46, -26]]];
  for (const pl of ROADS) for (let q = 0; q < pl.length - 1; q++) { const [ax, az] = pl[q], [bx, bz] = pl[q + 1], L = Math.hypot(bx - ax, bz - az); for (let t = 0; t <= L; t += .4) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L, w = 2.1 + .5 * noise2(x * .2, z * .2); fill(x - w, x + w, z - w, z + w, (c, i, j) => { if (T[c] === GND && Math.hypot(X(i) - x, X(j) - z) < w) GM[c] = 7; }); } }
  /* périmètre : falaises continues hors du rectangle arrondi (même méthode que Valferrade) */
  const RX = 70, RZ = 70, RC = 6, dOut = (x, z) => { const qx = Math.abs(x) - (RX - RC), qz = Math.abs(z) - (RZ - RC); return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - RC; };
  const inH = (x, z) => { let px = clamp(x, -(RX - RC), RX - RC), pz = clamp(z, -(RZ - RC), RZ - RC); const dx = x - px, dz = z - pz, l = Math.hypot(dx, dz); if (l > 1e-6) { const n = Math.ceil(l / .4); for (let q = 1; q <= n; q++) { const tx = px + dx / n, tz = pz + dz / n; if (dOut(tx, tz) > -.3) break; px = tx; pz = tz; } } return H[Ic(pz) * N + Ic(px)]; };
  const cliffTop = (x, z) => 21 + 8 * noise2(x * .045 + 3, z * .045) + (Math.abs(x) > 40 ? 3 : 0);
  const prof2 = (x, z, fl) => { const d = dOut(x, z); if (d <= 0) return fl; const face = 2.6 * Math.min(1, Math.sqrt(d / .15)), ht = Math.max(fl + 6, cliffTop(x, z)), body = d > .15 ? (ht - fl - 2.6) * (1 - Math.exp(-(d - .15) / 2.4)) : 0, nz = (noise2(x * .2, z * .2) - .5) * 1.4 * Math.min(1, d / 2), out = 3 * Math.max(0, noise2(x * .08 + 7, z * .08) - .62) * Math.min(1, d / 3); return fl + face + Math.max(0, body) + nz + out; };
  { const hh = new Float32Array(NN); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = X(i), z = X(j); if (dOut(x, z) <= 0) continue; const pv = prof2(x, z, inH(x, z)); hh[j * N + i] = dOut(x, z) < 2.2 ? Math.round(pv * 2) / 2 : Math.ceil(pv / 3) * 3; } for (let c = 0; c < NN; c++) if (hh[c]) { H[c] = HR[c] = hh[c]; T[c] = EDGE; } }
  yield;

  /* ---------- 2. emprises construites ---------- */
  const SET = (x0, x1, z0, z1, h, lv) => fill(x0, x1, z0, z1, c => { T[c] = STRUCT; H[c] = h; LV[c] = lv; });
  SET(-XC, XC, ZU, ZC, TOP, TOP); SET(-XB, XB, ZC, ZBO, BERM, BERM); SET(-XR, XR, ZBO, ZT, 2, 0); SET(HX0, HX1, ZBO, ZT, BERM, BERM); SET(SX0, SX1, ZT, 34.6, 0, 0);
  fill(-4.6, 4.6, -23.6, -14.4, (c, i, j) => { if (Math.hypot(X(i), X(j) + 19) < 4.45) { T[c] = STRUCT; H[c] = TOP; LV[c] = TOP; } });
  /* bâtiments posés sur la grille (collision de la grille, murs, planchers et toits construits) */
  const BUILD = (x0, x1, z0, z1, y, lv) => fill(x0, x1, z0, z1, c => { T[c] = PAVE; H[c] = y; BLD[c] = 1; GM[c] = 6; if (lv !== undefined) LV[c] = lv; });
  BUILD(HX0, HX1, ZT, HZ1, RIV, BERM);              // usine (toit-terrasse à 8,4)
  fill(50.5, 56, 9.5, 21.5, c => { if (H[c] < TOP) { H[c] = HR[c] = TOP; T[c] = GND; GM[c] = 0; } });
  BUILD(37.5, 50.5, 9.5, 21.5, SWY, TOP);           // poste de commande (6 / 9 / 12)
  fill(29, 47, -39.5, -23.5, c => { if (T[c] !== WATER) { T[c] = PAVE; H[c] = HR[c] = SHORE; GM[c] = 7; } }); fill(-47, -30, -33.5, -18.5, c => { if (T[c] !== WATER) { T[c] = PAVE; H[c] = HR[c] = SHORE; GM[c] = 7; } });
  BUILD(32, 43, -36.5, -26.5, SHORE);               // station de pompage
  BUILD(-43, -34, -30.5, -21.5, SHORE);             // hangar à bateaux
  for (const sx of [-1, 1]) BUILD(sx < 0 ? -37.5 : 28.5, sx < 0 ? -28.5 : 37.5, .5, 9, TOP);   // maisons de garde (puits à vis)
  /* escaliers taillés ou posés entre les niveaux : leurs cellules (entièrement couvertes) quittent la grille, l'escalier porte ses collisions */
  const FL = [], PADS = [], stamp = (x0, x1, z0, z1, y) => { const a = Math.floor((x0 + S) / G + 1e-6), b = Math.ceil((x1 + S) / G - 1e-6), c = Math.floor((z0 + S) / G + 1e-6), d = Math.ceil((z1 + S) / G - 1e-6); for (let j = Math.max(0, c); j < Math.min(N, d); j++) for (let i = Math.max(0, a); i < Math.min(N, b); i++) { const q = j * N + i; if (T[q] === STRUCT || BLD[q]) continue; T[q] = STRUCT; H[q] = y; LV[q] = y; } };
  const flight = (x, z, w, dir, y0, y1, o = {}) => { const n = Math.ceil((y1 - y0) / .24 - 1e-6), run = n * .42, sg = dir[1] === '+' ? 1 : -1, ax = dir[0], a = ax === 'x' ? x : z, b = a + sg * run, lo = Math.min(a, b), hi = Math.max(a, b); FL.push({ x, z, w, dir, y0, y1, o, lo, hi, ax }); if (o.hang) return b; if (ax === 'x') stamp(lo, hi, z - w / 2, z + w / 2, y0); else stamp(x - w / 2, x + w / 2, lo, hi, y0); return b; };
  const pad = (x0, x1, z0, z1, y, o = {}) => { PADS.push({ x0, x1, z0, z1, y, o }); if (!o.hang) stamp(x0, x1, z0, z1, y); };
  /* lit -> corniche ouest (deux volées), corniche -> plateau ouest (deux volées et un palier), plateau -> crête (aux deux bouts) */
  for (const z of [30, 57]) flight(-14.5, z, 2, 'x-', RIV, LEDGE, { m: 'ar_rubble', rail: 1 });
  { const zA = 31; const zB = flight(-26, zA, 2, 'z-', LEDGE, BERM, { m: 'ar_plaster', rail: 1 }); pad(-27, -25, zB - 1.5, zB, BERM); const zC = flight(-26, zB - 1.5, 2, 'z-', BERM, TOP, { m: 'ar_plaster', rail: 1 }); pad(-27, -25, 11, zC, TOP); fill(-30, -27, 11, zA, c => { if (H[c] < TOP && T[c] !== STRUCT) { H[c] = HR[c] = Math.max(H[c], TOP); T[c] = ROCK; } }); }
  flight(-38, 10.5, 2, 'z+', TOP, RIDGE, { m: 'ar_rubble' }); flight(-38, 61.5, 2, 'z-', TOP, RIDGE, { m: 'ar_rubble' });
  /* lit -> terrasse est (deux volées), terrasse -> plateau est, plateau -> butte (volée suspendue) */
  for (const z of [29, 60]) flight(15, z, 2.5, 'x+', RIV, SWY, { m: 'ar_plaster', rail: -1 });
  flight(49, 31, 2.5, 'x+', SWY, TOP, { m: 'ar_plaster', rail: 1 });
  flight(55, 44, 2, 'x-', TOP, RIDGE, { m: 'ar_plaster', rail: 1, hang: 1 }); pad(46.5, 49.5, 43, 45, RIDGE);
  flight(47, -25, 2, 'x+', SHORE, TOP, { m: 'ar_rubble', rail: -1 }); flight(-47, -21, 2, 'x-', SHORE, TOP, { m: 'ar_rubble', rail: 1 });
  /* toit de l'usine -> couronnement : volée de fer et palier au-dessus de la risberme */
  flight(4.2, 10.2, 1.5, 'z-', BERM, TOP, { m: 'ar_plaster', rail: -1, hang: 1 }); pad(3.45, 4.95, ZC - .02, 10.2 - 16 * .42, TOP, { hang: 1, rails: 1 });   /* [stairs2] le palier (et ses garde-corps) s'arrête où finit la volée dessinée (16 marches, f.y1 + .012) : le garde-corps est passait 42 cm sur la dernière marche */
  yield;

  /* plateaux : bosses herbeuses douces (0,25 à 0,75 m), loin des apparitions, des pistes, des camps et des rebords ; cellules ROCK marquées GRS (herbe, sans strates) */
  const GRS = new Uint8Array(NN), MND = [];
  { const AV = [[-49, 15, 6], [-49, 24, 6], [-56, 48, 5], [-50, -14.5, 6], [-46, -12, 4], [-52, 36, 9], [-50, 6, 5], [52, -16, 6], [57, 46, 5], [60, 35, 5], [60, -30, 5], [50, -9, 5], [51, 2, 5], [-45, -16.6, 2], [-46.4, 19, 3], [-52.6, 21, 2], [-53, 10.6, 2], [-58.6, 44.6, 2], [57.6, 33.2, 2], [47.6, -20, 2], [61.6, -27, 2], [-52, 12.3, 2], [-46.3, 26.8, 2], [58, -12.5, 2]],
      SPW = [[-62, -8], [-62, 2], [-58, 12], [-64, 22], [-55, -2], [-56, 30], [-61, 40], [-66, 8], [62, -8], [62, 2], [58, 12], [64, 22], [55, -2], [56, 30], [61, 40], [66, 8]];
    for (let gz = -63; gz <= 63; gz += 9) for (const gx of [-64, -55, -46, 46, 55, 64]) { const x = gx + (noise2(gx * .21 + 1, gz * .21) - .5) * 6, z = gz + (noise2(gz * .19 + 3, gx * .19) - .5) * 6, r = 3 + 2.4 * noise2(x * .3, z * .3), pk = .45 + .3 * noise2(x * .5 + 1, z * .5);
      if (noise2(x * .11 + 4, z * .11) < .36 || AV.some(q => Math.hypot(q[0] - x, q[1] - z) < q[2] + r) || SPW.some(q => Math.hypot(q[0] - x, q[1] - z) < r + 4)) continue;
      let ok = true; for (let a = -r - 1; a <= r + 1 && ok; a += .5) for (let b = -r - 1; b <= r + 1; b += .5) { const c = at(x + a, z + b); if (T[c] !== GND || H[c] !== TOP || GM[c] === 7 || BLD[c]) { ok = false; break; } } if (!ok) continue;
      MND.push([x, z, r, pk]); }
    const v0 = (x, z) => { let v = 0; for (const [mx, mz, r, pk] of MND) { const q = Math.hypot(x - mx, (z - mz) * 1.12) / r; if (q < 1) v = Math.max(v, pk * (.5 + .5 * Math.cos(Math.PI * q))); } return v; };
    const L = []; for (const [mx, mz, r] of MND) fill(mx - r - .5, mx + r + .5, mz - r - .5, mz + r + .5, (c, i, j) => { if (T[c] !== GND || H[c] !== TOP) return; const v = v0(X(i), X(j)); if (v < .03) return; L.push(c, v); });
    for (let q = 0; q < L.length; q += 2) { const c = L[q]; T[c] = ROCK; GRS[c] = 1; ISO[c] = 0; HR[c] = TOP + L[q + 1]; }
    for (let q = 0; q < L.length; q += 2) { const c = L[q], i = c % N, j = (c - i) / N; const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const e = (j + b) * N + i + a; return !GRS[e]; }); H[c] = rim ? TOP : TOP + Math.floor(L[q + 1] * 4) / 4; }
    C_MB = v0; }
  /* fente entre la fin du barrage et la culée est (x 22 à 23,5, z 3 à 11) : comblée de roche au niveau du rebord voisin (4 m), plus de recoin */
  fill(XR, XR + 1.6, ZBO, ZT, (c) => { if (T[c] === STRUCT || T[c] === EDGE || H[c] > .05) return; H[c] = HR[c] = 4; T[c] = ROCK; ISO[c] = 0; });
  /* ---------- 3. lumière cuite ---------- */
  const TOPS = new Float32Array(NN); for (let c = 0; c < NN; c++) TOPS[c] = T[c] === STRUCT ? Math.max(H[c], LV[c]) + .6 : BLD[c] ? Math.max(H[c], LV[c]) + 3.2 : H[c];
  const SN = 72, SKY = new Float32Array(SN * SN), DIR = []; for (let a = 0; a < 8; a++) DIR.push([Math.cos(a / 8 * TAU), Math.sin(a / 8 * TAU)]);
  for (let j = 0; j < SN; j++) { if (j && !(j % 18)) yield; for (let i = 0; i < SN; i++) { const cx = -S + (i + .5) * 2, cz = -S + (j + .5) * 2; let lo = 1e9; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const q = at(cx + a * .7, cz + b * .7); if (TOPS[q] < lo) lo = TOPS[q]; } let occ = 0; for (const [dx, dz] of DIR) { let m = 0; for (const r of [1.6, 3, 5, 8, 12, 18]) { const q = at(cx + dx * r, cz + dz * r), e = (TOPS[q] - lo - 1.2) / r; if (e > m) m = e; } occ += Math.min(1, Math.atan(m) / 1.25); } SKY[j * SN + i] = 1 - occ / 8; } }
  const ROOMS = [], LAMPS = [];       // volumes intérieurs [x0,x1,y0,y1,z0,z1,ambiance], lampes [x,y,z,force,froide]
  const RG = new Map(), LG = new Map(), rkey = (i, j) => i * 1000 + j;
  const index = () => { RG.clear(); LG.clear(); ROOMS.forEach((r, n) => { for (let i = Math.floor(r[0] / 8); i <= Math.floor(r[1] / 8); i++) for (let j = Math.floor(r[4] / 8); j <= Math.floor(r[5] / 8); j++) { const q = rkey(i, j); if (!RG.has(q)) RG.set(q, []); RG.get(q).push(n); } }); LAMPS.forEach((l, n) => { for (let i = Math.floor((l[0] - 12) / 8); i <= Math.floor((l[0] + 12) / 8); i++) for (let j = Math.floor((l[2] - 12) / 8); j <= Math.floor((l[2] + 12) / 8); j++) { const q = rkey(i, j); if (!LG.has(q)) LG.set(q, []); LG.get(q).push(n); } }); };
  const roomAt = (x, y, z) => { const l = RG.get(rkey(Math.floor(x / 8), Math.floor(z / 8))); if (l) for (const n of l) { const r = ROOMS[n]; if (x > r[0] - .06 && x < r[1] + .06 && y > r[2] - .06 && y < r[3] + .06 && z > r[4] - .06 && z < r[5] + .06) return r; } return null; };
  const bake = (x, y, z, ny, o) => {
    const rm = roomAt(x, y, z);
    if (rm) { const amb = rm[6] ?? .3; let r = amb, g = amb * 1.02, b = amb * 1.06; const l2 = LG.get(rkey(Math.floor(x / 8), Math.floor(z / 8))); if (l2) for (const n of l2) { const l = LAMPS[n], dx = x - l[0], dz = z - l[2], dy = y - l[1], q = dx * dx + dz * dz + dy * dy * 1.3; if (q > 144) continue; const f = l[3] * 3.2 / (1 + q * .22) * (1 - q / 144); if (l[4]) { r += f * .84; g += f * .92; b += f; } else { r += f * 1.1; g += f * .8; b += f * .48; } } const m = ny < -.5 ? .8 : ny > .5 ? 1.05 : 1, fl = y - rm[2] < .3 ? .78 + (y - rm[2]) * .7 : 1; o[0] = Math.min(1.5, r * m * fl); o[1] = Math.min(1.35, g * m * fl); o[2] = Math.min(1.25, b * m * fl); return; }
    const si = clamp(Math.floor((x + S) / 2), 0, SN - 1), sj = clamp(Math.floor((z + S) / 2), 0, SN - 1), sk = SKY[sj * SN + si], c = at(x, z), fl = Math.min(H[c], y), up = clamp((y - fl) / 5, 0, 1); let v = (.5 + .52 * sk) + (1 - sk) * .3 * up; if (y - fl < .55 && y >= fl - .02) v *= .8 + .2 * clamp((y - fl) / .55, 0, 1); if (ny < -.5) v *= .62;
    const deep = clamp((7 - y) / 10, 0, .3); o[0] = v * (.98 - deep * .25); o[1] = v * (1 - deep * .1); o[2] = v * (1.03 + deep * .1);
  };
  const A = new Arch(k, bake); A.merge = new Set(['ar_dark', 'ar_cloth', 'lampA', 'ar_leaf', 'ar_needle']);
  /* [fin] emprises des volées : la règle de pente (solides `slope`, STEP_T 0,5 m) ne s'applique pas à la terre qui borde un escalier, à 0,75 m près.
     Le corps accroupi qui longe une volée montait sur la pente voisine puis retombait (camJump du marcheur 12,5 -> 25,9 au Barrage). */
  const STR = []; { const st0 = A.stairs; A.stairs = function (x, z, w, dir, y0, y1, o = {}) { const run = Math.max(1, Math.ceil((y1 - y0) / (o.rise ?? .24) - 1e-6)) * (o.tread ?? .42), sg = dir[1] === '+' ? 1 : -1, a = dir[0] === 'x' ? x : z, b = a + sg * run, lo = Math.min(a, b), hi = Math.max(a, b); STR.push(dir[0] === 'x' ? [lo, hi, z - w / 2, z + w / 2] : [x - w / 2, x + w / 2, lo, hi]); return st0.call(this, x, z, w, dir, y0, y1, o); }; }
  const UNDER = (x, z, top) => top <= 3.3 && z > ZU - .5 && z < ZT && Math.abs(x) < FGX + .5 && !(x > HX0 && x < HX1 && z > 2) && !(x > SX0 && x < SX1 && z > -2);
  A.under = UNDER;
  /* les salles doivent exister avant la cuisson des pièces : on les déclare ici, avant tout rendu */
  declareRooms(ROOMS, LAMPS); index();
  yield;

  /* ---------- 4. collisions du terrain (trous des galeries soustraits) ---------- */
  { const done = new Uint8Array(NN), surf = c => ((T[c] === ROCK && !GRS[c]) || T[c] === EDGE || T[c] === PAVE ? 'concrete' : 'sand');
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = j * N + i; if (done[c] || H[c] <= 0 || T[c] === STRUCT) continue; const h = H[c], t = T[c] === EDGE ? ROCK : T[c], sf = surf(c), same = (a, b) => a < N && b < N && !done[b * N + a] && H[b * N + a] === h && T[b * N + a] !== STRUCT && (T[b * N + a] === EDGE ? ROCK : T[b * N + a]) === t && surf(b * N + a) === sf; let w = 1; while (same(i + w, j)) w++; let d = 1; g2: while (j + d < N) { for (let q = 0; q < w; q++) if (!same(i + q, j + d)) break g2; d++; } for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) done[(j + b) * N + i + a] = 1;
      for (const b of minus([-S + i * G, -S + (i + w) * G, 0, h, -S + j * G, -S + (j + d) * G], HOLES)) { if (b[1] - b[0] < .005 || b[3] - b[2] < .005 || b[5] - b[4] < .005) continue; const s = k.col(b[0], b[1], b[2], b[3], b[4], b[5], sf); s.mm = t === ROCK && !GRS[c] ? 1 : 0; s.occ = 1; s.terrain = 1; if (t === GND || t === PAVE || (t === ROCK && sf === 'sand')) s.slope = 1; }       /* [objc] slope: grass, earth, paving and grassed rock climb up to 0,5 m per cell (engine-grid STEP_T); rock faces and the perimeter cliffs keep 0,32 */ } }
  yield;

  /* ---------- 5. contours lissés : les coins de la grille le long des parois naturelles glissent vers une courbe douce ---------- */
  const NC = N + 1, OX = new Float32Array(NC * NC), OZ = new Float32Array(NC * NC), nat = c => (T[c] === GND || T[c] === ROCK || T[c] === WATER) && !BLD[c] && !ISO[c];
  { const deg = new Uint8Array(NC * NC), nb = new Int32Array(NC * NC * 2).fill(-1), link = (p, q) => { for (const [a, b] of [[p, q], [q, p]]) { if (deg[a] < 2) nb[a * 2 + deg[a]] = b; deg[a]++; } };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = j * N + i; if (!nat(c)) continue; if (i + 1 < N) { const e = c + 1; if (nat(e) && Math.abs(H[c] - H[e]) > .3 && (T[c] !== GND || T[e] !== GND)) link(j * NC + i + 1, (j + 1) * NC + i + 1); } if (j + 1 < N) { const e = c + N; if (nat(e) && Math.abs(H[c] - H[e]) > .3 && (T[c] !== GND || T[e] !== GND)) link((j + 1) * NC + i, (j + 1) * NC + i + 1); } }
    const px = new Float32Array(NC * NC), pz = new Float32Array(NC * NC); for (let it = 0; it < 4; it++) { for (let v = 0; v < NC * NC; v++) { if (deg[v] !== 2) continue; const a = nb[v * 2], b = nb[v * 2 + 1], ax = (a % NC) * G + OX[a], az = Math.floor(a / NC) * G + OZ[a], bx = (b % NC) * G + OX[b], bz = Math.floor(b / NC) * G + OZ[b], vx = (v % NC) * G + OX[v], vz = Math.floor(v / NC) * G + OZ[v]; px[v] = OX[v] + .5 * ((ax + bx) / 2 - vx); pz[v] = OZ[v] + .5 * ((az + bz) / 2 - vz); } for (let v = 0; v < NC * NC; v++) if (deg[v] === 2) { const l = Math.hypot(px[v], pz[v]); OX[v] = l > .19 ? px[v] * .19 / l : px[v]; OZ[v] = l > .19 ? pz[v] * .19 / l : pz[v]; } } }
  /* [fin] mailles toujours convexes : un coin déplacé de 19 cm pouvait passer la diagonale de sa maille ; la nappe de roche (découpe a-c d'A.surface)
     montrait alors un triangle à l'envers, le ciel au travers (rochers troués rc8-75, rc8-87). Les coins d'une maille trop pincée reviennent vers la grille. Aucun tirage. */
  { const cv = (i, j) => { let p = null, c = null, n = null; const V = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([I, J]) => [I * G + OX[J * NC + I], J * G + OZ[J * NC + I]]); for (let q = 0; q < 4; q++) { p = V[(q + 3) % 4]; c = V[q]; n = V[(q + 1) % 4]; if ((c[0] - p[0]) * (n[1] - c[1]) - (c[1] - p[1]) * (n[0] - c[0]) < .08 * G * G) return false; } return true; };
    for (let it = 0; it < 8; it++) { let bad = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { if (cv(i, j)) continue; bad++; for (const [I, J] of [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]) { OX[J * NC + I] *= .6; OZ[J * NC + I] *= .6; } } if (!bad) break; } }
  yield;
  const CX = (I, J) => -S + I * G + OX[J * NC + I], CZ = (I, J) => -S + J * G + OZ[J * NC + I];
  /* hauteur de la roche aux coins : moyenne des cellules rocheuses, calée sur le rebord des sols plus hauts ; bruit hors des pieds et des rebords */
  const HV = new Float32Array(NC * NC);
  const LIT = new Float32Array(NC * NC).fill(1), KNC = new Uint8Array(NC * NC);
  for (let J = 0; J < NC; J++) { if (J && !(J % 72)) yield; for (let I = 0; I < NC; I++) { let s = 0, n = 0, hi = -1, anyW = false, mn = 1e9, mx = -1e9; let ng = 0, kno = 0, nk = 0; for (const [a, b] of [[I - 1, J - 1], [I, J - 1], [I - 1, J], [I, J]]) { if (a < 0 || b < 0 || a >= N || b >= N) continue; const c = b * N + a; if ((T[c] === ROCK || T[c] === EDGE) && !ISO[c]) { const h = H[c]; s = Math.max(s, h); n = 1; if (!GRS[c]) ng++; if (KNO[c]) { kno = 1; nk++; } if (h < mn) mn = h; if (h > mx) mx = h; } else { anyW = true; const h = T[c] === STRUCT ? -1 : H[c]; if (h > hi) hi = h; } }
    const x = -S + I * G, z = -S + J * G; if (kno) KNC[J * NC + I] = 1; if (!n) { HV[J * NC + I] = hi; continue; } if (!ng) { HV[J * NC + I] = anyW ? Math.max(hi, TOP) : Math.max(s, TOP + C_MB(x, z)); continue; } let v = s / n; if (hi > v) v = hi;
    else if (!anyW && kno) v += sn(x, z, .45, .22, 1.7) + sn(x, z, 1.3, .1, 4.4);
    else if (anyW && kno && ng === nk && hi <= SWY + .05) v = hi;
    else if (!anyW) { const st = clamp((mx - mn - .5) / 1.2, 0, 1), ph = noise2(x * .05, z * .05) * 1.7, q = (v + ph) / 1.7, fr = q - Math.floor(q), sm = fr < .62 ? fr * .3 : .186 + (fr - .62) * 2.14, ter = (Math.floor(q) + sm) * 1.7 - ph; v = v * (1 - .55 * st) + ter * .55 * st + (sn(x, z, .45, .3, 1.7) + sn(x, z, 1.3, .12, 4.4)) * (.3 + .7 * st); LIT[J * NC + I] = st > .2 ? (fr < .62 ? 1.16 : .86) : 1; }
    HV[J * NC + I] = v; } }
  yield;

  /* herbe des plateaux : plaques vertes et sèches à grande échelle */
  const GRASS = (x, z) => { const t = .86 + .16 * noise2(x * .26 + 9, z * .26), d = clamp((noise2(x * .03 + 11, z * .03) - .56) * 2.4, 0, 1) * .8, g = clamp((noise2(x * .09 + 5, z * .09 - 2) - .5) * 3, 0, 1) * (1 - d); return [t * (.52 + .2 * d - .07 * g), t * (.63 + .05 * d + .04 * g), t * (.37 + .1 * d - .05 * g)]; };   /* herbe verte dominante, plaques sèches plus rares */
  /* ---------- 6. sols ---------- */
  const FMAT = ['ar_gravel', 'ar_gravel', 'ar_gravel', 'ar_gravel', 'ar_gravel', 'ar_gravel', 'ar_plaster', 'ar_gravel', 'ar_gravel', 'ar_gravel'], FT = [[.6, .66, .44], [.74, .72, .62], [.72, .72, .7], [.9, .86, .78], [.6, .6, .56], [.58, .64, .44], [.62, .62, .6], [.66, .6, .5], [.56, .58, .56], [1, .96, .88]];
  { const TL = 16, bins = new Map(); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = j * N + i; if ((T[c] !== GND && T[c] !== PAVE && T[c] !== WATER) || BLD[c]) continue; const key = GM[c] + '|' + H[c] + '|' + Math.floor(i * G / TL) + '|' + Math.floor(j * G / TL); if (!bins.has(key)) bins.set(key, { gm: GM[c], h: H[c], cells: [] }); bins.get(key).cells.push(i, j); }
    const dirty = (i, j) => OX[j * NC + i] || OZ[j * NC + i] || OX[j * NC + i + 1] || OZ[j * NC + i + 1] || OX[(j + 1) * NC + i] || OZ[(j + 1) * NC + i] || OX[(j + 1) * NC + i + 1] || OZ[(j + 1) * NC + i + 1];
    let nB = 0; for (const b of bins.values()) { if (!(++nB & 7)) yield; const m = FMAT[b.gm], tn = FT[b.gm]; A.begin(m); const y = b.h === 0 ? .014 : b.h, own = new Set(); for (let q = 0; q < b.cells.length; q += 2) own.add(b.cells[q + 1] * N + b.cells[q]);
      for (let q = 0; q < b.cells.length; q += 2) { const i = b.cells[q], j = b.cells[q + 1]; if (!own.has(j * N + i)) continue; const t = (.86 + .16 * noise2(i * .13, j * .13)) * (b.gm === 3 ? .93 + .1 * noise2(i * .4 + 3, j * .4) : 1); if (b.gm === 0) { const gc = GRASS(-S + i * G, -S + j * G); A.tint(gc[0], gc[1], gc[2]); } else A.tint(t * tn[0], t * tn[1], t * tn[2]);
        if (dirty(i, j)) { own.delete(j * N + i); A.quad(CX(i, j + 1), y, CZ(i, j + 1), CX(i + 1, j + 1), y, CZ(i + 1, j + 1), CX(i + 1, j), y, CZ(i + 1, j), CX(i, j), y, CZ(i, j)); continue; }
        /* rectangle propre jusqu'à 4 m : aucun coin déplacé dedans */
        const ok = (a, c) => own.has(c * N + a) && !dirty(a, c); let w = 1; while (w < 8 && ok(i + w, j)) w++; let d = 1; g3: while (d < 8) { for (let a = 0; a < w; a++) if (!ok(i + a, j + d)) break g3; d++; } for (let c = 0; c < d; c++) for (let a = 0; a < w; a++) own.delete((j + c) * N + i + a);
        const x0 = -S + i * G, x1 = x0 + w * G, z0 = -S + j * G, z1 = z0 + d * G; A.quad(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0); }
      A.end(); } }
  yield;

  /* ---------- 7. roche : nappe lisse sur les cellules rocheuses, par tuiles de 16 m ; teinte en strates ---------- */
  const SP = [[1.14, 1.1, 1.04], [.82, .82, .84], [1.04, .98, .9], [.7, .71, .74], [.96, .94, .9], [1.2, 1.16, 1.1], [.78, .75, .72]];
  const rockSoft = (x, y, z) => { const n = noise2(x * .07, z * .07), band = Math.floor((y + 2.2 * noise2(x * .03 + 5, z * .03)) / .9), sc = SP[Math.floor(noise2(band * 1.37 + .5, 3.3) * 6.999)], v = 1.1 * (.62 + .22 * n); return [v * (.7 + .3 * sc[0]), v * (.7 + .3 * sc[1]) * .97, v * (.7 + .3 * sc[2]) * .95]; };
  const rockCol = (x, y, z) => { const n = noise2(x * .11, z * .11), cr = noise2(x * .5 + 9, z * .5), band = Math.floor((y + 2.2 * noise2(x * .03 + 5, z * .03)) / .9), sc = SP[Math.floor(noise2(band * 1.37 + .5, 3.3) * 6.999)], strk = .86 + .22 * noise2((x + z) * .9, y * .12), v = 1.3 * (.62 + .24 * n) * (cr < .3 ? .78 : 1) * strk, moss = clamp(Math.max((1.6 - y) / 1.4, 1 - Math.abs(y - WAT - .3) / .9), 0, 1) * (.35 + .65 * noise2(x * .3 + 4, z * .3)); const r = v * sc[0] * 1.03, g = v * sc[1] * .98, b = v * sc[2] * .9; return [r * (1 - .45 * moss), g * (1 - .18 * moss), b * (1 - .5 * moss)]; };
  /* [fin] nappes : chaque triangle tourné vers w (le haut pour une nappe en hauteur). A.surface (map-arch.js) choisit le sens d'une maille d'après la normale
     lissée d'un seul coin et ne vérifie pas le 2e triangle : sur les parois raides (butte, bosses) un triangle partait à l'envers et laissait voir le ciel
     (rochers troués rc8-75, rc8-87). Correction sur ce que la nappe vient de pousser, sans toucher au bâtisseur ni aux tirages. */
  const orient = (n0, w) => { for (let q = n0; q < k.ops.length; q++) { const op = k.ops[q]; if (op.t !== 'g' || !op.g || !op.g.index || !op.g.index.a) continue; const p = op.g.attributes.position.a, ix = op.g.index.a;
    for (let t = 0; t + 2 < ix.length; t += 3) { const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3, ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2], W = w((p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3);
      if ((uy * vz - uz * vy) * W[0] + (uz * vx - ux * vz) * W[1] + (ux * vy - uy * vx) * W[2] < -1e-9) { const sw = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = sw; } } } }, UP = () => [0, 1, 0];
  { const TS = 32; for (let tj = 0; tj < N; tj += TS) for (let ti = 0; ti < N; ti += TS) { let any = false; for (let j = tj; j < Math.min(N, tj + TS) && !any; j++) for (let i = ti; i < Math.min(N, ti + TS); i++) if (T[j * N + i] === ROCK) { any = true; break; } if (!any) continue;
      const rows = []; for (let J = tj; J <= Math.min(N, tj + TS); J++) { const row = []; for (let I = ti; I <= Math.min(N, ti + TS); I++) { const x = CX(I, J), z = CZ(I, J), y = HV[J * NC + I]; const cc = rockCol(x, y, z), lt = LIT[J * NC + I] * (KNC[J * NC + I] ? 1.2 : 1); row.push([x, y, z, cc[0] * lt, cc[1] * lt, cc[2] * lt]); } rows.push(row); }
      const n0 = k.ops.length; A.surface('ar_rock', rows, () => [0, 1, 0], { keep: (r, q) => T[(tj + r) * N + ti + q] === ROCK && !ISO[(tj + r) * N + ti + q] && !GRS[(tj + r) * N + ti + q] }); orient(n0, UP); yield; } }
  /* bosses herbeuses : nappe lisse, même herbe que les sols du plateau */
  { const TS = 32; for (let tj = 0; tj < N; tj += TS) for (let ti = 0; ti < N; ti += TS) { let any = false; for (let j = tj; j < Math.min(N, tj + TS) && !any; j++) for (let i = ti; i < Math.min(N, ti + TS); i++) if (GRS[j * N + i]) { any = true; break; } if (!any) continue;
      const rows = []; for (let J = tj; J <= Math.min(N, tj + TS); J++) { const row = []; for (let I = ti; I <= Math.min(N, ti + TS); I++) { const x = CX(I, J), z = CZ(I, J), gc = GRASS(x, z); row.push([x, HV[J * NC + I], z, gc[0], gc[1], gc[2]]); } rows.push(row); }
      const n0 = k.ops.length; A.surface('ar_gravel', rows, () => [0, 1, 0], { keep: (r, q) => GRS[(tj + r) * N + ti + q] === 1 }); orient(n0, UP); } }

  /* ---------- 8. parois entre deux cellules dont les surfaces diffèrent (pieds de falaise, rebords, rives, socles) ---------- */
  { const surfAt = (c, I, J) => (T[c] === ROCK || T[c] === EDGE ? HV[J * NC + I] : H[c]), TL = 16, bins = new Map();
    const add = (c1, c2, I0, J0, I1, J1) => { const e1 = T[c1] === EDGE, e2 = T[c2] === EDGE; if (e1 || e2 || ISO[c1] || ISO[c2]) return; if (T[c1] === ROCK && T[c2] === ROCK) return;
      let a0, a1, b0, b1, m = 'ar_rock';
      const s1 = T[c1] === STRUCT || BLD[c1], s2 = T[c2] === STRUCT || BLD[c2]; if (s1 && s2) return;
      if (s1 || s2) { const sc = s1 ? c1 : c2, gc = s1 ? c2 : c1, lv = BLD[sc] ? H[sc] : LV[sc]; const g0 = surfAt(gc, I0, J0), g1 = surfAt(gc, I1, J1);
        if (BLD[sc] && g0 < lv - .02 && g1 < lv - .02) { m = 'ar_stonewall'; a0 = a1 = lv; b0 = g0; b1 = g1; }       // socle d'un bâtiment au-dessus du terrain
        else if (!BLD[sc] && lv >= 0 && (g0 > lv + .02 || g1 > lv + .02)) { let lo = lv; const mx = -S + (I0 + I1) / 2 * G, mz = -S + (J0 + J1) / 2 * G; for (const hb of HOLES) if (mx > hb[0] - .01 && mx < hb[1] + .01 && mz > hb[4] - .01 && mz < hb[5] + .01 && hb[2] <= lv + .05) lo = Math.max(lo, hb[3]); a0 = a1 = lo; b0 = Math.max(lo, g0); b1 = Math.max(lo, g1); }   // roche au-dessus d'un ouvrage
        else return; if (s2) { const t0 = a0, t1 = a1; a0 = b0; a1 = b1; b0 = t0; b1 = t1; } }
      else { a0 = surfAt(c1, I0, J0); a1 = surfAt(c1, I1, J1); b0 = surfAt(c2, I0, J0); b1 = surfAt(c2, I1, J1); if (T[c1] === PAVE || T[c2] === PAVE) m = 'ar_stonewall'; }
      if (Math.abs(a0 - b0) < .02 && Math.abs(a1 - b1) < .02) return;
      const lowA = a0 + a1 < b0 + b1, key = m + '|' + Math.floor(I0 * G / TL) + '|' + Math.floor(J0 * G / TL); if (!bins.has(key)) bins.set(key, { m, q: [] }); bins.get(key).q.push(I0, J0, I1, J1, Math.min(a0, b0), Math.max(a0, b0), Math.min(a1, b1), Math.max(a1, b1), lowA ? 1 : 0, I0 === I1 ? 1 : 0); };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = j * N + i; if (i + 1 < N) add(c, c + 1, i + 1, j, i + 1, j + 1); if (j + 1 < N) add(c, c + N, i, j + 1, i + 1, j + 1); }
    let nB = 0; for (const b of bins.values()) { if (!(++nB & 7)) yield; A.begin(b.m); const L = b.q; for (let q = 0; q < L.length; q += 10) { const I0 = L[q], J0 = L[q + 1], I1 = L[q + 2], J1 = L[q + 3], lo0 = L[q + 4], hi0 = L[q + 5], lo1 = L[q + 6], hi1 = L[q + 7], lowFirst = L[q + 8], vert = L[q + 9], x0 = CX(I0, J0), z0 = CZ(I0, J0), x1 = CX(I1, J1), z1 = CZ(I1, J1);
        /* normale : vers la cellule basse. Arête verticale (I0 = I1) : c1 à l'ouest (-x) ; horizontale : c1 au nord (-z). */
        const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1; let nx = vert ? -dz / l : dz / l, nz = vert ? dx / l : -dx / l; if (vert) { if (nx > 0 === !!lowFirst) { nx = -nx; nz = -nz; } } else { if (nz > 0 === !!lowFirst) { nx = -nx; nz = -nz; } }
        const rk = b.m === 'ar_rock', nr = Math.max(1, Math.ceil(Math.max(hi0 - lo0, hi1 - lo1) / 1.1));
        for (let r = 0; r < nr; r++) { const t0 = r / nr, t1 = (r + 1) / nr, ya = lo0 + (hi0 - lo0) * t0, yb = lo0 + (hi0 - lo0) * t1, yc = lo1 + (hi1 - lo1) * t1, yd = lo1 + (hi1 - lo1) * t0, jit = () => 0, oa = jit(x0, z0, ya, t0), ob = jit(x0, z0, yb, t1), oc = jit(x1, z1, yc, t1), od = jit(x1, z1, yd, t0);
          if (rk) { const c0 = rockSoft((x0 + x1) / 2, (ya + yb + yc + yd) / 4, (z0 + z1) / 2); A.tint(c0[0], c0[1], c0[2]); } else A.tint(.88 + .1 * noise2(x0, ya));
          const P0 = [x0 + nx * oa, ya, z0 + nz * oa], P1 = [x0 + nx * ob, yb, z0 + nz * ob], P2 = [x1 + nx * oc, yc, z1 + nz * oc], P3 = [x1 + nx * od, yd, z1 + nz * od];
          /* sens direct vu depuis la cellule basse : normale de (P0,P1,P2) = (P1-P0)x(P2-P0) doit suivre (nx,nz) */
          const ux = P1[0] - P0[0], uy = P1[1] - P0[1], uz = P1[2] - P0[2], wx = P2[0] - P0[0], wy = P2[1] - P0[1], wz = P2[2] - P0[2], cx = uy * wz - uz * wy, cz = ux * wy - uy * wx; if (cx * nx + cz * nz >= 0) A.quad(...P0, ...P1, ...P2, ...P3); else A.quad(...P0, ...P3, ...P2, ...P1); } }
      A.end(); } }
  yield;

  /* ---------- 8b. falaises du périmètre : un maillage continu le long du rectangle arrondi ---------- */
  const PER = []; { const ax = RX - RC, az = RZ - RC, add = (x, z, nx, nz) => PER.push([x, z, nx, nz]);
    for (let x = -ax; x < ax - .01; x += 1) add(x, -RZ, 0, -1); for (let q = 0; q < 6; q++) { const a = -Math.PI / 2 + q / 6 * Math.PI / 2; add(ax + Math.cos(a) * RC, -az + Math.sin(a) * RC, Math.cos(a), Math.sin(a)); }
    for (let z = -az; z < az - .01; z += 1) add(RX, z, 1, 0); for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI / 2; add(ax + Math.cos(a) * RC, az + Math.sin(a) * RC, Math.cos(a), Math.sin(a)); }
    for (let x = ax; x > -ax + .01; x -= 1) add(x, RZ, 0, 1); for (let q = 0; q < 6; q++) { const a = Math.PI / 2 + q / 6 * Math.PI / 2; add(-ax + Math.cos(a) * RC, az + Math.sin(a) * RC, Math.cos(a), Math.sin(a)); }
    for (let z = az; z > -az + .01; z -= 1) add(-RX, z, -1, 0); for (let q = 0; q < 6; q++) { const a = Math.PI + q / 6 * Math.PI / 2; add(-ax + Math.cos(a) * RC, -az + Math.sin(a) * RC, Math.cos(a), Math.sin(a)); }
    const loop = PER.concat([PER[0]]), TT = [-.5, .15, .32, .55, .85, 1.2, 1.65, 2.2, 2.9, 3.8, 4.9, 6.3, 8.2, 11, 15, 20, 26];
    const rows = loop.map(([bx, bz, nx, nz]) => { let pT = -1; return TT.map((t, ti) => { if (ti < 2) { pT = t; /* pied de falaise 0,5 m dans la carte et 0,3 m sous le sol : plus de fente au bord (MAP QA) */const x = bx + nx * t, z = bz + nz * t, y = prof2(x, z, inH(x, z)) - (ti ? 0 : .3); return [x, y, z, ...rockCol(x, y, z)]; } const jit = (noise2(bx * .3 + t, bz * .3) - .5) * 1.2, y0 = prof2(bx + nx * t, bz + nz * t, inH(bx + nx * t, bz + nz * t)), off = (noise2(bx * .35 + y0 * .2, bz * .35 - y0 * .3) - .5) * 1.6 * Math.min(1, (t - .15) / .6), tt = Math.max(.2, t + jit + off, pT + .12), x = bx + nx * tt, z = bz + nz * tt, fl = inH(x, z); let y = prof2(x, z, fl);
      const ph = noise2(bx * .05, bz * .05) * 1.7, q = (y - fl + ph) / 1.7, fr = q - Math.floor(q), sm = fr < .62 ? fr * .3 : .186 + (fr - .62) * 2.14, ter = (Math.floor(q) + sm) * 1.7 - ph + fl; y = y * .45 + ter * .55 + (noise2(x * .45, z * .45) - .5) * .6 + (noise2(x * 1.3, z * 1.3) - .5) * .25; pT = tt; const cc = rockCol(x, y, z), lit = fr < .62 ? 1.18 : .84; return [x, y, z, cc[0] * lit, cc[1] * lit, cc[2] * lit]; }); });
    const inward = (x, y, z) => { const qx = Math.abs(x) - (RX - RC), qz = Math.abs(z) - (RZ - RC); let dx, dz; if (qx > 0 && qz > 0) { dx = -Math.sign(x) * qx; dz = -Math.sign(z) * qz; } else if (qx > qz) { dx = -Math.sign(x); dz = 0; } else { dx = 0; dz = -Math.sign(z); } const l = Math.hypot(dx, dz) || 1; return [dx / l, .5, dz / l]; };
    for (let i0 = 0; i0 < rows.length - 1; i0 += 40) { const n0 = k.ops.length; A.surface('ar_rock', rows, inward, { i0, i1: i0 + 40 }); orient(n0, inward); yield; } }

  /* ---------- 9. eau : retenue, rivière ---------- */
  A.begin('ar_water'); A.tint(.62, .72, .72); for (let x = -48; x < 48; x += 8) for (let z = -76; z < ZU - .01; z += 8) { const z1 = Math.min(ZU + .02, z + 8); A.quad(x, WAT, z1, x + 8, WAT, z1, x + 8, WAT, z, x, WAT, z); } A.end();
  { A.begin('ar_water'); A.tint(.82, .92, .9); let prev = null; for (let z = 24; z <= 72; z += 2) { const c = strC(z), w = strW(z), cur = [c - w, c + w, z]; if (prev) A.quad(cur[0], .05, cur[2], cur[1], .05, cur[2], prev[1], .05, prev[2], prev[0], .05, prev[2]); prev = cur; } A.end(); }

  const ctx = { strC, strW, KNOLL: [KX, KZ, kTop, kOut, kY], GM, FL, PADS, ISO, HR, k, A, H, T, BLD, LV, X, Ic, at, sn, fill, sol, solids, ROOMS, LAMPS, xRiv, wRiv, xRes, wRes, ISL, PER, inH, prof2, rockCol };
  yield* structures(ctx);

  /* ---------- 20. fond de décor : montagnes ---------- */
  A.hills(104, 340, 72, 9, (a, r) => { const t = (r - 104) / 236,/* anneau parti de 104 m : à 92 m il entrait dans les coins de la carte (MAP QA) */ base = (40 + 50 * Math.abs(Math.sin(a))) * Math.pow(Math.min(1, t * 2), .75) * (1 - .2 * Math.max(0, t - .6)), lobes = 1 + .3 * Math.sin(a * 5 + .7) + .2 * Math.sin(a * 11 + 2.1) + .12 * Math.sin(a * 17); return 4 + base * lobes * (.85 + .3 * noise2(Math.cos(a) * r * .02 + 3, Math.sin(a) * r * .02)) + 5 * noise2(Math.cos(a) * r * .07, Math.sin(a) * r * .07); },
    (a, r, h, o) => { const n = noise2(Math.cos(a) * r * .05 + 9, Math.sin(a) * r * .05), snow = Math.min(1, Math.max(0, (h - 70 + n * 14) / 12)), rock = Math.min(1, Math.max(0, (h - 26 + n * 8) / 26)); const gr = [.26, .31, .22], rk = [.42, .42, .43], sw = [.9, .92, .95]; for (let q = 0; q < 3; q++) o[q] = (gr[q] * (1 - rock) + rk[q] * rock) * (1 - snow) + sw[q] * snow; });

  /* ---------- 21. apparitions, objectifs, niveaux, visibilité, itinéraires ---------- */
  for (const p of [[-62, -8], [-62, 2], [-58, 12], [-64, 22], [-55, -2], [-56, 30], [-61, 40], [-66, 8]]) k.spawns.push([p[0], p[1], TOP]);
  for (const p of [[62, -8], [62, 2], [58, 12], [64, 22], [55, -2], [56, 30], [61, 40], [66, 8]]) k.spawns.push([p[0], p[1], TOP]);
  for (const p of [[2, 42, RIV], [-12, 50, RIV], [12, 62, RIV], [1.5, 16.5, RIV], [-2, 12, BERM], [-2, -3.3, TOP], [-15.8, 21, RIV], [-23, 40, LEDGE], [20.5, 30, SWY], [-12, -3.1, 0], [6, -3.3, BERM], [16, 30, RIV]]) k.spawns.push(p);
  k.levelAt = (x, z) => { if (Math.abs(x) >= S || Math.abs(z) >= S) return 0; const c = at(x, z); return LV[c] >= 0 ? LV[c] : H[c]; };
  k.objectives = { zones: [[0, -19, TOP], [1.5, 16, BERM], [1, 44, RIV]], sites: [[36.5, 28.6, SWY], [37.5, -31.5, SHORE]] };
  k.covered = ROOMS.map(r => ({ x0: r[0], x1: r[1], y0: r[2], y1: r[3], z0: r[4], z1: r[5] }));
  k.shadowProxy = true; for (const q of k.solids) { const mx = (q.x0 + q.x1) / 2, mz = (q.z0 + q.z1) / 2; if (UNDER(mx, mz, q.y1) || (q.inner && q.y1 < TOP - .5 && Math.abs(mx) < XC && mz > ZU && mz < ZBO)) q.ug = 1; }
  const OPEN = [[-5.7, 11.5, 6], [19.9, 11.5, 6], [2.5, 11, 6], [-SPX, SPZ, 4.5], [SPX, SPZ, 4.5]];
  k.openings = OPEN.map(o => [o[0], o[1], o[2] + 2]);
  k.visAt = (x, y, z) => { for (let i = 0; i < OPEN.length; i++) { const o = OPEN[i], dx = x - o[0], dz = z - o[1]; if (dx * dx + dz * dz < o[2] * o[2]) return 3; } if (y < 3.2 && z > ZU && z < ZT - 1 && Math.abs(x) < FGX + .5 && !(x > HX0 && x < HX1 && z > 5)) return 1; return 2; };
  k.lanes = [[0, -3.1, 0, 2], [-18, -3.1, 0, 2], [18, -3.1, 0, 2], [8, -3.3, BERM, 2], [20, -3.3, BERM, 2], [2.5, 17, RIV, 2], [-41.5, 30, RIDGE, 1.5], [0, 46, RIDGE, 1.5], [-23, 44, LEDGE, 1.5], [0, -19, TOP, 1.5]]; k.lanes.chance = .7;
  for (const s of k.solids) if (s.slope && STR.some(r => s.x1 > r[0] - .75 && s.x0 < r[1] + .75 && s.z1 > r[2] - .75 && s.z0 < r[3] + .75)) s.slope = 0;   /* [fin] voir STR */
  k.stats = { tris: A.tris, pieces: A.pieces };
  lastLayout = Object.assign(Object.create(Object.getPrototypeOf(k)), k, { ops: [] });
  return k;
}

/* Volumes intérieurs (lumière cuite, abri contre la météo) et lampes : déclarés avant le rendu. */
function declareRooms(R, L) {
  const room = (x0, x1, y0, y1, z0, z1, amb) => R.push([x0, x1, y0, y1, z0, z1, amb]);
  room(-FGX, FGX, 0, FGH, FGZ0, FGZ1, .24); for (let x = -30; x <= 30; x += 5.5) L.push([x, FGH - .25, (FGZ0 + FGZ1) / 2, .85, 1, FGH]);
  for (const [x0, x1, h] of [[-7, -4.4, 2.6], [18.6, 21.2, 2.6], [1.2, 3.8, 2.8]]) { room(x0, x1, 0, h, FGZ1, ZT, .26); for (let z = 1.5; z < ZT - 1; z += 4.5) L.push([(x0 + x1) / 2, h - .25, z, .8, 1, h]); }
  for (const sx of [-1, 1]) { const cx = sx * SPX; room(cx - 1.3, cx + 1.3, 0, 2.6, FGZ0, SPZ - SPR + .2, .24); room(cx - SPR - .1, cx + SPR + .1, 0, TOP + .1, SPZ - SPR - .1, SPZ + SPR + .1, .28); for (const y of [2.3, 5.2, 8, 10.8]) { const a = y > 6 ? .9 : -.9 + Math.PI; L.push([cx + Math.cos(a) * (SPR - .03), y, SPZ + Math.sin(a) * (SPR - .03), .7, 1]); }
    const a = sx > 0 ? XB : -SPX + SPR - .2, b = sx > 0 ? SPX - SPR + .2 : -XB; room(a, b, BERM, BERM + 2.4, ZB, SPZ + 1.1, .3); L.push([(a + b) / 2, BERM + 2.34, 3, .8, 1, BERM + 2.4]); }
  room(UGX0, UGX1, BERM, BERM + 2.6, UGZ0, UGZ1, .26); for (let x = -8; x <= 24; x += 5.3) L.push([x, BERM + 2.35, (UGZ0 + UGZ1) / 2, .85, 1, BERM + 2.6]);
  for (const [x0, x1] of [[-1.4, 1.4], [18.6, 21.2], [24, 26.6]]) room(x0, x1, BERM, BERM + 2.4, UGZ1, ZB, .3);
  room(HX0 + .4, HX1 - .4, 0, 7.8, ZT + .4, HZ1 - .4, .34); for (const lx of [-3, 2, 7]) for (const lz of [14.2, 19.6]) L.push([lx, 7.2, lz, 1.5, 1, 7.8]);
  for (const sx of [-1, 1]) { const x0 = sx < 0 ? -37.5 : 28.5, x1 = sx < 0 ? -28.5 : 37.5; room(x0 + .45, x1 - .45, TOP, TOP + 3.4, 1.05, 8.55, .38); L.push([(x0 + x1) / 2 + sx * 2.5, TOP + 3.1, 2.4, 1.1, 0, TOP + 3.4]); }
  room(-1.3, 1.3, TOP, TOP + 2.6, -20.5, -17.9, .4); L.push([0, TOP + 2.3, -19.2, .9, 0, TOP + 2.6]);
  const bl = (x0, x1, z0, z1, fl) => { for (let f = 0; f < fl.length - 1; f++) { room(x0 + .36, x1 - .36, fl[f], fl[f + 1] - .25, z0 + .36, z1 - .36, .36); for (let lx = x0 + 2.6; lx < x1 - 1.5; lx += 4.5) for (let lz = z0 + 2.6; lz < z1 - 1.5; lz += 4.5) L.push([lx, fl[f + 1] - .45, lz, 1.05, 0, fl[f + 1] - .25]); } };
  bl(37.5, 50.5, 9.5, 21.5, [SWY, 9, TOP, 15.2]); bl(32, 43, -36.5, -26.5, [SHORE, SHORE + 5.4]); bl(-43, -34, -30.5, -21.5, [SHORE, SHORE + 4.6]);
}

/* ====================================================================== */
/* Ouvrages : barrage, galeries, usine, maisons de garde, tour de prise d'eau, passerelle, bâtiments. */
function* structures(C) {
  const { k, A, sol, solids, LAMPS } = C;
  const ASH = [.86, .86, .84], CONC = [.74, .75, .76];
  const QD = (a, b, c, d) => A.quad(...a, ...b, ...c, ...d);

  /* ---------- 10. barrage : collisions du corps ---------- */
  const NOSP = [SX0, SX1, 0, 30, ZU - 1, ZT + 1];      // l'évacuateur a ses propres collisions
  for (let y = BERM; y < TOP - 1e-6; y += .4) solids([-XC, XC, y, Math.min(TOP, y + .4), ZU, zUp(y)], HOLES.concat([NOSP]));
  for (const sx of [-1, 1]) { solids(sx < 0 ? [-XB, -XR, 0, BERM, ZU, ZBO] : [XR, XB, 0, BERM, ZU, ZBO]); solids(sx < 0 ? [-XC, -XB, 0, BERM, ZU, -.5] : [XB, XC, 0, BERM, ZU, -.5]); }
  solids([-XR, XR, 0, 2, ZU, ZT], HOLES.concat([NOSP]));
  for (let y = 2; y < BERM - 1e-6;) { const h = y < 4 ? .2 : .4, y1 = Math.min(BERM, y + h); for (const [a, b] of [[-XR, HX0], [HX1, XR]]) solids([a, b, y, y1, ZU, zLo(y)], HOLES.concat([NOSP])); y = y1; }
  solids([HX0, HX1, 2, BERM, ZU, ZT]);
  solids([-XB, XB, BERM - .4, BERM, ZB - .01, ZBO], HOLES.concat([NOSP]));
  /* évacuateur : coursier par tranches de 42 cm (marchable), bajoyers (galerie de pied passant dessous) */
  { const x0 = SX0 + SW, x1 = SX1 - SW; for (let z = ZU; z < 18 - 1e-6; z += .42) { const z1 = Math.min(18, z + .42); solids([x0, x1, 0, spillY(z + .21), z, z1], HOLES, 'concrete', 0); }
    for (const [w0, w1] of [[SX0, SX0 + SW], [SX1 - SW, SX1]]) for (let z = -2; z < 34.6 - 1e-6; z += .5) { const z1 = Math.min(34.6, z + .5); if (z >= ZB - .01 && z1 <= ZBO + .01) { solids([w0, w1, 0, BERM, z, z1], HOLES, 'concrete', 0); continue; } const top = z < ZC ? TOP - .35 : (z < 18 ? spillY(z) : 0) + 2; solids([w0, w1, 0, top, z, z1], HOLES, 'concrete', 1); }
    /* au-dessus de la risberme, de part et d'autre du passage : la paroi monte jusqu'au couronnement */
    for (const [w0, w1] of [[SX0, SX0 + SW], [SX1 - SW, SX1]]) solids([w0, w1, spillY(-2), TOP - .35, ZU, -2], HOLES); }

  yield;
  /* ---------- 10b. rendu du barrage : béton patiné (coulures sous les barbacanes, joints de plots, pied humide), chaussée, parapets ---------- */
  const UGD = [[-1.4, 1.4], [18.6, 21.2], [24, 26.6]];   // portes de la galerie haute sur la risberme
  const ADIT = [[18.6, 21.2]];                            // débouché du rameau est dans le mur de pied
  const LB = [2]; for (let y = 2; y < BERM - .41;) { const yb = Math.min(BERM - .4, y + (y < 4 ? .25 : .5)); if (y < 2.6 - 1e-6 && yb > 2.6 + 1e-6) LB.push(2.6); LB.push(yb); y = yb; }   // bandes du parement bas
  const conc = (u, y, k = 1) => { const st = Math.max(0, noise2(u * 1.7, 3.3) - .52) * 2, wet = clamp((1.8 - y) / 1.8, 0, 1), sf = y > BERM ? clamp((TOP - .3 - y) / 2.4, 0, 1) : clamp((BERM - y) / 3, 0, 1), v = (.8 + .1 * noise2(u * .31, y * .11) + .05 * noise2(u * 2.3, y * .7)) * (1 - .4 * st * sf) * (1 - .2 * st) * (.88 + .14 * noise2(Math.floor((u + 31.5) / 9) * 1.7 + .3, 2.2)) * k; return [v * (.97 - .1 * wet), v * (.99 - .02 * wet), v * (1.01 - .12 * wet)]; };
  const JOINT = u => { const q = (u + 31.5) / 9; return Math.abs(q - Math.round(q)) * 9 < .05; };
  for (const [u0, u1] of [[-XB, SX0], [SX1, XB]]) {
    const us = []; for (let u = u0; u < u1 - .01; u += .75) us.push(u); for (const d of UGD) for (const e of d) if (e > u0 + .01 && e < u1 - .01) us.push(e); us.sort((p, q) => p - q); us.push(u1);
    A.begin('ar_plaster'); for (let i = 0; i + 1 < us.length; i++) { const u = us[i], ub = us[i + 1]; if (ub - u < .005) continue; const door = UGD.some(([a, b]) => u >= a - 1e-6 && ub <= b + 1e-6); for (let y = BERM; y < TOP - .01; y += .6) { if (door && y < BERM + 2.39) continue; const yb = Math.min(TOP, y + .6), c = conc(u + .37, y + .3, .96); A.tint(...c); QD([u, y, zUp(y)], [ub, y, zUp(y)], [ub, yb, zUp(yb)], [u, yb, zUp(yb)]); } } A.end();
    A.begin('ar_plaster'); A.tint(.7, .71, .72); A.quad(u0, BERM, ZBO, u1, BERM, ZBO, u1, BERM, ZB, u0, BERM, ZB); A.end(); }
  /* tranche de la risberme et parement bas (hors usine et évacuateur) */
  A.begin('ar_plaster'); A.tint(.64, .65, .66); for (const [u0, u1] of [[-XB, SX0], [SX1, HX0], [HX1, XB]]) A.quad(u0, BERM - .4, ZBO, u1, BERM - .4, ZBO, u1, BERM, ZBO, u0, BERM, ZBO); A.end();
  for (const [u0, u1] of [[-XR, SX0], [SX1, HX0], [HX1, XR]]) { if (u1 - u0 < .2) continue; const us = []; for (let u = u0; u < u1 - .01; u += .75) us.push(u); for (const d of ADIT) for (const e of d) if (e > u0 + .01 && e < u1 - .01) us.push(e); us.sort((p, q) => p - q); us.push(u1);
    A.begin('ar_plaster'); for (let i = 0; i + 1 < us.length; i++) { const u = us[i], ub = us[i + 1]; if (ub - u < .005) continue; const ad = ADIT.some(([a, b]) => u >= a - 1e-6 && ub <= b + 1e-6); for (let q = 0; q + 1 < LB.length; q++) { const y = LB[q], yb = LB[q + 1]; if (ad && yb <= 2.6 + 1e-6) continue; A.tint(...conc(u + .37, (y + yb) / 2)); QD([u, y, zLo(y)], [ub, y, zLo(y)], [ub, yb, zLo(yb)], [u, yb, zLo(yb)]); } if (!ad) { A.tint(...conc(u + .37, .8)); A.quad(u, 0, ZT, ub, 0, ZT, ub, 2, ZT, u, 2, ZT); } }
    A.tint(.66); A.quad(u0, BERM - .4, ZBO, u1, BERM - .4, ZBO, u1, BERM - .4, zLo(BERM - .4), u0, BERM - .4, zLo(BERM - .4)); A.end(); }
  /* joues du bloc de l'usine sous la terrasse (x = HX0 et HX1) : du parement bas (ou du nez de la risberme) jusqu'à l'usine */
  { A.begin('ar_plaster'); const CB = LB.concat([BERM]); for (const [xc, sd] of [[HX0, -1], [HX1, 1]]) for (let q = 0; q + 1 < CB.length; q++) { const y = CB[q], yb = CB[q + 1], za = y >= BERM - .41 ? ZBO : zLo(y), zb = yb > BERM - .39 ? ZBO : zLo(yb); A.tint(...conc(xc + .37 * sd, (y + yb) / 2, .94)); if (sd < 0) QD([xc, y, za], [xc, y, ZT], [xc, yb, ZT], [xc, yb, zb]); else QD([xc, y, ZT], [xc, y, za], [xc, yb, zb], [xc, yb, ZT]); } A.end(); }
  /* joue est du corps (x = XR) le long de la fente entre le barrage et la culée rocheuse */
  { A.begin('ar_plaster'); A.tint(...conc(XR, 1, .9)); A.quad(XR, 0, ZT, XR, 0, ZBO, XR, 2, ZBO, XR, 2, ZT); for (let q = 0; q + 1 < LB.length; q++) { const y = LB[q], yb = LB[q + 1]; A.tint(...conc(XR + .4, (y + yb) / 2, .9)); A.quad(XR, y, zLo(y), XR, y, ZBO, XR, yb, ZBO, XR, yb, zLo(yb)); } A.end(); }
  /* joints de plots (rainures sombres sur toute la hauteur) et barbacanes sous la risberme */
  { A.begin('ar_dark'); A.tint(.3, .3, .29); for (let u = -27; u <= 27.01; u += 9) { if (u > SX0 - .3 && u < SX1 + .3) continue; const low = !(u > HX0 && u < HX1); for (let y = BERM; y < TOP - .01; y += .6) { if (y < BERM + 2.39 && UGD.some(([a, b]) => u > a - .05 && u < b + .05)) continue; const yb = Math.min(TOP, y + .6); QD([u - .06, y, zUp(y) + .012], [u + .06, y, zUp(y) + .012], [u + .06, yb, zUp(yb) + .012], [u - .06, yb, zUp(yb) + .012]); } if (low && Math.abs(u) < XR) for (let y = 0; y < BERM - .41; y += .4) { const yb = Math.min(BERM - .4, y + .4), za = (y < 2 ? ZT : zLo(y)) + .012, zb = (yb <= 2 ? ZT : zLo(yb)) + .012; QD([u - .06, y, za], [u + .06, y, za], [u + .06, yb, zb], [u - .06, yb, zb]); } }
    A.tint(.18); for (const [u0, u1] of [[-XR, SX0], [SX1, HX0], [HX1, XR]]) for (let u = u0 + 1.5; u < u1 - .5; u += 3) { const y = BERM - .9, z = zLo(y) + .015; QD([u - .09, y - .09, z], [u + .09, y - .09, z], [u + .09, y + .09, z], [u - .09, y + .09, z]); } A.end(); }
  /* coulures sombres : sous les gargouilles de la corniche (parement haut) et sous les barbacanes (parement bas) */
  { const off = (u, w) => Math.abs(((u + 27) % 9 + 9) % 9) < w + .12 || Math.abs(((u + 27) % 9 + 9) % 9 - 9) < w + .12, LOWS = [[-XR, SX0], [SX1, HX0], [HX1, XR]];
    A.begin('ar_plaster'); for (let u = -25; u <= 25; u += 2.25) { if (u > SX0 - .5 && u < SX1 + .5) continue; const w = .08 + .1 * noise2(u * 3.1, 1), L = 1.4 + 2 * noise2(u * 1.3, 4); if (off(u, w)) continue; for (let q = 0; q < 4; q++) { const y0 = TOP - 1.05 - L * q / 4, y1 = TOP - 1.05 - L * (q + 1) / 4; if (y1 < BERM + 2.5 && UGD.some(([a, b]) => u > a - .4 && u < b + .4)) break; const d = .5 + .07 * q; A.tint(d, d * 1.01, d * 1.03); QD([u - w, y0, zUp(y0) + .011], [u + w, y0, zUp(y0) + .011], [u + w, y1, zUp(y1) + .011], [u - w, y1, zUp(y1) + .011]); } }
    for (const [u0, u1] of LOWS) for (let u = u0 + 1.5; u < u1 - .5; u += 3) { if (off(u, .12) || (u > 12.3 && u < 17.7)) continue; const w = .06 + .06 * noise2(u * 2.3, 7), L = 2.2 + 2.6 * noise2(u * 1.7, 9); for (let q = 0; q < 5; q++) { const y0 = BERM - 1.02 - L * q / 5, y1 = Math.max(2.05, BERM - 1.02 - L * (q + 1) / 5); if (y0 <= 2.06) break; const d = .46 + .07 * q; A.tint(d * .96, d, d * 1.02); QD([u - w, y0, zLo(y0) + .013], [u + w, y0, zLo(y0) + .013], [u + w, y1, zLo(y1) + .013], [u - w, y1, zLo(y1) + .013]); } } A.end();
    /* corniche sous le parapet aval : ombre portée nette sur tout le parement */
    A.begin('ar_plaster'); A.tint(.8, .81, .82); for (const [a, b] of [[-XB, SX0], [SX1, 3.2], [5.2, XB]]) { A.box(a, b, TOP - 1, TOP - .45, ZC - .2, ZC + .9, 0, ''); sol(a, b, TOP - 1, TOP - .45, ZC - .2, ZC + .9, 'concrete', 1); } A.tint(.5); for (let u = -24.75; u < 25; u += 2.25) { if ((u > 2.6 && u < 5.8) || (u > SX0 - .2 && u < SX1 + .2)) continue; A.box(u - .07, u + .07, TOP - 1.07, TOP - 1, ZC + .5, ZC + .9); } A.end(); }
  /* chaussée du couronnement (enrobé), bordures, rails du portique, goulotte à câbles */
  A.begin('ar_gravel'); for (let x = -XC; x < XC - .01; x += 8) { const x1 = Math.min(XC, x + 8), v = .42 + .06 * noise2(x * .2, 1); A.tint(v, v, v * 1.02); A.quad(x, TOP + .012, ZC - .5, x1, TOP + .012, ZC - .5, x1, TOP + .012, ZU + .5, x, TOP + .012, ZU + .5); } A.end();
  A.begin('ar_plaster'); A.tint(.66, .67, .68); for (const [z0, z1] of [[ZU, ZU + .5], [ZC - .5, ZC]]) A.quad(-XC, TOP + .014, z1, XC, TOP + .014, z1, XC, TOP + .014, z0, -XC, TOP + .014, z0); A.end();
  A.begin('ar_iron'); A.tint(.3, .3, .3); for (const rz of [-5.05, -1.55]) A.box(-XC, XC, TOP, TOP + .03, rz - .04, rz + .04); A.tint(.36, .37, .38); A.box(-XC + 1, XC - 1, TOP + .32, TOP + .44, ZC - .7, ZC - .45); for (let x = -XC + 1.5; x < XC - 1; x += 2.5) A.box(x - .03, x + .03, TOP + .2, TOP + .44, ZC - .72, ZC - .45); A.end(true);
  /* parement amont (au-dessus de l'eau) : ligne de marnage sombre, mousse, hors passe de l'évacuateur */
  A.begin('ar_plaster'); for (let u = -XC; u < XC - .01; u += 1) { const u1 = Math.min(XC, u + 1), inSp = u + .5 > SX0 && u + .5 < SX1; for (const [ya, yb] of [[WFL, WAT + .5], [WAT + .5, WAT + 1.2], [WAT + 1.2, TOP]]) { if (inSp && ya >= SPILL) { if (yb > TOP - .35) A.tint(...conc(u, 11)), A.quad(u1, TOP - .35, ZU, u, TOP - .35, ZU, u, TOP, ZU, u1, TOP, ZU); continue; } const c = conc(u + .5, (ya + yb) / 2, ya < WAT + .4 ? .62 : ya < WAT + 1.1 ? .8 : 1); if (ya < WAT + 1.1) { c[0] *= .9; c[2] *= .86; } A.tint(...c); const top = inSp ? Math.min(yb, SPILL) : yb; A.quad(u1, ya, ZU, u, ya, ZU, u, top, ZU, u1, top, ZU); } } A.end();
  /* parapets en béton : amont continu (passerelle de la tour), aval avec le départ d'escalier du toit de l'usine */
  for (const [z0, z1, gaps] of [[ZU, ZU + .45, [[-1.2, 1.2]]], [ZC - .45, ZC, [[3.4, 5]]]]) { let u = -XC; for (const [g0, g1] of gaps.concat([[XC, 99]])) { if (g0 - u > .3) { A.parapet('x', (z0 + z1) / 2, u, g0, TOP, 1.05, z1 - z0, { m: 'ar_plaster' }); sol(u, g0, TOP, TOP + 1.1, z0, z1, 'concrete', 1); } u = g1; } }
  /* portiques de manœuvre des vannes de l'évacuateur (au-dessus du parapet amont) */
  { A.begin('ar_iron'); A.tint(.62, .52, .2); for (const px of [SX0 + .35, -17.4, -14.2, SX1 - .35]) A.box(px - .2, px + .2, TOP + 1.05, TOP + 4.6, ZU + .02, ZU + .42); A.box(SX0, SX1, TOP + 4.4, TOP + 4.9, ZU - .3, ZU + .7); A.end(); A.begin('ar_tin'); A.tint(.5, .52, .46); for (const gx of [-19.1, -15.8, -12.5]) A.box(gx - .7, gx + .7, TOP + 4.9, TOP + 5.9, ZU - .25, ZU + .65); A.end(); A.begin('ar_iron'); A.tint(.25); for (const gx of [-19.1, -15.8, -12.5]) for (const dx of [-1, 1]) A.rod(gx + dx, TOP + 4.4, ZU - .1, gx + dx, TOP - .7 - Math.sin(-.2) * 3.6, ZU - 1.1 - Math.cos(-.2) * 3.6 + .2, .025, 4); A.end(true);
    for (const px of [SX0 + .35, -17.4, -14.2, SX1 - .35]) sol(px - .2, px + .2, TOP + 1.05, TOP + 4.6, ZU + .02, ZU + .42, 'metal'); }
  /* garde-corps de la risberme (béton à lisse de fer) */
  const rail = (ax, c, a, b, y, H = 1.05) => { if (b - a < .2) return; A.begin('ar_iron'); A.tint(.38, .4, .4); const n = Math.max(1, Math.round((b - a) / 1.4)); for (let i = 0; i <= n; i++) { const u = a + (b - a) * i / n; ax === 'x' ? A.rod(u, y, c, u, y + H, c, .028, 5) : A.rod(c, y, u, c, y + H, u, .028, 5); } ax === 'x' ? (A.rod(a, y + H, c, b, y + H, c, .035, 5), A.rod(a, y + H * .5, c, b, y + H * .5, c, .022, 4)) : (A.rod(c, y + H, a, c, y + H, b, .035, 5), A.rod(c, y + H * .5, a, c, y + H * .5, b, .022, 4)); A.end(true); ax === 'x' ? sol(a, b, y, y + H + .05, c - .05, c + .05, 'metal', 1) : sol(c - .05, c + .05, y, y + H + .05, a, b, 'metal', 1); };
  rail('x', ZBO - .06, -XB, SX0, BERM); rail('x', ZBO - .06, SX1, HX0, BERM); rail('x', ZBO - .06, HX1, XB, BERM);

  /* ---------- 11. galeries et puits ---------- */
  yield;
  const wallsX = (x0, x1, y0, y1, z0, z1, holesN = [], holesS = []) => { for (const [z, s, hs] of [[z0, 1, holesN], [z1, -1, holesS]]) flatWall(A, 'ar_plaster', 'x', z, s, x0, x1, y0, y1, hs, [.98, 1, 1.03], .66); A.begin('ar_plaster'); A.tint(.5, .52, .55); A.quad(x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1); A.end(); A.begin('ar_gravel'); A.tint(.56, .56, .54); A.quad(x0, y0 + .015, z1, x1, y0 + .015, z1, x1, y0 + .015, z0, x0, y0 + .015, z0); A.end(); };
  const wallsZ = (z0, z1, y0, y1, x0, x1, holesW = [], holesE = []) => { for (const [x, s, hs] of [[x0, 1, holesW], [x1, -1, holesE]]) flatWall(A, 'ar_plaster', 'z', x, s, z0, z1, y0, y1, hs, [.98, 1, 1.03], .66); A.begin('ar_plaster'); A.tint(.5, .52, .55); A.quad(x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1); A.end(); A.begin('ar_gravel'); A.tint(.56, .56, .54); A.quad(x0, y0 + .015, z1, x1, y0 + .015, z1, x1, y0 + .015, z0, x0, y0 + .015, z0); A.end(); };
  const cap = (ax, c, s, a, b, y0, y1) => { A.begin('ar_plaster'); A.tint(.6); ax === 'x' ? A.quad(...(s > 0 ? [a, y0, c, b, y0, c, b, y1, c, a, y1, c] : [b, y0, c, a, y0, c, a, y1, c, b, y1, c])) : A.quad(...(s > 0 ? [c, y0, b, c, y0, a, c, y1, a, c, y1, b] : [c, y0, a, c, y0, b, c, y1, b, c, y1, a])); A.end(); };
  const hole = (a, b, y0, y1) => ({ a, b, y0, y1 });
  /* galerie de pied : d'une culée à l'autre ; rameaux et passages vers les puits */
  wallsX(-FGX, FGX, 0, FGH, FGZ0, FGZ1, [], [hole(-7, -4.4, 0, 2.6), hole(1.2, 3.8, 0, 2.8), hole(18.6, 21.2, 0, 2.6), hole(-SPX - 1.3, -SPX + 1.3, 0, 2.6), hole(SPX - 1.3, SPX + 1.3, 0, 2.6)]);
  cap('z', -FGX, 1, FGZ0, FGZ1, 0, FGH); cap('z', FGX, -1, FGZ0, FGZ1, 0, FGH);
  for (const [x0, x1, h] of [[-7, -4.4, 2.6], [1.2, 3.8, 2.8]]) wallsZ(FGZ1, ZT, 0, h, x0, x1);
  /* rameau est : coupé au parement bas, joues entre la coupe et le parement courbe, sol jusqu'au mur de pied */
  for (const [x0, x1] of ADIT) { const zc = zLo(2.6); wallsZ(FGZ1, zc, 0, 2.6, x0, x1); A.begin('ar_plaster'); A.tint(.62, .63, .65); A.quad(x0, 0, ZT, x0, 0, zc, x0, 2, zc, x0, 2, ZT); A.quad(x1, 0, zc, x1, 0, ZT, x1, 2, ZT, x1, 2, zc); for (let q = 0; q + 1 < LB.length && LB[q] < 2.6 - 1e-6; q++) { const y = LB[q], yb = LB[q + 1]; A.quad(x0, y, zLo(y), x0, y, zc, x0, yb, zc, x0, yb, zLo(yb)); A.quad(x1, y, zc, x1, y, zLo(y), x1, yb, zLo(yb), x1, yb, zc); } A.end(); A.begin('ar_gravel'); A.tint(.56, .56, .54); A.quad(x0, .015, ZT, x1, .015, ZT, x1, .015, zc, x0, .015, zc); A.end(); }
  for (const sx of [-1, 1]) wallsZ(FGZ1, SPZ - SPR + .2, 0, 2.6, sx * SPX - 1.3, sx * SPX + 1.3);
  /* galerie haute et ses portes */
  wallsX(UGX0, UGX1, BERM, BERM + 2.6, UGZ0, UGZ1, [], [hole(-1.4, 1.4, BERM, BERM + 2.4), hole(18.6, 21.2, BERM, BERM + 2.4), hole(24, 26.6, BERM, BERM + 2.4)]);
  cap('z', UGX0, 1, UGZ0, UGZ1, BERM, BERM + 2.6); cap('z', UGX1, -1, UGZ0, UGZ1, BERM, BERM + 2.6);
  for (const [x0, x1] of UGD) { const zc = zUp(BERM + 2.4); wallsZ(UGZ1, zc, BERM, BERM + 2.4, x0, x1); A.begin('ar_plaster'); A.tint(.62, .63, .65); A.tri(x0, BERM, zc, x0, BERM + 2.4, zc, x0, BERM, ZB); A.tri(x1, BERM, zc, x1, BERM, ZB, x1, BERM + 2.4, zc); A.end(); A.begin('ar_gravel'); A.tint(.56, .56, .54); A.quad(x0, BERM + .015, ZB, x1, BERM + .015, ZB, x1, BERM + .015, zc, x0, BERM + .015, zc); A.end(); /* [fin] (rc8-81 : « cadre noir en acier tout seul ») huisserie posée dans le plan du parement (z = zc, au linteau), plus 1 m devant lui au pied du talus */ A.begin('ar_iron'); A.tint(.3, .32, .3); A.box(x0 - .12, x0 + .02, BERM, BERM + 2.52, zc - .1, zc + .02); A.box(x1 - .02, x1 + .12, BERM, BERM + 2.52, zc - .1, zc + .02); A.box(x0 - .12, x1 + .12, BERM + 2.41, BERM + 2.52, zc - .1, zc + .02); A.end(); sol(x0 - .12, x0, BERM, BERM + 2.52, zc - .1, zc + .02, 'metal'); sol(x1, x1 + .12, BERM, BERM + 2.52, zc - .1, zc + .02, 'metal'); sol(x0 - .12, x1 + .12, BERM + 2.4, BERM + 2.52, zc - .1, zc + .02, 'metal'); }
  /* salles taillées entre la risberme et les puits (8,4) */
  for (const sx of [-1, 1]) { const a = sx > 0 ? XB : -SPX + SPR - .2, b = sx > 0 ? SPX - SPR + .2 : -XB; wallsX(a, b, BERM, BERM + 2.4, ZB, SPZ + 1.1); cap('z', sx > 0 ? a : b, sx > 0 ? 1 : -1, ZBO, SPZ + 1.1, BERM, BERM + 2.4); }
  /* puits à vis : tambour (collision en anneau), vis 0 -> 8,4 (deux tours trois quarts) puis 8,4 -> 12 */
  for (const sx of [-1, 1]) { const cx = sx * SPX, da = TAU / 16, ccw = sx > 0, a0 = sx > 0 ? Math.PI - 43.5 * da : 43.5 * da;
    A.spiral(cx, SPZ, SPR - .05, .5, 0, BERM, { a0, perTurn: 16, rise: BERM / 44, ccw });
    A.spiral(cx, SPZ, SPR - .05, .5, BERM, TOP, { a0: a0 + (sx > 0 ? 1 : -1) * 44 * da, perTurn: 16, rise: (TOP - BERM) / 19, ccw });
    const nP = 24, Ri = SPR + .02, doorLo = -Math.PI / 2, doorHi = sx > 0 ? Math.PI : 0, near = (a, b, w) => Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI) < w, rx0 = sx > 0 ? XB : -SPX + SPR - .2, rx1 = sx > 0 ? SPX - SPR + .2 : -XB, inRoom = a => { const px = cx + Math.cos(a) * (SPR + .02), pz = SPZ + Math.sin(a) * (SPR + .02); return px > rx0 - .05 && px < rx1 + .05 && pz > ZB - .05 && pz < SPZ + 1.15; }, gap = (a, y) => (y < 2.6 && near(a, doorLo, .5)) || (y >= BERM && y < BERM + 2.4 && near(a, doorHi, .5)); void inRoom;
    A.begin('ar_plaster'); for (let q = 0; q < nP; q++) { const t0 = q / nP * TAU, t1 = (q + 1) / nP * TAU, tm = (t0 + t1) / 2; for (let y = 0; y < TOP - .01; y += .6) { const y1 = Math.min(TOP, y + .6); if (gap(tm, y + .3)) continue; const tn = .58 + .08 * noise2(q, y); A.tint(tn, tn * 1.01, tn * 1.04); A.quad(cx + Math.cos(t0) * Ri, y, SPZ + Math.sin(t0) * Ri, cx + Math.cos(t1) * Ri, y, SPZ + Math.sin(t1) * Ri, cx + Math.cos(t1) * Ri, y1, SPZ + Math.sin(t1) * Ri, cx + Math.cos(t0) * Ri, y1, SPZ + Math.sin(t0) * Ri); } } A.end();
    const EH = SPR + .5; for (let q = 0; q < 36; q++) { const tm = (q + .5) / 36 * TAU, ct = Math.cos(tm), st = Math.sin(tm), ix = cx + ct * (SPR + .01), iz = SPZ + st * (SPR + .01), ex = cx + Math.sign(ct || 1) * EH, ez = SPZ + Math.sign(st || 1) * EH; for (const [y0, y1] of [[0, 2.6], [2.6, BERM], [BERM, BERM + 2.4], [BERM + 2.4, TOP]]) { if (gap(tm, y0 + .1)) continue; const FL_ = .924, fx = Math.abs(ct) > FL_, fz = Math.abs(st) > FL_, ixx = fx ? cx + Math.sign(ct) * (SPR + .01) * FL_ : fz ? cx : ix, izz = fz ? SPZ + Math.sign(st) * (SPR + .01) * FL_ : fx ? SPZ : iz;
      let bx0 = Math.min(ixx, ex), bx1 = Math.max(ixx, ex); const bz0 = Math.min(izz, ez), bz1 = Math.max(izz, ez); if (y0 === BERM && bz0 < SPZ + 1.1 && bz1 > ZB) { if (sx > 0) bx0 = Math.max(bx0, rx1); else bx1 = Math.min(bx1, rx0); } if (bx1 - bx0 < .02) continue; { const w_ = sol(bx0, bx1, y0, y1, bz0, bz1, 'concrete', 0); w_.inner = 1; w_.slide = 1; /* slide: the mover steps around the corners of this round wall (engine-grid.js) */ } } }
    { const ex2 = sx > 0 ? rx1 : rx0, hw = Math.sqrt(Math.max(0, (SPR + .02) ** 2 - (cx - ex2) ** 2)); /* [objc] fente de jour entre le tambour et le mur de la salle, à la porte de la risberme : le tambour s'arrêtait à ±30° de la porte (segments de 15°) et le mur de la salle n'est dessiné que côté salle ; bande de tambour jusqu'au bord du trou du mur */ { const a0 = Math.asin(Math.min(1, hw / Ri)), aE = 2 * Math.PI / nP * 2, n2 = 3; A.begin('ar_plaster'); A.tint(.6, .61, .64); for (const sg of [-1, 1]) for (let q = 0; q < n2; q++) { const u0 = a0 + (aE - a0) * q / n2, u1 = a0 + (aE - a0) * (q + 1) / n2, base = doorHi; let t0 = base + sg * u0, t1 = base + sg * u1; if (t0 > t1) { const tt = t0; t0 = t1; t1 = tt; } A.quad(cx + Math.cos(t0) * Ri, BERM, SPZ + Math.sin(t0) * Ri, cx + Math.cos(t1) * Ri, BERM, SPZ + Math.sin(t1) * Ri, cx + Math.cos(t1) * Ri, BERM + 2.4, SPZ + Math.sin(t1) * Ri, cx + Math.cos(t0) * Ri, BERM + 2.4, SPZ + Math.sin(t0) * Ri); } A.end(); } flatWall(A, 'ar_plaster', 'z', ex2, sx > 0 ? -1 : 1, ZB, SPZ + 1.1, BERM, BERM + 2.4, [{ a: SPZ - hw, b: SPZ + hw, y0: BERM, y1: BERM + 2.4 }], [.98, 1, 1.03], .66); for (const [z0, z1] of [[ZB - .5, ZB], [SPZ + 1.1, SPZ + 1.6]]) sol(Math.min(rx0, rx1), Math.max(rx0, rx1) + .02, BERM, BERM + 2.4, z0, z1, 'concrete', 0).inner = 1; }
    A.begin('ar_gravel'); A.tint(.5); A.quad(cx - SPR, .016, SPZ + SPR, cx + SPR, .016, SPZ + SPR, cx + SPR, .016, SPZ - SPR, cx - SPR, .016, SPZ - SPR); A.end(); }

  /* ---------- 12. évacuateur : passe sous le pont, coursier, bajoyers, chenal, blocs dissipateurs, vannes ---------- */
  yield;
  { const x0 = SX0 + SW, x1 = SX1 - SW;
    { const bw = (x1 - x0) / 4; A.begin('ar_plaster'); for (let z = ZU; z < 18 - .01; z += .5) { const z1 = Math.min(18, z + .5); for (let k2 = 0; k2 < 4; k2++) { const a = x0 + k2 * bw, b = a + bw, t = (1.04 + .05 * noise2(z * .4, k2 + 1)) * (k2 === 1 || k2 === 2 ? .96 - .05 * clamp((z - 4) / 12, 0, 1) : 1); A.tint(t * .98, t * .98, t * .96); A.quad(a, spillY(z1), z1, b, spillY(z1), z1, b, spillY(z), z, a, spillY(z), z); } } A.end();
      A.begin('ar_dark'); A.tint(.42); for (let z = ZU; z < 18 - .01; z += .5) { const z1 = Math.min(18, z + .5); for (let k2 = 1; k2 < 4; k2++) { const a = x0 + k2 * bw; A.quad(a - .03, spillY(z1) + .012, z1, a + .03, spillY(z1) + .012, z1, a + .03, spillY(z) + .012, z, a - .03, spillY(z) + .012, z); } } for (let z = ZU + 3; z < 17.9; z += 3) A.quad(x0, spillY(z + .05) + .015, z + .05, x1, spillY(z + .05) + .015, z + .05, x1, spillY(z - .05) + .015, z - .05, x0, spillY(z - .05) + .015, z - .05); A.end(); }
    A.begin('ar_plaster'); for (const [w0, w1] of [[SX0, SX0 + SW], [SX1 - SW, SX1]]) for (let z = -2; z < 34.6 - .01; z += .5) { const z1 = Math.min(34.6, z + .5); if (z >= ZB - .01 && z1 <= ZBO + .01) { A.tint(.68, .69, .7); A.box(w0, w1, BERM - .3, BERM, z, z1 + .005, 0, 'y'); continue; } const tA = z < ZC ? TOP - .35 : (z < 18 ? spillY(z) : 0) + 2; A.tint(.7, .71, .72); if (z >= ZC && z < 18) { /* bajoyers : dessus en pente au lieu de marches de 0,5 m (MAP QA) */const yb = Math.min(spillY(z1), spillY(z)) - .2, zb = z1 + .005; A.ext('z', [[z, yb], [zb, yb], [zb, spillY(zb) + 2], [z, spillY(z) + 2]], w0, w1); continue; } A.box(w0, w1, z < 18 ? Math.min(spillY(z1), spillY(z)) - .2 : 0, tA, z, z1 + .005, 0, 'y'); } A.end();
    A.begin('ar_ashlar'); A.tint(.8); for (const [w0, w1] of [[SX0, SX0 + SW], [SX1 - SW, SX1]]) A.box(w0, w1, SPILL - .2, TOP - .35, ZU, -2); A.end();
    A.begin('ar_plaster'); A.tint(.66, .67, .68); A.quad(x0, .02, 34.6, x1, .02, 34.6, x1, .02, 18, x0, .02, 18); A.end();
    for (const [bx, bz] of [[-18, 26], [-15.8, 26], [-13.6, 26], [-16.9, 29.5], [-14.7, 29.5]]) { A.rbox('ar_plaster', bx - .55, bx + .55, 0, .7, bz - .55, bz + .55, { b: .06 }); A.rbox('ar_plaster', bx - .55, bx + .55, .7, 1.3, bz - .55, bz + .02, { b: .06 }); sol(bx - .55, bx + .55, 0, .7, bz - .55, bz + .55); sol(bx - .55, bx + .55, .7, 1.3, bz - .55, bz + .02); }   /* blocs dissipateurs à gradin */
    A.begin('ar_water'); A.tint(.8, .9, .88); A.quad(x0, .09, 34.6, x1, .09, 34.6, x1, .09, 20, x0, .09, 20); A.end();
    /* pont du couronnement, piles entre les trois pertuis, vannes segment relevées */
    A.begin('ar_plaster'); A.tint(...CONC); A.box(SX0, SX1, TOP - .35, TOP, ZU, ZC); A.end(); sol(SX0, SX1, TOP - .35, TOP, ZU, ZC);
    for (const px of [-17.4, -14.2]) { const w = .7; A.begin('ar_ashlar'); A.tint(.82); A.box(px - w / 2, px + w / 2, SPILL, TOP - .35, ZU - 1.4, -2); A.end(); sol(px - w / 2, px + w / 2, SPILL, TOP - .35, ZU - 1.4, -2); }
    for (const [g0, g1] of [[x0 + .05, -17.75], [-17.05, -14.55], [-13.85, x1 - .05]]) { A.begin('ar_iron'); A.tint(.52, .56, .5); const R = 3.6, cz = ZU - 1.1, cy = TOP - .7; for (let q = 0; q < 6; q++) { const a0 = -.2 + q * .1, a1 = a0 + .1; A.quad(g0, cy - Math.sin(a0) * R, cz - Math.cos(a0) * R, g1, cy - Math.sin(a0) * R, cz - Math.cos(a0) * R, g1, cy - Math.sin(a1) * R, cz - Math.cos(a1) * R, g0, cy - Math.sin(a1) * R, cz - Math.cos(a1) * R); const r2 = R - .03; A.quad(g0, cy - Math.sin(a1) * r2, cz - Math.cos(a1) * r2, g1, cy - Math.sin(a1) * r2, cz - Math.cos(a1) * r2, g1, cy - Math.sin(a0) * r2, cz - Math.cos(a0) * r2, g0, cy - Math.sin(a0) * r2, cz - Math.cos(a0) * r2); } for (const gx of [g0 + .1, g1 - .1]) A.rod(gx, cy, cz, gx, cy - Math.sin(.2) * R, cz - Math.cos(.2) * R, .06, 5);
      /* [fin] vanne lisible (rc8 : plaque noire mince entre les piles) : acier peint plus clair, second bras vers le haut du bouclier, poutres horizontales derrière le bouclier, tourillons */
      A.tint(.4, .44, .4); for (const gx of [g0 + .1, g1 - .1]) { A.rod(gx, cy, cz, gx, cy - Math.sin(-.2) * R, cz - Math.cos(-.2) * R, .06, 5); A.rod(gx, cy - Math.sin(.2) * R * .55, cz - Math.cos(.2) * R * .55, gx, cy - Math.sin(-.2) * R * .55, cz - Math.cos(-.2) * R * .55, .04, 4); A.box(gx - .12, gx + .12, cy - .12, cy + .12, cz - .12, cz + .12); }
      for (const a of [-.15, -.05, .05, .15]) { const rr = R - .12; A.rod(g0 + .02, cy - Math.sin(a) * rr, cz - Math.cos(a) * rr, g1 - .02, cy - Math.sin(a) * rr, cz - Math.cos(a) * rr, .05, 5); } A.end(true); }
  }

  /* ---------- 13. usine : halle des turbines (0 -> 7,8), toit-terrasse à 8,4, passerelle intérieure, tour d'escalier ---------- */
  yield;
  { const x0 = HX0, x1 = HX1, z0 = ZT, z1 = HZ1, t = .4, ht = 7.8;
    const win = (a, b, y0, y1) => ({ a, b, y0, y1 }), dr = (a, b, y1, y0 = 0) => ({ a, b, y0, y1, door: true });
    const wall = (ax, c, a, b, y0, y1, hs) => { const sorted = hs.slice().sort((p, q) => p.a - q.a); let u = a; const seg = (p, q, v0, v1) => { if (q - p > .01 && v1 - v0 > .01) { ax === 'x' ? sol(p, q, v0, v1, c - t / 2, c + t / 2, 'concrete', 1) : sol(c - t / 2, c + t / 2, v0, v1, p, q, 'concrete', 1); } }; for (const h of sorted) { seg(u, h.a, y0, y1); if (h.y0 > y0) seg(h.a, h.b, y0, h.y0); if (h.y1 < y1) seg(h.a, h.b, h.y1, y1); if (!h.door) seg(h.a, h.b, h.y0, h.y1); u = h.b; }/* fenêtres aveugles : la vitre sombre est opaque, la balle ne passe plus (MAP QA) */ seg(u, b, y0, y1);
      for (const sd of [-1, 1]) flatWall(A, 'ar_plaster', ax, c + sd * t / 2, sd, a, b, y0, y1, sorted, CONC, .9);
      A.begin('ar_plaster'); A.tint(.6); for (const h of sorted) { if (!h.door) continue; if (ax === 'x') { A.box(h.a - .012, h.a, h.y0, h.y1, c - t / 2, c + t / 2, 0, 'x'); A.box(h.b, h.b + .012, h.y0, h.y1, c - t / 2, c + t / 2, 0, 'X'); A.box(h.a, h.b, h.y1, h.y1 + .012, c - t / 2, c + t / 2, 0, 'Y'); if (h.y0 > y0) A.box(h.a, h.b, h.y0 - .012, h.y0, c - t / 2, c + t / 2, 0, 'y'); } else { A.box(c - t / 2, c + t / 2, h.y0, h.y1, h.a - .012, h.a, 0, 'z'); A.box(c - t / 2, c + t / 2, h.y0, h.y1, h.b, h.b + .012, 0, 'Z'); A.box(c - t / 2, c + t / 2, h.y1, h.y1 + .012, h.a, h.b, 0, 'Y'); if (h.y0 > y0) A.box(c - t / 2, c + t / 2, h.y0 - .012, h.y0, h.a, h.b, 0, 'y'); } } A.end();
      for (const h of sorted) if (!h.door) for (const s of [-1, 1]) A.window(ax, c + s * t / 2, s, (h.a + h.b) / 2, h.y0, h.b - h.a, h.y1 - h.y0, { shutter: false, fm: 'ar_iron', mull: 2 }); };
    const fw = []; for (let x = x0 + 1.7; x < x1 - 1.2; x += 3.1) if ((x < -.6 || x > 5) && Math.abs(x - (x1 - 2)) > 2.1) fw.push(win(x - .95, x + .95, 2.1, 7)); fw.push(dr(.2, 3.8, 3.4)); fw.push(dr(x1 - 2.8, x1 - 1.2, 2.3));
    wall('x', z1 - t / 2, x0 - .2, x1 + .2, 0, ht, fw); A.begin('ar_plaster'); A.tint(.7, .71, .72); A.quad(x0 - .2, 0, z1 - t, x0 - .2, 0, z1, x0 - .2, ht, z1, x0 - .2, ht, z1 - t); A.quad(x1 + .2, 0, z1, x1 + .2, 0, z1 - t, x1 + .2, ht, z1 - t, x1 + .2, ht, z1); A.end();
    wall('z', x0 + t / 2, z0, z1 - t, 0, ht, [dr(17.2, 18.8, 2.3), dr(11.5, 13, 6.5, 4.2), win(19.6, 21, 3.4, 6.2)]);
    wall('z', x1 - t / 2, z0, z1 - t, 0, ht, [win(16.6, 18.2, 3.2, 6.8), win(19.4, 21, 3.2, 6.8)]);
    wall('x', z0 + t / 2, x0 + t, x1 - t, 0, ht, [dr(-6.9, -4.5, 2.5), dr(1.2, 3.8, 2.8)]);
    /* toit : dalle, acrotère sur l'aval et l'est ; terrasse continue jusqu'au barrage */
    sol(x0, x1, ht, BERM, z0, z1); A.begin('ar_plaster'); A.tint(.6); A.quad(x0, ht, z0, x1, ht, z0, x1, ht, z1, x0, ht, z1); A.end();
    A.begin('ar_plaster'); A.tint(.74, .75, .76); A.box(x0 - .2, x1 + .2, ht - .1, BERM, z1 - .05, z1 + .1, 0, 'y'); A.box(x0 - .2, x0 + .05, ht - .1, BERM, z0, z1 + .1, 0, 'y'); A.box(x1 - .05, x1 + .2, ht - .1, BERM, z0, z1 + .1, 0, 'y'); A.end();
    A.begin('ar_plaster'); for (let x = x0; x < x1 - .01; x += 2) for (let z = ZBO; z < z1 - .01; z += 2) { const v = .66 + .08 * noise2(x * .3, z * .3); A.tint(v, v * 1.01, v * 1.02); A.quad(x, BERM + .012, Math.min(z1, z + 2), Math.min(x1, x + 2), BERM + .012, Math.min(z1, z + 2), Math.min(x1, x + 2), BERM + .012, z, x, BERM + .012, z); } A.end();
    A.parapet('x', z1 - .02, x0, x1, BERM, 1, .26, { m: 'ar_plaster' }); sol(x0, x1, BERM, BERM + 1.05, z1 - .15, z1 + .11, 'concrete', 1);
    A.parapet('z', x1 - .02, ZBO, z1, BERM, 1, .26, { m: 'ar_plaster' }); sol(x1 - .15, x1 + .11, BERM, BERM + 1.05, ZBO, z1, 'concrete', 1);
    rail('z', x0 + .06, ZBO, 20.3, BERM);
    /* intérieur : sol, groupes turbine-alternateur, pont roulant */
    A.begin('ar_plaster'); A.tint(.58, .6, .6); for (let x = x0; x < x1 - .01; x += 2) for (let z = z0; z < z1 - t - .01; z += 2) A.quad(x, .016, Math.min(z1 - t, z + 2), Math.min(x1, x + 2), .016, Math.min(z1 - t, z + 2), Math.min(x1, x + 2), .016, z, x, .016, z); A.end();
    for (const gx of [-2.4, 6.8]) { const gz = 17.4; A.begin('ar_plaster'); A.tint(.7); A.box(gx - 2.3, gx + 2.3, 0, .9, gz - 2.3, gz + 2.3); A.end(); sol(gx - 2.3, gx + 2.3, 0, .9, gz - 2.3, gz + 2.3);
      A.begin('ar_iron'); A.tint(.34, .44, .38); const pol = [], n = 18; for (let q = 0; q < n; q++) pol.push([gx + Math.cos(q / n * TAU) * 1.9, gz + Math.sin(q / n * TAU) * 1.9]); A.prism(pol, .9, 2.7); A.prism(pol.map(([x, z]) => [gx + (x - gx) * .7, gz + (z - gz) * .7]), 2.7, 3.4); A.end(); k.disc(gx, gz, 1.9, .9, 2.7, 'metal'); k.disc(gx, gz, 1.33, 2.7, 3.4, 'metal');
      A.begin('ar_dark'); A.tint(.5, .3, .22); A.prism(pol.map(([x, z]) => [gx + (x - gx) * .4, gz + (z - gz) * .4]), 3.4, 3.7); A.end();
      const sc = f => pol.map(([x, z]) => [gx + (x - gx) * f, gz + (z - gz) * f]); A.begin('ar_iron'); A.tint(.26, .34, .3); for (let q = 0; q < n; q++) { const a = (q + .5) / n * TAU, cx = gx + Math.cos(a) * 1.9, cz = gz + Math.sin(a) * 1.9; A.box(cx - .05, cx + .05, 1.02, 2.6, cz - .05, cz + .05); }
      A.tint(.3, .38, .34); A.prism(sc(1.04), .905, 1.02); A.prism(sc(1.04), 2.6, 2.72); A.tint(.46, .48, .48); A.prism(sc(.28), 3.7, 4.5); A.prism(sc(.34), 4.5, 4.62); A.tint(.72, .6, .2); A.prism(sc(.2), 4.62, 4.8); A.end(); k.disc(gx, gz, .55, 3.7, 4.8, 'metal');
      A.begin('ar_iron'); A.tint(.62, .52, .18); const RR = 1.86, gap = a => Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < .35; for (let q = 0; q < 8; q++) { const a0 = q / 8 * TAU, a1 = (q + 1) / 8 * TAU; if (!gap(a0)) A.rod(gx + Math.cos(a0) * RR, 2.72, gz + Math.sin(a0) * RR, gx + Math.cos(a0) * RR, 3.72, gz + Math.sin(a0) * RR, .025, 4); if (!gap(a0) && !gap(a1)) for (const h of [3.27, 3.72]) A.rod(gx + Math.cos(a0) * RR, h, gz + Math.sin(a0) * RR, gx + Math.cos(a1) * RR, h, gz + Math.sin(a1) * RR, .022, 4); }
      A.tint(.34, .4, .36); for (const a of [0, Math.PI]) { const ex = gx + Math.cos(a) * 2.55; A.rod(gx + Math.cos(a) * 1.95, 1.55, gz - .7, ex, 1.55, gz - .7, .08, 6); A.rod(ex, 1.55, gz - .7, ex, 0, gz - .7, .08, 6); A.box(ex - .14, ex + .14, 0, .05, gz - .84, gz - .56); sol(ex - .09, ex + .09, 0, 1.63, gz - .79, gz - .61, 'metal'); } A.end(true);
      A.ladder(gx - .25, .9, gz + 2.02, gx - .25, 2.72, gz + 1.9, {}); sol(gx - .55, gx + .05, .9, 2.72, gz + 1.88, gz + 2.08, 'metal'); }
    A.begin('ar_iron'); A.tint(.75, .62, .2); A.box(x0 + .5, x1 - .5, 6.3, 6.8, 14.9, 15.4); A.box(x0 + .5, x1 - .5, 6.3, 6.8, 20.4, 20.9); A.box(1.6, 2.6, 6.0, 6.9, 14.9, 20.9); A.end(); A.begin('ar_iron'); A.tint(.3); for (const cx of [1.98, 2.22]) A.rod(cx, 6.0, 17.6, cx, 4.38, 17.6, .022, 4); A.tint(.3); A.rod(2.1, 3.86, 17.6, 2.1, 3.56, 17.6, .05, 6); A.rod(2.1, 3.56, 17.6, 2.1, 3.36, 17.74, .05, 6); A.rod(2.1, 3.36, 17.74, 2.1, 3.34, 17.94, .05, 6); A.rod(2.1, 3.34, 17.94, 2.1, 3.48, 18.06, .05, 6); A.end(true); A.begin('ar_iron'); A.tint(.75, .62, .2); A.box(1.8, 2.4, 3.86, 4.4, 17.36, 17.84); A.end(); sol(1.8, 2.4, 3.86, 4.4, 17.36, 17.84, 'metal');
    /* passerelle intérieure (4,2) le long du mur amont ; porte vers le palier de la tour d'escalier ; escalier depuis le sol */
    const my = 4.2, mz0 = z0 + t, mz1 = mz0 + 1.6; sol(x0 + t, x1 - t, my - .2, my, mz0, mz1, 'metal'); A.begin('ar_iron'); A.tint(.42, .44, .44); A.box(x0 + t, x1 - t, my - .2, my, mz0, mz1); A.end(); rail('x', mz1 - .05, x0 + t + 1.5, x1 - t - 1.5, my);       // open in front of the stair below (1,3 m wide, centred at x1 - t - .8)
    A.stairs(x1 - t - .8, mz1 + 18 * .42, 1.3, 'z-', 0, my + .012, { walls: false, rail: -1, m: 'ar_plaster' });
    /* tour d'escalier extérieure : du lit au palier (4,2) puis au toit (8,4) */
    { const zE = 13, zS = zE + 18 * .42; A.stairs(-10.25, zS, 1.5, 'z-', 0, 4.2, { walls: false, rail: -1, m: 'ar_plaster' }); A.landing(-11, HX0, zE - 1.6, zE, 4.2, { y0: 0, m: 'ar_plaster' }); A.stairs(-8.75, zE, 1.5, 'z+', 4.2, BERM, { walls: false, rail: 1, m: 'ar_plaster' }); A.begin('ar_plaster'); A.tint(.5); A.quad(-9.52, 4.198, zE, -7.98, 4.198, zE, -7.98, 4.198, zS + .02, -9.52, 4.198, zS + .02); A.tint(.7); for (let i = 0; i < 18; i++) { const yt = 4.2 + (i + 1) * (BERM - 4.2) / 18, za = zE + i * .42, zb = za + .42; A.quad(-9.52, yt, zb, -9.5, yt, zb, -9.5, yt, za, -9.52, yt, za); } A.end(); A.landing(-9.5, HX0, zS, zS + 1.8, BERM, { y0: BERM - .4, m: 'ar_plaster' });
      rail('z', -10.98, zE - 1.6, zE, 4.2); rail('x', zE - 1.55, -11, HX0, 4.2); }
  }

  /* ---------- 13b. conduites forcées : deux tuyaux descendent le parement aval et entrent dans l'usine par l'est ---------- */
  { const R = .92, pz = y => (y <= 2 ? ZT : zLo(y)) + R + .1; for (const [px, zE] of [[13.6, 12.6], [16.4, 14.6]]) { A.begin('ar_iron'); A.tint(.44, .52, .47); let prev = [px, BERM - .6, pz(BERM - .6)]; for (const y of [6.2, 4.4, 3, 2]) { const p = [px, y, pz(y)]; A.log(prev[0], prev[1], prev[2], p[0], p[1], p[2], R, { seg: 12, n: 1, taper: 0, wob: 0 }); prev = p; } A.log(px, 2, pz(2), px, R + .2, ZT + 1.3, R, { seg: 12, n: 1, taper: 0, wob: 0 }); A.log(px, R + .2, ZT + 1.3, px, R + .2, zE, R, { seg: 12, n: 1, taper: 0, wob: 0 }); A.log(px + R, R + .2, zE, HX1 - .1, R + .2, zE, R, { seg: 12, n: 1, taper: 0, wob: 0 });
      A.tint(.52, .36, .26); for (const y of [7, 5.2, 3.6]) { const z = pz(y); A.rod(px, y - .03, z, px, y + .03, z, R + .07, 12); } for (const x of [12.6, px - .6]) A.rod(x - .03, R + .2, zE, x + .03, R + .2, zE, R + .07, 12); A.end();
      /* massifs d'ancrage et selles */ A.rbox('ar_plaster', px - 1.25, px + 1.25, 0, 2.3, ZT, ZT + 2.1, { b: .12 }); sol(px - 1.25, px + 1.25, 0, 2.3, ZT, ZT + 2.1, 'concrete', 1); for (const y of [6.1, 4.3]) { const z0 = zLo(y + .45) - .15, z1 = pz(y) + R + .25; A.rbox('ar_plaster', px - R - .28, px + R + .28, y - .45, y + .45, z0, z1, { b: .06 }); sol(px - R - .28, px + R + .28, y - .45, y + .45, z0, z1, 'concrete', 1); } for (const sx of [HX1 + .9, px - 1.4]) { if (sx < HX1 + .5) continue; A.rbox('ar_plaster', sx - .3, sx + .3, 0, .55, zE - .7, zE + .7, { b: .05 }); sol(sx - .3, sx + .3, 0, .55, zE - .7, zE + .7); }
      for (const [a, b] of [[R, .5], [.55, R]]) { sol(HX1, px + R, R + .2 - b, R + .2 + b, zE - a, zE + a, 'metal', 1); sol(px - a, px + a, R + .2 - b, R + .2 + b, ZT + 2.1, zE + R, 'metal', 1); }
      for (let y = 2.3; y < BERM - .6; y += .5) { const z0 = (y <= 2 ? ZT : zLo(y + .5)), z1 = pz(y) + R; sol(px - R - .02, px + R + .02, y, y + .5, Math.min(z0, z1 - .2), z1, 'metal', 0); } } }

  /* ---------- 14. maisons de garde : rez à 12 au-dessus des puits, toit de lauzes ---------- */
  yield;
  for (const sx of [-1, 1]) { const x0 = sx < 0 ? -37.5 : 28.5, x1 = sx < 0 ? -28.5 : 37.5, z0 = .5, z1 = 9, y = TOP, h = 3.4, t = .45, inner = sx < 0 ? x1 : x0, outer = sx < 0 ? x0 : x1;
    const reveal = (ax, c, t, h, y0w) => { A.begin('ar_plaster'); A.tint(.62, .62, .6); const B = (u0, u1, v0, v1) => (ax === 'x' ? A.box(u0, u1, v0, v1, c - t / 2 + .003, c + t / 2 - .003, 0, 'zZ') : A.box(c - t / 2 + .003, c + t / 2 - .003, v0, v1, u0, u1, 0, 'xX')); B(h.a - .015, h.a, h.y0, h.y1); B(h.b, h.b + .015, h.y0, h.y1); B(h.a, h.b, h.y1, h.y1 + .015); if (h.y0 > y0w + .01) B(h.a, h.b, h.y0 - .015, h.y0); A.end(); };
    const W = (ax, c, a, b, holes) => { const sorted = holes.slice().sort((p, q) => p.a - q.a); for (const q of sorted) reveal(ax, c, t, q, y); let u = a; const seg = (p, q, v0, v1) => { if (q - p > .01 && v1 - v0 > .01) ax === 'x' ? sol(p, q, v0, v1, c - t / 2, c + t / 2, 'concrete', 1) : sol(c - t / 2, c + t / 2, v0, v1, p, q, 'concrete', 1); }; for (const q of sorted) { seg(u, q.a, y, y + h); if (q.y0 > y) seg(q.a, q.b, y, q.y0); if (q.y1 < y + h) seg(q.a, q.b, q.y1, y + h); if (!q.door) seg(q.a, q.b, q.y0, q.y1); u = q.b; }/* fenêtres aveugles (MAP QA) */ seg(u, b, y, y + h);
      for (const sd of [-1, 1]) flatWall(A, sd > 0 ? 'ar_ashlar' : 'ar_plaster', ax, c + sd * t / 2, sd, a, b, y, y + h, sorted, sd > 0 ? ASH : [.85, .84, .8], .9); if (ax === 'x') { A.begin('ar_ashlar'); A.tint(...ASH); A.box(a - .003, a + .012, y, y + h, c - t / 2 + .004, c + t / 2 - .004, 0, 'zZ'); A.box(b - .012, b + .003, y, y + h, c - t / 2 + .004, c + t / 2 - .004, 0, 'zZ'); A.end(); }
      for (const q of sorted) if (!q.door) for (const s of [-1, 1]) A.window(ax, c + s * t / 2, s, (q.a + q.b) / 2, q.y0, q.b - q.a, q.y1 - q.y0, { shutter: false, fm: 'ar_wood', mull: 1 });; /* [fin] seuil de pierre dans l'épaisseur du mur (80e : « trou noir rectangulaire » au bord du chemin = seuil sans sol) */ A.begin('ar_ashlar'); A.tint(.8, .79, .76); for (const q of sorted) if (q.door) { if (ax === 'x') A.box(q.a, q.b, q.y0 - .3, q.y0 + .02, c - t / 2 - .04, c + t / 2 + .04, 0, 'y'); else A.box(c - t / 2 - .04, c + t / 2 + .04, q.y0 - .3, q.y0 + .02, q.a, q.b, 0, 'y'); } A.end(); };
    W('x', z0 + t / 2, x0, x1, [{ a: sx < 0 ? -36 : 34.4, b: sx < 0 ? -34.4 : 36, y0: y, y1: y + 2.3, door: true }, { a: sx < 0 ? -31.1 : 29.7, b: sx < 0 ? -29.7 : 31.1, y0: y + 1, y1: y + 2.2 }]);
    W('x', z1 - t / 2, x0, x1, [{ a: (x0 + x1) / 2 - .6, b: (x0 + x1) / 2 + .6, y0: y + 1, y1: y + 2.2 }]);
    W('z', inner + sx * t / 2, z0 + t, z1 - t, [{ a: 2.4, b: 3.6, y0: y + 1, y1: y + 2.2 }, { a: 5.6, b: 6.8, y0: y + 1, y1: y + 2.2 }]);
    W('z', outer - sx * t / 2, z0 + t, z1 - t, [{ a: 6.7, b: 8.3, y0: y, y1: y + 2.3, door: true }, { a: 2.6, b: 3.8, y0: y + 1, y1: y + 2.2 }]);
    /* [fin] plancher découpé au rond autour de la vis (rc8-82, 89e : bord en escalier de mailles de 50 cm, coins noirs entre le carré et le tambour) :
       mailles entières hors d'un rectangle calé sur la grille des planches, puis une couronne de planches du tambour (r = SPR + 0,02) au rectangle, et un chant au bord. */
    const cx = sx * SPX, Rc = SPR + .02, gx0 = x0 + t, gz0 = z0 + t, RX0 = gx0 + Math.floor((cx - Rc - gx0) / .5) * .5, RX1 = Math.min(x1 - t, gx0 + Math.ceil((cx + Rc - gx0) / .5) * .5), RZ0 = gz0 + Math.floor((SPZ - Rc - gz0) / .5) * .5, RZ1 = Math.min(z1 - t, gz0 + Math.ceil((SPZ + Rc - gz0) / .5) * .5);
    A.begin('ar_plank'); A.tint(.62, .56, .48); for (let xx = x0 + t; xx < x1 - t - .01; xx += .5) for (let zz = z0 + t; zz < z1 - t - .01; zz += .5) { if (xx > RX0 - .01 && xx < RX1 - .01 && zz > RZ0 - .01 && zz < RZ1 - .01) continue; A.quad(xx, y + .02, Math.min(z1 - t, zz + .5), Math.min(x1 - t, xx + .5), y + .02, Math.min(z1 - t, zz + .5), Math.min(x1 - t, xx + .5), y + .02, zz, xx, y + .02, zz); }
    { const ang = []; for (let q = 0; q < 48; q++) ang.push(q / 48 * TAU); for (const [ex, ez] of [[RX0, RZ0], [RX1, RZ0], [RX1, RZ1], [RX0, RZ1]]) ang.push((Math.atan2(ez - SPZ, ex - cx) + TAU) % TAU); ang.sort((p, q) => p - q);
      const out = a => { const c = Math.cos(a), sn = Math.sin(a); let tt = 1e9; if (c > 1e-9) tt = Math.min(tt, (RX1 - cx) / c); if (c < -1e-9) tt = Math.min(tt, (RX0 - cx) / c); if (sn > 1e-9) tt = Math.min(tt, (RZ1 - SPZ) / sn); if (sn < -1e-9) tt = Math.min(tt, (RZ0 - SPZ) / sn); return [cx + c * tt, SPZ + sn * tt]; };
      for (let q = 0; q < ang.length; q++) { const a0 = ang[q], a1 = q + 1 < ang.length ? ang[q + 1] : ang[0] + TAU; if (a1 - a0 < 1e-6) continue; const [o0x, o0z] = out(a0), [o1x, o1z] = out(a1), i0x = cx + Math.cos(a0) * Rc, i0z = SPZ + Math.sin(a0) * Rc, i1x = cx + Math.cos(a1) * Rc, i1z = SPZ + Math.sin(a1) * Rc;
        A.quad(i0x, y + .02, i0z, i1x, y + .02, i1z, o1x, y + .02, o1z, o0x, y + .02, o0z); } }
    A.tint(.42, .36, .3); for (let q = 0; q < 48; q++) { const a0 = q / 48 * TAU, a1 = (q + 1) / 48 * TAU, r = Rc - .004; A.quad(cx + Math.cos(a0) * r, y - .08, SPZ + Math.sin(a0) * r, cx + Math.cos(a1) * r, y - .08, SPZ + Math.sin(a1) * r, cx + Math.cos(a1) * r, y + .025, SPZ + Math.sin(a1) * r, cx + Math.cos(a0) * r, y + .025, SPZ + Math.sin(a0) * r); } A.end();
    { const RR = SPR + .4, ex = sx > 0 ? Math.PI * 1.5 : Math.PI * 1.5, ok = a => Math.abs(((a - (Math.PI / 2 - (sx > 0 ? 1 : -1) * .2) + Math.PI) % TAU + TAU) % TAU - Math.PI) > .6; void ex; A.begin('ar_iron'); A.tint(.35); for (let q = 0; q < 20; q++) { const a = q / 20 * TAU, b = (q + 1) / 20 * TAU; if (!ok(a) || !ok(b)) continue; A.rod(cx + Math.cos(a) * RR, y, SPZ + Math.sin(a) * RR, cx + Math.cos(a) * RR, y + 1, SPZ + Math.sin(a) * RR, .02, 4); A.rod(cx + Math.cos(a) * RR, y + 1, SPZ + Math.sin(a) * RR, cx + Math.cos(b) * RR, y + 1, SPZ + Math.sin(b) * RR, .025, 4); const px = cx + Math.cos(a) * RR, pz = SPZ + Math.sin(a) * RR; sol(px - .12, px + .12, y, y + 1.05, pz - .12, pz + .12, 'metal'); } A.end(true); }
    A.roof(x0 - .2, x1 + .2, z0 - .2, z1 + .2, y + h, 'z', { pitch: .62, m: 'ar_shingle', gm: 'ar_ashlar', gt: .85, over: .45 });
    A.begin('ar_plank'); A.tint(.5, .44, .38); A.quad(x0 + t, y + h - .02, z0 + t, x1 - t, y + h - .02, z0 + t, x1 - t, y + h - .02, z1 - t, x0 + t, y + h - .02, z1 - t); A.end(); sol(x0, x1, y + h, y + h + .2, z0, z1);
  }

  /* ---------- 15. tour de prise d'eau et sa passerelle ---------- */
  yield;
  { const cx = 0, cz = -19, R = 4.2, n = 20, pol = []; for (let q = 0; q < n; q++) pol.push([cx + Math.cos(q / n * TAU) * R, cz + Math.sin(q / n * TAU) * R]);
    A.begin('ar_ashlar'); A.tint(.84); A.prism(pol, WFL - .5, TOP); A.end(); k.disc(cx, cz, R, 0, TOP, 'concrete');
    A.begin('ar_plaster'); A.tint(.72); A.prism(pol.map(([x, z]) => [cx + (x - cx) * 1.06, cz + (z - cz) * 1.06]), TOP - .25, TOP + .02); A.end();
    { const g0 = -1.6, g1 = 1.6, h0 = -20.8, h1 = -17.6, y = TOP; for (const [a, b, c, d] of [[g0, g1, h0, h0 + .3], [g0, g1, h1 - .3, h1], [g0, g0 + .3, h0, h1], [g1 - .3, g1, h0, h1]]) { const door = c > -18; A.begin('ar_brick'); A.tint(.9); if (door) { sol(a, -.78, y, y + 2.6, c, d); sol(.78, b, y, y + 2.6, c, d); sol(-.78, .78, y + 2.25, y + 2.6, c, d); A.box(a, -.78, y, y + 2.6, c, d); A.box(.78, b, y, y + 2.6, c, d); A.box(-.78, .78, y + 2.25, y + 2.6, c, d); } else { sol(a, b, y, y + 2.6, c, d); A.box(a, b, y, y + 2.6, c, d); } A.end(); }
      A.roof(g0 - .3, g1 + .3, h0 - .3, h1 + .3, y + 2.6, 'x', { pitch: .5, m: 'ar_shingle', gm: 'ar_brick', gt: .85, over: .3 }); sol(g0, g1, y + 2.6, y + 2.8, h0, h1); }
    A.begin('ar_plaster'); A.tint(.66); const pt = pol.map(([x, z]) => [x, z]); for (let q = 1; q < n - 1; q++) A.tri(pt[0][0], TOP + .015, pt[0][1], pt[q + 1][0], TOP + .015, pt[q + 1][1], pt[q][0], TOP + .015, pt[q][1]); A.end();
    { const RR = R - .1; A.begin('ar_iron'); A.tint(.36); for (let q = 0; q < 28; q++) { const a = q / 28 * TAU, b = (q + 1) / 28 * TAU; if (Math.abs(a - Math.PI / 2) < .32 || Math.abs(b - Math.PI / 2) < .32) continue; A.rod(cx + Math.cos(a) * RR, TOP, cz + Math.sin(a) * RR, cx + Math.cos(a) * RR, TOP + 1, cz + Math.sin(a) * RR, .02, 4); A.rod(cx + Math.cos(a) * RR, TOP + 1, cz + Math.sin(a) * RR, cx + Math.cos(b) * RR, TOP + 1, cz + Math.sin(b) * RR, .025, 4); const mx = cx + Math.cos((a + b) / 2) * RR, mz = cz + Math.sin((a + b) / 2) * RR; sol(mx - .25, mx + .25, TOP, TOP + 1.05, mz - .25, mz + .25, 'metal'); } A.end(true); }
    const z0 = cz + R - .3, z1 = ZU + .02; sol(-1.3, 1.3, TOP - .5, TOP, z0, z1); A.begin('ar_plaster'); A.tint(.72); A.box(-1.3, 1.3, TOP - .5, TOP, z0, z1); A.end();
    for (const px of [-1.25, 1.25]) rail('z', px, z0, z1, TOP);
    A.begin('ar_ashlar'); A.tint(.8); A.box(-.8, .8, WFL - .3, TOP - .5, -11.3, -9.7); A.end(); sol(-.8, .8, 0, TOP - .5, -11.3, -9.7);
  }

  /* ---------- 16. passerelle haute : crête ouest -> butte est, deux piles dans le lit ---------- */
  yield;
  { const zc = 46, w = 1.6, x0 = -35, x1 = 39.8, y = RIDGE;
    sol(x0, x1, y - .3, y, zc - w / 2, zc + w / 2, 'metal'); A.begin('ar_plank'); A.tint(.6, .55, .48); for (let x = x0; x < x1 - .01; x += .9) { A.tint(.6 + .05 * noise2(x * 1.7, 2), .55, .48); A.box(x, Math.min(x1, x + .9), y - .04, y + .025, zc - w / 2 + .05, zc + w / 2 - .05); } A.end();
    A.begin('ar_iron'); A.tint(.38, .4, .42); for (const sd of [-1, 1]) { const zz = zc + sd * w / 2; A.box(x0, x1, y - .55, y - .3, zz - .06, zz + .06); A.box(x0, x1, y + 1.02, y + 1.12, zz - .05, zz + .05); for (let x = x0; x < x1 - .01; x += 2.2) { A.rod(x, y - .3, zz, x, y + 1.05, zz, .04, 4); A.rod(x, y - .3, zz, Math.min(x1, x + 2.2), y + 1.05, zz, .025, 4); } } for (let x = x0; x < x1; x += 2.2) A.box(x - .04, x + .04, y - .55, y - .45, zc - w / 2, zc + w / 2); A.end();
    for (const sd of [-1, 1]) sol(x0, x1, y, y + 1.1, zc + sd * w / 2 - .06, zc + sd * w / 2 + .06, 'metal', 1);
    for (const px of [-14, 13]) { const hw = .95, hl = 1.2, tip = 1.05, poly = (k) => [[px - hw * k, zc - hl], [px, zc - hl - tip * k], [px + hw * k, zc - hl], [px + hw * k, zc + hl], [px, zc + hl + tip * k], [px - hw * k, zc + hl]], top = y - .55;
      A.begin('ar_plaster'); for (const [ya, yb, kk] of [[0, 1.4, .62], [1.4, 4, .78], [4, top - 1.2, .86], [top - 1.2, top, .8]]) { A.tint(kk * .9, kk * .92, kk * (ya < 1.4 ? .82 : .95)); A.prism(poly(yb > top - .5 ? 1 : 1), ya, yb); } A.end();
      A.begin('ar_plaster'); A.tint(.66, .67, .68); A.prism([[px - 1.45, zc - 1.6], [px + 1.45, zc - 1.6], [px + 1.45, zc + 1.6], [px - 1.45, zc + 1.6]], top - .5, top); A.end();
      sol(px - hw, px + hw, 0, top, zc - hl, zc + hl, 'concrete', 1); for (const sg of [-1, 1]) for (const [w, d0, d1] of [[.7, 0, .35], [.42, .35, .7], [.16, .7, 1]]) sol(px - hw * w, px + hw * w, 0, top, sg < 0 ? zc - hl - tip * d1 : zc + hl + tip * d0, sg < 0 ? zc - hl - tip * d0 : zc + hl + tip * d1, 'concrete', 1);
      A.ladder(px + hw + .12, .2, zc, px + hw + .12, top - .6, zc, {}); }
  }

  /* ---------- 17. bâtiments : poste de commande, station de pompage, hangar à bateaux ---------- */
  yield;
  yield* building(C, { x0: 37.5, x1: 50.5, z0: 9.5, z1: 21.5, floors: [SWY, 9, TOP], roof: 15.2, m: 'ar_brick', rgb: [.92, .86, .82],
    doors: { [SWY]: { zp: [44] }, 9: {}, [TOP]: { zn: [43], xp: [12] } }, stairs: [{ x: 48.35, z: 11.45, dir: 'z+' }, { x: 45.7, z: 11.45 + 13 * .42, dir: 'z-' }] }, rail);   /* [fin] (61e) trémies écartées : 1,25 m entre la volée du 9 et le garde-corps (0,45 m avant), 1,09 m le long du mur est (0,84) ; pieds à 0,45 m de plus du mur nord : sans ce recul, la main courante fermait le pied de la volée et la nav des étages était coupée */
  yield* building(C, { x0: 32, x1: 43, z0: -36.5, z1: -26.5, floors: [SHORE], roof: SHORE + 5.4, m: 'ar_plaster', rgb: [.82, .8, .74], doors: { [SHORE]: { xn: [-29], zp: [40.5] } } }, rail);
  yield* building(C, { x0: -43, x1: -34, z0: -30.5, z1: -21.5, floors: [SHORE], roof: SHORE + 4.6, m: 'ar_plank', rgb: [.74, .66, .56], doors: { [SHORE]: { xp: [-26, -23.4], zn: [-38.5] } } }, rail);

  /* ---------- 17b. bosses rocheuses : facettes et lits de strates qui suivent exactement leurs collisions ---------- */
  const { H, at, ISO } = C, bnd = (cx, cz, th, thr, sz = 1.15, rmax = 9) => { let r = 0; for (;;) { const c = at(cx + Math.cos(th) * (r + .05), cz + Math.sin(th) * (r + .05) / sz); if (r >= rmax || H[c] < thr - .01 || !(ISO[c] || (sz === 1 && C.T[c] === 0))) break; r += .05; } return r; }, smooth = (a, k = 2) => { let b = a.slice(); for (let it = 0; it < k; it++) b = b.map((v, i) => (b[(i + b.length - 1) % b.length] + 2 * v + b[(i + 1) % b.length]) / 4); return b.map((v, i) => Math.min(v, a[i] + .06, Math.max(a[(i + b.length - 1) % b.length], a[(i + 1) % b.length]) + .06)); };
  const facet = (cx, cz, base, seed) => { const NA = 28, th = []; for (let a = 0; a < NA; a++) th.push((a + .25 * (noise2(a * 1.3, seed) - .5)) / NA * TAU);
    const seen = new Set(); for (let a = 0; a < 24; a++) for (let r = 0; r < 8; r += .2) { const v = H[at(cx + Math.cos(a / 24 * TAU) * r, cz + Math.sin(a / 24 * TAU) * r / 1.15)]; if (v <= base + .05) break; seen.add(v); } const lvl = [...seen].sort((p, q) => p - q);
    if (!lvl.length) return; const R = lvl.map(v => smooth(th.map(t => bnd(cx, cz, t, v)))); /* corniches : retrait de 6 cm, légère pente vers l'extérieur */
    A.begin('ar_rock'); let prevY = base - .12, prevR = R[0].map(v => v - .1);
    for (let q = 0; q < lvl.length; q++) { const yv = lvl[q], rr = R[q], tn = (fl) => { const cc = C.rockCol(cx, yv, cz), v = (fl ? 1.14 : .84) * (.9 + .2 * noise2(q, seed)); A.tint(cc[0] * v, cc[1] * v, cc[2] * v); };
      for (let a = 0; a < NA; a++) { const b = (a + 1) % NA, P = (t, r, y) => [cx + Math.cos(t) * r, y, cz + Math.sin(t) * r / 1.15]; tn(0); A.quad(...P(th[a], prevR[a], prevY), ...P(th[b], prevR[b], prevY), ...P(th[b], rr[b] - .06, yv - .1), ...P(th[a], rr[a] - .06, yv - .1));
        const nx = q + 1 < lvl.length ? R[q + 1] : null; tn(1); if (nx) A.quad(...P(th[a], rr[a] - .1, yv - .1), ...P(th[b], rr[b] - .1, yv - .1), ...P(th[b], nx[b] - .02, yv), ...P(th[a], nx[a] - .02, yv)); else { A.tri(...P(th[a], rr[a] - .1, yv - .1), ...P(th[b], rr[b] - .1, yv - .1), cx, yv + .04, cz); } }
      if (q + 1 < lvl.length) { prevY = yv; prevR = R[q + 1].map(v => v - .02); } }
    /* fond fermé (le volume est plein pour l'audit) */ for (let a = 0; a < NA; a++) { const b = (a + 1) % NA; A.tri(cx + Math.cos(th[a]) * (R[0][a] - .1), base - .12, cz + Math.sin(th[a]) * (R[0][a] - .1) / 1.15, cx + Math.cos(th[b]) * (R[0][b] - .1), base - .12, cz + Math.sin(th[b]) * (R[0][b] - .1) / 1.15, cx, base - .12, cz); } A.end(); };
  void facet;


  /* ---------- 17c. pins sur les plateaux, la crête et la butte ; éboulis au pied des parois ---------- */
  { const { T, BLD } = C, PROPS = [[-49, 15, 3], [-49, 24, 3], [-56, 48, 3], [-50, -14.5, 4], [-60, 58, 4], [-46, -12, 3], [52, -16, 4], [57, 46, 4], [60, 35, 3], [60, -30, 3.5], [-52, 36, 3], [-50, 6, 4], [50, -9, 4], [51, 2, 3.5], [-29.3, -2, 2]], free = (x, z, r) => { if (PROPS.some(p => Math.hypot(p[0] - x, p[1] - z) < p[2] + r)) return false; for (let a = -r; a <= r; a += .5) for (let b = -r; b <= r; b += .5) { const c = at(x + a, z + b); if (T[c] !== 0 || BLD[c] || C.GM[c] === 7) return false; } return true; }, sp = k.spawns, far = (x, z, d) => sp.every(p => Math.hypot(p[0] - x, p[1] - z) > d);
    let nP = 0, nB = 0; const rS = A.r; let sd = 1234567; A.r = () => (sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648; const BUSH = [];
    for (let gz = -64; gz <= 64; gz += 13) for (let gx = -64; gx <= 64; gx += 13) { const cx = gx + (noise2(gx * .3, gz * .3) - .5) * 9, cz = gz + (noise2(gz * .3 + 5, gx * .3) - .5) * 9; if (Math.abs(cx) < 25 || noise2(cx * .07 + 2, cz * .07) < .36) continue;
      const nT = 2 + Math.floor(noise2(cx * .5, cz * .5) * 4.99); for (let q = 0; q < nT; q++) { const a = q * 2.4 + noise2(cx, cz) * 6, rr = q ? 1.5 + q * .8 + noise2(q * 3.1, cx) * 1.2 : 0, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr, c = at(x, z), y = H[c]; if (!(y === TOP || y === RIDGE)) continue; if (!free(x, z, 1.4) || !far(x, z, 4)) continue; if (Math.abs(z + 3.3) < 5 && Math.abs(x) < 50) continue; A.pine(x, z, y, .76 + .42 * noise2(x * 1.3, z * 1.3), y, true); nP++; }
      for (let q = 0; q < 3; q++) { const a = q * 2.1 + 1 + noise2(cz, cx) * 3, rr = 4.2 + q * 1.2; BUSH.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); } }
    for (const o of C.ISL) if (o[4] === TOP) for (let q = 0; q < 3; q++) BUSH.push([o[0] + Math.cos(q * 2.2 + o[1]) * (o[2] + 1.1), o[1] + Math.sin(q * 2.2 + o[0]) * (o[3] + 1.1)]);
    for (const [x, z] of BUSH) { const c = at(x, z), y = H[c]; if (!(y === TOP || y === RIDGE) || !free(x, z, 1.1) || !far(x, z, 2.5)) continue; const s2 = .5 + .3 * noise2(x * 2, z * 2); const tS = A.tint, g = noise2(x * .7, z * .7); A.tint = function (v) { return tS.call(this, v * (.5 + .12 * g), v * (.62 + .06 * g), v * (.36 + .04 * g)); }; A.boulder(x, z, s2, { y, sx: 1.1 + .35 * noise2(x * 3, z), tone: .8 + .2 * noise2(x, z), m: 'ar_gravel' }); A.tint = tS; nB++; } { const [KX, KZ, , kOut] = C.KNOLL; for (const [a, s0] of [[1.05, 1.45], [1.25, .95], [1.7, 1.2], [2.3, 1.5], [2.5, 1], [2.85, 1.15], [3.55, 1.45], [3.75, .9], [4.25, 1.3], [4.95, 1.5], [5.15, 1], [5.45, 1.1]]) { const s3 = s0 * (.92 + .16 * noise2(a * 3, 1)), rr = kOut(a) - .35 * s3, x = KX + Math.cos(a) * rr, z = KZ + Math.sin(a) * rr; let ok = true; for (let u = -s3 * 1.6; u <= s3 * 1.6 && ok; u += .5) for (let v = -s3 * 1.2; v <= s3 * 1.2; v += .5) { const c = at(x + u, z + v); if (C.BLD[c] || T[c] === 3 || H[c] > RIDGE + .1) { ok = false; break; } } if (!ok) continue; A.boulder(x, z, s3, { y: SWY, sx: 1.25 + .3 * noise2(a, 2), tone: .7 + .12 * noise2(a, 5), m: 'ar_rock' }); } }
    A.r = rS;   /* broussailles : touffes basses à facettes (genévriers), collisions ajustées comme les blocs */
    /* éboulis au pied des parois du lit, côté lit : blocs arrondis, jamais dans un passage étroit */
    for (let z = 16; z < 68; z += 3.1) for (const sd of [-1, 1]) { const zz = z + (noise2(z, sd) - .5) * 2; let x = C.xRiv(zz) + sd * (C.wRiv(zz) - .6); for (let q = 0; q < 8 && T[at(x, zz)] !== 0; q++) x -= sd * .4; if (T[at(x, zz)] !== 0 || H[at(x, zz)] !== 0 || noise2(z * .4, sd * 3) < .35) continue; if (Math.abs(zz - 30) < 3 || Math.abs(zz - 57) < 3 || Math.abs(zz - 29) < 3 || Math.abs(zz - 60) < 3 || Math.abs(zz - 46) < 2.5) continue; const q = A.rnd(.5, 1.1); A.boulder(x, zz, q, { y: 0, sx: A.rnd(1.1, 1.5), tone: A.rnd(.5, .66), m: 'ar_rock' }); } }

  /* ---------- 18. escaliers entre les niveaux ---------- */
  yield;
  for (const f of C.FL) { A.stairs(f.x, f.z, f.w, f.dir, f.y0, f.y1 + .012, { walls: false, rail: f.o.rail, m: f.o.m || 'ar_plaster' });
    const [x0, x1, z0, z1] = f.ax === 'x' ? [f.lo, f.hi, f.z - f.w / 2, f.z + f.w / 2] : [f.x - f.w / 2, f.x + f.w / 2, f.lo, f.hi];
    /* [fin] volée suspendue (93e, 96e : dessous ouvert, deux poteaux noirs qui ne touchent rien) : la volée est un bloc plein (ses collisions vont jusqu'à y0) ;
       son dessous est fermé là où le sol est plus bas, et une pile de béton la porte à mi-portée, du sol jusqu'au dessous. */
    if (f.o.hang) { const mid = (f.lo + f.hi) / 2; let low = false; for (let u = f.lo + .2; u < f.hi; u += .5) { const px = f.ax === 'x' ? u : f.x, pz = f.ax === 'x' ? f.z : u; if (C.H[C.at(px, pz)] < f.y0 - .3) low = true; }
      if (low) { A.begin(f.o.m || 'ar_plaster'); A.tint(.6); A.quad(x0, f.y0 - .004, z0, x1, f.y0 - .004, z0, x1, f.y0 - .004, z1, x0, f.y0 - .004, z1); A.end(); }
      const px = f.ax === 'x' ? mid : f.x, pz = f.ax === 'x' ? f.z : mid; let gy = f.y0; for (const [dx, dz] of [[0, 0], [-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) gy = Math.min(gy, C.H[C.at(px + dx, pz + dz)]);
      if (gy < f.y0 - .5) { const [a0, a1, b0, b1] = f.ax === 'x' ? [mid - .28, mid + .28, f.z - f.w / 2 + .12, f.z + f.w / 2 - .12] : [f.x - f.w / 2 + .12, f.x + f.w / 2 - .12, mid - .28, mid + .28]; A.begin('ar_plaster'); A.tint(.7, .71, .72); A.box(a0, a1, gy - .3, f.y0, b0, b1, 0, 'Y'); A.tint(.6); A.box(a0 - .06, a1 + .06, f.y0 - .3, f.y0, b0 - .06, b1 + .06, 0, 'Y'); A.end(); sol(a0, a1, gy, f.y0, b0, b1, 'concrete', 1); } }
    else if (f.y0 > .01) { A.begin('ar_plaster'); A.tint(.66); A.box(x0, x1, 0, f.y0, z0, z1, 0, 'Y'); A.end(); sol(x0, x1, 0, f.y0, z0, z1, 'concrete', 0); }
    /* [rsfix] stamp() arrondit l'emprise vers l'extérieur ([stairs2]) : les cellules du bord, à peine entamées par la volée, n'ont plus de terrain ; il restait une bande de 0,1 à 0,4 m
       entre la volée et la paroi, sans sol ni dessus (trou jusqu'au plan du sol, vu du plateau). Comblée : gradins au niveau des marches sur les côtés, paliers aux deux bouts, avec collision.
       Aucun tirage aléatoire. */
    if (!f.o.hang) { const fl = v => Math.floor((v + S) / G + 1e-6) * G - S, ce = v => Math.ceil((v + S) / G - 1e-6) * G - S, X0 = fl(x0), X1 = ce(x1), Z0 = fl(z0), Z1 = ce(z1);
      const nD = Math.ceil((f.y1 + .012 - f.y0) / .24 - 1e-6), rD = (f.y1 + .012 - f.y0) / nD, sg = f.dir[1] === '+' ? 1 : -1, a = f.ax === 'x' ? f.x : f.z, L0 = f.ax === 'x' ? X0 : Z0, L1 = f.ax === 'x' ? X1 : Z1, cross = f.ax === 'x' ? [[Z0, z0], [z1, Z1]] : [[X0, x0], [x1, X1]];
      const B3 = (u0, u1, c0, c1, y) => { if (u1 - u0 < .005 || c1 - c0 < .005) return; y = Math.max(y, .02); const [bx0, bx1, bz0, bz1] = f.ax === 'x' ? [u0, u1, c0, c1] : [c0, c1, u0, u1]; A.box(bx0, bx1, 0, y, bz0, bz1, 0, ''); sol(bx0, bx1, 0, y, bz0, bz1, 'concrete', 0); };
      A.begin(f.o.m || 'ar_plaster'); A.tint(.74);
      for (let i = 0; i < nD; i++) { const p0 = a + sg * i * .42, p1 = a + sg * (i + 1) * .42, lo = Math.max(L0 - .01, Math.min(p0, p1)), hi = Math.min(L1 + .01, Math.max(p0, p1));   /* 1 cm dans la paroi du bout : pas de face confondue avec elle */ for (const [c0, c1] of cross) B3(lo, hi, c0, c1, f.y0 + rD * (i + 1)); }
      const e = a + sg * nD * .42, flo = Math.min(a, e), fhi = Math.max(a, e), cA = f.ax === 'x' ? [Z0, Z1] : [X0, X1];
      if (sg > 0) { B3(L0, flo, cA[0], cA[1], f.y0); B3(fhi, L1, cA[0], cA[1], f.y1); } else { B3(fhi, L1, cA[0], cA[1], f.y0); B3(L0, flo, cA[0], cA[1], f.y1); }
      A.end(); } }
  for (const p of C.PADS) { A.landing(p.x0, p.x1, p.z0, p.z1, p.y, { y0: p.o.hang ? p.y - .4 : 0, m: 'ar_plaster' }); if (p.o.rails) { rail('z', p.x0 + .05, p.z0, p.z1, p.y); rail('z', p.x1 - .05, p.z0, p.z1, p.y); } }

  /* ---------- 19. occupation militaire, poste électrique, mobilier ---------- */
  yield* dress(C, rail);

  /* lampes : boîtiers émissifs */
  for (const l of LAMPS) { const ceil = l[5] ?? l[1] + .06; A.begin('lampA'); A.box(l[0] - .12, l[0] + .12, l[1] - .06, l[1] + .06, l[2] - .08, l[2] + .08); A.end(); if (ceil > l[1] + .07) { A.begin('ar_iron'); A.tint(.28); A.box(l[0] - .025, l[0] + .025, l[1] + .06, ceil, l[2] - .025, l[2] + .025); A.end(true); } }
}

/** Bâtiment rectangulaire à niveaux : murs percés (portes, fenêtres), dalles, escaliers droits intérieurs (un par niveau), toit plat à acrotère. */
function* building(C, o, rail) {
  const { A, sol } = C, { x0, x1, z0, z1, floors, roof, m, rgb } = o, t = .36, fl = floors.concat([roof]);
  for (let f = 0; f < floors.length; f++) { const y = fl[f], y1 = fl[f + 1], d = (o.doors && o.doors[y]) || {};
    const holes = (side, a, b) => { const hs = []; for (const c of d[side] || []) hs.push({ a: c - .78, b: c + .78, y0: y, y1: y + 2.3, door: true }); for (let c = a + 1.5; c < b - 1; c += 2.7) if (hs.every(h => c + .75 < h.a || c - .75 > h.b)) hs.push({ a: c - .55, b: c + .55, y0: y + 1.05, y1: Math.min(y1 - .55, y + 2.25) }); return hs; };
    const reveal = (ax, c, t, h, y0w) => { A.begin('ar_plaster'); A.tint(.62, .62, .6); const B = (u0, u1, v0, v1) => (ax === 'x' ? A.box(u0, u1, v0, v1, c - t / 2 + .003, c + t / 2 - .003, 0, 'zZ') : A.box(c - t / 2 + .003, c + t / 2 - .003, v0, v1, u0, u1, 0, 'xX')); B(h.a - .015, h.a, h.y0, h.y1); B(h.b, h.b + .015, h.y0, h.y1); B(h.a, h.b, h.y1, h.y1 + .015); if (h.y0 > y0w + .01) B(h.a, h.b, h.y0 - .015, h.y0); A.end(); };
    /* [fin] out : côté extérieur du mur. Le parement `m` (brique du poste de commande…) allait toujours du côté +x/+z : deux façades en enduit dehors,
       deux murs de brique dedans. Dehors : m ; dedans : enduit (planches pour un bâtiment en planches). */
    const W = (ax, c, a, b, hs, out = 1) => { const sorted = hs.slice().sort((p, q) => p.a - q.a); for (const q of sorted) reveal(ax, c, t, q, y); let u = a; const seg = (p, q, v0, v1) => { if (q - p > .01 && v1 - v0 > .01) ax === 'x' ? sol(p, q, v0, v1, c - t / 2, c + t / 2, 'concrete', 1) : sol(c - t / 2, c + t / 2, v0, v1, p, q, 'concrete', 1); }; for (const q of sorted) { seg(u, q.a, y, y1); if (q.y0 > y) seg(q.a, q.b, y, q.y0); if (q.y1 < y1) seg(q.a, q.b, q.y1, y1); if (!q.door) seg(q.a, q.b, q.y0, q.y1); u = q.b; }/* fenêtres aveugles (MAP QA) */ seg(u, b, y, y1);
      const yt = f < floors.length - 1 ? y1 + .012 : y1; for (const sd of [-1, 1]) { const ext = sd === out; flatWall(A, ext ? m : (m === 'ar_plank' ? m : 'ar_plaster'), ax, c + sd * t / 2, sd, a, b, y, yt, sorted, ext || m === 'ar_plank' ? rgb : [.86, .85, .82], ext ? .95 : .82); } if (ax === 'x') { A.begin(m); A.tint(...rgb); A.box(a - .003, a + .012, y, yt, c - t / 2 + .004, c + t / 2 - .004, 0, 'zZ'); A.box(b - .012, b + .003, y, yt, c - t / 2 + .004, c + t / 2 - .004, 0, 'zZ'); A.end(); }
      for (const q of sorted) if (!q.door) for (const s of [-1, 1]) A.window(ax, c + s * t / 2, s, (q.a + q.b) / 2, q.y0, q.b - q.a, q.y1 - q.y0, { shutter: false, fm: 'ar_wood' });; /* [fin] seuil de pierre dans l'épaisseur du mur (80e : « trou noir rectangulaire » au bord du chemin = seuil sans sol) */ A.begin('ar_ashlar'); A.tint(.8, .79, .76); for (const q of sorted) if (q.door) { if (ax === 'x') A.box(q.a, q.b, q.y0 - .3, q.y0 + .02, c - t / 2 - .04, c + t / 2 + .04, 0, 'y'); else A.box(c - t / 2 - .04, c + t / 2 + .04, q.y0 - .3, q.y0 + .02, q.a, q.b, 0, 'y'); } A.end(); };
    W('x', z0 + t / 2, x0, x1, holes('zn', x0, x1), -1); W('x', z1 - t / 2, x0, x1, holes('zp', x0, x1), 1); W('z', x0 + t / 2, z0 + t, z1 - t, holes('xn', z0, z1), -1); W('z', x1 - t / 2, z0 + t, z1 - t, holes('xp', z0, z1), 1);
    /* dalle au-dessus, percée pour l'escalier de ce niveau */
    const st = o.stairs && o.stairs[f] && f < floors.length - 1 ? o.stairs[f] : null, run = st ? Math.ceil((y1 - y) / .24 - 1e-6) * .42 : 0, zA = st ? Math.min(st.z, st.dir === 'z+' ? st.z + run : st.z - run) : 0, holeS = st ? [st.x - .7, st.x + .7, zA, zA + run] : null;
    const slab = (a, b, c, dd) => { if (b - a > .02 && dd - c > .02) { sol(a, b, y1 - .25, y1, c, dd, 'concrete'); A.begin('ar_plaster'); A.tint(.62); A.quad(a, y1 - .25, c, b, y1 - .25, c, b, y1 - .25, dd, a, y1 - .25, dd); A.end(); if (f < floors.length - 1) { A.begin('ar_plank'); A.tint(.6, .54, .46); A.quad(a, y1 + .01, dd, b, y1 + .01, dd, b, y1 + .01, c, a, y1 + .01, c); A.end(); } } };
    if (holeS) { A.begin('ar_plaster'); A.tint(.6); const [h0, h1, h2, h3] = holeS, yb = y1 - .25; A.quad(h0, y1, h2, h0, y1, h3, h0, yb, h3, h0, yb, h2); A.quad(h1, y1, h3, h1, y1, h2, h1, yb, h2, h1, yb, h3); A.quad(h1, y1, h2, h0, y1, h2, h0, yb, h2, h1, yb, h2); A.quad(h0, y1, h3, h1, y1, h3, h1, yb, h3, h0, yb, h3); A.end(); slab(x0 + t, holeS[0], z0 + t, z1 - t); slab(holeS[1], x1 - t, z0 + t, z1 - t); slab(holeS[0], holeS[1], z0 + t, holeS[2]); slab(holeS[0], holeS[1], holeS[3], z1 - t); A.stairs(st.x, st.z, 1.4, st.dir, y, y1, { walls: false, rail: st.x > (x0 + x1) / 2 ? -1 : 1, m: 'ar_plaster' }); const edge = st.dir === 'z+' ? holeS[2] : holeS[3]; rail('x', st.dir === 'z+' ? edge + .05 : edge - .05, holeS[0], holeS[1], y1); rail('z', holeS[0] + .05, holeS[2], holeS[3] - (st.dir === 'z+' ? 1.2 : 0), y1); }
    else slab(x0 + t, x1 - t, z0 + t, z1 - t);
    if (f === 0) { A.begin('ar_plank'); A.tint(.56, .5, .43); A.quad(x0 + t, y + .015, z1 - t, x1 - t, y + .015, z1 - t, x1 - t, y + .015, z0 + t, x0 + t, y + .015, z0 + t); A.end(); }
    yield; }
  A.parapet('x', z0 + .1, x0, x1, roof, .7, .2, { m }); A.parapet('x', z1 - .1, x0, x1, roof, .7, .2, { m }); A.parapet('z', x0 + .1, z0, z1, roof, .7, .2, { m }); A.parapet('z', x1 - .1, z0, z1, roof, .7, .2, { m });
  sol(x0, x1, roof, roof + .75, z0, z0 + .2); sol(x0, x1, roof, roof + .75, z1 - .2, z1); sol(x0, x0 + .2, roof, roof + .75, z0, z1); sol(x1 - .2, x1, roof, roof + .75, z0, z1);
  A.begin('ar_gravel'); A.tint(.55); A.quad(x0, roof + .01, z1, x1, roof + .01, z1, x1, roof + .01, z0, x0, roof + .01, z0); A.end();
}

export const BARRAGE_ENV = {
  gorge: { as: 'valley', gt: 'desert', sky: [[0, '#4b6f93'], [.28, '#8aa6bf'], [.45, '#cbd5dc'], [.5, '#dde1de'], [.53, '#7e8274'], [1, '#4c5046']], halo: '238,236,226', clouds: 300, cloudDark: '104,114,128', cloudLight: '238,242,246', sun: [34, 40, -26], sunCol: 0xffd9a8, sunI: 3.1, hemi: [0xaec0d2, 0x4a4b40, .64], fog: [0xa4b3bf, .0034], exp: .58, envI: .55, ground: '#666a52', gsurf: 'sand', part: { n: 50, col: 0xe8eef0, size: .03, op: .26, mode: 'dust' } },
};

/** Branche la carte sur maps.js (import dynamique depuis main.js : un échec ne touche pas les autres cartes). list=false : tests sans entrée de menu. */
export function install(M, list = true) {
  M.registerMap({ id: 'barrage', build: () => buildBarrage(M.Kit), steps: () => barrageSteps(M.Kit), env: BARRAGE_ENV, mats: archMaterial, meta: list ? { id: 'barrage', name: 'Barrage d’Aiguenoire', desc: 'Barrage-poids au fond d’une gorge, occupé par l’armée : couronnement, galeries et usine dans le barrage, retenue, lit de la rivière, poste électrique et passerelle haute.', env: 'gorge' } : null });
}

/** Habillage : sacs de sable, barbelés, tentes, conteneurs, mirador, portique du couronnement, réverbères ; poste électrique (transformateurs, murs pare-feu, portiques, pylône) ; pompes, ponton, barques. */
function* dress(C, rail) {
  const { A, sol, k } = C, P2 = (ax, u, w) => (ax === 'x' ? [u, w] : [w, u]);
  /* mur de sacs de sable : assises décalées, sacs bombés ; collision pleine */
  const bags = (ax, c, u0, u1, y, h = 1.1, t = .62) => { A.begin('ar_cloth'); const nr = Math.round(h / .16); for (let r = 0; r < nr; r++) { const y0 = y + r * h / nr, y1 = y0 + h / nr + .01, off = (r % 2) * .3; for (let u = u0 - off; u < u1 - .05; u += .6) { const a = Math.max(u0, u + .01), b = Math.min(u1, u + .59); if (b - a < .12) continue; const v = .36 + .08 * noise2(u * 3.1, r * 1.7 + c); A.tint(v * 1.12, v, v * .72); const [x0, z0] = P2(ax, a, c - t / 2), [x1, z1] = P2(ax, b, c + t / 2); A.box(Math.min(x0, x1), Math.max(x0, x1), y0, y1, Math.min(z0, z1), Math.max(z0, z1), .03); } } A.end(); const [x0, z0] = P2(ax, u0, c - t / 2), [x1, z1] = P2(ax, u1, c + t / 2); sol(Math.min(x0, x1), Math.max(x0, x1), y, y + h + .06, Math.min(z0, z1), Math.max(z0, z1), 'sand', 1); };
  /* barbelé en accordéon (décor sur un chaperon ou un mur) */
  const wire = (ax, c, u0, u1, y, R = .3) => { A.begin('ar_iron'); A.tint(.34, .33, .31); const n = Math.max(8, Math.round((u1 - u0) / .12)); let px = null; for (let i = 0; i <= n; i++) { const u = u0 + (u1 - u0) * i / n, a = i * 1.15, w = c + Math.cos(a) * R, yy = y + R + Math.sin(a) * R, [x, z] = P2(ax, u, w); if (px) A.rod(px[0], px[1], px[2], x, yy, z, .008, 3); px = [x, yy, z]; } A.end(true); };
  /* tente de toile à murs droits (fermée, pleine) */
  const tent = (x, z, ax, y, L = 4.4, W = 3.2) => { const [hx, hz] = ax === 'x' ? [L / 2, W / 2] : [W / 2, L / 2], hw = 1.25, hr = 2.3; A.begin('ar_cloth'); A.tint(.42, .45, .32); A.box(x - hx, x + hx, y, y + hw, z - hz, z + hz, .02, 'Y'); if (ax === 'x') { A.quad(x - hx - .1, y + hw - .05, z + hz + .1, x + hx + .1, y + hw - .05, z + hz + .1, x + hx + .1, y + hr, z, x - hx - .1, y + hr, z); A.quad(x + hx + .1, y + hw - .05, z - hz - .1, x - hx - .1, y + hw - .05, z - hz - .1, x - hx - .1, y + hr, z, x + hx + .1, y + hr, z); for (const sx of [-1, 1]) { const xx = x + sx * hx; sx > 0 ? A.tri(xx, y + hw - .05, z - hz, xx, y + hr, z, xx, y + hw - .05, z + hz) : A.tri(xx, y + hw - .05, z + hz, xx, y + hr, z, xx, y + hw - .05, z - hz); } } else { A.quad(x, y + hr, z - hz - .1, x, y + hr, z + hz + .1, x + hx + .1, y + hw - .05, z + hz + .1, x + hx + .1, y + hw - .05, z - hz - .1); A.quad(x, y + hr, z + hz + .1, x, y + hr, z - hz - .1, x - hx - .1, y + hw - .05, z - hz - .1, x - hx - .1, y + hw - .05, z + hz + .1); for (const sz of [-1, 1]) { const zz = z + sz * hz; sz > 0 ? A.tri(x + hx, y + hw - .05, zz, x, y + hr, zz, x - hx, y + hw - .05, zz) : A.tri(x - hx, y + hw - .05, zz, x, y + hr, zz, x + hx, y + hw - .05, zz); } } A.tint(.3, .32, .24); /* rabat de porte sous le toit (il sortait par le pan, MAP QA) */ax === 'x' ? A.box(x - .4, x + .4, y, y + hw - .05, z + hz, z + hz + .02) : A.box(x + hx, x + hx + .02, y, y + hw - .05, z - .4, z + .4); A.end(); sol(x - hx, x + hx, y, y + hw + .3, z - hz, z + hz, 'sand', 1); sol(x - hx * (ax === 'x' ? 1 : .55), x + hx * (ax === 'x' ? 1 : .55), y + hw + .3, y + hr - .3, z - hz * (ax === 'x' ? .55 : 1), z + hz * (ax === 'x' ? .55 : 1), 'sand'); };
  /* conteneur de tôle */
  const box20 = (x, z, ax, y, col) => { const [hx, hz] = ax === 'x' ? [3.05, 1.22] : [1.22, 3.05], h = 2.6; A.begin('ar_tin'); A.tint(...col); A.box(x - hx, x + hx, y, y + h, z - hz, z + hz); A.end(); A.begin('ar_iron'); A.tint(col[0] * .7, col[1] * .7, col[2] * .7); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.box(x + sx * hx - (sx > 0 ? .12 : .015), x + sx * hx + (sx < 0 ? .12 : .015), y + .01, y + h + .02, z + sz * hz - (sz > 0 ? .12 : .015), z + sz * hz + (sz < 0 ? .12 : .015));
    /* [fin] longerons haut et bas, portes au bout (barres de fermeture, poignées, charnières) : on lisait des tôles plantées seules (rc8-88) */
    const L = ax === 'x' ? hx : hz, W2 = ax === 'x' ? hz : hx, B2 = (u0, u1, y0, y1, w0, w1) => (ax === 'x' ? A.box(x + u0, x + u1, y0, y1, z + w0, z + w1) : A.box(x + w0, x + w1, y0, y1, z + u0, z + u1));
    for (const sw of [-1, 1]) { const w0 = sw * W2 - (sw > 0 ? 0 : .03), w1 = sw * W2 + (sw > 0 ? .03 : 0); B2(-L + .1, L - .1, y + h - .16, y + h, w0, w1); B2(-L + .1, L - .1, y, y + .18, w0, w1); }
    B2(L, L + .03, y, y + .2, -W2 + .1, W2 - .1); B2(L, L + .03, y + h - .2, y + h, -W2 + .1, W2 - .1); A.tint(col[0] * .45, col[1] * .45, col[2] * .45); B2(L, L + .035, y + .2, y + h - .2, -.008, .008);
    A.tint(col[0] * .8, col[1] * .8, col[2] * .8); for (const w of [-.8, -.35, .35, .8]) { const wc = w * W2 / 1.22; B2(L + .03, L + .07, y + .2, y + h - .2, wc - .022, wc + .022); B2(L + .03, L + .1, y + 1.05, y + 1.3, wc - .03, wc + .03); for (const yy of [y + .26, y + h - .3]) B2(L + .03, L + .08, yy, yy + .07, wc - .05, wc + .05); }
    for (const sw of [-1, 1]) for (const yy of [y + .45, y + 1.25, y + 2.05]) B2(L + .02, L + .06, yy, yy + .14, sw * (W2 - .04) - .04, sw * (W2 - .04) + .04);
    A.end(); sol(x - hx, x + hx, y, y + h, z - hz, z + hz, 'metal', 1); };
  /* mirador de rondins : quatre jambes, plate-forme et toit (hors d'atteinte) */
  const tower = (x, z, y) => { A.begin('ar_wood'); A.tint(.44, .36, .28); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { A.log(x + sx * 1.3, y, z + sz * 1.3, x + sx * 1.05, y + 6.4, z + sz * 1.05, .12, { seg: 6, n: 1 }); k.disc(x + sx * 1.25, z + sz * 1.25, .14, y, y + 4.6, 'wood'); } for (const h of [3.6]) for (const [a, b] of [[[-1.25, -1.25], [1.25, -1.25]], [[-1.25, 1.25], [1.25, 1.25]], [[-1.25, -1.25], [-1.25, 1.25]], [[1.25, -1.25], [1.25, 1.25]]]) A.log(x + a[0], y + h, z + a[1], x + b[0], y + h + .9, z + b[1], .06, { seg: 5, n: 1 }); A.end(); A.begin('ar_plank'); A.tint(.6, .54, .46); A.box(x - 1.6, x + 1.6, y + 4.6, y + 4.8, z - 1.6, z + 1.6); for (const sd of [-1, 1]) { A.box(x - 1.6, x + 1.6, y + 4.8, y + 5.8, z + sd * 1.6 - .04, z + sd * 1.6 + .04); A.box(x + sd * 1.6 - .04, x + sd * 1.6 + .04, y + 4.8, y + 5.8, z - 1.6, z + 1.6); } A.end(); A.begin('ar_tin'); A.tint(.6); A.quad(x - 1.9, y + 7.1, z + 1.9, x + 1.9, y + 7.1, z + 1.9, x + 1.9, y + 7.5, z - 1.9, x - 1.9, y + 7.5, z - 1.9); A.tint(.36); A.quad(x - 1.9, y + 7.47, z - 1.9, x + 1.9, y + 7.47, z - 1.9, x + 1.9, y + 7.07, z + 1.9, x - 1.9, y + 7.07, z + 1.9); A.end(); A.begin('ar_wood'); A.tint(.4); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.rod(x + sx * 1.5, y + 4.8, z + sz * 1.5, x + sx * 1.5, y + 7.2, z + sz * 1.5, .05, 5); A.end(); sol(x - 1.6, x + 1.6, y + 4.6, y + 5.8, z - 1.6, z + 1.6, 'wood'); A.ladder(x - .4, y, z + 1.75, x - .4, y + 4.7, z + 1.62, {}); sol(x - .7, x - .1, y, y + 4.7, z + 1.55, z + 1.85, 'wood'); };
  /* réverbère sur le parapet aval */
  const lamp = (x, z, y) => { A.begin('ar_iron'); A.tint(.3, .31, .32); A.rod(x, y, z, x, y + 4.2, z, .06, 6); A.rod(x, y + 4.1, z, x, y + 4.4, z - .7, .035, 4); A.end(); A.begin('lampA'); A.box(x - .16, x + .16, y + 4.22, y + 4.32, z - .86, z - .6); A.end(); k.disc(x, z, .08, y, y + 4.2, 'metal'); };

  /* couronnement : nids de sacs de sable aux deux bouts, barbelé sur le parapet amont, portique roulant, réverbères */
  bags('x', -4.9, -25, -21.4, TOP); bags('z', -21.1, -4.9, -3.8, TOP); bags('x', -1.75, 21.4, 25, TOP); bags('z', 21.1, -2.85, -1.75, TOP);
  wire('x', ZU + .22, -20, -2, TOP + 1.05, .22); wire('x', ZU + .22, 2, 20, TOP + 1.05, .22);
  { const gx = 9, l0 = ZU + .55, l1 = ZC - .55; A.begin('ar_iron'); A.tint(.72, .58, .18); for (const lz of [l0, l1]) { for (const sx of [-1, 1]) A.box(gx + sx * 1.6 - .22, gx + sx * 1.6 + .22, TOP, TOP + 6.6, lz - .22, lz + .22); A.box(gx - 2.2, gx + 2.2, TOP, TOP + .5, lz - .35, lz + .35); A.box(gx - 1.6, gx + 1.6, TOP + 3.2, TOP + 3.4, lz - .12, lz + .12); } A.box(gx - 2, gx + 2, TOP + 6.6, TOP + 7.3, l0 - .4, l1 + .4); A.box(gx - .5, gx + .5, TOP + 5.7, TOP + 6.6, (l0 + l1) / 2 - .5, (l0 + l1) / 2 + .5); A.end(); A.begin('ar_iron'); A.tint(.3); A.rod(gx, TOP + 5.7, (l0 + l1) / 2, gx, TOP + 2.2, (l0 + l1) / 2, .02, 4); A.box(gx - .15, gx + .15, TOP + 2, TOP + 2.25, (l0 + l1) / 2 - .15, (l0 + l1) / 2 + .15); A.end(true);
    for (const lz of [l0, l1]) { for (const sx of [-1, 1]) sol(gx + sx * 1.6 - .22, gx + sx * 1.6 + .22, TOP, TOP + 6.6, lz - .22, lz + .22, 'metal', 1); sol(gx - 2.2, gx + 2.2, TOP, TOP + .5, lz - .35, lz + .35, 'metal', 1); sol(gx - 1.6, gx + 1.6, TOP + 3.2, TOP + 3.4, lz - .12, lz + .12, 'metal'); } sol(gx - 2, gx + 2, TOP + 6.6, TOP + 7.3, l0 - .4, l1 + .4, 'metal'); }
  for (const x of [-26, -14, -4, 14, 26]) lamp(x, ZC - .25, TOP + 1.05);
  yield;
  /* plateau ouest : camp (tentes, caisses, conteneurs, mirador), chicane de sacs face au couronnement */
  tent(-49, 15, 'z', TOP); tent(-49, 24, 'z', TOP); tent(-56, 48, 'x', TOP);
  box20(-50, -13, 'x', TOP, [.42, .46, .34]); box20(-50, -16.1, 'x', TOP, [.5, .36, .28]); box20(-60, 58, 'z', TOP, [.4, .44, .46]);
  tower(-46, -12, TOP);
  bags('z', -38.6, -7.4, -4.2, TOP); bags('x', -7.6, -42, -38.6, TOP); bags('z', -38.6, 1.6, 3.6, TOP);
  for (const [x, z, q] of [[-46.4, 18.6, .9], [-46.6, 19.6, .7], [-52.6, 21, .9], [-53, 10.6, .8], [-58.6, 44.6, .9], [-45, -16.6, .9]]) A.crate(x, z, TOP, q);
  for (const [x, z] of [[-52.4, 12.6], [-51.8, 12], [-46.3, 26.8]]) A.cask(x, z, TOP);
  /* plateau est : conteneurs, tentes, sacs devant la maison de garde et le poste de commande */
  box20(52, -16, 'x', TOP, [.42, .46, .34]); box20(57, 46, 'z', TOP, [.48, .36, .3]); tent(60, 35, 'z', TOP);/* sur la terrasse à 12 m (à x 50 le sol est à 6 m : la tente flottait, MAP QA) */ tent(60, -30, 'x', TOP);
  bags('z', 39.4, -7.2, -4.2, TOP); bags('x', -7.4, 39.4, 42.6, TOP); bags('x', 7.2, 52.4, 55.6, TOP);
  for (const [x, z, q] of [[57.6, 33.2, .9], [57.4, 34.3, .7], [47.6, -20, .9], [61.6, -27, .8]]) A.crate(x, z, TOP, q);/* deux caisses posées au sol (elles flottaient au-dessus de la pente, MAP QA) */
  for (const [x, z] of [[57.6, -12.2], [58.4, -12.8]]) A.cask(x, z, TOP);/* hors du rocher (MAP QA) */
  yield;
  /* poste de transformation (terrasse à 6 m) : trois transformateurs entre murs pare-feu, portiques d'arrivée, pylône sur la butte */
  { const y = SWY, tz = 33; for (const tx of [29.5, 36.5, 43.5]) { A.begin('ar_plaster'); A.tint(.7); A.box(tx - 2, tx + 2, y, y + .4, tz - 1.7, tz + 1.7); A.end(); sol(tx - 2, tx + 2, y, y + .4, tz - 1.7, tz + 1.7);
      A.begin('ar_iron'); A.tint(.5, .55, .52); A.box(tx - 1.5, tx + 1.5, y + .4, y + 2.7, tz - 1.1, tz + 1.1); A.tint(.42, .47, .44); for (let q = -1.3; q <= 1.31; q += .26) { A.box(tx + q - .03, tx + q + .03, y + .6, y + 2.4, tz - 1.55, tz - 1.1); A.box(tx + q - .03, tx + q + .03, y + .6, y + 2.4, tz + 1.1, tz + 1.55); } A.end(); A.begin('ar_iron'); A.tint(.5, .55, .52); const pc = []; for (let q = 0; q < 10; q++) pc.push([tx + Math.cos(q / 10 * TAU) * .32, tz + .2 + Math.sin(q / 10 * TAU) * .32]); A.ext('z', [[tz - .2 - .35, y + 3.0], [tz - .2 + .35, y + 3.0], [tz - .2 + .35, y + 3.65], [tz - .2 - .35, y + 3.65]], tx - 1.2, tx + 1.2);/* conservateur sur le transformateur (axe d'extrusion corrigé, MAP QA) */ A.rod(tx - 1, y + 2.7, tz - .2, tx - 1, y + 3, tz - .2, .08, 5); A.rod(tx + 1, y + 2.7, tz - .2, tx + 1, y + 3, tz - .2, .08, 5); A.end();
      A.begin('ar_dark'); A.tint(.62, .5, .4); for (const bx of [-.8, 0, .8]) for (let h = 0; h < 6; h++) { const yy = y + 2.7 + h * .2; A.box(tx + bx - .12, tx + bx + .12, yy, yy + .12, tz + .3 - .12, tz + .3 + .12); } A.end(); sol(tx - 1.55, tx + 1.55, y + .4, y + 2.7, tz - 1.55, tz + 1.55, 'metal'); sol(tx - 1, tx + 1, y + 2.7, y + 3.95, tz + .15, tz + .45, 'metal'); }
    for (const fx of [33, 40]) { A.begin('ar_plaster'); A.tint(.74); A.box(fx - .2, fx + .2, y, y + 3.4, tz - 2.4, tz + 2.4); A.end(); sol(fx - .2, fx + .2, y, y + 3.4, tz - 2.4, tz + 2.4, 'concrete', 1); }
    /* portiques : poteaux en treillis et poutre, chaînes d'isolateurs, fils vers les transformateurs */
    const lattice = (x, z, y0, y1, w) => { A.begin('ar_iron'); A.tint(.5, .52, .54); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.rod(x + sx * w, y0, z + sz * w, x + sx * w * .5, y1, z + sz * w * .5, .05, 4); for (let h = y0 + 2.2; h < y1 - .5; h += 1.1) { const a = w * (1 - .5 * (h - y0) / (y1 - y0)), b = w * (1 - .5 * (h + 1.1 - y0) / (y1 - y0)); for (const [p, q] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) A.rod(x + p[0] * a, h, z + p[1] * a, x + q[0] * b, h + 1.1, z + q[1] * b, .025, 3); } A.end(); k.disc(x, z, w + .05, y0, y0 + 2.5, 'metal'); };
    for (const gz of [26, 40]) { for (const gx of [26, 47]) lattice(gx, gz, y, y + 8.5, .45); A.begin('ar_iron'); A.tint(.5, .52, .54); A.box(26, 47, y + 8.2, y + 8.8, gz - .3, gz + .3); A.end(); A.begin('ar_dark'); A.tint(.75, .6, .45); for (const tx of [29.5, 36.5, 43.5]) for (const dx of [-.8, 0, .8]) for (let h = 0; h < 5; h++) A.box(tx + dx - .1, tx + dx + .1, y + 7.2 + h * .18, y + 7.32 + h * .18, gz - .1, gz + .1); A.end(); A.begin('ar_iron'); A.tint(.25); for (const tx of [29.5, 36.5, 43.5]) for (const dx of [-.8, 0, .8]) A.rod(tx + dx, y + 7.2, gz, tx + dx, y + 3.7, tz + .3, .012, 3); A.end(true); }
    /* pylône de départ sur la butte */ { const px = 43.5, pz = 47.5, py = RIDGE; A.begin('ar_iron'); A.tint(.46, .48, .5); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.rod(px + sx * 1.8, py, pz + sz * 1.8, px + sx * .5, py + 16, pz + sz * .5, .07, 4); for (let h = 2.4; h < 15; h += 1.6) { const a = 1.8 - 1.3 * h / 16, b = 1.8 - 1.3 * (h + 1.6) / 16; for (const [p, q] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { A.rod(px + p[0] * a, py + h, pz + p[1] * a, px + q[0] * b, py + h + 1.6, pz + q[1] * b, .03, 3); A.rod(px + q[0] * a, py + h, pz + q[1] * a, px + p[0] * b, py + h + 1.6, pz + p[1] * b, .03, 3); } } for (const h of [11, 14]) A.box(px - .25, px + .25, py + h, py + h + .3, pz - 4.2, pz + 4.2); A.end(); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.disc(px + sx * 1.75, pz + sz * 1.75, .12, py, py + 3, 'metal');
      for (const h of [11, 14]) for (const sd of [-3.8, 3.8]) A.cable(px, py + h - .4, pz + sd, 82, py + h + 4, pz + sd * 1.4, 1.6); }
    for (const [x, z, q] of [[25.5, 20, .9], [26.3, 20.6, .7], [47.6, 57, 1]]) A.crate(x, z, y, q); bags('x', 21.4, 28, 31.6, y); bags('z', 24.6, 37, 39.6, y); }
  yield;
  /* usine : transformateurs de groupe sur la terrasse, caisses ; lit : nid de sacs au pied de la pile ouest */
  for (const [tx, tz] of [[-3.6, 7.2], [6.6, 7.2]]) { A.begin('ar_iron'); A.tint(.5, .55, .52); A.box(tx - 1.2, tx + 1.2, BERM, BERM + 2.2, tz - .9, tz + .9); A.tint(.42, .47, .44); for (let q = -1; q <= 1.01; q += .25) { A.box(tx + q - .03, tx + q + .03, BERM + .2, BERM + 2, tz - 1.3, tz - .9); A.box(tx + q - .03, tx + q + .03, BERM + .2, BERM + 2, tz + .9, tz + 1.3); } A.end(); sol(tx - 1.2, tx + 1.2, BERM, BERM + 2.2, tz - 1.3, tz + 1.3, 'metal'); }
  bags('x', 18.4, 1, 4.6, BERM); bags('z', 9.6, 12, 15.6, BERM); for (const [x, z, q] of [[-5, 19.8, .9], [-4.6, 20.8, .7], [9.8, 4.6, .8]]) A.crate(x, z, BERM, q);
  bags('x', 49.2, -17.4, -13.8, RIV); bags('z', -17.6, 45, 48.6, RIV); for (const [x, z, q] of [[11, 26, .9], [11.7, 27.3, .7], [-2.6, 58, .9]]) A.crate(x, z, RIV, q); for (const [x, z] of [[12.4, 25.2], [-3.4, 57.2]]) A.cask(x, z, RIV);
  yield;
  /* lit : vasques sous l'évacuateur et devant l'usine, galets mouillés, bois flotté */
  { A.begin('ar_water'); A.tint(.56, .66, .66); A.quad(SX0 + .7, .1, 39, SX1 - .7, .1, 39, SX1 - .7, .1, 34.6, SX0 + .7, .1, 34.6); A.quad(HX0 + .3, .1, 27, HX1 - .3, .1, 27, HX1 - .3, .1, 22.7, HX0 + .3, .1, 22.7); A.end();
    for (let i = 0; i < 14; i++) { const z = 26 + i * 3.1 + noise2(i, 5), sd = i % 2 ? 1 : -1, x = C.strC(z) + sd * (C.strW(z) + .5); if (C.T[C.at(x, z)] !== 0 || C.H[C.at(x, z)] !== 0 || Math.abs(z - 46) < 3 || Math.abs(z - 30) < 2.5 || Math.abs(z - 57) < 2.5) continue; A.boulder(x, z, .32 + .18 * noise2(i * 1.7, 2), { y: 0, sx: 1.3, tone: .66 + .08 * noise2(i, 7), m: 'ar_rock' }); }       /* [objc] galets mouillés : ton de pierre (.42 se lisait comme des demi-sphères noires unies, rc8-75) */
    for (let i = 0; i < 0; i++) { const z = 23 + i * .7 + (noise2(i, 3) - .5), x = C.xRiv(z) + 3 * Math.sin(z * .06 + 1) + 2 + (i % 2 ? 1 : -1) * (2.4 + 1.5 * noise2(i * .7, 9)); if (C.T[C.at(x, z)] !== 0 || C.H[C.at(x, z)] !== 0) continue; void x; }
    for (const [x, z, a, L] of [[7.2, 47, .5, 3.6], [-8, 41, -.9, 2.8], [10.5, 63, 1.9, 3.2], [-3, 53.5, .2, 2.4]]) { if (C.T[C.at(x, z)] !== 0) continue; const dx = Math.cos(a) * L / 2, dz = Math.sin(a) * L / 2; A.begin('ar_wood'); A.tint(.62, .6, .56); A.log(x - dx, .16, z - dz, x + dx, .16, z + dz, .16, { seg: 6, n: 2, taper: .2 }); A.log(x + dx * .3, .16, z + dz * .3, x + dx * .3 + Math.cos(a + .9) * .9, .2, z + dz * .3 + Math.sin(a + .9) * .9, .06, { seg: 5, n: 1 }); A.end(); sol(Math.min(x - dx, x + dx) - .12, Math.max(x - dx, x + dx) + .12, 0, .3, Math.min(z - dz, z + dz) - .12, Math.max(z - dz, z + dz) + .12, 'wood'); } }
  /* camion militaire bâché et véhicule de liaison (géométrie du kit, aucun programme nouveau) */
  const truck = (x, z, ax, y, a = 1) => { const P = (u, v) => (ax === 'x' ? [x + u * a, z + v] : [x + v, z + u * a]), B = (u0, u1, y0, y1, v0, v1) => { const [p0, q0] = P(u0, v0), [p1, q1] = P(u1, v1); A.box(Math.min(p0, p1), Math.max(p0, p1), y + y0, y + y1, Math.min(q0, q1), Math.max(q0, q1)); };
    A.begin('ar_iron'); A.tint(.3, .34, .24); B(-3.1, 3.1, .55, .9, -1.1, 1.1); B(1.6, 3.1, .9, 2.55, -1.12, 1.12); B(2.95, 3.25, .7, 1.4, -1.1, 1.1); A.tint(.22, .24, .2); B(-3.2, 1.5, .9, 1.45, -1.15, 1.15); A.end();
    A.begin('ar_dark'); A.tint(.3, .34, .36); B(3.1, 3.13, 1.65, 2.35, -.95, .95); for (const v of [-1.13, 1.13]) B(1.9, 2.8, 1.7, 2.3, v - .01, v + .01); A.end();
    A.begin('ar_cloth'); A.tint(.4, .43, .3); B(-3.15, 1.45, 1.45, 2.3, -1.12, 1.12); A.end(); A.begin('ar_cloth'); A.tint(.36, .39, .27); const ar = []; for (let q = 0; q <= 6; q++) { const t = q / 6 * Math.PI; ar.push([Math.cos(t) * 1.12, 2.3 + Math.sin(t) * .55]); } if (ax === 'x') A.ext('z', ar.map(([v, h]) => [z + v, y + h]), Math.min(x - 3.15 * a, x + 1.45 * a), Math.max(x - 3.15 * a, x + 1.45 * a)); else A.ext('x', ar.map(([v, h]) => [x + v, y + h]), Math.min(z - 3.15 * a, z + 1.45 * a), Math.max(z - 3.15 * a, z + 1.45 * a)); A.end();
    A.begin('ar_dark'); A.tint(.16); for (const u of [-2.2, -1.1, 2.3]) for (const v of [-1, 1]) { const wl = []; for (let q = 0; q < 10; q++) { const t = q / 10 * TAU; wl.push([Math.cos(t) * .55, .55 + Math.sin(t) * .55]); } const [px, pz] = P(u, v); if (ax === 'x') A.ext('x', wl.map(([du, h]) => [px + du, y + h]), pz - .2, pz + .2); else A.ext('z', wl.map(([du, h]) => [pz + du, y + h]), px - .2, px + .2); } A.end();
    const [a0, b0] = P(-3.2, -1.2), [a1, b1] = P(3.25, 1.2); sol(Math.min(a0, a1), Math.max(a0, a1), y, y + 2.88, Math.min(b0, b1), Math.max(b0, b1), 'metal', 1); };
  const jeep = (x, z, ax, y) => { const B = (u0, u1, y0, y1, v0, v1) => (ax === 'x' ? A.box(x + u0, x + u1, y + y0, y + y1, z + v0, z + v1) : A.box(x + v0, x + v1, y + y0, y + y1, z + u0, z + u1)); A.begin('ar_iron'); A.tint(.34, .38, .27); B(-1.9, 1.9, .45, 1.05, -.85, .85); B(.9, 1.9, 1.05, 1.15, -.8, .8); B(-.2, -.12, 1.05, 1.7, -.8, .8); B(-1.9, -.2, 1.05, 1.35, -.85, -.75); B(-1.9, -.2, 1.05, 1.35, .75, .85); A.end(); A.begin('ar_dark'); A.tint(.16); for (const u of [-1.25, 1.25]) for (const v of [-.85, .85]) B(u - .38, u + .38, 0, .76, v - .14, v + .14); A.end(); ax === 'x' ? sol(x - 1.9, x + 1.9, y, y + 1.4, z - .99, z + .99, 'metal', 1) : sol(x - .99, x + .99, y, y + 1.4, z - 1.9, z + 1.9, 'metal', 1); };
  truck(-50, 6, 'z', TOP, -1); truck(50, -9, 'x', TOP, 1); truck(51, 2, 'z', TOP, 1); jeep(-12.4, -4.35, 'x', TOP); jeep(40.5, 25.8, 'x', SWY);
  /* mât radio haubané près du camp ouest, guérite et barrière au bout ouest du couronnement */
  { const mx = -52, mz = 36, y = TOP; A.begin('ar_iron'); A.tint(.5, .2, .16); for (let h = 0; h < 15; h += 3) { A.tint(h % 6 ? .78 : .55, h % 6 ? .76 : .2, h % 6 ? .72 : .16); for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) A.rod(mx + sx * .25, y + h, mz + sz * .25, mx + sx * .25, y + h + 3, mz + sz * .25, .03, 4); for (let q = 0; q < 3; q += 1) A.rod(mx - .25, y + h + q, mz - .25, mx + .25, y + h + q + 1, mz - .25, .015, 3); } A.tint(.3); A.rod(mx, y + 15, mz, mx, y + 17.5, mz, .02, 4); A.rod(mx - .9, y + 14, mz, mx + .9, y + 14, mz, .015, 3); A.end(); k.disc(mx, mz, .32, y, y + 15, 'metal'); for (const [gx, gz] of [[-58, 32], [-47, 31], [-52, 43]]) A.cable(mx, y + 12, mz, gx, y + .2, gz, .3);
    A.begin('ar_plaster'); A.tint(.62, .64, .6); A.box(mx - 1.2, mx - .6, y, y + .9, mz + 1.4, mz + 2.4); A.end(); sol(mx - 1.2, mx - .6, y, y + .9, mz + 1.4, mz + 2.4); }
  { const bx0 = -30.2, bx1 = -28.4, bz0 = -2.9, bz1 = -1.1, y = TOP; A.begin('ar_plank'); A.tint(.46, .5, .4); A.box(bx0, bx1, y, y + 1.1, bz0, bz1); A.box(bx0, bx1, y + 2.2, y + 2.45, bz0 - .1, bz1 + .1); for (const [px, pz] of [[bx0, bz0], [bx1, bz0], [bx0, bz1], [bx1, bz1]]) A.box(px - .06, px + .06, y + 1.1, y + 2.2, pz - .06, pz + .06); A.end(); A.begin('ar_dark'); A.tint(.3, .36, .4); A.box(bx0 + .06, bx1 - .06, y + 1.1, y + 2.2, bz0 + .06, bz1 - .06); A.end(); sol(bx0, bx1, y, y + 2.45, bz0, bz1, 'wood', 1);
    A.begin('ar_iron'); for (let q = 0; q < 6; q++) { A.tint(q % 2 ? .85 : .7, q % 2 ? .82 : .14, q % 2 ? .78 : .12); A.rod(-29.3, y + 1 + q * .4, bz0 - .1, -29.3, y + 1 + (q + 1) * .4, bz0 - .1, .05, 5); } A.end(); }

  /* ---------- intérieurs : galeries, halle, poste de commande, maisons de garde ---------- */
  const desk = (x, z, y, ax, L = 1.6) => { const [hx, hz] = ax === 'x' ? [L / 2, .4] : [.4, L / 2]; A.begin('ar_plank'); A.tint(.52, .44, .36); A.box(x - hx, x + hx, y + .72, y + .78, z - hz, z + hz); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.box(x + sx * (hx - .05) - .03, x + sx * (hx - .05) + .03, y, y + .72, z + sz * (hz - .05) - .03, z + sz * (hz - .05) + .03); A.end(); sol(x - hx, x + hx, y, y + .78, z - hz, z + hz, 'wood'); };
  /* [fin] chaise de bureau (rc8-95 : « chaises en blocs noirs ») : piètement à cinq branches, vérin, assise et dossier rembourrés, tournée vers
     (fx, fz) ; mêmes collisions qu'avant (assise + dossier, dossier du côté opposé). */
  const chair = (x, z, y, fx = 0, fz = -1) => { const bx = -fx, bz = -fz, P = (u, v) => [x + bx * u - bz * v, z + bz * u + bx * v]; A.begin('ar_iron'); A.tint(.2, .2, .22); for (let q = 0; q < 5; q++) { const a = q / 5 * TAU + .3, ex = x + Math.cos(a) * .27, ez = z + Math.sin(a) * .27; A.rod(x, y + .1, z, ex, y + .05, ez, .018, 4); A.box(ex - .025, ex + .025, y, y + .05, ez - .025, ez + .025); } A.tint(.5, .52, .54); A.rod(x, y + .1, z, x, y + .42, z, .025, 6); A.tint(.2, .2, .22); { const [p0, q0] = P(.05, 0), [p1, q1] = P(.2, 0); A.rod(p0, y + .44, q0, p1, y + .6, q1, .018, 4); } A.end();
    A.begin('ar_dark'); A.tint(.75, .8, .9); A.box(x - .23, x + .23, y + .42, y + .5, z - .23, z + .23);   /* [fin] rembourrage gris-bleu sombre (la toile sortait blanche) */ { const [c0, d0] = P(.18, -.22), [c1, d1] = P(.24, .22); A.box(Math.min(c0, c1), Math.max(c0, c1), y + .56, y + .96, Math.min(d0, d1), Math.max(d0, d1)); } A.end();
    sol(x - .23, x + .23, y, y + .5, z - .23, z + .23, 'metal'); { const [c0, d0] = P(.17, -.23), [c1, d1] = P(.25, .23); sol(Math.min(c0, c1), Math.max(c0, c1), y + .5, y + .96, Math.min(d0, d1), Math.max(d0, d1), 'metal'); } };
  const cabinet = (x, z, y, ax, n = 1, h = 2) => { const [hx, hz] = ax === 'x' ? [.45 * n, .3] : [.3, .45 * n]; A.begin('ar_iron'); A.tint(.42, .45, .44); A.box(x - hx, x + hx, y, y + h, z - hz, z + hz); A.end(); A.begin('lampG'); for (let i = 0; i < n; i++) { const u = -hx + .45 + i * .9; ax === 'x' ? A.box(x + u - .03, x + u + .03, y + 1.6, y + 1.66, z - hz - .01, z - hz + .01) : A.box(x - hx - .01, x - hx + .01, y + 1.6, y + 1.66, z + u - .03, z + u + .03); } A.end(); sol(x - hx, x + hx, y, y + h, z - hz, z + hz, 'metal'); };
  /* [fin] pupitre de la salle de contrôle (rc8-95 : douze écrans bleus identiques sur un bloc noir) : plateau à pupitre incliné, boutons et voyants,
     moniteurs de tailles variées (schémas, courbes, écran éteint, écran fêlé), claviers, papiers, tasses. Pas de tirage : motif fixe par poste. */
  const console_ = (x, z0, z1, y, face) => { const d = -face, X = u => x + d * u, bx = (u0, u1, y0, y1, za, zb) => A.box(Math.min(X(u0), X(u1)), Math.max(X(u0), X(u1)), y0, y1, za, zb);
    A.begin('ar_iron'); A.tint(.34, .36, .37); bx(-.45, .45, y, y + .74, z0, z1); A.tint(.42, .44, .44); bx(-.47, .47, y + .74, y + .78, z0 - .02, z1 + .02); A.tint(.22, .23, .24); bx(.43, .46, y + .05, y + .7, z0 + .05, z1 - .05); A.end();
    const N = Math.max(1, Math.floor((z1 - z0 - .2) / .8)), KIND = ['S', 'B', 'O', 'G', 'S', 'X', 'B', 'S', 'O', 'G', 'B', 'S'];
    for (let i = 0; i < N; i++) { const zc = z0 + .5 + i * .8, kd = KIND[i % KIND.length], w = i % 3 === 1 ? .62 : .5, h = i % 3 === 1 ? .42 : .36, yb = y + .86 + (i % 2) * .04;
      A.begin('ar_dark'); A.tint(.13, .13, .14); bx(-.2, -.12, y + .78, y + .8, zc - .12, zc + .12); bx(-.18, -.14, y + .8, yb + .06, zc - .03, zc + .03); bx(-.15, -.09, yb, yb + h, zc - w / 2, zc + w / 2); A.end();
      const fu = -.09 + .004, sx = (u0, u1, y0, y1, za, zb) => bx(u0, u1, y0, y1, za, zb);
      if (kd === 'O') { A.begin('ar_dark'); A.tint(.06, .07, .08); sx(fu - .004, fu + .002, yb + .03, yb + h - .03, zc - w / 2 + .03, zc + w / 2 - .03); A.end(); }
      else if (kd === 'X') { A.begin('ar_dark'); A.tint(.05); sx(fu - .004, fu + .002, yb + .03, yb + h - .03, zc - w / 2 + .03, zc + w / 2 - .03); A.end(); A.begin('lampB'); const a = [X(fu + .003), yb + .05, zc - w / 2 + .05], b = [X(fu + .003), yb + h - .05, zc - w / 2 + .05], c = [X(fu + .003), yb + .05, zc + .02]; d > 0 ? A.tri(...a, ...c, ...b) : A.tri(...a, ...b, ...c); A.end(); }
      else { A.begin(kd === 'G' ? 'lampG' : 'lampB'); sx(fu - .004, fu + .002, yb + .03, yb + h - .03, zc - w / 2 + .03, zc + w / 2 - .03); A.end();
        if (kd !== 'B') { A.begin('ar_dark'); A.tint(kd === 'G' ? .1 : .2, kd === 'G' ? .3 : .26, kd === 'G' ? .16 : .34); const L = kd === 'G' ? 3 : 4; for (let q = 0; q < L; q++) { const yy = yb + .07 + q * (h - .14) / L; sx(fu + .002, fu + .006, yy, yy + .012, zc - w / 2 + .07, zc + w / 2 - .07 - (q % 2) * .12); } if (kd === 'S') for (let q = 0; q < 3; q++) { const zz = zc - w / 2 + .1 + q * (w - .2) / 2; sx(fu + .002, fu + .006, yb + .06, yb + h - .06, zz, zz + .012); } A.end(); } }
      A.begin('ar_dark'); A.tint(.18); bx(.12, .3, y + .78, y + .8, zc - .22, zc + .22); A.end();
      A.begin(i % 3 === 2 ? 'lampR' : i % 3 === 1 ? 'lampY' : 'lampG'); for (let q = 0; q < 3; q++) bx(.34, .37, y + .782, y + .79, zc - .2 + q * .07, zc - .17 + q * .07); A.end();
      if (i % 4 === 1) { A.begin('ar_cloth'); A.tint(.86, .85, .8); bx(.05, .3, y + .781, y + .783, zc + .25, zc + .46); A.end(); }
      if (i % 5 === 3) { A.begin('ar_plaster'); A.tint(.8, .78, .74); A.prism([0, 1, 2, 3, 4, 5, 6, 7].map(q => [X(.2) + Math.cos(q / 8 * TAU) * .04, zc + .32 + Math.sin(q / 8 * TAU) * .04]), y + .78, y + .88); A.end(); } }
    sol(x - .45, x + .45, y, y + .8, z0, z1, 'metal'); };
  /* galeries : faisceau de tuyaux et goulotte au mur amont, caniveau au pied du mur aval */
  { A.begin('ar_iron'); A.tint(.32, .38, .36); for (const [y, z, r] of [[2.12, FGZ0 + .16, .08], [2.36, FGZ0 + .14, .06]]) A.rod(-FGX + .1, y, z, FGX - .1, y, z, r, 6); for (let x = -FGX + 1; x < FGX; x += 3) A.box(x - .03, x + .03, 2, 2.5, FGZ0, FGZ0 + .25); A.tint(.4, .42, .42); A.box(-FGX + .1, FGX - .1, 2.55, 2.6, FGZ0, FGZ0 + .3); for (const [y, z, r] of [[BERM + 2.05, UGZ0 + .15, .07], [BERM + 2.3, UGZ0 + .13, .05]]) A.rod(UGX0 + .1, y, z, UGX1 - .1, y, z, r, 6); A.end(true);
    /* [fin] caniveau : la bande noire unie au pied du mur aval (rc8-76) devient une grille de fonte sur bordures, fentes sombres tous les 12 cm */
    A.begin('ar_plaster'); A.tint(.5, .51, .52); for (const [a0, a1] of [[FGZ1 - .32, FGZ1 - .28], [FGZ1 - .06, FGZ1 - .02]]) A.box(-FGX, FGX, .0, .03, a0, a1, 0, 'y'); A.end();
    A.begin('ar_iron'); A.tint(.36, .35, .33); A.quad(-FGX, .024, FGZ1 - .06, FGX, .024, FGZ1 - .06, FGX, .024, FGZ1 - .28, -FGX, .024, FGZ1 - .28); A.end();
    A.begin('ar_dark'); A.tint(.08); for (let x = -FGX + .1; x < FGX - .1; x += .12) A.quad(x, .026, FGZ1 - .08, x + .045, .026, FGZ1 - .08, x + .045, .026, FGZ1 - .26, x, .026, FGZ1 - .26); A.end(); }
  /* halle : pupitre et armoires au mur ouest, fûts, caisses */
  console_(-6.55, 19.4, 22.1, 0, 1); cabinet(-6.7, 15.2, 0, 'z', 2); for (const [x, z, q] of [[-1.6, 12.1, .8], [-.7, 12.15, .7]]) A.crate(x, z, 0, q); A.cask(5.1, 21.7, 0); A.cask(5.8, 21.9, 0); cabinet(-3.55, 21.9, 0, 'x', 5, 2);
  { A.begin('ar_plaster'); A.tint(1, .82, .18); for (const gx of [-2.4, 6.8]) { const a = gx - 2.75, b = Math.min(gx + 2.75, 9.45), c = 14.65, d = 20.15, w = .05, y = .03; A.quad(a + w, y, c + w, b - w, y, c + w, b - w, y, c - w, a + w, y, c - w); A.quad(a + w, y, d + w, b - w, y, d + w, b - w, y, d - w, a + w, y, d - w); A.quad(a - w, y, d, a + w, y, d, a + w, y, c, a - w, y, c); A.quad(b - w, y, d, b + w, y, d, b + w, y, c, b - w, y, c); } A.end(); }
  /* poste de commande : armoires de coupure (6 m), bureaux (9 m), salle de contrôle (12 m) */
  { const X0 = 37.86, Y6 = SWY, Y9 = 9, Y12 = TOP; for (let z = 10.6; z < 20; z += 1.95) cabinet(X0 + .32, z, Y6, 'z', 2, 2.1); for (let x = 40.5; x < 46; x += 1.95) cabinet(x, 10.18, Y6, 'x', 2, 2.1);
    for (const [x, z, ax] of [[40.6, 12.2, 'x'], [40.6, 16.2, 'x'], [42.8, 19.6, 'z']]) { desk(x, z, Y9, ax); chair(ax === 'x' ? x : x - .7, ax === 'x' ? z + .75 : z, Y9, ax === 'x' ? 0 : 1, ax === 'x' ? -1 : 0); } cabinet(38.3, 19.8, Y9, 'z', 2, 1.4); /* [fin] tableau d'affichage entre deux fenêtres (il chevauchait la fenêtre de z 13,7, rc8-97) : cadre de bois, fond de liège, plan et feuilles */ A.begin('ar_plank'); A.tint(.42, .32, .24); A.box(37.86, 37.9, 9.95, 11.2, 14.4, 15.7); A.end(); A.begin('ar_cloth'); A.tint(.56, .44, .3); A.box(37.9, 37.905, 10.0, 11.15, 14.45, 15.65); A.tint(.86, .84, .76); A.box(37.905, 37.908, 10.35, 11.0, 14.55, 15.2); A.tint(.9, .9, .86); A.box(37.905, 37.908, 10.1, 10.45, 15.27, 15.55); A.tint(.82, .76, .52); A.box(37.905, 37.908, 10.6, 10.9, 15.3, 15.58); A.end();
    console_(38.6, 10.6, 20.4, Y12, -1); for (const z of [12, 14.5, 17, 19.5]) chair(39.7, z, Y12, -1, 0); desk(43.0, 14.5, Y12, 'x', 2); }   /* [fin] 1 m jusqu'au garde-corps de la trémie */
  /* maisons de garde : bureau, chaise, casiers */
  for (const sx of [-1, 1]) { const x0 = sx < 0 ? -37.5 : 28.5, x1 = sx < 0 ? -28.5 : 37.5, xc = sx < 0 ? x0 + 1.4 : x1 - 1.4; desk(xc, 4.5, TOP, 'z', 1.4); chair(xc - sx * .7, 4.5, TOP, sx, 0); cabinet(sx < 0 ? x0 + .75 : x1 - .75, 2.2, TOP, 'z', 2, 1.9); }

  /* station de pompage : deux pompes, collecteur, tuyaux d'aspiration vers la retenue */
  /* [fin] pompes refaites (rc8-85 : cylindres à facettes empilés, collecteur en poutre pliée) : groupes verticaux sur massif, volute à tubulure
     tangentielle, lanterne d'accouplement, moteur à ailettes et capot de ventilateur, brides boulonnées, vanne à volant, clapet, manomètre ;
     aspiration par le mur ouest, refoulement vers le collecteur rond. Aucun tirage (rod, prism, box sans jeu). */
  { const y = SHORE, pz = -34.2, ring = (cx, cz, r, n = 16, ex = 0) => { const o = []; for (let q = 0; q < n; q++) { const a = q / n * TAU, rr = r * (1 + ex * (.5 + .5 * Math.cos(a - .8))); o.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); } return o; };
    const disc = (u, v, r, n = 12) => { const o = []; for (let q = 0; q < n; q++) o.push([u + Math.cos(q / n * TAU) * r, v + Math.sin(q / n * TAU) * r]); return o; };
    /* bride : disque plein (extrusion fermée), axe x, y ou z */
    const flange = (ax, ay, az, dx, dy, dz, r) => { if (dx) A.ext('z', disc(az, ay, r), ax - .03, ax + .03); else if (dz) A.ext('x', disc(ax, ay, r), az - .03, az + .03); else A.prism(disc(ax, az, r), ay - .03, ay + .03); };
    const wheel = (x, yy, z, R) => { for (let q = 0; q < 10; q++) { const a0 = q / 10 * TAU, a1 = (q + 1) / 10 * TAU; A.rod(x + Math.cos(a0) * R, yy, z + Math.sin(a0) * R, x + Math.cos(a1) * R, yy, z + Math.sin(a1) * R, .018, 4); } for (let q = 0; q < 3; q++) { const a = q / 3 * TAU + .3; A.rod(x, yy, z, x + Math.cos(a) * R, yy, z + Math.sin(a) * R, .012, 3); } };
    for (const px of [35, 40.4]) {
      A.begin('ar_plaster'); A.tint(.64); A.box(px - 1.1, px + 1.1, y, y + .35, pz - .9, pz + .9); A.tint(.5); A.box(px - 1.12, px + 1.12, y, y + .04, pz - .92, pz + .92, 0, 'y'); A.end(); sol(px - 1.1, px + 1.1, y, y + .35, pz - .9, pz + .9);
      const vc = y + .58, mo = y + 1.2;
      A.begin('ar_iron'); A.tint(.3, .4, .5);
      A.prism(ring(px, pz, .5, 18, .14), y + .35, y + .43); A.prism(ring(px, pz, .46, 18, .14), y + .43, y + .76); A.prism(ring(px, pz, .5, 18, .14), y + .76, y + .82);   /* volute (carter en colimaçon, plus large côté refoulement) */
      A.rod(px + .3, vc, pz + .2, px + .3, vc, pz + .95, .14, 12); flange(px + .3, vc, pz + .95, 0, 0, 1, .22);   /* tubulure de refoulement */
      A.rod(px - .3, vc, pz - .2, px - .95, vc, pz - .2, .15, 12); flange(px - .95, vc, pz - .2, 1, 0, 0, .23);   /* tubulure d'aspiration */
      A.tint(.26, .34, .42); for (let q = 0; q < 4; q++) { const a = q / 4 * TAU + .4; A.rod(px + Math.cos(a) * .3, y + .82, pz + Math.sin(a) * .3, px + Math.cos(a) * .24, mo - .04, pz + Math.sin(a) * .24, .035, 5); }   /* lanterne */
      A.tint(.6, .62, .6); A.rod(px, y + .82, pz, px, mo, pz, .05, 8);   /* arbre */
      A.tint(.72, .6, .2); A.prism(ring(px, pz, .2, 12), y + .95, y + 1.07);   /* manchon d'accouplement */
      A.tint(.3, .4, .5); A.prism(ring(px, pz, .48, 18), mo - .05, mo);   /* bride du moteur */
      A.tint(.3, .37, .34); A.prism(ring(px, pz, .4, 18), mo, mo + .78); for (let q = 0; q < 16; q++) { const a = (q + .5) / 16 * TAU; A.box(px + Math.cos(a) * .42 - .018, px + Math.cos(a) * .42 + .018, mo + .06, mo + .72, pz + Math.sin(a) * .42 - .018, pz + Math.sin(a) * .42 + .018); }   /* moteur à ailettes */
      A.tint(.26, .3, .3); A.prism(ring(px, pz, .34, 16), mo + .78, mo + .92); A.tint(.36, .42, .4); A.box(px + .36, px + .56, mo + .3, mo + .56, pz - .14, pz + .14);   /* capot, boîte à bornes */
      A.tint(.62, .6, .55); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.box(px + sx * .95 - .04, px + sx * .95 + .04, y + .35, y + .4, pz + sz * .75 - .04, pz + sz * .75 + .04);   /* tiges de scellement */
      A.end(); A.begin('ar_dark'); A.tint(.14); A.prism(ring(px, pz, .3, 16), mo + .92, mo + .93); A.end();   /* grille du ventilateur */
      k.disc(px, pz, .5, y + .35, y + .82, 'metal'); k.disc(px, pz, .45, mo - .05, mo + .92, 'metal');
      /* refoulement : vanne à volant, coude vers le haut, puis le collecteur ; manomètre sur la tubulure */
      A.begin('ar_iron'); const zq = pz + 1.45; A.tint(.3, .32, .3); A.box(px + .14, px + .46, vc - .17, vc + .17, pz + .98, pz + 1.3); A.rod(px + .3, vc + .17, pz + 1.14, px + .3, vc + .52, pz + 1.14, .03, 5); A.tint(.6, .18, .14); wheel(px + .3, vc + .52, pz + 1.14, .19);
      A.tint(.34, .42, .5); flange(px + .3, vc, pz + 1.33, 0, 0, 1, .22); A.rod(px + .3, vc, pz + 1.3, px + .3, vc, zq + .14, .14, 12); A.rod(px + .3, vc - .14, zq, px + .3, y + .94, zq, .14, 12); A.rod(px + .3, y + .8, zq - .14, px + .3, y + .8, -32.4, .14, 12);
      A.tint(.6); A.rod(px + .3, vc + .14, pz + .6, px + .3, vc + .36, pz + .6, .012, 4); A.end(); A.begin('ar_plaster'); A.tint(.92); A.ext('z', disc(pz + .6, vc + .42, .065, 10), px + .27, px + .34); A.end();
      sol(px + .1, px + .5, y, y + 1.05, pz + .9, -32.6, 'metal'); }
    /* collecteur rond sur selles, aspirations par le mur ouest (vanne sur chacune) */
    A.begin('ar_iron'); A.tint(.34, .42, .5); A.rod(34.45, y + .8, -32.4, 40.95, y + .8, -32.4, .22, 14); A.rod(34.45, y + .58, -32.4, 34.45, y + 3.3, -32.4, .22, 14); A.rod(34.45, y + 3.3, -32.62, 34.45, y + 3.3, -26.86, .22, 14); A.box(34.21, 34.69, y + 3.06, y + 3.54, -32.64, -32.16);   /* colonne montante vers le barrage */
    A.tint(.3, .38, .46); for (const x of [37.7, 40.95]) flange(x, y + .8, -32.4, 1, 0, 0, .29); flange(34.45, y + .58, -32.4, 0, 1, 0, .29); flange(34.45, y + 1.9, -32.4, 0, 1, 0, .29);
    A.tint(.5, .5, .48); for (const x of [36.6, 39.3]) { A.box(x - .15, x + .15, y, y + .58, -32.55, -32.25); }
    A.tint(.34, .42, .5); A.rod(32.36, y + .58, -34.4, 34.05, y + .58, -34.4, .15, 12);
    A.rod(32.36, y + .58, -35.7, 39.6, y + .58, -35.7, .15, 12); A.rod(39.45, y + .58, -35.55, 39.45, y + .58, -34.4, .15, 12); A.box(39.29, 39.61, y + .42, y + .74, -35.86, -35.54);   /* coude */
    for (const [x, z] of [[33.2, -34.4], [33.2, -35.7]]) { A.tint(.3, .32, .3); A.box(x - .17, x + .17, y + .4, y + .76, z - .19, z + .19); A.rod(x, y + .76, z, x, y + 1.02, z, .03, 5); A.tint(.6, .18, .14); wheel(x, y + 1.02, z, .18); }
    A.end(); sol(34.6, 41, y, y + 1.05, -32.65, -32.15, 'metal'); sol(34.2, 34.7, y, y + 3.55, -32.65, -32.15, 'metal'); sol(32.36, 34.2, y, y + .78, -34.6, -34.05, 'metal'); sol(32.36, 39.65, y, y + .78, -35.9, -35.5, 'metal');
    /* dehors : deux aspirations plongent dans la retenue */
    A.begin('ar_iron'); A.tint(.34, .42, .5); for (const pz2 of [-34.4, -35.7]) { A.rod(32.4, y + .58, pz2, 28.3, y + .58, pz2, .17, 10); A.rod(28.3, y + .58, pz2, 27.4, WAT - .6, pz2, .17, 10); flange(30.4, y + .58, pz2, 1, 0, 0, .25); A.box(28.14, 28.46, y + .42, y + .74, pz2 - .16, pz2 + .16); } A.end(); sol(28.3, 32.4, y, y + .8, -35.95, -34.15, 'metal'); }
  /* hangar à bateaux : ponton sur la retenue, barques amarrées */
  { const y = SHORE + .25, z0 = -27.2, z1 = -24.9, x0 = -34.2, x1 = -22.5; A.begin('ar_plank'); A.tint(.6, .53, .44); for (let x = x0; x < x1 - .01; x += .3) A.box(x + .01, Math.min(x1, x + .3) - .01, y - .06, y, z0, z1, 0, 'y'); A.end(); A.begin('ar_wood'); A.tint(.38, .31, .25); A.box(x0, x1, y - .3, y - .06, z0, z0 + .12); A.box(x0, x1, y - .3, y - .06, z1 - .12, z1); for (let x = x0 + 1.5; x < x1; x += 3) for (const zz of [z0 + .1, z1 - .1]) A.log(x, WFL, zz, x, y - .05, zz, .1, { seg: 6, n: 1 }); A.end(); sol(x0, x1, WFL, y, z0, z1, 'wood');
    const boat = (x, z, ax) => { const L = 4.6, W = 1.5, [hx, hz] = ax === 'x' ? [L / 2, W / 2] : [W / 2, L / 2]; A.begin('ar_tin'); A.tint(.36, .44, .4); A.box(x - hx, x + hx, WAT - .25, WAT + .2, z - hz, z + hz, 0, 'Y'); for (const [a0, a1, b0, b1] of [[x - hx, x + hx, z - hz, z - hz + .08], [x - hx, x + hx, z + hz - .08, z + hz], [x - hx, x - hx + .08, z - hz + .08, z + hz - .08], [x + hx - .08, x + hx, z - hz + .08, z + hz - .08]]) A.box(a0, a1, WAT + .2, WAT + .45, b0, b1, 0, 'y'); A.end(); A.begin('ar_plank'); A.tint(.5, .44, .36); A.box(x - hx + .085, x + hx - .085, WAT + .2, WAT + .26, z - hz + .085, z + hz - .085, 0, 'y'); A.end(); sol(x - hx, x + hx, WFL, WAT + .45, z - hz, z + hz, 'metal'); };
    boat(-28, -28.6, 'x'); boat(-25, -23.8, 'x'); for (const [x, z, q] of [[-40.6, -28.6, .8], [-41.75, -28.4, .7]]) A.crate(x, z, SHORE, q); }
}

/** Mur plan percé : bandes coupées exactement aux bords des ouvertures (aucune fente au-dessus ou au-dessous d'une baie), face tournée vers s. */
function flatWall(A, m, ax, c, s, u0, u1, y0, y1, holes, rgb = [1, 1, 1], tone = .9) {
  const ys = new Set([y0, y1]); for (const h of holes) { if (h.y0 > y0 && h.y0 < y1) ys.add(h.y0); if (h.y1 > y0 && h.y1 < y1) ys.add(h.y1); }
  const Y = [...ys].sort((a, b) => a - b); A.begin(m);
  for (let k = 0; k + 1 < Y.length; k++) { const a0 = Y[k], a1 = Y[k + 1], ym = (a0 + a1) / 2; let spans = [[u0, u1]];
    for (const h of holes) { if (ym <= h.y0 || ym >= h.y1) continue; const nx = []; for (const [p, q] of spans) { if (h.b <= p || h.a >= q) { nx.push([p, q]); continue; } if (h.a > p) nx.push([p, h.a]); if (h.b < q) nx.push([h.b, q]); } spans = nx; }
    for (const [p, q] of spans) { if (q - p < .004) continue; const n = Math.max(1, Math.round((q - p) / 1.5)); for (let i = 0; i < n; i++) { const b0 = p + (q - p) * i / n, b1 = p + (q - p) * (i + 1) / n, v = tone * (.93 + .12 * noise2(b0 * .6 + c, a0 * .8)); A.tint(v * rgb[0], v * rgb[1], v * rgb[2]);
      if (ax === 'x') { const a = [b0, a0, c], b = [b1, a0, c], cc = [b1, a1, c], d = [b0, a1, c]; s > 0 ? A.quad(...a, ...b, ...cc, ...d) : A.quad(...a, ...d, ...cc, ...b); }
      else { const a = [c, a0, b0], b = [c, a0, b1], cc = [c, a1, b1], d = [c, a1, b0]; s < 0 ? A.quad(...a, ...b, ...cc, ...d) : A.quad(...a, ...d, ...cc, ...b); } } } }
  A.end();
}
