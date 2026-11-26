// FRONT ZÉRO — "Zone" mode: compact battle royale. Client side: world (crates, wall), HUD, bot director, offline referee and online mirror.
// Online the server decides (zone-referee.js); offline this module does, with the same rules (zone-rules.js).
// Everything drawn is created in start(), so the engine's loader links its programs behind the loading screen. Nothing is built during play.
import * as THREE from 'three';
import './zone-rules.js';

const R = globalThis.FZZoneRules;
/** Squads (Zone Duo / Trio / Quatuor, zone-squads.js): loaded on its own, so a failure there leaves plain Zone untouched. */
let SQM = null;
import('./zone-squads.js').then(m => { SQM = m; }).catch(e => console.warn('[zone] squads unavailable', e));
const squadSize = cfg => (SQM && cfg && SQM.valid(cfg.squad) ? cfg.squad : 0);
const CAP = 60, OPEN_D = 2.6, OPEN_NEAR = 1.6, USE_D = 2.2, WALL_H = 46, DEPLOY = 4, BODY = 0.42, LID_OPEN = 1.95, LID_RATE = 5.5, HINGE_Y = 0.47, HINGE_Z = -0.31;
const AMBER = '#e8a628', RED = '#ff5a4a', BLUE = '#4aa3ff';

/* ---------- strings: [fr, en, es, de, pt, it] ---------- */
const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];
const TXT = {
  open: ['[{key}] Ouvrir la caisse', '[{key}] Open the crate', '[{key}] Abrir la caja', '[{key}] Kiste öffnen', '[{key}] Abrir a caixa', '[{key}] Apri la cassa'],
  leave: ['[{key}] Quitter le match', '[{key}] Leave the match', '[{key}] Salir de la partida', '[{key}] Match verlassen', '[{key}] Sair da partida', '[{key}] Lascia la partita'],
  alive: ['EN VIE', 'ALIVE', 'CON VIDA', 'AM LEBEN', 'VIVOS', 'IN VITA'],
  kills: ['ÉLIM.', 'KILLS', 'BAJAS', 'KILLS', 'ABATES', 'UCCISIONI'],
  zone: ['ZONE {n}/{m}', 'ZONE {n}/{m}', 'ZONA {n}/{m}', 'ZONE {n}/{m}', 'ZONA {n}/{m}', 'ZONA {n}/{m}'],
  last: ['ZONE FINALE', 'FINAL ZONE', 'ZONA FINAL', 'LETZTE ZONE', 'ZONA FINAL', 'ZONA FINALE'],
  wait: ['La zone se referme bientôt', 'The zone closes soon', 'La zona se cierra pronto', 'Die Zone schließt sich bald', 'A zona fecha em breve', 'La zona si chiude a breve'],
  shrink: ['La zone se referme', 'The zone is closing', 'La zona se está cerrando', 'Die Zone schließt sich', 'A zona está a fechar', 'La zona si sta chiudendo'],
  obj: ['Dernier en vie gagne', 'Last one standing wins', 'Gana el último en pie', 'Der Letzte gewinnt', 'Vence o último de pé', 'Vince l’ultimo in vita'],
  deploy: ['Déploiement…', 'Deploying…', 'Desplegando…', 'Einsatz…', 'A destacar…', 'Schieramento…'],
  inside: ['DANS LA ZONE', 'IN THE ZONE', 'EN LA ZONA', 'IN DER ZONE', 'NA ZONA', 'NELLA ZONA'],
  outside: ['HORS ZONE', 'OUTSIDE', 'FUERA', 'AUSSERHALB', 'FORA', 'FUORI'],
  toNext: ['PROCHAINE ZONE', 'NEXT ZONE', 'PRÓXIMA ZONA', 'NÄCHSTE ZONE', 'PRÓXIMA ZONA', 'PROSSIMA ZONA'],
  announced: ['Nouvelle zone annoncée', 'New zone announced', 'Nueva zona anunciada', 'Neue Zone angekündigt', 'Nova zona anunciada', 'Nuova zona annunciata'],
  med: ['+{n} santé', '+{n} health', '+{n} salud', '+{n} Leben', '+{n} vida', '+{n} salute'],
  arm: ['+{n} blindage', '+{n} armour', '+{n} blindaje', '+{n} Panzerung', '+{n} blindagem', '+{n} corazza'],
  place: ['Classement', 'Placement', 'Posición', 'Platzierung', 'Classificação', 'Posizione'],
  winner: ['Vainqueur', 'Winner', 'Ganador', 'Sieger', 'Vencedor', 'Vincitore'],
  won: ['DERNIER DEBOUT', 'LAST ONE STANDING', 'EL ÚLTIMO EN PIE', 'DER LETZTE', 'O ÚLTIMO DE PÉ', 'L’ULTIMO IN VITA'],
  out: ['ÉLIMINÉ · #{n}', 'ELIMINATED · #{n}', 'ELIMINADO · #{n}', 'AUSGESCHIEDEN · #{n}', 'ELIMINADO · #{n}', 'ELIMINATO · #{n}'],
  watched: ['MATCH OBSERVÉ', 'MATCH WATCHED', 'PARTIDA OBSERVADA', 'MATCH BEOBACHTET', 'PARTIDA OBSERVADA', 'PARTITA OSSERVATA'],
};
function makeL(E) {
  return (key, p) => {
    const row = TXT[key], i = Math.max(0, LANGS.indexOf(E.i18n && E.i18n.lang)); let s = row ? row[i] || row[0] : key;
    if (p) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));
    return s;
  };
}
const interactKey = E => { try { const s = E.settings, code = s.get('keys.interact'); return s.keyLabel ? s.keyLabel(code) : 'E'; } catch { return 'E'; } };
const fmtClock = s => { const v = Math.max(0, Math.ceil(s)); return Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0'); };

/* ---------- map survey: where crates, spawns and the final circle may go ---------- */
export function surveyMap(E, H) {
  const I = E.internals, nav = I.nav, grid = I.grid, mover = I.mover, size = E.world.size, n = nav.nodes, o = { x: 0, y: 0, z: 0 }, lim = size - 1.5;
  const crates = [], want = Math.min(CAP, R.crateCount(size)), sep = Math.max(3.5, size * 0.07), sep2 = sep * sep;
  const clearOf = (x, y, z) => { for (let i = 0; i < crates.length; i++) { const c = crates[i], dx = c[0] - x, dz = c[2] - z; if (dx * dx + dz * dz < sep2 && Math.abs(c[1] - y) < 2.4) return false; } return true; };
  const near = [], floorOk = (x, y, z) => Math.abs(grid.floorAt(x, y + 0.4, z, 0.05) - y) < 0.04;
  /** A crate here must stand on flat floor (no stairs, no ledge), clear of doors and drums, and must not close any passage. */
  const fitsRot = (x, y, z, rot) => {
    const hx = rot ? R.CRATE.hz : R.CRATE.hx, hz = rot ? R.CRATE.hx : R.CRATE.hz;
    if (Math.abs(x) > lim - hx || Math.abs(z) > lim - hz) return false;
    if (grid.overlap(x - hx - 0.03, x + hx + 0.03, y + 0.02, y + R.CRATE.h + 0.25, z - hz - 0.03, z + hz + 0.03, near)) return false;
    for (let m = 0.2; m <= 0.8; m += 0.3) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!floorOk(x + a * (hx + m), y, z + b * (hz + m))) return false;
    const k = grid.boxQuery(x - hx - 2, x + hx + 2, z - hz - 2, z + hz + 2, near);
    for (let i = 0; i < k; i++) {
      const s = near[i]; if (s.oy0 === undefined || s.pane) continue;       // door leaves and drums (they may be "away" under the ground right now)
      const m = s.prop && s.prop.k ? 0.8 : 1.8;
      if (x + hx + m > s.x0 && x - hx - m < s.x1 && z + hz + m > s.z0 && z - hz - m < s.z1) return false;
    }
    return !nav.splits(x - hx - BODY, x + hx + BODY, z - hz - BODY, z + hz + BODY, y);
  };
  const fits = (x, y, z) => { const first = crates.length & 1; if (fitsRot(x, y, z, first)) { fitRot = first; return true; } if (fitsRot(x, y, z, 1 - first)) { fitRot = 1 - first; return true; } return false; };
  let fitRot = 0;
  const roofed = (x, y, z) => grid.ray(x, y + 1, z, 0, 1, 0, 9) < 9;
  const put = (x, y, z) => { crates.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100, fitRot]); };
  const offCrates = (x, z, m) => { for (let i = 0; i < crates.length; i++) if (Math.abs(crates[i][0] - x) < m && Math.abs(crates[i][2] - z) < m) return false; return true; };
  // objectives first
  let goals = [];
  try { goals = goals.concat(H.pickZones(E)); const s = H.pickSites(E); if (s && s.sites) goals = goals.concat(s.sites); } catch { /* optional */ }
  for (const g of goals) {
    for (let t = 0; t < 14; t++) {
      const a = t * 2.4, d = 1.5 + t * 0.35, i = nav.nodeAt(g[0] + Math.cos(a) * d, 0, g[1] + Math.sin(a) * d, false, 6); if (i < 0) continue;
      nav.nodePos(i, o); if (fits(o.x, o.y, o.z) && clearOf(o.x, o.y, o.z)) { put(o.x, o.y, o.z); break; }
    }
  }
  // then interiors (about two thirds of the rest), then open ground
  const inWant = Math.round(want * 0.66);
  let inside = 0;
  for (let k = 0; k < 2600 && crates.length < want && n > 0; k++) {
    nav.nodePos(Math.floor(Math.random() * n), o); const x = o.x, y = o.y, z = o.z;
    if (!clearOf(x, y, z) || !fits(x, y, z)) continue;
    const roof = roofed(x, y, z);
    if (roof) { put(x, y, z); inside++; } else if (inside >= inWant || k > 1500) put(x, y, z);
  }
  // final-circle anchors: open ground, away from walls
  const anchors = [], asep = Math.max(3, size * 0.05), inner = size * 0.82;
  for (let k = 0; k < 900 && anchors.length < 48 && n > 0; k++) {
    nav.nodePos(Math.floor(Math.random() * n), o); const x = o.x, y = o.y, z = o.z;
    if (y > 0.35 || Math.abs(x) > inner || Math.abs(z) > inner || mover.blocked(x, 0.06, z, 0.5, 1.7) || !offCrates(x, z, 2)) continue;
    if (grid.ray(x, 1, z, 1, 0, 0, 3) < 3 || grid.ray(x, 1, z, -1, 0, 0, 3) < 3 || grid.ray(x, 1, z, 0, 0, 1, 3) < 3 || grid.ray(x, 1, z, 0, 0, -1, 3) < 3) continue;
    let ok = true; for (let j = 0; j < anchors.length && ok; j++) if (Math.hypot(anchors[j][0] - x, anchors[j][1] - z) < asep) ok = false;
    if (ok) anchors.push([Math.round(x * 100) / 100, Math.round(z * 100) / 100]);
  }
  // per-map override (optional): objectives.zoneEnds = [[x, z], ...] final-circle centres, for maps whose level 0 is underground (cite)
  try { const fe = E.world.objectives && E.world.objectives.zoneEnds; if (Array.isArray(fe) && fe.length) { const keep = fe.filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]) && offCrates(p[0], p[1], 2)).slice(0, 48).map(p => [+p[0], +p[1]]); if (keep.length) { anchors.length = 0; anchors.push(...keep); } } } catch { /* keep the surveyed anchors */ }
  if (!anchors.length) { const q = nav.nearest(0, 0); anchors.push([q[0], q[1]]); }
  // spawns: spread by farthest-point selection
  const pool = [];
  for (let k = 0; k < 500 && pool.length < 140 && n > 0; k++) {
    nav.nodePos(Math.floor(Math.random() * n), o);
    if (o.y <= 0.35 && Math.abs(o.x) <= lim && Math.abs(o.z) <= lim && !mover.blocked(o.x, 0.06, o.z, 0.42, 1.7) && offCrates(o.x, o.z, 1.8)) pool.push([Math.round(o.x * 100) / 100, Math.round(o.z * 100) / 100]);
  }
  for (const s of E.spawns(null) || []) { const q = nav.nearest(s[0], s[1]); if (offCrates(q[0], q[1], 1.8)) pool.push([q[0], q[1]]); }
  const spawns = [pool[Math.floor(Math.random() * pool.length)] || anchors[0]];
  while (spawns.length < 16 && spawns.length < pool.length) {
    let best = null, bs = -1;
    for (const q of pool) { let d = Infinity; for (const s of spawns) { const v = Math.hypot(q[0] - s[0], q[1] - s[1]); if (v < d) d = v; } if (d > bs) { bs = d; best = q; } }
    if (!best || bs < 1) break; spawns.push(best);
  }
  return { size, crates, anchors, spawns };
}

