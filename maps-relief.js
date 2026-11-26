/* FRONT ZÉRO : cartes à relief. Roquesèche : village en terrasses au-dessus d'une rivière à sec, trois niveaux reliés (toits et remparts, rues, souterrains).
   Le sol du moteur est y=0 : c'est le niveau des souterrains et du lit de la rivière ; les rues sont portées par un terrain plein (4,8 et 8,4 m).
   Le plan est peint sur une grille de 50 cm : H = dessus du terrain, V = plafond du vide creusé dessous, B = occupation. Tout le reste (collisions, parements, sols, lumière) en découle. */
import { Arch, noise2, TAU, archMaterial } from './map-arch.js';

const S = 64, G = .5, N = 256, L1 = 4.8, L2 = 8.4, L3 = 12, ROOF = 11.4, TREAD = .42, RISE = .24;
const run = (dy, t = TREAD, r = RISE) => Math.ceil(dy / r - 1e-6) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const PLASTERS = [[1.03, .98, .9], [1.04, .93, .8], [1.02, .88, .74], [.99, .95, .9], [1.05, .9, .78], [1, .84, .72], [1.03, 1, .95]];
const SHUTTERS = [[.36, .5, .46], [.34, .42, .55], [.56, .36, .26], [.46, .5, .34], [.62, .54, .4]];

