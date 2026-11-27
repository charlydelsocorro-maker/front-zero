// FRONT ZÉRO — [meubles] où poser les meubles. Pur (sans three ni DOM) : aussi utilisé sous Node par les contrôles.
// Les pièces sont lues dans les collisions de la carte (sol, plafond, murs), jamais dans un plan écrit à la main : une carte retouchée
// garde des meubles qui tiennent dans ses murs. Mêmes tirages sur tous les postes (seeded) : les collisions sont les mêmes partout.
// Règles : dos au mur (2 cm), posé sur le sol, jamais devant une porte, un escalier, une trémie, une brèche, un point d'apparition ;
// sous une fenêtre seulement un meuble bas ; un passage de 0,9 m reste libre entre toutes les entrées d'une pièce.
import { createGrid } from './engine-grid.js';
import { drawnBoxes, seeded } from './map-props.js';

const CS = 0.5, HEAD = 1.9, BODY = 0.45;
const ROOM = 0, PORTAL = 1, WALL = 2, WIN = 3, LOW = 4, DROP = 5, OTHER = 6;
const DX = [1, -1, 0, 0], DZ = [0, 0, 1, -1];

/* Catalogue : w le long du mur (x local), d en profondeur (z local, 0 = dos au mur), h hauteur. sol : boîtes de collision locales
   [x0, x1, y0, y1, z0, z1] (par défaut la boîte entière). low : peut aller sous une fenêtre. Matière des balles : surf / pen. */
const B = (w, d, h) => [[-w / 2, w / 2, 0, h, 0, d]];
export const CAT = {
  bed:      { w: 1.0,  d: 2.0,  h: 1.0,  surf: 'wood', pen: 2.2, sol: [[-.5, .5, 0, .58, 0, 2], [-.5, .5, .58, 1, 0, .1]] },
  bed2:     { w: 1.45, d: 2.0,  h: 1.0,  surf: 'wood', pen: 2.2, sol: [[-.725, .725, 0, .58, 0, 2], [-.725, .725, .58, 1, 0, .1]] },
  wardrobe: { w: 1.1,  d: .58,  h: 1.96, surf: 'wood', pen: 2.8 },
  dresser:  { w: 1.0,  d: .5,   h: .86,  surf: 'wood', pen: 2.8, low: 1 },
  night:    { w: .46,  d: .4,   h: .56,  surf: 'wood', pen: 2.8, low: 1 },
  shelf:    { w: .92,  d: .32,  h: 1.82, surf: 'wood', pen: 2.8 },
  sofa:     { w: 1.86, d: .86,  h: .84,  surf: 'wood', pen: 1.8, low: 1 },
  cupboard: { w: 1.2,  d: .6,   h: .92,  surf: 'wood', pen: 2.8, low: 1 },
  stove:    { w: .86,  d: .64,  h: 1.62, surf: 'metal', pen: 5.5, sol: [[-.43, .43, 0, .86, 0, .64]] },
  desk:     { w: 1.3,  d: .7,   h: .78,  surf: 'wood', pen: 2.8, low: 1, sol: [[-.65, .65, .7, .78, 0, .7], [.2, .65, 0, .7, 0, .7]] },
  chest:    { w: .9,   d: .5,   h: .54,  surf: 'wood', pen: 2.8, low: 1 },
  crates:   { w: 1.0,  d: .82,  h: 1.26, surf: 'wood', pen: 2.8 },
  rack:     { w: 2.0,  d: .56,  h: 2.0,  surf: 'metal', pen: 5 },
  bench:    { w: 1.8,  d: .76,  h: .92,  surf: 'wood', pen: 2.8, low: 1, sol: [[-.9, .9, .8, .92, 0, .76], [-.9, .9, 0, .8, 0, .1]] },
  lockers:  { w: 1.2,  d: .5,   h: 1.86, surf: 'metal', pen: 5.5 },
  filing:   { w: .5,   d: .62,  h: 1.32, surf: 'metal', pen: 5.5 },
  bunk:     { w: 2.0,  d: .94,  h: 1.72, surf: 'metal', pen: 4 },
  console:  { w: 1.6,  d: .8,   h: 1.32, surf: 'metal', pen: 5.5, sol: [[-.8, .8, 0, .96, 0, .8], [-.8, .8, .96, 1.32, 0, .3]] },
  sacks:    { w: 1.2,  d: .86,  h: .62,  surf: 'wood', pen: 1.2, low: 1 },
  shelfDown:{ w: 1.84, d: .64,  h: .38,  surf: 'wood', pen: 2.8, low: 1 },
  table:    { w: 1.4,  d: .86,  h: .78,  surf: 'wood', pen: 2.8, low: 1, sol: [[-.7, .7, .71, .78, 0, .86]] },
  tableBroken: { w: 1.4, d: .86, h: .78, surf: 'wood', pen: 2.8, low: 1, sol: [[-.7, .7, 0, .5, 0, .86]] },
  chair:    { w: .46,  d: .46,  h: .94,  surf: 'wood', pen: 2.8, sol: [[-.23, .23, .42, .48, 0, .46], [-.23, .23, .48, .94, 0, .07]] },
  chairDown:{ w: .5,   d: .98,  h: .48,  surf: 'wood', pen: 2.8, low: 1, sol: [[-.25, .25, 0, .46, 0, .98]] },
};
for (const k in CAT) if (!CAT[k].sol) CAT[k].sol = B(CAT[k].w, CAT[k].d, CAT[k].h);

