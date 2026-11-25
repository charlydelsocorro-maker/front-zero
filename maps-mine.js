/* FRONT ZÉRO : Valferrade, bourg minier au fond d'une vallée de montagne. Trois niveaux : rues du bourg, hauteurs (chevalement, goulottes, toits, voie sur chevalet), galeries de mine.
   Nord : gare de chargement (4,8 m). Centre : le bourg (8,4 m). Sud : carreau de la mine (12 m). Le sol du moteur (y = 0) est celui des galeries.
   Même méthode que Roquesèche : le plan est peint sur une grille de 50 cm (H dessus du terrain, V plafond du vide, B occupation) et tout en découle. */
import { Arch, noise2, TAU, archMaterial } from './map-arch.js';

const S = 64, G = .5, N = 256, L1 = 4.8, L2 = 8.4, L3 = 12, ROOF = 11.4, TREAD = .42, RISE = .24, GH = 3.4;
const run = (dy, t = TREAD, r = RISE) => Math.ceil(dy / r - 1e-6) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const PLANKS = [[.92, .86, .8], [.84, .74, .64], [1, .9, .78], [.78, .76, .74], [.95, .8, .66], [.7, .64, .58]];
const PL2 = [[.86, .82, .74], [.8, .78, .74], [.88, .8, .7], [.76, .78, .8], [.84, .8, .72], [.9, .82, .72]];
const SHUTTERS = [[.36, .46, .34], [.56, .26, .2], [.3, .38, .5], [.62, .52, .3], [.4, .34, .28]];

