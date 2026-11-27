// FRONT ZÉRO — world life: flags, cables, laundry, birds, steam, sparks, leaves, a working crane, distant aircraft.
// Purely visual: no collider, no gameplay state, nothing sent online. Placement is derived from the map's own solids, per environment (table ENVS).
// One shader program for everything (built before the loader's shader pass, so it links behind the loading screen), six small instanced meshes, no light.
// Wind for a future weather system: E.ambient.wind = {x, z, gust}, E.ambient.setWind(x, z).
import * as THREE from 'three';

const ENVS = {  // flags, cables, laundry, birds, gulls, steam, sparks, leaves, aircraft, wind [x,z], cloth colours
  desert: { flags: 4, cables: 3, laundry: 0, birds: 7, steam: 0, sparks: 0, leaves: 0, air: 1, wind: [.75, .35], cloth: [0x6d5f42, 0x7d3f2c, 0x59603e] },
  urban: { flags: 3, cables: 7, laundry: 16, birds: 10, steam: 0, sparks: 0, leaves: 8, air: 1, wind: [.45, -.3], cloth: [0x9a917c, 0x6f7a80, 0x8a4f3a, 0xb3a98f] },
  port: { flags: 3, cables: 4, laundry: 0, birds: 0, gulls: 12, steam: 2, sparks: 0, leaves: 0, air: 1, crane: [[-24, 19.6, 28, 54], [14, 19.6, 54, 28]], wind: [-.8, .5], cloth: [0x41546a, 0x8a3b2c, 0xa39a84] },
  bunker: { flags: 0, cables: 0, laundry: 0, birds: 0, steam: 3, sparks: 6, leaves: 0, air: 0, wind: [.08, .05], cloth: [0x555555] },
  snow: { flags: 3, cables: 3, laundry: 0, birds: 6, steam: 0, sparks: 0, leaves: 0, air: 1, wind: [.9, .25], cloth: [0x8c3a2c, 0x4a5a6c] },
  airbase: { flags: 5, cables: 3, laundry: 0, birds: 5, steam: 0, sparks: 0, leaves: 0, air: 2, wind: [1, .15], cloth: [0xc26a2a, 0xb8b09a, 0x5a6248] },
  refinery: { flags: 2, cables: 5, laundry: 0, birds: 4, steam: 7, sparks: 2, leaves: 0, air: 1, wind: [.55, -.45], cloth: [0x6a4b38, 0x7c7468] },
  valley: { flags: 3, cables: 4, laundry: 10, birds: 9, steam: 0, sparks: 0, leaves: 14, air: 1, wind: [.5, .4], cloth: [0x8c7a5c, 0x7a3f30, 0x5d6a4a, 0xa8a08a] },
};
const LIT = { desert: 1, urban: .82, port: .62, bunker: .5, snow: .95, airbase: .95, refinery: .62, valley: .85 };
const K_FLAG = 0, K_HANG = 1, K_CABLE = 2, K_BIRD = 3, K_PUFF = 4, K_SPARK = 5, K_LEAF = 6, K_RIGID = 7;