/* ---------- crate model: chamfered panels, metal corners, handles, hinged lid (one small geometry per part, instanced) ---------- */
function chamfered(out, w, h, d, c, cx, cy, cz, col) {
  const hx = w / 2, hy = h / 2, hz = d / 2, P = (sx, sy, sz, f) => [cx + sx * (f === 0 ? hx : hx - c), cy + sy * (f === 1 ? hy : hy - c), cz + sz * (f === 2 ? hz : hz - c)];
  const tri = (a, b, q) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = q[0] - a[0], vy = q[1] - a[1], vz = q[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return; nx /= l; ny /= l; nz /= l;
    const flip = nx * ((a[0] + b[0] + q[0]) / 3 - cx) + ny * ((a[1] + b[1] + q[1]) / 3 - cy) + nz * ((a[2] + b[2] + q[2]) / 3 - cz) < 0, s = flip ? -1 : 1, list = flip ? [a, q, b] : [a, b, q];
    const shade = 0.8 + 0.2 * Math.max(0, ny * s);       // baked contact shading: panels read as separate pieces even in shadow
    for (const p of list) { out.pos.push(p[0], p[1], p[2]); out.nor.push(nx * s, ny * s, nz * s); out.col.push(col[0] * shade, col[1] * shade, col[2] * shade); }
  };
  const quad = (a, b, q, e) => { tri(a, b, q); tri(a, q, e); };
  for (const s of [-1, 1]) {
    quad(P(s, -1, -1, 0), P(s, 1, -1, 0), P(s, 1, 1, 0), P(s, -1, 1, 0));
    quad(P(-1, s, -1, 1), P(1, s, -1, 1), P(1, s, 1, 1), P(-1, s, 1, 1));
    quad(P(-1, -1, s, 2), P(1, -1, s, 2), P(1, 1, s, 2), P(-1, 1, s, 2));
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    quad(P(-1, a, b, 1), P(1, a, b, 1), P(1, a, b, 2), P(-1, a, b, 2));
    quad(P(a, -1, b, 0), P(a, 1, b, 0), P(a, 1, b, 2), P(a, -1, b, 2));
    quad(P(a, b, -1, 0), P(a, b, 1, 0), P(a, b, 1, 1), P(a, b, -1, 1));
    for (const e of [-1, 1]) tri(P(a, b, e, 0), P(a, b, e, 1), P(a, b, e, 2));
  }
}
function geometryOf(build) {
  const o = { pos: [], nor: [], col: [] }; build(o);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
  return g;
}
const C_BODY = [0.105, 0.135, 0.07], C_PANEL = [0.13, 0.165, 0.085], C_LID = [0.125, 0.16, 0.085], C_STEEL = [0.34, 0.35, 0.34], C_DARK = [0.035, 0.035, 0.035], C_MARK = [0.8, 0.5, 0.06];
function crateBody(o) {
  chamfered(o, 0.98, 0.45, 0.64, 0.035, 0, 0.245, 0, C_BODY);                                   // shell
  for (const s of [-1, 1]) chamfered(o, 0.72, 0.27, 0.02, 0.006, 0, 0.245, s * 0.323, C_PANEL);  // raised front and back panels
  chamfered(o, 0.3, 0.075, 0.006, 0.001, 0.17, 0.3, 0.335, C_MARK);                             // stencil plate
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    chamfered(o, 0.11, 0.47, 0.11, 0.016, a * 0.455, 0.245, b * 0.285, C_STEEL);                // steel corners
    chamfered(o, 0.13, 0.035, 0.13, 0.008, a * 0.45, 0.0175, b * 0.28, C_DARK);                 // feet
  }
  for (const s of [-1, 1]) {
    chamfered(o, 0.022, 0.05, 0.3, 0.005, s * 0.545, 0.3, 0, C_STEEL);                          // handle grip
    for (const b of [-1, 1]) chamfered(o, 0.06, 0.035, 0.025, 0.004, s * 0.517, 0.3, b * 0.135, C_DARK);
  }
  chamfered(o, 0.99, 0.022, 0.65, 0.004, 0, 0.462, 0, C_DARK);                                  // seal under the lid
  for (const a of [-1, 1]) chamfered(o, 0.1, 0.05, 0.03, 0.005, a * 0.28, 0.45, -0.325, C_STEEL); // hinges
}
/** The lid is modelled around its hinge: rotating it about X opens it. */
function crateLid(o) {
  chamfered(o, 1.0, 0.075, 0.66, 0.024, 0, 0.04, 0.32, C_LID);
  chamfered(o, 0.74, 0.012, 0.42, 0.004, 0, 0.082, 0.32, C_PANEL);
  for (const a of [-1, 1]) for (const b of [0.05, 0.59]) chamfered(o, 0.12, 0.09, 0.1, 0.014, a * 0.45, 0.04, b, C_STEEL);
  for (const a of [-1, 1]) chamfered(o, 0.075, 0.1, 0.022, 0.005, a * 0.28, -0.005, 0.655, C_STEEL);  // latches
  chamfered(o, 0.2, 0.006, 0.09, 0.001, 0, 0.09, 0.32, C_MARK);
}
function medkit(o) { chamfered(o, 0.34, 0.15, 0.24, 0.025, 0, 0.075, 0, [0.62, 0.08, 0.06]); chamfered(o, 0.17, 0.006, 0.05, 0.001, 0, 0.152, 0, [0.9, 0.9, 0.86]); chamfered(o, 0.05, 0.006, 0.17, 0.001, 0, 0.152, 0, [0.9, 0.9, 0.86]); }
function plate(o) { chamfered(o, 0.34, 0.07, 0.27, 0.03, 0, 0.035, 0, [0.09, 0.2, 0.42]); chamfered(o, 0.2, 0.012, 0.13, 0.004, 0, 0.074, 0, [0.42, 0.62, 0.86]); }

/** Is the walkable ground mostly under a roof (an underground map)? Then how high the ceilings go (90th percentile + a margin). 240 upward rays, once per match. */
export function lookOf(E) {
  const I = E.internals, nav = I.nav, grid = I.grid, n = nav.nodes, o = { x: 0, y: 0, z: 0 }, tops = []; let roofed = 0, seen = 0;
  for (let k = 0; k < 240 && n > 0; k++) {
    nav.nodePos(Math.floor(Math.random() * n), o); seen++;
    const d = grid.ray(o.x, o.y + 1, o.z, 0, 1, 0, 30); if (d < 30) { roofed++; tops.push(o.y + 1 + d); }
  }
  tops.sort((a, b) => a - b);
  const frac = seen ? roofed / seen : 0, top = tops.length ? tops[Math.floor(tops.length * 0.9)] + 0.6 : WALL_H;
  return { under: frac >= 0.75 && !E.world.levelAt, frac, top: Math.min(WALL_H, Math.max(3, top)) };       // maps with raised streets (levelAt) keep the open-air wall: their floors are not at y = 0
}