/* engine-props relit la disposition juste après le chargement : on lui rend la même (sans les maillages, libérés après la fusion) au lieu de tout régénérer d'un bloc. */
let lastLayout = null;
export function buildRoqueseche(Kit) { if (lastLayout) return lastLayout; const g = roquesecheSteps(Kit); let r; while (!(r = g.next()).done); return r.value; }
export function* roquesecheSteps(Kit) {
  const k = new Kit('hillside', S, 7311); k.chunk = 43; k.limit('concrete');
  const H = new Float32Array(N * N), V = new Float32Array(N * N), B = new Uint8Array(N * N), TOP = new Float32Array(N * N), FL = new Uint8Array(N * N), CV = new Uint8Array(N * N);
  const X = i => -S + (i + .5) * G, Ic = v => clamp(Math.floor((v + S) / G), 0, N - 1), bank = x => Math.round((40 + 1.4 * Math.sin(x / 11) + .8 * Math.sin(x / 4.7 + 1)) * 2) / 2;
  const fill = (x0, x1, z0, z1, f) => { const a = Math.round((x0 + S) / G), b = Math.round((x1 + S) / G), c = Math.round((z0 + S) / G), d = Math.round((z1 + S) / G); for (let j = Math.max(0, c); j < Math.min(N, d); j++) for (let i = Math.max(0, a); i < Math.min(N, b); i++) f(j * N + i, i, j); };

  /* ---------- 1. relief de base ---------- */
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = X(i), z = X(j), c = j * N + i, bk = bank(x), edge = Math.abs(x) > 60;
    const fb = 57.5 + Math.round(noise2(x * .13, 1.7) * 3) / 2 * 2 - 1; if (z >= fb) { H[c] = z >= fb + 5.2 ? 4.6 : z >= fb + 2.4 ? 3.1 : 1.5; B[c] = 3; }
    else if (z >= bk) { if (Math.abs(x) > 61.2 + 1.6 * noise2(z * .22, x > 0 ? 1.3 : 4.1)) { H[c] = 7.4; B[c] = 3; } else { H[c] = 0; B[c] = 0; } }
    else if (z >= 10) { H[c] = L1; B[c] = edge ? 3 : 1; if (edge) H[c] = 9.5; }
    else if (z >= -42) { H[c] = L2; B[c] = edge ? 3 : 1; if (edge) H[c] = 13; }
    else if (z >= -50) { H[c] = L3; B[c] = edge ? 3 : 0; if (edge) H[c] = 15; }
    else { H[c] = z < -58 ? 13.2 : 10.8; B[c] = 3; }
  }
  const O = (l, x0, x1, z0, z1) => fill(x0, x1, z0, z1, c => { H[c] = l; B[c] = 0; });
  /* ville haute */
  for (const r of [[-60, -34, -33, -29], [-36, -30, -33, -24], [-32, -16, -28, -24], [-16, 14, -36, -14], [14, 30, -28, -24], [28, 34, -33, -24], [32, 60, -33, -29],
    [-60, -38, -12, -8], [-40, -34, -12, -4], [-36, -14, -8, -4], [-20, -14, -14, -4], [12, 18, -14, -4], [12, 36, -8, -4], [34, 40, -12, -4], [38, 60, -12, -8],
    [-48, -44, -42, -12], [44, 48, -42, -12], [-3, 1, -42, -36], [-60, -48, -8, 7.5], [48, 60, -8, 7.5], [-34, -20, -4, 6], [20, 34, -4, 6], [-4, 4, -14, -4], [20.5, 23.5, -37, -28]]) O(L2, ...r);
  /* ville basse */
  for (const r of [[-60, -38, 14, 18], [-40, -34, 14, 22], [-36, -18, 18, 22], [-18, 16, 12, 30], [16, 34, 18, 22], [32, 38, 14, 22], [36, 60, 14, 18], [-46, -42, 18, 33], [42, 46, 18, 33],
    [-26, -16, 30, 34], [16, 26, 30, 34], [-56, -52, 7.5, 14], [52, 56, 7.5, 14], [-28, -24, 6, 18], [24, 28, 6, 18], [-4, 4, -4, 12]]) O(L1, ...r);
  for (let i = 0; i < N; i++) { const x = X(i); if (Math.abs(x) > 60) continue; for (let j = 0; j < N; j++) { const z = X(j); if (z >= 33 && z < bank(x)) { const c = j * N + i; H[c] = L1; B[c] = 0; } } }
  /* deux portes sur le quai : passages décalés pour casser la longue ligne de tir */
  fill(-23, -21, 33, 36, c => { B[c] = 1; }); fill(21, 23, 36, 44, c => { if (H[c] === L1) B[c] = 1; });
  /* jetées des escaliers de rivière */
  const RIV = [-42, -2, 40]; for (const x of RIV) fill(x - 2.5, x + 2.5, 33, 42.5, c => { H[c] = L1; B[c] = 0; });

  yield;
  /* ---------- 2. souterrains ---------- */
  const VOID = (x0, x1, z0, z1, t) => fill(x0, x1, z0, z1, c => { V[c] = t; });
  VOID(-56, 56, 23, 26.5, 3.6);          // grand égout
  VOID(-14, 12, -34, -16, 6);            // citerne
  VOID(-3, 0, -16, 23, 3.4);             // galerie nord-sud
  VOID(-37, -33.5, 26.5, 46, 3.4); VOID(33, 36.5, 26.5, 46, 3.4);      // déversoirs sur la rivière
  fill(33, 36.5, 40, 41, c => { H[c] = L1; }); fill(36.5, 37.5, 39.5, 41, c => { H[c] = L1; });   /* (et l'encoche d'1 m entre le déversoir et l'escalier de la rivière : les claveaux et le parapet ne débordent plus dans le vide) quai droit au-dessus du déversoir est (z 41, comme à côté) : la tête de voûte affleure le mur */
  VOID(-56, -47, 14.5, 23, 3.4); VOID(47, 56, 14.5, 23, 3.4);          // caves ouest et est
  VOID(-24, -14, 14, 23, 3.4); VOID(14, 21, 14, 23, 3.4);              // caves centrales
  /* cages d'escalier ouvertes : maison ouest, maison est, place basse */
  const SLOT = (x0, x1, z0, z1) => fill(x0, x1, z0, z1, c => { H[c] = 0; V[c] = 0; B[c] = 5; });
  const slotW = 2.4, cellarRun = run(L1), halfRun = run(L1 / 2, .4, .24); SLOT(-29.5, -26.5, 26.5, 31.6); SLOT(26.5, 29.5, 26.5, 31.6); /* cages de cave contre le mur pignon, hors du passage entre les deux portes */ SLOT(-13.2, -10.8, 23 - cellarRun, 23);
  /* puits : escalier à vis de la place jusqu'à la citerne */
  const WX = -1, WZ = -25, WR = 2.75; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const ex = Math.max(0, Math.abs(X(i) - WX) - G / 2), ez = Math.max(0, Math.abs(X(j) - WZ) - G / 2), an = Math.atan2(X(j) - WZ, X(i) - WX) * 180 / Math.PI; if (Math.hypot(X(i) - WX, X(j) - WZ) < WR || (Math.hypot(ex, ez) < WR - .03 && an > 40 && an < 100)) { const c = j * N + i; H[c] = 0; V[c] = 0; B[c] = 5; } }
  /* tour d'angle : cylindre vide */
  const TX = 22, TZ = -39.5, TR = 2.6; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (Math.hypot(X(i) - TX, X(j) - TZ) < TR + .28) { const c = j * N + i; H[c] = L2; B[c] = 6; }

  yield;
  /* ---------- 3. maisons ouvertes (intérieurs réels) et terrasses ---------- */
  const OPEN = [
    { x0: -44, x1: -36, z0: -22, z1: -12, base: L2, doors: { xn: [-17], zp: [-38] }, up: { xp: [-16] }, st: 1, bk: { zp: [-42.1] }, stair: { x: -42.74, z: -20.76, dir: 'x+', rail: 1, tread: .38 } },       // bk: breachable panel (map-breach-data.js, engine-breach.js) ; volée le long du mur sud, hors du passage
    { x0: 36, x1: 44, z0: -22, z1: -12, base: L2, doors: { xp: [-17], zp: [38] }, up: { xn: [-16] }, st: 1, bk: { zp: [42.15] }, stair: { x: 42.74, z: -20.76, dir: 'x-', rail: 1, tread: .38 } },   /* pied à 0,9 m du mur, palier de 1,4 m en haut */
    { x0: -30, x1: -22, z0: 22, z1: 32, base: L1, doors: { zn: [-27.9], zp: [-23.6] }, cellar: -28 },
    { x0: 22, x1: 30, z0: 22, z1: 33, base: L1, doors: { zn: [27.9], zp: [23.6] }, cellar: 28 },
  ];
  for (const h of OPEN) fill(h.x0, h.x1, h.z0, h.z1, c => { if (B[c] !== 5) { B[c] = 4; H[c] = h.base; } CV[c] = 1; });
  const TERR = [[-36, -20, -23, -8], [-14, -4, -14, -6], [4, 12, -14, -6], [18, 36, -23, -8]];
  for (const r of TERR) fill(r[0], r[1], r[2], r[3], c => { if (B[c] === 1) FL[c] = 1; });
  /* marché couvert */
  const MK = [-32, -16, -28, -24]; fill(MK[0], MK[1], MK[2], MK[3], c => { CV[c] = 2; });

  yield;
  /* ---------- 4. parcelles bâties ---------- */
  const rP = k.r, parcels = [], used = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = j * N + i; if (B[c] !== 1 || used[c]) continue; const h = H[c], f = FL[c], ok = (a, b) => { if (a >= N || b >= N) return false; const q = b * N + a; return B[q] === 1 && !used[q] && H[q] === h && FL[q] === f; };
    const mw = Math.round((f ? 7 + rP() * 5 : 4.5 + rP() * 5.5) / G), md = Math.round((f ? 7 + rP() * 5 : 4.5 + rP() * 5.5) / G); let w = 1; while (w < mw && ok(i + w, j)) w++; let d = 1; grow: while (d < md) { for (let q = 0; q < w; q++) if (!ok(i + q, j + d)) break grow; d++; }
    for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) used[(j + b) * N + i + a] = 1;
    const x0 = -S + i * G, x1 = x0 + w * G, z0 = -S + j * G, z1 = z0 + d * G, north = h === L2 && z1 <= -33, st = f ? 1 : north ? 1 : rP() < .55 ? 2 : 1, top = f ? ROOF : north ? 11.1 : h + (st === 1 ? 3.1 + rP() * .5 : 5.7 + rP() * .7);
    const p = { x0, x1, z0, z1, i, j, w, d, base: h, top: Math.round(top * 10) / 10, flat: !!f, st, col: PLASTERS[Math.floor(rP() * PLASTERS.length)], sh: SHUTTERS[Math.floor(rP() * SHUTTERS.length)] }; parcels.push(p);
    for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) TOP[(j + b) * N + i + a] = p.top;
  }
  for (let c = 0; c < N * N; c++) if (!TOP[c]) TOP[c] = H[c];
  for (const h of OPEN) fill(h.x0, h.x1, h.z0, h.z1, c => { if (B[c] === 4) TOP[c] = h.base + (h.st ? 5.8 : 3.3); });

  yield;
  /* ---------- 5. lumière cuite ---------- */
  const LAMPS = [];       // [x,y,z,intensité] des souterrains
  for (let x = -52; x <= 52; x += 11.5) LAMPS.push([x, 2.6, 24.1, 1]);
  for (const p of [[-8, 4.3, -31], [6, 4.3, -31], [-8, 4.3, -19], [6, 4.3, -19], [-1.5, 2.6, -8], [-1.5, 2.6, 8], [-35.2, 2.6, 34], [34.8, 2.6, 34], [-51, 2.6, 18], [51, 2.6, 18], [-19, 2.6, 18], [17.5, 2.6, 18]]) LAMPS.push([p[0], p[1], p[2], 1.15]);
  const UG = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = V[j * N + i]; if (v > 0) for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const q = clamp(j + b, 0, N - 1) * N + clamp(i + a, 0, N - 1); if (UG[q] < v + .35) UG[q] = v + .35; } }
  yield;
  /* ouverture au ciel, grille de 2 m */
  const SN = 64, SKY = new Float32Array(SN * SN), DIR = []; for (let a = 0; a < 8; a++) DIR.push([Math.cos(a / 8 * TAU), Math.sin(a / 8 * TAU)]);
  for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) { const cx = -S + (i + .5) * 2, cz = -S + (j + .5) * 2; let lo = 1e9; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const q = Ic(cz + b * .7) * N + Ic(cx + a * .7); if (TOP[q] < lo) lo = TOP[q]; } let occ = 0; for (const [dx, dz] of DIR) { let m = 0; for (const r of [1.6, 3, 5, 8, 12]) { const q = Ic(cz + dz * r) * N + Ic(cx + dx * r), e = (TOP[q] - lo - 1.2) / r; if (e > m) m = e; } occ += Math.min(1, Math.atan(m) / 1.2); } SKY[j * SN + i] = 1 - occ / 8; }
  const bake = (x, y, z, ny, o) => {
    const c = Ic(z) * N + Ic(x);
    if (y < UG[c]) { let r = .3, g = .3, b = .31; for (let i = 0; i < LAMPS.length; i++) { const l = LAMPS[i], dx = x - l[0]; if (dx > 11 || dx < -11) continue; const dz = z - l[2]; if (dz > 11 || dz < -11) continue; const dy = y - l[1], q = dx * dx + dz * dz + dy * dy * 1.4; if (q > 121) continue; const f = l[3] * 3.3 / (1 + q * .2) * (1 - q / 121); r += f * 1.08; g += f * .74; b += f * .4; } const m = ny < -.5 ? .82 : ny > .5 ? 1.06 : 1, fl = y < .35 ? .76 + y * .7 : 1; const warm = ny > .5 ? .7 : 1; o[0] = Math.min(1.5, r * m * fl * (ny > .5 ? 1.06 : 1)); o[1] = Math.min(1.3, g * m * fl * (ny > .5 ? .92 : 1)); o[2] = Math.min(1.1, b * m * fl * warm); return; }
    const si = clamp(Math.floor((x + S) / 2), 0, SN - 1), sj = clamp(Math.floor((z + S) / 2), 0, SN - 1), sk = SKY[sj * SN + si], fl = H[c], up = clamp((y - fl) / 4.2, 0, 1); let v = (.56 + .5 * sk) + (1 - sk) * .34 * up; if (y - fl < .55 && y >= fl - .02) v *= .8 + .2 * clamp((y - fl) / .55, 0, 1); if (ny < -.5) v *= .68; let r = v, g = v, b = v;
    if (CV[c] && y < TOP[c] + .1) { const q = CV[c] === 1 ? .6 : .66; r *= q * 1.04; g *= q * .96; b *= q * .86; } if (y < .9 && !V[c]) { r *= .92; g *= .9; b *= .88; }
    o[0] = r; o[1] = g; o[2] = b;
  };
  const A = new Arch(k, bake); A.merge = new Set(['ar_dark', 'ar_cloth', 'lampA', 'ar_leaf', 'ar_gravel']); A.under = (x, z, top) => { const c = Ic(z) * N + Ic(x); return top <= UG[c] && H[c] >= top + .5; };   /* seulement ce qui est sous une masse pleine : jamais une rue, une cage d'escalier ou le lit de la rivière */

  yield;
  /* ---------- 6. collisions du terrain (fusion gloutonne) ---------- */
  { const done = new Uint8Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = j * N + i; if (done[c] || H[c] <= 0) continue; const h = H[c], v = V[c], same = (a, b) => a < N && b < N && !done[b * N + a] && H[b * N + a] === h && V[b * N + a] === v; let w = 1; while (same(i + w, j)) w++; let d = 1; g2: while (j + d < N) { for (let q = 0; q < w; q++) if (!same(i + q, j + d)) break g2; d++; } for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) done[(j + b) * N + i + a] = 1; const s = k.col(-S + i * G, -S + (i + w) * G, v, h, -S + j * G, -S + (j + d) * G, 'concrete'); s.mm = 0; s.occ = 1; } }
  const sol = (x0, x1, y0, y1, z0, z1, surf = 'concrete') => { const s = k.col(x0, x1, y0, y1, z0, z1, surf); s.mm = 1; return s; };

  yield;
  /* ---------- 7. parements du terrain : soutènements et parois des galeries ---------- */
  const expose = (cA, cB) => {     // intervalles de la masse de A vus depuis la case B
    const out = [], a0 = V[cA], a1 = H[cA]; if (a1 <= 0) return out; const add = (p, q) => { const l = Math.max(p, a0), h = Math.min(q, a1); if (h - l > .05) out.push(l, h); };
    if (V[cB] > 0) add(0, V[cB]); add(B[cB] === 1 || B[cB] === 4 ? TOP[cB] : H[cB], 99); return out;
  };
  const wallRuns = function* (ax) { const L = ax === 'x' ? [1, 0] : [0, 1]; for (const s of [-1, 1]) for (let l = 0; l < N; l++) { if (!(l & 7)) yield; let m = 0; while (m < N) { const cc = (u) => (ax === 'x' ? l * N + u : u * N + l), nb = (u) => { const q = l + s; if (q < 0 || q >= N) return -1; return ax === 'x' ? q * N + u : u * N + q; }, c = cc(m), n = nb(m); if (n < 0 || (V[n] <= V[c] && (B[n] === 1 || B[n] === 4 ? TOP[n] : H[n]) >= H[c])) { m++; continue; } const e = expose(c, n); if (!e.length) { m++; continue; } let t = m + 1; while (t < N) { const c2 = cc(t), n2 = nb(t); if (n2 < 0) break; const e2 = expose(c2, n2); if (e2.length !== e.length || e2.some((v, q) => v !== e[q])) break; t++; } const u0 = -S + m * G, u1 = -S + t * G, w = -S + (l + (s > 0 ? 1 : 0)) * G; for (let q = 0; q < e.length; q += 2) { const low = e[q], high = e[q + 1], ug = high <= 6.05 && V[n] > 0, rock = B[c] === 3; A.sheet('ar_rubble', ax, w, s, u0, u1, low, high, { rough: rock ? .09 : .045, du: rock ? 1.7 : 1.4, dy: rock ? 1.5 : 1.1, tone: rock ? .72 : ug ? .96 : .9, top: rock && high > 9 ? (u => high - .5 * noise2(u * .5, w) - .2 * noise2(u * 2.3, w)) : null }); } m = t; } } void L; };
  yield* wallRuns('x'); yield* wallRuns('z');

  yield;
  /* ---------- 8. sols ---------- */
  { const T = 8, bins = new Map(); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = j * N + i; if (B[c] !== 1 && B[c] !== 5) { const h = H[c], rock = B[c] === 3, m = rock ? 'ar_gravel' : CV[c] === 1 ? 'ar_wood' : h === 0 ? 'ar_gravel' : 'ar_cobble', key = m + '|' + h + '|' + Math.floor(i * G / T) + '|' + Math.floor(j * G / T); if (!bins.has(key)) bins.set(key, { m, h, cells: [], rock }); bins.get(key).cells.push(i, j); } if (V[c] > 0) { const k2 = 'ar_cobble|u|' + Math.floor(i * G / T) + '|' + Math.floor(j * G / T); if (!bins.has(k2)) bins.set(k2, { m: 'ar_cobble', h: .012, cells: [] }); bins.get(k2).cells.push(i, j); } }
    let nB = 0; for (const b of bins.values()) { if (!(++nB & 7)) yield; A.begin(b.m); const y = b.h === 0 ? .014 : b.h, W = (x, z) => (b.m === 'ar_gravel' ? y + .1 * noise2(x * .35, z * .35) * (noise2(x * .11, z * .11) > .4 ? 1 : .3) : y + .012 * noise2(x * 3, z * 3)); const seen = new Set(); for (let q = 0; q < b.cells.length; q += 2) seen.add(b.cells[q + 1] * N + b.cells[q]); for (let q = 0; q < b.cells.length; q += 2) { const ci = b.cells[q], cj = b.cells[q + 1], id = cj * N + ci; if (!seen.has(id)) continue; const big = !(ci & 1) && !(cj & 1) && seen.has(id + 1) && seen.has(id + N) && seen.has(id + N + 1); seen.delete(id); if (big) { seen.delete(id + 1); seen.delete(id + N); seen.delete(id + N + 1); } const x0 = -S + ci * G, z0 = -S + cj * G, x1 = x0 + (big ? 1 : G), z1 = z0 + (big ? 1 : G), t = b.m === 'ar_cobble' ? .9 + .14 * noise2(x0 * .8, z0 * .8) : b.rock ? .62 + .3 * noise2(x0 * .4, z0 * .4) : 1; A.tint(t); A.quad(x0, W(x0, z1), z1, x1, W(x1, z1), z1, x1, W(x1, z0), z0, x0, W(x0, z0), z0); } A.end(); } }
  yield;
  /* gouttière centrale des rues : cunette de pierre le long des voies principales */
  for (const [x0, x1, z, y] of [[-58, -38, -10, L2], [-36, -20, -6, L2], [18, 34, -6, L2], [38, 58, -10, L2], [-58, -40, 16, L1], [-34, -20, 20, L1], [18, 32, 20, L1], [38, 58, 16, L1], [-30, -18, -26, L2], [16, 28, -26, L2]]) { A.begin('ar_ashlar'); for (let x = x0; x < x1; x += .7) { A.stoneTint(.62, .8); A.quad(x, y + .004, z + .17, x + .68, y + .004, z + .17, x + .68, y + .004, z - .17, x, y + .004, z - .17); } A.end(); }

  yield;
  /* ---------- 9. façades et toits ---------- */
  const TOPAT = (x, z) => TOP[Ic(z) * N + Ic(x)], openAt = (x, z) => { const q = B[Ic(z) * N + Ic(x)]; return q !== 1 && q !== 3 && q !== 4; };
  /* aucun balcon au-dessus d'une volée : il couperait la tête de qui monte */
  const STAIRS = [[-56, -52, 7.5, 14], [52, 56, 7.5, 14], [-4, 4, -4, 12], [-28, -24, 6, 14], [24, 28, 6, 14], [-48, -44, -42, -35], [44, 48, -42, -35], [-3, 1, -42, -35], [-32, -16, -28.9, -23.1]], overStair = (ax, w, s, u) => { const a0 = u - .9, a1 = u + .9, b0 = Math.min(w, w + s * .8), b1 = Math.max(w, w + s * .8), x0 = ax === 'x' ? a0 : b0, x1 = ax === 'x' ? a1 : b1, z0 = ax === 'x' ? b0 : a0, z1 = ax === 'x' ? b1 : a1; return STAIRS.some(q => x0 < q[1] && x1 > q[0] && z0 < q[3] && z1 > q[2]); };
  function dressFace(p, ax, w, s, u0, u1, y0) {
    const L = u1 - u0, wallTop = p.top, floorH = p.base, r = A; if (L < 1.2) return;
    r.cornice(ax, w, s, u0, u1, wallTop - .22, { d: .13, h: .22 }); if (p.st === 2) r.cornice(ax, w, s, u0, u1, floorH + 3 - .05, { d: .06, h: .1, tone: .9 });
    const street = y0 <= floorH + .05, nW = Math.max(1, Math.floor(L / 2.9)), cell = L / nW;
    for (let i = 0; i < nW; i++) { const uc = u0 + cell * (i + .5) + (r.r() - .5) * .3, f = r.r();
      if (p.st === 2 || wallTop - floorH > 3.4) { const y = floorH + 3.45; if (y + 1.2 < wallTop - .2) { if (f < .16 && L > 2.6 && !overStair(ax, w, s, uc)) { r.balcony(ax, w, s, uc - .8, uc + .8, floorH + 3.08, { d: .72 }); r.begin('ar_dark'); r.tint(.4); const c1 = w + s * .012; r.quad(...(ax === 'x' ? (s > 0 ? [uc - .42, floorH + 3.1, c1, uc + .42, floorH + 3.1, c1, uc + .42, floorH + 5.1, c1, uc - .42, floorH + 5.1, c1] : [uc + .42, floorH + 3.1, c1, uc - .42, floorH + 3.1, c1, uc - .42, floorH + 5.1, c1, uc + .42, floorH + 5.1, c1]) : (s > 0 ? [c1, floorH + 3.1, uc + .42, c1, floorH + 3.1, uc - .42, c1, floorH + 5.1, uc - .42, c1, floorH + 5.1, uc + .42] : [c1, floorH + 3.1, uc - .42, c1, floorH + 3.1, uc + .42, c1, floorH + 5.1, uc + .42, c1, floorH + 5.1, uc - .42]))); r.end(true); } else r.window(ax, w, s, uc, y, .72, 1.18, { col: p.sh, planter: f > .74, arched: f < .32 }); } }
      if (street) { if (f < .2 && L > 2.8) { const a = uc - .62, b = uc + .62, sp = floorH + 1.72, tp = sp + .56; r.begin('ar_dark'); r.tint(.28); const c1 = w + s * .006; r.quad(...(ax === 'x' ? (s > 0 ? [a, floorH, c1, b, floorH, c1, b, tp, c1, a, tp, c1] : [b, floorH, c1, a, floorH, c1, a, tp, c1, b, tp, c1]) : (s > 0 ? [c1, floorH, b, c1, floorH, a, c1, tp, a, c1, tp, b] : [c1, floorH, a, c1, floorH, b, c1, tp, b, c1, tp, a]))); r.end(true); r.doorLeaf(ax, w + s * .1, s, a + .02, b - .02, floorH, sp + .3, { col: p.sh.map(v => v * 1.25) }); r.arch(ax, w + s * .004, a, b, floorH, sp, tp, .09, { col: false, n: 9, th: .2, proud: .01, pointed: f < .08 }); }
        else if (f < .93) r.window(ax, w, s, uc, floorH + 1.28, .66, .98, { col: p.sh, open: f < .62 }); }
      else if (wallTop - y0 > 1.9) r.window(ax, w, s, uc, Math.max(y0 + .7, wallTop - 2), .6, .9, { col: p.sh });
    }
    if (L > 2.6 && r.r() < .13) r.ivy(ax, w, s, u0 + r.r() * L, wallTop - .2, 1 + r.r() * 1.6, 1.4 + r.r() * 2.2);
    if (L > 3 && street && r.r() < .36) { pt2(ax, r.r() < .5 ? u0 + .12 : u1 - .12, w + s * .08); r.drainpipe(px2, pz2, floorH, wallTop - .12); }
    if (L > 3 && r.r() < .3) { const n = Math.floor(L / 1.25); for (let i = 0; i < n; i++) r.beam(ax, w, s, u0 + (i + .5) * L / n, wallTop - .3, .3, .11); }
  }
  let px2 = 0, pz2 = 0; const pt2 = (ax, u, q) => { if (ax === 'x') { px2 = u; pz2 = q; } else { px2 = q; pz2 = u; } };
  let nP = 0; for (const p of parcels) { if (!(++nP & 7)) yield;
    const s = sol(p.x0, p.x1, p.base, p.flat ? p.top : p.top, p.z0, p.z1); s.occ = 1;
    const faces = [['x', p.z0, -1, p.x0, p.x1, 0, -1], ['x', p.z1, 1, p.x0, p.x1, 0, 1], ['z', p.x0, -1, p.z0, p.z1, -1, 0], ['z', p.x1, 1, p.z0, p.z1, 1, 0]];
    for (const [ax, w, sd, a, b] of faces) { let u = a; while (u < b - 1e-6) { const oX = ax === 'x' ? u + .25 : w + sd * .25, oZ = ax === 'x' ? w + sd * .25 : u + .25, t0 = TOPAT(oX, oZ); if (t0 >= p.top - .05) { u += G; continue; } let e = u + G; while (e < b - 1e-6) { const q = ax === 'x' ? TOPAT(e + .25, w + sd * .25) : TOPAT(w + sd * .25, e + .25); if (Math.abs(q - t0) > .01) break; e += G; } const y0 = Math.max(p.base, t0);
      A.sheet('ar_plaster', ax, w, sd, u, e, y0, p.top, { rgb: p.col, rough: .022, du: 1.6, dy: 1.35, tone: 1 }); if (y0 <= p.base + .05 && e - u > 1.1) { const ph = .34 + A.r() * .34, sd0 = u * 1.7 + w; A.sheet('ar_rubble', ax, w + sd * .016, sd, u, e, y0, y0 + ph + .28, { rough: .018, du: .7, dy: .5, tone: .84, top: q => y0 + ph + .26 * noise2(q * 1.4 + sd0, 2.2) }); } const nS = Math.floor((e - u) / 3.4); for (let q = 0; q < nS; q++) if (A.r() < .55 && p.top - y0 > 1.7) { const sw = .3 + A.r() * .55, sh = .22 + A.r() * .34; A.scar(ax, w, sd, u + sw + A.r() * Math.max(.01, e - u - 2 * sw), y0 + .62 + sh + A.r() * Math.max(.01, p.top - y0 - 1.1 - 2 * sh), sw, sh); } dressFace(p, ax, w, sd, u, e, y0); u = e; } }
    for (const [cx, cz, sx, sz] of [[p.x0, p.z0, -1, -1], [p.x1, p.z0, 1, -1], [p.x0, p.z1, -1, 1], [p.x1, p.z1, 1, 1]]) if (TOPAT(cx + sx * .25, cz + sz * .25) < p.top - 1.4 && TOPAT(cx + sx * .25, cz - sz * .25) < p.top - 1.4 && TOPAT(cx - sx * .25, cz + sz * .25) < p.top - 1.4) A.quoins(cx, cz, -sx, -sz, Math.max(p.base, TOPAT(cx + sx * .25, cz + sz * .25)), p.top - .22);
    if (p.flat) { A.begin('ar_ashlar'); A.tint(.96, .86, .74); const n = Math.max(1, Math.round((p.x1 - p.x0) / .75)), m = Math.max(1, Math.round((p.z1 - p.z0) / .75)); for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { A.stoneTint(.82, 1); const a = p.x0 + (p.x1 - p.x0) * i / n, b = p.x0 + (p.x1 - p.x0) * (i + 1) / n, c = p.z0 + (p.z1 - p.z0) * j / m, d = p.z0 + (p.z1 - p.z0) * (j + 1) / m; A.quad(a, p.top, d, b, p.top, d, b, p.top, c, a, p.top, c); } A.end(); }
    else if (p.x1 - p.x0 >= 2 && p.z1 - p.z0 >= 2) { const ridge = (p.x1 - p.x0 >= p.z1 - p.z0) ? 'x' : 'z', t = A.roof(p.x0, p.x1, p.z0, p.z1, p.top, ridge, { pitch: .36 + A.rnd(.14), gt: 1, gm: 'ar_plaster' }); if (A.r() < .7) { const cx = A.rnd(p.x0 + .7, p.x1 - .7), cz = A.rnd(p.z0 + .7, p.z1 - .7); const cT = t + A.rnd(.25, .8); A.chimney(cx, cz, p.top, cT); sol(cx - .4, cx + .4, p.top, cT + .42, cz - .4, cz + .4); } }
    else A.parapet('x', (p.z0 + p.z1) / 2, p.x0, p.x1, p.top, .12, p.z1 - p.z0, { m: 'ar_plaster', col: false });
  }

  yield;
  /* ---------- 10. maisons ouvertes ---------- */
  const T_W = .36;
  function hWall(ax, c, a, b, y0, y1, holes, sN, sP, rgb) {
    const hs = holes.slice().sort((p, q) => p.a - q.a); let u = a, seg = (p, q, v0, v1) => { if (q - p > .01 && v1 - v0 > .01) { const s = ax === 'x' ? k.col(p, q, v0, v1, c - T_W / 2, c + T_W / 2, 'concrete') : k.col(c - T_W / 2, c + T_W / 2, v0, v1, p, q, 'concrete'); s.mm = 1; } };
    for (const h of hs) { seg(u, h.a, y0, y1); if (h.y0 > y0) seg(h.a, h.b, y0, h.y0); if (h.y1 < y1) seg(h.a, h.b, h.y1, y1); if (h.door) A.arch(ax, c, h.a, h.b, y0, h.spring, h.y1, T_W, { th: .26, pointed: h.pointed }); u = h.b; } seg(u, b, y0, y1);
    if (ax === 'x') { A.begin('ar_plaster'); A.tint(...(rgb || [1, 1, 1])); A.box(a - .004, a + .02, y0, y1, c - T_W / 2, c + T_W / 2); A.box(b - .02, b + .004, y0, y1, c - T_W / 2, c + T_W / 2); A.end(); }
    if (sP) A.sheet('ar_plaster', ax, c + T_W / 2, 1, a, b, y0, y1, { holes: hs, rgb, rough: .02, du: .78, dy: .34 }); if (sN) A.sheet('ar_plaster', ax, c - T_W / 2, -1, a, b, y0, y1, { holes: hs, rgb, rough: .02, du: .78, dy: .34 });
    for (const h of hs) if (h.bk) { const s = ax === 'x' ? k.col(h.a, h.b, h.y0, h.y1, c - T_W / 2, c + T_W / 2, 'concrete') : k.col(c - T_W / 2, c + T_W / 2, h.y0, h.y1, h.a, h.b, 'concrete'); s.breachable = true; s.bkind = h.bk; }       // tagging API: the game draws the panel in this gap
    for (const h of hs) if (!h.door && !h.bk) { for (const s of [-1, 1]) if (s > 0 ? sP : sN) A.window(ax, c + s * T_W / 2, s, (h.a + h.b) / 2, h.y0, h.b - h.a, h.y1 - h.y0, { shutter: false }); }
  }
  for (const h of OPEN) {
    const { x0, x1, z0, z1, base: y } = h, F = 3, top = h.st ? y + 5.8 : y + 3.3, rgb = PLASTERS[Math.floor(k.r() * PLASTERS.length)], D = (c) => ({ a: c - 1, b: c + 1, y0: y, y1: y + 2.62, spring: y + 1.72, door: true, pointed: c % 2 < 1 }), Up = (c) => ({ a: c - .95, b: c + .95, y0: y + F, y1: y + F + 2.5, spring: y + F + 1.7, door: true }), Win = (c, yy) => ({ a: c - .4, b: c + .4, y0: yy, y1: yy + 1.05 });
    const mk = (side, lo, hi) => { const ds = [...(h.doors[side] || []).map(D), ...((h.bk || {})[side] || []).map(c => ({ a: c - 1.1, b: c + 1.1, y0: y, y1: y + 2.4, bk: 'plaster' }))], hs = [...ds]; for (let c = lo + 1.2; c < hi - .9; c += 2.3) if (ds.every(d => c + .55 < d.a || c - .55 > d.b)) hs.push(Win(c, y + 1.15)); return hs; }, mkU = (side, lo, hi) => { const ds = ((h.up || {})[side] || []).map(Up), hs = [...ds]; for (let c = lo + 1.2; c < hi - .9; c += 2.3) if (ds.every(d => c + .55 < d.a || c - .55 > d.b)) hs.push(Win(c, y + F + 1.0)); return hs; };
    { const yw = h.st ? y + F : top + .08;   /* maison basse : les murs montent jusqu'au toit (fente de 30 cm sous le toit avant) */ hWall('x', z0 + T_W / 2, x0, x1, y, yw, mk('zn', x0, x1), true, true, rgb); hWall('x', z1 - T_W / 2, x0, x1, y, yw, mk('zp', x0, x1), true, true, rgb); hWall('z', x0 + T_W / 2, z0 + T_W, z1 - T_W, y, yw, mk('xn', z0, z1), true, true, rgb); hWall('z', x1 - T_W / 2, z0 + T_W, z1 - T_W, y, yw, mk('xp', z0, z1), true, true, rgb); }
    if (h.st) {
      hWall('x', z0 + T_W / 2, x0, x1, y + F, top + .08, mkU('zn', x0, x1), true, true, rgb); hWall('x', z1 - T_W / 2, x0, x1, y + F, top + .08, mkU('zp', x0, x1), true, true, rgb); hWall('z', x0 + T_W / 2, z0 + T_W, z1 - T_W, y + F, top + .08, mkU('xn', z0, z1), true, true, rgb); hWall('z', x1 - T_W / 2, z0 + T_W, z1 - T_W, y + F, top + .08, mkU('xp', z0, z1), true, true, rgb);
      /* volée intérieure le long du mur et plancher percé */
      const ST = h.stair || { x: (x0 + x1) / 2 - .2, z: z0 + T_W + .25, dir: 'z+', rail: 1 }, w = 1.7, sx = ST.x, sz = ST.z, L = A.stairs(sx, sz, w, ST.dir, y, y + F, { walls: false, rail: ST.rail, m: 'ar_ashlar', tread: ST.tread }), hole = ST.dir === 'z+' ? [sx - w / 2, sx + w / 2, sz - .05, sz + L] : ST.dir === 'z-' ? [sx - w / 2, sx + w / 2, sz - L, sz + .05] : ST.dir === 'x+' ? [sx - .05, sx + L, sz - w / 2, sz + w / 2] : [sx - L, sx + .05, sz - w / 2, sz + w / 2];   // trémie à l'aplomb de la volée
      for (const [a, b, c, d] of [[x0 + T_W, hole[0], z0 + T_W, z1 - T_W], [hole[1], x1 - T_W, z0 + T_W, z1 - T_W], [hole[0], hole[1], z0 + T_W, hole[2]], [hole[0], hole[1], hole[3], z1 - T_W]]) if (b - a > .02 && d - c > .02) { if (b - a < .1 || d - c < .1) { /* [stairs2] lame de plancher de 3 cm entre la trémie et le mur, au-dessus du bord de la volée (tête qui cogne, descente qui restait dessus) : retirée, mêmes tirages aléatoires */ for (let i = Math.max(1, Math.round((b - a) / .22)); i > 0; i--) A.rnd(); continue; } sol(a, b, y + F - .18, y + F, c, d, 'wood'); A.begin('ar_wood'); const nb = Math.max(1, Math.round((b - a) / .22)); for (let i = 0; i < nb; i++) { const v = A.rnd(.72, .96); A.tint(v * .86, v * .68, v * .5); const u0 = a + (b - a) * i / nb, u1 = a + (b - a) * (i + 1) / nb; A.box(u0 + .004, u1 - .004, y + F - .05, y + F, c, d, 0, 'y'); } A.tint(.5, .38, .27); A.box(a, b, y + F - .06, y + F - .05, c, d); /* sous-plancher : les joints des lames et le dessous ne laissent plus voir à travers */ for (let q = c + .3; q < d; q += .85) A.box(a, b, y + F - .24, y + F - .05, q - .07, q + .07); A.end(); }
      /* garde-corps sur les bords ouverts de la trémie, jamais sur le bord d'arrivée de la volée */
      { const yF = y + F, arr = ST.dir === 'z+' ? 3 : ST.dir === 'z-' ? 2 : ST.dir === 'x+' ? 1 : 0, lim = [x0 + T_W, x1 - T_W, z0 + T_W, z1 - T_W]; for (let e = 0; e < 4; e++) { if (e === arr) continue; const v = hole[e], far = e & 1 ? lim[e] - v : v - lim[e]; if (far < .3) continue; const c = v + (e & 1 ? .03 : -.03); if (e < 2) { A.handrail('z', hole[2], 1, hole[3] - hole[2], c, yF, yF); k.col(c - .03, c + .03, yF, yF + .95, hole[2], hole[3], 'metal'); } else { A.handrail('x', hole[0], 1, hole[1] - hole[0], c, yF, yF); k.col(hole[0], hole[1], yF, yF + .95, c - .03, c + .03, 'metal'); } } }
      A.begin('ar_wood'); A.tint(.56, .42, .3); for (let q = z0 + .5; q < z1 - .3; q += .9) A.box(x0 + T_W, x1 - T_W, top - .2, top - .04, q - .08, q + .08); A.end(); sol(x0, x1, top, top + .1, z0, z1);
      A.roof(x0, x1, z0, z1, top + .08, (x1 - x0 >= z1 - z0) ? 'x' : 'z', { pitch: .44 });
    } else {
      sol(x0, x1, top, top + .1, z0, z1); A.begin('ar_wood'); A.tint(.56, .42, .3); for (let q = z0 + .5; q < z1 - .3; q += .9) A.box(x0 + T_W, x1 - T_W, top - .2, top - .02, q - .08, q + .08); A.end(); A.roof(x0, x1, z0, z1, top + .08, (x1 - x0 >= z1 - z0) ? 'x' : 'z', { pitch: .46 });
      A.cask(x0 + .95, z0 + 1.1, y); A.cask(x0 + .95, z0 + 1.95, y); A.crate(x1 - .95, z1 - 1, y); A.jar(x1 - .8, z0 + .9, y);
    }
    if (h.cellar !== undefined) { /* escalier de cave à deux volées et palier, du grand égout au rez-de-chaussée */
      const c = h.cellar, mid = y / 2, zL = 26.5 + halfRun; A.stairs(c - .75, 26.5, 1.5, 'z+', 0, mid, { walls: false, rise: .24, tread: .4 }); A.landing(c - 1.5, c + 1.5, zL, 31.6, mid, { y0: 0 }); A.stairs(c + .75, zL, 1.5, 'z-', mid, y, { walls: false, rise: .24, tread: .4 });
      sol(c - .05, c + .05, 0, y + .95, 26.5, zL); A.begin('ar_rubble'); A.tint(.9); A.box(c - .05, c + .05, 0, y + .92, 26.5, zL, .006); A.end(); const pa = c - 1.5 - (c - 1.5 - (x0 + T_W) < .2 ? .14 : 0), pb = c + 1.5 + ((x1 - T_W) - c - 1.5 < .2 ? .14 : 0);   /* cage contre le pignon : les garde-corps vont jusqu'au mur */ A.parapet('x', 26.44, pa, c, y, .92, .12, {}); A.parapet('z', c - 1.56, 26.5, 31.6, y, .92, .12, {}); A.parapet('z', c + 1.56, 26.5, 31.6, y, .92, .12, {}); A.parapet('x', 31.66, pa, pb, y, .92, .12, {}); }
    A.lantern((x0 + x1) / 2 + 1.2, y + 2.35, (z0 + z1) / 2);
  }

  yield;
  /* ---------- 11. circulations verticales ---------- */
  /* ville basse <-> haute : ouest, est, grande rampe à pas d'âne */
  for (const x of [-54, 54]) A.stairs(x, 7.5 + run(L2 - L1), 4, 'z-', L1, L2, { walls: false, rail: 1 });
  A.stairs(0, 12, 8, 'z-', L1, L2, { tread: 1, rise: RISE, walls: false, wear: .03 });
  for (const sd of [-1, 1]) A.handrail('z', 12, -1, 16, sd * 3.86, L1, L2);
  for (const x of [-26, 26]) A.stairs(x, 6 + run(L2 - L1), 4, 'z-', L1, L2, { walls: false, rail: x < 0 ? 1 : -1 });   // toute la largeur du passage (4 m) : plus de vide de 10 cm le long des murs
  /* quai <-> rivière */
  for (const x of RIV) A.stairs(x, 42.5 + run(L1), 3.6, 'z-', 0, L1, { rail: -1 });
  /* place basse <-> égout */
  A.stairs(-12, 23, slotW, 'z-', 0, L1, { walls: false });
  for (const sd of [-1, 1]) A.parapet('z', -12 + sd * (slotW / 2 + .08), 23 - cellarRun, 23, L1, .9, .16, {});
  A.parapet('x', 23.08, -13.3, -10.7, L1, .9, .16, {});
  /* ville haute <-> rempart */
  for (const [x, w] of [[-46, 4], [-1, 4], [46, 4]]) A.stairs(x, -42 + run(L3 - L2), w, 'z-', L2, L3, { walls: false, rail: 1 });
  /* rue <-> terrasses : escaliers extérieurs */
  const rr = run(ROOF - L2), OUT = [[-15.5, -14.85, 'x+', -15.5 + rr, -15.5 + rr + 1.15, -15.6, -14], [12.5, -14.85, 'x-', 12.5 - rr, 12.5 - rr - 1.15, -15.6, -14], [-35.5, -7.25, 'x+', -35.5 + rr, -35.5 + rr + 1.15, -8, -6.5], [35.1, -7.25, 'x-', 35.1 - rr, 35.1 - rr - 1.15, -8, -6.5]];
  for (const [x, z, dir, e0, e1, z0, z1] of OUT) { A.stairs(x, (z0 + z1) / 2, z1 - z0, dir, L2, ROOF, { walls: false, rail: dir === 'x+' ? -1 : 1, newel: !openAt(x - (dir === 'x+' ? 1 : -1) * .9, z) ? [] : [-1, 1].filter(sd => { const px = x + (dir === 'x+' ? 1 : -1) * .23, pz = z + sd * .92; return openAt(px, pz); }) });   /* [stairs2] pas de pilastres quand le pied est à moins d'un mètre d'un mur : ils fermaient l'accès latéral à la première marche (volée -15,5) */ const lo = Math.min(e0, e1), hi = Math.max(e0, e1); A.landing(lo, hi, z0, z1, ROOF, { y0: ROOF - .3 }); A.begin('ar_ashlar'); A.tint(.8); A.box(lo, hi, ROOF - .3, ROOF - .02, z0, z1, .01); A.end(); for (const px of [lo + .12, hi - .12]) { A.column(px, z < -12 ? z0 + .14 : z1 - .14, L2, ROOF - .3, .09, { seg: 8 }); } }
  /* passerelles couvertes entre les terrasses */
  const bridge = (x0, x1, z0, z1, covered) => { const s = sol(x0, x1, ROOF - .16, ROOF, z0, z1, 'wood'); void s; A.begin('ar_wood'); const n = Math.round((x1 - x0) / .2); for (let i = 0; i < n; i++) { const v = A.rnd(.74, 1); A.tint(v * .84, v * .66, v * .46); const a = x0 + (x1 - x0) * i / n + .005, b = x0 + (x1 - x0) * (i + 1) / n - .005, sag = -.03 * Math.sin(((a + b) / 2 - x0) / (x1 - x0) * Math.PI); A.box(a, b, ROOF - .05 + sag, ROOF + sag, z0, z1, .004); } A.tint(.5, .38, .27); for (const z of [z0 + .12, z1 - .12]) A.box(x0, x1, ROOF - .26, ROOF - .05, z - .08, z + .08, .006); A.end();
    for (const sd of [-1, 1]) { const z = sd < 0 ? z0 + .05 : z1 - .05; A.begin('ar_wood'); A.tint(.56, .42, .3); const m = Math.max(2, Math.round((x1 - x0) / 1.05)); for (let i = 0; i <= m; i++) { const x = x0 + (x1 - x0) * i / m; A.rod(x, ROOF - .05, z, x, ROOF + (covered ? 2.2 : .98), z, .04, 5); } A.rod(x0, ROOF + .96, z, x1, ROOF + .96, z, .035, 5); A.rod(x0, ROOF + .5, z, x1, ROOF + .5, z, .02, 4); A.end(); k.col(x0, x1, ROOF, ROOF + 1, z - .04, z + .04, 'wood'); }
    if (covered) { A.roof(x0 + .05, x1 - .05, z0, z1, ROOF + 2.18, 'x', { over: .3, pitch: .55, col: false, gable: false }); k.col(x0, x1, ROOF + 2.2, ROOF + 2.5, z0, z1, 'concrete'); } };
  bridge(-20, -14, -11.5, -8.5, false); bridge(-4, 4, -11.5, -8.5, true); bridge(12, 18, -11.5, -8.5, false);
  /* parapets des terrasses, ouverts aux passerelles, escaliers et portes */
  const gapped = (ax, c, a, b, y, gaps, h = .92) => { let u = a; for (const [p, q] of gaps.slice().sort((m, n) => m[0] - n[0])) { if (p - u > .3) A.parapet(ax, c, u, p, y, h, .24); u = Math.max(u, q); } if (b - u > .3) A.parapet(ax, c, u, b, y, h, .24); };
  gapped('x', -22.9, -36, -20, ROOF, []); gapped('x', -8.12, -36, -20, ROOF, [[-35.5 + rr - .05, -35.5 + rr + 1.2]]); gapped('z', -19.9, -23, -8, ROOF, [[-11.49, -8.4]]); gapped('z', -35.9, -23, -8, ROOF, [[-17, -15]]);
  gapped('x', -13.88, -14, -4, ROOF, [[-15.5 + rr - .05, -15.5 + rr + 1.2]]); gapped('x', -6.12, -14, -4, ROOF, []); gapped('z', -13.88, -14, -6, ROOF, [[-11.6, -8.4]]); gapped('z', -4.12, -14, -6, ROOF, [[-11.6, -8.4]]);
  gapped('x', -13.88, 4, 12, ROOF, [[12.5 - rr - 1.2, 12.5 - rr + .05]]); gapped('x', -6.12, 4, 12, ROOF, []); gapped('z', 4.12, -14, -6, ROOF, [[-11.6, -8.4]]); gapped('z', 11.88, -14, -6, ROOF, [[-11.6, -8.4]]);
  gapped('x', -22.9, 18, 36, ROOF, []); gapped('x', -8.12, 18, 36, ROOF, [[35.1 - rr - 1.2, 35.1 - rr + .05]]); gapped('z', 18.12, -23, -8, ROOF, [[-11.6, -8.4]]); gapped('z', 35.9, -23, -8, ROOF, [[-17, -15]]);

  /* rempart : merlons au nord, parapet ruiné au sud */
  A.parapet('x', -50.2, -60, 60, L3, .95, .7, { merlon: 1.15, gap: .72, merlonH: .85 }); k.col(-64, 64, L3, 18, -50.55, -50.2, 'concrete').mm = 0;
  { let u = -60; for (const [p, q] of [[-48.2, -43.8], [-3.2, 1.2], [20.4, 23.6], [43.8, 48.2]]) { if (p - u > .4) A.parapet('x', -41.85, u, p, L3, .78, .3, { broken: true }); u = q; } A.parapet('x', -41.85, u, 60, L3, .78, .3, { broken: true }); }
  /* tour d'angle à vis */
  { const n = 26; for (let i = 0; i < n; i++) { const a = i / n * TAU, b = (i + 1) / n * TAU, m = (a + b) / 2, sv = Math.sin(m), cv = Math.cos(m), southDoor = sv > .84, northDoor = sv < -.84, y0 = L2, y1 = L3 + 3.2, r0 = TR + .02, r1 = TR + .5, pieces = southDoor ? [[L2 + 2.5, y1]] : northDoor ? [[L2, L3], [L3 + 2.4, y1]] : [[y0, y1]];
      for (const [p, q] of pieces) { A.begin('ar_rubble'); A.tint(.86 + .16 * noise2(i * .7, p)); const poly = [[TX + Math.cos(a) * r0, TZ + Math.sin(a) * r0], [TX + Math.cos(a) * r1, TZ + Math.sin(a) * r1], [TX + Math.cos(b) * r1, TZ + Math.sin(b) * r1], [TX + Math.cos(b) * r0, TZ + Math.sin(b) * r0]]; A.prism(poly, p, q); A.end(); const xs = poly.map(v => v[0]), zs = poly.map(v => v[1]); sol(Math.min(...xs), Math.max(...xs), p, q, Math.min(...zs), Math.max(...zs)); } void cv; }
    for (let i = 0; i < 12; i++) { if (i % 2) continue; const a = i / 12 * TAU, a2 = (i + 1) / 12 * TAU, r0 = TR + .04, r1 = TR + .52, y = L3 + 3.2; A.begin('ar_ashlar'); A.stoneTint(.82, 1); A.prism([[TX + Math.cos(a) * r0, TZ + Math.sin(a) * r0], [TX + Math.cos(a) * r1, TZ + Math.sin(a) * r1], [TX + Math.cos(a2) * r1, TZ + Math.sin(a2) * r1], [TX + Math.cos(a2) * r0, TZ + Math.sin(a2) * r0]], y, y + .62); A.end(); { const px = [Math.cos(a) * r0, Math.cos(a) * r1, Math.cos(a2) * r1, Math.cos(a2) * r0], pz = [Math.sin(a) * r0, Math.sin(a) * r1, Math.sin(a2) * r1, Math.sin(a2) * r0]; sol(TX + Math.min(...px), TX + Math.max(...px), y, y + .62, TZ + Math.min(...pz), TZ + Math.max(...pz)); } }
    A.spiral(TX, TZ, TR, .62, L2, L3, { a0: Math.PI / 2, perTurn: 16, rise: .15 }); }
  /* puits : margelle ouverte au sud-ouest, escalier à vis jusqu'à la citerne */
  { const nS = 56, a0 = Math.PI / 2 - nS * TAU / 16; A.spiral(WX, WZ, WR - .38, .62, 0, L2, { a0, perTurn: 16, rise: L2 / nS, foot: true });   /* [stairs2] marches jusqu'à 2,37 m (et non 2,67) : le puits est découpé dans la grille de 0,5 m, ses cellules du bord rentrent jusqu'à 2,4 m ; le bout des marches passait sous la dalle de la rue (1,6 à 1,7 m de hauteur libre) */
    const seg = 22; for (let i = 0; i < seg; i++) { const a = i / seg * TAU, b = (i + 1) / seg * TAU, m = ((a + b) / 2) % TAU; if (m > Math.PI * .38 && m < Math.PI * .56) continue; const r0 = WR + .02, r1 = WR + .4, y = L2; A.begin('ar_ashlar'); A.stoneTint(.8, 1.02); const poly = [[WX + Math.cos(a) * r0, WZ + Math.sin(a) * r0], [WX + Math.cos(a) * r1, WZ + Math.sin(a) * r1], [WX + Math.cos(b) * r1, WZ + Math.sin(b) * r1], [WX + Math.cos(b) * r0, WZ + Math.sin(b) * r0]]; A.prism(poly, y, y + .82); A.end(); /* [stairs2] collision en 4 boîtes par pierre : la boîte unique rentrait jusqu'à 2,35 m du centre (au-dessus du dernier tour de l'escalier) */ for (let q = 0; q < 4; q++) { const c = a + (b - a) * q / 4, d = a + (b - a) * (q + 1) / 4, px = [Math.cos(c) * r0, Math.cos(c) * r1, Math.cos(d) * r1, Math.cos(d) * r0], pz = [Math.sin(c) * r0, Math.sin(c) * r1, Math.sin(d) * r1, Math.sin(d) * r0]; sol(WX + Math.min(...px), WX + Math.max(...px), y, y + .82, WZ + Math.min(...pz), WZ + Math.max(...pz)); } }
    { const a0 = 40 * Math.PI / 180, a1 = 100 * Math.PI / 180, aG = 69.5 * Math.PI / 180, r1 = WR + .8, n = 8, rIn = an => an >= aG ? WR - .3 : WR; A.begin('ar_ashlar'); A.stoneTint(.84, 1.02); for (let q = 0; q < n; q++) { const a = a0 + (a1 - a0) * q / n, b = a0 + (a1 - a0) * (q + 1) / n, r0 = rIn((a + b) / 2); A.prism([[WX + Math.cos(a) * r0, WZ + Math.sin(a) * r0], [WX + Math.cos(a) * r1, WZ + Math.sin(a) * r1], [WX + Math.cos(b) * r1, WZ + Math.sin(b) * r1], [WX + Math.cos(b) * r0, WZ + Math.sin(b) * r0]], L2 - .45, L2 + .01); } A.end();
      for (let zz = WZ - r1; zz < WZ + r1; zz += .2) for (let xx = WX - r1; xx < WX + r1; xx += .2) { const cx = xx + .1, cz = zz + .1, rr = Math.hypot(cx - WX, cz - WZ), an = Math.atan2(cz - WZ, cx - WX); if (an < a0 || an > a1 || rr > r1 || rr < rIn(an) + .1) continue; k.col(xx, xx + .2, L2 - .08, L2, zz, zz + .2, 'concrete'); } }
    { const a = 65.5 * Math.PI / 180, b = 69.5 * Math.PI / 180, r0 = WR + .02, r1 = WR + .4; A.begin('ar_ashlar'); A.stoneTint(.8, 1.02); const poly = [[WX + Math.cos(a) * r0, WZ + Math.sin(a) * r0], [WX + Math.cos(a) * r1, WZ + Math.sin(a) * r1], [WX + Math.cos(b) * r1, WZ + Math.sin(b) * r1], [WX + Math.cos(b) * r0, WZ + Math.sin(b) * r0]]; A.prism(poly, L2, L2 + .82); A.end(); const xs = poly.map(v => v[0]), zs = poly.map(v => v[1]); sol(Math.min(...xs), Math.max(...xs), L2, L2 + .82, Math.min(...zs), Math.max(...zs)); }
    /* potence de fer forgé au-dessus du puits */
    A.begin('ar_iron'); A.tint(.34, .34, .36); for (const sd of [-1, 1]) A.rod(WX + sd * (WR + .2), L2 + .8, WZ - .9, WX + sd * .3, L2 + 3.5, WZ - .9, .05, 6); A.rod(WX - .5, L2 + 3.5, WZ - .9, WX + .5, L2 + 3.5, WZ - .9, .05, 6); A.rod(WX, L2 + 3.5, WZ - .9, WX, L2 + 2.5, WZ - .9, .012, 3); A.end(); A.cask(WX, WZ - .9, L2 + 2.0, .16, .34); k.solids.pop(); k.solids.pop(); k.solids.pop(); }

  yield;
  /* ---------- 12. voûtes et mobilier des souterrains ---------- */
  const inWell = (x, z) => Math.hypot(x - WX, z - WZ) < WR + .1;
  for (const [a, b] of [[-34, -28], [-28, -22], [-22, -16]]) A.vault('x', -14, 12, a, b, 3.6, 5.96, { hole: inWell, rib: 5.2, seg: 12 });
  for (const z of [-28, -22]) for (let x = -11.4; x < 12; x += 5.2) { if (Math.hypot(x - WX, z - WZ) < WR + .8) continue; A.column(x, z, 0, 3.7, .42, { m: 'ar_ashlar' }); }
  A.vault('x', -56, 56, 23, 26.5, 2.1, 3.58, { rib: 3.6, shell: .12, hole: (x) => (x > -27.4 && x < -24.6) || (x > 24.6 && x < 27.4) || (x > -13.4 && x < -10.6) ? false : false });
  /* plafond sombre du grand égout au ras de la roche (vu d'en bas seulement) : depuis les galeries latérales, le regard passait au-dessus des reins jusqu'au ciel */ A.begin('ar_rubble'); for (let x = -56; x < 56; x += 4) { A.tint(.6 + .08 * noise2(x * .3, 2.1)); A.quad(x, 3.6, 23, x + 4, 3.6, 23, x + 4, 3.6, 26.5, x, 3.6, 26.5); } A.end();   /* moellon dans l'ombre, pas un vide noir */
  A.vault('z', -16, 23, -3, 0, 2.1, 3.38, { rib: 3.8, ends: 'u0' });   /* tympan côté citerne : plus de ciel dans les coins de l'ouverture */
  /* déversoirs : la voûte s'arrête au mur du quai (tête à claveaux, tympan, parapet au-dessus) ; dehors, le radier seul */
  for (const [x0, x1, zb] of [[-37, -33.5, 40], [33, 36.5, 41]]) { A.vault('z', 26.5, zb, x0, x1, 2.1, 3.38, { rib: 3.8, ends: 'u1' }); A.arch('x', zb - .1, x0, x1, 0, 2.1, 3.38, .2, { col: false, th: .32, proud: .03 });   /* le parapet au-dessus est celui du quai (boucle des garde-corps de la rivière) */ }
  for (const [x0, x1] of [[-56, -47], [47, 56], [-24, -14], [14, 21]]) A.vault('z', x0 === -24 || x0 === 14 ? 14 : 14.5, 23, x0, x1, 2.1, 3.38, { rib: 2.8 });   /* caves centrales : la voûte couvre toute la cave (fente de 50 cm au fond avant) */
  for (const l of LAMPS) { A.lantern(l[0], l[1], l[2]); }
  for (const [x, z] of [[-54.8, 15.6], [-54.8, 16.5], [-53.9, 15.6], [54.6, 15.6], [54.6, 16.5], [-23, 15.4], [-23, 16.3], [20, 15.4], [19.1, 15.4]]) A.cask(x, z, 0);
  for (const [x, z] of [[-49, 16], [49, 16], [-15.2, 15.6], [15.2, 15.6]]) { A.crate(x, z, 0, .85); A.jar(x + 1.1, z - .1, 0, 1.1); }

  yield;
  A.wellCurb(WX, WZ, 5.72, WR + .03, .28, .34);
  /* ---------- 13. marché couvert ---------- */
  { const [x0, x1, z0, z1] = MK, sp = L2 + 2.5, cr = L2 + 3.75; k.col(x0, x1, cr, cr + .3, z0, z1, 'concrete').mm = 0; A.vault('x', x0, x1, z0, z1, sp, cr, { m: 'ar_plaster', rib: 3.2, seg: 10, tone: .92 }); A.roof(x0, x1, z0 - .3, z1 + .3, cr + .28, 'x', { pitch: .32, gable: false }); for (let x = x0 + 2; x < x1 - 1; x += 4.1) { const nS = (Math.round((x - x0) / 4.1) % 2); A.stall('x', x, nS ? z0 + .72 : z1 - .72, L2, { L: 2.6, D: .95, cols: nS ? [[.76, .3, .24], [.9, .84, .7]] : [[.34, .46, .55], [.9, .86, .74]] }); } for (const e of [x0, x1]) A.arch('z', e, z0 + .34, z1 - .34, L2, sp, cr, .5, { th: .34, pointed: true });   /* piles contre les façades (fente de 2 cm avant) */ A.lantern((x0 + x1) / 2 - 4, cr - .55, (z0 + z1) / 2); A.lantern((x0 + x1) / 2 + 4, cr - .55, (z0 + z1) / 2); }

  yield;
  /* ---------- 14. arches sur rue, détails de vie ---------- */
  /* porches : un arc franchit la rue, une chambre au-dessus */
  const porch = (ax, c, a, b, y, sp = 2.5, cr = 3.5, pointed = false) => { const yTop = y + cr + 1.5; A.arch(ax, c, a, b, y, y + sp, y + cr, .7, { pointed, th: .36 }); A.wcol(ax, a, b, y + cr, yTop, c - .35, c + .35, 'concrete'); A.sheet('ar_plaster', ax, c + .35, 1, a - .05, b + .05, y + sp, yTop, { holes: [{ a, b, y0: y, y1: y + cr, spring: y + sp, pointed }], rgb: PLASTERS[2], du: .6, dy: .24 }); A.sheet('ar_plaster', ax, c - .35, -1, a - .05, b + .05, y + sp, yTop, { holes: [{ a, b, y0: y, y1: y + cr, spring: y + sp, pointed }], rgb: PLASTERS[2], du: .6, dy: .24 }); if (ax === 'x') A.roof(a - .1, b + .1, c - .5, c + .5, yTop, 'x', { pitch: .5, over: .22, col: true, gable: false }); else A.roof(c - .5, c + .5, a - .1, b + .1, yTop, 'z', { pitch: .5, over: .22, col: true, gable: false }); };
  porch('z', -36, -12, -8, L2); porch('z', 36, -12, -8, L2, 2.4, 3.4, true); porch('z', -36, 18, 22, L1, 2.4, 3.4, true); porch('z', 34, 18, 22, L1); porch('x', -4.2, -20, -14, L2, 2.5, 3.5); porch('x', -4.2, 12, 18, L2, 2.5, 3.5, true); 
  const courtWall = (x0, x1, a, b, pointed) => { const z = -4, t = .56, y = L2, H = 3.7, sp = y + 2.35, cr = y + 3.25, hole = [{ a, b, y0: y, y1: cr, spring: sp, pointed }]; for (const [p, q] of [[x0, a], [b, x1]]) sol(p, q, y, y + H, z - t / 2, z + t / 2); sol(a, b, cr, y + H, z - t / 2, z + t / 2); A.arch('x', z, a, b, y, sp, cr, t, { pointed, th: .32 }); for (const sd of [-1, 1]) A.sheet('ar_plaster', 'x', z + sd * t / 2, sd, x0, x1, y, y + H, { holes: hole, rgb: PLASTERS[sd > 0 ? 1 : 4], du: .6, dy: .24, top: u => y + H - .22 * noise2(u * .7, z) }); A.parapet('x', z, x0, x1, y + H - .1, .12, t + .06, { m: 'ar_ashlar', col: false }); };
  courtWall(-34, -20, -29, -25, false); courtWall(20, 34, 25, 29, true);
  /* portes du quai : grand arc au-dessus du passage laissé libre */
  A.arch('z', -22, 36.4, bank(-22) - .4, L1, L1 + 2.5, L1 + 3.6, .9, { th: .4, pointed: true }); A.arch('z', 22, 33.4, 35.6, L1, L1 + 2.5, L1 + 3.6, .9, { th: .4 }); A.wcol('z', 36.4, bank(-22) - .4, L1 + 3.6, L1 + 4.5, -22.45, -21.55); A.wcol('z', 33.4, 35.6, L1 + 3.6, L1 + 4.5, 21.55, 22.45);
  /* parapet du quai, ouvert sur les escaliers */
  { let u = -60; for (const x of [...RIV, 61]) { const e = Math.min(x - 2.4, 60); for (let a = u; a < e; a += 3) { const b = Math.min(a + 3, e); if (b - a < .3) continue; const z = Math.max(bank(a), bank(b - .01)) - .12; if (z < 36.5) continue; A.parapet('x', z, a, b, L1, .78, .24, {}); } u = x + 2.4; } }
  /* auvents, linge, câbles, lanternes de rue, bacs */
  for (const [ax, c, s, a, b, y] of [['x', -14, 1, -11, -7, L2 + 2.7], ['x', -14, 1, 7, 11, L2 + 2.7], ['x', 12, -1, -16, -11, L1 + 2.65], ['x', 12, -1, 6, 12, L1 + 2.65], ['z', 16, -1, 20, 26, L1 + 2.7], ['x', 18, -1, 22, 28, L1 + 2.7], ['x', -36, 1, -12, -6, L2 + 2.7]]) if (ax === 'x') A.awning('x', c, s, a, b, y, { d: 1.55, floor: y - 2.7 }); else A.awning('z', c, s, a, b, y, { d: 1.5, floor: y - 2.7 });
  for (const [x0, z0, x1, z1, y] of [[-30, -33, -30, -29, L2 + 3.1], [-49, -12, -47, -8, L2 + 3], [42, -33, 42, -29, L2 + 3.1], [49, -12, 47, -8, L2 + 3.1], [-52, 14, -52, 18, L1 + 3], [52, 14, 52, 18, L1 + 3], [-28, 18, -28, 22, L1 + 3.1], [28, 18, 28, 22, L1 + 3.1], [-26, -8, -26, -4, L2 + 3], [26, -8, 26, -4, L2 + 3]]) A.cable(x0, y, z0, x1, y + .2, z1, .2, { laundry: true });
  for (const [x0, z0, x1, z1, y] of [[-44, -29, -36, -33, L2 + 3.6], [44, -29, 34, -33, L2 + 3.6], [-18, 12, 16, 30, L1 + 5], [-40, 14, -34, 22, L1 + 3.4], [36, 14, 32, 22, L1 + 3.4]]) A.cable(x0, y, z0, x1, y - .3, z1, .45);
  for (const [x, z, y, d] of [[-16, -30, L2, 1], [14, -30, L2, -1], [-18, 26, L1, 1], [16, 26, L1, -1], [-60, -6, L2, 1], [60, -6, L2, -1], [-28, 6.6, L2, 1], [28, 6.6, L2, -1], [-40, 21.5, L1, 1], [40, 21.5, L1, -1], [-30, -32.6, L2, -1]]) { A.begin('ar_iron'); A.tint(.3, .3, .32); A.rod(x, y + 2.75, z, x + d * .5, y + 2.75, z, .02, 4); A.rod(x, y + 2.42, z, x + d * .32, y + 2.74, z, .013, 4); A.box(Math.min(x, x + d * .03), Math.max(x, x + d * .03), y + 2.36, y + 2.84, z - .05, z + .05); A.end(); A.lantern(x + d * .5, y + 2.55, z); }
  for (const [x, z, y] of [[-33, 5.3, L2], [-21, 5.3, L2], [21, 5.3, L2], [33, 5.3, L2], [-15.5, -35.5, L2], [13.5, -35.5, L2], [-59, 6.9, L2], [59, 6.9, L2], [-17.3, 29.3, L1], [15.4, 29.3, L1], [-44, 32, L1], [44, 32, L1]]) A.planter(x, z, y);
  for (const [x, z, y] of [[-33.2, 3.2, L2], [33.2, 3.2, L2], [-20.8, 0, L2], [-59, 2, L2], [59, 2, L2], [-17, 13, L1], [15.3, 13, L1], [-40, 33.5, L1], [40, 34, L1]]) A.jar(x, z, y, A.rnd(.95, 1.25));
  for (const [x, z, y] of [[-58.8, -3.5, L2], [-58.8, -2.4, L2], [58.8, -3.5, L2], [58.8, -2.4, L2], [31, -3.2, L2], [-31, -3.2, L2], [-15, 28.5, L1], [13.6, 28.5, L1], [-47, 35, L1], [47, 35, L1]]) A.cask(x, z, y);
  for (const [x, z, y, s] of [[-58.9, 4.6, L2, .95], [58.9, 4.6, L2, .95], [-33, -1, L2, 1], [33, -1, L2, 1], [-16.5, 14.5, L1, .9], [14.5, 14.5, L1, .9], [-50, 34.8, L1, 1], [50, 34.8, L1, 1]]) { A.crate(x, z, y, s); if (A.r() < .6) A.crate(x + .08, z + .05, y + s, s * .7); }
  /* cours : figuier et fontaine, repères lisibles */
  A.tree(-27, 1.5, L2, 1.22);
  { const fx = 27, fz = 1, y = L2, R = 1.5; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, b = (i + 1) / 16 * TAU; A.begin('ar_ashlar'); A.stoneTint(.82, 1.02); A.prism([[fx + Math.cos(a) * (R - .22), fz + Math.sin(a) * (R - .22)], [fx + Math.cos(a) * R, fz + Math.sin(a) * R], [fx + Math.cos(b) * R, fz + Math.sin(b) * R], [fx + Math.cos(b) * (R - .22), fz + Math.sin(b) * (R - .22)]], y, y + .62); A.end(); } k.disc(fx, fz, R, y, y + .62, 'concrete'); A.column(fx, fz, y, y + 1.7, .15, { seg: 10 }); A.begin('ar_ashlar'); A.tint(.92); const bowl = []; for (let i = 0; i < 12; i++) bowl.push([fx + Math.cos(i / 12 * TAU) * .55, fz + Math.sin(i / 12 * TAU) * .55]); A.prism(bowl, y + 1.7, y + 1.82); A.end(); }
  /* gravats et galets dans le lit de la rivière (instances existantes) */
  for (let i = 0; i < 150; i++) { const x = A.rnd(-62, 62), z = A.rnd(43, 57); k.inst.push({ k: 'rubble', x, y: 0, z, s: A.rnd(.05, .17), ry: A.r() * 6 }); }
  const L_SP = [[-18, 50], [14, 49], [-6, 53]], rocks = [], placeRock = (x, z, q, o) => { for (const p of L_SP) if (Math.hypot(x - p[0], z - p[1]) < q * 1.8 + 1.6) return; for (const p of rocks) if (Math.hypot(x - p[0], z - p[1]) < (q + p[2]) * 1.75 + 1.3) return; rocks.push([x, z, q]); A.boulder(x, z, q, o); };
  for (let i = 0; i < 26; i++) { const x = A.rnd(-58, 58), z = A.rnd(46, 54); if (RIV.some(r => Math.abs(x - r) < 4.5)) continue; placeRock(x, z, A.rnd(.45, 1.05), { sx: A.rnd(1.05, 1.4) }); }
  for (let x = -57; x < 58; x += 7.4) { if (RIV.some(r => Math.abs(x - r) < 4.6) || Math.abs(x + 35) < 3.4 || Math.abs(x - 35) < 3.4) continue; const b = bank(x), w = .62 + A.rnd(.2); A.begin('ar_rubble'); A.tint(.86); const nC = 5; for (let i = 0; i < nC; i++) { const y0 = L1 * .82 * i / nC, y1 = L1 * .82 * (i + 1) / nC, d0 = .95 * (1 - i / nC) + .1, d1 = .95 * (1 - (i + 1) / nC) + .1; A.quad(x - w, y0, b + d0, x + w, y0, b + d0, x + w, y1, b + d1, x - w, y1, b + d1); A.quad(x + w, y0, b + d0, x + w, y0, b - .05, x + w, y1, b - .05, x + w, y1, b + d1); A.quad(x - w, y0, b - .05, x - w, y0, b + d0, x - w, y1, b + d1, x - w, y1, b - .05); } A.end(); for (let i = 0; i < 5; i++) { const d = .95 * (1 - (i + .5) / 5) + .1; k.col(x - w, x + w, L1 * .82 * i / 5, L1 * .82 * (i + 1) / 5, b - .05, b + d, 'concrete'); } }
  for (const mx of [-35.25, 34.75]) A.arch('x', bank(mx) + .05, mx - 1.75, mx + 1.75, 0, 2.1, 3.38, .5, { th: .36 });
  for (let i = 0; i < 16; i++) { const x = -60 + i * 8 + A.rnd(-1.5, 1.5), sy = A.rnd(.9, 2.3); placeRock(x, A.rnd(51.2, 52.8), sy * .55, { sx: A.rnd(1.1, 1.45), tone: A.rnd(.62, .82) }); }
  A.begin('ar_plant'); for (let i = 0; i < 130; i++) { const x = A.rnd(-62, 62), z = A.r() < .5 ? bank(x) + A.rnd(.1, 2.2) : A.rnd(52, 56), h = A.rnd(.14, .36), g = A.rnd(.36, .56); A.tint(g * 1.25, g, g * .46); for (let q = 0; q < 3; q++) { const a = A.rnd(TAU), r = A.rnd(.05, .17), dx = Math.cos(a) * r, dz = Math.sin(a) * r; A.tri(x - dz * .4, .02, z + dx * .4, x + dz * .4, .02, z - dx * .4, x + dx * 1.5, h, z + dz * 1.5); A.tri(x + dz * .4, .02, z - dx * .4, x - dz * .4, .02, z + dx * .4, x + dx * 1.5, h, z + dz * 1.5); } } A.end(true);
  for (const [x, z] of [[-31, -19], [-24, -12], [-11, -11], [9, -11], [23, -19], [30, -12]]) { A.crate(x, z, ROOF, .9); A.crate(x + 1.02, z + .12, ROOF, .8); A.jar(x - .9, z + .4, ROOF, 1.1); }
  for (const [x0, z0, x1, z1] of [[-34, -21, -22, -21], [20, -21, 34, -21]]) { for (const x of [x0, x1]) { A.begin('ar_wood'); A.tint(.5, .4, .3); A.rod(x, ROOF, z0, x, ROOF + 3.15, z0, .04, 5); A.end(); k.col(x - .05, x + .05, ROOF, ROOF + 3.15, z0 - .05, z0 + .05, 'wood'); } A.cable(x0, ROOF + 3.1, z0, x1, ROOF + 3.1, z1, .12, { laundry: true }); }
  yield;
  for (const [x, z, y, q] of [[-13, 27.6, L1, 1], [12.6, 14.4, L1, 1], [-57, 46.5, 0, 1.15], [57, 47, 0, 1.08], [-16, 49, 0, .95], [18, 52, 0, 1.1], [-46, 60.4, 3.1, 1.2], [-20, 61, 3.1, 1.3], [8, 60.6, 3.1, 1.15], [42, 61, 3.1, 1.25], [10.8, -34.2, L2, 1], [30.6, 2.9, L2, 1]]) { const zT = z > 55 ? Math.min(63.7, 62.3 + Math.round(noise2(x * .13, 1.7) * 3)) : z; let yT = y; if (z > 55) { yT = 0; for (let a = -3; a <= 3; a += .5) for (let b = -3; b <= 3; b += .5) yT = Math.max(yT, H[Ic(zT + b) * N + Ic(x + a)]); } A.tree(x, zT, yT, q); }
  const northRocks = []; for (let i = 0; i < 12; i++) { const bx = -58 + i * 10.4 + A.rnd(-2, 2), bz = A.rnd(-57, -52.8), bs = A.rnd(.5, 1.2); northRocks.push([bx, bz, bs]); A.boulder(bx, bz, bs, { y: 10.8, sx: A.rnd(1.1, 1.5), tone: A.rnd(.6, .82) }); }
  for (const [x, z, q] of [[-48, -54, 1.1], [-27, -55.5, 1.3], [-6, -53.6, 1], [16, -55, 1.25], [37, -54, 1.05], [55, -55.6, 1.2]]) { /* ramure jamais au-dessus d'un rocher ni du gradin supérieur */ const zT = Math.max(z, -54.6), clear = u => northRocks.every(p => Math.hypot(u - p[0], zT - p[1]) > 3.3 * q + p[2] * 1.6); let xT = x; for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) if (clear(x + d)) { xT = x + d; break; } if (clear(xT)) A.tree(xT, zT, 10.8, q); }
  /* ---------- 15. fond de décor ---------- */
  A.hills(84, 330, 72, 9, (a, r) => { const north = Math.max(0, -Math.sin(a)), t = (r - 84) / 246, base = (16 + 34 * north) * Math.pow(Math.min(1, t * 2.1), .8) * (1 - .32 * Math.max(0, t - .55)), lobes = 1 + .34 * Math.sin(a * 3 + 1.1) + .2 * Math.sin(a * 7 + .4) + .11 * Math.sin(a * 13 + 2); return -1.2 + base * lobes * (.86 + .3 * noise2(Math.cos(a) * r * .018 + 4, Math.sin(a) * r * .018)) + 3.2 * Math.min(1, (r - 84) / 6) * noise2(Math.cos(a) * r * .06, Math.sin(a) * r * .06); },   /* bord intérieur à -1,2 m : la première couronne (r 84) passait jusqu'à 2 m au-dessus du sol dans les coins de la carte (r ≤ 84,85 à l'intérieur des murs), tache pâle sans texture au coin nord-ouest (TEXTURE QA) */
    (a, r, h, o) => { const n = noise2(Math.cos(a) * r * .05 + 9, Math.sin(a) * r * .05), n2 = noise2(Math.cos(a) * r * .17, Math.sin(a) * r * .17), dry = Math.min(1, Math.max(0, h / 42 + n * .55 - .18)); o[0] = (.42 + .3 * dry) * (.8 + .4 * n2); o[1] = (.42 + .19 * dry) * (.8 + .4 * n2); o[2] = (.25 + .16 * dry) * (.8 + .35 * n2); });
  /* ---------- 16. apparitions, objectifs, volumes couverts ---------- */
  for (const p of [[-58, -5], [-54, -5], [-50, -5], [-58, 1], [-54, 1], [-50, 1], [-57, 6], [-51, 6]]) k.spawns.push([p[0], p[1], L2]);
  for (const p of [[58, -5], [54, -5], [50, -5], [58, 1], [54, 1], [50, 1], [57, 6], [51, 6]]) k.spawns.push([p[0], p[1], L2]);
  for (const p of [[-20, -26, L2], [20, -26, L2], [-8, -18, L2], [8, -32, L2], [-17, -6, L2], [17, -6, L2], [-10, 26, L1], [10, 26, L1], [-20, 20, L1], [20, 20, L1], [-20, 35, L1], [20, 37, L1], [8, -30, 0], [-10, -20, 0], [-19, 18, 0], [17.5, 18, 0], [-1.5, 8, 0], [10, 24.7, 0], [-18, 50, 0], [14, 49, 0], [-6, 53, 0]]) k.spawns.push(p);
  for (let c = 0; c < N * N; c++) if (B[c] !== 3) k.floors; /* (les étages sont validés par la nav) */
  k.levelAt = (x, z) => { if (Math.abs(x) >= S || Math.abs(z) >= S) return 0; const c = Ic(z) * N + Ic(x); return B[c] === 5 ? 0 : H[c]; };
  k.objectives = { zones: [[-27, -2.5, L2], [3, 17, L1], [27, -2.5, L2]], sites: [[27, -2.5, L2], [8, 18, L1]] };
  k.covered = [
    { x0: -14, x1: 12, y0: 0, y1: 8.4, z0: -34, z1: -16 }, { x0: -56, x1: 56, y0: 0, y1: 4.8, z0: 23, z1: 26.5 }, { x0: -3, x1: 0, y0: 0, y1: 4.8, z0: -16, z1: 23 },
    { x0: -37, x1: -33.5, y0: 0, y1: 4.8, z0: 26.5, z1: 46 }, { x0: 33, x1: 36.5, y0: 0, y1: 4.8, z0: 26.5, z1: 46 }, { x0: -56, x1: -47, y0: 0, y1: 4.8, z0: 14.5, z1: 23 }, { x0: 47, x1: 56, y0: 0, y1: 4.8, z0: 14.5, z1: 23 }, { x0: -24, x1: -14, y0: 0, y1: 4.8, z0: 14, z1: 23 }, { x0: 14, x1: 21, y0: 0, y1: 4.8, z0: 14, z1: 23 },
    { x0: MK[0], x1: MK[1], y0: L2, y1: L2 + 3.8, z0: MK[2], z1: MK[3] }, ...OPEN.map(h => ({ x0: h.x0, x1: h.x1, y0: h.base, y1: h.base + (h.st ? 5.8 : 3.3), z0: h.z0, z1: h.z1 })),
  ];
  /* murs de limite (anneau |x| ou |z| > 60, dessus ≥ 8 m) : volume de collision de leur dessus jusqu'à 18 m ; on y montait depuis les toits du sud-est (test de sauts escape.mjs) */
  { const lim = k.solids.filter(s => s.y1 < 17.9), topAt = (x, z) => { let t = 0; for (const s of lim) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && s.y1 > t) t = s.y1; return t; };
    for (let zi = -S; zi < S; zi++) { let run = null; const flush = () => { if (run) { k.col(run.x0, run.x1, run.t, 18, zi, zi + 1, 'concrete'); run = null; } };
      for (let xi = -S; xi < S; xi++) { const x = xi + .5, z = zi + .5, t = Math.abs(x) > 60 || Math.abs(z) > 60 ? topAt(x, z) : 0; if (t >= 8 && t < 17.9) { if (run && Math.abs(run.t - t) < .01) run.x1 = xi + 1; else { flush(); run = { x0: xi, x1: xi + 1, t }; } } else flush(); } flush(); } }
  k.shadowProxy = true; for (const q of k.solids) if (A.under((q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2, q.y1)) q.ug = 1;
  const OPENINGS = [[WX, WZ, 17], [-12, 19, 13], [-28, 28.5, 11], [28, 28.5, 11], [-35.25, 41, 13], [34.75, 41, 13], [-35.25, 30, 10], [34.75, 30, 10], [-1.5, -2, 8.5]];
  k.visAt = (x, y, z) => { for (let i = 0; i < OPENINGS.length; i++) { const o = OPENINGS[i], dx = x - o[0], dz = z - o[1]; if (dx * dx + dz * dz < o[2] * o[2]) return 3; } if (Math.abs(x) >= S || Math.abs(z) >= S) return 2; const c = Ic(z) * N + Ic(x); if ((V[c] > 0 && y < V[c]) || H[c] > y + 1.2) return 1; return 2; };
  /* itinéraires des bots : un détour par les souterrains, le rempart ou les toits */
  /* identité des deux moitiés : enduit chaud (ocre) à l'ouest, chaux froide à l'est ; quartier du linge à l'est. Rien ne touche aux collisions. */
  { const rSave = A.r; let sd = 91731; A.r = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }; const used = [], solidAt = c => B[c] === 1 || B[c] === 4 || B[c] === 6, street = c => B[c] === 0 && !CV[c]; let nL = 0;
    const tryLine = (ia, ja, di, dj) => { const c0 = ja * N + ia; if (!solidAt(c0)) return; let e = 1; while (e <= 10) { const q = (ja + dj * e) * N + ia + di * e; if (!street(q)) break; e++; } const run = e - 1; if (run < 4 || run > 9) return; const cE = (ja + dj * e) * N + ia + di * e; if (!solidAt(cE)) return;
      const c1 = (ja + dj) * N + ia + di, fl = H[c1]; for (let q = 1; q < e; q++) if (Math.abs(H[(ja + dj * q) * N + ia + di * q] - fl) > .05) return; if (TOP[c0] < fl + 4.6 || TOP[cE] < fl + 4.6) return;
      const xa = X(ia) + di * G / 2, za = X(ja) + dj * G / 2, xb = X(ia + di * e) - di * G / 2, zb = X(ja + dj * e) - dj * G / 2, mx = (xa + xb) / 2, mz = (za + zb) / 2; if (used.some(u => Math.hypot(u[0] - mx, u[1] - mz) < 9)) return;
      const y = fl + 3.5 + A.r() * .35; A.cable(xa + di * .04, y, za + dj * .04, xb - di * .04, y + .08, zb - dj * .04, .16, { laundry: true }); used.push([mx, mz]); nL++; };
    for (let j = 6; j < N - 6 && nL < 8; j += 2) for (let i = Math.floor((12 + S) / G); i < N - 12 && nL < 8; i++) { tryLine(i, j, 1, 0); if (nL < 8) tryLine(i, j, 0, 1); }
    k.stats_laundryE = nL; A.r = rSave; }
  A.recolor = (m, x) => { if (m !== 'ar_plaster') return null; const t = clamp(x / 16, -1, 1); return t > 0 ? [1 - .08 * t, 1 - .015 * t, 1 + .06 * t] : [1 - .02 * t, 1 + .01 * t, 1 + .1 * t]; };
  k.lanes = [[0, 24.7, 0], [8, -30, 0], [-19, 18, 0], [17.5, 18, 0], [-1, -46, 12], [-9, -10, ROOF]]; k.stats = { tris: A.tris, pieces: A.pieces };
  lastLayout = Object.assign(Object.create(Object.getPrototypeOf(k)), k, { ops: [] });
  return k;
}

