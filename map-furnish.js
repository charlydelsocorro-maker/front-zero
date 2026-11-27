// FRONT ZÉRO — [meubles] meubles et débris dans les pièces vides de toutes les cartes.
// Où : map-furnish-plan.js (pièces lues dans les collisions, mêmes tirages partout). Ici : les formes et le rendu.
// Rendu : aucun matériau ni programme de shader nouveau. Chaque pièce de meuble prend un matériau déjà dessiné par la carte (lots `batch-*` :
// bois, toile, peinture, fer, plâtre) ; la teinte par meuble et l'ombre au pied sont cuites dans les couleurs de sommets (matériaux
// `vertexColors`). Géométrie fusionnée par matériau et par carré de 14 m ; un carré n'est dessiné qu'à moins de 36 m de la caméra
// (tri toutes les 8 images, comme map-vehicles.js). Aucune ombre portée (le soleil n'entre pas dans les pièces).
// Collisions : une à trois boîtes par meuble, ajoutées à world.solids avant la grille et la navigation (balles, joueurs, bots).
import * as THREE from 'three';
import { buildLayout } from './maps.js';
import { planFurnitureSteps, CAT } from './map-furnish-plan.js';

const CHUNK = 16, SHOW = 32, HYST = 3;
/* cartes regardées à hauteur d'yeux (planches dans .handoff/meubles/) ; les autres restent vides jusqu'à leur contrôle */
const ON = new Set(['vieille-ville', 'marais', 'depot', 'port', 'cite', 'valferrade', 'roqueseche', 'barrage', 'bunker', 'col-blanc', 'noirval', 'sept-vents', 'val-cendre']);
/* matériau de chaque rôle : le premier lot présent sur la carte ; peu de matériaux par carré = peu d'appels de dessin
   (classiques : wood, woodD, pal ; kit : ar_wood, ar_cloth, ar_plant, ar_iron) */
const PREF = {
  W: ['ar_wood', 'wood', 'woodD', 'crate', 'door', 'ar_plank'],
  D: ['ar_wood', 'woodD', 'wood', 'door', 'crate', 'ar_plank'],
  K: ['ar_wood', 'woodD', 'wood', 'ar_plank', 'crate'],
  C: ['ar_cloth', 'pal', 'ar_plant', 'ar_hill', 'tarp', 'ar_plaster', 'plaster'],
  B: ['ar_cloth', 'pal', 'ar_plant', 'ar_plaster', 'plaster', 'tarp'],
  P: ['pal', 'ar_plant', 'ar_hill', 'ar_cloth', 'paint', 'ar_iron', 'steel', 'plaster'],
  M: ['ar_iron', 'pal', 'ar_plant', 'steel', 'rust', 'plate'],
  X: ['ar_cloth', 'ar_plaster', 'pal', 'ar_plant', 'plaster', 'plasterB', 'plasterO'],
  S: ['ar_cloth', 'pal', 'ar_plant', 'ar_plaster', 'plaster', 'plasterB', 'plasterO', 'conc', 'stone'],
};
/* sans matériau à couleurs de sommets (Val Cendre) : pas de teinte possible ; plâtres et bois texturés plutôt qu'une toile verte partout */
const PREF_NOVC = {
  C: ['plasterB', 'plaster', 'plasterO', 'tarp'], B: ['plasterO', 'plasterB', 'tarp'], P: ['woodD', 'wood', 'crate'], X: ['plasterB', 'plaster', 'plasterO'], S: ['plasterB', 'plaster', 'plasterO', 'conc'],
};
const TILE = { W: 1.3, D: 1.3, K: 1.1, C: .8, B: 1.1, P: 1, M: 1, X: .45, S: 1.1 };
const col = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const PAL = {
  cloth: [0x7d3a32, 0x3f5a6e, 0x5c6a3e, 0x8a6a3a, 0x6b4e5e, 0x4e4a44, 0x8c7c62, 0x2f4652].map(col),
  sheet: [0xd8d2c4, 0xcfc8b4, 0xc4ccd0, 0xd6ccb8].map(col),
  paint: [0x5b6650, 0x4f5f6c, 0x6e6a5e, 0x707a72, 0x5a5048, 0x3e4a3c].map(col),
  metal: [0x5e6266, 0x6a6c68, 0x50565a, 0x726c62].map(col),
  book: [0x7a2e26, 0x2e4a6a, 0x3f5a36, 0x8a6a2a, 0x5a3a52, 0x2a2a2a, 0x9a8a6a, 0x6a3a1e, 0x34505a].map(col),
  box: [0x9a7a52, 0x8c6e48, 0xa48660, 0x7e6444].map(col),
  paper: [0xb8b2a2, 0xaaa290, 0xc0baa8, 0x9e9580].map(col),
  burlap: [0x8a7656, 0x7e6a4c, 0x947f5c, 0x6f5e44].map(col), dark: col(0x1c1a18), iron: col(0x2a2a2c), brass: col(0x8a7038), glassG: col(0x1e3a30), screen: col(0x22382c), white: col(0xd8d4ca),
  plaster: [0xd8ccb4, 0xc9bca2, 0xe0d6c2].map(col), jar: [0x6a7a5a, 0x8a5a3a, 0x5a6a7a, 0xb0a070].map(col),
};
const pick = (a, r) => a[Math.floor(r * a.length) % a.length];

