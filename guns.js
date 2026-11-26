/* FRONT ZÉRO — first-person weapons. Fully procedural, original fictional designs.
   Gun space: u = forward (world -Z), v = up (+Y), x = right (+X). Bore is near v = 0. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerExtraGuns, extraMaterials } from './guns-extra.js';
import { createSkinner } from './weapon-skins.js';

/* ---------- math ---------- */
const sat = t => t < 0 ? 0 : t > 1 ? 1 : t;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => a + (b - a) * t;
const seg = (a, b, t) => { const k = sat((t - a) / (b - a)); return k * k * (3 - 2 * k); };
const V = (u, v, x = 0) => new THREE.Vector3(x, v, -u);
const mj = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * k * (k * (6 * k - 15) + 10);      // minimum-jerk reach: zero velocity and acceleration at both ends

class Spring {
  constructor(k, damp) { this.k = k; this.c = 2 * damp * Math.sqrt(k); this.x = 0; this.v = 0; }
  step(dt, target = 0) {
    /* fixed small sub-steps: the same response at 30, 60 and 144 fps */
    const n = dt > 0 ? Math.min(16, Math.ceil(dt * 240)) : 0, h = n ? dt / n : 0;
    for (let i = 0; i < n; i++) { this.v += (-this.k * (this.x - target) - this.c * this.v) * h; this.x += this.v * h; }
    if (!Number.isFinite(this.x) || !Number.isFinite(this.v)) { this.x = target; this.v = 0; }
    return this.x;
  }
  reset() { this.x = 0; this.v = 0; }
}

/* ---------- procedural textures (typed arrays only, no DOM) ---------- */
let seed = 7;
const R = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xfffff) / 0xfffff; };
function dataTex(d, n, srgb, wrap = true) {
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
function grainTexture() {
  const n = 128, d = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) { const v = 196 + R() * 56; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  for (let s = 0; s < 70; s++) {
    let x = R() * n, y = R() * n; const a = R() * 6.28, l = 6 + R() * 26, v = R() < .5 ? 130 : 255;
    for (let j = 0; j < l; j++) {
      const q = (((y | 0) + n) % n) * n + (((x | 0) + n) % n);
      d[q * 4] = d[q * 4 + 1] = d[q * 4 + 2] = v; x += Math.cos(a); y += Math.sin(a);
    }
  }
  return dataTex(d, n, false);
}
function woodTexture() {
  const n = 128, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const w = Math.sin(y * .42 + Math.sin(x * .049) * 2.2) * .5 + Math.sin(y * 1.31 + Math.sin(x * .098 + 1) * 1.2) * .24;
    const v = 188 + w * 48 + R() * 16, q = (y * n + x) * 4;
    d[q] = clamp(v + 12, 0, 255); d[q + 1] = clamp(v * .92, 0, 255); d[q + 2] = clamp(v * .82, 0, 255); d[q + 3] = 255;
  }
  return dataTex(d, n, true);
}
function envTexture() {
  const w = 64, h = 32, d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = y / (h - 1), q = (y * w + x) * 4;
    const sky = seg(.42, .92, t), band = Math.exp(-Math.pow((t - .62) * 9, 2));
    const pan = Math.pow(Math.max(0, Math.cos((x / w) * Math.PI * 4 + .6)), 6) * seg(.5, .75, t);
    d[q] = clamp(44 + sky * 118 + band * 62 + pan * 90, 0, 255);
    d[q + 1] = clamp(40 + sky * 126 + band * 58 + pan * 90, 0, 255);
    d[q + 2] = clamp(34 + sky * 136 + band * 50 + pan * 86, 0, 255);
    d[q + 3] = 255;
  }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat);
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
function flashTexture() {
  const n = 64, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const X = (x + .5) / n * 2 - 1, Y = (y + .5) / n * 2 - 1, r = Math.hypot(X, Y), a = Math.atan2(Y, X);
    const spikes = .46 + .54 * Math.pow(Math.abs(Math.cos(a * 3.5 + .4)), 5);
    const v = Math.pow(sat(1 - r / spikes), 1.7) + Math.pow(sat(1 - r * 3.4), 2);
    const q = (y * n + x) * 4, c = clamp(v * 255, 0, 255);
    d[q] = c; d[q + 1] = c * .92; d[q + 2] = c * .72; d[q + 3] = c;
  }
  return dataTex(d, n, true, false);
}
const camoCache = new Map();
function camoTexture(c) {
  const key = c.join('_'); if (camoCache.has(key)) return camoCache.get(key);
  const n = 128, d = new Uint8Array(n * n * 4), rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const cols = c.map(rgb), id = new Uint8Array(n * n);
  seed = 4242 + (c[0] & 0xffff);
  for (let b = 0; b < 46; b++) {
    const cx = R() * n, cy = R() * n, rx = 7 + R() * 17, ry = 4 + R() * 10, a = R() * 3.14, ca = Math.cos(a), sa = Math.sin(a), l = b % 2 ? 1 : 2, m = Math.ceil(Math.max(rx, ry));
    for (let y = -m; y <= m; y++) for (let x = -m; x <= m; x++) {
      const px = x * ca + y * sa, py = -x * sa + y * ca;
      if (px * px / (rx * rx) + py * py / (ry * ry) < 1) id[((cy + y + n * 2 | 0) % n) * n + ((cx + x + n * 2 | 0) % n)] = l;
    }
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const k = cols[id[y * n + x]], w = ((x + y) % 2 ? .93 : 1.03) - R() * .07, q = (y * n + x) * 4;
    d[q] = clamp(k[0] * w, 0, 255); d[q + 1] = clamp(k[1] * w, 0, 255); d[q + 2] = clamp(k[2] * w, 0, 255); d[q + 3] = 255;
  }
  const t = dataTex(d, n, true); t.repeat.set(2, 3); camoCache.set(key, t); return t;
}

/* ---------- materials (one shared set) ---------- */
function makeMaterials() {
  const env = envTexture(), grain = grainTexture(), wood = woodTexture();
  const std = (color, metalness, roughness, extra) => new THREE.MeshStandardMaterial({ color, metalness, roughness, roughnessMap: grain, envMap: env, envMapIntensity: .95, vertexColors: true, fog: false, ...extra });
  return {
    steel: std(0x505356, .92, .62), dark: std(0x1f2022, .78, .72), paint: std(0x3a3c34, .32, .78),
    poly: std(0x232425, .03, .9), tan: std(0x97855f, .03, .95), wood: std(0x8a5a35, .03, .72, { map: wood }),
    brass: std(0xc79a48, .95, .46), rubber: std(0x151515, 0, 1), red: std(0x96241d, .05, .62),
    nickel: std(0xa4a8aa, .95, .36), blade: std(0xc4c8ca, 1, .24), olive: std(0x4c5436, .08, .86),
    glass: new THREE.MeshStandardMaterial({ color: 0x5a7f78, metalness: .2, roughness: .08, transparent: true, opacity: .2, envMap: env, depthWrite: false, fog: false }),
    dot: new THREE.MeshBasicMaterial({ color: 0xff2412, toneMapped: false, fog: false }),
    glove: new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: .88, metalness: 0, roughnessMap: grain, envMap: env, envMapIntensity: .5, fog: false }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, metalness: 0, envMap: env, envMapIntensity: .35, fog: false }),
    ...extraMaterials(std, dataTex),
  };
}

/* ---------- geometry kit ---------- */
function outline(path, pts, r) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1, lb = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const ra = Math.min(r, la * .45), rb = Math.min(r, lb * .45);
    const ax = p[0] + (a[0] - p[0]) / la * ra, ay = p[1] + (a[1] - p[1]) / la * ra;
    const bx = p[0] + (b[0] - p[0]) / lb * rb, by = p[1] + (b[1] - p[1]) / lb * rb;
    if (i === 0) path.moveTo(ax, ay); else path.lineTo(ax, ay);
    path.quadraticCurveTo(p[0], p[1], bx, by);
  }
  path.closePath();
  return path;
}
function slots(u0, u1, v0, v1, n, lean = .004) {
  const out = [], step = (u1 - u0) / n, w = step * .58;
  for (let i = 0; i < n; i++) { const a = u0 + step * (i + .21); out.push([[a + lean, v1], [a, v0], [a + w, v0], [a + w + lean, v1]]); }
  return out;
}
class Kit {
  constructor(mats) { this.m = mats; this.root = new THREE.Group(); this.parts = {}; this.buf = new Map(); this.cur = 'body'; this.part('body'); this.anchors = {}; }
  part(name, pivot = null) {
    if (!this.parts[name]) {
      const g = new THREE.Group(); g.name = name; g.userData.pivot = pivot ? V(pivot[0], pivot[1], pivot[2] || 0) : new THREE.Vector3();
      g.position.copy(g.userData.pivot); g.userData.base = g.position.clone(); this.root.add(g); this.parts[name] = g;
    }
    this.cur = name; return this;
  }
  add(mat, geo, wear = false) {
    const key = this.cur + '|' + mat; if (!this.buf.has(key)) this.buf.set(key, []);
    geo.userData.wear = wear; this.buf.get(key).push(geo); return this;
  }
  ext(mat, pts, w, o = {}) {
    const b = o.b ?? .0011, s = outline(new THREE.Shape(), pts, o.r ?? .003);
    if (o.holes) for (const h of o.holes) s.holes.push(outline(new THREE.Path(), h, o.hr ?? .0015));
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.0004, w - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 1, curveSegments: o.cs ?? 3, steps: 1 });
    g.translate(0, 0, -(w - 2 * b) / 2); g.rotateY(Math.PI / 2); g.translate(o.x || 0, 0, 0);
    return this.add(mat, g, true);
  }
  cyl(mat, u0, u1, v, r0, r1 = r0, x = 0, seg_ = 14) {
    const g = new THREE.CylinderGeometry(r1, r0, Math.abs(u1 - u0), seg_, 1); g.rotateX(-Math.PI / 2); g.translate(x, v, -(u0 + u1) / 2); return this.add(mat, g);
  }
  tube(mat, u0, u1, v, ro, ri, x = 0, seg_ = 20) {
    const s = new THREE.Shape(); s.absarc(0, 0, ro, 0, Math.PI * 2, false); const h = new THREE.Path(); h.absarc(0, 0, ri, 0, Math.PI * 2, true); s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.abs(u1 - u0), bevelEnabled: false, curveSegments: seg_ }); g.translate(x, v, -Math.max(u0, u1)); return this.add(mat, g);
  }
  box(mat, u, v, lu, hv, wx, x = 0) { const g = new THREE.BoxGeometry(wx, hv, lu); g.translate(x, v, -u); return this.add(mat, g); }
  pin(mat, u, v, r, w, x = 0) { const g = new THREE.CylinderGeometry(r, r, w, 8); g.rotateZ(Math.PI / 2); g.translate(x, v, -u); return this.add(mat, g); }
  disc(mat, u, v, r, x = 0) { const g = new THREE.CircleGeometry(r, 18); g.translate(x, v, -u); return this.add(mat, g); }
  rail(u0, u1, v, w = .021, mat = 'dark') {
    this.box(mat, (u0 + u1) / 2, v - .0025, u1 - u0, .005, w * .82);
    for (let u = u0 + .004; u < u1 - .002; u += .0098) this.box(mat, u, v + .0015, .0052, .0035, w);
    return this;
  }
  anchor(name, u, v, x = 0) { const o = new THREE.Object3D(); o.position.copy(V(u, v, x)); this.root.add(o); this.anchors[name] = o; return o; }
  /* the built-in sight goes in its own part ('optic0'), so a mounted optic can replace it */
  sightBegin(u, v) { if (this.noStock) return; this.sightFrom = this.cur; this.sightAt = [u, v]; this.part('optic0'); }
  sightEnd() { if (!this.noStock) this.cur = this.sightFrom; }
  build() {
    for (const [key, list] of this.buf) {
      const [pn, mn] = key.split('|'), part = this.parts[pn], piv = part.userData.pivot, geos = [];
      for (const src of list) {
        const g = src.index ? src.toNonIndexed() : src, wear = src.userData.wear;
        for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a);
        const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = new Float32Array(P.count * 3);
        for (let i = 0; i < P.count; i++) {
          const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i));
          if (nx >= ny && nx >= nz) U.setXY(i, P.getZ(i) * 9, P.getY(i) * 9);
          else if (ny >= nz) U.setXY(i, P.getZ(i) * 9, P.getX(i) * 9);
          else U.setXY(i, P.getX(i) * 9, P.getY(i) * 9);
          const edge = wear && nx > .16 && nx < .97;
          const c = edge ? 1.5 + R() * .6 : .93 + R() * .1; C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = c;
        }
        g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.translate(-piv.x, -piv.y, -piv.z); geos.push(g);
      }
      const merged = mergeGeometries(geos, false); for (const g of geos) g.dispose();
      const mesh = new THREE.Mesh(merged, this.m[mn]); mesh.frustumCulled = false; mesh.renderOrder = mn === 'glass' ? 3 : 1; part.add(mesh);
    }
    this.buf.clear();
    this.root.traverse(o => { o.frustumCulled = false; });
    return this;
  }
}

/* shared small assemblies */
function triggerGroup(k, u, v, frame = 'poly') {
  k.ext(frame, [[u + .036, v], [u + .036, v - .006], [u + .026, v - .029], [u - .024, v - .031], [u - .03, v - .024], [u - .024, v - .021], [u + .018, v - .022], [u + .028, v - .004]], .010, { r: .004, b: .0007 });
  k.ext('steel', [[u + .004, v + .002], [u + .009, v - .008], [u + .006, v - .020], [u + .001, v - .021], [u + .002, v - .01], [u - .003, v + .002]], .006, { r: .002, b: .0004 });
}
function reflex(k, u, v, base = 'dark') {
  k.sightBegin(u, v);
  k.ext(base, [[u - .034, v], [u + .036, v], [u + .03, v + .012], [u + .018, v + .016], [u - .022, v + .016], [u - .03, v + .012]], .03, { r: .004 });
  k.box('dark', u, v + .003, .05, .006, .036);
  k.pin('steel', u + .018, v + .003, .0025, .04); k.pin('steel', u - .018, v + .003, .0025, .04);
  k.tube('dark', u - .018, u + .022, v + .034, .0225, .0195, 0, 22);
  k.box('dark', u + .002, v + .016, .03, .008, .024);
  k.cyl('dark', u - .006, u + .014, v + .059, .005, .005, .0, 10);
  k.cyl('steel', u - .004, u + .006, v + .034, .0045, .0045, .0255, 10);
  k.disc('glass', u + .012, v + .034, .0196);
  k.disc('dot', u + .011, v + .034, .00085);
  k.anchor('sight', u + .011, v + .034);
  k.sightEnd();
}
function brake(k, u, r = .0125, len = .058) {
  k.cyl('dark', u, u + len, 0, r, r * .96, 0, 12);
  k.cyl('steel', u + len, u + len + .004, 0, r * .96, r * .72, 0, 12);
  for (let i = 0; i < 3; i++) { const a = u + .012 + i * .015; k.box('rubber', a, 0, .0058, r * 2.04, r * 1.02); k.box('rubber', a, r * .62, .0058, r * .5, r * 2.04); }
}

/* ---------- 1. Sentinelle P9: angular compact service pistol ---------- */
function buildP9(k) {
  k.ext('poly', [[-.071, -.012], [.101, -.012], [.101, -.021], [.066, -.027], [.036, -.029], [-.004, -.031], [-.03, -.03], [-.071, -.027]], .0275);
  k.ext('poly', [[-.075, -.023], [-.006, -.028], [-.009, -.044], [-.018, -.052], [-.011, -.061], [-.021, -.07], [-.015, -.08], [-.026, -.09], [-.022, -.102], [-.032, -.124], [-.083, -.122], [-.089, -.083], [-.082, -.046]], .0295, { r: .004 });
  for (let i = 0; i < 7; i++) { const a = -.09 + i * .0095; k.box('rubber', -.047 + i * .0007 + a * .08, a, .056, .0034, .0303); }
  triggerGroup(k, .021, -.027);
  k.box('dark', .079, -.026, .036, .004, .018);
  k.pin('steel', .034, -.019, .003, .029); k.pin('steel', -.046, -.018, .0028, .029);
  k.box('steel', -.012, -.016, .018, .006, .0295, .0);
  k.part('slide');
  k.ext('steel', [[-.076, -.012], [.106, -.012], [.112, -.006], [.112, .014], [.102, .0235], [-.058, .0255], [-.076, .018]], .0262, { r: .003 });
  k.box('rubber', .018, .0135, .044, .018, .004, .0118);
  k.box('dark', .019, .004, .040, .002, .0275);
  for (let i = 0; i < 8; i++) k.box('dark', -.067 + i * .0058, .004, .0024, .029, .0272);
  for (let i = 0; i < 4; i++) k.box('dark', .086 + i * .0055, .004, .0022, .022, .0272);
  k.box('dark', .095, .0285, .009, .007, .004); k.box('dot', .0912, .0325, .0012, .0022, .0022);
  k.box('dark', -.058, .029, .011, .0075, .0065, -.0065); k.box('dark', -.058, .029, .011, .0075, .0065, .0065);
  k.box('dark', -.058, .0245, .012, .003, .022);
  k.cyl('dark', .104, .1135, .001, .0072, .0072, 0, 12); k.cyl('rubber', .1125, .1137, .001, .0048, .0048, 0, 10);
  k.anchor('sight', .0912, .0325);
  k.part('mag');
  k.ext('steel', [[-.012, -.03], [-.06, -.03], [-.08, -.124], [-.034, -.127]], .019, { r: .002 });
  k.ext('poly', [[-.03, -.123], [-.087, -.12], [-.09, -.132], [-.031, -.135]], .029, { r: .003 });
  k.anchor('muzzle', .114, .001); k.anchor('eject', .018, .018, .012);
  return { grip: [-.05, -.075, .24], support: [-.052, -.094], mag: [-.058, -.112], rack: [-.055, .014] };
}

/* ---------- 2. Faucon AR-7: angular carbine with faceted monolithic upper ---------- */
function buildAR(k) {
  const h = slots(.135, .385, .002, .019, 10);
  k.ext('paint', [[-.132, -.012], [.112, -.012], [.122, -.004], [.122, .026], [.112, .031], [-.102, .031], [-.132, .023]], .041, { r: .004 });
  k.ext('paint', [[-.126, -.012], [.114, -.012], [.106, -.044], [.062, -.051], [.046, -.04], [-.03, -.04], [-.056, -.056], [-.102, -.05], [-.126, -.031]], .036, { r: .004 });
  k.ext('dark', [[.112, -.012], [.112, -.036], [.066, -.044], [.056, -.034], [.056, -.012]], .0375, { r: .002, b: .0005 });
  k.ext('paint', [[.108, -.017], [.41, -.017], [.418, -.009], [.418, .023], [.41, .03], [.108, .03]], .043, { holes: h, r: .004 });
  k.ext('dark', [[.13, -.017], [.40, -.017], [.40, -.024], [.13, -.024]], .03, { r: .002 });
  for (let i = 0; i < 7; i++) k.box('rubber', .165 + i * .034, -.0265, .018, .004, .03);
  k.rail(-.126, .405, .037);
  k.cyl('steel', .10, .49, .004, .0088, .0078);
  k.cyl('steel', .392, .432, .004, .0138, .0138, 0, 10); k.box('dark', .412, .0185, .018, .016, .018);
  k.cyl('steel', .12, .40, .019, .0035, .0035, 0, 6);
  brake(k, .486);
  k.ext('poly', [[-.056, -.04], [-.012, -.04], [-.004, -.052], [-.014, -.062], [-.009, -.072], [-.02, -.084], [-.015, -.096], [-.028, -.128], [-.036, -.14], [-.08, -.136], [-.082, -.122], [-.066, -.07]], .032, { r: .004 });
  for (let i = 0; i < 9; i++) k.box('rubber', -.04 - i * .0028, -.052 - i * .0088, .03, .0032, .0325);
  triggerGroup(k, .015, -.04);
  k.box('rubber', .004, .012, .058, .022, .002, .0208);
  k.pin('steel', -.094, -.024, .0034, .037); k.pin('steel', .097, -.03, .0034, .037);
  k.box('steel', -.04, -.024, .022, .007, .0375);
  k.cyl('dark', -.31, -.13, .006, .0145, .0145);
  k.ext('tan', [[-.15, .025], [-.145, -.002], [-.195, -.026], [-.262, -.07], [-.328, -.082], [-.335, .036], [-.27, .04], [-.24, .012], [-.18, .012]], .036, { r: .006, holes: [[[-.21, -.008], [-.25, -.036], [-.292, -.05], [-.296, .01], [-.25, .004]]], hr: .005 });
  k.ext('rubber', [[-.333, .038], [-.345, .042], [-.348, -.083], [-.33, -.084]], .04, { r: .004 });
  reflex(k, .025, .0405);
  k.part('mag', [.05, -.04]);
  k.ext('poly', [[.094, -.03], [.036, -.03], [.024, -.09], [.002, -.156], [.056, -.172], [.074, -.116], [.088, -.07]], .024, { r: .005 });
  for (let i = 0; i < 5; i++) { const t = i / 4; k.ext('dark', [[mix(.09, .072, t), mix(-.058, -.118, t)], [mix(.031, .012, t), mix(-.058, -.123, t)], [mix(.03, .011, t), mix(-.062, -.127, t)], [mix(.089, .071, t), mix(-.062, -.122, t)]], .0245, { r: .001, b: 0 }); }
  k.ext('dark', [[.06, -.168], [-.002, -.152], [-.004, -.163], [.058, -.181]], .029, { r: .003 });
  k.box('brass', .064, -.031, .05, .006, .010);
  k.part('bolt');
  k.box('steel', .004, .012, .05, .017, .004, .0202); k.box('dark', .018, .012, .012, .012, .0044, .0204);
  k.part('handle');
  k.box('dark', -.128, .028, .032, .008, .022); k.box('steel', -.145, .028, .008, .009, .044);
  k.anchor('muzzle', .55, .004); k.anchor('eject', .004, .014, .02);
  return { grip: [-.042, -.088, .3], support: [.27, -.022], mag: [.04, -.122], charge: [-.14, .03], handle: .074 };
}

/* ---------- 3. Vipère K-4: compact tube-receiver SMG with skeleton stock ---------- */
function buildSMG(k) {
  k.ext('paint', [[-.102, -.018], [.128, -.018], [.138, -.008], [.138, .026], [.122, .032], [-.09, .032], [-.104, .022]], .037, { r: .006 });
  k.ext('poly', [[-.088, -.018], [.128, -.018], [.122, -.038], [.06, -.042], [.052, -.034], [-.03, -.034], [-.05, -.046], [-.088, -.04]], .034, { r: .004 });
  k.ext('poly', [[.128, -.018], [.262, -.018], [.268, -.008], [.268, .026], [.258, .032], [.128, .032]], .039, { holes: slots(.146, .252, .004, .021, 6), r: .004 });
  k.rail(-.09, .262, .038);
  k.rail(.15, .258, -.022, .018);
  k.cyl('steel', .12, .325, .007, .0075);
  k.cyl('dark', .264, .324, .007, .0125, .0115, 0, 12);
  for (let i = 0; i < 4; i++) k.cyl('rubber', .278 + i * .011, .283 + i * .011, .007, .0128, .0128, 0, 12);
  k.ext('poly', [[-.05, -.034], [-.01, -.034], [-.002, -.048], [-.012, -.06], [-.006, -.07], [-.016, -.082], [-.012, -.094], [-.024, -.122], [-.032, -.132], [-.072, -.128], [-.074, -.116], [-.06, -.066]], .031, { r: .004 });
  for (let i = 0; i < 8; i++) k.box('rubber', -.035 - i * .0028, -.05 - i * .0092, .028, .0032, .0316);
  triggerGroup(k, .018, -.034);
  k.box('rubber', .012, .014, .05, .019, .002, .019);
  k.ext('dark', [[-.1, .018], [-.1, -.012], [-.116, -.012], [-.116, .018]], .03, { r: .002 });
  k.ext('steel', [[-.112, .018], [-.27, .012], [-.276, -.058], [-.262, -.06], [-.258, -.003], [-.112, .004]], .012, { x: .012, r: .004 });
  k.ext('steel', [[-.112, .018], [-.27, .012], [-.276, -.058], [-.262, -.06], [-.258, -.003], [-.112, .004]], .012, { x: -.012, r: .004 });
  k.ext('rubber', [[-.268, .016], [-.286, .018], [-.288, -.064], [-.27, -.064]], .038, { r: .004 });
  k.pin('steel', -.112, .011, .004, .042);
  // foregrip
  k.ext('poly', [[.205, -.024], [.176, -.024], [.168, -.044], [.172, -.098], [.18, -.108], [.206, -.108], [.214, -.098], [.212, -.04]], .03, { r: .005 });
  for (let i = 0; i < 6; i++) k.box('rubber', .191, -.052 - i * .009, .046, .0035, .031);
  reflex(k, .03, .0415);
  k.part('mag', [.09, -.034]);
  k.ext('steel', [[.116, -.026], [.067, -.026], [.06, -.2], [.108, -.203]], .021, { r: .003 });
  for (let i = 0; i < 6; i++) k.box('dark', .09, -.058 - i * .023, .046, .0028, .0216);
  k.ext('poly', [[.056, -.198], [.112, -.2], [.114, -.214], [.054, -.212]], .027, { r: .003 });
  k.box('brass', .094, -.027, .04, .006, .009);
  k.part('bolt');
  k.box('steel', .012, .014, .044, .0145, .004, .0175); k.box('dark', .03, .021, .012, .008, .03, .018);
  k.part('handle');
  k.box('steel', .094, .017, .014, .008, .034, -.031); k.box('dark', .094, .017, .008, .012, .006, -.05);
  k.anchor('muzzle', .328, .007); k.anchor('eject', .012, .015, .02);
  return { grip: [-.037, -.082, .3], support: [.19, -.071], fore: true, mag: [.086, -.13], charge: [.094, .018], handle: .056, sideCharge: true };
}

