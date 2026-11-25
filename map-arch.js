/* FRONT ZÉRO : kit d'architecture détaillée (pièces procédurales, réutilisable par toute carte).
   Principe : collision fine en boîtes (Kit.col), rendu riche. Chaque pièce est une opération {t:'g'} : maillage fusionné par matériau au chargement,
   couleurs par sommet = lumière et ombres de contact cuites (aucune lumière temps réel). Aucun accès DOM/WebGL ici sauf archMaterial (appelé au rendu). */
import * as THREE from 'three';

export const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (i, j) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
export const noise2 = (x, y) => { const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g); return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v; };

/* échelle de texture (mètres par répétition) */
const UVK = { ar_plaster: 2.6, ar_rubble: 2.1, ar_ashlar: 2.2, ar_tile: 1.5, ar_cobble: 1.9, ar_gravel: 2.6, ar_wood: 1.3, ar_cloth: 1.6, ar_iron: 1, ar_dark: 1, ar_plant: 1, lampA: 1, ar_rock: 3.2, ar_plank: 2.2, ar_shingle: 1.5, ar_water: 4, ar_water_cave: 4, ar_water_marsh: 4, ar_stonewall: 1.6, ar_brick: 1.3, ar_tin: 1.9, ar_snow: 3, ar_needle: 1 };

class FA { constructor(a, n) { this.a = a; this.n = n; this.count = a.length / n; this.itemSize = n; } getX(i) { return this.a[i * this.n]; } getY(i) { return this.a[i * this.n + 1]; } getZ(i) { return this.a[i * this.n + 2]; } }
class IA { constructor(a) { this.a = a; this.count = a.length; } getX(i) { return this.a[i]; } }

/* tampon de la pièce en cours */
let P = [], N = [], C = [], T = [], I = [], uvK = 2, tr = 1, tg = 1, tb = 1;
function V(x, y, z, nx, ny, nz) {
  P.push(x, y, z); N.push(nx, ny, nz); C.push(tr, tg, tb);
  const ax = nx < 0 ? -nx : nx, ay = ny < 0 ? -ny : ny, az = nz < 0 ? -nz : nz;
  if (ax >= ay && ax >= az) T.push(z / uvK, y / uvK); else if (ay >= az) T.push(x / uvK, z / uvK); else T.push(x / uvK, y / uvK);
}
/* quadrilatère a,b,c,d dans le sens direct vu de l'extérieur */
function Q(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
  const ux = cx - ax, uy = cy - ay, uz = cz - az, wx = dx - bx, wy = dy - by, wz = dz - bz; let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
  const b = P.length / 3; V(ax, ay, az, nx, ny, nz); V(bx, by, bz, nx, ny, nz); V(cx, cy, cz, nx, ny, nz); V(dx, dy, dz, nx, ny, nz); I.push(b, b + 1, b + 2, b, b + 2, b + 3);
}
function TRI(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az; let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
  const b = P.length / 3; V(ax, ay, az, nx, ny, nz); V(bx, by, bz, nx, ny, nz); V(cx, cy, cz, nx, ny, nz); I.push(b, b + 1, b + 2);
}
/* boîte, coins décalés de j (pierre taillée à la main) ; skip : faces omises, lettres de 'xXyYzZ' (x = face -x, X = face +x) */
function BX(x0, x1, y0, y1, z0, z1, j = 0, skip = '', rnd = null) {
  const d = () => (j && rnd ? (rnd() - .5) * 2 * j : 0), p = [];
  for (let i = 0; i < 8; i++) p.push([(i & 1 ? x1 : x0) + d(), (i & 2 ? y1 : y0) + (i & 2 ? d() : 0), (i & 4 ? z1 : z0) + d()]);
  const F = (a, b, c, e) => Q(p[a][0], p[a][1], p[a][2], p[b][0], p[b][1], p[b][2], p[c][0], p[c][1], p[c][2], p[e][0], p[e][1], p[e][2]);
  if (!skip.includes('X')) F(5, 1, 3, 7); if (!skip.includes('x')) F(0, 4, 6, 2); if (!skip.includes('Y')) F(6, 7, 3, 2); if (!skip.includes('y')) F(0, 1, 5, 4); if (!skip.includes('Z')) F(4, 5, 7, 6); if (!skip.includes('z')) F(1, 0, 2, 3);
}
/* repère de mur : ax='x' : u=x, w=z ; ax='z' : u=z, w=x. pt() écrit dans _x,_z */
let _x = 0, _z = 0; const pt = (ax, u, w) => { if (ax === 'x') { _x = u; _z = w; } else { _x = w; _z = u; } };
function WQ(ax, s, u0, y0, w0, u1, y1, w1, u2, y2, w2, u3, y3, w3) {    // quadrilatère dans le repère de mur, face tournée vers w*s
  const flip = ax === 'x' ? s < 0 : s > 0;
  const a = flip ? [u1, y1, w1] : [u0, y0, w0], b = flip ? [u0, y0, w0] : [u1, y1, w1], c = flip ? [u3, y3, w3] : [u2, y2, w2], d = flip ? [u2, y2, w2] : [u3, y3, w3];
  pt(ax, a[0], a[2]); const ax0 = _x, az0 = _z; pt(ax, b[0], b[2]); const bx0 = _x, bz0 = _z; pt(ax, c[0], c[2]); const cx0 = _x, cz0 = _z; pt(ax, d[0], d[2]);
  Q(ax0, a[1], az0, bx0, b[1], bz0, cx0, c[1], cz0, _x, d[1], _z);
}
function WB(ax, u0, u1, y0, y1, w0, w1, j, rnd) { if (ax === 'x') BX(u0, u1, y0, y1, w0, w1, j, '', rnd); else BX(w0, w1, y0, y1, u0, u1, j, '', rnd); }
function WF(ax, s, u0, u1, y0, y1, w0, w1, j, rnd, bottom, noTop) { const back = ax === 'x' ? (s > 0 ? 'z' : 'Z') : (s > 0 ? 'x' : 'X'), sk = back + (bottom ? '' : 'y') + (noTop ? 'Y' : ''); if (ax === 'x') BX(u0, u1, y0, y1, w0, w1, j, sk, rnd); else BX(w0, w1, y0, y1, u0, u1, j, sk, rnd); }
/* prisme extrudé selon la profondeur du mur (polygone en (u,y), sens quelconque) */
function EXT(ax, poly, w0, w1) {
  let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; } if (area < 0) poly = poly.slice().reverse();
  const n = poly.length;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; 
    /* flanc : normale sortante du polygone */
    const fl = ax !== 'x'; const qa = fl ? [b[0], b[1], w0] : [a[0], a[1], w0], qb = fl ? [a[0], a[1], w0] : [b[0], b[1], w0], qc = fl ? [a[0], a[1], w1] : [b[0], b[1], w1], qd = fl ? [b[0], b[1], w1] : [a[0], a[1], w1];
    pt(ax, qa[0], qa[2]); const x0 = _x, z0 = _z; pt(ax, qb[0], qb[2]); const x1 = _x, z1 = _z; pt(ax, qc[0], qc[2]); const x2 = _x, z2 = _z; pt(ax, qd[0], qd[2]); Q(x0, qa[1], z0, x1, qb[1], z1, x2, qc[1], z2, _x, qd[1], _z); }
  for (const [w, sg] of [[w1, 1], [w0, -1]]) {    // faces avant et arrière, en éventail
    const flip = ax === 'x' ? sg < 0 : sg > 0; pt(ax, poly[0][0], w); const x0 = _x, z0 = _z;
    for (let i = 1; i < n - 1; i++) { const A = poly[flip ? i + 1 : i], B = poly[flip ? i : i + 1]; pt(ax, A[0], w); const x1 = _x, z1 = _z; pt(ax, B[0], w); TRI(x0, poly[0][1], z0, x1, A[1], z1, _x, B[1], _z); }
  }
}
/* prisme vertical (polygone (x,z)) */
function PRISM(poly, y0, y1) {
  let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; } if (area > 0) poly = poly.slice().reverse();
  const n = poly.length;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; Q(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y1, a[1]); }
  for (let i = 1; i < n - 1; i++) { TRI(poly[0][0], y1, poly[0][1], poly[i][0], y1, poly[i][1], poly[i + 1][0], y1, poly[i + 1][1]); TRI(poly[0][0], y0, poly[0][1], poly[i + 1][0], y0, poly[i + 1][1], poly[i][0], y0, poly[i][1]); }
}
/* cylindre libre entre deux points (tuyaux, câbles, barreaux) */
function ROD(ax, ay, az, bx, by, bz, r, seg = 5) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, tx = dx / l, ty = dy / l, tz = dz / l;
  let ex = Math.abs(ty) > .9 ? 1 : 0, ey = Math.abs(ty) > .9 ? 0 : 1, ez = 0; const fx = ty * ez - tz * ey, fy = tz * ex - tx * ez, fz = tx * ey - ty * ex, fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1, ux = fx / fl, uy = fy / fl, uz = fz / fl; ex = ty * uz - tz * uy; ey = tz * ux - tx * uz; ez = tx * uy - ty * ux;
  for (let i = 0; i < seg; i++) { const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, c0 = Math.cos(a0) * r, s0 = Math.sin(a0) * r, c1 = Math.cos(a1) * r, s1 = Math.sin(a1) * r;
    Q(ax + ux * c0 + ex * s0, ay + uy * c0 + ey * s0, az + uz * c0 + ez * s0, ax + ux * c1 + ex * s1, ay + uy * c1 + ey * s1, az + uz * c1 + ez * s1, bx + ux * c1 + ex * s1, by + uy * c1 + ey * s1, bz + uz * c1 + ez * s1, bx + ux * c0 + ex * s0, by + uy * c0 + ey * s0, bz + uz * c0 + ez * s0); }
}

const ICO = (() => { const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; }); return { v, f: [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1] }; })();
function BLOB(x, y, z, r, ry, rnd) { const q = ICO.v.map(p => { const k = 1 + (rnd() - .5) * .36; return [x + p[0] * r * k, y + p[1] * ry * k, z + p[2] * r * k]; }); const b0 = P.length / 3; for (let i = 0; i < 12; i++) { const p = q[i], nx = (p[0] - x) / r, ny = (p[1] - y) / ry, nz = (p[2] - z) / r, l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; V(p[0], p[1], p[2], nx / l, ny / l, nz / l); } for (let i = 0; i < 60; i++) I.push(b0 + ICO.f[i]); }

const TF = [null, null];
function TUBE(pts, seg) {
  const n = pts.length, b0 = P.length / 3; let ux = 1, uy = 0, uz = 0, len = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)], p = pts[i]; let tx = c[0] - a[0], ty = c[1] - a[1], tz = c[2] - a[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    let dp = ux * tx + uy * ty + uz * tz; ux -= tx * dp; uy -= ty * dp; uz -= tz * dp; let ul = Math.hypot(ux, uy, uz);
    if (ul < 1e-3) { ux = Math.abs(ty) > .9 ? 1 : 0; uy = Math.abs(ty) > .9 ? 0 : 1; uz = 0; dp = ux * tx + uy * ty; ux -= tx * dp; uy -= ty * dp; uz -= tz * dp; ul = Math.hypot(ux, uy, uz) || 1; } ux /= ul; uy /= ul; uz /= ul;
    const wx = ty * uz - tz * uy, wy = tz * ux - tx * uz, wz = tx * uy - ty * ux; if (i === 0 || i === n - 1) TF[i ? 1 : 0] = [p[0], p[1], p[2], p[3], ux, uy, uz, wx, wy, wz, tx, ty, tz]; if (i) len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1], p[2] - pts[i - 1][2]);
    for (let k = 0; k <= seg; k++) { const an = k / seg * TAU, ca = Math.cos(an), sa = Math.sin(an), nx = ux * ca + wx * sa, ny = uy * ca + wy * sa, nz = uz * ca + wz * sa, rr = p[3]; V(p[0] + nx * rr, p[1] + ny * rr, p[2] + nz * rr, nx, ny, nz); T[T.length - 2] = len / 1.3; T[T.length - 1] = k / seg * .7; }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) { const a = b0 + i * (seg + 1) + k, b = a + 1, d = a + seg + 1, c = d + 1; I.push(a, b, c, a, c, d); }
}
/* bout coupé d'un rondin : disque face à l'axe, cernes au centre de la texture */
function CAP(f, seg, sg) { const [px, py, pz, r, ux, uy, uz, wx, wy, wz, tx, ty, tz] = f, b0 = P.length / 3; V(px, py, pz, tx * sg, ty * sg, tz * sg); T[T.length - 2] = .5; T[T.length - 1] = .5;
  for (let k = 0; k <= seg; k++) { const an = k / seg * TAU, ca = Math.cos(an), sa = Math.sin(an); V(px + (ux * ca + wx * sa) * r, py + (uy * ca + wy * sa) * r, pz + (uz * ca + wz * sa) * r, tx * sg, ty * sg, tz * sg); T[T.length - 2] = .5 + ca * .12; T[T.length - 1] = .5 + sa * .12; }
  for (let k = 0; k < seg; k++) sg > 0 ? I.push(b0, b0 + 1 + k, b0 + 2 + k) : I.push(b0, b0 + 2 + k, b0 + 1 + k); }
/* plaque de feuillage vue des deux côtés ; normales de la ramure entière : éclairage doux, sans facettes */
function LEAF(cx, cy, cz, ex, ey, ez, fx, fy, fz, ox, oy, oz, flipU) {
  const put = (a, b, u, v) => { const x = cx + ex * a + fx * b, y = cy + ey * a + fy * b, z = cz + ez * a + fz * b; let nx = x - ox, ny = (y - oy) * 1.5 + .35, nz = z - oz; const l = Math.hypot(nx, ny, nz) || 1; V(x, y, z, nx / l, ny / l, nz / l); T[T.length - 2] = flipU ? 1 - u : u; T[T.length - 1] = v; };
  for (const sd of [1, -1]) { const b0 = P.length / 3; put(-1, -1, 0, 0); put(sd, -sd, 1, 0); put(1, 1, 1, 1); put(-sd, sd, 0, 1); I.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); }
}