let lastLayout = null;
export function buildValferrade(Kit) { if (lastLayout) return lastLayout; const g = valferradeSteps(Kit); let r; while (!(r = g.next()).done); return r.value; }
export function* valferradeSteps(Kit) {
  const k = new Kit('mineval', S, 5113); k.chunk = 43; k.limit('concrete');
  const H = new Float32Array(N * N), V = new Float32Array(N * N), B = new Uint8Array(N * N), TOP = new Float32Array(N * N), FL = new Uint8Array(N * N), CV = new Uint8Array(N * N), EDGE = new Uint8Array(N * N);
  const X = i => -S + (i + .5) * G, Ic = v => clamp(Math.floor((v + S) / G), 0, N - 1);
  const fill = (x0, x1, z0, z1, f) => { const a = Math.round((x0 + S) / G), b = Math.round((x1 + S) / G), c = Math.round((z0 + S) / G), d = Math.round((z1 + S) / G); for (let j = Math.max(0, c); j < Math.min(N, d); j++) for (let i = Math.max(0, a); i < Math.min(N, b); i++) f(j * N + i, i, j); };

  const RX = 57.25, RZ = 57.5, RC = 4, dOut = (x, z) => { const qx = Math.abs(x) - (RX - RC), qz = Math.abs(z) - (RZ - RC); return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - RC; };
  /* ---------- 1. relief : gare au nord, bourg, carreau au sud, falaises de part et d'autre ---------- */
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = X(i), z = X(j), c = j * N + i;
    if (dOut(x, z) > 0) { H[c] = 20; B[c] = 3; }
    else if (z < -36) { H[c] = L1; B[c] = 1; }
    else if (z < 36) { H[c] = L2; B[c] = 1; }
    else { H[c] = L3; B[c] = 1; }
  }
  const O = (l, x0, x1, z0, z1) => fill(x0, x1, z0, z1, c => { H[c] = l; B[c] = 0; });
  /* gare */ O(L1, -58, 58, -50, -36); O(L1, -12, -6, -58, -50); O(L1, 30, 36, -58, -50);
  /* bourg : rue haute, place, deux rues de travers, deux venelles */
  for (const r of [[-4, 4, -36, 36], [-15, 15, -8, 8], [-28, 28, -24, -20], [-28, 28, 20, 24], [-18, -15, -36, 36], [15, 18, -36, 36], [-15, -4, -2, 2]]) O(L2, ...r);
  /* couloir ouest (sous le chevalet) et cour de la laverie à l'est */
  O(L2, -58, -26, -36, 36); O(L2, 26, 58, -36, 14);
  /* carreau de la mine et terrasse des trémies */
  O(L3, -58, 58, 36, 50); O(L3, -22, 14, 50, 58); O(L3, 28, 58, 14, 36);
  /* rochers du couloir ouest : abris, jamais d'impasse */
  const ISL = [[-52, -14, 3.2, 3.2], [-34, 6, 2.4, 2.2], [-53, 18, 2.8, 4], [-33, -26, 2.2, 2.4], [-52, 30, 2.6, 2.6]];
  for (const [cx, cz, r, h] of ISL) fill(cx - r - 1, cx + r + 1, cz - r - 1, cz + r + 1, (c, i, j) => { const d = Math.hypot(X(i) - cx, (X(j) - cz) * 1.2) - r * (1 + .22 * noise2(X(i) * .7, X(j) * .7)); if (d < 0) { H[c] = L2 + h; B[c] = 3; EDGE[c] = 2; } });
  /* la laverie : un grand bâtiment au bout de la cour, entre la cour et la terrasse */
  fill(47, 57, -28, 4, c => { B[c] = 1; H[c] = L2; });
  /* falaises : profil continu (face presque verticale sur 2,6 m, puis pente arrondie), même fonction pour les collisions et le maillage */
  const inH = (x, z) => { let px = clamp(x, -(RX - RC), RX - RC), pz = clamp(z, -(RZ - RC), RZ - RC); const dx = x - px, dz = z - pz, l = Math.hypot(dx, dz); if (l > 1e-6) { const n = Math.ceil(l / .4); for (let q = 1; q <= n; q++) { const tx = px + dx / n, tz = pz + dz / n; if (dOut(tx, tz) > -.3) break; px = tx; pz = tz; } } return H[Ic(pz) * N + Ic(px)]; };
  const cliffTop = (x, z) => 17 + 7 * noise2(x * .045 + 3, z * .045) + (z > 20 ? 3 : 0) - (z < -40 ? 4 : 0);
  const prof = (x, z, fl) => { const d = dOut(x, z); if (d <= 0) return fl; const face = 2.6 * Math.min(1, Math.sqrt(d / .15)), ht = Math.max(fl + 5, cliffTop(x, z)), body = d > .15 ? (ht - fl - 2.6) * (1 - Math.exp(-(d - .15) / 2.4)) : 0, nz = (noise2(x * .2, z * .2) - .5) * 1.4 * Math.min(1, d / 2), out = 3 * Math.max(0, noise2(x * .08 + 7, z * .08) - .62) * Math.min(1, d / 3); return fl + face + Math.max(0, body) + nz + out; };
  { const hh = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = X(i), z = X(j); if (dOut(x, z) <= 0) continue; const pv = prof(x, z, inH(x, z)), dd = dOut(x, z); hh[j * N + i] = dd < 2.2 ? Math.round(pv * 2) / 2 : Math.ceil(pv / 3) * 3; } for (let c = 0; c < N * N; c++) if (hh[c]) { H[c] = hh[c]; B[c] = 3; EDGE[c] = 1; } }

  yield;
  /* ---------- 2. galeries ---------- */
  const VOID = (x0, x1, z0, z1, t) => fill(x0, x1, z0, z1, c => { V[c] = t; });
  const SLOT = (x0, x1, z0, z1) => fill(x0, x1, z0, z1, c => { H[c] = 0; V[c] = 0; B[c] = 5; });
  VOID(-37, -33.5, -46, 40, GH);       // galerie ouest
  VOID(33.5, 37, -46, 40, GH);         // galerie est
  VOID(-33.5, 33.5, 8, 11.5, GH);      // travers-banc du wagonnet
  VOID(12, 24, 11.5, 22, 4.2);         // puisard noyé
  VOID(24, 33.5, 16, 19.5, GH);        // recoupe du puisard
  VOID(-33.5, -26, -12, -8.5, GH);     // recoupe vers la descente du couloir ouest
  /* descentes : gare -> galeries (une volée), carreau -> galeries (deux volées), place -> travers-banc (deux volées), couloir ouest -> recoupe */
  const fRun = run(L1, .42, .24), hRun = run(L3 / 2, .4, .24), qRun = run(L2 / 2, .4, .24), wRun = run(L2 / 2, .4, .24);
  SLOT(-36.4, -34, -46 - fRun, -46); SLOT(34, 36.4, -46 - fRun, -46);
  SLOT(-37, -33.5, 40, 40 + hRun + 1.6); SLOT(33.5, 37, 40, 40 + hRun + 1.6);
  SLOT(-11.6, -8.1, 8 - qRun - 1.6, 8);
  SLOT(-29.5, -26, -8.5, -8.5 + wRun + 1.6);

  yield;
  /* ---------- 3. bâtiments ouverts et toits-terrasses ---------- */
  const OPEN = [
    { x0: -15, x1: -4, z0: -17, z1: -8, base: L2, doors: { zp: [-7.5], xp: [-12.5] }, up: {}, st: 1, lower: 'ar_stonewall', upper: 'ar_plank', roofM: 'ar_tin', stair: { x: -13.76, z: -15.14, dir: 'z+', rail: 1 } },   /* volée contre le mur ouest (portes au nord et à l'est), 1,5 m d'abord au pied, 1,3 m de palier en haut */
    { x0: 4, x1: 15, z0: 8, z1: 17, base: L2, doors: { zn: [10.5], xn: [12.5] }, up: {}, st: 1, lower: 'ar_plaster', upper: 'ar_plaster', roofM: 'ar_shingle', stair: { x: 13.76, z: 15.14, dir: 'z-', rail: -1 }, crates: [[5, 9.3, .8], [5, 10.3, .7]] },   /* volée contre le mur est, pied au nord, loin de la porte sud (elle partait devant) */
  ];
  for (const h of OPEN) fill(h.x0, h.x1, h.z0, h.z1, c => { if (B[c] !== 5) { B[c] = 4; H[c] = h.base; } CV[c] = 1; });
  const TERR = [[-15, -4, -36, -24], [4, 15, -36, -24], [-15, -4, 24, 36], [4, 15, 24, 36]];
  for (const r of TERR) fill(r[0], r[1], r[2], r[3], c => { if (B[c] === 1) FL[c] = 1; });

  yield;
  /* ---------- 4. parcelles bâties ---------- */
  const rP = k.r, parcels = [], used = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = j * N + i; if (B[c] !== 1 || used[c]) continue; const h = H[c], f = FL[c], ok = (a, b) => { if (a >= N || b >= N) return false; const q = b * N + a; return B[q] === 1 && !used[q] && H[q] === h && FL[q] === f; };
    const mill = X(i) > 46 && h === L2, mw = Math.round((f ? 10 : mill ? 10 : 5 + rP() * 5) / G), md = Math.round((f ? 10 : mill ? 16 : 5 + rP() * 5) / G); let w = 1; while (w < mw && ok(i + w, j)) w++; let d = 1; grow: while (d < md) { for (let q = 0; q < w; q++) if (!ok(i + q, j + d)) break grow; d++; }
    for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) used[(j + b) * N + i + a] = 1;
    const x0 = -S + i * G, x1 = x0 + w * G, z0 = -S + j * G, z1 = z0 + d * G, st = f ? 1 : mill ? 2 : rP() < .5 ? 2 : 1, top = f ? ROOF : mill ? h + 7.6 : h + (st === 1 ? 3.3 + rP() * .4 : 6.1 + rP() * .6);
    const p = { x0, x1, z0, z1, i, j, w, d, base: h, top: Math.round(top * 10) / 10, flat: !!f, st, mill, col: PLANKS[Math.floor(rP() * PLANKS.length)], sh: SHUTTERS[Math.floor(rP() * SHUTTERS.length)] }; p.style = mill ? 'timber' : f ? 'stone' : (q => q < .38 ? 'stone' : q < .68 ? 'plaster' : 'timber')(rP()); p.up = rP() < .5 ? 'ar_plank' : 'ar_plaster'; p.roofM = mill || rP() < .42 ? 'ar_tin' : 'ar_shingle'; p.pl = PL2[Math.floor(rP() * PL2.length)]; parcels.push(p);
    for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) TOP[(j + b) * N + i + a] = p.top;
  }
  { const off = parcels.find(p => p.base === L2 && p.x0 <= 19.5 && p.x1 >= 19.5 && p.z0 <= 0 && p.z1 >= 0); if (off) { off.style = 'brick'; off.roofM = 'ar_tin'; off.st = 2; off.top = Math.max(off.top, L2 + 6.6); fill(off.x0, off.x1, off.z0, off.z1, c => { TOP[c] = off.top; }); } }
  for (let c = 0; c < N * N; c++) if (!TOP[c]) TOP[c] = H[c];
  for (const h of OPEN) fill(h.x0, h.x1, h.z0, h.z1, c => { if (B[c] === 4) TOP[c] = h.base + 5.8; });

  yield;
  /* ---------- 5. lumière cuite ---------- */
  const LAMPS = [];
  for (let z = -42; z <= 36; z += 9.5) { LAMPS.push([-35.25, 2.6, z, 1]); LAMPS.push([35.25, 2.6, z, 1]); }
  for (let x = -28; x <= 28; x += 9.3) LAMPS.push([x, 2.6, 9.75, 1]);
  for (const p of [[18, 3.2, 16.5, 1.15], [-29.5, 2.6, -10.3, 1], [-9.8, 2.6, 4, 1, 1], [28.7, 2.6, 17.7, 1]]) LAMPS.push(p);
  const UG = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = V[j * N + i]; if (v > 0) for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const q = clamp(j + b, 0, N - 1) * N + clamp(i + a, 0, N - 1); if (UG[q] < v + .35) UG[q] = v + .35; } }
  yield;
  const SN = 64, SKY = new Float32Array(SN * SN), DIR = []; for (let a = 0; a < 8; a++) DIR.push([Math.cos(a / 8 * TAU), Math.sin(a / 8 * TAU)]);
  for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) { const cx = -S + (i + .5) * 2, cz = -S + (j + .5) * 2; let lo = 1e9; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const q = Ic(cz + b * .7) * N + Ic(cx + a * .7); if (TOP[q] < lo) lo = TOP[q]; } let occ = 0; for (const [dx, dz] of DIR) { let m = 0; for (const r of [1.6, 3, 5, 8, 12]) { const q = Ic(cz + dz * r) * N + Ic(cx + dx * r), e = (TOP[q] - lo - 1.2) / r; if (e > m) m = e; } occ += Math.min(1, Math.atan(m) / 1.2); } SKY[j * SN + i] = 1 - occ / 8; }
  const bake = (x, y, z, ny, o) => {
    const c = Ic(z) * N + Ic(x);
    if (y < UG[c]) { let r = .28, g = .29, b = .31; for (let i = 0; i < LAMPS.length; i++) { const l = LAMPS[i], dx = x - l[0]; if (dx > 11 || dx < -11) continue; const dz = z - l[2]; if (dz > 11 || dz < -11) continue; const dy = y - l[1], q = dx * dx + dz * dz + dy * dy * 1.4; if (q > 121) continue; const f = l[3] * 3.4 / (1 + q * .2) * (1 - q / 121); r += f * 1.1; g += f * .76; b += f * .42; } const m = ny < -.5 ? .82 : ny > .5 ? 1.06 : 1, fl = y < .35 ? .76 + y * .7 : 1; o[0] = Math.min(1.5, r * m * fl); o[1] = Math.min(1.3, g * m * fl * (ny > .5 ? .92 : 1)); o[2] = Math.min(1.1, b * m * fl * (ny > .5 ? .7 : 1)); return; }
    const si = clamp(Math.floor((x + S) / 2), 0, SN - 1), sj = clamp(Math.floor((z + S) / 2), 0, SN - 1), sk = SKY[sj * SN + si], fl = H[c], up = clamp((y - fl) / 4.2, 0, 1); let v = (.54 + .5 * sk) + (1 - sk) * .34 * up; if (y - fl < .55 && y >= fl - .02) v *= .8 + .2 * clamp((y - fl) / .55, 0, 1); if (ny < -.5) v *= .66;
    let r = v * .98, g = v, b = v * 1.03; if (CV[c] && y < TOP[c] + .1) { r *= .6; g *= .6; b *= .58; } o[0] = r; o[1] = g; o[2] = b;
  };
  const A = new Arch(k, bake); A.merge = new Set(['ar_dark', 'ar_cloth', 'lampA', 'ar_leaf', 'ar_gravel']); A.under = (x, z, top) => { const c = Ic(z) * N + Ic(x); return top <= UG[c] && H[c] >= top + .5; };

  yield;
  /* ---------- 6. collisions du terrain ---------- */
  { const done = new Uint8Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = j * N + i; if (done[c] || H[c] <= 0) continue; const h = H[c], v = V[c], same = (a, b) => a < N && b < N && !done[b * N + a] && H[b * N + a] === h && V[b * N + a] === v; let w = 1; while (same(i + w, j)) w++; let d = 1; g2: while (j + d < N) { for (let q = 0; q < w; q++) if (!same(i + q, j + d)) break g2; d++; } for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) done[(j + b) * N + i + a] = 1; const s = k.col(-S + i * G, -S + (i + w) * G, v, h, -S + j * G, -S + (j + d) * G, 'concrete'); s.mm = 0; s.occ = 1; } }
  const sol = (x0, x1, y0, y1, z0, z1, surf = 'concrete') => { const s = k.col(x0, x1, y0, y1, z0, z1, surf); s.mm = 1; return s; };

  yield;
  /* ---------- 7. parements : murs de soutènement en moellons, roche nue des falaises et des galeries ---------- */
  const expose = (cA, cB) => { const out = [], a0 = V[cA], a1 = H[cA]; if (a1 <= 0) return out; const add = (p, q) => { const l = Math.max(p, a0), h = Math.min(q, a1); if (h - l > .05) out.push(l, h); }; if (V[cB] > 0) add(0, V[cB]); add(B[cB] === 1 || B[cB] === 4 ? TOP[cB] : H[cB], 99); return out; };
  const wallRuns = function* (ax) { for (const s of [-1, 1]) for (let l = 0; l < N; l++) { if (!(l & 7)) yield; let m = 0; while (m < N) { const cc = (u) => (ax === 'x' ? l * N + u : u * N + l), nb = (u) => { const q = l + s; if (q < 0 || q >= N) return -1; return ax === 'x' ? q * N + u : u * N + q; }, c = cc(m), n = nb(m); if (EDGE[c]) { m++; continue; } if (n < 0 || (V[n] <= V[c] && (B[n] === 1 || B[n] === 4 ? TOP[n] : H[n]) >= H[c])) { m++; continue; } const e = expose(c, n); if (!e.length) { m++; continue; } let t = m + 1; while (t < N) { const c2 = cc(t), n2 = nb(t); if (n2 < 0 || EDGE[c2]) break; const e2 = expose(c2, n2); if (e2.length !== e.length || e2.some((v, q) => v !== e[q])) break; t++; } const u0 = -S + m * G, u1 = -S + t * G, w = -S + (l + (s > 0 ? 1 : 0)) * G;
      for (let q = 0; q < e.length; q += 2) { const low = e[q], high = e[q + 1], gal = V[n] > 0 && high <= 4.8, rock = B[c] === 3 || gal; A.sheet(rock ? 'ar_rock' : 'ar_stonewall', ax, w, s, u0, u1, low, high, { strata: gal ? .16 : 0, rough: rock ? (gal ? .3 : .38) : .045, du: rock ? (gal ? .7 : .8) : 1.4, dy: rock ? (gal ? .3 : .7) : 1.1, tone: rock ? (gal ? .9 : .8) : .9, top: B[c] === 3 && high > L2 + 1 ? (u => high - .7 * noise2(u * .45, w) - .25 * noise2(u * 2.1, w)) : null }); } m = t; } } };
  yield* wallRuns('x'); yield* wallRuns('z');

  yield;
  /* ---------- 8. sols ; plafonds de galerie en planches de garnissage ---------- */
  { const T = 8, bins = new Map(); const bin = (key, m, h, i, j, extra) => { if (!bins.has(key)) bins.set(key, { m, h, cells: [], ...extra }); bins.get(key).cells.push(i, j); };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = j * N + i, ti = Math.floor(i * G / T), tj = Math.floor(j * G / T); if (B[c] !== 1 && B[c] !== 5 && !EDGE[c]) { const h = H[c], rock = B[c] === 3, sq = h === L2 && Math.abs(X(i)) < 13 && Math.abs(X(j)) < 8, m = rock ? 'ar_rock' : CV[c] === 1 ? 'ar_plank' : sq ? 'ar_cobble' : 'ar_gravel'; bin(m + '|' + h + '|' + ti + '|' + tj, m, h, i, j, { rock }); } if (V[c] > 0) { bin('g|u|' + ti + '|' + tj, 'ar_gravel', .012, i, j, { ug: 1 }); bin('c|' + V[c] + '|' + ti + '|' + tj, 'ar_plank', V[c], i, j, { ceil: 1 }); } }
    let nB = 0; for (const b of bins.values()) { if (!(++nB & 7)) yield; A.begin(b.m); const y = b.h === 0 ? .014 : b.h, W = (x, z) => (b.ceil ? y - .02 * noise2(x * 2, z * 2) : b.m === 'ar_gravel' ? y + (b.ug ? .03 : .08) * noise2(x * .35, z * .35) : y + .012 * noise2(x * 3, z * 3)); const seen = new Set(); for (let q = 0; q < b.cells.length; q += 2) seen.add(b.cells[q + 1] * N + b.cells[q]);
      for (let q = 0; q < b.cells.length; q += 2) { const ci = b.cells[q], cj = b.cells[q + 1], id = cj * N + ci; if (!seen.has(id)) continue; const big = !(ci & 1) && !(cj & 1) && seen.has(id + 1) && seen.has(id + N) && seen.has(id + N + 1); seen.delete(id); if (big) { seen.delete(id + 1); seen.delete(id + N); seen.delete(id + N + 1); } const x0 = -S + ci * G, z0 = -S + cj * G, x1 = x0 + (big ? 1 : G), z1 = z0 + (big ? 1 : G), t = b.ceil ? .5 : b.rock ? .62 + .3 * noise2(x0 * .4, z0 * .4) : b.m === 'ar_gravel' ? .78 + .2 * noise2(x0 * .3, z0 * .3) : .92;
        A.tint(t, t * (b.m === 'ar_gravel' ? .97 : 1), t * (b.m === 'ar_gravel' ? .93 : 1)); if (b.ceil) A.quad(x0, W(x0, z0), z0, x1, W(x1, z0), z0, x1, W(x1, z1), z1, x0, W(x0, z1), z1); else A.quad(x0, W(x0, z1), z1, x1, W(x1, z1), z1, x1, W(x1, z0), z0, x0, W(x0, z0), z0); } A.end(); } }

  yield;
  /* ---------- 8b. falaises : un maillage continu le long du périmètre arrondi, normales lissées ; neige sur les replats hauts ---------- */
  const PER = []; { const ax = RX - RC, az = RZ - RC, add = (x, z, nx, nz) => PER.push([x, z, nx, nz]);
    for (let x = -ax; x < ax - .01; x += 1) add(x, -RZ, 0, -1); for (let q = 0; q < 6; q++) { const a = -Math.PI / 2 + q / 6 * Math.PI / 2; add(ax + Math.cos(a) * RC, -az + Math.sin(a) * RC, Math.cos(a), Math.sin(a)); }
    for (let z = -az; z < az - .01; z += 1) add(RX, z, 1, 0); for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI / 2; add(ax + Math.cos(a) * RC, az + Math.sin(a) * RC, Math.cos(a), Math.sin(a)); }
    for (let x = ax; x > -ax + .01; x -= 1) add(x, RZ, 0, 1); for (let q = 0; q < 6; q++) { const a = Math.PI / 2 + q / 6 * Math.PI / 2; add(-ax + Math.cos(a) * RC, az + Math.sin(a) * RC, Math.cos(a), Math.sin(a)); }
    for (let z = az; z > -az + .01; z -= 1) add(-RX, z, -1, 0); for (let q = 0; q < 6; q++) { const a = Math.PI + q / 6 * Math.PI / 2; add(-ax + Math.cos(a) * RC, -az + Math.sin(a) * RC, Math.cos(a), Math.sin(a)); }
    const loop = PER.concat([PER[0]]), TT = [0, .15, .32, .55, .85, 1.2, 1.65, 2.2, 2.9, 3.8, 4.9, 6.3, 8.2, 11, 15, 20, 26];
    const rows = loop.map(([bx, bz, nx, nz]) => { let pT = -1; return TT.map((t, ti) => { if (ti < 2) { pT = t; const x = bx + nx * t, z = bz + nz * t, y = prof(x, z, inH(x, z)); return [x, y, z, .58, .56, .53]; } const jit = (noise2(bx * .3 + t, bz * .3) - .5) * 1.2, y0 = prof(bx + nx * t, bz + nz * t, inH(bx + nx * t, bz + nz * t)), off = (noise2(bx * .35 + y0 * .2, bz * .35 - y0 * .3) - .5) * 1.6 * Math.min(1, (t - .15) / .6), tt = Math.max(.2, t + jit + off, pT + .12), x = bx + nx * tt, z = bz + nz * tt, fl = inH(x, z); let y = prof(x, z, fl);
      const ph = noise2(bx * .05, bz * .05) * 1.7, q = (y - fl + ph) / 1.7, fr = q - Math.floor(q), sm = fr < .62 ? fr * .3 : .186 + (fr - .62) * 2.14, ter = (Math.floor(q) + sm) * 1.7 - ph + fl; y = y * .45 + ter * .55 + (noise2(x * .45, z * .45) - .5) * .6 + (noise2(x * 1.3, z * 1.3) - .5) * .25;
      const n = noise2(x * .11, z * .11), cr = noise2(x * .5 + 9, z * .5), band = Math.floor((y + 2.4 * noise2(x * .03 + 5, z * .03)) / .8), SP = [[1.18, 1.12, 1.02], [.8, .79, .78], [1.08, .97, .84], [.66, .66, .69], [.98, .93, .87], [1.24, 1.17, 1.07], [.76, .71, .66]], sc = SP[Math.floor(noise2(band * 1.37 + .5, 3.3) * 6.999)], strk = .8 + .34 * noise2((x + z) * 1.1, y * .12), v = 1.3 * (.6 + .24 * n) * (cr < .3 ? .7 : 1) * (fr < .62 ? 1.3 : .78) * strk; pT = tt; return [x, y, z, v * sc[0], v * sc[1] * .97, v * sc[2] * .93]; }); });
    const inward = (x, y, z) => { const qx = Math.abs(x) - (RX - RC), qz = Math.abs(z) - (RZ - RC); let dx, dz; if (qx > 0 && qz > 0) { dx = -Math.sign(x) * qx; dz = -Math.sign(z) * qz; } else if (qx > qz) { dx = -Math.sign(x); dz = 0; } else { dx = 0; dz = -Math.sign(z); } const l = Math.hypot(dx, dz) || 1; return [dx / l, .5, dz / l]; };
    for (let i0 = 0; i0 < rows.length - 1; i0 += 40) A.surface('ar_rock', rows, inward, { i0, i1: i0 + 40 });
    const snowy = p => p[1] > 14 && noise2(p[0] * .06 + 4, p[2] * .06) > .47;
    { const SR = rows.map(r => r.map(p => [p[0], p[1], p[2], 1, 1, 1])), keep = (i, j) => j >= 9 && snowy(rows[i][j]) && snowy(rows[i + 1][j]) && snowy(rows[i][j + 1]) && snowy(rows[i + 1][j + 1]); for (let i0 = 0; i0 < rows.length - 1; i0 += 40) A.surface('ar_snow', SR, () => [0, 1, 0], { lift: .06, keep, i0, i1: i0 + 40 }); } }

  /* rochers du couloir ouest : bosses arrondies (face raide sur la hauteur d'un homme, sommet bombé), plus de blocs */
  for (const [cx, cz, r, h] of ISL) { const NA = 26, RINGS = [[.12, -.05, 0], [.3, .38, 0], [.2, .78, 0], [-.06, 1, .1], [-.3, 1, .32], [-.62, 1, .44], [-1, 1, .48]], rows = [];
    for (let a = 0; a <= NA; a++) { const th = (a % NA) / NA * TAU, ct = Math.cos(th), st = Math.sin(th); let R = r; for (let q = 0; q < 3; q++) { const x = cx + R * ct, z = cz + R * st / 1.2; R = r * (1 + .22 * noise2(x * .7, z * .7)); }
      rows.push(RINGS.map(([dr, hf, dh], ri) => { const rr = ri < 3 ? R + dr : Math.max(0, R * (1 + dr)), bump = ri > 0 && ri < 6 ? (noise2(cx + th * 5, ri * 1.7 + cz) - .5) * .45 + (noise2(cz + th * 11, ri) - .5) * .18 : 0, x = cx + (rr + bump) * ct, z = cz + (rr + bump) * st / 1.2, y = L2 + h * hf + dh + (ri >= 3 ? (noise2(x * .9, z * .9) - .5) * .2 : 0), v = .62 + .2 * noise2(x * .4, z * .4); return [x, y, z, v, v * .97, v * .93]; })); }
    A.surface('ar_rock', rows, (x, y, z) => { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; return [dx / l, .8, dz / l]; }); }

  yield;
  /* ---------- 9. maisons : soubassements de pierre ou de béton, maçonnerie et bois mêlés, tôle ou bardeaux, cheminées et tuyaux de poêle, porches ; bureau de la compagnie en brique ---------- */
  const TOPAT = (x, z) => TOP[Ic(z) * N + Ic(x)], openAt = (x, z) => { const q = B[Ic(z) * N + Ic(x)]; return q !== 1 && q !== 3 && q !== 4 && q !== 5; };
  let px2 = 0, pz2 = 0; const pt2 = (ax, u, q) => { if (ax === 'x') { px2 = u; pz2 = q; } else { px2 = q; pz2 = u; } };
  const STAIRS2 = [[-4.2, 4.2, -42.5, -36], [-18.3, -14.7, -42.5, -36], [14.7, 18.3, -42.5, -36], [-46.3, -41.7, -42.5, -36], [41.7, 46.3, -42.5, -36], [-4.2, 4.2, 29.5, 36], [-18.3, -14.7, 29.5, 36], [14.7, 18.3, 29.5, 36], [-14.2, -7, -24.2, -22.2], [7, 14.2, -24.2, -22.2], [-14.2, -7, 22.2, 24.2], [7, 14.2, 22.2, 24.2], [-12, -7.6, -2, 8.2]];
  const nearStair = (x0, x1, z0, z1) => STAIRS2.some(q => x0 < q[1] && x1 > q[0] && z0 < q[3] && z1 > q[2]);
  const UQ = (a, b, c, d) => { const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]); if (ny >= 0) A.quad(...a, ...b, ...c, ...d); else A.quad(...a, ...d, ...c, ...b); };
  /* porche couvert le long d'une façade sur rue : poteaux, sablière, appentis (vu dessus et dessous), plancher affleurant */
  const porch = (p, ax, w, s, a, b) => { const y = p.base, D = 1.55, yr = y + 2.75, P2 = (u, v) => (ax === 'x' ? [u, v] : [v, u]), P3 = (u, v, h) => (ax === 'x' ? [u, h, v] : [v, h, u]);
    A.begin('ar_wood'); A.tint(.42, .34, .27); const n = Math.max(2, Math.round((b - a) / 2.1)); for (let i = 0; i <= n; i++) { const u = a + (b - a) * i / n, [px, pz] = P2(u, w + s * (D - .12)); A.log(px, y, pz, px, yr, pz, .09, { seg: 6, n: 1, taper: 0 }); k.disc(px, pz, .1, y, yr, 'wood'); }
    { const [x0, z0] = P2(a - .1, w + s * (D - .12)), [x1, z1] = P2(b + .1, w + s * (D - .12)); A.log(x0, yr, z0, x1, yr, z1, .1, { seg: 6, n: 1 }); } A.end();
    const tinP = p.roofM === 'ar_tin', E = D + .25, ya = yr + .55, yb = yr - .02, yAt = t => ya + (yb - ya) * t / E, ua = a - .25, ub = b + .25, tk = .06, BB = (u0, u1, h0, h1, t0, t1) => { const [xa, za] = P2(u0, w + s * t0), [xb, zb] = P2(u1, w + s * t1); A.box(Math.min(xa, xb), Math.max(xa, xb), h0, h1, Math.min(za, zb), Math.max(za, zb)); };
    A.begin(p.roofM); A.tint(tinP ? .92 : .86); const q1 = P3(ua, w, ya), q2 = P3(ub, w, ya), q3 = P3(ub, w + s * E, yb), q4 = P3(ua, w + s * E, yb); UQ(q1, q2, q3, q4); const lift = v => [v[0], v[1] - tk, v[2]];
    A.tint(tinP ? .6 : .55); BB(ua, ub, yb - tk - .005, yb + .004, E - .02, E); for (const u of [ua, ub]) { const e1 = P3(u, w, ya + .004), e2 = P3(u, w + s * E, yb + .004), e3 = P3(u, w + s * E, yb - tk), e4 = P3(u, w, ya - tk); A.quad(...e1, ...e2, ...e3, ...e4); A.quad(...e1, ...e4, ...e3, ...e2); } A.end();
    A.begin('ar_wood'); A.tint(.44, .35, .27); BB(ua, ub, ya - tk - .2, ya + .035, 0, .07); BB(ua + .02, ub - .02, yAt(E - .1) - tk - .15, yAt(E - .1) - tk + .01, E - .13, E - .09); A.end();
    A.begin('ar_wood'); A.tint(.5, .4, .31); { const nr = Math.max(2, Math.round((ub - ua) / .9)); for (let i = 0; i <= nr; i++) { const u = ua + .1 + (ub - ua - .2) * i / nr, [rx0, rz0] = P2(u, w + s * .07), [rx1, rz1] = P2(u, w + s * (E - .13)); A.log(rx0, yAt(.07) - tk - .045, rz0, rx1, yAt(E - .13) - tk - .045, rz1, .05, { seg: 4, n: 1, taper: 0, wob: 0 }); } } A.end(true);
    A.begin('ar_plank'); A.tint(.55, .48, .4); { const l1 = lift(q1), l2 = lift(q2), l3 = lift(q3), l4 = lift(q4), ny = (l2[2] - l1[2]) * (l3[0] - l1[0]) - (l2[0] - l1[0]) * (l3[2] - l1[2]); if (ny < 0) A.quad(...l1, ...l2, ...l3, ...l4); else A.quad(...l1, ...l4, ...l3, ...l2); } A.end();
    A.begin('ar_plank'); A.tint(.62, .55, .47); const nb = Math.max(2, Math.round((b - a) / .9)); for (let i = 0; i < nb; i++) { const u0 = a + (b - a) * i / nb + .01, u1 = a + (b - a) * (i + 1) / nb - .01; UQ(P3(u0, w + s * .02, y + .015), P3(u1, w + s * .02, y + .015), P3(u1, w + s * (D - .02), y + .015), P3(u0, w + s * (D - .02), y + .015)); } A.end(); };
  function dressFace(p, ax, w, s, u0, u1, y0, hasPorch) {
    const L = u1 - u0, wallTop = p.top, floorH = p.base, r = A; if (L < 1.2) return;
    const street = y0 <= floorH + .05, brick = p.style === 'brick', stoneLow = p.style === 'stone' || brick, fmL = stoneLow ? undefined : 'ar_wood', fmU = brick || (p.style === 'stone' && p.up === 'ar_plaster') ? undefined : 'ar_wood';
    const nW = Math.max(1, Math.floor(L / (brick ? 2.1 : 2.6))), cell = L / nW;
    for (let i = 0; i < nW; i++) { const uc = u0 + cell * (i + .5) + (brick ? 0 : (r.r() - .5) * .3), f = r.r();
      if (wallTop - floorH > 3.6) { const y = floorH + 3.5; if (y + 1.1 < wallTop - .2) { const bx0 = ax === 'x' ? uc - 1 : Math.min(w, w + s * 1), bx1 = ax === 'x' ? uc + 1 : Math.max(w, w + s * 1), bz0 = ax === 'x' ? Math.min(w, w + s * 1) : uc - 1, bz1 = ax === 'x' ? Math.max(w, w + s * 1) : uc + 1; if (f < .16 && L > 2.6 && !p.mill && !brick && !hasPorch && !nearStair(bx0, bx1, bz0, bz1)) r.balcony(ax, w, s, uc - .9, uc + .9, floorH + 3.1, { d: .8, m: 'ar_wood', rail: 'ar_wood' }); r.window(ax, w, s, uc, y, brick ? .8 : .7, brick ? 1.35 : 1.1, { col: p.sh, fm: fmU, planter: f > .84 && !brick, mull: p.style === 'timber' ? 2 : brick || f > .55 ? 1 : 0, arched: brick, shutter: !brick && f > .3 }); } }
      if (street) { if (f < .22 && L > 2.8) { const a = uc - .58, b = uc + .58, tp = floorH + 2.25; r.begin('ar_dark'); r.tint(.26); const c1 = w + s * .006; r.quad(...(ax === 'x' ? (s > 0 ? [a, floorH, c1, b, floorH, c1, b, tp, c1, a, tp, c1] : [b, floorH, c1, a, floorH, c1, a, tp, c1, b, tp, c1]) : (s > 0 ? [c1, floorH, b, c1, floorH, a, c1, tp, a, c1, tp, b] : [c1, floorH, a, c1, floorH, b, c1, tp, b, c1, tp, a]))); r.end(true); r.doorLeaf(ax, w + s * .1, s, a + .02, b - .02, floorH, tp - (stoneLow ? .35 : 0), { col: p.sh.map(v => v * 1.2) });
          if (stoneLow) r.arch(ax, w + s * .004, a, b, floorH, tp - .45, tp + .1, .09, { col: false, n: 9, th: .2, proud: .01, pointed: false }); else r.beam(ax, w, s, uc, tp + .08, .14, .16); }
        else if (f < .93) r.window(ax, w, s, uc, floorH + 1.2, brick ? .8 : .66, brick ? 1.3 : .98, { col: p.sh, open: f < .6, fm: fmL, mull: f > .5 || brick ? 1 : 0, arched: (p.style === 'stone' && f > .78) || brick, shutter: !brick }); }
      else if (wallTop - y0 > 1.9) r.window(ax, w, s, uc, Math.max(y0 + .7, wallTop - 2), .6, .85, { col: p.sh, fm: fmU });
    }
    if (L > 3 && street && r.r() < .3) { pt2(ax, r.r() < .5 ? u0 + .12 : u1 - .12, w + s * .08); r.drainpipe(px2, pz2, floorH, wallTop - .12); }
    if (L > 3 && !stoneLow && r.r() < .45) { const n = Math.floor(L / 1.1); for (let i = 0; i < n; i++) r.beam(ax, w, s, u0 + (i + .5) * L / n, wallTop - .25, .45, .12); }
    if (brick) r.cornice(ax, w, s, u0, u1, wallTop - .3, { d: .14, h: .26 });
  }
  let nP = 0; for (const p of parcels) { if (!(++nP & 7)) yield;
    const s = sol(p.x0, p.x1, p.base, p.top, p.z0, p.z1); s.occ = 1; const st = p.style, lowTop = p.base + (st === 'stone' ? (p.st === 2 ? 3.05 : p.top - p.base) : st === 'brick' ? 0 : st === 'plaster' ? .9 : p.mill ? 2.4 : .6);
    const faces = [['x', p.z0, -1, p.x0, p.x1], ['x', p.z1, 1, p.x0, p.x1], ['z', p.x0, -1, p.z0, p.z1], ['z', p.x1, 1, p.z0, p.z1]];
    for (const [ax, w, sd, a, b] of faces) { let u = a; while (u < b - 1e-6) { const oX = ax === 'x' ? u + .25 : w + sd * .25, oZ = ax === 'x' ? w + sd * .25 : u + .25, t0 = TOPAT(oX, oZ); if (t0 >= p.top - .05) { u += G; continue; } let e = u + G; while (e < b - 1e-6) { const q = ax === 'x' ? TOPAT(e + .25, w + sd * .25) : TOPAT(w + sd * .25, e + .25); if (Math.abs(q - t0) > .01) break; e += G; } const y0 = Math.max(p.base, t0);
      if (st === 'brick') A.sheet('ar_brick', ax, w, sd, u, e, y0, p.top, { rough: .006, du: 1.6, dy: 1.2, tone: .95 });
      else { if (y0 < lowTop) { const conc = st === 'timber' && !p.mill; A.sheet(conc ? 'ar_ashlar' : 'ar_stonewall', ax, w + sd * (lowTop < p.top - .05 ? .012 : 0), sd, u, e, y0, Math.min(p.top, lowTop), { rough: conc ? .004 : .02, du: 1, dy: .7, tone: conc ? .66 : .9, rgb: conc ? [.92, .94, .96] : undefined, top: lowTop < p.top - .05 ? (q => Math.min(p.top, lowTop) + .05 * noise2(q * 1.3, w)) : null }); }
        if (lowTop < p.top - .05) { const um = st === 'stone' ? p.up : st === 'plaster' ? 'ar_plaster' : 'ar_plank'; A.sheet(um, ax, w, sd, u, e, Math.max(y0, lowTop - .05), p.top, { rgb: um === 'ar_plaster' ? p.pl : p.col, rough: um === 'ar_plaster' ? .02 : .012, du: um === 'ar_plaster' ? 1.4 : 2.2, dy: 1.6, tone: .95 }); } }
      let hasPorch = false; const span = e - u, street5 = (q) => openAt(ax === 'x' ? q : w + sd * 5.2, ax === 'x' ? w + sd * 5.2 : q) && openAt(ax === 'x' ? q : w + sd * 1.4, ax === 'x' ? w + sd * 1.4 : q) && openAt(ax === 'x' ? q : w + sd * .3, ax === 'x' ? w + sd * .3 : q);
      if ((st === 'timber' || st === 'plaster') && !p.mill && y0 <= p.base + .05 && span >= 3.6 && p.base === L2) { const pa = u + .4, pb = Math.min(e - .4, pa + 7.5), mid = (pa + pb) / 2, bx0 = ax === 'x' ? pa : Math.min(w, w + sd * 1.8), bx1 = ax === 'x' ? pb : Math.max(w, w + sd * 1.8), bz0 = ax === 'x' ? Math.min(w, w + sd * 1.8) : pa, bz1 = ax === 'x' ? Math.max(w, w + sd * 1.8) : pb;
        if (street5(pa + .1) && street5(mid) && street5(pb - .1) && !nearStair(bx0, bx1, bz0, bz1) && A.r() < .7) { porch(p, ax, w, sd, pa, pb); hasPorch = true; } }
      { const ox = ax === 'x' ? (u + e) / 2 : w + sd * .3, oz = ax === 'x' ? w + sd * .3 : (u + e) / 2; if (!EDGE[Ic(oz) * N + Ic(ox)]) dressFace(p, ax, w, sd, u, e, y0, hasPorch); } u = e; } }
    if (st === 'stone' || st === 'brick') { for (const [cx, cz, sx, sz] of [[p.x0, p.z0, -1, -1], [p.x1, p.z0, 1, -1], [p.x0, p.z1, -1, 1], [p.x1, p.z1, 1, 1]]) if (TOPAT(cx + sx * .25, cz + sz * .25) < p.top - 1.4 && TOPAT(cx + sx * .25, cz - sz * .25) < p.top - 1.4 && TOPAT(cx - sx * .25, cz + sz * .25) < p.top - 1.4) A.quoins(cx, cz, -sx, -sz, Math.max(p.base, TOPAT(cx + sx * .25, cz + sz * .25)), p.top - .22); }
    else for (const [cx, cz, sx, sz] of [[p.x0, p.z0, -1, -1], [p.x1, p.z0, 1, -1], [p.x0, p.z1, -1, 1], [p.x1, p.z1, 1, 1]]) if (TOPAT(cx + sx * .25, cz + sz * .25) < p.top - 1.4 && TOPAT(cx + sx * .25, cz - sz * .25) < p.top - 1.4 && TOPAT(cx - sx * .25, cz + sz * .25) < p.top - 1.4) { A.begin('ar_wood'); A.tint(.42, .34, .27); A.log(cx - sx * .1, Math.max(lowTop, TOPAT(cx + sx * .25, cz + sz * .25)), cz - sz * .1, cx - sx * .1, p.top, cz - sz * .1, .12, { seg: 6, n: 1, taper: 0 }); A.end(); }
    if (p.flat) { A.begin('ar_plank'); const n = Math.max(1, Math.round((p.x1 - p.x0) / 1.1)); for (let i = 0; i < n; i++) { const v = A.rnd(.6, .82); A.tint(v, v * .92, v * .84); const a = p.x0 + (p.x1 - p.x0) * i / n, b = p.x0 + (p.x1 - p.x0) * (i + 1) / n; A.quad(a + .01, p.top, p.z1, b - .01, p.top, p.z1, b - .01, p.top, p.z0, a + .01, p.top, p.z0); } A.end(); }
    else if (p.x1 - p.x0 >= 2 && p.z1 - p.z0 >= 2) { const ridge = (p.x1 - p.x0 >= p.z1 - p.z0) ? 'x' : 'z', gm = st === 'brick' ? 'ar_brick' : st === 'timber' ? 'ar_plank' : st === 'plaster' ? 'ar_plaster' : p.up, t = A.roof(p.x0, p.x1, p.z0, p.z1, p.top, ridge, { pitch: p.mill ? .5 : st === 'brick' ? .4 : .72 + A.rnd(.18), m: p.roofM, gm, gt: gm === 'ar_plaster' ? .95 : .82, over: .5 });
      if (!p.mill && A.r() < .75) { const cx = A.rnd(p.x0 + .7, p.x1 - .7), cz = A.rnd(p.z0 + .7, p.z1 - .7), cT = t + A.rnd(.3, .8);
        if (st === 'timber') { A.begin('ar_iron'); A.tint(.26, .25, .24); A.log(cx, p.top, cz, cx, cT + .9, cz, .085, { seg: 8, n: 1, taper: 0, wob: 0 }); A.log(cx, cT + .88, cz, cx, cT + 1.08, cz, .2, { seg: 8, n: 1, taper: .85, wob: 0 }); A.end(); sol(cx - .1, cx + .1, p.top, cT + 1.05, cz - .1, cz + .1, 'metal'); }
        else { A.chimney(cx, cz, p.top, cT, .55); sol(cx - .35, cx + .35, p.top, cT + .4, cz - .35, cz + .35); } } }
    else A.parapet('x', (p.z0 + p.z1) / 2, p.x0, p.x1, p.top, .12, p.z1 - p.z0, { m: 'ar_plank', col: false });
  }

  yield;
  /* ---------- 10. bâtiments ouverts : magasin de la compagnie et pension, escalier intérieur ---------- */
  const T_W = .36;
  function hWall(ax, c, a, b, y0, y1, holes, rgb, mat = 'ar_plank') {
    const hs = holes.slice().sort((p, q) => p.a - q.a); let u = a; const seg = (p, q, v0, v1) => { if (q - p > .01 && v1 - v0 > .01) { const s = ax === 'x' ? k.col(p, q, v0, v1, c - T_W / 2, c + T_W / 2, 'wood') : k.col(c - T_W / 2, c + T_W / 2, v0, v1, p, q, 'wood'); s.mm = 1; } };
    for (const h of hs) { seg(u, h.a, y0, y1); if (h.y0 > y0) seg(h.a, h.b, y0, h.y0); if (h.y1 < y1) seg(h.a, h.b, h.y1, y1); u = h.b; } seg(u, b, y0, y1);
    for (const sd of [-1, 1]) A.sheet(mat, ax, c + sd * T_W / 2, sd, a, b, y0, y1, { holes: hs, rgb, rough: .01, du: 1, dy: .5 });
    if (ax === 'x') { A.begin(mat); A.tint(...(rgb || [1, 1, 1])); A.box(a - .004, a + .02, y0, y1, c - T_W / 2, c + T_W / 2); A.box(b - .02, b + .004, y0, y1, c - T_W / 2, c + T_W / 2); A.end(); }
    for (const h of hs) { if (h.door) { A.begin('ar_wood'); A.tint(.4, .32, .25); const P2 = (u, v) => (ax === 'x' ? [u, v] : [v, u]); for (const e of [h.a - .12, h.b + .12]) { const [px, pz] = P2(e, c); A.log(px, y0, pz, px, h.y1 + .1, pz, .12, { seg: 6, n: 1 }); } const [l0x, l0z] = P2(h.a - .2, c), [l1x, l1z] = P2(h.b + .2, c); A.log(l0x, h.y1 + .1, l0z, l1x, h.y1 + .1, l1z, .13, { seg: 6, n: 1 }); A.end(); } else for (const s of [-1, 1]) A.window(ax, c + s * T_W / 2, s, (h.a + h.b) / 2, h.y0, h.b - h.a, h.y1 - h.y0, { shutter: false, fm: 'ar_wood' }); }
  }
  for (const h of OPEN) {
    const { x0, x1, z0, z1, base: y } = h, F = 3, top = y + 5.8, rgb = PLANKS[Math.floor(k.r() * PLANKS.length)], D = (c) => ({ a: c - 1, b: c + 1, y0: y, y1: y + 2.6, door: true }), Up = (c) => ({ a: c - .95, b: c + .95, y0: y + F, y1: y + F + 2.4, door: true }), Win = (c, yy) => ({ a: c - .42, b: c + .42, y0: yy, y1: yy + 1.05 });
    const mk = (side, lo, hi) => { const ds = (h.doors[side] || []).map(D), hs = [...ds]; for (let c = lo + 1.2; c < hi - .9; c += 2.3) if (ds.every(d => c + .55 < d.a || c - .55 > d.b)) hs.push(Win(c, y + 1.15)); return hs; }, mkU = (side, lo, hi) => { const ds = ((h.up || {})[side] || []).map(Up), hs = [...ds]; for (let c = lo + 1.2; c < hi - .9; c += 2.3) if (ds.every(d => c + .55 < d.a || c - .55 > d.b)) hs.push(Win(c, y + F + 1.0)); return hs; };
    for (const [lo, hi, f, mt] of [[y, y + F, mk, h.lower], [y + F, top + .08, mkU, h.upper]]) { const rg = mt === 'ar_plaster' ? PL2[1] : rgb; hWall('x', z0 + T_W / 2, x0, x1, lo, hi, f('zn', x0, x1), rg, mt); hWall('x', z1 - T_W / 2, x0, x1, lo, hi, f('zp', x0, x1), rg, mt); hWall('z', x0 + T_W / 2, z0 + T_W, z1 - T_W, lo, hi, f('xn', z0, z1), rg, mt); hWall('z', x1 - T_W / 2, z0 + T_W, z1 - T_W, lo, hi, f('xp', z0, z1), rg, mt); }
    /* volée contre un mur sans porte (h.stair), hors du passage entre les portes ; trémie à l'aplomb de la volée */
    const ST = h.stair || { x: (x0 + x1) / 2 - .2, z: z0 + T_W + .25, dir: 'z+', rail: 1 }, w = 1.7, sx = ST.x, sz = ST.z, L = A.stairs(sx, sz, w, ST.dir, y, y + F, { walls: false, rail: ST.rail, m: 'ar_wood', tread: ST.tread }), hole = ST.dir === 'z+' ? [sx - w / 2, sx + w / 2, sz - .05, sz + L] : ST.dir === 'z-' ? [sx - w / 2, sx + w / 2, sz - L, sz + .05] : ST.dir === 'x+' ? [sx - .05, sx + L, sz - w / 2, sz + w / 2] : [sx - L, sx + .05, sz - w / 2, sz + w / 2];
    for (const [a, b, c, d] of [[x0 + T_W, hole[0], z0 + T_W, z1 - T_W], [hole[1], x1 - T_W, z0 + T_W, z1 - T_W], [hole[0], hole[1], z0 + T_W, hole[2]], [hole[0], hole[1], hole[3], z1 - T_W]]) if (b - a > .02 && d - c > .02) { sol(a, b, y + F - .18, y + F, c, d, 'wood'); A.begin('ar_plank'); A.tint(.7, .62, .52); A.box(a, b, y + F - .05, y + F, c, d, 0, '');   /* dessous dessiné : le plancher ne disparaît plus vu de la pièce du bas */ A.tint(.42, .33, .25); for (let q = c + .3; q < d; q += .85) A.box(a, b, y + F - .24, y + F - .05, q - .07, q + .07); A.end(); }
    /* garde-corps du haut sur les bords ouverts de la trémie, jamais sur le bord d'arrivée (il barrait la sortie de la volée) */
    { const yF = y + F, arr = ST.dir === 'z+' ? 3 : ST.dir === 'z-' ? 2 : ST.dir === 'x+' ? 1 : 0, lim = [x0 + T_W, x1 - T_W, z0 + T_W, z1 - T_W]; for (let e = 0; e < 4; e++) { if (e === arr) continue; const v = hole[e], far = e & 1 ? lim[e] - v : v - lim[e]; if (far < .3) continue; const c = v + (e & 1 ? .03 : -.03); if (e < 2) { A.handrail('z', hole[2], 1, hole[3] - hole[2], c, yF, yF); k.col(c - .03, c + .03, yF, yF + .95, hole[2], hole[3], 'metal'); } else { A.handrail('x', hole[0], 1, hole[1] - hole[0], c, yF, yF); k.col(hole[0], hole[1], yF, yF + .95, c - .03, c + .03, 'metal'); } } }
    A.begin('ar_wood'); A.tint(.46, .36, .28); for (let q = z0 + .5; q < z1 - .3; q += .9) A.box(x0 + T_W, x1 - T_W, top - .2, top - .04, q - .08, q + .08); A.end(); sol(x0, x1, top, top + .1, z0, z1);
    A.roof(x0, x1, z0, z1, top + .08, (x1 - x0 >= z1 - z0) ? 'x' : 'z', { pitch: .7, m: h.roofM, gm: h.upper, gt: .85, over: .5 });
    A.cask(x0 + .95, z1 - 1.1, y); for (const [cx, cz, q] of h.crates || [[x1 - 1, z1 - 1, .8], [x1 - 1, z1 - 2, .7]]) A.crate(cx, cz, y, q); A.lantern((x0 + x1) / 2 + 1.2, y + 2.35, (z0 + z1) / 2);
  }

  yield;
  /* ---------- 11. escaliers entre les niveaux ---------- */
  const r12 = run(L2 - L1), r23 = run(L3 - L2);
  /* gare -> bourg, couloir ouest, cour de la laverie */
  A.stairs(0, -36 - r12, 8, 'z+', L1, L2, { walls: false, tread: TREAD, wear: .03, m: 'ar_wood', newel: [-1, 1] }); for (const sd of [-1, 1]) A.handrail('z', -36 - r12, 1, r12, sd * 3.86, L1, L2);
  for (const [x, w] of [[-16.5, 3], [16.5, 3], [-44, 4], [44, 4]]) A.stairs(x, -36 - r12, w, 'z+', L1, L2, { rail: 1, m: 'ar_wood', wallH: .9 });
  /* bourg -> carreau */
  A.stairs(0, 36 - r23, 8, 'z+', L2, L3, { walls: false, tread: TREAD, m: 'ar_ashlar', newel: [-1, 1] }); for (const sd of [-1, 1]) A.handrail('z', 36 - r23, 1, r23, sd * 3.86, L2, L3);
  for (const [x, w] of [[-16.5, 3], [16.5, 3], [-50, 4]]) A.stairs(x, 36 - r23, w, 'z+', L2, L3, { rail: 1, m: 'ar_ashlar', wallH: .9 });
  /* cour de la laverie -> terrasse des trémies */
  A.stairs(38, 14 - r23, 3.6, 'z+', L2, L3, { rail: -1, m: 'ar_wood', wallH: .9 });
  /* descentes vers les galeries : une volée depuis la gare, deux volées et un palier ailleurs */
  for (const cx of [-35.2, 35.2]) { A.stairs(cx + Math.sign(cx) * .05, -46, 2.5, 'z-', 0, L1, { walls: false, m: 'ar_wood' }); /* du quai (|x| 34) au mur (|x| 36,5) : plus de vide de 5 et 15 cm */ for (const e of [cx - 1.2, cx + 1.2]) A.parapet('z', e, -46 - fRun, -46, L1, .95, .14, { m: 'ar_wood', col: true }); A.parapet('x', -45.93, cx - 1.2, cx + 1.2, L1, .95, .14, { m: 'ar_wood' }); }
  const flights = (cx, zA, len, yTop, sg, hw = 1.65) => { const mid = yTop / 2, zL = zA + sg * len; A.stairs(cx - (hw + .05) / 2, zA, hw - .05, sg > 0 ? 'z+' : 'z-', 0, mid, { walls: false, rise: .24, tread: .4, m: 'ar_wood' }); A.landing(cx - hw, cx + hw, Math.min(zL, zL + sg * 1.6), Math.max(zL, zL + sg * 1.6), mid, { y0: 0, m: 'ar_plank' }); A.stairs(cx + (hw + .05) / 2, zL, hw - .05, sg > 0 ? 'z-' : 'z+', mid, yTop, { walls: false, rise: .24, tread: .4, m: 'ar_wood' });   /* volées du mur (cx ± hw) à la cloison centrale (cx ± 0,05) : plus de vide le long des murs */ sol(cx - .05, cx + .05, 0, yTop + .95, Math.min(zA, zL), Math.max(zA, zL), 'wood'); A.begin('ar_plank'); A.tint(.62, .54, .46); A.box(cx - .05, cx + .05, 0, yTop + .92, Math.min(zA, zL), Math.max(zA, zL), .004); A.end();
    /* garde-corps du trou, ouvert sur la sortie de la seconde volée */ const z0 = Math.min(zA, zL + sg * 1.6), z1 = Math.max(zA, zL + sg * 1.6), far = sg > 0 ? z1 : z0; for (const e of [cx - 1.75, cx + 1.75]) A.parapet('z', e, z0, z1, yTop, .95, .14, { m: 'ar_wood' }); A.parapet('x', far + (sg > 0 ? .07 : -.07), cx - 1.75, cx + 1.75, yTop, .95, .14, { m: 'ar_wood' }); A.parapet('x', zA - sg * .07, cx - 1.75, cx - .05, yTop, .95, .14, { m: 'ar_wood' }); };
  flights(-35.25, 40, hRun, L3, 1, 1.75); flights(35.25, 40, hRun, L3, 1, 1.75); flights(-9.85, 8, qRun, L2, -1); flights(-27.75, -8.5, wRun, L2, 1, 1.75);
  fill(-13, -7, 8, 12, c => { if (B[c] !== 5) { B[c] = 0; H[c] = L2; } });

  yield;
  /* ---------- 12. galeries : cadres boisés, voies, wagonnets, puisard noyé ---------- */
  const skip = (u, R) => R.some(r => u > r[0] - .5 && u < r[1] + .5);
  for (let u = -44.8; u < 39.5; u += 2.2) { if (!skip(u, [[-12, -8.5], [8, 11.5], [-48, -45.2]])) A.timberSet('z', -35.25, u, 0, GH, 3.5); if (!skip(u, [[8, 11.5], [16, 19.5], [-48, -45.2]])) A.timberSet('z', 35.25, u, 0, GH, 3.5); }
  for (let u = -31.8; u < 32; u += 2.2) if (!skip(u, [[-11.6, -8.1], [12, 24]])) A.timberSet('x', 9.75, u, 0, GH, 3.5);
  for (let u = -32; u < -27; u += 2.2) A.timberSet('x', -10.25, u, 0, GH, 3.5);
  A.rails('x', 10.5, -33.4, 33.4, 0); A.rails('z', 36, -45.8, 39.8, 0);
  for (const x of [-21, 2, 27]) A.cart(x, 10.5, 0, 'x'); for (const z of [-24, 4, 29]) A.cart(36, z, 0, 'z');
  for (const l of LAMPS) { const vc = V[Ic(l[2]) * N + Ic(l[0])]; A.begin('ar_iron'); A.tint(.24, .24, .25);
    if (l[4]) { const d = l[4], x = l[0] + d * .26; A.rod(l[0], l[1] + .42, l[2], x, l[1] + .42, l[2], .016, 4); A.rod(x, l[1] + .3, l[2], x, l[1] + .42, l[2], .01, 3); A.rod(l[0], l[1] + .12, l[2], l[0] + d * .18, l[1] + .41, l[2], .01, 3); A.box(Math.min(l[0], l[0] + d * .03), Math.max(l[0], l[0] + d * .03), l[1] + .05, l[1] + .58, l[2] - .05, l[2] + .05); A.end(); A.lantern(x, l[1], l[2]); }
    else { if (vc > l[1] + .35 && vc < l[1] + 2.5) { A.rod(l[0], l[1] + .29, l[2], l[0], vc + .03, l[2], .011, 3); A.box(l[0] - .07, l[0] + .07, vc - .035, vc + .01, l[2] - .07, l[2] + .07); } A.end(); A.lantern(l[0], l[1], l[2]); } }
  /* puisard : eau dormante, passerelle de planches du travers-banc à la recoupe */
  { A.begin('ar_water_cave'); A.tint(.9, 1, 1); for (let x = 12; x < 24; x += 2) for (let z = 11.5; z < 22; z += 2.1) A.quad(x, .24, Math.min(22, z + 2.1), Math.min(24, x + 2), .24, Math.min(22, z + 2.1), Math.min(24, x + 2), .24, z, x, .24, z); A.end();
    const walk = [[17.3, 18.7, 11.5, 18.6], [18.7, 24, 17.2, 18.6]]; /* en L entre les étais (1,5 m de chaque côté) et loin des fûts */ for (const [a, b, c, d] of walk) { sol(a, b, 0, .3, c, d, 'wood'); A.begin('ar_plank'); A.tint(.6, .52, .44); A.box(a, b, .22, .3, c, d, .004, 'y'); A.tint(.38, .3, .24); for (let x = a + .2; x < b; x += 1.6) for (let z = c + .2; z < d; z += 1.6) A.box(x - .06, x + .06, 0, .22, z - .06, z + .06); A.end(); }
    A.begin('ar_iron'); A.tint(.5, .42, .36); A.rod(13, .5, 21.5, 13, 3.9, 21.5, .09, 8); A.rod(13, 3.6, 21.5, 23.5, 3.6, 21.5, .07, 8); A.end(); A.cask(22.6, 13, 0, .4, 1.1); A.cask(23.2, 14, 0, .36, .9);
    A.begin('ar_wood'); A.tint(.38, .3, .24); for (const [x, z] of [[15.5, 15.5], [20.5, 15.5], [15.5, 19.5], [20.5, 19.5]]) { A.log(x, 0, z, x, 4.1, z, .17, { seg: 7, n: 1 }); k.disc(x, z, .19, 0, 4.2, 'wood'); } for (const z of [15.5, 19.5]) A.log(12, 3.95, z, 24, 3.95, z, .16, { seg: 6, n: 2 }); A.end(); }

  yield;
  /* ---------- 13. carreau : chevalement, machine, trémies et goulotte, voie sur chevalet ---------- */
  A.headframe(18, 41.5, L3, 12.5, { dir: 1 });
  A.begin('ar_iron'); A.tint(.3, .3, .3); for (const oz of [-.48, .48]) A.rod(18, L3 + 12.62 + 2.15, 41.5 + oz + 1.05, 18, L3 + 4.6, 50.1, .022, 4); A.end();
  { A.begin('ar_plank'); A.tint(.56, .5, .42); for (let x = 15.2; x < 20.8; x += .35) A.quad(x + .01, L3 + .015, 44.3, x + .34, L3 + .015, 44.3, x + .34, L3 + .015, 38.7, x + .01, L3 + .015, 38.7); A.end(); A.begin('ar_dark'); A.tint(.2); A.quad(16.4, L3 + .02, 42.7, 19.6, L3 + .02, 42.7, 19.6, L3 + .02, 40.3, 16.4, L3 + .02, 40.3); A.end();
    /* barrière de la recette autour du puits, entre les jambes */ A.begin('ar_plank'); A.tint(.62, .52, .42); for (const [ax, c, a, b] of [['x', 41.5 - 2.05, 18 - 2.05, 18 + 2.05], ['x', 41.5 + 2.05, 18 - 2.05, 18 + 2.05], ['z', 18 - 2.05, 41.5 - 2.05, 41.5 + 2.05], ['z', 18 + 2.05, 41.5 - 2.05, 41.5 + 2.05]]) for (const h of [.25, .7, 1.05]) { ax === 'x' ? A.box(a, b, L3 + h - .08, L3 + h + .08, c - .04, c + .04, .01) : A.box(c - .04, c + .04, L3 + h - .08, L3 + h + .08, a, b, .01); } A.end(); for (const [ax, c, a, b] of [['x', 41.5 - 2.05, 18 - 2.05, 18 + 2.05], ['x', 41.5 + 2.05, 18 - 2.05, 18 + 2.05], ['z', 18 - 2.05, 41.5 - 2.05, 41.5 + 2.05], ['z', 18 + 2.05, 41.5 - 2.05, 41.5 + 2.05]]) A.wcol(ax, a, b, L3, L3 + 1.15, c - .06, c + .06, 'wood'); }
  /* trémies sur pilotis et goulotte vers la laverie */
  { const x0 = 42, x1 = 52, z0 = 23, z1 = 31, yb = L3 + 2.2, yt = L3 + 6.4; sol(x0, x1, yb, yt, z0, z1, 'wood'); A.begin('ar_plank'); A.tint(.5, .44, .37); A.box(x0, x1, yb - .04, yb, z0, z1); A.end(); /* plancher de la trémie : elle était ouverte par-dessous */ for (const [ax, w, s, a, b] of [['x', z0, -1, x0, x1], ['x', z1, 1, x0, x1], ['z', x0, -1, z0, z1], ['z', x1, 1, z0, z1]]) A.sheet('ar_plank', ax, w, s, a, b, yb, yt, { rgb: [.74, .66, .56], rough: .015, du: 2, dy: 1.4 });
    A.roof(x0 - .2, x1 + .2, z0 - .2, z1 + .2, yt, 'x', { pitch: .5, m: 'ar_shingle', gm: 'ar_plank', gt: .75, over: .4 });
    A.begin('ar_wood'); A.tint(.38, .31, .25); for (const x of [x0 + .3, (x0 + x1) / 2, x1 - .3]) for (const z of [z0 + .3, (z0 + z1) / 2, z1 - .3]) { A.log(x, L3, z, x, yb, z, .2, { seg: 7, n: 1 }); k.disc(x, z, .22, L3, yb, 'wood'); } A.end();
    A.ladder(x0 - .1, L3, z0 + 1.2, x0 - .1, yt - .2, z0 + 1.2, {}); }
  A.chute(47, L3 + 2.5, 22.6, 47, L2 + 1.9, 6.5, .85, { ground: (x, z) => H[Ic(z) * N + Ic(x)] });
  A.cart(47, 5.2, L2, 'z'); A.rails('z', 47, -8, 8, L2);
  /* voie sur chevalet le long du couloir ouest, au niveau du carreau */
  A.trestle('z', -44, -28, 36, u => H[Ic(u) * N + Ic(-44)], L3, { w: 3.2, span: 4, gaps: [[-2, 0, 1]] });
  A.stairs(-44, -28 - r23, 3, 'z+', L2, L3, { walls: false, rail: 1, m: 'ar_wood', newel: [-1, 1] }); A.handrail('z', -28 - r23, 1, r23, -45.4, L2, L3);
  A.stairs(-41.35, 6.3, 1.5, 'z-', L2, L3, { walls: false, rail: 1, m: 'ar_wood', tread: .42, newel: [1] }); { const zt = 6.3 - run(L3 - L2); A.landing(-42.4, -40.6, zt - 1.3, zt, L3, { y0: L3 - .3, m: 'ar_plank' }); A.begin('ar_wood'); A.tint(.4, .32, .26); for (const z of [zt - 1.2, zt - .1]) { A.log(-40.7, L2, z, -40.7, L3 - .1, z, .1, { seg: 5, n: 1 }); k.disc(-40.7, z, .11, L2, L3 - .3, 'wood'); } A.end(); }
  /* voie de la gare */
  A.rails('x', -43, -57.5, 57.5, L1); for (const [a, b] of [[-57.5, -36.6], [-33.8, 33.8], [36.6, 57.5]]) A.rails('x', -47.5, a, b, L1);   /* la seconde voie s'arrête aux trémies des descentes (traverses et rails flottaient au-dessus du vide) */
  for (const [x, z] of [[-24, -43], [-21.5, -43], [12, -47.5], [26, -43]]) A.cart(x, z, L1, 'x');

  /* toits-terrasses : escaliers depuis les rues de travers, passerelles au-dessus de la rue haute */
  const rr = run(ROOF - L2);
  for (const [sx, zc, zL0, zL1] of [[-1, -23.2, -24, -22.4], [1, -23.2, -24, -22.4], [-1, 23.2, 22.4, 24], [1, 23.2, 22.4, 24]]) { const x = sx * 14, dir = sx < 0 ? 'x+' : 'x-', xe = x - sx * rr; A.stairs(x, (zL0 + zL1) / 2, zL1 - zL0, dir, L2, ROOF, { walls: false, rail: zc < 0 ? 1 : -1, m: 'ar_wood', newel: [zc < 0 ? 1 : -1] }); const lo = Math.min(xe, xe - sx * 1.5), hi = Math.max(xe, xe - sx * 1.5); A.landing(lo, hi, zL0, zL1, ROOF, { y0: ROOF - .3, m: 'ar_plank' }); A.begin('ar_wood'); A.tint(.4, .32, .26); for (const px of [lo + .1, hi - .1]) { A.log(px, L2, zc < 0 ? zL1 - .1 : zL0 + .1, px, ROOF - .3, zc < 0 ? zL1 - .1 : zL0 + .1, .1, { seg: 5, n: 1 }); k.disc(px, zc < 0 ? zL1 - .1 : zL0 + .1, .11, L2, ROOF - .3, 'wood'); } A.end(); }
  const bridge = (x0, x1, z0, z1) => { sol(x0, x1, ROOF - .16, ROOF, z0, z1, 'wood'); A.begin('ar_plank'); const n = Math.round((x1 - x0) / .25); for (let i = 0; i < n; i++) { const v = A.rnd(.6, .86); A.tint(v, v * .9, v * .8); const a = x0 + (x1 - x0) * i / n + .005, b = x0 + (x1 - x0) * (i + 1) / n - .005, sag = -.04 * Math.sin(((a + b) / 2 - x0) / (x1 - x0) * Math.PI); A.box(a, b, ROOF - .06 + sag, ROOF + sag, z0, z1, .004, 'y'); } A.tint(.36, .3, .24); A.box(x0, x1, ROOF - .12, ROOF - .11, z0, z1); A.end();   /* sous-face sous les planches : la passerelle ne se voit plus à travers depuis la rue */ A.begin('ar_wood'); A.tint(.4, .32, .26); for (const z of [z0 + .12, z1 - .12]) A.log(x0, ROOF - .2, z, x1, ROOF - .2, z, .13, { seg: 6, n: 2 }); for (const z of [z0 + .05, z1 - .05]) { for (let x = x0; x <= x1 + .01; x += (x1 - x0) / 8) A.rod(x, ROOF - .05, z, x, ROOF + .98, z, .045, 5); A.rod(x0, ROOF + .52, z, x1, ROOF + .52, z, .03, 4); A.log(x0, ROOF + .96, z, x1, ROOF + .96, z, .045, { seg: 5, n: 1 }); k.col(x0, x1, ROOF, ROOF + 1, z - .05, z + .05, 'wood'); } A.end(); };
  bridge(-4, 4, -31.5, -28.5); bridge(-4, 4, 28.5, 31.5);
  const rail = (ax, c, a, b, gaps) => { let u = a; for (const [p, q] of gaps.slice().sort((m, n) => m[0] - n[0])) { if (p - u > .3) railRun(ax, c, u, p); u = Math.max(u, q); } if (b - u > .3) railRun(ax, c, u, b); }, railRun = (ax, c, a, b) => { A.begin('ar_wood'); A.tint(.42, .34, .27); const n = Math.max(1, Math.round((b - a) / .95)); for (let i = 0; i <= n; i++) { const u = a + (b - a) * i / n; ax === 'x' ? A.rod(u, ROOF, c, u, ROOF + 1, c, .045, 5) : A.rod(c, ROOF, u, c, ROOF + 1, u, .045, 5); } ax === 'x' ? A.rod(a, ROOF + .52, c, b, ROOF + .52, c, .03, 4) : A.rod(c, ROOF + .52, a, c, ROOF + .52, b, .03, 4); ax === 'x' ? A.log(a, ROOF + .98, c, b, ROOF + .98, c, .045, { seg: 5, n: 1 }) : A.log(c, ROOF + .98, a, c, ROOF + .98, b, .045, { seg: 5, n: 1 }); A.end(); A.wcol(ax, a, b, ROOF, ROOF + 1, c - .05, c + .05, 'wood'); };
  for (const sz of [-1, 1]) { const zi = sz < 0 ? -24.1 : 24.1, zo = sz < 0 ? -35.9 : 35.9, zb = [sz < 0 ? -31.5 : 28.5, sz < 0 ? -28.5 : 31.5]; for (const sx of [-1, 1]) { const xo = sx * 14.9, xi = sx * 4.1, land = [Math.min(sx * (14 - rr), sx * (14 - rr - 1.5)) - .05, Math.max(sx * (14 - rr), sx * (14 - rr - 1.5)) + .05];
    rail('x', zi, Math.min(xo, xi), Math.max(xo, xi), [land]); rail('x', zo, Math.min(xo, xi), Math.max(xo, xi), []); rail('z', xo, Math.min(zi, zo), Math.max(zi, zo), []); rail('z', xi, Math.min(zi, zo), Math.max(zi, zo), [zb]); } }

  yield;
  /* ---------- 14. détails de vie ---------- */
  for (const [x, z, y] of [[-5, -30, L2], [5, -14, L2], [-5, 14, L2], [5, 30, L2], [-12.5, -7, L2], [12.5, 7, L2], [-26.5, -22, L2], [26.5, 22, L2], [-30, 22, L2], [30, -22, L2], [-30, -40, L1], [30, -40, L1], [-24, 38, L3], [24, 38, L3], [-46, -6, L2], [42, -2, L2], [50, 20, L3], [-10, 48, L3]]) { A.begin('ar_wood'); A.tint(.38, .3, .24); A.log(x, y, z, x, y + 3.2, z, .09, { seg: 6, n: 1 }); A.log(x, y + 3.1, z, x + .5, y + 3.1, z, .05, { seg: 5, n: 1 }); A.end(); k.disc(x, z, .1, y, y + 3.2, 'wood'); A.lantern(x + .48, y + 2.9, z); }
  for (const [x, z, y] of [[-25, -45, L1], [-23.6, -45.2, L1], [22, -39, L1], [40, -20, L2], [41.2, -20.3, L2], [-36, 30, L2], [30, 40, L3], [-20, 40, L3], [8, 22, L2], [-8, -22.5, L2]]) A.cask(x, z, y);
  for (const [x, z, y, q] of [[-28, -39, L1, 1], [28, -48, L1, .9], [44, -30, L2, 1], [40, 2, L2, .9], [-38, 18, L2, 1], [-30, 46, L3, 1.1], [8, 46, L3, 1], [-12.5, 21, L2, .85], [12.5, -21, L2, .85], [-4, 44, L3, .9]]) { A.crate(x, z, y, q); if (A.r() < .55) A.crate(x + .06, z + .05, y + q, q * .72); }
  /* piles de rondins au carreau et à la gare */
  for (const [x, z, y, ax] of [[-12, 44, L3, 'x'], [30, 44, L3, 'x'], [-40, -40, L1, 'x'], [52, -10, L2, 'z']]) { A.begin('ar_wood'); A.tint(.5, .4, .3); const L = 3.2; for (let row = 0; row < 3; row++) for (let q = 0; q < 4 - row; q++) { const off = (q - (3 - row) / 2) * .36, h = y + .17 + row * .3; ax === 'x' ? A.log(x - L / 2, h, z + off, x + L / 2, h, z + off, .17, { seg: 7, n: 1, taper: 0 }) : A.log(x + off, h, z - L / 2, x + off, h, z + L / 2, .17, { seg: 7, n: 1, taper: 0 }); } A.end(); for (const [h0, h1, hw] of [[0, .34, .72], [.34, .64, .54], [.64, .94, .36]]) ax === 'x' ? sol(x - L / 2, x + L / 2, y + h0, y + h1, z - hw, z + hw, 'wood') : sol(x - hw, x + hw, y + h0, y + h1, z - L / 2, z + L / 2, 'wood'); }
  /* éboulis au pied des falaises */
  for (let i = 0; i < PER.length; i += 5) { const [bx, bz, nx, nz] = PER[i], x = bx - nx * .05, z = bz - nz * .05, fl = inH(x, z), q = A.rnd(.7, 1.5); if (z > 50 && Math.abs(x) < 24) continue; A.boulder(x, z, q, { y: fl, sx: A.rnd(1.1, 1.6), tone: A.rnd(.52, .7), m: 'ar_rock' }); if (A.r() < .45) { const x2 = bx + nx * .25, z2 = bz + nz * .25; A.boulder(x2, z2, q * A.rnd(.6, .85), { y: fl + q * .75, sx: A.rnd(1.1, 1.4), tone: A.rnd(.5, .66), m: 'ar_rock' }); } }
  for (let i = 0; i < 320; i++) { const [bx, bz, nx, nz] = PER[Math.floor(A.r() * PER.length)], d = A.rnd(.1, 1.4), x = bx - nx * d, z = bz - nz * d; if (i % 3 === 0) k.inst.push({ k: 'rubble', x, y: inH(x, z), z, s: A.rnd(.05, .16), ry: A.r() * 6 }); }
  /* éboulis du pied de falaise du carreau, côté apparitions : petits blocs collés à la paroi, gravats fins */
  for (let x = -22.6; x < 23; x += 2.3) { const j = noise2(x * .9, 11.3), q = .34 + .22 * j, x1 = x + (noise2(x, 2) - .5) * 1, z1 = RZ - .1 - q * .3; A.boulder(x1, z1, q, { y: inH(x1, z1), sx: 1.15 + .35 * j, tone: .5 + .14 * noise2(x * 3, 1), m: 'ar_rock' }); }
  /* place : socle au wagonnet, abreuvoir et pompe, charrettes ; carreau : hangar, tas de minerai ; laverie : tas de minerai */
  { A.rbox('ar_rubble', -2, 2, L2, L2 + .9, -1.3, 1.3, { b: .08 }); sol(-2, 2, L2, L2 + .9, -1.3, 1.3); A.cart(0, 0, L2 + .9, 'x'); k.solids.pop(); sol(-.8, .8, L2 + .9, L2 + 1.85, -.6, .6, 'metal'); A.rails('x', 0, -1.6, 1.6, L2 + .9); }
  { const x0 = -9, x1 = -5.8, z0 = 4.6, z1 = 5.6; sol(x0, x1, L2, L2 + .8, z0, z1, 'wood'); A.begin('ar_plank'); A.tint(.62, .54, .46); A.box(x0, x1, L2, L2 + .8, z0, z1, .02); A.end(); A.begin('ar_water'); A.quad(x0 + .1, L2 + .72, z1 - .1, x1 - .1, L2 + .72, z1 - .1, x1 - .1, L2 + .72, z0 + .1, x0 + .1, L2 + .72, z0 + .1); A.end(); A.begin('ar_iron'); A.tint(.3, .32, .3); A.rod(x0 - .3, L2, (z0 + z1) / 2, x0 - .3, L2 + 1.5, (z0 + z1) / 2, .08, 8); A.rod(x0 - .3, L2 + 1.3, (z0 + z1) / 2, x0 + .2, L2 + 1.1, (z0 + z1) / 2, .04, 5); A.end(); k.disc(x0 - .3, (z0 + z1) / 2, .1, L2, L2 + 1.5, 'metal'); }
  for (const [x, z, ax] of [[8, -4.5, 'x'], [-9.5, -5, 'z'], [10, 5.5, 'z']]) { A.cart(x, z, L2, ax); }
  const shed = (x0, x1, z0, z1, y, h) => { sol(x0, x1, y, y + h, z0, z1, 'wood'); for (const [ax, w, sd, a, b] of [['x', z0, -1, x0, x1], ['x', z1, 1, x0, x1], ['z', x0, -1, z0, z1], ['z', x1, 1, z0, z1]]) A.sheet('ar_plank', ax, w, sd, a, b, y, y + h, { rgb: [.8, .72, .62], rough: .012, du: 2, dy: 1.4 }); A.roof(x0, x1, z0, z1, y + h, (x1 - x0 >= z1 - z0) ? 'x' : 'z', { pitch: .45, m: 'ar_shingle', gm: 'ar_plank', gt: .75, over: .4 }); A.begin('ar_wood'); A.tint(.4, .32, .26); for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) A.log(cx, y, cz, cx, y + h, cz, .12, { seg: 6, n: 1, taper: 0 }); A.end(); };
  shed(-22, -14, 40.5, 44.5, L3, 3.2); shed(26, 32, 38, 42, L3, 3); shed(28, 34, -31, -27, L2, 3.1);
  const heap = (x, z, y, r) => { const w = r * 1.1, d = r * .8, h = .95; sol(x - w, x + w, y, y + h, z - d, z + d, 'wood'); A.begin('ar_plank'); A.tint(.6, .52, .44); A.box(x - w, x + w, y, y + h, z - d, z + d, .02); A.end(); A.begin('ar_wood'); A.tint(.38, .3, .24); for (const [cx, cz] of [[x - w, z - d], [x + w, z - d], [x - w, z + d], [x + w, z + d]]) A.log(cx, y, cz, cx, y + h + .05, cz, .07, { seg: 5, n: 1, taper: 0 }); A.end(); A.begin('ar_rock'); A.tint(.4, .37, .35); A.quad(x - w + .06, y + h + .005, z + d - .06, x + w - .06, y + h + .005, z + d - .06, x + w - .06, y + h + .005, z - d + .06, x - w + .06, y + h + .005, z - d + .06); A.end(); };
  heap(4, 46.5, L3, 1.9); heap(38, -6, L2, 1.7); heap(-40, -40, L1, 1.3);
  A.spool(12.3, -2, L2, .72, .9, 'z'); A.spool(-13.4, -6.3, L2, .6, .8, 'x'); A.spool(36, -14, L2, .78, 1, 'x'); A.spool(30.8, -7, L2, .62, .8, 'z');
  /* chaudière : hors de l'axe de l'escalier x 44 (vue d'en bas elle semblait flotter au-dessus de la dernière marche), couchée sur un massif de pierre sur toute sa longueur */
  A.boiler(38.6, -31.5, L2, 3.4, .78, 'x'); A.begin('ar_stonewall'); A.tint(.72); A.box(38.6 - 1.45, 38.6 + 1.45, L2, L2 + .6, -31.95, -31.05); A.end(); A.waterTower(32.6, -22.5, L2, 5.4, 1.75);
  for (const [x, z, y] of [[11.2, -6.6, L2], [12, -6.9, L2], [11.6, -6, L2], [-4.6, 6.9, L2], [44.5, -18, L2], [45.3, -17.6, L2], [30.5, -33, L2], [31.3, -33.3, L2]]) A.cask(x, z, y);
  for (const [x, z, y, q] of [[5.2, 6.6, L2, .9], [-12.5, 6.8, L2, .8], [43.6, -15.8, L2, 1], [29.4, -12, L2, .9], [52.5, 8.5, L2, 1]]) { A.crate(x, z, y, q); if (A.r() < .5) A.crate(x + .05, z + .04, y + q, q * .7); }
  for (const [x, z] of [[-14.3, -7.3], [14.3, 7.3], [28.6, -18], [45.5, 10.5]]) { A.begin('ar_iron'); A.tint(.24, .24, .25); A.log(x, L2, z, x, L2 + 3.4, z, .07, { seg: 8, n: 1, taper: .2, wob: 0 }); A.log(x, L2 + 3.3, z, x + .45, L2 + 3.3, z, .035, { seg: 5, n: 1, wob: 0 }); A.end(); k.disc(x, z, .09, L2, L2 + 3.4, 'metal'); A.lantern(x + .45, L2 + 3.08, z); }
  A.rails('z', -30, 37, 49, L3); A.cart(-30, 44, L3, 'z');
  /* rue haute : deux chariots chargés cassent la longue ligne de tir, passage libre des deux côtés */
  for (const [x, z, sx] of [[-2, -14, -1], [2, 14, 1]]) { A.cart(x, z, L2, 'z'); A.crate(x + sx * .1, z + 1.6 * sx, L2, .9); A.crate(x - sx * .05, z + 1.7 * sx, L2 + .9, .66); A.cask(x + sx * .2, z - 1.4 * sx, L2); }
  /* cour de la laverie : voie vers la goulotte, wagonnets ; terrasse des trémies : caisses */
  A.rails('x', 2, 28, 46, L2); A.cart(33, 2, L2, 'x'); A.cart(39.5, 2, L2, 'x');
  for (const [x, z, q] of [[34, 24, 1], [35, 25.4, .8], [54, 18, .9], [31, 30, 1]]) A.crate(x, z, L3, q);
  /* parapets des bords du carreau et de la terrasse : on ne marche pas sur les toits du bourg */
  const gappedP = (ax, c, a, b, y, gaps) => { let u = a; for (const [p, q] of gaps.slice().sort((m, n) => m[0] - n[0])) { if (p - u > .3) A.parapet(ax, c, u, p, y, .95, .3, { m: 'ar_rubble' }); u = Math.max(u, q); } if (b - u > .3) A.parapet(ax, c, u, b, y, .95, .3, { m: 'ar_rubble' }); };
  gappedP('x', 36.15, -56.8, 28, L3, [[-52.2, -47.8], [-45.9, -42.1], [-18.3, -14.7], [-4.2, 4.2], [14.7, 18.3]]); gappedP('z', 28.15, 14, 36, L3, []); gappedP('x', 14.15, 28.3, 56.8, L3, [[35.9, 40.1]]);
  /* rochers et pins du couloir ouest, pins sur les falaises */
  for (const [x, z, s] of [[-48, -24, .9], [-30, 14, .8], [-56, 4, 1.1], [-46, 26, .7]]) A.boulder(x, z, s, { y: L2, sx: 1.3, tone: .7 });
  const hiP = (x, z, r) => { let m = 0; for (let a = -r; a <= r; a += .7) for (let b = -r; b <= r; b += .7) m = Math.max(m, prof(x + a, z + b, inH(x + a, z + b)), Math.abs(x + a) < S && Math.abs(z + b) < S ? H[Ic(z + b) * N + Ic(x + a)] : 0); return m; };
  for (let i = 3; i < PER.length; i += 11) { const [bx, bz, nx, nz] = PER[i], t = A.rnd(15, 22), x = bx + nx * t, z = bz + nz * t; A.pine(x, z, prof(x, z, inH(x, z)), A.rnd(.85, 1.25), hiP(x, z, 3.5), false); }
  for (const [x, z] of [[-51.5, -30], [-38, -2], [-51, 26]]) A.pine(x, z, L2, A.rnd(.8, 1));
  /* ---------- 15. fond de décor : montagnes, neige en altitude ---------- */
  A.hills(84, 330, 72, 9, (a, r) => { const side = Math.abs(Math.cos(a)), t = (r - 84) / 246, base = (34 + 60 * side) * Math.pow(Math.min(1, t * 2), .75) * (1 - .25 * Math.max(0, t - .6)), lobes = 1 + .3 * Math.sin(a * 5 + .7) + .2 * Math.sin(a * 11 + 2.1) + .12 * Math.sin(a * 17); return -1 + base * lobes * (.85 + .3 * noise2(Math.cos(a) * r * .02 + 3, Math.sin(a) * r * .02)) + 5 * noise2(Math.cos(a) * r * .07, Math.sin(a) * r * .07); },
    (a, r, h, o) => { const n = noise2(Math.cos(a) * r * .05 + 9, Math.sin(a) * r * .05), snow = Math.min(1, Math.max(0, (h - 62 + n * 14) / 12)), rock = Math.min(1, Math.max(0, (h - 30) / 30)); const gr = [.3, .36, .24], rk = [.48, .46, .44], sn = [.92, .94, .97]; for (let q = 0; q < 3; q++) o[q] = (gr[q] * (1 - rock) + rk[q] * rock) * (1 - snow) + sn[q] * snow; });

  /* ---------- 16. apparitions, objectifs, volumes couverts, visibilité, itinéraires ---------- */
  for (const p of [[-18, -45.25], [-10, -45.25], [10, -45.25], [18, -45.25], [-22, -40], [-8, -40], [8, -40], [22, -40]]) k.spawns.push([p[0], p[1], L1]);
  for (const p of [[-18, 55], [-10, 55], [-2, 55], [6, 55], [-16, 51.5], [-6, 51.5], [2, 52], [10, 52.5]]) k.spawns.push([p[0], p[1], L3]);
  for (const p of [[0, -3.4, L2], [-8, -4, L2], [9, 4, L2], [0, -16, L2], [0, 16, L2], [-16.5, -10, L2], [16.5, 12, L2], [-44, -12, L2], [-40, 14, L2], [40, -12, L2], [36, 6, L2], [-36.4, -20, 0], [34.6, 22, 0], [1.1, 8.8, 0], [-19, 8.8, 0], [-44, 6, L3], [-10, -20.5, ROOF]]) k.spawns.push(p);
  k.levelAt = (x, z) => { if (Math.abs(x) >= S || Math.abs(z) >= S) return 0; const c = Ic(z) * N + Ic(x); return B[c] === 5 ? 0 : H[c]; };
  k.objectives = { zones: [[-46, 2, L2], [0, 0, L2], [42, -12, L2]], sites: [[20, 39, L3], [-44, 40, L3]] };
  k.covered = [{ x0: -37, x1: -33.5, y0: 0, y1: L2, z0: -46, z1: 40 }, { x0: 33.5, x1: 37, y0: 0, y1: L2, z0: -46, z1: 40 }, { x0: -33.5, x1: 33.5, y0: 0, y1: L2, z0: 8, z1: 11.5 }, { x0: 12, x1: 24, y0: 0, y1: L2, z0: 11.5, z1: 22 }, { x0: 24, x1: 33.5, y0: 0, y1: L2, z0: 16, z1: 19.5 }, { x0: -33.5, x1: -26, y0: 0, y1: L2, z0: -12, z1: -8.5 }, ...OPEN.map(h => ({ x0: h.x0, x1: h.x1, y0: h.base, y1: h.base + 5.8, z0: h.z0, z1: h.z1 }))];
  k.shadowProxy = true; for (const q of k.solids) { const mx = (q.x0 + q.x1) / 2, mz = (q.z0 + q.z1) / 2; if (A.under(mx, mz, q.y1) || (Math.abs(mx) < S && Math.abs(mz) < S && EDGE[Ic(mz) * N + Ic(mx)] === 1 && dOut(mx, mz) > 1.2)) q.ug = 1; }
  const OPENINGS = [[-35.2, -50, 9], [35.2, -50, 9], [-35.25, 46, 11], [35.25, 46, 11], [-9.85, 2, 10], [-27.75, -4, 9]];
  k.openings = OPENINGS.map(o => [o[0], o[1], o[2] + 2]);
  k.visAt = (x, y, z) => { for (let i = 0; i < OPENINGS.length; i++) { const o = OPENINGS[i], dx = x - o[0], dz = z - o[1]; if (dx * dx + dz * dz < o[2] * o[2]) return 3; } if (Math.abs(x) >= S || Math.abs(z) >= S) return 2; const c = Ic(z) * N + Ic(x); if ((V[c] > 0 && y < V[c]) || H[c] > y + 1.2) return 1; return 2; };
  k.lanes = [[-35.25, 0, 0, 2], [-35.25, 28, 0, 2], [35.25, -20, 0, 2], [35.25, 24, 0, 2], [0, 9.75, 0, 2], [20, 16.5, 0, 1.5], [-44, 10, L3, 1], [-10, -30, ROOF, 1]]; k.lanes.chance = .72;
  k.stats = { tris: A.tris, pieces: A.pieces };
  lastLayout = Object.assign(Object.create(Object.getPrototypeOf(k)), k, { ops: [] });
  return k;
}