/* ---------- émetteur : polygones convexes, transformés, rangés par matériau dans le carré du meuble ---------- */
function emitter() {
  const e = { M: null, st: [], sinks: null, mats: null, base: 0, uo: 0, vo: 0, tris: 0, wood: 'W' };
  const mul = (A, B2) => { const R = new Array(12); for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) R[i * 4 + j] = A[i * 4] * B2[j] + A[i * 4 + 1] * B2[4 + j] + A[i * 4 + 2] * B2[8 + j]; R[i * 4 + 3] = A[i * 4] * B2[3] + A[i * 4 + 1] * B2[7] + A[i * 4 + 2] * B2[11] + A[i * 4 + 3]; } return R; };
  const rot = (tx, ty, tz, ry, rx, rz) => { const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
    const Y = [cy, 0, sy, 0, 0, 1, 0, 0, -sy, 0, cy, 0], X = [1, 0, 0, 0, 0, cx, -sx, 0, 0, sx, cx, 0], Z = [cz, -sz, 0, 0, sz, cz, 0, 0, 0, 0, 1, 0]; const R = mul(mul(Y, X), Z); R[3] = tx; R[7] = ty; R[11] = tz; return R; };
  e.frame = (x, y, z, th) => { e.M = rot(x, y, z, th, 0, 0); e.st.length = 0; e.base = y; };
  e.push = (tx, ty, tz, ry = 0, rx = 0, rz = 0) => { e.st.push(e.M); e.M = mul(e.M, rot(tx, ty, tz, ry, rx, rz)); };
  e.pop = () => { e.M = e.st.pop(); };
  /* pts : points locaux d'une face plane convexe ; ctr : centre du volume (la normale part de lui) */
  e.poly = (pts, ctr, role, c) => {
    const key = e.mats[role]; if (!key) return; const S = e.sinks(key), M = e.M, n = pts.length;
    let ax = pts[1][0] - pts[0][0], ay = pts[1][1] - pts[0][1], az = pts[1][2] - pts[0][2], bx = pts[2][0] - pts[0][0], by = pts[2][1] - pts[0][1], bz = pts[2][2] - pts[0][2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; let l = Math.hypot(nx, ny, nz);
    if (l < 1e-9 && n > 3) { bx = pts[3][0] - pts[0][0]; by = pts[3][1] - pts[0][1]; bz = pts[3][2] - pts[0][2]; nx = ay * bz - az * by; ny = az * bx - ax * bz; nz = ax * by - ay * bx; l = Math.hypot(nx, ny, nz); }
    if (l < 1e-9) return; nx /= l; ny /= l; nz /= l;
    let mx = 0, my = 0, mz = 0; for (const p of pts) { mx += p[0] / n; my += p[1] / n; mz += p[2] / n; }
    const flip = (mx - ctr[0]) * nx + (my - ctr[1]) * ny + (mz - ctr[2]) * nz < 0; if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    const wnx = M[0] * nx + M[1] * ny + M[2] * nz, wny = M[4] * nx + M[5] * ny + M[6] * nz, wnz = M[8] * nx + M[9] * ny + M[10] * nz;
    const ab = [Math.abs(nx), Math.abs(ny), Math.abs(nz)], t = 1 / (TILE[role] || 1), up = ab[1] >= ab[0] && ab[1] >= ab[2] ? 1 : ab[0] >= ab[2] ? 0 : 2;
    const shade = wny < -.5 ? .55 : wny > .5 ? 1.04 : .9;
    const W = [];
    let swap = false; if (role === 'W' || role === 'D' || role === 'K') { let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const p of pts) { const u = up === 1 ? p[0] : up === 0 ? p[2] : p[0], v = up === 1 ? p[2] : p[1]; a0 = Math.min(a0, u); a1 = Math.max(a1, u); b0 = Math.min(b0, v); b1 = Math.max(b1, v); } swap = b1 - b0 > (a1 - a0) * 1.05; }
    for (const p of pts) {
      const x = M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3], y = M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7], z = M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11];
      let u, v; if (up === 1) { u = p[0]; v = p[2]; } else if (up === 0) { u = p[2]; v = p[1]; } else { u = p[0]; v = p[1]; } if (swap) { const q2 = u; u = v; v = q2; }
      const yr = y - e.base, ao = (.6 + .4 * Math.min(1, Math.max(0, yr / .55))) * shade;
      W.push([x, y, z, u * t + e.uo, v * t + e.vo, c[0] * ao, c[1] * ao, c[2] * ao]);
    }
    for (let i = 1; i + 1 < n; i++) {
      const tri = flip ? [W[0], W[i + 1], W[i]] : [W[0], W[i], W[i + 1]];
      for (const q of tri) { S.p.push(q[0], q[1], q[2]); S.n.push(wnx, wny, wnz); S.u.push(q[3], q[4]); S.c.push(q[5], q[6], q[7]); }
      e.tris++;
    }
  };
  /* boîte, chanfreinée si bev > 0 ; sans dessous par défaut (posée) */
  /* mask (boîte simple) : 1 dessus, 2 dos (-z), 4 avant (+z), 8 gauche (-x), 16 droite (+x), 32 dessous */
  e.box = (x0, x1, y0, y1, z0, z1, role, c, bev = 0, bottom = false, mask = 31) => {
    const C = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const b = Math.min(bev, (x1 - x0) / 2.2, (y1 - y0) / 2.2, (z1 - z0) / 2.2);
    if (b <= .002) {
      const P = (i, j, k) => [i ? x1 : x0, j ? y1 : y0, k ? z1 : z0];
      if (mask & 1) e.poly([P(0, 1, 0), P(1, 1, 0), P(1, 1, 1), P(0, 1, 1)], C, role, c);
      if (mask & 2) e.poly([P(0, 0, 0), P(1, 0, 0), P(1, 1, 0), P(0, 1, 0)], C, role, c); if (mask & 4) e.poly([P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)], C, role, c);
      if (mask & 8) e.poly([P(0, 0, 0), P(0, 0, 1), P(0, 1, 1), P(0, 1, 0)], C, role, c); if (mask & 16) e.poly([P(1, 0, 0), P(1, 0, 1), P(1, 1, 1), P(1, 1, 0)], C, role, c);
      if (bottom || (mask & 32)) e.poly([P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(0, 0, 1)], C, role, c);
      return;
    }
    const lo = [x0, y0, z0], hi = [x1, y1, z1];
    /* posée (sans dessous) : pas de chanfrein en bas, les faces descendent jusqu'au sol (aucune fente au pied) */
    const pt = (s, a, inA, inB) => { const p = [0, 0, 0]; for (let k = 0; k < 3; k++) { const v = s[k] > 0 ? hi[k] : lo[k], inn = (k === inA || k === inB) && !(k === 1 && s[1] < 0 && !bottom) ? b * -s[k] : 0; p[k] = v + inn; } return p; };
    /* faces principales */
    for (let ax = 0; ax < 3; ax++) for (const sg of [-1, 1]) {
      if (ax === 1 && sg < 0 && !bottom) continue; const o1 = (ax + 1) % 3, o2 = (ax + 2) % 3, q = [];
      for (const [a1, a2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const s = [0, 0, 0]; s[ax] = sg; s[o1] = a1; s[o2] = a2; q.push(pt(s, o1, o2)); }
      e.poly(q, C, role, c);
    }
    /* arêtes */
    for (let k = 0; k < 3; k++) { const a1 = (k + 1) % 3, a2 = (k + 2) % 3; for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      const sA = [0, 0, 0], sB = [0, 0, 0]; sA[a1] = s1; sA[a2] = s2; sA[k] = -1; sB[a1] = s1; sB[a2] = s2; sB[k] = 1;
      if (k !== 1 && (a1 === 1 ? s1 : s2) < 0 && !bottom) continue;
      e.poly([pt(sA, a1, k), pt(sB, a1, k), pt(sB, a2, k), pt(sA, a2, k)], C, role, c);
    } }
    /* coins */
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { if (sy < 0 && !bottom) continue; const s = [sx, sy, sz]; e.poly([pt(s, 1, 2), pt(s, 0, 2), pt(s, 0, 1)], C, role, c); }
  };
  /* cylindre vertical (r0 en bas, r1 en haut) */
  e.cyl = (x, z, r0, y0, y1, n, role, c, r1 = r0, top = true, bottom = false) => {
    const C = [x, (y0 + y1) / 2, z], P0 = [], P1 = [];
    for (let i = 0; i < n; i++) { const a = (i + .5) / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); P0.push([x + ca * r0, y0, z + sa * r0]); P1.push([x + ca * r1, y1, z + sa * r1]); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; e.poly([P0[i], P0[j], P1[j], P1[i]], C, role, c); }
    if (top) e.poly(P1.slice(), C, role, c); if (bottom) e.poly(P0.slice(), C, role, c);
  };
  return e;
}