/* ---------- world objects: instanced crates, two wall cylinders (four underground: a floor line for each) ---------- */
function createWorldView(E, look) {
  const I = E.internals, scene = I.scene, ZERO = new THREE.Matrix4().makeScale(0, 0, 0), M = new THREE.Matrix4(), T1 = new THREE.Matrix4(), T2 = new THREE.Matrix4();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.28 });
  const parts = [crateBody, crateLid, medkit, plate].map(fn => {
    const g = geometryOf(fn), m = new THREE.InstancedMesh(g, mat, CAP);
    m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.name = 'zone-crate';
    for (let i = 0; i < CAP; i++) m.setMatrixAt(i, ZERO);
    scene.add(m); return m;
  });
  const [bodyM, lidM, medM, plateM] = parts;
  const place = (c, y) => { M.makeRotationY(c.rot ? Math.PI / 2 : 0); M.elements[12] = c.x; M.elements[13] = c.y + y; M.elements[14] = c.z; };
  function drawLid(c) {
    place(c, HINGE_Y); T1.makeTranslation(0, 0, HINGE_Z); T2.makeRotationX(-c.lid); M.multiply(T1).multiply(T2);
    lidM.setMatrixAt(c.i, M); lidM.instanceMatrix.needsUpdate = true;
  }
  function drawSupply(c) {
    medM.setMatrixAt(c.i, ZERO); plateM.setMatrixAt(c.i, ZERO);
    if (c.open && c.s) { place(c, 0.475); (c.s === 'med' ? medM : plateM).setMatrixAt(c.i, M); }
    medM.instanceMatrix.needsUpdate = true; plateM.instanceMatrix.needsUpdate = true;
  }
  function drawCrate(c) { place(c, 0); bodyM.setMatrixAt(c.i, M); bodyM.instanceMatrix.needsUpdate = true; drawLid(c); drawSupply(c); }
  const flush = () => {};

  /* translucent wall */
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,120,50,0)'); grad.addColorStop(0.45, 'rgba(255,120,50,.2)'); grad.addColorStop(1, 'rgba(255,120,50,.5)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.42)';
  for (let k = -64; k < 128; k += 32) { g.beginPath(); g.moveTo(k, 64); g.lineTo(k + 14, 64); g.lineTo(k + 78, 0); g.lineTo(k + 64, 0); g.closePath(); g.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const wallGeo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true); wallGeo.translate(0, 0.5, 0);
  const wallMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, fog: false, toneMapped: false, forceSinglePass: true });
  const nextMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, fog: false, toneMapped: false, color: 0xffe0a0, forceSinglePass: true });
  /* under a roof (bunker): the open-air wall is 46 m of gradient seen through 3 m corridors, so every view across it was one flat orange
     wash and a player inside a small circle could not tell the safe side. Here the wall stands only as high as the ceilings, mostly clear
     with 45-degree hazard stripes, plus a bright line along the floor where the boundary runs. */
  const under = !!(look && look.under), H = under ? look.top : WALL_H, Y0 = under ? 0 : -1, STRIPE = 1.25;       // STRIPE: metres of wall per band period underground
  let utex = null, ntex = null, band = null, nband = null, bandMat = null, nbandMat = null;
  if (under) {
    // one texture tile = STRIPE m wide x the whole wall height: 45-degree bands about 0.55 m wide, alpha 0.25 at the floor fading to almost nothing at 3 m
    const TW = 64, TH = Math.max(64, Math.round(TW * H / STRIPE)), uc = document.createElement('canvas'); uc.width = TW; uc.height = TH; const u = uc.getContext('2d');
    u.fillStyle = '#ff8038';
    for (let k = -TH - TW; k < TW * 2; k += TW) { u.beginPath(); u.moveTo(k, TH); u.lineTo(k + TW * 0.45, TH); u.lineTo(k + TW * 0.45 + TH, 0); u.lineTo(k + TH, 0); u.closePath(); u.fill(); }
    const fade = u.createLinearGradient(0, TH, 0, 0), at = m => Math.min(1, m / H);
    fade.addColorStop(0, 'rgba(0,0,0,.25)'); fade.addColorStop(at(0.5), 'rgba(0,0,0,.13)'); fade.addColorStop(at(1.2), 'rgba(0,0,0,.06)'); fade.addColorStop(at(2.2), 'rgba(0,0,0,.025)'); fade.addColorStop(1, 'rgba(0,0,0,.012)');       // eye level (1.6 m): about 0.05
    u.globalCompositeOperation = 'destination-in'; u.fillStyle = fade; u.fillRect(0, 0, TW, TH);
    u.globalCompositeOperation = 'destination-over'; u.fillStyle = 'rgba(255,120,50,.03)'; u.fillRect(0, 0, TW, TH);       // a faint body between the bands
    utex = new THREE.CanvasTexture(uc); utex.wrapS = THREE.RepeatWrapping; utex.wrapT = THREE.ClampToEdgeWrapping; utex.colorSpace = THREE.SRGBColorSpace; utex.generateMipmaps = false; utex.minFilter = THREE.LinearFilter;
    ntex = utex.clone(); wallMat.map = utex; wallMat.opacity = 1; nextMat.map = ntex; nextMat.opacity = 0.45;
    // the part of the wall near the eye fades out (gone under 1.5 m, 40 % at 3.4 m, full from 6 m): standing next to it does not paint the screen; the floor line stays
    for (const m of [wallMat, nextMat]) {
      m.customProgramCacheKey = () => 'fz-zone-under';
      m.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFzW;').replace('#include <project_vertex>', '#include <project_vertex>\nvFzW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFzW;').replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= smoothstep(1.5, 6.0, distance(vFzW, cameraPosition));');
      };
    }
    bandMat = new THREE.MeshBasicMaterial({ color: 0xff7a32, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, fog: false, toneMapped: false, forceSinglePass: true });
    nbandMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, fog: false, toneMapped: false, forceSinglePass: true });
    band = new THREE.Mesh(wallGeo, bandMat); nband = new THREE.Mesh(wallGeo, nbandMat);
  }
  const wall = new THREE.Mesh(wallGeo, wallMat), next = new THREE.Mesh(wallGeo, nextMat), meshes = [wall, next];
  if (under) meshes.push(band, nband);
  for (const w of meshes) { w.frustumCulled = false; w.castShadow = false; w.receiveShadow = false; w.renderOrder = 8; w.matrixAutoUpdate = false; scene.add(w); }
  wall.name = 'zone-wall'; next.name = 'zone-next';
  const setCyl = (m, x, z, r, y, h) => { m.position.set(x, y, z); m.scale.set(Math.max(0.2, r), h, Math.max(0.2, r)); m.updateMatrix(); m.matrixWorldNeedsUpdate = true; };
  let scroll = 0;
  return {
    drawCrate, drawLid, drawSupply, flush, parts, wall, next, under,
    setWall(C, dt) {
      setCyl(wall, C.x, C.z, C.r, Y0, H);
      const showNext = C.st === 0 && C.nr > 0.5; if (next.visible !== showNext) next.visible = showNext;
      if (showNext) setCyl(next, C.nx, C.nz, C.nr, Y0, H);
      scroll = (scroll + dt * 0.05) % 1;
      if (!under) { tex.offset.x = scroll; tex.repeat.x = Math.max(4, Math.round(C.r * 0.42)); return; }
      // stripes about 1.2 m wide whatever the radius; the floor line is a 22 cm band at the foot of the wall
      utex.offset.x = scroll; utex.repeat.set(Math.max(3, Math.round(C.r * 6.2832 / STRIPE)), 1);
      setCyl(band, C.x, C.z, C.r, 0.02, 0.22);
      if (nband.visible !== showNext) nband.visible = showNext;
      if (showNext) { ntex.repeat.set(Math.max(3, Math.round(C.nr * 6.2832 / STRIPE)), 1); setCyl(nband, C.nx, C.nz, C.nr, 0.02, 0.12); }
    },
    dispose() {
      for (const m of meshes) scene.remove(m);
      for (const m of parts) { scene.remove(m); m.geometry.dispose(); m.dispose(); }
      mat.dispose(); wallGeo.dispose(); wallMat.dispose(); nextMat.dispose(); tex.dispose();
      if (under) { utex.dispose(); ntex.dispose(); bandMat.dispose(); nbandMat.dispose(); }
    },
  };
}

/* ---------- zone HUD: distance and direction, drawn in the hud root; circle on the minimap ---------- */
function createPanel(E) {
  const anchor = E.internals.hud.el.top, root = (anchor && anchor.parentNode) || document.body;
  const d = document.createElement('div'); d.dataset.h = 'zone';
  d.style.cssText = 'position:absolute;left:50%;top:clamp(98px,14.6vh,124px);transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:3px 12px;background:rgba(10,12,8,.62);border:1px solid rgba(232,166,40,.45);font-weight:700;font-size:clamp(12px,1.7vw,15px);letter-spacing:.04em;color:#f1e7cd;white-space:nowrap;pointer-events:none;z-index:3';
  const arrow = document.createElement('i'); arrow.textContent = '▲'; arrow.style.cssText = 'display:inline-block;font-style:normal;color:#e8a628;will-change:transform';
  const label = document.createElement('span');
  d.append(arrow, label); root.appendChild(d);
  let lt = '', lc = '', la = '', lv = true, lb = '';
  return {
    set(text, color, border, angle) {
      if (text !== lt) { lt = text; label.textContent = text; }
      if (color !== lc) { lc = color; d.style.color = color; arrow.style.color = color; }
      if (border !== lb) { lb = border; d.style.borderColor = border; }
      const on = angle !== null; if (on !== lv) { lv = on; arrow.style.display = on ? '' : 'none'; }
      if (on) { const a = 'rotate(' + (Math.round(angle * 20) / 20) + 'rad)'; if (a !== la) { la = a; arrow.style.transform = a; } }
    },
    show(on) { d.style.display = on ? 'flex' : 'none'; },
    dispose() { d.remove(); },
  };
}