export const RELIEF_ENV = {
  hillside: { as: 'desert', gt: 'desert', sky: [[0, '#2f6fa8'], [.3, '#6ea6d0'], [.45, '#c3d8e0'], [.5, '#efe3c8'], [.53, '#a98f68'], [1, '#6a5840']], halo: '255,236,196', clouds: 120, cloudDark: '130,140,150', cloudLight: '255,252,244', sun: [46, 40, 27], sunCol: 0xffe4bc, sunI: 3.2, hemi: [0xd6d4c8, 0x9c8460, .66], fog: [0xd4cdbb, .0034], exp: .53, envI: .5, ground: '#a89a7c', gsurf: 'concrete', part: { n: 90, col: 0xe8dcc0, size: .03, op: .3, mode: 'dust' } },
};

/** Branche la carte sur maps.js (import dynamique depuis main.js : un échec ne touche pas les autres cartes). list=false : tests sans entrée de menu. */
export function install(M, list = true) {
  M.registerMap({ id: 'roqueseche', build: () => buildRoqueseche(M.Kit), steps: () => roquesecheSteps(M.Kit), env: RELIEF_ENV, mats: archMaterial, meta: list ? { id: 'roqueseche', name: 'Roquesèche', desc: 'Village en terrasses sur une rivière à sec : ruelles, marché couvert, toits et rempart, citernes et égouts reliés.', env: 'hillside' } : null });
}
