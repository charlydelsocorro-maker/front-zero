/* FRONT ZÉRO — map-seams.js : ferme les fentes fines entre murs, dalles, toits et cadres (rendu ET collision), sur le layout,
   avant le rendu et avant map-soften. Appelé par maps.js (buildLayout et cartes à étapes) ; s'il manque ou échoue, la carte reste telle quelle.
   Règle : deux boîtes dessinées (t:'b') qui se font face à 1,5 mm - 15 cm, avec au moins 5 cm de recouvrement sur les deux autres axes et une
   profondeur de joint de 10 à 80 cm (une épaisseur de mur ou de dalle), sont jointes :
   - la pièce dont la face couvre le joint (>= 85 %) est prolongée jusqu'à l'autre, au millimètre (pas de recouvrement dessiné : pas de z-fighting) ;
     sa collision suit, avec 1 cm de recouvrement si l'autre pièce a aussi une collision ;
   - sinon un bouchon de la taille exacte du joint, dans le matériau de la pièce la plus couvrante (collision si les deux pièces en ont).
   Jamais : véhicules, bordures (bq), décor lointain, pièces fines, montants de 9 cm (portes/fenêtres relues par map-props et map-soften).
   Aussi : suspente fine (rendu seul) pour une lampe de plafond qui pend à plus de 3,5 cm sous ce qui la porte.
   Aucun matériau, lumière ni shader nouveau : les pièces ajoutées reprennent un matériau déjà présent sur la carte (même ordre de création des textures). */

const NOT_WALL = /^(crate|barrel|cont|paint|rubber|glass|tarp|lamp|pipe|asph|burn|hull|far|leaf|chain|fence|gnd|steel|pal|light|tank|water|ar_leaf|ar_needle|ar_cable|ar_iron|ar_rail)/;
const TRIM = /^(frame|ar_frame|ar_trim)/;
const MAXG = .15, MING = .0015, MINOV = .05, MAXDEPTH = .8;
const LO = ['x0', 'y0', 'z0'], HI = ['x1', 'y1', 'z1'];
const jamb = o => TRIM.test(o.m) && (Math.abs(o.x1 - o.x0 - .09) < .012 || Math.abs(o.z1 - o.z0 - .09) < .012);