export class Arch {
  /** k : Kit de la carte ; bake(x,y,z,ny,out) : couleur de lumière cuite au sommet */
  constructor(k, bake) { this.k = k; this.r = k.r; this.bake = bake || null; this.out = [1, 1, 1]; this.tris = 0; this.pieces = 0; this.fineN = 0; }
  rnd(a = 1, b) { return b === undefined ? this.r() * a : a + this.r() * (b - a); }
  tint(v, g, b) { tr = v; tg = g === undefined ? v : g; tb = b === undefined ? v : b; return this; }
  stoneTint(a = .86, b = 1.05) { const v = this.rnd(a, b), w = this.rnd(-.03, .03); return this.tint(v + w, v, v - w); }
  /* ---------- gestion des pièces ---------- */
  begin(m) { P = []; N = []; C = []; T = []; I = []; uvK = UVK[m] || 2; tr = tg = tb = 1; this.m = m; return this; }
  /** Ferme la pièce : cuit la lumière et pousse l'opération. fine=true : petit détail, retiré aux bas niveaux de qualité. */
  end(fine) {
    if (!P.length) return; const n = P.length / 3, B = this.bake, o = this.out, col = new Float32Array(n * 3); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      if (B) { B(x, y, z, N[i * 3 + 1], o); col[i * 3] = C[i * 3] * o[0]; col[i * 3 + 1] = C[i * 3 + 1] * o[1]; col[i * 3 + 2] = C[i * 3 + 2] * o[2]; } else { col[i * 3] = C[i * 3]; col[i * 3 + 1] = C[i * 3 + 1]; col[i * 3 + 2] = C[i * 3 + 2]; } }
    if (this.recolor) { const f = this.recolor(this.m, (x0 + x1) / 2, (z0 + z1) / 2, y0, y1); if (f) for (let i = 0; i < n; i++) { col[i * 3] *= f[0]; col[i * 3 + 1] *= f[1]; col[i * 3 + 2] *= f[2]; } }
    /* matériaux légers regroupés en un seul lot (moins d'appels de dessin) ; les pièces souterraines restent à part */
    const mg = !!(this.merge && this.merge.has(this.m)), un = this.under && this.under((x0 + x1) / 2, (z0 + z1) / 2, y1) ? 1 : 0;
    const g = { attributes: { position: new FA(new Float32Array(P), 3), normal: new FA(new Float32Array(N), 3), uv: new FA(new Float32Array(T), 2), color: new FA(col, 3) }, index: new IA(n > 65000 ? new Uint32Array(I) : new Uint16Array(I)) };
    this.k.ops.push({ t: 'g', m: this.m, g, x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: Math.max(.1, (y1 - y0) / 2), fine: fine && !mg ? 1 : 0, under: un, ...(mg ? { bq: un ? 'z|u' : 'z' } : null) });
    this.tris += I.length / 3; this.pieces++; P = []; N = []; C = []; T = []; I = [];
  }
  /* primitives directes (à utiliser entre begin/end) */
  box(x0, x1, y0, y1, z0, z1, j = 0, skip = '') { BX(x0, x1, y0, y1, z0, z1, j, skip, this.r); return this; }
  blob(x, y, z, r, ry = r) { BLOB(x, y, z, r, ry, this.r); return this; }
  rod(ax, ay, az, bx, by, bz, r = .02, seg = 5) { ROD(ax, ay, az, bx, by, bz, r, seg); return this; }
  quad(...a) { Q(...a); return this; }
  tri(...a) { TRI(...a); return this; }
  ext(ax, poly, w0, w1) { EXT(ax, poly, w0, w1); return this; }
  prism(poly, y0, y1) { PRISM(poly, y0, y1); return this; }
  /* une boîte = une pièce */
  solidBox(m, x0, x1, y0, y1, z0, z1, j = 0, t = 1) { this.begin(m); this.tint(t); BX(x0, x1, y0, y1, z0, z1, j, '', this.r); this.end(); }
  col(x0, x1, y0, y1, z0, z1, s = 'concrete') { return this.k.col(Math.min(x0, x1), Math.max(x0, x1), y0, y1, Math.min(z0, z1), Math.max(z0, z1), s); }
  wcol(ax, u0, u1, y0, y1, w0, w1, s) { return ax === 'x' ? this.col(u0, u1, y0, y1, w0, w1, s) : this.col(w0, w1, y0, y1, u0, u1, s); }

  /* ---------- MURS ---------- */
  /** Parement irrégulier sur un plan (ax,w=c), tourné vers s ; holes : [{a,b,y0,y1,spring?,pointed?}] ; rough : relief en m. */
  sheet(m, ax, c, s, u0, u1, y0, y1, o = {}) {
    const holes = o.holes || [], rough = o.rough ?? .03, du = o.du || .62, dy = o.dy || .46, base = o.tone ?? 1, topFn = o.top || null, rgb = o.rgb || [1.01, 1, .985];
    this.begin(m);
    const W = (u, y) => { const n = noise2(u * 1.7 + c * .7, y * 1.9 + c * .3) - .5, q = noise2(u * 5.3 - c, y * 5.9 + c) - .5, ed = rough > .1 ? clamp(Math.min(u - u0, u1 - u) / .8, 0, 1) * clamp(Math.min(y - y0, y1 - y) / .6, 0, 1) : 1; const st = o.strata ? o.strata * (Math.abs(((y * 1.15 + .45 * noise2(u * .25, c * .5)) % 1 + 1) % 1 - .5) * 2 - .5) : 0; return c + s * (n * rough * 1.4 + q * rough * .6 + st) * ed; };
    const rows = Math.max(1, Math.ceil((y1 - y0) / dy));
    const bands = []; for (let j = 0; j < rows; j++) { const e0 = y0 + (y1 - y0) * j / rows, e1 = y0 + (y1 - y0) * (j + 1) / rows, nb = holes.some(h => h.spring !== undefined && e1 > h.spring && e0 < h.y1 + .02) ? Math.max(1, Math.ceil((e1 - e0) / .06)) : 1; for (let k = 0; k < nb; k++) bands.push([e0 + (e1 - e0) * k / nb, e0 + (e1 - e0) * (k + 1) / nb]); }
    for (const [a0, a1] of bands) {
      const ym = (a0 + a1) / 2; let spans = [[u0, u1]];
      for (const h of holes) { if (ym < h.y0 || ym > h.y1) continue; let ha = h.a, hb = h.b; if (h.spring !== undefined && ym > h.spring) { const hw = (h.b - h.a) / 2, t = clamp((ym - h.spring) / (h.y1 - h.spring), 0, 1), k = h.pointed ? 1 - Math.pow(t, 1.5) : Math.sqrt(1 - t * t), mid = (h.a + h.b) / 2; ha = mid - hw * k; hb = mid + hw * k; }
        const nx = []; for (const [p, q] of spans) { if (hb <= p || ha >= q) { nx.push([p, q]); continue; } if (ha > p) nx.push([p, ha]); if (hb < q) nx.push([hb, q]); } spans = nx; }
      for (const [p, q] of spans) {
        if (q - p < .015) continue; const nu = Math.max(1, Math.round((q - p) / du));
        for (let i = 0; i < nu; i++) { const b0 = p + (q - p) * i / nu, b1 = p + (q - p) * (i + 1) / nu;
          let t0 = a1, t1 = a1; if (topFn) { t0 = Math.min(a1, topFn(b0)); t1 = Math.min(a1, topFn(b1)); if (t0 <= a0 && t1 <= a0) continue; t0 = Math.max(a0, t0); t1 = Math.max(a0, t1); }
          const v = base * (.93 + .14 * noise2(b0 * .6 + c, a0 * .8)) * (o.strata ? .8 + .34 * noise2(Math.floor((a0 + .35 * noise2(b0 * .3, c)) / .32) * 1.71 + .5, c * .37) : 1); tr = v * rgb[0]; tg = v * rgb[1] * (o.strata ? .98 : 1); tb = v * rgb[2] * (o.strata ? .95 : 1);
          const nv = N.length, bx = Math.min(q, b1 + .018), tx0 = Math.min(y1, t0 + .018), tx1 = Math.min(y1, t1 + .018); WQ(ax, s, b0, a0, W(b0, a0), bx, a0, W(bx, a0), bx, tx1, W(bx, tx1), b0, tx0, W(b0, tx0)); for (let q = nv; q < N.length; q += 3) { if (rough > .1) { const pu = ax === 'x' ? P[q] : P[q + 2], py = P[q + 1], gu = (W(pu + .05, py) - W(pu - .05, py)) / .1, gy = (W(pu, py + .05) - W(pu, py - .05)) / .1, nu = -s * gu, ny = -s * gy, l = Math.hypot(nu, ny, 1) || 1; N[q] = (ax === 'x' ? nu : s) / l; N[q + 1] = ny / l; N[q + 2] = (ax === 'x' ? s : nu) / l; } else { N[q] = ax === 'z' ? s : 0; N[q + 1] = 0; N[q + 2] = ax === 'x' ? s : 0; } const tn = base * (.93 + .14 * noise2((ax === 'x' ? P[q] : P[q + 2]) * .6 + c, P[q + 1] * .8)); C[q] = tn * rgb[0]; C[q + 1] = tn * rgb[1]; C[q + 2] = tn * rgb[2]; } }
      }
    }
    this.end();
  }
  /** Enduit tombé : plaque de moellons à contour irrégulier sur un mur. */
  scar(ax, c, s, u, y, w, h, m = 'ar_rubble') {
    const n = 14, e = c + s * .007, pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, q = (i & 1 ? .56 : .8) + .42 * noise2(u * 3 + i * 1.7, y * 2 + i * .8) - .2; pts.push([u + Math.cos(a) * w * q, y + Math.sin(a) * h * q]); }
    this.begin(m); this.tint(.92); const flip = ax === 'x' ? s < 0 : s > 0; for (let i = 1; i < n - 1; i++) { const A = pts[flip ? i + 1 : i], B = pts[flip ? i : i + 1]; pt(ax, pts[0][0], e); const x0 = _x, z0 = _z; pt(ax, A[0], e); const x1 = _x, z1 = _z; pt(ax, B[0], e); TRI(x0, pts[0][1], z0, x1, A[1], z1, _x, B[1], _z); } this.end(true);
  }
  /** Chaînage d'angle : pierres alternées qui débordent du mur, casse la ligne de coin. */
  quoins(x, z, sx, sz, y0, y1, m = 'ar_ashlar') {
    this.begin(m); let y = y0, odd = this.r() < .5;
    while (y < y1 - .08) { const h = this.rnd(.27, .4), t = Math.min(y1, y + h), l = odd ? this.rnd(.3, .44) : this.rnd(.18, .26), l2 = odd ? this.rnd(.18, .26) : this.rnd(.3, .44), e = .02; this.stoneTint(.84, 1.04);
      BX(sx > 0 ? x - e : x - l, sx > 0 ? x + l : x + e, y, t, sz > 0 ? z - e : z - .03, sz > 0 ? z + .03 : z + e, .006, 'yY' + (sz > 0 ? 'Z' : 'z'), this.r); BX(sx > 0 ? x - e : x - .03, sx > 0 ? x + .03 : x + e, y, t, sz > 0 ? z - e : z - l2, sz > 0 ? z + l2 : z + e, .006, 'yY' + (sx > 0 ? 'X' : 'x'), this.r); y = t; odd = !odd; }
    this.end(true);
  }
  /** Corniche moulurée sur un mur. */
  cornice(ax, c, s, u0, u1, y, o = {}) {
    const m = o.m || 'ar_ashlar', d = o.d ?? .16, h = o.h ?? .2; this.begin(m); this.tint(o.tone ?? .94);
    const prof = [[0, 0], [d * .36, h * .3], [d * .72, h * .58], [d, h], [0, h]];
    for (let i = 0; i < prof.length - 1; i++) { const a = prof[i], b = prof[i + 1]; WQ(ax, s, u0, y + a[1], c + s * a[0], u1, y + a[1], c + s * a[0], u1, y + b[1], c + s * b[0], u0, y + b[1], c + s * b[0]); }
    WQ(ax, s, u0, y + h, c + s * d, u1, y + h, c + s * d, u1, y + h, c, u0, y + h, c);
    for (const [e, g] of [[u0, -1], [u1, 1]]) for (let i = 0; i < prof.length - 1; i++) { const a = prof[i], b = prof[i + 1]; pt(ax, e, c + s * a[0]); const x0 = _x, z0 = _z; pt(ax, e, c + s * b[0]); const x1 = _x, z1 = _z; pt(ax, e, c); const f = (ax === 'x' ? g * s > 0 : g * s < 0); if (f) TRI(_x, y + a[1], _z, x0, y + a[1], z0, x1, y + b[1], z1); else TRI(_x, y + a[1], _z, x1, y + b[1], z1, x0, y + a[1], z0); }
    this.end(true);
  }

  /* ---------- ARCS ---------- */
  /** Courbe d'intrados : t=0..1, de la naissance gauche à la droite. pointed : arc brisé. */
  static curve(t, ua, ub, spring, rise, pointed) {
    const w = (ub - ua) / 2, mid = (ua + ub) / 2;
    if (!pointed) { const a = Math.PI * (1 - t); return [mid + Math.cos(a) * w, spring + Math.sin(a) * rise]; }
    const R = (w * w + rise * rise) / (2 * w), side = t < .5, q = side ? t * 2 : (1 - t) * 2, a0 = Math.atan2(rise, R - w), a = a0 * q, cu = side ? ua + R : ub - R, u = side ? cu - Math.cos(a) * R : cu + Math.cos(a) * R;
    return [u, spring + Math.sin(a) * R];
  }
  /** Arc à claveaux dans un mur (ax,c), épaisseur d, avec clé et piédroits ; col : ajoute les collisions de l'ébrasement courbe. */
  arch(ax, c, ua, ub, y0, spring, top, d, o = {}) {
    const m = o.m || 'ar_ashlar', pointed = !!o.pointed, rise = top - spring, nV = o.n || Math.max(7, Math.round((ub - ua + 2 * rise) / .3)) | 1, th = o.th ?? .3, w0 = c - d / 2, w1 = c + d / 2, wide = o.proud ?? .05;
    /* piédroits en pierres alternées */
    for (const sd of [-1, 1]) { const e = sd < 0 ? ua : ub; let y = y0, odd = this.r() < .5; this.begin(m); while (y < spring - .05) { const h = Math.min(spring - y, this.rnd(.3, .46)), l = odd ? .34 : .22; this.stoneTint(.82, 1.02); WB(ax, sd < 0 ? e - l : e - .012, sd < 0 ? e + .012 : e + l, y, y + h, w0 - wide, w1 + wide, .004, this.r); y += h; odd = !odd; } this.end(); }
    /* claveaux */
    this.begin(m);
    const out = (t) => { const [u, y] = Arch.curve(t, ua, ub, spring, rise, pointed), [u2, y2] = Arch.curve(clamp(t + .01, 0, 1), ua, ub, spring, rise, pointed), [u3, y3] = Arch.curve(clamp(t - .01, 0, 1), ua, ub, spring, rise, pointed); let tu = u2 - u3, ty = y2 - y3; const l = Math.hypot(tu, ty) || 1; tu /= l; ty /= l; return [u, y, -ty, tu]; };
    for (let i = 0; i < nV; i++) { const t0 = i / nV, t1 = (i + 1) / nV, a = out(t0 + .004), b = out(t1 - .004), key = i === (nV >> 1), T1 = key ? th * 1.28 : th * this.rnd(.86, 1.1), pr = key ? .05 : 0, e0 = w0 - wide - pr, e1 = w1 + wide + pr; this.stoneTint(key ? .95 : .8, key ? 1.08 : 1.02);
      EXT(ax, [[a[0], a[1]], [b[0], b[1]], [b[0] + b[2] * T1, b[1] + b[3] * T1], [a[0] + a[2] * T1, a[1] + a[3] * T1]], e0, e1); }
    this.end();
    if (o.col !== false) { for (const sd of [-1, 1]) this.wcol(ax, sd < 0 ? ua - .34 : ub, sd < 0 ? ua : ub + .34, y0, spring, w0 - wide, w1 + wide, o.surface || 'concrete');
      const s = o.surface || 'concrete', st = o.steps || 6;     /* collision de l'intrados : tranches horizontales */
      for (let i = 0; i < st; i++) { const y = spring + rise * i / st, yn = spring + rise * (i + 1) / st, q = (yn - spring) / rise, k = pointed ? Math.pow(1 - q, .75) : Math.sqrt(Math.max(0, 1 - q * q)), hw = (ub - ua) / 2 * k, mid = (ua + ub) / 2; this.wcol(ax, ua - .02, mid - hw, y, yn, w0, w1, s); this.wcol(ax, mid + hw, ub + .02, y, yn, w0, w1, s); } }
  }
  /** Voûte en berceau (axe ax) entre u0 et u1, largeur [a,b], avec arcs-doubleaux tous les `rib` m. */
  vault(ax, u0, u1, a, b, spring, crown, o = {}) {
    const m = o.m || 'ar_rubble', seg = o.seg || 10, rib = o.rib ?? 3.4, w = (b - a) / 2, mid = (a + b) / 2, rise = crown - spring, nu = Math.max(1, Math.round((u1 - u0) / 1.1));
    this.begin(m); const R = (t) => { const ang = Math.PI * t; return [mid - Math.cos(ang) * w, spring + Math.sin(ang) * rise]; };
    for (let i = 0; i < seg; i++) { const t0 = i / seg, t1 = (i + 1) / seg, [p0, h0] = R(t0), [p1, h1] = R(t1);
      for (let j = 0; j < nu; j++) { const q0 = u0 + (u1 - u0) * j / nu, q1 = u0 + (u1 - u0) * (j + 1) / nu; const v = (o.tone ?? 1) * (.9 + .2 * noise2(q0 * .9 + t0 * 7, t0 * 5)); tr = tg = tb = v;
        const n0 = noise2(q0 * 1.3, t0 * 9) * .04, n1 = noise2(q1 * 1.3, t0 * 9) * .04, n2 = noise2(q1 * 1.3, t1 * 9) * .04, n3 = noise2(q0 * 1.3, t1 * 9) * .04;
        const Hq = (f, g) => { const e0 = h0 + n0 + (n1 - n0) * f, e1 = h1 + n3 + (n2 - n3) * f; return e0 + (e1 - e0) * g; }, Uq = f => q0 + (q1 - q0) * f, Wq = g => p0 + (p1 - p0) * g, inH = (f, g) => (ax === 'x' ? o.hole(Uq(f), Wq(g)) : o.hole(Wq(g), Uq(f))), emit = (f0, f1, g0, g1) => { if (ax === 'x') Q(Uq(f0), Hq(f0, g0), Wq(g0), Uq(f1), Hq(f1, g0), Wq(g0), Uq(f1), Hq(f1, g1), Wq(g1), Uq(f0), Hq(f0, g1), Wq(g1)); else Q(Wq(g0), Hq(f1, g0), Uq(f1), Wq(g0), Hq(f0, g0), Uq(f0), Wq(g1), Hq(f0, g1), Uq(f0), Wq(g1), Hq(f1, g1), Uq(f1)); };
        if (!o.hole) emit(0, 1, 0, 1); else { const c = [inH(0, 0), inH(1, 0), inH(1, 1), inH(0, 1), inH(.5, .5)], nIn = c.filter(Boolean).length; if (nIn === 0) emit(0, 1, 0, 1); else if (nIn < 5) { const D = 6; for (let a = 0; a < D; a++) for (let b = 0; b < D; b++) if (!inH((a + .5) / D, (b + .5) / D)) emit(a / D, (a + 1) / D, b / D, (b + 1) / D); } } } }
    { const arcK = (w + rise) / 2; for (let q = 0, n = P.length / 3; q < n; q++) { const i3 = q * 3, px = P[i3], py = P[i3 + 1], pz = P[i3 + 2], pc = ax === 'x' ? pz : px, qc = ax === 'x' ? px : pz; let na = (mid - pc) / (w * w), nb = (spring - py) / (rise * rise); const nl = Math.hypot(na, nb) || 1; na /= nl; nb /= nl; N[i3] = ax === 'x' ? 0 : na; N[i3 + 1] = nb; N[i3 + 2] = ax === 'x' ? na : 0; const tv = (o.tone ?? 1) * (.9 + .2 * noise2(qc * .9 + pc * 1.3, py * 1.1)); C[i3] = C[i3 + 1] = C[i3 + 2] = tv; T[q * 2] = qc / uvK; T[q * 2 + 1] = Math.atan2((py - spring) / rise, (pc - mid) / w) * arcK / uvK; } }
    tr = tg = tb = .12; if (ax === 'x') Q(u0, crown + .05, b, u1, crown + .05, b, u1, crown + .05, a, u0, crown + .05, a); else Q(a, crown + .05, u1, b, crown + .05, u1, b, crown + .05, u0, a, crown + .05, u0); if (o.hole) { P.length -= 12; N.length -= 12; C.length -= 12; T.length -= 8; I.length -= 6; }
    this.end();
    /* o.shell (m) : extrados tourné vers l'extérieur, là où la voûte se voit du dehors (sinon elle est transparente vue de dos) */
    if (o.shell) { const sh = o.shell, Ro = (t) => { const ang = Math.PI * t; return [mid - Math.cos(ang) * (w + sh), spring + Math.sin(ang) * (rise + sh)]; }; this.begin(m); tr = tg = tb = (o.tone ?? 1) * .82;
      for (let i = 0; i < seg; i++) { const [p0, h0] = Ro(i / seg), [p1, h1] = Ro((i + 1) / seg); for (let j = 0; j < nu; j++) { const q0 = u0 + (u1 - u0) * j / nu, q1 = u0 + (u1 - u0) * (j + 1) / nu;
        if (o.hole && (ax === 'x' ? (o.hole((q0 + q1) / 2, (p0 + p1) / 2)) : o.hole((p0 + p1) / 2, (q0 + q1) / 2))) continue;
        if (ax === 'x') Q(q0, h0, p0, q0, h1, p1, q1, h1, p1, q1, h0, p0); else Q(p0, h0, q1, p1, h1, q1, p1, h1, q0, p0, h0, q0); } }
      /* épaisseur fermée : sous-face des naissances (avec 5 cm sous l'intrados bruité) et anneaux des deux bouts, sinon une fente vue d'en bas ou de bout */
      { const P3 = (q, h, p) => (ax === 'x' ? [q, h, p] : [p, h, q]), F = (A, B, C, D, nx, ny, nz) => { const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2]; if ((uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz < 0) { const t = B; B = D; D = t; } Q(...A, ...B, ...C, ...D); }, Ri = (t) => { const ang = Math.PI * t; return [mid - Math.cos(ang) * (w - .05), spring + Math.sin(ang) * (rise - .05)]; };
        for (let j = 0; j < nu; j++) { const q0 = u0 + (u1 - u0) * j / nu, q1 = u0 + (u1 - u0) * (j + 1) / nu; for (const [po, pi] of [[a - sh, a + .05], [b + sh, b - .05]]) { if (o.hole && (ax === 'x' ? o.hole((q0 + q1) / 2, po) : o.hole(po, (q0 + q1) / 2))) continue; F(P3(q0, spring, po), P3(q1, spring, po), P3(q1, spring, pi), P3(q0, spring, pi), 0, -1, 0); const sp = Math.sign(mid - pi); F(P3(q0, spring, pi), P3(q1, spring, pi), P3(q1, spring + .07, pi), P3(q0, spring + .07, pi), ax === 'x' ? 0 : sp, 0, ax === 'x' ? sp : 0); } }
        for (const [u, sg] of [[u0, -1], [u1, 1]]) for (let i = 0; i < seg; i++) { const [a0, b0] = Ri(i / seg), [a1, b1] = Ri((i + 1) / seg), [c0, d0] = Ro(i / seg), [c1, d1] = Ro((i + 1) / seg); F(P3(u, b0, a0), P3(u, d0, c0), P3(u, d1, c1), P3(u, b1, a1), ax === 'x' ? sg : 0, 0, ax === 'x' ? 0 : sg); } }
      this.end(); }
    /* o.ends ('u0' | 'u1' | true) : tympan plein au bout (tête dans un mur, jonction), de l'intrados (5 cm en retrait) jusqu'au couvercle ; sinon on voit le ciel entre l'arc et l'ouverture rectangulaire */
    if (o.ends) { const sh = o.shell || 0, top = crown + Math.max(.05, sh), P3 = (q, h, p) => (ax === 'x' ? [q, h, p] : [p, h, q]), F = (A, B, C, D, nx, nz) => { const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2]; if ((uy * vz - uz * vy) * nx + (ux * vy - uy * vx) * nz < 0) { const t = B; B = D; D = t; } Q(...A, ...B, ...C, ...D); }, Ri = (t) => { const ang = Math.PI * t; return [mid - Math.cos(ang) * (w - .05), spring + Math.sin(ang) * (rise - .05)]; };
      this.begin(m); tr = tg = tb = (o.tone ?? 1) * .86;
      for (const [u, sg] of [[u0, -1], [u1, 1]]) { if (o.ends !== true && o.ends !== (sg < 0 ? 'u0' : 'u1')) continue; const uf = u + sg * .012, nx = ax === 'x' ? sg : 0, nz = ax === 'x' ? 0 : sg;
        for (let i = 0; i < seg; i++) { const [a0, b0] = Ri(i / seg), [a1, b1] = Ri((i + 1) / seg); F(P3(uf, b0, a0), P3(uf, b1, a1), P3(uf, top, a1), P3(uf, top, a0), nx, nz); }
        for (const [p0, p1] of [[a - sh, a + .05], [b - .05, b + sh]]) F(P3(uf, spring, p0), P3(uf, spring, p1), P3(uf, top, p1), P3(uf, top, p0), nx, nz); }
      this.end(); }
    if (rib) for (let q = u0 + rib * .5; q < u1 - .3; q += rib) { this.begin('ar_ashlar'); const n = 11; for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, [p0, h0] = R(t0), [p1, h1] = R(t1); if (o.hole) { const pm = (p0 + p1) / 2; if (ax === 'x' ? (o.hole(q - .2, pm) || o.hole(q + .2, pm)) : (o.hole(pm, q - .2) || o.hole(pm, q + .2))) continue; } this.stoneTint(.74, .92); const c0 = Math.cos(Math.PI * t0), s0 = Math.sin(Math.PI * t0), c1 = Math.cos(Math.PI * t1), s1 = Math.sin(Math.PI * t1), th = .17; EXT(ax === 'x' ? 'z' : 'x', [[p0, h0], [p1, h1], [p1 + c1 * th, h1 - s1 * th], [p0 + c0 * th, h0 - s0 * th]], q - .17, q + .17); } this.end(); }
  }

  /* ---------- FORMES ARRONDIES ---------- */
  /** Bloc à arêtes abattues (plan octogonal, tête chanfreinée) : remplace une boîte partout où sa silhouette se voit. */
  rbox(m, x0, x1, y0, y1, z0, z1, o = {}) {
    const b = Math.min(o.b ?? .07, (x1 - x0) * .45, (z1 - z0) * .45, (y1 - y0) * .45), oct = (e) => [[x0 + b + e, z0 + e], [x1 - b - e, z0 + e], [x1 - e, z0 + b + e], [x1 - e, z1 - b - e], [x1 - b - e, z1 - e], [x0 + b + e, z1 - e], [x0 + e, z1 - b - e], [x0 + e, z0 + b + e]];
    if (!o.open) this.begin(m); if (o.t !== undefined) this.tint(o.t); const A = oct(0), B = oct(b * .7); PRISM(A, y0, y1 - b);
    for (let i = 0; i < 8; i++) { const p = A[i], q = A[(i + 1) % 8], u = B[(i + 1) % 8], v = B[i]; Q(p[0], y1 - b, p[1], v[0], y1, v[1], u[0], y1, u[1], q[0], y1 - b, q[1]); } PRISM(B, y1 - .002, y1);
    if (!o.open) this.end(o.fine); if (o.solid) this.col(x0, x1, y0, y1, z0, z1, o.surface || 'concrete');
  }
  /** Colonne : base moulurée, fût galbé, chapiteau. Collision en disque si solid (par défaut). */
  column(x, z, y0, y1, r, o = {}) {
    const seg = o.seg || 14, H = y1 - y0, k = Math.min(1, H / 3), prof = [[1.42, 0], [1.42, .07 * k], [1.18, .13 * k], [1.08, .2 * k], [1, .3 * k], [.98, H * .35], [.93, H * .7], [.88, H - .36 * k], [.98, H - .3 * k], [1.03, H - .25 * k], [1.32, H - .13 * k], [1.42, H - .1 * k], [1.42, H]];
    this.begin(o.m || 'ar_ashlar'); this.stoneTint(.86, 1.02);
    for (let i = 0; i < prof.length - 1; i++) for (let q = 0; q < seg; q++) { const a0 = q / seg * TAU, a1 = (q + 1) / seg * TAU, r0 = prof[i][0] * r, r1 = prof[i + 1][0] * r, h0 = y0 + prof[i][1], h1 = y0 + prof[i + 1][1]; Q(x + Math.cos(a0) * r0, h0, z + Math.sin(a0) * r0, x + Math.cos(a0) * r1, h1, z + Math.sin(a0) * r1, x + Math.cos(a1) * r1, h1, z + Math.sin(a1) * r1, x + Math.cos(a1) * r0, h0, z + Math.sin(a1) * r0); }
    this.end(); if (o.solid !== false) this.k.disc(x, z, r * (o.colR ?? 1.05), y0, y1, o.surface || 'concrete');
  }
  /** Parapet : mur bas à chaperon bombé ; merlons arrondis si o.merlon (largeur) ; o.broken : tête ruinée irrégulière. */
  parapet(ax, c, u0, u1, y, h, t, o = {}) {
    const m = o.m || 'ar_rubble', cap = o.cap || 'ar_ashlar', w0 = c - t / 2, w1 = c + t / 2, n = Math.max(1, Math.round((u1 - u0) / .95)), merl = o.merlon || 0, gapW = o.gap ?? merl * .62, seed = c * 1.3 + u0;
    const top = (u) => { let q = y + h; if (o.broken) q -= (noise2(u * .55 + seed, 3.1) ** 2) * h * .9 + noise2(u * 2.6, seed) * .12; return q; };
    this.begin(m); this.tint(o.tone ?? .95);
    for (let i = 0; i < n; i++) { const a = u0 + (u1 - u0) * i / n, b = u0 + (u1 - u0) * (i + 1) / n; EXT(ax, [[a, y], [b, y], [b, top(b)], [a, top(a)]], w0, w1); } this.end();
    const bands = o.cap || t <= .48 ? [0] : h >= .5 ? [-1, 1] : [];   /* dessus large (> 0,48 m, sans o.cap) : on garde le dessus d'origine (planches, enduit…) ; vrai mur : deux bandeaux de rive de 20 cm ; dalle basse : rien */
    this.begin(cap); for (let i = 0; i < n; i++) { const a = u0 + (u1 - u0) * i / n, b = u0 + (u1 - u0) * (i + 1) / n, ta = top(a), tb = top(b); this.stoneTint(.86, 1.04); for (const sd of bands) { const e = sd ? .1 : t / 2 + .035, cc = sd ? c + sd * (t / 2 + .035 - e) : c, hh = sd ? .05 : .075, seg = sd ? 2 : 3; for (let q = 0; q < seg; q++) { const f0 = Math.PI * q / seg, f1 = Math.PI * (q + 1) / seg, w = (f) => cc + Math.cos(f) * e, yy = (f) => Math.sin(f) * hh; WQ(ax, -1, a, ta + yy(f1), w(f1), b, tb + yy(f1), w(f1), b, tb + yy(f0), w(f0), a, ta + yy(f0), w(f0)); } } } this.end(true);   /* chaperon : faces tournées vers l'extérieur (s = -1 avec f0 < f1) */
    if (o.col !== false) { const steps = o.broken ? Math.max(1, Math.round((u1 - u0) / 1.1)) : 1; for (let i = 0; i < steps; i++) { const a = u0 + (u1 - u0) * i / steps, b = u0 + (u1 - u0) * (i + 1) / steps; let q = 0; for (let f = 0; f <= 4; f++) q = Math.max(q, top(a + (b - a) * f / 4)); this.wcol(ax, a, b, y, q + .05, w0, w1, o.surface || 'concrete'); } }
    if (merl) { for (let u = u0 + gapW / 2; u + merl <= u1; u += merl + gapW) { const b = top(u + merl / 2), mH = o.merlonH ?? .72, v = merl / 2, um = u + v, seg = 6, poly = [[u, b], [u + merl, b], [u + merl, b + mH - v * .7]]; for (let q = 1; q < seg; q++) { const f = Math.PI * q / seg; poly.push([um + Math.cos(f) * v, b + mH - v * .7 + Math.sin(f) * v * .7]); } poly.push([u, b + mH - v * .7]); this.begin(m); this.tint(.92); EXT(ax, poly, w0 + .02, w1 - .02); this.end(); if (o.col !== false) this.wcol(ax, u, u + merl, b, b + mH, w0, w1, o.surface || 'concrete'); } }
  }

  /* ---------- OUVERTURES ---------- */
  /** Fenêtre : encadrement, appui, tableau sombre, volets. side s : vers l'extérieur. */
  window(ax, c, s, uc, y, w, h, o = {}) {
    const e = c + s * .012, ua = uc - w / 2, ub = uc + w / 2, top = y + h, fr = .1, pointed = !!o.arched;
    this.begin('ar_dark'); this.tint(o.lit ? 1.5 : .42, o.lit ? 1.2 : .46, o.lit ? .8 : .5); WQ(ax, s, ua, y, e, ub, y, e, ub, top, e, ua, top, e); if (o.mull) { const em = c + s * .02, mw = .035; this.tint(.62, .56, .5); WQ(ax, s, uc - mw, y, em, uc + mw, y, em, uc + mw, top, em, uc - mw, top, em); const ym = y + (top - y) * (o.mull > 1 ? .62 : .5); WQ(ax, s, ua, ym - mw, em, ub, ym - mw, em, ub, ym + mw, em, ua, ym + mw, em); } if (o.shutter !== false) { const c0 = o.col || [.42, .5, .46], op0 = o.open ?? this.r() < .7; o = { ...o, open: op0 }; this.tint(c0[0] * .72, c0[1] * .72, c0[2] * .72); const hw0 = w / 2 + .01, e2 = c + s * .03; for (const sd of [-1, 1]) { const q = op0 ? (sd < 0 ? ua - fr - .015 - hw0 : ub + fr + .015) : (sd < 0 ? uc - hw0 : uc); WQ(ax, s, q, y, e2, q + hw0, y, e2, q + hw0, top, e2, q, top, e2); } } this.end();
    { this.begin(o.fm || 'ar_ashlar'); this.tint(...(o.fm ? [.62, .5, .38] : [.93, .92, .89])); const ef = c + s * .006, F4 = (u0, u1, y0, y1) => WQ(ax, s, u0, y0, ef, u1, y0, ef, u1, y1, ef, u0, y1, ef); F4(ua - fr, ua, y - .02, top + .02); F4(ub, ub + fr, y - .02, top + .02); F4(ua - fr - .06, ub + fr + .06, y - .1, y - .015); if (!pointed) F4(ua - fr - .03, ub + fr + .03, top + .015, top + .17); this.end(); }
    this.begin(o.fm || 'ar_ashlar'); this.stoneTint(.9, 1.04); if (o.fm) this.tint(.6, .48, .36); const d0 = c - s * .02, d1 = c + s * .07, wa = Math.min(d0, d1), wb = Math.max(d0, d1);
    WF(ax, s, ua - fr, ua, y - .02, top + .02, wa, wb, .006, this.r, false, true); WF(ax, s, ub, ub + fr, y - .02, top + .02, wa, wb, .006, this.r, false, true); this.stoneTint(.92, 1.06);
    WF(ax, s, ua - fr - .06, ub + fr + .06, y - .1, y - .015, Math.min(c - s * .02, c + s * .066), Math.max(c - s * .02, c + s * .066), .004, this.r, true);
    if (pointed) { const n = 5; for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, a = Arch.curve(t0, ua - fr, ub + fr, top + .02, w * .3, false), b = Arch.curve(t1, ua - fr, ub + fr, top + .02, w * .3, false); this.stoneTint(.88, 1.04); EXT(ax, [[a[0], a[1]], [b[0], b[1]], [b[0], b[1] + .13], [a[0], a[1] + .13]], wa, wb); } }
    else { this.stoneTint(.9, 1.06); WF(ax, s, ua - fr - .03, ub + fr + .03, top + .015, top + .17, wa, wb, .008, this.r, true); }
    this.end(true);
    if (o.shutter !== false) {
      const col = o.col || [.42, .5, .46], open = o.open ?? this.r() < .7; this.begin('ar_wood'); this.tint(col[0], col[1], col[2]);
      for (const sd of [-1, 1]) { const hw = w / 2 + .01, q = open ? (sd < 0 ? ua - fr - .015 - hw : ub + fr + .015) : (sd < 0 ? uc - hw : uc), d0 = open ? .035 : .02, d1 = open ? .062 : .05, wa2 = Math.min(c + s * d0, c + s * d1), wb2 = Math.max(c + s * d0, c + s * d1); WF(ax, s, q, q + hw, y, top, wa2, wb2, 0, null); }
      this.end(true);
    }
    if (o.planter) this.sillPlanter(ax, c, s, uc, y, w);
  }
  sillPlanter(ax, c, s, uc, y, w) {
    this.begin('ar_plaster'); this.tint(.72, .42, .3); WB(ax, uc - w / 2, uc + w / 2, y - .02, y + .15, Math.min(c + s * .1, c + s * .3), Math.max(c + s * .1, c + s * .3), .006, this.r); this.end(true);
    this.begin('ar_plant'); for (let i = 0; i < 5; i++) { const u = uc - w / 2 + this.rnd(.05, w - .05), q = c + s * this.rnd(.12, .34), yy = y + this.rnd(.13, .34), r = this.rnd(.08, .15), g = this.rnd(.32, .6); this.tint(this.r() < .28 ? .95 : .24, this.r() < .28 ? .42 : g, this.r() < .28 ? .5 : .16); pt(ax, u, q); BLOB(_x, yy, _z, r, r * .72, this.r); } this.end(true);
  }
  /** Porte en bois cloutée dans son tableau. */
  doorLeaf(ax, c, s, ua, ub, y0, y1, o = {}) {
    const col = o.col || [.62, .46, .32], n = Math.max(3, Math.round((ub - ua) / .24)), w = c - s * .08; this.begin('ar_wood');
    for (let i = 0; i < n; i++) { const v = this.rnd(.82, 1.08); this.tint(col[0] * v, col[1] * v, col[2] * v); WF(ax, s, ua + (ub - ua) * i / n + .004, ua + (ub - ua) * (i + 1) / n - .004, y0, y1, Math.min(w, w + s * .03), Math.max(w, w + s * .03), .002, this.r); }
    this.tint(.28, .22, .16); for (const f of [.2, .78]) WB(ax, ua + .02, ub - .02, y0 + (y1 - y0) * f, y0 + (y1 - y0) * f + .08, Math.min(w, w + s * .02), Math.max(w, w + s * .02), 0, null); this.end();
  }
  /** Balcon en fer forgé sur consoles de pierre. */
  balcony(ax, c, s, ua, ub, y, o = {}) {
    const dp = o.d ?? .85, o0 = Math.min(c, c + s * dp), o1 = Math.max(c, c + s * dp); this.begin(o.m || 'ar_ashlar'); this.stoneTint(.88, 1); WB(ax, ua, ub, y - .1, y, o0, o1, .008, this.r);
    for (let q = ua + .15; q < ub; q += Math.max(.6, (ub - ua - .3) / Math.max(1, Math.round((ub - ua - .3) / .9)))) { this.stoneTint(.8, .95); EXT(ax === 'x' ? 'z' : 'x', [[c, y - .1], [c + s * dp * .85, y - .1], [c, y - .46]], q - .07, q + .07); } this.end(true);
    this.begin(o.rail || 'ar_iron'); this.tint(.42, .42, .44); const H = o.h ?? .96, rail = (a, ba, b, bb) => { pt(ax, a, ba); const x0 = _x, z0 = _z; pt(ax, b, bb); ROD(x0, y + H, z0, _x, y + H, _z, .024, 4); ROD(x0, y + .1, z0, _x, y + .1, _z, .014, 3); };
    const f = c + s * (dp - .03); rail(ua + .02, f, ub - .02, f); rail(ua + .02, c, ua + .02, f); rail(ub - .02, c, ub - .02, f);
    const bal = (a, b) => { pt(ax, a, b); ROD(_x, y, _z, _x, y + H, _z, .011, 3); }; const nB = Math.round((ub - ua) / .2);
    for (let i = 0; i <= nB; i++) bal(ua + .02 + (ub - ua - .04) * i / nB, f); for (let i = 1; i < 4; i++) { bal(ua + .02, c + s * (dp - .03) * i / 4); bal(ub - .02, c + s * (dp - .03) * i / 4); } this.end(true);
  }

  /* ---------- ESCALIERS ---------- */
  /** Volée droite réelle : marches de pierre à nez arrondi, usées au centre, joints, contremarches. dir : 'x+','x-','z+','z-' (sens de montée). Renvoie la longueur. */
  stairs(x, z, w, dir, y0, y1, o = {}) {
    const tread = o.tread ?? .42, maxR = o.rise ?? .24, n = Math.max(1, Math.ceil((y1 - y0) / maxR - 1e-6)), r = (y1 - y0) / n, sg = dir[1] === '+' ? 1 : -1, ax = dir[0] === 'x' ? 'x' : 'z', m = o.m || 'ar_ashlar', hw = w / 2, s = o.surface || 'concrete';
    this.k.rises.push(r);
    const nos = .03, wear = o.wear ?? .018, along = ax === 'x' ? z : x, at = ax === 'x' ? x : z;
    for (let i = 0; i < n; i++) {
      const p0 = at + sg * i * tread, p1 = at + sg * (i + 1) * tread, lo = Math.min(p0, p1), hi = Math.max(p0, p1), top = y0 + r * (i + 1);
      ax === 'x' ? this.col(lo, hi, y0, top, along - hw, along + hw, s) : this.col(along - hw, along + hw, y0, top, lo, hi, s);
      this.begin(m); const stones = Math.max(1, Math.round(w / this.rnd(1.1, 1.9))), wn = w / stones;
      for (let q = 0; q < stones; q++) {
        const c0 = along - hw + wn * q, c1 = along - hw + wn * (q + 1), tone = this.rnd(.84, 1.04), edge = sg > 0 ? p0 - sg * nos : p0 - sg * nos, back = p1, yb = top - r - .06; this.tint(tone * 1.01, tone, tone * .97);
        /* contremarche (retrait sous le nez) + nez + giron en 3 bandes usées au centre */
        const cm = (t) => c0 + (c1 - c0) * t, dip = (t) => top - wear * Math.sin(Math.PI * clamp(((c0 + (c1 - c0) * t) - (along - hw)) / w, 0, 1)) * (.7 + .6 * noise2(i * .7, q));
        const P3 = (a, h, c) => (ax === 'x' ? [a, h, c] : [c, h, a]), QQ = (A, B, C, D) => { const f = (ax === 'x') === (sg > 0); if (f) Q(...A, ...B, ...C, ...D); else Q(...B, ...A, ...D, ...C); };
        const NS = 2; for (let k = 0; k < NS; k++) { const t0 = k / NS, t1 = (k + 1) / NS, d0 = dip(t0), d1 = dip(t1);
          QQ(P3(edge, d0 - .028, cm(t0)), P3(edge, d1 - .028, cm(t1)), P3(edge + sg * .018, d1 - .004, cm(t1)), P3(edge + sg * .018, d0 - .004, cm(t0)));      /* nez arrondi */
          QQ(P3(edge + sg * .018, d0 - .004, cm(t0)), P3(edge + sg * .018, d1 - .004, cm(t1)), P3(edge + sg * tread * .4, d1, cm(t1)), P3(edge + sg * tread * .4, d0, cm(t0)));
          QQ(P3(edge + sg * tread * .4, d0, cm(t0)), P3(edge + sg * tread * .4, d1, cm(t1)), P3(back + sg * .004, top, cm(t1)), P3(back + sg * .004, top, cm(t0))); }
        QQ(P3(edge + sg * .012, yb, cm(0)), P3(edge + sg * .012, yb, cm(1)), P3(edge, top - .03, cm(1)), P3(edge, top - .03, cm(0)));      /* contremarche */
      }
      this.tint(.8); for (const sd of [-1, 1]) { const c = along + sd * (hw + .004); if (ax === 'x') BX(lo, hi, y0, top, Math.min(c, c + sd * .012), Math.max(c, c + sd * .012), 0, 'yY'); else BX(Math.min(c, c + sd * .012), Math.max(c, c + sd * .012), y0, top, lo, hi, 0, 'yY'); }
      if (i === n - 1) { const e = p1 + sg * .004; if (ax === 'x') BX(Math.min(e, e + sg * .012), Math.max(e, e + sg * .012), y0, top, along - hw, along + hw, 0, 'yY'); else BX(along - hw, along + hw, y0, top, Math.min(e, e + sg * .012), Math.max(e, e + sg * .012), 0, 'yY'); }
      this.end();
    }
    if (o.walls !== false) { const L = n * tread, hb = o.wallH ?? 1.05; for (const sd of (o.sides || [-1, 1])) { const c = along + sd * (hw + .1);      /* mur d'échiffre rampant + chaperon */
      const a0 = at, a1 = at + sg * L, slope = (u) => y0 + (y1 - y0) * clamp((u - a0) / (a1 - a0), 0, 1); this.begin('ar_rubble'); this.tint(.92); const nS = Math.max(2, Math.round(L / .7));
      for (let i = 0; i < nS; i++) { const q0 = a0 + (a1 - a0) * i / nS, q1 = a0 + (a1 - a0) * (i + 1) / nS, h0 = slope(q0) + hb, h1 = slope(q1) + hb, lo = Math.min(q0, q1), hi = Math.max(q0, q1), hl = q0 < q1 ? h0 : h1, hr = q0 < q1 ? h1 : h0;
        EXT(ax === 'x' ? 'x' : 'z', [[lo, y0 - .05], [hi, y0 - .05], [hi, hr], [lo, hl]], c - .11, c + .11); } this.end();
      this.begin('ar_ashlar'); for (let i = 0; i < nS; i++) { const q0 = a0 + (a1 - a0) * i / nS, q1 = a0 + (a1 - a0) * (i + 1) / nS, h0 = slope(q0) + hb, h1 = slope(q1) + hb, lo = Math.min(q0, q1), hi = Math.max(q0, q1), hl = q0 < q1 ? h0 : h1, hr = q0 < q1 ? h1 : h0; this.stoneTint(.9, 1.05); EXT(ax === 'x' ? 'x' : 'z', [[lo, hl], [hi, hr], [hi, hr + .07], [lo, hl + .07]], c - .15, c + .15); } this.end(true);
      /* collision du mur : marches du mur rampant */
      for (let i = 0; i < n; i++) { const q0 = at + sg * i * tread, q1 = at + sg * (i + 1) * tread, top = y0 + r * (i + 1) + hb + .07, lo = Math.min(q0, q1), hi = Math.max(q0, q1); ax === 'x' ? this.col(lo, hi, y0, top, c - .15, c + .15, s) : this.col(c - .15, c + .15, y0, top, lo, hi, s); } } }
    if (o.newel) { const rS = this.r; this.r = () => .5; for (const sd of o.newel) { const pa = at + sg * tread * .55, pc = along + sd * (hw + .17); ax === 'x' ? this.column(pa, pc, y0, y0 + .98, .13, { seg: 10 }) : this.column(pc, pa, y0, y0 + .98, .13, { seg: 10 }); } this.r = rS; }
    if (o.rail) this.handrail(ax, at, sg, n * tread, along + o.rail * (hw - .07), y0, y1);
    return n * tread;
  }
  /** Main courante en fer sur potelets, suit la pente. */
  handrail(ax, at, sg, L, c, y0, y1, H = .92) {
    this.begin('ar_iron'); this.tint(.4, .4, .42); const pts = Math.max(2, Math.round(L / .9)), P3 = (a, y) => (ax === 'x' ? [a, y, c] : [c, y, a]);
    for (let i = 0; i <= pts; i++) { const t = i / pts, a = at + sg * L * t, y = y0 + (y1 - y0) * t, [x, , z] = P3(a, y); ROD(x, y, z, x, y + H, z, .017, 4); if (i < pts) { const b = at + sg * L * (i + 1) / pts, y2 = y0 + (y1 - y0) * (i + 1) / pts, [x2, , z2] = P3(b, y2); ROD(x, y + H, z, x2, y2 + H, z2, .024, 5); } }
    this.end(true);
    { const n = Math.max(1, Math.ceil(L / .42)); for (let i = 0; i < n; i++) { const a = at + sg * L * i / n, b = at + sg * L * (i + 1) / n, top = y0 + (y1 - y0) * (i + 1) / n + H + .03, lo = Math.min(a, b), hi = Math.max(a, b); if (ax === 'x') this.k.col(lo, hi, y0 + (y1 - y0) * i / n, top, c - .03, c + .03, 'metal'); else this.k.col(c - .03, c + .03, y0 + (y1 - y0) * i / n, top, lo, hi, 'metal'); } }
  }
  /** Palier dallé (collision incluse). */
  landing(x0, x1, z0, z1, y, o = {}) {
    if (o.col !== false) this.col(x0, x1, o.y0 ?? y - .4, y, z0, z1, 'concrete');
    this.begin(o.m || 'ar_ashlar'); const nx = Math.max(1, Math.round((x1 - x0) / .62)), nz = Math.max(1, Math.round((z1 - z0) / .62));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { this.stoneTint(.82, 1.02); const a = x0 + (x1 - x0) * i / nx, b = x0 + (x1 - x0) * (i + 1) / nx, c = z0 + (z1 - z0) * j / nz, d = z0 + (z1 - z0) * (j + 1) / nz, h = y - this.rnd(0, .006); Q(a, h, d, b, h, d, b, h, c, a, h, c); }
    if (o.y0 !== undefined) { this.tint(.78); BX(x0, x1, o.y0, y - .004, z0, z1, 0, o.y0 > .01 ? 'Y' : 'yY'); }   /* palier en hauteur : dessous dessiné (on le voit d'en bas) */
    this.end();
  }
  /** Escalier à vis : marches rayonnantes autour d'un noyau, mur tambour, collisions en petites boîtes (hauteur de marche .16 max). */
  spiral(cx, cz, R, r0, y0, y1, o = {}) {
    const stepsTurn = o.perTurn || 16, rise = o.rise ?? .155, n = Math.ceil((y1 - y0) / rise), h = (y1 - y0) / n, a0 = o.a0 ?? 0, dirA = o.ccw === false ? -1 : 1, da = dirA * TAU / stepsTurn; this.k.rises.push(h);
    for (let i = 0; i < n; i++) {
      const a = a0 + da * i, b = a + da, top = y0 + h * (i + 1), c0 = Math.cos(a), s0 = Math.sin(a), c1 = Math.cos(b), s1 = Math.sin(b), v = this.rnd(.84, 1.04);
      this.begin('ar_ashlar'); this.tint(v * 1.01, v, v * .97); const ri = r0 * .8, Ro = R + .05, poly = [[cx + c0 * ri, cz + s0 * ri], [cx + c0 * Ro, cz + s0 * Ro], [cx + (c0 + c1) / 2 * Ro * 1.04, cz + (s0 + s1) / 2 * Ro * 1.04], [cx + c1 * Ro, cz + s1 * Ro], [cx + c1 * ri, cz + s1 * ri]]; PRISM(poly, top - .08, top); this.end();
    }
    /* collision : carreaux de 20 cm, chaque carreau porte exactement la marche de son angle (aucune boîte ne déborde sur la marche voisine), fusion par rangée */
    { const cs = .2, nC = Math.ceil((R + .02) / cs), byStep = new Map(), step = Math.abs(da);
      for (let j = -nC; j < nC; j++) for (let i = -nC; i < nC; i++) { const px = (i + .5) * cs, pz = (j + .5) * cs, rr = Math.hypot(px, pz); if (rr < r0 - .02 || rr > R + .02) continue; let t = (Math.atan2(pz, px) - a0) * dirA; t = ((t % TAU) + TAU) % TAU; for (let q = Math.floor(t / step); q < n; q += stepsTurn) { const key = q * 100000 + j + nC; let l = byStep.get(key); if (!l) byStep.set(key, l = []); l.push(i); } }
      for (const [key, l] of byStep) { const q = Math.floor(key / 100000), jj = key % 100000 - nC, top = y0 + h * (q + 1); l.sort((p, w) => p - w); let s0 = l[0], p = l[0]; for (let m = 1; m <= l.length; m++) { if (m < l.length && l[m] === p + 1) { p = l[m]; continue; } this.k.col(cx + s0 * cs, cx + (p + 1) * cs, Math.max(y0, top - .08), top, cz + jj * cs, cz + (jj + 1) * cs, 'concrete'); if (m < l.length) { s0 = l[m]; p = l[m]; } } } }
    /* joue basse au pied : la deuxième marche ne se monte pas directement depuis le sol */
    if (o.foot) { const a = a0 + da, b = a + da * 1.6, topF = y0 + h * 2 + .18, Ri = R + .05, Re = R + .22, na = 5, rm = (Ri + Re) / 2; this.begin('ar_ashlar'); this.tint(.92, .9, .86); for (let q = 0; q < na; q++) { const t0 = a + (b - a) * q / na, t1 = a + (b - a) * (q + 1) / na; PRISM([[cx + Math.cos(t0) * Ri, cz + Math.sin(t0) * Ri], [cx + Math.cos(t0) * Re, cz + Math.sin(t0) * Re], [cx + Math.cos(t1) * Re, cz + Math.sin(t1) * Re], [cx + Math.cos(t1) * Ri, cz + Math.sin(t1) * Ri]], y0, topF); } this.end(); const nb = Math.ceil(Math.abs(b - a) * rm / .16); for (let q = 0; q <= nb; q++) { const t = a + (b - a) * q / nb, x = cx + Math.cos(t) * rm, z = cz + Math.sin(t) * rm; this.k.col(x - .09, x + .09, y0, topF, z - .09, z + .09, 'concrete'); } }
    /* noyau central */
    this.begin('ar_ashlar'); for (let y = y0; y < y1 + .6; y += .42) { this.stoneTint(.82, 1); const nP = 10, pol = []; for (let i = 0; i < nP; i++) pol.push([cx + Math.cos(i / nP * TAU) * r0, cz + Math.sin(i / nP * TAU) * r0]); PRISM(pol, y, Math.min(y + .4, y1 + .6)); } this.end();
    this.k.disc(cx, cz, r0, y0, y1 + .6, 'concrete');
    return n;
  }

  /* ---------- TOITS ---------- */
  /** Toit à deux pans (faîtage selon ridge) : tuiles courbes en relief aux bords, faîtières rondes, débord, chevrons. Collisions en gradins. */
  roof(x0, x1, z0, z1, y, ridge, o = {}) {
    const over = o.over ?? .34, pitch = o.pitch ?? .42, along = ridge === 'x', a0 = (along ? x0 : z0) - .02, a1 = (along ? x1 : z1) + .02, c0 = along ? z0 : x0, c1 = along ? z1 : x1, cm = (c0 + c1) / 2, hw = (c1 - c0) / 2, half = hw + over, rH = hw * pitch, top = y + rH, ax = along ? 'x' : 'z', axC = along ? 'z' : 'x';
    const m = o.m || 'ar_tile', tiled = m === 'ar_tile', tin = m === 'ar_tin', gab = o.gable !== false, sag = o.sag ?? (tin ? .012 : .03), og = over * .6, U0 = a0 - og, U1 = a1 + og, th = o.th ?? (tin ? .07 : tiled ? .14 : .12);
    const Y = (c) => y + rH * (1 - Math.abs(c - cm) / hw), PP = (u, h, w) => (ax === 'x' ? [u, h, w] : [w, h, u]), H = (u, w, sd) => Y(w) + noise2((u + w) * 1.7, sd * 3 + a0) * sag - .01 * Math.sin(u * 3) * Math.min(1, Math.abs(w - cm) / .6);
    const BU = (u0, u1, h0, h1, w0, w1) => { const wa = Math.min(w0, w1), wb = Math.max(w0, w1); if (along) BX(u0, u1, h0, h1, wa, wb); else BX(wa, wb, h0, h1, u0, u1); };
    const QF = (p, q, r, s, dn) => { const ny = (r[2] - p[2]) * (s[0] - q[0]) - (r[0] - p[0]) * (s[2] - q[2]); if ((ny < 0) === dn) Q(...p, ...q, ...r, ...s); else Q(...p, ...s, ...r, ...q); };
    /* couverture : pans continus d'un pignon à l'autre (aucun recouvrement coplanaire), nuance par panneau, tranche visible à l'égout */
    this.begin(m); const tone = o.tone ?? this.rnd(.84, 1.1), nU = Math.max(3, Math.round((U1 - U0) / 1.4)), courses = Math.max(3, Math.round(half / .62)), uA = j => U0 + (U1 - U0) * j / nU;
    for (const sd of [-1, 1]) for (let i = 0; i < courses; i++) { const w0 = cm + sd * i / courses * half, w1 = cm + sd * (i + 1) / courses * half;
      for (let j = 0; j < nU; j++) { const u0 = uA(j), u1 = uA(j + 1), v = tone * (.86 + .22 * noise2(j * 1.3 + a0, i * 1.1 + sd)); tr = v; tg = v * .97; tb = v * .92;
        const A = PP(u0, H(u0, w0, sd), w0), B = PP(u1, H(u1, w0, sd), w0), C2 = PP(u1, H(u1, w1, sd), w1), D = PP(u0, H(u0, w1, sd), w1); if ((sd > 0) === (ax === 'x')) Q(...A, ...D, ...C2, ...B); else Q(...A, ...B, ...C2, ...D); } }
    const eb = th; tr = tg = tb = tone * .6; for (const sd of [-1, 1]) { const we = cm + sd * half; for (let j = 0; j < nU; j++) { const u0 = uA(j), u1 = uA(j + 1), ha = H(u0, we, sd), hb = H(u1, we, sd); WQ(ax, sd, u0, ha - eb, we, u1, hb - eb, we, u1, hb, we, u0, ha, we); } }
    this.end();
    /* rang d'égout et faîtage en tuiles rondes réelles (toits de tuiles) ; tôle et bardeaux : faîtière en V */
    const tileRow = (w, h, n, r = .082) => { for (let k = 0; k < n; k++) { const u = a0 + (a1 - a0) * (k + .5) / n, l = (a1 - a0) / n * .53, v = tone * this.rnd(.82, 1.1); tr = v; tg = v * .96; tb = v * .9; const seg = 3, jit = this.rnd(-.012, .012); for (let q = 0; q < seg; q++) { const b0 = Math.PI * q / seg, b1 = Math.PI * (q + 1) / seg, c00 = Math.cos(b0) * r, s00 = Math.sin(b0) * r, c10 = Math.cos(b1) * r, s10 = Math.sin(b1) * r; const AA = PP(u - l, h + s00 + jit, w + c00), BB = PP(u + l, h + s00 + jit, w + c00), CC = PP(u + l, h + s10 + jit, w + c10), DD = PP(u - l, h + s10 + jit, w + c10); if (ax === 'x') Q(...AA, ...BB, ...CC, ...DD); else Q(...AA, ...DD, ...CC, ...BB); } } };
    const nTile = Math.max(3, Math.round((a1 - a0) / .62));
    if (tiled) { this.begin(m); tileRow(cm, top + .02, nTile, .1); for (const sd of [-1, 1]) tileRow(cm + sd * half, Y(cm + sd * half) - .005, nTile, .07); this.end(true); }
    else { for (let k = 0; k < nTile * 6; k++) this.r();
      const bz = sag + .006, rw = .2; this.begin(tin ? m : 'ar_wood'); if (tin) this.tint(tone * .74); else this.tint(.42, .34, .27);
      EXT(axC, [[cm, top + bz + .065], [cm + rw, Y(cm + rw) + bz + .03], [cm + rw, Y(cm + rw) + bz], [cm, top + bz + .035], [cm - rw, Y(cm - rw) + bz], [cm - rw, Y(cm - rw) + bz + .03]], U0 - .03, U1 + .03); this.end(); }
    /* sous-face des débords (et des combles ouverts) */
    { const ue = U0 + (!gab ? 0 : tin ? .03 : .045), uf = U1 - (!gab ? 0 : tin ? .03 : .045); this.begin(tin ? m : tiled ? 'ar_wood' : 'ar_plank'); if (tin) this.tint(tone * .5); else this.tint(.5, .42, .35);
      for (const sd of [-1, 1]) for (const [wa, wb] of [[cm, cm + sd * hw], [cm + sd * hw, cm + sd * (half - (tin ? .005 : .03))]]) QF(PP(ue, Y(wa) - th, wa), PP(uf, Y(wa) - th, wa), PP(uf, Y(wb) - th, wb), PP(ue, Y(wb) - th, wb), true);
      this.end(); }
    /* planches d'égout et de rive (tôle : bandeau en retrait sous la tôle, rive pliée) */
    this.begin(tiled ? (o.gm || 'ar_plaster') : 'ar_wood'); if (tiled) this.tint((o.gt ?? .95) * .9); else this.tint(.47, .38, .3);
    if (gab) for (const sd of [-1, 1]) { if (tin) { const wf = cm + sd * (half - .1), yf = Y(wf) - th; BU(U0 + .045, U1 - .045, yf - .14, yf + .01, wf, wf + sd * .04); } else { const we = cm + sd * half, ye = Y(we); BU(U0, U1, ye - th - .12, ye + .035, we - sd * .035, we + sd * .012); } }
    if (!tin && gab) for (const [ua, ub] of [[U0, U0 + .045], [U1 - .045, U1]]) for (const sd of [-1, 1]) { const we = cm + sd * half; EXT(axC, [[cm, top + .04], [we, Y(we) + .04], [we, Y(we) - th - .1], [cm, top - th - .1]], ua, ub); }
    this.end();
    if (!gab) { this.begin(m); tr = tg = tb = tone * .6; for (const [ue, dir] of [[U0, -1], [U1, 1]]) for (const sd of [-1, 1]) { const we = cm + sd * half, p1 = PP(ue, H(ue, cm, sd), cm), p2 = PP(ue, H(ue, we, sd), we), p3 = PP(ue, Y(we) - th, we), p4 = PP(ue, top - th, cm), du = along ? 0 : 2, nu = (p3[(du + 1) % 3 === 1 ? 2 : 1] - p1[(du + 1) % 3 === 1 ? 2 : 1]) * 0; void nu; const ux = p3[0] - p1[0], uy = p3[1] - p1[1], uz = p3[2] - p1[2], vx = p4[0] - p2[0], vy = p4[1] - p2[1], vz = p4[2] - p2[2], n = along ? uy * vz - uz * vy : ux * vy - uy * vx; if ((n > 0) === (dir > 0)) Q(...p1, ...p2, ...p3, ...p4); else Q(...p1, ...p4, ...p3, ...p2); } this.end(); }
    if (tin && gab) { this.begin(m); this.tint(tone * .66); for (const [ua, ub] of [[U0, U0 + .03], [U1 - .03, U1]]) for (const sd of [-1, 1]) { const we = cm + sd * half; EXT(axC, [[cm, top + sag + .03], [we, Y(we) + sag + .03], [we, Y(we) - th - .03], [cm, top - th - .03]], ua, ub); } this.end(); }
    /* pignons coupés sous le voligeage, cordon au pied du pignon */
    if (gab) { const gm = o.gm || 'ar_plaster'; this.begin(gm); this.tint(o.gt ?? .95); for (const e of [a0 + .02, a1 - .02]) EXT(axC, [[c0, y - th], [c1, y - th], [cm, top - th * .45]], e - .04, e + .04); this.end();
      this.begin(tiled ? gm : 'ar_wood'); if (tiled) this.tint((o.gt ?? .95) * .86); else this.tint(.47, .38, .3); for (const e of [a0 + .02, a1 - .02]) BU(e - .07, e + .07, y - th - .13, y - th + .03, c0 - .03, c1 + .03); this.end(); }
    /* chevrons (suivent la pente, du mur au bandeau) et pannes saillantes sous les rives */
    this.begin('ar_wood'); this.tint(.6, .46, .34); const nR = Math.max(2, Math.round((a1 - a0) / 1.7));
    for (let i = 0; i <= nR; i++) { const u = a0 + .1 + (a1 - a0 - .2) * i / nR; for (const sd of [-1, 1]) { const wi = cm + sd * (hw - .05), wf = cm + sd * (half - (tin ? .1 : .035)); EXT(axC, [[wi, Y(wi) - th + .02], [wf, Y(wf) - th + .02], [wf, Y(wf) - th - .11], [wi, Y(wi) - th - .11]], u - .045, u + .045); } }
    if (gab && og > .12) { this.tint(.52, .4, .3); for (const [ua, ub] of [[U0 + .045, a0 - .02], [a1 + .02, U1 - .045]]) for (const c of [cm, cm - hw * .55, cm + hw * .55]) { const yt = Y(c) - th; BU(ua, ub, yt - .13, yt + .05, c - .055, c + .055); } }
    this.end(true);
    if (o.col !== false) { const layers = Math.max(2, Math.floor(rH / .36)); for (let l = 0; l < layers; l++) { const f0 = l / layers, f1 = (l + 1) / layers, inset = ((c1 - c0) / 2) * f0, a = c0 + inset, b = c1 - inset, yA = y + rH * f0, yB = y + rH * f1; if (b - a < .1) break; const q = along ? this.col(x0, x1, yA, yB, a, b, 'concrete') : this.col(a, b, yA, yB, z0, z1, 'concrete'); if (q) { q.pa = along ? 'z' : 'x'; q.pr = Math.max(0, Math.min((b - a) / 2 - .05, ((c1 - c0) / 2) * (f1 - f0))); } } }
    return top;
  }
  /** Cheminée maçonnée avec chapeau de tuiles, hauteur au-dessus du toit. */
  chimney(x, z, y0, y1, w = .62) {
    this.begin('ar_plaster'); this.tint(this.rnd(.82, 1)); BX(x - w / 2, x + w / 2, y0, y1, z - w / 2, z + w / 2, .012, 'y', this.r); this.end();
    this.begin('ar_ashlar'); this.tint(.84); BX(x - w / 2 - .05, x + w / 2 + .05, y1, y1 + .07, z - w / 2 - .05, z + w / 2 + .05, .006, '', this.r); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) BX(x + a * w * .32 - .06, x + a * w * .32 + .06, y1 + .07, y1 + .22, z + b * w * .32 - .06, z + b * w * .32 + .06); this.end(true);
    this.begin('ar_tile'); this.tint(.9, .82, .74); const p = w / 2 + .1; Q(x - p, y1 + .22, z + p, x + p, y1 + .22, z + p, x, y1 + .4, z, x, y1 + .4, z); Q(x + p, y1 + .22, z - p, x - p, y1 + .22, z - p, x, y1 + .4, z, x, y1 + .4, z); Q(x + p, y1 + .22, z + p, x + p, y1 + .22, z - p, x, y1 + .4, z, x, y1 + .4, z); Q(x - p, y1 + .22, z - p, x - p, y1 + .22, z + p, x, y1 + .4, z, x, y1 + .4, z); this.end(true);
  }

  /** Anneau de collines lointaines : relief continu, f(angle, rayon) = hauteur, c(angle, rayon, hauteur, out) = couleur. */
  hills(r0, r1, na, nr, f, c) {
    this.begin('ar_hill'); const q = [0, 0, 0], P3 = (i, j) => { const a = i / na * TAU, r = r0 + (r1 - r0) * Math.pow(j / nr, 1.35); return [Math.cos(a) * r, f(a, r), Math.sin(a) * r, a, r]; };
    const G2 = []; for (let i = 0; i <= na; i++) { const row = []; for (let j = 0; j <= nr; j++) row.push(P3(i % na, j)); G2.push(row); } const b0 = P.length / 3;
    for (let i = 0; i <= na; i++) for (let j = 0; j <= nr; j++) { const p = G2[i][j], pa = G2[(i + 1) % (na + 1) === 0 ? 1 : i + 1][j], pb = G2[i === 0 ? na - 1 : i - 1][j], pc = G2[i][Math.min(nr, j + 1)], pd = G2[i][Math.max(0, j - 1)];
      const ux = pa[0] - pb[0], uy = pa[1] - pb[1], uz = pa[2] - pb[2], vx = pc[0] - pd[0], vy = pc[1] - pd[1], vz = pc[2] - pd[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; } const l = Math.hypot(nx, ny, nz) || 1;
      c(p[3], p[4], p[1], q); tr = q[0]; tg = q[1]; tb = q[2]; V(p[0], p[1], p[2], nx / l, ny / l, nz / l); }
    for (let i = 0; i < na; i++) for (let j = 0; j < nr; j++) { const a = b0 + i * (nr + 1) + j, b = a + nr + 1; I.push(a, b, b + 1, a, b + 1, a + 1); }
    const bake = this.bake; this.bake = null; this.end(); this.bake = bake; const op = this.k.ops[this.k.ops.length - 1]; if (op) op.ns = 1;
  }

  /* ---------- MOBILIER ET DÉTAILS (rendu seul sauf indication) ---------- */
  drainpipe(x, z, y0, y1) { this.begin('ar_iron'); this.tint(.56, .5, .46); ROD(x, y0 + .08, z, x, y1, z, .05, 6); for (let y = y0 + .9; y < y1; y += 1.55) BX(x - .06, x + .06, y, y + .035, z - .06, z + .06); this.end(true); }
  /** Câble ou corde en chaînette ; tag : linge suspendu. */
  cable(ax, ay, az, bx, by, bz, sag = .4, o = {}) {
    sag = Math.max(sag, Math.hypot(bx - ax, bz - az) * .022); this.begin('ar_iron'); this.tint(.28, .27, .26); for (const [px, py, pz] of [[ax, ay, az], [bx, by, bz]]) BX(px - .03, px + .03, py - .04, py + .03, pz - .03, pz + .03); const n = Math.max(10, Math.round(Math.hypot(bx - ax, bz - az) / 1.5)), at = (t, out) => { out[0] = ax + (bx - ax) * t; out[1] = ay + (by - ay) * t - sag * 4 * t * (1 - t); out[2] = az + (bz - az) * t; }, p = [0, 0, 0], q = [0, 0, 0]; for (let i = 0; i < n; i++) { at(i / n, p); at((i + 1) / n, q); ROD(p[0], p[1], p[2], q[0], q[1], q[2], o.r || .011, 3); } this.end(true);
    if (o.laundry) { this.begin('ar_cloth'); const COL = [[.92, .9, .84], [.8, .34, .28], [.42, .55, .68], [.9, .78, .42], [.86, .86, .88], [.5, .62, .4]]; const nC = Math.max(3, Math.round(Math.hypot(bx - ax, bz - az) / .85)); for (let i = 0; i < nC; i++) { const t = (i + .5 + this.rnd(-.2, .2)) / nC; at(t, p); const c = COL[Math.floor(this.r() * COL.length)], hw = this.rnd(.2, .42), hh = this.rnd(.45, .85), dx = (bx - ax), dz = (bz - az), l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, ph = this.rnd(0, 3); this.tint(c[0], c[1], c[2]); const w = (y, f) => .05 * Math.sin(f * 3 + ph + y * 3); for (let k = 0; k < 3; k++) { const y0 = p[1] - hh * k / 3, y1 = p[1] - hh * (k + 1) / 3, wa = w(y0, 0), wb = w(y0, 1), wc = w(y1, 1), wd = w(y1, 0); const px = -uz, pz = ux; Q(p[0] - ux * hw + px * wd, y1, p[2] - uz * hw + pz * wd, p[0] + ux * hw + px * wc, y1, p[2] + uz * hw + pz * wc, p[0] + ux * hw + px * wb, y0, p[2] + uz * hw + pz * wb, p[0] - ux * hw + px * wa, y0, p[2] - uz * hw + pz * wa); Q(p[0] + ux * hw + px * wc, y1, p[2] + uz * hw + pz * wc, p[0] - ux * hw + px * wd, y1, p[2] - uz * hw + pz * wd, p[0] - ux * hw + px * wa, y0, p[2] - uz * hw + pz * wa, p[0] + ux * hw + px * wb, y0, p[2] + uz * hw + pz * wb); } } this.end(true); }
  }
  /** Auvent de toile rayée, tendu entre un mur et deux perches. */
  awning(ax, c, s, ua, ub, y, o = {}) {
    const dp = o.d ?? 1.5, drop = o.drop ?? .55, n = Math.max(3, Math.round((ub - ua) / .34)), cols = o.cols || [[.82, .32, .24], [.92, .86, .72]]; this.begin('ar_cloth');
    for (let i = 0; i < n; i++) { const a = ua + (ub - ua) * i / n, b = ua + (ub - ua) * (i + 1) / n, cc = cols[i % cols.length], sagE = (u) => .04 * Math.sin((u - ua) / (ub - ua) * Math.PI * Math.max(2, Math.round((ub - ua) / 1.2))); this.tint(cc[0], cc[1], cc[2]);
      for (let k = 0; k < 4; k++) { const t0 = k / 4, t1 = (k + 1) / 4, w0 = c + s * dp * t0, w1 = c + s * dp * t1, h0 = y - drop * t0 - .05 * Math.sin(t0 * Math.PI), h1 = y - drop * t1 - .05 * Math.sin(t1 * Math.PI); WQ(ax, s, a, h1 + sagE(a) * t1, w1, b, h1 + sagE(b) * t1, w1, b, h0 + sagE(b) * t0, w0, a, h0 + sagE(a) * t0, w0); WQ(ax, s, b, h1 + sagE(b) * t1 - .005, w1, a, h1 + sagE(a) * t1 - .005, w1, a, h0 + sagE(a) * t0 - .005, w0, b, h0 + sagE(b) * t0 - .005, w0); }   /* dessous tourné vers le bas (il regardait vers le haut : toile transparente vue d'en dessous) */
      const w1 = c + s * dp, h1 = y - drop - .0; WQ(ax, s, a, h1 - .2 + sagE(a) * .2, w1, b, h1 - .2 + sagE(b) * .2, w1, b, h1 + sagE(b), w1, a, h1 + sagE(a), w1); WQ(ax, -s, a, h1 - .2 + sagE(a) * .2, w1 - s * .005, b, h1 - .2 + sagE(b) * .2, w1 - s * .005, b, h1 + sagE(b), w1 - s * .005, a, h1 + sagE(a), w1 - s * .005); }   /* revers du lambrequin */
    this.end(true);
    if (o.poles !== false) { this.begin('ar_wood'); this.tint(.52, .4, .3); const yb = o.floor ?? y - 2.6; for (const q of [ua + .05, ub - .05]) { pt(ax, q, c + s * dp); ROD(_x, yb, _z, _x, y - drop, _z, .035, 5); if (o.col !== false) this.k.col(_x - .05, _x + .05, yb, y - drop, _z - .05, _z + .05, 'wood'); } this.end(); }
  }
  /** Bac à fleurs au sol (collision). */
  planter(x, z, y, w = .8, d = .42) {
    const h = .42; this.begin('ar_plaster'); this.tint(.74, .48, .36); BX(x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2, .012, 'y', this.r); this.end(); this.col(x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2, 'concrete');
    this.begin('ar_plant'); const n = Math.round(w * 13); for (let i = 0; i < n; i++) { const f = this.r() < .25, r = this.rnd(.06, .15); this.tint(f ? .95 : .24, f ? .36 : this.rnd(.34, .62), f ? .42 : .17); const px = x + this.rnd(-w / 2, w / 2), pz = z + this.rnd(-d / 2, d / 2), py = y + h + this.rnd(-.02, .06); BLOB(px, py, pz, r, r * .6, this.r); } this.end(true);
  }
  /** Jarre de terre cuite (collision). */
  jar(x, z, y, s = 1) {
    const prof = [[.1, 0], [.22, .05], [.3, .26], [.31, .42], [.25, .62], [.13, .74], [.11, .8], [.15, .83]], seg = 9; this.begin('ar_plaster'); this.tint(this.rnd(.68, .78), this.rnd(.4, .5), this.rnd(.27, .33));
    for (let i = 0; i < prof.length - 1; i++) for (let k = 0; k < seg; k++) { const a0 = k / seg * TAU, a1 = (k + 1) / seg * TAU, [r0, h0] = prof[i], [r1, h1] = prof[i + 1]; Q(x + Math.cos(a0) * r0 * s, y + h0 * s, z + Math.sin(a0) * r0 * s, x + Math.cos(a0) * r1 * s, y + h1 * s, z + Math.sin(a0) * r1 * s, x + Math.cos(a1) * r1 * s, y + h1 * s, z + Math.sin(a1) * r1 * s, x + Math.cos(a1) * r0 * s, y + h0 * s, z + Math.sin(a1) * r0 * s); }
    this.end(); this.col(x - .26 * s, x + .26 * s, y, y + .72 * s, z - .26 * s, z + .26 * s, 'concrete');
  }
  /** Tonneau cerclé (collision). */
  cask(x, z, y, r = .36, h = .92) {
    this.begin('ar_wood'); const seg = 12; for (let k = 0; k < seg; k++) { const a0 = k / seg * TAU, a1 = (k + 1) / seg * TAU, v = this.rnd(.74, 1.02); this.tint(v * .78, v * .58, v * .4); const bulge = [.86, 1, 1, .86]; for (let i = 0; i < 3; i++) { const y0 = y + h * i / 3, y1 = y + h * (i + 1) / 3, r0 = r * bulge[i], r1 = r * bulge[i + 1]; Q(x + Math.cos(a0) * r0, y0, z + Math.sin(a0) * r0, x + Math.cos(a0) * r1, y1, z + Math.sin(a0) * r1, x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1, x + Math.cos(a1) * r0, y0, z + Math.sin(a1) * r0); } }
    const lid = []; for (let k = 0; k < seg; k++) lid.push([x + Math.cos(k / seg * TAU) * r * .86, z + Math.sin(k / seg * TAU) * r * .86]); this.tint(.5, .38, .26); PRISM(lid, y + h - .02, y + h); this.end();
    this.begin('ar_iron'); this.tint(.34, .33, .33); for (const f of [.14, .86]) { const yy = y + h * f, rr = r * (f < .5 ? .93 : .93); for (let k = 0; k < seg; k++) { const a0 = k / seg * TAU, a1 = (k + 1) / seg * TAU; Q(x + Math.cos(a0) * rr * 1.03, yy - .025, z + Math.sin(a0) * rr * 1.03, x + Math.cos(a0) * rr * 1.03, yy + .025, z + Math.sin(a0) * rr * 1.03, x + Math.cos(a1) * rr * 1.03, yy + .025, z + Math.sin(a1) * rr * 1.03, x + Math.cos(a1) * rr * 1.03, yy - .025, z + Math.sin(a1) * rr * 1.03); } } this.end(true);
    this.k.disc(x, z, r, y, y + h, 'wood');
  }
  /** Caisse de planches (collision). */
  crate(x, z, y, s = .8, h = s) {
    this.begin('ar_wood'); const v = this.rnd(.8, 1.05); this.tint(v * .82, v * .66, v * .46); BX(x - s / 2, x + s / 2, y, y + h, z - s / 2, z + s / 2, .006, 'y', this.r); this.tint(v * .62, v * .48, v * .33); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) BX(x + a * (s / 2 - .035) - .04, x + a * (s / 2 - .035) + .04, y, y + h + .004, z + b * (s / 2 - .035) - .04, z + b * (s / 2 - .035) + .04); this.end(); this.col(x - s / 2, x + s / 2, y, y + h, z - s / 2, z + s / 2, 'wood');
  }
  /** Étal de marché : plateau, tréteaux, toile, marchandises. ax : direction de la longueur. */
  stall(ax, u, w, y, o = {}) {
    const L = o.L ?? 2.6, D = o.D ?? 1.15, Ht = .86, ua = u - L / 2, ub = u + L / 2, wa = w - D / 2, wb = w + D / 2, m = o.cols || [[.8, .3, .22], [.9, .84, .7]];
    this.begin('ar_wood'); this.tint(.74, .56, .38); WB(ax, ua, ub, y + Ht - .05, y + Ht, wa, wb, .004, this.r); this.tint(.56, .42, .3); for (const q of [ua + .12, ub - .12]) for (const v of [wa + .1, wb - .1]) WB(ax, q - .045, q + .045, y, y + Ht - .05, v - .045, v + .045, 0, null); for (const q of [ua + .12, ub - .12]) { pt(ax, q, wa + .08); const x0 = _x, z0 = _z; pt(ax, q, wa + .08); ROD(x0, y + Ht, z0, _x, y + 2.3, _z, .03, 5); pt(ax, q, wb - .08); const x1 = _x, z1 = _z; ROD(x1, y + Ht, z1, x1, y + 2.05, z1, .03, 5); } this.end();
    this.begin('ar_wood'); this.tint(.46, .35, .25); WB(ax, ua, ub, y, y + Ht - .05, wa, wb, .004, this.r); this.end(); this.wcol(ax, ua, ub, y, y + Ht, wa, wb, 'wood');
    this.begin('ar_cloth'); const nS = Math.max(4, Math.round(L / .32)); for (let i = 0; i < nS; i++) { const a = ua - .08 + (L + .16) * i / nS, b = ua - .08 + (L + .16) * (i + 1) / nS, c = m[i % m.length]; this.tint(c[0], c[1], c[2]); for (let k = 0; k < 3; k++) { const t0 = k / 3, t1 = (k + 1) / 3, W0 = wa - .1 + (D + .2) * t0, W1 = wa - .1 + (D + .2) * t1, sag = t => .05 * Math.sin(t * Math.PI), Y0 = y + 2.3 - .28 * t0 - sag(t0), Y1 = y + 2.3 - .28 * t1 - sag(t1); WQ(ax, 1, b, Y1, W1, a, Y1, W1, a, Y0, W0, b, Y0, W0); WQ(ax, -1, a, Y1 - .004, W1, b, Y1 - .004, W1, b, Y0 - .004, W0, a, Y0 - .004, W0); } const Wf = wb + .1, YE = y + 2.02; WQ(ax, 1, a, YE - .16, Wf, b, YE - .16, Wf, b, YE, Wf, a, YE, Wf); } this.end(true);
    this.begin('ar_plant'); const n = Math.round(L * 7); for (let i = 0; i < n; i++) { const c = [[.86, .5, .18], [.72, .16, .12], [.84, .7, .2], [.42, .56, .2]][Math.floor(this.r() * 4)], r = this.rnd(.05, .09); this.tint(c[0], c[1], c[2]); const q = ua + this.rnd(.1, L - .1), v = wa + this.rnd(.1, D - .1); pt(ax, q, v); BLOB(_x, y + Ht + r * .72, _z, r, r * .8, this.r); } this.end(true);
  }
  /** Poutre apparente en saillie (bout de solive). */
  beam(ax, c, s, u, y, len = .5, t = .15) { this.begin('ar_wood'); this.tint(.56, .42, .3); const w0 = Math.min(c, c + s * len), w1 = Math.max(c, c + s * len); WB(ax, u - t / 2, u + t / 2, y - t / 2, y + t / 2, w0, w1, .012, this.r); this.end(true); }
  /** Lanterne fixée (corps émissif + ferronnerie). */
  lantern(x, y, z) { this.begin('lampA'); BX(x - .06, x + .06, y - .1, y + .08, z - .06, z + .06); this.end(); this.begin('ar_iron'); this.tint(.24, .24, .25); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ROD(x + a * .075, y - .12, z + b * .075, x + a * .075, y + .1, z + b * .075, .007, 3); BX(x - .1, x + .1, y + .1, y + .125, z - .1, z + .1); ROD(x, y + .125, z, x, y + .3, z, .012, 3); this.end(); }
  /** Margelle de puits maçonnée circulaire (collision). */
  wellCurb(cx, cz, y, R, H = .86, w = .34, gap = 0, solid = false) {
    const seg = 18; for (let i = 0; i < seg; i++) { const a0 = i / seg * TAU + gap, a1 = (i + 1) / seg * TAU + gap; this.begin('ar_ashlar'); this.stoneTint(.8, 1.02); const r0 = R, r1 = R + w; PRISM([[cx + Math.cos(a0) * r0, cz + Math.sin(a0) * r0], [cx + Math.cos(a0) * r1, cz + Math.sin(a0) * r1], [cx + Math.cos(a1) * r1, cz + Math.sin(a1) * r1], [cx + Math.cos(a1) * r0, cz + Math.sin(a1) * r0]], y, y + H); this.end(); if (solid) { const xs = [Math.cos(a0) * r0, Math.cos(a0) * r1, Math.cos(a1) * r0, Math.cos(a1) * r1], zs = [Math.sin(a0) * r0, Math.sin(a0) * r1, Math.sin(a1) * r0, Math.sin(a1) * r1]; this.k.col(cx + Math.min(...xs), cx + Math.max(...xs), y, y + H, cz + Math.min(...zs), cz + Math.max(...zs), 'concrete'); } }
  }
  /** Olivier : tronc noueux effilé, branches courbes, feuillage en plaques croisées. Collision du tronc seul. */
  tree(x, z, y = 0, s = 1) {
    const r = this.r, sg = () => r() * 2 - 1, lean = r() * TAU, lx = Math.cos(lean) * .32 * s, lz = Math.sin(lean) * .32 * s, trunk = [], H = 2.42 * s;
    for (let i = 0; i <= 5; i++) { const t = i / 5, b = Math.sin(t * Math.PI * 1.15) * .1 * s; trunk.push([x + lx * t * t + Math.cos(lean + 1.7) * b, y + H * t, z + lz * t * t + Math.sin(lean + 1.7) * b, s * (.27 - .155 * t + (i === 0 ? .07 : 0))]); }
    this.begin('ar_wood'); this.tint(.56, .47, .38); TUBE(trunk, 7);
    const top = trunk[5], tips = [], nB = 5; for (let b = 0; b < nB; b++) { const a = lean + b / nB * TAU + sg() * .35, reach = (1.05 + r() * .6) * s, rise = (.62 + r() * .62) * s, pts = [], t0 = .72 + b * .05, st = trunk[Math.min(5, Math.round(t0 * 5))], bend = sg() * .5; for (let i = 0; i <= 3; i++) { const t = i / 3, q = a + bend * t * t, d = reach * Math.pow(t, .85); pts.push([st[0] + Math.cos(q) * d, st[1] + rise * (t * (1.5 - .5 * t)), st[2] + Math.sin(q) * d, s * (.1 - .072 * t)]); } TUBE(pts, 5); const e = pts[3]; tips.push(e); for (let k = 0; k < 2; k++) { const q = a + (k ? .75 : -.75) + sg() * .3, l = (.42 + r() * .36) * s, tw = [[pts[2][0], pts[2][1], pts[2][2], s * .038], [(pts[2][0] + e[0]) / 2 + Math.cos(q) * l * .55, (pts[2][1] + e[1]) / 2 + l * .35, (pts[2][2] + e[2]) / 2 + Math.sin(q) * l * .55, s * .027], [e[0] + Math.cos(q) * l, e[1] + l * .4, e[2] + Math.sin(q) * l, s * .012]]; TUBE(tw, 3); tips.push(tw[2]); } }
    this.end();
    this.k.disc(x, z, .26 * s, y, y + 2.3 * s, 'wood');
    const ox = top[0], oz = top[2], oy = top[1] + .45 * s, nC = Math.min(30, tips.length * 2); for (let c = 0; c < nC; c++) { const tp = tips[c % tips.length], a = r() * TAU, d = Math.sqrt(r()) * .62 * s, rad = (.62 + r() * .4) * s; let cx = tp[0] + Math.cos(a) * d, cz = tp[2] + Math.sin(a) * d; const cy = Math.max(y + (2.72 * s) + rad * 1.14, tp[1] + (r() - .35) * .52 * s), od = Math.hypot(cx - x, cz - z), mn = .5 * s + rad * .6; if (od < mn) { cx = x + (cx - x) / (od || 1) * mn; cz = z + (cz - z) / (od || 1) * mn; }
      this.begin('ar_leaf'); const g = .84 + r() * .34; this.tint(g * (.92 + r() * .1), g, g * (.82 + r() * .12)); for (let q = 0; q < 3; q++) { const th = r() * TAU, ph = (q - 1) * 1.05 + sg() * .3, e1 = [Math.cos(th) * rad, Math.sin(ph) * .34 * rad, Math.sin(th) * rad], f0 = [-Math.sin(th) * Math.sin(ph), Math.cos(ph), Math.cos(th) * Math.sin(ph)], f = [f0[0] * rad * .78, f0[1] * rad * .78, f0[2] * rad * .78]; LEAF(cx, cy, cz, e1[0], e1[1], e1[2], f[0], f[1], f[2], ox, oy, oz, r() < .5); } this.end(); }
  }
  /** Rondin : tube légèrement effilé et voilé, bouts coupés. À appeler entre begin() et end(). */
  log(ax, ay, az, bx, by, bz, r, o = {}) { const n = o.n || 2, seg = o.seg || 7, tp = o.taper ?? .08, wb = o.wob ?? .012, pts = []; for (let i = 0; i <= n; i++) { const t = i / n, w = Math.sin(t * Math.PI) * wb; pts.push([ax + (bx - ax) * t + w, ay + (by - ay) * t, az + (bz - az) * t - w, r * (1 - tp * t)]); } TUBE(pts, seg); if (o.caps !== false) { CAP(TF[0], seg, -1); CAP(TF[1], seg, 1); } return this; }
  /** Cadre de galerie : deux montants et un chapeau en rondins. ax = sens de la galerie, c = son axe, w = largeur entre parois. Collision des montants. */
  timberSet(ax, c, u, y0, y1, w, o = {}) { const r = o.r || .13, P2 = (a, b) => (ax === 'x' ? [a, b] : [b, a]); this.begin('ar_wood'); this.tint(...(o.tint || [.5, .4, .3]));
    for (const sd of [-1, 1]) { const [px, pz] = P2(u, c + sd * (w / 2 - r - .02)); this.log(px, y0, pz, px + this.rnd(-.03, .03), y1 - r * 1.7, pz + this.rnd(-.03, .03), r, { seg: 6, n: 1, caps: false }); if (o.solid !== false) this.k.disc(px, pz, r * 1.05, y0, y1, 'wood'); }
    const [x0, z0] = P2(u, c - w / 2 - .04), [x1, z1] = P2(u, c + w / 2 + .04); this.tint(.44, .35, .27); this.log(x0, y1 - r, z0, x1, y1 - r, z1, r * 1.08, { seg: 6, n: 2 }); this.end(o.fine); }
  /** Voie de mine : traverses et deux rails, posés sur un lit (collision basse : on marche dessus). */
  rails(ax, c, u0, u1, y, o = {}) { const g = o.gauge || .6, B2 = (a0, a1, b0, b1, h0, h1, j, sk) => (ax === 'x' ? BX(a0, a1, h0, h1, b0, b1, j, sk, this.r) : BX(b0, b1, h0, h1, a0, a1, j, sk, this.r));
    this.begin('ar_wood'); for (let u = u0 + .3; u < u1 - .1; u += .62) { const v = this.rnd(.38, .52); this.tint(v, v * .8, v * .62); B2(u - .09, u + .09, c - g / 2 - .2, c + g / 2 + .2, y, y + .03, .006, 'y'); } this.end();
    this.begin('ar_iron'); this.tint(.48, .42, .38); for (const sd of [-1, 1]) B2(u0, u1, c + sd * g / 2 - .025, c + sd * g / 2 + .025, y + .03, y + .07, 0, 'y'); this.end();
    if (o.solid) this.wcol(ax, u0, u1, y, y + .07, c - g / 2 - .2, c + g / 2 + .2, 'metal'); }
  /** Wagonnet de minerai : caisse évasée en tôle, minerai, roues ; collision en boîte. */
  cart(x, z, y, ax = 'x', o = {}) { const L = .72, wb = .34, wt = .5, h0 = y + .3, h1 = y + .92, ex = ax === 'x' ? 'z' : 'x', P2 = (a, b) => (ax === 'x' ? [x + a, z + b] : [x + b, z + a]);
    this.begin('ar_iron'); const rust = o.tint || [1.05, .72, .52]; this.tint(...rust);
    const oc = ax === 'x' ? z : x, oa = ax === 'x' ? x : z; for (const sd of [-1, 1]) { const poly = [[oc + sd * wb, h0], [oc + sd * (wb + .03), h0], [oc + sd * (wt + .03), h1], [oc + sd * wt, h1]]; EXT(ex, sd > 0 ? poly : poly.slice().reverse(), oa - L, oa + L); }
    for (const sd of [-1, 1]) { const e = oa + sd * L; EXT(ex, [[oc - wb, h0], [oc + wb, h0], [oc + wt, h1], [oc - wt, h1]], Math.min(e, e + sd * .03), Math.max(e, e + sd * .03)); }
    { const [a0x, a0z] = P2(-L, -wb), [a1x, a1z] = P2(L, wb); BX(Math.min(a0x, a1x), Math.max(a0x, a1x), h0 - .03, h0, Math.min(a0z, a1z), Math.max(a0z, a1z), 0, 'y'); }
    this.tint(.3, .29, .28); for (const sa of [-.5, .5]) for (const sb of [-1, 1]) { const [cx, cz] = P2(sa, sb * (wb - .02)), ox = ax === 'x' ? 0 : sb * .07, oz = ax === 'x' ? sb * .07 : 0; this.log(cx, y + .17, cz, cx + ox, y + .17, cz + oz, .16, { seg: 9, n: 1, taper: 0, wob: 0 }); }
    this.end(); this.begin('ar_rock'); this.tint(.46, .42, .4); { const [q0x, q0z] = P2(-L + .02, -wt + .02), [q1x, q1z] = P2(L - .02, wt - .02), yo = h1 - .07; Q(Math.min(q0x, q1x), yo, Math.max(q0z, q1z), Math.max(q0x, q1x), yo, Math.max(q0z, q1z), Math.max(q0x, q1x), yo, Math.min(q0z, q1z), Math.min(q0x, q1x), yo, Math.min(q0z, q1z)); } { const [cx, cz] = P2(0, 0); BLOB(cx, h1 - .08, cz, (ax === 'x' ? .5 : .38), .14, this.r); BLOB(cx + (ax === 'x' ? .32 : 0), h1 - .1, cz + (ax === 'x' ? 0 : .32), .3, .12, this.r); } this.end();
    { const [c0x, c0z] = P2(-L - .02, -wb - .08), [c1x, c1z] = P2(L + .02, wb + .08); this.col(c0x, c1x, y, h0 + .25, c0z, c1z, 'metal'); } { const [c0x, c0z] = P2(-L - .02, -wt - .02), [c1x, c1z] = P2(L + .02, wt + .02); this.col(c0x, c1x, h0 + .25, h1 - .05, c0z, c1z, 'metal'); } }
  /** Échelle de bois, pour le décor (hors d'atteinte ou à côté d'un escalier réel). */
  ladder(ax, ay, az, bx, by, bz, o = {}) { const w = o.w || .48, dx = bz - az, dz = -(bx - ax), l = Math.hypot(dx, dz) || 1, ox = dx / l * w / 2, oz = dz / l * w / 2, len = Math.hypot(bx - ax, by - ay, bz - az), n = Math.floor(len / .3);
    this.begin('ar_wood'); this.tint(.56, .44, .32); for (const sd of [-1, 1]) ROD(ax + sd * ox, ay, az + sd * oz, bx + sd * ox, by, bz + sd * oz, .03, 5); for (let i = 1; i <= n; i++) { const t = i / (n + 1), px = ax + (bx - ax) * t, py = ay + (by - ay) * t, pz = az + (bz - az) * t; ROD(px - ox, py, pz - oz, px + ox, py, pz + oz, .017, 4); } this.end(true); }
  /** Chevalement en bois : quatre jambes inclinées, moises, croix de Saint-André, plate-forme, deux molettes, jambes de force vers la machine (sens dir). */
  headframe(x, z, y, Hh, o = {}) { const b0 = o.base || 2.2, b1 = o.top || 1.15, dir = o.dir || 1, lv = Math.max(3, Math.round(Hh / 2.7)), half = t => b0 + (b1 - b0) * t, tint = [.4, .32, .25];
    this.begin('ar_wood'); this.tint(...tint);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { this.log(x + sx * b0, y, z + sz * b0, x + sx * b1, y + Hh, z + sz * b1, .2, { seg: 8, n: 3, taper: .15 }); for (let q = 0; q < 2; q++) { const t0 = q * .6 / Hh, t1 = (q + 1) * .6 / Hh * 2; void t1; } }
    for (let i = 1; i <= lv; i++) { const t = i / lv, hh = half(t) + .02, yy = y + Hh * t - .1; for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) this.log(x + a[0] * hh, yy, z + a[1] * hh, x + b[0] * hh, yy, z + b[1] * hh, .12, { seg: 6, n: 1 }); }
    for (let i = 0; i < lv; i++) { if (Hh * (i + 1) / lv < 3.2) continue; const t0 = Math.max(i / lv, 2.9 / Hh), t1 = (i + 1) / lv, h0 = half(t0), h1 = half(t1), y0 = y + Hh * t0, y1 = y + Hh * t1 - .1; for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { this.log(x + a[0] * h0, y0, z + a[1] * h0, x + b[0] * h1, y1, z + b[1] * h1, .085, { seg: 5, n: 1 }); this.log(x + b[0] * h0, y0, z + b[1] * h0, x + a[0] * h1, y1, z + a[1] * h1, .085, { seg: 5, n: 1 }); } }
    /* jambes de force */
    for (const sx of [-1, 1]) this.log(x + sx * b1, y + Hh - .3, z + dir * b1, x + sx * (b0 + .6), y, z + dir * (b0 + Hh * .55), .19, { seg: 8, n: 3, taper: .1 });
    this.end();
    /* plate-forme et molettes */
    this.begin('ar_plank'); this.tint(.6, .52, .44); BX(x - b1 - .4, x + b1 + .4, y + Hh, y + Hh + .12, z - b1 - .4, z + b1 + .4, .01, '', this.r); this.end();
    this.begin('ar_iron'); this.tint(.34, .32, .31); const R = o.wheel || 1.05; for (const oz of [-.48, .48]) { const cy = y + Hh + .12 + R + .1, cz = z + oz, ring = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * TAU; ring.push([x + Math.cos(a) * R, cy + Math.sin(a) * R, cz, .055]); } TUBE(ring, 6); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + .3; ROD(x, cy, cz, x + Math.cos(a) * R, cy + Math.sin(a) * R, cz, .028, 4); } ROD(x - .18, cy, cz, x + .18, cy, cz, .07, 8); for (const sx of [-1, 1]) ROD(x + sx * .2, y + Hh + .12, cz, x + sx * .2, cy, cz, .06, 5); }
    this.end();
    /* collisions : pieds des jambes et des jambes de force, première moise */
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (let q = 0; q < 3; q++) { const t = (q + .5) / 3 * 3 / Hh, hh = half(t); this.k.disc(x + sx * hh, z + sz * hh, .22, y + q, y + q + 1, 'wood'); }
    for (const sx of [-1, 1]) for (let q = 0; q < 6; q++) { const f = (q * .5 + .25) / (Hh - .3), px = x + sx * ((b0 + .6) + (b1 - (b0 + .6)) * f), pz = z + dir * ((b0 + Hh * .55) + (b1 - (b0 + Hh * .55)) * f); this.k.disc(px, pz, .24, y + q * .5, y + q * .5 + .5, 'wood'); }
    const g1 = half(1 / lv) + .02, gy = y + Hh / lv - .1; for (const [a0, a1, c0, c1] of [[-g1, g1, -g1 - .12, -g1 + .12], [-g1, g1, g1 - .12, g1 + .12]]) { this.col(x + a0, x + a1, gy - .12, gy + .12, z + c0, z + c1, 'wood'); this.col(x + c0, x + c1, gy - .12, gy + .12, z + a0, z + a1, 'wood'); }
    if (o.ladder !== false) { this.ladder(x - b0 - .05, y, z - .3, x - b1 - .05, y + Hh, z - .3, {}); this.col(x - b0 - .12, x - b0 + .02, y, y + 2.6, z - .58, z - .02, 'wood'); } }
  /** Chevalet ferroviaire le long de ax : palées tous les span m, tablier de planches, voie, garde-corps. ground(u) donne le sol sous la palée. */
  trestle(ax, c, u0, u1, ground, deck, o = {}) { const w = o.w || 3.2, hw = w / 2, span = o.span || 4, gaps = o.gaps || [], P3 = (u, v, h) => (ax === 'x' ? [u, h, v] : [v, h, u]), inGap = (u, sd) => gaps.some(g => (g[2] === undefined || g[2] === sd) && u > g[0] - .2 && u < g[1] + .2);
    this.begin('ar_wood'); this.tint(.36, .3, .24);
    for (let u = u0 + span / 2; u < u1; u += span) { const g = ground(u); if (deck - g < .9) continue; const top = deck - .34;
      for (const v of [-hw + .3, -hw * .3, hw * .3, hw - .3]) { const bat = Math.abs(v) > hw * .5 ? Math.sign(v) * Math.min(1.2, (top - g) * .1) : 0, a = P3(u, c + v + bat, g), b = P3(u, c + v, top); this.log(a[0], a[1], a[2], b[0], b[1], b[2], .15, { seg: 6, n: 2 }); if (top - g > .4) this.k.disc(a[0], a[2], .17, g, Math.min(top, g + 3.2), 'wood'); }
      { const a = P3(u, c - hw - .15, top + .1), b = P3(u, c + hw + .15, top + .1); this.log(a[0], a[1], a[2], b[0], b[1], b[2], .16, { seg: 6, n: 1 }); }
      const tiers = Math.max(1, Math.floor((top - g) / 3)); for (let q = 0; q < tiers; q++) { const ya = g + (top - g) * q / tiers + .3, yb = g + (top - g) * (q + 1) / tiers - .2, s0 = Math.min(1.2, (top - g) * .1) * (1 - q / tiers), s1 = Math.min(1.2, (top - g) * .1) * (1 - (q + 1) / tiers); const A1 = P3(u, c - hw + .3 - s0, ya), B1 = P3(u, c + hw - .3 + s1, yb), A2 = P3(u, c + hw - .3 + s0, ya), B2 = P3(u, c - hw + .3 - s1, yb); this.log(A1[0], A1[1], A1[2], B1[0], B1[1], B1[2], .08, { seg: 5, n: 1 }); this.log(A2[0], A2[1], A2[2], B2[0], B2[1], B2[2], .08, { seg: 5, n: 1 }); } }
    /* longerons */
    for (const v of [-hw * .62, 0, hw * .62]) { const a = P3(u0, c + v, deck - .22), b = P3(u1, c + v, deck - .22); ax === 'x' ? BX(u0, u1, deck - .34, deck - .1, c + v - .12, c + v + .12, .01, '', this.r) : BX(c + v - .12, c + v + .12, deck - .34, deck - .1, u0, u1, .01, '', this.r); void a; void b; }
    this.end();
    this.begin('ar_plank'); for (let u = u0; u < u1 - .05; u += .26) { const v = this.rnd(.62, .9); this.tint(v, v * .9, v * .8); const e = Math.min(u1, u + .25); ax === 'x' ? BX(u + .006, e - .006, deck - .1, deck, c - hw - this.rnd(0, .08), c + hw + this.rnd(0, .08), .004, '', this.r) : BX(c - hw - this.rnd(0, .08), c + hw + this.rnd(0, .08), deck - .1, deck, u + .006, e - .006, .004, '', this.r); } this.end();   /* planches du tablier fermées dessous : le tablier ne disparaît plus vu d'en bas */
    this.wcol(ax, u0, u1, deck - .35, deck, c - hw, c + hw, 'wood');
    if (o.rails !== false) this.rails(ax, c, u0, u1, deck, { solid: false });
    /* garde-corps : poteaux et lisses, ouverts aux sorties */
    this.begin('ar_wood'); this.tint(.44, .36, .28); for (const sd of [-1, 1]) { const v = c + sd * (hw - .06); let a = null; for (let u = u0; u <= u1 + 1e-6; u += 1) { const ok = !inGap(u, sd); if (ok) { const p = P3(u, v, deck), q = P3(u, v, deck + 1.05); ROD(p[0], p[1], p[2], q[0], q[1], q[2], .05, 5); } if (ok && a !== null) { const p = P3(a, v, deck + 1.0), q = P3(u, v, deck + 1.0), p2 = P3(a, v, deck + .5), q2 = P3(u, v, deck + .5); this.log(p[0], p[1], p[2], q[0], q[1], q[2], .045, { seg: 5, n: 1 }); ROD(p2[0], p2[1], p2[2], q2[0], q2[1], q2[2], .03, 4); this.wcol(ax, a, u, deck, deck + 1.05, v - .05, v + .05, 'wood'); } a = ok ? u : null; } } this.end(); }
  /** Goulotte à minerai : auge en planches inclinée, sur chevalets jusqu'au sol (ground(t)). */
  chute(ax0, ay0, az0, ax1, ay1, az1, w = .8, o = {}) { const n = Math.max(2, Math.round(Math.hypot(ax1 - ax0, az1 - az0) / 1.2)), dx = ax1 - ax0, dz = az1 - az0, l = Math.hypot(dx, dz) || 1, px = -dz / l * w / 2, pz = dx / l * w / 2;
    this.begin('ar_plank'); this.tint(.66, .58, .48); for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, A0 = [ax0 + dx * t0, ay0 + (ay1 - ay0) * t0, az0 + dz * t0], A1 = [ax0 + dx * t1, ay0 + (ay1 - ay0) * t1, az0 + dz * t1];
      Q(A0[0] - px, A0[1], A0[2] - pz, A0[0] + px, A0[1], A0[2] + pz, A1[0] + px, A1[1], A1[2] + pz, A1[0] - px, A1[1], A1[2] - pz); Q(A0[0] + px, A0[1], A0[2] + pz, A0[0] - px, A0[1], A0[2] - pz, A1[0] - px, A1[1], A1[2] - pz, A1[0] + px, A1[1], A1[2] + pz);
      for (const sd of [-1, 1]) { const qx = sd * px * 1.25, qz = sd * pz * 1.25; Q(A0[0] + sd * px, A0[1], A0[2] + sd * pz, A1[0] + sd * px, A1[1], A1[2] + sd * pz, A1[0] + qx, A1[1] + .45, A1[2] + qz, A0[0] + qx, A0[1] + .45, A0[2] + qz); Q(A1[0] + sd * px, A1[1], A1[2] + sd * pz, A0[0] + sd * px, A0[1], A0[2] + sd * pz, A0[0] + qx, A0[1] + .45, A0[2] + qz, A1[0] + qx, A1[1] + .45, A1[2] + qz); } }
    this.end(); this.begin('ar_rock'); this.tint(.42, .38, .36); for (let i = 0; i < n * 2; i++) { const t = (i + .5) / (n * 2); BLOB(ax0 + dx * t, ay0 + (ay1 - ay0) * t + .1, az0 + dz * t, w * .3, .08, this.r); } this.end();
    if (o.ground) { this.begin('ar_wood'); this.tint(.4, .33, .26); for (let i = 1; i < n; i += 2) { const t = i / n, cx = ax0 + dx * t, cy = ay0 + (ay1 - ay0) * t, cz = az0 + dz * t, g = o.ground(cx, cz); if (cy - g < .6) continue; for (const sd of [-1, 1]) { this.log(cx + sd * px * 1.1, g, cz + sd * pz * 1.1, cx + sd * px * 1.1, cy, cz + sd * pz * 1.1, .1, { seg: 5, n: 1 }); this.k.disc(cx + sd * px * 1.1, cz + sd * pz * 1.1, .12, g, cy, 'wood'); } } this.end(); } }
  /** Conifère de montagne : fût courbe effilé, étages de rameaux tombants (branche, frondes en V). yF : sol le plus haut sous la couronne. Collision du pied. */
  pine(x, z, y = 0, s = 1, yF = y, solid = true) { const r = this.r, Ht = (7.2 + this.rnd(0, 2.4)) * s, top = yF + Ht, lean = r() * TAU, lx = Math.cos(lean) * .25 * s, lz = Math.sin(lean) * .25 * s, r0 = .21 * s, pts = [];
    for (let i = 0; i <= 5; i++) { const f = i / 5, h = y - .1 + (top - y + .1) * f, w = Math.sin(f * 2.6) * .08 * s; pts.push([x + lx * f * f + w, h, z + lz * f * f - w, Math.max(.02, r0 * (1.15 - 1.05 * Math.pow(f, .8)))]); }
    const axisAt = h => { const f = clamp((h - y) / (top - y), 0, 1); return [x + lx * f * f, z + lz * f * f]; };
    this.begin('ar_wood'); this.tint(.4, .31, .25); TUBE(pts, 6);
    const tiers = [5, 4, 4, 3, 3], base = yF + (solid ? 4.9 : 3.4) * s, span = top - base - .6 * s, fr = [];
    for (let ti = 0; ti < tiers.length; ti++) { const f = ti / (tiers.length - 1), hy = base + span * f * .92, L = (2.3 - 1.65 * f) * s, nb = tiers[ti], a0 = r() * TAU, [ax0, az0] = axisAt(hy);
      for (let q = 0; q < nb; q++) { const an = a0 + q / nb * TAU + this.rnd(-.25, .25), ca = Math.cos(an), sa = Math.sin(an), droop = (.28 + .14 * (1 - f)) * L, ex = ax0 + ca * L, ez = az0 + sa * L, ey = hy - droop;
        if (ti < 2) TUBE([[ax0, hy + .05, az0, .055 * s], [ax0 + ca * L * .5, hy - droop * .3, az0 + sa * L * .5, .035 * s], [ex, ey, ez, .012 * s]], 3);
        fr.push([ax0 + ca * L * .52, hy - droop * .45, az0 + sa * L * .52, ca * L * .56, -droop * .5, sa * L * .56, -sa, ca, L, f]); } }
    this.end(); if (solid) this.k.disc(x, z, r0 * 1.12, y, y + 1.15, 'wood');
    this.begin('ar_needle'); for (const [cx, cy, cz, ex, ey, ez, px, pz, L, f] of fr) { const g = .82 + .18 * f + this.rnd(-.06, .06); this.tint(g * .82, g, g * .86); const w = L * .48;
      LEAF(cx, cy, cz, ex, ey, ez, px * w, -.12 * w, pz * w, cx - ex * 2, cy + L, cz - ez * 2, r() < .5); LEAF(cx, cy - .05, cz, ex, ey, ez, px * w * .6, w * .72, pz * w * .6, cx - ex * 2, cy + L, cz - ez * 2, r() < .5); }
    { const [tx, tz] = axisAt(top - .5 * s); this.tint(.95, 1.1, .96); LEAF(tx, top - .55 * s, tz, 0, .7 * s, 0, .38 * s, 0, 0, tx, top - 2, tz, false); LEAF(tx, top - .55 * s, tz, 0, .7 * s, 0, 0, 0, .38 * s, tx, top - 2, tz, false); }
    this.end(); }
  /** Touret de câble : deux joues, fût, spires ; collision. ax = axe du touret. */
  spool(x, z, y, R = .75, W = .9, ax = 'x') { const P2 = (a) => (ax === 'x' ? [x + a, z] : [x, z + a]); this.begin('ar_plank'); this.tint(.66, .56, .44); for (const sd of [-1, 1]) { const [px, pz] = P2(sd * W / 2), [qx, qz] = P2(sd * (W / 2 - .06)); this.log(px, y + R, pz, qx, y + R, qz, R, { seg: 14, n: 1, taper: 0, wob: 0 }); } this.end();
    this.begin('ar_iron'); this.tint(.3, .28, .26); { const [px, pz] = P2(-W / 2 + .06), [qx, qz] = P2(W / 2 - .06); this.log(px, y + R, pz, qx, y + R, qz, R * .72, { seg: 12, n: 2, taper: 0, wob: 0, caps: false }); } this.end();
    const [c0x, c0z] = P2(-W / 2), [c1x, c1z] = P2(W / 2); if (ax === 'x') this.col(c0x, c1x, y, y + R * 2, z - R * .85, z + R * .85, 'wood'); else this.col(x - R * .85, x + R * .85, y, y + R * 2, c0z, c1z, 'wood'); }
  /** Chaudière horizontale sur berceaux, cheminée et soupapes ; collision. */
  boiler(x, z, y, L = 3.2, R = .75, ax = 'x') { const P2 = (a, b) => (ax === 'x' ? [x + a, z + b] : [x + b, z + a]); this.begin('ar_iron'); this.tint(.36, .32, .3); { const [ax0, az0] = P2(-L / 2, 0), [ax1, az1] = P2(L / 2, 0); this.log(ax0, y + R + .45, az0, ax1, y + R + .45, az1, R, { seg: 14, n: 2, taper: 0, wob: 0 }); }
    { const [sx, sz] = P2(L / 2 - .5, 0); this.log(sx, y + R * 2 + .3, sz, sx, y + R * 2 + 3.6, sz, .2, { seg: 10, n: 1, taper: .1, wob: 0 }); this.log(sx, y + R * 2 + 3.5, sz, sx, y + R * 2 + 3.7, sz, .3, { seg: 10, n: 1, taper: 0, wob: 0 }); const [vx, vz] = P2(-.4, 0); this.log(vx, y + R * 2 + .3, vz, vx, y + R * 2 + .75, vz, .07, { seg: 6, n: 1, taper: 0, wob: 0 }); } this.end();
    this.begin('ar_stonewall'); this.tint(.8); for (const a of [-L / 2 + .5, L / 2 - .5]) { const [cx, cz] = P2(a, 0); BX(cx - .3, cx + .3, y, y + .55, cz - R * .8, cz + R * .8, .02, '', this.r); } this.end();
    const [c0x, c0z] = P2(-L / 2, -R), [c1x, c1z] = P2(L / 2, R); this.col(Math.min(c0x, c1x), Math.max(c0x, c1x), y, y + R * 2 + .45, Math.min(c0z, c1z), Math.max(c0z, c1z), 'metal'); { const [sx, sz] = P2(L / 2 - .5, 0); this.k.disc(sx, sz, .22, y + R * 2 + .3, y + R * 2 + 3.7, 'metal'); } }
  /** Château d'eau : cuve en douelles cerclée sur quatre jambes, toit conique, échelle ; collision des jambes. */
  waterTower(x, z, y, h = 5.2, R = 1.7) { this.begin('ar_wood'); this.tint(.4, .33, .26); const b = R * .85; for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { this.log(x + sx * (b + .35), y, z + sz * (b + .35), x + sx * b * .9, y + h, z + sz * b * .9, .15, { seg: 6, n: 2 }); this.k.disc(x + sx * (b + .3), z + sz * (b + .3), .17, y, y + 2.6, 'wood'); }
    for (const hh of [h * .5, h - .2]) for (const [a, c] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { const k2 = b + .35 - (.35 + b * .1) * (hh / h); this.log(x + a[0] * k2, y + hh, z + a[1] * k2, x + c[0] * k2, y + hh, z + c[1] * k2, .08, { seg: 5, n: 1 }); } this.end();
    this.begin('ar_plank'); this.tint(.62, .52, .42); TUBE([[x, y + h, z, R], [x, y + h + 1.2, z, R * 1.02], [x, y + h + 2.4, z, R]], 18); CAP([x, y + h, z, R, 1, 0, 0, 0, 0, 1, 0, -1, 0], 18, 1); this.end();
    this.begin('ar_iron'); this.tint(.3, .28, .27); for (const hh of [.35, 1.2, 2.05]) TUBE([[x, y + h + hh - .03, z, R + .03], [x, y + h + hh + .03, z, R + .03]], 18); this.end();
    this.begin('ar_shingle'); this.tint(.8); TUBE([[x, y + h + 2.35, z, R + .25], [x, y + h + 3.4, z, .06]], 18); this.end(); this.ladder(x + R + .05, y + h, z, x + R + .05, y + h + 2.4, z, {}); }
  /** Surface lisse en grille : rangées de points [x, y, z, r, g, b], normales moyennées tournées vers toward(x, y, z) ; o.keep(i, j) filtre les quads, o.lift décale le long de la normale. */
  surface(m, rows, toward, o = {}) { this.begin(m); const nI = rows.length, nJ = rows[0].length, b0 = P.length / 3, NRM = [], i0 = o.i0 ?? 0, i1 = Math.min(nI - 1, o.i1 ?? nI - 1);
    for (let i = i0; i <= i1; i++) for (let j = 0; j < nJ; j++) { const p = rows[i][j], pa = rows[Math.min(nI - 1, i + 1)][j], pb = rows[Math.max(0, i - 1)][j], pc = rows[i][Math.min(nJ - 1, j + 1)], pd = rows[i][Math.max(0, j - 1)];
      const ux = pa[0] - pb[0], uy = pa[1] - pb[1], uz = pa[2] - pb[2], vx = pc[0] - pd[0], vy = pc[1] - pd[1], vz = pc[2] - pd[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const w = toward(p[0], p[1], p[2]); if (nx * w[0] + ny * w[1] + nz * w[2] < 0) { nx = -nx; ny = -ny; nz = -nz; } if (Math.hypot(nx, ny, nz) < 1e-9) { nx = w[0]; ny = w[1] + 1; nz = w[2]; } const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; NRM.push(nx, ny, nz);
      tr = p[3]; tg = p[4]; tb = p[5]; const lf = o.lift || 0; V(p[0] + nx * lf, p[1] + ny * lf, p[2] + nz * lf, nx, ny, nz); }
    for (let i = i0; i < i1; i++) for (let j = 0; j < nJ - 1; j++) { if (o.keep && !o.keep(i, j)) continue; const a = b0 + (i - i0) * nJ + j, b = a + nJ, c = b + 1, d = a + 1, pa = rows[i][j], pb = rows[i + 1][j], pc = rows[i + 1][j + 1];
      const gx = (pb[1] - pa[1]) * (pc[2] - pa[2]) - (pb[2] - pa[2]) * (pc[1] - pa[1]), gy = (pb[2] - pa[2]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[2] - pa[2]), gz = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]), q = ((i - i0) * nJ + j) * 3;
      if (gx * NRM[q] + gy * NRM[q + 1] + gz * NRM[q + 2] >= 0) I.push(a, b, c, a, c, d); else I.push(a, c, b, a, d, c); }
    this.end(o.fine); }
  /** Lierre plaqué sur un mur : grappe de feuilles qui descend d'un point haut. */
  ivy(ax, c, s, u, y, w, h) {
    this.begin('ar_plant'); const n = Math.round(w * h * 40); for (let i = 0; i < n; i++) { const t = this.r(), q = u + (this.r() - .5) * w * (1 - t * .55), yy = y - t * h, r = this.rnd(.035, .075), g = this.rnd(.18, .34), e = c + s * this.rnd(.012, .05); if (i % 3 === 1) continue; this.tint(g * .8, g * 1.12, g * .5); WQ(ax, s, q - r, yy - r, e, q + r, yy - r * .6, e + s * .012, q + r * .8, yy + r, e, q - r * .7, yy + r * .8, e + s * .012); } this.end(true);
  }
  /** Bloc de rocher arrondi posé au sol ; collision en croix sur deux étages. */
  boulder(x, z, s, o = {}) {
    const y = o.y || 0, sx = o.sx || 1.3, n = 9, m = o.m || 'ar_rubble', pol = [], mid = [], top = [], hA = s * .5, hB = s * .82, hC = s * .98; for (let q = 0; q < n; q++) { const a = q / n * TAU, rr = s * (.93 + .11 * noise2(x * 1.3 + q, z)); pol.push([x + Math.cos(a) * rr * sx, z + Math.sin(a) * rr]); mid.push([x + Math.cos(a) * rr * sx * .74, z + Math.sin(a) * rr * .74]); top.push([x + Math.cos(a) * rr * sx * .36, z + Math.sin(a) * rr * .36]); }
    this.begin(m); this.tint(o.tone ?? this.rnd(.74, .96)); PRISM(pol, y, y + hA); for (const [L0, L1, h0, h1] of [[pol, mid, hA, hB], [mid, top, hB, hC]]) for (let q = 0; q < n; q++) { const a = L0[q], b = L0[(q + 1) % n], c = L1[(q + 1) % n], d = L1[q]; Q(a[0], y + h0, a[1], d[0], y + h1, d[1], c[0], y + h1, c[1], b[0], y + h0, b[1]); } PRISM(top, y + hC - .004, y + hC); for (let q = 0; q < N.length; q += 3) { const a = (P[q] - x) / (s * sx), b = (P[q + 1] - y - s * .1) / (s * .9), c = (P[q + 2] - z) / s, l = Math.hypot(a, b, c) || 1; N[q] = a / l; N[q + 1] = b / l; N[q + 2] = c / l; } this.end();
    for (const [p, q] of [[1 * sx, .48], [.8 * sx, .8], [.46 * sx, .99]]) this.k.col(x - s * p, x + s * p, y, y + Math.max(hA, .36), z - s * q, z + s * q, 'concrete'); for (const [p, q] of [[.9 * sx, .4], [.7 * sx, .7], [.4 * sx, .9]]) this.k.col(x - s * p, x + s * p, y + hA, y + hB, z - s * q, z + s * q, 'concrete'); for (const [p, q] of [[.72 * sx, .3], [.52 * sx, .52], [.3 * sx, .72]]) this.k.col(x - s * p, x + s * p, y + hB, y + hC, z - s * q, z + s * q, 'concrete');
  }
}