/* ---------- modèles : x local le long du mur, z = 0 au dos, avant vers +z ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const tintW = r => { const k = .82 + r * .36; return [k * (1.02 + r * .05), k, k * (.94 - r * .08)]; };
function legs4(e, x0, x1, z0, z1, h, t, role, c) { for (const x of [x0, x1 - t]) for (const z of [z0, z1 - t]) e.box(x, x + t, 0, h, z, z + t, role, c); }
function books(e, x0, x1, y, dz, rr, gaps = .25) {
  let x = x0; while (x < x1 - .03) { const r = rr(), w = .032 + r * .04, h = .17 + rr() * .1, d = dz * (.75 + rr() * .25); if (rr() < gaps) { x += w * 1.5; continue; } if (x + w > x1) break; const lean = rr() < .12 && x + h < x1;
    if (lean) { e.push(x + .01, y, 0, 0, 0, -1.1); e.box(0, h, 0, w, .01, .01 + d, 'P', pick(PAL.book, rr()), 0, false, 13); e.pop(); x += h * .5 + w; continue; }
    e.box(x, x + w, y, y + h, .01, .01 + d, 'P', pick(PAL.book, r), 0, false, 13); x += w + .002; }
}
const M = {
  bed(e, it, r, w = 1.0) {
    const hw = w / 2, wd = tintW(r()), cl = pick(PAL.cloth, r()), sh = pick(PAL.sheet, r()), broken = it.v === 1;
    e.box(-hw, -hw + .07, 0, 1.0, 0, .07, e.wood, wd, .012); e.box(hw - .07, hw, 0, 1.0, 0, .07, e.wood, wd, .012);
    e.box(-hw + .07, hw - .07, .38, .9, .015, .055, e.wood, wd, .01); e.box(-hw + .07, hw - .07, .9, .96, .01, .06, e.wood, wd, .008);
    const fy = broken ? .3 : .62; e.box(-hw, -hw + .07, 0, fy, 1.93, 2.0, e.wood, wd, .012); e.box(hw - .07, hw, 0, fy, 1.93, 2.0, e.wood, wd, .012);
    if (!broken) e.box(-hw + .07, hw - .07, .3, .56, 1.945, 1.985, e.wood, wd, .01);
    e.box(-hw, -hw + .05, .22, .36, .07, 1.93, e.wood, wd); e.box(hw - .05, hw, .22, .36, .07, 1.93, e.wood, wd);
    e.push(0, broken ? .3 : .36, .08, 0, broken ? .09 : 0, 0);
    e.box(-hw + .04, hw - .04, 0, .18, 0, 1.84, 'C', sh, .05);
    e.box(-hw + .02, hw - .02, .1, .23, .62, 1.87, 'C', cl, .04);
    e.box(-hw + .005, -hw + .025, -.08, .2, .66, 1.83, 'C', cl); e.box(hw - .025, hw - .005, -.08, .2, .66, 1.83, 'C', cl);
    if (w > 1.2) { e.box(-hw + .1, -.04, .17, .28, .06, .4, 'C', PAL.white, .05); e.box(.04, hw - .1, .17, .28, .06, .4, 'C', PAL.white, .05); }
    else e.push(0, 0, 0, broken ? .3 : 0, 0, 0), e.box(-hw + .12, hw - .12, .17, .28, .06, .4, 'C', PAL.white, .05), e.pop();
    e.pop();
  },
  bed2(e, it, r) { M.bed(e, it, r, 1.45); },
  wardrobe(e, it, r) {
    const wd = tintW(r()), w = 1.1, hw = w / 2, d = .58, open = it.v === 1;
    e.box(-hw + .03, hw - .03, 0, .08, .03, d - .04, e.wood, [wd[0] * .7, wd[1] * .7, wd[2] * .7]);
    e.box(-hw + .01, -hw + .04, .08, 1.86, 0, d - .02, e.wood, wd, .006); e.box(hw - .04, hw - .01, .08, 1.86, 0, d - .02, e.wood, wd, .006);
    e.box(-hw + .04, hw - .04, .08, 1.86, 0, .03, e.wood, wd); e.box(-hw + .04, hw - .04, .08, .11, .03, d - .03, e.wood, wd);
    e.box(-hw, hw, 1.86, 1.96, 0, d, e.wood, wd, .02);
    e.box(-hw + .04, hw - .04, 1.5, 1.52, .03, d - .04, e.wood, wd);
    const dc = [wd[0] * .9, wd[1] * .88, wd[2] * .86];
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -hw + .04 : .005, x1 = s < 0 ? -.005 : hw - .04;
      if (open && s > 0) { for (let i = 0; i < 3; i++) e.box(-.0 + .05 + i * .16, .05 + i * .16 + .12, .7, 1.45 - i * .1, .1, .48, 'C', pick(PAL.cloth, r())); e.box(.03, hw - .06, 1.44, 1.46, .25, .27, 'M', PAL.iron); continue; }
      e.box(x0, x1, .13, 1.83, d - .03, d - .005, e.wood, dc, .006);
      e.box(x0 + .06, x1 - .06, .25, 1.0, d - .005, d, e.wood, dc); e.box(x0 + .06, x1 - .06, 1.1, 1.72, d - .005, d, e.wood, dc);
      e.box(s < 0 ? x1 - .04 : x0 + .025, s < 0 ? x1 - .025 : x0 + .04, .9, 1.06, d, d + .0, 'M', PAL.brass, 0, false, 29);
    }
    if (open) e.box(-hw + .04, -.005, .13, 1.83, d - .03, d - .005, e.wood, dc, .006);
  },
  dresser(e, it, r) {
    const wd = tintW(r()), hw = .5, d = .5, missing = it.v === 1;
    legs4(e, -hw + .02, hw - .02, .03, d - .02, .07, .05, e.wood, wd);
    e.box(-hw + .02, hw - .02, .07, .82, 0, d - .03, e.wood, wd, .008); e.box(-hw, hw, .82, .86, 0, d, e.wood, wd, .012);
    for (let i = 0; i < 3; i++) { const y0 = .11 + i * .235, y1 = y0 + .21; if (missing && i === 2) { e.box(-hw + .05, hw - .05, y0, y1, d - .032, d - .028, 'P', PAL.dark); continue; }
      e.box(-hw + .05, hw - .05, y0, y1, d - .03, d - .01, e.wood, [wd[0] * .92, wd[1] * .9, wd[2] * .88], .006);
      for (const x of [-.22, .22]) e.box(x - .03, x + .03, (y0 + y1) / 2 - .012, (y0 + y1) / 2 + .012, d - .01, d + .0, 'M', PAL.brass, 0, false, 29); }
    M.topStuff(e, r, -hw + .08, hw - .08, .86, .06, d - .08, missing);
  },
  topStuff(e, r, x0, x1, y, z0, z1, fallen) {
    const n = 2 + Math.floor(r() * 2); let x = x0;
    for (let i = 0; i < n && x < x1 - .1; i++) { const k = r(), z = lerp(z0, z1, .3 + r() * .4);
      if (k < .25) { e.cyl(x + .06, z, .06, y, y + .02, 6, 'M', PAL.brass, .06, false); e.cyl(x + .06, z, .012, y + .02, y + .3, 4, 'M', PAL.brass, .012, false); if (fallen) { e.push(x + .06, y + .05, z, 0, 0, 1.4); e.cyl(0, 0, .11, -.05, .09, 8, 'C', PAL.sheet[0], .06); e.pop(); } else e.cyl(x + .06, z, .12, y + .24, y + .38, 8, 'C', pick(PAL.sheet, r()), .07); x += .2; }
      else if (k < .5) { e.cyl(x + .05, z, .045, y, y + .13 + r() * .1, 7, 'P', pick(PAL.jar, r()), .035); x += .13; }
      else if (k < .75) { e.push(x + .08, y, z, r() - .5, 0, 0); e.box(-.08, .08, 0, .02, -.11, .11, 'X', pick(PAL.paper, r())); e.box(-.075, .075, .02, .05, -.1, .1, 'P', pick(PAL.book, r())); e.pop(); x += .2; }
      else { e.push(x + .07, y, z1 - .04, r() * .3 - .15, -.22, 0); e.box(-.07, .07, 0, .18, -.01, .01, e.wood, [.5, .4, .3]); e.box(-.055, .055, .02, .16, .01, .012, 'X', pick(PAL.paper, r())); e.pop(); x += .17; }
      x += .03; }
  },
  night(e, it, r) {
    const wd = tintW(r()), hw = .23, d = .4;
    legs4(e, -hw, hw, .0, d, .12, .04, e.wood, wd);
    e.box(-hw, hw, .12, .52, 0, d - .02, e.wood, wd, .006); e.box(-hw - .0, hw, .52, .56, 0, d, e.wood, wd, .01);
    e.box(-hw + .03, hw - .03, .38, .5, d - .02, d - .005, e.wood, [wd[0] * .9, wd[1] * .88, wd[2] * .86], .005); e.box(-.02, .02, .43, .45, d - .005, d, 'M', PAL.brass, 0, false, 29);
    e.cyl(0, .18, .035, .56, .62, 7, 'P', PAL.white); if (r() < .6) e.cyl(0, .18, .012, .62, .7, 5, 'X', PAL.paper[0]);
  },
  shelf(e, it, r) {
    const wd = tintW(r()), hw = .46, d = .32, few = it.v === 1;
    e.box(-hw, -hw + .025, 0, 1.82, 0, d, e.wood, wd, 0, false, 29); e.box(hw - .025, hw, 0, 1.82, 0, d, e.wood, wd, 0, false, 29);
    e.box(-hw + .025, hw - .025, 0, 1.82, 0, .012, e.wood, [wd[0] * .7, wd[1] * .68, wd[2] * .66]);
    e.box(-hw - .01, hw + .01, 1.79, 1.82, 0, d, e.wood, wd, .008);
    const ys = [.06, .48, .9, 1.32]; for (const y of ys) e.box(-hw + .025, hw - .025, y - .025, y, .012, d - .005, e.wood, wd, 0, false, 5);
    e.box(-hw + .025, hw - .025, 0, .035, d - .03, d - .005, e.wood, wd);
    ys.forEach((y, i) => { if (few && r() < .5) { if (r() < .5) for (let k = 0; k < 2; k++) { e.push(-.2 + r() * .3, y + k * .035, .05, r() * .6 - .3); e.box(0, .2, 0, .035, 0, .15, 'P', pick(PAL.book, r())); e.pop(); } return; }
      if (i === 3 && r() < .5) { e.cyl(-.25, .16, .05, y, y + .16, 7, 'P', pick(PAL.jar, r()), .04); e.cyl(-.1, .16, .045, y, y + .12, 7, 'P', pick(PAL.jar, r()), .04); e.box(.05, .38, y, y + .14, .04, .27, 'P', pick(PAL.box, r()), .01); return; }
      books(e, -hw + .03, hw - .03, y, d - .07, r, few ? .5 : .36); });
  },
  shelfDown(e, it, r) {
    const wd = tintW(r()), dk = [wd[0] * .72, wd[1] * .7, wd[2] * .68];
    /* tombée face contre le sol : on voit son dos (panneau), ses côtés et quelques livres qui dépassent dessous */
    e.push(0, 0, .02, (r() - .5) * .08);
    e.box(-.92, .92, .3, .325, 0, .32, e.wood, dk, 0, false, 31); e.box(-.92, .92, 0, .325, -.0, .025, e.wood, wd, .004); e.box(-.92, .92, 0, .325, .295, .32, e.wood, wd, .004);
    e.box(-.92, -.895, 0, .3, .025, .295, e.wood, wd, 0, false, 9); e.box(.895, .92, 0, .3, .025, .295, e.wood, wd, 0, false, 17);
    e.pop();
    for (let i = 0; i < 6; i++) { const x = -.8 + r() * 1.6, z = .38 + r() * .2; e.push(x, 0, z, r() * 3); e.box(-.1, .1, 0, .035, -.07, .07, 'P', pick(PAL.book, r()), .004); e.pop(); }
    for (let i = 0; i < 3; i++) { e.push(-.6 + r() * 1.2, .0, .33, (r() - .5) * .5, 0, .25); e.box(-.1, .1, 0, .03, -.06, .07, 'P', pick(PAL.book, r())); e.pop(); }
  },
  sofa(e, it, r) {
    const c = pick(PAL.cloth, r()), cd = [c[0] * .8, c[1] * .8, c[2] * .8], hw = .93, torn = it.v === 1;
    for (const x of [-hw + .06, hw - .1]) for (const z of [.06, .74]) e.box(x, x + .04, 0, .08, z, z + .04, e.wood, [.45, .35, .28]);
    e.box(-hw + .02, hw - .02, .08, .38, .02, .84, 'C', cd, .04);
    e.box(-hw, -hw + .17, .08, .64, .02, .86, 'C', c, .06); e.box(hw - .17, hw, .08, .64, .02, .86, 'C', c, .06);
    e.box(-hw + .15, hw - .15, .36, .84, 0, .24, 'C', c, .07);
    const cw = (2 * hw - .34) / 2;
    for (let i = 0; i < 2; i++) { const x0 = -hw + .17 + i * cw; if (torn && i === 1) { e.push(x0 + cw / 2, .38, .52, .5, 0, .25); e.box(-cw / 2 + .02, cw / 2 - .02, 0, .13, -.28, .28, 'C', c, .05); e.pop(); continue; } e.box(x0 + .005, x0 + cw - .005, .38, .52, .22, .84, 'C', c, .055); }
    if (r() < .5) { e.push(-hw + .45, .52, .3, .2, -.5, 0); e.box(-.17, .17, 0, .11, -.17, .17, 'C', pick(PAL.cloth, r()), .05); e.pop(); }
  },
  cupboard(e, it, r) {
    const wd = tintW(r()), hw = .6, d = .6, gone = it.v === 1;
    e.box(-hw + .04, hw - .04, 0, .1, .02, d - .06, 'P', PAL.dark);
    e.box(-hw, hw, .1, .88, 0, d - .03, e.wood, wd, .006);
    e.box(-hw - .0, hw, .88, .92, 0, d, e.wood, [wd[0] * .8, wd[1] * .78, wd[2] * .76], .012);
    const dc = [wd[0] * .9, wd[1] * .88, wd[2] * .86];
    for (const s of [-1, 1]) { const x0 = s < 0 ? -hw + .03 : .005, x1 = s < 0 ? -.005 : hw - .03;
      e.box(x0, x1, .7, .85, d - .03, d - .01, e.wood, dc, .005); e.box((x0 + x1) / 2 - .04, (x0 + x1) / 2 + .04, .76, .78, d - .01, d, 'M', PAL.brass, 0, false, 29);
      if (gone && s > 0) { e.box(x0, x1, .13, .67, d - .033, d - .029, 'P', PAL.dark); e.cyl((x0 + x1) / 2, d - .2, .1, .13, .15, 8, 'X', PAL.white); continue; }
      e.box(x0, x1, .13, .67, d - .03, d - .01, e.wood, dc, .005); e.box(x0 + .05, x1 - .05, .2, .6, d - .01, d - .002, e.wood, dc); }
    M.topStuff(e, r, -hw + .08, hw - .08, .92, .08, d - .1, false);
  },
  stove(e, it, r) {
    const c = PAL.iron, hw = .43, d = .64;
    for (const x of [-hw + .03, hw - .07]) for (const z of [.05, d - .08]) e.cyl(x + .02, z + .02, .025, 0, .14, 6, 'M', c, .02);
    e.box(-hw, hw, .14, .8, .02, d - .02, 'M', c, .015); e.box(-hw - .0, hw, .8, .86, 0, d, 'M', [c[0] * 1.3, c[1] * 1.3, c[2] * 1.3], .01);
    e.box(-hw + .06, .1, .24, .66, d - .02, d - .005, 'M', [c[0] * 1.5, c[1] * 1.5, c[2] * 1.5], .01);
    e.push(-.16, .6, d + .01, 0, 0, Math.PI / 2); e.cyl(0, 0, .012, -.12, .12, 5, 'M', PAL.brass); e.pop();
    e.box(.16, .38, .5, .66, d - .02, d - .005, 'M', [c[0] * 1.5, c[1] * 1.5, c[2] * 1.5], .008);
    for (const x of [-.2, .16]) e.cyl(x, .38, .11, .86, .875, 10, 'M', [.12, .12, .12]);
    e.cyl(.22, .1, .065, .86, 1.5, 8, 'M', c, .065, false); e.push(.22, 1.5, .1, 0, Math.PI / 2, 0); e.cyl(0, 0, .065, -.1, .0, 8, 'M', c); e.pop();
    if (r() < .7) { e.cyl(-.2, .38, .1, .875, .99, 9, 'M', [.28, .28, .3], .095); }
  },
  desk(e, it, r) {
    const wd = tintW(r()), hw = .65, d = .7;
    e.box(-hw, hw, .74, .78, 0, d, e.wood, wd, .012);
    e.box(.22, hw - .02, 0, .74, .02, d - .03, e.wood, wd, .006);
    for (let i = 0; i < 3; i++) { const y0 = .06 + i * .225; e.box(.25, hw - .05, y0, y0 + .2, d - .03, d - .01, e.wood, [wd[0] * .9, wd[1] * .88, wd[2] * .86], .005); e.box(.4, .48, y0 + .09, y0 + .11, d - .01, d, 'M', PAL.brass, 0, false, 29); }
    e.box(-hw + .02, -hw + .07, 0, .74, .04, .09, e.wood, wd); e.box(-hw + .02, -hw + .07, 0, .74, d - .09, d - .04, e.wood, wd);
    e.box(-hw + .02, .22, .4, .72, .02, .04, e.wood, [wd[0] * .8, wd[1] * .78, wd[2] * .76]);
    const n = 3 + Math.floor(r() * 4); for (let i = 0; i < n; i++) { e.push(-.45 + r() * .7, .78 + i * .002, .2 + r() * .35, r() * .8 - .4); e.box(-.105, .105, 0, .002, -.148, .148, 'X', pick(PAL.paper, r()), 0, false, 1); e.pop(); }
    if (r() < .55) { e.push(.15, .78, .3, r() * .3 - .15); e.box(-.17, .17, 0, .09, -.14, .12, 'M', pick(PAL.metal, r()), .015); e.push(0, .09, -.06, 0, -.6, 0); e.box(-.15, .15, 0, .04, -.03, .07, 'M', PAL.dark); e.pop(); e.cyl(-.18, -.08, .018, .09, .16, 6, 'M', PAL.dark); e.cyl(.18, -.08, .018, .09, .16, 6, 'M', PAL.dark); e.pop(); }
    else { e.cyl(.42, .15, .07, .78, .8, 8, 'M', PAL.iron); e.push(.42, .8, .15, 0, .5, 0); e.cyl(0, 0, .012, 0, .3, 5, 'M', PAL.iron); e.pop(); e.push(.42, 1.04, .3, 0, 1.2, 0); e.cyl(0, 0, .03, -.04, .08, 8, 'M', pick(PAL.paint, r()), .08); e.pop(); }
    e.cyl(-.5, .5, .04, .78, .87, 7, 'P', pick(PAL.jar, r()));
  },
  chest(e, it, r) {
    const wd = tintW(r()), hw = .45, d = .5, cK = [wd[0] * .85, wd[1] * .8, wd[2] * .75];
    e.box(-hw, hw, 0, .36, 0, d, 'K', cK, .015);
    e.box(-hw, hw, .36, .46, 0, d, 'K', cK, .015); e.box(-hw + .01, hw - .01, .46, .54, .04, d - .04, 'K', cK, .03);
    for (const x of [-.32, .29]) { e.box(x, x + .03, 0, .5, -.002, .004, 'M', PAL.iron); e.box(x, x + .03, 0, .5, d - .004, d + .002, 'M', PAL.iron); e.box(x, x + .03, .5, .545, .03, d - .03, 'M', PAL.iron); }
    e.box(-.05, .05, .28, .4, d, d + .012, 'M', PAL.brass, 0, false, 29);
    if (it.v === 1) { e.cyl(.2, .25, .07, .54, .56, 8, 'M', PAL.iron); e.cyl(.2, .25, .05, .56, .78, 8, 'X', [.8, .7, .45], .05); e.box(.13, .27, .78, .8, .18, .32, 'M', PAL.iron); }
  },
  crates(e, it, r) {
    const c1 = tintW(r()), fall = it.v === 1;
    e.box(-.48, .26, 0, .62, .02, .78, 'K', c1, .015);
    e.push(-.12, .62, .4, r() * .3 - .15); e.box(-.3, .3, 0, .5, -.3, .3, 'K', tintW(r()), .015); e.pop();
    if (fall) { e.push(.36, 0, .45, 0, 0, .35); e.box(-.13, .13, 0, .3, -.18, .18, 'K', tintW(r()), .012); e.pop(); }
    else { e.box(.3, .5, 0, .28, .1, .5, 'K', tintW(r()), .012); e.push(-.1, 1.12, .4, r() * .5); e.box(-.16, .16, 0, .14, -.11, .11, 'P', pick(PAL.box, r()), .008); e.pop(); }
  },
  rack(e, it, r) {
    const c = pick(PAL.metal, r()), hw = 1.0, d = .56;
    for (const x of [-hw, hw - .04]) for (const z of [0, d - .04]) e.box(x, x + .04, 0, 2.0, z, z + .04, 'M', c);
    const ys = [.12, .62, 1.12, 1.62, 1.98];
    for (const y of ys) { e.box(-hw, hw, y - .03, y, 0, d, 'W', tintW(r()), 0, false, 29); }
    e.push(0, 1.05, .012, 0, 0, .78); e.box(-1.25, 1.25, -.012, .012, -.008, .008, 'M', c); e.pop();
    ys.slice(0, 4).forEach(y => { let x = -hw + .06, cnt = 0; while (x < hw - .2 && cnt++ < 3) { const k = r(), w = .3 + r() * .3;
      if (x + w > hw - .05) break;
      if (k < .4) e.box(x, x + w, y, y + .14 + r() * .2, .06, d - .06 - r() * .1, 'P', pick(PAL.box, r()), .01);
      else if (k < .6) e.box(x, x + w, y, y + .2, .04, d - .04, 'B', pick(PAL.burlap, r()), .06);
      else if (k < .8) e.cyl(x + .08, .28, .07, y, y + .2, 6, 'M', pick(PAL.paint, r()));
      x += w + .04 + r() * .1; } });
  },
  bench(e, it, r) {
    const wd = tintW(r()), hw = .9, d = .76;
    e.box(-hw, hw, .82, .92, 0, d, e.wood, wd, .01);
    for (const x of [-hw + .03, hw - .11]) for (const z of [.03, d - .11]) e.box(x, x + .08, 0, .82, z, z + .08, e.wood, wd);
    e.box(-hw + .03, hw - .03, .16, .19, .06, d - .06, e.wood, wd); e.box(-hw + .03, hw - .03, .6, .8, .02, .05, e.wood, wd);
    e.box(hw - .3, hw - .1, .92, 1.02, d - .14, d - .02, 'M', PAL.iron, .01); e.box(hw - .26, hw - .14, .92, .98, d - .02, d + .0, 'M', PAL.iron);
    e.push(-.3, .92, .4, r() * .8); e.box(-.12, .12, 0, .03, -.015, .015, e.wood, [.6, .45, .3]); e.box(.1, .14, 0, .05, -.035, .035, 'M', PAL.iron); e.pop();
    e.push(.1, .92, .3, r() - .5); e.box(-.25, .2, 0, .004, -.06, .06, 'M', [.5, .5, .52]); e.box(.2, .3, 0, .03, -.03, .03, e.wood, [.6, .4, .25]); e.pop();
    e.box(-.6, -.15, .19, .4, .15, .5, 'M', pick(PAL.paint, r()), .01);
    e.cyl(.4, .4, .08, .19, .36, 8, 'M', pick(PAL.paint, r()));
  },
  lockers(e, it, r) {
    const c = pick(PAL.paint, r()), hw = .6, d = .5, gone = it.v === 1 ? 1 + Math.floor(r() * 2) : -1;
    e.box(-hw, hw, 0, .08, .02, d - .03, 'M', PAL.dark);
    e.box(-hw, hw, .08, 1.86, 0, d - .02, 'M', c, .008);
    for (let i = 0; i < 3; i++) { const x0 = -hw + .015 + i * .39, x1 = x0 + .38;
      if (i === gone) { e.box(x0 + .01, x1 - .01, .12, 1.82, d - .022, d - .019, 'P', PAL.dark); e.box(x0 + .06, x1 - .06, .9, 1.55, d - .2, d - .1, 'C', pick(PAL.cloth, r()), .03); continue; }
      e.box(x0, x1, .1, 1.84, d - .02, d - .004, 'M', [c[0] * 1.06, c[1] * 1.06, c[2] * 1.06], .004);
      for (let k = 0; k < 3; k++) e.box(x0 + .08, x1 - .08, 1.6 + k * .05, 1.62 + k * .05, d - .004, d - .001, 'P', PAL.dark);
      e.box(x1 - .07, x1 - .04, .95, 1.1, d - .004, d, 'M', PAL.iron); }
  },
  filing(e, it, r) {
    const c = pick(PAL.metal, r()), hw = .25, d = .62, gone = it.v === 1;
    e.box(-hw, hw, 0, 1.32, 0, d - .02, 'M', c, .01);
    for (let i = 0; i < 4; i++) { const y0 = .04 + i * .32; if (gone && i === 3) { e.box(-hw + .02, hw - .02, y0, y0 + .29, d - .022, d - .019, 'P', PAL.dark); continue; }
      e.box(-hw + .02, hw - .02, y0, y0 + .29, d - .02, d - .005, 'M', [c[0] * 1.08, c[1] * 1.08, c[2] * 1.08], .005);
      e.box(-.07, .07, y0 + .18, y0 + .2, d - .005, d, 'M', PAL.iron); e.box(-.04, .04, y0 + .22, y0 + .26, d - .005, d - .002, 'X', PAL.paper[0]); }
    if (gone) for (let i = 0; i < 3; i++) { e.push(r() * .2 - .1, 1.32 + i * .003, .3, r() - .5); e.box(-.105, .105, 0, .002, -.148, .148, 'X', pick(PAL.paper, r()), 0, false, 1); e.pop(); }
  },
  bunk(e, it, r) {
    const c = pick(PAL.metal, r()), L = 1.0, d = .94;
    for (const x of [-L + .03, L - .03]) for (const z of [.03, d - .03]) e.cyl(x, z, .022, 0, 1.72, 6, 'M', c, .022);
    for (const y of [.3, 1.18]) { for (const z of [.03, d - .03]) e.box(-L + .03, L - .03, y, y + .04, z - .02, z + .02, 'M', c); for (const x of [-L + .03, L - .03]) e.box(x - .02, x + .02, y, y + .04, .03, d - .03, 'M', c);
      e.box(-L + .06, L - .06, y + .04, y + .17, .06, d - .06, 'C', pick(PAL.sheet, r()), .045);
      e.box(-L + .08, -L + .42, y + .17, y + .25, .12, d - .12, 'C', PAL.white, .04);
      e.box(-L + .5, L - .04, y + .14, y + .21, .05, d - .04, 'C', pick(PAL.cloth, r()), .03); }
    for (const x of [-L + .03, L - .03]) e.box(x - .015, x + .015, 1.5, 1.54, .03, d - .03, 'M', c);
    for (let k = 0; k < 3; k++) e.push(L - .03, .55 + k * .3, d / 2, 0, 0, Math.PI / 2), e.cyl(0, 0, .012, -.03, .03, 5, 'M', c), e.pop();
  },
  console(e, it, r) {
    const c = pick(PAL.paint, r()), hw = .8, d = .8;
    e.box(-hw, hw, 0, .06, .02, d - .06, 'P', PAL.dark);
    e.box(-hw, hw, .06, .74, 0, d - .02, 'M', c, .01);
    e.push(0, .74, d - .02, 0, -.32, 0); e.box(-hw, hw, 0, .06, -.34, 0, 'M', [c[0] * 1.1, c[1] * 1.1, c[2] * 1.1], .01);
    for (let i = 0; i < 9; i++) { const x = -hw + .12 + i * .17; e.cyl(x, -.12, .018, .06, .085, 6, 'M', i % 3 ? PAL.iron : [.6, .2, .15]); e.box(x - .03, x + .03, .06, .07, -.28, -.22, 'P', i % 2 ? [.7, .6, .2] : [.2, .4, .25]); }
    e.pop();
    e.box(-hw + .02, hw - .02, .74, .96, .02, .44, 'M', c, .01);
    e.box(-hw + .05, -.05, .96, 1.32, .02, .3, 'M', [c[0] * .9, c[1] * .9, c[2] * .9], .012); e.box(-hw + .1, -.1, 1.0, 1.28, .3, .305, 'P', PAL.screen);
    e.push(.4, 1.12, .2, 0, Math.PI / 2, 0); e.cyl(0, 0, .17, -.18, .0, 12, 'M', [c[0] * .9, c[1] * .9, c[2] * .9]); e.cyl(0, 0, .14, .0, .006, 12, 'P', PAL.glassG); e.pop();
    for (let i = 0; i < 2; i++) { e.push(-.3 + i * .5, .96, .38 + r() * .02, r() - .5); e.box(-.105, .105, 0, .002, -.07, .07, 'X', pick(PAL.paper, r()), 0, false, 1); e.pop(); }
  },
  sacks(e, it, r) {
    const n = 5; for (let i = 0; i < n; i++) { const row = i < 3 ? 0 : 1, x = row ? -.25 + (i - 3) * .5 : -.4 + i * .4, y = row * .24, sc = pick(PAL.burlap, r());
      e.push(x, y, .42 + (r() - .5) * .08, (r() - .5) * .3 + (row ? 0 : 0), 0, (r() - .5) * .1); e.box(-.19, .19, 0, .25, -.4, .4, 'B', sc, .09); e.pop(); }
  },
  table(e, it, r) {
    const wd = tintW(r()), hw = .7, d = .86;
    legs4(e, -hw + .04, hw - .04, .04, d - .04, .71, .06, e.wood, wd);
    e.box(-hw + .06, hw - .06, .63, .71, .07, .1, e.wood, wd); e.box(-hw + .06, hw - .06, .63, .71, d - .1, d - .07, e.wood, wd);
    e.box(-hw + .07, -hw + .1, .63, .71, .1, d - .1, e.wood, wd); e.box(hw - .1, hw - .07, .63, .71, .1, d - .1, e.wood, wd);
    e.box(-hw, hw, .71, .76, 0, d, e.wood, wd, .012);
    if (r() < .35) { const c = pick(PAL.sheet, r()); e.box(-hw + .02, hw - .02, .76, .765, .02, d - .02, 'C', c); }
    M.tableStuff(e, r, -hw + .15, hw - .15, .76, .15, d - .15);
  },
  tableStuff(e, r, x0, x1, y, z0, z1) {
    const n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) { const x = lerp(x0, x1, r()), z = lerp(z0, z1, r()), k = r();
      if (k < .3) e.cyl(x, z, .11, y, y + .015, 10, 'X', PAL.white, .1);
      else if (k < .5) { e.cyl(x, z, .035, y, y + .2, 7, 'P', pick(PAL.jar, r()), .03); e.cyl(x, z, .012, y + .2, y + .27, 5, 'P', pick(PAL.jar, r())); }
      else if (k < .7) e.cyl(x, z, .04, y, y + .09, 7, 'X', pick(PAL.paper, r()), .045);
      else if (k < .85) { e.push(x, y, z, r() * 3); e.box(-.105, .105, 0, .002, -.148, .148, 'X', pick(PAL.paper, r()), 0, false, 1); e.pop(); }
      else { e.push(x, y, z, r() * 3, 0, 1.57); e.cyl(0, 0, .035, -.1, .1, 7, 'P', pick(PAL.jar, r())); e.pop(); } }
  },
  tableBroken(e, it, r) {
    const wd = tintW(r()), hw = .7, d = .86, a = Math.asin(.66 / 1.36);
    e.box(hw - .1, hw - .04, 0, .71, .04, .1, e.wood, wd); e.box(hw - .1, hw - .04, 0, .71, d - .1, d - .04, e.wood, wd);
    e.push(hw - .04, .72, 0, 0, 0, a); e.box(-1.36, 0, -.04, .01, 0, d, e.wood, wd, .012); e.box(-1.3, -.06, -.11, -.04, .07, .1, e.wood, wd); e.box(-1.3, -.06, -.11, -.04, d - .1, d - .07, e.wood, wd); e.box(-1.32, -1.26, -.2, -.04, .05, .11, e.wood, wd); e.pop();
    e.push(-.2, 0, .3, .4, 0, 1.5708); e.box(0, .055, -.03, .03, -.32, .3, e.wood, wd); e.pop();
    e.push(.05, 0, .62, -.3, 0, 1.5708); e.box(0, .055, -.03, .03, -.3, .25, e.wood, wd); e.pop();
    for (let i = 0; i < 3; i++) { const k = r(); e.push(-.5 + r() * 1.0, 0, .1 + r() * .66, r() * 3); if (k < .4) e.cyl(0, 0, .11, 0, .015, 10, 'X', PAL.white, .1); else if (k < .7) { e.push(0, .035, 0, 0, 0, 1.57); e.cyl(0, 0, .035, -.12, .12, 7, 'P', pick(PAL.jar, r())); e.pop(); } else e.box(-.105, .105, 0, .002, -.148, .148, 'X', pick(PAL.paper, r()), 0, false, 1); e.pop(); }
  },
  chair(e, it, r, wd = tintW(r())) {
    const hw = .23;
    for (const x of [-hw + .01, hw - .045]) { e.box(x, x + .035, 0, .43, .41 - .0, .445, e.wood, wd); e.box(x, x + .035, 0, .94, .0, .035, e.wood, wd, .006); }
    e.box(-hw, hw, .43, .47, .0, .46, e.wood, wd, .01);
    for (const y of [.62, .76, .88]) e.box(-hw + .045, hw - .045, y, y + .045, .005, .03, e.wood, wd, .006);
    e.box(-hw + .045, hw - .045, .14, .17, .015, .03, e.wood, wd); e.box(-hw + .045, hw - .045, .14, .17, .42, .435, e.wood, wd);
  },
  chairDown(e, it, r) { e.push(0, 0, .96, 0, -Math.PI / 2, 0); M.chair(e, it, r); e.pop(); },
};