export function seal(L) {
  if (!L || !L.ops || L.__sealed) return L;
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0, stat = { joints: 0, extended: 0, fillers: 0, solids: 0, hangers: 0 };
  const used = new Set(L.ops.map(o => o.m));
  /* pièces candidates : boîtes dessinées alignées, murs/dalles/cadres, sur l'aire de jeu */
  const S = L.size || 1e9, P = [];
  for (const o of L.ops) {
    if (o.t !== 'b' || !o.m || o.vh || o.bq || o.fine || o.under || /^far/.test(o.m) || NOT_WALL.test(o.m)) continue;
    if (Math.max(o.x1 - o.x0, o.z1 - o.z0) < .5 && !TRIM.test(o.m)) continue;               // poteaux, piles, tuyaux : pas des murs
    if (o.x1 < -S || o.x0 > S || o.z1 < -S || o.z0 > S) continue;
    P.push(o);
  }
  /* collision jumelle (même boîte au millimètre) */
  const sk = (x0, x1, z0, z1) => Math.round(x0 * 500) + ',' + Math.round(x1 * 500) + ',' + Math.round(z0 * 500) + ',' + Math.round(z1 * 500);
  const SM = new Map(); for (const s of L.solids) { const k = sk(s.x0, s.x1, s.z0, s.z1); let l = SM.get(k); if (!l) SM.set(k, l = []); l.push(s); }
  const twin = o => { const l = SM.get(sk(o.x0, o.x1, o.z0, o.z1)); if (l) for (const s of l) if (Math.abs(s.y0 - o.y0) < .002 && Math.abs(s.y1 - o.y1) < .002) return s; return null; };
  for (const o of P) o.__s = twin(o);
  /* index spatial 2 m */
  const H = new Map(), K = (i, j) => i * 100003 + j;
  P.forEach((o, n) => { for (let i = Math.floor(o.x0 / 2); i <= Math.floor(o.x1 / 2); i++) for (let j = Math.floor(o.z0 / 2); j <= Math.floor(o.z1 / 2); j++) { const k = K(i, j); let l = H.get(k); if (!l) H.set(k, l = []); l.push(n); } });
  const lo = o => [o.x0, o.y0, o.z0], hi = o => [o.x1, o.y1, o.z1];
  const n = P.length, BL = new Float64Array(n * 3), BH = new Float64Array(n * 3), TR = new Uint8Array(n), stamp = new Int32Array(n);
  P.forEach((o, i) => { BL[i * 3] = o.x0; BL[i * 3 + 1] = o.y0; BL[i * 3 + 2] = o.z0; BH[i * 3] = o.x1; BH[i * 3 + 1] = o.y1; BH[i * 3 + 2] = o.z1; TR[i] = TRIM.test(o.m) ? 1 : 0; });
  const joints = [];
  for (let ia = 0; ia < n; ia++) {
    const A = P[ia], a3 = ia * 3;
    for (let i = Math.floor((BL[a3] - MAXG) / 2); i <= Math.floor((BH[a3] + MAXG) / 2); i++) for (let j = Math.floor((BL[a3 + 2] - MAXG) / 2); j <= Math.floor((BH[a3 + 2] + MAXG) / 2); j++) { const cell = H.get(K(i, j)); if (cell) for (let q = 0; q < cell.length; q++) {
      const ib = cell[q]; if (ib === ia || stamp[ib] === ia + 1) continue; stamp[ib] = ia + 1; if (TR[ia] && TR[ib]) continue;
      const b3 = ib * 3;
      /* B devant A sur un axe, à moins de 15 cm, et recouvrement sur les deux autres : test rapide avant tout calcul */
      let kk = -1; for (let k = 0; k < 3; k++) { const g = BL[b3 + k] - BH[a3 + k]; if (g >= MING && g <= MAXG) { kk = k; break; } }
      if (kk < 0) continue;
      const B = P[ib], al = lo(A), ah = hi(A), bl = lo(B), bh = hi(B);
      for (let k = kk; k < 3; k++) {
        const g = bl[k] - ah[k]; if (g < MING || g > MAXG) continue;
        const o2 = [0, 1, 2].filter(a => a !== k), ov = o2.map(a => [Math.max(al[a], bl[a]), Math.min(ah[a], bh[a])]);
        if (ov[0][1] - ov[0][0] < MINOV || ov[1][1] - ov[1][0] < MINOV) continue;
        const si = ov[0][1] - ov[0][0] <= ov[1][1] - ov[1][0] ? 0 : 1, s = o2[si], dS = ov[si][1] - ov[si][0];
        if (dS > MAXDEPTH || dS < .1) continue;
        if (ah[s] - al[s] > MAXDEPTH + .3 && bh[s] - bl[s] > MAXDEPTH + .3) continue;
        /* déjà fermé : le milieu du joint est dans une autre pièce (bandeau dans l'épaisseur d'un mur, etc.) */
        const mid = [0, 0, 0]; mid[k] = ah[k] + g / 2; o2.forEach((a, n) => { mid[a] = (ov[n][0] + ov[n][1]) / 2; });
        let shut = false; for (const ic of H.get(K(Math.floor(mid[0] / 2), Math.floor(mid[2] / 2))) || []) { const C = P[ic]; if (C !== A && C !== B && mid[0] > C.x0 && mid[0] < C.x1 && mid[1] > C.y0 && mid[1] < C.y1 && mid[2] > C.z0 && mid[2] < C.z1) { shut = true; break; } }
        if (shut) continue;
        const area = ov.reduce((m, r) => m * (r[1] - r[0]), 1), fa = o2.reduce((m, a) => m * (ah[a] - al[a]), 1), fb = o2.reduce((m, a) => m * (bh[a] - bl[a]), 1);
        joints.push({ A, B, k, g, ov, o2, ca: area / fa, cb: area / fb });
      }
    } }
  }
  /* une face n'est prolongée que si toutes ses fentes mènent au même plan */
  const faceKey = (o, k, side) => o.__id + ':' + k + side; let id = 0; for (const o of P) o.__id = id++;
  const plan = new Map(); for (const J of joints) { const kA = faceKey(J.A, J.k, '+'), kB = faceKey(J.B, J.k, '-'), tA = hi(J.B)[J.k] * 0 + lo(J.B)[J.k], tB = hi(J.A)[J.k];
    for (const [kk, t] of [[kA, tA], [kB, tB]]) { const p = plan.get(kk); if (p === undefined) plan.set(kk, t); else if (Math.abs(p - t) > .001) plan.set(kk, NaN); } }
  const add = [], addS = [];
  for (const J of joints) {
    const { A, B, k, g, ov, o2 } = J; stat.joints++;
    const canA = J.ca >= .85 && !jamb(A) && !Number.isNaN(plan.get(faceKey(A, k, '+'))), canB = J.cb >= .85 && !jamb(B) && !Number.isNaN(plan.get(faceKey(B, k, '-')));
    const both = !!(A.__s && B.__s);
    if (canA && (J.ca >= J.cb || !canB)) {
      if (A[HI[k]] < B[LO[k]] - 1e-9) { A[HI[k]] = B[LO[k]]; stat.extended++; }
      if (A.__s) { const v = B[LO[k]] + (B.__s ? .01 : 0); if (A.__s[HI[k]] < v) { A.__s[HI[k]] = v; stat.solids++; } }
    } else if (canB) {
      if (B[LO[k]] > A[HI[k]] + 1e-9) { B[LO[k]] = A[HI[k]]; stat.extended++; }
      if (B.__s) { const v = A[HI[k]] - (A.__s ? .01 : 0); if (B.__s[LO[k]] > v) { B.__s[LO[k]] = v; stat.solids++; } }
    } else {
      const f = { t: 'b', m: J.ca >= J.cb ? A.m : B.m, seam: 1 }; f[LO[k]] = A[HI[k]]; f[HI[k]] = B[LO[k]];
      o2.forEach((a, n) => { f[LO[a]] = ov[n][0]; f[HI[a]] = ov[n][1]; });
      if (f[HI[k]] - f[LO[k]] > 1e-4) { add.push(f); stat.fillers++; }
      if (both) { const c = { x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y1, z0: f.z0, z1: f.z1, surface: A.__s.surface }; c[LO[k]] -= .01; c[HI[k]] += .01; addS.push(c); stat.solids++; }
    }
  }
  for (const o of P) { delete o.__s; delete o.__id; }
  /* suspentes des lampes de plafond (rendu seul) */
  const rod = used.has('steel') ? 'steel' : used.has('frame') ? 'frame' : used.has('ar_iron') ? 'ar_iron' : null;
  const lamps = rod ? L.ops.filter(o => (o.t === 'b' || o.t === 'r') && /^lamp/.test(o.m || '')) : [];
  /* boîtes pouvant porter une lampe : t:'b', et t:'r' à un quart de tour près (toits posés en boîtes tournées) */
  const box = q => { if (q.t === 'b') return q; if (q.t !== 'r') return null; const r = ((q.ry % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2); if (r > 1e-4 && Math.PI / 2 - r > 1e-4) return null; const odd = Math.round(q.ry / (Math.PI / 2)) & 1, w = odd ? q.d : q.w, d = odd ? q.w : q.d; return { t: 'b', m: q.m, x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y, y1: q.y + q.h, z0: q.z - d / 2, z1: q.z + d / 2, src: q }; };
  const QH = new Map(); if (lamps.length) for (const q0 of L.ops) { const q = q0.m && !/^(far|lamp|glass)/.test(q0.m) ? box(q0) : null; if (!q || q.y1 < 1.5) continue; for (let i = Math.floor(q.x0 / 2); i <= Math.floor(q.x1 / 2); i++) for (let j = Math.floor(q.z0 / 2); j <= Math.floor(q.z1 / 2); j++) { const k = K(i, j); let l = QH.get(k); if (!l) QH.set(k, l = []); l.push(q); } }
  for (const o of lamps) {
    const b = o.t === 'b' ? o : { x0: o.x - Math.max(o.w, o.d) / 2, x1: o.x + Math.max(o.w, o.d) / 2, y0: o.y, y1: o.y + o.h, z0: o.z - Math.max(o.w, o.d) / 2, z1: o.z + Math.max(o.w, o.d) / 2 };
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, top = b.y1; let ceil = Infinity, touch = false;
    const near = new Set(); for (let i = Math.floor((b.x0 - .04) / 2); i <= Math.floor((b.x1 + .04) / 2); i++) for (let j = Math.floor((b.z0 - .04) / 2); j <= Math.floor((b.z1 + .04) / 2); j++) for (const q of QH.get(K(i, j)) || []) near.add(q);
    for (const q of near) { if (q === o || q.t !== 'b' || !q.m || /^(far|lamp|glass)/.test(q.m)) continue; if (cx < q.x0 || cx > q.x1 || cz < q.z0 || cz > q.z1) { if (q.x0 <= b.x1 + .035 && q.x1 >= b.x0 - .035 && q.z0 <= b.z1 + .035 && q.z1 >= b.z0 - .035 && q.y0 <= b.y1 + .035 && q.y1 >= b.y0 - .035) touch = true; continue; } if (q.y0 >= top - .001 && q.y0 < ceil) ceil = q.y0; if (q.y0 < top + .035 && q.y1 > b.y0 - .035) touch = true; }
    if (touch || !(ceil - top > .035 && ceil - top < 1.6)) continue;
    const long = b.x1 - b.x0 > .8 ? 'x' : b.z1 - b.z0 > .8 ? 'z' : null, pts = long === 'x' ? [[b.x0 + .2, cz], [b.x1 - .2, cz]] : long === 'z' ? [[cx, b.z0 + .2], [cx, b.z1 - .2]] : [[cx, cz]];
    for (const [x, z] of pts) { add.push({ t: 'b', x0: x - .008, x1: x + .008, y0: top, y1: ceil, z0: z - .008, z1: z + .008, m: rod, seam: 1 }); stat.hangers++; }
  }
  for (const f of add) L.ops.push(f);
  for (const c of addS) L.solids.push(c);
  L.__sealed = stat; stat.ms = typeof performance !== 'undefined' ? +(performance.now() - t0).toFixed(1) : 0;
  return L;
}