/* Pièces selon le lieu. `big` : grande salle (hangar, entrepôt, grenier) ; les autres : pièces ordinaires. */
const HOUSE = new Set(['urban', 'valley', 'snow', 'marsh', 'cite', 'hillside', 'mineval']);
const THEMES = {
  bedroom: [['bed2', 'bed'], 'wardrobe', 'night', ['dresser', 'chest'], 'chair', 'shelf'],
  living:  ['sofa', 'shelf', ['dresser', 'cupboard'], 'shelf', 'chest', '@table'],
  kitchen: ['cupboard', 'stove', 'cupboard', 'shelf', '@table'],
  study:   ['desk', 'shelf', 'shelf', 'chest', 'dresser'],
  home:    [['bed2', 'bed'], 'wardrobe', 'sofa', 'shelf', 'cupboard', '@table', 'stove', 'dresser', 'shelf', 'night', 'chest', 'desk', 'bed'],
  homeUp:  [['bed2', 'bed'], 'wardrobe', 'night', 'shelf', 'dresser', 'bed', 'desk', 'chest', '@table', 'sofa', 'shelf', 'night'],
  storage: ['rack', 'crates', 'sacks', 'chest', 'shelfDown', 'crates', 'rack', 'sacks'],
  barn:    ['rack', 'crates', 'bench', 'sacks', 'rack', 'crates', 'chest', 'sacks', 'rack', 'crates', 'bench'],
  office:  ['desk', 'filing', 'lockers', 'desk', 'shelf', 'filing', '@table'],
  dorm:    ['bunk', 'bunk', 'lockers', 'bunk', 'chest', 'lockers', '@table'],
  radio:   ['console', 'console', 'filing', 'rack', 'lockers', 'desk'],
  store:   ['rack', 'crates', 'rack', 'sacks', 'crates', 'lockers', 'rack'],
  cellar:  ['rack', 'crates', 'sacks', 'chest', 'rack', 'crates', 'sacks', 'shelf', 'crates', 'rack'],
  workshop:['bench', 'rack', 'lockers', 'crates', 'rack', 'bench', 'sacks', 'crates', 'rack', 'filing', 'bench'],
};
const pickTheme = (house, big, upper, env, r, area) => {
  if (big) return house ? 'barn' : 'workshop';
  if (house && area > 48) return upper ? (r < .78 ? 'homeUp' : 'storage') : (r < .8 ? 'home' : 'storage');
  if (house) return upper ? (r < .44 ? 'bedroom' : r < .64 ? 'study' : r < .84 ? 'living' : 'storage') : (r < .32 ? 'living' : r < .64 ? 'kitchen' : r < .8 ? 'storage' : 'study');
  if (env === 'airbase' && upper) return 'radio';
  if (env === 'bunker') return r < .34 ? 'radio' : r < .6 ? 'office' : r < .8 ? 'dorm' : 'store';
  return r < .36 ? 'office' : r < .58 ? 'dorm' : r < .76 ? 'radio' : 'store';
};
/* Version guerre : la part des meubles abîmés ou renversés. */
const BROKEN = { chair: 'chairDown', table: 'tableBroken', shelf: 'shelfDown' };

/** Ouvertures de la carte (deux montants de 9 cm de matière `frame`), à tous les étages. */
function openings(L) {
  const ops = L.ops || [], out = [], near = (a, b) => Math.abs(a - b) < .012, isF = o => o && o.t === 'b' && o.m === 'frame';
  for (let i = 0; i + 1 < ops.length; i++) {
    const A = ops[i], Bq = ops[i + 1]; if (!isF(A) || !isF(Bq) || !near(A.y0, Bq.y0) || !near(A.y1, Bq.y1)) continue;
    let ax, a, b, c;
    if (near(A.x1 - A.x0, .09) && near(Bq.x1 - Bq.x0, .09) && A.z1 - A.z0 > .15 && near(A.z0, Bq.z0)) { ax = 'x'; a = A.x1; b = Bq.x0; c = (A.z0 + A.z1) / 2; }
    else if (near(A.z1 - A.z0, .09) && near(Bq.z1 - Bq.z0, .09) && A.x1 - A.x0 > .15 && near(A.x0, Bq.x0)) { ax = 'z'; a = A.z1; b = Bq.z0; c = (A.x0 + A.x1) / 2; }
    else continue;
    if (!(b - a > .5)) continue; i++;
    let sill = false; for (let k = i + 1; k <= i + 2 && k < ops.length; k++) { const q = ops[k]; if (isF(q) && near(q.y1, A.y0) && near(q.y1 - q.y0, .06)) sill = true; }
    const m = (a + b) / 2; out.push({ x: ax === 'x' ? m : c, z: ax === 'x' ? c : m, y: A.y0, top: A.y1, win: sill, hw: (b - a) / 2, ax });
  }
  return out;
}

