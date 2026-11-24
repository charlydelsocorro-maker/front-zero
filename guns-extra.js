/* FRONT ZÉRO — second wave of first-person weapons: models and clips. Registered into the BUILDERS and FEEL tables of guns.js.
   Original fictional designs. Gun space as in guns.js: u = forward, v = up, x = right. Everything is moulded: rounded extrusions
   with smooth normals, lathed barrels, real drums. No per-frame allocation: the clips only write numbers. */
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* Natural dark walnut: long, low-contrast grain running along the weapon (UVs follow the bore), a few pores, no bands. */
function walnutData(n = 256) {
  const d = new Uint8Array(n * n * 4); let s = 91;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s & 0xffff) / 0xffff; };
  const p1 = rnd() * 6.28, p2 = rnd() * 6.28, p3 = rnd() * 6.28;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const X = x / n * 6.2832, Y = y / n * 6.2832;
    const warp = Math.sin(X + p1) * .34 + Math.sin(X * 2 + Y + p2) * .13;       // periodic, so the texture tiles
    const broad = Math.sin(Y * 3 + warp * 2.2 + p3) * .5 + Math.sin(Y * 7 + warp * 3.1) * .22, fine = Math.sin(Y * 23 + warp * 5) * .14 + Math.sin(Y * 41 + warp * 7 + p1) * .08;
    const v = 205 + (broad + fine) * 15 + (rnd() - .5) * 7, q = (y * n + x) * 4;
    d[q] = Math.max(0, Math.min(255, v * 1.02)); d[q + 1] = Math.max(0, Math.min(255, v * .95)); d[q + 2] = Math.max(0, Math.min(255, v * .88)); d[q + 3] = 255;
  }
  for (let i = 0; i < 520; i++) {       // pores: short dark dashes along the grain
    let x = rnd() * n | 0; const y = rnd() * n | 0, L = 3 + rnd() * 11 | 0, k = .78 + rnd() * .12;
    for (let j = 0; j < L; j++, x = (x + 1) % n) { const q = (y * n + x) * 4; d[q] *= k; d[q + 1] *= k; d[q + 2] *= k; }
  }
  return { d, n };
}
/** Extra shared materials, added to the set made by makeMaterials() in guns.js. */
export function extraMaterials(std, dataTex) {
  const w = walnutData();
  return { walnut: std(0x3d2a1d, .03, .6, { map: dataTex(w.d, w.n, true) }) };
}
/** The moulded-geometry helpers, reusable by any builder once registerExtraGuns has run: soft (rounded side profile, smooth normals), bar (crowned cross-section along the bore), lathe, cap, ring, ball, barrel, disc, grip, stock, tubeStock, guard, brk, hider, can, mag, drumMag. */
export const MOULD = {};