export const MINE_ENV = {
  mineval: { as: 'desert', gt: 'desert', sky: [[0, '#3b6a9c'], [.3, '#76a0c6'], [.45, '#c4d4e0'], [.5, '#e0e4e0'], [.53, '#8c8d7c'], [1, '#56584a']], halo: '240,244,236', clouds: 260, cloudDark: '112,124,138', cloudLight: '246,248,250', sun: [-30, 44, 38], sunCol: 0xfff0d8, sunI: 2.9, hemi: [0xbfd0dc, 0x6d6a58, .7], fog: [0xbcc8cf, .0045], exp: .56, envI: .55, ground: '#7c7866', gsurf: 'concrete', part: { n: 60, col: 0xe8ece8, size: .03, op: .3, mode: 'dust' } },
};

/** Branche la carte sur maps.js (import dynamique depuis main.js : un échec ne touche pas les autres cartes). list=false : tests sans entrée de menu. */
export function install(M, list = true) {
  M.registerMap({ id: 'valferrade', build: () => buildValferrade(M.Kit), steps: () => valferradeSteps(M.Kit), env: MINE_ENV, mats: archMaterial, meta: list ? { id: 'valferrade', name: 'Valferrade', desc: 'Bourg minier au fond d’une vallée : gare de chargement, rue haute, chevalement, voie sur chevalet et galeries de mine reliées.', env: 'mineval' } : null });
}