/* ---------- 4. Marteau 12: steel receiver, wood furniture, tube magazine ---------- */
function buildSG(k) {
  k.ext('steel', [[-.13, -.04], [.1, -.04], [.112, -.024], [.112, .017], [.094, .026], [-.092, .029], [-.13, .012]], .044, { r: .005 });
  k.box('dark', .008, .007, .074, .024, .002, .0224);
  k.box('dark', .018, -.039, .1, .004, .026);
  triggerGroup(k, -.012, -.04, 'dark');
  k.pin('steel', -.08, -.018, .0035, .046); k.pin('steel', .074, -.022, .0035, .046);
  k.cyl('steel', .10, .62, .009, .0118, .0108, 0, 16);
  k.cyl('dark', .10, .535, -.0205, .0132, .0132, 0, 14);
  k.cyl('steel', .535, .55, -.0205, .0142, .0142, 0, 14); k.box('dark', .526, -.005, .015, .025, .012);
  k.box('dark', .36, .0225, .47, .0028, .008);
  for (let i = 0; i < 16; i++) k.box('rubber', .14 + i * .029, .0225, .014, .0032, .0084);
  k.cyl('dark', .612, .632, .009, .0128, .0128, 0, 16);
  k.cyl('brass', .603, .608, .0265, .0022, .0022, 0, 8); k.box('steel', .605, .0225, .014, .005, .004);
  k.box('dot', .603, .0288, .002, .0028, .0028);
  k.box('dark', -.061, .0205, .042, .006, .026);
  for (const x of [-.0125, .0125]) k.ext('dark', [[-.078, .03], [-.044, .03], [-.05, .041], [-.056, .046], [-.07, .046]], .005, { r: .002, b: .0006, x });
  // ghost-ring rear sight, centred on the bead line
  k.tube('dark', -.066, -.058, .0288, .0088, .0052, 0, 16);
  k.ext('wood', [[-.128, .026], [-.128, -.036], [-.095, -.044], [-.075, -.052], [-.085, -.074], [-.102, -.112], [-.145, -.116], [-.152, -.094], [-.156, -.06], [-.25, -.092], [-.395, -.118], [-.402, .038], [-.34, .03], [-.21, .018]], .04, { r: .007 });
  for (let i = 0; i < 6; i++) k.box('dark', -.104 - i * .002, -.078 - i * .0062, .03, .0018, .0405);
  k.ext('rubber', [[-.401, .04], [-.416, .044], [-.42, -.12], [-.397, -.121]], .043, { r: .005 });
  k.anchor('sight', .603, .0288);
  k.part('pump');
  k.ext('wood', [[.215, -.003], [.385, -.003], [.396, -.012], [.396, -.036], [.385, -.046], [.215, -.046], [.204, -.036], [.204, -.012]], .048, { r: .005 });
  for (let i = 0; i < 9; i++) k.box('dark', .235 + i * .017, -.024, .006, .036, .0488);
  k.box('steel', .19, -.012, .03, .006, .006, .0145); k.box('steel', .19, -.012, .03, .006, .006, -.0145);
  k.part('bolt');
  k.box('steel', .01, .008, .05, .018, .004, .0214);
  k.anchor('muzzle', .634, .009); k.anchor('eject', .012, .012, .023);
  return { grip: [-.118, -.078, .34], support: [.30, -.025], wide: true, shell: [.03, -.052] };
}

/* ---------- 5. Titan M-60R: belt-fed with top cover, finned shroud and box ---------- */
function buildLMG(k) {
  k.ext('paint', [[-.16, -.046], [.15, -.046], [.168, -.028], [.168, .021], [.15, .029], [-.14, .029], [-.16, .016]], .058, { r: .006 });
  k.box('dark', .03, .004, .15, .024, .002, .0294);
  for (let i = 0; i < 5; i++) k.pin('steel', -.12 + i * .058, -.033, .003, .06);
  k.ext('dark', [[.168, -.024], [.60, -.024], [.61, -.012], [.61, .028], [.60, .036], [.168, .036]], .05, { holes: [...slots(.19, .59, .004, .024, 13, .0)], r: .004 });
  k.cyl('steel', .16, .68, .006, .0125, .0108, 0, 16);
  for (let i = 0; i < 20; i++) k.cyl('dark', .205 + i * .019, .212 + i * .019, .006, .0172, .0172, 0, 12);
  k.rail(.17, .60, .042);
  k.rail(.2, .46, -.028, .02);
  k.cyl('steel', .602, .645, .006, .0168, .0168, 0, 12); k.box('dark', .625, .03, .018, .03, .012);
  brake(k, .672, .0155, .07);
  // carry handle
  k.ext('poly', [[.13, .02], [.17, .062], [.25, .062], [.286, .03], [.272, .03], [.244, .052], [.178, .052], [.146, .02]], .016, { r: .006, x: -.04 }); k.box('dark', .2, .02, .03, .012, .03, -.03);
  k.ext('poly', [[-.057, -.046], [-.012, -.046], [-.003, -.058], [-.014, -.068], [-.008, -.078], [-.02, -.09], [-.016, -.102], [-.03, -.134], [-.038, -.145], [-.082, -.142], [-.085, -.128], [-.068, -.08]], .033, { r: .004 });
  for (let i = 0; i < 9; i++) k.box('rubber', -.041 - i * .0028, -.058 - i * .0088, .031, .0032, .0335);
  triggerGroup(k, .016, -.046, 'dark');
  k.ext('paint', [[-.16, .018], [-.16, -.044], [-.215, -.058], [-.31, -.08], [-.405, -.09], [-.412, .036], [-.33, .036], [-.23, .022]], .044, { r: .007, holes: [[[-.235, -.008], [-.275, -.042], [-.34, -.056], [-.344, .012], [-.27, .006]]], hr: .005 });
  k.ext('rubber', [[-.41, .038], [-.426, .04], [-.43, -.094], [-.408, -.094]], .046, { r: .004 });
  // folded bipod
  for (const x of [-.016, .016]) { k.cyl('steel', .34, .58, -.043, .0048, .0042, x, 8); k.box('rubber', .34, -.043, .022, .012, .012, x); }
  k.box('dark', .582, -.034, .024, .022, .046);
  // fixed optic forward of the feed cover
  reflex(k, .215, .0475);
  k.part('cover', [-.11, .03]);
  k.ext('paint', [[-.13, .029], [.128, .029], [.14, .036], [.132, .05], [.04, .056], [-.086, .056], [-.13, .044]], .056, { r: .005 });
  for (let i = 0; i < 6; i++) k.box('dark', -.08 + i * .036, .053, .012, .0035, .046);
  k.box('steel', .133, .037, .012, .01, .03); k.pin('steel', -.112, .036, .0052, .06);
  k.part('tray');
  k.box('steel', .04, .029, .082, .004, .05);
  k.part('mag', [.05, -.05]);
  k.ext('tan', [[.122, -.048], [-.02, -.048], [-.03, -.17], [.122, -.17]], .092, { r: .007, x: -.016 });
  k.box('dark', .05, -.051, .15, .006, .094, -.016);
  k.box('dark', .05, -.11, .004, .116, .094, -.016);
  k.box('steel', -.03, -.105, .008, .03, .03, -.016);
  k.box('rubber', .052, -.14, .08, .014, .002, .0305);
  k.part('belt', [.05, -.05]);
  for (let i = 0; i < 9; i++) {
    const t = i / 8, a = t * 1.36, x = -.056 + Math.sin(a) * .052, v = -.043 + (1 - Math.cos(a)) * .052 + t * .03;
    k.cyl('brass', .012, .054, v, .0058, .0052, x, 8); k.cyl('brass', .054, .064, v, .0052, .0032, x, 8); k.cyl('steel', .064, .074, v, .0032, .0008, x, 6);
    k.box('dark', .018, v, .007, .0135, .0135, x); k.box('dark', .046, v, .007, .0135, .0135, x);
  }
  k.part('bolt');
  k.box('steel', .03, .004, .058, .017, .004, .0292);
  k.part('handle');
  k.box('steel', .094, -.002, .018, .009, .044, .05); k.box('dark', .094, -.002, .009, .015, .009, .074);
  k.anchor('muzzle', .748, .006); k.anchor('eject', .03, .002, .03);
  return { grip: [-.046, -.094, .3], support: [.36, -.034], mag: [.05, -.16], charge: [.094, -.002], cover: [.11, .058], handle: .082, sideCharge: true };
}

/* ---------- 6. Longue-Vue L3: tan chassis bolt rifle with long optic ---------- */
function buildSR(k) {
  k.ext('steel', [[-.112, -.016], [.13, -.016], [.142, -.008], [.142, .02], [.13, .027], [-.098, .027], [-.112, .018]], .036, { r: .005 });
  k.ext('tan', [[-.14, -.014], [.36, -.014], [.372, -.026], [.366, -.052], [.09, -.052], [.066, -.06], [.04, -.05], [-.04, -.05], [-.066, -.076], [-.078, -.082], [-.11, -.075], [-.135, -.05]], .048, { r: .006, holes: slots(.17, .35, -.043, -.021, 8) });
  k.box('rubber', .258, -.056, .17, .006, .03);
  k.ext('tan', [[-.05, -.05], [-.012, -.05], [-.004, -.064], [-.012, -.075], [-.008, -.086], [-.018, -.097], [-.014, -.108], [-.028, -.134], [-.034, -.146], [-.078, -.142], [-.08, -.128], [-.064, -.08]], .033, { r: .005 });
  for (let i = 0; i < 9; i++) k.box('rubber', -.039 - i * .0029, -.064 - i * .0088, .032, .0032, .0335);
  triggerGroup(k, .022, -.05, 'dark');
  k.ext('tan', [[-.135, .006], [-.135, -.052], [-.205, -.07], [-.32, -.096], [-.43, -.105], [-.436, .012], [-.38, .018], [-.32, .03], [-.25, .036], [-.2, .015]], .042, { r: .008, holes: [[[-.235, -.012], [-.27, -.054], [-.345, -.07], [-.35, .004], [-.29, .012]]], hr: .006 });
  k.ext('rubber', [[-.435, .015], [-.452, .018], [-.456, -.11], [-.433, -.11]], .046, { r: .005 });
  k.ext('poly', [[-.262, .036], [-.326, .03], [-.326, .046], [-.262, .052]], .03, { r: .004 });
  k.cyl('steel', .125, .86, .004, .0122, .0078, 0, 16);
  for (const a of [0, 1, 2]) k.box('dark', .46, .004 + (a - 1) * .0058, .4, .0012, .0232);
  k.cyl('dark', .85, .93, .004, .0138, .0125, 0, 14);
  for (let i = 0; i < 4; i++) k.box('rubber', .865 + i * .014, .004, .006, .029, .0145);
  k.box('dark', .03, .026, .23, .004, .02);
  k.rail(-.08, .13, .034, .022);
  // optic: tube, bell, ocular, turrets, rings
  const sv = .084;
  k.cyl('dark', -.09, .22, sv, .0152, .0152, 0, 20);
  k.cyl('dark', .22, .30, sv, .0152, .0268, 0, 20);
  k.cyl('dark', .30, .335, sv, .0268, .0268, 0, 20);
  k.cyl('dark', -.15, -.09, sv, .0208, .0165, 0, 20);
  k.cyl('rubber', -.158, -.15, sv, .0212, .0212, 0, 20);
  k.disc('glass', .335, sv, .0255);
  k.box('dark', .06, sv + .022, .024, .016, .024); k.cyl('steel', .05, .07, sv + .032, .0122, .0122, 0, 14);
  k.box('dark', .06, sv, .024, .024, .05); k.cyl('steel', .05, .07, sv, .0118, .0118, .03, 14);
  for (const u of [-.04, .13]) { k.tube('steel', u - .012, u + .012, sv, .0185, .0152, 0, 18); k.box('dark', u, .049, .024, .028, .018); k.box('dark', u, .037, .03, .007, .03); }
  k.anchor('sight', -.158, sv);
  k.part('mag', [.05, -.05]);
  k.ext('dark', [[.095, -.05], [.012, -.05], [.012, -.102], [.095, -.106]], .026, { r: .004 });
  k.ext('poly', [[.098, -.1], [.008, -.096], [.006, -.112], [.1, -.116]], .033, { r: .003 });
  k.part('bolt', [.0, .006]);
  k.cyl('steel', -.11, .06, 0, .0102, .0102, 0, 14);
  for (let i = 0; i < 3; i++) k.box('dark', -.04 + i * .025, .0104, .012, .0012, .0064);
  k.cyl('dark', -.125, -.11, 0, .0128, .0128, 0, 14);
  k.ext('steel', [[-.1, -.006], [-.088, -.006], [-.092, -.022], [-.102, -.022]], .007, { r: .001, x: .022 });
  k.box('steel', -.097, -.002, .009, .008, .03, .018);
  const ball = new THREE.SphereGeometry(.0095, 12, 10); ball.translate(.038, -.03, .097); k.add('poly', ball);
  const stem = new THREE.CylinderGeometry(.0034, .0034, .036, 8); stem.rotateZ(.82); stem.translate(.026, -.016, .097); k.add('steel', stem);
  k.anchor('muzzle', .935, .004); k.anchor('eject', .012, .018, .019);
  return { grip: [-.04, -.1, .3], support: [.29, -.05], mag: [.05, -.108], boltKnob: [-.097, -.03, .038] };
}

const BUILDERS = { p9: buildP9, ar: buildAR, smg: buildSMG, sg: buildSG, lmg: buildLMG, sr: buildSR };

/* per-weapon handling: hip offset, ADS eye distance, recoil impulses, action travel, effects */
const FEEL = {
  p9: { hip: [.14, -.135, -.43], eye: .44, kz: .36, kp: 1.25, ky: .22, kr: .42, travel: .036, cycle: .1, flash: .17, casing: .62, smoke: .55, weight: 1.15 },
  ar: { hip: [.15, -.15, -.43], eye: .21, kz: .30, kp: .50, ky: .16, kr: .2, travel: .05, cycle: .075, flash: .3, casing: .85, smoke: .7, weight: 1 },
  smg: { hip: [.15, -.145, -.41], eye: .2, kz: .22, kp: .36, ky: .17, kr: .17, travel: .042, cycle: .055, flash: .2, casing: .68, smoke: .45, weight: .9 },
  sg: { hip: [.15, -.15, -.41], eye: .74, kz: .95, kp: 1.9, ky: .3, kr: .55, travel: .105, cycle: .1, flash: .46, casing: 1.5, smoke: 1.5, weight: 1.15, manual: { dur: .52, delay: .08 } },
  lmg: { hip: [.16, -.155, -.42], eye: .27, kz: .34, kp: .46, ky: .2, kr: .22, travel: .06, cycle: .08, flash: .38, casing: 1, smoke: .95, weight: 1.45 },
  sr: { hip: [.15, -.15, -.4], eye: .12, kz: 1.05, kp: 1.75, ky: .24, kr: .4, travel: .105, cycle: .1, flash: .42, casing: 1.2, smoke: 1.3, weight: 1.35, manual: { dur: 1, delay: .16 } },
};
const RIG_SCALE = .82;

/* ---------- hand poses ---------- */
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _bm = new THREE.Matrix4();
function poseFrom(p, xa, ya, f) {
  _x.copy(xa).normalize(); _y.copy(ya).addScaledVector(_x, -ya.dot(_x)).normalize(); _z.crossVectors(_x, _y);
  _bm.makeBasis(_x, _y, _z);
  return { p: p.clone(), q: new THREE.Quaternion().setFromRotationMatrix(_bm), f: new Float32Array(f) };
}
function gripPose(u, v, t) {
  const c = Math.cos(t), s = Math.sin(t), X = new THREE.Vector3(0, c, -s), Y = new THREE.Vector3(-.05, -s, -c);
  const p = V(u, v, .027).addScaledVector(Y, -.068);
  return poseFrom(p, X, Y, [.42, 1.2, 1.25, 1.28, .92]);
}
function supportPose(u, v, spread = .62, curl = 1.02, drop = .021) {
  const ca = Math.cos(spread), sa = Math.sin(spread), Y = new THREE.Vector3(ca, .12, -sa), X = new THREE.Vector3(sa, 0, ca);
  const p = V(u, v - drop, 0).addScaledVector(Y, -.066);
  return poseFrom(p, X, Y, [curl, curl * 1.05, curl * 1.08, curl * 1.1, .55]);
}
function foreGripPose(u, v) {
  const X = new THREE.Vector3(0, 1, -.1), Y = new THREE.Vector3(.86, 0, -.5);
  const p = V(u, v, -.026).addScaledVector(Y, -.064);
  return poseFrom(p, X.negate(), Y, [1.18, 1.22, 1.25, 1.25, .9]);
}
function topPose(u, v, x = 0) {
  const Y = new THREE.Vector3(.35, -.08, -1), X = new THREE.Vector3(-1, 0, -.35);
  const p = new THREE.Vector3(x, v + .03, -u).addScaledVector(Y.clone().normalize(), -.078);
  return poseFrom(p, X, Y, [.82, .95, 1, 1, .7]);
}
function pouchPose(ref) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(.7, .35, -.5)).multiply(ref.q);
  return { p: new THREE.Vector3(-.31, -.44, .03), q, f: new Float32Array([.85, .9, .95, .95, .6]) };
}

/* ---------- reload / action scripts ----------
   lh / rh tracks: keyed poses, travelled with a minimum-jerk reach on a curved path (see samplePose).
   attach: [t0, t1] the magazine rides rigidly in the left hand. drop: [t0, t1] the old one is let go at t0 and falls,
   the hand is empty until it reaches the pouch at t1. Stage times in ev sit on the visible contact. */
const magSwap = (P, tReach, tOut, tP0, tP1, tIn, tTap) => [
  [tReach, P.mag], [tOut, P.mag], [tOut + .042, P.magLow], [tP0, P.pouch], [tP1, P.pouch],
  [tIn - .04, P.magLow], [tIn, P.mag], [tTap - .022, P.magTap], [tTap, P.mag],
];
function magReload(w, empty) {
  const P = w.poses, h = w.cfg.handle || .07;
  if (!empty) return {
    ev: [[.2, 'magOut'], [.41, 'pouch'], [.66, 'magIn'], [.73, 'magTap']], attach: [.2, .66], tilt: [.07, .12, .34],
    lh: [[0, P.rest], ...magSwap(P, .13, .2, .41, .44, .66, .73), [.92, P.rest], [1, P.rest]],
    run(a, t) { a.magSeat = seg(.62, .67, t) * (1 - seg(.67, .74, t)); },
  };
  return {
    ev: [[.13, 'magOut'], [.285, 'pouch'], [.49, 'magIn'], [.55, 'magTap'], [.71, 'boltBack'], [.8, 'boltForward']], attach: [.13, .49], drop: [.18, .285], tilt: [.08, .14, .38],
    lh: [[0, P.rest], ...magSwap(P, .08, .13, .285, .305, .49, .55), [.63, P.charge], [.8, P.charge], [.94, P.rest], [1, P.rest]],
    run(a, t) {
      a.magSeat = seg(.45, .495, t) * (1 - seg(.495, .55, t));
      const pull = seg(.66, .72, t) * (1 - seg(.8, .825, t));
      a.handle = pull; a.bolt = seg(0, .05, t) * (1 - seg(.8, .83, t)); a.lhZ = pull * h;
    },
  };
}
function pistolReload(w, empty) {
  const P = w.poses;
  if (!empty) return {
    ev: [[.2, 'magOut'], [.41, 'pouch'], [.68, 'magIn'], [.75, 'magTap']], attach: [.2, .68], tilt: [.16, .14, -.3],
    lh: [[0, P.rest], ...magSwap(P, .14, .2, .41, .44, .68, .75), [.92, P.rest], [1, P.rest]],
    run(a, t) { a.magSeat = seg(.64, .69, t) * (1 - seg(.69, .76, t)); },
  };
  return {
    ev: [[.14, 'magOut'], [.29, 'pouch'], [.5, 'magIn'], [.56, 'magTap'], [.72, 'slideBack'], [.81, 'slideForward']], attach: [.14, .5], drop: [.19, .29], tilt: [.17, .15, -.32],
    lh: [[0, P.rest], ...magSwap(P, .09, .14, .29, .31, .5, .56), [.65, P.charge], [.8, P.charge], [.94, P.rest], [1, P.rest]],
    run(a, t) {
      a.magSeat = seg(.46, .505, t) * (1 - seg(.505, .56, t));
      const rack = seg(.68, .73, t);
      a.slide = (.86 * seg(0, .05, t) + .14 * rack) * (1 - seg(.805, .83, t));
      a.lhZ = rack * (1 - seg(.8, .83, t)) * .022;
    },
  };
}
function shotgunReload(w, empty) {
  const P = w.poses, n = empty ? 4 : 2, start = .07, end = empty ? .72 : .9, step = (end - start) / n;
  const ev = [], lh = [[0, P.rest]], ports = new Float32Array(n), near = shiftPose(P.port, -.035, -.022);
  for (let i = 0; i < n; i++) {
    const a = start + step * i;
    lh.push([a + step * .2, P.pouch], [a + step * .3, P.pouch], [a + step * .65, near], [a + step * .76, P.port], [a + step * .85, P.port]);
    ports[i] = a + step * .76; ev.push([a + step * .2, 'pouch'], [ports[i], 'shell']);       // shell time unchanged: the engine credits one round on it
  }
  if (empty) {
    lh.push([.79, P.rest], [1, P.rest]); ev.push([.84, 'pump'], [.86, '$eject0']);
  } else lh.push([.97, P.rest], [1, P.rest]);
  return {
    ev, lh, attach: null, tilt: [.06, .1, .45],
    run(a, t) {
      a.heldShell = 0;
      for (let i = 0; i < n; i++) {
        const s = start + step * i, p = ports[i];
        if (t >= s + step * .26 && t < p) a.heldShell = 1;
        a.lhZ += -.02 * seg(p - step * .07, p, t) * (1 - seg(p, p + step * .14, t));       // the thumb pushes the shell home
      }
      if (empty) a.pump = seg(.8, .86, t) * (1 - seg(.88, .95, t));
    },
  };
}
function lmgReload(w) {
  const P = w.poses, h = w.cfg.handle, over = shiftPose(P.charge, 0, .07, -.075);
  return {
    ev: [[.09, 'boltBack'], [.31, 'magOut'], [.445, 'pouch'], [.6, 'magIn'], [.65, 'magTap'], [.91, 'boltForward']], attach: [.31, .6], tilt: [.06, .1, .3],
    lh: [[0, P.rest], [.034, over], [.06, P.charge], [.11, P.charge], [.17, P.coverHand], [.24, P.coverHand], ...magSwap(P, .28, .31, .445, .465, .6, .65), [.72, P.coverHand], [.84, P.coverHand], [.88, P.charge], [.925, P.charge], [.95, over], [.985, P.rest], [1, P.rest]],
    run(a, t) {
      const pull = seg(.07, .1, t) * (1 - seg(.13, .16, t)) + seg(.88, .905, t) * (1 - seg(.91, .94, t));
      a.handle = pull; a.lhZ = pull * h; a.bolt = Math.max(pull, seg(.08, .1, t) * (1 - seg(.905, .925, t)));
      a.cover = seg(.17, .25, t) * (1 - seg(.76, .85, t));
      a.beltAttach = t > .31 && t < .66 ? 1 : 0;
      a.magSeat = seg(.57, .605, t) * (1 - seg(.605, .66, t));
    },
  };
}
function sniperReload(w, empty) {
  const P = w.poses;
  const bolt = (a, t, b0, b1, f0, f1) => {
    const up = seg(b0, b0 + .05, t) * (1 - seg(f1 - .03, f1, t)), back = seg(b0 + .05, b1, t) * (1 - seg(f0, f1 - .03, t));
    a.boltRot = up; a.bolt = back; a.rhZ = back;
  };
  if (!empty) return {
    ev: [[.22, 'magOut'], [.42, 'pouch'], [.68, 'magIn'], [.75, 'magTap']], attach: [.22, .68], tilt: [.07, .12, .34],
    lh: [[0, P.rest], ...magSwap(P, .14, .22, .42, .45, .68, .75), [.92, P.rest], [1, P.rest]],
    run(a, t) { a.magSeat = seg(.64, .69, t) * (1 - seg(.69, .76, t)); },
  };
  return {
    ev: [[.12, 'boltBack'], [.27, 'magOut'], [.4, 'pouch'], [.58, 'magIn'], [.635, 'magTap'], [.79, 'boltForward']], attach: [.27, .58], drop: [.325, .4], tilt: [.07, .12, .32],
    lh: [[0, P.rest], ...magSwap(P, .19, .27, .4, .42, .58, .635), [.82, P.rest], [1, P.rest]],
    rh: [[0, P.grip], [.07, P.boltHand], [.84, P.boltHand], [.95, P.grip], [1, P.grip]],
    run(a, t) { bolt(a, t, .07, .15, .7, .85); a.magSeat = seg(.54, .585, t) * (1 - seg(.585, .65, t)); },
  };
}
function pumpCycle(w) {
  const P = w.poses;
  return { ev: [[.3, 'pump'], [.38, '$eject0']], lh: [[0, P.rest], [1, P.rest]], attach: null, tilt: [.03, .03, .08], run(a, t) { a.pump = seg(.08, .36, t) * (1 - seg(.5, .86, t)); } };
}
function boltCycle(w) {
  const P = w.poses;
  return {
    ev: [[.34, 'boltBack'], [.42, '$eject0'], [.68, 'boltForward']], lh: [[0, P.rest], [1, P.rest]], attach: null, tilt: [.03, .05, .14],
    rh: [[0, P.grip], [.14, P.boltHand], [.82, P.boltHand], [.97, P.grip], [1, P.grip]],
    run(a, t) {
      const up = seg(.15, .24, t) * (1 - seg(.72, .82, t)), back = seg(.24, .4, t) * (1 - seg(.54, .72, t));
      a.boltRot = up; a.bolt = back; a.rhZ = back;
    },
  };
}

/* ====================================================================
   ARSENAL — shared sub-assemblies, then the nineteen newer weapons.
   Every design is an original fictional archetype. A builder returns its
   handling config; optional keys: cup, fore, poses(defaults), post(w, mats),
   scripts(w), animate(w, anim, dt, script, t, time), onFire(w), spin, boltTurn.
   ==================================================================== */
const rel = (pts, u, v) => pts.map(p => [u + p[0], v + p[1]]);
const rot2 = (pts, cu, cv, a) => { const c = Math.cos(a), s = Math.sin(a); return pts.map(p => [cu + p[0] * c - p[1] * s, cv + p[0] * s + p[1] * c]); };

