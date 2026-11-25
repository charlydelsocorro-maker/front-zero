// FRONT ZÉRO — engine helper: pooled projectiles (rockets, launcher grenades, crossbow bolts, thrown frags) and explosions.
// Everything is preallocated: no allocation while projectiles fly or explode. Motion is swept (ray against the spatial grid and
// the actor hitboxes for the whole step), so nothing tunnels whatever the speed or the frame time.
//
// ctx = { scene, grid, fx, audio, actors, rules, isEnemy(a,b),
//   hitActors(owner,ox,oy,oz,dx,dy,dz,tMax) -> actor|null (fills ctx.hit.t / ctx.hit.head), hit:{t,head},
//   damage(victim, amount, by, weaponId, dirX, dirZ, force, head, splash) -> boolean,
//   knock(actor, ix, iy, iz), shake(k), surface(solid|null) -> 'sand'|'concrete'|..., density() -> 0..1.5,
//   onExplode(x,y,z,radius,by,weaponId,pid,visual), camPos (THREE.Vector3) }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAXP = 40, K_ROCKET = 0, K_GREN = 1, K_BOLT = 2, K_FRAG = 3;
const H = 1 / 120, MAX_STEPS = 14;       // fixed physics step: the same trajectory on every client, whatever the frame rate
const SURF_COL = { sand: 0x9a8a68, concrete: 0x8a8880, metal: 0x77736a, wood: 0x7a5c3a, snow: 0xe8eef4 };
/** Contact per surface: e restitution, mu sliding friction during an impact, roll rolling resistance (m/s²). */
const SURF_PHYS = { sand: { e: 0.22, mu: 0.72, roll: 5.5 }, concrete: { e: 0.5, mu: 0.42, roll: 1.7 }, metal: { e: 0.6, mu: 0.3, roll: 1.2 }, wood: { e: 0.42, mu: 0.5, roll: 2.3 }, snow: { e: 0.1, mu: 0.85, roll: 7.5 } };
const rnd = (a, b) => a + Math.random() * (b - a);
/** Splash damage model (documented for tests): full damage at the centre, 10 % at the edge of the radius, nothing beyond. */
export const splashFalloff = (d, radius) => (d >= radius ? 0 : 1 - 0.9 * d / radius);
/** Cover model: 3 sight lines (shins, chest, head). 3 clear = 1, 2 = 0.8, 1 = 0.6, none = 0.15 (concussion only). */
export const coverFactor = clear => (clear <= 0 ? 0.15 : 0.4 + 0.2 * clear);
/** Blast pressure felt at distance d, 1 at the centre, about 0.5 at 0.38 R, 0 at R. Drives the push only, never the damage. */
export const blastPressure = (d, radius) => { if (d >= radius) return 0; const u = d / radius, q = u / 0.38; return (1 - u * u * u * u) / (1 + q * q); };
/* Rocket flight: ejection from the tube, motor ignition, boost along the body axis, burnout, then a ballistic arc with quadratic drag. */
let rax = 0, ray = 0, raz = 0, seed = 0;
const seeded = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
function rocketAccel(f, t, vx, vy, vz, tx, ty, tz) {
  const end = f.ign + f.burn, sp = Math.sqrt(vx * vx + vy * vy + vz * vz), gf = t < end ? f.boostG : Math.min(1, f.boostG + (1 - f.boostG) * (t - end) / f.ramp);
  rax = -f.drag * sp * vx; ray = -f.drag * sp * vy - f.g * gf; raz = -f.drag * sp * vz;
  if (t >= f.ign && t < end) { rax += f.thrust * tx; ray += f.thrust * ty; raz += f.thrust * tz; }
}
/** Flat-fire time of flight (s) and drop (m) against horizontal range, every 5 m up to 300 m: bots aim with it. */
export function rocketTable(f) {
  const N = 61, tof = new Float32Array(N), drop = new Float32Array(N);
  let x = 0, y = 0, vx = f.eject, vy = 0, t = 0, i = 1;
  while (t < 8 && i < N) {
    rocketAccel(f, t, vx, vy, 0, 1, 0, 0); vx += rax * H; vy += ray * H;
    const px = x, py = y; x += vx * H; y += vy * H;
    while (i < N && x >= i * 5) { const u = (i * 5 - px) / (x - px); tof[i] = t + u * H; drop[i] = -(py + (y - py) * u); i++; }
    t += H;
  }
  for (; i < N; i++) { tof[i] = tof[i - 1] + 5 / Math.max(vx, 12); drop[i] = drop[i - 1] + 1.5; }
  const at = (a, r) => { const q = Math.min(N - 1.001, Math.max(0, r / 5)), k = q | 0; return a[k] + (a[k + 1] - a[k]) * (q - k); };
  return { tof: r => at(tof, r), drop: r => at(drop, r) };
}
export const kindOf = def => (def.kind === 'thrown' ? K_FRAG : def.id === 'rl' ? K_ROCKET : def.proj && def.proj.radius > 0 ? K_GREN : K_BOLT);