/* ---------- shared core: plan, circle, crates, HUD and the bot director ---------- */
function createCore(c, H, net) {
  const { E } = c, I = E.internals, P = E.player, L = makeL(E), hud = E.hud, grid = I.grid, nav = I.nav, camera = I.camera;
  const look = lookOf(E), view = createWorldView(E, look), panel = createPanel(E);
  const C = { i: 1, last: 1, st: 0, x: 0, z: 0, r: 1000, nx: 0, nz: 0, nr: 1000, left: 0, dps: 0 };
  const S = { plan: null, clock: -DEPLOY, crates: [], alive: 0, total: 0, phase: -1, st: -1, focus: null, wasDown: false, hudT: 0, promptT: 0, botT: 0, botI: 0, ended: false, leaving: false, useT: 0, lastPrompt: null, opening: [], grace: 62, endT: 300, pace: 0.8 + Math.random() * 0.2, lag: 0 };
  const camDir = new THREE.Vector3();
  const key = interactKey(E);
  const openText = L('open', { key }), leaveText = L('leave', { key });
  /** Squads (zone-squads.js) plug in here: bot(a) takes a bot's order, hold(a) gives its waiting spot, busy() keeps the player off crates (downed or reviving), prompt() its own prompt, obj() the objective. */
  const hooks = { bot: null, hold: null, busy: null, prompt: null, obj: null };

  hud.mapOverlay = (m, X, k) => {
    if (!S.plan) return;
    m.save();
    m.lineWidth = 2; m.strokeStyle = '#ff7a32'; m.beginPath(); m.arc(X(C.x), X(C.z), Math.max(1, C.r * k), 0, 6.3); m.stroke();
    if (C.st === 0 && C.nr > 0.5) { m.setLineDash(DASH); m.lineWidth = 1.5; m.strokeStyle = '#fff'; m.beginPath(); m.arc(X(C.nx), X(C.nz), Math.max(1, C.nr * k), 0, 6.3); m.stroke(); }
    m.restore();
  };

  /* crates are real solids: they live in the map's solids array (grid, mover, bullets, ragdolls) and are cut out of the nav graph */
  const mover = I.mover, sols = E.world.solids;
  function removeSolids() {
    let any = false;
    for (let i = sols.length - 1; i >= 0; i--) if (sols[i].zoneCrate) { sols.splice(i, 1); any = true; }
    nav.clearBlocks();
    if (any) grid.build(sols);
  }
  function addSolids() {
    removeSolids();
    for (let i = 0; i < S.crates.length; i++) {
      const cr = S.crates[i], hx = cr.rot ? R.CRATE.hz : R.CRATE.hx, hz = cr.rot ? R.CRATE.hx : R.CRATE.hz;
      const s = { x0: cr.x - hx, x1: cr.x + hx, y0: cr.y, y1: cr.y + R.CRATE.h, z0: cr.z - hz, z1: cr.z + hz, surface: 'metal', zoneCrate: true };
      cr.solid = s; sols.push(s);
      nav.block(s.x0 - BODY, s.x1 + BODY, s.z0 - BODY, s.z1 + BODY, s.y0, s.y1);
    }
    grid.build(sols);
    for (let i = 0; i < E.actors.length; i++) {       // nobody is left inside one: the mover pushes the body out
      const a = E.actors[i]; if (!a.alive || a.isRemote || !a.body) continue;
      if (mover.blocked(a.pos.x, a.pos.y, a.pos.z, a.body.r, a.body.h)) mover.move(a.body, 0, 0, 0);
    }
  }
  function setCrates(list) {
    S.crates.length = 0;
    for (let i = 0; i < list.length && i < CAP; i++) {
      const q = list[i], cr = { i, id: q.i === undefined ? i : q.i, x: q.x, y: q.y, z: q.z, rot: q.r ? 1 : 0, open: !!q.o, lid: q.o ? LID_OPEN : 0, s: q.s || null, claim: null, wait: 0, content: q.content || null, solid: null };
      S.crates.push(cr); view.drawCrate(cr);
    }
    addSolids();
  }
  function crateById(id) { for (let i = 0; i < S.crates.length; i++) if (S.crates[i].id === id) return S.crates[i]; return null; }
  function markOpen(cr, s) { cr.open = true; cr.s = s || null; cr.claim = null; if (S.focus === cr) S.focus = null; view.drawSupply(cr); if (S.opening.indexOf(cr) < 0) S.opening.push(cr); }
  function markUsed(cr) { cr.s = null; view.drawSupply(cr); }
  function animateLids(dt) {
    for (let i = S.opening.length - 1; i >= 0; i--) {
      const cr = S.opening[i]; cr.lid = Math.min(LID_OPEN, cr.lid + dt * LID_RATE); view.drawLid(cr);
      if (cr.lid >= LID_OPEN) { S.opening[i] = S.opening[S.opening.length - 1]; S.opening.pop(); }
    }
  }
  /** Line of sight to a crate: reaching its own solid counts as seeing it. */
  function seesCrate(cr, ox, oy, oz) {
    const tx = cr.x - ox, ty = cr.y + 0.45 - oy, tz = cr.z - oz, l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1, was = grid.skipPane; grid.skipPane = true;
    const d = grid.ray(ox, oy, oz, tx / l, ty / l, tz / l, l), hit = grid.hit; grid.skipPane = was;
    return d >= l - 0.02 || hit === cr.solid;
  }

  function pickFocus() {
    S.focus = null; if (!P.alive || E.rules.frozen || (hooks.busy && hooks.busy())) return;
    const p = P.pos; let best = null, bs = 1e9; camera.getWorldDirection(camDir);
    for (let i = 0; i < S.crates.length; i++) {
      const cr = S.crates[i]; if (cr.open || c.time < cr.wait) continue;
      const dx = cr.x - p.x, dz = cr.z - p.z, h2 = dx * dx + dz * dz; if (h2 > OPEN_D * OPEN_D || Math.abs(cr.y - p.y) > 1.9) continue;
      const vx = cr.x - camera.position.x, vy = cr.y + 0.35 - camera.position.y, vz = cr.z - camera.position.z, l = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1, dot = (vx * camDir.x + vy * camDir.y + vz * camDir.z) / l;
      if (h2 > OPEN_NEAR * OPEN_NEAR && dot < 0.8) continue;
      const s = h2 - dot; if (s < bs && seesCrate(cr, camera.position.x, camera.position.y, camera.position.z)) { bs = s; best = cr; }
    }
    S.focus = best;
  }
  function supplies() {
    if (!P.alive || c.time < S.useT || (hooks.busy && hooks.busy())) return;
    const p = P.pos;
    for (let i = 0; i < S.crates.length; i++) {
      const cr = S.crates[i]; if (!cr.open || !cr.s) continue;
      const dx = cr.x - p.x, dz = cr.z - p.z; if (dx * dx + dz * dz > USE_D * USE_D || Math.abs(cr.y - p.y) > 1.9) continue;
      const need = cr.s === 'med' ? P.hp < P.maxHp : P.armor < R.armorCap(P.maxArmor);
      if (need) { S.useT = c.time + 0.4; net.useSupply(cr); return; }
    }
  }

  function hudLine() {
    const st = C.st, last = C.i >= C.last;
    if (S.clock < 0) { c.center(L('deploy')); c.timer(Math.max(0, Math.ceil(-S.clock))); panel.set(hooks.obj ? hooks.obj() : L('obj'), '#f1e7cd', 'rgba(232,166,40,.45)', null); return; }
    c.center(last ? L('last') : L('zone', { n: C.i, m: C.last - 1 }));
    c.timer(Math.ceil(C.left / 1000));
    c.objective(st === 0 ? L('wait') : L('shrink'));
    if (!P.alive) { panel.set(L('alive') + ' ' + S.alive + ' / ' + S.total, '#f1e7cd', 'rgba(232,166,40,.45)', null); return; }
    const px = P.pos.x, pz = P.pos.z, dc = Math.hypot(px - C.x, pz - C.z), dn = Math.hypot(px - C.nx, pz - C.nz), out = dc > C.r;
    let tx, tz, dist, label, col, bd;
    if (out) { tx = C.x; tz = C.z; dist = dc - C.r; label = L('outside') + ' · -' + C.dps + '/s'; col = '#ff8a6a'; bd = RED; }
    else if (dn > C.nr) { tx = C.nx; tz = C.nz; dist = dn - C.nr; label = L('toNext'); col = '#f1e7cd'; bd = 'rgba(232,166,40,.65)'; }
    else { panel.set(L('inside'), '#b6e36a', 'rgba(140,200,90,.55)', null); return; }
    // underground the straight line to the centre runs through rock: the arrow follows the walk (nav path) and the distance is the walk
    if (view.under && walkGuide(px, P.pos.y, pz, tx, tz, out ? C.r : C.nr, out)) { tx = WG.x; tz = WG.z; dist = WG.d; }
    const vx = tx - px, vz = tz - pz, sn = Math.sin(P.yaw), cs = Math.cos(P.yaw), rel = Math.atan2(vx * cs - vz * sn, -vx * sn - vz * cs);
    panel.set(label + ' · ' + Math.max(1, Math.ceil(dist)) + ' m', col, bd, rel);
  }
  /** Walk from the player into the circle (cx, cz, r) along the nav graph, refreshed twice a second: WG.x/z = a point 3 m or more ahead on the way, WG.d = metres to walk. */
  const WG = { x: 0, z: 0, d: 0, t: -1, out: null, ok: false };
  function walkGuide(px, py, pz, cx, cz, r, out) {
    if (c.time < WG.t && WG.out === out) return WG.ok;
    WG.t = c.time + 0.5; WG.out = out; WG.ok = false;
    const q = nav.nearest(cx, cz), p = nav.path(px, py, pz, q[0], q.length > 2 ? q[2] : 0, q[1]); if (!p || !p.length || !p.complete) return false;
    let l = 0, ax = px, az = pz, aim = null;
    for (let i = 0; i < p.length; i++) {
      const w = p[i], sl = Math.hypot(w.x - ax, w.z - az), n = Math.max(1, Math.ceil(sl / 0.5));
      for (let s = 1; s <= n; s++) { const t = s / n, x = ax + (w.x - ax) * t, z = az + (w.z - az) * t; if (Math.hypot(x - cx, z - cz) <= r) { WG.d = l + sl * t; WG.x = aim ? aim.x : x; WG.z = aim ? aim.z : z; WG.ok = true; return true; } }
      l += sl; ax = w.x; az = w.z; if (!aim && Math.hypot(w.x - px, w.z - pz) >= 3) aim = w;
    }
    return false;
  }

  /* bot director: runs where the bots are simulated */
  function inNext(x, z, m) { const dx = x - C.nx, dz = z - C.nz, r = Math.max(0, C.nr - m); return dx * dx + dz * dz <= r * r; }
  function pointInside(a) {
    const dat = a.data;
    if (dat.zp === C.i && dat.zx !== undefined) return;
    dat.zp = C.i;
    // spread out: of a few random spots, the one farthest from the other bots' spots (a crowd in the middle of the circle would fight all at once)
    const nr = Math.max(0.5, C.nr); let best = null, bs = -1;
    for (let k = 0; k < 5 && bs < 12; k++) {
      const ang = Math.random() * 6.283, rad = Math.sqrt(Math.random()) * nr * 0.65, q = nav.nearest(C.nx + Math.cos(ang) * rad, C.nz + Math.sin(ang) * rad);
      if (Math.hypot(q[0] - C.nx, q[1] - C.nz) > nr - 0.4) continue;
      let m = 1e9; for (let i = 0; i < E.actors.length; i++) { const b = E.actors[i], d = b.data; if (b !== a && b.alive && b.ai && d && d.zp === C.i && d.zx !== undefined) m = Math.min(m, Math.hypot(d.zx - q[0], d.zz - q[1])); }
      if (m > bs) { bs = m; best = q; }
    }
    if (best) { dat.zx = best[0]; dat.zz = best[1]; }
    else { const f = nav.nearest(S.plan.fx, S.plan.fz); dat.zx = f[0]; dat.zz = f[1]; }
  }
  function nearestCrate(a) {
    let best = null, bd = 42 * 42; const p = a.pos;
    for (let i = 0; i < S.crates.length; i++) {
      const cr = S.crates[i]; if (cr.open || cr === a.data.badCrate || (cr.claim && cr.claim !== a && cr.claim.alive)) continue;
      if (S.clock > 8 && !inNext(cr.x, cr.z, 0.5)) continue;
      const dx = cr.x - p.x, dz = cr.z - p.z, dy = (cr.y - p.y) * 3, d = dx * dx + dz * dz + dy * dy; if (d < bd) { bd = d; best = cr; }       // another floor counts as farther
    }
    return best;
  }
  function decide(a) {
    if (hooks.bot && hooks.bot(a)) return;       // squads: downed, reviving, going to revive, sticking to the leader
    const dat = a.data, ai = a.ai, px = a.pos.x, pz = a.pos.z, dc = Math.hypot(px - C.x, pz - C.z), dn = Math.hypot(px - C.nx, pz - C.nz), speed = Math.max(3, a.speed || 4.7);
    // pacing, one rule for every soldier (a human is fought exactly like a bot): the AI picks fights only within a reach that grows with
    // the match, and always answers whoever shoots at it (engine-ai.js: engageR, hitBy)
    const lag = S.lag, bold = !!dat.bold;
    // build-up: the fights are as frequent all match long but the early ones are suppressive (wide aim, short bursts, long pauses, lighter hits), sharper as the match goes on;
    // wider still while the field is thinner than the timeline planned, sharper while it is too crowded (the same against everyone); a hurt bot breaks off for cover, then heals at a crate
    if (ai) { const k = S.clock / S.endT, early = k < 0.25 ? 3 : k < 0.85 ? 3 - (k - 0.25) * 3.33 : 1; ai.engageR = reach(bold, lag); ai.coverAt = k < 0.4 ? 0.8 : 0.65; const cq = k > 0.85 ? 0 : closeQ(); ai.fireK = (k < 0.3 ? 2.6 : k < 0.85 ? 1.5 : 1) * (1 + 0.5 * cq); ai.dmgK = (k < 0.3 ? 0.55 : k < 0.85 ? 0.55 + (k - 0.3) * 0.82 : 1) * (1 - 0.3 * cq); ai.aimK = k > 0.85 ? 1 : Math.min(8, Math.max(1, early * (1 + 1.5 * cq) * (lag >= 1.5 ? 0.85 : lag >= -0.5 ? 1 : lag >= -1.5 ? 1.8 : 2.8))); }       // cq: close quarters (bunker)
    const urgent = dc > C.r - 0.8 - 2 * closeQ() || (dn > C.nr - 1 - 2 * closeQ() && (C.st === 1 || C.left / 1000 < (dn - C.nr) * 1.5 / speed + 12));
    if (urgent) {
      // already in the gas: run first. The AI stops to fight anything closer than 12 m, which would keep it outside until it dies
      if (dc > C.r + 0.5 && ai) { ai.target = null; ai.visible = false; ai.hitT = 0; ai.engageR = 0; ai.senseT = Math.max(ai.senseT, 0.5); ai.arrived = false; }
      if (dat.crate) { dat.crate.claim = null; dat.crate = null; }
      pointInside(a); H.setOrder(a, 'goto', dat.zx, dat.zz, Math.min(1.4, Math.max(0.8, C.nr * 0.3)));       // under 1.5 m: no detour through the map's lanes (engine-ai.js laneGo)
      return;
    }
    // hurt or bare: health or armour left in an open crate nearby
    const sup = a.hp < a.maxHp * 0.6 || !(a.armor >= 25) ? supplyFor(a) : null;
    if (sup && !(ai && ai.visible)) {
      if (Math.hypot(sup.x - px, sup.z - pz) < 2.3 && Math.abs(sup.y - a.pos.y) < 2.2) { if (c.time >= sup.wait) { sup.wait = c.time + 1; net.botUse(a, sup); } return; }
      goAt(a, sup.x, sup.y, sup.z, 1.7); return;
    }
    let cr = dat.crate;
    if (cr && (cr.open || S.clock > dat.crateT)) { if (!cr.open) { cr.claim = null; dat.badCrate = cr; } dat.crate = null; cr = null; }       // out of reach for too long: another one
    if (!cr && ((dat.loots | 0) < 3 || ((dat.loots | 0) < 5 && R.tierOf(ai ? ai.prim || a.weaponId : a.weaponId) < 2))) { cr = nearestCrate(a); if (cr) { cr.claim = a; dat.crate = cr; dat.crateT = S.clock + 35; } }       // a weak weapon keeps it searching
    if (cr) {
      const d = Math.hypot(cr.x - px, cr.z - pz);
      if (d < 2.3 && Math.abs(cr.y - a.pos.y) < 2.2) { dat.crate = null; dat.loots = (dat.loots | 0) + 1; net.botOpen(a, cr); return; }
      goAt(a, cr.x, cr.y, cr.z, 1.7);       // the nav stops at the crate's side, its centre is solid
      return;
    }
    // a fight within earshot: move in and take on whoever is left, from range (third party); only for a bold one
    if (ai && bold && !ai.visible && S.clock >= calmEnd() && a.hp > 45) { const f = fightNear(a); if (f) { H.setOrder(a, 'goto', f.x, f.z, 3); return; } }
    if (S.clock > S.endT * 0.6 && bold && lag > 1) { H.setOrder(a, 'hunt'); return; }
    const hs = hooks.hold ? hooks.hold(a) : null; if (hs) { H.setOrder(a, 'hold', hs.x, hs.z, 4); return; }       // squads: wait by the leader
    pointInside(a); H.setOrder(a, 'hold', dat.zx, dat.zz, Math.max(2, Math.min(6, C.nr * 0.3) * (1 - 0.5 * closeQ())));       // close quarters: keep well inside the small circles
  }
  /** A 'goto' order that carries its floor (a crate upstairs, in a car park, on a street above the ground level of the map). */
  function goAt(a, x, y, z, r) { const ai = a.ai; if (!ai) return; const o = ai.order; if (o && o.type === 'goto' && o.x === x && o.z === z && o.y === y && o.radius === r) return; ai.order = { type: 'goto', x, z, radius: r, y }; }
  /** Soldiers still standing minus those this moment of the timeline planned (a straight line that reaches one survivor at `pace` of it, drawn per match: half the field around 40 %). */
  function behind() { const q = Math.min(1, Math.max(0, S.clock) / (S.endT * S.pace)); return S.alive - Math.max(1, S.total * (1 - q)); }
  /** End of the calm landing (about 15 s at the normal clock): until then a bot only answers whoever shoots at it. */
  const calmEnd = () => S.grace * 0.25;
  /** Close quarters, 0 (open map) to 1, measured once: mean free sight distance at eye height from random walkable spots (about 7.5 m in the bunker,
   *  11 m in the old town, 17-27 m elsewhere; full effect at 7 m, none from 13 m). Contact is constant there, so its fights are wilder still. */
  function closeQ() {
    if (S.cq !== undefined) return S.cq;
    const o = { x: 0, y: 0, z: 0 }, n = nav.nodes; let sum = 0, m = 0;
    for (let k = 0; k < 96 && n > 0; k++) { nav.nodePos(Math.floor(Math.random() * n), o); for (let j = 0; j < 8; j++) { const a = j * 0.785; sum += Math.min(40, grid.ray(o.x, o.y + 1.5, o.z, Math.cos(a), 0, Math.sin(a), 40)); m++; } }
    return (S.cq = m ? Math.min(1, Math.max(0, (13 - sum / m) / 6)) : 0);
  }
  /** Distance at which a bot starts a fight: none during the calm landing (it only answers), then whoever it spots (the pacing is in the aim, bursts and damage, not in ignoring enemies). */
  function reach(bold, lag) { return S.clock < calmEnd() ? 0 : 1e4; }
  /** Who also hunts and joins the fights it hears: three or more while the field is as crowded as planned or more, one while it is thinner, none while far ahead; they take turns every 20 s. */
  function markBold(list) {
    S.lag = behind();
    const len = list.length, off = Math.floor(Math.max(0, S.clock) / 20) % len; let n = S.clock < calmEnd() ? 0 : S.lag < -2 ? 0 : S.lag < 0 ? 1 : Math.max(3, Math.ceil(S.lag + 2.5));
    for (let k = 0; k < len; k++) { const a = list[(k + off) % len]; if (!a || !a.data) continue; a.data.bold = !!a.alive && !!a.ai && n > 0; if (a.data.bold) n--; }
  }
  /** A fight within earshot (someone fired in the last 1.5 s) inside the zone: a spot short of it, kept 5 s. */
  function fightNear(a) {
    const dat = a.data, hear = S.clock < S.endT * 0.45 ? 40 : 55, list = E.actors;
    let best = null, bd = hear * hear;
    for (let i = 0; i < list.length; i++) {
      const b = list[i]; if (b === a || !b.alive || b.ghost || !(b.shotT > 0) || !E.isEnemy(a, b)) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 100 || d2 >= bd || !inNext(b.pos.x, b.pos.z, 1)) continue;
      bd = d2; best = b;
    }
    if (best) {
      const d = Math.sqrt(bd), k = Math.max(0, (d - 16) / d), q = nav.nearest(a.pos.x + (best.pos.x - a.pos.x) * k, a.pos.z + (best.pos.z - a.pos.z) * k);
      if (!dat.noise) dat.noise = { x: 0, z: 0, t: 0 };
      dat.noise.x = q[0]; dat.noise.z = q[1]; dat.noise.t = S.clock + 5;
    }
    return dat.noise && dat.noise.t > S.clock ? dat.noise : null;
  }
  /** The nearest open crate (any floor, inside the next circle) still holding what this bot needs. */
  function supplyFor(a) {
    const needH = a.hp < a.maxHp * 0.6, needA = !(a.armor >= 25);
    let best = null, bd = 1e9;
    for (let i = 0; i < S.crates.length; i++) {
      const cr = S.crates[i]; if (!cr.open || !cr.s || cr === a.data.badCrate || (cr.s === 'med' ? !needH : !needA)) continue;
      if (S.clock > 8 && !inNext(cr.x, cr.z, 0.5)) continue;
      const dx = cr.x - a.pos.x, dz = cr.z - a.pos.z, dy = (cr.y - a.pos.y) * 3, d = dx * dx + dz * dz + dy * dy, far = cr.s === 'med' ? 26 : 14;       // health is worth a longer walk than armour
      if (d < far * far && d < bd) { bd = d; best = cr; }
    }
    return best;
  }
  function driveBots(list, dt) {
    S.botT -= dt; if (S.botT > 0 || !list.length) return;
    S.botT = 0.12; markBold(list);
    for (let n = Math.ceil(list.length / 3); n > 0; n--) { S.botI = (S.botI + 1) % list.length; const a = list[S.botI]; if (a && a.alive && a.ai) decide(a); }
  }
  /** Gives a bot a looted weapon: same fields the AI keeps for a loadout. */
  function arm(a, id, grenades) {
    const ai = a.ai; if (!ai) return;
    if (grenades > 0) ai.gearN = Math.min(2, (ai.gearN | 0) + grenades);
    const had = a.wdef, tier = R.tierOf(id), haveTier = R.tierOf(ai.prim || a.weaponId), next = H.WEAPONS.find(w => w.id === id);
    if (!next || ai.prim === id || tier < haveTier || (next.slot === 1 && had && had.slot === 0)) return;       // keeps the better weapon
    E.addRemote({ id: a.id, weaponId: id });
    const def = a.wdef; if (a.weaponId !== id) return;
    const prev = ai.prim && ai.prim !== id ? ai.prim : null;
    ai.prim = id; ai.ammo = def.mag; ai.ammo1 = def.mag; ai.reloadT = 0; ai.swapT = 0; ai.burst = 0; ai.res = def.reserve === undefined ? -1 : def.reserve;
    if (prev && !ai.sec && def.slot === 0) { ai.sec = prev; const sd = H.WEAPONS.find(w => w.id === prev); ai.ammo2 = sd ? sd.mag : 14; }
    a.speed = 4.7 * def.mob;
  }
  /** A bot takes the health or armour of a crate (same amounts as a player). */
  function supply(a, s) { if (s === 'med') E.heal(a, R.MED); else if (s === 'arm') a.armor = Math.min(R.armorCap(0), (a.armor || 0) + R.ARMOR); }

  return {
    S, C, L, view, panel, setCrates, crateById, markOpen, markUsed, driveBots, arm, supply, key, hooks,
    setPlan(plan) { S.plan = plan; S.grace = (plan.grace || 62000) / 1000; S.endT = Math.max(30, (plan.end || 300000) / 1000); R.circleAt(plan, Math.max(0, S.clock * 1000), C); view.setWall(C, 0); },
    /** Every frame. */
    update(dt) {
      if (!S.plan) return;
      S.clock += dt;
      R.circleAt(S.plan, Math.max(0, S.clock * 1000), C);
      view.setWall(C, dt);
      if (S.opening.length) animateLids(dt);
      if (S.clock >= 0 && (C.i !== S.phase || C.st !== S.st)) {
        if (S.phase >= 0 && C.st === 0 && C.i !== S.phase) c.msg(L('announced'), 'info');
        S.phase = C.i; S.st = C.st; S.hudT = 0;
      }
      S.hudT -= dt; if (S.hudT <= 0) { S.hudT = 0.2; hudLine(); }
      S.promptT -= dt;
      if (S.promptT <= 0) { S.promptT = 0.08; pickFocus(); supplies(); }
      const down = E.input.held('interact');
      const sp = hooks.prompt ? hooks.prompt() : null;       // squads: revive a squadmate ('' = no prompt while downed)
      const wantPrompt = sp !== null ? sp || null : !P.alive && S.clock >= 0 ? leaveText : S.focus ? openText : null;
      if (wantPrompt !== S.lastPrompt) { S.lastPrompt = wantPrompt; c.prompt(wantPrompt); }
      if (down && !S.wasDown && sp === null) {
        if (!P.alive) { if (S.clock >= 0 && !S.leaving) { S.leaving = true; net.leave(); } }
        else if (S.focus && c.time >= S.focus.wait) { const cr = S.focus; cr.wait = c.time + 0.5; net.openCrate(cr); }
      }
      S.wasDown = down;
    },
    dispose() { hud.mapOverlay = null; try { removeSolids(); } catch (e) { console.warn('[zone] solids', e); } view.dispose(); panel.dispose(); },
  };
}
const DASH = [5, 4];