function recv(k, mat, u0, u1, v0, v1, w, ch = .01) {
  k.ext(mat, [[u0, v0], [u1 - ch, v0], [u1, v0 + ch * .8], [u1, v1 - ch * .5], [u1 - ch, v1], [u0 + ch * 2, v1], [u0, v1 - ch * .9]], w, { r: .004 });
}
function lower(k, mat, u0, u1, v, w, d = .028, mw0 = .058) {
  k.ext(mat, [[u0 + .006, v], [u1 - .004, v], [u1 - .01, v - d + .002], [mw0 + .008, v - d - .008], [mw0 - .008, v - d + .003], [-.03, v - d + .003], [-.056, v - d - .012], [-.1, v - d - .006], [u0 + .006, v - .018]], w, { r: .004 });
}
function hguard(k, mat, u0, u1, v0, v1, w, n = 0, lean = .004) {
  const h = v1 - v0;
  k.ext(mat, [[u0, v0], [u1 - .008, v0], [u1, v0 + .008], [u1, v1 - .007], [u1 - .008, v1], [u0, v1]], w, { r: .004, holes: n ? slots(u0 + .02, u1 - .014, v0 + h * .42, v1 - h * .2, n, lean) : undefined });
}
function pgrip(k, u, v, mat = 'poly', w = .032) {
  k.ext(mat, rel([[0, 0], [.044, 0], [.052, -.012], [.042, -.022], [.047, -.032], [.036, -.044], [.041, -.056], [.028, -.088], [.02, -.1], [-.024, -.096], [-.026, -.082], [-.01, -.03]], u, v), w, { r: .004 });
  for (let i = 0; i < 9; i++) k.box(mat === 'wood' ? 'dark' : 'rubber', u + .016 - i * .0028, v - .012 - i * .0088, .03, mat === 'wood' ? .0016 : .0032, w + .0005);
  return [u + .014, v - .048, .3];
}
function stockTele(k, u, v, mat = 'poly') {
  k.cyl('dark', u - .18, u, v, .0145, .0145);
  k.ext(mat, rel([[-.02, .019], [-.015, -.008], [-.065, -.032], [-.132, -.076], [-.198, -.088], [-.205, .03], [-.14, .034], [-.11, .006], [-.05, .006]], u, v), .036, { r: .006, holes: [rel([[-.08, -.014], [-.12, -.042], [-.162, -.056], [-.166, .004], [-.12, -.002]], u, v)], hr: .005 });
  k.ext('rubber', rel([[-.203, .032], [-.215, .036], [-.218, -.089], [-.2, -.09]], u, v), .04, { r: .004 });
}
function stockSolid(k, u, v, mat, len = .27, drop = .07, o = {}) {
  const w = o.w || .042;
  const holes = o.hole ? [rel([[-len * .3, -.012], [-len * .46, -drop * .55 - .012], [-len * .84, -drop * .8 - .012], [-len * .86, .006], [-len * .5, .004]], u, v)] : undefined;
  k.ext(mat, rel([[0, .012], [0, -.05], [-.06, -.062], [-len * .6, -drop - .014], [-len, -drop - .026], [-len - .006, .028], [-len * .68, .03], [-len * .3, .016]], u, v), w, { r: .007, holes, hr: .005 });
  k.ext('rubber', rel([[-len - .004, .03], [-len - .02, .033], [-len - .024, -drop - .03], [-len - .002, -drop - .03]], u, v), w + .004, { r: .004 });
  if (o.cheek) k.ext('poly', rel([[-len * .3, .028], [-len * .72, .026], [-len * .72, .044], [-len * .3, .048]], u, v), w * .72, { r: .004 });
}
function stockWire(k, u, v, len = .16) {
  const p = rel([[0, .008], [-len, .002], [-len - .006, -.068], [-len + .008, -.07], [-len + .012, -.013], [0, -.006]], u, v);
  k.ext('steel', p, .012, { x: .012, r: .004 }); k.ext('steel', p, .012, { x: -.012, r: .004 });
  k.ext('rubber', rel([[-len + .002, .006], [-len - .016, .008], [-len - .018, -.074], [-len, -.074]], u, v), .038, { r: .004 });
  k.pin('steel', u - .004, v + .001, .004, .042);
}
/* detachable box magazine as the 'mag' part; returns the hand reference point */
function boxMag(k, u, v, o = {}) {
  const len = o.len || .13, d = o.d || .055, w = o.w || .024, rake = o.rake || 0, curve = o.curve || 0, mat = o.mat || 'steel', n = curve ? 5 : 1, ribs = o.ribs ?? 3;
  const cu = t => u + rake * t + curve * t * t, F = [], B = [];
  for (let i = 0; i <= n; i++) { const t = i / n; F.push([cu(t) + d / 2, v + .01 - t * (len + .01)]); B.push([cu(t) - d / 2, v + .01 - t * (len + .01)]); }
  k.part('mag', [u, v]);
  k.ext(mat, [...F, ...B.reverse()], w, { r: .003 });
  for (let i = 1; i <= ribs; i++) { const t = i / (ribs + 1); k.box('dark', cu(t), v - t * len, d * .96, .0028, w + .0006); }
  k.box(o.base || 'dark', cu(1), v - len - .003, d + .008, .011, w + .005);
  k.box(o.shell ? 'red' : 'brass', cu(0) + d * .1, v + .0085, d * .6, .006, w * .42);
  return [cu(.8), v - len * .8];
}
/* ejection-port bolt on the right and a charging handle: o.side = [u, v] (left side) or o.rear = [u, v] */
function action(k, u, v, w, o = {}) {
  k.part('body'); k.box('rubber', u, v, .058, .022, .002, w / 2 + .0003);
  k.part('bolt'); k.box('steel', u, v, .05, .017, .004, w / 2 - .0003); k.box('dark', u + .014, v, .012, .012, .0044, w / 2 - .0001);
  k.part('handle');
  if (o.side) { k.box('steel', o.side[0], o.side[1], .014, .008, .03, -w / 2 - .012); k.box('dark', o.side[0], o.side[1], .008, .013, .007, -w / 2 - .028); }
  else if (o.rear) { k.box('dark', o.rear[0] + .012, o.rear[1] - .002, .032, .008, .022); k.box('steel', o.rear[0] - .005, o.rear[1] - .002, .008, .009, .044); }
  k.part('body');
}
function muz(k, u, v, r, len, kind = 'brake') {
  if (kind === 'hider') {
    k.tube('dark', u, u + len, v, r, r * .62, 0, 12);
    for (let i = 0; i < 3; i++) k.cyl('rubber', u + len * (.3 + i * .22), u + len * (.38 + i * .22), v, r * 1.03, r * 1.03, 0, 12);
  } else if (kind === 'comp') {
    k.ext('dark', [[u, v - r], [u + len - .004, v - r], [u + len, v - r * .6], [u + len, v + r], [u, v + r]], r * 2.1, { r: .002 });
    for (let i = 0; i < 2; i++) k.box('rubber', u + len * (.34 + i * .32), v + r * .78, len * .16, r * .5, r * 1.3);
  } else {
    k.cyl('dark', u, u + len, v, r, r * .96, 0, 12); k.cyl('steel', u + len, u + len + .004, v, r * .96, r * .72, 0, 12);
    for (let i = 0; i < 3; i++) { const a = u + len * (.2 + i * .26); k.box('rubber', a, v, len * .1, r * 2.04, r * 1.02); k.box('rubber', a, v + r * .62, len * .1, r * .5, r * 2.04); }
  }
}
/* rear sight (ghost ring or open notch) and a protected front post; the sight line sits at height v */
function irons(k, ur, uf, v, rear = 'ring') {
  k.sightBegin(ur, v - .018);
  if (rear === 'ring') { k.box('dark', ur, v - .013, .016, .01, .02); k.tube('dark', ur - .004, ur + .004, v, .0098, .0064, 0, 16); }
  else { k.box('dark', ur, v - .0075, .014, .005, .02); for (const x of [-.0062, .0062]) k.box('dark', ur, v - .001, .01, .009, .0052, x); }
  k.box('dark', uf, v - .015, .016, .014, .012); k.box('dark', uf, v - .0045, .004, .012, .0026);
  for (const x of [-.0088, .0088]) k.ext('dark', [[uf - .007, v - .009], [uf + .007, v - .009], [uf + .004, v + .009], [uf - .004, v + .009]], .0022, { x, r: .001, b: .0003 });
  k.anchor('sight', uf, v);
  k.sightEnd();
}
/* boxy open sight with a ring reticle */
function holo(k, u, v) {
  k.sightBegin(u, v);
  k.box('dark', u, v + .006, .062, .012, .032); k.pin('steel', u - .018, v + .004, .0026, .04); k.pin('steel', u + .018, v + .004, .0026, .04);
  for (const x of [-.0165, .0165]) k.ext('dark', [[u + .004, v + .012], [u + .032, v + .012], [u + .032, v + .05], [u + .012, v + .05]], .003, { x, r: .003, b: .0006 });
  k.box('dark', u + .022, v + .0515, .022, .0032, .036);
  k.box('dark', u - .014, v + .017, .03, .011, .028);
  k.box('glass', u + .02, v + .031, .0008, .037, .03);
  k.tube('dot', u + .0188, u + .0192, v + .031, .0044, .0037, 0, 20); k.disc('dot', u + .0186, v + .031, .0007);
  k.anchor('sight', u + .0186, v + .031);
  k.sightEnd();
}
/* compact hollow prism optic: the shooter looks straight through the tube */
function prism(k, u, v, L = .05, ro = .029) {
  k.sightBegin(u, v);
  const ri = ro - .0034, c = v + ro + .013;
  k.box('dark', u, v + .005, L * .8, .01, .03); k.pin('steel', u - L * .25, v + .004, .0028, .038); k.pin('steel', u + L * .25, v + .004, .0028, .038);
  k.box('dark', u, v + .0135, L * .5, .011, .016);
  k.tube('dark', u - L / 2, u + L / 2, c, ro, ri, 0, 26);
  k.tube('rubber', u - L / 2 - .011, u - L / 2, c, ro + .0022, ri, 0, 26);
  k.tube('dark', u + L / 2, u + L / 2 + .012, c, ro + .003, ri + .0008, 0, 26);
  k.box('dark', u + .004, c + ro + .003, .02, .01, .02); k.box('dark', u + .004, c, .02, .02, .01, ro + .004);
  k.box('rubber', u, c - ri * .56, .0005, ri * .88, .0007); k.box('rubber', u, c, .0005, .0007, ri * .7, -ri * .62); k.box('rubber', u, c, .0005, .0007, ri * .7, ri * .62);
  k.disc('dot', u - .0004, c, .00095);
  k.disc('glass', u + L / 2, c, ri);
  k.anchor('sight', u, c);
  k.sightEnd();
}
/* long telescopic sight; the anchor is the ocular (the scope overlay replaces the model when aimed) */
function scopeLong(k, u, v, s = 1) {
  const r = .0152 * s;
  k.cyl('dark', u - .09 * s, u + .22 * s, v, r, r, 0, 20);
  k.cyl('dark', u + .22 * s, u + .30 * s, v, r, .0268 * s, 0, 20); k.cyl('dark', u + .30 * s, u + .36 * s, v, .0268 * s, .0268 * s, 0, 20);
  k.cyl('dark', u - .15 * s, u - .09 * s, v, .0208 * s, .0165 * s, 0, 20); k.cyl('rubber', u - .158 * s, u - .15 * s, v, .0212 * s, .0212 * s, 0, 20);
  k.disc('glass', u + .36 * s, v, .0255 * s);
  k.box('dark', u + .06 * s, v + .022 * s, .024, .016, .024); k.cyl('steel', u + .05 * s, u + .07 * s, v + .032 * s, .0122, .0122, 0, 14);
  k.box('dark', u + .06 * s, v, .024, .024, .05 * s); k.cyl('steel', u + .05 * s, u + .07 * s, v, .0118, .0118, .03 * s, 14);
  for (const a of [-.04 * s, .13 * s]) { k.tube('steel', u + a - .012, u + a + .012, v, r + .0033, r, 0, 18); k.box('dark', u + a, v - r - .012, .024, .026, .018); k.box('dark', u + a, v - r - .024, .03, .007, .03); }
  k.anchor('sight', u - .158 * s, v);
}
function bipod(k, u0, u1, v, x = .017) {
  for (const s of [-x, x]) { k.cyl('steel', u0, u1, v, .0048, .0042, s, 8); k.box('rubber', u0, v, .022, .012, .012, s); }
  k.box('dark', u1 + .002, v + .008, .024, .02, x * 2 + .014);
}
/* hand-held ammunition item ('held' part, built in left-hand space: Y runs along the fingers) */
function heldRounds(k, n, R, r, len, tipMat = 'steel') {
  k.part('held');
  const cy = .078, cz = .022 + R + r;
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n, x = n > 1 ? Math.cos(a) * R : 0, z = cz + (n > 1 ? Math.sin(a) * R : 0);
    const g = new THREE.CylinderGeometry(r, r, len, 10); g.translate(x, cy, z); k.add('brass', g);
    const tip = new THREE.CylinderGeometry(r * .32, r * .94, len * .5, 10); tip.translate(x, cy + len * .75, z); k.add(tipMat, tip);
  }
  if (n > 1) { const kb = new THREE.CylinderGeometry(R * .95, R * .95, .014, 12); kb.translate(0, cy - len * .5 - .007, cz); k.add('dark', kb); }
  k.part('body');
}

/* ---------- extra hand poses ---------- */
function cupPose(u, v) {
  const Y = new THREE.Vector3(.12, -.34, -.93).normalize(), Z = new THREE.Vector3(.96, 0, -.28).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
  return poseFrom(V(u, v, -.04).addScaledVector(Y, -.052), X, Y, [1.05, 1.1, 1.12, 1.1, .12]);
}
/* left hand beside a point: palm facing right, fingers forward, thumb up */
function sidePose(u, v, x, f = [.5, .55, .6, .6, .3]) {
  const Y = new THREE.Vector3(.12, .08, -1).normalize(), Z = new THREE.Vector3(1, .1, .12).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
  return poseFrom(V(u, v, x).addScaledVector(Z, -.022).addScaledVector(Y, -.078), X, Y, f);
}
function awayPose(ref) { return { p: new THREE.Vector3(-.36, -.62, .12), q: ref.q.clone(), f: new Float32Array([.7, .8, .85, .85, .5]) }; }
function shiftPose(ref, du, dv = 0, dx = 0) { return { p: ref.p.clone().add(V(du, dv, dx)), q: ref.q.clone(), f: new Float32Array(ref.f) }; }
const swing2 = (c, p, th) => [p[0] + (c[0] - p[0]) * Math.cos(th) - (c[1] - p[1]) * Math.sin(th), p[1] + (c[0] - p[0]) * Math.sin(th) + (c[1] - p[1]) * Math.cos(th)];   // [x, v] about a bore-parallel axis
function nest(w, child, parent) {
  const c = w.parts[child], p = w.parts[parent];
  c.position.sub(p.userData.pivot); p.add(c); c.userData.base = c.position.clone();
}

/* ---------- 7. Colosse H-50: slab-sided heavy pistol, bright slide over a dark frame ---------- */
function buildHP(k) {
  k.ext('dark', [[-.082, -.014], [.118, -.014], [.118, -.03], [.07, -.036], [0, -.038], [-.082, -.032]], .031);
  k.ext('poly', [[-.088, -.026], [-.006, -.034], [-.012, -.052], [-.02, -.078], [-.03, -.11], [-.04, -.146], [-.1, -.142], [-.104, -.09], [-.094, -.05]], .033, { r: .005 });
  for (const x of [-.0172, .0172]) k.ext('rubber', [[-.08, -.052], [-.03, -.056], [-.05, -.134], [-.094, -.13]], .002, { x, r: .006, b: .0004 });
  triggerGroup(k, .026, -.034, 'dark');
  k.box('dark', .09, -.033, .04, .004, .02);
  k.pin('steel', .04, -.022, .0032, .033); k.pin('steel', -.05, -.022, .003, .033);
  k.ext('steel', [[-.097, .012], [-.084, .014], [-.084, -.008], [-.092, -.01]], .008, { r: .002 });
  k.part('slide');
  k.ext('nickel', [[-.086, -.014], [.132, -.014], [.14, -.006], [.14, .014], [.124, .036], [-.066, .038], [-.086, .028]], .03, { r: .003 });
  k.box('dark', .03, .0395, .17, .004, .012);
  for (let i = 0; i < 6; i++) k.box('rubber', -.03 + i * .026, .0405, .013, .0035, .0124);
  k.box('rubber', .012, .02, .05, .02, .004, .0135);
  for (let i = 0; i < 9; i++) k.box('dark', -.077 + i * .006, .008, .0025, .034, .0303);
  k.cyl('dark', .13, .146, .006, .0098, .0098, 0, 14); k.cyl('rubber', .1452, .1466, .006, .0062, .0062, 0, 12);
  k.box('dark', .121, .045, .012, .01, .0045); k.box('dot', .1147, .0485, .0012, .0024, .0024);
  for (const x of [-.007, .007]) k.box('dark', -.064, .0445, .012, .009, .007, x);
  k.box('dark', -.064, .0395, .013, .003, .024);
  k.anchor('sight', .1147, .0485);
  k.part('mag');
  k.ext('steel', [[-.014, -.036], [-.068, -.036], [-.094, -.144], [-.042, -.148]], .02, { r: .002 });
  k.ext('dark', [[-.038, -.144], [-.1, -.14], [-.104, -.154], [-.04, -.158]], .031, { r: .003 });
  k.part('body'); k.anchor('muzzle', .148, .006); k.anchor('eject', .012, .028, .013);
  return { grip: [-.058, -.088, .26], cup: [-.06, -.072], mag: [-.068, -.132], rack: [-.062, .024], scripts: w => ({ tac: pistolReload(w, false), empty: pistolReload(w, true) }) };
}

/* ---------- 8. Verdict .44: six-shot revolver, swing-out cylinder, wood grip ---------- */
function buildREV(k) {
  const cv = .0015, bv = .013, pv = [.03, -.022, -.012];
  k.ext('paint', [[-.07, .012], [-.05, .03], [.066, .03], [.066, -.024], [.03, -.024], [.02, -.034], [-.03, -.03], [-.06, -.012]], .018, { r: .004, holes: [[[-.002, -.0195], [-.002, .0225], [.06, .0225], [.06, -.0195]]], hr: .002 });
  k.ext('paint', [[.064, -.012], [.21, -.012], [.214, -.004], [.214, .026], [.064, .026]], .021, { r: .004 });
  k.cyl('steel', .212, .2168, bv, .0085, .0085, 0, 14); k.cyl('rubber', .2164, .2174, bv, .0056, .0056, 0, 12);
  k.box('dark', .132, .0285, .15, .005, .009); for (let i = 0; i < 5; i++) k.box('rubber', .078 + i * .027, .0283, .014, .0052, .0094);
  k.ext('dark', [[.176, .03], [.208, .03], [.204, .044], [.196, .044]], .004, { r: .001, b: .0004 });
  k.box('dot', .1955, .0425, .0012, .003, .0026);
  for (const x of [-.006, .006]) k.box('dark', -.042, .0375, .014, .012, .005, x);
  k.box('dark', -.042, .0325, .016, .004, .018);
  k.anchor('sight', .1955, .0425);
  triggerGroup(k, .01, -.03, 'paint');
  k.ext('wood', [[-.064, .01], [-.03, -.018], [-.018, -.034], [-.028, -.062], [-.036, -.094], [-.044, -.122], [-.098, -.118], [-.1, -.08], [-.09, -.03]], .03, { r: .008 });
  k.pin('brass', -.062, -.07, .005, .0308);
  k.part('hammer', [-.066, .008]);
  k.ext('steel', [[-.064, .004], [-.056, .03], [-.064, .037], [-.084, .035], [-.074, .026], [-.076, .006]], .008, { r: .002 });
  k.part('crane', pv);
  k.box('paint', .062, -.016, .01, .014, .012, -.005); k.cyl('steel', .0, .064, pv[1], .003, .003, pv[2], 8);
  k.part('drum', [.029, cv]);
  k.cyl('steel', .0, .058, cv, .0195, .0195, 0, 24);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, b = a + Math.PI / 6;
    k.cyl('dark', .026, .0584, cv + Math.cos(b) * .0192, .0052, .0052, Math.sin(b) * .0192, 8);
    k.disc('brass', -.0003, cv + Math.cos(a) * .0115, .0052, Math.sin(a) * .0115); k.disc('rubber', -.0006, cv + Math.cos(a) * .0115, .0016, Math.sin(a) * .0115);
  }
  k.part('ejector', [.029, cv]);
  k.cyl('steel', .058, .104, cv, .0028, .0028, 0, 8); k.cyl('steel', .1, .107, cv, .0044, .0044, 0, 8); k.cyl('steel', -.0014, .0002, cv, .006, .006, 0, 6);
  heldRounds(k, 6, .0115, .0048, .03);
  k.anchor('muzzle', .219, bv); k.anchor('eject', .0, cv, -.03);
  const oc = swing2([0, cv], [pv[2], pv[1]], 1.4);       // cylinder centre when swung out
  k.anchor('drop', -.02, oc[1], oc[0]);
  return {
    grip: [-.066, -.07, .3], cup: [-.068, -.054], mag: [-.07, -.1],
    poses: P => ({ crane: sidePose(.03, cv - .006, -.036), rod: sidePose(.12, oc[1] + .004, oc[0] - .016, [.2, .25, .3, .3, .2]), load: sidePose(-.05, oc[1] + .004, oc[0] - .034, [.75, .8, .85, .85, .5]) }),
    post(w) { nest(w, 'drum', 'crane'); nest(w, 'ejector', 'crane'); },
    scripts: w => { const s = revolverReload(w); return { tac: s, empty: s }; },
    onFire(w) { w.st.rotT += Math.PI / 3; w.st.cock = 1; },
    animate(w, a, dt) {
      const P = w.parts, st = w.st;
      st.rot += (st.rotT - st.rot) * Math.min(1, dt * 26); st.cock = Math.max(0, st.cock - dt * 9);
      P.crane.rotation.z = a.cyl * 1.4; P.drum.rotation.z = st.rot + a.cyl * .6;
      P.ejector.position.z = P.ejector.userData.base.z + a.rod * .024;
      P.hammer.rotation.x = Math.sin(st.cock * Math.PI) * .7;
    },
  };
}
function revolverReload(w) {
  const P = w.poses;
  return {
    ev: [[.11, 'cylOpen'], [.26, 'cylEject'], [.265, '$drop'], [.275, '$drop'], [.285, '$drop'], [.295, '$drop'], [.305, '$drop'], [.315, '$drop'], [.46, 'pouch'], [.66, 'cylLoad'], [.85, 'cylClose']],
    attach: null, tilt: [0, .12, .5],
    lh: [[0, P.rest], [.07, P.crane], [.13, P.crane], [.21, P.rod], [.33, P.rod], [.42, P.pouch], [.5, P.pouch], [.63, P.load], [.71, P.load], [.79, P.crane], [.87, P.crane], [.96, P.rest], [1, P.rest]],
    run(a, t) {
      a.cyl = seg(.09, .16, t) * (1 - seg(.82, .88, t));
      a.rod = seg(.23, .265, t) * (1 - seg(.29, .34, t)); a.lhZ = a.rod * .024 + seg(.63, .665, t) * (1 - seg(.67, .72, t)) * -.02;
      a.rigRX = .5 * seg(.14, .22, t) * (1 - seg(.33, .43, t)) - .26 * seg(.46, .58, t) * (1 - seg(.74, .84, t));
      a.held = t > .49 && t < .665 ? 1 : 0;
    },
  };
}

/* ---------- 9. Guêpe MP-3: machine pistol with ported barrel and a long stick magazine ---------- */
function buildMP(k) {
  k.ext('poly', [[-.071, -.012], [.108, -.012], [.108, -.03], [.06, -.03], [.036, -.029], [-.004, -.031], [-.03, -.03], [-.071, -.027]], .0285);
  k.ext('poly', [[-.075, -.023], [-.006, -.028], [-.009, -.044], [-.018, -.052], [-.011, -.061], [-.021, -.07], [-.015, -.08], [-.026, -.09], [-.022, -.102], [-.032, -.124], [-.083, -.122], [-.089, -.083], [-.082, -.046]], .0305, { r: .004 });
  for (let i = 0; i < 7; i++) { const a = -.09 + i * .0095; k.box('rubber', -.047 + i * .0007 + a * .08, a, .056, .0034, .0313); }
  triggerGroup(k, .021, -.027);
  k.ext('poly', [[.06, -.03], [.106, -.03], [.102, -.05], [.07, -.055]], .024, { r: .004 });
  k.pin('steel', .034, -.019, .003, .03); k.pin('steel', -.046, -.018, .0028, .03);
  k.box('red', -.03, -.008, .008, .004, .0295);
  k.cyl('steel', .1, .15, .002, .0066, .0066, 0, 12);
  k.ext('dark', [[.134, -.012], [.176, -.012], [.18, -.006], [.18, .018], [.176, .022], [.134, .022]], .024, { r: .003 });
  for (let i = 0; i < 3; i++) k.box('rubber', .146 + i * .011, .0215, .005, .004, .014);
  k.cyl('rubber', .1795, .1806, .002, .0048, .0048, 0, 10);
  k.part('slide');
  k.ext('dark', [[-.076, -.012], [.106, -.012], [.112, -.006], [.112, .014], [.102, .0235], [-.058, .0255], [-.076, .018]], .0272, { r: .003 });
  k.box('rubber', .018, .0135, .044, .018, .004, .0122);
  for (let i = 0; i < 8; i++) k.box('steel', -.067 + i * .0058, .004, .0024, .029, .0276);
  k.box('rubber', .068, .0245, .05, .003, .012);
  k.box('dark', .095, .0285, .009, .007, .004); k.box('dot', .0912, .0325, .0012, .0022, .0022);
  for (const x of [-.0065, .0065]) k.box('dark', -.058, .029, .011, .0075, .0065, x);
  k.box('dark', -.058, .0245, .012, .003, .022);
  k.anchor('sight', .0912, .0325);
  k.part('mag');
  k.ext('steel', [[-.012, -.03], [-.06, -.03], [-.094, -.19], [-.048, -.194]], .019, { r: .002 });
  for (let i = 0; i < 4; i++) k.box('dark', -.064 - i * .0045, -.132 - i * .014, .044, .0028, .0196);
  k.ext('poly', [[-.044, -.19], [-.1, -.186], [-.103, -.199], [-.045, -.203]], .029, { r: .003 });
  k.part('body'); k.anchor('muzzle', .183, .002); k.anchor('eject', .018, .018, .012);
  return { grip: [-.05, -.075, .24], cup: [-.052, -.06], mag: [-.076, -.172], rack: [-.055, .014], scripts: w => ({ tac: pistolReload(w, false), empty: pistolReload(w, true) }) };
}

/* ---------- 10. Lame K-1: fighting knife ---------- */
function buildKNIFE(k) {
  const C = [-.03, -.072], T = .5, L = pts => rot2(pts, C[0], C[1], Math.PI / 2 - T);
  k.ext('poly', L([[-.058, -.0125], [.05, -.014], [.056, 0], [.05, .014], [-.058, .0125], [-.066, 0]]), .024, { r: .005 });
  for (let i = 0; i < 6; i++) { const a = -.04 + i * .015; k.ext('rubber', L([[a, -.0145], [a + .006, -.0145], [a + .006, .0145], [a, .0145]]), .0246, { r: .001, b: 0 }); }
  k.ext('steel', L([[-.066, -.011], [-.08, -.008], [-.08, .008], [-.066, .011]]), .02, { r: .003 });
  k.ext('steel', L([[.05, -.027], [.06, -.027], [.06, .021], [.05, .021]]), .03, { r: .003 });
  k.ext('blade', L([[.06, -.017], [.19, -.015], [.238, .007], [.2, .014], [.06, .014]]), .0042, { r: .0012, b: .0016 });
  k.ext('dark', L([[.072, .002], [.178, .003], [.178, .008], [.072, .008]]), .0046, { r: .001, b: 0 });
  for (let i = 0; i < 5; i++) { const a = .068 + i * .009; k.ext('dark', L([[a, .0125], [a + .004, .0125], [a + .004, .0145], [a, .0145]]), .0046, { r: .0004, b: 0 }); }
  const tip = L([[.238, .007]])[0];
  k.anchor('muzzle', tip[0], tip[1]); k.anchor('sight', tip[0], tip[1]); k.anchor('eject', C[0], C[1]);
  return {
    grip: [C[0], C[1], T], oneHand: true,
    poses: P => ({ rest: awayPose(P.rest) }),
    scripts: w => ({ act: [knifeSlash(w, 1), knifeStab(w)] }),
  };
}
function knifeSlash(w, dir) {
  const P = w.poses;
  return {
    ev: [[.14, 'swing']], attach: null, tilt: [0, 0, 0], lh: [[0, P.rest], [1, P.rest]],
    run(a, t) {
      const wind = seg(0, .16, t) * (1 - seg(.16, .3, t)), k = seg(.16, .4, t) * (1 - seg(.56, 1, t));
      a.rigX = dir * (wind * .08 - k * .36); a.rigY = wind * .05 - k * .04; a.rigZ = wind * .03 - k * .1;
      a.rigRY = dir * (-wind * .3 + k * .55); a.rigRZ = dir * (-wind * .25 + k * .85); a.rigRX = -k * .5;
    },
  };
}
function knifeStab(w) {
  const P = w.poses;
  return {
    ev: [[.16, 'stab']], attach: null, tilt: [0, 0, 0], lh: [[0, P.rest], [1, P.rest]],
    run(a, t) {
      const wind = seg(0, .16, t) * (1 - seg(.16, .28, t)), k = seg(.16, .32, t) * (1 - seg(.5, 1, t));
      a.rigX = -k * .12; a.rigY = wind * .02 + k * .06; a.rigZ = wind * .09 - k * .3;
      a.rigRX = wind * .2 - k * 1.0; a.rigRZ = -k * .3; a.rigRY = k * .18;
    },
  };
}

