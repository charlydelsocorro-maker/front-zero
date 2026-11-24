// FRONT ZÉRO — fire effects of the flamethrower and the flare: one pooled additive Points draw, burning actors, no real-time light of its own.
// A failure here must never break a match: game.js calls every entry inside try/catch.
import * as THREE from 'three';

const N = 320, MAX_BURN = 16;
const VERT = 'attribute vec3 aData;varying float vK;varying float vA;uniform float uH;void main(){vK=aData.y;vA=aData.z;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;vA*=smoothstep(.07,.32,-mv.z);gl_PointSize=aData.z>0.?clamp(aData.x*uH*projectionMatrix[1][1]/max(.1,-mv.z),1.,130.):0.;}';
const FRAG = 'varying float vK;varying float vA;void main(){vec2 p=gl_PointCoord-.5;float r=dot(p,p)*4.;if(r>1.)discard;float f=pow(1.-r,2.1)*vA;vec3 c=mix(vec3(1.,.66,.2),mix(vec3(.95,.3,.05),vec3(.22,.05,.02),clamp(vK*2.-1.,0.,1.)),clamp(vK*2.2,0.,1.));gl_FragColor=vec4(c*f,f*.55);}';

export function createFire(ctx) {
  const { scene, grid } = ctx;
  const pos = new Float32Array(N * 3), data = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N), size = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aData', new THREE.BufferAttribute(data, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, uniforms: { uH: { value: 720 } }, vertexShader: VERT, fragmentShader: FRAG, fog: false, toneMapped: false });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; points.renderOrder = 6; points.name = 'fire'; scene.add(points);       // always in the scene: its shader compiles with the map, never at first use
  let head = 0, live = 0, dirty = false;
  const emit = (x, y, z, vx, vy, vz, l, s) => {
    const i = head; head = (head + 1) % N; if (life[i] <= 0) live++;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; life[i] = max[i] = l; size[i] = s; dirty = true;
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const burns = []; for (let i = 0; i < MAX_BURN; i++) burns.push({ a: null, by: null, t: 0, tick: 0, dps: 0, id: '', real: false, fx: 0 });
  let flareT = 0;
  const api = {
    points,
    /** One tick of the jet, from the muzzle along the aim. It stops at the first wall. */
    jet(mx, my, mz, dx, dy, dz, range) {
      const reach = Math.min(range, grid.ray(mx, my, mz, dx, dy, dz, range));
      const k = ctx.density ? ctx.density() : 1, n = Math.max(4, Math.round(9 * k));
      for (let c = 0; c < n; c++) {
        const f = Math.random(), o = f * f * reach * .62, sp = rnd(.5, .95) * reach / .3, s = .05 + f * .13, w = o * .13;       // spread along the jet: a continuous cone that widens with distance
        emit(mx + dx * (.04 + o) + rnd(-w, w), my + dy * (.04 + o) + rnd(-w, w), mz + dz * (.04 + o) + rnd(-w, w), dx * sp + rnd(-s, s) * sp, dy * sp + rnd(-s, s) * sp + .4, dz * sp + rnd(-s, s) * sp, rnd(.16, .3), .08 + f * .15);
      }
    },
    /** Sets `a` on fire. real = this client applies the damage (offline, or an actor it simulates); online players are burned by the server. */
    ignite(a, by, def, real) {
      if (!a || !a.alive || !def || !def.flame) return;
      let b = burns.find(q => q.a === a) || burns.find(q => !q.a); if (!b) return;
      if (b.a !== a) { b.tick = .25; b.fx = 0; }
      b.a = a; b.by = by || null; b.t = def.flame.t; b.dps = def.flame.dps; b.id = def.id; b.real = !!real;
    },
    burning: a => burns.some(q => q.a === a),
    update(dt) {
      for (let i = 0; i < MAX_BURN; i++) {
        const b = burns[i], a = b.a; if (!a) continue;
        b.t -= dt; if (!a.alive || b.t <= 0) { b.a = null; b.by = null; continue; }
        b.fx -= dt; if (b.fx <= 0) { b.fx = .05; const h = rnd(.15, 1.55); emit(a.pos.x + rnd(-.24, .24), a.pos.y + h, a.pos.z + rnd(-.24, .24), rnd(-.2, .2), rnd(.9, 1.8), rnd(-.2, .2), rnd(.26, .46), rnd(.14, .26)); }
        if (b.real) { b.tick -= dt; if (b.tick <= 0) { b.tick += .25; try { ctx.burnDamage(a, b.dps * .25, b.by, b.id); } catch (e) { console.warn('[fire] burn', e); } } }
      }
      /* flares in flight or on the ground: sparks, and the projectile system's one pooled flash light follows the nearest */
      const P = ctx.proj; flareT -= dt;
      if (P && P.stats.live > 0) {
        let best = null, bd = Infinity; const c = ctx.camPos;
        for (let i = 0; i < P.pool.length; i++) {
          const p = P.pool[i]; if (!p.live || !p.def || !p.def.flare || p.wait > 0) continue;
          const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2; if (d < bd) { bd = d; best = p; }
          if (flareT <= 0) { emit(p.x, p.y + .05, p.z, rnd(-.5, .5), rnd(.4, 1.5), rnd(-.5, .5), rnd(.3, .6), rnd(.1, .2)); emit(p.x, p.y + .05, p.z, 0, .1, 0, .12, .46); }
        }
        if (flareT <= 0) flareT = .035;
        if (best && P.glow) P.glow(best.x, best.y + .25, best.z, 15 + Math.sin(performance.now() * .021) * 3);
      }
      if (live > 0 || dirty) {
        let any = 0;
        for (let i = 0; i < N; i++) {
          if (life[i] <= 0) { if (data[i * 3 + 2] !== 0) data[i * 3 + 2] = 0; continue; }
          life[i] -= dt; if (life[i] <= 0) { life[i] = 0; data[i * 3 + 2] = 0; live--; continue; }
          any++; const q = i * 3, k = 1 - life[i] / max[i], damp = Math.exp(-3.4 * dt);
          vel[q] *= damp; vel[q + 2] *= damp; vel[q + 1] = vel[q + 1] * damp + 2.6 * dt;
          pos[q] += vel[q] * dt; pos[q + 1] += vel[q + 1] * dt; pos[q + 2] += vel[q + 2] * dt;
          data[q] = size[i] * (.7 + k * 1.5); data[q + 1] = k; data[q + 2] = Math.min(1, k * 8) * (1 - k * k) * .62;
        }
        live = any; geo.attributes.position.needsUpdate = true; geo.attributes.aData.needsUpdate = true; dirty = false;
      }
    },
    setHeight(h) { mat.uniforms.uH.value = h; },
    clear() { life.fill(0); data.fill(0); live = 0; geo.attributes.aData.needsUpdate = true; for (const b of burns) { b.a = null; b.by = null; } },
    get liveCount() { return live; },
  };
  return api;
}