const VS = `
attribute vec4 aP;      // phase, amplitude, extra, kind
uniform float uT; uniform vec3 uW;
varying vec3 vC; varying float vA; varying vec2 vU; varying float vK;
#include <fog_pars_vertex>
void main(){
  vec3 p=position; float k=aP.w, s=uW.z, ph=aP.x; vU=uv; vK=k; vA=1.; vC=instanceColor;
  vec4 mvPosition;
  if(k>3.5&&k<6.5){
    float life=fract(uT/aP.y+ph), size=aP.z; vec3 o=vec3(0.);
    if(k<4.5){ o=vec3(uW.x,0.,uW.y)*life*life*2.6; o.y=life*2.8; size*=.6+life*1.9; vA=sin(life*3.14159)*sin(life*3.14159)*.3; }
    else if(k<5.5){ float b=fract(ph*7.3+floor(uT/aP.y+ph)*.37), t=life*aP.y; vA=step(.72,b)*step(t,.62)*(1.-t/.62); o=vec3(cos(ph*40.)*t*.8,-3.6*t*t+.4*t,sin(ph*40.)*t*.8); }
    else { float t=life; o=vec3(uW.x*t*7.+sin(t*9.+ph*6.)*.5,-t*3.4+sin(t*5.+ph)*.2,uW.y*t*7.+cos(t*7.+ph*4.)*.5); vA=smoothstep(0.,.08,t)*(1.-smoothstep(.9,1.,t)); float r=uT*2.2+ph*9.; p.xy=mat2(cos(r),-sin(r),sin(r),cos(r))*p.xy; p.y*=.55+.45*sin(uT*3.1+ph*5.); }
    vec4 c=modelViewMatrix*instanceMatrix*vec4(o,1.); c.xy+=p.xy*size; mvPosition=c;
  } else {
    if(k<.5){ float w=uv.x,a=uT*(2.1+s*1.4)+ph; p.z+=(sin(a-w*5.2)*.17+sin(a*1.7-w*9.)*.05)*w*(.35+s); p.z+=sin(w*7.+ph*.5+uv.y*2.5)*.07*aP.z*w; p.y-=uv.y*.05*aP.z*w; /* [petits] soft fold */ p.y+=sin(a*.8-w*4.)*.05*w*(.3+s)-w*w*.12*(1.1-min(s,1.)); vC*=.8+.26*sin(a-w*5.2+1.2); }
    else if(k<1.5){ float w=1.-uv.y,a=uT*(1.3+s*.6)+ph; p.z+=(sin(a)+.45*sin(a*2.3+uv.x*3.))*.14*w*(.35+s); p.x+=sin(a*1.3+uv.y*2.)*.025*w; vC*=.84+.2*sin(a+uv.x*4.); }
    else if(k<2.5){ float x=uv.x,g=4.*x*(1.-x); p.y-=g*aP.z; p.z+=g*sin(uT*(.9+s*.5)+ph)*.07*(.3+s); }
    else if(k<3.5){ p.y+=abs(p.x)*sin(uT*aP.y+ph)*.75; }
    mvPosition=modelViewMatrix*instanceMatrix*vec4(p,1.);
  }
  gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
}`;
const FS = `
varying vec3 vC; varying float vA; varying vec2 vU; varying float vK;
#include <common>
#include <fog_pars_fragment>
void main(){
  float a=vA; vec3 col=vC;
  if(vK>3.5&&vK<4.5){ float d=length(vU-.5); a*=smoothstep(.5,.08,d); if(a<.004)discard; }
  else if(vK>4.5&&vK<5.5){ float d=length(vU-.5); a*=smoothstep(.5,.15,d); if(a<.02)discard; col*=2.4; }
  else if(vK>5.5&&vK<6.5){ if(a<.05)discard; }
  gl_FragColor=vec4(col,a);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function poolMesh(geo, n, mat, group) {
  const g = geo.clone(), P = new Float32Array(n * 4); g.setAttribute('aP', new THREE.InstancedBufferAttribute(P, 4));
  const m = new THREE.InstancedMesh(g, mat, n); m.setColorAt(0, new THREE.Color(0xffffff)); m.count = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = false; m.renderOrder = mat.transparent ? 6 : 0; group.add(m);
  return { m, P, n, full: 0 };
}

export function install({ engine: E, settings }) {
  const I = E.internals; if (!I || !I.scene || !E.world) return null;
  const scene = I.scene, mq = matchMedia('(prefers-reduced-motion: reduce)');
  const group = new THREE.Group(); group.name = 'ambient'; group.visible = false; scene.add(group);
  const uni = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uW: { value: new THREE.Vector3(.5, .2, .6) } }]);
  const solid = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: FS, fog: true, side: THREE.DoubleSide });
  const soft = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: FS, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });

  const planeF = new THREE.PlaneGeometry(1, 1, 8, 3); planeF.translate(.5, 0, 0);
  const planeH = new THREE.PlaneGeometry(1, 1, 3, 3); planeH.translate(0, -.5, 0);
  const strip = new THREE.PlaneGeometry(1, .035, 14, 1); strip.translate(.5, 0, 0);
  const birdG = new THREE.BufferGeometry(); birdG.setAttribute('position', new THREE.Float32BufferAttribute([-.5, .03, .05, 0, 0, -.12, 0, 0, .14, .5, .03, .05, 0, 0, .14, 0, 0, -.12], 3)); birdG.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, .5, 0, .5, 1, 1, 0, .5, 1, .5, 0], 2));
  const quad = new THREE.PlaneGeometry(1, 1);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const P = {
    flag: poolMesh(planeF, 8, solid, group), hang: poolMesh(planeH, 24, solid, group), cable: poolMesh(strip, 16, solid, group),
    bird: poolMesh(birdG, 24, solid, group), quad: poolMesh(quad, 64, soft, group), rigid: poolMesh(box, 40, solid, group),
  };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0), E2 = new THREE.Euler();
  const put = (pool, x, y, z, yaw, sx, sy, sz, col, ph, amp, ex, kind) => {
    const i = pool.m.count; if (i >= pool.n) return -1;
    Q.setFromAxisAngle(UP, yaw); V.set(x, y, z); S.set(sx, sy, sz); M.compose(V, Q, S); pool.m.setMatrixAt(i, M); pool.m.setColorAt(i, C.set(col));
    pool.P[i * 4] = ph; pool.P[i * 4 + 1] = amp; pool.P[i * 4 + 2] = ex; pool.P[i * 4 + 3] = kind; pool.m.count = i + 1; return i;
  };

  /* ---------- live actors of the scene: birds, crane, aircraft (few matrices, written at half rate) ---------- */
  let birds = [], cranes = [], craft = [], built = '', life = 1, frame = 0, clock = 0, lastQ = -1, qT = 0, seedR = rng(1), mapSize = 60;
  const wind = { x: .5, z: .2, gust: 0 }; let baseX = .5, baseZ = .2;

  function reset() { for (const k in P) { P[k].m.count = 0; P[k].full = 0; } birds = []; cranes = []; craft = []; }
  function tops(W) {
    const out = [];
    for (const s of W.solids) { const dx = s.x1 - s.x0, dz = s.z1 - s.z0; if (s.prop || s.y1 < 3 || s.y1 > 34 || dx < 1.2 || dz < 1.2 || dx > W.size * 1.6 || dz > W.size * 1.6) continue; out.push(s); }
    return out;
  }
  const clearAir = (x, y, z, W) => { for (const s of W.solids) if (x > s.x0 && x < s.x1 && y > s.y0 && y < s.y1 && z > s.z0 && z < s.z1) return false; return true; };
  let buildMs = 0;
  /* nothing above this point: rules out upper floors and anything under a roof */
  const openSky = (x, y, z, W) => { for (const q of W.solids) if (x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1 && q.y1 > y + .15) return false; for (const q of W.covered || []) if (q && x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1 && (q.y1 === undefined || q.y1 > y + .8)) return false; return true; };
  function build() {
    const tB = performance.now(), W = E.world, key = W.sk || W.env, D = ENVS[key] || ENVS[W.env] || ENVS.desert; reset();
    const R = rng(hash(W.id + ':life')), pick = a => a[Math.floor(R() * a.length) % a.length], lit = LIT[key] ?? .85, tint = c => C.set(c).multiplyScalar(lit).getHex();
    mapSize = W.size || 60; seedR = rng(hash(W.id + ':air')); baseX = D.wind[0]; baseZ = D.wind[1]; wind.x = baseX; wind.z = baseZ;
    const T = key === 'bunker' ? [] : tops(W).filter(s => openSky((s.x0 + s.x1) / 2, s.y1, (s.z0 + s.z1) / 2, W)), used = [], far = (x, z, d) => { for (const u of used) if ((u[0] - x) * (u[0] - x) + (u[1] - z) * (u[1] - z) < d * d) return false; return true; };
    const windYaw = Math.atan2(-baseZ, baseX);
    /* flags on poles, on the roofs */
    /* [petits] each flag is planted on the roof itself (inset from the edge), with no wall, rock or upper floor within reach of the pole or the swinging cloth; the cloth turns away from obstacles and carries a soft fold */
    const wallNear = (x, y, z, h, W) => { for (const q of W.solids) if (q.y1 > y + .3 && q.y0 < y + h && q.x1 > x - 1.7 && q.x0 < x + 1.7 && q.z1 > z - 1.7 && q.z0 < z + 1.7) return true; return false; };
    for (let n = 0, tries = 0; n < D.flags && tries < 160 && T.length; tries++) {
      const s = pick(T), dxs = s.x1 - s.x0, dzs = s.z1 - s.z0; if (dxs < 3 || dzs < 3) continue;
      const x = R() < .5 ? s.x0 + .7 : s.x1 - .7, z = R() < .5 ? s.z0 + .7 : s.z1 - .7, y = s.y1, h = 2.6 + R() * 1.2;
      if (!far(x, z, 13) || !clearAir(x, y + 1, z, W) || !openSky(x, y, z, W) || wallNear(x, y, z, h + .4, W)) continue;
      let yaw = null;
      for (const da of [0, .5, -.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
        const a = windYaw + da, cx = Math.cos(a), cz = -Math.sin(a); let ok = true;
        for (const u of [.5, 1, 1.45]) for (const sd of [-.4, 0, .4]) { const px = x + cx * u - cz * sd, pz = z + cz * u + cx * sd; if (!clearAir(px, y + h - .3, pz, W) || !clearAir(px, y + h, pz, W)) ok = false; }
        if (ok) { yaw = a; break; }
      }
      if (yaw === null) continue;
      used.push([x, z]); n++;
      put(P.rigid, x, y + h / 2, z, 0, .05, h, .05, tint(0x3b3a34), 0, 0, 0, K_RIGID);
      put(P.flag, x, y + h - .36, z, yaw + (R() - .5) * .15, 1.25, .72, 1, tint(pick(D.cloth)), R() * 6.3, 1, .6 + R() * .6, K_FLAG);
    }
    /* cables between roofs, with laundry on some of them */
    let hung = 0;
    for (let n = 0, tries = 0; n < D.cables && tries < 420 && T.length > 1 && performance.now() - tB < 8; tries++) {
      const a = pick(T), b = pick(T); if (a === b) continue;
      const span = (p0, p1, q0, q1) => { const l = Math.max(p0, q0), h = Math.min(p1, q1); if (l <= h) { const v = l + (h - l) * R(); return [v, v]; } return p1 < q0 ? [p1, q0] : [p0, q1]; };       // facing edges: the wire crosses the street between two buildings
      const [ax, bx] = span(a.x0, a.x1, b.x0, b.x1), [az, bz] = span(a.z0, a.z1, b.z0, b.z1), d = Math.hypot(bx - ax, bz - az); if (d < 3.5 || d > 17) continue;
      const y = Math.min(a.y1, b.y1) - .25 + R() * .15, sag = .25 + d * .028; let ok = true;
      try { ok = E.los(ax + (bx - ax) * .04, y, az + (bz - az) * .04, ax + (bx - ax) * .96, y - sag * .6, az + (bz - az) * .96); } catch { ok = false; }
      if (!ok || y < 2.6 || !openSky(ax, y, az, W) || !openSky(bx, y, bz, W) || !openSky((ax + bx) / 2, y - sag, (az + bz) / 2, W)) continue; n++;
      const yaw = Math.atan2(-(bz - az), bx - ax), ph = R() * 6.3;
      put(P.cable, ax, y, az, yaw, d, 1, 1, tint(0x23221e), ph, 1, sag, K_CABLE);
      if (hung < D.laundry && d > 4.5) {
        const pieces = Math.min(D.laundry - hung, 2 + Math.floor(d / 3));
        for (let j = 0; j < pieces; j++) { const u = .16 + .68 * (j + R() * .5) / pieces, g = 4 * u * (1 - u) * sag, w = .42 + R() * .5, h2 = .5 + R() * .45; put(P.hang, ax + (bx - ax) * u, y - g, az + (bz - az) * u, yaw, w, h2, 1, tint(pick(D.cloth)), R() * 6.3, 1, 0, K_HANG); hung++; }
      }
    }
    /* steam from thin tall things */
    if (D.steam) {
      const thin = W.solids.filter(s => { const dx = s.x1 - s.x0, dz = s.z1 - s.z0; return !s.prop && dx < 3.4 && dz < 3.4 && dx > .15 && dz > .15 && s.y1 > 2.2 && s.y1 < 30; });
      for (let n = 0, tries = 0; n < D.steam && tries < 60 && thin.length; tries++) {
        const s = pick(thin), x = (s.x0 + s.x1) / 2, z = (s.z0 + s.z1) / 2, y = s.y1 + .05; if (!clearAir(x, y + .5, z, W) || !far(x, z, 7) || (key !== 'bunker' && !openSky(x, y, z, W))) continue; used.push([x, z]); n++;
        for (let j = 0; j < 5; j++) put(P.quad, x, y, z, 0, 1, 1, 1, key === 'bunker' ? 0xb8bcc0 : 0xe2ddd2, R(), 3.4 + R() * 1.6, .55 + R() * .4, K_PUFF);
      }
    }
    /* sparks: short bursts from the spots a technician would worry about */
    if (D.sparks) {
      const sp = W.spawns || [];
      for (let n = 0; n < D.sparks && sp.length; n++) {
        const q = pick(sp), a = R() * 6.3, x = q[0] + Math.cos(a) * 3, z = q[1] + Math.sin(a) * 3, y = key === 'bunker' ? 2.7 : 4.2; if (!clearAir(x, y, z, W)) continue;
        for (let j = 0; j < 5; j++) put(P.quad, x, y, z, 0, 1, 1, 1, 0xffb050, R(), 2.8 + n * .7, .035 + R() * .03, K_SPARK);
      }
    }
    /* leaves */
    for (let n = 0; n < D.leaves; n++) { const a = R() * 6.3, r = R() * mapSize * .7; put(P.quad, Math.cos(a) * r, 3 + R() * 5, Math.sin(a) * r, 0, 1, 1, 1, tint(pick([0x9a6a2c, 0x7c5426, 0xa8842f])), R(), 9 + R() * 8, .13 + R() * .06, K_LEAF); }
    /* birds: a flock rests, leaves together, circles and comes back */
    const nB = (D.birds || 0) + (D.gulls || 0), gull = !!D.gulls;
    if (nB && T.length) {
      const flocks = Math.max(1, Math.round(nB / 5));
      for (let f = 0; f < flocks; f++) {
        const s = pick(T), hx = (s.x0 + s.x1) / 2, hz = (s.z0 + s.z1) / 2, hy = s.y1 + .08, cx = hx + (R() - .5) * 16, cz = hz + (R() - .5) * 16, count = Math.floor(nB / flocks), T0 = 5 + R() * 22;
        for (let j = 0; j < count; j++) {
          const i = put(P.bird, hx + (R() - .5) * 2.4, hy, hz + (R() - .5) * 2.4, R() * 6.3, gull ? .62 : .4, gull ? .62 : .4, gull ? .62 : .4, gull ? tint(0xe6e4dc) : tint(0x1e1d1b), R() * 6.3, gull ? 7 : 12, 0, K_BIRD);
          if (i >= 0) birds.push({ i, hx: P.bird.m.instanceMatrix.array[i * 16 + 12], hy, hz: P.bird.m.instanceMatrix.array[i * 16 + 14], cx, cz, cy: hy + (gull ? 11 : 8) + R() * 5, r: (gull ? 13 : 8) + R() * 7, ph: R() * 6.3, sp: (gull ? .36 : .62) + R() * .18, s: gull ? .62 : .4, t0: T0 + j * .06, per: 34 + f * 9 });
        }
      }
    }
    /* the port's cranes carry a load back and forth */
    for (const c of D.crane || []) {
      const hook = put(P.rigid, c[0], c[1], c[2], 0, .9, .35, 1.3, tint(0x8a6a2a), 0, 0, 0, K_RIGID), wire = put(P.rigid, c[0], c[1] - 3, c[2], 0, .06, 6, .06, tint(0x1e1e1c), 0, 0, 0, K_RIGID), load = put(P.rigid, c[0], c[1] - 6.4, c[2], 0, 2.3, 2.2, 5.6, tint(pick([0x7a3f2c, 0x3f566a, 0x5f6a48])), 0, 0, 0, K_RIGID);
      if (hook >= 0 && load >= 0) cranes.push({ hook, wire, load, x: c[0], y: c[1], a: c[2], b: c[3], ph: R() * 6.3 });
    }
    /* aircraft: built from boxes, parked out of sight until their pass */
    for (let n = 0; n < (D.air || 0); n++) {
      const heli = n === 0 && key !== 'airbase', col = tint(0x2c2f2a);
      const parts = heli ? [[0, 0, 0, 1.3, 1.2, 4.4, col], [0, .25, 3.6, .3, .35, 3.2, col], [0, .85, 0, 8.4, .05, .34, 0x1a1a18], [0, .85, 0, .34, .05, 8.4, 0x1a1a18]]
        : [[0, 0, 0, 1.5, 1.5, 11, col], [0, .1, .4, 12, .16, 1.9, col], [0, .9, 4.8, .16, 1.9, 1.5, col], [0, .1, 4.9, 4, .12, .9, col]];
      const ids = []; for (const q of parts) ids.push(put(P.rigid, 0, -400, 0, 0, q[3], q[4], q[5], q[6], 0, 0, 0, K_RIGID));
      if (ids.every(i => i >= 0)) craft.push({ ids, parts, heli, t: -(18 + seedR() * 40) - n * 21, dur: heli ? 26 : 16, ax: 0, az: 0, bx: 0, bz: 0, y: 0 });
    }
    for (const k in P) { const p = P[k]; p.full = p.m.count; p.m.instanceMatrix.needsUpdate = true; if (p.m.instanceColor) p.m.instanceColor.needsUpdate = true; p.m.geometry.attributes.aP.needsUpdate = true; }
    built = W.id; lastQ = -1; buildMs = performance.now() - tB;
  }

  /* ---------- quality: all at the top levels, half at the middle, nothing at the lowest or with reduced motion ---------- */
  function applyLife() {
    let q = 0; try { q = E.perf.qLevel | 0; } catch { /* keep */ }
    const off = !!settings.get('gameplay.reducedMotion') || mq.matches || /^(bas|mobile)$/.test(settings.get('graphics.preset')) || q >= 4, want = off ? 0 : q >= 2 ? .5 : 1;
    if (want === life && q === lastQ) return; life = want; lastQ = q;
    group.visible = want > 0 && !!built;
    for (const k of ['quad', 'hang', 'cable']) { const p = P[k]; p.m.count = Math.ceil(p.full * (want || 0)); }
  }

  /* ---------- per frame ---------- */
  const flyQ = new THREE.Quaternion();
  function liveBirds(t) {
    const m = P.bird.m;
    for (let n = 0; n < birds.length; n++) {
      const b = birds[n], c = ((t - b.t0) % b.per + b.per) % b.per, up = c < 2.2 ? c / 2.2 : c > b.per - 3 ? (b.per - c) / 3 : 1;
      const e = up * up * (3 - 2 * up), a = b.ph + t * b.sp;
      const fx = b.cx + Math.cos(a) * b.r, fz = b.cz + Math.sin(a) * b.r, fy = b.cy + Math.sin(a * 1.7) * 1.1;
      V.set(b.hx + (fx - b.hx) * e, b.hy + (fy - b.hy) * e, b.hz + (fz - b.hz) * e);
      const yaw = e > .02 ? -a : b.ph; flyQ.setFromAxisAngle(UP, yaw); const sc = b.s; S.set(sc, sc, sc); M.compose(V, flyQ, S); m.setMatrixAt(b.i, M);
      P.bird.P[b.i * 4 + 1] = e > .02 ? (b.s > .5 ? 7 : 13) : 0;          // wings still when perched
    }
    if (birds.length) { m.instanceMatrix.needsUpdate = true; m.geometry.attributes.aP.needsUpdate = true; }
  }
  function liveCrane(t) {
    if (!cranes.length) return; const m = P.rigid.m;
    for (const c of cranes) {
      const k = .5 - .5 * Math.cos(t * .085 + c.ph), z = c.a + (c.b - c.a) * k * k * (3 - 2 * k), sway = Math.sin(t * .9 + c.ph) * .1 * (1 - Math.abs(2 * k - 1));
      const set = (i, x, y, zz, sx, sy, sz) => { V.set(x, y, zz); S.set(sx, sy, sz); M.compose(V, Q.identity(), S); m.setMatrixAt(i, M); };
      set(c.hook, c.x, c.y, z, .9, .35, 1.3); set(c.wire, c.x + sway * .5, c.y - 3, z, .06, 6, .06); set(c.load, c.x + sway, c.y - 7.2, z, 2.3, 2.2, 5.6);
    }
    m.instanceMatrix.needsUpdate = true;
  }
  function liveCraft(dt) {
    if (!craft.length) return; const m = P.rigid.m; let dirty = false;
    for (const f of craft) {
      f.t += dt;
      if (f.t < 0) { if (f.vis) { f.vis = false; for (let i = 0; i < f.ids.length; i++) { V.set(0, -400, 0); S.set(1, 1, 1); M.compose(V, Q.identity(), S); m.setMatrixAt(f.ids[i], M); } dirty = true; } continue; }
      if (!f.vis) { f.vis = true; const a = seedR() * 6.283, R0 = mapSize + 70, off = (seedR() - .5) * mapSize; f.ax = Math.cos(a) * R0 - Math.sin(a) * off; f.az = Math.sin(a) * R0 + Math.cos(a) * off; f.bx = -Math.cos(a) * R0 - Math.sin(a) * off; f.bz = -Math.sin(a) * R0 + Math.cos(a) * off; f.y = f.heli ? 34 + seedR() * 12 : 62 + seedR() * 24; f.yaw = Math.atan2(f.ax - f.bx, f.az - f.bz); }
      const k = f.t / f.dur; if (k >= 1) { f.t = -(48 + seedR() * 70); continue; }
      const px = f.ax + (f.bx - f.ax) * k, pz = f.az + (f.bz - f.az) * k, py = f.y + (f.heli ? Math.sin(k * 11) * .5 : 0), cy = Math.cos(f.yaw), sy = Math.sin(f.yaw), tilt = f.heli ? .12 : 0;
      E2.set(tilt, f.yaw, 0, 'YXZ'); Q.setFromEuler(E2);
      for (let i = 0; i < f.ids.length; i++) {
        const q = f.parts[i]; let yaw = Q;
        if (f.heli && i >= 2) { E2.set(0, clock * 19 + i, 0); flyQ.setFromEuler(E2); yaw = flyQ; }
        V.set(px + q[0] * cy + q[2] * sy, py + q[1], pz - q[0] * sy + q[2] * cy); S.set(q[3], q[4], q[5]); M.compose(V, yaw, S); m.setMatrixAt(f.ids[i], M);
      }
      dirty = true;
    }
    if (dirty) m.instanceMatrix.needsUpdate = true;
  }
  const up0 = E.world.update, W = E.world; let cost = 0, costN = 0;
  W.update = function (dt, time, c) {
    up0.call(W, dt, time, c);
    if (!built || built !== W.id) { if (group.visible) group.visible = false; return; }
    const t0 = performance.now();
    try {
      if ((qT -= dt) <= 0) { qT = 1; applyLife(); }
      if (life > 0 && group.visible) {
        clock += Math.min(dt, .1);
        const g = Math.sin(clock * .23) * .5 + Math.sin(clock * .61 + 1.4) * .3 + Math.sin(clock * 1.7) * .08; wind.gust = g; wind.x = baseX * (1 + g * .4); wind.z = baseZ * (1 + g * .4);
        const u = uni.uW.value; u.set(wind.x, wind.z, Math.hypot(wind.x, wind.z)); uni.uT.value = clock;
        if (++frame & 1) { liveBirds(clock); liveCrane(clock); } else liveCraft(dt * 2);
      }
    } catch (e) { group.visible = false; built = ''; console.warn('[ambient] disabled', e); }
    cost += performance.now() - t0; costN++;
  };
  // built while the loader is at "units", before its shader pass, so the one program links behind the loading screen
  E.on('loading', e => {
    if (!e || !e.active) return;
    if (e.phase === 'map' || e.phase === 'init') { if (built && built !== e.map) { built = ''; group.visible = false; } return; }
    if (e.phase === 'units' && E.world.id === e.map && built !== e.map) { try { build(); life = -1; applyLife(); } catch (x) { built = ''; group.visible = false; console.warn('[ambient] build', x); } }
  });
  settings.on('change', p => { if (typeof p === 'string' && (p === 'gameplay.reducedMotion' || p === 'graphics.preset')) { lastQ = -1; applyLife(); } });
  if (mq.addEventListener) mq.addEventListener('change', () => { lastQ = -1; applyLife(); });

  const api = { wind, setWind(x, z) { baseX = +x || 0; baseZ = +z || 0; }, get stats() { const r = { ms: costN ? cost / costN : 0, frames: costN, built, buildMs, level: life, draws: Object.values(P).filter(p => p.m.count).length, inst: Object.fromEntries(Object.entries(P).map(([k, p]) => [k, p.m.count])) }; return r; }, resetStats() { cost = 0; costN = 0; } };
  E.ambient = api;
  return api;
}