/* ---------- 11. Lynx MK-4: generic modern carbine, slim free-float guard, open ring sight ---------- */
function buildCAR(k) {
  recv(k, 'paint', -.13, .118, -.012, .03, .04);
  lower(k, 'dark', -.13, .118, -.012, .035);
  k.ext('dark', [[.114, -.012], [.114, -.04], [.07, -.048], [.058, -.036], [.058, -.012]], .0385, { r: .002, b: .0005 });
  hguard(k, 'dark', .112, .372, -.019, .028, .039, 7);
  k.rail(-.126, .368, .034);
  k.cyl('steel', .1, .43, .004, .0085, .0076);
  k.cyl('dark', .336, .362, .004, .0125, .0125, 0, 10); k.cyl('steel', .12, .35, .0185, .0032, .0032, 0, 6);
  muz(k, .425, .004, .0118, .05, 'hider');
  k.ext('poly', [[.196, -.019], [.25, -.019], [.244, -.036], [.222, -.04], [.203, -.03]], .028, { r: .004 });
  const grip = pgrip(k, -.056, -.04);
  triggerGroup(k, .015, -.04);
  k.pin('steel', -.094, -.024, .0034, .036); k.pin('steel', .097, -.03, .0034, .036);
  k.box('steel', -.04, -.024, .022, .007, .0365);
  stockTele(k, -.128, .006);
  k.box('dark', .336, .0415, .03, .008, .018);
  holo(k, .02, .0375);
  action(k, .006, .012, .04, { rear: [-.14, .03] });
  const mag = boxMag(k, .086, -.04, { len: .15, d: .056, w: .023, curve: .03, mat: 'steel', ribs: 4 });
  k.part('body'); k.anchor('muzzle', .478, .004); k.anchor('eject', .006, .014, .02);
  return { grip, support: [.255, -.024], mag, charge: [-.14, .03], handle: .074 };
}

/* ---------- 12. Kodiak R-47: stamped steel and wood, curved magazine, hooded post ---------- */
function buildAKR(k) {
  k.ext('steel', [[-.14, -.032], [.112, -.032], [.12, -.024], [.12, .016], [-.12, .016], [-.14, .006]], .038, { r: .004 });
  k.ext('dark', [[-.122, .016], [.07, .016], [.088, .026], [.07, .036], [-.1, .037], [-.122, .028]], .036, { r: .006 });
  for (let i = 0; i < 4; i++) k.box('rubber', -.08 + i * .036, .0372, .006, .002, .03);
  k.pin('steel', -.1, -.012, .003, .04); k.pin('steel', .02, -.02, .003, .04); k.pin('steel', .09, -.016, .003, .04);
  k.ext('wood', [[.12, -.034], [.3, -.028], [.31, -.018], [.31, .004], [.12, .004]], .046, { r: .007 });
  k.ext('wood', [[.142, .012], [.29, .012], [.29, .034], [.142, .036]], .032, { r: .009 });
  k.cyl('steel', .1, .5, 0, .0086, .008, 0, 14);
  k.cyl('steel', .29, .37, .026, .0072, .0072, 0, 10);
  k.ext('dark', [[.356, -.012], [.386, -.012], [.386, .036], [.37, .036], [.356, .02]], .022, { r: .003 });
  k.cyl('steel', .31, .47, -.016, .0026, .0026, 0, 6);
  k.cyl('dark', .498, .536, 0, .011, .011, 0, 12); k.ext('dark', [[.53, -.011], [.548, -.011], [.538, .011], [.53, .011]], .02, { r: .002 });
  k.box('dark', .448, .016, .02, .032, .014);
  k.box('dark', .104, .0235, .034, .013, .026);
  irons(k, .112, .448, .0445, 'notch');
  const grip = pgrip(k, -.058, -.032, 'wood', .03);
  triggerGroup(k, .012, -.032, 'dark');
  k.ext('wood', [[-.14, .012], [-.14, -.03], [-.2, -.044], [-.3, -.078], [-.4, -.092], [-.404, .0], [-.33, .008], [-.2, .014]], .04, { r: .008 });
  k.ext('steel', [[-.402, .002], [-.412, .004], [-.414, -.096], [-.4, -.096]], .042, { r: .003 });
  action(k, .0, .0, .038, { side: [.07, .004] });
  const mag = boxMag(k, .07, -.042, { len: .17, d: .062, w: .025, curve: .085, mat: 'steel', ribs: 5 });
  k.part('body'); k.anchor('muzzle', .55, 0); k.anchor('eject', .0, .004, .02);
  return { grip, support: [.22, -.03], mag, charge: [.07, .006], handle: .07, sideCharge: true };
}

/* ---------- 13. Trident B3: bullpup burst rifle, magazine behind the grip, bridge optic ---------- */
function buildBRST(k) {
  k.ext('paint', [[-.33, -.076], [-.33, .028], [-.3, .04], [.1, .04], [.21, .024], [.228, .006], [.228, -.022], [.07, -.03], [.046, -.042], [-.03, -.042], [-.062, -.05], [-.2, -.05], [-.225, -.078]], .046, { r: .007, holes: [[[.118, -.016], [.118, .004], [.2, .004], [.2, -.012]]], hr: .004 });
  k.ext('rubber', [[-.328, .03], [-.344, .034], [-.348, -.08], [-.327, -.08]], .05, { r: .004 });
  for (let i = 0; i < 6; i++) k.box('rubber', -.3 + i * .014, -.012, .006, .05, .0468);
  k.ext('dark', [[-.21, -.05], [-.104, -.05], [-.104, -.064], [-.21, -.068]], .04, { r: .003 });
  k.cyl('steel', .2, .33, .004, .0086, .0078); muz(k, .325, .004, .012, .046, 'hider');
  k.ext('poly', [[.07, -.03], [.2, -.022], [.2, -.046], [.09, -.054]], .04, { r: .008 });
  k.rail(-.12, .12, .044);
  const grip = pgrip(k, -.058, -.042); triggerGroup(k, .014, -.042, 'paint');
  k.pin('steel', -.26, .0, .0036, .048); k.pin('steel', -.09, -.03, .0034, .048); k.pin('steel', .16, .012, .0034, .048);
  prism(k, .0, .0475);
  action(k, -.15, .012, .046, { side: [.12, .02] });
  const mag = boxMag(k, -.156, -.058, { len: .14, d: .058, w: .024, rake: -.02, curve: .012, mat: 'poly', base: 'rubber', ribs: 4 });
  k.part('body'); k.anchor('muzzle', .374, .004); k.anchor('eject', -.15, .014, .024);
  return { grip, support: [.15, -.036], mag, charge: [.12, .022], handle: .06, sideCharge: true };
}

/* ---------- 14. Sentence BR-8: full-power battle rifle, ribbed guard, straight magazine ---------- */
function buildBAT(k) {
  recv(k, 'paint', -.14, .14, -.014, .032, .044);
  lower(k, 'dark', -.14, .14, -.014, .04, .03, .05);
  k.ext('poly', [[.14, -.03], [.4, -.024], [.41, -.016], [.41, .022], [.4, .028], [.14, .03]], .05, { r: .008 });
  for (let i = 0; i < 9; i++) k.box('rubber', .165 + i * .026, .0, .009, .05, .0508);
  k.rail(-.13, .14, .036);
  k.cyl('steel', .12, .58, .004, .0108, .0092, 0, 16);
  k.cyl('dark', .41, .45, .004, .015, .015, 0, 12); k.box('dark', .43, .022, .02, .02, .014);
  k.cyl('steel', .15, .42, .021, .004, .004, 0, 6);
  muz(k, .575, .004, .0128, .07, 'hider');
  const grip = pgrip(k, -.056, -.044); triggerGroup(k, .014, -.044);
  k.pin('steel', -.1, -.026, .0036, .041); k.pin('steel', .11, -.03, .0036, .041);
  k.box('steel', -.04, -.026, .022, .007, .0415);
  stockSolid(k, -.14, .004, 'paint', .28, .06, { hole: true, w: .04 });
  prism(k, -.01, .0395);
  action(k, .01, .012, .044, { side: [.1, .02] });
  const mag = boxMag(k, .09, -.044, { len: .12, d: .068, w: .028, rake: -.008, mat: 'steel', ribs: 2 });
  k.part('body'); k.anchor('muzzle', .65, .004); k.anchor('eject', .01, .014, .022);
  return { grip, support: [.29, -.03], mag, charge: [.1, .022], handle: .07, sideCharge: true };
}

/* ---------- 15. Frelon M-9: compact SMG with the magazine inside the grip ---------- */
function buildPDW(k) {
  recv(k, 'paint', -.1, .17, -.02, .034, .04);
  k.ext('poly', [[-.062, -.02], [-.004, -.02], [.002, -.126], [-.052, -.132]], .034, { r: .005 });
  for (let i = 0; i < 9; i++) k.box('rubber', -.028 - i * .0006, -.036 - i * .0098, .054, .0034, .0346);
  triggerGroup(k, .03, -.02);
  k.ext('poly', [[.066, -.02], [.168, -.02], [.16, -.046], [.132, -.056], [.08, -.05]], .034, { r: .006 });
  for (let i = 0; i < 4; i++) k.box('rubber', .092 + i * .018, -.036, .007, .024, .0346);
  k.cyl('steel', .15, .262, .008, .0072, .0072);
  k.tube('dark', .17, .245, .008, .0155, .0108, 0, 16);
  for (let i = 0; i < 4; i++) k.cyl('rubber', .182 + i * .015, .188 + i * .015, .008, .0158, .0158, 0, 14);
  k.rail(-.09, .165, .04);
  k.pin('steel', -.08, -.004, .0034, .042); k.pin('steel', .13, -.006, .0034, .042);
  stockWire(k, -.1, .018, .17);
  reflex(k, .03, .0435);
  action(k, .05, .012, .04, {});
  k.part('handle'); k.box('steel', .1, .026, .016, .01, .012, -.024); k.box('dark', .1, .026, .01, .016, .01, -.034);
  k.part('mag', [-.03, -.02]);
  k.ext('steel', [[-.008, -.014], [-.05, -.014], [-.046, -.215], [-.004, -.212]], .02, { r: .003 });
  for (let i = 0; i < 4; i++) k.box('dark', -.026, -.14 - i * .018, .042, .0028, .0206);
  k.ext('poly', [[.0, -.21], [-.05, -.213], [-.05, -.226], [.0, -.223]], .028, { r: .003 });
  k.part('body'); k.anchor('muzzle', .265, .008); k.anchor('eject', .05, .014, .02);
  return { grip: [-.03, -.074, .06], support: [.118, -.05], mag: [-.027, -.19], charge: [.1, .026], handle: .05, sideCharge: true };
}

/* ---------- 16. Mastiff 45: heavy slow-firing SMG, wood furniture, finned barrel ---------- */
function buildHSMG(k) {
  recv(k, 'paint', -.115, .14, -.03, .036, .044);
  k.ext('dark', [[.05, -.03], [.122, -.03], [.118, -.052], [.054, -.052]], .034, { r: .003 });
  k.cyl('steel', .12, .31, .006, .0108, .0098, 0, 16);
  for (let i = 0; i < 9; i++) k.cyl('dark', .148 + i * .0125, .1535 + i * .0125, .006, .0172, .0172, 0, 14);
  muz(k, .3, .006, .0138, .044, 'comp');
  k.ext('wood', [[.14, -.032], [.262, -.028], [.268, -.02], [.268, -.006], [.14, -.004]], .044, { r: .007 });
  for (let i = 0; i < 3; i++) k.box('dark', .17 + i * .03, -.018, .004, .024, .0445);
  const grip = pgrip(k, -.058, -.03, 'wood', .031); triggerGroup(k, .012, -.03, 'dark');
  k.pin('steel', -.09, -.012, .0036, .046); k.pin('steel', .1, -.014, .0036, .046);
  k.ext('wood', [[-.115, .02], [-.115, -.028], [-.17, -.046], [-.26, -.082], [-.33, -.094], [-.336, .0], [-.27, .008], [-.17, .015]], .04, { r: .008 });
  k.ext('steel', [[-.334, .002], [-.344, .004], [-.346, -.098], [-.332, -.098]], .042, { r: .003 });
  k.box('dark', .008, .04, .21, .005, .014);
  irons(k, -.07, .29, .0555, 'ring');
  k.box('dark', .29, .026, .016, .026, .012);
  action(k, .02, .014, .044, { side: [.07, .02] });
  const mag = boxMag(k, .086, -.04, { len: .2, d: .04, w: .022, mat: 'steel', ribs: 5 });
  k.part('body'); k.anchor('muzzle', .346, .006); k.anchor('eject', .02, .016, .022);
  return { grip, support: [.2, -.03], mag, charge: [.07, .022], handle: .06, sideCharge: true };
}

/* ---------- 17. Ouragan A-12: box-fed automatic shotgun ---------- */
function buildASG(k) {
  recv(k, 'paint', -.13, .15, -.036, .036, .05, .012);
  k.ext('dark', [[.024, -.036], [.13, -.036], [.126, -.058], [.028, -.058]], .044, { r: .003 });
  hguard(k, 'poly', .15, .41, -.04, .028, .054, 6, 0);
  for (let i = 0; i < 6; i++) k.box('rubber', .18 + i * .036, -.038, .016, .005, .04);
  k.rail(-.12, .4, .04);
  k.cyl('steel', .13, .57, .006, .0128, .0118, 0, 16);
  k.cyl('dark', .15, .44, -.02, .0105, .0105, 0, 12); k.cyl('steel', .44, .452, -.02, .0118, .0118, 0, 12); k.box('dark', .446, -.006, .014, .03, .014);
  k.tube('dark', .556, .612, .006, .0168, .0118, 0, 16);
  for (let i = 0; i < 4; i++) k.box('rubber', .604, .006 + (i < 2 ? .0145 : -.0145), .018, .006, .008, (i % 2 ? .0 : .0));
  const grip = pgrip(k, -.058, -.036); triggerGroup(k, -.004, -.036, 'dark');
  k.pin('steel', -.1, -.012, .0038, .052); k.pin('steel', .12, -.016, .0038, .052);
  stockSolid(k, -.13, .008, 'poly', .26, .064, { hole: true });
  irons(k, -.08, .39, .066, 'ring');
  action(k, .02, .012, .05, { side: [.09, .018] });
  const mag = boxMag(k, .078, -.046, { len: .14, d: .078, w: .036, rake: -.01, mat: 'poly', base: 'rubber', ribs: 3, shell: true });
  k.part('body'); k.anchor('muzzle', .616, .006); k.anchor('eject', .02, .014, .026);
  return { grip, support: [.28, -.044], mag, charge: [.09, .02], handle: .07, sideCharge: true, wide: true };
}

/* ---------- 18. Jumelle 2C: short side-by-side, break action, wood stock ---------- */
function buildDBS(k) {
  const hinge = [.058, -.02], bv = .01;
  k.ext('steel', [[-.095, -.028], [.052, -.03], [.062, -.022], [.062, -.008], [.002, -.008], [.002, .0235], [-.05, .0245], [-.095, .008]], .052, { r: .004 });
  k.ext('steel', [[-.078, .019], [-.02, .0245], [-.022, .0285], [-.074, .025]], .01, { r: .002 });
  for (const x of [-.0262, .0262]) k.ext('dark', [[-.08, -.018], [-.01, -.02], [-.014, .018], [-.06, .022]], .0008, { x, r: .008, b: 0 });
  triggerGroup(k, -.036, -.03, 'steel');
  k.ext('steel', [[-.018, -.028], [-.013, -.036], [-.016, -.048], [-.021, -.049], [-.02, -.038], [-.025, -.028]], .006, { r: .002, b: .0004, x: .008 });
  k.ext('wood', [[-.09, .018], [-.09, -.03], [-.064, -.04], [-.05, -.05], [-.06, -.072], [-.077, -.11], [-.12, -.114], [-.127, -.092], [-.131, -.058], [-.225, -.09], [-.36, -.116], [-.366, .012], [-.3, .012], [-.18, .012]], .042, { r: .007 });
  for (let i = 0; i < 6; i++) k.box('dark', -.08 - i * .002, -.072 - i * .0062, .03, .0018, .0425);
  k.ext('rubber', [[-.364, .014], [-.378, .018], [-.382, -.12], [-.36, -.12]], .045, { r: .005 });
  k.part('barrels', hinge);
  for (const x of [-.0128, .0128]) { k.cyl('steel', .002, .44, bv, .0125, .0118, x, 16); k.cyl('rubber', .4396, .4406, bv, .0098, .0098, x, 12); }
  k.box('dark', .22, bv + .0122, .43, .004, .008); k.box('steel', .22, bv - .011, .43, .006, .008);
  k.box('steel', .4275, bv + .0165, .008, .006, .003); k.cyl('brass', .424, .431, bv + .021, .0024, .0024, 0, 8);
  k.ext('wood', [[.068, -.03], [.24, -.024], [.25, -.014], [.25, .0], [.068, .0]], .05, { r: .007 });
  for (let i = 0; i < 4; i++) k.box('dark', .11 + i * .03, -.016, .003, .022, .0505);
  k.box('steel', .045, -.012, .05, .014, .03);
  k.part('rims', hinge);
  for (const x of [-.0128, .0128]) { k.disc('brass', .0014, bv, .0108, x); k.disc('steel', .001, bv, .003, x); }
  k.part('body');
  k.anchor('sight', .4275, bv + .0215); k.anchor('muzzle', .446, bv); k.anchor('eject', -.01, .04, 0);
  return {
    grip: [-.093, -.076, .34], support: [.16, -.03], wide: true, shell: [-.02, .03],
    poses: P => ({ port: sidePose(-.06, .05, -.03, [.7, .75, .8, .8, .5]) }),
    post(w) { nest(w, 'rims', 'barrels'); },
    scripts: w => ({ tac: breakReload(w, false), empty: breakReload(w, true) }),
    animate(w, a) { w.parts.barrels.rotation.x = -a.brk * .52; w.parts.rims.visible = a.rod < .5; },
  };
}
function breakReload(w, empty) {
  const P = w.poses, n = empty ? 2 : 1, s0 = .2, s1 = .82, step = (s1 - s0) / n, ports = new Float32Array(n), near = shiftPose(P.port, -.05, .03);
  const ev = [[.08, 'breakOpen'], [.13, '$eject0']], lh = [[0, P.rest], [.14, P.rest]];
  if (empty) ev.push([.15, '$eject0']);
  for (let i = 0; i < n; i++) {
    const a = s0 + step * i;
    lh.push([a + step * .2, P.pouch], [a + step * .3, P.pouch], [a + step * .64, near], [a + step * .76, P.port], [a + step * .85, P.port]);
    ports[i] = a + step * .76; ev.push([a + step * .2, 'pouch'], [ports[i], 'shell']);
  }
  lh.push([.9, P.rest], [1, P.rest]); ev.push([.92, 'breakClose']);
  return {
    ev, lh, attach: null, tilt: [.1, .12, .4],
    run(a, t) {
      a.brk = seg(.04, .12, t) * (1 - seg(.88, .94, t));
      a.lhY = -a.brk * .05 * (1 - seg(.14, .2, t) * (1 - seg(.86, .9, t)));       // the support hand rides the barrels down, then lets go
      a.heldShell = 0; a.rod = t > .13 && t < ports[n - 1] ? 1 : 0;        // rod = chambers shown empty
      for (let i = 0; i < n; i++) {
        const s = s0 + step * i, p = ports[i];
        if (t >= s + step * .26 && t < p) a.heldShell = 1;
        a.lhZ += -.02 * seg(p - step * .06, p, t) * (1 - seg(p, p + step * .12, t));
      }
    },
  };
}

/* ---------- 19. Cyclone G-6: six-barrel rotary gun carried at the hip ---------- */
function buildMINI(k) {
  const R = .03;
  k.ext('paint', [[-.13, -.05], [.1, -.05], [.12, -.04], [.12, .05], [.1, .06], [-.1, .06], [-.13, .04]], .09, { r: .01 });
  k.cyl('dark', .12, .2, 0, .056, .05, 0, 22); k.cyl('steel', .2, .214, 0, .05, .05, 0, 22);
  for (let i = 0; i < 6; i++) k.pin('steel', -.1 + i * .04, .04, .0032, .093);
  k.box('dark', -.02, .0, .16, .05, .002, .0452); k.box('dark', -.02, .0, .16, .05, .002, -.0452);
  k.ext('dark', [[-.13, .04], [-.13, -.04], [-.16, -.036], [-.16, .036]], .07, { r: .006 });
  const grip = pgrip(k, -.1, -.05, 'poly', .034); triggerGroup(k, -.03, -.05, 'dark');
  for (const x of [-.03, .03]) k.ext('dark', [[.03, .058], [.072, .058], [.064, .096], [.04, .096]], .007, { x, r: .003 });
  k.pin('dark', .052, .092, .009, .068);
  // side carrying grip for the support hand
  for (const u of [-.02, .11]) k.box('dark', u, .012, .014, .016, .05, -.066);
  k.cyl('rubber', -.03, .12, .012, .0125, .0125, -.092, 12);
  k.ext('dark', [[-.03, -.05], [.07, -.05], [.07, -.074], [-.03, -.074]], .06, { x: .02, r: .004 });
  k.part('mag', [.02, -.072]);
  k.ext('tan', [[-.06, -.072], [.1, -.072], [.1, -.19], [-.06, -.19]], .11, { r: .008 });
  k.box('dark', .02, -.075, .164, .008, .112); k.box('dark', .02, -.132, .006, .12, .112); k.box('steel', -.062, -.12, .008, .03, .03);
  k.box('rubber', .02, -.15, .09, .016, .002, .0555);
  k.part('barrels', [0, 0]);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, v = Math.cos(a) * R, x = Math.sin(a) * R;
    k.cyl('steel', .2, .72, v, .0084, .0076, x, 10); k.cyl('rubber', .7196, .7206, v, .0054, .0054, x, 8);
  }
  for (const u of [.3, .47, .64]) k.cyl('dark', u, u + .014, 0, .0435, .0435, 0, 18);
  k.cyl('dark', .7, .716, 0, .0445, .0445, 0, 18); k.cyl('steel', .2, .7, 0, .009, .009, 0, 8);
  k.part('body');
  k.anchor('muzzle', .726, R); k.anchor('eject', .06, -.045, .052); k.anchor('sight', .051, .12);
  return {
    grip, support: [.045, .012], mag: [.02, -.17], spin: 22,
    poses: P => {
      const X = new THREE.Vector3(0, .1, -1), Y = new THREE.Vector3(.3, .95, 0).normalize();
      return { rest: poseFrom(V(.045, .012, -.118).addScaledVector(Y, -.064), X, Y, [1.2, 1.24, 1.26, 1.26, .9]), charge: topPose(.0, .04, .03) };
    },
    scripts: w => { const s = miniReload(w); return { tac: s, empty: s }; },
  };
}
function miniReload(w) {
  const P = w.poses;
  return {
    ev: [[.14, 'magOut'], [.31, 'pouch'], [.6, 'magIn'], [.66, 'magTap'], [.8, 'boltForward']], attach: [.14, .6], tilt: [.16, .16, .5],
    lh: [[0, P.rest], ...magSwap(P, .08, .14, .31, .34, .6, .66), [.75, P.charge], [.83, P.charge], [.94, P.rest], [1, P.rest]],
    run(a, t) { a.magSeat = seg(.56, .605, t) * (1 - seg(.605, .66, t)); a.lhY = -.012 * seg(.78, .8, t) * (1 - seg(.8, .84, t)); a.rigY = .05 * seg(0, .1, t) * (1 - seg(.9, 1, t)); },
  };
}

/* ---------- 20. Éclair DM-9: semi-automatic marksman rifle with a prism optic ---------- */
function buildDMR(k) {
  recv(k, 'paint', -.135, .13, -.013, .031, .042);
  lower(k, 'dark', -.135, .13, -.013, .037, .029, .054);
  hguard(k, 'paint', .125, .47, -.02, .029, .042, 11);
  k.rail(-.125, .465, .035);
  k.cyl('steel', .11, .7, .004, .0098, .0086, 0, 16);
  k.cyl('dark', .45, .482, .004, .0135, .0135, 0, 10); k.cyl('steel', .14, .46, .019, .0034, .0034, 0, 6);
  k.cyl('dark', .69, .79, .004, .0155, .0155, 0, 16); k.cyl('steel', .79, .796, .004, .0155, .009, 0, 16);
  for (let i = 0; i < 5; i++) k.cyl('rubber', .704 + i * .017, .709 + i * .017, .004, .0158, .0158, 0, 14);
  bipod(k, .2, .44, -.031);
  const grip = pgrip(k, -.056, -.043); triggerGroup(k, .015, -.043);
  k.pin('steel', -.096, -.025, .0034, .039); k.pin('steel', .1, -.03, .0034, .039);
  stockSolid(k, -.135, .004, 'poly', .29, .06, { hole: true, cheek: true, w: .038 });
  k.cyl('dark', -.2, -.135, .008, .016, .016);
  prism(k, -.005, .0385, .056, .03);
  action(k, .008, .012, .042, { side: [.09, .02] });
  const mag = boxMag(k, .09, -.043, { len: .1, d: .064, w: .026, rake: -.006, curve: .012, mat: 'poly', base: 'rubber', ribs: 2 });
  k.part('body'); k.anchor('muzzle', .8, .004); k.anchor('eject', .008, .014, .021);
  return { grip, support: [.3, -.032], mag, charge: [.09, .022], handle: .07, sideCharge: true };
}