/* ---------- MATÉRIAUX DU KIT (appelés par createWorld, textures peintes en différé) ---------- */
const AR_Z = { ar_dark: -1, ar_ashlar: -1, ar_wood: -.75, ar_rubble: -.5, ar_cobble: -.5, ar_tile: -.5, ar_shingle: -.5 };   /* petits décalages : pas de décollement vu en rasant */
export function archMaterial(k, H) {
  if (!k.startsWith('ar_')) return null;
  const { tex, nmap, blotch, streaks, cracks, rnd, hook } = H;
  const pillow = (x, cx, cy, rx, ry, R, G, B) => { const n = 7, pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + rnd(-.16, .16), c = Math.cos(a), q = Math.sin(a), k = rnd(.92, 1.06); pts.push([cx + Math.sign(c) * Math.pow(Math.abs(c), .62) * rx * k, cy + Math.sign(q) * Math.pow(Math.abs(q), .62) * ry * k]); }
    const g = x.createRadialGradient(cx - rx * .28, cy - ry * .38, Math.min(rx, ry) * .12, cx, cy, Math.max(rx, ry) * 1.12); g.addColorStop(0, `rgb(${R + 8},${G + 8},${B + 7})`); g.addColorStop(.55, `rgb(${R},${G},${B})`); g.addColorStop(.88, `rgb(${R - 11},${G - 11},${B - 10})`); g.addColorStop(1, `rgb(${R - 22},${G - 22},${B - 20})`); x.fillStyle = g; x.beginPath(); const l = pts[n - 1]; x.moveTo((l[0] + pts[0][0]) / 2, (l[1] + pts[0][1]) / 2); for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); } x.closePath(); x.fill(); };
  /* moellons : pierres plates à pans irréguliers, joints de mortier en creux (plus sombres, donc en retrait pour la carte de normales) */
  const rubble = (x, s, rows, cols, mortar, R0, G0, B0) => { x.fillStyle = mortar; x.fillRect(0, 0, s, s); for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${rnd(0, 1) < .55 ? '58,50,40' : '214,204,184'},${rnd(.05, .13)})`; x.fillRect(rnd(0, s), rnd(0, s), rnd(.6, 1.5), rnd(.6, 1.5)); }
    const hs = []; let tot = 0; for (let j = 0; j < rows; j++) { const q = rnd(.7, 1.35); hs.push(q); tot += q; } let yy = 0;
    for (let j = 0; j < rows; j++) { const h = hs[j] / tot * s, av = s / cols * Math.pow(hs[j], .6), st = rnd(0, av); let cur = st;
      while (cur < st + s - 1) { let w = av * rnd(.55, 1.85); if (st + s - cur < w * 1.3) w = st + s - cur;
        const g = rnd(1.1, 2), x0 = cur + g * rnd(.5, 1), x1 = cur + w - g * rnd(.5, 1), y0 = yy + g * rnd(.5, 1), y1 = yy + h - g * rnd(.5, 1), W = x1 - x0, Hh = y1 - y0, cw = Math.min(W, Hh), c = () => rnd(.06, .34) * cw, a = c(), b = c(), d = c(), e = c();
        const fam = rnd(0, 1), v = rnd(-13, 13), dR = fam < .3 ? 8 : fam < .55 ? -6 : 0, dB = fam < .3 ? -9 : fam < .55 ? 6 : 0, Rc = Math.round(R0 + v + dR), Gc = Math.round(G0 + v), Bc = Math.round(B0 + v + dB);
        const pts = [[x0 + a, y0 + rnd(0, .08) * Hh], [x0 + W * rnd(.35, .65), y0 + rnd(-.04, .1) * Hh], [x1 - b, y0 + rnd(0, .06) * Hh], [x1, y0 + b], [x1 - rnd(0, .07) * W, y0 + Hh * rnd(.35, .65)], [x1, y1 - d], [x1 - d, y1], [x0 + W * rnd(.35, .65), y1 - rnd(-.04, .1) * Hh], [x0 + e, y1], [x0, y1 - e], [x0 + rnd(0, .07) * W, y0 + Hh * rnd(.35, .65)], [x0, y0 + a]];
        for (const o of [-s, 0, s]) { if (x1 + o < 0 || x0 + o > s) continue; const gr = x.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgb(${Rc + 7},${Gc + 7},${Bc + 6})`); gr.addColorStop(1, `rgb(${Rc - 9},${Gc - 9},${Bc - 8})`); x.fillStyle = gr; x.beginPath(); x.moveTo(pts[0][0] + o, pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0] + o, pts[i][1]); x.closePath(); x.fill(); x.strokeStyle = 'rgba(48,40,30,.3)'; x.lineWidth = .8; x.stroke();
          for (let q = 0; q < 2; q++) { x.fillStyle = `rgba(${rnd(0, 1) < .5 ? '70,60,46' : '232,222,200'},.09)`; x.beginPath(); x.ellipse(x0 + o + W * rnd(.2, .8), y0 + Hh * rnd(.25, .75), W * rnd(.08, .22), Hh * rnd(.08, .2), rnd(0, 3.14), 0, TAU); x.fill(); } }
        cur += w; } yy += h; } };
  /* assises de pierres : hauteur et largeur irrégulières, chaque rangée se raccorde exactement au bord de la tuile */
  const courses = (x, s, rows, cols, mortar, R0, G0, B0, wob) => { x.fillStyle = mortar; x.fillRect(0, 0, s, s); const hs = []; let tot = 0; for (let j = 0; j < rows; j++) { const q = rnd(.66, 1.42); hs.push(q); tot += q; } let yy = 0;
    for (let j = 0; j < rows; j++) { const h = hs[j] / tot * s, av = (s / cols) * Math.pow(hs[j], .55), st = rnd(0, av); let cur = st; while (cur < st + s - 1) { let w = av * rnd(.52, 1.72); if (st + s - cur < w * 1.3) w = st + s - cur; const fam = rnd(0, 1), v = rnd(-10, 10), dR = fam < .3 ? 7 : fam < .55 ? -5 : 0, dB = fam < .3 ? -8 : fam < .55 ? 5 : 0, cx = cur + w / 2, cy = yy + h / 2 + rnd(-wob, wob) * .5, rx = w / 2 - .35, ry = h / 2 - .35 + rnd(-.8, .3), Rc = Math.round(R0 + v + dR), Gc = Math.round(G0 + v), Bc = Math.round(B0 + v + dB); for (const o of [-s, 0, s]) if (cx + o + rx > 0 && cx + o - rx < s) pillow(x, cx + o, cy, rx, ry, Rc, Gc, Bc); cur += w; } yy += h; }
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${rnd(0, 1) < .5 ? '60,50,38' : '240,230,210'},${rnd(.02, .06)})`; x.fillRect(rnd(0, s), rnd(0, s), rnd(.8, 2), rnd(.8, 2)); } };
  const P = {
    ar_plaster: ['#e4d6b8', .95, (x, s) => { blotch(x, s, 54, '160,132,96'); blotch(x, s, 34, '255,246,226'); cracks(x, s, 1); for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${rnd(0, 1) < .5 ? '90,70,46' : '255,250,235'},${rnd(.02, .07)})`; x.fillRect(rnd(0, s), rnd(0, s), rnd(1, 3), rnd(1, 3)); } }],
    ar_rubble: ['#7b6f5c', .98, (x, s) => { rubble(x, s, 20, 15, '#7d725f', 162, 148, 124); blotch(x, s, 18, '70,58,42'); blotch(x, s, 10, '226,212,186'); }],
    ar_ashlar: ['#c9b48e', .92, (x, s) => { x.fillStyle = '#8c7b60'; x.fillRect(0, 0, s, s); const rows = 5; for (let r = 0; r < rows; r++) { const cols = 3, h = s / rows; for (let c = -1; c <= cols; c++) { const v = rnd(-16, 16), bx = (c + (r % 2) * .5) * s / cols; x.fillStyle = `rgb(${204 + v},${185 + v},${150 + v})`; x.fillRect(bx + 2.5, r * h + 2.5, s / cols - 5, h - 5); x.fillStyle = 'rgba(255,245,220,.16)'; x.fillRect(bx + 2.5, r * h + 2.5, s / cols - 5, 3); x.fillStyle = 'rgba(40,30,18,.22)'; x.fillRect(bx + 2.5, r * h + h - 6, s / cols - 5, 3); } } blotch(x, s, 26, '86,70,48'); streaks(x, s, 8); }],
    ar_tile: ['#b5623d', .82, (x, s) => { const rows = 10, cols = 7; x.fillStyle = '#5a2c1a'; x.fillRect(0, 0, s, s); for (let r = rows; r >= -1; r--) for (let c = -1; c <= cols; c++) { const w = s / cols, h = s / rows, cx = (c + (r % 2) * .5) * w, cy = r * h, v = rnd(-22, 22), g = x.createLinearGradient(cx, 0, cx + w, 0); g.addColorStop(0, `rgb(${122 + v},${58 + v * .6},${34 + v * .4})`); g.addColorStop(.45, `rgb(${206 + v},${118 + v * .7},${74 + v * .5})`); g.addColorStop(1, `rgb(${112 + v},${54 + v * .6},${32 + v * .4})`); x.fillStyle = g; x.beginPath(); x.moveTo(cx + 1, cy); x.lineTo(cx + w - 1, cy); x.lineTo(cx + w - 2, cy + h * 1.2); x.quadraticCurveTo(cx + w / 2, cy + h * 1.42, cx + 2, cy + h * 1.2); x.closePath(); x.fill(); } blotch(x, s, 26, '40,30,20'); blotch(x, s, 14, '214,196,160'); }],
    ar_cobble: ['#a2927a', .96, (x, s) => { courses(x, s, 22, 19, '#7c7060', 154, 142, 122, 1.2); blotch(x, s, 20, '66,56,42'); }],
    ar_gravel: ['#b5a488', 1, (x, s) => { blotch(x, s, 60, '120,104,80'); blotch(x, s, 34, '232,218,192'); for (let i = 0; i < 2200; i++) { const r = rnd(.8, 4.4), v = rnd(-40, 34); x.fillStyle = `rgb(${172 + v},${156 + v},${132 + v})`; const a = rnd(0, s), b = rnd(0, s); x.beginPath(); x.ellipse(a, b, r * 1.3, r, rnd(0, 3), 0, 7); x.fill(); if (r > 2.6) { x.fillStyle = 'rgba(30,24,16,.3)'; x.beginPath(); x.ellipse(a + .6, b + r * .7, r * 1.1, r * .4, 0, 0, 7); x.fill(); } } }],
    ar_wood: ['#8b6b48', .86, (x, s) => { for (let i = 0; i < 7; i++) { const v = rnd(-14, 14); x.fillStyle = `rgb(${146 + v},${112 + v},${76 + v})`; x.fillRect(0, i * s / 7 + 1, s, s / 7 - 2); } x.strokeStyle = 'rgba(40,26,14,.3)'; for (let i = 0; i < 70; i++) { const y = rnd(0, s); x.lineWidth = rnd(.5, 1.4); x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(s * .3, y + rnd(-7, 7), s * .6, y + rnd(-7, 7), s, y); x.stroke(); } blotch(x, s, 20, '40,28,16'); }],
    ar_rock: ['#77726a', .97, (x, s) => { x.fillStyle = '#76716a'; x.fillRect(0, 0, s, s); let yy = rnd(-10, 0); while (yy < s) { const h = rnd(12, 48), v = rnd(-12, 12); x.fillStyle = `rgba(${118 + v},${112 + v},${104 + v},.55)`; x.beginPath(); x.moveTo(0, yy); for (let q = 0; q <= 16; q++) x.lineTo(q * s / 16, yy + 4 * Math.sin(q * .9 + yy) + rnd(-2, 2)); for (let q = 16; q >= 0; q--) x.lineTo(q * s / 16, yy + h + 4 * Math.sin(q * .8 + yy) + rnd(-2, 2)); x.closePath(); x.fill(); x.strokeStyle = 'rgba(40,36,32,.16)'; x.lineWidth = rnd(.5, 1.1); x.beginPath(); x.moveTo(0, yy); for (let q = 0; q <= 16; q++) x.lineTo(q * s / 16, yy + 4 * Math.sin(q * .9 + yy)); x.stroke(); yy += h; }
      for (let i = 0; i < 1700; i++) { const cx = rnd(0, s), cy = rnd(0, s), r = rnd(1.5, 7), v = rnd(-28, 26), n = 5; x.fillStyle = `rgba(${120 + v},${115 + v},${107 + v},.5)`; x.beginPath(); for (let q = 0; q < n; q++) { const an = q / n * TAU + rnd(-.4, .4), rr = r * rnd(.6, 1); q ? x.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr) : x.moveTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } x.closePath(); x.fill(); }
      for (let i = 0; i < 30; i++) { let px = rnd(0, s), py = rnd(0, s); const pts = [[px, py]], dir = rnd(0, 1) < .5 ? 1 : -1; for (let q = 0; q < 5; q++) { px += rnd(-5, 5); py += rnd(5, 14) * dir; pts.push([px, py]); } x.strokeStyle = 'rgba(28,24,20,.32)'; x.lineWidth = rnd(.7, 1.6); x.beginPath(); pts.forEach((p, q) => q ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); x.strokeStyle = 'rgba(210,204,192,.25)'; x.lineWidth = .8; x.beginPath(); pts.forEach((p, q) => q ? x.lineTo(p[0] + 1.2, p[1] + 1) : x.moveTo(p[0] + 1.2, p[1] + 1)); x.stroke(); }
      for (let i = 0; i < 70; i++) { x.fillStyle = rnd(0, 1) < .65 ? `rgba(${118 + rnd(0, 30)},${128 + rnd(0, 30)},${78},.22)` : 'rgba(186,140,82,.18)'; x.beginPath(); x.ellipse(rnd(0, s), rnd(0, s), rnd(2, 7), rnd(2, 5), rnd(0, 3), 0, TAU); x.fill(); }
      for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${rnd(0, 1) < .5 ? '34,30,26' : '214,208,196'},${rnd(.03, .09)})`; x.fillRect(rnd(0, s), rnd(0, s), rnd(.6, 1.8), rnd(.6, 1.8)); } }],
    ar_plank: ['#8a7a66', .9, (x, s) => { const nb = 8, bw = s / nb; for (let i = 0; i < nb; i++) { const v = rnd(-20, 16), warm = rnd(0, 1) < .4; x.fillStyle = `rgb(${(warm ? 150 : 136) + v},${(warm ? 124 : 124) + v},${(warm ? 98 : 108) + v})`; x.fillRect(i * bw + 1.2, 0, bw - 2.4, s); x.strokeStyle = 'rgba(46,36,26,.28)'; for (let q = 0; q < 9; q++) { const gx = i * bw + rnd(3, bw - 3); x.lineWidth = rnd(.4, 1.1); x.beginPath(); x.moveTo(gx, 0); x.bezierCurveTo(gx + rnd(-3, 3), s * .3, gx + rnd(-3, 3), s * .7, gx + rnd(-2, 2), s); x.stroke(); }
        for (let q = 0; q < 2; q++) { const kx = i * bw + rnd(6, bw - 6), ky = rnd(10, s - 10); x.fillStyle = 'rgba(60,44,30,.6)'; x.beginPath(); x.ellipse(kx, ky, rnd(1.5, 3), rnd(3, 6), 0, 0, TAU); x.fill(); } x.fillStyle = 'rgba(40,40,44,.7)'; for (const ny of [s * .14, s * .64]) for (const nx of [i * bw + 5, i * bw + bw - 5]) x.fillRect(nx - 1, ny - 1, 2.2, 2.2); x.fillStyle = 'rgba(70,56,40,.22)'; x.fillRect(i * bw + 1.2, 0, bw - 2.4, rnd(4, 18)); }
      x.fillStyle = 'rgba(24,18,12,.85)'; for (let i = 0; i <= nb; i++) x.fillRect(i * bw - 1.2, 0, 2.4, s); blotch(x, s, 30, '60,50,38'); blotch(x, s, 16, '200,196,186'); }],
    ar_shingle: ['#5e5248', .92, (x, s) => { x.fillStyle = '#2c2620'; x.fillRect(0, 0, s, s); const rows = 9, h = s / rows; for (let r = 0; r < rows; r++) { let u = (r % 2) * rnd(8, 18) - 20; while (u < s) { const w = rnd(14, 30), v = rnd(-22, 18), moss = rnd(0, 1) < .12; x.fillStyle = moss ? `rgb(${84 + v},${92 + v},${60 + v})` : `rgb(${104 + v},${92 + v},${80 + v})`; x.fillRect(u + 1, r * h + 1, w - 2, h * 1.25); const g = x.createLinearGradient(0, r * h, 0, r * h + h * 1.25); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(.25, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(255,240,220,.08)'); x.fillStyle = g; x.fillRect(u + 1, r * h + 1, w - 2, h * 1.25); u += w; } } }],
    ar_stonewall: ['#7b776e', .97, (x, s) => { rubble(x, s, 26, 19, '#5d5a53', 150, 146, 138); blotch(x, s, 18, '60,56,48'); blotch(x, s, 10, '210,206,196'); }],
    ar_brick: ['#9a5a40', .9, (x, s) => { x.fillStyle = '#8a8276'; x.fillRect(0, 0, s, s); const rows = 16, h = s / rows, w = s / 6; for (let r0 = 0; r0 < rows; r0++) for (let c0 = -1; c0 <= 6; c0++) { const v = rnd(-18, 16), burnt = rnd(0, 1) < .12, bx = (c0 + (r0 % 2) * .5) * w; x.fillStyle = burnt ? `rgb(${92 + v},${52 + v},${40 + v})` : `rgb(${158 + v},${86 + v * .7},${62 + v * .5})`; x.fillRect(bx + 1.6, r0 * h + 1.6, w - 3.2, h - 3.2); x.fillStyle = 'rgba(255,230,200,.08)'; x.fillRect(bx + 1.6, r0 * h + 1.6, w - 3.2, 2); } blotch(x, s, 24, '40,30,24'); for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(${rnd(0, 1) < .5 ? '40,30,24' : '230,210,190'},${rnd(.03, .08)})`; x.fillRect(rnd(0, s), rnd(0, s), rnd(.6, 1.6), rnd(.6, 1.6)); } }],
    ar_tin: ['#7d7f80', .55, (x, s) => { const n = 22, w = s / n; for (let i = 0; i < n; i++) { const g = x.createLinearGradient(i * w, 0, (i + 1) * w, 0); g.addColorStop(0, '#5f6264'); g.addColorStop(.5, '#a3a6a7'); g.addColorStop(1, '#5a5c5e'); x.fillStyle = g; x.fillRect(i * w, 0, w, s); } for (let i = 0; i < 46; i++) { const px = rnd(0, s), py = rnd(0, s), l = rnd(20, 140); const g = x.createLinearGradient(0, py, 0, py + l); g.addColorStop(0, 'rgba(140,70,30,.55)'); g.addColorStop(1, 'rgba(140,70,30,0)'); x.fillStyle = g; x.fillRect(px, py, rnd(3, 9), l); } for (let r0 = 0; r0 < 3; r0++) { x.fillStyle = 'rgba(30,30,30,.35)'; x.fillRect(0, r0 * s / 3, s, 2); } blotch(x, s, 20, '90,60,40'); }],
    ar_snow: ['#eef2f6', .9, (x, s) => { x.fillStyle = '#eef2f6'; x.fillRect(0, 0, s, s); blotch(x, s, 40, '190,204,220'); blotch(x, s, 20, '255,255,255'); for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${rnd(0, 1) < .5 ? '160,176,196' : '255,255,255'},${rnd(.05, .15)})`; x.fillRect(rnd(0, s), rnd(0, s), rnd(.6, 2), rnd(.6, 2)); } }],
    ar_cloth: ['#f0e8d8', .98, (x, s) => { x.strokeStyle = 'rgba(70,60,46,.08)'; for (let i = 0; i < s; i += 3) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); } blotch(x, s, 24, '120,100,76'); }],
  }[k];
  let m;
  if (P) { const t = tex(P[0], P[2], k === 'ar_cloth' ? 256 : 512); m = new THREE.MeshStandardMaterial({ map: t, normalMap: k === 'ar_cloth' || k === 'ar_plaster' || k === 'ar_snow' ? null : nmap(t, k === 'ar_plaster' ? 1.1 : k === 'ar_rubble' || k === 'ar_cobble' ? .85 : k === 'ar_rock' ? 2.4 : k === 'ar_plank' ? 1.2 : k === 'ar_stonewall' ? .85 : k === 'ar_brick' ? 1 : k === 'ar_tin' ? 1.4 : 2.4), roughness: P[1], metalness: 0, vertexColors: true }); }
  else if (k === 'ar_leaf') { const t = tex('#66743f', (x, s) => { x.clearRect(0, 0, s, s); for (let i = 0; i < 1150; i++) { const a = rnd(0, TAU), d = Math.sqrt(rnd(0, 1)) * s * .47, px = s / 2 + Math.cos(a) * d, py = s / 2 + Math.sin(a) * d, l = rnd(6, 13), w = l * rnd(.24, .4), sil = rnd(0, 1) < .34, v = rnd(-16, 16); x.fillStyle = sil ? `rgb(${142 + v},${152 + v},${116 + v})` : `rgb(${84 + v},${104 + v},${54 + v})`; x.beginPath(); x.ellipse(px, py, l, w, rnd(0, 3.14), 0, TAU); x.fill(); } }, 256); m = new THREE.MeshStandardMaterial({ map: t, alphaTest: .26, roughness: .88, metalness: 0, vertexColors: true }); }
  else if (k === 'ar_needle') { const t2 = tex('#3f5232', (x, s) => { x.clearRect(0, 0, s, s); for (let b = 0; b < 4; b++) { const y0 = s * (.2 + .2 * b) + rnd(-6, 6); x.strokeStyle = 'rgb(70,58,42)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(s * .02, y0); x.quadraticCurveTo(s * .5, y0 + rnd(-10, 10), s * .98, y0 + rnd(-6, 6)); x.stroke();
      for (let i = 0; i < 430; i++) { const u = rnd(.03, .97), py = y0 + (u - .5) * rnd(-14, 14) * .2, l = (1 - Math.abs(u - .5) * 1.2) * rnd(10, 26) + 5, an = rnd(.5, 1.1) * (rnd(0, 1) < .5 ? 1 : -1), v = rnd(-14, 18), tip = rnd(0, 1) < .15; x.strokeStyle = tip ? `rgb(${112 + v},${142 + v},${84 + v})` : `rgb(${48 + v},${78 + v},${46 + v})`; x.lineWidth = rnd(1.6, 3); x.beginPath(); x.moveTo(u * s, py); x.lineTo(u * s + Math.cos(an) * l * .5, py + Math.sin(an) * l); x.stroke(); } } }, 256); m = new THREE.MeshStandardMaterial({ map: t2, alphaTest: .22, roughness: .9, metalness: 0, vertexColors: true }); }
  else if (k === 'ar_iron') m = new THREE.MeshStandardMaterial({ color: 0x6a6a6e, roughness: .62, metalness: .5, vertexColors: true });
  else if (k === 'ar_water') m = new THREE.MeshStandardMaterial({ color: 0x24302e, roughness: .08, metalness: .35, vertexColors: true });
  else if (k === 'ar_water_marsh') m = new THREE.MeshStandardMaterial({ color: 0x26302c, roughness: .5, metalness: .15, vertexColors: true });   /* eau du marais (MAP QA) : trouble, sans éclat de soleil dur sous le ciel couvert ; même programme que ar_water */
  else if (k === 'ar_water_cave') m = new THREE.MeshStandardMaterial({ color: 0x111614, roughness: .9, metalness: 0, vertexColors: true });   /* eau sous terre, trouble : rugueuse (plus de reflet du soleil en rasant) et reflet du ciel à 0,1 plus bas ; même programme que ar_water */
  else if (k === 'ar_dark') m = new THREE.MeshStandardMaterial({ color: 0x35373a, roughness: .5, metalness: .1, vertexColors: true });
  else if (k === 'ar_plant' || k === 'ar_hill') m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: k === 'ar_hill' ? 1 : .92, vertexColors: true });
  else return null;
  /* carte de normales sans filtrage anisotrope : les murs vus en rasant coûtent moins, la couleur garde le sien */
  if (m.normalMap) m.normalMap.anisotropy = 1;
  /* priorité de profondeur des pièces posées à plat sur un parement (fonds de baie, pierre de taille, bois, soubassement, pavés, toitures) :
     les faces confondues ne scintillent plus. État GL seulement (polygonOffset), aucun programme de shader nouveau. */
  { const z = AR_Z[k]; if (z) { m.polygonOffset = true; m.polygonOffsetFactor = m.polygonOffsetUnits = z; } }
  hook(m); m.userData.envI = k === 'ar_water_cave' ? .1 : k === 'ar_water_marsh' ? .55 : 1; return m;
}