export function registerExtraGuns(G) {
  const { THREE, BUILDERS, FEEL, outline, seg, mix, rel, rot2, triggerGroup, irons, holo, reflex, prism, scopeLong, action, shiftPose, sidePose, awayPose, supportPose, magReload, pistolReload, lmgReload, sniperReload, boltCycle, breakReload, nest } = G;

  /* ---------- moulded geometry ---------- */
  function soft(k, mat, pts, w, o = {}) {
    const b = Math.min(o.b ?? .0042, w * .42), s = outline(new THREE.Shape(), pts, o.r ?? .009);
    if (o.holes) for (const h of o.holes) s.holes.push(outline(new THREE.Path(), h, o.hr ?? .003));
    let g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.0004, w - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: o.bs ?? 3, curveSegments: o.cs ?? 5, steps: 1 });
    g.translate(0, 0, -(w - 2 * b) / 2); g.rotateY(Math.PI / 2); g.translate(o.x || 0, 0, 0);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-5); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return k.add(mat, g, o.wear ?? (mat === 'steel' || mat === 'nickel'));
  }
  /* a body with a real cross-section: crowned top, rounded shoulders, run along the bore (slides, upper receivers) */
  function bar(k, mat, u0, u1, v0, v1, w, o = {}) {
    const h = v1 - v0, t = w * (o.top ?? .7) / 2, c = o.crown ?? h * .24, hw = w / 2, b = o.b ?? .003;
    const s = outline(new THREE.Shape(), [[-hw, v0], [hw, v0], [hw, v1 - c], [t, v1], [-t, v1], [-hw, v1 - c]], o.r ?? Math.min(w, h) * .3);
    let g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, u1 - u0 - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 3, curveSegments: 6, steps: 1 });
    g.translate(o.x || 0, 0, -(u1 - b)); g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-5); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return k.add(mat, g, o.wear ?? (mat === 'steel' || mat === 'nickel'));
  }
  const lathe = (k, mat, u, prof, v = 0, x = 0, n = 18) => { const g = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[1], p[0])), n); g.rotateX(-Math.PI / 2); g.translate(x, v, -u); return k.add(mat, g); };
  const cap = (k, mat, u, v, len, r, x = 0) => { const g = new THREE.CapsuleGeometry(r, len, 3, 8); g.rotateX(-Math.PI / 2); g.translate(x, v, -u); return k.add(mat, g); };
  const ring = (k, mat, u, v, R, t, x = 0) => { const g = new THREE.TorusGeometry(R, t, 6, 26); g.rotateY(Math.PI / 2); g.translate(x, v, -u); return k.add(mat, g); };
  const ball = (k, mat, u, v, r, x = 0, sx = 1, sy = 1, sz = 1) => { const g = new THREE.SphereGeometry(r, 12, 9); g.scale(sx, sy, sz); g.translate(x, v, -u); return k.add(mat, g); };
  const barrel = (k, mat, u0, u1, v, r0, r1 = r0) => lathe(k, mat, u0, [[0, r0 * .9], [.002, r0], [u1 - u0 - .002, r1], [u1 - u0, r1 * .86]], v, 0, 18);
  function disc(k, mat, u, v, R, w, x = 0) {       // a thick wheel, axis along x, rounded rim
    const e = Math.min(.005, w * .3), P = [[-w / 2, 0], [-w / 2, R - e], [-w / 2 + e * .3, R - e * .3], [-w / 2 + e, R], [w / 2 - e, R], [w / 2 - e * .3, R - e * .3], [w / 2, R - e], [w / 2, 0]];
    const g = new THREE.LatheGeometry(P.map(p => new THREE.Vector2(p[1], p[0])), 30); g.rotateZ(-Math.PI / 2); g.translate(x, v, -u); return k.add(mat, g);
  }
  function grip(k, u, v, mat = 'poly', w = .034) {
    soft(k, mat, rel([[0, 0], [.044, 0], [.052, -.012], [.044, -.024], [.048, -.036], [.038, -.05], [.042, -.064], [.03, -.092], [.02, -.104], [-.024, -.1], [-.028, -.084], [-.012, -.03]], u, v), w, { r: .006, b: .0058 });
    for (let i = 0; i < 5; i++) cap(k, mat === 'walnut' ? 'dark' : 'rubber', u + .012 - i * .005, v - .034 - i * .013, .012, .0012, w / 2 - .0006);
    return [u + .014, v - .048, .3];
  }
  function stock(k, u, v, mat, len = .25, drop = .06, o = {}) {
    const w = o.w || .04;
    const holes = o.hole ? [rel([[-len * .32, -.012], [-len * .46, -drop * .52 - .014], [-len * .82, -drop * .82 - .012], [-len * .86, .006], [-len * .52, .008]], u, v)] : undefined;
    soft(k, mat, rel([[.004, .02], [-.012, -.05], [-.07, -.066], [-len * .6, -drop - .016], [-len, -drop - .024], [-len - .008, -drop + .02], [-len - .008, .02], [-len * .72, .03], [-len * .3, .024]], u, v), w, { r: .013, b: .0062, holes, hr: .008 });
    soft(k, 'rubber', rel([[-len - .004, .026], [-len - .02, .03], [-len - .024, -drop - .024], [-len - .004, -drop - .028]], u, v), w + .003, { r: .007, b: .0042 });
    if (o.cheek) soft(k, 'poly', rel([[-len * .3, .026], [-len * .74, .028], [-len * .74, .05], [-len * .34, .05]], u, v), w * .74, { r: .008, b: .004 });
  }
  function tubeStock(k, u, v, len = .17) {
    barrel(k, 'dark', u - len, u, v, .0125);
    soft(k, 'poly', rel([[-len + .05, .022], [-len - .002, .03], [-len - .012, -.072], [-len + .022, -.076], [-len + .05, -.018]], u, v), .036, { r: .012, b: .006 });
    soft(k, 'rubber', rel([[-len - .009, .032], [-len - .021, .034], [-len - .024, -.077], [-len - .009, -.077]], u, v), .039, { r: .006 });
  }
  function guard(k, mat, u0, u1, v, r, n = 6) {
    const L = u1 - u0; lathe(k, mat, u0, [[0, r * .78], [.006, r * .97], [.012, r], [L - .012, r], [L - .004, r * .94], [L, r * .76]], v, 0, 22);
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) cap(k, 'rubber', mix(u0 + .026, u1 - .026, (i + .5) / n), v + r * .32, L / n * .36, r * .13, s * r * .92);
  }
  function brk(k, u, v, r, len) {
    lathe(k, 'dark', u, [[0, r * .8], [.004, r], [len - .007, r], [len - .002, r * .9], [len, r * .62]], v, 0, 16);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) cap(k, 'rubber', u + len * (.26 + i * .23), v, len * .05, r * .34, s * r * .84);
  }
  function hider(k, u, v, r, len) {
    lathe(k, 'dark', u, [[0, r * .78], [.005, r * .92], [len * .55, r], [len, r * 1.08]], v, 0, 14);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .78; cap(k, 'rubber', u + len * .68, v + Math.sin(a) * r * .94, len * .28, r * .17, Math.cos(a) * r * .94); }
  }
  function can(k, u, v, r, len) {       // integral suppressor
    lathe(k, 'dark', u, [[0, r * .72], [.008, r], [len - .012, r], [len - .004, r * .92], [len, r * .55]], v, 0, 24);
    for (const a of [.1, .36, .62, .88]) ring(k, 'rubber', u + len * a, v, r * 1.002, .0011);
    ring(k, 'steel', u + .008, v, r * .99, .0016); ring(k, 'steel', u + len - .012, v, r * .96, .0016);
  }
  function mag(k, u, v, o = {}) {
    const len = o.len || .13, d = o.d || .055, w = o.w || .024, rake = o.rake || 0, curve = o.curve || 0, m = o.mat || 'steel', n = curve ? 7 : 2, ribs = o.ribs ?? 3;
    const cu = t => u + rake * t + curve * t * t, F = [], B = [];
    for (let i = 0; i <= n; i++) { const t = i / n; F.push([cu(t) + d / 2, v + .01 - t * (len + .01)]); B.push([cu(t) - d / 2, v + .01 - t * (len + .01)]); }
    k.part('mag', [u, v]);
    soft(k, m, [...F, ...B.reverse()], w, { r: .006, b: .0034 });
    for (let i = 1; i <= ribs; i++) { const t = i / (ribs + 1); for (const s of [-1, 1]) cap(k, 'dark', cu(t), v - t * len, d * .56, .0013, s * (w / 2 - .0002)); }
    soft(k, o.base || 'dark', rel([[-d / 2 - .004, 0], [d / 2 + .004, 0], [d / 2 + .002, -.012], [-d / 2 - .002, -.012]], cu(1), v - len + .003), w + .005, { r: .004, b: .0022 });
    k.box(o.shell ? 'red' : 'brass', cu(0) + d * .1, v + .0085, d * .6, .006, w * .42);
    return [cu(.8), v - len * .8];
  }
  function drumMag(k, u, v, R, w, o = {}) {
    k.part('mag', [u, v]);
    const cv = v - R - (o.neck ?? .016), m = o.mat || 'dark';
    soft(k, 'steel', rel([[-.021, .012], [.021, .012], [.019, -(o.neck ?? .016) - .022], [-.019, -(o.neck ?? .016) - .022]], u, v), .024, { r: .004, b: .002 });
    disc(k, m, u, cv, R, w);
    for (const s of [-1, 1]) { ring(k, 'steel', u, cv, R * .94, .0016, s * w * .46); ring(k, 'rubber', u, cv, R * .62, .0013, s * (w / 2 + .0002)); disc(k, 'steel', u, cv, R * .24, .004, s * (w / 2 + .001)); ball(k, 'brass', u, cv, R * .07, s * (w / 2 + .0032), .5, 1, 1); }
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; cap(k, 'rubber', u + Math.cos(a) * R * .998, cv + Math.sin(a) * R * .998, 0.001, .0017, 0); }
    return [u, cv - R * .9];
  }
  const finish = (k, u, v, eu, ev, ex) => { k.part('body'); k.anchor('muzzle', u, v); k.anchor('eject', eu, ev, ex); };
  Object.assign(MOULD, { soft, bar, lathe, cap, ring, ball, barrel, disc, grip, stock, tubeStock, guard, brk, hider, can, mag, drumMag });

  /* ---------- clips ---------- */
  const tilted = (s, tilt) => { s.tilt = tilt; return s; };
  const drumClips = w => ({ tac: tilted(magReload(w, false), [.13, .16, .46]), empty: tilted(magReload(w, true), [.14, .18, .5]) });
  const pistolClips = w => ({ tac: pistolReload(w, false), empty: pistolReload(w, true) });
  const LEVER = .95;
  function leverCycle(w) {
    const P = w.poses;
    return {
      ev: [[.26, 'boltBack'], [.36, '$eject0'], [.68, 'boltForward']], attach: null, tilt: [.05, .02, .1], lh: [[0, P.rest], [1, P.rest]],
      rh: [[0, P.grip], [.14, P.leverHand], [.74, P.leverHand], [.92, P.grip], [1, P.grip]],
      run(a, t) { a.brk = seg(.12, .36, t) * (1 - seg(.5, .78, t)); },
    };
  }
  /* rounds pushed one by one through the side gate, then the lever is worked when the gun was empty */
  function gateReload(w, empty, shells) {
    const P = w.poses, n = empty ? shells : Math.max(2, shells - 2), start = .06, end = empty ? .74 : .9, step = (end - start) / n, near = shiftPose(P.port, -.035, -.022), ports = new Float32Array(n), ev = [], lh = [[0, P.rest]];
    for (let i = 0; i < n; i++) {
      const a = start + step * i;
      lh.push([a + step * .22, P.pouch], [a + step * .32, P.pouch], [a + step * .66, near], [a + step * .78, P.port], [a + step * .87, P.port]);
      ports[i] = a + step * .78; ev.push([a + step * .22, 'pouch'], [ports[i], 'shell']);
    }
    if (empty) { lh.push([.8, P.rest], [1, P.rest]); ev.push([.84, 'boltBack'], [.87, '$eject0'], [.93, 'boltForward']); } else lh.push([.97, P.rest], [1, P.rest]);
    const rh = empty ? [[0, P.grip], [.76, P.grip], [.81, P.leverHand], [.95, P.leverHand], [.99, P.grip], [1, P.grip]] : null;
    const s = {
      ev, lh, attach: null, tilt: [.07, .14, .42],
      run(a, t) {
        a.heldShell = 0;
        for (let i = 0; i < n; i++) { const q = start + step * i, p = ports[i]; if (t >= q + step * .28 && t < p) a.heldShell = 1; a.lhZ += -.02 * seg(p - step * .07, p, t) * (1 - seg(p, p + step * .14, t)); }
        if (empty) a.brk = seg(.81, .86, t) * (1 - seg(.89, .95, t));
      },
    };
    if (rh) s.rh = rh;
    return s;
  }
  const leverAnim = (w, a) => { w.parts.lever.rotation.x = a.brk * LEVER; if (w.parts.hammer) w.parts.hammer.rotation.x = -a.brk * .5; };
  const leverPoses = (P, port) => ({ leverHand: shiftPose(P.grip, -.012, -.05), port: supportPose(port[0], port[1], .22, .72, .012) });
  /* a lever loop on its own part, pivot at the front of the guard */
  function leverLoop(k, pu, pv, mat = 'steel') {
    k.part('lever', [pu, pv]);
    const out = [[pu + .008, pv + .004], [pu + .008, pv - .018], [pu - .014, pv - .03], [pu - .068, pv - .03], [pu - .11, pv - .048], [pu - .15, pv - .05], [pu - .16, pv - .036], [pu - .15, pv - .012], [pu - .112, pv - .004], [pu - .056, pv + .002]];
    const hole = [[pu - .012, pv - .012], [pu - .058, pv - .012], [pu - .098, pv - .03], [pu - .142, pv - .036], [pu - .146, pv - .022], [pu - .112, pv - .014], [pu - .054, pv - .006], [pu - .014, pv - .004]];
    soft(k, mat, out, .0095, { r: .006, b: .0024, holes: [hole], hr: .004 });
    k.pin('dark', pu, pv, .0042, .014);
    k.part('body');
  }
  /* melee swings: each has its own arc */
  function chop(w) {         // axe: overhead, committed, slow recovery
    const P = w.poses;
    return { ev: [[.34, 'swing']], attach: null, tilt: [0, 0, 0], lh: [[0, P.rest], [1, P.rest]],
      run(a, t) {
        const wind = seg(0, .3, t) * (1 - seg(.3, .42, t)), k = seg(.3, .46, t) * (1 - seg(.62, 1, t));
        a.rigX = wind * .05 - k * .14; a.rigY = wind * .17 - k * .2; a.rigZ = wind * .1 - k * .22;
        a.rigRX = wind * .95 - k * 1.25; a.rigRZ = wind * .16 - k * .2; a.rigRY = -wind * .1 + k * .14;
      } };
  }
  function sweep(w, dir) {   // machete: long flat slash, one way then the other
    const P = w.poses;
    return { ev: [[.2, 'swing']], attach: null, tilt: [0, 0, 0], lh: [[0, P.rest], [1, P.rest]],
      run(a, t) {
        const wind = seg(0, .2, t) * (1 - seg(.2, .34, t)), k = seg(.2, .48, t) * (1 - seg(.6, 1, t));
        a.rigX = dir * (wind * .13 - k * .42); a.rigY = wind * .07 - k * .05; a.rigZ = wind * .05 - k * .14;
        a.rigRY = dir * (-wind * .5 + k * .8); a.rigRZ = dir * (-wind * .42 + k * 1.1); a.rigRX = -k * .32;
      } };
  }
  function hook(w) {          // crowbar: rising backhand with the hooked end
    const P = w.poses;
    return { ev: [[.28, 'swing']], attach: null, tilt: [0, 0, 0], lh: [[0, P.rest], [1, P.rest]],
      run(a, t) {
        const wind = seg(0, .26, t) * (1 - seg(.26, .4, t)), k = seg(.26, .5, t) * (1 - seg(.62, 1, t));
        a.rigX = wind * .16 - k * .3; a.rigY = -wind * .1 + k * .13; a.rigZ = wind * .04 - k * .2;
        a.rigRX = -wind * .5 + k * .7; a.rigRY = -wind * .3 + k * .5; a.rigRZ = wind * .7 - k * .8;
      } };
  }

  /* ---------- assault ---------- */
  function buildBPC(k) {      // Mistral B-2: swept one-piece bullpup shell, magazine behind the grip
    soft(k, 'paint', [[-.3, -.074], [-.3, .026], [-.275, .042], [-.02, .052], [.1, .046], [.19, .024], [.218, .002], [.212, -.02], [.09, -.032], [.056, -.044], [-.03, -.044], [-.062, -.052], [-.205, -.052], [-.23, -.078]], .05, { r: .017, b: .008 });
    soft(k, 'rubber', [[-.298, .028], [-.314, .032], [-.318, -.078], [-.297, -.078]], .052, { r: .007 });
    soft(k, 'poly', [[-.288, -.066], [-.232, -.07], [-.206, -.046], [-.07, -.04], [.04, -.034], [.12, -.024], [.17, -.012], [.19, .004], [.11, .022], [-.02, .03], [-.24, .026], [-.286, .016]], .0528, { r: .02, b: .0032 });       // grey overmould over the shell
    soft(k, 'paint', [[-.272, .048], [-.03, .058], [.07, .052], [.07, .04], [-.03, .044], [-.272, .036]], .03, { r: .006, b: .003 });
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) cap(k, 'rubber', -.262 + i * .017, -.018, .018, .0024, s * .0268);
    soft(k, 'dark', [[-.212, -.05], [-.1, -.05], [-.104, -.066], [-.206, -.07]], .04, { r: .004 });
    soft(k, 'poly', [[.07, -.03], [.2, -.018], [.196, -.044], [.1, -.056]], .043, { r: .011, b: .006 });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) cap(k, 'rubber', .112 + i * .022, -.004, .009, .0028, s * .0252);
    barrel(k, 'steel', .19, .33, .006, .0088, .0078); hider(k, .325, .006, .012, .05);
    k.rail(-.12, .14, .05, .02);
    const g = grip(k, -.058, -.044); triggerGroup(k, .014, -.044, 'paint');
    for (const u of [-.26, -.09, .16]) k.pin('steel', u, .004, .0034, .052);
    holo(k, 0, .0495);
    action(k, -.16, .014, .05, { side: [.12, .026] });
    const m = mag(k, -.152, -.058, { len: .15, d: .056, curve: .03, mat: 'poly', base: 'rubber', ribs: 4 });
    finish(k, .376, .006, -.16, .016, .026);
    return { grip: g, support: [.145, -.04], mag: m, charge: [.12, .028], handle: .06, sideCharge: true };
  }
  function buildCQC(k) {      // Furet C-11: stubby, round handguard, big flash can, sliding tube stock
    bar(k, 'paint', -.13, .112, -.014, .037, .043);
    soft(k, 'dark', [[-.12, -.012], [.098, -.012], [.092, -.04], [.054, -.05], [.04, -.04], [-.03, -.04], [-.058, -.054], [-.1, -.048], [-.12, -.03]], .037, { r: .007, b: .004 });
    guard(k, 'poly', .1, .235, .008, .0235, 4);
    k.rail(-.12, .225, .04, .02);
    barrel(k, 'steel', .22, .285, .008, .009); lathe(k, 'dark', .275, [[0, .0095], [.006, .0165], [.052, .0185], [.058, .0145]], .008, 0, 18);
    for (let i = 0; i < 4; i++) ring(k, 'rubber', .293 + i * .011, .008, .0178, .0011);
    const g = grip(k, -.056, -.04); triggerGroup(k, .015, -.04);
    k.pin('steel', -.094, -.022, .0034, .04); k.pin('steel', .082, -.026, .0034, .04);
    tubeStock(k, -.128, .008, .16);
    reflex(k, .02, .0395);
    action(k, .006, .012, .042, { rear: [-.14, .03] });
    const m = mag(k, .072, -.04, { len: .125, d: .052, curve: .036, ribs: 3 });
    finish(k, .335, .008, .006, .014, .021);
    return { grip: g, support: [.165, -.016], mag: m, charge: [-.14, .03], handle: .07 };
  }
  function buildHBR(k) {      // Massue HB-10: long, heavy, wood and steel, fat ribbed barrel
    bar(k, 'steel', -.16, .17, -.028, .041, .047, { b: .005 });
    soft(k, 'dark', [[-.15, -.026], [.15, -.026], [.144, -.052], [.066, -.062], [.05, -.05], [-.03, -.05], [-.058, -.064], [-.104, -.058], [-.15, -.04]], .041, { r: .007, b: .004 });
    soft(k, 'walnut', [[.165, -.034], [.44, -.026], [.452, -.012], [.446, .016], [.43, .024], [.165, .026]], .052, { r: .013, b: .0075 });
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) cap(k, 'dark', .2 + i * .04, -.002, .016, .0024, s * .0262);
    barrel(k, 'steel', .44, .63, .006, .0125, .0108);
    for (let i = 0; i < 4; i++) ring(k, 'dark', .47 + i * .034, .006, .0122, .0013);
    k.rail(-.14, .165, .044, .022);
    k.cyl('steel', .44, .5, .026, .004, .004, 0, 8); soft(k, 'dark', [[.492, -.006], [.512, -.006], [.512, .036], [.5, .04], [.492, .03]], .016, { r: .004, b: .002 });
    brk(k, .62, .006, .0162, .086);
    const g = grip(k, -.058, -.05, 'walnut', .034); triggerGroup(k, .014, -.05, 'dark');
    k.pin('steel', -.11, -.012, .0036, .05); k.pin('steel', .12, -.012, .0036, .05);
    stock(k, -.158, .006, 'walnut', .29, .066, { cheek: true, w: .043 });
    prism(k, -.015, .0475);
    action(k, .012, .014, .046, { side: [.11, .024] });
    const m = mag(k, .096, -.05, { len: .118, d: .074, w: .03, rake: -.008, ribs: 2 });
    finish(k, .71, .006, .012, .016, .024);
    return { grip: g, support: [.31, -.03], mag: m, charge: [.11, .026], handle: .074, sideCharge: true };
  }
  function buildSSR(k) {      // Murmure S-5: the whole barrel lives inside a long suppressor
    bar(k, 'paint', -.126, .122, -.016, .035, .041);
    soft(k, 'dark', [[-.116, -.014], [.104, -.014], [.098, -.04], [.058, -.05], [.044, -.04], [-.03, -.04], [-.056, -.054], [-.098, -.048], [-.116, -.03]], .036, { r: .007, b: .004 });
    soft(k, 'poly', [[.112, -.024], [.27, -.018], [.278, -.008], [.276, .018], [.264, .026], [.112, .028]], .041, { r: .012, b: .007 });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) cap(k, 'rubber', .142 + i * .032, .002, .012, .0028, s * .0208);
    can(k, .262, .006, .0225, .262);
    k.rail(-.116, .262, .0385, .02);
    const g = grip(k, -.056, -.04); triggerGroup(k, .015, -.04);
    k.pin('steel', -.09, -.02, .0034, .04); k.pin('steel', .09, -.024, .0034, .04);
    stock(k, -.124, .006, 'paint', .235, .054, { hole: true, w: .036 });
    irons(k, -.05, .25, .0595, 'ring');
    k.box('dark', .25, .043, .016, .01, .014);
    action(k, .006, .012, .04, { side: [.08, .022] });
    const m = mag(k, .078, -.04, { len: .13, d: .054, curve: .022, mat: 'poly', base: 'rubber', ribs: 3 });
    finish(k, .526, .006, .006, .014, .021);
    return { grip: g, support: [.2, -.026], mag: m, charge: [.08, .024], handle: .062, sideCharge: true };
  }

  /* ---------- SMG ---------- */
  function buildDSMG(k) {     // Tambour D-50: finned barrel, wood furniture, big round drum
    lathe(k, 'paint', -.12, [[0, .018], [.008, .026], [.25, .026], [.262, .022]], .012, 0, 22);
    soft(k, 'dark', [[-.1, -.014], [.1, -.014], [.094, -.036], [.058, -.042], [.046, -.034], [-.03, -.034], [-.054, -.048], [-.1, -.04]], .036, { r: .006, b: .004 });
    barrel(k, 'steel', .13, .36, .012, .0098, .009);
    lathe(k, 'dark', .13, [[0, .0165], [.14, .0165], [.15, .012]], .012, 0, 16);
    for (let i = 0; i < 10; i++) ring(k, 'dark', .14 + i * .0125, .012, .0172, .0026);
    hider(k, .352, .012, .0118, .044);
    const g = grip(k, -.058, -.036, 'walnut', .031); triggerGroup(k, .012, -.034, 'dark');
    soft(k, 'walnut', [[.138, -.01], [.196, -.01], [.19, -.032], [.186, -.086], [.174, -.098], [.156, -.096], [.148, -.034]], .03, { r: .01, b: .009 });
    stock(k, -.112, .006, 'walnut', .235, .07, { w: .038 });
    k.box('dark', .0, .042, .15, .004, .012);
    irons(k, -.05, .31, .0585, 'notch');
    k.box('dark', .31, .036, .014, .03, .011);
    action(k, .02, .016, .04, { side: [.07, .022] });
    const m = drumMag(k, .068, -.034, .06, .05);
    finish(k, .398, .012, .02, .018, .022);
    return { grip: g, support: [.17, -.055], fore: true, mag: m, charge: [.07, .024], handle: .06, sideCharge: true, scripts: drumClips };
  }
  function buildSSMG(k) {     // Ombre S-9: small body, fat suppressor as long as the rest of the gun
    bar(k, 'paint', -.1, .122, -.02, .035, .038);
    soft(k, 'poly', [[-.088, -.018], [.11, -.018], [.104, -.04], [.06, -.046], [.05, -.036], [-.03, -.036], [-.05, -.05], [-.088, -.042]], .034, { r: .007, b: .004 });
    can(k, .114, .008, .0245, .22);
    k.rail(-.09, .11, .04, .02);
    const g = grip(k, -.056, -.036); triggerGroup(k, .014, -.036);
    soft(k, 'poly', [[.05, -.036], [.1, -.036], [.104, -.058], [.094, -.066], [.062, -.062]], .03, { r: .008 });
    k.pin('steel', -.08, -.006, .0034, .04); k.pin('steel', .09, -.008, .0034, .04);
    tubeStock(k, -.098, .012, .16);
    reflex(k, .018, .0415);
    action(k, .02, .014, .038, { side: [.08, .024] });
    const m = mag(k, .078, -.04, { len: .16, d: .036, w: .022, curve: .014, ribs: 4 });
    finish(k, .336, .008, .02, .016, .02);
    return { grip: g, support: [.16, -.022], mag: m, charge: [.08, .026], handle: .05, sideCharge: true };
  }
  function buildFSMG(k) {     // Canif F-7: folds in half, magazine through the grip, stock folded along the right side
    bar(k, 'paint', -.09, .142, -.02, .039, .039, { b: .006 });
    soft(k, 'poly', [[-.066, -.018], [-.004, -.018], [.004, -.122], [-.006, -.134], [-.05, -.136], [-.064, -.122]], .034, { r: .009, b: .006 });
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) cap(k, 'rubber', -.03 + i * .0008, -.05 - i * .0135, .024, .0013, s * .0165);
    triggerGroup(k, .03, -.018);
    soft(k, 'poly', [[.07, -.018], [.138, -.018], [.132, -.04], [.114, -.05], [.086, -.046]], .032, { r: .009, b: .005 });
    barrel(k, 'steel', .13, .208, .01, .0078, .0072); lathe(k, 'dark', .15, [[0, .012], [.038, .0125], [.052, .0098]], .01, 0, 14);
    k.rail(-.07, .135, .0415, .018);
    k.pin('steel', -.072, .0, .0036, .04); k.pin('steel', .116, .0, .0034, .04);
    /* folded wire stock, hinged at the rear, lying along the right side */
    for (const dv of [.018, -.008]) { const c = new THREE.CapsuleGeometry(.0034, .172, 3, 8); c.rotateX(-Math.PI / 2); c.translate(.027, .006 + dv, -.0); k.add('steel', c); }
    soft(k, 'rubber', [[.085, .03], [.1, .03], [.1, -.016], [.085, -.016]], .0075, { x: .027, r: .004, b: .002 });
    ball(k, 'dark', -.085, .006, .0085, .0225, .6, 1.4, 1);
    reflex(k, .03, .0415);
    action(k, .05, .014, .038, {});
    k.part('handle'); k.box('steel', .1, .03, .014, .008, .012, -.024); ball(k, 'dark', .1, .03, .0075, -.033);
    k.part('mag', [-.03, -.02]);
    soft(k, 'steel', [[-.01, -.014], [-.05, -.014], [-.048, -.196], [-.006, -.194]], .021, { r: .004, b: .003 });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) cap(k, 'dark', -.027, -.14 - i * .015, .02, .0012, s * .0104);
    soft(k, 'poly', [[.0, -.19], [-.054, -.193], [-.054, -.206], [.0, -.203]], .028, { r: .004, b: .002 });
    finish(k, .21, .01, .05, .016, .02);
    return { grip: [-.03, -.074, .06], support: [.112, -.05], mag: [-.027, -.176], charge: [.1, .03], handle: .046, sideCharge: true };
  }

  /* ---------- shotguns ---------- */
  function buildLSG(k) {      // Cavalier L-12: lever, tube magazine, straight wood stock
    bar(k, 'steel', -.1, .112, -.042, .031, .045, { b: .005 });
    k.cyl('steel', .1, .63, .011, .0122, .0108, 0, 18);
    barrel(k, 'steel', .1, .57, -.0165, .0118);
    lathe(k, 'steel', .56, [[0, .0132], [.012, .0138], [.018, .0112]], -.0165, 0, 14);
    for (const u of [.2, .44]) ring(k, 'dark', u, -.003, .0226, .0018);
    soft(k, 'walnut', [[.115, -.036], [.34, -.03], [.352, -.018], [.346, -.002], [.115, -.002]], .05, { r: .012, b: .007 });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) cap(k, 'dark', .156 + i * .042, -.018, .02, .0014, s * .0252);
    soft(k, 'walnut', [[-.096, .018], [-.096, -.038], [-.13, -.05], [-.25, -.078], [-.385, -.104], [-.392, .012], [-.3, .018], [-.17, .02]], .042, { r: .012, b: .007 });
    soft(k, 'rubber', [[-.39, .014], [-.405, .018], [-.41, -.108], [-.388, -.11]], .044, { r: .006 });
    for (const u of [-.07, .06]) k.pin('steel', u, -.016, .0034, .046);
    k.box('dark', .022, .004, .05, .016, .002, .0221);        // side gate
    ball(k, 'brass', .618, .027, .0028);
    irons(k, -.02, .6, .0425, 'notch');
    k.part('hammer', [-.075, .014]); soft(k, 'dark', [[-.082, .014], [-.066, .014], [-.074, .042], [-.09, .05], [-.094, .042]], .008, { r: .003, b: .0015 });
    k.part('body');
    leverLoop(k, .046, -.04);
    k.ext('steel', [[.016, -.036], [.022, -.046], [.018, -.058], [.012, -.058], [.013, -.046], [.008, -.036]], .006, { r: .002, b: .0004 });
    k.part('bolt'); k.box('steel', .01, .008, .05, .016, .004, .0212);
    finish(k, .632, .011, .012, .012, .023);
    return { grip: [-.024, -.058, .16], support: [.235, -.03], wide: true, shell: [.03, -.05],
      poses: P => leverPoses(P, [.03, -.048]),
      scripts: w => ({ tac: gateReload(w, false, 5), empty: gateReload(w, true, 5), cycle: leverCycle(w) }), animate: leverAnim };
  }
  function buildDSG(k) {      // Barrique D-20: stout automatic with a wide drum and a ported shroud
    bar(k, 'paint', -.13, .156, -.036, .043, .053, { b: .006 });
    soft(k, 'dark', [[.03, -.034], [.13, -.034], [.126, -.056], [.036, -.056]], .046, { r: .005 });
    lathe(k, 'poly', .15, [[0, .024], [.008, .0295], [.26, .0295], [.272, .025]], .008, 0, 22);
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) cap(k, 'rubber', .185 + i * .04, .016, .016, .0044, s * .0268);
    barrel(k, 'steel', .4, .54, .008, .0138, .0128); brk(k, .53, .008, .0172, .07);
    k.rail(-.12, .4, .045, .022);
    const g = grip(k, -.058, -.034); triggerGroup(k, -.004, -.034, 'dark');
    k.pin('steel', -.1, -.012, .0038, .054); k.pin('steel', .12, -.014, .0038, .054);
    stock(k, -.128, .008, 'poly', .25, .064, { hole: true, w: .044 });
    irons(k, -.08, .39, .071, 'ring');
    action(k, .02, .012, .052, { side: [.09, .02] });
    const m = drumMag(k, .08, -.05, .074, .062, { neck: .012 });
    finish(k, .6, .008, .02, .014, .027);
    return { grip: g, support: [.27, -.022], mag: m, charge: [.09, .022], handle: .07, sideCharge: true, wide: true, scripts: drumClips };
  }
  function buildSAWN(k) {     // Mâchoire S-2: cut-down double, twin hammers, bird's-head wood grip
    const hinge = [.05, -.018], bv = .012;
    soft(k, 'steel', [[-.076, -.028], [.05, -.03], [.062, -.022], [.062, -.006], [.004, -.006], [.004, .024], [-.044, .027], [-.076, .012]], .05, { r: .008, b: .0042 });
    triggerGroup(k, -.03, -.028, 'steel');
    soft(k, 'walnut', [[-.072, .016], [-.074, -.028], [-.05, -.038], [-.046, -.058], [-.056, -.086], [-.07, -.112], [-.098, -.122], [-.113, -.11], [-.108, -.084], [-.103, -.052], [-.11, -.02], [-.098, .012]], .034, { r: .013, b: .0095 });
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) cap(k, 'dark', -.074 - i * .004, -.056 - i * .0095, .014, .0011, s * .0166);
    ball(k, 'steel', -.104, -.118, .007, 0, 1.5, .7, 1);
    for (const s of [-1, 1]) { soft(k, 'dark', [[-.05, .02], [-.04, .02], [-.05, .034], [-.066, .042], [-.07, .035]], .006, { x: s * .0115, r: .003, b: .0015 }); }
    k.part('barrels', hinge);
    for (const x of [-.0128, .0128]) { lathe(k, 'steel', .002, [[0, .0125], [.2, .0122], [.202, .0135], [.214, .0135], [.216, .0105]], bv, x, 16); }
    k.box('dark', .11, bv + .0118, .2, .0035, .007); k.box('steel', .11, bv - .0112, .2, .006, .008);
    ball(k, 'brass', .204, bv + .017, .0024);
    soft(k, 'walnut', [[.066, -.03], [.16, -.026], [.17, -.014], [.168, .0], [.066, .0]], .05, { r: .011, b: .0065 });
    k.box('steel', .042, -.012, .046, .014, .03);
    k.part('rims', hinge);
    for (const x of [-.0128, .0128]) { k.disc('brass', .0014, bv, .0108, x); k.disc('steel', .001, bv, .003, x); }
    k.part('body');
    k.anchor('sight', .204, bv + .0195); k.anchor('muzzle', .22, bv); k.anchor('eject', -.01, .04, 0);
    return { grip: [-.088, -.074, .52], support: [.116, -.03], wide: true, shell: [-.02, .03],
      poses: () => ({ port: sidePose(-.06, .05, -.03, [.7, .75, .8, .8, .5]) }),
      post(w) { nest(w, 'rims', 'barrels'); },
      scripts: w => ({ tac: breakReload(w, false), empty: breakReload(w, true) }),
      animate(w, a) { w.parts.barrels.rotation.x = -a.brk * .62; w.parts.rims.visible = a.rod < .5; } };
  }

  /* ---------- machine guns ---------- */
  function buildBPLMG(k) {    // Bastion B-90: compact belt-less bullpup with a heavy shrouded barrel and carry arch
    soft(k, 'paint', [[-.36, -.082], [-.36, .03], [-.335, .05], [.02, .056], [.14, .048], [.24, .03], [.262, .006], [.254, -.024], [.1, -.036], [.066, -.048], [-.03, -.048], [-.062, -.058], [-.25, -.058], [-.276, -.086]], .062, { r: .018, b: .009 });
    soft(k, 'rubber', [[-.358, .032], [-.376, .036], [-.38, -.086], [-.357, -.086]], .064, { r: .007 });
    soft(k, 'poly', [[-.348, -.074], [-.285, -.078], [-.25, -.05], [-.07, -.044], [.05, -.04], [.16, -.03], [.22, -.012], [.236, .006], [.14, .028], [-.02, .036], [-.3, .032], [-.346, .02]], .0648, { r: .022, b: .0034 });
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) cap(k, 'rubber', -.325 + i * .019, -.02, .02, .0027, s * .0328);
    soft(k, 'dark', [[-.262, -.056], [-.1, -.056], [-.106, -.072], [-.256, -.076]], .05, { r: .004 });
    guard(k, 'dark', .236, .475, .008, .0235, 7);
    barrel(k, 'steel', .47, .6, .008, .0125, .0112); brk(k, .59, .008, .0158, .07);
    soft(k, 'poly', [[-.08, .05], [-.05, .094], [.13, .094], [.17, .05], [.148, .05], [.118, .08], [-.04, .08], [-.058, .05]], .018, { r: .012, b: .006 });
    k.rail(-.06, .13, .098, .02);
    const g = grip(k, -.058, -.05); triggerGroup(k, .014, -.05, 'dark');
    for (const u of [-.3, -.1, .19]) k.pin('steel', u, .004, .0036, .064);
    for (const x of [-.017, .017]) { k.cyl('steel', .3, .52, -.022, .0048, .0042, x, 8); ball(k, 'rubber', .3, -.022, .0075, x); }
    lathe(k, 'dark', .515, [[0, .01], [.012, .0115], [.018, .008]], -.022, 0, 10);
    reflex(k, .03, .1);
    action(k, -.19, .012, .062, { side: [.16, .026] });
    const m = mag(k, -.19, -.066, { len: .17, d: .088, w: .04, curve: .02, mat: 'poly', base: 'rubber', ribs: 5 });
    finish(k, .664, .008, -.19, .016, .032);
    return { grip: g, support: [.2, -.04], mag: m, charge: [.16, .028], handle: .07, sideCharge: true, wide: true };
  }
  function buildDLMG(k) {     // Citerne T-120: top cover, belt rising from a large side drum, finned barrel
    bar(k, 'paint', -.16, .172, -.048, .034, .059, { b: .006 });
    for (let i = 0; i < 5; i++) k.pin('steel', -.12 + i * .058, -.033, .003, .06);
    lathe(k, 'dark', .17, [[0, .02], [.008, .0275], [.4, .0275], [.412, .022]], .008, 0, 22);
    for (let i = 0; i < 13; i++) for (const s of [-1, 1]) cap(k, 'rubber', .2 + i * .028, .018, .012, .0034, s * .0246);
    barrel(k, 'steel', .58, .74, .008, .0125, .011); hider(k, .735, .008, .0148, .062);
    k.rail(.18, .56, .04, .02);
    const g = grip(k, -.057, -.046); triggerGroup(k, .016, -.046, 'dark');
    stock(k, -.158, .006, 'paint', .26, .07, { hole: true, w: .044 });
    for (const x of [-.018, .018]) { k.cyl('steel', .36, .6, -.025, .0048, .0042, x, 8); ball(k, 'rubber', .36, -.025, .0078, x); }
    lathe(k, 'dark', .595, [[0, .011], [.014, .013], [.02, .009]], -.025, 0, 10);
    reflex(k, .235, .0455);
    k.part('cover', [-.11, .03]);
    soft(k, 'paint', [[-.13, .03], [.13, .03], [.144, .038], [.134, .054], [.04, .062], [-.086, .062], [-.13, .046]], .056, { r: .011, b: .0055 });
    for (let i = 0; i < 5; i++) cap(k, 'dark', -.072 + i * .042, .0585, .012, .0022, 0);
    k.pin('steel', -.112, .037, .0052, .06);
    k.part('tray'); k.box('steel', .04, .029, .082, .004, .05);
    k.part('mag', [.05, -.05]);
    const cv = -.142, R = .092;
    soft(k, 'steel', [[.002, -.044], [.1, -.044], [.096, -.066], [.008, -.066]], .05, { r: .005, x: -.012 });
    disc(k, 'olive', .05, cv, R, .076, -.018);
    for (const s of [-1, 1]) { ring(k, 'steel', .05, cv, R * .95, .002, -.018 + s * .035); ring(k, 'dark', .05, cv, R * .72, .0018, -.018 + s * .0385); ring(k, 'dark', .05, cv, R * .46, .0018, -.018 + s * .0385); disc(k, 'steel', .05, cv, R * .2, .005, -.018 + s * .039); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cap(k, 'dark', .05 + Math.cos(a) * R * .995, cv + Math.sin(a) * R * .995, .0005, .0024, -.018); }
    k.part('belt', [.05, -.05]);
    for (let i = 0; i < 8; i++) {
      const t = i / 7, a = t * 1.25, x = -.052 + Math.sin(a) * .048, v = -.046 + (1 - Math.cos(a)) * .05 + t * .028;
      k.cyl('brass', .014, .054, v, .0056, .005, x, 8); k.cyl('brass', .054, .063, v, .005, .003, x, 8); k.cyl('steel', .063, .072, v, .003, .0008, x, 6);
      k.box('dark', .02, v, .006, .013, .013, x); k.box('dark', .046, v, .006, .013, .013, x);
    }
    k.part('bolt'); k.box('steel', .03, .004, .058, .017, .004, .0292);
    k.part('handle'); k.box('steel', .094, -.002, .018, .009, .044, .05); ball(k, 'dark', .094, -.002, .0075, .073);
    finish(k, .8, .008, .03, .002, .03);
    return { grip: g, support: [.33, -.03], mag: [.05, -.224], charge: [.094, -.002], cover: [.11, .06], handle: .082, sideCharge: true, scripts: w => { const s = lmgReload(w); return { tac: s, empty: s }; } };
  }

  /* ---------- precision ---------- */
  function buildLSR(k) {      // Trappeur L-30: long lever rifle, tube magazine, tall sights
    bar(k, 'steel', -.1, .116, -.036, .029, .037, { b: .005 });
    barrel(k, 'steel', .105, .79, .012, .0105, .0086);
    barrel(k, 'dark', .105, .68, -.0105, .0072);
    lathe(k, 'steel', .668, [[0, .0086], [.012, .009], [.016, .007]], -.0105, 0, 12);
    for (const u of [.34, .6]) ring(k, 'dark', u, .001, .0186, .0016);
    soft(k, 'walnut', [[.112, -.03], [.4, -.024], [.414, -.014], [.408, .0], [.112, .0]], .04, { r: .012, b: .0065 });
    soft(k, 'walnut', [[-.096, .016], [-.096, -.032], [-.13, -.046], [-.26, -.082], [-.415, -.106], [-.422, .014], [-.32, .02], [-.17, .022]], .038, { r: .013, b: .007 });
    soft(k, 'steel', [[-.42, .017], [-.43, .02], [-.434, -.11], [-.42, -.112]], .04, { r: .007 });
    for (const u of [-.07, .07]) k.pin('steel', u, -.012, .0032, .038);
    k.box('dark', .018, .004, .046, .014, .002, .0183);
    irons(k, .17, .752, .047, 'notch');
    k.box('dark', .752, .029, .014, .03, .009);
    k.part('hammer', [-.075, .014]); soft(k, 'dark', [[-.082, .014], [-.066, .014], [-.074, .04], [-.09, .048], [-.094, .04]], .008, { r: .003, b: .0015 });
    k.part('body');
    leverLoop(k, .042, -.034);
    k.ext('steel', [[.016, -.03], [.022, -.04], [.018, -.052], [.012, -.052], [.013, -.04], [.008, -.03]], .006, { r: .002, b: .0004 });
    k.part('bolt'); k.box('steel', .01, .008, .05, .015, .004, .0176);
    finish(k, .792, .012, .012, .014, .019);
    return { grip: [-.024, -.056, .16], support: [.27, -.024], shell: [.03, -.042],
      poses: P => leverPoses(P, [.03, -.04]),
      scripts: w => ({ tac: gateReload(w, false, 5), empty: gateReload(w, true, 6), cycle: leverCycle(w) }), animate: leverAnim };
  }
  function buildASR(k) {      // Faucheuse SA-3: semi-auto, fluted barrel, big brake, adjustable stock
    bar(k, 'paint', -.15, .172, -.022, .037, .045, { b: .005 });
    soft(k, 'dark', [[-.14, -.02], [.14, -.02], [.134, -.05], [.066, -.058], [.05, -.046], [-.03, -.046], [-.058, -.06], [-.104, -.054], [-.14, -.036]], .039, { r: .007, b: .004 });
    guard(k, 'poly', .165, .43, .006, .0235, 7);
    barrel(k, 'steel', .42, .82, .006, .0125, .0098);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; cap(k, 'dark', .62, .006 + Math.sin(a) * .0108, .34, .0013, Math.cos(a) * .0108); cap(k, 'dark', .62, .006 - Math.sin(a) * .0108, .34, .0013, -Math.cos(a) * .0108); }
    brk(k, .81, .006, .0172, .092);
    k.rail(-.13, .17, .042, .022);
    const g = grip(k, -.058, -.046); triggerGroup(k, .014, -.046);
    k.pin('steel', -.1, -.006, .0036, .046); k.pin('steel', .12, -.008, .0036, .046);
    stock(k, -.148, .008, 'poly', .29, .07, { hole: true, cheek: true, w: .042 });
    scopeLong(k, .03, .092, 1);
    action(k, .014, .014, .044, { side: [.12, .022] });
    const m = mag(k, .088, -.046, { len: .112, d: .07, w: .03, curve: .01, mat: 'poly', base: 'rubber', ribs: 2 });
    finish(k, .906, .006, .014, .016, .023);
    return { grip: g, support: [.3, -.022], mag: m, charge: [.12, .024], handle: .08, sideCharge: true };
  }
  function buildSCOUT(k) {    // Éclaireur V-6: slim bolt gun in a light thumbhole stock
    bar(k, 'steel', -.1, .134, -.016, .028, .033, { b: .0045 });
    soft(k, 'paint', [[-.13, -.012], [.33, -.012], [.346, -.024], [.34, -.042], [.09, -.046], [.064, -.056], [.04, -.046], [-.03, -.046], [-.05, -.064], [-.07, -.1], [-.098, -.12], [-.13, -.104], [-.126, -.066], [-.2, -.066], [-.31, -.088], [-.402, -.098], [-.408, .012], [-.33, .024], [-.25, .028], [-.18, .012]], .04, { r: .012, b: .0065, holes: [[[-.082, -.044], [-.066, -.07], [-.09, -.094], [-.112, -.084], [-.108, -.056]]], hr: .006 });
    soft(k, 'rubber', [[-.406, .014], [-.422, .017], [-.426, -.102], [-.404, -.102]], .043, { r: .006 });
    triggerGroup(k, .018, -.046, 'dark');
    barrel(k, 'steel', .125, .79, .004, .0108, .0074);
    hider(k, .785, .004, .0112, .05);
    k.rail(-.08, .13, .034, .02);
    scopeLong(k, .02, .082, .82);
    k.part('mag', [.05, -.046]);
    soft(k, 'dark', [[.092, -.044], [.014, -.044], [.014, -.086], [.092, -.09]], .024, { r: .006, b: .003 });
    soft(k, 'poly', [[.095, -.086], [.011, -.082], [.009, -.096], [.097, -.1]], .03, { r: .004, b: .002 });
    k.part('bolt', [.0, .006]);
    lathe(k, 'steel', -.11, [[0, .0115], [.004, .0095], [.17, .0095], [.174, .007]], 0, 0, 14);
    k.cyl('dark', -.122, -.11, 0, .0118, .0118, 0, 14);
    k.box('steel', -.095, -.002, .008, .007, .026, .016);
    { const stem = new THREE.CylinderGeometry(.0032, .0032, .032, 8); stem.rotateZ(.82); stem.translate(.024, -.016, .095); k.add('steel', stem); ball(k, 'poly', .095, -.028, .0088, .035); }
    finish(k, .838, .004, .012, .016, .017);
    return { grip: [-.05, -.086, .34], support: [.26, -.042], mag: [.05, -.092], boltKnob: [-.095, -.028, .035], boltTurn: true,
      scripts: w => ({ tac: sniperReload(w, false), empty: sniperReload(w, true), cycle: boltCycle(w) }) };
  }

  /* ---------- pistols ---------- */
  const pFrame = (k, mat, u1, lower = -.024) => {
    soft(k, mat, [[-.071, -.012], [u1, -.012], [u1, lower + .004], [u1 - .03, lower - .004], [.036, -.03], [-.004, -.032], [-.03, -.03], [-.071, -.026]], .0275, { r: .006, b: .0034 });
    soft(k, mat, [[-.086, -.016], [-.07, -.02], [-.012, -.028], [-.014, -.046], [-.021, -.056], [-.018, -.068], [-.025, -.08], [-.022, -.092], [-.03, -.106], [-.036, -.125], [-.08, -.123], [-.084, -.09], [-.078, -.052], [-.09, -.03]], .028, { r: .009, b: .0075 });
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) cap(k, 'rubber', -.05 + i * .0016, -.056 - i * .0125, .026, .0012, s * .0143);
    triggerGroup(k, .021, -.027);
  };
  const pMag = (k, tail = -.128, m = 'steel', base = 'poly') => {
    k.part('mag', [-.04, -.03]);
    soft(k, m, [[-.012, -.03], [-.06, -.03], [-.08, tail], [-.034, tail - .002]], .019, { r: .003, b: .002 });
    soft(k, base, [[-.03, tail + .005], [-.087, tail + .008], [-.09, tail - .006], [-.031, tail - .009]], .029, { r: .004, b: .002 });
  };
  function buildBP(k) {       // Triplet T-3: burst machine pistol, ported compensator, long magazine, folding front lever
    pFrame(k, 'poly', .1);
    soft(k, 'poly', [[.062, -.028], [.09, -.03], [.084, -.066], [.076, -.074], [.068, -.07], [.069, -.05]], .016, { r: .005, b: .004 });
    k.part('slide');
    bar(k, 'steel', -.076, .116, -.013, .028, .0268, { b: .0032, top: .62 });
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) cap(k, 'dark', -.062 + i * .0066, .006, .016, .0012, s * .0128);
    k.box('rubber', .018, .0135, .044, .016, .004, .0118);
    k.box('dark', .098, .03, .009, .007, .004); k.box('dot', .0945, .0345, .0012, .0022, .0022);
    k.box('dark', -.058, .031, .011, .0075, .0065, -.0065); k.box('dark', -.058, .031, .011, .0075, .0065, .0065); k.box('dark', -.058, .0265, .012, .003, .022);
    k.part('body');
    lathe(k, 'dark', .112, [[0, .011], [.004, .0125], [.034, .0125], [.04, .0098]], .002, 0, 16);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) cap(k, 'rubber', .122 + i * .009, .007, .0028, .0022, s * .0078);
    pMag(k, -.168);
    finish(k, .154, .002, .018, .018, .012);
    k.anchor('sight', .0945, .0345);
    return { grip: [-.05, -.075, .24], cup: [-.052, -.06], support: [-.052, -.094], mag: [-.058, -.15], rack: [-.055, .016], scripts: pistolClips };
  }
  function buildP22(k) {      // Souris .22: slim blowback pistol, long integral suppressor
    pFrame(k, 'paint', .09);
    k.part('slide');
    bar(k, 'steel', -.072, .09, -.013, .023, .0215, { b: .003, top: .6 });
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) cap(k, 'dark', -.06 + i * .0064, .004, .013, .001, s * .0104);
    k.box('rubber', .012, .01, .036, .012, .004, .0092);
    k.box('dark', -.054, .026, .01, .007, .005, -.005); k.box('dark', -.054, .026, .01, .007, .005, .005);
    k.part('body');
    lathe(k, 'steel', .085, [[0, .0078], [.008, .0082], [.014, .0078]], .004, 0, 12);
    can(k, .096, .004, .0148, .118);
    k.box('dark', .2, .0215, .008, .007, .0034); k.box('dot', .1968, .0255, .0012, .0022, .0022);
    pMag(k, -.122);
    finish(k, .215, .004, .012, .014, .011);
    k.anchor('sight', .1968, .0255);
    return { grip: [-.05, -.075, .24], cup: [-.052, -.06], support: [-.052, -.094], mag: [-.058, -.11], rack: [-.055, .012], scripts: pistolClips };
  }
  function buildLSP(k) {      // Aiguille LS-6: long match slide, fluted, two-tone, tall adjustable sights
    pFrame(k, 'dark', .15, -.022);
    k.part('slide');
    bar(k, 'nickel', -.078, .186, -.013, .027, .025, { b: .003, top: .6 });
    for (let i = 0; i < 2; i++) for (const s of [-1, 1]) cap(k, 'dark', .096 + i * .002, .002 + i * .012, .118, .0014, s * .0123);
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) cap(k, 'dark', -.066 + i * .0058, .006, .014, .001, s * .0123);
    k.box('rubber', .018, .0125, .05, .014, .004, .0108);
    k.box('dark', .172, .029, .01, .009, .004); k.box('dot', .168, .0352, .0012, .0024, .0024);
    k.box('dark', -.06, .03, .013, .008, .0075, -.007); k.box('dark', -.06, .03, .013, .008, .0075, .007); k.box('dark', -.06, .025, .015, .003, .024);
    k.part('body');
    lathe(k, 'dark', .18, [[0, .0075], [.009, .008], [.012, .0058]], .002, 0, 12);
    pMag(k, -.13, 'nickel', 'dark');
    finish(k, .193, .002, .018, .016, .012);
    k.anchor('sight', .168, .0352);
    return { grip: [-.05, -.075, .24], cup: [-.052, -.06], support: [-.052, -.094], mag: [-.058, -.116], rack: [-.055, .014], scripts: pistolClips };
  }

  /* ---------- melee: the tool points along local +s from the hand ---------- */
  const tool = (k, T) => { const C = [-.03, -.072]; return { C, T, L: pts => rot2(pts, C[0], C[1], Math.PI / 2 - T) }; };
  const meleeCfg = (t, script) => {
    const tip = t.tip;
    return { grip: [t.C[0], t.C[1], t.T], oneHand: true, poses: P => ({ rest: awayPose(P.rest) }), scripts: script, tipAt: tip };
  };
  function buildMACH(k) {     // Serpe M-4: long forward-weighted blade, hooked pommel
    const t = tool(k, .46), L = t.L;
    soft(k, 'poly', L([[-.066, -.0125], [.05, -.014], [.056, 0], [.05, .014], [-.05, .015], [-.078, .026], [-.092, .018], [-.076, .002]]), .025, { r: .006, b: .006 });
    for (let i = 0; i < 5; i++) { const q = L([[-.04 + i * .019, -.0145], [-.04 + i * .019, .0145]]); const g = new THREE.CylinderGeometry(.0012, .0012, .0295, 5); g.rotateZ(Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]) - Math.PI / 2 + Math.PI / 2); g.rotateY(Math.PI / 2); g.translate(.0128, (q[0][1] + q[1][1]) / 2, -(q[0][0] + q[1][0]) / 2); k.add('rubber', g); }
    soft(k, 'steel', L([[.05, -.022], [.058, -.022], [.058, .019], [.05, .019]]), .028, { r: .003, b: .002 });
    soft(k, 'blade', L([[.058, -.016], [.2, -.024], [.32, -.03], [.398, -.016], [.43, .012], [.34, .016], [.2, .013], [.058, .013]]), .0046, { r: .007, b: .0018, cs: 7 });
    soft(k, 'dark', L([[.066, .004], [.32, .006], [.32, .011], [.066, .01]]), .005, { r: .001, b: .0004 });
    const tip = L([[.43, .012]])[0]; t.tip = tip;
    k.anchor('muzzle', tip[0], tip[1]); k.anchor('sight', tip[0], tip[1]); k.anchor('eject', t.C[0], t.C[1]);
    return meleeCfg(t, w => ({ act: [sweep(w, 1), sweep(w, -1)] }));
  }
  function buildAXE(k) {      // Cognée H-2: curved haft, bearded head with a rear spike
    const t = tool(k, .5), L = t.L;
    soft(k, 'walnut', L([[-.11, -.012], [.04, -.016], [.2, -.012], [.33, -.008], [.335, .01], [.2, .012], [.04, .016], [-.09, .02], [-.128, .03], [-.14, .014]]), .026, { r: .01, b: .0075, cs: 7 });
    for (let i = 0; i < 5; i++) { const q = L([[-.05 + i * .022, 0]])[0]; const g = new THREE.TorusGeometry(.0176, .0016, 5, 16); g.rotateY(Math.PI / 2); g.rotateX(t.T - Math.PI / 2 + Math.PI / 2); g.translate(0, q[1], -q[0]); k.add('rubber', g); }
    soft(k, 'steel', L([[.268, .0], [.288, -.022], [.33, -.03], [.352, -.016], [.358, .014], [.34, .03], [.296, .026], [.27, .018]]), .03, { r: .006, b: .006 });
    soft(k, 'blade', L([[.29, -.022], [.262, -.072], [.232, -.112], [.288, -.122], [.37, -.11], [.4, -.066], [.376, -.022], [.352, -.016]]), .0072, { r: .012, b: .0028, cs: 7 });
    soft(k, 'dark', L([[.31, .024], [.326, .07], [.336, .092], [.346, .07], [.35, .024]]), .009, { r: .004, b: .002 });
    const tip = L([[.34, -.12]])[0]; t.tip = tip;
    k.anchor('muzzle', tip[0], tip[1]); k.anchor('sight', tip[0], tip[1]); k.anchor('eject', t.C[0], t.C[1]);
    return meleeCfg(t, w => ({ act: [chop(w)] }));
  }
  function buildCROW(k) {     // Levier C-9: forged bar, bent claw at one end, chisel at the other
    const t = tool(k, .42), L = t.L;
    const bar = L([[-.12, -.0085], [.32, -.0085], [.372, -.016], [.41, -.042], [.442, -.05], [.452, -.038], [.42, -.026], [.378, -.002], [.32, .0085], [-.12, .0085], [-.15, .018], [-.163, .012], [-.136, -.003]]);
    soft(k, 'paint', bar, .017, { r: .009, b: .007, cs: 6 });
    soft(k, 'poly', L([[-.08, -.013], [.05, -.0135], [.056, 0], [.05, .0135], [-.08, .013], [-.088, 0]]), .025, { r: .006, b: .0075 });
    for (let i = 0; i < 6; i++) { const q = L([[-.066 + i * .021, 0]])[0]; const g = new THREE.TorusGeometry(.0124, .0013, 5, 14); g.rotateY(Math.PI / 2); g.rotateX(.2); g.translate(0, q[1], -q[0]); k.add('rubber', g); }
    soft(k, 'steel', L([[.42, -.05], [.46, -.06], [.474, -.05], [.455, -.034]]), .011, { r: .003, b: .002 });
    const tip = L([[.47, -.054]])[0]; t.tip = tip;
    k.anchor('muzzle', tip[0], tip[1]); k.anchor('sight', tip[0], tip[1]); k.anchor('eject', t.C[0], t.C[1]);
    return meleeCfg(t, w => ({ act: [hook(w)] }));
  }

  /* ---------- stage 2: new mechanics ---------- */
  function buildFLAME(k) {    // Salamandre T-9: heat-shielded wand, pilot tube, fuel tank carried under the body
    bar(k, 'paint', -.12, .16, -.02, .042, .05, { b: .005 });
    soft(k, 'dark', [[-.11, -.02], [.15, -.02], [.142, -.044], [.06, -.05], [.046, -.042], [-.03, -.042], [-.056, -.056], [-.1, -.05], [-.11, -.034]], .04, { r: .007, b: .004 });
    stock(k, -.118, .01, 'poly', .2, .06, { hole: true, w: .04 });
    const g = grip(k, -.056, -.042); triggerGroup(k, .014, -.042, 'dark');
    lathe(k, 'steel', .15, [[0, .016], [.012, .0185], [.34, .016], [.37, .021], [.43, .025], [.44, .021], [.462, .013]], .012, 0, 20);
    for (let i = 0; i < 5; i++) ring(k, 'dark', .19 + i * .026, .012, .0183, .002);
    lathe(k, 'dark', .3, [[0, .029], [.006, .034], [.112, .034], [.118, .029]], .012, 0, 24);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) cap(k, 'rubber', .318 + i * .02, .018, .009, .0034, s * .0318);
    k.cyl('brass', .17, .47, -.015, .0032, .0032, 0, 8); ball(k, 'red', .476, -.015, .0058);
    soft(k, 'poly', [[.19, -.012], [.244, -.012], [.24, -.04], [.236, -.092], [.224, -.102], [.206, -.1], [.2, -.04]], .03, { r: .01, b: .009 });
    irons(k, -.03, .285, .0705, 'ring');
    k.box('dark', .285, .05, .014, .022, .012);
    k.part('mag', [.06, -.05]);
    soft(k, 'steel', [[.012, -.044], [.11, -.044], [.104, -.062], [.018, -.062]], .03, { r: .005 });
    lathe(k, 'olive', -.06, [[0, .012], [.012, .03], [.03, .0385], [.2, .0385], [.218, .03], [.23, .012]], -.098, 0, 22);
    for (const u of [-.02, .13]) ring(k, 'steel', u, -.098, .0392, .0024);
    disc(k, 'steel', .056, -.098, .012, .006, .0385); disc(k, 'red', .056, -.098, .0075, .002, .0418);
    finish(k, .464, .012, .0, .01, .026);
    return { grip: g, support: [.222, -.066], fore: true, mag: [.056, -.14], charge: [.09, .03], handle: .05 };
  }
  function buildFLARE(k) {    // Luciole F-1: break-open signal pistol, wide orange bore, spur hammer
    const hinge = [.048, -.016], bv = .014;
    soft(k, 'dark', [[-.07, -.026], [.05, -.028], [.06, -.02], [.06, -.004], [.004, -.004], [.004, .028], [-.044, .03], [-.07, .014]], .036, { r: .008, b: .0045 });
    soft(k, 'poly', [[-.08, -.016], [-.066, -.022], [-.012, -.028], [-.014, -.046], [-.021, -.058], [-.018, -.07], [-.025, -.084], [-.03, -.108], [-.036, -.122], [-.076, -.12], [-.08, -.09], [-.074, -.05], [-.084, -.03]], .028, { r: .01, b: .008 });
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) cap(k, 'rubber', -.05 + i * .0016, -.056 - i * .0125, .024, .0012, s * .0136);
    triggerGroup(k, .018, -.028, 'dark');
    soft(k, 'steel', [[-.05, .022], [-.038, .022], [-.05, .04], [-.068, .05], [-.072, .042]], .007, { r: .003, b: .0015 });
    k.part('barrels', hinge);
    lathe(k, 'paint', .002, [[0, .0205], [.01, .0215], [.15, .0205], [.156, .0245], [.17, .0245], [.174, .019]], bv, 0, 22);
    k.tube('dark', .168, .1745, bv, .0185, .0145, 0, 20);
    for (const u of [.05, .09, .13]) ring(k, 'dark', u, bv, .0212, .0013);
    soft(k, 'poly', [[.062, -.028], [.128, -.024], [.134, -.014], [.13, -.002], [.062, -.002]], .03, { r: .008, b: .005 });
    k.box('dark', .15, bv + .024, .008, .008, .004); k.box('dot', .147, bv + .029, .0012, .0022, .0022);
    k.part('rims', hinge); k.disc('brass', .0014, bv, .0178); k.disc('red', .001, bv, .009);
    k.part('body');
    k.anchor('sight', .147, bv + .029); k.anchor('muzzle', .176, bv); k.anchor('eject', -.01, .045, 0);
    return { grip: [-.05, -.075, .24], cup: [-.052, -.06], support: [-.052, -.094], shell: [-.02, .032],
      poses: () => ({ port: sidePose(-.056, .052, -.03, [.7, .75, .8, .8, .5]) }),
      post(w) { nest(w, 'rims', 'barrels'); },
      scripts: w => { const s = breakReload(w, false); return { tac: s, empty: s }; },
      animate(w, a) { w.parts.barrels.rotation.x = -a.brk * .7; w.parts.rims.visible = a.rod < .5; } };
  }
  const BOW = { riser: .36, cam: [.3, .36], nock: .13, pull: .19 };
  function nockArrow(w) {
    const P = w.poses;
    return { ev: [[.34, 'pouch'], [.68, 'boltPlace'], [.84, 'stringLatch']], attach: null, tilt: [.04, .05, .12], lh: [[0, P.rest], [1, P.rest]],
      rh: [[0, P.grip], [.3, P.quiver], [.42, P.quiver], [.72, P.nocking], [.84, P.grip], [1, P.grip]],
      run(a, t) { if (t >= .62) { w.st.loaded = true; w.st.nocked = t < .84 ? (t - .62) / .22 : 1; } else if (t < .05) w.st.nocked = 0; } };
  }
  function buildBOW(k) {      // Roseau C-70: compound bow, machined riser, split limbs, two cams, peep sight
    const R = BOW.riser, C = BOW.cam;
    soft(k, 'paint', [[R + .012, -.13], [R + .04, -.09], [R + .052, -.03], [R + .03, -.008], [R + .03, .03], [R + .052, .07], [R + .04, .118], [R + .012, .15], [R - .012, .146], [R + .006, .09], [R - .006, .05], [R - .018, .02], [R - .022, -.03], [R - .004, -.07], [R - .012, -.122]], .022, { r: .012, b: .007, holes: [[[R + .016, .058], [R + .034, .074], [R + .026, .104], [R + .012, .086]], [[R + .016, -.056], [R + .012, -.09], [R + .026, -.108], [R + .036, -.072]]], hr: .004 });
    soft(k, 'rubber', [[R - .024, -.034], [R + .006, -.04], [R + .012, .012], [R - .018, .02]], .027, { r: .009, b: .007 });
    for (const s of [-1, 1]) {
      const L = [[R + .006, s * .135], [R + .004, s * .2], [C[0] + .018, s * .3], [C[0] + .004, s * C[1]], [C[0] - .01, s * C[1]], [C[0] + .002, s * .29], [R - .016, s * .19], [R - .014, s * .13]];
      for (const x of [-.0105, .0105]) soft(k, 'poly', s > 0 ? L : [...L].reverse(), .0105, { x, r: .018, b: .0034, cs: 7 });
      disc(k, 'steel', C[0], s * C[1], .027, .009); ring(k, 'dark', C[0], s * C[1], .0235, .0018); disc(k, 'dark', C[0], s * C[1], .008, .0125);
    }
    k.cyl('dark', R, R + .17, .012, .0045, .0035, -.016, 8); ball(k, 'rubber', R + .172, .012, .0072, -.016);       // stabiliser
    k.ext('dark', [[R + .012, .022], [R + .05, .022], [R + .05, .03], [R + .012, .03]], .007, { x: -.018, r: .002, b: .0006 });
    ring(k, 'dark', R + .05, .056, .018, .0024, -.018); k.box('dot', R + .05, .056, .0012, .0028, .0028, -.018);       // ring sight, left of the arrow line
    k.part('strT', [C[0] - .022, C[1]]); { const g = new THREE.CylinderGeometry(.0014, .0014, 1, 5); g.translate(0, .5, 0); k.add('rubber', g); }
    k.part('strB', [C[0] - .022, -C[1]]); { const g = new THREE.CylinderGeometry(.0014, .0014, 1, 5); g.translate(0, .5, 0); k.add('rubber', g); }
    k.part('arrow', [BOW.nock, 0]);
    lathe(k, 'dark', BOW.nock, [[0, .0034], [.004, .0042], [.5, .0042]], 0, 0, 7);
    lathe(k, 'blade', BOW.nock + .5, [[0, .0062], [.008, .0068], [.046, .0006]], 0, 0, 8);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + .5; const f = new THREE.BoxGeometry(.0009, .014, .06); f.translate(0, .009, 0); f.rotateZ(a); f.translate(0, 0, -(BOW.nock + .05)); k.add('red', f); }
    k.part('body');
    k.anchor('sight', R + .05, .056, -.018); k.anchor('muzzle', BOW.nock + .55, 0); k.anchor('eject', R, 0, 0);
    return { grip: [BOW.nock - .03, -.062, .1], support: [R - .004, -.006], wide: true, pullLen: BOW.pull,
      poses: P => ({ quiver: shiftPose(P.grip, -.2, -.2, .14), nocking: shiftPose(P.grip, .02, .02, -.01) }),
      scripts: w => { const s = nockArrow(w); return { tac: s, empty: s }; },
      animate(w) {
        const q = w.st.pull || 0, P = w.parts, nu = BOW.nock - q * BOW.pull, cu = C[0] - .022, du = nu - cu, dv = C[1], len = Math.hypot(du, dv), th = Math.atan2(-du, -dv);
        P.strT.rotation.x = th; P.strT.scale.y = len; P.strB.rotation.x = Math.atan2(-du, dv); P.strB.scale.y = len;
        P.arrow.visible = !!w.st.loaded; P.arrow.position.z = P.arrow.userData.base.z + q * BOW.pull + (1 - (w.st.nocked ?? 1)) * .05;
      } };
  }

  Object.assign(BUILDERS, { flame: buildFLAME, flare: buildFLARE, bow: buildBOW });
  Object.assign(FEEL, {
    flame: { hip: [.16, -.165, -.42], eye: .46, kz: .03, kp: .04, ky: .05, kr: .04, travel: 0, cycle: .1, flash: 0, casing: 0, smoke: 0, weight: 1.45 },
    flare: { hip: [.14, -.14, -.45], eye: .46, kz: .5, kp: 1.5, ky: .24, kr: .5, travel: 0, cycle: .15, flash: .3, casing: 0, smoke: 1.2, weight: 1.1 },
    bow: { hip: [.08, -.1, -.58], rot: [.02, -.1, .46], eye: .42, kz: .12, kp: .1, ky: .05, kr: .08, travel: 0, cycle: .2, flash: 0, casing: 0, smoke: 0, weight: 1 },
  });
  Object.assign(BUILDERS, { bpc: buildBPC, cqc: buildCQC, hbr: buildHBR, ssr: buildSSR, dsmg: buildDSMG, ssmg: buildSSMG, fsmg: buildFSMG, lsg: buildLSG, dsg: buildDSG, sawn: buildSAWN, bplmg: buildBPLMG, dlmg: buildDLMG, lsr: buildLSR, asr: buildASR, scout: buildSCOUT, bp: buildBP, p22: buildP22, lsp: buildLSP, mach: buildMACH, axe: buildAXE, crow: buildCROW });
  const rifle = (o) => ({ hip: [.15, -.15, -.42], eye: .2, kz: .3, kp: .5, ky: .16, kr: .2, travel: .05, cycle: .075, flash: .3, casing: .85, smoke: .7, weight: 1, ...o });
  const pistol = (o) => ({ hip: [.14, -.138, -.44], eye: .46, kz: .4, kp: 1.3, ky: .24, kr: .44, travel: .036, cycle: .1, flash: .18, casing: .62, smoke: .55, weight: 1.15, ...o });
  const blade = (dur, w) => ({ hip: [.21, -.16, -.34], rot: [.1, .3, .4], eye: .4, kz: 0, kp: 0, ky: 0, kr: 0, travel: 0, cycle: .1, flash: 0, casing: 0, smoke: 0, weight: w, noAim: true, act: { dur } });
  Object.assign(FEEL, {
    bpc: rifle({ hip: [.15, -.155, -.4], eye: .24, kz: .27, kp: .44, ky: .14, weight: .98 }),
    cqc: rifle({ eye: .22, kz: .3, kp: .55, ky: .2, kr: .24, flash: .34, cycle: .06, weight: .9 }),
    hbr: rifle({ eye: .32, kz: .62, kp: 1.1, ky: .24, kr: .34, travel: .064, cycle: .12, flash: .44, casing: 1.1, smoke: 1.1, weight: 1.3 }),
    ssr: rifle({ eye: .46, kz: .24, kp: .38, ky: .12, flash: 0, smoke: 0, casing: .8, weight: 1.02 }),
    dsmg: rifle({ hip: [.15, -.148, -.41], eye: .46, kz: .24, kp: .4, ky: .19, kr: .2, travel: .046, cycle: .065, flash: .24, casing: .72, smoke: .5, weight: 1.12 }),
    ssmg: rifle({ hip: [.15, -.145, -.41], eye: .2, kz: .17, kp: .28, ky: .14, kr: .14, travel: .042, cycle: .06, flash: 0, casing: .62, smoke: 0, weight: .88 }),
    fsmg: rifle({ hip: [.15, -.14, -.4], eye: .2, kz: .2, kp: .34, ky: .2, kr: .2, travel: .04, cycle: .05, flash: .18, casing: .6, smoke: .4, weight: .8 }),
    lsg: rifle({ hip: [.15, -.15, -.41], eye: .56, kz: .95, kp: 1.9, ky: .3, kr: .55, travel: .06, cycle: .1, flash: .46, casing: 1.5, hull: true, smoke: 1.5, weight: 1.15, manual: { dur: .66, delay: .08 } }),
    dsg: rifle({ hip: [.15, -.152, -.41], eye: .5, kz: .7, kp: 1.35, ky: .3, kr: .46, travel: .066, cycle: .13, flash: .42, casing: 1.45, hull: true, smoke: 1.3, weight: 1.4 }),
    sawn: rifle({ hip: [.15, -.142, -.44], eye: .46, kz: 1.25, kp: 2.6, ky: .42, kr: .8, travel: 0, cycle: .15, flash: .58, casing: 0, dropSize: 1.5, hull: true, smoke: 1.8, weight: 1 }),
    bplmg: rifle({ hip: [.16, -.158, -.4], eye: .26, kz: .3, kp: .42, ky: .18, kr: .2, travel: .056, cycle: .075, flash: .34, casing: .95, smoke: .85, weight: 1.35 }),
    dlmg: rifle({ hip: [.16, -.16, -.42], eye: .27, kz: .34, kp: .46, ky: .22, kr: .24, travel: .06, cycle: .085, flash: .36, casing: .95, smoke: .9, weight: 1.6 }),
    lsr: rifle({ eye: .55, kz: .72, kp: 1.25, ky: .2, kr: .32, travel: .06, cycle: .1, flash: .4, casing: 1.1, smoke: 1.1, weight: 1.15, manual: { dur: .72, delay: .1 } }),
    asr: rifle({ hip: [.16, -.155, -.4], eye: .12, kz: 1.05, kp: 1.6, ky: .24, kr: .4, travel: .08, cycle: .11, flash: .5, casing: 1.3, smoke: 1.4, weight: 1.5 }),
    scout: rifle({ eye: .12, kz: .85, kp: 1.4, ky: .2, kr: .34, travel: .09, cycle: .1, flash: .36, casing: 1.1, smoke: 1, weight: 1.1, manual: { dur: .92, delay: .14 } }),
    bp: pistol({ kz: .3, kp: .85, ky: .24, kr: .34, cycle: .055, flash: .19, weight: 1.1 }),
    p22: pistol({ kz: .16, kp: .42, ky: .12, kr: .18, travel: .026, cycle: .07, flash: 0, casing: .42, smoke: 0, weight: 1 }),
    lsp: pistol({ eye: .5, kz: .46, kp: 1.5, ky: .22, kr: .44, travel: .05, cycle: .12, flash: .2, casing: .68, smoke: .65, weight: 1.25 }),
    mach: blade(.46, .86), axe: blade(.94, 1.1), crow: blade(.7, 1),
  });
}