/* ---------- 21. Goliath .50: heavy bolt-action anti-materiel rifle ---------- */
function buildHSR(k) {
  k.ext('steel', [[-.14, -.02], [.17, -.02], [.182, -.01], [.182, .026], [.17, .035], [-.12, .035], [-.14, .024]], .046, { r: .006 });
  k.ext('paint', [[-.165, -.018], [.4, -.018], [.414, -.03], [.406, -.06], [.11, -.06], [.08, -.07], [.05, -.058], [-.04, -.058], [-.068, -.082], [-.12, -.082], [-.165, -.05]], .052, { r: .006, holes: slots(.2, .39, -.05, -.028, 7) });
  k.box('rubber', .29, -.064, .19, .006, .034);
  const grip = pgrip(k, -.058, -.058, 'poly', .034); triggerGroup(k, .02, -.058, 'dark');
  k.ext('paint', [[-.165, .008], [-.165, -.052], [-.24, -.07], [-.36, -.1], [-.47, -.108], [-.476, .014], [-.42, .02], [-.35, .034], [-.27, .038], [-.22, .016]], .046, { r: .008, holes: [[[-.25, -.012], [-.29, -.056], [-.38, -.074], [-.386, .004], [-.31, .012]]], hr: .006 });
  k.ext('rubber', [[-.474, .017], [-.494, .02], [-.498, -.114], [-.472, -.114]], .05, { r: .005 });
  k.ext('poly', [[-.28, .038], [-.36, .032], [-.36, .05], [-.28, .056]], .032, { r: .004 });
  k.cyl('steel', -.43, -.39, -.12, .008, .008, 0, 8); k.box('rubber', -.41, -.132, .03, .012, .03);
  k.cyl('steel', .17, 1.0, .006, .0165, .0118, 0, 18);
  for (const a of [0, 1, 2]) k.box('dark', .55, .006 + (a - 1) * .0075, .5, .0014, .0305);
  k.ext('dark', [[.99, -.02], [1.1, -.02], [1.108, -.012], [1.108, .024], [1.1, .032], [.99, .032]], .064, { r: .005 });
  for (let i = 0; i < 2; i++) { k.box('rubber', 1.02 + i * .044, .006, .024, .03, .0646); k.box('rubber', 1.02 + i * .044, .0315, .024, .003, .04); }
  k.box('dark', .03, .0345, .28, .004, .022);
  k.rail(-.1, .17, .042, .024);
  bipod(k, .42, .7, -.036, .02);
  k.ext('dark', [[.385, -.03], [.42, -.03], [.42, -.006], [.385, -.006]], .05, { r: .004 });
  scopeLong(k, .02, .098, 1.16);
  k.part('mag', [.062, -.06]);
  k.ext('dark', [[.13, -.058], [-.004, -.058], [-.004, -.13], [.13, -.136]], .032, { r: .004 });
  for (let i = 0; i < 2; i++) k.box('rubber', .063, -.085 - i * .022, .13, .003, .0326);
  k.ext('poly', [[.134, -.13], [-.008, -.125], [-.01, -.142], [.136, -.148]], .038, { r: .003 });
  k.part('bolt', [0, .008]);
  k.cyl('steel', -.13, .09, .002, .0128, .0128, 0, 16);
  for (let i = 0; i < 4; i++) k.box('dark', -.06 + i * .03, .0152, .014, .0014, .008);
  k.cyl('dark', -.15, -.13, .002, .016, .016, 0, 16);
  k.box('steel', -.112, -.002, .011, .01, .036, .022);
  const ball = new THREE.SphereGeometry(.0115, 12, 10); ball.translate(.047, -.034, .112); k.add('poly', ball);
  const stem = new THREE.CylinderGeometry(.004, .004, .042, 8); stem.rotateZ(.82); stem.translate(.032, -.018, .112); k.add('steel', stem);
  k.part('body'); k.anchor('muzzle', 1.115, .006); k.anchor('eject', .014, .024, .024);
  return { grip, support: [.3, -.058], mag: [.062, -.128], boltKnob: [-.112, -.034, .047], boltTurn: true,
    scripts: w => ({ tac: sniperReload(w, false), empty: sniperReload(w, true), cycle: boltCycle(w) }) };
}

/* ---------- 22. Bélier RL-4: shoulder-fired launcher, the warhead rides in the muzzle ---------- */
function buildRL(k) {
  const tv = .09;
  k.cyl('paint', -.5, .3, tv, .043, .043, 0, 22);
  k.tube('paint', .3, .47, tv, .043, .0372, 0, 24); k.tube('dark', .44, .476, tv, .0485, .0372, 0, 24);
  k.cyl('dark', -.6, -.5, tv, .064, .043, 0, 22); k.tube('dark', -.612, -.6, tv, .066, .05, 0, 22);
  for (const u of [-.44, -.06, .25]) k.cyl('dark', u, u + .018, tv, .0456, .0456, 0, 22);
  k.cyl('poly', -.36, -.1, tv, .0468, .0468, 0, 22); for (let i = 0; i < 6; i++) k.cyl('rubber', -.34 + i * .04, -.325 + i * .04, tv, .0474, .0474, 0, 22);
  k.ext('rubber', [[-.31, tv - .04], [-.14, tv - .04], [-.15, tv - .072], [-.3, tv - .072]], .05, { r: .008 });
  k.ext('dark', [[-.09, tv - .038], [.06, tv - .038], [.06, 0], [-.066, 0], [-.09, .02]], .034, { r: .004 });
  const grip = pgrip(k, -.058, 0); triggerGroup(k, .014, 0, 'dark');
  k.ext('poly', [[.226, tv - .04], [.196, tv - .04], [.188, .02], [.192, -.05], [.2, -.06], [.226, -.06], [.234, -.05], [.232, .03]], .03, { r: .005 });
  for (let i = 0; i < 6; i++) k.box('rubber', .211, .006 - i * .0095, .046, .0035, .031);
  // side sight: rear ring and front post on a left-hand bracket
  const sx = -.066, sv = tv + .058;
  k.box('dark', -.03, tv + .012, .03, .012, .05, -.04); k.box('dark', -.03, sv - .024, .012, .03, .008, sx);
  k.tube('dark', -.034, -.026, sv, .0125, .0082, sx, 16);
  k.box('dark', .2, tv + .012, .03, .012, .05, -.04); k.box('dark', .2, sv - .016, .01, .04, .0035, sx);
  for (const d of [-.01, .01]) k.box('dark', .2, sv - .006, .008, .03, .0024, sx + d);
  k.anchor('sight', .2, sv, sx);
  k.part('mag', [.4, tv]);
  k.cyl('olive', .25, .472, tv, .035, .035, 0, 16);
  k.cyl('olive', .47, .53, tv, .036, .046, 0, 18); k.cyl('olive', .53, .58, tv, .046, .046, 0, 18); k.cyl('olive', .58, .665, tv, .046, .013, 0, 18);
  k.cyl('brass', .548, .556, tv, .0468, .0468, 0, 18); k.cyl('steel', .665, .69, tv, .013, .006, 0, 10);
  k.part('body'); k.anchor('muzzle', .48, tv); k.anchor('eject', -.6, tv);
  return {
    grip, support: [.211, -.004], fore: true, mag: [.56, tv - .03],
    poses: P => ({ magOut: shiftPose(P.mag, .2) }),
    scripts: w => { const s = rocketReload(w); return { tac: s, empty: s }; },
    onFire(w) { w.st.loaded = false; },
    animate(w, a, dt, script, t) { w.parts.mag.visible = w.st.loaded || !!(script && script.attach && t >= script.attach[0]); },
  };
}
function rocketReload(w) {
  const P = w.poses;
  return {
    ev: [[.2, 'pouch'], [.64, 'rocketIn'], [.8, 'rocketLock']], attach: [.3, .665], tilt: [-.12, .42, .26],
    lh: [[0, P.rest], [.14, P.pouch], [.3, P.pouch], [.5, P.magOut], [.55, P.magOut], [.665, P.mag], [.72, P.mag], [.8, P.mag], [.92, P.rest], [1, P.rest]],
    run(a, t) {
      const e = seg(0, .14, t) * (1 - seg(.82, 1, t));
      a.rigZ = .17 * e; a.rigX = -.06 * e; a.rigY = -.03 * e;
      a.magSeat = seg(.76, .8, t) * (1 - seg(.8, .86, t)) * -2;
      if (t >= .665) w.st.loaded = true;
    },
  };
}

/* ---------- 23. Mortier GL-6: six-shot revolving grenade launcher ---------- */
function buildGL(k) {
  const dv = -.034, pv = [.09, -.08, -.04];
  k.ext('paint', [[-.11, -.03], [-.02, -.03], [-.01, -.09], [.022, -.09], [.022, .045], [-.085, .045], [-.11, .03]], .05, { r: .005 });
  k.box('dark', .11, .0475, .25, .008, .026); k.rail(-.09, .23, .0555, .021);
  k.ext('paint', [[.165, -.09], [.2, -.09], [.21, -.03], [.21, .045], [.165, .045]], .05, { r: .005 });
  k.tube('steel', .2, .38, 0, .0275, .0212, 0, 24); k.tube('dark', .366, .39, 0, .031, .0212, 0, 24);
  for (let i = 0; i < 3; i++) k.tube('dark', .236 + i * .036, .246 + i * .036, 0, .0296, .027, 0, 24);
  k.ext('poly', [[.21, -.028], [.33, -.028], [.33, -.044], [.22, -.05]], .04, { r: .007 });
  const grip = pgrip(k, -.076, -.03); triggerGroup(k, -.006, -.03, 'dark');
  k.pin('steel', -.06, .0, .0036, .052); k.pin('steel', .188, -.07, .0036, .052);
  stockWire(k, -.108, .028, .2);
  reflex(k, .03, .059);
  k.part('crane', pv);
  k.cyl('steel', .02, .166, pv[1], .005, .005, pv[2], 8); k.box('paint', .162, -.06, .008, .05, .012, -.022);
  k.part('drum', [.09, dv]);
  k.cyl('dark', .026, .158, dv, .054, .054, 0, 30); k.cyl('steel', .02, .164, dv, .008, .008, 0, 10);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, b = a + Math.PI / 6;
    k.cyl('paint', .07, .1584, dv + Math.cos(b) * .0535, .011, .011, Math.sin(b) * .0535, 10);
    k.disc('brass', .0256, dv + Math.cos(a) * .034, .0192, Math.sin(a) * .034); k.disc('rubber', .0252, dv + Math.cos(a) * .034, .0046, Math.sin(a) * .034);
  }
  heldRounds(k, 1, 0, .0188, .046, 'olive');
  k.anchor('muzzle', .392, 0); k.anchor('eject', .09, dv, -.06);
  const oc = swing2([0, dv], [pv[2], pv[1]], 1.5);
  return {
    grip, support: [.27, -.036], mag: [.09, dv - .06],
    poses: P => ({ crane: sidePose(.09, dv, -.08), load: sidePose(-.03, oc[1] + .03, oc[0] - .04, [.75, .8, .85, .85, .5]) }),
    post(w) { nest(w, 'drum', 'crane'); },
    scripts: w => ({ tac: glReload(w), empty: glReload(w) }),
    onFire(w) { w.st.rotT += Math.PI / 3; },
    animate(w, a, dt) {
      const st = w.st; st.rot += (st.rotT - st.rot) * Math.min(1, dt * 18);
      w.parts.crane.rotation.z = a.cyl * 1.5; w.parts.drum.rotation.z = st.rot + a.rod;
    },
  };
}
function glReload(w) {
  const P = w.poses, n = 3, s0 = .27, s1 = .84, step = (s1 - s0) / n, ins = new Float32Array(n);
  const ev = [[.11, 'cylOpen']], lh = [[0, P.rest], [.06, P.crane], [.15, P.crane]];
  for (let i = 0; i < n; i++) {
    const a = s0 + step * i;
    lh.push([a + step * .16, P.pouch], [a + step * .24, P.pouch], [a + step * .6, P.load], [a + step * .76, P.load]);
    ins[i] = a + step * .66; ev.push([a + step * .16, 'pouch'], [ins[i], 'grenadeIn']);
  }
  lh.push([.88, P.crane], [.94, P.crane], [.985, P.rest], [1, P.rest]); ev.push([.92, 'cylClose']);
  return {
    ev, lh, attach: null, tilt: [.05, .12, .42],
    run(a, t) {
      a.cyl = seg(.09, .17, t) * (1 - seg(.88, .94, t));
      a.held = 0; a.rod = 0;
      for (let i = 0; i < n; i++) {
        if (t > s0 + step * (i + .2) && t < ins[i]) a.held = 1;
        a.lhZ += -.022 * seg(ins[i] - step * .06, ins[i], t) * (1 - seg(ins[i], ins[i] + step * .14, t));
        a.rod += seg(ins[i] + step * .1, ins[i] + step * .3, t) * Math.PI / 3 * 2;      // the open drum is turned to the next pair of chambers
      }
    },
  };
}

/* ---------- 24. Silence X-1: compound crossbow with a prism optic ---------- */
const XB = { piv: [.425, .017, .045], tip: [.21, .11], bolt: .0185, rest: .3, latch: .03 };
function buildXBOW(k) {
  k.ext('paint', [[-.1, .01], [.42, .01], [.44, 0], [.44, -.022], [.1, -.03], [.07, -.046], [-.03, -.042], [-.06, -.052], [-.1, -.042]], .034, { r: .005 });
  k.box('dark', .2, .0125, .47, .005, .016); k.box('rubber', .21, .0152, .4, .0008, .005);
  stockSolid(k, -.1, .0, 'paint', .26, .06, { hole: true, cheek: true, w: .036 });
  const grip = pgrip(k, -.076, -.042); triggerGroup(k, -.006, -.042, 'dark');
  k.ext('poly', [[.12, -.03], [.31, -.022], [.31, -.046], [.14, -.054]], .042, { r: .008 });
  for (let i = 0; i < 5; i++) k.box('rubber', .16 + i * .03, -.04, .01, .02, .0425);
  k.box('steel', .004, .022, .05, .016, .03); k.box('dark', .03, .026, .006, .01, .034);
  for (const x of [-.016, .016]) k.ext('dark', [[-.06, .012], [.06, .012], [.046, .05], [-.046, .05]], .004, { x, r: .003, b: .0006 });
  k.box('dark', .0, .0505, .1, .004, .036);
  prism(k, .0, .0525);
  k.ext('steel', [[.4, -.024], [.452, -.024], [.452, .034], [.4, .034]], .1, { r: .006 });
  k.tube('steel', .452, .458, -.002, .042, .036, 0, 18);
  for (const s of [-1, 1]) {
    k.part(s < 0 ? 'limbL' : 'limbR', [XB.piv[0], XB.piv[1], s * XB.piv[2]]);
    const len = Math.hypot(XB.tip[0], XB.tip[1]), g = new THREE.BoxGeometry(len, .03, .011); g.translate(len / 2, 0, 0);
    g.rotateY(s > 0 ? -Math.atan2(XB.tip[1], XB.tip[0]) : Math.PI + Math.atan2(XB.tip[1], XB.tip[0])); g.translate(s * XB.piv[2], XB.piv[1], -XB.piv[0]); k.add('dark', g, true);
    const cam = new THREE.CylinderGeometry(.017, .017, .012, 14); cam.translate(s * (XB.piv[2] + XB.tip[0]), XB.piv[1], -XB.piv[0] + XB.tip[1]); k.add('steel', cam);
    const hub = new THREE.CylinderGeometry(.006, .006, .016, 8); hub.translate(s * (XB.piv[2] + XB.tip[0]), XB.piv[1], -XB.piv[0] + XB.tip[1]); k.add('dark', hub);
  }
  k.part('mag', [.2, XB.bolt]);
  k.cyl('dark', .04, .43, XB.bolt, .0036, .0036, 0, 8); k.cyl('steel', .43, .478, XB.bolt, .0095, .0006, 0, 4); k.cyl('brass', .034, .042, XB.bolt, .0042, .0042, 0, 8);
  k.ext('red', [[.046, XB.bolt], [.058, XB.bolt + .012], [.092, XB.bolt + .012], [.104, XB.bolt]], .0012, { r: .001, b: 0 });
  for (const x of [-.0068, .0068]) k.box('red', .075, XB.bolt - .003, .05, .001, .011, x);
  k.part('body'); k.anchor('muzzle', .48, XB.bolt); k.anchor('eject', 0, .03);
  return {
    grip, support: [.22, -.036], mag: [.2, XB.bolt],
    poses: P => { const top = topPose(.2, XB.bolt - .012); return { mag: top, pouch: pouchPose(top), string: topPose(XB.rest - .01, XB.bolt - .014) }; },
    post(w, mats) {
      const g = new THREE.BoxGeometry(1, 1, 1); w.strings = [];
      for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(g, mats.rubber); m.frustumCulled = false; m.renderOrder = 1; w.root.add(m); w.strings.push(m); }
    },
    scripts: w => { const s = xbowReload(w); return { tac: s, empty: s }; },
    onFire(w) { w.st.loaded = false; w.st.drawn = false; w.st.snap = 1; },
    animate(w, a, dt, script, t, time) {
      const st = w.st, P = w.parts; st.snap = Math.max(0, st.snap - dt * 5);
      const d = Math.max(st.drawn ? 1 : 0, a.draw), wob = Math.sin(time * 95) * st.snap * .012;
      P.mag.visible = st.loaded || !!(script && script.attach && t >= script.attach[0]);
      const nu = mix(XB.rest, XB.latch, d) + wob;
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1, th = -s * d * .2, c = Math.cos(th), sn = Math.sin(th), rx = s * XB.tip[0], rz = XB.tip[1];
        (i ? P.limbR : P.limbL).rotation.y = th;
        _v.set(s * XB.piv[2] + rx * c + rz * sn, XB.piv[1], -XB.piv[0] - rx * sn + rz * c); _v2.set(0, XB.bolt, -nu);
        const m = w.strings[i], len = _v.distanceTo(_v2) || .001;
        m.position.addVectors(_v, _v2).multiplyScalar(.5); m.scale.set(.0028, .0028, len);
        _s.subVectors(_v2, _v).divideScalar(len); m.quaternion.setFromUnitVectors(_fwdZ, _s);
      }
    },
  };
}
const _fwdZ = new THREE.Vector3(0, 0, 1), _el = new THREE.Vector3(), _qi = new THREE.Quaternion();
function xbowReload(w) {
  const P = w.poses, pull = XB.rest - XB.latch - .01;
  return {
    ev: [[.15, 'stringDraw'], [.44, 'stringLatch'], [.585, 'pouch'], [.76, 'boltPlace']], attach: [.6, .765], tilt: [.1, .1, .26],
    lh: [[0, P.rest], [.1, P.string], [.46, P.string], [.585, P.pouch], [.605, P.pouch], [.75, P.mag], [.8, P.mag], [.94, P.rest], [1, P.rest]],
    run(a, t) {
      a.draw = seg(.15, .43, t);
      if (t < .5) a.lhZ = a.draw * pull * (1 - seg(.45, .5, t));
      if (t >= .44) w.st.drawn = true;
      if (t >= .765) w.st.loaded = true;
      a.rigRX = -.16 * seg(.1, .2, t) * (1 - seg(.44, .54, t));
    },
  };
}

/* ---------- 25. Grenade F-1: hand grenade, pin pulled and thrown on fire() ---------- */
function buildFRAG(k) {
  const c = [-.03, -.068], X = -.006;
  const body = new THREE.SphereGeometry(.031, 16, 12); body.scale(1, 1.14, 1); body.translate(X, c[1], -c[0]); k.add('paint', body);
  for (const dy of [-.012, .012]) { const ring = new THREE.TorusGeometry(.0302, .0026, 5, 20); ring.rotateX(Math.PI / 2); ring.translate(X, c[1] + dy, -c[0]); k.add('dark', ring); }
  const neck = new THREE.CylinderGeometry(.011, .0125, .024, 12); neck.translate(X, c[1] + .044, -c[0]); k.add('steel', neck);
  const cap = new THREE.CylinderGeometry(.0135, .0135, .008, 12); cap.translate(X, c[1] + .058, -c[0]); k.add('dark', cap);
  k.ext('steel', [[c[0] - .008, c[1] + .06], [c[0] + .014, c[1] + .064], [c[0] + .04, c[1] + .034], [c[0] + .043, c[1] - .024], [c[0] + .038, c[1] - .024], [c[0] + .034, c[1] + .03], [c[0] + .012, c[1] + .057], [c[0] - .008, c[1] + .054]], .013, { x: X, r: .002, b: .0005 });
  k.part('pin', [c[0], c[1] + .05, X]);
  const ringP = new THREE.TorusGeometry(.012, .0017, 5, 16); ringP.translate(X - .028, c[1] + .05, -c[0]); k.add('steel', ringP);
  k.pin('steel', c[0], c[1] + .05, .0015, .034, X - .006);
  k.part('body');
  k.anchor('muzzle', c[0], c[1] + .06); k.anchor('sight', c[0], c[1] + .06); k.anchor('eject', c[0], c[1]);
  return {
    grip: [c[0], c[1], .12], oneHand: true,
    poses: P => { P.grip.f.set([.72, .82, .88, .92, .45]); return { rest: awayPose(P.rest), pin: sidePose(c[0] + .02, c[1] + .05, X - .05, [.9, 1, 1.05, 1.05, .2]), pinOut: sidePose(c[0], c[1] + .03, X - .2, [1, 1.1, 1.15, 1.15, .3]) }; },
    scripts: w => ({ act: [fragThrow(w)], tac: fragReady(w), empty: fragReady(w) }),
    animate(w, a, dt, script) {
      const st = w.st; w.parts.body.visible = st.loaded; w.parts.pin.visible = st.loaded && !st.pinOut;
      if (!st.loaded && a.rigY > -.42) a.rigY = -.42;
    },
  };
}
function fragThrow(w) {
  const P = w.poses;
  return {
    ev: [[.2, 'pinPull'], [.56, 'throw']], attach: null, tilt: [0, 0, 0], lhShow: t => t < .48,
    lh: [[0, P.rest], [.13, P.pin], [.2, P.pin], [.3, P.pinOut], [.5, P.rest], [1, P.rest]],
    run(a, t) {
      const up = seg(0, .14, t), wind = seg(.3, .5, t), go = seg(.5, .62, t), drop = seg(.62, .9, t);
      if (t < .01) w.st.pinOut = false; else if (t >= .2) w.st.pinOut = true;
      a.rigY = up * .05 + wind * .1 - go * .22 - drop * .35; a.rigZ = wind * .15 - go * .45; a.rigX = wind * .05 - go * .12;
      a.rigRX = wind * .7 - go * 1.5;
      if (t >= .56) w.st.loaded = false;
    },
  };
}
function fragReady(w) {
  const P = w.poses;
  return {
    ev: [], attach: null, tilt: [0, 0, 0], lh: [[0, P.rest], [1, P.rest]],
    run(a, t) { if (t >= .3) { w.st.loaded = true; w.st.pinOut = false; } a.rigY = -.42 * (1 - seg(.3, .85, t)); },
  };
}

Object.assign(BUILDERS, { hp: buildHP, rev: buildREV, mp: buildMP, knife: buildKNIFE, car: buildCAR, akr: buildAKR, brst: buildBRST, bat: buildBAT, pdw: buildPDW, hsmg: buildHSMG, asg: buildASG, dbs: buildDBS, mini: buildMINI, dmr: buildDMR, hsr: buildHSR, rl: buildRL, gl: buildGL, xbow: buildXBOW, frag: buildFRAG });
/* extra FEEL keys: rot (hip rotation), aim (explicit aimed position), noAim, act (scripted fire action), hull (shotgun hulls) */
Object.assign(FEEL, {
  hp: { hip: [.14, -.14, -.45], eye: .47, kz: .6, kp: 2.1, ky: .3, kr: .6, travel: .042, cycle: .12, flash: .26, casing: .82, smoke: .9, weight: 1.3 },
  rev: { hip: [.14, -.138, -.45], eye: .5, kz: .7, kp: 2.5, ky: .32, kr: .7, travel: 0, cycle: .2, flash: .3, casing: 0, dropSize: .78, smoke: 1.1, weight: 1.3 },
  mp: { hip: [.14, -.135, -.43], eye: .44, kz: .24, kp: .7, ky: .26, kr: .3, travel: .034, cycle: .05, flash: .17, casing: .6, smoke: .4, weight: 1.05 },
  knife: { hip: [.2, -.15, -.34], rot: [.1, .32, .42], eye: .4, kz: 0, kp: 0, ky: 0, kr: 0, travel: 0, cycle: .1, flash: 0, casing: 0, smoke: 0, weight: .8, noAim: true, act: { dur: .44 } },
  car: { hip: [.15, -.15, -.42], eye: .2, kz: .28, kp: .46, ky: .16, kr: .2, travel: .05, cycle: .065, flash: .28, casing: .85, smoke: .65, weight: .95 },
  akr: { hip: [.15, -.152, -.43], eye: .53, kz: .42, kp: .72, ky: .22, kr: .27, travel: .055, cycle: .09, flash: .36, casing: .95, smoke: .9, weight: 1.1 },
  brst: { hip: [.15, -.155, -.4], eye: .1, kz: .26, kp: .42, ky: .13, kr: .17, travel: .05, cycle: .055, flash: .26, casing: .85, smoke: .6, weight: 1 },
  bat: { hip: [.15, -.152, -.42], eye: .32, kz: .55, kp: .95, ky: .22, kr: .3, travel: .06, cycle: .1, flash: .4, casing: 1.05, smoke: 1, weight: 1.2 },
  pdw: { hip: [.15, -.14, -.4], eye: .2, kz: .18, kp: .3, ky: .16, kr: .16, travel: .04, cycle: .05, flash: .18, casing: .62, smoke: .4, weight: .85 },
  hsmg: { hip: [.15, -.148, -.41], eye: .43, kz: .32, kp: .55, ky: .2, kr: .22, travel: .046, cycle: .085, flash: .26, casing: .8, smoke: .6, weight: 1 },
  asg: { hip: [.15, -.152, -.41], eye: .5, kz: .8, kp: 1.5, ky: .32, kr: .5, travel: .07, cycle: .14, flash: .46, casing: 1.5, hull: true, smoke: 1.4, weight: 1.25 },
  dbs: { hip: [.15, -.15, -.42], eye: .5, kz: 1.1, kp: 2.3, ky: .36, kr: .7, travel: 0, cycle: .15, flash: .52, casing: 0, dropSize: 1.5, hull: true, smoke: 1.7, weight: 1.05 },
  mini: { hip: [.17, -.2, -.33], aim: [.1, -.17, -.3], eye: .3, kz: .1, kp: .12, ky: .14, kr: .1, travel: 0, cycle: .04, flash: .34, casing: .85, smoke: .5, weight: 1.9 },
  dmr: { hip: [.15, -.15, -.41], eye: .32, kz: .6, kp: 1.05, ky: .2, kr: .3, travel: .06, cycle: .11, flash: .36, casing: 1.05, smoke: 1, weight: 1.25 },
  hsr: { hip: [.16, -.155, -.4], eye: .12, kz: 1.5, kp: 2.4, ky: .3, kr: .5, travel: .12, cycle: .1, flash: .62, casing: 1.9, smoke: 2, weight: 1.7, manual: { dur: 1.3, delay: .22 } },
  rl: { hip: [.23, -.215, -.3], eye: .34, kz: .9, kp: 1.2, ky: .3, kr: .5, travel: 0, cycle: .2, flash: .7, casing: 0, smoke: 2.4, weight: 1.6 },
  gl: { hip: [.15, -.16, -.4], eye: .22, kz: .8, kp: 1.3, ky: .25, kr: .4, travel: 0, cycle: .15, flash: .22, casing: 0, smoke: 1.3, weight: 1.3 },
  xbow: { hip: [.15, -.15, -.38], eye: .32, kz: .25, kp: .3, ky: .1, kr: .12, travel: 0, cycle: .2, flash: 0, casing: 0, smoke: 0, weight: 1.1 },
  frag: { hip: [.19, -.14, -.34], rot: [0, .16, .16], eye: .4, kz: 0, kp: 0, ky: 0, kr: 0, travel: 0, cycle: .1, flash: 0, casing: 0, smoke: 0, weight: .8, noAim: true, act: { dur: .7 } },
});
/* second wave of the arsenal: models and clips in guns-extra.js */
registerExtraGuns({ THREE, BUILDERS, FEEL, outline, seg, mix, rel, rot2, triggerGroup, irons, holo, reflex, prism, scopeLong, action, shiftPose, sidePose, awayPose, supportPose, magReload, pistolReload, lmgReload, sniperReload, boltCycle, breakReload, nest });