/* ---------- instanced billboard particles (one draw call per blend mode) ---------- */
const PVERT = `attribute vec3 iPos;attribute vec4 iCol;attribute vec3 iPar;varying vec2 vUv;varying vec4 vCol;varying float vMode;
#include <common>
#include <fog_pars_vertex>
void main(){vUv=position.xy*2.;vCol=iCol;vMode=iPar.z;
 vec4 mvPosition=modelViewMatrix*vec4(iPos,1.);float c=cos(iPar.y),s=sin(iPar.y);
 mvPosition.xy+=vec2(c*position.x-s*position.y,s*position.x+c*position.y)*iPar.x;
 gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
}`;
const PFRAG = `varying vec2 vUv;varying vec4 vCol;varying float vMode;
#include <common>
#include <fog_pars_fragment>
void main(){float r=length(vUv);if(r>1.)discard;
 float a=vMode>1.5?1.-smoothstep(.75,1.,r):vMode>.5?smoothstep(.5,.86,r)*(1.-smoothstep(.9,1.,r)):1.-smoothstep(.05,1.,r);
 gl_FragColor=vec4(vCol.rgb,vCol.a*a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 #ifdef USE_FOG
  #ifdef FOG_EXP2
   float fogFactor=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
  #else
   float fogFactor=smoothstep(fogNear,fogFar,vFogDepth);
  #endif
  #ifdef FZ_ADD
   gl_FragColor.rgb*=1.-fogFactor;
  #else
   gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogFactor);
  #endif
 #endif
}`;
function makeParticles(scene, N, additive) {
  // per particle: position, velocity, colour (start), life, max life, size start/end, alpha, gravity, drag, mode (0 soft disc, 1 ring, 2 hard disc)
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), col = new Float32Array(N * 4), par = new Float32Array(N * 3);
  const life = new Float32Array(N), max = new Float32Array(N), s0 = new Float32Array(N), s1 = new Float32Array(N), al = new Float32Array(N), grav = new Float32Array(N), drag = new Float32Array(N), spin = new Float32Array(N), fade = new Float32Array(N);
  const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position);
  const aPos = new THREE.InstancedBufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), aCol = new THREE.InstancedBufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage), aPar = new THREE.InstancedBufferAttribute(par, 3).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iPos', aPos); g.setAttribute('iCol', aCol); g.setAttribute('iPar', aPar); g.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), vertexShader: PVERT, fragmentShader: PFRAG, defines: additive ? { FZ_ADD: 1 } : {},
    transparent: true, depthWrite: false, fog: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = additive ? 6 : 5; mesh.visible = false; scene.add(mesh);
  let head = 0, live = false; const c = new THREE.Color();
  return {
    mesh,
    /** One particle. size0 -> size1 over its life; alpha fades out over the last `fadeFrom` share of the life. */
    emit(x, y, z, vx, vy, vz, hex, bright, alpha, lifeS, size0, size1, gravity, dragK, mode, fadeFrom) {
      const i = head, k = i * 3, q = i * 4; head = (head + 1) % N;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; vel[k] = vx; vel[k + 1] = vy; vel[k + 2] = vz;
      c.set(hex); col[q] = c.r * bright; col[q + 1] = c.g * bright; col[q + 2] = c.b * bright; col[q + 3] = alpha;
      life[i] = max[i] = lifeS; s0[i] = size0; s1[i] = size1; al[i] = alpha; grav[i] = gravity; drag[i] = dragK; fade[i] = fadeFrom || 1;
      par[k] = size0; par[k + 1] = Math.random() * 6.28; par[k + 2] = mode || 0; spin[i] = mode ? 0 : rnd(-0.8, 0.8);
      if (!live) { live = true; mesh.visible = true; }
    },
    update(dt) {
      if (!live) return;
      let any = false;
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        const k = i * 3, q = i * 4; life[i] -= dt;
        if (life[i] <= 0) { par[k] = 0; col[q + 3] = 0; continue; }
        any = true;
        const d = drag[i] > 0 ? Math.exp(-drag[i] * dt) : 1;
        vel[k] *= d; vel[k + 1] = vel[k + 1] * d - grav[i] * dt; vel[k + 2] *= d;
        pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
        if (pos[k + 1] < 0.02 && grav[i] > 0) { pos[k + 1] = 0.02; vel[k + 1] *= -0.25; vel[k] *= 0.5; vel[k + 2] *= 0.5; }
        const u = 1 - life[i] / max[i];
        par[k] = s0[i] + (s1[i] - s0[i]) * (1 - (1 - u) * (1 - u)); par[k + 1] += spin[i] * dt;
        const f = fade[i]; col[q + 3] = al[i] * (u < 1 - f ? 1 : (1 - u) / f);
      }
      aPos.needsUpdate = true; aCol.needsUpdate = true; aPar.needsUpdate = true;
      if (!any) { live = false; mesh.visible = false; }
    },
    clear() { life.fill(0); for (let i = 0; i < N; i++) { par[i * 3] = 0; col[i * 4 + 3] = 0; } aCol.needsUpdate = true; aPar.needsUpdate = true; live = false; mesh.visible = false; },
    get live() { return live; },
  };
}

/* ---------- projectile models (vertex-coloured, one instanced mesh per kind) ---------- */
function paint(g, hex) { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; }
const cyl = (r0, r1, len, z, hex, seg = 8) => { const g = new THREE.CylinderGeometry(r1, r0, len, seg); g.rotateX(Math.PI / 2); g.translate(0, 0, z); return paint(g, hex); };
const box = (w, h, d, x, y, z, hex) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, hex); };
function models() {
  // all models point along +Z
  const rocket = mergeGeometries([cyl(0.045, 0.045, 0.46, 0, 0x4a5236), cyl(0.045, 0.006, 0.14, 0.3, 0x23261d), cyl(0.03, 0.045, 0.06, -0.26, 0x1a1b17),
    box(0.16, 0.012, 0.1, 0, 0, -0.2, 0x2c3023), box(0.012, 0.16, 0.1, 0, 0, -0.2, 0x2c3023), cyl(0.047, 0.047, 0.03, 0.14, 0xb0892c)]);
  const gren = mergeGeometries([cyl(0.04, 0.04, 0.08, 0, 0x3d4332), cyl(0.04, 0.012, 0.05, 0.065, 0xb0892c), cyl(0.036, 0.04, 0.02, -0.05, 0x8d8a76)]);
  const bolt = mergeGeometries([cyl(0.009, 0.009, 0.44, 0, 0x2a2c26, 6), cyl(0.014, 0.001, 0.07, 0.25, 0xa9aeb2, 6), box(0.05, 0.004, 0.08, 0, 0, -0.19, 0xb5441f), box(0.004, 0.05, 0.08, 0, 0, -0.19, 0xb5441f)]);
  const body = new THREE.SphereGeometry(0.052, 10, 8); body.scale(1, 1, 1.18);
  const frag = mergeGeometries([paint(body, 0x3e4a30), cyl(0.022, 0.018, 0.035, 0.07, 0x8d8a76), box(0.014, 0.05, 0.075, 0, 0.035, 0.045, 0x9a9f9a), cyl(0.054, 0.054, 0.012, 0, 0x2b3322, 10)]);
  return [rocket, gren, bolt, frag];
}