/* ---------- débris (sans collision) ---------- */
const DEB = {
  paper(e, d, r) { const c = pick(PAL.paper, r()), big = r() < .15, w = big ? .16 : .085, l = big ? .22 : .12, f = .004 + r() * .01;
    e.poly([[-w, .004, -l], [w, .004, -l], [w, .004 + f, 0], [-w, .004 + f, 0]], [0, -1, 0], 'X', c); e.poly([[-w, .004 + f, 0], [w, .004 + f, 0], [w, .004, l], [-w, .004, l]], [0, -1, 0], 'X', c); },
  plank(e, d, r) { const L = .7 + r() * .7, wd = tintW(r());
    e.push(0, 0, 0, 0, 0, .05); e.box(-L / 2, L / 2, 0, .022, -.05, .05, 'W', wd, .004); e.pop();
    e.box(L / 2 - .02, L / 2 + .14, 0, .02, -.05, -.005, 'W', wd); if (r() < .5) { e.push(.1, .02, .12, .5, 0, 0); e.box(-L / 3, L / 3, 0, .02, -.045, .045, 'W', wd, .004); e.pop(); } },
  plaster(e, d, r) { const c = pick(PAL.plaster, r()), n = 4 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) { const s = .04 + r() * .09; e.push((r() - .5) * .45, 0, (r() - .5) * .45, r() * 3, (r() - .5) * .3, (r() - .5) * .3); e.box(-s, s, 0, s * (.4 + r() * .6), -s * .8, s * .8, 'S', c, s * .3); e.pop(); }
    e.poly([[-.25, .003, -.2], [.22, .003, -.25], [.28, .003, .18], [-.2, .003, .26]], [0, -1, 0], 'S', [c[0] * .9, c[1] * .9, c[2] * .9]); },
  book(e, d, r) { const c = pick(PAL.book, r()); if (r() < .5) { e.box(-.1, .1, 0, .03, -.07, .07, 'P', c, .004); return; }
    e.push(-.002, 0, 0, 0, 0, .12); e.box(-.2, 0, 0, .012, -.07, .07, 'P', c); e.box(-.19, -.005, .012, .022, -.065, .065, 'X', PAL.paper[0]); e.pop();
    e.push(.002, 0, 0, 0, 0, -.12); e.box(0, .2, 0, .012, -.07, .07, 'P', c); e.box(.005, .19, .012, .022, -.065, .065, 'X', PAL.paper[0]); e.pop(); },
};
DEB.shard = DEB.paper;
DEB.rug = (e, d, r) => { const c = pick(PAL.cloth, r()), c2 = [c[0] * .7, c[1] * .7, c[2] * .7], rx = d.s, rz = d.s2;
  e.box(-rx, rx, 0, .012, -rz, rz, 'C', c, .006); e.box(-rx + .12, rx - .12, .012, .0135, -rz + .12, rz - .12, 'C', c2, 0, false, 1); e.box(-rx + .2, rx - .2, .0135, .014, -rz + .2, rz - .2, 'C', c, 0, false, 1); };