/* ---------- weapon assembly ---------- */
function buildWeapon(def, mats) {
  const k = new Kit(mats); seed = 1000 + def.id.charCodeAt(0) * 17;
  const cfg = BUILDERS[def.id](k); k.build();
  const a = k.anchors, sightP = a.sight.position;
  const poses = {}; poses.grip = gripPose(cfg.grip[0], cfg.grip[1], cfg.grip[2]);
  if (def.id === 'p9') {
    // support hand cups the left side of the grip, fingers wrap over the firing hand, thumb forward
    const Y = new THREE.Vector3(.12, -.34, -.93).normalize(), Z = new THREE.Vector3(.96, 0, -.28).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
    poses.rest = poseFrom(V(-.052, -.06, -.04).addScaledVector(Y, -.052), X, Y, [1.05, 1.1, 1.12, 1.1, .12]);
  } else if (cfg.cup) poses.rest = cupPose(cfg.cup[0], cfg.cup[1]);
  else if (cfg.fore) poses.rest = foreGripPose(cfg.support[0], cfg.support[1]);
  else { const sp = cfg.support || cfg.grip; poses.rest = supportPose(sp[0], sp[1], .62, cfg.wide ? .88 : 1.02, cfg.wide ? .03 : .021); }
  const mref = cfg.mag || cfg.shell || cfg.grip, mu = mref[0], mv = mref[1];
  poses.mag = supportPose(mu, mv - .012, .34, 1.08, .02);
  poses.pouch = pouchPose(poses.mag);
  if (cfg.rack) poses.charge = topPose(cfg.rack[0], cfg.rack[1]);
  else if (cfg.sideCharge) { poses.charge = topPose(cfg.charge[0], cfg.charge[1], def.id === 'lmg' ? .074 : -.05); }
  else if (cfg.charge) poses.charge = topPose(cfg.charge[0], cfg.charge[1]);
  if (cfg.cover) poses.coverHand = topPose(cfg.cover[0], cfg.cover[1]);
  if (def.id === 'sg') { poses.port = supportPose(cfg.shell[0], cfg.shell[1] + .004, .22, .72, .012); }
  if (cfg.boltKnob) {
    const X = new THREE.Vector3(.1, .95, .25), Y = new THREE.Vector3(-.74, -.12, -.66);
    poses.boltHand = poseFrom(V(cfg.boltKnob[0] - .062, cfg.boltKnob[1] - .012, cfg.boltKnob[2] + .058), X, Y, [.92, 1.02, 1.1, 1.12, .9]);
  }
  if (cfg.poses) Object.assign(poses, cfg.poses(poses));
  poses.magLow = shiftPose(poses.mag, 0, -.05); poses.magTap = shiftPose(poses.mag, 0, -.016);
  const w = { def, k, root: k.root, parts: k.parts, anchors: a, cfg, poses, feel: FEEL[def.id], sight: sightP.clone(), scripts: {}, st: { loaded: true, drawn: true, n: 0, rot: 0, rotT: 0, cock: 0, snap: 0 } };
  if (k.parts.optic0 && k.sightFrom && k.sightFrom !== 'body' && k.parts[k.sightFrom]) nest(w, 'optic0', k.sightFrom);       // a sight on a moving cover keeps moving with it
  if (cfg.post) cfg.post(w, mats);
  if (cfg.scripts) Object.assign(w.scripts, cfg.scripts(w));
  else if (def.id === 'p9') { w.scripts.tac = pistolReload(w, false); w.scripts.empty = pistolReload(w, true); }
  else if (def.id === 'sg') { w.scripts.tac = shotgunReload(w, false); w.scripts.empty = shotgunReload(w, true); w.scripts.cycle = pumpCycle(w); }
  else if (def.id === 'lmg') { w.scripts.tac = lmgReload(w); w.scripts.empty = w.scripts.tac; }
  else if (def.id === 'sr') { w.scripts.tac = sniperReload(w, false); w.scripts.empty = sniperReload(w, true); w.scripts.cycle = boltCycle(w); }
  else { w.scripts.tac = magReload(w, false); w.scripts.empty = magReload(w, true); }
  for (const key in w.scripts) { const v = w.scripts[key]; for (const sc of Array.isArray(v) ? v : [v]) sc.ev.sort((p, q) => p[0] - q[0]); }
  if (w.parts.mag && (w.scripts.empty && w.scripts.empty.drop)) { w.dropMag = w.parts.mag.clone(true); w.dropMag.visible = false; w.root.add(w.dropMag); }      // prebuilt: same geometry and materials, nothing compiles at first use
  return w;
}

/* ---------- attachments: one model per accessory (origin = its mount point), shared by every weapon ---------- */
const ATT_MODEL = {
  dot: k => { reflex(k, 0, 0); return {}; },
  holo: k => { holo(k, 0, 0); return {}; },
  x4: k => { scopeLong(k, 0, .038, .6); return {}; },
  sup: k => { k.cyl('steel', -.006, .014, 0, .0115, .0115, 0, 12); k.cyl('dark', .012, .136, 0, .0185, .0185, 0, 16); k.cyl('steel', .136, .142, 0, .0185, .011, 0, 16); for (const u of [.03, .118]) k.cyl('rubber', u, u + .004, 0, .0192, .0192, 0, 16); return { len: .142 }; },
  comp: k => { muz(k, 0, 0, .0135, .056, 'comp'); return { len: .056 }; },
  hider: k => { muz(k, 0, 0, .0125, .05, 'hider'); return { len: .05 }; },
  ext: k => { k.box('steel', 0, -.5, 1, 1, 1); k.box('dark', 0, -.72, 1.02, .05, 1.02); k.box('dark', 0, -1.06, 1.16, .14, 1.16); return {}; },
  fast: k => { k.box('steel', 0, -.5, 1.08, 1, 1.08); k.box('red', 0, -.5, 1.1, .3, 1.1); return {}; },
  vg: k => { k.box('dark', 0, -.005, .056, .01, .024); k.ext('poly', [[-.017, -.009], [.017, -.009], [.015, -.086], [-.015, -.086]], .026, { r: .004 }); k.box('rubber', 0, -.089, .036, .007, .03); return {}; },
  ag: k => { k.box('dark', -.008, -.004, .076, .008, .024); k.ext('poly', [[-.046, -.007], [.03, -.007], [.034, -.018], [-.018, -.052], [-.046, -.05]], .026, { r: .005 }); return {}; },
  laser: k => { k.box('dark', 0, 0, .062, .022, .017); k.box('steel', -.012, 0, .014, .024, .019); k.cyl('steel', .031, .037, .003, .0052, .0052, 0, 10); k.disc('dot', .0375, .003, .003); return { emit: [.04, .003] }; },
};
/* where an optic sits on the weapons whose sight is not one of the shared assemblies */
const OPTIC_U = { p9: .03, hp: .035, mp: .03, rev: .075, sg: .07, dbs: .05, mini: .05, rl: .2 };
const SKIP_PARTS = new Set(['optic0', 'mag', 'held', 'belt', 'bolt', 'handle', 'pin']);
/* exact cross-section of the weapon's fixed parts at distance u along the bore: long faces have no vertex in the middle, so triangle edges are cut instead */
function sectionAt(w, u, fn) {
  const z0 = -u;
  for (const name of Object.keys(w.parts)) {
    if (SKIP_PARTS.has(name)) continue;
    const part = w.parts[name], py = part.position.y, pz = part.position.z, px = part.position.x;
    for (const c of part.children) {
      if (!c.isMesh) continue;
      const P = c.geometry.attributes.position.array;
      for (let t = 0; t + 8 < P.length; t += 9) for (let e = 0; e < 3; e++) {
        const a = t + e * 3, b = t + (e + 1) % 3 * 3, za = P[a + 2] + pz - z0, zb = P[b + 2] + pz - z0;
        if ((za > 0) === (zb > 0)) continue;
        const k = za / (za - zb); fn(P[a] + (P[b] - P[a]) * k + px, P[a + 1] + (P[b + 1] - P[a + 1]) * k + py);
      }
    }
  }
}
function measureMount(w) {
  const sg = w.k.sightAt, x0 = w.def.id === 'rl' ? w.sight.x : 0, ou = sg ? sg[0] : (OPTIC_U[w.def.id] ?? -w.sight.z), su = (w.cfg.support || w.cfg.grip)[0];
  let top = -1, bottom = 1, half = .008, rtop = -1, rbot = 1;
  const ru = su + .035;
  for (const d of [-.016, 0, .016]) sectionAt(w, ou + d, (x, y) => { if (Math.abs(x - x0) < .03 && y > top && y < .2) top = y; });       // a wide flat top has its only edges at its sides
  sectionAt(w, su, (x, y) => { if (Math.abs(x) < .03 && y < bottom && y > -.09) bottom = y; });
  sectionAt(w, ru, (x, y) => { if (y > -.05 && y < .08) { const ax = Math.abs(x); if (ax > half && ax < .05) half = ax; if (y > rtop) rtop = y; if (y < rbot) rbot = y; } });
  if (top < 0) top = sg ? sg[1] : w.sight.y - .03;
  const mp = w.parts.mag; let mag = null;
  if (mp) {
    let y0 = Infinity, x0m = Infinity, x1m = -Infinity, z0 = Infinity, z1 = -Infinity;
    const each = fn => { for (const c of mp.children) { if (!c.isMesh) continue; const P = c.geometry.attributes.position; for (let i = 0; i < P.count; i++) fn(P.getX(i), P.getY(i), P.getZ(i)); } };
    each((x, y) => { if (y < y0) y0 = y; });
    each((x, y, z) => { if (y < y0 + .012) { if (x < x0m) x0m = x; if (x > x1m) x1m = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } });
    if (y0 < Infinity) mag = { x: (x0m + x1m) / 2, y: y0, z: (z0 + z1) / 2, sx: Math.max(.012, x1m - x0m), sz: Math.max(.02, z1 - z0) };
  }
  return {
    sight: w.sight.clone(), muzzle: w.anchors.muzzle.position.clone(), rest: w.poses.rest ? { p: w.poses.rest.p.clone(), q: w.poses.rest.q.clone(), f: new Float32Array(w.poses.rest.f) } : null,
    opticU: ou, opticV: top, opticX: x0, su, sv: (w.cfg.support || w.cfg.grip)[1], under: bottom, railU: ru, railX: half, railV: rtop > rbot ? (rtop + rbot) / 2 : .01, mag,
  };
}

/* accessories: geometry is built once per accessory and shared; a weapon only holds light clones */
function attachmentFitter(mats) {
  const attLib = new Map(), NO_ATT = [];
  const attModel = id => {
    let e = attLib.get(id); if (e) return e;
    const k = new Kit(mats); k.noStock = true; const o = ATT_MODEL[id](k); k.build();
    e = { root: k.root, len: o.len || 0, emit: o.emit || null, sight: k.anchors.sight ? k.anchors.sight.position.clone() : null };
    attLib.set(id, e); return e;
  };
  const place = (nw, id, parent, x, y, z) => { const o = attModel(id).root.clone(true); o.visible = true; o.position.set(x, y, z); parent.add(o); nw.attObjs.push(o); return o; };
  const fitAttachments = (nw, def) => {
    const list = def.att || NO_ATT, key = def.attKey || '';
    if (!nw.mount) nw.mount = measureMount(nw);       // measured the first time the weapon is built, in the loader: mounting in a match only places clones
    if ((nw.attKey || '') === key) return;
    const M = nw.mount, P = nw.parts;
    for (const o of nw.attObjs || NO_ATT) o.removeFromParent();
    nw.attObjs = []; nw.attKey = key; nw.laserObj = null; nw.hasOptic = false; nw.sight.copy(M.sight); nw.anchors.muzzle.position.copy(M.muzzle);
    if (P.optic0) P.optic0.visible = true;
    if (M.rest) { nw.poses.rest.p.copy(M.rest.p); nw.poses.rest.q.copy(M.rest.q); nw.poses.rest.f.set(M.rest.f); }
    const small = nw.def.slot === 1 ? .78 : 1;
    for (const id of list) {
      const A = attModel(id);
      if (id === 'dot' || id === 'holo' || id === 'x4') {
        const host = nw.def.slot === 1 && P.slide ? P.slide : P.optic0 && P.optic0.parent !== nw.root ? P.optic0.parent : nw.root, pv = host === nw.root ? _v.set(0, 0, 0) : _v.copy(host.position);
        const s = nw.def.slot === 1 ? .82 : 1, o = place(nw, id, host, M.opticX - pv.x, M.opticV - pv.y, -M.opticU - pv.z); o.scale.setScalar(s);
        nw.sight.set(M.opticX, M.opticV + A.sight.y * s, -(M.opticU + A.sight.z * -s)); nw.hasOptic = true;
        if (P.optic0) P.optic0.visible = false;
      } else if (id === 'sup' || id === 'comp' || id === 'hider') {
        const o = place(nw, id, nw.root, M.muzzle.x, M.muzzle.y, M.muzzle.z); o.scale.setScalar(small);
        nw.anchors.muzzle.position.z = M.muzzle.z - A.len * small;
      } else if (id === 'ext' || id === 'fast') {
        const tall = id === 'ext' ? clamp(nw.def.mag * .0016 + .03, .036, .07) : .012;
        if (M.mag) {
          const o = place(nw, id, P.mag, M.mag.x, M.mag.y + .002, M.mag.z); o.scale.set(M.mag.sx, tall, M.mag.sz);
          if (nw.dropMag) { const c = o.clone(true); nw.dropMag.add(c); nw.attObjs.push(c); }
        } else {     // tube magazine: a longer cap under the barrel
          const o = place(nw, id, nw.root, 0, M.sv - .004, -(M.su + .15)); o.scale.set(.03, .03, .09); o.position.y += .015;
        }
      } else if (id === 'vg' || id === 'ag') {
        place(nw, id, nw.root, 0, M.under + .002, -(M.su + (id === 'ag' ? .012 : .03)));
        if (id === 'vg' && nw.poses.rest) { const g = foreGripPose(M.su + .03, M.under - .045); nw.poses.rest.p.copy(g.p); nw.poses.rest.q.copy(g.q); nw.poses.rest.f.set(g.f); }
      } else if (id === 'laser') {
        const o = place(nw, id, nw.root, M.railX + .0085, M.railV, -M.railU);
        const e = new THREE.Object3D(); e.position.copy(V(A.emit[0], A.emit[1])); o.add(e); nw.laserObj = e;
      }
    }
  };
  return { attModel, fitAttachments, lib: attLib };
}

/* ---------- arsenal preview ----------
   The real weapon model, drawn with the game's own WebGL context into an offscreen target and copied to a 2D canvas:
   no second context exists. Everything it allocates (materials, textures, geometry, targets, programs) is released by dispose(). */
export function createWeaponPreview(renderer, canvas, baseDef) {
  const gl = renderer.getContext(); if (!gl || gl.isContextLost()) throw new Error('no WebGL context');
  const ctx2d = canvas.getContext('2d', { alpha: false }), W = canvas.width, H = canvas.height;
  const mats = makeMaterials(), fitter = attachmentFitter(mats), skin = createSkinner(mats), scene = new THREE.Scene(), pivot = new THREE.Group(); scene.add(pivot);
  scene.add(new THREE.HemisphereLight(0xcfdcec, 0x5b4d3a, 1.25));
  const key = new THREE.DirectionalLight(0xffe2bd, 2.9); key.position.set(1.4, 2.6, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb9cfff, 1.1); rim.position.set(-2.4, 1.2, -2.2); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(22, W / H, .05, 12);
  const w = buildWeapon(baseDef, mats); pivot.add(w.root); w.attObjs = [];
  for (const n of ['held']) if (w.parts[n]) w.parts[n].visible = false;
  if (w.cfg.animate) { const rest = {}; for (const key of [...IN_KEYS, 'lhZ', 'rhZ', 'beltAttach', 'heldShell', 'shellPush', 'held', 'lhY']) rest[key] = 0; w.cfg.animate(w, rest, 0, null, 0, 0); }       // string, drum and rounds in their ready pose
  if (Number.isFinite(baseDef.col)) mats.paint.color.setHex(baseDef.col).lerp(new THREE.Color(0x55564c), .18);
  const half = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const hdr = new THREE.WebGLRenderTarget(W, H, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 4 }), ldr = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
  const blitMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: hdr.texture } }, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=vec2(uv.x,1.-uv.y);gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: 'uniform sampler2D t;varying vec2 vUv;vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}void main(){vec4 c=texture2D(t,vUv);vec2 p=vUv-.5;float r=dot(p,p);vec3 bg=mix(vec3(.105,.115,.095),vec3(.018,.02,.02),clamp(r*3.,0.,1.));vec3 col=aces(c.rgb*1.05)+bg*(1.-clamp(c.a,0.,1.));gl_FragColor=vec4(pow(col,vec3(1./2.2)),1.);}',
  });
  const blitScene = new THREE.Scene(), blitCam = new THREE.Camera(), blitGeo = new THREE.PlaneGeometry(2, 2), blit = new THREE.Mesh(blitGeo, blitMat); blit.frustumCulled = false; blitScene.add(blit);
  const pixels = new Uint8ClampedArray(W * H * 4), image = new ImageData(pixels, W, H), _clear = new THREE.Color(), box = new THREE.Box3(), tmpB = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3();
  let alive = true, dirty = true, raf = 0, last = 0, yaw = -Math.PI / 2, pitch = .1, holdUntil = 0, sway = 0, slow = 0, frames = 0, spent = 0, autoOn = true, ready = false, dist = 1;
  const frameIt = () => {
    box.makeEmpty(); w.root.updateWorldMatrix(true, true);
    w.root.traverse(o => { if (!o.isMesh) return; for (let p = o; p && p !== w.root; p = p.parent) if (!p.visible) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tmpB.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(tmpB); });
    if (box.isEmpty()) return;
    pivot.worldToLocal(box.getCenter(mid)); box.getSize(size); w.root.position.sub(mid);
    const long = Math.max(size.x, size.z), vf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    dist = Math.max(long / (2 * vf * cam.aspect), size.y / (2 * vf)) * 1.14 + long * .08; cam.near = Math.max(.02, dist - long); cam.far = dist + long + .5; cam.updateProjectionMatrix();
  };
  const draw = () => {
    const prev = renderer.getRenderTarget(), ac = renderer.autoClear, ca = renderer.getClearAlpha(); renderer.getClearColor(_clear);
    try {
      pivot.rotation.set(pitch, yaw + sway, 0, 'XYZ'); cam.position.set(0, 0, dist); cam.lookAt(0, 0, 0);
      renderer.autoClear = true; renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(hdr); renderer.render(scene, cam);
      renderer.setRenderTarget(ldr); renderer.render(blitScene, blitCam);
      renderer.readRenderTargetPixels(ldr, 0, 0, W, H, pixels);
    } finally { renderer.setRenderTarget(prev); renderer.autoClear = ac; renderer.setClearColor(_clear, ca); }
    ctx2d.putImageData(image, 0, 0);
  };
  const tick = now => {
    if (!alive) return; raf = requestAnimationFrame(tick);
    if (!ready || document.hidden || now - last < 40) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (autoOn && now > holdUntil) { slow += dt; sway = Math.sin(slow * .55) * .5; dirty = true; }
    if (!dirty || gl.isContextLost()) return; dirty = false;
    const t0 = performance.now(); draw(); spent += performance.now() - t0;
    if (++frames === 24) { if (spent / frames > 22) autoOn = false; frames = 0; spent = 0; }       // a slow machine keeps the preview, it only stops the idle motion
  };
  let compiling = null;       // three's compileAsync polls each material's program: freeing one before it is linked throws in its timer (shop-ui.js createStudio has the same wait)
  const api = {
    get stats() { return { W, H, autoOn, ready }; },
    /** Resolves true when the shaders are linked and the first image is on the canvas. */
    async start(def) {
      api.setDef(def);
      const prev = renderer.getRenderTarget(); let wait;
      try { renderer.setRenderTarget(hdr); wait = renderer.compileAsync ? renderer.compileAsync(scene, cam) : null; renderer.setRenderTarget(ldr); renderer.compile(blitScene, blitCam); } finally { renderer.setRenderTarget(prev); }
      if (wait) { compiling = Promise.resolve(wait).catch(() => {}); await Promise.race([compiling, new Promise(r => setTimeout(r, 6000))]); }
      if (!alive || gl.isContextLost()) return false;
      draw(); ready = true; last = performance.now(); raf = requestAnimationFrame(tick); return true;
    },
    setDef(def) { if (!alive) return; fitter.fitAttachments(w, def); frameIt(); dirty = true; },
    /** Weapon finish (weapon-skins.js), null = factory look. */
    setFinish(id) { if (!alive) return; skin.apply(w, id); dirty = true; },
    rotate(dx, dy) { yaw += dx; pitch = clamp(pitch + dy, -.7, .7); holdUntil = performance.now() + 2600; dirty = true; },
    dispose() {
      if (!alive) return; alive = false; cancelAnimationFrame(raf);
      if (compiling) { const c = compiling; compiling = null; Promise.race([c, new Promise(r => setTimeout(r, 8000))]).then(api.dispose2); return; }       // freed once the compile has settled (8 s at most)
      api.dispose2();
    },
    dispose2() {
      skin.dispose();
      const geos = new Set(), collect = root => root.traverse(o => { if (o.isMesh) geos.add(o.geometry); });
      collect(w.root); for (const e of fitter.lib.values()) collect(e.root); geos.add(blitGeo); for (const g of geos) g.dispose();
      const tex = new Set(); for (const m of Object.values(mats)) { for (const k of ['map', 'roughnessMap', 'envMap']) if (m[k]) tex.add(m[k]); m.dispose(); }
      for (const t of tex) t.dispose(); blitMat.dispose(); hdr.dispose(); ldr.dispose(); key.dispose(); rim.dispose();
    },
  };
  return api;
}