/* ====================================================================== */
/* OFFLINE: this module is the referee                                    */
/* ====================================================================== */
export function zoneOffline(c, H) {
  const { E, cfg } = c, P = E.player, I = E.internals;
  const bots = [], ranks = new Map(); let core, nextDrop = 1000000, dmgT = 1, finished = false, winnerName = null, sq = null;       // sq: squads (zone-squads.js), null for Zone everyone-for-themselves
  const over = () => (sq ? sq.over() : core.S.alive <= 1);
  const aliveCount = () => { let n = 0; for (let i = 0; i < E.actors.length; i++) { const a = E.actors[i]; if (a.alive && a.kind !== 'zombie') n++; } return n; };
  function dropItems(cr, list) {
    const items = [], s = R.dropSpot(cr.x, cr.z, P.pos.x, P.pos.z);       // on the opener's side, not inside the crate
    for (const q of list) items.push({ id: nextDrop++, k: q.k, w: q.w, a: q.a, r: q.r, x: s.x, y: cr.y + 0.5, z: s.z, ttl: 30000 });
    I.loot.onNet({ op: 'add', items });
  }
  const defOf = id => H.WEAPONS.find(w => w.id === id) || null;
  const net = {
    openCrate(cr) {
      if (cr.open) return;
      const k = cr.content; core.markOpen(cr, k.s);
      const list = [], def = defOf(k.w);
      if (def) { const d = R.dropRounds(def); list.push({ k: 'w', w: k.w, a: d.a, r: d.r }); }
      if (k.g && defOf('frag')) list.push({ k: 'g', w: 'frag', a: k.g, r: 0 });
      if (k.x) list.push({ k: 'x', w: k.x, a: 1, r: 0 });       // equipment item (gear-data.js)
      dropItems(cr, list);
    },
    botOpen(a, cr) { if (cr.open) return; const k = cr.content; core.markOpen(cr, k.s); core.arm(a, k.w, k.g); },
    botUse(a, cr) { if (cr.s) { core.supply(a, cr.s); core.markUsed(cr); } },
    useSupply(cr) {
      if (!cr.s) return;
      if (cr.s === 'med') { E.heal(P, R.MED); c.msg(core.L('med', { n: R.MED }), 'good'); }
      else { P.armor = Math.min(R.armorCap(P.maxArmor), P.armor + R.ARMOR); c.msg(core.L('arm', { n: R.ARMOR }), 'good'); }
      core.markUsed(cr);
    },
    leave() { end(); },
  };
  function refresh() {
    const S = core.S; S.alive = aliveCount();
    c.score(sq ? sq.scoreLeft() : { label: core.L('alive'), value: S.alive + ' / ' + S.total, color: AMBER }, { label: core.L('kills'), value: P.data.k | 0, color: BLUE });
    const rows = [];
    for (let i = 0; i < E.actors.length; i++) { const a = E.actors[i]; if (a.kind === 'zombie' || !a.data) continue; const rk = sq ? sq.placeOf(a) : ranks.get(a), row = [a === P ? c.t('hud.you') : a.name, a.data.k | 0, rk ? '#' + rk : '—']; row.me = a === P; row.alive = !!a.alive; if (sq) row.team = a.team; rows.push(row); }
    rows.sort((x, y) => (y.alive ? 1 : 0) - (x.alive ? 1 : 0) || y[1] - x[1]);
    E.hud.scoreboard({ columns: [c.t('l.player'), c.t('end.kills'), core.L('place')], rows });
  }
  function end() {
    if (finished) return; finished = true;
    const S = core.S, sr = sq ? sq.result() : null, place = sr ? sr.place : ranks.get(P) || (P.alive ? 1 : S.alive + 1), won = sr ? sr.won : place === 1;       // squads: the squad's placement
    const stats = c.baseStats();
    stats.unshift({ label: core.L('place'), value: '#' + place + ' / ' + (sr ? sr.of : S.total) });
    if (!won && winnerName && !sq) stats.push({ label: core.L('winner'), value: winnerName });
    c.finish(won, sq ? sq.title(won, place) : won ? core.L('won') : core.L('out', { n: place }), stats, won ? 150 : place <= 3 ? 80 : 40);
  }
  return {
    get core() { return core; }, get squads() { return sq; }, bots,
    start() {
      H.setRules(E, false, false);
      E.clearActors(); E.setTeam(P, null); H.ensureData(P);
      E.rules.playerLoadout = false; P.weaponId = 'p9';
      core = createCore(c, H, net);
      const setup = surveyMap(E, H), seed = cfg.seed == null ? Math.floor(Math.random() * 0x7fffffff) : Number(cfg.seed) || 1, rnd = R.rng(seed);
      core.S.clock = -DEPLOY;
      core.setPlan(R.buildPlan({ seed, size: setup.size, anchors: setup.anchors, scale: cfg.zoneScale || 1 }));
      core.setCrates(setup.crates.map((q, i) => ({ i, x: q[0], y: q[1], z: q[2], r: q[3], content: R.rollCrate(rnd) })));
      const sqn = squadSize(cfg);
      if (sqn) { try { sq = SQM.createSquads(c, H, core, { size: sqn }); } catch (e) { console.warn('[zone] squads', e); sq = null; } }       // a failure here: plain Zone
      const total = sq ? SQM.total(R.matchSize(setup.size), sqn) : R.matchSize(setup.size), nb = sq ? 0 : total - 1;
      if (sq) { sq.spawnOffline(setup.spawns, total, rnd, bots, cfg.difficulty); E.lethal = (a, o) => sq.lethal(a, o); }       // a squad lands together; downed instead of dead while a squadmate stands
      // the first points of the survey are the farthest apart: keep just as many as there are soldiers, then deal them at random
      const sp = setup.spawns.slice(0, total); for (let i = sp.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = sp[i]; sp[i] = sp[j]; sp[j] = t; }
      if (!sq) { E.respawn(P, { at: sp[0], delay: 0 }); P.armor = 0; }
      for (let i = 0; i < nb; i++) {
        const a = E.addBot({ name: H.botName(i), team: null, weaponId: 'p9', difficulty: cfg.difficulty || 'normal', hp: 100, at: sp[(i + 1) % sp.length] });
        if (a) { H.ensureData(a); bots.push(a); H.setOrder(a, 'hunt'); }
      }
      core.S.total = bots.length + 1; core.S.alive = core.S.total;
      E.rules.frozen = true;
      c.on('kill', e => {
        const v = e.victim, k = e.killer; if (!v || v.kind === 'zombie' || c.ended) return;
        if (v.data) v.data.d = (v.data.d | 0) + 1;
        if (k && k !== v && k.data) { k.data.k = (k.data.k | 0) + 1; k.data.s = (k.data.s | 0) + (e.head ? 125 : 100); }
        c.trackKill(e, 25, false);
        if (v.data && v.data.crate) { v.data.crate.claim = null; v.data.crate = null; }
        if (sq) { core.S.alive = aliveCount(); sq.onKill(e); refresh(); return; }       // squads: the squad is placed when it is out
        const left = aliveCount(); ranks.set(v, left + 1); core.S.alive = left;
        if (left <= 1) { for (let i = 0; i < E.actors.length; i++) { const a = E.actors[i]; if (a.alive && a.kind !== 'zombie') { ranks.set(a, 1); winnerName = a === P ? null : a.name; } } }
        refresh();
      });
      c.objective(core.L('obj')); refresh();
    },
    update(dt) {
      const S = core.S, wasDeploy = S.clock < 0;
      core.update(dt);
      if (sq) sq.update(dt);
      if (wasDeploy && S.clock >= 0) E.rules.frozen = false;
      if (S.clock < 0) return;
      if (over()) { end(); return; }
      core.driveBots(bots, dt);
      dmgT -= dt;
      if (dmgT <= 0) {
        dmgT = 1; const C = core.C; if (!(C.dps > 0)) return;
        for (let i = 0; i < E.actors.length; i++) {
          const a = E.actors[i]; if (!a.alive || a.kind === 'zombie') continue;
          const dx = a.pos.x - C.x, dz = a.pos.z - C.z; if (dx * dx + dz * dz <= C.r * C.r) continue;
          if (a === P) { try { I.hud.hurt(null); E.audio.hurt(); } catch { /* optional */ } }
          a.hp -= C.dps;       // the gas ignores armour
          if (a.hp <= 0 && !(sq && sq.lethal(a, { by: null, weaponId: 'zone' }))) { a.hp = 0; E.kill(a, { by: null, weaponId: 'zone' }); if (over()) break; }
        }
        if (over()) end();
      }
    },
    stop() { if (sq) { E.lethal = null; try { sq.dispose(); } catch (e) { console.warn('[zone] squads', e); } } if (core) core.dispose(); },
  };
}