/* ---------- carte en cours ---------- */
let cur = null;
function findMats(scene) {
  const m = new Map(); scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.name && o.name.startsWith('batch-') && o.material && !Array.isArray(o.material)) { const k = o.name.slice(6); if (!m.has(k)) m.set(k, o.material); } });
  return m;
}
export function clear() {
  if (!cur) return; try { cur.group.parent && cur.group.parent.remove(cur.group); for (const ch of cur.chunks) for (const ms of ch.meshes) ms.geometry.dispose(); } catch { /* déjà parti */ } cur = null;
}
/** Meubles de la carte `id` : à appeler après props.attach (portes, vitres, barils posés), avant grid.build et la navigation. */
/** [meubles] Synchronous furnishing (tools, synchronous map loads). */
export function furnish(ctx) { const g = furnishSteps(ctx); for (;;) { const r = g.next(); if (r.done) return r.value; } }
/** [meubles] Sliced furnishing for the loading screen: `slice()` gives the frame back once its budget is spent (game.js loader). */
export async function furnishAsync(ctx, slice) { const g = furnishSteps(ctx); for (;;) { const r = g.next(); if (r.done) return r.value; const p = slice && slice(); if (p) await p; } }
function* furnishSteps({ world, scene, id }) {
  clear();
  if (!world || !world.solids || !scene || !(ON.has(id) || globalThis.__fzMeublesAll)) return null;
  let L = null; try { L = buildLayout(id); } catch { L = null; }
  yield;
  const plan = yield* planFurnitureSteps({ id, env: world.sk || world.env, size: world.size, solids: world.solids, spawns: world.spawns, breach: world.breach, objectives: world.objectives, levelAt: world.levelAt, L });
  const found = findMats(scene), mats = {}, matObj = new Map();
  let vc = false; for (const [k, m] of found) if (m.vertexColors && (k === 'pal' || k.startsWith('ar_'))) vc = true;
  for (const role in PREF) for (const k of (!vc && PREF_NOVC[role]) || PREF[role]) if (found.has(k)) { mats[role] = k; matObj.set(k, found.get(k)); break; }
  const S = world.size, chunks = new Map(), e = emitter();
  const chunkOf = (x, z) => { const i = Math.floor((x + S) / CHUNK), j = Math.floor((z + S) / CHUNK), k = i * 1000 + j; let c = chunks.get(k); if (!c) { c = { sinks: new Map(), x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, meshes: [], vis: true }; chunks.set(k, c); } return c; };
  const sinkIn = c => key => { let s = c.sinks.get(key); if (!s) { s = { p: [], n: [], u: [], c: [] }; c.sinks.set(key, s); } return s; };
  const grow = (c, x, z, r) => { c.x0 = Math.min(c.x0, x - r); c.x1 = Math.max(c.x1, x + r); c.z0 = Math.min(c.z0, z - r); c.z1 = Math.max(c.z1, z + r); };
  const perModel = {};
  for (const it of plan.items) { yield;
    const f = M[it.m]; if (!f) continue; const c = chunkOf(it.x, it.z); grow(c, it.x, it.z, 2.2);
    let s = Math.floor(it.seed * 4294967295) || 1; const r = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    e.sinks = sinkIn(c); e.mats = mats; e.uo = r() * 7; e.vo = r() * 7;
    e.wood = r() < .45 ? 'D' : 'W';
    e.frame(it.x, it.y, it.z, it.th + (it.m === 'chair' || it.m === 'chairDown' ? (r() - .5) * .16 : 0));
    const t0 = e.tris; try { f(e, it, r); } catch (er) { console.warn('[meubles] modèle', it.m, er); }
    const pm = perModel[it.m] || (perModel[it.m] = { n: 0, max: 0 }); pm.n++; pm.max = Math.max(pm.max, e.tris - t0);
  }
  for (const d of plan.debris) { yield;
    const f = DEB[d.k]; if (!f) continue; const c = chunkOf(d.x, d.z); grow(c, d.x, d.z, .6);
    let s = Math.floor(d.seed * 4294967295) || 1; const r = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    e.sinks = sinkIn(c); e.mats = mats; e.uo = r() * 5; e.vo = r() * 5; e.frame(d.x, d.y, d.z, d.th); f(e, d, r);
  }
  const group = new THREE.Group(); group.name = 'meubles'; let tris = 0, draws = 0;
  for (const c of chunks.values()) { yield;
    for (const [key, s] of c.sinks) {
      if (!s.p.length) continue; const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(s.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(s.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(s.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(s.c, 3)); g.computeBoundingSphere();
      const ms = new THREE.Mesh(g, matObj.get(key)); ms.castShadow = false; ms.receiveShadow = true; ms.matrixAutoUpdate = false; ms.name = 'meubles-' + key;
      ms.renderOrder = -1;       /* dessinés avant murs et sols : ce qu'ils cachent n'est pas ombré (mesuré : mieux qu'après, dedans comme dehors) */
      c.meshes.push(ms); group.add(ms); tris += s.p.length / 9; draws++;
    }
    c.sinks = null;
  }
  for (const s of plan.solids) world.solids.push(s);       /* [meubles] collisions and meshes land together, after the last slice: a load cancelled half-way leaves neither */
  scene.add(group); group.updateMatrixWorld(true);
  cur = { group, chunks: [...chunks.values()], tick: 0, plan, stats: Object.assign({}, plan.stats, { tris, meshes: draws, chunks: chunks.size, perModel, mats }) };
  return cur.stats;
}
/** À chaque image : seuls les carrés à moins de SHOW m sont dessinés (tri toutes les 8 images). */
export function update(c) {
  if (!cur || cur.off || !c || (++cur.tick & 7)) return;
  for (const ch of cur.chunks) { const dx = Math.max(ch.x0 - c.x, 0, c.x - ch.x1), dz = Math.max(ch.z0 - c.z, 0, c.z - ch.z1), d = Math.hypot(dx, dz), v = ch.vis ? d < SHOW + HYST : d < SHOW;
    if (v !== ch.vis) { ch.vis = v; for (const ms of ch.meshes) ms.visible = v; } }
}
export function stats() { return cur ? cur.stats : null; }
/** Mesures : tout cacher (et ne plus trier) ou tout rendre. */
export function setEnabled(v) { if (!cur) return 0; cur.off = !v; let n = 0; for (const ch of cur.chunks) { ch.vis = !!v; for (const ms of ch.meshes) { ms.visible = !!v; n++; } } if (v) cur.tick = 7; return n; }
globalThis.__fzMeubles = { stats, setEnabled };
export { CAT };