/** Boîte monde d'un objet posé : origine au milieu du dos, angle th (quart de tour). */
export function itemBox(it, lb) {
  const c = Math.round(Math.cos(it.th)), s = Math.round(Math.sin(it.th)); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const lx of [lb[0], lb[1]]) for (const lz of [lb[4], lb[5]]) { const wx = it.x + lx * c + lz * s, wz = it.z - lx * s + lz * c; if (wx < x0) x0 = wx; if (wx > x1) x1 = wx; if (wz < z0) z0 = wz; if (wz > z1) z1 = wz; }
  return { x0, x1, y0: it.y + lb[2], y1: it.y + lb[3], z0, z1 };
}

/**
 * o : { id, env, size, solids (après les portes et barils), spawns, breach, objectives, levelAt, L (plan de la carte, pour les murs dessinés) }.
 * Rend { items, debris, solids, rooms, stats }.
 */
export function* planFurnitureSteps(o) {       /* [meubles] generator: the loader gives the frame back between steps (validation rc8.2: up to 0.57 s in one piece, 2.4 s on a slow CPU) */
  const T0 = Date.now(), S = o.size, env = o.env || '', house = HOUSE.has(env), rnd = seeded('meubles:' + o.id);
  const stat = []; for (const s of o.solids) if (s.y1 > -30 && s.y0 < 80) stat.push(s);
  const G = createGrid(4); G.build(stat); const buf = [];
  yield; let drawn = null; try { if (o.L) drawn = drawnBoxes(o.L); } catch { drawn = null; }
  let opens = []; try { if (o.L) opens = openings(o.L); } catch { opens = []; }
  yield; const doorPts = opens.filter(q => !q.win).map(q => ({ x: q.x, z: q.z, y: q.y, r: 1.25 + q.hw * .4 }));
  for (const s of o.solids) { const d = s.prop; if (d && d.lf && d.ax) doorPts.push({ x: d.cx, z: d.cz, y: d.y0 || 0, r: 1.25 + (d.b - d.a) * .2 }); }
  const winPts = opens.filter(q => q.win);
  for (const s of o.solids) { const p = s.pane && s.prop; if (p) winPts.push({ x: p.cx, z: p.cz, y: p.y0, top: p.y0 + p.h, hw: (p.b - p.a) / 2, ax: p.ax }); }
  const spawns = (o.spawns || []).map(p => ({ x: p[0], z: p[1] }));
  const bboxes = (o.breach || []).filter(b => b && b.box).map(b => b.box);
  const obj = []; { const ob = o.objectives; if (ob) for (const k of ['zones', 'sites']) for (const p of ob[k] || []) if (Array.isArray(p)) obj.push({ x: p[0], z: p[1] }); }

  /* 1. Points où l'on tient debout sous un plafond (cases de 0,5 m) */
  const N = Math.ceil(2 * S / CS), cellN = new Map(), NH = [], NC = [], NI = [], NJ = [], NS = [];
  const cx = i => -S + (i + .5) * CS;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { if (!i && !(j & 3)) yield;
    const x = cx(i), z = cx(j), n = G.boxQuery(x - .25, x + .25, z - .25, z + .25, buf), hs = [0], sf = ['ground'];
    for (let k = 0; k < n; k++) { const s = buf[k]; if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.y1 < 40 && s.y1 > .01) { hs.push(s.y1); sf.push(s.surface); } }
    let list = null;
    for (let q = 0; q < hs.length; q++) {
      const h = hs[q]; let dup = false; for (let r = 0; r < q; r++) if (Math.abs(hs[r] - h) < .01) dup = true; if (dup) continue;
      let free = true, ceil = 1e9;
      for (let k = 0; k < n; k++) { const s = buf[k]; if (x + .2 > s.x0 && x - .2 < s.x1 && z + .2 > s.z0 && z - .2 < s.z1 && s.y1 > h + .05 && s.y0 < h + HEAD) { free = false; break; } if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.y0 >= h + HEAD - .01 && s.y0 < ceil) ceil = s.y0; }
      if (!free) continue;
      const id = NH.length; NH.push(h); NC.push(ceil); NI.push(i); NJ.push(j); NS.push(sf[q]); (list || (list = [])).push(id);
    }
    if (list) cellN.set(j * N + i, list);
  }
  /* dedans : un plafond, et des murs tout autour (8 rayons à hauteur de genou, au plus un qui sort : la porte) ; une rue sous une passerelle ou un balcon n'est pas une pièce */
  const nN = NH.length, indoor = new Uint8Array(nN), RD = [[1, 0], [-1, 0], [0, 1], [0, -1], [.7071, .7071], [.7071, -.7071], [-.7071, .7071], [-.7071, -.7071]];
  for (let a = 0; a < nN; a++) { if (!(a & 255)) yield; const c = NC[a] - NH[a]; if (!(c >= 2.05 && c <= 12)) continue; const x = cx(NI[a]), z = cx(NJ[a]); let esc = 0;
    for (const [dx, dz] of RD) { if (G.ray(x, NH[a] + .6, z, dx, 0, dz, 16) >= 16) { if (++esc > 1) break; } }
    indoor[a] = esc <= 1 ? 1 : 0; }
  /* 2. Voisins : même pièce, passage, mur, fenêtre, garde-corps, vide */
  const nb = new Int32Array(nN * 4).fill(-1), et = new Uint8Array(nN * 4).fill(OTHER);
  const over = (x0, x1, y0, y1, z0, z1) => G.overlap(x0, x1, y0, y1, z0, z1, buf);
  /* e : longueur de la boîte depuis le centre (0,5 = jusqu'au centre voisin ; 0,72 = toute la case voisine, quand aucun pied n'y tient) */
  const edgeBox = (a, d, y0, y1, e = CS) => { const x = cx(NI[a]), z = cx(NJ[a]); return DX[d] ? over(Math.min(x, x + DX[d] * e), Math.max(x, x + DX[d] * e), y0, y1, z - .12, z + .12) : over(x - .12, x + .12, y0, y1, Math.min(z, z + DZ[d] * e), Math.max(z, z + DZ[d] * e)); };
  for (let a = 0; a < nN; a++) { if (!(a & 255)) yield;
    if (!indoor[a]) continue; const h = NH[a];
    for (let d = 0; d < 4; d++) {
      const ii = NI[a] + DX[d], jj = NJ[a] + DZ[d]; if (ii < 0 || jj < 0 || ii >= N || jj >= N) { et[a * 4 + d] = WALL; continue; }
      const l = cellN.get(jj * N + ii); let best = -1, bd = .36;
      if (l) for (const b of l) { const dh = Math.abs(NH[b] - h); if (dh < bd) { bd = dh; best = b; } }
      const y = best >= 0 ? Math.max(h, NH[best]) : h;
      const e = best >= 0 ? CS : .72;
      if (!edgeBox(a, d, y + .05, y + 1.7, e)) { if (best >= 0) { nb[a * 4 + d] = best; et[a * 4 + d] = PORTAL; } else et[a * 4 + d] = DROP; continue; }
      const lo = !!edgeBox(a, d, h + .05, h + .85, e), mid = !!edgeBox(a, d, h + .95, h + 1.6, e);
      if (lo && mid) et[a * 4 + d] = WALL; else if (lo) et[a * 4 + d] = edgeBox(a, d, h + 2.02, h + 2.3, e) ? WIN : LOW; else et[a * 4 + d] = OTHER;
    }
  }
  /* 3. Pièces : composantes de même hauteur sous plafond */
  const comp = new Int32Array(nN).fill(-1), rooms = []; const q = [];
  for (let a = 0; a < nN; a++) { if (!(a & 1023)) yield;
    if (!indoor[a] || comp[a] >= 0) continue; const R = { id: rooms.length, nodes: [] }; comp[a] = R.id; q.length = 0; q.push(a);
    while (q.length) { const u = q.pop(); R.nodes.push(u); for (let d = 0; d < 4; d++) { const b = nb[u * 4 + d]; if (b >= 0 && et[u * 4 + d] === PORTAL && indoor[b] && comp[b] < 0 && Math.abs(NH[b] - NH[u]) < .02) { comp[b] = R.id; q.push(b); } } }
    rooms.push(R);
  }
  for (let a = 0; a < nN; a++) if (comp[a] >= 0) for (let d = 0; d < 4; d++) { const b = nb[a * 4 + d]; if (b >= 0 && comp[b] === comp[a]) et[a * 4 + d] = ROOM; }

  const items = [], debris = [], placedAll = [], stats = { rooms: 0, skipped: 0, items: 0, debris: 0, tried: 0 };
  const skip = (R, why) => { stats.skipped++; (stats.why || (stats.why = [])).push([why, R.nodes.length * CS * CS, +R.cx.toFixed(1), +R.cz.toFixed(1), +R.h.toFixed(2)]); };
  const ptBox = (p, b) => { const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1), dz = Math.max(b.z0 - p.z, 0, p.z - b.z1); return Math.hypot(dx, dz); };
  for (const R of rooms) { yield;
    const n = R.nodes.length; if (n < 16) continue;
    let closed = 0, open = 0, narrow = 0, sx = 0, sz = 0; const hs = [];
    R.h = NH[R.nodes[0]];
    for (const a of R.nodes) { sx += cx(NI[a]); sz += cx(NJ[a]); hs.push(NC[a] - R.h); for (let d = 0; d < 4; d++) { const t = et[a * 4 + d]; if (t === WALL || t === WIN || t === LOW || t === OTHER) closed++; else if (t === DROP || (t === PORTAL && !indoor[nb[a * 4 + d]])) open++; } }
    hs.sort((p, r) => p - r); R.ceil = hs[hs.length >> 1]; R.cx = sx / n; R.cz = sz / n; R.area = n * CS * CS;
    if (closed < (closed + open) * .56 || R.ceil > 12) { { const tc = [0, 0, 0, 0, 0, 0, 0], ind = [0, 0]; for (const a of R.nodes) for (let d = 0; d < 4; d++) { const t = et[a * 4 + d]; tc[t]++; if (t === PORTAL) ind[indoor[nb[a * 4 + d]]]++; } skip(R, 'open ' + (closed / Math.max(1, closed + open)).toFixed(2) + ' ' + tc.join('/') + ' in' + ind.join('/')); } continue; }
    /* points à garder libres : entrées, passages étroits, bords de trémie, garde-corps */
    const keep = [], isNarrow = new Set();
    const run = (a, d) => { let c = 0, u = a; while (c < 8) { const t = et[u * 4 + d]; if (t !== ROOM) break; u = nb[u * 4 + d]; c++; } return c; };
    for (const a of R.nodes) {
      const x = cx(NI[a]), z = cx(NJ[a]); let pt = 0;
      for (let d = 0; d < 4; d++) { const t = et[a * 4 + d]; if (t === PORTAL) pt = Math.max(pt, 1.15); else if (t === DROP) pt = Math.max(pt, .75); else if (t === LOW) pt = Math.max(pt, .8); }
      const wx = (run(a, 0) + run(a, 1) + 1) * CS, wz = (run(a, 2) + run(a, 3) + 1) * CS;
      const passX = et[a * 4] <= PORTAL && et[a * 4 + 1] <= PORTAL, passZ = et[a * 4 + 2] <= PORTAL && et[a * 4 + 3] <= PORTAL;
      if ((wx <= 1.75 && passZ) || (wz <= 1.75 && passX)) { pt = Math.max(pt, 1.0); isNarrow.add(a); narrow++; }
      if (pt) keep.push({ x, z, r: pt, a });
    }
    if (narrow > n * .55) { skip(R, 'narrow'); continue; }
    const seeds = R.nodes.filter(a => { for (let d = 0; d < 4; d++) if (et[a * 4 + d] === PORTAL || et[a * 4 + d] === DROP) return true; return isNarrow.has(a); });
    if (!seeds.length) { skip(R, 'sealed'); continue; }
    /* murs : nœuds au bord d'un mur plein ou d'une fenêtre, regroupés par plan */
    const segMap = new Map();
    for (const a of R.nodes) for (let d = 0; d < 4; d++) {
      const t = et[a * 4 + d]; if (t !== WALL && t !== WIN) continue;
      const x = cx(NI[a]), z = cx(NJ[a]); let tt = 1;
      for (const y of [.12, .5, 1.2]) { if (t === WIN && y > 1) continue; const r = G.ray(x, R.h + y, z, DX[d], 0, DZ[d], 1); if (r < tt) tt = r; }
      if (tt >= .99 || tt < .15) continue;
      const f = (DX[d] ? x : z) + tt * (DX[d] + DZ[d]), key = d + '|' + Math.round(f * 25);
      let s = segMap.get(key); if (!s) { s = { d, f, n: [] }; segMap.set(key, s); } s.n.push({ u: DX[d] ? z : x, win: t === WIN, a });
    }
    const segs = [];
    for (const s of segMap.values()) { s.n.sort((p, r) => p.u - r.u); let cur = null; for (const e of s.n) { if (!cur || e.u - cur.u1 > CS + .01) { cur = { d: s.d, f: s.f, u0: e.u, u1: e.u, win: [] }; segs.push(cur); } cur.u1 = e.u; if (e.win) cur.win.push(e.u); } }
    for (const s of segs) { s.u0 -= CS / 2; s.u1 += CS / 2; s.len = s.u1 - s.u0; }
    if (!segs.length) { skip(R, 'nowall'); continue; }
    stats.rooms++;
    const upper = R.h - (o.levelAt ? o.levelAt(R.cx, R.cz) || 0 : 0) > 1.4;
    const big = R.ceil >= 4.6 || R.area >= (house ? 170 : 90);
    const under = o.levelAt && R.h < (o.levelAt(R.cx, R.cz) || 0) - 1.5;
    if (under && env === 'cite') { skip(R, 'metro'); continue; }       /* sous la Cité : métro et voies, pas des caves */
    const theme = under ? 'cellar' : pickTheme(house, big, upper, env, rnd(), R.area);
    R.theme = theme;
    const placed = [], decor = [];
    const fits = (it, spec) => {
      stats.tried++;
      const boxes = spec.sol.map(lb => itemBox(it, lb)), A = itemBox(it, [-spec.w / 2, spec.w / 2, 0, spec.h, 0, spec.d]);
      if (A.x0 < -S + .4 || A.x1 > S - .4 || A.z0 < -S + .4 || A.z1 > S - .4) return null;
      if (over(A.x0 + .005, A.x1 - .005, A.y0 + .03, A.y1, A.z0 + .005, A.z1 - .005)) return null;
      if (drawn && drawn(A.x0 + .015, A.x1 - .015, A.y0 + .05, A.y1 - .01, A.z0 + .015, A.z1 - .015)) return null;
      for (const [u, v] of [[.06, .06], [.94, .06], [.06, .94], [.94, .94], [.5, .5]]) { const px = A.x0 + (A.x1 - A.x0) * u, pz = A.z0 + (A.z1 - A.z0) * v, f = G.floorAt(px, it.y + .05, pz, .1); if (Math.abs(f - it.y) > .03) return null; }
      for (const p of placed) if (A.x1 + .03 > p.A.x0 && A.x0 - .03 < p.A.x1 && A.z1 + .03 > p.A.z0 && A.z0 - .03 < p.A.z1) return null;
      for (const k of keep) if (ptBox(k, A) < k.r) return null;
      for (const p of doorPts) if (Math.abs(p.y - it.y) < 1.2 && ptBox(p, A) < p.r) return null;
      for (const p of spawns) if (ptBox(p, A) < 1.6) return null;
      for (const p of obj) if (ptBox(p, A) < 2.6) return null;
      for (const b of bboxes) if (b.y0 < A.y1 + .5 && b.y1 > A.y0 && Math.max(b.x0 - A.x1, 0, A.x0 - b.x1) < 1.6 && Math.max(b.z0 - A.z1, 0, A.z0 - b.z1) < 1.6) return null;
      for (const p of winPts) { const sill = p.y - it.y; if (sill > .2 && sill < 2.2 && spec.h > sill - .06 && ptBox(p, A) < p.hw + .12) return null; }
      return { A, boxes };
    };
    const pathOK = () => {
      const free = new Set(); for (const a of R.nodes) { const x = cx(NI[a]), z = cx(NJ[a]); let ok = true; for (const p of placed) { const A = p.A; if (x > A.x0 - BODY && x < A.x1 + BODY && z > A.z0 - BODY && z < A.z1 + BODY) { ok = false; break; } } if (ok) free.add(a); }
      for (const s of seeds) if (!free.has(s)) return false;
      const seen = new Set([seeds[0]]), st = [seeds[0]];
      while (st.length) { const u = st.pop(); for (let d = 0; d < 4; d++) { const b = nb[u * 4 + d]; if (b >= 0 && et[u * 4 + d] === ROOM && free.has(b) && !seen.has(b)) { seen.add(b); st.push(b); } } }
      for (const s of seeds) if (!seen.has(s)) return false;
      return seen.size >= free.size * .8;
    };
    const commit = (it, spec, f) => { placed.push({ it, A: f.A, boxes: f.boxes, spec }); if (!pathOK()) { placed.pop(); return false; } return true; };
    /* contre un mur */
    const wallPut = (m, pref) => {
      const spec = CAT[m], cand = [];
      for (const s of segs) {
        if (s.len < spec.w + .02) continue;
        for (let u = s.u0 + spec.w / 2 + .01; u <= s.u1 - spec.w / 2 - .01 + 1e-6; u += .25) {
          const t = (u - s.u0 - spec.w / 2) / Math.max(.01, s.len - spec.w), edge = Math.min(t, 1 - t);
          let sc = rnd() * .6 + (pref === 'corner' ? edge * 2 : pref === 'mid' ? -edge * 2 : 0);
          if (spec.h > .86 && s.win.some(w => Math.abs(w - u) < spec.w / 2 + .3)) continue;
          cand.push({ s, u, sc });
        }
        if (s.len >= spec.w + .02) { cand.push({ s, u: s.u0 + spec.w / 2 + .01, sc: (pref === 'corner' ? -.5 : .5) + rnd() * .6 }); cand.push({ s, u: s.u1 - spec.w / 2 - .01, sc: (pref === 'corner' ? -.5 : .5) + rnd() * .6 }); }
      }
      cand.sort((p, r) => p.sc - r.sc);
      let tries = 0;
      for (const c of cand) {
        if (++tries > 70) break;
        const s = c.s, d = s.d, sg = DX[d] + DZ[d];
        for (const gap of [.02, .06, .11]) {
          const it = { m, x: DX[d] ? s.f - sg * gap : c.u, z: DX[d] ? c.u : s.f - sg * gap, y: R.h, th: DX[d] ? -DX[d] * Math.PI / 2 : (DZ[d] > 0 ? Math.PI : 0), seed: rnd(), v: 0 };
          const f = fits(it, spec); if (!f) continue;
          if (commit(it, spec, f)) return it;
          break;
        }
      }
      return null;
    };
    /* table au milieu, chaises autour (certaines renversées) */
    const tablePut = () => {
      const cand = R.nodes.map(a => ({ x: cx(NI[a]), z: cx(NJ[a]) })).sort((p, r) => Math.hypot(p.x - R.cx, p.z - R.cz) - Math.hypot(r.x - R.cx, r.z - R.cz)).slice(0, 24);
      for (const c of cand) {
        const rot = rnd() < .5, broken = rnd() < .22, m = broken ? 'tableBroken' : 'table', spec = CAT[m], th = rot ? Math.PI / 2 : 0;
        const it = { m, x: c.x - (rot ? spec.d / 2 : 0), z: c.z - (rot ? 0 : spec.d / 2), y: R.h, th, seed: rnd(), v: 0 };
        const f = fits(it, spec); if (!f) continue;
        const A = f.A; if (over(A.x0 - .75, A.x1 + .75, R.h + .1, R.h + 1.6, A.z0 - .75, A.z1 + .75)) continue;
        if (!commit(it, spec, f)) continue;
        const out = [it]; const L2 = rot ? A.z1 - A.z0 : A.x1 - A.x0;
        /* chaises : de chaque côté long, face à la table */
        const sides = [];
        for (const sg of [-1, 1]) for (const off of (L2 > 1.2 ? [-.35, .35] : [0])) {
          if (!rot) sides.push({ x: c.x + off, z: (sg < 0 ? A.z0 - .08 : A.z1 + .08), th: sg < 0 ? 0 : Math.PI, back: sg });
          else sides.push({ x: (sg < 0 ? A.x0 - .08 : A.x1 + .08), z: c.z + off, th: sg < 0 ? Math.PI / 2 : -Math.PI / 2, back: sg });
        }
        for (const p of sides) {
          if (rnd() < .3) continue;
          const down = rnd() < .28, cm = down ? 'chairDown' : 'chair', cs = CAT[cm];
          /* une chaise : son dos côté pièce, son avant contre la table ; origine au dos */
          const dirx = Math.round(Math.sin(p.th)), dirz = Math.round(Math.cos(p.th));
          const back = down ? .98 : .46;
          const ci = { m: cm, x: p.x - dirx * (back - (down ? .1 : .02)) * 1, z: p.z - dirz * (back - (down ? .1 : .02)), y: R.h, th: p.th, seed: rnd(), v: 0 };
          const cf = fits(ci, cs); if (!cf) continue;
          if (commit(ci, cs, cf)) out.push(ci);
        }
        return out;
      }
      return null;
    };
    const list = THEMES[theme] || THEMES.storage, want = big ? Math.min(12, Math.max(3, Math.round(R.area / 9))) : Math.min(house ? 16 : 10, Math.max(2, Math.round(R.area / (R.area > 48 ? 5.5 : 4))));
    let count = 0, tables = 0;
    for (let pass = 0, li = 0; pass < 3 && count < want; li++) {
      if (li >= list.length) { li = -1; pass++; continue; }
      const e = list[li];
      if (pass && e === '@table' && (tables >= 2 || R.area < 60)) continue;
      if (e === '@table') { if (R.area < 11) continue; const r = tablePut(); if (r) { for (const it of r) items.push(it); count++; tables++; if (house && !under) decor.push({ k: 'rug', x: (r[0].x + itemBox(r[0], CAT.table.sol[0]).x0 * 0) , it: r[0] }); } continue; }
      let m = Array.isArray(e) ? e[Math.floor(rnd() * e.length)] : e;
      if (m === 'bed2' && R.area < 12) m = 'bed';
      if (BROKEN[m] && rnd() < .24) m = BROKEN[m];
      const pref = m === 'wardrobe' || m === 'lockers' || m === 'shelf' || m === 'filing' || m === 'crates' ? 'corner' : m === 'bed' || m === 'bed2' || m === 'sofa' || m === 'bunk' ? 'mid' : null;
      const it = wallPut(m, pref); if (!it) continue;
      it.v = rnd() < .28 ? 1 : 0; items.push(it); count++;
      /* une chaise devant le bureau */
      if (m === 'desk' || m === 'console') { const s = CAT[m], c = Math.round(Math.cos(it.th)), sn = Math.round(Math.sin(it.th)); const down = rnd() < .25, cm = down ? 'chairDown' : 'chair', cs = CAT[cm], lz = s.d + (down ? .1 : .04) + cs.d, lx = m === 'desk' ? -.24 : 0, ci = { m: cm, x: it.x + lx * c + lz * sn, z: it.z - lx * sn + lz * c, y: R.h, th: it.th + Math.PI, seed: rnd(), v: 0 }; const cf = fits(ci, cs); if (cf && commit(ci, cs, cf)) items.push(ci); }
    }
    for (const p of placed) { placedAll.push(p); }
    /* point de vue pour les planches de contrôle : devant le plus gros meuble, 2 à 3,5 m, sur un nœud libre */
    { let best = null, bd = -1e9; const big2 = placed.slice().sort((p, r2) => (r2.A.x1 - r2.A.x0) * (r2.A.z1 - r2.A.z0) - (p.A.x1 - p.A.x0) * (p.A.z1 - p.A.z0))[0];
      if (big2) { const A = big2.A, mx = (A.x0 + A.x1) / 2, mz = (A.z0 + A.z1) / 2, fx = Math.round(Math.sin(big2.it.th)), fz = Math.round(Math.cos(big2.it.th));
        for (const a of R.nodes) { const x = cx(NI[a]), z = cx(NJ[a]), dx = x - mx, dz = z - mz, dist = Math.hypot(dx, dz); if (dist < 2 || dist > 4) continue; let ok = true; for (const p of placed) { const B2 = p.A; if (x > B2.x0 - .4 && x < B2.x1 + .4 && z > B2.z0 - .4 && z < B2.z1 + .4) ok = false; } if (!ok) continue;
          const sc = (dx * fx + dz * fz) / dist - Math.abs(dist - 2.8) * .3; if (sc > bd) { bd = sc; best = { x, z, tx: mx, tz: mz }; } } }
      R.view = best; R.nItems = placed.length; }
    /* débris au sol : papiers, planches cassées, plâtre, livres, éclats de verre (aucune collision) */
    for (const q of decor.splice(0)) { const A = itemBox(q.it, [-CAT.table.w / 2, CAT.table.w / 2, 0, .01, 0, CAT.table.d]), cxr = (A.x0 + A.x1) / 2, czr = (A.z0 + A.z1) / 2, rx = (A.x1 - A.x0) / 2 + .55, rz = (A.z1 - A.z0) / 2 + .55;
      if (!over(cxr - rx, cxr + rx, R.h + .005, R.h + .03, czr - rz, czr + rz) && !(drawn && drawn(cxr - rx, cxr + rx, R.h + .01, R.h + .03, czr - rz, czr + rz))) debris.push({ k: 'rug', x: cxr, z: czr, y: R.h, th: 0, s: rx, s2: rz, seed: rnd() }); }
    const nd = Math.min(22, Math.round(R.area * (big ? .16 : .34)) + 3);
    const freeAt = (x, z, r) => { for (const p of placed) { const A = p.A; if (x > A.x0 - r && x < A.x1 + r && z > A.z0 - r && z < A.z1 + r) return false; } return !over(x - r, x + r, R.h + .01, R.h + .14, z - r, z + r) && !(drawn && drawn(x - r, x + r, R.h + .02, R.h + .12, z - r, z + r)); };
    for (let i = 0; i < nd; i++) {
      const a = R.nodes[Math.floor(rnd() * n)], x = cx(NI[a]) + (rnd() - .5) * .45, z = cx(NJ[a]) + (rnd() - .5) * .45, r = rnd();
      let wallSide = false; for (let d = 0; d < 4; d++) if (et[a * 4 + d] === WALL) wallSide = true;
      const k = r < .46 ? 'paper' : r < .62 ? 'plank' : r < .8 ? (wallSide ? 'plaster' : 'paper') : r < .92 ? 'book' : 'shard';
      const rad = k === 'plank' ? .5 : k === 'plaster' ? .3 : .16;
      if (!freeAt(x, z, rad)) continue;
      debris.push({ k, x, z, y: R.h, th: rnd() * Math.PI * 2, s: rnd(), seed: rnd() });
    }
  }
  /* collisions des meubles : boîtes monde, ignorées par la mini-carte (mm 0) */
  const solids = [];
  for (const p of placedAll) for (const b of p.boxes) solids.push({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1, surface: p.spec.surf, pen: p.spec.pen, mm: 0, furn: 1 });
  stats.items = items.length; stats.debris = debris.length; stats.ms = Date.now() - T0; stats.nodes = nN; stats.allRooms = rooms.filter(r => r.nodes.length >= 16).length;
  return { items, debris, solids, rooms: rooms.filter(r => r.theme), stats };
}
/** [meubles] Same plan in one go (Node tools, synchronous map loads). */
export function planFurniture(o) { const g = planFurnitureSteps(o); for (;;) { const r = g.next(); if (r.done) return r.value; } }