/* ====================================================================== */
/* ONLINE: the server decides, one client simulates the bots              */
/* ====================================================================== */
export function zoneOnline(c, H) {
  const { E, cfg } = c, P = E.player, B = H.onlineBase(c), net = cfg.net;
  const bots = new Map(), botList = [], outShots = [], outHits = [], outBooms = [], sbuf = [], proj = E.projectiles, rawSpawn = proj.spawn;
  let core, sim = false, tickT = 0, spawned = false, finalMsg = null, lastBoard = null, finished = false, setupSent = false, botUse = false, sq = null;       // sq: squads (zone-squads.js)
  const idOf = a => (a === P ? B.me : a ? a.id : null);
  const botTeam = b => (sq && b.team ? sq.engineTeam(b.team) : null);
  const isBot = id => typeof id === 'string' && /^b\d{1,3}$/.test(id);
  function refreshList() { botList.length = 0; for (const a of bots.values()) botList.push(a); }
  function addBotActor(b) {
    if (bots.has(b.id)) return;
    let a;
    if (sim) { a = E.addBot({ id: b.id, name: b.name, team: botTeam(b), weaponId: b.weapon || 'p9', difficulty: cfg.difficulty || 'normal', hp: 100, at: [b.x, b.z, b.y || 0] }); if (a) { H.ensureData(a); if (typeof b.hp === 'number' && b.hp > 0) a.hp = b.hp; H.setOrder(a, 'hunt'); } }
    else { a = E.addRemote({ id: b.id, name: b.name, team: botTeam(b), weaponId: b.weapon || 'p9' }); if (a) { if (!a.data) a.data = {}; a.data.bot = 1; } }
    if (!a) return;
    if (!b.alive) { a.alive = false; a.hp = 0; a.ghost = false; if (a.sol && a.sol.setVisible) a.sol.setVisible(false); }
    bots.set(b.id, a);
  }
  function syncBots(list) { for (const b of list || []) addBotActor(b); refreshList(); }
  function takeOver(list) {       // this client becomes the bots' simulator
    for (const [id, a] of [...bots]) { bots.delete(id); E.removeActor(a); }
    sim = true; syncBots(list);
    if (sq) for (const b of list || []) if (b.down && b.alive) sq.downById(b.id, b.hp);       // squads: its downed bots crawl here now
  }
  function showBoard(m) {
    lastBoard = m.board || lastBoard;
    const S = core.S;
    if (typeof m.alive === 'number') S.alive = m.alive;
    if (typeof m.total === 'number') S.total = m.total;
    if (!lastBoard) return;
    let mine = 0; const rows = [];
    for (const q of lastBoard) { if (q.id === B.me) mine = q.k; const row = [q.id === B.me ? c.t('hud.you') : q.name, q.k, q.place ? '#' + q.place : '—']; row.me = q.id === B.me; row.alive = !!q.alive; rows.push(row); }
    rows.sort((x, y) => (y.alive ? 1 : 0) - (x.alive ? 1 : 0) || y[1] - x[1]);
    E.hud.scoreboard({ columns: [c.t('l.player'), c.t('end.kills'), core.L('place')], rows });
    c.score(sq ? sq.scoreLeft() : { label: core.L('alive'), value: S.alive + ' / ' + S.total, color: AMBER }, { label: core.L('kills'), value: mine, color: BLUE });
  }
  function myPlace() {
    const list = (finalMsg && finalMsg.board) || lastBoard || [];
    for (const q of list) if (q.id === B.me) return q.place || (q.alive ? 1 : 0);
    return 0;
  }
  function finish(won, place) {
    if (finished) return; finished = true;
    const S = core.S, stats = c.baseStats();
    if (place) stats.unshift({ label: core.L('place'), value: '#' + place + ' / ' + (sq && sq.S.list.length ? sq.S.list.length : S.total) });       // squads: out of the squads
    if (finalMsg && finalMsg.name && finalMsg.winner !== B.me && !(sq && sq.isMine(finalMsg.winner))) stats.push({ label: core.L('winner'), value: finalMsg.name });
    if (!won && !spawned && !place) {       // joined as a spectator: it did not play, so no result and no reward
      c.ended = true; c.prompt(null); c.progress(null);
      E.endMatch({ won: null, title: core.L('watched'), stats, credits: 0, xp: 0 });
      return;
    }
    const title = sq && (won || place) ? sq.title(won, place) : won ? core.L('won') : place ? core.L('out', { n: place }) : c.t('end.defeat');
    c.finish(won, title, stats, won ? 150 : place && place <= 3 ? 80 : 40);
  }
  const link = {
    openCrate(cr) { B.send('zone_open', { id: cr.id }); },
    botOpen(a, cr) { if (!cr.open && sim) { cr.claim = a; B.send('zone_open', { id: cr.id, bot: a.id }); } },
    botUse(a, cr) { if (cr.s && sim && botUse) B.send('zone_use', { id: cr.id, bot: a.id }); },       // a server without bot supplies (no 'bu') never gets it
    useSupply(cr) { B.send('zone_use', { id: cr.id }); },
    leave() {
      B.send('zone_leave', {});
      finish(false, myPlace() || core.S.alive + 1);
    },
  };
  function onZone(m) {
    const S = core.S;
    if (sq && m.op !== 'sync' && m.op !== 'final' && sq.onZone(m)) return;       // squads: down, up, revives, pings, squads out
    switch (m.op) {
      case 'sync': {
        if (typeof m.el === 'number') S.clock = m.el / 1000; else S.clock = -DEPLOY;
        if (m.plan && !S.plan) core.setPlan(m.plan);
        if (Array.isArray(m.crates) && (!S.crates.length || m.crates.length !== S.crates.length)) core.setCrates(m.crates);
        else if (Array.isArray(m.crates)) for (const q of m.crates) { const cr = core.crateById(q.i); if (cr && q.o && !cr.open) core.markOpen(cr, q.s); else if (cr && cr.open && cr.s && !q.s) core.markUsed(cr); }
        sim = m.sim === B.me; syncBots(m.bots); botUse = m.bu === 1;
        if (sq) sq.sync(m);       // squads: who is with whom, who is down
        if (m.spawn && !spawned && P.alive) { spawned = true; E.respawn(P, { at: m.spawn, delay: 0 }); P.armor = 0; }
        E.rules.frozen = !m.live;
        showBoard(m);
        break;
      }
      case 'go': S.clock = (m.el || 0) / 1000; E.rules.frozen = false; if (typeof m.alive === 'number') S.alive = m.alive; break;
      case 'board': showBoard(m); break;
      case 'open': {
        const cr = core.crateById(m.id); if (!cr) break;
        core.markOpen(cr, m.s);
        if (sim && m.w) { const a = bots.get(m.by); if (a && a.alive) core.arm(a, m.w, m.g | 0); }
        break;
      }
      case 'used': { const cr = core.crateById(m.id); if (cr) core.markUsed(cr); if (m.by === B.me) c.msg(core.L(m.s === 'med' ? 'med' : 'arm', { n: m.s === 'med' ? R.MED : R.ARMOR }), 'good'); else if (sim && isBot(m.by)) { const a = bots.get(m.by); if (a && a.alive) core.supply(a, m.s); } break; }
      case 'fail': { const cr = core.crateById(m.id); if (cr) { cr.wait = c.time + 0.3; if (cr.claim) cr.claim = null; } break; }
      case 'sim': if (m.sim === B.me && !sim) takeOver(m.bots); else if (m.sim !== B.me) sim = false; break;
      case 'bhp': if (sim && Array.isArray(m.l)) for (let i = 0; i + 1 < m.l.length; i += 2) { const a = bots.get(m.l[i]); if (a && a.alive && m.l[i + 1] < a.hp) a.hp = Math.max(1, m.l[i + 1]); } break;
      case 'hitby': { const f = bots.get(m.by); if (f && P.alive) { const vx = f.pos.x - P.pos.x, vz = f.pos.z - P.pos.z, sn = Math.sin(P.yaw), cs = Math.cos(P.yaw); try { E.internals.hud.hurt(Math.atan2(vx * cs - vz * sn, -vx * sn - vz * cs)); } catch { /* optional */ } } break; }
      case 'final': finalMsg = m; break;
      default: break;
    }
  }
  function sendTick() {
    sbuf.length = 0;
    for (let i = 0; i < botList.length; i++) {
      const a = botList[i]; if (!a.alive) continue;
      sbuf.push([a.id, rd(a.pos.x), rd(a.pos.y), rd(a.pos.z), rd(a.yaw), rd(a.pitch || 0), rd(a.vx || 0), rd(a.vz || 0), a.weaponId, a.crouch > 0.5 ? 1 : 0, rd(a.hp)]);
    }
    const msg = { s: sbuf.slice() };
    if (outShots.length) { msg.f = outShots.splice(0, 24); outShots.length = 0; }
    if (outHits.length) { msg.d = outHits.splice(0, 32); outHits.length = 0; }
    if (outBooms.length) { msg.b = outBooms.splice(0, 8); outBooms.length = 0; }
    B.send('zb_tick', msg);
  }
  const rd = v => Math.round(v * 100) / 100;
  return {
    get core() { return core; }, get squads() { return sq; }, bots, base: B,
    start() {
      B.init();
      E.rules.playerLoadout = false; P.weaponId = 'p9';
      if (P.alive) { E.respawn(P, { at: [P.pos.x, P.pos.z, P.pos.y], delay: 0 }); P.armor = 0; }
      core = createCore(c, H, link);
      const sqn = squadSize(cfg);       // squads: the server referees downs and revives, this client shows them (and drives its bots if it simulates them)
      if (sqn) { try { sq = SQM.createSquads(c, H, core, { size: sqn, online: true, B, bots, sim: () => sim }); E.lethal = (a, o) => sq.lethal(a, o); } catch (e) { console.warn('[zone] squads', e); sq = null; } }
      E.rules.frozen = true;
      c.netOn('zone', m => { if (!c.ended) onZone(m); });
      c.netOn('score', s => { if (!c.ended) { B.score(s); if (lastBoard) showBoard({}); } });
      c.netOn('action', a => {
        if (c.ended || B.common(a) || a.type !== 'zb_hit' || !sim) return;
        const d = a.data || {}, t = bots.get(d.bot);
        if (t && t.alive) E.damage(t, d.damage, { by: B.actor(a.from), head: !!d.head, weaponId: d.weapon });
      });
      c.netOn('end', e => {
        if (c.ended) return;
        if (e.players) B.score(e);
        const place = myPlace(), won = sq ? sq.isMine(e.winner) : e.winner === B.me;
        finish(won, won ? 1 : place);
      });
      c.on('kill', e => {
        const v = e.victim; if (!sim || c.ended || !v || !bots.has(v.id) || bots.get(v.id) !== v || v.data.zk) return;
        v.data.zk = 1; if (v.data.crate) { v.data.crate.claim = null; v.data.crate = null; }
        B.send('zb_kill', { id: v.id, by: idOf(e.killer), weapon: e.weaponId || undefined, head: !!e.head });
      });
      c.on('damage', e => {
        if (!sim || c.ended || !e.attacker || !isBot(e.attacker.id) || bots.get(e.attacker.id) !== e.attacker || !e.victim || !(e.amount > 0)) return;
        const v = e.victim; if (!(v === P || (v.isRemote && !isBot(v.id)))) return;
        // a blast is credited to the explosive that made it, not to the gun in hand (the server caps a hit by its weapon)
        const a = e.attacker, wd = a.wdef; let wid = a.weaponId;
        if (wd && e.amount > wd.dmg * (wd.hs || 1) * (wd.pellets || 1) + 0.01 && a.data && a.data.blast && c.time - a.data.blastT < 9) wid = a.data.blast;
        if (outHits.length < 32) outHits.push([a.id, idOf(v), rd(e.amount), e.head ? 1 : 0, wid]);
      });
      // explosives of the bots: the other screens get the flight (mirror) and the blast
      proj.spawn = function (def, owner, x, y, z, vx, vy, vz, mul, visual, pid, mx, my, mz, ix, iy, iz) {
        const id = rawSpawn.call(this, def, owner, x, y, z, vx, vy, vz, mul, visual, pid, mx, my, mz, ix, iy, iz);
        try {
          if (id && !visual && sim && owner && owner.data && bots.get(owner.id) === owner) {
            if (def.proj.radius > 0) { owner.data.blast = def.id; owner.data.blastT = c.time; }
            if (outShots.length < 24) { const ax = vx - (ix || 0), ay = vy - (iy || 0), az = vz - (iz || 0), l = Math.sqrt(ax * ax + ay * ay + az * az) || 1; outShots.push([owner.id, rd(x), rd(y), rd(z), +(ax / l).toFixed(4), +(ay / l).toFixed(4), +(az / l).toFixed(4), def.id, rd(vx), rd(vy), rd(vz), id]); }
          }
        } catch { /* a lost mirror must not stop the shot */ }
        return id;
      };
      c.on('explosion', e => { if (sim && e.by && bots.get(e.by.id) === e.by && e.weaponId && outBooms.length < 8) outBooms.push([e.by.id, rd(e.x), rd(e.y), rd(e.z), e.weaponId]); });
      c.on('shot', e => {
        const a = e.actor; if (!sim || !a || !isBot(a.id) || bots.get(a.id) !== a || outShots.length >= 24) return;
        const def = a.wdef; if (!def || def.kind === 'melee' || def.kind === 'projectile' || def.kind === 'thrown') return;
        const cp = Math.cos(a.pitch || 0);
        outShots.push([a.id, rd(a.pos.x), rd(a.pos.y + 1.45), rd(a.pos.z), +(-Math.sin(a.yaw) * cp).toFixed(4), +Math.sin(a.pitch || 0).toFixed(4), +(-Math.cos(a.yaw) * cp).toFixed(4), def.id]);
      });
      // every client measures the map; the server keeps the first report and answers with the state of the match
      if (!setupSent) { setupSent = true; const s = surveyMap(E, H); B.send('zone_setup', { size: s.size, anchors: s.anchors, crates: s.crates, spawns: s.spawns }); }
      c.center(core.L('deploy')); c.objective(core.L('obj'));
    },
    update(dt) {
      core.update(dt);
      if (sq) sq.update(dt);
      if (!sim || core.S.clock < 0) return;
      core.driveBots(botList, dt);
      tickT -= dt;
      if (tickT <= 0) { tickT = 0.1; sendTick(); }
    },
    stop() { if (proj.spawn !== rawSpawn) proj.spawn = rawSpawn; if (sq) { E.lethal = null; try { sq.dispose(); } catch (e) { console.warn('[zone] squads', e); } } if (core) core.dispose(); },
  };
}