export function createProjectiles(ctx) {
  const { scene, grid, fx, actors } = ctx, hit = ctx.hit;
  const audio = ctx.audio || {};
  /* ---- pooled state ---- */
  const pool = []; for (let i = 0; i < MAXP; i++) pool.push({ i, live: false, kind: 0, def: null, owner: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, dx: 0, dy: 0, dz: 1, fuse: 0, age: 0, mul: 1, visual: false, pid: 0, rest: false, stuck: false, wait: 0, ox: 0, oy: 0, oz: 0, roll: 0, trail: 0, radius: 0, bounceT: 0, travel: 0, acc: 0, adx: 0, ady: 0, adz: 1, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, s1: 0, s2: 0, b1: 0, b2: 0, lit: false, flameT: 0, spin: 0, lastC: -1 });
  const stats = { live: 0, peak: 0, spawned: 0, exploded: 0, dropped: 0 };
  let pidSeq = 0, depth = 0;
  const add = makeParticles(scene, 320, true), alp = makeParticles(scene, 448, false);
  const geos = models(), mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const inst = geos.map(g => { const m = new THREE.InstancedMesh(g, mat, MAXP); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.visible = false; scene.add(m); return m; });
  // One flash light, always in the scene with intensity 0 when idle, so the light count (and every lit shader) never changes.
  const light = new THREE.PointLight(0xffa040, 0, 26, 1.6); light.position.set(0, -50, 0); scene.add(light); let lightT = 0, lightI = 0;
  /* scorch decals: one instanced draw call */
  const DEC = 20, dAlpha = new Float32Array(DEC), dLife = new Float32Array(DEC); let dHead = 0, dLive = false;
  const dGeo = new THREE.PlaneGeometry(1, 1); dGeo.setAttribute('iA', new THREE.InstancedBufferAttribute(dAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  const dMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    vertexShader: `attribute float iA;varying vec2 vUv;varying float vA;
#include <common>
#include <fog_pars_vertex>
void main(){vUv=position.xy*2.;vA=iA;vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
}`,
    fragmentShader: `varying vec2 vUv;varying float vA;
#include <common>
#include <fog_pars_fragment>
void main(){float r=length(vUv);if(r>1.)discard;float n=fract(sin(dot(floor(vUv*9.),vec2(12.9898,78.233)))*43758.5453);
 float a=(1.-smoothstep(.25+n*.2,1.,r))*vA;gl_FragColor=vec4(vec3(.012,.011,.01),a*.86);
 #include <fog_fragment>
}`,
  });
  const decals = new THREE.InstancedMesh(dGeo, dMat, DEC); decals.frustumCulled = false; decals.renderOrder = 2; decals.visible = false; decals.castShadow = false; scene.add(decals);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), ZAX = new THREE.Vector3(0, 0, 1), XAX = new THREE.Vector3(1, 0, 0), NV = new THREE.Vector3(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < DEC; i++) decals.setMatrixAt(i, ZERO);
  const snd = { x: 0, y: 0, z: 0, size: 1, own: false };
  const at = (x, y, z) => { snd.x = x; snd.y = y; snd.z = z; return snd; };
  const call = (name, a, b) => { const f = audio[name]; if (typeof f === 'function') { try { f.call(audio, a, b); } catch { /* audio is optional */ } } };

  function release(p) { if (p.live) { p.live = false; stats.live--; } }
  function scorch(x, y, z, nx, ny, nz, size) {
    const i = dHead; dHead = (dHead + 1) % DEC;
    NV.set(nx, ny, nz); Q.setFromUnitVectors(ZAX, NV); Q2.setFromAxisAngle(ZAX, Math.random() * 6.28); Q.multiply(Q2);
    V.set(x + nx * 0.03, y + ny * 0.03, z + nz * 0.03); S1.set(size, size, 1); M.compose(V, Q, S1); S1.set(1, 1, 1);
    decals.setMatrixAt(i, M); decals.instanceMatrix.needsUpdate = true; dAlpha[i] = 1; dLife[i] = 26; dGeo.attributes.iA.needsUpdate = true;
    dLive = true; decals.visible = true;
  }

  /* ---- explosion ---- */
  const vict = [], vDmg = new Float32Array(64), vDx = new Float32Array(64), vDz = new Float32Array(64), vK = new Float32Array(64), vP = new Float32Array(64), vL = new Float32Array(64);
  const pend = []; for (let i = 0; i < 8; i++) pend.push({ on: false, x: 0, y: 0, z: 0, radius: 0, damage: 0, by: null, weaponId: null, self: 1, mul: 1 });
  const xo = { radius: 5, damage: 100, by: null, weaponId: null, self: 1, mul: 1, nx: 0, ny: 0, nz: 0, visual: false, pid: 0, surface: null };
  function blastFx(x, y, z, radius, nx, ny, nz, surf) {
    const k = ctx.density ? ctx.density() : 1, s = radius / 5, up = ny > 0.5;
    add.emit(x + nx * 0.3, y + ny * 0.3 + 0.2, z + nz * 0.3, 0, 0, 0, 0xfff1c9, 5, 1, 0.11, radius * 0.9, radius * 0.25, 0, 0, 0, 1);            // white-hot flash
    add.emit(x, y + 0.15, z, 0, 0, 0, 0xffd9a0, 1.6, 0.55, 0.3, radius * 0.25, radius * 1.45, 0, 0, 1, 0.8);                                   // shockwave ring
    const nf = Math.max(3, Math.round(7 * k));
    for (let i = 0; i < nf; i++) add.emit(x + rnd(-0.3, 0.3) * radius * 0.5, y + rnd(0.1, 0.5) * radius * 0.4, z + rnd(-0.3, 0.3) * radius * 0.5, rnd(-1.5, 1.5) * s, rnd(1.2, 3.6) * s, rnd(-1.5, 1.5) * s, i & 1 ? 0xff7a1c : 0xffb347, rnd(1.6, 2.6), 0.9, rnd(0.32, 0.56), radius * rnd(0.28, 0.42), radius * rnd(0.6, 0.9), -1.5, 1.2, 0, 0.7);
    const ns = Math.round(14 * k);
    for (let i = 0; i < ns; i++) { const a = rnd(0, 6.28), e = rnd(0.15, 1.3), sp = rnd(7, 17) * (0.7 + s * 0.3), c = Math.cos(e); add.emit(x, y + 0.15, z, Math.cos(a) * c * sp + nx * 4, Math.sin(e) * sp + ny * 3, Math.sin(a) * c * sp + nz * 4, 0xffc66a, 3, 1, rnd(0.45, 0.95), rnd(0.07, 0.12), 0.02, 15, 0.6, 2, 0.5); }
    const nm = Math.max(3, Math.round(9 * k));
    for (let i = 0; i < nm; i++) { const g = rnd(0.07, 0.2); alp.emit(x + rnd(-0.35, 0.35) * radius * 0.5, y + rnd(0.2, 0.9) * radius * 0.3, z + rnd(-0.35, 0.35) * radius * 0.5, rnd(-1.1, 1.1) * s, rnd(1.1, 2.9) * s, rnd(-1.1, 1.1) * s, 0xffffff, g, rnd(0.62, 0.84), rnd(1.9, 3.3), radius * rnd(0.3, 0.44), radius * rnd(0.8, 1.2), -0.3, 0.9, 0, 0.7); }
    const nd = Math.round(10 * k), dc = SURF_COL[surf] || 0x6a6458;
    for (let i = 0; i < nd; i++) { const a = rnd(0, 6.28), e = rnd(0.35, 1.35), sp = rnd(5, 12), c = Math.cos(e); alp.emit(x, y + 0.12, z, Math.cos(a) * c * sp + nx * 3, Math.sin(e) * sp + ny * 2, Math.sin(a) * c * sp + nz * 3, dc, rnd(0.25, 0.6), 1, rnd(0.8, 1.4), rnd(0.07, 0.17), 0.05, 17, 0.3, 2, 0.3); }
    if (up) { const nr = Math.round(8 * k); for (let i = 0; i < nr; i++) { const a = i / Math.max(1, nr) * 6.28 + rnd(-0.3, 0.3), sp = rnd(4, 7) * s; alp.emit(x + Math.cos(a) * 0.5, y + 0.2, z + Math.sin(a) * 0.5, Math.cos(a) * sp, rnd(0.2, 0.9), Math.sin(a) * sp, dc, 0.75, 0.42, rnd(0.8, 1.3), 0.5 * s, 1.9 * s, 0, 2.4, 0, 0.8); } }
    light.position.set(x + nx * 0.6, y + ny * 0.6 + 0.5, z + nz * 0.6); light.distance = Math.max(14, radius * 5); lightI = 70 * (0.6 + s * 0.4); lightT = 0.2; light.intensity = lightI;
    if (nx || ny || nz) scorch(x, y, z, nx, ny, nz, radius * rnd(0.7, 0.95));
    try { fx.puff(x, y + 0.2, z, 0xffc070, 8, 4); } catch { /* optional */ }
  }
  /** Blast at a point: radial falloff, cover attenuation, self-damage, knockback, FX, audio. Safe to call from a kill listener. */
  function explode(x, y, z, o) {
    o = o || xo;
    const radius = o.radius > 0 ? o.radius : 5, damage = o.damage || 0, by = o.by || null, weaponId = o.weaponId || null, self = o.self === undefined ? 1 : o.self, mul = o.mul === undefined ? 1 : o.mul, visual = !!o.visual;
    if (!(x === x && y === y && z === z)) return;
    if (depth > 0) {       // called from inside another blast (a listener reacting to a kill): run it right after
      for (let i = 0; i < pend.length; i++) { const q = pend[i]; if (q.on) continue; q.on = true; q.x = x; q.y = y; q.z = z; q.radius = radius; q.damage = damage; q.by = by; q.weaponId = weaponId; q.self = self; q.mul = mul; return; }
      return;
    }
    depth++; stats.exploded++;
    let nx = o.nx || 0, ny = o.ny || 0, nz = o.nz || 0, surf = o.surface || null;
    if (!nx && !ny && !nz) {       // no contact normal (fuse in the air or a mode's blast): look for the floor just below
      const tg = grid.ray(x, y + 0.05, z, 0, -1, 0, 1.4);
      if (tg < 1.4) { ny = 1; y = y + 0.05 - tg; surf = ctx.surface ? ctx.surface(grid.hit) : null; }
    }
    const ox = x + nx * 0.22, oy = Math.max(0.12, y + ny * 0.22 + (ny > 0.5 ? 0.1 : 0)), oz = z + nz * 0.22;
    let n = 0;
    for (let i = 0; i < actors.length && n < 64; i++) {
      const a = actors[i]; if (!a.alive) continue;
      const hs = a.hScale || 1, ch = a.crouch > 0.5 ? 0.72 : 1, top = 1.7 * hs * ch;
      const cy = oy < a.pos.y + 0.15 ? a.pos.y + 0.15 : oy > a.pos.y + top ? a.pos.y + top : oy;
      const dx = a.pos.x - ox, dy = cy - oy, dz = a.pos.z - oz, dh = Math.sqrt(dx * dx + dz * dz);
      const d = Math.max(0, Math.sqrt(dx * dx + dy * dy + dz * dz) - 0.3 * (a.rScale || 1));
      if (d >= radius) continue;
      let clear = 0;
      if (grid.los(ox, oy, oz, a.pos.x, a.pos.y + 0.25 * hs, a.pos.z)) clear++;
      if (grid.los(ox, oy, oz, a.pos.x, a.pos.y + 0.95 * hs * ch, a.pos.z)) clear++;
      if (grid.los(ox, oy, oz, a.pos.x, a.pos.y + 1.55 * hs * ch, a.pos.z)) clear++;
      const k = splashFalloff(d, radius) * coverFactor(clear);
      vict[n] = a; vK[n] = k; vDmg[n] = damage * k * (a === by ? self : mul);
      vP[n] = blastPressure(d, radius) * coverFactor(clear);       // the push: pressure wave, reduced by cover
      { const up = (a.pos.y + 1.9 - oy) / 1.6; vL[n] = up < 0.1 ? 0.1 : up > 1 ? 1 : up; }       // a blast overhead does not lift
      if (dh > 0.05) { vDx[n] = dx / dh; vDz[n] = dz / dh; } else { const r = Math.random() * 6.28; vDx[n] = Math.cos(r); vDz[n] = Math.sin(r); }
      n++;
    }
    // announced before the damage: online, the server must know the detonation before the splash hits that refer to it
    if (ctx.onExplode) { try { ctx.onExplode(x, y, z, radius, by, weaponId, o.pid || 0, visual); } catch (e) { console.error('[projectiles] onExplode', e); } }
    // bodies already on the ground are thrown by the wave (those this blast kills get their push in the engine's kill())
    if (ctx.bodyBlast) for (let i = 0; i < actors.length; i++) {
      const a = actors[i]; if (a.alive || !a.sol || !a.sol.dead) continue;
      const bx = a.pos.x - ox, bz = a.pos.z - oz, rr = radius + 1.2; if (bx * bx + bz * bz > rr * rr || Math.abs(a.pos.y - oy) > rr) continue;
      ctx.bodyBlast(a, ox, oy, oz, radius, grid.los(ox, oy, oz, a.pos.x, a.pos.y + 0.4, a.pos.z) ? 1 : 0.25);
    }
    for (let i = 0; i < n; i++) {
      const a = vict[i], k = vK[i], pk = vP[i]; vict[i] = null;
      if (!visual && vDmg[i] > 0.5 && a.alive) ctx.damage(a, vDmg[i], by, weaponId, vDx[i], vDz[i], 1.8 + 2.8 * k, false, true);
      if (a.alive && pk > 0.05 && (!visual || a.isPlayer) && !(a === by && self <= 0)) ctx.knock(a, vDx[i] * 10.5 * pk, (1.2 + 4.6 * pk) * vL[i], vDz[i] * 10.5 * pk);
    }
    blastFx(x, y, z, radius, nx, ny, nz, surf);
    const cp = ctx.camPos; if (cp && ctx.shake) { const cd = Math.hypot(cp.x - x, cp.y - y, cp.z - z); if (cd < radius * 6) ctx.shake(Math.min(1, (1 - cd / (radius * 6)) * (0.5 + radius * 0.12))); }
    snd.size = radius / 5; call('explosion', at(x, y, z));
    depth--;
    if (depth === 0) for (let i = 0; i < pend.length; i++) { const q = pend[i]; if (!q.on) continue; q.on = false; xo.radius = q.radius; xo.damage = q.damage; xo.by = q.by; xo.weaponId = q.weaponId; xo.self = q.self; xo.mul = q.mul; xo.nx = xo.ny = xo.nz = 0; xo.visual = false; xo.pid = 0; xo.surface = null; explode(q.x, q.y, q.z, xo); q.by = null; }
  }
  function detonate(p, nx, ny, nz, solid) {
    const d = p.def, pr = d.proj; release(p);
    if (p.visual) return;
    xo.radius = pr.radius; xo.damage = d.dmg; xo.by = p.owner; xo.weaponId = d.id; xo.self = pr.self === undefined ? 1 : pr.self; xo.mul = p.mul; xo.nx = nx; xo.ny = ny; xo.nz = nz; xo.visual = false; xo.pid = p.pid;
    xo.surface = nx || ny || nz ? (ctx.surface ? ctx.surface(solid || null) : null) : null;
    explode(p.x, p.y, p.z, xo); xo.by = null;
  }

  /* ---- flight ---- */
  let fnx = 0, fny = 0, fnz = 0, fnd = 0; const obuf = [];
  function faceNormal(s, x, y, z) {       // which face of the box the contact point lies on (fnd: distance to it)
    let m = Math.abs(x - s.x0); fnx = -1; fny = 0; fnz = 0; let q = Math.abs(x - s.x1);
    if (q < m) { m = q; fnx = 1; fny = 0; fnz = 0; }
    q = Math.abs(y - s.y0); if (q < m) { m = q; fnx = 0; fny = -1; fnz = 0; }
    q = Math.abs(y - s.y1); if (q < m) { m = q; fnx = 0; fny = 1; fnz = 0; }
    q = Math.abs(z - s.z0); if (q < m) { m = q; fnx = 0; fny = 0; fnz = -1; }
    q = Math.abs(z - s.z1); if (q < m) { m = q; fnx = 0; fny = 0; fnz = 1; }
    fnd = m;
  }
  function trail(p, dist) {
    const k = ctx.density ? ctx.density() : 1; if (k <= 0) return;
    if (p.kind === K_ROCKET) {
      const f = p.def.proj.flight, burning = !f || (p.age >= f.ign && p.age < f.ign + f.burn);
      if (f && p.age < f.ign) return;       // still coasting out of the tube: the motor is cold
      p.trail += dist; const step = (burning ? 0.85 : 2.4) / Math.max(0.35, k);
      while (p.trail >= step) {
        p.trail -= step; const back = 0.3 + Math.min(dist, p.trail), x = p.x - p.dx * back, y = p.y - p.dy * back, z = p.z - p.dz * back;
        if (burning) alp.emit(x + rnd(-0.05, 0.05), y + rnd(-0.05, 0.05), z + rnd(-0.05, 0.05), -p.dx * 2.4 + rnd(-0.4, 0.4), rnd(0.1, 0.6), -p.dz * 2.4 + rnd(-0.4, 0.4), 0xffffff, rnd(0.55, 0.82), 0.54, rnd(1.1, 1.8), 0.16, rnd(0.62, 0.92), -0.3, 1.6, 0, 0.8);
        else alp.emit(x, y, z, rnd(-0.15, 0.15), rnd(0.05, 0.3), rnd(-0.15, 0.15), 0xffffff, rnd(0.7, 0.88), 0.15, rnd(0.6, 1.0), 0.07, rnd(0.24, 0.36), -0.15, 1.2, 0, 0.9);
      }
      if (burning && p.age >= p.flameT) {       // exhaust: a time-based emitter, so the flame looks the same at any frame rate
        p.flameT = p.age + 0.02;
        add.emit(p.x - p.dx * 0.34, p.y - p.dy * 0.34, p.z - p.dz * 0.34, 0, 0, 0, 0xffb040, 4, 1, 0.05, 0.46, 0.2, 0, 0, 0, 1);
        add.emit(p.x - p.dx * 0.6, p.y - p.dy * 0.6, p.z - p.dz * 0.6, -p.dx * 6, -p.dy * 6, -p.dz * 6, 0xff6a1a, 2.4, 0.9, 0.09, 0.34, 0.08, 0, 0, 0, 1);
      }
    } else if (p.kind === K_GREN) {
      p.trail += dist; if (p.trail >= 1.1) { p.trail = 0; alp.emit(p.x, p.y, p.z, 0, 0.2, 0, 0xffffff, 0.75, 0.22, 0.5, 0.07, 0.24, 0, 1, 0, 0.9); }
    }
  }
  /** Motor lights: a short flash and a burst of smoke at the nozzle. */
  function ignite(p) {
    const k = ctx.density ? ctx.density() : 1, x = p.x - p.dx * 0.34, y = p.y - p.dy * 0.34, z = p.z - p.dz * 0.34;
    add.emit(x, y, z, 0, 0, 0, 0xffd28a, 4.5, 1, 0.09, 1.15, 0.4, 0, 0, 0, 1);
    const n = Math.max(2, Math.round(4 * k));
    for (let i = 0; i < n; i++) alp.emit(x, y, z, -p.dx * rnd(2, 5) + rnd(-1.2, 1.2), rnd(-0.3, 1), -p.dz * rnd(2, 5) + rnd(-1.2, 1.2), 0xffffff, rnd(0.5, 0.75), 0.6, rnd(0.8, 1.3), 0.2, rnd(0.8, 1.2), -0.2, 2.4, 0, 0.8);
  }
  /** Launch: flame and smoke out of the back of the tube, reflected by a wall close behind, dust on the floor, one positional thump. */
  function backblast(p, ax, ay, az) {
    const k = ctx.density ? ctx.density() : 1, dx = p.adx, dy = p.ady, dz = p.adz, wall = grid.ray(ax, ay, az, -dx, -dy, -dz, 4.2), rb = wall < 4.2 ? -0.45 : 1;
    const nf = Math.max(3, Math.round(6 * k)), ns = Math.max(5, Math.round(13 * k));
    for (let i = 0; i < nf; i++) { const sp = rnd(7, 16) * rb; add.emit(ax - dx * rnd(0.05, 0.6), ay - dy * rnd(0.05, 0.6), az - dz * rnd(0.05, 0.6), -dx * sp + rnd(-1.6, 1.6), -dy * sp + rnd(-1.2, 1.2), -dz * sp + rnd(-1.6, 1.6), i & 1 ? 0xff9a3a : 0xffc66a, rnd(1.7, 2.8), 0.85, rnd(0.07, 0.15), rnd(0.32, 0.6), rnd(0.7, 1.15), 0, 3, 0, 1); }
    for (let i = 0; i < ns; i++) { const sp = rnd(4, 15) * rb; alp.emit(ax - dx * rnd(0.1, 1), ay - dy * rnd(0.1, 1), az - dz * rnd(0.1, 1), -dx * sp + rnd(-2, 2), -dy * sp + rnd(-0.5, 1.6), -dz * sp + rnd(-2, 2), 0xffffff, rnd(0.42, 0.72), rnd(0.42, 0.62), rnd(0.7, 1.6), rnd(0.22, 0.4), rnd(1, 1.75), -0.25, 3.4, 0, 0.8); }
    const fl = grid.ray(ax, ay, az, 0, -1, 0, 3.2);
    if (fl < 3.2) { const dc = SURF_COL[ctx.surface ? ctx.surface(grid.hit) : 'sand'] || 0x8a8068, nd = Math.round(7 * k); for (let i = 0; i < nd; i++) { const a = rnd(0, 6.28), sp = rnd(2.5, 6.5); alp.emit(ax - dx * 0.7 + Math.cos(a) * 0.3, ay - fl + 0.12, az - dz * 0.7 + Math.sin(a) * 0.3, Math.cos(a) * sp - dx * 3 * rb, rnd(0.2, 0.9), Math.sin(a) * sp - dz * 3 * rb, dc, 0.72, 0.4, rnd(0.6, 1.1), 0.3, rnd(1, 1.6), 0, 2.6, 0, 0.8); } }
    for (let i = 0; i < 3; i++) alp.emit(p.x + p.ox + dx * 0.5, p.y + p.oy + dy * 0.5, p.z + p.oz + dz * 0.5, dx * rnd(1, 3) + rnd(-0.6, 0.6), rnd(0, 0.7), dz * rnd(1, 3) + rnd(-0.6, 0.6), 0xffffff, rnd(0.6, 0.8), 0.32, rnd(0.45, 0.8), 0.12, rnd(0.5, 0.8), -0.2, 2.6, 0, 0.8);
    if (lightT < 0.08) { light.position.set(ax - dx, ay - dy + 0.2, az - dz); light.distance = 12; lightI = 16; lightT = 0.14; light.intensity = lightI; }
    const cp = ctx.camPos; if (!cp || (cp.x - ax) * (cp.x - ax) + (cp.z - az) * (cp.z - az) < 3600) call('thump', at(ax - dx, ay - dy, az - dz));
  }
  function step(p, dt) {
    p.age += dt;
    if (p.wait > 0) { p.wait -= dt; if (p.wait <= 0) release(p); return; }
    p.fuse -= dt;
    if (p.fuse <= 0) {
      if (p.kind === K_BOLT) { release(p); return; }
      if (p.visual) { p.wait = 0.8; return; }       // the owner's client sends the real detonation
      detonate(p, 0, p.rest ? 1 : 0, 0, null); return;
    }
    if (p.stuck || p.rest) return;
    const pr = p.def.proj, fl = p.kind === K_ROCKET ? pr.flight : null;
    if (fl) {
      const t = p.age - dt; let tx = p.adx, ty = p.ady, tz = p.adz;
      if (t >= fl.ign && t < fl.ign + fl.burn) {       // seeded wobble of the thrust axis: identical for the mirror of this shot
        const w = fl.wobble * Math.exp(-1.4 * (t - fl.ign)), u = Math.sin(31 * t + p.s1) * w + p.b1, q = Math.cos(23 * t + p.s2) * w + p.b2;
        tx += p.rx * u + p.ux * q; ty += p.ry * u + p.uy * q; tz += p.rz * u + p.uz * q;
        if (!p.lit) { p.lit = true; ignite(p); }
      }
      rocketAccel(fl, t, p.vx, p.vy, p.vz, tx, ty, tz); p.vx += rax * dt; p.vy += ray * dt; p.vz += raz * dt;
    } else p.vy -= (pr.gravity || 0) * dt;
    let rem = dt;
    for (let it = 0; it < 5 && rem > 1e-5; it++) {
      const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz); if (sp < 1e-3) break;
      const dx = p.vx / sp, dy = p.vy / sp, dz = p.vz / sp, len = sp * rem;
      if (p.visual) grid.skipPane = true;       // a mirror never decides what breaks: the owner's client reports it
      const tw = grid.ray(p.x, p.y, p.z, dx, dy, dz, len), solid = grid.hit, ground = grid.ground; grid.skipPane = false;
      const v = ctx.hitActors(p.owner, p.x, p.y, p.z, dx, dy, dz, tw), th = v ? hit.t : Infinity, head = hit.head;
      p.dx = dx; p.dy = dy; p.dz = dz;
      if (v && th <= tw) {       // a body is in the way
        p.x += dx * th; p.y += dy * th; p.z += dz * th; p.travel += th; trail(p, th);
        if (p.kind === K_BOLT) {
          if (!p.visual) { const d = p.def; ctx.damage(v, d.dmg * (p.travel > d.range ? 0.55 : 1) * (head ? d.hs : 1) * p.mul, p.owner, d.id, dx, dz, 1.6, head, false); }
          try { fx.puff(p.x, p.y, p.z, v.kind === 'zombie' ? 0x3d4a16 : 0x8c1f12, 5); } catch { /* optional */ }
          release(p); return;
        }
        if (p.kind === K_FRAG) {       // a thrown grenade drops off a body
          let hx = p.x - v.pos.x, hz = p.z - v.pos.z; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
          const vn = p.vx * hx + p.vz * hz; if (vn < 0) { p.vx -= 1.25 * vn * hx; p.vz -= 1.25 * vn * hz; }
          p.vx *= 0.35; p.vz *= 0.35; p.vy *= 0.5; p.x += hx * 0.06; p.z += hz * 0.06; rem -= th / sp; continue;
        }
        if (p.visual) { p.wait = 0.8; return; }
        detonate(p, -dx, -dy, -dz, null); return;
      }
      if (tw < len) {            // the world is in the way
        if (solid && solid.pane && ctx.breakPane && ctx.breakPane(solid, p.owner, dx, dz)) continue;       // glass gives way, the round flies on
        p.x += dx * tw; p.y += dy * tw; p.z += dz * tw; p.travel += tw; trail(p, tw);
        if (solid) faceNormal(solid, p.x, p.y, p.z); else { fnx = 0; fny = 1; fnz = 0; }
        const nx = fnx, ny = fny, nz = fnz;
        if (p.kind === K_ROCKET) { if (p.visual) { p.wait = 0.8; return; } detonate(p, nx, ny, nz, solid); return; }
        if (p.kind === K_BOLT) {
          p.stuck = true; p.x -= dx * 0.16; p.y -= dy * 0.16; p.z -= dz * 0.16; p.fuse = Math.min(p.fuse, 9); p.vx = p.vy = p.vz = 0;
          const s = ctx.surface ? ctx.surface(solid || null) : 'concrete';
          try { fx.puff(p.x + dx * 0.16, p.y + dy * 0.16, p.z + dz * 0.16, SURF_COL[s] || 0x9a8a68, 4); } catch { /* optional */ }
          call('impact', s, at(p.x, p.y, p.z)); return;
        }
        const sfn = ctx.surface ? ctx.surface(solid || null) : 'concrete', sf = SURF_PHYS[sfn] || SURF_PHYS.concrete, e = sf.e * (pr.bounce || 0) / 0.4, vn = p.vx * nx + p.vy * ny + p.vz * nz;
        let lift = 0.02;
        if (vn < 0) {
          const imp = -vn; p.vx -= vn * nx; p.vy -= vn * ny; p.vz -= vn * nz;       // tangential part
          const tl = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz), back = imp * e;
          if (back > 0.8) {        // a real bounce: Coulomb friction takes tangential speed in proportion to the normal impulse, and sets the spin
            const left = tl > 1e-4 ? Math.max(0, tl - sf.mu * (1 + e) * imp) / tl : 0; p.vx *= left; p.vy *= left; p.vz *= left;
            p.vx += nx * back; p.vy += ny * back; p.vz += nz * back; p.spin = p.spin * 0.45 + tl * left / 0.05 * 0.55;
          } else {                 // in contact: rolling, slowed by the surface over the real time since the last contact
            const el = Math.min(0.05, p.lastC >= 0 ? p.age - p.lastC : dt), left = tl > 1e-4 ? Math.max(0, tl - sf.roll * Math.max(el, dt) - (imp > 1.2 ? sf.mu * (1 + e) * imp : 0)) / tl : 0;
            p.vx *= left; p.vy *= left; p.vz *= left; p.spin = tl * left / 0.05; lift = 0.006;
          }
          p.lastC = p.age;
          if (imp > 2.2 && p.bounceT <= 0) { p.bounceT = 0.09; snd.size = Math.min(1, imp / 12); call('bounce', sfn, at(p.x, p.y, p.z)); }
        }
        p.x += nx * lift; p.y += ny * lift; p.z += nz * lift; rem -= tw / sp;
        for (let k = 0; k < 2; k++) {       // a tight corner: stepping off one face must not put the round inside the neighbouring solid
          const o = grid.overlap(p.x - 1e-3, p.x + 1e-3, p.y - 1e-3, p.y + 1e-3, p.z - 1e-3, p.z + 1e-3, obuf); if (!o) break;
          faceNormal(o, p.x, p.y, p.z); const push = fnd + 0.03; p.x += fnx * push; p.y += fny * push; p.z += fnz * push;
          const v2 = p.vx * fnx + p.vy * fny + p.vz * fnz; if (v2 < 0) { p.vx -= v2 * fnx; p.vy -= v2 * fny; p.vz -= v2 * fnz; }
        }
        if (p.y < 0.006) p.y = 0.006;
        if (ny > 0.7 && p.vx * p.vx + p.vy * p.vy + p.vz * p.vz < 0.09) {       // comes to rest lying on its side
          p.rest = true; p.vx = p.vy = p.vz = 0; p.spin = 0; const hl = Math.sqrt(p.dx * p.dx + p.dz * p.dz);
          if (hl > 1e-3) { p.dx /= hl; p.dz /= hl; } else { p.dx = 1; p.dz = 0; } p.dy = 0; return;
        }
        continue;
      }
      p.x += dx * len; p.y += dy * len; p.z += dz * len; p.travel += len; trail(p, len); rem = 0;
    }
    if (p.y < -6 || p.x > 700 || p.x < -700 || p.z > 700 || p.z < -700 || !(p.x === p.x && p.y === p.y && p.z === p.z)) { stats.dropped++; release(p); }
  }

  const counts = [0, 0, 0, 0];
  function draw(dt) {
    counts[0] = counts[1] = counts[2] = counts[3] = 0;
    for (let i = 0; i < MAXP; i++) {
      const p = pool[i]; if (!p.live || p.wait > 0) continue;
      const k = Math.exp(-14 * dt); p.ox *= k; p.oy *= k; p.oz *= k;
      V.set(p.dx, p.dy, p.dz);
      if (p.kind === K_ROCKET && p.def.proj.flight) {       // the body visibly hunts around its axis while the motor pushes it
        const f = p.def.proj.flight; if (p.age >= f.ign && p.age < f.ign + f.burn) { const w = 0.035 * Math.exp(-1.4 * (p.age - f.ign)), u = Math.sin(31 * p.age + p.s1) * w, q = Math.cos(23 * p.age + p.s2) * w; V.x += p.rx * u + p.ux * q; V.y += p.ry * u + p.uy * q; V.z += p.rz * u + p.uz * q; V.normalize(); }
      }
      Q.setFromUnitVectors(ZAX, V);
      if ((p.kind === K_GREN || p.kind === K_FRAG) && !p.rest) { p.spin *= Math.exp(-0.4 * dt); p.roll += dt * p.spin; Q2.setFromAxisAngle(XAX, p.roll); Q.multiply(Q2); }
      else if (p.rest) { Q2.setFromAxisAngle(XAX, p.roll); Q.multiply(Q2); }
      const ex = p.rest || p.stuck ? 0 : p.acc;       // the state advances in fixed steps: drawn where it is now
      V.set(p.x + p.vx * ex + p.ox, p.y + p.vy * ex + p.oy + (p.kind === K_GREN || p.kind === K_FRAG ? 0.045 : 0), p.z + p.vz * ex + p.oz); M.compose(V, Q, S1);
      const m = inst[p.kind]; m.setMatrixAt(counts[p.kind]++, M);
    }
    for (let k = 0; k < 4; k++) { const m = inst[k]; if (m.count !== counts[k]) m.count = counts[k]; const on = counts[k] > 0; if (m.visible !== on) m.visible = on; if (on) m.instanceMatrix.needsUpdate = true; }
  }

  const api = {
    stats, pool, MAX: MAXP,
    get live() { return stats.live; },
    /**
     * Launch. (x,y,z) is the simulated origin (the eye), v the initial velocity, (mx,my,mz) the visible start (the muzzle).
     * `visual` projectiles are mirrors of another client's shot: they fly and bounce but never deal damage.
     * Returns the projectile id (unique per owner per match), or 0 when the pool is full.
     */
    spawn(def, owner, x, y, z, vx, vy, vz, mul, visual, pid, mx, my, mz, ix, iy, iz) {
      if (!def || !def.proj) return 0;
      let p = null; for (let i = 0; i < MAXP; i++) if (!pool[i].live) { p = pool[i]; break; }
      if (!p) { p = pool[0]; for (let i = 1; i < MAXP; i++) if (pool[i].fuse < p.fuse) p = pool[i]; stats.live--; }      // pool full: recycle the oldest
      const fl = def.id === 'rl' ? def.proj.flight : null; let ax = 0, ay = 0, az = 1;
      if (fl) {       // v = aim * nominal speed + inherited velocity: the rocket leaves the tube slowly along the aim and keeps the inherited part
        const qx = ix || 0, qy = iy || 0, qz = iz || 0; ax = vx - qx; ay = vy - qy; az = vz - qz; const al = Math.sqrt(ax * ax + ay * ay + az * az) || 1; ax /= al; ay /= al; az /= al;
        vx = ax * fl.eject + qx; vy = ay * fl.eject + qy; vz = az * fl.eject + qz;
      }
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      p.live = true; p.kind = kindOf(def); p.def = def; p.owner = owner || null; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.dx = vx / sp; p.dy = vy / sp; p.dz = vz / sp;
      p.fuse = def.proj.fuse || 6; p.age = 0; p.mul = mul === undefined || mul === null ? 1 : mul; p.visual = !!visual; p.pid = pid || ++pidSeq; p.rest = false; p.stuck = false; p.wait = 0;
      p.ox = mx === undefined ? 0 : mx - x; p.oy = my === undefined ? 0 : my - y; p.oz = mz === undefined ? 0 : mz - z; p.roll = Math.random() * 6; p.trail = 0; p.radius = def.proj.radius || 0; p.bounceT = 0; p.travel = 0; p.acc = 0; p.lit = false; p.flameT = 0; p.lastC = -1; p.spin = 8 + (Math.imul(p.pid | 0, 40503) >>> 0) % 9;
      if (fl) {
        p.adx = ax; p.ady = ay; p.adz = az; let rx = az, rz = -ax, rl = Math.sqrt(rx * rx + rz * rz); if (rl < 1e-3) { rx = 1; rz = 0; rl = 1; } rx /= rl; rz /= rl;
        p.rx = rx; p.ry = 0; p.rz = rz; p.ux = -rz * ay; p.uy = rz * ax - rx * az; p.uz = rx * ay;
        seed = Math.imul((p.pid | 0) + 1, 2654435761) >>> 0;       // seeded by the projectile id: same wobble on the mirror
        p.s1 = seeded() * 6.2832; p.s2 = seeded() * 6.2832; p.b1 = (seeded() - 0.5) * fl.wobble * 0.8; p.b2 = (seeded() - 0.5) * fl.wobble * 0.8;
        backblast(p, (mx === undefined ? x : mx) - ax * 0.95, (my === undefined ? y : my) - ay * 0.95, (mz === undefined ? z : mz) - az * 0.95);
      }
      stats.live++; stats.spawned++; if (stats.live > stats.peak) stats.peak = stats.live;
      return p.pid;
    },
    explode,
    /** Soot on a surface (the same pooled decals as a blast's): a breached wall's edges (engine-breach.js). */
    scorch(x, y, z, nx, ny, nz, size) { scorch(x, y, z, nx, ny, nz, size); },
    /** A remote client reported its detonation: drop the mirror projectile and play the blast (no damage; the server referees). */
    remoteBoom(owner, pid, x, y, z, def) {
      for (let i = 0; i < MAXP; i++) { const p = pool[i]; if (p.live && p.visual && p.owner === owner && (p.pid === pid || !pid)) { release(p); if (pid) break; } }
      if (!def || !def.proj || !(def.proj.radius > 0)) return;
      xo.radius = def.proj.radius; xo.damage = 0; xo.by = owner; xo.weaponId = def.id; xo.self = 1; xo.mul = 1; xo.nx = xo.ny = xo.nz = 0; xo.visual = true; xo.pid = pid; xo.surface = null;
      explode(x, y, z, xo); xo.by = null; xo.visual = false;
    },
    update(dt) {
      if (stats.live > 0) for (let i = 0; i < MAXP; i++) {
        const p = pool[i]; if (!p.live) continue; if (p.bounceT > 0) p.bounceT -= dt;
        p.acc += dt; let n = 0;
        while (p.live && p.acc >= H && n < MAX_STEPS) { step(p, H); p.acc -= H; n++; }
        if (n === MAX_STEPS) p.acc = 0;
      }
      draw(dt);
      add.update(dt); alp.update(dt);
      if (lightT > 0) { lightT -= dt; light.intensity = lightT > 0 ? lightI * (lightT / 0.2) * (lightT / 0.2) : 0; }
      if (dLive) {
        let any = false;
        for (let i = 0; i < DEC; i++) { if (dLife[i] <= 0) continue; dLife[i] -= dt; if (dLife[i] <= 0) { dAlpha[i] = 0; decals.setMatrixAt(i, ZERO); decals.instanceMatrix.needsUpdate = true; } else { dAlpha[i] = Math.min(1, dLife[i] / 6); any = true; } }
        dGeo.attributes.iA.needsUpdate = true; if (!any) { dLive = false; decals.visible = false; }
      }
    },
    /** A burning flare borrows the one pooled flash light, unless an explosion is using it. */
    glow(x, y, z, intensity) { if (lightT > 0.02 && lightI > intensity) return; light.position.set(x, y, z); light.distance = 15; lightI = intensity; lightT = 0.06; light.intensity = intensity; },
    /** Nearest live explosive that can hurt `a` (thrown or launched grenades, not rockets): bots run from it. Returns the pooled projectile or null. */
    threat(a) {
      if (stats.live <= 0) return null;
      let best = null, bd = Infinity;
      for (let i = 0; i < MAXP; i++) {
        const p = pool[i]; if (!p.live || p.visual || p.radius <= 0 || p.kind === K_ROCKET || p.wait > 0) continue;
        if (p.owner && p.owner !== a && !ctx.rules.friendlyFire && !ctx.isEnemy(p.owner, a)) continue;
        if (p.owner === a && !(p.def.proj.self > 0)) continue;
        const dx = p.x - a.pos.x, dz = p.z - a.pos.z, dy = p.y - a.pos.y, d = dx * dx + dz * dz; if (d > (p.radius + 2.5) * (p.radius + 2.5) || dy > 4 || dy < -4) continue;
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
    /** Remove every projectile, particle and decal (map change, new match, new round). */
    clear() {
      for (let i = 0; i < MAXP; i++) { pool[i].live = false; pool[i].owner = null; } stats.live = 0;
      for (let i = 0; i < pend.length; i++) { pend[i].on = false; pend[i].by = null; }
      add.clear(); alp.clear(); light.intensity = 0; lightT = 0; dLife.fill(0); dAlpha.fill(0); for (let i = 0; i < DEC; i++) decals.setMatrixAt(i, ZERO); decals.instanceMatrix.needsUpdate = true; dGeo.attributes.iA.needsUpdate = true; dLive = false; decals.visible = false;
      for (const m of inst) { m.count = 0; m.visible = false; }
    },
    resetIds() { pidSeq = 0; stats.peak = 0; stats.spawned = 0; stats.exploded = 0; stats.dropped = 0; },
    /** Show one of everything for the engine's warm-up frame so every shader compiles behind the loading screen. */
    warm(on) {
      if (on) { M.identity(); for (const m of inst) { m.setMatrixAt(0, M); m.count = 1; m.visible = true; m.instanceMatrix.needsUpdate = true; } add.mesh.visible = alp.mesh.visible = decals.visible = true; }
      else { for (const m of inst) { m.count = 0; m.visible = false; } add.mesh.visible = add.live; alp.mesh.visible = alp.live; decals.visible = dLive; }
    },
  };
  return api;
}