/* ---------- arms ---------- */
const FINGERS = [[.0285, .082, .0102, .043, .029, .023, .05], [.0095, .087, .0108, .047, .031, .024, .012], [-.0098, .084, .0102, .043, .029, .023, -.03], [-.0285, .075, .0092, .034, .024, .02, -.085]];
function handGeometry(s) {
  const pts = [[-.032, .004], [.032, .004], [.041, .036], [.04, .08], [.024, .095], [-.024, .095], [-.039, .08], [-.04, .034]].map(p => [p[0] * s, p[1]]);
  const sh = outline(new THREE.Shape(), pts, .012);
  const palm = new THREE.ExtrudeGeometry(sh, { depth: .022, bevelEnabled: true, bevelThickness: .005, bevelSize: .004, bevelOffset: -.004, bevelSegments: 2, curveSegments: 4 });
  palm.translate(0, 0, -.011);
  const list = [palm];
  const cuff = new THREE.CylinderGeometry(.039, .036, .05, 12); cuff.scale(1, 1, .72); cuff.translate(0, -.012, 0); list.push(cuff);
  const strap = new THREE.BoxGeometry(.074, .014, .05); strap.translate(0, -.01, 0); list.push(strap);
  const pad = new THREE.SphereGeometry(.024, 10, 8); pad.scale(.95, 1.25, .62); pad.translate(s * .021, .034, .012); list.push(pad);
  const heel = new THREE.SphereGeometry(.023, 10, 8); heel.scale(1.05, .9, .58); heel.translate(-s * .017, .028, .012); list.push(heel);
  for (let i = 0; i < 4; i++) { const kn = new THREE.BoxGeometry(.017, .018, .008); kn.translate(s * FINGERS[i][0], FINGERS[i][1] - .006, -.016); list.push(kn); }
  const bar = new THREE.BoxGeometry(.066, .024, .005); bar.translate(0, .052, -.017); list.push(bar);
  const g = mergeGeometries(list.map(x => x.index ? x.toNonIndexed() : x), false);
  return g;
}
function fingerGeometry() {
  const g = new THREE.CapsuleGeometry(.5, 1, 3, 8); g.translate(0, 1, 0); g.scale(1, .5, 1); return g;
}
function sleeveGeometry() {
  const pts = [[.035, 0], [.046, .004], [.048, .05], [.052, .1], [.05, .16], [.056, .24], [.054, .32], [.061, .42], [.059, .52], [.067, .66], [.07, .82], [.074, 1]].map(p => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(pts, 14); g.scale(1, 1, .86); return g;
}

/* ---------- module-level scratch (no per-frame allocation) ---------- */
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _el2 = new THREE.Vector3();
/* stage -> reaction of the whole weapon [up, pitch, roll, back], applied to the recoil springs */
const IMPACT = {
  magOut: [-1.4, -1.1, .9, .2], magIn: [3.6, 2.6, -1.5, 1.2], magTap: [1.5, 1.1, -.5, .5], pouch: [0, 0, 0, 0],
  boltBack: [.3, .8, .5, 1.6], boltForward: [-.7, -1.3, .6, -1.6], slideBack: [.2, .9, .4, 1.4], slideForward: [-.6, -1.5, .5, -1.5],
  pump: [.3, .6, .3, 1], shell: [.7, .5, -.3, .5], cylOpen: [.2, .3, 1.1, 0], cylEject: [.6, 1, 0, 0], cylLoad: [.8, .5, -.4, .4], cylClose: [.6, -.5, -1.4, 0],
  breakOpen: [-1.2, -1.6, .4, .2], breakClose: [2.4, 2.2, -.6, .4], rocketIn: [1, 1, -.4, 1.6], rocketLock: [1.2, .7, -.5, .4],
  grenadeIn: [.8, .6, -.3, .5], stringDraw: [0, -.6, 0, .6], stringLatch: [.6, .8, -.3, .3], boltPlace: [.5, .4, -.2, .2],
};
const HOLSTER = .13;
/* inertial blending channels: any interrupted motion glides from what was on screen to the new target */
const IN_KEYS = ['slide', 'bolt', 'boltRot', 'pump', 'cover', 'handle', 'magSeat', 'cyl', 'rod', 'brk', 'draw', 'rigX', 'rigY', 'rigZ', 'rigRX', 'rigRY', 'rigRZ'];
const IN_RIG = 0, IN_HL = 6, IN_HR = 9, IN_FL = 12, IN_FR = 17, IN_MAG = 22, IN_ANIM = 25, IN_N = IN_ANIM + IN_KEYS.length, IN_W = 26;
const _up = new THREE.Vector3(0, 1, 0), _e = new THREE.Euler(), _right = new THREE.Vector3(), _fwd = new THREE.Vector3(), _camUp = new THREE.Vector3();

/* ---------- view model ---------- */
export function createViewModel(camera, scene) {
  const mats = makeMaterials();
  const group = new THREE.Group(); group.name = 'viewmodel'; camera.add(group);
  const rig = new THREE.Group(); rig.scale.setScalar(RIG_SCALE); group.add(rig);
  const weapons = new Map();
  let w = null;

  /* arms */
  const mkHand = s => {
    const g = new THREE.Group(); rig.add(g);
    const palm = new THREE.Mesh(handGeometry(s), mats.glove); palm.frustumCulled = false; g.add(palm);
    const sl = new THREE.Mesh(sleeveGeometry(), mats.sleeve); sl.frustumCulled = false; rig.add(sl);
    return { s, g, sl, p: new THREE.Vector3(), q: new THREE.Quaternion(), f: new Float32Array(5) };
  };
  const handR = mkHand(1), handL = mkHand(-1);
  const elbowR = new THREE.Vector3(.2, -.42, .36), elbowL = new THREE.Vector3(-.34, -.42, .22);
  const fingers = new THREE.InstancedMesh(fingerGeometry(), mats.glove, 28);
  fingers.frustumCulled = false; fingers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); rig.add(fingers);
  const heldShell = new THREE.Group(); handL.g.add(heldShell); heldShell.position.set(0, .1, .03); heldShell.rotation.x = .6;
  { const a = new THREE.CylinderGeometry(.0105, .0105, .054, 10), b = new THREE.CylinderGeometry(.0112, .0112, .014, 10); b.translate(0, -.03, 0);
    const m1 = new THREE.Mesh(a, new THREE.MeshStandardMaterial({ color: 0x96241d, roughness: .55, fog: false })), m2 = new THREE.Mesh(b, new THREE.MeshStandardMaterial({ color: 0xc79a48, metalness: .9, roughness: .4, envMap: mats.brass.envMap, fog: false }));
    m1.frustumCulled = m2.frustumCulled = false; heldShell.add(m1, m2); heldShell.visible = false; }

  /* hand grenade held in the left hand: prebuilt with the shared materials, so the first throw compiles and allocates nothing */
  const nadeKit = new Kit({ ...mats, paint: mats.olive }); BUILDERS.frag(nadeKit); nadeKit.build();
  const nade = nadeKit.root, nadePin = nadeKit.parts.pin, nadePinBase = nadePin.userData.base.clone(), nadeWorld = new THREE.Vector3();
  nade.position.set(.006, .15, .024); nade.visible = false; handL.g.add(nade);
  const gkey = (t, px, py, pz, yx, yy, yz, zx, zy, zz, f, hold = false) => {
    const Y = new THREE.Vector3(yx, yy, yz).normalize(), Z = new THREE.Vector3(zx, zy, zz).normalize(), X = new THREE.Vector3().crossVectors(Y, Z);
    const k = poseFrom(new THREE.Vector3(px, py, pz), X, Y, f); k.t = t; k.hold = hold; k.m = new THREE.Vector3(); return k;
  };
  /* key frames in camera space (seconds after the key press): reach down, grab, bring up, pin, wind up, release at .5, follow through, back */
  const GK = [
    gkey(0, -.2, -.24, -.42, .4, .1, -.9, .9, .1, .4, [.8, .85, .9, .9, .5], true),
    gkey(.15, -.3, -.42, -.22, .12, -.75, -.65, .92, -.12, .36, [.3, .32, .35, .35, .25], true),
    gkey(.185, -.3, -.43, -.22, .12, -.75, -.65, .92, -.12, .36, [.95, 1, 1.02, 1.02, .75], true),
    gkey(.3, -.17, -.17, -.37, .34, .72, -.6, .88, -.42, .2, [.95, 1, 1.02, 1.02, .75], true),
    gkey(.355, -.21, -.15, -.37, .34, .72, -.6, .88, -.42, .2, [.95, 1, 1.02, 1.02, .8]),
    gkey(.45, -.25, -.03, -.3, .12, .9, .42, .2, .4, -.9, [.95, 1, 1.02, 1.02, .8]),
    gkey(.5, -.13, .02, -.47, .12, .42, -.9, .1, -.9, -.42, [.7, .72, .75, .75, .5]),
    gkey(.62, -.02, -.21, -.43, .35, -.5, -.8, .4, -.8, .42, [.25, .28, .3, .3, .2]),
    gkey(.8, -.17, -.28, -.42, .45, .08, -.88, .88, .1, .45, [.6, .65, .7, .7, .4]),
    gkey(.95, -.2, -.24, -.42, .4, .1, -.9, .9, .1, .4, [.8, .85, .9, .9, .5], true),
  ];
  for (let i = 1; i < GK.length - 1; i++) if (!GK[i].hold) GK[i].m.subVectors(GK[i + 1].p, GK[i - 1].p).divideScalar(GK[i + 1].t - GK[i - 1].t);
  const NADE_EV = [[.16, 'grenadeGrab'], [.32, 'pinPull'], [.5, 'throw'], [.515, 'spoon']], NADE_END = .95;
  const gren = { active: false, t: 0, ev: 0, cb: null, thrown: false, keys: GK, evs: NADE_EV, end: NADE_END, x: null };       // x: an equipment gesture (engine-gear.js) played on the same hand path
  const tmpNade = { p: new THREE.Vector3(), q: new THREE.Quaternion(), f: new Float32Array(5) };
  const sampleNade = (T, out) => {
    const K = gren.keys; let i = 0; while (i < K.length - 2 && T >= K[i + 1].t) i++;
    const a = K[i], b = K[i + 1], h = b.t - a.t, r = sat((T - a.t) / h), r2 = r * r, r3 = r2 * r;
    const h00 = 2 * r3 - 3 * r2 + 1, h10 = (r3 - 2 * r2 + r) * h, h01 = 3 * r2 - 2 * r3, h11 = (r3 - r2) * h;
    out.p.set(h00 * a.p.x + h10 * a.m.x + h01 * b.p.x + h11 * b.m.x, h00 * a.p.y + h10 * a.m.y + h01 * b.p.y + h11 * b.m.y, h00 * a.p.z + h10 * a.m.z + h01 * b.p.z + h11 * b.m.z);
    const k = r2 * (3 - 2 * r); out.q.slerpQuaternions(a.q, b.q, k);
    for (let j = 0; j < 5; j++) out.f[j] = mix(a.f[j], b.f[j], k);
  };
  const stopNade = done => {
    gren.active = false; gren.cb = null; nade.visible = false; inMark = true;
    const x = gren.x; if (x) { gren.x = null; gren.keys = GK; gren.evs = NADE_EV; gren.end = NADE_END; if (x.prop) x.prop.visible = false; if (x.onEnd) { try { x.onEnd(done === true); } catch (e) { console.warn('[viewmodel] gesture', e); } } }
  };

  /* muzzle flash + light */
  const flashTex = flashTexture();
  const flashMat = new THREE.MeshBasicMaterial({ map: flashTex, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false, forceSinglePass: true });
  const flashGeo = (() => {
    const a = new THREE.PlaneGeometry(1, 1), b = new THREE.PlaneGeometry(1.7, .62), c = new THREE.PlaneGeometry(1.7, .62);
    b.rotateY(Math.PI / 2); b.translate(0, 0, -.72); c.rotateY(Math.PI / 2); c.rotateZ(Math.PI / 2); c.translate(0, 0, -.72);
    return mergeGeometries([a, b, c], false);
  })();
  const flash = new THREE.Mesh(flashGeo, flashMat); flash.frustumCulled = false; flash.visible = false; flash.renderOrder = 6;
  const light = new THREE.PointLight(0xffc27a, 0, 8, 2); rig.add(light);
  let flashT = 0, flashSize = .3;

  /* casings (world-space, pooled) */
  const CASES = 36;
  const caseGeo = (() => {
    const b = new THREE.CylinderGeometry(.0052, .0058, .026, 8), n = new THREE.CylinderGeometry(.0034, .0052, .007, 8); n.translate(0, .0165, 0);
    return mergeGeometries([b.toNonIndexed(), n.toNonIndexed()], false);
  })();
  const caseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .85, roughness: .38, envMap: mats.brass.envMap, fog: false });
  const cases = new THREE.InstancedMesh(caseGeo, caseMat, CASES);
  cases.frustumCulled = false; cases.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cases.count = CASES;
  _m.makeScale(0, 0, 0); _c.setHex(0xc79a48);
  for (let i = 0; i < CASES; i++) { cases.setMatrixAt(i, _m); cases.setColorAt(i, _c); }
  scene.add(cases);
  const cP = new Float32Array(CASES * 3), cV = new Float32Array(CASES * 3), cR = new Float32Array(CASES * 3), cW = new Float32Array(CASES * 3), cL = new Float32Array(CASES), cS = new Float32Array(CASES), cF = new Float32Array(CASES);
  let cNext = 0, casesLive = false;

  /* smoke (world-space, one Points draw) */
  const SMOKE = 56;
  const sPos = new Float32Array(SMOKE * 3), sData = new Float32Array(SMOKE * 2), sV = new Float32Array(SMOKE * 3), sL = new Float32Array(SMOKE), sM = new Float32Array(SMOKE), sB = new Float32Array(SMOKE);
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  smokeGeo.setAttribute('aData', new THREE.BufferAttribute(sData, 2).setUsage(THREE.DynamicDrawUsage));
  const smokeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uH: { value: 800 } },
    vertexShader: 'attribute vec2 aData;varying float vA;uniform float uH;void main(){vA=aData.y;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aData.y>0.?clamp(aData.x*uH*projectionMatrix[1][1]/max(.05,-mv.z),1.,220.):0.;}',
    fragmentShader: 'varying float vA;void main(){vec2 p=gl_PointCoord-.5;float r=dot(p,p)*4.;if(r>1.)discard;float n=.82+.18*sin(gl_PointCoord.x*17.+gl_PointCoord.y*11.);float a=pow(1.-r,1.6)*vA*n;gl_FragColor=vec4(vec3(.62,.61,.58),a);}',
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat); smoke.frustumCulled = false; smoke.renderOrder = 5; scene.add(smoke);
  let sNext = 0, smokeLive = false;

  /* springs */
  const sp = {
    z: new Spring(150, .62), y: new Spring(170, .66), pitch: new Spring(135, .56), yaw: new Spring(150, .6), roll: new Spring(130, .55),
    swayX: new Spring(70, .72), swayY: new Spring(70, .72), swayR: new Spring(55, .7), tilt: new Spring(60, .8), land: new Spring(95, .48), block: new Spring(110, .86), dead: new Spring(34, .9),
  };
  const anim = { slide: 0, bolt: 0, boltRot: 0, pump: 0, cover: 0, handle: 0, lhZ: 0, rhZ: 0, magSeat: 0, beltAttach: 0, heldShell: 0, shellPush: 0,
    cyl: 0, rod: 0, brk: 0, draw: 0, held: 0, lhY: 0, rigX: 0, rigY: 0, rigZ: 0, rigRX: 0, rigRY: 0, rigRZ: 0 };
  const clearAnim = () => { for (const key in anim) anim[key] = 0; };
  const tmpPose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), f: new Float32Array(5) };
  const action = { s: null, t: 0, dur: 1, idx: 0, kind: '' };
  let time = Math.random() * 10, bob = 0, bobAmt = 0, wasGrounded = true, cyc = 1, raise = 1, lastSign = 1, trigger = 0, sprintK = 0, sleeveK = 0;
  let spinT = 0, spinV = 0, spinKick = 0;

  /* inertial blending */
  const inX = new Float32Array(IN_N), inV = new Float32Array(IN_N), inLast = new Float32Array(IN_N), inLastV = new Float32Array(IN_N);
  const qOffL = new THREE.Quaternion(), qOffR = new THREE.Quaternion(), qOffM = new THREE.Quaternion(), qLastL = new THREE.Quaternion(), qLastR = new THREE.Quaternion(), qLastM = new THREE.Quaternion();
  let inMark = false, inFresh = true, inNow = false, inDt = 0, inE = 1, qW = 0, qWv = 0;
  const ch = (i, cur) => {
    if (inFresh) { inX[i] = inV[i] = inLastV[i] = 0; inLast[i] = cur; return cur; }
    if (inNow) { inX[i] = inLast[i] - cur; inV[i] = inLastV[i] * .6; }
    let out = cur;
    if (inX[i] !== 0 || inV[i] !== 0) {
      const j = (inV[i] + IN_W * inX[i]) * inDt, nx = (inX[i] + j) * inE; inV[i] = (inV[i] - IN_W * j) * inE; inX[i] = nx;
      if (Math.abs(nx) < 1e-5 && Math.abs(inV[i]) < 1e-4) inX[i] = inV[i] = 0;
      out = cur + inX[i];
    }
    if (inDt > 0) inLastV[i] = clamp((out - inLast[i]) / inDt, -12, 12);
    inLast[i] = out; return out;
  };
  const chQ = (q, off, last) => {
    if (inFresh) { off.identity(); last.copy(q); return; }
    if (inNow) off.copy(last).multiply(_q2.copy(q).invert());
    if (qW > 0) { _q3.identity().slerp(off, qW); q.premultiply(_q3); }
    last.copy(q);
  };
  const chHand = (h, ip, ifg, off, last) => {
    h.p.x = ch(ip, h.p.x); h.p.y = ch(ip + 1, h.p.y); h.p.z = ch(ip + 2, h.p.z);
    for (let j = 0; j < 5; j++) h.f[j] = ch(ifg + j, h.f[j]);
    chQ(h.q, off, last);
  };

  /* weapon swap: holster, then draw from the same low pose */
  const pend = { def: null, outfit: null, t: 0, reload: false, rd: 0, re: false }; let drawDue = false;

  /* dropped magazine */
  const dropV = new THREE.Vector3(), dropW = new THREE.Vector3(); let dropT = 0, dropOwner = null, magGone = false;

  /* ---------- helpers ---------- */
  const samplePose = (stops, t, out, side = -1) => {
    let i = 0; while (i < stops.length - 2 && t >= stops[i + 1][0]) i++;
    const a = stops[i], b = stops[i + 1], A = a[1], B = b[1], span = b[0] - a[0], r = span > 0 ? sat((t - a[0]) / span) : 1;
    if (A === B) { out.p.copy(A.p); out.q.copy(A.q); for (let j = 0; j < 5; j++) out.f[j] = A.f[j]; return; }
    const kp = mj(r), kq = mj(sat(r * 1.16 - .12)), kf = mj(sat(r * 1.3 - .3));     // the wrist turns a little after the arm leaves, the fingers close last
    out.p.lerpVectors(A.p, B.p, kp); out.q.slerpQuaternions(A.q, B.q, kq);
    const d = A.p.distanceTo(B.p), arc = Math.sin(kp * Math.PI);
    if (d > .02) {
      /* curved path, out to the hand's own side: from under the gun to over it, it must go around the receiver */
      const across = (A.p.y + .012) * (B.p.y + .012) < 0;
      out.p.x += side * arc * Math.max(d * .2, across ? .16 : 0); out.p.z += arc * d * .1;
    }
    const open = d > .05 ? arc * .3 : 0;
    for (let j = 0; j < 5; j++) out.f[j] = mix(A.f[j], B.f[j], kf) * (1 - open);
  };
  const setHand = (h, src) => { h.p.copy(src.p); h.q.copy(src.q); for (let j = 0; j < 5; j++) h.f[j] = src.f[j]; };
  const writeFinger = (idx, M, r, L) => { _m3.makeScale(r * 2, L * 1.26, r * 2); _m2.multiplyMatrices(M, _m3); fingers.setMatrixAt(idx, _m2); };
  const poseFingers = (h, base, trig) => {
    h.g.position.copy(h.p); h.g.quaternion.copy(h.q); h.g.updateMatrix();
    let idx = base; const W = h.g.matrix, s = h.s;
    for (let i = 0; i < 4; i++) {
      const F = FINGERS[i], c = h.f[i] + (i === 0 ? trig : 0);
      _m.makeTranslation(F[0] * s, F[1], .002); _m.premultiply(W);
      _m3.makeRotationZ(-F[6] * s); _m.multiply(_m3);
      for (let j = 0; j < 3; j++) {
        _m3.makeRotationX(c * (j === 0 ? .92 : j === 1 ? 1.12 : .78)); _m.multiply(_m3);
        const L = F[3 + j]; writeFinger(idx++, _m, F[2] * (1 - j * .07), L);
        _m3.makeTranslation(0, L, 0); _m.multiply(_m3);
      }
    }
    const t = h.f[4];
    _m.makeTranslation(s * .032, .03, .014); _m.premultiply(W);
    _m3.makeRotationZ(-s * (.86 - t * .28)); _m.multiply(_m3);
    _m3.makeRotationX(.45 + t * .55); _m.multiply(_m3);
    writeFinger(idx++, _m, .0118, .04); _m3.makeTranslation(0, .04, 0); _m.multiply(_m3);
    _m3.makeRotationX(t * .62); _m.multiply(_m3); _m3.makeRotationZ(s * t * .2); _m.multiply(_m3);
    writeFinger(idx++, _m, .0105, .032);
  };
  const poseSleeve = (h, elbow) => {
    _v.copy(h.p); _v2.set(0, -.024, 0).applyQuaternion(h.q); _v.add(_v2);
    _v2.subVectors(elbow, _v); const d = _v2.length() || .001; _v2.divideScalar(d);
    h.sl.position.copy(_v); h.sl.quaternion.setFromUnitVectors(_up, _v2); h.sl.scale.set(1, d, 1);
  };
  const spawnCasing = (kind) => {
    if (!w) return;
    const i = cNext; cNext = (cNext + 1) % CASES;
    const src = kind === 1 && w.anchors.drop ? w.anchors.drop : w.anchors.eject;
    src.updateWorldMatrix(true, false); _v.setFromMatrixPosition(src.matrixWorld);
    const e = camera.matrixWorld.elements;
    _right.set(e[0], e[1], e[2]); _camUp.set(e[4], e[5], e[6]); _fwd.set(-e[8], -e[9], -e[10]);
    const j = () => (Math.random() - .5);
    cP[i * 3] = _v.x; cP[i * 3 + 1] = _v.y; cP[i * 3 + 2] = _v.z;
    const r = kind === 1 ? j() * .5 : 1.9 + j() * .8, u = kind === 1 ? -.3 + j() * .4 : 1.5 + j() * .7, b = kind === 1 ? -.5 + j() * .4 : -.35 + j() * .5;
    cV[i * 3] = _right.x * r + _camUp.x * u + _fwd.x * b; cV[i * 3 + 1] = _right.y * r + _camUp.y * u + _fwd.y * b; cV[i * 3 + 2] = _right.z * r + _camUp.z * u + _fwd.z * b;
    cR[i * 3] = Math.random() * 6; cR[i * 3 + 1] = Math.random() * 6; cR[i * 3 + 2] = Math.random() * 6;
    cW[i * 3] = 9 + j() * 16; cW[i * 3 + 1] = j() * 22; cW[i * 3 + 2] = 14 + j() * 16;
    const hull = w.def.id === 'sg' || !!w.feel.hull;
    cL[i] = 1.5; cS[i] = (w.feel.casing || w.feel.dropSize || 1) * (hull ? 1.25 : 1); cF[i] = camera.getWorldPosition(_v2).y - 1.5;
    _c.setHex(hull ? 0xa22b22 : 0xd4a44f); cases.setColorAt(i, _c); cases.instanceColor.needsUpdate = true;
    casesLive = true;
  };
  const puff = (n, size) => {
    if (!w) return;
    w.anchors.muzzle.updateWorldMatrix(true, false); _v.setFromMatrixPosition(w.anchors.muzzle.matrixWorld);
    const e = camera.matrixWorld.elements; _fwd.set(-e[8], -e[9], -e[10]);
    for (let c = 0; c < n; c++) {
      const i = sNext; sNext = (sNext + 1) % SMOKE;
      sPos[i * 3] = _v.x + (Math.random() - .5) * .03; sPos[i * 3 + 1] = _v.y + (Math.random() - .5) * .03; sPos[i * 3 + 2] = _v.z + (Math.random() - .5) * .03;
      const f = .35 + Math.random() * .85;
      sV[i * 3] = _fwd.x * f + (Math.random() - .5) * .34; sV[i * 3 + 1] = _fwd.y * f + .18 + Math.random() * .3; sV[i * 3 + 2] = _fwd.z * f + (Math.random() - .5) * .34;
      sM[i] = .75 + Math.random() * .75; sL[i] = sM[i]; sB[i] = size * (.05 + Math.random() * .05);
      sData[i * 2] = sB[i]; sData[i * 2 + 1] = .001;
    }
    smokeLive = true;
  };
  const startAction = (script, dur, delay, kind) => {
    action.s = script; action.t = -delay; action.dur = Math.max(.15, dur); action.idx = 0; action.kind = kind;
    vm.reloading = kind === 'reload'; inMark = true;
  };
  const endAction = () => { action.s = null; action.kind = ''; vm.reloading = false; inMark = true; };
  const emit = (name) => {
    if (name.charCodeAt(0) === 36) { if (!gren.active) spawnCasing(name === '$drop' ? 1 : 0); return; }
    const im = IMPACT[name];
    if (im && w) { const k = 1 / w.feel.weight; sp.y.v += im[0] * k; sp.pitch.v += im[1] * k; sp.roll.v += im[2] * k; sp.z.v += im[3] * k; }
    if (gren.active && name !== 'shell' && name !== 'grenadeGrab' && name !== 'pinPull' && name !== 'throw' && name !== 'spoon' && name !== 'draw' && name !== 'holster') return;      // the left hand is busy: no magazine sounds under the throw
    if (typeof vm.onSound === 'function') vm.onSound(name);
  };
  const { attModel, fitAttachments } = attachmentFitter(mats);
  const skin = createSkinner(mats); let finMap = null;        // weapon finishes: shared finished materials, chosen by material role
  /* premium outfit: knuckle guards, back plate and wrist strap on both hands. Purely visual: a failure leaves the plain glove. */
  const setHandKit = fp => { try { for (const h of [handR, handL]) { if (fp && !h.kit) { h.kit = new THREE.Mesh(fp.handKit(h.s), fp.kitMat); h.kit.frustumCulled = false; h.g.add(h.kit); } if (h.kit) { h.kit.visible = !!fp; if (fp) { h.kit.geometry = fp.handKit(h.s); h.kit.material = fp.kitMat; } } } } catch (e) { console.warn('[outfit] hand kit', e); } };
  const doEquip = (def, outfit) => {
    const known = BUILDERS[def.id] ? def : { ...def, id: def.slot === 1 ? 'p9' : 'ar' };
    let nw = weapons.get(known.id);
    if (!nw) { nw = buildWeapon(known, mats); nw.root.visible = false; nw.root.matrixWorldAutoUpdate = false; rig.add(nw.root); weapons.set(known.id, nw); }
    if (w && w !== nw) { w.root.visible = false; w.root.matrixWorldAutoUpdate = false; }       // a hidden weapon is not walked by updateMatrixWorld every frame
    nw.root.matrixWorldAutoUpdate = true; nw.root.updateMatrixWorld(true);
    if (dropOwner) { dropOwner.dropMag.visible = false; dropOwner = null; dropT = 0; }
    if (w && w.parts.mag && magGone) w.parts.mag.visible = true;
    magGone = false;
    fitAttachments(nw, def);
    try { skin.apply(nw, finMap ? finMap[def.id] : null); } catch (e) { console.warn('[guns] finish', e); }
    w = nw; w.def = def; w.root.visible = true;
    if (Number.isFinite(def.col)) mats.paint.color.setHex(def.col).lerp(_c.setHex(0x55564c), .18);
    if (outfit && outfit.fp) {       // premium outfit: its own sleeves and gloves (outfit-kit.js)
      mats.sleeve.map = outfit.fp.map; mats.sleeve.needsUpdate = true; mats.glove.color.setHex(outfit.fp.glove);
    } else if (outfit && outfit.c) {
      mats.sleeve.map = camoTexture(outfit.c); mats.sleeve.needsUpdate = true;
      mats.glove.color.setHex(0x26231e).lerp(_c.setHex(outfit.c[1]), .14);
    } else if (!mats.sleeve.map) { mats.sleeve.map = camoTexture([0x59633e, 0x3a4429, 0x7b7650]); mats.sleeve.needsUpdate = true; }
    setHandKit(outfit && outfit.fp);
    w.anchors.muzzle.add(flash); flash.visible = false; flashSize = w.feel.flash * (def.flashK ?? 1); flashT = 0; flashMat.opacity = 0;
    w.anchors.muzzle.getWorldPosition(_v); light.position.copy(w.anchors.muzzle.position);
    action.s = null; action.kind = ''; vm.reloading = false; vm.scoped = false; heldShell.visible = false; clearAnim();
    for (const key in sp) if (key !== 'dead') sp[key].reset();
    raise = 1; cyc = 1; sprintK = 0; sleeveK = 0; setHand(handR, w.poses.grip); setHand(handL, w.poses.rest); inFresh = true; inMark = false; qW = 0; qWv = 0;
  };
  const finishSwap = () => {
    const d = pend.def, o = pend.outfit, again = pend.reload, rd = pend.rd, re = pend.re;
    pend.def = null; pend.reload = false; doEquip(d, o); emit('draw');
    if (again) vm.reload(rd, re);
  };

  /* ---------- public API ---------- */
  const vm = {
    group, reloading: false, scoped: false, onSound: () => {},
    /** Builds a weapon's viewmodel without equipping it (no animation, no visibility change): used to spread the build of every weapon over idle time. Returns true if it built one. */
    prebuild(def) {
      if (!def) return false; const known = BUILDERS[def.id] ? def : { ...def, id: def.slot === 1 ? 'p9' : 'ar' };
      if (weapons.has(known.id)) return false;
      const nw = buildWeapon(known, mats); nw.root.visible = false; nw.root.matrixWorldAutoUpdate = false; rig.add(nw.root); weapons.set(known.id, nw); return true;
    },
    equip(def, outfit) {
      if (!def) return;
      pend.def = null; pend.reload = false;       // a throw in progress survives a weapon change (loot pickup): only cancelGrenade() or death stops it
      doEquip(def, outfit);
    },
    /* in-match weapon change: the current weapon is lowered first, the new one comes up from the same pose */
    switchTo(def, outfit) {
      if (!def) return;
      if (!w || !group.visible) { vm.equip(def, outfit); drawDue = true; return; }
      if (action.s) endAction();
      const was = !!pend.def;
      pend.def = def; pend.outfit = outfit; pend.reload = false;
      if (!was) { pend.t = 0; inMark = true; emit('holster'); }
    },
    fire() {
      if (!w) return;
      const f = w.feel, sign = (lastSign = -lastSign), rk = w.def.recK ?? 1;
      sp.z.v += f.kz * 9 * (.9 + Math.random() * .2) * rk;
      sp.y.v += f.kz * 1.3 * rk;
      sp.pitch.v += f.kp * 8 * (.9 + Math.random() * .25) * rk;
      sp.yaw.v += f.ky * 8 * (sign * .6 + (Math.random() - .5) * .9) * rk;
      sp.roll.v += f.kr * 8 * (sign * .55 + (Math.random() - .5) * .9) * rk;
      cyc = 0; trigger = 1;
      if (flashSize > 0) {
        flash.visible = true; flashT = 1; flash.rotation.z = Math.random() * 6.28;
        const sc = flashSize * 1.75 * (.82 + Math.random() * .4); flash.scale.set(sc, sc, sc * (1.05 + Math.random() * .4));
        flashMat.opacity = 1; light.intensity = 3.2 + flashSize * 11;
      }
      if (f.smoke > 0 && (w.def.flashK ?? 1) > 0) puff(f.smoke > 1 ? 4 : 2, f.smoke);
      if (w.cfg.onFire) w.cfg.onFire(w);
      if (w.cfg.spin) spinKick = 1;
      if (w.scripts.act) { if (!vm.reloading) startAction(w.scripts.act[w.st.n++ % w.scripts.act.length], f.act.dur, 0, 'cycle'); }
      else if (f.manual) { if (!vm.reloading) startAction(w.scripts.cycle, f.manual.dur, f.manual.delay, 'cycle'); }
      else if (f.casing > 0) spawnCasing(0);
    },
    reload(duration, empty) {
      if (!w) return;
      if (pend.def) { pend.reload = true; pend.rd = Math.max(.25, (Number.isFinite(duration) ? duration : pend.def.reload || 1.5) - (pend.def.id === 'sg' ? 0 : HOLSTER - pend.t)); pend.re = empty; return; }
      const rs = empty ? w.scripts.empty : w.scripts.tac; if (!rs) return;
      startAction(rs, Number.isFinite(duration) ? duration : w.def.reload || 1.5, 0, 'reload');
    },
    cancelReload() { pend.reload = false; if (vm.reloading) { heldShell.visible = false; endAction(); } },
    /* G: full throw gesture. onRelease(handWorldPos) is called once, on the 'throw' stage, unless death or a reset cancels it first. */
    throwGrenade(onRelease) {
      if (gren.active || !w) return false;
      gren.active = true; gren.t = 0; gren.ev = 0; gren.cb = onRelease || null; gren.thrown = false;
      nade.visible = false; nadePin.position.copy(nadePinBase); nadePin.rotation.set(0, 0, 0); nadePin.visible = true; inMark = true;
      return true;
    },
    cancelGrenade() { if (gren.active) stopNade(); },
    /* equipment gesture on the grenade's hand path. s = {keys (from gestureTrack) or null for the throw path, ev [[t, name]], end, prop, onEvent(name), onFrame(T), onEnd(finished), elbow(T, v) optional} */
    playGesture(s) {
      if (gren.active || !w) return false;
      gren.active = true; gren.t = 0; gren.ev = 0; gren.cb = null; gren.thrown = false; gren.x = s; gren.keys = s.keys || GK; gren.evs = s.ev || NADE_EV; gren.end = s.end || NADE_END;
      nade.visible = false; inMark = true; return true;
    },
    /* a track from plain arrays: [t, px, py, pz, yx, yy, yz, zx, zy, zz, [5 fingers], hold] in camera space */
    gestureTrack(list) { const K = list.map(a => gkey(...a)); for (let i = 1; i < K.length - 1; i++) if (!K[i].hold) K[i].m.subVectors(K[i + 1].p, K[i - 1].p).divideScalar(K[i + 1].t - K[i - 1].t); return K; },
    /* parents an equipment model to the left hand, hidden, at the grenade's grip point */
    mountProp(o) { o.visible = false; handL.g.add(o); return o; },
    get gestureOn() { return !!gren.x; },
    get grenadeBusy() { return gren.active; },
    /* true from the key press until the grenade has left the hand */
    get throwPending() { return gren.active && !gren.thrown; },
    get grenadeTime() { return gren.active ? gren.t : -1; },
    /* read-only snapshot for the animation tests */
    debugState(o) {
      o.lp = handL.p; o.lq = handL.q; o.rp = handR.p; o.rq = handR.q; o.rigP = rig.position; o.rigQ = rig.quaternion;
      o.mag = w && w.parts.mag ? w.parts.mag : null; o.nade = nade; o.w = w; o.script = action.s; o.t = action.s ? action.t / action.dur : 0; o.kind = action.kind; return o;
    },
    /* optional: 0..1 barrel spin for rotary guns (the barrels also spin up by themselves while firing) */
    spin(amount) { spinT = sat(Number.isFinite(amount) ? amount : 0); },
    /* optional: rounds left in the current weapon, so single-shot visuals (rocket, bolt, grenade) match the ammo count */
    setAmmo(n) { if (w && !pend.def) { w.st.loaded = n > 0; if (n > 0) w.st.drawn = true; } },
    /* bow: 0..1 how far the string is drawn */
    setPull(k) { if (w) w.st.pull = sat(Number.isFinite(k) ? k : 0); },
    /* world position of the mounted laser's emitter; false when this weapon has none */
    laserPoint(target) {
      if (!w || !w.laserObj || !group.visible) return false;
      w.laserObj.updateWorldMatrix(true, false); target.setFromMatrixPosition(w.laserObj.matrixWorld); return true;
    },
    /* builds every accessory model now, so mounting one in a match creates no geometry */
    /** { weaponId: finishId } of the local player; read on every equip. */
    setFinishes(map) { finMap = map || null; },
    attachmentIds() { return Object.keys(ATT_MODEL); },
    prebuildAttachment(id) { attModel(id); },
    muzzle(target) {
      if (!w) return camera.getWorldPosition(target);
      w.anchors.muzzle.updateWorldMatrix(true, false);
      return target.setFromMatrixPosition(w.anchors.muzzle.matrixWorld);
    },
    update(dtIn, st) {
      if (!w) return;
      const dt = clamp(Number.isFinite(dtIn) ? dtIn : 0, 0, .05);
      let hol = 0;
      if (drawDue) { drawDue = false; emit('draw'); }
      if (pend.def) { pend.t += dt; hol = mj(sat(pend.t / HOLSTER)); if (pend.t >= HOLSTER) finishSwap(); }
      const f = w.feel, ads = f.noAim ? 0 : sat(st?.ads ?? 0), a = ads * ads * (3 - 2 * ads);
      const speed = Number.isFinite(st?.speed) ? st.speed : 0, grounded = st?.grounded !== false, sliding = !!st?.sliding, blocked = sat(st?.blocked ?? 0), dead = !!st?.dead;
      const yawD = Number.isFinite(st?.yawDelta) ? st.yawDelta : 0, pitchD = Number.isFinite(st?.pitchDelta) ? st.pitchDelta : 0;
      time += dt;
      if (dead && gren.active) stopNade();

      /* inertial blending for this frame */
      inNow = inMark; inMark = false; inDt = dt; inE = Math.exp(-IN_W * dt);
      if (inNow && !inFresh) { qW = 1; qWv = 0; }
      if (qW > 0) { const j = (qWv + IN_W * qW) * dt; qW = (qW + j) * inE; qWv = (qWv - IN_W * j) * inE; if (qW < .0005) qW = qWv = 0; }

      /* action timeline */
      clearAnim();
      let script = action.s;
      if (script) {
        action.t += dt;
        const n = action.t / action.dur;
        while (action.idx < script.ev.length && n >= script.ev[action.idx][0]) emit(script.ev[action.idx++][1]);
        if (n >= 1) {
          while (action.idx < script.ev.length) emit(script.ev[action.idx++][1]);
          endAction(); script = null; inNow = true; if (!inFresh) { qW = 1; qWv = 0; }
        } else if (action.s === script) script.run(anim, sat(n));
        else script = action.s;
      }
      const t = script ? sat(action.t / action.dur) : 0;
      for (let i = 0; i < IN_KEYS.length; i++) { const key = IN_KEYS[i]; anim[key] = ch(IN_ANIM + i, anim[key]); }

      /* hands */
      if (script) samplePose(script.lh, t, tmpPose, -1); else { tmpPose.p.copy(w.poses.rest.p); tmpPose.q.copy(w.poses.rest.q); tmpPose.f.set(w.poses.rest.f); }
      setHand(handL, tmpPose);
      if (script && script.rh) samplePose(script.rh, t, tmpPose, 1); else { tmpPose.p.copy(w.poses.grip.p); tmpPose.q.copy(w.poses.grip.q); tmpPose.f.set(w.poses.grip.f); }
      setHand(handR, tmpPose);

      /* mechanical parts */
      const P = w.parts;
      cyc = Math.min(1, cyc + dt / f.cycle);
      const blow = cyc < 1 ? Math.sin(Math.min(1, cyc * 1.05) * Math.PI) : 0;
      if (P.slide) P.slide.position.z = P.slide.userData.base.z + Math.max(blow, anim.slide) * f.travel;
      if (P.bolt) {
        const manualBolt = f.manual ? 0 : blow;
        P.bolt.position.z = P.bolt.userData.base.z + Math.max(manualBolt, anim.bolt) * f.travel;
        if (w.def.id === 'sr' || w.cfg.boltTurn) P.bolt.rotation.z = anim.boltRot * 1.2;
      }
      if (P.handle) P.handle.position.z = P.handle.userData.base.z + anim.handle * (w.cfg.handle || .06);
      if (P.pump) { const o = anim.pump * f.travel; P.pump.position.z = P.pump.userData.base.z + o; if (!script || !script.rh) handL.p.z += o; if (P.bolt && w.def.id === 'sg') P.bolt.position.z = P.bolt.userData.base.z + o * .86; }
      if (P.cover) P.cover.rotation.x = -anim.cover * 1.22;
      if (anim.lhZ) handL.p.z += anim.lhZ;
      if (anim.lhY) handL.p.y += anim.lhY;
      if (anim.rhZ) { handR.p.z += anim.rhZ * f.travel; if (anim.boltRot) handR.p.y += anim.boltRot * .012; }
      if (w.cfg.pullLen && w.st.pull) handR.p.z += w.st.pull * w.cfg.pullLen;       // bow: the right hand holds the string
      chHand(handL, IN_HL, IN_FL, qOffL, qLastL); chHand(handR, IN_HR, IN_FR, qOffR, qLastR);
      if (P.mag) {
        const b = P.mag.userData.base, carried = !!(script && script.attach && !gren.active && t >= script.attach[0] && t <= script.attach[1]);
        if (carried) {       // rigid in the hand: the magazine turns with the wrist and meets the magwell exactly at the seat pose
          _q2.copy(w.poses.mag.q).invert(); _q3.multiplyQuaternions(handL.q, _q2);
          _v.copy(b).sub(w.poses.mag.p).applyQuaternion(_q3).add(handL.p); P.mag.quaternion.copy(_q3);
        } else { _v.copy(b); P.mag.quaternion.identity(); }
        _v.y += anim.magSeat * .004;
        P.mag.position.set(ch(IN_MAG, _v.x), ch(IN_MAG + 1, _v.y), ch(IN_MAG + 2, _v.z));
        chQ(P.mag.quaternion, qOffM, qLastM);
        const gone = !!(script && script.drop && !gren.active && t >= script.drop[0] && t < script.drop[1]);
        if (gone && !magGone && w.dropMag) {
          const d = w.dropMag; d.position.copy(P.mag.position); d.quaternion.copy(P.mag.quaternion); d.visible = true;
          dropV.set(-.22, -.75, .12); dropW.set(3.6, .9, -2.8); dropT = .6; dropOwner = w;
        }
        if (gone !== magGone) { magGone = gone; P.mag.visible = !gone; }
      }
      if (dropT > 0 && dropOwner) {
        const d = dropOwner.dropMag; dropT -= dt; dropV.y -= 5.2 * dt; d.position.addScaledVector(dropV, dt);
        _e.set(dropW.x * dt, dropW.y * dt, dropW.z * dt); _q.setFromEuler(_e); d.quaternion.multiply(_q);
        if (dropT <= 0) { d.visible = false; dropOwner = null; }
      }
      if (P.belt) {
        const b = P.belt.userData.base, m = P.mag;
        if (anim.beltAttach) { P.belt.position.set(b.x + m.position.x - m.userData.base.x, b.y + m.position.y - m.userData.base.y, b.z + m.position.z - m.userData.base.z); P.belt.quaternion.copy(m.quaternion); }
        else { P.belt.position.copy(b); P.belt.rotation.set(blow * .018, 0, blow * .03); P.belt.position.y += blow * .0016; }
      }
      heldShell.visible = anim.heldShell > 0 && !gren.active;
      if (P.held) { const on = anim.held > 0 && !gren.active; P.held.visible = on; if (on) { P.held.position.copy(handL.p); P.held.quaternion.copy(handL.q); } }
      spinKick = Math.max(0, spinKick - dt * 3);
      const spinGoal = Math.max(spinT, spinKick > 0 ? 1 : 0);
      spinV += (spinGoal - spinV) * (1 - Math.exp(-dt * (spinGoal > spinV ? 7 : 1.8)));
      if (w.cfg.spin && P.barrels) P.barrels.rotation.z = (P.barrels.rotation.z + spinV * w.cfg.spin * dt) % (Math.PI * 2);
      if (w.cfg.animate) w.cfg.animate(w, anim, dt, script, t, time);

      /* fingers */
      trigger = Math.max(0, trigger - dt * 14);
      poseFingers(handR, 0, trigger * .24);
      poseFingers(handL, 14, 0);
      fingers.instanceMatrix.needsUpdate = true;
      poseSleeve(handR, elbowR); poseSleeve(handL, elbowL);
      const hideL = !!w.cfg.oneHand && !gren.active && !(script && script.lhShow && script.lhShow(t));
      if (handL.g.visible === hideL) handL.g.visible = handL.sl.visible = !hideL;
      if (hideL) { _m.makeScale(0, 0, 0); for (let i = 14; i < 28; i++) fingers.setMatrixAt(i, _m); }

      /* springs */
      const rate = dt > 0 ? 1 / Math.max(dt, 1 / 240) : 0, weight = f.weight;
      const yr = clamp(yawD * rate, -7, 7), pr = clamp(pitchD * rate, -7, 7);
      sp.swayX.step(dt, -yr * .0135 / weight); sp.swayY.step(dt, -pr * .0115 / weight); sp.swayR.step(dt, yr * .022);
      sp.z.step(dt); sp.y.step(dt); sp.pitch.step(dt); sp.yaw.step(dt); sp.roll.step(dt);
      sp.tilt.step(dt, sliding ? 1 : 0); sp.land.step(dt); sp.block.step(dt, blocked); sp.dead.step(dt, dead ? 1 : 0);
      if (grounded && !wasGrounded) sp.land.v -= clamp(.9 + speed * .05, .9, 1.5);
      wasGrounded = grounded;

      /* locomotion */
      const moving = grounded && !sliding ? clamp(speed / 6.5, 0, 1.45) : 0;
      bobAmt += (moving - bobAmt) * (1 - Math.exp(-dt * 9));
      bob += dt * (3.2 + speed * 1.28);
      const free = 1 - a, bx = Math.cos(bob) * .0105 * bobAmt, by = -Math.abs(Math.sin(bob)) * .0125 * bobAmt, br = Math.cos(bob) * .018 * bobAmt;
      sprintK += (seg(7.5, 11, speed) * (grounded ? 1 : .4) - sprintK) * (1 - Math.exp(-dt * 12));
      const sprint = sprintK * free;
      const br1 = Math.sin(time * 1.35), br2 = Math.sin(time * .73 + 1.1);
      const recoilK = mix(1, .46, a);
      raise = Math.max(0, raise - dt / .42); const up = pend.def ? hol : raise * raise * (3 - 2 * raise);
      let reloadAmt = 0;
      if (script) {
        if (action.kind === 'reload') reloadAmt = mj(t / .13) * (1 - mj((t - .86) / .14)) - Math.sin(Math.PI * sat(t / .09)) * .13 - Math.sin(Math.PI * sat((t - .91) / .09)) * .07;      // small anticipation, then a settle past the rest pose
        else reloadAmt = mj(t / .16) * (1 - mj((t - .82) / .18));
      }
      const tilt = script ? script.tilt : null;

      /* hip -> ADS */
      const S = RIG_SCALE, sg = w.sight;
      const fixedAim = f.aim && !w.hasOptic, eye = w.hasOptic ? clamp(f.eye, .3, .44) : f.eye;       // the eye stays behind a mounted optic, at a distance where it fills a sensible part of the screen
      const ax = fixedAim ? f.aim[0] : -S * sg.x, ay = fixedAim ? f.aim[1] : -S * sg.y, az = fixedAim ? f.aim[2] : -eye - S * sg.z;
      let x = mix(f.hip[0], ax, a), y = mix(f.hip[1], ay, a) - Math.sin(a * Math.PI) * .012, z = mix(f.hip[2], az, a);
      const bodyX = x, bodyY = y, bodyZ = z;
      x += (sp.swayX.x + bx) * (1 - a * .88) + sp.tilt.x * -.028 * free - sprint * .045;
      y += (sp.swayY.x + by) * (1 - a * .88) + (br1 * .0017) * free + sp.land.x * .04 * (1 - a * .6) + sp.y.x * .018 * recoilK - sprint * .03;
      z += sp.z.x * .082 * recoilK + sprint * .022;
      let rx = sp.pitch.x * .105 * recoilK + sp.swayY.x * -1.4 * (1 - a * .9) + br2 * .0046 * free + sp.land.x * -.05 * (1 - a * .7) - sprint * .16;
      let ry = sp.yaw.x * .07 * recoilK + sp.swayX.x * 1.6 * (1 - a * .9) + sprint * .34;
      let rz = sp.roll.x * .09 * recoilK + sp.swayR.x * (1 - a * .9) + br * (1 - a * .9) + sp.tilt.x * .34 * free - a * (1 - a) * .22 + sprint * .1;
      if (tilt) { rx += tilt[0] * reloadAmt; ry += tilt[1] * reloadAmt; rz += tilt[2] * reloadAmt; y -= reloadAmt * .02; x -= reloadAmt * .03 * free; }
      if (f.rot) { rx += f.rot[0] * free; ry += f.rot[1] * free; rz += f.rot[2] * free; }
      x += anim.rigX; y += anim.rigY; z += anim.rigZ; rx += anim.rigRX; ry += anim.rigRY; rz += anim.rigRZ;
      /* grenade: the weapon dips aside while the left hand works, and follows the throw */
      if (gren.active) {
        const T = gren.t + dt, k = mj(T / .17) * (1 - mj((T - (gren.end - .35)) / .33)), sw = gren.x && gren.keys !== GK ? 0 : Math.sin(Math.PI * sat((T - .4) / .26));
        x += k * .05 + sw * .012; y -= k * .075; z += k * .035 - sw * .02; rx -= k * .24; ry -= k * .34; rz -= k * .44 - sw * .09;
      }
      /* wall block, raise, death */
      const bk = sat(sp.block.x);
      y -= bk * .075; z += bk * .15; x += bk * .03; rx -= bk * .82; ry += bk * .18;
      y -= up * .3; rx -= up * 1.05; rz -= up * .3;
      const dd = sat(sp.dead.x);
      y -= dd * .55; rx -= dd * 1.1; rz += dd * .35;
      if (vm.pose) { const q = vm.pose; x += q[0]; y += q[1]; z += q[2]; rx += q[3]; ry += q[4]; rz += q[5]; }       // hud-motion.js: inspect and idle breathing
      x = ch(IN_RIG, x); y = ch(IN_RIG + 1, y); z = ch(IN_RIG + 2, z); rx = ch(IN_RIG + 3, rx); ry = ch(IN_RIG + 4, ry); rz = ch(IN_RIG + 5, rz);
      rig.position.set(x, y, z);
      _e.set(rx, ry, rz, 'YXZ'); rig.quaternion.setFromEuler(_e);
      if (anim.rigX !== 0 || anim.rigY !== 0 || anim.rigZ !== 0 || anim.rigRX !== 0 || anim.rigRY !== 0 || anim.rigRZ !== 0) {
        /* scripted rig motion (slash, throw, tilt): the elbows stay where the resting rig holds them, so the arm bends instead of travelling with the weapon */
        _e.set(rx - anim.rigRX, ry - anim.rigRY, rz - anim.rigRZ, 'YXZ'); _q.setFromEuler(_e); _qi.copy(rig.quaternion).invert();
        _el.copy(elbowR).multiplyScalar(S).applyQuaternion(_q); _el.x -= anim.rigX; _el.y -= anim.rigY; _el.z -= anim.rigZ; _el.applyQuaternion(_qi).divideScalar(S); poseSleeve(handR, _el);
        _el.copy(elbowL).multiplyScalar(S).applyQuaternion(_q); _el.x -= anim.rigX; _el.y -= anim.rigY; _el.z -= anim.rigZ; _el.applyQuaternion(_qi).divideScalar(S); poseSleeve(handL, _el);
      }
      /* during a reload the elbows stay with the body while the weapon tilts: the arms bend, and the sleeve ends never swing into view */
      sleeveK += ((script && action.kind === 'reload' ? 1 : 0) - sleeveK) * (1 - Math.exp(-dt * 16));
      if (sleeveK > .002) {
        _qi.copy(rig.quaternion).invert();
        _el2.copy(elbowR).multiplyScalar(S); _el2.x += bodyX; _el2.y += bodyY; _el2.z += bodyZ; _el2.sub(rig.position).applyQuaternion(_qi).divideScalar(S); _el.copy(elbowR).lerp(_el2, sleeveK); poseSleeve(handR, _el);
        _el2.copy(elbowL).multiplyScalar(S); _el2.x += bodyX; _el2.y += bodyY; _el2.z += bodyZ; _el2.sub(rig.position).applyQuaternion(_qi).divideScalar(S); _el.copy(elbowL).lerp(_el2, sleeveK); poseSleeve(handL, _el);
      }
      inFresh = false; inNow = false;

      /* grenade gesture: the left hand follows a path in camera space, whatever the weapon is doing */
      if (gren.active) {
        gren.t += dt; const T = gren.t;
        const k = mj(T / .1) * (1 - mj((T - (gren.end - .21)) / .21));
        sampleNade(T, tmpNade);
        _el2.copy(tmpNade.p); if (!(gren.x && gren.x.elbow && gren.x.elbow(T, _el2))) { _el2.copy(tmpNade.p); _el2.x -= .3; _el2.y -= .42; _el2.z += .23; }       // s.elbow(T, v): the gesture's own elbow (camera space, v holds the wrist), false = this default
        _qi.copy(rig.quaternion).invert();
        tmpNade.p.sub(rig.position).applyQuaternion(_qi).divideScalar(S); tmpNade.q.premultiply(_qi);
        handL.p.lerp(tmpNade.p, k); handL.q.slerp(tmpNade.q, k);
        for (let j = 0; j < 5; j++) handL.f[j] = mix(handL.f[j], tmpNade.f[j], k);
        inLast[IN_HL] = handL.p.x; inLast[IN_HL + 1] = handL.p.y; inLast[IN_HL + 2] = handL.p.z; inLastV[IN_HL] = inLastV[IN_HL + 1] = inLastV[IN_HL + 2] = 0;
        for (let j = 0; j < 5; j++) { inLast[IN_FL + j] = handL.f[j]; inLastV[IN_FL + j] = 0; }
        qLastL.copy(handL.q);
        if (!handL.g.visible) handL.g.visible = handL.sl.visible = true;
        poseFingers(handL, 14, 0); fingers.instanceMatrix.needsUpdate = true;
        _el2.sub(rig.position).applyQuaternion(_qi).divideScalar(S); _el.copy(elbowL).lerp(_el2, k); poseSleeve(handL, _el);
        if (gren.x) {
          const x = gren.x; if (x.onFrame) { try { x.onFrame(T); } catch (e) { console.warn('[viewmodel] gesture', e); } }
          while (gren.active && gren.x === x && gren.ev < gren.evs.length && T >= gren.evs[gren.ev][0]) { const name = gren.evs[gren.ev++][1]; if (name === 'throw') gren.thrown = true; if (x.onEvent) { try { x.onEvent(name); } catch (e) { console.warn('[viewmodel] gesture', e); } } }
          if (gren.active && gren.x === x && T >= gren.end) stopNade(true);
        } else if (!gren.thrown) {
          nade.visible = T >= NADE_EV[0][0];
          const pull = sat((T - .31) / .07);
          nadePin.position.copy(nadePinBase); nadePin.position.x -= mj(pull) * .05;
          if (T > .37) { const d = T - .37; nadePin.position.y -= d * d * 2.6; nadePin.position.x -= d * .05; nadePin.rotation.z = d * 9; nadePin.visible = T < .5; }
        }
        while (gren.active && !gren.x && gren.ev < NADE_EV.length && T >= NADE_EV[gren.ev][0]) {
          const name = NADE_EV[gren.ev++][1];
          if (name === 'throw') {
            nade.updateWorldMatrix(true, false); nadeWorld.setFromMatrixPosition(nade.matrixWorld);
            gren.thrown = true; nade.visible = false; nadePin.visible = false;
            const cb = gren.cb; gren.cb = null; if (cb) { try { cb(nadeWorld); } catch (e) { console.error('[viewmodel] throw', e); } }
          }
          emit(name);
        }
        if (gren.active && !gren.x && T >= NADE_END) stopNade();
      }

      /* flash */
      if (flashT > 0) {
        flashT = Math.max(0, flashT - dt / .05);
        flashMat.opacity = flashT * flashT;
        light.intensity *= Math.max(0, 1 - dt * 34);
        if (flashT <= 0) { flash.visible = false; light.intensity = 0; }
      } else if (light.intensity !== 0) light.intensity = 0;

      /* scope state */
      vm.scoped = !!w.def.scope && ads >= .92 && !vm.reloading && !dead && blocked < .5 && !gren.active;
      group.visible = !vm.scoped && dd < .95;
    },
    tick(dtIn) {
      const dt = clamp(Number.isFinite(dtIn) ? dtIn : 0, 0, .05);
      if (casesLive) {
        let live = false;
        for (let i = 0; i < CASES; i++) {
          if (cL[i] <= 0) continue;
          cL[i] -= dt;
          if (cL[i] <= 0) { _m.makeScale(0, 0, 0); cases.setMatrixAt(i, _m); continue; }
          live = true; const q = i * 3;
          cV[q + 1] -= 9.81 * dt;
          const d = Math.exp(-.45 * dt); cV[q] *= d; cV[q + 2] *= d;
          cP[q] += cV[q] * dt; cP[q + 1] += cV[q + 1] * dt; cP[q + 2] += cV[q + 2] * dt;
          cR[q] += cW[q] * dt; cR[q + 1] += cW[q + 1] * dt; cR[q + 2] += cW[q + 2] * dt;
          if (cP[q + 1] < cF[i]) {
            cP[q + 1] = cF[i]; cV[q + 1] = Math.abs(cV[q + 1]) * .36; cV[q] *= .55; cV[q + 2] *= .55;
            cW[q] *= .5; cW[q + 1] *= .5; cW[q + 2] *= .5;
            if (cV[q + 1] < .25) { cV[q + 1] = 0; cW[q] = cW[q + 1] = cW[q + 2] = 0; }
          }
          const fade = cL[i] < .2 ? cL[i] / .2 : 1, sc = cS[i] * fade;
          _e.set(cR[q], cR[q + 1], cR[q + 2], 'XYZ'); _q.setFromEuler(_e); _v.set(cP[q], cP[q + 1], cP[q + 2]); _s.set(sc, sc, sc);
          _m.compose(_v, _q, _s); cases.setMatrixAt(i, _m);
        }
        cases.instanceMatrix.needsUpdate = true; casesLive = live;
      }
      if (smokeLive) {
        let live = false;
        for (let i = 0; i < SMOKE; i++) {
          if (sL[i] <= 0) continue;
          sL[i] -= dt; const q = i * 3;
          if (sL[i] <= 0) { sData[i * 2 + 1] = 0; continue; }
          live = true;
          const d = Math.exp(-2.5 * dt); sV[q] *= d; sV[q + 1] = sV[q + 1] * d + .24 * dt; sV[q + 2] *= d;
          sPos[q] += sV[q] * dt; sPos[q + 1] += sV[q + 1] * dt; sPos[q + 2] += sV[q + 2] * dt;
          const k = 1 - sL[i] / sM[i];
          sData[i * 2] = sB[i] * (1 + k * 3.4); sData[i * 2 + 1] = .2 * Math.min(1, k * 8) * (1 - k) * (1 - k);
        }
        smokeGeo.attributes.position.needsUpdate = true; smokeGeo.attributes.aData.needsUpdate = true; smokeLive = live;
      }
    },
  };
  return vm;
}
